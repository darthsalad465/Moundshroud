// Chat: streaming answers from the local model, grounded in your files and the offline libraries.
(() => {
  let chats = [], cur = null, busy = false, ctl = null, saveT = null;
  const msgsEl = $('msgs'), inEl = $('in');
  const collections = A.collectionSelect;
  $('chselect').innerHTML = collections.toolbar('<button class="ib" data-selection="pin">Pin</button><button class="ib" data-selection="unpin">Unpin</button><button class="ib dang" data-selection="delete">Delete selected</button>');
  const selection = collections.bind($('chside'), {
    pin: ids => pinGroup(ids, true),
    unpin: ids => pinGroup(ids, false),
    delete: deleteGroup
  });
  const newChat = () => ({ id: Date.now().toString(36), title: 'New chat', msgs: [], updated: Date.now(), pinned: false });
  const persist = () => {
    renderSidebar();
    clearTimeout(saveT);
    saveT = setTimeout(() => { fetch('/api/chats', { method: 'POST', body: JSON.stringify(chats.filter(c => c.msgs.length).map(c => ({ id: c.id, title: c.title, updated: c.updated, pinned: !!c.pinned, messages: c.msgs.map(m => ({ role: m.role, content: m.content, thinking: m.thinking, local: m.local, img: m.img, made: m.made, runs: m.runs, ms: m.ms, thinkMs: m.thinkMs, sources: (m.sources || []).map(s => ({ title: s.title, page: s.page, kind: s.kind, path: s.path, url: s.url, where: s.where, text: s.kind === 'attach' ? '' : (s.text || '').slice(0, 700) })) })) }))) }).catch(() => {}); }, 600);
  };
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
    d.innerHTML = (m.thinking ? '<details><summary>Thinking</summary><div>' + esc(m.thinking) + '</div></details>' : '') + '<div class="bd">' + (m.content ? md(m.content) : waitHtml('Thinking…')) + '</div>' + timeHtml(m) + runsHtml(m) + imgHtml(m) + madeHtml(m) + srcChips(m.sources) +
      (m.err ? '<div class="errbar"><button class="ib" data-t="redo">↻ Try again</button><span class="small mute">Nothing was lost. Your question is still above.</span></div>' : '') + (m.local ? '' : toolsHtml('assistant'));
    /* ▶ Run on every Python and JavaScript block: it runs in the sealed-off sandbox and the output shows under it */
    if (runOn() && A.interp) d.querySelectorAll('.bd pre[data-lang]').forEach(p => { if (A.interp.LANG(p.dataset.lang)) p.insertAdjacentHTML('afterbegin', '<button class="cp runbtn" title="Run this code in the sealed-off sandbox on this PC">▶ Run</button>'); });
  }
  /* how long a reply took, and how long it thought before the first word: kept with the chat, so it survives a reload */
  const fmtMs = ms => A.act ? A.act.fmt(ms) : Math.round((+ms || 0) / 1000) + ' s';
  function timeHtml(m) { if (!m || !m.ms) return ''; return '<div class="mtime" title="From pressing Send to the last word">⏱ ' + fmtMs(m.ms) + ' in all' + (m.thinkMs ? ' · thinking ' + fmtMs(m.thinkMs) : '') + '</div>'; }
  function lastTime(m) { const el = $('lasttime'); if (!el || !m || !m.ms) return; el.textContent = 'last reply ' + fmtMs(m.ms) + (m.thinkMs ? ' (thinking ' + fmtMs(m.thinkMs) + ')' : ''); el.title = 'How long the previous reply took, from pressing Send to the last word'; }
  /* what the code interpreter ran, what it printed, and its charts */
  function runsHtml(m) {
    if (!m.runs || !m.runs.length) return '';
    return m.runs.map(r => '<details class="runbox"' + (r.figs && r.figs.length ? ' open' : '') + '><summary><span class="' + (r.ok ? 'ok' : 'bad') + '">●</span> Ran ' + (r.lang === 'python' ? 'Python' : 'JavaScript') + ' in the sandbox · ' + ((r.ms || 0) / 1000).toFixed(1) + ' s' + (r.ok ? '' : ' · failed') + '</summary><pre class="runcode">' + esc(r.code) + '</pre><pre class="runout">' + esc(r.out) + '</pre></details>' + (r.figs || []).filter(u => /^\/api\/art\/file\?id=[a-z0-9-]+$/.test(u)).map(u => '<img class="runfig" src="' + esc(u) + '" alt="chart">').join('')).join('');
  }
  /* a picture the chat made or edited (kept in data\art, shown from /api/art/file) */
  function imgHtml(m) {
    if (!m.img || !/^\/api\/art\/file\?id=[a-z0-9-]+$/.test(String(m.img.url || ''))) return '';
    return '<div class="chatimg"><img src="' + esc(m.img.url) + '" alt="' + esc(m.img.subject || 'picture') + '" data-t="imgopen"><div class="row"><button class="ib" data-t="imgsave">💾 Save</button></div></div>';
  }

  /* a picture, clip or sound made by any model on this PC (A.anyModel, kept in datamade and shown from /api/models/made) */
  function madeHtml(m) {
    if (!m.made || !/^\/api\/models\/made\?id=[0-9a-f]{12}$/.test(String(m.made.url || '')) || !A.anyModel) return '';
    return A.anyModel.mediaHTML(m.made, m.made.caption || '');
  }

  /* the waiting dot with words beside it, so a reply that has not started yet says what is happening */
  function waitHtml(label) { return '<span class="dots"></span><span class="stl">' + esc(label) + '</span>'; }
  function setStatus(t, k) { const s = $('status'); s.textContent = t; if (k) s.dataset.k = k; else delete s.dataset.k; }
  function renderAll() {
    msgsEl.innerHTML = '';
    updateHeader();
    renderSidebar();
    if (!cur.msgs.length) { empty(); return; }
    cur.msgs.forEach((m, i) => msgsEl.appendChild(render(m, i)));
    msgsEl.scrollTop = msgsEl.scrollHeight;
  }

  /* ---------- Agent-style left chat history sidebar ---------- */
  const chatAgo = t => {
    const s = Math.max(0, (Date.now() - (t || 0)) / 1000);
    if (s < 60) return 'just now';
    if (s < 3600) return Math.floor(s / 60) + 'm ago';
    if (s < 86400) return Math.floor(s / 3600) + 'h ago';
    return new Date(t).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
  };
  function updateHeader() {
    const tt = $('chtitle'), sub = $('chsub'), has = !!(cur && cur.msgs.length);
    if (tt) { tt.textContent = (cur && cur.title) || 'New chat'; tt.disabled = !has; }
    if (sub) sub.textContent = has ? (cur.msgs.length + (cur.msgs.length === 1 ? ' message' : ' messages') + (cur.pinned ? ' · 📌 Pinned' : '')) : 'Private · On-device';
    ['chpin', 'chren', 'chexp', 'chdel'].forEach(id => { const el = $(id); if (el) el.style.display = has ? '' : 'none'; });
    const pinBtn = $('chpin'); if (pinBtn && cur) pinBtn.classList.toggle('on', !!cur.pinned);
  }
  function renderSidebar() {
    const listEl = $('chlist'); if (!listEl) return;
    const q = (($('chsq') && $('chsq').value) || '').trim().toLowerCase();
    const saved = chats.filter(c => c.msgs.length).sort((a, b) => (b.updated || 0) - (a.updated || 0));
    const filtered = q ? saved.filter(c => (c.title || '').toLowerCase().includes(q) || c.msgs.some(m => String(m.content || '').toLowerCase().includes(q))) : saved;
    const clrBtn = $('chclr'); if (clrBtn) clrBtn.style.display = saved.length ? '' : 'none';
    $('chselect').hidden = !saved.length;
    if (!filtered.length) {
      listEl.innerHTML = '<div class="chsempty small mute">' + (q ? 'No chats match “' + esc(q) + '”.' : 'Your saved conversations appear here, grouped by date.') + '</div>';
      selection.sync();
      return;
    }
    const now = new Date(), dayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
    const yestStart = dayStart - 864e5, weekStart = dayStart - 7 * 864e5;
    const buckets = [['📌 Pinned', []], ['Today', []], ['Yesterday', []], ['Last 7 days', []], ['Older', []]];
    filtered.forEach(c => {
      if (c.pinned) buckets[0][1].push(c);
      else if ((c.updated || 0) >= dayStart) buckets[1][1].push(c);
      else if ((c.updated || 0) >= yestStart) buckets[2][1].push(c);
      else if ((c.updated || 0) >= weekStart) buckets[3][1].push(c);
      else buckets[4][1].push(c);
    });
    listEl.innerHTML = buckets.filter(g => g[1].length).map(([label, items]) =>
      '<div class="aggrp">' + label + '</div>' +
      items.map(c =>
        '<div class="chrow' + (cur && cur.id === c.id ? ' on' : '') + (c.pinned ? ' pinned' : '') + '" data-id="' + esc(c.id) + '" data-select-id="' + esc(c.id) + '">' +
          collections.check('Select ' + c.title) +
          '<div class="agrt"><span>' + esc(c.title || 'Chat') + '</span></div>' +
          '<div class="agrm">' + c.msgs.length + (c.msgs.length === 1 ? ' msg' : ' msgs') + ' · ' + esc(chatAgo(c.updated)) + '</div>' +
          '<div class="chacts">' +
            '<button type="button" class="chact" data-ca="pin" title="' + (c.pinned ? 'Unpin' : 'Pin') + '">📌</button>' +
            '<button type="button" class="chact" data-ca="ren" title="Rename">✎</button>' +
            '<button type="button" class="chact dang" data-ca="del" title="Delete chat">✕</button>' +
          '</div>' +
        '</div>'
      ).join('')
    ).join('');
    selection.sync();
  }
  function pinGroup(ids, on) {
    const keys = new Set(ids);
    for (const c of chats) if (keys.has(c.id)) c.pinned = on;
    updateHeader();
    persist();
    return ids;
  }
  async function deleteGroup(ids) {
    if (busy && ids.includes(cur.id)) { A.toast('Stop the current reply before deleting that chat.'); return; }
    if (!(await A.confirm('Delete ' + ids.length + ' selected chats?', { title: 'Delete chats', okLabel: 'Delete', danger: true }))) return;
    if (busy && ids.includes(cur.id)) { A.toast('Stop the current reply before deleting that chat.'); return; }
    const keys = new Set(ids);
    chats = chats.filter(c => !keys.has(c.id));
    if (keys.has(cur.id)) { cur = newChat(); chats.unshift(cur); renderAll(); }
    persist();
    return ids;
  }
  async function renameChat(id) {
    const c = chats.find(x => x.id === id); if (!c) return;
    const next = await A.prompt('Rename this chat:', c.title || 'Chat', { title: 'Rename chat' });
    if (next == null) return;
    const clean = next.trim().slice(0, 80);
    if (!clean) return;
    c.title = clean;
    if (cur && cur.id === c.id) updateHeader();
    persist();
  }
  function togglePinChat(id) {
    const c = chats.find(x => x.id === id); if (!c) return;
    c.pinned = !c.pinned;
    if (cur && cur.id === c.id) updateHeader();
    persist();
    A.toast(c.pinned ? 'Pinned chat' : 'Unpinned chat');
  }
  function exportChatMd(id) {
    const c = chats.find(x => x.id === id); if (!c || !c.msgs.length) return;
    const mdOut = '# ' + (c.title || 'Moundshroud Chat') + '\n\n' +
      c.msgs.map(m => '## ' + (m.role === 'user' ? 'You' : 'Moundshroud') + '\n\n' + (m.content || '')).join('\n\n---\n\n');
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([mdOut], { type: 'text/markdown;charset=utf-8' }));
    a.download = (c.title || 'chat').replace(/[^a-z0-9._-]+/gi, '-').slice(0, 48) + '.md';
    a.click();
    A.toast('Exported Markdown');
  }
  async function confirmRemoveChat(id) {
    const c = chats.find(x => x.id === id); if (!c) return;
    if (!(await A.confirm('Delete the chat “' + (c.title || 'Chat') + '”? This cannot be undone.', { title: 'Delete chat', okLabel: 'Delete', danger: true }))) return;
    A.chat.remove(id);
    A.toast('Chat deleted');
  }
  function empty() {
    const d = document.createElement('div'); d.id = 'empty';
    d.innerHTML = '<div class="reactor"><i></i><i></i><i></i><i></i></div><div class="big">Hey, I&rsquo;m Moundshroud.</div><div class="mute small" style="text-align:center">Private, offline, and all yours. What are we working on?</div>' +
      '<div class="starters" id="starters"></div>';
    msgsEl.appendChild(d);
    const ex = ['💡 Explain how vaccines work', '🧮 What is 18% of 240?', '⏰ Help me plan a 30-minute workout', '📝 Draft a weekly project update', '🔧 How do I fix a leaking tap?', '📖 Define "ephemeral"'];
    $('starters').innerHTML = ex.map(e => '<span class="chip">' + esc(e) + '</span>').join('');
    $('starters').onclick = e => { const c = e.target.closest('.chip'); if (c) { inEl.value = c.textContent.replace(/^\S+\s/, ''); send(); } };
  }

  /* ---------- context from files + libraries ---------- */
/* how much of each web page to read, chosen by the model that will answer: a 2B local model gets a few thousand chars so its small context isn't swamped, while a cloud model gets whole pages */
function readBudget(m) {
    const name = String(m || '');
    if (A.ai && A.ai.isCloud(name)) return { pages: 3, chars: 40000, total: 100000 };     // whole articles: Claude's context is large
    if (/free|auto/i.test(name)) return { pages: 2, chars: 25000, total: 45000 };
    const hit = /(\d+(?:\.\d+)?)\s*b\b/i.exec(name);            // Qwen3.5:2b, gemma4:12b, gemma4:e4b
    const size = hit ? parseFloat(hit[1]) : (/\d+m\b/i.test(name) ? 0.3 : 8);
    if (size <= 2) return { pages: 2, chars: 4000, total: 8000 };
    if (size <= 4) return { pages: 2, chars: 8000, total: 16000 };
    return { pages: 3, chars: 20000, total: 50000 };
  }
  async function gather(q, selectedModel, access) {
    const sources = [];
    const tasks = [];
    const hasAtt = (cur.att || []).length > 0;       // a file is attached: answer from it, skip the wider searches
    const filesBlocked = A.ai && A.ai.isCloud(selectedModel) && !A.ai.allowed('files');
    if (access.files && filesBlocked) cur._kept = 'Your files and notes were not searched, because Claude is answering (Settings › Privacy to allow it).';
    if (!hasAtt && access.files && !filesBlocked) tasks.push(A.api('/api/docs/search', { q, n: 5 }).then(r => (r.results || []).forEach(x => sources.push({ title: x.title, page: x.kind === 'doc' && x.page ? x.page : 0, text: String(x.text || x.snippet || '').slice(0, 1400), kind: x.kind, path: x.path, where: x.path }))).catch(() => {}));
    if (!hasAtt && access.libraries && A.caps.lib) tasks.push(A.api('/api/lib/context', { q, n: 4 }).then(r => (r.sources || []).forEach(x => sources.push({ title: x.title, text: x.text, kind: 'lib', url: x.url, where: x.book, category: x.category }))).catch(() => {}));
    /* the internet, when it is switched on and the 🌐 box is ticked: top pages read in full, next few as snippets */
    if (!hasAtt && access.web && A.net && A.net.on()) tasks.push(A.net.lookup(q, readBudget(selectedModel)).then(r => {
      const pages = r.pages || [], have = new Set(pages.map(p => p.url));
      pages.forEach(p => sources.push({ title: p.title, text: p.text, kind: 'web', url: p.url, where: 'the web (read just now' + (p.truncated ? ', page continued beyond what was read' : '') + ')' }));
      (r.results || []).slice(0, 6).forEach(x => { if (!have.has(x.url)) sources.push({ title: x.title, text: x.snippet || '', kind: 'web', url: x.url, where: 'web result (' + (x.source || 'web') + ')' }); });
    }).catch(() => {}));
    await Promise.all(tasks);
    (cur.att || []).filter(a => a.text).reverse().forEach(a => sources.unshift({ title: a.name, text: a.text.slice(0, 12000), kind: 'attach', where: 'attached file' }));
    return sources;
  }
  const INTERP = '\n\nYou have a code interpreter. When the question needs calculation, counting, dates, data from an attached file, a table or a chart, do not work it out in your head: write ONE short code block in Python (```python) that prints the result (pandas and numpy are available; attached files are in /data/; for a chart request print the data as a text table). Moundshroud runs it and sends you the output, then you give the final answer. For questions that need no calculation, just answer.';
  /* questions that need working out (the interpreter writes and runs code first), and requests for code itself (not run) */
  const COMPUTE = /\b(sum|total|average|mean|median|mode|calculate|compute|work out|how many|how much|percent(age)?|prime|factorial|square root|sqrt|cube|plot|chart|graph|histogram|statistic|standard deviation|variance|convert|days (between|until|since)|compound interest|interest rate|loan|mortgage|probability|odds|solve|equation|fibonacci|digits?|divisible|multiply|divided)\b|%|\d+\s*[-+*\/^x×÷]\s*\d+/i;
  const ASKCODE = /\b(write|show|give|explain|teach|example|generate|create|make|fix|debug|review)\b.{0,40}\b(code|script|function|program|class|snippet|regex)\b/i;
  const runOn = () => { const c = document.getElementById('runcode'); return !!(c && c.checked); };
  function systemPrompt(sources, voice, allowRun) {
    let s = 'You are MOUNDSHROUD, the assistant in Main Chat. Reply with text or code. You cannot take actions in the app or create or edit images. Use the supplied sources when relevant. Only report code execution when you receive sandbox output. Be clear, accurate and reasonably concise. Today is ' + new Date().toLocaleDateString([], { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' }) + '.';
    const LX = (typeof A !== 'undefined' && A.language) ? A.language : null;      // the app language (Settings › Voice & sound)
    if (LX && LX.get() !== 'en') s += '\n\nReply in ' + LX.name() + ', even when the question is written in English. Keep code, commands and identifiers as they are.';
    const persona = (ls.get('persona', '') || '').trim();      // the user's own personality setting (Settings › Personality) leads the prompt
    if (persona) s += '\n\nThe user has set how you should act and think. Follow this closely in your tone, style and behaviour, as long as it stays safe and honest:\n' + persona;
    if (sources.length) {
      s += '\n\nUse the numbered sources below when they help answer the question, and cite them like [1] or [2]. If they do not help, answer from your own knowledge and say that the sources did not cover it. Never invent a citation.\n';
      sources.forEach((x, i) => { s += '\n[' + (i + 1) + '] ' + x.title + (x.page ? ' (page ' + x.page + ')' : '') + ' - ' + (x.where || '') + '\n' + x.text + '\n'; });
      if (sources.some(x => x.category === 'Medical')) s += '\nThis involves medical information. Give the facts from the sources, and remind the user briefly that this is reference information, not a diagnosis, and to call emergency services for emergencies.';
    }
    if (sources.some(x => x.kind === 'doc' || x.kind === 'note' || x.kind === 'attach'))
      s += '\n\nSome sources are the user\'s own files, notes or downloaded reference libraries. Treat them as the authority: keep every specific detail (commands, flags, paths, numbers, names, versions) inside what they actually say, and name the file in the citation when an answer rests on one document, like [2 web/music/notes.md]. If they do not cover part of the question, say plainly what is missing and offer to search again - never fill the gap with a guess dressed up as fact.\n';
    if (allowRun) s += INTERP;
    if (sources.some(x => x.kind === 'web')) s += '\n\nSome sources were fetched from the internet a moment ago. Prefer them for anything that could have changed since your training, name the site in the citation (for example [1] Wikipedia), and if they disagree with what you already know, trust them and say so.';
    if (voice) s += '\n\nThe user is talking to you out loud and your answer will be read aloud. Reply in one to three short, natural spoken sentences. No lists, no markdown, no citations.';
    return s;
  }

  /* ---------- sending ---------- */
  let liveReply = null;      // the reply being written, for OpenWhip's cursor whip (A.chat.whip)
  function setBusy(b) { busy = b; $('go').textContent = b ? '■ Stop' : 'Send'; $('go').title = b ? 'Stop this reply (Esc)' : 'Send your message (Enter)'; $('go').classList.toggle('stop', b); }
  async function stream(body, signal, onTok) {
    const r = await fetch('/api/chat?surface=main', { method: 'POST', body: JSON.stringify(body), signal });
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
    if (textOverride == null) { inEl.value = ''; autosize(); }
    if (!cur.msgs.length) { msgsEl.innerHTML = ''; cur.title = text.slice(0, 48); updateHeader(); }
    const selectedModel = model();
    const access = { files: $('usefiles').checked, libraries: $('usewiki').checked, web: $('useweb').checked };
    const allowRun = !opts.voice && !!A.interp && runOn();
    const shouldRun = () => allowRun && runOn() && !ASKCODE.test(text);
    ctl = new AbortController();
    const { signal } = ctl;
    const um = { role: 'user', content: text }; cur.msgs.push(um); msgsEl.appendChild(render(um, cur.msgs.length - 1));
    const am = { role: 'assistant', content: '', thinking: '', sources: [] }; cur.msgs.push(am);
    const el = render(am, cur.msgs.length - 1); el.classList.add('pending'); msgsEl.appendChild(el); msgsEl.scrollTop = msgsEl.scrollHeight;      // .pending hides Copy, Redo and the rest until the reply is finished
    /* the clock starts now: the ⏱ button in the top bar shows it, and the reply keeps its own time */
    const t0 = Date.now(), op = A.act ? A.act.begin('Answering in Chat', { tab: 'chat', kind: 'chat', phase: 'thinking' }) : null;
    let tFirst = 0, curWait = 'Thinking…';
    setBusy(true); setStatus('thinking...', 'busy');
    let ok = true, stopped = false;
    const wait = label => { curWait = label; if (op) op.say(label.replace(/…$/, '')); const bd = el.querySelector('.bd'); if (bd && !am.content) bd.innerHTML = waitHtml(label); };
    /* the waiting words count the seconds, so you can see how long it has been thinking */
    const liveT = setInterval(() => {
      if (!busy) return;
      const s = fmtMs(Date.now() - t0);
      if (am.content) setStatus('writing… ' + s, 'busy');
      else { const bd = el.querySelector('.bd'); if (bd) bd.innerHTML = waitHtml(curWait + ' ' + s); }
    }, 500);
    wait('Thinking…');
    try {
      /* the code interpreter, code first: a question that needs working out gets a program written and run before the answer,
         because small models rarely choose to write code by themselves and guess numbers instead */
      let computed = '';
      if (shouldRun() && COMPUTE.test(text)) {
        const files = (cur.att || []).filter(a => a.text);
        const msgs = [{ role: 'system', content: 'You write Python. Write ONE short Python program that computes the answer to the user\'s question and prints the result with a short label. pandas and numpy are available' + (files.length ? '; the attached files are in /data/: ' + files.map(f => f.name).join(', ') : '') + '. For a chart request, print the data as a text table. Reply with only one ```python code block and nothing else.' }, { role: 'user', content: text }];
        for (let round = 0; round < 2 && shouldRun(); round++) {
          setStatus('writing code...', 'busy'); wait(round ? 'Fixing the code…' : 'Writing code to work it out…');
          let reply = '';
          await stream({ model: selectedModel, stream: true, think: false, keep_alive: '3m', options: { temperature: 0, num_predict: 700 }, messages: msgs }, signal,
            j => { if (typeof j.message?.content === 'string') reply += j.message.content; });
          const blk = A.interp.firstBlock(reply) || (/\bprint\s*\(/.test(reply) ? { lang: 'python', code: reply.replace(/```\w*/g, '') } : null); if (!blk || !shouldRun()) break;
          setStatus('running code...', 'busy'); wait('Running the code in the sandbox…');
          const r = await A.interp.run(blk.lang, blk.code, { files, collectFigures: false, isolated: true, signal });
          signal.throwIfAborted();
          const outText = A.interp.asText(r); (am.runs = am.runs || []).push({ lang: blk.lang, code: blk.code.slice(0, 8000), out: outText, ok: !!r.ok, ms: r.ms || 0 });
          const bd = el.querySelector('.bd'); if (bd) bd.insertAdjacentHTML('afterend', runsHtml({ runs: [am.runs[am.runs.length - 1]] }));
          if (r.ok) { computed = outText; break; }
          msgs.push({ role: 'assistant', content: reply }, { role: 'user', content: 'It failed with:\n' + outText + '\nFix it. Reply with only the corrected ```python code block.' });
        }
        wait('Writing the answer…');
      }
      const sources = computed ? [] : opts.sources || await gather(text, selectedModel, access);
      signal.throwIfAborted();
      am.sources = sources;
      if (sources.length) { const ch = el.querySelector('.chips'); if (!ch) el.insertAdjacentHTML('beforeend', srcChips(sources)); }
      const hist = cur.msgs.slice(0, -2).filter(m => !m.local).slice(-12).map(m => ({ role: m.role, content: m.content }));
      const showTh = $('showthink').checked, think = opts.voice ? false : (showTh || $('think').checked);      /* Show thinking also asks the model to think: nothing can be shown otherwise */
      const body = { model: selectedModel, stream: true, keep_alive: (A.power && A.power.on ? '1m' : '3m'), think, messages: [{ role: 'system', content: systemPrompt(sources, opts.voice, shouldRun()) }, ...hist, Object.assign({ role: 'user', content: text }, (cur.att || []).some(a => a.image) ? { images: cur.att.filter(a => a.image).map(a => a.image) } : {})] };
      if (computed) body.messages[0].content += '\n\nThe code interpreter worked this out. Use its output for your answer:\n```\n' + computed + '\n```';
      setStatus('thinking...', 'busy'); wait('Thinking…');
      const onTok = j => {
        const mm = j.message || {};
        if (typeof mm.thinking === 'string') am.thinking += mm.thinking;
        if (typeof mm.content === 'string') am.content += mm.content;
        if (!tFirst && (mm.content || mm.thinking)) tFirst = Date.now();      // how long it thought before the first word
        setStatus(am.content ? 'writing...' : 'thinking...', 'busy');
        if (!paintT) paintT = setTimeout(paint, 60);      // repaint at most ~16 times a second: re-parsing the whole reply on every token made long answers lag and run hot
      };
      /* OpenWhip: a crack on this reply while it is thinking stops the thinking and makes it answer at once; a crack while it
         is writing keeps every word so far and has the model carry on from there in Turbo (no thinking, no padding).
         Each reply takes at most 3 cracks, because each one re-sends the conversation. */
      const baseMsgs = body.messages.slice();
      let sc = null, cracks = 0;
      const runStream = async () => {
        for (;;) {
          sc = new AbortController();
          const stop = () => sc.abort();
          signal.addEventListener('abort', stop, { once: true });
          const live = sc;
          let join = !!am.content;      // after a crack the model often starts its carry-on with "..."; the seam drops it
          try {
            await stream(body, sc.signal, j => {
              live.got = true;
              if (join && j.message && typeof j.message.content === 'string' && j.message.content.trim()) {
                j.message.content = j.message.content.replace(/^\s*(\.\.\.|…)\s*/, /\s$/.test(am.content) ? '' : ' ').replace(/^ /, /\s$/.test(am.content) ? '' : ' ');
                join = false;
              }
              onTok(j);
            });
            return;
          }
          catch (e) { if (!(e.name === 'AbortError' && sc.whipped && !signal.aborted)) throw e; }
          finally { signal.removeEventListener('abort', stop); }
          body.think = false;
          const turbo = (A.openwhip && A.openwhip.turboDirective) || 'Answer as fast and directly as possible.';
          body.messages = baseMsgs.map((m, i) => i === 0 ? { role: 'system', content: m.content + '\n\n' + turbo } : m);
          if (am.content) body.messages.push({ role: 'assistant', content: am.content },
            { role: 'user', content: 'FASTER. Continue exactly where you stopped, mid-sentence if needed. Do not repeat anything already written. Keep the rest short.' });
          setStatus(am.content ? 'writing faster...' : 'answering now...', 'busy');
        }
      };
      liveReply = {
        el,
        whip: () => {
          // a crack lands only once the model has sent words since the last one; a swing cracks several times in a row
          if (!sc || sc.whipped || cracks >= 3 || (!am.content && !am.thinking) || (cracks && !sc.got)) return false;
          cracks++; sc.whipped = true; sc.abort();
          return am.content ? 'writing' : 'thinking';
        }
      };
      let paintT = 0;
      const paint = () => {
        paintT = 0;
        const bd = el.querySelector('.bd'); if (bd) bd.innerHTML = am.content ? md(am.content) : waitHtml('Thinking…');
        if (am.thinking && !el.querySelector('details')) el.insertAdjacentHTML('afterbegin', '<details' + (showTh ? ' open' : '') + '><summary>Thinking</summary><div></div></details>');
        const dv = el.querySelector('details div'); if (dv) dv.textContent = am.thinking;
        if (msgsEl.scrollHeight - msgsEl.scrollTop - msgsEl.clientHeight < 140) msgsEl.scrollTop = msgsEl.scrollHeight;
      };
      try { await runStream(); }
      catch (e) {
        if (e.name === 'AbortError' || am.content || !/think/i.test(e.message)) throw e;
        delete body.think;
        if (showTh) A.toast(selectedModel.replace(/:latest$/, '') + ' cannot show its thinking. It answers without it.', 4500);
        await runStream();
      } finally {
        clearTimeout(paintT); paint(); liveReply = null;
      }
      /* Run only sandbox code the user enabled for this reply. */
      if (shouldRun() && !computed) {
        for (let round = 0; round < 2 && shouldRun(); round++) {
          const blk = A.interp.firstBlock(round ? am.content.slice(am._ranTo || 0) : am.content); if (!blk || !shouldRun()) break;
          setStatus('running code...', 'busy'); wait('Running the code…');
          const r = await A.interp.run(blk.lang, blk.code, { files: (cur.att || []).filter(a => a.text), collectFigures: false, isolated: true, signal });
          signal.throwIfAborted();
          const outText = A.interp.asText(r);
          (am.runs = am.runs || []).push({ lang: blk.lang, code: blk.code.slice(0, 8000), out: outText, ok: !!r.ok, ms: r.ms || 0 });
          am._ranTo = am.content.length; paint();
          const follow = { ...body, messages: body.messages.concat([{ role: 'assistant', content: am.content }, { role: 'user', content: 'The code ran in the sandbox. Its output:\n```\n' + outText + '\n```\n' + (r.ok ? 'Now give the final answer to my question using this output. Do not repeat the code.' : 'It failed. Write a fixed version in one code block, or answer without code if you cannot fix it.') }]) };
          setStatus('thinking...', 'busy');
          am.content += '\n\n'; const base = am.content;
          let more = '';
          try {
            await stream(follow, signal, j => {
              if (typeof j.message?.content !== 'string') return;
              more += j.message.content;
              am.content = base + more;
              if (!paintT) paintT = setTimeout(paint, 60);
            });
          } finally {
            clearTimeout(paintT); paint();
          }
          if (r.ok) break;
        }
        delete am._ranTo;
      }
      if (!am.content.trim()) am.content = 'The model returned no text. Try again or choose another chat model.';
    } catch (e) {
      ok = false;
      if (e.name === 'AbortError') { stopped = true; am.content = (am.content ? am.content.trimEnd() + '\n\n' : '') + '*(stopped)*'; }
      else { am.err = true; am.content = (am.content ? am.content + '\n\n' : '') + '**Something went wrong:** ' + e.message + '\n\nIf the model is still loading, wait a few seconds and press Try again.'; }
    }
    if (cur._kept) { am.content = (am.content || '').trim() + '\n\n_🔒 ' + cur._kept + '_'; delete cur._kept; }
    setBusy(false); ctl = null; clearInterval(liveT);
    am.ms = Date.now() - t0; if (tFirst) am.thinkMs = tFirst - t0;
    if (op) op.end(ok, stopped ? 'stopped' : fmtMs(am.ms));
    if (am.ms) lastTime(am);
    if (ok) setStatus('ready'); else if (stopped) setStatus('stopped'); else setStatus('that did not work - press Try again', 'err');
    el.classList.remove('pending'); fill(el, am); cur.updated = Date.now(); persist(); msgsEl.scrollTop = msgsEl.scrollHeight;
  }

  /* ---------- message actions ---------- */
  msgsEl.addEventListener('click', async e => {
    const rb = e.target.closest('.runbtn');
    if (rb) {
      if (!runOn()) return;
      const pre = rb.closest('pre'), code = pre.querySelector('code').textContent; rb.disabled = true; rb.textContent = '⏳ Running…';
      const r = await A.interp.run(pre.dataset.lang, code, { files: (cur.att || []).filter(a => a.text), collectFigures: false, isolated: true });
      let box = pre.nextElementSibling; if (!box || !box.classList.contains('runlive')) { box = document.createElement('div'); box.className = 'runlive'; pre.after(box); }
      box.innerHTML = '<pre class="runout">' + esc(A.interp.asText(r)) + '</pre>';
      rb.disabled = false; rb.textContent = r.ok ? '▶ Run again' : '▶ Run (failed)'; return;
    }
    const cp = e.target.closest('.cp'); if (cp) { A.copy(cp.parentElement.querySelector('code').textContent); return; }
    const sc = e.target.closest('.src');
    const mEl = e.target.closest('.m'); if (!mEl) return;
    const i = +mEl.dataset.i, m = cur.msgs[i]; if (!m) return;
    if (sc) { const s = (m.sources || [])[+sc.dataset.i]; if (!s) return; if (s.kind === 'web' || (s.kind === 'news' && s.url)) A.net.open(s); else if (s.kind === 'lib') A.lib.openUrl(s.url, s.title); else if (s.kind === 'note') { A.showTab('notes'); A.notes.openByPath(s.path); } else if (s.kind === 'attach') A.toast('Attached to this chat'); else A.viewer.open(s, ((cur.msgs[i - 1] || {}).content) || ''); return; }
    const t = e.target.closest('[data-t]'); if (!t) return;
    switch (t.dataset.t) {
      case 'copy': A.copy(m.content); break;
      case 'listen': A.speech.speak(m.content, t); break;
      case 'redo': { if (busy) return; const prev = cur.msgs[i - 1]; if (!prev) return; cur.msgs.splice(i - 1, 2); renderAll(); send(prev.content, { noLocal: true }); break; }
      case 'edit': { if (busy) return; inEl.value = m.content; cur.msgs.splice(i); renderAll(); inEl.focus(); autosize(); break; }
      case 'note': A.notes.create(((cur.msgs[i - 1] || {}).content || 'From chat').slice(0, 50), m.content); break;
      case 'cards': A.study.fromText(m.content); break;
      case 'imgopen': if (m.img) window.open(m.img.url, '_blank'); break;
      case 'imgsave': if (m.img) { const a = document.createElement('a'); a.href = m.img.url; a.download = String(m.img.subject || 'picture').replace(/[^\w ]+/g, '').trim().slice(0, 40).replace(/\s+/g, '-') + '.png'; a.click(); } break;
    }
  });

  /* ---------- selection card (text from hotkeys) ---------- */
  A.chat = {
    ask(text, opts) { return send(text, opts); },
    /* OpenWhip's cursor whip: the reply being written (what a crack must hit), and the crack itself.
       whip() returns 'thinking' or 'writing' when it sped the reply up, false when there is nothing to speed up */
    whipTarget: () => (liveReply && liveReply.el) || null,
    whip: () => (liveReply ? liveReply.whip() : false),
    busy: () => busy,
    stop() { if (busy && ctl) ctl.abort(); },      // Esc on the Chat page (main.js A.escape) and the Stop button both end the reply here
    newChat() { if (busy && ctl) ctl.abort(); cur = newChat(); chats.unshift(cur); renderAll(); A.showTab('chat'); inEl.focus(); },
    load(id) { const c = chats.find(x => x.id === id); if (!c) return; cur = c; renderAll(); A.showTab('chat'); const cx = $('chatx'); if (cx) cx.classList.remove('sideopen'); },
    history() { return chats.filter(c => c.msgs.length); },
    remove(id) { chats = chats.filter(c => c.id !== id); if (cur.id === id) { cur = newChat(); chats.unshift(cur); renderAll(); } else { renderSidebar(); } persist(); },
    togglePin: togglePinChat,
    rename: renameChat,
    exportMd: exportChatMd,
    confirmRemove: confirmRemoveChat,
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
    let box = $('attach'); if (!box) { box = document.createElement('div'); box.id = 'attach'; box.className = 'attach'; $('row').parentNode.insertBefore(box, $('row')); }
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
  inEl.addEventListener('input', autosize);
  $('runcode').addEventListener('change', () => {
    if (!busy) renderAll();
  });
  inEl.addEventListener('keydown', e => { if (e.key === 'Enter' && !e.shiftKey && !e.isComposing) { e.preventDefault(); send(); } });
  $('go').onclick = () => send();
  $('go').title = 'Send your message (Enter)'; $('mic').setAttribute('aria-label', 'Speak your message'); clip.setAttribute('aria-label', 'Attach a file');
  /* the message box reports its height, so the jump button and notifications sit just above it and never on top of it */
  const comp = inEl.closest('.composer');
  if (comp && window.ResizeObserver) new ResizeObserver(() => { const h = comp.offsetHeight; if (h > 0) document.documentElement.style.setProperty('--composer-h', h + 'px'); }).observe(comp);
  /* after scrolling up in a long chat, one button returns to the newest message */
  const toLatest = document.createElement('button'); toLatest.id = 'tolatest'; toLatest.type = 'button'; toLatest.textContent = '↓ Newest message'; toLatest.title = 'Jump to the newest message';
  ($('chmain') || chatPanel).appendChild(toLatest);
  const farUp = () => toLatest.classList.toggle('on', !!cur && cur.msgs.length > 0 && msgsEl.scrollHeight - msgsEl.scrollTop - msgsEl.clientHeight > 260);
  msgsEl.addEventListener('scroll', farUp, { passive: true });
  toLatest.onclick = () => { msgsEl.scrollTo({ top: msgsEl.scrollHeight, behavior: 'smooth' }); inEl.focus(); };
  /* what the tick boxes under the message box do, in plain words */
  const mh = $('methelp');
  if (mh) {
    mh.dataset.pop = '1';
    mh.onclick = function () {
      const row = (id, name, text) => { const lab = $(id); return lab && lab.style.display !== 'none' ? '<div><b>' + name + '</b><br>' + text + '</div>' : ''; };
      A.pop(this, '<div class="opthelp"><div class="grp" style="margin-top:0">What these boxes do</div>' +
        '<div><b>Think harder</b><br>The assistant reasons step by step before it answers. Slower, and better on hard questions.</div>' +
        '<div><b>Show thinking</b><br>Watch the reasoning appear while the assistant works. It folds under the answer afterwards. It also turns thinking on, so replies are slower. A model that cannot think just answers.</div>' +
        row('runcodel', 'Run code', 'Runs Python or JavaScript in the sandbox and shares the text output with the assistant.') +
        row('uwl', 'Use libraries', 'Looks the question up in your offline libraries first and shows where each fact came from.') +
        row('ufl', 'Use my files', 'Searches your own notes and files first. They never leave this PC.') +
        row('uwb', '🌐 Web', 'Searches the internet for this question and names the sites it used.') +
        '<div class="mute small">Enter sends. Shift+Enter starts a new line. Esc stops a reply.</div></div>');
    };
  }
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
  async function loadModels(tries = 0, fromSettings = false) {
    if (!fromSettings) $('status').textContent = tries ? 'starting the AI engine...' : 'connecting...';
    try {
      const r = await A.api('/api/models');
      const catalog = A.anyModel && await A.anyModel.list().catch(() => null);
      const excluded = new Set((catalog?.models || []).filter(m => m.ollama && m.use !== 'talk').map(m => m.ollama));
      const chatModels = r.models.filter(m => !excluded.has(m.name) && !/^any:/i.test(m.name));
      if (!chatModels.length) { if (tries < 8) { setTimeout(() => loadModels(tries + 1), 2500); return; } $('model').innerHTML = '<option>(no model)</option>'; $('status').textContent = 'AI engine not available'; return; }
      const def = A.modelOrder ? A.modelOrder.sync(r.defaultModel) : '';
      const list = A.modelOrder ? A.modelOrder.sort(chatModels, def) : chatModels;
      const saved = ls.get('model', ''), pref = list.map(m => m.name);
      /* each model shows its size (ordered largest-first, or with the Settings default pinned first), and Agent copies sit in their own group */
      /* what this model will do on this PC: the server reports its memory, so a model is marked before it is chosen */
      const hw = r.hardware || {};
      const fit = m => {
        if (m.cloud || !m.size) return '';
        const gb = m.size / 1073741824;
        if (hw.vramGB && gb <= hw.vramGB * .92) return ' · ⚡ fast';
        if (hw.ramGB && gb <= hw.ramGB * .7) return ' · 🐢 in RAM';
        return ' · ⚠ too big';
      };
      const opt = m => '<option value="' + esc(m.name) + '">' + esc(A.modelOrder ? A.modelOrder.label(m, { defaultModel: def }) : (m.cloud ? (m.label || m.name) : m.name.replace(/:latest$/, '') + (m.size ? ' · ' + (m.size / 1073741824).toFixed(1) + ' GB' : ''))) + fit(m) + '</option>';
      const isCopy = m => !m.cloud && /-agent(-\d+k)?(:|$)/i.test(m.name), main = list.filter(m => !isCopy(m)), copies = list.filter(isCopy);
      $('model').innerHTML = copies.length ? '<optgroup label="Models">' + main.map(opt).join('') + '</optgroup><optgroup label="Agent tab copies (same models, larger memory)">' + copies.map(opt).join('') + '</optgroup>' : main.map(opt).join('');
      $('model').title = 'The AI model that answers in Chat. Models are ordered largest first unless you choose a default in Settings.' + (hw.vramGB ? ' ⚡ fast = fits in the graphics memory (' + hw.vramGB + ' GB), 🐢 in RAM = works but slower, ⚠ too big = more memory than this PC has.' : ' 🐢 in RAM = works but slower, ⚠ too big = more memory than this PC has.');
      const defHit = def && list.find(m => A.modelOrder && A.modelOrder.matches(m, def));
      const biggestLocal = main.find(m => !m.cloud) || list.find(m => !m.cloud);
      const pick = defHit ? defHit.name : ((!fromSettings && pref.includes(saved)) ? saved : ((biggestLocal && biggestLocal.name) || pref[0]));
      $('model').value = pick;
      if (fromSettings && pick) ls.set('model', pick);
      $('status').textContent = 'ready'; warm(); cloudBanner();
    } catch (e) { if (tries < 8) setTimeout(() => loadModels(tries + 1), 2500); }
  }
  const warm = () => { if (model() && model() !== '(no model)') A.api('/api/warm', { model: model() }); };
  $('model').onchange = () => { ls.set('model', model()); warm(); cloudBanner(); };
  A.chat.loadModels = loadModels;
  if (A.on) A.on('default-model', () => loadModels(0, true));
  /* while Claude answers, say so plainly, every time */
  function cloudBanner() {
    let b = document.getElementById('clban'); const on = A.ai && A.ai.isCloud(model());
    if (!on) { if (b) b.remove(); return; }
    if (!b) { b = document.createElement('div'); b.id = 'clban'; b.className = 'small'; b.style.cssText = 'margin:4px 12px;padding:6px 10px;border-radius:8px;border:1px solid var(--warn);line-height:1.45'; const box = inEl.closest('.row') || inEl.parentElement; box.parentElement.insertBefore(b, box); }
    b.innerHTML = '☁ <b>Claude (Anthropic) is answering.</b> What you type and anything you attach goes to Anthropic. ' +
      (A.ai.allowed('files') ? 'File search results can also be shared when Use my files is checked.' : 'Your saved files and notes stay on this PC.') +
      ' <a href="#" data-pv>Privacy</a> · pick a local model above to stay offline.';
    b.querySelector('[data-pv]').onclick = e => { e.preventDefault(); A.settings && A.settings.open('privacy'); };
  }
  setTimeout(cloudBanner, 1500); A.on && A.on('privacy', cloudBanner);
  /* the internet box: only offered when Settings has internet access switched on (A.net hides it otherwise) */
  $('useweb').checked = ls.get('useweb', '0') === '1'; $('useweb').onchange = () => ls.set('useweb', $('useweb').checked ? '1' : '0');
  $('newc').onclick = () => A.chat.newChat();
  /* sidebar controls */
  const chx = $('chatx'), chlist = $('chlist'), chsq = $('chsq');
  if ($('chnew')) $('chnew').onclick = () => { A.chat.newChat(); if (chx) chx.classList.remove('sideopen'); };
  if (chsq) { chsq.oninput = renderSidebar; chsq.onkeydown = e => e.stopPropagation(); }
  if (chlist) {
    chlist.onclick = e => {
      const act = e.target.closest('[data-ca]');
      const row = e.target.closest('.chrow[data-id]');
      if (!row) return;
      const cid = row.dataset.id;
      if (act) {
        e.stopPropagation();
        if (act.dataset.ca === 'pin') togglePinChat(cid);
        else if (act.dataset.ca === 'ren') renameChat(cid);
        else if (act.dataset.ca === 'del') { A.chat.remove(cid); A.toast('Chat deleted'); }
        return;
      }
      A.chat.load(cid);
    };
  }
  if ($('chpin')) $('chpin').onclick = () => cur && cur.msgs.length && togglePinChat(cur.id);
  if ($('chren')) $('chren').onclick = () => cur && cur.msgs.length && renameChat(cur.id);
  if ($('chtitle')) $('chtitle').onclick = () => cur && cur.msgs.length && renameChat(cur.id);
  if ($('chexp')) $('chexp').onclick = () => cur && cur.msgs.length && exportChatMd(cur.id);
  if ($('chdel')) $('chdel').onclick = () => cur && cur.msgs.length && confirmRemoveChat(cur.id);
  if ($('chclr')) $('chclr').onclick = async () => {
    const n = chats.filter(c => c.msgs.length).length;
    if (!n) return;
    if (!(await A.confirm('Delete all ' + n + ' saved chats? This cannot be undone.', { title: 'Clear all chats', okLabel: 'Delete all', danger: true }))) return;
    chats = [];
    cur = newChat();
    chats.unshift(cur);
    await A.api('/api/chats', []).catch(() => {});
    renderAll();
    A.toast('All chats deleted');
  };
  if (chx) {
    const isNarrow = () => chx.clientWidth < 780;
    chx.classList.add('sidehide'); // start collapsed by default when opening the app
    if ($('chtog')) $('chtog').onclick = () => {
      if (isNarrow()) chx.classList.toggle('sideopen');
      else chx.classList.toggle('sidehide');
    };
    if (typeof ResizeObserver !== 'undefined') {
      new ResizeObserver(() => chx.classList.toggle('narrow', isNarrow())).observe(chx);
    }
    chx.classList.toggle('narrow', isNarrow());
  }
  $('think').checked = ls.get('think', '0') === '1'; $('think').onchange = () => ls.set('think', $('think').checked ? '1' : '0');
  $('showthink').checked = ls.get('showthink', '0') === '1'; $('showthink').onchange = () => ls.set('showthink', $('showthink').checked ? '1' : '0');
  A.chat.warm = warm;

  A.registerTab('chat', 'Chat', () => inEl.focus());
  A.ready.push(async () => {
    try { chats = await A.api('/api/chats'); if (!Array.isArray(chats)) chats = []; } catch (e) { chats = []; }
    chats = chats.map(c => ({ id: c.id, title: c.title || 'Chat', updated: c.updated || 0, pinned: !!c.pinned, msgs: (c.messages || c.msgs || []).map(m => ({ role: m.role, content: m.content || m.display || '', thinking: m.thinking || '', local: m.local, img: m.img, made: m.made, runs: m.runs, ms: m.ms, thinkMs: m.thinkMs, sources: m.sources || [] })) }));
    cur = newChat(); chats.unshift(cur); renderAll(); loadModels();
    /* the last reply's time is still on screen after a reload */
    const prev = chats.map(c => (c.msgs || []).filter(m => m.role === 'assistant' && m.ms).pop()).filter(Boolean).pop(); if (prev) lastTime(prev);
  });
})();




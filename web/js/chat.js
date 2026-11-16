// Chat: streaming answers from the local model, grounded in your files and the offline libraries.
(() => {
  let chats = [], cur = null, busy = false, ctl = null, saveT = null;
  const msgsEl = $('msgs'), inEl = $('in');
  const newChat = () => ({ id: Date.now().toString(36), title: 'New chat', msgs: [], updated: Date.now() });
  const persist = () => { clearTimeout(saveT); saveT = setTimeout(() => { fetch('/api/chats', { method: 'POST', body: JSON.stringify(chats.filter(c => c.msgs.length).map(c => ({ id: c.id, title: c.title, updated: c.updated, messages: c.msgs.map(m => ({ role: m.role, content: m.content, thinking: m.thinking, local: m.local, img: m.img, runs: m.runs, sources: (m.sources || []).map(s => ({ title: s.title, page: s.page, kind: s.kind, path: s.path, url: s.url, where: s.where, text: s.kind === 'attach' ? '' : (s.text || '').slice(0, 700) })) })) }))) }).catch(() => {}); }, 600); };
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
    d.innerHTML = (m.thinking ? '<details><summary>Thinking</summary><div>' + esc(m.thinking) + '</div></details>' : '') + '<div class="bd">' + (m.content ? md(m.content) : waitHtml('Thinking…')) + '</div>' + runsHtml(m) + imgHtml(m) + srcChips(m.sources) +
      (m.err ? '<div class="errbar"><button class="ib" data-t="redo">↻ Try again</button><span class="small mute">Nothing was lost. Your question is still above.</span></div>' : '') + (m.local ? '' : toolsHtml('assistant'));
    /* ▶ Run on every Python and JavaScript block: it runs in the sealed-off sandbox and the output shows under it */
    if (window.A && A.interp) d.querySelectorAll('.bd pre[data-lang]').forEach(p => { if (A.interp.LANG(p.dataset.lang)) p.insertAdjacentHTML('afterbegin', '<button class="cp runbtn" title="Run this code in the sealed-off sandbox on this PC">▶ Run</button>'); });
  }
  /* what the code interpreter ran, what it printed, and its charts */
  function runsHtml(m) {
    if (!m.runs || !m.runs.length) return '';
    return m.runs.map(r => '<details class="runbox"' + (r.figs && r.figs.length ? ' open' : '') + '><summary><span class="' + (r.ok ? 'ok' : 'bad') + '">●</span> Ran ' + (r.lang === 'python' ? 'Python' : 'JavaScript') + ' in the sandbox · ' + ((r.ms || 0) / 1000).toFixed(1) + ' s' + (r.ok ? '' : ' · failed') + '</summary><pre class="runcode">' + esc(r.code) + '</pre><pre class="runout">' + esc(r.out) + '</pre></details>' + (r.figs || []).filter(u => /^\/api\/art\/file\?id=[a-z0-9-]+$/.test(u)).map(u => '<img class="runfig" src="' + esc(u) + '" alt="chart">').join('')).join('');
  }
  /* a picture the chat made or edited (kept in data\art, shown from /api/art/file) */
  function imgHtml(m) {
    if (!m.img || !/^\/api\/art\/file\?id=[a-z0-9-]+$/.test(String(m.img.url || ''))) return '';
    return '<div class="chatimg"><img src="' + esc(m.img.url) + '" alt="' + esc(m.img.subject || 'picture') + '" data-t="imgopen"><div class="row"><button class="ib" data-t="imgsave">💾 Save</button><button class="ib" data-t="imgmore">🎲 Another version</button><button class="ib" data-t="imgedit">🪄 Edit it</button></div></div>';
  }

  /* "make me an image of…", "draw a…", "/imagine …": the picture is drawn on this PC and sent back in the chat.
     With a photo attached, "make it…", "turn…", "remove…" edits that photo instead. */
  const IMG_RX = /^\s*(?:hey\s+|ok(?:ay)?\s+)?(?:please\s+)?(?:can|could|would|will)?\s*(?:you\s+)?(?:please\s+)?(?:make|create|draw|generate|paint|render|design|sketch|produce|give)\s+(?:me\s+|us\s+)?(?:an?\s+|another\s+|one\s+|some\s+|a few\s+)?(?:(?:highly|very|really|super|ultra)\s+)?(?:(?:detailed|realistic|photorealistic|quick|simple|beautiful|cool|cute|epic|high[- ]quality|hd|4k|8k)\s+)*(?:image|picture|pic|photo|drawing|painting|illustration|artwork|art|wallpaper|portrait|logo|render|icon)s?\b[\s,:]*(?:of|showing|with|for|about|that shows|where)?\s*(.*?)[\s.!?]*$/i;
  const DRAW_RX = /^\s*(?:please\s+)?(?:\/imagine|\/image|\/draw|draw)\s+(?:me\s+)?(.+?)[\s.!?]*$/i;
  const IMG_RX2 = /^\s*(?:please\s+)?(?:i(?:'d| would)?\s+(?:like|want|need)|i\s+want|give\s+me|show\s+me|can\s+i\s+(?:have|get|see))\s+(?:an?\s+|some\s+)?(?:(?:highly\s+)?(?:detailed|realistic|cool|beautiful)\s+)*(?:image|picture|pic|drawing|painting|illustration|wallpaper|portrait|logo|artwork)s?\s+(?:of|showing|with|for)\s+(?!my\b|me\b)(.+?)[\s.!?]*$/i;
  const IMG_RX3 = /^\s*(?:an?\s+)?(?:image|picture|drawing|painting|illustration)\s+of\s+(.+?)[\s.!?]*$/i;
  const EDIT_RX = /^\s*(?:please\s+)?(?:can you\s+|could you\s+)?(?:edit|change|make|turn|remove|add|replace|put|give|recolou?r|transform|convert|swap|erase|delete)\b/i;
  function pictureRequest(text) {
    const photo = (cur.att || []).find(a => a.image);
    if (photo && EDIT_RX.test(text) && !/\b(what|why|how|who|describe|explain|tell me|summar)/i.test(text)) return { kind: 'edit', subject: text.trim(), photo };
    let m = IMG_RX.exec(text) || DRAW_RX.exec(text) || IMG_RX2.exec(text) || IMG_RX3.exec(text);
    if (!m || /\b(how (do|can|to)|tutorial|steps|explain)\b/i.test(text)) return null;
    return { kind: 'make', subject: (m[1] || '').trim(), detailed: /\b(detailed|realistic|photorealistic|high[- ]quality|hd|4k|8k|best|optimal)\b/i.test(text), shape: /\b(wallpaper|landscape|wide|banner|desktop)\b/i.test(text) ? [768, 512] : /\b(portrait|phone|tall|poster)\b/i.test(text) ? [512, 768] : [512, 512] };
  }
  async function makePicture(req, text) {
    local('user', text); const am = local('assistant', ''); const el = msgsEl.lastElementChild;
    return pictureInto(am, el, req);
  }
  /* draws (or edits) into an assistant message that is already on screen: used by the words above and by the AI's make_image tool */
  async function pictureInto(am, el, req) {
    am.local = true; el.classList.remove('pending');
    const upd = t => { am.content = t; fill(el, am); if (msgsEl.scrollHeight - msgsEl.scrollTop - msgsEl.clientHeight < 200) msgsEl.scrollTop = msgsEl.scrollHeight; };
    if (req.kind === 'make' && !req.subject) { upd('What should the picture show? For example: *make me an image of a lighthouse in a storm at night*.'); cur.updated = Date.now(); persist(); return; }
    if (!window.AIArt) { upd('⚠️ The picture tools are not loaded.'); return; }
    setBusy(true); ctl = new AbortController(); setStatus('making a picture...', 'busy');
    let tick = 0;
    try {
      const st = await AIArt.status(true);
      if (req.kind === 'make' && !st.sd) throw new Error('The picture model is not installed on this PC. Run install-art-model.ps1, or use Studio › AI art (Qwen can draw simple vector pictures).');
      let prompt = req.subject, neg = '', opt = false;
      const engine = req.kind === 'edit' ? (st.edit ? 'kontext' : 'sd') : 'sd';
      if (A.promptOpt && (req.kind === 'edit' || ls.get('po_auto_image', '1') !== '0')) {
        upd(req.kind === 'edit' ? '🪄 Looking at your photo and working out the edit…' : '🎨 Writing a detailed prompt for the picture model…');
        const r = await A.promptOpt.optimize(req.kind === 'edit' ? (engine === 'kontext' ? 'photo' : 'redraw') : 'image', req.subject, req.kind === 'edit' ? { image: req.photo.image } : {});
        if (ctl.signal.aborted) throw Object.assign(new Error('stopped'), { name: 'AbortError' });
        prompt = r.prompt; neg = r.neg || ''; opt = !r.fallback;
      }
      const t0 = Date.now(), label = req.kind === 'edit' ? (engine === 'kontext' ? '🪄 Editing your photo (usually 2 to 5 minutes)… ' : '🎨 Redrawing your photo… ') : '🎨 Drawing your picture… ';
      upd(label + '0s'); tick = setInterval(() => upd(label + Math.round((Date.now() - t0) / 1000) + 's'), 1000);
      const r = req.kind === 'edit'
        ? await AIArt.edit(req.photo.image, prompt, { engine, strength: .6, neg, signal: ctl.signal })
        : await AIArt.image(prompt, { neg, w: req.shape[0], h: req.shape[1], steps: req.detailed ? 4 : 2, signal: ctl.signal });
      clearInterval(tick);
      const kept = await AIArt.keep(r.blob);
      am.img = { url: kept.url, subject: req.subject, prompt, neg, kind: req.kind, engine, seed: r.seed };
      if (req.kind === 'edit') { cur.att = (cur.att || []).filter(a => a !== req.photo); drawAtt(); }
      upd((req.kind === 'edit' ? 'Here is your edited photo' : 'Here is your picture') + ' (' + Math.round((Date.now() - t0) / 1000) + 's).' + (opt ? '\n\n*Prompt used:* ' + prompt + (neg ? '\n\n*Avoiding:* ' + neg : '') : ''));
      try { AIArt.gal.add({ id: Date.now(), at: Date.now(), prompt: (req.kind === 'edit' ? '✏️ ' : '') + req.subject, seed: r.seed, blob: r.blob }); } catch (e) { }
      setStatus('ready');
    } catch (e) {
      clearInterval(tick);
      if (e.name === 'AbortError') { upd('*(stopped)*'); setStatus('stopped'); }
      else { upd('⚠️ ' + (e.message || 'The picture could not be made.')); setStatus('that did not work', 'err'); }
    }
    setBusy(false); ctl = null; cur.updated = Date.now(); persist();
  }

  /* the waiting dot with words beside it, so a reply that has not started yet says what is happening */
  function waitHtml(label) { return '<span class="dots"></span><span class="stl">' + esc(label) + '</span>'; }
  function setStatus(t, k) { const s = $('status'); s.textContent = t; if (k) s.dataset.k = k; else delete s.dataset.k; }
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

  /* ---------- news from the News tab ---------- */
  const NEWSQ = /\b(news|headlines?|current events|breaking|latest on|update on|happening|going on|this week'?s|today'?s (?:stories|events)|in the world)\b/i;
  const NEWS_STOP = new Set('a an the and or of on in at to for about is are was were be been what whats what\'s any anything latest news headline headlines today todays today\'s this week weeks week\'s current events breaking update updates happening going there tell me give show summarize summarise recent new world me my please can you do know the about with from by it its how why who where when which'.split(' '));
  async function newsSources(q) {
    const words = q.toLowerCase().replace(/[^a-z0-9' ]+/g, ' ').split(/\s+/).filter(w => w.length > 2 && !NEWS_STOP.has(w));
    const snap = await A.api('/api/news'); const names = Object.fromEntries((snap.sources || []).map(s => [s.id, s.name]));
    const day = t => new Date(t).toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric' });
    let items = [];
    if (words.length) {
      let r = await A.api('/api/news/search?q=' + encodeURIComponent(words.join(' ')));
      if (!(r.items || []).length && words.length > 1) r = await A.api('/api/news/search?q=' + encodeURIComponent(words.slice().sort((a, b) => b.length - a.length)[0]));
      items = (r.items || []).slice(0, 6).map(a => ({ title: a.title, text: ((a.desc || '').slice(0, 500) + ' (' + (names[a.src] || a.src) + ', ' + day(a.date) + ')').trim(), kind: 'news', url: a.link, where: 'News tab, ' + (names[a.src] || a.src) }));
    }
    if (!items.length) items = (snap.events || []).slice(0, 8).map(e => ({ title: e.title, text: ((e.summary || '').slice(0, 450) + ' (' + (e.articles || []).length + ' reports, latest ' + day(e.last) + ')').trim(), kind: 'news', url: ((e.articles || [])[0] || {}).link, where: 'News tab top stories' }));
    if (items.length && snap.at) items[0].text += ' [News last refreshed ' + new Date(snap.at).toLocaleString([], { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }) + ']';
    return items;
  }

  /* ---------- context from files + libraries ---------- */
  async function gather(q) {
    const sources = [];
    const tasks = [];
    const hasAtt = (cur.att || []).length > 0;       // a file is attached: answer from it, skip the wider searches
    const toClaude = A.ai && A.ai.isCloud(model());
    if (toClaude && $('usefiles').checked && !A.ai.allowed('files')) cur._kept = 'Your files and notes were not searched, because Claude is answering (Settings › Privacy to allow it).';
    if (!hasAtt && $('usefiles').checked && !(toClaude && !A.ai.allowed('files'))) tasks.push(A.api('/api/docs/search', { q, n: 5 }).then(r => (r.results || []).forEach(x => sources.push({ title: x.title, page: x.kind === 'doc' && x.page ? x.page : 0, text: String(x.text || x.snippet || '').slice(0, 1400), kind: x.kind, path: x.path, where: x.path }))).catch(() => {}));
    if (!hasAtt && $('usewiki').checked && A.caps.lib) tasks.push(A.api('/api/lib/context', { q, n: 4 }).then(r => (r.sources || []).forEach(x => sources.push({ title: x.title, text: x.text, kind: 'lib', url: x.url, where: x.book, category: x.category }))).catch(() => {}));
    /* the internet, when it is switched on and the 🌐 box is ticked: the top pages are read in full, the next few come in as snippets */
    if (!hasAtt && A.net && A.net.on() && $('useweb').checked) tasks.push(A.net.lookup(q).then(r => {
      const pages = r.pages || [], have = new Set(pages.map(p => p.url));
      pages.forEach(p => sources.push({ title: p.title, text: p.text, kind: 'web', url: p.url, where: 'the web (read just now)' }));
      (r.results || []).slice(0, 6).forEach(x => { if (!have.has(x.url)) sources.push({ title: x.title, text: x.snippet || '', kind: 'web', url: x.url, where: 'web result (' + (x.source || 'web') + ')' }); });
    }).catch(() => {}));
    /* a question about the news uses the articles the News tab already saved: no extra AI call, works offline */
    if (!hasAtt && NEWSQ.test(q)) tasks.push(newsSources(q).then(list => list.forEach(x => sources.push(x))).catch(() => {}));
    /* a question about Moundshroud itself is answered from Moundshroud's own files, not from guesswork */
    if (!hasAtt && window.AppCtx && AppCtx.about(q)) tasks.push(AppCtx.context(q).then(t => { if (t) sources.push({ title: 'Moundshroud source code', text: t, kind: 'app', where: 'the app\'s own files (web/, lib/, server.js)' }); }).catch(() => {}));
    await Promise.all(tasks);
    (cur.att || []).filter(a => a.text).reverse().forEach(a => sources.unshift({ title: a.name, text: a.text.slice(0, 12000), kind: 'attach', where: 'attached file' }));
    const pg = (A.lib && A.lib.pending()) || (A.library && A.library.pending()); if (pg) sources.unshift({ title: 'Library page', text: pg.slice(0, 6000), kind: 'lib', url: '', where: 'the page you were reading' });
    return sources;
  }
  const INTERP = '\n\nYou have a code interpreter. When the question needs calculation, counting, dates, data from an attached file, a table or a chart, do not work it out in your head: write ONE short code block in Python (```python) that prints the result (pandas, numpy and matplotlib are available; attached files are in /data/; for a chart use matplotlib and do not call plt.show()). Moundshroud runs it and sends you the output, then you give the final answer. For questions that need no calculation, just answer.';
  /* questions that need working out (the interpreter writes and runs code first), and requests for code itself (not run) */
  const COMPUTE = /\b(sum|total|average|mean|median|mode|calculate|compute|work out|how many|how much|percent(age)?|prime|factorial|square root|sqrt|cube|plot|chart|graph|histogram|statistic|standard deviation|variance|convert|days (between|until|since)|compound interest|interest rate|loan|mortgage|probability|odds|solve|equation|fibonacci|digits?|divisible|multiply|divided)\b|%|\d+\s*[-+*\/^x×÷]\s*\d+/i;
  const ASKCODE = /\b(write|show|give|explain|teach|example|generate|create|make|fix|debug|review)\b.{0,40}\b(code|script|function|program|class|snippet|regex)\b/i;
  const runOn = () => { const c = document.getElementById('runcode'); return !!(c && c.checked); };
  function systemPrompt(sources, voice) {
    let s = 'You are MOUNDSHROUD, a helpful, polished assistant running privately and offline on the user\'s own PC. Be clear, accurate and reasonably concise. Today is ' + new Date().toLocaleDateString([], { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' }) + '.';
    const persona = (ls.get('persona', '') || '').trim();      // the user's own personality setting (Settings › Personality) leads the prompt
    if (persona) s += '\n\nThe user has set how you should act and think. Follow this closely in your tone, style and behaviour, as long as it stays safe and honest:\n' + persona;
    if (sources.length) {
      s += '\n\nUse the numbered sources below when they help answer the question, and cite them like [1] or [2]. If they do not help, answer from your own knowledge and say that the sources did not cover it. Never invent a citation.\n';
      sources.forEach((x, i) => { s += '\n[' + (i + 1) + '] ' + x.title + (x.page ? ' (page ' + x.page + ')' : '') + ' - ' + (x.where || '') + '\n' + x.text + '\n'; });
      if (sources.some(x => x.category === 'Medical')) s += '\nThis involves medical information. Give the facts from the sources, and remind the user briefly that this is reference information, not a diagnosis, and to call emergency services for emergencies.';
    }
    if (sources.some(x => x.kind === 'doc' || x.kind === 'note' || x.kind === 'attach'))
      s += '\n\nSome sources are the user\'s own files, notes or downloaded reference libraries. Treat them as the authority: keep every specific detail (commands, flags, paths, numbers, names, versions) inside what they actually say, and name the file in the citation when an answer rests on one document, like [2 web/music/notes.md]. If they do not cover part of the question, say plainly what is missing and offer to search again - never fill the gap with a guess dressed up as fact.\n';
    if (runOn() && !voice && window.A && A.interp) s += INTERP;
    if (sources.some(x => x.kind === 'web')) s += '\n\nSome sources were fetched from the internet a moment ago. Prefer them for anything that could have changed since your training, name the site in the citation (for example [1] Wikipedia), and if they disagree with what you already know, trust them and say so.';
    if (sources.some(x => x.kind === 'news')) s += '\n\nSome sources are news articles saved by the News tab. Answer from them, name the outlet and the date, and say how recent the news is. If they do not cover the question, say the News tab has nothing on it yet and suggest refreshing News.';
    if (sources.some(x => x.kind === 'app')) s += '\n\nSome sources are excerpts of Moundshroud\'s own source code, so you can answer questions about the app itself exactly: name the file (for example web/js/chat.js) when you explain where something lives. Never invent a file or a setting that is not in the excerpts - if it is not there, say you could not find it and offer to search again.';
    if (voice) s += '\n\nThe user is talking to you out loud and your answer will be read aloud. Reply in one to three short, natural spoken sentences. No lists, no markdown, no citations.';
    if (A.memory && !(A.ai && A.ai.isCloud(model()) && !A.ai.allowed('memory'))) s += A.memory.prompt();      // what the AI remembers stays off Claude unless allowed
    return s;
  }

  /* ---------- sending ---------- */
  function setBusy(b) { busy = b; $('go').textContent = b ? '■ Stop' : 'Send'; $('go').title = b ? 'Stop this reply (Esc)' : 'Send your message (Enter)'; $('go').classList.toggle('stop', b); }
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
      const pic = pictureRequest(text);
      if (pic) return makePicture(pic, text);
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
    const el = render(am, cur.msgs.length - 1); el.classList.add('pending'); msgsEl.appendChild(el); msgsEl.scrollTop = msgsEl.scrollHeight;      // .pending hides Copy, Redo and the rest until the reply is finished
    setBusy(true); setStatus('searching...', 'busy');
    let ok = true, stopped = false;
    const wait = label => { const bd = el.querySelector('.bd'); if (bd && !am.content) bd.innerHTML = waitHtml(label); };
    wait('Looking through your files and libraries…');
    try {
      /* the code interpreter, code first: a question that needs working out gets a program written and run before the answer,
         because small models rarely choose to write code by themselves and guess numbers instead */
      let computed = '';
      if (runOn() && A.interp && !opts.voice && COMPUTE.test(text) && !ASKCODE.test(text)) {
        const files = (cur.att || []).filter(a => a.text);
        const msgs = [{ role: 'system', content: 'You write Python. Write ONE short Python program that computes the answer to the user\'s question and prints the result with a short label. pandas, numpy and matplotlib are available' + (files.length ? '; the attached files are in /data/: ' + files.map(f => f.name).join(', ') : '') + '. For a chart or graph use matplotlib and do not call plt.show(). Reply with only one ```python code block and nothing else.' }, { role: 'user', content: text }];
        for (let round = 0; round < 2; round++) {
          setStatus('writing code...', 'busy'); wait(round ? 'Fixing the code…' : 'Writing code to work it out…');
          let reply = ''; await stream({ model: model(), stream: true, think: false, keep_alive: '3m', options: { temperature: 0, num_predict: 700 }, messages: msgs }, j => { const mm = j.message || {}; if (mm.content) reply += mm.content; });      /* capped: the code is all that is needed */
          const blk = A.interp.firstBlock(reply) || (/\bprint\s*\(/.test(reply) ? { lang: 'python', code: reply.replace(/```\w*/g, '') } : null); if (!blk) break;
          setStatus('running code...', 'busy'); wait('Running the code in the sandbox…');
          const r = await A.interp.run(blk.lang, blk.code, { files });
          const figs = []; for (const b64 of (r.figures || []).slice(0, 4)) { try { const blob = await (await fetch('data:image/png;base64,' + b64)).blob(); figs.push((await AIArt.keep(blob)).url); } catch (e) { } }
          const outText = A.interp.asText(r); (am.runs = am.runs || []).push({ lang: blk.lang, code: blk.code.slice(0, 8000), out: outText, ok: !!r.ok, ms: r.ms || 0, figs });
          const bd = el.querySelector('.bd'); if (bd) bd.insertAdjacentHTML('afterend', runsHtml({ runs: [am.runs[am.runs.length - 1]] }));
          if (r.ok) { computed = outText; break; }
          msgs.push({ role: 'assistant', content: reply }, { role: 'user', content: 'It failed with:\n' + outText + '\nFix it. Reply with only the corrected ```python code block.' });
        }
        wait('Writing the answer…');
      }
      const sources = computed ? [] : opts.sources || (!opts.noLocal && A.actions && A.actions.looksActionable(text) ? [] : await gather(text)); am.sources = sources;
      if (sources.length) { const ch = el.querySelector('.chips'); if (!ch) el.insertAdjacentHTML('beforeend', srcChips(sources)); }
      const hist = cur.msgs.slice(0, -2).filter(m => !m.local).slice(-12).map(m => ({ role: m.role, content: m.content }));
      const showTh = $('showthink').checked, think = opts.voice ? false : (showTh || $('think').checked);      /* Show thinking also asks the model to think: nothing can be shown otherwise */
      const body = { model: model(), stream: true, keep_alive: (A.power && A.power.on ? '1m' : '3m'), think, messages: [{ role: 'system', content: systemPrompt(sources, opts.voice) }, ...hist, Object.assign({ role: 'user', content: text }, (cur.att || []).some(a => a.image) ? { images: cur.att.filter(a => a.image).map(a => a.image) } : {})] };
      const hh = A.prep && A.prep.ctxFor ? A.prep.ctxFor(text) : ''; if (hh) body.messages[0].content += hh;
      if (computed) body.messages[0].content += '\n\nThe code interpreter has already worked this out exactly. Its output:\n```\n' + computed + '\n```\nGive the answer using this output as the true result (do not recalculate it, do not write code).' + (/chart\(s\) shown/.test(computed) ? ' A chart from the code is shown to the user; mention it in one sentence.' : ' No chart was made; do not mention one.');       // household details, only for emergency-type questions
      const useTools = !opts.sources && !opts.noLocal && A.actions && A.actions.looksActionable(text);      // let the AI press buttons in the app
      if (useTools) {
        const prev = A.chat.lastExplanation().slice(0, 700);       // a clean slate for action requests, so old requests are not repeated; the last answer is kept for "quiz me on that"
        body.messages = [{ role: 'system', content: body.messages[0].content + A.actions.hint + (prev ? '\n\nFor context only - your previous answer in this chat was: "' + prev.replace(/"/g, "'") + '". Use it only if the user says "that" or "it".' : '') }, body.messages[body.messages.length - 1]];
        body.tools = A.actions.schema; if (!think) body.think = false;
      }
      setStatus('thinking...', 'busy'); wait('Thinking…'); const calls = [];
      const onTok = j => {
        const mm = j.message || {};
        if (mm.tool_calls && mm.tool_calls.length) calls.push(...mm.tool_calls);
        if (mm.thinking) am.thinking += mm.thinking;
        if (mm.content) am.content += mm.content;
        setStatus(am.content ? 'writing...' : 'thinking...', 'busy');
        if (!paintT) paintT = setTimeout(paint, 60);      // repaint at most ~16 times a second: re-parsing the whole reply on every token made long answers lag and run hot
      };
      let paintT = 0;
      const paint = () => {
        paintT = 0;
        const bd = el.querySelector('.bd'); if (bd) bd.innerHTML = am.content ? md(am.content) : waitHtml('Thinking…');
        if (am.thinking && !el.querySelector('details')) el.insertAdjacentHTML('afterbegin', '<details' + (showTh ? ' open' : '') + '><summary>Thinking</summary><div></div></details>');
        const dv = el.querySelector('details div'); if (dv) dv.textContent = am.thinking;
        if (msgsEl.scrollHeight - msgsEl.scrollTop - msgsEl.clientHeight < 140) msgsEl.scrollTop = msgsEl.scrollHeight;
      };
      try { await stream(body, onTok); clearTimeout(paintT); paint(); }
      catch (e) {
        if (e.name === 'AbortError') throw e;
        for (let k = 0; k < 2 && e; k++) {      // a model may lack tools AND thinking: retry once per missing feature
          if (am.content) throw e;
          if (body.tools && /tool/i.test(e.message)) { delete body.tools; body.messages[0].content = body.messages[0].content.replace(A.actions.hint, ''); }     // this model cannot use tools
          else if ('think' in body && /think/i.test(e.message)) { delete body.think; if (showTh) A.toast(String(model()).replace(/:latest$/, '') + ' cannot show its thinking. It answers without it.', 4500); }
          else throw e;
          try { await stream(body, onTok); e = null; } catch (e2) { if (e2.name === 'AbortError') throw e2; e = e2; }
        }
        if (e) throw e;
      }
      /* the code interpreter: the reply's code runs in the sandbox and the AI answers from what it printed */
      const askedForCode = /\b(write|show|give|explain|teach|example|generate|create|make)\b.{0,40}\b(code|script|function|program|class|snippet)\b/i.test(text);
      if (runOn() && A.interp && !calls.length && !askedForCode && !computed) {
        for (let round = 0; round < 2; round++) {
          const blk = A.interp.firstBlock(round ? am.content.slice(am._ranTo || 0) : am.content); if (!blk) break;
          setStatus('running code...', 'busy'); wait('Running the code…');
          const r = await A.interp.run(blk.lang, blk.code, { files: (cur.att || []).filter(a => a.text) });
          const figs = []; for (const b64 of (r.figures || []).slice(0, 4)) { try { const blob = await (await fetch('data:image/png;base64,' + b64)).blob(); figs.push((await AIArt.keep(blob)).url); } catch (e) { } }
          const outText = A.interp.asText(r);
          (am.runs = am.runs || []).push({ lang: blk.lang, code: blk.code.slice(0, 8000), out: outText, ok: !!r.ok, ms: r.ms || 0, figs });
          am._ranTo = am.content.length; paint();
          const follow = { ...body, messages: body.messages.concat([{ role: 'assistant', content: am.content }, { role: 'user', content: 'The code ran in the sandbox. Its output:\n```\n' + outText + '\n```\n' + (r.ok ? 'Now give the final answer to my question using this output. Do not repeat the code.' : 'It failed. Write a fixed version in one code block, or answer without code if you cannot fix it.') }]) };
          delete follow.tools; setStatus('thinking...', 'busy');
          am.content += '\n\n'; const base = am.content;
          await stream(follow, j => { const mm = j.message || {}; if (mm.content) { am.content = base + (am._more = (am._more || '') + mm.content); if (!paintT) paintT = setTimeout(paint, 60); } }); am._more = ''; clearTimeout(paintT); paint();
          if (r.ok) break;
        }
        delete am._ranTo;
      }
      let didAct = false;
      /* the AI chose to draw: the picture is made right here in the chat, never by opening Studio */
      const drawCall = calls.find(c => c.function && c.function.name === 'make_image');
      if (drawCall) {
        let a = drawCall.function.arguments || {}; if (typeof a === 'string') { try { a = JSON.parse(a); } catch (e) { a = {}; } }
        const subject = String(a.description || text).trim(), sh = a.shape === 'wide' ? [768, 512] : a.shape === 'tall' ? [512, 768] : [512, 512];
        setBusy(false); ctl = null; am.content = '';
        return pictureInto(am, el, { kind: 'make', subject, shape: sh, detailed: /detail|realistic|best|hd|4k|8k/i.test(text) });
      }
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
      if (e.name === 'AbortError') { stopped = true; am.content = (am.content ? am.content.trimEnd() + '\n\n' : '') + '*(stopped)*'; }
      else { am.err = true; am.content = (am.content ? am.content + '\n\n' : '') + '**Something went wrong:** ' + e.message + '\n\nIf the model is still loading, wait a few seconds and press Try again.'; }
    }
    if (cur._kept) { am.content = (am.content || '').trim() + '\n\n_🔒 ' + cur._kept + '_'; delete cur._kept; }
    setBusy(false); ctl = null;
    if (ok) setStatus('ready'); else if (stopped) setStatus('stopped'); else setStatus('that did not work - press Try again', 'err');
    el.classList.remove('pending'); fill(el, am); cur.updated = Date.now(); persist(); msgsEl.scrollTop = msgsEl.scrollHeight;
  }

  /* ---------- message actions ---------- */
  msgsEl.addEventListener('click', async e => {
    const rb = e.target.closest('.runbtn');
    if (rb) {
      const pre = rb.closest('pre'), code = pre.querySelector('code').textContent; rb.disabled = true; rb.textContent = '⏳ Running…';
      const r = await A.interp.run(pre.dataset.lang, code, { files: (cur.att || []).filter(a => a.text) });
      let box = pre.nextElementSibling; if (!box || !box.classList.contains('runlive')) { box = document.createElement('div'); box.className = 'runlive'; pre.after(box); }
      box.innerHTML = '<pre class="runout">' + esc(A.interp.asText(r)) + '</pre>' + (r.figures || []).map(b => '<img class="runfig" src="data:image/png;base64,' + b + '" alt="chart">').join('');
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
      case 'imgmore': if (m.img && !busy) { if (m.img.kind === 'edit') { A.toast('Use “Edit it” to change this photo again.'); break; } makePicture({ kind: 'make', subject: m.img.subject, shape: [512, 512], detailed: true }, 'Another version: ' + m.img.subject); } break;
      /* Edit it: the picture is attached to this chat; you say the change and the edited picture comes back here */
      case 'imgedit': if (m.img && window.AIArt) { const b = await (await fetch(m.img.url)).blob(), f = await AIArt.fitPhoto(b, 1024); (cur.att = cur.att || []).push({ name: 'picture', image: f.url.split(',')[1], thumb: f.url, text: '' }); drawAtt(); inEl.value = 'Make it '; inEl.focus(); autosize(); A.toast('Picture attached. Say what to change, e.g. "make it look like winter".', 4000); } break;
    }
  });

  /* ---------- selection card (text from hotkeys) ---------- */
  A.chat = {
    ask(text, opts) { return send(text, opts); },
    busy: () => busy,
    stop() { if (busy && ctl) ctl.abort(); },      // Esc on the Chat page (main.js A.escape) and the Stop button both end the reply here
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
  $('go').title = 'Send your message (Enter)'; $('mic').setAttribute('aria-label', 'Speak your message'); clip.setAttribute('aria-label', 'Attach a file');
  /* the message box reports its height, so the jump button and notifications sit just above it and never on top of it */
  const comp = inEl.closest('.composer');
  if (comp && window.ResizeObserver) new ResizeObserver(() => { const h = comp.offsetHeight; if (h > 0) document.documentElement.style.setProperty('--composer-h', h + 'px'); }).observe(comp);
  /* after scrolling up in a long chat, one button returns to the newest message */
  const toLatest = document.createElement('button'); toLatest.id = 'tolatest'; toLatest.type = 'button'; toLatest.textContent = '↓ Newest message'; toLatest.title = 'Jump to the newest message';
  chatPanel.appendChild(toLatest);
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
  async function loadModels(tries = 0) {
    $('status').textContent = tries ? 'starting the AI engine...' : 'connecting...';
    try {
      const r = await A.api('/api/models');
      if (!r.models.length) { if (tries < 8) { setTimeout(() => loadModels(tries + 1), 2500); return; } $('model').innerHTML = '<option>(no model)</option>'; $('status').textContent = 'AI engine not available'; return; }
      const saved = ls.get('model', '');      const pref = r.models.map(m => m.name), cloudOf = {}; r.models.forEach(m => { if (m.cloud) cloudOf[m.name] = m.label || ('☁ ' + m.name); });
      /* each model shows its size, and the copies the Agent tab makes of a model sit in a group of their own under the everyday ones */
      const opt = m => '<option value="' + esc(m.name) + '">' + esc(m.cloud ? (m.label || m.name) : m.name.replace(/:latest$/, '') + (m.size ? ' · ' + (m.size / 1073741824).toFixed(1) + ' GB' : '')) + '</option>';
      const isCopy = m => !m.cloud && /-agent(-\d+k)?(:|$)/i.test(m.name), main = r.models.filter(m => !isCopy(m)), copies = r.models.filter(isCopy);
      $('model').innerHTML = copies.length ? '<optgroup label="Models">' + main.map(opt).join('') + '</optgroup><optgroup label="Agent tab copies (same models, larger memory)">' + copies.map(opt).join('') + '</optgroup>' : main.map(opt).join('');
      $('model').title = 'The AI model that answers in Chat. A larger model (more GB) usually answers better and more slowly.';
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
  $('showthink').checked = ls.get('showthink', '0') === '1'; $('showthink').onchange = () => ls.set('showthink', $('showthink').checked ? '1' : '0');
  A.chat.warm = warm;

  A.registerTab('chat', 'Chat', () => inEl.focus());
  A.ready.push(async () => {
    try { chats = await A.api('/api/chats'); if (!Array.isArray(chats)) chats = []; } catch (e) { chats = []; }
    chats = chats.map(c => ({ id: c.id, title: c.title || 'Chat', updated: c.updated || 0, msgs: (c.messages || c.msgs || []).map(m => ({ role: m.role, content: m.content || m.display || '', thinking: m.thinking || '', local: m.local, img: m.img, runs: m.runs, sources: m.sources || [] })) }));
    cur = newChat(); chats.unshift(cur); renderAll(); loadModels();
  });
})();




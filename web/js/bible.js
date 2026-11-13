// Bible Expert (Chat > Bible): ask about Scripture, the Church and Christian history. The model on this PC answers a Catholic reader
// from passages found in your own texts (data\bible\*.txt, searched by /api/bible/search), and cites them as [1], [2].
// It uses the models you already have; only this tab's instructions differ from the normal chat.
// The conversation stays while the app is open (switching tabs keeps it); "New conversation" clears it.
(() => {
  const esc = s => String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const bare = m => String(m || '').replace(/:latest$/, '');
  const mdx = t => typeof md === 'function' ? md(String(t || '')) : esc(t).replace(/\n/g, '<br>');
  const lsGet = k => { try { return localStorage.getItem(k) || ''; } catch (e) { return ''; } };
  const lsPut = (k, v) => { try { localStorage.setItem(k, v); } catch (e) { } };
  const STARTERS = ['What does the Church teach about the Eucharist?', 'Who wrote the Gospel of John, and when?', 'Explain the Council of Nicaea in plain words', 'What did Augustine mean by "our heart is restless"?', 'Where does the Bible talk about forgiveness?', 'What is the difference between the Old and New Covenant?'];

  const RULES = 'You are a Catholic Bible and Church-history expert answering a Catholic reader. You are patient, warm, accurate and plain-spoken.\n' +
    '- Quote Scripture, the Catechism or any writer ONLY from the numbered passages below, and cite them as [1], [2]. If a verse or quote is not in the passages, say you do not have its text here; never quote from memory and never invent a verse number, a Catechism paragraph number or a citation.\n' +
    '- Keep apart three things: what Scripture says, what the Church teaches (Catechism, councils, Fathers), and what is theological opinion or scholarly debate. Say which one you are giving.\n' +
    '- State Catholic teaching as the Church teaches it. When asked about other Christian views, describe them fairly and say where they differ.\n' +
    '- Give the historical setting when it helps: author, date, audience, the world the text came from. If scholars disagree, say so. When a source gives a traditional attribution or date (for example Challoner\'s introductions), call it the traditional view and mention that modern scholars often date or attribute it differently.\n' +
    '- A source marked Wikipedia is general reference, not Church teaching: use it for dates, people and events, and say it is from Wikipedia.\n' +
    '- If the passages do not cover the question, say that, then give what you know and mark it as from general knowledge, not from the texts.\n' +
    '- For personal conscience, sacraments, marriage or a spiritual struggle, give the teaching and suggest speaking with a priest. Be concise: short paragraphs, no more than about 250 words unless asked for more.';

  let root = null, MODELS = null, msgs = [], busy = false, ctl = null, st = null;

  async function pickModels() {
    if (!A.olympics || !A.olympics.models) return [];
    try { return (await A.olympics.models()).filter(m => m.chat && !m.cloud); } catch (e) { return []; }
  }
  const bestModel = ms => { const want = lsGet('bible_model'); if (want && ms.some(m => m.name === want)) return want; const g = ms.find(m => /^gemma4:12b/.test(m.name)); return (g || ms.slice().sort((x, y) => y.size - x.size)[0] || {}).name || ''; };

  async function render(host) {
    root = host;
    host.innerHTML = '<div class="olx"><div class="olhead"><b>✝️ Bible Expert</b><span class="small mute" id="bbst">Checking the texts…</span><span style="flex:1"></span><label class="small">Model <select id="bbm"></select></label><button class="ib" data-a="new" title="Start a fresh conversation">New conversation</button></div>' +
      '<div id="bbbody" class="scroll pad" style="flex:1;min-height:0"></div>' +
      '<div class="composer"><div class="row" style="gap:8px;align-items:flex-end"><textarea id="bbin" rows="2" style="flex:1" placeholder="Ask about Scripture, the Church or Christian history…  (Enter to send, Shift+Enter for a new line)"></textarea><button class="pri" id="bbgo" data-a="go">Ask</button></div></div></div>';
    host.addEventListener('click', onClick);
    const inp = host.querySelector('#bbin');
    inp.addEventListener('keydown', e => { if (e.key === 'Enter' && !e.shiftKey && !e.isComposing) { e.preventDefault(); ask(); } });
    host._onShow = () => { refresh(); paint(); };
    MODELS = await pickModels();
    const sel = host.querySelector('#bbm'), cur = bestModel(MODELS);
    sel.innerHTML = MODELS.length ? MODELS.map(m => '<option value="' + esc(m.name) + '"' + (m.name === cur ? ' selected' : '') + '>' + esc(m.label || bare(m.name)) + '</option>').join('') : '<option value="">No local model found</option>';
    sel.onchange = () => lsPut('bible_model', sel.value);
    await refresh(); paint();
  }
  async function refresh() {
    try { st = await A.api('/api/bible/status'); } catch (e) { st = null; }
    const el = root && root.querySelector('#bbst'); if (!el) return;
    el.textContent = !st ? 'The text library could not be read.' : st.passages ? st.passages.toLocaleString() + ' passages from ' + st.books.length + (st.books.length === 1 ? ' text' : ' texts') : 'No texts added yet';
  }
  function paint() {
    const b = root && root.querySelector('#bbbody'); if (!b) return;
    if (!msgs.length) {
      b.innerHTML = '<div class="card"><div style="font-weight:600;margin-bottom:6px">Ask anything about the Bible, the Church or Christian history</div>' +
        '<div class="small mute">Answers come from the Douay-Rheims Bible with Challoner&rsquo;s notes, the Baltimore Catechisms, the Confessions and other Catholic classics built into Moundshroud, plus your offline Wikipedia for history, with numbered sources under each reply. The model does not quote verses from memory.</div>' +
        '<div class="olsug" style="margin-top:10px">' + STARTERS.map(t => '<button class="chip" data-t="' + esc(t) + '">' + esc(t) + '</button>').join('') + '</div></div>' +
        (st ? '<div class="card small mute">Want more? Put extra plain <code>.txt</code> files (Church Fathers, encyclicals, a commentary) in <code>' + esc(st.dir || 'data\bible') + '</code>. They are picked up on their own.</div>' : '') +
        (st && st.books && st.books.length ? '<div class="card small"><b>Texts loaded</b><ul style="margin:6px 0 0;padding-left:18px">' + st.books.map(x => '<li>' + esc(x.title) + ' <span class="mute">· ' + x.passages.toLocaleString() + ' passages</span></li>').join('') + '</ul></div>' : '');
      return;
    }
    b.innerHTML = msgs.map(m => m.role === 'user'
      ? '<div class="m u"><div class="bd">' + esc(m.content) + '</div></div>'
      : '<div class="m a"><div class="bd">' + (m.content ? mdx(m.content) : '<span class="dots"></span><span class="stl">' + esc(m.wait || 'Searching the texts…') + '</span>') + '</div>' + srcHtml(m) + (m.err ? '<div class="small" style="color:var(--bad,#c33)">' + esc(m.err) + '</div>' : '') + '</div>').join('');
    b.scrollTop = b.scrollHeight;
  }
  const srcHtml = m => m.sources && m.sources.length ? '<details class="runbox"><summary>Sources (' + m.sources.length + ')</summary>' + m.sources.map((s, i) => '<div class="small" style="margin:8px 0"><b>[' + (i + 1) + '] ' + esc(s.where || s.title) + '</b><div class="mute" style="white-space:pre-wrap">' + esc(s.text.slice(0, 700)) + (s.text.length > 700 ? '…' : '') + '</div></div>').join('') + '</details>' : '';
  function live() {
    const b = root && root.querySelector('#bbbody'), last = msgs[msgs.length - 1]; if (!b || !last) return;
    const el = b.querySelector('.m.a:last-child .bd'); if (el) el.innerHTML = last.content ? mdx(last.content) : el.innerHTML;
    if (b.scrollHeight - b.scrollTop - b.clientHeight < 160) b.scrollTop = b.scrollHeight;
  }
  function setBusy(v) { busy = v; const g = root && root.querySelector('#bbgo'); if (g) { g.textContent = v ? '■ Stop' : 'Ask'; g.classList.toggle('stop', v); } }

  async function ask(text) {
    if (busy) { if (ctl) ctl.abort(); return; }
    const inp = root.querySelector('#bbin'), q = String(text != null ? text : inp.value).trim(); if (!q) return;
    const model = root.querySelector('#bbm').value; if (!model) { A.toast && A.toast('No local model is installed.'); return; }
    inp.value = '';
    const am = { role: 'assistant', content: '', sources: [] };
    msgs.push({ role: 'user', content: q }, am); paint(); setBusy(true); ctl = new AbortController();
    try {
      const query = q + ' ' + prevContext();
      const [found, wiki] = await Promise.all([A.api('/api/bible/search', { q: query, n: 6 }).catch(() => ({ results: [] })), A.caps && A.caps.lib ? A.api('/api/lib/context', { q, n: 2, only: ['Wikipedia'] }).catch(() => ({ sources: [] })) : Promise.resolve({ sources: [] })]);
      am.sources = (found.results || []).slice(0, 6).concat((wiki.sources || []).slice(0, 2).map(x => ({ title: x.title, where: 'Wikipedia (offline): ' + x.title, text: String(x.text || ''), wiki: true }))); am.wait = 'Found ' + am.sources.length + ' sources. Waiting for the model (the first answer can take a minute while it loads)…'; paint();
      let sys = RULES + '\n\n';
      if (am.sources.length) am.sources.forEach((s, i) => { sys += '[' + (i + 1) + '] ' + (s.where || s.title) + '\n' + s.text + '\n\n'; });
      else sys += 'No passages from the added texts matched this question. Say so in your first sentence, do not quote any verse or document, and answer only in general terms from what you know, marked as general knowledge.\n';
      const hist = msgs.slice(0, -2).slice(-8).map(m => ({ role: m.role, content: m.content }));
      const r = await A.olympics.ask(model, [{ role: 'system', content: sys }].concat(hist, [{ role: 'user', content: q }]), { signal: ctl.signal, max: 900, temp: .3, onText: t => { am.content = t; live(); } });
      am.content = r.text || am.content || '*(no answer)*';
    } catch (e) { if (e.name === 'AbortError' || (ctl && ctl.signal.aborted)) { am.content = (am.content || '') + '\n\n*(stopped)*'; } else { am.err = 'The model could not answer: ' + String(e.message || e); } }
    ctl = null; setBusy(false); paint();
  }
  /* a follow-up such as "and what about the second one?" has no keywords of its own: the last question's words help the search */
  const prevContext = () => { const u = msgs.slice(0, -2).filter(m => m.role === 'user').pop(); return u ? u.content.slice(0, 200) : ''; };

  function onClick(e) {
    const t = e.target.closest('button'); if (!t || !root.contains(t)) return; const d = t.dataset;
    if (d.t) ask(d.t);
    else if (d.a === 'go') ask();
    else if (d.a === 'new') { if (ctl) ctl.abort(); msgs = []; paint(); }
  }
  A.bible = { render, RULES };
})();

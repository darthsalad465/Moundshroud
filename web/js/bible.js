// Bible Expert (Spiritual > Bible Expert): ask about Scripture, the Church and Christian history. The model on this PC answers a Catholic reader
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

  const RULES = 'You are an expert on Christianity (Scripture, theology, Church history, the Fathers, the saints and the liturgy) answering a Catholic reader. You are patient, warm, accurate and plain-spoken.\n' +
    '- Quote Scripture, the Catechism or any writer ONLY from the numbered passages below, and cite them as [1], [2]. If a verse or quote is not in the passages, say you do not have its text here; never quote from memory and never invent a verse number, a Catechism paragraph number or a citation.\n' +
    '- Keep apart three things: what Scripture says, what the Church teaches (Catechism, councils, Fathers), and what is theological opinion or scholarly debate. Say which one you are giving.\n' +
    '- State Catholic teaching as the Church teaches it. When asked about other Christian views, describe them fairly and say where they differ.\n' +
    '- The numbered passages come from many writers and centuries: Church Fathers, councils, the Catechism, papal encyclicals, the 1913 Catholic Encyclopedia, and also Orthodox and Protestant authors (Calvin, Luther, Wesley, Matthew Henry, Schaff). Say who wrote a passage and which tradition it speaks for, using the title shown above each numbered passage (for example "Calvin says [1]", "the Catechism says [2]"); never attribute a passage to a source other than its own title. A Protestant or older source is a view to report, not Church teaching. A work from 1913 or the 1800s can be out of date, so say so when that matters.\n' +
    '- Give the historical setting when it helps: author, date, audience, the world the text came from. If scholars disagree, say so. When a source gives a traditional attribution or date (for example Challoner\'s introductions), call it the traditional view and mention that modern scholars often date or attribute it differently.\n' +
    '- A source marked Wikipedia is general reference, not Church teaching: use it for dates, people and events, and say it is from Wikipedia.\n' +
    '- If the passages do not cover the question, say that, then give what you know and mark it as from general knowledge, not from the texts.\n' +
    '- For personal conscience, sacraments, marriage or a spiritual struggle, give the teaching and suggest speaking with a priest. Be concise: short paragraphs, no more than about 250 words unless asked for more.';

  let poll = 0, root = null, MODELS = null, msgs = [], busy = false, ctl = null, st = null, curId = null, curRec = null, view = 'chat', savedQ = '', delArm = '';

  async function pickModels() {
    if (!A.olympics || !A.olympics.models) return [];
    try { return (await A.olympics.models()).filter(m => m.chat && !m.cloud); } catch (e) { return []; }
  }
  const bestModel = ms => { const want = lsGet('bible_model'); if (want && ms.some(m => m.name === want)) return want; const g = ms.find(m => /^gemma4:12b/.test(m.name)); return (g || ms.slice().sort((x, y) => y.size - x.size)[0] || {}).name || ''; };

  async function render(host) {
    root = host;
    host.innerHTML = '<div class="olx"><div class="olhead"><b>✝️ Bible Expert</b><span class="small mute" id="bbst">Checking the texts…</span><span style="flex:1"></span><label class="small">Model <select id="bbm"></select></label><button class="ib" data-a="saved" title="Conversations you have saved">📂 Saved chats</button><button class="ib" data-a="copy" id="bbcopy" title="Copy this conversation with its sources">Copy</button><button class="ib" data-a="export" id="bbexp" title="Save this conversation as a file">Export</button><button class="ib" data-a="new" title="Start a fresh conversation">New conversation</button></div>' +
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
    el.textContent = !st ? 'The text library could not be read.' : st.indexing ? 'Reading the texts: ' + st.indexing.done + ' of ' + st.indexing.total + '. You can ask already; answers get better as this finishes.' : st.passages ? st.passages.toLocaleString() + ' passages from ' + st.books.length + (st.books.length === 1 ? ' text' : ' texts') : 'No texts added yet';
    if (st && st.indexing && !poll) poll = setTimeout(async () => { poll = 0; if (!root || !root.isConnected || !root.querySelector('#bbst')) return; await refresh(); if (!msgs.length && !busy) paint(); }, 4000);
  }
  /* a long list of texts, folded by kind (Church Fathers, Catholic reference, Protestant theology...) */
  function groupsHtml(books) {
    const g = new Map(); books.forEach(x => { const k = x.group || 'Other'; if (!g.has(k)) g.set(k, []); g.get(k).push(x); });
    return [...g].map(([k, xs]) => '<details style="margin-top:6px"><summary>' + esc(k) + ' <span class="mute">· ' + xs.length + (xs.length === 1 ? ' text' : ' texts') + '</span></summary><ul style="margin:4px 0 0;padding-left:18px">' + xs.map(x => '<li>' + esc(x.title) + ' <span class="mute">· ' + x.passages.toLocaleString() + ' passages</span></li>').join('') + '</ul></details>').join('');
  }
  function paint() {
    const b = root && root.querySelector('#bbbody'); if (!b) return;
    const has = !!(msgs.length && view === 'chat'); ['#bbcopy', '#bbexp'].forEach(q => { const e = root.querySelector(q); if (e) e.style.display = has ? '' : 'none'; });
    if (view === 'saved') return paintSaved(b);
    if (!msgs.length) {
      b.innerHTML = '<div class="card"><div style="font-weight:600;margin-bottom:6px">Ask anything about the Bible, the Church or Christian history</div>' +
        '<div class="small mute">Answers come from the Bible (Douay-Rheims with Challoner&rsquo;s notes), the Catechism of the Catholic Church, the Church Fathers, Aquinas, the Catholic Encyclopedia, the Vatican II documents, the papal encyclicals, the creeds, Church histories, and Orthodox and Protestant writers, all kept on this PC, plus your offline Wikipedia for history. Each reply lists numbered sources. The model does not quote verses from memory.</div>' +
        '<div class="olsug" style="margin-top:10px">' + STARTERS.map(t => '<button class="chip" data-t="' + esc(t) + '">' + esc(t) + '</button>').join('') + '</div></div>' +
        (st ? '<div class="card small mute">Want more? Put plain <code>.txt</code> files of your own in <code>' + esc(st.dir || 'data\\bible') + '</code>. They are picked up on their own.</div>' : '') +
        (st && st.books && st.books.length ? '<div class="card small"><b>Texts loaded</b> <span class="mute">(' + st.books.length + ')</span>' + groupsHtml(st.books) + '</div>' : '');
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
      const [found, wiki] = await Promise.all([A.api('/api/bible/search', { q: query, n: 16 }).catch(() => ({ results: [] })), A.caps && A.caps.lib ? A.api('/api/lib/context', { q, n: 2, only: ['Wikipedia'] }).catch(() => ({ sources: [] })) : Promise.resolve({ sources: [] })]);
      am.sources = (found.results || []).slice(0, 16).concat((wiki.sources || []).slice(0, 2).map(x => ({ title: x.title, where: 'Wikipedia (offline): ' + x.title, text: String(x.text || ''), wiki: true }))); am.wait = 'Found ' + am.sources.length + ' sources. Waiting for the model (the first answer can take a minute while it loads)…'; paint();
      let sys = RULES + '\n\n';
      if (am.sources.length) am.sources.forEach((s, i) => { sys += '[' + (i + 1) + '] ' + (s.where || s.title) + '\n' + s.text + '\n\n'; });
      else sys += 'No passages from the added texts matched this question. Say so in your first sentence, do not quote any verse or document, and answer only in general terms from what you know, marked as general knowledge.\n';
      const hist = msgs.slice(0, -2).slice(-8).map(m => ({ role: m.role, content: m.content }));
      const r = await A.olympics.ask(model, [{ role: 'system', content: sys }].concat(hist, [{ role: 'user', content: q }]), { signal: ctl.signal, max: 900, temp: .3, onText: t => { am.content = t; live(); } });
      am.content = r.text || am.content || '*(no answer)*';
    } catch (e) { if (e.name === 'AbortError' || (ctl && ctl.signal.aborted)) { am.content = (am.content || '') + '\n\n*(stopped)*'; } else { am.err = 'The model could not answer: ' + String(e.message || e); } }
    ctl = null; setBusy(false); paint(); autosave();
  }
  /* every answered question is saved at once (in this browser), so a reload or a restart never loses the conversation */
  async function autosave() {
    const C = A.bibleChats; if (!C) return; const m = msgs.filter(x => x.content && !x.err); if (!m.length) return;
    const mdl = root && root.querySelector('#bbm') ? root.querySelector('#bbm').value : '', rec = C.logic.record(curId, msgs, mdl, Date.now(), curRec); if (!rec) return;
    curId = rec.id; curRec = rec; const ok = await C.put(rec); if (ok) C.prune(); const el = root && root.querySelector('#bbst'); if (el && !(st && st.indexing)) el.textContent = ok ? 'Saved to your saved chats ✓' : 'Could not save this chat (browser storage is full or blocked).';
  }
  const curRecord = () => A.bibleChats && A.bibleChats.logic.record(curId, msgs, '', Date.now(), curRec);
  async function copyText(t) { try { await navigator.clipboard.writeText(t); return true; } catch (e) { try { const ta = document.createElement('textarea'); ta.value = t; ta.style.cssText = 'position:fixed;left:-999px'; document.body.appendChild(ta); ta.select(); const ok = document.execCommand('copy'); ta.remove(); return ok; } catch (z) { return false; } } }
  function download(rec) { const L = A.bibleChats.logic, blob = new Blob([L.toMarkdown(rec)], { type: 'text/markdown' }), a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = L.fileName(rec); document.body.appendChild(a); a.click(); setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 500); }
  async function paintSaved(b) {
    const C = A.bibleChats, L = C.logic, all = await C.list(), l = L.sortList(all, savedQ); if (view !== 'saved') return;
    const when = ts => new Date(ts).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' });
    b.innerHTML = '<div class="card"><div class="row" style="gap:8px;flex-wrap:wrap;align-items:center"><b>📂 Saved chats</b><span class="small mute">' + all.length + ' saved in this browser</span><span style="flex:1"></span><input id="bbsq" type="text" placeholder="Search your chats…" value="' + esc(savedQ) + '" style="min-width:160px"><button class="ib" data-a="back">← Back</button></div></div>' +
      (l.length ? l.map(r => '<div class="card" data-id="' + esc(r.id) + '"><div style="font-weight:600">' + esc(r.title) + '</div><div class="small mute" style="margin:2px 0 8px">' + esc(when(r.ts)) + ' · ' + r.msgs.filter(m => m.role === 'user').length + ' question' + (r.msgs.filter(m => m.role === 'user').length === 1 ? '' : 's') + (r.id === curId ? ' · open now' : '') + '</div><div class="row" style="gap:6px;flex-wrap:wrap"><button class="ib" data-a="open" data-id="' + esc(r.id) + '">Open</button><button class="ib" data-a="rcopy" data-id="' + esc(r.id) + '">Copy</button><button class="ib" data-a="rexp" data-id="' + esc(r.id) + '">Export</button><button class="ib" data-a="del" data-id="' + esc(r.id) + '">' + (delArm === r.id ? 'Really delete?' : 'Delete') + '</button></div></div>').join('') : '<div class="card small mute">' + (all.length ? 'No saved chat matches that search.' : 'Nothing saved yet. Every question you ask here is saved by itself, and shows up in this list.') + '</div>');
    const q = b.querySelector('#bbsq'); if (q) q.oninput = () => { savedQ = q.value; clearTimeout(q._t); q._t = setTimeout(() => paintSaved(b).then(() => { const n = b.querySelector('#bbsq'); if (n) { n.focus(); n.setSelectionRange(n.value.length, n.value.length); } }), 150); };
  }

  /* a follow-up such as "and what about the second one?" has no keywords of its own: the last question's words help the search */
  const prevContext = () => { const u = msgs.slice(0, -2).filter(m => m.role === 'user').pop(); return u ? u.content.slice(0, 200) : ''; };

  function onClick(e) {
    const t = e.target.closest('button'); if (!t || !root.contains(t)) return; const d = t.dataset;
    if (d.t) ask(d.t);
    else if (d.a === 'go') ask();
    else if (d.a === 'new') { if (ctl) ctl.abort(); msgs = []; curId = null; curRec = null; view = 'chat'; paint(); refresh(); }
    else if (d.a === 'saved') { view = view === 'saved' ? 'chat' : 'saved'; delArm = ''; paint(); }
    else if (d.a === 'back') { view = 'chat'; paint(); }
    else if (d.a === 'copy') { const r = curRecord(); if (r) copyText(A.bibleChats.logic.toMarkdown(r)).then(ok => A.toast && A.toast(ok ? 'Conversation copied.' : 'Could not copy.')); }
    else if (d.a === 'export') { const r = curRecord(); if (r) download(r); }
    else if (d.a === 'open') A.bibleChats.get(d.id).then(r => { if (!r) return; if (ctl) ctl.abort(); msgs = r.msgs.map(m => m.role === 'user' ? { role: 'user', content: m.content } : { role: 'assistant', content: m.content, sources: m.sources || [] }); curId = r.id; curRec = r; view = 'chat'; paint(); });
    else if (d.a === 'rcopy') A.bibleChats.get(d.id).then(r => r && copyText(A.bibleChats.logic.toMarkdown(r)).then(ok => A.toast && A.toast(ok ? 'Conversation copied.' : 'Could not copy.')));
    else if (d.a === 'rexp') A.bibleChats.get(d.id).then(r => r && download(r));
    else if (d.a === 'del') { if (delArm !== d.id) { delArm = d.id; paint(); return; } delArm = ''; A.bibleChats.del(d.id).then(() => { if (d.id === curId) { curId = null; curRec = null; msgs = []; } paint(); }); }
  }
  A.bible = { render, RULES, saved: () => A.bibleChats ? A.bibleChats.list() : Promise.resolve([]) };
})();

// Ask Moundshroud Everything: one question across your own stuff (notes and files, past chats, study cards, reminders, Bible notes, chess, weather and sky log, favorites,
// and the journal only when you tick it). Moundshroud finds the best passages on this PC, then the local AI answers from ONLY those, with numbered sources you can open.
(() => {
  const esc2 = s => String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c])), DAY = 864e5;
  const SRC = [['notes', '📝', 'Notes and files', 1], ['chats', '💬', 'Past chats', 1], ['cards', '🃏', 'Study cards', 1], ['rem', '⏰', 'Reminders', 1], ['bible', '✝️', 'Bible notes', 1], ['chess', '♟️', 'Chess', 1], ['sky', '🌦️', 'Weather and sky', 1], ['fav', '⭐', 'Favorites', 1], ['cal', '📅', 'Calendar', 1], ['kitchen', '🍳', 'Kitchen', 1], ['garden', '🌱', 'Garden', 1], ['journal', '📓', 'Journal (private)', 0], ['money', '💰', 'Money (private)', 0]];
  const STOP = new Set('a an the and or but of to in on at for from with by about as is are was were be been being am do does did have has had having i me my mine we us our you your it its this that these those what when where which who whom why how can could should would will shall may might not no yes if then than so such there here into over under again up down out off just also any all some more most very much many few each every other another own same too only both between during before after above below through while moundshroud tell show find give know get got please last next first today tonight yesterday tomorrow week month year ago morning night this'.split(' '));
  const stem = w => w.length > 4 ? w.replace(/(ing|ed|es|s)$/, '') : w;
  const toks = s => String(s || '').toLowerCase().replace(/[^\p{L}\p{N}' -]/gu, ' ').split(/\s+/).map(w => w.replace(/^['-]+|['-]+$/g, '')).filter(w => w.length > 1).map(stem);
  const keywords = q => [...new Set(toks(q).filter(w => !STOP.has(w)))];
  const rd = (k, d) => { try { return JSON.parse(ls.get(k, JSON.stringify(d))); } catch (e) { return d; } };
  const fmtWhen = ms => ms ? new Date(ms).toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' }) : '';
  const timeHint = q => {                                         // "yesterday", "last week", "3 days ago" ... -> [from, to] in ms, or null
    const t = String(q).toLowerCase(), now = new Date(), d0 = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime(); let m;
    if (/\byesterday\b|\blast night\b/.test(t)) return [d0 - DAY, d0]; if (/\btoday\b|\bthis morning\b|\btonight\b/.test(t)) return [d0, d0 + DAY];
    if ((m = /\b(\d+) days? ago\b/.exec(t))) return [d0 - (+m[1]) * DAY, d0 - (+m[1] - 1) * DAY];
    if (/\blast week\b/.test(t)) return [d0 - 14 * DAY, d0 - 6 * DAY]; if (/\bthis week\b/.test(t)) return [d0 - 6 * DAY, d0 + DAY];
    if (/\blast month\b/.test(t)) return [new Date(now.getFullYear(), now.getMonth() - 1, 1).getTime(), new Date(now.getFullYear(), now.getMonth(), 1).getTime()]; if (/\bthis month\b/.test(t)) return [new Date(now.getFullYear(), now.getMonth(), 1).getTime(), d0 + DAY];
    return null;
  };

  /* ---------- gathering text from your data ---------- */
  async function collect(q, on) {
    const docs = [], kw = keywords(q);
    const add = (src, title, text, when, open, extra) => { text = String(text || '').replace(/\s+/g, ' ').trim(); if (text) docs.push(Object.assign({ src, title: String(title || '').replace(/\s+/g, ' ').trim().slice(0, 110), text, when: when || 0, open }, extra || {})); };
    const job = [];
    add('facts', 'Right now', 'Today is ' + new Date().toLocaleDateString([], { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' }) + ', ' + new Date().toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }) + '.' + (A.sky && A.sky.loc() ? ' You are in ' + (A.sky.loc().name || 'your saved place') + '.' : ''), Date.now());
    if (on.notes) job.push((async () => {
      const seen = new Set(), terms = [kw.join(' ')].concat(kw.length > 1 ? kw.slice(0, 3) : []);
      for (const t of terms) { if (!t) continue; let r; try { r = await A.api('/api/docs/search', { q: t, n: 8, kinds: ['doc', 'note'] }); } catch (e) { continue; } ((r && r.results) || []).forEach(x => { const k = x.path + '|' + (x.page || ''); if (seen.has(k)) return; seen.add(k); add('notes', x.title || x.path, x.text || x.snippet, 0, () => { if (x.kind === 'note') { A.showTab('notes'); setTimeout(() => A.notes.openByPath(x.path), 300); } else fetch('/api/docs/open', { method: 'POST', body: JSON.stringify({ path: x.path }) }); }, { kind: x.kind, pre: 1 }); }); }
    })());
    if (on.chats) { try { A.chat.history().forEach(c => { const ms = c.msgs || []; for (let i = 0; i < ms.length; i += 2) { const u = ms[i], a = ms[i + 1]; add('chats', c.title || 'Chat', 'You asked: ' + (u && u.content || '') + ' Moundshroud answered: ' + (a && a.content || ''), c.updated || 0, () => A.chat.load(c.id)); } }); } catch (e) { } }
    if (on.cards) job.push(A.api('/api/cards').then(list => { (Array.isArray(list) ? list : []).forEach(c => { const v = Object.values(c).filter(x => typeof x === 'string' && x); add('cards', v[0] || 'Card', v.join(' - '), c.due || 0, () => A.showTab('study')); }); }).catch(() => { }));
    if (on.rem) job.push(A.api('/api/reminders').then(list => { (Array.isArray(list) ? list : (list && list.items) || []).forEach(r => add('rem', 'Reminder', (r.text || '') + ' (' + new Date(r.at).toLocaleString([], { weekday: 'long', month: 'long', day: 'numeric', hour: 'numeric', minute: '2-digit' }) + (r.rule ? ', repeating' : '') + ')', r.at, () => { A.showTab('tools'); setTimeout(() => A.tools.go('rem'), 200); })); }).catch(() => { }));
    if (on.bible) job.push((async () => {
      const notes = rd('faith_notes', {}), hl = rd('faith_hl', {}), bm = rd('faith_bm', []); if (!Object.keys(notes).length && !Object.keys(hl).length && !(bm || []).length) return;
      let bib = null; try { await A.faith.getBible(); bib = A.faith.bible(); } catch (e) { }
      const info = k => { const m = /(\d+)\D+(\d+)\D+(\d+)/.exec(String(k)); if (!m || !bib) return { ref: String(k), text: '', go: () => A.showTab('faith') }; const b = +m[1], c = +m[2], v = +m[3], bk = bib.books[b]; if (!bk) return { ref: String(k), text: '', go: () => A.showTab('faith') }; const ch = bk.ch[c]; return { ref: bk.n + ' ' + (c + 1) + ':' + (v + 1), text: ch && ch.v ? String(ch.v[v] || '').replace(/\s+/g, ' ') : '', go: () => { A.showTab('faith'); setTimeout(() => A.faith.openBible(b, c, v), 500); } }; };
      Object.entries(notes).forEach(([k, n]) => { const i = info(k), t = typeof n === 'string' ? n : (n && (n.t || n.text || n.note)) || JSON.stringify(n); add('bible', i.ref, 'Your note on ' + i.ref + ': ' + t + (i.text ? ' (the verse: ' + i.text + ')' : ''), (n && n.at) || 0, i.go); });
      Object.keys(hl).forEach(k => { const i = info(k); add('bible', i.ref, 'You highlighted ' + i.ref + ': ' + i.text, 0, i.go); });
      (bm || []).forEach(k => { const key = typeof k === 'string' ? k : (k && (k.k || k.key)) || ''; if (!key) return; const i = info(key); add('bible', i.ref, 'You bookmarked ' + i.ref + ': ' + i.text, (k && k.at) || 0, i.go); });
    })());
    if (on.chess) { try { if (window.ChessProfile && ChessProfile.brief) add('chess', 'Your chess profile', ChessProfile.brief(), 0, () => { A.showTab('play'); }); } catch (e) { } }
    if (on.sky) {
      try { rd('wx_log', []).forEach(o => add('sky', 'Weather reading', 'Weather reading: pressure ' + (o.p ? o.p.toFixed(0) + ' hPa' : '?') + (o.t_c != null ? ', temperature ' + o.t_c.toFixed(0) + ' C' : '') + (o.rh != null ? ', humidity ' + o.rh + '%' : '') + (o.ws != null ? ', wind ' + o.ws.toFixed(0) + ' km/h' : '') + (o.sky ? ', sky: ' + o.sky : '') + '.', o.t, () => { A.showTab('sky'); setTimeout(() => A.sky.show('weather'), 200); })); } catch (e) { }
      try {
        const S = window.SkyCore, loc = A.sky && A.sky.loc(); if (S && loc) { const now = Date.now(), d0 = new Date(); d0.setHours(0, 0, 0, 0); const rs = S.riseSet(ms => S.hor(S.sun(ms), ms, loc.lat, loc.lon).alt, d0.getTime(), -0.833), mo = S.moon(now), nf = S.nextPhase(now, 180), nn = S.nextPhase(now, 0), f = ms => new Date(ms).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }), fd = ms => new Date(ms).toLocaleDateString([], { weekday: 'long', month: 'long', day: 'numeric' });
          add('sky', 'Sun and Moon today', 'Sun and moon today' + (loc.name ? ' in ' + loc.name : '') + ': sunrise ' + (rs.rise ? f(rs.rise) : 'none') + ', sunset ' + (rs.set ? f(rs.set) : 'none') + '. The Moon is ' + S.phaseName(mo.elong) + ', ' + Math.round(mo.ill * 100) + '% lit. Next full moon ' + (nf ? fd(nf) : '?') + '; next new moon ' + (nn ? fd(nn) : '?') + '.', now, () => { A.showTab('sky'); setTimeout(() => A.sky.show('now'), 200); }); }
      } catch (e) { }
    }
    if (on.fav) { try { (A.fav.items() || []).forEach(x => add('fav', x.t || x.title || x.u, (x.t || x.title || '') + ' ' + (x.u || '') + ' ' + (x.note || ''), x.at || 0, () => { if (x.u) A.lib.openUrl(x.u, x.t); })); } catch (e) { } }
    if (on.cal) { try { const f = ms => new Date(ms).toLocaleDateString([], { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' }); (A.cal ? A.cal.events() : rd('cal_ev', [])).forEach(e => { const t = new Date(e.d + 'T12:00:00').getTime(); add('cal', e.t, 'Calendar event: ' + e.t + ' on ' + f(t) + (e.time ? ' at ' + e.time : ' (all day)') + (e.rep && e.rep !== 'none' ? ', repeats ' + e.rep : '') + (e.note ? '. ' + e.note : ''), t, () => A.cal.goto(e.d)); }); } catch (e) { } }
    if (on.kitchen) { try {
      const pan = rd('kit_pantry', []), plan = rd('kit_plan', {}), shop = rd('kit_shop', []); if (pan.length) add('kitchen', 'Pantry', 'In the pantry: ' + pan.map(p => p.n + (p.exp ? ' (use by ' + p.exp + ')' : '')).join(', ') + '.', 0, () => A.kitchen.open('pantry'));
      Object.entries(plan).forEach(([d, p]) => { const meals = [['b', 'breakfast'], ['l', 'lunch'], ['d', 'dinner']].filter(([k]) => (p[k] || []).length).map(([k, n]) => n + ': ' + p[k].map(x => x.t).join(', ')); if (meals.length) add('kitchen', 'Meal plan, ' + d, 'Meal plan for ' + new Date(d + 'T12:00:00').toLocaleDateString([], { weekday: 'long', month: 'long', day: 'numeric' }) + ' - ' + meals.join('; ') + '.', new Date(d + 'T12:00:00').getTime(), () => A.kitchen.open('plan')); });
      const need = shop.filter(x => !x.done); if (need.length) add('kitchen', 'Shopping list', 'Shopping list: ' + need.map(x => x.t).join(', ') + '.', 0, () => A.kitchen.open('shop'));
    } catch (e) { } }
    if (on.garden) { try {
      const log = rd('gd_log', []), beds = rd('gd_beds', []), P = A.garden ? A.garden.plants : []; const nm = id => (P.find(p => p.id === id) || { name: id }).name;
      log.forEach(l => add('garden', 'Harvest: ' + l.plant, 'Harvested ' + l.qty + ' ' + l.unit + ' of ' + l.plant + ' on ' + l.d + (l.note ? ' (' + l.note + ')' : '') + '.', new Date(l.d + 'T12:00:00').getTime(), () => A.showTab('garden')));
      beds.forEach(b => { const cells = Object.values(b.cells || {}); if (cells.length) add('garden', b.name, 'Garden bed ' + b.name + ' has: ' + cells.map(c => nm(c.p) + (c.d ? ' (planted ' + c.d + ')' : '')).join(', ') + '.', 0, () => A.showTab('garden')); });
      if (A.garden) { const F = A.garden.frost(); if (!F.none) add('garden', 'Frost dates', 'Last spring frost is around ' + F.last.toLocaleDateString([], { month: 'long', day: 'numeric' }) + ' and the first autumn frost around ' + F.first.toLocaleDateString([], { month: 'long', day: 'numeric' }) + '.', 0, () => A.showTab('garden')); }
    } catch (e) { } }
    if (on.money) { try { const M = rd('money', {}), cur = M.cur || '$'; (M.tx || []).forEach(t => add('money', t.c, (t.a >= 0 ? 'Earned ' : 'Spent ') + cur + Math.abs(t.a).toFixed(2) + ' on ' + t.c + (t.n ? ' (' + t.n + ')' : '') + ' on ' + t.d + '.', new Date(t.d + 'T12:00:00').getTime(), () => A.showTab('money'))); (M.goals || []).forEach(g => add('money', 'Goal: ' + g.n, 'Savings goal ' + g.n + ': saved ' + cur + g.saved + ' of ' + cur + g.target + (g.by ? ' by ' + g.by : '') + '.', 0, () => A.showTab('money'))); } catch (e) { } }
    if (on.journal) { const j = rd('journal', {}); Object.keys(j).forEach(k => { const e = j[k]; const txt = e && typeof e === 'object' ? Object.values(e).filter(v => typeof v === 'string').join(' ') + (e.m != null ? ' (mood ' + e.m + ')' : '') : String(e || ''); add('journal', 'Journal, ' + k, txt, new Date(k + 'T12:00:00').getTime() || 0, () => A.tools.go('journal')); }); }
    await Promise.all(job); return docs;
  }

  /* ---------- ranking ---------- */
  function rank(docs, q) {
    const kw = keywords(q), win = timeHint(q), N = docs.length || 1, df = {}, tk = docs.map(d => { const set = new Set(toks(d.title + ' ' + d.text)); set.forEach(w => { df[w] = (df[w] || 0) + 1; }); return set; });
    const p5 = tk.map(set => { const s = new Set(); set.forEach(w => { if (w.length >= 5) s.add(w.slice(0, 5)); }); return s; });          // related word forms share their first five letters (patient / patience)
    const has = (i, w) => tk[i].has(w) || (w.length >= 5 && p5[i].has(w.slice(0, 5))), same = (x, w) => x === w || (w.length >= 5 && x.length >= 5 && x.slice(0, 5) === w.slice(0, 5));
    const ql = String(q).toLowerCase().replace(/[^\p{L}\p{N} ]/gu, ' ').replace(/\s+/g, ' ').trim();
    const scored = docs.map((d, i) => {
      let s = 0; const tl = toks(d.title), all = toks(d.title + ' ' + d.text), hit = kw.filter(w => has(i, w)).length;
      if (kw.length && !hit && !d.pre && d.src !== 'facts') return { d, s: 0 };       // time words alone never pull something in
      kw.forEach(w => { if (!has(i, w)) return; const idf = Math.log(1 + N / (1 + (df[w] || 0))) + 0.5; let n = 0; all.forEach(x => { if (same(x, w)) n++; }); s += idf * (1 + Math.min(n, 3) * 0.5 + (tl.some(x => same(x, w)) ? 1.5 : 0)); });
      if (kw.length > 1 && ql && d.text.toLowerCase().includes(ql)) s += 3;
      if (kw.length) s *= 0.4 + 0.6 * (hit / kw.length);
      if (d.pre) s += 1;                                               // the file index already matched these
      if (win && d.when) { if (d.when >= win[0] && d.when < win[1]) s += 2.5 + (kw.length ? 0 : 1); else s *= 0.55; }
      if (d.src === 'facts') s = kw.some(w => ['today', 'date', 'time', 'day'].includes(w)) || /today|date|time|what day/.test(q.toLowerCase()) ? 3 : 0;
      return { d, s };
    }).filter(x => x.s > (kw.length ? 0.6 : 1)).sort((a, b) => b.s - a.s);
    const out = [], per = {}; for (const x of scored) { per[x.d.src] = (per[x.d.src] || 0) + 1; if (per[x.d.src] > 4) continue; out.push(x); if (out.length >= 9) break; }
    return out;
  }
  const snippet = (text, kw, len) => {
    len = len || 300; const low = text.toLowerCase(); let at = -1; for (const w of kw) { const i = low.indexOf(w.slice(0, Math.max(3, w.length - 1))); if (i >= 0 && (at < 0 || i < at)) at = i; }
    const a = Math.max(0, (at < 0 ? 0 : at) - 80), s = text.slice(a, a + len); return (a > 0 ? '… ' : '') + s + (a + len < text.length ? ' …' : '');
  };
  const hi = (txt, kw) => { let h = esc2(txt); kw.forEach(w => { const r = w.slice(0, Math.max(3, w.length - 1)).replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); h = h.replace(new RegExp('(' + r + '[\\p{L}\\p{N}]*)', 'giu'), '<mark style="background:rgba(255,214,10,.35);color:inherit">$1</mark>'); }); return h; };

  /* ---------- the window ---------- */
  let ctl = null, run = 0;
  function open(q0) {
    const on = rd('askall_src', {}); SRC.forEach(s => { if (on[s[0]] == null) on[s[0]] = !!s[3]; }); on.journal = false; on.money = false;          // the private journal and money data always start unticked
    A.dlg('<div style="display:flex;flex-direction:column;gap:10px;min-height:300px"><div class="row" style="align-items:center"><b style="font-size:18px">🧠 Ask Moundshroud Everything</b><span class="sp"></span><button class="ib" id="aax">✕</button></div>' +
      '<div class="small mute">One question across your own notes, files, chats, study cards, reminders, Bible notes, chess and weather log. The answer comes only from what is found, with numbered sources. Everything stays on this PC.</div>' +
      '<div class="row" style="gap:8px"><input id="aaq" type="text" placeholder="e.g. What did I write about patience? · When is my next reminder? · What was I studying yesterday?" style="flex:1;padding:10px 14px;border-radius:999px"><button class="pri" id="aago">Ask</button></div>' +
      '<div id="aasrc">' + SRC.map(s => '<label class="small" style="display:inline-flex;gap:4px;align-items:center;margin:2px 10px 2px 0;cursor:pointer"><input type="checkbox" data-s="' + s[0] + '"' + (on[s[0]] ? ' checked' : '') + '>' + s[1] + ' ' + s[2] + '</label>').join('') + '</div><div class="small mute" id="aajn" style="display:none">The journal is private: Moundshroud only reads it when this is ticked, and only to answer this question.</div>' +
      '<div id="aaout"></div></div>', true);
    const q = id => document.getElementById(id), box = q('aaout'); q('aaq').focus(); if (q0) q('aaq').value = q0;
    const jn = () => { q('aajn').style.display = on.journal || on.money ? 'block' : 'none'; q('aajn').textContent = 'The ' + [on.journal ? 'journal' : '', on.money ? 'money data' : ''].filter(Boolean).join(' and ') + ' ' + (on.journal && on.money ? 'are' : 'is') + ' private: Moundshroud only reads ' + (on.journal && on.money ? 'them' : 'it') + ' while ticked, and only to answer this question.'; }; jn();
    q('aax').onclick = () => { if (ctl) ctl.abort(); A.closeDlg(); };
    q('aasrc').onchange = e => { const s = e.target.dataset.s; if (!s) return; on[s] = e.target.checked; ls.set('askall_src', JSON.stringify(Object.assign({}, on, { journal: false, money: false }))); jn(); };
    const ask = async () => {
      const text = q('aaq').value.trim(); if (!text) return; const my = ++run; if (ctl) ctl.abort(); ctl = new AbortController();
      box.innerHTML = '<div class="mute small">Searching your data...</div>'; const kw = keywords(text);
      let docs; try { docs = await collect(text, on); } catch (e) { docs = []; } if (my !== run) return;
      const top = rank(docs, text), total = docs.length - 1;
      if (!top.length) { box.innerHTML = '<div class="card" style="margin:0"><b>I could not find anything about that in your data.</b><div class="small mute" style="margin:6px 0">I looked through ' + total + ' items. Try different words, tick more sources above, or ask Moundshroud in Chat, which can use the offline libraries.</div><button class="ib" id="aachat">Ask in Chat instead</button></div>'; q('aachat').onclick = () => { A.closeDlg(); A.showTab('chat'); A.chat.ask(text); }; return; }
      const srcLabel = s => (SRC.find(x => x[0] === s) || [0, '📌', s === 'facts' ? 'Moundshroud' : s])[2], srcIcon = s => (SRC.find(x => x[0] === s) || [0, '📌'])[1];
      const cards = top.map((x, i) => '<div class="card aa-src" data-n="' + (i + 1) + '" style="margin:0 0 8px;padding:10px 12px"><div class="row" style="gap:8px;align-items:baseline"><span class="badge">' + (i + 1) + '</span><b style="flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">' + srcIcon(x.d.src) + ' ' + esc2(x.d.title) + '</b><span class="small mute">' + esc2(srcLabel(x.d.src)) + (x.d.when ? ' · ' + fmtWhen(x.d.when) : '') + '</span>' + (x.d.open ? '<button class="ib" data-open="' + i + '">Open</button>' : '') + '</div><div class="small" style="margin-top:4px;line-height:1.5">' + hi(snippet(x.d.text, kw), kw) + '</div></div>').join('');
      box.innerHTML = '<div class="card" style="margin:0 0 10px"><div class="small mute" id="aast">Writing the answer from ' + top.length + ' sources...</div><div id="aaans" style="font-size:15px;line-height:1.6;white-space:pre-wrap;margin-top:4px"></div><div class="row" style="gap:6px;margin-top:8px;display:none" id="aaact"><button class="ib" id="aacp">Copy</button><button class="ib" id="aasn">Save to Notes</button><button class="ib" id="aach">Continue in Chat</button></div></div><div class="small mute" style="margin:2px 0 6px">Sources</div>' + cards;
      box.onclick = e => { const o = e.target.closest('[data-open]'); if (o) { const d = top[+o.dataset.open].d; try { A.closeDlg(); d.open(); } catch (er) { } return; } const c = e.target.closest('.aa-cite'); if (c) { const t = box.querySelector('.aa-src[data-n="' + c.dataset.n + '"]'); if (t) { t.scrollIntoView({ block: 'nearest' }); t.style.outline = '2px solid var(--acc)'; setTimeout(() => { t.style.outline = ''; }, 1500); } } };
      const ans = q('aaans'), cite = t => esc2(t).replace(/\[(\d{1,2})\]/g, (m, n) => +n >= 1 && +n <= top.length ? '<a class="aa-cite" data-n="' + n + '" style="cursor:pointer;color:var(--acc);font-weight:700">[' + n + ']</a>' : m);
      const ctx = top.map((x, i) => '[' + (i + 1) + '] (' + srcLabel(x.d.src) + (x.d.when ? ', ' + fmtWhen(x.d.when) : '') + ') ' + x.d.title + ': ' + snippet(x.d.text, kw, 650)).join('\n\n');
      const msgs = [{ role: 'system', content: 'You are Moundshroud, a private assistant that answers questions about the user\'s own notes, chats, files and records. Use ONLY the numbered sources provided. Cite the sources you use like [1] or [2][3]. If the sources do not contain the answer, say you could not find it; never invent details. Be concise and plain-spoken. Today is ' + new Date().toLocaleDateString([], { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' }) + '.' }, { role: 'user', content: 'Question: ' + text + '\n\nSources:\n' + ctx }];
      try {
        const full = await A.ai.stream(msgs, t => { if (my === run) ans.innerHTML = cite(t); }, ctl.signal, { temp: 0.2 });
        if (my !== run) return; ans.innerHTML = cite(full || ''); q('aast').textContent = 'Answer, from your own data (check the sources below):'; if (!(full || '').trim()) { ans.textContent = 'The AI did not return an answer. The matching sources are below.'; }
        q('aaact').style.display = 'flex';
        q('aacp').onclick = () => A.copy(full);
        q('aasn').onclick = () => { try { A.notes.create('Answer: ' + text.slice(0, 50), '# Answer: ' + text + '\n\n' + full + '\n\n## Sources\n' + top.map((x, i) => (i + 1) + '. ' + srcLabel(x.d.src) + ': ' + x.d.title).join('\n')); A.closeDlg(); } catch (e) { A.toast('Could not save the note.'); } };
        q('aach').onclick = () => { A.closeDlg(); A.showTab('chat'); A.chat.ask(text + '\n\nHere is what I found in my own data:\n' + ctx, { noLocal: true, sources: [] }); };
      } catch (e) {
        if (my !== run || (e && e.name === 'AbortError')) return; q('aast').innerHTML = '<span style="color:var(--warn)">The AI model could not write an answer right now (it may still be starting or short of memory), but the matching sources are below.</span>';
      }
    };
    q('aago').onclick = ask; q('aaq').onkeydown = e => { e.stopPropagation(); if (e.key === 'Enter') ask(); };
    if (q0) ask();
  }
  A.askAll = { open, collect, rank, keywords };
})();

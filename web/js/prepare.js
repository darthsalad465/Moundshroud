// Prepare: everything for a day the internet (or the power) goes out. Shell, readiness check, "stock up" downloads and the printable binder.
// Other sections (plans, supplies, people, signals, sky) register themselves with A.prep.sections.
(() => {
  const root = $('p-health');
  const SUBS = [['ready', '🛟 Ready'], ['aid', '🩺 First aid'], ['plans', '📋 Plans'], ['supplies', '🎒 Supplies'], ['people', '🪪 People'], ['signals', '📡 Signals'], ['stock', '📦 Stock up'], ['binder', '🖨️ Binder'], ['prm', '💬 Prompts']];
  let sub = ls.get('prepsub', 'ready'), tok = 0, saveT = null, pollT = null;
  const P = A.prep = { data: null, sections: {}, tok: () => tok };
  /* the prompt library (moved here from Tools; its code is in tools.js) */
  P.sections.prm = b => A.tools.show('prm', b);
  root.innerHTML = '<div class="row" id="psub" style="padding:8px 12px;gap:6px;border-bottom:1px solid var(--line);flex-wrap:wrap"></div><div id="pbody" style="flex:1;min-height:0;display:flex;flex-direction:column"></div>';

  P.load = async () => { try { P.data = await A.api('/api/prep'); } catch (e) { P.data = null; } if (!P.data) P.data = { profile: { adults: 2, children: 0, pets: 0, days: 7, needs: '', climate: 'temperate', location: null }, people: [], contacts: [], places: {}, supplies: [], done: {} }; return P.data; };
  P.save = () => { clearTimeout(saveT); saveT = setTimeout(() => A.api('/api/prep', P.data).catch(() => {}), 500); };
  P.flush = () => { clearTimeout(saveT); return A.api('/api/prep', P.data).catch(() => {}); };
  P.id = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 5);
  const MOVED = { sky: () => A.showTab('sky'), recipes: () => A.showTab('kitchen'), writing: () => A.studio.go('writing'), practice: () => A.studio.go('practice') };      // moved to the Sky, Kitchen and Studio tabs
  P.open = id => { if (MOVED[id]) return MOVED[id](); sub = id; ls.set('prepsub', id); A.showTab('health'); };
  /* a short household note for Moundshroud when you ask about emergencies (never added to other chats) */
  P.ctxFor = text => {
    if (!P.data || !/\b(outage|blackout|disaster|storm|hurricane|flood|earthquake|evacuat|supplies|prepar|stockpil|survival|emergency kit|go.?bag|shelter|grid.?down|water for|food for|how long (will|would|can))\b/i.test(text || '')) return '';
    const p = P.data.profile || {}; const bits = [(p.adults || 0) + ' adult(s)', (p.children || 0) + ' child(ren)', (p.pets || 0) + ' pet(s)'];
    return '\n\nAbout the user\'s household (use it to tailor advice, do not repeat it back): ' + bits.join(', ') + (p.needs ? '; special needs or medications: ' + p.needs : '') + '; climate: ' + (p.climate || 'temperate') + '; they aim to be self-sufficient for ' + (p.days || 7) + ' days.';
  };

  function bar() { $('psub').innerHTML = SUBS.map(s => '<button class="ib' + (sub === s[0] ? ' on' : '') + '" data-s="' + s[0] + '">' + s[1] + '</button>').join(''); }
  $('psub').onclick = e => { const b = e.target.closest('[data-s]'); if (b) { sub = b.dataset.s; ls.set('prepsub', sub); render(); } };
  async function render() {
    bar(); const b = $('pbody');
    /* each section is made once and kept (A.keep): downloads, forms and checks carry on while you look elsewhere */
    if (!P.data) { const t0 = ++tok; A.keepReset(b); b.innerHTML = '<div class="pad mute">Loading...</div>'; await P.load(); if (t0 !== tok) return; }
    const my = tok, s0 = sub;
    A.keep(b, s0, el => { if (s0 === 'aid') return A.firstAid.mount(el); const f = P.sections[s0]; if (f) f(el, my); });
  }
  A.registerTab('health', 'Prepare', render);

  const fmtSize = mb => mb >= 1024 ? (mb / 1024).toFixed(1) + ' GB' : mb + ' MB';
  const ICON = { ok: '✅', warn: '⚠️', bad: '❌' };

  /* ---------------- READY ---------------- */
  P.sections.ready = async function (b, my) {
    b.innerHTML = '<div class="scroll pad" style="flex:1"><h2>Are you ready?</h2><div class="mute small">A quick check of Moundshroud and your household. Moundshroud itself needs no internet: the AI, libraries, search, speech and documents all run on this PC.</div><div id="rscore" style="margin:12px 0"></div><div id="rlist">' + (A.skel ? A.skel(5) : '<div class="mute small">Checking...</div>') + '</div><div class="card"><div class="row" style="flex-wrap:wrap"><b style="flex:1">Offline self-test</b><button class="pri" id="rtest">Run test</button></div><div class="small mute" style="margin-top:2px">Tries every part of Moundshroud in turn, with no internet needed.</div><div id="rtres" class="small" style="margin-top:6px"></div></div></div>';
    $('rtest').onclick = selfTest;
    let h; try { h = await A.api('/api/prep/health'); } catch (e) { h = null; } if (my !== tok || !$('rlist')) return; if (!h) { $('rlist').innerHTML = '<div class="bad">Could not read the status.</div>'; return; }
    const d = P.data, cats = {}; h.books.forEach(x => { (cats[x.category] = cats[x.category] || []).push(x); });
    const days = P.sections.supplies && P.waterDays ? P.waterDays() : null;
    const C = [];
    C.push({ g: 'Moundshroud', s: h.ollama || h.models.length ? 'ok' : 'warn', t: 'AI engine', d: h.ollama ? 'Running: ' + (h.models.join(', ') || 'no models yet') : 'Asleep - it wakes when you ask something. If chat ever says "out of memory", use Fix.', fix: !h.ollama ? ['Fix AI engine', async () => { await A.api('/api/prep/fix', {}); A.toast('Cleared leftover AI processes. Ask something to wake it.'); }] : null });
    C.push({ g: 'Moundshroud', s: h.lowModel ? 'ok' : 'warn', t: 'Low-power AI model', d: h.lowModel ? 'Installed - turn on Low-power mode in Settings when on battery.' : 'Not installed. A small model saves battery and memory in an outage.', go: h.lowModel ? null : ['stock', 'Get one'] });
    C.push({ g: 'Moundshroud', s: h.stockfish ? 'ok' : 'warn', t: 'Chess engine (Stockfish)', d: h.stockfish ? 'Installed - full-strength play, deep game analysis and background study' : 'Not installed. The built-in engine still plays; one click in Stock up brings the strong one back.', go: h.stockfish ? null : ['stock', 'Get it'] });
    ['Wikipedia', 'Medical', 'Survival & prep', 'Tech help', 'Cooking & DIY', 'Dictionary', 'Books'].forEach(c => C.push({ g: 'Offline library', s: cats[c] ? 'ok' : (c === 'Survival & prep' || c === 'Medical' ? 'bad' : 'warn'), t: c, d: cats[c] ? cats[c].length + ' book' + (cats[c].length > 1 ? 's' : '') + ' (' + fmtSize(cats[c].reduce((a, x) => a + x.sizeMB, 0)) + ')' : 'Not installed', go: cats[c] ? null : ['stock', 'Stock up'] }));
    C.push({ g: 'This PC', s: !h.disk ? 'warn' : h.disk.pct >= 10 ? 'ok' : h.disk.pct >= 6 ? 'warn' : 'bad', t: 'Free disk space', d: h.disk ? h.disk.freeGB + ' GB free (' + h.disk.pct + '%)' : 'Unknown' });
    const sf = h.safety, sfDays = sf && sf.last ? Math.floor((Date.now() - Date.parse(sf.last.at)) / 864e5) : null;
    C.push({ g: 'This PC', s: sfDays !== null && sfDays <= 2 ? 'ok' : 'warn', t: 'Your progress is safe', d: sf ? (sfDays === null ? 'No copy yet - a copy is made automatically the first time Moundshroud starts each day.' : 'Copied ' + (sfDays === 0 ? 'today' : sfDays + (sfDays === 1 ? ' day' : ' days') + ' ago') + ' into ' + sf.place + (sf.count > 1 ? ', ' + sf.count + ' copies kept' : '') + '. Notes, chats, cards, quizzes, reminders, chess study and the progress inside the window (ratings, journal, favourites, Bible notes). Restore any time with restore-progress.ps1.') : 'Not available', fix: sf ? ['Copy it now', async () => { const r = await A.api('/api/safe/now', {}); A.toast(r && r.folder ? 'Your progress is copied to ' + r.folder : 'Copied', 5000); render(); }] : null, link: ['/api/backup', 'Zip of notes, cards and chats'] });
    C.push({ g: 'This PC', s: h.tray ? 'ok' : 'bad', t: 'Tray helper (hotkeys, reminders)', d: h.tray ? 'Running' : 'Not running - hotkeys and reminder pop-ups will not work' });
    C.push({ g: 'This PC', s: h.autostart ? 'ok' : 'warn', t: 'Starts with Windows', d: h.autostart ? 'Yes' : 'No - right-click the tray icon and choose "Start with Windows"' });
    C.push({ g: 'This PC', s: h.office ? 'ok' : 'warn', t: 'LibreOffice (documents)', d: h.office ? 'Installed' : 'Not found' });
    C.push({ g: 'This PC', s: h.voice ? 'ok' : 'warn', t: 'Voice input', d: h.voice ? 'Ready' : 'Speech model missing' });
    C.push({ g: 'Your household', s: h.household.profile ? 'ok' : 'warn', t: 'Household profile', d: h.household.profile ? d.profile.adults + ' adults, ' + d.profile.children + ' children, ' + d.profile.pets + ' pets' : 'Not set', go: ['supplies', 'Set up'] });
    C.push({ g: 'Your household', s: h.household.people ? 'ok' : 'bad', t: 'Emergency / medical cards', d: h.household.people ? h.household.people + ' card' + (h.household.people > 1 ? 's' : '') : 'None yet', go: h.household.people ? null : ['people', 'Add'] });
    C.push({ g: 'Your household', s: h.household.contacts >= 3 ? 'ok' : h.household.contacts ? 'warn' : 'bad', t: 'Emergency contacts', d: h.household.contacts + ' saved (aim for 3 or more, including one out of the area)', go: h.household.contacts >= 3 ? null : ['people', 'Add'] });
    C.push({ g: 'Your household', s: h.household.places ? 'ok' : 'warn', t: 'Meeting place and out-of-area contact', d: h.household.places ? 'Set' : 'Not set', go: h.household.places ? null : ['people', 'Set'] });
    C.push({ g: 'Your household', s: h.household.haveSupplies >= 15 ? 'ok' : h.household.supplies ? 'warn' : 'bad', t: 'Supplies list', d: h.household.supplies ? h.household.haveSupplies + ' of ' + h.household.supplies + ' items checked off' : 'Not started', go: h.household.haveSupplies >= 15 ? null : ['supplies', 'Open'] });
    if (days !== null) C.push({ g: 'Your household', s: days >= (d.profile.days || 7) ? 'ok' : days >= 3 ? 'warn' : 'bad', t: 'Stored water', d: days.toFixed(1) + ' days for your household (goal ' + (d.profile.days || 7) + ')', go: days >= (d.profile.days || 7) ? null : ['supplies', 'Plan'] });
    C.push({ g: 'Your household', s: d.done && d.done.binderAt ? 'ok' : 'warn', t: 'Printed emergency binder', d: d.done && d.done.binderAt ? 'Made ' + A.fmtAgo(d.done.binderAt) : 'Not made yet', go: ['binder', 'Create'] });
    const score = Math.round(C.reduce((a, c) => a + (c.s === 'ok' ? 1 : c.s === 'warn' ? 0.5 : 0), 0) / C.length * 100), col = score >= 80 ? 'var(--ok)' : score >= 55 ? 'var(--warn)' : 'var(--bad)';
    $('rscore').innerHTML = '<div class="row" style="gap:16px"><div class="ring" style="--p:' + score + ';--c:' + col + ';margin:0"><span class="cu" data-to="' + score + '">0%</span></div><div><b style="font-size:17px">' + (score >= 80 ? 'Well prepared' : score >= 55 ? 'Getting there' : 'Needs attention') + '</b><div class="small mute">' + C.filter(c => c.s === 'ok').length + ' of ' + C.length + ' checks passed &middot; ' + (navigator.onLine ? 'online right now' : '<span class="ok">offline right now - Moundshroud is working normally</span>') + '</div></div></div>';
    let last = ''; $('rlist').innerHTML = C.map((c, i) => (c.g !== last ? (last = c.g, '<div class="grp">' + c.g + '</div>') : '') + '<div class="card row" style="padding:8px 12px;margin:0 0 6px"><span>' + ICON[c.s] + '</span><div style="flex:1;min-width:0"><b>' + esc(c.t) + '</b><div class="small mute">' + esc(c.d) + '</div></div>' + (c.go ? '<button class="ib" data-go="' + c.go[0] + '">' + c.go[1] + '</button>' : '') + (c.fix ? '<button class="ib" data-fix="' + i + '">' + c.fix[0] + '</button>' : '') + (c.link ? '<a class="ib" href="' + c.link[0] + '" download style="text-decoration:none">' + c.link[1] + '</a>' : '') + '</div>').join('');
    $('rlist').onclick = e => { const g = e.target.closest('[data-go]'); if (g) { sub = g.dataset.go; ls.set('prepsub', sub); render(); } const f = e.target.closest('[data-fix]'); if (f) C[+f.dataset.fix].fix[1](); };
    try { A.countUp && A.countUp($('rscore').querySelector('.cu'), score, { tail: '%' }); } catch (e) { }
    $('rtest').onclick = selfTest;
  };
  async function selfTest() {
    const out = $('rtres'); $('rtest').disabled = true; out.innerHTML = ''; const line = (ok, t, ms) => { out.insertAdjacentHTML('beforeend', '<div>' + (ok ? '✅' : '❌') + ' ' + esc(t) + (ms != null ? ' <span class="mute">(' + ms + ' ms)</span>' : '') + '</div>'); };
    const T = async (name, fn) => { const t0 = Date.now(); try { const r = await fn(); line(r !== false, name + (typeof r === 'string' ? ' - ' + r : ''), Date.now() - t0); } catch (e) { line(false, name + ' - ' + e.message, Date.now() - t0); } };
    const bk = (await A.api('/api/lib/books')).books || [];
    await T('Offline library search', async () => { if (!bk.length) throw new Error('no books'); const r = await (await fetch('/wiki/suggest?content=' + encodeURIComponent(bk[0].name) + '&term=water')).json(); return r.length ? r.length + ' suggestions' : false; });
    await T('Rhyming dictionary', async () => { const r = await A.api('/api/rhyme?word=cat'); return !r.none && !r.error; });
    await T('Dictionary and thesaurus', async () => { const r = await A.api('/api/thesaurus?word=quick'); return !r.none && !r.error; });
    await T('Search your files and notes', async () => { await A.api('/api/docs/search', { q: 'test', n: 1 }); return true; });
    await T('Reminders', async () => { await A.api('/api/reminders'); return true; });
    await T('LibreOffice documents', async () => (await A.api('/api/office/status')).available);
    await T('Voice recognition engine', async () => (await A.api('/api/status')).voice);
    await T('Read aloud voices', async () => { const n = ('speechSynthesis' in window ? speechSynthesis.getVoices().length : 0); return n ? n + ' voices' : false; });
    await T('AI engine answers a question', async () => { const r = await fetch('/api/chat', { method: 'POST', body: JSON.stringify({ model: $('model').value, stream: false, think: false, keep_alive: '1m', messages: [{ role: 'user', content: 'Reply with the single word OK.' }] }) }); const j = await r.json(); if (j.error) throw new Error(j.error); return ((j.message && j.message.content) || '').slice(0, 20) || false; });
    const ext = performance.getEntriesByType('resource').filter(r => { try { return new URL(r.name).origin !== location.origin; } catch (e) { return false; } });
    line(ext.length === 0, 'No outside network requests made by Moundshroud (' + ext.length + ' found)');
    out.insertAdjacentHTML('beforeend', '<div class="mute small" style="margin-top:4px">Done. Anything marked ❌ can be fixed from the list above or the Guide\'s tips.</div>'); $('rtest').disabled = false;
  }

  /* ---------------- STOCK UP ---------------- */
  /* ---------- everything on this PC, with removal, and the voices and models that can be added ---------- */
  const gbs = by => by >= 1073741824 ? (by / 1073741824).toFixed(1) + ' GB' : Math.max(1, Math.round(by / 1048576)) + ' MB';
  function warnRemove(it, grp) {
    return new Promise(res => {
      const big = it.bytes > 1073741824 || grp === 'tools' || grp === 'models' || /kiwix|wikipedia/i.test(it.id);
      const o = document.createElement('div'); o.style.cssText = 'position:fixed;inset:0;z-index:200;background:rgba(0,0,0,.6);display:flex;align-items:center;justify-content:center;padding:16px';
      o.innerHTML = '<div class="card" role="dialog" style="max-width:520px;width:100%;margin:0;border-color:var(--bad)"><h3 style="margin:0 0 6px;color:var(--bad)">⚠ Remove ' + esc(it.name) + '?</h3>' +
        '<div class="small" style="line-height:1.55"><p style="margin:4px 0"><b>Size:</b> ' + gbs(it.bytes) + ' (freed from the disk)</p><p style="margin:4px 0"><b>What it is:</b> ' + esc(it.sub || '') + '</p><p style="margin:4px 0"><b>What happens:</b> ' + esc(it.warn || '') + '</p><p style="margin:4px 0"><b>Can it come back?</b> ' + (it.canGet ? 'Yes, from this page, with internet.' : '<span style="color:var(--bad)">Not from this page.</span>') + '</p></div>' +
        (big ? '<label class="small" style="display:flex;gap:6px;align-items:center;margin:10px 0 0"><input type="checkbox" id="rmok"> I understand what will stop working.</label>' : '') +
        '<div class="row" style="justify-content:flex-end;gap:8px;margin-top:14px"><button class="ib" id="rmno">Keep it</button><button class="ib dang" id="rmyes"' + (big ? ' disabled' : '') + '>Remove permanently</button></div></div>';
      document.body.appendChild(o);
      const done = v => { o.remove(); document.removeEventListener('keydown', k, true); res(v); };
      const k = e => { if (e.key === 'Escape') { e.stopPropagation(); done(false); } };
      document.addEventListener('keydown', k, true);
      o.querySelector('#rmno').onclick = () => done(false); o.onclick = e => { if (e.target === o) done(false); };
      const ok = o.querySelector('#rmok'); if (ok) ok.onchange = () => { o.querySelector('#rmyes').disabled = !ok.checked; };
      o.querySelector('#rmyes').onclick = () => done(true);
      o.querySelector('#rmno').focus();
    });
  }
  async function inventory(my) {
    const el = $('sinv'); if (!el) return;
    el.innerHTML = '<div class="small mute" style="margin:10px 0">Measuring everything on this PC… (the first time takes a few seconds)</div>';
    let r; try { r = await A.api('/api/inv'); } catch (e) { el.innerHTML = '<div class="small bad">Could not read the list: ' + esc(e.message) + '</div>'; return; }
    if (my !== tok || !$('sinv')) return;
    const open = JSON.parse(ls.get('inv_open', '{}'));
    el.innerHTML = '<h3 style="margin:16px 0 4px">Everything on this PC <span class="badge">' + gbs(r.total) + '</span>' + (r.disk ? ' <span class="small mute">· ' + gbs(r.disk.free) + ' free of ' + gbs(r.disk.total) + '</span>' : '') + '</h3>' +
      r.groups.map(g => '<details class="card" style="padding:8px 12px;margin:0 0 6px"' + (open[g.id] ? ' open' : '') + ' data-g="' + g.id + '"><summary style="cursor:pointer;display:flex;gap:8px;align-items:center"><b style="flex:1">' + esc(g.name) + '</b><span class="small mute">' + g.items.length + ' item' + (g.items.length === 1 ? '' : 's') + '</span><span class="badge">' + gbs(g.bytes) + '</span></summary>' +
        '<div class="small mute" style="margin:6px 0">' + esc(g.note) + ' <span style="opacity:.75">Folder: ' + esc(g.where) + '</span></div>' +
        (g.items.length ? g.items.slice().sort((a, c) => c.bytes - a.bytes).map(it => '<div class="row" style="padding:5px 0;border-top:1px solid var(--line);gap:8px"><div style="flex:1;min-width:0"><b>' + esc(it.name) + '</b> <span class="small mute">' + esc(it.sub || '') + '</span>' + (it.job && it.job.status === 'downloading' ? '<div class="bar" style="margin-top:4px"><i style="width:' + it.job.pct + '%"></i></div>' : '') + '</div><span class="small" style="white-space:nowrap">' + gbs(it.bytes) + '</span><button class="ib" data-rm="' + esc(it.id) + '" data-g="' + g.id + '" title="Remove (you are asked first)">🗑 Remove</button></div>').join('') : '<div class="small mute">Nothing here.</div>') + '</details>').join('') +
      (r.available.length ? '<div class="grp">Not on this PC (can be downloaded)</div>' + r.available.map(a => '<div class="card row" style="padding:8px 12px;margin:0 0 6px"><div style="flex:1"><b>' + esc(a.name) + '</b> <span class="badge">' + (a.mb >= 1024 ? (a.mb / 1024).toFixed(1) + ' GB' : a.mb + ' MB') + '</span><div class="small mute">' + esc(a.desc) + '</div>' + (a.job && a.job.status === 'downloading' ? '<div class="bar" style="margin-top:5px"><i style="width:' + a.job.pct + '%"></i></div>' : a.job && a.job.status === 'error' ? '<div class="small bad">' + esc(a.job.error) + '</div>' : '') + '</div><button class="ib" data-get="' + esc(a.id) + '">' + (a.job && a.job.status === 'downloading' ? a.job.pct + '%' : 'Download') + '</button></div>').join('') : '');
    el.querySelectorAll('details[data-g]').forEach(d => d.ontoggle = () => { const o2 = JSON.parse(ls.get('inv_open', '{}')); o2[d.dataset.g] = d.open ? 1 : 0; ls.set('inv_open', JSON.stringify(o2)); });
    el.onclick = async e => {
      const rmb = e.target.closest('[data-rm]');
      if (rmb) {
        const g = r.groups.find(x => x.id === rmb.dataset.g), it = g && g.items.find(x => x.id === rmb.dataset.rm); if (!it) return;
        if (!(await warnRemove(it, g.id))) return;
        rmb.disabled = true; rmb.textContent = 'Removing…';
        const x = await A.api('/api/inv/remove', { id: it.id }).catch(err => ({ error: err.message }));
        if (x.error) A.notify('err', 'Could not remove ' + it.name + ': ' + x.error); else A.notify('ok', 'Removed ' + it.name + ' (' + gbs(it.bytes) + ' freed).');
        inventory(my); return;
      }
      const gb = e.target.closest('[data-get]');
      if (gb) { gb.disabled = true; const x = await A.api('/api/inv/get', { id: gb.dataset.get }).catch(err => ({ error: err.message })); if (x.error) A.notify('err', x.error); else A.notify('ok', x.message || 'Download started.'); setTimeout(() => inventory(my), 1500); }
    };
    if (Object.values(r.jobs || {}).some(j => j.status === 'downloading')) setTimeout(() => { if (my === tok) inventory(my); }, 3000);
    extras(my, r);
  }
  /* any AI model by name, and every natural voice there is */
  async function extras(my, r) {
    const mn = $('smodname');
    if (mn && !mn.dataset.on) {
      mn.dataset.on = 1;
      mn.innerHTML = '<div class="card row" style="padding:8px 12px;margin:0 0 6px;gap:8px;flex-wrap:wrap"><div style="flex:1;min-width:220px"><b>Any other AI model, by name</b><div class="small mute">Any model in the Ollama library (ollama.com/library), for example <code>qwen3.5:9b</code>, <code>llama3.2:3b</code>, <code>gemma3:4b</code> or <code>nomic-embed-text</code>. Check its size first: it has to fit in memory to run well.</div></div><input id="mname" placeholder="model:size" style="width:170px"><button class="ib" id="mgo">Download</button></div>';
      mn.querySelector('#mgo').onclick = async () => { const v = mn.querySelector('#mname').value.trim(); if (!v) return; const x = await A.api('/api/inv/pull', { model: v }).catch(e => ({ error: e.message })); if (x.error) A.notify('err', x.error); else A.notify('ok', 'Downloading ' + v + '. Progress shows under AI models above.'); };
    }
    const sv = $('svoice'); if (!sv) return;
    let c; try { c = await A.api('/api/inv/voices'); } catch (e) { c = { voices: [] }; }
    if (my !== tok || !$('svoice')) return;
    if (c.error || !c.voices.length) { sv.innerHTML = '<div class="grp">Natural voices</div><div class="small mute">The list of voices could not be read (it comes from huggingface.co).</div>'; return; }
    const have = new Set(((r.groups.find(g => g.id === 'voices') || {}).items || []).map(i => i.id.replace(/^voice:/, ''))), jobs = r.jobs || {};
    const langs = [...new Set(c.voices.map(v => v.lang))];
    sv.innerHTML = '<div class="grp">Natural voices (' + c.voices.length + ' voices in ' + langs.length + ' languages)</div><div class="small mute" style="margin-bottom:6px">On-device voices for reading aloud, from the Piper project. Pick one in Settings, Voice &amp; sound once it is here. Useful for the Languages tab too.</div>' +
      langs.map(l => { const vs = c.voices.filter(v => v.lang === l); return '<details class="card" style="padding:6px 12px;margin:0 0 4px"><summary style="cursor:pointer"><b>' + esc(l) + '</b> <span class="small mute">' + vs.length + ' voice' + (vs.length > 1 ? 's' : '') + (vs.some(v => have.has(v.key)) ? ' · ✓ ' + vs.filter(v => have.has(v.key)).length + ' installed' : '') + '</span></summary>' + vs.map(v => { const j = jobs['voice:' + v.key]; return '<div class="row" style="padding:4px 0;border-top:1px solid var(--line);gap:8px"><span style="flex:1">' + esc(v.name.replace(/_/g, ' ')) + ' <span class="small mute">' + esc(v.region) + ' · ' + v.quality + (v.speakers > 1 ? ' · ' + v.speakers + ' speakers' : '') + '</span></span><span class="small">' + v.mb + ' MB</span>' + (have.has(v.key) ? '<span class="ok small">✓ Installed</span>' : j && j.status === 'downloading' ? '<span class="small mute">' + j.pct + '%</span>' : '<button class="ib" data-vget="' + esc(v.key) + '">Download</button>') + '</div>'; }).join('') + '</details>'; }).join('');
    sv.onclick = async e => { const b = e.target.closest('[data-vget]'); if (!b) return; b.disabled = true; b.textContent = '…'; const x = await A.api('/api/inv/get', { id: 'voice:' + b.dataset.vget }).catch(err => ({ error: err.message })); if (x.error) { A.notify('err', x.error); b.disabled = false; b.textContent = 'Download'; } else { A.notify('ok', 'Downloading the voice. It appears under Voices above when it is done.'); setTimeout(() => inventory(my), 2500); } };
  }
  P.sections.stock = async function (b, my) {
    b.innerHTML = '<div class="scroll pad" style="flex:1"><h2>Stock up while the internet works</h2><div class="mute small">Everything Moundshroud can download is here: offline libraries, AI models, voices, the voice-typing model, the chess engine, the picture and music makers, tools and music. Downloads keep going in the background and appear where they belong when finished. Everything already on this PC is listed first, with its size, and can be removed (you are asked first, and told what stops working and whether it can be downloaded again).</div><div id="smsg" class="card" style="margin-top:10px"></div><div id="sinv"></div><h3 style="margin:22px 0 4px">Download more</h3><div class="row" style="gap:8px;margin-bottom:12px;flex-wrap:wrap"><button class="pri" id="sgetall" title="Download all core tools: chess engine, CyberChef, library engine, Tor Browser, picture maker, music maker">⬇ Download all core tools</button><span class="small mute" id="sgetallst" style="align-self:center"></span></div><div id="slist"></div><div id="smod"></div><div id="smodname"></div><div id="smnew"></div><div id="svoice"></div><div class="small mute" style="margin:10px 0">Any other Kiwix library (.zim file) dropped into <b>nomad\\library</b> is picked up automatically. Browse more at library.kiwix.org. The chess engine is checked against the size and SHA-256 published with the Stockfish release before it is unpacked, and the source is written into <b>engines\\stockfish\\ENGINE-SOURCE.txt</b>.</div></div>';
    const draw = async () => {
      if (my !== tok || !$('slist')) return; let s; try { s = await A.api('/api/prep/stock'); } catch (e) { return; }
      const all = s.items.concat(s.engines || []), eng = (s.engines || [])[0];
      const h = { disk: s.disk, models: s.models || [] }; const need = all.filter(i => i.status === 'available' && !i.optional).reduce((a, i) => a + i.mb, 0);
      if (my !== tok || !$('smsg')) return; $('smsg').innerHTML = '<b>Free space:</b> ' + (h && h.disk ? h.disk.freeGB + ' GB (' + h.disk.pct + '%)' : '?') + ' &middot; <b>not yet downloaded (core items):</b> ' + fmtSize(need) + (eng && eng.status !== 'installed' ? ' &middot; <span class="bad">the chess engine is missing</span>' : '') + (s.added ? ' <span class="ok">- new books added, library refreshed</span>' : '');
      let last = ''; $('slist').innerHTML = all.map(i => (i.group !== last ? (last = i.group, '<div class="grp">' + i.group + '</div>') : '') + '<div class="card row" style="padding:8px 12px;margin:0 0 6px"><div style="flex:1;min-width:0"><b>' + esc(i.name) + '</b> <span class="badge">' + fmtSize(i.mb) + '</span><div class="small mute">' + esc(i.desc) + '</div>' + (i.status === 'downloading' || i.status === 'installing' ? '<div class="bar" style="margin-top:5px"><i style="width:' + (i.status === 'installing' ? 100 : i.pct) + '%"></i></div>' : '') + '</div>' + (i.status === 'installed' ? '<span class="ok small">✓ Installed</span>' : i.status === 'installing' ? '<span class="small mute">verifying...</span>' : i.status === 'downloading' ? '<span class="small mute">' + i.pct + '%</span>' : i.status === 'error' ? '<button class="ib" data-d="' + i.id + '">Retry</button>' : '<button class="ib" data-d="' + i.id + '">Download</button>') + '</div>').join('');
      $('slist').onclick = async e => { const x = e.target.closest('[data-d]'); if (!x) return; x.disabled = true; const r = await A.api('/api/prep/stock/get', { id: x.dataset.d }); if (r.error) A.toast(r.error); else A.toast('Download started'); draw(); };
      const m = await A.api('/api/prep/models').catch(() => null); const pu = m && m.pull;
      const have = (h && h.models) || [];
      if (my !== tok || !$('smod')) return;
      /* someone is typing in the model search: leave this part of the page exactly as it is, or the caret and the results get taken away mid-word */
      const mq = $('smod').querySelector('#mmfind');
      if (mq && mq === document.activeElement && mq.value.trim()) { if (all.some(i => i.status === 'downloading' || i.status === 'installing') || (pu && pu.running)) pollT = setTimeout(draw, 4000); return; }
      /* a redraw is about download progress: keep whatever the model search was showing so it is put straight back below */
      const oq = $('smod').querySelector('#mmfind'), of = $('smfind');
      if (oq && of && of.innerHTML && oq.value.trim() && of.innerHTML.indexOf('Looking on huggingface.co') < 0) P._smres = { q: oq.value.trim(), html: of.innerHTML };
      let lg = ''; $('smod').innerHTML = m ? '<div class="grp">AI models (' + m.models.length + ')</div><div class="card row" style="padding:8px 10px;margin:0 0 10px;gap:8px;flex-wrap:wrap"><input id="mmfind" placeholder="Search ' + m.models.length + ' models, or any model on Hugging Face: qwen, yi, coding..." style="flex:1;min-width:200px"><button class="ib" id="mmhf" title="Look on huggingface.co for any GGUF model, not only the ones listed here">🔎 Search Hugging Face</button><span class="small mute" style="flex:1 1 100%">These come from Hugging Face and the Ollama library, and each one is made ready on this PC the moment it finishes, so Chat and everything else can use it straight away. Anything else can be looked up on Hugging Face with the search button, or typed as owner/repo.</span></div>' + m.models.map(x => { const inst = have.some(n => n.toLowerCase().replace(/:latest$/, '') === x.id.toLowerCase().replace(/:latest$/, '')), run = pu && pu.running && pu.model === x.id, g = x.group || 'AI models', head = g !== lg ? (lg = g, '<div class="grp">' + esc(g) + '</div>') : ''; return head + '<div class="card row" data-mrow="' + esc((x.name + ' ' + (x.st || '') + ' ' + x.desc + ' ' + x.id + ' ' + g).toLowerCase()) + '" style="padding:8px 12px;margin:0 0 6px"><div style="flex:1"><b>' + esc(x.name) + '</b> <span class="badge">' + (x.mb ? fmtSize(x.mb) + ' download' : 'size unknown') + '</span><div class="small mute">' + esc(x.desc) + '</div>' + (x.st ? '<div class="small mute" style="opacity:.85">' + esc(x.st) + '</div>' : '') + (x.hf ? '<div class="small mute" style="opacity:.7">Hugging Face &middot; ' + esc(x.hf.repo) + (x.hf.quant ? ' &middot; ' + esc(x.hf.quant) : '') + '</div>' : '<div class="small mute" style="opacity:.7">Ollama library</div>') + (run ? '<div class="bar" style="margin-top:5px"><i style="width:' + pu.pct + '%"></i></div><div class="small mute">' + esc(pu.status) + '</div>' : '') + (pu && pu.error && pu.model === x.id ? '<div class="small bad">' + esc(pu.error) + '</div>' : '') + '</div>' + (inst ? '<span class="ok small">✓ Installed</span>' : run ? '<span class="small mute">' + pu.pct + '%</span>' : '<button class="ib" data-m="' + x.id + '">Download</button>') + '</div>'; }).join('') : '';
      if ($('smod')) {
      const pullIt = async e => { const x = e.target.closest('[data-m]'); if (!x) return; x.disabled = true; const r = await A.api('/api/prep/pull', { model: x.dataset.m }).catch(err => ({ error: err.message })); if (r.error) { A.toast(r.error, 6000); x.disabled = false; } else A.toast('Downloading. It shows up in Chat as soon as it is ready.'); draw(); };
      $('smod').onclick = pullIt;
      const q = $('smod').querySelector('#mmfind'); if (q) {
        const rows = [...$('smod').querySelectorAll('[data-mrow]')], hs = [...$('smod').querySelectorAll('.grp')], btn = $('smod').querySelector('#mmhf');
        if (!$('smfind')) $('smod').insertAdjacentHTML('afterend', '<div id="smfind"></div>');
        const find = $('smfind'); find.onclick = pullIt; let ft = 0;
        /* any model on huggingface.co, not only the ones in the list above */
        const hfSearch = async v => {
          if (!v) return;
          find.innerHTML = '<div class="grp">Hugging Face</div><div class="card small mute" style="margin:0 0 6px">Looking on huggingface.co for “' + esc(v) + '”…</div>';
          let r; try { r = await A.api('/api/prep/hf-search?q=' + encodeURIComponent(v)); } catch (e) { r = { error: e.message }; }
          if (q.value.trim() !== v) return;
          if (!r || r.error) { find.innerHTML = '<div class="grp">Hugging Face</div><div class="card small bad" style="margin:0 0 6px">' + esc((r && r.error) || 'The search failed.') + '</div>'; return; }
          if (!r.results || !r.results.length) { find.innerHTML = '<div class="grp">Hugging Face</div><div class="card small mute" style="margin:0 0 6px">Nothing on Hugging Face matches “' + esc(v) + '”. Try another spelling, or a repo address like owner/name.</div>'; return; }
          find.innerHTML = '<div class="grp">Hugging Face · ' + r.results.length + ' more models for “' + esc(v) + '”</div><div class="small mute" style="margin:0 0 6px">Each one is fetched as a single GGUF file (Q4_K_M when it has one) and made ready for Chat when it finishes.</div>' + r.results.map(x => '<div class="card row" style="padding:8px 12px;margin:0 0 6px"><div style="flex:1;min-width:0"><b>' + esc(x.repo) + '</b>' + (x.task ? ' <span class="badge">' + esc(x.task) + '</span>' : '') + (x.gated ? ' <span class="badge">gated</span>' : '') + '<div class="small mute">' + (x.downloads ? Number(x.downloads).toLocaleString() + ' downloads' : 'new') + (x.likes ? ' · ' + x.likes + ' likes' : '') + '</div></div><button class="ib" data-m="' + esc(x.repo) + '">Download</button></div>').join('');
        };
        if (btn) btn.onclick = () => { const v = q.value.trim(); if (v.length < 2) { A.toast('Type a word first: a name, a maker, or owner/repo.', 4000); q.focus(); return; } hfSearch(v); };
        q.oninput = () => {
          P._mmq = q.value;
          const v = q.value.trim().toLowerCase();
          rows.forEach(r => { r.style.display = !v || r.dataset.mrow.indexOf(v) >= 0 ? '' : 'none'; });
          [...document.querySelectorAll('#smnew [data-mrow]')].forEach(r => { r.style.display = !v || r.dataset.mrow.indexOf(v) >= 0 ? '' : 'none'; });
          hs.forEach(h => { let n = 0, s = h.nextElementSibling; while (s && !s.classList.contains('grp')) { if (s.hasAttribute('data-mrow') && s.style.display !== 'none') n++; s = s.nextElementSibling; } h.style.display = !v || n ? '' : 'none'; });
          clearTimeout(ft); find.innerHTML = '';
          /* nothing in the list matches: look for the rest of Hugging Face straight away */
          const t = q.value.trim();
          if (t.length >= 3 && !rows.some(r => r.dataset.mrow.indexOf(v) >= 0)) ft = setTimeout(() => hfSearch(t), 600);
        };
        /* the page redraws while something downloads: keep what was typed and what was found */
        if (P._mmq) { q.value = P._mmq; q.oninput(); }
        /* put the search results back exactly as they were, without asking huggingface.co again */
        if (P._smres && P._smres.q === q.value.trim()) { clearTimeout(ft); find.innerHTML = P._smres.html; }
        /* ---- new models: read from huggingface.co by the server, kept on disk, refreshed by itself ---- */
        const newLoad = async force => {
          if (!$('smnew') || my !== tok) return;
          clearTimeout(P._nwT);
          let r = null; try { r = await A.api('/api/prep/hf-new' + (force ? '?refresh=1' : '')); } catch (e) { r = null; }
          const box = $('smnew'); if (!box || my !== tok) return;
          const list = (r && r.models) || [], when = r && r.at ? new Date(r.at).toLocaleString() : '';
          box.innerHTML = '<div class="grp">🆕 New models · the newest on Hugging Face (' + list.length + ')</div>' +
            '<div class="card row" style="padding:8px 10px;margin:0 0 6px;gap:8px;flex-wrap:wrap"><span class="small mute" style="flex:1">Read straight from huggingface.co, newest first, and checked again by itself every few hours, so anything that comes out turns up here without an update. ' + (r && r.busy ? 'Checking huggingface.co for new models now…' : when ? 'Last checked ' + esc(when) + '.' : 'Not checked yet.') + '</span><button class="ib" id="mmnew">↻ Check now</button></div>' +
            (list.length ? list.map(x => '<div class="card row" data-mrow="' + esc((x.name + ' ' + (x.st || '') + ' ' + x.desc + ' ' + (x.hf ? x.hf.repo : '')).toLowerCase()) + '" style="padding:8px 12px;margin:0 0 6px"><div style="flex:1;min-width:0"><b>' + esc(x.name) + '</b> <span class="badge">' + (x.mb ? fmtSize(x.mb) + ' download' : 'size unknown') + '</span><div class="small mute">' + esc(x.desc) + '</div>' + (x.st ? '<div class="small mute" style="opacity:.85">' + esc(x.st) + '</div>' : '') + '<div class="small mute" style="opacity:.7">Hugging Face · ' + esc(x.hf ? x.hf.repo : '') + (x.hf && x.hf.quant ? ' · ' + esc(x.hf.quant) : '') + '</div></div><button class="ib" data-m="' + esc(x.hf ? x.hf.repo : '') + '">Download</button></div>').join('') : '<div class="card small mute" style="margin:0 0 6px">Nothing new has been read yet' + (r && r.busy ? '; huggingface.co is being checked now, they appear in a few seconds.' : '. Press “Check now”, or search above for anything that is not here.') + '</div>');
          const b = $('mmnew'); if (b) b.onclick = () => { b.disabled = true; b.textContent = 'Checking…'; newLoad(true); };
          if (r && r.busy) P._nwT = setTimeout(() => newLoad(false), 8000);
        };
        if ($('smnew')) { $('smnew').onclick = pullIt; if (!$('smnew').innerHTML) newLoad(false); }
      }
    }
      if (all.some(i => i.status === 'downloading' || i.status === 'installing') || (pu && pu.running)) pollT = setTimeout(draw, 4000);
    };
    draw();
    $('sgetall').onclick = async () => {
      const btn = $('sgetall'), st = $('sgetallst');
      btn.disabled = true; st.textContent = 'Starting…';
      try {
        const r = await A.api('/api/prep/stock/get-all');
        if (r.error) { st.textContent = '❌ ' + r.error; A.toast(r.error, 6000); }
        else { st.textContent = '✅ ' + (r.started || 0) + ' downloads started'; A.toast('Core tools download started', 5000); }
      } catch (e) { st.textContent = '❌ ' + e.message; A.toast('Failed: ' + e.message, 6000); }
      btn.disabled = false;
      setTimeout(draw, 3000);
    };
    inventory(my);
  };

  /* ---------------- BINDER ---------------- */
  P.sections.binder = function (b, my) {
    b.innerHTML = '<div class="scroll pad" style="flex:1"><h2>Emergency binder</h2><div class="mute small">One printable document with everything you would want on paper if the power and internet are both out: contacts, medical cards, meeting places, supplies, water and food numbers, plans, radio frequencies, signals and first-aid steps. Keep one copy in your go-bag and one at home.</div>' +
      '<div class="card" style="margin-top:10px"><div class="row" style="flex-wrap:wrap;gap:8px"><button class="pri" id="bpdf">Create PDF</button><button class="ib" id="bdoc">Create Word version</button><span class="small mute" id="bst"></span></div><div id="bres"></div></div><div class="small mute">It is built from what you entered in Supplies and People, so fill those in first. Saved in Documents\\Moundshroud Documents. Needs LibreOffice.</div></div>';
    const make = async kind => {
      $('bst').textContent = 'Building...'; $('bpdf').disabled = $('bdoc').disabled = true;
      try {
        const o = await A.api('/api/office/create', { kind, title: 'Emergency Binder ' + new Date().toISOString().slice(0, 10), content: P.binderMarkdown() }); if (o.error) throw new Error(o.error);
        P.data.done.binderAt = Date.now(); P.save();
        $('bres').innerHTML = '<div class="card" style="margin-top:10px"><div class="row" style="align-items:flex-start;gap:12px">' + (o.preview ? '<img src="/api/file?path=' + encodeURIComponent(o.preview) + '" style="width:150px;border:1px solid var(--line);border-radius:8px;background:#fff">' : '') + '<div style="flex:1;min-width:0"><b>' + esc(o.name) + '</b><div class="small mute" style="margin:2px 0 8px;overflow-wrap:anywhere">' + esc(o.path) + '</div><div class="row" style="flex-wrap:wrap;gap:6px"><button class="ib" data-o="default" data-p="' + esc(o.path) + '">Open / print</button><button class="ib" data-o="lo" data-p="' + esc(o.path) + '">Open in LibreOffice</button><button class="ib" data-o="folder" data-p="' + esc(o.path) + '">Show in folder</button></div></div></div></div>';
        $('bres').onclick = e => { const x = e.target.closest('[data-o]'); if (x) A.api('/api/office/open', { path: x.dataset.p, app: x.dataset.o }); }; $('bst').textContent = 'Done.';
      } catch (e) { $('bst').textContent = ''; A.toast(e.message, 5000); }
      $('bpdf').disabled = $('bdoc').disabled = false;
    };
    $('bpdf').onclick = () => make('pdf'); $('bdoc').onclick = () => make('word');
  };
  const tbl = (head, rows) => rows.length ? '| ' + head.join(' | ') + ' |\n|' + head.map(() => '---').join('|') + '|\n' + rows.map(r => '| ' + r.map(c => String(c == null ? '' : c).replace(/\|/g, '/').replace(/\n/g, ' ')).join(' | ') + ' |').join('\n') + '\n\n' : '';
  P.binderMarkdown = () => {
    const d = P.data, p = d.profile, pl = d.places || {}; let m = '# Emergency Binder\n\n*Household of ' + (p.adults || 0) + ' adult(s), ' + (p.children || 0) + ' child(ren), ' + (p.pets || 0) + ' pet(s). Made ' + new Date().toLocaleDateString([], { year: 'numeric', month: 'long', day: 'numeric' }) + ' with Moundshroud. Keep a printed copy in your go-bag and one at home.*\n\n';
    m += '## 1. Contacts\n\n' + (d.contacts.length ? tbl(['Name', 'Relation', 'Phone', 'Address / notes'], d.contacts.map(c => [c.name, c.relation || c.category, c.phone, [c.address, c.notes].filter(Boolean).join(' - ')])) : '*No contacts saved yet.*\n\n');
    m += '**Out-of-area contact (everyone calls or texts this person):** ' + (pl.outOfArea || '_not set_') + '\n\n**Meeting place near home:** ' + (pl.meet1 || '_not set_') + '\n\n**Meeting place outside the neighbourhood:** ' + (pl.meet2 || '_not set_') + '\n\n' + (pl.shutoffs ? '**Utility shut-offs:** ' + pl.shutoffs + '\n\n' : '') + (pl.notes ? '**Notes:** ' + pl.notes + '\n\n' : '');
    m += '## 2. Medical cards\n\n' + (d.people.length ? d.people.map(x => '### ' + (x.name || 'Person') + '\n\n' + tbl(['Item', 'Details'], [['Date of birth', x.dob], ['Blood type', x.blood], ['Allergies', x.allergies], ['Conditions', x.conditions], ['Medications', x.meds], ['Doctor', x.doctor], ['Insurance', x.insurance], ['Notes', x.notes]].filter(r => r[1]))).join('') : '*No medical cards yet.*\n\n');
    const have = d.supplies.filter(s => s.have), miss = d.supplies.filter(s => !s.have), soon = d.supplies.filter(s => s.expires && new Date(s.expires) < new Date(Date.now() + 90 * 864e5));
    m += '## 3. Supplies\n\n' + (d.supplies.length ? '**You have ' + have.length + ' of ' + d.supplies.length + ' items.**\n\n' + (miss.length ? '### Still to get\n\n' + miss.map(s => '- ' + s.name + (s.qty ? ' (' + s.qty + (s.unit ? ' ' + s.unit : '') + ')' : '')).join('\n') + '\n\n' : '') + (soon.length ? '### Expiring within 90 days\n\n' + tbl(['Item', 'Expires', 'Where'], soon.map(s => [s.name, s.expires, s.location])) : '') : '*Supplies list not started.*\n\n');
    if (P.calcSummary) m += '### Water, food and power plan\n\n' + P.calcSummary() + '\n\n';
    m += '## 4. What to do first\n\n' + (P.plans || []).map(s => '### ' + s.title + '\n\n' + s.now.map((x, i) => (i + 1) + '. ' + x).join('\n') + '\n').join('\n') + '\n';
    m += '## 5. Signals and radio\n\n**Distress:** SOS (three short, three long, three short). Three of anything (whistle blasts, shots, fires, flashes) means help. Mirror or flashlight flashes toward aircraft or rescuers.\n\n' + (P.radioMarkdown ? P.radioMarkdown() : '') + '\n';
    m += '## 6. First aid quick steps\n\n' + (A.firstAid ? A.firstAid.QUICK.map(q => '### ' + q[0] + '\n\n' + q[1].map((x, i) => (i + 1) + '. ' + x).join('\n') + '\n').join('\n') : '') + '\n';
    m += '## 7. Using Moundshroud with no internet\n\nMoundshroud runs fully on this PC. Press Ctrl+Alt+A to open it. The Library tab has offline encyclopedias, medical, survival, repair and cooking books. Ask it questions in Chat, or open Prepare for plans, supplies and checklists. On battery? Turn on Low-power mode in Settings.\n';
    return m;
  };
})();

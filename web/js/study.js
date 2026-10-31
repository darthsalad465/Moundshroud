// Study: decks, flashcards (spaced repetition), Learn, Test, Match, Write, Spell, streaks and import/export. Cards are written by the local model.
(() => {
  const root = $('p-study');
  let cards = [], deckSel = '', queue = [], showing = false;
  const DAY = 864e5, MAXM = 4;
  let loadBad = false; /* never overwrite saved cards with an empty list after a failed load */
  const save = () => { if (loadBad) { A.toast('Cards did not load - reopen the Study tab before editing'); return Promise.resolve(); } return A.api('/api/cards', cards); };
  const decks = () => [...new Set(cards.map(c => c.deck))];
  const inDeck = d => cards.filter(c => c.deck === d);
  const due = d => cards.filter(c => (!d || c.deck === d) && c.due <= Date.now());
  const shuf = a => { a = a.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.random() * (i + 1) | 0; [a[i], a[j]] = [a[j], a[i]]; } return a; };
  const norm = s => String(s).toLowerCase().replace(/[^\p{L}\p{N}\s]/gu, ' ').replace(/\s+/g, ' ').trim();
  const lev = (a, b) => { const m = a.length, n = b.length, d = Array.from({ length: m + 1 }, (_, i) => [i]); for (let j = 1; j <= n; j++) d[0][j] = j; for (let i = 1; i <= m; i++) for (let j = 1; j <= n; j++) d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1)); return d[m][n]; };
  const same = (given, ans) => { const g = norm(given), a = norm(ans); if (!g) return false; if (g === a) return true; if (a.length > 5 && lev(g, a) <= Math.max(1, Math.floor(a.length / 8))) return true; return false; };
  const mastery = d => { const l = d ? inDeck(d) : cards; return l.length ? Math.round(l.reduce((s, c) => s + (c.m || 0), 0) / (l.length * MAXM) * 100) : 0; };
  const mkId = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
  const newCard = (deck, q, a) => ({ id: mkId(), deck, q: String(q).trim(), a: String(a).trim(), due: Date.now(), reps: 0, int: 0, ease: 2.5, m: 0 });

  /* streak */
  const days = () => { try { return JSON.parse(ls.get('studydays', '[]')); } catch (e) { return []; } };
  const dkey = t => new Date(t).toISOString().slice(0, 10);
  function logDay() { const d = days(), k = dkey(Date.now() - new Date().getTimezoneOffset() * 6e4); if (!d.includes(k)) { d.push(k); ls.set('studydays', JSON.stringify(d.slice(-400))); } }
  function streak() { const d = new Set(days()); let n = 0, t = Date.now() - new Date().getTimezoneOffset() * 6e4; if (!d.has(dkey(t))) t -= DAY; while (d.has(dkey(t))) { n++; t -= DAY; } return n; }

  async function load() { loadBad = false; try { cards = await A.api('/api/cards'); if (!Array.isArray(cards)) throw 0; } catch (e) { cards = []; loadBad = true; } cards.forEach(c => { if (c.m == null) c.m = 0; }); }
  const back = d => d ? deckPage(d) : home();
  const head = (title, sub, onExit) => '<div class="row small mute"><button class="ib" id="sx">&larr; Exit</button><b style="color:var(--acc2);letter-spacing:.12em;text-transform:uppercase">' + esc(title) + '</b><span class="sp"></span>' + (sub || '') + '</div>';
  const shell = (h, body) => { kb = null; root.innerHTML = '<div class="pad scroll" style="flex:1">' + h + body + '</div>'; };

  /* ---------------- home ---------------- */
  function home() {
    deckSel = ''; kb = null; const ds = decks(), nDue = due('').length;
    root.innerHTML = '<div class="scroll pad" style="flex:1"><h2>Study</h2>' +
      '<div class="stat"><div class="card"><b>' + streak() + '</b><span class="small mute">day streak</span></div><div class="card"><b>' + nDue + '</b><span class="small mute">due today</span></div><div class="card"><b>' + cards.length + '</b><span class="small mute">cards</span></div><div class="card"><b>' + mastery('') + '%</b><span class="small mute">mastered</span></div></div>' +
      '<div class="row" style="margin:10px 0"><button class="pri" id="sgo"' + (nDue ? '' : ' disabled') + '>Review due cards</button><button class="ib" id="simp">Import</button></div><div id="qzslot"></div>' +
      '<div class="card"><b>Make a deck with AI</b><div class="small mute" style="margin:2px 0 6px">Paste notes or a passage and MOUNDSHROUD writes the cards. You can also add cards by hand inside a deck.</div><input id="stitle" type="text" placeholder="Deck name (e.g. Biology ch.3)" style="margin-bottom:6px"><textarea id="stext" rows="4" placeholder="Paste text here..."></textarea><div class="row" style="margin-top:6px"><button class="pri" id="smk">Make flashcards</button><button class="ib" id="snew">Empty deck</button><span class="small mute" id="sst"></span></div></div>' +
      (ds.length ? '<h3>Your decks</h3>' + ds.map(d => '<div class="card row" style="cursor:pointer" data-deck="' + esc(d) + '"><div style="flex:1"><b>' + esc(d) + '</b><div class="small mute">' + inDeck(d).length + ' cards &middot; ' + due(d).length + ' due</div><div class="bar" style="margin-top:5px"><i style="width:' + mastery(d) + '%"></i></div></div><span class="mute">' + mastery(d) + '%</span></div>').join('') : '<div class="mute small" style="margin-top:12px">No decks yet - make one above.</div>') + '</div>';
    $('sgo').onclick = () => flash('');
    $('smk').onclick = () => make($('stext').value, $('stitle').value || 'My deck');
    $('snew').onclick = () => { const n = ($('stitle').value || '').trim(); if (!n) return A.toast('Type a deck name first'); if (!decks().includes(n)) { cards.push(newCard(n, 'Question', 'Answer')); save(); } deckPage(n); };
    $('simp').onclick = () => importDlg('');
    root.querySelectorAll('[data-deck]').forEach(b => b.onclick = () => deckPage(b.dataset.deck));
    if (A.quiz) A.quiz.mount($('qzslot'));
  }

  /* ---------------- deck page ---------------- */
  function deckPage(d) {
    deckSel = d; kb = null; const l = inDeck(d), n = l.length;
    const tile = (k, name, desc, min) => '<div class="card" data-mode="' + k + '"' + (n < (min || 1) ? ' style="opacity:.4;pointer-events:none"' : '') + '><b>' + name + '</b><div class="small mute">' + desc + '</div></div>';
    root.innerHTML = '<div class="scroll pad" style="flex:1"><div class="row"><button class="ib" id="sx">&larr; Decks</button><h2 style="margin:0;flex:1">' + esc(d) + '</h2><button class="ib" id="sexp">Export</button><button class="ib" id="simp">Import</button><button class="ib dang" id="sdel">Delete</button></div>' +
      '<div class="small mute" style="margin:6px 0">' + n + ' cards &middot; ' + due(d).length + ' due &middot; ' + mastery(d) + '% mastered</div><div class="bar"><i style="width:' + mastery(d) + '%"></i></div>' +
      '<div class="mode">' + tile('flash', 'Flashcards', 'Spaced repetition') + tile('learn', 'Learn', 'Adaptive questions') + tile('test', 'Test', 'Graded practice test', 2) + tile('match', 'Match', 'Beat the clock', 4) + tile('write', 'Write', 'Type each answer') + tile('spell', 'Spell', 'Listen, then type') + '</div>' +
      '<div class="row"><h3 style="margin:0;flex:1">Cards</h3><button class="ib" id="sadd">+ Add card</button><button class="ib" id="sai">+ More with AI</button></div><div id="slist"></div></div>';
    $('sx').onclick = home;
    $('sdel').onclick = async () => { if (!confirm('Delete the deck "' + d + '"?')) return; cards = cards.filter(c => c.deck !== d); await save(); home(); };
    $('sexp').onclick = () => A.dlg('<div class="hd"><b>Export "' + esc(d) + '"</b> <span class="mute small">tab-separated: question, tab, answer</span></div><div class="bd"><textarea id="sxt" rows="12" readonly>' + esc(l.map(c => c.q.replace(/[\t\n]+/g, ' ') + '\t' + c.a.replace(/[\t\n]+/g, ' ')).join('\n')) + '</textarea><div class="row" style="margin-top:8px"><button class="pri" id="sxc">Copy</button><button class="ib" id="sxd">Close</button></div></div>') || ($('sxc').onclick = () => A.copy($('sxt').value), $('sxd').onclick = A.closeDlg);
    $('simp').onclick = () => importDlg(d);
    $('sadd').onclick = () => editDlg(null, d);
    $('sai').onclick = () => { const t = prompt('Paste text to make more cards from:'); if (t) make(t, d); };
    root.querySelectorAll('[data-mode]').forEach(t => t.onclick = () => ({ flash, learn, test, match, write, spell })[t.dataset.mode](d));
    const sl = $('slist'); sl.innerHTML = l.map(c => '<div class="card" style="padding:8px 12px"><div class="row"><div style="flex:1"><b>' + esc(c.q) + '</b><div class="mute small" style="white-space:pre-wrap">' + esc(c.a) + '</div></div><span class="small mute" title="mastery">' + '&#9679;'.repeat(c.m || 0) + '&#9675;'.repeat(MAXM - (c.m || 0)) + '</span><span class="ib" data-e="' + c.id + '" style="cursor:pointer">Edit</span></div></div>').join('');
    sl.onclick = e => { const x = e.target.closest('[data-e]'); if (x) editDlg(cards.find(c => c.id === x.dataset.e), d); };
  }
  function editDlg(c, d) {
    A.dlg('<div class="hd"><b>' + (c ? 'Edit card' : 'New card') + '</b></div><div class="bd"><div class="small mute">Question / term</div><textarea id="eq" rows="2">' + esc(c ? c.q : '') + '</textarea><div class="small mute" style="margin-top:6px">Answer / definition</div><textarea id="ea" rows="3">' + esc(c ? c.a : '') + '</textarea><div class="row" style="margin-top:10px">' + (c ? '<button class="ib dang" id="edl">Delete</button>' : '') + '<span class="sp"></span><button class="ib" id="ecn">Cancel</button><button class="pri" id="esv">Save</button></div></div>');
    $('eq').focus(); $('ecn').onclick = A.closeDlg;
    if (c) $('edl').onclick = async () => { cards = cards.filter(x => x.id !== c.id); await save(); A.closeDlg(); deckPage(d); };
    $('esv').onclick = async () => { const q = $('eq').value.trim(), a = $('ea').value.trim(); if (!q || !a) return A.toast('Both sides need text'); if (c) { c.q = q; c.a = a; } else cards.push(newCard(d, q, a)); await save(); A.closeDlg(); deckPage(d); };
  }
  function importDlg(d) {
    A.dlg('<div class="hd"><b>Import cards</b> <span class="mute small">one per line: question, TAB (or " - " or ";"), answer. Works with Quizlet exports.</span></div><div class="bd">' + (d ? '' : '<input id="idn" type="text" placeholder="Deck name" style="margin-bottom:6px">') + '<textarea id="itx" rows="10" placeholder="mitochondria&#9;powerhouse of the cell"></textarea><div class="row" style="margin-top:8px"><span class="sp"></span><button class="ib" id="icn">Cancel</button><button class="pri" id="iok">Import</button></div></div>');
    $('icn').onclick = A.closeDlg;
    $('iok').onclick = async () => {
      const deck = d || ($('idn').value.trim() || 'Imported'); let n = 0;
      for (const ln of $('itx').value.split('\n')) { const m = ln.split('\t').length > 1 ? ln.split('\t') : ln.split(/\s+[-;]\s+|;/); if (m.length >= 2 && m[0].trim() && m[1].trim()) { cards.push(newCard(deck, m[0], m.slice(1).join(' '))); n++; } }
      if (!n) return A.toast('No cards found - check the format'); await save(); A.closeDlg(); A.toast(n + ' cards imported'); deckPage(deck);
    };
  }

  /* ---------------- flashcards (spaced repetition) ---------------- */
  function flash(d) {
    queue = due(d).sort((a, b) => a.due - b.due); if (!queue.length) return A.toast('Nothing due - nice!'); showing = false; flashStep(d);
  }
  function flashStep(d) {
    if (!queue.length) { logDay(); return done('All due cards reviewed', '', d); }
    const c = queue[0];
    shell(head(c.deck, queue.length + ' left'), '<div class="flip"><div class="flash" id="fl" style="margin-top:10px">' + esc(showing ? c.a : c.q) + '</div></div>' + (showing ? '<div class="grade"><button data-g="0">Again</button><button data-g="3">Hard</button><button data-g="4">Good</button><button data-g="5">Easy</button></div>' : '<button class="pri" id="sr" style="width:100%">Show answer</button>') + '<div class="small mute" style="text-align:center;margin-top:8px">Space flips &middot; 1-4 grade</div>');
    $('sx').onclick = () => back(d);
    $('fl').onclick = () => { showing = !showing; flashStep(d); };
    if (!showing) $('sr').onclick = () => { showing = true; flashStep(d); };
    root.querySelectorAll('[data-g]').forEach(b => b.onclick = () => grade(+b.dataset.g, d));
  }
  async function grade(g, d) {
    const c = queue.shift();
    if (g < 3) { c.reps = 0; c.int = 0; c.due = Date.now() + 60000; c.m = Math.max(0, (c.m || 0) - 1); queue.push(c); }
    else { c.reps = (c.reps || 0) + 1; c.int = c.reps === 1 ? 1 : c.reps === 2 ? 3 : Math.round((c.int || 1) * (c.ease || 2.5)); if (g === 3) c.int = Math.max(1, Math.round(c.int * 0.8)); if (g === 5) c.int = Math.round(c.int * 1.3); c.due = Date.now() + c.int * DAY; c.m = Math.min(MAXM, (c.m || 0) + (g === 3 ? 0 : 1)); }
    c.ease = Math.max(1.3, (c.ease || 2.5) + (0.1 - (5 - g) * (0.08 + (5 - g) * 0.02)));
    showing = false; await save(); flashStep(d);
  }
  addEventListener('keydown', e => {
    if (A.cur !== 'study' || !queue.length || $('ov').classList.contains('on') || /INPUT|TEXTAREA/.test((e.target || {}).tagName || '')) return;
    if (!$('fl')) return;
    if (e.key === ' ') { e.preventDefault(); showing = !showing; flashStep(deckSel); } else if (showing && '1234'.includes(e.key)) grade([0, 3, 4, 5][+e.key - 1], deckSel);
  });

  function done(title, detail, d) {
    root.innerHTML = '<div class="pad" style="text-align:center;margin-top:50px"><h2>' + esc(title) + '</h2><div class="mute" style="margin:8px 0 16px">' + (detail || '') + '</div><div class="row" style="justify-content:center"><button class="pri" id="sh">Back</button></div></div>';
    $('sh').onclick = () => back(d);
  }

  /* ---------------- multiple choice + typed helpers ---------------- */
  function choices(c, pool) {
    const others = shuf(pool.filter(x => x.id !== c.id && norm(x.a) !== norm(c.a))).slice(0, 3);
    return shuf([c, ...others]);
  }
  function askMC(c, pool, ctx, next) {
    const opts = choices(c, pool);
    shell(head(ctx.title, ctx.sub), '<div class="flash" style="min-height:110px;margin-top:10px">' + esc(c.q) + '</div>' + opts.map((o, i) => '<button class="opt" data-i="' + i + '">' + (i + 1) + '. ' + esc(o.a) + '</button>').join(''));
    $('sx').onclick = ctx.exit; let locked = false;
    const pick = i => { if (locked) return; locked = true; const ok = opts[i].id === c.id; root.querySelectorAll('.opt').forEach((b, j) => { if (opts[j].id === c.id) b.classList.add('good'); else if (j === i) b.classList.add('wrong'); }); setTimeout(() => next(ok, opts[i].a), ok ? 600 : 1500); };
    root.querySelectorAll('.opt').forEach(b => b.onclick = () => pick(+b.dataset.i));
    kb = e => { if ('1234'.includes(e.key) && opts[+e.key - 1]) pick(+e.key - 1); };
  }
  function askType(c, ctx, next, speak) {
    shell(head(ctx.title, ctx.sub), (speak ? '<div class="flash" style="min-height:110px;margin-top:10px"><button class="pri" id="spk">Play the word</button></div>' : '<div class="flash" style="min-height:110px;margin-top:10px">' + esc(c.q) + '</div>') + '<input id="ty" type="text" autocomplete="off" placeholder="Type your answer..."><div class="row" style="margin-top:8px"><button class="ib" id="dk">Don\'t know</button><span class="sp"></span><button class="pri" id="ck">Check</button></div><div id="fb"></div>');
    $('sx').onclick = ctx.exit; const inp = $('ty'); inp.focus(); let locked = false;
    if (speak) { const sp = () => A.speech.speak(c.a); $('spk').onclick = sp; sp(); }
    const fin = (given, ok) => {
      if (locked) return; locked = true;
      $('fb').innerHTML = ok ? '<div class="ok" style="margin-top:10px">Correct.</div>' : '<div class="card" style="margin-top:10px"><div class="bad">Not quite.</div><div class="small mute">Your answer: ' + esc(given || '(blank)') + '</div><div>Correct: <b>' + esc(c.a) + '</b></div><div class="row" style="margin-top:8px"><button class="ib" id="ovr">I was right</button><span class="sp"></span><button class="pri" id="nx">Continue</button></div></div>';
      if (ok) return setTimeout(() => next(true, given), 700);
      $('nx').onclick = () => next(false, given); $('ovr').onclick = () => next(true, given); $('nx').focus();
    };
    const check = () => { if (!locked) fin(inp.value, same(inp.value, c.a)); };
    $('ck').onclick = check; $('dk').onclick = () => fin('', false);
    inp.onkeydown = e => { if (e.key === 'Enter') check(); };
    kb = null;
  }
  let kb = null;
  addEventListener('keydown', e => { if (A.cur === 'study' && kb && !/INPUT|TEXTAREA/.test((e.target || {}).tagName || '')) kb(e); });

  /* ---------------- learn ---------------- */
  function learn(d) {
    const l = inDeck(d); let q = shuf(l.filter(c => (c.m || 0) < 3)); if (!q.length) { q = shuf(l); l.forEach(c => c.m = 0); }
    const total = q.length; let right = 0, tries = 0;
    const ctx = { title: 'Learn - ' + d, exit: () => { save(); deckPage(d); }, sub: '' };
    const step = () => {
      if (!q.length) { logDay(); save(); return done('Round complete', right + ' correct of ' + tries + ' answers. Mastery of this deck: ' + mastery(d) + '%.', d); }
      ctx.sub = (total - q.length) + ' / ' + total; const c = q[0];
      const after = (ok) => { tries++; q.shift(); if (ok) { right++; c.m = Math.min(MAXM, (c.m || 0) + 1); if (c.m < 3) q.splice(Math.min(q.length, 3), 0, c); } else { c.m = 0; q.splice(Math.min(q.length, 2), 0, c); } step(); };
      if ((c.m || 0) < 2 && l.length >= 4) askMC(c, l, ctx, ok => after(ok)); else askType(c, ctx, ok => after(ok));
    };
    step();
  }

  /* ---------------- test ---------------- */
  function test(d) {
    const l = inDeck(d), n = Math.min(l.length, 12), set = shuf(l).slice(0, n);
    const qs = set.map((c, i) => ({ c, t: l.length >= 4 && i % 3 === 0 ? 'mc' : i % 3 === 1 ? 'tf' : 'w' })); let i = 0, score = 0; const wrong = [];
    const ctx = { title: 'Test - ' + d, exit: () => deckPage(d), sub: '' };
    const step = () => {
      if (i >= qs.length) { logDay(); qs.forEach(x => { if (wrong.includes(x.c)) x.c.m = 0; else x.c.m = Math.min(MAXM, (x.c.m || 0) + 1); }); save(); const pc = Math.round(score / qs.length * 100); return shell('<div class="row"><b style="color:var(--acc2)">TEST RESULT</b></div>', '<div class="stat" style="margin:10px 0"><div class="card"><b>' + pc + '%</b><span class="small mute">score</span></div><div class="card"><b>' + score + '/' + qs.length + '</b><span class="small mute">correct</span></div></div>' + (wrong.length ? '<h3>Review these</h3>' + wrong.map(c => '<div class="card"><b>' + esc(c.q) + '</b><div class="mute">' + esc(c.a) + '</div></div>').join('') : '<div class="ok">Perfect score.</div>') + '<div class="row" style="margin-top:10px"><button class="pri" id="sh">Done</button><button class="ib" id="sagain">New test</button></div>') || ($('sh').onclick = () => deckPage(d), $('sagain').onclick = () => test(d)); }
      ctx.sub = (i + 1) + ' / ' + qs.length; const { c, t } = qs[i];
      const next = ok => { if (ok) score++; else wrong.push(c); i++; step(); };
      if (t === 'mc') askMC(c, l, ctx, ok => next(ok));
      else if (t === 'tf') {
        const real = Math.random() < .5, other = shuf(l.filter(x => x.id !== c.id))[0] || c, shown = real ? c.a : other.a;
        shell(head(ctx.title, ctx.sub), '<div class="flash" style="min-height:120px;margin-top:10px;flex-direction:column"><div class="mute small">True or false? The answer to</div><b>' + esc(c.q) + '</b><div class="mute small">is</div><div>' + esc(shown) + '</div></div><div class="grade"><button data-v="1">True</button><button data-v="0">False</button></div>');
        $('sx').onclick = ctx.exit; root.querySelectorAll('[data-v]').forEach(b => b.onclick = () => next((b.dataset.v === '1') === (shown === c.a || norm(shown) === norm(c.a))));
      } else {
        shell(head(ctx.title, ctx.sub), '<div class="flash" style="min-height:110px;margin-top:10px">' + esc(c.q) + '</div><input id="ty" type="text" autocomplete="off" placeholder="Type your answer..."><div class="row" style="margin-top:8px"><span class="sp"></span><button class="pri" id="ck">Next</button></div>');
        $('sx').onclick = ctx.exit; $('ty').focus(); const go = () => next(same($('ty').value, c.a)); $('ck').onclick = go; $('ty').onkeydown = e => { if (e.key === 'Enter') go(); };
      }
    };
    step();
  }

  /* ---------------- match ---------------- */
  function match(d) {
    const l = shuf(inDeck(d)).slice(0, 6), tiles = shuf(l.flatMap(c => [{ id: c.id, t: c.q, k: 'q' }, { id: c.id, t: c.a, k: 'a' }]));
    shell(head('Match - ' + d, '<span id="tm">0.0s</span> <span class="mute" id="best"></span>'), '<div class="grid2" id="mg" style="margin-top:10px">' + tiles.map((x, i) => '<div class="tile" data-i="' + i + '">' + esc(x.t.length > 90 ? x.t.slice(0, 88) + '...' : x.t) + '</div>').join('') + '</div>');
    $('sx').onclick = () => { clearInterval(tt); deckPage(d); };
    const key = 'match_' + d, best = +ls.get(key, '0'); if (best) $('best').textContent = '(best ' + best.toFixed(1) + 's)';
    const t0 = Date.now(); const tt = setInterval(() => { if (!$('tm')) return clearInterval(tt); $('tm').textContent = ((Date.now() - t0) / 1000).toFixed(1) + 's'; }, 100);
    let sel = null, left = l.length;
    root.querySelectorAll('.tile').forEach(el => el.onclick = () => {
      if (el.classList.contains('done')) return; const x = tiles[+el.dataset.i];
      if (!sel) { sel = el; el.classList.add('sel'); return; } if (sel === el) { el.classList.remove('sel'); sel = null; return; }
      const y = tiles[+sel.dataset.i];
      if (x.id === y.id && x.k !== y.k) { el.classList.add('done'); sel.classList.add('done'); sel = null; if (--left === 0) { clearInterval(tt); const sec = (Date.now() - t0) / 1000; logDay(); const nb = !best || sec < best; if (nb) ls.set(key, String(sec)); inDeck(d).forEach(c => { if (l.some(z => z.id === c.id)) c.m = Math.min(MAXM, (c.m || 0) + 1); }); save(); done('Matched in ' + sec.toFixed(1) + ' s', nb ? 'New best time!' : 'Best: ' + best.toFixed(1) + ' s', d); } }
      else { const s = sel; s.classList.remove('sel'); s.classList.add('no'); el.classList.add('no'); setTimeout(() => { s.classList.remove('no'); el.classList.remove('no'); }, 350); sel = null; }
    });
  }

  /* ---------------- write / spell ---------------- */
  function typedSession(d, title, speak) {
    const l = inDeck(d); let q = shuf(l), right = 0, n = 0; const ctx = { title: title + ' - ' + d, exit: () => { save(); deckPage(d); }, sub: '' }; const total = q.length;
    const step = () => {
      if (!q.length) { logDay(); save(); return done(title + ' complete', right + ' of ' + n + ' correct.', d); }
      ctx.sub = (total - q.length) + ' / ' + total; const c = q.shift();
      askType(c, ctx, ok => { n++; if (ok) { right++; c.m = Math.min(MAXM, (c.m || 0) + 1); } else { c.m = 0; } step(); }, speak);
    };
    step();
  }
  const write = d => typedSession(d, 'Write', false), spell = d => typedSession(d, 'Spell', true);

  /* ---------------- AI card creation ---------------- */
  async function make(text, deck) {
    text = (text || '').trim(); if (text.length < 40) return A.toast('Give me a bit more text to work with');
    const st = $('sst'); if (st) st.textContent = 'writing cards (20-60 seconds)...'; A.toast('MOUNDSHROUD is writing flashcards...', 3000);
    const prompt = 'Create 8 to 14 flashcards from the text below. Reply with ONLY a JSON array, no other words. Each item: {"q":"short question or term","a":"short, clear answer"}. Cover the most important facts.\n\nTEXT:\n' + text.slice(0, 7000);
    let out = '';
    try { const r = await fetch('/api/chat', { method: 'POST', body: JSON.stringify({ model: $('model').value, stream: false, think: false, keep_alive: '3m', format: 'json', messages: [{ role: 'user', content: prompt }] }) }); const j = await r.json(); out = (j.message && j.message.content) || ''; }
    catch (e) { A.toast('The AI engine did not answer'); if (st) st.textContent = ''; return; }
    let arr = []; try { const v = JSON.parse(out); arr = Array.isArray(v) ? v : (v.flashcards || v.cards || Object.values(v).find(Array.isArray) || []); } catch (e) { const m = out.match(/\[[\s\S]*\]/); if (m) try { arr = JSON.parse(m[0]); } catch (x) {} }
    arr = arr.filter(c => c && c.q && c.a).slice(0, 20);
    if (!arr.length) { A.toast('That did not work - try again or use a shorter passage', 4000); if (st) st.textContent = ''; return; }
    arr.forEach(c => cards.push(newCard(deck, c.q, c.a))); await save(); A.toast(arr.length + ' cards added to "' + deck + '"'); A.showTab('study'); deckPage(deck);
  }

  A.study = {
    home: () => { load().then(home); },
    deckText: d => inDeck(d).map(c => c.q + ': ' + c.a).join('\n'),
    decks: () => decks(),
    async addCards(deck, list) { await load(); list.forEach(c => cards.push(newCard(deck, c.q, c.a))); await save(); },
    fromText(text, deck) {
      text = (text || '').trim(); if (!text) return A.toast('Nothing to turn into cards');
      A.showTab('study'); load().then(() => { home(); $('stext').value = text.slice(0, 7000); $('stitle').value = (deck || 'New deck').slice(0, 40); make(text, deck || 'New deck'); });
    }
  };
  A.registerTab('study', 'Study', async () => { await load(); deckSel ? deckPage(deckSel) : home(); });
})();

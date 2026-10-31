// Prepare > Recipes: thousands of recipes from public-domain cookbooks (1800s-1920s) stored on this PC. Search by name or by what is in your pantry, browse by kind, save favourites, ask Moundshroud to modernize one.
(() => {
  const P = A.prep; if (!P) return;
  const esc2 = s => String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const rd = (k, d) => { try { return JSON.parse(ls.get(k, JSON.stringify(d))); } catch (e) { return d; } }, wr = (k, v) => { try { ls.set(k, JSON.stringify(v)); } catch (e) { } };
  let DB = null, DBP = null, host = null, tokv = 0;
  let fav = rd('rec_fav', []), recent = rd('rec_recent', []), state = { q: '', cat: '', book: '', pantry: '', mode: 'browse', page: 0, open: null };
  const PAGE = 40, STOP = new Set('a an the of and or with in on to for from is are be as at by it its this that into your use then until add put let take make one two three four five six seven eight nine ten half cup cups teaspoon teaspoonful tablespoon tablespoonful tablespoonfuls pint pints quart quarts pound pounds ounce ounces little much well very cold hot warm done time minutes minute hour hours when will can may should any all each some more'.split(' '));
  const CAT_ICON = { 'Soups & stews': '🍲', 'Breads, rolls & biscuits': '🍞', 'Cakes & cookies': '🍰', 'Pies & pastry': '🥧', 'Desserts & puddings': '🍮', 'Preserves, canning & pickles': '🫙', 'Beverages': '🥤', 'Meat & game': '🥩', 'Poultry': '🍗', 'Fish & seafood': '🐟', 'Eggs & cheese': '🥚', 'Vegetables & salads': '🥗', 'Sauces & dressings': '🥫', 'Camp & outdoor cooking': '🏕️', 'Invalid & sick-room': '🩹', 'Other': '🍽️' };
  const load = () => DBP || (DBP = fetch('/web/data/recipes.json').then(r => r.json()).then(j => { DB = j; j.bk = {}; j.books.forEach(b => { j.bk[b.id] = b; }); j.cats = {}; j.recipes.forEach(r => { j.cats[r.k] = (j.cats[r.k] || 0) + 1; r._t = r.t.toLowerCase(); r._x = null; }); return j; }));
  const body = r => (r._x == null ? (r._x = r.x.toLowerCase()) : r._x);
  const saveFav = () => wr('rec_fav', fav), saveRec = () => wr('rec_recent', recent);
  const toks = q => q.toLowerCase().replace(/[^a-z0-9' ]/g, ' ').split(/\s+/).filter(w => w.length > 1 && !STOP.has(w));
  const stem = w => w.length > 4 ? w.replace(/(ies)$/, 'y').replace(/(es|s)$/, '') : w.replace(/s$/, '');

  function find() {
    let list = DB.recipes; if (state.cat) list = list.filter(r => r.k === state.cat); if (state.book) list = list.filter(r => r.b === state.book);
    if (state.mode === 'favs') return list.filter(r => fav.includes(r.i));
    const T = toks(state.q), PAN = state.pantry.split(/[,\n]/).map(s => stem(s.trim().toLowerCase())).filter(s => s.length > 1);
    if (!T.length && !PAN.length) return list;
    const out = [];
    for (const r of list) {
      let sc = 0, ok = true;
      for (const w of T) { const s = stem(w); if (r._t.includes(w)) sc += 10 + (r._t.startsWith(w) ? 3 : 0); else if (r._t.includes(s)) sc += 8; else if (body(r).includes(w) || body(r).includes(s)) sc += 2; else { ok = false; break; } }
      if (!ok) continue;
      if (PAN.length) { const b = body(r); let hit = 0; for (const p of PAN) if (b.includes(p)) hit++; if (hit < Math.min(PAN.length, 1)) continue; sc += hit * 6 - (PAN.length - hit) * 1.5; if (hit < PAN.length && PAN.length > 2 && hit < PAN.length / 2) continue; r._hit = hit; }
      out.push([sc - Math.min(r.x.length, 2500) / 1500, r]);
    }
    out.sort((a, b) => b[0] - a[0]); return out.map(x => x[1]);
  }

  function card(r) {
    const b = DB.bk[r.b]; return '<div class="fa-card rc" data-r="' + r.i + '" style="cursor:pointer;margin:0;padding:10px 12px"><div class="row" style="gap:8px;align-items:flex-start"><div style="flex:1;min-width:0"><b>' + (fav.includes(r.i) ? '⭐ ' : '') + esc2(r.t) + '</b><div class="small mute">' + (CAT_ICON[r.k] || '') + ' ' + esc2(r.k) + ' · ' + esc2(b ? b.t.replace(/^The /, '').slice(0, 40) : '') + (b && b.y ? ' (' + esc2(b.y) + ')' : '') + '</div><div class="small" style="opacity:.8;margin-top:3px;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden">' + esc2(r.x.slice(0, 170)) + '</div>' + (r._hit && state.pantry ? '<div class="small ok" style="margin-top:3px">uses ' + r._hit + ' of your ingredients</div>' : '') + '</div></div></div>';
  }
  function view(r) {
    const b = DB.bk[r.b] || {}, paras = r.x.split(/\n+/).filter(Boolean);
    return '<div class="fa-wrap"><div class="row" style="gap:8px;margin-bottom:10px;flex-wrap:wrap"><button class="ib" id="rback">‹ Recipes</button><span class="sp"></span><button class="ib" id="rfav">' + (fav.includes(r.i) ? '⭐ Saved' : '☆ Save') + '</button><button class="ib" id="rcopy">Copy</button><button class="ib" id="rprint">Print</button></div>' +
      '<div class="fa-card" style="padding:18px 22px"><div class="small mute">' + (CAT_ICON[r.k] || '') + ' ' + esc2(r.k) + (r.c ? ' · ' + esc2(r.c) : '') + '</div><h2 style="margin:4px 0 10px">' + esc2(r.t) + '</h2><div id="rtext" style="font-size:16px;line-height:1.7;font-family:Georgia,serif">' + paras.map(p => '<p style="margin:0 0 .8em">' + esc2(p) + '</p>').join('') + '</div><div class="small mute" style="margin-top:12px">From <i>' + esc2(b.t || '') + '</i>' + (b.a ? ', ' + esc2(b.a) : '') + (b.y ? ' (' + esc2(b.y) + ')' : '') + '. Public domain (Project Gutenberg #' + esc2(b.pg || '') + '). Old recipes use old measures and sometimes old food-safety ideas.</div></div>' +
      '<div class="fa-card"><b>✨ Ask Moundshroud</b><div class="row" style="gap:8px;margin-top:8px;flex-wrap:wrap"><button class="pri" data-ra="modern">Rewrite for a modern kitchen</button><button class="ib" data-ra="metric">Convert to cups, grams & oven temps</button><button class="ib" data-ra="subs">What can I substitute?</button><button class="ib" data-ra="scale">Scale for a crowd</button><button class="ib" data-ra="safe">Is this safe by today\'s standards?</button></div></div></div>';
  }
  const prompts = {
    modern: 'Rewrite this old recipe for a modern home kitchen. Give a clear ingredient list with modern measures (cups, spoons, grams) and numbered steps, with oven temperature and times. Keep the character of the dish and note anything you had to guess.',
    metric: 'Convert every measure and temperature in this old recipe to modern US cups/spoons and also metric grams/ml, with oven temperatures in F and C. Keep the original wording of the method but list the converted ingredients first.',
    subs: 'List the ingredients in this old recipe and suggest practical modern substitutions for any that are hard to find or outdated (for example suet, saleratus, isinglass, fresh yeast cakes), plus pantry-emergency substitutes.',
    scale: 'Rewrite this recipe in modern measures and scale it to feed 20 people, with a shopping list and a timing plan.',
    safe: 'Review this old recipe for food-safety problems by today\'s standards (raw eggs, canning methods, meat temperatures, preserving, fermentation) and tell me how to make it safely.'
  };

  function draw() {
    if (state.open) { const r = DB.recipes.find(x => x.i === state.open); if (r) return showRecipe(r); }
    const L = find(), total = L.length, pg = Math.min(state.page, Math.max(0, Math.ceil(total / PAGE) - 1)), shown = L.slice(pg * PAGE, pg * PAGE + PAGE), cats = DB.cats;
    host.innerHTML = '<div class="fa-wrap"><div class="small mute" style="margin-bottom:8px">' + DB.recipes.length.toLocaleString() + ' recipes from ' + DB.books.length + ' public-domain cookbooks, stored on this PC. Old recipes: measures and techniques differ from today. Use Moundshroud to modernize.</div>' +
      '<div class="row" style="gap:8px;flex-wrap:wrap;margin-bottom:8px"><input type="text" id="rq" placeholder="Search recipes (apple pie, biscuits, venison, no-bake)" style="flex:1;min-width:220px" value="' + esc2(state.q) + '"><button class="pri" id="rgo">Search</button><button class="ib" id="rsurp">🎲 Surprise me</button><button class="ib' + (state.mode === 'favs' ? ' on' : '') + '" id="rfavs">⭐ Saved (' + fav.length + ')</button></div>' +
      '<div class="row" style="gap:8px;flex-wrap:wrap;margin-bottom:8px;align-items:center"><span class="small mute">🥕 What\'s in the pantry?</span><input type="text" id="rpan" placeholder="flour, eggs, apples, molasses" style="flex:1;min-width:220px" value="' + esc2(state.pantry) + '"><select id="rbook"><option value="">All cookbooks</option>' + DB.books.map(b => '<option value="' + b.id + '"' + (state.book === b.id ? ' selected' : '') + '>' + esc2(b.t.slice(0, 48)) + '</option>').join('') + '</select></div>' +
      '<div class="row" style="gap:6px;flex-wrap:wrap;margin-bottom:12px"><button class="ib' + (!state.cat ? ' on' : '') + '" data-cat="">All</button>' + Object.keys(cats).sort((a, b) => cats[b] - cats[a]).map(k => '<button class="ib' + (state.cat === k ? ' on' : '') + '" data-cat="' + esc2(k) + '">' + (CAT_ICON[k] || '') + ' ' + esc2(k) + ' <span class="mute small">' + cats[k] + '</span></button>').join('') + '</div>' +
      (recent.length && !state.q && !state.pantry && !state.cat && !state.book && state.mode === 'browse' ? '<div class="small mute" style="margin-bottom:4px">Recently opened</div><div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(260px,1fr));gap:8px;margin-bottom:14px">' + recent.slice(0, 4).map(i => DB.recipes.find(r => r.i === i)).filter(Boolean).map(card).join('') + '</div>' : '') +
      '<div class="small mute" style="margin-bottom:6px">' + total.toLocaleString() + ' recipe' + (total === 1 ? '' : 's') + (state.mode === 'favs' ? ' saved' : '') + '</div><div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(260px,1fr));gap:8px">' + (shown.map(card).join('') || '<div class="mute">Nothing found. Try fewer words, or one ingredient at a time.</div>') + '</div>' +
      (total > PAGE ? '<div class="row" style="gap:8px;margin:12px 0;align-items:center"><button class="ib" id="rpp"' + (pg === 0 ? ' disabled' : '') + '>‹ Previous</button><span class="small mute" style="flex:1;text-align:center">Page ' + (pg + 1) + ' of ' + Math.ceil(total / PAGE) + '</span><button class="ib" id="rpn"' + (pg >= Math.ceil(total / PAGE) - 1 ? ' disabled' : '') + '>Next ›</button></div>' : '') +
      '<div class="fa-card" style="margin-top:14px"><b>More cooking help</b><div class="small mute" style="margin:2px 0 8px">Cooking Q&A and the Wikibooks Cookbook are in the Library tab if you downloaded them. Or ask the AI.</div><div class="row" style="gap:8px;flex-wrap:wrap"><input type="text" id="rask" placeholder="e.g. How do I make bread without yeast?" style="flex:1;min-width:220px"><button class="pri" id="raskgo">Ask Moundshroud</button></div></div></div>';
    const $ = id => document.getElementById(id), go = () => { state.q = $('rq').value; state.pantry = $('rpan').value; state.page = 0; state.mode = 'browse'; draw(); const e = $('rq'); if (e) e.focus(); };
    $('rgo').onclick = go; $('rq').onkeydown = e => { e.stopPropagation(); if (e.key === 'Enter') go(); }; $('rpan').onkeydown = e => { e.stopPropagation(); if (e.key === 'Enter') go(); };
    $('rbook').onchange = () => { state.book = $('rbook').value; state.page = 0; draw(); }; $('rfavs').onclick = () => { state.mode = state.mode === 'favs' ? 'browse' : 'favs'; state.page = 0; draw(); };
    $('rsurp').onclick = () => { const pool = (state.cat ? DB.recipes.filter(r => r.k === state.cat) : DB.recipes).filter(r => r.x.length > 250); showRecipe(pool[Math.floor(Math.random() * pool.length)]); };
    if ($('rpp')) { $('rpp').onclick = () => { state.page = pg - 1; draw(); host.parentElement.scrollTop = 0; }; $('rpn').onclick = () => { state.page = pg + 1; draw(); host.parentElement.scrollTop = 0; }; }
    const qa = () => { const v = $('rask').value.trim(); if (v) { A.showTab('chat'); A.chat.ask('Answer this cooking question with clear practical steps, quantities and safety notes where relevant: ' + v, { noLocal: true, sources: [] }); } }; $('raskgo').onclick = qa; $('rask').onkeydown = e => { e.stopPropagation(); if (e.key === 'Enter') qa(); };
  }
  function showRecipe(r) {
    state.open = r.i; recent = [r.i, ...recent.filter(i => i !== r.i)].slice(0, 12); saveRec(); host.innerHTML = view(r); host.parentElement.scrollTop = 0;
    const $ = id => document.getElementById(id); $('rback').onclick = () => { state.open = null; draw(); };
    $('rfav').onclick = () => { const k = fav.indexOf(r.i); if (k >= 0) fav.splice(k, 1); else fav.push(r.i); saveFav(); $('rfav').textContent = fav.includes(r.i) ? '⭐ Saved' : '☆ Save'; };
    $('rcopy').onclick = () => A.copy(r.t + '\n\n' + r.x + '\n\n(' + (DB.bk[r.b] ? DB.bk[r.b].t : '') + ')');
    $('rprint').onclick = () => { const w = window.open('', '_blank'); if (!w) { A.toast('Allow pop-ups to print'); return; } w.document.write('<title>' + esc2(r.t) + '</title><body style="font:16px Georgia,serif;max-width:640px;margin:30px auto;line-height:1.6"><h1>' + esc2(r.t) + '</h1>' + r.x.split(/\n+/).map(p => '<p>' + esc2(p) + '</p>').join('') + '<p style="color:#666;font-size:12px">' + esc2(DB.bk[r.b] ? DB.bk[r.b].t : '') + '</p>'); w.document.close(); w.print(); };
    host.querySelectorAll('[data-ra]').forEach(b => { b.onclick = () => { A.showTab('chat'); A.chat.ask(prompts[b.dataset.ra] + '\n\nRECIPE: ' + r.t + '\n' + r.x.slice(0, 4000), { noLocal: true, sources: [] }); }; });
  }

  P.sections.recipes = async (b, tok) => {
    b.innerHTML = '<div class="scroll pad" style="flex:1"><div id="rbody"><div class="mute">Loading recipes...</div></div></div>'; host = b.querySelector('#rbody');
    try { await load(); } catch (e) { host.innerHTML = '<div class="bad">The recipes could not be loaded (web/data/recipes.json).</div>'; return; } if (tok !== P.tok()) return;
    state.open = null; draw();
    b.onclick = e => { const c = e.target.closest('[data-cat]'); if (c) { state.cat = c.dataset.cat; state.page = 0; draw(); return; } const r = e.target.closest('[data-r]'); if (r) { const rec = DB.recipes.find(x => x.i === r.dataset.r); if (rec) showRecipe(rec); } };
  };
  P.recipes = { search: q => load().then(() => { state.q = q; state.mode = 'browse'; state.cat = state.book = state.pantry = ''; return find().slice(0, 20); }) };
})();

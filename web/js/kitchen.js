// Kitchen: a weekly meal planner, a pantry, an automatic shopping list, and the 8,000 old cookbook recipes (the old Prepare > Recipes page was removed as a duplicate).
// Everything is stored on this PC (ls kit_pantry, kit_plan, kit_shop; favourites are shared with Prepare: rec_fav).
(() => {
  const root = document.getElementById('p-kitchen'); if (!root) return;
  const esc2 = s => String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c])), pad = n => String(n).padStart(2, '0');
  const rd = (k, d) => { try { return JSON.parse(ls.get(k, JSON.stringify(d))); } catch (e) { return d; } }, wr = (k, v) => ls.set(k, JSON.stringify(v));
  const dkey = d => d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()), addD = (d, n) => new Date(d.getFullYear(), d.getMonth(), d.getDate() + n), parseKey = k => { const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(k); return m ? new Date(+m[1], +m[2] - 1, +m[3]) : new Date(); };
  const STAPLES = ['flour', 'sugar', 'salt', 'pepper', 'butter', 'eggs', 'milk', 'rice', 'potatoes', 'onions', 'garlic', 'carrots', 'beans', 'oats', 'olive oil', 'tomatoes', 'cheese', 'bread', 'chicken', 'beef', 'apples', 'honey'];
  const MEALS = [['b', 'Breakfast'], ['l', 'Lunch'], ['d', 'Dinner']], UNITS = 'cup|cups|tablespoon|tablespoons|teaspoon|teaspoons|tablespoonful|tablespoonfuls|teaspoonful|teaspoonfuls|pint|pints|quart|quarts|gallon|pound|pounds|lb|lbs|ounce|ounces|oz|gill|gills|dozen|pinch|dash|slice|slices|clove|cloves|head|bunch|can|cans|stick|sticks|loaf|loaves|handful';
  const STOP = new Set('a an the of and or with in on to for from is are be as at by it its this that into your use then until add put let take make one two three four five six seven eight nine ten half cup cups teaspoon teaspoonful tablespoon tablespoonful tablespoonfuls pint pints quart quarts pound pounds ounce ounces little much well very cold hot warm done time minutes minute hour hours when will can may should any all each some more'.split(' '));
  const stem = w => w.length > 4 ? w.replace(/(ies)$/, 'y').replace(/(es|s)$/, '') : w.replace(/s$/, '');
  let DB = null, DBP = null, st = { tab: 'plan', week: dkey(new Date()), q: '', cat: '', res: [], page: 0 }, pantry = rd('kit_pantry', []), plan = rd('kit_plan', {}), shop = rd('kit_shop', []), fav = rd('rec_fav', []);
  const loadDB = () => DBP || (DBP = fetch('/web/data/recipes.json').then(r => r.json()).then(j => { DB = j; j.bk = {}; (j.books || []).forEach(b => { j.bk[b.id] = b; }); j.cats = {}; j.recipes.forEach(r => { j.cats[r.k] = (j.cats[r.k] || 0) + 1; r._t = r.t.toLowerCase(); r._x = null; r._i = null; }); return j; }));
  const bodyOf = r => (r._x == null ? (r._x = r.x.toLowerCase()) : r._x);
  const css = '.kt-wrap{max-width:1100px;margin:0 auto}.kt-card{background:var(--panel);border:1px solid var(--line);border-radius:14px;padding:12px 14px;margin:0 0 12px}.kt-days{display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:8px}.kt-day{background:var(--panel);border:1px solid var(--line);border-radius:12px;padding:8px}.kt-day.today{border-color:var(--acc)}.kt-slot{font-size:11px;letter-spacing:.05em;text-transform:uppercase;color:var(--mute);margin-top:6px}.kt-it{font-size:12.5px;border-radius:7px;background:var(--panel2);padding:3px 7px;margin:2px 0;display:flex;gap:5px;align-items:center;cursor:default}.kt-it a{flex:1;cursor:pointer}.kt-it a:hover{text-decoration:underline}.kt-x{cursor:pointer;color:var(--mute)}.kt-chip{display:inline-block;padding:3px 10px;border:1px solid var(--line);border-radius:99px;margin:2px 4px 2px 0;font-size:12.5px;cursor:pointer}.kt-chip:hover{border-color:var(--acc)}.kt-r{padding:9px 11px;border-bottom:1px solid var(--line);cursor:pointer}.kt-r:hover{background:var(--panel2)}';
  if (!document.getElementById('ktcss')) { const s = document.createElement('style'); s.id = 'ktcss'; s.textContent = css; document.head.appendChild(s); }
  const sv = { plan: () => wr('kit_plan', plan), pantry: () => wr('kit_pantry', pantry), shop: () => wr('kit_shop', shop) };
  const inPantry = line => { const t = line.toLowerCase(); return pantry.some(p => { const s = stem(p.n.toLowerCase()); return s.length > 2 && t.includes(s); }); };

  /* ---------- finding recipes ---------- */
  function find(q, cat, usePantry) {
    const T = q.toLowerCase().replace(/[^a-z0-9' ]/g, ' ').split(/\s+/).filter(w => w.length > 1 && !STOP.has(w)), PAN = usePantry ? pantry.map(p => stem(p.n.toLowerCase())).filter(s => s.length > 2) : [];
    let list = DB.recipes; if (cat) list = list.filter(r => r.k === cat); if (!T.length && !PAN.length) return list;
    const out = [];
    for (const r of list) {
      let sc = 0, ok = true;
      for (const w of T) { const s = stem(w); if (r._t.includes(w)) sc += 10 + (r._t.startsWith(w) ? 3 : 0); else if (r._t.includes(s)) sc += 8; else if (bodyOf(r).includes(w) || bodyOf(r).includes(s)) sc += 2; else { ok = false; break; } }
      if (!ok) continue;
      if (PAN.length) { const b = bodyOf(r); let hit = 0; for (const p of PAN) if (b.includes(p)) hit++; if (hit < Math.min(3, PAN.length)) continue; sc += hit * 5 - (PAN.length - hit) * 0.4; r._hit = hit; }
      out.push([sc - Math.min(r.x.length, 2500) / 1500, r]);
    }
    out.sort((a, b) => b[0] - a[0]); return out.map(x => x[1]);
  }
  /* ingredients: the old cookbooks write them as running text ("1 cup of butter, one cup of sugar, 2 eggs"), so find "amount + unit + food" and "number + food" phrases */
  const NUMW = 'one|two|three|four|five|six|seven|eight|nine|ten|twelve|half|a|an', UNITX = UNITS + '|teacupful|teacupfuls|cupful|cupfuls|spoonful|spoonfuls|wineglassful|wineglassfuls|saltspoonful|saltspoonfuls|teacup|teacups|tumblerful|quarts|peck|bushel', NOTFOOD = /^(?:persons?|people|glass(?:es)?|servings?|gallons?|minutes?|hours?|days?|inch(?:es)?|degrees?|times?|ways?|sides?|pieces?|parts?|more|less|other|half|inches|seconds?|hundred|thousand|cups?|ounces?)$/i;
  const AMT = '(?:\\d+\\s+\\d+\\/\\d+|\\d+\\/\\d+|\\d+(?:\\.\\d+)?\\s?[½¼¾⅓⅔⅛]?|[½¼¾⅓⅔⅛]|(?:' + NUMW + '))(?:\\s+and\\s+(?:a\\s+)?(?:half|quarter|third)|\\s*-\\s*\\d+)?';
  const STOPW = '(?:and|then|to|in|into|with|until|for|add|mix|stir|beat|cream|cut|put|set|pour|bake|boil|cook|sift|stand|let|when|or|but|over|on|from|about|well|fry|stew|simmer|melt|chop|mince|slice|rub|dredge|season|whip|drain|each|every|if|which|that|as|at|by|of)';
  const FOODW = '[a-z][a-z’\'-]*', END = '(?=\\s*(?:[,.;:)(]|$)|\\s+(?=[\\d½¼¾⅓⅔⅛])|\\s+' + STOPW + '\\b)';
  const RE_U = new RegExp('(?<![A-Za-z0-9])(' + AMT + ')\\s+(?:(?:level|heaping|heaped|scant|rounded|good|generous|large|small|medium|full)\\s+)?((?:' + UNITX + '))(?:\\s+of)?\\s+(' + FOODW + '(?:\\s+' + FOODW + '){0,3}?)' + END, 'gi');
  const RE_N = new RegExp('(?:^|[\\s,.;:(])(\\d+(?:\\s+\\d+\\/\\d+)?|' + NUMW.replace('|a|an', '') + ')\\s+(?:large\\s+|small\\s+|medium\\s+|fresh\\s+|ripe\\s+)?(' + FOODW + '(?:\\s+' + FOODW + '){0,2}?)' + END, 'gi');
  const ingredientsOf = r => {
    const txt = r.x.replace(/\s*\n+\s*/g, '. ').slice(0, 1800), out = [], seen = new Set(); let m;
    const push = s => { s = s.replace(/\s+/g, ' ').trim(); const k = s.toLowerCase(); if (s.length > 3 && s.length < 70 && !seen.has(k)) { seen.add(k); out.push(s); } };
    RE_U.lastIndex = 0; while ((m = RE_U.exec(txt)) && out.length < 30) { if (/^(?:and|or|the|it|them|this|these|those|until|when|as)$/i.test(m[3].split(' ')[0])) continue; push(m[0].trim()); }
    RE_N.lastIndex = 0; while ((m = RE_N.exec(txt)) && out.length < 30) { const food = m[2].split(' ')[0]; if (NOTFOOD.test(food) || new RegExp('^(?:' + UNITX + ')$', 'i').test(food) || /^(?:and|or|the|it|them|until|when|as|tablespoons?|teaspoons?)$/i.test(food)) continue; const s = (m[1] + ' ' + m[2]).trim(); if (!out.some(o => o.toLowerCase().includes(m[2].toLowerCase().split(' ')[0]))) push(s); }
    return out;
  };  const FR = { '½': .5, '¼': .25, '¾': .75, '⅓': 1 / 3, '⅔': 2 / 3, '⅛': .125 };
  const nice = v => { const w = Math.floor(v + 1e-6), f = v - w, fr = [[0, ''], [.125, '⅛'], [.25, '¼'], [1 / 3, '⅓'], [.5, '½'], [2 / 3, '⅔'], [.75, '¾'], [1, '']].reduce((a, b) => Math.abs(b[0] - f) < Math.abs(a[0] - f) ? b : a); const ww = fr[0] === 1 ? w + 1 : w; return (ww ? ww : '') + (ww && fr[1] ? ' ' : '') + fr[1] || '0'; };
  const scaleText = (text, k) => k === 1 ? text : text.replace(new RegExp('(\\d+\\s+\\d+/\\d+|\\d+/\\d+|\\d*\\.?\\d+\\s?[½¼¾⅓⅔⅛]|[½¼¾⅓⅔⅛]|\\d+(?:\\.\\d+)?)(\\s*(?:' + UNITS + ')\\b)', 'gi'), (m, n, u) => { let v; if (/^\d+\s+\d+\/\d+$/.test(n)) { const p = n.split(/\s+/), f = p[1].split('/'); v = +p[0] + f[0] / f[1]; } else if (/^\d+\/\d+$/.test(n)) { const f = n.split('/'); v = f[0] / f[1]; } else if (/[½¼¾⅓⅔⅛]/.test(n)) { const mm = /^(\d*\.?\d*)\s?([½¼¾⅓⅔⅛])?$/.exec(n.trim()); v = (+mm[1] || 0) + (FR[mm[2]] || 0); } else v = parseFloat(n); return isFinite(v) ? nice(v * k) + u : m; });

  /* ---------- drawing ---------- */
  const tabs = [['plan', '🗓️ Meal planner'], ['pantry', '🥫 Pantry'], ['shop', '🛒 Shopping list'], ['rec', '📖 Recipes']];
  function shell(inner) {
    root.innerHTML = '<div class="scroll pad" style="flex:1"><div class="kt-wrap"><div class="row" style="gap:8px;flex-wrap:wrap;margin-bottom:12px"><h2 style="margin:0;margin-right:10px">🍳 Kitchen</h2>' + tabs.map(t => '<button class="ib' + (st.tab === t[0] ? ' on' : '') + '" data-tab="' + t[0] + '">' + t[1] + (t[0] === 'shop' && shop.filter(x => !x.done).length ? ' (' + shop.filter(x => !x.done).length + ')' : '') + '</button>').join('') + '<span style="flex:1"></span><button class="ib" id="ktask" title="Ask Moundshroud">🧠 Ask</button></div>' + inner + '</div></div>';
    root.querySelector('#ktask').onclick = () => { if (A.askAll) A.askAll.open(''); };
  }
  function drawPlan() {
    const start = parseKey(st.week), mon = addD(start, -((start.getDay() + 6) % 7)), today = dkey(new Date());
    shell('<div class="row" style="gap:8px;margin-bottom:10px;flex-wrap:wrap"><button class="ib" data-w="-7">◀</button><b>' + mon.toLocaleDateString([], { month: 'short', day: 'numeric' }) + ' - ' + addD(mon, 6).toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' }) + '</b><button class="ib" data-w="7">▶</button><button class="ib" data-w="0">This week</button><span style="flex:1"></span><button class="ib" data-a="surprise">🎲 Surprise me (dinners from my pantry)</button><button class="ib" data-a="plan2shop">🛒 Add this week\'s ingredients to the shopping list</button></div><div class="kt-days">' +
      Array.from({ length: 7 }, (_, i) => { const d = addD(mon, i), k = dkey(d), p = plan[k] || {}; return '<div class="kt-day' + (k === today ? ' today' : '') + '"><b>' + d.toLocaleDateString([], { weekday: 'short' }) + '</b> <span class="small mute">' + d.getDate() + '</span>' + MEALS.map(([m, l]) => '<div class="kt-slot">' + l + ' <span class="kt-x" data-add="' + k + ':' + m + '" title="Add">＋</span></div>' + (p[m] || []).map((it, j) => '<div class="kt-it"><a data-view="' + esc2(it.rid || '') + '" data-free="' + (it.rid ? '' : esc2(it.t)) + '">' + esc2(it.t) + '</a><span class="kt-x" data-del="' + k + ':' + m + ':' + j + '">✕</span></div>').join('')).join('') + '</div>'; }).join('') + '</div>' +
      '<div class="small mute" style="margin-top:10px">Press ＋ to add a recipe or your own meal. Click a recipe to read it. Ingredients are found in the old cookbook text, so check the list before shopping.</div>');
  }
  function drawPantry() {
    shell('<div class="kt-card"><b>🥫 What is in the kitchen</b><div class="small mute" style="margin:2px 0 8px">Tell Moundshroud what you have and it finds recipes you can make, and leaves those items off the shopping list.</div><div class="row" style="gap:8px"><input id="ktpn" type="text" placeholder="Add items: eggs, flour, 2 onions, rice..." style="flex:1;padding:8px 12px"><input id="ktpe" type="date" title="Use by (optional)"><button class="pri" id="ktpa">Add</button></div><div style="margin-top:8px">' + STAPLES.map(s => '<span class="kt-chip" data-staple="' + s + '">+ ' + s + '</span>').join('') + '</div></div>' +
      '<div class="kt-card">' + (pantry.length ? pantry.slice().sort((a, b) => (a.exp || '9') < (b.exp || '9') ? -1 : 1).map(p => { const soon = p.exp && (parseKey(p.exp) - Date.now()) / 864e5 < 4; return '<span class="kt-chip" style="' + (soon ? 'border-color:var(--warn);color:var(--warn)' : '') + '">' + esc2(p.n) + (p.exp ? ' <span class="small">(' + (parseKey(p.exp) < new Date(new Date().setHours(0, 0, 0, 0)) ? 'past use-by' : 'by ' + parseKey(p.exp).toLocaleDateString([], { month: 'short', day: 'numeric' })) + ')</span>' : '') + ' <span class="kt-x" data-pd="' + esc2(p.n) + '">✕</span></span>'; }).join('') + '<div style="margin-top:10px"><button class="pri" data-a="cookable">What can I cook?</button> <button class="ib" data-a="pclear">Clear the pantry</button></div>' : '<div class="mute small">Nothing yet. Add a few things above, or tap the quick-add buttons.</div>') + '</div>');
  }
  function drawShop() {
    shell('<div class="kt-card"><div class="row" style="gap:8px"><input id="ktsn" type="text" placeholder="Add to the list: milk, 2 loaves of bread..." style="flex:1;padding:8px 12px"><button class="pri" id="ktsa">Add</button></div></div><div class="kt-card">' + (shop.length ? shop.map((x, i) => '<div class="row" style="gap:8px;padding:6px 0;border-bottom:1px dashed var(--line);' + (x.done ? 'opacity:.5;text-decoration:line-through' : '') + '"><input type="checkbox" data-sd="' + i + '"' + (x.done ? ' checked' : '') + '><span style="flex:1">' + esc2(x.t) + (x.inp ? ' <span class="small mute" style="text-decoration:none">(you may have this)</span>' : '') + '</span><span class="kt-x" data-sx="' + i + '">✕</span></div>').join('') + '<div style="margin-top:10px" class="row"><button class="ib" data-a="sclear">Remove ticked items</button><button class="ib" data-a="scopy">Copy as text</button><button class="ib" data-a="sprint">Print</button><button class="ib" data-a="stopantry">Move ticked items to the pantry</button></div>' : '<div class="mute small">The list is empty. Add items, or open a recipe and press "Add ingredients to the shopping list".</div>') + '</div>');
  }
  async function drawRec(first) {
    shell('<div class="kt-card"><div class="row" style="gap:8px;flex-wrap:wrap"><input id="ktq" type="text" placeholder="Search recipes by name or ingredient: apple pie, cabbage soup..." value="' + esc2(st.q) + '" style="flex:1;min-width:220px;padding:8px 12px"><select id="ktc" class="ib"><option value="">All kinds</option></select><label class="small" style="display:flex;gap:4px;align-items:center"><input type="checkbox" id="ktp"' + (st.pan ? ' checked' : '') + '>use my pantry</label><button class="pri" id="ktg">Search</button></div></div><div id="ktres" class="kt-card" style="padding:0"><div class="mute small" style="padding:12px">Loading 8,000 recipes...</div></div>');
    await loadDB(); if (!document.getElementById('ktq')) return; const sel = root.querySelector('#ktc'); sel.innerHTML = '<option value="">All kinds</option>' + Object.keys(DB.cats).sort().map(c => '<option' + (st.cat === c ? ' selected' : '') + ' value="' + esc2(c) + '">' + esc2(c) + ' (' + DB.cats[c] + ')</option>').join('');
    const go = () => { st.q = root.querySelector('#ktq').value.trim(); st.cat = sel.value; st.pan = root.querySelector('#ktp').checked; st.res = find(st.q, st.cat, st.pan); st.page = 0; list(); };
    root.querySelector('#ktg').onclick = go; root.querySelector('#ktq').onkeydown = e => { e.stopPropagation(); if (e.key === 'Enter') go(); }; sel.onchange = go;
    if (first || !st.res.length) st.res = find(st.q, st.cat, st.pan); list();
  }
  function list() {
    const box = root.querySelector('#ktres'); if (!box) return; const PAGE = 30, arr = st.res, a = st.page * PAGE;
    box.innerHTML = '<div class="small mute" style="padding:8px 12px">' + arr.length.toLocaleString() + ' recipes' + (st.pan ? ' you could make with your pantry' : '') + '</div>' + arr.slice(a, a + PAGE).map(r => '<div class="kt-r" data-rid="' + esc2(r.i) + '"><b>' + esc2(r.t) + '</b> ' + (fav.includes(r.i) ? '⭐' : '') + '<div class="small mute">' + esc2(r.k) + ' · ' + esc2((DB.bk[r.b] || {}).t || (DB.bk[r.b] || {}).name || r.b) + (r._hit ? ' · ' + r._hit + ' of your items' : '') + '</div></div>').join('') + (arr.length > a + PAGE ? '<div style="padding:10px"><button class="ib" data-a="more">Show more</button></div>' : '');
  }
  const byId = id => DB && DB.recipes.find(r => r.i === id);
  async function view(id, free) {
    if (!id) { A.dlg('<b>' + esc2(free) + '</b><div class="small mute" style="margin:6px 0">Your own meal.</div><button class="ib" id="kvx">Close</button>'); document.getElementById('kvx').onclick = A.closeDlg; return; }
    await loadDB(); const r = byId(id); if (!r) return; let k = 1;
    const paint = () => {
      A.dlg('<div style="display:flex;flex-direction:column;gap:8px"><div class="row" style="align-items:flex-start;gap:8px"><div style="flex:1"><b style="font-size:18px">' + esc2(r.t) + '</b><div class="small mute">' + esc2(r.k) + ' · ' + esc2((DB.bk[r.b] || {}).t || (DB.bk[r.b] || {}).name || r.b) + '</div></div><button class="ib" id="kvf">' + (fav.includes(r.i) ? '⭐ Saved' : '☆ Save') + '</button><button class="ib" id="kvx">✕</button></div>' +
        '<div class="row" style="gap:6px;flex-wrap:wrap"><span class="small mute">Amounts</span>' + [[.5, '½×'], [1, '1×'], [2, '2×'], [3, '3×'], [4, '4×']].map(([v, l]) => '<button class="ib' + (k === v ? ' on' : '') + '" data-k="' + v + '">' + l + '</button>').join('') + '<button class="ib" id="kvp">📅 Add to the plan</button><button class="ib" id="kvs">🛒 Add ingredients to the shopping list</button><button class="ib" id="kvm">✨ Modernize with AI</button></div><div id="kvmod" class="small" style="display:none;white-space:pre-wrap;background:var(--panel2);border-radius:10px;padding:10px;line-height:1.55"></div>' +
        '<div style="white-space:pre-wrap;line-height:1.6;max-height:50vh;overflow:auto;font-size:14px">' + esc2(scaleText(r.x, k)) + '</div></div>', true);
      const q = id2 => document.getElementById(id2); q('kvx').onclick = A.closeDlg; q('kvf').onclick = () => { fav = fav.includes(r.i) ? fav.filter(x => x !== r.i) : fav.concat(r.i); wr('rec_fav', fav); q('kvf').textContent = fav.includes(r.i) ? '⭐ Saved' : '☆ Save'; };
      document.getElementById('dlg').querySelectorAll('[data-k]').forEach(b => { b.onclick = () => { k = +b.dataset.k; paint(); }; });
      q('kvs').onclick = () => { const ing = ingredientsOf(r); if (!ing.length) { A.toast('I could not pick out an ingredient list in this old recipe. Try ✨ Modernize.', 4500); return; } ing.forEach(l => { if (!shop.some(x => x.t.toLowerCase() === scaleText(l, k).toLowerCase())) shop.push({ t: scaleText(l, k), inp: inPantry(l), from: r.t }); }); sv.shop(); A.toast('Added ' + ing.length + ' items to the shopping list. Old recipes are written as running text, so check the list.', 5000); };
      q('kvp').onclick = () => { A.closeDlg(); pickSlot(r); };
      q('kvm').onclick = async () => { const o = q('kvmod'); o.style.display = 'block'; o.textContent = 'Asking Moundshroud...'; try { await A.ai.stream([{ role: 'system', content: 'You rewrite old cookbook recipes for a modern kitchen. Give: a short intro, an ingredient list with modern US and metric measures, numbered steps with oven temperatures in both F and C, and the number of servings. Keep the original dish; do not invent unrelated ingredients.' }, { role: 'user', content: r.t + '\n\n' + scaleText(r.x, k).slice(0, 3500) }], t => { o.textContent = t; }, null, { temp: 0.3 }); } catch (e) { o.textContent = 'The AI could not answer right now.'; } };
    }; paint();
  }
  function pickSlot(r, free) {
    const today = dkey(new Date());
    A.dlg('<div style="display:flex;flex-direction:column;gap:10px;min-width:min(340px,86vw)"><b>Add to the meal plan</b><div class="small">' + esc2(r ? r.t : '') + '</div>' + (r ? '' : '<input id="kpt" type="text" placeholder="What are you having?" style="padding:8px 12px">') + '<div class="row" style="gap:8px"><input id="kpd" type="date" value="' + (free && free.d || today) + '"><select id="kpm">' + MEALS.map(([m, l]) => '<option value="' + m + '"' + ((free && free.m || 'd') === m ? ' selected' : '') + '>' + l + '</option>').join('') + '</select></div><div class="row" style="gap:8px"><button class="pri" id="kps">Add</button><button class="ib" id="kpx">Cancel</button></div></div>');
    document.getElementById('kpx').onclick = A.closeDlg; if (document.getElementById('kpt')) document.getElementById('kpt').focus();
    document.getElementById('kps').onclick = () => { const t = r ? r.t : document.getElementById('kpt').value.trim(); if (!t) return; const d = document.getElementById('kpd').value || today, m = document.getElementById('kpm').value; (plan[d] = plan[d] || {})[m] = (plan[d][m] || []).concat([{ t, rid: r ? r.i : '' }]); sv.plan(); A.closeDlg(); st.tab = 'plan'; st.week = d; draw(); };
  }
  async function surprise() {
    await loadDB(); const hits = pantry.length ? find('', '', true).filter(r => r.k !== 'Beverages' && r.k !== 'Preserves, canning & pickles' && r.x.length > 200 && r.x.length < 2500) : DB.recipes.filter(r => (r.k === 'Meat & game' || r.k === 'Soups & stews' || r.k === 'Vegetables & salads' || r.k === 'Poultry' || r.k === 'Fish & seafood') && r.x.length > 200 && r.x.length < 2500);
    if (!hits.length) { A.toast('Add a few things to the pantry first.'); return; } const mon = addD(parseKey(st.week), -((parseKey(st.week).getDay() + 6) % 7)); const pool = hits.slice(0, 60), used = new Set(); let n = 0;
    for (let i = 0; i < 7; i++) { const k = dkey(addD(mon, i)); if ((plan[k] || {}).d && plan[k].d.length) continue; let r, tries = 0; do { r = pool[Math.floor(Math.random() * pool.length)]; tries++; } while (used.has(r.i) && tries < 20); used.add(r.i); (plan[k] = plan[k] || {}).d = [{ t: r.t, rid: r.i }]; n++; }
    sv.plan(); A.toast(n ? 'Planned ' + n + ' dinners.' : 'Every dinner is already planned.'); draw();
  }
  async function planToShop() {
    await loadDB(); const mon = addD(parseKey(st.week), -((parseKey(st.week).getDay() + 6) % 7)); let n = 0;
    for (let i = 0; i < 7; i++) { const p = plan[dkey(addD(mon, i))] || {}; MEALS.forEach(([m]) => (p[m] || []).forEach(it => { const r = it.rid && byId(it.rid); if (r) ingredientsOf(r).forEach(l => { if (!shop.some(x => x.t.toLowerCase() === l.toLowerCase())) { shop.push({ t: l, inp: inPantry(l), from: r.t }); n++; } }); else if (!it.rid && !shop.some(x => x.t.toLowerCase() === it.t.toLowerCase())) { shop.push({ t: it.t, from: 'plan' }); n++; } })); }
    sv.shop(); A.toast(n ? 'Added ' + n + ' items to the shopping list.' : 'Nothing new to add.'); st.tab = 'shop'; draw();
  }
  function draw() { ({ plan: drawPlan, pantry: drawPantry, shop: drawShop, rec: () => drawRec(false) })[st.tab](); }

  /* ---------- clicks ---------- */
  root.addEventListener('click', async e => {
    const T = e.target, c = s => T.closest(s); let el;
    if ((el = c('[data-tab]'))) { st.tab = el.dataset.tab; draw(); return; }
    if ((el = c('[data-w]'))) { const n = +el.dataset.w; st.week = n ? dkey(addD(parseKey(st.week), n)) : dkey(new Date()); draw(); return; }
    if ((el = c('[data-add]'))) { const [d, m] = el.dataset.add.split(':'); A.dlg('<div style="display:flex;flex-direction:column;gap:10px;min-width:min(340px,86vw)"><b>Add a meal</b><button class="pri" id="ka1">📖 Find a recipe</button><div class="row" style="gap:6px"><input id="ka2" type="text" placeholder="or type your own meal" style="flex:1;padding:8px 12px"><button class="ib" id="ka3">Add</button></div></div>'); document.getElementById('ka1').onclick = () => { A.closeDlg(); st.tab = 'rec'; st.addTo = { d, m }; draw(); A.toast('Open a recipe and press "Add to the plan".', 3500); }; document.getElementById('ka3').onclick = () => { const t = document.getElementById('ka2').value.trim(); if (!t) return; (plan[d] = plan[d] || {})[m] = (plan[d][m] || []).concat([{ t, rid: '' }]); sv.plan(); A.closeDlg(); draw(); }; return; }
    if ((el = c('[data-del]'))) { const [d, m, j] = el.dataset.del.split(':'); plan[d][m].splice(+j, 1); sv.plan(); draw(); return; }
    if ((el = c('[data-view]'))) { view(el.dataset.view, el.dataset.free); return; }
    if ((el = c('[data-rid]'))) { view(el.dataset.rid); return; }
    if ((el = c('[data-staple]'))) { if (!pantry.some(p => p.n === el.dataset.staple)) pantry.push({ n: el.dataset.staple }); sv.pantry(); draw(); return; }
    if ((el = c('[data-pd]'))) { pantry = pantry.filter(p => p.n !== el.dataset.pd); sv.pantry(); draw(); return; }
    if ((el = c('[data-sd]'))) { shop[+el.dataset.sd].done = el.checked; sv.shop(); draw(); return; }
    if ((el = c('[data-sx]'))) { shop.splice(+el.dataset.sx, 1); sv.shop(); draw(); return; }
    if (T.id === 'ktpa') { const v = root.querySelector('#ktpn').value, ex = root.querySelector('#ktpe').value; v.split(/[,\n]/).map(s => s.trim()).filter(Boolean).forEach(n => { if (!pantry.some(p => p.n.toLowerCase() === n.toLowerCase())) pantry.push(ex ? { n, exp: ex } : { n }); }); sv.pantry(); draw(); return; }
    if (T.id === 'ktsa') { const v = root.querySelector('#ktsn').value; v.split(/[,\n]/).map(s => s.trim()).filter(Boolean).forEach(t => shop.push({ t })); sv.shop(); draw(); return; }
    if ((el = c('[data-a]'))) {
      const a = el.dataset.a;
      if (a === 'surprise') surprise(); else if (a === 'plan2shop') planToShop();
      else if (a === 'cookable') { st.tab = 'rec'; st.pan = true; st.q = ''; st.cat = ''; await drawRec(true); }
      else if (a === 'pclear') { if (confirm('Clear the whole pantry?')) { pantry = []; sv.pantry(); draw(); } }
      else if (a === 'more') { st.page++; const sc = root.querySelector('.scroll').scrollTop; list(); root.querySelector('.scroll').scrollTop = sc; }
      else if (a === 'sclear') { shop = shop.filter(x => !x.done); sv.shop(); draw(); }
      else if (a === 'stopantry') { shop.filter(x => x.done).forEach(x => { const n = x.t.replace(/^[\d\s/½¼¾⅓⅔⅛.-]+/, '').replace(new RegExp('^(?:' + UNITS + ')\\s+(?:of\\s+)?', 'i'), '').trim(); if (n && !pantry.some(p => p.n.toLowerCase() === n.toLowerCase())) pantry.push({ n }); }); shop = shop.filter(x => !x.done); sv.shop(); sv.pantry(); A.toast('Moved to the pantry.'); draw(); }
      else if (a === 'scopy') A.copy(shop.filter(x => !x.done).map(x => '☐ ' + x.t).join('\n'));
      else if (a === 'sprint') { const w = window.open('', '_blank'); if (!w) { A.toast('Allow pop-ups to print'); return; } w.document.write('<title>Shopping list</title><body style="font:16px Georgia;max-width:560px;margin:30px auto"><h2>Shopping list</h2>' + shop.filter(x => !x.done).map(x => '<div>☐ ' + esc2(x.t) + '</div>').join('') + '</body>'); w.document.close(); w.print(); }
    }
  });
  root.addEventListener('keydown', e => { if (e.key === 'Enter' && e.target.id === 'ktpn') root.querySelector('#ktpa').click(); if (e.key === 'Enter' && e.target.id === 'ktsn') root.querySelector('#ktsa').click(); e.stopPropagation(); });
  // "Add to the plan" from a recipe opened while choosing a slot
  const baseSlot = pickSlot; pickSlot = (r, free) => baseSlot(r, free || st.addTo);
  A.kitchen = { pantry: () => pantry.slice(), plan: () => plan, shop: () => shop.slice(), open: tab => { st.tab = tab || st.tab; A.showTab('kitchen'); } };
  A.registerTab('kitchen', 'Kitchen', () => draw());
})();

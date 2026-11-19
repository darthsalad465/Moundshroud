// Garden: what to plant now for your place (from your frost dates), a plant guide with companions, bed planners that warn about bad neighbours, a harvest log, and moon-planting folklore.
// General guidance for temperate gardens: your own local frost dates and experience come first. Stored on this PC (ls gd_frost, gd_beds, gd_log).
(() => {
  const root = document.getElementById('p-garden'); if (!root) return;
  const esc2 = s => String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c])), pad = n => String(n).padStart(2, '0'), DAY = 864e5;
  const rd = (k, d) => { try { return JSON.parse(ls.get(k, JSON.stringify(d))); } catch (e) { return d; } }, wr = (k, v) => ls.set(k, JSON.stringify(v));
  const dkey = d => d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()), parseKey = k => { const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(k); return m ? new Date(+m[1], +m[2] - 1, +m[3]) : new Date(); };
  const fmt = d => d.toLocaleDateString([], { month: 'short', day: 'numeric' }), addD = (d, n) => new Date(d.getTime() + n * DAY);
  /* id, name, icon, type, indoors [from,to] weeks vs last frost, direct sow [from,to], fall sow [from,to] weeks vs first frost, transplant [from,to], days to harvest, spacing (in), sun, water, cold (hardy/half/tender), companions, avoid, tip */
  const P = [
    ['tomato', 'Tomato', '🍅', 'veg', [-8, -6], null, null, [1, 3], 75, 24, 'full', 'regular', 'tender', ['basil', 'carrot', 'onion', 'marigold', 'parsley'], ['potato', 'cabbage', 'corn', 'dill'], 'Bury the stem deep, stake or cage it, and water evenly to avoid split fruit.'],
    ['pepper', 'Pepper', '🫑', 'veg', [-10, -8], null, null, [2, 4], 70, 18, 'full', 'regular', 'tender', ['basil', 'carrot', 'onion', 'tomato'], ['fennel', 'bean'], 'Loves heat. Wait until nights stay above 10°C (50°F).'],
    ['eggplant', 'Eggplant', '🍆', 'veg', [-10, -8], null, null, [2, 4], 75, 24, 'full', 'regular', 'tender', ['bean', 'pepper', 'marigold'], ['fennel'], 'Needs a long warm season; start early indoors.'],
    ['cucumber', 'Cucumber', '🥒', 'veg', [-3, -2], [1, 3], null, [1, 3], 55, 12, 'full', 'high', 'tender', ['bean', 'pea', 'radish', 'sunflower', 'dill'], ['potato', 'sage'], 'Grow it up a trellis. Keep picking to keep it producing.'],
    ['zucchini', 'Zucchini and summer squash', '🥒', 'veg', [-3, -2], [1, 4], null, [1, 3], 50, 36, 'full', 'regular', 'tender', ['corn', 'bean', 'nasturtium', 'marigold'], ['potato'], 'Two plants feed a family. Pick small and often.'],
    ['pumpkin', 'Pumpkin and winter squash', '🎃', 'veg', null, [1, 3], null, null, 100, 48, 'full', 'regular', 'tender', ['corn', 'bean', 'nasturtium'], ['potato'], 'Needs lots of room. Cure squash in the sun for ten days before storing.'],
    ['bean', 'Bush bean', '🫘', 'veg', null, [1, 8], null, null, 55, 4, 'full', 'regular', 'tender', ['carrot', 'corn', 'cucumber', 'beet', 'marigold'], ['onion', 'garlic', 'fennel', 'chive', 'cabbage'], 'Sow every three weeks for a steady supply. Fixes nitrogen for the soil.'],
    ['polebean', 'Pole bean', '🫛', 'veg', null, [1, 6], null, null, 65, 6, 'full', 'regular', 'tender', ['corn', 'cucumber', 'radish', 'marigold'], ['onion', 'garlic', 'beet'], 'Give it a tall support. Grows well up corn stalks.'],
    ['pea', 'Pea', '🫛', 'veg', null, [-6, -2], [-10, -8], null, 60, 2, 'full', 'regular', 'hardy', ['carrot', 'radish', 'turnip', 'cucumber', 'lettuce'], ['onion', 'garlic', 'chive'], 'A cool-season crop: sow as soon as the soil can be worked.'],
    ['lettuce', 'Lettuce', '🥬', 'veg', [-6, -4], [-4, 4], [-8, -4], [-3, 0], 45, 8, 'part', 'regular', 'hardy', ['carrot', 'radish', 'strawberry', 'cucumber', 'onion'], [], 'Bolts in heat: give it afternoon shade and sow again in late summer.'],
    ['spinach', 'Spinach', '🥬', 'veg', null, [-6, -2], [-8, -5], null, 40, 4, 'part', 'regular', 'hardy', ['strawberry', 'pea', 'bean', 'radish'], [], 'Sow early or late; it bolts as days lengthen.'],
    ['kale', 'Kale', '🥬', 'veg', [-6, -4], [-4, 0], [-12, -8], [-4, 0], 55, 12, 'full', 'regular', 'hardy', ['beet', 'onion', 'celery', 'dill'], ['strawberry', 'tomato'], 'Very hardy; flavour sweetens after frost.'],
    ['broccoli', 'Broccoli', '🥦', 'veg', [-8, -6], null, [-14, -10], [-3, 0], 70, 18, 'full', 'regular', 'hardy', ['onion', 'beet', 'celery', 'dill', 'potato'], ['strawberry', 'tomato'], 'After the main head, side shoots keep coming.'],
    ['cabbage', 'Cabbage', '🥬', 'veg', [-8, -6], null, [-14, -10], [-4, -1], 80, 18, 'full', 'regular', 'hardy', ['onion', 'beet', 'dill', 'celery', 'potato'], ['strawberry', 'tomato', 'bean'], 'Heavy feeder. Cover young plants against cabbage moths.'],
    ['cauliflower', 'Cauliflower', '🥦', 'veg', [-8, -6], null, [-14, -10], [-3, 0], 75, 18, 'full', 'regular', 'hardy', ['bean', 'celery', 'onion'], ['strawberry', 'tomato'], 'Fussy about heat and drought. Tie leaves over the head to keep it white.'],
    ['carrot', 'Carrot', '🥕', 'veg', null, [-4, 2], [-12, -10], null, 70, 3, 'full', 'regular', 'hardy', ['tomato', 'onion', 'lettuce', 'pea', 'leek', 'rosemary'], ['dill', 'parsnip'], 'Needs loose, stone-free soil. Keep the seed bed moist until it sprouts.'],
    ['beet', 'Beet', '🟣', 'veg', null, [-4, 4], [-10, -8], null, 55, 4, 'full', 'regular', 'hardy', ['onion', 'lettuce', 'cabbage', 'kale'], ['polebean'], 'The leaves are edible too. Thin seedlings to 4 inches.'],
    ['radish', 'Radish', '🔴', 'veg', null, [-4, 4], [-6, -3], null, 28, 2, 'full', 'regular', 'hardy', ['cucumber', 'pea', 'lettuce', 'carrot'], ['hyssop'], 'Ready in four weeks: mix a few in with slower crops.'],
    ['turnip', 'Turnip', '⚪', 'veg', null, [-4, 0], [-10, -8], null, 50, 4, 'full', 'regular', 'hardy', ['pea', 'bean'], ['potato'], 'Quick and cold-hardy. Greens and roots are both good.'],
    ['potato', 'Potato', '🥔', 'veg', null, [-4, -1], null, null, 90, 12, 'full', 'regular', 'hardy', ['bean', 'cabbage', 'corn', 'marigold'], ['tomato', 'cucumber', 'pumpkin', 'sunflower'], 'Plant seed potatoes; hill soil up around the stems as they grow.'],
    ['sweetpotato', 'Sweet potato', '🍠', 'veg', null, null, null, [2, 4], 100, 12, 'full', 'regular', 'tender', ['bean', 'dill'], ['pumpkin'], 'Plant rooted slips once the soil is warm. Harvest before the first frost.'],
    ['onion', 'Onion', '🧅', 'veg', [-10, -8], [-6, -2], null, [-6, -2], 100, 4, 'full', 'regular', 'hardy', ['carrot', 'beet', 'lettuce', 'tomato', 'cabbage'], ['bean', 'pea'], 'Sets are the easiest start. Stop watering when the tops fall over.'],
    ['garlic', 'Garlic', '🧄', 'veg', null, null, [-2, 4], null, 240, 5, 'full', 'low', 'hardy', ['tomato', 'beet', 'carrot', 'rose'], ['pea', 'bean'], 'Plant cloves in autumn; harvest the next summer when lower leaves yellow.'],
    ['leek', 'Leek', '🌱', 'veg', [-10, -8], null, null, [-2, 0], 120, 6, 'full', 'regular', 'hardy', ['carrot', 'celery', 'onion'], ['bean', 'pea'], 'Hill soil up the stems for long white shanks.'],
    ['celery', 'Celery', '🥬', 'veg', [-10, -8], null, null, [0, 2], 110, 8, 'part', 'high', 'half', ['leek', 'tomato', 'bean', 'cabbage'], ['corn'], 'Thirsty and slow. Keep the soil constantly moist.'],
    ['corn', 'Sweet corn', '🌽', 'veg', null, [1, 6], null, null, 80, 12, 'full', 'regular', 'tender', ['bean', 'pumpkin', 'cucumber', 'pea'], ['tomato'], 'Plant in blocks, not one long row, so the wind can pollinate it.'],
    ['asparagus', 'Asparagus', '🌿', 'veg', null, [-6, -2], null, null, 730, 18, 'full', 'regular', 'hardy', ['tomato', 'basil', 'parsley'], ['onion', 'garlic'], 'A perennial: plant crowns and wait two years before harvesting.'],
    ['basil', 'Basil', '🌿', 'herb', [-6, -4], [1, 6], null, [1, 3], 60, 10, 'full', 'regular', 'tender', ['tomato', 'pepper', 'asparagus'], ['sage', 'rue'], 'Pinch off flower buds to keep it leafy. Frost kills it.'],
    ['parsley', 'Parsley', '🌿', 'herb', [-8, -6], [-4, 0], null, [-2, 2], 75, 8, 'part', 'regular', 'hardy', ['tomato', 'asparagus', 'carrot'], ['mint'], 'Slow to sprout. A biennial; it overwinters in mild climates.'],
    ['cilantro', 'Cilantro', '🌿', 'herb', null, [-2, 4], [-8, -4], null, 45, 4, 'part', 'regular', 'hardy', ['spinach', 'bean'], ['fennel'], 'Bolts in heat. Sow a little every two weeks; let some go to seed for coriander.'],
    ['dill', 'Dill', '🌿', 'herb', null, [-2, 4], null, null, 45, 8, 'full', 'regular', 'hardy', ['cabbage', 'cucumber', 'lettuce'], ['carrot', 'tomato'], 'Self-seeds. Attracts helpful insects.'],
    ['chive', 'Chives', '🌿', 'herb', [-8, -6], [-4, 0], null, [-2, 2], 80, 6, 'full', 'regular', 'hardy', ['carrot', 'tomato', 'rose', 'strawberry'], ['bean', 'pea'], 'A hardy perennial; cut back hard and it regrows.'],
    ['mint', 'Mint', '🌿', 'herb', null, null, null, [-2, 4], 60, 18, 'part', 'high', 'hardy', ['cabbage', 'tomato'], ['parsley'], 'Spreads aggressively: keep it in a pot.'],
    ['thyme', 'Thyme', '🌿', 'herb', [-10, -8], null, null, [0, 3], 90, 10, 'full', 'low', 'hardy', ['cabbage', 'tomato', 'strawberry'], [], 'Likes poor, well-drained soil and little water.'],
    ['oregano', 'Oregano', '🌿', 'herb', [-8, -6], null, null, [0, 3], 80, 12, 'full', 'low', 'hardy', ['tomato', 'pepper', 'cucumber'], [], 'A tough perennial. Flavour is best in full sun.'],
    ['sage', 'Sage', '🌿', 'herb', [-8, -6], null, null, [0, 3], 90, 18, 'full', 'low', 'hardy', ['cabbage', 'carrot', 'strawberry'], ['cucumber', 'basil'], 'Woody perennial. Trim lightly after flowering.'],
    ['rosemary', 'Rosemary', '🌿', 'herb', [-12, -10], null, null, [1, 4], 120, 24, 'full', 'low', 'half', ['cabbage', 'carrot', 'bean', 'sage'], [], 'Not hardy in cold winters; grow it in a pot and bring it indoors.'],
    ['strawberry', 'Strawberry', '🍓', 'fruit', null, null, null, [-4, -1], 365, 12, 'full', 'regular', 'hardy', ['spinach', 'lettuce', 'bean', 'thyme', 'chive'], ['cabbage', 'broccoli'], 'Pinch off the first-year flowers for stronger plants and bigger crops later.'],
    ['raspberry', 'Raspberry', '🍇', 'fruit', null, null, null, [-4, 0], 365, 24, 'full', 'regular', 'hardy', ['garlic', 'chive'], ['potato', 'tomato'], 'Plant bare-root canes in early spring; prune out old canes after fruiting.'],
    ['marigold', 'Marigold', '🌼', 'flower', [-8, -6], [1, 4], null, [1, 3], 55, 8, 'full', 'low', 'tender', ['tomato', 'pepper', 'bean', 'potato'], [], 'A good guard plant: it helps keep pests away from vegetables.'],
    ['sunflower', 'Sunflower', '🌻', 'flower', null, [0, 6], null, null, 90, 18, 'full', 'low', 'half', ['cucumber', 'corn'], ['potato', 'bean'], 'Tall and easy; birds love the seeds.'],
    ['nasturtium', 'Nasturtium', '🌺', 'flower', null, [0, 4], null, null, 55, 10, 'full', 'low', 'tender', ['cucumber', 'zucchini', 'tomato', 'radish'], [], 'Edible flowers and leaves. Pests prefer it to your vegetables.'],
    ['calendula', 'Calendula', '🌼', 'flower', null, [-4, 0], [-8, -6], null, 55, 8, 'full', 'low', 'hardy', ['tomato', 'bean', 'lettuce'], [], 'Edible petals. Cool-weather bloomer; sow again in autumn.'],
    ['zinnia', 'Zinnia', '🌸', 'flower', [-6, -4], [1, 4], null, [1, 3], 60, 10, 'full', 'low', 'tender', ['tomato', 'cucumber'], [], 'Easy cut flowers; attracts butterflies and bees.'],
    ['sweetpea', 'Sweet pea', '🌸', 'flower', null, [-6, -2], null, null, 90, 6, 'full', 'regular', 'hardy', ['bean', 'pea'], [], 'Sow early and give it a trellis. The flowers are not edible.']
  ].map(a => ({ id: a[0], name: a[1], icon: a[2], type: a[3], ind: a[4], dir: a[5], fall: a[6], tr: a[7], days: a[8], sp: a[9], sun: a[10], wat: a[11], cold: a[12], co: a[13], av: a[14], tip: a[15] }));
  const byId = {}; P.forEach(p => { byId[p.id] = p; });
  const nameOf = id => (byId[id] ? byId[id].name : id.replace(/^./, c => c.toUpperCase()));
  let st = { tab: 'now', type: '', q: '', open: null, bed: 0 }, fr = rd('gd_frost', {}), beds = rd('gd_beds', null) || [{ id: 'b1', name: 'Bed 1', r: 4, c: 8, cells: {} }], log = rd('gd_log', []);

  /* ---------- frost dates ---------- */
  const lat = () => { const l = A.sky && A.sky.loc(); return l ? l.lat : null; };
  function frost() {
    const la = lat(), south = la != null && la < 0, a = Math.abs(la == null ? 40 : la), y = new Date().getFullYear();
    const doyDate = (n, yr) => new Date(yr, 0, 1 + Math.round(n)), none = fr.none != null ? fr.none : a < 26;
    let last = Math.max(10, Math.min(190, 15 + (a - 25) * 5.5)), first = Math.max(235, Math.min(360, 350 - (a - 25) * 4.2)); if (south) { last += 182; first += 182; }
    const ld = fr.last ? new Date(y, +fr.last.slice(0, 2) - 1, +fr.last.slice(3, 5)) : doyDate(last, y), fd = fr.first ? new Date(y, +fr.first.slice(0, 2) - 1, +fr.first.slice(3, 5)) : doyDate(first, y);
    return { last: ld, first: fd, none, guessed: !fr.last && !fr.first, south, lat: la };
  }
  const windows = (p, F) => {                                       // [{kind, from, to}] for last year, this year and next year's seasons
    const out = [];
    for (let k = -1; k <= 1; k++) {
      let L = new Date(F.last.getFullYear() + k, F.last.getMonth(), F.last.getDate()), Fi = new Date(F.first.getFullYear() + k, F.first.getMonth(), F.first.getDate()); if (Fi < L) Fi = new Date(Fi.getFullYear() + 1, Fi.getMonth(), Fi.getDate());
      const w = (kind, arr, base) => { if (arr) out.push({ kind, from: addD(base, arr[0] * 7), to: addD(base, arr[1] * 7) }); };
      w('Start indoors', p.ind, L); w('Sow outdoors', p.dir, L); w('Plant out seedlings', p.tr, L); w('Sow for autumn', p.fall, Fi);
    }
    return out;
  };
  const now = () => { const d = new Date(); return new Date(d.getFullYear(), d.getMonth(), d.getDate()); };

  /* ---------- drawing ---------- */
  const css = '.gd-wrap{max-width:1100px;margin:0 auto}.gd-card{background:var(--panel);border:1px solid var(--line);border-radius:14px;padding:12px 14px;margin:0 0 12px}.gd-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(230px,1fr));gap:10px}.gd-p{background:var(--panel);border:1px solid var(--line);border-radius:12px;padding:10px 12px;cursor:pointer}.gd-p:hover{border-color:var(--acc)}.gd-tag{display:inline-block;font-size:11.5px;padding:1px 8px;border-radius:99px;background:var(--panel2);margin:2px 4px 2px 0}.gd-tag.go{background:rgba(94,230,168,.18);color:var(--ok)}.gd-cell{aspect-ratio:1;min-width:40px;border:1px solid var(--line);border-radius:8px;display:flex;align-items:center;justify-content:center;font-size:22px;cursor:pointer;background:var(--panel2);position:relative}.gd-cell:hover{border-color:var(--acc)}.gd-cell.bad{border-color:var(--bad);box-shadow:inset 0 0 0 2px rgba(255,107,129,.5)}.gd-cell.good{border-color:var(--ok)}.gd-bed{display:grid;gap:4px;max-width:640px}';
  if (!document.getElementById('gdcss')) { const s = document.createElement('style'); s.id = 'gdcss'; s.textContent = css; document.head.appendChild(s); }
  const tabs = [['now', '🌿 Plant now'], ['guide', '📖 Plant guide'], ['beds', '🧩 My beds'], ['log', '🧺 Harvest log'], ['moon', '🌙 Moon']];
  function shell(inner) {
    const F = frost();
    root.innerHTML = '<div class="scroll pad" style="flex:1"><div class="gd-wrap"><div class="row" style="gap:8px;flex-wrap:wrap;margin-bottom:10px"><h2 style="margin:0;margin-right:10px">🌱 Garden</h2>' + tabs.map(t => '<button class="ib' + (st.tab === t[0] ? ' on' : '') + '" data-tab="' + t[0] + '">' + t[1] + '</button>').join('') + '</div>' + frostBar(F) + inner + '</div></div>';
  }
  function frostBar(F) {
    const t = now(), toL = Math.round((F.last - t) / DAY), toF = Math.round((F.first - t) / DAY);
    return '<div class="gd-card"><div class="row" style="gap:10px;flex-wrap:wrap;align-items:center"><b>Frost dates</b>' + (F.none ? '<span class="small">No frost where you live: plant by the heat and rain, not the frost.</span>' : '<span class="small">Last spring frost <b>' + fmt(F.last) + '</b> (' + (toL >= 0 ? 'in ' + toL + ' days' : -toL + ' days ago') + ') · first autumn frost <b>' + fmt(F.first) + '</b> (' + (toF >= 0 ? 'in ' + toF + ' days' : -toF + ' days ago') + ')</span>') + '<span style="flex:1"></span><button class="ib" data-a="frost">Change</button></div>' + (F.guessed && !F.none ? '<div class="small mute" style="margin-top:4px">These are estimates from your latitude' + (F.lat == null ? ' (set your place in the Sky tab for a better guess)' : '') + '. Use your local frost dates if you know them: ask a neighbour or your county garden office.</div>' : '') + frostWarn() + '</div>';
  }
  function frostWarn() { try { const l = rd('wx_log', []).slice(-1)[0]; if (l && l.t_c != null && Date.now() - l.t < 2 * DAY && l.t_c <= 3) return '<div class="small" style="margin-top:6px;color:var(--warn)">❄️ Your latest weather reading was ' + l.t_c.toFixed(0) + '°C: cover tender plants tonight.</div>'; } catch (e) { } return ''; }
  const statusOf = (p, F, d) => { const w = windows(p, F).filter(x => d >= x.from && d <= x.to); return w; };
  function drawNow() {
    const F = frost(), d = now(), act = [], soon = [];
    P.forEach(p => { const w = statusOf(p, F, d); if (w.length) act.push([p, w]); else { const nx = windows(p, F).filter(x => x.from > d && x.from - d < 21 * DAY).sort((a, b) => a.from - b.from)[0]; if (nx) soon.push([p, nx]); } });
    const kinds = ['Start indoors', 'Sow outdoors', 'Plant out seedlings', 'Sow for autumn'], grp = {}; act.forEach(([p, w]) => { w.forEach(x => { (grp[x.kind] = grp[x.kind] || []).push([p, x]); }); });
    shell('<div class="gd-card"><b>What to plant around ' + d.toLocaleDateString([], { month: 'long', day: 'numeric' }) + '</b><div class="small mute">Based on your frost dates. Tender plants wait until after the last frost.</div></div>' + (act.length ? kinds.filter(k => grp[k]).map(k => '<h3 style="margin:14px 0 6px">' + ({ 'Start indoors': '🏠', 'Sow outdoors': '🌱', 'Plant out seedlings': '🪴', 'Sow for autumn': '🍂' })[k] + ' ' + k + '</h3><div class="gd-grid">' + grp[k].map(([p, x]) => '<div class="gd-p" data-p="' + p.id + '"><b>' + p.icon + ' ' + esc2(p.name) + '</b><div class="small mute">until ' + fmt(x.to) + ' · ready in about ' + (p.days >= 365 ? 'a year or more' : p.days + ' days') + '</div></div>').join('') + '</div>').join('') : '<div class="gd-card mute">Nothing is in season to plant right now where you are. Check the plant guide for next season.</div>') +
      (soon.length ? '<h3 style="margin:16px 0 6px">⏭️ Coming up in the next three weeks</h3><div class="gd-card">' + soon.sort((a, b) => a[1].from - b[1].from).map(([p, x]) => '<div class="row" style="gap:8px;padding:3px 0"><span style="width:90px" class="small mute">' + fmt(x.from) + '</span><span>' + p.icon + ' ' + esc2(p.name) + '</span><span class="small mute">' + x.kind.toLowerCase() + '</span></div>').join('') + '</div>' : ''));
  }
  function drawGuide() {
    const F = frost(), d = now(), list = P.filter(p => (!st.type || p.type === st.type) && (!st.q || (p.name + ' ' + p.tip).toLowerCase().includes(st.q.toLowerCase())));
    shell('<div class="gd-card"><div class="row" style="gap:8px;flex-wrap:wrap"><input id="gdq" type="text" placeholder="Search plants..." value="' + esc2(st.q) + '" style="flex:1;min-width:180px;padding:8px 12px">' + [['', 'All'], ['veg', 'Vegetables'], ['herb', 'Herbs'], ['fruit', 'Fruit'], ['flower', 'Flowers']].map(([v, l]) => '<button class="ib' + (st.type === v ? ' on' : '') + '" data-type="' + v + '">' + l + '</button>').join('') + '</div></div><div class="gd-grid">' + list.map(p => { const w = statusOf(p, F, d); return '<div class="gd-p" data-p="' + p.id + '"><b>' + p.icon + ' ' + esc2(p.name) + '</b>' + (w.length ? '<span class="gd-tag go">' + esc2(w[0].kind) + '</span>' : '') + '<div class="small mute" style="margin-top:3px">' + esc2(p.tip) + '</div></div>'; }).join('') + '</div>');
    const q = root.querySelector('#gdq'); q.onkeydown = e => e.stopPropagation(); q.oninput = () => { st.q = q.value; const pos = q.selectionStart; drawGuide(); const n = root.querySelector('#gdq'); n.focus(); n.setSelectionRange(pos, pos); };
  }
  function plantCard(id) {
    const p = byId[id], F = frost(); if (!p) return; const W = windows(p, F).filter(x => x.from.getFullYear() === F.last.getFullYear() || x.to.getFullYear() === F.last.getFullYear()).filter((x, i, a) => a.findIndex(y => y.kind === x.kind) === i);
    A.dlg('<div style="display:flex;flex-direction:column;gap:8px;min-width:min(420px,88vw)"><div class="row"><b style="font-size:19px;flex:1">' + p.icon + ' ' + esc2(p.name) + '</b><button class="ib" id="gpx">✕</button></div><div class="small mute">' + ({ veg: 'Vegetable', herb: 'Herb', fruit: 'Fruit', flower: 'Flower' })[p.type] + ' · ' + ({ hardy: 'tolerates frost', half: 'half-hardy (light frost only)', tender: 'tender: wait until after the last frost' })[p.cold] + '</div>' +
      '<div>' + W.map(x => '<div class="row" style="gap:8px;padding:2px 0"><span class="gd-tag go">' + esc2(x.kind) + '</span><span>' + fmt(x.from) + ' to ' + fmt(x.to) + '</span></div>').join('') + '</div>' +
      '<div class="skrow" style="display:flex;justify-content:space-between;border-bottom:1px dashed var(--line)"><span>Ready to harvest in about</span><b>' + (p.days >= 365 ? 'a year or more' : p.days + ' days') + '</b></div><div style="display:flex;justify-content:space-between;border-bottom:1px dashed var(--line)"><span>Spacing</span><b>' + p.sp + ' in (' + Math.round(p.sp * 2.54) + ' cm)</b></div><div style="display:flex;justify-content:space-between;border-bottom:1px dashed var(--line)"><span>Sun / water</span><b>' + ({ full: 'full sun', part: 'part shade' })[p.sun] + ' · ' + p.wat + '</b></div>' +
      '<div><span style="color:var(--ok)">✔ Grows well with:</span> ' + (p.co.length ? p.co.map(c => esc2(nameOf(c))).join(', ') : 'most things') + '</div><div><span style="color:var(--bad)">✘ Keep away from:</span> ' + (p.av.length ? p.av.map(c => esc2(nameOf(c))).join(', ') : 'nothing in particular') + '</div><div class="small" style="line-height:1.5">' + esc2(p.tip) + '</div></div>');
    document.getElementById('gpx').onclick = A.closeDlg;
  }
  /* beds */
  const cellsOf = b => b.cells || (b.cells = {});
  function neighbours(b, r, c) { const out = []; for (let dr = -1; dr <= 1; dr++) for (let dc = -1; dc <= 1; dc++) { if (!dr && !dc) continue; const v = cellsOf(b)[(r + dr) + ',' + (c + dc)]; if (v) out.push(v.p); } return out; }
  function drawBeds() {
    const b = beds[Math.min(st.bed, beds.length - 1)];
    const cells = []; for (let r = 0; r < b.r; r++) for (let c = 0; c < b.c; c++) { const v = cellsOf(b)[r + ',' + c], pl = v && byId[v.p]; let cls = ''; if (pl) { const nb = neighbours(b, r, c).map(x => byId[x]).filter(Boolean); if (nb.some(n => pl.av.includes(n.id) || n.av.includes(pl.id))) cls = ' bad'; else if (nb.some(n => pl.co.includes(n.id) || n.co.includes(pl.id))) cls = ' good'; } cells.push('<div class="gd-cell' + cls + '" data-cell="' + r + ',' + c + '" title="' + (pl ? esc2(pl.name) + (v.d ? ' · planted ' + v.d : '') : 'empty') + '">' + (pl ? pl.icon : '') + '</div>'); }
    const harvests = []; beds.forEach(bd => Object.values(cellsOf(bd)).forEach(v => { const p = byId[v.p]; if (p && v.d && p.days < 365) harvests.push([addD(parseKey(v.d), p.days), p, bd.name]); })); harvests.sort((a, b) => a[0] - b[0]);
    shell('<div class="gd-card"><div class="row" style="gap:8px;flex-wrap:wrap">' + beds.map((x, i) => '<button class="ib' + (i === st.bed ? ' on' : '') + '" data-bed="' + i + '">' + esc2(x.name) + '</button>').join('') + '<button class="ib" data-a="newbed">+ New bed</button><span style="flex:1"></span><button class="ib" data-a="resize">Resize</button><button class="ib" data-a="clearbed">Clear</button>' + (beds.length > 1 ? '<button class="ib" data-a="delbed">Delete bed</button>' : '') + '</div><div class="small mute" style="margin:8px 0">Click a square to plant. <span style="color:var(--ok)">Green</span> squares have a friendly neighbour; <span style="color:var(--bad)">red</span> squares have a plant that does not get along with it. Each square is about one plant spacing; large plants (squash, corn) can take several.</div><div class="gd-bed" style="grid-template-columns:repeat(' + b.c + ',1fr)">' + cells.join('') + '</div></div>' +
      '<div class="gd-card"><b>⏳ Coming up to harvest</b>' + (harvests.length ? harvests.slice(0, 10).map(([d, p, bn]) => '<div class="row" style="gap:8px;padding:3px 0"><span class="small mute" style="width:90px">' + fmt(d) + (d < now() ? ' (due)' : '') + '</span><span>' + p.icon + ' ' + esc2(p.name) + '</span><span class="small mute">' + esc2(bn) + '</span></div>').join('') : '<div class="small mute">Plant something with a date to see when it will be ready.</div>') + '</div>');
  }
  function pickPlant(key) {
    const b = beds[st.bed], cur = cellsOf(b)[key];
    A.dlg('<div style="display:flex;flex-direction:column;gap:10px;min-width:min(340px,86vw)"><b>Plant here</b><select id="gdpp" class="ib"><option value="">(empty)</option>' + P.map(p => '<option value="' + p.id + '"' + (cur && cur.p === p.id ? ' selected' : '') + '>' + p.icon + ' ' + esc2(p.name) + '</option>').join('') + '</select><label class="small">Planted on <input id="gdpd" type="date" value="' + ((cur && cur.d) || dkey(new Date())) + '"></label><div class="row" style="gap:8px"><button class="pri" id="gdps">Save</button><button class="ib" id="gdpx">Cancel</button></div></div>');
    document.getElementById('gdpx').onclick = A.closeDlg;
    document.getElementById('gdps').onclick = () => { const v = document.getElementById('gdpp').value; if (v) cellsOf(b)[key] = { p: v, d: document.getElementById('gdpd').value }; else delete cellsOf(b)[key]; wr('gd_beds', beds); A.closeDlg(); drawBeds(); };
  }
  function drawLog() {
    const tot = {}; log.forEach(l => { const k = l.plant + '|' + l.unit; tot[k] = (tot[k] || 0) + l.qty; });
    shell('<div class="gd-card"><b>🧺 Log a harvest</b><div class="row" style="gap:8px;flex-wrap:wrap;margin-top:8px"><input id="glp" list="glplants" placeholder="What did you pick?" style="padding:8px 12px"><datalist id="glplants">' + P.map(p => '<option value="' + esc2(p.name) + '">').join('') + '</datalist><input id="glq" type="number" step="any" min="0" placeholder="How much" style="width:100px;padding:8px 12px"><select id="glu" class="ib"><option>lb</option><option>kg</option><option>pieces</option><option>bunches</option><option>pints</option></select><input id="gld" type="date" value="' + dkey(new Date()) + '"><input id="gln" placeholder="Notes" style="flex:1;min-width:140px;padding:8px 12px"><button class="pri" id="gls">Add</button></div></div>' +
      (Object.keys(tot).length ? '<div class="gd-card"><b>Totals</b><div style="margin-top:6px">' + Object.entries(tot).sort((a, b) => b[1] - a[1]).map(([k, v]) => { const [p, u] = k.split('|'); return '<span class="gd-tag">' + esc2(p) + ': ' + (Math.round(v * 10) / 10) + ' ' + u + '</span>'; }).join('') + '</div></div>' : '') +
      '<div class="gd-card">' + (log.length ? log.slice().reverse().slice(0, 60).map((l, i) => '<div class="row" style="gap:8px;padding:5px 0;border-bottom:1px dashed var(--line)"><span class="small mute" style="width:90px">' + fmt(parseKey(l.d)) + '</span><span style="flex:1"><b>' + esc2(l.plant) + '</b> ' + l.qty + ' ' + l.unit + (l.note ? ' <span class="small mute">' + esc2(l.note) + '</span>' : '') + '</span><span style="cursor:pointer;color:var(--mute)" data-ldel="' + (log.length - 1 - i) + '">✕</span></div>').join('') : '<div class="mute small">No harvests logged yet.</div>') + '</div>');
  }
  function drawMoon() {
    const S = window.SkyCore; let rows = '', today = '';
    if (S) { const d0 = now().getTime(); for (let i = 0; i < 15; i++) { const t = d0 + i * DAY + 12 * 36e5, m = S.moon(t), wax = m.waxing; rows += '<div class="row" style="gap:10px;padding:4px 0;border-bottom:1px dashed var(--line)"><span class="small mute" style="width:100px">' + fmt(new Date(t)) + '</span><span style="width:130px">' + S.phaseName(m.elong) + '</span><span class="small">' + (wax ? 'Sow and plant crops that grow above ground (leafy vegetables, beans, tomatoes).' : 'Sow and plant root crops, transplant, prune and weed.') + '</span></div>'; if (!i) today = (wax ? 'Waxing moon: the traditional time to sow leafy and fruiting crops.' : 'Waning moon: the traditional time for root crops, transplanting and pruning.') + ' (' + Math.round(m.ill * 100) + '% lit)'; } }
    shell('<div class="gd-card"><b>🌙 Planting by the Moon</b><div class="small mute" style="margin:4px 0 8px;line-height:1.5">A traditional gardening folk practice. Studies have not shown it changes yields, so treat it as a fun rhythm, not a rule. Frost dates matter far more.</div><div style="font-size:15px;margin-bottom:6px">' + esc2(today || 'Open the Sky tab once to load the moon data.') + '</div>' + rows + '</div>');
  }
  const draw = () => ({ now: drawNow, guide: drawGuide, beds: drawBeds, log: drawLog, moon: drawMoon })[st.tab]();

  root.addEventListener('click', async e => {
    const T = e.target, c = s => T.closest(s); let el;
    if ((el = c('[data-tab]'))) { st.tab = el.dataset.tab; draw(); return; }
    if ((el = c('[data-p]'))) { plantCard(el.dataset.p); return; }
    if ((el = c('[data-type]'))) { st.type = el.dataset.type; draw(); return; }
    if ((el = c('[data-bed]'))) { st.bed = +el.dataset.bed; draw(); return; }
    if ((el = c('[data-cell]'))) { pickPlant(el.dataset.cell); return; }
    if ((el = c('[data-ldel]'))) { log.splice(+el.dataset.ldel, 1); wr('gd_log', log); draw(); return; }
    if (T.id === 'gls') { const nm = root.querySelector('#glp').value.trim(), q = parseFloat(root.querySelector('#glq').value); if (!nm || !(q > 0)) { A.toast('Add what you picked and how much.'); return; } log.push({ plant: nm, qty: q, unit: root.querySelector('#glu').value, d: root.querySelector('#gld').value || dkey(new Date()), note: root.querySelector('#gln').value.trim() }); wr('gd_log', log); draw(); return; }
    if ((el = c('[data-a]'))) {
      const a = el.dataset.a, b = beds[st.bed];
      if (a === 'frost') { const F = frost(), md = d => pad(d.getMonth() + 1) + '-' + pad(d.getDate()), v = md => '2026-' + md; A.dlg('<div style="display:flex;flex-direction:column;gap:10px;min-width:min(380px,86vw)"><b>Your frost dates</b><label class="small" style="display:flex;gap:6px;align-items:center"><input type="checkbox" id="gfn"' + (F.none ? ' checked' : '') + '> No frost where I live</label><label class="small">Last spring frost <input id="gfl" type="date" value="' + v(md(F.last)) + '"></label><label class="small">First autumn frost <input id="gff" type="date" value="' + v(md(F.first)) + '"></label><div class="small mute">Only the month and day matter. Reset goes back to the estimate for your latitude.</div><div class="row" style="gap:8px"><button class="pri" id="gfs">Save</button><button class="ib" id="gfr">Reset</button><button class="ib" id="gfx">Cancel</button></div></div>'); document.getElementById('gfx').onclick = A.closeDlg; document.getElementById('gfr').onclick = () => { fr = {}; wr('gd_frost', fr); A.closeDlg(); draw(); }; document.getElementById('gfs').onclick = () => { fr = { none: document.getElementById('gfn').checked, last: document.getElementById('gfl').value.slice(5), first: document.getElementById('gff').value.slice(5) }; wr('gd_frost', fr); A.closeDlg(); draw(); }; return; }
      if (a === 'newbed') { const n = (await A.prompt('Name the new bed:', 'Bed ' + (beds.length + 1))); if (n) { beds.push({ id: 'b' + Date.now(), name: n.slice(0, 30), r: 4, c: 8, cells: {} }); st.bed = beds.length - 1; wr('gd_beds', beds); draw(); } }
      else if (a === 'delbed') { if ((await A.confirm('Delete "' + b.name + '"?'))) { beds.splice(st.bed, 1); st.bed = 0; wr('gd_beds', beds); draw(); } }
      else if (a === 'clearbed') { if ((await A.confirm('Empty every square of "' + b.name + '"?'))) { b.cells = {}; wr('gd_beds', beds); draw(); } }
      else if (a === 'resize') { const s = (await A.prompt('Size as rows x columns (for example 4x8):', b.r + 'x' + b.c)), m = s && /^(\d{1,2})\s*[x×,]\s*(\d{1,2})$/i.exec(s.trim()); if (m && +m[1] > 0 && +m[2] > 0 && +m[1] <= 20 && +m[2] <= 20) { b.r = +m[1]; b.c = +m[2]; Object.keys(cellsOf(b)).forEach(k => { const [r, cc] = k.split(',').map(Number); if (r >= b.r || cc >= b.c) delete b.cells[k]; }); wr('gd_beds', beds); draw(); } }
    }
  });
  root.addEventListener('keydown', e => { if (e.target.tagName === 'INPUT') e.stopPropagation(); });
  A.garden = { plants: P, frost, windows: p => windows(p, frost()) };
  A.registerTab('garden', 'Garden', () => draw());
})();

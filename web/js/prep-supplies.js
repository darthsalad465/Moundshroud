// Supplies: household profile, water / food / power calculators, and a checklist-inventory with expiry reminders.
(() => {
  const P = A.prep;
  const CATS = ['Water', 'Food', 'First aid & health', 'Light & power', 'Communication', 'Tools & safety', 'Sanitation', 'Documents & cash', 'Clothing & bedding', 'Pets', 'Baby & kids'];
  const DEV = [['Phone charging', 15, 2], ['Laptop', 60, 4], ['LED lamp', 8, 5], ['Radio', 5, 4], ['Wi-Fi router', 12, 0], ['Medical device (e.g. CPAP)', 40, 0]];

  /* ----- numbers ----- */
  const people = () => (+P.data.profile.adults || 0) + (+P.data.profile.children || 0);
  const waterDay = () => { const p = P.data.profile, f = p.climate === 'hot' ? 1.5 : 1; return people() * 1 * f + (+p.pets || 0) * 0.5; };        // gallons per day
  const toGal = (q, u) => { q = +q || 0; u = (u || '').toLowerCase(); return /^l|liter|litre/.test(u) ? q / 3.785 : /bottle/.test(u) ? q * 0.13 : q; };
  P.waterDays = () => { const w = waterDay(); if (!w) return 0; const have = P.data.supplies.filter(s => s.cat === 'Water' && s.have && /water/i.test(s.name) && !/tablet|bleach|filter|container|purif/i.test(s.name)).reduce((a, s) => a + toGal(s.qty, s.unit), 0); return have / w; };
  const kcalDay = () => (+P.data.profile.adults || 0) * 2000 + (+P.data.profile.children || 0) * 1500;
  const devices = () => P.data.profile.devices || (P.data.profile.devices = DEV.map(x => ({ name: x[0], w: x[1], h: x[2] })));
  const whDay = () => devices().reduce((a, d) => a + (+d.w || 0) * (+d.h || 0), 0);
  P.calcSummary = () => {
    const p = P.data.profile, d = +p.days || 7, w = waterDay(), k = kcalDay(), wh = whDay();
    return '- **Water:** ' + w.toFixed(1) + ' gal (' + (w * 3.785).toFixed(0) + ' L) per day, ' + (w * d).toFixed(0) + ' gal (' + (w * d * 3.785).toFixed(0) + ' L) for ' + d + ' days. Stored now: ' + P.waterDays().toFixed(1) + ' days.\n- **Food:** about ' + k.toLocaleString() + ' kcal per day, ' + (k * d).toLocaleString() + ' kcal for ' + d + ' days (roughly ' + Math.ceil(k * d / 1650) + ' lb of dry rice equivalent).\n- **Power:** about ' + wh + ' Wh per day for the devices listed' + (+p.batteryWh ? '; your battery bank lasts about ' + (p.batteryWh * 0.85 / Math.max(1, wh)).toFixed(1) + ' days' : '') + '.';
  };

  /* ----- the 72-hour kit template, scaled to your household ----- */
  const template = () => {
    const p = P.data.profile, n = Math.max(1, people()), d = +p.days || 7, w = Math.ceil(waterDay() * d), kc = kcalDay() * d, mk = (cat, name, qty, unit) => ({ id: P.id(), cat, name, qty, unit: unit || '', have: false, expires: '', location: '', note: '' });
    const t = [mk('Water', 'Drinking water', w, 'gal'), mk('Water', 'Water purification tablets or drops', 1, 'pack'), mk('Water', 'Unscented household bleach (for disinfecting water)', 1, 'bottle'), mk('Water', 'Water filter rated for bacteria', 1), mk('Water', 'Collapsible water container', 2),
      mk('Food', 'Canned protein (meat, fish, beans)', Math.ceil(n * d * 1.5), 'cans'), mk('Food', 'Canned fruit and vegetables', Math.ceil(n * d), 'cans'), mk('Food', 'Rice, pasta or other dry grains', Math.ceil(kc * 0.4 / 1650), 'lb'), mk('Food', 'Peanut butter or nut butter', Math.ceil(n * d / 6), 'jars'), mk('Food', 'Energy bars and snacks', n * d, 'pcs'), mk('Food', 'Salt, sugar, cooking oil, spices', 1, 'set'), mk('Food', 'Manual can opener', 1),
      mk('First aid & health', 'First aid kit', 1), mk('First aid & health', 'Prescription medicines (at least a 7-day buffer)', 1), mk('First aid & health', 'Pain and fever medicine', 1), mk('First aid & health', 'Oral rehydration salts and anti-diarrhoeal', 1), mk('First aid & health', 'Bandages, gauze and tape', 1), mk('First aid & health', 'Tourniquet and trauma shears', 1), mk('First aid & health', 'Thermometer', 1), mk('First aid & health', 'N95 masks and gloves', n, 'each'), mk('First aid & health', 'Glasses or spare contact lenses', 1),
      mk('Light & power', 'Flashlights', n, 'each'), mk('Light & power', 'Spare batteries', 1, 'set'), mk('Light & power', 'Headlamps', 2), mk('Light & power', 'Power bank(s)', 2), mk('Light & power', 'Battery or hand-crank radio', 1), mk('Light & power', 'Solar phone charger', 1), mk('Light & power', 'Lighter and waterproof matches', 1), mk('Light & power', 'Car phone charger', 1),
      mk('Communication', 'FRS/GMRS handheld radios', 2, 'pair'), mk('Communication', 'Whistle (one each)', n, 'each'), mk('Communication', 'Printed contact list (your Binder)', 1), mk('Communication', 'Paper map of your area', 1), mk('Communication', 'Pen and notebook', 1),
      mk('Tools & safety', 'Multi-tool or knife', 1), mk('Tools & safety', 'Duct tape', 1), mk('Tools & safety', 'Tarp and rope', 1), mk('Tools & safety', 'Fire extinguisher', 1), mk('Tools & safety', 'Work gloves', n, 'pairs'), mk('Tools & safety', 'Wrench for gas / water shut-off', 1), mk('Tools & safety', 'Battery carbon monoxide alarm', 1), mk('Tools & safety', 'Sturdy shoes kept by the bed', n, 'pairs'),
      mk('Sanitation', 'Toilet paper', Math.ceil(n * d / 5), 'rolls'), mk('Sanitation', 'Heavy trash bags (for a bucket toilet)', 1, 'box'), mk('Sanitation', 'Soap and hand sanitiser', 1), mk('Sanitation', 'Wet wipes', 1, 'pack'), mk('Sanitation', 'Toothbrushes and toothpaste', n, 'sets'), mk('Sanitation', 'Feminine hygiene products', 1),
      mk('Documents & cash', 'ID, insurance and deed copies in a waterproof bag', 1), mk('Documents & cash', 'Cash in small notes', 1), mk('Documents & cash', 'Spare house and car keys', 1), mk('Documents & cash', 'USB drive with scans of documents', 1), mk('Documents & cash', 'Printed emergency binder', 1),
      mk('Clothing & bedding', 'Warm layers, hat and gloves', n, 'sets'), mk('Clothing & bedding', 'Rain jackets or ponchos', n, 'each'), mk('Clothing & bedding', 'Sleeping bags or blankets', n, 'each'), mk('Clothing & bedding', 'Spare socks and underwear', n, 'sets')];
    if (+p.pets) t.push(mk('Pets', 'Pet food', d, 'days'), mk('Pets', 'Pet water', Math.ceil(0.5 * d * p.pets), 'gal'), mk('Pets', 'Leash, carrier and ID tag', 1), mk('Pets', 'Pet medicines and vaccination records', 1));
    if (+p.children) t.push(mk('Baby & kids', 'Diapers, wipes or formula as needed', 1), mk('Baby & kids', 'Comfort items, games and books', 1), mk('Baby & kids', 'Child medicines', 1));
    return t;
  };

  P.sections.supplies = function (b, my) {
    const D = P.data, p = D.profile;
    const render = () => {
      const exp = D.supplies.filter(s => s.expires), now = Date.now(), expired = exp.filter(s => new Date(s.expires) < now), soon = exp.filter(s => new Date(s.expires) >= now && new Date(s.expires) < new Date(now + 60 * 864e5));
      const w = waterDay(), k = kcalDay(), wh = whDay(), d = +p.days || 7, sd = P.waterDays();
      b.innerHTML = '<div class="scroll pad" style="flex:1"><h2>Supplies</h2><div class="mute small">Tell Moundshroud about your household, see how much you need, and keep a checklist of what you have. Everything stays on this PC.</div>' +
        '<details class="card" open style="margin-top:10px"><summary style="cursor:pointer;font-weight:600">Your household</summary><div class="row" style="flex-wrap:wrap;gap:10px;margin-top:8px">' +
        [['adults', 'Adults'], ['children', 'Children'], ['pets', 'Pets'], ['days', 'Days to cover']].map(f => '<label class="small mute">' + f[1] + '<br><input type="number" min="0" max="50" data-pf="' + f[0] + '" value="' + (p[f[0]] || 0) + '" style="width:90px"></label>').join('') +
        '<label class="small mute">Climate<br><select data-pf="climate"><option value="cool"' + (p.climate === 'cool' ? ' selected' : '') + '>Cool</option><option value="temperate"' + (p.climate === 'temperate' ? ' selected' : '') + '>Temperate</option><option value="hot"' + (p.climate === 'hot' ? ' selected' : '') + '>Hot</option></select></label></div>' +
        '<label class="small mute" style="display:block;margin-top:8px">Special needs or medicines (used to tailor Moundshroud\'s emergency answers)<br><input type="text" data-pf="needs" value="' + esc(p.needs || '') + '" placeholder="e.g. insulin needs refrigeration, wheelchair user, infant formula"></label></details>' +
        '<details class="card" open><summary style="cursor:pointer;font-weight:600">What you need</summary><div class="stat" style="margin-top:8px"><div class="card"><b>' + (w * d).toFixed(0) + ' gal</b><span class="small mute">water for ' + d + ' days<br>(' + (w * d * 3.785).toFixed(0) + ' L, ' + Math.ceil(w * d / 5) + ' five-gallon jugs)</span></div><div class="card"><b>' + (k * d / 1000).toFixed(0) + 'k kcal</b><span class="small mute">food for ' + d + ' days<br>(' + k.toLocaleString() + ' kcal/day)</span></div><div class="card"><b>' + sd.toFixed(1) + ' d</b><span class="small mute">water stored now<br>(goal ' + d + ')</span></div></div>' +
        '<div class="small mute" style="margin-top:6px">Water: 1 gallon (3.8 L) per person per day, 50% more in a hot climate, 0.5 gal per pet. More for illness, pregnancy or nursing. Food: 2,000 kcal per adult, 1,500 per child per day. 1 lb dry rice is about 1,650 kcal; a 15 oz can of beans about 350 kcal.</div></details>' +
        '<details class="card"><summary style="cursor:pointer;font-weight:600">Power: how long will my batteries last?</summary><div id="pdev" style="margin-top:8px">' + devices().map((x, i) => '<div class="row" style="gap:6px;margin:3px 0"><input data-dn="' + i + '" value="' + esc(x.name) + '" style="flex:2"><input type="number" data-dw="' + i + '" value="' + x.w + '" style="width:72px" title="watts"><span class="small mute">W &times;</span><input type="number" data-dh="' + i + '" value="' + x.h + '" style="width:64px" title="hours a day"><span class="small mute">h</span><span class="ib dang" data-dd="' + i + '" style="cursor:pointer">&times;</span></div>').join('') + '<button class="ib" id="pdadd">+ Add device</button></div>' +
        '<div class="row" style="flex-wrap:wrap;gap:10px;margin-top:8px"><label class="small mute">Battery bank / power station (Wh)<br><input type="number" data-pf="batteryWh" value="' + (p.batteryWh || '') + '" style="width:130px" placeholder="e.g. 500"></label><label class="small mute">Solar panels (watts)<br><input type="number" data-pf="solarW" value="' + (p.solarW || '') + '" style="width:130px" placeholder="e.g. 100"></label></div>' +
        '<div class="stat" style="margin-top:8px"><div class="card"><b>' + wh + ' Wh</b><span class="small mute">needed per day</span></div><div class="card"><b>' + (+p.batteryWh ? (p.batteryWh * 0.85 / Math.max(1, wh)).toFixed(1) + ' d' : '-') + '</b><span class="small mute">battery lasts<br>(85% usable)</span></div><div class="card"><b>' + (+p.solarW ? (p.solarW * 4 * 0.75).toFixed(0) + ' Wh' : Math.ceil(wh / 3) + ' W') + '</b><span class="small mute">' + (+p.solarW ? 'solar per day<br>(4 sun-hours, 75%)' : 'solar panel<br>needed to break even') + '</span></div></div><div class="small mute">Fridges and heaters use far more than this list; a gas-free plan for those is a bigger system.</div></details>' +
        '<div class="card"><div class="row" style="flex-wrap:wrap;gap:8px"><b style="flex:1">Checklist (' + D.supplies.filter(s => s.have).length + ' of ' + D.supplies.length + ' have)</b><button class="pri" id="stpl">' + (D.supplies.length ? 'Add missing standard items' : 'Start my checklist') + '</button><button class="ib" id="srem">Set expiry reminders</button></div>' +
        (expired.length || soon.length ? '<div class="disc" style="margin-top:8px">' + (expired.length ? '<b class="bad">' + expired.length + ' expired:</b> ' + expired.map(s => esc(s.name)).join(', ') + '. ' : '') + (soon.length ? '<b>' + soon.length + ' expiring within 60 days:</b> ' + soon.map(s => esc(s.name)).join(', ') + '.' : '') + '</div>' : '') +
        '<div id="sinv" style="margin-top:8px">' + (D.supplies.length ? CATS.map(c => { const it = D.supplies.filter(s => s.cat === c); return it.length ? '<div class="grp">' + c + ' (' + it.filter(s => s.have).length + '/' + it.length + ')</div>' + it.map(s => '<div class="row" style="gap:6px;margin:3px 0;flex-wrap:wrap"><label class="chk" style="flex:3;min-width:180px;white-space:normal"><input type="checkbox" data-sh="' + s.id + '"' + (s.have ? ' checked' : '') + '> <span' + (s.have ? '' : ' class="mute"') + '>' + esc(s.name) + '</span></label><input type="number" min="0" data-sq="' + s.id + '" value="' + (s.qty || '') + '" style="width:62px" title="quantity"><span class="small mute" style="width:42px">' + esc(s.unit || '') + '</span><input type="date" data-se="' + s.id + '" value="' + esc(s.expires || '') + '" style="width:140px" title="expires"><input data-sl="' + s.id + '" value="' + esc(s.location || '') + '" placeholder="where" style="width:100px"><span class="ib dang" data-sd="' + s.id + '" style="cursor:pointer">&times;</span></div>').join('') : ''; }).join('') : '<div class="mute small">Your list is empty. "Start my checklist" adds about 60 standard items sized for your household.</div>') + '</div>' +
        '<div class="row" style="flex-wrap:wrap;gap:6px;margin-top:10px"><select id="anc">' + CATS.map(c => '<option>' + c + '</option>').join('') + '</select><input id="ann" type="text" placeholder="Add your own item..." style="flex:1;min-width:150px"><button class="ib" id="ana">Add</button></div></div></div>';
      wire();
    };
    function wire() {
      b.onchange = e => {
        const t = e.target;
        if (t.dataset.pf) { const k = t.dataset.pf; p[k] = t.type === 'number' ? Math.max(k === 'days' ? 1 : 0, +t.value || 0) : t.value; P.save(); if (/^(adults|children|pets|days|climate|batteryWh|solarW)$/.test(k)) render(); return; }
        if (t.dataset.dn != null) { devices()[+t.dataset.dn].name = t.value; P.save(); return; }
        if (t.dataset.dw != null) { devices()[+t.dataset.dw].w = Math.max(0, +t.value || 0); P.save(); render(); return; }
        if (t.dataset.dh != null) { devices()[+t.dataset.dh].h = Math.min(24, Math.max(0, +t.value || 0)); P.save(); render(); return; }
        const find = id => D.supplies.find(s => s.id === id);
        if (t.dataset.sh) { find(t.dataset.sh).have = t.checked; P.save(); render(); }
        else if (t.dataset.sq) { find(t.dataset.sq).qty = Math.max(0, +t.value || 0); P.save(); }
        else if (t.dataset.se) { find(t.dataset.se).expires = t.value; P.save(); render(); }
        else if (t.dataset.sl) { find(t.dataset.sl).location = t.value; P.save(); }
      };
      b.onclick = async e => {
        const t = e.target.closest('[data-sd],[data-dd],#pdadd,#stpl,#srem,#ana'); if (!t) return;
        if (t.dataset.sd) { D.supplies = D.supplies.filter(s => s.id !== t.dataset.sd); P.save(); render(); }
        else if (t.dataset.dd != null) { devices().splice(+t.dataset.dd, 1); P.save(); render(); }
        else if (t.id === 'pdadd') { devices().push({ name: 'New device', w: 10, h: 1 }); P.save(); render(); }
        else if (t.id === 'stpl') { const have = new Set(D.supplies.map(s => s.name.toLowerCase())); const add = template().filter(x => !have.has(x.name.toLowerCase())); D.supplies.push(...add); P.save(); A.toast(add.length ? add.length + ' items added' : 'Nothing new to add'); render(); }
        else if (t.id === 'ana') { const n = $('ann').value.trim(); if (!n) return; D.supplies.push({ id: P.id(), cat: $('anc').value, name: n, qty: 1, unit: '', have: false, expires: '', location: '', note: '' }); P.save(); render(); }
        else if (t.id === 'srem') {
          let n = 0; for (const s of D.supplies) {
            if (!s.expires || D.done['rem:' + s.id] === s.expires) continue; const exp = new Date(s.expires + 'T09:00:00'); if (isNaN(exp) || exp < Date.now()) continue;
            let at = exp.getTime() - 30 * 864e5; if (at < Date.now() + 36e5) at = Date.now() + 36e5; await A.api('/api/reminders', { text: 'Supplies expiring soon: ' + s.name + ' (' + s.expires + ')', at }); D.done['rem:' + s.id] = s.expires; n++;
          }
          P.save(); A.toast(n ? n + ' reminder' + (n > 1 ? 's' : '') + ' set (30 days before each date)' : 'Add expiry dates first, or reminders are already set');
        }
      };
    }
    render();
  };
})();

// Weather, fully offline: log barometer and sky readings, get a forecast from the pressure trend, wind and clouds, plus calculators and a field guide.
(() => {
  const Sky = A.sky; if (!Sky) return;
  const mod = (x, m) => ((x % m) + m) % m;
  const U0 = { p: 'hPa', t: 'C', s: 'kph', a: 'm' };
  let U; try { U = Object.assign({}, U0, JSON.parse(ls.get('wx_units', '{}'))); } catch (e) { U = Object.assign({}, U0); }
  const PF = { hPa: 1, mb: 1, kPa: 10, inHg: 33.8639, mmHg: 1.33322 }, SF = { kph: 1, mph: 1.609344, kn: 1.852, 'm/s': 3.6 };
  const toHpa = (v, u) => v * PF[u], fromHpa = (v, u) => v / PF[u];
  const toC = (v, u) => u === 'F' ? (v - 32) * 5 / 9 : v, fromC = (v, u) => u === 'F' ? v * 9 / 5 + 32 : v;
  const toKph = (v, u) => v * SF[u], fromKph = (v, u) => v / SF[u];
  const sea = (p, altM, tC) => p * Math.pow(1 - 0.0065 * altM / (tC + 0.0065 * altM + 273.15), -5.257);   // station pressure -> sea level
  const DIRS = ['N', 'NNE', 'NE', 'ENE', 'E', 'ESE', 'SE', 'SSE', 'S', 'SSW', 'SW', 'WSW', 'W', 'WNW', 'NW', 'NNW'];
  const SKY = [['clear', 'Clear'], ['cirrus', 'Cirrus (thin wispy streaks, high)'], ['cirrostratus', 'Cirrostratus (thin veil, halo round Sun or Moon)'], ['altocumulus', 'Altocumulus (patchy small puffs, mid-level)'], ['altostratus', 'Altostratus (grey sheet, Sun a dim disc)'], ['cumulus', 'Cumulus (fair-weather puffs)'], ['towering', 'Towering cumulus (tall, building)'], ['stratocumulus', 'Stratocumulus (low lumpy layer)'], ['stratus', 'Stratus (low grey blanket, fog above ground)'], ['nimbostratus', 'Nimbostratus (dark, steady rain or snow)'], ['cumulonimbus', 'Cumulonimbus (anvil top, thunderstorm)']];
  const SKYSAY = {
    clear: 'Clear sky: fair now. A clear, calm night turns colder.', cirrus: 'Cirrus: ice clouds very high up. If they thicken and lower from the west, a front and rain may arrive in 24 hours or more.',
    cirrostratus: 'Cirrostratus with a halo: moisture is moving in. Rain or snow often follows within 12 to 24 hours.', altocumulus: 'Altocumulus: fair now, but on a warm humid morning it can mean afternoon thunderstorms.',
    altostratus: 'Altostratus: a warm front is close. Steady rain or snow usually arrives in 6 to 12 hours.', cumulus: 'Small cumulus: fair weather. If they stay small and flat-bottomed through the day, it should stay dry.',
    towering: 'Towering cumulus: strong updrafts. Showers or a thunderstorm are likely within hours. Watch for an anvil.', stratocumulus: 'Stratocumulus: grey and dull but usually dry; light drizzle is possible.',
    stratus: 'Stratus: low grey cloud, drizzle or fog. Often clears slowly by midday if the wind picks up.', nimbostratus: 'Nimbostratus: steady rain or snow for hours. It is the main rain cloud of a warm front.',
    cumulonimbus: 'Cumulonimbus: thunderstorm. Heavy rain, lightning, hail and gusts. Get indoors or into a car now; stay away from water and open ground.'
  };
  const BEAU = [[0, 'Calm', 'Smoke rises straight up', 1], [1, 'Light air', 'Smoke drifts; vanes do not move', 5], [2, 'Light breeze', 'Wind felt on face; leaves rustle', 11], [3, 'Gentle breeze', 'Leaves and twigs in constant motion', 19], [4, 'Moderate breeze', 'Dust and paper lifted; small branches move', 28], [5, 'Fresh breeze', 'Small trees sway', 38], [6, 'Strong breeze', 'Large branches move; umbrellas hard to use', 49], [7, 'Near gale', 'Whole trees sway; walking against wind is hard', 61], [8, 'Gale', 'Twigs break; walking very difficult', 74], [9, 'Strong gale', 'Slight damage to roofs and chimneys', 88], [10, 'Storm', 'Trees uprooted; considerable damage', 102], [11, 'Violent storm', 'Widespread damage', 117], [12, 'Hurricane', 'Devastation', 999]];
  const beau = kph => BEAU.find(b => kph <= b[3]) || BEAU[12];
  const CLOUDS = [['Cirrus', 'very high (6-12 km)', 'Thin, white, feathery streaks of ice crystals.', 'Fair now. If they thicken and spread, a front is 1 to 2 days away.'], ['Cirrostratus', 'very high', 'A thin milky veil that makes a halo round the Sun or Moon.', 'Rain or snow likely within 12 to 24 hours.'], ['Cirrocumulus', 'very high', '"Mackerel sky": tiny rippled white patches.', 'Short-lived; often comes before a change in the weather.'], ['Altocumulus', 'middle (2-6 km)', 'Grey-white patches or rolls, each bigger than your thumb at arm\'s length.', 'Fair; on a humid warm morning, storms can build later.'], ['Altostratus', 'middle', 'Grey-blue sheet; Sun shows as a dim blurry disc, no halo.', 'Steady rain or snow within hours.'], ['Stratus', 'low (below 2 km)', 'Uniform grey blanket; like fog that has lifted.', 'Drizzle, mist, gloom. Often burns off.'], ['Stratocumulus', 'low', 'Lumpy grey and white layer with gaps.', 'Mostly dry; a little drizzle sometimes.'], ['Nimbostratus', 'low to middle', 'Thick, dark, shapeless; steady precipitation falls from it.', 'Rain or snow for hours.'], ['Cumulus', 'low', 'Fluffy cotton balls with flat bases.', 'Fair weather if they stay small.'], ['Cumulonimbus', 'low base, towers to 12+ km', 'Giant tower with an anvil or flat top.', 'Thunderstorm: lightning, hail, gusts, downpour.']];
  const LORE = [['"Red sky at night, shepherd\'s delight; red sky in morning, shepherd\'s warning."', 'Works in mid-latitudes where weather moves west to east: a red sunset means dry air to the west is coming; a red dawn means the dry air has passed and moisture follows.'], ['Ring round the Moon', 'Ice-crystal cirrostratus. The more stars inside the ring, the thicker the cloud (and sooner the rain).'], ['Smoke rising straight up vs. falling', 'Smoke that rises means high pressure and fair weather; smoke that spreads low means low pressure and rain.'], ['Pine cones close, seaweed damp', 'Both respond to humidity, so a closing cone suggests rain is more likely.'], ['Crickets', 'Count chirps in 14 seconds and add 40 to get roughly the temperature in °F (snowy tree crickets).'], ['Dew on grass at dawn', 'Clear, calm night with moist air: usually a fair day follows.'], ['Birds flying low, swallows near the ground', 'Insects fly low in damp air before rain, and the birds follow them.'], ['Wind backing (turning counterclockwise)', 'Northern Hemisphere: a low is approaching, weather worsens. Veering (clockwise) means clearing. Reversed in the Southern Hemisphere.']];

  function load() { try { return JSON.parse(ls.get('wx_log', '[]')); } catch (e) { return []; } }
  const save = a => ls.set('wx_log', JSON.stringify(a.slice(-400)));
  const altM = () => +ls.get('wx_alt', '0') || 0;

  function trendOf(log) {                   // pressure change per 3 hours from sea-level readings
    if (!log.length) return null; const L = log[log.length - 1]; let best = null;
    for (const o of log) { const dt = (L.t - o.t) / 36e5; if (dt >= 1.2 && dt <= 7) { if (!best || Math.abs(dt - 3) < Math.abs((L.t - best.t) / 36e5 - 3)) best = o; } }
    if (!best) return { manual: L.tend || null, rate: null, L };
    const dt = (L.t - best.t) / 36e5; return { rate: (L.p - best.p) * 3 / dt, hours: dt, L };
  }
  const TLAB = ['rapidly falling', 'falling', 'steady', 'rising', 'rapidly rising'];
  const cls = r => r <= -6 ? 0 : r <= -1.6 ? 1 : r < 1.6 ? 2 : r < 6 ? 3 : 4;
  function forecast(log) {
    if (!log.length) return null; const L = log[log.length - 1], tr = trendOf(log), loc = Sky.loc(), south = loc && loc.lat < 0;
    let ti = tr && tr.rate != null ? cls(tr.rate) : (tr && tr.manual != null ? +tr.manual : null);
    const lvl = L.p < 1005 ? 0 : L.p > 1020 ? 2 : 1, out = { lines: [], warn: [], head: '', conf: '' };
    if (ti == null) { out.head = 'Not enough history yet'; out.lines.push('Log a second pressure reading about 3 hours after this one (or choose the needle direction when you log). Pressure is ' + (lvl === 0 ? 'low' : lvl === 2 ? 'high' : 'near normal') + ' at ' + L.p.toFixed(0) + ' hPa: ' + (lvl === 0 ? 'unsettled weather is more likely.' : lvl === 2 ? 'fair weather is more likely.' : 'no strong signal.')); out.conf = 'low'; }
    else {
      const T = [
        ['A storm is likely to arrive within hours', ['Strong wind and heavy rain or snow are possible. Secure loose objects, charge devices and stay off the water.']],
        [['Rain or showers likely', 'Clouding over, rain in 6 to 12 hours', 'Fair now but deteriorating within a day'][lvl], [['Wind is increasing; unsettled and wet.'], ['Cloud will thicken and the wind will rise.'], ['Change is coming; do outdoor jobs now.']][lvl]],
        [['Unsettled and changeable', 'No real change: continue as you are', 'Fair and settled'][lvl], [['Showers come and go.'], ['Today\'s weather carries on.'], ['Dry, clear, light winds. Fog or frost possible at night.']][lvl]],
        [['Clearing, still breezy', 'Improving, fair soon', 'Fair and dry, getting better'][lvl], [['Showers ending; the wind eases through the day.'], ['Cloud breaks up and the sky brightens.'], ['Stable dry weather. Cold clear nights in cooler months.']][lvl]],
        ['Clearing quickly but gusty', ['A fast rise often means a short break. Expect changes again in a day or so.']]
      ][ti];
      out.head = T[0]; out.lines = T[1].slice(); out.conf = tr && tr.rate != null ? (tr.hours >= 2.5 ? 'good' : 'fair') : 'fair (based on the needle direction you chose)';
      if (ti === 0) out.warn.push('Pressure is falling very fast (6 hPa or more in 3 hours). That often means a gale or severe storm soon.');
    }
    /* wind: Buys Ballot and backing / veering */
    const w = log.filter(o => o.wd != null); if (L.wd != null && L.ws > 3) {
      const low = mod(L.wd + (south ? -90 : 90), 360); out.lines.push('Wind from the ' + DIRS[Math.round(L.wd / 22.5) % 16] + ' (' + L.ws.toFixed(0) + ' km/h). With your back to the wind, the centre of low pressure is toward ' + DIRS[Math.round(low / 22.5) % 16] + ' (Buys Ballot\'s law).');
      const prev = w.length > 1 ? w[w.length - 2] : null; if (prev && prev.wd != null && L.t - prev.t < 12 * 36e5) { let dd = ((L.wd - prev.wd + 540) % 360) - 180; if (Math.abs(dd) > 25) { const backing = dd < 0; const worse = south ? !backing : backing; out.lines.push('The wind has ' + (backing ? 'backed (turned counterclockwise)' : 'veered (turned clockwise)') + ' by about ' + Math.abs(dd).toFixed(0) + '° since the last reading: ' + (worse ? 'a sign of worsening weather.' : 'a sign of clearing or improving weather.')); } }
    }
    if (L.ws >= 62) out.warn.push('Wind of gale force (Beaufort 8+). Avoid being outdoors and keep away from trees.');
    if (L.sky && SKYSAY[L.sky]) out.lines.push(SKYSAY[L.sky]); if (L.sky === 'cumulonimbus') out.warn.push('Thunderstorm cloud reported. Get inside.');
    if (L.t_c != null && L.rh != null) { const dp = dew(L.t_c, L.rh); if (L.t_c - dp < 2.5) out.lines.push('Air is close to saturated (dew point ' + dp.toFixed(1) + '°C): fog, dew or frost is likely if it cools.'); if (L.t_c <= 3 && L.t_c - dp < 3) out.lines.push('Cold and damp: watch for ice on roads and surfaces overnight.'); }
    return out;
  }
  const dew = (t, rh) => { const a = 17.625, b = 243.04, g = Math.log(Math.max(1, rh) / 100) + a * t / (b + t); return b * g / (a - g); };

  Sky.reg('weather', 'Weather', body => {
    const log = load(), loc = Sky.loc();
    body.innerHTML = '<div class="scroll pad" style="flex:1"><div class="skg">' +
      '<div class="card"><b>🌡️ Log a reading</b><div class="mute small" style="margin:2px 0 8px">Use a barometer, a weather station, a phone (pressure sensor) or just look outside. Only the pressure is required.</div><div id="wxf"></div></div>' +
      '<div><div class="card" id="wxfc"></div><div class="card"><b>Pressure over the last 3 days</b><canvas id="wxcv" width="520" height="190" style="width:100%;margin-top:6px"></canvas><div class="mute small" id="wxcap"></div></div></div></div>' +
      '<div class="card"><div class="row" style="justify-content:space-between"><b>Readings</b><button class="skbtn" id="wxclr">Clear all</button></div><div id="wxlist" class="small" style="margin-top:6px"></div></div>' +
      '<div class="card"><b>🧮 Calculators</b><div class="skg" style="margin-top:6px" id="wxcalc"></div></div>' +
      '<details class="card"><summary style="cursor:pointer;font-weight:600">☁️ Cloud identification guide</summary><table class="sktab" style="margin-top:6px"><tr><th>Cloud</th><th>Height</th><th>Look</th><th>Means</th></tr>' + CLOUDS.map(c => '<tr><td><b>' + c[0] + '</b></td><td>' + c[1] + '</td><td>' + c[2] + '</td><td>' + c[3] + '</td></tr>').join('') + '</table></details>' +
      '<details class="card"><summary style="cursor:pointer;font-weight:600">💨 Wind: the Beaufort scale</summary><table class="sktab" style="margin-top:6px"><tr><th>Force</th><th>Name</th><th>Up to km/h</th><th>What you see</th></tr>' + BEAU.map(b => '<tr><td>' + b[0] + '</td><td><b>' + b[1] + '</b></td><td>' + (b[3] > 900 ? '118+' : b[3]) + '</td><td>' + b[2] + '</td></tr>').join('') + '</table></details>' +
      '<details class="card"><summary style="cursor:pointer;font-weight:600">🌅 Weather signs and sayings</summary><ul style="margin:8px 0 0;padding-left:1.2em;line-height:1.5">' + LORE.map(l => '<li><b>' + l[0] + '</b> ' + l[1] + '</li>').join('') + '</ul></details>' +
      '<details class="card"><summary style="cursor:pointer;font-weight:600">⚡ Storm safety</summary><ul style="margin:8px 0 0;padding-left:1.2em;line-height:1.5"><li><b>When thunder roars, go indoors.</b> If you can hear thunder, lightning can reach you. Wait 30 minutes after the last thunder.</li><li>Shelter in a building or a hard-topped vehicle. Avoid open fields, hilltops, water, isolated trees and metal fences.</li><li>Stay away from plumbing, corded phones and electronics plugged into the wall.</li><li>In the open with nowhere to go: crouch on the balls of your feet, feet together, and make yourself small. Do not lie flat.</li><li>Flooded road: turn around, do not drive through. Tornado: go to the lowest interior room, away from windows.</li><li>Heat: drink water, rest in shade, check on neighbours. Cold: layer up, keep dry, and never run a generator or grill indoors.</li></ul></details>' +
      '<div class="mute small" style="margin:6px 2px">Forecasts from a single barometer are local and short-range (next 6 to 12 hours). They are rules of thumb that sailors and mountaineers used for centuries; they cannot match a satellite forecast. Always follow official warnings when you can get them.</div></div>';
    const q = id => body.querySelector('#' + id), now = Date.now();
    const isoLocal = ms => new Date(ms - new Date(ms).getTimezoneOffset() * 6e4).toISOString().slice(0, 16);
    const opt = (arr, sel) => arr.map(a => '<option' + (a === sel ? ' selected' : '') + '>' + a + '</option>').join('');
    q('wxf').innerHTML =
      '<div class="row" style="gap:6px;flex-wrap:wrap"><input class="skin" id="wp" type="number" step="any" placeholder="Pressure" style="width:100px"><select class="skin" id="wpu">' + opt(Object.keys(PF), U.p) + '</select><label class="small" style="display:flex;gap:4px;align-items:center"><input type="checkbox" id="wadj" ' + (ls.get('wx_adj', '1') === '1' ? 'checked' : '') + '>already "sea-level" (home barometers are)</label></div>' +
      '<div class="row" style="gap:6px;flex-wrap:wrap;margin-top:6px"><span class="small">Height above sea level</span><input class="skin" id="wal" type="number" step="any" style="width:80px" value="' + (U.a === 'ft' ? Math.round(altM() * 3.28084) : altM()) + '"><select class="skin" id="wau">' + opt(['m', 'ft'], U.a) + '</select></div>' +
      '<div class="row" style="gap:6px;flex-wrap:wrap;margin-top:6px"><input class="skin" id="wt" type="number" step="any" placeholder="Temp" style="width:80px"><select class="skin" id="wtu">' + opt(['C', 'F'], U.t) + '</select><input class="skin" id="wrh" type="number" min="1" max="100" placeholder="Humidity %" style="width:100px"></div>' +
      '<div class="row" style="gap:6px;flex-wrap:wrap;margin-top:6px"><select class="skin" id="wwd"><option value="">Wind from...</option>' + DIRS.map((d, i) => '<option value="' + i * 22.5 + '">' + d + '</option>').join('') + '</select><input class="skin" id="wws" type="number" min="0" step="any" placeholder="Speed" style="width:80px"><select class="skin" id="wsu">' + opt(Object.keys(SF), U.s) + '</select></div>' +
      '<div class="row" style="gap:6px;flex-wrap:wrap;margin-top:6px"><select class="skin" id="wsk" style="flex:1;min-width:220px"><option value="">Sky now (optional)</option>' + SKY.map(s => '<option value="' + s[0] + '">' + s[1] + '</option>').join('') + '</select></div>' +
      '<div class="row" style="gap:6px;flex-wrap:wrap;margin-top:6px"><select class="skin" id="wtn"><option value="">Barometer needle (if no history)</option><option value="1">Falling</option><option value="2">Steady</option><option value="3">Rising</option><option value="0">Falling fast</option><option value="4">Rising fast</option></select><input class="skin" id="wtm" type="datetime-local" value="' + isoLocal(now) + '"></div>' +
      '<div style="margin-top:8px"><button class="skbtn on" id="wsave">Save reading and forecast</button></div>';
    q('wsave').onclick = () => {
      const pv = parseFloat(q('wp').value), pu = q('wpu').value, tu = q('wtu').value, su = q('wsu').value, au = q('wau').value; if (isNaN(pv)) { A.toast('Type the pressure first.'); return; }
      const av = parseFloat(q('wal').value) || 0, am = au === 'ft' ? av / 3.28084 : av, tv = parseFloat(q('wt').value), tC = isNaN(tv) ? 15 : toC(tv, tu);
      let hp = toHpa(pv, pu); if (!q('wadj').checked) hp = sea(hp, am, tC);
      if (hp < 850 || hp > 1090) { A.toast('That pressure looks wrong (' + hp.toFixed(0) + ' hPa at sea level). Check the unit.', 4500); return; }
      U = { p: pu, t: tu, s: su, a: au }; ls.set('wx_units', JSON.stringify(U)); ls.set('wx_adj', q('wadj').checked ? '1' : '0'); ls.set('wx_alt', String(am));
      const t = new Date(q('wtm').value).getTime() || Date.now(), ws = parseFloat(q('wws').value), rh = parseFloat(q('wrh').value);
      const e = { t, p: hp, t_c: isNaN(tv) ? null : tC, rh: isNaN(rh) ? null : rh, wd: q('wwd').value === '' ? null : +q('wwd').value, ws: isNaN(ws) ? null : toKph(ws, su), sky: q('wsk').value || null, tend: q('wtn').value === '' ? null : +q('wtn').value };
      const all = load(); all.push(e); all.sort((a, b) => a.t - b.t); save(all); Sky.refresh();
    };
    /* forecast */
    const fc = forecast(log), box = q('wxfc');
    if (!fc) box.innerHTML = '<b>Forecast</b><div class="mute small" style="margin-top:4px">Save a reading to get a forecast. The more readings you log through the day, the better it gets.</div>';
    else {
      const L = log[log.length - 1], tr = trendOf(log), age = (Date.now() - L.t) / 36e5;
      box.innerHTML = '<div class="mute small">Next 6 to 12 hours' + (age > 6 ? ' &middot; <span style="color:var(--warn)">last reading is ' + Math.round(age) + ' hours old</span>' : '') + '</div><div style="font-size:19px;font-weight:700;margin:2px 0 6px">' + esc(fc.head) + '</div>' + fc.warn.map(w => '<div style="color:var(--bad);margin:4px 0"><b>⚠ ' + esc(w) + '</b></div>').join('') + '<ul style="margin:4px 0 6px;padding-left:1.2em;line-height:1.5">' + fc.lines.map(l => '<li>' + esc(l) + '</li>').join('') + '</ul>' +
        '<div class="skrow"><span>Pressure (sea level)</span><b>' + fromHpa(L.p, U.p).toFixed(U.p === 'inHg' ? 2 : 1) + ' ' + U.p + '</b></div><div class="skrow"><span>Trend</span><b>' + (tr && tr.rate != null ? TLAB[cls(tr.rate)] + ' (' + (tr.rate >= 0 ? '+' : '') + tr.rate.toFixed(1) + ' hPa per 3 h)' : tr && tr.manual != null ? TLAB[tr.manual] + ' (from needle)' : 'unknown') + '</b></div><div class="skrow"><span>Confidence</span><b>' + fc.conf + '</b></div>' + (L.ws != null ? '<div class="skrow"><span>Wind</span><b>Force ' + beau(L.ws)[0] + ', ' + beau(L.ws)[1].toLowerCase() + '</b></div>' : '');
    }
    /* chart */
    const cv = q('wxcv'), c = cv.getContext('2d'), W = cv.width, H = cv.height, from = now - 72 * 36e5, pts = log.filter(o => o.t >= from - 6 * 36e5);
    c.clearRect(0, 0, W, H); c.font = '11px system-ui'; c.fillStyle = '#9aa3ba'; c.strokeStyle = '#2a3042';
    if (pts.length < 1) { c.fillText('No readings yet.', 12, 24); }
    else {
      let lo = Math.min(...pts.map(o => o.p)), hi = Math.max(...pts.map(o => o.p)); lo = Math.floor((lo - 2) / 2) * 2; hi = Math.ceil((hi + 2) / 2) * 2; if (hi - lo < 10) { const m = (hi + lo) / 2; lo = m - 5; hi = m + 5; }
      const X = t => 40 + (t - from) / (now - from) * (W - 54), Y = p => H - 24 - (p - lo) / (hi - lo) * (H - 40);
      for (let p = Math.ceil(lo / 5) * 5; p <= hi; p += 5) { c.beginPath(); c.moveTo(40, Y(p)); c.lineTo(W - 10, Y(p)); c.stroke(); c.fillText(String(p), 6, Y(p) + 4); }
      for (let h = 0; h <= 72; h += 12) { const x = X(now - h * 36e5); c.fillText(h === 0 ? 'now' : '-' + h + 'h', x - 10, H - 6); }
      c.strokeStyle = '#8b7cff'; c.lineWidth = 2; c.beginPath(); pts.forEach((o, i) => { const x = Math.max(40, X(o.t)), y = Y(o.p); if (i) c.lineTo(x, y); else c.moveTo(x, y); }); c.stroke(); c.fillStyle = '#46d7c8'; pts.forEach(o => { c.beginPath(); c.arc(Math.max(40, X(o.t)), Y(o.p), 3.5, 0, 7); c.fill(); });
      q('wxcap').textContent = 'hPa at sea level. Rising line = improving weather, falling line = worsening. 1000 hPa and below is low; above 1020 is high.';
    }
    /* list */
    const list = q('wxlist'); list.innerHTML = log.length ? log.slice().reverse().slice(0, 40).map((o, i) => '<div class="skrow"><span>' + Sky.fmtDT(o.t) + '</span><span>' + fromHpa(o.p, U.p).toFixed(U.p === 'inHg' ? 2 : 1) + ' ' + U.p + (o.t_c != null ? ' · ' + fromC(o.t_c, U.t).toFixed(0) + '°' + U.t : '') + (o.wd != null ? ' · ' + DIRS[Math.round(o.wd / 22.5) % 16] + ' ' + (o.ws != null ? fromKph(o.ws, U.s).toFixed(0) + ' ' + U.s : '') : '') + (o.sky ? ' · ' + o.sky : '') + ' <a href="#" data-del="' + o.t + '" class="mute">remove</a></span></div>').join('') : '<span class="mute">Nothing logged yet.</span>';
    list.onclick = e => { const t = e.target.dataset.del; if (!t) return; e.preventDefault(); save(load().filter(o => String(o.t) !== t)); Sky.refresh(); };
    q('wxclr').onclick = () => { if (confirm('Delete every weather reading?')) { save([]); Sky.refresh(); } };
    /* calculators */
    const cc = q('wxcalc');
    cc.innerHTML = '<div class="card" style="margin:0"><b>Dew point and cloud base</b><div class="row" style="gap:6px;margin:6px 0"><input class="skin" id="c1t" type="number" placeholder="Temp °C" style="width:90px"><input class="skin" id="c1h" type="number" placeholder="Humidity %" style="width:100px"></div><div class="small" id="c1o"></div></div>' +
      '<div class="card" style="margin:0"><b>Heat index / wind chill</b><div class="row" style="gap:6px;margin:6px 0"><input class="skin" id="c2t" type="number" placeholder="Temp °C" style="width:90px"><input class="skin" id="c2h" type="number" placeholder="Humidity %" style="width:100px"><input class="skin" id="c2w" type="number" placeholder="Wind km/h" style="width:100px"></div><div class="small" id="c2o"></div></div>' +
      '<div class="card" style="margin:0"><b>How far is the lightning?</b><div class="row" style="gap:6px;margin:6px 0"><input class="skin" id="c3s" type="number" placeholder="Seconds from flash to thunder" style="width:200px"></div><div class="small" id="c3o"></div></div>' +
      '<div class="card" style="margin:0"><b>Pressure converter</b><div class="row" style="gap:6px;margin:6px 0"><input class="skin" id="c4v" type="number" step="any" placeholder="Value" style="width:90px"><select class="skin" id="c4u">' + opt(Object.keys(PF), 'hPa') + '</select></div><div class="small" id="c4o"></div></div>';
    const $$ = id => cc.querySelector('#' + id);
    const c1 = () => { const t = parseFloat($$('c1t').value), h = parseFloat($$('c1h').value); if (isNaN(t) || isNaN(h)) { $$('c1o').textContent = ''; return; } const dp = dew(t, h), cb = Math.max(0, (t - dp) * 125); $$('c1o').innerHTML = 'Dew point <b>' + dp.toFixed(1) + '°C</b> (' + (dp * 9 / 5 + 32).toFixed(0) + '°F). Cloud base about <b>' + Math.round(cb) + ' m</b> (' + Math.round(cb * 3.28) + ' ft). ' + (t - dp < 2.5 ? 'Fog, dew or frost is likely.' : t - dp < 5 ? 'Humid; mist possible.' : 'Comfortably dry air.'); };
    const c2 = () => { const t = parseFloat($$('c2t').value), h = parseFloat($$('c2h').value), w = parseFloat($$('c2w').value), F = isNaN(t) ? NaN : t * 9 / 5 + 32; let s = ''; if (!isNaN(F) && !isNaN(h) && F >= 80) { const hi = -42.379 + 2.04901523 * F + 10.14333127 * h - 0.22475541 * F * h - 0.00683783 * F * F - 0.05481717 * h * h + 0.00122874 * F * F * h + 0.00085282 * F * h * h - 0.00000199 * F * F * h * h; s += 'Heat index feels like <b>' + ((hi - 32) * 5 / 9).toFixed(0) + '°C</b> (' + hi.toFixed(0) + '°F). ' + (hi > 125 ? 'Extreme danger.' : hi > 103 ? 'Danger: heat stroke possible.' : hi > 90 ? 'Caution: heat exhaustion possible.' : ''); } if (!isNaN(F) && !isNaN(w) && F <= 50 && w >= 5) { const mph = w / 1.609344, wc = 35.74 + 0.6215 * F - 35.75 * Math.pow(mph, 0.16) + 0.4275 * F * Math.pow(mph, 0.16); s += 'Wind chill feels like <b>' + ((wc - 32) * 5 / 9).toFixed(0) + '°C</b> (' + wc.toFixed(0) + '°F). ' + (wc < -18 ? 'Frostbite in 30 minutes or less.' : wc < 0 ? 'Cover exposed skin.' : ''); } $$('c2o').innerHTML = s || '<span class="mute">Heat index needs 27°C or hotter; wind chill needs 10°C or colder and some wind.</span>'; };
    const c3 = () => { const s = parseFloat($$('c3s').value); $$('c3o').innerHTML = isNaN(s) ? '' : 'About <b>' + (s / 2.9).toFixed(1) + ' km</b> (' + (s / 4.7).toFixed(1) + ' miles) away. ' + (s < 10 ? 'Very close: take shelter now.' : s < 30 ? 'Within strike range. Go indoors.' : 'Keep an eye on it.'); };
    const c4 = () => { const v = parseFloat($$('c4v').value), u = $$('c4u').value; if (isNaN(v)) { $$('c4o').textContent = ''; return; } const hp = toHpa(v, u); $$('c4o').innerHTML = Object.keys(PF).filter(k => k !== 'mb').map(k => '<b>' + fromHpa(hp, k).toFixed(k === 'inHg' ? 2 : 1) + '</b> ' + k).join(' &middot; '); };
    ['c1t', 'c1h'].forEach(i => $$(i).oninput = c1); ['c2t', 'c2h', 'c2w'].forEach(i => $$(i).oninput = c2); $$('c3s').oninput = c3; $$('c4v').oninput = c4; $$('c4u').onchange = c4;
  }, 5);
})();

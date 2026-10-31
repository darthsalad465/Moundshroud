// Sky tab: shell, location, object catalogue and the "Tonight" page. Other pages register with A.sky.reg().
(() => {
  const root = document.getElementById('p-sky'); if (!root || !window.SkyCore) return;
  const S = window.SkyCore;
  const CITIES = [['New York', 40.71, -74.01], ['Los Angeles', 34.05, -118.24], ['Chicago', 41.88, -87.63], ['Houston', 29.76, -95.37], ['Phoenix', 33.45, -112.07], ['Philadelphia', 39.95, -75.17], ['San Antonio', 29.42, -98.49], ['San Diego', 32.72, -117.16], ['Dallas', 32.78, -96.8], ['Seattle', 47.61, -122.33], ['Denver', 39.74, -104.99], ['Boston', 42.36, -71.06], ['Atlanta', 33.75, -84.39], ['Miami', 25.76, -80.19], ['Minneapolis', 44.98, -93.27], ['Anchorage', 61.22, -149.9], ['Honolulu', 21.31, -157.86], ['Toronto', 43.65, -79.38], ['Vancouver', 49.28, -123.12], ['Mexico City', 19.43, -99.13], ['Havana', 23.11, -82.37], ['Bogota', 4.71, -74.07], ['Lima', -12.05, -77.04], ['Santiago', -33.45, -70.67], ['Buenos Aires', -34.6, -58.38], ['Sao Paulo', -23.55, -46.63], ['London', 51.51, -0.13], ['Dublin', 53.35, -6.26], ['Paris', 48.86, 2.35], ['Madrid', 40.42, -3.7], ['Rome', 41.9, 12.5], ['Berlin', 52.52, 13.41], ['Athens', 37.98, 23.73], ['Reykjavik', 64.15, -21.94], ['Oslo', 59.91, 10.75], ['Moscow', 55.76, 37.62], ['Cairo', 30.04, 31.24], ['Lagos', 6.52, 3.38], ['Nairobi', -1.29, 36.82], ['Cape Town', -33.92, 18.42], ['Jerusalem', 31.77, 35.22], ['Dubai', 25.2, 55.27], ['Mumbai', 19.08, 72.88], ['Delhi', 28.61, 77.21], ['Bangkok', 13.76, 100.5], ['Singapore', 1.35, 103.82], ['Hong Kong', 22.32, 114.17], ['Beijing', 39.9, 116.41], ['Seoul', 37.57, 126.98], ['Tokyo', 35.68, 139.69], ['Manila', 14.6, 120.98], ['Sydney', -33.87, 151.21], ['Perth', -31.95, 115.86], ['Auckland', -36.85, 174.76]];
  const pad2 = n => String(n).padStart(2, '0');
  const fmtT = (ms, sec) => ms == null ? '--' : new Date(ms).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit', second: sec ? '2-digit' : undefined });
  const fmtD = ms => new Date(ms).toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric' });
  const fmtDT = ms => ms == null ? '--' : fmtD(ms) + ', ' + fmtT(ms);
  const hm = h => Math.floor(h) + ' h ' + pad2(Math.round((h % 1) * 60)) + ' m';

  /* ---------- location (shared with Prepare > Sky) ---------- */
  let LOC = null; try { LOC = JSON.parse(ls.get('sky_loc', 'null')); } catch (e) {}
  if (!LOC) { try { const l = A.prep && A.prep.data && A.prep.data.profile && A.prep.data.profile.location; if (l) LOC = { lat: l.lat, lon: l.lon, name: l.name || '' }; } catch (e) {} }
  const locFns = [];
  const Sky = {
    subs: [], cur: ls.get('sky_sub', 'now'),
    loc: () => LOC, onLoc: f => locFns.push(f), fmtT, fmtD, fmtDT, hm, pad2, CITIES,
    reg(id, label, render, order) { this.subs.push({ id, label, render, order: order || 50 }); this.subs.sort((a, b) => a.order - b.order); },
    setLoc(l) {
      LOC = { lat: +l.lat, lon: +l.lon, name: l.name || '' }; ls.set('sky_loc', JSON.stringify(LOC));
      try { if (A.prep && A.prep.data && A.prep.data.profile) { A.prep.data.profile.location = { lat: LOC.lat, lon: LOC.lon, tz: Intl.DateTimeFormat().resolvedOptions().timeZone, name: LOC.name }; A.prep.save(); } } catch (e) {}
      drawBar(); locFns.forEach(f => { try { f(LOC); } catch (e) {} });
    },
    go(id, arg) { Sky.arg = arg; Sky.show(id); },
    show(id) { Sky.cur = id; ls.set('sky_sub', id); drawSubs(); mountSub(); },
    south: () => !!LOC && LOC.lat < 0,
  };
  A.sky = Sky;

  /* ---------- catalogue of things you can look for ---------- */
  Sky.catalog = () => {
    const d = S.data(); if (!d) return [];
    if (d._cat) return d._cat;
    const out = [{ id: 'sun', type: 'sun', label: 'Sun', pos: ms => S.sun(ms) }, { id: 'moon', type: 'moon', label: 'Moon', pos: ms => S.moon(ms) }];
    S.PL.forEach(p => out.push({ id: p, type: 'planet', label: d.planets[p].n, pos: ms => S.planet(p, ms) }));
    d.names.forEach(n => { const s = d.stars[n[0]]; out.push({ id: 's' + n[0], type: 'star', label: n[1], c: n[2], idx: n[0], pos: () => ({ ra: s[0], dec: s[1] }), mag: s[2], bv: s[3] }); });
    d.messier.forEach(m => out.push({ id: m[0], type: 'dso', label: m[0] + (m[1] ? ' - ' + m[1] : ''), kind: m[2], mag: m[3], pos: () => ({ ra: m[4], dec: m[5] }) }));
    d.cons.forEach(c => out.push({ id: 'c' + c.id, type: 'con', label: c.name + ' (constellation)', pos: () => ({ ra: c.c[0], dec: c.c[1] }) }));
    out.forEach(o => { o.key = o.label.toLowerCase(); });
    return (d._cat = out);
  };
  Sky.find = q => { q = String(q || '').trim().toLowerCase(); if (!q) return []; const cat = Sky.catalog(); const hits = cat.filter(o => o.key.includes(q)); hits.sort((a, b) => (a.key.startsWith(q) ? 0 : 1) - (b.key.startsWith(q) ? 0 : 1) || (a.mag == null ? -9 : a.mag) - (b.mag == null ? -9 : b.mag)); return hits.slice(0, 12); };
  Sky.horOf = (o, ms) => { const p = o.pos(ms), h = S.hor(p, ms, LOC.lat, LOC.lon); if (o.type === 'moon') h.alt -= p.par * S.cos(h.alt); return h; };

  /* ---------- styles ---------- */
  const st = document.createElement('style');
  st.textContent = `
  #p-sky{flex-direction:column}
  .skh{display:flex;align-items:center;gap:8px;flex-wrap:wrap;padding:8px 14px;border-bottom:1px solid var(--line)}
  .skh .pl{flex:1;min-width:140px;font-size:13.5px}
  #sksub{display:flex;gap:6px;padding:8px 14px;flex-wrap:wrap;border-bottom:1px solid var(--line)}
  #skloc{padding:10px 14px;border-bottom:1px solid var(--line);background:var(--panel)}
  #skbody{flex:1;min-height:0;display:flex;flex-direction:column;position:relative}
  .skg{display:grid;grid-template-columns:repeat(auto-fit,minmax(270px,1fr));gap:10px}
  .skbig{font-size:30px;font-weight:700;letter-spacing:-.5px}
  .skrow{display:flex;justify-content:space-between;gap:10px;padding:3px 0;border-bottom:1px dashed var(--line);font-size:13.5px}
  .skrow:last-child{border:0}
  .skrow b{font-weight:600}
  .skchip{display:inline-block;padding:2px 9px;border-radius:999px;border:1px solid var(--line);font-size:12px;margin:2px 3px 2px 0;cursor:pointer}
  .skchip.on{background:var(--acc);color:var(--onacc,#0a0c12);border-color:var(--acc)}
  .skbtn{background:var(--panel2);border:1px solid var(--line);color:var(--text);border-radius:9px;padding:5px 11px;font-size:13px;cursor:pointer}
  .skbtn:hover{border-color:var(--acc)}
  .skbtn.on{background:var(--acc);color:var(--onacc,#0a0c12);border-color:var(--acc)}
  .skin{background:var(--panel2);border:1px solid var(--line);color:var(--text);border-radius:8px;padding:5px 8px;font-size:13px}
  .sktab td,.sktab th{padding:4px 8px;text-align:left;font-size:13px;border-bottom:1px solid var(--line)}
  .sktab{width:100%;border-collapse:collapse}
  canvas.skcv{display:block;width:100%;height:100%;touch-action:none}
  `;
  document.head.appendChild(st);

  /* ---------- shell ---------- */
  root.innerHTML = '<div class="skh"><span style="font-size:20px">🔭</span><div class="pl" id="skpl"></div><button class="skbtn" id="skchg">Change place</button></div><div id="skloc" style="display:none"></div><div id="sksub"></div><div id="skbody"></div>';
  const q = id => document.getElementById(id);
  function drawBar() {
    q('skpl').innerHTML = LOC ? '📍 <b>' + esc(LOC.name || 'Your place') + '</b> <span class="mute small">' + LOC.lat.toFixed(3) + '°, ' + LOC.lon.toFixed(3) + '°</span>' : '<b>Choose where you are</b> <span class="mute small">so the sky, sun and compass match your spot</span>';
  }
  function locPicker() {
    const box = q('skloc'); box.style.display = box.style.display === 'none' ? 'block' : 'none'; if (box.style.display === 'none') return;
    box.innerHTML = '<div class="row" style="flex-wrap:wrap;gap:8px"><select id="skcity" class="skin" style="min-width:170px"><option value="">Pick a city...</option>' + CITIES.map((c, i) => '<option value="' + i + '">' + esc(c[0]) + '</option>').join('') + '</select>' +
      '<input id="skll" class="skin" style="width:210px" placeholder="or type 40.71, -74.01" value="' + (LOC ? LOC.lat.toFixed(4) + ', ' + LOC.lon.toFixed(4) : '') + '"><input id="sknm" class="skin" style="width:140px" placeholder="Name (optional)" value="' + esc(LOC ? LOC.name : '') + '"><button class="skbtn on" id="sksave">Use this</button><button class="skbtn" id="skgeo">Use this PC\'s location</button></div><div class="mute small" id="skmsg" style="margin-top:6px">Your place is only stored on this PC. Tip: negative numbers mean south or west.</div>';
    q('skcity').onchange = e => { const c = CITIES[+e.target.value]; if (c) { q('skll').value = c[1] + ', ' + c[2]; q('sknm').value = c[0]; } };
    q('sksave').onclick = () => {
      const m = q('skll').value.trim().match(/^(-?\d+(?:\.\d+)?)\s*[,;\s]\s*(-?\d+(?:\.\d+)?)$/);
      if (!m || Math.abs(+m[1]) > 90 || Math.abs(+m[2]) > 180) { q('skmsg').textContent = 'Could not read those coordinates. Use two numbers like 40.71, -74.01.'; return; }
      Sky.setLoc({ lat: +m[1], lon: +m[2], name: q('sknm').value.trim() }); box.style.display = 'none';
    };
    q('skgeo').onclick = () => {
      if (!navigator.geolocation) { q('skmsg').textContent = 'This PC cannot report a location. Pick a city or type coordinates.'; return; }
      q('skmsg').textContent = 'Asking Windows for your location...';
      navigator.geolocation.getCurrentPosition(p => { Sky.setLoc({ lat: p.coords.latitude, lon: p.coords.longitude, name: 'This PC' }); box.style.display = 'none'; }, () => { q('skmsg').textContent = 'Windows did not share a location (Settings > Privacy > Location must be on). Pick a city or type coordinates instead.'; }, { timeout: 9000 });
    };
  }
  q('skchg').onclick = locPicker;
  function drawSubs() {
    q('sksub').innerHTML = Sky.subs.map(s => '<button class="ib' + (s.id === Sky.cur ? ' on' : '') + '" data-sub="' + s.id + '">' + esc(s.label) + '</button>').join('');
    q('sksub').querySelectorAll('button').forEach(b => { b.onclick = () => Sky.show(b.dataset.sub); });
  }
  function mountSub() {
    const body = q('skbody'); if (body._cleanup) { try { body._cleanup(); } catch (e) {} body._cleanup = null; }
    body.innerHTML = ''; const s = Sky.subs.find(x => x.id === Sky.cur) || Sky.subs[0]; if (!s) return;
    if (!LOC && s.id !== 'weather') { body.innerHTML = '<div class="scroll pad"><div class="card"><b>First, tell Moundshroud where you are.</b><div class="mute small" style="margin-top:4px">The sky looks different from every place on Earth. Press <b>Change place</b> above and pick a city or type coordinates.</div></div></div>'; if (q('skloc').style.display === 'none') locPicker(); return; }
    S.load().then(() => { if (Sky.cur === s.id || !Sky.cur) s.render(body); }).catch(() => { body.innerHTML = '<div class="scroll pad"><div class="card">The star data file (web/data/sky.json) could not be loaded.</div></div>'; });
  }
  Sky.refresh = mountSub;
  Sky.onLoc(() => { if (A.cur === 'sky') mountSub(); });

  /* ---------- Tonight ---------- */
  function moonCanvas(cv, el, south) {
    const c = cv.getContext('2d'), w = cv.width, r = w / 2 - 4, cx = w / 2, cy = w / 2, k = S.cos(el), waxing = el < 180, mirror = waxing === south;
    c.clearRect(0, 0, w, w); c.save(); c.translate(cx, cy); if (mirror) c.scale(-1, 1);
    c.fillStyle = '#1c2230'; c.beginPath(); c.arc(0, 0, r, 0, 7); c.fill();
    c.fillStyle = '#f1ecd8'; c.beginPath(); c.arc(0, 0, r, -Math.PI / 2, Math.PI / 2, false);
    if (k > 0) c.ellipse(0, 0, r * k, r, 0, Math.PI / 2, -Math.PI / 2, true); else c.ellipse(0, 0, r * -k, r, 0, Math.PI / 2, Math.PI * 1.5, false);
    c.fill(); c.restore(); c.strokeStyle = 'rgba(255,255,255,.25)'; c.beginPath(); c.arc(cx, cy, r, 0, 7); c.stroke();
  }
  Sky.moonCanvas = moonCanvas;
  function tonight(body) {
    body.innerHTML = '<div class="scroll pad" style="flex:1"><div id="sknow"></div></div>';
    const host = body.querySelector('#sknow');
    const draw = () => {
      if (!LOC) return; const now = Date.now(), d0 = new Date(); d0.setHours(0, 0, 0, 0); const t0 = d0.getTime();
      const sunAlt = ms => S.hor(S.sun(ms), ms, LOC.lat, LOC.lon).alt, moAlt = ms => S.moonTopo(ms, LOC.lat, LOC.lon).alt;
      const sh = S.hor(S.sun(now), now, LOC.lat, LOC.lon), rs = S.riseSet(sunAlt, t0, -0.833), cv = S.riseSet(sunAlt, t0, -6), nt = S.riseSet(sunAlt, t0, -12), as = S.riseSet(sunAlt, t0, -18);
      const rsY = S.riseSet(sunAlt, t0 - 864e5, -0.833), len = rs.rise && rs.set ? (rs.set - rs.rise) / 36e5 : null, lenY = rsY.rise && rsY.set ? (rsY.set - rsY.rise) / 36e5 : null;
      const mo = S.moon(now), mh = S.moonTopo(now, LOC.lat, LOC.lon), mrs = S.riseSet(moAlt, t0, -0.7), nf = S.nextPhase(now, 180), nn = S.nextPhase(now, 0);
      const state = sh.alt > 0 ? 'Daytime' : sh.alt > -6 ? 'Civil twilight' : sh.alt > -12 ? 'Nautical twilight' : sh.alt > -18 ? 'Astronomical twilight' : 'Full night';
      const dark = sh.alt < -12;
      let html = '<div class="skg">';
      html += '<div class="card"><div class="mute small">' + fmtD(now) + '</div><div class="skbig">' + fmtT(now) + '</div><div style="margin:2px 0 8px"><b>' + state + '</b> &middot; the Sun is ' + (sh.alt > 0 ? sh.alt.toFixed(0) + '° above' : Math.abs(sh.alt).toFixed(0) + '° below') + ' the horizon, toward the ' + S.cardWord(sh.az) + ' (' + sh.az.toFixed(0) + '°)</div>' +
        '<div class="mute small">' + (dark ? 'Dark enough for stars. Open <b>Sky chart</b> to see what is overhead right now.' : sh.alt > 0 ? 'The stars are out of sight in daylight, but the chart still shows where they are.' : 'Stars will appear as the sky darkens.') + '</div><div style="margin-top:8px"><button class="skbtn on" data-go="chart">Open sky chart</button> <button class="skbtn" data-go="compass">Compass</button> <button class="skbtn" data-go="solar">Solar system</button></div></div>';
      html += '<div class="card"><b>☀️ Sun</b><div class="skrow"><span>Sunrise</span><b>' + (rs.rise ? fmtT(rs.rise) : rs.always === 'up' ? 'Sun stays up' : 'Sun stays down') + '</b></div><div class="skrow"><span>Solar noon</span><b>' + fmtT(rs.transit) + ' &middot; ' + rs.maxAlt.toFixed(0) + '° high</b></div><div class="skrow"><span>Sunset</span><b>' + (rs.set ? fmtT(rs.set) : '--') + '</b></div>' +
        (len != null ? '<div class="skrow"><span>Day length</span><b>' + hm(len) + (lenY != null ? ' <span class="mute small">(' + ((len - lenY) * 60 >= 0 ? '+' : '') + ((len - lenY) * 60).toFixed(1) + ' min vs yesterday)</span>' : '') + '</b></div>' : '') +
        '<div class="skrow"><span>Morning twilight starts</span><b>' + fmtT(cv.rise) + '</b></div><div class="skrow"><span>Evening twilight ends</span><b>' + fmtT(cv.set) + '</b></div><div class="skrow"><span>Fully dark from</span><b>' + (as.set ? fmtT(as.set) : nt.set ? fmtT(nt.set) + ' (no true dark)' : 'not tonight') + '</b></div></div>';
      html += '<div class="card"><div class="row" style="gap:12px;align-items:flex-start"><canvas id="skmoon" width="96" height="96"></canvas><div style="flex:1"><b>🌙 ' + S.phaseName(mo.elong) + '</b><div class="small">' + (mo.ill * 100).toFixed(0) + '% lit &middot; ' + (mh.alt > 0 ? 'up now, ' + mh.alt.toFixed(0) + '° high toward the ' + S.cardWord(mh.az) : 'below the horizon now') + '</div></div></div>' +
        '<div class="skrow"><span>Moonrise</span><b>' + fmtT(mrs.rise) + '</b></div><div class="skrow"><span>Moonset</span><b>' + fmtT(mrs.set) + '</b></div><div class="skrow"><span>Next full moon</span><b>' + fmtDT(nf) + '</b></div><div class="skrow"><span>Next new moon</span><b>' + fmtDT(nn) + '</b></div></div>';
      html += '</div><div class="card" style="margin-top:2px"><b>🪐 Planets</b><table class="sktab"><tr><th>Planet</th><th>Now</th><th>Brightness</th><th>Rises</th><th>Sets</th></tr>';
      S.PL.forEach(id => {
        const p = S.planet(id, now), h = S.hor(p, now, LOC.lat, LOC.lon), r2 = S.riseSet(ms => S.hor(S.planet(id, ms), ms, LOC.lat, LOC.lon).alt, t0, -0.5), naked = ['mer', 'ven', 'mar', 'jup', 'sat'].includes(id);
        html += '<tr><td><b>' + p.name + '</b>' + (naked ? '' : ' <span class="mute small">(telescope)</span>') + '</td><td>' + (h.alt > 0 ? '<span style="color:var(--ok)">Up</span> ' + h.alt.toFixed(0) + '° ' + S.card(h.az) : '<span class="mute">Below horizon</span>') + '</td><td>mag ' + p.mag.toFixed(1) + '</td><td>' + (r2.rise ? fmtT(r2.rise) : '--') + '</td><td>' + (r2.set ? fmtT(r2.set) : '--') + '</td></tr>';
      });
      html += '</table><div class="mute small" style="margin-top:6px">Lower magnitude = brighter. Positions are calculated on this PC; they are accurate to well under a degree.</div></div>';
      host.innerHTML = html; moonCanvas(q('skmoon'), mo.elong, LOC.lat < 0);
      host.querySelectorAll('[data-go]').forEach(b => { b.onclick = () => Sky.show(b.dataset.go); });
    };
    draw(); const iv = setInterval(() => { if (A.cur === 'sky' && Sky.cur === 'now' && host.isConnected) draw(); }, 30000); body._cleanup = () => clearInterval(iv);
  }
  Sky.reg('now', 'Tonight', tonight, 1);

  A.registerTab('sky', 'Sky', () => { drawBar(); drawSubs(); mountSub(); });
  drawBar();
})();

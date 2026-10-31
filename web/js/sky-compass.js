// Compass: a sky-aware compass rose, finding things by direction, true vs magnetic north, and finding direction without any instrument.
(() => {
  const Sky = A.sky, S = window.SkyCore; if (!Sky || !S) return;
  const clamp = (x, a, b) => Math.max(a, Math.min(b, x)), R = Math.PI / 180, mod = (x, m) => ((x % m) + m) % m;
  const PCOL = { mer: '#c7c0b5', ven: '#fff3c4', mar: '#ff8a5c', jup: '#ffe9c2', sat: '#f0d28c', ura: '#9be8f0', nep: '#7aa2ff' };
  const st = Sky.cp = Sky.cp || { heading: 0, target: null, place: null, sensor: false, decl: +ls.get('sky_decl', '0') || 0 };

  Sky.reg('compass', 'Compass', body => {
    const loc = Sky.loc(), d = S.data(), ms = () => Date.now();
    body.innerHTML = '<div class="scroll pad" style="flex:1"><div class="skg">' +
      '<div class="card" style="text-align:center"><canvas id="cprose" width="340" height="340" style="width:min(340px,100%);touch-action:none;cursor:grab"></canvas><div id="cphd" class="skbig" style="margin-top:2px"></div><div class="mute small" id="cpsrc"></div>' +
      '<div class="row" style="gap:8px;justify-content:center;margin-top:8px;flex-wrap:wrap"><input id="cpsl" type="range" min="0" max="359" style="width:200px"><button class="skbtn" id="cpsun">Facing the Sun</button></div></div>' +
      '<div><div class="card"><b>🎯 Find something</b><div class="mute small" style="margin:2px 0 6px">Planet, star, constellation, the Moon or a city. Turn until the arrow points straight up.</div><div class="row" style="gap:6px"><input class="skin" id="cpq" placeholder="Mars, Polaris, Orion, London..." style="flex:1"><button class="skbtn" id="cpgo">Find</button></div><div id="cphits" style="margin-top:4px"></div><div id="cptg" style="margin-top:8px"></div></div>' +
      '<div class="card"><b>🧲 True north vs magnetic north</b><div class="mute small" style="margin:2px 0 6px">A magnetic compass points to magnetic north, not true north. The difference is called declination and depends on where you are.</div><div class="row" style="gap:6px;flex-wrap:wrap"><span>Declination</span><input class="skin" id="cpdc" type="number" step="0.5" style="width:80px"><span class="mute small">degrees (east positive, west negative)</span></div><div style="margin-top:8px" class="small" id="cpcal"></div></div></div></div>' +
      '<div class="card" style="margin-top:2px"><b>☀️ Today at your place</b><div id="cptoday" class="small" style="margin-top:4px"></div></div>' +
      '<details class="card"><summary style="cursor:pointer;font-weight:600">Find direction with no compass</summary><div id="cphow" class="small" style="line-height:1.55;margin-top:8px"></div></details></div>';
    const q = id => body.querySelector('#' + id), cv = q('cprose'), c = cv.getContext('2d');
    q('cpdc').value = st.decl;

    /* bodies to show on the ring */
    const bodies = () => {
      const t = ms(), out = [];
      const add = (id, lab, col, o) => { const h = Sky.horOf(o, t); out.push({ id, lab, col, h, o }); };
      Sky.catalog().filter(o => o.type === 'sun' || o.type === 'moon' || o.type === 'planet').forEach(o => add(o.id, o.id === 'sun' ? '☀' : o.id === 'moon' ? '☾' : o.label.slice(0, 3), o.id === 'sun' ? '#ffd45e' : o.id === 'moon' ? '#f1ecd8' : PCOL[o.id] || '#ccc', o));
      return out;
    };
    function targetInfo() {
      if (st.place) { const g = S.gc(loc, st.place); return { az: g.brg, alt: null, label: st.place.name, extra: g.km.toFixed(0) + ' km (' + (g.km / 1.609344).toFixed(0) + ' mi) away' }; }
      if (st.target) { const h = Sky.horOf(st.target, ms()); return { az: h.az, alt: h.alt, label: st.target.label, extra: S.whereWords(h) }; }
      return null;
    }
    function draw() {
      const w = 340, cx = w / 2, cy = w / 2, r = 150, rot = -st.heading * R; c.clearRect(0, 0, w, w);
      const g = c.createRadialGradient(cx, cy, 20, cx, cy, r + 12); g.addColorStop(0, '#1b2030'); g.addColorStop(1, '#0d1018'); c.fillStyle = g; c.beginPath(); c.arc(cx, cy, r + 12, 0, 7); c.fill(); c.strokeStyle = '#3a4260'; c.lineWidth = 2; c.stroke();
      c.save(); c.translate(cx, cy); c.rotate(rot);
      for (let a = 0; a < 360; a += 5) { const big = a % 30 === 0, mid = a % 10 === 0, len = big ? 14 : mid ? 9 : 5; c.strokeStyle = big ? '#cdd3ea' : '#6a7392'; c.lineWidth = big ? 2 : 1; c.beginPath(); c.moveTo(Math.sin(a * R) * r, -Math.cos(a * R) * r); c.lineTo(Math.sin(a * R) * (r - len), -Math.cos(a * R) * (r - len)); c.stroke(); }
      c.textAlign = 'center'; c.textBaseline = 'middle';
      [['N', 0, '#ff6b6b', 22], ['E', 90, '#e6e9f5', 19], ['S', 180, '#e6e9f5', 19], ['W', 270, '#e6e9f5', 19], ['NE', 45, '#9aa3ba', 12], ['SE', 135, '#9aa3ba', 12], ['SW', 225, '#9aa3ba', 12], ['NW', 315, '#9aa3ba', 12]].forEach(k => { c.save(); c.rotate(k[1] * R); c.translate(0, -(r - 32)); c.fillStyle = k[2]; c.font = 'bold ' + k[3] + 'px system-ui'; c.fillText(k[0], 0, 0); c.restore(); });
      c.font = '10px system-ui'; for (let a = 30; a < 360; a += 30) if (a % 90) { c.save(); c.rotate(a * R); c.translate(0, -(r - 52)); c.fillStyle = '#7a839f'; c.fillText(a + '°', 0, 0); c.restore(); }
      /* magnetic north needle if a declination is set */
      if (st.decl) { c.save(); c.rotate((-st.decl) * R); c.strokeStyle = '#46d7c8'; c.lineWidth = 2; c.setLineDash([4, 3]); c.beginPath(); c.moveTo(0, -r + 4); c.lineTo(0, -r + 62); c.stroke(); c.setLineDash([]); c.fillStyle = '#46d7c8'; c.font = '10px system-ui'; c.fillText('mag N', 0, -r + 72); c.restore(); }
      /* things in the sky, drawn on an inner ring */
      bodies().forEach(b => { c.save(); c.rotate(b.h.az * R); c.translate(0, -(r - 82)); c.rotate(-rot - b.h.az * R); const up = b.h.alt > 0; c.globalAlpha = up ? 1 : 0.35; c.fillStyle = b.col; c.beginPath(); c.arc(0, 0, b.id === 'sun' || b.id === 'moon' ? 9 : 6, 0, 7); c.fill(); c.globalAlpha = up ? 1 : 0.4; c.fillStyle = '#fff'; c.font = '10px system-ui'; c.fillText(b.id === 'sun' || b.id === 'moon' ? '' : b.lab, 0, 14); c.restore(); });
      const ti = targetInfo(); if (ti) { c.save(); c.rotate(ti.az * R); c.fillStyle = '#46d7c8'; c.beginPath(); c.moveTo(0, -r + 2); c.lineTo(-9, -r + 24); c.lineTo(9, -r + 24); c.closePath(); c.fill(); c.strokeStyle = 'rgba(70,215,200,.5)'; c.lineWidth = 1.5; c.setLineDash([5, 4]); c.beginPath(); c.moveTo(0, 0); c.lineTo(0, -r + 26); c.stroke(); c.restore(); }
      c.restore();
      c.fillStyle = '#ffcf5e'; c.beginPath(); c.moveTo(cx, cy - r - 14); c.lineTo(cx - 8, cy - r + 6); c.lineTo(cx + 8, cy - r + 6); c.closePath(); c.fill();
      c.fillStyle = '#e6e9f5'; c.beginPath(); c.arc(cx, cy, 4, 0, 7); c.fill();
      q('cphd').textContent = Math.round(st.heading) + '° ' + S.card(st.heading) + (st.decl ? '  ·  magnetic ' + Math.round(mod(st.heading - st.decl, 360)) + '°' : '');
      q('cpsl').value = Math.round(st.heading);
    }
    function targetCard() {
      const ti = targetInfo(), box = q('cptg'); if (!ti) { box.innerHTML = ''; return; }
      const turn = ((ti.az - st.heading + 540) % 360) - 180, mag = mod(ti.az - st.decl, 360);
      box.innerHTML = '<div style="font-size:15px"><b>' + esc(ti.label) + '</b></div><div class="skrow"><span>True bearing</span><b>' + ti.az.toFixed(0) + '° ' + S.card(ti.az) + '</b></div>' + (st.decl ? '<div class="skrow"><span>Magnetic bearing (set your compass to this)</span><b>' + mag.toFixed(0) + '°</b></div>' : '') +
        '<div class="skrow"><span>From the way you are facing</span><b>' + (Math.abs(turn) < 2 ? 'straight ahead' : 'turn ' + Math.abs(turn).toFixed(0) + '° ' + (turn > 0 ? 'right' : 'left')) + '</b></div><div class="small mute" style="margin-top:4px">' + esc(ti.extra) + '</div><div style="margin-top:6px"><button class="skbtn" id="cpsky">Show in sky chart</button> <button class="skbtn" id="cpclr">Clear</button></div>';
      const sk = q('cpsky'); if (sk) { sk.style.display = st.target ? '' : 'none'; sk.onclick = () => Sky.go('chart', st.target); } q('cpclr').onclick = () => { st.target = null; st.place = null; targetCard(); draw(); };
    }
    function cal() {
      const t = ms(), sh = Sky.horOf({ pos: () => S.sun(t), type: 'sun' }, t);
      q('cpcal').innerHTML = sh.alt > 3 ? 'To measure it: the Sun is at true bearing <b>' + sh.az.toFixed(0) + '°</b> right now (' + sh.alt.toFixed(0) + '° high). Point your magnetic compass at the Sun (use the shadow of a stick, never stare at the Sun) and type what it reads: <input class="skin" id="cpmr" type="number" min="0" max="360" style="width:70px;margin:0 4px"><button class="skbtn" id="cpcb">Calculate</button> <span id="cpcr"></span>' : '<span class="mute">To measure declination yourself, come back in daylight when the Sun is above the horizon: Moundshroud compares your compass reading of the Sun with its true position. You can also look up declination for your place on any map or NOAA\'s magnetic field calculator.</span>';
      const b = q('cpcb'); if (b) b.onclick = () => { const v = parseFloat(q('cpmr').value); if (isNaN(v)) return; st.decl = Math.round((((sh.az - v + 540) % 360) - 180) * 10) / 10; ls.set('sky_decl', st.decl); q('cpdc').value = st.decl; q('cpcr').innerHTML = '<b>Declination ' + Math.abs(st.decl) + '° ' + (st.decl >= 0 ? 'east' : 'west') + '</b>'; draw(); targetCard(); };
    }
    function today() {
      const t = new Date(); t.setHours(0, 0, 0, 0); const t0 = t.getTime(), alt = m => Sky.horOf({ pos: () => S.sun(m), type: 'sun' }, m).alt, rs = S.riseSet(alt, t0, -0.833);
      const az = m => Sky.horOf({ pos: () => S.sun(m), type: 'sun' }, m).az;
      q('cptoday').innerHTML = (rs.rise ? '<div class="skrow"><span>Sun rises toward</span><b>' + az(rs.rise).toFixed(0) + '° ' + S.card(az(rs.rise)) + ' at ' + Sky.fmtT(rs.rise) + '</b></div>' : '') +
        '<div class="skrow"><span>Solar noon (Sun due ' + (loc.lat >= 0 ? 'south' : 'north') + ', shadows shortest and pointing ' + (loc.lat >= 0 ? 'north' : 'south') + ')</span><b>' + Sky.fmtT(rs.transit) + '</b></div>' + (rs.set ? '<div class="skrow"><span>Sun sets toward</span><b>' + az(rs.set).toFixed(0) + '° ' + S.card(az(rs.set)) + ' at ' + Sky.fmtT(rs.set) + '</b></div>' : '') + '<div class="skrow"><span>The Sun is now at</span><b>' + az(Date.now()).toFixed(0) + '° ' + S.card(az(Date.now())) + ', ' + alt(Date.now()).toFixed(0) + '° high</b></div>';
    }
    const north = loc.lat >= 0;
    q('cphow').innerHTML =
      '<b>Shadow stick (works anywhere the Sun shines)</b><ol style="margin:4px 0 8px;padding-left:1.2em"><li>Push a straight stick upright into flat ground. Mark the tip of its shadow with a stone.</li><li>Wait 15 minutes. Mark the new tip.</li><li>A line through the two marks runs <b>west to east</b> (the first mark is west). Stand with your left foot on the first mark and right foot on the second: you are facing <b>north</b> (south of you is behind you). This works in both hemispheres.</li><li>For the most accurate line, start about an hour before solar noon (see "Today at your place").</li></ol>' +
      '<b>By the stars</b><ul style="margin:4px 0 8px;padding-left:1.2em">' + (north ? '<li><b>Polaris</b> (North Star): find the Big Dipper, follow the two stars at the end of its "cup" upward about five times their gap. Polaris is due north, and its height above the horizon is about <b>' + loc.lat.toFixed(0) + '°</b> from where you are.</li><li>No Big Dipper? Cassiopeia (the W) points to it from the other side.</li>' : '<li><b>Southern Cross:</b> extend its long axis (Gacrux to Acrux) about 4.5 times its length. The point there is the south celestial pole; drop straight down to the horizon for <b>south</b>. The pole stands about <b>' + Math.abs(loc.lat).toFixed(0) + '°</b> high.</li><li>Bisect the line between the two Pointers (Alpha and Beta Centauri) at right angles and it crosses that same line near the pole.</li>') + '<li>Stars rise in the east and set in the west, like the Sun. Orion\'s belt rises almost due east and sets almost due west.</li></ul>' +
      '<b>By the Moon</b><ul style="margin:4px 0 8px;padding-left:1.2em"><li>A crescent Moon: draw a line down through the two horns to the horizon. That point is roughly <b>' + (north ? 'south' : 'north') + '</b>.</li></ul>' +
      '<b>By an analogue watch</b> (' + (north ? 'Northern' : 'Southern') + ' Hemisphere, standard time, Sun visible)<ul style="margin:4px 0 0;padding-left:1.2em">' + (north ? '<li>Point the hour hand at the Sun. Halfway between the hour hand and 12 o\'clock points south.</li>' : '<li>Point 12 o\'clock at the Sun. Halfway between 12 and the hour hand points north.</li>') + '<li>Less reliable near the equator and in daylight-saving time (use 1 o\'clock as "12").</li></ul>' +
      '<div class="mute small" style="margin-top:8px">Rough guides only. For serious travel carry a real compass and map.</div>';

    /* interaction */
    let dragX = null; const setH = h => { st.heading = mod(h, 360); st.manual = true; draw(); targetCard(); };
    cv.onpointerdown = e => { dragX = e.clientX; try { cv.setPointerCapture(e.pointerId); } catch (x) {} cv.style.cursor = 'grabbing'; };
    cv.onpointermove = e => { if (dragX == null) return; setH(st.heading - (e.clientX - dragX) * 0.6); dragX = e.clientX; };
    cv.onpointerup = () => { dragX = null; cv.style.cursor = 'grab'; };
    q('cpsl').oninput = e => setH(+e.target.value);
    q('cpsun').onclick = () => { const t = ms(), h = Sky.horOf({ pos: () => S.sun(t), type: 'sun' }, t); setH(h.az); };
    q('cpdc').onchange = e => { st.decl = clamp(parseFloat(e.target.value) || 0, -90, 90); ls.set('sky_decl', st.decl); draw(); targetCard(); };
    const search = () => {
      const v = q('cpq').value.trim(); if (!v) return; const hits = Sky.find(v), city = Sky.CITIES.filter(c => c[0].toLowerCase().includes(v.toLowerCase()));
      const box = q('cphits'); box._h = hits; box._c = city;
      box.innerHTML = hits.slice(0, 6).map((o, i) => '<span class="skchip" data-o="' + i + '">' + esc(o.label) + '</span>').join('') + city.slice(0, 4).map((x, i) => '<span class="skchip" data-c="' + i + '">📍 ' + esc(x[0]) + '</span>').join('') || '<span class="mute small">Nothing found. Try a planet, bright star, constellation or one of the listed cities.</span>';
      if (hits.length + city.length === 1) box.querySelector('.skchip').click();
    };
    q('cpgo').onclick = search; q('cpq').onkeydown = e => { if (e.key === 'Enter') search(); };
    q('cphits').onclick = e => { const b = q('cphits'), o = e.target.closest('.skchip'); if (!o) return; if (o.dataset.o != null) { st.target = b._h[+o.dataset.o]; st.place = null; } else { const x = b._c[+o.dataset.c]; st.place = { name: x[0], lat: x[1], lon: x[2] }; st.target = null; } b.innerHTML = ''; targetCard(); draw(); };
    if (Sky.arg && Sky.arg.pos) { st.target = Sky.arg; st.place = null; Sky.arg = null; }

    /* device compass if this PC has one */
    let gotSensor = false; const onOri = e => { let h = e.webkitCompassHeading; if (h == null && e.alpha != null && (e.absolute || e.type === 'deviceorientationabsolute')) h = 360 - e.alpha; if (h == null || isNaN(h)) return; gotSensor = true; st.sensor = true; st.heading = mod(h, 360); q('cpsrc').textContent = 'Live heading from this device\'s compass sensor.'; draw(); targetCard(); };
    window.addEventListener('deviceorientationabsolute', onOri, true); window.addEventListener('deviceorientation', onOri, true);
    q('cpsrc').textContent = 'No compass sensor found on this PC. Drag the dial (or use the slider) to match the way you are really facing, then everything in the sky lines up around you.';
    setTimeout(() => { if (!gotSensor) st.sensor = false; }, 1500);
    const iv = setInterval(() => { if (body.isConnected) { draw(); today(); if (st.target) targetCard(); } }, 20000);
    body._cleanup = () => { clearInterval(iv); window.removeEventListener('deviceorientationabsolute', onOri, true); window.removeEventListener('deviceorientation', onOri, true); };
    draw(); targetCard(); cal(); today();
  }, 4);
})();

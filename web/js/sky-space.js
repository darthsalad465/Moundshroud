// Universe: the Solar System in 3D for any date, bright stars in 3D at their real distances, and a journey through the scale of everything.
(() => {
  const Sky = A.sky, S = window.SkyCore; if (!Sky || !S) return;
  const R = Math.PI / 180, clamp = (x, a, b) => Math.max(a, Math.min(b, x)), lerp = (a, b, t) => a + (b - a) * t;
  const LY = { Sirius: 8.6, Canopus: 310, Arcturus: 37, 'Rigil Kentaurus': 4.4, Toliman: 4.4, Vega: 25, Capella: 43, Rigel: 860, Procyon: 11.5, Achernar: 139, Betelgeuse: 550, Hadar: 390, Altair: 17, Acrux: 320, Aldebaran: 65, Spica: 250, Antares: 550, Pollux: 34, Fomalhaut: 25, Mimosa: 280, Deneb: 2600, Regulus: 79, Adhara: 430, Castor: 51, Gacrux: 88, Shaula: 570, Bellatrix: 250, Elnath: 134, Miaplacidus: 113, Alnilam: 2000, Alnair: 101, Alnitak: 1260, Regor: 840, Alioth: 83, Mirfak: 590, 'Kaus Australis': 143, Dubhe: 123, Wezen: 1800, Alkaid: 104, Avior: 630, Sargas: 270, Menkalinan: 81, Atria: 415, Alhena: 109, Alsephina: 80, Peacock: 180, Polaris: 433, Mirzam: 500, Alphard: 177, Hamal: 66, Algieba: 130, Diphda: 96, Nunki: 228, Menkent: 59, Alpheratz: 97, Mirach: 197, Saiph: 650, Kochab: 130, Tiaki: 170, Rasalhague: 49, Algol: 90, Almach: 350, Denebola: 36, Navi: 610, Naos: 1080, Alphecca: 75, Mizar: 83, Sadr: 1800, Shedar: 230, Eltanin: 154, Mintaka: 1200, Caph: 55, Dschubba: 400, Merak: 79, Izar: 202, Enif: 690, Phecda: 84, Sabik: 88, Scheat: 196, Alderamin: 49, Markab: 133, Menkar: 220, Zosma: 58, Acrab: 404, Gienah: 165, Arneb: 2200, Ankaa: 77, Megrez: 81, Ruchbah: 99, Segin: 440, Imai: 345, Meissa: 1100, Hatysa: 1300 };
  Sky.starLy = n => LY[n] || null;
  const SHAPES = { 'Orion': ['Betelgeuse-Bellatrix', 'Bellatrix-Mintaka', 'Betelgeuse-Alnitak', 'Mintaka-Alnilam', 'Alnilam-Alnitak', 'Alnitak-Saiph', 'Mintaka-Rigel'], 'Big Dipper': ['Dubhe-Merak', 'Merak-Phecda', 'Phecda-Megrez', 'Megrez-Dubhe', 'Megrez-Alioth', 'Alioth-Mizar', 'Mizar-Alkaid'], 'Southern Cross': ['Acrux-Gacrux', 'Mimosa-Imai'], 'Cassiopeia': ['Caph-Shedar', 'Shedar-Navi', 'Navi-Ruchbah', 'Ruchbah-Segin'] };
  const PCOL = { sun: '#ffd45e', mer: '#c7c0b5', ven: '#fff3c4', ter: '#5aa9ff', mar: '#ff8a5c', jup: '#ffe9c2', sat: '#f0d28c', ura: '#9be8f0', nep: '#7aa2ff' }, PSZ = { mer: 3.2, ven: 5, ter: 5.2, mar: 4, jup: 9, sat: 8, ura: 6, nep: 6 };
  const PNAME = { mer: 'Mercury', ven: 'Venus', ter: 'Earth', mar: 'Mars', jup: 'Jupiter', sat: 'Saturn', ura: 'Uranus', nep: 'Neptune' };
  const PFACT = { mer: 'The smallest planet. A year lasts only 88 days, but a day-night cycle takes 176.', ven: 'Hotter than Mercury thanks to its thick carbon-dioxide atmosphere. It spins backwards, very slowly.', ter: 'You are here. The only world known to have life.', mar: 'A cold desert with the biggest volcano in the Solar System (Olympus Mons).', jup: 'More than twice as massive as all the other planets together. Its Great Red Spot is a storm wider than Earth.', sat: 'Its rings are mostly water ice, and thin: some stretches are only 10 metres thick.', ura: 'An ice giant that spins on its side, so each pole gets 42 years of sunlight, then 42 of darkness.', nep: 'The windiest planet, with gusts over 2,000 km/h. It was found by maths before it was seen.' };
  const tabs = [['solar', 'Solar System'], ['stars', 'Stars in 3D'], ['scale', 'Scale of everything']];
  const sg = Sky.us = Sky.us || { mode: 'solar' };

  Sky.reg('uni', 'Universe', body => {
    body.innerHTML = '<div class="row" style="padding:8px 12px;gap:6px;flex-wrap:wrap;border-bottom:1px solid var(--line)" id="unb">' + tabs.map(t => '<button class="skbtn' + (t[0] === sg.mode ? ' on' : '') + '" data-m="' + t[0] + '">' + t[1] + '</button>').join('') + '</div><div id="unv" style="flex:1;min-height:0;display:flex;flex-direction:column;position:relative"></div>';
    body.querySelector('#unb').onclick = e => { const m = e.target.dataset.m; if (!m) return; sg.mode = m; Sky.refresh(); };
    const host = body.querySelector('#unv'), f = { solar, stars, scale }[sg.mode] || solar; f(host, body);
  }, 3);
  Sky.us.go = m => { sg.mode = m; Sky.show('uni'); };

  /* ---------- shared 3D plumbing ---------- */
  function stage(host, bodyEl, st, redraw) {
    host.innerHTML = '<div style="position:relative;flex:1;min-height:0;overflow:hidden;background:#04060d"><canvas class="skcv" id="uncv"></canvas><div id="uninfo" class="card" style="display:none;position:absolute;right:8px;top:8px;width:min(300px,46%);max-height:calc(100% - 70px);overflow:auto;margin:0;z-index:3"></div><div id="untop" style="position:absolute;left:8px;top:8px;display:flex;gap:6px;flex-wrap:wrap;max-width:60%;z-index:3"></div><div id="unbot" style="position:absolute;left:0;right:0;bottom:0;padding:6px 10px;background:rgba(10,12,20,.72);display:flex;gap:6px;flex-wrap:wrap;align-items:center;z-index:3;color:#dde"></div></div>';
    const wrap = host.firstChild, cv = wrap.querySelector('#uncv'), ctx = cv.getContext('2d'), o = { wrap, cv, ctx, W: 0, H: 0, dirty: true, q: id => wrap.querySelector('#' + id) };
    const rs = () => { const dpr = Math.min(2, devicePixelRatio || 1), r = wrap.getBoundingClientRect(); o.W = Math.max(200, Math.round(r.width)); o.H = Math.max(200, Math.round(r.height)); cv.width = o.W * dpr; cv.height = o.H * dpr; cv.style.width = o.W + 'px'; cv.style.height = o.H + 'px'; ctx.setTransform(dpr, 0, 0, dpr, 0, 0); o.dirty = true; };
    const ro = new ResizeObserver(rs); ro.observe(wrap); rs();
    const ptrs = new Map(); let moved = 0, pinch = 0, down = null;
    cv.onpointerdown = e => { try { cv.setPointerCapture(e.pointerId); } catch (x) {} ptrs.set(e.pointerId, [e.clientX, e.clientY]); moved = 0; down = [e.offsetX, e.offsetY]; if (ptrs.size === 2) { const a = [...ptrs.values()]; pinch = Math.hypot(a[0][0] - a[1][0], a[0][1] - a[1][1]); } };
    cv.onpointermove = e => { const p = ptrs.get(e.pointerId); if (!p) return; if (ptrs.size === 2) { ptrs.set(e.pointerId, [e.clientX, e.clientY]); const a = [...ptrs.values()], d = Math.hypot(a[0][0] - a[1][0], a[0][1] - a[1][1]); if (pinch) { st.dist = clamp(st.dist * pinch / d, st.min, st.max); pinch = d; o.dirty = true; } return; } const dx = e.clientX - p[0], dy = e.clientY - p[1]; moved += Math.abs(dx) + Math.abs(dy); ptrs.set(e.pointerId, [e.clientX, e.clientY]); st.yaw += dx * 0.4; st.pitch = clamp(st.pitch + dy * 0.4, -89, 89); st.auto = false; o.dirty = true; };
    cv.onpointerup = e => { ptrs.delete(e.pointerId); if (moved < 5 && ptrs.size === 0 && down && o.onclick) o.onclick(down[0], down[1]); };
    cv.onwheel = e => { e.preventDefault(); st.dist = clamp(st.dist * Math.exp(e.deltaY * 0.0014), st.min, st.max); o.dirty = true; };
    let raf = 0, stopped = false, last = performance.now();
    const loop = () => { if (stopped) return; const now = performance.now(), dt = Math.min(0.25, (now - last) / 1000); last = now; if (st.auto) { st.yaw += dt * 4; o.dirty = true; } if (redraw.tick) redraw.tick(dt); if (o.dirty && cv.isConnected) { o.dirty = false; redraw(o); } raf = requestAnimationFrame(loop); };
    bodyEl._cleanup = () => { stopped = true; cancelAnimationFrame(raf); ro.disconnect(); }; raf = requestAnimationFrame(loop);
    return o;
  }
  function proj(p, st, W, H) {
    if (st.focus) p = [p[0] - st.focus[0], p[1] - st.focus[1], p[2] - st.focus[2]];
    const cy = Math.cos(st.yaw * R), sy = Math.sin(st.yaw * R), cp = Math.cos(st.pitch * R), sp = Math.sin(st.pitch * R);
    const x1 = p[0] * cy + p[1] * sy, y1 = -p[0] * sy + p[1] * cy, y2 = y1 * cp - p[2] * sp, z2 = y1 * sp + p[2] * cp, d = st.dist + y2; if (d < 0.3) return null;
    const k = H * 0.95 / d; return [W / 2 + x1 * k, H / 2 - z2 * k, d, k];
  }
  const glow = (ctx, x, y, r, col) => { const g = ctx.createRadialGradient(x, y, 0, x, y, r); g.addColorStop(0, col); g.addColorStop(0.3, col); g.addColorStop(1, 'rgba(0,0,0,0)'); ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, y, r, 0, 7); ctx.fill(); };
  const bgStars = (() => { let s = 11; const r = () => (s = (s * 16807) % 2147483647) / 2147483647; return Array.from({ length: 220 }, () => [r(), r(), 0.3 + r() * 0.7]); })();
  const paintBg = o => { const c = o.ctx; c.fillStyle = '#04060d'; c.fillRect(0, 0, o.W, o.H); bgStars.forEach(b => { c.fillStyle = 'rgba(255,255,255,' + (b[2] * 0.6).toFixed(2) + ')'; c.fillRect(b[0] * o.W, b[1] * o.H, 1.3, 1.3); }); };
  const fmtLight = min => min < 1 ? (min * 60).toFixed(1) + ' seconds' : min < 120 ? min.toFixed(1) + ' minutes' : min < 2880 ? (min / 60).toFixed(1) + ' hours' : (min / 1440).toFixed(1) + ' days';

  /* ---------- Solar System ---------- */
  function solar(host, bodyEl) {
    const st = sg.sol = sg.sol || { yaw: 25, pitch: 52, dist: 46, min: 3, max: 400, auto: false, t: Date.now(), speed: 0, mode: 'sq', sel: null, belt: true, labels: true };
    if (st.speed === 1) st.t = Date.now();
    const ms = () => st.t, cmp = r => st.mode === 'sq' ? 6 * Math.sqrt(r) : r, ids = ['mer', 'ven', 'ter', 'mar', 'jup', 'sat', 'ura', 'nep'];
    const place = v => { const r = Math.hypot(v.x, v.y, v.z) || 1e-9, f = cmp(r) / r; return [v.x * f, v.y * f, v.z * f]; };
    const orbits = {}; ids.forEach(id => { orbits[id] = S.orbitPts(id, Date.now(), 200); });
    let sd = 5; const rnd = () => (sd = (sd * 16807) % 2147483647) / 2147483647, belt = Array.from({ length: 700 }, () => { const r = 2.1 + rnd() * 1.2, a = rnd() * 360 * R; return [r * Math.cos(a), r * Math.sin(a), (rnd() - 0.5) * 0.3]; });
    let hits = [];
    const redraw = o => {
      const { ctx: c, W, H } = o; paintBg(o); hits = [];
      /* orbits */
      ids.forEach(id => { c.strokeStyle = st.sel === id ? 'rgba(70,215,200,.8)' : 'rgba(150,170,220,.28)'; c.lineWidth = st.sel === id ? 1.6 : 1; c.beginPath(); let pen = false; orbits[id].forEach(v => { const p = proj(place(v), st, W, H); if (!p) { pen = false; return; } if (!pen) { c.moveTo(p[0], p[1]); pen = true; } else c.lineTo(p[0], p[1]); }); c.closePath(); c.stroke(); });
      if (st.belt) { c.fillStyle = 'rgba(180,170,150,.45)'; belt.forEach(b => { const p = proj(place({ x: b[0], y: b[1], z: b[2] }), st, W, H); if (p) c.fillRect(p[0], p[1], 1.2, 1.2); }); }
      const sunP = proj([0, 0, 0], st, W, H); const objs = [];
      if (sunP) objs.push({ id: 'sun', p: sunP, z: sunP[2] });
      ids.forEach(id => { const h = place(S.helio(id, ms())), p = proj(h, st, W, H); if (p) objs.push({ id, p, z: p[2], h }); });
      /* line from Earth to the selected planet */
      const earth = objs.find(x => x.id === 'ter'), selO = objs.find(x => x.id === st.sel);
      if (earth && selO && st.sel !== 'ter' && st.sel !== 'sun') { c.strokeStyle = 'rgba(70,215,200,.8)'; c.setLineDash([5, 4]); c.beginPath(); c.moveTo(earth.p[0], earth.p[1]); c.lineTo(selO.p[0], selO.p[1]); c.stroke(); c.setLineDash([]); }
      objs.sort((a, b) => b.z - a.z).forEach(ob => {
        const [x, y] = ob.p; let r;
        if (ob.id === 'sun') { r = 11; glow(c, x, y, 54, 'rgba(255,200,90,.55)'); c.fillStyle = '#fff1b0'; c.beginPath(); c.arc(x, y, r, 0, 7); c.fill(); }
        else { r = PSZ[ob.id] * clamp(Math.sqrt(46 / st.dist), 0.7, 2.2); glow(c, x, y, r * 2.4, PCOL[ob.id] + '66'); c.fillStyle = PCOL[ob.id]; c.beginPath(); c.arc(x, y, r, 0, 7); c.fill(); if (ob.id === 'sat') { c.strokeStyle = '#d8c487'; c.lineWidth = 1.5; c.beginPath(); c.ellipse(x, y, r * 2, r * 0.7, -0.35, 0, 7); c.stroke(); } }
        if (st.sel === ob.id) { c.strokeStyle = '#46d7c8'; c.lineWidth = 2; c.beginPath(); c.arc(x, y, r + 7, 0, 7); c.stroke(); }
        if (st.labels || st.sel === ob.id) { c.font = '12.5px system-ui'; c.fillStyle = ob.id === 'ter' ? '#8cc6ff' : '#dfe4f7'; c.fillText(ob.id === 'sun' ? 'Sun' : ob.id === 'ter' ? 'Earth (you are here)' : PNAME[ob.id], x + r + 6, y + 4); }
        hits.push({ id: ob.id, x, y, r: Math.max(10, r + 5) });
      });
      /* scale ring hint */
      c.fillStyle = 'rgba(200,210,240,.65)'; c.font = '12px system-ui'; c.fillText(new Date(st.t).toLocaleDateString([], { weekday: 'short', year: 'numeric', month: 'long', day: 'numeric' }) + (st.speed === 1 ? '  (today)' : '') + '   ·   ' + (st.mode === 'sq' ? 'distances squeezed so every planet fits' : 'true distances'), 12, H - 60);
    };
    redraw.tick = dt => { if (st.speed > 1 || st.speed < 0) { st.t += dt * st.speed * 864e5; o.dirty = true; if (st.sel) infoUpdate(); } };
    const o = stage(host, bodyEl, st, redraw);
    o.onclick = (x, y) => { let b = null, bd = 1e9; hits.forEach(h => { const d = Math.hypot(h.x - x, h.y - y); if (d < h.r + 4 && d < bd) { bd = d; b = h; } }); st.sel = b ? b.id : null; infoUpdate(); o.dirty = true; };
    const infoBox = o.q('uninfo');
    function infoUpdate() {
      const id = st.sel; if (!id) { infoBox.style.display = 'none'; return; } infoBox.style.display = 'block';
      if (id === 'sun') { infoBox.innerHTML = '<div class="row"><b style="font-size:16px;flex:1">The Sun</b><button class="skbtn" id="ux">✕</button></div><div class="small" style="margin-top:6px;line-height:1.5">A star holding 99.86% of the Solar System\'s mass. Light from it takes 8 minutes 19 seconds to reach Earth. It is 1.39 million km wide: about 109 Earths side by side.</div><div style="margin-top:8px"><button class="skbtn" id="usky">See it in your sky</button></div>'; }
      else {
        const t = st.t, h = S.helio(id, t), e = S.helio('ter', t), rs = Math.hypot(h.x, h.y, h.z), de = Math.hypot(h.x - e.x, h.y - e.y, h.z - e.z);
        let extra = ''; if (id !== 'ter') { const p = S.planet(id, t), hh = S.hor(p, t, Sky.loc().lat, Sky.loc().lon); extra = '<div class="skrow"><span>Light from it takes</span><b>' + fmtLight(de * 8.3167) + ' to reach Earth</b></div><div class="skrow"><span>Brightness</span><b>magnitude ' + p.mag.toFixed(1) + '</b></div><div class="skrow"><span>From your place</span><b>' + (hh.alt > 0 ? 'up now, ' + hh.alt.toFixed(0) + '° toward the ' + S.cardWord(hh.az) : 'below the horizon') + (Math.abs(t - Date.now()) < 36e5 ? '' : ' (at this date)') + '</b></div>'; }
        infoBox.innerHTML = '<div class="row"><b style="font-size:16px;flex:1">' + PNAME[id] + '</b><button class="skbtn" id="ux">✕</button></div><div class="skrow"><span>Distance from the Sun</span><b>' + rs.toFixed(2) + ' AU (' + (rs * 149.6).toFixed(0) + ' million km)</b></div>' + (id !== 'ter' ? '<div class="skrow"><span>Distance from Earth</span><b>' + de.toFixed(2) + ' AU (' + (de * 149.6).toFixed(0) + ' million km)</b></div>' : '') + extra + '<div class="skrow"><span>One year lasts</span><b>' + (S.PERIOD[id] < 700 ? S.PERIOD[id].toFixed(0) + ' days' : (S.PERIOD[id] / 365.25).toFixed(1) + ' Earth years') + '</b></div><div class="small" style="margin:8px 0;line-height:1.5">' + PFACT[id] + '</div>' + (id !== 'ter' ? '<button class="skbtn on" id="usky">See it in your sky</button>' : '');
      }
      o.q('ux').onclick = () => { st.sel = null; infoUpdate(); o.dirty = true; }; const b = o.q('usky'); if (b) b.onclick = () => Sky.go('chart', id === 'sun' ? 'sun' : id);
    }
    infoUpdate();
    const top = o.q('untop'); top.innerHTML = ['mer', 'ven', 'ter', 'mar', 'jup', 'sat', 'ura', 'nep'].map(i => '<span class="skchip" style="background:rgba(10,12,20,.7);color:#dde" data-p="' + i + '">' + PNAME[i] + '</span>').join('');
    top.onclick = e => { const i = e.target.dataset.p; if (i) { st.sel = i; infoUpdate(); o.dirty = true; } };
    const bot = o.q('unbot'); const spd = [['Paused', 0], ['Today', 1], ['10 days / sec', 10], ['1 month / sec', 30], ['1 year / sec', 365], ['10 years / sec', 3650], ['Backwards 1 year / sec', -365]];
    const iso = ms2 => new Date(ms2 - new Date(ms2).getTimezoneOffset() * 6e4).toISOString().slice(0, 10);
    bot.innerHTML = '<select class="skin" id="usp">' + spd.map((s, i) => '<option value="' + i + '">' + s[0] + '</option>').join('') + '</select><input class="skin" id="udt" type="date"><button class="skbtn" id="um">−1 month</button><button class="skbtn" id="up">+1 month</button><button class="skbtn" id="ut">Today</button><button class="skbtn" id="uscale"></button><button class="skbtn" id="ubelt"></button><button class="skbtn" id="ulab"></button><button class="skbtn" id="uauto">Spin</button><span class="small mute" style="margin-left:auto">Drag to rotate · wheel to zoom · click a planet</span>';
    const q = i => o.q(i), setSp = v => { st.speed = v; q('usp').value = Math.max(0, spd.findIndex(s => s[1] === v)); if (v === 1) st.t = Date.now(); o.dirty = true; };
    const lab = () => { q('uscale').textContent = st.mode === 'sq' ? 'Switch to true distances' : 'Squeeze distances'; q('ubelt').textContent = st.belt ? 'Hide asteroid belt' : 'Show asteroid belt'; q('ulab').textContent = st.labels ? 'Hide names' : 'Show names'; q('uauto').classList.toggle('on', !!st.auto); }; lab();
    q('usp').value = Math.max(0, spd.findIndex(s => s[1] === st.speed)); q('usp').onchange = e => setSp(spd[+e.target.value][1]);
    const upDate = () => { if (document.activeElement !== q('udt')) q('udt').value = iso(st.t); }; upDate(); const t0 = redraw.tick; redraw.tick = dt => { t0(dt); upDate(); };
    q('udt').onchange = e => { const v = new Date(e.target.value + 'T12:00:00').getTime(); if (!isNaN(v)) { st.t = v; if (st.speed === 1) st.speed = 0; q('usp').value = 0; o.dirty = true; infoUpdate(); } };
    const step = (n) => { const d = new Date(st.t); d.setMonth(d.getMonth() + n); st.t = d.getTime(); if (st.speed === 1) st.speed = 0; q('usp').value = 0; o.dirty = true; infoUpdate(); };
    q('um').onclick = () => step(-1); q('up').onclick = () => step(1); q('ut').onclick = () => { st.t = Date.now(); setSp(1); infoUpdate(); };
    q('uscale').onclick = () => { st.mode = st.mode === 'sq' ? 'lin' : 'sq'; st.dist = st.mode === 'sq' ? 46 : 42; lab(); o.dirty = true; }; q('ubelt').onclick = () => { st.belt = !st.belt; lab(); o.dirty = true; }; q('ulab').onclick = () => { st.labels = !st.labels; lab(); o.dirty = true; }; q('uauto').onclick = () => { st.auto = !st.auto; lab(); };
  }

  /* ---------- Stars in 3D ---------- */
  function stars(host, bodyEl) {
    const d = S.data(), st = sg.stv = sg.stv || { yaw: 30, pitch: 28, dist: 60, min: 4, max: 500, auto: false, range: 'near', shape: '', sel: null };
    const list = d.names.filter(n => LY[n[1]]).map(n => { const s = d.stars[n[0]], ly = LY[n[1]], v = S.vec(s[0], s[1]), pc = ly / 3.2616; return { name: n[1], c: n[2], idx: n[0], mag: s[2], bv: s[3], ly, v, abs: s[2] - 5 * Math.log10(pc) + 5, col: d.col[n[0]] }; });
    const byName = {}; list.forEach(s => { byName[s.name] = s; });
    const cmp = ly => st.range === 'near' ? ly / 4 : 5.5 * Math.sqrt(ly) / 1.3;
    const pos = s => { const k = cmp(s.ly); return [s.v[0] * k, s.v[1] * k, s.v[2] * k]; };
    let hits = [];
    const redraw = o => {
      const { ctx: c, W, H } = o; paintBg(o); hits = [];
      const rings = st.range === 'near' ? [10, 25, 50, 100] : [100, 500, 1000, 2500];
      rings.forEach(ly => { c.strokeStyle = 'rgba(120,160,255,.22)'; c.lineWidth = 1; c.beginPath(); let pen = false; for (let a = 0; a <= 360; a += 6) { const p = proj([Math.cos(a * R) * cmp(ly), Math.sin(a * R) * cmp(ly), 0], st, W, H); if (!p) { pen = false; continue; } if (!pen) { c.moveTo(p[0], p[1]); pen = true; } else c.lineTo(p[0], p[1]); } c.stroke(); const lp = proj([cmp(ly), 0, 0], st, W, H); if (lp) { c.fillStyle = 'rgba(150,180,255,.6)'; c.font = '11px system-ui'; c.fillText(ly.toLocaleString() + ' ly', lp[0] + 3, lp[1] - 3); } });
      /* axes toward the celestial north pole */
      const np = proj([0, 0, cmp(rings[rings.length - 1]) * 0.9], st, W, H), o0 = proj([0, 0, 0], st, W, H); if (np && o0) { c.strokeStyle = 'rgba(255,170,120,.35)'; c.beginPath(); c.moveTo(o0[0], o0[1]); c.lineTo(np[0], np[1]); c.stroke(); c.fillStyle = 'rgba(255,170,120,.7)'; c.font = '11px system-ui'; c.fillText('toward Polaris', np[0] + 4, np[1]); }
      const vis = list.filter(s => st.range === 'all' || s.ly <= 110);
      if (st.shape && SHAPES[st.shape]) { c.strokeStyle = 'rgba(255,220,120,.7)'; c.lineWidth = 1.5; SHAPES[st.shape].forEach(pr => { const [a, b] = pr.split('-').map(n => byName[n]); if (!a || !b) return; const pa = proj(pos(a), st, W, H), pb = proj(pos(b), st, W, H); if (pa && pb) { c.beginPath(); c.moveTo(pa[0], pa[1]); c.lineTo(pb[0], pb[1]); c.stroke(); } }); }
      const items = []; vis.forEach(s => { const p = proj(pos(s), st, W, H); if (p) items.push({ s, p }); });
      if (o0) items.push({ s: null, p: o0 });
      items.sort((a, b) => b.p[2] - a.p[2]).forEach(({ s, p }) => {
        if (!s) { glow(c, p[0], p[1], 40, 'rgba(255,200,90,.45)'); c.fillStyle = '#fff1b0'; c.beginPath(); c.arc(p[0], p[1], 6, 0, 7); c.fill(); c.font = '12.5px system-ui'; c.fillStyle = '#ffe9a0'; c.fillText('Sun (you are here)', p[0] + 10, p[1] + 4); return; }
        const r = clamp(2.6 + (3 - s.abs) * 0.45, 2.6, 9) * clamp(Math.sqrt(60 / st.dist), 0.7, 1.6); glow(c, p[0], p[1], r * 2.6, s.col); c.fillStyle = s.col; c.beginPath(); c.arc(p[0], p[1], r, 0, 7); c.fill();
        if (st.sel && st.sel.name === s.name) { c.strokeStyle = '#46d7c8'; c.lineWidth = 2; c.beginPath(); c.arc(p[0], p[1], r + 6, 0, 7); c.stroke(); const o1 = proj([0, 0, 0], st, W, H); if (o1) { c.setLineDash([5, 4]); c.beginPath(); c.moveTo(o1[0], o1[1]); c.lineTo(p[0], p[1]); c.stroke(); c.setLineDash([]); } }
        if (s.mag < 2.2 || st.range === 'near' || (st.sel && st.sel.name === s.name) || st.dist < 40) { c.font = '12px system-ui'; c.fillStyle = 'rgba(225,230,255,.85)'; c.fillText(s.name, p[0] + r + 5, p[1] + 4); }
        hits.push({ s, x: p[0], y: p[1], r: Math.max(10, r + 5) });
      });
    };
    const o = stage(host, bodyEl, st, redraw);
    o.onclick = (x, y) => { let b = null, bd = 1e9; hits.forEach(h => { const dd = Math.hypot(h.x - x, h.y - y); if (dd < h.r + 4 && dd < bd) { bd = dd; b = h; } }); st.sel = b ? b.s : null; info(); o.dirty = true; };
    const box = o.q('uninfo');
    function info() {
      const s = st.sel; if (!s) { box.style.display = 'none'; return; } box.style.display = 'block'; const yr = new Date().getFullYear() - Math.round(s.ly), lum = Math.pow(10, (4.83 - s.abs) / 2.5);
      box.innerHTML = '<div class="row"><b style="font-size:16px;flex:1">' + esc(s.name) + '</b><button class="skbtn" id="sx">✕</button></div><div class="mute small">Star in ' + esc(s.c || '') + '</div><div class="skrow"><span>Distance</span><b>about ' + s.ly.toLocaleString() + ' light-years</b></div><div class="skrow"><span>That is</span><b>' + (s.ly * 63241).toLocaleString(undefined, { maximumFractionDigits: 0 }) + ' times Earth to Sun</b></div><div class="skrow"><span>Looks</span><b>magnitude ' + s.mag.toFixed(1) + '</b></div><div class="skrow"><span>Really shines</span><b>~' + (lum >= 10 ? Math.round(lum).toLocaleString() : lum.toFixed(1)) + ' times the Sun</b></div>' +
        '<div class="small" style="margin:8px 0;line-height:1.5">The light you see from it tonight left around the year <b>' + (yr > 0 ? yr : Math.abs(yr) + ' BC') + '</b>' + (s.ly > 500 ? ', long before ' + (yr < 0 ? 'the Roman Empire' : yr < 1000 ? 'the Middle Ages' : 'modern times') + '.' : '.') + (s.ly < 12 ? ' It is one of our closest stellar neighbours.' : '') + '</div><div class="row" style="gap:6px"><button class="skbtn on" id="sskyb">Find it in the sky</button></div>';
      o.q('sx').onclick = () => { st.sel = null; info(); o.dirty = true; }; o.q('sskyb').onclick = () => Sky.go('chart', Sky.catalog().find(x => x.idx === s.idx));
    }
    info();
    o.q('untop').innerHTML = '<span class="small" style="background:rgba(10,12,20,.7);color:#dde;padding:3px 10px;border-radius:999px">Each dot is a star at its real distance and direction. The Sun sits in the middle.</span>';
    const bot = o.q('unbot'); const lab = () => { bot.innerHTML = '<button class="skbtn' + (st.range === 'near' ? ' on' : '') + '" data-r="near">Neighbourhood (to 100 ly)</button><button class="skbtn' + (st.range === 'all' ? ' on' : '') + '" data-r="all">All bright stars (to 2,600 ly)</button><select class="skin" id="ushp"><option value="">Constellation shape...</option>' + Object.keys(SHAPES).map(k => '<option' + (st.shape === k ? ' selected' : '') + '>' + k + '</option>').join('') + '</select><button class="skbtn' + (st.auto ? ' on' : '') + '" id="sauto">Spin</button><span class="small mute" style="margin-left:auto">Drag to rotate · wheel to zoom · click a star</span>'; };
    lab(); bot.onclick = e => { const r = e.target.dataset.r; if (r) { st.range = r; st.focus = null; st.shape = ''; st.dist = r === 'near' ? 60 : 90; lab(); o.dirty = true; } if (e.target.id === 'sauto') { st.auto = !st.auto; lab(); } };
    bot.onchange = e => {
      if (e.target.id !== 'ushp') return; st.shape = e.target.value; st.focus = null;
      if (st.shape) {
        st.range = 'all'; const found = [...new Set((SHAPES[st.shape] || []).join('-').split('-'))].map(n => byName[n]).filter(Boolean);
        if (found.length) { const ps = found.map(pos), c = [0, 1, 2].map(i => ps.reduce((a, p) => a + p[i], 0) / ps.length), len = Math.hypot(c[0], c[1], c[2]); st.focus = [c[0] / 2, c[1] / 2, c[2] / 2]; st.yaw = Math.atan2(c[1], c[0]) / R; st.pitch = 12; st.dist = Math.max(22, len * 1.1 + 6); st.auto = false; }
      }
      lab(); o.dirty = true;
    };
  }

  /* ---------- Scale of everything ---------- */
  const LTM = 9.4607e15;
  function scale(host, bodyEl) {
    const vy = (new Date().getFullYear() + new Date().getMonth() / 12 - 2024) * 3.57 + 162.5;
    const ITEMS = [['The room around you', 5, ''], ['A football field', 100, ''], ['Mount Everest\'s summit', 8849, 'The highest point on land.'], ['Airliner cruising height', 1.1e4, ''], ['Edge of space (Karman line)', 1e5, 'Where air gets too thin for wings to work.'], ['The International Space Station', 4.2e5, 'It circles Earth every 90 minutes.'], ['Weather and TV satellites (geostationary)', 3.58e7, ''], ['The Moon', 3.844e8, 'Light takes 1.3 seconds to get there.'], ['The Sun (1 AU)', 1.496e11, 'Light takes 8 minutes 19 seconds.'], ['Mars (average)', 2.28e11, ''], ['Jupiter', 7.78e11, ''], ['Saturn', 1.43e12, ''], ['Neptune', 4.5e12, 'The farthest planet.'], ['Voyager 1 (now)', vy * 1.496e11, 'The most distant spacecraft; launched in 1977. Its radio messages take about ' + (vy * 8.3167 / 60).toFixed(0) + ' hours to arrive.'], ['Edge of the Sun\'s bubble (heliopause)', 1.8e13, 'Voyager 1 crossed it in 2012.'], ['Inner Oort Cloud (theoretical)', 3e14, 'A shell of icy comets around the Solar System.'], ['Proxima Centauri', 4.0e16, 'The nearest star to the Sun: 4.24 light-years.'], ['Sirius', 8.1e16, '8.6 light-years.'], ['Vega', 2.4e17, '25 light-years.'], ['Pleiades star cluster', 4.2e18, '444 light-years.'], ['Betelgeuse', 5.2e18, 'About 550 light-years.'], ['Orion Nebula', 1.27e19, 'A stellar nursery, 1,344 light-years away.'], ['Deneb', 2.5e19, 'About 2,600 light-years.'], ['Centre of the Milky Way', 2.46e20, 'About 26,000 light-years; a huge black hole sits there.'], ['Far edge of the Milky Way', 7.6e20, 'The galaxy is about 100,000 light-years across.'], ['Large Magellanic Cloud', 1.5e21, 'A small galaxy orbiting ours, 160,000 light-years away.'], ['Andromeda Galaxy', 2.4e22, '2.5 million light-years; it will merge with the Milky Way in about 4.5 billion years.'], ['Virgo Cluster', 5.1e23, 'A cluster of ~1,300 galaxies, 54 million light-years away.'], ['Coma Cluster', 3.0e24, '320 million light-years.'], ['Most distant galaxies seen', 1.28e26, 'The James Webb Telescope sees galaxies whose light left 13.5 billion years ago.'], ['Edge of the observable universe', 4.4e26, 'About 46 billion light-years in every direction.']];
    const st = sg.scl = sg.scl || { s: 0.7, sel: null, play: false };
    host.innerHTML = '<div style="position:relative;flex:1;min-height:0;overflow:hidden;background:#04060d"><canvas class="skcv" id="uncv"></canvas><div id="uninfo" class="card" style="display:none;position:absolute;right:8px;top:8px;width:min(300px,46%);margin:0;z-index:3"></div><div id="unbot" style="position:absolute;left:0;right:0;bottom:0;padding:8px 12px;background:rgba(10,12,20,.78);color:#dde;z-index:3"><div class="row" style="gap:8px"><button class="skbtn on" id="splay">▶ Fly outward</button><input id="ssl" type="range" min="0" max="27.2" step="0.01" style="flex:1"><span id="slab" class="small" style="min-width:190px;text-align:right"></span></div><div class="small mute" id="scap" style="margin-top:4px"></div></div></div>';
    const wrap = host.firstChild, cv = wrap.querySelector('#uncv'), c = cv.getContext('2d'), q = id => wrap.querySelector('#' + id); let W = 0, H = 0, hits = [], dirty = true;
    const rs = () => { const dpr = Math.min(2, devicePixelRatio || 1), r = wrap.getBoundingClientRect(); W = Math.max(200, Math.round(r.width)); H = Math.max(200, Math.round(r.height)); cv.width = W * dpr; cv.height = H * dpr; cv.style.width = W + 'px'; cv.style.height = H + 'px'; c.setTransform(dpr, 0, 0, dpr, 0, 0); dirty = true; };
    const ro = new ResizeObserver(rs); ro.observe(wrap); rs();
    const human = m => m < 1000 ? m.toPrecision(2).replace(/\.0+$/, '') + ' m' : m < 1e9 ? (m / 1000).toLocaleString(undefined, { maximumFractionDigits: 0 }) + ' km' : m < 1.496e13 ? (m / 1.496e11).toLocaleString(undefined, { maximumFractionDigits: 1 }) + ' AU' : m < 9.4607e18 ? (m / LTM).toLocaleString(undefined, { maximumFractionDigits: m / LTM < 100 ? 1 : 0 }) + ' light-years' : (m / LTM).toLocaleString(undefined, { maximumFractionDigits: 0 }) + ' light-years';
    const lightTime = m => { const s = m / 2.998e8; return s < 1 ? (s * 1000).toFixed(1) + ' milliseconds' : s < 120 ? s.toFixed(1) + ' seconds' : s < 7200 ? (s / 60).toFixed(1) + ' minutes' : s < 172800 ? (s / 3600).toFixed(1) + ' hours' : s < 86400 * 730 ? (s / 86400).toFixed(0) + ' days' : (s / 31557600).toLocaleString(undefined, { maximumFractionDigits: 0 }) + ' years'; };
    const draw = () => {
      c.fillStyle = '#04060d'; c.fillRect(0, 0, W, H); const cx = W / 2, cy = (H - 60) / 2, Rm = Math.min(cx, cy) - 16, rad = l => (l + 0.2) / 27.6 * Rm; hits = [];
      for (let k = 0; k <= 27; k += 3) { c.strokeStyle = 'rgba(120,160,255,.14)'; c.beginPath(); c.arc(cx, cy, rad(k), 0, 7); c.stroke(); if (k > 0) { c.fillStyle = 'rgba(150,180,255,.45)'; c.font = '10px system-ui'; c.fillText('10^' + k + ' m', cx + rad(k) * 0.7071 + 2, cy - rad(k) * 0.7071 - 2); } }
      c.strokeStyle = 'rgba(70,215,200,.9)'; c.lineWidth = 3; c.beginPath(); c.arc(cx, cy, rad(st.s), 0, 7); c.stroke(); c.lineWidth = 1;
      ITEMS.forEach((it, i) => { const l = Math.log10(it[1]), a = i * 2.39996 + 0.5, x = cx + Math.cos(a) * rad(l), y = cy + Math.sin(a) * rad(l), reached = l <= st.s + 0.0001, hot = Math.abs(l - st.s) < 0.45; c.globalAlpha = reached ? 1 : 0.35; c.fillStyle = hot ? '#46d7c8' : l < 8 ? '#9ad' : l < 14 ? '#ffd45e' : l < 21 ? '#ff9bd0' : '#b9a7ff'; c.beginPath(); c.arc(x, y, hot ? 6 : 3.6, 0, 7); c.fill(); if (st.sel === i) { c.strokeStyle = '#fff'; c.beginPath(); c.arc(x, y, 9, 0, 7); c.stroke(); } if (hot || st.sel === i || (reached && l > st.s - 0.9)) { c.fillStyle = '#e6e9f5'; c.font = '11.5px system-ui'; c.fillText(it[0], x + 9, y + 4); } c.globalAlpha = 1; hits.push({ i, x, y }); });
      glowDot(cx, cy); q('slab').textContent = 'Out to ' + human(Math.pow(10, st.s)); q('ssl').value = st.s;
      const near = ITEMS.filter(it => it[1] <= Math.pow(10, st.s)).pop(), nxt = ITEMS.find(it => it[1] > Math.pow(10, st.s));
      q('scap').innerHTML = 'Light from here takes <b>' + lightTime(Math.pow(10, st.s)) + '</b> to reach you.' + (near ? ' Last thing passed: <b>' + near[0] + '</b>.' : '') + (nxt ? ' Next: ' + nxt[0] + ' (' + human(nxt[1]) + ').' : ' That is the edge of everything we can see.');
    };
    function glowDot(x, y) { glow(c, x, y, 18, 'rgba(255,255,255,.8)'); c.fillStyle = '#fff'; c.beginPath(); c.arc(x, y, 3.5, 0, 7); c.fill(); c.fillStyle = '#e6e9f5'; c.font = '12px system-ui'; c.fillText('You', x + 7, y - 7); }
    cv.onpointerup = e => { const x = e.offsetX, y = e.offsetY; let b = null, bd = 1e9; hits.forEach(h => { const d = Math.hypot(h.x - x, h.y - y); if (d < 14 && d < bd) { bd = d; b = h; } }); st.sel = b ? b.i : null; infoBox(); dirty = true; };
    const box = q('uninfo'); function infoBox() { if (st.sel == null) { box.style.display = 'none'; return; } const it = ITEMS[st.sel]; box.style.display = 'block'; box.innerHTML = '<div class="row"><b style="font-size:16px;flex:1">' + esc(it[0]) + '</b><button class="skbtn" id="ix">✕</button></div><div class="skrow"><span>Distance from you</span><b>' + human(it[1]) + '</b></div><div class="skrow"><span>In metres</span><b>' + it[1].toExponential(1).replace('e+', ' × 10^') + '</b></div><div class="skrow"><span>Light takes</span><b>' + lightTime(it[1]) + '</b></div>' + (it[2] ? '<div class="small" style="margin-top:8px;line-height:1.5">' + esc(it[2]) + '</div>' : '') + '<button class="skbtn" id="ijump" style="margin-top:8px">Fly here</button>'; q('ix').onclick = () => { st.sel = null; infoBox(); dirty = true; }; q('ijump').onclick = () => { st.s = Math.log10(it[1]); dirty = true; }; }
    q('ssl').oninput = e => { st.s = +e.target.value; st.play = false; q('splay').textContent = '▶ Fly outward'; dirty = true; };
    q('splay').onclick = () => { st.play = !st.play; if (st.play && st.s > 27) st.s = 0.7; q('splay').textContent = st.play ? '⏸ Pause' : '▶ Fly outward'; };
    infoBox(); let raf = 0, stopped = false, last = performance.now();
    const loop = () => { if (stopped) return; const now = performance.now(), dt = Math.min(0.25, (now - last) / 1000); last = now; if (st.play) { st.s += dt * (0.55 + 0.2 * Math.sin(st.s)); if (st.s >= 27.2) { st.s = 27.2; st.play = false; q('splay').textContent = '▶ Fly outward'; } dirty = true; } if (dirty && cv.isConnected) { dirty = false; draw(); } raf = requestAnimationFrame(loop); };
    host.parentNode._cleanup = () => { stopped = true; cancelAnimationFrame(raf); ro.disconnect(); }; raf = requestAnimationFrame(loop);
  }
})();

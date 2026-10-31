// Sky chart: the real sky from your place, any time. Drag to look around, wheel to zoom, click anything for details.
(() => {
  const Sky = A.sky, S = window.SkyCore; if (!Sky || !S) return;
  const clamp = (x, a, b) => Math.max(a, Math.min(b, x)), R = Math.PI / 180, cosd = x => Math.cos(x * R), sind = x => Math.sin(x * R);
  const LAYERS = [['lines', 'Constellation lines'], ['cnames', 'Constellation names'], ['snames', 'Star names'], ['planets', 'Planets'], ['dso', 'Deep-sky objects (Messier)'], ['mw', 'Milky Way'], ['ground', 'Solid ground'], ['card', 'Compass points'], ['azgrid', 'Altitude / azimuth grid'], ['eqgrid', 'Sky coordinate grid'], ['ecl', 'Ecliptic (path of the Sun)'], ['day', 'Daylight sky and twilight'], ['red', 'Night-vision (red) mode']];
  const DEF = { lines: 1, cnames: 1, snames: 1, planets: 1, dso: 1, mw: 1, ground: 1, card: 1, azgrid: 0, eqgrid: 0, ecl: 0, day: 1, red: 0 };
  const PCOL = { mer: '#c7c0b5', ven: '#fff3c4', mar: '#ff8a5c', jup: '#ffe9c2', sat: '#f0d28c', ura: '#9be8f0', nep: '#7aa2ff' };
  const BL = {
    'Polaris': 'The North Star. It sits almost exactly above the Earth\'s north pole, so it hardly moves while everything else circles it. Its height above the horizon equals your latitude.',
    'Sirius': 'The brightest star in the night sky, only 8.6 light-years away. It is really two stars: a bright white one and a dim white dwarf companion.',
    'Betelgeuse': 'A red supergiant, so big that if it replaced the Sun it would swallow Mars\'s orbit and more. It will explode as a supernova someday (probably not for 100,000 years).',
    'Rigel': 'A blue-white supergiant about 120,000 times brighter than the Sun. It marks Orion\'s foot.',
    'Vega': 'One of the brightest stars of the northern sky and a corner of the Summer Triangle. It was the North Star about 12,000 years ago and will be again in about 13,000 years.',
    'Arcturus': 'The brightest star north of the celestial equator, an orange giant. Follow the curve of the Big Dipper\'s handle to find it ("arc to Arcturus").',
    'Altair': 'A fast-spinning star, one corner of the Summer Triangle; it spins once in about 9 hours (the Sun takes 25 days).',
    'Deneb': 'A distant supergiant at the top of the Northern Cross; one of the most luminous stars we can see by eye.',
    'Antares': 'The red heart of Scorpius, a supergiant whose name means "rival of Mars" because of its colour.',
    'Spica': 'A hot blue-white binary star, the brightest in Virgo. Follow the Big Dipper handle\'s arc past Arcturus to "speed on to Spica".',
    'Aldebaran': 'The orange eye of Taurus the Bull. It is not part of the Hyades cluster behind it; it just lies in front of it.',
    'Capella': 'A bright yellow star that is really two pairs of stars. It stays visible all year from northern places.',
    'Procyon': 'A close neighbour (11.5 light-years) with a faint white-dwarf companion. Part of the Winter Triangle with Sirius and Betelgeuse.',
    'Fomalhaut': 'The lonely "autumn star", mouth of the Southern Fish. It has a famous dusty ring around it.',
    'Canopus': 'The second brightest star in the sky, a giant far to the south. Spacecraft use it for navigation.',
    'Acrux': 'The foot of the Southern Cross, a multiple star system. Used by sailors to find south.',
    'Alpha Centauri': 'The closest star system to the Sun (about 4.4 light-years), actually three stars including Proxima Centauri.',
    'Rigil Kentaurus': 'Alpha Centauri A, part of the closest star system to the Sun, about 4.4 light-years away.',
    'M31 - Andromeda Galaxy': 'The nearest big galaxy, 2.5 million light-years away and heading toward us. Under dark skies it is a faint smudge visible by eye. It holds about a trillion stars.',
    'M42 - Orion Nebula': 'A stellar nursery 1,300 light-years away where new stars are being born. The fuzzy middle star of Orion\'s sword.',
    'M45 - Pleiades': 'The Seven Sisters, a young cluster of hot blue stars about 440 light-years away.',
    'M13 - Great Hercules Cluster': 'A ball of several hundred thousand stars about 22,000 light-years away.',
    'M44 - Beehive Cluster': 'An open cluster in Cancer, visible by eye as a fuzzy patch, about 600 light-years away.',
    'M8 - Lagoon Nebula': 'A glowing cloud of gas in Sagittarius where stars are forming.',
    'M57 - Ring Nebula': 'A shell of gas thrown off by a dying star, in Lyra. Needs a telescope.',
    'M1 - Crab Nebula': 'The wreckage of a star that exploded in the year 1054, recorded by Chinese astronomers.',
    'Sun': 'Our star: a ball of hot gas 1.39 million km wide. NEVER look at it directly or through binoculars or a telescope.',
    'Moon': 'Earth\'s only natural satellite, about 384,000 km away. The lit side always points toward the Sun.',
    'Venus': 'The brightest planet, wrapped in thick clouds; the hottest planet. Always near the Sun in the sky, so it shows as the "morning star" or "evening star".',
    'Mars': 'The red planet. Brightest around opposition, when Earth passes it about every 26 months.',
    'Jupiter': 'The giant: 11 times Earth\'s width. Even binoculars show its four big moons as tiny dots in a line.',
    'Saturn': 'The ringed planet. A small telescope shows the rings clearly.',
    'Mercury': 'The smallest planet and the closest to the Sun; hard to see because it never strays far from the glare.',
    'Uranus': 'A pale blue-green ice giant that rolls on its side. Barely visible to the eye in the darkest skies; use binoculars.',
    'Neptune': 'The most distant planet, 30 times farther from the Sun than Earth. Needs a telescope.'
  };

  Sky.reg('chart', 'Sky chart', body => {
    const d = S.data(), loc = Sky.loc();
    const st = Sky.cs || (Sky.cs = { az: 180, alt: 38, fov: 95, t: Date.now(), speed: 1, sel: null, track: false, panel: false });
    const LAY = Object.assign({}, DEF); try { Object.assign(LAY, JSON.parse(ls.get('sky_layers', '{}'))); } catch (e) {}
    if (st.speed === 1) st.t = Date.now();
    body.innerHTML = '<div id="skw" style="position:relative;flex:1;min-height:0;overflow:hidden;background:#05070f"><canvas class="skcv" id="skcv"></canvas>' +
      '<div style="position:absolute;left:8px;top:8px;display:flex;flex-direction:column;gap:6px;max-width:260px;z-index:3"><div class="row" style="gap:6px"><button class="skbtn" id="sklay">☰ Layers</button><input class="skin" id="sksrch" placeholder="Find: Mars, Vega, M31..." style="width:170px"></div><div id="sklaylist" class="card" style="display:none;margin:0;padding:8px 10px"></div><div id="sksres" class="card" style="display:none;margin:0;padding:4px"></div></div>' +
      '<div id="skhd" style="position:absolute;left:50%;top:8px;transform:translateX(-50%);padding:3px 12px;border-radius:999px;background:rgba(10,12,20,.6);color:#dde;font-size:12.5px;pointer-events:none;z-index:2;white-space:nowrap"></div>' +
      '<div id="skinfo" class="card" style="display:none;position:absolute;right:8px;top:8px;width:min(300px,46%);max-height:calc(100% - 90px);overflow:auto;margin:0;z-index:3"></div>' +
      '<div id="sktm" style="position:absolute;left:0;right:0;bottom:0;padding:6px 10px;background:rgba(10,12,20,.72);display:flex;gap:6px;flex-wrap:wrap;align-items:center;z-index:3;color:#dde"></div></div>';
    const wrap = body.querySelector('#skw'), cv = body.querySelector('#skcv'), ctx = cv.getContext('2d'), $$ = id => body.querySelector('#' + id);
    const bg = document.createElement('canvas'), bgx = bg.getContext('2d');
    let W = 0, H = 0, dpr = 1, dirty = true, items = [], lastDraw = 0, lastT = performance.now(), dragging = false;

    /* ---------- projection ---------- */
    let F, Rr, U, Fq, Rq, Uq, Zq, Sc, cx, cy, lstD, sunV, sunH;
    const horToEq = v => { const sp = sind(loc.lat), cp = cosd(loc.lat), xp = -v[0] * sp + v[2] * cp, yp = -v[1], zp = v[0] * cp + v[2] * sp, c = cosd(lstD), s = sind(lstD); return [xp * c - yp * s, xp * s + yp * c, zp]; };
    function setup() {
      lstD = S.lst(st.t, loc.lon);
      const a = st.alt, z = st.az; F = [cosd(a) * cosd(z), cosd(a) * sind(z), sind(a)]; Rr = [-sind(z), cosd(z), 0];
      U = [F[1] * Rr[2] - F[2] * Rr[1], F[2] * Rr[0] - F[0] * Rr[2], F[0] * Rr[1] - F[1] * Rr[0]];
      Fq = horToEq(F); Rq = horToEq(Rr); Uq = horToEq(U); Zq = horToEq([0, 0, 1]);
      Sc = H / (4 * Math.tan(st.fov * R / 4)); cx = W / 2; cy = H / 2;
    }
    const P = v => { const dd = v[0] * Fq[0] + v[1] * Fq[1] + v[2] * Fq[2]; if (dd < -0.96) return null; const k = 2 / (1 + dd); return [cx + k * (v[0] * Rq[0] + v[1] * Rq[1] + v[2] * Rq[2]) * Sc, cy - k * (v[0] * Uq[0] + v[1] * Uq[1] + v[2] * Uq[2]) * Sc, dd]; };
    const PH = (az, alt) => P(horToEq([cosd(alt) * cosd(az), cosd(alt) * sind(az), sind(alt)]));
    const PE = (ra, dec) => P(S.vec(ra, dec));
    const screenOf = o => { const p = o.pos(st.t), h = S.toHor(p.ra, p.dec, loc.lat, lstD); return { p, h, s: PE(p.ra, p.dec) }; };

    /* ---------- background: sky colour and ground, drawn at low resolution ---------- */
    const lerp = (a, b, t) => a + (b - a) * t;
    function paintBg() {
      const sc = 4, bw = Math.ceil(W / sc), bh = Math.ceil(H / sc); if (bg.width !== bw || bg.height !== bh) { bg.width = bw; bg.height = bh; }
      const im = bgx.createImageData(bw, bh), px = im.data, sunAlt = sunH.alt, dl = LAY.day ? clamp((sunAlt + 8) / 12, 0, 1) : 0, tg = LAY.day ? clamp(1 - Math.abs(sunAlt + 3) / 11, 0, 1) : 0;
      const Zc = [lerp(3, 52, dl), lerp(5, 110, dl), lerp(16, 190, dl)], Hc = [lerp(11, 150, dl), lerp(15, 195, dl), lerp(32, 235, dl)];
      const sN = [cosd(sunH.alt) * cosd(sunH.az), cosd(sunH.alt) * sind(sunH.az), sind(sunH.alt)];
      for (let j = 0; j < bh; j++) for (let i = 0; i < bw; i++) {
        const X = ((i + 0.5) * sc - cx) / Sc, Y = (cy - (j + 0.5) * sc) / Sc, rr = Math.hypot(X, Y), th = 2 * Math.atan(rr / 2), ct = Math.cos(th), sn = Math.sin(th), kx = rr > 1e-9 ? X / rr : 0, ky = rr > 1e-9 ? Y / rr : 0;
        const vN = F[0] * ct + (Rr[0] * kx + U[0] * ky) * sn, vE = F[1] * ct + (Rr[1] * kx + U[1] * ky) * sn, vU = F[2] * ct + (Rr[2] * kx + U[2] * ky) * sn;
        const alt = Math.asin(clamp(vU, -1, 1)) / R, cs = vN * sN[0] + vE * sN[1] + vU * sN[2], ang = Math.acos(clamp(cs, -1, 1)) / R;
        const hp = Math.exp(-Math.max(alt, 0) / 22);
        let r = lerp(Zc[0], Hc[0], hp), g = lerp(Zc[1], Hc[1], hp), b = lerp(Zc[2], Hc[2], hp);
        const glow = tg * Math.exp(-ang / 38) * (0.55 + 0.45 * hp); r += (255 - r) * glow * 0.85; g += (120 - g) * glow * 0.55; b += (50 - b) * glow * 0.3;
        if (dl > 0.3 && sunAlt > 0) { const h2 = Math.exp(-ang / 9) * 0.6; r += (255 - r) * h2; g += (250 - g) * h2; b += (230 - b) * h2; }
        if (alt < 0) {
          if (LAY.ground) { const gd = clamp(-alt / 25, 0, 1), L = 0.18 + 0.82 * dl; r = lerp(r * 0.45, 22 * L + 6, Math.min(1, gd * 3)); g = lerp(g * 0.45, 30 * L + 8, Math.min(1, gd * 3)); b = lerp(b * 0.4, 22 * L + 7, Math.min(1, gd * 3)); r += glow * 40; }
          else { r *= 0.6; g *= 0.6; b *= 0.65; }
        }
        const o = (j * bw + i) * 4; px[o] = r; px[o + 1] = g; px[o + 2] = b; px[o + 3] = 255;
      }
      bgx.putImageData(im, 0, 0); ctx.imageSmoothingEnabled = true; ctx.drawImage(bg, 0, 0, bw * sc, bh * sc);
    }

    /* ---------- drawing ---------- */
    const labels = [];
    function label(txt, x, y, col, size, align) {
      size = size || 12; ctx.font = size + 'px system-ui,sans-serif'; const w = ctx.measureText(txt).width, ax = align === 'c' ? x - w / 2 : x, r = [ax - 2, y - size, ax + w + 2, y + 3];
      for (const q of labels) if (r[0] < q[2] && r[2] > q[0] && r[1] < q[3] && r[3] > q[1]) return false;
      labels.push(r); ctx.fillStyle = col; ctx.fillText(txt, ax, y); return true;
    }
    const lineSeg = (pts, col, w, skipJump) => {
      ctx.strokeStyle = col; ctx.lineWidth = w; ctx.beginPath(); let pen = false, last = null;
      for (const p of pts) { if (!p || p[2] < -0.5) { pen = false; last = null; continue; } if (last && Math.hypot(p[0] - last[0], p[1] - last[1]) > (skipJump || 500)) pen = false; if (!pen) { ctx.moveTo(p[0], p[1]); pen = true; } else ctx.lineTo(p[0], p[1]); last = p; }
      ctx.stroke();
    };
    function frame() {
      const t = st.t; setup(); const sp = S.sun(t); sunH = S.toHor(sp.ra, sp.dec, loc.lat, lstD);
      const dl = LAY.day ? clamp((sunH.alt + 8) / 12, 0, 1) : 0, lim = 6.3 - (LAY.day ? 8.8 * clamp((sunH.alt + 18) / 18, 0, 1) : 0);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0); items = []; labels.length = 0;
      paintBg();
      const upQ = Zq, scale = clamp(60 / st.fov, 0.75, 2.6) ** 0.5;
      /* milky way */
      if (LAY.mw && lim > 3) {
        ctx.globalCompositeOperation = 'lighter'; const rad = Math.max(5, 5000 / st.fov / 12 * 1.6), a0 = 0.035 * clamp((lim - 3) / 3, 0, 1);
        for (const m of d.mw) { if (m[0] * upQ[0] + m[1] * upQ[1] + m[2] * upQ[2] < 0 && LAY.ground) continue; const p = P(m); if (!p) continue; ctx.fillStyle = 'rgba(170,185,230,' + (a0 * (0.4 + m[3])).toFixed(4) + ')'; ctx.beginPath(); ctx.arc(p[0], p[1], rad * (0.7 + m[3] * 0.8), 0, 7); ctx.fill(); }
        ctx.globalCompositeOperation = 'source-over';
      }
      /* grids */
      if (LAY.azgrid) { const col = 'rgba(120,170,255,.22)'; for (let a = -60; a <= 80; a += 20) { const pts = []; for (let z = 0; z <= 360; z += 4) pts.push(PH(z, a)); lineSeg(pts, a === 0 ? 'rgba(120,170,255,.4)' : col, 1); } for (let z = 0; z < 360; z += 30) { const pts = []; for (let a = -85; a <= 90; a += 5) pts.push(PH(z, a)); lineSeg(pts, col, 1); } }
      if (LAY.eqgrid) { const col = 'rgba(255,170,120,.2)'; for (let dc = -80; dc <= 80; dc += 20) { const pts = []; for (let r = 0; r <= 360; r += 4) pts.push(PE(r, dc)); lineSeg(pts, dc === 0 ? 'rgba(255,170,120,.4)' : col, 1); } for (let r = 0; r < 360; r += 30) { const pts = []; for (let dc = -88; dc <= 90; dc += 5) pts.push(PE(r, dc)); lineSeg(pts, col, 1); } }
      if (LAY.ecl) { const pts = []; for (let l = 0; l <= 360; l += 3) { const e = 23.4393, ra = S.atan2(sind(l) * cosd(e), cosd(l)), dc = S.asin(sind(e) * sind(l)); pts.push(PE(ra, dc)); } lineSeg(pts, 'rgba(255,220,120,.45)', 1.2); }
      /* constellation lines */
      if (LAY.lines && lim > 2) { ctx.globalAlpha = clamp((lim - 1.5) / 3, 0.15, 1); d.consLines.forEach(c => c.forEach(seg => lineSeg(seg.map(P), 'rgba(110,150,230,.5)', 1, 400))); ctx.globalAlpha = 1; }
      /* stars */
      const xyz = d.xyz, n = d.stars.length, sinPhi = sind(loc.lat);
      for (let i = 0; i < n; i++) {
        const s = d.stars[i]; let mag = s[2]; const x = xyz[i * 3], y = xyz[i * 3 + 1], z = xyz[i * 3 + 2], up = x * upQ[0] + y * upQ[1] + z * upQ[2];
        if (up < -0.02 && LAY.ground) continue; if (up < 0.17) mag += clamp((0.17 - up) * 9, 0, 3.2);
        if (mag > lim) continue; const dd = x * Fq[0] + y * Fq[1] + z * Fq[2]; if (dd < -0.96) continue;
        const k = 2 / (1 + dd), sx = cx + k * (x * Rq[0] + y * Rq[1] + z * Rq[2]) * Sc, sy = cy - k * (x * Uq[0] + y * Uq[1] + z * Uq[2]) * Sc;
        if (sx < -20 || sy < -20 || sx > W + 20 || sy > H + 20) continue;
        const rad = (0.5 + (lim + 0.5 - mag) * 0.5) * scale * clamp(1 - dl * 0.3, 0.6, 1), a = clamp((lim - mag) / 1.4 + 0.25, 0.25, 1);
        ctx.globalAlpha = a;
        if (mag < 1.2) { const gr = ctx.createRadialGradient(sx, sy, 0, sx, sy, rad * 3.2); gr.addColorStop(0, d.col[i]); gr.addColorStop(0.25, d.col[i]); gr.addColorStop(1, 'rgba(0,0,0,0)'); ctx.fillStyle = gr; ctx.beginPath(); ctx.arc(sx, sy, rad * 3.2, 0, 7); ctx.fill(); }
        ctx.fillStyle = d.col[i]; if (rad < 1.3) ctx.fillRect(sx - rad, sy - rad, rad * 2, rad * 2); else { ctx.beginPath(); ctx.arc(sx, sy, rad, 0, 7); ctx.fill(); }
        if (s[2] < 4.6 || d.nameOf[i]) items.push({ x: sx, y: sy, r: Math.max(7, rad + 4), idx: i, mag: s[2], kind: 'star' });
      }
      ctx.globalAlpha = 1;
      /* constellation names */
      if (LAY.cnames && st.fov > 28 && lim > 2.5) d.cons.forEach((c, ci) => { const p = PE(c.c[0], c.c[1]); if (!p || p[0] < 0 || p[1] < 0 || p[0] > W || p[1] > H) return; const v = S.vec(c.c[0], c.c[1]); if (LAY.ground && v[0] * upQ[0] + v[1] * upQ[1] + v[2] * upQ[2] < 0) return; label(c.name.toUpperCase(), p[0], p[1], 'rgba(140,175,255,.55)', 11, 'c'); });
      /* star names */
      if (LAY.snames && lim > 0) {
        const nm = st.fov < 22 ? 6 : st.fov < 45 ? 3.3 : st.fov < 80 ? 2.2 : 1.6;
        items.filter(it => it.kind === 'star' && d.nameOf[it.idx] && it.mag < nm).sort((a, b) => a.mag - b.mag).forEach(it => { label(d.nameOf[it.idx][1], it.x + it.r + 2, it.y + 4, 'rgba(225,230,255,.85)', 12); });
      }
      /* deep sky */
      if (LAY.dso && lim > 3 && st.fov < 90) d.messier.forEach((m, i) => { if (m[3] > 9.5) return; const v = d.messierV[i]; if (LAY.ground && v[0] * upQ[0] + v[1] * upQ[1] + v[2] * upQ[2] < 0) return; const p = P(v); if (!p || p[0] < 0 || p[1] < 0 || p[0] > W || p[1] > H) return; ctx.strokeStyle = 'rgba(255,170,200,.8)'; ctx.lineWidth = 1; ctx.beginPath(); ctx.ellipse(p[0], p[1], 6, 4, 0.5, 0, 7); ctx.stroke(); items.push({ x: p[0], y: p[1], r: 9, kind: 'dso', i }); if (st.fov < 60 || m[3] < 6) label(m[0], p[0] + 9, p[1] + 3, 'rgba(255,190,215,.9)', 11); });
      /* planets, sun, moon */
      const hidden = h => LAY.ground && h.alt < -1;
      if (LAY.planets) S.PL.forEach(id => {
        const p = S.planet(id, t), h = S.toHor(p.ra, p.dec, loc.lat, lstD); if (hidden(h)) return; const s = P(S.vec(p.ra, p.dec)); if (!s || s[0] < -20 || s[1] < -20 || s[0] > W + 20 || s[1] > H + 20) return;
        const rad = clamp(2.6 + (3.2 - p.mag) * 0.7, 2.6, 7) * scale * (dl > 0.6 ? 1.4 : 1), vis = dl < 0.85 || p.mag < -3;
        ctx.globalAlpha = vis ? 1 : 0.5; const gr = ctx.createRadialGradient(s[0], s[1], 0, s[0], s[1], rad * 2.6); gr.addColorStop(0, PCOL[id]); gr.addColorStop(0.35, PCOL[id]); gr.addColorStop(1, 'rgba(0,0,0,0)'); ctx.fillStyle = gr; ctx.beginPath(); ctx.arc(s[0], s[1], rad * 2.6, 0, 7); ctx.fill(); ctx.globalAlpha = 1;
        label(p.name, s[0] + rad + 5, s[1] + 4, PCOL[id], 12.5); items.push({ x: s[0], y: s[1], r: Math.max(10, rad + 4), kind: 'obj', id });
      });
      const sS = P(S.vec(sp.ra, sp.dec)), mp = S.moon(t), mH = S.toHor(mp.ra, mp.dec, loc.lat, lstD), mS = P(S.vec(mp.ra, mp.dec));
      if (mS && !hidden(mH)) {
        const mr = Math.max(8, 0.26 * R * Sc), el = mp.elong, kk = cosd(el), tmp = document.createElement('canvas'); tmp.width = tmp.height = 64; const c2 = tmp.getContext('2d');
        c2.fillStyle = '#242a3a'; c2.beginPath(); c2.arc(32, 32, 30, 0, 7); c2.fill(); c2.fillStyle = '#f4efdc'; c2.beginPath(); c2.arc(32, 32, 30, -Math.PI / 2, Math.PI / 2, false);
        if (kk > 0) c2.ellipse(32, 32, 30 * kk, 30, 0, Math.PI / 2, -Math.PI / 2, true); else c2.ellipse(32, 32, 30 * -kk, 30, 0, Math.PI / 2, Math.PI * 1.5, false); c2.fill();
        const ang = sS ? Math.atan2(sS[1] - mS[1], sS[0] - mS[0]) : 0; ctx.save(); ctx.translate(mS[0], mS[1]); ctx.rotate(ang); const gr = ctx.createRadialGradient(0, 0, mr * 0.8, 0, 0, mr * 2.6); gr.addColorStop(0, 'rgba(230,230,255,' + (0.18 * mp.ill * (1 - dl * 0.7)).toFixed(3) + ')'); gr.addColorStop(1, 'rgba(0,0,0,0)'); ctx.fillStyle = gr; ctx.beginPath(); ctx.arc(0, 0, mr * 2.6, 0, 7); ctx.fill(); ctx.drawImage(tmp, -mr, -mr, mr * 2, mr * 2); ctx.restore();
        label('Moon', mS[0] + mr + 6, mS[1] + 4, '#f4efdc', 12.5); items.push({ x: mS[0], y: mS[1], r: Math.max(12, mr + 4), kind: 'obj', id: 'moon' });
      }
      if (sS && !hidden(sunH)) {
        const sr = Math.max(7, 0.27 * R * Sc), gr = ctx.createRadialGradient(sS[0], sS[1], 0, sS[0], sS[1], sr * 6); gr.addColorStop(0, 'rgba(255,248,210,.95)'); gr.addColorStop(0.15, 'rgba(255,230,140,.6)'); gr.addColorStop(1, 'rgba(255,200,80,0)');
        if (sunH.alt > -4) { ctx.fillStyle = gr; ctx.beginPath(); ctx.arc(sS[0], sS[1], sr * 6, 0, 7); ctx.fill(); }
        ctx.fillStyle = '#fff7cf'; ctx.beginPath(); ctx.arc(sS[0], sS[1], sr, 0, 7); ctx.fill(); if (sunH.alt > -2) label('Sun', sS[0] + sr + 6, sS[1] + 4, '#ffe9a0', 12.5); items.push({ x: sS[0], y: sS[1], r: sr + 6, kind: 'obj', id: 'sun' });
      }
      /* horizon line, cardinal points, zenith */
      { const pts = []; for (let z = 0; z <= 360; z += 2) pts.push(PH(z, 0)); lineSeg(pts, 'rgba(255,255,255,.35)', 1.4, 300); }
      if (LAY.card) { [['N', 0], ['NE', 45], ['E', 90], ['SE', 135], ['S', 180], ['SW', 225], ['W', 270], ['NW', 315]].forEach(c => { const p = PH(c[1], 0); if (!p || p[0] < -10 || p[0] > W + 10 || p[1] < 10 || p[1] > H + 10) return; const big = c[0].length === 1; ctx.font = (big ? 'bold 17px' : '12px') + ' system-ui,sans-serif'; ctx.fillStyle = c[0] === 'N' ? '#ff7a7a' : 'rgba(255,255,255,.88)'; ctx.textAlign = 'center'; ctx.fillText(c[0], p[0], p[1] - 7); ctx.textAlign = 'start'; }); const zp = PH(0, 90); if (zp && zp[0] > 0 && zp[0] < W && zp[1] > 0 && zp[1] < H) { ctx.strokeStyle = 'rgba(255,255,255,.4)'; ctx.beginPath(); ctx.arc(zp[0], zp[1], 4, 0, 7); ctx.moveTo(zp[0] - 8, zp[1]); ctx.lineTo(zp[0] + 8, zp[1]); ctx.moveTo(zp[0], zp[1] - 8); ctx.lineTo(zp[0], zp[1] + 8); ctx.stroke(); label('overhead', zp[0] + 8, zp[1] - 6, 'rgba(255,255,255,.6)', 11); } }
      /* selection ring and arrow */
      if (st.sel) {
        const sc2 = screenOf(st.sel), s = sc2.s; const on = s && s[0] > 0 && s[0] < W && s[1] > 0 && s[1] < H;
        if (on) { ctx.strokeStyle = '#46d7c8'; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(s[0], s[1], 17, 0, 7); ctx.stroke(); ctx.beginPath(); [[-1, 0], [1, 0], [0, -1], [0, 1]].forEach(q => { ctx.moveTo(s[0] + q[0] * 17, s[1] + q[1] * 17); ctx.lineTo(s[0] + q[0] * 25, s[1] + q[1] * 25); }); ctx.stroke(); }
        else {
          const v = S.vec(sc2.p.ra, sc2.p.dec), ax = v[0] * Rq[0] + v[1] * Rq[1] + v[2] * Rq[2], ay = v[0] * Uq[0] + v[1] * Uq[1] + v[2] * Uq[2], ang = Math.atan2(-ay, ax), m = 34, ex = clamp(cx + Math.cos(ang) * 4000, m, W - m), ey = clamp(cy + Math.sin(ang) * 4000, m + 24, H - m - 40);
          ctx.save(); ctx.translate(ex, ey); ctx.rotate(ang); ctx.fillStyle = '#46d7c8'; ctx.beginPath(); ctx.moveTo(16, 0); ctx.lineTo(-8, -10); ctx.lineTo(-8, 10); ctx.closePath(); ctx.fill(); ctx.restore(); ctx.font = '12px system-ui'; ctx.fillStyle = '#46d7c8'; ctx.textAlign = 'center'; ctx.fillText(st.sel.label, clamp(ex, 50, W - 50), ey + (ey > cy ? -16 : 24)); ctx.textAlign = 'start';
        }
      }
      $$('skhd').textContent = 'Facing ' + S.cardWord(st.az) + ' (' + Math.round(st.az) + '°), ' + (st.alt >= 0 ? Math.round(st.alt) + '° up' : Math.round(-st.alt) + '° down') + ' · view ' + Math.round(st.fov) + '°';
      cv.style.filter = LAY.red ? 'grayscale(1) sepia(1) hue-rotate(-55deg) saturate(7) brightness(.75)' : '';
      dirty = false; lastDraw = performance.now();
    }

    /* ---------- selection and info ---------- */
    const starObj = idx => { const nm = d.nameOf[idx], s = d.stars[idx]; return Sky.catalog().find(o => o.idx === idx) || { id: 'st' + idx, type: 'star', label: 'Star, magnitude ' + s[2].toFixed(1), idx, mag: s[2], bv: s[3], pos: () => ({ ra: s[0], dec: s[1] }) }; };
    function pick(x, y) {
      let best = null, bd = 1e9; for (const it of items) { const dd = Math.hypot(it.x - x, it.y - y); if (dd < it.r + 4 && dd - it.r * 0.3 < bd) { bd = dd - it.r * 0.3; best = it; } }
      if (!best) return null; if (best.kind === 'star') return starObj(best.idx); if (best.kind === 'dso') return Sky.catalog().find(o => o.id === d.messier[best.i][0]); return Sky.catalog().find(o => o.id === best.id);
    }
    const TYPE = { star: 'Star', planet: 'Planet', sun: 'Star (our Sun)', moon: 'Moon', dso: 'Deep-sky object', con: 'Constellation' }, DSO = { oc: 'Open star cluster', gc: 'Globular cluster', gn: 'Glowing nebula', pn: 'Planetary nebula', snr: 'Supernova remnant', g: 'Galaxy', dn: 'Dark nebula', en: 'Emission nebula', rn: 'Reflection nebula', c: 'Cluster with nebula', as: 'Star group', ds: 'Double star' };
    let infoT = 0;
    function info() {
      const box = $$('skinfo'), o = st.sel; if (!o) { box.style.display = 'none'; return; }
      const t = st.t, h = Sky.horOf(o, t), p = o.pos(t), t0 = new Date(t); t0.setHours(0, 0, 0, 0);
      const rs = S.riseSet(ms => Sky.horOf(o, ms).alt, t0.getTime(), o.type === 'sun' ? -0.833 : o.type === 'moon' ? -0.7 : -0.5);
      let sub = TYPE[o.type] || '', extra = '';
      if (o.type === 'star') { sub = 'Star'; if (o.c) sub += ' in ' + o.c; extra += '<div class="skrow"><span>Brightness</span><b>magnitude ' + o.mag.toFixed(2) + '</b></div>'; const ly = Sky.starLy && Sky.starLy(o.label); if (ly) extra += '<div class="skrow"><span>Distance</span><b>about ' + ly.toLocaleString() + ' light-years</b></div>'; if (o.bv != null) extra += '<div class="skrow"><span>Colour</span><b>' + (o.bv < 0 ? 'blue-white' : o.bv < 0.4 ? 'white' : o.bv < 0.8 ? 'yellow-white' : o.bv < 1.2 ? 'orange' : 'red') + '</b></div>'; }
      if (o.type === 'dso') { sub = DSO[o.kind] || 'Deep-sky object'; extra += '<div class="skrow"><span>Brightness</span><b>magnitude ' + o.mag + '</b></div>'; }
      if (o.type === 'planet') { extra += '<div class="skrow"><span>Distance from Earth</span><b>' + p.dist.toFixed(2) + ' AU (' + (p.dist * 149.6).toFixed(0) + ' million km)</b></div><div class="skrow"><span>Light takes</span><b>' + (p.lightMin < 90 ? p.lightMin.toFixed(1) + ' minutes' : (p.lightMin / 60).toFixed(1) + ' hours') + '</b></div><div class="skrow"><span>Brightness</span><b>magnitude ' + p.mag.toFixed(1) + '</b></div><div class="skrow"><span>Lit</span><b>' + (p.ill * 100).toFixed(0) + '%</b></div>'; }
      if (o.type === 'moon') { extra += '<div class="skrow"><span>Phase</span><b>' + S.phaseName(p.elong) + ', ' + (p.ill * 100).toFixed(0) + '% lit</b></div><div class="skrow"><span>Distance</span><b>' + Math.round(p.km).toLocaleString() + ' km</b></div>'; }
      if (o.type === 'sun') extra += '<div class="skrow"><span>Distance</span><b>' + (p.r * 149.6).toFixed(1) + ' million km</b></div><div class="skrow"><span>Light takes</span><b>' + (p.r * 8.3167).toFixed(2) + ' minutes</b></div>';
      const bl = BL[o.label] || (o.type === 'con' ? 'Open the sky chart and turn on constellation lines to see its shape.' : '');
      box.style.display = 'block';
      box.innerHTML = '<div class="row" style="align-items:flex-start"><div style="flex:1"><b style="font-size:16px">' + esc(o.label) + '</b><div class="mute small">' + esc(sub) + '</div></div><button class="skbtn" id="skx">✕</button></div>' +
        '<div style="margin:6px 0;font-size:13.5px">' + (h.alt >= 0 ? '<span style="color:var(--ok)">Above the horizon</span>' : '<span class="mute">Below the horizon</span>') + '. ' + esc(S.whereWords(h)) + '.</div>' +
        '<div class="skrow"><span>Altitude / azimuth</span><b>' + h.alt.toFixed(1) + '° / ' + h.az.toFixed(1) + '° ' + S.card(h.az) + '</b></div>' +
        '<div class="skrow"><span>Rises</span><b>' + (rs.rise ? Sky.fmtT(rs.rise) : rs.always === 'up' ? 'never sets' : '--') + '</b></div><div class="skrow"><span>Highest</span><b>' + Sky.fmtT(rs.transit) + ' (' + rs.maxAlt.toFixed(0) + '°)</b></div><div class="skrow"><span>Sets</span><b>' + (rs.set ? Sky.fmtT(rs.set) : rs.always === 'up' ? 'never sets' : '--') + '</b></div>' + extra +
        (bl ? '<div class="small" style="margin:8px 0 2px;line-height:1.45">' + esc(bl) + '</div>' : '') +
        '<div class="row" style="gap:6px;margin-top:8px;flex-wrap:wrap"><button class="skbtn on" id="skgo">Look at it</button><button class="skbtn' + (st.track ? ' on' : '') + '" id="sktr">Follow it</button><button class="skbtn" id="skcmp">Compass</button></div>' +
        (o.type === 'sun' ? '<div class="small" style="color:var(--warn);margin-top:6px">⚠ Never look at the Sun without proper solar filters.</div>' : '');
      $$('skx').onclick = () => { st.sel = null; st.track = false; info(); dirty = true; };
      $$('skgo').onclick = () => aim(o); $$('sktr').onclick = () => { st.track = !st.track; if (st.track) aim(o); info(); };
      $$('skcmp').onclick = () => Sky.go('compass', o);
    }
    let anim = null;
    function aim(o, zoomTo) {
      const h = Sky.horOf(o, st.t); let az = h.az, alt = clamp(h.alt, -80, 89); const from = { az: st.az, alt: st.alt, fov: st.fov }; let da = ((az - from.az + 540) % 360) - 180;
      anim = { t0: performance.now(), from, da, alt, fov: zoomTo || (o.type === 'sun' || o.type === 'moon' ? st.fov : Math.min(st.fov, 60)) }; dirty = true;
    }
    function select(o) { st.sel = o; if (o) aim(o); info(); dirty = true; }

    /* ---------- controls ---------- */
    const layList = $$('sklaylist');
    layList.innerHTML = LAYERS.map(l => '<label style="display:flex;gap:7px;align-items:center;font-size:13px;padding:2px 0;cursor:pointer"><input type="checkbox" data-l="' + l[0] + '"' + (LAY[l[0]] ? ' checked' : '') + '>' + l[1] + '</label>').join('') + '<div class="row" style="gap:5px;margin-top:6px;flex-wrap:wrap"><button class="skbtn" data-v="N">N</button><button class="skbtn" data-v="E">E</button><button class="skbtn" data-v="S">S</button><button class="skbtn" data-v="W">W</button><button class="skbtn" data-v="Z">Overhead</button></div>';
    layList.onchange = e => { const k = e.target.dataset.l; if (k) { LAY[k] = e.target.checked ? 1 : 0; ls.set('sky_layers', JSON.stringify(LAY)); dirty = true; } };
    layList.onclick = e => { const v = e.target.dataset.v; if (!v) return; const m = { N: 0, E: 90, S: 180, W: 270 }; anim = { t0: performance.now(), from: { az: st.az, alt: st.alt, fov: st.fov }, da: v === 'Z' ? 0 : ((m[v] - st.az + 540) % 360) - 180, alt: v === 'Z' ? 89 : 30, fov: st.fov }; dirty = true; };
    $$('sklay').onclick = () => { layList.style.display = layList.style.display === 'none' ? 'block' : 'none'; };
    const srch = $$('sksrch'), res = $$('sksres');
    srch.oninput = () => { const hits = Sky.find(srch.value); res.style.display = hits.length ? 'block' : 'none'; res.innerHTML = hits.map((o, i) => '<div class="hit" data-i="' + i + '" style="padding:4px 8px;cursor:pointer;font-size:13px;border-radius:6px">' + esc(o.label) + ' <span class="mute small">' + (TYPE[o.type] || '') + '</span></div>').join(''); res._hits = hits; };
    res.onclick = e => { const h = e.target.closest('.hit'); if (!h) return; const o = res._hits[+h.dataset.i]; res.style.display = 'none'; srch.value = ''; select(o); };
    if (Sky.cs.panel) layList.style.display = 'block';

    const tm = $$('sktm'), spd = [['Live', 1], ['Paused', 0], ['1 min / sec', 60], ['10 min / sec', 600], ['1 hour / sec', 3600], ['6 hours / sec', 21600], ['1 day / sec', 86400], ['Backwards 1 hour / sec', -3600]];
    const isoLocal = ms => { const x = new Date(ms - new Date(ms).getTimezoneOffset() * 6e4); return x.toISOString().slice(0, 16); };
    tm.innerHTML = '<button class="skbtn" id="tnow">Now</button><button class="skbtn" id="tm1">−1 h</button><button class="skbtn" id="tp1">+1 h</button><button class="skbtn" id="tm1d">−1 day</button><button class="skbtn" id="tp1d">+1 day</button><input class="skin" id="tdt" type="datetime-local"><select class="skin" id="tsp">' + spd.map((s, i) => '<option value="' + i + '">' + s[0] + '</option>').join('') + '</select><span id="tlab" class="small" style="margin-left:6px"></span>';
    const setT = ms => { st.t = ms; if (st.speed === 1) st.speed = 0; $$('tsp').value = spd.findIndex(s => s[1] === st.speed); dirty = true; };
    $$('tnow').onclick = () => { st.t = Date.now(); st.speed = 1; $$('tsp').value = 0; dirty = true; };
    $$('tm1').onclick = () => setT(st.t - 36e5); $$('tp1').onclick = () => setT(st.t + 36e5); $$('tm1d').onclick = () => setT(st.t - 864e5); $$('tp1d').onclick = () => setT(st.t + 864e5);
    $$('tdt').onchange = e => { const v = new Date(e.target.value).getTime(); if (!isNaN(v)) setT(v); };
    $$('tsp').onchange = e => { st.speed = spd[+e.target.value][1]; if (st.speed === 1) st.t = Date.now(); dirty = true; }; $$('tsp').value = Math.max(0, spd.findIndex(s => s[1] === st.speed));

    /* mouse and touch */
    const ptrs = new Map(); let pinch0 = 0, moved = 0, downPos = null;
    cv.onpointerdown = e => { try { cv.setPointerCapture(e.pointerId); } catch (x) {} ptrs.set(e.pointerId, [e.clientX, e.clientY]); moved = 0; downPos = [e.offsetX, e.offsetY]; anim = null; if (ptrs.size === 2) { const a = [...ptrs.values()]; pinch0 = Math.hypot(a[0][0] - a[1][0], a[0][1] - a[1][1]); } };
    cv.onpointermove = e => {
      const prev = ptrs.get(e.pointerId); if (!prev) return;
      if (ptrs.size === 2) { ptrs.set(e.pointerId, [e.clientX, e.clientY]); const a = [...ptrs.values()], dd = Math.hypot(a[0][0] - a[1][0], a[0][1] - a[1][1]); if (pinch0) { st.fov = clamp(st.fov * pinch0 / dd, 3, 150); pinch0 = dd; dirty = true; } return; }
      const dx = e.clientX - prev[0], dy = e.clientY - prev[1]; moved += Math.abs(dx) + Math.abs(dy); ptrs.set(e.pointerId, [e.clientX, e.clientY]);
      if (moved > 3) { dragging = true; st.track = false; const rpp = 1 / Sc / R / (1 + 0); st.az = (st.az - dx * rpp / Math.max(0.25, Math.cos(st.alt * R)) + 360) % 360; st.alt = clamp(st.alt + dy * rpp, -89, 89.5); dirty = true; }
    };
    cv.onpointerup = e => { ptrs.delete(e.pointerId); dragging = false; if (moved < 5 && downPos && ptrs.size === 0) { const o = pick(downPos[0], downPos[1]); if (o) { st.sel = o; info(); dirty = true; } else if (st.sel && !e.target.closest('#skinfo')) { /* keep selection */ } } };
    cv.onwheel = e => { e.preventDefault(); st.fov = clamp(st.fov * Math.exp(e.deltaY * 0.0014), 3, 150); dirty = true; };
    const key = e => { if (A.cur !== 'sky' || Sky.cur !== 'chart' || /INPUT|SELECT|TEXTAREA/.test(e.target.tagName || '')) return; const k = e.key, step = st.fov / 12; if (k === 'ArrowLeft') st.az = (st.az - step + 360) % 360; else if (k === 'ArrowRight') st.az = (st.az + step) % 360; else if (k === 'ArrowUp') st.alt = clamp(st.alt + step, -89, 89.5); else if (k === 'ArrowDown') st.alt = clamp(st.alt - step, -89, 89.5); else if (k === '+' || k === '=') st.fov = clamp(st.fov / 1.25, 3, 150); else if (k === '-') st.fov = clamp(st.fov * 1.25, 3, 150); else return; e.preventDefault(); dirty = true; };
    document.addEventListener('keydown', key);

    /* sizing and loop */
    const resize = () => { dpr = Math.min(2, window.devicePixelRatio || 1); const r = wrap.getBoundingClientRect(); W = Math.max(200, Math.round(r.width)); H = Math.max(200, Math.round(r.height)); cv.width = W * dpr; cv.height = H * dpr; cv.style.width = W + 'px'; cv.style.height = H + 'px'; dirty = true; };
    const ro = new ResizeObserver(resize); ro.observe(wrap); resize();
    let raf = 0, stopped = false;
    const loop = () => {
      if (stopped) return; const now = performance.now(), dtm = Math.min(0.25, (now - lastT) / 1000); lastT = now;
      if (anim) { const k = clamp((now - anim.t0) / 650, 0, 1), e = 1 - Math.pow(1 - k, 3); st.az = (anim.from.az + anim.da * e + 360) % 360; st.alt = lerp(anim.from.alt, anim.alt, e); st.fov = lerp(anim.from.fov, anim.fov, e); if (k >= 1) anim = null; dirty = true; }
      if (st.speed === 1) { if (now - lastDraw > 4000) { st.t = Date.now(); dirty = true; } } else if (st.speed !== 0) { st.t += dtm * 1000 * st.speed; dirty = true; }
      if (st.track && st.sel && !anim && !dragging) { const h = Sky.horOf(st.sel, st.t); st.az = h.az; st.alt = clamp(h.alt, -85, 89); dirty = true; }
      if (dirty && cv.isConnected) {
        frame(); $$('tlab').textContent = new Date(st.t).toLocaleString([], { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' }) + (st.speed === 1 ? ' (live)' : '') + ' · Sun ' + (sunH.alt > 0 ? 'up' : sunH.alt > -18 ? 'twilight' : 'down');
        if (document.activeElement !== $$('tdt')) $$('tdt').value = isoLocal(st.t); if (st.sel && now - infoT > 1500) { infoT = now; info(); }
      }
      raf = requestAnimationFrame(loop);
    };
    body._cleanup = () => { stopped = true; cancelAnimationFrame(raf); ro.disconnect(); document.removeEventListener('keydown', key); Sky.cs.panel = layList.style.display !== 'none'; };
    if (Sky.arg && Sky.arg.pos) { st.sel = Sky.arg; Sky.arg = null; } else if (Sky.arg && typeof Sky.arg === 'string') { const o = Sky.catalog().find(x => x.id === Sky.arg || x.label === Sky.arg); Sky.arg = null; if (o) st.sel = o; }
    if (st.sel) { info(); if (!anim) aim(st.sel); }
    raf = requestAnimationFrame(loop);
  }, 2);
})();

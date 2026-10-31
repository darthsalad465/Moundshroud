// Sky maths for the Sky tab: sun, moon, planets, stars, rise/set and sky projection. Offline; star data is web/data/sky.json.
(() => {
  const R = Math.PI / 180, sin = x => Math.sin(x * R), cos = x => Math.cos(x * R), tan = x => Math.tan(x * R), mod = (x, m) => ((x % m) + m) % m;
  const asin = x => Math.asin(Math.max(-1, Math.min(1, x))) / R, atan2 = (y, x) => Math.atan2(y, x) / R;
  const jd = ms => ms / 864e5 + 2440587.5;
  const gmst = ms => mod(280.46061837 + 360.98564736629 * (jd(ms) - 2451545), 360);
  const lst = (ms, lon) => mod(gmst(ms) + lon, 360);

  /* equatorial (degrees) to local horizon */
  function toHor(ra, dec, lat, lstDeg) {
    const H = lstDeg - ra, sa = sin(lat) * sin(dec) + cos(lat) * cos(dec) * cos(H);
    return { alt: asin(sa), az: mod(atan2(sin(H), cos(H) * sin(lat) - tan(dec) * cos(lat)) + 180, 360) };
  }
  const obliq = ms => 23.439291 - 0.0130042 * ((jd(ms) - 2451545) / 36525);
  function eclToEq(lam, bet, eps) {
    return { ra: mod(atan2(sin(lam) * cos(eps) - tan(bet) * sin(eps), cos(lam)), 360), dec: asin(sin(bet) * cos(eps) + cos(bet) * sin(eps) * sin(lam)) };
  }

  /* sun */
  function sun(ms) {
    const n = jd(ms) - 2451545, L = mod(280.460 + 0.9856474 * n, 360), g = mod(357.528 + 0.9856003 * n, 360), lam = L + 1.915 * sin(g) + 0.020 * sin(2 * g), eps = obliq(ms);
    const e = eclToEq(lam, 0, eps); return { ra: e.ra, dec: e.dec, lam: mod(lam, 360), r: 1.00014 - 0.01671 * cos(g) - 0.00014 * cos(2 * g) };
  }

  /* moon (truncated Meeus ch.47: about 0.3 degrees) */
  function moon(ms) {
    const T = (jd(ms) - 2451545) / 36525, Lp = 218.3164477 + 481267.88123421 * T, D = 297.8501921 + 445267.1114034 * T, M = 357.5291092 + 35999.0502909 * T, Mp = 134.9633964 + 477198.8675055 * T, F = 93.272095 + 483202.0175233 * T;
    const lam = Lp + 6.288774 * sin(Mp) + 1.274027 * sin(2 * D - Mp) + 0.658314 * sin(2 * D) + 0.213618 * sin(2 * Mp) - 0.185116 * sin(M) - 0.114332 * sin(2 * F) + 0.058793 * sin(2 * D - 2 * Mp) + 0.057066 * sin(2 * D - M - Mp) + 0.053322 * sin(2 * D + Mp) + 0.045758 * sin(2 * D - M) - 0.040923 * sin(M - Mp) - 0.03472 * sin(D) - 0.030383 * sin(M + Mp);
    const bet = 5.128122 * sin(F) + 0.280602 * sin(Mp + F) + 0.277693 * sin(Mp - F) + 0.173237 * sin(2 * D - F) + 0.055413 * sin(2 * D - Mp + F) + 0.046271 * sin(2 * D - Mp - F) + 0.032573 * sin(2 * D + F);
    const km = 385000.56 - 20905.355 * cos(Mp) - 3699.111 * cos(2 * D - Mp) - 2955.968 * cos(2 * D) - 569.925 * cos(2 * Mp);
    const e = eclToEq(lam, bet, obliq(ms)), s = sun(ms), el = mod(lam - s.lam, 360);
    return { ra: e.ra, dec: e.dec, lam: mod(lam, 360), km, par: asin(6378.14 / km), elong: el, ill: (1 - cos(el)) / 2, waxing: el < 180 };
  }
  const PHASES = ['New moon', 'Waxing crescent', 'First quarter', 'Waxing gibbous', 'Full moon', 'Waning gibbous', 'Last quarter', 'Waning crescent'];
  const phaseName = el => PHASES[Math.floor(mod(el + 22.5, 360) / 45) % 8];
  function nextPhase(ms, target) {            // target elongation 0 / 90 / 180 / 270; searches forward with 3 h steps then bisects
    const d = t => mod(moon(t).elong - target + 180, 360) - 180;       // zero crossing going from negative to positive
    let a = ms, da = d(a);
    for (let i = 0; i < 300; i++) { const b = a + 3 * 36e5, db = d(b); if (da < 0 && db >= 0 && db - da < 90) { let lo = a, hi = b; for (let k = 0; k < 24; k++) { const m = (lo + hi) / 2; if (d(m) < 0) lo = m; else hi = m; } return (lo + hi) / 2; } a = b; da = db; }
    return null;
  }

  /* planets: JPL approximate Keplerian elements (valid 1800-2050) */
  let DATA = null;
  function kepler(M, e) { M = mod(M + 180, 360) - 180; let E = M + e / R * sin(M); for (let i = 0; i < 12; i++) { const dE = (M - E + e / R * sin(E)) / (1 - e * cos(E)); E += dE; if (Math.abs(dE) < 1e-9) break; } return E; }
  function helio(id, ms) {
    const el = DATA.planets[id].e, T = (jd(ms) - 2451545) / 36525;
    const a = el.a + el.da * T, e = el.e + el.de * T, I = el.i + el.di * T, L = el.L + el.dL * T, W = el.W + el.dW * T, N = el.N + el.dN * T, w = W - N, M = L - W;
    const E = kepler(M, e), xp = a * (cos(E) - e), yp = a * Math.sqrt(1 - e * e) * sin(E);
    return {
      x: (cos(w) * cos(N) - sin(w) * sin(N) * cos(I)) * xp + (-sin(w) * cos(N) - cos(w) * sin(N) * cos(I)) * yp,
      y: (cos(w) * sin(N) + sin(w) * cos(N) * cos(I)) * xp + (-sin(w) * sin(N) + cos(w) * cos(N) * cos(I)) * yp,
      z: (sin(w) * sin(I)) * xp + (cos(w) * sin(I)) * yp
    };
  }
  const PL = ['mer', 'ven', 'mar', 'jup', 'sat', 'ura', 'nep'];
  function planet(id, ms) {                          // geocentric RA/Dec (J2000 frame) plus distances
    const p = helio(id, ms), e = helio('ter', ms), x = p.x - e.x, y = p.y - e.y, z = p.z - e.z, eps = 23.4392911;
    const xe = x, ye = y * cos(eps) - z * sin(eps), ze = y * sin(eps) + z * cos(eps), dl = Math.sqrt(x * x + y * y + z * z), rs = Math.sqrt(p.x * p.x + p.y * p.y + p.z * p.z);
    const ra = mod(atan2(ye, xe), 360), dec = asin(ze / dl), re = Math.sqrt(e.x * e.x + e.y * e.y + e.z * e.z);
    const ph = Math.acos(Math.max(-1, Math.min(1, (rs * rs + dl * dl - re * re) / (2 * rs * dl)))) / R;       // phase angle at the planet
    const elong = Math.acos(Math.max(-1, Math.min(1, (re * re + dl * dl - rs * rs) / (2 * re * dl)))) / R;
    const m0 = { mer: -0.42 + 0.038 * ph - 0.000273 * ph * ph + 0.000002 * ph ** 3, ven: -4.4 + 0.0009 * ph + 0.000239 * ph * ph - 0.00000065 * ph ** 3, mar: -1.52 + 0.016 * ph, jup: -9.4 + 0.005 * ph, sat: -8.88, ura: -7.19, nep: -6.87 }[id];
    return { id, name: DATA.planets[id].n, ra, dec, dist: dl, r: rs, mag: m0 + 5 * Math.log10(rs * dl), phase: ph, elong, ill: (1 + cos(ph)) / 2, lightMin: dl * 8.316746, helio: p };
  }
  function orbitPts(id, ms, n = 180) {              // one full orbit sampled around the current date
    const pr = { mer: 87.97, ven: 224.7, ter: 365.256, mar: 686.98, jup: 4332.6, sat: 10759, ura: 30688, nep: 60182 }[id], out = [];
    for (let i = 0; i <= n; i++) out.push(helio(id, ms + (i / n - 0.5) * pr * 864e5)); return out;
  }
  const PERIOD = { mer: 87.97, ven: 224.7, ter: 365.256, mar: 686.98, jup: 4332.6, sat: 10759, ura: 30688, nep: 60182 };

  /* rise / set / transit by sampling the altitude each 6 minutes from a start time */
  function riseSet(fn, t0, thr, hours = 24) {
    const step = 6 * 6e4, n = Math.round(hours * 36e5 / step); let prev = fn(t0) - thr, best = { alt: -99, t: t0 }, rise = null, set = null;
    for (let i = 1; i <= n; i++) {
      const t = t0 + i * step, a = fn(t), v = a - thr;
      if (a > best.alt) best = { alt: a, t };
      if (prev < 0 && v >= 0 && rise == null) rise = t - step * v / (v - prev);
      if (prev >= 0 && v < 0 && set == null) set = t - step * v / (v - prev) - step;
      prev = v;
    }
    return { rise, set, transit: best.t, maxAlt: best.alt, always: prev >= 0 && rise == null && set == null ? 'up' : (prev < 0 && rise == null && set == null && best.alt < thr ? 'down' : null) };
  }

  /* a place on the sky -> altitude, azimuth */
  const hor = (obj, ms, lat, lon) => toHor(obj.ra, obj.dec, lat, lst(ms, lon));
  function bodyAt(name, ms) {
    if (name === 'sun') return sun(ms); if (name === 'moon') return moon(ms); return planet(name, ms);
  }
  function moonTopo(ms, lat, lon) { const m = moon(ms), h = hor(m, ms, lat, lon); h.alt -= m.par * cos(h.alt); return h; }   // parallax lowers the Moon by up to ~1 degree

  /* star colours from B-V */
  const STOPS = [[-0.35, 155, 176, 255], [0, 202, 215, 255], [0.3, 248, 247, 255], [0.6, 255, 244, 234], [1.0, 255, 210, 161], [1.5, 255, 178, 110], [2.0, 255, 140, 80]];
  function bvRGB(bv) {
    if (bv <= STOPS[0][0]) return STOPS[0].slice(1); if (bv >= STOPS[6][0]) return STOPS[6].slice(1);
    for (let i = 0; i < 6; i++) if (bv <= STOPS[i + 1][0]) { const a = STOPS[i], b = STOPS[i + 1], f = (bv - a[0]) / (b[0] - a[0]); return [1, 2, 3].map(k => Math.round(a[k] + (b[k] - a[k]) * f)); }
  }

  /* data */
  const vec = (ra, dec) => [cos(dec) * cos(ra), cos(dec) * sin(ra), sin(dec)];
  let loading = null;
  function load() {
    if (DATA) return Promise.resolve(DATA);
    return loading || (loading = fetch('/web/data/sky.json').then(r => r.json()).then(d => {
      DATA = d; const n = d.stars.length, xyz = new Float32Array(n * 3), col = [];
      d.stars.forEach((s, i) => { const v = vec(s[0], s[1]); xyz[i * 3] = v[0]; xyz[i * 3 + 1] = v[1]; xyz[i * 3 + 2] = v[2]; const c = bvRGB(s[3]); col.push('rgb(' + c.join(',') + ')'); });
      d.xyz = xyz; d.col = col; d.nameOf = {}; d.names.forEach(x => { d.nameOf[x[0]] = x; });
      d.consLines = d.cons.map(c => c.l.map(seg => seg.map(p => vec(p[0], p[1]))));
      d.messierV = d.messier.map(m => vec(m[4], m[5]));
      // approximate Milky Way: points scattered along the galactic plane, thicker towards the galactic centre
      const G = [[-0.0548755604, 0.4941094279, -0.867666149], [-0.8734370902, -0.44482963, -0.1980763734], [-0.4838350155, 0.7469822445, 0.4559837762]];
      let seed = 7; const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647, gauss = () => (rnd() + rnd() + rnd() + rnd() - 2) * 1.7;
      const mw = []; for (let i = 0; i < 2600; i++) {
        const l = rnd() * 360, dl = Math.min(l, 360 - l), keep = 0.28 + 0.72 * Math.exp(-dl / 55); if (rnd() > keep) { i--; continue; }
        const b = gauss() * (5 + 4 * Math.exp(-dl / 40)), g = [cos(b) * cos(l), cos(b) * sin(l), sin(b)];
        mw.push([G[0][0] * g[0] + G[0][1] * g[1] + G[0][2] * g[2], G[1][0] * g[0] + G[1][1] * g[1] + G[1][2] * g[2], G[2][0] * g[0] + G[2][1] * g[1] + G[2][2] * g[2], keep]);
      }
      d.mw = mw; return d;
    }));
  }

  /* directions in words */
  const C16 = ['N', 'NNE', 'NE', 'ENE', 'E', 'ESE', 'SE', 'SSE', 'S', 'SSW', 'SW', 'WSW', 'W', 'WNW', 'NW', 'NNW'];
  const NAME16 = ['north', 'north-northeast', 'northeast', 'east-northeast', 'east', 'east-southeast', 'southeast', 'south-southeast', 'south', 'south-southwest', 'southwest', 'west-southwest', 'west', 'west-northwest', 'northwest', 'north-northwest'];
  const card = d => C16[Math.round(mod(d, 360) / 22.5) % 16], cardWord = d => NAME16[Math.round(mod(d, 360) / 22.5) % 16];
  function whereWords(h) { if (h.alt < -0.5) return 'Below the horizon (' + Math.abs(h.alt).toFixed(0) + '° down, toward the ' + cardWord(h.az) + ')'; const hi = h.alt > 80 ? 'almost straight overhead' : h.alt > 55 ? 'high up' : h.alt > 25 ? 'about halfway up the sky' : h.alt > 8 ? 'low' : 'right at the horizon'; return 'Look ' + cardWord(h.az) + ', ' + h.alt.toFixed(0) + '° above the horizon (' + hi + ')'; }

  /* bearing and distance between two places */
  function gc(a, b) { const dLat = (b.lat - a.lat) * R, dLon = (b.lon - a.lon) * R, h = Math.sin(dLat / 2) ** 2 + Math.cos(a.lat * R) * Math.cos(b.lat * R) * Math.sin(dLon / 2) ** 2; return { km: 6371.0088 * 2 * Math.asin(Math.sqrt(h)), brg: mod(atan2(sin(b.lon - a.lon) * cos(b.lat), cos(a.lat) * sin(b.lat) - sin(a.lat) * cos(b.lat) * cos(b.lon - a.lon)), 360) }; }

  window.SkyCore = { R, mod, jd, lst, toHor, hor, sun, moon, moonTopo, phaseName, nextPhase, planet, helio, orbitPts, PL, PERIOD, riseSet, bodyAt, bvRGB, vec, load, data: () => DATA, card, cardWord, whereWords, gc, sin, cos, tan, asin, atan2 };
})();

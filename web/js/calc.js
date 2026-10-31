// Instant answers: maths, percentages, unit conversion, time zones, date counting. All offline, no AI needed.
(() => {
  const fmt = n => {
    if (!isFinite(n)) return String(n);
    const a = Math.abs(n); let s;
    if (a !== 0 && (a >= 1e15 || a < 1e-6)) s = n.toExponential(6);
    else s = (+n.toPrecision(10)).toLocaleString('en-US', { maximumFractionDigits: 8 });
    return s;
  };
  /* ---- expression evaluator (recursive descent) ---- */
  function evalExpr(src, opt) {
    opt = opt || {}; const rad = !!opt.rad, ang = x => rad ? x : x * Math.PI / 180, inv = x => rad ? x : x * 180 / Math.PI;
    const s = src.replace(/×/g, '*').replace(/÷/g, '/').replace(/(\d),(\d{3})(?!\d)/g, '$1$2').replace(/(\d),(\d{3})(?!\d)/g, '$1$2');
    const tok = []; const re = /\s*(\d*\.?\d+(?:e[+-]?\d+)?|[a-z_]+[0-9]?|\*\*|[-+*/^%!(),])/gy; let m, last = 0;
    while ((m = re.exec(s)) && m.index === last) { tok.push(m[1]); last = re.lastIndex; }
    if (last < s.trimEnd().length) throw new Error('bad');
    let p = 0; const peek = () => tok[p], next = () => tok[p++];
    const fact = n => { if (n < 0 || n !== Math.floor(n) || n > 170) throw new Error('fact'); let r = 1; for (let i = 2; i <= n; i++) r *= i; return r; };
    const F = { sqrt: Math.sqrt, cbrt: Math.cbrt, abs: Math.abs, sin: x => Math.sin(ang(x)), cos: x => Math.cos(ang(x)), tan: x => Math.tan(ang(x)), asin: x => inv(Math.asin(x)), acos: x => inv(Math.acos(x)), atan: x => inv(Math.atan(x)), sinh: Math.sinh, cosh: Math.cosh, tanh: Math.tanh, log: Math.log10, log2: Math.log2, ln: Math.log, round: Math.round, floor: Math.floor, ceil: Math.ceil, exp: Math.exp, min: Math.min, max: Math.max, pow: Math.pow, fact, mod: (a, b) => a % b, sign: Math.sign, hypot: Math.hypot, sq: x => x * x };
    const C = { pi: Math.PI, e: Math.E, ans: +opt.ans || 0, tau: Math.PI * 2 };
    function primary() {
      const t = next(); if (t === undefined) throw new Error('end');
      if (/^[\d.]/.test(t)) return parseFloat(t);
      if (t === '(') { const v = expr(); if (next() !== ')') throw new Error('paren'); return v; }
      if (t in C) return C[t];
      if (t in F) { if (next() !== '(') throw new Error('call'); const a = []; if (peek() !== ')') { do { a.push(expr()); } while (peek() === ',' && next()); } if (next() !== ')') throw new Error('paren'); return F[t](...a); }
      throw new Error('tok ' + t);
    }
    function postfix() { let v = primary(); while (peek() === '%' || peek() === '!') { const o = next(); v = o === '%' ? v / 100 : fact(v); } return v; }
    function unary() { if (peek() === '-') { next(); return -unary(); } if (peek() === '+') { next(); return unary(); } return power(); }
    function power() { const b = postfix(); if (peek() === '^' || peek() === '**') { next(); return Math.pow(b, unary()); } return b; }
    function term() { let v = unary(); while (peek() === '*' || peek() === '/') { const o = next(); const r = unary(); v = o === '*' ? v * r : v / r; } return v; }
    function expr() { let v = term(); while (peek() === '+' || peek() === '-') { const o = next(); const r = term(); v = o === '+' ? v + r : v - r; } return v; }
    const v = expr(); if (p < tok.length) throw new Error('extra'); return v;
  }
  /* ---- units ---- */
  const UNITS = {}; const def = (dim, base, names) => { for (const [k, f] of Object.entries(names)) for (const n of k.split('|')) UNITS[n] = { dim, f }; };
  def('length', 1, { 'm|meter|meters|metre|metres': 1, 'km|kilometer|kilometers|kilometre|kilometres': 1000, 'cm|centimeter|centimeters': .01, 'mm|millimeter|millimeters': .001, 'mi|mile|miles': 1609.344, 'yd|yard|yards': .9144, 'ft|foot|feet': .3048, 'in|inch|inches': .0254, 'nm|nautical mile|nautical miles': 1852 });
  def('mass', 1, { 'kg|kilogram|kilograms|kilo|kilos': 1, 'g|gram|grams': .001, 'mg|milligram|milligrams': 1e-6, 'lb|lbs|pound|pounds': .45359237, 'oz|ounce|ounces': .028349523, 'st|stone|stones': 6.35029318, 'tonne|tonnes|t': 1000 });
  def('volume', 1, { 'l|liter|liters|litre|litres': 1, 'ml|milliliter|milliliters|millilitre|millilitres': .001, 'gal|gallon|gallons': 3.785411784, 'qt|quart|quarts': .946352946, 'pt|pint|pints': .473176473, 'cup|cups': .2365882365, 'tbsp|tablespoon|tablespoons': .01478676478, 'tsp|teaspoon|teaspoons': .00492892159, 'floz|fl oz|fluid ounce|fluid ounces': .0295735296 });
  def('speed', 1, { 'm/s|mps': 1, 'km/h|kph|kmh|kmph': .27777778, 'mph|mi/h': .44704, 'knot|knots|kn': .51444444, 'ft/s|fps': .3048 });
  def('time', 1, { 's|sec|secs|second|seconds': 1, 'min|mins|minute|minutes': 60, 'h|hr|hrs|hour|hours': 3600, 'd|day|days': 86400, 'wk|wks|week|weeks': 604800, 'yr|year|years': 31557600 });
  def('data', 1, { 'b|byte|bytes': 1, 'kb|kilobyte|kilobytes': 1e3, 'mb|megabyte|megabytes': 1e6, 'gb|gigabyte|gigabytes': 1e9, 'tb|terabyte|terabytes': 1e12, 'kib': 1024, 'mib': 1048576, 'gib': 1073741824 });
  def('area', 1, { 'm2|sqm|sq m|square meter|square meters': 1, 'km2|sqkm|square kilometer|square kilometers': 1e6, 'ha|hectare|hectares': 1e4, 'acre|acres': 4046.8564224, 'ft2|sqft|sq ft|square foot|square feet': .09290304, 'mi2|sqmi|square mile|square miles': 2589988.11 });
  const TEMP = { c: 'c', celsius: 'c', '°c': 'c', centigrade: 'c', f: 'f', fahrenheit: 'f', '°f': 'f', k: 'k', kelvin: 'k' };
  const norm = u => u.trim().toLowerCase().replace(/\.$/, '').replace(/\s+/g, ' ');
  function convertNum(v, a, b) {
    a = norm(a); b = norm(b);
    if (TEMP[a] && TEMP[b]) { const c = TEMP[a] === 'c' ? v : TEMP[a] === 'f' ? (v - 32) * 5 / 9 : v - 273.15; return TEMP[b] === 'c' ? c : TEMP[b] === 'f' ? c * 9 / 5 + 32 : c + 273.15; }
    const ua = UNITS[a], ub = UNITS[b]; if (!ua || !ub || ua.dim !== ub.dim) return null; return v * ua.f / ub.f;
  }
  function convertUnits(t) {
    const m = t.match(/^\s*(-?[\d,]*\.?\d+)\s*([a-z°/²³ .0-9]+?)\s+(?:to|in|into|as)\s+([a-z°/²³ .0-9]+?)\s*$/i); if (!m) return null;
    const v = parseFloat(m[1].replace(/,/g, '')), a = norm(m[2]), b = norm(m[3]);
    if (TEMP[a] && TEMP[b]) {
      let c = TEMP[a] === 'c' ? v : TEMP[a] === 'f' ? (v - 32) * 5 / 9 : v - 273.15;
      const out = TEMP[b] === 'c' ? c : TEMP[b] === 'f' ? c * 9 / 5 + 32 : c + 273.15;
      return { label: fmt(v) + ' ' + a.toUpperCase().replace('°', '°') + ' = ' + fmt(out) + ' ' + b.toUpperCase(), copy: fmt(out) };
    }
    const ua = UNITS[a], ub = UNITS[b]; if (!ua || !ub || ua.dim !== ub.dim) return null;
    const out = v * ua.f / ub.f; return { label: fmt(v) + ' ' + a + ' = ' + fmt(out) + ' ' + b, copy: fmt(out) };
  }
  /* ---- percentages ---- */
  function percents(t) {
    let m;
    if (m = t.match(/^\s*(-?[\d.,]+)\s*%\s*of\s*(-?[\d.,]+)\s*$/i)) { const v = parseFloat(m[1].replace(/,/g, '')) / 100 * parseFloat(m[2].replace(/,/g, '')); return { label: m[1] + '% of ' + m[2] + ' = ' + fmt(v), copy: fmt(v) }; }
    if (m = t.match(/^\s*(-?[\d.,]+)\s*%\s*off\s*(-?[\d.,]+)\s*$/i)) { const b = parseFloat(m[2].replace(/,/g, '')), v = b * (1 - parseFloat(m[1].replace(/,/g, '')) / 100); return { label: m[1] + '% off ' + m[2] + ' = ' + fmt(v) + '  (saves ' + fmt(b - v) + ')', copy: fmt(v) }; }
    if (m = t.match(/^\s*(?:tip\s+)?(-?[\d.,]+)\s*%\s*(?:tip\s+)?on\s*(-?[\d.,]+)\s*$/i)) { const b = parseFloat(m[2].replace(/,/g, '')), tip = b * parseFloat(m[1].replace(/,/g, '')) / 100; return { label: m[1] + '% of ' + m[2] + ' = ' + fmt(tip) + '  (total ' + fmt(b + tip) + ')', copy: fmt(tip) }; }
    if (m = t.match(/^\s*what\s*(?:is|%)?\s*(-?[\d.,]+)\s*(?:is\s*what\s*%\s*of|as\s*a?\s*%\s*of)\s*(-?[\d.,]+)\s*\??$/i)) { const v = parseFloat(m[1].replace(/,/g, '')) / parseFloat(m[2].replace(/,/g, '')) * 100; return { label: m[1] + ' is ' + fmt(v) + '% of ' + m[2], copy: fmt(v) }; }
    return null;
  }
  /* ---- time zones ---- */
  const TZ = { 'new york': 'America/New_York', nyc: 'America/New_York', est: 'America/New_York', edt: 'America/New_York', boston: 'America/New_York', miami: 'America/New_York', toronto: 'America/Toronto', chicago: 'America/Chicago', cst: 'America/Chicago', denver: 'America/Denver', mst: 'America/Denver', 'los angeles': 'America/Los_Angeles', la: 'America/Los_Angeles', pst: 'America/Los_Angeles', seattle: 'America/Los_Angeles', 'san francisco': 'America/Los_Angeles', vancouver: 'America/Vancouver', 'mexico city': 'America/Mexico_City', 'sao paulo': 'America/Sao_Paulo', 'buenos aires': 'America/Argentina/Buenos_Aires', honolulu: 'Pacific/Honolulu', anchorage: 'America/Anchorage',
    london: 'Europe/London', uk: 'Europe/London', gmt: 'UTC', utc: 'UTC', dublin: 'Europe/Dublin', lisbon: 'Europe/Lisbon', paris: 'Europe/Paris', berlin: 'Europe/Berlin', madrid: 'Europe/Madrid', rome: 'Europe/Rome', amsterdam: 'Europe/Amsterdam', cet: 'Europe/Paris', athens: 'Europe/Athens', istanbul: 'Europe/Istanbul', moscow: 'Europe/Moscow', cairo: 'Africa/Cairo', nairobi: 'Africa/Nairobi', lagos: 'Africa/Lagos', johannesburg: 'Africa/Johannesburg',
    dubai: 'Asia/Dubai', mumbai: 'Asia/Kolkata', delhi: 'Asia/Kolkata', india: 'Asia/Kolkata', ist: 'Asia/Kolkata', bangkok: 'Asia/Bangkok', singapore: 'Asia/Singapore', 'hong kong': 'Asia/Hong_Kong', beijing: 'Asia/Shanghai', shanghai: 'Asia/Shanghai', tokyo: 'Asia/Tokyo', jst: 'Asia/Tokyo', seoul: 'Asia/Seoul', sydney: 'Australia/Sydney', melbourne: 'Australia/Melbourne', brisbane: 'Australia/Brisbane', perth: 'Australia/Perth', auckland: 'Pacific/Auckland', 'new zealand': 'Pacific/Auckland', here: undefined, local: undefined };
  const tzName = k => (k.replace(/\b\w/g, c => c.toUpperCase()));
  function tzOffset(ms, tz) {
    const p = new Intl.DateTimeFormat('en-US', { timeZone: tz, hour12: false, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit' }).formatToParts(new Date(ms)).reduce((o, x) => (o[x.type] = x.value, o), {});
    const asUtc = Date.UTC(+p.year, +p.month - 1, +p.day, +p.hour % 24, +p.minute, +p.second); return (asUtc - ms) / 60000;
  }
  const zoneOf = k => { k = norm(k).replace(/^(the )?time in /, ''); if (k === 'here' || k === 'local' || k === 'my time') return Intl.DateTimeFormat().resolvedOptions().timeZone; return TZ[k]; };
  function timeZones(t) {
    let m = t.match(/^\s*(?:what\s+)?time\s+(?:is\s+it\s+)?in\s+([a-z .]+?)\s*\??$/i);
    if (m) { const tz = zoneOf(m[1]); if (!tz) return null; const s = new Date().toLocaleString([], { timeZone: tz, weekday: 'short', hour: 'numeric', minute: '2-digit' }); return { label: 'Right now in ' + tzName(norm(m[1])) + ': ' + s, copy: s }; }
    m = t.match(/^\s*(\d{1,2})(?::(\d{2}))?\s*(am|pm)?\s+(?:in\s+)?([a-z .]+?)\s+(?:to|in|into)\s+([a-z .]+?)\s*\??$/i);
    if (!m) return null;
    let h = +m[1], mi = +(m[2] || 0); const ap = (m[3] || '').toLowerCase(); if (ap === 'pm' && h < 12) h += 12; if (ap === 'am' && h === 12) h = 0;
    const z1 = zoneOf(m[4]), z2 = zoneOf(m[5]); if (!z1 || !z2 || h > 23 || mi > 59) return null;
    const now = new Date(), y = now.getFullYear(), mo = now.getMonth(), d = now.getDate();
    let utc = Date.UTC(y, mo, d, h, mi) - tzOffset(Date.UTC(y, mo, d, h, mi), z1) * 60000; utc = Date.UTC(y, mo, d, h, mi) - tzOffset(utc, z1) * 60000;
    const o = new Date(utc), day1 = new Date(Date.UTC(y, mo, d)).getTime();
    const loc = new Intl.DateTimeFormat('en-US', { timeZone: z2, hour: 'numeric', minute: '2-digit', weekday: 'short' }).format(o);
    const srcDay = new Intl.DateTimeFormat('en-US', { timeZone: z1, day: 'numeric' }).format(o), dstDay = new Intl.DateTimeFormat('en-US', { timeZone: z2, day: 'numeric' }).format(o);
    const note = dstDay !== srcDay ? (((+dstDay > +srcDay) || (+dstDay === 1 && +srcDay > 27)) ? ' (next day)' : ' (previous day)') : '';
    const src = (h % 12 || 12) + ':' + String(mi).padStart(2, '0') + ' ' + (h < 12 ? 'AM' : 'PM');
    return { label: src + ' ' + tzName(norm(m[4])) + ' = ' + loc + note + ' in ' + tzName(norm(m[5])), copy: loc };
  }
  /* ---- dates ---- */
  function dates(t) {
    const m = t.match(/^\s*(?:how many )?days\s+(until|till|since|to|from)\s+(.+?)\s*\??$/i); if (!m) return null;
    let s = m[2].trim(); if (/^today$/i.test(s)) s = new Date().toDateString(); const hasYear = /\b\d{4}\b/.test(s);
    let d = new Date(hasYear ? s : s + ' ' + new Date().getFullYear()); if (isNaN(d)) return null;
    const now = new Date(); now.setHours(0, 0, 0, 0); d.setHours(0, 0, 0, 0);
    const fwd = /^(until|till|to)$/i.test(m[1]); if (fwd && d < now && !hasYear) d.setFullYear(d.getFullYear() + 1);
    const n = Math.round((d - now) / 86400000);
    const dateStr = d.toLocaleDateString([], { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });
    return { label: (n === 0 ? 'Today' : n > 0 ? n + ' days from now' : Math.abs(n) + ' days ago') + '  (' + dateStr + ')', copy: String(Math.abs(n)) };
  }
  /* ---- entry point ---- */
  A.calc = {
    fmt, eval: (s, opt) => evalExpr(String(s).replace(/π/g, 'pi').replace(/√/g, 'sqrt').toLowerCase(), opt), convert: convertNum, dims: () => Object.fromEntries([...new Set(Object.values(UNITS).map(u => u.dim))].map(d => [d, Object.keys(UNITS).filter(k => UNITS[k].dim === d)])),
    try(text) {
      const t = (text || '').trim(); if (!t || t.length > 120 || t.includes('\n')) return null;
      try {
        let r = percents(t) || convertUnits(t) || timeZones(t) || dates(t); if (r) return r;
        const e = t.replace(/^=\s*/, '').replace(/\?$/, '').replace(/^what('s| is)\s+/i, '');
        if (!/^[\d\s+\-*/^().,%×÷a-z_]+$/i.test(e) || !/\d/.test(e)) return null;
        if (!/[+\-*/^×÷%]|\b(sqrt|sin|cos|tan|log|ln|abs|round|floor|ceil|exp|min|max|pow)\b/i.test(e.replace(/^-/, ''))) return null;
        if (/[a-z]{4,}/i.test(e.replace(/\b(sqrt|round|floor|ceil|pow|min|max|sin|cos|tan|log|abs|exp)\b/gi, ''))) return null;
        const v = evalExpr(e.toLowerCase()); if (typeof v !== 'number' || !isFinite(v)) return null;
        return { label: '= ' + fmt(v), copy: String(+v.toPrecision(12)) };
      } catch (err) { return null; }
    }
  };
})();

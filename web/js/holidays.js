// Holidays and notable dates for the Calendar: fixed dates, "Nth weekday" rules, Easter, and the Hebrew, Islamic and Chinese calendars. All worked out on the device, nothing downloaded.
(function () {
  /* fixed dates [month, day, name, note]; US civil holidays are tagged 'US' */
  const FIX = [
    [1, 1, "New Year's Day"], [2, 2, 'Groundhog Day'], [2, 14, "Valentine's Day"], [3, 8, "International Women's Day"], [3, 14, 'Pi Day', '3.14'], [3, 17, "St. Patrick's Day"],
    [4, 1, "April Fools' Day"], [4, 15, 'Tax Day (US)', 'US federal income tax filing deadline, when it falls on a weekday'], [4, 22, 'Earth Day'], [5, 1, 'May Day', 'International Workers\' Day'], [5, 4, 'Star Wars Day', 'May the Fourth'], [5, 5, 'Cinco de Mayo'],
    [6, 14, 'Flag Day (US)'], [6, 19, 'Juneteenth (US)', 'Emancipation Day'], [7, 1, 'Canada Day'], [7, 4, 'Independence Day (US)'], [7, 14, 'Bastille Day', 'French national day'],
    [9, 11, 'Patriot Day (US)', 'Remembering the September 11 attacks'], [10, 31, 'Halloween'], [11, 11, 'Veterans Day (US) / Remembrance Day'], [12, 7, 'Pearl Harbor Remembrance Day'],
    [12, 24, 'Christmas Eve'], [12, 25, 'Christmas Day', '', /Nativity|Christmas/i], [12, 26, 'Boxing Day / Kwanzaa begins', 'Kwanzaa runs December 26 to January 1'], [12, 31, "New Year's Eve"]
  ];
  const sod = d => new Date(d.getFullYear(), d.getMonth(), d.getDate()), addD = (d, n) => new Date(d.getFullYear(), d.getMonth(), d.getDate() + n);
  /* nth weekday of a month (n = 1..4), or the last one (n = -1); dow 0 = Sunday */
  const nth = (y, m, dow, n) => {
    if (n > 0) { const f = new Date(y, m, 1), off = (dow - f.getDay() + 7) % 7; return new Date(y, m, 1 + off + (n - 1) * 7); }
    const l = new Date(y, m + 1, 0), off = (l.getDay() - dow + 7) % 7; return new Date(y, m + 1, 0 - off);
  };
  /* Easter Sunday (Gregorian, the Meeus/Jones/Butcher method) */
  const easter = y => {
    const a = y % 19, b = Math.floor(y / 100), c = y % 100, d = Math.floor(b / 4), e = b % 4, f = Math.floor((b + 8) / 25), g = Math.floor((b - f + 1) / 3), h = (19 * a + b - d - g + 15) % 30,
      i = Math.floor(c / 4), k = c % 4, l = (32 + 2 * e + 2 * i - h - k) % 7, m = Math.floor((a + 11 * h + 22 * l) / 451), mo = Math.floor((h + l - 7 * m + 114) / 31), da = ((h + l - 7 * m + 114) % 31) + 1;
    return new Date(y, mo - 1, da);
  };
  /* rules that move: [name, function(year) -> Date, note] */
  const RULES = [
    ['Martin Luther King Jr. Day (US)', y => nth(y, 0, 1, 3), 'Third Monday of January'],
    ['Presidents\' Day (US)', y => nth(y, 1, 1, 3), 'Third Monday of February'],
    ['Daylight saving time starts (US)', y => nth(y, 2, 0, 2), 'Clocks go forward an hour, second Sunday of March'],
    ['Mother\'s Day (US)', y => nth(y, 4, 0, 2), 'Second Sunday of May'],
    ['Memorial Day (US)', y => nth(y, 4, 1, -1), 'Last Monday of May'],
    ['Father\'s Day (US)', y => nth(y, 5, 0, 3), 'Third Sunday of June'],
    ['Labor Day (US)', y => nth(y, 8, 1, 1), 'First Monday of September'],
    ['Columbus Day / Indigenous Peoples\' Day (US)', y => nth(y, 9, 1, 2), 'Second Monday of October'],
    ['Daylight saving time ends (US)', y => nth(y, 10, 0, 1), 'Clocks go back an hour, first Sunday of November'],
    ['Election Day (US)', y => { if (y % 2) return null; const m = nth(y, 10, 1, 1); return addD(m, 1); }, 'Tuesday after the first Monday of November, in even years'],
    ['Thanksgiving (US)', y => nth(y, 10, 4, 4), 'Fourth Thursday of November'],
    ['Black Friday', y => addD(nth(y, 10, 4, 4), 1), 'The day after Thanksgiving'],
    ['Easter Sunday', y => easter(y), 'Date of Easter in the Western churches', /Easter/i],
    ['Mardi Gras / Shrove Tuesday', y => addD(easter(y), -47), 'The day before Ash Wednesday'],
    ['Easter Monday', y => addD(easter(y), 1), 'A public holiday in many countries'],
    ['Leap Day', y => (new Date(y, 1, 29).getMonth() === 1 ? new Date(y, 1, 29) : null), 'February 29']
  ];
  /* Diwali has no built-in calendar, so the next few years are written out */
  const DIWALI = { 2025: [9, 20], 2026: [10, 8], 2027: [9, 29], 2028: [9, 17], 2029: [10, 5], 2030: [9, 26], 2031: [10, 14], 2032: [10, 2] };
  /* the browser's Chinese calendar is a day out in a few years, so Lunar New Year is written out for 2024-2035 */
  const LNY = { 2024: [1, 10], 2025: [0, 29], 2026: [1, 17], 2027: [1, 6], 2028: [0, 26], 2029: [1, 13], 2030: [1, 3], 2031: [0, 23], 2032: [1, 11], 2033: [0, 31], 2034: [1, 19], 2035: [1, 8] };
  /* Hebrew, Islamic and Chinese dates come from the browser's own calendars */
  const mk = cal => { try { return new Intl.DateTimeFormat('en-u-ca-' + cal, { month: 'long', day: 'numeric', year: 'numeric', timeZone: 'UTC' }); } catch (e) { return null; } };
  const FH = mk('hebrew'), FI = mk('islamic-umalqura'), FC = mk('chinese');
  /* asked at noon UTC so the answer is the civil date shown on the calendar, whatever the PC's time zone */
  const parts = (f, d) => { try { const o = {}; f.formatToParts(new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate(), 12))).forEach(p => { o[p.type] = p.value; }); return { m: String(o.month || '').toLowerCase(), d: +o.day }; } catch (e) { return null; } };
  const LUNI = [
    // calendar, formatter, month-name test, day, name, note
    ['h', FH, /^tishri$|^tishrei$/, 1, 'Rosh Hashanah', 'Jewish New Year, begins at sundown the evening before'],
    ['h', FH, /^tishri$|^tishrei$/, 10, 'Yom Kippur', 'Day of Atonement, begins at sundown the evening before'],
    ['h', FH, /^kislev$/, 25, 'Hanukkah begins', 'Eight days, the first candle is lit the evening before'],
    ['h', FH, /^nisan$/, 15, 'Passover begins', 'Begins at sundown the evening before'],
    ['i', FI, /^ramadan$/, 1, 'Ramadan begins', 'Moon-sighting can move this by a day'],
    ['i', FI, /^shaww[aā]l$/, 1, 'Eid al-Fitr', 'End of Ramadan, moon-sighting can move this by a day'],
    ['i', FI, /^dhu.l-hijjah$|^dhu al-hijjah$|^dhuʻl-hijjah$|^dhu'l-hijjah$/, 10, 'Eid al-Adha', 'Moon-sighting can move this by a day'],
    ['i', FI, /^muharram$/, 1, 'Islamic New Year', 'Moon-sighting can move this by a day'],
    ['c', FC, /^(1|01|zhengyue|first month)$/, 1, 'Lunar New Year', 'Chinese New Year']
  ];
  const cache = {};
  function on(d) {
    d = sod(d); const y = d.getFullYear(), k = y * 10000 + (d.getMonth() + 1) * 100 + d.getDate(); if (cache[k]) return cache[k];
    const out = [];
    FIX.forEach(f => { if (f[0] === d.getMonth() + 1 && f[1] === d.getDate()) out.push({ n: f[2], note: f[3] || '', dup: f[4] || null }); });
    RULES.forEach(r => { const t = r[1](y); if (t && t.getMonth() === d.getMonth() && t.getDate() === d.getDate()) out.push({ n: r[0], note: r[2] || '', dup: r[3] || null }); });
    const dv = DIWALI[y]; if (dv && dv[0] === d.getMonth() && dv[1] === d.getDate()) out.push({ n: 'Diwali', note: 'Festival of lights, the main day' });
    const lny = LNY[y]; if (lny && lny[0] === d.getMonth() && lny[1] === d.getDate()) out.push({ n: 'Lunar New Year', note: 'Chinese New Year' });
    const cp = { h: null, i: null, c: null };
    LUNI.forEach(l => { if (!l[1] || (l[0] === 'c' && LNY[y])) return; const p = cp[l[0]] || (cp[l[0]] = parts(l[1], d)); if (p && p.d === l[3] && l[2].test(p.m)) out.push({ n: l[4], note: l[5] }); });
    cache[k] = out; return out;
  }
  window.HOLIDAYS = { on, easter, nth };
})();

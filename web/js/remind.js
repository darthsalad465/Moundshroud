// Turns plain English into reminders and timers: "remind me to call mum tomorrow at 9am", "timer 25 min".
(() => {
  const WD = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
  const UNIT = { sec: 1e3, second: 1e3, min: 6e4, minute: 6e4, hour: 36e5, hr: 36e5, day: 864e5, week: 6048e5 };
  const num = s => /^an?$/.test(s) ? 1 : /half/.test(s) ? 0.5 : parseFloat(s);
  const cap = s => s.charAt(0).toUpperCase() + s.slice(1);
  const DOWI = { sun: 0, mon: 1, tue: 2, wed: 3, thu: 4, fri: 5, sat: 6 }, NUMW = { other: 2, second: 2, two: 2, three: 3, four: 4, five: 5, six: 6 };
  const ORD = n => n + (n % 10 === 1 && n !== 11 ? 'st' : n % 10 === 2 && n !== 12 ? 'nd' : n % 10 === 3 && n !== 13 ? 'rd' : 'th');
  /* repeating reminders: "every day at 8am", "every Monday and Thursday", "weekdays at 7:30", "every 2 weeks", "monthly on the 15th", "every 3 hours", "yearly" */
  function recurOf(low, now) {
    let m, ru = null, used = [];
    const dayList = s => [...new Set((s.match(/\b(sun|mon|tue|wed|thu|fri|sat)[a-z]*/g) || []).map(x => DOWI[x.slice(0, 3)]))].sort();
    if (m = low.match(/\bevery\s+(\d+|other|second|two|three|four|five|six)\s*(hour|hr|day|week|month)s?\b/)) { const n = NUMW[m[1]] || +m[1] || 1, u = m[2]; ru = u === 'hour' || u === 'hr' ? { type: 'hours', every: n } : u === 'day' ? { type: 'daily', every: n } : u === 'week' ? { type: 'weekly', every: n, days: [] } : { type: 'monthly', every: n }; used.push(m[0]); }
    else if (m = low.match(/\b(hourly|every hour)\b/)) { ru = { type: 'hours', every: 1 }; used.push(m[0]); }
    else if (m = low.match(/\bevery other (day|week|month)\b/)) { ru = { type: m[1] === 'day' ? 'daily' : m[1] === 'week' ? 'weekly' : 'monthly', every: 2, days: [] }; used.push(m[0]); }
    else if (m = low.match(/\b(?:every |on |each )?weekdays?\b|\bmonday (?:to|through|-) friday\b/)) { ru = { type: 'weekly', every: 1, days: [1, 2, 3, 4, 5] }; used.push(m[0]); }
    else if (m = low.match(/\b(?:every |on |each )?weekends?\b/)) { ru = { type: 'weekly', every: 1, days: [0, 6] }; used.push(m[0]); }
    else if (m = low.match(/\b(?:every|each)\s+((?:(?:sun|mon|tues?|wed(?:nes)?|thu(?:rs?)?|fri|sat(?:ur)?)(?:day)?s?\b\s*(?:,|and|&)?\s*)+)/)) { const dl = dayList(m[1]); if (dl.length) { ru = { type: 'weekly', every: 1, days: dl }; used.push(m[0].replace(/[\s,]+$/, '')); } }
    else if (m = low.match(/\b(?:every day|everyday|each day|daily)\b/)) { ru = { type: 'daily', every: 1 }; used.push(m[0]); }
    else if (m = low.match(/\bevery (morning|afternoon|evening|night)\b/)) { ru = { type: 'daily', every: 1, tod: { morning: 540, afternoon: 900, evening: 1140, night: 1260 }[m[1]] }; used.push(m[0]); }
    else if (m = low.match(/\b(?:every|each) (\d{1,2})(?:st|nd|rd|th)\b/)) { ru = { type: 'monthly', every: 1, dom: +m[1] }; used.push(m[0]); }
    else if (m = low.match(/\b(?:on the (\d{1,2})(?:st|nd|rd|th)? of )?(?:monthly|every month)\b(?:\s+on the (\d{1,2})(?:st|nd|rd|th)?)?/)) { ru = { type: 'monthly', every: 1, dom: m[1] ? +m[1] : m[2] ? +m[2] : now.getDate() }; used.push(m[0]); }
    else if (m = low.match(/\b(?:weekly|every week)\b/)) { ru = { type: 'weekly', every: 1, days: [] }; used.push(m[0]); }
    else if (m = low.match(/\b(?:yearly|annually|every year)\b/)) { ru = { type: 'yearly', every: 1, month: now.getMonth(), dom: now.getDate() }; used.push(m[0]); }
    if (!ru) return null;
    const tm = low.match(/\b(?:at\s+)?(\d{1,2})(?::(\d{2}))?\s*(am|pm)\b/) || low.match(/\bat\s+(\d{1,2})(?::(\d{2}))?\b/) || low.match(/\b(\d{1,2}):(\d{2})\b/);
    if (tm && ru.type !== 'hours') { let hh = +tm[1]; const mm = +(tm[2] || 0), ap = (tm[3] || '').toLowerCase(); if (ap === 'pm' && hh < 12) hh += 12; if (ap === 'am' && hh === 12) hh = 0; ru.tod = hh * 60 + mm; used.push(tm[0]); }
    else if (ru.tod == null && ru.type !== 'hours') { const w = low.match(/\b(?:in the |every )?(morning|afternoon|evening|night)\b/); ru.tod = w ? { morning: 540, afternoon: 900, evening: 1140, night: 1260 }[w[1]] : 540; if (w) used.push(w[0]); }
    if (ru.type === 'weekly' && !ru.days.length) { const dm = low.match(/\b(?:on\s+)?(?:sun|mon|tue|wed|thu|fri|sat)[a-z]*\b/); if (dm) used.push(dm[0]); const dl = dayList(low); ru.days = dl.length ? dl : [now.getDay()]; }
    return { rule: ru, used };
  }
  const DN = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'], clock = tod => { const h = Math.floor(tod / 60), m = tod % 60; return (h % 12 || 12) + ':' + String(m).padStart(2, '0') + ' ' + (h < 12 ? 'AM' : 'PM'); };
  function describe(ru) {
    if (!ru) return ''; const ev = ru.every || 1, at = ru.tod != null && ru.type !== 'hours' ? ' at ' + clock(ru.tod) : '';
    if (ru.type === 'hours') return ev === 1 ? 'every hour' : 'every ' + ev + ' hours';
    if (ru.type === 'daily') return (ev === 1 ? 'every day' : ev === 2 ? 'every other day' : 'every ' + ev + ' days') + at;
    if (ru.type === 'weekly') { const d = ru.days || []; const nm = d.length === 5 && d.join() === '1,2,3,4,5' ? 'weekday' : d.length === 2 && d.join() === '0,6' ? 'weekend' : d.map(x => DN[x]).join(', '); return (ev === 1 ? 'every ' : 'every ' + (ev === 2 ? 'other week on ' : ev + ' weeks on ')) + nm + at; }
    if (ru.type === 'monthly') return (ev === 1 ? 'every month' : 'every ' + ev + ' months') + (ru.dom ? ' on the ' + ORD(ru.dom) : '') + at;
    if (ru.type === 'yearly') return 'every year' + (ru.month != null && ru.dom ? ' on ' + ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'][ru.month] + ' ' + ru.dom : '') + at;
    return '';
  }
  const tidy = (t, used) => { let what = t; for (const u of used) { const i = what.toLowerCase().indexOf(u); if (i >= 0) what = what.slice(0, i) + ' ' + what.slice(i + u.length); } return what.replace(/\b(please|remind me|set (a|an) reminder|reminder)\b/gi, ' ').replace(/^\s*(to|about|that)\s+/i, '').replace(/\s+(to|about|that)\s*$/i, '').replace(/\s+/g, ' ').replace(/^[\s,:-]+|[\s,:-]+$/g, ''); };
  A.remind = {
    describe,
    when(at) { const d = new Date(at), n = new Date(); const same = d.toDateString() === n.toDateString(); const tm = d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }); if (same) return 'today at ' + tm; const tom = new Date(n.getTime() + 864e5); if (d.toDateString() === tom.toDateString()) return 'tomorrow at ' + tm; return d.toLocaleDateString([], { weekday: 'long', month: 'short', day: 'numeric' }) + ' at ' + tm; },
    isRequest(text) { return /^\s*(please\s+)?(remind me\b|set (a |an )?(reminder|timer|alarm)\b|timer\b|alarm\b|\d+(\.\d+)?\s*(sec|second|min|minute|hour|hr)s?\s+timer\b)/i.test(text); },
    parse(text, now = new Date()) {
      let t = ' ' + text.trim().replace(/[.!]+$/, '') + ' ', low = t.toLowerCase(), m;
      /* timers */
      if ((m = low.match(/\b(?:timer|alarm)\b(?:\s+for)?\s+(\d+(?:\.\d+)?|an?|half an?)\s*(second|sec|minute|min|hour|hr)s?\b/)) || (m = low.match(/\b(\d+(?:\.\d+)?|an?)\s*(second|sec|minute|min|hour|hr)s?\s+(?:timer|alarm)\b/))) {
        const ms = num(m[1]) * UNIT[m[2]]; if (!(ms > 0)) return null; return { at: now.getTime() + ms, text: 'Timer finished (' + m[1] + ' ' + m[2] + (num(m[1]) === 1 ? '' : 's') + ')' };
      }
      if (!/\bremind/.test(low) && !/\breminder\b/.test(low)) return null;
      { const rr = recurOf(low, now); if (rr) return { at: 0, text: cap(tidy(t, rr.used) || 'Reminder'), rule: rr.rule }; }
      let at = null, used = [];
      /* relative: in 20 minutes */
      if (m = low.match(/\bin\s+(\d+(?:\.\d+)?|an?|half an?)\s*(second|sec|minute|min|hour|hr|day|week)s?\b/)) { at = now.getTime() + num(m[1]) * UNIT[m[2]]; used.push(m[0]); }
      else {
        let base = new Date(now); base.setSeconds(0, 0); let dayWord = null, hh = null, mm = 0;
        let d;
        if (d = low.match(/\b(?:on\s+)?(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\.?\s+(\d{1,2})(?:st|nd|rd|th)?(?:,?\s+(\d{4}))?\b/)) {
          const mo = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'].indexOf(d[1]), dy = +d[2]; if (dy < 1 || dy > 31) return null;
          base.setFullYear(d[3] ? +d[3] : base.getFullYear(), mo, dy); if (base.getMonth() !== mo) return null; dayWord = 'date'; used.push(d[0]);
          if (!d[3] && base.getTime() + 864e5 <= now.getTime()) base.setFullYear(base.getFullYear() + 1);
        }
        else if (d = low.match(/\btomorrow\b/)) { base.setDate(base.getDate() + 1); dayWord = 'tomorrow'; used.push(d[0]); }
        else if (d = low.match(/\btonight\b/)) { dayWord = 'tonight'; hh = 20; used.push(d[0]); }
        else if (d = low.match(/\b(?:on\s+|next\s+|this\s+)?(sunday|monday|tuesday|wednesday|thursday|friday|saturday)\b/)) {
          const want = WD.indexOf(d[1]); let add = (want - base.getDay() + 7) % 7; if (add === 0 || /next/.test(d[0])) add = add === 0 ? 7 : add; base.setDate(base.getDate() + add); dayWord = d[1]; used.push(d[0]);
        } else if (d = low.match(/\btoday\b/)) { dayWord = 'today'; used.push(d[0]); }
        let tm = low.match(/\b(?:at\s+)?(\d{1,2})(?::(\d{2}))?\s*(am|pm)\b/) || low.match(/\bat\s+(\d{1,2})(?::(\d{2}))?\b/) || low.match(/\b(\d{1,2}):(\d{2})\b/);
        if (tm) { hh = +tm[1]; mm = +(tm[2] || 0); const ap = (tm[3] || '').toLowerCase(); if (ap === 'pm' && hh < 12) hh += 12; if (ap === 'am' && hh === 12) hh = 0; if (hh > 23 || mm > 59 || (ap && +tm[1] > 12)) return null; used.push(tm[0]); }
        else if (d = low.match(/\b(?:at\s+)?(noon|midday|midnight)\b/)) { hh = d[1] === 'midnight' ? 0 : 12; used.push(d[0]); if (d[1] === 'midnight' && !dayWord) { base.setDate(base.getDate() + 1); dayWord = 'midnight'; } }
        else if (d = low.match(/\bin the (morning|afternoon|evening)\b/)) { hh = { morning: 9, afternoon: 15, evening: 19 }[d[1]]; used.push(d[0]); }
        if (hh === null && !dayWord) return null;
        if (hh === null) hh = 9;
        base.setHours(hh, mm, 0, 0);
        if (base.getTime() <= now.getTime() && !dayWord) base.setDate(base.getDate() + 1);
        else if (base.getTime() <= now.getTime() && (dayWord === 'today' || dayWord === 'date')) return null;
        at = base.getTime();
      }
      let what = t; for (const u of used) { const i = what.toLowerCase().indexOf(u); if (i >= 0) what = what.slice(0, i) + ' ' + what.slice(i + u.length); }
      what = what.replace(/\b(please|remind me|set (a|an) reminder|reminder)\b/gi, ' ').replace(/^\s*(to|about|that)\s+/i, '').replace(/\s+(to|about|that)\s*$/i, '').replace(/\s+/g, ' ').replace(/^[\s,:-]+|[\s,:-]+$/g, '');
      if (!what) what = 'Reminder';
      return { at, text: cap(what) };
    }
  };
})();

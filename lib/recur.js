// Recurring reminders: expands a repeat rule (daily, weekdays, weekly on chosen days, every N days/weeks/hours, monthly, yearly) into concrete times.
// A reminder is { start (first time, ms), rule, until?, skipAt?: [ms] }. The rule: { type, every, days[], dom, month, tod } with tod = minutes after midnight.
const DAY = 864e5;
const num = d => Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()) / DAY;      // whole-day number of a local date
const week = d => Math.floor((num(d) + 3) / 7);                                   // Monday-based week number
const month = d => d.getFullYear() * 12 + d.getMonth();
function matches(ru, day, st) {
  const ev = Math.max(1, ru.every | 0 || 1);
  switch (ru.type) {
    case 'daily': return (num(day) - num(st)) % ev === 0;
    case 'weekly': return (ru.days && ru.days.length ? ru.days : [st.getDay()]).includes(day.getDay()) && (week(day) - week(st)) % ev === 0;
    case 'monthly': { const dim = new Date(day.getFullYear(), day.getMonth() + 1, 0).getDate(); return day.getDate() === Math.min(ru.dom || st.getDate(), dim) && (month(day) - month(st)) % ev === 0; }
    case 'yearly': return day.getMonth() === (ru.month != null ? ru.month : st.getMonth()) && day.getDate() === (ru.dom || st.getDate()) && (day.getFullYear() - st.getFullYear()) % ev === 0;
  }
  return false;
}
function occ(r, from, to, cap) {
  const ru = r.rule, out = [], st = new Date(r.start), skip = new Set(r.skipAt || []); cap = cap || 60; if (!ru) return out;
  const ok = t => !skip.has(t) && (!r.until || t <= r.until);
  if (ru.type === 'hours') {
    const step = Math.max(1, ru.every || 1) * 36e5; let t = r.start; if (t < from) t += Math.ceil((from - t) / step) * step;
    for (; t <= to && out.length < cap; t += step) if (ok(t)) out.push(t); return out;
  }
  const tod = ru.tod != null ? ru.tod : st.getHours() * 60 + st.getMinutes(), h = Math.floor(tod / 60), m = tod % 60;
  const first = new Date(Math.max(from, r.start)); first.setHours(0, 0, 0, 0);
  for (let i = 0; i < 800 && out.length < cap; i++) {
    const day = new Date(first.getFullYear(), first.getMonth(), first.getDate() + i, h, m, 0, 0), t = day.getTime();
    if (t > to) break; if (t < from || t < r.start - 6e4) continue; if (r.until && t > r.until) break;
    if (matches(ru, day, st) && ok(t)) out.push(t);
  }
  return out;
}
const next = (r, now) => occ(r, now || Date.now(), (now || Date.now()) + 800 * DAY, 1)[0] || 0;
function untilFor(r, count) { const o = occ(Object.assign({}, r, { until: 0 }), r.start - 6e4, r.start + 3650 * DAY, Math.max(1, Math.min(count | 0, 500))); return o.length ? o[o.length - 1] + 1000 : 0; }
module.exports = { occ, next, untilFor };

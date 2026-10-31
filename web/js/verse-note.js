// Daily verse notification. Builds the next weeks of daily verses (the same pick as the Today widget and Spiritual > Today, in your chosen translation)
// and hands them to the server, which writes them where the tray listener reads reminders. So the verse arrives as a Windows notification at the chosen
// time (8:00 AM by default) even when Moundshroud is closed. Moundshroud tops the schedule up whenever it is open, so open it at least once every few weeks.
(() => {
  const DEF = { on: true, h: 8, m: 0 }, DAYS = 40;
  const cfg = () => { try { return Object.assign({}, DEF, JSON.parse(ls.get('verse_note', '{}'))); } catch (e) { return Object.assign({}, DEF); } };
  const pad = n => String(n).padStart(2, '0'), dayKey = d => d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());
  const timeLabel = c => new Date(2000, 0, 1, c.h, c.m).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
  let busy = null;

  async function build(c) {
    const items = [], now = Date.now();
    for (let k = 0; k < DAYS; k++) {
      const d = new Date(); d.setDate(d.getDate() + k); d.setHours(c.h, c.m, 0, 0); if (d.getTime() <= now) continue;
      const v = await A.faith.verseOfDay(d); if (v.text) items.push({ day: dayKey(d), at: d.getTime(), ref: v.ref + ' (' + v.tr + ')', text: v.text });
    }
    return items;
  }
  async function status() { try { const s = await A.api('/api/verse/status'); return s && typeof s.scheduled === 'number' ? s : null; } catch (e) { return null; } }
  /* send the schedule to the server; skipped when nothing changed since today's last sync (unless forced) */
  function sync(force) {
    if (busy) return busy.then(() => sync(force));                    // a setting changed while a sync was running: run again afterwards with the newest settings
    return busy = (async () => {
      try {
        if (!A.faith || !A.faith.verseOfDay) return null; const c = cfg(); await A.faith.getBible();
        const key = JSON.stringify([c, A.faith.tr(), dayKey(new Date())]);
        if (!force && ls.get('verse_sync', '') === key) return await status();
        const items = c.on ? await build(c) : [], r = await A.api('/api/verse/schedule', { on: c.on, h: c.h, m: c.m, tr: A.faith.tr(), items });
        if (!r || typeof r.scheduled !== 'number') return null;          // an older server that does not know this yet: needs one restart of Moundshroud
        ls.set('verse_sync', key); return r;
      } catch (e) { return null; } finally { busy = null; }
    })();
  }
  function save(patch) { const c = Object.assign(cfg(), patch); c.h = Math.max(0, Math.min(23, c.h | 0)); c.m = Math.max(0, Math.min(59, c.m | 0)); ls.set('verse_note', JSON.stringify(c)); return sync(true); }
  async function test() {
    if (!A.faith) return false; const v = await A.faith.verseOfDay(new Date());
    try { const r = await A.api('/api/verse/test', { ref: v.ref + ' (' + v.tr + ')', text: v.text }); return !!(r && r.ok); } catch (e) { return false; }
  }
  A.verseNote = { cfg, save, sync, status, test, timeLabel };
  setTimeout(() => sync(false), 6000); setInterval(() => sync(false), 3600e3);
})();

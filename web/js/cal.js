// Calendar: your events and reminders together with feasts, moon phases, equinoxes and solstices, and study cards due, in month, week and day views.
// Events live on this PC (ls cal_ev). "Notify me" also creates a normal reminder, so Windows notifies you even when Moundshroud is closed.
(() => {
  const root = document.getElementById('p-cal'); if (!root) return;
  const esc2 = s => String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c])), DAY = 864e5, pad = n => String(n).padStart(2, '0');
  const rd = (k, d) => { try { return JSON.parse(ls.get(k, JSON.stringify(d))); } catch (e) { return d; } }, wr = (k, v) => ls.set(k, JSON.stringify(v));
  const dkey = d => d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()), parseKey = k => { const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(k); return m ? new Date(+m[1], +m[2] - 1, +m[3]) : new Date(); };
  const sod = d => new Date(d.getFullYear(), d.getMonth(), d.getDate()), addD = (d, n) => new Date(d.getFullYear(), d.getMonth(), d.getDate() + n);
  const COLORS = ['#8b7cff', '#46d7c8', '#ff8a5c', '#f2c94c', '#ff6b81', '#5ee6a8', '#7aa2ff'], WD = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const MOONI = { 0: '🌑', 90: '🌓', 180: '🌕', 270: '🌗' }, MOONN = { 0: 'New moon', 90: 'First quarter', 180: 'Full moon', 270: 'Last quarter' };
  let ev = rd('cal_ev', []), lay = Object.assign({ rem: 1, hol: 1, feast: 1, moon: 1, cards: 1, sky: 1 }, rd('cal_lay', {})), st = Object.assign({ mode: 'month', sel: dkey(new Date()), at: dkey(new Date()) }, {});
  let rems = [], cardsDue = [], extra = {}, mounted = false;
  const save = () => wr('cal_ev', ev);

  /* ---------- what happens on a day ---------- */
  const occurs = (e, d) => {                                       // does event e fall on date d (a Date at midnight)?
    const s = parseKey(e.d), k = dkey(d); if (k === e.d) return true; if (d < s || e.rep === 'none' || !e.rep) return false; if (e.until && k > e.until) return false;
    if (e.rep === 'daily') return true; if (e.rep === 'weekly') return d.getDay() === s.getDay() && Math.round((d - s) / DAY) % 7 === 0;
    if (e.rep === 'monthly') return d.getDate() === s.getDate(); if (e.rep === 'yearly') return d.getDate() === s.getDate() && d.getMonth() === s.getMonth(); return false;
  };
  const itemsOn = d => {
    const k = dkey(d), out = [];
    ev.forEach(e => { if (occurs(e, d)) out.push({ kind: 'ev', t: e.t, time: e.time || '', color: e.color || COLORS[0], e, sort: e.time || '00:00' }); });
    if (lay.rem) rems.forEach(r => { const when = new Date(r.at); if (dkey(when) === k && !(r.cal)) out.push({ kind: 'rem', t: r.text, time: pad(when.getHours()) + ':' + pad(when.getMinutes()), color: '#ffb84d', sort: pad(when.getHours()) + ':' + pad(when.getMinutes()) }); });
    if (lay.feast && window.FAITH) { try { window.FAITH.today(d).filter(x => (x.r === 'S' || x.r === 'F' || x.r === 'M') && x.n !== 'Sunday').forEach(x => out.push({ kind: 'feast', t: x.n, time: '', color: '#b78cff', note: x.note, sort: '00:00' })); } catch (e) { } }
    if (lay.hol && window.HOLIDAYS) { try { window.HOLIDAYS.on(d).forEach(h => { if (h.dup && lay.feast && out.some(o => o.kind === 'feast' && h.dup.test(o.t))) return; out.push({ kind: 'hol', t: h.n, time: '', color: '#ff8a5c', note: h.note, sort: '00:00' }); }); } catch (e) { } }
    if (lay.moon && extra.moon) (extra.moon[k] || []).forEach(m => out.push({ kind: 'moon', t: MOONI[m.tg] + ' ' + MOONN[m.tg], time: pad(new Date(m.at).getHours()) + ':' + pad(new Date(m.at).getMinutes()), color: '#9aa3ba', sort: pad(new Date(m.at).getHours()) + ':' + pad(new Date(m.at).getMinutes()), moon: 1 }));
    if (lay.sky && extra.sea && extra.sea[k]) out.push({ kind: 'sky', t: '🌍 ' + extra.sea[k], time: '', color: '#46d7c8', sort: '00:00' });
    if (lay.cards && extra.cards && extra.cards[k]) out.push({ kind: 'cards', t: '🃏 ' + extra.cards[k] + ' study card' + (extra.cards[k] === 1 ? '' : 's') + ' due', time: '', color: '#5ee6a8', sort: '00:01' });
    return out.sort((a, b) => a.sort.localeCompare(b.sort));
  };
  async function load(from, to) {                                  // moon phases, equinoxes, reminders, cards for the visible range
    extra = { moon: {}, sea: {}, cards: {} }; const S = window.SkyCore;
    if (S) {
      try { for (const tg of [0, 90, 180, 270]) { let t = from.getTime() - 3 * DAY; for (let n = 0; n < 12; n++) { const nx = S.nextPhase(t, tg); if (!nx || nx > to.getTime() + DAY) break; if (nx >= from.getTime() - DAY) { const k = dkey(new Date(nx)); (extra.moon[k] = extra.moon[k] || []).push({ at: nx, tg }); } t = nx + DAY; } } } catch (e) { }
      try { for (let d = new Date(from); d <= to; d = addD(d, 1)) { const a = S.sun(d.getTime() + 12 * 36e5).lam, b = S.sun(d.getTime() + 36 * 36e5).lam; [[0, 'March equinox'], [90, 'June solstice'], [180, 'September equinox'], [270, 'December solstice']].forEach(([deg, nm]) => { if (((a < deg + 0.0001 && b >= deg) || (deg === 0 && a > 350 && b < 10))) extra.sea[dkey(addD(d, 1))] = nm; }); } } catch (e) { }
    }
    try { const r = await A.api('/api/reminders'); rems = (Array.isArray(r) ? r : (r && r.items) || []).flatMap(x => x.rule ? (x.nextList || []).map(at => ({ text: x.text, at })) : [x]).filter(x => x && x.at); } catch (e) { rems = []; }
    try { const c = await A.api('/api/cards'); const today = dkey(new Date()); (Array.isArray(c) ? c : []).forEach(x => { const dd = new Date(x.due || 0); let k = dkey(dd); if (dd.getTime() < Date.now()) k = today; extra.cards[k] = (extra.cards[k] || 0) + 1; }); } catch (e) { }
  }

  /* ---------- drawing ---------- */
  const css = '.cl-wrap{max-width:1180px;margin:0 auto}.cl-bar{display:flex;gap:8px;flex-wrap:wrap;align-items:center;margin-bottom:10px}.cl-grid{display:grid;grid-template-columns:repeat(7,minmax(0,1fr));gap:4px}.cl-h{font-size:12px;color:var(--mute);text-align:center;padding:4px 0}.cl-c{min-height:92px;background:var(--panel);border:1px solid var(--line);border-radius:10px;padding:4px 5px;cursor:pointer;overflow:hidden;position:relative}.cl-c:hover{border-color:var(--acc)}.cl-c.out{opacity:.5}.cl-c.sel{outline:2px solid var(--acc)}.cl-n{font-size:12px;font-weight:600;display:inline-block;min-width:20px;text-align:center;border-radius:99px;padding:1px 4px}.cl-c.today .cl-n{background:var(--acc);color:#fff}.cl-i{font-size:11px;line-height:1.35;border-radius:5px;padding:0 4px;margin-top:2px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;border-left:3px solid var(--c);background:color-mix(in srgb,var(--c) 14%,transparent)}.cl-w{min-height:300px}.cl-row{display:flex;gap:10px;padding:7px 0;border-bottom:1px dashed var(--line);align-items:baseline}.cl-dot{width:10px;height:10px;border-radius:50%;flex:none;margin-top:3px}';
  if (!document.getElementById('clcss')) { const s = document.createElement('style'); s.id = 'clcss'; s.textContent = css; document.head.appendChild(s); }
  const monthLabel = d => d.toLocaleDateString([], { month: 'long', year: 'numeric' });
  const range = () => {
    const a = parseKey(st.at); if (st.mode === 'month') { const f = new Date(a.getFullYear(), a.getMonth(), 1), s = addD(f, -f.getDay()); return [s, addD(s, 41)]; }
    if (st.mode === 'week') { const s = addD(a, -a.getDay()); return [s, addD(s, 6)]; } return [a, a];
  };
  const chip = it => '<div class="cl-i" style="--c:' + it.color + '" title="' + esc2(it.t + (it.time ? ' ' + it.time : '')) + '">' + (it.time && it.kind !== 'moon' ? '<b>' + it.time + '</b> ' : '') + esc2(it.t) + '</div>';
  function cell(d, month) {
    const k = dkey(d), its = itemsOn(d), max = st.mode === 'week' ? 12 : 3, today = k === dkey(new Date());
    return '<div class="cl-c' + (d.getMonth() !== month && st.mode === 'month' ? ' out' : '') + (k === st.sel ? ' sel' : '') + (today ? ' today' : '') + '" data-d="' + k + '"><span class="cl-n">' + d.getDate() + '</span>' + its.slice(0, max).map(chip).join('') + (its.length > max ? '<div class="small mute" style="font-size:11px">+' + (its.length - max) + ' more</div>' : '') + '</div>';
  }
  function dayPanel() {
    const d = parseKey(st.sel), its = itemsOn(d), S = window.SkyCore, loc = A.sky && A.sky.loc();
    let sun = ''; if (S && loc) { try { const d0 = sod(d).getTime(), rs = S.riseSet(ms => S.hor(S.sun(ms), ms, loc.lat, loc.lon).alt, d0, -0.833), mo = S.moon(d0 + 12 * 36e5), f = ms => new Date(ms).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }); sun = '<div class="small mute" style="margin:2px 0 8px">☀️ ' + (rs.rise ? 'rises ' + f(rs.rise) : '') + (rs.set ? ', sets ' + f(rs.set) : '') + ' · 🌙 ' + S.phaseName(mo.elong) + ' (' + Math.round(mo.ill * 100) + '% lit)</div>'; } catch (e) { } }
    return '<div class="td-card" style="background:var(--panel);border:1px solid var(--line);border-radius:14px;padding:14px 16px;margin-top:12px"><div class="row" style="gap:8px;flex-wrap:wrap"><b style="font-size:17px">' + esc2(d.toLocaleDateString([], { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })) + '</b><span class="sp" style="flex:1"></span><button class="pri" data-a="add">+ Add event</button></div>' + sun +
      (its.length ? its.map((it, i) => '<div class="cl-row"><span class="cl-dot" style="background:' + it.color + '"></span><span class="small mute" style="width:48px">' + (it.time || 'all day') + '</span><div style="flex:1"><div>' + esc2(it.t) + '</div>' + (it.e && it.e.note ? '<div class="small mute">' + esc2(it.e.note) + '</div>' : '') + (it.note ? '<div class="small mute">' + esc2(it.note) + '</div>' : '') + (it.e && it.e.rep && it.e.rep !== 'none' ? '<div class="small mute">repeats ' + it.e.rep + '</div>' : '') + '</div>' + (it.e ? '<button class="ib" data-a="edit" data-id="' + it.e.id + '">Edit</button>' : '') + '</div>').join('') : '<div class="mute small" style="padding:8px 0">Nothing on this day. Press <b>+ Add event</b>.</div>') +
      '<div style="margin-top:10px" id="cl-verse"></div></div>';
  }
  async function draw() {
    const a = parseKey(st.at), [from, to] = range(); await load(from, to);
    const title = st.mode === 'month' ? monthLabel(a) : st.mode === 'week' ? from.toLocaleDateString([], { month: 'short', day: 'numeric' }) + ' - ' + to.toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' }) : a.toLocaleDateString([], { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });
    let grid = '';
    if (st.mode === 'day') grid = '';
    else { grid = '<div class="cl-grid">' + WD.map(w => '<div class="cl-h">' + w + '</div>').join('') + (st.mode === 'month' ? Array.from({ length: 42 }, (_, i) => cell(addD(from, i), a.getMonth())).join('') : Array.from({ length: 7 }, (_, i) => cell(addD(from, i), a.getMonth())).join('')) + '</div>'; }
    root.innerHTML = '<div class="scroll pad" style="flex:1"><div class="cl-wrap"><div class="cl-bar"><h2 style="margin:0;flex:1;min-width:200px">📅 ' + esc2(title) + '</h2><button class="ib" data-a="prev">◀</button><button class="ib" data-a="today">Today</button><button class="ib" data-a="next">▶</button>' + ['month', 'week', 'day'].map(m => '<button class="ib' + (st.mode === m ? ' on' : '') + '" data-m="' + m + '">' + m[0].toUpperCase() + m.slice(1) + '</button>').join('') + '<button class="pri" data-a="add">+ Event</button><button class="ib" data-a="ics-in" title="Import an .ics calendar file">⬆ .ics</button><button class="ib" data-a="ics-out" title="Export your events as an .ics file">⬇ .ics</button><button class="ib" data-a="ask" title="Ask Moundshroud about your calendar">🧠 Ask</button></div>' +
      '<div class="cl-bar small">' + [['rem', '⏰ Reminders'], ['hol', '🎉 Holidays'], ['feast', '✝️ Feasts'], ['moon', '🌙 Moon'], ['sky', '🌍 Seasons'], ['cards', '🃏 Study cards']].map(([k, l]) => '<label style="display:flex;gap:4px;align-items:center;cursor:pointer"><input type="checkbox" data-l="' + k + '"' + (lay[k] ? ' checked' : '') + '>' + l + '</label>').join('') + '</div>' + grid + dayPanel() + '</div></div>';
    const vb = root.querySelector('#cl-verse'); if (vb && lay.feast && A.faith && A.faith.verseOfDay) A.faith.verseOfDay(parseKey(st.sel)).then(v => { if (vb.isConnected && v.text) vb.innerHTML = '<div class="small mute">Verse of the day</div><div style="font-family:Georgia,serif;line-height:1.5">&ldquo;' + esc2(v.text) + '&rdquo; <b style="font-family:system-ui;font-size:13px">' + esc2(v.ref) + '</b></div>'; }).catch(() => { });
  }
  /* ---------- adding and editing ---------- */
  function editor(e, draft) {
    const isNew = !e; e = e || { id: Date.now().toString(36), t: '', d: st.sel, time: '', note: '', color: COLORS[0], rep: 'none', notify: 0, ...draft };
    A.dlg('<div style="display:flex;flex-direction:column;gap:10px;min-width:min(420px,86vw)"><b style="font-size:17px">' + (isNew ? 'New event' : 'Edit event') + '</b><input id="ce-t" type="text" placeholder="What is it?" value="' + esc2(e.t) + '" style="padding:8px 12px"><div class="row" style="gap:8px;flex-wrap:wrap"><input id="ce-d" type="date" value="' + e.d + '"><input id="ce-h" type="time" value="' + (e.time || '') + '"><span class="small mute">(leave the time empty for all day)</span></div>' +
      '<div class="row" style="gap:8px;flex-wrap:wrap"><label class="small">Repeats <select id="ce-r">' + [['none', 'Never'], ['daily', 'Every day'], ['weekly', 'Every week'], ['monthly', 'Every month'], ['yearly', 'Every year']].map(([v, l]) => '<option value="' + v + '"' + ((e.rep || 'none') === v ? ' selected' : '') + '>' + l + '</option>').join('') + '</select></label><label class="small">Colour ' + COLORS.map(c => '<input type="radio" name="ce-c" value="' + c + '"' + (e.color === c ? ' checked' : '') + ' style="accent-color:' + c + '">').join('') + '</label></div>' +
      '<textarea id="ce-n" rows="3" placeholder="Notes (optional)" style="padding:8px 12px">' + esc2(e.note) + '</textarea><label class="small" style="display:flex;gap:6px;align-items:center"><input type="checkbox" id="ce-nf"' + (e.rid ? ' checked' : '') + '> 🔔 Notify me (a Windows notification, even when Moundshroud is closed) <select id="ce-b"><option value="0">at the time</option><option value="10">10 min before</option><option value="60">1 hour before</option><option value="1440">1 day before</option></select></label><div class="small mute" id="ce-m"></div>' +
      '<div class="row" style="gap:8px"><button class="pri" id="ce-s">Save</button><button class="ib" id="ce-x">Cancel</button><span class="sp" style="flex:1"></span>' + (isNew ? '' : '<button class="ib" id="ce-del" style="color:var(--bad)">Delete</button>') + '</div></div>');
    const q = id => document.getElementById(id); q('ce-t').focus(); if (e.bmin != null) q('ce-b').value = String(e.bmin);
    q('ce-x').onclick = A.closeDlg;
    const dropRem = async () => { if (e.rid) { try { const all = await A.api('/api/reminders'); const r = (Array.isArray(all) ? all : []).find(x => x.id === e.rid); if (r) await A.api('/api/reminders/delete', { id: e.rid }); } catch (er) { } } };
    if (q('ce-del')) q('ce-del').onclick = async () => { if (!(await A.confirm('Delete this event?'))) return; await dropRem(); ev = ev.filter(x => x.id !== e.id); save(); A.closeDlg(); draw(); };
    q('ce-s').onclick = async () => {
      const t = q('ce-t').value.trim(); if (!t) { q('ce-m').textContent = 'Give the event a name.'; return; } if (!q('ce-d').value) { q('ce-m').textContent = 'Pick a date.'; return; }
      const n = { id: e.id, t, d: q('ce-d').value, time: q('ce-h').value, note: q('ce-n').value.trim(), color: (document.querySelector('input[name=ce-c]:checked') || {}).value || COLORS[0], rep: q('ce-r').value, rid: '', bmin: +q('ce-b').value };
      await dropRem();
      if (q('ce-nf').checked) {                                  // a normal reminder, so the tray program shows it
        const base = parseKey(n.d); if (n.time) base.setHours(+n.time.slice(0, 2), +n.time.slice(3, 5)); else base.setHours(9, 0); let at = base.getTime() - n.bmin * 60000;
        if (n.rep !== 'none') { const nx = (() => { for (let i = 0; i < 400; i++) { const dd = addD(parseKey(n.d), i), probe = Object.assign({}, n, { d: n.d }); if (occurs(probe, dd)) { const b = new Date(dd); if (n.time) b.setHours(+n.time.slice(0, 2), +n.time.slice(3, 5)); else b.setHours(9, 0); if (b.getTime() - n.bmin * 60000 > Date.now()) return b.getTime() - n.bmin * 60000; } } return 0; })(); at = nx || at; }
        if (at > Date.now()) { try { const rule = n.rep === 'none' ? undefined : n.rep === 'daily' ? { type: 'daily', every: 1 } : n.rep === 'weekly' ? { type: 'weekly', every: 1, days: [parseKey(n.d).getDay()] } : n.rep === 'monthly' ? { type: 'monthly', every: 1, dom: parseKey(n.d).getDate() } : { type: 'yearly', every: 1, month: parseKey(n.d).getMonth(), dom: parseKey(n.d).getDate() }; const list = await A.api('/api/reminders', { text: (n.time ? '' : '') + t, at, rule }); const mine = (Array.isArray(list) ? list : []).filter(x => x.text === t && !x.done).sort((a, b) => (b.created || 0) - (a.created || 0))[0]; if (mine) { n.rid = mine.id; } } catch (er) { A.toast('Saved, but the notification could not be set.'); } }
        else A.toast('That time has already passed, so no notification was set.');
      }
      const i = ev.findIndex(x => x.id === e.id); if (i >= 0) ev[i] = n; else ev.push(n); save(); st.sel = n.d; st.at = n.d; A.closeDlg(); draw();
    };
  }

  /* ---------- clicks ---------- */
  root.addEventListener('click', e => {
    const m = e.target.closest('[data-m]'); if (m) { st.mode = m.dataset.m; st.at = st.sel; draw(); return; }
    const a = e.target.closest('[data-a]'); if (a) {
      const k = a.dataset.a, d = parseKey(st.at);
      if (k === 'prev' || k === 'next') { const n = k === 'next' ? 1 : -1; st.at = dkey(st.mode === 'month' ? new Date(d.getFullYear(), d.getMonth() + n, 1) : addD(d, n * (st.mode === 'week' ? 7 : 1))); if (st.mode === 'day') st.sel = st.at; draw(); }
      else if (k === 'today') { st.at = st.sel = dkey(new Date()); draw(); }
      else if (k === 'add') editor(null); else if (k === 'edit') editor(ev.find(x => x.id === a.dataset.id));
      else if (k === 'ics-out') {
        const lines = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Moundshroud//Offline Calendar//EN'];
        ev.forEach(x => {
          const dt = x.d.replace(/-/g, '') + (x.time ? 'T' + x.time.replace(':', '') + '00' : '');
          lines.push('BEGIN:VEVENT', 'UID:' + x.id + '@moundshroud', 'SUMMARY:' + String(x.t || '').replace(/\r?\n/g, ' '), x.time ? 'DTSTART:' + dt : 'DTSTART;VALUE=DATE:' + dt);
          if (x.note) lines.push('DESCRIPTION:' + String(x.note).replace(/\r?\n/g, '\\n'));
          if (x.rep && x.rep !== 'none') lines.push('RRULE:FREQ=' + x.rep.toUpperCase());
          lines.push('END:VEVENT');
        });
        lines.push('END:VCALENDAR');
        const b = new Blob([lines.join('\r\n')], { type: 'text/calendar' }), l = document.createElement('a');
        l.href = URL.createObjectURL(b); l.download = 'moundshroud-calendar.ics'; l.click();
        setTimeout(() => URL.revokeObjectURL(l.href), 4000);
      } else if (k === 'ics-in') {
        const f = document.createElement('input'); f.type = 'file'; f.accept = '.ics,text/calendar';
        f.onchange = async () => {
          if (!f.files[0]) return;
          if (!window.ICAL) return A.toast('ICAL parser unavailable.');
          try {
            const jcal = window.ICAL.parse(await f.files[0].text());
            const comp = new window.ICAL.Component(jcal);
            let n = 0;
            for (const ve of comp.getAllSubcomponents('vevent')) {
              const e0 = new window.ICAL.Event(ve);
              const sd = e0.startDate; if (!sd) continue;
              const dStr = sd.year + '-' + pad(sd.month) + '-' + pad(sd.day);
              const tStr = sd.isDate ? '' : pad(sd.hour) + ':' + pad(sd.minute);
              const rr = ve.getFirstPropertyValue('rrule');
              const freq = rr && rr.freq ? String(rr.freq).toLowerCase() : 'none';
              const rep = ['daily', 'weekly', 'monthly', 'yearly'].includes(freq) ? freq : 'none';
              ev.push({ id: Date.now().toString(36) + Math.random().toString(36).slice(2, 6), t: e0.summary || 'Imported event', d: dStr, time: tStr, note: e0.description || '', color: COLORS[n % COLORS.length], rep });
              n++;
            }
            save(); draw(); A.toast(n ? 'Imported ' + n + ' event(s) from .ics ✓' : 'No events found in that .ics file.');
          } catch (err) { A.toast('Could not read .ics file: ' + (err.message || err), 5000); }
        };
        f.click();
      }
      else if (k === 'ask') { if (A.askAll) A.askAll.open('What is on my calendar this week?'); }
      return;
    }
    const c = e.target.closest('[data-d]'); if (c) { st.sel = c.dataset.d; if (st.mode === 'day') st.at = st.sel; else if (st.mode === 'month' && parseKey(st.sel).getMonth() !== parseKey(st.at).getMonth()) st.at = st.sel; draw(); }
  });
  root.addEventListener('change', e => { const l = e.target.dataset.l; if (l) { lay[l] = e.target.checked ? 1 : 0; wr('cal_lay', lay); draw(); } });
  A.cal = { events: () => ev.slice(), itemsOn, openAdd: () => { A.showTab('cal'); setTimeout(() => editor(null), 200); },
    draftReminder(title, date) {
      editor(null, { t: title, d: dkey(date), time: pad(date.getHours()) + ':' + pad(date.getMinutes()) });
      document.getElementById('ce-nf').checked = true;
    }, goto: k => { st.sel = st.at = k; A.showTab('cal'); } };
  A.registerTab('cal', 'Calendar', () => { if (!mounted) { mounted = true; } st.sel = st.sel || dkey(new Date()); draw(); });
})();

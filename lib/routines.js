// Agent routines: the in-app agent does a task on a schedule (every day at 8:00, on weekdays, once a week, every few hours).
// A routine runs in a second, unattended copy of the harness (lib/harness.js): every permission question is refused at once,
// so a routine can only do what needs no approval. Its conversation is kept with the other agent sessions, and a short
// result waits in the inbox (Agent tab, Today). When Moundshroud is closed the tray helper reads data\routines-next.txt and
// starts the server for the next one; the server stays up while a routine runs and then idles out as usual.
const fs = require('fs'), os = require('os'), path = require('path'), crypto = require('crypto');

const KINDS = ['daily', 'weekdays', 'weekly', 'hours'];
const MAX_RUN_MS = 30 * 60000, LATE_MS = 12 * 3600000, WAIT_MS = 2 * 3600000, KEEP_RUNS = 100;
const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const int = (v, lo, hi, d) => { v = Math.round(+v); return Number.isFinite(v) ? Math.min(hi, Math.max(lo, v)) : d; };

/* the schedule, cleaned up */
function sched(s) {
  s = s && typeof s === 'object' ? s : {};
  return { kind: KINDS.includes(s.kind) ? s.kind : 'daily', h: int(s.h, 0, 23, 8), m: int(s.m, 0, 59, 0), day: int(s.day, 0, 6, 1), every: int(s.every, 1, 24, 4) };
}
/* does a start at this hour (local time) belong to the schedule */
function fits(s, d) {
  const h = d.getHours(), wd = d.getDay();
  if (s.kind === 'hours') return h % s.every === 0;
  if (h !== s.h) return false;
  if (s.kind === 'weekdays') return wd >= 1 && wd <= 5;
  if (s.kind === 'weekly') return wd === s.day;
  return true;
}
/* the first time after t (ms) that the schedule says to run */
function nextAfter(s, t) {
  s = sched(s); const d = new Date(t); d.setMinutes(s.m, 0, 0);
  if (d.getTime() <= t) d.setHours(d.getHours() + 1);
  for (let i = 0; i < 24 * 8 + 2; i++) { if (fits(s, d)) return d.getTime(); d.setHours(d.getHours() + 1); d.setMinutes(s.m, 0, 0); }
  return t + 86400000;
}
const hm = s => String(s.h).padStart(2, '0') + ':' + String(s.m).padStart(2, '0');
function describe(s) {
  s = sched(s);
  if (s.kind === 'hours') return 'Every ' + (s.every === 1 ? 'hour' : s.every + ' hours') + ' at :' + String(s.m).padStart(2, '0');
  if (s.kind === 'weekdays') return 'Weekdays at ' + hm(s);
  if (s.kind === 'weekly') return 'Every ' + DAYS[s.day] + ' at ' + hm(s);
  return 'Every day at ' + hm(s);
}

/* ready-made routines; each only needs what the guard allows without asking (reading, searching, listing, git status/log/diff, writing in its folder) */
function suggestions() {
  const home = os.homedir(), dl = path.join(home, 'Downloads');
  return [
    { key: 'todo', icon: '📝', name: 'List the TODOs in a project', why: 'A fresh list of every TODO and FIXME, so nothing slips.', sched: { kind: 'weekdays', h: 9, m: 0 }, dir: '', guard: true,
      prompt: 'Search every code file in this folder for TODO, FIXME and HACK comments. Write the list to TODO-REPORT.md in this folder: one line per comment with the file, the line number and the text, grouped by file, newest files first. Replace the file if it exists.' },
    { key: 'changes', icon: '🔀', name: 'What changed in my project', why: 'A plain summary of yesterday\'s commits and any work not yet committed.', sched: { kind: 'daily', h: 8, m: 30 }, dir: '', guard: true,
      prompt: 'This folder is a git project. Use git log (the last day of commits) and git status and git diff --stat to see what changed. Write a short plain-English summary to CHANGES.md in this folder: what was committed, what is changed but not committed, and anything that looks unfinished.' },
    { key: 'downloads', icon: '📥', name: 'Tidy plan for Downloads', why: 'A suggested way to sort your Downloads folder. It only writes a plan; nothing is moved.', sched: { kind: 'weekly', day: 6, h: 10, m: 0 }, dir: '', guard: true,
      prompt: 'Look at the files in ' + dl + ' (list them, do not open private documents). Do not move, rename or delete anything. Write tidy-plan.md in this folder: group the files by type and age, list likely duplicates and old installers, and suggest folders to sort them into.' },
    { key: 'big', icon: '💽', name: 'Biggest files in a folder', why: 'The 15 largest files in a folder you pick, to see what is filling the disk. Nothing is deleted.', sched: { kind: 'weekly', day: 0, h: 11, m: 0 }, dir: '', guard: true,
      prompt: 'Run the command: dir -lSR --block-size=M   (in this folder; it lists every file with its size in MB, biggest first in each folder). From the output, pick the 15 largest files overall and write them to BIGGEST-FILES.md in this folder as a table: size in MB, then the path. Do not delete or move anything.' },
    { key: 'syntax', icon: '🧪', name: 'Check my scripts for mistakes', why: 'Finds JavaScript and Python files that would not even start.', sched: { kind: 'daily', h: 18, m: 0 }, dir: '', guard: true,
      prompt: 'Find the .js and .py files in this folder (skip node_modules and hidden folders). Check each JavaScript file with node --check and each Python file with python -m py_compile. Report only the files with errors and the error message, or say that all files are fine.' },
    { key: 'notes', icon: '🗒️', name: 'Weekly notes digest', why: 'A one-page summary of the notes you wrote this week.', sched: { kind: 'weekly', day: 0, h: 19, m: 0 }, dir: '', guard: true,
      prompt: 'Read the notes changed in the last 7 days in ' + path.join(home, 'Documents', 'Assistant Notes') + ' (if that folder is missing, say so and stop). Write weekly-digest.md in this folder: the main topics, open to-dos, and any dates mentioned.' },
  ];
}

function create(deps) {
  const file = path.join(deps.dataDir, 'agent-routines.json'), nextFile = path.join(deps.dataDir, 'routines-next.txt');
  let D = load(), cur = null, waitSince = {};
  function load() { try { const j = JSON.parse(fs.readFileSync(file, 'utf8')); return { routines: Array.isArray(j.routines) ? j.routines : [], runs: Array.isArray(j.runs) ? j.runs : [] }; } catch (e) { return { routines: [], runs: [] }; } }
  function save() { const t = file + '.tmp'; fs.writeFileSync(t, JSON.stringify(D, null, 1)); fs.renameSync(t, file); writeNext(); }
  const dueOf = r => nextAfter(r.sched, r.last || r.created || Date.now());
  function writeNext() {
    const on = D.routines.filter(r => r.on);
    try { if (!on.length) { try { fs.unlinkSync(nextFile); } catch (e) { } return; } fs.writeFileSync(nextFile, String(Math.min(...on.map(dueOf)))); } catch (e) { }
  }
  function clean(r, old) {
    const o = old || { id: crypto.randomUUID(), created: Date.now(), last: 0 };
    return { id: o.id, created: o.created, last: o.last || 0, name: String(r.name || '').trim().slice(0, 80) || 'Routine', prompt: String(r.prompt || '').trim().slice(0, 4000), dir: String(r.dir || '').trim().slice(0, 400),
      model: String(r.model || '').trim().slice(0, 120), guard: r.guard !== false, on: r.on !== false, sched: sched(r.sched) };
  }
  function record(r, o) {
    D.runs.unshift(Object.assign({ id: crypto.randomUUID(), rid: r.id, name: r.name, at: Date.now(), end: Date.now(), ok: false, summary: '', session: '', seen: false }, o));
    D.runs = D.runs.slice(0, KEEP_RUNS); save();
  }

  /* one run, start to finish; resolves when it has ended */
  async function run(r, why) {
    if (cur) return { ok: false, error: 'A routine is already running. Wait for it, or stop it.' };
    const t0 = Date.now(); cur = { rid: r.id, name: r.name, at: t0, h: null, session: '' };
    r.last = t0; save();
    let rr; try { rr = await deps.resolve(r); } catch (e) { rr = { ok: false, error: String(e.message || e) }; }
    if (!rr || !rr.ok) { cur = null; record(r, { at: t0, why, summary: 'Did not start: ' + ((rr && rr.error) || 'unknown problem') }); return { ok: false, error: rr && rr.error }; }
    let lastText = '', end = null, errText = '';
    const ended = new Promise(res => { end = res; });
    const h = deps.harnessLib.create(Object.assign({ save: rec => { if (cur && rec.id) cur.session = rec.id; deps.store.save(rec); }, unattended: true,
      onEvent: e => { if (e.kind === 'text') lastText = e.text; if (e.kind === 'error') errText = e.text; if (e.kind === 'done') end(e.ok ? 'done' : 'fail:' + (e.text || '')); if (e.kind === 'error' || e.kind === 'stopped') end('stopped'); } }, deps.harnessDeps || {}));
    cur.h = h;
    const s = await h.start({ check: rr.check, dir: rr.dir, tag: { id: r.id, name: r.name } });
    if (!s.ok) { cur = null; record(r, { at: t0, why, summary: 'Did not start: ' + (s.error || 'unknown problem') }); return s; }
    const when = new Date().toLocaleString();
    h.send('This is a scheduled routine called "' + r.name + '", running by itself at ' + when + '. Nobody is at the PC: no one can answer questions or approve commands, so do only what needs no approval. ' +
      'The task:\n\n' + r.prompt + '\n\nWhen you are finished, end with a short summary (at most 5 lines) of what you found or did.');
    const killer = setTimeout(() => end('timeout'), deps.maxRunMs || MAX_RUN_MS);
    const how = await ended; clearTimeout(killer);
    const sid = h.state(0).sessionId; try { h.stop(); } catch (e) { }
    const ok = how === 'done', summary = (ok ? lastText : how === 'timeout' ? 'Stopped after 30 minutes. ' + lastText : how === 'stopped' && cur && cur.cancel ? 'You stopped it.' : (String(how).replace(/^fail:/, '') || errText || 'It did not finish.') + (lastText ? ' Last thing it said: ' + lastText : ''));
    cur = null;
    record(r, { at: t0, end: Date.now(), ok, why, session: sid, summary: String(summary || '(no summary)').trim().slice(0, 1500) });
    return { ok: true };
  }

  /* every 30 s: start what is due, one at a time; skip what is too late, wait while you are using the agent yourself */
  function tick(now) {
    now = now || Date.now();
    if (cur) return;
    for (const r of D.routines) {
      if (!r.on) continue;
      const due = dueOf(r); if (due > now) continue;
      if (now - due > LATE_MS) { r.last = now; record(r, { at: now, why: 'schedule', skipped: true, summary: 'Skipped the ' + new Date(due).toLocaleString() + ' run: Moundshroud or the PC was off then.' }); continue; }
      if (deps.userBusy && deps.userBusy()) { waitSince[r.id] = waitSince[r.id] || now; if (now - waitSince[r.id] > WAIT_MS) { delete waitSince[r.id]; r.last = now; record(r, { at: now, why: 'schedule', skipped: true, summary: 'Skipped: you were using the agent for over 2 hours at the time.' }); } return; }
      delete waitSince[r.id];
      run(r, 'schedule').catch(() => { cur = null; });
      return;
    }
  }
  const timer = deps.noTimer ? null : setInterval(() => { try { tick(); } catch (e) { } }, 30000);
  if (timer && timer.unref) timer.unref();
  if (timer) setTimeout(() => { try { tick(); } catch (e) { } }, 5000);      // a server the tray helper started for a routine runs it right away
  writeNext();

  return {
    tick, run: id => { const r = D.routines.find(x => x.id === id); if (!r) return Promise.resolve({ ok: false, error: 'That routine no longer exists.' }); run(r, 'manual').catch(() => { cur = null; }); return Promise.resolve({ ok: true }); },
    busy: () => !!cur,
    stop: () => { if (!cur || !cur.h) return { ok: false, error: 'No routine is running.' }; cur.cancel = true; cur.h.stop(); return { ok: true }; },
    list: () => ({ routines: D.routines.map(r => Object.assign({}, r, { next: r.on ? dueOf(r) : 0, when: describe(r.sched) })), runs: D.runs, unread: D.runs.filter(x => !x.seen).length,
      running: cur ? { rid: cur.rid, name: cur.name, at: cur.at, session: cur.h ? cur.h.state(0).sessionId : '' } : null, suggestions: suggestions().map(s => Object.assign({ when: describe(s.sched) }, s)) }),
    live: since => !cur ? null : cur.h ? cur.h.state(since) : { running: true, preparing: true, busy: true, seq: 0, events: [] },      // still checking the model and folder
    save: r => { if (!r || !String(r.prompt || '').trim()) return { ok: false, error: 'Say what the routine should do.' }; const old = r.id && D.routines.find(x => x.id === r.id); const c = clean(r, old); if (old) D.routines[D.routines.indexOf(old)] = c; else D.routines.push(c); save(); return { ok: true, id: c.id }; },
    remove: id => { D.routines = D.routines.filter(r => r.id !== id); save(); return { ok: true }; },
    seen: ids => { D.runs.forEach(x => { if (!ids || ids.includes(x.id)) x.seen = true; }); save(); return { ok: true }; },
    shutdown: () => { clearInterval(timer); if (cur && cur.h) { cur.cancel = true; try { cur.h.stop(); } catch (e) { } } },
  };
}

module.exports = { create, nextAfter, describe, sched, suggestions, KINDS };

// Notes, prompts, flashcards, reminders, daily briefing. Everything is plain files on this PC.
const fs = require('fs'), path = require('path'), os = require('os');
const U = require('./util'), docs = require('./docs');

const ROOT = path.join(__dirname, '..'), DATA = path.join(ROOT, 'data');
fs.mkdirSync(DATA, { recursive: true });

/* ---------------- notes (markdown files you can open in any editor) ---------------- */
function documentsDir() { const h = os.homedir(); for (const d of [path.join(h, 'OneDrive', 'Documents'), path.join(h, 'Documents')]) if (fs.existsSync(d)) return d; return h; }
const NOTES = path.join(documentsDir(), 'Assistant Notes');
/* A note whose name ends in a code extension (hello.py, page.html) is saved as that file, so the Notes tab can run it. */
const CODE_EXT = /\.(py|pyw|js|mjs|cjs|ts|jsx|tsx|html?|xhtml|css|sql|sh|bash|ps1|bat|cmd|vbs|jse|c|h|cpp|cc|cxx|hpp|cs|fs|vb|rs|go|java|kt|kts|swift|php|rb|lua|pl|awk|sed|asm|hs|zig|nim|lisp|clj|erl|ex|exs|ml|r|jl|f90|pas|cob|d|cr|scala|dart|wat|bf|ook|json|yml|yaml|csv|txt)$/i;
const isCode = id => CODE_EXT.test(String(id || '').toLowerCase());
const noteFile = id => path.join(NOTES, isCode(id) ? id : id + '.md');
const slug = t => (t || 'Untitled').replace(/[\\/:*?"<>|\r\n]+/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 60) || 'Untitled';
const validNoteId = id => typeof id === 'string' && !!id.trim() && id.length <= 250 && !/[\\/:*?"<>|\u0000-\u001f]/.test(id);
function titleOf(id, text) { const m = text.match(/^\s*#\s+(.+)$/m); return (m ? m[1].trim() : id).slice(0, 100); }
function notesList() {
  fs.mkdirSync(NOTES, { recursive: true });
  return fs.readdirSync(NOTES).filter(f => /\.md$/i.test(f) || isCode(f)).map(f => {
    const code = isCode(f), id = code ? f : f.replace(/\.md$/i, ''), st = fs.statSync(path.join(NOTES, f)); let t = ''; try { t = fs.readFileSync(path.join(NOTES, f), 'utf8'); } catch (e) {}
    return { id, code, title: code ? id : titleOf(id, t), updated: Math.floor(st.mtimeMs), snippet: t.replace(/^#.*\n/, '').replace(/\s+/g, ' ').trim().slice(0, 140) };
  }).sort((a, b) => b.updated - a.updated);
}
function noteGet(id) { if (!validNoteId(id)) return null; const f = noteFile(id); if (!fs.existsSync(f)) return null; const c = fs.readFileSync(f, 'utf8'); return { id, code: isCode(id), title: isCode(id) ? id : titleOf(id, c), path: f, content: c, updated: Math.floor(fs.statSync(f).mtimeMs) }; }
function noteSave({ id, title, content }) {
  fs.mkdirSync(NOTES, { recursive: true });
  content = String(content || '');
  if (!id) {                                                         // new note: name the file after its first heading / the given title
    const base = slug(title || titleOf('Untitled', content)); id = base; let n = 2;
    while (fs.existsSync(noteFile(id))) id = base + ' ' + n++;
  } else if (!validNoteId(id)) return { error: 'Invalid note name.' };
  const f = noteFile(id);
  U.atomicWrite(f, content);
  let mtime = Date.now(); try { mtime = Math.floor(fs.statSync(f).mtimeMs); } catch (e) {}
  docs.indexNote(f, isCode(id) ? id : titleOf(id, content), content, mtime);
  return { id, code: isCode(id), title: isCode(id) ? id : titleOf(id, content), path: f };
}
function noteRename(id, title) {
  const note = noteGet(id);
  const clean = String(title || '').replace(/[\r\n]+/g, ' ').trim().slice(0, 100);
  if (!note || !clean) return { error: note ? 'Enter a note title.' : 'Note not found.' };
  /* renaming to (or of) a code file renames the file itself; the text is left exactly as it is */
  if (isCode(id) || isCode(clean)) {
    const ext = (isCode(clean) ? clean.match(/\.[^.]+$/) : id.match(/\.[^.]+$/))[0] || '.py';
    const base = slug(clean.replace(/\.[^.]+$/, '')) || 'Untitled';
    let next = base + ext, n = 2;
    while (next.toLowerCase() !== id.toLowerCase() && fs.existsSync(noteFile(next))) next = base + ' ' + n++ + ext;
    if (next !== id) { fs.renameSync(noteFile(id), noteFile(next)); docs.removePath(noteFile(id)); }
    return { ...noteSave({ id: next, content: note.content }), content: note.content };
  }
  const heading = /^[ \t]*#[ \t]+[^\r\n]+/m;
  const next = '# ' + clean;
  const content = heading.test(note.content) ? note.content.replace(heading, () => next) : next + '\n\n' + note.content;
  /* the file is renamed with the note, so the path shown at the top of it stays true */
  const base = slug(clean) || 'Untitled';
  let renamed = base, n = 2;
  while (renamed.toLowerCase() !== id.toLowerCase() && fs.existsSync(noteFile(renamed))) renamed = base + ' ' + n++;
  if (renamed !== id) { try { fs.renameSync(noteFile(id), noteFile(renamed)); } catch (e) { } docs.removePath(noteFile(id)); }
  return { ...noteSave({ id: renamed, content }), content };
}
function noteDelete(id) {
  if (!validNoteId(id)) return false;
  const f = noteFile(id);
  if (fs.existsSync(f)) fs.unlinkSync(f);
  docs.removePath(f);
  return true;
}
function notesSync() {                                              // make sure every note is searchable (skipping unchanged notes so large FTS5 indexes don't stall startup)
  try {
    for (const n of notesList()) {
      const f = noteFile(n.id);
      const c = fs.readFileSync(f, 'utf8');
      if (docs.noteNeedsIndex && !docs.noteNeedsIndex(f, n.updated, c.length)) continue;
      docs.indexNote(f, n.title, c, n.updated);
    }
  } catch (e) {}
}

/* ---------------- prompts ---------------- */
const PROMPTS = path.join(DATA, 'prompts.json');
const DEFAULT_PROMPTS = [
  { id: 'p1', name: 'Reply to this message', text: 'Write a friendly, natural and concise reply to the following message. Sound like a real person, not a robot:\n\n{text}' },
  { id: 'p2', name: 'Explain like I am 12', text: 'Explain the following so a curious 12-year-old would understand it, using a simple example:\n\n{text}' },
  { id: 'p3', name: 'Proofread', text: 'Proofread the following. Fix spelling, grammar and punctuation without changing the meaning or tone. Reply with only the corrected text:\n\n{text}' },
  { id: 'p4', name: 'Make it professional', text: 'Rewrite the following in a clear, polite and professional tone. Keep it concise:\n\n{text}' },
  { id: 'p5', name: 'Key takeaways', text: 'List the key takeaways from the following as short bullet points, then give a one-sentence summary:\n\n{text}' },
  { id: 'p6', name: 'Pros and cons', text: 'Give a balanced list of pros and cons for the following, then a short recommendation:\n\n{text}' },
  { id: 'p7', name: 'Brainstorm ideas', text: 'Brainstorm 10 creative, practical ideas related to the following. Number them and add a one-line reason for each:\n\n{text}' },
  { id: 'p8', name: 'Review this code', text: 'Review the following code. Point out bugs, risky parts and simple improvements, then show a corrected version if needed:\n\n{text}' },
  { id: 'p9', name: 'Turn into an email', text: 'Turn the following into a short, clear email with a subject line:\n\n{text}' },
  { id: 'p10', name: 'Step-by-step plan', text: 'Turn the following goal into a realistic step-by-step plan with rough time estimates:\n\n{text}' },
];
const promptsGet = () => U.readJson(PROMPTS, null) || DEFAULT_PROMPTS;
const promptsSet = v => { U.writeJson(PROMPTS, Array.isArray(v) ? v.slice(0, 200) : DEFAULT_PROMPTS); return true; };

/* ---------------- flashcards ---------------- */
const CARDS = path.join(DATA, 'cards.json');
const cardsGet = () => U.readJson(CARDS, []);
const cardsSet = v => { U.writeJson(CARDS, Array.isArray(v) ? v.slice(0, 5000) : []); return true; };

/* ---------------- reminders (the tray listener shows the notification, even when the window is closed) ---------------- */
const REM = path.join(DATA, 'reminders.json'), TSV = path.join(DATA, 'reminders.tsv');
const recur = require('./recur'), HORIZON = 45 * 864e5, tsvText = r => String(r.text).replace(/[\t\r\n]+/g, ' ');
/* the tray listener reads one row per pending notification. A repeating reminder is written as its next occurrences (id~time) so it keeps firing even when Moundshroud is closed. */
function writeTsv(list, purge) {
  const now = Date.now(), old = {}; try { fs.readFileSync(TSV, 'utf8').split('\n').filter(Boolean).forEach(l => { old[l.split('\t')[0]] = l; }); } catch (e) {}
  const rows = [];
  for (const r of list) {
    if (r.rule) {
      if (r.paused || r.done) continue; const have = new Set();
      for (const id of Object.keys(old)) if (id.startsWith(r.id + '~') && !(purge && purge.has(r.id))) { rows.push(old[id]); have.add(id); }
      recur.occ(r, now, now + HORIZON, 60).forEach(at => { const id = r.id + '~' + at; if (!have.has(id)) rows.push(id + '\t' + at + '\t' + tsvText(r)); });
    } else if (!r.done) rows.push(r.id + '\t' + r.at + '\t' + tsvText(r));
  }
  verseRows(old, now).forEach(r => rows.push(r));
  const body = rows.length ? rows.join('\n') + '\n' : ''; let cur = ''; try { cur = fs.readFileSync(TSV, 'utf8'); } catch (e) {}
  if (cur !== body) U.atomicWrite(TSV, body);
}
/* ---------------- daily verse notification ----------------
   The Today page sends the next weeks of verses (one per day, at the chosen time). They are written as rows "vod~YYYY-MM-DD <time> VERSE|reference|text",
   so the tray listener shows each one as a Windows notification at 8:00 (or the chosen time) even when Moundshroud is closed. */
const VSCH = path.join(DATA, 'verse-schedule.json'), vtxt = x => String(x == null ? '' : x).replace(/[\t\r\n|]+/g, ' ').replace(/\s+/g, ' ').trim();
function verseRows(old, now) {
  const v = U.readJson(VSCH, null); if (!v || !v.on || !Array.isArray(v.items)) return [];
  const rows = [];
  for (const it of v.items) {
    const id = 'vod~' + it.day;
    if (old[id]) { rows.push(old[id]); continue; }                     // still waiting for the listener (it deletes a row once shown)
    if (+it.at > now) rows.push(id + '\t' + (+it.at) + '\tVERSE|' + vtxt(it.ref) + '|' + vtxt(it.text));
  }
  return rows;
}
function verseStatus() {
  const v = U.readJson(VSCH, null); let rows = [];
  try { rows = fs.readFileSync(TSV, 'utf8').split('\n').filter(l => l.startsWith('vod~')).map(l => +l.split('\t')[1]).filter(Boolean).sort((a, b) => a - b); } catch (e) {}
  return { on: !!(v && v.on), h: v ? v.h : 8, m: v ? v.m : 0, scheduled: rows.length, next: rows[0] || 0, updated: v ? v.updated : 0 };
}
function verseTest(ref, text) {                        // "send a test now": a verse row that is already due, so the listener shows it within a few seconds
  const row = 'vod~test-' + Date.now() + '\t' + (Date.now() - 500) + '\tVERSE|' + vtxt(ref || 'Test') + '|' + vtxt(text || 'This is how your daily verse will look.') + '\n';
  fs.appendFileSync(TSV, row, 'utf8'); return { ok: true };
}
function verseSet(cfg) {
  cfg = cfg || {}; const items = (Array.isArray(cfg.items) ? cfg.items : []).slice(0, 60).filter(it => it && /^\d{4}-\d{2}-\d{2}$/.test(String(it.day)) && +it.at > 0 && it.text).map(it => ({ day: String(it.day), at: +it.at, ref: String(it.ref || '').slice(0, 80), text: String(it.text).slice(0, 700) }));
  U.writeJson(VSCH, { on: !!cfg.on, h: Math.max(0, Math.min(23, cfg.h | 0)), m: Math.max(0, Math.min(59, cfg.m | 0)), tr: String(cfg.tr || ''), updated: Date.now(), items });
  try { const rows = fs.readFileSync(TSV, 'utf8').split('\n').filter(l => l && !l.startsWith('vod~')); U.atomicWrite(TSV, rows.length ? rows.join('\n') + '\n' : ''); } catch (e) {}
  writeTsv(U.readJson(REM, [])); return verseStatus();
}
function remList() {
  const list = U.readJson(REM, []); let pending = null, tsvAt = {};
  try { const rows = fs.readFileSync(TSV, 'utf8').split('\n').filter(Boolean).map(l => l.split('\t')); pending = new Set(rows.map(r => r[0])); rows.forEach(r => { tsvAt[r[0]] = +r[1]; }); } catch (e) {}
  const now = Date.now();
  let changed = false, anyRule = false;
  for (const r of list) {
    if (r.rule) { anyRule = true; const n = recur.next(r, now); if (n && r.at !== n) { r.at = n; changed = true; } if (!n && !r.done) { r.done = true; changed = true; } continue; }
    if (tsvAt[r.id] && (r.done || tsvAt[r.id] !== r.at)) { r.at = tsvAt[r.id]; r.done = false; changed = true; }   // snoozed from the pop-up
    if (!r.done && r.at <= now && pending && !pending.has(r.id)) { r.done = true; changed = true; }   // the listener has shown it
  }
  if (changed) { U.writeJson(REM, list); }
  if (anyRule) writeTsv(list);                                                // keep the next occurrences topped up
  return list.filter(r => !r.done || now - r.at < 86400000 || (r.rule && r.done)).map(r => r.rule ? Object.assign({}, r, { nextList: r.paused ? [] : recur.occ(r, now, now + 400 * 864e5, 4) }) : r).sort((a, b) => (a.paused ? 1 : 0) - (b.paused ? 1 : 0) || a.at - b.at);
}
function remAdd(text, at, rule, opts) {
  const list = U.readJson(REM, []); opts = opts || {}; const r = { id: Date.now().toString(36) + Math.random().toString(36).slice(2, 5), at: +at || Date.now(), text: String(text).slice(0, 300), created: Date.now(), done: false };
  if (rule && rule.type) {
    r.rule = { type: rule.type, every: Math.max(1, Math.min(365, rule.every | 0 || 1)), days: Array.isArray(rule.days) ? rule.days.filter(d => d >= 0 && d <= 6) : [], dom: rule.dom || 0, month: rule.month == null ? null : rule.month, tod: rule.tod == null ? null : rule.tod };
    r.start = +at || Date.now(); r.skipAt = []; if (opts.until) r.until = +opts.until; else if (opts.count) r.until = recur.untilFor(r, opts.count);
    r.at = recur.next(r, Date.now()) || r.start;
  }
  list.push(r); U.writeJson(REM, list.slice(-300)); writeTsv(list); return r;
}
function remDelete(id) { const list = U.readJson(REM, []).filter(r => r.id !== id); U.writeJson(REM, list); writeTsv(list); return true; }
function remEdit(id, what) {
  const list = U.readJson(REM, []), r = list.find(x => x.id === id); if (!r) return false; const purge = new Set();
  if (what.skip && r.rule) { const n = recur.next(r, Date.now()); if (n) { (r.skipAt = r.skipAt || []).push(n); try { const rows = fs.readFileSync(TSV, 'utf8').split('\n').filter(l => l && !l.startsWith(r.id + '~' + n + '\t')); U.atomicWrite(TSV, rows.length ? rows.join('\n') + '\n' : ''); } catch (e) {} } }
  if (typeof what.paused === 'boolean') { r.paused = what.paused; purge.add(r.id); }
  if (what.text) r.text = String(what.text).slice(0, 300);
  if (what.rule && r.rule) { Object.assign(r.rule, what.rule); r.start = Date.now(); r.skipAt = []; purge.add(r.id); }
  if ('until' in what && r.rule) r.until = what.until ? +what.until : 0;
  U.writeJson(REM, list); writeTsv(list, purge); return true;
}

/* ---------------- daily briefing ---------------- */
function desktopDirs() { const h = os.homedir(); return [path.join(h, 'OneDrive', 'Desktop'), path.join(h, 'Desktop')]; }
function healthReport() {
  for (const d of desktopDirs()) {
    const dir = path.join(d, 'PC Health Reports'); if (!fs.existsSync(dir)) continue;
    const files = fs.readdirSync(dir).filter(f => /^PC-Health-.*\.txt$/.test(f)).sort();
    if (!files.length) continue;
    const f = files[files.length - 1], text = fs.readFileSync(path.join(dir, f), 'utf8').replace(/^\uFEFF/, '');
    const head = text.split(/\r?\n\r?\n/)[0].split(/\r?\n/).map(s => s.trim()).filter(Boolean);
    const verdict = (head[0] || '').replace(/^VERDICT:\s*/i, '');
    const issues = head.slice(1).filter(l => l.startsWith('-')).map(l => l.replace(/^-\s*/, ''));
    const disk = (text.match(/C:\s+(\d+) GB free of (\d+) GB \(([\d.]+)% free\)/) || []);
    return { file: f, date: f.replace(/^PC-Health-|\.txt$/g, ''), verdict, issues, freeGB: disk[1] ? +disk[1] : null, freePct: disk[3] ? +disk[3] : null, path: path.join(dir, f) };
  }
  return null;
}
function briefing() {
  const now = new Date(), endOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1).getTime();
  const rem = remList().filter(r => !r.done && r.at < endOfDay);
  let st = null; try { st = docs.stats(); } catch (e) {}
  return { now: Date.now(), health: healthReport(), reminders: rem, notes: notesList().length, docs: st };
}

module.exports = { NOTES, notesList, noteGet, noteSave, noteRename, noteDelete, notesSync, promptsGet, promptsSet, cardsGet, cardsSet, remList, remAdd, remDelete, remEdit, verseSet, verseStatus, verseTest, briefing };

// Saved Bible Expert conversations. Each conversation (questions, answers and the numbered sources) is kept in this browser (IndexedDB, with
// localStorage as a fallback), so a reload or a restart never loses it. The logic at the top has no page code in it, so tests/lessons-test.js
// can run it in Node; the storage at the bottom only runs in the page.
const BibleChats = (() => {
  const MAXSRC = 1500, MAXCHATS = 300;
  const clean = msgs => (msgs || []).filter(m => m && (m.role === 'user' || m.role === 'assistant') && String(m.content || '').trim()).map(m => m.role === 'user' ? { role: 'user', content: String(m.content) } : { role: 'assistant', content: String(m.content), sources: (m.sources || []).map(s => ({ title: String(s.title || ''), where: String(s.where || s.title || ''), text: String(s.text || '').slice(0, MAXSRC), wiki: !!s.wiki })) });
  const titleOf = msgs => { const u = (msgs || []).find(m => m.role === 'user'); const t = String(u ? u.content : 'Conversation').replace(/\s+/g, ' ').trim(); return t.length > 70 ? t.slice(0, 67) + '...' : t; };
  const newId = now => 'bc' + (now || Date.now()).toString(36) + Math.random().toString(36).slice(2, 6);
  /* the record to store for the conversation as it stands now (null when nothing was answered yet) */
  function record(id, msgs, model, now, prev) {
    const m = clean(msgs); if (!m.some(x => x.role === 'assistant')) return null; now = now || Date.now();
    return { id: id || newId(now), title: (prev && prev.title && prev.custom) ? prev.title : titleOf(m), custom: !!(prev && prev.custom), model: model || (prev && prev.model) || '', created: (prev && prev.created) || now, ts: now, msgs: m };
  }
  /* the conversation as Markdown, with its sources, for copying or saving as a file */
  function toMarkdown(rec) {
    if (!rec) return ''; const d = new Date(rec.ts || Date.now()), pad = n => String(n).padStart(2, '0'), when = d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());
    let out = '# ' + rec.title + '\n\nBible Expert conversation, ' + when + (rec.model ? ', model ' + String(rec.model).replace(/:latest$/, '') : '') + '\n';
    for (const m of rec.msgs) {
      if (m.role === 'user') { out += '\n## Question\n\n' + m.content + '\n'; continue; }
      out += '\n## Answer\n\n' + m.content + '\n';
      if (m.sources && m.sources.length) { out += '\n### Sources\n'; m.sources.forEach((s, i) => { out += '\n[' + (i + 1) + '] ' + (s.where || s.title) + '\n' + String(s.text).split('\n').map(l => '> ' + l).join('\n') + '\n'; }); }
    }
    return out;
  }
  const fileName = rec => 'Bible Expert - ' + String(rec.title).replace(/[\\/:*?"<>|]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 50) + '.md';
  /* newest first; a search matches the title and the questions */
  const sortList = (l, q) => { q = String(q || '').toLowerCase().trim(); return l.filter(r => !q || (r.title + ' ' + r.msgs.filter(m => m.role === 'user').map(m => m.content).join(' ')).toLowerCase().includes(q)).sort((a, b) => b.ts - a.ts); };
  return { clean, titleOf, newId, record, toMarkdown, fileName, sortList, MAXCHATS };
})();
if (typeof module !== 'undefined' && module.exports) module.exports = BibleChats;

(() => {
  if (typeof window === 'undefined' || typeof A === 'undefined' || typeof document === 'undefined') return;      /* in Node (the tests) there is no page */
  const DB = 'moundshroud-bible', ST = 'chats', FB = 'bible_chats_v1';
  let dbp = null;
  const open = () => dbp || (dbp = new Promise((ok, no) => { try { const r = indexedDB.open(DB, 1); r.onupgradeneeded = () => r.result.createObjectStore(ST, { keyPath: 'id' }); r.onsuccess = () => ok(r.result); r.onerror = () => no(r.error); } catch (e) { no(e); } }).catch(e => { dbp = null; throw e; }));
  const tx = (mode, fn) => open().then(db => new Promise((ok, no) => { const t = db.transaction(ST, mode), st = t.objectStore(ST); let out; const rq = fn(st); if (rq) rq.onsuccess = () => { out = rq.result; }; t.oncomplete = () => ok(out); t.onerror = () => no(t.error); t.onabort = () => no(t.error); }));
  const fbAll = () => { try { return JSON.parse(localStorage.getItem(FB) || '[]'); } catch (e) { return []; } };
  const fbPut = l => { try { localStorage.setItem(FB, JSON.stringify(l)); return true; } catch (e) { return false; } };
  async function list() { let a = []; try { a = await tx('readonly', s => s.getAll()) || []; } catch (e) { } const f = fbAll(); const ids = new Set(a.map(x => x.id)); return a.concat(f.filter(x => !ids.has(x.id))); }
  async function get(id) { return (await list()).find(r => r.id === id) || null; }
  async function put(rec) {
    try { await tx('readwrite', s => s.put(rec)); return true; } catch (e) { }
    const f = fbAll().filter(x => x.id !== rec.id); f.push(rec); f.sort((a, b) => b.ts - a.ts); return fbPut(f.slice(0, 40));
  }
  async function del(id) { try { await tx('readwrite', s => s.delete(id)); } catch (e) { } fbPut(fbAll().filter(x => x.id !== id)); }
  async function prune() { const l = (await list()).sort((a, b) => b.ts - a.ts); for (const r of l.slice(BibleChats.MAXCHATS)) await del(r.id); }
  A.bibleChats = { list, get, put, del, prune, logic: BibleChats };
})();

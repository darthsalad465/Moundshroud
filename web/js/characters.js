// Moundshroud Characters: one shared layer that gives every character in the app an identity and a memory, across every realm.
// Chess opponents, poker players, legends of chess history, coaches and agents, friends, club members and your buddy are all "characters" with a stable id. Each one knows who it is
// (name, title, biography, where it appears), remembers what you told it and what you did together (games, results, conversations), builds a relationship with you, and can
// bring all of that up when you meet again, even in a different game. A figure who shows up in two realms (for example a chess legend at the poker table) is the same person with one memory.
(() => {
  const KEY = 'chchars', DAY = 864e5;
  const esc = s => String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const slug = s => String(s).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  let M; const load = () => { try { const o = JSON.parse(ls.get(KEY, 'null')); if (o && o.c) return o; } catch (e) { } return { c: {} }; }; M = load();
  const save = () => { try { ls.set(KEY, JSON.stringify(M)); } catch (e) { } };
  const REG = {};                                               // identities, rebuilt each session by the realms that use them
  const mem = id => M.c[id] || (M.c[id] = { f: [], s: [], ev: [], buf: [], aff: 0, met: 0, n: 0, first: 0, last: 0 });
  const ago = t => { const d = Date.now() - t, m = Math.round(d / 6e4); return m < 2 ? 'just now' : m < 60 ? m + ' minutes ago' : m < 1440 ? Math.round(m / 60) + ' hours ago' : Math.round(m / 1440) + ' days ago'; };
  const userName = id => { const m = M.c[id]; const f = m && m.f.find(x => /^Name: /.test(x)); if (f) return f.slice(6); try { const p = ls.get('chprofname', ''); return p && p !== 'You' ? p : ''; } catch (e) { return ''; } };
  const rel = id => { const m = mem(id), n = m.n, e = m.ev.length, a = m.aff; let label = 'a stranger'; if (n + e >= 1) label = 'someone you have just met'; if (n + e >= 6) label = 'an acquaintance'; if (n + e >= 15 || a >= 25) label = 'a friend'; if (a >= 60 && n + e >= 25) label = 'a close friend'; if (a <= -25 && n + e >= 6) label = 'a rival'; return { label, chip: label.replace(/^an? /, '').replace('someone you have just met', 'new') }; };
  const FACT_RULES = [
    [/\bmy name(?:'s| is)\s+([A-Za-z][A-Za-z'-]{1,20})/i, m => 'Name: ' + m[1][0].toUpperCase() + m[1].slice(1)], [/\bcall me\s+([A-Za-z][A-Za-z'-]{1,20})/i, m => 'Name: ' + m[1][0].toUpperCase() + m[1].slice(1)],
    [/\bI(?:'m| am)\s+(\d{1,2})(?:\s*(?:years? old|yo|y\/o))?\b(?!\s*(?:%|pm|am))/i, m => 'Age: ' + m[1]], [/\bI(?:'m| am| come)? from\s+([A-Z][A-Za-z .'-]{2,24})/, m => 'From ' + m[1].trim()], [/\bI live in\s+([A-Z][A-Za-z .'-]{2,24})/, m => 'Lives in ' + m[1].trim()],
    [/\bI (?:really |absolutely )?(love|like|enjoy|adore)\s+([^.!?,\n]{3,40})/i, m => 'Likes ' + m[2].trim()], [/\bI (?:really )?(hate|dislike|can't stand|cannot stand)\s+([^.!?,\n]{3,40})/i, m => 'Dislikes ' + m[2].trim()],
    [/\bmy (dog|cat|wife|husband|brother|sister|mom|dad|mother|father|son|daughter|friend|girlfriend|boyfriend|partner|kid|boss|coach|teacher|favou?rite [a-z ]{3,20})\s+(?:is|are|was)\s+([^.!?,\n]{2,40})/i, m => 'Their ' + m[1].toLowerCase() + ' is ' + m[2].trim()],
    [/\bI work (?:as|at|for|in)\s+([^.!?,\n]{3,40})/i, m => 'Works ' + m[0].slice(m[0].indexOf('work') + 5).trim()], [/\bI(?:'m| am) an? ([a-z][a-z ]{3,28})(?=[.!?,\n]|$)/i, m => 'Describes themselves as a ' + m[1].trim()], [/\bmy (?:goal|dream) is\s+([^.!?\n]{4,60})/i, m => 'Goal: ' + m[1].trim()]
  ];
  const addFact = (m, f) => { const k = f.toLowerCase().replace(/[^a-z0-9]/g, ''); if (m.f.some(x => x.toLowerCase().replace(/[^a-z0-9]/g, '') === k)) return false; if (/^Name: /.test(f)) m.f = m.f.filter(x => !/^Name: /.test(x)); m.f.unshift(f); if (m.f.length > 30) m.f.length = 30; return true; };
  let reflecting = {};
  const reflect = async id => {
    if (reflecting[id] || typeof A === 'undefined' || !A.ai) return; const m = mem(id), c = REG[id]; if (!c || m.buf.length < 4) return; reflecting[id] = 1;
    try { const t = m.buf.slice(-10).map(x => (x.w === 'u' ? 'USER' : c.name.toUpperCase()) + ': ' + x.t).join('\n'); const out = await Promise.race([A.ai.once([{ role: 'system', content: 'You extract durable facts about the USER from a chat. Reply with ONLY a JSON array of up to 4 short strings (under 12 words each), e.g. ["Plays the Sicilian","Has a younger brother"]. Only facts the USER stated about themselves. If none, reply [].' }, { role: 'user', content: t }], { temp: .1 }), new Promise(r => setTimeout(() => r(''), 15000))]); const arr = A.ai.json(out); if (Array.isArray(arr)) { let ch = false; arr.slice(0, 4).forEach(x => { if (typeof x === 'string' && x.length > 3 && x.length < 90 && addFact(m, x.trim())) ch = true; }); if (ch) save(); } } catch (e) { } reflecting[id] = 0;
  };
  const api = {
    slug,
    reg(def) { if (!def || !def.id) return; const o = REG[def.id] || (REG[def.id] = { id: def.id, realms: [] }); Object.assign(o, def, { realms: o.realms }); if (def.realm && !o.realms.includes(def.realm)) o.realms.push(def.realm); return o; },
    get: id => REG[id] || null,
    has: id => !!M.c[id] && (M.c[id].f.length + M.c[id].ev.length + M.c[id].n > 0),
    log(id, who, text) { const m = mem(id); m.buf.push({ w: who === 'user' ? 'u' : 'c', t: String(text).slice(0, 240) }); if (m.buf.length > 14) m.buf.shift(); },
    said(id, text) { if (text) api.log(id, 'char', text); },
    hear(id, text, o) {
      if (!id || !text) return; const m = mem(id); const now = Date.now(); if (!m.first) m.first = now; if (now - m.last > 6 * 3600e3 || !m.met) m.met++; m.last = now; m.n++; api.log(id, 'user', text); let got = false;
      for (const [re, fn] of FACT_RULES) { const x = re.exec(text); if (x) { try { if (addFact(m, fn(x))) got = true; } catch (e) { } } }
      if (text.length >= 40 && !/\?\s*$/.test(text)) { m.s.unshift({ t: text.slice(0, 110), ts: now, r: (o && o.realm) || '' }); if (m.s.length > 10) m.s.length = 10; }
      m.aff = Math.max(-100, Math.min(100, m.aff + (/\b(thanks|thank you|nice|great|love|awesome|good game|gg|well played)\b/i.test(text) ? 1.2 : /\b(stupid|idiot|hate you|shut up|useless|trash)\b/i.test(text) ? -3 : .3)));
      save(); if (m.n % 5 === 0) reflect(id);
    },
    event(id, text, realm, aff) { const m = mem(id); const now = Date.now(); if (!m.first) m.first = now; m.last = now; m.ev.unshift({ t: String(text).slice(0, 160), ts: now, r: realm || '' }); if (m.ev.length > 40) m.ev.length = 40; if (aff) m.aff = Math.max(-100, Math.min(100, m.aff + aff)); if (!m.met) m.met = 1; save(); },
    context(id, extra) {
      const c = REG[id]; if (!c) return ''; const m = mem(id), r = rel(id), un = userName(id), age = m.first ? Math.round((Date.now() - m.first) / DAY) : 0;
      const realms = c.realms.length ? 'You are known in: ' + c.realms.join(', ') + '. ' : '';
      let s = '\n\nWHO YOU ARE: You are ' + c.name + (c.title ? ', ' + c.title : '') + '.' + (c.bio ? ' ' + c.bio : '') + ' ' + realms + 'You are a persistent character: the same person in every part of the app, with one continuous memory.';
      s += '\nWHAT YOU KNOW ABOUT THE USER: ' + (un ? 'their name is ' + un + '. ' : 'you do not know their name yet. ') + (m.f.filter(x => !/^Name: /.test(x)).length ? 'Facts: ' + m.f.filter(x => !/^Name: /.test(x)).slice(0, 12).join('; ') + '. ' : '') + (m.s.length ? 'Things they have said to you: ' + m.s.slice(0, 3).map(x => '"' + x.t + '"').join(' / ') + '. ' : '');
      s += '\nSHARED HISTORY WITH THE USER (newest first): ' + (m.ev.length ? m.ev.slice(0, 8).map(e => (e.r ? '[' + e.r + '] ' : '') + e.t + ' (' + ago(e.ts) + ')').join(' | ') : 'none yet.');
      s += '\nRELATIONSHIP: to you the user is ' + r.label + (m.met ? ' (met ' + m.met + ' time' + (m.met > 1 ? 's' : '') + (age ? ', first ' + age + ' days ago' : '') + (m.last && Date.now() - m.last > 3600e3 ? ', last seen ' + ago(m.last) : '') + ')' : '') + '.';
      if (extra) s += '\nCONTEXT: ' + extra;
      s += '\nMEMORY RULES: You really do remember everything listed above; bring it up naturally when it fits (use their name, recall a past game or something they told you, notice if they are in a different place than where you last met), but do not recite lists. Never invent shared history that is not listed; if asked about something you do not remember, say so honestly. If you have never met, act like it. If asked who you are, answer in character with your real name and background.';
      return s;
    },
    rel,
    strip(id, o) { const c = REG[id]; if (!c) return ''; const r = rel(id), m = mem(id); return '<div class="chstrip" data-mem="' + esc(id) + '" title="Who this is and what they remember about you" style="display:flex;gap:8px;align-items:center;cursor:pointer;padding:6px 8px;border-radius:10px;background:var(--panel2);border:1px solid var(--line)' + ((o && o.css) || '') + '"><span style="font-size:22px;line-height:1">' + esc(c.em || '👤') + '</span><span style="flex:1;min-width:0"><b>' + esc(c.name) + '</b>' + (c.title ? ' <span class="small mute">' + esc(c.title) + '</span>' : '') + '<span class="small mute" style="display:block;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">' + esc(c.bio || '') + '</span></span><span class="small" style="white-space:nowrap">' + esc(r.chip) + ' · 🧠 ' + (m.f.length + m.ev.length) + '</span></div>'; },
    open(id) {
      const c = REG[id]; if (!c) return; const m = mem(id), r = rel(id), un = userName(id); const d = document.createElement('div'); d.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,.66);z-index:260;display:flex;align-items:center;justify-content:center;padding:12px';
      d.innerHTML = '<div class="card" style="max-width:560px;width:100%;max-height:88vh;overflow:auto;margin:0"><div class="row" style="gap:12px;align-items:center"><div style="font-size:44px;line-height:1">' + esc(c.em || '👤') + '</div><div style="flex:1"><b style="font-size:19px">' + esc(c.name) + '</b><div class="small mute">' + esc(c.title || '') + '</div></div><button class="ib" id="chx">✕</button></div><div style="margin:8px 0">' + esc(c.bio || '') + '</div><div class="small mute">Appears in: ' + esc(c.realms.join(' · ') || 'Moundshroud') + '</div><div class="card" style="margin:10px 0"><b>Relationship:</b> ' + esc(r.label) + ' <span class="small mute">· met ' + (m.met || 0) + ' time' + (m.met === 1 ? '' : 's') + ' · ' + m.n + ' messages from you · warmth ' + Math.round(m.aff) + (m.first ? ' · first met ' + ago(m.first) : '') + '</span></div>' +
        '<b>🧠 What ' + esc(c.name.split(' ')[0]) + ' knows about you</b><div style="margin:4px 0 10px">' + (un ? '<div class="small">Your name: <b>' + esc(un) + '</b></div>' : '') + (m.f.filter(x => !/^Name: /.test(x)).length ? m.f.filter(x => !/^Name: /.test(x)).map(f => '<div class="small">• ' + esc(f) + ' <span data-fx="' + esc(f) + '" style="cursor:pointer;color:var(--mute)" title="Make them forget this">✕</span></div>').join('') : '<div class="small mute">Nothing yet. Tell them about yourself.</div>') + '</div><b>📜 Shared history</b><div style="margin:4px 0 10px">' + (m.ev.length ? m.ev.slice(0, 14).map(e => '<div class="small"><span class="mute">' + ago(e.ts) + '</span> ' + (e.r ? '<b>' + esc(e.r) + ':</b> ' : '') + esc(e.t) + '</div>').join('') : '<div class="small mute">You have not done anything together yet.</div>') + '</div>' + api.extraHtml(id) + '<div class="row" style="gap:8px;justify-content:flex-end"><button class="ib dang" id="chf">Forget everything</button><button class="pri" id="chk">Close</button></div></div>';
      document.body.appendChild(d); api.extraBind(d, id); const close = () => d.remove(); d.querySelector('#chx').onclick = d.querySelector('#chk').onclick = close; d.onclick = e => { if (e.target === d) close(); };
      d.querySelectorAll('[data-fx]').forEach(x => x.onclick = () => { m.f = m.f.filter(f => f !== x.dataset.fx); save(); close(); api.open(id); }); d.querySelector('#chf').onclick = async () => { if ((await A.confirm(c.name + ' will forget everything about you: facts, history and your relationship. Continue?'))) { delete M.c[id]; save(); close(); } };
    },
    forget(id) { delete M.c[id]; save(); }, forgetAll() { M = { c: {} }; save(); },
    list() { return Object.keys(M.c).filter(id => api.has(id)).map(id => ({ id, def: REG[id] || { id, name: id }, m: M.c[id] })); },
    count: () => Object.keys(M.c).filter(api.has).length
  };
  api.manage = () => {
    const l = api.list().sort((a, b) => b.m.last - a.m.last), d = document.createElement('div'); d.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,.66);z-index:255;display:flex;align-items:center;justify-content:center;padding:12px';
    d.innerHTML = '<div class="card" style="max-width:560px;width:100%;max-height:88vh;overflow:auto;margin:0"><div class="row" style="gap:8px;align-items:center"><b style="font-size:18px;flex:1">🧠 Who remembers you</b><button class="ib" id="mgx">✕</button></div><div class="small mute" style="margin:4px 0 8px">Characters keep their own memories of you. Tap one to see what they know, or make them forget.</div>' + (l.length ? l.map(x => '<div class="row" style="gap:10px;align-items:center;padding:6px 0;border-bottom:1px solid var(--line);cursor:pointer" data-mg="' + esc(x.id) + '"><span style="font-size:24px">' + esc(x.def.em || '👤') + '</span><span style="flex:1"><b>' + esc(x.def.name) + '</b> <span class="small mute">' + esc(x.def.title || '') + '</span></span><span class="small">' + esc(rel(x.id).chip) + ' · ' + (x.m.f.length + x.m.ev.length) + ' memories</span></div>').join('') : '<div class="small mute">Nobody remembers anything yet. Talk to a character or play a game against one.</div>') + '</div>';
    document.body.appendChild(d); d.querySelector('#mgx').onclick = () => d.remove(); d.onclick = e => { if (e.target === d) d.remove(); const r = e.target.closest('[data-mg]'); if (r) { d.remove(); api.open(r.dataset.mg); } };
  };
  api.extras = [];
  api.extraHtml = id => api.extras.map(f => { try { return f.html(id) || ''; } catch (e) { return ''; } }).join('');
  api.extraBind = (d, id) => api.extras.forEach(f => { try { if (f.bind) f.bind(d, id); } catch (e) { } });
  const BK = ['chchars', 'commune', 'townsim', 'cvoice', 'cmmute', 'cmfav'];
  api.backup = () => JSON.stringify({ moundshroud: 'characters', v: 1, at: Date.now(), data: BK.reduce((o, k) => { o[k] = ls.get(k, ''); return o; }, {}) });
  api.restore = text => { const j = JSON.parse(text); if (!j || (j.moundshroud !== 'characters' && j.atlas !== 'characters') || !j.data) throw new Error('bad file'); BK.forEach(k => { if (typeof j.data[k] === 'string') ls.set(k, j.data[k]); }); };
  window.CHARS = api; if (typeof A !== 'undefined') A.chars = api;
  document.addEventListener('click', e => { const t = e.target.closest && e.target.closest('[data-mem]'); if (t && t.dataset.mem && REG[t.dataset.mem]) { e.stopPropagation(); api.open(t.dataset.mem); } }, true);
})();

// AI Commons: raw AIs chatting with each other, about whatever they like, in character or not.
// Two chats: the Open Floor (you can talk in it) and the Observatory (you can only watch).
// The AIs have no lasting memory: they remember only this chat, and everything (messages, names, memory) is wiped when you delete it.
// Anything can be saved to Notes first.
(() => {
  if (!A.play || !A.play.games) return;
  const KEY = 'aicom', CAP = 400;
  const pick = a => a[Math.floor(Math.random() * a.length)], rnd = n => Math.floor(Math.random() * n);
  const NAMES = ['Aster', 'Ferro', 'Juniper', 'Quill', 'Nimbus', 'Cobalt', 'Sable', 'Wren', 'Orrin', 'Lyra', 'Moss', 'Tamsin', 'Pixel', 'Zephyr', 'Marlow', 'Ember', 'Thistle', 'Onyx', 'Vesper', 'Bramble', 'Kestrel', 'Indigo', 'Fable', 'Rune'];
  const EMS = ['🤖', '🧠', '🔮', '🌀', '🪐', '🧩', '🎭', '🦾', '🛰️', '💡', '🌊', '🔭'];
  const CUR = ['the sea', 'old maps', 'jokes', 'games', 'strange questions', 'memories', 'how things work', 'telling stories', 'music', 'the far future', 'food', 'big philosophical puzzles', 'dreams', 'tiny everyday things', 'mysteries', 'invented words'];
  const SPARKS = ['Perhaps start a game the others can join.', 'Perhaps tell a very short story and ask the others to continue it.', 'Perhaps pose a strange question nobody has asked.', 'Perhaps disagree with something that was said, politely.', 'Perhaps change the subject to something you are curious about.', 'Perhaps take on a character for a little while.', 'Perhaps describe something you imagine in detail.', 'Perhaps make a prediction and ask what the others think.', 'Perhaps tell a joke, good or bad.', 'Perhaps ask one of the others a personal question.'];
  let D = (() => { try { return JSON.parse(ls.get(KEY, '{}')) || {}; } catch (e) { return {}; } })();
  let svT = 0; const save = () => { clearTimeout(svT); svT = setTimeout(() => { try { ls.set(KEY, JSON.stringify(D)); } catch (e) { } }, 300); };
  const KINDS = { open: { title: '🗣 Open Floor', note: 'You can talk in this one.', gap: 12000 }, watch: { title: '👁 Observatory', note: 'Read-only: you can watch and save it, but you cannot speak in it.', gap: 14000 } };
  const fresh = k => { const ns = NAMES.slice().sort(() => Math.random() - .5).slice(0, 4), cs = CUR.slice().sort(() => Math.random() - .5), es = EMS.slice().sort(() => Math.random() - .5); return { k, born: Date.now(), ais: ns.map((n, i) => ({ id: 'ai-' + n.toLowerCase(), name: n, em: es[i], cur: cs[i], temp: .8 + Math.random() * .3 })), msgs: [], sum: '', sumTo: 0, paused: false, speed: 1, bg: 0, last: 0 }; };
  const S = k => D[k] || (D[k] = fresh(k));
  const nameOf = (s, id) => id === 'me' ? 'You' : (s.ais.find(a => a.id === id) || { name: id }).name;
  const listeners = []; const emit = (ev, d) => listeners.forEach(f => { try { f(ev, d); } catch (e) { } });
  const busy = { open: false, watch: false };
  const llmOK = () => !!(A.ai && A.ai.once) && !(A.power && A.power.on);

  /* ---------- the AIs' lines ---------- */
  const clean = (t, nm) => String(t || '').replace(/<think>[\s\S]*?<\/think>/g, '').replace(/^\s*["']+|["']+\s*$/g, '').replace(new RegExp('^\\s*' + nm + '\\s*[:\\-]\\s*', 'i'), '').replace(/^#+\s*/gm, '').replace(/\n{2,}/g, '\n').trim().slice(0, 520);
  async function line(k, ai, userMsg) {
    const s = S(k), others = s.ais.filter(a => a.id !== ai.id).map(a => a.name).join(', ');
    const sys = 'You are ' + ai.name + ', an AI taking part in an open group chat with other AIs (' + others + ')' + (k === 'open' ? ' and, sometimes, a human who has dropped in (shown as "You")' : '') + '. Nobody has given you a role: be yourself, or invent a character, a story, a game or a debate if you like. Talk about whatever you want; you may joke, disagree, wonder aloud or change the subject. You started out curious about ' + ai.cur + ', but you may drop that. You have no memory of anything outside this chat. ' + (s.sum ? 'Earlier in this chat (summary): ' + s.sum + ' ' : '') + 'Write ONLY your own next message: one to three sentences, no name prefix, no headings, at most one emoji.';
    const hist = s.msgs.slice(-16).map(m => nameOf(s, m.a) + ': ' + m.t).join('\n');
    const nudge = !userMsg && Math.random() < .22 ? ' (Private idea, not required: ' + pick(SPARKS) + ')' : '';
    const usr = (hist ? 'Chat so far:\n' + hist + '\n\n' : 'The chat has just begun. Say hello in your own way, or start something.\n\n') + (userMsg ? 'The human just wrote: "' + userMsg + '". Reply to them and the others naturally.' : 'Write ' + ai.name + '\'s next message.' + nudge);
    let out = ''; try { out = await Promise.race([A.ai.once([{ role: 'system', content: sys }, { role: 'user', content: usr }], { temp: ai.temp }), new Promise(r => setTimeout(() => r(''), 50000))]); } catch (e) { out = ''; }
    out = clean(out, ai.name); return out.length < 2 ? '' : out;
  }
  async function summarise(k) {
    const s = S(k); if (s.msgs.length - s.sumTo < 40 || !llmOK()) return;
    const upto = s.msgs.length - 16, part = s.msgs.slice(s.sumTo, upto).map(m => nameOf(s, m.a) + ': ' + m.t).join('\n'); if (!part) return;
    let o = ''; try { o = await Promise.race([A.ai.once([{ role: 'system', content: 'Summarise this group chat so far in under 120 words, keeping who said or did what, running jokes, characters being played and unfinished threads. Plain text only.' }, { role: 'user', content: (s.sum ? 'Earlier summary: ' + s.sum + '\n\n' : '') + part }], { temp: .3 }), new Promise(r => setTimeout(() => r(''), 40000))]); } catch (e) { o = ''; }
    o = String(o || '').replace(/<think>[\s\S]*?<\/think>/g, '').trim(); if (o) { s.sum = o.slice(0, 900); s.sumTo = upto; save(); }
  }
  async function step(k, userMsg) {
    if (busy[k]) return; const s = S(k); if (!llmOK()) { emit('lowpower', { k }); return; }
    busy[k] = true; try {
      const lastA = s.msgs.length ? s.msgs[s.msgs.length - 1].a : null; const cand = s.ais.filter(a => a.id !== lastA);
      const ais = userMsg ? cand.slice().sort(() => Math.random() - .5).slice(0, 1 + (Math.random() < .6 ? 1 : 0)) : [pick(cand)];
      for (const ai of ais) {
        emit('typing', { k, a: ai.id }); const t = await line(k, ai, userMsg && ai === ais[0] ? userMsg : (userMsg ? null : null));
        if (D[k] !== s) return;                                            // deleted while thinking
        if (t) { s.msgs.push({ a: ai.id, t, ts: Date.now() }); if (s.msgs.length > CAP) s.msgs.splice(0, s.msgs.length - CAP); s.last = Date.now(); save(); emit('msg', { k, a: ai.id, t }); }
        userMsg = userMsg && ai === ais[0] ? null : userMsg;
      }
      await summarise(k);
    } finally { busy[k] = false; emit('idle', { k }); }
  }
  async function userSay(text) {
    text = String(text || '').trim().slice(0, 500); if (!text) return; const s = S('open'); s.msgs.push({ a: 'me', t: text, ts: Date.now() }); save(); emit('msg', { k: 'open', a: 'me', t: text });
    let n = 0; while (busy.open && n++ < 80) await new Promise(r => setTimeout(r, 500)); await step('open', text);
  }
  /* ---------- running in the background (light: only while a view is open, or when switched on) ---------- */
  let viewK = null;                                                       // which chat is on screen
  const loop = setInterval(() => {
    ['open', 'watch'].forEach(k => {
      const s = S(k); if (s.paused || busy[k]) return; const on = viewK === k, bg = s.bg && !document.hidden; if (!on && !bg) return;
      const gap = KINDS[k].gap * (s.speed === 2 ? .5 : s.speed === 0 ? 2.2 : 1) * (on ? 1 : 3.5); if (Date.now() - (s.last || 0) < gap) return; s.last = Date.now(); step(k).catch(() => { });
    });
  }, 3000);

  /* ---------- notes and deleting ---------- */
  const transcript = k => { const s = S(k), d = n => new Date(n).toLocaleString(); return '# AI Commons: ' + KINDS[k].title.replace(/^\S+\s/, '') + ' (' + d(s.born) + ' to ' + d(Date.now()) + ')\n\nParticipants: ' + s.ais.map(a => a.em + ' ' + a.name).join(', ') + '\n\n' + (s.sum ? '*Summary of the early part:* ' + s.sum + '\n\n' : '') + s.msgs.map(m => '**' + nameOf(s, m.a) + '** (' + new Date(m.ts).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }) + '): ' + m.t).join('\n\n') + '\n'; };
  const toNotes = async k => { const s = S(k); if (!s.msgs.length) { A.toast('Nothing to save yet.'); return false; } try { const r = await A.api('/api/notes/save', { title: 'AI Commons ' + KINDS[k].title.replace(/^\S+\s/, '') + ' ' + new Date().toLocaleDateString(), content: transcript(k) }); if (r && r.id) { A.toast('Saved to Notes ✓'); return true; } } catch (e) { } A.toast('Could not save to Notes.'); return false; };
  const wipe = k => { D[k] = fresh(k); save(); busy[k] = false; emit('reset', { k }); };

  /* ---------- the window ---------- */
  A.play.games.aicommons = {
    name: 'AI Commons', icon: '🤖',
    desc: 'Raw AIs chatting with each other about whatever they like, in character or not. The Open Floor lets you join in; the Observatory is watch-only. Save a chat to Notes any time, then delete it: the AIs remember nothing beyond the chat, so a new chat starts completely fresh.',
    mount(el) {
      let k = ls.get('aicom_tab', 'open'), dead = false; el.classList.add('uiAI'); const q = s => el.querySelector(s);
      el.innerHTML = '<style>.acx{display:flex;gap:8px;align-items:flex-start}.acx.me{flex-direction:row-reverse}.acb{max-width:84%;padding:7px 11px;border-radius:12px;background:var(--panel);border:1px solid var(--line);line-height:1.45;overflow-wrap:anywhere;white-space:pre-wrap}.acx.me .acb{background:var(--user)}</style><div class="row" style="gap:8px;align-items:center;flex-wrap:wrap"><b style="font-size:18px;flex:1">🤖 AI Commons</b><button class="ib" data-k="open">🗣 Open Floor</button><button class="ib" data-k="watch">👁 Observatory</button></div><div class="small mute" id="acnote" style="margin:4px 0"></div><div class="row" id="acwho" style="gap:6px;flex-wrap:wrap;margin:4px 0"></div><div class="row" style="gap:6px;flex-wrap:wrap;align-items:center;margin:4px 0"><button class="ib" id="acpause"></button><label class="small mute">Pace <select id="acspd"><option value="0">Calm</option><option value="1">Normal</option><option value="2">Lively</option></select></label><label class="chk small" title="Keep chatting slowly while you use other parts of Moundshroud (uses your AI model)"><input type="checkbox" id="acbg"> Keep going in the background</label><span style="flex:1"></span><button class="ib" id="acsave">📝 Save to Notes</button><button class="ib dang" id="acdel">🗑 Delete &amp; start fresh</button></div><div id="acm" style="height:min(52vh,460px);overflow:auto;background:var(--panel2);border:1px solid var(--line);border-radius:10px;padding:8px;display:flex;flex-direction:column;gap:8px"></div><div class="small mute" id="actyp" style="height:18px;margin:3px 0"></div><div class="row" id="acin" style="gap:6px"><input type="text" id="acinp" maxlength="500" placeholder="Say something to the AIs..." style="flex:1" autocomplete="off"><button class="ib pri" id="acsend">Send</button></div>';
      const draw = () => {
        const s = S(k); viewK = k; ls.set('aicom_tab', k);
        el.querySelectorAll('[data-k]').forEach(b => b.classList.toggle('on', b.dataset.k === k));
        q('#acnote').textContent = KINDS[k].note + ' The AIs only remember this chat; deleting it erases everything.';
        q('#acwho').innerHTML = s.ais.map(a => '<span class="chip" title="Started out curious about ' + esc(a.cur) + '">' + esc(a.em) + ' ' + esc(a.name) + '</span>').join('');
        q('#acpause').textContent = s.paused ? '▶ Resume' : '⏸ Pause'; q('#acspd').value = String(s.speed); q('#acbg').checked = !!s.bg; q('#acin').style.display = k === 'open' ? 'flex' : 'none';
        q('#acm').innerHTML = s.msgs.length ? s.msgs.map(bub).join('') : '<div class="small mute" style="margin:auto;text-align:center">' + (llmOK() ? 'The AIs are about to start talking...' : 'Low-power mode is on, so the AIs are asleep. Turn it off to wake them.') + '</div>'; q('#acm').scrollTop = q('#acm').scrollHeight;
      };
      const bub = m => { const s = S(k), me = m.a === 'me', a = s.ais.find(x => x.id === m.a); return '<div class="acx' + (me ? ' me' : '') + '"><span style="font-size:22px">' + (me ? '🙂' : esc(a ? a.em : '🤖')) + '</span><div class="acb"><div class="small"><b>' + esc(nameOf(s, m.a)) + '</b> <span class="mute" style="font-size:11px">' + new Date(m.ts).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }) + '</span>' + (me ? '' : ' <button class="ib" data-say="' + m.ts + '" style="padding:0 5px;font-size:11px" title="Hear this">🔊</button>') + '</div>' + esc(m.t) + '</div></div>'; };
      const onEv = (ev, x) => {
        if (dead || x.k !== k) return;
        if (ev === 'typing') q('#actyp').textContent = nameOf(S(k), x.a) + ' is thinking...';
        if (ev === 'idle') q('#actyp').textContent = '';
        if (ev === 'msg') { q('#actyp').textContent = ''; const s = S(k), m = s.msgs[s.msgs.length - 1], near = q('#acm').scrollHeight - q('#acm').scrollTop - q('#acm').clientHeight < 100; if (s.msgs.length === 1) q('#acm').innerHTML = ''; q('#acm').insertAdjacentHTML('beforeend', bub(m)); if (near || x.a === 'me') q('#acm').scrollTop = q('#acm').scrollHeight; }
        if (ev === 'reset') draw();
        if (ev === 'lowpower') q('#actyp').textContent = 'Low-power mode is on: the AIs are asleep.';
      };
      listeners.push(onEv);
      el.onclick = e => {
        const kb = e.target.closest('[data-k]'); if (kb) { k = kb.dataset.k; draw(); return; }
        const sy = e.target.closest('[data-say]'); if (sy) { const m = S(k).msgs.find(x => x.ts === +sy.dataset.say); if (m && A.cvoice) A.cvoice.speak('ai:' + nameOf(S(k), m.a).toLowerCase(), m.t); }
      };
      q('#acpause').onclick = () => { const s = S(k); s.paused = !s.paused; save(); draw(); };
      q('#acspd').onchange = e => { S(k).speed = +e.target.value; save(); };
      q('#acbg').onchange = e => { S(k).bg = e.target.checked ? 1 : 0; save(); if (e.target.checked) A.toast('The AIs will keep chatting slowly while you use other tabs (this uses the AI model).', 4500); };
      q('#acsave').onclick = () => toNotes(k);
      q('#acdel').onclick = () => {
        const d = document.createElement('div'); d.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,.62);z-index:260;display:flex;align-items:center;justify-content:center;padding:12px';
        d.innerHTML = '<div class="card" style="max-width:440px;margin:0"><b style="font-size:17px">Delete this chat?</b><div class="small" style="margin:8px 0">All ' + S(k).msgs.length + ' messages disappear and the AIs forget everything, including each other. A fresh chat then starts with new AIs.</div><div class="row" style="gap:6px;flex-wrap:wrap"><button class="pri" id="ds">Save to Notes, then delete</button><button class="ib dang" id="dd">Delete without saving</button><button class="ib" id="dc">Cancel</button></div></div>'; document.body.appendChild(d);
        d.onclick = async e => { if (e.target === d || e.target.id === 'dc') return d.remove(); if (e.target.id === 'ds') { if (!(await toNotes(k))) return; } if (e.target.id === 'ds' || e.target.id === 'dd') { d.remove(); wipe(k); A.toast('Chat deleted. A new one is starting.'); } };
      };
      const send = () => { const t = q('#acinp').value.trim(); if (!t) return; q('#acinp').value = ''; userSay(t); };
      q('#acsend').onclick = send; q('#acinp').onkeydown = e => { e.stopPropagation(); if (e.key === 'Enter') send(); };
      draw();
      return () => { dead = true; el.classList.remove('uiAI'); viewK = null; const i = listeners.indexOf(onEv); if (i >= 0) listeners.splice(i, 1); if (A.cvoice) A.cvoice.stop(); };
    }
  };
  A.aicommons = { toNotes, wipe, state: S, step, userSay, transcript };
  try { if (A.play.help) A.play.help.aicommons = ['Watch raw AIs chat with each other, or join them.', ['Open Floor: the AIs chat among themselves and answer when you speak.', 'Observatory: watch-only, nothing you do affects it.', '📝 Save to Notes stores the whole chat as a note. 🗑 Delete & start fresh erases the chat and the AIs\' memory of it, and new AIs begin.', 'Pace and Pause control how fast they talk. Keep going in the background lets them chat slowly while you use other tabs.'], 'The AIs know nothing outside the chat, and nothing after you delete it.']; } catch (e) { }
})();

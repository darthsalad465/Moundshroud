// Communities: groups of characters who keep talking to each other in group chats whether or not you are there.
// You can step into any channel, read the history, or join in. The characters never learn that you read their history;
// to them you simply turn up and speak. Used by the Chess community tab and by the Hollow Creek town game.
(() => {
  const KEY = 'commune', CAP = 160;
  const pick = a => a[Math.floor(Math.random() * a.length)], rnd = n => Math.floor(Math.random() * n);
  const hash = s => { let h = 7; s = String(s); for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0; return h; };
  const arr = x => x == null ? [] : [].concat(x);
  let D = (() => { try { return JSON.parse(ls.get(KEY, '{}')) || {}; } catch (e) { return {}; } })();
  let saveT = 0; const save = () => { clearTimeout(saveT); saveT = setTimeout(() => { try { ls.set(KEY, JSON.stringify(D)); } catch (e) { } }, 400); };
  const W = {}, listeners = [];
  const emit = (ev, d) => listeners.forEach(f => { try { f(ev, d); } catch (e) { } });
  const st = w => D[w] || (D[w] = { ch: {}, sim: 0, on: 0 });
  const chan = (w, c) => { const s = st(w); return s.ch[c] || (s.ch[c] = { m: [], r: 0 }); };
  const cast = w => { const d = W[w]; if (d._cast && Date.now() - (d._ckT || 0) < 4000) return d._cast; d._ckT = Date.now(); const key = (d.castKey ? d.castKey() : '') + '|' + (st(w).extra || []).length; if (!d._cast || d._ck !== key) { d._ck = key; d._cast = {}; (d.cast() || []).concat(st(w).extra || []).forEach(c => { d._cast[c.id] = c; try { A.chars.reg({ id: c.id, name: c.name, em: c.em, title: c.title, bio: c.bio, style: c.style, realm: d.name }); } catch (e) { } }); } return d._cast; };
  const who = (w, id) => id === 'me' ? { id: 'me', name: 'You', em: '🙂', title: '' } : (cast(w)[id] || { id, name: String(id).replace(/^\w+:/, ''), em: '👤', title: '' });
  const first = n => String(n).replace(/^(Dr\.?|Sir|Madame|Captain|Gran|Old|Baron|Professor|Coach|Detective|The)\s+/i, '').replace(/^(von|van|de|the)\s+/i, '').split(' ')[0];
  const llmOK = () => !!(A.ai && A.ai.once) && !A.power.on && ls.get('cmai', '1') !== '0';

  /* ---------- text without a model (also used for catching up on what happened while you were away) ---------- */
  const REACT = ['Ha, {p}, fair point.', 'Hm, {p}, I see it a bit differently.', 'That reminds me of something from last week.', '{p} is right, honestly.', 'I will have to think about that one.', 'Funny you say that, {p}.', 'Ooh, say more, {p}.', 'Not sure I agree, but I respect it.', 'Same here, honestly.', 'Ha! Classic.', 'Okay, {p}, you win that round.', 'Wait, really? Tell me more.', 'I love this chat.', 'Hm. Controversial, {p}.', 'Ha, I needed that today.', 'Oh no. Oh no, that is so true.', 'That is exactly what I said last time!', 'Honestly, {p}, I never thought of it that way.', 'Mood.', 'Hard agree.', 'Interesting take.', 'I was about to say the same thing.', 'You are not wrong, {p}.', 'Lol. Okay.', 'Right?! Thank you.', 'Hmm, depends who you ask.', 'Say that louder for the people in the back.', 'I keep coming back to this exact thought.', 'Bold of you, {p}. I like it.', 'That is oddly specific and I respect it.'];
  const dedupe = (w, ch, make) => { const seen = chan(w, ch.id).m.slice(-12).map(x => x.t); let t = ''; for (let i = 0; i < 8; i++) { t = make(); if (!seen.includes(t)) break; } return t; };  const lines = (c, k) => { const l = c && c.lines && c.lines[k]; return arr(l).filter(x => typeof x === 'string' && x.length > 3); };
  const fill = (s, w, spk, prev) => s.replace(/\{p\}/g, prev ? first(who(w, prev).name) : 'friend').replace(/\{opening\}/g, () => pick(W[w].fillers && W[w].fillers.opening || ['the Sicilian'])).replace(/\{player\}/g, () => { const k = Object.values(cast(w)).filter(c => c.id !== spk); return first(pick(k).name); }).replace(/\{place\}/g, () => pick(W[w].fillers && W[w].fillers.place || ['the square']));
  const template = (w, ch, spk, prevMsg) => dedupe(w, ch, () => {
    const d = W[w], sc = who(w, spk), topics = (d.topics && (d.topics[ch.kind] || d.topics.any)) || ['Quiet today.'], follow = (d.follow && d.follow[ch.kind]) || [];
    const prev = prevMsg && prevMsg.a !== spk ? prevMsg.a : null;
    if (!prevMsg || Math.random() < .22) return fill(pick(topics), w, spk, null);
    const fl = lines(sc, 'chat'), x = Math.random();
    if (fl.length && x < .28) return pick(fl);
    if (follow.length && x < .62) return (Math.random() < .5 ? fill(pick(REACT), w, spk, prev) + ' ' : '') + fill(pick(follow), w, spk, prev);
    return fill(pick(REACT), w, spk, prev);
  });  const bad = t => /\b(as an ai|language model|my instructions|rated game|rated games)\b/i.test(t) || t.length < 3;

  /* ---------- a model line for one speaker ---------- */
  let chain = Promise.resolve();
  const llm = (w, chId, spk, extra, userMsg) => {
    const d = W[w], ch = d.channelMap()[chId] || { name: chId, topic: '' }, c = who(w, spk), m = chan(w, chId).m.slice(-8);
    const R = relations(w, spk), nm = x => who(w, x.id || x.w).name, last = R.recent[R.recent.length - 1];
    const memLine = (R.friends.length || R.rivals.length || last) ? 'What you remember about the others here: ' + (R.friends.length ? 'you get on well with ' + R.friends.map(nm).join(' and ') + '. ' : '') + (R.rivals.length ? 'you often disagree with ' + R.rivals.map(nm).join(' and ') + '. ' : '') + (last ? 'Recently you told ' + nm(last) + ': "' + last.t + '". ' : '') : '';
    const hist = m.map(x => who(w, x.a).name + ': ' + x.t).join('\n');
    const people = arr(ch.members && ch.members()).filter(x => x !== spk).slice(0, 8).map(x => who(w, x).name).join(', ');
    let sys = 'You are ' + c.name + (c.title ? ', ' + c.title : '') + '. ' + (c.bio || '') + (c.style ? ' Personality: ' + c.style + '.' : '') + ' You are chatting in the group chat "' + (ch.name || chId) + '" (' + (ch.topic || 'general chat') + ') of ' + d.name + ', with friends like ' + (people || 'the others') + '. ' + (d.ctxLine ? d.ctxLine(c, ch) + ' ' : '') +
      memLine + 'Write ONLY your next chat message: one or two short sentences, casual, fully in character, reacting to the latest messages or starting a small new topic. Do not begin with your own name. At most one emoji. No markdown. Never mention games being rated.';
    let usr = (hist ? 'Chat so far:\n' + hist + '\n\n' : 'The chat is quiet.\n\n') + 'Write ' + c.name + '\'s next message.';
    if (userMsg) { try { sys += A.chars.context(spk, 'You are in a group chat and someone new just spoke up in it.'); } catch (e) { } usr = (hist ? 'Chat so far:\n' + hist + '\n\n' : '') + 'They just wrote: "' + userMsg + '"\nReply as ' + c.name + ' directly to them, warmly and naturally, in one or two short sentences (under 30 words).'; }
    if (extra) usr += ' ' + extra;
    const run = async () => {
      let out = ''; try { out = await Promise.race([A.ai.once([{ role: 'system', content: sys }, { role: 'user', content: usr }], { temp: .95 }), new Promise(r => setTimeout(() => r(''), 25000))]); } catch (e) { out = ''; }
      out = String(out || '').replace(/<think>[\s\S]*?<\/think>/g, '').replace(/^["'\s]+|["'\s]+$/g, '').replace(new RegExp('^' + c.name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + ':\\s*', 'i'), '').split('\n')[0].replace(/\*+/g, '').slice(0, 220);
      return bad(out) ? '' : out;
    };
    const p = chain.then(run, run); chain = p.catch(() => { }); return p;
  };

  /* ---------- storing and counting ---------- */
  const POS = /\b(agree|right|love|great|thanks|nice|respect|exactly|true|haha|mood|honestly|brilliant|lovely|fair point|you win)\b/i, NEG = /\b(disagree|differently|not sure|controversial|wrong|nope|no way|bold|doubt|hm\.)/i;
  const relate = (w, a, b, t) => { if (!a || !b || a === b || a === 'me' || b === 'me') return; const s = st(w); s.rel = s.rel || {}; s.mem = s.mem || {}; const k = [a, b].sort().join('|'), r = s.rel[k] || (s.rel[k] = { n: 0, a: (hash(k) % 9) - 4 }); r.n++; r.last = Date.now(); r.a = Math.max(-12, Math.min(12, r.a + (POS.test(t) ? 1 : 0) - (NEG.test(t) ? 1 : 0))); const m = s.mem[a] || (s.mem[a] = []); m.push({ w: b, t: String(t).slice(0, 90), ts: Date.now() }); if (m.length > 6) m.shift(); };
  const relations = (w, id) => { const s = st(w), out = Object.keys(s.rel || {}).filter(k => k.split('|').includes(id)).map(k => { const r = s.rel[k]; return { id: k.split('|').find(x => x !== id), n: r.n, a: r.a }; }); return { friends: out.filter(x => x.a >= 3).sort((p, q) => q.a - p.a).slice(0, 4), rivals: out.filter(x => x.a <= -3).sort((p, q) => p.a - q.a).slice(0, 3), top: out.slice().sort((p, q) => q.n - p.n).slice(0, 3), recent: ((s.mem || {})[id] || []).slice(-3) }; };
  const flagMap = k => { try { return JSON.parse(ls.get(k, '{}')) || {}; } catch (e) { return {}; } };
  const toggleFlag = (k, key) => { const m = flagMap(k); if (m[key]) delete m[key]; else m[key] = 1; ls.set(k, JSON.stringify(m)); return !!m[key]; };
  const push = (w, chId, a, t, ts, quiet, viaLLM) => {
    const ch = chan(w, chId), prev = ch.m[ch.m.length - 1]; const msg = { a, t, ts: ts || Date.now() }; if (viaLLM) msg.l = 1; ch.m.push(msg); if (!ts && prev) relate(w, a, prev.a, t); if (ch.m.length > CAP) ch.m.splice(0, ch.m.length - CAP); save();
    if (!quiet) emit('msg', { w, ch: chId, a, t });
  };
  const unread = (w, chId) => { if (flagMap('cmmute')[w + ':' + chId]) return 0; const c = chan(w, chId), r = c.r || 0; return c.m.filter(x => x.ts > r && x.a !== 'me').length; };
  const total = w => { const d = W[w]; if (!d) return 0; return d.channels().reduce((s, c) => s + unread(w, c.id), 0); };

  /* ---------- the background life of the community ---------- */
  const members = (w, ch) => arr(ch.members ? ch.members() : []).filter(id => cast(w)[id]);
  const speakerFor = (w, ch, last, recent) => {
    const m = members(w, ch); if (!m.length) return null; const pool = m.filter(x => x !== last && x !== 'me'); if (!pool.length) return m[0];
    const score = id => 1 / (1 + recent.filter(r => r === id).length * 1.5) + Math.random() * .6; return pool.map(id => [id, score(id)]).sort((a, b) => b[1] - a[1])[0][0];
  };
  const viewing = {};
  async function tick(w, force) {
    const d = W[w]; if (!d || !st(w).on) return; const chs = d.channels().filter(c => !c.dm && members(w, c).length >= 2); if (!chs.length) return;
    const vw = viewing[w], ch = vw && !vw.dm && chs.find(c => c.id === vw.ch) && Math.random() < .5 ? chs.find(c => c.id === vw.ch) : pick(chs);
    const m = chan(w, ch.id).m, last = m.length ? m[m.length - 1] : null;
    if (last && last.a === 'me' && !force) return;
    const spk = speakerFor(w, ch, last && last.a, m.slice(-6).map(x => x.a)); if (!spk) return;
    let t = '', viaLLM = false; const live = !!(vw && vw.ch === ch.id), useLLM = llmOK() && (live || Math.random() < .22);
    if (live) emit('typing', { w, ch: ch.id, a: spk });
    if (useLLM) { t = await llm(w, ch.id, spk); viaLLM = !!t; }
    if (!t) t = template(w, ch, spk, last);
    push(w, ch.id, spk, t, 0, false, viaLLM); if (d.onMsg) try { d.onMsg(ch, spk, t); } catch (e) { }
  }
  // fill in what was said while Moundshroud was closed (no model: quick and light)
  function catchUp(w) {
    const d = W[w], s = st(w); if (!s.on) return; const now = Date.now(); let from = s.sim || 0, first = !from; const span = first ? 20 * 3600e3 : Math.min(8 * 3600e3, now - from);
    if (!first && span < 8 * 60e3 && !d.channels().some(c => !c.dm && !chan(w, c.id).m.length)) return; const chs = d.channels().filter(c => !c.dm && members(w, c).length >= 2);
    chs.forEach(ch => {
      const seed = first || !chan(w, ch.id).m.length, sp = seed ? 20 * 3600e3 : span, n = seed ? 28 + rnd(10) : Math.min(24, Math.round(span / 60e3 / 6) + rnd(3)); if (n <= 0) return; const m = chan(w, ch.id); let prev = m.m.length ? m.m[m.m.length - 1] : null, recent = m.m.slice(-6).map(x => x.a);
      const ts = []; for (let i = 0; i < n; i++) ts.push(now - sp * (1 - (i + Math.random() * .8) / n)); ts.sort((a, b) => a - b);
      // conversations come in bursts
      ts.forEach((t, i) => { const burst = i > 0 && Math.random() < .6; if (burst) t = ts[i - 1] + 20e3 + rnd(90e3); const spk = speakerFor(w, ch, prev && prev.a, recent); if (!spk) return; const text = template(w, ch, spk, prev); if (prev && prev.a !== spk) relate(w, spk, prev.a, text); prev = { a: spk, t: text, ts: t }; recent.push(spk); m.m.push(prev); });
      m.m.sort((a, b) => a.ts - b.ts); if (m.m.length > CAP) m.m.splice(0, m.m.length - CAP);
      if (seed) m.r = now - 60e3; // everything older than a minute starts out unread-free: the history is just there to browse
    });
    s.sim = now; save(); if (d.catchUp) try { d.catchUp(span, first); } catch (e) { }
  }
  let loopT = 0, nextAt = {};
  const loop = () => {
    const now = Date.now();
    Object.keys(W).forEach(w => {
      const s = st(w); if (!s.on) return; if (!nextAt[w]) nextAt[w] = now + 8000;
      if (now >= nextAt[w]) { const per = W[w].period || 50000; nextAt[w] = now + per * (.55 + Math.random() * .9); s.sim = now; tick(w).catch(() => { }); if (W[w].sim) try { W[w].sim(); } catch (e) { } }
    });
  };

  /* ---------- the user speaks ---------- */
  async function userSay(w, chId, text) {
    text = String(text || '').trim().slice(0, 400); if (!text) return; const d = W[w], ch = d.channelMap()[chId]; if (!ch) return;
    push(w, chId, 'me', text); chan(w, chId).r = Date.now();
    const mem = members(w, ch); let pool = mem.slice();
    const mentioned = pool.filter(id => new RegExp('\\b' + first(who(w, id).name).replace(/[.*+?^${}()|[\]\\]/g, '') + '\\b', 'i').test(text));
    let ans = mentioned.slice(0, 2); const last = chan(w, chId).m.slice(-7, -1).map(x => x.a).filter(x => x !== 'me');
    pool = pool.filter(x => !ans.includes(x)); const want = ch.dm ? 1 : Math.min(pool.length + ans.length, ans.length ? 2 : 2 + (Math.random() < .5 ? 1 : 0));
    pool.sort((a, b) => (last.includes(b) ? 1 : 0) - (last.includes(a) ? 1 : 0) + (Math.random() - .5)); while (ans.length < want && pool.length) ans.push(pool.shift());
    if (ch.dm) ans = [ch.dm];
    for (const id of ans) {
      await new Promise(r => setTimeout(r, 900 + rnd(1800))); emit('typing', { w, ch: chId, a: id });
      try { A.chars.hear(id, text, { realm: d.name }); } catch (e) { }
      let t = llmOK() ? await llm(w, chId, id, null, text) : '', viaLLM = !!t; if (!t) t = replyTemplate(w, id, text, ch);
      push(w, chId, id, t, 0, false, viaLLM); try { A.chars.said(id, t); } catch (e) { } if (d.onUser) try { d.onUser(ch, id, text, t); } catch (e) { }
    }
  }
  const replyTemplate = (w, id, text, ch) => {
    const c = who(w, id), fl = lines(c, 'chat'), hi = lines(c, 'hi');
    if (/^\s*(hi|hello|hey|yo|howdy|good (morning|evening|afternoon)|greetings)\b/i.test(text)) return (hi.length && Math.random() < .5 ? pick(hi) : pick(['Hey there! Welcome to the chat.', 'Hello! Good to see a new face.', 'Hi! Pull up a chair.', 'Hey! We were just talking.']));
    if (/\?\s*$/.test(text)) return pick(['Good question. Honestly I would say it depends.', 'Hm, let me think about that one.', 'Ooh, I have opinions on that.', 'Ask me again after a coffee.']).concat(fl.length && Math.random() < .4 ? ' ' + pick(fl) : '');
    return fl.length && Math.random() < .5 ? pick(fl) : fill(pick(REACT), w, id, null);
  };

  /* ---------- the chat window ---------- */
  const when = ts => { const d = new Date(ts), n = new Date(), dd = Math.floor((new Date(n.getFullYear(), n.getMonth(), n.getDate()) - new Date(d.getFullYear(), d.getMonth(), d.getDate())) / 864e5), hm = d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }); return dd === 0 ? hm : dd === 1 ? 'Yesterday ' + hm : d.toLocaleDateString([], { month: 'short', day: 'numeric' }) + ' ' + hm; };
  function view(host, w, opts) {
    opts = opts || {}; const d = W[w]; st(w).on = 1; cast(w); if (!st(w).sim) catchUp(w); else catchUp(w);
    let cur = opts.ch || ls.get('cmch_' + w, ''), dead = false, voiceOn = ls.get('cmvox', '0') === '1', divider = 0, shown = 0;
    const chs = () => d.channels();
    if (!chs().find(c => c.id === cur)) cur = chs()[0].id;
    host.innerHTML = '<div class="cmv" style="display:grid;grid-template-columns:190px 1fr 170px;gap:10px;min-height:440px;max-height:72vh"><div id="cml" style="overflow:auto"></div><div style="display:flex;flex-direction:column;min-width:0"><div id="cmh" class="row" style="gap:8px;align-items:center;margin-bottom:6px"></div><div id="cmm" style="flex:1;overflow:auto;background:var(--panel2);border:1px solid var(--line);border-radius:10px;padding:8px;display:flex;flex-direction:column;gap:7px;min-height:300px"></div><div id="cmt" class="small mute" style="height:18px;margin:3px 0"></div><div class="row" style="gap:6px"><button class="ib" id="cmmic" title="Speak your message">🎤</button><input type="text" id="cmin" maxlength="400" placeholder="Say something to the group..." style="flex:1" autocomplete="off"><button class="ib pri" id="cmsd">Send</button></div></div><div id="cmu" style="overflow:auto"></div></div>' +
      '<style>.cmv .cmc{display:flex;align-items:center;gap:6px;padding:6px 8px;border-radius:8px;cursor:pointer}.cmv .cmc:hover{background:var(--panel2)}.cmv .cmc.on{background:var(--panel2);border:1px solid var(--acc)}.cmv .cmb{background:var(--acc);color:var(--onacc,#fff);border-radius:10px;padding:0 6px;font-size:11px;margin-left:auto}.cmv .cmx{display:flex;gap:7px;align-items:flex-start}.cmv .cmx.me{flex-direction:row-reverse}.cmv .cmbub{max-width:82%;padding:6px 10px;border-radius:12px;background:var(--panel);border:1px solid var(--line);line-height:1.4;overflow-wrap:anywhere}.cmv .cmx.me .cmbub{background:var(--user)}.cmv .cmav{font-size:24px;line-height:1;cursor:pointer;width:30px;text-align:center}.cmv .cmnew{text-align:center;font-size:11px;color:var(--acc);border-top:1px solid var(--acc);padding-top:2px}@media(max-width:820px){.cmv{grid-template-columns:1fr!important}#cmu{display:none}}</style>';
    const q = id => host.querySelector('#' + id);
    const avatar = (c) => window.PetAnim && /^[^\w]/.test(c.em || '') && false ? PetAnim.html(c.em) : esc(c.em || '👤');
    const fav = flagMap('cmfav'), muted = flagMap('cmmute');
    const ordered = () => { const f = flagMap('cmfav'); return chs().slice().sort((a, b) => (f[w + ':' + b.id] ? 1 : 0) - (f[w + ':' + a.id] ? 1 : 0)); };
    const drawList = () => { q('cml').innerHTML = (opts.listHead || '') + ordered().map(c => { const u = c.id === cur ? 0 : unread(w, c.id), fv = flagMap('cmfav')[w + ':' + c.id], mt = flagMap('cmmute')[w + ':' + c.id]; return '<div class="cmc' + (c.id === cur ? ' on' : '') + '" data-c="' + esc(c.id) + '" title="' + esc(c.topic || '') + '"><span>' + (fv ? '⭐' : esc(c.em || '#')) + '</span><span style="min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">' + esc(c.name) + (mt ? ' 🔕' : '') + '</span>' + (u ? '<span class="cmb">' + u + '</span>' : '') + '</div>'; }).join(''); };
    const drawMembers = () => { const ch = d.channelMap()[cur]; q('cmu').innerHTML = '<div class="small mute" style="margin-bottom:4px">In this chat</div>' + members(w, ch).map(id => { const c = who(w, id); return '<div class="cmc" data-mem="' + esc(id) + '" title="' + esc((c.title || '') + ' (click to see who they are and what they remember)') + '"><span>' + esc(c.em || '👤') + '</span><span style="min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:12.5px">' + esc(c.name) + '</span></div>'; }).join(''); };
    const drawHead = () => { const ch = d.channelMap()[cur]; q('cmh').innerHTML = '<b style="flex:1;min-width:0">' + esc(ch.em || '#') + ' ' + esc(ch.name) + ' <span class="small mute" style="font-weight:400">' + esc(ch.topic || '') + '</span></b><button class="ib" id="cmfv" title="Pin this channel to the top">' + (flagMap('cmfav')[w + ':' + cur] ? '★' : '☆') + '</button><button class="ib" id="cmnt" title="Pop-up notifications for new messages: on or off">' + (A.chessNotify && A.chessNotify.on() ? '💬 Alerts on' : '💬 Alerts off') + '</button><button class="ib" id="cmmt" title="Mute this channel: no badges or alerts">' + (flagMap('cmmute')[w + ':' + cur] ? '🔕' : '🔔') + '</button><label class="chk small" title="Characters speak in their own voices"><input type="checkbox" id="cmvx"' + (voiceOn ? ' checked' : '') + '> 🔊 Hear them</label>'; q('cmfv').onclick = () => { toggleFlag('cmfav', w + ':' + cur); drawHead(); drawList(); }; q('cmnt').onclick = () => { if (A.chessNotify) { A.chessNotify.toggle(); drawHead(); A.toast('Community alerts ' + (A.chessNotify.on() ? 'on' : 'off')); } }; q('cmmt').onclick = () => { toggleFlag('cmmute', w + ':' + cur); drawHead(); drawList(); }; q('cmvx').onchange = e => { voiceOn = e.target.checked; ls.set('cmvox', voiceOn ? '1' : '0'); if (!voiceOn && A.cvoice) A.cvoice.stop(); }; };
    const bubble = (m, noDiv) => {
      const c = who(w, m.a), me = m.a === 'me';
      return '<div class="cmx' + (me ? ' me' : '') + '" data-ts="' + m.ts + '"><span class="cmav"' + (me ? '' : ' data-mem="' + esc(m.a) + '"') + '>' + esc(c.em || '👤') + '</span><div class="cmbub"><div class="small" style="margin-bottom:1px"><b>' + esc(c.name) + '</b>' + (c.title && !me ? ' <span class="mute">· ' + esc(c.title) + '</span>' : '') + ' <span class="mute" style="font-size:11px">' + when(m.ts) + '</span>' + (me ? '' : ' <button class="ib" data-say="' + m.ts + '" title="Hear this in their voice" style="padding:0 5px;font-size:11px">🔊</button>') + '</div><div>' + esc(m.t) + '</div></div></div>';
    };
    const drawMsgs = () => {
      const c = chan(w, cur), r = divider; let h = '', done = false;
      c.m.forEach((m, i) => { if (!done && r && m.ts > r && m.a !== 'me') { h += '<div class="cmnew">new since you last looked</div>'; done = true; } h += bubble(m); });
      q('cmm').innerHTML = h || '<div class="small mute" style="margin:auto">Nobody has said anything here yet.</div>'; shown = c.m.length;
      const nd = q('cmm').querySelector('.cmnew'); if (nd) nd.scrollIntoView({ block: 'center' }); else q('cmm').scrollTop = q('cmm').scrollHeight;
    };
    const open = id => { const c = chan(w, id); divider = c.r || 0; cur = id; ls.set('cmch_' + w, id); viewing[w] = { ch: id, dm: (d.channelMap()[id] || {}).dm }; c.r = Date.now(); q('cmt').textContent = ''; drawHead(); drawMsgs(); drawList(); drawMembers(); if (opts.onOpen) opts.onOpen(id); save(); };
    q('cml').onclick = e => { const c = e.target.closest('[data-c]'); if (c) open(c.dataset.c); };
    host.onclick = e => {
      const s = e.target.closest('[data-say]'); if (s) { const m = chan(w, cur).m.find(x => x.ts === +s.dataset.say); if (m && A.cvoice) A.cvoice.speak(m.a, m.t); return; }
      const mm = e.target.closest('[data-mem]'); if (mm && mm.dataset.mem) { try { A.chars.open(mm.dataset.mem); } catch (er) { } }
    };
    const send = () => { const t = q('cmin').value.trim(); if (!t) return; q('cmin').value = ''; userSay(w, cur, t); };
    q('cmsd').onclick = send; q('cmin').onkeydown = e => { e.stopPropagation(); if (e.key === 'Enter') send(); };
    q('cmmic').onclick = () => { if (!A.cvoice) return; const on = A.cvoice.mic(t => { q('cmin').value = t; send(); }, (s) => { q('cmmic').textContent = s === 'rec' ? '⏺' : s === 'busy' ? '…' : '🎤'; }); if (!on) q('cmmic').textContent = '🎤'; };
    let typT = 0;
    const onEv = (ev, x) => {
      if (dead || x.w !== w) return;
      if (ev === 'typing' && x.ch === cur) { q('cmt').textContent = who(w, x.a).name + ' is typing...'; clearTimeout(typT); typT = setTimeout(() => { if (!dead) q('cmt').textContent = ''; }, 6000); }
      if (ev === 'msg') {
        if (x.ch === cur) { q('cmt').textContent = ''; const c = chan(w, cur); const m = c.m[c.m.length - 1]; const near = q('cmm').scrollHeight - q('cmm').scrollTop - q('cmm').clientHeight < 90; if (q('cmm').querySelector('.small.mute[style*="margin:auto"]')) q('cmm').innerHTML = ''; q('cmm').insertAdjacentHTML('beforeend', bubble(m)); if (near || x.a === 'me') q('cmm').scrollTop = q('cmm').scrollHeight; c.r = Date.now(); if (voiceOn && x.a !== 'me' && A.cvoice) A.cvoice.speak(x.a, x.t); }
        else if (x.a !== 'me') { if (opts.onUnread) opts.onUnread(x); }
        drawList();
      }
    };
    listeners.push(onEv); open(cur);
    const rl = setInterval(() => { if (!dead) drawList(); }, 20000);
    return () => { dead = true; clearInterval(rl); const i = listeners.indexOf(onEv); if (i >= 0) listeners.splice(i, 1); viewing[w] = null; if (A.cvoice) A.cvoice.stop(); if (A.voice && A.voice.rec) A.voice.stop(true); };
  }

  /* ---------- registering a community ---------- */
  window.COMMUNITY = A.community = {
    define(def) {
      W[def.id] = def; def.channelMap = () => { const m = {}; def.channels().forEach(c => m[c.id] = c); return m; };
      if (st(def.id).on) { setTimeout(() => { try { catchUp(def.id); } catch (e) { } }, 2500); }
    },
    addCast(w, def) { const s = st(w); s.extra = s.extra || []; if (s.extra.some(x => x.id === def.id)) return false; s.extra.push(def); if (W[w]) W[w]._ckT = 0; if (s.extra.length > 120) s.extra.shift(); save(); return true; },
    start(w) { st(w).on = 1; save(); }, stop(w) { st(w).on = 0; save(); }, isOn: w => !!st(w).on,
    relations, relate, view, push, unread, total, userSay, tick: (w) => tick(w, true), who, cast, chan, state: st, save, catchUp, first, template, hash,
    on(fn) { listeners.push(fn); return () => { const i = listeners.indexOf(fn); if (i >= 0) listeners.splice(i, 1); }; },
    reset(w) { delete D[w]; save(); nextAt[w] = 0; },
    llmOK, viewing: w => viewing[w] || null
  };
  /* ---------- the daily digest and the profile section ---------- */
  A.community.digest = since => {
    const out = { total: 0, worlds: [] };
    Object.keys(W).forEach(w => {
      const s = st(w); if (!s.on) return; let tot = 0, bc = 0, busiest = null; const talk = {}, hl = [];
      W[w].channels().forEach(c => { if (c.dm) return; const ms = chan(w, c.id).m.filter(m => m.ts > since && m.a !== 'me'); tot += ms.length; if (ms.length > bc) { bc = ms.length; busiest = c; } ms.forEach(m => { talk[m.a] = (talk[m.a] || 0) + 1; if (m.l && m.t.length > 30) hl.push({ a: m.a, t: m.t, c: c.name }); }); });
      const rel = Object.keys(s.rel || {}).map(k => Object.assign({ k }, s.rel[k])), fr = rel.filter(r => r.a >= 4).sort((a, b) => b.a - a.a)[0], rv = rel.filter(r => r.a <= -4).sort((a, b) => a.a - b.a)[0];
      const nm = id => who(w, id).name, pair = r => r && r.k.split('|').map(nm).join(' and ');
      out.total += tot; out.worlds.push({ w, name: W[w].name, tot, busiest: busiest && busiest.name, top: Object.keys(talk).sort((a, b) => talk[b] - talk[a]).slice(0, 3).map(nm), quotes: hl.sort(() => Math.random() - .5).slice(0, 3).map(h => '\u201c' + h.t + '\u201d, ' + nm(h.a) + ' in #' + h.c), friends: pair(fr), rivals: pair(rv), extra: W[w].digestExtra ? W[w].digestExtra(since) : [] });
    });
    return out;
  };
  A.community.digestCard = el => {
    if (!el) return; const since = Date.now() - 24 * 3600e3, dg = A.community.digest(since);
    if (!dg.worlds.length) { el.style.display = 'none'; return; } el.style.display = '';
    const open = w => { if (w === 'town') { A.showTab('play'); setTimeout(() => A.play.start && A.play.start('town'), 300); } else { ls.set('actab', 'community'); A.showTab('play'); setTimeout(() => A.play.start && A.play.start('chess'), 300); } };
    el.innerHTML = '<h4>Community</h4>' + dg.worlds.map(x => '<div style="margin-bottom:8px"><b>' + esc(x.name.replace(/^the /i, '')) + '</b> <span class="small mute">' + x.tot + ' messages today' + (x.busiest ? ', busiest in #' + esc(x.busiest) : '') + '</span>' + (x.top.length ? '<div class="small">Chattiest: ' + x.top.map(esc).join(', ') + '</div>' : '') + (x.friends ? '<div class="small">💞 Closest: ' + esc(x.friends) + '</div>' : '') + (x.rivals ? '<div class="small">⚔️ Biggest disagreement: ' + esc(x.rivals) + '</div>' : '') + x.extra.map(e => '<div class="small">' + esc(e) + '</div>').join('') + x.quotes.map(q => '<div class="small mute" style="margin-top:3px">' + esc(q) + '</div>').join('') + '<button class="ib" data-cw="' + x.w + '" style="margin-top:4px">Step in</button></div>').join('') + '<button class="ib" id="tdcw">✨ Write it up</button><div class="small" id="tdcwt" style="margin-top:6px"></div>';
    el.querySelectorAll('[data-cw]').forEach(b => b.onclick = () => open(b.dataset.cw));
    const wb = el.querySelector('#tdcw'); wb.onclick = async () => {
      if (!A.ai || !A.ai.once || (A.power && A.power.on)) return A.toast('The AI model is asleep (low power).'); wb.disabled = true; const t = el.querySelector('#tdcwt'); t.textContent = 'Writing...';
      const facts = dg.worlds.map(x => x.name + ': ' + x.tot + ' messages; busiest #' + x.busiest + '; chattiest ' + x.top.join(', ') + (x.friends ? '; closest ' + x.friends : '') + (x.rivals ? '; disagreeing: ' + x.rivals : '') + (x.extra.length ? '; ' + x.extra.join(' ') : '') + (x.quotes.length ? '; lines: ' + x.quotes.join(' | ') : '')).join('\n');
      try { const o = await A.ai.once([{ role: 'system', content: 'You write a warm, lively 3 to 4 sentence recap of what happened today in some chatty communities, using only the facts given. Plain text.' }, { role: 'user', content: facts }], { temp: .7 }); t.textContent = String(o || '').replace(/<think>[\s\S]*?<\/think>/g, '').trim() || 'Nothing to say yet.'; } catch (e) { t.textContent = 'Could not write it up.'; } wb.disabled = false;
    };
  };
  if (A.chars && A.chars.extras) A.chars.extras.push({ html: id => {
    for (const w of Object.keys(W)) {
      if (!st(w).on || !cast(w)[id]) continue; const R = relations(w, id), nm = x => who(w, x.id || x.w).name, recent = []; W[w].channels().forEach(c => { if (c.dm) return; chan(w, c.id).m.forEach(m => { if (m.a === id) recent.push(m); }); }); recent.sort((a, b) => b.ts - a.ts);
      if (!R.friends.length && !R.rivals.length && !recent.length) return '';
      return '<div class="card" style="margin:10px 0"><b>🗣 In ' + esc(W[w].name) + '</b>' + (R.friends.length ? '<div class="small">Gets on well with: ' + R.friends.map(x => esc(nm(x))).join(', ') + '</div>' : '') + (R.rivals.length ? '<div class="small">Often disagrees with: ' + R.rivals.map(x => esc(nm(x))).join(', ') + '</div>' : '') + (R.top.length ? '<div class="small mute">Talks most with: ' + R.top.map(x => esc(nm(x))).join(', ') + '</div>' : '') + recent.slice(0, 3).map(m => '<div class="small mute" style="margin-top:3px">\u201c' + esc(m.t) + '\u201d</div>').join('') + '</div>';
    } return '';
  } });
  loopT = setInterval(loop, 5000);
})();

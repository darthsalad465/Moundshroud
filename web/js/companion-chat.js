// Talk to your buddy: a small chat panel above the companion in the bottom-left corner. Type or press the microphone, and it can do things in Moundshroud for you:
// play a song from the Music library, pause or skip, open any tab, read and analyse the page you are on, review your last chess game with the chess engine
// (the same engine facts the Chess coach uses), and run the same actions the main chat can (quizzes, reminders, notes, documents...).
// House rule: it never talks about rated games. Ask, and it will tease you for it.
(() => {
  const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const pick = a => a[Math.floor(Math.random() * a.length)];
  const RATED = /(?<!un)\brated\b|\branked (games?|matches|play|mode|ladder)\b|\bratings? (games?|matches)\b|\bcompetitive (games?|matches)\b/i;
  const ROAST = ['Rated games? You? Adorable. I have seen you hang a queen in a tutorial. Not going there.', 'Ha! A rated game. Bold. Last I checked your knight was still lost in the parking lot. I do not discuss those.', 'Rated games are not something I talk about, and honestly, your board vision is not something you should either. Go practise.', 'Oh, you want to talk about RATED games. That is very funny. Next question, champ.', 'Nope. Not touching rated games. You still think the horsey moves in straight lines. Try something else!', 'Rated? I am a buddy, not a miracle worker. Ask me about anything else and we will pretend that never happened.', 'You and a rating, in the same sentence? Brave. I am not discussing it, so try a puzzle instead.'];
  const roast = () => pick(ROAST);
  const S = { open: 0, log: [], busy: 0, speak: ls.get('buddy_speak', '0') === '1' };
  let ctl = null, panel = null, logEl = null, inEl = null, micEl = null, nameEl = null, hdrPet = null;

  /* ---------- panel ---------- */
  const css = '#cmpc{position:fixed;left:14px;bottom:76px;z-index:57;width:340px;max-width:calc(100vw - 28px);height:420px;max-height:64vh;background:var(--panel);border:1px solid var(--acc);border-radius:16px;box-shadow:0 14px 40px rgba(0,0,0,.55);display:none;flex-direction:column;overflow:hidden}#cmpc.on{display:flex}#cmpc .h{display:flex;align-items:center;gap:8px;padding:8px 10px;border-bottom:1px solid var(--line);background:var(--panel2)}#cmpc .h b{flex:1;font-size:14px}#cmpc .h button{background:none;border:0;color:var(--mute);cursor:pointer;font-size:16px;padding:2px 6px;border-radius:6px}#cmpc .h button:hover{background:var(--panel);color:var(--text)}#cmpc .lg{flex:1;overflow:auto;padding:10px;display:flex;flex-direction:column;gap:7px;font-size:13.5px;line-height:1.45}#cmpc .m{max-width:90%;padding:7px 10px;border-radius:12px;overflow-wrap:anywhere;white-space:pre-wrap}#cmpc .m.u{align-self:flex-end;background:var(--user)}#cmpc .m.b{align-self:flex-start;background:var(--panel2);border:1px solid var(--line)}#cmpc .m.s{align-self:center;color:var(--mute);font-size:12px;background:none;padding:0}#cmpc .qs{display:flex;flex-wrap:wrap;gap:5px;padding:0 10px 6px}#cmpc .qs button{font-size:12px;padding:3px 8px;border-radius:12px;border:1px solid var(--line);background:var(--panel2);color:var(--text);cursor:pointer}#cmpc .qs button:hover{border-color:var(--acc)}#cmpc .f{display:flex;gap:6px;padding:8px;border-top:1px solid var(--line)}#cmpc .f input{flex:1;min-width:0}#cmpc .f button{padding:6px 10px}#cmpc .mic.rec{background:var(--bad);color:#fff}@media(max-width:700px){#cmpc.on{left:8px;right:8px;width:auto;max-width:none;bottom:70px;height:62vh;max-height:70vh}}';
  const st = document.createElement('style'); st.textContent = css; document.head.appendChild(st);
  function build() {
    if (panel) return; panel = document.createElement('div'); panel.id = 'cmpc';
    panel.innerHTML = '<div class="h"><span id="cch" style="font-size:24px;width:30px;display:inline-flex;justify-content:center"></span><b id="ccn"></b><button id="ccmem" title="Who I am and what I remember about you">🧠</button><button id="ccs" title="Read answers aloud">🔇</button><button id="ccm" title="Options">⋯</button><button id="ccc" title="Close">✕</button></div><div class="lg" id="cclog"></div><div class="qs" id="ccqs"></div><div class="f"><button class="ib mic" id="ccmic" title="Talk (the microphone stays on this PC)">🎤</button><input id="ccin" type="text" placeholder="Ask me anything or tell me what to do..." autocomplete="off"><button class="pri" id="ccgo">Send</button></div>';
    document.body.appendChild(panel); logEl = panel.querySelector('#cclog'); inEl = panel.querySelector('#ccin'); micEl = panel.querySelector('#ccmic'); nameEl = panel.querySelector('#ccn'); hdrPet = panel.querySelector('#cch');
    panel.querySelector('#ccc').onclick = close; panel.querySelector('#ccmem').onclick = () => { try { regBuddy(); A.chars.open(bid()); } catch (e) { } }; panel.querySelector('#ccm').onclick = e => { e.stopPropagation(); A.companion.menu(e.currentTarget); };
    const sp = panel.querySelector('#ccs'); const paintSp = () => { sp.textContent = S.speak ? '🔊' : '🔇'; }; paintSp(); sp.onclick = () => { S.speak = !S.speak; ls.set('buddy_speak', S.speak ? '1' : '0'); paintSp(); if (!S.speak) try { A.speech.stop(); } catch (e) { } else A.toast('I will read my answers aloud.', 2000); };
    panel.querySelector('#ccgo').onclick = () => send(); inEl.onkeydown = e => { e.stopPropagation(); if (e.key === 'Enter') send(); else if (e.key === 'Escape') close(); };
    panel.querySelector('#ccqs').onclick = e => { const b = e.target.closest('[data-q]'); if (b) send(b.dataset.q); };
    micEl.onclick = mic; head();
    addEventListener('companion-change', head);
    addEventListener('click', e => { if (S.open && !e.target.closest('#cmpc,#cmp,#cmpm')) { /* stays open: it is a chat window */ } });
    hello();
  }
  const head = () => { if (!panel) return; const i = A.companion.info(); nameEl.textContent = i.n; if (window.PetAnim) PetAnim.set(hdrPet, i.e); else hdrPet.textContent = i.e; };
  const mood = (m, ms) => { try { A.companion.mood(m, ms); if (window.PetAnim && hdrPet) PetAnim.mood(hdrPet, m, ms); } catch (e) { } };
  const quick = list => { if (!panel) return; panel.querySelector('#ccqs').innerHTML = list.map(q => '<button data-q="' + esc(q) + '">' + esc(q) + '</button>').join(''); };
  const QUICK0 = ['Analyze this page', 'What can you do here?', 'How does this part of the app work?', 'Play something relaxing'];
  function hello() { if (S.log.length) return; add('b', 'Hi, I am ' + A.companion.info().n + '. I can see the page you are on and I know my way around Moundshroud\'s own code, so ask me what anything on screen means or how a part of the app works. I can also do things: play a song, open a tab, analyze this page, review your last chess game, set a reminder, make a quiz.'); quick(QUICK0); }
  function add(who, text) { const d = document.createElement('div'); d.className = 'm ' + who; d.textContent = text; logEl.appendChild(d); logEl.scrollTop = logEl.scrollHeight; if (who !== 's') S.log.push({ role: who === 'u' ? 'user' : 'assistant', content: text }); if (S.log.length > 24) S.log.splice(0, S.log.length - 24); return d; }
  const note = t => add('s', t);
  function open() { build(); S.open = 1; panel.classList.add('on'); setTimeout(() => inEl.focus(), 50); mood('happy', 900); }
  function close() { S.open = 0; if (panel) panel.classList.remove('on'); try { A.speech.stop(); } catch (e) { } if (ctl) ctl.abort(); }
  const toggle = () => (S.open ? close() : open());

  /* ---------- voice ---------- */
  function mic() {
    if (!A.voice || !A.voice.available()) return A.toast('No microphone is available.');
    if (A.voice.rec) { A.voice.stop(); return; }
    A.voice.start(txt => { if (txt && txt.trim()) send(txt.trim()); }, (state) => { micEl.classList.toggle('rec', state === 'rec'); micEl.textContent = state === 'rec' ? '⏹' : state === 'busy' ? '…' : '🎤'; if (state === 'rec') mood('think', 0); else if (state === 'idle') mood(null); }, { auto: true });
  }

  /* ---------- finding things ---------- */
  const norm = s => String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9 ]+/g, ' ').replace(/\s+/g, ' ').trim();
  const GENRE_WORDS = { relax: ['chill', 'sleep', 'calm'], relaxing: ['chill', 'sleep', 'calm'], calm: ['chill', 'sleep', 'calm'], chill: ['chill'], sleep: ['sleep'], focus: ['focus'], study: ['focus'], happy: ['happy'], sad: ['sad'], energetic: ['energy', 'workout', 'happy'], workout: ['workout', 'energy'], epic: ['epic'], dark: ['dark'], romantic: ['romantic'] };
  function findSongs(q) {
    const cat = A.musicLib && A.musicLib.catalog ? A.musicLib.catalog() : []; if (!cat.length) return [];
    const nq = norm(q).replace(/\b(a|an|the|some|any|song|songs|track|tracks|music|by|from|something|me|please|for)\b/g, ' ').replace(/\s+/g, ' ').trim(), toks = nq.split(' ').filter(Boolean);
    if (!toks.length) return cat.slice().sort(() => Math.random() - .5).slice(0, 12);
    const moods = []; toks.forEach(t => (GENRE_WORDS[t] || []).forEach(m => moods.push(m)));
    const scored = cat.map(t => { const title = norm(t.t), art = norm(t.a), alb = norm(t.al), gen = norm(t.g), per = norm(t.p); let s = 0; if (title === nq) s += 100; if (title.includes(nq)) s += 40; toks.forEach(k => { if (title.includes(k)) s += 12; if (art.includes(k)) s += 9; if (per.includes(k)) s += 6; if (alb.includes(k)) s += 5; if (gen.includes(k)) s += 4; }); if (moods.length && t.m) moods.forEach(m => { if (t.m.includes(m)) s += 8; }); return [t, s]; }).filter(x => x[1] > 0).sort((a, b) => b[1] - a[1]);
    if (!scored.length) return []; const top = scored[0][1]; const pool = scored.filter(x => x[1] >= top * .6).map(x => x[0]); return top >= 40 ? pool.slice(0, 1) : pool;
  }
  async function playSong(q) {
    if (!A.musicLib) return 'The music library is not available.'; try { await A.musicLib.ensure(); } catch (e) { } const hits = findSongs(q);
    if (!hits.length) return 'I could not find anything for "' + q + '" in your Music library. Try an artist, a composer, a mood like "chill", or a genre.';
    const t = hits.length > 1 ? pick(hits.slice(0, 8)) : hits[0]; A.musicLib.play(t.i); mood('happy', 2500); return 'Playing **' + t.t + '** by ' + t.a + (t.al ? ' (' + t.al + ')' : '') + '.';
  }
  const TABALIAS = { home: 'home', today: 'home', chat: 'chat', search: 'web', web: 'web', browser: 'web', library: 'lib', lib: 'lib', files: 'files', 'my files': 'files', notes: 'notes', study: 'study', languages: 'lang', language: 'lang', studio: 'studio', tools: 'tools', prepare: 'health', preparedness: 'health', 'first aid': 'health', entertainment: 'play', games: 'play', play: 'play', chess: 'play', music: 'music', spiritual: 'faith', guide: 'guide', help: 'guide' };
  function openTab(name) {
    const n = norm(name).replace(/\b(the|tab|section|page|app|my|please)\b/g, ' ').replace(/\s+/g, ' ').trim(); let id = TABALIAS[n];
    if (!id) { id = Object.keys(A.tabs || {}).find(k => norm(A.tabs[k].label) === n || norm(A.tabs[k].label).includes(n) && n.length > 2); }
    if (!id || !A.tabs[id]) return null; A.showTab(id); if (n === 'chess') setTimeout(() => { try { const b = [...document.querySelectorAll('#p-play button, #p-play .card')].find(x => /chess/i.test(x.textContent)); b && b.click(); } catch (e) { } }, 500); return 'Opened **' + (A.tabs[id].label || id) + '**.';
  }

  /* ---------- the page you are on ---------- */
  /* AppCtx reads only what is really visible (hidden sub-pages and other tabs are left out), so "what am I looking at?"
     is answered about the screen in front of you and not about the whole section. */
  function pageText() {
    if (window.AppCtx) { const p = AppCtx.page(); return { label: p.label, text: p.text.slice(0, 6500), controls: p.controls, inner: p.inner }; }
    const p = document.getElementById('p-' + A.cur) || document.querySelector('.panel.on') || document.body; const label = (A.tabs[A.cur] && A.tabs[A.cur].label) || A.cur;
    const clone = p.cloneNode(true); clone.querySelectorAll('script,style,svg,canvas,#cmpc,#cmp,.acb,.tour,[data-private]').forEach(e => e.remove()); let t = (clone.innerText || clone.textContent || '').replace(/\n{3,}/g, '\n\n').replace(/[ \t]+/g, ' ').trim();
    return { label, text: t.slice(0, 6500), controls: [], inner: [] };
  }
  /* what is on screen, in the form the model reads best */
  const pageBlock = cap => {
    const p = pageText(); if (!p.text) return '';
    return 'The user is on the "' + p.label + '" tab' + (p.inner && p.inner.length ? ' (' + p.inner.join(' > ') + ')' : '') + '. On screen now:\n"""\n' + p.text.slice(0, cap || 1600) + '\n"""' + (p.controls && p.controls.length ? '\nButtons and fields visible: ' + p.controls.slice(0, 20).join(' | ') : '');
  };
  /* the app's own source, for questions about Moundshroud itself */
  const codeBlock = async q => { try { if (!window.AppCtx || !AppCtx.about(q)) return ''; const c = await AppCtx.context(q); return c ? 'Excerpts from Moundshroud\'s own files (real code - name the file when you use it):\n' + c.slice(0, 3600) : ''; } catch (e) { return ''; } };
  /* your own notes, files and the offline library, when the question points at them */
  const stuffBlock = async q => {
    if (!/\b(my|mine|i (wrote|saved|added|typed)|in my|from my|our)\b/i.test(q)) return '';
    let out = '';
    try { const d = await A.api('/api/docs/search', { q: q, n: 4 }); (d.results || []).forEach((x, i) => { out += '\n[' + (i + 1) + '] ' + x.title + (x.page ? ' p.' + x.page : '') + ': ' + String(x.text || '').slice(0, 700); }); if (out) out = 'From the user\'s own files and notes:' + out; } catch (e) { }
    try { if (A.caps && A.caps.lib) { const l = await A.api('/api/lib/context', { q: q, n: 3 }); (l.sources || []).forEach((x, i) => { out += '\n* ' + x.title + (x.book ? ' (' + x.book + ')' : '') + ': ' + String(x.text || '').slice(0, 500); }); } } catch (e) { }
    return out;
  };
  /* the internet, when the user turned it on in Settings: real pages, read just now, exactly like the main chat */
  const webBlock = async q => {
    try {
      if (!A.net || !A.net.on()) return '';
      /* a question about this app or this screen is answered from the app's own files, not from the web */
      const aboutUs = /\b(this|the)\s+(page|screen|tab|app|button|setting|chart|panel)\b|\bmoundshroud\b|\byou(r| are)\b/i.test(q) && !/\b(latest|newest|news|release|version out|on the web|online|search (the )?web)\b/i.test(q);
      if (aboutUs) return '';
      /* only when the question is really asking for a fact that could have moved on since training */
      if (!/\?|\b(who|whom|whose|when|where|which|how much|how many|latest|newest|current|currently|today|tonight|news|price|cost|score|result|released?|version|weather|forecast|election|died|born|opening hours|schedule|standing|rank(ed|ing)?)\b/i.test(q)) return '';
      const r = await A.net.lookup(q);
      if (!r || r.error || !(r.pages || []).length) return '';
      const out = (r.pages || []).slice(0, 2).map((p, i) => '[' + (i + 1) + '] ' + (p.title || p.url) + ' - ' + p.url + '\n' + String(p.text || '').slice(0, 2600)).join('\n\n');
      return 'Read from the internet a moment ago (real pages, just now). Prefer these for anything that could have changed since you were trained, and name the site when you use one:\n' + out;
    } catch (e) { return ''; }
  };
  /* everything the buddy knows before it answers: the screen, the app's code, the user's own things, and the web */
  async function ground(q) {
    const parts = [];
    try { const pg = pageBlock(1500); if (pg) parts.push(pg); } catch (e) { }
    try { const c = await codeBlock(q); if (c) parts.push(c); } catch (e) { }
    try { const s = await stuffBlock(q); if (s) parts.push(s); } catch (e) { }
    try { const w = await webBlock(q); if (w) parts.push(w); } catch (e) { }
    return parts.length ? '\n\n' + parts.join('\n\n') : '';
  }
  async function analyzePage(extra) {
    const pg = pageText(); if (pg.text.length < 30) return 'There is not much text on this page for me to analyse. Try asking about something specific.';
    const sys = persona() + ' The user asked you to look at the page they are on. Be concrete: say what the page is, the key points or data on it, anything that stands out, and what they could do next. Use short paragraphs or a few bullets. Under 170 words.';
    const ctrl = pg.controls && pg.controls.length ? '\nButtons and fields on it: ' + pg.controls.slice(0, 24).join(' | ') : '';
    return await ask([{ role: 'system', content: sys }, { role: 'user', content: 'Page: the "' + pg.label + '" tab of Moundshroud' + (pg.inner && pg.inner.length ? ' (' + pg.inner.join(' > ') + ')' : '') + '. Text on screen:\n"""\n' + pg.text + '\n"""' + ctrl + '\n' + (extra ? 'My request: ' + extra : 'Analyze this page for me.') }]);
  }

  /* ---------- chess game review with the engine ---------- */
  function sansOf(g) { const C = window.Chess, pos = new C.Pos().setFen(g.startFen || C.START), sans = [], fens = []; for (const u of g.moves) { fens.push(pos.fen()); const m = pos.fromUci(u); if (!m) break; sans.push(pos.san(m)); pos.make(m); } fens.push(pos.fen()); return { sans, fens }; }
  async function reviewGame(text) {
    if (!window.ChessAna || !window.ChessCoach || !window.Chess) return 'The chess tools have not loaded yet. Open the Chess section once and try again.';
    const list = ChessAna.GS.list().filter(g => g.moves && g.moves.length >= 6); if (!list.length) return 'I do not see a finished game to review yet. Play one (Chess > Play or Online) and ask me again.';
    let g = list[0]; const nm = norm(text).replace(/\b(review|analy[sz]e|go over|my|the|game|against|vs|versus|with|last|chess|please|break ?down|critique|coach|match|me|how|did|i|play)\b/g, ' ').trim(); if (nm.length > 2) { const f = list.find(x => norm((x.white || '') + ' ' + (x.black || '')).includes(nm.split(' ')[0])); if (f) g = f; }
    if (g.rated) return roast();
    const mode = ChessAna.MODES.quick; let ana = g.ana && g.ana.rows ? g.ana : null; const fresh = !ana;
    if (!ana) { const prog = add('s', 'Putting the engine on your game against ' + (g.black && g.white ? g.white + ' vs ' + g.black : 'your opponent') + '...'); mood('think', 0); try { ana = await ChessAna.analyzeGame(g, { mode: 'quick', onRow: (i, r, done, N) => { prog.textContent = 'Engine analysis: move ' + done + ' of ' + N + '...'; } }); } catch (e) { ana = null; } prog.remove(); if (!ana) return 'The engine could not finish the analysis. Close other heavy programs and try again.'; try { ChessAna.GS.patch(g.id, { ana }); } catch (e) { } }
    const { sans, fens } = sansOf(g), C = window.Chess;
    const bestSan = (i, u) => { try { const p = new C.Pos().setFen(fens[i]), m = p.fromUci(u); return m ? p.san(m) : null; } catch (e) { return null; } };
    const moments = (ana.summary.moments || []).map(i => ({ n: (i % 2 === 0 ? Math.floor(i / 2) + 1 + '.' : Math.floor(i / 2) + 1 + '...'), san: sans[i], c: ana.rows[i].c, best: ana.rows[i].b && ana.rows[i].b !== g.moves[i] ? bestSan(i, ana.rows[i].b) : null }));
    const facts = ChessCoach.context({ game: g, summary: ana.summary, moments, opening: ana.summary.opening && ana.summary.opening.name ? ana.summary.opening.name : (typeof ana.summary.opening === 'string' ? ana.summary.opening : ''), me: g.me || 0, sans });
    const sys = ChessCoach.SYSTEM + ' You are speaking as ' + A.companion.info().n + ', the user\'s small buddy, so keep a warm, light tone. Give: 1) the story of the game in two sentences, 2) the two or three turning points with why they mattered and what to play instead, 3) one thing they did well, 4) one thing to practise. Under 230 words. Never mention rated games.';
    return await ask([{ role: 'system', content: sys }, { role: 'user', content: 'Engine facts for the game (verified, from the chess engine):\n' + facts + '\n\nReview this game for me.' }], { coach: 1 });
  }

  /* ---------- the model ---------- */
  const bid = () => 'bud:' + A.chars.slug(A.companion.info().n);
  const regBuddy = () => { try { A.companion.buddies().forEach(b => A.chars.reg({ id: 'bud:' + A.chars.slug(b.n), name: b.n, em: b.e, title: 'Your buddy in the corner of Moundshroud', bio: 'A small animated companion who lives in the corner of Moundshroud and follows you around. Helps with music, tabs, quizzes, pages and chess reviews.', realm: 'Moundshroud buddy' })); } catch (e) { } };
  const buddyCtx = () => { try { regBuddy(); return A.chars.context(bid(), 'You live in the corner of Moundshroud and follow the user around the app.'); } catch (e) { return ''; } };
  const persona = () => { const i = A.companion.info(); return 'You are ' + i.n + ', a small friendly ' + i.e + ' buddy who lives in the corner of Moundshroud, a private offline assistant running on the user\'s PC. You are warm, a little playful, and concise (usually 1 to 4 sentences, plain text, no markdown headers). You can see the page the user is on and you can read Moundshroud\'s own source files, so answer questions about what is on screen and about how the app works from those, not from guesswork. You can also do things in the app for the user (play music, open tabs, analyse the page, review chess games, make quizzes, set reminders, save notes, make documents). RULE: you never discuss rated games or ratings of rated games; if the user brings them up, tease them playfully and change the subject.' + (A.net && A.net.on() ? ' Internet access is switched on, so you can look things up on the web: when you use something you just read, say which site it came from.' : '') + buddyCtx(); };
  async function ask(messages, o) {
    o = o || {}; if (ctl) ctl.abort(); ctl = new AbortController(); const d = add('b', '...'); mood('think', 0); let out = '';
    try { const fn = o.coach ? ChessCoach.stream : A.ai.stream; out = await fn(messages, t => { d.textContent = t.replace(/\*\*/g, ''); logEl.scrollTop = logEl.scrollHeight; if (t.length < 12) mood('talk', 0); }, ctl.signal, { temp: o.temp || .5, private: 'screen' }); }      /* the buddy sees the screen and your games: never sent to Claude unless allowed */
    catch (e) { if (e.name === 'AbortError') { d.remove(); return null; } d.textContent = 'My brain (the local AI) did not answer. If graphics memory is full, close other programs or turn on Low-power mode in Settings.'; mood('sad', 3000); return null; }
    out = String(out || '').replace(/\*\*/g, '').trim(); if (RATED.test(out)) out = roast();
    d.remove(); return out || 'Hmm, I drew a blank. Try asking another way?';
  }
  const finish = text => { if (text === null || text === undefined) return; try { A.chars.said(bid(), String(text)); } catch (e) { } add('b', String(text).replace(/\*\*/g, '')); mood('talk', Math.min(4000, 800 + String(text).length * 35)); if (S.speak) try { A.speech.speakAsync(String(text).replace(/\*\*/g, '').slice(0, 600)); } catch (e) { } };

  /* run the same tools the main chat has (quiz, reminder, note, document...) */
  async function toolCall(text) {
    const sel = document.getElementById('model'), model = (sel && sel.value) || ''; const msgs = [{ role: 'system', content: persona() + A.actions.hint }].concat(S.log.slice(-6, -1), [{ role: 'user', content: text }]);
    const r = await fetch('/api/chat', { method: 'POST', body: JSON.stringify({ model, stream: false, think: false, keep_alive: '5m', tools: A.actions.schema, messages: msgs }) }); if (!r.ok) return null;
    const j = await r.json(), calls = (j.message && j.message.tool_calls) || []; if (!calls.length) return null;
    const out = []; for (const c of calls.slice(0, 2)) { try { out.push(await A.actions.run(c.function.name, c.function.arguments)); } catch (e) { out.push('I could not do that: ' + e.message); } } return out.join('\n');
  }

  /* ---------- the brain: rated filter, quick commands, tools, then plain chat ---------- */
  async function handle(raw) {
    const text = raw.trim(); if (!text) return; try { regBuddy(); A.chars.hear(bid(), text, { realm: 'Moundshroud buddy' }); } catch (e) { }
    if (RATED.test(text)) { mood('happy', 3500); return roast(); }
    const t = norm(text);
    let m;
    if (/^(please )?(pause|stop|mute)( the)?( music| song| track| playing)?$/.test(t)) { try { A.musicLib.pause(); } catch (e) { } return 'Paused.'; }
    if (/^(please )?(resume|continue|unpause)( the)?( music| song)?$/.test(t)) { try { A.musicLib.toggle(); } catch (e) { } return 'Playing.'; }
    if (/^(please )?(next|skip)( the)?( song| track| music)?$/.test(t)) { try { A.musicLib.next(); } catch (e) { } return 'Skipped to the next one.'; }
    if ((m = /^(?:(?:hey|ok|okay|please|can you|could you|would you)\s+)*(?:play|put on|queue up|start playing|i want to hear|let me hear)\s+(.+)$/i.exec(text)) && !/\b(chess|game|games|tetris|snake|2048|sudoku|trivia|against|quiz|minesweeper|puzzle)\b/i.test(m[1])) return await playSong(m[1]);
    if (/\b(analy[sz]e|summari[sz]e|explain|read|look at|check|go over|review|what'?s on|what is on|tell me about|what am i looking at)\b.*\b(this|the|current|my)\b.*\b(page|screen|tab|section|view)\b|^what am i looking at|^analy[sz]e (it|this)$/.test(t)) return await analyzePage(text);
    if (/\b(review|analy[sz]e|go over|break ?down|critique|coach me on|how did i (play|do))\b.*\b(game|match|play|moves|chess)\b|^review (it|my game)|how did i play/.test(t) && !/\bpage\b/.test(t)) return await reviewGame(text);
    if ((m = /^(?:(?:hey|ok|okay|please|can you|could you)\s+)*(?:open|go to|take me to|show me|switch to|navigate to)\s+(?:the\s+)?(.+?)$/i.exec(text))) { const r = openTab(m[1]); if (r) return r; }
    if (/^what can you do|^help$|^what do you do/.test(t)) return 'I can play a song from your Music library ("play something by Bach", "play chill music"), pause or skip, open any tab, read and analyze the page you are on, review your last chess game with the engine, make quizzes and flashcards, set reminders, save notes, make documents, and just chat. I will not talk about rated games, though. Do not even try.';
    try { if (A.actions && A.actions.looksActionable(text)) { const r = await toolCall(text); if (r) return r; } } catch (e) { }
    /* every other question still goes out with the screen in front of the user (and the app's own code, if it is a
       question about Moundshroud), so "what does this mean?" about a button on the page just works */
    return await ask([{ role: 'system', content: persona() + await ground(text) }].concat(S.log.slice(-10, -1), [{ role: 'user', content: text }]));
  }
  async function send(txt) {
    if (!panel) build(); const text = (txt !== undefined ? txt : inEl.value).trim(); if (!text || S.busy) return; inEl.value = ''; add('u', text); quick([]); S.busy = 1;
    try { const r = await handle(text); finish(r); } catch (e) { finish('Something went wrong: ' + (e.message || e)); mood('sad', 2500); }
    S.busy = 0; if (!ctl || !ctl.signal.aborted) mood(null); setTimeout(() => quick(['Analyze this page', 'What can I do on this page?', 'Review my last chess game', 'How does the chess trainer work?']), 400);
  }

  A.buddy = { open, close, toggle, send, handle, findSongs, reviewGame, analyzePage, RATED, isRated: t => RATED.test(t), get opened() { return !!S.open; } };
})();

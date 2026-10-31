// Languages: a 6-month path from complete beginner to confident conversation in Spanish, French, German, Italian or Portuguese.
// Short daily lessons built from real example sentences (new words are always taught inside sentences made of words you already know),
// spaced-repetition review, listening, speaking-out-loud, an AI conversation partner, stories, grammar tips, checkpoints and milestone tests.
// Course data: web/data/lang/<code>.json (Tatoeba sentences, CC BY 2.0 FR; word order from FrequencyWords, MIT). Your progress is stored on this PC.
(() => {
  /* the tab holds two things: learning (everything below draws into #lgroot) and Translate (moved here from Tools) */
  const panel = document.getElementById('p-lang'); if (!panel) return;
  panel.innerHTML = '<div class="row" id="lgsub" style="padding:8px 12px;gap:6px;border-bottom:1px solid var(--line);flex-wrap:wrap"><button class="ib on" data-lg="learn">📚 Learn</button><button class="ib" data-lg="trans">🌐 Translate</button></div><div id="lgroot" style="flex:1;min-height:0;display:flex;flex-direction:column"></div><div id="lgtrans" style="flex:1;min-height:0;display:none;flex-direction:column"></div>';
  const root = panel.querySelector('#lgroot'), tr = panel.querySelector('#lgtrans');
  let lgMode = 'learn';
  const lgSet = m => { lgMode = m; panel.querySelectorAll('[data-lg]').forEach(b => b.classList.toggle('on', b.dataset.lg === m)); root.style.display = m === 'learn' ? 'flex' : 'none'; tr.style.display = m === 'trans' ? 'flex' : 'none'; if (m === 'trans') A.tools.show('trans', tr); };
  panel.querySelector('#lgsub').onclick = e => { const b = e.target.closest('[data-lg]'); if (b) { lgSet(b.dataset.lg); if (b.dataset.lg === 'learn') show(); } };
  const esc2 = s => String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const LANGS = [['es', '🇪🇸', 'Spanish', 'Español'], ['fr', '🇫🇷', 'French', 'Français'], ['de', '🇩🇪', 'German', 'Deutsch'], ['it', '🇮🇹', 'Italian', 'Italiano'], ['pt', '🇧🇷', 'Portuguese', 'Português']].sort((a, b) => a[2].localeCompare(b[2]));
  const PACES = [[8, 'Relaxed', 'about 12 months', 'a gentle 8 new words a day'], [12, 'Steady', 'about 8 months', '12 new words a day'], [20, 'Hero path', 'about 6 months', '20 new words a day, 6 days a week']];
  const ACC = { es: 'áéíóúüñ¿¡', fr: 'àâçéèêëîïôùûœ', de: 'äöüß', it: 'àèéìòù', pt: 'ãõáâàçéêíóôú' };
  const IV = [0, 1, 2, 4, 8, 16, 35, 70, 140], DAY = 864e5, TOTAL = 3000;
  const SCEN = [['☕', 'Order at a café', 'You are a friendly waiter or waitress in a café. Take the learner\'s order, suggest things, and give the bill.'], ['👋', 'Meet someone new', 'You are a friendly person the learner has just met at a party. Ask about name, home, work and hobbies.'], ['🧭', 'Ask for directions', 'You are a helpful local. The learner is lost and asks how to get places in your town.'], ['🛍️', 'Go shopping', 'You are a shop assistant. Help the learner find clothes or gifts, talk about sizes, colours and prices.'], ['🏨', 'Check in to a hotel', 'You are a hotel receptionist. Check the learner in, explain breakfast and the room.'], ['🩺', 'Visit the doctor', 'You are a kind doctor. Ask the learner what is wrong and give simple advice.'], ['🚆', 'Travel plans', 'You are a travel agent or a friend helping plan a trip: trains, places to see, dates.'], ['🍽️', 'Dinner with friends', 'You are a friend at a dinner table. Chat about food, family and the week.'], ['📞', 'A phone call', 'You are a person on the phone: the learner wants to book an appointment or a table.'], ['💬', 'Free chat', 'You are a friendly language partner. Chat about anything the learner likes.']];
  let S = { cur: '', pace: 12, rate: .9, goal: 60 }, D = null, P = null, view = 'home', cache = {}, sesDone = null, aiCtl = null;
  try { Object.assign(S, JSON.parse(ls.get('lang_s', '{}'))); } catch (e) { }
  const saveS = () => ls.set('lang_s', JSON.stringify(S));
  const fresh = () => ({ start: 0, intro: 0, w: {}, s: {}, xp: 0, days: [], dxp: {}, lessons: 0, notes: [], cp: {}, ms: {}, hist: [] });
  const loadP = c => { try { return Object.assign(fresh(), JSON.parse(ls.get('lang_p_' + c, 'null')) || {}); } catch (e) { return fresh(); } };
  const saveP = () => { if (P && S.cur) ls.set('lang_p_' + S.cur, JSON.stringify(P)); };
  const today = () => { const d = new Date(); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); };
  const css = '.lg{max-width:900px;margin:0 auto}.lg-card{background:var(--panel);border:1px solid var(--line);border-radius:16px;padding:16px 18px;margin-bottom:14px}.lg-big{font-size:34px;font-weight:800;line-height:1.1}.lg-opt{display:block;width:100%;text-align:left;padding:13px 16px;margin:8px 0;border-radius:14px;border:2px solid var(--line);background:var(--panel);color:var(--text);font-size:17px;cursor:pointer}.lg-opt:hover{border-color:var(--acc)}.lg-opt.ok{border-color:#34d399;background:rgba(52,211,153,.18)}.lg-opt.no{border-color:#f87171;background:rgba(248,113,113,.16)}.lg-tile{display:inline-block;padding:9px 14px;margin:4px;border-radius:12px;border:2px solid var(--line);background:var(--panel);cursor:pointer;font-size:17px;user-select:none}.lg-tile:hover{border-color:var(--acc)}.lg-tile.used{opacity:.25;pointer-events:none}.lg-ans{min-height:56px;border-bottom:2px solid var(--line);padding:6px 0;margin:10px 0}.lg-bar{height:10px;background:var(--panel2);border-radius:6px;overflow:hidden}.lg-bar i{display:block;height:100%;background:linear-gradient(90deg,var(--acc),var(--acc2,var(--acc)));border-radius:6px;transition:width .4s}.lg-fb{position:sticky;bottom:0;margin:14px -4px 0;padding:14px 18px;border-radius:14px;font-weight:700}.lg-fb.ok{background:rgba(52,211,153,.22);border:1px solid #34d399}.lg-fb.no{background:rgba(248,113,113,.2);border:1px solid #f87171}.lg-w{border-bottom:1px dotted var(--mute);cursor:help}.lg-chip{display:inline-block;padding:3px 10px;border-radius:999px;border:1px solid var(--line);margin:2px;font-size:13px;background:var(--panel2)}.lg-flag{font-size:42px}.lg-bubble{max-width:85%;padding:9px 13px;border-radius:14px;margin:6px 0;line-height:1.5;white-space:pre-wrap}.lg-bubble.ai{background:var(--panel);border:1px solid var(--line)}.lg-bubble.me{background:var(--user);margin-left:auto}';
  if (!document.getElementById('lgcss')) { const s = document.createElement('style'); s.id = 'lgcss'; s.textContent = css; document.head.appendChild(s); }

  /* ---------- helpers ---------- */
  const rnd = n => Math.floor(Math.random() * n), pick = a => a[rnd(a.length)], shuffle = a => { a = a.slice(); for (let i = a.length - 1; i > 0; i--) { const j = rnd(i + 1); [a[i], a[j]] = [a[j], a[i]]; } return a; };
  const norm = s => String(s).toLowerCase().replace(/[¿¡!?.,;:"“”«»()]/g, ' ').replace(/[’']/g, "'").replace(/\s+/g, ' ').trim();
  const flat = s => norm(s).normalize('NFD').replace(/[̀-ͯ]/g, '');
  const lev = (a, b) => { const m = a.length, n = b.length, d = Array.from({ length: m + 1 }, (_, i) => [i]); for (let j = 1; j <= n; j++) d[0][j] = j; for (let i = 1; i <= m; i++) for (let j = 1; j <= n; j++) d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1)); return d[m][n]; };
  const level = xp => Math.floor(Math.sqrt(xp / 60)) + 1;
  const cefr = n => n < 150 ? 'Starter' : n < 600 ? 'A1' : n < 1200 ? 'A2' : n < 2000 ? 'B1' : n < 2800 ? 'B2' : 'B2+ Hero';
  const streak = () => { const d = new Set(P.days); let n = 0, t = new Date(); const key = x => x.getFullYear() + '-' + String(x.getMonth() + 1).padStart(2, '0') + '-' + String(x.getDate()).padStart(2, '0'); if (!d.has(key(t))) t.setDate(t.getDate() - 1); while (d.has(key(t))) { n++; t.setDate(t.getDate() - 1); } return n; };
  const sfx = n => { try { A.sfx && A.sfx.play(n); } catch (e) { } };
  const confetti = () => { try { window.ChessFx && ChessFx.confetti(); } catch (e) { } };
  const addXp = n => { P.xp += n; P.dxp[today()] = (P.dxp[today()] || 0) + n; if (P.dxp[today()] >= S.goal && !P.days.includes(today())) P.days.push(today()); if (P.days.length > 400) P.days = P.days.slice(-400); };
  const W = i => D.words[i], SN = i => D.sents[i];
  const known = () => P.intro;                                        // words 0..known-1 are introduced
  const accKeys = () => (ACC[S.cur] || '').split('').map(c => '<span class="lg-chip" data-acc="' + c + '" style="cursor:pointer;font-size:16px">' + c + '</span>').join('');

  /* ---------- speech ---------- */
  let voices = []; const loadV = () => { try { voices = speechSynthesis.getVoices(); } catch (e) { } }; loadV(); try { speechSynthesis.onvoiceschanged = loadV; } catch (e) { }
  const voiceFor = () => { const tag = D ? D.tag.toLowerCase() : ''; return voices.find(v => v.lang.replace('_', '-').toLowerCase() === tag) || voices.find(v => v.lang.toLowerCase().startsWith(S.cur)); };
  function say(text, slow) { try { if (!D || !text) return; speechSynthesis.cancel(); const u = new SpeechSynthesisUtterance(String(text).replace(/\s+/g, ' ')); u.lang = D.tag; const v = voiceFor(); if (v) u.voice = v; u.rate = slow ? S.rate * .6 : S.rate; speechSynthesis.speak(u); } catch (e) { } }
  const hasVoice = () => !!voiceFor();

  /* ---------- spaced repetition ---------- */
  const stageOf = (k, i) => (P[k][i] || [0, 0])[0];
  function setSrs(k, i, stage) { stage = Math.max(0, Math.min(8, stage)); P[k][i] = [stage, Date.now() + (IV[stage] || 0) * DAY - (stage ? 0 : 0)]; }
  const dueItems = () => { const now = Date.now(), out = []; for (const k of ['w', 's']) for (const i in P[k]) if (P[k][i][1] <= now && (k === 's' || +i < known())) out.push([k, +i, P[k][i][0], P[k][i][1]]); return out.sort((a, b) => a[3] - b[3]); };

  /* ---------- exercise builders ---------- */
  const glossIdx = () => cache.gl || (cache.gl = D.words.map((w, i) => w[1] ? i : -1).filter(i => i >= 0));
  const similar = (i, n, needG) => { const g = needG ? glossIdx() : D.words.map((_, k) => k), lim = Math.max(known(), 40), out = new Set(); let tries = 0; while (out.size < n && tries++ < 400) { const k = g[rnd(Math.min(g.length, Math.max(40, lim + 20)))]; if (k !== i && k != null && (!needG || W(k)[1]) && (!needG || W(k)[1] !== W(i)[1])) out.add(k); } return [...out]; };
  const gl1 = i => W(i)[1];
  const mkMeaning = i => { const o = shuffle([i].concat(similar(i, 3, true))); return { t: 'pick', item: ['w', i], q: '<div class="small mute">What does this mean?</div><div class="lg-big">' + esc2(W(i)[0]) + '</div>', say: W(i)[0], opts: o.map(k => gl1(k)), ans: o.indexOf(i), reveal: gl1(i) }; };
  const mkWordFor = i => { const o = shuffle([i].concat(similar(i, 3, true))); return { t: 'pick', item: ['w', i], q: '<div class="small mute">How do you say this?</div><div class="lg-big">' + esc2(gl1(i)) + '</div>', opts: o.map(k => W(k)[0]), ans: o.indexOf(i), reveal: W(i)[0], sayAns: W(i)[0] }; };
  const sentOpts = (s, n) => { const pool = []; const kn = Math.max(1, SN(s)[2]); for (let t = 0; t < 60 && pool.length < n; t++) { const c = rnd(D.sents.length); if (c !== s && SN(c)[2] <= known() && !pool.includes(c) && SN(c)[1] !== SN(s)[1]) pool.push(c); } return pool; };
  const mkListen = s => { const o = shuffle([s].concat(sentOpts(s, 2))); return { t: 'pick', item: ['s', s], auto: SN(s)[0], q: '<div class="small mute">Listen, then choose the meaning</div><div style="margin:10px 0"><button class="pri" data-say="' + esc2(SN(s)[0]) + '">🔊 Play</button> <button class="ib" data-say="' + esc2(SN(s)[0]) + '" data-slow="1">🐢 Slow</button></div>', opts: o.map(k => SN(k)[1]), ans: o.indexOf(s), reveal: SN(s)[0] + ' = ' + SN(s)[1] }; };
  const tilesOf = s => SN(s)[0].replace(/[¿¡]/g, '').split(/\s+/);
  const mkBuild = s => { const tg = tilesOf(s), extra = []; for (let t = 0; t < 40 && extra.length < 2; t++) { const o = tilesOf(rnd(D.sents.length)); const w = pick(o); if (!tg.includes(w) && !extra.includes(w) && SN(0) && w.length < 10) extra.push(w); } return { t: 'build', item: ['s', s], q: '<div class="small mute">Translate this sentence</div><div style="font-size:22px;margin:6px 0">' + esc2(SN(s)[1]) + '</div>', tiles: shuffle(tg.concat(extra)), ans: tg.map(x => flat(x)).join(' '), full: SN(s)[0] }; };
  const mkType = s => ({ t: 'type', item: ['s', s], q: '<div class="small mute">Type this in ' + esc2(D.name) + '</div><div style="font-size:22px;margin:6px 0">' + esc2(SN(s)[1]) + '</div>', ans: SN(s)[0] });
  const mkDict = s => ({ t: 'type', item: ['s', s], auto: SN(s)[0], dict: 1, q: '<div class="small mute">Listen and type what you hear</div><div style="margin:10px 0"><button class="pri" data-say="' + esc2(SN(s)[0]) + '">🔊 Play</button> <button class="ib" data-say="' + esc2(SN(s)[0]) + '" data-slow="1">🐢 Slow</button></div>', ans: SN(s)[0] });
  const mkFill = (s, i) => { const sent = SN(s)[0], w = W(i)[0], re = new RegExp('(^|[^\\p{L}])(' + w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + ')(?![\\p{L}])', 'iu'); if (!re.test(sent)) return null; const o = shuffle([i].concat(similar(i, 3, false))); return { t: 'pick', item: ['w', i], q: '<div class="small mute">Fill in the blank</div><div style="font-size:22px;margin:6px 0">' + esc2(sent.replace(re, (m, a) => a + '_____')) + '</div><div class="mute">' + esc2(SN(s)[1]) + '</div>', opts: o.map(k => W(k)[0]), ans: o.indexOf(i), reveal: sent, sayAns: sent }; };
  const mkMatch = ids => ({ t: 'match', items: ids.map(i => ['w', i]), pairs: ids.map(i => [W(i)[0], gl1(i)]) });
  const mkIntro = i => { const s = W(i)[2]; return { t: 'intro', w: i, s: s >= 0 ? s : null }; };

  function lessonPlan() {
    const K = S.pace, a = known(), b = Math.min(a + K, D.words.length), ids = []; for (let i = a; i < b; i++) ids.push(i); const L = [], used = new Set();
    for (let g = 0; g < ids.length; g += 4) {
      const grp = ids.slice(g, g + 4); grp.forEach(i => L.push(mkIntro(i)));
      grp.forEach(i => { L.push(W(i)[1] ? (rnd(2) ? mkMeaning(i) : mkWordFor(i)) : (W(i)[2] >= 0 && mkFill(W(i)[2], i)) || mkIntro(i)); });
      grp.forEach(i => { const s = W(i)[2]; if (s >= 0 && !used.has(s)) { used.add(s); L.push(mkBuild(s)); } });
      const s2 = grp.map(i => W(i)[2]).filter(s => s >= 0); if (s2.length) L.push(mkListen(pick(s2)));
    }
    const g5 = ids.filter(i => W(i)[1]); if (g5.length >= 5) L.push(mkMatch(shuffle(g5).slice(0, 5)));
    // warm-up from older material
    const old = dueItems().slice(0, 6); old.forEach(([k, i, st]) => { const e = reviewEx(k, i, st); if (e) L.push(e); });
    // final mix on the new sentences
    shuffle([...used]).slice(0, 4).forEach((s, n) => L.push(n % 2 ? mkType(s) : mkDict(s)));
    return { ids, L: L.filter(Boolean) };
  }
  function reviewEx(k, i, st) {
    if (k === 'w') { if (!W(i)[1]) { const s = W(i)[2]; return s >= 0 ? (mkFill(s, i) || mkListen(s)) : null; } return st <= 2 ? (rnd(2) ? mkMeaning(i) : mkWordFor(i)) : (W(i)[2] >= 0 && st >= 3 && mkFill(W(i)[2], i)) || mkWordFor(i); }
    return st <= 1 ? mkListen(i) : st <= 3 ? mkBuild(i) : st <= 5 ? (rnd(2) ? mkType(i) : mkDict(i)) : mkDict(i);
  }
  function reviewPlan(n) {
    const d = dueItems().slice(0, n || 20), L = d.map(([k, i, st]) => reviewEx(k, i, st)).filter(Boolean); return { L, count: d.length };
  }

  /* ---------- the exercise player ---------- */
  function play(plan, o) {
    o = o || {}; const q = plan.L.slice(), total = q.length; let i = 0, right = 0, wrong = 0, combo = 0, bestCombo = 0, gained = 0; const sess = {}, missed = []; let locked = false, ex = null;
    const mark = (item, ok) => { if (!item) return; const k = item[0] + item[1]; sess[k] = sess[k] || { it: item, ok: true }; if (!ok) sess[k].ok = false; };
    const finish = () => {
      let newW = 0; for (const k in sess) { const [t, idx] = sess[k].it, key = t, st = stageOf(key, idx), isNew = !P[key][idx]; if (o.noSrs) continue; if (sess[k].ok) { setSrs(key, idx, isNew ? 2 : st + 1); if (isNew && key === 'w') newW++; } else setSrs(key, idx, isNew ? 1 : Math.max(1, st - 1)); }
      if (o.lesson) { P.intro = Math.min(D.words.length, P.intro + plan.ids.length); P.lessons++; addXp(25); gained += 25; }
      if (o.cp) { P.cp[o.cp] = Math.max(P.cp[o.cp] || 0, Math.round(right / Math.max(1, right + wrong) * 100)); }
      addXp(0); saveP(); done({ right, wrong, gained, bestCombo, total, missed, o });
    };
    const done = r => { sesDone = r; view = 'done'; draw(); };
    const bar = () => '<div class="row" style="gap:10px;align-items:center"><button class="ib" id="lgx" title="Leave">✕</button><div class="lg-bar" style="flex:1"><i style="width:' + Math.round(i / Math.max(1, total) * 100) + '%"></i></div><span class="small mute">' + (combo >= 3 ? '🔥 ' + combo : '') + '</span><b>⭐ ' + gained + '</b></div>';
    const next = () => { locked = false; if (i >= q.length) return finish(); ex = q[i]; render(); };
    const grade = (ok, reveal, say2) => {
      if (locked) return; locked = true; mark(ex.item, ok); if (ex.items) ex.items.forEach(it => mark(it, ok));
      if (ok) { right++; combo++; bestCombo = Math.max(bestCombo, combo); const g = 10 + (combo >= 3 ? 5 : 0); if (!o.place) { addXp(g); gained += g; } sfx('good'); } else { wrong++; combo = 0; sfx('bad'); if (ex.t !== 'intro') { missed.push(ex); if (!ex.again) { const c = Object.assign({}, ex, { again: 1 }); q.splice(Math.min(q.length, i + 3 + rnd(3)), 0, c); } } }
      const fb = document.createElement('div'); fb.className = 'lg-fb ' + (ok ? 'ok' : 'no'); fb.innerHTML = '<div class="row" style="align-items:center"><div style="flex:1">' + (ok ? pick(['Correct!', 'Nice!', 'Perfect!', 'Great job!', 'Exactly!']) : 'Not quite') + (reveal ? '<div style="font-weight:400;margin-top:3px">' + esc2(reveal) + '</div>' : '') + '</div><button class="pri" id="lgnext">Continue</button></div>'; $('lgbody').appendChild(fb); fb.scrollIntoView({ block: 'nearest' }); if (say2) say(say2); const nb = $('lgnext'); nb.focus(); nb.onclick = () => { i++; next(); };
    };
    const $ = id => root.querySelector('#' + id);
    function render() {
      root.innerHTML = '<div class="scroll pad" style="flex:1"><div class="lg">' + bar() + '<div id="lgbody" style="margin-top:18px"></div></div></div>'; $('lgx').onclick = () => { if (confirm('Leave this session? Your progress in it will not be saved.')) { view = 'home'; draw(); } };
      const b = $('lgbody'); root.onclick = null;
      if (ex.t === 'intro') {
        const w = W(ex.w), s = ex.s != null ? SN(ex.s) : null;
        b.innerHTML = '<div class="lg-card" style="text-align:center"><div class="small mute">New word</div><div class="lg-big" style="margin:8px 0">' + esc2(w[0]) + ' <button class="ib" data-say="' + esc2(w[0]) + '">🔊</button></div>' + (w[1] ? '<div style="font-size:22px;color:var(--acc)">' + esc2(w[1]) + '</div>' : '<div class="mute">(see the sentence)</div>') + (s ? '<div style="margin-top:16px;padding-top:12px;border-top:1px solid var(--line)"><div style="font-size:20px">' + hl(s[0], w[0]) + ' <button class="ib" data-say="' + esc2(s[0]) + '">🔊</button></div><div class="mute" style="margin-top:4px">' + esc2(s[1]) + '</div></div>' : '') + '</div><div class="row"><span class="sp"></span><button class="pri" id="lgnext">Got it</button></div>';
        b.querySelector('#lgnext').onclick = () => { mark(['w', ex.w], true); i++; next(); }; setTimeout(() => say(w[0]), 250);
      } else if (ex.t === 'pick') {
        b.innerHTML = '<div class="lg-card">' + ex.q + '</div><div id="lgo">' + ex.opts.map((o, k) => '<button class="lg-opt" data-k="' + k + '">' + esc2(o) + '</button>').join('') + '</div>'; if (ex.say) setTimeout(() => say(ex.say), 200); if (ex.auto) setTimeout(() => say(ex.auto), 250);
        b.querySelector('#lgo').onclick = e => { const bt = e.target.closest('[data-k]'); if (!bt || locked) return; const k = +bt.dataset.k, ok = k === ex.ans; bt.classList.add(ok ? 'ok' : 'no'); if (!ok) b.querySelector('[data-k="' + ex.ans + '"]').classList.add('ok'); grade(ok, ok ? '' : 'Answer: ' + (ex.reveal || ex.opts[ex.ans]), ex.sayAns); };
      } else if (ex.t === 'build') {
        b.innerHTML = '<div class="lg-card">' + ex.q + '</div><div class="lg-ans" id="lga"></div><div id="lgt">' + ex.tiles.map((t, k) => '<span class="lg-tile" data-k="' + k + '">' + esc2(t) + '</span>').join('') + '</div><div class="row" style="margin-top:12px"><button class="ib" id="lgskip">I do not know</button><span class="sp"></span><button class="pri" id="lgchk">Check</button></div>'; const got = [];
        const redraw = () => { b.querySelector('#lga').innerHTML = got.map(k => '<span class="lg-tile" data-r="' + k + '">' + esc2(ex.tiles[k]) + '</span>').join(''); b.querySelectorAll('#lgt .lg-tile').forEach(t => t.classList.toggle('used', got.includes(+t.dataset.k))); };
        b.onclick = e => { if (locked) return; const t = e.target.closest('#lgt .lg-tile'), r = e.target.closest('[data-r]'); if (t) { got.push(+t.dataset.k); say(ex.tiles[+t.dataset.k]); redraw(); } else if (r) { got.splice(got.indexOf(+r.dataset.r), 1); redraw(); } };
        $('lgchk').onclick = () => { if (locked || !got.length) return; const mine = got.map(k => flat(ex.tiles[k])).join(' '); const ok = mine === ex.ans || lev(mine, ex.ans) <= (ex.ans.length > 25 ? 1 : 0); grade(ok, ok ? ex.full : 'Answer: ' + ex.full, ex.full); }; $('lgskip').onclick = () => grade(false, 'Answer: ' + ex.full, ex.full);
      } else if (ex.t === 'type') {
        b.innerHTML = '<div class="lg-card">' + ex.q + '</div><input id="lgin" type="text" autocomplete="off" autocapitalize="off" spellcheck="false" style="width:100%;font-size:20px;padding:12px 14px" placeholder="Type your answer"><div style="margin:8px 0">' + accKeys() + '</div><div class="row"><button class="ib" id="lgskip">I do not know</button><span class="sp"></span><button class="pri" id="lgchk">Check</button></div>';
        const inp = $('lgin'); inp.focus(); if (ex.auto) setTimeout(() => say(ex.auto), 250);
        b.onclick = e => { const a = e.target.closest('[data-acc]'); if (a) { inp.value += a.dataset.acc; inp.focus(); } const s = e.target.closest('[data-say]'); if (s) say(s.dataset.say, !!s.dataset.slow); };
        const chk = () => { if (locked || !inp.value.trim()) return; const m = norm(inp.value), a = norm(ex.ans), fm = flat(inp.value), fa = flat(ex.ans); let ok = m === a, note = ''; if (!ok && fm === fa) { ok = true; note = ' (watch the accents: ' + ex.ans + ')'; } else if (!ok && lev(fm, fa) <= (fa.length > 18 ? 2 : fa.length > 8 ? 1 : 0)) { ok = true; note = ' (almost: ' + ex.ans + ')'; } grade(ok, ok ? (note || ex.ans) : 'Answer: ' + ex.ans, ex.ans); };
        $('lgchk').onclick = chk; inp.onkeydown = e => { e.stopPropagation(); if (e.key === 'Enter') { if (locked) { i++; next(); } else chk(); } }; $('lgskip').onclick = () => grade(false, 'Answer: ' + ex.ans, ex.ans);
      } else if (ex.t === 'match') {
        const L = shuffle(ex.pairs.map((p, k) => [p[0], k])), R = shuffle(ex.pairs.map((p, k) => [p[1], k])); let sel = null, left = ex.pairs.length, errs = 0;
        b.innerHTML = '<div class="lg-card"><div class="small mute">Match each word with its meaning</div></div><div class="row" style="gap:14px;align-items:flex-start"><div style="flex:1" id="lml">' + L.map(x => '<button class="lg-opt" data-s="l" data-k="' + x[1] + '">' + esc2(x[0]) + '</button>').join('') + '</div><div style="flex:1" id="lmr">' + R.map(x => '<button class="lg-opt" data-s="r" data-k="' + x[1] + '">' + esc2(x[0]) + '</button>').join('') + '</div></div>';
        b.onclick = e => { const bt = e.target.closest('[data-s]'); if (!bt || bt.disabled || locked) return; if (bt.dataset.s === 'l') say(ex.pairs[+bt.dataset.k][0]); if (!sel || sel.dataset.s === bt.dataset.s) { if (sel) sel.style.borderColor = ''; sel = bt; bt.style.borderColor = 'var(--acc)'; return; } if (sel.dataset.k === bt.dataset.k) { [sel, bt].forEach(x => { x.classList.add('ok'); x.disabled = true; x.style.borderColor = ''; }); sfx('good'); left--; sel = null; if (!left) grade(errs < 3, errs ? errs + ' slip' + (errs > 1 ? 's' : '') : 'Perfect match!'); } else { errs++; [sel, bt].forEach(x => x.classList.add('no')); const a = sel, c = bt; sel = null; sfx('bad'); setTimeout(() => { a.classList.remove('no'); c.classList.remove('no'); a.style.borderColor = ''; }, 500); } };
      }
      if (ex.t !== 'type' && ex.t !== 'build' && ex.t !== 'match') root.onclick = e => { const s = e.target.closest('[data-say]'); if (s) say(s.dataset.say, !!s.dataset.slow); };
      else if (ex.t === 'build') { const old = b.onclick; b.onclick = e => { const s = e.target.closest('[data-say]'); if (s) return say(s.dataset.say, !!s.dataset.slow); old(e); }; }
    }
    const hl = (sent, w) => esc2(sent).replace(new RegExp('(^|[^\\p{L}])(' + w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + ')(?![\\p{L}])', 'iu'), (m, a, b2) => a + '<b style="color:var(--acc)">' + b2 + '</b>');
    next();
  }

  /* ---------- screens ---------- */
  const lesson = () => { if (!D) return; const plan = lessonPlan(); if (!plan.ids.length) { A.toast('You have learned every word in this course!'); return; } play(plan, { lesson: 1, title: 'Lesson ' + (P.lessons + 1) }); };
  const review = n => { const p = reviewPlan(n || 20); if (!p.L.length) { A.toast('Nothing is due right now. Nice work!'); return; } play(p, { title: 'Review' }); };
  function checkpoint() {
    const wk = Math.floor(P.lessons / 5), from = Math.max(0, known() - 5 * S.pace), ids = []; for (let i = from; i < known(); i++) ids.push(i); if (ids.length < 5) { A.toast('Finish a few lessons first.'); return; }
    const L = []; shuffle(ids).slice(0, 14).forEach(i => { const e = reviewEx('w', i, 3 + rnd(3)); if (e) L.push(e); }); const s = ids.map(i => W(i)[2]).filter(x => x >= 0); shuffle(s).slice(0, 5).forEach((x, n) => L.push(n % 2 ? mkBuild(x) : mkType(x))); play({ L: shuffle(L).filter(Boolean) }, { cp: 'w' + wk, title: 'Checkpoint', noSrs: false });
  }
  function milestone(target) {
    const ids = []; for (let i = 0; i < Math.min(known(), target); i++) ids.push(i); const L = []; shuffle(ids).slice(0, 24).forEach(i => { const e = reviewEx('w', i, 2 + rnd(4)); if (e) L.push(e); }); shuffle(ids.map(i => W(i)[2]).filter(x => x >= 0)).slice(0, 10).forEach((x, n) => L.push(n % 2 ? mkType(x) : mkBuild(x)));
    play({ L: shuffle(L).filter(Boolean) }, { ms: target, title: 'Milestone test', noSrs: true });
  }

  function summary() {
    const r = sesDone, tot = r.right + r.wrong, pct = tot ? Math.round(r.right / tot * 100) : 100, o = r.o || {}; let extra = '', msg = pct >= 90 ? 'Outstanding!' : pct >= 70 ? 'Great work!' : 'Good effort, keep going!';
    if (o.ms) { const pass = pct >= 75; if (pass) { P.ms[o.ms] = Date.now(); saveP(); } extra = pass ? '<div class="lg-card" style="border-color:#34d399"><b>🎓 Milestone passed!</b> You have reached ' + cefr(o.ms) + '. <button class="pri" data-cert="' + o.ms + '">Print certificate</button></div>' : '<div class="lg-card"><b>Not yet.</b> You need 75% to pass. Review and try again any time.</div>'; msg = pass ? 'You did it!' : 'So close'; }
    if (o.lesson) { const nt = (D.notes || []).find(n => n.at <= known() && !P.notes.includes(n.id)); if (nt) extra += '<div class="lg-card" style="border-color:var(--acc)"><b>💡 New grammar tip unlocked:</b> ' + esc2(nt.t) + ' <button class="ib" data-gr="1">Read it</button></div>'; }
    if (pct >= 80) confetti(); sfx(pct >= 70 ? 'levelup' : 'tick'); try { A.companion && A.companion.react(pct >= 70 ? 'lang' : 'cheer'); } catch (e) { }
    root.innerHTML = '<div class="scroll pad" style="flex:1"><div class="lg"><div class="lg-card" style="text-align:center;padding:26px"><div style="font-size:56px">' + (pct >= 90 ? '🏆' : pct >= 70 ? '🎉' : '💪') + '</div><div class="lg-big">' + msg + '</div><div class="mute" style="margin:6px 0 14px">' + esc2(o.title || 'Session') + ' complete</div><div class="row" style="justify-content:center;gap:24px;flex-wrap:wrap"><div><b style="font-size:24px">' + pct + '%</b><div class="small mute">accuracy</div></div><div><b style="font-size:24px">⭐ ' + r.gained + '</b><div class="small mute">XP earned</div></div><div><b style="font-size:24px">🔥 ' + r.bestCombo + '</b><div class="small mute">best combo</div></div><div><b style="font-size:24px">' + known() + '</b><div class="small mute">words learned</div></div></div></div>' + extra +
      '<div class="row" style="gap:8px;justify-content:center;flex-wrap:wrap"><button class="pri" id="lghome">Continue</button>' + (o.lesson ? '<button class="ib" id="lgagain">Another lesson now</button>' : '') + '</div></div></div>';
    root.onclick = e => { if (e.target.closest('#lghome')) { view = 'home'; draw(); } else if (e.target.closest('#lgagain')) lesson(); else if (e.target.closest('[data-gr]')) { view = 'grammar'; draw(); } else { const c = e.target.closest('[data-cert]'); if (c) certificate(+c.dataset.cert); } };
  }
  function certificate(t) { const nm = prompt('Name for the certificate', ls.get('lang_name', '') || '') || 'Language Learner'; ls.set('lang_name', nm); const w = window.open('', '_blank'); if (!w) return A.toast('Allow pop-ups to print'); w.document.write('<title>Certificate</title><body style="font-family:Georgia,serif;text-align:center;padding:60px;border:8px double #8b7cff;margin:30px"><div style="font-size:60px">' + LANGS.find(l => l[0] === S.cur)[1] + '</div><h1 style="font-size:42px;margin:10px">Certificate of Achievement</h1><p style="font-size:20px">This certifies that</p><h2 style="font-size:36px;margin:10px">' + esc2(nm) + '</h2><p style="font-size:20px">has reached <b>' + cefr(t) + '</b> level in <b>' + esc2(D.name) + '</b><br>having learned ' + known() + ' words and completed ' + P.lessons + ' lessons.</p><p style="margin-top:40px;color:#666">' + new Date().toLocaleDateString([], { year: 'numeric', month: 'long', day: 'numeric' }) + ' &middot; Moundshroud Languages</p></body>'); w.document.close(); w.print(); }

  function home() {
    const L = LANGS.find(l => l[0] === S.cur), nDue = dueItems().length, ka = known(), lv = level(P.xp), tx = P.dxp[today()] || 0, K = S.pace, next = []; for (let i = ka; i < Math.min(ka + K, D.words.length); i++) next.push(W(i)[0]);
    const wk = Math.floor(P.lessons / 6) + 1, dayN = P.start ? Math.floor((Date.now() - P.start) / DAY) + 1 : 1, pct = Math.round(ka / TOTAL * 100), nt = (D.notes || []).filter(n => n.at <= ka), newTip = nt.find(n => !P.notes.includes(n.id));
    const cpOK = P.lessons >= 5 && !P.cp['w' + Math.floor(P.lessons / 5)] && P.lessons % 5 === 0 && P.lessons > 0, MS = [[600, 'A1'], [1200, 'A2'], [2000, 'B1'], [2800, 'B2']];
    const ring = '<svg viewBox="0 0 36 36" style="width:96px;height:96px"><circle cx="18" cy="18" r="15.9" fill="none" stroke="var(--panel2)" stroke-width="3.5"/><circle cx="18" cy="18" r="15.9" fill="none" stroke="var(--acc)" stroke-width="3.5" stroke-linecap="round" stroke-dasharray="' + pct + ' 100" transform="rotate(-90 18 18)"/><text x="18" y="21" text-anchor="middle" font-size="8" fill="var(--text)" font-weight="700">' + pct + '%</text></svg>';
    root.innerHTML = '<div class="scroll pad" style="flex:1"><div class="lg">' + nav() +
      '<div class="lg-card"><div class="row" style="gap:16px;align-items:center;flex-wrap:wrap"><div class="lg-flag">' + L[1] + '</div><div style="flex:1;min-width:200px"><div class="lg-big">' + esc2(L[2]) + '</div><div class="mute">' + esc2(cefr(ka)) + ' · ' + ka + ' of ' + TOTAL + ' words · day ' + dayN + '</div><div class="row" style="gap:6px;margin-top:8px;flex-wrap:wrap"><span class="lg-chip">🔥 ' + streak() + ' day streak</span><span class="lg-chip">⭐ level ' + lv + ' · ' + P.xp + ' XP</span><span class="lg-chip">📅 week ' + wk + ' of 26</span></div></div>' + ring + '</div></div>' +
      (!hasVoice() ? '<div class="lg-card" style="border-color:#fbbf24"><b>🔈 No ' + esc2(L[2]) + ' voice found on this PC.</b> Lessons still work, but you will not hear the words. Add one in Windows Settings &rarr; Time &amp; language &rarr; Speech &rarr; Manage voices, then restart Moundshroud.</div>' : '') +
      '<div class="lg-card" style="border-color:var(--acc)"><div class="row" style="gap:14px;align-items:center;flex-wrap:wrap"><div style="flex:1;min-width:220px"><div class="small mute">TODAY\'S LESSON ' + (P.lessons + 1) + '</div><div style="font-size:20px;font-weight:700;margin:2px 0">' + (next.length ? next.slice(0, 6).map(esc2).join(' · ') + (next.length > 6 ? ' ...' : '') : 'Course complete!') + '</div><div class="small mute">' + next.length + ' new words, then exercises. About ' + Math.round(10 + K * .6) + ' minutes.</div><div class="lg-bar" style="margin-top:10px"><i style="width:' + Math.min(100, Math.round(tx / S.goal * 100)) + '%"></i></div><div class="small mute" style="margin-top:3px">' + tx + ' of ' + S.goal + ' XP toward today\'s goal' + (tx >= S.goal ? ' ✓' : '') + '</div></div><button class="pri" id="lgles" style="font-size:18px;padding:14px 26px"' + (next.length ? '' : ' disabled') + '>Start lesson</button></div></div>' +
      '<div class="row" style="gap:10px;flex-wrap:wrap"><div class="lg-card" style="flex:1;min-width:200px"><b>🔁 Review</b><div class="small mute" style="margin:3px 0 8px">' + (nDue ? nDue + ' item' + (nDue === 1 ? '' : 's') + ' are due. Reviewing is what makes words stick.' : 'Nothing due right now.') + '</div><button class="' + (nDue ? 'pri' : 'ib') + '" id="lgrev">Review now</button></div>' +
      '<div class="lg-card" style="flex:1;min-width:200px"><b>💬 Talk</b><div class="small mute" style="margin:3px 0 8px">Chat with an AI partner who keeps it simple and corrects you.</div><button class="ib" id="lgtalk">Start talking</button></div>' +
      '<div class="lg-card" style="flex:1;min-width:200px"><b>📖 Stories</b><div class="small mute" style="margin:3px 0 8px">Short stories at your level. Tap a word for its meaning.</div><button class="ib" id="lgstory">Read a story</button></div></div>' +
      (newTip ? '<div class="lg-card" style="border-color:var(--acc)"><b>💡 Grammar tip: ' + esc2(newTip.t) + '</b><div class="small mute" style="margin:3px 0 8px">Unlocked by your progress.</div><button class="ib" data-gr="1">Read it</button></div>' : '') +
      (P.lessons >= 5 && P.lessons % 5 === 0 && !P.cp['w' + Math.floor(P.lessons / 5)] ? '<div class="lg-card"><b>🏁 Weekly checkpoint ready</b><div class="small mute" style="margin:3px 0 8px">Five lessons done. A short quiz on this week\'s words.</div><button class="pri" id="lgcp">Take the checkpoint</button></div>' : '') +
      '<div class="lg-card"><b>🗺️ Your path to Hero</b><div class="small mute" style="margin:2px 0 10px">Milestone tests unlock as you learn more words. Pass one with 75% to earn a certificate.</div><div class="row" style="gap:10px;flex-wrap:wrap">' + MS.map(m => '<div style="flex:1;min-width:120px;text-align:center;padding:10px;border-radius:12px;border:1px solid ' + (P.ms[m[0]] ? '#34d399' : 'var(--line)') + ';background:var(--panel2)"><div style="font-size:22px">' + (P.ms[m[0]] ? '✅' : ka >= m[0] ? '🎯' : '🔒') + '</div><b>' + m[1] + '</b><div class="small mute">' + m[0] + ' words</div>' + (ka >= m[0] ? '<button class="ib" data-ms="' + m[0] + '" style="margin-top:6px">' + (P.ms[m[0]] ? 'Retake' : 'Take test') + '</button>' : '') + '</div>').join('') + '</div></div>' +
      '<div class="small mute" style="text-align:center;margin:6px 0 20px">Sentences from Tatoeba contributors (CC BY 2.0 FR) via manythings.org. Meanings are matched automatically from the example sentences, so trust the sentence translation first. <a data-v="settings" style="cursor:pointer;text-decoration:underline">Settings</a></div></div></div>';
    const $ = id => root.querySelector('#' + id); $('lgles').onclick = lesson; $('lgrev').onclick = () => review(20); $('lgtalk').onclick = () => { view = 'talk'; draw(); }; $('lgstory').onclick = () => { view = 'stories'; draw(); }; if ($('lgcp')) $('lgcp').onclick = checkpoint;
  }
  function nav() {
    const T = [['home', '🏠 Home'], ['talk', '💬 Talk'], ['stories', '📖 Stories'], ['grammar', '💡 Grammar'], ['bank', '📚 My sentences'], ['primer', '🔊 Sounds'], ['settings', '⚙ Settings']];
    return '<div class="row" style="gap:6px;flex-wrap:wrap;margin-bottom:12px">' + T.map(t => '<button class="ib' + (view === t[0] ? ' on' : '') + '" data-v="' + t[0] + '">' + t[1] + '</button>').join('') + '</div>';
  }

  /* ---------- AI tutor ---------- */
  async function aiStream(messages, onText, signal) {
    const r = await fetch('/api/chat', { method: 'POST', signal, body: JSON.stringify({ model: document.getElementById('model').value, stream: true, think: false, keep_alive: '5m', options: { temperature: .7 }, messages }) });
    const rd = r.body.getReader(), dec = new TextDecoder(); let buf = '', all = ''; for (; ;) { const { value, done } = await rd.read(); if (done) break; buf += dec.decode(value, { stream: true }); let i; while ((i = buf.indexOf('\n')) >= 0) { const ln = buf.slice(0, i).trim(); buf = buf.slice(i + 1); if (!ln) continue; try { const j = JSON.parse(ln); if (j.message && j.message.content) { all += j.message.content; onText(all); } } catch (e) { } } } return all;
  }
  const recentWords = n => { const out = []; for (let i = Math.max(0, known() - n); i < known(); i++) out.push(W(i)[0]); return out.join(', '); };
  const sysFor = sc => 'You are a warm, patient ' + D.name + ' conversation partner and tutor. ' + (sc ? sc + ' ' : '') + 'The learner is a beginner at level ' + cefr(known()) + ' who knows about ' + known() + ' words (for example: ' + recentWords(40) + '). Reply ONLY in ' + D.name + ', in one to three very short, simple sentences using common everyday words and the present tense when possible, and end with a simple question to keep the chat going. If the learner wrote something incorrect, add a last line starting with the pencil emoji, then the corrected sentence in ' + D.name + ' and a tiny English tip. If they write in English, gently answer in ' + D.name + ' and show how to say it. No markdown headings, no lists.';
  function talk() {
    let hist = [], sc = null;
    root.innerHTML = '<div class="scroll pad" style="flex:1"><div class="lg">' + nav() + '<div id="lgt"></div></div></div>'; const box = root.querySelector('#lgt');
    const menu = () => { box.innerHTML = '<div class="lg-card"><b>💬 Talk with your partner</b><div class="small mute" style="margin:4px 0">Pick a situation. The AI speaks only simple ' + esc2(D.name) + ' at your level and corrects mistakes kindly. It runs on this PC.</div></div><div class="row" style="gap:10px;flex-wrap:wrap">' + SCEN.map((s, i) => '<div class="lg-card" data-sc="' + i + '" style="flex:1;min-width:200px;cursor:pointer;margin:0"><div style="font-size:28px">' + s[0] + '</div><b>' + s[1] + '</b></div>').join('') + '</div>'; box.onclick = e => { const c = e.target.closest('[data-sc]'); if (c) { sc = SCEN[+c.dataset.sc]; chat(); } }; };
    const chat = async () => {
      box.innerHTML = '<div class="row" style="gap:8px;align-items:center;margin-bottom:8px"><button class="ib" id="lgback">← Situations</button><b>' + sc[0] + ' ' + sc[1] + '</b><span class="sp"></span><label class="chk small"><input type="checkbox" id="lgtts" checked> Read aloud</label></div><div id="lgmsgs" style="min-height:260px"></div><div style="margin:6px 0">' + accKeys() + '</div><div class="row" style="gap:8px"><input id="lgin" type="text" autocomplete="off" placeholder="Write in ' + esc2(D.name) + '... (or English if you are stuck)" style="flex:1;font-size:16px"><button class="pri" id="lgsend">Send</button></div>';
      const msgs = box.querySelector('#lgmsgs'), inp = box.querySelector('#lgin'); inp.focus(); hist = [];
      const addB = (who, txt) => { const d = document.createElement('div'); d.className = 'lg-bubble ' + who; d.textContent = txt; msgs.appendChild(d); d.scrollIntoView({ block: 'nearest' }); return d; };
      const addTools = (d, txt) => { const t = document.createElement('div'); t.className = 'small'; t.style.cssText = 'margin:-2px 0 6px'; t.innerHTML = '<a data-s style="cursor:pointer">🔊 Listen</a> · <a data-t style="cursor:pointer">🇬🇧 Translate</a>'; t.onclick = async e => { if (e.target.closest('[data-s]')) say(txt.split('✏️')[0]); else if (e.target.closest('[data-t]') && !t.dataset.d) { t.dataset.d = 1; const o = document.createElement('div'); o.className = 'small mute'; o.textContent = 'translating...'; t.appendChild(o); try { await aiStream([{ role: 'user', content: 'Translate to English, reply with the translation only:\n' + txt }], x => { o.textContent = x; }); } catch (er) { o.textContent = 'Could not translate.'; } } }; d.after(t); };
      const turn = async userText => {
        if (userText) { hist.push({ role: 'user', content: userText }); addB('me', userText); } const b = addB('ai', '...'); let all = '';
        try { aiCtl = new AbortController(); all = await aiStream([{ role: 'system', content: sysFor(sc[2]) }].concat(hist.slice(-12), userText ? [] : [{ role: 'user', content: '(Start the conversation with a short greeting and a first simple question.)' }]), x => { b.textContent = x; b.scrollIntoView({ block: 'nearest' }); }, aiCtl.signal); } catch (e) { all = ''; }
        if (!all) { b.textContent = 'The AI engine is not answering right now. Check that a model is installed (Prepare > Stock up) and try again.'; return; } hist.push({ role: 'assistant', content: all }); addTools(b, all); if (box.querySelector('#lgtts') && box.querySelector('#lgtts').checked) say(all.split('✏️')[0]); addXp(3); saveP();
      };
      const send = () => { const v = inp.value.trim(); if (!v) return; inp.value = ''; turn(v); }; box.querySelector('#lgsend').onclick = send; inp.onkeydown = e => { e.stopPropagation(); if (e.key === 'Enter') send(); };
      box.onclick = e => { const a = e.target.closest('[data-acc]'); if (a) { inp.value += a.dataset.acc; inp.focus(); } if (e.target.closest('#lgback')) { try { aiCtl && aiCtl.abort(); } catch (er) { } menu(); } };
      turn('');
    };
    menu();
  }
  function stories() {
    root.innerHTML = '<div class="scroll pad" style="flex:1"><div class="lg">' + nav() + '<div class="lg-card"><b>📖 Short stories at your level</b><div class="small mute" style="margin:4px 0 8px">Moundshroud writes a new story each time, using simple ' + esc2(D.name) + '. Tap any word you know from your lessons to see its meaning.</div><div class="row" style="gap:8px;flex-wrap:wrap"><select id="lgtopic"><option>a day at the market</option><option>a trip to the beach</option><option>a new friend</option><option>a family dinner</option><option>a lost dog</option><option>a rainy day</option><option>a surprise party</option><option>my job</option></select><button class="pri" id="lgnew">Write a story</button></div></div><div id="lgst"></div></div></div>';
    const out = root.querySelector('#lgst'), gl = {}; D.words.forEach((w, i) => { if (i < known() + 60) gl[w[0]] = w[1] || ''; });
    root.querySelector('#lgnew').onclick = async () => {
      const topic = root.querySelector('#lgtopic').value; out.innerHTML = '<div class="lg-card mute">Writing...</div>'; let txt = '';
      try { txt = await aiStream([{ role: 'system', content: 'You write very short graded-reader stories in ' + D.name + ' for a beginner (level ' + cefr(known()) + ', about ' + known() + ' words). Use only common words, the present tense, and short sentences. Write 6 to 8 sentences, no title, no translation, no markdown.' }, { role: 'user', content: 'Story about ' + topic + '.' }], x => { out.innerHTML = '<div class="lg-card" style="line-height:1.9">' + esc2(x) + '</div>'; }); } catch (e) { txt = ''; }
      if (!txt) { out.innerHTML = '<div class="lg-card bad">The AI engine did not answer. Check that a model is installed and try again.</div>'; return; }
      const sentences = txt.replace(/\s+/g, ' ').trim(); const html = esc2(sentences).replace(/[\p{L}'’-]+/gu, w => { const g = gl[w.toLowerCase()]; return g ? '<span class="lg-w" title="' + esc2(g) + '">' + w + '</span>' : w; });
      out.innerHTML = '<div class="lg-card" style="font-size:19px;line-height:2">' + html + '</div><div class="row" style="gap:8px"><button class="ib" id="lgls">🔊 Listen</button><button class="ib" id="lgtr">🇬🇧 Translate</button><span class="small mute" id="lgtrt"></span></div><div id="lgtro" class="lg-card mute" style="display:none;margin-top:10px"></div>'; addXp(10); saveP();
      out.querySelector('#lgls').onclick = () => say(sentences); out.querySelector('#lgtr').onclick = async () => { const o = out.querySelector('#lgtro'); o.style.display = ''; o.textContent = 'Translating...'; try { await aiStream([{ role: 'user', content: 'Translate this ' + D.name + ' text to English, reply with the translation only:\n' + sentences }], x => { o.textContent = x; }); } catch (e) { o.textContent = 'Could not translate.'; } };
    };
  }
  function grammar() {
    const notes = (D.notes || []), up = notes.filter(n => n.at <= known()), lock = notes.filter(n => n.at > known());
    root.innerHTML = '<div class="scroll pad" style="flex:1"><div class="lg">' + nav() + '<div class="lg-card"><b>💡 Grammar tips</b><div class="small mute">Short, practical notes that unlock as you learn. Each has a button to ask your tutor for more examples.</div></div>' + (up.length ? up.map(n => '<div class="lg-card"><div class="row" style="align-items:center;gap:8px"><b>' + esc2(n.t) + '</b><span class="sp"></span>' + (P.notes.includes(n.id) ? '' : '<span class="badge">new</span>') + '</div><div style="line-height:1.65;margin-top:6px">' + n.html + '</div><div style="margin-top:8px"><button class="ib" data-ask="' + esc2(n.t) + '">✨ Ask the tutor for more examples</button></div></div>').join('') : '<div class="lg-card mute">Your first tips unlock after your first lesson.</div>') + (lock.length ? '<div class="small mute" style="margin:8px 4px">' + lock.length + ' more unlock as you learn more words.</div>' : '') + '</div></div>';
    up.forEach(n => { if (!P.notes.includes(n.id)) P.notes.push(n.id); }); saveP();
    root.onclick = e => { const a = e.target.closest('[data-ask]'); if (a) { A.showTab('chat'); A.chat.ask('I am learning ' + D.name + ' as a beginner. Explain this grammar point with 6 clear example sentences (with English translations) and 3 short practice questions at the end: ' + a.dataset.ask, { noLocal: true, sources: [] }); } navClick(e); };
  }
  function bank() {
    const learned = []; D.sents.forEach((s, i) => { if (s[2] < known()) learned.push(i); }); let q = '';
    const draw2 = () => { const l = learned.filter(i => !q || (SN(i)[0] + ' ' + SN(i)[1]).toLowerCase().includes(q)).slice(0, 80); root.querySelector('#lgbl').innerHTML = l.map(i => '<div class="lg-card" style="margin-bottom:8px;display:flex;gap:10px;align-items:center"><button class="ib" data-say="' + esc2(SN(i)[0]) + '">🔊</button><div><div style="font-size:17px">' + esc2(SN(i)[0]) + '</div><div class="small mute">' + esc2(SN(i)[1]) + '</div></div></div>').join('') || '<div class="mute">Nothing yet. Finish a lesson first.</div>'; };
    root.innerHTML = '<div class="scroll pad" style="flex:1"><div class="lg">' + nav() + '<div class="row" style="gap:8px;margin-bottom:10px"><b style="font-size:18px">📚 My sentences</b><span class="small mute" style="align-self:center">' + learned.length + ' sentences made of words you know</span><span class="sp"></span><input id="lgq" type="text" placeholder="Search" style="max-width:220px"></div><div id="lgbl"></div></div></div>'; draw2();
    const qi = root.querySelector('#lgq'); qi.onkeydown = e => e.stopPropagation(); qi.oninput = () => { q = qi.value.toLowerCase(); draw2(); }; root.onclick = e => { const s = e.target.closest('[data-say]'); if (s) say(s.dataset.say); navClick(e); };
  }
  function primer() {
    const N = (window.LANGNOTES || {})[S.cur], ex = { es: ['hola', 'gracias', 'por favor', 'buenos días', 'me llamo', 'perro', 'ñandú', 'calle'], fr: ['bonjour', 'merci', 's\'il vous plaît', 'je m\'appelle', 'rue', 'oiseau', 'chien', 'vous'], de: ['hallo', 'danke', 'bitte', 'ich heiße', 'Straße', 'schön', 'Mädchen', 'Entschuldigung'], it: ['ciao', 'grazie', 'per favore', 'mi chiamo', 'gnocchi', 'ragazzo', 'buongiorno', 'scusi'], pt: ['olá', 'obrigado', 'por favor', 'bom dia', 'me chamo', 'pão', 'coração', 'obrigada'] }[S.cur] || [];
    root.innerHTML = '<div class="scroll pad" style="flex:1"><div class="lg">' + nav() + '<div class="lg-card"><b>🔊 Pronunciation guide: ' + esc2(D.name) + '</b><div style="line-height:1.7;margin-top:8px">' + (N ? N.primer : 'Pronunciation notes are coming for this language.') + '</div></div><div class="lg-card"><b>Hear it</b><div class="small mute" style="margin:3px 0 8px">Tap a word to listen (and slow it down with 🐢).</div>' + ex.map(w => '<span class="lg-chip" style="font-size:16px;padding:6px 12px">' + esc2(w) + ' <a data-say="' + esc2(w) + '" style="cursor:pointer">🔊</a> <a data-say="' + esc2(w) + '" data-slow="1" style="cursor:pointer">🐢</a></span>').join('') + '</div></div></div>';
    root.onclick = e => { const s = e.target.closest('[data-say]'); if (s) say(s.dataset.say, !!s.dataset.slow); navClick(e); };
  }
  function settings() {
    root.innerHTML = '<div class="scroll pad" style="flex:1"><div class="lg">' + nav() + '<div class="lg-card"><b>Your pace</b><div class="small mute" style="margin:3px 0 8px">Change it any time. It only changes how many new words each lesson teaches.</div>' + PACES.map(p => '<label class="lg-opt" style="cursor:pointer"><input type="radio" name="pace" value="' + p[0] + '"' + (S.pace === p[0] ? ' checked' : '') + '> <b>' + p[1] + '</b> &middot; ' + p[3] + ' (' + p[2] + ')</label>').join('') + '</div>' +
      '<div class="lg-card"><b>Daily goal</b><div class="row" style="gap:8px;margin-top:6px"><select id="lggoal">' + [30, 60, 100, 150].map(n => '<option value="' + n + '"' + (S.goal === n ? ' selected' : '') + '>' + n + ' XP' + (n === 30 ? ' (casual)' : n === 60 ? ' (one lesson)' : n === 100 ? ' (serious)' : ' (intense)') + '</option>').join('') + '</select><span class="small mute" style="align-self:center">Reaching it keeps your streak.</span></div></div>' +
      '<div class="lg-card"><b>Voice speed</b><div class="row" style="gap:8px;margin-top:6px"><input id="lgrate" type="range" min="0.5" max="1.2" step="0.05" value="' + S.rate + '" style="flex:1"><button class="ib" id="lgtest">🔊 Test</button></div></div>' +
      '<div class="lg-card"><b>Language</b><div class="row" style="gap:8px;flex-wrap:wrap;margin-top:6px">' + LANGS.map(l => '<button class="ib' + (l[0] === S.cur ? ' on' : '') + '" data-lang="' + l[0] + '">' + l[1] + ' ' + l[2] + '</button>').join('') + '</div><div class="small mute" style="margin-top:6px">Each language keeps its own progress.</div></div>' +
      '<div class="lg-card"><b>Placement</b><div class="small mute" style="margin:3px 0 8px">Already know some? Take a short test and skip ahead.</div><button class="ib" id="lgplace">Test my level</button> <button class="ib dang" id="lgreset">Reset this language</button></div></div></div>';
    root.onclick = e => { navClick(e); const l = e.target.closest('[data-lang]'); if (l) { choose(l.dataset.lang); return; } if (e.target.closest('#lgtest')) say(({ es: 'Hola, ¿cómo estás?', fr: 'Bonjour, comment allez-vous ?', de: 'Hallo, wie geht es dir?', it: 'Ciao, come stai?', pt: 'Olá, tudo bem?' })[S.cur]); if (e.target.closest('#lgplace')) placement(); if (e.target.closest('#lgreset') && confirm('Reset all progress for ' + D.name + '? This cannot be undone.')) { P = fresh(); P.start = Date.now(); saveP(); view = 'home'; draw(); } const p = e.target.closest('[name=pace]'); if (p) { S.pace = +p.value; saveS(); } };
    root.querySelector('#lggoal').onchange = e => { S.goal = +e.target.value; saveS(); }; root.querySelector('#lgrate').oninput = e => { S.rate = +e.target.value; saveS(); };
  }
  function placement() {
    const pts = [0, 80, 160, 280, 420, 600, 800, 1000, 1300, 1600, 2000]; const L = []; pts.forEach(p => { const c = []; for (let i = p; i < Math.min(D.words.length, p + 60); i++) if (W(i)[1]) c.push(i); shuffle(c).slice(0, 2).forEach(i => { const e = mkMeaning(i); e.pt = p; L.push(e); }); });
    const keep = known(); P.intro = 3000; const plan = { L }; play(plan, { title: 'Placement test', noSrs: true, place: 1 }); P.intro = keep; window.__lgPlace = pts;
  }
  const navClick = e => { const v = e.target.closest('[data-v]'); if (v) { view = v.dataset.v; draw(); return true; } const g = e.target.closest('[data-gr]'); if (g) { view = 'grammar'; draw(); return true; } return false; };

  /* ---------- start screen and routing ---------- */
  async function choose(code) {
    S.cur = code; saveS(); D = null; P = loadP(code); root.innerHTML = '<div class="scroll pad" style="flex:1"><div class="lg"><div class="lg-card mute">Loading the course...</div></div></div>';
    try { D = await (await fetch('/web/data/lang/' + code + '.json')).json(); } catch (e) { root.innerHTML = '<div class="pad bad">The course data could not be loaded (web/data/lang/' + code + '.json).</div>'; return; }
    D.notes = ((window.LANGNOTES || {})[code] || { notes: [] }).notes.map((n, i) => Object.assign({ id: code + i }, n)); cache = {}; cache.gl = null; view = P.start ? 'home' : 'welcome'; draw();
  }
  function welcome() {
    const L = LANGS.find(l => l[0] === S.cur);
    root.innerHTML = '<div class="scroll pad" style="flex:1"><div class="lg"><div class="lg-card" style="text-align:center;padding:26px"><div class="lg-flag" style="font-size:64px">' + L[1] + '</div><div class="lg-big">Learn ' + esc2(L[2]) + '</div><div class="mute" style="margin:8px auto;max-width:560px;line-height:1.6">Short daily lessons, real example sentences, listening, an AI conversation partner and a clear path from your first word to confident conversation in about six months. Everything runs on this PC.</div></div>' +
      '<div class="lg-card"><b>Pick your pace</b>' + PACES.map(p => '<label class="lg-opt" style="cursor:pointer"><input type="radio" name="pace" value="' + p[0] + '"' + (S.pace === p[0] ? ' checked' : '') + '> <b>' + p[1] + '</b> &middot; ' + p[3] + ' <span class="mute">(' + p[2] + ')</span></label>').join('') + '</div>' +
      '<div class="row" style="gap:8px;justify-content:center;flex-wrap:wrap"><button class="pri" id="lgbegin" style="font-size:18px;padding:14px 26px">Start from zero</button><button class="ib" id="lgplace">I know some: test my level</button><button class="ib" data-v="primer">🔊 Hear the sounds first</button></div><div class="row" style="gap:8px;justify-content:center;margin-top:14px;flex-wrap:wrap">' + LANGS.map(l => '<button class="ib' + (l[0] === S.cur ? ' on' : '') + '" data-lang="' + l[0] + '">' + l[1] + ' ' + l[2] + '</button>').join('') + '</div></div></div>';
    root.onclick = e => { const l = e.target.closest('[data-lang]'); if (l) { choose(l.dataset.lang); return; } const p = e.target.closest('[name=pace]'); if (p) { S.pace = +p.value; saveS(); } if (e.target.closest('#lgbegin')) { P.start = Date.now(); saveP(); view = 'home'; draw(); } if (e.target.closest('#lgplace')) { P.start = P.start || Date.now(); placement(); } if (e.target.closest('[data-v]')) { view = 'primer'; draw(); } };
  }
  function draw() {
    if (!D) return; if (view === 'done') return summary();
    ({ home, welcome, talk, stories, grammar, bank, primer, settings })[view] ? ({ home, welcome, talk, stories, grammar, bank, primer, settings })[view]() : home();
    if (view !== 'welcome' && view !== 'talk' && view !== 'grammar' && view !== 'bank' && view !== 'primer' && view !== 'settings') { const old = root.onclick; root.onclick = e => { if (navClick(e)) return; const c = e.target.closest('[data-ms]'); if (c) milestone(+c.dataset.ms); const s = e.target.closest('[data-cert]'); if (s) certificate(+s.dataset.cert); if (old) old(e); }; }
  }
  // placement results come back through the summary: patch finish so the test moves you ahead
  const origSummary = summary; summary = function () { const r = sesDone; if (r && r.o && r.o.place) { const pts = window.__lgPlace || [], ok = {}; (r.missed || []).forEach(m => { ok[m.pt] = (ok[m.pt] || 0) + 1; }); let at = 0; for (const p of pts) { if ((ok[p] || 0) >= 2) break; at = p; } P.intro = Math.min(D.words.length, at); for (let i = Math.max(0, at - 400); i < at; i++) setSrs('w', i, 3); if (!P.start) P.start = Date.now(); saveP(); sesDone = null; view = 'home'; A.toast('Starting you at word ' + at + ' (' + cefr(at) + ').', 4000); return draw(); } return origSummary(); };
  async function show() {
    if (!S.cur || !LANGS.some(l => l[0] === S.cur)) { root.innerHTML = '<div class="scroll pad" style="flex:1"><div class="lg"><div class="lg-card" style="text-align:center;padding:26px"><div class="lg-big">🌍 Learn a language</div><div class="mute" style="margin:8px auto 16px;max-width:520px">Choose a language to begin. You can learn more than one; each keeps its own progress.</div><div class="row" style="gap:10px;justify-content:center;flex-wrap:wrap">' + LANGS.map(l => '<button class="lg-opt" data-lang="' + l[0] + '" style="width:auto;text-align:center;min-width:150px"><div style="font-size:40px">' + l[1] + '</div><b>' + l[2] + '</b><div class="small mute">' + l[3] + '</div></button>').join('') + '</div></div></div></div>'; root.onclick = e => { const l = e.target.closest('[data-lang]'); if (l) choose(l.dataset.lang); }; return; }
    if (!D) await choose(S.cur); else draw();
  }
  A.lang = { show, state: () => ({ cur: S.cur, words: P ? P.intro : 0, streak: P ? streak() : 0, due: P && D ? dueItems().length : 0, xp: P ? P.xp : 0 }), summary: () => { try { const c = S.cur; if (!c) return null; const p = loadP(c); return { code: c, words: p.intro, xp: p.xp, lessons: p.lessons }; } catch (e) { return null; } } };
  A.lang.translate = () => { A.showTab('lang'); setTimeout(() => lgSet('trans'), 0); };
  A.registerTab('lang', 'Languages', () => { if (lgMode === 'trans') { if (!tr.firstChild) A.tools.show('trans', tr); return; } show(); });
})();

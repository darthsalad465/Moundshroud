// Talk to your buddy: a sleek interactive HUD panel connected to your free-roaming SVG companion. Type or press the microphone, and your buddy will physically walk
// around Moundshroud and do what you tell it: walk to any part of the screen, click buttons/tabs/sub-tabs, point out controls, type into search or inputs, scroll pages,
// switch themes or styles, do tricks (backflip, dance, spin, zoomies, hop, roam, follow cursor), play music, read and analyze the page, review chess games, and run tools.
// House rule: it never talks about rated games. Ask, and it will tease you for it.
(() => {
  const esc = s => String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const pick = a => a[Math.floor(Math.random() * a.length)];
  const RATED = /(?<!un)\brated\b|\branked (games?|matches|play|mode|ladder)\b|\bratings? (games?|matches)\b|\bcompetitive (games?|matches)\b/i;
  const ROAST = [
    'Rated games? You? Adorable. I have seen you hang a queen in a tutorial. Not going there.',
    'Ha! A rated game. Bold. Last I checked your knight was still lost in the parking lot. I do not discuss those.',
    'Rated games are not something I talk about, and honestly, your board vision is not something you should either. Go practise.',
    'Oh, you want to talk about RATED games. That is very funny. Next question, champ.',
    'Nope. Not touching rated games. You still think the horsey moves in straight lines. Try something else!',
    'Rated? I am a buddy, not a miracle worker. Ask me about anything else and we will pretend that never happened.',
    'You and a rating, in the same sentence? Brave. I am not discussing it, so try a puzzle instead.'
  ];
  const roast = () => pick(ROAST);
  const S = { open: 0, log: [], busy: 0, speak: ls.get('buddy_speak', '0') === '1' };
  let ctl = null, panel = null, logEl = null, inEl = null, micEl = null, nameEl = null, subEl = null, hdrPet = null, roamBtn = null;

  /* ---------- HUD panel ---------- */
  const css = `
#cmpc{
  position:fixed;left:16px;bottom:92px;z-index:9990;width:368px;max-width:calc(100vw - 28px);height:445px;max-height:66vh;
  background:linear-gradient(180deg,color-mix(in srgb,var(--panel2) 55%,var(--panel)),color-mix(in srgb,var(--panel) 96%,var(--bg)));
  backdrop-filter:blur(22px) saturate(1.4);-webkit-backdrop-filter:blur(22px) saturate(1.4);
  border:1px solid color-mix(in srgb,var(--acc) 42%,var(--line));border-radius:20px;
  box-shadow:0 22px 58px -12px rgba(0,0,0,.65),0 0 0 1px rgba(255,255,255,.06) inset;
  display:none;flex-direction:column;overflow:hidden;
  transition:opacity .25s ease,transform .25s cubic-bezier(.22,1,.36,1);
}
#cmpc.on{display:flex;animation:cmpcIn .26s cubic-bezier(.16,1,.3,1) both}
#cmpc.walking-thru{opacity:.28;pointer-events:none}
@keyframes cmpcIn{from{opacity:0;transform:translateY(12px) scale(.96)}to{opacity:1;transform:none}}
#cmpc .h{
  display:flex;align-items:center;gap:7px;padding:10px 11px;
  border-bottom:1px solid color-mix(in srgb,var(--line) 80%,transparent);
  background:linear-gradient(90deg,color-mix(in srgb,var(--acc) 12%,var(--panel2)),color-mix(in srgb,var(--panel2) 70%,transparent));
}
#cmpc #cch{
  width:38px;height:38px;border-radius:12px;display:inline-flex;align-items:center;justify-content:center;flex:none;
  background:radial-gradient(circle at 50% 35%,color-mix(in srgb,var(--acc) 24%,var(--panel)),var(--panel));
  border:1px solid color-mix(in srgb,var(--acc) 35%,var(--line));
  box-shadow:inset 0 1px 0 rgba(255,255,255,.08);
}
#cmpc .h-meta{flex:1;min-width:0;display:flex;flex-direction:column;gap:1px}
#cmpc .h-meta b{font-size:14px;font-weight:700;letter-spacing:-.01em;color:var(--text);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
#cmpc .h-meta span{font-size:11px;color:var(--mute);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
#cmpc .h button{
  background:color-mix(in srgb,var(--panel) 55%,transparent);border:1px solid transparent;color:var(--mute);
  cursor:pointer;font-size:14px;width:27px;height:27px;padding:0;border-radius:8px;
  display:inline-flex;align-items:center;justify-content:center;
  transition:background .15s,color .15s,border-color .15s,transform .15s;
}
#cmpc .h button:hover{background:color-mix(in srgb,var(--acc) 18%,var(--panel2));border-color:color-mix(in srgb,var(--acc) 40%,var(--line));color:var(--text);transform:translateY(-1px)}
#cmpc .h button.on{background:color-mix(in srgb,var(--acc) 24%,var(--panel2));border-color:color-mix(in srgb,var(--acc) 55%,var(--line));color:var(--acc)}
#cmpc .lg{flex:1;overflow:auto;padding:12px;display:flex;flex-direction:column;gap:8px;font-size:13.2px;line-height:1.48;scrollbar-width:thin}
#cmpc .m{max-width:90%;padding:8px 12px;border-radius:14px;overflow-wrap:anywhere;white-space:pre-wrap;animation:cmpMsgIn .2s cubic-bezier(.22,1,.36,1) both}
@keyframes cmpMsgIn{from{opacity:0;transform:translateY(5px) scale(.98)}to{opacity:1;transform:none}}
#cmpc .m.u{align-self:flex-end;background:linear-gradient(135deg,color-mix(in srgb,var(--acc) 30%,var(--user)),var(--user));border:1px solid color-mix(in srgb,var(--acc) 35%,transparent);border-bottom-right-radius:4px;font-weight:500}
#cmpc .m.b{align-self:flex-start;background:color-mix(in srgb,var(--panel2) 88%,var(--panel));border:1px solid color-mix(in srgb,var(--line) 85%,transparent);border-bottom-left-radius:4px;box-shadow:0 3px 10px -4px rgba(0,0,0,.28)}
#cmpc .m.s{align-self:center;color:var(--acc);font-size:11.5px;font-weight:600;background:color-mix(in srgb,var(--acc) 12%,var(--panel2));border:1px solid color-mix(in srgb,var(--acc) 28%,transparent);padding:3px 10px;border-radius:999px}
#cmpc .qs{display:flex;flex-wrap:wrap;gap:5px;padding:0 12px 8px}
#cmpc .qs button{
  font-size:11.5px;font-weight:500;padding:4px 10px;border-radius:999px;
  border:1px solid color-mix(in srgb,var(--line) 90%,transparent);
  background:color-mix(in srgb,var(--panel2) 75%,transparent);color:var(--text);cursor:pointer;
  transition:border-color .15s,background .15s,transform .15s;
}
#cmpc .qs button:hover{border-color:var(--acc);background:color-mix(in srgb,var(--acc) 16%,var(--panel2));transform:translateY(-1px)}
#cmpc .f{display:flex;gap:6px;padding:9px 10px;border-top:1px solid color-mix(in srgb,var(--line) 80%,transparent);background:color-mix(in srgb,var(--panel2) 45%,transparent)}
#cmpc .f input{flex:1;min-width:0;border-radius:11px;padding:7px 11px;font-size:13px}
#cmpc .f button{padding:6px 12px;border-radius:11px;font-weight:600}
#cmpc .mic.rec{background:var(--bad);color:#fff;animation:cmpPulse 1.1s infinite}
@keyframes cmpPulse{0%,100%{box-shadow:0 0 0 0 rgba(239,68,68,.5)}50%{box-shadow:0 0 0 6px rgba(239,68,68,0)}}
@media(max-width:700px){#cmpc.on{left:8px!important;right:8px!important;width:auto;max-width:none;bottom:84px!important;height:62vh;max-height:70vh}}`;
  const st = document.createElement('style'); st.textContent = css; document.head.appendChild(st);

  // Fade the HUD slightly while the companion is mid-walk so the user can watch it walk across the whole screen
  addEventListener('companion-walk-start', () => { if (panel && S.open) panel.classList.add('walking-thru'); });
  addEventListener('companion-walk-end', () => { if (panel) panel.classList.remove('walking-thru'); });

  function build() {
    if (panel) return;
    panel = document.createElement('div');
    panel.id = 'cmpc';
    panel.innerHTML =
      '<div class="h">' +
        '<span id="cch"></span>' +
        '<div class="h-meta"><b id="ccn"></b><span id="ccsub">Interactive companion</span></div>' +
        '<button id="ccpoint" title="Click anywhere on screen to make me walk there">🎯</button>' +
        '<button id="ccroam" title="Walk & explore the screen right now">🐾</button>' +
        '<button id="cctrick" title="Do a trick!">✨</button>' +
        '<button id="ccmem" title="Who I am and what I remember about you">🧠</button>' +
        '<button id="ccs" title="Read answers aloud">🔇</button>' +
        '<button id="ccm" title="Companion menu & switch buddy">⋯</button>' +
        '<button id="ccc" title="Close">✕</button>' +
      '</div>' +
      '<div class="lg" id="cclog"></div>' +
      '<div class="qs" id="ccqs"></div>' +
      '<div class="f">' +
        '<button class="ib mic" id="ccmic" title="Talk (the microphone stays on this PC)">🎤</button>' +
        '<input id="ccin" type="text" placeholder="Tell me where to walk, what to click, or ask anything..." autocomplete="off">' +
        '<button class="pri" id="ccgo">Send</button>' +
      '</div>';
    document.body.appendChild(panel);
    logEl = panel.querySelector('#cclog');
    inEl = panel.querySelector('#ccin');
    micEl = panel.querySelector('#ccmic');
    nameEl = panel.querySelector('#ccn');
    subEl = panel.querySelector('#ccsub');
    hdrPet = panel.querySelector('#cch');
    roamBtn = panel.querySelector('#ccroam');

    panel.querySelector('#ccc').onclick = close;
    panel.querySelector('#ccmem').onclick = () => { try { regBuddy(); A.chars.open(bid()); } catch (e) { } };
    panel.querySelector('#ccm').onclick = e => { e.stopPropagation(); A.companion.menu(e.currentTarget); };
    panel.querySelector('#ccpoint').onclick = e => {
      e.stopPropagation();
      if (A.companion && A.companion.startPointMode) {
        note('🎯 Click anywhere on the screen and I will walk right over!');
        A.companion.startPointMode();
      }
    };
    panel.querySelector('#cctrick').onclick = () => {
      if (A.companion && A.companion.doTrick) A.companion.doTrick();
      mood('happy', 1800);
    };
    const paintRoam = () => {
      const on = A.companion ? A.companion.roaming : true;
      if (roamBtn) roamBtn.classList.toggle('on', !!on);
    };
    paintRoam();
    roamBtn.onclick = async () => {
      if (!A.companion) return;
      A.companion.setRoaming(true);
      paintRoam();
      note('🐾 Walking out to explore the screen...');
      if (A.companion.roamOnce) await A.companion.roamOnce(true);
    };

    const sp = panel.querySelector('#ccs');
    const paintSp = () => { sp.textContent = S.speak ? '🔊' : '🔇'; sp.classList.toggle('on', S.speak); };
    paintSp();
    sp.onclick = () => {
      S.speak = !S.speak;
      ls.set('buddy_speak', S.speak ? '1' : '0');
      paintSp();
      if (!S.speak) try { A.speech.stop(); } catch (e) { }
      else A.toast('I will read my answers aloud.', 2000);
    };
    panel.querySelector('#ccgo').onclick = () => send();
    inEl.onkeydown = e => { e.stopPropagation(); if (e.key === 'Enter') send(); else if (e.key === 'Escape') close(); };
    panel.querySelector('#ccqs').onclick = e => { const b = e.target.closest('[data-q]'); if (b) send(b.dataset.q); };
    micEl.onclick = mic;
    head();
    addEventListener('companion-change', () => { head(); paintRoam(); });
    hello();
  }

  const head = () => {
    if (!panel) return;
    const i = A.companion.info();
    nameEl.textContent = i.n;
    if (subEl) subEl.textContent = (i.role || i.title || 'Interactive companion') + ' · Alt+click to send me anywhere';
    if (window.PetAnim) PetAnim.set(hdrPet, i.e); else hdrPet.textContent = i.e;
  };
  const mood = (m, ms) => { try { A.companion.mood(m, ms); if (window.PetAnim && hdrPet) PetAnim.mood(hdrPet, m, ms); } catch (e) { } };
  const quick = list => { if (!panel) return; panel.querySelector('#ccqs').innerHTML = list.map(q => '<button data-q="' + esc(q) + '">' + esc(q) + '</button>').join(''); };
  const QUICK0 = ['Walk around', 'Walk to top right', 'Do a backflip', 'Click Settings', 'Open Chess', 'Follow my cursor'];
  function hello() {
    if (S.log.length) return;
    const i = A.companion.info();
    add('b', 'Hi! I am ' + i.n + ' (' + (i.role || i.title || 'your companion') + '). Tell me where to walk or what to do and I will physically walk across the screen and do it! Try:\n• "Walk to the top right" or "Walk around"\n• "Click Settings" or "Open Chess"\n• "Follow my cursor" or "Do a backflip"\n• Or hold Alt and click anywhere on the screen!');
    quick(QUICK0);
  }
  function add(who, text) {
    if (!panel) build();
    const d = document.createElement('div');
    d.className = 'm ' + who;
    d.textContent = text;
    if (logEl) {
      logEl.appendChild(d);
      logEl.scrollTop = logEl.scrollHeight;
    }
    if (who !== 's') S.log.push({ role: who === 'u' ? 'user' : 'assistant', content: text });
    if (S.log.length > 24) S.log.splice(0, S.log.length - 24);
    return d;
  }
  const note = t => add('s', t);
  function open() { build(); S.open = 1; panel.classList.add('on'); setTimeout(() => inEl.focus(), 50); mood('happy', 900); }
  function close() { S.open = 0; if (panel) { panel.classList.remove('on', 'walking-thru'); } try { A.speech.stop(); } catch (e) { } if (ctl) ctl.abort(); }
  const toggle = () => (S.open ? close() : open());

  /* ---------- voice ---------- */
  function mic() {
    if (!A.voice || !A.voice.available()) return A.toast('No microphone is available.');
    if (A.voice.rec) { A.voice.stop(); return; }
    A.voice.start(txt => { if (txt && txt.trim()) send(txt.trim()); }, (state) => {
      micEl.classList.toggle('rec', state === 'rec');
      micEl.textContent = state === 'rec' ? '⏹' : state === 'busy' ? '…' : '🎤';
      if (state === 'rec') mood('think', 0); else if (state === 'idle') mood(null);
    }, { auto: true });
  }

  /* ---------- finding things ---------- */
  const norm = s => String(s || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9 ]+/g, ' ').replace(/\s+/g, ' ').trim();
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
    const t = hits.length > 1 ? pick(hits.slice(0, 8)) : hits[0]; A.musicLib.play(t.i); mood('dance', 2800); return 'Playing **' + t.t + '** by ' + t.a + (t.al ? ' (' + t.al + ')' : '') + '.';
  }

  /* ---------- physical DOM target finder & interaction ---------- */
  function isVisible(el) {
    if (!el || !el.getBoundingClientRect) return false;
    if (el.closest('#cmpc,#cmp,#cmpm')) return false;
    const st = getComputedStyle(el);
    if (st.display === 'none' || st.visibility === 'hidden' || parseFloat(st.opacity) < 0.05) return false;
    const r = el.getBoundingClientRect();
    return r.width > 6 && r.height > 6 && r.bottom > 0 && r.right > 0 && r.top < innerHeight && r.left < innerWidth;
  }

  const SPECIAL_TARGETS = {
    settings: '#cog', preferences: '#cog', gear: '#cog', options: '#cog', cog: '#cog',
    search: '#gs, #tdq, #wq, #sq', 'command palette': '#gs', commands: '#gs', 'search bar': '#gs, #tdq, #wq, #sq',
    'new chat': '#newc', 'voice mode': '#talk', talk: '#talk', microphone: '#mic, #talk',
    sidebar: '#railbtn, #nav', menu: '#railbtn', navigation: '#nav',
    header: 'body > header', 'top bar': 'body > header', logo: 'header .mark, header > b', title: 'header > b',
    send: '#go', model: '#model', 'ai model': '#model', internet: '#net', web: '#net'
  };

  function findTargetOnScreen(rawQuery, wantInput) {
    const q = norm(rawQuery).replace(/\b(the|a|an|button|tab|card|field|box|input|icon|link|section|page|control|area|spot|place|on|at|to|in|for|by|near|beside|over|me|please|right|now|it)\b/g, ' ').replace(/\s+/g, ' ').trim();
    if (!q) return null;

    if (!wantInput && SPECIAL_TARGETS[q]) {
      const sp = [...document.querySelectorAll(SPECIAL_TARGETS[q])].find(isVisible);
      if (sp) return { el: sp, label: sp.getAttribute('title') || (sp.textContent || '').trim() || q };
    }

    // Handle ordinal queries like "first card", "second card", "first button"
    if (/^(first|1st|second|2nd|third|3rd|last|random)\b/.test(rawQuery.toLowerCase())) {
      const wantBtn = /button/i.test(rawQuery);
      const list = [...document.querySelectorAll(wantBtn ? '.panel.on button, header button' : '.panel.on .td-card, .panel.on .card, .panel.on .td-tile, .panel.on .gcard')].filter(isVisible);
      if (list.length) {
        const lq = rawQuery.toLowerCase();
        const idx = /second|2nd/.test(lq) ? 1 : /third|3rd/.test(lq) ? 2 : /last/.test(lq) ? list.length - 1 : /random/.test(lq) ? Math.floor(Math.random() * list.length) : 0;
        const chosen = list[Math.min(list.length - 1, idx)];
        const lbl = (chosen.querySelector('h4,h3,h2,b')?.textContent || chosen.textContent || 'item').replace(/\s+/g, ' ').trim().slice(0, 36);
        return { el: chosen, label: lbl };
      }
    }

    const sel = wantInput
      ? 'input[type="text"], input[type="search"], input:not([type]), textarea'
      : 'button, [role="button"], a, .card, .td-card, .td-tile, .tile, .feat, .gcard, .chip, input[type="text"], input[type="search"], textarea, select, h1, h2, h3, h4, summary';
    const all = [...document.querySelectorAll(sel)].filter(isVisible);
    const toks = q.split(' ').filter(Boolean);
    let best = null, bestScore = 0;

    for (const el of all) {
      const txt = norm(el.innerText || el.textContent || '');
      const title = norm(el.getAttribute('title') || el.getAttribute('aria-label') || '');
      const ph = norm(el.getAttribute('placeholder') || '');
      const d = el.dataset || {};
      const dt = norm([d.tab, d.grp, d.t, d.s, d.g, d.a, d.n, d.m, d.l, d.o, el.id].filter(Boolean).join(' '));
      const combined = (txt + ' ' + title + ' ' + ph + ' ' + dt).trim();
      if (!combined) continue;

      let s = 0;
      if (txt === q || title === q || dt === q) s += 130;
      else if (txt.startsWith(q) || title.startsWith(q)) s += 80;
      else if (txt.includes(q) || title.includes(q) || ph.includes(q)) s += 55;
      toks.forEach(k => {
        if (k.length < 2) return;
        if (txt.split(' ').includes(k)) s += 24;
        else if (txt.includes(k)) s += 12;
        if (title.includes(k)) s += 16;
        if (ph.includes(k)) s += 16;
        if (dt.split(' ').includes(k)) s += 28;
      });
      if (el.closest('.panel.on, #setx, #ov.on')) s += 8;
      if (txt.length > 110) s -= 14;
      if (s > bestScore) {
        bestScore = s;
        const h = el.querySelector ? el.querySelector('h4,h3,h2,b,.nl') : null;
        const cleanLabel = ((h ? h.textContent : '') || el.innerText || el.textContent || el.getAttribute('title') || el.getAttribute('placeholder') || q).replace(/\s+/g, ' ').trim().slice(0, 44);
        best = { el, label: cleanLabel || q, score: s };
      }
    }
    return bestScore >= 18 ? best : null;
  }

  /* ---------- directional / spatial coordinate resolver ---------- */
  async function tryWalkDirection(raw) {
    const t = norm(raw);
    const W = innerWidth || 1024, H = innerHeight || 768;
    const p = A.companion && A.companion.pos ? (typeof A.companion.pos === 'function' ? A.companion.pos() : A.companion.pos) : { x: 14, y: 14 };

    // Circle or figure-8 or zoomies
    if (/\b(in a circle|in circles|around in a circle|circle around)\b/.test(t)) {
      note('🌀 Walking in a circle around the screen...');
      await A.companion.doTrick('circle');
      return 'Walked a full circle around the screen!';
    }
    if (/\b(zoomies|run around|sprint around|lap around|pace back and forth|across the screen)\b/.test(t)) {
      if (/across the screen/.test(t)) {
        const destX = p.x < W * 0.5 ? W - 96 : 24;
        note('🐾 Walking all the way across the screen...');
        await A.companion.walkTo(destX, p.y, { say: 'Made it across!' });
        return 'Walked all the way to the other side of the screen!';
      }
      note('💨 Running zoomies around the screen...');
      await A.companion.doTrick('zoomies');
      return 'That was a great sprint around the workspace!';
    }

    // Specific corners & regions
    let tx = null, ty = null, desc = '';
    if (/\b(top right|upper right)\b/.test(t)) { tx = W - 96; ty = H - 108; desc = 'the top-right corner'; }
    else if (/\b(top left|upper left)\b/.test(t)) { tx = 24; ty = H - 108; desc = 'the top-left corner'; }
    else if (/\b(bottom right|lower right)\b/.test(t)) { tx = W - 96; ty = 20; desc = 'the bottom-right corner'; }
    else if (/\b(bottom left|lower left)\b/.test(t)) { tx = 16; ty = 16; desc = 'the bottom-left corner'; }
    else if (/\b(center|middle|centre)\b/.test(t) || /^(?:please\s+)?(?:come here|walk here|come to me|walk over here|over here)$/.test(t)) {
      tx = Math.round(W * 0.5 - 33); ty = Math.round(H * 0.48); desc = 'the center of the screen';
    }
    else if (/^(?:(?:hey|ok|okay|please|can you)\s+)*(?:walk|go|move|run|step|hop|head|climb|fly)\s+(?:to\s+|over\s+to\s+|towards?\s+)?(?:the\s+)?(top|up|upwards?|higher|top of the screen)$/.test(t)) {
      tx = p.x < 80 ? Math.round(W * 0.45) : p.x;
      ty = /top/.test(t) ? H - 105 : Math.min(H - 96, p.y + 240);
      desc = /top/.test(t) ? 'the top of the screen' : 'higher up on the screen';
    }
    else if (/^(?:(?:hey|ok|okay|please|can you)\s+)*(?:walk|go|move|run|step|hop|head|fly)\s+(?:to\s+|over\s+to\s+|towards?\s+)?(?:the\s+)?(bottom|down|downwards?|lower|bottom of the screen)$/.test(t)) {
      tx = p.x;
      ty = /bottom/.test(t) ? 18 : Math.max(16, p.y - 240);
      desc = /bottom/.test(t) ? 'the bottom of the screen' : 'lower down on the screen';
    }
    else if (/^(?:(?:hey|ok|okay|please|can you)\s+)*(?:walk|go|move|run|step|hop|head|fly)\s+(?:to\s+|over\s+to\s+|towards?\s+)?(?:the\s+)?(right|right side|far right|over there)$/.test(t)) {
      tx = /side|far|there/.test(t) ? W - 98 : Math.min(W - 92, p.x + 280);
      ty = p.y < 60 ? Math.round(H * 0.38) : p.y;
      desc = 'the right side of the screen';
    }
    else if (/^(?:(?:hey|ok|okay|please|can you)\s+)*(?:walk|go|move|run|step|hop|head|fly)\s+(?:to\s+|over\s+to\s+|towards?\s+)?(?:the\s+)?(left|left side|far left)$/.test(t)) {
      tx = /side|far/.test(t) ? 20 : Math.max(18, p.x - 280);
      ty = p.y;
      desc = 'the left side of the screen';
    }

    if (tx !== null && ty !== null && A.companion && A.companion.walkTo) {
      note('🐾 Walking to ' + desc + '...');
      await A.companion.walkTo(tx, ty, { say: 'Made it to ' + desc + '!' });
      return 'Walked over to **' + desc + '**!';
    }
    return null;
  }

  /* ---------- full tab & sub-tab navigation with physical walking ---------- */
  const TABALIAS = {
    home: 'home', today: 'home', dashboard: 'home',
    chat: 'chat', assistant: 'chat',
    search: 'web', web: 'web', browser: 'web', internet: 'web',
    library: 'lib', lib: 'lib', wikipedia: 'lib', encyclopedia: 'lib',
    files: 'files', 'my files': 'files',
    docs: 'docs', documents: 'docs',
    offed: 'offed', 'office files': 'offed', spreadsheet: 'offed',
    notes: 'notes', notebook: 'notes',
    meet: 'meet', 'meeting notes': 'meet',
    study: 'study', flashcards: 'study', quiz: 'study', quizzes: 'study',
    practice: 'practice',
    teach: 'teach', 'teach me': 'teach',
    writing: 'writing',
    lang: 'lang', languages: 'lang', language: 'lang', translate: 'lang',
    studio: 'studio',
    lab: 'lab',
    tools: 'tools', converter: 'tools', timer: 'tools',
    calc: 'calc', calculator: 'calc',
    rem: 'rem', reminders: 'rem', timers: 'rem', alarm: 'rem',
    clip: 'clip', clipboard: 'clip',
    scan: 'scan', scanner: 'scan',
    health: 'health', prepare: 'health', preparedness: 'health', 'first aid': 'health', survival: 'health', medical: 'health',
    play: 'play', entertainment: 'play', games: 'play', arcade: 'play', chess: 'play', trivia: 'play', solitaire: 'play', poker: 'play', sudoku: 'play', tetris: 'play', '2048': 'play', minesweeper: 'play',
    music: 'music', songs: 'music',
    radio: 'radio', stations: 'radio',
    tv: 'tv', television: 'tv', video: 'tv', youtube: 'tv',
    photos: 'photos', pictures: 'photos',
    albums: 'albums',
    mail: 'mail', email: 'mail',
    cal: 'cal', calendar: 'cal',
    news: 'news', markets: 'news',
    kitchen: 'kitchen', recipes: 'kitchen', cooking: 'kitchen',
    garden: 'garden', plants: 'garden',
    money: 'money', budget: 'money', finance: 'money',
    journal: 'journal', diary: 'journal',
    sky: 'sky', astronomy: 'sky', stars: 'sky',
    cyber: 'cyber', security: 'cyber', passwords: 'cyber',
    faith: 'faith', spiritual: 'faith', bible: 'faith',
    guide: 'guide', help: 'guide', manual: 'guide',
    map: 'map', 'app map': 'map'
  };

  async function walkToSidebarTab(id) {
    if (!A.companion || !A.companion.walkToEl) return;
    let navBtn = document.querySelector('#nav button[data-tab="' + id + '"], #nav button[data-t="' + id + '"]');
    if (navBtn) {
      const closedGroup = navBtn.closest('.ngl:not(.open)');
      if (closedGroup && closedGroup.dataset.g) {
        const grpBtn = document.querySelector('#nav button[data-grp="' + closedGroup.dataset.g + '"]');
        if (grpBtn && isVisible(grpBtn)) {
          await A.companion.walkToEl(grpBtn, { click: true, say: 'Unfolding menu...' });
          await new Promise(r => setTimeout(r, 240));
          navBtn = document.querySelector('#nav button[data-tab="' + id + '"]');
        }
      }
      if (navBtn && isVisible(navBtn)) {
        await A.companion.walkToEl(navBtn, { say: (A.tabs[id] && A.tabs[id].label ? A.tabs[id].label : id) + '!' });
        return;
      }
    }
    const fallbackNav = document.querySelector('#nav');
    if (fallbackNav && isVisible(fallbackNav)) {
      await A.companion.walkToEl(fallbackNav, { say: (A.tabs[id] && A.tabs[id].label ? A.tabs[id].label : id) + '!' });
    }
  }

  async function openTab(name) {
    const n = norm(name).replace(/\b(the|tab|section|page|app|my|please|right|now|up|over|to)\b/g, ' ').replace(/\s+/g, ' ').trim();
    if (!n) return null;
    if (n === 'settings' || n === 'preferences' || n === 'customizer') {
      const cog = document.getElementById('cog');
      if (cog && A.companion && A.companion.walkToEl) {
        note('🐾 Walking over to Settings...');
        await A.companion.walkToEl(cog, { say: 'Opening Settings!' });
      }
      if (n === 'customizer' && A.custom) A.custom.open();
      else if (A.settings) A.settings.open();
      return 'Walked over and opened **' + (n === 'customizer' ? 'Customizer' : 'Settings') + '** for you.';
    }
    let id = TABALIAS[n];
    if (!id && A.tabs) {
      id = Object.keys(A.tabs).find(k => norm(A.tabs[k].label) === n || (norm(A.tabs[k].label).includes(n) && n.length > 2));
    }
    if (!id || !A.tabs || !A.tabs[id]) return null;

    note('🐾 Walking to ' + (A.tabs[id].label || id) + '...');
    await walkToSidebarTab(id);
    A.showTab(id);

    if (['chess', 'trivia', 'sudoku', 'tetris', 'solitaire', 'poker', '2048', 'minesweeper'].includes(n)) {
      await new Promise(r => setTimeout(r, 340));
      try {
        const b = [...document.querySelectorAll('#p-play button, #p-play .card, #p-play .gcard')].find(x => new RegExp(n, 'i').test(x.textContent || x.dataset.g || ''));
        if (b && isVisible(b) && A.companion && A.companion.walkToEl) {
          await A.companion.walkToEl(b, { click: true, say: 'Let\'s play ' + n + '!' });
        } else if (b) {
          b.click();
        }
      } catch (e) { }
    }
    return 'Walked over and opened **' + (A.tabs[id].label || id) + '**.';
  }

  /* ---------- physical command handler ---------- */
  async function tryPhysicalCommand(raw) {
    const t = norm(raw);
    let m;

    /* 0. Compound commands ("walk to X and click it", "open X then click Y") */
    if ((m = /^(.+?)\s+(?:and then|then|and also)\s+(.+)$/i.exec(raw))) {
      const r1 = await tryPhysicalCommand(m[1]) || await openTab(m[1]);
      if (r1) {
        await new Promise(r => setTimeout(r, 320));
        const r2 = await tryPhysicalCommand(m[2]) || await openTab(m[2]);
        return r2 ? r1 + ' ' + r2 : r1;
      }
    }

    /* 1. Switch companion character by name or animal */
    const BUDDY_MAP = [
      { idx: 0, keys: ['hoot', 'owl', 'night scholar'] },
      { idx: 1, keys: ['fenn', 'fox', 'kitsune', 'scout'] },
      { idx: 2, keys: ['inky', 'octopus', 'squid', 'mage'] },
      { idx: 3, keys: ['bolt', 'robot', 'bot', 'droid', 'mecha'] },
      { idx: 4, keys: ['ember', 'dragon', 'drake', 'wyrm'] },
      { idx: 5, keys: ['sloane', 'sloth'] },
      { idx: 6, keys: ['pip', 'penguin'] },
      { idx: 7, keys: ['miso', 'cat', 'kitty', 'kitten', 'neko'] }
    ];
    if ((m = /^(?:please\s+)?(?:switch to|change to|turn into|become|be|summon|call|bring out|use)\s+(?:the\s+)?(.+?)(?:\s+buddy|\s+companion|\s+pet)?$/i.exec(raw))) {
      const want = norm(m[1]);
      const hit = BUDDY_MAP.find(b => b.keys.some(k => want === k || want.split(' ').includes(k)));
      if (hit && A.companion && A.companion.setBuddy) {
        A.companion.setBuddy(hit.idx);
        const info = A.companion.info();
        if (A.companion.doTrick) A.companion.doTrick('hop');
        return 'Switched! Hi, I am ' + info.n + ' (' + (info.role || 'your buddy') + '). Ready whenever you are!';
      }
    }

    /* 2. Directional / screen-region walking ("walk to top right", "go left", "walk to center", "zoomies", "circle") */
    const dirRes = await tryWalkDirection(raw);
    if (dirRes) return dirRes;

    /* 3. Tricks, dances, flips, spins, waves, sleep, roam, follow, go home */
    if (/\b(backflip|do a flip|flip|somersault|cartwheel)\b/.test(t)) {
      if (A.companion && A.companion.doTrick) await A.companion.doTrick('flip');
      return 'Alley-oop! Nailed the landing.';
    }
    if (/\b(dance|boogie|party|groove|bust a move|wiggle)\b/.test(t) && !/\b(play|music|song)\b/.test(t)) {
      if (A.companion && A.companion.doTrick) await A.companion.doTrick('dance');
      return 'Look at these moves! 💃';
    }
    if (/\b(spin|twirl|pirouette|turn around)\b/.test(t)) {
      if (A.companion && A.companion.doTrick) await A.companion.doTrick('spin');
      return 'Wheee! Full 360° spin!';
    }
    if (/\b(wave|wave at me|say hi|say hello)\b/.test(t)) {
      if (A.companion && A.companion.doTrick) await A.companion.doTrick('wave');
      return 'Hey there! 👋 Ready to walk anywhere or click anything you ask!';
    }
    if (/\b(do a trick|show me a trick|do something cool|do something fun|impress me|perform a trick)\b/.test(t)) {
      if (A.companion && A.companion.doTrick) await A.companion.doTrick();
      return 'Ta-da! Want to see a backflip, dance, spin, or zoomies next?';
    }
    if (/^(?:please\s+)?(jump|hop|bounce|leap|spring)(?:\s+up|\s+around)?$/.test(t)) {
      if (A.companion && A.companion.doTrick) await A.companion.doTrick('hop');
      return 'Boing! Higher next time?';
    }
    if (/\b(go to sleep|take a nap|sleep|nap|snooze|rest now)\b/.test(t) && !/\b(music|song|play|timer)\b/.test(t)) {
      if (A.companion && A.companion.setFollow) A.companion.setFollow(false);
      mood('sleep', 12000);
      if (A.companion) A.companion.say('Zzz… 💤', 3500);
      return 'Curling up for a quick nap… Zzz. (Click me or say "wake up" anytime!)';
    }
    if (/\b(wake up|wakey|good morning|eyes open)\b/.test(t)) {
      mood('happy', 2200);
      if (A.companion && A.companion.hop) A.companion.hop();
      if (A.companion) A.companion.say('I am awake! ✨', 2400);
      return 'Wide awake and ready to help!';
    }
    if (/\b(follow me|follow my cursor|follow the mouse|follow cursor|come with me|chase the cursor|chase me)\b/.test(t)) {
      if (A.companion && A.companion.setFollow) A.companion.setFollow(true);
      return 'I am following your cursor now! Move your mouse around and I will trot after you. Tell me "stop following" or "go home" when you want me to stop.';
    }
    if (/\b(stop following|dont follow|do not follow|stop chasing)\b/.test(t)) {
      if (A.companion && A.companion.setFollow) A.companion.setFollow(false);
      return 'Okay, I stopped following your cursor.';
    }
    if (/\b(go home|back to corner|return to corner|stay in corner|stop roaming|sit still|stay put|perch in corner)\b/.test(t)) {
      if (A.companion && A.companion.setFollow) A.companion.setFollow(false);
      if (A.companion && A.companion.goHome) {
        note('🏠 Walking back to my corner...');
        await A.companion.goHome(false);
      }
      if (roamBtn) roamBtn.classList.remove('on');
      return 'Back in my cozy bottom-left corner! Tell me "walk around" whenever you want me to roam again.';
    }
    if (/\b(walk around|roam|roam around|explore|free roam|wander|stretch your legs|move around|walk somewhere|go somewhere|patrol)\b/.test(t)) {
      if (A.companion && A.companion.setFollow) A.companion.setFollow(false);
      if (A.companion) {
        A.companion.setRoaming(true);
        if (roamBtn) roamBtn.classList.add('on');
        note('🐾 Walking out to explore the screen...');
        const where = A.companion.roamOnce ? await A.companion.roamOnce(true) : 'the screen';
        return 'Walked over to check out **' + where + '**! Tell me any button, card, or corner to walk to next.';
      }
    }

    /* 4. Scrolling the page */
    if (/\b(scroll down|scroll up|scroll to the bottom|scroll to the top|page down|page up)\b/.test(t)) {
      const sc = document.querySelector('.panel.on .scroll, .panel.on #mgrid, .panel.on [class*="scroll"]') || document.querySelector('.panel.on') || document.scrollingElement;
      const isUp = /up|top/.test(t), isEnd = /bottom|top/.test(t);
      if (A.companion && A.companion.walkTo) {
        note('🐾 Walking over to scroll the page...');
        await A.companion.walkTo(Math.round((innerWidth || 1024) * 0.55), Math.round((innerHeight || 768) * 0.45), { say: isUp ? 'Scrolling up!' : 'Scrolling down!' });
      }
      if (sc) {
        const delta = isEnd ? (isUp ? -99999 : 99999) : (isUp ? -420 : 420);
        try { sc.scrollBy({ top: delta, behavior: 'smooth' }); } catch (e) { sc.scrollTop += delta; }
      }
      return 'Walked over and scrolled the page **' + (isUp ? 'up' : 'down') + '** for you.';
    }

    /* 5. Replay opening animation */
    if (/\b(replay|play|show|watch|run)\b.*\b(intro|opening|boot|splash|awakening|startup animation)\b/.test(t)) {
      if (window.OA_REPLAY_BOOT) {
        setTimeout(() => window.OA_REPLAY_BOOT(), 250);
        return 'Replaying the Moundshroud opening sequence! ✨';
      }
    }

    /* 6. Theme & Interface Style switching */
    const TH = window.OA_THEMES;
    if (TH && /\b(theme|style|mode|colour|color|palette|look)\b/.test(t)) {
      if (TH.styles) {
        const stHit = TH.styles.find(s => new RegExp('\\b' + norm(s.id) + '\\b|\\b' + norm(s.name) + '\\b', 'i').test(t));
        if (stHit && /\b(use|switch|change|set|apply|try|turn on|make it|style)\b/.test(t)) {
          const cog = document.getElementById('cog');
          if (cog && isVisible(cog) && A.companion && A.companion.walkToEl) {
            note('🐾 Walking to Settings to switch style...');
            await A.companion.walkToEl(cog, { say: stHit.name + ' style!' });
          }
          TH.applyStyle(stHit.id);
          return 'Walked over and switched the interface style to **' + stHit.name + '** (' + stHit.note + ').';
        }
      }
      if (TH.list) {
        const thHit = TH.list.find(x => new RegExp('\\b' + norm(x.id) + '\\b|\\b' + norm(x.name) + '\\b', 'i').test(t));
        if (thHit && /\b(use|switch|change|set|apply|try|turn on|make it|theme|colour|color)\b/.test(t)) {
          const cog = document.getElementById('cog');
          if (cog && isVisible(cog) && A.companion && A.companion.walkToEl) {
            note('🐾 Walking to apply ' + thHit.name + '...');
            await A.companion.walkToEl(cog, { say: thHit.name + '!' });
          }
          TH.apply(thHit.id);
          return 'Walked over and applied the **' + thHit.name + '** colour theme!';
        }
        if (/\b(light mode|light theme|bright mode)\b/.test(t)) {
          const lt = TH.list.find(x => !x.dark) || TH.list[0];
          if (lt) { TH.apply(lt.id); return 'Switched to **' + lt.name + '** (light mode).'; }
        }
        if (/\b(dark mode|dark theme|night mode)\b/.test(t)) {
          const dk = TH.list.find(x => x.dark) || TH.list[0];
          if (dk) { TH.apply(dk.id); return 'Switched to **' + dk.name + '** (dark mode).'; }
        }
      }
    }

    /* 7. Type / Fill / Search into an input on screen */
    if ((m = /^(?:(?:hey|ok|okay|please|can you)\s+)*(?:type|write|enter|fill in|put)\s+["']?(.+?)["']?\s+(?:in|into|inside|on)\s+(?:the\s+)?(.+?)$/i.exec(raw))) {
      const val = m[1].trim(), targetName = m[2].trim();
      const found = findTargetOnScreen(targetName, true) || findTargetOnScreen(targetName, false);
      const el = found ? (found.el.matches('input,textarea') ? found.el : found.el.querySelector('input,textarea')) : document.querySelector('.panel.on input[type="text"], .panel.on textarea, #in, #tdq');
      if (el && isVisible(el)) {
        note('🐾 Walking over to type "' + val + '"...');
        if (A.companion && A.companion.walkToEl) await A.companion.walkToEl(el, { say: 'Typing!' });
        el.focus();
        el.value = val;
        el.dispatchEvent(new Event('input', { bubbles: true }));
        el.dispatchEvent(new Event('change', { bubbles: true }));
        return 'Walked over to **' + (found ? found.label : 'the input box') + '** and typed `' + val + '`.';
      }
    }
    if ((m = /^(?:(?:hey|ok|okay|please|can you)\s+)*(?:search for|search|find|look up)\s+["']?(.+?)["']?(?:\s+on this page|\s+in search|\s+in the search box)?$/i.exec(raw)) && !/\b(where is|button|tab)\b/i.test(m[1])) {
      const q = m[1].trim();
      const inp = [...document.querySelectorAll('.panel.on input[type="search"], .panel.on input[type="text"], #tdq, #wq, #sq')].find(isVisible);
      if (inp) {
        note('🐾 Walking to the search box...');
        if (A.companion && A.companion.walkToEl) await A.companion.walkToEl(inp, { say: 'Searching for ' + q + '!' });
        inp.focus();
        inp.value = q;
        inp.dispatchEvent(new Event('input', { bubbles: true }));
        inp.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
        return 'Walked to the search box and entered **' + q + '**.';
      }
    }

    /* 8. Click / Press / Tap / Walk-and-Click any button, tab, sub-tab, or card on screen */
    if ((m = /^(?:(?:hey|ok|okay|please|can you|could you|go|walk over and|go over and|walk to and)\s+)*(?:click|press|tap|hit|push|activate|select|toggle|open)\s+(?:on\s+)?(?:the\s+)?(.+?)$/i.exec(raw))) {
      const q = m[1].replace(/\s+for me$/i, '').trim();
      const found = findTargetOnScreen(q, false);
      if (found && found.el) {
        note('🐾 Walking over to click "' + found.label + '"...');
        if (A.companion && A.companion.walkToEl) {
          await A.companion.walkToEl(found.el, { click: true, say: 'Clicking ' + found.label + '!' });
        } else {
          found.el.click();
        }
        return 'Walked over and clicked **' + found.label + '**!';
      }
      const tabRes = await openTab(q);
      if (tabRes) return tabRes;
    }

    /* 9. Walk to / Go to / Move to / Point at / Stand on / Sit on any UI control, tab, or spot on screen */
    if ((m = /^(?:(?:hey|ok|okay|please|can you|could you)\s+)*(?:point at|point to|show me where|where is|highlight|find|walk to|walk over to|go to|go over to|move to|run to|hop to|fly to|stand on|stand by|sit on|perch on|visit|check out)\s+(?:the\s+)?(.+?)(?:\s+is|\s+for me)?$/i.exec(raw))) {
      const q = m[1].replace(/\?+$/, '').trim();
      const wantOpen = /^(?:go to|open|visit)\b/i.test(raw.trim());
      const found = findTargetOnScreen(q, false);
      if (found && found.el) {
        note('🐾 Walking over to "' + found.label + '"...');
        if (A.companion && A.companion.walkToEl) {
          await A.companion.walkToEl(found.el, { click: wantOpen, say: wantOpen ? 'Opening ' + found.label + '!' : 'Right here! ✨' });
        }
        return wantOpen
          ? 'Walked over to **' + found.label + '** and opened it for you!'
          : 'I walked right over to **' + found.label + '** and highlighted it for you!';
      }
      const tabRes = await openTab(q);
      if (tabRes) return tabRes;

      // Guaranteed movement fallback if the user told the companion to walk/move/go/stand/perch somewhere not found by name
      if (/\b(walk|move|run|hop|fly|stand|sit|perch|roam|explore)\b/i.test(raw) && A.companion && A.companion.roamOnce) {
        note('🐾 Walking over...');
        const where = await A.companion.roamOnce(true);
        return 'I could not spot "' + q + '" on this screen, so I walked over to **' + where + '** instead! (Tip: hold Alt and click anywhere on screen to send me to an exact spot.)';
      }
    }

    return null;
  }

  /* ---------- the page you are on ---------- */
  function pageText() {
    if (window.AppCtx) { const p = AppCtx.page(); return { label: p.label, text: p.text.slice(0, 6500), controls: p.controls, inner: p.inner }; }
    const p = document.getElementById('p-' + A.cur) || document.querySelector('.panel.on') || document.body; const label = (A.tabs[A.cur] && A.tabs[A.cur].label) || A.cur;
    const clone = p.cloneNode(true); clone.querySelectorAll('script,style,svg,canvas,#cmpc,#cmp,.acb,.tour,[data-private]').forEach(e => e.remove()); let t = (clone.innerText || clone.textContent || '').replace(/\n{3,}/g, '\n\n').replace(/[ \t]+/g, ' ').trim();
    return { label, text: t.slice(0, 6500), controls: [], inner: [] };
  }
  const pageBlock = cap => {
    const p = pageText(); if (!p.text) return '';
    return 'The user is on the "' + p.label + '" tab' + (p.inner && p.inner.length ? ' (' + p.inner.join(' > ') + ')' : '') + '. On screen now:\n"""\n' + p.text.slice(0, cap || 1600) + '\n"""' + (p.controls && p.controls.length ? '\nButtons and fields visible: ' + p.controls.slice(0, 20).join(' | ') : '');
  };
  const codeBlock = async q => { try { if (!window.AppCtx || !AppCtx.about(q)) return ''; const c = await AppCtx.context(q); return c ? 'Excerpts from Moundshroud\'s own files (real code - name the file when you use it):\n' + c.slice(0, 3600) : ''; } catch (e) { return ''; } };
  const stuffBlock = async q => {
    if (!/\b(my|mine|i (wrote|saved|added|typed)|in my|from my|our)\b/i.test(q)) return '';
    let out = '';
    try { const d = await A.api('/api/docs/search', { q: q, n: 4 }); (d.results || []).forEach((x, i) => { out += '\n[' + (i + 1) + '] ' + x.title + (x.page ? ' p.' + x.page : '') + ': ' + String(x.text || '').slice(0, 700); }); if (out) out = 'From the user\'s own files and notes:' + out; } catch (e) { }
    try { if (A.caps && A.caps.lib) { const l = await A.api('/api/lib/context', { q: q, n: 3 }); (l.sources || []).forEach((x, i) => { out += '\n* ' + x.title + (x.book ? ' (' + x.book + ')' : '') + ': ' + String(x.text || '').slice(0, 500); }); } } catch (e) { }
    return out;
  };
  const webBlock = async q => {
    try {
      if (!A.net || !A.net.on()) return '';
      const aboutUs = /\b(this|the)\s+(page|screen|tab|app|button|setting|chart|panel)\b|\bmoundshroud\b|\byou(r| are)\b/i.test(q) && !/\b(latest|newest|news|release|version out|on the web|online|search (the )?web)\b/i.test(q);
      if (aboutUs) return '';
      if (!/\?|\b(who|whom|whose|when|where|which|how much|how many|latest|newest|current|currently|today|tonight|news|price|cost|score|result|released?|version|weather|forecast|election|died|born|opening hours|schedule|standing|rank(ed|ing)?)\b/i.test(q)) return '';
      const r = await A.net.lookup(q);
      if (!r || r.error || !(r.pages || []).length) return '';
      const out = (r.pages || []).slice(0, 2).map((p, i) => '[' + (i + 1) + '] ' + (p.title || p.url) + ' - ' + p.url + '\n' + String(p.text || '').slice(0, 2600)).join('\n\n');
      return 'Read from the internet a moment ago (real pages, just now). Prefer these for anything that could have changed since you were trained, and name the site when you use one:\n' + out;
    } catch (e) { return ''; }
  };
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
    let ana = g.ana && g.ana.rows ? g.ana : null;
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
  const regBuddy = () => { try { A.companion.buddies().forEach(b => A.chars.reg({ id: 'bud:' + A.chars.slug(b.n), name: b.n, em: b.e, title: b.role || 'Your buddy in Moundshroud', bio: 'An animated free-roaming companion who walks around Moundshroud, interacts with the app, and helps with music, tabs, quizzes, pages and chess reviews.', realm: 'Moundshroud buddy' })); } catch (e) { } };
  const buddyCtx = () => { try { regBuddy(); return A.chars.context(bid(), 'You roam around Moundshroud and help the user interact with the app.'); } catch (e) { return ''; } };
  const persona = () => {
    const i = A.companion.info();
    return 'You are ' + i.n + ' (' + (i.role || 'Companion') + '), a friendly ' + i.e + ' companion who walks around Moundshroud, a private offline assistant running on the user\'s PC. Your personality is ' + (i.trait || 'warm, playful, and concise') + ' (usually 1 to 4 sentences, plain text, no markdown headers). You can see the page the user is on, read Moundshroud\'s own source files, and physically walk around the screen to click buttons, open tabs, highlight controls, type into inputs, switch themes, play music, analyze pages, review chess games, and run tools. RULE: you never discuss rated games or ratings of rated games; if the user brings them up, tease them playfully and change the subject.' + (A.net && A.net.on() ? ' Internet access is switched on, so you can look things up on the web: when you use something you just read, say which site it came from.' : '') + buddyCtx();
  };
  async function ask(messages, o) {
    o = o || {}; if (ctl) ctl.abort(); ctl = new AbortController(); const d = add('b', '...'); mood('think', 0); let out = '';
    try { const fn = o.coach ? ChessCoach.stream : A.ai.stream; out = await fn(messages, t => { d.textContent = t.replace(/\*\*/g, ''); logEl.scrollTop = logEl.scrollHeight; if (t.length < 12) mood('talk', 0); }, ctl.signal, { temp: o.temp || .5, private: 'screen' }); }
    catch (e) { if (e.name === 'AbortError') { d.remove(); return null; } d.textContent = 'My brain (the local AI) did not answer. If graphics memory is full, close other programs or turn on Low-power mode in Settings.'; mood('sad', 3000); return null; }
    out = String(out || '').replace(/\*\*/g, '').trim(); if (RATED.test(out)) out = roast();
    d.remove(); return out || 'Hmm, I drew a blank. Try asking another way?';
  }
  const finish = text => {
    if (text === null || text === undefined) return;
    try { A.chars.said(bid(), String(text)); } catch (e) { }
    add('b', String(text).replace(/\*\*/g, ''));
    mood('talk', Math.min(4000, 800 + String(text).length * 35));
    if (S.speak) try { A.speech.speakAsync(String(text).replace(/\*\*/g, '').slice(0, 600)); } catch (e) { }
  };

  /* run the same tools the main chat has (quiz, reminder, note, document...) */
  async function toolCall(text) {
    const sel = document.getElementById('model'), model = (sel && sel.value) || ''; const msgs = [{ role: 'system', content: persona() + A.actions.hint }].concat(S.log.slice(-6, -1), [{ role: 'user', content: text }]);
    const r = await fetch('/api/chat', { method: 'POST', body: JSON.stringify({ model, stream: false, think: false, keep_alive: '5m', tools: A.actions.schema, messages: msgs }) }); if (!r.ok) return null;
    const j = await r.json(), calls = (j.message && j.message.tool_calls) || []; if (!calls.length) return null;
    const out = [];
    for (const c of calls.slice(0, 2)) {
      try {
        out.push(await A.actions.run(c.function.name, c.function.arguments));
      } catch (e) { out.push('I could not do that: ' + e.message); }
    }
    return out.join('\n');
  }

  /* ---------- the brain: rated filter, physical commands, music, tabs, tools, then grounded chat ---------- */
  async function handle(raw) {
    const text = raw.trim(); if (!text) return;
    try { regBuddy(); A.chars.hear(bid(), text, { realm: 'Moundshroud buddy' }); } catch (e) { }
    if (RATED.test(text)) { mood('happy', 3500); return roast(); }
    const t = norm(text);
    let m;

    /* Music playback controls */
    if (/^(please )?(pause|stop|mute)( the)?( music| song| track| playing)?$/.test(t)) { try { A.musicLib.pause(); } catch (e) { } return 'Paused.'; }
    if (/^(please )?(resume|continue|unpause)( the)?( music| song)?$/.test(t)) { try { A.musicLib.toggle(); } catch (e) { } return 'Playing.'; }
    if (/^(please )?(next|skip)( the)?( song| track| music)?$/.test(t)) { try { A.musicLib.next(); } catch (e) { } return 'Skipped to the next one.'; }
    if ((m = /^(?:(?:hey|ok|okay|please|can you|could you|would you)\s+)*(?:play|put on|queue up|start playing|i want to hear|let me hear)\s+(.+)$/i.exec(text)) && !/\b(chess|game|games|tetris|snake|2048|sudoku|trivia|against|quiz|minesweeper|puzzle|intro|opening)\b/i.test(m[1])) return await playSong(m[1]);

    /* Physical movement, directions, tricks, clicking, pointing, typing, scrolling, theme/style switching */
    const phys = await tryPhysicalCommand(text);
    if (phys) return phys;

    /* Page analysis & Chess review */
    if (/\b(analy[sz]e|summari[sz]e|explain|read|look at|check|go over|review|what'?s on|what is on|tell me about|what am i looking at)\b.*\b(this|the|current|my)\b.*\b(page|screen|tab|section|view)\b|^what am i looking at|^analy[sz]e (it|this)$/.test(t)) return await analyzePage(text);
    if (/\b(review|analy[sz]e|go over|break ?down|critique|coach me on|how did i (play|do))\b.*\b(game|match|play|moves|chess)\b|^review (it|my game)|how did i play/.test(t) && !/\bpage\b/.test(t)) return await reviewGame(text);

    /* Open / Navigate to tab (with physical walking) */
    if ((m = /^(?:(?:hey|ok|okay|please|can you|could you)\s+)*(?:open|go to|take me to|show me|switch to|navigate to)\s+(?:the\s+)?(.+?)$/i.exec(text))) {
      const r = await openTab(m[1]);
      if (r) return r;
      const found = findTargetOnScreen(m[1], false);
      if (found && found.el && A.companion && A.companion.walkToEl) {
        note('🐾 Walking over to "' + found.label + '"...');
        await A.companion.walkToEl(found.el, { click: true, say: 'Opening!' });
        return 'Walked over and clicked **' + found.label + '**!';
      }
    }

    if (/^what can you do|^help$|^what do you do/.test(t)) {
      return 'I can physically walk around Moundshroud and do things for you! Try telling me:\n• "Walk to the top right", "Walk to the center", "Walk around", or "Run zoomies"\n• "Follow my cursor", "Stop following", or "Go home"\n• "Do a backflip", "Dance", "Spin", or "Wave"\n• "Click [any button]", "Point at Settings", or "Open Chess"\n• "Type hello into the chat box", "Scroll down", or "Use Jarvis style"\n• "Switch to Ember" (or Fenn, Inky, Bolt, Sloane, Pip, Miso, Hoot)\n• Or hold Alt and click anywhere on the screen to send me right there!';
    }

    try { if (A.actions && A.actions.looksActionable(text)) { const r = await toolCall(text); if (r) return r; } } catch (e) { }

    return await ask([{ role: 'system', content: persona() + await ground(text) }].concat(S.log.slice(-10, -1), [{ role: 'user', content: text }]));
  }

  async function send(txt) {
    if (!panel) build();
    const text = (txt !== undefined ? txt : inEl.value).trim();
    if (!text || S.busy) return;
    inEl.value = '';
    add('u', text);
    quick([]);
    S.busy = 1;
    try { const r = await handle(text); finish(r); }
    catch (e) { finish('Something went wrong: ' + (e.message || e)); mood('sad', 2500); }
    S.busy = 0;
    if (!ctl || !ctl.signal.aborted) mood(null);
    setTimeout(() => quick(['Walk around', 'Walk to top right', 'Do a dance', 'Click Settings', 'Follow my cursor', 'Go home']), 400);
  }

  const isDirectPhysical = raw => {
    const t = norm(raw);
    return /^(?:(?:hey|ok|okay|please|buddy|companion|pet|hoot|fenn|inky|bolt|ember|sloane|pip|miso)\s+)*(?:walk|roam|move around|run around|zoomies|follow my cursor|follow cursor|follow me|stop following|go home|back to corner|return to corner|do a flip|do a backflip|backflip|do a dance|dance|do a trick|point at|point to|where is|highlight|click on|click the|press the|tap the|stand on|perch on|sit on)\b/i.test(t);
  };

  A.buddy = { open, close, toggle, send, handle, tryPhysicalCommand, isDirectPhysical, openTab, findSongs, reviewGame, analyzePage, RATED, isRated: t => RATED.test(t), get opened() { return !!S.open; } };
})();

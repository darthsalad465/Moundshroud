// Entertainment > Arcade > Swindle Station: an original single-player comedy call-desk game. You work the phones at the
// Krillcorp Opportunity Hotline on space station Dross-7. Alien callers ring in; you talk to them by voice (Talk button,
// local speech-to-text) or by typing, and a local AI model plays each caller and answers out loud with a local voice.
// Win their trust, get them to read out the number your desk app needs, then cash it out in that app before the shift
// clock runs out. Office events (virus, fire, patrol sweep) and scambaiters get in the way. Meet Supervisor Pinch's
// quota for five shifts. Everything is made up: the callers, the Glimmers and the codes.
(() => {
  const P = A.play; if (!P) return;
  const rnd = n => Math.random() * n | 0, pick = a => a[rnd(a.length)], clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const esc = s => String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
  const DAYS = 5, MAX_LINES = 12;
  const APPS = {
    inv: { icon: '🧾', name: 'Invoice Desk', day: 1, label: 'invoice number', blurb: 'Bills the amount the caller agreed to pay.' },
    lotto: { icon: '🦆', name: 'Duck Lotto', day: 1, label: 'Duck Lotto ticket number', blurb: 'Scratch three numbers. Pays 0 to 1,000 Glimmers, with a 5% jackpot.' },
    coin: { icon: '🌙', name: 'MoonCoin', day: 2, label: 'MoonCoin wallet code', blurb: 'The coin climbs toward 700. Cash out before it crashes.' },
    link: { icon: '🖥️', name: 'LinkPal', day: 3, label: 'LinkPal access code', blurb: 'A slow transfer of 70% of their Glimmers. Keep them on the line until it ends.' },
    fine: { icon: '🚓', name: 'Parking Fines', day: 4, label: 'parking fine reference number', blurb: 'The agreed amount plus a 25% late fee.' }
  };
  const CALLERS = [
    { e: '🐙', name: 'Grandma Ooblek', who: 'a retired octopus who knits with all eight arms', style: 'Warm, chatty, loves gossip and calls everyone "dumpling".', loves: 'knitting, gossip, grandkids', why: 'a flyer promised free moon yarn', open: 'Hello, dumpling? The flyer said I could get free moon yarn by calling this number!', w: [260, 420], t: 55 },
    { e: '🤖', name: 'Unit B-0B', who: 'a very literal mining robot', style: 'Speaks in short robotic sentences and takes every word literally.', loves: 'efficiency, ore, numbers', why: 'its antenna picks up only static', open: 'GREETINGS. MY ANTENNA RECEIVES ONLY STATIC. STATE YOUR SOLUTION.', w: [280, 460], t: 45 },
    { e: '🐌', name: 'Sir Slowmo Trail', who: 'a vain aristocrat slug', style: 'Pompous and slow, adores compliments about his shine.', loves: 'luxury, compliments, shine', why: 'he wants an exclusive holiday nobody else can get', open: 'Ahem. I was told this line offers holidays for the truly distinguished. Impress me.', w: [380, 620], t: 40 },
    { e: '👽', name: 'Zib Zorbo', who: 'a teenage alien gamer', style: 'Bored, uses slang, gets excited about prizes and loot.', loves: 'games, prizes, loot', why: 'a pop-up said he won a prize', open: 'yo, a pop-up said I won something?? is this real or what', w: [160, 300], t: 50 },
    { e: '🍄', name: 'Mossy Pell', who: 'a nervous mushroom farmer', style: 'Jumpy and worried, fears gravity storms and spores.', loves: 'spores, damp corners, safety', why: 'his gravity bill doubled', open: 'H-hello? My gravity bill doubled and my spores are floating away. Can you help?', w: [220, 380], t: 40 },
    { e: '🦀', name: 'Captain Clatter', who: 'a crab who used to be a space pirate', style: 'Gruff, haggles over everything, respects boldness.', loves: 'treasure, haggling, shanties', why: 'he heard there is cheap treasure insurance', open: 'Arr. Heard ye sell treasure insurance. Make it quick and make it cheap.', w: [320, 540], t: 35 },
    { e: '🧊', name: 'Frostine Vell', who: 'an ice-comet accountant', style: 'Cold, precise, asks for paperwork, very hard to fool.', loves: 'spreadsheets, receipts, rules', why: 'she found an unexplained charge from Krillcorp', open: 'This is Frostine Vell. I have an unexplained Krillcorp charge on my ledger. Explain it.', w: [480, 760], t: 25 },
    { e: '🐸', name: 'Bloop the Fourth', who: 'a frog prince of a tiny pond moon', style: 'Grand and gullible, believes anything that sounds royal.', loves: 'royalty, ponds, titles', why: 'a letter said he may be heir to a second pond', open: 'Bloop the Fourth speaking! A royal letter said I may inherit a second pond!', w: [320, 560], t: 60 },
    { e: '🌵', name: 'Prickla Dune', who: 'a cactus courier always in a hurry', style: 'Impatient, talks fast, hates long speeches.', loves: 'speed, shortcuts, deliveries', why: 'her delivery scooter warranty ran out', open: 'Hi, quick, my scooter warranty ran out, can you fix it fast? I have nine parcels waiting.', w: [200, 360], t: 40 },
    { e: '🦉', name: 'Professor Hoot-Hoot', who: 'a pedantic owl scholar', style: 'Corrects grammar, loves facts and long words.', loves: 'facts, books, big words', why: 'he wants to claim an academic grant he read about', open: 'Good evening. I am inquiring, grammatically, about the so-called Galactic Scholar Grant.', w: [260, 460], t: 35 }
  ];
  const PINCH = {
    hello: ['Morning, rookie. The quota is the quota. Click-clack, get dialing.', 'You again? Good. The shareholders are three crabs in a coat, and they are hungry.', 'Rise and shine. Glimmers do not swindle themselves.'],
    good: ['Not bad. I almost smiled. Do not tell anyone.', 'Quota met. Your desk plant may stay another day.', 'Excellent clacking. Keep it up.'],
    bad: ['That is not the quota. That is a rounding error. You are FIRED.', 'Pack your desk plant. Security will walk you to the airlock (the nice airlock).']
  };
  const MOODS = [[80, 'Trusting', '😊'], [60, 'Friendly', '🙂'], [40, 'Unsure', '😐'], [20, 'Suspicious', '🤨'], [0, 'Angry', '😠']];
  const mood = t => MOODS.find(m => t >= m[0]) || MOODS[4];
  const makeCode = () => String.fromCharCode(65 + rnd(26), 65 + rnd(26)) + '-' + (1000 + rnd(9000));
  const norm = s => String(s || '').toUpperCase().replace(/[^A-Z0-9]/g, '');

  /* practice callers: used when no AI model is chosen, or when the model gives no answer */
  const LINES = {
    Trusting: ['Oh, you are wonderful. What do I need to do?', 'I trust you completely, dear. Go on!'],
    Friendly: ['That sounds nice. Tell me more.', 'Hmm, I like the sound of that.'],
    Unsure: ['I am not sure about this. Who are you again?', 'Is that so? It sounds a bit odd.'],
    Suspicious: ['This sounds fishy, and I know fish.', 'My cousin warned me about calls like this.'],
    Angry: ['That is it, I am hanging up!', 'How rude! Goodbye!']
  };
  function offline(st, text) {
    const t = text.toLowerCase(), c = st.c; let d = rnd(5) - 2;
    const kind = (t.match(/please|thank|friend|sorry|haha|lol|love|wonderful|amazing|lovely|beautiful|dear|kind|deserve|help/g) || []).length;
    if (kind) { st.flat = (st.flat || 0) + 1; d += st.flat > 2 ? -6 : Math.min(2, kind) * 7; }   // flattery works twice per call
    if (c.loves.split(/,\s*/).some(w => t.includes(w.split(' ').pop()))) d += 10;
    if (/\b(now|hurry|immediately|urgent|last chance|or else)\b/.test(t)) d -= 15;
    if (/stupid|idiot|shut up|dumb/.test(t)) d -= 25;
    const askPay = /pay|glimmer|fee|cost|price|\d{2,}/.test(t), askCode = /code|number|ticket|invoice|reference|wallet|read/.test(t);
    if (askPay && st.trust < 50) d -= 10; if (askCode && st.trust < 55) d -= 8;
    if (t.length < 12) d -= 4; else if (t.length > 80) d += 3;
    const trust = clamp(Math.round(st.trust + d), 0, 100), m = mood(trust)[1];
    let say = pick(LINES[m]), agree = 0;
    if (askPay && trust >= 50) { agree = Math.round(st.wallet * (0.3 + (trust - 50) / 150)); say = 'Alright, I can pay ' + agree + ' Glimmers.'; }
    if (askCode && trust >= 55 && st.app) say = 'My ' + APPS[st.app].label + '? It is ' + (st.bait ? makeCode() : st.code) + '.';
    return { say, trust, agree, hangup: trust <= 0 };
  }
  const sysPrompt = st => {
    const c = st.c, a = st.app && APPS[st.app];
    return 'You are ' + c.name + ', ' + c.who + ', living on space station Dross-7. ' + c.style + ' This is a silly comedy game and everything is made up. ' +
      'You phoned the Krillcorp Opportunity Hotline because ' + c.why + '. The hotline worker will try to sell you something or get Glimmers (made-up space money) from you. You have ' + st.wallet + ' Glimmers. ' +
      'Your trust in them is ' + st.trust + ' out of 100. Raise trust when they are friendly, funny, patient, sound official and consistent, help with why you called, or mention things you love (' + c.loves + '). ' +
      'Lower trust when they are rude, pushy, contradict themselves, or rush you. If they ask you to pay and your trust is 50 or more, you may agree to pay some Glimmers: put the amount in "agree". ' +
      (st.bait ? 'SECRET: you are a scambaiter who wastes scammers\' time. Act very gullible and excited, and if asked for any number or code, invent a fake one. ' :
        a ? 'Their screen needs your ' + a.label + '. If your trust is 55 or more and they ask for it, read it out exactly: ' + st.code + '. Never say a different number. ' : 'You have no codes to give yet. ') +
      'If trust reaches 0 you hang up angrily. Reply in 1 to 3 short spoken sentences. Answer with JSON only: {"say":"your words","trust":0,"agree":0,"hangup":false}';
  };
  const CSS = '.sws{display:flex;flex-direction:column;gap:10px;padding:12px;height:100%;box-sizing:border-box;overflow:auto;color:var(--text)}' +
    '.sws>*{flex-shrink:0}.sws .swbar{display:flex;flex-wrap:wrap;gap:6px 14px;align-items:center;font-size:14px}.sws .q{flex:1;min-width:140px;height:12px;border-radius:6px;background:var(--panel2);overflow:hidden;border:1px solid var(--line)}' +
    '.sws .q>i{display:block;height:100%;background:var(--ok);transition:width .4s}.sws .clock{font-variant-numeric:tabular-nums;font-weight:700;padding:2px 8px;border-radius:6px;background:var(--panel2)}.sws .clock.low{color:var(--bad)}' +
    '.sws .swcard{background:var(--panel);border:1px solid var(--line);border-radius:12px;padding:12px}.sws .boss{display:flex;gap:14px;align-items:center}' +
    '.sws .face{font-size:56px;line-height:1;width:84px;height:84px;display:grid;place-items:center;border-radius:50%;background:radial-gradient(circle at 35% 30%,var(--panel2),var(--bg));border:2px solid var(--line);flex:none}' +
    '.sws .say{background:var(--panel2);border-radius:12px;padding:10px 12px}.sws .desk{display:flex;flex-wrap:wrap;gap:10px;align-items:stretch}.sws .desk>.phone{flex:1.25 1 300px;height:460px;box-sizing:border-box}.sws .desk>.swpc{flex:1 1 260px;min-height:360px;box-sizing:border-box}' +
    '.sws .phone,.sws .swpc{display:flex;flex-direction:column;gap:8px;position:relative}.sws .phone>*{flex-shrink:0}.sws .phone>.log{flex:1 1 0;min-height:80px}.sws .ttl{font-size:12px;color:var(--mute);letter-spacing:.06em;text-transform:uppercase}' +
    '.sws .who{display:flex;gap:10px;align-items:center}.sws .who .face{width:56px;height:56px;font-size:38px}.sws .who .face.mad{border-color:var(--bad);transform:rotate(-6deg)}' +
    '.sws .tb{height:12px;border-radius:6px;background:var(--panel2);border:1px solid var(--line);overflow:hidden}.sws .tb>i{display:block;height:100%;transition:width .4s,background .4s}' +
    '.sws .log{flex:1;overflow:auto;display:flex;flex-direction:column;gap:6px;padding:8px;background:var(--bg);border:1px solid var(--line);border-radius:10px}' +
    '.sws .swm{max-width:82%;padding:7px 10px;border-radius:12px;font-size:14px;line-height:1.35}.sws .swm.me{align-self:flex-end;background:var(--acc);color:var(--onacc,#fff)}.sws .swm.them{align-self:flex-start;background:var(--panel2)}.sws .swm.sys{align-self:center;font-size:12px;color:var(--mute);background:none;text-align:center}' +
    '.sws .swrow{display:flex;gap:6px;flex-wrap:wrap;align-items:center}.sws input[type=text]{flex:1;min-width:150px;padding:9px 10px;border-radius:8px;border:1px solid var(--line);background:var(--panel2);color:var(--text);font-size:14px}' +
    '.sws .swring{display:flex;flex-direction:column;align-items:center;gap:10px;margin:auto;text-align:center}.sws .swring .face{animation:swring .5s ease-in-out infinite alternate}@keyframes swring{from{transform:rotate(-8deg)}to{transform:rotate(8deg)}}' +
    '.sws .term{margin:auto;text-align:center;padding:14px;border:2px solid var(--bad);border-radius:10px;color:var(--bad);font-weight:800;letter-spacing:.1em}' +
    '.sws .icons{display:flex;gap:6px;flex-wrap:wrap}.sws .icon{display:flex;flex-direction:column;align-items:center;gap:2px;width:72px;padding:6px 2px;border-radius:8px;border:1px solid var(--line);background:var(--panel2);color:var(--text);cursor:pointer;font-size:11px}.sws .icon b{font-size:24px}.sws .icon.on{border-color:var(--acc)}.sws .icon:disabled{opacity:.4;cursor:default}' +
    '.sws .app{flex:1;background:var(--bg);border:1px solid var(--line);border-radius:10px;padding:10px;display:flex;flex-direction:column;gap:8px;overflow:auto}' +
    '.sws .scr{display:flex;gap:8px}.sws .scr button{flex:1;height:64px;font-size:20px;font-weight:700;border-radius:10px;border:1px dashed var(--line);background:var(--panel2);color:var(--text);cursor:pointer}' +
    '.sws .virus{position:absolute;inset:0;background:rgba(40,0,10,.85);border-radius:12px;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:8px;color:#fff;text-align:center;padding:10px}' +
    '.sws .ev{display:flex;gap:10px;align-items:center;padding:10px 12px;border-radius:10px;border:2px solid var(--warn);background:var(--panel)}.sws .swbig{font-size:26px;font-weight:700}.sws .mute{color:var(--mute)}';

  P.games.swindle = { name: 'Swindle Station', icon: '☎️', desc: 'Work the phones at a shady space-station hotline. Talk or type to alien callers played by your local AI, win their trust, get the code your desk app needs and cash it out before the shift ends.', mount(el, api) {
    let dead = false, ctl = null, models = [], useModel = '', voices = null, audio = null, tick = 0, st = null, last = 0;
    const lvl = api.level == null ? 1 : api.level;
    const G = { open: null, day: 1, total: 0, today: 0, quota: 0, left: 0, phase: 'off', wait: 0, nextEv: 0, ev: null, virus: 0, run: null, calls: 0, wins: 0, cut: 0 };
    const q = s => el.querySelector(s), muted = () => ls.get('swindle_mute', '0') === '1';
    const quotaFor = d => Math.round((350 + (d - 1) * 150) * [0.75, 1, 1.3][lvl]);
    const shiftMs = () => [6, 5, 4][lvl] * 60000;
    const fmt = ms => { const s = Math.max(0, Math.ceil(ms / 1000)); return Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0'); };
    const view = h => { if (dead) return; el.innerHTML = '<style>' + CSS + '</style><div class="sws">' + h + '</div>'; };
    const boss = (line, extra) => '<div class="swcard boss"><div class="face" title="Supervisor Pinch">🦞</div><div><div class="mute small">Supervisor Pinch</div><div class="say">' + esc(line) + '</div>' + (extra || '') + '</div></div>';
    const bar = () => '<div class="swbar"><b>Shift ' + G.day + ' of ' + DAYS + '</b><span>⏱ <span class="clock" id="swclock">' + fmt(G.left) + '</span></span><span id="swtoday">Today: ' + G.today + ' / ' + G.quota + '</span><div class="q"><i id="swq" style="width:' + clamp(G.today / G.quota * 100, 0, 100) + '%"></i></div><span id="swtotal">Total ' + G.total + '</span></div>';
    function paintBar() {
      const c = q('#swclock'); if (c) { c.textContent = fmt(G.left); c.classList.toggle('low', G.left < 30000); }
      const t = q('#swtoday'); if (t) t.textContent = 'Today: ' + G.today + ' / ' + G.quota; const b = q('#swq'); if (b) b.style.width = clamp(G.today / G.quota * 100, 0, 100) + '%';
      const o = q('#swtotal'); if (o) o.textContent = 'Total ' + G.total;
      api.hud('Shift ' + G.day + '/' + DAYS + ' · ' + fmt(G.left) + ' left · today ' + G.today + '/' + G.quota + ' · total ' + G.total);
    }
    function ring() {
      if (muted()) return; try { const ac = new (window.AudioContext || window.webkitAudioContext)(), g = ac.createGain(); g.gain.value = .06; g.connect(ac.destination);
        [0, .55].forEach(t0 => [440, 480].forEach(f => { const o = ac.createOscillator(); o.frequency.value = f; o.connect(g); o.start(ac.currentTime + t0); o.stop(ac.currentTime + t0 + .4); }));
        setTimeout(() => ac.close(), 1300); } catch (e) { }
    }
    function stopVoice() { try { if (audio) audio.pause(); } catch (e) { } audio = null; try { if (A.speech) A.speech.stop(); } catch (e) { } }
    async function speak(text) {
      if (dead || muted() || !st) return; stopVoice();
      try {
        if (!voices) voices = ((await (await fetch('/api/tts/voices')).json()).voices || []).map(v => v.id || v.name || v).filter(v => typeof v === 'string' && /en/i.test(v));
        if (voices.length) {
          const r = await fetch('/api/tts', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ voice: voices[CALLERS.indexOf(st.c) % voices.length], text, length: 1 }) });
          if (r.ok && !dead) { const url = URL.createObjectURL(await r.blob()); const au = new Audio(url); audio = au; await new Promise(res => { au.onended = au.onerror = res; au.play().catch(res); }); URL.revokeObjectURL(url); return; }
        }
      } catch (e) { }
      if (!dead && A.speech && A.speech.speakAsync) await A.speech.speakAsync(text);
    }

    async function setup() {
      G.phase = 'off';
      try { const r = await (await fetch('/api/models')).json(); models = (r.models || []).filter(m => !m.cloud && !/embed/i.test(m.name)).map(m => m.name); } catch (e) { models = []; }
      try { useModel = A.ai && A.ai.localModel ? await A.ai.localModel() : ''; } catch (e) { useModel = ''; }
      if (!models.includes(useModel)) useModel = models[0] || '';
      const opts = models.map(m => '<option' + (m === useModel ? ' selected' : '') + '>' + esc(m) + '</option>').join('') + '<option value="">Practice callers (no AI)</option>';
      view('<div class="swcard boss"><div class="face">☎️</div><div><div class="swbig">Swindle Station</div><div class="mute">Krillcorp Opportunity Hotline · space station Dross-7</div></div></div>' +
        boss('Welcome to the Hotline, rookie. Callers ring in. Talk to them, win their trust, and get them to read out the number your desk app needs: a ticket, an invoice, a wallet code. Type it into the app to cash out. Beat my quota before the shift clock runs out, five shifts in a row, and you get promoted.') +
        '<div class="swcard"><div class="swrow"><label>Callers are played by <select id="swmodel">' + opts + '</select></label><label><input type="checkbox" id="swmute"' + (muted() ? '' : ' checked') + '> Callers speak out loud</label><button class="pri" id="swgo">Clock in</button></div>' +
        '<div class="mute small" style="margin-top:8px">Press 🎙️ Talk and speak, or type and press Enter. Speech is turned into text on this PC. Open an app on the desk computer before you ask for a number, so the caller knows what to read out. The clock pauses while a caller is thinking. Everything is made up: alien callers, fake money, fake codes.</div></div>');
      q('#swgo').onclick = () => { useModel = q('#swmodel').value; ls.set('swindle_mute', q('#swmute').checked ? '0' : '1'); startDay(); };
    }
    function startDay() {
      Object.assign(G, { today: 0, quota: quotaFor(G.day), left: shiftMs(), phase: 'brief', ev: null, virus: 0, run: null, calls: 0, wins: 0, cut: 0 }); G.nextEv = G.left - (40000 + rnd(30000)); st = null;
      const fresh = Object.keys(APPS).filter(k => APPS[k].day === G.day).map(k => APPS[k].icon + ' ' + APPS[k].name);
      view(bar() + boss(pick(PINCH.hello) + ' Today\'s quota is ' + G.quota + ' Glimmers in ' + fmt(G.left) + '.', fresh.length && G.day > 1 ? '<div class="say" style="margin-top:8px">🆕 New app unlocked: ' + esc(fresh.join(', ')) + '</div>' : '') + '<div class="swrow"><button class="pri" id="swstart">Start the shift</button></div>');
      paintBar(); q('#swstart').onclick = desk;
    }
    function desk() {
      G.phase = 'break'; G.wait = 2500;
      view(bar() + '<div class="desk"><div class="swcard phone" id="swphone"></div><div class="swcard swpc"><div class="ttl">Dross-OS desk computer</div><div class="icons" id="swicons"></div><div class="app" id="swapp"></div><div id="swvirus"></div></div></div><div id="swev"></div>');
      icons(); openApp(null); phoneIdle('Waiting for the next call…'); last = performance.now();
      clearInterval(tick); tick = setInterval(loop, 250);
    }
    /* the shift clock: pauses while the caller (the model) is thinking */
    function loop() {
      if (dead) return; const now = performance.now(), dt = now - last; last = now;
      if (!['break', 'ring', 'call'].includes(G.phase)) return;
      if (!(st && st.busy)) G.left -= dt;
      if (G.run) runApp(now);
      if (G.ev && now > G.ev.until) evFail();
      if (G.left <= G.nextEv && !G.ev && !G.virus) { G.nextEv = G.left - (45000 + rnd(35000)); event(); }
      if (G.phase === 'break') { G.wait -= dt; if (G.wait <= 0) incoming(); }
      else if (G.phase === 'ring') { G.wait -= dt; if (G.wait <= 0) { G.phase = 'break'; G.wait = 4000; phoneIdle('Missed call. Pinch saw that.'); } }
      if (G.left <= 0) return endShift();
      paintBar();
    }
    /* ---------- the phone ---------- */
    function phoneIdle(msg) { const p = q('#swphone'); if (p) p.innerHTML = '<div class="ttl">Phone</div><div class="swring"><div class="face" style="animation:none">☎️</div><div class="mute">' + esc(msg) + '</div></div>'; }
    function incoming() {
      const c = pick(CALLERS); G.phase = 'ring'; G.wait = 12000; ring();
      const bait = G.day > 1 && Math.random() < .2;
      st = { c, bait, trust: c.t, wallet: c.w[0] + rnd(c.w[1] - c.w[0]), code: makeCode(), app: null, agree: 0, cashed: false, hist: [], over: false, busy: false, lines: 0, flat: 0 };
      const p = q('#swphone'); if (!p) return;
      p.innerHTML = '<div class="ttl">Phone</div><div class="swring"><div class="face">' + c.e + '</div><div><b>📞 Incoming call: ' + esc(c.name) + '</b><div class="mute small">' + esc(c.who) + '</div></div><div class="swrow"><button class="pri" id="swacc">Accept</button><button class="ib" id="swdec">Decline</button></div></div>';
      q('#swacc').onclick = accept; q('#swdec').onclick = () => { st = null; G.phase = 'break'; G.wait = 5000; phoneIdle('Declined. Next call in a few seconds…'); };
    }
    function accept() {
      const c = st.c; G.phase = 'call'; G.calls++;
      q('#swphone').innerHTML = '<div class="ttl">Phone · on a call</div><div class="who"><div class="face" id="swface">' + c.e + '</div><div style="flex:1"><b>' + esc(c.name) + '</b><div class="mute small">' + esc(c.who) + '</div>' +
        '<div class="swrow small" style="margin-top:4px"><span>Caller trust</span><span id="swmood"></span></div><div class="tb"><i id="swtrust"></i></div></div></div><div class="log" id="swlog"></div>' +
        '<div class="swrow"><button class="ib" id="swmic" title="Speak your line">🎙️ Talk</button><input type="text" id="swin" maxlength="300" placeholder="Type to the caller…" autocomplete="off"><button class="pri" id="swsend">Send</button></div>' +
        '<div class="swrow"><button class="ib" id="swspk">' + (muted() ? '🔇 Caller voice off' : '🔊 Caller voice on') + '</button><button class="ib" id="swhang">📴 Hang up</button><span class="mute small" id="swinfo"></span></div>';
      const inp = q('#swin'); inp.onkeydown = e => { e.stopPropagation(); if (e.key === 'Enter') send(inp.value); else if (e.key === 'Escape') inp.blur(); };
      q('#swsend').onclick = () => send(q('#swin').value); q('#swhang').onclick = () => endCall('You hung up.');
      q('#swmic').onclick = talk; q('#swspk').onclick = () => { ls.set('swindle_mute', muted() ? '0' : '1'); if (muted()) stopVoice(); q('#swspk').textContent = muted() ? '🔇 Caller voice off' : '🔊 Caller voice on'; };
      add('sys', 'Connected. ' + (useModel ? c.name + ' is played by ' + useModel + '.' : 'Practice caller.') + ' They called because ' + c.why + '.');
      add('them', c.open); speak(c.open); paint(); icons(); if (!G.run) openApp(G.open && G.open !== 'zap' ? G.open : null); inp.focus();
    }
    function add(who, text) { const log = q('#swlog'); if (!log) return null; const d = document.createElement('div'); d.className = 'swm ' + who; d.textContent = text; log.appendChild(d); log.scrollTop = log.scrollHeight; return d; }
    function paint() {
      if (!st || dead) return; const [, name, face] = mood(st.trust), bar = q('#swtrust');
      if (bar) { bar.style.width = st.trust + '%'; bar.style.background = st.trust >= 60 ? 'var(--ok)' : st.trust >= 30 ? 'var(--warn)' : 'var(--bad)'; }
      const m = q('#swmood'); if (m) m.textContent = face + ' ' + name + ' · ' + st.trust + '%';
      const f = q('#swface'); if (f) f.classList.toggle('mad', st.trust < 20);
      const i = q('#swinfo'); if (i) i.textContent = (st.agree ? 'Agreed to pay ' + st.agree + ' · ' : '') + (MAX_LINES - st.lines) + ' lines left';
      const busy = st.busy || st.over; ['#swin', '#swsend', '#swmic'].forEach(s => { const x = q(s); if (x) x.disabled = busy; });
    }
    function talk() {
      if (!st || st.busy || st.over) return; if (!A.voice || !A.voice.available()) return A.toast('No microphone here. Type instead.');
      if (A.voice.rec) return A.voice.stop(); stopVoice();
      A.voice.start(t => { if (t) send(t); }, s => { const m = q('#swmic'); if (!m) return; m.classList.toggle('on', s === 'rec'); m.textContent = s === 'rec' ? '⏹ Listening' : s === 'busy' ? '… Hearing' : '🎙️ Talk'; }, { auto: true });
    }
    async function ask(text) {
      if (!useModel) return offline(st, text);
      ctl = new AbortController(); const bubble = add('them', '…');
      const msgs = [{ role: 'system', content: sysPrompt(st) }].concat(st.hist.slice(-12), [{ role: 'user', content: text }]);
      const tmr = setTimeout(() => ctl && ctl.abort(), 90000);
      try {
        let raw = '', j = null;
        for (let n = 0; n < 2 && !(j && typeof j.say === 'string'); n++) {   // a second try covers a model reload or one off-format answer
          raw = await A.ai.stream(msgs, t => { const m = /"say"\s*:\s*"((?:[^"\\]|\\.)*)/.exec(t); if (m && bubble) bubble.textContent = m[1].replace(/\\"/g, '"').replace(/\\n/g, ' '); }, ctl.signal, { model: useModel, temp: .8 });
          j = A.ai.json(raw);
        }
        if (bubble) bubble.remove();
        if (!j || typeof j.say !== 'string') { const o = offline(st, text); if (raw && raw.trim() && !/[{}]/.test(raw)) o.say = raw.trim().slice(0, 300); else add('sys', useModel + ' gave no answer, so a practice caller answered this line.'); return o; }
        return { say: j.say, trust: +j.trust, agree: Math.max(0, +j.agree || 0), hangup: j.hangup === true };
      } catch (e) { if (bubble) bubble.remove(); if (dead || !st || st.over) throw e; add('sys', 'The line crackled, so a practice caller answered this one.'); return offline(st, text); }
      finally { clearTimeout(tmr); ctl = null; }
    }
    async function send(raw) {
      const text = String(raw || '').trim(); if (!st || st.busy || st.over || !text) return;
      const inp = q('#swin'); if (inp) inp.value = ''; stopVoice(); add('me', text); st.busy = true; st.lines++; paint();
      const me = st; let r; try { r = await ask(text); } catch (e) { return; } if (dead || st !== me || st.over) return;
      const prev = st.trust, want = isFinite(r.trust) ? r.trust : prev;
      st.trust = clamp(Math.round(prev + clamp(want - prev, -25, 20)), 0, 100);
      if (r.agree > 0 && st.trust >= 40) st.agree = Math.min(st.wallet, Math.max(st.agree, Math.round(r.agree)));
      add('them', r.say || '…'); st.hist.push({ role: 'user', content: text }, { role: 'assistant', content: JSON.stringify({ say: r.say, trust: st.trust, agree: st.agree, hangup: false }) });
      st.busy = false; paint(); speak(r.say || '');
      if (r.hangup || st.trust <= 0) return endCall(st.c.name + ' hung up angrily.', true);
      if (st.lines >= MAX_LINES) return endCall(st.c.name + ' had to go. Out of lines.');
      const i = q('#swin'); if (i) i.focus();
    }
    function endCall(why, angry) {
      if (!st || st.over) return; st.over = true; if (ctl) ctl.abort(); try { if (A.voice && A.voice.rec) A.voice.stop(true); } catch (e) { }
      if (angry) G.cut++; paint();
      const p = q('#swphone'), card = document.createElement('div');
      card.innerHTML = angry ? '<div class="term">CALL TERMINATED</div>' : '<div class="swm sys">' + esc(why) + '</div>';
      const log = q('#swlog'); if (log) { log.appendChild(card); if (angry) add('sys', why); log.scrollTop = log.scrollHeight; }
      const end = () => { if (st && st.over && G.phase === 'call') toBreak(5000); };
      setTimeout(end, angry ? 2500 : 1800); if (p) p.dataset.done = '1';
    }
    function toBreak(ms) { st = null; G.phase = 'break'; G.wait = ms; phoneIdle('Short break. Next call coming…'); if (!G.run) { icons(); openApp(G.open === 'zap' ? 'zap' : null); } }
    /* ---------- the desk computer ---------- */
    function icons() {
      const box = q('#swicons'); if (!box) return;
      box.innerHTML = Object.keys(APPS).filter(k => APPS[k].day <= G.day).map(k => '<button class="icon" data-app="' + k + '"><b>' + APPS[k].icon + '</b>' + esc(APPS[k].name) + '</button>').join('') + '<button class="icon" data-app="zap"><b>🪲</b>BugZapper</button>';
      box.querySelectorAll('.icon').forEach(b => b.onclick = () => openApp(b.dataset.app));
    }
    function openApp(id) {
      const box = q('#swapp'); if (!box) return; if (G.run) { if (id !== G.run.kind) A.toast('Finish the running ' + APPS[G.run.kind].name + ' first.'); return; }
      G.open = id; q('#swicons').querySelectorAll('.icon').forEach(b => b.classList.toggle('on', b.dataset.app === id));
      if (id === 'zap') { box.innerHTML = '<b>🪲 BugZapper</b><div class="mute small">Antivirus for Dross-OS.</div>' + (G.virus ? '<div>🦠 Viruses found: ' + G.virus + '</div><button class="pri" id="swzap">Remove virus</button>' : '<div>✅ No viruses found.</div>'); const z = q('#swzap'); if (z) z.onclick = () => { G.virus--; if (!G.virus) paintVirus(); openApp('zap'); }; return; }
      if (!id) { box.innerHTML = '<div class="mute small">Open an app. During a call, the caller then knows which number your screen needs.</div>'; return; }
      const a = APPS[id]; if (st && !st.over && !st.cashed) st.app = id;
      box.innerHTML = '<b>' + a.icon + ' ' + esc(a.name) + '</b><div class="mute small">' + esc(a.blurb) + '</div>' +
        (st && !st.over ? (st.cashed ? '<div>This caller already paid.</div>' : '<div class="small">Ask the caller for their <b>' + esc(a.label) + '</b>' + (id === 'inv' || id === 'fine' ? ' and agree a price.' : '.') + '</div><div class="swrow"><input type="text" id="swcode" placeholder="' + esc(a.label) + '" autocomplete="off"><button class="pri" id="swsub">Submit</button></div>') : '<div class="mute">Take a call first.</div>') +
        '<div id="swout"></div>';
      const c = q('#swcode'); if (c) { c.onkeydown = e => { e.stopPropagation(); if (e.key === 'Enter') submit(id); }; q('#swsub').onclick = () => submit(id); }
    }
    const out = h => { const o = q('#swout'); if (o) o.innerHTML = h; };
    function submit(id) {
      if (!st || st.over || st.cashed) return; if (G.virus) return out('🦠 The virus is blocking every app. Open BugZapper.');
      const v = norm(q('#swcode').value); if (!v) return;
      if (v !== norm(st.code)) { if (st.bait) { st.cashed = true; out('❌ Code rejected. ' + esc(st.c.name) + ' was a <b>scambaiter</b> wasting your time!'); add('sys', '🎣 Scambaiter! That number was fake.'); return; } return out('❌ Code rejected. Ask the caller to read it again.'); }
      if (st.trust < 30) return out('❌ ' + esc(st.c.name) + ' cancelled it. Raise their trust first.');
      if (id === 'inv' || id === 'fine') { if (!st.agree) return out('No price agreed yet. Get the caller to agree to pay an amount.'); credit(id === 'fine' ? Math.min(st.wallet, Math.round(st.agree * 1.25)) : st.agree); q('#swcode').disabled = true; q('#swsub').disabled = true; return; }
      const who = st; st.cashed = true; q('#swcode').disabled = true; q('#swsub').disabled = true;
      if (id === 'lotto') { const jack = Math.random() < .05, vals = jack ? [333, 333, 334] : [rnd(201), rnd(201), rnd(201)]; let n = 0;
        out('<div class="small">Scratch all three:</div><div class="scr">' + vals.map((x, i) => '<button data-i="' + i + '">?</button>').join('') + '</div>');
        q('#swout').querySelectorAll('.scr button').forEach(b => b.onclick = () => { if (b.textContent !== '?') return; b.textContent = vals[+b.dataset.i]; if (++n === 3) credit(vals[0] + vals[1] + vals[2], jack ? '🎰 JACKPOT! ' : '', who); }); return; }
      if (id === 'coin') { G.run = { kind: 'coin', t0: performance.now(), crash: 4000 + rnd(18000), who }; out('<div class="swbig" id="swcv">40</div><div class="mute small">MoonCoin value in Glimmers</div><button class="pri" id="swcash">Cash out</button>'); q('#swcash').onclick = () => { const r = G.run; if (!r || r.kind !== 'coin') return; G.run = null; credit(r.val || 40, '', r.who); afterRun(); }; return; }
      if (id === 'link') { G.run = { kind: 'link', t0: performance.now(), dur: 25000, who: st }; out('<div class="tb"><i id="swlp" style="width:0;background:var(--acc)"></i></div><div class="small" id="swlt">Transferring… keep ' + esc(st.c.name) + ' on the line.</div>'); add('sys', '🖥️ LinkPal transfer started. Keep them talking for 25 seconds.'); }
    }
    function runApp(now) {
      const r = G.run, t = now - r.t0;
      if (r.kind === 'coin') { if (t >= r.crash) { G.run = null; out('<div class="swbig" style="color:var(--bad)">💥 0</div><div>MoonCoin crashed. Nothing to cash out.</div>'); if (st) add('sys', '🌙 MoonCoin crashed.'); afterRun(); return; } r.val = Math.round(40 + 660 * Math.pow(t / 22000, 1.3)); const e = q('#swcv'); if (e) e.textContent = r.val; return; }
      if (r.kind === 'link') {
        if (r.who.over || st !== r.who) { G.run = null; out('❌ The call ended before the transfer finished. Nothing collected.'); afterRun(); return; }
        const p = q('#swlp'); if (p) p.style.width = clamp(t / r.dur * 100, 0, 100) + '%';
        if (t >= r.dur) { G.run = null; credit(Math.round(r.who.wallet * .7), '', r.who); }
      }
    }
    function afterRun() { if (G.phase === 'break') setTimeout(() => { if (!G.run && G.phase === 'break') { icons(); } }, 0); }
    function credit(n, pre, who) {
      who = who || st; if (!who) return; who.cashed = true; G.today += n; G.total += n; if (n > 0) G.wins++;
      out('<div class="swbig" style="color:var(--ok)">+' + n + '</div><div>' + (pre || '') + 'Glimmers collected from ' + esc(who.c.name) + '.</div>'); if (st === who) add('sys', '💰 ' + (pre || '') + 'Collected ' + n + ' Glimmers.'); paintBar();
    }
    /* ---------- office events ---------- */
    function paintVirus() { const v = q('#swvirus'); if (v) v.innerHTML = G.virus ? '<div class="virus"><div class="swbig">🦠 VIRUS!</div><div>Your apps are locked. Pop-ups everywhere. Open 🪲 BugZapper and click Remove virus (' + G.virus + ' left).</div><button class="pri" id="swvz">Open BugZapper</button></div>' : ''; const b = q('#swvz'); if (b) b.onclick = () => { q('#swvirus').innerHTML = ''; openApp('zap'); }; }
    function event() {
      const k = pick(['virus', 'fire', 'raid']), box = q('#swev'); if (!box) return;
      if (k === 'virus') { G.virus = 3; paintVirus(); return; }
      G.ev = { k, until: performance.now() + (k === 'fire' ? 8000 : 6000) };
      box.innerHTML = '<div class="ev"><span class="swbig">' + (k === 'fire' ? '🔥' : '🚨') + '</span><div style="flex:1"><b>' + (k === 'fire' ? 'Your desk is on fire!' : 'Station Patrol sweep! Hide the paperwork!') + '</b><div class="mute small">' + (k === 'fire' ? 'Put it out in 8 seconds or Pinch bills you 100 Glimmers for the carpet.' : 'Hide it in 6 seconds or the patrol confiscates 20% of today\'s Glimmers.') + '</div></div><button class="pri" id="swevb">' + (k === 'fire' ? '🧯 Extinguisher' : '🗂️ Hide it') + '</button></div>';
      q('#swevb').onclick = () => { G.ev = null; box.innerHTML = ''; if (st && !st.over) add('sys', k === 'fire' ? '🧯 Fire out.' : '🗂️ Paperwork hidden. The patrol walked past.'); };
    }
    function evFail() {
      const k = G.ev.k, loss = k === 'fire' ? Math.min(100, G.today) : Math.round(G.today * .2); G.ev = null; G.today -= loss; G.total -= loss;
      const box = q('#swev'); if (box) box.innerHTML = '<div class="ev"><span class="swbig">' + (k === 'fire' ? '🔥' : '🚨') + '</span><div>' + (k === 'fire' ? 'The fire burnt your carpet.' : 'The patrol confiscated your paperwork.') + ' Lost ' + loss + ' Glimmers.</div></div>';
      setTimeout(() => { const b = q('#swev'); if (b && !G.ev) b.innerHTML = ''; }, 4000); paintBar();
    }
    /* ---------- end of shift ---------- */
    function endShift() {
      clearInterval(tick); tick = 0; G.left = 0; G.phase = 'review'; G.run = null; G.ev = null; if (ctl) ctl.abort(); stopVoice(); try { if (A.voice && A.voice.rec) A.voice.stop(true); } catch (e) { } st = null;
      paintBar(); const met = G.today >= G.quota, stats = '<div class="mute small" style="margin-top:6px">Calls taken: ' + G.calls + ' · paid out: ' + G.wins + ' · terminated: ' + G.cut + '</div>';
      if (!met) { api.submit(G.total); view(bar() + boss(pick(PINCH.bad) + ' You made ' + G.today + ' of ' + G.quota + ' Glimmers today.', stats) + '<div class="swcard"><div class="swbig">Fired on shift ' + G.day + '</div><div>Total swindled: ' + G.total + ' Glimmers.</div></div><div class="swrow"><button class="pri" id="swagain">Apply again</button></div>'); q('#swagain').onclick = restart; return; }
      if (G.day >= DAYS) { api.submit(G.total); view(bar() + boss('Five shifts, five quotas. Fine. You are promoted to Senior Swindler. Your new desk has a window. The window is painted on.', stats) + '<div class="swcard"><div class="swbig">🏆 Promoted!</div><div>Total swindled: ' + G.total + ' Glimmers.</div></div><div class="swrow"><button class="pri" id="swagain">Play again</button></div>'); q('#swagain').onclick = restart; return; }
      view(bar() + boss('Shift over. ' + pick(PINCH.good) + ' You made ' + G.today + ' of ' + G.quota + '. Tomorrow the quota goes up.', stats) + '<div class="swrow"><button class="pri" id="swday">Start shift ' + (G.day + 1) + '</button></div>');
      q('#swday').onclick = () => { G.day++; startDay(); };
    }
    function restart() { G.day = 1; G.total = 0; startDay(); }
    setup();
    return () => { dead = true; clearInterval(tick); if (ctl) ctl.abort(); stopVoice(); try { if (A.voice && A.voice.rec) A.voice.stop(true); } catch (e) { } };
  } };
})();

// Hollow Creek: a small town of AI residents who live their own lives. They go to work, meet at the café, gossip in the group chats
// and plan things, whether or not this game is open. Move in, wander the town, chat, help out, and become part of the community.
(() => {
  if (!A.community || !A.play || !A.play.games) return;
  const KEY = 'townsim', W = 'town', slug = n => A.chars.slug(n);
  const pick = a => a[Math.floor(Math.random() * a.length)], rnd = n => Math.floor(Math.random() * n), arr = x => x == null ? [] : [].concat(x);
  const PLACES = { home: ['🏠', 'Home', 'Your own front door.'], cafe: ['☕', 'Corner Café', 'Coffee, bread and gossip.'], square: ['⛲', 'Town Square', 'The fountain, the noticeboard and the open mic.'], market: ['🛒', 'Market', 'Fresh vegetables, noodles and haggling.'], library: ['📚', 'Library', 'Quiet corners and old maps.'], park: ['🌳', 'Park', 'Benches, ducks and a very old oak.'], workshop: ['🔧', 'Workshop', 'Something is always being fixed.'], clinic: ['🩺', 'Clinic', 'Tea, bandages and good advice.'], harbour: ['⚓', 'Harbour', 'Boats, gulls and tall tales.'] };
  // name, emoji, gender, job, bio, personality, work place, favourite places, chat lines, things they do at work
  const R0 = [
    ['Mara Quill', '🧁', 'f', 'Runs the Corner Café', 'Bakes before sunrise and knows everybody\'s order. Secretly writes poems on napkins.', 'warm, motherly, chatty, always feeding people', 'cafe', ['square', 'park'], ['The bread came out perfect today.', 'Sit, sit, I will bring you something.', 'Has anyone tried the cinnamon buns yet?'], ['is baking a fresh batch of bread', 'is wiping down the counter']],
    ['Tobias Reed', '🔧', 'm', 'Handyman', 'Can fix anything with a wrench and a lot of muttering. Hates being thanked.', 'gruff but kind, deadpan, practical', 'workshop', ['cafe', 'harbour'], ['Something is always broken in this town.', 'It is not a big deal. Just a loose screw.', 'Hand me that wrench, would you?'], ['is repairing the old clock', 'is sharpening tools']],
    ['Dr. Imani Okoye', '🩺', 'f', 'Town doctor', 'Calm and observant, knows every secret and keeps them all.', 'calm, caring, dry humour, gives gentle advice', 'clinic', ['library', 'park'], ['Drink some water. Doctor\'s orders.', 'Rest is underrated.', 'Everyone in this town is stubborn about sleep.'], ['is seeing a patient', 'is sorting medicine jars']],
    ['Biscuit', '🐕', 'n', 'The town dog', 'Belongs to everyone, sleeps wherever there is sun, and has never met a stranger.', 'a happy dog who barks and wags and loves everyone', 'square', ['cafe', 'park'], ['Woof!', 'Woof woof!', '*wags tail happily*'], ['is napping in the sun', 'is begging for scraps']],
    ['Eli Navarro', '🎸', 'm', 'Street busker', 'Plays guitar on the square, writes songs about the town, and is permanently broke.', 'dreamy, easygoing, tells everything as a song idea', 'square', ['cafe', 'harbour'], ['That would make a great chorus.', 'I wrote a song about this town. Want to hear it?', 'Music is food. Mostly.'], ['is tuning his guitar', 'is playing a new song']],
    ['June Whitaker', '📚', 'f', 'Librarian', 'Shushes with love and recommends the perfect book without being asked.', 'gentle, wise, a little dry, always quoting books', 'library', ['park', 'cafe'], ['There is a book for exactly this.', 'Shhh. Well, only a little.', 'I just reshelved the whole mystery section.'], ['is stamping returned books', 'is cataloguing old maps']],
    ['Old Ferris', '🧓', 'm', 'Retired fisherman', 'Has caught the biggest fish in history, at least once a week, in his stories.', 'a rambling storyteller who exaggerates and loves an audience', 'harbour', ['cafe', 'square'], ['Back in my day the fish were bigger.', 'Did I ever tell you about the one that got away?', 'The sea always tells the truth.'], ['is mending a net', 'is telling a tall tale to the gulls']],
    ['Sofia Lindqvist', '🌱', 'f', 'Market gardener', 'Grows the best tomatoes and talks to every plant by name.', 'cheerful, earthy, passionate about plants and cooking', 'market', ['park', 'cafe'], ['The tomatoes are unbelievable this week.', 'Plants need kindness, same as people.', 'Come by my stall, I saved you some basil.'], ['is arranging vegetables', 'is watering the herb boxes']],
    ['Marcus Bell', '📰', 'm', 'Editor of the Creek Courier', 'Collects news and rumours, and prints only half of them.', 'curious, nosy, charming, always digging for a story', 'square', ['cafe', 'library'], ['I heard something interesting. No, I cannot say.', 'This is front-page material.', 'A good story needs two sources and one cup of coffee.'], ['is typing up the next issue', 'is interviewing people at the fountain']],
    ['Ravi Patel', '🍜', 'm', 'Noodle cart owner', 'Cooks the spiciest noodles in the county and dares everyone to finish one.', 'cheeky, loud, generous, loves spice', 'market', ['square', 'harbour'], ['Extra spicy? Are you brave enough?', 'Nobody finishes the red bowl. Nobody.', 'Eat first, talk later.'], ['is stir-frying noodles', 'is chopping chillies']],
    ['Chloe Park', '🎨', 'f', 'Painter', 'Paints the town in colours it does not quite have.', 'quiet, imaginative, speaks in images and colours', 'library', ['park', 'harbour'], ['The light today is a soft gold.', 'I am painting the fountain again.', 'Colours have moods, you know.'], ['is painting at an easel', 'is mixing a new shade of blue']],
    ['Nia Brooks', '🏃', 'f', 'Student and part-time courier', 'Fast on foot, faster with opinions, always running somewhere.', 'energetic, teenager, slangy, curious about everything', 'square', ['cafe', 'park'], ['Okay that is actually so cool.', 'I have like five minutes, tell me everything.', 'Delivery time! Gotta run.'], ['is delivering a parcel', 'is doing homework on the steps']],
    ['Captain Mo', '⛵', 'm', 'Ferry captain', 'Has taken the same boat across the same river for thirty years and still waves at every gull.', 'friendly, weathered, loves a pun, steady and calm', 'harbour', ['cafe', 'square'], ['Smooth waters today.', 'All aboard, mind the gap.', 'The river never gets boring.'], ['is polishing the ferry', 'is checking the ropes']],
    ['Whiskers', '🐈', 'n', 'The café cat', 'Owns the café. Allows people to visit.', 'a haughty, lazy cat who meows and demands attention', 'cafe', ['library', 'park'], ['Meow.', 'Mrrow.', '*stretches lazily*'], ['is napping on the counter', 'is watching the door']]
  ];
  const RES = R0.map(r => ({ id: 'tw:' + slug(r[0]), name: r[0], em: r[1], g: r[2], title: r[3], bio: r[4], style: r[5], work: r[6], fav: r[7], lines: { chat: r[8], hi: ['Hello there! Welcome to Hollow Creek.', 'Oh, hi! Good to see you around.'] }, doing: r[9] }));
  const BYID = {}; RES.forEach(r => BYID[r.id] = r); A.townResidents = RES;
  const OTHERS = {
    square: ['Anyone going to the open mic tonight?', 'The noticeboard says there is a bake sale on Saturday.', 'Beautiful morning, isn\'t it?', 'Did anyone see where the ferry went?', '{player}, are you coming to the café later?', 'The fountain is running again, finally.', 'It is a quiet day in Hollow Creek.'],
    cafe: ['Fresh buns just came out of the oven.', 'Could somebody grab me a tea? I am stuck here.', 'The café is so cosy when it rains.', 'Who left their umbrella on the chair again?', '{player}, your usual?', 'We should hold a game night here.'],
    market: ['The tomatoes this week are something else.', 'Two for one on peppers, today only!', 'Anyone want to split a crate of apples?', 'Market day is always the best day.', '{player}, try these, on the house.', 'My stall is out of basil already.'],
    gossip: ['I heard something very interesting. I cannot say what.', 'Did you see who walked into the clinic?', '{player}, you will never guess what I just found out.', 'Rumour has it a travelling circus is coming.', 'Not that I gossip, but...', 'Somebody is secretly writing poems on napkins.'],
    library: ['Shh. Well, only a little.', 'New books just arrived, go see.', 'Someone returned a book thirty years late. With a note!', 'There is a lovely quiet corner by the window.', '{player}, have you read anything good lately?', 'Rainy days belong to the library.'],
    any: ['Quiet today.']
  };
  const TFOLLOW = {
    square: ['I love this town.', 'Has anyone seen Biscuit? He was just here.', 'The fountain looks lovely in this light.', 'We should organise something for the weekend.'],
    cafe: ['Mara, is there any bread left?', 'Whiskers has claimed the best chair again.', 'This tea is perfect.', 'Rain makes the café even cosier.'],
    market: ['Is there any more of those peppers?', 'I will take a bunch, thanks.', 'Fresh is best, always.', 'The prices today are a gift.'],
    gossip: ['Do not tell anyone I told you.', 'You did not hear it from me.', 'This will be in tomorrow\'s paper.', 'I knew it all along.'],
    library: ['Quietly, please. But yes.', 'There is a good book on exactly that.', 'I could read here all day.', 'The light through the window is perfect today.']
  };
  const CHANNELS = [
    { id: 'square', name: 'town-square', em: '⛲', topic: 'everyone in Hollow Creek', kind: 'square', ms: 'ALL' },
    { id: 'cafe', name: 'corner-café', em: '☕', topic: 'the café regulars', kind: 'cafe', ms: ['mara-quill', 'eli-navarro', 'tobias-reed', 'whiskers', 'ravi-patel', 'nia-brooks', 'biscuit'] },
    { id: 'market', name: 'market-stalls', em: '🛒', topic: 'vendors and shoppers', kind: 'market', ms: ['sofia-lindqvist', 'ravi-patel', 'marcus-bell', 'biscuit', 'captain-mo', 'mara-quill'] },
    { id: 'gossip', name: 'creek-courier', em: '📰', topic: 'news, rumours and gossip', kind: 'gossip', ms: ['marcus-bell', 'mara-quill', 'nia-brooks', 'sofia-lindqvist', 'old-ferris', 'june-whitaker', 'eli-navarro'] },
    { id: 'library', name: 'book-nook', em: '📚', topic: 'quiet readers and artists', kind: 'library', ms: ['june-whitaker', 'chloe-park', 'old-ferris', 'dr-imani-okoye', 'eli-navarro'] }
  ];

  /* ---------- the town's own state ---------- */
  let T = (() => { try { return JSON.parse(ls.get(KEY, 'null')); } catch (e) { return null; } })() || { me: null, rel: {}, loc: {}, act: {}, mood: {}, feed: [], aff: {}, away: [], last: 0, events: [], dm: [] };
  const saveT = () => { try { ls.set(KEY, JSON.stringify(T)); } catch (e) { } };
  T.hold = T.hold || {}; T.flags = T.flags || {}; T.events = T.events || [];
  const hourBlock = () => { const h = new Date().getHours(); return h >= 23 || h < 6 ? 'night' : h < 11 ? 'morning' : h < 15 ? 'midday' : h < 19 ? 'afternoon' : 'evening'; };
  const dayName = () => new Date().toLocaleDateString([], { weekday: 'long' });
  const nice = () => { const b = hourBlock(), d = dayName(); return d + ' ' + (b === 'night' ? 'night' : b); };
  const weather = () => { const d = new Date(), h = A.community.hash(d.getFullYear() + '-' + d.getMonth() + '-' + d.getDate()) % 6; return ['☀️ Sunny', '⛅ Partly cloudy', '🌧 Rainy', '☁️ Overcast', '🌤 Bright and breezy', '🌫 Misty'][h]; };
  const tier = n => n < 10 ? 'stranger' : n < 30 ? 'acquaintance' : n < 55 ? 'friend' : n < 80 ? 'close friend' : 'best friend';
  const here = id => (T.loc[id] || 'home');
  const homeOf = id => 'home';
  const decide = r => {
    const b = hourBlock(); if (b === 'night') return 'home'; if (b === 'evening') return Math.random() < .55 ? pick(r.fav.concat(['square', 'cafe'])) : (Math.random() < .5 ? 'home' : r.work);
    const x = Math.random(); return x < .55 ? r.work : x < .85 ? pick(r.fav) : pick(['park', 'square', 'cafe', 'market', 'harbour']);
  };
  const doing = r => { const p = here(r.id); if (p === 'home') return hourBlock() === 'night' ? 'is asleep' : 'is at home'; if (p === r.work) return pick(r.doing); return pick(['is chatting with a neighbour', 'is enjoying the ' + PLACES[p][1].toLowerCase(), 'is taking a break here', 'is watching the world go by']); };
  const feed = (em, t, important) => { T.feed.unshift({ ts: Date.now(), em, t, imp: important ? 1 : 0 }); if (T.feed.length > 70) T.feed.length = 70; };
  const refresh = () => { const ev = (typeof evNow === 'function') ? evNow() : null; RES.forEach(r => { const h = T.hold[r.id]; if (h && Date.now() < h.until) { T.loc[r.id] = h.place; T.act[r.id] = ev ? 'is at the ' + ev.label.toLowerCase() : doing(r); return; } if (h) delete T.hold[r.id]; if (!T.loc[r.id] || Math.random() < .35) { T.loc[r.id] = decide(r); } T.act[r.id] = doing(r); }); };
  const aff = (a, b, d) => { const k = [a, b].sort().join('|'); T.aff[k] = Math.max(0, Math.min(100, (T.aff[k] || 20) + d)); return T.aff[k]; };
  /* ---------- growth: events, rivalries and romances, home and shop ---------- */
  const EVT = { picnic: ['🧺', 'Picnic', 'park', 20], games: ['🎲', 'Game night', 'cafe', 15], mic: ['🎤', 'Open mic', 'square', 25], book: ['📖', 'Book club', 'library', 10], potluck: ['🍲', 'Potluck', 'market', 20] };
  const HOME_LV = [['Tiny cottage', 0], ['Cosy home', 60], ['Garden house', 120], ['Grand house', 200]], SHOP_LV = [['No shop yet', 0, 0], ['Lemonade stand', 40, 3], ['Pastry shop', 100, 7], ['Bookshop café', 180, 14]];
  const SEEDS = [['tw:ravi-patel', 'tw:mara-quill', 8], ['tw:eli-navarro', 'tw:chloe-park', 68], ['tw:mara-quill', 'tw:tobias-reed', 50], ['tw:june-whitaker', 'tw:old-ferris', 46], ['tw:marcus-bell', 'tw:nia-brooks', 18], ['tw:sofia-lindqvist', 'tw:ravi-patel', 40]];
  const keyOf = (a, b) => [a, b].sort().join('|'), LOVE = [keyOf('tw:eli-navarro', 'tw:chloe-park'), keyOf('tw:mara-quill', 'tw:tobias-reed'), keyOf('tw:june-whitaker', 'tw:old-ferris'), keyOf('tw:sofia-lindqvist', 'tw:ravi-patel')];
  const fn = n => A.community.first(n);
  const seedAff = () => { if (T.flags.seeded) return; SEEDS.forEach(s => { T.aff[keyOf(s[0], s[1])] = s[2]; }); T.flags.seeded = 1; };
  const pairNotes = id => { const l = [], rv = []; Object.keys(T.aff).forEach(k => { const p = k.split('|'); if (!p.includes(id)) return; const o = BYID[p[0] === id ? p[1] : p[0]]; if (!o) return; if (T.flags['love:' + k]) l.push(fn(o.name)); else if (T.aff[k] <= 12) rv.push(fn(o.name)); }); return (l.length ? ' · 💞 Sweetheart: ' + l.join(', ') : '') + (rv.length ? ' · ⚔️ Rival: ' + rv.join(', ') : ''); };
  const drama = () => {
    if (Math.random() > .3) return; const s = pick(SEEDS), a = BYID[s[0]], b = BYID[s[1]], k = keyOf(s[0], s[1]); let n = T.aff[k] == null ? s[2] : T.aff[k];
    if (n <= 15) { if (Math.random() < .6) { feed('⚔️', fn(a.name) + ' and ' + fn(b.name) + ' ' + pick(['argued over whose cooking is better', 'had a frosty exchange at the square', 'are not speaking today', 'glared at each other across the market']) + '.'); n -= 1; } else { n += 4; feed('🕊️', fn(a.name) + ' and ' + fn(b.name) + ' made peace over a cup of tea.', 1); } }
    else if (LOVE.includes(k)) { n += 2 + rnd(2); feed('💕', fn(a.name) + ' and ' + fn(b.name) + ' ' + pick(['were seen sharing a bench at sunset', 'laughed together by the harbour', 'walked home together', 'shared a quiet coffee']) + '.'); if (n >= 80 && !T.flags['love:' + k]) { T.flags['love:' + k] = 1; feed('💞', fn(a.name) + ' and ' + fn(b.name) + ' are now sweethearts!', 1); A.community.push(W, 'gossip', 'tw:marcus-bell', 'Big news in Hollow Creek: ' + fn(a.name) + ' and ' + fn(b.name) + ' are officially sweethearts! You heard it here first.'); } }
    else n += pick([-1, 1, 2]);
    T.aff[k] = Math.max(0, Math.min(100, n));
  };
  const nextAt = (dow, h) => { const d = new Date(); d.setHours(h, 0, 0, 0); let add = (dow - d.getDay() + 7) % 7; if (add === 0 && d.getTime() < Date.now()) add = 7; d.setDate(d.getDate() + add); return d.getTime(); };
  const weekly = () => [['mic', 5, 19, 'Friday open mic'], ['potluck', 6, 10, 'Saturday market day']].forEach(w => { const at = nextAt(w[1], w[2]), id = 'wk-' + w[0] + '-' + new Date(at).toDateString(); if (!T.events.some(e => e.id === id)) { const t = EVT[w[0]]; T.events.push({ id, type: w[0], label: w[3], place: w[0] === 'potluck' ? 'market' : t[2], at, mine: 0 }); } });
  const evNow = () => T.events.find(e => e.started && !e.ended);
  const events = () => {
    const now = Date.now(); weekly();
    T.events.forEach(e => {
      if (!e.started && now >= e.at && now < e.at + 3 * 3600e3) {
        e.started = 1; e.until = Math.max(now, e.at) + 40 * 60e3; const p = e.mine ? .3 + (T.me.homeLv || 0) * .07 : .55;
        e.att = RES.filter(r => Math.random() < p + (T.rel[r.id] || 0) / 220).map(r => r.id); e.att.forEach(id => { T.hold[id] = { place: e.place, until: e.until }; T.loc[id] = e.place; });
        feed(EVT[e.type][0], e.label + ' is happening at the ' + PLACES[e.place][1] + '! ' + e.att.length + ' neighbour' + (e.att.length === 1 ? '' : 's') + ' came.', 1);
        const sp = BYID[pick(e.att.filter(i => i !== 'tw:biscuit' && i !== 'tw:whiskers').concat(['tw:marcus-bell']))]; A.community.push(W, 'square', sp.id, e.label + ' has started at the ' + PLACES[e.place][1] + '! ' + pick(['Come along!', 'Everyone is welcome.', 'Grab a seat.']));
        A.toast(EVT[e.type][0] + ' ' + e.label + ' is starting at the ' + PLACES[e.place][1] + '!', 5000);
      } else if (!e.started && now >= e.at + 3 * 3600e3) e.ended = 1;
      if (e.started && !e.ended && now > e.until) { e.ended = 1; feed(EVT[e.type][0], e.label + ' has ended. What a lovely time.'); }
      if (e.started && !e.ended && !e.attended && T.me.loc === e.place) { e.attended = 1; T.me.rep += e.mine ? 5 : 2; (e.att || []).forEach(id => { T.rel[id] = Math.min(100, (T.rel[id] || 0) + (e.mine ? 3 : 1)); }); feed('🎊', T.me.name + ' joined the ' + e.label + '.', 1); A.toast('🎊 You joined the ' + e.label + ' (+' + (e.mine ? 5 : 2) + ' standing)'); }
    });
    T.events = T.events.filter(e => now - (e.until || e.at) < 2 * 864e5);
  };
  const when = ts => { const m = Math.round((ts - Date.now()) / 60e3); return m <= 0 ? 'now' : m < 90 ? 'in ' + m + ' min' : m < 36 * 60 ? 'in ' + Math.round(m / 60) + ' h' : new Date(ts).toLocaleDateString([], { weekday: 'long' }) + ' ' + new Date(ts).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }); };
  const upcoming = () => { const l = T.events.filter(e => !e.ended).sort((a, b) => a.at - b.at).slice(0, 4); return '<div class="card" style="margin:8px 0"><b>📅 Coming up</b>' + (l.map(e => '<div class="row" style="gap:8px;align-items:center;margin-top:4px"><span>' + EVT[e.type][0] + '</span><span style="flex:1"><b>' + esc(e.label) + '</b> <span class="small mute">at the ' + esc(PLACES[e.place][1]) + ' · ' + (e.started ? 'happening now' : when(e.at)) + (e.mine ? ' · yours' : '') + '</span></span><button class="ib" data-go="' + e.place + '">Go there</button></div>').join('') || '<div class="small mute">Nothing planned. Plan one from the Me tab.</div>') + '</div>'; };
  const shopCoins = () => { const lv = T.me.shop || 0, h = Math.min(8, (Date.now() - (T.me.shopAt || Date.now())) / 3600e3); return Math.floor(h * SHOP_LV[lv][2]); };
  const closeTo = id => Object.keys(T.aff).filter(k => k.split('|').includes(id)).map(k => [k.split('|').find(x => x !== id), T.aff[k]]).filter(x => x[1] >= 45).sort((a, b) => b[1] - a[1]).slice(0, 3).map(x => BYID[x[0]] && A.community.first(BYID[x[0]].name)).filter(Boolean);
  const mood = r => { const m = T.mood[r.id] == null ? 60 : T.mood[r.id]; return m > 70 ? '😊' : m > 40 ? '🙂' : '😟'; };

  /* ---------- one step of town life (runs in the background) ---------- */
  const EVENTS = [
    ['🧁', 'A bake sale is happening at the Corner Café.', 'cafe'], ['🎤', 'Open mic night at the Town Square tonight!', 'square'], ['🌧', 'A sudden shower sends everyone indoors.', 'cafe'],
    ['📦', 'A mysterious parcel arrived for the library.', 'library'], ['🐟', 'Old Ferris swears he caught a fish as big as a boat.', 'harbour'], ['🎨', 'Chloe is hanging her new painting in the café.', 'cafe'],
    ['🛠', 'The old clock in the square is finally ticking again.', 'square'], ['🍅', 'Record tomato harvest at the market!', 'market'], ['🎶', 'Eli wrote a new song about the ferry.', 'harbour'], ['🌈', 'A rainbow over the harbour has everyone outside.', 'harbour']
  ];
  const simStep = () => {
    if (!T.me) return; seedAff(); events(); refresh(); drama();
    if ((T.me.shop || 0) > 0 && Math.random() < .12) { const r = pick(RES.filter(x => x.g !== 'n')); feed('🛍️', fn(r.name) + ' stopped by ' + T.me.name + '\'s ' + SHOP_LV[T.me.shop][0].toLowerCase() + '.'); T.me.coins += 2; }
    // a social moment where two residents share a place
    const byPlace = {}; RES.forEach(r => { (byPlace[here(r.id)] = byPlace[here(r.id)] || []).push(r); });
    const pairs = Object.keys(byPlace).filter(p => p !== 'home' && byPlace[p].length >= 2);
    if (pairs.length && Math.random() < .6) { const p = pick(pairs), l = byPlace[p].slice().sort(() => Math.random() - .5), a = l[0], b = l[1], n = aff(a.id, b.id, 1 + rnd(3)); feed(PLACES[p][0], A.community.first(a.name) + ' and ' + A.community.first(b.name) + ' ' + pick(['are chatting', 'are laughing together', 'are sharing a joke', 'are catching up']) + ' at the ' + PLACES[p][1] + '.'); if (n >= 60 && Math.random() < .3) feed('💞', A.community.first(a.name) + ' and ' + A.community.first(b.name) + ' have become good friends.', 1); T.mood[a.id] = Math.min(100, (T.mood[a.id] || 60) + 3); }
    else { const r = pick(RES); feed(PLACES[here(r.id)][0], A.community.first(r.name) + ' ' + T.act[r.id] + '.'); }
    if (Math.random() < .09) { const e = pick(EVENTS); feed(e[0], e[1], 1); const spk = pick(RES.filter(r => r.id !== 'tw:biscuit' && r.id !== 'tw:whiskers')); A.community.push(W, 'square', spk.id, e[1].replace(/^[A-Z]/, c => c) + ' ' + pick(['Who is coming?', 'Do not miss it!', 'Spread the word.', 'What a day.'])); }
    if (Math.random() < .035) { // someone messages the player
      const known = RES.filter(r => (T.rel[r.id] || 0) >= 8 || Math.random() < .2); if (known.length) {
        const r = pick(known), p = here(r.id) !== 'home' ? PLACES[here(r.id)][1] : 'the square';
        const t = pick(['Hey ' + T.me.name + ', I am heading to the ' + p + '. Want to come along?', 'Hi ' + T.me.name + '! Just thinking of you. How is your day?', 'Psst ' + T.me.name + ', you have to come to the ' + p + ', something funny is happening.', 'Hello ' + T.me.name + '. Come by when you have a minute?']);
        A.community.push(W, 'dm:' + r.id, r.id, T.me.name ? (r.id === 'tw:biscuit' ? 'Woof!' : r.id === 'tw:whiskers' ? 'Meow.' : t) : t); if (!T.dm.includes(r.id)) T.dm.push(r.id); A.toast('💬 ' + r.name + ' messaged you in Hollow Creek', 4500);
      }
    }
    T.last = Date.now(); saveT();
  };
  const defineWorld = () => A.community.define({
    id: W, name: 'Hollow Creek', period: 42000, cast: () => RES, topics: OTHERS, follow: TFOLLOW, fillers: { place: ['the square', 'the café', 'the market'] },
    channels: () => CHANNELS.map(c => Object.assign({}, c, { members: () => c.ms === 'ALL' ? RES.map(r => r.id) : c.ms.map(n => 'tw:' + n) })).concat(T.dm.map(id => ({ id: 'dm:' + id, name: BYID[id] ? BYID[id].name : id, em: BYID[id] ? BYID[id].em : '💬', topic: 'private chat', kind: 'dm', dm: id, members: () => [id] }))),
    ctxLine: (c, ch) => { const r = BYID[c.id]; return 'It is ' + nice() + ' in the small town of Hollow Creek (' + weather().replace(/^\S+\s/, '') + '). ' + (r ? 'You are currently ' + (here(r.id) === 'home' ? 'at home' : 'at the ' + PLACES[here(r.id)][1]) + ' and ' + (T.act[r.id] || 'going about your day') + '. ' : '') + (ch.dm && T.me ? 'You are chatting privately with ' + T.me.name + ', a newer neighbour who is ' + (tier(T.rel[c.id] || 0) === 'stranger' ? 'still a stranger to you' : 'your ' + tier(T.rel[c.id] || 0)) + '. ' : '') + 'Keep it small-town, cosy and in character.'; },
    digestExtra: since => T.feed.filter(f => f.imp && f.ts > since).slice(0, 3).map(f => f.em + ' ' + f.t),
    sim: simStep,
    onMsg: (ch, spk, t) => { if (T.me && t && new RegExp('\\b' + T.A.community.first(me.name).replace(/[.*+?^${}()|[\]\\]/g, '') + '\\b', 'i').test(t)) A.toast('💬 ' + BYID[spk].name + ' mentioned you in Hollow Creek', 4000); },
    onUser: (ch, id) => { const n = T.rel[id] || 0; T.rel[id] = Math.min(100, n + (ch.dm ? 1.2 : .4)); saveT(); },
    catchUp: (span, first) => {
      if (!T.me || first) return; const n = Math.min(10, Math.round(span / 600e3)); if (n <= 0) return; T.away = [];
      refresh(); for (let i = 0; i < n; i++) { const r = pick(RES); const p = decide(r); T.away.push({ em: PLACES[p][0], t: A.community.first(r.name) + ' ' + (p === r.work ? pick(r.doing) : 'was at the ' + PLACES[p][1]) + '.' }); }
      if (Math.random() < .5) { const e = pick(EVENTS); T.away.push({ em: e[0], t: e[1] }); } T.away = T.away.slice(0, 8); saveT();
    }
  });
  defineWorld();
  if (T.me) { A.community.start(W); setTimeout(() => { refresh(); saveT(); }, 3000); }

  /* ---------- the game ---------- */
  A.play.games.town = {
    name: 'Hollow Creek', icon: '🏘',
    desc: 'A cosy town of AI residents who live their own lives. They go to work, gossip in group chats and plan events, even while you do other things in Moundshroud. Move in, wander the town, listen in, join the conversation, make friends and become part of the community.',
    mount(el) {
      let tab = ls.get('towntab', 'town'), cleanup = null, dead = false, panel = null, timer = 0; el.classList.add('uiTown');
      const q = s => el.querySelector(s);
      const hdr = () => '<div class="row" style="gap:10px;align-items:center;flex-wrap:wrap"><div style="flex:1"><b style="font-size:19px">🏘 Hollow Creek</b><div class="small mute">' + nice() + ' · ' + weather() + (T.me ? ' · you live on ' + esc(T.me.home) : '') + '</div></div>' + (T.me ? [['town', '🏘 Town'], ['chat', '💬 Chat' + (A.community.total(W) ? ' (' + A.community.total(W) + ')' : '')], ['me', '🧍 Me']].map(t => '<button class="ib' + (tab === t[0] ? ' on' : '') + '" data-tab="' + t[0] + '">' + t[1] + '</button>').join('') : '') + '</div>';
      const welcome = () => {
        el.innerHTML = '<div class="card" style="max-width:640px;margin:10px auto"><div style="font-size:42px">🏘</div><h2 style="margin:4px 0">Welcome to Hollow Creek</h2><div class="mute" style="margin-bottom:10px">A small town of fourteen neighbours: a baker, a handyman, a doctor, a dog, a cat and more. They have lives of their own and keep chatting, working and planning things, even when you are busy elsewhere in Moundshroud. Move in and become part of it.</div><div class="row" style="gap:8px;flex-wrap:wrap"><input type="text" id="twn" placeholder="Your name" maxlength="20" style="flex:1;min-width:160px" autocomplete="off"><select id="twh"><option>Willow Lane</option><option>Harbour View</option><option>Maple Court</option><option>the Old Mill</option></select><button class="pri" id="twgo">Move in</button></div></div>';
        q('#twn').onkeydown = e => { e.stopPropagation(); if (e.key === 'Enter') q('#twgo').click(); };
        q('#twgo').onclick = () => {
          const name = q('#twn').value.trim() || 'Newcomer'; T.me = { name, home: q('#twh').value, coins: 40, rep: 0, since: Date.now(), shift: 0, loc: 'home' }; T.dm = []; T.feed = []; T.aff = {}; T.rel = {};
          refresh(); feed('🏠', name + ' has moved into ' + T.me.home + '. Welcome to Hollow Creek!', 1); saveT(); A.community.start(W); try { A.chars.event && null; } catch (e) { }
          RES.slice().sort(() => Math.random() - .5).slice(0, 3).forEach((r, i) => setTimeout(() => A.community.push(W, 'square', r.id, ['A new neighbour! Welcome to Hollow Creek, ' + name + '!', 'Hello ' + name + '! Come by the café some time.', 'Welcome, ' + name + '. Hope you like it here.'][i]), 3000 + i * 5500));
          draw();
        };
      };
      const placeCard = (id) => {
        const p = PLACES[id], res = RES.filter(r => here(r.id) === id), meHere = T.me.loc === id;
        return '<div class="card" style="margin:0;padding:8px;' + (meHere ? 'border-color:var(--acc)' : '') + '"><div class="row" style="gap:6px;align-items:center"><b style="flex:1">' + p[0] + ' ' + p[1] + '</b>' + (meHere ? '<span class="chip">You are here</span>' : '<button class="ib" data-go="' + id + '">Go here</button>') + '</div><div class="small mute">' + p[2] + '</div><div class="row" style="gap:4px;flex-wrap:wrap;margin-top:6px">' + (res.map(r => '<button class="chip" data-r="' + r.id + '" title="' + esc(r.name + ' ' + (T.act[r.id] || '')) + '">' + esc(r.em) + ' ' + esc(A.community.first(r.name)) + '</button>').join('') || '<span class="small mute">Nobody here right now</span>') + '</div></div>';
      };
      const drawTown = () => {
        const away = T.away && T.away.length && ls.get('townaway', '') !== String(T.last) ? T.away : null;
        q('#twb').innerHTML = (away ? '<div class="card" style="margin:8px 0;border-color:var(--acc)"><b>📜 While you were away</b><div class="small" style="margin-top:4px">' + away.map(a => esc(a.em) + ' ' + esc(a.t)).join('<br>') + '</div><button class="ib" id="twaway" style="margin-top:6px">Got it</button></div>' : '') +
          upcoming() + '<div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(220px,1fr));gap:8px;margin:8px 0">' + Object.keys(PLACES).filter(p => p !== 'home').map(placeCard).join('') + placeCard('home') + '</div>' +
          '<div class="card" style="margin:0"><b>📰 Happenings</b><div class="small" style="margin-top:6px;max-height:210px;overflow:auto;display:flex;flex-direction:column;gap:3px">' + (T.feed.map(f => '<div' + (f.imp ? ' style="color:var(--acc)"' : '') + '>' + esc(f.em) + ' ' + esc(f.t) + ' <span class="mute" style="font-size:11px">' + new Date(f.ts).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }) + '</span></div>').join('') || '<span class="mute">Quiet so far.</span>') + '</div></div>';
        const ab = q('#twaway'); if (ab) ab.onclick = () => { ls.set('townaway', String(T.last)); drawTown(); };
      };
      const friendBar = id => { const n = T.rel[id] || 0; return '<div style="height:6px;border-radius:4px;background:var(--line)"><div style="height:6px;border-radius:4px;background:var(--acc);width:' + Math.round(n) + '%"></div></div><div class="small mute">' + tier(n) + ' · ' + Math.round(n) + '/100</div>'; };
      const showRes = id => {
        const r = BYID[id], same = T.me.loc === here(id), cd = (k, ms) => Date.now() - (T.me[k] || 0) < ms;
        const d = document.createElement('div'); d.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,.6);z-index:240;display:flex;align-items:center;justify-content:center;padding:12px'; panel = d;
        d.innerHTML = '<div class="card" style="max-width:480px;width:100%;margin:0;max-height:88vh;overflow:auto"><div class="row" style="gap:10px;align-items:center"><span style="font-size:42px">' + esc(r.em) + '</span><div style="flex:1"><b style="font-size:18px">' + esc(r.name) + '</b><div class="small mute">' + esc(r.title) + ' · ' + mood(r) + '</div></div><button class="ib" id="rx">✕</button></div><div class="small" style="margin:8px 0">' + esc(r.bio) + '</div><div class="small mute">Now: ' + esc(A.community.first(r.name) + ' ' + (T.act[id] || '')) + ' (' + (here(id) === 'home' ? 'at home' : PLACES[here(id)][1]) + ')' + (closeTo(id).length ? ' · Close to ' + esc(closeTo(id).join(', ')) : '') + esc(pairNotes(id)) + '</div><div style="margin:8px 0">' + friendBar(id) + '</div>' +
          '<div class="row" style="gap:6px;flex-wrap:wrap"><button class="pri" id="rdm">💬 Message</button><button class="ib" id="rwave"' + (!same || cd('w_' + id, 300e3) ? ' disabled' : '') + ' title="' + (same ? '' : 'You need to be in the same place') + '">👋 Wave</button><button class="ib" id="rgift"' + (!same || T.me.coins < 10 ? ' disabled' : '') + ' title="Costs 10 coins">🎁 Gift (10)</button><button class="ib" id="rhelp"' + (!same || here(id) !== r.work || cd('h_' + id, 600e3) ? ' disabled' : '') + ' title="Help them at their work place">🤝 Help out</button><button class="ib" id="rvoice">🔊 Voice</button><button class="ib" data-mem="' + id + '">🧠 Memory</button></div><div class="small mute" style="margin-top:6px">' + (same ? '' : 'Go to where ' + esc(A.community.first(r.name)) + ' is to wave, give gifts or help out. Messages work anywhere.') + '</div></div>';
        document.body.appendChild(d);
        const close = () => { d.remove(); panel = null; };
        d.onclick = e => { if (e.target === d || e.target.id === 'rx') close(); const m = e.target.closest('[data-mem]'); if (m) { close(); A.chars.open(m.dataset.mem); } };
        d.querySelector('#rdm').onclick = () => { close(); if (!T.dm.includes(id)) T.dm.push(id); saveT(); tab = 'chat'; ls.set('townchat', 'dm:' + id); draw(); };
        d.querySelector('#rvoice').onclick = () => A.cvoice && A.cvoice.speak(id, pick(r.lines.hi));
        const act = (k, f) => { const b = d.querySelector(k); b.onclick = () => { f(); saveT(); close(); showRes(id); drawTown(); drawStats(); }; };
        act('#rwave', () => { T.me['w_' + id] = Date.now(); T.rel[id] = Math.min(100, (T.rel[id] || 0) + 1.5); feed('👋', T.me.name + ' waved at ' + A.community.first(r.name) + '.'); toastSay(r, pick(r.lines.hi)); });
        act('#rgift', () => { T.me.coins -= 10; T.rel[id] = Math.min(100, (T.rel[id] || 0) + 5); T.mood[id] = Math.min(100, (T.mood[id] || 60) + 8); feed('🎁', T.me.name + ' gave ' + A.community.first(r.name) + ' a gift.'); toastSay(r, pick(['Oh, for me? Thank you!', 'What a lovely surprise!', 'You are too kind.'])); try { A.chars.event(id, 'The user gave me a gift in Hollow Creek.', 'Hollow Creek', 4); } catch (e) { } });
        act('#rhelp', () => { T.me['h_' + id] = Date.now(); T.me.coins += 6; T.me.rep += 2; T.rel[id] = Math.min(100, (T.rel[id] || 0) + 4); feed('🤝', T.me.name + ' helped ' + A.community.first(r.name) + ' at work.', 1); toastSay(r, pick(['Couldn\'t have done it without you.', 'You are a lifesaver.', 'Good work, neighbour.'])); try { A.chars.event(id, 'The user helped me out at work in Hollow Creek.', 'Hollow Creek', 4); } catch (e) { } });
      };
      const toastSay = (r, t) => { A.toast(r.em + ' ' + A.community.first(r.name) + ': ' + t, 3500); if (A.cvoice && A.cvoice.auto) A.cvoice.speak(r.id, t); };
      const drawStats = () => { const s = q('#twst'); if (s) s.innerHTML = '🪙 ' + T.me.coins + ' · ⭐ ' + T.me.rep + ' standing'; };
      const meExtras = () => {
        const hl = T.me.homeLv || 0, sl = T.me.shop || 0, nh = HOME_LV[hl + 1], ns = SHOP_LV[sl + 1], sc = shopCoins();
        return '<div class="card" style="margin:0 0 8px"><b>🏠 Your home:</b> ' + HOME_LV[hl][0] + ' <span class="small mute">(a bigger home brings more neighbours to the events you host)</span><div style="margin-top:6px">' + (nh ? '<button class="ib" id="twhup"' + (T.me.coins < nh[1] ? ' disabled' : '') + '>⬆ Upgrade to ' + nh[0] + ' (' + nh[1] + ' coins)</button>' : '<span class="small mute">Fully upgraded.</span>') + '</div></div>' +
          '<div class="card" style="margin:0 0 8px"><b>🏪 Your shop:</b> ' + SHOP_LV[sl][0] + (sl ? ' <span class="small mute">earns about ' + SHOP_LV[sl][2] + ' coins an hour, saved up for up to 8 hours</span>' : '') + '<div class="row" style="gap:6px;margin-top:6px;flex-wrap:wrap">' + (sl ? '<button class="pri" id="twshc"' + (sc < 1 ? ' disabled' : '') + '>🪙 Collect ' + sc + ' coins</button>' : '') + (ns ? '<button class="ib" id="twshu"' + (T.me.coins < ns[1] ? ' disabled' : '') + '>' + (sl ? '⬆ Upgrade to ' : '🏗 Open a ') + ns[0].toLowerCase() + ' (' + ns[1] + ' coins)</button>' : '') + '</div></div>' +
          '<div class="card" style="margin:0 0 8px"><b>🎉 Plan an event</b><div class="small mute">Neighbours you are close with are more likely to come. Be there when it starts to earn standing.</div><div class="row" style="gap:6px;margin-top:6px;flex-wrap:wrap"><select id="twet">' + Object.keys(EVT).map(k => '<option value="' + k + '">' + EVT[k][0] + ' ' + EVT[k][1] + ' (' + EVT[k][3] + ' coins)</option>').join('') + '</select><select id="twed"><option value="5">in 5 minutes</option><option value="30">in 30 minutes</option><option value="120">in 2 hours</option><option value="1440">tomorrow</option></select><button class="pri" id="twego">Plan it</button></div></div>';
      };
      const bindExtras = () => {
        const b = id => q(id); if (b('#twhup')) b('#twhup').onclick = () => { const n = HOME_LV[(T.me.homeLv || 0) + 1]; if (T.me.coins < n[1]) return; T.me.coins -= n[1]; T.me.homeLv = (T.me.homeLv || 0) + 1; feed('🏠', T.me.name + ' upgraded to a ' + n[0].toLowerCase() + '.', 1); saveT(); drawMe(); };
        if (b('#twshu')) b('#twshu').onclick = () => { const n = SHOP_LV[(T.me.shop || 0) + 1]; if (T.me.coins < n[1]) return; T.me.coins -= n[1]; T.me.coins += shopCoins(); T.me.shop = (T.me.shop || 0) + 1; T.me.shopAt = Date.now(); feed('🏪', T.me.name + ' now has a ' + n[0].toLowerCase() + '!', 1); saveT(); drawMe(); };
        if (b('#twshc')) b('#twshc').onclick = () => { const c = shopCoins(); T.me.coins += c; T.me.shopAt = Date.now(); saveT(); A.toast('🪙 Collected ' + c + ' coins'); drawMe(); };
        if (b('#twego')) b('#twego').onclick = () => { const k = b('#twet').value, m = +b('#twed').value, t = EVT[k]; if (T.me.coins < t[3]) return A.toast('You need ' + t[3] + ' coins for that.'); T.me.coins -= t[3]; const at = Date.now() + m * 60e3; T.events.push({ id: 'me-' + at, type: k, label: T.me.name + '\'s ' + t[1].toLowerCase(), place: t[2], at, mine: 1 }); feed(t[0], T.me.name + ' is planning a ' + t[1].toLowerCase() + ' at the ' + PLACES[t[2]][1] + ' (' + when(at) + ').', 1); A.community.push(W, 'square', 'tw:marcus-bell', 'Notice from the Courier: ' + T.me.name + ' is hosting a ' + t[1].toLowerCase() + ' at the ' + PLACES[t[2]][1] + ' ' + when(at) + '. All welcome!'); saveT(); A.toast('Event planned. Be at the ' + PLACES[t[2]][1] + ' when it starts!', 4500); drawMe(); };
      };
      const drawMe = () => {
        const friends = RES.map(r => [r, T.rel[r.id] || 0]).sort((a, b) => b[1] - a[1]), cdLeft = Math.max(0, 15 * 60e3 - (Date.now() - (T.me.shift || 0)));
        q('#twb').innerHTML = '<div class="card" style="margin:8px 0"><div class="row" style="gap:10px;align-items:center;flex-wrap:wrap"><b style="font-size:17px;flex:1">🧍 ' + esc(T.me.name) + '</b><span id="twst" class="chip"></span></div><div class="small mute">Lives on ' + esc(T.me.home) + ' · in Hollow Creek since ' + new Date(T.me.since).toLocaleDateString() + '</div><div class="row" style="gap:6px;margin-top:8px;flex-wrap:wrap"><button class="pri" id="twwk"' + (cdLeft ? ' disabled' : '') + '>🧺 Work a shift (+15 coins)</button>' + (cdLeft ? '<span class="small mute">available in ' + Math.ceil(cdLeft / 60e3) + ' min</span>' : '') + '</div></div>' + meExtras() + '<div class="card" style="margin:0"><b>👥 Neighbours</b><div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(210px,1fr));gap:8px;margin-top:6px">' + friends.map(f => '<div class="row" style="gap:8px;align-items:center;cursor:pointer" data-r="' + f[0].id + '"><span style="font-size:24px">' + esc(f[0].em) + '</span><div style="flex:1;min-width:0"><div class="small"><b>' + esc(f[0].name) + '</b></div>' + friendBar(f[0].id) + '</div></div>').join('') + '</div></div><div style="margin-top:10px"><button class="ib dang" id="twreset">Leave Hollow Creek</button> <span class="small mute">(starts the town over)</span></div>';
        drawStats();
        q('#twwk').onclick = () => { T.me.shift = Date.now(); T.me.coins += 15; T.me.rep += 1; feed('🧺', T.me.name + ' worked a shift.'); saveT(); drawMe(); };
        bindExtras();
        q('#twreset').onclick = () => { if (confirm('Leave Hollow Creek and start the town over? Friendships and chat history there will be erased (character memories stay).')) { A.community.reset(W); T = { me: null, rel: {}, loc: {}, act: {}, mood: {}, feed: [], aff: {}, away: [], last: 0, events: [], dm: [] }; saveT(); draw(); } };
      };
      const draw = () => {
        if (cleanup) { try { cleanup(); } catch (e) { } cleanup = null; } if (panel) { panel.remove(); panel = null; }
        if (!T.me) { el.innerHTML = ''; welcome(); return; } A.community.cast(W); seedAff(); weekly();
        ls.set('towntab', tab); el.innerHTML = hdr() + '<div id="twb"></div>';
        el.querySelectorAll('[data-tab]').forEach(b => b.onclick = () => { tab = b.dataset.tab; draw(); });
        if (tab === 'chat') { A.chars.reg && null; cleanup = A.community.view(q('#twb'), W, { ch: ls.get('townchat', ''), onOpen: id => ls.set('townchat', id) }); }
        else if (tab === 'me') drawMe(); else { refresh(); drawTown(); }
      };
      el.onclick = e => {
        const g = e.target.closest('[data-go]'); if (g) { T.me.loc = g.dataset.go; saveT(); feed('🚶', T.me.name + ' walked to the ' + PLACES[T.me.loc][1] + '.'); drawTown(); return; }
        const r = e.target.closest('[data-r]'); if (r && T.me) showRes(r.dataset.r);
      };
      draw();
      timer = setInterval(() => { if (!dead && tab === 'town' && !panel) { drawTown(); } }, 15000);
      return () => { dead = true; el.classList.remove('uiTown'); clearInterval(timer); if (cleanup) { try { cleanup(); } catch (e) { } } if (panel) panel.remove(); };
    }
  };
  A.townDebug = { T: () => T, step: () => simStep(), events: () => events() };           // test hook
  // how-to-play text for the game card
  const addHelp = () => { try { if (A.play.help) A.play.help.town = ['Become part of the town of Hollow Creek and make friends with its residents.', ['Move in with a name and a home. The residents carry on with their day whether or not Moundshroud is on this game.', 'Town: see who is where. Press Go here to walk somewhere, tap a resident to wave, give a gift, help out or message them.', 'Chat: step into a group chat that was already going, scroll back to read what was said, or join in. Tap 🔊 on a line to hear that resident\'s voice.', 'Friendships grow when you talk, help and give gifts. Residents may message you when you have been away.'], 'The cat and the dog speak in meows and woofs. Tap a name to see what each resident remembers about you.']; } catch (e) { } };
  addHelp(); setTimeout(addHelp, 1500);
})();

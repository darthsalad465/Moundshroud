/* CITIZENS — the people of Rome, who are people. The crowd used to be twenty-six strangers made up afresh every time
   you walked into the city, each with one line and no memory. Now Rome has a population: ninety Romans with a
   name, a trade, a street they live on, a family, a temper, a worry and a secret. You meet the same baker on the
   same corner, and he remembers you.

   You talk to them in your own words. The local AI model speaks for them, in character and in their year, and
   after every exchange it decides three things: how the conversation changed their opinion of you, what about it
   they will remember, and whether their worry has come up in a way that makes them ask you for help. If it has,
   they offer you a job the model has just written, which becomes a real job in your journal, with real steps in
   real places, played like any other. That is the content that does not run out.

   They learn. Each of them keeps what you said and did with them; what you do in public reaches them as gossip
   (and the gossipy ones spread what you tell them). Help them and they warm; lie, threaten or ignore them and the
   street cools. If the AI is not running, they still talk, from their own lives, and still ask for help. */
window.CIT = (() => {
  'use strict';
  const rng = seed => { let a = (seed >>> 0) || 1; return () => { a += 0x6d2b79f5; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; };
  const hash = s => { let h = 2166136261; s = String(s); for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; };
  const pick = (r, a) => a[Math.floor(r() * a.length)];
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const esc = s => String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

  /* ============================ who lives here ============================ */
  const PRAE = ['Gaius', 'Lucius', 'Marcus', 'Publius', 'Quintus', 'Titus', 'Gnaeus', 'Aulus', 'Sextus', 'Decimus', 'Servius', 'Spurius', 'Manius', 'Numerius', 'Tiberius'];
  const NOMEN = ['Fabius', 'Cornelius', 'Valerius', 'Aemilius', 'Licinius', 'Sempronius', 'Caecilius', 'Junius', 'Tullius', 'Vettius', 'Ofellius', 'Lollius', 'Septimius', 'Marcius', 'Plautius', 'Herennius', 'Minucius', 'Volteius', 'Popillius', 'Atilius'];
  const COG = ['Rufus', 'Niger', 'Longus', 'Naso', 'Balbus', 'Scaeva', 'Bassus', 'Pansa', 'Silo', 'Felix', 'Celer', 'Macer', 'Crispus', 'Paetus', 'Varus'];
  const GREEK = ['Philemon', 'Eutychus', 'Chrysis', 'Doris', 'Hermes', 'Syra', 'Phoebe', 'Daphnus', 'Glycera', 'Onesimus', 'Tryphaena', 'Alexas', 'Myrtale', 'Diodotus', 'Nicias'];
  const FEMALE_GREEK = { Chrysis: 1, Doris: 1, Syra: 1, Phoebe: 1, Glycera: 1, Tryphaena: 1, Myrtale: 1 };
  const TRADES = [
    { t: 'baker', role: 'pleb', at: ['subura', 'aventine'], talk: 'flour prices, the ovens, the grain dole' },
    { t: 'fuller', role: 'pleb', at: ['subura', 'argiletum'], talk: 'urine vats, stained togas, the laundry trade' },
    { t: 'cobbler', role: 'pleb', at: ['argiletum', 'subura'], talk: 'leather, hobnails, whose sandals are falling apart' },
    { t: 'butcher', role: 'pleb', at: ['macellum'], talk: 'meat prices, the sacrifices, the aediles inspecting scales' },
    { t: 'fishmonger', role: 'matron', at: ['wharf', 'macellum'], talk: 'the catch, the boats from Ostia, the smell' },
    { t: 'wine seller', role: 'merchant', at: ['subura', 'argiletum'], talk: 'Falernian, watered wine, debts run up by customers' },
    { t: 'money-changer', role: 'merchant', at: ['forum', 'basilica'], talk: 'coins, clipped silver, interest rates, who is in debt' },
    { t: 'scribe', role: 'scholar', at: ['tabularium', 'forum'], talk: 'letters, contracts, the gossip in the record office' },
    { t: 'carpenter', role: 'pleb', at: ['aventine', 'trans'], talk: 'timber, collapsing tenements, fires' },
    { t: 'potter', role: 'pleb', at: ['trans', 'aventine'], talk: 'clay, kilns, the amphora trade' },
    { t: 'porter', role: 'poor', at: ['wharf', 'portus'], talk: 'heavy loads, ships, the foremen' },
    { t: 'barber', role: 'pleb', at: ['forum', 'subura'], talk: 'every rumour in Rome, which he hears from every chin' },
    { t: 'flower seller', role: 'matron', at: ['forum', 'circus'], talk: 'garlands, festivals, the temples' },
    { t: 'retired legionary', role: 'soldier', at: ['castra', 'campus'], talk: 'old campaigns, land grants, bad generals' },
    { t: 'gladiator', role: 'gladiator', at: ['ludus', 'circus'], talk: 'the sand, the lanista, the crowd' },
    { t: 'temple attendant', role: 'priest', at: ['temple', 'vesta'], talk: 'omens, sacrifices, the priests’ quarrels' },
    { t: 'letter carrier', role: 'pleb', at: ['forum', 'portus'], talk: 'the roads, who writes to whom' },
    { t: 'Greek physician', role: 'scholar', at: ['balnea', 'forum'], talk: 'fevers, Hippocrates, rich patients who do not pay' },
    { t: 'schoolmaster', role: 'scholar', at: ['forum', 'argiletum'], talk: 'Homer, lazy boys, his own unpaid fees' },
    { t: 'lamp maker', role: 'pleb', at: ['argiletum', 'subura'], talk: 'oil, wicks, the night streets' },
    { t: 'perfume seller', role: 'merchant', at: ['forum', 'macellum'], talk: 'oils from the east, rich women, prices' },
    { t: 'charioteer', role: 'pleb', at: ['circus'], talk: 'the Greens and the Blues, horses, crashes' },
    { t: 'washerwoman', role: 'matron', at: ['trans', 'aventine'], talk: 'the river, her children, the landlord' },
    { t: 'tavern keeper', role: 'merchant', at: ['subura', 'trans'], talk: 'drunks, gamblers, who said what last night' },
    { t: 'stonemason', role: 'pleb', at: ['capitol', 'forum'], talk: 'contracts, cheating builders, the new temples' },
    { t: 'bath attendant', role: 'poor', at: ['balnea'], talk: 'senators without their togas, stolen clothes' }
  ];
  const TRAITS = ['gruff', 'gossipy', 'pious', 'cynical', 'cheerful', 'nervous', 'proud', 'greedy', 'kind', 'bitter', 'superstitious', 'ambitious', 'shrewd', 'talkative', 'suspicious'];
  const POLITICS = ['admires the optimates and old families', 'is for the populares and the grain dole', 'thinks all politicians are thieves', 'only cares about the price of bread', 'worships Pompey', 'thinks Cato is the last honest man'];
  const SECRETS = ['owes money to a dangerous man', 'was born a slave and hides it', 'once stole from a temple', 'is in love with someone above their station', 'informs for a senator', 'buried their savings under the floor', 'deserted from a legion long ago', 'cheats on weights and measures', 'writes rude verses about magistrates on walls', 'has a brother in prison'];
  /* each worry is something they might ask you to help with: a fallback job when the AI is not there to write one */
  const WORRIES = [
    { w: 'a moneylender in the Subura is charging my family three times the legal interest', steps: [['subura', 'Find the moneylender and question him'], ['tabularium', 'Check the loan contract in the record office'], ['basilica', 'Argue the interest down before the praetor']] },
    { w: 'someone has been stealing from my stall at night', steps: [['macellum', 'Watch the stall after dark'], ['subura', 'Find who is selling the stolen goods'], ['forum', 'Name the thief in public']] },
    { w: 'my landlord wants to double the rent on our tenement', steps: [['aventine', 'Ask the other tenants what they pay'], ['tabularium', 'Audit the landlord’s lease'], ['basilica', 'Argue for the tenants']] },
    { w: 'a cargo I paid for never arrived from Ostia', steps: [['portus', 'Question the harbourmaster'], ['ostia', 'Check the fleet office books at Ostia'], ['basilica', 'Bring the claim to court']] },
    { w: 'a crow died on my doorstep and the priests want money to say what it means', steps: [['temple', 'Take the omens yourself'], ['vesta', 'Ask a priestess what it really means']] },
    { w: 'my brother was arrested after a brawl he did not start', steps: [['subura', 'Find witnesses to the brawl'], ['forum', 'Persuade the magistrate to release him']] },
    { w: 'the water stopped reaching our street’s fountain and the aedile does nothing', steps: [['tabularium', 'Find who was paid to divert the water'], ['curia', 'Raise it in the Senate']] },
    { w: 'the guild cheated me out of my share of a contract', steps: [['argiletum', 'Question the guild master'], ['tabularium', 'Audit the guild’s accounts'], ['basilica', 'Sue for the share']] },
    { w: 'my daughter wants to run off with a gladiator', steps: [['ludus', 'Talk to the gladiator'], ['domus', 'Talk sense to the family']] },
    { w: 'a rich man’s slaves beat my son for blocking his litter', steps: [['forum', 'Find out whose litter it was'], ['basilica', 'Demand compensation in court']] },
    { w: 'I was sold a sick mule at twice its price', steps: [['macellum', 'Find the dealer'], ['macellum', 'Haggle the money back']] },
    { w: 'my patron promised me a post and has forgotten me', steps: [['curia', 'Put in a word with a senator']] },
    { w: 'the tenement next to ours is going to collapse and the owner will not repair it', steps: [['aventine', 'Inspect the building'], ['tabularium', 'Find out who owns it'], ['curia', 'Shame the owner in the house']] },
    { w: 'a fortune-teller took my savings and promised me a husband', steps: [['circus', 'Find the fortune-teller'], ['forum', 'Make her pay it back']] }
  ];
  const DISTRICT_NAME = id => ((window.IMP && window.IMP.LOCS[id]) || {}).name || id;

  let POP = null;
  function population() {
    if (POP) return POP;
    POP = [];
    for (let i = 0; i < 90; i++) {
      const r = rng(77700 + i * 131), trade = TRADES[i % TRADES.length];
      const freed = r() < .25, female = trade.role === 'matron' || (!freed && r() < .22);
      let name;
      if (freed) { const g = pick(r, GREEK); name = g; }
      else if (female) { const n = pick(r, NOMEN); name = n.replace(/us$/, 'a') + (r() < .5 ? ' ' + pick(r, ['Maior', 'Minor', 'Tertia', 'Secunda']) : ''); }
      else name = pick(r, PRAE) + ' ' + pick(r, NOMEN) + (r() < .6 ? ' ' + pick(r, COG) : '');
      const fem = female || !!FEMALE_GREEK[name];
      const traits = [pick(r, TRAITS)]; let t2 = pick(r, TRAITS); if (t2 !== traits[0]) traits.push(t2);
      const age = 18 + Math.floor(r() * 50);
      POP.push({
        id: 'c' + i, name, short: name.split(' ')[name.split(' ').length > 1 ? 1 : 0], female: fem, freed, age,
        trade: trade.t, role: fem && trade.role !== 'matron' && trade.role !== 'priest' ? 'matron' : trade.role, talk: trade.talk,
        home: pick(r, trade.at), traits, politics: pick(r, POLITICS), secret: pick(r, SECRETS), worry: Math.floor(r() * WORRIES.length),
        family: r() < .5 ? (fem ? 'a husband and ' : 'a wife and ') + (1 + Math.floor(r() * 5)) + ' children' : r() < .5 ? 'an old mother to keep' : 'nobody left',
        base: Math.round((r() - .5) * 30)
      });
    }
    return POP;
  }
  const byId = id => population().find(p => p.id === id);

  /* ============================ what they remember ============================ */
  function mem(S, id) {
    S.cit = S.cit || {};
    if (!S.cit[id]) { const p = byId(id); S.cit[id] = { op: p ? p.base : 0, met: 0, facts: [], last: [], quest: null, done: 0 }; }
    return S.cit[id];
  }
  /* public deeds become gossip: a chapter decision, a battle, a speech. What one Roman is told, the gossipy ones repeat */
  function note(S, text) {
    if (!S || !text) return;
    S.gossip = S.gossip || [];
    S.gossip.push({ t: String(text).slice(0, 160), day: S.day || 1 });
    if (S.gossip.length > 40) S.gossip = S.gossip.slice(-40);
  }
  /* which of the gossip this person has heard: the gossipy hear almost everything, the rest a fraction, and the
     older a story is the more of the city has heard it */
  function heard(S, p) {
    const g = (S.gossip || []), out = [];
    const ear = p.traits.includes('gossipy') || p.trade === 'barber' || p.trade === 'tavern keeper' ? .9 : p.traits.includes('suspicious') ? .45 : .35;
    for (let i = g.length - 1; i >= 0 && out.length < 4; i--) {
      const age = (S.day || 1) - g[i].day, chance = clamp(ear + age * .08, 0, .97);
      if ((hash(p.id + g[i].t) % 1000) / 1000 < chance) out.push(g[i].t);
    }
    return out;
  }
  /* what they think of you: their own opinion, nudged by how you stand with the part of Rome they belong to */
  function opinion(S, p, m) {
    const pol = /populares|bread/.test(p.politics) ? (S.rep.people || 0) : /optimates|Cato/.test(p.politics) ? (S.rep.senate || 0) : /Pompey/.test(p.politics) ? (S.rep.army || 0) : 0;
    return clamp(m.op + pol / 4, -100, 100);
  }
  const opWord = o => o > 55 ? 'devoted to you' : o > 25 ? 'friendly' : o > 5 ? 'well disposed' : o > -10 ? 'neutral' : o > -35 ? 'wary' : 'hostile';

  /* ============================ the street ============================ */
  /* who is out right now: more people by day, fewer at night, and each mostly near their own street */
  function crowd(S, n, r) {
    const pop = population().slice(), night = S.time < 6.5 || S.time > 20;
    const out = [];
    for (let i = 0; i < pop.length && out.length < (night ? Math.round(n * .45) : n); i++) {
      const j = i + Math.floor(r() * (pop.length - i)); [pop[i], pop[j]] = [pop[j], pop[i]];
      if (night && !/tavern|barber|gladiator|porter|lamp/.test(pop[i].trade) && r() < .6) continue;
      out.push(pop[i]);
    }
    return out;
  }
  const lookOpts = p => ({ role: p.role, female: p.female, beard: p.female ? 0 : undefined });

  /* ============================ the voice ============================ */
  let MODEL = null, SMALL = '', aiDown = 0;
  async function model() {
    if (MODEL) return MODEL;
    let names = [];
    try { const j = await (await fetch('/api/models')).json(); names = (j.models || []).filter(x => !x.cloud).map(x => x.name).filter(n => !/embed/i.test(n)); } catch (e) { }
    /* a smaller voice to fall back on when the big one does not fit in the graphics card's memory */
    SMALL = names.find(n => /qwen.*\b[1-4](\.\d)?b\b/i.test(n)) || names.find(n => /\b[1-4](\.\d)?b\b/i.test(n)) || '';
    try { const m = window.parent && window.parent !== window && window.parent.document.getElementById('model'); if (m && m.value) return (MODEL = m.value); } catch (e) { }
    MODEL = names.find(n => /qwen.*9b/i.test(n) && !/abliterat|uncensor/i.test(n)) || names.find(n => /qwen.*9b/i.test(n)) || names.find(n => /qwen/i.test(n)) || names[0] || '';
    return MODEL;
  }
  async function ask(m, messages, timeoutMs) {
    const ctl = new AbortController(), timer = setTimeout(() => ctl.abort(), timeoutMs || 45000);
    try {
      const r = await fetch('/api/chat', { method: 'POST', signal: ctl.signal, body: JSON.stringify({ model: m, stream: true, think: false, keep_alive: '10m', options: { temperature: .85, num_predict: 320 }, messages }) });
      if (!r.ok || !r.body) throw new Error('chat ' + r.status);
      const rd = r.body.getReader(), dec = new TextDecoder(); let buf = '', all = '';
      for (; ;) {
        const { value, done } = await rd.read(); if (done) break;
        buf += dec.decode(value, { stream: true }); let i;
        while ((i = buf.indexOf('\n')) >= 0) {
          const ln = buf.slice(0, i).trim(); buf = buf.slice(i + 1); if (!ln) continue;
          let j = null; try { j = JSON.parse(ln); } catch (e) { continue; }       // a half line: skip it
          if (j.error) throw new Error(String(j.error));                          // the server said no (out of memory, model missing...)
          if (j.message && j.message.content) all += j.message.content;
        }
      }
      if (!all.trim()) throw new Error('empty reply');
      return all;
    } finally { clearTimeout(timer); }
  }
  async function llm(messages, timeoutMs) {
    if (Date.now() < aiDown) throw new Error('ai resting');
    const m = await model(); if (!m) throw new Error('no model');
    try { return await ask(m, messages, timeoutMs); }
    catch (e) {
      /* the big model failed for a reason other than slowness: try the small one, and keep using it if it works */
      if (SMALL && SMALL !== m && e.name !== 'AbortError') {
        try { const out = await ask(SMALL, messages, timeoutMs); MODEL = SMALL; return out; } catch (e2) { }
      }
      aiDown = Date.now() + 60000; throw e;                                       // after a failure, speak from the script for a minute
    }
  }
  function firstJson(text) {
    if (!text) return null; const t = String(text).replace(/```(?:json)?/gi, ''); const a = t.indexOf('{'); if (a < 0) return null;
    let depth = 0, inStr = false, e = false;
    for (let i = a; i < t.length; i++) { const c = t[i]; if (inStr) { if (e) e = false; else if (c === '\\') e = true; else if (c === '"') inStr = false; continue; } if (c === '"') inStr = true; else if (c === '{') depth++; else if (c === '}') { depth--; if (depth === 0) { try { return JSON.parse(t.slice(a, i + 1)); } catch (x) { return null; } } } }
    return null;
  }

  /* the places a job may send you, in the model's own terms */
  const PLACES = ['forum', 'curia', 'basilica', 'rostra', 'subura', 'macellum', 'argiletum', 'portus', 'wharf', 'tabularium', 'temple', 'vesta', 'ludus', 'castra', 'circus', 'aventine', 'trans', 'balnea', 'capitol', 'ostia', 'camp'];
  function systemPrompt(S, api, who, m, offerHelp) {
    const p = who.p, yr = api.yearText(), you = S.name + ', ' + (S.office || 'a citizen') + (S.mode === 'caesar' ? ' (Gaius Julius Caesar)' : '');
    const facts = m.facts.slice(-6), gos = p ? heard(S, p) : [], op = who.op;
    const lines = [];
    if (who.persona) lines.push(who.persona);
    else lines.push('You are ' + p.name + ', ' + (p.female ? 'a woman' : 'a man') + ' of ' + p.age + ', a ' + p.trade + ' in Rome' + (p.freed ? ', a freed slave' : '') + '. You live near the ' + DISTRICT_NAME(p.home) + ' with ' + p.family + '. You are ' + p.traits.join(' and ') + '. Politically you ' + p.politics + '. You like to talk about ' + p.talk + '. Your worry right now: ' + WORRIES[p.worry].w + '. Something you never admit to strangers: you ' + p.secret + '.');
    lines.push('It is ' + yr + '. The person standing in front of you and talking to you is ' + you + ' (speak to them as "you"; never talk about them as if they were somebody else). Your feeling about them: ' + opWord(op) + ' (' + Math.round(op) + ' out of 100).');
    if (m.met) lines.push('You have spoken with them ' + m.met + ' time' + (m.met > 1 ? 's' : '') + ' before.');
    if (facts.length) lines.push('What you remember about them: ' + facts.join('; ') + '.');
    if (gos.length) lines.push('What people in the street say about them: ' + gos.join('; ') + '.');
    if (m.last.length) lines.push('The end of your last conversation: ' + m.last.join(' / '));
    lines.push('Speak as this person would in the Roman Republic: plain, concrete, sometimes funny, never modern. One to three short sentences. Never say you are an AI and never break character. If they insult or threaten you, react as a real person would. You may refuse, lie, haggle or change the subject.');
    if (!who.persona) lines.push(offerHelp
      ? 'They are offering to help you. If your worry is real to you, describe it and offer it to them as a job now.'
      : 'Only if your worry comes up naturally, or they ask whether you need anything, may you ask them for help with it as a job. Never more than once.');
    lines.push('Reply with ONLY a JSON object, nothing else: {"say": "your words", "mood": -2 to 2 (how this exchange changed your feeling about them), "remember": "one short fact about them worth remembering, or \"\"", "quest": null or {"title": "a short name", "problem": "one sentence", "steps": [{"place": one of ' + PLACES.join('|') + ', "task": "what they must do there, five to eight words"}], "reward": 100 to 1500}}');
    return lines.join('\n');
  }

  /* when the AI is not there: they still have a life, and they still need help */
  function scripted(S, who, text, m, offerHelp) {
    const p = who.p, t = (text || '').toLowerCase(), r = rng(hash(text + (S.day || 1) + (who.id || '')));
    if (!p) return { say: pick(r, ['Not now. I have a hundred things on my mind and you are the hundred and first.', 'Come back when the Forum is quieter.', 'We will talk properly another time.']), mood: 0 };
    if (offerHelp || /help|need|work|job|trouble|problem/.test(t)) {
      const w = WORRIES[p.worry];
      return { say: 'Since you ask. ' + w.w.charAt(0).toUpperCase() + w.w.slice(1) + '. If somebody with a name like yours looked into it, I would not forget it.', mood: 1, quest: { title: titleOf(w.w), problem: w.w, steps: w.steps.map(s => ({ place: s[0], task: s[1] })), reward: 300 + Math.floor(r() * 600) } };
    }
    if (/news|rumou?r|heard|gossip|what.*say/.test(t)) { const g = heard(S, p); return { say: g.length ? 'They say ' + g[0].replace(/^They say /i, '') + '. Make of it what you like.' : 'Bread is up again and the aediles are promising games. Same as every year.', mood: 0 }; }
    if (/hello|salve|greet|good (day|morning)|ave/.test(t) || !m.met) return { say: pick(r, ['Salve. You are the ' + (S.office || 'man') + ' everybody is talking about. I am ' + p.name + ', ' + p.trade + '.', 'Salve. ' + p.name + '. If you are buying, I am selling; if you are asking, I am busy.', 'Good day to you. ' + p.name + ' — I keep the ' + p.trade + '’s trade near the ' + DISTRICT_NAME(p.home) + '.']), mood: 1 };
    if (/thief|liar|idiot|fool|kill|threat|shut/.test(t)) return { say: pick(r, ['Say that again and you can find your own way out of this street.', 'I have had better manners from a mule. Good day.']), mood: -2, remember: 'was rude to me' };
    return { say: pick(r, ['Times are hard. ' + p.talk.split(',')[0].charAt(0).toUpperCase() + p.talk.split(',')[0].slice(1) + ' — that is all anybody here talks about.', 'You ask a lot of questions for a ' + (S.office || 'citizen') + '.', 'If you want my opinion, the whole Senate could be drowned in the Tiber and the bread would still be late.', 'My ' + (p.family.includes('children') ? 'children' : 'mother') + ' would not believe I am talking to you.']), mood: 0 };
  }
  const titleOf = w => { const s = w.replace(/^(a|my|the|someone|i)\s+/i, ''); return s.charAt(0).toUpperCase() + s.slice(1, 42).replace(/\s+\S*$/, '') + (s.length > 42 ? '…' : ''); };

  async function questFrom(S, who, said) {
    const w = who.p ? WORRIES[who.p.worry] : WORRIES[0];
    try {
      const raw = await llm([{ role: 'system', content: 'Turn a Roman citizen’s request for help into a job for a game set in the city of Rome. Places you may use: ' + PLACES.join(', ') + '. Reply with ONLY JSON: {"title": "short name", "problem": "one sentence", "steps": [{"place": "one of the places", "task": "five to eight words"}], "reward": 100 to 1500}. Two or three steps, in an order that makes sense.' }, { role: 'user', content: who.name + ' said: ' + said }], 30000);
      const j = firstJson(raw); if (j && Array.isArray(j.steps) && j.steps.length) return j;
    } catch (e) { }
    return { title: titleOf(w.w), problem: said.slice(0, 200), steps: w.steps.map(s => ({ place: s[0], task: s[1] })), reward: 300 + Math.floor(Math.random() * 500) };
  }
  /* a job the model wrote, made safe: real places, a sensible number of steps, a sensible reward */
  function makeQuest(S, who, q) {
    if (!q || typeof q !== 'object') return null;
    let steps = Array.isArray(q.steps) ? q.steps : [];
    const cut = t => t.length <= 64 ? t : t.slice(0, 64).replace(/\s+\S*$/, '') + '…';     // at a word, never in the middle of one
    steps = steps.map(s => ({ place: String(s && s.place || '').toLowerCase().trim(), task: cut(String(s && s.task || '').trim().replace(/\.$/, '')) }))
      .filter(s => PLACES.includes(s.place) && s.task.length > 3).slice(0, 3);
    if (!steps.length) { const w = who.p ? WORRIES[who.p.worry] : WORRIES[0]; steps = w.steps.map(s => ({ place: s[0], task: s[1] })); }
    const reward = clamp(Math.round(+q.reward || 400), 100, 1500);
    const id = 'ai_' + (who.id || 'x') + '_' + (S.day || 1) + '_' + Math.floor(Math.random() * 1e4);
    const title = String(q.title || titleOf(q.problem || 'A favour')).slice(0, 48);
    return {
      id, ai: true, giver: who.charId || null, giverName: who.name, cit: who.id, n: title, ic: '🗣️', at: steps[0].place,
      d: String(q.problem || title).slice(0, 220) + ' (asked by ' + who.name + ')',
      steps: steps.map(s => ({ at: s.place, act: s.task.charAt(0).toUpperCase() + s.task.slice(1), text: s.task.charAt(0).toUpperCase() + s.task.slice(1) })),
      reward: { denarii: reward, auctoritas: Math.round(reward / 90) + 3, rep: { people: 4 } }
    };
  }

  /* ============================ a conversation ============================ */
  function chat(S, api, target) {
    const who = target.cit
      ? (() => { const p = byId(target.cit), m = mem(S, p.id); return { id: p.id, p, name: p.name, sub: p.trade + ' · ' + DISTRICT_NAME(p.home) + ' · ' + p.age, op: opinion(S, p, m), look: target.look }; })()
      : { id: 'n:' + target.char.id, charId: target.char.id, name: target.char.t || target.char.n, sub: target.char.tt || '', persona: target.char.persona + ' You are speaking in your own voice; keep it short.', op: Math.round(((S.disp[target.char.id] || 0)) * 100), look: target.look, first: target.char.first };
    const m = mem(S, who.id);
    const session = [];                                     // this conversation, in model message form
    let busy = false, offered = null;
    const portrait = api.portrait(who.look);
    api.modal('💬 ' + esc(who.name), '<div class="cit"><div class="cithead"><img src="' + portrait + '" alt=""><div><b>' + esc(who.name) + '</b><span>' + esc(who.sub) + '</span><span class="citop" id="citop"></span></div></div>' +
      '<div class="citlog" id="citlog"></div><div id="citoffer"></div>' +
      '<div class="citin"><input id="citmsg" maxlength="280" autocomplete="off" placeholder="Say something to ' + esc(who.name.split(' ')[0]) + '…"><button class="btn pri" id="citsend">Say</button></div>' +
      '<div class="citquick"><button class="btn tiny" data-q="news">What is the news?</button>' + (who.p ? '<button class="btn tiny" data-q="help">Is anything troubling you?</button>' : '') +
      '<button class="btn tiny" data-q="coin">Give a coin (5 ⚖)</button>' + (target.more ? '<button class="btn tiny" data-q="more">More…</button>' : '') + '<button class="btn tiny" data-q="bye">Goodbye</button></div>' +
      '<p class="citai" id="citai"></p></div>', true);
    const log = api.$('citlog'), input = api.$('citmsg');
    const showOp = () => { api.$('citop').textContent = 'Feels ' + opWord(who.op) + ' towards you' + (m.met ? ' · you have spoken ' + m.met + ' time' + (m.met > 1 ? 's' : '') + ' before' : ''); };
    const line = (cls, text) => { const d = document.createElement('div'); d.className = 'citl ' + cls; d.innerHTML = cls === 'them' ? '<b>' + esc(who.name.split(' ')[0]) + '</b> ' + esc(text) : esc(text); log.appendChild(d); log.scrollTop = log.scrollHeight; return d; };
    showOp();
    model().then(mm => { const e = api.$('citai'); if (e) e.textContent = mm && Date.now() >= aiDown ? 'Speaking through the local AI (' + mm + '). Type anything; press Enter.' : 'The local AI is not running, so they answer from their own lives. Start Ollama to talk freely.'; });
    /* the opening: the first time, they introduce themselves; after that, they greet you as somebody they know */
    if (who.first && !m.met) line('them', who.first);
    else if (who.p) line('them', m.met ? pick(Math.random, ['You again. ', 'Ah, it is you. ', 'Back so soon? ']) + (who.op > 20 ? 'Good to see you.' : who.op < -10 ? 'What do you want this time?' : 'What is it?') : pick(Math.random, ['Yes? Can I help you?', 'Salve. You look like you want something.', 'Hm? Oh — salve.']));
    else line('them', 'Yes?');

    const finish = () => {
      m.met++; api.save();
      if (who.charId) S.disp[who.charId] = clamp(who.op / 100, -1, 1);
    };
    const offer = q => {
      offered = q;
      const box = api.$('citoffer'); if (!box) return;
      box.innerHTML = '<div class="citq"><b>📜 ' + esc(q.n) + '</b><span>' + esc(q.d) + '</span><i>' + q.steps.map(s => esc(s.act) + ' (' + esc(DISTRICT_NAME(s.at)) + ')').join(' → ') + ' · reward ' + q.reward.denarii + ' ⚖</i>' +
        '<div class="row"><button class="btn pri" id="citacc">Take the job</button><button class="btn" id="citdec">Not now</button></div></div>';
      api.$('citacc').onclick = () => { m.quest = q.id; m.op = clamp(m.op + 6, -100, 100); who.op = clamp(who.op + 6, -100, 100); finish(); api.startQuest(q); };
      api.$('citdec').onclick = () => { box.innerHTML = ''; m.op = clamp(m.op - 3, -100, 100); who.op -= 3; showOp(); line('them', 'Well. Think about it.'); offered = null; };
    };
    async function say(text, mode) {
      if (busy || !text) return; busy = true;
      line('me', text);
      const typing = line('them typing', '…');
      const canOffer = !!who.p && !m.quest && !offered && (S.aiQuests || []).filter(q => !(S.quests.done || []).includes(q.id)).length < 4;
      const helping = mode === 'help';
      let res = null;
      try {
        const sys = systemPrompt(S, api, who, m, helping && canOffer);
        const raw = await llm([{ role: 'system', content: sys }].concat(session.slice(-8)).concat([{ role: 'user', content: text }]));
        res = firstJson(raw) || { say: String(raw || '').replace(/[{}"]/g, '').replace(/^\s*say\s*:\s*/i, '').trim().slice(0, 400), mood: 0 };
        if (!res.say) throw new Error('empty');
        const e = api.$('citai'); if (e && MODEL) e.textContent = 'Speaking through the local AI (' + MODEL + ').';
      } catch (e) {
        res = scripted(S, who, text, m, helping && canOffer);
        const el = api.$('citai'); if (el) el.textContent = 'The local AI did not answer, so they speak from their own lives. (' + (e.message || e) + ')';
      }
      typing.remove();
      const said = String(res.say || '…').replace(/^["']|["']$/g, '').slice(0, 500);
      line('them', said);
      session.push({ role: 'user', content: text }, { role: 'assistant', content: JSON.stringify({ say: said }) });
      const mood = clamp(Math.round(+res.mood || 0), -2, 2);
      if (mood) { m.op = clamp(m.op + mood * 4, -100, 100); who.op = clamp(who.op + mood * 4, -100, 100); showOp(); }
      if (res.remember && String(res.remember).length > 3) {
        m.facts.push(String(res.remember).slice(0, 120)); if (m.facts.length > 10) m.facts = m.facts.slice(-10);
        /* the gossips pass it on: a thing you told one of them becomes a thing the street says */
        if (who.p && (who.p.traits.includes('gossipy') || who.p.traits.includes('talkative')) && Math.random() < .5) note(S, who.p.name + ' the ' + who.p.trade + ' says ' + S.name + ' ' + String(res.remember).replace(/^(they|he|she)\s+/i, ''));
      }
      m.last = [('You: ' + text).slice(0, 120), (who.name.split(' ')[0] + ': ' + said).slice(0, 160)];
      /* Small models often describe a favour in words and forget the structured job. When you have offered help or
         asked for work, what they said is turned into a job by a second short request, or failing that their own
         worry becomes one. */
      const asked = helping || /\b(help|work|job|need|trouble|problem|favou?r|task|hire)\b/i.test(text);
      if (canOffer && !res.quest && asked) res.quest = await questFrom(S, who, said);
      if (res.quest && canOffer) { const q = makeQuest(S, who, res.quest); if (q) offer(q); }
      api.save(); busy = false;
      if (input) input.focus();
    }
    const send = () => { const v = (input.value || '').trim(); if (!v) return; input.value = ''; say(v); };
    api.$('citsend').onclick = send;
    input.addEventListener('keydown', ev => { ev.stopPropagation(); if (ev.key === 'Enter') send(); if (ev.key === 'Escape') { finish(); api.close(); } });
    document.querySelectorAll('.citquick [data-q]').forEach(b => b.onclick = () => {
      const q = b.dataset.q;
      if (q === 'news') say('What is the news? What are people saying?');
      if (q === 'help') say('Is anything troubling you? Perhaps I can help.', 'help');
      if (q === 'coin') { if (S.denarii < 5) return api.toast('Your purse is empty', '', 'bad'); api.applyEff({ denarii: -5 }); api.sfx('coin'); m.op = clamp(m.op + 3, -100, 100); who.op += 3; showOp(); say('*gives you a coin* For your trouble.'); }
      if (q === 'bye') { finish(); api.close(); }
      if (q === 'more') { finish(); api.close(); target.more(); }
    });
    const mx = api.$('mx'); if (mx) mx.onclick = () => { finish(); api.close(); };
    setTimeout(() => input && input.focus(), 50);
  }

  /* a job they gave you is done: they remember it, and so does the street */
  function questDone(S, q) {
    if (!q || !q.ai) return;
    if (q.cit) { const m = mem(S, q.cit); m.op = clamp(m.op + 25, -100, 100); m.quest = null; m.done++; m.facts.push('solved my problem: ' + q.n); }
    note(S, S.name + ' helped ' + (q.giverName || 'a citizen') + ' with ' + q.n.toLowerCase());
  }
  /* the jobs the AI wrote are part of the save, and go back into the list of jobs whenever a career is loaded */
  function restore(S) {
    const Q = window.IMP.QUESTS; (S.aiQuests || []).forEach(q => { if (!Q.some(x => x.id === q.id)) Q.push(q); });
  }

  return { population, byId, crowd, chat, note, heard, questDone, restore, lookOpts, mem, opWord, opinion, PLACES, model };
})();

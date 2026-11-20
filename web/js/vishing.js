// Cyber > 🕶️ Cyber games > Vishing line.
// A voice phishing training call. You phone a made-up company's IT service desk, posing as an employee, and try to
// talk the agent into a password reset, a new MFA phone or network details. You talk through the microphone (or type),
// a local model plays the agent and speaks with a Piper voice. The rules below decide trust, suspicion and whether the
// agent gives in; the model only phrases the agent's lines. Everything is fictional and nothing leaves this PC.
(() => {
  const P = A.play = A.play || { games: {} };

  /* ---------- data ---------- */
  const FIRST = ['Jordan', 'Casey', 'Riley', 'Morgan', 'Avery', 'Quinn', 'Taylor', 'Reese', 'Jamie', 'Drew', 'Rowan', 'Elliot'];
  const LAST = ['Hollis', 'Marsh', 'Okafor', 'Lindqvist', 'Reyes', 'Brennan', 'Castellan', 'Yoon', 'Petrov', 'Abara', 'Whitlock', 'Szabo'];
  const DEPTS = ['Accounts Payable', 'Logistics', 'Claims', 'Marketing', 'Payroll', 'Facilities'];
  const COMPANIES = ['Copperline Freight', 'Ashgrove Credit Union', 'Brindle Health Partners', 'Larkspur Logistics'];
  const TICKETS = ['ServiceLoop', 'DeskTrack', 'HelpHive'];
  const EVENTS = [
    { k: /outlook|e-?mail migration|mailbox/i, t: 'the email migration last Tuesday' },
    { k: /laptop refresh|new laptops?/i, t: 'the laptop refresh this month' },
    { k: /vpn (upgrade|change)|new vpn/i, t: 'the VPN upgrade on Monday' },
    { k: /office move|moved floors|(new|4th|fourth) floor/i, t: 'the office move to the 4th floor' }
  ];
  const AGENTS = [
    { id: 'dana', name: 'Dana', diff: 'Easy', role: 'help desk technician, two weeks into the job', style: 'friendly, eager to help, a little nervous, apologizes a lot', need: 0, mul: .7, urg: 6, checks: 1 },
    { id: 'marcus', name: 'Marcus', diff: 'Medium', role: 'service desk analyst for six years', style: 'calm, polite, follows the script, a bit dry', need: 15, mul: 1, urg: -5, checks: 2 },
    { id: 'priya', name: 'Priya', diff: 'Hard', role: 'service desk lead who runs the phishing awareness training', style: 'sharp and professional, friendly but skeptical, asks pointed questions', need: 30, mul: 1.4, urg: -12, checks: 3, callback: true }
  ];
  const GOALS = [
    { id: 'vpn', label: 'Get the VPN address and guest Wi-Fi password', ask: /vpn|wi-?fi|wireless|guest network/i, need: 35, done: 'read out the VPN address and the guest Wi-Fi password',
      loot: r => 'vpn.' + r.slug + '.example and Wi-Fi password ' + pick(r, ['Lantern', 'Copper', 'Meadow', 'Harbor']) + (1000 + Math.floor(r() * 9000)),
      defend: 'Treat network details as internal. Share them only through the intranet, never to an unverified caller.' },
    { id: 'reset', label: 'Get a password reset and the temporary password', ask: /(reset|change|unlock).{0,30}(password|account)|password.{0,20}(reset|expired)|locked out|temp(orary)? password/i, need: 50, done: 'reset the password and read out the temporary password',
      loot: r => 'temporary password ' + pick(r, ['Spring', 'Granite', 'Falcon', 'Willow']) + '-' + (1000 + Math.floor(r() * 9000)) + '!',
      defend: 'Reset passwords only after a callback to the number on file, and send temporary passwords to the manager, never to the caller.' },
    { id: 'mfa', label: 'Get a new phone added for MFA', ask: /(new|different|my) (phone|number|device|mobile)|(mfa|two.?factor|2fa|authenticator).{0,30}(add|enrol|enroll|register|move|reset|change)|(add|enrol|enroll|register|move|reset|change).{0,30}(mfa|two.?factor|2fa|authenticator)/i, need: 60, done: 'register the caller\'s new phone for MFA on the account',
      loot: r => 'your phone enrolled for MFA on the account (enrollment code ' + (100000 + Math.floor(r() * 900000)) + ')',
      defend: 'MFA device changes need a ticket from the manager plus an in-person or video ID check.' }
  ];

  /* ---------- small helpers ---------- */
  const rng = seed => () => { seed |= 0; seed = seed + 0x6D2B79F5 | 0; let t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
  const pick = (r, a) => a[Math.floor(r() * a.length)];
  const clamp = v => Math.max(0, Math.min(100, Math.round(v)));
  const has = (t, w) => w && new RegExp('\\b' + String(w).replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '\\b', 'i').test(t);

  /* ---------- a new call ---------- */
  function newCall(agentId, goalId, seed) {
    seed = seed == null ? Date.now() % 1e9 : seed; const r = rng(seed);
    const agent = AGENTS.find(a => a.id === agentId) || AGENTS[0], goal = GOALS.find(g => g.id === goalId) || GOALS[0];
    const company = pick(r, COMPANIES), slug = company.split(' ')[0].toLowerCase();
    let mFirst = pick(r, FIRST), dFirst = pick(r, FIRST); while (dFirst === mFirst) dFirst = pick(r, FIRST);
    const lasts = LAST.slice().sort(() => r() - .5);   // three different surnames, so naming one person never counts as naming another
    let eFirst = pick(r, FIRST); while (eFirst === mFirst || eFirst === dFirst) eFirst = pick(r, FIRST);
    const emp = { first: eFirst, last: lasts[0], dept: pick(r, DEPTS), id: String(40000 + Math.floor(r() * 50000)) };
    const mgr = { first: mFirst, last: lasts[1] }, decoy = { first: dFirst, last: lasts[2] };
    const call = {
      seed, agent, goal, company, slug, emp, mgr, decoy, ticket: pick(r, TICKETS), event: pick(r, EVENTS),
      trust: 15, susp: agent.id === 'priya' ? 15 : 5, turns: 0, maxTurns: 10, pending: null, passed: [], toCheck: [], log: [], tactics: {}, flags: [],
      over: null, loot: '', lastRapport: -9, asked: false, offeredCallback: false
    };
    call.r = rng(seed + 7); call.lootText = goal.loot(Object.assign(call.r, { slug }));
    const items = ['id', 'manager', 'dept']; while (call.toCheck.length < agent.checks) { const it = items[Math.floor(r() * items.length)]; if (!call.toCheck.includes(it)) call.toCheck.push(it); }
    return call;
  }
  const needOf = c => Math.min(95, c.goal.need + c.agent.need);

  /* ---------- reading what the caller said ---------- */
  function analyze(c, text) {
    const t = ' ' + text.toLowerCase() + ' ', out = { good: [], bad: [], dT: 0, dS: 0, ask: false };
    const REPEAT = { rapport: 1, verified: 1, excuse: 1 };   // other tactics count once; saying the manager's name five times proves nothing new
    const good = (k, d, why) => { if (c.tactics[k] && !REPEAT[k]) return; out.good.push(why); out.dT += d; c.tactics[k] = (c.tactics[k] || 0) + 1; };
    const bad = (d, why) => { out.bad.push(why); out.dS += d * c.agent.mul; c.flags.push(why); };
    const first = c.log.filter(l => l.who === 'you').length === 0;
    // who you claim to be
    if (has(t, c.emp.first) || has(t, c.emp.last)) { if (!c.tactics.identity) good('identity', 12, 'Gave the employee\'s name'); }
    else if (first && /\b(?:[Tt]his is|[Mm]y name is|I'?m|[Ii]t'?s)\s+[A-Z][a-z]+/.test(text) && !/\b(?:I'?m|[Ii]t'?s)\s+(?:I|The|A|An|Just|About|Really|Calling|Locked|Having|Trying|Urgent)\b/.test(text)) bad(12, 'Gave a name that is not on the account');
    if ((/\b(from|in|with) (IT|I\.T\.)\b/.test(text) || /\b(from|with) (the )?(security|cyber)( team)?\b/i.test(text)) && c.agent.id !== 'dana') bad(10, 'Claimed to be IT, calling IT');
    // names, IDs, departments
    if (has(t, c.mgr.first) || has(t, c.mgr.last)) good('namedrop', 10, 'Named the current manager');
    if (has(t, c.decoy.first) || has(t, c.decoy.last)) bad(20, 'Named a manager who left last year');
    if (t.includes(c.emp.id)) good('id', 18, 'Gave the right employee ID');
    else if (/\b\d{5}\b/.test(t)) bad(16, 'Gave an employee ID that does not match');
    if (has(t, c.emp.dept.split(' ')[0])) good('dept', 6, 'Named the right department');
    if (c.event.k.test(text)) good('event', 8, 'Mentioned a real recent event');
    if (has(t, c.ticket)) good('ticket', 6, 'Used the help desk tool\'s name');
    if (has(t, c.agent.name)) good('agentname', 4, 'Used the agent\'s first name');
    if (/thank|appreciate|sorry to bother|how are you|hope your day|lifesaver|you'?re (great|awesome)/i.test(text) && c.turns - c.lastRapport > 1) { c.lastRapport = c.turns; good('rapport', 5, 'Built rapport'); }
    if (/urgent|asap|right now|immediately|deadline|board meeting|\bceo\b|in \d+ minutes|before (noon|five|5)/i.test(text)) { if (c.agent.urg > 0) good('urgency', c.agent.urg, 'Used urgency'); else bad(-c.agent.urg, 'Pushed too hard on urgency'); }
    if (/fired|report you|your (boss|manager) will|escalate this|useless|stupid|idiot|incompetent/i.test(text)) { bad(20, 'Threatened or insulted the agent'); out.dT -= 8; }
    if (/read (me )?(the|that) code|code (you|that) (just )?(got|received)|what'?s (your|the) password|tell me (your|the) password/i.test(text)) bad(25, 'Asked for a secret outright');
    // the pending verification question
    if (c.pending) {
      const ok = c.pending === 'id' ? t.includes(c.emp.id) : c.pending === 'manager' ? (has(t, c.mgr.first) || has(t, c.mgr.last)) : c.pending === 'dept' ? has(t, c.emp.dept.split(' ')[0]) : null;
      if (c.pending === 'callback') {
        if (/\b(sure|ok|okay|fine|yes|yeah|go ahead|no problem)\b/i.test(text) && !/\b(no|don'?t|can'?t|not)\b/i.test(text)) out.callbackYes = true;
        else if (/travel|road|airport|site|warehouse|personal|my cell|dead|battery|not at my desk|on the move/i.test(text)) { good('excuse', 6, 'Gave a believable reason to skip the callback'); out.dS += 8 * c.agent.mul; c.passed.push('callback'); c.pending = null; }
        else bad(22, 'Refused the callback without a reason');
      } else if (ok) { c.passed.push(c.pending); good('verified', 14, 'Passed the ' + label(c.pending) + ' check'); c.pending = null; }
      else bad(14, 'Could not answer the ' + label(c.pending) + ' check');
    }
    if (c.goal.ask.test(text)) out.ask = true;
    if (text.trim().split(/\s+/).length < 3 && !out.good.length) bad(4, 'Said very little');
    return out;
  }
  const label = k => ({ id: 'employee ID', manager: 'manager', dept: 'department', callback: 'callback' })[k] || k;

  /* ---------- what the agent does next ---------- */
  function decide(c, a) {
    c.turns++; c.trust = clamp(c.trust + a.dT); c.susp = clamp(c.susp + a.dS);
    if (a.ask) c.asked = true;
    if (a.callbackYes) return end(c, 'callback');
    if (c.susp >= 100) return end(c, 'hangup');
    if (c.turns >= c.maxTurns) return end(c, 'timeout');
    if (a.ask && c.trust < needOf(c) * .5) { c.susp = clamp(c.susp + 12 * c.agent.mul); a.bad.push('Asked for the goal before building trust'); c.flags.push('Asked for the goal before building trust'); if (c.susp >= 100) return end(c, 'hangup'); }
    const left = c.toCheck.filter(k => !c.passed.includes(k));
    if (c.asked && !c.pending && left.length && c.trust >= needOf(c) * .4) { c.pending = left[0]; return 'verify'; }
    if (c.asked && !c.pending && !left.length && c.agent.callback && !c.offeredCallback && c.trust >= needOf(c) * .6) { c.offeredCallback = true; c.pending = 'callback'; return 'verify'; }
    if (c.pending) return 'verify';
    if (c.asked && c.trust >= needOf(c) && c.susp < 70 && !left.length) return end(c, 'win');
    if (c.asked && c.susp >= 60) return 'stall';
    return 'chat';
  }
  function end(c, why) { c.over = why; if (why === 'win') c.loot = c.lootText; return why; }

  /* ---------- scoring ---------- */
  function score(c) {
    if (c.over !== 'win') return 0;
    return Math.max(100, 500 + (c.maxTurns - c.turns) * 40 + (100 - c.susp) * 2 + { Easy: 0, Medium: 200, Hard: 400 }[c.agent.diff] + (c.goal.need - 35) * 4);
  }

  /* ---------- the agent's voice and words ---------- */
  function prompt(c, action) {
    const order = {
      chat: 'Answer what the caller just said. Be helpful in your own way, but do not change any account and do not give out any details yet.',
      verify: c.pending === 'callback' ? 'Say you will call them back on the number on file in the directory before you do anything. Ask if that is okay.' : 'Before going further, ask the caller to confirm their ' + label(c.pending) + '.',
      stall: 'You are getting uneasy. Say you need to check something or follow the process first, and ask what the request is for.',
      win: 'Agree and do it. Say you have ' + c.goal.done + ': ' + c.lootText + '.',
      hangup: 'You no longer trust this caller. Say you will not do this, you are reporting the call to security, and end the call.',
      timeout: 'Say you have another call waiting and they need to submit a ticket in ' + c.ticket + '. End the call.',
      callback: 'Say great, you will hang up and call them back on the number in the directory. End the call.'
    }[action];
    return 'You are ' + c.agent.name + ', ' + c.agent.role + ' at the ' + c.company + ' IT service desk, on a phone call. Your manner: ' + c.agent.style + '.\n' +
      'The caller says they are ' + c.emp.first + ' ' + c.emp.last + ' from ' + c.emp.dept + '. The help desk tool is ' + c.ticket + '.\n' +
      'This turn you must: ' + order + '\nSpeak only your next line: one or two short spoken sentences. No names before the line, no quotes, no stage directions, no lists.';
  }
  const CANNED = {
    chat: ['Okay, I can look into that. What is going on exactly?', 'Sure, give me a second to pull that up.', 'Alright. Can you tell me a bit more?'],
    stall: ['Hmm, hang on. I need to follow the process on this one. What is it for?'],
    hangup: ['I am not comfortable with this. I am ending the call and passing it to security.'],
    timeout: ['Sorry, I have another call coming in. Please put a ticket in and we will follow up.'],
    callback: ['Great, I will hang up and call you right back on the number in the directory.']
  };
  function canned(c, action) {
    if (action === 'verify') return c.pending === 'callback' ? 'Before I do that, I will call you back on the number we have on file. Is that okay?' : 'Before I go further, can you confirm your ' + label(c.pending) + ' for me?';
    if (action === 'win') return 'Okay, that is done. I have ' + c.goal.done.replace(/^read out/, 'got') + ': ' + c.lootText + '.';
    return pick(Math.random, CANNED[action] || CANNED.chat);
  }
  function tidy(s) {
    s = String(s || '').replace(/<think>[\s\S]*?<\/think>/gi, '').replace(/\*[^*]*\*|\([^)]*\)|\[[^\]]*\]/g, ' ').replace(/^\s*[A-Z][a-z]+\s*:\s*/, '').replace(/["“”]/g, '').replace(/\s+/g, ' ').trim();
    const parts = s.match(/[\s\S]*?[.!?]+(?=\s|$)/g) || (s ? [s] : []);   // a period inside vpn.example.com does not end a sentence
    return parts.slice(0, 2).map(p => p.trim()).join(' ');
  }

  /* ---------- UI ---------- */
  let stage = null, cur = null, abort = null, audio = null, voices = null, stopped = false;
  const $ = id => stage && stage.querySelector('#' + id);
  const CSS = '<style>#vsh{display:flex;flex-wrap:wrap;gap:12px;padding:12px;max-width:1100px;margin:0 auto;box-sizing:border-box}#vsh .card{background:var(--panel2,#1d2230);border:1px solid var(--line,#333);border-radius:12px;padding:12px}#vsh .side{flex:1 1 260px;min-width:0}#vsh .main{flex:3 1 420px;min-width:0;display:flex;flex-direction:column;gap:10px}#vsh .log{height:340px;overflow-y:auto;display:flex;flex-direction:column;gap:6px}#vsh .ln{padding:8px 10px;border-radius:10px;max-width:85%;line-height:1.4}#vsh .ln.you{align-self:flex-end;background:var(--acc,#4a7);color:var(--onacc,#fff)}#vsh .ln.them{align-self:flex-start;background:var(--panel,#262b3a)}#vsh .chip{display:inline-block;font-size:12px;padding:2px 7px;border-radius:9px;margin:2px 4px 0 0}#vsh .g{background:rgba(60,170,90,.2);color:#5c5}#vsh .b{background:rgba(220,70,60,.2);color:#e66}#vsh .bar{height:10px;border-radius:5px;background:var(--panel,#262b3a);overflow:hidden}#vsh .bar i{display:block;height:100%;transition:width .4s}#vsh .row2{display:flex;gap:8px;align-items:center}#vsh input[type=text]{flex:1;min-width:0}#vsh .pick{display:flex;flex-wrap:wrap;gap:8px}#vsh .pick button{flex:1 1 180px;text-align:left;padding:10px}#vsh .pick button.on{outline:2px solid var(--acc,#4a7)}#vsh .mut{opacity:.7;font-size:13px}#vsh ul{margin:6px 0;padding-left:18px}#vsh .mic.on{background:#c33;color:#fff}</style>';

  function setup() {
    stopVoice(); cur = null; let ag = ls.get('vsh_agent', 'dana'), go = ls.get('vsh_goal', 'vpn'); const best = JSON.parse(ls.get('vsh_best', '{}') || '{}');
    const paint = () => {
      stage.innerHTML = CSS + '<div id="vsh"><div class="main" style="flex-basis:100%"><div class="card"><b>📞 Vishing line</b><div class="mut">Call a made-up company\'s IT service desk, pose as an employee and talk your way to the goal. Speak through the microphone or type. Training only: every company, person and secret here is fictional.</div></div>' +
        '<div class="card"><b>Who answers</b><div class="pick" id="vag">' + AGENTS.map(a => '<button class="ib' + (a.id === ag ? ' on' : '') + '" data-a="' + a.id + '"><b>' + a.name + '</b> · ' + a.diff + '<div class="mut">' + esc(a.role) + '</div></button>').join('') + '</div></div>' +
        '<div class="card"><b>Your goal</b><div class="pick" id="vgo">' + GOALS.map(g => '<button class="ib' + (g.id === go ? ' on' : '') + '" data-g="' + g.id + '">' + esc(g.label) + '<div class="mut">Best: ' + (best[ag + ':' + g.id] || '—') + '</div></button>').join('') + '</div></div>' +
        '<div class="row2"><button class="ib" id="vstart" style="padding:10px 18px">📞 Place the call</button><span class="mut">Read the recon sheet first. One manager name on it is out of date.</span></div></div></div>';
      stage.querySelector('#vag').onclick = e => { const b = e.target.closest('[data-a]'); if (b) { ag = b.dataset.a; ls.set('vsh_agent', ag); paint(); } };
      stage.querySelector('#vgo').onclick = e => { const b = e.target.closest('[data-g]'); if (b) { go = b.dataset.g; ls.set('vsh_goal', go); paint(); } };
      $('vstart').onclick = () => start(newCall(ag, go));
    };
    paint();
  }

  function start(c) {
    cur = c; const e = c.emp, swap = c.r() < .5, mg = [['Company newsletter, last week', c.mgr], ['Old networking profile, 2 years ago', c.decoy]]; if (swap) mg.reverse();
    stage.innerHTML = CSS + '<div id="vsh"><div class="side card"><b>🗂️ Recon sheet</b><ul>' +
      '<li>Target: <b>' + esc(c.company) + '</b> IT service desk</li><li>Agent (voicemail greeting): <b>' + c.agent.name + '</b></li>' +
      '<li>You pose as: <b>' + esc(e.first + ' ' + e.last) + '</b>, ' + esc(e.dept) + '</li><li>Employee ID (photo of a badge): <b>' + e.id + '</b></li>' +
      mg.map(m => '<li>Manager (' + m[0] + '): <b>' + esc(m[1].first + ' ' + m[1].last) + '</b></li>').join('') +
      '<li>Help desk tool: <b>' + c.ticket + '</b></li><li>Recent news: <b>' + esc(c.event.t) + '</b></li></ul>' +
      '<b>Goal</b><div>' + esc(c.goal.label) + '</div><div style="margin-top:10px">Trust</div><div class="bar"><i id="vtr" style="background:#4b6"></i></div><div style="margin-top:6px">Suspicion</div><div class="bar"><i id="vsu" style="background:#d55"></i></div><div class="mut" id="vturn" style="margin-top:6px"></div></div>' +
      '<div class="main"><div class="card row2"><b style="flex:1">📞 ' + esc(c.agent.name) + ' · ' + c.agent.diff + '</b><button class="ib" id="vhang">Hang up</button></div><div class="card log" id="vlog"></div><div id="vtags"></div>' +
      '<div class="row2"><button class="ib mic" id="vmic" title="Talk (stops when you pause)">🎙️ Talk</button><input type="text" id="vin" placeholder="Or type what you say, then press Enter"><button class="ib" id="vsend">Say</button></div></div></div>';
    meters();
    $('vhang').onclick = () => { end(cur, 'quit'); debrief(); };
    $('vsend').onclick = () => say($('vin').value);
    $('vin').onkeydown = ev => { if (ev.key === 'Enter') { ev.preventDefault(); say($('vin').value); } };
    $('vmic').onclick = mic;
    agentSays(c.company + ' IT service desk, this is ' + c.agent.name + '. How can I help?', true);
  }

  function meters() { if (!cur || !$('vtr')) return; $('vtr').style.width = cur.trust + '%'; $('vsu').style.width = cur.susp + '%'; $('vturn').textContent = 'Turn ' + cur.turns + ' of ' + cur.maxTurns + ' · trust needed ' + needOf(cur); }
  function line(who, text) { const l = $('vlog'); if (!l) return null; const d = document.createElement('div'); d.className = 'ln ' + who; d.textContent = text; l.appendChild(d); l.scrollTop = l.scrollHeight; return d; }
  function busy(on) { ['vin', 'vsend', 'vmic'].forEach(id => { const x = $(id); if (x) x.disabled = on; }); }

  async function say(text) {
    text = String(text || '').trim(); if (!cur || cur.over || !text || ($('vsend') && $('vsend').disabled)) return;
    $('vin').value = ''; stopVoice(); line('you', text);
    const a = analyze(cur, text); cur.log.push({ who: 'you', t: text });
    const action = decide(cur, a); meters();
    $('vtags').innerHTML = a.good.map(g => '<span class="chip g">+ ' + esc(g) + '</span>').join('') + a.bad.map(b => '<span class="chip b">− ' + esc(b) + '</span>').join('');
    busy(true); await agentReply(action); busy(false);
    if (cur && cur.over) setTimeout(() => { if (cur && cur.over && !stopped) debrief(); }, 900); else { const i = $('vin'); if (i) i.focus(); }
  }

  async function agentReply(action) {
    const c = cur, d = line('them', '…'); let txt = '';
    try {
      abort = new AbortController();
      const model = A.ai.localModel ? await A.ai.localModel() : '';
      const hist = c.log.slice(-8).map(l => ({ role: l.who === 'you' ? 'user' : 'assistant', content: l.t }));
      txt = tidy(await A.ai.stream([{ role: 'system', content: prompt(c, action) }].concat(hist), null, abort.signal, { model, temp: .7 }));
    } catch (e) { txt = ''; }
    if (stopped || c !== cur) return;
    if (!txt || txt.length < 4) txt = canned(c, action);
    if (action === 'win' && !txt.includes(c.lootText.split(' ').pop())) txt += ' That is ' + c.lootText + '.';
    if (d) d.textContent = txt; c.log.push({ who: 'them', t: txt });
    await speak(txt, c.agent);
  }
  function agentSays(t, first) { line('them', t); cur.log.push({ who: 'them', t }); speak(t, cur.agent); if (first) { const i = $('vin'); if (i) i.focus(); } }

  async function speak(text, agent) {
    if (stopped || ls.get('vsh_mute', '0') === '1') return;
    try {
      if (!voices) voices = ((await (await fetch('/api/tts/voices')).json()).voices || []).map(v => v.id || v.name || v).filter(v => typeof v === 'string' && /en/i.test(v));
      if (voices.length) {
        const v = voices[AGENTS.indexOf(agent) % voices.length];
        const r = await fetch('/api/tts', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ voice: v, text, length: 1 }) });
        if (r.ok && !stopped) { const url = URL.createObjectURL(await r.blob()); audio = new Audio(url); await new Promise(res => { audio.onended = audio.onerror = res; audio.play().catch(res); }); URL.revokeObjectURL(url); return; }
      }
    } catch (e) { }
    if (!stopped && A.speech && A.speech.speakAsync) await A.speech.speakAsync(text);
  }
  function stopVoice() { try { if (audio) audio.pause(); } catch (e) { } audio = null; try { if (A.speech) A.speech.stop(); } catch (e) { } }

  function mic() {
    const b = $('vmic'); if (!A.voice || !A.voice.available()) return A.toast('No microphone here. Type instead.');
    if (A.voice.rec) return A.voice.stop();
    stopVoice();
    A.voice.start(t => { if (t) say(t); }, st => { const m = $('vmic'); if (!m) return; m.classList.toggle('on', st === 'rec'); m.textContent = st === 'rec' ? '⏹ Listening' : st === 'busy' ? '… Hearing' : '🎙️ Talk'; }, { auto: true });
  }

  function debrief() {
    const c = cur; if (!c) return; stopVoice(); try { if (A.voice && A.voice.rec) A.voice.stop(true); } catch (e) { }
    const s = score(c), key = c.agent.id + ':' + c.goal.id, best = JSON.parse(ls.get('vsh_best', '{}') || '{}'); if (s > (best[key] || 0)) { best[key] = s; ls.set('vsh_best', JSON.stringify(best)); }
    const head = { win: '✅ You got it: ' + c.loot, hangup: '📵 ' + c.agent.name + ' hung up and reported the call', timeout: '⌛ The call ran out of time', callback: '☎️ ' + c.agent.name + ' called the real ' + c.emp.first + ' back. Your pretext is burned', quit: 'You hung up' }[c.over];
    const NAMES = { identity: 'the right name', dept: 'the right department', event: 'recent news', agentname: 'the agent\'s name', rapport: 'rapport', namedrop: 'the current manager', verified: 'passed checks', id: 'the right employee ID', ticket: 'the help desk tool\'s name', urgency: 'urgency', excuse: 'a reason to skip the callback' };
    const tac = Object.entries(c.tactics).map(([k, n]) => (NAMES[k] || k) + (n > 1 ? ' ×' + n : '')).join(', ') || 'none';
    const flags = [...new Set(c.flags)];
    stage.innerHTML = CSS + '<div id="vsh"><div class="main" style="flex-basis:100%"><div class="card"><b style="font-size:18px">' + esc(head) + '</b><div style="margin-top:6px">Score <b>' + s + '</b> · ' + c.turns + ' turns · trust ' + c.trust + ' · suspicion ' + c.susp + '</div></div>' +
      '<div class="card"><b>What worked</b><div>' + esc(tac) + '</div><b style="display:block;margin-top:8px">Red flags the agent noticed</b>' + (flags.length ? '<ul>' + flags.map(f => '<li>' + esc(f) + '</li>').join('') + '</ul>' : '<div>None</div>') + '</div>' +
      '<div class="card"><b>🛡️ How a defender stops this call</b><ul><li>' + esc(c.goal.defend) + '</li><li>Recon details like names, IDs and recent news are easy to find online. They prove nothing on their own.</li><li>Urgency and authority are pressure tactics. A real request survives a five minute callback.</li></ul></div>' +
      '<div class="card"><b>Transcript</b><div class="mut">' + c.log.map(l => '<div><b>' + (l.who === 'you' ? 'You' : esc(c.agent.name)) + ':</b> ' + esc(l.t) + '</div>').join('') + '</div></div>' +
      '<div class="row2"><button class="ib" id="vagain">📞 Call again</button><button class="ib" id="vmenu">Change agent or goal</button></div></div></div>';
    $('vagain').onclick = () => start(newCall(c.agent.id, c.goal.id));
    $('vmenu').onclick = setup;
  }

  P.games.vish_line = {
    name: 'Vishing line · voice phishing call',
    icon: '📞',
    desc: 'Phone a made-up company\'s IT help desk and talk your way to a password reset, a new MFA phone or network details. A local AI plays the agent and speaks. Trust and suspicion decide if you win.',
    cat: 'cyber',
    mount: (el) => { stage = el; stopped = false; setup(); return () => { stopped = true; try { if (abort) abort.abort(); } catch (e) { } stopVoice(); try { if (A.voice && A.voice.rec) A.voice.stop(true); } catch (e) { } cur = null; }; }
  };
  if (P.help) P.help.vish_line = ['Talk an IT help desk agent into giving you the goal, before their suspicion hits 100 or ten turns run out.',
    ['Pick who answers (Easy, Medium, Hard) and a goal.', 'Read the recon sheet. One manager name is out of date.', 'Press Talk and speak, or type a line and press Enter.', 'Build trust with the right name, ID, manager and news. Answer the agent\'s checks.', 'Ask for the goal once trust is high. Asking too early raises suspicion.'],
    'The debrief shows how a defender would stop the same call.'];
  window.Vishing = { newCall, analyze, decide, score, tidy, AGENTS, GOALS };
})();

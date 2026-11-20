// Lets the AI press buttons in Moundshroud: make a quiz, flashcards, a study guide, set a reminder, open a section, look things up...
// The model is given these as tools (only when your message sounds like a request); each one runs the same code the buttons use.
(() => {
  const tabs = { today: 'home', brain: 'brain', file_brain: 'brain', photos: 'photos', mail: 'mail', email: 'mail', passwords: 'cyber', password_vault: 'cyber', documents: 'docs', office_files: 'offed', calculator: 'calc', scanner: 'scan', reminders: 'rem', timers: 'rem', clipboard: 'clip', writing: 'writing', practice: 'practice', teach_me: 'teach', albums: 'albums', translate: 'lang', prompts: 'health', puzzle_maker: 'play', cyber_games: 'cyber', chat: 'chat', library: 'lib', browser: 'web', search: 'web', tor: 'web', my_files: 'files', files: 'files', notes: 'notes', study: 'study', tools: 'tools', meeting_notes: 'meet', first_aid: 'health', prepare: 'health', stock_up: 'health', guide: 'guide', app_map: 'map', news: 'news', news_research: 'news', markets: 'news', calendar: 'cal', kitchen: 'kitchen', garden: 'garden', money: 'money', journal: 'journal', entertainment: 'play', games: 'play', music: 'music', radio: 'radio', tv: 'tv', television: 'tv', youtube: 'tv', languages: 'lang', studio: 'studio', sky: 'sky', lab: 'lab', timeline: 'lib', cyber: 'cyber', spiritual: 'faith', settings: 'settings', privacy: 'settings' };
  const subs = { system: 'sys', calculator: 'calc', reminders: 'rem', translate: 'trans', clipboard: 'clip', prompts: 'prm', cyberchef: 'chef' };
  const cats = { wikipedia: 'Wikipedia', dictionary: 'Dictionary', medical: 'Medical', tech_help: 'Tech help', cooking_diy: 'Cooking & DIY' };
  const fn = (name, description, properties, required) => ({ type: 'function', function: { name, description, parameters: { type: 'object', properties, required: required || [] } } });
  const SRC = { type: 'string', enum: ['topic', 'last_answer', 'attached_file'], description: 'Where the material comes from: the topic named (default), your previous answer in this chat, or the file the user attached.' };

  const schema = [
    fn('make_image', 'Draw a picture in Studio › AI Art using the picture model on this PC.', { description: { type: 'string', description: 'What the picture should show, in the user\'s words' }, shape: { type: 'string', enum: ['square', 'wide', 'tall'] } }, ['description']),
    fn('make_quiz', 'Create and start a quiz for the user.', { topic: { type: 'string', description: 'What the quiz is about' }, count: { type: 'integer', description: 'Number of questions, 5 to 20 (default 10)' }, difficulty: { type: 'string', enum: ['easy', 'medium', 'hard'] }, types: { type: 'array', items: { type: 'string', enum: ['mc', 'tf', 'fill', 'short'] }, description: 'mc=multiple choice, tf=true/false, fill=fill in the blank, short=short answer' }, source: SRC }, ['topic']),
    fn('make_study_guide', 'Write a study guide, summary, cheat sheet or practice problems for the user.', { topic: { type: 'string' }, style: { type: 'string', enum: ['Study guide', 'Summary', 'Cheat sheet', 'Explain it simply', 'Practice problems with answers'] }, source: SRC }, ['topic']),
    fn('make_flashcards', 'Create a flashcard deck for the user to study.', { topic: { type: 'string' }, count: { type: 'integer', description: 'Number of cards, 6 to 20 (default 10)' }, source: SRC }, ['topic']),
    fn('open_section', 'Switch the app to a section.', { section: { type: 'string', enum: Object.keys(tabs) }, tool: { type: 'string', enum: Object.keys(subs), description: 'Only for the tools section' } }, ['section']),
    fn('search_library', 'Search the offline library (encyclopedia, dictionary, medical, tech help, cooking and DIY) and show the results.', { query: { type: 'string' }, library: { type: 'string', enum: Object.keys(cats) } }, ['query']),
    fn('search_my_files', 'Search the user\'s own files and notes and show the results.', { query: { type: 'string' } }, ['query']),
    fn('define_word', 'Show the dictionary definition of a word.', { word: { type: 'string' } }, ['word']),
    fn('show_synonyms', 'Show synonyms and antonyms of a word in the thesaurus.', { word: { type: 'string' } }, ['word']),
    fn('show_rhymes', 'Open the rhyming dictionary and show words that rhyme with a word.', { word: { type: 'string' } }, ['word']),
    fn('set_reminder', 'Set a reminder or timer that pops up on the PC.', { what: { type: 'string', description: 'What to be reminded about' }, when: { type: 'string', description: 'When, in plain English, e.g. "tomorrow at 9am", "in 20 minutes", or a repeat such as "every day at 8am", "every Monday and Thursday at 6pm", "on weekdays at 7:30", "monthly on the 15th"' } }, ['what', 'when']),
    fn('save_note', 'Save a note for the user.', { title: { type: 'string' }, content: { type: 'string' } }, ['title', 'content']),
    fn('translate_text', 'Open the translator and translate text.', { text: { type: 'string' }, language: { type: 'string', description: 'Target language, e.g. Spanish' } }, ['text', 'language']),
    fn('create_document', 'Create a real file for the user: a Word document, a spreadsheet, a PowerPoint presentation or a PDF (letters, reports, budgets, trackers, slide decks, checklists).', { kind: { type: 'string', enum: ['word', 'spreadsheet', 'presentation', 'pdf'] }, request: { type: 'string', description: 'What the document should contain, in the user\'s own words, with any details they gave' }, use_last_answer: { type: 'boolean', description: 'True if it should be based on your previous answer in this chat' } }, ['kind', 'request']),
    fn('open_prepare', 'Open a page of the Prepare section (emergency readiness for outages and disasters): readiness check, first aid, scenario plans (power outage, no water, storm, flood, earthquake, wildfire...), supplies and calculators, people and contacts, signals and radio, sun and moon, stocking up downloads, or the printable binder.', { page: { type: 'string', enum: ['ready', 'first_aid', 'plans', 'supplies', 'people', 'signals', 'sky', 'stock', 'binder'] } }, ['page']),
    fn('make_emergency_binder', 'Create the printable emergency binder (PDF) from the user\'s saved household, contacts, supplies and plans.', {}),
    fn('remember_fact', 'Remember something about the user for future conversations, when they ask you to remember it (e.g. "remember that I am vegetarian"). Store it as a short sentence about them.', { fact: { type: 'string', description: 'The fact, as a short sentence, e.g. "The user is vegetarian."' } }, ['fact']),
    fn('forget_fact', 'Forget something you were asked to remember about the user.', { about: { type: 'string', description: 'Words describing what to forget' } }, ['about']),
    fn('search_photos', 'Show the user\'s photos matching plain words (what is in them, a place, a month or a year), in the Photos tab.', { query: { type: 'string', description: 'e.g. "beach 2023", "dog", "June birthday"' } }, ['query']),
    fn('draft_email', 'Open a new email draft in Mail with the text filled in, for the user to check and save. It is never sent.', { to: { type: 'string' }, subject: { type: 'string' }, body: { type: 'string', description: 'The email text, written in full' } }, ['body']),
    fn('start_voice_mode', 'Start hands-free voice conversation mode.', {}),
    fn('security_tool', 'Run a security or networking tool from the Cyber Toolkit and get the result, so you can show it and explain it. Use it when the user asks you to scan ports, look up DNS or WHOIS, check a site\'s security headers or certificate, find subdomains, look up an IP, make or identify or try to crack a hash, trace a route, or see the local network or nearby Wi-Fi. These tools only look and read; never claim to break into anything.', { tool: { type: 'string', enum: ['dns', 'ipinfo', 'reverse', 'whois', 'subdomains', 'portscan', 'tlscert', 'headers', 'fingerprint', 'traceroute', 'mynetwork', 'wifi', 'hashid', 'hashcrack', 'hashmake'], description: 'Which tool to run' }, host: { type: 'string', description: 'A host name or IP, for dns/ipinfo/reverse/whois/subdomains/portscan/tlscert/traceroute' }, url: { type: 'string', description: 'A web address, for headers and fingerprint' }, ports: { type: 'string', description: 'For portscan: "top", "common", or a list/range like "80,443" or "1-1024"' }, hash: { type: 'string', description: 'For hashid/hashcrack: the hash' }, text: { type: 'string', description: 'For hashmake: the text to hash' }, words: { type: 'string', description: 'For hashcrack: extra words to try' } }, ['tool']),
    fn('artex', 'Start ARTEX, the AI autonomous penetration-testing system, and open it in the Cyber tab. Use it when the user asks to run a pentest, launch ARTEX, or have the AI test a target they own. ARTEX runs on this PC and thinks with the local models; it only tests systems the user owns or is authorised to test. This opens it; the user types the target inside ARTEX.', { action: { type: 'string', enum: ['open', 'status'], description: 'open = start ARTEX and show it; status = only report whether it is running' } }, []),
    fn('read_app_code', 'Look inside Moundshroud\'s own source code. Use it when the user asks how a part of the app works, where a setting or button lives, or what a feature does. Give a search phrase, or an exact file path to read it.', { query: { type: 'string', description: 'Words to search for in the app\'s code, e.g. "premove queue" or "board finish"' }, file: { type: 'string', description: 'Exact file to read, e.g. web/js/chat.js (only when you already know it)' } }, [])
  ];
  const refSheet = () => { try { return A.appMap && A.appMap.reference ? '\n\nWhere things are in Moundshroud (the App map\'s reference sheet; use it to answer "where is" and "how do I" questions, say the path in a few words, then open the place with open_section or open_prepare):\n' + A.appMap.reference() : ''; } catch (e) { return ''; } };
  const hint0 = '\n\nThe app you are part of is Moundshroud, and you can read its own source with read_app_code (web/js, web/css, lib, server.js and the README). Use it when the user asks about the app itself: name the real file rather than guessing.\n\nYou can operate the Moundshroud app with tools. When the user asks you to make a quiz, flashcards or a study guide, set a reminder or timer, open a section, look something up, define a word, show synonyms or rhymes, save a note, translate, remember or forget something about them, find their photos, write an email draft, or start voice mode, call the matching tool instead of just describing how. Never say you did something (remembered, saved, opened) unless you called the tool for it. For anything else, answer normally. Never call a tool the user did not ask for.';
  const ACT = /\b(quiz|test me|flash ?cards?|study guide|cheat sheet|practice (test|problems|questions|exam)|remind|timer|alarm|open|go to|take me|switch to|show me|search|look up|find|define|synonym|antonym|rhym\w*|translate|save|note|make|create|generate|build|write me|start|set|scan|check|trace|identify|crack|pentest|penetration test|artex|spreadsheet|excel|powerpoint|slide ?deck|slides|presentation|word doc(ument)?|pdf|budget|checklist|binder|prepare|preparedness|emergency (card|plan|kit)|supplies|outage|blackout|go.?bag|frequenc(y|ies)|remember|forget|photos?|pictures?|e-?mail|draft)\b/i;

  const START = /^\s*(?:(?:hey|ok|okay|so|please|kindly|moundshroud)[,\s]+)*(?:(?:can|could|would|will) you (?:please )?|i(?:'d| would)? (?:like|want|need) (?:you )?to |let'?s |go ahead and )?(make|create|generate|build|write|draft|compose|set|start|begin|open|go to|take me|switch|show|search|find|look up|define|save|translate|remind|quiz|test|add|turn|lock|mute|unmute|give me|prepare|plan|schedule|convert|print|export|stock|download|run|scan|check|trace|crack|list)\b/i;
  const num = (v, d, lo, hi) => { v = parseInt(v, 10); return isNaN(v) ? d : Math.max(lo, Math.min(hi, v)); };
  const asObj = a => { if (typeof a === 'string') { try { return JSON.parse(a); } catch (e) { return {}; } } return a || {}; };
  function material(a, label) {
    const src = a.source || 'topic', title = String(a.topic || label || 'Quiz').slice(0, 60);
    if (src === 'last_answer') { const t = A.chat.lastExplanation(); if (t.length < 60) throw new Error('there is no earlier answer to use yet'); return { title, text: t }; }
    if (src === 'attached_file') { const t = A.chat.attachments().map(x => x.text).filter(Boolean).join('\n\n'); if (t.length < 60) throw new Error('there is no attached file with text'); return { title, text: t.slice(0, 40000) }; }
    if (!a.topic) throw new Error('I need a topic'); return { title, topic: String(a.topic), text: '' };
  }
  async function flashcards(a) {
    const s = material(a), n = num(a.count, 10, 6, 20);
    const prompt = 'Create ' + n + ' flashcards ' + (s.text ? 'from the text below.\n\nTEXT:\n' + s.text.slice(0, 9000) : 'about: ' + s.topic + '. Use accurate, well-established facts.') + '\n\nReply with ONLY JSON: {"cards":[{"q":"short question or term","a":"short clear answer"}]}';
    const r = await fetch('/api/chat', { method: 'POST', body: JSON.stringify({ model: $('model').value, stream: false, think: false, keep_alive: '3m', format: 'json', messages: [{ role: 'user', content: prompt }] }) });
    const j = await r.json(); let arr = []; try { const v = JSON.parse((j.message && j.message.content) || '{}'); arr = Array.isArray(v) ? v : (v.cards || v.flashcards || Object.values(v).find(Array.isArray) || []); } catch (e) {}
    arr = arr.filter(c => c && c.q && c.a).slice(0, 25); if (!arr.length) throw new Error('the flashcards did not come out - try again');
    await A.study.addCards(s.title, arr); A.showTab('study'); A.study.home(); return arr.length;
  }

  const RUN = {
    make_image(a) {
      if (!window.AIArt || !A.studio) throw new Error('AI Art is unavailable');
      const shape = a.shape === 'wide' ? '768x512' : a.shape === 'tall' ? '512x768' : '512x512';
      AIArt.pending = { mode: 'make', prompt: a.description, shape, go: true };
      A.studio.go('art');
      return 'Drawing it in Studio › AI Art.';
    },
    make_quiz(a) { const s = material(a); A.quiz.auto(s, { count: num(a.count, 10, 3, 20), level: a.difficulty, types: a.types }).catch(e => A.toast(e.message, 4000)); return 'Making ' + (a.difficulty === 'easy' ? 'an easy' : a.difficulty === 'hard' ? 'a hard' : 'a medium') + ' quiz on **' + s.title + '** - it opens in Study in a few seconds.'; },
    make_study_guide(a) { const s = material(a); A.quiz.guide(s, a.style).catch(e => A.toast(e.message, 4000)); return 'Writing a ' + (a.style || 'study guide').toLowerCase() + ' on **' + s.title + '** in the Study tab.'; },
    async make_flashcards(a) { const n = await flashcards(a); return 'Made **' + n + ' flashcards** in a deck called "' + String(a.topic).slice(0, 60) + '". They are in the Study tab.'; },
    open_section(a) {
      if (a.section === 'first_aid') { A.prep.open('aid'); return 'Opened **first aid**.'; }
      /* the places that live inside a tab */
      const nice = String(a.section).replace(/_/g, ' ');
      if (a.section === 'stock_up') { A.prep.open('stock'); return 'Opened **Prepare › Stock up**.'; }
      if (a.section === 'settings' || a.section === 'privacy') { A.settings.open(a.section === 'privacy' ? 'privacy' : (a.tool && ['appearance', 'voice', 'ai', 'privacy', 'data', 'keys'].includes(a.tool) ? a.tool : undefined)); return 'Opened **Settings' + (a.section === 'privacy' ? ' › Privacy' : '') + '**.'; }
      if (a.section === 'meeting_notes') { A.tools.go('meet'); return 'Opened **Office › Meeting notes**.'; }
      if (a.section === 'markets' || a.section === 'news_research') { A.showTab('news'); setTimeout(() => { const b = document.querySelector('#p-news [data-a="' + (a.section === 'markets' ? 'markets' : 'research') + '"]'); if (b) b.click(); }, 120); return 'Opened **News › ' + (a.section === 'markets' ? 'Markets' : 'Research') + '**.'; }
      if (a.section === 'passwords' || a.section === 'password_vault') { A.tools.go('vault'); return 'Opened **Cyber › Passwords**.'; }
      /* sections that live inside a tab (the October 2026 layout) */
      if (a.section === 'timeline') { A.library.timeline(); return 'Opened **Office › Library › Timeline**.'; }
      if (a.section === 'translate') { A.lang.translate(); return 'Opened **Education › Languages › Translate**.'; }
      if (a.section === 'prompts') { A.prep.open('prm'); return 'Opened **Prepare › Prompts**.'; }
      if (a.section === 'puzzle_maker') { A.play.open('puzz'); return 'Opened **Entertainment › Games › Puzzle maker**.'; }
      if (a.section === 'cyber_games') { A.cybertab.go('games'); return 'Opened **Cyber › Cyber games**.'; }
      if (a.section === 'tor') { A.showTab('web'); return 'Opened the **Browser**: press **🧅 Tor** at the top to open Tor Browser.'; }
      const t = tabs[a.section]; if (!t) throw new Error('unknown section'); if (t === 'tools' && subs[a.tool]) A.tools.go(subs[a.tool]); else A.showTab(t); return 'Opened **' + String(a.section).replace(/_/g, ' ') + (t === 'tools' && subs[a.tool] ? ' > ' + a.tool : '') + '**.';
    },
    search_library(a) { A.lib.search(String(a.query), cats[a.library]); return 'Searching the library for **' + a.query + '**.'; },
    search_my_files(a) { A.files.search(String(a.query)); return 'Searching your files and notes for **' + a.query + '**.'; },
    define_word(a) { A.lib.define(String(a.word).trim().split(/\s+/)[0]); return 'Looking up **' + a.word + '**.'; },
    show_rhymes(a) { A.rhyme.open(String(a.word).trim().split(/\s+/)[0]); return 'Opening the rhymer for **' + a.word + '**.'; },
    show_synonyms(a) { A.thes.open(String(a.word).trim().split(/\s+/)[0]); return 'Opening the thesaurus for **' + a.word + '**.'; },
    async set_reminder(a) {
      const p = A.remind.parse('remind me to ' + String(a.what) + ' ' + String(a.when)); if (!p) throw new Error('I could not understand the time "' + a.when + '"');
      await A.api('/api/reminders', { text: p.text, at: p.at, rule: p.rule }); A.emit('reminders'); return 'Reminder set: **' + p.text + '** ' + (p.rule ? A.remind.describe(p.rule) : A.remind.when(p.at)) + '.';
    },
    async save_note(a) { await A.notes.create(String(a.title).slice(0, 60), String(a.content)); return 'Saved the note **' + String(a.title).slice(0, 60) + '**.'; },
    translate_text(a) {
      A.tools.go('trans'); setTimeout(() => { if (!$('tin')) return; $('tin').value = String(a.text); const want = [...$('tto').options].find(o => o.value.toLowerCase().startsWith(String(a.language).toLowerCase())); if (want) $('tto').value = want.value; $('tgo').click(); }, 400);
      return 'Translating into **' + a.language + '** in Tools.';
    },
    create_document(a) {
      const k = { word: 'word', spreadsheet: 'sheet', presentation: 'slides', pdf: 'pdf' }[a.kind] || 'word'; if (!a.request) throw new Error('I need to know what the document should contain');
      A.docs.create(k, String(a.request), a.use_last_answer === true || a.use_last_answer === 'true'); return 'Creating your ' + ({ word: 'Word document', sheet: 'spreadsheet', slides: 'presentation', pdf: 'PDF' })[k] + ' - watch the Office > Documents page; it takes about a minute.';
    },
    open_prepare(a) { const id = a.page === 'first_aid' ? 'aid' : a.page; A.prep.open(id); return 'Opened **Prepare > ' + String(a.page).replace(/_/g, ' ') + '**.'; },
    make_emergency_binder() { A.prep.open('binder'); setTimeout(() => { const x = $('bpdf'); if (x) x.click(); }, 700); return 'Building your emergency binder in Prepare > Binder. It takes about 30 seconds.'; },
    start_voice_mode() { setTimeout(() => A.vm.start(), 300); return 'Starting voice mode.'; },
    remember_fact(a) { if (!A.memory) throw new Error('memory is not loaded'); const f = A.memory.add(a.fact); return f ? 'Remembered: “' + f.t + '”. (Ctrl+K › What the AI remembers shows and deletes these.)' : 'I already remember that.'; },
    forget_fact(a) { if (!A.memory) throw new Error('memory is not loaded'); const g = A.memory.forget(a.about); return g.length ? 'Forgot: ' + g.map(f => '“' + f.t + '”').join(', ') + '.' : 'I had nothing remembered about that.'; },
    search_photos(a) { if (!A.photos) throw new Error('Photos is not loaded'); A.photos.search(String(a.query || '')); return 'Showing photos matching **' + String(a.query || '') + '** in Photos. (Search finds what is in a photo once the AI has described it: Photos › ✨ Describe my photos.)'; },
    draft_email(a) { if (!A.mail) throw new Error('Mail is not loaded'); A.mail.compose({ to: a.to || '', subject: a.subject || '', body: String(a.body || '') }); return 'Opened the draft in **Mail**. Check it, then save it to your Drafts; Moundshroud never sends email itself.'; },
    async security_tool(a) {
      if (!A.cyberTools) throw new Error('the Cyber Toolkit is not loaded');
      const tool = String(a.tool || '').trim();
      const args = { host: a.host || '', url: a.url || '', ports: a.ports || 'top', hash: a.hash || '', text: a.text == null ? '' : a.text, words: a.words || '' };
      const r = await A.cyberTools.run(tool, args); if (!r) throw new Error('no answer');
      if (r.error && !(tool === 'whois' && r.facts)) return 'The ' + tool + ' tool: ' + r.error;
      A.cyberTools.open(tool);        // also show it on the Cyber > Toolkit page
      const trim = o => JSON.stringify(o, (k, v) => typeof v === 'string' && v.length > 300 ? v.slice(0, 300) : v).slice(0, 2400);
      const head = { dns: 'DNS records for ' + args.host, ipinfo: 'IP info for ' + args.host, reverse: 'Reverse DNS for ' + args.host, whois: 'WHOIS for ' + args.host, subdomains: 'Subdomains of ' + args.host, portscan: 'Open ports on ' + args.host, tlscert: 'Certificate for ' + args.host, headers: 'Security headers for ' + args.url, fingerprint: 'What ' + args.url + ' is built with', traceroute: 'Route to ' + args.host, mynetwork: 'This PC\'s local network', wifi: 'Wi-Fi networks nearby', hashid: 'Hash identification', hashcrack: 'Hash crack attempt', hashmake: 'Hashes of the text' }[tool] || tool;
      return '[Showing it on Cyber › Toolkit.] ' + head + ':\n' + trim(r) + '\n\nTell the user what this means in plain words.';
    },
    async artex(a) {
      const act = String((a && a.action) || 'open');
      let st; try { st = act === 'status' ? await A.api('/api/artex/status') : await A.api('/api/artex/start', {}); } catch (e) { throw new Error('ARTEX could not be reached: ' + e.message); }
      if (act !== 'status') { try { A.artex && A.artex.open(); } catch (e) { } }
      if (st && st.up) return 'ARTEX is running at ' + st.url + ', using ' + st.model + ', open in Cyber › ARTEX. Tell the user to enter a target they own or are authorised to test, then start a task. ' + (st.setupToken ? 'First run: open Setup inside ARTEX and enter token ' + st.setupToken + ' to set a password.' : '');
      return 'ARTEX is starting (its database and server are coming up) and opening in Cyber › ARTEX. Tell the user it is ready in a few seconds, then they enter a target they own or are authorised to test.';
    },
    async read_app_code(a) {
      if (!window.AppCtx) throw new Error('the map of the app is not loaded yet');
      if (a.file) { const f = await AppCtx.read(String(a.file).trim(), 12000); if (!f) throw new Error('there is no file called ' + a.file + ' in the app'); return 'From ' + f.path + ':\n' + f.text.slice(0, 7000); }
      const q = String(a.query || '').trim(); if (!q) throw new Error('I need something to look for');
      const c = await AppCtx.context(q); if (!c) return 'Nothing in the app\'s own files matches "' + q + '".';
      return 'Matches in Moundshroud\'s own source:\n' + c.slice(0, 7000);
    }
  };

  A.actions = {
    schema, get hint() { return hint0 + refSheet(); },
    /* only messages that read like a request ("make me...", "open...", "remind me...") get the tools, so ordinary questions and talk about your files are never mistaken for commands */
    looksActionable: t => {
      if (t.length > 300) return false; const s = t.trim();
      if (/\b(where (is|are|do|does|can|would)|how (do|can) i (open|find|get to|turn|switch|change|set|use|make|add|remove|delete|download|back ?up|print|save|see|read|record|start|stop)|take me to|bring me to|go to|open (the|my)|show me (the|where|how)|navigate|find the .{1,30}(tab|page|section|setting|button)|which (tab|page|setting))\b/i.test(s)) return true;
      if (/^\s*(please\s+|hey\s+)?(remember|don'?t forget|forget|stop remembering)\b/i.test(s) && !/\?\s*$/.test(s)) return true;
      if (/\b(quiz me|test me|remind me|flash ?cards? (for|on|about)|study guide (for|on|about)|make (me )?(a |an |some |my )?(quiz|flash ?cards?|study guide|cheat sheet|binder|spreadsheet|presentation|slide ?deck))/i.test(s)) return true;
      /* a question about the app itself comes first: it may be phrased "how does ... work?" and still be a request to look
         inside Moundshroud (read_app_code), not a general knowledge question */
      if (window.AppCtx && AppCtx.about(s) && /\b(where|how|which|what|does|do|code|file|implemented|come from|bug|broken|fix|change|work)\b/i.test(s)) return true;
      if (/^(what|why|how|who|when|where|is|are|does|do|did|was|were|can i|tell me|explain|describe|using|based on|according to|from my|in my)\b/i.test(s)) return false;
      return START.test(s) && ACT.test(s);
    },
    async run(name, args) {
      const f = RUN[name]; if (!f) throw new Error('unknown action ' + name); args = asObj(args);
      const sc = schema.find(x => x.function.name === name); /* small models sometimes leave a required field out: say so instead of acting on "undefined" */
      for (const k of (sc ? sc.function.parameters.required : [])) if (args[k] == null || (typeof args[k] === 'string' && !args[k].trim())) throw new Error('I need the ' + k.replace(/_/g, ' '));
      return await f(args);
    }
  };
})();

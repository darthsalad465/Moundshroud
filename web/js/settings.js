// The Settings page (gear icon, top right): one searchable page with a section list on the left. Appearance, Voice and sound (pick any installed voice, preview it, speed, pitch,
// volume), your buddy, AI and power, Chess, Games and cards, Walkthroughs and help, Backup and data, and keyboard shortcuts. Replaces the old small dialog.
(() => {
  const esc = s => String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  let root = null;
  const close = () => { if (root) { try { A.speech.stop(); } catch (e) { } root.remove(); root = null; document.removeEventListener('keydown', onKey, true); } };
  const onKey = e => { if (e.key === 'Escape' && root) { e.stopPropagation(); close(); } };
  const bool = (k, d) => ls.get(k, d ? '1' : '0') !== '0';
  const SECS = [['appearance', '🎨', 'Appearance'], ['voice', '🔊', 'Voice & sound'], ['buddy', '🦉', 'Your buddy'], ['persona', '🎭', 'Personality'], ['ai', '🧠', 'AI & power'], ['privacy', '🔒', 'Privacy'], ['phone', '📱', 'Phone access'], ['chess', '♟', 'Chess'], ['games', '🎮', 'Games & cards'], ['help', '🧭', 'Walkthroughs & help'], ['data', '💾', 'Backup & data'], ['keys', '⌨', 'Shortcuts & about']];
  /* the same list the shortcut sheet is built from, so the two can never disagree */
  const keySheet = () => (A.keys && A.keys.help) ? A.keys.help() : A.settings.open('keys');
  const row = (label, desc, ctl, kw) => '<div class="sxrow" data-k="' + esc((label + ' ' + desc + ' ' + (kw || '')).toLowerCase()) + '" style="display:flex;gap:14px;align-items:center;padding:12px 16px;border-bottom:1px solid var(--line)"><div style="flex:1;min-width:0"><b>' + label + '</b>' + (desc ? '<div class="small mute" style="margin-top:3px;line-height:1.45">' + desc + '</div>' : '') + '</div><div style="flex:none;max-width:56%;display:flex;gap:8px;align-items:center;flex-wrap:wrap;justify-content:flex-end">' + ctl + '</div></div>';
  const tog = (id, on) => '<label class="chk" style="margin:0;gap:7px"><input type="checkbox" data-t="' + id + '"' + (on ? ' checked' : '') + '> <span class="small mute">' + (on ? 'On' : 'Off') + '</span></label>';
  /* ready-made personalities for the main Chat assistant; each fills the box, which the user can then edit */
  const PRESETS = [
    ['Helpful & concise', 'Be clear, accurate and concise. Lead with the answer, then the detail.'],
    ['Warm & encouraging', 'Be warm, friendly and encouraging. Explain gently, in plain words, and cheer me on.'],
    ['Formal & scholarly', 'Write formally and precisely, like a careful scholar. Define terms and show your reasoning.'],
    ['Playful & witty', 'Be playful and witty. Keep it light, with the odd joke, while still being genuinely useful.'],
    ['Socratic tutor', 'Act as a patient tutor. Ask guiding questions and lead me to the answer instead of just giving it.'],
    ['Blunt & direct', 'Be blunt and direct. Skip the pleasantries, and tell me plainly, even the hard truths.'],
  ];
  const sec = (id, icon, title, body) => '<section data-sec="' + id + '" style="margin-bottom:26px"><div class="sx-sec-hd"><span class="sx-sec-ic">' + icon + '</span><h2 style="margin:0;font-size:18px">' + title + '</h2></div><div class="sx-group">' + body + '</div></section>';
  const openChessTab = async t => { close(); A.showTab('play'); const w = ms => new Promise(r => setTimeout(r, ms)); await w(450); const sub = document.querySelector('#plsub [data-s=arcade]'); if (sub) sub.click(); await w(300); const c = document.querySelector('#p-play [data-g=chess]'); if (c) { c.click(); await w(900); } try { ChessUI.show(t); } catch (e) { } };

  /* voices: work out male/female and the accent from the voice's name and language, so the picker can filter */
  const FEM = /\b(zira|hazel|susan|linda|heather|catherine|sonia|jenny|aria|ana|emma|michelle|libby|natasha|neerja|clara|mia|heera|jessa|samantha|karen|moira|tessa|victoria|fiona|female)\b/i, MAL = /\b(david|mark|george|richard|james|ryan|guy|brian|christopher|eric|roger|steffan|davis|andrew|liam|prabhat|rishi|sean|thomas|alfie|connor|william|ravi|hemant|male)\b/i;
  const vgender = v => /female/i.test(v.name) ? 'f' : FEM.test(v.name) ? 'f' : MAL.test(v.name) ? 'm' : '';
  const ACC = { 'en-US': 'American', 'en-GB': 'British', 'en-AU': 'Australian', 'en-IN': 'Indian', 'en-CA': 'Canadian', 'en-IE': 'Irish', 'en-ZA': 'South African', 'en-NZ': 'New Zealand', 'en-SG': 'Singapore', 'en-HK': 'Hong Kong', 'en-NG': 'Nigerian', 'en-KE': 'Kenyan', 'en-PH': 'Philippine', 'en-TZ': 'Tanzanian', 'en-GH': 'Ghanaian' };
  const vacc = v => { const l = String(v.lang || '').replace('_', '-'); if (ACC[l]) return 'English: ' + ACC[l]; try { const p = l.split('-'), ln = new Intl.DisplayNames(['en'], { type: 'language' }).of(p[0]), rg = p[1] ? new Intl.DisplayNames(['en'], { type: 'region' }).of(p[1]) : ''; return ln + (rg ? ': ' + rg : ''); } catch (e) { return l || 'Other'; } };
  const accSort = (a, b) => (/^English/.test(b) ? 1 : 0) - (/^English/.test(a) ? 1 : 0) || a.localeCompare(b);
  const vOpts = (voices, want, g, a) => { const by = {}; voices.filter(v => (!A.speech || !A.speech.okVoice || A.speech.okVoice(v)) && (!g || vgender(v) === g) && (!a || vacc(v) === a)).forEach(v => { (by[vacc(v)] = by[vacc(v)] || []).push(v); }); return Object.keys(by).sort(accSort).map(k => '<optgroup label="' + esc(k) + '">' + by[k].map(v => { const gg = vgender(v); return '<option value="' + esc(v.name) + '"' + (want === v.name ? ' selected' : '') + '>' + (gg === 'f' ? '♀ ' : gg === 'm' ? '♂ ' : '') + esc(v.name.replace(/^Microsoft /, '').replace(/ (Online )?(\(Natural\) )?- .*$/, '')) + (v.localService ? '' : ' (online)') + '</option>'; }).join('') + '</optgroup>').join(''); };
  const VSTYLES = [['Deep', 0.6, 0.9], ['Warm', 0.85, 0.95], ['Natural', 1, 1], ['Bright', 1.25, 1.05], ['High', 1.5, 1.1], ['Slow and clear', 1, 0.75], ['Fast', 1, 1.4]];
  function build() {
    const TH = window.OA_THEMES, cur = TH ? TH.get() : '', curStyle = TH && TH.getStyle ? TH.getStyle() : 'modern', voices = (A.speech && A.speech.natural ? A.speech.natural : []).concat('speechSynthesis' in window ? speechSynthesis.getVoices() : []), want = ls.get('voice', '');
    const vopts = vOpts(voices, want, '', ''), accs = Array.from(new Set(voices.map(vacc))).sort(accSort);
    const buddies = A.companion && A.companion.buddies ? A.companion.buddies() : [], bcur = A.companion && A.companion.current ? A.companion.current() : 0;
    let h = '';
    let isAuthor = false;
    fetch('/api/is-author').then(r => r.json()).then(j => { isAuthor = j.author; }).catch(() => {});
    h += sec('appearance', '🎨', 'Appearance', row('New look: sidebar and drawn icons', 'Pages are listed in a sidebar at the left, with one drawn icon each, and the page sits on a rounded sheet. Turn this off to get the row of tabs across the top back. It applies to the Modern interface style; the other styles keep their own layout.', tog('shroud', ls.get('shroud', '1') !== '0'), 'new look sidebar rail icons classic tabs top bar layout shroud') + row('Gliding tabs in the classic look', 'Only used while the new look above is off: the gliding tab marker and a different look for each area. Turn this off if anything seems wrong with the top bar. (Add ?classic to the address to force it from outside.)', tog('nopro', ls.get('nopro', '0') !== '1'), 'classic polish top bar tabs look modern') + row('Group pages into menus', 'Fold related pages into four menus (Office, Education, Personal, Entertainment) so the list is shorter. Turn off to see every page in one list.', tog('navgroups', ls.get('navgroups', '1') !== '0'), 'tabs menus group top bar sidebar nav office education personal entertainment') + row('Alphabetical order', 'Show catalogues and contents (the Guide, games, books, openings, languages, library categories) in A to Z order. Takes effect the next time you reload Moundshroud.', tog('alpha', ls.get('alpha', '1') !== '0'), 'alphabetical order sort az contents') + row('Customize everything', 'Fonts, text size, spacing, corners, accent colour, contrast, animation and more.', '<button class="pri" data-a="cust">Open customizer</button>', 'font zoom size spacing corners accent contrast') +
      row('Motion', 'How much Moundshroud moves: the cross-fade between pages, the lift when you hover a card, the loading bar and the small touches on buttons. <b>Subtle</b> keeps everything but calmer, and is what Windows asks for when you have animations turned off. <b>Off</b> leaves the app perfectly still - nothing moves, but colours and highlights still tell you what is happening.', '<div id="smot" style="display:flex;gap:6px"></div><button class="ib" data-a="replayboot" title="Watch the Moundshroud opening sequence again">✨ Replay intro</button>', 'motion animation transition speed reduced movement accessibility still smooth intro boot splash') +
      (TH && TH.styles ? '<div class="sxrow" data-k="interface style shape animation" style="display:block"><div style="padding:2px 0 8px"><b>Interface style</b> <span class="small mute">how the app is shaped and animated</span></div><div id="sst" style="display:grid;grid-template-columns:repeat(auto-fill,minmax(160px,1fr));gap:10px;margin-bottom:4px">' + TH.styles.map(s => '<button class="stl' + (s.id === curStyle ? ' on' : '') + '" data-s="' + s.id + '" title="' + esc(s.note) + '" style="text-align:left;padding:10px 12px;border-radius:12px;border:2px solid ' + (s.id === curStyle ? 'var(--acc)' : 'var(--line)') + ';background:var(--panel2);color:var(--text)"><div class="row" style="justify-content:space-between;margin-bottom:4px"><span style="font-size:20px;line-height:1">' + esc(s.icon) + '</span><span class="small" style="color:var(--acc);font-weight:700">' + (s.id === curStyle ? '✓' : '') + '</span></div><b style="font-size:13.5px;display:block">' + esc(s.name) + '</b><span class="small mute" style="display:block;font-size:11.5px;line-height:1.35;margin-top:2px">' + esc(s.note) + '</span></button>').join('') + '</div></div>' : '') +
      (TH ? '<div class="sxrow" data-k="colours colors theme dark light" style="display:block"><div style="padding:2px 0 8px"><b>Colours</b> <span class="small mute">instant theme palette across all pages</span></div><div id="sth" style="display:grid;grid-template-columns:repeat(auto-fill,minmax(132px,1fr));gap:10px">' + TH.list.map(t => '<button class="thm' + (t.id === cur ? ' on' : '') + '" data-t2="' + t.id + '" title="' + esc(t.note) + '" style="text-align:left;padding:9px 10px;border-radius:12px;border:2px solid ' + (t.id === cur ? 'var(--acc)' : 'var(--line)') + ';background:var(--panel2);color:var(--text)"><span style="display:flex;height:32px;border-radius:8px;overflow:hidden;margin-bottom:6px;border:1px solid rgba(255,255,255,.08)"><i style="flex:2;background:' + t.sw[0] + '"></i><i style="flex:1;background:' + t.sw[1] + '"></i><i style="flex:1;background:' + t.sw[2] + '"></i></span><div class="row" style="justify-content:space-between;gap:4px"><b style="font-size:12.5px">' + esc(t.name) + '</b><span class="small mute" style="font-size:10.5px">' + (t.dark ? 'Dark' : 'Light') + '</span></div></button>').join('') + '</div></div>' : ''));
    h += sec('voice', '🔊', 'Voice & sound',
      row('Voice type', 'Pick male or female and an accent, and the list below shows only matching voices. A voice marked ♀ is female and ♂ is male.', '<select id="vg"><option value="">Male and female</option><option value="m">♂ Male</option><option value="f">♀ Female</option></select><select id="va" style="max-width:200px"><option value="">Any accent or language</option>' + accs.map(a => '<option>' + esc(a) + '</option>').join('') + '</select>', 'voice male female man woman accent british american australian indian irish gender') +
      row('Read-aloud voice', 'Used everywhere Moundshroud speaks: chat answers, voice mode, your buddy, lessons. ' + voices.length + ' installed voices (<span id="vcnt">' + voices.length + '</span> shown). Windows only lists the voices installed on this PC. To get more accents, open Windows Settings, Time &amp; language, Speech, then Add voices, and download English (United Kingdom), Australia, India and so on. They work offline once downloaded.', '<select id="sv" style="max-width:260px"><option value="">Automatic (best English voice)</option>' + vopts + '</select><button class="pri" data-a="vtest">▶ Preview</button>', 'voice speech tts read aloud language') +
      row('Voice sound', 'One click to change how the voice sounds: lower and deeper, brighter and higher, slower or faster. It changes the pitch and speed sliders below.', VSTYLES.map(s => '<button class="chip" data-vs="' + s[0] + '">' + s[0] + '</button>').join(''), 'voice style deep high pitch fast slow sound') +
      row('Speaking speed', 'Slower for learning, faster for skimming.', '<input type="range" id="sr2" min="0.5" max="2" step="0.1" value="' + ls.get('rate', '1') + '" style="width:160px"><span class="small mute" id="srv" style="min-width:34px;text-align:right">' + ls.get('rate', '1') + '×</span>', 'rate speed') +
      row('Pitch', 'Makes the voice lower or higher.', '<input type="range" id="spi" min="0.5" max="1.6" step="0.1" value="' + ls.get('pitch', '1') + '" style="width:160px"><span class="small mute" id="spv" style="min-width:34px;text-align:right">' + ls.get('pitch', '1') + '</span>', 'pitch') +
      row('Voice volume', 'Loudness of the spoken voice.', '<input type="range" id="svo" min="0.1" max="1" step="0.05" value="' + ls.get('svol', '1') + '" style="width:160px">', 'volume loud') +
      row('Game sound effects', 'Clicks, captures, coins and the rest.', tog('sfx', A.sfx ? A.sfx.on : true) + (A.sfx ? '<input type="range" id="sfv" min="0" max="1" step="0.05" value="' + A.sfx.vol + '" style="width:120px">' : ''), 'sfx effects sounds') +
      row('Music', 'Theme music in games and the Music tab volume.', tog('mus', A.music ? A.music.on : true) + (A.music ? '<input type="range" id="muv" min="0" max="1" step="0.05" value="' + A.music.vol + '" style="width:120px">' : ''), 'music theme songs volume') +
      row('Sound test', 'Hear a sample of every game sound.', '<button class="ib" data-a="sounds">Open Sounds</button>', 'sounds'));
    h += sec('buddy', '🦉', 'Your buddy',
      row('Show the buddy', 'The animated companion in the bottom-left corner. Click it to chat, drag it anywhere, or tell it what to do.', tog('bshow', A.companion ? A.companion.isOn() : true), 'companion pet hide show') +
      row('Free roaming', 'Let your buddy physically walk around the screen, perch on cards, and explore when idle.', tog('broam', A.companion ? A.companion.roaming : true), 'companion roam walk move around explore') +
      '<div class="sxrow" data-k="choose buddy pet owl fox octopus robot dragon sloth penguin cat hoot fenn inky bolt ember sloane pip miso" style="display:block"><div style="padding:2px 0 8px"><b>Choose your buddy</b> <span class="small mute">bespoke articulated companions</span></div><div id="sbd" style="display:grid;grid-template-columns:repeat(auto-fill,minmax(130px,1fr));gap:10px;margin-bottom:4px">' + buddies.map(b => '<button class="ib' + (b.i === bcur ? ' on' : '') + '" data-b="' + b.i + '" style="display:flex;align-items:center;gap:10px;padding:8px 11px;border-radius:12px;text-align:left;height:auto" title="' + esc(b.n + (b.role ? ' — ' + b.role : '')) + '"><span style="width:36px;height:36px;flex:none;display:inline-flex;align-items:center;justify-content:center">' + (window.PetAnim ? PetAnim.html(b.e) : b.e) + '</span><span style="min-width:0;line-height:1.25"><b style="display:block;font-size:13px">' + esc(b.n) + '</b><span class="small mute" style="display:block;font-size:11px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">' + esc(b.role || 'Companion') + '</span></span></button>').join('') + '</div></div>' +
      row('Read the buddy\'s answers aloud', 'Uses the voice chosen above.', tog('bspeak', bool('buddy_speak', false)), 'buddy speak aloud') +
      row('Talk to your buddy', 'Open its interactive HUD now, or ask it to do a trick.', '<button class="pri" data-a="buddychat">Open chat</button><button class="ib" data-a="buddytrick">✨ Do a trick</button>', 'chat trick flip dance') +
      row('Characters remember you', 'Chess opponents, poker players, legends, coaches, friends and your buddy remember what you tell them and what you do together, in every game. See who knows you, or make them forget.', '<button class="ib" data-a="chars">Who remembers me</button><button class="ib dang" data-a="forgetchars">Forget all</button>', 'memory characters remember forget privacy') +
      row('Wake word: “Hey Moundshroud”', 'Say “Hey Moundshroud” to open voice mode, even when the window is closed. The tray helper listens with the speech recognizer built into Windows, which runs offline: nothing you say leaves this PC, and it only listens for the wake phrase. Off by default. You can also switch it from the tray icon menu. If it wakes by mistake, or not at all, speak the phrase clearly; Windows may need microphone access for desktop apps (Windows Settings › Privacy › Microphone).', '<button class="ib" data-a="wake" id="swake">Checking…</button><span class="small mute" id="swakest"></span>', 'wake word hey moundshroud voice microphone listen hands free hotword') +
      row('Characters speak aloud', 'Every character has their own voice (boy, girl, older, young, robot). Animals make their animal noise first. You can also talk to opponents with the microphone button in the chess opponent panel.', '<button class="ib" data-a="cvox">' + (A.cvoice && A.cvoice.auto ? 'On' : 'Off') + '</button>', 'voice speak aloud characters animals robot') +
      row('Communities', 'The Chess Community (chess tab) keeps chatting whether or not you are there. Turn the AI model off for chatter to use quick built-in lines instead (lighter on the PC).', '<button class="ib" data-a="ccai">AI chatter: ' + (ls.get('cmai', '1') !== '0' ? 'On' : 'Off') + '</button>' + ' <button class="ib" data-a="cnote">Message alerts: ' + (ls.get('cmnote', '1') !== '0' ? 'On' : 'Off') + '</button>', 'community chat chatter ai town hollow creek') +
      row('Back up characters', 'Save or restore everything the characters remember, the communities and the voices you set. (The AI Commons chats are meant to disappear, so they are not included.)', '<button class="ib" data-a="cbak">Export</button><button class="ib" data-a="cimp">Import</button>', 'backup export import restore characters memory community'));
    h += sec('ai', '🧠', 'AI & power',
      row('Low-power mode', 'A smaller AI model, no animations and shorter model memory. Good on battery.', tog('lp', A.power && A.power.on), 'battery power small model') +
      row('Agent harness', 'The program that drives the AI in Chat › Agent. <b>Claude Code</b> (default) asks you before each guarded action. <b>jcode</b> is a fast open-source harness; it runs its own tools and asks only when it decides to. Both use your local models through Ollama. Switching ends the running agent session.', '<select id="hkind" class="ib"><option value="claude">Claude Code</option><option value="jcode">jcode</option></select><span class="small mute" id="hkindst"></span>', 'agent harness claude code jcode coding agent switch engine') +
      row('Delete all chat history', 'Removes every saved chat in the Chat tab.', '<button class="ib dang" data-a="clrchat">Delete chats</button>', 'chats history delete') +
      row('Opponents and players reply from the AI', 'Chess opponents, poker players, club members and friends answer with the local AI. Turn off for short canned lines.', tog('olai', bool('olai', true)), 'opponent chat ai replies') +
      row('Internet access for the assistant', 'Off by default. Switched on, the chat can search the web and read pages when you tick <b>&#127760; Web</b> under the message box, and Moundshroud shows what it read as sources you can click. Searches leave this PC from your own connection, and Moundshroud refuses to fetch anything on your own network (the router, other devices, itself).', '<label class="chk" style="margin:0;gap:7px"><input type="checkbox" id="cweb"> <span class="small mute">Allow</span></label><button class="ib" data-a="webtest">Try a search</button>', 'internet online web search look up network privacy firewall') +
      '<div class="sxrow" data-k="free frontier ai no key auto fallback unlimited model ovhcloud pollinations qwen gpt oss llama" style="display:block"><div style="flex:1;min-width:0"><b>✦ Free frontier AI (no key)</b>' +
      '<div class="small mute" style="margin-top:3px;line-height:1.48">Frontier-class models with no sign-up and no card: Moundshroud keeps several free routes and moves to the next one by itself when one hits its free limit, then to the model on this PC, so an answer always comes back. <b>Nothing free is truly unlimited</b>: the public routes allow a few requests a minute, which is plenty for ordinary use. Pick <b>✦ Free frontier · auto</b> in the model box at the top of the chat, or press the button below.</div>' +
      '<div id="frbox" class="small" style="margin-top:10px">Checking the free routes…</div></div></div>' +
      '<div class="sxrow" data-k="claude anthropic api key online ai cloud model groq openrouter gemini nim free llm" style="display:block"><div style="flex:1;min-width:0"><b>&#9729; Online AI</b>' +
      '<div class="small mute" style="margin-top:3px;line-height:1.48">Off by default. Pick a provider, add your API key, and Moundshroud will answer with that model instead of the local one. <b>Anthropic (Claude)</b> is billed by Anthropic. <b>Free LLM providers</b> (Groq, OpenRouter, Google Gemini, NVIDIA NIM, Mistral, Cohere, Cloudflare, and more) offer free tiers - no credit card needed for most. The key is kept on this PC in <code>data\\cloud.json</code>, encrypted by Windows for your account, never shown to this window.</div>' +
      '<div class="small" id="clstate" style="margin-top:10px"></div><div id="clbox" style="margin-top:10px"></div></div></div>' +
      '<div class="sxrow" data-k="no-key free api open ai cloud model glhf chutes ovhcloud" style="display:block"><div style="flex:1;min-width:0"><b>&#128274; No API Key Required</b>' +
      '<div class="small mute" style="margin-top:3px;line-height:1.48">These providers work without any signup or API key. <b>OVHcloud AI</b> is the one that answers reliably (anonymous tier, 2 requests a minute); Glhf.chat and Chutes.ai are often down or rate limited. The <b>✦ Free frontier AI</b> box above already uses whichever of these is working. Nothing leaves this PC except your prompt to the provider; no keys are stored.</div>' +
      '<div class="small" id="nkstate" style="margin-top:10px"></div><div id="nkbox" style="margin-top:10px"></div></div></div>');
    h += sec('persona', '🎭', 'Personality',
      '<div class="sxrow" data-k="personality persona character tone voice how the assistant acts thinks behaviour behavior instructions custom system prompt julius caesar book context style" style="display:block">' +
      '<div class="small mute" style="line-height:1.5;margin-bottom:10px">How the main assistant in <b>Chat</b> acts and thinks: its tone, its style, and any standing instruction you want it to keep. This is added to the start of every chat. Leave it blank for the normal helpful, concise assistant. (The Bible Expert, your buddy and the game characters keep their own personalities.)</div>' +
      '<div class="row" style="flex-wrap:wrap;gap:6px;margin-bottom:10px">' + PRESETS.map(p => '<button class="chip" data-p="' + esc(p[1]) + '" title="' + esc(p[1]) + '">' + esc(p[0]) + '</button>').join('') + '</div>' +
      '<textarea id="spersona" rows="5" spellcheck="true" placeholder="e.g. Talk like a calm, encouraging mentor and keep answers short. I am writing a fantasy novel, so when I ask about my story, stay in that world." style="width:100%;box-sizing:border-box;line-height:1.55;resize:vertical;padding:11px 14px;border-radius:12px;border:1px solid var(--line);background:var(--panel2);color:var(--text);font:inherit">' + esc(ls.get('persona', '')) + '</textarea>' +
      '<div class="row" style="gap:10px;margin-top:8px;align-items:center"><button class="ib" data-a="personareset">Clear</button><span class="small" style="color:var(--ok);font-weight:600" id="sperss"></span></div>' +
      '</div>' +
      row('What the assistant remembers about you', 'Facts the assistant has saved and adds to every chat, such as a book you are writing. Open this to read, edit or delete any of them. Deleting the book note here is how you stop it coming up.', '<button class="ib" data-a="mem">Manage memory</button>', 'memory remember facts about me julius caesar book writing forget edit delete context'));
    h += sec('phone', '📱', 'Phone access', '<div id="rmbox" data-k="phone remote mobile tailscale wifi wi-fi access pin wake on lan bios smart plug away" class="sxrow small" style="display:block">Checking…</div>');
    h += sec('privacy', '🔒', 'Privacy', '<div id="prvbox" data-k="privacy private tracking online offline voices microsoft google news internet" class="sxrow small mute" style="display:block">Checking…</div>');
    h += sec('chess', '♟', 'Chess',
      row('Board and pieces', 'Colours, piece sets, coordinates, highlights, animation and sounds.', '<button class="ib" data-a="cset">Open board settings</button>', 'board theme pieces coordinates') +
      row('Stockfish engine (default)', 'The very strong open-source engine (about 3500 Elo) plays levels 1400 and up and does deep game analysis. Off in low-power mode, where the built-in engine is used. You can also switch engines at the top of the chess tab.', tog('sfuse', bool('sf_use', true)), 'stockfish engine strong analysis') +
      row('Study in the background', 'While Moundshroud is open and you are idle, the engine builds a deep opening book and studies your games. Low priority, one thread by default.', tog('sfstudy', true) + '<button class="ib" data-a="lab">Engine Lab</button>', 'study learn book engine lab cpu') +
      row('Premoves', 'Queue moves while your opponent is thinking (Online games).', tog('olpre', bool('olpre', true)), 'premove') +
      row('Voice moves for chess', 'A voice dock appears whenever a chess board is open: say a move or describe it roughly, hear moves read aloud, play blindfold, or go hands-free. Press V to speak.', tog('cvon', ls.get('chvoice', '') ? (JSON.parse(ls.get('chvoice', '{}')).on !== 0) : true), 'voice moves chess blind blindfold speak microphone accessibility') +
      row('Chess walkthrough', 'An interactive tour of every chess feature.', '<button class="pri" data-a="walk:chess">Start</button>', 'tutorial chess learn'));
    h += sec('games', '🎮', 'Games & cards',
      row('Card size', 'For Solitaire, Blackjack and Texas Hold\'em.', '<select id="scs">' + [['1', 'Normal'], ['1.3', 'Large'], ['1.6', 'Huge']].map(o => '<option value="' + o[0] + '"' + (ls.get('card_cs', '1.3') === o[0] ? ' selected' : '') + '>' + o[1] + '</option>').join('') + '</select>', 'cards size big') +
      row('Solitaire: draw 3', 'Turn over three cards at a time.', tog('sol3', bool('sol_d3', false)), 'solitaire') +
      row('Show game tutorials automatically', 'Offer a walkthrough the first time you open each game.', tog('hauto', bool('help_auto', true)), 'tutorial help how to play') +
      row('Reset game tutorials', 'Show every game\'s walkthrough again as if new.', '<button class="ib" data-a="resethelp">Reset</button>', 'reset'));
    h += sec('help', '🧭', 'Walkthroughs & help',
      row('App tour', 'A guided, interactive walkthrough of every tab. You click the real buttons.', '<button class="pri" data-a="walk:app">Start</button>', 'tour tutorial walkthrough') +
      row('Chess in depth', 'Every chess feature: Play, Online, Daily, Clubs, Analysis, Puzzles, variants and more.', '<button class="pri" data-a="walk:chess">Start</button>', 'chess tutorial') +
      row('Community and characters tour', 'The chess Community, voices, memories and the daily digest.', '<button class="ib" data-a="walk:community">Start</button>', 'community characters voices tour walkthrough') +
      row('Settings tour', 'What is in this page.', '<button class="ib" data-a="walk:settings">Start</button>', 'settings tour') +
      row('Entertainment tour', 'The games, cards and how to play them.', '<button class="ib" data-a="walk:games">Start</button>', 'games tour') +
      row('Full presentation', 'The long, narrated presentation of every sub-page.', '<button class="ib" data-a="present">Open</button>', 'presentation') +
      row('Written guide', 'Searchable guide and what is new.', '<button class="ib" data-a="guide">Open the guide</button>', 'guide help what is new changelog'));
    h += sec('data', '💾', 'Backup & data',
      row('Back up everything', 'One zip with your notes, flashcards, chats, prompts, reminders and everything Moundshroud remembers (settings, progress, chess careers, scores, favourites, playlists). Choose where to save it, such as an external drive.', '<button class="pri" data-a="fullbak">Back up now</button>', 'backup export full everything save') +
      row('Share this app', 'Create a portable zip of the current Moundshroud version (code only, no personal data) that your friends can unzip and run. Includes the server, web UI, and all built-in features.', '<button class="ib" data-a="shareapp">Create shareable zip</button><span class="small mute" id="shareappstatus" style="margin-left:10px"></span>', 'share app export portable zip send friend') +
      (isAuthor ? row('Push to GitHub', 'Commit all changes and push to the configured Git remote (usually origin on GitHub). Shows the repo URL after pushing. Useful after the AI made edits you want to share or back up remotely.', '<button class="ib" data-a="gitpush">Push to GitHub</button><span class="small mute" id="gitpushstatus" style="margin-left:10px"></span>', 'git push github remote commit') : '') +
      row('Auto-commit changes to git', 'When an assistant finishes a turn, your changes to Moundshroud’s code are saved to git on this PC, so work is never lost. Turn it off to stop the automatic commits.', '<label class="chk" style="margin:0;gap:7px"><input type="checkbox" id="sacommit"> <span class="small mute">On</span></label>', 'auto commit git version control backup history save changes undo') +
      row('About this version', '<span id="aboutver">Moundshroud ' + A.version + ' (built ' + A.built + ')</span>. ' + (() => { const t = A.selftest && A.selftest.last(); return t ? 'Last self-test: ' + new Date(t.at).toLocaleDateString() + ', ' + t.checks + ' checks, ' + (t.bad ? t.bad + ' need attention' : 'all passed') + '.' : 'No self-test has been run yet.'; })(), '', 'about version build') +
      row('Updates', '<div id="updbox" class="small mute">Reading…</div>', '', 'update updates newer new version upgrade download install') +
      row('Run a self-test', 'Opens every tab and page in turn, and checks that the files and the local services respond. Takes about a minute. Run it after any update.', '<button class="ib" data-a="selftest">Run the test</button>', 'test check health diagnose broken errors') +
      row('Problems &amp; crash log', 'Whenever something fails, the reason is written to <code>data\\problems.log</code> on this PC (never sent anywhere) and the app keeps running instead of closing. Open it to see what happened, or copy it to send on when a page misbehaves.', '<button class="ib" data-a="problems">Show</button>', 'problems crash log error diagnose bug report') +
      row('Restore from a backup', 'Choose a full backup (or an older Moundshroud backup). Matching items are replaced; anything not in the backup is left alone.', '<button class="ib" data-a="restore">Choose a backup</button>', 'restore import') +
      row('Where is my disk space going?', 'Storage report for the app, library and models.', '<button class="ib" data-a="storage">Open</button>', 'storage disk') +
      row('Reset chess data', 'Clears your saved chess games, ratings, daily games, clubs and friends. Cannot be undone.', '<button class="ib dang" data-a="resetchess">Reset chess</button>', 'reset chess ratings clubs'));
    h += sec('keys', '⌨', 'Shortcuts & about',
      row('In the app', '<kbd>Ctrl</kbd>+<kbd>K</kbd> search and commands · <kbd>Ctrl</kbd>+<kbd>N</kbd> new chat · <kbd>Alt</kbd>+<kbd>1</kbd> to <kbd>Alt</kbd>+<kbd>9</kbd> jump to an area · <kbd>Ctrl</kbd>+<kbd>,</kbd> settings · <kbd>F1</kbd> guide · <kbd>Esc</kbd> closes or stops', '<button class="ib" data-a="keys">See the full list</button>', 'keyboard hotkeys shortcuts keys') +
      row('Anywhere in Windows', '<kbd>Ctrl+Alt+A</kbd> open Moundshroud · <kbd>Ctrl+Alt+Q</kbd> ask about selected text · <kbd>Ctrl+Alt+S</kbd> read text from the screen · <kbd>Ctrl+Alt+N</kbd> quick note · <kbd>Ctrl+Alt+V</kbd> talk · <kbd>Ctrl+Alt+E</kbd> emergency info', '', 'hotkeys windows tray') +
      row('Privacy', 'Everything runs on this PC unless you switch something on. The 🔒 Privacy section above lists exactly what can leave it. Right-click the tray icon to start Moundshroud with Windows.', '', 'privacy offline')) +
      '<div id="stghost" style="margin-top:16px"></div>' +
      '<div id="sxempty" class="nm" style="text-align:center;padding:48px 20px;color:var(--mute)"><div style="font-size:28px;margin-bottom:6px">🔎</div><b style="color:var(--text);font-size:15px">No settings match that search</b><div class="small" style="margin:4px 0 12px">Try another word like <i>theme</i>, <i>voice</i>, <i>privacy</i>, or <i>backup</i>.</div><button class="ib" id="sxempclr">Show all settings</button></div>';
    return h;
  }

  /* the wake word lives in the tray helper (Listener.cs); the server only keeps the switch (data\wake-on) and the helper's last report */
  const WAKEST = s => !s ? '' : s === 'listening' ? 'Listening for “Hey Moundshroud”.' : s === 'off' ? '' : /^error/.test(s) ? 'Could not listen: ' + s.replace(/^error:\s*/, '') : s;
  async function wakeShow(r) {
    const b = root && root.querySelector('#swake'), t = root && root.querySelector('#swakest'); if (!b) return;
    if (!r) { try { r = await A.api('/api/wake'); } catch (e) { b.textContent = 'Unavailable'; return; } }
    b.textContent = r.on ? 'On' : 'Off'; b.classList.toggle('on', !!r.on);
    if (t) t.textContent = r.on ? (WAKEST(r.status) || 'Starting… (the tray helper picks this up within a few seconds)') : '';
  }
  async function wakeSet(b) {
    let cur; try { cur = await A.api('/api/wake'); } catch (e) { return; }
    let r; try { r = await A.api('/api/wake', { on: !cur.on }); } catch (e) { A.toast('Could not change the wake word.'); return; }
    wakeShow(r); if (r.on) { A.toast('Say “Hey Moundshroud” to open voice mode.'); setTimeout(wakeShow, 5000); }
  }
  function open(sectionId) {
    close(); root = document.createElement('div'); root.id = 'setx'; root.style.cssText = 'position:fixed;inset:0;z-index:150;background:rgba(0,0,0,.6);display:flex;align-items:center;justify-content:center;padding:2vh 2vw';
    const initSec = sectionId || SECS[0][0], initLabel = (SECS.find(s => s[0] === initSec) || SECS[0])[2];
    root.innerHTML = '<style>#setx .nm{display:none!important}</style><div class="card sx-modal" style="margin:0;padding:0;width:min(1080px,100%);height:min(88vh,880px);display:flex;flex-direction:column;overflow:hidden">' +
      '<div class="sx-head"><div class="sx-brand"><div class="sx-badge"><svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M4 7h10M18 7h2M4 17h4M12 17h8M16 5v4M10 15v4"/></svg></div><div><div class="sx-title">Settings</div><div class="sx-sub" id="sxcur">' + esc(initLabel) + '</div></div></div>' +
      '<div class="sx-search"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="11" cy="11" r="7"/><path d="M16.5 16.5 21 21"/></svg><input id="sq" type="text" placeholder="Search settings (voice, theme, privacy, cards...)" autocomplete="off"><div class="sx-sqmeta"><span id="sqcnt" style="display:none"></span><button type="button" id="sqclr" title="Clear search">✕</button></div></div>' +
      '<span style="flex:1"></span><button class="pri" id="sdone">Done</button></div>' +
      '<div class="sx-main" style="display:flex;flex:1;min-height:0"><div id="snav" style="width:224px;flex:none;border-right:1px solid var(--line);padding:10px;overflow:auto">' + SECS.map((s, i) => '<button class="ib' + (s[0] === initSec ? ' on' : '') + '" data-n="' + s[0] + '" style="--i:' + i + '"><span class="sx-ic">' + s[1] + '</span><span class="sx-lbl">' + s[2] + '</span></button>').join('') + '</div><div id="sbody" style="flex:1;overflow:auto;padding:18px 24px 32px;min-width:0">' + build() + '</div></div></div>';
    document.body.appendChild(root); document.addEventListener('keydown', onKey, true); try { const g = root.querySelector('#stghost'); if (g && A.storage) A.storage.render(g); } catch (e) { }
    const $$ = s => root.querySelector(s), body = $$('#sbody'); root.onclick = e => { if (e.target === root) close(); }; $$('#sdone').onclick = close;
    const markNav = id => {
      $$('#snav').querySelectorAll('[data-n]').forEach(b => b.classList.toggle('on', b.dataset.n === id));
      const info = SECS.find(s => s[0] === id); if (info && $$('#sxcur')) $$('#sxcur').textContent = info[2];
    };
    $$('#snav').onclick = e => { const b = e.target.closest('[data-n]'); if (!b) return; $$('#sq').value = ''; filter(''); markNav(b.dataset.n); const s = body.querySelector('[data-sec=' + b.dataset.n + ']'); if (s) { body.scrollTo({ top: s.offsetTop - 12, behavior: 'smooth' }); s.classList.remove('sx-flash'); void s.offsetWidth; s.classList.add('sx-flash'); setTimeout(() => s.classList.remove('sx-flash'), 900); } };
    body.addEventListener('scroll', () => {
      if ($$('#sq').value.trim()) return;
      const top = body.scrollTop + 60; let curId = SECS[0][0];
      body.querySelectorAll('section[data-sec]').forEach(s => { if (!s.classList.contains('nm') && s.offsetTop <= top) curId = s.dataset.sec; });
      markNav(curId);
    }, { passive: true });
    const filter = q => {
      q = q.trim().toLowerCase(); let hits = 0;
      body.querySelectorAll('.sxrow').forEach(r => { const hide = !!q && !r.dataset.k.includes(q); r.classList.toggle('nm', hide); if (!hide) hits++; });
      body.querySelectorAll('section[data-sec]').forEach(s => s.classList.toggle('nm', !!q && [...s.querySelectorAll('.sxrow')].every(r => r.classList.contains('nm'))));
      if ($$('#sqcnt')) { $$('#sqcnt').style.display = q ? '' : 'none'; $$('#sqcnt').textContent = hits + (hits === 1 ? ' match' : ' matches'); }
      if ($$('#sqclr')) $$('#sqclr').style.display = q ? 'grid' : 'none';
      if ($$('#sxempty')) $$('#sxempty').classList.toggle('nm', !q || hits > 0);
    };
    $$('#sq').oninput = e => filter(e.target.value); $$('#sq').onkeydown = e => e.stopPropagation();
    if ($$('#sqclr')) $$('#sqclr').onclick = () => { $$('#sq').value = ''; filter(''); $$('#sq').focus(); };
    if ($$('#sxempclr')) $$('#sxempclr').onclick = () => { $$('#sq').value = ''; filter(''); $$('#sq').focus(); };
    const TH = window.OA_THEMES;
    wakeShow(); setTimeout(wakeShow, 6000);
    if ($$('#sst')) $$('#sst').onclick = e => { const b = e.target.closest('.stl'); if (!b) return; TH.applyStyle(b.dataset.s); $$('#sst').querySelectorAll('.stl').forEach(x => { const on = x === b; x.classList.toggle('on', on); x.style.borderColor = on ? 'var(--acc)' : 'var(--line)'; const ck = x.querySelector('.row span:last-child'); if (ck) ck.textContent = on ? '✓' : ''; }); };
    if ($$('#sth')) $$('#sth').onclick = e => { const b = e.target.closest('.thm'); if (!b) return; TH.apply(b.dataset.t2); $$('#sth').querySelectorAll('.thm').forEach(x => { const on = x === b; x.classList.toggle('on', on); x.style.borderColor = on ? 'var(--acc)' : 'var(--line)'; }); };
    if ($$('#smot') && A.motion) {
      const drawM = () => { const cur2 = A.motion.level; $$('#smot').innerHTML = [['full', 'Full'], ['subtle', 'Subtle'], ['off', 'Off']].map(x => '<button class="ib' + (cur2 === x[0] ? ' on' : '') + '" data-m="' + x[0] + '" title="' + (x[0] === 'full' ? 'everything moves' : x[0] === 'subtle' ? 'calmer, shorter' : 'nothing moves') + '">' + x[1] + '</button>').join(''); };
      drawM();
      $$('#smot').onclick = e => { const b = e.target.closest('[data-m]'); if (!b) return; A.motion.set(b.dataset.m); drawM(); A.toast('Motion: ' + b.textContent.trim(), 1800); };
      A.on('motion', drawM);
    }
    const sample = 'Hello! This is how I sound when I read to you.'; const test = () => { try { A.speech.stop(); A.speech.speak(sample); } catch (e) { } };
    const refill = () => { const voices = (A.speech && A.speech.natural ? A.speech.natural : []).concat('speechSynthesis' in window ? speechSynthesis.getVoices() : []), sel = $$('#sv'), n = voices.filter(v => (!$$('#vg').value || vgender(v) === $$('#vg').value) && (!$$('#va').value || vacc(v) === $$('#va').value)).length; sel.innerHTML = '<option value="">Automatic (best English voice)</option>' + vOpts(voices, ls.get('voice', ''), $$('#vg').value, $$('#va').value); $$('#vcnt').textContent = n; if (!n) sel.innerHTML = '<option value="">No voices match: install more in Windows (see above)</option>'; };
    $$('#vg').onchange = refill; $$('#va').onchange = refill;
    body.querySelectorAll('[data-vs]').forEach(b => { b.onclick = () => { const s = VSTYLES.find(x => x[0] === b.dataset.vs); ls.set('pitch', String(s[1])); ls.set('rate', String(s[2])); $$('#spi').value = s[1]; $$('#spv').textContent = s[1]; $$('#sr2').value = s[2]; $$('#srv').textContent = s[2] + '×'; body.querySelectorAll('[data-vs]').forEach(x => x.classList.toggle('on', x === b)); test(); }; });
    $$('#sv').onchange = e => { ls.set('voice', e.target.value); test(); }; $$('#sr2').oninput = e => { ls.set('rate', e.target.value); $$('#srv').textContent = e.target.value + '×'; }; $$('#sr2').onchange = test; $$('#spi').oninput = e => { ls.set('pitch', e.target.value); $$('#spv').textContent = e.target.value; }; $$('#spi').onchange = test; $$('#svo').onchange = e => { ls.set('svol', e.target.value); test(); };
    if ($$('#sfv')) $$('#sfv').oninput = e => { A.sfx.vol = +e.target.value; }; if ($$('#muv')) $$('#muv').oninput = e => { A.music.vol = +e.target.value; };
    $$('#scs').onchange = e => ls.set('card_cs', e.target.value);
    $$('#sbd') && ($$('#sbd').onclick = e => { const b = e.target.closest('[data-b]'); if (!b) return; A.companion.setBuddy(+b.dataset.b); $$('#sbd').querySelectorAll('[data-b]').forEach(x => x.classList.toggle('on', x === b)); });
    const T = { shroud: v => { if (A.shroud) A.shroud.set(v); }, nopro: v => { ls.set('nopro', v ? '0' : '1'); if (!(A.shroud && A.shroud.on)) document.documentElement.classList.toggle('nopro', !v); }, cvon: v => ChessVoice && ChessVoice.setEnabled(v), alpha: v => ls.set('alpha', v ? '1' : '0'), navgroups: v => { ls.set('navgroups', v ? '1' : '0'); A.buildNav(); }, sfuse: v => ls.set('sf_use', v ? '1' : '0'), sfstudy: v => fetch('/api/study/config', { method: 'POST', body: JSON.stringify({ on: v }) }).catch(() => { }), sfx: v => { A.sfx.on = v; }, mus: v => { A.music.on = v; if (!v) A.music.stop(); }, bshow: v => { v ? A.companion.show() : A.companion.hide(); }, broam: v => { if (A.companion && A.companion.setRoaming) A.companion.setRoaming(v); }, bspeak: v => ls.set('buddy_speak', v ? '1' : '0'), lp: v => A.power.toggle(v), olai: v => ls.set('olai', v ? '1' : '0'), olpre: v => ls.set('olpre', v ? '1' : '0'), sol3: v => ls.set('sol_d3', v ? '1' : '0'), hauto: v => ls.set('help_auto', v ? '1' : '0') };
    root.addEventListener('change', e => { const t = e.target.closest('[data-t]'); if (t) { const sp2 = t.parentElement && t.parentElement.querySelector('span'); if (sp2 && /^(On|Off)$/.test(sp2.textContent)) sp2.textContent = t.checked ? 'On' : 'Off'; if (T[t.dataset.t]) T[t.dataset.t](t.checked); } });
    /* the Personality box saves as you type; a preset fills it, and you can still edit it after */
    const sp = $$('#spersona'), saidSaved = () => { const n = $$('#sperss'); if (n) { n.textContent = '✓ Saved'; clearTimeout(n._t); n._t = setTimeout(() => n.textContent = '', 1600); } };
    if (sp) sp.addEventListener('input', () => { ls.set('persona', sp.value); saidSaved(); });
    body.querySelectorAll('[data-p]').forEach(bp => bp.onclick = () => { if (sp) { sp.value = bp.dataset.p; ls.set('persona', sp.value); sp.focus(); saidSaved(); } });
    /* ---- online AI (Claude + Free LLMs) and internet access ---- */
    const clState = $$('#clstate'), clBox = $$('#clbox');
    const providerLabels = {
      'anthropic': 'Anthropic (Claude)',
      'groq': 'Groq (Llama, Qwen, Whisper)',
      'nvidia-nim': 'NVIDIA NIM (GLM, Kimi, Nemotron)',
      'google-gemini': 'Google Gemini',
      'openrouter': 'OpenRouter (300+ models)',
      'kilo-code': 'Kilo Code (coding optimized)',
      'mistral-ai': 'Mistral AI',
      'cohere': 'Cohere',
      'cloudflare-workers-ai': 'Cloudflare Workers AI',
      'modelscope': 'ModelScope',
      'ovhcloud-ai-endpoints': 'OVHcloud AI (EU)',
      'ollama-cloud': 'Ollama Cloud',
      'glhf-chat': 'Glhf.chat (unlimited)',
      'chutes-ai': 'Chutes.ai (DeepSeek R1)',
      'llm7-io': 'LLM7.io (GPT-OSS)',
      'z-ai-zhipu-ai': 'Z.ai (GLM)',
      'gonka-broker': 'Gonka Broker',
      'agnes-ai': 'Agnes AI',
      'aion-labs': 'Aion Labs',
      'siliconflow': 'SiliconFlow',
      'grok-(xai)': 'Grok (xAI)',
      'opencode': 'OpenCode Zen'
    };
    const noKeyProviderLabels = {
      'glhf-chat': 'Glhf.chat',
      'chutes-ai': 'Chutes.ai',
      'ovhcloud-ai-endpoints': 'OVHcloud AI (Anonymous)'
    };
    const noKeyRecommendedModels = {
      'glhf-chat': [{id:'meta-llama/Meta-Llama-3.1-70B-Instruct',name:'Llama 3.1 70B',note:'131K ctx, unlimited free, no key'},{id:'mistralai/Mixtral-8x7B-Instruct-v0.1',name:'Mixtral 8x7B',note:'32K ctx, unlimited free, no key'}],
      'chutes-ai': [{id:'deepseek-ai/DeepSeek-R1',name:'DeepSeek R1',note:'131K ctx, reasoning, no key'},{id:'meta-llama/Meta-Llama-3.1-70B-Instruct',name:'Llama 3.1 70B',note:'131K ctx, no key'}],
      'ovhcloud-ai-endpoints': [{id:'qwen3.5-397b-a17b',name:'Qwen 3.5 397B',note:'262K ctx, 2 RPM anonymous'},{id:'gpt-oss-120b',name:'GPT-OSS 120B',note:'131K ctx, 2 RPM anonymous'},{id:'meta-llama-3_3-70b-instruct',name:'Llama 3.3 70B',note:'131K ctx, 2 RPM anonymous'}]
    };
    const providerKeyUrls = {
      'anthropic': 'https://console.anthropic.com/settings/keys',
      'groq': 'https://console.groq.com/keys',
      'nvidia-nim': 'https://build.nvidia.com/settings/api-keys',
      'google-gemini': 'https://aistudio.google.com/app/apikey',
      'openrouter': 'https://openrouter.ai/workspaces/default/keys',
      'kilo-code': 'https://app.kilo.ai/profile',
      'mistral-ai': 'https://console.mistral.ai/api-keys',
      'cohere': 'https://dashboard.cohere.com/api-keys',
      'cloudflare-workers-ai': 'https://dash.cloudflare.com/profile/api-tokens',
      'modelscope': 'https://modelscope.cn/my/myaccesstoken',
      'ovhcloud-ai-endpoints': 'https://www.ovhcloud.com/en/public-cloud/ai-endpoints/catalog/',
      'ollama-cloud': 'https://ollama.com/settings/keys',
      'glhf-chat': 'https://glhf.chat/',
      'chutes-ai': 'https://chutes.ai/',
      'llm7-io': 'https://token.llm7.io',
      'z-ai-zhipu-ai': 'https://open.bigmodel.cn/usercenter/apikeys',
      'gonka-broker': 'https://app.gonkabroker.com/signup',
      'agnes-ai': 'https://platform.agnes-ai.com/settings/apiKeys',
      'aion-labs': 'https://www.aionlabs.ai/app/api-keys/',
      'siliconflow': 'https://cloud.siliconflow.cn/account/ak',
      'grok-(xai)': 'https://console.x.ai/',
      'opencode': 'https://opencode.ai/auth'
    };
    const cdraw = st => {
      const prov = st.provider || 'anthropic';
      const isAnthropic = prov === 'anthropic';
      const provLabel = providerLabels[prov] || prov;
      const keyUrl = providerKeyUrls[prov] || '';
      const hasProviders = st.providers && st.providers.length > 0;
      const provInfo = hasProviders ? st.providers.find(p => p.id === prov) : null;
      const freeModelsCount = provInfo ? provInfo.freeModels : 0;
      const maxContext = provInfo ? provInfo.maxContext : 0;
      const tagline = provInfo ? provInfo.tagline : '';
      const protocols = provInfo ? provInfo.protocols : [];
      
      // Recommended models per provider (from freellm.js)
      const recommendedModels = {
        'groq': [{id:'llama-3.3-70b-versatile',name:'Llama 3.3 70B Versatile',note:'30 RPM, 1K RPD, 131K ctx'},{id:'qwen/qwen3.8-27b',name:'Qwen 3.8 27B',note:'Reasoning, 30 RPM, 131K ctx'},{id:'whisper-large-v3',name:'Whisper Large v3',note:'Speech-to-text, 20 RPM'},{id:'whisper-large-v3-turbo',name:'Whisper Large v3 Turbo',note:'Speech-to-text, 20 RPM'}],
        'nvidia-nim': [{id:'z-ai/glm-5.3-flash',name:'GLM 5.3 Flash',note:'1M ctx, 40 RPM, multimodal'},{id:'moonshotai/kimi-k2.6',name:'Kimi K2.6',note:'262K ctx, 40 RPM'},{id:'poolside/laguna-xs-2.1',name:'Laguna XS 2.1',note:'262K ctx, 40 RPM, code'}],
        'google-gemini': [{id:'gemini-3.8-flash',name:'Gemini 3.8 Flash',note:'1M ctx, multimodal'},{id:'gemini-3.6-flash',name:'Gemini 3.6 Flash',note:'1M ctx, multimodal'},{id:'gemini-3.5-flash-lite',name:'Gemini 3.5 Flash-Lite',note:'1M ctx, multimodal'}],
        'openrouter': [{id:'stealth/crouton-alpha',name:'Crouton Alpha',note:'1M ctx, free'},{id:'nvidia/nemotron-3-ultra-550b-a55b:free',name:'Nemotron 3 Ultra',note:'1M ctx, free'},{id:'nvidia/nemotron-3.5-super-vl:free',name:'Nemotron 3.5 Super VL',note:'1M ctx, free, vision'},{id:'baidu/ernie-5.5-flash-preview:free',name:'ERNIE 5.5 Flash',note:'1M ctx, free'}],
        'kilo-code': [{id:'nvidia/nemotron-3-ultra-550b-a55b:free',name:'Nemotron 3 Ultra',note:'Coding optimized, 200 req/hr'},{id:'cohere/north-mini-code:free',name:'North Mini Code',note:'Coding optimized, 200 req/hr'},{id:'nvidia/nemotron-3-nano-omni-30b-a3b-reasoning:free',name:'Nemotron 3 Nano Omni',note:'256K ctx, reasoning'}],
        'mistral-ai': [{id:'open-mistral-7b',name:'Mistral 7B',note:'32K ctx'},{id:'open-mixtral-8x7b',name:'Mixtral 8x7B',note:'32K ctx'},{id:'mistral-medium-3.5-128b',name:'Mistral Medium 3.5 (128B)',note:'256K ctx'}],
        'cohere': [{id:'command-a-218b',name:'Command A+ (218B)',note:'128K ctx'},{id:'command-a-111b',name:'Command A (111B)',note:'256K ctx'},{id:'command-r',name:'Command R',note:'128K ctx'}],
        'cloudflare-workers-ai': [{id:'@cf/meta/llama-3.3-70b-instruct-fp8-fast',name:'Llama 3.3 70B FP8 Fast',note:'24K ctx, 10K neurons/day'},{id:'@cf/meta/llama-4-scout-17b-16e-instruct',name:'Llama 4 Scout 17B',note:'131K ctx'},{id:'@cf/openai/gpt-oss-120b',name:'GPT-OSS 120B',note:'128K ctx'}],
        'modelscope': [{id:'MiniMax/MiniMax-M1-80k',name:'MiniMax M1 80K',note:'80K ctx'},{id:'meituan-longcat/LongCat-Flash-Lite',name:'LongCat Flash Lite',note:'8K ctx'},{id:'MedAIBase/AntAngelMed',name:'AntAngelMed',note:'Medical, 8K ctx'}],
        'ovhcloud-ai-endpoints': [{id:'qwen3.5-397b-a17b',name:'Qwen 3.5 397B',note:'262K ctx, EU hosted, 2 RPM'},{id:'gpt-oss-120b',name:'GPT-OSS 120B',note:'131K ctx, EU hosted'},{id:'meta-llama-3_3-70b-instruct',name:'Llama 3.3 70B',note:'131K ctx, EU hosted'}],
        'ollama-cloud': [{id:'gpt-oss:120b',name:'GPT-OSS 120B',note:'128K ctx'},{id:'nemotron-3-ultra',name:'Nemotron 3 Ultra',note:'256K ctx'},{id:'minimax-m3',name:'MiniMax M3',note:'512K ctx'}],
        'glhf-chat': [{id:'meta-llama/Meta-Llama-3.1-70B-Instruct',name:'Llama 3.1 70B',note:'131K ctx, unlimited free'},{id:'mistralai/Mixtral-8x7B-Instruct-v0.1',name:'Mixtral 8x7B',note:'32K ctx, unlimited free'}],
        'chutes-ai': [{id:'deepseek-ai/DeepSeek-R1',name:'DeepSeek R1',note:'131K ctx, reasoning'},{id:'meta-llama/Meta-Llama-3.1-70B-Instruct',name:'Llama 3.1 70B',note:'131K ctx'}],
        'llm7-io': [{id:'gpt-oss-20b',name:'GPT-OSS 20B',note:'128K ctx, 60 RPM'},{id:'mistral-Nemo-Instruct-2407',name:'Mistral Nemo 2407',note:'128K ctx, 60 RPM'},{id:'codestral-latest',name:'Codestral Latest',note:'32K ctx, code'}],
        'z-ai-zhipu-ai': [{id:'glm-4.5-air',name:'GLM 4.5 Air',note:'131K ctx'},{id:'glm-4.7-flash',name:'GLM 4.7 Flash',note:'200K ctx'},{id:'glm-4.5',name:'GLM 4.5',note:'128K ctx'}],
        'gonka-broker': [{id:'minimaxai-minimax-m2-7',name:'MiniMax M2.7',note:'200K ctx'},{id:'deepseek-ai-deepseek-v4-flash-0731',name:'DeepSeek V4 Flash',note:'400K ctx'},{id:'zai-org/GLM-5.3-Flash',name:'GLM 5.3 Flash',note:'400K ctx'}],
        'agnes-ai': [{id:'agnes-2.5-flash',name:'Agnes 2.5 Flash',note:'256K ctx'},{id:'agnes-image-2.1-flash',name:'Agnes Image 2.1 Flash',note:'4K ctx, vision'},{id:'agnes-image-2.0-flash',name:'Agnes Image 2.0 Flash',note:'4K ctx, vision'}],
        'aion-labs': [{id:'aion-labs-aion-2.0',name:'Aion 2.0',note:'128K ctx'},{id:'aion-labs-aion-rp-llama-3.1-8b',name:'Aion RP Llama 3.1 8B',note:'32K ctx'},{id:'aion-labs-aion-3.0',name:'Aion 3.0',note:'128K ctx'}],
        'siliconflow': [{id:'tencent-hunyuan-mt-7b',name:'Hunyuan MT 7B',note:'1K RPM'},{id:'xingchenagi-xing4-0-29b',name:'Xing 4.0 29B',note:'1K RPM'}],
        'grok-(xai)': [{id:'grok-2',name:'Grok 2',note:'131K ctx, $25/mo free credits'},{id:'grok-2-mini',name:'Grok 2 Mini',note:'131K ctx, $25/mo free credits'}],
        'opencode': [{id:'big-pickle',name:'Big Pickle',note:'No context limit'},{id:'nemotron-3.5-lightning-free',name:'Nemotron 3.5 Lightning',note:'262K ctx'},{id:'deepseek-v4-flash',name:'DeepSeek V4 Flash',note:'1M ctx'}],
      };
      const modelsForProvider = isAnthropic ? (st.models || []) : (recommendedModels[prov] || []);
      const providerOptions = hasProviders
        ? st.providers.map(p => '<option value="' + esc(p.id) + '"' + (p.id === prov ? ' selected' : '') + '>' + esc(providerLabels[p.id] || p.name) + (p.hasKey ? ' ✓' : '') + (p.freeModels ? ' (' + p.freeModels + ' free)' : '') + '</option>').join('')
        : Object.keys(providerLabels).map(p => '<option value="' + esc(p) + '"' + (p === prov ? ' selected' : '') + '>' + esc(providerLabels[p]) + '</option>').join('');
      
      if (clBox) clBox.innerHTML =
        (st.problem ? '<div class="small" style="color:var(--bad);border:1px solid var(--bad);border-radius:8px;padding:8px 10px;margin-bottom:8px;line-height:1.5">⚠ ' + esc(st.problem) + '</div>' : '') +
        (!st.on ? '<div class="small mute" style="line-height:1.6;margin-bottom:8px">To use a cloud provider: pick one below, sign up at their site, and paste your API key here. <b>Most free providers need no credit card.</b> ' + (keyUrl ? 'Get a key: <a href="' + esc(keyUrl) + '" target="_blank" rel="noopener noreferrer">' + esc(keyUrl) + '</a>' : '') + '</div>' : '') +
        '<div class="row" style="gap:6px;flex-wrap:wrap;align-items:center;margin-bottom:8px"><label class="small mute" style="flex:1;min-width:160px">Provider</label><select id="cprov" style="max-width:340px;flex:1">' + providerOptions + '</select></div>' +
        (provInfo && !isAnthropic ? '<div class="small mute" style="margin-bottom:8px;line-height:1.6"><b>' + esc(provLabel) + '</b> — ' + esc(tagline || 'Free tier available') + (freeModelsCount ? ' · <b>' + freeModelsCount + ' free models</b>' : '') + (maxContext ? ' · Max context: <b>' + (maxContext >= 1000000 ? (maxContext/1000000).toFixed(1) + 'M' : (maxContext/1000).toFixed(0) + 'K') + '</b>' : '') + (protocols.length ? ' · ' + protocols.map(esc).join(', ') : '') + '</div>' : '') +
        '<div class="row" style="gap:6px;flex-wrap:wrap;align-items:center"><input type="password" id="ckey" autocomplete="off" spellcheck="false" placeholder="' + (st.on ? 'paste a new key to replace the saved one' : (isAnthropic ? 'sk-ant-api…' : 'API key…')) + '" style="min-width:220px;flex:1"><button class="pri" data-cl="save">' + (st.on || st.saved ? 'Replace the key' : 'Save the key') + '</button>' + (st.on || st.saved ? '<button class="ib" data-cl="forget">Forget it</button>' : '') + '</div>' +
        (st.saved ? '<div class="small mute" style="margin-top:4px">🔐 The key is ' + (st.encrypted ? 'encrypted by Windows for your Windows account' : 'being encrypted') + ' and never shown to this window. Key ending ' + esc(st.tail || '????') + '.</div>' : '') +
        (st.on ? '<div class="row" style="gap:6px;flex-wrap:wrap;align-items:center;margin-top:6px"><label class="small mute">Model</label><select id="cmodel" style="max-width:340px;flex:1">' + modelsForProvider.map(m => '<option value="' + esc(m.id) + '"' + (m.id === st.model ? ' selected' : '') + '>' + esc(m.name) + (m.note ? ' - ' + esc(m.note) : '') + '</option>').join('') + '<option value="">— Enter custom model ID —</option></select><button class="ib" data-cl="test">Test it</button><button class="ib" data-cl="refresh">Refresh providers</button><button class="ib" data-cl="forcerefresh" title="Force refresh from GitHub (clears 6-hour cache)">⟳ Force refresh</button></div>' + (!isAnthropic ? '<div class="small mute" style="margin-top:4px"><a href="https://freellm.net/models/" target="_blank" rel="noopener noreferrer">Browse all 300+ free models at freellm.net →</a></div>' : '') : '');
      if (clState) clState.innerHTML = st.on
        ? '&#9729; <b>' + esc(provLabel) + ' is on</b>: answers use <b>' + esc(st.model) + '</b> (key ending ' + esc(st.tail) + '). Pick the local model in the box at the top of the chat to go back to offline answers at any time.'
        : '&#128274; Answers use the <b>local model</b>: nothing leaves this PC.';
    };
    const cget = async () => { try { const st = await A.api('/api/cloud'); cdraw(st); const w = $$('#cweb'); if (w) w.checked = !!st.web; if (A.net) A.net.refresh(); return st; } catch (e) { if (clState) clState.textContent = 'The online AI settings could not be read.'; } };
    const cset = async patch => { try { const st = await A.api('/api/cloud', patch); cdraw(st); if (A.net) A.net.refresh(); return st; } catch (e) { A.toast('Could not save: ' + e.message, 5000); } };
    if (clBox) clBox.addEventListener('click', async e => {
      const b = e.target.closest('[data-cl]'); if (!b) return; const a = b.dataset.cl;
      if (a === 'save') { const k = $$('#ckey'); const v = (k.value || '').trim(); if (!v) return A.toast('Paste your API key first.', 4000); const prov = $$('#cprov') ? $$('#cprov').value : 'anthropic'; const st = await cset({ providerKey: { provider: prov, key: v } }); if (st && st.on) { A.toast(prov + ' is ready. It is now in the model list at the top of the chat.', 6000); k.value = ''; } }
      else if (a === 'forget') { const prov = $$('#cprov') ? $$('#cprov').value : 'anthropic'; const st = await cset({ providerKey: { provider: prov, key: '' } }); if (st) A.toast('The key was removed.', 5000); }
      else if (a === 'test') { A.toast('Asking model...', 3000); const prov = $$('#cprov') ? $$('#cprov').value : 'anthropic'; const model = $$('#cmodel') ? $$('#cmodel').value : ''; const r = prov === 'anthropic' ? await A.api('/api/cloud/test', {}) : await A.api('/api/cloud/test-free', { provider: prov, model: model }); A.toast(r && r.ok ? 'Model answered (' + (r.model || '') + '): "' + (r.reply || '') + '"' : ((r && r.error) || 'No answer.'), r && r.ok ? 5000 : 8000); }
      else if (a === 'refresh') { const prov = $$('#cprov') ? $$('#cprov').value : 'anthropic'; if (prov === 'anthropic') { const r = await A.api('/api/cloud/models', {}); if (r && r.status) cdraw(r.status); A.toast(r && r.error ? r.error : (r && r.live ? 'Model list updated from Anthropic.' : 'Using the built-in list.'), 5000); } else { const r = await A.api('/api/cloud/providers', {}); const st = await A.api('/api/cloud', {}); cdraw(st); A.toast('Providers refreshed.', 3000); } }
      else if (a === 'forcerefresh') { A.toast('Fetching fresh provider list from GitHub...', 3000); const r = await A.api('/api/cloud/refresh-providers', {}); const st = await A.api('/api/cloud', {}); cdraw(st); A.toast(r && r.length ? 'Refreshed: ' + r.length + ' providers loaded.' : 'Could not refresh providers.', 5000); }
    });
    if (clBox) clBox.addEventListener('change', async e => {
      if (e.target.id === 'cprov') { const prov = e.target.value; cset({ provider: prov }); }
      else if (e.target.id === 'cmodel') {
        const val = e.target.value;
        if (val === '') {
          const custom = prompt('Enter custom model ID (e.g., "deepseek-ai/DeepSeek-V3" or "gemini-2.5-pro"):');
          if (custom) {
            e.target.value = custom;
            cset({ model: custom });
          } else {
            const st = await A.api('/api/cloud');
            cdraw(st);
          }
        } else {
          cset({ model: val });
        }
      }
    });
    if ($$('#cweb')) $$('#cweb').addEventListener('change', e => cset({ web: e.target.checked }));
    if ($$('#sacommit')) { A.api('/api/autocommit').then(r => { const c = $$('#sacommit'); if (c) c.checked = !!(r && r.on); }).catch(() => {}); $$('#sacommit').addEventListener('change', e => { A.api('/api/autocommit', { on: e.target.checked }).catch(() => {}); A.toast(e.target.checked ? 'Auto-commit on' : 'Auto-commit off: changes are no longer committed by themselves.'); }); }
    cget();
    /* No API Key Required section */
    const nkState = $$('#nkstate'), nkBox = $$('#nkbox');
    let nkProviders = [];
    const nkdraw = st => {
      if (!nkBox) return;
      const prov = st.provider || 'glhf-chat';
      const provLabel = noKeyProviderLabels[prov] || prov;
      const modelsForProvider = noKeyRecommendedModels[prov] || [];
      const providerOptions = nkProviders.map(p => '<option value="' + esc(p.id) + '"' + (p.id === prov ? ' selected' : '') + '>' + esc(noKeyProviderLabels[p.id] || p.name) + '</option>').join('');
      nkBox.innerHTML =
        (st.error ? '<div class="small" style="color:var(--bad);border:1px solid var(--bad);border-radius:8px;padding:8px 10px;margin-bottom:8px;line-height:1.5">⚠ ' + esc(st.error) + '</div>' : '') +
        '<div class="row" style="gap:6px;flex-wrap:wrap;align-items:center;margin-bottom:8px"><label class="small mute" style="flex:1;min-width:160px">Provider</label><select id="nkprov" style="max-width:340px;flex:1">' + providerOptions + '</select></div>' +
        '<div class="row" style="gap:6px;flex-wrap:wrap;align-items:center;margin-top:6px"><label class="small mute">Model</label><select id="nkmodel" style="max-width:340px;flex:1">' + modelsForProvider.map(m => '<option value="' + esc(m.id) + '"' + (m.id === st.model ? ' selected' : '') + '>' + esc(m.name) + (m.note ? ' - ' + esc(m.note) : '') + '</option>').join('') + '<option value="">— Enter custom model ID —</option></select><button class="ib" data-nk="test">Test it</button><button class="ib" data-nk="refresh">Refresh</button><button class="ib" data-nk="forcerefresh" title="Force refresh from GitHub (clears 6-hour cache)">⟳ Force refresh</button></div>';
      if (nkState) nkState.innerHTML = st.provider
        ? '&#128274; <b>' + esc(provLabel) + '</b> is active: answers use <b>' + esc(st.model) + '</b>. Pick the local model in the box at the top of the chat to go back to offline answers at any time.'
        : '&#128274; Answers use the <b>local model</b>: nothing leaves this PC.';
    };
    const nkget = async () => {
      try {
        const r = await A.api('/api/cloud/no-key');
        nkProviders = r || [];
        const st = await A.api('/api/cloud');
        nkdraw(st);
      } catch (e) {
        if (nkState) nkState.textContent = 'No-key providers could not be loaded.';
      }
    };
    const nkset = async patch => {
      try {
        const st = await A.api('/api/cloud', patch);
        nkdraw(st);
        if (A.net) A.net.refresh();
        return st;
      } catch (e) {
        A.toast('Could not save: ' + e.message, 5000);
      }
    };
    if (nkBox) nkBox.addEventListener('click', async e => {
      const b = e.target.closest('[data-nk]'); if (!b) return; const a = b.dataset.nk;
      if (a === 'test') { A.toast('Asking model...', 3000); const prov = $$('#nkprov') ? $$('#nkprov').value : 'glhf-chat'; const model = $$('#nkmodel') ? $$('#nkmodel').value : ''; const r = await A.api('/api/cloud/test-no-key', { provider: prov, model: model }); A.toast(r && r.ok ? 'Model answered (' + (r.model || '') + '): "' + (r.reply || '') + '"' : ((r && r.error) || 'No answer.'), r && r.ok ? 5000 : 8000); }
      else if (a === 'refresh') { const r = await A.api('/api/cloud/no-key', {}); nkProviders = r || {}; const st = await A.api('/api/cloud', {}); nkdraw(st); A.toast('Providers refreshed.', 3000); }
      else if (a === 'forcerefresh') { A.toast('Fetching fresh provider list from GitHub...', 3000); const r = await A.api('/api/cloud/refresh-providers', {}); const st = await A.api('/api/cloud', {}); nkdraw(st); A.toast(r && r.length ? 'Refreshed: ' + r.length + ' providers loaded.' : 'Could not refresh providers.', 5000); }
    });
    if (nkBox) nkBox.addEventListener('change', async e => {
      if (e.target.id === 'nkprov') { const prov = e.target.value; nkset({ provider: prov }); }
      else if (e.target.id === 'nkmodel') {
        const val = e.target.value;
        if (val === '') {
          const custom = prompt('Enter custom model ID (e.g., "deepseek-ai/DeepSeek-V3" or "gemini-2.5-pro"):');
          if (custom) {
            e.target.value = custom;
            nkset({ model: custom });
          } else {
            const st = await A.api('/api/cloud');
            nkdraw(st);
          }
        } else {
          nkset({ model: val });
        }
      }
    });
    nkget();
    /* Free frontier pool: the routes, how they are doing, and a live test */
    const frBox = $$('#frbox');
    const frdraw = st => {
      if (!frBox) return;
      const rs = (st && st.routes) || [];
      frBox.innerHTML =
        '<div class="row" style="gap:6px;flex-wrap:wrap;align-items:center;margin-bottom:8px"><button class="pri" data-fr="pick">Use it in the chat</button><button class="ib" data-fr="test">Test every route</button><span class="small mute">' + (st ? st.usedToday + ' answered today · ' + st.total + ' in all' : '') + '</span></div>' +
        (rs.length ? '<div style="display:flex;flex-direction:column;gap:2px">' + rs.map(r => '<div><div class="row" style="gap:8px;align-items:center;border-bottom:1px solid var(--line);padding:4px 0"><span style="width:8px;height:8px;border-radius:50%;flex:none;background:' + (r.awake ? '#3fbf6f' : '#d09b2c') + '"></span><b style="flex:1;min-width:110px">' + esc(r.name) + '</b><span class="small mute">' + esc(r.model) + '</span><span class="small mute" style="min-width:56px;text-align:right">' + r.usedToday + ' today</span>' + (r.awake ? '' : '<span class="small mute">resting ' + Math.ceil(r.restMs / 1000) + 's</span>') + '</div>' + (r.lastError && !r.awake ? '<div class="small mute" style="margin:0 0 4px 16px">' + esc(r.lastError) + '</div>' : '') + '</div>').join('') + '</div>' : '') +
        '<div class="small mute" style="margin-top:8px;line-height:1.5">' + esc((st && st.limit) || '') + '</div>';
    };
    const frget = async () => { try { frdraw(await A.api('/api/free/status')); } catch (e) { if (frBox) frBox.textContent = 'The free routes could not be read.'; } };
    if (frBox) frBox.addEventListener('click', async e => {
      const b = e.target.closest('[data-fr]'); if (!b) return;
      if (b.dataset.fr === 'pick') { ls.set('model', 'free-auto'); A.toast('The chat will use ✦ Free frontier · auto. Open Chat and ask something.', 7000); }
      else if (b.dataset.fr === 'test') { A.toast('Asking every free route…', 4000); const r = await A.api('/api/free/test', {}); A.toast(r && r.routes ? (r.ok + ' of ' + r.routes.length + ' free routes answered just now.') : 'No answer.', 7000); frget(); }
    });
    frget();
    { const hk = $$('#hkind'), st = $$('#hkindst');
      if (hk) {
        A.api('/api/harness/kind').then(r => { hk.value = r.kind || 'claude'; if (!r.jcode) { hk.querySelector('option[value="jcode"]').disabled = true; st.textContent = 'jcode is not installed'; } }).catch(() => { });
        hk.onchange = async () => { const r = await A.api('/api/harness/kind', { kind: hk.value }); if (r.ok) { st.textContent = ''; A.toast('Agent harness: ' + (hk.value === 'jcode' ? 'jcode' : 'Claude Code')); } else { A.toast(r.error || 'Could not switch.'); const g = await A.api('/api/harness/kind'); hk.value = g.kind; } };
      } }
    if (A.privacyPage) A.privacyPage($$('#prvbox'), cset);
    if (A.remotePage) A.remotePage($$('#rmbox'));
    /* the version is read from the VERSION file on disk (one place to change it). Updates live in updates.js (Settings › Backup & data › Updates);
       the old "releases folder" check below stays for copies with no update source. */
    const about = async () => { try { return await A.api('/api/about'); } catch (e) { return null; } };
    about().then(a => { const el = document.getElementById('aboutver'); if (!a || !el) return; A.version = a.version || A.version; A.built = a.built || A.built; el.innerHTML = 'Moundshroud <b>' + esc(a.version) + '</b>' + (a.built ? ' (built ' + esc(a.built) + ')' : ''); });
    if (A.updates) A.updates.render(document.getElementById('updbox'));
    root.addEventListener('click', async e => {
      const b = e.target.closest('[data-a]'); if (!b) return; const a = b.dataset.a;
      if (a === 'vtest') test(); else if (a === 'cust') { A.custom && A.custom.open(); } else if (a === 'replayboot') { close(); if (window.OA_REPLAY_BOOT) window.OA_REPLAY_BOOT(); } else if (a === 'sounds') { close(); A.showTab('play'); setTimeout(() => { const s = document.querySelector('#plsub [data-s=sounds]'); s && s.click(); }, 400); }
      else if (a === 'wake') { wakeSet(b); }
      else if (a === 'cvox') { A.cvoice.auto = !A.cvoice.auto; b.textContent = A.cvoice.auto ? 'On' : 'Off'; } else if (a === 'cnote') { const v = A.chessNotify ? A.chessNotify.toggle() : ls.get('cmnote', '1') === '0'; if (!A.chessNotify) ls.set('cmnote', v ? '1' : '0'); b.textContent = 'Message alerts: ' + (v ? 'On' : 'Off'); } else if (a === 'ccai') { ls.set('cmai', ls.get('cmai', '1') !== '0' ? '0' : '1'); b.textContent = 'AI chatter: ' + (ls.get('cmai', '1') !== '0' ? 'On' : 'Off'); } else if (a === 'cbak') { const blob = new Blob([A.chars.backup()], { type: 'application/json' }), u = URL.createObjectURL(blob), l = document.createElement('a'); l.href = u; l.download = 'moundshroud-characters-' + new Date().toISOString().slice(0, 10) + '.json'; l.click(); setTimeout(() => URL.revokeObjectURL(u), 3000); } else if (a === 'cimp') { const f = document.createElement('input'); f.type = 'file'; f.accept = '.json'; f.onchange = async () => { try { A.chars.restore(await f.files[0].text()); A.toast('Restored. Reload Moundshroud to see everything.', 5000); } catch (er) { A.toast('That file could not be read.'); } }; f.click(); } else if (a === 'chars') { close(); A.chars.manage(); } else if (a === 'forgetchars') { if (confirm('Every character will forget everything about you: facts, shared history and relationships. Continue?')) { A.chars.forgetAll(); A.toast('All characters have forgotten you.'); } } else if (a === 'buddychat') { close(); A.buddy && A.buddy.open(); } else if (a === 'buddytrick') { close(); if (A.companion && A.companion.doTrick) A.companion.doTrick(); } else if (a === 'cset') openChessTab('settings'); else if (a === 'lab') openChessTab('lab');
      else if (a.startsWith('walk:')) { close(); setTimeout(() => A.walk && A.walk.start(a.slice(5)), 250); }
      else if (a === 'present') { close(); A.tutorial && A.tutorial.resume(); } else if (a === 'guide') { close(); A.showTab('guide'); } else if (a === 'storage') { const g = $$('#stghost'); if (g) g.scrollIntoView({ behavior: 'smooth' }); }
      else if (a === 'clrchat') { if (!confirm('Delete every saved chat?')) return; await A.api('/api/chats', []); close(); location.reload(); }
      else if (a === 'resethelp') { ls.set('play_help_seen', '[]'); A.toast('Game tutorials will show again.'); }
      else if (a === 'personareset') { const t = $$('#spersona'); if (t) t.value = ''; ls.set('persona', ''); A.toast('Personality cleared. The assistant is back to its normal self.'); }
      else if (a === 'mem') { close(); try { A.memory.manage(); } catch (er) { A.toast('What the assistant remembers is not loaded: reload Moundshroud.'); } }
      else if (a === 'resetchess') { if (!confirm('Reset ALL chess data: games, ratings, daily games, clubs and friends? This cannot be undone.')) return; ['chgames', 'chonline', 'chdaily', 'chsocial', 'chprof', 'chstudy', 'chrush', 'chtour', 'chlearn', 'chrate'].forEach(k => ls.set(k, '')); A.toast('Chess data cleared.'); }
      else if (a === 'restore') { A.backup.pick(); } else if (a === 'fullbak') { A.backup.make(); } else if (a === 'shareapp') { const st = $$('#shareappstatus'); if (st) st.textContent = 'Creating zip…'; A.toast('Creating shareable app zip…', 4000); try { const r = await fetch('/api/app/share', { method: 'POST' }); if (!r.ok) { const j = await r.json().catch(() => ({})); throw new Error(j.error || 'Server error ' + r.status); } const blob = await r.blob(); const url = URL.createObjectURL(blob); const a = document.createElement('a'); a.href = url; a.download = 'Moundshroud-' + new Date().toISOString().slice(0, 10).replace(/-/g, '') + '.zip'; a.click(); setTimeout(() => URL.revokeObjectURL(url), 10000); if (st) st.textContent = '✅ Ready — sent to your Downloads'; A.toast('Shareable app zip downloaded!', 6000); } catch (e) { if (st) st.textContent = '❌ ' + e.message; A.toast('Share failed: ' + e.message, 8000); } } else if (a === 'gitpush') { const st = $$('#gitpushstatus'); if (st) st.textContent = 'Pushing…'; A.toast('Pushing to GitHub…', 4000); try { const r = await A.api('/api/git/push', { addAll: true, message: 'Auto-commit from Moundshroud: ' + new Date().toISOString().slice(0, 19).replace('T', ' ') }); if (r.ok && r.repo) { if (st) st.innerHTML = '✅ Pushed to <a href="' + esc(r.repo) + '" target="_blank" rel="noopener noreferrer">' + esc(r.repo) + '</a> (' + esc(r.branch) + ')'; A.toast('Pushed to ' + r.repo + ' (' + r.branch + ')', 8000); } else if (r.ok && !r.hadChanges) { if (st) st.textContent = '✅ Nothing to commit — working tree clean'; A.toast('Nothing to commit', 5000); } else { if (st) st.textContent = '❌ ' + (r.error || 'Push failed'); A.toast('Push failed: ' + (r.error || 'unknown error'), 8000); } } catch (e) { if (st) st.textContent = '❌ ' + e.message; A.toast('Push error: ' + e.message, 8000); } } else if (a === 'selftest') { A.selftest.run(); } else if (a === 'keys') { keySheet(); } else if (a === 'webtest') { const st = await A.api('/api/cloud'); if (!st.web) return A.toast('Switch internet access on first (the tick box on the left).', 5000); const q = prompt('What should Moundshroud search the web for?', 'today\'s news'); if (!q) return; A.toast('Searching...', 4000); const r = await A.api('/api/net/search', { q: q, n: 5 }); const list = (r.results || []); if (r.error) return A.toast(r.error, 6000); A.dlg('<div class="hd"><b>Web search: ' + esc(q) + '</b></div><div class="bd">' + (list.length ? list.map(x => '<div style="padding:6px 0;border-bottom:1px solid var(--line)"><b>' + esc(x.title) + '</b> <span class="small mute">' + esc(x.source || '') + '</span><div class="small mute" style="overflow-wrap:anywhere">' + esc(x.url) + '</div><div class="small" style="margin-top:3px">' + esc((x.snippet || '').slice(0, 220)) + '</div></div>').join('') : '<div class="small mute">Nothing came back. The connection may be down.</div>') + '<div class="small mute" style="margin-top:10px">This is what the chat sees and cites when the &#127760; Web box is ticked.</div></div>'); }
      else if (a === 'update') { about().then(r => { if (!r) return A.toast('The version could not be read.'); if (r.offers && r.offers.length) A.toast('Version ' + r.offers[0].version + ' is in the releases folder. Quit Moundshroud from the tray, unzip that copy over this folder (keep your data folder), then start it again.', 14000); else A.toast('You are on the newest version (' + r.version + ').', 5000); }); } else if (a === 'problems') { close(); if (A.problems) A.problems.open(); else A.toast('The problem log is not loaded: reload Moundshroud.'); }
    });
    if (sectionId) setTimeout(() => { const s = body.querySelector('[data-sec=' + sectionId + ']'); if (s) body.scrollTo({ top: s.offsetTop - 8 }); }, 50);
    try { speechSynthesis.onvoiceschanged = () => { if (root && !body.dataset.vrefreshed) { body.dataset.vrefreshed = 1; const sel = $$('#sv'); if (sel && sel.options.length < 3) { close(); open(sectionId); } } }; } catch (e) { }
  }
  A.settings = { open, close };
  const hook = () => { const c = document.getElementById('cog'); if (c) c.onclick = () => open(); };
  hook(); setTimeout(hook, 0); addEventListener('load', hook);
})();

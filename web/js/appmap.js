// App map: the whole of Moundshroud laid out in one place, for anyone. Every tab and the sections inside it, a
// reference sheet for setting things up and doing things, every shortcut and setting, where every kind of data is kept
// and how big it is, everything downloaded, every outside connection, the helper programs and whether they are running,
// every code file with the sentence at its top that says what it does, and every address the server answers.
// Most of it is read live from the app (lib/appmap.js, the Guide, Stock up and the Privacy page), so it stays true.
(() => {
  const root = document.getElementById('p-map'); if (!root) return;
  const SECS = [['overview', '🧭 Overview'], ['tabs', '🗂 Tabs & sections'], ['ref', '📋 Reference sheet'], ['keys', '⌨ Shortcuts'], ['settings', '⚙ Settings'], ['data', '💾 Your data'], ['downloads', '📦 Downloads'], ['outside', '🌐 Outside connections'], ['running', '🔌 Running parts'], ['code', '🧱 Code files'], ['api', '🔗 Server addresses']];
  let sec = ls.get('map_sec', 'overview'), q = '', M = null, INV = null, PRV = null;
  const gbs = b => b >= 1073741824 ? (b / 1073741824).toFixed(1) + ' GB' : b >= 1048576 ? (b / 1048576).toFixed(1) + ' MB' : b >= 1024 ? Math.round(b / 1024) + ' KB' : b + ' B';
  const css = `.am{display:flex;flex:1;min-height:0}.am-nav{width:220px;flex:none;border-right:1px solid var(--line);padding:12px 8px;overflow:auto}.am-nav button{display:block;width:100%;text-align:left;border:0;background:none;color:var(--text);padding:7px 10px;border-radius:8px;cursor:pointer;font-size:13.5px}.am-nav button.on{background:var(--acc);color:#fff}.am-nav button:hover:not(.on){background:var(--panel)}
.am-main{flex:1;min-width:0;overflow:auto;padding:16px 22px 50px}.am-card{background:var(--panel);border:1px solid var(--line);border-radius:12px;padding:12px 14px;margin:0 0 10px}.am-card h4{margin:0 0 6px;font-size:13px;text-transform:uppercase;letter-spacing:.06em;color:var(--mute)}
.am-t{width:100%;border-collapse:collapse;font-size:13px}.am-t td,.am-t th{padding:6px 8px;border-bottom:1px solid var(--line);text-align:left;vertical-align:top}.am-t th{color:var(--mute);font-size:12px;font-weight:600}.am-t code{font-size:12px}
.am-pill{display:inline-block;border:1px solid var(--line);border-radius:999px;padding:1px 8px;font-size:11.5px;margin:2px 3px 2px 0}.am-dot{display:inline-block;width:9px;height:9px;border-radius:50%;margin-right:6px}
.am-flow{display:grid;grid-template-columns:repeat(auto-fit,minmax(210px,1fr));gap:10px}.am-box{border:1px solid var(--line);border-radius:12px;padding:10px 12px;background:var(--panel2)}.am-box b{display:block;margin-bottom:3px}
mark{background:rgba(242,201,76,.35);color:inherit;border-radius:3px}
.am-atlas-head{display:flex;gap:10px;align-items:center;flex-wrap:wrap;margin-bottom:12px}.am-atlas-head h2{margin:0}.am-atlas-layout{display:grid;grid-template-columns:minmax(0,1.65fr) minmax(280px,.8fr);gap:12px;align-items:stretch}.am-atlas-stage{position:relative;min-height:470px;height:min(57vh,650px);overflow:hidden;border:1px solid rgba(130,170,255,.28);border-radius:18px;background:#050918;box-shadow:inset 0 0 70px rgba(40,85,170,.18),0 18px 50px rgba(0,0,0,.25)}.am-atlas-canvas{position:absolute;inset:0;width:100%;height:100%;touch-action:none;cursor:grab}.am-atlas-canvas:active{cursor:grabbing}.am-atlas-hud{position:absolute;top:12px;left:14px;right:14px;display:flex;align-items:center;gap:8px;pointer-events:none}.am-atlas-hud>*{pointer-events:auto}.am-atlas-title{color:#eff5ff;text-shadow:0 2px 12px #000;font-weight:700}.am-atlas-hint{margin-left:auto;color:#c6d5f5;font-size:12px;text-shadow:0 2px 8px #000}.am-atlas-legend{position:absolute;left:12px;right:12px;bottom:12px;display:flex;gap:6px;flex-wrap:wrap;justify-content:center}.am-atlas-legend button{border:1px solid rgba(190,210,255,.22);border-radius:999px;background:rgba(8,14,31,.82);color:#dce7ff;padding:5px 9px;font-size:11px;cursor:pointer}.am-atlas-legend button.on{border-color:var(--gc);box-shadow:0 0 12px color-mix(in srgb,var(--gc) 40%,transparent);color:#fff}.am-atlas-side{display:flex;flex-direction:column;min-height:470px;border:1px solid var(--line);border-radius:16px;background:linear-gradient(160deg,color-mix(in srgb,var(--panel) 96%,#536dff),var(--panel));overflow:hidden}.am-atlas-sidehead{padding:13px 14px 10px;border-bottom:1px solid var(--line)}.am-atlas-log{flex:1;min-height:170px;max-height:390px;overflow:auto;padding:12px;display:flex;flex-direction:column;gap:8px}.am-atlas-msg{max-width:95%;align-self:flex-start;padding:8px 10px;border-radius:12px;background:var(--panel2);white-space:pre-wrap;overflow-wrap:anywhere;font-size:13px}.am-atlas-msg.user{align-self:flex-end;background:color-mix(in srgb,var(--acc) 23%,var(--panel2))}.am-atlas-compose{display:flex;gap:6px;padding:9px;border-top:1px solid var(--line)}.am-atlas-compose textarea{flex:1;min-width:0;min-height:42px;max-height:100px;resize:vertical}.am-atlas-node{padding:12px 14px;border-top:1px solid var(--line);background:color-mix(in srgb,var(--panel2) 45%,transparent)}.am-atlas-node b{display:block}.am-atlas-node .small{margin-top:3px}.am-atlas-stats{display:grid;grid-template-columns:repeat(4,minmax(90px,1fr));gap:8px;margin:12px 0}.am-atlas-stat{padding:9px 11px;border:1px solid var(--line);border-radius:12px;background:var(--panel)}
@media(max-width:980px){.am-atlas-layout{grid-template-columns:1fr}.am-atlas-stage{height:54vh;min-height:390px}.am-atlas-side{min-height:360px}.am-atlas-log{max-height:300px}}
@media(max-width:580px){.am-atlas-stage{min-height:360px;height:55vh}.am-atlas-stats{grid-template-columns:repeat(2,minmax(90px,1fr))}.am-atlas-hint{display:none}}
@media (max-width:760px){.am{flex-direction:column}.am-nav{width:auto;display:flex;flex-wrap:wrap;gap:4px;border-right:0;border-bottom:1px solid var(--line)}.am-nav button{width:auto}}
@media print{body>header,#nav,.am-nav,.am-noprint{display:none!important}.am-main{overflow:visible}.am-card{break-inside:avoid}}`;
  if (!document.getElementById('amcss')) { const s = document.createElement('style'); s.id = 'amcss'; s.textContent = css; document.head.appendChild(s); }

  /* ---------- the reference sheet: setting up, and doing everything ---------- */
  const REF = [
    ['Setting up', [
      ['Install Moundshroud on a PC', 'Unzip Part 1 and Part 2 into the same folder, then run <code>setup.ps1</code> (right-click › Run with PowerShell). It installs the library engine, builds the hotkey helper and makes the shortcuts.', '', 'start'],
      ['Open Moundshroud', 'The Moundshroud shortcut on the Desktop or in the Start menu, or the hotkey anywhere in Windows.', 'Ctrl+Alt+A', 'start'],
      ['Close it completely', 'Press Esc with nothing open, or right-click the tray icon › Quit. Everything it started (AI engine, library) stops with it.', 'Esc', 'start'],
      ['Start it with Windows', 'Right-click the tray icon (bottom-right of the taskbar) › Start with Windows.', '', 'start'],
      ['Install the AI engine', 'Install Ollama from ollama.com/download (once). Moundshroud starts and stops it by itself.', '', 'chat'],
      ['Download an AI model', 'Prepare › 🛟 Stock up › AI models (or any model by name further down).', '', 'prepare'],
      ['Choose which model answers', 'The model list in the top bar.', '', 'chat'],
      ['Download libraries, voices, the chess engine, the picture and music makers', 'Prepare › Stock up › Download more.', '', 'prepare'],
      ['Remove something you downloaded', 'Prepare › Stock up › Everything on this PC › 🗑 Remove. It asks first and says what stops working.', '', 'prepare'],
      ['Turn internet access on or off', 'Settings › 🔒 Privacy (or AI & power), or the button in the News tab.', 'Ctrl+,', 'online'],
      ['Connect Claude (online AI)', 'Settings › AI & power › Online AI: Claude › paste your API key.', '', 'online'],
      ['See what can leave this PC', 'Settings › 🔒 Privacy.', '', 'privacy'],
      ['Pick the read-aloud voice', 'Settings › Voice & sound. More voices in Stock up.', '', 'settings'],
      ['Change the look', 'Settings › Appearance, and Make it yours.', '', 'customize'],
      ['Battery saving', 'Settings › AI & power › Low-power mode (a small model in Stock up helps most).', '', 'settings'],
      ['Back up everything', 'Settings › Backup & data. A copy of your progress is also made in Documents once a day.', '', 'settings'],
      ['Restore a backup', 'Settings › Backup & data › Restore from a backup.', '', 'settings'],
      ['Undo an update', 'Run <code>restore-snapshot.ps1</code> in the Moundshroud folder and pick the snapshot from before it.', '', 'settings'],
      ['Check that everything works', 'Settings › Backup & data › Run a self-test.', '', 'fixes'],
      ['See what went wrong', 'Settings › Backup & data › Problems & crash log.', '', 'fixes'],
      ['Give Moundshroud to a friend', 'Run <code>make-release.ps1 -Verify</code> in PowerShell in the Moundshroud folder, then send the two zip files in <code>releases</code>.', '', 'start'],
      ['Learn the app', 'Guide › Take the 1-minute tour, or the full presentation. This App map lays out everything.', 'F1', 'start']
    ]],
    ['Asking and finding', [
      ['Ask anything', 'Chat: type and press Enter.', 'Ctrl+N new chat', 'chat'],
      ['Use the web in an answer', 'Tick 🌐 Web under the message box (needs internet access on).', '', 'online'],
      ['Talk instead of typing', '🎙 Talk in the top bar, or the hotkey anywhere.', 'Ctrl+Alt+V', 'voice'],
      ['Ask about text you selected anywhere', 'Select it in any program, press the hotkey.', 'Ctrl+Alt+Q', 'anywhere'],
      ['Read text off the screen', 'Press the hotkey and drag over it.', 'Ctrl+Alt+S', 'anywhere'],
      ['Search everything at once', 'The search box, or the hotkey.', 'Ctrl+K', 'search'],
      ['Ask your own documents', 'Office › My Files.', '', 'files'],
      ['Read Wikipedia and the offline books', 'Office › Library, or the Browser tab.', '', 'library'],
      ['Attach a file or a picture', 'The paperclip in Chat, or paste a screenshot.', 'Ctrl+V', 'attach'],
      ['Have Moundshroud do something', 'Just ask in Chat (“remind me…”, “play…”, “open…”).', '', 'actions']
    ]],
    ['Writing, planning, keeping track', [
      ['Keep your passwords safe', 'Cyber › Passwords: an encrypted vault with one master password.', '', 'vault'],
      ['Read your email and write drafts', 'Office › Mail. Connect an account with an app password; drafts go to your Drafts folder.', '', 'mail'],
      ['Have the AI remember something about you', 'Say “remember that…” in Chat; Ctrl+K › What the AI remembers about me to see or delete it.', 'Ctrl+K', 'memory'],
      ['Fix the screen if buttons stop responding', 'Press F9, or Ctrl+K › Fix the screen. If that does not help, close and reopen Moundshroud.', 'F9', 'keys'],
      ['Take a note', 'Office › Notes, or a quick note from anywhere.', 'Ctrl+Alt+N', 'notes'],
      ['Make a Word, Excel, PowerPoint or PDF file', 'Ask in Chat, or Office › Documents.', '', 'docs'],
      ['Convert a file', 'Tools › File converter.', '', 'converter'],
      ['Reminders and timers', 'Office › Reminders & timers, or ask in Chat.', '', 'reminders'],
      ['Work something out', 'Office › Calculator (also a unit converter, tips, percentages and dates).', '', 'tools'],
      ['Read text from a photo or scan', 'Office › Scanner.', '', 'tools'],
      ['Record and transcribe a meeting', 'Office › Meeting notes.', '', 'tools'],
      ['Find something you copied earlier', 'Office › Clipboard (switch the history on there first).', 'Ctrl+Alt+C', 'tools'],
      ['Edit Word, Excel and PowerPoint files', 'Office › Office files.', '', 'docs'],
      ['Translate something', 'Education › Languages › 🌐 Translate.', '', 'languages'],
      ['Improve something you wrote', 'Education › Writing.', '', 'studio'],
      ['Practise an interview or a hard conversation', 'Education › Practice.', '', 'studio'],
      ['Have the AI teach you a topic step by step', 'Education › Teach me.', '', 'studio'],
      ['Keep albums of pictures and memories', 'Personal › Albums.', '', 'studio'],
      ['Explore history on a timeline', 'Office › Library › 🏛️ Timeline.', '', 'library'],
      ['Learn about cyber security', 'Cyber › Course, then the Cyber Lab guides and the Cyber games.', '', 'cyber'],
      ['Ask about security research, payloads or bug bounty', 'My Files › Reference libraries: download PayloadsAllTheThings, HackTricks, SecLists or the Awesome lists once, then ask in Chat with "Use my files" ticked.', '', 'files'],
      ['Ask the AI about a website with the internet off', 'My Files › Websites: give it an address once and it reads the site into your own index (Markdown, on this PC), so questions about it work offline afterwards.', '', 'files'],
      ['Learn to code', 'Cyber › 💻 Coding: lessons from beginner to advanced in 12 languages. Python and JavaScript run on the page, HTML shows a live preview.', '', 'cyber'],
      ['Read a free textbook', 'Library › 📘 Wikibooks: search or pick a subject, then open the book in the reader.', '', 'library'],
      ['Save or export a Bible Expert conversation', 'Spiritual › ✝️ Bible Expert › 📂 Saved chats: every conversation is saved by itself; reopen, copy, export or delete it.', '', 'spiritual'],
      ['Make a word search or a crossword', 'Entertainment › Games › Puzzle maker.', '', 'play'],
      ['Save and reuse instructions for the AI', 'Prepare › Prompts.', '', 'tools'],
      ['Calendar', 'The Calendar tab.', '', 'newtabs'],
      ['Meals and shopping list', 'Personal › Kitchen.', '', 'newtabs'],
      ['Budget', 'Personal › Money (only on this PC).', '', 'newtabs'],
      ['Journal', 'Personal › Journal.', '', 'today'],
      ['Flashcards, quizzes, study guides', 'Education › Study.', '', 'study'],
      ['Learn a language', 'Education › Languages.', '', 'languages']
    ]],
    ['News and markets', [
      ['Read the news', 'News › ⭐ Front page.', '', 'news'],
      ['See how a story is covered', 'Open an event: coverage bar, who had it first, every report.', '', 'news'],
      ['A brief of what is known', 'In an event › ✨ What we know (your local AI, from the reports only).', '', 'news'],
      ['Follow a subject', 'News › 🎯 Beats › Add a beat (or ☆ Follow on an event).', '', 'news'],
      ['Search two weeks of news', 'Type in the search box › 🗄 Search the two-week archive.', '', 'news'],
      ['Save notes on a story', 'In an event › 📋 Copy dossier or 💾 Save. ⧉ Cite on any report.', '', 'news'],
      ['Choose news sources', 'News › ⚙ Sources.', '', 'news'],
      ['Quotes, charts and companies', 'News › 📈 Markets.', '', 'markets'],
      ['Work out a position size', 'Markets › 🧮 Trade tools.', '', 'markets'],
      ['Track holdings and trades', 'Markets › 💼 Portfolio & journal.', '', 'markets']
    ]],
    ['Play, create, relax', [
      ['Update Moundshroud', 'Settings › Backup & data › Updates: check for a newer version and install it (internet access must be on).', '', 'updates'],
      ['Scan a chess position from a picture', 'Entertainment › Games › Chess › 📷 Scan: a screenshot, a book diagram or a photo becomes a board to analyse or play.', '', 'chessscan'],
      ['Play real people online', 'Entertainment › Games › Chess › ♞ Lichess, with your own free Lichess account.', '', 'lichess'],
      ['Look through your photos', 'Entertainment › Photos. ✨ Describe my photos lets you search by what is in them.', '', 'photos'],
      ['Games', 'Entertainment › Games.', '', 'play'],
      ['Imperium (the Rome RPG)', 'Entertainment › Games › Imperium.', '', 'imperium'],
      ['Chess', 'Entertainment › Games › Chess.', '', 'chessboard'],
      ['Music', 'Entertainment › Music.', '', 'musiclib'],
      ['Listen to live radio', 'Entertainment › Radio (needs internet access on).', '', 'radio'],
      ['Watch live TV (or bring in your VLC links)', 'Entertainment › TV › 📡 My channels.', '', 'tv'],
      ['Watch YouTube', 'Entertainment › TV › ▶ YouTube.', '', 'tv'],
      ['Scan ports, check DNS, WHOIS, certificates or security headers', 'Cyber › 🧰 Toolkit (or ask the AI: “scan the ports on localhost”).', '', 'cyber'],
      ['Capture network packets (Wireshark), or see live connections', 'Cyber › 🧰 Toolkit › Packet capture / Live connections.', '', 'cyber'],
      ['Download a YouTube video, or just its sound', 'Entertainment › TV › ▶ YouTube › ⬇ (then 📥 Downloads).', '', 'tv'],
      ['Find more TV channels', 'Entertainment › TV › 🌐 More channels, or type a channel name in the TV search box.', '', 'tv'],
      ['Find a file I converted, or get its original back', 'Tools › Converter › My converted files (↩ Original).', '', 'converter'],
      ['Listen to police and fire scanners', 'Entertainment › Radio › 🚓 Scanners, or ➕ Add a station for a feed you have.', '', 'radio'],
      ['Make pictures or music', 'Studio.', '', 'studio'],
      ['Bible, prayers, the Rosary', 'The Spiritual tab.', '', 'spiritual'],
      ['Ask a question about the Bible, the Church or Christian history', 'Spiritual › ✝️ Bible Expert (it moved here from Chat). It searches about 170 texts on this PC: the Church Fathers, Aquinas, the Catechism, the Catholic Encyclopedia, Vatican II, encyclicals, creeds and Orthodox and Protestant writers, and cites them as [1], [2].', '', 'bible'],
      ['Add more Christian texts', 'Prepare › 🛟 Stock up › Tools › Christian texts for the Bible Expert, or run <code>install-christian-texts.ps1</code>. Your own .txt files go in <code>data\\bible</code>.', '', 'prepare'],
      ['Learn the Bible step by step', 'Spiritual › 🎓 Learn: the 73 books, the story in 12 steps, memorize a verse (it comes back for review), and a quick quiz.', '', 'spiritual'],
      ['Keep the verse of the day', 'Press ☆ Save on the Today page or on Spiritual › Today. Switch on Keep every daily verse automatically to save each one. Saved verses are in Spiritual › My notes.', '', 'spiritual'],
      ['Read any Gutenberg book', 'Library › Classics: every Project Gutenberg collection you have, including geography, medicine, farming, military and naval books.', '', 'library'],
      ['Read Christian news from many outlets', 'News › ✝ Christian (Vatican, Catholic, Orthodox, Protestant, Ecumenical).', '', 'news'],
      ['Watch the AI think', 'Chat › 💭 Show thinking, under the message box. It also turns thinking on, so replies are slower.', '', 'chat'],
      ['Make a video', 'Studio › 🎬 AI video: one clip, or a long video made shot by shot (use Smooth so each shot continues the last).', '', 'longvideo'],
      ['Stars and planets', 'Education › Sky.', '', 'sky']
    ]],
    ['Being ready', [
      ['Check you are ready for an outage', 'The Prepare tab › 🛟 Ready.', '', 'prepare'],
      ['Emergency cards and contacts', 'Prepare › People, or the hotkey.', 'Ctrl+Alt+E', 'prepare'],
      ['Print the emergency binder', 'Prepare › the binder.', '', 'prepare']
    ]],
    ['Getting around', [
      ['Hide the menus and focus', '⤢ at the right of the top bar.', 'Ctrl+Shift+F', 'keys'],
      ['Jump to a tab', 'The tab bar, or Alt plus a number.', 'Alt+1 … 9', 'keys'],
      ['Settings', '⚙ in the top bar.', 'Ctrl+,', 'settings'],
      ['The guide', '✨ Guide.', 'F1', 'start'],
      ['See the whole app', 'This tab: App map.', '', '']
    ]]
  ];

  /* ---------- helpers ---------- */
  const hl = s => { s = String(s == null ? '' : s); if (!q) return s; const re = new RegExp('(' + q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + ')', 'ig'); return s.split(/(<[^>]+>)/).map(p => p.startsWith('<') ? p : p.replace(re, '<mark>$1</mark>')).join(''); };
  const has = (...xs) => !q || xs.join(' ').toLowerCase().includes(q.toLowerCase());
  const guideLink = id => id ? '<a href="#" data-guide="' + id + '" title="Open this in the Guide">Guide ›</a>' : '';
  const tabBtn = id => A.tabs[id] ? '<button class="ib" data-open="' + id + '">Open ›</button>' : '';
  async function need() {
    if (!M) { try { M = await (await fetch('/api/appmap')).json(); } catch (e) { M = { error: e.message }; } }
  }

  function atlasNodes() {
    const colors = { 'Office':'#5dd9ff','Education':'#a893ff','Personal':'#62e0a4','Entertainment':'#ffc66d','Cyber':'#ff779c','Spiritual':'#d6a4ff','Explore':'#84aaff','Core':'#ffe58b' };
    const nodes = A.order.filter(id => A.tabs[id] && !A.tabs[id].hidden).map(id => {
      const tab = A.tabs[id], nav = (A.NAVGROUPS || []).find(g => g.tabs.includes(id));
      const group = nav ? nav.label : /faith|bible|spiritual/.test(id) ? 'Spiritual' : /home|chat|news/.test(id) ? 'Core' : /brain|globe|map|guide/.test(id) ? 'Explore' : /cyber/.test(id) ? 'Cyber' : 'Explore';
      return { id, label: tab.label || id, group, color: colors[group] || colors.Explore, desc: (M.sections || []).filter(s => s.tabs.some(t => t.id === id)).flatMap(s => s.lists || []).flatMap(l => l.items || []).map(i => i.label).slice(0,5).join(' · ') };
    });
    const phi = Math.PI * (3 - Math.sqrt(5));
    nodes.forEach((n, i) => { const y = 1 - (i / Math.max(1,nodes.length - 1)) * 2, radius = Math.sqrt(1 - y*y), a = phi*i; n.p = [Math.cos(a)*radius, y, Math.sin(a)*radius]; });
    return nodes;
  }
  function initAtlas() {
    const canvas = root.querySelector('#am-atlas-canvas'); if (!canvas || canvas.dataset.ready) return; canvas.dataset.ready = '1';
    const ctx = canvas.getContext('2d'), list = atlasNodes(), tip = root.querySelector('#am-node-info'), legend = root.querySelector('#am-atlas-legend');
    if (!ctx) { canvas.parentElement.innerHTML = '<div class="am-atlas-node">This window cannot start the 3D canvas. Use the tabs and sections reference below.</div>'; return; }
    let yaw = -.38, pitch = .18, zoom = 1, drag = null, hovered = null, selected = null, filter = '', frame = 0, last = 0, dots = [], projected = [];
    const groups = [...new Set(list.map(n => n.group))];
    legend.innerHTML = '<button class="on" data-group="">All sections</button>' + groups.map(g => '<button data-group="' + esc(g) + '" style="--gc:' + list.find(n=>n.group===g).color + '"><i style="display:inline-block;width:8px;height:8px;border-radius:50%;background:' + list.find(n=>n.group===g).color + ';margin-right:5px"></i>' + esc(g) + '</button>').join('');
    legend.onclick = e => { const b=e.target.closest('[data-group]');if(!b)return;filter=b.dataset.group;legend.querySelectorAll('button').forEach(x=>x.classList.toggle('on',x.dataset.group===filter)); };
    function choose(n) { selected=n; tip.innerHTML=n?'<b>' + esc(n.label) + '</b><div class="small mute">' + esc(n.group) + (n.desc?' · '+esc(n.desc):'') + '</div><button class="ib" style="margin-top:8px" data-atlas-open="' + esc(n.id) + '">Open ' + esc(n.label) + ' →</button>':'<b>Moundshroud</b><div class="small mute">Drag to rotate · scroll to zoom · select a glowing section.</div>'; }
    root.querySelector('#ammain').addEventListener('click', e => { const b=e.target.closest('[data-atlas-open]');if(b)A.showTab(b.dataset.atlasOpen); });
    canvas.addEventListener('pointerdown', e => { drag={x:e.clientX,y:e.clientY,yaw,pitch,moved:false};canvas.setPointerCapture(e.pointerId); });
    canvas.addEventListener('pointermove', e => {
      if(drag){const dx=e.clientX-drag.x,dy=e.clientY-drag.y;if(Math.abs(dx)+Math.abs(dy)>4)drag.moved=true;yaw=drag.yaw+dx*.006;pitch=Math.max(-1.15,Math.min(1.15,drag.pitch+dy*.006));return;}
      const r=canvas.getBoundingClientRect(),x=e.clientX-r.left,y=e.clientY-r.top;hovered=projected.slice().reverse().find(p=>Math.hypot(x-p.x,y-p.y)<Math.max(12,p.r+4))?.node||null;canvas.style.cursor=hovered?'pointer':'grab';
    });
    canvas.addEventListener('pointerup', e => { if(!drag)return;const was=drag.moved;drag=null;if(!was){const r=canvas.getBoundingClientRect(),x=e.clientX-r.left,y=e.clientY-r.top,n=projected.slice().reverse().find(p=>Math.hypot(x-p.x,y-p.y)<Math.max(12,p.r+4))?.node;if(n)choose(n);} });
    canvas.addEventListener('wheel', e => { e.preventDefault();zoom=Math.max(.72,Math.min(1.5,zoom*(e.deltaY>0?.92:1.08))); },{passive:false});
    root.querySelector('#am-atlas-reset').onclick=()=>{yaw=-.38;pitch=.18;zoom=1;filter='';legend.querySelectorAll('button').forEach(x=>x.classList.toggle('on',!x.dataset.group));};
    root.querySelector('#am-atlas-search').oninput=e=>{filter=e.target.value.trim().toLowerCase();};
    function resize(){const r=canvas.getBoundingClientRect(),d=Math.min(1.5,window.devicePixelRatio||1);canvas.width=Math.max(1,Math.round(r.width*d));canvas.height=Math.max(1,Math.round(r.height*d));ctx.setTransform(d,0,0,d,0,0);dots=Array.from({length:90},(_,i)=>({x:((i*127.1)%997)/997*r.width,y:((i*311.7)%991)/991*r.height,a:.15+((i*37)%70)/100,s:.4+((i*13)%12)/10}));}
    const ro=new ResizeObserver(resize);ro.observe(canvas);resize();
    function render(ts){if(!canvas.isConnected){cancelAnimationFrame(frame);ro.disconnect();return;}if(!root.closest('.panel.on')){frame=setTimeout(()=>requestAnimationFrame(render),360);return;}frame=requestAnimationFrame(render);if(ts-last<32)return;last=ts;if(!drag)yaw+=.00048;
      const w=canvas.clientWidth,h=canvas.clientHeight,cx=w*.5,cy=h*.51,R=Math.min(w*.36,h*.36)*zoom;ctx.clearRect(0,0,w,h);
      const bg=ctx.createRadialGradient(cx,cy*.9,4,cx,cy,Math.max(w,h)*.72);bg.addColorStop(0,'#111e3b');bg.addColorStop(.48,'#081126');bg.addColorStop(1,'#030711');ctx.fillStyle=bg;ctx.fillRect(0,0,w,h);
      for(const d of dots){ctx.globalAlpha=d.a;ctx.fillStyle='#c6dcff';ctx.beginPath();ctx.arc(d.x,d.y,d.s,0,Math.PI*2);ctx.fill();}ctx.globalAlpha=1;
      const sphere=ctx.createRadialGradient(cx-R*.3,cy-R*.4,R*.02,cx,cy,R*1.15);sphere.addColorStop(0,'rgba(74,139,255,.17)');sphere.addColorStop(.7,'rgba(33,80,162,.08)');sphere.addColorStop(1,'rgba(20,48,103,.01)');ctx.fillStyle=sphere;ctx.beginPath();ctx.arc(cx,cy,R*1.05,0,Math.PI*2);ctx.fill();
      const rot=p=>{let x=p[0],y=p[1],z=p[2],xx=x*Math.cos(yaw)-z*Math.sin(yaw),zz=x*Math.sin(yaw)+z*Math.cos(yaw),yy=y*Math.cos(pitch)-zz*Math.sin(pitch);zz=y*Math.sin(pitch)+zz*Math.cos(pitch);const sc=3.1/(3.65-zz);return{x:cx+xx*R*sc,y:cy+yy*R*sc,z:zz,sc};};
      // faint latitude rings make the depth and rotation legible
      ctx.save();ctx.translate(cx,cy);ctx.strokeStyle='rgba(116,163,255,.11)';ctx.lineWidth=1;for(let k=0;k<3;k++){ctx.beginPath();ctx.ellipse(0,0,R*(.72+k*.12),R*(.17+k*.12),yaw*.18+k*.55,0,Math.PI*2);ctx.stroke();}ctx.restore();
      const center={x:cx,y:cy,z:0,sc:1};projected=[];
      for(const n of list){const p=rot(n.p);p.node=n;p.r=(5+p.sc*3.5)*(n===selected?1.35:1);projected.push(p);}
      // network filaments from each section toward the app core
      for(const p of projected){ctx.beginPath();ctx.moveTo(center.x,center.y);ctx.lineTo(p.x,p.y);ctx.strokeStyle=p.z>-.25?'rgba(132,171,255,.20)':'rgba(132,171,255,.07)';ctx.lineWidth=.7;ctx.stroke();}
      const sorted=projected.slice().sort((a,b)=>a.z-b.z);for(const p of sorted){const n=p.node,match=!filter||n.group===filter||n.label.toLowerCase().includes(filter)||n.id.includes(filter),alpha=match?(p.z<-.25?.38:1):.12,r=p.r;
        if(n===hovered||n===selected){ctx.beginPath();ctx.arc(p.x,p.y,r+8,0,Math.PI*2);ctx.fillStyle=n.color+'33';ctx.fill();}
        ctx.beginPath();ctx.arc(p.x,p.y,r,0,Math.PI*2);const gr=ctx.createRadialGradient(p.x-r*.35,p.y-r*.4,1,p.x,p.y,r*1.3);gr.addColorStop(0,'#fff');gr.addColorStop(.2,n.color);gr.addColorStop(1,'#243c7d');ctx.globalAlpha=alpha;ctx.fillStyle=gr;ctx.shadowBlur=match?15:2;ctx.shadowColor=n.color;ctx.fill();ctx.shadowBlur=0;
        if(p.z>-.42||n===hovered||n===selected){ctx.font=(n===hovered||n===selected?'600 13px':'11px')+' "Segoe UI",sans-serif';ctx.textAlign='center';ctx.fillStyle='rgba(238,245,255,'+alpha+')';ctx.fillText(n.label,p.x,p.y-r-8);}ctx.globalAlpha=1;
      }
      const core=ctx.createRadialGradient(cx-6,cy-8,1,cx,cy,20);core.addColorStop(0,'#ffffff');core.addColorStop(.25,'#d9c9ff');core.addColorStop(1,'#8069ff');ctx.beginPath();ctx.arc(cx,cy,11,0,Math.PI*2);ctx.fillStyle=core;ctx.shadowBlur=24;ctx.shadowColor='#9784ff';ctx.fill();ctx.shadowBlur=0;ctx.textAlign='center';ctx.font='700 11px "Segoe UI",sans-serif';ctx.fillStyle='#eef2ff';ctx.fillText('MOUNDshroud',cx,cy+30);
    }
    choose(null);frame=requestAnimationFrame(render);
  }
  async function loadAtlasModels(){const sel=root.querySelector('#am-ai-model');if(!sel)return;const r=await A.api('/api/models').catch(()=>null),rows=((r&&r.models)||[]).filter(x=>x&&!x.cloud&&x.name&&x.name!=='free-auto');sel.innerHTML=rows.length?rows.map(x=>'<option value="'+esc(x.name)+'"'+(x.name===r.defaultModel?' selected':'')+'>'+esc(x.label||x.name)+'</option>').join(''):'<option value="">No local model available</option>';}
  function initAtlasAssistant(){const log=root.querySelector('#am-ai-log'),input=root.querySelector('#am-ai-input'),send=root.querySelector('#am-ai-send');if(!log||log.dataset.ready)return;log.dataset.ready='1';let messages=[];
    const paint=()=>{log.innerHTML=messages.map(x=>'<div class="am-atlas-msg '+(x.role==='user'?'user':'')+'"><b>'+(x.role==='user'?'You':'Moundshroud')+'</b><div>'+esc(x.content)+'</div></div>').join('')||'<div class="small mute">Ask where something lives, how a feature works, or say “open Studio”.</div>';log.scrollTop=log.scrollHeight;};
    const submit=async()=>{const ask=input.value.trim(),model=root.querySelector('#am-ai-model').value;if(!ask)return;if(!model){messages.push({role:'assistant',content:'I need an installed local model to answer here. You can still explore the map and open any section.'});paint();return;}messages.push({role:'user',content:ask});input.value='';paint();send.disabled=true;send.textContent='Thinking…';
      const intent=ask.match(/(?:open|go to|take me to|show me)\s+(.+)/i);if(intent){const needle=intent[1].replace(/[.!?]+$/,'').toLowerCase(),n=atlasNodes().find(x=>x.id===needle||x.label.toLowerCase()===needle||x.label.toLowerCase().includes(needle));if(n){messages.push({role:'assistant',content:'Opening '+n.label+'.'});paint();await A.showTab(n.id);send.disabled=false;send.textContent='Send';return;}}
      const appGuide=(A.appMap&&A.appMap.reference?A.appMap.reference():'')+'\n\nCurrent app sections: '+A.order.filter(id=>A.tabs[id]).map(id=>id+' — '+A.tabs[id].label).join(', ');const system='You are the friendly Moundshroud App Map guide. Answer questions using only the reference below; if it does not say, say so. Keep answers clear and short. You can help the user find sections by name, but never claim to operate or change settings.\n\nREFERENCE:\n'+appGuide.slice(0,42000);try{const r=await A.api('/api/chat',{model,messages:[{role:'system',content:system},...messages.slice(-10)],stream:false});const out=r&&(r.message&&r.message.content||r.choices&&r.choices[0]&&r.choices[0].message&&r.choices[0].message.content||r.response);if(!out)throw new Error(r&&r.error||'No answer returned.');messages.push({role:'assistant',content:String(out)});}catch(e){messages.push({role:'assistant',content:'I could not reach that local model: '+(e.message||'check that it is running.')});}send.disabled=false;send.textContent='Send';paint();};
    send.onclick=submit;input.addEventListener('keydown',e=>{if(e.key==='Enter'&&!e.shiftKey){e.preventDefault();submit();}});root.querySelector('#am-ai-clear').onclick=()=>{messages=[];paint();};paint();loadAtlasModels();
  }

  /* ---------- the sections ---------- */
  const views = {
    async overview(m) {
      await need(); const S = M.services || [];
      const tabs = A.order.filter(t => A.tabs[t]).length, gl = A.guide && A.guide.list ? A.guide.list().length : 0;
      m.innerHTML = '<div class="am-atlas-head"><div style="flex:1;min-width:220px"><h2>🗺️ Moundshroud Atlas</h2><div class="small mute">A live, interactive 3D map of the app. Drag to orbit, scroll to zoom, and select a glowing section to open it.</div></div><button class="ib" data-open="globe">🌍 Open real-world globe</button><button class="ib" data-refresh>↻ Refresh map</button></div>' +
        '<div class="am-atlas-layout"><div><div class="am-atlas-stage"><canvas class="am-atlas-canvas" id="am-atlas-canvas" aria-label="Interactive 3D map of Moundshroud sections"></canvas><div class="am-atlas-hud"><span class="am-atlas-title">✦ MOUNDshroud · LIVE SYSTEM MAP</span><span class="am-atlas-hint">drag · orbit · scroll to zoom</span></div><div class="am-atlas-legend" id="am-atlas-legend"></div></div><div class="am-atlas-node" id="am-node-info"><b>Moundshroud</b><div class="small mute">Drag to rotate · scroll to zoom · select a glowing section.</div></div><div class="row" style="gap:8px;margin-top:8px;flex-wrap:wrap"><input id="am-atlas-search" type="search" placeholder="Find a section on the map…" style="flex:1;min-width:180px"><button class="ib" id="am-atlas-reset">⟲ Reset view</button></div></div>' +
        '<aside class="am-atlas-side"><div class="am-atlas-sidehead"><div style="display:flex;align-items:center;gap:8px"><span style="font-size:21px">🤖</span><div style="flex:1"><b>Ask the App Map</b><div class="small mute">A private guide to Moundshroud</div></div><button class="ib" id="am-ai-clear">Clear</button></div><div class="row" style="margin-top:8px"><span class="small mute">Local model</span><select id="am-ai-model" style="max-width:100%;flex:1"><option>Finding installed models…</option></select></div></div><div class="am-atlas-log" id="am-ai-log" aria-live="polite"></div><div class="am-atlas-compose"><textarea id="am-ai-input" rows="2" placeholder="Where is something? How does a feature work? Or: open Studio"></textarea><button class="pri" id="am-ai-send">Send</button></div></aside></div>' +
        '<div class="am-atlas-stats">' + [['App sections', tabs], ['Guide topics', gl], ['Code files', (M.files || []).length], ['Server routes', (M.endpoints || []).length], ['Version', M.version || '?'], ['This PC', (M.cpus || '?') + ' CPU · ' + (M.ramGB || '?') + ' GB RAM']].map(([a,b]) => '<div class="am-atlas-stat"><span class="small mute">' + a + '</span><b style="display:block;font-size:19px">' + esc(String(b)) + '</b></div>').join('') + '</div>' +
        '<div class="am-card"><h4>How it fits together</h4><div class="am-flow">' +
        '<div class="am-box"><b>🪟 The window</b><span class="small">Microsoft Edge in app mode with its own private profile. It talks to the Moundshroud server on this PC.</span></div>' +
        '<div class="am-box"><b>🧠 The server</b><span class="small">Node.js reads and writes your files, runs local helpers, and handles the online features you switch on.</span></div>' +
        '<div class="am-box"><b>🤖 AI engine</b><span class="small">Ollama runs language models locally. Optional online providers are listed under Outside connections.</span></div>' +
        '<div class="am-box"><b>📚 Library engine</b><span class="small">Kiwix opens offline books inside the window.</span></div>' +
        '<div class="am-box"><b>🗣 Voices</b><span class="small">Piper reads aloud; whisper.cpp turns speech into text. Both run on this PC.</span></div>' +
        '<div class="am-box"><b>⌨ Hotkey helper</b><span class="small">The tray icon and Ctrl+Alt shortcuts that work anywhere in Windows.</span></div>' +
        '<div class="am-box"><b>♟ Creative tools</b><span class="small">Stockfish, picture and music makers, LibreOffice and other specialists when installed.</span></div>' +
        '<div class="am-box"><b>🌐 Outside world</b><span class="small">Only the connections you switch on. See Outside connections for details.</span></div></div></div>' +
        '<div class="am-card"><h4>Running parts</h4>' + S.map(s => '<div style="padding:3px 0"><span class="am-dot" style="background:' + (s.up ? 'var(--ok)' : '#555c70') + '"></span><b>' + esc(s.name) + '</b> <span class="small mute">' + (s.up ? 'running' : 'not running (starts when needed)') + '</span></div>').join('') + '</div>' +
        '<div class="am-card"><h4>Where it lives</h4><div class="small">Moundshroud folder: <code>' + esc(M.root || '') + '</code><br>Your documents and notes: ' + (M.docs || []).map(d => '<code>' + esc(d) + '</code>').join(', ') + '<br>Node ' + esc(M.node || '') + ' · ' + esc(M.os || '') + '</div></div>';
    },
    async tabs(m) {
      await need();
      const secsByFile = M.sections || [], groupOf = t => (A.NAVGROUPS || []).find(g => g.tabs.includes(t));
      const lists = t => secsByFile.filter(s => s.tabs.some(x => x.id === t)).flatMap(s => s.lists);
      const glist = A.guide && A.guide.list ? A.guide.list() : [];
      const guideFor = label => { const l = label.toLowerCase(); const g = glist.find(x => x.title.toLowerCase().includes(l.split(' ')[0])); return g ? g.id : ''; };
      const rows = A.order.filter(t => A.tabs[t]).map(t => {
        const T = A.tabs[t], g = groupOf(t), ls2 = lists(t), sub = ls2.flatMap(l => l.items.map(i => i.label));
        if (!has(T.label, t, sub.join(' '), g ? g.label : '')) return '';
        return '<div class="am-card"><div style="display:flex;gap:8px;align-items:center"><b style="font-size:15px;flex:1">' + (A.NAVIC[t] || '') + ' ' + hl(esc(T.label)) + (g ? ' <span class="small mute">in ' + esc(g.icon + ' ' + g.label) + '</span>' : '') + '</b>' + guideLink(guideFor(T.label)) + ' ' + tabBtn(t) + '</div>' +
          (ls2.length ? ls2.map(l => '<div style="margin-top:6px">' + l.items.map(i => '<span class="am-pill">' + hl(esc(i.label)) + '</span>').join('') + '</div>').join('') : '<div class="small mute" style="margin-top:4px">One page.</div>') + '</div>';
      }).join('');
      m.innerHTML = '<h2 style="margin:0 0 4px">🗂 Tabs and their sections</h2><p class="mute" style="margin:0 0 12px">Every tab in the order of the tab bar, the menu it sits in, and the sections inside it (read from the code).</p>' + (rows || '<div class="mute">Nothing matches.</div>') +
        '<div class="am-card"><h4>Other parts</h4><div class="small" style="line-height:1.7">⚙ Settings (Ctrl+,) · 🔎 Search everything (Ctrl+K) · 🦉 your buddy (bottom-left) · ✨ Guide (F1) · ⤢ Focus mode (Ctrl+Shift+F) · the tray icon and Windows hotkeys · the presentation and walkthroughs</div></div>';
    },
    ref(m) {
      m.innerHTML = '<div style="display:flex;gap:8px;align-items:center"><h2 style="margin:0;flex:1">📋 Reference sheet</h2><button class="ib am-noprint" data-print>🖨 Print</button></div><p class="mute" style="margin:4px 0 12px;max-width:860px">How to set Moundshroud up and how to do everything in it, one line each. “Guide ›” opens the full explanation.</p>' +
        REF.map(([g, rows]) => { const r = rows.filter(x => has(g, x[0], x[1], x[2])); if (!r.length) return ''; return '<div class="am-card"><h4>' + esc(g) + '</h4><table class="am-t"><tr><th style="width:30%">To…</th><th>Where / how</th><th style="width:120px">Shortcut</th><th style="width:60px"></th></tr>' + r.map(x => '<tr><td><b>' + hl(esc(x[0])) + '</b></td><td>' + hl(x[1]) + '</td><td>' + (x[2] ? '<kbd>' + hl(esc(x[2])) + '</kbd>' : '') + '</td><td>' + guideLink(x[3]) + '</td></tr>').join('') + '</table></div>'; }).join('');
    },
    keys(m) {
      const K = (A.guide && A.guide.keys ? A.guide.keys() : []).filter(k => has(k[0], k[1]));
      m.innerHTML = '<h2 style="margin:0 0 12px">⌨ Shortcuts</h2><div class="am-card"><table class="am-t"><tr><th style="width:200px">Keys</th><th>What it does</th></tr>' + K.map(k => '<tr><td><kbd>' + hl(esc(k[0])) + '</kbd></td><td>' + hl(k[1]) + '</td></tr>').join('') + '</table></div><p class="small mute">Ctrl+Alt shortcuts work anywhere in Windows while the tray helper is running; the rest work inside the window.</p>';
    },
    settings(m) {
      const S2 = [['appearance', '🎨 Appearance', 'The look: modern or classic, grouped tab bar, themes, styles, fonts, motion.'], ['voice', '🔊 Voice & sound', 'The read-aloud voice, speed and pitch; game sounds and theme music volumes.'], ['buddy', '🦉 Your buddy', 'The companion in the corner.'], ['ai', '🧠 AI & power', 'Low-power mode, internet access, Claude, model behaviour.'], ['privacy', '🔒 Privacy', 'Everything that can leave this PC, with its switch.'], ['chess', '♟ Chess', 'Board, pieces, sounds, clock, premoves.'], ['games', '🎮 Games & cards', 'Game options.'], ['help', '🧭 Walkthroughs & help', 'The tours and walkthroughs.'], ['data', '💾 Backup & data', 'Backups, restore, the self-test, the problem log, storage.'], ['keys', '⌨ Shortcuts & about', 'The shortcuts, version and about.']].filter(x => has(x[1], x[2]));
      m.innerHTML = '<h2 style="margin:0 0 12px">⚙ Settings</h2>' + S2.map(([id, t, d]) => '<div class="am-card" style="display:flex;gap:10px;align-items:center"><div style="flex:1"><b>' + hl(esc(t)) + '</b><div class="small mute">' + hl(esc(d)) + '</div></div><button class="ib" data-set="' + id + '">Open ›</button></div>').join('');
    },
    async data(m) {
      await need();
      const keys = []; try { for (let i = 0; i < localStorage.length; i++) { const k = localStorage.key(i), v = localStorage.getItem(k) || ''; keys.push({ k, b: (k.length + v.length) * 2 }); } } catch (e) { }
      const area = k => { const s = k.replace(/^oa_/, ''); return /^(news|mk_)/.test(s) ? (s.startsWith('mk_') ? 'Markets' : 'News') : /^(chess|cb|ch)/.test(s) ? 'Chess' : /^(money)/.test(s) ? 'Money' : /^(journal|jr)/.test(s) ? 'Journal' : /^(lang|lg)/.test(s) ? 'Languages' : /^imperium/.test(k) ? 'Imperium' : /^(music|ml|mx)/.test(s) ? 'Music' : /^(kitchen|garden|cal|study|notes|fav)/.test(s) ? s.replace(/[_\d].*$/, '').replace(/^\w/, c => c.toUpperCase()) : 'Other settings'; };
      const byArea = {}; keys.forEach(x => { const a = area(x.k); (byArea[a] = byArea[a] || { n: 0, b: 0, keys: [] }); byArea[a].n++; byArea[a].b += x.b; byArea[a].keys.push(x.k); });
      const D = (M.data || []).filter(d => has(d.name, d.note));
      m.innerHTML = '<h2 style="margin:0 0 4px">💾 Where your things are kept</h2><p class="mute" style="margin:0 0 12px;max-width:860px">Everything stays on this PC. Three places hold it: the <b>data</b> folder (the server’s files), the <b>window’s storage</b> (settings and the things each tab keeps in the browser), and your <b>Documents</b> folder (documents and notes you make). Backups (Settings › Backup & data) copy all three.</p>' +
        '<div class="am-card"><h4>The data folder · ' + esc((M.root || '') + '\\data') + '</h4><table class="am-t"><tr><th>File</th><th>What it holds</th><th style="width:90px">Size</th></tr>' + D.map(d => '<tr><td><code>' + hl(esc(d.name)) + (d.dir ? '\\' : '') + '</code></td><td>' + hl(esc(d.note || '')) + '</td><td>' + gbs(d.bytes) + '</td></tr>').join('') + '</table></div>' +
        '<div class="am-card"><h4>The window’s storage (' + keys.length + ' entries, ' + gbs(keys.reduce((a, x) => a + x.b, 0)) + ')</h4><table class="am-t"><tr><th>Area</th><th>Entries</th><th>Size</th></tr>' + Object.entries(byArea).filter(([a, v]) => has(a, v.keys.join(' '))).sort((a, b) => b[1].b - a[1].b).map(([a, v]) => '<tr><td><b>' + hl(esc(a)) + '</b><div class="small mute" style="max-width:640px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">' + esc(v.keys.slice(0, 12).join(', ')) + (v.keys.length > 12 ? '…' : '') + '</div></td><td>' + v.n + '</td><td>' + gbs(v.b) + '</td></tr>').join('') + '</table></div>' +
        '<div class="am-card"><h4>Your Documents</h4><div class="small">' + ((M.docs || []).map(d => '<code>' + esc(d) + '</code>').join('<br>') || 'Nothing made yet.') + '</div></div>';
    },
    async downloads(m) {
      m.innerHTML = '<h2 style="margin:0 0 4px">📦 Everything downloaded</h2><p class="mute">Measuring…</p>';
      if (!INV) { try { INV = await A.api('/api/inv'); } catch (e) { INV = { groups: [] }; } }
      m.innerHTML = '<div style="display:flex;gap:8px;align-items:center"><h2 style="margin:0;flex:1">📦 Everything downloaded · ' + gbs(INV.total || 0) + '</h2><button class="ib" data-stock>Manage in Stock up ›</button></div><p class="mute" style="margin:4px 0 12px">Add, re-download or remove any of it in Prepare › Stock up (removing asks first).</p>' +
        (INV.groups || []).map(g => { const it = g.items.filter(i => has(g.name, i.name, i.sub)); if (!it.length && q) return ''; return '<div class="am-card"><h4>' + esc(g.name) + ' · ' + gbs(g.bytes) + ' · ' + g.items.length + '</h4><div class="small mute" style="margin-bottom:6px">' + esc(g.note) + ' <code>' + esc(g.where) + '</code></div>' + it.slice().sort((a, b) => b.bytes - a.bytes).slice(0, q ? 200 : 12).map(i => '<div class="small" style="display:flex;gap:8px;padding:2px 0"><span style="flex:1">' + hl(esc(i.name)) + ' <span class="mute">' + hl(esc(i.sub || '')) + '</span></span><span>' + gbs(i.bytes) + '</span></div>').join('') + (!q && it.length > 12 ? '<div class="small mute">… and ' + (it.length - 12) + ' more (search to see them all)</div>' : '') + '</div>'; }).join('');
    },
    async outside(m) {
      if (!PRV) { try { PRV = await A.api('/api/privacy'); } catch (e) { PRV = {}; } }
      const on = !!PRV.internet;
      const rows = [['Internet access switch', on ? 'On' : 'Off', 'Web search (DuckDuckGo), reading pages, News › Research, News feeds from each outlet, Markets (CNBC, Yahoo Finance, the SEC, the Treasury, FRED), the weather (Open-Meteo).'], ['News through Google', PRV.news && PRV.news.google ? 'On' : 'Off', 'AP, Reuters, CNN and USA Today headlines through Google News.'], ['Claude', PRV.claude ? 'Connected' : 'Not connected', 'Chats where you pick a Claude model go to Anthropic.'], ['Stock up downloads', 'When you press Download', 'Kiwix library, the Ollama model library, Hugging Face (voices, voice typing), GitHub (Stockfish, CyberChef, the picture maker), the Internet Archive (music), the Tor Project (Tor Browser, checked against its published fingerprint).'], ['Lichess', 'Only when you connect it', 'lichess.org: your moves, chat and challenges in real games, with your own token.'], ['Mail', 'When you open Mail', 'Your own email provider, encrypted (IMAP). Nothing is ever sent; drafts are saved to your Drafts folder.'], ['Pictures in an email', 'Only when you press Show pictures', 'The sites the email’s pictures are on, fetched by Moundshroud without cookies.'], ['Tor Browser', 'Only when you open it', 'Its own separate program and connection, through the Tor network. Moundshroud does not see or keep what you do in it.'], ['Online read-aloud voices', ls.get('online_voices', '0') === '1' ? 'Allowed' : 'Off', 'Windows’ online voices send the text to Microsoft.'], ['Links you open', 'When you click', 'Open in the window’s own browser profile, with no referrer, third-party cookies blocked and Do Not Track sent.']].filter(r => has(r[0], r[2]));
      m.innerHTML = '<div style="display:flex;gap:8px;align-items:center"><h2 style="margin:0;flex:1">🌐 Everything that can reach the internet</h2><button class="ib" data-set="privacy">Privacy settings ›</button></div><p class="mute" style="margin:4px 0 12px">Nothing else does. No accounts, analytics, ads, update checks or crash reports.</p><div class="am-card"><table class="am-t"><tr><th>What</th><th style="width:150px">Now</th><th>Goes to</th></tr>' + rows.map(r => '<tr><td><b>' + hl(esc(r[0])) + '</b></td><td>' + esc(r[1]) + '</td><td>' + hl(esc(r[2])) + '</td></tr>').join('') + '</table></div>';
    },
    async running(m) {
      M = null; await need();
      m.innerHTML = '<div style="display:flex;gap:8px;align-items:center"><h2 style="margin:0;flex:1">🔌 Running parts</h2><button class="ib" data-refresh>↻ Check again</button></div><p class="mute" style="margin:4px 0 12px">The programs Moundshroud uses, and whether each is running now. Most start only when needed and stop when Moundshroud closes.</p><div class="am-card"><table class="am-t"><tr><th>Part</th><th>What it does</th><th>Where</th><th>Now</th></tr>' + (M.services || []).filter(s => has(s.name, s.what, s.where)).map(s => '<tr><td><b>' + hl(esc(s.name)) + '</b></td><td>' + hl(esc(s.what)) + '</td><td><code>' + esc(s.where) + '</code></td><td><span class="am-dot" style="background:' + (s.up ? 'var(--ok)' : '#555c70') + '"></span>' + (s.up ? 'running' : 'stopped') + '</td></tr>').join('') + '</table></div>';
    },
    async code(m) {
      await need();
      const F = (M.files || []).filter(f => has(f.path, f.desc)), groups = {};
      F.forEach(f => { const g = f.path.includes('/') ? f.path.replace(/\/[^/]+$/, '') : '(the Moundshroud folder)'; (groups[g] = groups[g] || []).push(f); });
      m.innerHTML = '<h2 style="margin:0 0 4px">🧱 Code files (' + F.length + ')</h2><p class="mute" style="margin:0 0 12px;max-width:860px">Every file Moundshroud is made of, with the description written at its top. <b>web</b> is the window (one file per feature), <b>lib</b> is the server’s modules, <b>web/games</b> the games, <b>py</b> the Python helpers, <b>tests</b> the automatic checks.</p>' +
        Object.entries(groups).map(([g, fs2]) => '<details class="am-card"' + (q ? ' open' : '') + '><summary style="cursor:pointer"><b>' + esc(g) + '</b> <span class="small mute">' + fs2.length + ' files · ' + gbs(fs2.reduce((a, f) => a + f.bytes, 0)) + '</span></summary><table class="am-t" style="margin-top:6px">' + fs2.sort((a, b) => a.path.localeCompare(b.path)).map(f => '<tr><td style="width:230px"><code>' + hl(esc(f.path.split('/').pop())) + '</code><div class="small mute">' + gbs(f.bytes) + '</div></td><td class="small">' + hl(esc(f.desc || '')) + '</td></tr>').join('') + '</table></details>').join('');
    },
    async api(m) {
      await need();
      const E = (M.endpoints || []).filter(e => has(e.path, e.group, e.method)), groups = {};
      E.forEach(e => { (groups[e.group] = groups[e.group] || []).push(e); });
      m.innerHTML = '<h2 style="margin:0 0 4px">🔗 Server addresses (' + E.length + ')</h2><p class="mute" style="margin:0 0 12px;max-width:860px">Everything the Moundshroud server answers, grouped as in <code>server.js</code>. It only answers this PC, and only the Moundshroud window (requests from any web page are refused).</p>' +
        Object.entries(groups).map(([g, es]) => '<div class="am-card"><h4>' + esc(g) + '</h4>' + es.map(e => '<div class="small" style="padding:2px 0"><span class="am-pill">' + e.method + '</span><code>' + hl(esc(e.path)) + '</code></div>').join('') + '</div>').join('');
    }
  };

  function shell() {
    root.innerHTML = '<div class="am"><div class="am-nav"><input id="amq" placeholder="Search the whole app…" style="width:100%;margin-bottom:8px" value="' + esc(q) + '">' + SECS.map(([k, l]) => '<button data-s="' + k + '"' + (k === sec ? ' class="on"' : '') + '>' + l + '</button>').join('') + '</div><div class="am-main" id="ammain"></div></div>';
    root.querySelector('.am-nav').onclick = e => { const b = e.target.closest('[data-s]'); if (!b) return; sec = b.dataset.s; ls.set('map_sec', sec); root.querySelectorAll('.am-nav [data-s]').forEach(x => x.classList.toggle('on', x.dataset.s === sec)); draw(); };
    let t = 0; root.querySelector('#amq').oninput = e => { clearTimeout(t); t = setTimeout(() => { q = e.target.value.trim(); draw(); }, 200); };
    root.querySelector('#ammain').onclick = e => {
      const o = e.target.closest('[data-open]'); if (o) { A.showTab(o.dataset.open); return; }
      const g = e.target.closest('[data-guide]'); if (g) { e.preventDefault(); A.showTab('guide'); setTimeout(() => { const el = document.getElementById('g-' + g.dataset.guide); if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' }); }, 250); return; }
      const st = e.target.closest('[data-set]'); if (st) { A.settings.open(st.dataset.set); return; }
      if (e.target.closest('[data-stock]')) { if (A.prep && A.prep.open) A.prep.open('stock'); else A.showTab('health'); return; }
      if (e.target.closest('[data-print]')) { window.print(); return; }
      if (e.target.closest('[data-refresh]')) { draw(); }
    };
  }
  /* each drawing works in its own box; a slow one that finishes after you have moved on is thrown away */
  let drawTok = 0;
  async function draw() {
    const main = root.querySelector('#ammain'); if (!main) return;
    const my = ++drawTok, box = document.createElement('div');
    main.innerHTML = '<div class="mute">' + (sec === 'downloads' ? 'Measuring everything on this PC (the first time after a start takes about 15 seconds)…' : 'Loading…') + '</div>';
    try { await views[sec](box); } catch (e) { box.innerHTML = '<div class="am-card" style="color:var(--bad)">' + esc(e.message) + '</div>'; }
    if (my !== drawTok) return;
    main.innerHTML = ''; main.appendChild(box); main.scrollTop = 0;
    if (sec === 'overview') { initAtlas(); initAtlasAssistant(); }
  }
  /* every task on the reference sheet is also a "How do I…" command in Ctrl+K, which takes you straight there */
  function goTo(where, task) {
    const w = where.replace(/<[^>]+>/g, ''), has2 = re => re.test(w);
    const tab = t => A.showTab(t), news = v => { A.showTab('news'); if (v) setTimeout(() => { const b = document.querySelector('#p-news [data-a="' + v + '"], #p-news [data-c="' + v + '"]'); if (b) b.click(); }, 150); };
    if (has2(/Stock up/)) return A.prep.open('stock');
    /* the tabs and sections of the October 2026 layout (regroup.js) */
    if (has2(/Library › 📘 Wikibooks/)) return A.wikibooks.open();
    if (has2(/Library › Timeline|Timeline/)) return A.library.timeline();
    if (has2(/Office › Office files/)) return tab('offed'); if (has2(/Calculator/)) return tab('calc'); if (has2(/Scanner/)) return tab('scan'); if (has2(/Clipboard/)) return tab('clip');
    if (has2(/Education › Writing|Writing coach/)) return tab('writing'); if (has2(/Education › Practice/)) return tab('practice'); if (has2(/Teach me/)) return tab('teach'); if (has2(/Personal › Albums|Albums/)) return tab('albums');
    if (has2(/Cyber › 💻 Coding/)) return A.cybertab.go('code'); if (has2(/Cyber › Cyber games/)) return A.cybertab.go('games'); if (has2(/Cyber › Cyber Lab/)) return A.cybertab.go('cyber'); if (has2(/Cyber › Code Breaker/)) return A.cybertab.go('codes'); if (has2(/CyberChef/)) return A.cybertab.go('chef'); if (has2(/^Cyber|Cyber ›/)) return A.cybertab.go('course');
    if (has2(/Puzzle maker/)) return A.play.open('puzz'); if (has2(/Languages › Translate|Translate/)) return A.lang.translate(); if (has2(/Prepare › Prompts|Prompt library/)) return A.prep.open('prm');
    if (has2(/Cyber › Passwords/)) return A.tools.go('vault'); if (has2(/Entertainment › Photos/)) return tab('photos'); if (has2(/Office › Mail/)) return tab('mail'); if (has2(/What the AI remembers/)) return A.memory && A.memory.manage();
    if (has2(/^Settings|Settings ›|⚙ in the top bar/)) { const m = w.match(/Settings › ([^,.(]+)/), sec = m ? m[1].trim() : ''; const id = /Privacy/.test(sec) ? 'privacy' : /AI/.test(sec) ? 'ai' : /Voice/.test(sec) ? 'voice' : /Appearance/.test(sec) ? 'appearance' : /Backup/.test(sec) ? 'data' : undefined; return A.settings.open(id); }
    if (has2(/Markets/)) return news('markets'); if (has2(/Beats/)) return news('beats'); if (has2(/⚙ Sources/)) return news('sources'); if (has2(/Research/)) return news('research');
    if (has2(/^News|News ›|an event|search box › 🗄/)) return news('');
    if (has2(/Office › Documents|Documents/)) return A.tools.go('docs'); if (has2(/File converter/)) return A.tools.go('conv'); if (has2(/Reminders/)) return A.tools.go('rem'); if (has2(/Meeting notes/)) return A.tools.go('meet');
    if (has2(/My Files/)) return tab('files'); if (has2(/Notes/)) return tab('notes'); if (has2(/Library|Browser/)) return tab(has2(/Browser/) ? 'web' : 'lib');
    if (has2(/Study/)) return tab('study'); if (has2(/Languages/)) return tab('lang'); if (has2(/Studio/)) return tab('studio'); if (has2(/Sky/)) return tab('sky');
    if (has2(/Kitchen/)) return tab('kitchen'); if (has2(/Money/)) return tab('money'); if (has2(/Journal/)) return tab('journal'); if (has2(/Calendar/)) return tab('cal');
    if (has2(/› TV/)) return tab('tv');
    if (has2(/Radio/)) return tab('radio');
    if (has2(/Music/)) return tab('music'); if (has2(/Photos/)) return tab('photos'); if (has2(/Games|Entertainment/)) return tab('play'); if (has2(/Spiritual/)) return tab('faith');
    if (has2(/Prepare/)) return A.prep.open(has2(/People/) ? 'people' : 'ready');
    if (has2(/Guide|F1/)) return tab('guide'); if (has2(/^Chat|in Chat|Just ask/)) return tab('chat');
    sec = 'ref'; ls.set('map_sec', 'ref'); q = task; tab('map'); setTimeout(() => { const i = root.querySelector('#amq'); if (i) i.value = task; draw(); }, 80);
  }
  try {
    if (A.cmd && A.cmd.reg) A.cmd.reg(REF.flatMap(([g, rows]) => rows.map(x => ({ title: 'How do I: ' + x[0].replace(/^\w/, c => c.toLowerCase()) + '?', sub: x[1].replace(/<[^>]+>/g, '').slice(0, 110), icon: '❓', group: 'How do I', keys: x[2] || undefined, tags: 'how do i where is help find ' + g + ' ' + x[0] + ' ' + x[1].replace(/<[^>]+>/g, ''), run: () => goTo(x[1], x[0]) }))).concat([{ title: 'App map', sub: 'The whole app laid out: tabs, how-to, data, downloads, files', icon: '🗺️', group: 'Go to', tags: 'app map structure skeleton reference sheet how everything', run: () => A.showTab('map') }]));
  } catch (e) { }
  A.registerTab('map', 'App map', () => { if (!root.querySelector('.am')) shell(); INV = null; PRV = null; draw(); });
  A.appMap = { reference: () => REF.map(([g, rows]) => g + ':\n' + rows.map(x => '- ' + x[0] + ': ' + x[1].replace(/<[^>]+>/g, '') + (x[2] ? ' (' + x[2] + ')' : '')).join('\n')).join('\n'), open: s => { if (s) { sec = s; ls.set('map_sec', s); } A.showTab('map'); } };
})();

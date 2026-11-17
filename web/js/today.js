// Today: a home page that pulls together what matters right now (greeting, day of the church year, reminders, cards due, streaks, where you left off,
// backup and disk warnings, a tip) and quick doors to every tab. Everything is read from data already on this PC; nothing is stored here.
(() => {
  const root = document.getElementById('p-home'); if (!root) return;
  const esc2 = s => String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const TIPS = [
    ['Ctrl+K searches everything', 'Press <kbd>Ctrl</kbd>+<kbd>K</kbd> to search chats, notes, files and the library at once, or to run a command like "Start the tutorial".', 'top bar'],
    ['Ask Moundshroud to act', 'In Chat, say "make me a 10 question quiz on the French Revolution" or "remind me to call Sam tomorrow at 9" and it does it.', 'Ask Moundshroud to do things'],
    ['Open pages in tabs', 'In the Library, hold Ctrl and click a link to open it in a new tab. Alt+Left and Alt+Right go back and forward.', 'Tabs, back and forward'],
    ['Star what you want to keep', 'Press ☆ in the Library or Search and sort favorites into folders from ⭐ Favorites.', 'Favorites and folders'],
    ['Read the Bible your way', 'In Spiritual > Bible, switch to the World English Bible and "Read in paragraphs" for flowing, easy text.', 'Bible: three translations'],
    ['Cook from your pantry', 'Kitchen: type what is in your pantry and Moundshroud finds old recipes that use it.', 'Recipes'],
    ['Make a mood trail', 'The Journal tab (in Life) keeps a private diary with a mood calendar and a one-press weekly reflection.', 'Journal'],
    ['See where the space goes', 'Settings > Backup & data shows what uses your disk and lets you clear space safely.', 'Storage'],
    ['Chess opponents talk back', 'In Chess > Play the opponent reacts to your actual moves. Change how often with the Chattiness setting.', 'Play: play Moundshroud'],
    ['Premove online', 'In Chess > Online, drop a piece while your opponent is still thinking to premove, like chess.com.', 'Online simulator'],
    ['Make flashcards from anything', 'Hover a Chat answer, or use Ask AI in the Library, and press Make flashcards.', 'Study: decks'],
    ['Import your own music', 'Music > My songs takes a folder of MP3s. Music > Record captures your microphone.', 'My songs'],
    ['Press F1 for help', 'The Guide has a search box and a What\'s new list; the Full presentation walks through every tab.', 'How this presentation'],
    ['Back up your progress', 'Settings > Backup & data exports your favorites, bookmarks, chess profile and more in one file.', 'Storage'],
  ];
  const greet = () => { const h = new Date().getHours(); return h < 5 ? 'Still up' : h < 12 ? 'Good morning' : h < 18 ? 'Good afternoon' : 'Good evening'; };
  const DAYS = 864e5;
  const streakStudy = () => { try { const d = new Set(JSON.parse(ls.get('studydays', '[]'))), k = t => new Date(t).toISOString().slice(0, 10), off = new Date().getTimezoneOffset() * 6e4; let n = 0, t = Date.now() - off; if (!d.has(k(t))) t -= DAYS; while (d.has(k(t))) { n++; t -= DAYS; } return n; } catch (e) { return 0; } };
  const TILES = [['chat', '💬', 'Chat', 'Ask anything'], ['web', '🌐', 'Browser', 'Search the offline internet'], ['lib', '📚', 'Library', 'Classics and chess books'], ['notes', '📝', 'Notes', 'Write it down'], ['study', '🎓', 'Study', 'Cards and quizzes'], ['health', '🛟', 'Prepare', 'Plans, first aid, recipes'], ['play', '🎭', 'Entertainment', 'Games and chess'], ['music', '🎼', 'Music', 'Your library'], ['radio', '📻', 'Radio', 'Live stations'], ['tv', '📺', 'TV', 'Channels and YouTube'], ['faith', '✝️', 'Spiritual', 'Bible and prayer'], ['journal', '📓', 'Journal', 'Mood and thoughts']];
  /* the Moundshroud logo, large and bold at the top of Today: a copy of the header's own drawing (same gradients), with a heavier gold edge on the M and a glow */
  const logo = () => { const m = document.querySelector('header svg.mark'); if (!m) return ''; const c = m.cloneNode(true); c.removeAttribute('width'); c.removeAttribute('height'); c.removeAttribute('style'); c.setAttribute('class', 'mark td-logo'); c.setAttribute('aria-label', 'Moundshroud'); return '<div class="td-logobox">' + c.outerHTML + '<div class="td-logoname">Moundshroud</div></div>'; };
  const css = '.td-logobox{display:flex;flex-direction:column;align-items:center;gap:4px;flex:none}.td-logo{width:112px;height:112px;filter:drop-shadow(0 6px 18px rgba(139,124,255,.55)) drop-shadow(0 0 2px rgba(242,199,92,.6))}.td-logo .mk-mf{stroke:#ffe9a3;stroke-width:2.6;stroke-opacity:1;paint-order:stroke}.td-logo .mk-m>path:first-child{opacity:.75}.td-logoname{font-weight:900;font-size:15px;letter-spacing:.6px;background:linear-gradient(180deg,#fff6cf,#f2c75c 55%,#b17a12);-webkit-background-clip:text;background-clip:text;color:transparent}.td-wrap{max-width:1100px;margin:0 auto}.td-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(250px,1fr));gap:12px}.td-card{background:var(--panel);border:1px solid var(--line);border-radius:14px;padding:14px 16px}.td-card h4{margin:0 0 6px;font-size:12px;letter-spacing:.08em;text-transform:uppercase;color:var(--acc)}.td-tile{display:flex;gap:10px;align-items:center;padding:12px;border-radius:12px;border:1px solid var(--line);background:var(--panel);cursor:pointer}.td-tile:hover{background:var(--panel2);border-color:var(--acc)}.td-tile span{font-size:24px}.td-big{font-size:28px;font-weight:700;line-height:1.1}.td-row{display:flex;gap:8px;align-items:center;padding:4px 0}';
  if (!document.getElementById('tdcss')) { const s = document.createElement('style'); s.id = 'tdcss'; s.textContent = css; document.head.appendChild(s); }
  /* the Spiritual widget: verse of the day, the liturgical day, today's Rosary, the reading plan, what is coming up, and the daily 8:00 notification */
  async function spirit(el) {
    if (!el || !A.faith || !A.faith.widgetData) return; let w; try { w = await A.faith.widgetData(new Date()); } catch (e) { return; } if (!el.isConnected) return;
    const v = w.verse, s = w.season, vn = A.verseNote, c = vn ? vn.cfg() : null, trId = A.faith.tr(), hhmm = c ? String(c.h).padStart(2, '0') + ':' + String(c.m).padStart(2, '0') : '08:00';
    const feast = w.feasts.map(x => '<div style="margin-top:4px"><b>' + esc2(x.n) + '</b> <span class="small mute">' + esc2(({ S: 'Solemnity', F: 'Feast', M: 'Memorial', O: 'Optional memorial' })[x.r] || '') + '</span></div>').join('');
    el.innerHTML = '<h4>✝️ Spiritual</h4><div style="display:flex;gap:22px;flex-wrap:wrap"><div style="flex:2;min-width:290px">' +
      '<div class="small mute">Verse of the day</div><div style="font-family:Georgia,serif;font-size:20px;line-height:1.55;margin:6px 0 8px">&ldquo;' + esc2(v.text) + '&rdquo;</div>' +
      '<div class="row" style="gap:8px;flex-wrap:wrap;align-items:center"><b>' + esc2(v.ref) + '</b><button class="ib' + (trId === 'kjv' ? ' on' : '') + '" data-tr="kjv" title="King James Version, the classic English translation">KJV</button><button class="ib' + (trId === 'web' ? ' on' : '') + '" data-tr="web" title="World English Bible, easy modern English">WEB</button><button class="ib' + (trId === 'dr' ? ' on' : '') + '" data-tr="dr" title="Douay-Rheims, traditional wording">Douay-Rheims</button></div>' +
      '<div class="row" style="gap:8px;flex-wrap:wrap;margin-top:10px"><button class="pri" data-sp="chapter">Read the chapter</button><button class="ib" data-sp="explain">Explain</button><button class="ib" data-sp="copy">Copy</button><button class="ib' + (v.saved ? ' on' : '') + '" data-sp="save" title="Keep this verse in Spiritual > My notes">' + (v.saved ? '★ Saved' : '☆ Save') + '</button><button class="ib" data-go="faith">Open Spiritual</button></div></div>' +
      '<div style="flex:1;min-width:230px"><div class="small mute">Today in the Church</div><div class="td-big" style="color:' + s.col + ';font-size:22px;margin:2px 0">' + esc2(s.n) + '</div><div class="small mute">Vestment colour ' + esc2(s.c) + '</div>' + feast +
      '<div style="margin-top:10px"><b>📿 ' + esc2(w.kind) + ' Mysteries</b> <button class="ib" data-sp="rosary" style="margin-left:6px">Pray</button><div class="small mute">' + esc2(w.mysteries.join(', ')) + '</div></div>' +
      '<div style="margin-top:8px"><b>📖 Reading plan</b> ' + (w.plan ? '<div class="small mute">' + esc2(w.plan.name) + ': day ' + w.plan.day + ' · ' + esc2(w.plan.todayLabel) + '</div><button class="ib" data-sp="plan" style="margin-top:4px">Continue</button>' : '<div class="small mute">Read the Bible a little each day.</div><button class="ib" data-sp="plan" style="margin-top:4px">Choose a plan</button>') + '</div></div>' +
      (w.up.length ? '<div style="flex:1;min-width:200px"><div class="small mute">Coming up</div>' + w.up.map(x => '<div class="td-row" style="align-items:baseline"><span class="small mute" style="width:78px">' + x.d.toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric' }) + '</span><span>' + esc2(x.n) + '</span></div>').join('') + '</div>' : '') + '</div>' +
      (vn ? '<div class="row" style="gap:10px;flex-wrap:wrap;align-items:center;margin-top:12px;padding-top:10px;border-top:1px solid var(--line)"><span>🔔 <b>Daily verse notification</b></span><label class="small" style="display:flex;gap:5px;align-items:center;cursor:pointer"><input type="checkbox" id="tdvn"' + (c.on ? ' checked' : '') + '>on</label><span class="small">at</span><input type="time" id="tdvt" value="' + hhmm + '" style="padding:3px 6px;border-radius:8px"><button class="ib" id="tdvtest">Send a test now</button><span class="small mute" id="tdvs"></span></div>' : '');
    const q = id => el.querySelector('#' + id);
    const statusText = async r => {
      const o = q('tdvs'); if (!o) return; const cc = vn.cfg(); if (!cc.on) { o.textContent = 'Off: no verse notification will be sent.'; return; }
      const st = r || await vn.status(); if (!st) { o.innerHTML = '<span style="color:var(--warn)">Close and reopen Moundshroud once to switch this on.</span>'; return; }
      o.textContent = st.scheduled ? 'Scheduled: ' + st.scheduled + ' days ahead, next ' + new Date(st.next).toLocaleString([], { weekday: 'short', hour: 'numeric', minute: '2-digit' }) + '. It arrives even when Moundshroud is closed.' : 'Setting up...';
    };
    if (vn) { statusText(); vn.sync(false).then(r => statusText(r)); }
    el.onclick = async e => {
      const t = e.target.closest('[data-tr]'); if (t) { await A.faith.setTr(t.dataset.tr); spirit(el); if (vn) vn.sync(true); return; }
      const a = e.target.closest('[data-sp]'); if (a) {
        const k = a.dataset.sp;
        if (k === 'chapter') { A.showTab('faith'); setTimeout(() => A.faith.openBible(v.b, v.c, v.v), 500); }
        else if (k === 'explain') { A.showTab('chat'); A.chat.ask('Explain this Bible verse as a faithful, gentle Catholic teacher would: the context, what it means, and how to live it today. ' + v.ref + ': "' + v.text + '"', { noLocal: true, sources: [] }); }
        else if (k === 'copy') A.copy('“' + v.text + '” — ' + v.ref + ' (' + v.tr + ')');
        else if (k === 'save') { const on = await A.faith.saveVerse(new Date()); A.toast(on ? 'Saved. You will find it in Spiritual › My notes.' : 'Taken out of your saved verses.'); spirit(el); }
        else if (k === 'rosary') { A.showTab('faith'); setTimeout(() => A.faith.rosaryOpen(w.kind), 500); }
        else if (k === 'plan') { A.showTab('faith'); setTimeout(() => { const b = document.querySelector('#fasub [data-fs=bible]'); if (b) b.click(); }, 700); }
        return;
      }
      if (e.target.id === 'tdvtest') { const ok = await vn.test(); A.toast(ok ? 'Sent. Look for the verse in the corner of your screen in a few seconds.' : 'Close and reopen Moundshroud once, then try again.', 5000); }
    };
    if (vn) {
      el.onchange = async e => {
        if (e.target.id === 'tdvn') { await vn.save({ on: e.target.checked }); statusText(); }
        else if (e.target.id === 'tdvt') { const m = /^(\d{1,2}):(\d{2})$/.exec(e.target.value); if (m) { await vn.save({ h: +m[1], m: +m[2] }); statusText(); } }
      };
    }
  }
  /* "Your day": today's events and reminders, tonight's dinner from the Kitchen planner, and what the Garden says to plant */
  async function dayCard(el) {
    if (!el || !A.cal) return; const d = new Date(), k = d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
    let its = []; try { await new Promise(r => setTimeout(r, 400)); its = A.cal.itemsOn(d).filter(i => i.kind === 'ev' || i.kind === 'rem' || i.kind === 'hol'); } catch (e) { }
    let dinner = ''; try { const p = JSON.parse(ls.get('kit_plan', '{}'))[k]; if (p && p.d && p.d.length) dinner = p.d.map(x => x.t).join(', '); } catch (e) { }
    let plant = 0; try { if (A.garden) { const F = A.garden.frost(), t = new Date(d.getFullYear(), d.getMonth(), d.getDate()); plant = A.garden.plants.filter(p => A.garden.windows(p).some(w => t >= w.from && t <= w.to)).length; } } catch (e) { }
    if (!el.isConnected) return;
    el.innerHTML = '<h4>📅 Your day</h4>' + (its.length ? its.slice(0, 5).map(i => '<div class="td-row"><span class="small mute" style="width:44px">' + (i.time || 'all day') + '</span><span style="flex:1">' + esc2(i.t) + '</span></div>').join('') + (its.length > 5 ? '<div class="small mute">+' + (its.length - 5) + ' more</div>' : '') : '<div class="small mute">Nothing scheduled today.</div>') +
      '<div class="td-row" style="margin-top:6px"><span>🍳</span><span class="small" style="flex:1">' + (dinner ? 'Dinner: ' + esc2(dinner) : 'No dinner planned') + '</span><a style="cursor:pointer;color:var(--acc)" data-open-kit="1">' + (dinner ? 'Open' : 'Plan') + '</a></div>' + (plant ? '<div class="td-row"><span>🌱</span><span class="small" style="flex:1">' + plant + (plant === 1 ? ' thing' : ' things') + ' to plant now</span><a style="cursor:pointer;color:var(--acc)" data-open-gd="1">See</a></div>' : '') +
      '<div style="margin-top:8px"><button class="ib" data-go="cal">Open calendar</button> <button class="ib" id="tdadd">+ Event</button></div>';
    const ad = el.querySelector('#tdadd'); if (ad) ad.onclick = () => A.cal.openAdd(); const kk = el.querySelector('[data-open-kit]'); if (kk) kk.onclick = () => A.kitchen.open('plan'); const gg = el.querySelector('[data-open-gd]'); if (gg) gg.onclick = () => A.showTab('garden');
  }
  /* "Agent routines": the newest result of a routine the agent ran by itself (web/js/agent.js, lib/routines.js); hidden when you have none */
  async function routineCard(el) {
    if (!el) return; let r; try { r = await A.api('/api/routines'); } catch (e) { return; }
    if (!el.isConnected || !r || (!r.routines.length && !r.runs.length)) return;
    const last = r.runs[0], md2 = t => typeof md === 'function' ? md(t) : esc2(t);
    el.style.display = '';
    el.innerHTML = '<h4>⏱ Agent routines' + (r.unread ? ' <span class="small" style="color:var(--acc)">· ' + r.unread + ' new</span>' : '') + '</h4>' +
      (r.running ? '<div class="small">Running now: <b>' + esc2(r.running.name) + '</b></div>' : '') +
      (last ? '<div class="td-row"><span>' + (last.skipped ? '⏭' : last.ok ? '✅' : '⚠️') + '</span><b class="small" style="flex:1">' + esc2(last.name) + '</b><span class="small mute">' + esc2(new Date(last.at).toLocaleString([], { weekday: 'short', hour: '2-digit', minute: '2-digit' })) + '</span></div><div class="small" style="max-height:6em;overflow:hidden;line-height:1.45">' + md2(String(last.summary || '')) + '</div>' : '<div class="small mute">' + r.routines.length + ' routine' + (r.routines.length === 1 ? '' : 's') + ' set up. Nothing has run yet.</div>') +
      '<div style="margin-top:8px"><button class="ib" data-rt="1">Open routines</button></div>';
    el.querySelector('[data-rt]').onclick = () => A.agent && A.agent.open('routines');
  }
  /* "This day in history": one event for today's date; the arrows step to the neighbouring days */
  function histCard(el, off) {
    if (!el || !window.OTD) return; off = off || 0; const d = new Date(), t = new Date(d.getFullYear(), d.getMonth(), d.getDate() + off), e = window.OTD.on(t);
    const lbl = off === 0 ? 'Today' : t.toLocaleDateString([], { month: 'long', day: 'numeric' });
    el.innerHTML = '<h4>🕰️ This day in history</h4><div class="row" style="gap:6px;align-items:center;margin-bottom:6px"><button class="ib" data-hs="-1" title="Day before">‹</button><span class="small mute" style="flex:1;text-align:center">' + esc2(t.toLocaleDateString([], { month: 'long', day: 'numeric' })) + (off === 0 ? '' : ' · <a style="cursor:pointer;color:var(--acc)" data-hs="0">back to today</a>') + '</span><button class="ib" data-hs="1" title="Day after">›</button></div>' +
      (e ? '<div class="td-big" style="font-size:24px">' + esc2(e.y) + '</div><div style="line-height:1.5;margin-top:2px">' + esc2(e.t) + '</div>' + (e.ago ? '<div class="small mute" style="margin-top:4px">' + e.ago.toLocaleString() + ' years ago</div>' : '') + '<div style="margin-top:8px"><button class="ib" data-hq="1">Ask about it</button></div>' : '<div class="small mute">Nothing recorded for this date.</div>');
    el.onclick = ev => {
      const s = ev.target.closest('[data-hs]'); if (s) { histCard(el, s.dataset.hs === '0' ? 0 : off + (+s.dataset.hs)); return; }
      if (ev.target.closest('[data-hq]') && e) { A.showTab('chat'); if (A.chat) A.chat.ask('Tell me more about this event in history: ' + e.y + ' - ' + e.t); }
    };
  }
  let timer = 0;
  async function render() {
    const now = new Date(), F = window.FAITH, s = F ? F.season(now) : null, fe = F ? F.today(now).filter(x => x.n !== 'Sunday' || true) : [];
    root.innerHTML = '<div class="scroll pad" style="flex:1"><div class="td-wrap"><div class="row" style="align-items:center;gap:16px;flex-wrap:wrap">' + logo() + '<div><div class="small mute" id="tdd">' + esc2(now.toLocaleDateString([], { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })) + '</div><div style="font-size:30px;font-weight:800;margin-top:2px">' + greet() + '.</div></div><span class="sp"></span><div class="row" style="gap:8px;min-width:280px;flex:1;max-width:520px"><input id="tdq" type="text" placeholder="Ask anything..." style="flex:1;padding:10px 14px;border-radius:999px"><button class="pri" id="tdgo">Ask</button><button class="ib" id="tdall" title="Search your own notes, chats, files, study cards, reminders and more, and answer from them">🧠 Ask my stuff</button></div></div>' +
      '<div id="tdalert"></div>' +
      '<div class="td-grid" style="margin-top:14px">' +
      '<div class="td-card" id="tdsp" style="grid-column:1/-1">' + (s ? '<h4>✝️ Spiritual</h4><div class="td-big" style="color:' + s.col + '">' + esc2(s.n) + '</div><div class="small mute">Vestment colour ' + esc2(s.c) + (fe.length ? ' · ' + esc2(fe.map(x => x.n).join(', ')) : '') + '</div><div class="small mute" style="margin-top:8px">Loading the verse of the day...</div>' : '<h4>✝️ Spiritual</h4>') + '</div>' +
      '<div class="td-card" id="tdday"><h4>📅 Your day</h4><div class="mute small">Loading...</div></div>' +
      '<div class="td-card" id="tdhist"><h4>🕰️ This day in history</h4></div>' +
      '<div class="td-card" id="tdrem"><h4>Reminders</h4><div class="mute small">Loading...</div></div>' +
      '<div class="td-card" id="tdstudy"><h4>Study</h4><div class="mute small">Loading...</div></div>' +
      '<div class="td-card" id="tdjr"><h4>Journal</h4></div><div class="td-card" id="tdlang"><h4>Language</h4></div>' +
      '<div class="td-card" id="tdresume"><h4>Pick up where you left off</h4></div>' +
      '<div class="td-card" id="tdcom" style="display:none"><h4>Community</h4></div>' +
      '<div class="td-card" id="tdrt" style="display:none"><h4>⏱ Agent routines</h4></div>' +
      '<div class="td-card" id="tdtip"><h4>Tip</h4></div>' +
      '</div><h4 style="margin:18px 0 8px;font-size:12px;letter-spacing:.08em;text-transform:uppercase;color:var(--mute)">Go to</h4><div class="td-grid" style="grid-template-columns:repeat(auto-fill,minmax(190px,1fr))">' + TILES.map(t => '<div class="td-tile" data-go="' + t[0] + '"><span>' + ((A.icon && A.icon(t[0])) || t[1]) + '</span><div><b>' + t[2] + '</b><div class="small mute">' + t[3] + '</div></div></div>').join('') + '</div></div></div>';
    const $ = id => root.querySelector('#' + id);
    const ask = () => { const v = $('tdq').value.trim(); A.showTab('chat'); if (v) A.chat.ask(v); };
    spirit($('tdsp')); dayCard($('tdday')); histCard($('tdhist')); routineCard($('tdrt'));
    $('tdall').onclick = () => { if (A.askAll) A.askAll.open($('tdq').value.trim()); };
    $('tdgo').onclick = ask; $('tdq').onkeydown = e => { e.stopPropagation(); if (e.key === 'Enter') ask(); };
    root.onclick = e => {
      const g = e.target.closest('[data-go]'); if (g) { const id = g.dataset.go; if (id === 'journal') A.tools.go('journal'); else A.showTab(id); return; }
      const a = e.target.closest('[data-act]'); if (!a) return; const k = a.dataset.act;
      if (k === 'backup') A.tools.go('storage'); else if (k === 'tutorial') A.tutorial.resume(); else if (k === 'tip') { if (A.tutorial) A.tutorial.start(A.tutorial.find(a.dataset.n)); } else if (k === 'lib') A.lib.openUrl(a.dataset.u, a.dataset.t); else if (k === 'bible') { A.showTab('faith'); setTimeout(() => { const b = document.querySelector('#fasub [data-fs=bible]'); if (b) b.click(); }, 700); } else if (k === 'study') A.showTab('study'); else if (k === 'rem') A.tools.go('rem');
    };
    // tip of the day
    try { A.community && A.community.digestCard($('tdcom')); } catch (e) { }
 const tip = TIPS[(Math.floor(now / DAYS)) % TIPS.length]; $('tdtip').innerHTML = '<h4>Tip</h4><b>' + esc2(tip[0]) + '</b><div class="small" style="margin:4px 0 8px;line-height:1.5">' + tip[1] + '</div><button class="ib" data-act="tip" data-n="' + esc2(tip[2]) + '">Show me</button> <button class="ib" data-act="tutorial">Full presentation</button>';
    // journal
    try { const j = A.journal ? A.journal.today() : null, st = A.journal ? A.journal.streak() : 0; $('tdjr').innerHTML = '<h4>Journal</h4>' + (j && (j.t || j.m) ? '<div>Written today ✓</div>' : '<div>No entry yet today.</div>') + '<div class="small mute" style="margin:4px 0 8px">🔥 ' + st + ' day streak</div><button class="ib" data-go="journal">' + (j && (j.t || j.m) ? 'Open journal' : 'Write today') + '</button>'; } catch (e) { }
    try { const l = A.lang && A.lang.summary(); $('tdlang').innerHTML = '<h4>Language</h4>' + (l ? '<div class="td-big">' + l.words + '</div><div class="small mute">words learned in ' + ({ es: 'Spanish', fr: 'French', de: 'German', it: 'Italian', pt: 'Portuguese' }[l.code] || '') + ' · ' + l.lessons + ' lessons</div><div style="margin-top:8px"><button class="pri" data-go="lang">Continue learning</button></div>' : '<div class="small mute" style="margin-bottom:8px">Spanish, French, German, Italian or Portuguese in about six months.</div><button class="ib" data-go="lang">Start a language</button>'); } catch (e) { }
    // resume
    try { let h = '', fh = A.fav ? A.fav.history()[0] : null; if (fh) h += '<div class="td-row"><span>📚</span><a style="cursor:pointer;flex:1" data-act="lib" data-u="' + esc2(fh.u) + '" data-t="' + esc2(fh.t) + '">' + esc2(fh.t) + '</a></div>'; h += '<div class="td-row"><span>📖</span><a style="cursor:pointer;flex:1" data-act="bible">Continue reading the Bible</a></div>'; const nf = A.fav ? A.fav.count() : 0; h += '<div class="td-row"><span>⭐</span><a style="cursor:pointer;flex:1" onclick="A.fav.open(\'all\')">' + nf + ' favorite' + (nf === 1 ? '' : 's') + '</a></div>'; $('tdresume').innerHTML = '<h4>Pick up where you left off</h4>' + h; } catch (e) { }
    // async cards
    A.api('/api/cards').then(cards => { if (!Array.isArray(cards)) cards = []; const due = cards.filter(c => (c.due || 0) <= Date.now()).length, el = $('tdstudy'); if (el) el.innerHTML = '<h4>Study</h4><div class="td-big">' + due + '</div><div class="small mute">card' + (due === 1 ? '' : 's') + ' due today · ' + cards.length + ' in all · 🔥 ' + streakStudy() + ' day streak</div><div style="margin-top:8px"><button class="' + (due ? 'pri' : 'ib') + '" data-act="study">' + (due ? 'Review now' : 'Open Study') + '</button></div>'; }).catch(() => { const el = $('tdstudy'); if (el) el.innerHTML = '<h4>Study</h4><div class="mute small">Not available.</div>'; });
    A.api('/api/reminders').then(list => { list = (Array.isArray(list) ? list : (list && list.items) || []).filter(r => r && r.at > Date.now() - 6e4).sort((a, b) => a.at - b.at); const el = $('tdrem'); if (!el) return; el.innerHTML = '<h4>Reminders</h4>' + (list.length ? list.slice(0, 4).map(r => '<div class="td-row"><span>⏰</span><div style="flex:1"><div>' + esc2(r.text) + '</div><div class="small mute">' + new Date(r.at).toLocaleString([], { weekday: 'short', hour: 'numeric', minute: '2-digit' }) + '</div></div></div>').join('') : '<div class="small mute">Nothing coming up.</div>') + '<div style="margin-top:6px"><button class="ib" data-act="rem">Manage</button></div>'; }).catch(() => { });
    A.api('/api/prep/health').then(h => { const al = $('tdalert'); if (!al || !h) return; const msgs = []; if (h.lastBackup === 0 || (h.lastBackup && Date.now() - h.lastBackup > 14 * DAYS)) msgs.push(['💾', h.lastBackup ? 'It has been over two weeks since your last backup.' : 'You have not made a backup yet.', 'Back up', 'backup']); if (h.disk && h.disk.freeGB < 15) msgs.push(['⚠️', 'Only ' + h.disk.freeGB + ' GB of disk space is free.', 'See what uses it', 'backup']); al.innerHTML = msgs.map(m => '<div class="td-card" style="margin-top:12px;border-color:var(--acc);display:flex;gap:10px;align-items:center"><span style="font-size:20px">' + m[0] + '</span><span style="flex:1">' + m[1] + '</span><button class="pri" data-act="' + m[3] + '">' + m[2] + '</button></div>').join(''); }).catch(() => { });
    clearInterval(timer); timer = setInterval(() => { if (A.cur !== 'home') { clearInterval(timer); return; } const d = root.querySelector('#tdd'); if (d) d.textContent = new Date().toLocaleDateString([], { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' }); }, 60000);
  }
  A.today = { render };
  A.registerTab('home', 'Today', render);
})();

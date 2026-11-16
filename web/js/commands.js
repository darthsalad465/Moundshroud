// The command registry: one list of everything Moundshroud can do.
// The Ctrl+K palette, the keyboard-shortcut sheet and anything added later all read from here, so a new feature
// only has to say A.cmd.reg([...]) once to appear everywhere. Nothing in this file draws or changes the page,
// and every command is run inside a try/catch, so a broken entry can never take the app down with it.
(() => {
  const all = [], by = {};
  const slug = t => String(t).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 64);

  /* Fuzzy matching: every letter of the query must appear in order. Word starts, consecutive runs and a match at the
     beginning all score higher, so "seth" finds "Settings" and "openthe" finds "Open the guide". Returns null when the
     query does not match at all, and the positions it matched so the palette can highlight them. */
  const fuzzy = (text, q) => {
    const t = String(text == null ? '' : text), s = t.toLowerCase();
    q = String(q == null ? '' : q).trim().toLowerCase();
    if (!q) return { score: 0, at: [] };
    let i = 0; const at = [];
    for (let k = 0; k < s.length && i < q.length; k++) if (s[k] === q[i]) { at.push(k); i++; }
    if (i < q.length) return null;
    let score = 100 - Math.min(50, t.length / 8);
    at.forEach((k, n) => { score += (k === 0 ? 26 : /[\s\-_/•·>:(]/.test(s[k - 1]) ? 13 : 0) + (n && at[n - 1] === k - 1 ? 11 : 0); });
    if (s === q) score += 220; else if (s.startsWith(q)) score += 95; else if (s.indexOf(q) >= 0) score += 50;
    return { score, at };
  };

  /* the parts of the palette that describe the app right now, worked out when it opens (tabs and settings sections
     are only known once every module has loaded) */
  const dynamic = () => {
    const out = [];
    try {
      (A.order || []).forEach(n => {
        const t = A.tabs[n]; if (!t || t.hidden) return;
        out.push({ id: 'tab:' + n, title: t.label, sub: 'Open this area', icon: A.NAVIC[n] || '▸', group: 'Go to',
          tags: 'tab open go ' + n, boost: 1.06, run: () => A.showTab(n) });
      });
    } catch (e) { }
    try {
      const SECS = [['appearance', '🎨', 'Appearance'], ['voice', '🔊', 'Voice & sound'], ['buddy', '🦉', 'Your buddy'], ['ai', '🧠', 'AI & power'],
        ['chess', '♟', 'Chess'], ['games', '🎮', 'Games & cards'], ['help', '🧭', 'Walkthroughs & help'], ['data', '💾', 'Backup & data'], ['keys', '⌨', 'Shortcuts & about']];
      if (A.settings && A.settings.open) SECS.forEach(s => out.push({ id: 'set:' + s[0], title: 'Settings: ' + s[2], sub: 'Open that section of Settings', icon: s[1], group: 'Go to',
        tags: 'settings preference options ' + s[0], run: () => A.settings.open(s[0]) }));
    } catch (e) { }
    return out;
  };

  const kind = c => {
    try { return (c.group || 'Do').toLowerCase(); } catch (e) { return 'do'; }
  };

  A.cmd = {
    /* add commands: {title, sub, icon, group, tags, keys, boost, when, run} */
    reg(items) {
      (Array.isArray(items) ? items : [items]).forEach(c => {
        if (!c || !c.title || typeof c.run !== 'function') return;
        const id = c.id || slug(c.group + ' ' + c.title);
        if (by[id]) { by[id].title = c.title; by[id].run = c.run; return; }
        const e = Object.assign({ id }, c); by[id] = e; all.push(e);
      });
      return A.cmd;
    },
    list() { return all.filter(c => { try { return c.when ? !!c.when() : true; } catch (e) { return false; } }).concat(dynamic()); },
    byId(id) { return by[id]; },
    /* best matches for a query, best first; an empty query returns the list in its natural order */
    find(q, limit) {
      const out = [], query = String(q == null ? '' : q).trim();
      A.cmd.list().forEach(c => {
        if (query.charAt(0) === '>' && kind(c) === 'go to') return;                  // ">action" means commands only
        const hay = c.title + ' ' + (c.tags || '') + ' ' + (c.sub || '');
        let m = query ? fuzzy(c.title, query) : { score: 0, at: [] };
        if (!m && query) m = fuzzy(hay, query);
        if (!m) return;
        out.push({ cmd: c, score: m.score * (c.boost || 1), at: m.at });
      });
      out.sort((a, b) => b.score - a.score);
      return out.slice(0, limit || 40);
    },
    run(idOrCmd, keepOpen) {
      const c = typeof idOrCmd === 'string' ? by[idOrCmd] : idOrCmd; if (!c) return false;
      A.cmd.touch(c.id);
      try { c.run(); } catch (e) { try { A.toast('That did not work: ' + (e && e.message ? e.message : 'unknown reason'), 4000); } catch (e2) { } }
      return true;
    },
    /* the last few commands run, newest first: the palette starts with these when the box is empty */
    recent: () => { try { return JSON.parse(ls.get('cmd_recent', '[]')) || []; } catch (e) { return []; } },
    touch(id) { try { const l = A.cmd.recent().filter(x => x !== id); l.unshift(id); ls.set('cmd_recent', JSON.stringify(l.slice(0, 10))); } catch (e) { } },
    /* wrap the matched letters in <mark> so the palette can show why something matched */
    mark(text, at) {
      const t = String(text == null ? '' : text);
      if (!at || !at.length) return esc(t);
      const set = {}; at.forEach(i => { set[i] = 1; });
      let h = '', open = false;
      for (let i = 0; i < t.length; i++) {
        const on = !!set[i];
        if (on && !open) { h += '<mark>'; open = true; } else if (!on && open) { h += '</mark>'; open = false; }
        h += esc(t[i]);
      }
      return open ? h + '</mark>' : h;
    },
    fuzzy
  };

  /* ------------------------------------------------------------------ the built-in commands */
  const T = () => window.OA_THEMES;
  const themeById = id => { try { return T().list.find(t => t.id === id); } catch (e) { return null; } };
  const setTheme = id => { try { T().apply(id); } catch (e) { } const t = themeById(id); if (t) A.toast('🎨 ' + t.name + ' theme'); };
  const styles = () => { try { return T().styles || []; } catch (e) { return []; } };
  const setStyle = id => { try { T().applyStyle(id); } catch (e) { } const s = styles().find(x => x.id === id); if (s) A.toast('✨ ' + s.name + ' style'); };

  A.cmd.reg([
    /* ---- everything you can open, in one place ---- */
    { title: 'New chat', sub: 'Start a fresh conversation', icon: '✎', group: 'Do', keys: 'Ctrl+N', tags: 'chat ask question ai new', run: () => A.chat.newChat() },
    { title: 'Search everything', sub: 'Chats, notes, files and the offline library', icon: '🔎', group: 'Go to', tags: 'find lookup wiki', run: () => A.showTab('web') },
    { title: 'New note', sub: 'Start writing a note', icon: '📝', group: 'Do', tags: 'note write jot new', run: () => { A.showTab('notes'); A.emit('newitem'); } },
    { title: 'Open My Files', sub: 'Documents on this PC', icon: '🗂️', group: 'Go to', tags: 'files documents folder disk', run: () => A.showTab('files') },
    { title: 'Open the Library', sub: 'The offline books on this PC', icon: '📚', group: 'Go to', tags: 'library books wiki read', run: () => A.showTab('lib') },
    { title: 'Open a new library tab', icon: '➕', group: 'Do', tags: 'library tab new', when: () => !!(A.lib && A.lib.newTab), run: () => { A.showTab('lib'); A.lib.newTab(); } },
    { title: 'My favorites', sub: 'Saved pages, books and searches', icon: '⭐', group: 'Go to', tags: 'favorites bookmarks saved star', when: () => !!(A.fav && A.fav.open), run: () => A.fav.open('all') },
    { title: 'Prompt library', sub: 'Your saved prompts', icon: '💬', group: 'Go to', tags: 'prompts templates saved', when: () => !!(A.tools && A.tools.go), run: () => A.tools.go('prm') },
    { title: 'Storage: where is my disk space going', icon: '💾', group: 'Go to', tags: 'storage disk space report', when: () => !!(A.tools && A.tools.go), run: () => A.tools.go('storage') },
    { title: 'Reminders and timers', icon: '⏰', group: 'Go to', tags: 'reminder timer alarm', when: () => !!(A.tools && A.tools.go), run: () => A.tools.go('rem') },
    { title: 'Calculator', icon: '🧮', group: 'Go to', tags: 'calculator maths sum', when: () => !!(A.tools && A.tools.go), run: () => A.tools.go('calc') },
    { title: 'Journal', icon: '📓', group: 'Go to', tags: 'journal diary', when: () => !!(A.tools && A.tools.go), run: () => A.tools.go('journal') },
    { title: 'Code Breaker', icon: '🔐', group: 'Go to', tags: 'codes puzzles cipher', when: () => !!(A.tools && A.tools.go), run: () => A.tools.go('codes') },
    { title: 'Cyber Course', icon: '🛡️', group: 'Go to', tags: 'cyber security course lessons', when: () => !!(A.tools && A.tools.go), run: () => A.tools.go('course') },
    { title: 'CyberChef: convert and decode', icon: '🧪', group: 'Go to', tags: 'cyberchef decode encode', when: () => !!(A.tools && A.tools.go), run: () => A.tools.go('chef') },
    { title: 'Office: documents, spreadsheets and slides', icon: '📄', group: 'Go to', tags: 'office word excel powerpoint doc', when: () => !!(A.tools && A.tools.go), run: () => A.tools.go('office') },
    { title: 'Office: start a new document', icon: '➕', group: 'Do', tags: 'office new document write', when: () => !!(A.officeEdit && A.officeEdit.newFile), run: () => { A.tools.go('office'); setTimeout(() => A.officeEdit.newFile(), 500); } },
    { title: 'Learn a language', icon: '🌍', group: 'Go to', tags: 'language spanish french learn', run: () => A.showTab('lang') },
    { title: 'Studio: pixel art, music and drawing', icon: '🎨', group: 'Go to', tags: 'studio art draw paint pixel music', run: () => A.showTab('studio') },
    { title: 'Spiritual: Bible, prayers, Rosary', icon: '✝️', group: 'Go to', tags: 'faith bible prayer rosary spiritual', run: () => A.showTab('faith') },
    { title: 'Spiritual: learn the Bible (lessons, quiz, memorize)', icon: '🎓', group: 'Go to', tags: 'bible learn lesson quiz memorize verse study books spiritual', run: () => (A.faith && A.faith.learn ? A.faith.learn() : A.showTab('faith')) },
    { title: 'Spiritual: ask the Bible Expert', icon: '✝️', group: 'Go to', tags: 'bible expert ask scripture church history theology catechism fathers question', run: () => (A.faith && A.faith.expert ? A.faith.expert() : A.showTab('faith')) },
    { title: 'Study flashcards', icon: '🎓', group: 'Go to', tags: 'study flashcards revise', run: () => A.showTab('study') },
    { title: 'Ready check: is everything set up', icon: '🛟', group: 'Go to', tags: 'prepare ready check health setup stock up', run: () => A.showTab('health') },
    { title: 'First aid and emergency plans', icon: '🚑', group: 'Go to', tags: 'first aid emergency plans prepare', run: () => { A.showTab('health'); setTimeout(() => { const b = document.querySelector('#psub [data-s=practice]'); b && b.click(); }, 300); } },
    { title: 'Writing coach', icon: '✍️', group: 'Go to', tags: 'writing coach grammar help', run: () => { A.showTab('health'); setTimeout(() => { const b = document.querySelector('#psub [data-s=writing]'); b && b.click(); }, 300); } },
    { title: 'Start the tutorial (full presentation)', icon: '🎬', group: 'Go to', tags: 'tutorial presentation guided', when: () => !!(A.tutorial && A.tutorial.resume), run: () => A.tutorial.resume() },
    { title: 'Walkthrough: tour of the app', icon: '🧭', group: 'Go to', tags: 'tour walkthrough guided app', when: () => !!(A.walk && A.walk.start), run: () => A.walk.start('app') },
    { title: 'Walkthrough: chess in depth', icon: '♟', group: 'Go to', tags: 'tour chess walkthrough', when: () => !!(A.walk && A.walk.start), run: () => A.walk.start('chess') },
    { title: 'Walkthrough: Entertainment and games', icon: '🎭', group: 'Go to', tags: 'tour games walkthrough', when: () => !!(A.walk && A.walk.start), run: () => A.walk.start('games') },
    { title: 'Walkthrough: Settings', icon: '⚙️', group: 'Go to', tags: 'tour settings walkthrough', when: () => !!(A.walk && A.walk.start), run: () => A.walk.start('settings') },
    { title: 'Open the guide', icon: '✨', group: 'Help', keys: 'F1', tags: 'guide help manual what is new', run: () => A.showTab('guide') },
    { title: 'Take the tour', icon: '🚏', group: 'Help', tags: 'tour guide help', when: () => !!(A.guide && A.guide.tour), run: () => A.guide.tour(0) },
    { title: 'Thesaurus', icon: '📖', group: 'Go to', tags: 'thesaurus synonyms words', when: () => !!(A.thes && A.thes.open), run: () => A.thes.open('') },
    { title: 'Rhymer', icon: '🎵', group: 'Go to', tags: 'rhyme poem words', when: () => !!(A.rhyme && A.rhyme.open), run: () => A.rhyme.open('') },
    { title: 'Show my companion', icon: '🦉', group: 'Do', tags: 'companion buddy pet show', when: () => !!(A.companion && A.companion.show), run: () => A.companion.show() },
    { title: 'Talk to my buddy', icon: '💬', group: 'Do', tags: 'buddy chat companion talk', when: () => !!(A.buddy && A.buddy.open), run: () => A.buddy.open() },

    /* ---- settings and switches ---- */
    { title: 'Settings', sub: 'Everything in one searchable page', icon: '⚙️', group: 'Go to', tags: 'settings options preferences', when: () => !!(A.settings && A.settings.open), run: () => A.settings.open() },
    { title: 'Keyboard shortcuts', sub: 'See every shortcut in the app', icon: '⌨', group: 'Help', keys: '?', tags: 'keyboard hotkeys shortcuts keys cheat sheet', when: () => !!(A.keys && A.keys.help), run: () => A.keys.help() },
    { title: 'Customize appearance', sub: 'Fonts, text size, spacing, corners, accent colour', icon: '🎛️', group: 'Go to', tags: 'customize fonts text size spacing corners accent contrast', when: () => !!(A.custom && A.custom.open), run: () => A.custom.open() },
    { title: 'Motion: full', sub: 'Everything moves', icon: '🎞️', group: 'Look', tags: 'motion animation full smooth', when: () => !!(A.motion), run: () => A.motion.set('full') },
    { title: 'Motion: subtle', sub: 'Calmer and shorter', icon: '🪶', group: 'Look', tags: 'motion animation subtle calm reduced', when: () => !!(A.motion), run: () => A.motion.set('subtle') },
    { title: 'Motion: off', sub: 'Nothing moves', icon: '⏸️', group: 'Look', tags: 'motion animation off still none', when: () => !!(A.motion), run: () => A.motion.set('off') },
    { title: 'Next colour theme', sub: 'Cycle through the themes', icon: '🎨', group: 'Look', tags: 'theme colour colour scheme cycle next dark light', when: () => !!T(), run: () => { const t = T(), i = t.list.findIndex(x => x.id === t.get()); setTheme(t.list[(i + 1) % t.list.length].id); } },
    { title: 'Random colour theme', sub: 'Surprise me', icon: '🎲', group: 'Look', tags: 'theme random surprise shuffle colour', when: () => !!T(), run: () => { const t = T(), i = t.list.findIndex(x => x.id === t.get()); let n = i; while (t.list.length > 1 && n === i) n = Math.floor(Math.random() * t.list.length); setTheme(t.list[n].id); } },
    { title: 'Next interface style', sub: 'Cycle through the styles', icon: '◐', group: 'Look', tags: 'style interface shape modern glass jarvis brutal editorial', when: () => styles().length > 1, run: () => { const l = styles(), cur = T().getStyle ? T().getStyle() : ''; const i = l.findIndex(x => x.id === cur); setStyle(l[(i + 1) % l.length].id); } },
    { title: 'Low-power mode', sub: 'Smaller AI model, no animations, shorter memory', icon: '🔋', group: 'Do', tags: 'power battery low power save laptop', when: () => !!(A.power && A.power.toggle), run: () => { A.power.toggle(!A.power.on); A.toast(A.power.on ? '🔋 Low-power mode on' : 'Low-power mode off'); } },

    /* ---- housekeeping ---- */
    { title: 'Back up everything', sub: 'One zip with notes, chats, progress and settings', icon: '💾', group: 'Do', tags: 'backup export save zip copy', when: () => !!(A.backup && A.backup.make), run: () => A.backup.make() },
    { title: 'Restore from a backup', icon: '📥', group: 'Do', tags: 'restore import backup', when: () => !!(A.backup && A.backup.pick), run: () => A.backup.pick() },
    { title: 'Run a self-test', sub: 'Opens every tab and checks the app', icon: '🩺', group: 'Do', tags: 'test check health diagnose broken errors self-test', when: () => !!(A.selftest && A.selftest.run), run: () => A.selftest.run() },
    { title: 'Clear search history', sub: 'Recent searches and pages you opened', icon: '🧹', group: 'Do', tags: 'clear history privacy searches', when: () => !!(A.fav && A.fav.clearHistory), run: () => { if (confirm('Clear your recent searches and the list of pages you opened?')) { A.fav.clearHistory('all'); A.toast('🗑️ History cleared'); } } },
    { title: 'What can this app do?', sub: 'A guided tour of every area', icon: '💡', group: 'Help', tags: 'help what can do features capability tour', when: () => !!(A.walk && A.walk.start), run: () => A.walk.start('app') }
  ]);

  /* one command per colour theme and per interface style, so "paper" or "glass" just works in the palette */
  try {
    const t = T();
    if (t && t.list) t.list.forEach(x => A.cmd.reg({ id: 'thm:' + x.id, title: 'Theme: ' + x.name, sub: x.note || 'Change the colours', icon: x.dark ? '🌙' : '☀️', group: 'Look', tags: 'theme colour colour scheme ' + x.id, run: () => setTheme(x.id) }));
    if (t && t.styles) t.styles.forEach(x => A.cmd.reg({ id: 'sty:' + x.id, title: 'Interface style: ' + x.name, sub: x.note || 'Change the shape of the app', icon: x.icon || '◐', group: 'Look', tags: 'style interface look shape ' + x.id, run: () => setStyle(x.id) }));
  } catch (e) { }
})();

// The Guide as a holographic book: a cover that opens, two-page spreads, a contents drawer and a page-turn.
// The pages are built from the Guide's own SECTIONS (A.guide.full()), so the book is always the written manual.
// Open it from Guide > "Open the book", from the command palette, or with A.guideBook.open('chat').
// Nothing here touches the app until the book is opened.
(() => {
  if (typeof A === 'undefined' || typeof ls === 'undefined') return;

  /* ------------------------------------------------------------------ the shape of the book */
  const PARTS = [
    { title: 'First steps', note: 'Open the door, learn the keys, and ask your first question.', hue: '#e8c56a',
      ids: ['start', 'keys', 'chat', 'online', 'actions', 'voice', 'attach', 'anywhere'] },
    { title: 'Your own library', note: 'Books, documents, notes and study that live on this PC.', hue: '#79e6ff',
      ids: ['library', 'files', 'notes', 'study', 'docs'] },
    { title: 'Tools & making', note: 'Calculators, security tools, code, pictures and ideas.', hue: '#ff9f7a',
      ids: ['tools', 'calculator', 'cybertoolkit', 'converter', 'agent', 'swarm', 'pictures', 'olympics', 'bible'] },
    { title: 'Studio & play', note: 'Make art, music, games and stories; then take a break.', hue: '#c9a7ff',
      ids: ['studiosessions', 'interp', 'longvideo', 'phone', 'aivideo', 'websearch', 'codebreaker', 'cybercourse', 'cyber',
        'reminders', 'play', 'gamemaker', 'composer', 'studio', 'storybook'] },
    { title: 'Worlds to explore', note: 'Languages, Rome, politics and other places to get lost in.', hue: '#8fe3b0',
      ids: ['languages', 'middlewatch', 'president', 'imperium'] },
    { title: 'The wider world', note: 'The browser, news, photos, mail, money and the map of it all.', hue: '#ffd36e',
      ids: ['browser', 'news', 'updates', 'chessscan', 'lichess', 'vault', 'photos', 'mail', 'memory', 'appmap', 'markets',
        'today', 'favorites'] },
    { title: 'Faith & readiness', note: 'Prayer, the Church\'s year, and the day the power goes out.', hue: '#b9c6ff',
      ids: ['spiritual', 'prepare', 'pc'] },
    { title: 'Search & chess', note: 'Ask anything, then sit down at the board.', hue: '#7fe0d4',
      ids: ['search', 'chessboard', 'chessclock', 'chessbots', 'chessprofile', 'chessreview', 'chesslive', 'chessvariants',
        'chessonline', 'chesstourney'] },
    { title: 'New tabs & sky', note: 'The calendar, kitchen, garden, stars and screens.', hue: '#f2a6d8',
      ids: ['newtabs', 'sky', 'godot', 'tv', 'radio', 'musiclib'] },
    { title: 'More chess', note: 'Negotiation, history and the long game.', hue: '#d7b48a',
      ids: ['chessneg', 'chessmore'] },
    { title: 'Make it yours', note: 'Sounds, themes, settings and the small repairs.', hue: '#a8b3c9',
      ids: ['sounds', 'customize', 'settings', 'fixes', 'privacy'] }
  ];
  const ESSENTIAL = new Set(['start', 'chat', 'actions', 'voice', 'library', 'files', 'study', 'studio', 'storybook',
    'play', 'spiritual', 'prepare', 'customize', 'privacy']);

  /* section id -> where its "Open" button goes */
  const TAB = {
    start: 'home', chat: 'chat', online: 'chat', actions: 'chat', voice: 'chat', attach: 'chat', agent: 'chat', swarm: 'chat',
    pictures: 'chat', olympics: 'chat', interp: 'chat', memory: 'chat', phone: 'chat',
    library: 'lib', files: 'files', notes: 'notes', study: 'study', docs: 'docs', tools: 'tools', calculator: 'calc',
    cybertoolkit: 'cyber', converter: 'tools', codebreaker: 'cyber', cybercourse: 'cyber', cyber: 'cyber', vault: 'cyber',
    bible: 'faith', spiritual: 'faith', reminders: 'rem', play: 'play', middlewatch: 'play', president: 'play', imperium: 'play',
    chessscan: 'play', lichess: 'play', chessboard: 'play', chessclock: 'play', chessbots: 'play', chessprofile: 'play',
    chessreview: 'play', chesslive: 'play', chessvariants: 'play', chessonline: 'play', chesstourney: 'play',
    chessneg: 'play', chessmore: 'play', sounds: 'play',
    browser: 'web', favorites: 'web', search: 'web', websearch: 'web', news: 'news', updates: 'home', photos: 'photos',
    mail: 'mail', appmap: 'map', markets: 'money', today: 'home', languages: 'lang', musiclib: 'music',
    prepare: 'health', pc: 'tools', newtabs: 'cal', sky: 'sky', tv: 'tv', radio: 'radio', godot: 'studio', studio: 'studio',
    storybook: 'studio', gamemaker: 'studio', composer: 'studio', studiosessions: 'studio', longvideo: 'studio', aivideo: 'studio'
  };
  const STUDIO = { studiosessions: 'art', longvideo: 'video', aivideo: 'video', gamemaker: 'games', composer: 'composer',
    studio: 'pixel', storybook: 'storybook', godot: 'godot' };

  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const clamp = (n, lo, hi) => Math.max(lo, Math.min(hi, n));
  const roman = n => ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X', 'XI', 'XII'][n - 1] || String(n);
  const reduced = () => { try { return matchMedia('(prefers-reduced-motion: reduce)').matches; } catch (e) { return false; } };
  const clip = (s, n) => { s = String(s || '').replace(/\s+/g, ' ').trim(); return s.length > n ? s.slice(0, n - 1).replace(/[,;:.\s]+$/, '') + '…' : s; };

  function plain(html) {
    return String(html || '')
      .replace(/<br\s*\/?>/gi, ' ')
      .replace(/<\/(p|li|tr|h[1-6]|div|summary)>/gi, '. ')
      .replace(/<[^>]+>/g, ' ')
      .replace(/&nbsp;/gi, ' ').replace(/&amp;/gi, '&').replace(/&lt;/gi, '<').replace(/&gt;/gi, '>')
      .replace(/&quot;/gi, '"').replace(/&#39;/gi, "'").replace(/&[a-z]+;/gi, ' ')
      .replace(/\s+/g, ' ').replace(/(\.\s*){2,}/g, '. ').trim();
  }
  function summarize(text) {
    text = String(text || '').replace(/\s+/g, ' ').trim();
    if (text.length <= 220) return text;
    const cut = text.slice(0, 220), at = cut.lastIndexOf(' ');
    return cut.slice(0, at > 130 ? at : 220).replace(/[,;:.\s]+$/, '') + '…';
  }
  /* An opener is the short summary and up to three "threads" shown on the left page. The first paragraph
     is the summary when there is one; otherwise the first list item is. Threads never repeat the summary. */
  function opener(html) {
    const lis = [], re = /<li[^>]*>([\s\S]*?)<\/li>/gi;
    let m;
    while ((m = re.exec(html))) { const t = plain(m[1]); if (t.length > 28) lis.push(t); }
    const pm = /<p[^>]*>([\s\S]*?)<\/p>/i.exec(html);
    const lead = pm ? plain(pm[1]) : '';
    const summary = summarize(lead.length > 40 ? lead : (lis[0] || plain(html)));
    const norm = s => String(s || '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
    const ns = norm(summary).slice(0, 80);
    const dup = t => { const nt = norm(t); return !!ns && (nt.startsWith(ns.slice(0, 40)) || ns.startsWith(nt.slice(0, 40))); };
    const out = [];
    for (const t of lis) {
      if (dup(t) || out.some(x => norm(x) === norm(t))) continue;
      out.push(clip(t, 142));
      if (out.length >= 3) break;
    }
    if (!out.length) {
      const sents = plain(html).split(/(?<=[.!?])\s+/).filter(s => s.length > 55);
      const rest = sents.filter(s => !dup(s));
      (rest.length ? rest : sents).slice(0, 2).forEach(s => out.push(clip(s, 142)));
    }
    return { summary, threads: out };
  }
  const words = t => (String(t || '').match(/\b[\w'’\-]+\b/g) || []).length;
  const fmtMins = n => n >= 60 ? Math.floor(n / 60) + ' hr ' + (n % 60 ? (n % 60) + ' min' : '') : n + ' min';

  /* ------------------------------------------------------------------ storage */
  function seenSet() {
    try { const a = JSON.parse(ls.get('gb_seen', '[]')); return new Set(Array.isArray(a) ? a : []); } catch (e) { return new Set(); }
  }
  let seen = seenSet();
  function markSeen(id) {
    if (!id || seen.has(id)) return;
    seen.add(id);
    try { ls.set('gb_seen', JSON.stringify([...seen].slice(-500))); } catch (e) { }
  }

  /* ------------------------------------------------------------------ the chapters, built from the Guide itself */
  let chapters = [], byId = {}, parts = [], totalMins = 0;
  function build() {
    const secs = (A.guide && A.guide.full) ? A.guide.full() : [];
    if (!secs.length) return false;
    const have = new Set(secs.map(s => s.id));
    const used = new Set();
    const shaped = PARTS.map(p => ({ title: p.title, note: p.note, hue: p.hue, ids: p.ids.filter(id => have.has(id)) }));
    for (const p of shaped) for (const id of p.ids) used.add(id);
    const extra = secs.filter(s => !used.has(s.id)).map(s => s.id);
    if (extra.length) shaped.push({ title: 'Further reading', note: 'More corners of the app.', hue: '#a8b3c9', ids: extra });
    let n = 0;
    parts = shaped.filter(p => p.ids.length).map((p, pi) => {
      p.num = pi + 1;
      p.chapters = p.ids.map(id => secs.find(s => s.id === id)).filter(Boolean).map(sec => {
        n++;
        const text = plain(sec.html);
        const w = words(text), op = opener(sec.html);
        return { id: sec.id, icon: sec.icon || '•', title: sec.title, html: sec.html, text, part: p, n,
          words: w, mins: Math.max(1, Math.round(w / 200)), summary: op.summary, threads: op.threads };
      });
      p.chapters.forEach((c, ci) => { c.inPart = ci + 1; });
      return p;
    });
    chapters = parts.flatMap(p => p.chapters);
    byId = {}; chapters.forEach((c, i) => { byId[c.id] = i; });
    totalMins = chapters.reduce((a, c) => a + c.mins, 0);
    return chapters.length > 0;
  }

  /* ------------------------------------------------------------------ state */
  let root = null, book = null, ix = 0, opened = false, toc = false, onlyEssential = false, query = '',
    reading = false, flipping = false, lastFocus = null, prevOverflow = '';

  /* ------------------------------------------------------------------ the overlay */
  function shell() {
    if (root) return root;
    root = document.createElement('div');
    root.className = 'gbk';
    root.setAttribute('role', 'dialog');
    root.setAttribute('aria-modal', 'true');
    root.setAttribute('aria-label', 'The Moundshroud Codex: the Guide as a book');
    root.innerHTML =
      '<div class="gbk-stars"></div><div class="gbk-cone"></div><div class="gbk-floor"></div><div class="gbk-beams"></div><div class="gbk-dust" id="gbkDust"></div>' +
      '<div class="gbk-top">' +
        '<div class="gbk-brand"><span class="gbk-mark">M</span><div><b>The Moundshroud Codex</b><span>The Guide, page by page</span></div></div>' +
        '<span class="sp"></span><div class="gbk-here" id="gbkHere"></div>' +
        '<button class="gbk-tbtn" data-a="find" title="Search the book (C)">⌕ <span class="lbl">Contents</span></button>' +
        '<button class="gbk-tbtn" data-a="read" id="gbkRead" title="Read this chapter aloud (R)">🔊 <span class="lbl">Read</span></button>' +
        '<button class="gbk-tbtn" data-a="full" title="Full screen (F)">⛶</button>' +
        '<button class="gbk-tbtn close" data-a="close" title="Close (Esc)" aria-label="Close the book">✕</button>' +
      '</div>' +
      '<div class="gbk-stage">' +
        '<button class="gbk-arrow prev" data-a="prev" title="Previous chapter (←)" aria-label="Previous chapter">‹</button>' +
        '<div class="gbk-book" id="gbkBook">' +
          '<div class="gbk-edge l"></div><div class="gbk-edge r"></div>' +
          '<div class="gbk-pages">' +
            '<div class="gbk-leaf left"><div class="gbk-page"><div class="gbk-left" id="gbkLeft"></div><div class="gbk-pnum" id="gbkPnumL"></div></div></div>' +
            '<div class="gbk-leaf right"><div class="gbk-page"><div class="gbk-mobilehead" id="gbkMobile"></div>' +
              '<div class="gbk-right"><div class="gbk-rhead"><span class="gbk-rik" id="gbkRik"></span><b id="gbkRtitle"></b><span class="sp"></span><em id="gbkRmins"></em></div>' +
              '<div class="gbk-content" id="gbkContent"></div><div class="gbk-fade" id="gbkFade"></div><div class="gbk-more" id="gbkMore">↓ more</div></div>' +
              '<div class="gbk-pnum" id="gbkPnumR"></div></div></div>' +
          '</div>' +
          '<div class="gbk-scan"></div>' +
          '<div class="gbk-cover" id="gbkCover"><div class="gbk-coverin">' +
            '<div class="gbk-seal">M</div><div class="gbk-kicker">Moundshroud · your private assistant</div>' +
            '<h1>The Book of Everything</h1><p class="gbk-csub">Every room in Moundshroud, told page by page, on a book made of light.</p>' +
            '<div class="gbk-rule"></div><div class="gbk-cstats" id="gbkStats"></div>' +
            '<div class="gbk-cbtns"><button class="gbk-copen" data-a="open" id="gbkOpenBtn">Open the book</button><button class="gbk-csecond" data-a="toc">Look inside</button></div>' +
            '<div class="gbk-chint">Press <kbd>→</kbd> to turn a page · <kbd>C</kbd> for contents · <kbd>Esc</kbd> to close</div>' +
          '</div></div>' +
        '</div>' +
        '<button class="gbk-arrow next" data-a="next" title="Next chapter (→)" aria-label="Next chapter">›</button>' +
      '</div>' +
      '<div class="gbk-bottom">' +
        '<button class="gbk-nav" data-a="prev">← Previous</button>' +
        '<div class="gbk-prog"><div class="gbk-track"><i id="gbkBar"></i></div><div class="gbk-pmeta"><span id="gbkMeta"></span><span class="sp"></span><span class="gbk-dots" id="gbkDots"></span></div></div>' +
        '<button class="gbk-nav" data-a="next">Next →</button>' +
      '</div>' +
      '<div class="gbk-veil" data-a="tocclose"></div>' +
      '<aside class="gbk-toc" id="gbkToc" aria-label="Contents">' +
        '<div class="gbk-tochead"><b>Contents</b><span class="sp"></span><button data-a="cover" title="Back to the cover" aria-label="Back to the cover">⌂</button><button data-a="tocclose" title="Close contents" aria-label="Close contents">✕</button></div>' +
        '<div class="gbk-tocsearch"><input id="gbkQ" type="search" placeholder="Search the book…" autocomplete="off" spellcheck="false"><button class="gbk-chip" data-a="clearq" title="Clear the search">Clear</button></div>' +
        '<div class="gbk-tocfilter"><button class="gbk-chip" data-a="all" id="gbkAllChip">All chapters</button><button class="gbk-chip" data-a="essential" id="gbkEssChip">Highlights</button></div>' +
        '<div class="gbk-toclist" id="gbkTocList"></div>' +
        '<div class="gbk-tocfoot"><span id="gbkTocCount"></span><span class="sp"></span><span id="gbkTocRead"></span></div>' +
      '</aside>';
    document.body.appendChild(root);
    book = root.querySelector('#gbkBook');

    /* a little dust in the projector light */
    const dust = root.querySelector('#gbkDust');
    for (let i = 0; i < 22; i++) {
      const d = document.createElement('i');
      d.style.left = (6 + Math.random() * 88) + '%';
      d.style.animationDuration = (7 + Math.random() * 9) + 's';
      d.style.animationDelay = (-Math.random() * 12) + 's';
      d.style.width = d.style.height = (2 + Math.random() * 3).toFixed(1) + 'px';
      d.style.opacity = (0.25 + Math.random() * 0.5).toFixed(2);
      dust.appendChild(d);
    }

    root.addEventListener('click', onClick);
    root.querySelector('#gbkCover').addEventListener('click', e => { if (!e.target.closest('button')) openBook(); });
    const q = root.querySelector('#gbkQ');
    q.addEventListener('input', () => { query = q.value; renderTocList(); });
    q.addEventListener('keydown', e => {
      if (e.key === 'Enter') { e.preventDefault(); const first = root.querySelector('#gbkTocList .gbk-tocitem'); if (first) jumpTo(first.dataset.ch); }
      if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); closeToc(); }
    });
    root.querySelector('#gbkContent').addEventListener('scroll', updateScroll, { passive: true });
    document.addEventListener('keydown', onKey, true);
    return root;
  }

  function onClick(e) {
    const b = e.target.closest('[data-a]'); if (!b) return;
    const a = b.dataset.a;
    if (a === 'open') return openBook();
    if (a === 'close') return close();
    if (a === 'toc' || a === 'find') return openToc(true);
    if (a === 'tocclose') return closeToc();
    if (a === 'cover') { closeToc(); return cover(); }
    if (a === 'prev') return prev();
    if (a === 'next') return next();
    if (a === 'read') return toggleRead();
    if (a === 'full') return fullscreen();
    if (a === 'all') { onlyEssential = false; renderTocList(); return; }
    if (a === 'essential') { onlyEssential = true; renderTocList(); return; }
    if (a === 'clearq') { query = ''; const q = root.querySelector('#gbkQ'); if (q) { q.value = ''; q.focus(); } renderTocList(); return; }
    if (a === 'jump') { const id = b.dataset.ch; if (id) jumpTo(id); return; }
    if (a === 'action') {
      const ch = chapters[ix], act = ch && actionFor(ch);
      if (!act) return;
      close();
      setTimeout(() => { try { act.run(); } catch (er) { A.toast('That page could not be opened: ' + ((er && er.message) || 'unknown'), 4000); } }, 160);
      return;
    }
  }

  /* ------------------------------------------------------------------ cover and chrome */
  function cover() {
    if (!chapters.length) return;
    opened = false;
    root.classList.remove('open');
    stopRead();
    const last = clamp(+ls.get('gb_ix', '0') || 0, 0, chapters.length - 1);
    const btn = root.querySelector('#gbkOpenBtn');
    if (btn) btn.textContent = last > 0 ? 'Continue · Chapter ' + (last + 1) : 'Open the book';
    const stats = root.querySelector('#gbkStats');
    if (stats) stats.innerHTML = '<b>' + chapters.length + '</b> chapters · <b>' + parts.length + '</b> parts · <b>' + fmtMins(totalMins) + '</b> of reading';
    const read = root.querySelector('#gbkTocRead');
    if (read) read.textContent = seen.size + ' read';
    updateChrome();
  }

  function openBook(at) {
    if (!chapters.length) { A.toast('The Guide is still loading. Try again in a moment.'); return; }
    if (opened) { if (at != null) go(at, at > ix ? 1 : -1); return; }
    ix = at == null ? clamp(+ls.get('gb_ix', '0') || 0, 0, chapters.length - 1) : clamp(+at, 0, chapters.length - 1);
    opened = true;
    renderSpread();
    root.classList.add('open', 'opening');
    try { A.sfx && A.sfx.whoosh && A.sfx.whoosh(); } catch (e) { }
    setTimeout(() => root && root.classList.remove('opening'), 1200);
    savePos();
  }

  function savePos() { try { ls.set('gb_ix', String(ix)); } catch (e) { } }

  function renderSpread() {
    const ch = chapters[ix]; if (!ch) return;
    root.style.setProperty('--p', ch.part.hue);
    const left = root.querySelector('#gbkLeft');
    const action = actionFor(ch);
    left.innerHTML =
      '<div class="gbk-part"><i></i>Part ' + roman(ch.part.num) + ' · ' + esc(ch.part.title) + '</div>' +
      '<div class="gbk-chno">Chapter ' + ch.inPart + ' of ' + ch.part.chapters.length + ' in this part</div>' +
      '<div class="gbk-sigil"><span class="ring"></span><span class="ic">' + ch.icon + '</span></div>' +
      '<h2 class="gbk-chtitle">' + esc(ch.title) + '</h2>' +
      '<p class="gbk-summary">' + esc(ch.summary) + '</p>' +
      (ch.threads.length ? '<ul class="gbk-threads">' + ch.threads.map(t => '<li>' + esc(t) + '</li>').join('') + '</ul>' : '') +
      '<span class="sp"></span>' +
      (action ? '<button class="gbk-openbtn" data-a="action" data-ch="' + esc(ch.id) + '">' + esc(action.label) + '<span>→</span></button>' : '') +
      '<div class="gbk-leftfoot"><span>' + ch.mins + ' min read</span><span class="sp"></span><span>' + ch.words + ' words</span></div>';

    const mobile = root.querySelector('#gbkMobile');
    mobile.innerHTML = '<div class="gbk-part"><i></i>Part ' + roman(ch.part.num) + ' · ' + esc(ch.part.title) + '</div>' +
      '<h3>' + esc(ch.title) + '</h3><p class="gbk-summary">' + esc(ch.summary) + '</p>';

    root.querySelector('#gbkRik').textContent = ch.icon;
    root.querySelector('#gbkRtitle').textContent = ch.title;
    root.querySelector('#gbkRmins').textContent = ch.mins + ' min';
    const content = root.querySelector('#gbkContent');
    content.innerHTML = ch.html;
    content.scrollTop = 0;
    root.querySelector('#gbkPnumL').textContent = 'p. ' + (ix * 2 + 1);
    root.querySelector('#gbkPnumR').textContent = 'p. ' + (ix * 2 + 2);
    updateScroll();
    markSeen(ch.id);
    updateChrome();
    savePos();
  }

  function actionFor(ch) {
    const id = ch.id;
    if (id === 'customize') return { label: 'Open Settings · Appearance', run: () => A.settings && A.settings.open('appearance') };
    if (id === 'settings') return { label: 'Open Settings · Backup & data', run: () => A.settings && A.settings.open('data') };
    if (id === 'fixes') return { label: 'Open Settings · Walkthroughs & help', run: () => A.settings && A.settings.open('help') };
    if (id === 'privacy') return { label: 'Open Settings · Privacy', run: () => A.settings && A.settings.open('privacy') };
    if (id === 'keys' || id === 'anywhere') return { label: 'Open Settings · Shortcuts', run: () => A.settings && A.settings.open('keys') };
    if (id === 'storybook') return { label: 'Open Studio · Storybook & comic', run: () => { if (A.storybook) A.storybook.open(); else if (A.studio) A.studio.go('storybook'); } };
    if (STUDIO[id]) { const sub = STUDIO[id]; return { label: 'Open Studio · ' + studioName(sub), run: () => A.studio && A.studio.go(sub) }; }
    const tab = TAB[id];
    if (!tab) return null;
    const name = (A.tabs && A.tabs[tab] && A.tabs[tab].label) || tab;
    return { label: 'Open ' + name, run: () => A.showTab(tab) };
  }
  function studioName(id) {
    return { art: 'AI art', video: 'AI video', games: 'Game maker', composer: 'Composer', pixel: 'Studio', storybook: 'Storybook', godot: 'Game Studio' }[id] || id;
  }

  function updateChrome() {
    if (!root) return;
    const ch = chapters[ix];
    const here = root.querySelector('#gbkHere');
    if (here) here.innerHTML = (opened && ch) ? '<b>' + esc(ch.title) + '</b> · Part ' + roman(ch.part.num) : '<b>The cover</b> · ' + chapters.length + ' chapters';
    const bar = root.querySelector('#gbkBar');
    if (bar) bar.style.width = (opened && chapters.length) ? Math.round((ix + 1) / chapters.length * 100) + '%' : '0%';
    const meta = root.querySelector('#gbkMeta');
    if (meta) meta.innerHTML = (opened && ch) ? 'Chapter <b>' + (ix + 1) + '</b> of ' + chapters.length + ' · ' + esc(ch.part.title) + ' · ' + seen.size + ' read'
      : 'The cover · <b>' + chapters.length + '</b> chapters in ' + parts.length + ' parts · ' + seen.size + ' read';
    const dots = root.querySelector('#gbkDots');
    if (dots) dots.innerHTML = parts.map(p => '<i' + (ch && p.num === ch.part.num ? ' class="on"' : '') + ' title="' + esc(p.title) + '"></i>').join('');
    root.querySelectorAll('[data-a="prev"]').forEach(b => { b.disabled = !opened || ix <= 0; });
    root.querySelectorAll('[data-a="next"]').forEach(b => { b.disabled = opened && ix >= chapters.length - 1; });
    const read = root.querySelector('#gbkTocRead'); if (read) read.textContent = seen.size + ' read';
    updateReadBtn();
  }

  function updateScroll() {
    if (!root) return;
    const c = root.querySelector('#gbkContent'), fade = root.querySelector('#gbkFade'), more = root.querySelector('#gbkMore');
    if (!c) return;
    const has = c.scrollHeight - c.scrollTop - c.clientHeight > 14;
    if (fade) fade.classList.toggle('on', has);
    if (more) more.classList.toggle('on', has);
  }

  /* ------------------------------------------------------------------ turning pages */
  function go(i, dir) {
    if (!chapters.length) return;
    i = clamp(i, 0, chapters.length - 1);
    if (!opened) return openBook(i);
    if (i === ix || flipping) return;
    stopRead();
    const step = dir || (i > ix ? 1 : -1);
    if (reduced()) { ix = i; renderSpread(); return; }
    flipping = true;
    const leaf = document.createElement('div');
    leaf.className = 'gbk-flip ' + (step > 0 ? 'next' : 'prev');
    book.appendChild(leaf);
    try { A.sfx && A.sfx.flip && A.sfx.flip(); } catch (e) { }
    setTimeout(() => { if (!root) return; ix = i; renderSpread(); }, 320);
    setTimeout(() => { try { leaf.remove(); } catch (e) { } flipping = false; }, 760);
  }
  function next() {
    if (!opened) return openBook();
    if (ix >= chapters.length - 1) return A.toast('The end of the book. Press C for the contents, or Home to begin again.');
    go(ix + 1, 1);
  }
  function prev() {
    if (!opened) return;
    if (ix <= 0) return A.toast('This is the beginning. Press → to start reading.');
    go(ix - 1, -1);
  }

  /* ------------------------------------------------------------------ contents */
  function openToc(focusSearch) {
    if (!chapters.length) return;
    toc = true;
    root.classList.add('toc');
    renderToc();
    if (focusSearch) setTimeout(() => { const q = root.querySelector('#gbkQ'); if (q) { q.focus(); q.select(); } }, 90);
  }
  function closeToc() {
    toc = false;
    if (root) root.classList.remove('toc');
  }
  function renderToc() {
    if (!root) return;
    root.querySelector('#gbkAllChip').classList.toggle('on', !onlyEssential);
    root.querySelector('#gbkEssChip').classList.toggle('on', onlyEssential);
    const q = root.querySelector('#gbkQ');
    if (q && q.value !== query) q.value = query;
    renderTocList();
  }
  function renderTocList() {
    if (!root) return;
    const box = root.querySelector('#gbkTocList'); if (!box) return;
    const q = query.trim().toLowerCase();
    const hit = c => !q || (c.title + ' ' + c.text).toLowerCase().includes(q);
    const show = c => (!onlyEssential || ESSENTIAL.has(c.id)) && hit(c);
    const groups = parts.map(p => ({ p, list: p.chapters.filter(show) })).filter(g => g.list.length);
    const total = chapters.filter(show).length;
    box.innerHTML = groups.length ? groups.map(g =>
      '<div class="gbk-tocpart" style="--p:' + g.p.hue + '"><i></i>' + esc(g.p.title) + '<span></span></div>' +
      g.list.map(c => '<button class="gbk-tocitem' + (c.n - 1 === ix ? ' on' : '') + (seen.has(c.id) ? ' done' : '') + '" data-a="jump" data-ch="' + esc(c.id) + '">' +
        '<span class="n">' + String(c.n).padStart(2, '0') + '</span><span class="ic">' + c.icon + '</span>' +
        '<span class="t">' + esc(c.title) + '</span>' + (seen.has(c.id) ? '<span class="ck">✓</span>' : '<span class="r">' + c.mins + 'm</span>') + '</button>').join('')
    ).join('') : '<div class="gbk-tocnone">No chapter matches “' + esc(query.trim()) + '”.<br>Try a word like <i>chess</i>, <i>notes</i> or <i>privacy</i>.</div>';
    const count = root.querySelector('#gbkTocCount');
    if (count) count.textContent = total + ' of ' + chapters.length + ' chapters';
    const read = root.querySelector('#gbkTocRead');
    if (read) read.textContent = seen.size + ' read';
    const all = root.querySelector('#gbkAllChip'), ess = root.querySelector('#gbkEssChip');
    if (all) all.classList.toggle('on', !onlyEssential);
    if (ess) ess.classList.toggle('on', onlyEssential);
  }
  function jumpTo(id) {
    const i = byId[id];
    if (i == null) return;
    closeToc();
    if (!opened) return openBook(i);
    if (i === ix) { renderSpread(); return; }
    go(i, i > ix ? 1 : -1);
  }

  /* ------------------------------------------------------------------ reading aloud */
  function updateReadBtn() {
    const b = root && root.querySelector('#gbkRead'); if (!b) return;
    b.classList.toggle('on', reading);
    b.innerHTML = reading ? '❚❚ <span class="lbl">Stop</span>' : '🔊 <span class="lbl">Read</span>';
  }
  function stopRead() {
    if (!reading) return;
    reading = false;
    try { A.speech && A.speech.stop && A.speech.stop(); } catch (e) { }
    updateReadBtn();
  }
  async function toggleRead() {
    if (reading) return stopRead();
    const ch = chapters[ix]; if (!ch) return;
    if (!A.speech || !A.speech.speakAsync || !A.speech.available || !A.speech.available()) return A.toast('Read aloud is not available here.');
    reading = true; updateReadBtn();
    try { await A.speech.speakAsync(ch.title + '. ' + plain(ch.html)); } catch (e) { }
    if (reading) { reading = false; updateReadBtn(); }
  }

  /* ------------------------------------------------------------------ full screen */
  function fullscreen() {
    if (document.fullscreenElement) { document.exitFullscreen().catch(() => { }); return; }
    if (root.requestFullscreen) root.requestFullscreen().catch(() => A.toast('Full screen was refused by the window.'));
    else A.toast('Full screen is not available here.');
  }

  /* ------------------------------------------------------------------ keys */
  function onKey(e) {
    if (!root || !root.classList.contains('on')) return;
    const t = e.target, typing = t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable);
    if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); if (toc) closeToc(); else close(); return; }
    if (typing) return;
    const onButton = t && t.tagName === 'BUTTON';
    if (e.key === 'Tab') {
      const f = [...root.querySelectorAll('button,input,[tabindex]:not([tabindex="-1"])')].filter(el => el.offsetParent !== null && !el.disabled);
      if (!f.length) return;
      const first = f[0], last = f[f.length - 1];
      if (e.shiftKey && (document.activeElement === first || !root.contains(document.activeElement))) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && (document.activeElement === last || !root.contains(document.activeElement))) { e.preventDefault(); first.focus(); }
      return;
    }
    if (e.key === 'ArrowRight' || e.key === 'PageDown' || (e.key === ' ' && !e.shiftKey && !onButton)) { e.preventDefault(); e.stopPropagation(); next(); }
    else if (e.key === 'ArrowLeft' || e.key === 'PageUp' || (e.key === ' ' && e.shiftKey)) { e.preventDefault(); e.stopPropagation(); prev(); }
    else if (e.key === 'Home') { e.preventDefault(); e.stopPropagation(); closeToc(); openBook(0); }
    else if (e.key === 'End') { e.preventDefault(); e.stopPropagation(); closeToc(); openBook(chapters.length - 1); }
    else if (e.key === 'Enter' && !onButton) { e.preventDefault(); e.stopPropagation(); if (!opened) openBook(); }
    else if (e.key === 'c' || e.key === 'C' || e.key === '/') { e.preventDefault(); e.stopPropagation(); toc ? closeToc() : openToc(true); }
    else if (e.key === 'r' || e.key === 'R') { e.preventDefault(); e.stopPropagation(); toggleRead(); }
    else if (e.key === 'f' || e.key === 'F') { e.preventDefault(); e.stopPropagation(); fullscreen(); }
  }

  /* ------------------------------------------------------------------ open / close */
  function open(at) {
    if (!build()) { A.toast('The Guide has not loaded yet. Open Guide (F1) once, then try again.'); return; }
    lastFocus = document.activeElement;
    shell();
    const i = at == null ? null : (typeof at === 'number' ? at : byId[at]);
    if (!root.classList.contains('on')) {
      prevOverflow = document.body.style.overflow;
      document.body.style.overflow = 'hidden';
      root.classList.add('on');
      if (i != null) openBook(i); else cover();
      setTimeout(() => { const c = root.querySelector('[data-a="close"]'); if (c) c.focus(); }, 60);
    } else if (i != null) {
      if (!opened) openBook(i);
      else if (i !== ix) go(i, i > ix ? 1 : -1);
    }
  }
  function close() {
    if (!root) return;
    stopRead();
    closeToc();
    root.classList.remove('on', 'open');
    opened = false;
    document.body.style.overflow = prevOverflow || '';
    if (document.fullscreenElement && document.fullscreenElement === root) document.exitFullscreen().catch(() => { });
    try { if (lastFocus && lastFocus.focus) lastFocus.focus(); } catch (e) { }
  }

  A.guideBook = {
    open,
    close,
    cover,
    go(id) {
      const i = typeof id === 'number' ? id : byId[id];
      if (i == null || !chapters[i]) return;
      if (!root || !root.classList.contains('on')) return open(i);
      if (!opened) return openBook(i);
      jumpTo(chapters[i].id);
    },
    chapters: () => chapters.map(c => ({ id: c.id, title: c.title, part: c.part.title, n: c.n, mins: c.mins })),
    isOpen: () => !!(root && root.classList.contains('on'))
  };
})();

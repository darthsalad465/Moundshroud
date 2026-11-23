// The Bible as a book: the same holographic book the Guide opens (guide-book.js), drawn for Scripture.
// A cover that opens, two-page spreads (the book and its chapters on the left, the chapter itself on the right),
// page turns, and a contents drawer listing every book. Three public-domain versions: King James (default),
// World English Bible and Douay-Rheims. All the text is on this PC in web/data.
// Open it with A.bibleBook.open() (or .open(book, chapter)); the Spiritual > Library and the Bible page both link here.
(() => {
  if (typeof A === 'undefined' || typeof ls === 'undefined') return;

  const VERS = {
    kjv: { file: '/web/data/bible-kjv.json', name: 'King James Version', short: 'KJV', note: 'the 1611 translation, with the Apocrypha' },
    web: { file: '/web/data/bible-web.json', name: 'World English Bible', short: 'WEB', note: 'modern English, Catholic edition' },
    dr: { file: '/web/data/bible-dr.json', name: 'Douay-Rheims', short: 'D-R', note: 'Challoner revision, traditional Catholic wording' }
  };
  const VER_IDS = ['kjv', 'web', 'dr'];
  const PART = bk => bk.dc ? 2 : (bk.t === 'NT' ? 1 : 0);
  const PART_NAME = ['Old Testament', 'New Testament', 'Deuterocanonical books'];

  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const clamp = (n, lo, hi) => Math.max(lo, Math.min(hi, n));
  const reduced = () => { try { return matchMedia('(prefers-reduced-motion: reduce)').matches; } catch (e) { return false; } };
  const clean = t => String(t == null ? '' : t).replace(/\s+/g, ' ').trim();
  const nf = n => Number(n).toLocaleString();

  /* ------------------------------------------------------------------ the text: one fetch per version, kept */
  const loaded = {}, loading = {};
  function load(v) {
    if (loaded[v]) return Promise.resolve(loaded[v]);
    if (loading[v]) return loading[v];
    loading[v] = fetch(VERS[v].file).then(r => { if (!r.ok) throw new Error('HTTP ' + r.status); return r.json(); })
      .then(d => {
        const books = d.books || [];
        if (!books.length) throw new Error('no books');
        const totalCh = books.reduce((a, b) => a + b.ch.length, 0);
        let verses = 0; books.forEach(b => b.ch.forEach(c => { verses += (c.v || []).filter(Boolean).length; }));
        loaded[v] = { books, totalCh, verses, title: d.title || VERS[v].name };
        return loaded[v];
      }).catch(e => { delete loading[v]; throw e; });
    return loading[v];
  }

  /* ------------------------------------------------------------------ where the reader is */
  const saved = (() => { try { const p = JSON.parse(ls.get('bbk_pos', 'null')); return p && typeof p.b === 'number' ? p : null; } catch (e) { return null; } })();
  const st = {
    /* the book always opens in the King James Version, whatever was read last time; the reading position is kept */
    v: 'kjv',
    b: saved ? Math.max(0, saved.b | 0) : 0,
    c: saved ? Math.max(0, saved.c | 0) : 0,
    size: +ls.get('bbk_size', '18') || 18
  };
  const save = () => { try { ls.set('bbk_pos', JSON.stringify({ v: st.v, b: st.b, c: st.c })); } catch (e) { } };
  const D = () => loaded[st.v] || { books: [], totalCh: 0, verses: 0 };
  const books = () => D().books;
  const book = () => books()[st.b] || null;
  const chapter = () => { const bk = book(); return bk ? (bk.ch[st.c] || bk.ch[0] || { v: [] }) : { v: [] }; };
  const chapCount = () => (book() ? book().ch.length : 0);

  /* ------------------------------------------------------------------ the overlay */
  let root = null, opened = false, toc = false, flipping = false, query = '', lastFocus = null, prevOverflow = '', coverStats = '';

  function shell() {
    if (root) return root;
    root = document.createElement('div');
    root.className = 'gbk bbk';
    root.setAttribute('role', 'dialog');
    root.setAttribute('aria-modal', 'true');
    root.setAttribute('aria-label', 'The Holy Bible, opened as a book');
    root.innerHTML =
      '<div class="gbk-stars"></div><div class="gbk-cone"></div><div class="gbk-floor"></div><div class="gbk-beams"></div><div class="gbk-dust" id="bbkDust"></div>' +
      '<div class="gbk-top">' +
        '<div class="gbk-brand"><span class="gbk-mark">✝</span><div><b>The Holy Bible</b><span id="bbkVerSub">King James Version</span></div></div>' +
        '<span class="sp"></span><div class="gbk-here" id="bbkHere"></div>' +
        '<select class="bbk-sel" id="bbkTr" title="Which version to read" aria-label="Version">' +
          VER_IDS.map(v => '<option value="' + v + '">' + esc(VERS[v].name) + '</option>').join('') + '</select>' +
        '<button class="gbk-tbtn" data-a="find" title="Every book and chapter (C)">☰ <span class="lbl">Books</span></button>' +
        '<button class="gbk-tbtn" data-a="full" title="Full screen (F)">⛶</button>' +
        '<button class="gbk-tbtn close" data-a="close" title="Close (Esc)" aria-label="Close the book">✕</button>' +
      '</div>' +
      '<div class="gbk-stage">' +
        '<button class="gbk-arrow prev" data-a="prev" title="Previous chapter (←)" aria-label="Previous chapter">‹</button>' +
        '<div class="gbk-book" id="bbkBook">' +
          '<div class="gbk-edge l"></div><div class="gbk-edge r"></div>' +
          '<div class="gbk-pages">' +
            '<div class="gbk-leaf left"><div class="gbk-page"><div class="gbk-left" id="bbkLeft"></div><div class="gbk-pnum" id="bbkPnumL"></div></div></div>' +
            '<div class="gbk-leaf right"><div class="gbk-page"><div class="gbk-mobilehead" id="bbkMobile"></div>' +
              '<div class="gbk-right"><div class="gbk-rhead"><span class="gbk-rik">📖</span><b id="bbkRtitle"></b><span class="sp"></span><em id="bbkRright"></em></div>' +
              '<div class="gbk-content" id="bbkContent"></div><div class="gbk-fade" id="bbkFade"></div><div class="gbk-more" id="bbkMore">↓ more</div></div>' +
              '<div class="gbk-pnum" id="bbkPnumR"></div></div></div>' +
          '</div>' +
          '<div class="gbk-scan"></div>' +
          '<div class="gbk-cover" id="bbkCover"><div class="gbk-coverin">' +
            '<div class="gbk-seal">✝</div><div class="gbk-kicker">Moundshroud · your private assistant</div>' +
            '<h1>The Holy Bible</h1><p class="gbk-csub" id="bbkCsub">The King James Version, Genesis to Revelation, on a book made of light.</p>' +
            '<div class="gbk-rule"></div><div class="gbk-cstats" id="bbkStats"></div>' +
            '<div class="gbk-cbtns"><button class="gbk-copen" data-a="open" id="bbkOpenBtn">Open the book</button><button class="gbk-csecond" data-a="toc">Look inside</button></div>' +
            '<div class="gbk-chint">Press <kbd>→</kbd> to turn a page · <kbd>C</kbd> for the books · <kbd>Esc</kbd> to close</div>' +
          '</div></div>' +
        '</div>' +
        '<button class="gbk-arrow next" data-a="next" title="Next chapter (→)" aria-label="Next chapter">›</button>' +
      '</div>' +
      '<div class="gbk-bottom">' +
        '<button class="gbk-nav" data-a="prev">← Previous</button>' +
        '<div class="gbk-prog"><div class="gbk-track"><i id="bbkBar"></i></div><div class="gbk-pmeta"><span id="bbkMeta"></span><span class="sp"></span><span class="gbk-dots" id="bbkDots"></span></div></div>' +
        '<button class="gbk-nav" data-a="next">Next →</button>' +
      '</div>' +
      '<div class="gbk-veil" data-a="tocclose"></div>' +
      '<aside class="gbk-toc" id="bbkToc" aria-label="The books of the Bible">' +
        '<div class="gbk-tochead"><b>Books</b><span class="sp"></span><button data-a="cover" title="Back to the cover" aria-label="Back to the cover">⌂</button><button data-a="tocclose" title="Close" aria-label="Close the list">✕</button></div>' +
        '<div class="gbk-tocsearch"><input id="bbkQ" type="search" placeholder="Search the books…" autocomplete="off" spellcheck="false"><button class="gbk-chip" data-a="clearq" title="Clear the search">Clear</button></div>' +
        '<div class="gbk-toclist" id="bbkTocList"></div>' +
        '<div class="gbk-tocfoot"><span id="bbkTocCount"></span></div>' +
      '</aside>';

    document.body.appendChild(root);

    const dust = root.querySelector('#bbkDust');
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
    root.querySelector('#bbkCover').addEventListener('click', e => { if (!e.target.closest('button')) openBook(); });
    root.querySelector('#bbkContent').addEventListener('scroll', updateScroll, { passive: true });
    root.querySelector('#bbkTr').addEventListener('change', e => pickVersion(e.target.value));
    const q = root.querySelector('#bbkQ');
    q.addEventListener('input', () => { query = q.value; renderTocList(); });
    q.addEventListener('keydown', e => {
      if (e.key === 'Enter') { e.preventDefault(); const first = root.querySelector('#bbkTocList .gbk-tocitem'); if (first) jumpTo(+first.dataset.bk); }
      if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); closeToc(); }
    });
    document.addEventListener('keydown', onKey, true);
    return root;
  }

  function onClick(e) {
    const t = e.target.closest('[data-a],[data-bk],[data-ch]');
    if (!t || !root.contains(t)) return;
    if (t.dataset.ch != null) { const c = +t.dataset.ch; if (c !== st.c) go(st.b, c, c > st.c ? 1 : -1); return; }
    if (t.dataset.bk != null) return jumpTo(+t.dataset.bk);
    const a = t.dataset.a;
    if (a === 'open') return openBook();
    if (a === 'close') return close();
    if (a === 'find') return openToc(true);
    if (a === 'toc' || a === 'tocclose') return a === 'toc' ? openToc(true) : closeToc();
    if (a === 'cover') { closeToc(); return cover(); }
    if (a === 'prev') return prev();
    if (a === 'next') return next();
    if (a === 'full') return fullscreen();
    if (a === 'clearq') { query = ''; const q = root.querySelector('#bbkQ'); if (q) { q.value = ''; q.focus(); } renderTocList(); return; }
    if (a === 'bigger') return setSize(st.size + 1);
    if (a === 'smaller') return setSize(st.size - 1);
  }

  /* ------------------------------------------------------------------ the cover */
  function cover() {
    const d = D();
    if (!d.books.length) return;
    opened = false;
    root.classList.remove('open');
    const b = book();
    const btn = root.querySelector('#bbkOpenBtn');
    if (btn) btn.textContent = (b && (st.b || st.c)) ? 'Continue · ' + b.n + ' ' + (st.c + 1) : 'Open the book';
    const stats = root.querySelector('#bbkStats');
    coverStats = '<b>' + d.books.length + '</b> books · <b>' + nf(d.totalCh) + '</b> chapters · <b>' + nf(d.verses) + '</b> verses';
    if (stats) stats.innerHTML = coverStats;
    const sub = root.querySelector('#bbkCsub');
    if (sub) sub.textContent = VERS[st.v].name + ', Genesis to Revelation, on a book made of light.';
    const sel = root.querySelector('#bbkTr');
    if (sel && sel.value !== st.v) sel.value = st.v;
    updateChrome();
  }

  function openBook(b, c) {
    const d = D();
    if (!d.books.length) { A.toast('The Bible text has not loaded yet. Try again in a moment.'); return; }
    if (b != null) st.b = clamp(b | 0, 0, d.books.length - 1);
    if (c != null) st.c = clamp(c | 0, 0, d.books[st.b].ch.length - 1);
    st.c = clamp(st.c, 0, d.books[st.b].ch.length - 1);
    opened = true;
    renderSpread();
    root.classList.add('open', 'opening');
    try { A.sfx && A.sfx.whoosh && A.sfx.whoosh(); } catch (e) { }
    setTimeout(() => root && root.classList.remove('opening'), 1200);
    save();
  }

  /* ------------------------------------------------------------------ the spread */
  /* a chapter is read in paragraphs: breaks land on a verse that starts a sentence, never sooner than every few verses */
  function paraSet(verses) {
    const n = verses.length, every = clamp(Math.ceil(n / 6), 3, 8), out = new Set();
    let since = 0;
    for (let i = 0; i < n; i++) {
      since++;
      if (i < n - 1 && since >= every && /^["“'‘]?[A-Z0-9]/.test(clean(verses[i + 1]))) { out.add(i + 1); since = 0; }
    }
    return out;
  }
  function readHtml(ch) {
    const vs = ch.v || [], brk = paraSet(vs);
    let out = '', open = false;
    vs.forEach((t, i) => {
      const txt = clean(t);
      if (!txt) return;
      if (brk.has(i) || !open) { if (open) out += '</p>'; out += '<p>'; open = true; }
      else out += ' ';
      out += '<sup>' + (i + 1) + '</sup>' + esc(txt);
    });
    if (open) out += '</p>';
    return '<div class="bbk-read" style="--bbk-size:' + st.size + 'px">' + out + '</div>';
  }

  function renderSpread() {
    const bk = book(); if (!bk) return;
    const ch = chapter(), n = bk.ch.length;
    root.style.setProperty('--p', bk.dc ? '#b098d8' : (bk.t === 'NT' ? '#79e6ff' : '#e8c56a'));
    const sel = root.querySelector('#bbkTr');
    if (sel && sel.value !== st.v) sel.value = st.v;
    const vsub = root.querySelector('#bbkVerSub');
    if (vsub) vsub.textContent = VERS[st.v].name;

    /* left page: what book, which chapter, and every chapter of it to jump to */
    root.querySelector('#bbkLeft').innerHTML =
      '<div class="gbk-part"><i></i>' + esc(PART_NAME[PART(bk)]) + '</div>' +
      '<div class="gbk-chno" style="text-transform:none;letter-spacing:.04em;font-size:11px;color:#8f6f2e">Book ' + (st.b + 1) + ' of ' + D().books.length + ' · ' + esc(VERS[st.v].short) + '</div>' +
      '<div class="bbk-bookname">' + esc(bk.n) + '</div>' +
      '<p class="bbk-chline">Chapter ' + (st.c + 1) + ' of ' + n + ' · ' + (ch.v || []).filter(Boolean).length + ' verses</p>' +
      '<div class="bbk-grid">' + Array.from({ length: n }, (_, k) =>
        '<button class="bbk-ch' + (k === st.c ? ' on' : '') + '" data-ch="' + k + '" title="' + esc(bk.n + ' ' + (k + 1)) + '">' + (k + 1) + '</button>').join('') + '</div>' +
      '<div class="bbk-size"><span>Text</span><button data-a="smaller" title="Smaller text">A−</button><button data-a="bigger" title="Bigger text">A+</button></div>';

    /* the one-page view on small screens */
    root.querySelector('#bbkMobile').innerHTML =
      '<div class="gbk-part"><i></i>' + esc(PART_NAME[PART(bk)]) + '</div>' +
      '<h3>' + esc(bk.n) + ' ' + (st.c + 1) + '</h3>' +
      '<p class="gbk-summary">' + esc(VERS[st.v].name) + ' · chapter ' + (st.c + 1) + ' of ' + n + '</p>';

    root.querySelector('#bbkRtitle').textContent = bk.n + ' · chapter ' + (st.c + 1);
    root.querySelector('#bbkRright').textContent = VERS[st.v].short;
    const content = root.querySelector('#bbkContent');
    content.innerHTML = readHtml(ch);
    content.scrollTop = 0;
    root.querySelector('#bbkPnumL').textContent = 'The Holy Bible · ' + VERS[st.v].short;
    root.querySelector('#bbkPnumR').textContent = bk.n + ' ' + (st.c + 1);
    updateScroll();
    updateChrome();
    save();
  }

  /* ------------------------------------------------------------------ turning pages */
  function indexOf(b, c) { let n = 0; for (let i = 0; i < b; i++) n += books()[i].ch.length; return n + c; }
  function go(b, c, dir) {
    const d = D(); if (!d.books.length) return;
    b = clamp(b, 0, d.books.length - 1);
    c = clamp(c, 0, d.books[b].ch.length - 1);
    if (!opened) return openBook(b, c);
    if (b === st.b && c === st.c) return;
    if (flipping) return;
    const step = dir || (indexOf(b, c) > indexOf(st.b, st.c) ? 1 : -1);
    const apply = () => { st.b = b; st.c = c; renderSpread(); };
    if (reduced()) { apply(); return; }
    flipping = true;
    const leaf = document.createElement('div');
    leaf.className = 'gbk-flip ' + (step > 0 ? 'next' : 'prev');
    root.querySelector('#bbkBook').appendChild(leaf);
    try { A.sfx && A.sfx.flip && A.sfx.flip(); } catch (e) { }
    setTimeout(() => { if (root) apply(); }, 320);
    setTimeout(() => { try { leaf.remove(); } catch (e) { } flipping = false; }, 760);
  }
  function step(d) {
    let b = st.b, c = st.c + d;
    if (c < 0) { b = (b + books().length - 1) % books().length; c = books()[b].ch.length - 1; }
    else if (c >= books()[b].ch.length) { b = (b + 1) % books().length; c = 0; }
    go(b, c, d > 0 ? 1 : -1);
  }
  function next() { if (!opened) return openBook(); step(1); }
  function prev() { if (!opened) return openBook(); step(-1); }

  function setSize(n) {
    st.size = clamp(n, 14, 30);
    try { ls.set('bbk_size', String(st.size)); } catch (e) { }
    const r = root && root.querySelector('#bbkContent .bbk-read');
    if (r) r.style.setProperty('--bbk-size', st.size + 'px');
    updateScroll();
  }

  async function pickVersion(v) {
    if (!VERS[v] || v === st.v) return;
    const at = { b: st.b, c: st.c };
    let d;
    try { d = await load(v); } catch (e) { A.toast('That version could not be loaded.'); const s = root.querySelector('#bbkTr'); if (s) s.value = st.v; return; }
    st.v = v;
    try { ls.set('bbk_ver', v); } catch (e) { }
    st.b = clamp(at.b, 0, d.books.length - 1);
    st.c = clamp(at.c, 0, d.books[st.b].ch.length - 1);
    save();
    if (opened) renderSpread(); else cover();
  }

  function updateChrome() {
    if (!root) return;
    const bk = book();
    const here = root.querySelector('#bbkHere');
    if (here) here.innerHTML = (opened && bk) ? '<b>' + esc(bk.n) + ' ' + (st.c + 1) + '</b> · ' + esc(VERS[st.v].short) : '<b>The cover</b> · ' + D().books.length + ' books';
    const bar = root.querySelector('#bbkBar');
    const d = D();
    if (bar) bar.style.width = (opened && d.totalCh) ? Math.round((indexOf(st.b, st.c) + 1) / d.totalCh * 100) + '%' : '0%';
    const meta = root.querySelector('#bbkMeta');
    if (meta) meta.innerHTML = (opened && bk)
      ? '<b>' + esc(VERS[st.v].short) + '</b> · ' + esc(bk.n) + ' ' + (st.c + 1) + ' · chapter <b>' + (indexOf(st.b, st.c) + 1) + '</b> of ' + nf(d.totalCh)
      : 'The cover · <b>' + nf(d.totalCh) + '</b> chapters in ' + d.books.length + ' books';
    const dots = root.querySelector('#bbkDots');
    if (dots) dots.innerHTML = PART_NAME.map((nm, i) => {
      const on = (opened && bk) ? PART(bk) === i : false;
      return '<i' + (on ? ' class="on"' : '') + ' title="' + esc(nm) + '"></i>';
    }).join('');
    root.querySelectorAll('[data-a="prev"]').forEach(b => { b.disabled = !opened; });
    root.querySelectorAll('[data-a="next"]').forEach(b => { b.disabled = !opened; });
    const count = root.querySelector('#bbkTocCount');
    if (count) count.textContent = d.books.length + ' books · ' + nf(d.totalCh) + ' chapters · ' + VERS[st.v].short;
  }

  function updateScroll() {
    if (!root) return;
    const c = root.querySelector('#bbkContent'), fade = root.querySelector('#bbkFade'), more = root.querySelector('#bbkMore');
    if (!c) return;
    const has = c.scrollHeight - c.scrollTop - c.clientHeight > 14;
    if (fade) fade.classList.toggle('on', has);
    if (more) more.classList.toggle('on', has);
  }

  /* ------------------------------------------------------------------ the list of books */
  function openToc(focusSearch) {
    if (!D().books.length) return;
    toc = true;
    root.classList.add('toc');
    renderTocList();
    if (focusSearch) setTimeout(() => { const q = root.querySelector('#bbkQ'); if (q) { q.focus(); q.select(); } }, 90);
  }
  function closeToc() { toc = false; if (root) root.classList.remove('toc'); }
  function renderTocList() {
    if (!root) return;
    const box = root.querySelector('#bbkTocList'); if (!box) return;
    const q = query.trim().toLowerCase();
    const list = books().filter(b => !q || b.n.toLowerCase().includes(q) || PART_NAME[PART(b)].toLowerCase().includes(q) || (b.a || '').toLowerCase().includes(q));
    let h = '';
    [0, 1, 2].forEach(pi => {
      const group = list.filter(b => PART(b) === pi);
      if (!group.length) return;
      h += '<div class="gbk-tocpart" style="--p:' + ['#e8c56a', '#79e6ff', '#b098d8'][pi] + '"><i></i>' + PART_NAME[pi] + '<span></span></div>' +
        group.map(b => '<button class="gbk-tocitem' + (books().indexOf(b) === st.b ? ' on' : '') + '" data-bk="' + books().indexOf(b) + '">' +
          '<span class="n">' + (books().indexOf(b) + 1) + '</span><span class="ic">' + (b.dc ? '✚' : '📖') + '</span>' +
          '<span class="t">' + esc(b.n) + '</span><span class="r">' + b.ch.length + ' ch</span></button>').join('');
    });
    box.innerHTML = list.length ? h : '<div class="gbk-tocnone">No book matches “' + esc(query.trim()) + '”.</div>';
    const count = root.querySelector('#bbkTocCount');
    if (count) count.textContent = list.length + ' of ' + books().length + ' books · ' + nf(D().totalCh) + ' chapters';
  }
  function jumpTo(b) {
    if (!(b >= 0) || b >= books().length) return;
    closeToc();
    const c = b === st.b ? st.c : 0;
    if (!opened) return openBook(b, c);
    go(b, c, b > st.b ? 1 : -1);
  }

  /* ------------------------------------------------------------------ full screen and keys */
  function fullscreen() {
    if (document.fullscreenElement) { document.exitFullscreen().catch(() => { }); return; }
    if (root.requestFullscreen) root.requestFullscreen().catch(() => A.toast('Full screen was refused by the window.'));
    else A.toast('Full screen is not available here.');
  }
  function onKey(e) {
    if (!root || !root.classList.contains('on')) return;
    const t = e.target, typing = t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.tagName === 'SELECT' || t.isContentEditable);
    if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); if (toc) closeToc(); else close(); return; }
    if (typing) return;
    const onButton = t && t.tagName === 'BUTTON';
    if (e.key === 'Tab') {
      const f = [...root.querySelectorAll('button,input,select,[tabindex]:not([tabindex="-1"])')].filter(el => el.offsetParent !== null && !el.disabled);
      if (!f.length) return;
      const first = f[0], last = f[f.length - 1];
      if (e.shiftKey && (document.activeElement === first || !root.contains(document.activeElement))) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && (document.activeElement === last || !root.contains(document.activeElement))) { e.preventDefault(); first.focus(); }
      return;
    }
    if (e.key === 'ArrowRight' || e.key === 'PageDown' || (e.key === ' ' && !e.shiftKey && !onButton)) { e.preventDefault(); e.stopPropagation(); next(); }
    else if (e.key === 'ArrowLeft' || e.key === 'PageUp' || (e.key === ' ' && e.shiftKey)) { e.preventDefault(); e.stopPropagation(); prev(); }
    else if (e.key === 'Home') { e.preventDefault(); e.stopPropagation(); closeToc(); openBook(0, 0); }
    else if (e.key === 'End') { e.preventDefault(); e.stopPropagation(); closeToc(); const b = books().length - 1; openBook(b, books()[b].ch.length - 1); }
    else if (e.key === 'Enter' && !onButton) { e.preventDefault(); e.stopPropagation(); if (!opened) openBook(); }
    else if (e.key === 'c' || e.key === 'C' || e.key === '/') { e.preventDefault(); e.stopPropagation(); toc ? closeToc() : openToc(true); }
    else if (e.key === 'f' || e.key === 'F') { e.preventDefault(); e.stopPropagation(); fullscreen(); }
  }

  /* ------------------------------------------------------------------ open and close */
  async function open(b, c, v) {
    lastFocus = document.activeElement;
    shell();
    if (v && VERS[v]) { st.v = v; }
    if (!root.classList.contains('on')) {
      prevOverflow = document.body.style.overflow;
      document.body.style.overflow = 'hidden';
      root.classList.add('on');
      if (b == null) {   /* nothing asked for: go back to where the reader stopped */
        const p = (() => { try { return JSON.parse(ls.get('bbk_pos', 'null')); } catch (e) { return null; } })();
        if (p && typeof p.b === 'number') { st.b = p.b; st.c = p.c; }
      }
      root.querySelector('#bbkContent').innerHTML = '<div class="bbk-read" style="--bbk-size:' + st.size + 'px">Opening the Bible…</div>';
      try { await load(st.v); }
      catch (e) {
        root.classList.remove('on'); document.body.style.overflow = prevOverflow || '';
        A.toast('The Bible text could not be loaded (' + VERS[st.v].file + ').', 5000);
        return;
      }
      st.b = clamp(st.b, 0, books().length - 1);
      st.c = clamp(st.c, 0, books()[st.b].ch.length - 1);
      if (b != null) openBook(b, c); else cover();
      setTimeout(() => { const x = root.querySelector('[data-a="close"]'); if (x) x.focus(); }, 60);
    } else if (b != null) {
      if (!opened) openBook(b, c); else go(b, c);
    }
  }
  function close() {
    if (!root) return;
    closeToc();
    root.classList.remove('on', 'open');
    opened = false;
    document.body.style.overflow = prevOverflow || '';
    if (document.fullscreenElement && document.fullscreenElement === root) document.exitFullscreen().catch(() => { });
    try { if (lastFocus && lastFocus.focus) lastFocus.focus(); } catch (e) { }
  }

  A.bibleBook = {
    open: (b, c, v) => open(b, c, v),
    close,
    show: (b, c) => open(b, c),
    isOpen: () => !!(root && root.classList.contains('on')),
    versions: () => VER_IDS.map(id => ({ id, name: VERS[id].name, short: VERS[id].short }))
  };
})();

// Ctrl+K: the command palette. One box that finds anything (chats, notes, files, the offline library, every page and
// setting) and runs any command in the app. Everything a command needs to know comes from A.cmd (see commands.js), and
// each result shows why it matched and which key would have done the same thing.
(() => {
  let hits = [], hi = 0, seq = 0, t = null, el = null, input = null, box = null, back = null;

  const ICONS = { 'Go to': '▸', 'Do': '⚡', 'Look': '🎨', 'Help': '💡' };
  const clip = (s, n) => esc(String(s || '').replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').slice(0, n));

  const open = () => {
    close(false);
    /* A palette that is still fading out is still in the page for a moment, and its inner #ksq / #ksres would be found by
       getElementById BEFORE the new ones - so the results (and the typing handler) went into a box that was about to be
       removed, and the palette looked empty and dead. Anything left over is taken out first. */
    document.querySelectorAll('#cmdx, .cmdbox').forEach(n => { const w = n.closest('#cmdx') || n; w.remove(); });
    /* where the caret was, so closing the palette puts you back where you were instead of nowhere */
    try { const a = document.activeElement; back = a && a !== document.body && a !== document.documentElement && document.contains(a) && a.focus ? a : null; } catch (e) { back = null; }
    el = document.createElement('div'); el.id = 'cmdx'; el.setAttribute('role', 'dialog'); el.setAttribute('aria-label', 'Search and commands');
    el.innerHTML = '<div class="cmdbox"><div class="cmdhd"><span class="cmdic">🔎</span><input id="ksq" type="text" autocomplete="off" spellcheck="false" placeholder="Type to search, or run a command..."></div><div class="cmdbd" id="ksres"></div><div class="cmdf" id="ksf"></div></div>';
    document.body.appendChild(el);
    input = $('ksq'); box = $('ksres');
    document.documentElement.classList.add('cmding');
    el.onmousedown = e => { if (e.target === el) close(); };
    box.onclick = e => { const h = e.target.closest('.hit'); if (h && hits[+h.dataset.i]) go(hits[+h.dataset.i]); };
    document.addEventListener('keydown', onDoc, true);                  // Escape beats the app's own back-out, and never lets it navigate away underneath
    input.oninput = () => { clearTimeout(t); const v = input.value; hi = 0; draw(v, null); if (v.trim().length > 1) t = setTimeout(() => remote(v), 250); };
    input.onkeydown = e => {
      if (e.key === 'ArrowDown') { e.preventDefault(); hi = Math.min(hits.length - 1, hi + 1); mark(); }
      else if (e.key === 'ArrowUp') { e.preventDefault(); hi = Math.max(0, hi - 1); mark(); }
      else if (e.key === 'PageDown') { e.preventDefault(); hi = Math.min(hits.length - 1, hi + 6); mark(); }
      else if (e.key === 'PageUp') { e.preventDefault(); hi = Math.max(0, hi - 6); mark(); }
      else if (e.key === 'Home' && !input.value) { e.preventDefault(); hi = 0; mark(); }
      else if (e.key === 'Enter') { e.preventDefault(); if (hits[hi]) go(hits[hi]); }
      else if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); close(); }
    };
    draw('', null);
    input.focus();
    [30, 120, 320].forEach(ms => setTimeout(() => { if (el && document.activeElement !== input) input.focus(); }, ms));
  };

  const onDoc = e => {
    if (!el) return;
    if (e.key === 'Escape') { e.stopPropagation(); e.preventDefault(); close(); return; }
    /* Alt+1 to 9 would jump to another area behind the palette, and Ctrl+K would open a second one. Everything else -
       including AltGr characters, paste and the keys that belong to the text box - is left alone. */
    if (e.altKey && /^[1-9]$/.test(e.key || '')) e.stopPropagation();
    if ((e.ctrlKey || e.metaKey) && String(e.key || '').toLowerCase() === 'k') e.stopPropagation();
  };

  const close = (restore = true) => {
    if (!el) return;
    document.removeEventListener('keydown', onDoc, true);
    el.classList.add('out');
    const gone = el; el = null; input = null; box = null;
    setTimeout(() => gone.remove(), 120);                           /* open() sweeps up anything still fading before it builds the new one */
    document.documentElement.classList.remove('cmding');
    if (restore && back) { const to = back; back = null; setTimeout(() => { try { if (document.contains(to)) to.focus(); } catch (e) { } }, 60); }
  };

  const go = h => {
    if (!h) return;
    const fn = h.go || (h.cmd ? () => A.cmd.run(h.cmd) : null);
    if (!fn) return;
    close();
    try { fn(); } catch (e) { try { A.toast('That did not work: ' + (e && e.message ? e.message : 'unknown reason'), 4000); } catch (e2) { } }
  };

  const mark = () => {
    const rows = box ? box.querySelectorAll('.hit') : [];
    rows.forEach(r => r.classList.toggle('hi', +r.dataset.i === hi));
    const on = rows[hi]; if (on && on.scrollIntoView) on.scrollIntoView({ block: 'nearest' });
  };

  async function remote(v) {
    const my = ++seq; let r; try { r = await A.api('/api/search', { q: v }); } catch (e) { return; }
    if (my !== seq || !box) return; draw(v, r);
  }

  function draw(v, r) {
    if (!box) return;
    hits = [];
    let h = '';
    const grp = (name, items) => {
      if (!items.length) return;
      h += '<div class="grp">' + esc(name) + '</div>';
      items.forEach(it => { hits.push(it); h += '<div class="hit' + (it.cls ? ' ' + it.cls : '') + '" data-i="' + (hits.length - 1) + '">' + (it.ic || '') + '<span class="hbody">' + it.title + (it.sub ? '<span class="hsub">' + it.sub + '</span>' : '') + '</span>' + (it.keys ? '<kbd>' + esc(it.keys) + '</kbd>' : '') + '</div>'; });
    };
    const vt = v.trim(), first = (vt.split(/\s+/)[0].replace(/[^\p{L}'-]/gu, '') || vt).slice(0, 40);
    const cOnly = vt.charAt(0) === '>';

    if (vt) {
      const c = A.calc.try(vt); if (c) grp('Answer', [{ ic: '<span class="hic">🟰</span>', title: esc(c.label), sub: 'Click to copy', go: () => { A.copy(c.copy); } }]);
    }
    /* commands first: exact/prefix via A.cmd.find, topped up with MiniSearch fuzzy matching for typos */
    const qCmd = cOnly ? vt.slice(1) : vt;
    let found = A.cmd.find(qCmd, 26);
    if (qCmd.length > 1 && typeof window.MiniSearch === 'function') {
      try {
        const list = A.cmd.list();
        if (!open._ms || open._msN !== list.length) {
          const ms = new window.MiniSearch({ fields: ['title', 'sub', 'kw', 'group'], storeFields: ['id'], searchOptions: { prefix: true, fuzzy: 0.25, boost: { title: 2 } } });
          ms.addAll(list.map(c => ({ id: c.id, title: c.title || '', sub: c.sub || '', kw: Array.isArray(c.kw) ? c.kw.join(' ') : String(c.kw || ''), group: c.group || '' })));
          open._ms = ms; open._msN = list.length;
        }
        const seen = new Set(found.map(f => f.cmd.id));
        for (const hit of open._ms.search(qCmd).slice(0, 12)) {
          if (seen.has(hit.id)) continue;
          const cmd = A.cmd.byId(hit.id);
          if (cmd) { seen.add(hit.id); found.push({ cmd, at: [] }); }
        }
      } catch (e) { }
    }
    const byGroup = [];
    found.forEach(f => { const g = f.cmd.group || 'Do'; (byGroup.find(x => x.n === g) || (byGroup.push({ n: g, items: [] }), byGroup[byGroup.length - 1])).items.push({ cmd: f.cmd, at: f.at }); });
    byGroup.forEach(g => grp(g.n === 'Go to' ? 'Go to' : g.n, g.items.map(x => ({
      ic: '<span class="hic">' + esc(x.cmd.icon || ICONS[x.cmd.group] || '▸') + '</span>',
      title: A.cmd.mark(x.cmd.title, x.at), sub: x.cmd.sub ? esc(x.cmd.sub) : '', keys: x.cmd.keys, cmd: x.cmd
    }))));

    if (!cOnly) {
      if (vt) grp('Ask', [
        { ic: '<span class="hic">💬</span>', title: 'Ask the AI: ' + esc(vt.slice(0, 80)), sub: 'Answer using your files and libraries', go: () => { A.showTab('chat'); A.chat.ask(vt); } },
        { ic: '<span class="hic">📚</span>', title: 'Search the library for "' + esc(vt.slice(0, 60)) + '"', go: () => A.lib.search(vt) },
        { ic: '<span class="hic">📖</span>', title: 'Define "' + esc(first) + '"', go: () => A.lib.define(first) },
        { ic: '<span class="hic">🔤</span>', title: 'Synonyms for "' + esc(first) + '"', go: () => A.thes.open(first) },
        { ic: '<span class="hic">🎵</span>', title: 'Rhymes for "' + esc(first) + '"', go: () => A.rhyme.open(first) }
      ]);
      if (vt.length > 1 && A.finder) { const fr = A.finder.find(vt, 9); if (fr.length) grp('Find in Moundshroud', fr.map(e => ({ ic: '<span class="hic">' + esc(e.ic) + '</span>', title: esc(e.t), sub: esc(e.where), go: e.go }))); }
    }
    if (r) {
      grp('Notes', r.notes.map(x => ({ ic: '<span class="hic">📝</span>', title: esc(x.title), sub: clip(x.snippet, 120), go: () => { A.showTab('notes'); A.notes.openByPath(x.path); } })));
      grp('Files', r.docs.map(x => ({ ic: '<span class="hic">📄</span>', title: esc(x.title) + (x.page ? ' <span class="badge">p.' + x.page + '</span>' : ''), sub: clip(x.snippet, 120), go: () => A.viewer.open({ path: x.path, title: x.title, page: x.page, text: x.text }, vt) })));
      grp('Chats', r.chats.map(x => ({ ic: '<span class="hic">💬</span>', title: esc(x.title), sub: clip(x.snippet, 120), go: () => A.chat.load(x.id) })));
      grp('Library', r.library.map(x => ({ ic: '<span class="hic">📕</span>', title: esc(x.title), sub: esc(x.book), go: () => A.lib.openUrl(x.url, x.title) })));
    } else if (vt.length > 1 && !cOnly) h += '<div class="mute small" style="padding:8px 12px">Searching your own things...</div>';

    /* an empty box: what you used last, then the areas of the app */
    if (!vt) {
      const rec = A.cmd.recent().map(id => A.cmd.byId(id)).filter(Boolean).slice(0, 5);
      grp(rec.length ? 'Recently used' : 'Start here', (rec.length ? rec : ['Settings', 'Open the guide', 'Search everything', 'New chat'].map(t => A.cmd.list().find(c => c.title === t))).filter(Boolean).map(c => ({
        ic: '<span class="hic">' + esc(c.icon || '▸') + '</span>', title: A.cmd.mark(c.title, []), sub: c.sub ? esc(c.sub) : '', keys: c.keys, cmd: c
      })));
      grp('Go to', A.cmd.list().filter(c => (c.id || '').indexOf('tab:') === 0).slice(0, 14).map(c => ({
        ic: '<span class="hic">' + esc(c.icon || '▸') + '</span>', title: esc(c.title), sub: 'Open this area', cmd: c
      })));
    }

    box.innerHTML = h || '<div class="mute small" style="padding:14px 12px">Nothing matches "' + esc(vt) + '".</div>';
    mark();
    const f = $('ksf');
    if (f) f.innerHTML = '<span><kbd>↑</kbd><kbd>↓</kbd> choose</span><span><kbd>Enter</kbd> open</span><span><kbd>Esc</kbd> close</span><span class="sp"></span><span>' + (hits.length ? hits.length + ' result' + (hits.length === 1 ? '' : 's') : '') + '</span><span class="mute">start with <b>&gt;</b> for commands only</span>';
  }

  A.search = { open, close };
  $('gs').onclick = open;
})();

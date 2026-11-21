// Each tab keeps its own instance: when you switch away and come back, the tab is exactly as you left it — the draft in
// a box, the boxes you ticked, numbers you typed, which parts you had scrolled down. It is kept in memory only, never on
// disk, so a password box or a private page is never written anywhere and a reload starts fresh.
//
// A feature may keep its own state instead: A.state.hook('tab', { save, load }). Live things that must not be resumed by
// switching tabs (a timed game, a match in progress, a call) opt out with A.state.ephemeral('tab') or by returning true
// from a check function; any single control can opt out with data-nosave, and anything inside data-live is ignored.
(() => {
  const P = A.state = { mem: {}, hooks: {}, live: {} };
  const FIELD_CAP = 200000;      // one box never keeps more than this
  const TAB_CAP = 900000;        // and one tab never more than this
  const CSS = sel => String(sel).replace(/[^\w-]/g, m => '\\' + m);

  /* the most stable selector this control can be found by */
  const selFor = el => {
    if (!el || !el.tagName) return '';
    const tag = el.tagName.toLowerCase();
    if (el.id) return '#' + CSS(el.id);
    const nm = el.getAttribute && el.getAttribute('name');
    if (nm) return tag + '[name=' + CSS(nm) + ']';
    const ph = el.getAttribute && el.getAttribute('placeholder');
    if (ph) return tag + '[placeholder=' + CSS(ph) + ']';
    return '';
  };
  /* a way back to an element: its own stable name first (id, name, placeholder), then a chain of where it sat */
  function selOf(el, root) {
    if (!el || !el.tagName) return '';
    const own = selFor(el);
    if (own) return own;
    const bits = [];
    for (let n = el; n && n.nodeType === 1; n = n.parentElement) {
      if (n === root || !n.parentElement) break;
      if (n.id) { bits.unshift('#' + CSS(n.id)); break; }
      const nm = n.getAttribute && n.getAttribute('name');
      if (nm) { bits.unshift(n.tagName.toLowerCase() + '[name=' + CSS(nm) + ']'); break; }
      let i = 1;
      for (let s = n.previousElementSibling; s; s = s.previousElementSibling) if (s.tagName === n.tagName) i++;
      bits.unshift(n.tagName.toLowerCase() + ':nth-of-type(' + i + ')');
    }
    return bits.join('>');
  }
  const off = el => {
    if (!el || el.nodeType !== 1) return true;
    if (el.closest('[data-nosave],[data-live],[data-private]')) return true;
    const t = (el.getAttribute('type') || '').toLowerCase();
    return t === 'password' || t === 'file' || t === 'hidden';
  };
  const panelOf = name => document.getElementById('p-' + name);

  /* is this tab one that must not be resumed? a timed game, a live match, a call */
  function live(name) {
    const f = P.live[name];
    if (typeof f === 'function') { try { return !!f(); } catch (e) { return false; } }
    return !!f || !!(A.tabs[name] && A.tabs[name].ephemeral);
  }

  function fields(panel, name) {
    const out = {};
    let total = 0;
    panel.querySelectorAll('input,textarea,select,[contenteditable=""],[contenteditable="true"],details').forEach(el => {
      if (off(el)) return;
      const sel = selOf(el, panel);
      if (!sel) return;
      /* the record carries what the control is, so a redrawn page can never put this text into a different control */
      const who = { g: el.tagName, y: (el.getAttribute('type') || '').toLowerCase(), p: el.getAttribute('placeholder') || '', n: el.getAttribute('name') || '', l: el.getAttribute('aria-label') || '' };
      let rec = null;
      if (el.tagName === 'DETAILS') rec = Object.assign(who, { t: 'd', o: el.open ? 1 : 0 });
      else if (el.tagName === 'SELECT') rec = Object.assign(who, { t: 's', v: String(el.value).slice(0, 400) });
      else if (el.tagName === 'INPUT' && (el.type === 'checkbox' || el.type === 'radio')) rec = Object.assign(who, { t: 'c', c: el.checked ? 1 : 0 });
      else if (el.tagName === 'INPUT' && /^(range|color|number|date|time|month|week)$/.test(el.type)) rec = Object.assign(who, { t: 'v', v: String(el.value).slice(0, 200) });
      else {
        const v = el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' ? el.value : el.textContent;
        if (v == null) return;
        rec = Object.assign(who, { t: 'v', v: String(v).slice(0, FIELD_CAP), a: el.selectionStart, b: el.selectionEnd });
      }
      const size = (rec.v || '').length + 8;
      if (total + size > TAB_CAP) return;
      total += size;
      out[sel] = rec;
    });
    return out;
  }

  function scrolls(panel) {
    const out = {};
    const all = [panel].concat(Array.prototype.slice.call(panel.querySelectorAll('*'), 0, 2500));
    for (const el of all) {
      if (!el || el.nodeType !== 1) continue;
      if (!el.scrollTop && !el.scrollLeft) continue;
      if (off(el)) continue;
      const sel = selOf(el, panel) || ':root';
      out[sel] = { y: Math.round(el.scrollTop), x: Math.round(el.scrollLeft) };
    }
    return out;
  }

  /* save what the user can see and has typed in this tab, as it is right now */
  P.save = name => {
    try {
      if (!name || live(name)) { delete P.mem[name]; return; }
      const panel = panelOf(name);
      if (!panel) return;
      const hook = P.hooks[name];
      let mine = null;
      if (hook && hook.save) { try { mine = hook.save(); } catch (e) { mine = null; } }
      P.mem[name] = { f: fields(panel, name), s: scrolls(panel), m: mine, ts: Date.now() };
    } catch (e) { }
  };

  /* is this the same control the text came from, or a different one that happens to sit in the same place? */
  const same = (el, r) => {
    if (!el || !r || !r.g) return true;
    if (el.tagName !== r.g) return false;
    if ((el.getAttribute('type') || '') !== (r.y || '')) return false;
    if ((el.getAttribute('placeholder') || '') !== (r.p || '')) return false;
    if ((el.getAttribute('name') || '') !== (r.n || '')) return false;
    if ((el.getAttribute('aria-label') || '') !== (r.l || '')) return false;
    return true;
  };

  /* put it back, for every control that still exists. The first pass is exact; the retries only fill a control the page
     drew again and left empty, and never one the user is typing in, so a slow redraw gets its state back without ever
     overwriting new input. */
  P.load = name => {
    try {
      const rec = P.mem[name];
      if (!name || !rec || live(name)) return;
      const panel = panelOf(name);
      if (!panel) return;
      const one = k => { try { return panel.querySelector(k); } catch (e) { return null; } };
      const fill = soft => {
        for (const k of Object.keys(rec.f || {})) {
          const el = one(k), r = rec.f[k];
          if (!el || off(el) || !same(el, r)) continue;
          /* in the retries, only fill what the page left blank (a redraw throws away what was typed). A select has no
             "blank", so its remembered choice is put back whenever it is not the one that is showing. */
          const blank = el.tagName === 'DETAILS' || el.type === 'checkbox' || el.type === 'radio' || el.tagName === 'SELECT' || String(el.value || '').trim() === '';
          if (soft && (document.activeElement === el || !blank)) continue;
          try {
            if (r.t === 'd') { if (!soft || !el.open) el.open = !!r.o; }
            else if (r.t === 'c') el.checked = !!r.c;
            else if (r.t === 's' || r.t === 'v') {
              if (el.type === 'file') continue;
              if (el.value !== r.v) el.value = r.v;
              if (r.a != null && el.setSelectionRange && document.activeElement === el) el.setSelectionRange(r.a, r.b);
            }
          } catch (e) { }
        }
        for (const k of Object.keys(rec.s || {})) {
          const el = one(k) || (k === ':root' ? panel : null), r = rec.s[k];
          if (!el) continue;
          try { if (!soft || !el.scrollTop) { el.scrollTop = r.y; el.scrollLeft = r.x; } } catch (e) { }
        }
      };
      fill(false);
      requestAnimationFrame(() => fill(true));
      [60, 250, 800].forEach(ms => setTimeout(() => { if (A.cur === name) fill(true); }, ms));
      /* a page that draws itself again a moment later gets its state back too: for two seconds, every time the panel is
         redrawn, anything it left empty is filled again. A field the user starts typing in is never touched. */
      try {
        if (window.MutationObserver) {
          let t = 0, gone = 0;
          const obs = new MutationObserver(() => {
            clearTimeout(t);
            t = setTimeout(() => { if (A.cur === name) fill(true); }, 40);
          });
          obs.observe(panel, { childList: true, subtree: true });
          gone = setTimeout(() => obs.disconnect(), 2000);
        }
      } catch (e) { }
      const hook = P.hooks[name];
      if (hook && hook.load && rec.m != null) { try { hook.load(rec.m); } catch (e) { } }
    } catch (e) { }
  };

  /* a feature whose own state is not in the page's controls (a canvas, a list kept in a variable) can keep it here */
  P.hook = (name, h) => { P.hooks[name] = h || null; };
  /* mark a tab (or a condition) as live: it is never saved or resumed by switching tabs */
  P.ephemeral = (name, when) => { P.live[name] = when === undefined ? true : when; };
  P.forget = name => { delete P.mem[name]; };
  P.has = name => !!P.mem[name];
  /* what is remembered right now: for tests and for Settings › Problems */
  P.peek = name => P.mem[name] || null;
})();

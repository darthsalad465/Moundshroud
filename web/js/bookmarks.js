// Bookmarks: save your place in a book or a page (Library reader and Browser tabs) and jump back to the exact spot later.
// A bookmark keeps the address, the title, how far down you were and a few words of the text at the top of the screen, so it still finds the spot if the page layout changes.
// The last place you read in each page is also remembered, so "Continue reading" in the Library reopens a book where you stopped.
// A.bm.add(frame, where) · A.bm.open(bookmark) · A.bm.menu(anchor, ctx) · A.bm.render(el, where) · A.bm.track(frame, url) · A.bm.restore(frame, spot)
(() => {
  const KEY = 'bm_list', LAST = 'bm_last';
  const rd = (k, d) => { try { return JSON.parse(ls.get(k, JSON.stringify(d))); } catch (e) { return d; } };
  const esc = s => String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const list = () => rd(KEY, []), save = l => ls.set(KEY, JSON.stringify(l.slice(0, 300)));
  const norm = s => String(s || '').replace(/\s+/g, ' ').trim();
  /* where the reader is: fraction of the page scrolled, and the words at the top of the screen */
  function snap(fr) {
    if (fr && fr.lf) return fr._snap || null;            // a library page on its own address (libframe.js) keeps its spot up to date by message
    try {
      const w = fr.contentWindow, d = fr.contentDocument; if (!w || !d || !d.documentElement) return null; const de = d.documentElement, max = Math.max(1, de.scrollHeight - w.innerHeight), y = w.scrollY || de.scrollTop || 0;
      let q = ''; for (const yy of [60, 100, 160, 240]) { let el = d.elementFromPoint(Math.min(240, Math.max(20, w.innerWidth / 2)), yy); let n = 0; while (el && el !== d.body && norm(el.textContent).length > 400 && el.firstElementChild && n++ < 4) { const c = d.elementFromPoint(Math.min(240, Math.max(20, w.innerWidth / 2)), yy + 1); if (c === el) break; el = c; } const tx = norm(el && el.textContent); if (tx.length > 12) { q = tx.slice(0, 90); break; } }
      return { p: Math.min(1, y / max), y: Math.round(y), q };
    } catch (e) { return null; }
  }
  /* scroll the frame to a saved spot: first by the words, nearest to the saved fraction, otherwise by the fraction */
  function apply(fr, s) {
    try {
      const w = fr.contentWindow, d = fr.contentDocument; if (!w || !d || !d.body) return false; const de = d.documentElement, max = Math.max(1, de.scrollHeight - w.innerHeight); let target = null;
      const key = norm(s.q).slice(0, 40).toLowerCase();
      if (key.length >= 12) { const tw = d.createTreeWalker(d.body, NodeFilter.SHOW_TEXT); let n, seen = 0, best = null, bd = 1e9; while ((n = tw.nextNode()) && seen++ < 6000) { const t = norm(n.nodeValue).toLowerCase(); if (t.length < 6) continue; if (t.includes(key) || (key.includes(t) && t.length > 20)) { const r = d.createRange(); r.selectNodeContents(n); const top = r.getBoundingClientRect().top + (w.scrollY || de.scrollTop || 0), dist = Math.abs(top / max - (s.p || 0)); if (dist < bd) { bd = dist; best = top; } } } if (best !== null && bd < .2) target = best - 60; }
      if (target === null) target = (s.p || 0) * max;
      w.scrollTo(0, Math.max(0, target)); return true;
    } catch (e) { return false; }
  }
  /* the page may still be growing (images, long book pages): try a few times */
  function restore(fr, s) { if (!s) return; if (fr && fr.lf) return fr.lf.restore(s); [30, 400, 1400].forEach(ms => setTimeout(() => apply(fr, s), ms)); }
  /* remember the last place read in each page */
  function track(fr, url) {
    if (!url) return;
    const keep = s => { if (!s) return; const m = rd(LAST, {}); m[url] = { p: s.p, q: s.q, at: Date.now() }; const ks = Object.keys(m); if (ks.length > 250) ks.sort((a, b) => m[a].at - m[b].at).slice(0, ks.length - 250).forEach(k => delete m[k]); ls.set(LAST, JSON.stringify(m)); };
    if (fr && fr.lf) { let t = 0; if (fr._bmT) fr.removeEventListener('lfscroll', fr._bmT); fr._bmT = e => { clearTimeout(t); t = setTimeout(() => keep(e.detail && e.detail.s), 900); }; fr.addEventListener('lfscroll', fr._bmT); return; }
    try {
      const w = fr.contentWindow; let t = 0; w.addEventListener('scroll', () => { clearTimeout(t); t = setTimeout(() => { const s = snap(fr); if (!s) return; const m = rd(LAST, {}); m[url] = { p: s.p, q: s.q, at: Date.now() }; const ks = Object.keys(m); if (ks.length > 250) ks.sort((a, b) => m[a].at - m[b].at).slice(0, ks.length - 250).forEach(k => delete m[k]); ls.set(LAST, JSON.stringify(m)); }, 900); }, { passive: true });
    } catch (e) { }
  }
  const lastPos = url => rd(LAST, {})[url] || null;
  function add(fr, where, url, title, label) {
    const s = snap(fr) || { p: 0, q: '' }; const l = list(), b = { id: Date.now().toString(36) + Math.random().toString(36).slice(2, 5), u: url, t: title || url, w: where, p: s.p, q: s.q, at: Date.now(), l: label || '' };
    l.unshift(b); save(l); try { document.dispatchEvent(new Event('bmchange')); } catch (e) { } return b;
  }
  function remove(id) { save(list().filter(x => x.id !== id)); try { document.dispatchEvent(new Event('bmchange')); } catch (e) { } }
  const when = at => { const d = new Date(at); return d.toLocaleDateString([], { month: 'short', day: 'numeric' }); };
  const row = (b, here) => '<div class="hit" data-bo="' + b.id + '" style="display:flex;gap:8px;align-items:flex-start;padding:7px 9px;border-radius:9px;cursor:pointer' + (here ? ';background:var(--panel2)' : '') + '"><span>🔖</span><div style="flex:1;min-width:0"><b style="display:block;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">' + esc(b.l || b.t) + '</b><div class="small mute" style="overflow:hidden;text-overflow:ellipsis;white-space:nowrap">' + (b.q ? '“' + esc(b.q.slice(0, 60)) + '” · ' : '') + Math.round((b.p || 0) * 100) + '% · ' + when(b.at) + '</div></div><span data-bd="' + b.id + '" title="Delete this bookmark" style="opacity:.55;padding:0 4px">✕</span></div>';
  /* the pop-up menu: ctx = { where, frame: () => iframe|null, url: () => string, title: () => string, open: bookmark => void } */
  function menu(anchor, ctx) {
    const all = list().filter(b => b.w === ctx.where), cu = ctx.url ? ctx.url() : '';
    const html = '<div style="min-width:330px;max-width:430px;max-height:60vh;overflow:auto"><div class="row" style="align-items:center;margin-bottom:6px"><b>🔖 Bookmarks</b><span class="sp"></span><button class="pri" data-bm="add" ' + (cu ? '' : 'disabled title="Open a page or book first"') + '>＋ Bookmark this spot</button></div>' +
      (all.length ? all.map(b => row(b, b.u === cu)).join('') : '<div class="small mute" style="padding:8px 2px;line-height:1.5">No bookmarks yet. Open a book or page, scroll to where you want to come back to, then press <b>＋ Bookmark this spot</b>.</div>') + '</div>';
    const p = A.pop(anchor, html, 'left'); if (!p) return;
    p.onclick = e => {
      const dl = e.target.closest('[data-bd]'); if (dl) { e.stopPropagation(); remove(dl.dataset.bd); A.closePop(); A.toast('Bookmark removed'); return; }
      if (e.target.closest('[data-bm=add]')) { const fr = ctx.frame ? ctx.frame() : null, b = add(fr, ctx.where, cu, ctx.title ? ctx.title() : cu); A.closePop(); A.toast('🔖 Bookmarked at ' + Math.round(b.p * 100) + '%'); if (ctx.changed) ctx.changed(); return; }
      const o = e.target.closest('[data-bo]'); if (o) { const b = list().find(x => x.id === o.dataset.bo); A.closePop(); if (b) ctx.open(b); }
    };
    anchor.dataset.pop = '1';
  }
  /* a list of bookmarks inside a page (the Library home, the Browser homepage) */
  function render(el, where, open) {
    const all = list().filter(b => b.w === where).slice(0, 8); if (!el) return; if (!all.length) { el.innerHTML = ''; return; }
    el.innerHTML = '<div class="small mute" style="margin:0 0 6px">🔖 Your bookmarks</div>' + all.map(b => row(b, false)).join('');
    el.onclick = e => { const dl = e.target.closest('[data-bd]'); if (dl) { e.stopPropagation(); remove(dl.dataset.bd); render(el, where, open); return; } const o = e.target.closest('[data-bo]'); if (o) { const b = list().find(x => x.id === o.dataset.bo); if (b) open(b); } };
  }
  A.bm = { list, add, remove, snap, apply, restore, track, lastPos, menu, render };
})();

// Runs inside every offline library page (Wikipedia, Stack Exchange, books...). Library pages are served from their own
// address, separate from Moundshroud's, so a script inside a page cannot reach your data or the app. This small
// helper is the only link: it tells the Moundshroud window what it needs (the address, the title, where you are,
// a link under the pointer, a shortcut you pressed) and does what the window asks to this page only (dark styling,
// zoom, find, print, scroll to a bookmark, hand over the text). It answers nothing else and nobody else.
(() => {
  const me = document.currentScript, APP = me && me.dataset.app;
  if (!APP || window.parent === window) return;
  const send = o => { try { window.parent.postMessage(Object.assign({ lf: 1 }, o), APP); } catch (e) { } };
  const norm = s => String(s || '').replace(/\s+/g, ' ').trim();
  const here = () => location.pathname + location.search;

  /* where the reader is: fraction scrolled, and a few words at the top of the screen (bookmarks find the spot by these) */
  function snap() {
    const de = document.documentElement, w = window, max = Math.max(1, de.scrollHeight - w.innerHeight), y = w.scrollY || de.scrollTop || 0;
    let q = ''; for (const yy of [60, 100, 160, 240]) { let el = document.elementFromPoint(Math.min(240, Math.max(20, w.innerWidth / 2)), yy); let n = 0; while (el && el !== document.body && norm(el.textContent).length > 400 && el.firstElementChild && n++ < 4) { const c = document.elementFromPoint(Math.min(240, Math.max(20, w.innerWidth / 2)), yy + 1); if (c === el) break; el = c; } const tx = norm(el && el.textContent); if (tx.length > 12) { q = tx.slice(0, 90); break; } }
    return { p: Math.min(1, y / max), y: Math.round(y), q };
  }
  function restore(s) {
    const apply = () => {
      const de = document.documentElement, w = window, max = Math.max(1, de.scrollHeight - w.innerHeight); let target = null;
      const key = norm(s.q).slice(0, 40).toLowerCase();
      if (key.length >= 12) { const tw = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT); let n, seen = 0, best = null, bd = 1e9; while ((n = tw.nextNode()) && seen++ < 6000) { const t = norm(n.nodeValue).toLowerCase(); if (t.length < 6) continue; if (t.includes(key) || (key.includes(t) && t.length > 20)) { const r = document.createRange(); r.selectNodeContents(n); const top = r.getBoundingClientRect().top + (w.scrollY || de.scrollTop || 0), dist = Math.abs(top / max - (s.p || 0)); if (dist < bd) { bd = dist; best = top; } } } if (best !== null && bd < .2) target = best - 60; }
      if (target === null) target = typeof s.y === 'number' && !s.p ? s.y : (s.p || 0) * max;
      w.scrollTo(0, Math.max(0, target));
    };
    [30, 400, 1400].forEach(ms => setTimeout(apply, ms));     // the page may still be growing (images, long book pages)
  }

  /* commands from the Moundshroud window: only these, only from it */
  addEventListener('message', e => {
    if (e.source !== window.parent || e.origin !== APP) return; const m = e.data || {}; if (!m.lf || !m.cmd) return;
    let r = null;
    try {
      if (m.cmd === 'css') { let st = document.getElementById('lfcss'); if (!st) { st = document.createElement('style'); st.id = 'lfcss'; (document.head || document.documentElement).appendChild(st); } st.textContent = String(m.css || ''); }
      else if (m.cmd === 'zoom') document.documentElement.style.zoom = +m.z || 1;
      else if (m.cmd === 'restore') restore(m.s || {});
      else if (m.cmd === 'scrollTo') window.scrollTo(0, +m.y || 0);
      else if (m.cmd === 'text') r = (document.body ? document.body.innerText : '').trim().slice(0, 200000);
      else if (m.cmd === 'find') { const q = String(m.q || ''); const n = q ? (document.body.innerText.toLowerCase().split(q.toLowerCase()).length - 1) : 0; if (n) window.find(q, false, !!m.back, true, false, false, false); r = n; }
      else if (m.cmd === 'clearFind') { const s = getSelection(); if (s) s.removeAllRanges(); }
      else if (m.cmd === 'print') { window.focus(); window.print(); }
      else if (m.cmd === 'reload') location.reload();
      else if (m.cmd === 'stop') window.stop();
      else if (m.cmd === 'snap') r = snap();
      else if (m.cmd === 'focus') window.focus();
    } catch (x) { r = null; }
    if (m.id) send({ ev: 'reply', id: m.id, r });
  });

  /* telling the window what happened */
  const loaded = () => send({ ev: 'load', url: here(), title: document.title || '' });
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', loaded); else loaded();
  addEventListener('load', () => send({ ev: 'ready', url: here(), title: document.title || '', s: snap() }));
  let st = 0; addEventListener('scroll', () => { clearTimeout(st); st = setTimeout(() => send({ ev: 'scroll', s: snap() }), 250); }, { passive: true });
  document.addEventListener('mouseover', e => { const a = e.target.closest && e.target.closest('a[href]'); if (!a) return send({ ev: 'hover', h: '' }); let h = ''; try { const l = new URL(a.href, location.href); h = l.origin === location.origin && /^\/wiki\//.test(l.pathname) ? (norm(a.textContent).slice(0, 70) || decodeURIComponent(l.pathname.split('/').pop())) : l.href; } catch (x) { h = a.getAttribute('href') || ''; } send({ ev: 'hover', h }); });
  document.addEventListener('mouseout', () => send({ ev: 'hover', h: '' }));
  document.addEventListener('mouseup', e => { if (e.button === 3) { e.preventDefault(); send({ ev: 'back' }); } else if (e.button === 4) { e.preventDefault(); send({ ev: 'fwd' }); } else { const s = String(getSelection() || '').trim(); if (s.length > 2 && s.length < 600) send({ ev: 'sel', t: s }); } });
  const newTab = (e, a) => { try { const l = new URL(a.href, location.href); if (l.origin === location.origin && /^\/wiki\//.test(l.pathname)) { e.preventDefault(); send({ ev: 'newtab', url: l.pathname + l.search, title: norm(a.textContent).slice(0, 40) }); } } catch (x) { } };
  document.addEventListener('click', e => { const a = e.target.closest && e.target.closest('a[href]'); if (a && (e.ctrlKey || e.metaKey)) newTab(e, a); });
  document.addEventListener('auxclick', e => { if (e.button !== 1) return; const a = e.target.closest && e.target.closest('a[href]'); if (a) newTab(e, a); });
  /* shortcuts belong to the window (tabs, find, zoom, back...), so they are passed on instead of acting on the page */
  document.addEventListener('keydown', e => {
    const c = e.ctrlKey || e.metaKey, k = e.key || '';
    const ours = (c && /^(t|w|l|f|d|r|h|p|k|n|=|\+|-|0|tab)$/i.test(k)) || (c && e.shiftKey && /^b$/i.test(k)) || (e.altKey && /^(ArrowLeft|ArrowRight|Home)$/.test(k)) || k === 'F5' || k === 'F1' || k === 'F9' || k === 'Escape';
    if (!ours) return; e.preventDefault();
    send({ ev: 'key', key: k, code: e.code, ctrlKey: e.ctrlKey, metaKey: e.metaKey, altKey: e.altKey, shiftKey: e.shiftKey });
  }, true);
})();

// Focus mode for every tab: hide the top bar and the tab menu so the page you are working in gets the whole window.
// The games have had this since the arcade got its own focus button; this is the same idea for the rest of the app.
// ⤢ in the top bar or Ctrl+Shift+F turns it on; a small floating bar (faint until you point at it) turns it off or
// goes full screen; Esc leaves focus mode (unless a dialog is open, which Esc closes first). Alt+1..9 and Ctrl+K still
// move between tabs while the menu is hidden.
(() => {
  const css = `html.afocus body>header,html.afocus #nav{display:none!important}
#afx{position:fixed;bottom:10px;right:12px;z-index:9997;display:flex;gap:4px;align-items:center;padding:3px;border-radius:10px;background:rgba(14,16,22,.82);border:1px solid var(--line);box-shadow:0 2px 12px rgba(0,0,0,.5);opacity:.28;transition:opacity .2s}
#afx:hover,#afx:focus-within{opacity:1}
#afx .ib{padding:4px 9px;font-size:12.5px}
#afx b{font-size:11.5px;color:var(--mute);padding:0 6px;font-weight:600}
#afbtn.on{background:var(--acc);color:#fff}`;
  const st = document.createElement('style'); st.textContent = css; document.head.appendChild(st);
  const h = document.documentElement;
  const tabName = () => { try { return (A.tabs[A.cur] || {}).label || ''; } catch (e) { return ''; } };
  function bar(on) {
    let x = document.getElementById('afx');
    if (!on) { if (x) x.remove(); return; }
    if (!x) {
      x = document.createElement('div'); x.id = 'afx';
      x.innerHTML = '<b id="afxt"></b><button class="ib" data-f="full" title="Full screen (F11)">⛶ Full screen</button><button class="ib" data-f="exit" title="Bring back the top bar and tabs (Esc or Ctrl+Shift+F)">⤡ Exit focus</button>';
      x.onclick = e => { const b = e.target.closest('[data-f]'); if (!b) return; if (b.dataset.f === 'exit') set(false); else full(); };
      document.body.appendChild(x);
    }
    x.querySelector('#afxt').textContent = tabName();
  }
  function full() {
    try { if (document.fullscreenElement) document.exitFullscreen(); else h.requestFullscreen(); } catch (e) { A.toast('Full screen is not available here. F11 may work.'); }
  }
  function set(on) {
    on = !!on; h.classList.toggle('afocus', on); ls.set('app_focus', on ? '1' : '0'); bar(on);
    const b = document.getElementById('afbtn'); if (b) b.classList.toggle('on', on);
    if (!on && document.fullscreenElement) { try { document.exitFullscreen(); } catch (e) { } }
    try { window.dispatchEvent(new Event('resize')); } catch (e) { }
  }
  A.focusMode = { set, toggle: () => set(!h.classList.contains('afocus')), on: () => h.classList.contains('afocus') };

  /* the button, at the right of the top bar */
  const add = () => {
    const head = document.querySelector('body>header'); if (!head || document.getElementById('afbtn')) return;
    const b = document.createElement('button'); b.className = 'ib'; b.id = 'afbtn'; b.textContent = '⤢'; b.title = 'Focus mode: hide the top bar and tabs (Ctrl+Shift+F)';
    b.onclick = () => A.focusMode.toggle(); head.appendChild(b);
  };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', add); else add();

  /* keys: Ctrl+Shift+F toggles; Esc leaves focus mode when nothing else is open */
  const DIALOG = '#setx, .nw-read, .modal.on, .pop, [role="dialog"], #cmdk, .overlay.on, #pfx';
  window.addEventListener('keydown', e => {
    if (e.ctrlKey && e.shiftKey && !e.altKey && (e.key === 'F' || e.key === 'f')) { e.preventDefault(); e.stopImmediatePropagation(); A.focusMode.toggle(); return; }
    if (e.key === 'Escape' && h.classList.contains('afocus') && !document.querySelector(DIALOG) && !document.fullscreenElement) { e.preventDefault(); e.stopImmediatePropagation(); set(false); }
  }, true);
  /* keep the tab's name in the floating bar current */
  setInterval(() => { if (h.classList.contains('afocus')) { const t = document.getElementById('afxt'); if (t && t.textContent !== tabName()) t.textContent = tabName(); } }, 800);
})();

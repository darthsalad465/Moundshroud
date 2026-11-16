// Line numbers for every piece of code in the app. Read-only code (code blocks in Chat and the Browser's answers, Godot
// files, agent diffs, code the chat ran, anything marked data-code) gets a number column that stays put when the code
// scrolls sideways. Code you type in (the coding lessons and playground, the Game maker and Godot editors, any
// textarea marked data-code) becomes a small editor: numbers that follow the scroll, Tab indents, Shift+Tab un-indents.
// Everything is found by a watcher on the page, so new code views only need data-code to join in.
(() => {
  const PRE = 'pre > code, pre.god-code, pre.agdiff, pre.runcode, pre.gmk-src, pre[data-code]';
  const TA = 'textarea.cl-ed, textarea[data-code]';
  const count = s => { s = String(s || ''); if (s.endsWith('\n')) s = s.slice(0, -1); return s.split('\n').length; };
  const nums = n => { let o = ''; for (let i = 1; i <= n; i++) o += i + (i < n ? '\n' : ''); return o; };

  /* read-only: a sticky column inside the <pre>, so the code's own box, colours and Copy button stay as they were */
  function numberPre(pre) {
    if (!pre || pre.closest('.cv-skip')) return;
    let g = pre.querySelector(':scope > .cv-g');      // not always first: Chat puts ▶ Run in front of it
    const code = pre.querySelector(':scope > code'), text = code ? code.textContent : [...pre.childNodes].filter(n => n !== g && !(n.classList && n.classList.contains('cp'))).map(n => n.textContent).join('');
    if (!text.trim()) { if (g) g.remove(); return; }
    const n = count(text);
    if (!g) { g = document.createElement('span'); g.className = 'cv-g'; g.setAttribute('aria-hidden', 'true'); pre.insertBefore(g, pre.firstChild); pre.classList.add('cv-n'); }
    if (g.dataset.n !== String(n)) { g.dataset.n = n; g.textContent = nums(n); }
  }
  /* editable: the textarea goes into a box with a number column that scrolls with it */
  function editor(ta) {
    if (!ta || ta.dataset.cv) return;
    /* code you type in now belongs to the full editor (web/js/code-ed.js): colouring, tabs, find, palette */
    if (window.CodeEd && window.CodeEd.upgrade) { ta.dataset.cv = '1'; return window.CodeEd.upgrade(ta); }
    ta.dataset.cv = '1';
    const box = document.createElement('div'); box.className = 'cv-ed';
    const g = document.createElement('div'); g.className = 'cv-eg'; g.setAttribute('aria-hidden', 'true');
    const cs = getComputedStyle(ta);
    g.style.font = cs.font; g.style.lineHeight = cs.lineHeight; g.style.paddingTop = cs.paddingTop; g.style.paddingBottom = cs.paddingBottom;
    ta.parentNode.insertBefore(box, ta); box.appendChild(g); box.appendChild(ta);
    ta.setAttribute('wrap', 'off'); ta.style.whiteSpace = 'pre'; ta.style.overflowX = 'auto';
    const upd = () => { const n = count(ta.value); if (g.dataset.n !== String(n)) { g.dataset.n = n; g.textContent = nums(n); } g.scrollTop = ta.scrollTop; };
    ta.addEventListener('input', upd); ta.addEventListener('scroll', () => { g.scrollTop = ta.scrollTop; });
    /* Tab indents (two spaces, or the selected lines); Shift+Tab takes it away */
    ta.addEventListener('keydown', e => {
      if (e.key !== 'Tab' || e.ctrlKey || e.altKey || e.metaKey || ta.readOnly) return;
      e.preventDefault(); const v = ta.value, a = ta.selectionStart, b = ta.selectionEnd, ls = v.lastIndexOf('\n', a - 1) + 1;
      if (a === b && !e.shiftKey) { ta.setRangeText('  ', a, b, 'end'); }
      else { const le = v.indexOf('\n', b - (b > a && v[b - 1] === '\n' ? 1 : 0)); const end = le < 0 ? v.length : le, block = v.slice(ls, end);
        const out = e.shiftKey ? block.replace(/^( {1,2}|\t)/gm, '') : block.replace(/^/gm, '  '); ta.setRangeText(out, ls, end, 'select'); }
      ta.dispatchEvent(new Event('input', { bubbles: true }));
    });
    /* code set from a script (no input event) is caught here */
    const desc = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value');
    Object.defineProperty(ta, 'value', { configurable: true, get() { return desc.get.call(this); }, set(v) { desc.set.call(this, v); setTimeout(upd, 0); } });
    upd();
  }
  function scan(root) {
    if (!root || !root.querySelectorAll) return;
    if (root.matches && root.matches(TA)) editor(root);
    root.querySelectorAll(TA).forEach(editor);
    const pres = new Set(); if (root.matches && root.matches(PRE)) pres.add(root.tagName === 'PRE' ? root : root.parentElement);
    root.querySelectorAll(PRE).forEach(el => pres.add(el.tagName === 'PRE' ? el : el.parentElement));
    pres.forEach(numberPre);
  }
  let pending = new Set(), queued = false;
  const flush = () => { queued = false; const l = [...pending]; pending.clear(); l.forEach(n => { if (n.isConnected) { const pre = n.closest && n.closest('pre'); if (pre && pre.matches('pre.god-code, pre.agdiff, pre.runcode, pre.gmk-src, pre[data-code]') || (pre && pre.querySelector(':scope > code'))) numberPre(pre); else scan(n); } }); };
  const mo = new MutationObserver(ms => {
    for (const m of ms) {
      const t = m.target.nodeType === 1 ? m.target : m.target.parentElement; if (!t || (t.closest && t.closest('.cv-g, .cv-eg'))) continue;
      if (m.type === 'childList') m.addedNodes.forEach(n => { if (n.nodeType === 1 && !n.classList.contains('cv-g')) pending.add(n); else if (n.nodeType === 3) pending.add(t); });
      pending.add(t);
    }
    if (!queued && pending.size) { queued = true; setTimeout(flush, 30); }      // a timer, so a window in the background still gets its numbers
  });
  const start = () => { scan(document.body); mo.observe(document.body, { childList: true, subtree: true, characterData: true }); };
  /* after the page is parsed, so web/js/code-ed.js (loaded next) is there to take the editable code */
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start); else start();
  window.CodeView = { scan, editor, numberPre, count };
})();

// Keeps the app usable when something goes wrong.
// 1. After every tab switch, a quick check that the page you are looking at is the one that gets your clicks. If a
//    hidden page or a left-over layer is in the way (that once froze every page), it is moved aside and recorded.
// 2. "Fix the screen" (Ctrl+K, or F9) closes anything stuck open and re-opens the page.
(() => {
  const note = (t, w) => { try { A.problems && A.problems.push('guard', t, w || ''); } catch (e) { } };
  const OK_OVER = '#ov, #dlg, #phview, #wk, .wk, #cmpc, #cmp, .nt, #toasts, .toast, #afx, .tour, #pop, .pop, [role=dialog], #cmdk, .cmdk, #focusbar';
  const desc = el => el ? el.tagName.toLowerCase() + (el.id ? '#' + el.id : '') + (typeof el.className === 'string' && el.className ? '.' + el.className.trim().split(/\s+/).slice(0, 2).join('.') : '') : '?';

  /* is the page in front really the one under the pointer? */
  function check() {
    const cur = A.cur, panel = document.getElementById('p-' + cur), main = panel && panel.parentElement; if (!panel || !main) return { ok: true };
    const r = main.getBoundingClientRect(); if (r.width < 50 || r.height < 50) return { ok: true };
    const pts = [[.5, .5], [.25, .3], [.75, .7]].map(([fx, fy]) => [r.left + r.width * fx, r.top + r.height * fy]);
    for (const [x, y] of pts) {
      const el = document.elementFromPoint(x, y); if (!el) continue;
      if (panel.contains(el) || el.closest(OK_OVER)) continue;
      const other = el.closest('.panel');
      if (other && other !== panel) { other.classList.remove('on'); note('A hidden page (' + other.id + ') was covering ' + cur + ' and was moved aside.'); return { ok: false, fixed: true, what: other.id }; }
      if (el === document.documentElement || el === document.body || el === main) continue;      // the page edge, a gap, or a page change still settling
      return { ok: false, fixed: false, what: desc(el) };
    }
    return { ok: true };
  }
  let tk = 0;
  const later = () => { clearTimeout(tk); tk = setTimeout(() => { const r = check(); if (!r.ok && !r.fixed) note('Something may be covering the ' + A.cur + ' page: ' + r.what); }, 900); };

  /* clear everything that can be left stuck open, then open the page again */
  function repair(quiet) {
    const done = [];
    try { if (document.getElementById('ov') && document.getElementById('ov').classList.contains('on')) { A.closeDlg(); done.push('a dialog'); } } catch (e) { }
    try { A.closePop(); } catch (e) { }
    ['phview'].forEach(id => { const e = document.getElementById(id); if (e) { e.remove(); done.push('the photo viewer'); } });
    try { if (A.walk && A.walk.stop) A.walk.stop(); } catch (e) { }
    document.querySelectorAll('.panel.on').forEach(p => { if (p.id !== 'p-' + A.cur) { p.classList.remove('on'); done.push('a hidden page'); } });
    try { document.body.style.pointerEvents = ''; document.documentElement.style.pointerEvents = ''; } catch (e) { }
    const r = check();
    try { A.showTab(A.cur || 'home'); } catch (e) { }
    if (!quiet) A.toast(done.length || (r.fixed) ? 'Fixed: closed ' + (done.length ? done.join(', ') : 'something covering the page') + '.' : (r.ok ? 'The screen looks fine: nothing was stuck.' : 'Something unexpected is covering the page (' + r.what + '). Close and reopen Moundshroud if it stays.'), 4500);
    note('Fix the screen' + (done.length ? ': ' + done.join(', ') : ''));
    return { done, check: r };
  }

  /* run the check after every tab switch, whoever switched it */
  const wrap = () => { const s = A.showTab; if (!s || s._guard) return; A.showTab = Object.assign(function (n) { const out = s.apply(this, arguments); later(); return out; }, { _guard: 1 }); };
  wrap(); setTimeout(wrap, 1500);                       // again, in case another file wrapped it later
  setTimeout(later, 2500);                              // and once the app has finished starting

  /* F9 (Esc is not used: on Today with nothing open, Esc closes Moundshroud) */
  A.guard = { check, repair };
  try { if (A.keys && A.keys.reg) A.keys.reg([{ combo: 'F9', label: 'Fix the screen: close anything stuck open and reopen the page', group: 'Everywhere', run: () => repair() }]); else addEventListener('keydown', e => { if (e.key === 'F9') { e.preventDefault(); repair(); } }); } catch (e) { }
  try { if (A.cmd && A.cmd.reg) A.cmd.reg([{ title: 'Fix the screen', sub: 'If buttons stop responding: closes anything stuck open and reopens the page (also F9)', icon: '🩹', group: 'Do', keys: 'F9', tags: 'fix repair stuck frozen broken not working click unresponsive screen', run: () => repair() }]); } catch (e) { }
})();

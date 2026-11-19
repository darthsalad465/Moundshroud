// Smooth tab bars: a sliding indicator that follows the active tab, the active tab scrolled into view, edge fades and wheel scrolling on long bars.
// All the looks are in /web/pro.css; this file only measures things and sets CSS variables (--ink-x, --ink-w, --ink-y, --ink-h).
(() => {
  /* Safety net: if the new look ever leaves the top bar broken or unreadable, Moundshroud switches itself back to the classic look.
     Add ?classic to the address (or ?pro) to force either way; Settings > Appearance has a switch too. */
  const root = document.documentElement, q = location.search;
  if (/[?&]classic\b/.test(q)) ls.set('nopro', '1'); if (/[?&]pro\b/.test(q)) ls.set('nopro', '0');
  if (ls.get('nopro', '0') === '1') root.classList.add('nopro');
  const lum = c => { const m = String(c).match(/[\d.]+/g); if (!m || m.length < 3) return 0; const f = x => { x = +x / 255; return x <= .03928 ? x / 12.92 : Math.pow((x + .055) / 1.055, 2.4); }; return .2126 * f(m[0]) + .7152 * f(m[1]) + .0722 * f(m[2]); };
  const contrast = (a, b) => { const x = lum(a), y = lum(b); return (Math.max(x, y) + .05) / (Math.min(x, y) + .05); };
  let strikes = 0;
  const health = () => {
    if (document.hidden || root.classList.contains('nopro') || root.classList.contains('sh')) return;
    const h = document.querySelector('header'), n = document.getElementById('nav'); if (!h || !n) return;
    const bs = [...n.querySelectorAll('button')], hr = h.getBoundingClientRect(), nr = n.getBoundingClientRect(), shown = bs.filter(b => { const r = b.getBoundingClientRect(), s = getComputedStyle(b); return r.width > 4 && r.height > 8 && s.visibility !== 'hidden' && +s.opacity > .1; });
    const bg = getComputedStyle(document.body).backgroundColor, readable = shown.filter(b => contrast(getComputedStyle(b).color, bg) > 1.6).length;
    const broken = hr.height < 28 || nr.height < 22 || bs.length < 5 || shown.length < 3 || readable < 2;
    strikes = broken ? strikes + 1 : 0;
    if (strikes >= 2) { root.classList.add('nopro'); ls.set('nopro', '1'); try { A.toast('The top bar looked wrong, so Moundshroud switched back to the classic look. You can turn the new look on again in Settings → Appearance.', 7000); } catch (e) { } }
  };
  setTimeout(health, 2000); setTimeout(health, 7000);
  const BARS = { '#nav': 'line', '#tsub': 'seg', '#psub': 'bar', '#ssub': 'glow', '#plsub': 'tile', '#fasub': 'serif', '#actabs': 'rail', '#hbar': 'seg', '#snav': 'side' };
  const place = c => {
    const a = c.querySelector(':scope > button.on, :scope > .on'); if (!a) { c.style.setProperty('--ink-w', '0px'); return; }
    c.style.setProperty('--ink-x', a.offsetLeft + 'px'); c.style.setProperty('--ink-w', a.offsetWidth + 'px'); c.style.setProperty('--ink-y', a.offsetTop + 'px'); c.style.setProperty('--ink-h', a.offsetHeight + 'px'); c.classList.add('inked');
    /* bring the active tab into view only when the active tab changed. Doing it on every repaint pulled the bar back
       each time someone scrolled it, so tabs past the edge of the window could never be reached. */
    const moved = c._lastOn !== a; c._lastOn = a;
    if (moved && c.scrollWidth > c.clientWidth + 4 && c.dataset.ink !== 'side') { const want = a.offsetLeft - (c.clientWidth - a.offsetWidth) / 2; try { c.scrollTo({ left: Math.max(0, want), behavior: c._ink === 2 ? 'smooth' : 'auto' }); } catch (e) { c.scrollLeft = want; } }
    fades(c);
  };
  const fades = c => { const max = c.scrollWidth - c.clientWidth; c.classList.toggle('fade-l', max > 4 && c.scrollLeft > 6); c.classList.toggle('fade-r', max > 4 && c.scrollLeft < max - 6); if (c.id === 'nav') arrows(c); };
  /* the main tab bar: when some tabs do not fit, an arrow at each end says so and moves the bar. They sit over the bar's
     ends (outside it, because the bar fades its own edges) and follow its position. */
  let arrL = null, arrR = null;
  const arrows = c => {
    if (!arrL) {
      const mk = (cls, ch, label, dir) => { const b = document.createElement('button'); b.type = 'button'; b.className = 'navarrow ' + cls; b.textContent = ch; b.title = label; b.setAttribute('aria-label', label); b.onclick = () => { const n = document.getElementById('nav'); if (n) n.scrollBy({ left: dir * Math.max(160, n.clientWidth * .6), behavior: 'smooth' }); }; document.body.appendChild(b); return b; };
      arrL = mk('l', '‹', 'Show the tabs to the left', -1); arrR = mk('r', '›', 'Show more tabs', 1);
    }
    const r = c.getBoundingClientRect(), max = c.scrollWidth - c.clientWidth, shown = r.height > 8 && max > 4;
    [arrL, arrR].forEach(b => { b.style.top = r.top + 'px'; b.style.height = r.height + 'px'; });
    arrL.style.left = r.left + 'px'; arrR.style.left = (r.right - 30) + 'px';
    arrL.classList.toggle('on', shown && c.scrollLeft > 6); arrR.classList.toggle('on', shown && c.scrollLeft < max - 6);
  };
  /* words beside the icon-only buttons in the top bar; pro/style CSS hides them (.hl) when the window is narrow */
  const HL = { gs: 'Search', hist: 'History', cog: 'Settings', afbtn: 'Focus' };
  const labels = () => Object.keys(HL).forEach(id => { const b = document.getElementById(id); if (!b || b.querySelector('.hl') || b.closest('header') !== document.querySelector('body > header')) return; const s = document.createElement('span'); s.className = 'hl'; s.textContent = HL[id]; b.appendChild(s); if (!b.getAttribute('aria-label')) b.setAttribute('aria-label', HL[id]); });
  const bind = (c, kind) => {
    if (c._ink) return; c._ink = 1; c.dataset.ink = kind; let raf = 0;
    const later = () => { cancelAnimationFrame(raf); raf = requestAnimationFrame(() => { place(c); c._ink = 2; }); };
    new MutationObserver(recs => { if (recs.every(r => r.type === 'attributes' && r.target === c)) return; later(); }).observe(c, { childList: true, subtree: true, attributes: true, attributeFilter: ['class'] });      // the bar's own class changes (edge fades) are not a reason to re-place it
    c.addEventListener('scroll', () => fades(c), { passive: true });
    c.addEventListener('wheel', e => { if (kind === 'side' || c.scrollWidth <= c.clientWidth + 4 || Math.abs(e.deltaY) <= Math.abs(e.deltaX)) return; c.scrollLeft += e.deltaY; e.preventDefault(); }, { passive: false });
    addEventListener('resize', later); later();
  };
  let scanT = 0;
  const scan = () => {
    if (document.hidden) return;
    Object.keys(BARS).forEach(sel => document.querySelectorAll(sel).forEach(c => bind(c, BARS[sel])));
    labels();
    if (!root.classList.contains('sh')) { const n = document.getElementById('nav'); if (n) arrows(n); }
  };
  const scanSoon = ms => { clearTimeout(scanT); scanT = setTimeout(scan, ms || 80); };
  scan(); setTimeout(scan, 1000);
  document.addEventListener('click', () => scanSoon(80), true);
  addEventListener('resize', () => scanSoon(120), { passive: true });
  addEventListener('focus', () => scanSoon(60));
})();

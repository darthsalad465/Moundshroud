// Motion and efficiency: animated tab switching, and pausing every animation while Moundshroud is hidden or not in front (so it stays cool in the background).
(() => {
  const root = document.documentElement, orig = A.showTab;
  const cfg = () => (window.OA_CUSTOM ? window.OA_CUSTOM.cfg() : { tx: 'slide', anim: 1 });
  const EASE = 'cubic-bezier(.2,.8,.2,1)';
  const KF = {
    slide: d => [{ opacity: 0, transform: 'translateX(' + (d * 42) + 'px)' }, { opacity: 1, transform: 'none' }],
    fade: () => [{ opacity: 0 }, { opacity: 1 }],
    zoom: () => [{ opacity: 0, transform: 'scale(.94)' }, { opacity: 1, transform: 'none' }],
    rise: () => [{ opacity: 0, transform: 'translateY(26px)' }, { opacity: 1, transform: 'none' }],
    flip: d => [{ opacity: 0, transform: 'perspective(900px) rotateY(' + (d * 14) + 'deg) translateX(' + (d * 24) + 'px)' }, { opacity: 1, transform: 'none' }],
    drop: () => [{ opacity: 0, transform: 'translateY(-26px) scale(.985)' }, { opacity: 1, transform: 'none' }],
  };
  let bar = null;
  const sweep = () => {
    if (!bar) { bar = document.createElement('div'); bar.id = 'txbar'; bar.style.cssText = 'position:fixed;left:0;right:0;top:0;height:2px;z-index:9999;pointer-events:none;transform-origin:left;opacity:0;background:linear-gradient(90deg,transparent,var(--acc),var(--acc2),transparent)'; document.body.appendChild(bar); }
    bar.getAnimations().forEach(a => a.cancel());
    bar.animate([{ transform: 'scaleX(0)', opacity: 1 }, { transform: 'scaleX(1)', opacity: 1, offset: .6 }, { transform: 'scaleX(1)', opacity: 0 }], { duration: 520, easing: 'ease-out' });
  };
  A.showTab = name => {
    const from = A.order.indexOf(A.cur), same = name === A.cur;
    if (name !== 'play' && A.music) A.music.stop();      // theme songs only play in Entertainment
    orig(name);
    if (window.OA_VT) return;        // the motion layer changes pages with a real cross-fade; two animations at once would fight
    const c = cfg(), tx = c.tx === undefined ? 'slide' : c.tx;
    if (same || !tx || tx === 'none' || !c.anim || !KF[tx] || document.hidden || document.body.classList.contains('lowpower') || (A.motion && A.motion.still && A.motion.still())) return;
    const p = document.getElementById('p-' + name); if (!p || !p.animate) return;
    p.getAnimations().forEach(a => a.cancel());
    p.animate(KF[tx](A.order.indexOf(name) >= from ? 1 : -1), { duration: 380, easing: EASE });
    sweep();
  };
  root.dataset.fx = '1';       // the panel's own CSS entrance is replaced by the animation above

  /* pause decorative motion when nobody is looking */
  const idle = () => { const i = document.hidden || !document.hasFocus(); root.classList.toggle('idle', i); const m = document.querySelector('.mark'); if (m && m.pauseAnimations) i ? m.pauseAnimations() : m.unpauseAnimations(); };
  addEventListener('blur', idle); addEventListener('focus', idle); document.addEventListener('visibilitychange', idle); idle();
})();

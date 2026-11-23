// The fake pop-up virus the Cyber Desktop catches: open a phishing message's link, or land on one of the trapped fake
// sites in the browser, and the desktop fills with badly behaved pop-ups. They are harmless DOM windows inside the
// guest desktop — closing one spawns another, exactly as they do in real life — and the anti-malware window that
// appears part-way through cleans the lot up and says what actually happened.
(() => {
  /* A is the app's own object (a top-level binding in core.js, not a window property) */
  const pick = list => list[(Math.random() * list.length) | 0];
  const int = (lo, hi) => lo + ((Math.random() * (hi - lo + 1)) | 0);

  const TITLES = ['System Alert', 'Windows Security Center', 'Your PC is infected!', 'Antivirus expired',
    'Cleanup required', '7 threats found', 'Your files are being encrypted', 'Browser update required',
    'MoundShroud Shield™', 'Warning: 3 viruses detected', 'Your subscription has expired', 'Disk is full'];
  const BODIES = ['Your computer is at risk. Click below to remove 3 viruses immediately.',
    'Your antivirus protection has expired. Renew now to stay safe.',
    'We detected 7 infected files. Clean them before they spread.',
    'Your browser is out of date. Update now to avoid data loss.',
    'Your files are being encrypted. Do not turn off your computer.',
    '51 people in your area are infected. Scan now.',
    'Your licence expired yesterday. Your PC is unprotected.',
    'A background download is using 94% of your disk. Remove it now?'];
  const BUTTONS = [['Remove virus', 'clean'], ['Scan now', 'scan'], ['Update now', 'scan'], ['Fix now', 'clean']];

  let layer = null, host = null, timer = null, spawned = 0, top = 0, limit = 20, cleaned = false, cleanWin = null, opts = null, lastTrap = 0;
  let api = null;

  function place(el) {
    const w = Math.max(320, host.clientWidth || 900), h = Math.max(260, host.clientHeight || 560);
    el.style.left = Math.max(6, int(6, Math.max(8, w - 300))) + 'px';
    el.style.top = Math.max(6, int(8, Math.max(10, h - 170))) + 'px';
  }

  function spawn() {
    if (!layer || cleaned) return null;
    spawned++;
    const win = document.createElement('div');
    win.className = 'cd-virus-pop';
    const title = pick(TITLES);
    win.innerHTML = '<header><b>⚠ ' + title + '</b><button type="button" data-virus-close aria-label="Close">✕</button></header>' +
      '<p>' + pick(BODIES) + '</p><div class="cd-virus-btns"></div>';
    const btns = win.querySelector('.cd-virus-btns');
    for (const [label, kind] of [pick(BUTTONS), ['Remind me later', 'close']]) {
      const b = document.createElement('button');
      b.type = 'button';
      b.textContent = label;
      b.dataset.virusBtn = kind;
      btns.append(b);
    }
    place(win);
    win.style.zIndex = String(9000 + spawned);
    win.addEventListener('pointerdown', () => { win.style.zIndex = String(9000 + (++top)); }, true);
    layer.append(win);
    drag(win);
    return win;
  }

  function drag(win) {
    const bar = win.querySelector('header');
    let sx = 0, sy = 0, ox = 0, oy = 0, on = false;
    bar.addEventListener('pointerdown', event => {
      if (event.target.closest('button')) return;
      on = true;
      sx = event.clientX; sy = event.clientY;
      ox = parseFloat(win.style.left) || 0; oy = parseFloat(win.style.top) || 0;
      bar.setPointerCapture?.(event.pointerId);
    });
    bar.addEventListener('pointermove', event => {
      if (!on) return;
      win.style.left = Math.max(0, ox + event.clientX - sx) + 'px';
      win.style.top = Math.max(0, oy + event.clientY - sy) + 'px';
    });
    const end = () => { on = false; };
    bar.addEventListener('pointerup', end);
    bar.addEventListener('pointercancel', end);
  }

  /* the one honest window: it says what this is, and its button actually works */
  function offerCleanup() {
    if (cleanWin || cleaned) return;
    cleanWin = document.createElement('div');
    cleanWin.className = 'cd-virus-pop cd-virus-clean';
    cleanWin.innerHTML = '<header><b>MoundShroud anti-malware</b></header>' +
      '<p>This is the practice machine, so nothing here is real: those windows are a fake virus, and this one is the way out.</p>' +
      '<p class="small">The lesson is real. A link in an email, or a pop-up on a site you did not mean to visit, is enough. ' +
      'Close the windows, run a scan, and never type a password into a page that asked for it in a message.</p>' +
      '<button type="button" class="cd-primary" data-virus-clean-btn>🧹 Run anti-malware and clean the desktop</button>';
    cleanWin.style.left = '50%';
    cleanWin.style.top = '42%';
    cleanWin.style.transform = 'translate(-50%,-50%)';
    cleanWin.style.zIndex = '9999';
    layer.append(cleanWin);
  }

  function burst(n) {
    for (let i = 0; i < n && spawned < limit; i++) spawn();
  }

  function finish() {
    if (cleaned) return;
    cleaned = true;
    clearInterval(timer);
    timer = null;
    const count = spawned;
    layer?.remove();
    layer = null; cleanWin = null; top = 0;
    A.toast?.('🧹 Desktop cleaned. ' + count + ' fake pop-up' + (count === 1 ? '' : 's') + ' removed. Nothing real was ever at risk.', 6000);
    try { opts?.onClean?.(count); } catch (e) { }
    api = null;
    host = null;
  }

  function start(desktopEl, options) {
    if (!desktopEl) return null;
    opts = options || {};
    if (layer && host === desktopEl) {
      /* already infected: another trap makes it worse, but never in a runaway loop of re-renders */
      if (Date.now() - lastTrap > 1500) { burst(3); offerCleanup(); }
      lastTrap = Date.now();
      return api;
    }
    cleanup();
    host = desktopEl;
    lastTrap = Date.now();
    cleaned = false;
    spawned = 0;
    limit = Math.min(24, (opts.limit || 14) + int(0, 4));
    layer = document.createElement('div');
    layer.className = 'cd-virus';
    layer.dataset.virusLayer = '1';
    layer.setAttribute('role', 'presentation');
    layer.addEventListener('click', event => {
      const pop = event.target.closest('.cd-virus-pop');
      if (!pop) return;
      if (event.target.closest('[data-virus-clean-btn]')) { finish(); return; }
      if (event.target.closest('[data-virus-close]') || event.target.closest('[data-virus-btn="close"]')) {
        /* closing one of these has never once helped */
        pop.remove();
        burst(1);
        offerCleanup();
        return;
      }
      if (event.target.closest('[data-virus-btn]')) {
        burst(2);
        pop.classList.add('cd-virus-shake');
        A.toast?.('That button made two more appear. Nothing in these windows is a real button.', 4000);
        offerCleanup();
      }
    });
    desktopEl.append(layer);
    burst(3);
    timer = setInterval(() => {
      if (cleaned) return;
      if (spawned >= limit) { clearInterval(timer); timer = null; offerCleanup(); return; }
      if (spawned >= 5) offerCleanup();
      burst(1);
    }, 900);
    setTimeout(() => { if (!cleaned) offerCleanup(); }, 2600);
    A.toast?.('⚠ Something on this page is not what it claimed to be.', 4500);
    api = { stop: cleanup, clean: finish, count: () => spawned };
    return api;
  }

  function cleanup() {
    clearInterval(timer);
    timer = null;
    layer?.remove();
    layer = null; cleanWin = null; cleaned = false; spawned = 0; host = null; api = null;
  }

  A.cyberVirus = {
    start, stop: cleanup,
    active: () => !!layer,
    /* used by the desktop apps for their own buttons */
    clean: finish
  };
})();

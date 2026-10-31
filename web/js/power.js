// Offline status dot and Low-power mode (smaller AI model, no animations, shorter model keep-alive). Offers it when the battery gets low.
(() => {
  const net = document.createElement('span'); net.id = 'net'; net.className = 'pill';
  const logo = document.querySelector('header b'); if (logo) logo.after(net);
  const upd = () => { const on = navigator.onLine; net.className = 'pill' + (on ? '' : ' off'); net.innerHTML = '<i></i><em>' + (on ? 'online' : 'offline') + '</em>'; net.title = on ? 'Connected. Moundshroud works the same with or without internet.' : 'No internet - Moundshroud is working normally. Everything runs on this PC.'; };
  upd(); addEventListener('online', upd); addEventListener('offline', () => { upd(); A.toast('Internet is down. Moundshroud keeps working - open Prepare for your plans and checklists.', 5000); });
  net.onclick = () => A.prep && A.prep.open('ready');

  const SMALL = /qwen3\.5:(2|0\.8)b|:(0\.\d|[1-3](\.\d)?)b\b/i;
  const P = A.power = {
    get on() { return ls.get('lowpower', '0') === '1'; },
    enable(quiet) {
      ls.set('lowpower', '1'); document.body.classList.add('lowpower'); const sel = $('model'); if (sel && sel.value && !SMALL.test(sel.value)) ls.set('prevmodel', sel.value);
      const opt = sel && [...sel.options].find(o => SMALL.test(o.value));
      if (opt && sel.value !== opt.value) { sel.value = opt.value; sel.dispatchEvent(new Event('change')); if (!quiet) A.toast('Low-power mode on: using ' + opt.textContent, 3500); }
      else if (!quiet) A.toast(opt ? 'Low-power mode on' : 'Low-power mode on. Add a small AI model in Prepare > Stock up for the biggest battery saving.', 4500);
    },
    disable() {
      ls.set('lowpower', '0'); document.body.classList.remove('lowpower'); const prev = ls.get('prevmodel', ''), sel = $('model');
      if (prev && sel && [...sel.options].some(o => o.value === prev)) { sel.value = prev; sel.dispatchEvent(new Event('change')); } A.toast('Low-power mode off', 2500);
    },
    toggle(v) { v ? P.enable() : P.disable(); }
  };
  if (P.on) document.body.classList.add('lowpower');
  A.ready.push(() => { if (P.on) P.enable(true); });

  /* offer low-power mode on low battery (checked every two minutes; only on a PC that reports a battery) */
  let asked = ls.get('lpasked', '');
  setInterval(async () => {
    if (document.hidden || P.on) return; let s; try { s = await A.api('/api/sys'); } catch (e) { return; }
    const b = s && s.battery; if (!b || b.charging || b.pct > 30) return; const today = new Date().toDateString(); if (asked === today) return; asked = today; ls.set('lpasked', today);
    A.dlg('<div class="hd"><b>Battery at ' + b.pct + '%</b></div><div class="bd"><div style="margin:2px 0 14px">Switch Moundshroud to <b>Low-power mode</b>? It uses a smaller AI model and fewer animations so your battery lasts longer. You can switch back any time in Settings.</div><div class="row"><span class="sp"></span><button class="ib" id="lpn">Not now</button><button class="pri" id="lpy">Turn on</button></div></div>');
    $('lpn').onclick = A.closeDlg; $('lpy').onclick = () => { A.closeDlg(); P.enable(); };
  }, 120000);
})();

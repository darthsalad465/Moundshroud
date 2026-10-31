// Preview mode: index.html?shot=<gameId>&n=1|2 opens one game with the app chrome hidden. Used to take the Arcade preview pictures (web/previews). Does nothing without ?shot.
(() => {
  const q = new URLSearchParams(location.search), id = q.get('shot'); if (!id) return;
  const n = +q.get('n') || 1;
  const st = document.createElement('style'); document.documentElement.setAttribute('data-shot', '1'); st.textContent = ['header', '#nav', '#plsub', '#plbody>.row:first-child', '[id^=cmp]', '.companion', '#txbar', '.toast', '#toast', '.gburst', '.ginfo'].map(s => 'html[data-shot] body ' + s).join(',') + '{display:none!important}html[data-shot],html[data-shot] body{background:#0e1117!important}html[data-shot] body #plstage{padding:10px!important}'; document.head.appendChild(st);
  try { ls.set('help_auto', '0'); ls.set('mx_on', '0'); ls.set('cmai', '0'); } catch (e) { }
  setInterval(() => { document.querySelectorAll('#plsub,.ginfo,#plbody>.row:first-child').forEach(e => e.style.setProperty('display', 'none', 'important')); }, 250);
  const go = () => {
    try { if (A.sfx) A.sfx.on = false; A.showTab('play'); A.play.start(id); } catch (e) { return; }
    if (n < 2) return;
    const keys = ['ArrowDown', 'ArrowRight', 'ArrowDown', 'ArrowRight', 'ArrowUp', ' ', 'ArrowRight', 'ArrowDown'];
    let k = 0; setTimeout(function step() {
      const tgt = document.getElementById('plstage') || document.body;
      const key = keys[k % keys.length]; k++;
      for (const t of [tgt, document]) for (const ty of ['keydown', 'keyup']) t.dispatchEvent(new KeyboardEvent(ty, { key, code: key === ' ' ? 'Space' : key, bubbles: true }));
      if (k % 3 === 0) { const els = [...document.querySelectorAll('#plstage .cell, #plstage td, #plstage [data-i], #plstage [data-c], #plstage .card, #plstage .tile')].filter(e => e.offsetWidth > 8); if (els.length) els[(k * 7) % els.length].click(); }
      if (k < 12) setTimeout(step, 260);
    }, 900);
  };
  const t = setInterval(() => { if (typeof A !== 'undefined' && A.play && A.play.games && A.play.games[id] && A.play.start) { clearInterval(t); setTimeout(go, 500); } }, 100);
})();

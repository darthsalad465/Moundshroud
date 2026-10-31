// Chess Community notifications: a small pop-up when someone posts in a channel you are not looking at.
// On/off in the Community header (bell) and in Settings. A channel you muted stays silent too.
(() => {
  if (!A.community || !A.community.on) return;
  const KEY = 'cmnote', GAP = 40000; let lastAt = 0;
  const on = () => ls.get(KEY, '1') !== '0';
  const set = v => { ls.set(KEY, v ? '1' : '0'); return v; };
  const muted = (w, ch) => { try { return !!(JSON.parse(ls.get('cmmute', '{}')) || {})[w + ':' + ch]; } catch (e) { return false; } };
  A.chessNotify = { on, set, toggle: () => set(!on()) };
  A.community.on((ev, x) => {
    if (ev !== 'msg' || !x || x.w !== 'chess' || x.a === 'me' || !on() || muted(x.w, x.ch)) return;
    const vw = A.community.viewing && A.community.viewing(x.w); if (vw && vw.ch === x.ch && !document.hidden) return;
    const now = Date.now(); if (now - lastAt < GAP) return; lastAt = now;
    let who = x.a, chn = x.ch; try { who = A.community.who(x.w, x.a).name || who; } catch (e) { }
    try { const c = A.community.chan && A.community.chan(x.w, x.ch); if (c && c.name) chn = c.name; } catch (e) { }
    const t = String(x.t || '').replace(/\s+/g, ' '); A.toast('💬 ' + who + ' in #' + chn + ': ' + (t.length > 90 ? t.slice(0, 88) + '…' : t), 5000);
    try { A.sfx && A.sfx.play && A.sfx.play('ping'); } catch (e) { }
  });
})();

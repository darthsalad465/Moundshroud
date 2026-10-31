// What's new: after Moundshroud changes, one calm card tells you what is different, once, and never again for that
// change. The list is the Guide's own changelog (web/js/guide.js), so nothing has to be written twice and the card can
// never claim something the Guide does not say. Open it any time from Ctrl+K ("what's new") or the guide.
(() => {
  const KEY = 'news_seen';
  const dates = () => { try { const c = A.guide && A.guide.changelog ? A.guide.changelog() : null; return c && c.length ? c : null; } catch (e) { return null; } };
  /* the entries the user has not been shown yet: everything newer than the date they last saw */
  const unseen = () => {
    const c = dates(); if (!c) return [];
    const seen = ls.get(KEY, '');
    if (!seen) return c.slice(0, 1);                                       // a first ever look: just the newest day
    const out = [];
    for (const d of c) { if (d[0] <= seen) break; out.push(d); }
    return out.slice(0, 3);
  };
  const markSeen = () => { const c = dates(); if (c && c.length) ls.set(KEY, c[0][0]); };

  const when = d => { try { return new Date(d + 'T12:00:00').toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'long' }); } catch (e) { return d; } };

  const show = (force) => {
    const list = force ? (dates() || []).slice(0, 1) : unseen();
    if (!list.length) return false;
    const newest = list[0];
    const items = newest[1].slice(0, 8);
    A.dlg('<div class="hd"><b>✨ What\'s new in Moundshroud</b><span class="sp" style="flex:1"></span><button class="pri" id="nwx">Got it</button></div><div class="bd scroll" style="padding:4px 20px 18px">' +
      '<div class="small mute" style="margin:2px 0 10px">' + esc(when(newest[0])) + (list.length > 1 ? ' (and ' + (list.length - 1) + ' earlier update' + (list.length > 2 ? 's' : '') + ')' : '') + '</div>' +
      '<ul style="margin:0;padding-left:20px;line-height:1.62">' + items.map(x => '<li style="margin-bottom:9px">' + x + '</li>').join('') + '</ul>' +
      (newest[1].length > items.length ? '<div class="small mute" style="margin-top:8px">...and ' + (newest[1].length - items.length) + ' more in the Guide.</div>' : '') +
      '<div class="row" style="margin-top:16px"><button class="ib" id="nwg">Read the whole guide</button><span class="sp" style="flex:1"></span><button class="ib" id="nwk">Keyboard shortcuts</button></div>' +
      '</div>', true);
    markSeen();
    const x = $('nwx'); if (x) x.onclick = A.closeDlg;
    const g = $('nwg'); if (g) g.onclick = () => { A.closeDlg(); A.showTab('guide'); };
    const k = $('nwk'); if (k) k.onclick = () => { A.closeDlg(); A.keys && A.keys.help && A.keys.help(); };
    return true;
  };

  A.news = { show, unseen, markSeen };

  /* once, a few seconds after start, and never on the very first run (the tour has that job) */
  setTimeout(() => {
    try {
      if (ls.get('toured', '') !== '1') return;
      if ($('ov').classList.contains('on') || document.getElementById('cmdx')) return;
      if (A.walk && A.walk.on) return;
      show(false);
    } catch (e) { }
  }, 3200);

  A.cmd.reg([
    { title: 'What\'s new in Moundshroud', sub: 'What changed in the newest update', icon: '✨', group: 'Help', tags: 'changelog news update what is new release notes', run: () => show(true) },
    { title: 'Show me the new things again', sub: 'Forget that the update was read', icon: '🔔', group: 'Help', tags: 'changelog news reset seen update', run: () => { ls.set(KEY, ''); A.toast('The next update will show its card again'); } }
  ]);
})();

// Entertainment > Imperium: a career in Rome. An RPG and a battle simulator in one, in a self-contained page at
// web/games/imperium: walk the city, talk to Romans who answer with the local AI, take the floor in the Senate,
// debate rivals, lead legions, fight tactical battles, build your domus and rise from nobody to Princeps.
// All art is drawn by code and the whole thing runs offline. Saves live in this browser's storage.
(() => {
  const P = A.play; if (!P) return;
  P.games.rome = {
    name: 'Imperium', icon: '🏛️',
    desc: 'Live a life in Rome: choose who you are, walk the city, talk with any Roman in the street through the local AI (and get jobs from them), debate on the Senate floor, take provinces by war, fight real-time battles as the general on the field, build your domus and climb from nobody to Princeps. Play your own career in 63 BC or the life of Julius Caesar. A role-playing game and a battle simulator in one, with its own music.',
    mount(el, api) {
      el.style.padding = '0'; el.style.alignItems = 'stretch';
      el.innerHTML = '<iframe id="impframe" src="/web/games/imperium/index.html" title="Imperium" allow="autoplay; fullscreen" style="flex:1;width:100%;min-height:calc(100vh - 150px);border:0;background:#1a1208"></iframe>';
      const f = el.querySelector('#impframe');
      f.addEventListener('load', () => { try { f.contentWindow.focus(); } catch (e) { } });
      try { api.hud('WASD to walk · E to enter · Esc to close'); } catch (e) { }
      try { A.music && A.music.stop(); } catch (e) { }                       // the game has its own music
      f.addEventListener('load', () => {
        try {
          window.addEventListener('message', onMsg);
        } catch (e) { }
      });
      const onMsg = ev => {
        const d = ev.data; if (!d || d.imp !== 1) return;
        if (d.hud) { try { api.hud(d.hud); } catch (e) { } }
        if (d.xp) { try { api.submit(d.xp); } catch (e) { } }
      };
      const refocus = () => { try { f.contentWindow.focus(); } catch (e) { } }; el.addEventListener('click', refocus);
      return () => { window.removeEventListener('message', onMsg); try { f.src = 'about:blank'; } catch (e) { } };
    }
  };
})();

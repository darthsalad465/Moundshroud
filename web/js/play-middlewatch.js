// Entertainment > Middle Watch: an original top-down pixel-art fantasy RPG (four chapters). It is a self-contained page in web/games/middlewatch
// (all art is drawn by code, fonts are stored locally), shown here in a frame so it runs fully offline. Its saves live in this browser's storage.
(() => {
  const P = A.play; if (!P) return;
  P.games.middlewatch = {
    name: 'Middle Watch', icon: '🕯️',
    desc: 'An original pixel-art fantasy adventure in four chapters: explore, talk, trade, make allies and fight (or calm) your way through. Saves your progress. Arrow keys or WASD to move, Z to talk, Esc for the menu.',
    mount(el, api) {
      el.style.padding = '0'; el.style.alignItems = 'stretch';
      el.innerHTML = '<iframe id="mwframe" src="/web/games/middlewatch/index.html" title="Middle Watch" allow="autoplay; fullscreen" style="flex:1;width:100%;min-height:calc(100vh - 150px);border:0;background:#16111c"></iframe>';
      const f = el.querySelector('#mwframe'); f.addEventListener('load', () => { try { f.contentWindow.focus(); } catch (e) { } });
      try { api.hud('Esc opens the game menu'); } catch (e) { }
      try { A.music && A.music.stop(); } catch (e) { }                       // the game has its own music
      const refocus = () => { try { f.contentWindow.focus(); } catch (e) { } }; el.addEventListener('click', refocus);
      return () => { try { f.src = 'about:blank'; } catch (e) { } };
    }
  };
})();

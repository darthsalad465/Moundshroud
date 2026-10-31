// Games polish: scales small board/puzzle games up to fill the window (CSS zoom, recomputed on resize), no change to game logic.
(() => {
  const P = A.play; if (!P || !P.start) return;
  const FIT = new Set(['2048', 'memory', 'connect4', 'mines', 'sudoku', 'wordguess', 'tictactoe', 'checkers', 'othello', 'battleship', 'mastermind', 'hangman', 'slide', 'lights', 'simon', 'whack', 'mancala', 'reaction', 'typing', 'cipher', 'gomoku', 'go']);
  let cur = null;
  function fit() {
    const st = document.getElementById('plstage'); if (!st || !cur || !FIT.has(cur) || st.querySelector('canvas')) return;
    if (/[?&]shot=/.test(location.search) === false && window.matchMedia && matchMedia('(max-width:700px)').matches) { st.style.zoom = ''; return; }
    st.style.zoom = ''; const kids = [...st.children].filter(c => c.offsetWidth && c.offsetHeight && getComputedStyle(c).position !== 'absolute'); if (!kids.length) return;
    const top = Math.min(...kids.map(c => c.getBoundingClientRect().top)), bot = Math.max(...kids.map(c => c.getBoundingClientRect().bottom)), W = Math.max(...kids.map(c => c.getBoundingClientRect().width));
    const H = bot - top, ah = st.clientHeight - 36, aw = st.clientWidth - 36; if (H < 40 || W < 40) return;
    const z = Math.min(1.75, ah / H, aw / W); st.style.zoom = z > 1.12 ? z.toFixed(2) : '';
  }
  const start = P.start; P.start = function (id) { cur = id; const r = start.apply(this, arguments); [80, 450, 1200].forEach(ms => setTimeout(() => { if (cur === id) fit(); }, ms)); return r; };
  let rt = 0; addEventListener('resize', () => { clearTimeout(rt); rt = setTimeout(fit, 150); });
})();

// Endless puzzle generator (Web Worker). Plays quick games against itself, looks for positions with one clearly best move,
// double-checks them with a deeper search, and posts each back as a solvable line (one move or several) with a difficulty and theme tags.
importScripts('/web/js/chess-engine.js');
const C = self.Chess; let running = false, loop = false, mate1 = 0, made = 0, want = { minK: 1, maxK: 4 }; const seen = new Set();
const sleep = () => new Promise(r => setTimeout(r, 0));
async function run() {
  if (loop) return; loop = true;
  while (running) {
    const pos = new C.Pos().setFen(C.START), rnd = 2 + Math.floor(Math.random() * 7);
    for (let ply = 0; ply < 100 && running; ply++) {
      const legal = pos.legal(); if (!legal.length || pos.half >= 60 || pos.insufficient()) break;
      if (ply < rnd) { pos.make(legal[Math.random() * legal.length | 0]); continue; }
      await sleep(); if (!running) break;
      if (ply >= 8 && legal.length >= 3 && Math.random() < 0.55) {
        const key = pos.fen().split(' ').slice(0, 2).join(' ');
        if (!seen.has(key)) {
          const p = C.puzzleFrom(pos, { maxK: want.maxK });
          if (p) {
            seen.add(key);
            const n = p.t === 'Mate in 1' ? 1 : 0;
            if (p.k >= want.minK && p.k <= want.maxK && !(n === 1 && mate1 > made * 0.18 + 2)) { if (n === 1) mate1++; made++; self.postMessage({ type: 'puz', p }); }
          }
        }
      }
      const r = C.think(pos, 900, 60); pos.make(r.move);
    }
  }
  loop = false;
}
self.onmessage = e => { const d = e.data; if (d.cmd === 'go') { want = { minK: d.minK || 1, maxK: d.maxK || 4 }; running = true; run(); } else if (d.cmd === 'pause') running = false; };

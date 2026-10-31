// Tools > Puzzle maker: make a word search or a crossword from your own words, solve it on screen or print it.
(() => {
  const rnd = n => Math.floor(Math.random() * n), pick = a => a[rnd(a.length)];
  const ABC = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  /* ---------- word search ---------- */
  function wordSearch(words, size, level) {
    const dirs = level === 0 ? [[0, 1], [1, 0]] : level === 1 ? [[0, 1], [1, 0], [1, 1], [-1, 1]] : [[0, 1], [1, 0], [1, 1], [-1, 1], [0, -1], [-1, 0], [-1, -1], [1, -1]];
    const g = Array.from({ length: size }, () => Array(size).fill('')), placed = [], failed = [];
    words.slice().sort((a, b) => b.length - a.length).forEach(w => {
      let ok = false;
      for (let tries = 0; tries < 300 && !ok; tries++) {
        const d = pick(dirs), r = rnd(size), c = rnd(size), er = r + d[0] * (w.length - 1), ec = c + d[1] * (w.length - 1); if (er < 0 || ec < 0 || er >= size || ec >= size) continue;
        let fits = true; for (let i = 0; i < w.length; i++) { const x = g[r + d[0] * i][c + d[1] * i]; if (x && x !== w[i]) { fits = false; break; } } if (!fits) continue;
        for (let i = 0; i < w.length; i++) g[r + d[0] * i][c + d[1] * i] = w[i]; placed.push({ w, r, c, d }); ok = true;
      }
      if (!ok) failed.push(w);
    });
    const sol = g.map(r => r.map(x => !!x)); for (let r = 0; r < size; r++) for (let c = 0; c < size; c++) if (!g[r][c]) g[r][c] = ABC[rnd(26)];
    return { g, placed, failed, sol };
  }
  /* ---------- crossword ---------- */
  function crossword(items) {
    const list = items.slice().sort((a, b) => b.w.length - a.w.length), N = 25, grid = new Map(), placed = [], failed = [];
    const key = (r, c) => r + ',' + c, at = (r, c) => grid.get(key(r, c)) || '';
    const canPlace = (w, r, c, dr, dc) => {
      if (at(r - dr, c - dc) || at(r + dr * w.length, c + dc * w.length)) return -1; let cross = 0;
      for (let i = 0; i < w.length; i++) { const rr = r + dr * i, cc = c + dc * i, x = at(rr, cc); if (x) { if (x !== w[i]) return -1; cross++; } else { if (at(rr + dc, cc + dr) || at(rr - dc, cc - dr)) return -1; } }
      return cross;
    };
    list.forEach((it, idx) => {
      const w = it.w;
      if (!placed.length) { for (let i = 0; i < w.length; i++) grid.set(key(0, i), w[i]); placed.push({ w, clue: it.clue, r: 0, c: 0, dr: 0, dc: 1 }); return; }
      let best = null;
      placed.forEach(p => { for (let i = 0; i < p.w.length; i++) for (let j = 0; j < w.length; j++) if (p.w[i] === w[j]) { const dr = p.dc ? 1 : 0, dc = p.dc ? 0 : 1, r = p.r + p.dr * i - dr * j, c = p.c + p.dc * i - dc * j, cr = canPlace(w, r, c, dr, dc); if (cr > 0 && (!best || cr > best.cr)) best = { r, c, dr, dc, cr }; } });
      if (best) { for (let i = 0; i < w.length; i++) grid.set(key(best.r + best.dr * i, best.c + best.dc * i), w[i]); placed.push({ w, clue: it.clue, r: best.r, c: best.c, dr: best.dr, dc: best.dc }); } else failed.push(it.w);
    });
    let r0 = 1e9, c0 = 1e9, r1 = -1e9, c1 = -1e9; grid.forEach((v, k) => { const [r, c] = k.split(',').map(Number); r0 = Math.min(r0, r); c0 = Math.min(c0, c); r1 = Math.max(r1, r); c1 = Math.max(c1, c); });
    const rows = r1 - r0 + 1, cols = c1 - c0 + 1, cell = Array.from({ length: rows }, () => Array(cols).fill('')); grid.forEach((v, k) => { const [r, c] = k.split(',').map(Number); cell[r - r0][c - c0] = v; });
    placed.forEach(p => { p.r -= r0; p.c -= c0; }); const starts = {}; placed.forEach(p => { starts[p.r + ',' + p.c] = 1; });
    let n = 0; const num = {}; for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) if (starts[r + ',' + c]) num[r + ',' + c] = ++n;
    placed.forEach(p => { p.n = num[p.r + ',' + p.c]; });
    return { cell, rows, cols, num, across: placed.filter(p => p.dc).sort((a, b) => a.n - b.n), down: placed.filter(p => p.dr).sort((a, b) => a.n - b.n), failed };
  }
  const printHtml = (title, body) => { const w = window.open('', '_blank'); if (!w) return A.toast('Allow pop-ups to print.'); w.document.write('<title>' + esc(title) + '</title><body style="font-family:sans-serif;margin:24px"><h2>' + esc(title) + '</h2>' + body + '<script>setTimeout(function(){window.print()},300)<\/script>'); w.document.close(); };
  A.puzzlemaker = {
    wordSearch, crossword,
    render(root) {
      let mode = ls.get('pzmk', 'ws'), cur = null;
      root.innerHTML = '<div class="scroll pad" style="flex:1"><div style="max-width:900px;margin:0 auto"><h2 style="margin:0 0 4px">🧩 Puzzle maker</h2><div class="small mute" style="margin-bottom:8px">Make a word search or a crossword from your own words (spelling lists, names, a topic you are studying). Solve it here or print it.</div><div class="row" style="gap:6px;margin-bottom:8px"><button class="ib" data-m="ws">🔎 Word search</button><button class="ib" data-m="cw">📰 Crossword</button></div><div id="pzin"></div><div id="pzout" style="margin-top:12px"></div></div></div>';
      const q = s => root.querySelector(s);
      const form = () => {
        root.querySelectorAll('[data-m]').forEach(b => b.classList.toggle('on', b.dataset.m === mode)); ls.set('pzmk', mode);
        q('#pzin').innerHTML = mode === 'ws' ? '<textarea id="pzw" rows="6" style="width:100%" placeholder="One word per line (3 to 14 letters)">' + esc(ls.get('pzmk_ws', 'KNIGHT\nBISHOP\nCASTLE\nPAWN\nQUEEN\nCHECK\nMATE')) + '</textarea><div class="row" style="gap:10px;margin-top:6px;flex-wrap:wrap;align-items:center"><label class="small">Size <select id="pzs"><option>10</option><option selected>12</option><option>15</option><option>18</option></select></label><label class="small">Level <select id="pzl"><option value="0">Easy (across, down)</option><option value="1" selected>Medium (+ diagonals)</option><option value="2">Hard (all directions)</option></select></label><button class="pri" id="pzgo">Make it</button></div>'
          : '<textarea id="pzw" rows="7" style="width:100%" placeholder="One per line:  WORD: clue">' + esc(ls.get('pzmk_cw', 'KNIGHT: Piece that moves in an L\nBISHOP: Moves diagonally\nCASTLE: Another name for a rook\nPAWN: Smallest piece\nQUEEN: Most powerful piece\nCHECK: Threat to the king\nMATE: End of the game')) + '</textarea><div class="row" style="gap:10px;margin-top:6px"><button class="pri" id="pzgo">Make it</button></div>';
        q('#pzout').innerHTML = ''; q('#pzgo').onclick = make;
      };
      const make = () => {
        const raw = q('#pzw').value; ls.set(mode === 'ws' ? 'pzmk_ws' : 'pzmk_cw', raw);
        if (mode === 'ws') {
          const words = [...new Set(raw.split(/\n/).map(x => x.toUpperCase().replace(/[^A-Z]/g, '')).filter(x => x.length >= 3 && x.length <= 14))]; if (words.length < 2) return A.toast('Add at least two words.');
          const size = Math.max(+q('#pzs').value, Math.max(...words.map(w => w.length))), r = wordSearch(words, size, +q('#pzl').value); cur = r;
          const grid = '<table style="border-collapse:collapse;font-family:monospace;font-size:' + (size > 14 ? 15 : 18) + 'px">' + r.g.map((row, ri) => '<tr>' + row.map((x, ci) => '<td data-r="' + ri + '" data-c="' + ci + '" style="width:1.7em;height:1.7em;text-align:center;border:1px solid var(--line);cursor:pointer;user-select:none">' + x + '</td>').join('') + '</tr>').join('') + '</table>';
          q('#pzout').innerHTML = '<div class="row" style="gap:16px;align-items:flex-start;flex-wrap:wrap"><div>' + grid + '</div><div><b>Find these</b><div id="pzlist" style="columns:2;margin-top:4px">' + r.placed.map(p => '<div data-w="' + p.w + '">' + p.w + '</div>').join('') + '</div>' + (r.failed.length ? '<div class="small mute" style="margin-top:6px">Could not fit: ' + r.failed.join(', ') + '. Try a bigger grid.</div>' : '') + '<div class="row" style="gap:6px;margin-top:8px;flex-wrap:wrap"><button class="ib" id="pzshow">Show answers</button><button class="ib" id="pzprint">🖨 Print</button></div></div></div>';
          const drag = { on: false }; q('#pzout').onclick = e => { const td = e.target.closest('td[data-r]'); if (td) td.style.background = td.style.background ? '' : 'rgba(255,200,0,.45)'; };
          q('#pzshow').onclick = () => { r.placed.forEach(p => { for (let i = 0; i < p.w.length; i++) { const td = q('td[data-r="' + (p.r + p.d[0] * i) + '"][data-c="' + (p.c + p.d[1] * i) + '"]'); if (td) td.style.background = 'rgba(80,200,120,.5)'; } }); };
          q('#pzprint').onclick = () => printHtml('Word search', '<table style="border-collapse:collapse;font-family:monospace;font-size:20px">' + r.g.map(row => '<tr>' + row.map(x => '<td style="width:1.8em;height:1.8em;text-align:center;border:1px solid #bbb">' + x + '</td>').join('') + '</tr>').join('') + '</table><h3>Find these words</h3><p>' + r.placed.map(p => p.w).join(' &middot; ') + '</p>');
        } else {
          const items = [...new Map(raw.split(/\n/).map(l => { const i = l.indexOf(':'); return i < 0 ? null : { w: l.slice(0, i).toUpperCase().replace(/[^A-Z]/g, ''), clue: l.slice(i + 1).trim() }; }).filter(x => x && x.w.length >= 3 && x.clue).map(x => [x.w, x])).values()]; if (items.length < 2) return A.toast('Add at least two lines like  WORD: clue');
          let r = crossword(items); for (let i = 0; i < 14 && r.failed.length; i++) { const t = crossword(items.slice().sort(() => Math.random() - .5)); if (t.failed.length < r.failed.length) r = t; } cur = r;
          const grid = '<table style="border-collapse:collapse">' + r.cell.map((row, ri) => '<tr>' + row.map((x, ci) => x ? '<td style="position:relative;width:34px;height:34px;border:1px solid var(--text);padding:0">' + (r.num[ri + ',' + ci] ? '<span style="position:absolute;top:0;left:2px;font-size:10px">' + r.num[ri + ',' + ci] + '</span>' : '') + '<input maxlength="1" data-a="' + x + '" style="width:100%;height:100%;border:0;text-align:center;text-transform:uppercase;font-size:18px;background:transparent;color:var(--text);padding:8px 0 0"></td>' : '<td style="width:34px;height:34px;background:var(--panel2)"></td>').join('') + '</tr>').join('') + '</table>';
          q('#pzout').innerHTML = '<div class="row" style="gap:18px;align-items:flex-start;flex-wrap:wrap"><div style="overflow:auto;max-width:100%">' + grid + '</div><div style="min-width:220px"><b>Across</b>' + r.across.map(p => '<div class="small">' + p.n + '. ' + esc(p.clue) + ' (' + p.w.length + ')</div>').join('') + '<b style="display:block;margin-top:8px">Down</b>' + r.down.map(p => '<div class="small">' + p.n + '. ' + esc(p.clue) + ' (' + p.w.length + ')</div>').join('') + (r.failed.length ? '<div class="small mute" style="margin-top:6px">Could not fit: ' + r.failed.join(', ') + '</div>' : '') + '<div class="row" style="gap:6px;margin-top:8px;flex-wrap:wrap"><button class="ib" id="pzchk">Check</button><button class="ib" id="pzrev">Reveal</button><button class="ib" id="pzprint">🖨 Print</button></div><div class="small" id="pzres" style="margin-top:4px"></div></div></div>';
          q('#pzchk').onclick = () => { let ok = 0, bad = 0, empty = 0; q('#pzout').querySelectorAll('input[data-a]').forEach(i => { const v = i.value.toUpperCase(); i.style.color = ''; if (!v) empty++; else if (v === i.dataset.a) { ok++; i.style.color = 'var(--ok,#3a3)'; } else { bad++; i.style.color = 'var(--bad,#d44)'; } }); q('#pzres').textContent = bad ? bad + ' wrong' + (empty ? ', ' + empty + ' empty' : '') : empty ? 'So far so good: ' + empty + ' still empty.' : 'Solved! 🎉'; };
          q('#pzrev').onclick = () => q('#pzout').querySelectorAll('input[data-a]').forEach(i => { i.value = i.dataset.a; });
          q('#pzprint').onclick = () => printHtml('Crossword', '<table style="border-collapse:collapse">' + r.cell.map((row, ri) => '<tr>' + row.map((x, ci) => x ? '<td style="position:relative;width:34px;height:34px;border:1px solid #000">' + (r.num[ri + ',' + ci] ? '<span style="position:absolute;top:0;left:2px;font-size:10px">' + r.num[ri + ',' + ci] + '</span>' : '') + '</td>' : '<td style="width:34px;height:34px;background:#ddd"></td>').join('') + '</tr>').join('') + '</table><h3>Across</h3>' + r.across.map(p => '<div>' + p.n + '. ' + esc(p.clue) + ' (' + p.w.length + ')</div>').join('') + '<h3>Down</h3>' + r.down.map(p => '<div>' + p.n + '. ' + esc(p.clue) + ' (' + p.w.length + ')</div>').join(''));
        }
      };
      root.querySelectorAll('[data-m]').forEach(b => b.onclick = () => { mode = b.dataset.m; form(); });
      form(); root._test = { make, get: () => cur };
    }
  };
})();

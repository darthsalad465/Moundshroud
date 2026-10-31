// The 📷 Scan page of the chess tab: drop, paste or choose a picture of a position, check the corners of the board,
// read it, fix anything the picture made unclear, then Analyse it or Play from it. The reading is done by
// chess-scan.js (ChessScan), on this PC.
(() => {
  const UI = window.ChessUI; if (!UI) return;
  const NUM = { P: 1, N: 2, B: 3, R: 4, Q: 5, K: 6 }, PAL = ['K', 'Q', 'R', 'B', 'N', 'P', 'k', 'q', 'r', 'b', 'n', 'p'];
  const esc = t => String(t == null ? '' : t).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  let last = null;   /* the last scan, kept while the app is open so leaving for Analyse and coming back keeps it */
  const pc = p => { if (!p) return ''; const n = NUM[p.toUpperCase()] * (p === p.toUpperCase() ? 1 : -1); try { return window.ChessSet ? ChessSet.html(n) : p; } catch (e) { return p; } };

  UI.sections.scan = (host, api, ctx) => {
    let img = null, pts = null, board = Array(64).fill(''), conf = Array(64).fill(1), side = 'w', flipped = false, tool = 'K', dead = false, noCastle = false;
    let ready = false;
    host.innerHTML = '<div class="csn"><div class="csn-l"><div class="csn-drop" id="csdrop" tabindex="0"><b>📷 Drop a picture of a chess position here</b><div class="small mute">or paste one (Ctrl+V), or <a href="#" id="cspick">choose a file</a>. A screenshot, a diagram from a book or magazine, or a photo of a real board.</div><input type="file" id="csfile" accept="image/*" style="display:none"></div>' +
      '<div id="csstage" class="csn-stage" style="display:none"><canvas id="cscv"></canvas><svg id="csov" class="csn-ov"></svg></div><div class="small mute" id="csnote" style="margin:6px 0"></div>' +
      '<div class="row" style="gap:6px;flex-wrap:wrap"><button class="pri" id="csread" disabled>♟ Read the position</button><button class="ib" id="csauto" disabled title="Find the board again">🎯 Find the board</button><button class="ib" id="csempty">✏️ Set up by hand</button></div></div>' +
      '<div class="csn-r"><div class="acmsg" id="csst">Your position appears here, ready to fix, analyse or play.</div><div id="csbd" class="csn-bd pcx"></div>' +
      '<div class="csn-pal pcx" id="cspal">' + PAL.map(p => '<button class="csn-pc' + (p === tool ? ' on' : '') + '" data-p="' + p + '" title="Place ' + p + '">' + pc(p) + '</button>').join('') + '<button class="csn-pc" data-p="" title="Empty a square">⌫</button></div>' +
      '<div class="small mute" style="margin:4px 0 8px">Click a square to put the chosen piece there, click it again to empty it, right-click to empty. Squares the picture made uncertain have an amber outline.</div>' +
      '<div class="row" style="gap:6px;flex-wrap:wrap;align-items:center"><label class="small">To move <select id="csside"><option value="w">White</option><option value="b">Black</option></select></label><button class="ib" id="csflip" title="If White is at the top of the picture">⇅ Turn the board round</button><label class="small"><input type="checkbox" id="csnc"> No castling</label></div>' +
      '<div class="row" style="gap:6px;margin-top:8px"><input id="csfen" style="flex:1;font:12px Consolas,monospace" spellcheck="false" title="The position as FEN: edit it or paste one"><button class="ib" id="cscopy">📋</button></div><div id="csprob" class="small" style="color:var(--bad);margin-top:6px;line-height:1.5"></div>' +
      '<div class="row" style="gap:6px;flex-wrap:wrap;margin-top:10px"><button class="pri" id="csana">🔬 Analyse</button><button class="ib" id="csplayw">♟ Play it as White</button><button class="ib" id="csplayb">♟ Play it as Black</button></div></div></div>';
    const q = id => host.querySelector('#' + id), cv = q('cscv'), ov = q('csov');
    const status = (t, c) => { const e = q('csst'); e.textContent = t; e.style.color = c || ''; };

    /* ---------- the board on the right ---------- */
    const fen = () => ChessScan.fenOf(board, side, { noCastle });
    function drawBoard() {
      let h = ''; for (let i = 0; i < 64; i++) { const r = i >> 3, c = i & 7, light = (r + c) % 2 === 0; h += '<div class="csn-sq ' + (light ? 'l' : 'd') + (board[i] && conf[i] < .5 ? ' unsure' : '') + '" data-i="' + i + '">' + pc(board[i]) + (c === 0 ? '<i class="csn-rk">' + (8 - r) + '</i>' : '') + (r === 7 ? '<i class="csn-fl">' + 'abcdefgh'[c] + '</i>' : '') + '</div>'; }
      q('csbd').innerHTML = h;
      const f = fen(); if (document.activeElement !== q('csfen')) q('csfen').value = f;
      const pr = ChessScan.problems(board, side); q('csprob').innerHTML = pr.map(esc).join('<br>');
      ['csana', 'csplayw', 'csplayb'].forEach(id => q(id).disabled = pr.length > 0);
      if (ready) last = { board: board.slice(), conf: conf.slice(), side, noCastle, img, pts: pts && pts.map(p => p.slice()) };
    }
    q('csbd').addEventListener('click', e => { const s = e.target.closest('[data-i]'); if (!s) return; const i = +s.dataset.i; board[i] = board[i] === tool ? '' : tool; conf[i] = 1; drawBoard(); });
    q('csbd').addEventListener('contextmenu', e => { const s = e.target.closest('[data-i]'); if (!s) return; e.preventDefault(); board[+s.dataset.i] = ''; drawBoard(); });
    q('cspal').onclick = e => { const b = e.target.closest('[data-p]'); if (!b) return; tool = b.dataset.p; q('cspal').querySelectorAll('[data-p]').forEach(x => x.classList.toggle('on', x === b)); };
    q('csside').onchange = () => { side = q('csside').value; drawBoard(); };
    q('csnc').onchange = () => { noCastle = q('csnc').checked; drawBoard(); };
    q('csflip').onclick = () => { board = board.slice().reverse(); conf = conf.slice().reverse(); flipped = !flipped; drawBoard(); };
    q('csfen').onchange = () => {
      const t = q('csfen').value.trim(); try { new Chess.Pos().setFen(t); } catch (e) { return A.toast('That is not a FEN position.'); }
      const rows = t.split(' ')[0].split('/'); if (rows.length !== 8) return A.toast('That is not a FEN position.');
      const b = []; rows.forEach(r => { for (const ch of r) { if (/\d/.test(ch)) for (let k = 0; k < +ch; k++) b.push(''); else b.push(ch); } });
      if (b.length !== 64) return A.toast('That is not a FEN position.'); board = b; conf = Array(64).fill(1); side = t.split(' ')[1] === 'b' ? 'b' : 'w'; q('csside').value = side; drawBoard();
    };
    q('cscopy').onclick = () => A.copy(fen());
    q('csempty').onclick = () => { board = Array(64).fill(''); board[60] = 'K'; board[4] = 'k'; conf = Array(64).fill(1); status('Put the pieces on the board: choose one below, then click squares.'); drawBoard(); };
    q('csana').onclick = () => { const f = fen(); UI.pending = { game: { startFen: f, moves: [], white: 'White', black: 'Black', result: '*', event: 'Scanned position', date: new Date().toISOString(), src: 'scan' } }; UI.show('analysis'); };
    const play = h => { UI.playFrom = { fen: fen(), human: h }; UI.show('play'); };
    q('csplayw').onclick = () => play(1); q('csplayb').onclick = () => play(-1);

    /* ---------- the picture on the left, with the four corners you can drag ---------- */
    let scale = 1;
    function drawPicture() {
      if (!img) return; const W = Math.min(560, host.querySelector('.csn-l').clientWidth || 560); scale = W / img.naturalWidth; const H = Math.round(img.naturalHeight * scale);
      cv.width = W; cv.height = H; cv.getContext('2d').drawImage(img, 0, 0, W, H); ov.setAttribute('width', W); ov.setAttribute('height', H); ov.setAttribute('viewBox', '0 0 ' + W + ' ' + H); drawCorners();
    }
    function drawCorners() {
      if (!pts) { ov.innerHTML = ''; return; } const P = pts.map(([x, y]) => [x * scale, y * scale]);
      let lines = ''; for (let k = 1; k < 8; k++) { const t = k / 8, a = mix(P[0], P[1], t), b = mix(P[3], P[2], t), c = mix(P[0], P[3], t), d = mix(P[1], P[2], t); lines += '<line x1="' + a[0] + '" y1="' + a[1] + '" x2="' + b[0] + '" y2="' + b[1] + '"/><line x1="' + c[0] + '" y1="' + c[1] + '" x2="' + d[0] + '" y2="' + d[1] + '"/>'; }
      ov.innerHTML = '<polygon points="' + P.map(p => p.join(',')).join(' ') + '"/>' + '<g class="g">' + lines + '</g>' + P.map((p, i) => '<circle data-k="' + i + '" cx="' + p[0] + '" cy="' + p[1] + '" r="9"/>').join('');
    }
    const mix = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];
    let drag = -1;
    ov.addEventListener('pointerdown', e => { const c = e.target.closest('[data-k]'); if (!c) return; drag = +c.dataset.k; ov.setPointerCapture(e.pointerId); e.preventDefault(); });
    ov.addEventListener('pointermove', e => { if (drag < 0) return; const r = ov.getBoundingClientRect(); pts[drag] = [Math.max(0, Math.min(img.naturalWidth, (e.clientX - r.left) / scale)), Math.max(0, Math.min(img.naturalHeight, (e.clientY - r.top) / scale))]; drawCorners(); });
    ov.addEventListener('pointerup', () => { drag = -1; });
    const find = () => {
      const f = ChessScan.findBoard(img); const W = img.naturalWidth, H = img.naturalHeight, m = Math.min(W, H) * .9;
      pts = f.ok ? f.pts : [[(W - m) / 2, (H - m) / 2], [(W + m) / 2, (H - m) / 2], [(W + m) / 2, (H + m) / 2], [(W - m) / 2, (H + m) / 2]];
      q('csnote').textContent = f.ok ? 'Board found. Check the corners line up with the board’s outer edge (drag them if not), then Read the position.' : 'The board could not be found by itself. Drag the four corners onto the board’s corners, then Read the position.';
      drawCorners();
    };
    async function take(src) {
      try { img = await ChessScan.loadImg(src); } catch (e) { return A.toast(e.message); }
      if (dead) return; q('csdrop').style.display = 'none'; q('csstage').style.display = ''; q('csread').disabled = false; q('csauto').disabled = false;
      drawPicture(); setTimeout(() => { if (!dead) { find(); readNow(); } }, 30);
    }
    async function readNow() {
      if (!img || !pts) return; q('csread').disabled = true; status('Reading the squares…');
      await new Promise(r => setTimeout(r, 20));
      try {
        const id = ChessScan.warp(img, pts, 512), r = await ChessScan.read(id);
        if (dead) return; board = r.board; conf = r.conf; flipped = r.flipped;
        const unsure = conf.filter((c, i) => board[i] && c < .5).length;
        status(r.pieces ? 'Read ' + r.pieces + ' pieces' + (r.flipped ? ' (the board was upside down, so it was turned round)' : '') + '. ' + (unsure ? unsure + ' square' + (unsure > 1 ? 's are' : ' is') + ' uncertain (amber): check ' + (unsure > 1 ? 'them' : 'it') + '.' : 'Check it matches the picture.') : 'No pieces were found. Check the corners, or set the pieces up by hand.', unsure ? 'var(--warn)' : '');
        drawBoard();
      } catch (e) { status('The picture could not be read: ' + e.message, 'var(--bad)'); }
      q('csread').disabled = false;
    }
    q('csread').onclick = readNow; q('csauto').onclick = () => { find(); readNow(); };
    q('cspick').onclick = e => { e.preventDefault(); q('csfile').click(); };
    q('csfile').onchange = () => { const f = q('csfile').files[0]; if (f) take(URL.createObjectURL(f)); };
    const drop = q('csdrop'); drop.onclick = e => { if (e.target.id !== 'cspick') q('csfile').click(); };
    host.addEventListener('dragover', e => e.preventDefault());
    host.addEventListener('drop', e => { e.preventDefault(); const f = e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files[0]; if (f && /^image\//.test(f.type)) take(URL.createObjectURL(f)); });
    const paste = e => { if (dead || !host.isConnected) return; const it = [...(e.clipboardData || {}).items || []].find(i => /^image\//.test(i.type)); if (it) { e.preventDefault(); take(URL.createObjectURL(it.getAsFile())); } };
    document.addEventListener('paste', paste);
    /* come back to the last picture and position (after Analyse or Play), or start from the usual position */
    q('csfen').value = '';
    if (last) {
      ({ board, conf, side, noCastle, img, pts } = last); board = board.slice(); conf = conf.slice(); pts = pts && pts.map(p => p.slice());
      q('csside').value = side; q('csnc').checked = noCastle; status('Your last scanned position. Drop another picture to scan a new one.');
      if (img) { q('csdrop').style.display = 'none'; q('csstage').style.display = ''; q('csread').disabled = false; q('csauto').disabled = false; setTimeout(() => { if (!dead) drawPicture(); }, 30); }
    } else board = 'rnbqkbnr pppppppp'.replace(' ', '').split('').concat(Array(32).fill(''), 'PPPPPPPPRNBQKBNR'.split(''));
    drawBoard(); ready = true;
    UI.scanLoad = take;      /* for other pages (and tests) to hand a picture in */
    return () => { dead = true; document.removeEventListener('paste', paste); };
  };
})();

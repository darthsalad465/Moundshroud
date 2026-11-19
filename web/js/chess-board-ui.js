// Chess hub > ⚙ Board settings: a live preview board with every look-and-feel control
// (size, board colours, textures and frames, piece shape, piece finish, coordinates, highlights, motion, sound),
// a shelf of one-click presets and a "surprise me" button. Shape and finish are separate, so any piece can be
// painted any way, and any of them works on any board.
(() => {
  const CS = window.ChessSet, UI = window.ChessUI, C = Chess; if (!CS || !UI) return;
  const FEN = 'r1bqkb1r/pppp1Bpp/2n2n2/4p3/4P3/5N2/PPPP1PPP/RNBQK2R b KQkq - 0 4';
  const seg = (id, opts, cur) => '<div class="row" id="' + id + '" style="gap:6px;flex-wrap:wrap">' + opts.map(o => '<button class="ib' + (o[0] === cur ? ' on' : '') + '" data-v="' + o[0] + '">' + o[1] + '</button>').join('') + '</div>';
  const slider = (id, label, min, max, step, val, fmt) => '<div class="row" style="gap:10px;margin:6px 0"><span style="width:140px;flex:none">' + label + '</span><input type="range" id="' + id + '" min="' + min + '" max="' + max + '" step="' + step + '" value="' + val + '" style="flex:1"><b id="' + id + 'v" style="width:70px;text-align:right">' + fmt(val) + '</b></div>';
  const card = (t, body, note) => '<div class="card" style="margin:0"><b>' + t + '</b>' + (note ? '<div class="small mute" style="margin:2px 0 6px">' + note + '</div>' : '<div style="height:6px"></div>') + body + '</div>';
  const lab = t => '<div class="small mute" style="margin:8px 0 4px">' + t + '</div>';
  /* one square of a mini board, used for every swatch */
  const cell = (shape, finish, p, size) => { const S = size || 46, D = CS.SETD[shape] || CS.SETD.classic, c = CS.cfg();
    return '<div class="acb" style="display:flex;grid-template:none;box-shadow:none!important;border-radius:0;overflow:visible;width:' + S + 'px;height:' + S + 'px;--sz:' + S + 'px;--pw:' + (c.pw || D.pw) + ';--pb:' + (c.pb || D.pb) + ';--pflair:' + (c.flair || '#c0392b') + ';align-items:center;justify-content:center;background:' + (p > 0 ? 'var(--sqL)' : 'var(--sqD)') + '">' + CS.html(p, shape, finish) + '</div>'; };
  const swatch = (val, label, on, inner, title) => '<button class="thm" data-k="' + val + '"' + (title ? ' title="' + title + '"' : '') + ' style="padding:6px;border-radius:10px;border:2px solid ' + (on ? 'var(--acc)' : 'var(--line)') + ';background:var(--panel2);color:var(--text);text-align:center">' + inner + '<span class="small">' + label + '</span></button>';

  UI.sections.settings = (host, api) => {
    const st = () => CS.cfg();
    let board = null, group = '';
    const build = () => {
      const c = st(), sizeVal = c.size ? c.size : c.maxsz, boardPx = v => v * 8 + ' px';
      const shape = CS.shapeOf(c.pieces), finish = CS.finishOf();
      const themeName = (CS.THEMES.find(t => t[0] === c.theme) || [])[1] || c.theme;
      const groups = CS.THEMEGROUPS.filter(g => g !== 'Custom');
      host.innerHTML = '<div class="acw" style="align-items:flex-start"><div style="display:flex;flex-direction:column;gap:8px;align-items:center;position:sticky;top:0">' +
        '<div id="sbd" style="--csz:min(62px,calc((100vw - 56px)/8))"></div>' +
        '<div class="card small" style="margin:0;max-width:340px;text-align:center"><b id="ssum"></b><div class="small mute" id="ssum2"></div></div>' +
        '<div class="row" style="gap:6px;flex-wrap:wrap;justify-content:center">' +
        '<button class="ib" id="sflip">⇅ Flip board</button><button class="ib" id="sreset">↺ Reset position</button><button class="ib" id="ssnd">🔊 Test move sound</button><button class="ib" id="ssur">🎲 Surprise me</button></div>' +
        '<div class="small mute" style="max-width:360px;text-align:center">A live preview (a little smaller than your real boards). Click or drag a piece to see move hints, the last-move highlight, sounds and animation.</div></div>' +
        '<div style="flex:1;min-width:300px;max-width:600px;display:flex;flex-direction:column;gap:10px">' +
        card('Chess experience', '<div class="row" id="sexp-mode" style="gap:6px"><button class="ib' + (CS.experience() === 'modern' ? ' on' : '') + '" data-mode="modern">Moundshroud</button><button class="ib' + (CS.experience() === 'legacy' ? ' on' : '') + '" data-mode="legacy">Legacy</button></div>', 'Legacy hides the added evaluation graph and turns off opening-book moves for the computer opponent.') +
        card('Opening book for opponents', '<label class="chk"><input type="checkbox" id="sbook"' + (CS.openingBook() && CS.experience() !== 'legacy' ? ' checked' : '') + (CS.experience() === 'legacy' ? ' disabled' : '') + '> Let the computer play known opening moves</label>', 'Uses Moundshroud’s built-in opening lines for the first part of a game, then hands play back to the selected opponent.') +
        card('✨ Presets', '<div class="row" id="slooks" style="gap:6px;flex-wrap:wrap">' + CS.LOOKS.map((l, i) => '<button class="chip" data-i="' + i + '" title="' + l[1] + '">' + l[0] + '</button>').join('') + '</div>', 'One click sets the board, the piece shape and how the pieces are painted. Change anything afterwards.') +
        card('♟ Piece shape', '<div id="ssets" style="display:grid;grid-template-columns:repeat(auto-fill,minmax(120px,1fr));gap:8px">' + CS.SHAPES.map(s => swatch(s[0], s[1], shape === s[0], '<div style="display:flex;justify-content:center">' + cell(s[0], CS.SHAPEDEF[s[0]] || finish, 2) + cell(s[0], CS.SHAPEDEF[s[0]] || finish, -5) + '</div>', s[2])).join('') + '</div>', 'The same shape works with every finish below.') +
        card('🎨 Piece finish', '<div id="sfins" style="display:grid;grid-template-columns:repeat(auto-fill,minmax(120px,1fr));gap:8px">' + CS.FINISHES.map(f => swatch(f[0], f[1], finish === f[0], '<div style="display:flex;justify-content:center">' + cell(shape, f[0], 2) + cell(shape, f[0], -5) + '</div>', f[2])).join('') + '</div>' +
          '<div class="row" style="gap:12px;flex-wrap:wrap;margin-top:10px"><label class="row" style="gap:6px">White pieces <input type="color" id="spw" value="' + (c.pw || CS.SETD[shape].pw) + '"></label><label class="row" style="gap:6px">Black pieces <input type="color" id="spb" value="' + (c.pb || CS.SETD[shape].pb) + '"></label><label class="row" style="gap:6px">Accents <input type="color" id="sfl" value="' + (c.flair || '#c0392b') + '"></label><button class="ib" id="spx">Use the defaults</button></div>' +
          lab('Outline') + seg('sout', [['none', 'None'], ['auto', 'Normal'], ['bold', 'Bold']], c.outline) + slider('spsc', 'Piece size', 70, 118, 2, c.pscale, v => v + '%') + '<label class="chk"><input type="checkbox" id="spsh"' + (c.pshadow ? ' checked' : '') + '> Soft shadow under pieces</label>') +
        card('🎨 Board colours', '<div class="row" id="sthgrp" style="gap:6px;flex-wrap:wrap;margin-bottom:8px"><button class="ib' + (group ? '' : ' on') + '" data-g="">All</button>' + groups.map(g => '<button class="ib' + (group === g ? ' on' : '') + '" data-g="' + g + '">' + g + '</button>').join('') + '</div>' +
          '<div id="sthemes" style="display:grid;grid-template-columns:repeat(auto-fill,minmax(112px,1fr));gap:8px">' + CS.THEMES.filter(t => !group || t[4] === group).map(t => { const L = t[0] === 'custom' ? c.lightC : t[2], D = t[0] === 'custom' ? c.darkC : t[3]; return '<button class="thm" data-t="' + t[0] + '" style="text-align:left;padding:6px;border-radius:10px;border:2px solid ' + (c.theme === t[0] ? 'var(--acc)' : 'var(--line)') + ';background:var(--panel2);color:var(--text)"><span style="display:grid;grid-template-columns:repeat(4,1fr);height:28px;border-radius:6px;overflow:hidden;margin-bottom:4px">' + [0, 1, 0, 1, 1, 0, 1, 0].map(x => '<i style="background:' + (L && D ? (x ? D : L) : (x ? 'var(--sqD)' : 'var(--sqL)')) + '"></i>').join('') + '</span><span class="small">' + t[1] + '</span></button>'; }).join('') + '</div>' +
          '<div id="scust" class="row" style="gap:12px;margin-top:8px;' + (c.theme === 'custom' ? '' : 'display:none') + '"><label class="row" style="gap:6px">Light squares <input type="color" id="scl" value="' + c.lightC + '"></label><label class="row" style="gap:6px">Dark squares <input type="color" id="scd" value="' + c.darkC + '"></label></div>' +
          lab('Surface') + seg('stex', CS.TEX, c.tex) + lab('Frame') + seg('sframe', CS.FRAMES, c.frame) +
          slider('srad', 'Corner roundness', 0, 28, 1, c.radius, v => v + ' px') + '<label class="chk"><input type="checkbox" id="sgrid"' + (c.grid ? ' checked' : '') + '> Thin lines between squares</label>') +
        card('📐 Board size', seg('smode', [['auto', 'Fit the window'], ['fixed', 'Fixed size']], c.size ? 'fixed' : 'auto') + slider('ssz', c.size ? 'Square size' : 'Largest square', 36, 150, 2, sizeVal, v => 'board ' + boardPx(v)), 'Fit the window makes the board as large as the window allows, up to your chosen limit. Fixed always uses the same size.') +
        card('🔤 Square names', seg('scoords', [['off', 'Hidden'], ['in', 'Inside squares (like chess.com)'], ['out', 'Outside the board']], c.coords) + slider('sco', 'Letter size', 60, 170, 5, c.coordSize, v => v + '%'), 'Shows a to h along the bottom and 1 to 8 up the side. They follow the board when it is flipped. This applies to every board in the chess section.') +
        card('💡 Highlights', lab('Last move') + '<div class="row" id="shl" style="gap:8px;flex-wrap:wrap">' + Object.keys(CS.HL).map(k => '<button class="ib" data-v="' + k + '" title="' + k + '" style="width:36px;height:30px;padding:0;border-radius:8px;border:2px solid ' + (c.hl === k ? 'var(--acc)' : 'var(--line)') + ';background:' + (k === 'off' ? 'var(--panel2)' : CS.HL[k]) + '">' + (k === 'off' ? '✕' : '') + '</button>').join('') + '</div>' +
          lab('Move hints') + seg('sdots', [['dot', 'Dots'], ['ring', 'Rings'], ['big', 'Big dots'], ['square', 'Squares']], c.dots) + '<label class="chk" style="margin-top:6px"><input type="checkbox" id="sleg"' + (c.legal ? ' checked' : '') + '> Show where the selected piece can go</label><label class="chk"><input type="checkbox" id="schk"' + (c.check ? ' checked' : '') + '> Glow on a king in check</label>') +
        card('🎞️ Motion and sound', lab('Piece movement') + seg('sanim', [['off', 'Instant'], ['fast', 'Fast'], ['normal', 'Normal'], ['slow', 'Slow']], c.anim) + '<label class="chk" style="margin-top:8px"><input type="checkbox" id="ssnon"' + (c.sound ? ' checked' : '') + '> Play move sounds (made on the spot, nothing to download)</label>' + slider('svol', 'Volume', 5, 100, 5, c.vol, v => v + '%') +
          '<div class="row" style="gap:6px;flex-wrap:wrap"><button class="ib" data-k="move">Move</button><button class="ib" data-k="capture">Capture</button><button class="ib" data-k="castle">Castle</button><button class="ib" data-k="check">Check</button><button class="ib" data-k="promote">Promote</button><button class="ib" data-k="win">Victory</button></div>') +
        card('💾 Keep or reset', '<div class="row" style="gap:8px"><button class="ib" id="sexp">Copy my board settings</button><button class="ib" id="simp">Paste settings</button><span class="sp"></span><button class="ib dang" id="srst">Reset all</button></div>') +
        '</div></div>';
      summary(); preview(); wire();
    };
    const summary = () => { const c = st(), s = host.querySelector('#ssum'), s2 = host.querySelector('#ssum2'); if (!s) return;
      s.textContent = CS.SHAPENAME[CS.shapeOf(c.pieces)] + ' · ' + CS.FINNAME[CS.finishOf()] + ' · ' + ((CS.THEMES.find(t => t[0] === c.theme) || [])[1] || c.theme);
      const t = CS.TEX.find(x => x[0] === c.tex), f = CS.FRAMES.find(x => x[0] === c.frame);
      s2.textContent = (t ? t[1] : c.tex) + ' surface · ' + (f ? f[1] : c.frame) + ' frame · ' + (c.coords === 'off' ? 'no square names' : c.coords === 'in' ? 'names inside' : 'names outside'); };
    const preview = () => { if (board) board.destroy(); board = new UI.Board(host.querySelector('#sbd')); board.set(FEN, { who: 2, last: [C.sqIndex('c4'), C.sqIndex('f7')], anim: false }); };
    const wire = () => {
      const q = id => host.querySelector('#' + id), set = CS.set;
      q('sexp-mode').onclick = e => { const b = e.target.closest('[data-mode]'); if (!b) return; CS.experience(b.dataset.mode); build(); };
      q('sbook').onchange = e => CS.openingBook(e.target.checked);
      const sg = (id, key, after) => { q(id).onclick = e => { const b = e.target.closest('button'); if (!b) return; set(key, b.dataset.v); q(id).querySelectorAll('button').forEach(x => x.classList.toggle('on', x === b)); if (after) after(); }; };
      const sl = (id, key, fmt) => { const e = q(id); e.oninput = () => { set(key, +e.value); q(id + 'v').textContent = fmt(+e.value); }; };
      q('slooks').onclick = e => { const b = e.target.closest('.chip'); if (!b) return; const L = CS.LOOKS[+b.dataset.i]; CS.look(L[2]); try { ChessAch.event('look', { name: L[0] }); } catch (e) { } build(); A.toast('Look: ' + L[0]); };
      q('ssur').onclick = () => { const r = CS.surprise(); build(); A.toast('🎲 ' + r.shape + ' · ' + r.finish + ' · ' + r.theme, 4000); };
      q('smode').onclick = e => { const b = e.target.closest('button'); if (!b) return; const v = +q('ssz').value; if (b.dataset.v === 'fixed') CS.setMany({ size: v }); else CS.setMany({ size: 0, maxsz: v }); build(); };
      q('ssz').oninput = () => { const v = +q('ssz').value; if (st().size) CS.set('size', v); else CS.set('maxsz', v); q('sszv').textContent = 'board ' + v * 8 + ' px'; };
      q('sthgrp').onclick = e => { const b = e.target.closest('[data-g]'); if (!b) return; group = b.dataset.g; build(); };
      q('sthemes').onclick = e => { const b = e.target.closest('[data-t]'); if (!b) return; set('theme', b.dataset.t); q('sthemes').querySelectorAll('[data-t]').forEach(x => { x.style.borderColor = x === b ? 'var(--acc)' : 'var(--line)'; }); q('scust').style.display = b.dataset.t === 'custom' ? '' : 'none'; summary(); };
      q('scl').oninput = () => { CS.set('lightC', q('scl').value); }; q('scd').oninput = () => { CS.set('darkC', q('scd').value); };
      sg('stex', 'tex', summary); sg('sframe', 'frame', summary); sl('srad', 'radius', v => v + ' px'); q('sgrid').onchange = () => set('grid', q('sgrid').checked ? 1 : 0);
      q('ssets').onclick = e => { const b = e.target.closest('[data-k]'); if (!b) return; CS.setMany({ pieces: b.dataset.k, finish: '', pw: '', pb: '' }); build(); };
      q('sfins').onclick = e => { const b = e.target.closest('[data-k]'); if (!b) return; CS.set('finish', b.dataset.k); q('sfins').querySelectorAll('[data-k]').forEach(x => { x.style.borderColor = x === b ? 'var(--acc)' : 'var(--line)'; }); summary(); };
      q('spw').oninput = () => set('pw', q('spw').value); q('spb').oninput = () => set('pb', q('spb').value); q('sfl').oninput = () => set('flair', q('sfl').value);
      q('spx').onclick = () => { const sh = CS.shapeOf(st().pieces); CS.setMany({ pw: '', pb: '', flair: '#c0392b', finish: '' }); build(); };
      sg('sout', 'outline'); sl('spsc', 'pscale', v => v + '%'); q('spsh').onchange = () => set('pshadow', q('spsh').checked ? 1 : 0);
      sg('scoords', 'coords', summary); sl('sco', 'coordSize', v => v + '%');
      q('shl').onclick = e => { const b = e.target.closest('[data-v]'); if (!b) return; set('hl', b.dataset.v); q('shl').querySelectorAll('button').forEach(x => { x.style.borderColor = x === b ? 'var(--acc)' : 'var(--line)'; }); };
      sg('sdots', 'dots'); q('sleg').onchange = () => set('legal', q('sleg').checked ? 1 : 0); q('schk').onchange = () => set('check', q('schk').checked ? 1 : 0);
      sg('sanim', 'anim'); q('ssnon').onchange = () => { set('sound', q('ssnon').checked ? 1 : 0); if (q('ssnon').checked) CS.sound('move'); }; sl('svol', 'vol', v => v + '%');
      host.querySelectorAll('[data-k="move"],[data-k="capture"],[data-k="castle"],[data-k="check"],[data-k="promote"],[data-k="win"]').forEach(b => b.onclick = () => { const was = st().sound; CS.cfg().sound = 1; CS.sound(b.dataset.k); CS.cfg().sound = was; });
      q('sflip').onclick = () => { board.flipped = !board.flipped; board.draw(); }; q('sreset').onclick = () => board.set(FEN, { who: 2, last: [C.sqIndex('c4'), C.sqIndex('f7')], anim: false });
      q('ssnd').onclick = () => { const was = st().sound; CS.cfg().sound = 1; CS.sound('capture'); CS.cfg().sound = was; };
      q('sexp').onclick = () => { A.copy ? A.copy(CS.exportJson()) : navigator.clipboard.writeText(CS.exportJson()); A.toast('Board settings copied'); };
      q('simp').onclick = async () => { const s = (await A.prompt('Paste the board settings you copied earlier:')); if (!s) return; try { CS.importJson(s); build(); A.toast('Board settings loaded'); } catch (e) { A.toast('That does not look like board settings'); } };
      q('srst').onclick = async () => { if (!(await A.confirm('Put every board setting back to the defaults?'))) return; CS.reset(); build(); A.toast('Board settings reset'); };
    };
    build(); return () => { if (board) board.destroy(); board = null; };
  };
})();

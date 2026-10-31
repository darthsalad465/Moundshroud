// Chess by voice: say a move ("knight f three", "castle kingside") or describe it roughly ("take their queen with the bishop",
// "bring out the knight near the king") and it is played on whichever chess board is open: games against Moundshroud, online, daily, tournaments,
// careers, puzzles, lessons and analysis. Moves can be read aloud, pieces can be hidden for blindfold games, and Moundshroud can listen
// by itself after every reply (hands-free). Speech is recognised on this PC; nothing leaves it.
(() => {
  const C = window.Chess; if (!C) return;
  const KEY = 'chvoice', cfg = Object.assign({ on: 1, ann: 0, hands: 0, blind: 0, confirm: 'smart', open: 0 }, (() => { try { return JSON.parse(ls.get(KEY, '{}')); } catch (e) { return {}; } })());
  const save = () => ls.set(KEY, JSON.stringify(cfg));
  const FILES = 'abcdefgh', PN = ['', 'pawn', 'knight', 'bishop', 'rook', 'queen', 'king'];
  const sqName = s => FILES[s & 7] + (8 - (s >> 3)), sqSay = s => FILES[s & 7].toUpperCase() + ' ' + (8 - (s >> 3));
  const NUM = { one: 1, won: 1, two: 2, too: 2, tu: 2, three: 3, tree: 3, free: 3, four: 4, for: 4, fore: 4, five: 5, six: 6, seven: 7, eight: 8, ate: 8, ait: 8 };
  const FILEW = { a: 'a', eh: 'a', ay: 'a', alpha: 'a', alfa: 'a', b: 'b', bee: 'b', be: 'b', bravo: 'b', c: 'c', see: 'c', sea: 'c', charlie: 'c', d: 'd', dee: 'd', delta: 'd', e: 'e', ee: 'e', echo: 'e', f: 'f', eff: 'f', ef: 'f', foxtrot: 'f', g: 'g', gee: 'g', jee: 'g', golf: 'g', h: 'h', aitch: 'h', age: 'h', hotel: 'h' };
  const PIECEW = { pawn: 1, pawns: 1, pond: 1, porn: 1, pun: 1, knight: 2, knights: 2, night: 2, nights: 2, nite: 2, horse: 2, bishop: 3, bishops: 3, rook: 4, rooks: 4, tower: 4, brook: 4, rock: 4, queen: 5, queens: 5, king: 6, kings: 6 };
  const CAPW = new Set(['takes', 'take', 'taking', 'captures', 'capture', 'capturing', 'eats', 'beats', 'kills', 'x', 'snatch', 'grab', 'grabs', 'win', 'wins']);
  const bus = { board: null, awaiting: null, last: '', busy: false, status: '', transcript: '' };

  /* ---------- finding the board ---------- */
  const boards = () => [...(window.ChessSet ? ChessSet.boards : [])].filter(b => b.el && b.el.isConnected && b.el.offsetParent);
  const active = () => { const l = boards().filter(b => b.who); return l.find(b => b.voiceLegal && b.voiceLegal().length) || l[0] || null; };

  /* ---------- turning words into constraints ---------- */
  const norm = t => {
    t = String(t || '').toLowerCase().replace(/[’']s\b/g, 's').replace(/[.,!?;:"()]/g, ' ').replace(/0-0-0|o-o-o|zero zero zero|oh oh oh/g, ' castle queenside ').replace(/0-0|o-o|zero zero|oh oh/g, ' castle kingside ');
    t = t.replace(/\b([a-h])\s*x\s*([a-h][1-8])\b/g, '$1 takes $2').replace(/\b([a-h])[\s-]*([1-8])\b/g, ' $1$2 ').replace(/\s+/g, ' ').trim();
    return t;
  };
  function parse(text) {
    const toks = norm(text).split(' ').filter(Boolean), p = { squares: [], pieces: [], capture: false, capPiece: 0, castle: null, promo: 0, check: false, mate: false, wing: null, region: null, fileRef: null, steps: 0, develop: false, advance: false, back: false, centre: false, fromHint: -1, raw: toks.join(' ') };
    // squares first: "e4", or a file word followed by a number word ("bee four")
    const t2 = []; for (let i = 0; i < toks.length; i++) {
      const w = toks[i];
      if (/^[a-h][1-8]$/.test(w)) { t2.push({ sq: w }); continue; }
      if (FILEW[w] && i + 1 < toks.length && (/^[1-8]$/.test(toks[i + 1]) || NUM[toks[i + 1]])) { const n = /^[1-8]$/.test(toks[i + 1]) ? +toks[i + 1] : NUM[toks[i + 1]]; t2.push({ sq: FILEW[w] + n }); i++; continue; }
      if (FILEW[w] && w.length > 1 && i + 2 < toks.length && toks[i + 1] === 'to' && !/^[a-h][1-8]$/.test(toks[i + 2]) && !FILEW[toks[i + 2]]) { t2.push({ sq: FILEW[w] + '2' }); i++; continue; }
      t2.push({ w });
    }
    for (let i = 0; i < t2.length; i++) {
      const x = t2[i]; if (x.sq) { const s = (8 - +x.sq[1]) * 8 + FILES.indexOf(x.sq[0]), prev = (t2[i - 1] || {}).w, prev2 = (t2[i - 2] || {}).w; const asFrom = prev === 'from' || ((prev === 'on' || prev === 'at') && PIECEW[prev2]); p.squares.push({ s, from: !!asFrom }); continue; }
      const w = x.w, nx = (t2[i + 1] || {}).w, pv = (t2[i - 1] || {}).w;
      if ((w === 'king' || w === 'queen') && nx === 'side') { if (p.castle) p.castle = w === 'king' ? 'k' : 'q'; else p.region = w === 'king' ? 'k' : 'q'; t2[i + 1] = { w: '_' }; continue; }
      if ((w === 'king' || w === 'queen') && PIECEW[nx] && PIECEW[nx] < 5) { p.wing = w === 'king' ? 'k' : 'q'; continue; }
      if ((w === 'castle' || w === 'castles' || w === 'castling') && !(t2.some(y => y.sq) && !t2.some(y => /^(kingside|queenside|short|long)$/.test(y.w || '')))) { p.castle = p.castle || 'any'; continue; }
      if (w === 'castle' || w === 'castles') { p.pieces.push(4); continue; }
      if (/^(kingside|short)$/.test(w) || (w === 'side' && (pv === 'king' || pv === 'kings'))) { if (p.castle) p.castle = 'k'; else p.region = 'k'; continue; }
      if (/^(queenside|long)$/.test(w) || (w === 'side' && (pv === 'queen' || pv === 'queens'))) { if (p.castle) p.castle = 'q'; else p.region = 'q'; continue; }
      if (/^(kings|queens)$/.test(w) && PIECEW[nx] && PIECEW[nx] < 5) { p.wing = w === 'kings' ? 'k' : 'q'; continue; }
      if (FILEW[w] && (nx === 'pawn' || nx === 'file' || CAPW.has(nx)) && !/^[a-h][1-8]$/.test(nx || '')) { p.fileRef = FILEW[w]; if (nx === 'pawn') { p.pieces.push(1); i++; } continue; }
      if (CAPW.has(w)) { p.capture = true; const k = [(t2[i + 1] || {}).w, (t2[i + 2] || {}).w, (t2[i + 3] || {}).w].find(z => PIECEW[z]); if (k) { p.capPiece = PIECEW[k]; const at = t2.findIndex((y, j) => j > i && y.w === k); t2[at] = { w: '_' }; } continue; }
      if (/^(promote|promotes|promoting|promotion|equals)$/.test(w)) { const k = [(t2[i + 1] || {}).w, (t2[i + 2] || {}).w].find(z => PIECEW[z]); if (k) { p.promo = PIECEW[k]; const at = t2.findIndex((y, j) => j > i && y.w === k); t2[at] = { w: '_' }; } continue; }
      if (PIECEW[w] && i > 0 && t2[i - 1].sq && !p.pieces.length && PIECEW[w] > 1 && PIECEW[w] < 6 && !p.promo) { p.promo = PIECEW[w]; continue; }
      if (PIECEW[w]) { p.pieces.push(PIECEW[w]); continue; }
      if (w === 'front' && nx === 'of') { const k = /^(king|queen|kings|queens)$/.test((t2[i + 3] || {}).w || '') ? i + 3 : /^(king|queen|kings|queens)$/.test((t2[i + 2] || {}).w || '') ? i + 2 : -1; if (k > 0) { p.front = /^king/.test(t2[k].w) ? 'king' : 'queen'; t2[k] = { w: '_' }; continue; } }
      if (w === 'check') p.check = true; else if (w === 'checkmate' || w === 'mate') p.mate = true;
      else if (/^(develop|developing|bring|out)$/.test(w)) p.develop = true; else if (/^(advance|push|forward|ahead)$/.test(w)) p.advance = true; else if (/^(back|retreat|backward|backwards)$/.test(w)) p.back = true; else if (/^(center|centre|middle)$/.test(w)) p.centre = true;
      else if ((w === 'one' || w === 'two' || w === '1' || w === '2') && /^(square|squares|step|steps|space|spaces)$/.test(nx || '')) p.steps = (w === 'one' || w === '1') ? 1 : 2;
    }
    return p;
  }
  /* ---------- scoring the legal moves ---------- */
  const givesCheck = (pos, m) => { try { pos.make(m); const c = pos.inCheck(), ok = c ? (pos.legal().length ? 'check' : 'mate') : ''; pos.unmake(); return ok; } catch (e) { return ''; } };
  function rank(pos, legal, p) {
    p = Object.assign({ squares: [], pieces: [] }, p); const out = [];
    legal.forEach(m => {
      const f = m & 63, t = (m >> 6) & 63, pc = Math.abs(pos.b[f]), tgt = Math.abs(pos.b[t]), ep = pc === 1 && (f & 7) !== (t & 7) && !tgt, cap = !!tgt || ep, capT = ep ? 1 : tgt, castle = pc === 6 && Math.abs(t - f) === 2, pr = (m >> 12) & 7; let s = 0, why = [];
      if (p.castle) { if (!castle) return; s += 100; if (p.castle === 'k' && t > f) s += 20; else if (p.castle === 'q' && t < f) s += 20; else if (p.castle !== 'any') return; out.push({ m, s, f, t }); return; }
      if (castle && !p.squares.length && !p.pieces.some(x => x === 6) && !p.castle) s -= 30;
      const sq = p.squares;
      if (sq.length) {
        let to = -1, from = -1; if (sq.length >= 2) { from = sq[0].s; to = sq[1].s; } else if (sq[0].from) from = sq[0].s; else to = sq[0].s;
        if (to >= 0) s += t === to ? 60 : -100; if (from >= 0) s += f === from ? 45 : -100;
      }
      const mover = p.pieces[0]; if (mover) s += pc === mover ? 30 : -60; else if (sq.length === 1 && !sq[0].from && !p.capture && pc === 1) s += 22;
      if (p.capture) s += cap ? 16 : -20; if (p.capPiece) s += cap && capT === p.capPiece ? 32 : -40;
      if (p.fileRef) s += (f & 7) === FILES.indexOf(p.fileRef) ? 40 : -60;
      if (p.front) { let ks = -1; for (let i = 0; i < 64; i++) if (pos.b[i] === (p.front === 'king' ? 6 : 5) * pos.side) ks = i; if (ks >= 0) s += (f & 7) === (ks & 7) && pc === 1 ? 40 : -50; }
      const wg = p.wing || (p.region && !sq.length && mover ? p.region : null);
      if (wg && mover) { const home = { 2: { k: 6, q: 1 }, 3: { k: 5, q: 2 }, 4: { k: 7, q: 0 }, 1: { k: 4, q: 3 } }[mover]; if (home) s += (f & 7) === home[wg] ? 25 : -25; }
      else if (p.wing) s += ((f & 7) >= 4) === (p.wing === 'k') ? 6 : -6;
      if (p.region && !sq.length) { const kside = (t & 7) >= 4; s += (p.region === 'k') === kside ? 10 : -10; }
      if (p.steps && pc === 1) s += Math.abs((t >> 3) - (f >> 3)) === p.steps ? 22 : -22;
      const home = pos.side > 0 ? 7 : 0, fwd = (t >> 3) - (f >> 3); const dir = pos.side > 0 ? -fwd : fwd;
      if (p.develop && (pc === 2 || pc === 3) && (f >> 3) === home) s += 20; if (p.advance && pc === 1) s += 12; if (p.advance && dir > 0) s += 4; if (p.back && dir < 0) s += 14;
      if (p.centre && [27, 28, 35, 36].includes(t)) s += 14; else if (p.centre && t >= 18 && t <= 45 && (t & 7) >= 2 && (t & 7) <= 5) s += 4;
      if (pr) { s += p.promo ? (pr === p.promo ? 24 : -30) : (pr === 5 ? 6 : -4); }
      if (p.check || p.mate) { const g = givesCheck(pos, m); if (p.mate) s += g === 'mate' ? 40 : -20; else s += g ? 20 : -12; }
      out.push({ m, s, f, t });
    });
    return out.sort((a, b) => b.s - a.s);
  }
  /* ---------- saying moves ---------- */
  const spokenSan = san => String(san).replace(/O-O-O/g, 'castles queenside').replace(/O-O/g, 'castles kingside').replace(/([KQRBN])/g, m => ({ K: 'king ', Q: 'queen ', R: 'rook ', B: 'bishop ', N: 'knight ' }[m])).replace(/x/g, ' takes ').replace(/=([QRBN])/g, (a, b) => ' promotes to ' + ({ Q: 'queen', R: 'rook', B: 'bishop', N: 'knight' }[b])).replace(/\+/g, ', check').replace(/#/g, ', checkmate').replace(/([a-h])([1-8])/g, (a, f, r) => ' ' + f.toUpperCase() + ' ' + r + ' ').replace(/\s+/g, ' ').replace(/^ | $/g, '').replace(/^([a-h]) takes/i, m => m);
  const describe = (pos, m) => {
    const f = m & 63, t = (m >> 6) & 63, pc = Math.abs(pos.b[f]), tg = Math.abs(pos.b[t]), ep = pc === 1 && (f & 7) !== (t & 7) && !tg, cap = !!tg || ep, pr = (m >> 12) & 7; let legal = []; try { legal = pos.legal(); } catch (e) { }
    let s; if (pc === 6 && Math.abs(t - f) === 2) s = 'castles ' + (t > f ? 'kingside' : 'queenside');
    else if (pc === 1) s = cap ? FILES[f & 7].toUpperCase() + ' pawn takes ' + sqSay(t) : 'pawn to ' + sqSay(t);
    else { const same = legal.filter(x => x !== m && ((x >> 6) & 63) === t && Math.abs(pos.b[x & 63]) === pc).length; s = PN[pc] + (same ? ' from ' + sqSay(f) : '') + (cap ? ' takes ' : ' to ') + sqSay(t); }
    if (pr) s += ', promotes to ' + PN[pr]; const g = givesCheck(pos, m); if (g) s += g === 'mate' ? ', checkmate' : ', check'; return s;
  };
  const speak = async text => { bus.last = text; setStatus(text); if (A.speech && A.speech.available()) { try { await A.speech.speakAsync(text); } catch (e) { } } };
  const beep = () => { try { A.cvoice && A.cvoice.noise('beep', .6); } catch (e) { } };

  /* ---------- reading the board ---------- */
  const listPieces = (pos, side) => { const by = {}; for (let i = 0; i < 64; i++) { const v = pos.b[i]; if (v && v * side > 0) (by[Math.abs(v)] = by[Math.abs(v)] || []).push(sqSay(i)); } return [6, 5, 4, 3, 2, 1].filter(k => by[k]).map(k => PN[k] + (by[k].length > 1 ? 's' : '') + ' ' + by[k].join(', ')).join('. '); };
  const squareInfo = (pos, s) => { const v = pos.b[s]; return v ? (v > 0 ? 'White ' : 'Black ') + PN[Math.abs(v)] + ' on ' + sqSay(s) : sqSay(s) + ' is empty'; };

  /* ---------- the conversation ---------- */
  const YES = /\b(yes|yeah|yep|yup|correct|confirm|confirmed|ok|okay|sure|play it|do it|go ahead|right|that one|first)\b/, NO = /\b(no|nope|nah|cancel|wrong|negative|not that|stop|never ?mind|second)\b/;
  async function play(b, m, how) {
    b.voiceCommit(m); bus.awaiting = null; bus.lastMove = 'You played ' + how + '.';
    if (cfg.ann || cfg.blind || cfg.hands) await speak('You play ' + how + '.'); else A.toast('Played ' + how, 2500);
  }
  async function confirmThen(b, m, say) {
    bus.awaiting = { b, m, say }; const q = cfg.confirm === 'never' ? null : 'Play ' + say + '? Say yes or no.';
    if (!q) return play(b, m, say); await speak(q); if (cfg.hands || cfg.ann || cfg.blind) listen();
  }
  async function interpret(text) {
    text = String(text || '').trim(); if (text.length < 2) { setStatus('I did not catch that.'); return; } bus.transcript = text; setStatus('Heard: “' + text + '”');
    const t = norm(text), b = active();
    if (bus.awaiting) { const aw = bus.awaiting; if (YES.test(t) && !NO.test(t)) { bus.awaiting = null; return play(aw.b, aw.m, aw.say); } if (NO.test(t)) { bus.awaiting = null; await speak('Okay. Say the move again.'); if (cfg.hands) listen(); return; } }
    // commands
    if (/\b(repeat|say that again|again|what did (he|they|you) (play|say))\b/.test(t) && !/\b(takes|castle)\b/.test(t)) return speak(bus.last || 'Nothing to repeat yet.');
    if (/\b(help|commands|what can i say)\b/.test(t)) return speak('Say a move like knight F 3, E 4, or castle kingside. You can also describe it: take their queen with the bishop, or bring out the knight near the king. Say read the board, my pieces, their pieces, what is on E 4, or my moves.');
    if (/\bblindfold (on|off)\b/.test(t)) { setBlind(/ on\b/.test(t)); return speak('Blindfold ' + (cfg.blind ? 'on' : 'off') + '.'); }
    if (/\bhands ?free (on|off)\b/.test(t)) { cfg.hands = / on\b/.test(t) ? 1 : 0; save(); drawDock(); return speak('Hands free ' + (cfg.hands ? 'on' : 'off') + '.'); }
    if (!b) return speak('There is no chess board open to play on.');
    const pos = b.pos;
    if (/\b(my pieces|where are my pieces|read (my )?pieces)\b/.test(t)) return speak('Your pieces. ' + listPieces(pos, b.who === 2 ? pos.side : b.who));
    if (/\b(their pieces|opponent'?s? pieces|enemy pieces)\b/.test(t)) return speak('Their pieces. ' + listPieces(pos, -(b.who === 2 ? pos.side : b.who)));
    if (/\b(read|describe|say|tell me) (the |my )?board\b|\bwhere is everything\b/.test(t)) return speak('White. ' + listPieces(pos, 1) + '. Black. ' + listPieces(pos, -1));
    const asked = /\b(what('?s| is)? (on|at)|who is on|is there anything on)\b/.test(t) ? parse(text).squares : []; if (asked.length) return speak(squareInfo(pos, asked[0].s));
    if (/\b(what colou?r am i|which side|who am i|whose (turn|move)|my turn)\b/.test(t)) return speak((b.who === 2 ? 'You play both sides. ' : 'You are ' + (b.who > 0 ? 'White' : 'Black') + '. ') + (pos.side > 0 ? 'White' : 'Black') + ' to move.');
    if (/\b(my moves|legal moves|what can i play|what moves)\b/.test(t)) { const l = b.voiceLegal(); if (!l.length) return speak('It is not your move.'); const names = l.slice(0, 14).map(m => describe(pos, m)); return speak('You have ' + l.length + ' moves. ' + names.join('. ') + (l.length > 14 ? '. And more.' : '')); }
    if (/\b(last move|what was the last move|what did they play)\b/.test(t)) return speak(bus.lastMove || 'No move has been played yet.');
    // moves
    const legal = b.voiceLegal(); if (!legal.length) return speak('It is not your move yet.');
    const p = parse(text), ranked = rank(pos, legal, p).filter(x => x.s > -50), top = ranked[0], second = ranked[1];
    const specific = p.castle || p.squares.length || (p.pieces.length && p.squares.length);
    // notation, or a description specific enough that only one legal move fits: play it without checking back
    if (top && top.s >= 45 && (!second || top.s - second.s >= 15)) { const say = describe(pos, top.m); return cfg.confirm === 'always' ? confirmThen(b, top.m, say) : play(b, top.m, say); }
    // a rough description: ask the AI model to choose among the plausible legal moves
    const pool = (ranked.length && ranked[0].s > -20 ? ranked.slice(0, 10) : rank(pos, legal, {}).slice(0, 40)).map(x => x.m);
    if (A.ai && A.ai.once && !(A.power && A.power.on) && !(window.ChessFair && ChessFair.live) && pool.length > 1) {      // no AI at all during a real Lichess game
      setStatus('Working out which move you mean...');
      const list = pool.map(m => { let san = ''; try { san = pos.san(m, legal); } catch (e) { } return { m, san, line: san + ' (' + PN[Math.abs(pos.b[m & 63])] + ' ' + sqName(m & 63) + ' to ' + sqName((m >> 6) & 63) + ')' }; });
      let out = ''; try { out = await Promise.race([A.ai.once([{ role: 'system', content: 'You turn a spoken description of a chess move into one legal move. The player is ' + (pos.side > 0 ? 'White' : 'Black') + '. Position (FEN): ' + pos.fen() + '. Legal candidates:\n' + list.map(x => x.line).join('\n') + '\nReply with exactly one candidate in standard algebraic notation (the part before the bracket), or NONE if the description does not clearly match a single candidate.' }, { role: 'user', content: 'The player said: "' + text + '"' }], { temp: 0 }), new Promise(r => setTimeout(() => r(''), 25000))]); } catch (e) { out = ''; }
      out = String(out || '').replace(/<think>[\s\S]*?<\/think>/g, '').trim().split(/\s+/)[0].replace(/[^A-Za-z0-9=+#-]/g, ''); const hit = list.find(x => x.san.replace(/[+#]/g, '') === out.replace(/[+#]/g, ''));
      if (hit) return confirmThen(b, hit.m, describe(pos, hit.m));
    }
    if (top && top.s >= 30 && (!second || top.s - second.s >= 15)) return confirmThen(b, top.m, describe(pos, top.m));
    const opts = (ranked.length ? ranked : rank(pos, legal, {})).slice(0, 3).map(x => describe(pos, x.m));
    bus.awaiting = null; await speak(ranked.length ? 'I am not sure. Did you mean ' + opts.join(', or ') + '? Say the move again.' : 'I could not find a legal move like that. Say it again.'); if (cfg.hands) listen();
  }
  /* ---------- listening ---------- */
  function listen() {
    if (!A.voice || !A.voice.available()) { A.toast('Voice input is not available here.'); return; }
    if (A.voice.rec) { A.voice.stop(); return; } if (A.speech) A.speech.stop(); beep(); setStatus('Listening...'); setMic(true);
    A.voice.start(txt => { setMic(false); interpret(txt); }, (s) => { if (s === 'idle') setMic(false); if (s === 'busy') setStatus('Understanding...'); }, { auto: true, onSilence: () => { setMic(false); setStatus('I did not hear anything.'); } });
  }
  /* ---------- the board tells us about moves ---------- */
  function moved(b, prevB, last, changed) {
    if (!changed || !prevB || !last || b !== active()) return; const [fr, to] = last, pf = prevB[fr], pt = prevB[to]; if (!pf) return;
    const pc = Math.abs(pf), np = b.pos.b[to], cap = !!pt || (pc === 1 && (fr & 7) !== (to & 7)), castle = pc === 6 && Math.abs(to - fr) === 2, promo = pc === 1 && Math.abs(np) !== 1;
    const mine = performance.now() - (b._mine || 0) < 1500; let s = castle ? 'castles ' + (to > fr ? 'kingside' : 'queenside') : (PN[pc] + (cap ? ' on ' + sqSay(fr) + ' takes ' + PN[Math.abs(pt) || 1] + ' on ' + sqSay(to) : ' to ' + sqSay(to)) + (promo ? ', promotes to ' + PN[Math.abs(np)] : ''));
    if (b.pos.inCheck()) { let n = 0; try { n = b.pos.legal().length; } catch (e) { } s += n ? ', check' : ', checkmate'; }
    const who = pf > 0 ? 'White' : 'Black'; const line = (mine ? 'You play ' : who + ' plays ') + s + '.'; bus.lastMove = line;
    if (mine) return; if (!(cfg.ann || cfg.blind || cfg.hands)) return;
    setTimeout(async () => { await speak(line); if (cfg.hands && !mine && active() && active().voiceLegal().length) listen(); }, 250);
  }
  /* ---------- the little control dock ---------- */
  let dock = null; const hostOf = b => { const w = b.el && b.el.closest('.acbw'); return w && w.parentNode; };
  const setStatus = t => { bus.status = t; const e = document.getElementById('cvst'); if (e) e.textContent = t; };
  const setMic = on => { const e = document.getElementById('cvmic'); if (e) { e.textContent = on ? '⏺ Listening' : '🎤 Speak a move'; e.classList.toggle('on', on); } };
  const setBlind = v => { cfg.blind = v ? 1 : 0; window.__cvBlind = !!cfg.blind; save(); try { boards().forEach(b => b.draw()); } catch (e) { } drawDock(); };
  function drawDock() {
    if (!dock) { dock = document.createElement('div'); dock.id = 'cvdock'; dock.setAttribute('role', 'region'); dock.setAttribute('aria-label', 'Chess voice moves'); document.body.appendChild(dock); }
    const b = active(), show = !!cfg.on && !!b; dock.style.display = show ? '' : 'none'; if (!show) return;
    const host = hostOf(b); if (host && dock.parentNode !== host) host.appendChild(dock);
    dock.innerHTML = cfg.open ? '<div class="cvbar"><button class="pri" id="cvmic" title="Press V">🎤 Speak a move</button><input type="text" id="cvtype" placeholder="or type a move or a description" autocomplete="off" aria-label="Type a move"><button class="ib" id="cvgo">Play</button></div><div class="cvbar"><label class="chk small" title="Read every move aloud"><input type="checkbox" id="cvann"' + (cfg.ann ? ' checked' : '') + '> 🔊 Announce moves</label><label class="chk small" title="Hide the pieces: play from memory"><input type="checkbox" id="cvbl"' + (cfg.blind ? ' checked' : '') + '> 🙈 Blindfold</label><label class="chk small" title="Listen for your move after each reply"><input type="checkbox" id="cvhf"' + (cfg.hands ? ' checked' : '') + '> 🎧 Hands-free</label><label class="small">Confirm <select id="cvcf"><option value="smart"' + (cfg.confirm === 'smart' ? ' selected' : '') + '>unclear moves</option><option value="always"' + (cfg.confirm === 'always' ? ' selected' : '') + '>every move</option><option value="never"' + (cfg.confirm === 'never' ? ' selected' : '') + '>never</option></select></label><button class="ib" id="cvhelp" title="What can I say?">❔</button><button class="ib" id="cvmin" title="Minimise">▾</button></div><div class="small" id="cvst" aria-live="polite">' + esc(bus.status || 'Say a move like “knight f three”, or describe it. Press V to speak.') + '</div>' : '<button class="pri" id="cvopen" title="Voice moves: say or describe a move (press V)">🎙 Voice moves</button>';
    const $ = id => dock.querySelector('#' + id);
    if ($('cvopen')) $('cvopen').onclick = () => { cfg.open = 1; save(); drawDock(); };
    if ($('cvmin')) { $('cvmin').onclick = () => { cfg.open = 0; save(); drawDock(); }; $('cvmic').onclick = listen; $('cvgo').onclick = () => { const v = $('cvtype').value; $('cvtype').value = ''; interpret(v); }; $('cvtype').onkeydown = e => { e.stopPropagation(); if (e.key === 'Enter') $('cvgo').click(); };
      $('cvann').onchange = e => { cfg.ann = e.target.checked ? 1 : 0; save(); }; $('cvbl').onchange = e => setBlind(e.target.checked); $('cvhf').onchange = e => { cfg.hands = e.target.checked ? 1 : 0; save(); if (cfg.hands && b.voiceLegal().length) listen(); }; $('cvcf').onchange = e => { cfg.confirm = e.target.value; save(); }; $('cvhelp').onclick = () => interpret('help'); }
  }
  const css = document.createElement('style'); css.textContent = '#cvdock{position:relative;margin:10px 0 0;display:flex;flex-direction:column;gap:6px;align-items:center;padding:8px 10px;border-radius:14px;background:color-mix(in srgb,var(--panel) 92%,transparent);border:1px solid var(--line);width:100%;max-width:560px;box-sizing:border-box}#cvdock .cvbar{display:flex;gap:8px;align-items:center;flex-wrap:wrap;justify-content:center}#cvdock input[type=text]{width:260px;max-width:60vw}#cvdock #cvst{color:var(--mute);text-align:center;max-width:640px}#cvdock #cvmic.on{background:var(--bad);color:#fff;animation:p 1s infinite alternate}'; document.head.appendChild(css);
  document.addEventListener('keydown', e => { if (!cfg.on || e.ctrlKey || e.metaKey || e.altKey) return; const t = e.target, typing = t && (/INPUT|TEXTAREA|SELECT/.test(t.tagName) || t.isContentEditable); if (typing) return; if ((e.key === 'v' || e.key === 'V') && active()) { e.preventDefault(); listen(); } else if (e.key === 'Escape' && A.voice && A.voice.rec) A.voice.stop(true); });
  window.__cvBlind = !!cfg.blind; setInterval(() => { const b = active(), has = !!b; if (has !== !!(dock && dock.style.display !== 'none')) drawDock(); else if (has && (!dock || !dock.isConnected || dock.parentNode !== hostOf(b))) drawDock(); }, 800);
  window.ChessVoice = { pending: () => bus.awaiting, parse, rank, interpret, listen, moved, describe, get blind() { return !!cfg.blind; }, cfg, setEnabled(v) { cfg.on = v ? 1 : 0; save(); drawDock(); }, setBlind, active, norm, spokenSan, listPieces };
})();

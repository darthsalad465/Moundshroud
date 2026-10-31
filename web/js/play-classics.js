// Entertainment > Backgammon and Hearts: two classics against the computer, each with Easy / Normal / Hard, a coach that explains its suggestions,
// and (Backgammon) short interactive lessons. Rules are in the BG and HR objects (window.ClassicRules) so they can be tested without a screen.
(() => {
  const P = A.play; if (!P) return; const rnd = n => Math.random() * n | 0, esc = s => String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

  /* ============================== BACKGAMMON rules ============================== */
  // p[1..24] signed: White (you, side 0) positive and moving 24 -> 1, Black (computer, side 1) negative and moving 1 -> 24. bar[side], off[side].
  const BG = (() => {
    const start = () => { const p = Array(26).fill(0); p[24] = 2; p[13] = 5; p[8] = 3; p[6] = 5; p[1] = -2; p[12] = -5; p[17] = -3; p[19] = -5; return { p, bar: [0, 0], off: [0, 0] }; };
    const clone = s => ({ p: s.p.slice(), bar: s.bar.slice(), off: s.off.slice() });
    const sk = s => s.p.join(',') + '|' + s.bar + '|' + s.off;
    const sg = side => side === 0 ? 1 : -1;
    const homeOK = (s, side) => { if (s.bar[side]) return false; if (side === 0) { for (let i = 7; i <= 24; i++) if (s.p[i] > 0) return false; } else { for (let i = 1; i <= 18; i++) if (s.p[i] < 0) return false; } return true; };
    /* every legal single-die move for `side`; from 25 means the bar, off:true means bearing off */
    const moves = (s, side, d) => {
      const out = [], m = sg(side), dir = side === 0 ? -1 : 1;
      if (s.bar[side]) { const to = side === 0 ? 25 - d : d; if (s.p[to] * m >= -1) out.push({ from: 25, to, die: d, hit: s.p[to] * m === -1 }); return out; }
      const ho = homeOK(s, side);
      for (let f = 1; f <= 24; f++) {
        if (s.p[f] * m <= 0) continue; const to = f + dir * d;
        if (to < 1 || to > 24) {
          if (!ho) continue; let ok = side === 0 ? to === 0 : to === 25;
          if (!ok) { ok = true; if (side === 0) { for (let i = f + 1; i <= 6; i++) if (s.p[i] > 0) ok = false; } else { for (let i = f - 1; i >= 19; i--) if (s.p[i] < 0) ok = false; } }
          if (ok) out.push({ from: f, to: 0, die: d, off: true }); continue;
        }
        if (s.p[to] * m >= -1) out.push({ from: f, to, die: d, hit: s.p[to] * m === -1 });
      }
      return out;
    };
    const apply = (s, side, mv) => {
      const n = clone(s), m = sg(side); if (mv.from === 25) n.bar[side]--; else n.p[mv.from] -= m;
      if (mv.off) n.off[side]++; else { if (mv.hit) { n.p[mv.to] = 0; n.bar[1 - side]++; } n.p[mv.to] += m; } return n;
    };
    const diceOf = (a, b) => a === b ? [a, a, a, a] : [a, b];
    /* the longest run of dice that can be played from here (memoised); used for the "you must play as many dice as you can" rule */
    const maxPlay = (s, side, left, memo) => {
      memo = memo || new Map(); const key = sk(s) + '|' + left.slice().sort().join(''); if (memo.has(key)) return memo.get(key); let best = 0; const tried = new Set();
      for (let i = 0; i < left.length; i++) { const d = left[i]; if (tried.has(d)) continue; tried.add(d); const rest = left.slice(0, i).concat(left.slice(i + 1)); for (const mv of moves(s, side, d)) { best = Math.max(best, 1 + maxPlay(apply(s, side, mv), side, rest, memo)); if (best === left.length) break; } if (best === left.length) break; }
      memo.set(key, best); return best;
    };
    /* the moves a player may make next, honouring the must-use-max-dice and larger-die rules. `big` = the turn was started with two different dice and only one can be played */
    const legalNext = (s, side, left, start) => {
      const memo = new Map(), tot = maxPlay(s, side, left, memo), out = [], seen = new Set();
      for (let i = 0; i < left.length; i++) { const d = left[i]; if (seen.has(d)) continue; seen.add(d); const rest = left.slice(0, i).concat(left.slice(i + 1)); for (const mv of moves(s, side, d)) if (1 + maxPlay(apply(s, side, mv), side, rest, memo) === tot) out.push(mv); }
      if (start && left.length === 2 && left[0] !== left[1] && tot === 1) { const hi = Math.max(left[0], left[1]); const only = out.filter(m => m.die === hi); if (only.length) return only; }
      return out;
    };
    /* every distinct final position of a whole turn, for the computer */
    const finals = (s, side, dice) => {
      const out = new Map(), seen = new Set(); let best = -1;
      const rec = (st, left, path) => {
        const key = sk(st) + '|' + left.slice().sort().join(''); if (seen.has(key)) return; seen.add(key); let any = false; const tried = new Set();
        for (let i = 0; i < left.length; i++) { const d = left[i]; if (tried.has(d)) continue; tried.add(d); const rest = left.slice(0, i).concat(left.slice(i + 1)); for (const mv of moves(st, side, d)) { any = true; rec(apply(st, side, mv), rest, path.concat([mv])); } }
        if (!any) { if (path.length > best) { best = path.length; out.clear(); } if (path.length === best) out.set(sk(st), { st, path }); }
      };
      rec(s, dice, []); let list = [...out.values()];
      if (best === 1 && dice.length === 2 && dice[0] !== dice[1]) { const hi = Math.max(dice[0], dice[1]), only = list.filter(o => o.path[0].die === hi); if (only.length) list = only; }
      return list;
    };
    const pips = (s, side) => { let t = s.bar[side] * 25; for (let i = 1; i <= 24; i++) { const c = s.p[i] * sg(side); if (c > 0) t += c * (side === 0 ? i : 25 - i); } return t; };
    const contact = s => { let wMax = s.bar[0] ? 25 : 0, bMin = s.bar[1] ? 0 : 99; for (let i = 1; i <= 24; i++) { if (s.p[i] > 0) wMax = Math.max(wMax, i); if (s.p[i] < 0) bMin = Math.min(bMin, i); } return wMax > bMin; };
    /* how good a position is for `side` (higher is better) */
    const evalFor = (s, side) => {
      const m = sg(side), opp = 1 - side; let sc = (pips(s, opp) - pips(s, side)) * 1.0 + (s.off[side] - s.off[opp]) * 12;
      if (!contact(s)) return sc;
      const oppDir = side === 0 ? 1 : -1;     // opponent checkers move this way along the numbers
      for (let i = 1; i <= 24; i++) {
        const c = s.p[i] * m; if (c === 0) continue; const inHome = side === 0 ? i <= 6 : i >= 19;
        if (c === 1) { let shots = 0; for (let j = 1; j <= 24; j++) { const o = -s.p[j] * m; if (o > 0) { const dist = (i - j) * oppDir; if (dist >= 1 && dist <= 6) shots += o; } } if (s.bar[opp]) shots += s.bar[opp]; sc -= 5 + shots * (inHome ? 5 : 3.5) * (side === 0 ? 1 : 1); }
        else if (c >= 2) sc += 3 + (inHome ? 4 : 0) + (c > 3 ? -(c - 3) * 1.5 : 0);
        else if (c < 0 && c === -1) sc += 3;      // an opposing blot we could attack
      }
      let run = 0, bestRun = 0; for (let k = 0; k < 24; k++) { const i = side === 0 ? 1 + k : 24 - k; if (s.p[i] * m >= 2) { run++; bestRun = Math.max(bestRun, run); } else run = 0; } sc += bestRun * bestRun * 2.5;
      sc -= s.bar[side] * 22; sc += s.bar[opp] * 26; return sc;
    };
    const ROLLS = (() => { const r = []; for (let a = 1; a <= 6; a++) for (let b = a; b <= 6; b++) r.push({ d: diceOf(a, b), w: a === b ? 1 : 2 }); return r; })();
    /* level: 0 easy (sloppy), 1 normal (best position), 2 hard (also weighs the opponent's best reply to each of its top choices) */
    const choose = (s, side, dice, level) => {
      const list = finals(s, side, dice); if (!list.length) return null; list.forEach(o => { o.v = evalFor(o.st, side); });
      list.sort((a, b) => b.v - a.v);
      if (level === 0) { const k = Math.max(1, Math.ceil(list.length * .4)); return list.slice(0, k)[rnd(k)]; }
      if (level === 1 || list.length === 1) return list[0];
      const top = list.slice(0, 6); let best = null, bv = -1e9;
      for (const c of top) { let tot = 0, w = 0; for (const r of ROLLS) { const rep = finals(c.st, 1 - side, r.d); let b = -1e9; for (const o of rep) b = Math.max(b, evalFor(o.st, 1 - side)); if (b === -1e9) b = evalFor(c.st, 1 - side); tot += b * r.w; w += r.w; } const v = c.v * .55 - (tot / w) * .45; if (v > bv) { bv = v; best = c; } }
      return best;
    };
    const why = (s, side, path) => { const r = []; if (path.some(m => m.hit)) r.push('it hits a blot, sending a checker to the bar'); if (path.some(m => m.off)) r.push('it bears a checker off'); const t = apply0(s, side, path), m = sg(side); let made = 0; for (let i = 1; i <= 24; i++) if (t.p[i] * m >= 2 && s.p[i] * m < 2) made++; if (made) r.push('it makes ' + made + ' new point' + (made > 1 ? 's' : '') + ' that cannot be hit'); let blots = 0; for (let i = 1; i <= 24; i++) if (t.p[i] * m === 1) blots++; r.push(blots ? 'it leaves only ' + blots + ' lone checker' + (blots > 1 ? 's' : '') + ' exposed' : 'it leaves no lone checkers to be hit'); return r; };
    const apply0 = (s, side, path) => path.reduce((st, mv) => apply(st, side, mv), s);
    const winner = s => s.off[0] === 15 ? 0 : s.off[1] === 15 ? 1 : -1;
    /* 1 point, 2 for a gammon (loser took nothing off), 3 for a backgammon (and still has a checker on the bar or in the winner's home) */
    const worth = (s, w) => { const l = 1 - w; if (s.off[l] > 0) return 1; let back = s.bar[l] > 0; for (let i = 1; i <= 24; i++) { if (w === 0 && i >= 19 && s.p[i] < 0) back = true; if (w === 1 && i <= 6 && s.p[i] > 0) back = true; } return back ? 3 : 2; };
    return { start, clone, sk, moves, apply, maxPlay, legalNext, finals, pips, evalFor, choose, why, winner, worth, diceOf, apply0 };
  })();

  /* ============================== HEARTS rules ============================== */
  // card = { s: 0 spades, 1 hearts, 2 diamonds, 3 clubs ; r: 0 ace .. 12 king }. value 2..14 with the ace high. Players 0 (you) 1 (left) 2 (across) 3 (right), play goes 0,1,2,3.
  const HR = (() => {
    const val = c => c.r === 0 ? 14 : c.r + 1, isQS = c => c.s === 0 && c.r === 11, pts = c => c.s === 1 ? 1 : isQS(c) ? 13 : 0, same = (a, b) => a && b && a.s === b.s && a.r === b.r;
    const deal = () => { const d = []; for (let s = 0; s < 4; s++) for (let r = 0; r < 13; r++) d.push({ s, r }); for (let i = d.length - 1; i > 0; i--) { const j = rnd(i + 1);[d[i], d[j]] = [d[j], d[i]]; } const h = [0, 1, 2, 3].map(k => d.slice(k * 13, k * 13 + 13)); h.forEach(sortHand); return h; };
    const sortHand = h => h.sort((a, b) => [3, 2, 0, 1][a.s] - [3, 2, 0, 1][b.s] || val(a) - val(b));
    /* which cards may be played: follow suit, 2 of clubs leads, no points on the first trick unless forced, hearts only after they are broken */
    const legal = (hand, trick, broken, first) => {
      if (!trick.length) { if (first) return hand.filter(c => c.s === 3 && c.r === 1); const nh = hand.filter(c => c.s !== 1); return broken || !nh.length ? hand.slice() : nh; }
      const led = trick[0].c.s, fol = hand.filter(c => c.s === led); if (fol.length) return fol;
      if (first) { const safe = hand.filter(c => pts(c) === 0); if (safe.length) return safe; } return hand.slice();
    };
    const winnerOf = trick => { const led = trick[0].c.s; let w = trick[0]; for (const t of trick) if (t.c.s === led && val(t.c) > val(w.c)) w = t; return w.p; };
    const passTarget = round => ['left', 'right', 'across', 'hold'][round % 4];
    const passDest = (p, round) => { const t = passTarget(round); return t === 'left' ? (p + 1) % 4 : t === 'right' ? (p + 3) % 4 : t === 'across' ? (p + 2) % 4 : p; };
    /* which three cards to give away: the dangerous ones */
    const pickPass = (hand, level) => {
      if (level === 0) return hand.slice().sort((a, b) => val(b) - val(a)).slice(0, 3);
      const cnt = [0, 0, 0, 0]; hand.forEach(c => cnt[c.s]++); const hasQS = hand.some(isQS);
      const score = c => { let s = val(c); if (isQS(c)) s += cnt[0] < 4 ? 120 : 20; else if (c.s === 0 && val(c) > 12) s += hasQS ? 5 : cnt[0] < 5 ? 70 : 10; else if (c.s === 1 && val(c) >= 11) s += 45 + val(c); else if (c.s === 1) s += val(c) > 8 ? 12 : 0; if ((c.s === 2 || c.s === 3) && cnt[c.s] <= 2) s += 18; if (c.s === 3 && c.r === 1) s -= 30; return s; };
      return hand.slice().sort((a, b) => score(b) - score(a)).slice(0, 3);
    };
    /* the card to play. mem = { played: Set of "s,r", void: [[bool x4] x4], broken } */
    const choosePlay = (hand, trick, broken, first, mem, level, me) => {
      const lg = legal(hand, trick, broken, first); if (lg.length === 1) return { c: lg[0], why: 'It is your only legal card.' };
      if (level === 0) return { c: lg[rnd(lg.length)], why: 'A reasonable card.' };
      const qsOut = !(mem && mem.played.has('0,11')) && !hand.some(isQS);
      if (trick.length) {
        const led = trick[0].c.s; let win = trick[0]; for (const t of trick) if (t.c.s === led && val(t.c) > val(win.c)) win = t; const trickPts = trick.reduce((a, t) => a + pts(t.c), 0), last = trick.length === 3;
        const fol = lg.filter(c => c.s === led);
        if (fol.length) {
          const under = fol.filter(c => val(c) < val(win.c)).sort((a, b) => val(b) - val(a));
          if (under.length) return { c: under[0], why: 'It stays under the current winner (' + RKN(win.c) + ') so you do not take the trick.' };
          const hi = fol.slice().sort((a, b) => val(b) - val(a)), lo = fol.slice().sort((a, b) => val(a) - val(b));
          if (last && !trickPts) { const safe = hi.find(c => !(c.s === 0 && isQS(c))) || hi[0]; return { c: safe, why: 'Nobody can beat you and there are no points in the trick, so take it with your highest card.' }; }
          if (led === 0 && qsOut) return { c: lo[0], why: 'Spades are risky while the queen is still out: play low.' };
          return { c: lo[0], why: 'You cannot get under it, so lose as little as possible with your lowest card.' };
        }
        // void in the led suit: dump the worst cards
        const q = lg.find(isQS); if (q) return { c: q, why: 'You cannot follow suit, so give away the Queen of Spades (13 points) to someone else.' };
        const hh = lg.filter(c => c.s === 1).sort((a, b) => val(b) - val(a)); if (hh.length) return { c: hh[0], why: 'You cannot follow suit: pass on your highest heart (a point each).' };
        const rest = lg.slice().sort((a, b) => val(b) - val(a)); const risky = rest.find(c => c.s === 0 && val(c) > 12 && qsOut); return { c: risky || rest[0], why: 'You cannot follow suit: get rid of your highest card.' };
      }
      // leading
      let best = null, bs = -1e9;
      for (const c of lg) {
        let s = -val(c); if (c.s === 1) s -= 14; if (c.s === 0) { if (isQS(c)) s -= 80; else if (val(c) > 12 && qsOut) s -= 40; else if (qsOut && val(c) < 12) s += 10; }
        const suitN = hand.filter(x => x.s === c.s).length; s += suitN > 3 ? 2 : 0;
        if (level === 2 && mem) { let voids = 0; for (let k = 0; k < 4; k++) if (k !== me && mem.void[k][c.s]) voids++; s -= voids * (val(c) > 9 ? 9 : 2); const seen = [...mem.played].filter(x => +x.split(',')[0] === c.s).length; if (val(c) <= 6 && seen > 6) s -= 6; }
        if (s > bs) { bs = s; best = c; }
      }
      return { c: best, why: 'A low card in a safe suit keeps you from taking points.' };
    };
    const RKN = c => ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'][c.r] + ['♠', '♥', '♦', '♣'][c.s];
    return { deal, sortHand, legal, winnerOf, passDest, passTarget, pickPass, choosePlay, val, pts, isQS, same, RKN };
  })();
  window.ClassicRules = { BG, HR };

  /* ============================== BACKGAMMON screen ============================== */
  const LESSONS = [
    { t: 'Moving', say: 'White (you) moves from point 24 round to point 1 and then home. Roll, then click a checker, then where it should go. Play both dice: this time a 3 and a 1.', dice: [3, 1], st: null, goal: 'play both dice' },
    { t: 'Hitting', say: 'A lone checker (a "blot") can be hit. Black has one blot on point 9, and you have a 4 and a 2. Hit it: click your checker on 13, then point 9. It goes to the bar and must start again.', dice: [4, 2], st: () => { const s = BG.start(); s.p[12] = -3; s.p[9] = -1; s.p[1] = -2; s.p[17] = -3; s.p[19] = -5; s.p[13] = 5; return s; }, goal: s => s.bar[1] > 0 },
    { t: 'Entering from the bar', say: 'You have been hit! Before anything else you must enter from the bar. Dice 3 and 5: enter on point 22 (24 - 3 + 1) or 20; points with 2 or more Black checkers are blocked.', dice: [3, 5], st: () => { const s = BG.start(); s.p[24] = 1; s.bar[0] = 1; s.p[22] = -2; return s; }, goal: s => s.bar[0] === 0 },
    { t: 'Bearing off', say: 'When all 15 of your checkers are in your home board (points 1 to 6) you may bear them off. A die takes off a checker from that point number. You have a 6 and a 2: take two checkers off.', dice: [6, 2], st: () => { const s = { p: Array(26).fill(0), bar: [0, 0], off: [5, 0] }; s.p[6] = 2; s.p[5] = 2; s.p[4] = 2; s.p[3] = 2; s.p[2] = 1; s.p[1] = 1; s.p[19] = -3; s.p[20] = -4; s.p[24] = -8; s.off[1] = 0; return s; }, goal: s => s.off[0] >= 7 }
  ];
  P.games.backgammon = {
    name: 'Backgammon', icon: '🎲',
    desc: 'The ancient race game. Roll two dice, move your checkers home, hit lone enemy checkers and bear off before the computer does. A coach explains its tips, and there are short interactive lessons.',
    mount(el, api) {
      const LV = api.level, W = 760, H = 470, M = 16, PW = 52, BARW = 44, TRAY = 70, TOP = 14, MID = 40, PH = 190;
      let S, turn = 0, dice = [], left = [], hist = [], phase = 'roll', sel = null, cands = [], dead = false, msg = '', last = [], hint = null, lesson = -1, lessonDone = false, cv, cx, startTurn = null, pts = +ls.get('bg_pts', '0'), busy = false;
      const px = col => M + col * PW + (col >= 6 ? BARW : 0), colOf = i => i >= 13 ? i - 13 : 12 - i;
      const hit = (x, y) => {                       // which spot of the board is at x,y: point 1-24, 25 = bar, 0 = your off tray
        if (x > M + 12 * PW + BARW) return y > H / 2 ? 0 : -1;
        if (x >= M + 6 * PW && x <= M + 6 * PW + BARW) return 25;
        let col = Math.floor((x - M - (x > M + 6 * PW + BARW ? BARW : 0)) / PW); if (col < 0 || col > 11) return null; return y < H / 2 ? 13 + col : 12 - col;
      };
      const cnt = (s, i) => Math.abs(s.p[i]);
      const draw = () => {
        if (dead) return; cx.clearRect(0, 0, W, H); cx.fillStyle = '#5b3a1e'; cx.fillRect(0, 0, W, H); cx.fillStyle = '#2c7a4b'; cx.fillRect(M - 4, TOP - 4, 12 * PW + BARW + 8, H - 2 * TOP + 8); cx.fillStyle = '#3a2412'; cx.fillRect(M + 6 * PW, TOP - 4, BARW, H - 2 * TOP + 8);
        cx.fillStyle = '#4b2e17'; cx.fillRect(M + 12 * PW + BARW + 8, TOP - 4, TRAY - 8, H - 2 * TOP + 8);
        const targets = new Set(cands.filter(m => sel !== null && m.from === sel).map(m => m.off ? 0 : m.to)), srcs = new Set(cands.map(m => m.from));
        for (let i = 1; i <= 24; i++) {
          const col = colOf(i), x = px(col), top = i >= 13, y0 = top ? TOP : H - TOP; cx.beginPath(); cx.moveTo(x + 2, y0); cx.lineTo(x + PW - 2, y0); cx.lineTo(x + PW / 2, top ? y0 + PH : y0 - PH); cx.closePath(); cx.fillStyle = col % 2 ? '#d9b26b' : '#8c2f2a'; cx.fill();
          if (targets.has(i)) { cx.fillStyle = 'rgba(120,255,140,.4)'; cx.fill(); } if (last.includes(i)) { cx.strokeStyle = '#ffe36b'; cx.lineWidth = 3; cx.stroke(); }
          if (sel === i) { cx.strokeStyle = '#fff'; cx.lineWidth = 3; cx.stroke(); } else if (phase === 'move' && srcs.has(i) && sel === null) { cx.strokeStyle = 'rgba(255,255,255,.6)'; cx.lineWidth = 2; cx.stroke(); }
          cx.fillStyle = 'rgba(255,255,255,.55)'; cx.font = '10px Segoe UI'; cx.textAlign = 'center'; cx.fillText(i, x + PW / 2, top ? y0 - 2 + 0 : y0 + 11);
          const n = cnt(S, i), c = S.p[i] > 0 ? 0 : 1; for (let k = 0; k < Math.min(n, 6); k++) disc(x + PW / 2, top ? y0 + 12 + 21 * (k + .5) + 0 : y0 - 12 - 21 * (k + .5), c, hint && hint.path && hint.path[0].from === i && k === Math.min(n, 6) - 1);
          if (n > 6) { cx.fillStyle = '#fff'; cx.font = 'bold 12px Segoe UI'; cx.fillText('×' + n, x + PW / 2, top ? y0 + 12 + 21 * 6.4 : y0 - 12 - 21 * 6.4); }
        }
        // bar
        const bx = M + 6 * PW + BARW / 2; if (sel === 25) { cx.strokeStyle = '#fff'; cx.lineWidth = 3; cx.strokeRect(M + 6 * PW + 2, H / 2 - 50, BARW - 4, 100); }
        for (let k = 0; k < S.bar[0]; k++) disc(bx, H / 2 + 28 + k * 22, 0); for (let k = 0; k < S.bar[1]; k++) disc(bx, H / 2 - 28 - k * 22, 1);
        // trays
        const tx = M + 12 * PW + BARW + 38; for (let k = 0; k < S.off[0]; k++) { cx.fillStyle = '#f2efe6'; cx.fillRect(tx - 24, H - TOP - 8 - k * 9, 48, 7); } for (let k = 0; k < S.off[1]; k++) { cx.fillStyle = '#22201e'; cx.fillRect(tx - 24, TOP + 1 + k * 9, 48, 7); }
        if (targets.has(0)) { cx.fillStyle = 'rgba(120,255,140,.4)'; cx.fillRect(M + 12 * PW + BARW + 8, H / 2, TRAY - 8, H / 2 - TOP + 4); }
        // dice
        const dx = M + 8.2 * PW + BARW, dy = H / 2 - 19 - (dice.length > 2 ? 23 : 0); dice.forEach((d, i) => die(dx + (i % 2) * 46, dy + (i > 1 ? 46 : 0), d, usedIdx(i)));
      };
      const disc = (x, y, c, glow) => { cx.beginPath(); cx.arc(x, y, 10, 0, 7); cx.fillStyle = c === 0 ? '#f2efe6' : '#26231f'; cx.fill(); cx.strokeStyle = glow ? '#ffe36b' : c === 0 ? '#9a948a' : '#6a6258'; cx.lineWidth = glow ? 3 : 1.5; cx.stroke(); cx.beginPath(); cx.arc(x, y, 6, 0, 7); cx.strokeStyle = c === 0 ? '#cfc9bb' : '#47423b'; cx.lineWidth = 1; cx.stroke(); };
      const die = (x, y, n, dim) => { cx.fillStyle = dim ? 'rgba(240,240,240,.35)' : '#f7f7f2'; cx.strokeStyle = '#333'; cx.lineWidth = 1.5; cx.beginPath(); cx.roundRect(x, y, 38, 38, 7); cx.fill(); cx.stroke(); cx.fillStyle = '#222'; const sp = { 1: [[1, 1]], 2: [[0, 0], [2, 2]], 3: [[0, 0], [1, 1], [2, 2]], 4: [[0, 0], [2, 0], [0, 2], [2, 2]], 5: [[0, 0], [2, 0], [1, 1], [0, 2], [2, 2]], 6: [[0, 0], [2, 0], [0, 1], [2, 1], [0, 2], [2, 2]] }[n]; sp.forEach(([a, b]) => { cx.beginPath(); cx.arc(x + 9 + a * 10, y + 9 + b * 10, 3.2, 0, 7); cx.fill(); }); };
      const render = () => {
        draw(); if (dead) return; const sc = BG.pips(S, 0), sb = BG.pips(S, 1); el.querySelector('#bgs').innerHTML = (msg ? '<b>' + msg + '</b><br>' : '') + '<span class="small mute">Pips (distance to bear off): you <b>' + sc + '</b> · computer <b>' + sb + '</b> · Your record: ' + ls.get('bg_w', '0') + ' won, ' + ls.get('bg_l', '0') + ' lost · points ' + pts + '</span>';
        api.hud('You ' + S.off[0] + ' off · Computer ' + S.off[1] + ' off'); const b = id => el.querySelector(id);
        b('#bgroll').disabled = !(phase === 'roll') || busy; b('#bgundo').disabled = !(phase === 'move' && hist.length) || busy; b('#bghint').disabled = !(phase === 'move') || busy;
        const ds = el.querySelector('#bgdice'); ds.innerHTML = dice.length ? 'Dice: ' + dice.map((d, i) => '<span style="display:inline-block;min-width:26px;text-align:center;padding:2px 6px;margin:0 2px;border-radius:6px;background:#f7f7f2;color:#111;font-weight:700;' + (usedIdx(i) ? 'opacity:.3;text-decoration:line-through' : '') + '">' + d + '</span>').join('') : '';
      };
      const usedIdx = i => { const rem = left.slice(), flags = []; dice.forEach(d => { const k = rem.indexOf(d); if (k >= 0) { rem.splice(k, 1); flags.push(false); } else flags.push(true); }); return flags[i]; };
      const refresh = () => { cands = phase === 'move' ? BG.legalNext(S, 0, left, !hist.length) : []; if (phase === 'move' && !cands.length) { endPlayerTurn(); return; } render(); };
      const start = () => { S = BG.start(); turn = 0; dice = []; left = []; hist = []; phase = 'roll'; sel = null; cands = []; msg = 'Your turn: press Roll (or Space).'; last = []; hint = null; busy = false; render(); };
      const roll = () => { if (phase !== 'roll' || busy) return; const a = 1 + rnd(6), b = 1 + rnd(6); dice = BG.diceOf(a, b); if (a === b) dice = [a, a, a, a]; left = dice.slice(); hist = []; sel = null; hint = null; last = []; phase = 'move'; startTurn = BG.clone(S); const any = BG.legalNext(S, 0, left, true); msg = any.length ? 'You rolled ' + a + ' and ' + b + (a === b ? ' (doubles: play four moves)' : '') + '. Click a checker, then where it goes.' : 'You rolled ' + a + ' and ' + b + ' but have no legal move.'; refresh(); };
      const endPlayerTurn = () => { if (lesson >= 0) return lessonCheck(); const w = BG.winner(S); if (w >= 0) return finish(w); busy = true; phase = 'ai'; render(); setTimeout(aiTurn, 700); };
      const click = e => {
        if (phase !== 'move' || busy) return; const r = cv.getBoundingClientRect(), sc = W / r.width, x = (e.clientX - r.left) * sc, y = (e.clientY - r.top) * sc; const h = hit(x, y); if (h === null || h === -1) { sel = null; render(); return; }
        if (sel !== null && (cands.some(m => m.from === sel && (m.off ? 0 : m.to) === h))) { const mv = cands.find(m => m.from === sel && (m.off ? 0 : m.to) === h); play(mv); return; }
        if (cands.some(m => m.from === h)) { sel = h; const mine = cands.filter(m => m.from === h); if (mine.length === 1) { play(mine[0]); return; } render(); return; } sel = null; render();
      };
      const play = mv => { hist.push({ s: BG.clone(S), left: left.slice() }); const i = left.indexOf(mv.die); left.splice(i, 1); S = BG.apply(S, 0, mv); last = [mv.off ? 0 : mv.to]; sel = null; hint = null; if (BG.winner(S) === 0) { return finish(0); } if (!left.length) { render(); endPlayerTurn(); return; } msg = ''; refresh(); };
      const undo = () => { if (!hist.length || phase !== 'move') return; const h = hist.pop(); S = h.s; left = h.left; sel = null; last = []; hint = null; refresh(); };
      const aiTurn = () => {
        if (dead) return; const a = 1 + rnd(6), b = 1 + rnd(6), d = BG.diceOf(a, b); dice = d; left = d.slice(); const pick = BG.choose(S, 1, d, LV); last = []; render();
        if (!pick || !pick.path.length) { msg = 'Computer rolled ' + a + ' and ' + b + ' and has no legal move.'; busy = false; phase = 'roll'; dice = []; render(); return; }
        let i = 0; const step = () => { if (dead) return; if (i >= pick.path.length) { msg = 'Computer rolled ' + a + ' and ' + b + '. Your turn: press Roll.'; busy = false; phase = 'roll'; dice = dice; render(); const w = BG.winner(S); if (w >= 0) finish(w); return; } const mv = pick.path[i++]; S = BG.apply(S, 1, mv); last = [mv.off ? 0 : mv.to, mv.from === 25 ? 25 : mv.from]; left.splice(left.indexOf(mv.die), 1); render(); setTimeout(step, 450); }; setTimeout(step, 350);
      };
      const finish = w => { phase = 'over'; busy = false; const v = BG.worth(S, w); if (w === 0) { pts += v; ls.set('bg_w', String(+ls.get('bg_w', '0') + 1)); ls.set('bg_pts', String(pts)); api.submit(pts); msg = 'You win' + (v > 1 ? ' a ' + (v === 2 ? 'gammon' : 'backgammon') : '') + '! +' + v + ' point' + (v > 1 ? 's' : '') + '.'; } else { ls.set('bg_l', String(+ls.get('bg_l', '0') + 1)); msg = 'The computer wins' + (v > 1 ? ' a ' + (v === 2 ? 'gammon' : 'backgammon') : '') + '. Press New game for a rematch.'; } render(); };
      const doHint = () => { if (phase !== 'move') return; const pick = BG.choose(S, 0, left.length === dice.length ? dice : left, Math.max(1, LV)); if (!pick || !pick.path.length) return; hint = pick; const m = pick.path[0], reasons = BG.why(S, 0, pick.path); sel = null; msg = 'Coach: start with ' + (m.from === 25 ? 'the bar' : 'point ' + m.from) + ' to ' + (m.off ? 'off' : 'point ' + m.to) + ' (a ' + m.die + '). Because ' + reasons.join(', and ') + '.'; render(); };
      /* lessons: set up a position, let the player play the roll, check the goal */
      const startLesson = n => { lesson = n; lessonDone = false; const L = LESSONS[n]; S = L.st ? L.st() : BG.start(); dice = []; left = []; hist = []; phase = 'roll'; sel = null; last = []; hint = null; busy = false; msg = '<b>Lesson ' + (n + 1) + ' of ' + LESSONS.length + ': ' + L.t + '.</b> ' + L.say; el.querySelector('#bgnote').style.display = ''; render(); setTimeout(() => { if (lesson === n && phase === 'roll') { dice = L.dice.slice(); if (dice[0] === dice[1]) dice = [dice[0], dice[0], dice[0], dice[0]]; left = dice.slice(); phase = 'move'; hist = []; refresh(); } }, 300); };
      const lessonCheck = () => { const L = LESSONS[lesson], ok = L.goal === 'play both dice' ? true : L.goal(S); phase = 'roll'; msg = ok ? '<b>Well done!</b> ' + (lesson + 1 < LESSONS.length ? 'Press "Next lesson".' : 'That is every lesson. Press New game to play for real.') : 'Not quite: ' + L.say.split('.').slice(-2).join('.').trim() + ' Use Undo and try again.'; if (!ok) { phase = 'move'; refresh(); msg = 'Not quite. Press Undo and try again. Hint: ' + L.say; render(); return; } lessonDone = true; el.querySelector('#bgnext').style.display = lesson + 1 < LESSONS.length ? '' : 'none'; render(); };
      el.innerHTML = '<div style="max-width:' + W + 'px;width:100%"><div class="row" style="gap:6px;margin-bottom:8px;flex-wrap:wrap"><button class="pri" id="bgroll">Roll dice</button><button class="ib" id="bgundo">Undo move</button><button class="ib" id="bghint" title="The coach suggests a move and says why">💡 Coach</button><button class="ib" id="bgnew">New game</button><button class="ib" id="bglearn">🎓 Lessons</button><button class="ib" id="bgnext" style="display:none">Next lesson ›</button><span id="bgdice" style="margin-left:6px"></span></div><div id="bgs" class="small" style="min-height:40px;margin-bottom:6px;line-height:1.5"></div><canvas id="bgcv" width="' + W + '" height="' + H + '" style="max-width:100%;height:auto;border-radius:12px;border:2px solid #3a2412;cursor:pointer"></canvas><div id="bgnote" class="small mute" style="display:none;margin-top:6px">Lesson mode: the board is a practice position. Press New game to play a real game.</div><div class="small mute" style="margin-top:6px">You are white and move from 24 down to 1, then off the board. Rules: land on empty points, your own, or a lone enemy checker (a hit). You must use both dice if you can. A checker on the bar must enter first. Gammon scores 2, backgammon 3. (No doubling cube.)</div></div>';
      cv = el.querySelector('#bgcv'); cx = cv.getContext('2d'); cv.onclick = click; el.querySelector('#bgroll').onclick = roll; el.querySelector('#bgundo').onclick = undo; el.querySelector('#bghint').onclick = doHint;
      el.querySelector('#bgnew').onclick = () => { lesson = -1; el.querySelector('#bgnote').style.display = 'none'; el.querySelector('#bgnext').style.display = 'none'; start(); }; el.querySelector('#bglearn').onclick = () => startLesson(0); el.querySelector('#bgnext').onclick = () => { el.querySelector('#bgnext').style.display = 'none'; startLesson(lesson + 1); };
      const key = e => { if (e.key === ' ' && A.cur === 'play' && !/INPUT|SELECT|TEXTAREA/.test((e.target || {}).tagName || '')) { e.preventDefault(); roll(); } }; document.addEventListener('keydown', key);
      start(); return () => { dead = true; document.removeEventListener('keydown', key); };
    }
  };

  /* ============================== HEARTS screen ============================== */
  P.games.hearts = {
    name: 'Hearts', icon: '♥️',
    desc: 'Four players, 13 tricks, and you want the fewest points: every heart is 1 and the Queen of Spades is 13. Pass three cards, follow suit, avoid taking tricks with points. First to 100 ends the game; lowest score wins. A coach explains its tips.',
    mount(el, api) {
      const LV = api.level, CU = window.CardUI, SU = HR_SU(), names = ['You', 'West', 'North', 'East'];
      let hands, scores = [0, 0, 0, 0], round = 0, phase = 'pass', trick = [], leader = 0, turn = 0, taken = [[], [], [], []], broken = false, first = true, sel = [], dead = false, msg = '', mem, busy = false, hint = null, tricksDone = 0, over = false;
      let tm = 0; const sched = (f, ms) => { clearTimeout(tm); tm = setTimeout(f, ms); };      // only one thing is ever waiting to happen, so a click during a pause cannot start a second chain of plays
      const newMem = () => ({ played: new Set(), void: [0, 1, 2, 3].map(() => [false, false, false, false]) });
      const deal = () => { hands = HR.deal(); trick = []; taken = [[], [], [], []]; broken = false; first = true; sel = []; tricksDone = 0; hint = null; mem = newMem(); busy = false; if (HR.passTarget(round) === 'hold') { phase = 'play'; startPlay(); } else { phase = 'pass'; msg = 'Choose 3 cards to pass ' + HR.passTarget(round) + ', then press Pass.'; } render(); };
      const startPlay = () => { const k = hands.findIndex(h => h.some(c => c.s === 3 && c.r === 1)); leader = turn = k; msg = (k === 0 ? 'You hold the 2 of clubs and lead.' : names[k] + ' leads with the 2 of clubs.'); sched(next, 600); };
      const cardEl = (c, o) => CU.card(c, o);
      const render = () => {
        if (dead) return; const lg = phase === 'play' && turn === 0 && !busy ? HR.legal(hands[0], trick, broken, first) : [];
        const pos = k => trick.find(t => t.p === k), slot = k => { const t = pos(k); return t ? cardEl(t.c) : '<div class="cd em" style="opacity:.25"></div>'; };
        const opp = k => '<div style="text-align:center"><div class="small" style="font-weight:700">' + names[k] + ' <span class="mute">(' + scores[k] + ')</span></div><div style="display:flex;justify-content:center">' + hands[k].map((c, i) => '<div class="cd b" style="width:calc(var(--cs,1.3)*34px);height:calc(var(--cs,1.3)*48px);margin-left:' + (i ? 'calc(var(--cs,1.3)*-22px)' : '0') + '"></div>').join('') + '</div></div>';
        const mine = hands[0].map((c, i) => { const ok = phase === 'pass' ? true : lg.some(x => HR.same(x, c)), isSel = sel.includes(i), isHint = hint && HR.same(hint.c, c); return '<div data-hc="' + i + '" style="cursor:' + (ok ? 'pointer' : 'default') + ';opacity:' + (ok ? 1 : .45) + ';margin-left:' + (i ? 'calc(var(--cs,1.3)*-30px)' : '0') + ';' + (isHint ? 'filter:drop-shadow(0 0 8px #ffe36b);transform:translateY(-10px)' : '') + '">' + cardEl(c, { sel: isSel }) + '</div>'; }).join('');
        el.querySelector('#hrtable').innerHTML = '<div style="display:grid;grid-template-columns:1fr auto 1fr;grid-template-rows:auto auto auto;gap:10px;align-items:center;justify-items:center">' +
          '<div></div>' + opp(2) + '<div></div>' + '<div style="justify-self:end">' + opp(1) + '</div>' + '<div style="display:grid;grid-template-columns:auto auto auto;gap:6px;align-items:center;justify-items:center;min-width:240px"><div></div><div>' + slot(2) + '</div><div></div><div>' + slot(1) + '</div><div class="small mute" style="text-align:center">' + (broken ? '♥ broken' : '♥ not yet') + '<br>Round ' + (round + 1) + '</div><div>' + slot(3) + '</div><div></div><div>' + slot(0) + '</div><div></div></div>' + '<div style="justify-self:start">' + opp(3) + '</div>' + '</div>' +
          '<div style="text-align:center;margin-top:8px"><div class="small" style="font-weight:700">You <span class="mute">(' + scores[0] + ')</span></div><div style="display:flex;justify-content:center;padding:8px 0 4px">' + mine + '</div></div>';
        el.querySelector('#hrmsg').innerHTML = msg; el.querySelector('#hrpass').style.display = phase === 'pass' ? '' : 'none'; el.querySelector('#hrpass').disabled = sel.length !== 3; el.querySelector('#hrhint').disabled = !(phase === 'play' && turn === 0 && !busy) && phase !== 'pass';
        el.querySelector('#hrscore').innerHTML = scores.map((s, k) => names[k] + ' <b>' + s + '</b>').join(' · '); api.hud('You ' + scores[0] + ' · W ' + scores[1] + ' · N ' + scores[2] + ' · E ' + scores[3]);
      };
      const doPass = () => {
        if (phase !== 'pass' || sel.length !== 3) return; const out = [0, 1, 2, 3].map(k => k === 0 ? sel.map(i => hands[0][i]) : HR.pickPass(hands[k], LV));
        const nh = hands.map((h, k) => h.filter(c => !out[k].some(o => HR.same(o, c)))); for (let k = 0; k < 4; k++) { const from = [0, 1, 2, 3].find(q => HR.passDest(q, round) === k); nh[k] = nh[k].concat(out[from]); } hands = nh; hands.forEach(HR.sortHand);
        const got = hands[0].filter(c => out[[0, 1, 2, 3].find(q => HR.passDest(q, round) === 0)].some(o => HR.same(o, c))); msg = 'You received ' + got.map(HR.RKN).join(' ') + '.'; sel = []; phase = 'play'; hint = null; startPlay(); render();
      };
      const next = () => {
        if (dead || phase !== 'play') return; if (trick.length === 4) return finishTrick();
        if (turn === 0) { busy = false; render(); return; } busy = true; render(); const who = turn; sched(() => { if (dead || phase !== 'play' || turn !== who || trick.length >= 4) return; const r = HR.choosePlay(hands[who], trick, broken, first, mem, LV, who); playCard(who, r.c); }, 650);
      };
      const playCard = (p, c) => {
        const h = hands[p]; h.splice(h.findIndex(x => HR.same(x, c)), 1); if (trick.length && c.s !== trick[0].c.s) mem.void[p][trick[0].c.s] = true; trick.push({ p, c }); mem.played.add(c.s + ',' + c.r); if (c.s === 1) broken = true; if (HR.isQS(c)) broken = true; hint = null; msg = '';
        turn = (p + 1) % 4; render(); if (trick.length === 4) sched(finishTrick, 1000); else next();
      };
      const finishTrick = () => {
        if (dead) return; const w = HR.winnerOf(trick); taken[w].push(...trick.map(t => t.c)); const pt = trick.reduce((a, t) => a + HR.pts(t.c), 0); trick = []; first = false; tricksDone++; leader = turn = w; msg = names[w] + (w === 0 ? ' take' : ' takes') + ' the trick' + (pt ? ' and ' + pt + ' point' + (pt > 1 ? 's' : '') : '') + '.';
        if (tricksDone === 13) return endRound(); render(); sched(next, 500);
      };
      const endRound = () => {
        const per = taken.map(t => t.reduce((a, c) => a + HR.pts(c), 0)); const moon = per.findIndex(x => x === 26); let add = per;
        if (moon >= 0) { add = per.map((x, k) => k === moon ? 0 : 26); msg = (moon === 0 ? 'You shot the moon!' : names[moon] + ' shot the moon!') + ' Everyone else gets 26.'; } else msg = 'Round over: ' + per.map((x, k) => names[k] + ' ' + x).join(', ') + '.';
        scores = scores.map((s, k) => s + add[k]); round++; phase = 'between'; busy = false; render();
        if (scores.some(s => s >= 100)) { over = true; const low = Math.min(...scores), win = scores.indexOf(low); msg += ' <b>Game over: ' + (win === 0 ? 'you win with ' + scores[0] + '!' : names[win] + ' wins with ' + low + '. You scored ' + scores[0] + '.') + '</b>'; if (win === 0) ls.set('hr_w', String(+ls.get('hr_w', '0') + 1)); api.submit(scores[0], true); el.querySelector('#hrnext').textContent = 'New game'; } else el.querySelector('#hrnext').textContent = 'Next round';
        el.querySelector('#hrnext').style.display = ''; el.querySelector('#hrmsg').innerHTML = msg;
      };
      const click = e => {
        const c = e.target.closest('[data-hc]'); if (!c || busy) return; const i = +c.dataset.hc;
        if (phase === 'pass') { const k = sel.indexOf(i); if (k >= 0) sel.splice(k, 1); else if (sel.length < 3) sel.push(i); hint = null; render(); return; }
        if (phase !== 'play' || turn !== 0 || trick.length === 4) return; const card = hands[0][i]; if (!HR.legal(hands[0], trick, broken, first).some(x => HR.same(x, card))) { msg = first && !trick.length ? 'The 2 of clubs must lead the first trick.' : trick.length ? 'You must follow suit (' + SU[trick[0].c.s] + ') if you can.' : 'Hearts cannot be led until a heart or the Queen of Spades has been played.'; render(); return; } playCard(0, card);
      };
      const hintBtn = () => {
        if (phase === 'pass') { const p = HR.pickPass(hands[0], Math.max(1, LV)); sel = p.map(c => hands[0].findIndex(x => HR.same(x, c))); msg = 'Coach: pass ' + p.map(HR.RKN).join(', ') + '. High spades (Q♠, K♠, A♠) and high hearts are the cards most likely to cost you points, and emptying a short suit lets you discard dangerous cards later.'; render(); return; }
        if (phase !== 'play' || turn !== 0) return; const r = HR.choosePlay(hands[0], trick, broken, first, mem, Math.max(1, LV), 0); hint = r; msg = 'Coach: play the ' + HR.RKN(r.c) + '. ' + r.why; render();
      };
      el.innerHTML = '<div style="max-width:860px;width:100%"><div class="row" style="gap:6px;margin-bottom:8px;flex-wrap:wrap;align-items:center">' + CU.sizeSel() + '<button class="pri" id="hrpass" style="display:none">Pass 3 cards</button><button class="ib" id="hrhint">💡 Coach</button><button class="pri" id="hrnext" style="display:none">Next round</button><button class="ib" id="hrnew">New game</button><span class="small mute" id="hrscore" style="margin-left:6px"></span></div><div id="hrmsg" class="small" style="min-height:34px;margin-bottom:8px;line-height:1.5"></div><div id="hrtable" style="background:radial-gradient(ellipse at center,#1f6b3f,#12432a);border-radius:18px;padding:14px;border:2px solid #0d2d1c"></div><div class="small mute" style="margin-top:6px">Hearts are 1 point each and the Queen of Spades is 13. Pass 3 cards (left, right, across, then keep). The 2♣ leads. Follow suit if you can. Take all 26 points and you "shoot the moon": everyone else gets 26. Lowest score when someone passes 100 wins.</div></div>';
      CU.bindSize(el, () => render()); el.querySelector('#hrtable').onclick = click; el.querySelector('#hrpass').onclick = doPass; el.querySelector('#hrhint').onclick = hintBtn;
      el.querySelector('#hrnext').onclick = () => { el.querySelector('#hrnext').style.display = 'none'; if (over) { scores = [0, 0, 0, 0]; round = 0; over = false; } deal(); }; el.querySelector('#hrnew').onclick = () => { scores = [0, 0, 0, 0]; round = 0; over = false; el.querySelector('#hrnext').style.display = 'none'; deal(); };
      deal(); return () => { dead = true; clearTimeout(tm); };
    }
  };
  function HR_SU() { return ['♠', '♥', '♦', '♣']; }
})();

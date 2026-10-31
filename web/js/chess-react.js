// Game-aware reactions for chess opponents: reads the real position after every move (what was captured, forks, hanging pieces, trades,
// castling, promotion, blunders and great moves from the engine's score, who is winning) and turns it into facts the opponent can react to.
// ChessBots uses the facts to prompt the AI model; the templates here are the offline fallback. Pure logic, no UI.
(() => {
  const C = window.Chess; if (!C) return;
  const V = [0, 1, 3, 3, 5, 9, 0], NAME = ['', 'pawn', 'knight', 'bishop', 'rook', 'queen', 'king'], FILES = 'abcdefgh';
  const sq = s => FILES[s & 7] + (8 - (s >> 3)), pick = a => a[Math.floor(Math.random() * a.length)];
  const KN = [[1, 2], [2, 1], [-1, 2], [-2, 1], [1, -2], [2, -1], [-1, -2], [-2, -1]], KG = [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1]];
  const fresh = () => ({ scores: [], last: null, plies: 0, me: { caps: 0, val: 0, checks: 0 }, bot: { caps: 0, val: 0, checks: 0 }, uBlunders: 0, uGreat: 0, uHangs: 0, spoke: -9, said: [], opening: '', lastKind: '', streak: 0 });
  let S = fresh();

  /* squares a piece attacks (blocked by pieces), and the pieces of a colour that attack a square */
  function attSq(p, s) {
    const b = p.b, v = b[s], t = Math.abs(v), r = s >> 3, c = s & 7, out = []; if (!v) return out;
    const add = (rr, cc) => { if (rr >= 0 && rr < 8 && cc >= 0 && cc < 8) out.push(rr * 8 + cc); };
    if (t === 1) { const d = v > 0 ? -1 : 1; add(r + d, c - 1); add(r + d, c + 1); } else if (t === 2) KN.forEach(([a, z]) => add(r + a, c + z)); else if (t === 6) KG.forEach(([a, z]) => add(r + a, c + z));
    else { const dirs = []; if (t !== 3) dirs.push([1, 0], [-1, 0], [0, 1], [0, -1]); if (t !== 4) dirs.push([1, 1], [1, -1], [-1, 1], [-1, -1]); for (const [a, z] of dirs) { for (let k = 1; k < 8; k++) { const rr = r + a * k, cc = c + z * k; if (rr < 0 || rr > 7 || cc < 0 || cc > 7) break; out.push(rr * 8 + cc); if (b[rr * 8 + cc]) break; } } }
    return out;
  }
  function attackers(p, s, by) { const list = []; for (let i = 0; i < 64; i++) { const v = p.b[i]; if (v && (v > 0) === (by > 0) && attSq(p, i).includes(s)) list.push(Math.abs(v)); } return list.sort((a, b) => V[a] - V[b]); }
  const material = p => { let w = 0, b = 0, nw = 0, nb = 0, q = [0, 0]; for (let i = 0; i < 64; i++) { const v = p.b[i], t = Math.abs(v); if (!v || t === 6) continue; if (v > 0) { w += V[t]; if (t > 1) nw += V[t]; if (t === 5) q[0]++; } else { b += V[t]; if (t > 1) nb += V[t]; if (t === 5) q[1]++; } } return { w, b, nw, nb, q }; };
  const nm = (t) => NAME[t];
  const sideName = s => s > 0 ? 'White' : 'Black';

  /* facts about one move. d = { before (fen), u (uci), mine (the human played it), score (engine score for the bot after this move, optional) } */
  function facts(d) {
    let p; try { p = new C.Pos().setFen(d.before); } catch (e) { return null; } const m = p.fromUci(d.u); if (!m) return null;
    const f = m & 63, t = (m >> 6) & 63, side = p.side, mv = p.b[f], pt = Math.abs(mv), promo = (m >> 12) & 7, ep = pt === 1 && !p.b[t] && (f & 7) !== (t & 7), capT = ep ? 1 : Math.abs(p.b[t]), mat0 = material(p);
    const tags = [], desc = []; let sig = 0;
    const o = { mine: !!d.mine, piece: nm(pt), from: sq(f), to: sq(t), cap: capT ? nm(capT) : '', capV: V[capT], pv: V[pt], tags, desc, sig: 0, ply: d.ply || S.plies + 1 };
    const castle = pt === 6 && Math.abs((t & 7) - (f & 7)) === 2; p.make(m);
    const mat1 = material(p), chk = p.inCheck(), opp = p.side, ownSide = -opp;
    const att = attackers(p, t, opp), def = attackers(p, t, ownSide), cheapest = att.length ? V[att[0]] : 99;
    // what happened
    if (castle) { tags.push('castle'); desc.push((t & 7) > 4 ? 'castled kingside' : 'castled queenside'); sig = Math.max(sig, 2); }
    if (promo) { tags.push('promo'); desc.push('promoted a pawn to a ' + nm(promo) + ' on ' + sq(t)); sig = Math.max(sig, 9); }
    if (capT) {
      tags.push('cap'); desc.push(pt === 1 && !ep ? 'captured a ' + nm(capT) + ' with a pawn on ' + sq(t) : (ep ? 'captured a pawn en passant' : 'captured a ' + nm(capT) + ' on ' + sq(t) + ' with the ' + nm(pt)));
      sig = Math.max(sig, capT === 1 ? 3 : capT === 5 ? 9 : capT === 4 ? 7 : 6);
      const prev = S.last; if (prev && prev.cap && prev.to === sq(t)) { tags.push('recapture'); desc.push('a recapture, so this is a trade'); sig = Math.max(sig, 4); }
      if (V[capT] < V[pt] && att.length && (cheapest < V[pt] || !def.length)) { tags.push('sac'); desc.push('the ' + nm(pt) + ' can now be taken, so this may be a sacrifice or an exchange'); sig = Math.max(sig, 7); }
      if (!S.me.caps && !S.bot.caps) { tags.push('firstblood'); desc.push('the first capture of the game'); sig += 1; }
    }
    if (chk) { tags.push('check'); desc.push('gave check'); sig = Math.max(sig, 5); }
    // the moved piece in danger, or a fork
    if (pt > 1 && pt < 6 && att.length && (!def.length || cheapest < V[pt]) && !(capT && V[capT] >= V[pt])) { tags.push('hangs'); desc.push('the ' + nm(pt) + ' on ' + sq(t) + ' is now attacked' + (def.length ? ' by a lesser piece' : ' and nothing protects it')); sig = Math.max(sig, 7); }
    const hits = []; for (const s2 of attSq(p, t)) { const v = p.b[s2]; if (!v || (v > 0) === (mv > 0)) continue; const tt = Math.abs(v); if (tt === 6) hits.push({ t: 6, s: s2 }); else if (tt > 1 && (V[tt] > V[pt] || !attackers(p, s2, opp).length)) hits.push({ t: tt, s: s2 }); }
    if (!capT && hits.length >= 2 && pt !== 1 && !(pt >= 3 && att.length && cheapest < V[pt])) { tags.push('fork'); desc.push('the ' + nm(pt) + ' now attacks ' + hits.map(h => 'the ' + nm(h.t) + ' on ' + sq(h.s)).join(' and ')); sig = Math.max(sig, 8); }
    else if (!capT && hits.length === 1 && hits[0].t !== 6 && V[hits[0].t] >= 3 && !tags.includes('hangs')) { tags.push('threat'); desc.push('now threatens the ' + nm(hits[0].t) + ' on ' + sq(hits[0].s)); sig = Math.max(sig, 4); }
    if (pt === 5 && !capT && (d.ply || S.plies + 1) <= 9) { tags.push('earlyQueen'); desc.push('brought the queen out very early'); sig = Math.max(sig, 3); }
    if (pt === 1 && !capT && ((side > 0 && (t >> 3) === 1) || (side < 0 && (t >> 3) === 6))) { tags.push('push7'); desc.push('pushed a pawn to the ' + (side > 0 ? '7th' : '2nd') + ' rank, one step from promotion'); sig = Math.max(sig, 5); }
    if (mat0.q[0] + mat0.q[1] === 2 && mat1.q[0] + mat1.q[1] === 1 && capT === 5) { /* queen captured; trade detected via recapture next */ }
    if (mat1.q[0] + mat1.q[1] === 0 && mat0.q[0] + mat0.q[1] > 0) { tags.push('queensOff'); desc.push('the queens are now off the board'); sig = Math.max(sig, 5); }
    const mine = d.mine; o.sideDiff = mat1.w - mat1.b; // material from White's view after the move
    o.phase = (d.ply || S.plies + 1) <= 16 ? 'opening' : (mat1.nw <= 13 && mat1.nb <= 13 ? 'endgame' : 'middlegame');
    // engine verdict (bot's view of the position after this move)
    if (typeof d.score === 'number' && d.score !== 0) {
      const s = d.score, prev = S.scores.length ? S.scores[S.scores.length - 1] : null; o.score = s;
      if (Math.abs(s) >= 20000) { tags.push(s > 0 ? 'botMates' : 'botMated'); desc.push(s > 0 ? 'the engine sees a forced checkmate for you (the bot)' : 'the engine sees a forced checkmate against you (the bot)'); sig = Math.max(sig, 9); }
      else if (mine && prev !== null && Math.abs(prev) < 20000) {
        const sw = s - prev; o.swing = sw;
        if (sw >= 450) { tags.push('blunder'); desc.push('the human just blundered badly (the position swung hard in the bot\'s favour)'); sig = Math.max(sig, 9); }
        else if (sw >= 220) { tags.push('mistake'); desc.push('the human\'s move looks like a mistake'); sig = Math.max(sig, 7); }
        else if (sw <= -170) { tags.push('great'); desc.push('the human found a strong move that hurt the bot'); sig = Math.max(sig, 8); }
        const cat = x => (x >= 300 ? 2 : x >= 90 ? 1 : x > -90 ? 0 : x > -300 ? -1 : -2), cp = cat(prev), cn = cat(s);
        if (Math.abs(cn - cp) >= 2 && !tags.includes('blunder') && !tags.includes('great')) { tags.push('momentum'); o.shift = cn - cp; desc.push(cn < cp ? 'momentum has shifted toward the human: the bot was doing better a moment ago' : 'momentum has shifted toward the bot: the human was doing better a moment ago'); sig = Math.max(sig, 6); }
      }
    }
    o.sig = sig; return o;
  }

  /* running state across the game */
  function note(o, score) {
    S.plies++; const side = o.mine ? S.me : S.bot; if (o.cap) { side.caps++; side.val += o.capV; } if (o.tags.includes('check')) side.checks++;
    if (o.mine) { if (o.tags.includes('blunder') || o.tags.includes('mistake')) S.uBlunders++; if (o.tags.includes('great')) S.uGreat++; if (o.tags.includes('hangs')) S.uHangs++; }
    if (typeof score === 'number' && score !== 0) S.scores.push(score); S.last = o;
  }
  const trend = () => { const a = S.scores.slice(-4); if (a.length < 3) return ''; const d = a[a.length - 1] - a[0]; return d > 150 ? 'getting better for the bot lately' : d < -150 ? 'slipping away from the bot lately' : ''; };
  const standing = () => { const s = S.scores.length ? S.scores[S.scores.length - 1] : null; if (s === null) return ''; if (s >= 20000) return 'the bot sees a forced win'; if (s <= -20000) return 'the bot is in serious danger of being mated'; if (s >= 900) return 'the bot is winning easily'; if (s >= 300) return 'the bot is clearly better'; if (s >= 90) return 'the bot is slightly better'; if (s > -90) return 'the position is about equal'; if (s > -300) return 'the user is slightly better'; if (s > -900) return 'the user is clearly better'; return 'the user is winning easily'; };

  /* should the opponent say something about this move? */
  function worth(o, freq) {
    const narrate = freq === 2, gap = S.plies - S.spoke; let need = o.sig; if (!need) return false; if (freq === 0 && need < 7) return false; if (narrate && gap >= 1 && need >= 3) return true;
    const base = { 2: .22, 3: .38, 4: .5, 5: .62, 6: .7, 7: .88, 8: .95, 9: 1 }[Math.min(9, Math.max(2, Math.round(need)))] || .5;
    if (gap < 2 && need < 8) return false; if (gap < 4 && need < 6) return false;
    return Math.random() < Math.min(1, base * (narrate ? 1.25 : 1));
  }

  /* what the model should react to */
  function brief(o, bot) {
    const who = o.mine ? 'The user (human) just played' : 'You (the bot) just played', lines = [who + ' ' + o.piece + ' ' + o.from + ' to ' + o.to + (o.desc.length ? ': ' + o.desc.join('; ') : '') + '.'];
    const st = standing(); if (st) lines.push('Engine view: ' + st + (trend() ? ', ' + trend() : '') + '.');
    lines.push('Phase: ' + o.phase + '. Captures so far: user ' + S.me.caps + ', you ' + S.bot.caps + '.' + (S.opening ? ' Opening: ' + S.opening + '.' : ''));
    if (S.uBlunders >= 2) lines.push('The user has made ' + S.uBlunders + ' mistakes so far.'); if (S.uGreat >= 2) lines.push('The user has played ' + S.uGreat + ' strong moves so far.');
    return lines.join(' ');
  }
  const instruction = (o) => 'REACT to the move just played, in character, in ONE short sentence (max 22 words). Mention the actual piece, square or what happened so it is clearly about THIS move, not generic. ' + (o.mine ? (o.tags.includes('blunder') || o.tags.includes('mistake') ? 'You think it was a mistake: tease kindly or pretend not to notice, but do not tell them the better move. ' : o.tags.includes('great') ? 'It was a good move: show surprise or respect in your own style. ' : '') : 'Be pleased, smug or nervous as suits your personality and how the game stands. ') + 'Do not give the best move or analysis.';

  /* offline fallback lines: factual, with a little tone */
  function line(o, bot) {
    const T = o.tags, pc = o.piece, to = o.to, x = o.cap, good = standing(), win = /winning|clearly better|forced win/.test(good) && /bot is/.test(good), lose = /user is (winning|clearly)|danger/.test(good);
    const mine = o.mine, has = k => T.includes(k);
    if (has('momentum') && !has('cap')) return o.shift < 0 ? pick(['Hmm, the position has turned against me. Now I have to work.', 'That move changed the feel of the game. I am a bit worried.']) : pick(['I think the tide just turned my way.', 'Now we are getting somewhere. I like my chances.']);
    if (has('botMates')) return pick(['I think I can see where this is going, and it is not good for you.', 'Hm, I see a path to checkmate. Let us see if you do too.']);
    if (has('botMated')) return pick(['Uh oh. I am seeing something dark in this position.', 'That looks very dangerous for me. Do not tell me you planned this.']);
    if (has('cap') && x === 'queen') return mine ? pick(['You took my queen!? Ouch, that hurts.', 'My queen! Well, that is a bad moment.']) : pick(['Your queen is mine. Thank you!', 'Queen captured on ' + to + '. That tips things.']);
    if (has('promo')) return mine ? pick(['A new ' + (o.desc[0].match(/a (\w+) on/) || [0, 'queen'])[1] + '! Well played, I did not stop that in time.', 'You promoted on ' + to + '? That changes everything.']) : pick(['Promotion! Look what I made on ' + to + '.', 'A fresh piece on ' + to + '. Thank you very much.']);
    if (has('blunder')) return pick(['Did you mean to put the ' + pc + ' on ' + to + '? Because that helps me a lot.', 'Oh dear, ' + pc + ' to ' + to + '. I will take that gift.', 'Hm. ' + pc.charAt(0).toUpperCase() + pc.slice(1) + ' to ' + to + ' was not your best idea.']);
    if (has('mistake')) return pick(['Interesting choice with the ' + pc + '. I like it, for me.', pc.charAt(0).toUpperCase() + pc.slice(1) + ' to ' + to + '? I think I can use that.']);
    if (has('great')) return pick(['Ooh, ' + pc + ' to ' + to + ' is good. I did not like seeing that.', 'Nicely done with that ' + pc + '. Now I have to think.', 'That ' + pc + ' on ' + to + ' hurts. Respect.']);
    if (has('fork')) return mine ? pick(['Wait, that ' + pc + ' on ' + to + ' is attacking two things at once. Sneaky.', 'A fork! I walked right into that.']) : pick(['My ' + pc + ' on ' + to + ' is eyeing two of your pieces. Pick one.', 'Fork! Which one will you save?']);
    if (has('sac')) return mine ? pick(['You gave up the ' + pc + ' for my ' + x + '? Bold. Let me look at this carefully.', 'A sacrifice on ' + to + '? I do not trust it, but I am looking.']) : pick(['I traded my ' + pc + ' for your ' + x + '. Worth it, I think.', 'Sacrifice on ' + to + '! Let us see if it works.']);
    if (has('queensOff')) return pick(['Queens are off. It is a different game now.', 'No more queens. Time to be careful.']);
    if (has('recapture')) return pick(['A trade on ' + to + '. Fair is fair.', 'We swapped on ' + to + '. Evenly matched so far.', 'Recapture on ' + to + '. Back to even.']);
    if (has('check')) return mine ? pick(['Check from the ' + pc + '. Rude, but fair.', 'The ' + pc + ' gives check. I shall deal with it.']) : pick(['Check with the ' + pc + '!', 'Your king is under fire from the ' + pc + '.']);
    if (has('cap')) return mine ? (win ? pick(['You took my ' + x + ' on ' + to + '. I can live with that.', 'Fine, the ' + x + ' goes. I am still comfortable.']) : pick(['My ' + x + ' on ' + to + ' is gone. That stings.', 'You captured my ' + x + '. I did not love that.', 'Hm, I lost a ' + x + '. Need to be careful now.'])) : (lose ? pick(['I took your ' + x + ', though I am still in trouble.', 'A ' + x + ' for me, but do not think this is over.']) : pick(['Your ' + x + ' on ' + to + ' is mine now.', 'I captured your ' + x + ' with the ' + pc + '. Nice.', 'Thank you for the ' + x + '.']));
    if (has('threat')) return mine ? pick(['Your ' + pc + ' on ' + to + ' is giving me something to worry about.', 'I see the ' + pc + ' pressure. Hmm.']) : pick(['My ' + pc + ' is now looking at your ' + (o.desc.join(' ').match(/threatens the (\w+)/) || [0, 'piece'])[1] + '.', 'Watch your pieces. My ' + pc + ' has plans.']);
    if (has('hangs')) return mine ? pick(['Is the ' + pc + ' on ' + to + ' safe there? Just asking.', 'I think your ' + pc + ' is hanging a little.']) : pick(['My ' + pc + ' might be a little exposed. Do not look at it.', 'Yes, I know the ' + pc + ' on ' + to + ' is loose. It is part of the plan.']);
    if (has('push7')) return mine ? pick(['That pawn is one step from queening. I must stop it.', 'A passed pawn that close is trouble.']) : pick(['My pawn is almost there. Watch it go.', 'One step from promotion. Can you stop it?']);
    if (has('castle')) return mine ? pick(['Castled, nice and safe.', 'King tucked away. Sensible.']) : pick(['Castling. King safe, rooks ready.', 'There, my king is tucked in.']);
    if (has('earlyQueen')) return mine ? pick(['Queen out already? Bold. I might chase her.', 'The queen this early? I like the confidence.']) : pick(['Queen out early. I know, I know, but it is fun.']);
    return '';
  }

  /* a few lines of live game context for any chat reply, so talk is about the game being played */
  function chatContext() { const o = S.last, st = standing(), bits = []; if (o) bits.push('The last move (' + (o.mine ? 'by the user' : 'by you') + ') was the ' + o.piece + ' ' + o.from + ' to ' + o.to + (o.desc.length ? ', which ' + o.desc.join('; ') : '')); if (st) bits.push('Engine view: ' + st + (trend() ? ', ' + trend() : '') + '.'); bits.push('Captures: user ' + S.me.caps + ', you ' + S.bot.caps + '. Phase: ' + (o ? o.phase : 'opening') + '.' + (S.opening ? ' Opening: ' + S.opening + '.' : '')); if (S.uBlunders) bits.push('The user has made ' + S.uBlunders + ' dubious move(s).'); if (S.uGreat) bits.push('The user has played ' + S.uGreat + ' strong move(s).'); return 'Live game facts you can talk about naturally: ' + bits.join(' ') + ' When the user asks about the game, answer using these facts, in character, without exact engine numbers.'; }
  window.ChessReact = { geo: { attackers, attSq, material }, chatContext, facts, note, worth, brief, instruction, line, standing, trend, reset() { S = fresh(); }, state: () => S, setOpening(n) { S.opening = n || ''; }, markSpoke() { S.spoke = S.plies; }, lastScore: () => (S.scores.length ? S.scores[S.scores.length - 1] : null), pushScore(s) { if (typeof s === 'number' && s !== 0) S.scores.push(s); }, sideName };
})();

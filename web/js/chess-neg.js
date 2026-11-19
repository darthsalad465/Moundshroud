// Negotiating with your chess opponent. What you say in the chat can change the game: draws, takebacks, promised moves, trades, mercy.
// The text is read by rules (fast, works offline); the opponent's decision depends on the position, how persuasive you are, how much it trusts you and its personality.
// The AI only phrases the reply in character; the game acts on the decision. Also defines the two learning bots (Echo and Rival) and their gallery tab.
(() => {
  const C = Chess;
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v)), pick = a => a[Math.random() * a.length | 0];
  const S = { trust: .5, deals: [], offer: null, asks: {}, ev: 0, human: 1, lastOfferPly: -99, uid: 0 };
  const ADJ = { 'Viktor the Stoic': .2, 'Dexter the Dino': .1, 'Gran Maude': -.2, 'Coach Bolt': -.1, Pip: -.15, Goldie: -.1, Luna: -.1, Echo: -.05, 'Moundshroud Prime': .15, 'Old Titan': .05, Isla: .05, 'Baron von Blitz': .05 };
  const FORGET = { Goldie: .35, 'Captain Barnacle': .15, 'Dexter the Dino': .08 };
  const TAG = { Pip: 'Squeak! ', Goldie: 'Bloop. ', 'Captain Barnacle': 'Arr! ', 'Gran Maude': 'Oh, dear. ', 'Dexter the Dino': 'ROAR! ', 'Professor Plink': 'Fascinating! ', Zara: 'Okay chat... ', 'Sir Reginald': 'I say, ', 'Coach Bolt': 'Alright champ! ', Nova: 'Copy that. ', 'Detective Hawk': 'Hmm. ', 'Madame Rook': 'Darling, ', 'Baron von Blitz': 'Quick! ', Ada: 'Processing... ', 'The Oracle': 'I foresaw this. ', 'Old Titan': 'Well now. ' };
  const stubborn = (b, elo) => clamp((((b && b.e) || elo || 1200) - 400) / 2000 * .5 + (ADJ[b && b.n] || 0), -.1, .65);
  const LBL = { Q: 'queens', R: 'rooks', N: 'knights', B: 'bishops', '*': 'pieces' };
  const PL = ['', 'P', 'N', 'B', 'R', 'Q', 'K'], VAL = [0, 1, 3, 3, 5, 9, 99];
  const notify = () => { try { if (window.ChessBots) ChessBots.refresh(); } catch (e) { } };
  const norm = s => s.replace(/[+#!?x=]/g, '').replace(/0/g, 'O');
  const sqName = i => 'abcdefgh'[i & 7] + (8 - (i >> 3));

  /* ---------- reading the message ---------- */
  const NEG = /\b(don'?t|do not|no|not|never|won'?t|refuse|cannot|can'?t)\b/;
  const YES = /^\W*(yes|yeah|yep|yup|ok|okay|sure|deal|agreed|fine|accept|alright|all right|sounds good|let'?s do it|you bet)\b/i, NO = /^\W*(no|nope|nah|never|decline|not now|no thanks|i don'?t think so)\b/i;
  // Only moves meant for the bot count: "I'll play e4, you play e5" promises e5, and a message that only talks about the user's own move promises nothing.
  const parseMove = text => {
    const parts = text.split(/[,;.!?:\n]+|\b(?:and|then|but|while|so|if|when|after|because)\b|(?=\b(?:can|could|will|would|won't|wont|do|please)\s+(?:you|u)\b)|(?=\byou(?:'ll| will)?\s+(?:play|move|go|push|take|castle)\b)/i).filter(x => x && x.trim());
    for (const p of parts) { const own = /\b(i|i'll|i'd|i'm|ill|me|my|mine|we|we'll|our)\b/i.test(p) && !/\b(you|your|you'll|youll|yours|u)\b/i.test(p); if (own) continue; const r = parseMoveClause(p); if (r) return r; }
    return null;
  };
  const parseMoveClause = text => {
    const t = text.toLowerCase().replace(/[,;!?]/g, ' ');
    if (/\b(castle|castles|castling)\b/.test(t) || /\b(0-0|o-o)(-0|-o)?\b/.test(t)) { const q = /queen|long|0-0-0|o-o-o/.test(t); return { san: q ? 'O-O-O' : 'O-O', label: q ? 'castle queenside' : 'castle kingside' }; }
    const pm = /\b(pawn|knight|bishop|rook|queen|king)\b[^a-h]{0,24}?\b(?:to|on|at|takes|captures|goes to|move to)?\s*\b([a-h][1-8])\b/.exec(t);
    if (pm) { const L = { pawn: '', knight: 'N', bishop: 'B', rook: 'R', queen: 'Q', king: 'K' }[pm[1]]; return { piece: L, to: pm[2], label: pm[1] + ' to ' + pm[2] }; }
    const san = /\b(O-O-O|O-O|[KQRBN][a-h]?[1-8]?x?[a-h][1-8]|[a-h]x[a-h][1-8]|[a-h][1-8](?:=[QRBN])?)\b/.exec(text);
    if (san) return { san: san[1], label: san[1] };
    const cap = /\b(take|capture|taking)\b[^a-h]{0,14}\b([a-h][1-8])\b/.exec(t); if (cap) return { to: cap[2], capture: true, label: 'capture on ' + cap[2] };
    return null;
  };
  const parse = (text, c) => {
    const t = text.toLowerCase();
    if (S.offer && text.length < 40) { if (YES.test(text)) return { type: 'accept' }; if (NO.test(text)) return { type: 'decline' }; }
    if (/\b(take ?back|undo|redo|mouse ?slip|misclick|let me take that back|can i (have|take) (that|my) (move )?back)\b/.test(t)) return { type: 'takeback' };
    if (/\b(draw|split the point|call it even|call it a draw|agree to a draw|shake hands|tie game|stalemate it)\b/.test(t) && !/\b(draw a|drawing a|draw (me|you) a)\b/.test(t)) return NEG.test(t.replace(/don'?t you think/, '')) && !/\bwhy not\b|\bshould we\b|\bhow about\b|\bwould you\b|\bcan we\b/.test(t) ? { type: 'nodraw' } : { type: 'draw' };
    if (/\b(you should resign|will you resign|please resign|time to resign|resign now|give up|concede)\b/.test(t) && !/\bi (resign|give up|concede)\b/.test(t)) return { type: 'resign' };
    if (/\b(go easy|take it easy|be gentle|easy on me|play (a bit |a little )?(weaker|worse|easier|softer)|let me win|have mercy|mercy|be nice|slow down|don'?t crush)\b/.test(t)) return { type: 'gentle' };
    if (/\b(try harder|play (seriously|properly|your best|hard)|stop (holding back|going easy)|go all out|full strength|no more mercy)\b/.test(t)) return { type: 'serious' };
    const piece = /\b(queens?|rooks?|knights?|bishops?|pieces|everything)\b/.exec(t); const pc = piece ? ({ q: 'Q', r: 'R', k: 'N', b: 'B', p: '*', e: '*' }[piece[1][0]]) : null;
    if (/\b(trade|swap|exchange|simplify|offer a trade)\b/.test(t)) { if (/\b(don'?t|do not|no|avoid|please no|never)\s+(trade|swap|exchange|simplify)/.test(t)) return { type: 'avoid', piece: pc || '*' }; return { type: 'trade', piece: pc || '*' }; }
    if (/\bkeep (the )?(queens?|rooks?|pieces)\b/.test(t)) return { type: 'avoid', piece: pc || '*' };
    if (/\b(what|which)\b.*\b(you|your)\b.*\b(play|move|plan|going to|gonna|next)\b/.test(t) || /\byour (next move|plan)\b/.test(t)) return { type: 'asknext' };
    const req = /\b(pawn|knight|bishop|rook|queen|king)\s+to\s+[a-h][1-8]\b/.test(t) || /\b(play|move|go|push|take|capture|castle|put|advance|attack|open|develop|how about|why not|please|could you|can you|would you|will you|promise|just|try)\b/.test(t) || /^\W*([KQRBN]?[a-h]?[1-8]?x?[a-h][1-8]|O-O(-O)?)\W*$/i.test(text.trim());
    if (req) { const mv = parseMove(text); if (mv) return Object.assign({ type: 'move' }, mv); }
    return null;
  };

  /* ---------- how persuasive was that? ---------- */
  const persuasion = (text, kind, evBot, ply) => {
    const t = text.toLowerCase(); let p = 3;
    if (text.length > 45) p += 1; if (text.length > 110) p += 1;
    if (/\b(because|since|so that|that way|otherwise|fair|reasonable|think about it|makes sense|logical|honestly|truth)\b/.test(t)) p += 1;
    if (/\b(please|thanks|thank you|kindly|would you mind|i'd appreciate)\b/.test(t)) p += 1;
    if (/\b(great|nice|good|impressive|strong|well played|fun|enjoy|brilliant|clever|smart)\b/.test(t)) p += 1;
    if (/\b(lol|haha|hehe|joke)\b|[😂😄😊🙂😉]/.test(t)) p += .5;
    if (kind === 'draw') {
      if (/\b(equal|balanced|even|drawish|dead drawn|nobody is winning|level|fair result)\b/.test(t)) p += Math.abs(evBot) < 70 ? 2 : (evBot > 150 ? -2 : 0);
      if (/\b(long game|late|tired|time|clock|exhausted|dinner|hungry)\b/.test(t) && ply > 40) p += 1;
      if (/\b(i'?m (losing|worse|lost)|you'?re winning|you are winning)\b/.test(t)) p += evBot > 150 ? -1 : 0;
    }
    if (/\b(i'?m (lost|losing|worse|struggling)|i am (lost|losing)|help me|i'?m a beginner|i'?m new)\b/.test(t) && evBot > 100) p += 1.5;
    if (/\b(stupid|dumb|idiot|noob|trash|suck|garbage|loser|pathetic|useless)\b/.test(t)) p -= 3;
    if (text.length > 12 && text.replace(/[^A-Za-z]/g, '').length > 8 && text.replace(/[^A-Z]/g, '').length / text.replace(/[^A-Za-z]/g, '').length > .6) p -= 2;
    if (/\b(or else|i'?ll make you|you have to|you must)\b/.test(t)) p -= 2;
    const n = S.asks[kind] = (S.asks[kind] || 0) + 1; p -= (n - 1) * .8;
    return clamp(Math.round(p * 10) / 10, 0, 10);
  };
  const mood = text => { const t = text.toLowerCase(); let d = 0; if (/\b(please|thanks|thank you|thx|great|nice|good|well played|fun|brilliant|enjoy|cool|awesome|love|impressive|wow|gg|respect|kind)\b/.test(t)) d += .09; if (/\b(stupid|dumb|idiot|noob|trash|suck|garbage|loser|pathetic|useless|hate|boring|terrible|awful|bad bot|worst)\b/.test(t)) d -= .18; if (/\b(cheat|cheating|liar|shut up)\b/.test(t)) d -= .1; S.trust = clamp(S.trust + d, .05, 1); if (d) notify(); if (d <= -.18) { try { ChessAch.event('rude'); } catch (e) { } } };

  /* ---------- deals ---------- */
  const addDeal = d => { d.id = ++S.uid; S.deals.push(d); notify(); return d; };
  const labelOf = d => d.type === 'move' ? 'Next move: ' + d.spec.label : d.type === 'trade' ? 'Will trade ' + (LBL[d.piece] || 'pieces') + ' (' + d.left + ' moves)' : d.type === 'avoid' ? 'Will avoid trading ' + (LBL[d.piece] || 'pieces') + ' (' + d.left + ' moves)' : d.type === 'gentle' ? 'Going easy (' + d.left + ' moves)' : d.type === 'serious' ? 'Full strength (' + d.left + ' moves)' : d.type;
  const has = type => S.deals.some(d => d.type === type);
  const allowedLoss = d => clamp(60 + (d.P || 3) * 22 + (S.trust - .5) * 120, 40, 400);
  const takeMoveDeal = pos => { const d = S.deals.find(x => x.type === 'move'); if (!d) return null; const b = window.ChessBots ? ChessBots.cur() : null, f = FORGET[b && b.n] || 0; if (f && Math.random() < f) { S.deals = S.deals.filter(x => x !== d); notify(); return { deal: d, forget: b.n === 'Captain Barnacle' ? 'Arr, I be changin\' me mind, matey! Pirates do not keep promises.' : 'Wait, what was I going to play? I forgot our deal!' }; } return { deal: d }; };
  const done = d => { try { ChessAch.event('dealkept'); } catch (e) { } S.deals = S.deals.filter(x => x !== d); S.trust = clamp(S.trust + .05, .05, 1); notify(); };
  const broke = d => { S.deals = S.deals.filter(x => x !== d); notify(); };
  const resolve = (spec, pos, legal) => {
    const cands = legal.filter(m => { const to = (m >> 6) & 63, pc = Math.abs(pos.b[m & 63]); if (spec.san) { const s = norm(pos.san(m, legal)); return s === norm(spec.san) || s === spec.san; } if (spec.to && sqName(to) !== spec.to) return false; if (spec.piece !== undefined && PL[pc] !== spec.piece && !(spec.piece === '' && pc === 1)) return false; if (spec.capture && !(pos.b[to] || (pc === 1 && (m & 7) !== (to & 7)))) return false; return true; });
    return cands.length ? cands.sort((a, b) => VAL[Math.abs(pos.b[a & 63])] - VAL[Math.abs(pos.b[b & 63])])[0] : 0;
  };
  const bonusFn = () => {
    const tr = S.deals.filter(d => d.type === 'trade'), av = S.deals.filter(d => d.type === 'avoid'); if (!tr.length && !av.length) return null;
    return (f, m, pos) => { let s = 0; const pc = PL[Math.abs(pos.b[m & 63])], tg = PL[Math.abs(pos.b[(m >> 6) & 63])], hit = (d) => d.piece === '*' || d.piece === pc || d.piece === tg; if (f.cap && f.trade) { for (const d of tr) if (hit(d)) s += 140; for (const d of av) if (hit(d)) s -= 140; } return s; };
  };
  const needsScores = () => S.deals.length > 0;
  const tick = () => { S.deals.forEach(d => { if (d.type !== 'move' && d.left) d.left--; }); S.deals = S.deals.filter(d => d.type === 'move' || d.left > 0); notify(); };
  const reset = () => { try { ChessAch.event('dealreset'); } catch (e) { } S.trust = .5; S.deals = []; S.offer = null; S.asks = {}; S.lastOfferPly = -99; notify(); };

  /* ---------- the decision ---------- */
  const T = (b, s) => (TAG[b && b.n] || '') + s;
  async function handle(text, ctx, bot) {
    const c = ctx.get(); if (c.over) return null; S.human = c.human; mood(text);
    const it = parse(text, c); if (!it) return null;
    const stub = stubborn(bot, c.elo), special = bot && bot.special, ply = c.hist.length;
    const ev = ctx.evalBot ? await ctx.evalBot().catch(() => S.ev) : S.ev; if (typeof ev === 'number') S.ev = ev;
    const roll = p => Math.random() < clamp(p, .01, .97), ver = (extra) => (extra ? ' ' + extra : '');
    const adj = (P, base) => base + P * .025 + (S.trust - .5) * .3 - stub * .2 + (special === 'mirror' ? .05 : 0);
    let out = null;
    if (it.type === 'accept' && S.offer) { S.offer = null; out = { accepted: true, instr: 'You offered the user a draw and they ACCEPTED. Say a short in-character line; the game is a draw.', fb: T(bot, 'A draw it is, then. Well played.'), act: () => ctx.actions.draw() }; }
    else if (it.type === 'decline' && S.offer) { S.offer = null; out = { accepted: false, instr: 'You offered a draw but the user DECLINED. Say a short in-character line and carry on playing.', fb: T(bot, 'No draw, then. Back to the fight!') }; }
    else if (it.type === 'draw') {
      const P = persuasion(text, 'draw', ev, ply), base = ev <= -150 ? .93 : ev <= -40 ? .8 : ev <= 40 ? .62 : ev <= 120 ? .3 : ev <= 300 ? .1 : .02, p = adj(P, base) + (ply > 60 ? .08 : 0), ok = roll(p);
      out = ok ? { accepted: true, P, instr: 'The user proposed a draw and you ACCEPT (you were ' + (P > 6 ? 'convinced by their argument' : 'happy with the position') + '). Say so in character in 1 or 2 short sentences. The game ends as a draw.', fb: T(bot, pick(['Alright, I accept a draw. Shall we shake hands?', 'You have convinced me. Draw.', 'Fine. Let us split the point.'])), act: () => ctx.actions.draw() }
        : { accepted: false, P, instr: 'The user proposed a draw and you DECLINE (' + (ev > 120 ? 'you think you are better' : 'you still see chances') + '). Say so in character in 1 or 2 short sentences, without giving away the evaluation numbers. The game continues.', fb: T(bot, pick(['Not yet, I still see chances.', 'No draw for now. Keep playing.', 'I am not ready to split the point.'])) };
    }
    else if (it.type === 'nodraw') { out = { accepted: true, instr: 'The user said they do NOT want a draw. Respond in character in one short sentence: the game goes on.', fb: T(bot, 'Good, I would rather play on too.') }; }
    else if (it.type === 'resign') {
      const P = persuasion(text, 'resign', ev, ply), base = ev <= -800 ? .3 : ev <= -400 ? .1 : .01, ok = roll(base + P * .02 - stub * .1 + (S.trust - .5) * .1);
      out = ok ? { accepted: true, P, instr: 'The user urged you to resign and, since your position is hopeless, you RESIGN. Say a gracious in-character line.', fb: T(bot, 'You are right. I resign. Well played!'), act: () => ctx.actions.resign() } : { accepted: false, P, instr: 'The user asked you to resign and you REFUSE; you fight on. Say a short in-character line.', fb: T(bot, 'Resign? Never! I am not done yet.') };
    }
    else if (it.type === 'takeback') {
      const P = persuasion(text, 'takeback', ev, ply), ok = roll(adj(P, .5) + (c.hist.length > 1 ? 0 : -1));
      out = ok ? { accepted: true, P, instr: 'The user asked to take back their last move and you ALLOW it, just this once. Say so in character.', fb: T(bot, 'Go on, take it back. Just this once!'), act: () => ctx.actions.undo() } : { accepted: false, P, instr: 'The user asked to take back their move and you REFUSE (a move is a move). Say so kindly in character.', fb: T(bot, 'A move is a move. No take-backs!') };
    }
    else if (it.type === 'gentle' || it.type === 'serious') {
      if (it.type === 'serious') { S.deals = S.deals.filter(d => d.type !== 'gentle'); addDeal({ type: 'serious', left: 8, P: 5 }); out = { accepted: true, instr: 'The user asked you to play harder and you AGREE: you now play at full strength. Say so in character, a bit ominously.', fb: T(bot, 'You asked for it. Full strength!') }; }
      else { const P = persuasion(text, 'gentle', ev, ply), ok = roll(adj(P, .45) + (ev > 300 ? .15 : 0)); if (ok) { S.deals = S.deals.filter(d => d.type !== 'serious'); addDeal({ type: 'gentle', left: 6, P }); } out = ok ? { accepted: true, P, instr: 'The user asked you to go easy and you AGREE for the next few moves (you will play a bit weaker). Say so in character.', fb: T(bot, 'Okay, I will go easy on you for a while.') } : { accepted: false, P, instr: 'The user asked you to go easy and you REFUSE, you want a real game. Say so kindly in character.', fb: T(bot, 'No mercy in chess! Let us play properly.') }; }
    }
    else if (it.type === 'trade' || it.type === 'avoid') {
      const P = persuasion(text, it.type, ev, ply), want = it.type === 'trade' ? (ev > 150 ? .2 : ev < -150 ? -.2 : 0) : (ev < -150 ? .2 : ev > 150 ? -.15 : 0), ok = roll(adj(P, .5) + want), lbl = LBL[it.piece] || 'pieces';
      if (ok) addDeal({ type: it.type, piece: it.piece, left: 6, P });
      out = ok ? { accepted: true, P, instr: 'The user asked you to ' + (it.type === 'trade' ? 'trade ' : 'avoid trading ') + lbl + ' and you AGREE (you will favour it for the next few moves if it is safe). Say so in character.', fb: T(bot, it.type === 'trade' ? 'Fine, I will trade ' + lbl + ' when I can.' : 'All right, I will avoid trading ' + lbl + '.') } : { accepted: false, P, instr: 'The user asked you to ' + (it.type === 'trade' ? 'trade ' : 'avoid trading ') + lbl + ' and you REFUSE; you will decide yourself. Say so in character.', fb: T(bot, 'I will decide my own trades, thank you.') };
    }
    else if (it.type === 'move') {
      const P = persuasion(text, 'move', ev, ply), ok = roll(adj(P, .55) + (ev < -100 ? .05 : 0));
      if (ok) { S.deals = S.deals.filter(d => d.type !== 'move'); addDeal({ type: 'move', spec: it, P }); }
      out = ok ? { accepted: true, P, instr: 'The user asked you to play ' + it.label + ' on your next move and you AGREE (you will do it if it is still possible and not a blunder). Mention the move in character.', fb: T(bot, 'Deal. I will play ' + it.label + ' next, if I still can.') } : { accepted: false, P, instr: 'The user asked you to play ' + it.label + ' on your next move and you REFUSE to promise it. Say so in character without revealing your own plan.', fb: T(bot, 'I cannot promise that one. I will choose my own move.') };
    }
    else if (it.type === 'asknext') {
      const d = S.deals.find(x => x.type === 'move');
      out = d ? { accepted: true, instr: 'The user asks what you will play next. You promised ' + d.spec.label + ', so you tell them that, in character.', fb: T(bot, 'I promised ' + d.spec.label + '. A deal is a deal.') } : { accepted: false, instr: 'The user asks what you will play next. You are not sure yet and you tease a little without revealing a real move: mention a plan like developing, trading or attacking. One short in-character sentence.', fb: T(bot, pick(['That depends on what you do first.', 'I am thinking about development... or maybe a trade.', 'A magician never reveals her next move.'])) };
    }
    if (!out) return null;
    S.trust = clamp(S.trust + (out.accepted ? .05 : -.04), .05, 1); notify(); if (['draw', 'takeback', 'move', 'trade', 'avoid', 'gentle', 'resign', 'accept'].includes(it.type)) { try { ChessAch.event('deal', { kind: it.type === 'accept' ? 'draw' : it.type, accepted: out.accepted }); } catch (e) { } }
    return { handled: true, kind: it.type, accepted: out.accepted, instruction: out.instr, fallback: out.fb, act: out.act, P: out.P };
  }

  /* ---------- the opponent proposes a draw sometimes ---------- */
  const afterBotMove = c => { tick(); S.offer = null; const ply = c.hist.length; if (ply < 30 || ply - S.lastOfferPly < 14 || S.ev < -140 || S.ev > 60 || Math.random() > .14) { notify(); return; } S.offer = { type: 'draw', ply }; S.lastOfferPly = ply; notify(); try { ChessBots.say(pick(['Shall we call it a draw? The position looks balanced to me.', 'I would be happy with a draw here. What do you say?', 'Draw? I do not see either of us making progress.']), 500); } catch (e) { } };
  const onUserMove = () => { if (S.offer) { S.offer = null; notify(); } };
  const answerOffer = (yes, ctx) => { if (!S.offer) return; S.offer = null; if (yes) { try { ChessBots.say('Wonderful. A draw it is!', 200); } catch (e) { } setTimeout(() => ctx.actions.draw(), 900); } else { try { ChessBots.say('Very well, we play on.', 200); } catch (e) { } } notify(); };

  const briefing = () => { const m = S.trust > .57 ? 'friendly' : S.trust < .43 ? 'irritated' : 'neutral'; const d = S.deals.map(labelOf).join('; '); return 'Your mood toward the user: ' + m + '. ' + (d ? 'Agreements in force: ' + d + '. ' : '') + (S.offer ? 'You have just offered the user a draw and wait for their answer. ' : ''); };
  const moodLabel = () => S.trust > .57 ? '😊 friendly' : S.trust >= .43 ? '😐 neutral' : '😠 irritated';
  const view = () => ({ offer: S.offer, deals: S.deals.map(d => ({ id: d.id, label: labelOf(d), type: d.type })), trust: S.trust, mood: moodLabel() });
  const cancel = id => { S.deals = S.deals.filter(d => d.id !== id); notify(); };

  window.ChessNeg = { handle, state: () => S, has, takeMoveDeal, resolve, allowedLoss, done, broke, bonusFn, needsScores, afterBotMove, onUserMove, answerOffer, reset, briefing, view, cancel, setEval: (best, side, human) => { S.ev = side === human ? -best : best; }, parse, persuasion };

  /* ---------- the two learning bots ---------- */
  window.ChessSpecial = {
    mirror: { n: 'Echo', i: '🪞', t: 'The Mirror: learns your style', special: 'mirror', bio: 'Studies every move you make and plays the way you would. The more you play, the more it sounds and plays like you.', st: 'a thoughtful, observant mirror-opponent who has been studying the user\'s own games; speaks warmly, notices the user\'s habits (like I would have played that too), teases gently, is fair-minded and open to good arguments',
      L: { hi: 'Hello, me. Let us see which of us plays better.', cap: 'That is exactly the kind of capture you would make, is it not?', lost: 'You took it. Just as I expected you to.', chk: 'Check. I learned that one from you.', chkd: 'A check. I know that look.', win: 'I played like you and still won. Funny.', lose: 'You beat yourself. Well played.', draw: 'A draw. Two of you, perfectly matched.', chat: ['You would say that. I would too.', 'I am only copying you, you know.'] } },
    twin: { n: 'Rival', i: '👥', t: 'The Elo Twin: plays at your level', special: 'twin', bio: 'A club player rated just like you: sharp enough to be a fair fight, human enough to blunder like one.', st: 'a friendly but competitive club player rated about the same as the user; relaxed chess-club banter, occasionally anxious about time, admits mistakes openly, relatable and human',
      L: { hi: 'Hey, nice to meet someone my level. Good luck!', cap: 'Ooh, I will take that if you do not mind.', lost: 'Ouch, I missed that. Nice one.', chk: 'Check! Sorry, could not resist.', chkd: 'Oh, a check. Let me think...', win: 'Phew, that was close. Good game!', lose: 'You got me! Great game. Rematch?', draw: 'A draw feels fair. Good game!', chat: ['Hmm, I need a moment to think about this one.', 'It is tough to find the right plan here.'] } },
    draw: { n: 'Equinox', i: '⚖️', t: 'The Equalizer: always steers for a draw', special: 'draw', noElo: 1, bio: 'Every move it plays brings the position back to equal. Take a pawn and it gives something back; stand worse and it fights to hold. You cannot beat it by being a bit better, only by finding a way it cannot balance.', st: 'a calm, unshakeable balance-keeper who treats every game as a negotiation toward equality; speaks in even, measured tones, never gloats, gently rebalances when the user gets ahead',
      L: { hi: 'Let us keep this level, shall we?', cap: 'Taken. I will find a way to even it out.', lost: 'That is yours. We will balance it soon enough.', chk: 'A check. Nothing to worry about.', chkd: 'A check. I will deal with it calmly.', win: 'I did not mean to win. Perfect balance is hard.', lose: 'You found a way through the balance. Impressive.', draw: 'Equal, exactly as it should be.', chat: ['Equality is a position, not a result.', 'Every advantage can be given back.'] } },
    tide: { n: 'Tide', i: '🌊', t: 'The Adaptive Bot: rises and falls with you', special: 'tide', noElo: 1, bio: 'Learns how strong you are from your results and keeps the game close, but a draw is not its goal: you can win and you can lose. Beat it and it gets stronger; lose to it and it eases off.', st: 'a lively, encouraging sparring partner who senses the tempo of the game; cheers good moves, never talks down, gets sharper when the user is winning and gentler when the user is struggling',
      L: { hi: 'Let us see how high the tide comes today.', cap: 'A capture, the tide turns.', lost: 'You took it. I felt that wave.', chk: 'Check! The water rises.', chkd: 'A check. Nicely timed.', win: 'The tide was in my favour this time. Again?', lose: 'You rode the wave. I will come back stronger.', draw: 'Even tides. A draw.', chat: ['The sea is patient.', 'I match whoever I am playing.'] } },
  };

  /* ---------- the "Learning bots" tab of the opponents gallery ---------- */
  const esc2 = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  window.ChessNeg.renderSpecial = (host, ctx) => {
    const L = window.ChessLearn, B = window.ChessBots, mode = B.mode(), E = window.ChessSpecial;
    const draw = () => {
      const sm = L.summary(), r = L.rate(), fid = L.fid();
      host.innerHTML = '<div class="small mute" style="margin-bottom:8px">Four special opponents: two that adapt to you, one that always steers for a draw, and one that matches your level but can be beaten. Both can be talked into things: draws, promised moves, trades and more (see "How to negotiate" below).</div>' +
        '<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(260px,1fr));gap:10px">' +
        '<div class="card" style="margin:0;border:2px solid ' + (mode === 'mirror' ? 'var(--acc)' : 'var(--line)') + '"><div class="row" style="gap:10px"><span style="font-size:34px">🪞</span><div><b>Echo</b> <span class="small" style="color:var(--acc2)">the Mirror</span><div class="small mute">Learns your style and plays like you</div></div></div>' +
        '<div class="small" style="margin:8px 0">' + esc2(E.mirror.bio) + '</div>' +
        '<div class="small"><b>What Echo has learned</b>: ' + (sm.n ? sm.n + ' of your moves' + (sm.games ? ' from ' + sm.games + ' saved games' : '') + ', ' + sm.book + ' positions remembered (learning level ' + Math.round(sm.conf * 100) + '%).' : 'nothing yet. Play a few games (or tap "Learn from my past games") and Echo starts to copy you.') + '</div>' +
        (sm.traits.length ? '<ul class="small" style="margin:6px 0 6px 18px">' + sm.traits.map(t => '<li>You ' + esc2(t.text) + ' <span class="mute">(' + (t.up ? '+' : '-') + t.pct + '% vs average)</span></li>').join('') + '</ul>' : '') +
        '<div class="row" style="gap:8px;margin:6px 0"><span class="small mute" style="width:120px">Copy you closely</span><input type="range" id="lfid" min="0" max="100" step="5" value="' + fid + '" style="flex:1"><b id="lfidv" style="width:44px;text-align:right">' + fid + '%</b></div>' +
        '<div class="row" style="gap:6px;flex-wrap:wrap"><button class="pri" id="lpm">' + (mode === 'mirror' ? '✓ Playing Echo' : 'Play Echo') + '</button><button class="ib" id="lboot">Learn from my past games</button><button class="ib dang" id="lreset">Forget</button></div></div>' +
        '<div class="card" style="margin:0;border:2px solid ' + (mode === 'twin' ? 'var(--acc)' : 'var(--line)') + '"><div class="row" style="gap:10px"><span style="font-size:34px">👥</span><div><b>Rival</b> <span class="small" style="color:var(--acc2)">the Elo Twin</span><div class="small mute">Plays like a human at your rating</div></div></div>' +
        '<div class="small" style="margin:8px 0">' + esc2(E.twin.bio) + '</div>' +
        '<div class="small"><b>Your estimated rating</b>: <span style="color:var(--acc2);font-weight:700">' + r.r + '</span> <span class="mute">(' + (r.manual ? 'set by you' : r.n ? 'from ' + r.n + ' games, updated after each game vs the bots' : 'from your puzzle rating until you play some games') + ')</span></div>' +
        '<div class="row" style="gap:8px;margin:6px 0"><span class="small mute">Set it yourself</span><input type="number" id="lrate" min="400" max="2600" step="50" value="' + r.r + '" style="width:90px"><button class="ib" id="lrset">Save</button></div>' +
        '<div class="small mute">Rival picks sensible moves with human-sized errors: it misses things players of your rating miss, loves captures and checks a little too much, and takes a human amount of time to think.</div>' +
        '<div class="row" style="gap:6px;flex-wrap:wrap;margin-top:6px"><button class="pri" id="ltw">' + (mode === 'twin' ? '✓ Playing Rival' : 'Play Rival') + '</button></div></div></div>' +
        '<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(260px,1fr));gap:10px;margin-top:10px">' +
        '<div class="card" style="margin:0;border:2px solid ' + (mode === 'draw' ? 'var(--acc)' : 'var(--line)') + '"><div class="row" style="gap:10px"><span style="font-size:34px">⚖️</span><div><b>Equinox</b> <span class="small" style="color:var(--acc2)">the Equalizer</span><div class="small mute">Always steers for a draw</div></div></div>' +
        '<div class="small" style="margin:8px 0">' + esc2(E.draw.bio) + '</div><div class="small mute">After every move Equinox looks for the reply that makes the position equal. It gives pieces back when ahead and plays its best when behind.</div>' +
        '<div class="row" style="gap:6px;flex-wrap:wrap;margin-top:6px"><button class="pri" id="leq">' + (mode === 'draw' ? '✓ Playing Equinox' : 'Play Equinox') + '</button></div></div>' +
        '<div class="card" style="margin:0;border:2px solid ' + (mode === 'tide' ? 'var(--acc)' : 'var(--line)') + '"><div class="row" style="gap:10px"><span style="font-size:34px">🌊</span><div><b>Tide</b> <span class="small" style="color:var(--acc2)">the Adaptive Bot</span><div class="small mute">Matches you: you can win or lose</div></div></div>' +
        '<div class="small" style="margin:8px 0">' + esc2(E.tide.bio) + '</div><div class="small"><b>Tide\'s skill now</b>: <span style="color:var(--acc2);font-weight:700">' + Math.round(L.tide().s * 100) + '%</span> <span class="mute">(' + L.tide().n + ' games: you won ' + L.tide().w + ', drew ' + L.tide().d + ', lost ' + L.tide().l + ')</span></div>' +
        '<div class="row" style="gap:6px;flex-wrap:wrap;margin-top:6px"><button class="pri" id="ltd">' + (mode === 'tide' ? '✓ Playing Tide' : 'Play Tide') + '</button><button class="ib dang" id="ltdr">Reset</button></div></div></div>' +
        (E.trainer ? '<div class="card" style="margin:10px 0 0;border:2px solid ' + (mode === 'trainer' ? 'var(--acc)' : 'var(--line)') + '"><div class="row" style="gap:10px"><span style="font-size:34px">🎯</span><div><b>Trainer</b> <span class="small" style="color:var(--acc2)">finds your weak spots</span><div class="small mute">Plays at your rating and steers into your worst opening</div></div></div><div class="small" style="margin:8px 0">' + esc2(E.trainer.bio) + '</div><div class="small"><b>Its focus now</b>: ' + esc2(window.ChessTrainer ? ChessTrainer.brief() : '') + '</div><div class="small mute" id="trst" style="margin-top:4px"></div><div class="row" style="gap:6px;flex-wrap:wrap;margin-top:6px"><button class="pri" id="ltr">' + (mode === 'trainer' ? '✓ Playing Trainer' : 'Play Trainer') + '</button><button class="ib" id="ltrpz" title="Read the games you have played and turn the moments where you went wrong into puzzles you can drill">🧩 Puzzles from my games</button><button class="ib" id="ltro">📂 My puzzles</button></div></div>' : '') +
        '<div class="card" style="margin:10px 0 0"><b>🗣️ How to negotiate (any opponent, but these two are the most open-minded)</b><ul class="small" style="margin:6px 0 0 18px;line-height:1.55">' +
        '<li><b>Draws</b>: "Want to call it a draw?" They look at the position, your reasons and how much they trust you. Be polite, be honest ("it is equal"), and do not nag.</li>' +
        '<li><b>A promised move</b>: "Could you play Nf3 next?" or "knight to f6". They keep their word unless the move is no longer possible or would lose too much.</li>' +
        '<li><b>Trades</b>: "Let us trade queens" or "please do not trade". <b>Mercy</b>: "go easy on me" / "play your best". <b>Take-backs</b>: "can I take that back?"</li>' +
        '<li>They may offer you a draw too: answer yes or no (or use the buttons under the chat). Insults and shouting lower their trust.</li></ul></div>';
      const q = id => host.querySelector('#' + id);
      q('lfid').oninput = () => { L.fid(+q('lfid').value); q('lfidv').textContent = q('lfid').value + '%'; };
      q('lboot').onclick = () => { const n = L.bootstrap(); A.toast(n ? 'Echo learned ' + n + ' more moves from your saved games.' : 'No new saved games to learn from yet.'); draw(); };
      q('lreset').onclick = async () => { if (!(await A.confirm('Make Echo forget everything it has learned about your style?'))) return; L.resetLearning(); draw(); };
      q('lrset').onclick = () => { L.setRate(+q('lrate').value); A.toast('Rating set to ' + L.rate().r); draw(); };
      const choose = m => { B.setMode(m); ctx.setElo(clamp(Math.round(L.rate().r / 100) * 100, 400, 2400)); A.closeDlg(); A.toast({ mirror: 'Echo', twin: 'Rival', draw: 'Equinox', tide: 'Tide', trainer: 'Trainer' }[m] + ' will be your opponent. Start a new game to play.', 3500); };
      q('lpm').onclick = () => choose('mirror'); q('ltw').onclick = () => choose('twin'); q('leq').onclick = () => choose('draw'); q('ltd').onclick = () => choose('tide'); if (q('ltr')) q('ltr').onclick = () => choose('trainer');
      q('ltdr').onclick = async () => { if (!(await A.confirm('Reset Tide to its starting skill?'))) return; L.resetTide(); draw(); };
      /* the Trainer's two jobs from one place: turn your own games into puzzles, and open them */
      const ts = q('trst'); if (ts) { try { const s = ChessTrainer.stats(); ts.textContent = s.games + ' of your games read · ' + s.analysed + ' analysed · ' + s.slips + ' mistakes found · ' + s.puzzles + ' of your own puzzles saved'; } catch (e) { } }
      const trpz = q('ltrpz'); if (trpz) trpz.onclick = async () => {
        const T = window.ChessTrainer; if (!T) return; const was = trpz.textContent; trpz.disabled = true; trpz.textContent = '⏳ Reading your games...';
        let built = { made: 0, total: 0, why: '' };
        try {
          let a = T.analyse();
          if (!a.analysed && a.need && a.need.length) {
            trpz.textContent = '⏳ Analysing your games (up to 4)...';
            await T.analyseGames((i, n) => { trpz.textContent = '⏳ Analysing your games (' + (i + 1) + ' of ' + n + ')...'; });
          }
          built = T.build(24);
        } catch (e) { built = { made: 0, total: 0, why: String(e.message || e) }; }
        trpz.disabled = false; trpz.textContent = was;
        if (built.why === 'noana') A.toast('Trainer: I could not analyse a saved game — the engine may be busy. Play one more game and try again.', 4600);
        else if (!built.made) A.toast('Trainer: nothing new to turn into a puzzle yet. Play a few games (or analyse one in Analysis) and press this again.', 4800);
        else A.toast('Trainer made ' + built.made + ' puzzle' + (built.made === 1 ? '' : 's') + ' out of your own games. ' + built.total + ' saved in total — press "My puzzles" to drill them.', 5200);
        draw();
      };
      const tro = q('ltro'); if (tro) tro.onclick = () => { const T = window.ChessTrainer; const ok = T && T.openPuzzles(); A.closeDlg(); if (!ok) A.toast('Open Chess > Puzzles to try them.'); else A.toast('Showing your own puzzles — the moments your games went wrong.', 3600); };
    };
    L.bootstrap(); draw();
  };
})();


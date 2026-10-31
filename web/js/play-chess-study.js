// Chess Academy: courses, endless puzzles, openings, famous games, endgames and game review.
// Uses chess-engine.js (rules + engine), chess-gen.js (puzzle generator worker), chess-courses.js and chess-study-data.js.
(() => {
  const P = A.play, C = Chess, S = window.CHESS_STUDY || { endgames: [], openings: [] };
  const COURSES = window.CHESS_COURSES || [], GAMES = window.CHESS_GAMES || [];
  const GL = { 1: '♟︎', 2: '♞', 3: '♝', 4: '♜', 5: '♛', 6: '♚' };
  const fresh = () => ({ lessons: {}, puz: { rating: 800, solved: 0, streak: 0, best: 0, made: 0 }, ops: {}, seen: {} });
  const store = () => { try { const d = Object.assign(fresh(), JSON.parse(ls.get('chstudy', '{}'))); d.puz = Object.assign(fresh().puz, d.puz); d.seen = d.seen || {}; return d; } catch (e) { return fresh(); } };
  const put = d => { const k = Object.keys(d.seen); if (k.length > 1500) k.slice(0, k.length - 1000).forEach(x => delete d.seen[x]); ls.set('chstudy', JSON.stringify(d)); };
  const css = '.acb{--sz:var(--csz,56px);display:grid;grid-template:repeat(8,var(--sz))/repeat(8,var(--sz));border-radius:10px;overflow:hidden;border:2px solid var(--line);position:relative;user-select:none;touch-action:none;box-shadow:0 10px 30px rgba(0,0,0,.35)}.acb .chs{position:relative;display:flex;align-items:center;justify-content:center;font-size:calc(var(--sz)*.82);line-height:1;cursor:pointer}.acb .chs.l{background:var(--sqL)}.acb .chs.d{background:var(--sqD)}.acb .chs.last::after,.acb .chs.sel::after,.acb .chs.hint::after,.acb .chs.good::after,.acb .chs.bad::after{content:"";position:absolute;inset:0}.acb .chs.last::after{background:var(--hlast,rgba(255,214,10,.38))}.acb .chs.sel::after{background:rgba(80,200,120,.5)}.acb .chs.hint::after{box-shadow:inset 0 0 0 4px #4fa8ff}.acb .chs.good::after{background:rgba(80,200,120,.45)}.acb .chs.bad::after{background:rgba(255,80,100,.5)}.acb .chs.chk{box-shadow:inset 0 0 0 3px var(--bad),inset 0 0 18px var(--bad)}.acb .bdot{position:absolute;width:30%;height:30%;border-radius:50%;background:rgba(20,30,20,.38);pointer-events:none}.acb .bring{position:absolute;inset:4%;border-radius:50%;border:5px solid rgba(20,30,20,.38);pointer-events:none}.acb .bdot.hop,.acb .bring.hop{border:2px dashed rgba(130,205,255,.95);background:rgba(70,165,255,.2);box-shadow:0 0 10px rgba(70,165,255,.45)}.acb .pc{position:relative;z-index:2;pointer-events:none;filter:drop-shadow(0 2px 1px rgba(0,0,0,.45))}.acb .pc.b{filter:drop-shadow(0 2px 1px rgba(0,0,0,.4))}.acb .prom{position:absolute;inset:0;z-index:5;background:rgba(8,10,16,.72);display:flex;align-items:center;justify-content:center;gap:10px}.acb .prom button{width:calc(var(--sz)*1.1);height:calc(var(--sz)*1.1);font-size:calc(var(--sz)*.8);border-radius:12px;border:2px solid var(--line);background:var(--panel2);cursor:pointer}.acb.shake{animation:acshake .3s}@keyframes acshake{25%{transform:translateX(-6px)}75%{transform:translateX(6px)}}.acw{display:flex;gap:18px;flex-wrap:wrap;justify-content:center;align-items:flex-start;width:100%}.acside{width:300px;max-width:100%;display:flex;flex-direction:column;gap:10px}.acmsg{border-radius:12px;padding:10px 12px;background:var(--panel);border:1px solid var(--line);line-height:1.5}.acmsg.ok{border-color:var(--ok)}.acmsg.no{border-color:var(--bad)}.acg{display:grid;grid-template-columns:repeat(auto-fill,minmax(210px,1fr));gap:10px;width:100%}.acg .card{cursor:pointer;margin:0}.acg .card:hover{border-color:var(--acc)}.acq{display:block;width:100%;text-align:left;margin:6px 0 0;padding:9px 12px;border-radius:10px;border:1px solid var(--line);background:var(--panel2);cursor:pointer}.acq:hover{border-color:var(--acc)}.acq.ok{border-color:var(--ok);background:rgba(80,200,120,.15)}.acq.no{border-color:var(--bad);background:rgba(255,80,100,.12)}.acdots i{display:inline-block;width:8px;height:8px;border-radius:50%;background:var(--line);margin-right:3px}.acdots i.on{background:var(--acc2)}.acb .prebar{position:absolute;left:50%;bottom:8px;transform:translateX(-50%);display:flex;gap:6px;align-items:center;padding:4px 6px 4px 11px;border-radius:999px;background:rgba(10,12,18,.88);border:1px solid rgba(255,255,255,.22);color:#fff;font-size:11.5px;line-height:1;z-index:7;box-shadow:0 6px 18px rgba(0,0,0,.5);white-space:nowrap}.acb .prebar button{border:0;background:rgba(255,255,255,.16);color:#fff;font:inherit;padding:3px 8px;border-radius:999px;cursor:pointer}.acb .prebar button:hover{background:rgba(255,255,255,.32)}.acb:focus-visible{outline:3px solid var(--acc2,#7ec8ff);outline-offset:3px}.acb .chs.cur{box-shadow:inset 0 0 0 4px rgba(255,255,255,.92),inset 0 0 12px rgba(0,0,0,.35);z-index:3}.acb .chs.cur.sel{box-shadow:inset 0 0 0 4px #5ee08a}.acb-live{position:absolute!important;width:1px;height:1px;overflow:hidden;clip:rect(0 0 0 0);white-space:nowrap}';
  if (!document.getElementById('acss')) { const s = document.createElement('style'); s.id = 'acss'; s.textContent = css; document.head.appendChild(s); }
  if (window.ChessSet) window.ChessSet.apply();       // re-append the board settings sheet so it is last and wins

  /* ---------- reusable board ---------- */
  let __uid = 0;                                        // each board gets its own square ids, so several boards on a page stay distinct
  function Board(host) {
    const me = this; me.pos = new C.Pos().setFen(C.START); me.flipped = false; me.who = 0; me.sel = -1; me.targets = []; me.last = null; me.marks = {}; me.onmove = null; me.prom = null; me.pre = 0; me.premove = null;
    host.innerHTML = '<div class="acbw"><div class="ranks"></div><div class="acb"></div><div class="files"></div></div>'; const wrap = host.firstChild, el = me.el = wrap.querySelector('.acb'); const CS = window.ChessSet; if (CS) CS.boards.add(me); let drag = null, ghost = null, legal = [];
    /* ---- keyboard and screen-reader play: Tab to the board, arrows to move the cursor, Enter to pick up and drop ---- */
    me.uid = 'b' + (++__uid); me.cursor = 52; me._kb = false;
    el.tabIndex = 0; el.setAttribute('role', 'group');
    const live = document.createElement('div'); live.className = 'acb-live'; live.setAttribute('aria-live', 'polite'); live.setAttribute('role', 'status'); wrap.appendChild(live);
    const NAMES = { 1: 'pawn', 2: 'knight', 3: 'bishop', 4: 'rook', 5: 'queen', 6: 'king' };
    const sqLabel = sq => { const p = me.pos.b[sq]; return C.sqName(sq) + ', ' + (p ? (p > 0 ? 'white ' : 'black ') + NAMES[Math.abs(p)] : 'empty') + (me.targets.includes(sq) ? (p && p * (me.pre || me.pos.side) > 0 ? ', premove here' : ', can move here') : ''); };
    const say = t => { try { live.textContent = t; } catch (e) { } };
    me.cue = (prevB, last, changed) => { try { if (window.ChessVoice) ChessVoice.moved(me, prevB, last, changed); } catch (e) { } if (!CS || !prevB || !last || !changed) return; const fr = last[0], to = last[1], pf = prevB[fr], pt = prevB[to]; if (!pf) return; const np = me.pos.b[to], isP = Math.abs(pf) === 1, cap = !!pt || (isP && (fr & 7) !== (to & 7)), promo = isP && Math.abs(np) !== 1, castle = Math.abs(pf) === 6 && Math.abs(to - fr) === 2; let kind = 'move'; if (me.pos.inCheck()) kind = me.pos.legal().length ? 'check' : 'mate'; else if (promo) kind = 'promote'; else if (castle) kind = 'castle'; else if (cap) kind = 'capture'; const mine = performance.now() - (me._mine || 0) < 1500; me._mine = 0; CS.sound(kind, !mine && me.who !== 2); };
    me.set = (fen, o = {}) => { const prevB = me.pos ? me.pos.b.slice() : null, prevKey = me.pos ? me.pos.key() : ''; me.variant = o.variant || ''; me.pos = me.variant && window.ChessVX ? ChessVX.make(me.variant, fen) : new C.Pos().setFen(fen); me.who = o.who === undefined ? 0 : o.who; me.pre = o.pre || 0; me.fog = o.fog || 0; if (o.clearPre) me.premove = null;   /* drawing the same game again (a clock tick, the opponent moving) must not throw your queued premoves away; only an explicit clearPre, the game ending or premoves being switched off does that */ me.flipped = !!o.flipped; me.sel = -1; me.targets = []; me._hop = null; me.last = o.last || null; me.marks = {}; me.ann = { s: {}, a: [] }; (o.hl || []).forEach(s => { me.marks[C.sqIndex(s)] = 'hint'; }); me.prom = null; me.draw(); if (me.last && o.anim !== false) { me.slide(me.last[0], me.last[1]); if (o.sound !== false) me.cue(prevB, me.last, prevKey !== me.pos.key()); } };
    /* premoves (online games): while it is the opponent's turn, me.pre is the colour that may queue one move; the move is stored in me.premove and the game plays it when the turn comes */
    /* me.premoves is a queue (as on chess.com): each one is played in turn after the opponent's replies. me.premove is the first of them; setting it to null clears the whole queue. */
    me.premoves = []; Object.defineProperty(me, 'premove', { get: () => me.premoves[0] || null, set: v => { me.premoves = v ? [v] : []; } });
    const preMode = () => !!me.pre && me.pos.side !== me.pre;
    const asMine = p => { const g = p.fen().split(' '); g[1] = me.pre > 0 ? 'w' : 'b'; g[3] = '-'; return new C.Pos().setFen(g.join(' ')); };
    /* A premove may be aimed at a square that is not legal yet: one of your own pieces may step aside, or an enemy
       piece may arrive on the square you want to capture on (the classic pawn-takes-diagonally premove). Those
       "hopeful" premoves can be queued; they are only ever played if they are legal when your turn really comes,
       and are dropped with a word if they are not. The check runs the real rules on a lightly edited copy of the
       position, so a hopeful premove can never be something the piece could not actually do. */
    const cloneOf = p => new C.Pos().setFen(p.fen());
    const hope = (p, from, to) => {
      if (!p || from === to || from < 0 || from > 63 || to < 0 || to > 63) return [];
      const moving = p.b[from], t = p.b[to]; if (!moving || moving * me.pre <= 0) return [];
      const kind = Math.abs(moving); let q;
      if (t && t * me.pre > 0) { if (Math.abs(t) === 6) return []; q = cloneOf(p); q.b[to] = 0; }      /* our own piece is in the way: pretend it steps aside */
      else if (!t && kind === 1) {                                                                     /* a pawn capture onto a square that is empty for now */
        const df = (to & 7) - (from & 7), dr = (to >> 3) - (from >> 3);
        if (Math.abs(df) !== 1 || dr !== (me.pre > 0 ? -1 : 1)) return [];
        q = cloneOf(p); q.b[to] = -me.pre;                                                             /* an enemy piece arrives there */
      } else return [];
      return q.legal().filter(m => (m & 63) === from && ((m >> 6) & 63) === to).map(m => ({ mv: m, q }));
    };
    /* apply one queued premove to a hypothetical position: exactly, or hopefully if the square is not free yet */
    const looseMake = (p, pm) => {
      const mv = p.legal().find(x => (x & 63) === pm.from && ((x >> 6) & 63) === pm.to && (!pm.promo || ((x >> 12) & 7) === pm.promo));
      if (mv !== undefined) { p.make(mv); return p; }
      const hs = hope(p, pm.from, pm.to); if (!hs.length) return null;
      const h = (pm.promo && hs.find(x => ((x.mv >> 12) & 7) === pm.promo)) || hs[0];
      h.q.make(h.mv); return h.q;
    };
    const hypPos = n => { let p; try { p = asMine(me.pos); } catch (e) { return null; } const k = n === undefined ? me.premoves.length : n; for (let i = 0; i < k; i++) { p = looseMake(p, me.premoves[i]); if (!p) return null; try { p = asMine(p); } catch (e) { return null; } } return p; };
    const preLegal = () => { const p = hypPos(); return p ? p.legal() : []; };
    /* every square the selected piece could be sent to while it is the opponent's turn, plus the ones that are only
       possible later (drawn dashed, so premoving onto a piece of your own never looks like a mistake) */
    const preTargets = sq => {
      const p = hypPos(), set = new Set(), hop = new Set(); if (!p) return { t: [], hop };
      for (const m of p.legal()) if ((m & 63) === sq) set.add((m >> 6) & 63);
      for (let to = 0; to < 64; to++) { if (set.has(to)) continue; if (hope(p, sq, to).length) { set.add(to); hop.add(to); } }
      return { t: [...set], hop };
    };
    /* keep only the premoves that still work, in order: removing one (or the opponent's move changing the position) can
       leave a later one impossible, and half a plan is worse than the part of it that is still real */
    const prune = () => {
      let p; try { p = asMine(me.pos); } catch (e) { return; } let k = 0;
      for (; k < me.premoves.length; k++) {
        p = looseMake(p, me.premoves[k]);          /* hopeful premoves survive here: they may still become playable */
        if (!p) break; try { p = asMine(p); } catch (e) { break; }
      }
      if (k < me.premoves.length) me.premoves = me.premoves.slice(0, k);
    };
    /* take back one queued premove: the piece goes home and, if it is yours to move again, it stays selected so you can
       drop it somewhere else in the same gesture. Everything still possible after it is kept. */
    me.undoPre = () => {
      if (!me.premoves.length) return false;
      const i = me.premoves.length - 1, from = me.premoves[i].from;
      me.premoves.splice(i, 1); prune(); me.sel = -1; me.targets = [];
      if (me.allowed(from)) pickUp(from);
      me.draw(); if (me.onpremove) me.onpremove(me.premove); return true;
    };
    me.clearPre = () => { if (!me.premoves.length) return false; me.premoves = []; me.sel = -1; me.targets = []; me.draw(); if (me.onpremove) me.onpremove(null); return true; };
    const curLegal = () => preMode() ? preLegal() : (me.who ? me.pos.legal() : []);
    /* select a piece and light up everywhere it can go right now, including the squares it can only reach after the
       opponent's move (a premove into one of your own pieces, or a pawn capture onto a square that is still empty) */
    const pickUp = sq => { const pt = preMode() ? preTargets(sq) : null; me.sel = sq; me.targets = pt ? pt.t : curLegal().filter(m => (m & 63) === sq).map(m => (m >> 6) & 63); me._hop = pt ? pt.hop : null; };
    me.commit = m => { if (preMode()) { if (me.premoves.length >= 8) me.premoves.shift(); me.premoves.push({ from: m & 63, to: (m >> 6) & 63, promo: (m >> 12) & 7 }); me.sel = -1; me.targets = []; me._hop = null; me.draw(); if (me.onpremove) me.onpremove(me.premove); } else { me._mine = performance.now(); me.onmove && me.onmove(m); } };
    /* voice moves (chess-voice.js): the moves the person may play right now, and a way to play one as if they had dragged it */
    me.voiceLegal = () => { if (preMode()) return preLegal(); if (!me.who) return []; if (me.who !== 2 && me.pos.side !== me.who) return []; return me.pos.legal(); };
    me.voiceCommit = m => { me.sel = -1; me.targets = []; me.prom = null; me.commit(m); };
    me.allowed = sq => { if (preMode()) { const hp = hypPos(), p = hp && hp.b[sq]; return !!p && p * me.pre > 0; } const p = me.pos.b[sq]; if (!p || !me.who) return false; return me.who === 2 ? p * me.pos.side > 0 : p * me.who > 0 && me.pos.side === me.who; };
    /* Fog of War: you only see your own pieces and the squares they can move to; everything else is hidden */
    if (!document.getElementById('fogcss')) { const fs_ = document.createElement('style'); fs_.id = 'fogcss'; fs_.textContent = '.acb .chs.fogsq{filter:brightness(.32) saturate(.5)}.acb .chs.fogsq::before{content:"";position:absolute;inset:0;background:repeating-linear-gradient(45deg,rgba(255,255,255,.05) 0 6px,rgba(0,0,0,.08) 6px 12px);pointer-events:none;z-index:1}'; document.head.appendChild(fs_); }
    const fogVis = () => { const col = me.fog, vis = new Set(); try { const g = me.pos.fen().split(' '); g[1] = col > 0 ? 'w' : 'b'; g[3] = '-'; const p = new C.Pos().setFen(g.join(' ')); for (let i = 0; i < 64; i++) if (p.b[i] * col > 0) vis.add(i); for (const m of p.legal()) vis.add((m >> 6) & 63); } catch (e) { } return vis; };    me.draw = () => {
      legal = curLegal(); const hop = me._hop || new Set(), vis = me.fog ? fogVis() : null; const kc = me.pos.inCheck() ? me.pos.ksq[me.pos.side > 0 ? 0 : 1] : -1; let h = ''; const co = CS ? CS.cfg().coords : 'off'; wrap.dataset.co = co === 'out' ? 'out' : co === 'in' ? 'in' : 'off';
      if (co === 'out') { const lb = CS.labels(me.flipped); wrap.querySelector('.ranks').innerHTML = lb.r.map(x => '<span>' + x + '</span>').join(''); wrap.querySelector('.files').innerHTML = lb.f.map(x => '<span>' + x + '</span>').join(''); }
      const showCur = me._kb || document.activeElement === el;
      for (let i = 0; i < 64; i++) { const sq = me.flipped ? 63 - i : i, r = sq >> 3, c = sq & 7, p = me.pos.b[sq]; let cls = 'chs ' + ((r + c) & 1 ? 'd' : 'l'); if (me.last && (sq === me.last[0] || sq === me.last[1]) && (!vis || vis.has(sq))) cls += ' last'; if (vis && !vis.has(sq)) cls += ' fogsq'; if (sq === me.sel) cls += ' sel'; if (sq === kc) cls += ' chk'; if (sq === me.cursor && showCur) cls += ' cur'; if (me.premoves.some(x => sq === x.from || sq === x.to)) cls += ' pre'; if (me.marks[sq]) cls += ' ' + me.marks[sq];
        h += '<div class="' + cls + '" data-s="' + sq + '" id="' + me.uid + '-' + sq + '" role="button" tabindex="-1" aria-label="' + sqLabel(sq) + '">' + (me.targets.includes(sq) ? (p ? '<span class="bring' + (hop.has(sq) ? ' hop' : '') + '"></span>' : '<span class="bdot' + (hop.has(sq) ? ' hop' : '') + '"></span>') : '') + (p && !window.__cvBlind && (!vis || vis.has(sq) || p * me.fog > 0) ? (CS ? CS.html(p) : '<span class="pc ' + (p > 0 ? 'w' : 'b') + '">' + GL[Math.abs(p)] + '</span>') : '') + (co === 'in' && !(i & 7) ? '<span class="co r">' + (8 - r) + '</span>' : '') + (co === 'in' && i >= 56 ? '<span class="co f">' + 'abcdefgh'[c] + '</span>' : '') + '</div>'; }
      el.innerHTML = h; me.premoves.forEach((pm, i) => { if (me.premoves.slice(i + 1).some(x => x.from === pm.to)) return; const hp = hypPos(i), tc = el.children[idxOf(pm.to)], pcs = hp && hp.b[pm.from]; if (tc && pcs) tc.insertAdjacentHTML('beforeend', '<div class="pregh" style="position:absolute;inset:0;display:flex;align-items:center;justify-content:center;opacity:.55;pointer-events:none;z-index:2">' + (CS ? CS.html(pcs) : '<span class="pc ' + (pcs > 0 ? 'w' : 'b') + '">' + GL[Math.abs(pcs)] + '</span>') + '</div>'); });
      if (me.prom) { const d = document.createElement('div'); d.className = 'prom'; d.innerHTML = [5, 4, 3, 2].map(t => '<button data-p="' + t + '" style="display:flex;align-items:center;justify-content:center">' + (CS ? CS.html((preMode() ? me.pre : me.pos.side) > 0 ? t : -t) : GL[t]) + '</button>').join(''); el.appendChild(d); }
      /* queued premoves get their own little bar, so "how do I take that back?" is never a guess. It is drawn whenever
         anything is queued - including the instant the opponent's move lands, while it is being played - so the queue is
         never invisible and never looks as if it quietly vanished. */
      if (me.premoves.length) {
        const bar = document.createElement('div'); bar.className = 'prebar';
        bar.innerHTML = '<span>' + me.premoves.length + ' premove' + (me.premoves.length > 1 ? 's' : '') + '</span>' + (me.premoves.length > 1 ? '<button type="button" data-preundo="1" title="Take back the last premove">↶ Take back</button>' : '') + '<button type="button" data-preclr="1" title="Clear every premove">✕ Clear</button>';
        el.appendChild(bar);
      }
      me.drawAnn();
    };
    const idxOf = sq => me.flipped ? 63 - sq : sq;
    /* arrows move the cursor the way the board is drawn; Enter picks a piece up and puts it down; Escape puts it back */
    const keyMove = e => {
      const k = e.key, i = idxOf(me.cursor); let j = i;
      if (k === 'ArrowLeft') j = i % 8 === 0 ? i : i - 1;
      else if (k === 'ArrowRight') j = i % 8 === 7 ? i : i + 1;
      else if (k === 'ArrowUp') j = i < 8 ? i : i - 8;
      else if (k === 'ArrowDown') j = i > 55 ? i : i + 8;
      else if (k === 'Home') j = 56;
      else if (k === 'End') j = 63;
      else return false;
      me.cursor = idxOf(j); me._kb = true; me.draw();
      say(sqLabel(me.cursor) + (me.pos.inCheck() && me.cursor === me.pos.ksq[me.pos.side > 0 ? 0 : 1] ? ', in check' : ''));
      return true;
    };
    el.addEventListener('keydown', e => {
      if (e.altKey || e.ctrlKey || e.metaKey) return;
      if (keyMove(e)) { e.preventDefault(); return; }
      if (e.key === 'Enter' || e.key === ' ') {
        if (me.prom) return;                                   /* the promotion buttons are the keyboard target then */
        const before = me.premoves.length, wasKey = me.pos.key(), sq = me.cursor;
        pick(sq);
        const nowKey = me.pos.key();
        if (nowKey !== wasKey) say('moved to ' + C.sqName(sq) + (me.pos.inCheck() ? ', check' : ''));
        else if (me.premoves.length !== before) say('premove queued: ' + me.premoves.length + (me.premoves.length === 1 ? ' premove' : ' premoves'));
        else if (me.sel === sq) say('picked up ' + sqLabel(sq));
        else if (me.sel >= 0 && me.targets.length) say('selected ' + C.sqName(me.sel) + ', ' + me.targets.length + ' squares to move to');
        else say(sqLabel(sq));
        e.preventDefault();
      } else if (e.key === 'Escape' && (me.sel >= 0 || me.targets.length)) { me.sel = -1; me.targets = []; me.draw(); e.preventDefault(); }
    });
    /* focusing with the mouse must not paint a cursor ring: only the first arrow key (or Tab, above) turns that on */
    el.addEventListener('focus', () => say(sqLabel(me.cursor)));
    el.addEventListener('blur', () => { me._kb = false; me.draw(); });
    me.slide = (f, t) => { const ms = CS ? CS.animMs() : 240; if (!ms || document.body.classList.contains('lowpower')) return; const ea = el.children[idxOf(f)], eb = el.children[idxOf(t)]; if (!ea || !eb) return; const pc = eb.querySelector('.pc'); if (!pc) return; const ra = ea.getBoundingClientRect(), rb = eb.getBoundingClientRect(), dx = ra.left - rb.left, dy = ra.top - rb.top; if (!dx && !dy) return; pc.style.transition = 'none'; pc.style.transform = 'translate(' + dx + 'px,' + dy + 'px)'; pc.style.zIndex = 6; requestAnimationFrame(() => requestAnimationFrame(() => { pc.style.transition = 'transform ' + ms + 'ms cubic-bezier(.2,.8,.2,1)'; pc.style.transform = ''; })); };
    me.play = m => { const prevB = me.pos.b.slice(); me.pos.make(m); me.last = [m & 63, (m >> 6) & 63]; me.ann = { s: {}, a: [] }; me.sel = -1; me.targets = []; me.marks = {}; me.draw(); me.slide(me.last[0], me.last[1]); me.cue(prevB, me.last, true); };
    me.undo = () => { if (!me.pos.stack.length) return; me.pos.unmake(); me.last = null; me.sel = -1; me.targets = []; me.marks = {}; me.draw(); };
    me.shake = () => { el.classList.remove('shake'); void el.offsetWidth; el.classList.add('shake'); };
    const attempt = (from, to) => {
      legal = curLegal(); let cand = legal.filter(m => (m & 63) === from && ((m >> 6) & 63) === to);
      if (!cand.length && preMode()) cand = hope(hypPos(), from, to).map(h => h.mv);   /* legal once the opponent's move lands */
      if (!cand.length) return;
      if (cand.length > 1) { me.prom = { cand }; me.draw(); return; }
      me.commit(cand[0]);
    };
    const pick = sq => {
      if (me.prom) return; legal = curLegal();
      if (preMode() && me.premoves.length) {
        /* clicking the square a queued premove came from gives that piece back (and keeps the rest of the plan). This is
           the "take back my own piece" gesture: it no longer wipes out every premove you had lined up. */
        const at = me.premoves.findIndex(x => x.from === sq);
        if (at >= 0) { const keep = me.premoves[at]; me.premoves.splice(at, 1); prune(); me.sel = -1; me.targets = []; if (me.allowed(keep.from)) pickUp(keep.from); me.draw(); if (me.onpremove) me.onpremove(me.premove); return; }
        /* a left click on any other square never wipes the queue: only the square a premove came from (just above), the
           ✕ Clear button and a right click do. Losing a whole plan to a stray click was the worst part of premoving. */
      }
      if (me.sel >= 0 && me.targets.includes(sq)) return attempt(me.sel, sq);
      if (me.allowed(sq)) { pickUp(sq); me.draw(); }
      else { me.sel = -1; me.targets = []; me._hop = null; me.draw(); }
    };
    el.addEventListener('pointerdown', e => {
      if (e.button === 2) return;
      const pu = e.target.closest('[data-preundo]'), pc2 = e.target.closest('[data-preclr]');
      if (pu || pc2) { e.preventDefault(); e.stopPropagation(); (pu ? me.undoPre : me.clearPre)(); return; }
      const pr = e.target.closest('.prom [data-p]'); if (pr) { const m = me.prom.cand.find(x => ((x >> 12) & 7) === +pr.dataset.p); me.prom = null; me.commit(m); return; }
      const s = e.target.closest('.chs'); if (!s) return; const sq = +s.dataset.s, wasT = me.sel >= 0 && me.targets.includes(sq); pick(sq); if (!wasT && me.sel === sq) drag = { sq, x: e.clientX, y: e.clientY, moved: false };
    });
    const mv = e => { if (!drag) return; if (!drag.moved && Math.hypot(e.clientX - drag.x, e.clientY - drag.y) < 6) return; if (!drag.moved) { drag.moved = true; ghost = document.createElement('div'); const p = me.pos.b[drag.sq]; ghost.className = 'acb'; ghost.innerHTML = CS ? CS.html(p) : '<span class="pc ' + (p > 0 ? 'w' : 'b') + '">' + GL[Math.abs(p)] + '</span>'; ghost.style.cssText = 'position:fixed;z-index:99;pointer-events:none;display:flex;grid-template:none;box-shadow:none!important;background:none;overflow:visible;border-radius:0;transform:translate(-50%,-55%) scale(1.15);filter:drop-shadow(0 8px 8px rgba(0,0,0,.5))'; document.body.appendChild(ghost); } ghost.style.left = e.clientX + 'px'; ghost.style.top = e.clientY + 'px'; };
    const up = e => { if (!drag) return; const d = drag; drag = null; if (ghost) { ghost.remove(); ghost = null; } if (!d.moved) return; const t = document.elementFromPoint(e.clientX, e.clientY), s = t && t.closest && t.closest('.chs'); if (s && +s.dataset.s !== d.sq && me.targets.includes(+s.dataset.s)) attempt(d.sq, +s.dataset.s); else { if (CS && s && +s.dataset.s !== d.sq) CS.sound('illegal'); me.draw(); } };
    document.addEventListener('pointermove', mv); document.addEventListener('pointerup', up);
    /* ---- right-click arrows and highlights: right-click a square to mark it, right-drag to draw an arrow. Shift = green, Ctrl = red, Alt = blue. Left-click clears. ---- */
    me.ann = { s: {}, a: [] };
    const aCol = e => e.shiftKey ? '#3fae4b' : e.ctrlKey ? '#e53935' : e.altKey ? '#2a8cff' : '#f0a020';
    const pos = sq => { const i = idxOf(sq); return [(i & 7) + .5, (i >> 3) + .5]; };
    /* an arrow as SVG: a straight arrow, or an L-shape for a knight move (long leg first), with a solid head like chess.com */
    me.arrowSvg = a => {
      const [x1, y1] = pos(a.f), [x2, y2] = pos(a.t), dx = x2 - x1, dy = y2 - y1, kn = (Math.abs(dx) === 1 && Math.abs(dy) === 2) || (Math.abs(dx) === 2 && Math.abs(dy) === 1);
      const pts = kn ? (Math.abs(dy) > Math.abs(dx) ? [[x1, y1], [x1, y2], [x2, y2]] : [[x1, y1], [x2, y1], [x2, y2]]) : [[x1, y1], [x2, y2]];
      const n = pts.length, last = pts[n - 1], prev = pts[n - 2], ld = Math.hypot(last[0] - prev[0], last[1] - prev[1]) || 1, ux = (last[0] - prev[0]) / ld, uy = (last[1] - prev[1]) / ld;
      const W0 = a.w || .17, HL = .2 + W0 * 1.0, HW = .12 + W0 * .55, tip = [last[0] - ux * .08, last[1] - uy * .08], base = [tip[0] - ux * HL, tip[1] - uy * HL];
      const fd = Math.hypot(pts[1][0] - pts[0][0], pts[1][1] - pts[0][1]) || 1, st = [pts[0][0] + (pts[1][0] - pts[0][0]) / fd * .22, pts[0][1] + (pts[1][1] - pts[0][1]) / fd * .22];
      const line = [st].concat(pts.slice(1, n - 1), [base]).map(p => p[0].toFixed(3) + ',' + p[1].toFixed(3)).join(' ');
      return '<g opacity=".85" fill="' + a.c + '"><polyline points="' + line + '" fill="none" stroke="' + a.c + '" stroke-width="' + W0 + '" stroke-linecap="round" stroke-linejoin="round"/><polygon points="' + tip[0].toFixed(3) + ',' + tip[1].toFixed(3) + ' ' + (base[0] - uy * HW).toFixed(3) + ',' + (base[1] + ux * HW).toFixed(3) + ' ' + (base[0] + uy * HW).toFixed(3) + ',' + (base[1] - ux * HW).toFixed(3) + '"/></g>';
    };    me.drawAnn = () => {
      let o = el.querySelector('.ann'); if (o) o.remove(); const A_ = me.ann; if (!Object.keys(A_.s).length && !A_.a.length) return;
      let h = '';
      for (const k in A_.s) { const [x, y] = pos(+k); h += '<rect x="' + (x - .5) + '" y="' + (y - .5) + '" width="1" height="1" fill="' + A_.s[k] + '" opacity=".55"/>'; }
      for (const a of A_.a) h += me.arrowSvg(a);      o = document.createElementNS('http://www.w3.org/2000/svg', 'svg'); o.setAttribute('class', 'ann'); o.setAttribute('viewBox', '0 0 8 8'); o.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;pointer-events:none;z-index:4'; o.innerHTML = h; el.appendChild(o);
    };
    let rd = null;
    el.addEventListener('contextmenu', e => e.preventDefault());
    el.addEventListener('pointerdown', e => { if (e.button === 2) { if (me.premove) { me.premove = null; me.sel = -1; me.targets = []; me.draw(); e.preventDefault(); e.stopPropagation(); return; } const s = e.target.closest('.chs'); if (s) { rd ={ sq: +s.dataset.s, c: aCol(e) }; e.preventDefault(); } return; } if (Object.keys(me.ann.s).length || me.ann.a.length) { me.ann = { s: {}, a: [] }; me.drawAnn(); } }, true);
    const rup = e => { if (e.button !== 2 || !rd) return; const d = rd; rd = null; const t0 = document.elementFromPoint(e.clientX, e.clientY), s = t0 && t0.closest && t0.closest('.chs'); if (!s || !el.contains(s)) return; const to = +s.dataset.s;
      if (to === d.sq) { if (me.ann.s[to] === d.c) delete me.ann.s[to]; else { me.ann.s[to] = d.c; try { ChessAch.event('square'); } catch (e) { } } } else { const i = me.ann.a.findIndex(x => x.f === d.sq && x.t === to); if (i >= 0) me.ann.a.splice(i, 1); else { me.ann.a.push({ f: d.sq, t: to, c: d.c }); try { ChessAch.event('arrow'); } catch (e) { } } }
      me.drawAnn(); };
    document.addEventListener('pointerup', rup);
    me.destroy = () => { document.removeEventListener('pointerup', rup); if (CS) CS.boards.delete(me); document.removeEventListener('pointermove', mv); document.removeEventListener('pointerup', up); if (ghost) ghost.remove(); };
    me.draw();
  }
  function Eng() { let w = null, id = 0, pend = {}; const mk = () => { try { w = new Worker('/web/js/chess-engine.js'); w.onmessage = e => { const p = pend[e.data.id]; if (p) { delete pend[e.data.id]; p(e.data); } }; } catch (e) { w = null; } }; mk(); const ask0 = o => new Promise(res => { if (!w) { const pos = new C.Pos().setFen(o.fen); if (o.cmd === 'eval') { const a = C.analyze(pos, Math.min(o.depth || 3, 3), 3000) || []; return res({ best: a[0] && a[0][0], score: a[0] ? a[0][1] : 0, scores: a }); } const r = C.think(pos, o.elo, Math.min(o.ms, 1200)); return res({ move: r && r.move, score: r ? r.score : 0 }); } const i = ++id; pend[i] = res; w.postMessage(Object.assign({}, o, { id: i })); }); return { ask: o => (window.ChessSF && ChessSF.wants(o)) ? ChessSF.run(o).catch(() => ask0(o)) : ask0(o), kill() { if (w) w.terminate(); w = null; pend = {}; }, reset() { this.kill(); mk(); } }; }
  const sideName = s => s > 0 ? 'White' : 'Black';
  const ev = (k, d) => { try { window.ChessAch && window.ChessAch.event(k, d); } catch (e) { } };

  /* ---------- puzzle settings ---------- */
  const DEF = { moves: 'any', themes: [], level: 'mixed', pieces: 'any', side: 'any', source: 'all', labels: true, hints: true, rated: true, auto: false, speed: 'normal', timer: 0 };
  const getSet = () => { try { return Object.assign({}, DEF, JSON.parse(ls.get('pzset', '{}'))); } catch (e) { return Object.assign({}, DEF); } };
  const putSet = s => ls.set('pzset', JSON.stringify(s));
  const OPTS = [
    ['moves', 'Moves to find', [['any', 'Any'], ['1', '1'], ['2', '2'], ['3', '3'], ['4+', '4 or more']]],
    ['level', 'Difficulty', [['mixed', 'Any'], ['easy', 'Easy'], ['medium', 'Medium'], ['hard', 'Hard']]],
    ['side', 'You play', [['any', 'Either side'], ['w', 'White'], ['b', 'Black']]],
    ['pieces', 'Board', [['any', 'Any'], ['few', 'Few pieces'], ['many', 'Crowded']]],
    ['source', 'Puzzles from', [['all', 'Everything'], ['gen', 'Generated for me'], ['bank', 'Built-in'], ['mine', 'My puzzles']]],
    ['speed', 'Opponent replies', [['slow', 'Slow'], ['normal', 'Normal'], ['fast', 'Fast']]],
    ['timer', 'Time limit', [[0, 'None'], [30, '30 s'], [60, '1 min'], [120, '2 min'], [300, '5 min']]]
  ];
  const TOGGLES = [['labels', 'Show theme and difficulty'], ['hints', 'Allow hints'], ['rated', 'Puzzles change my rating'], ['auto', 'Go to the next puzzle automatically']];
  const THEMES = ['Mate in 1', 'Mate in 2', 'Mate in 3', 'Win material', 'Fork', 'Hanging piece', 'Pin', 'Skewer', 'Back-rank mate', 'Smothered mate', 'Discovered attack', 'Promotion', 'Sacrifice', 'Endgame', 'My game'];
  const isMate = pos => pos.inCheck() && pos.legal().length === 0;
  const sanLine = p => { const pos = new C.Pos().setFen(p.f), out = []; for (const u of (p.v || [p.s[0]])) { const m = pos.fromUci(u); if (!m) break; out.push(pos.san(m)); pos.make(m); } return out.join(' '); };

  /* ---------- puzzle supply: built-in bank + endless generator + your own ---------- */
  const PZ = (() => {
    let worker = null, buf = [], bank = null, listeners = [], filter = DEF;
    try { buf = JSON.parse(ls.get('chgen', '[]')); } catch (e) { buf = []; }
    const norm = p => { if (!p.v) p.v = [p.s[0]]; if (!p.k) p.k = 1; return p; };
    const tagsFor = p => { try { const pos = new C.Pos().setFen(p.f), m = pos.fromUci(p.s[0]); return m ? C.themes(pos, m) : []; } catch (e) { return []; } };
    const getBank = () => bank || (bank = (window.CHESS_PUZZLES || []).map(p => norm(Object.assign({}, p, { g: p.g || tagsFor(p), src: 'bank' }))));
    const loadMine = () => { try { return JSON.parse(ls.get('chmine', '[]')).map(norm); } catch (e) { return []; } };
    const saveMine = a => ls.set('chmine', JSON.stringify(a.slice(-200)));
    const pcs = f => (f.split(' ')[0].match(/[a-zA-Z]/g) || []).length;
    const match = (p, f) => {
      norm(p); const mt = /^Mate in (\d)/.exec(p.t || ''); if (mt && p.k !== +mt[1]) return false;   /* an old puzzle whose solution line is missing: never show a "mate in 3" that ends after one move */
      if (f.level && f.level !== 'mixed' && p.l !== f.level) return false;
      if (f.moves && f.moves !== 'any') { if (f.moves === '4+') { if (p.k < 4) return false; } else if (p.k !== +f.moves) return false; }
      if (f.side && f.side !== 'any' && p.f.split(' ')[1] !== f.side) return false;
      if (f.pieces === 'few' && pcs(p.f) > 8) return false; if (f.pieces === 'many' && pcs(p.f) < 20) return false;
      const th = f.themes || []; if (th.length && !th.some(t => (/^Mate in/.test(t) || t === 'Win material') ? p.t === t : (p.g || []).includes(t))) return false;
      return true;
    };
    const key = p => p.f.split(' ').slice(0, 2).join(' ');
    const save = () => ls.set('chgen', JSON.stringify(buf.slice(-100)));
    const kRange = f => f.moves === '4+' ? [4, 6] : f.moves && f.moves !== 'any' ? [+f.moves, +f.moves] : [1, 4];
    const genNeeded = f => f.source === 'all' || f.source === 'gen';
    function ensure() {
      if (worker) return; try { worker = new Worker('/web/js/chess-gen.js'); } catch (e) { worker = null; return; }
      worker.onmessage = e => { const d = e.data; if (d.type !== 'puz') return; if (buf.some(p => p.f === d.p.f)) return; d.p.src = 'gen'; buf.push(d.p); if (buf.length > 120) buf.shift(); save(); const s = store(); s.puz.made++; put(s); update(); listeners.splice(0).forEach(fn => fn()); };
    }
    function update() { if (!worker) return; const need = genNeeded(filter) && buf.filter(p => match(p, filter) && !store().seen[key(p)]).length < 6, r = kRange(filter); worker.postMessage(need ? { cmd: 'go', minK: r[0], maxK: r[1] } : { cmd: 'pause' }); }
    const pool = (f, seen) => {
      const g = buf.filter(p => match(p, f) && !seen[key(p)]), b = getBank().filter(p => match(p, f) && !seen[key(p)]), m = loadMine().filter(p => match(p, f));
      if (f.source === 'gen') return { list: g, from: 'buf' }; if (f.source === 'bank') return { list: b, from: 'bank' }; if (f.source === 'mine') return { list: m, from: 'mine' };
      return g.length ? { list: g, from: 'buf' } : { list: b.concat(m), from: 'bank' };
    };
    return {
      use(f) { filter = f || DEF; if (genNeeded(filter)) { ensure(); update(); } else if (worker) update(); },
      stop() { if (worker) { worker.terminate(); worker = null; } },
      take(f) {
        const seen = store().seen, r = pool(f, seen); if (!r.list.length) return null; const p = r.list[Math.random() * r.list.length | 0];
        if (r.from === 'buf') { buf = buf.filter(x => x !== p); save(); } if (r.from !== 'mine') { const s = store(); s.seen[key(p)] = 1; put(s); } update(); return p;
      },
      count(f) { const seen = store().seen; return buf.filter(p => match(p, f) && !seen[key(p)]).length + getBank().filter(p => match(p, f) && !seen[key(p)]).length + loadMine().filter(p => match(p, f)).length; },
      wait(fn) { listeners.push(fn); }, unwait(fn) { listeners = listeners.filter(x => x !== fn); }, update,
      isMine: p => loadMine().some(x => x.f === p.f), mineCount: () => loadMine().length,
      addMine(p) { const a = loadMine().filter(x => x.f !== p.f); a.push(Object.assign({}, p, { src: 'mine' })); saveMine(a); }, removeMine(p) { saveMine(loadMine().filter(x => x.f !== p.f)); },
      reset() { const s = store(); s.seen = {}; put(s); }
    };
  })();

  function PuzzleRunner(host, o) {
    const drill = !!o.n; let S = drill ? Object.assign({}, DEF, { themes: o.theme && o.theme !== 'Mixed' ? [o.theme] : [], level: o.level || 'mixed' }) : getSet();
    let board, p = null, ply = 0, mode = 'pv', made = 0, busy = false, solved = false, fails = 0, usedHint = false, count = 0, waiting = null, tmr = null, tick = null, tleft = 0, dead = false, eng = null;
    const E = () => eng || (eng = Eng());
    host.innerHTML = '<div class="acw"><div><div id="pzb"></div><div class="row small mute" style="margin-top:6px;justify-content:space-between;width:calc(var(--csz,56px)*8)"><span id="pzprog"></span><b id="pztime" style="color:var(--warn)"></b></div></div><div class="acside"><div class="card" style="margin:0"><div class="row" style="justify-content:space-between"><b>Puzzle rating</b><b id="pzr" style="color:var(--acc2)"></b></div><div class="small mute" id="pzs"></div>' +
      (drill ? '<div class="small" style="margin-top:6px">Drill: <b id="pzd"></b> <span class="mute">(' + esc(o.theme || 'Mixed') + ')</span></div>' : '<div class="small mute" style="margin-top:6px" id="pzsum"></div>') + '</div>' +
      (drill ? '' : '<details id="pzset" class="card" style="margin:0"><summary style="cursor:pointer;font-weight:600">⚙ Customize puzzles</summary><div id="pzopts" style="margin-top:8px"></div></details>') +
      '<div class="acmsg" id="pzm"></div><div class="row" style="gap:6px;flex-wrap:wrap"><button class="ib" id="pzh">Hint</button><button class="ib" id="pzv">Show solution</button><button class="ib" id="pzsv">☆ Save</button><button class="pri" id="pzn">Next puzzle</button></div><div class="small mute" id="pzf"></div>' + (drill ? '' : '<div class="row" style="gap:6px;flex-wrap:wrap"><button class="ib" id="pzc">➕ Create a puzzle from a position</button></div>') + '</div></div>';
    const $$ = id => host.querySelector('#' + id); board = new Board($$('pzb'));
    const stats = () => { const d = store().puz; $$('pzr').textContent = Math.round(d.rating); $$('pzs').textContent = d.solved + ' solved · streak ' + d.streak + ' · best ' + d.best + ' · ' + d.made + ' generated for you'; o.api.hud('Puzzle rating ' + Math.round(d.rating)); if (drill) $$('pzd').textContent = Math.min(count, o.n) + ' of ' + o.n + ' solved'; else { const n = PZ.count(S); $$('pzsum').textContent = (n >= 100 ? '100+' : n) + ' puzzle' + (n === 1 ? '' : 's') + ' ready for these settings (more are generated as you go)'; } };
    const msg = (html, cls) => { const m = $$('pzm'); m.className = 'acmsg ' + (cls || ''); m.innerHTML = html; };
    const prog = () => { $$('pzprog').textContent = p ? (p.k > 1 ? 'Solution is ' + p.k + ' moves long · you have played ' + made : 'Find the best move') : ''; };
    const hintBtns = () => { $$('pzh').style.display = S.hints ? '' : 'none'; $$('pzv').textContent = S.hints ? 'Show solution' : 'Give up'; const sv = $$('pzsv'); sv.textContent = p && PZ.isMine(p) ? '★ Saved' : '☆ Save'; };
    /* ----- customize panel ----- */
    function drawOpts() {
      if (drill) return; const c = (k, v, label, on) => '<span class="chip" data-k="' + k + '" data-v="' + esc(String(v)) + '" style="' + (on ? 'background:var(--acc);color:var(--onacc);border-color:var(--acc)' : '') + '">' + esc(label) + '</span>';
      $$('pzopts').innerHTML = OPTS.map(op => '<div class="small mute" style="margin-top:8px">' + op[1] + '</div><div class="chips" style="margin-top:3px">' + op[2].map(x => c(op[0], x[0], x[1], String(S[op[0]]) === String(x[0]))).join('') + '</div>').join('') +
        '<div class="small mute" style="margin-top:8px">Themes <span style="opacity:.7">(pick any; none means every theme)</span></div><div class="chips" style="margin-top:3px">' + THEMES.map(t => '<span class="chip" data-th="' + esc(t) + '" style="' + (S.themes.includes(t) ? 'background:var(--acc);color:var(--onacc);border-color:var(--acc)' : '') + '">' + esc(t) + '</span>').join('') + '</div>' +
        '<div style="margin-top:10px">' + TOGGLES.map(t => '<label class="chk small" style="margin:3px 0"><input type="checkbox" data-tg="' + t[0] + '"' + (S[t[0]] ? ' checked' : '') + '> ' + t[1] + '</label>').join('') + '</div><div class="row" style="margin-top:8px"><button class="ib" id="pzreset">Reset to defaults</button></div>';
    }
    if (!drill) {
      $$('pzopts').onclick = e => {
        const c = e.target.closest('.chip'); if (c) { if (c.dataset.k) { const k = c.dataset.k; S[k] = k === 'timer' ? +c.dataset.v : c.dataset.v; } else { const t = c.dataset.th, i = S.themes.indexOf(t); if (i >= 0) S.themes.splice(i, 1); else S.themes.push(t); } putSet(S); drawOpts(); next(); return; }
        if (e.target.id === 'pzreset') { S = Object.assign({}, DEF, { themes: [] }); putSet(S); drawOpts(); next(); }
      };
      $$('pzopts').onchange = e => { const t = e.target.dataset && e.target.dataset.tg; if (!t) return; S[t] = e.target.checked; putSet(S); hintBtns(); if (t === 'hints' || t === 'labels') { /* applies to the next puzzle */ } };
      $$('pzset').ontoggle = () => { }; drawOpts();
    }
    /* ----- one puzzle ----- */
    const delay = () => ({ slow: 1100, normal: 650, fast: 250 }[S.speed] || 650);
    const sleep = ms => new Promise(r => setTimeout(r, ms));
    const clearTimers = () => { clearTimeout(tmr); clearInterval(tick); tick = null; $$('pztime').textContent = ''; };
    const rate = win => { if (!S.rated) return; const d = store(), pz = d.puz, pr = { easy: 900, medium: 1300, hard: 1700 }[p.l] || 1200, ex = 1 / (1 + Math.pow(10, (pr - pz.rating) / 400)); pz.rating = Math.max(400, pz.rating + 24 * ((win ? 1 : 0) - ex)); if (win) { pz.solved++; pz.streak++; pz.best = Math.max(pz.best, pz.streak); } else pz.streak = 0; put(d); o.api.submit(Math.round(pz.rating)); stats(); };
    function startTimer() { clearInterval(tick); if (!S.timer || drill) return; tleft = S.timer; const show = () => { $$('pztime').textContent = '⏱ ' + Math.floor(tleft / 60) + ':' + String(tleft % 60).padStart(2, '0'); }; show(); tick = setInterval(() => { if (solved || dead) return clearInterval(tick); tleft--; show(); if (tleft <= 0) { clearInterval(tick); timeUp(); } }, 1000); }
    function load(pz) {
      p = pz; ply = 0; mode = 'pv'; made = 0; busy = false; solved = false; fails = 0; usedHint = false; const pos = new C.Pos().setFen(p.f);
      board.set(p.f, { who: pos.side, flipped: pos.side < 0 });
      const lab = S.labels ? '<div class="small mute" style="margin-top:4px">' + esc(p.t) + ' · ' + p.l + (p.k > 1 ? ' · ' + p.k + ' moves' : '') + (p.g && p.g.length ? ' · ' + esc(p.g.filter(x => x !== 'Mate' && x !== 'Check').slice(0, 2).join(', ')) : '') + '</div>' : '';
      msg('<b>' + sideName(pos.side) + ' to move.</b> ' + (p.k > 1 ? 'Find the winning line: you will need <b>' + p.k + ' moves</b>.' : 'Find the best move.') + lab); $$('pzn').disabled = false; prog(); hintBtns(); startTimer(); stats();
      $$('pzf').textContent = 'Puzzles are generated endlessly on this PC, no internet needed.';
    }
    function next() {
      if (dead) return; if (waiting) { PZ.unwait(waiting); waiting = null; } clearTimers(); PZ.use(S); const pz = PZ.take(S);
      if (!pz) {
        board.set(C.START, { who: 0 }); $$('pzn').disabled = true; p = null; prog(); stats();
        if (S.source === 'mine') { msg('<b>No saved puzzles match.</b><div class="small mute">Press <b>☆ Save</b> on any puzzle, or <b>➕ Create a puzzle</b>, or change "Puzzles from" in Customize.</div>'); return; }
        if (S.source === 'bank') { msg('<b>You have solved every built-in puzzle that matches.</b><div class="small mute">Switch "Puzzles from" to Everything or Generated to get new ones.</div>'); return; }
        msg('<b>Finding a fresh ' + (S.themes.length ? esc(S.themes.join(' / ')) + ' ' : '') + (S.moves !== 'any' ? S.moves + '-move ' : '') + 'puzzle...</b><div class="small mute">Moundshroud is playing games against itself and searching them for a tactic that fits. This can take a few seconds' + (S.themes.some(t => ['Pin', 'Skewer', 'Smothered mate'].includes(t)) || S.moves === '4+' || S.moves === '3' ? ' (your settings are rare, so it may take longer)' : '') + '.</div>');
        waiting = () => { waiting = null; next(); }; PZ.wait(waiting); tmr = setTimeout(() => { if (waiting && !dead) $$('pzm').innerHTML += '<div class="small" style="margin-top:6px">Still searching. Loosen a setting in Customize and Moundshroud will find one sooner.</div>'; }, 25000); return;
      }
      load(pz);
    }
    const finish = () => { solved = true; busy = false; board.who = 0; clearTimers(); $$('pzn').disabled = false; };
    const success = san => {
      const clean = fails === 0 && !usedHint; rate(clean); count++; stats(); finish(); ev('puzzle', { streak: store().puz.streak, rating: store().puz.rating, k: p.k, level: p.l, clean, timer: S.timer > 0 && !drill, themes: p.g, t: p.t }); try { ChessFx.sparkle($$('pzb')); } catch (e) { }
      msg('✅ <b>Solved!</b> ' + esc(sanLine(p)) + ' &mdash; ' + esc(p.t === 'Win material' ? 'this wins material.' : p.t + '.') + (clean || !S.rated ? '' : '<div class="small mute">Solved with help or after mistakes, so no rating gain.</div>'), 'ok'); prog();
      if (drill && count >= o.n) { msg($$('pzm').innerHTML + '<div style="margin-top:6px"><b>Drill complete!</b></div>', 'ok'); o.onDone && o.onDone(); }
      else if (S.auto && !drill) tmr = setTimeout(next, 1600);
    };
    async function liveOk(m) {
      try { const r = await E().ask({ cmd: 'eval', fen: board.pos.fen(), depth: 5, ms: 4000 }); const sc = r.scores || []; if (!sc.length) return true; const best = sc[0][1], mine = sc.find(x => x[0] === m); return !!mine && (mine[1] >= best - 60 || (mine[1] > C.MATE - 60 && best > C.MATE - 60)); } catch (e) { return true; }
    }
    function wrong(m) { fails++; busy = false; board.shake(); board.sel = -1; board.targets = []; board.draw(); msg('❌ <b>' + esc(board.pos.san(m)) + '</b> is not the best move here. Try again' + (S.hints ? ', or use Hint.' : '.'), 'no'); if (fails === 1) { const d = store(); d.puz.streak = 0; put(d); stats(); } }
    board.onmove = async m => {
      if (solved || !p || busy) return; const u = board.pos.uci(m); let good = false;
      if (mode === 'pv') {
        if (ply === 0) { good = p.s.includes(u); if (good && u !== p.v[0]) mode = 'live'; }
        else if (u === p.v[ply]) good = true;
        else { busy = true; msg('Checking your move...'); good = await liveOk(m); busy = false; if (good) mode = 'live'; }
      } else { busy = true; msg('Checking your move...'); good = await liveOk(m); busy = false; }
      if (dead) return; if (!good) return wrong(m);
      const san = board.pos.san(m); board.play(m); made++; ply++; prog();
      const done = mode === 'pv' ? ply >= p.v.length : (isMate(board.pos) || made >= p.k);
      if (done) return success(san);
      msg('✅ <b>' + esc(san) + '</b> - correct, keep going! <span class="mute">(move ' + (made + 1) + ' of ' + p.k + ')</span>'); busy = true; board.who = 0; await sleep(delay()); if (dead) return;
      let rm; const l = board.pos.legal();
      if (mode === 'pv') rm = board.pos.fromUci(p.v[ply], l); else { try { const r = await E().ask({ fen: board.pos.fen(), elo: 2400, ms: 700 }); rm = l.find(x => x === r.move); } catch (e) { } rm = rm == null ? l[0] : rm; }
      if (rm == null) return success(san); board.play(rm); ply++; busy = false; board.who = board.pos.side; msg('<b>' + sideName(board.pos.side) + ' to move.</b> Your next move <span class="mute">(move ' + (made + 1) + ' of ' + p.k + ')</span>.');
    };
    async function timeUp() { if (solved) return; fails++; rate(false); await showSolution('⏱ <b>Time is up.</b> '); }
    async function showSolution(prefix) {
      if (!p) return; busy = true; board.who = 0; clearTimers(); board.set(p.f, { who: 0, flipped: new C.Pos().setFen(p.f).side < 0 });
      for (const u of p.v) { await sleep(650); if (dead) return; const m = board.pos.fromUci(u); if (!m) break; board.play(m); }
      msg((prefix || '') + 'The solution was <b>' + esc(sanLine(p)) + '</b> (' + esc(p.t) + ').'); finish();
    }
    $$('pzh').onclick = async () => {
      if (solved || !p || busy || !S.hints) return; usedHint = true; board.marks = {};
      if (mode === 'pv' && p.v[ply]) board.marks[C.sqIndex(p.v[ply].slice(0, 2))] = 'hint'; else { try { const r = await E().ask({ cmd: 'eval', fen: board.pos.fen(), depth: 5, ms: 3000 }); if (r.best != null) board.marks[r.best & 63] = 'hint'; } catch (e) { } } board.draw();
    };
    $$('pzv').onclick = async () => { if (solved || !p || busy) return; rate(false); await showSolution(''); };
    $$('pzsv').onclick = () => { if (!p) return; if (PZ.isMine(p)) PZ.removeMine(p); else { PZ.addMine(p); ev('puzzle_saved'); } hintBtns(); if (!drill) stats(); };
    /* skipping a puzzle you do not fancy used to be impossible (the button stayed disabled until you solved it or gave up).
       It now works at any time, and counts as a miss so the rating stays honest. */
    $$('pzn').onclick = () => { if (p && !solved && !busy) { rate(false); ev('puzzle_skip'); } next(); };
    if (!drill) $$('pzc').onclick = () => {
      A.dlg('<div class="hd"><b>Create a puzzle</b></div><div class="bd"><p class="small mute" style="margin-top:0">Paste a position as a FEN string (for example from a game or a book). Moundshroud finds the best line and turns it into a puzzle you can solve and save to <b>My puzzles</b>.</p><input id="cfen" type="text" placeholder="e.g. r3k3/8/4N3/8/8/8/8/4K3 w - - 0 1" style="font-family:monospace"><div class="row" style="margin-top:8px;gap:8px;flex-wrap:wrap"><label class="small mute">Longest solution <select id="cmax"><option value="4">Up to 4 moves</option><option value="1">1 move</option><option value="2">Up to 2 moves</option><option value="3">Up to 3 moves</option></select></label></div><div id="cmsg" class="small" style="margin-top:8px;min-height:20px"></div><div class="row" style="margin-top:10px"><button class="ib" id="cx">Cancel</button><span class="sp"></span><button class="pri" id="cgo">Build puzzle</button></div></div>');
      $('cx').onclick = A.closeDlg; $('cfen').focus();
      $('cgo').onclick = async () => {
        const fen = $('cfen').value.trim().replace(/\s+/g, ' '); const bd = (fen.split(' ')[0] || '').split('/'); const ok = bd.length === 8 && bd.every(r => { let n = 0; for (const ch of r) n += /\d/.test(ch) ? +ch : 1; return n === 8; }) && (fen.split(' ')[0].match(/K/g) || []).length === 1 && (fen.split(' ')[0].match(/k/g) || []).length === 1;
        if (!ok) { $('cmsg').innerHTML = '<span class="bad">That does not look like a valid position (it needs 8 ranks and exactly one king each).</span>'; return; }
        const pos = new C.Pos().setFen(fen.split(' ').length < 2 ? fen + ' w - - 0 1' : fen); if (pos.attacked(pos.ksq[pos.side > 0 ? 1 : 0], pos.side)) { $('cmsg').innerHTML = '<span class="bad">The side that is not to move is in check, so this position is not legal.</span>'; return; }
        $('cmsg').textContent = 'Analysing...'; $('cgo').disabled = true; let r; try { r = await E().ask({ cmd: 'puzzle', fen: pos.fen(), force: true, maxK: +$('cmax').value }); } catch (e) { }
        const pz = r && r.puzzle; if (!pz) { $('cmsg').innerHTML = '<span class="bad">There is no legal move in that position.</span>'; $('cgo').disabled = false; return; }
        pz.src = 'mine'; pz.g = (pz.g || []).concat(['My game']).filter((x, i, a) => a.indexOf(x) === i); PZ.addMine(pz); ev('puzzle_created'); A.closeDlg(); A.toast('Saved to My puzzles'); if (waiting) { PZ.unwait(waiting); waiting = null; } clearTimers(); load(pz);
      };
    };
    next();
    return { destroy() { dead = true; clearTimers(); if (waiting) PZ.unwait(waiting); if (eng) eng.kill(); board.destroy(); } };
  }

  /* ---------- line trainer (openings and famous games) ---------- */
  function LineTrainer(host, items, o) {
    let board, it, idx, mode, moves, timer, dead = false;
    const list = () => {
      if (board) { board.destroy(); board = null; } const st = store();
      const sect = (c, title) => { const l = A.az(items.filter(x => x.c === c), x => x.name); return l.length ? '<h3>' + title + '</h3><div class="acg">' + l.map(x => '<div class="card" data-o="' + x.id + '"><b>' + (st.ops[o.pre + x.id] ? '✅ ' : '') + esc(x.name) + '</b><div class="small mute">' + esc(x.who || x.idea.split('. ')[0] + '.') + '</div></div>').join('') + '</div>' : ''; };
      host.innerHTML = '<p class="mute small" style="margin:0 0 10px">' + o.intro + '</p>' + o.sections.map(s => sect(s[0], s[1])).join(''); host.onclick = e => { const c = e.target.closest('[data-o]'); if (c) open(c.dataset.o); };
    };
    const open = id => {
      it = items.find(x => x.id === id); host.onclick = null; moves = []; const p = new C.Pos().setFen(C.START); it.m.split(' ').forEach(t => { const m = p.fromSan(t); moves.push({ m, san: t, uci: p.uci(m) }); p.make(m); }); idx = 0; mode = 'learn';
      host.innerHTML = '<div class="row" style="margin-bottom:8px"><button class="ib" id="oback">&larr; ' + o.back + '</button><b style="flex:1;margin-left:6px">' + esc(it.name) + ' <span class="small mute">(you play ' + (it.c > 0 ? 'White' : 'Black') + ')</span></b></div><div class="acw"><div id="ob"></div><div class="acside"><div class="row" style="gap:6px"><button class="ib on" id="om1">Learn</button><button class="ib" id="om2">Practise</button></div><div class="acmsg" id="omsg"></div><div class="chml small" id="oml" style="background:var(--panel);border:1px solid var(--line);border-radius:10px;padding:8px 10px;line-height:1.9;max-height:220px;overflow:auto"></div><div class="row" style="gap:6px;flex-wrap:wrap" id="oct"></div></div></div>';
      board = new Board(host.querySelector('#ob')); const q = id => host.querySelector('#' + id); q('oback').onclick = list; q('om1').onclick = () => start('learn'); q('om2').onclick = () => start('practise'); start('learn');
    };
    const q = id => host.querySelector('#' + id);
    const note = () => (it.notes && it.notes[idx]) ? '<div style="margin-top:6px">💬 ' + esc(it.notes[idx]) + '</div>' : '';
    const line = () => { q('oml').innerHTML = moves.map((x, i) => (i % 2 === 0 ? '<b class="mute">' + (i / 2 + 1) + '.</b> ' : '') + '<span style="' + (i < idx ? 'color:var(--text)' : 'color:var(--mute)') + (mode === 'learn' && i === idx - 1 ? ';background:var(--acc);color:var(--onacc);border-radius:4px;padding:0 4px' : '') + '">' + (mode === 'practise' && i >= idx ? '…' : x.san) + '</span>').join(' '); const m = q('oml'); m.scrollTop = m.scrollHeight; };
    const start = m => {
      clearTimeout(timer); mode = m; idx = 0; q('om1').classList.toggle('on', m === 'learn'); q('om2').classList.toggle('on', m === 'practise'); board.set(C.START, { who: 0, flipped: it.c < 0 });
      if (m === 'learn') {
        q('omsg').className = 'acmsg'; q('omsg').innerHTML = '<b>' + (o.pre === 'g-' ? 'The story:' : 'Idea:') + '</b> ' + esc(it.idea) + '<div class="small mute" style="margin-top:6px">Step through the moves with the buttons.</div>'; q('oct').innerHTML = '<button class="ib" id="o0">⏮</button><button class="ib" id="op">◀</button><button class="pri" id="on">▶ Next move</button><button class="ib" id="oa">Auto-play</button>';
        const fwd = () => { if (idx < moves.length) { board.play(moves[idx].m); idx++; line(); q('omsg').innerHTML = (idx === moves.length ? '<b>End of the ' + o.noun + '.</b> ' : '') + '<b>' + Math.ceil(idx / 2) + (idx % 2 ? '.' : '...') + ' ' + esc(moves[idx - 1].san) + '</b>' + note(); return true; } return false; };
        q('o0').onclick = () => { clearTimeout(timer); idx = 0; board.set(C.START, { who: 0, flipped: it.c < 0 }); line(); }; q('op').onclick = () => { clearTimeout(timer); if (idx) { idx--; board.undo(); line(); } }; q('on').onclick = () => { clearTimeout(timer); fwd(); };
        q('oa').onclick = () => { clearTimeout(timer); const go = () => { if (dead || !fwd()) return; timer = setTimeout(go, it.notes && it.notes[idx] ? 3200 : 1100); }; go(); };
      } else {
        q('omsg').className = 'acmsg'; q('omsg').innerHTML = 'Play the ' + (it.c > 0 ? 'White' : 'Black') + ' moves from memory. The opponent replies automatically.'; q('oct').innerHTML = '<button class="ib" id="oh">Hint</button><button class="ib" id="or">Restart</button>'; q('oh').onclick = () => { if (idx < moves.length) { board.marks = {}; board.marks[moves[idx].m & 63] = 'hint'; board.draw(); } }; q('or').onclick = () => start('practise');
        board.onmove = mv => { const x = moves[idx]; if (board.pos.uci(mv) === x.uci) { board.play(mv); idx++; line(); step(); } else { board.shake(); board.sel = -1; board.targets = []; board.draw(); q('omsg').className = 'acmsg no'; q('omsg').innerHTML = '❌ That is not the move played here. Try again, or press Hint.'; } }; step();
      }
      line();
    };
    const step = () => {
      if (idx >= moves.length) { board.who = 0; const st = store(), fresh = !st.ops[o.pre + it.id]; st.ops[o.pre + it.id] = 1; put(st); ev(o.pre === 'g-' ? 'famous' : 'opening', { fresh }); try { ChessFx.confetti({ n: 50 }); } catch (e) { } q('omsg').className = 'acmsg ok'; q('omsg').innerHTML = '✅ <b>You played the whole ' + o.noun + '.</b>' + note(); line(); return; }
      const turn = idx % 2 === 0 ? 1 : -1; const nt = note();
      if (turn === it.c) { board.who = it.c; q('omsg').className = 'acmsg'; q('omsg').innerHTML = 'Your move.' + nt; } else { board.who = 0; timer = setTimeout(() => { if (dead || mode !== 'practise' || !board) return; board.play(moves[idx].m); idx++; line(); step(); }, 600); }
    };
    list(); return { open, destroy() { dead = true; clearTimeout(timer); if (board) board.destroy(); } };
  }

  /* shared with chess-play.js, chess-analyze-ui.js and chess-coach.js */
  const ChessUI = window.ChessUI = { Board, Eng, store, put, GL, sideName, PZ, sanLine, sections: {}, pending: null, pendingGame: null, openGame: id => { ChessUI.pendingGame = id; if (ChessUI.show) ChessUI.show('games'); } };

  P.games.chess = {
    name: 'Chess', icon: '♟️', desc: 'Play Moundshroud at any strength, learn with courses, endless puzzles, famous games, then analyze any game (even your own PGN) with an AI coach.',
    mount(el, api) {
      el.innerHTML = '<div style="width:100%;max-width:1240px"><div class="row" id="actabs" style="gap:6px;flex-wrap:wrap;margin-bottom:12px"></div><div id="acbody"></div></div>';
      const TABS = [['play', '♟ Play'], ['online', '🌐 Online'], ['lichess', '♞ Lichess'], ['scan', '📷 Scan'], ['daily', '📅 Daily'], ['clubs', '👥 Clubs'], ['community', '🗣 Community'], ['tourney', '🏟 Tournament'], ['profile', '👤 Profile'], ['analysis', '🔬 Analysis'], ['coach', '🧑‍🏫 Coach'], ['courses', '📘 Courses'], ['puzzles', '🧩 Puzzles'], ['rush', '⚡ Rush'], ['explorer', '🧭 Explorer'], ['lab', '🧠 Engine Lab'], ['career', '🏆 Career'], ['openings', '📖 Openings'], ['games', '🏆 Famous games'], ['endgames', '🏁 Endgames'], ['minis', '🎮 Mini-games'], ['trophies', '🏅 Trophies'], ['books', '📚 Books'], ['history', '🏛 History'], ['settings', '⚙ Board settings']];
      let tab = ls.get('actab', 'play'), cleanup = null; if (tab === 'lessons') tab = 'courses'; if (tab === 'review') tab = 'analysis'; const $b = () => document.getElementById('acbody');
      const show = t => { if (window.ChessFair && ChessFair.live && t !== 'lichess') { A.toast('A Lichess game is being played, so the other chess sections (which have engines) stay shut until it ends.', 4200); if (tab === 'lichess') return; t = 'lichess'; }   /* fair play: see chess-lichess.js */
        if (cleanup) { try { cleanup(); } catch (e) { } cleanup = null; } tab = t; ls.set('actab', t); document.getElementById('actabs').innerHTML = TABS.map(x => '<button class="ib' + (x[0] === t ? ' on' : '') + '" data-t="' + x[0] + '">' + x[1] + '</button>').join(''); api.hud(''); cleanup = SEC[t]($b()); };
      ChessUI.show = show; ChessUI.api = api;
      document.getElementById('actabs').onclick = e => { const b = e.target.closest('[data-t]'); if (b) show(b.dataset.t); };

      const SEC = {
        /* ---------------- courses ---------------- */
        courses(host) {
          let board = null, runner = null, cur = null, mk = null, tms = [];
          const clearTms = () => { tms.forEach(clearTimeout); tms = []; };
          const clean = () => { clearTms(); if (runner) { runner.destroy(); runner = null; } if (board) { board.destroy(); board = null; } };
          const home = () => {
            clean(); const st = store(), total = COURSES.reduce((a, c) => a + c.lessons.length, 0), done = COURSES.reduce((a, c) => a + c.lessons.filter(l => st.lessons[c.id + '/' + l.id]).length, 0);
            host.onclick = e => { const c = e.target.closest('[data-c]'); if (c) course(c.dataset.c); };
            host.innerHTML = '<p class="mute small" style="margin:0 0 10px">' + COURSES.length + ' courses, ' + total + ' lessons. You play the key moves yourself, answer quick quizzes, and finish many lessons with endless puzzles on that theme. ' + done + ' of ' + total + ' lessons completed.</p><div class="acg">' + COURSES.map(c => { const n = c.lessons.filter(l => st.lessons[c.id + '/' + l.id]).length, pct = Math.round(n / c.lessons.length * 100); return '<div class="card" data-c="' + c.id + '"><div style="font-size:26px">' + c.icon + '</div><b>' + esc(c.title) + '</b><div class="small mute">' + esc(c.level) + ' · ' + c.lessons.length + ' lessons</div><div class="small" style="margin:6px 0">' + esc(c.blurb) + '</div><div class="bar"><i style="width:' + pct + '%"></i></div><div class="small mute" style="margin-top:3px">' + n + ' of ' + c.lessons.length + ' done</div></div>'; }).join('') + '</div>';
          };
          const course = id => {
            clean(); const c = COURSES.find(x => x.id === id), st = store(); cur = { c }; const firstTodo = c.lessons.findIndex(l => !st.lessons[c.id + '/' + l.id]);
            host.onclick = e => { if (e.target.closest('#cback')) return home(); const l = e.target.closest('[data-l]'); if (l) lesson(c, +l.dataset.l); };
            host.innerHTML = '<div class="row" style="margin-bottom:8px"><button class="ib" id="cback">&larr; All courses</button><b style="flex:1;margin-left:6px">' + c.icon + ' ' + esc(c.title) + '</b><span class="small mute">' + esc(c.level) + '</span></div><p class="mute small" style="margin:0 0 10px">' + esc(c.blurb) + '</p><div class="acg">' + c.lessons.map((l, i) => '<div class="card" data-l="' + i + '"' + (i === firstTodo ? ' style="border-color:var(--acc)"' : '') + '><b>' + (st.lessons[c.id + '/' + l.id] ? '✅ ' : (i + 1) + '. ') + esc(l.title) + '</b><div class="small mute">' + l.steps.length + ' step' + (l.steps.length > 1 ? 's' : '') + (i === firstTodo ? ' · up next' : '') + '</div></div>').join('') + '</div>';
          };
          const lesson = (c, i) => {
            clean(); cur = { c, i, l: c.lessons[i], s: 0 }; host.onclick = null;
            host.innerHTML = '<div class="row" style="margin-bottom:8px"><button class="ib" id="lback">&larr; ' + esc(c.title) + '</button><b style="flex:1;margin-left:6px" id="ltitle"></b><span class="acdots" id="ldots"></span></div><div class="acw"><div id="lb"></div><div class="acside" id="lside"><div id="lmk"></div><div class="acmsg" id="lmsg"></div><div id="lx"></div><div class="row" style="gap:6px"><button class="ib" id="lprev">Back</button><button class="pri" id="lnext">Next</button></div></div></div>';
            board = new Board(host.querySelector('#lb')); try { mk = ChessFx.mascot(host.querySelector('#lmk')); mk.say(null, 'start'); } catch (e) { mk = null; } host.querySelector('#lback').onclick = () => course(c.id);
            host.querySelector('#lprev').onclick = () => { if (cur.s) { cur.s--; step(); } };
            host.querySelector('#lnext').onclick = () => { if (cur.s < cur.l.steps.length - 1) { cur.s++; step(); } else { const st = store(), key = c.id + '/' + cur.l.id, fresh = !st.lessons[key]; st.lessons[key] = 1; put(st); if (fresh) { ev('lesson'); try { ChessFx.confetti({ n: 60 }); } catch (e) { } if (c.lessons.every(l => st.lessons[c.id + '/' + l.id])) ev('course'); } if (cur.i < c.lessons.length - 1) { A.toast('Lesson complete! Next: ' + c.lessons[cur.i + 1].title); lesson(c, cur.i + 1); } else { A.toast('Course complete: ' + c.title + '!'); course(c.id); } } };
            step();
          };
          /* guided line: step through the moves with Capablanca's comments */
          const moveText = (s, n) => { const fp = s.f.split(' '); let num = +fp[5] || 1, white = fp[1] !== 'b', out = []; s.san.forEach((m, i) => { let pre = ''; if (white) pre = num + '. '; else if (i === 0) pre = num + '... '; out.push('<span style="' + (i < n ? 'color:var(--text)' : 'color:var(--mute)') + (i === n - 1 ? ';background:var(--acc);color:var(--onacc);border-radius:4px;padding:0 4px' : '') + '">' + pre + esc(m) + '</span>'); if (!white) num++; white = !white; }); return out.join(' '); };
          const lineStep = (s, q, msg, bhost) => {
            bhost.style.display = ''; const p0 = new C.Pos().setFen(s.f); board.set(s.f, { who: 0, flipped: false, hl: s.hl }); q('lnext').disabled = false; let n = 0; const total = s.line.length; const notes = s.notes || {};
            q('lx').innerHTML = '<div class="row" style="gap:6px;flex-wrap:wrap"><button class="ib" id="lg0" title="Back to the start">⏮</button><button class="ib" id="lgp" title="Back one move">◀</button><button class="pri" id="lgn">▶ Next move</button><button class="ib" id="lga">Auto-play</button></div><div class="chml small" id="lgm" style="margin-top:8px;background:var(--panel);border:1px solid var(--line);border-radius:10px;padding:8px 10px;line-height:1.9;max-height:200px;overflow:auto"></div>';
            const paint = () => { const note = notes[n] ? '<div style="margin-top:8px;border-top:1px solid var(--line);padding-top:6px">💬 ' + esc(notes[n]) + '</div>' : ''; msg.innerHTML = s.t + (n ? '<div style="margin-top:8px"><b>' + (n === total ? 'End of the line.' : '') + '</b></div>' : '') + note; const m = q('lgm'); m.innerHTML = moveText(s, n); q('lgp').disabled = n === 0; q('lg0').disabled = n === 0; q('lgn').disabled = n === total; };
            const fwd = () => { if (n >= total) return false; const mv = board.pos.fromUci(s.line[n]); if (!mv) return false; board.play(mv); n++; paint(); return true; };
            q('lg0').onclick = () => { clearTms(); n = 0; board.set(s.f, { who: 0, hl: s.hl }); paint(); }; q('lgp').onclick = () => { clearTms(); if (n) { n--; board.undo(); paint(); } }; q('lgn').onclick = () => { clearTms(); fwd(); };
            q('lga').onclick = () => { clearTms(); const go = () => { if (!board || !fwd()) return; tms.push(setTimeout(go, notes[n] ? 3600 : 1100)); }; go(); };
            paint();
          };
          /* a puzzle taken from the book: you play one side of the line, the other side answers automatically */
          const solveStep = (s, q, msg, bhost) => {
            bhost.style.display = ''; const sv = s.solve, pos0 = new C.Pos().setFen(s.f), me = pos0.side; let k = 0, miss = 0, busy = false;
            board.set(s.f, { who: me, flipped: me < 0, hl: s.hl }); q('lnext').disabled = true; msg.innerHTML = s.t + '<div class="small mute" style="margin-top:6px">' + sideName(me) + ' to move.</div>';
            q('lx').innerHTML = '<div class="row" style="gap:6px"><button class="ib" id="lsh">Show me the answer</button></div>';
            const done = () => { board.who = 0; msg.className = 'acmsg ok'; msg.innerHTML = '✅ <b>Solved.</b> ' + esc(sv.why || '') + (sv.san ? '<div class="small" style="margin-top:6px">The line: ' + esc(sv.san.join(' ')) + '</div>' : ''); try { mk && mk.say(null, 'good'); ChessFx.sparkle(board.el); } catch (e) { } q('lnext').disabled = false; };
            const reply = () => { if (k >= sv.u.length) return done(); busy = true; board.who = 0; tms.push(setTimeout(() => { if (!board) return; const m = board.pos.fromUci(sv.u[k]); if (!m) return done(); board.play(m); k++; busy = false; if (k >= sv.u.length) return done(); board.who = me; board.marks = {}; board.draw(); }, 650)); };
            board.onmove = m => {
              if (busy || k >= sv.u.length) return; const u = board.pos.uci(m); const p = new C.Pos().setFen(board.pos.fen()); p.make(m); const mate = p.inCheck() && !p.legal().length;
              if (u === sv.u[k] || (sv.alt && sv.alt.includes(u) && k === 0) || mate) { board.play(m); msg.className = 'acmsg'; k = u === sv.u[k] ? k + 1 : sv.u.length; miss = 0; if (k >= sv.u.length) return done(); reply(); }
              else { miss++; try { mk && mk.say(null, 'bad'); } catch (e) { } board.shake(); board.sel = -1; board.targets = []; board.marks = {}; if (miss >= 2) board.marks[C.sqIndex(sv.u[k].slice(0, 2))] = 'hint'; board.draw(); msg.className = 'acmsg no'; msg.innerHTML = s.t + '<div style="margin-top:6px">❌ Not that one. ' + (miss >= 2 ? 'Look at the blue square: that piece makes the move.' : 'Try again.') + '</div>'; }
            };
            q('lsh').onclick = () => { clearTms(); busy = true; board.who = 0; const go = () => { if (!board) return; if (k >= sv.u.length) return done(); const m = board.pos.fromUci(sv.u[k]); if (!m) return done(); board.play(m); k++; tms.push(setTimeout(go, 750)); }; go(); };
          };
          const posFor = s => { if (s.m) { const p = new C.Pos().setFen(C.START); let last = null; for (const t of s.m.split(' ')) { const m = p.fromSan(t); if (!m) break; p.make(m); last = [m & 63, (m >> 6) & 63]; } return { fen: p.fen(), last }; } return { fen: s.f, last: null }; };
          const step = () => {
            const q = id => host.querySelector('#' + id), s = cur.l.steps[cur.s]; if (runner) { runner.destroy(); runner = null; } q('lx').innerHTML = '';
            q('ltitle').textContent = cur.l.title; q('ldots').innerHTML = cur.l.steps.map((_, k) => '<i class="' + (k <= cur.s ? 'on' : '') + '"></i>').join('');
            q('lprev').disabled = cur.s === 0; q('lnext').textContent = cur.s === cur.l.steps.length - 1 ? (cur.i < cur.c.lessons.length - 1 ? 'Finish and continue' : 'Finish course') : 'Next';
            clearTms(); const msg = q('lmsg'); msg.className = 'acmsg'; msg.innerHTML = s.t || ''; const bhost = q('lb');
            if (s.drill) {
              bhost.style.display = 'none'; q('lside').style.width = '100%'; q('lside').style.maxWidth = '900px'; q('lnext').disabled = true; const lb = document.createElement('div'); q('lx').appendChild(lb);
              runner = PuzzleRunner(lb, { theme: s.drill.theme, n: s.drill.n, level: s.drill.level, api, onDone: () => { q('lnext').disabled = false; } });
              const sk = document.createElement('button'); sk.className = 'ib'; sk.textContent = 'Skip this drill'; sk.onclick = () => { q('lnext').disabled = false; sk.remove(); }; q('lx').appendChild(sk); return;
            }
            q('lside').style.width = ''; q('lside').style.maxWidth = '';
            if (s.quiz) {
              bhost.style.display = (s.f || s.m) ? '' : 'none'; if (s.f || s.m) { const r = posFor(s); board.set(r.fen, { who: 0, last: r.last }); }
              const qz = s.quiz; q('lx').innerHTML = '<div class="acmsg"><b>' + esc(qz.q) + '</b>' + qz.o.map((o, k) => '<button class="acq" data-k="' + k + '">' + esc(o) + '</button>').join('') + '<div id="qres" style="margin-top:8px"></div></div>'; q('lnext').disabled = true;
              q('lx').onclick = e => { const b = e.target.closest('.acq'); if (!b || b.classList.contains('ok')) return; const k = +b.dataset.k; if (k === qz.a) { ev('quiz'); b.classList.add('ok'); try { ChessFx.pop(b); } catch (e) { } q('qres').innerHTML = '✅ <b>Correct.</b> ' + esc(qz.why); q('lnext').disabled = false; q('lx').querySelectorAll('.acq').forEach(x => { x.disabled = true; }); } else { b.classList.add('no'); q('qres').innerHTML = '❌ Not quite. Try again.'; } };
              return;
            }
            if (s.line) { lineStep(s, q, msg, bhost); return; }
            if (s.solve) { solveStep(s, q, msg, bhost); return; }
            if (s.link && !s.f && !s.m) bhost.style.display = 'none';
            bhost.style.display = s.link && !s.f && !s.m ? 'none' : ''; const r = posFor(s), pos = new C.Pos().setFen(r.fen), who = s.ok ? pos.side : s.ex ? 2 : 0;
            board.set(r.fen, { who, flipped: s.ok ? pos.side < 0 : false, last: r.last, hl: s.hl }); q('lnext').disabled = !!s.ok;
            if (s.ok) msg.innerHTML = s.t + '<div class="small mute" style="margin-top:6px">' + sideName(pos.side) + ' to move.</div>';
            if (s.link) { q('lx').innerHTML = '<button class="pri" id="llink">' + esc(s.link.label) + '</button>'; q('llink').onclick = () => (s.link.game ? ChessUI.openGame(s.link.game) : show(s.link.tab)); }
            const tries = { n: 0 };
            board.onmove = m => {
              if (s.ex) return board.play(m);
              if (!s.ok) return;
              if (s.ok.includes(board.pos.uci(m))) { board.play(m); msg.className = 'acmsg ok'; msg.innerHTML = '✅ <b>Correct.</b> ' + s.why; try { mk && mk.say(null, 'good'); ChessFx.sparkle(board.el); } catch (e) { } q('lnext').disabled = false; board.who = 0; }
              else { tries.n++; try { mk && mk.say(null, 'bad'); } catch (e) { } board.shake(); board.sel = -1; board.targets = []; board.marks = {}; if (tries.n >= 2) board.marks[C.sqIndex(s.ok[0].slice(0, 2))] = 'hint'; board.draw(); msg.className = 'acmsg no'; msg.innerHTML = s.t + '<div style="margin-top:6px">❌ Not that one. ' + (tries.n >= 2 ? 'Look at the blue square: that piece makes the move.' : 'Try again.') + '</div>'; }
            };
          };
          home(); return () => clean();
        },

        /* ---------------- puzzles ---------------- */
        puzzles(host) { const r = PuzzleRunner(host, { api }); return () => { r.destroy(); PZ.stop(); }; },

        /* ---------------- openings / famous games ---------------- */
        openings(host) { const t = LineTrainer(host, S.openings, { pre: '', noun: 'line', back: 'Openings', intro: 'Learn the first moves and the ideas behind them, then practise them from memory.', sections: [[1, 'Openings for White'], [-1, 'Defences for Black']] }); return () => t.destroy(); },
        games(host) { const t = LineTrainer(host, GAMES, { pre: 'g-', noun: 'game', back: 'Famous games', intro: 'Play through some of the most beautiful games ever played. <b>Learn</b> shows them with comments. <b>Practise</b> asks you to find the moves of the winner.', sections: [[1, 'Won by White'], [-1, 'Won by Black']] }); if (ChessUI.pendingGame) { const gid = ChessUI.pendingGame; ChessUI.pendingGame = null; t.open(gid); } return () => t.destroy(); },

        /* ---------------- endgames ---------------- */
        endgames(host) {
          let board, eng = Eng(), g, over, thinking, token = 0, hist;
          const list = () => { eng.kill(); if (board) { board.destroy(); board = null; } const st = store(); host.innerHTML = '<p class="mute small" style="margin:0 0 10px">Practise classic endgames against Moundshroud at full strength. Each one has a goal and a tip.</p><div class="acg">' + A.az(S.endgames, x => x.name).map(x => '<div class="card" data-e="' + x.id + '"><b>' + (st.ops['eg-' + x.id] ? '✅ ' : '') + esc(x.name) + '</b><div class="small mute">Goal: ' + (x.goal === 'win' ? 'checkmate Moundshroud' : 'hold the draw') + '</div></div>').join('') + '</div>'; host.onclick = e => { const c = e.target.closest('[data-e]'); if (c) open(c.dataset.e); }; };
          const open = id => {
            g = S.endgames.find(x => x.id === id); host.onclick = null; eng = Eng();
            host.innerHTML = '<div class="row" style="margin-bottom:8px"><button class="ib" id="ebk">&larr; Endgames</button><b style="flex:1;margin-left:6px">' + esc(g.name) + '</b></div><div class="acw"><div id="eb"></div><div class="acside"><div class="acmsg"><b>Goal:</b> ' + (g.goal === 'win' ? 'checkmate Moundshroud.' : 'draw the game.') + '<div class="small mute" style="margin-top:6px">' + g.tip + '</div></div><div class="acmsg" id="est"></div><div class="row" style="gap:6px;flex-wrap:wrap"><button class="ib" id="ere">Restart</button><button class="ib" id="eun">Undo</button><button class="ib" id="ehi">Hint</button></div><div class="small mute">Moundshroud plays at full strength. A draw by repetition, the fifty-move rule or stalemate ends the game.</div></div></div>';
            const $e = x => host.querySelector('#' + x); board = new Board($e('eb')); $e('ebk').onclick = list; $e('ere').onclick = restart; $e('eun').onclick = undo; $e('ehi').onclick = hint; board.onmove = m => { if (over || thinking) return; board.play(m); hist.push(board.pos.key()); check(); }; restart();
          };
          const msg = (t, c) => { const e = host.querySelector('#est'); e.className = 'acmsg ' + (c || ''); e.innerHTML = t; };
          const restart = () => { token++; eng.reset(); over = false; thinking = false; hist = [new C.Pos().setFen(g.fen).key()]; board.set(g.fen, { who: g.side, flipped: g.side < 0 }); msg('Your move.'); };
          const undo = () => { if (thinking) return; const n = board.pos.side === g.side ? 2 : 1; for (let i = 0; i < n; i++) { board.undo(); hist.pop(); } over = false; board.who = g.side; board.draw(); msg('Move taken back.'); };
          const hint = async () => { if (over || thinking || board.pos.side !== g.side) return; msg('Thinking...'); const r = await eng.ask({ cmd: 'eval', fen: board.pos.fen(), depth: 5, ms: 3000 }); if (r.best != null) { board.marks = {}; board.marks[r.best & 63] = 'hint'; board.marks[(r.best >> 6) & 63] = 'hint'; board.draw(); msg('Hint: the blue squares show a strong move.'); } };
          const check = () => {
            const pos = board.pos, l = pos.legal(); let rep = 0; hist.forEach(k => { if (k === pos.key()) rep++; });
            const end = (txt, humanWon, draw) => { over = true; board.who = 0; const ok = g.goal === 'win' ? humanWon : (draw || humanWon); msg((ok ? '🎉 ' : '') + txt + (g.goal === 'win' ? (humanWon ? ' <b>Goal reached!</b>' : ' The goal was checkmate - restart and try again.') : (ok ? ' <b>Goal reached!</b>' : ' You needed a draw.')), ok ? 'ok' : 'no'); if (ok) { const st = store(), fresh = !st.ops['eg-' + g.id]; st.ops['eg-' + g.id] = 1; put(st); ev('endgame', { fresh }); try { ChessFx.confetti({ n: 60 }); } catch (e) { } } };
            if (!l.length) { if (pos.inCheck()) return end('Checkmate - ' + (pos.side !== g.side ? 'you win.' : 'Moundshroud wins.'), pos.side !== g.side, false); return end('Stalemate - a draw.', false, true); }
            if (pos.insufficient()) return end('Draw - not enough material.', false, true); if (pos.half >= 100) return end('Draw - fifty-move rule.', false, true); if (rep >= 3) return end('Draw - threefold repetition.', false, true);
            if (pos.side === g.side) { msg(pos.inCheck() ? 'Check! Your move.' : 'Your move.'); board.who = g.side; return; }
            board.who = 0; thinking = true; msg('Moundshroud is thinking...'); const my = ++token;
            eng.ask({ fen: pos.fen(), elo: 2400, ms: 1500 }).then(r => { if (my !== token) return; thinking = false; const m = l.find(x => x === r.move) ?? l[0]; board.play(m); hist.push(board.pos.key()); check(); });
          };
          list(); return () => { token++; eng.kill(); if (board) board.destroy(); };
        },

        play(host) { return ChessUI.sections.play(host, api, { show }); },
        minis(host) { return ChessUI.sections.minis(host, api, { show }); },
        trophies(host) { return ChessUI.sections.trophies(host, api, { show }); },
        books(host) { return ChessUI.sections.books(host, api, { show }); },
        history(host) { return ChessUI.sections.history(host, api, { show }); },
        tourney(host) { return ChessUI.sections.tourney(host, api, { show }); },
        profile(host) { return ChessUI.sections.profile(host, api, { show }); },
        online(host) { return ChessUI.sections.online(host, api, { show }); },
        scan(host) { return ChessUI.sections.scan ? ChessUI.sections.scan(host, api, { show }) : (host.innerHTML = '<div class="mute">The scanner is not loaded.</div>', null); },
        lichess(host) { return ChessUI.sections.lichess ? ChessUI.sections.lichess(host, api, { show }) : (host.innerHTML = '<div class="mute">Lichess is not loaded.</div>', null); },
        daily(host) { return ChessUI.sections.daily(host, api, { show }); },
        clubs(host) { return ChessUI.sections.clubs(host, api, { show }); },
        community(host) { return ChessUI.sections.community(host, api, { show }); },
        rush(host) { return ChessUI.sections.rush(host, api, { show }); },
        explorer(host) { return ChessUI.sections.explorer(host, api, { show }); },
        lab(host) { return ChessUI.sections.lab(host, api, { show }); },
        career(host) { return ChessUI.sections.career(host, api, { show }); },
        settings(host) { return ChessUI.sections.settings(host, api, { show }); },
        analysis(host) { return ChessUI.sections.analysis(host, api, { show }); },
        coach(host) { return ChessUI.sections.coach(host, api, { show }); },
      };
      show(SEC[tab] ? tab : 'play'); return () => { if (cleanup) cleanup(); PZ.stop(); };
    }
  };
})();

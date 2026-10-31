// Game sound effects: ~35 sounds synthesised on the spot (nothing to download), a "voice" per game, and automatic hooks so every game
// reacts to moves, keys, score changes and wins/losses. Master on/off and volume live here (A.sfx.on / A.sfx.vol), keys sfx_on and sfx_vol.
(() => {
  let ac = null, nb = null;
  const getOn = () => ls.get('sfx_on', '1') !== '0', getVol = () => Math.max(0, Math.min(100, +ls.get('sfx_vol', '60')));
  const ctx = () => { if (!ac) { try { ac = new (window.AudioContext || window.webkitAudioContext)(); } catch (e) { return null; } } if (ac.state === 'suspended') ac.resume(); return ac; };
  let mul = 1;
  const V = () => getVol() / 100 * mul;
  const tone = (f, d, o = {}) => {
    const a = ctx(); if (!a) return; const t = a.currentTime + (o.delay || 0) + .003, os = a.createOscillator(), g = a.createGain(); os.type = o.type || 'sine'; os.frequency.setValueAtTime(f, t); if (o.slide) os.frequency.exponentialRampToValueAtTime(Math.max(20, f * o.slide), t + d);
    g.gain.setValueAtTime(.0001, t); g.gain.exponentialRampToValueAtTime(Math.max(.0002, (o.v || .25) * V()), t + .008); g.gain.exponentialRampToValueAtTime(.0001, t + d); let n = os; if (o.lp) { const f2 = a.createBiquadFilter(); f2.type = 'lowpass'; f2.frequency.value = o.lp; os.connect(f2); n = f2; } n.connect(g); g.connect(a.destination); os.start(t); os.stop(t + d + .03);
  };
  const noise = (d, o = {}) => {
    const a = ctx(); if (!a) return; if (!nb) { nb = a.createBuffer(1, a.sampleRate, a.sampleRate); const c = nb.getChannelData(0); for (let i = 0; i < c.length; i++) c[i] = Math.random() * 2 - 1; }
    const t = a.currentTime + (o.delay || 0) + .003, s = a.createBufferSource(), f = a.createBiquadFilter(), g = a.createGain(); s.buffer = nb; f.type = o.type || 'bandpass'; f.frequency.value = o.f || 1500; f.Q.value = o.q || .8; g.gain.setValueAtTime(Math.max(.0002, (o.v || .2) * V()), t); g.gain.exponentialRampToValueAtTime(.0001, t + d); s.connect(f); f.connect(g); g.connect(a.destination); s.start(t, Math.random() * .5); s.stop(t + d + .03);
  };
  const arp = (notes, step, o = {}) => notes.forEach((f, i) => tone(f, o.d || .22, Object.assign({}, o, { delay: i * step })));
  const kn = (f, v, nf, delay) => { tone(f, .09, { type: 'triangle', v, slide: .45, delay }); noise(.035, { f: nf, v: v * .8, delay }); };
  const S = {
    tick: () => tone(1200, .04, { type: 'square', v: .07 }),
    click: () => { tone(700, .05, { type: 'triangle', v: .2, slide: .7 }); noise(.02, { f: 3000, v: .05 }); },
    select: () => tone(520, .06, { type: 'triangle', v: .16 }),
    pop: () => tone(520, .09, { v: .35, slide: 1.8 }), pop2: () => tone(340, .1, { v: .3, slide: 1.6 }),
    clack: () => { noise(.03, { f: 2500, v: .3 }); tone(220, .06, { type: 'triangle', v: .25 }); },
    flip: () => { noise(.07, { f: 1800, v: .25 }); tone(900, .05, { type: 'triangle', v: .12, slide: .5 }); },
    drop: () => { tone(480, .18, { v: .25, slide: .35 }); tone(140, .1, { type: 'triangle', v: .35, delay: .15 }); noise(.05, { f: 400, type: 'lowpass', v: .25, delay: .15 }); },
    thud: () => { tone(120, .12, { type: 'triangle', v: .45, slide: .5 }); noise(.06, { f: 300, type: 'lowpass', v: .3 }); },
    slide: () => noise(.12, { f: 1200, v: .2 }),
    switch: () => { tone(300, .03, { type: 'square', v: .1 }); tone(520, .04, { type: 'square', v: .1, delay: .03 }); },
    key: () => { noise(.015, { f: 4200, type: 'highpass', v: .12 }); tone(1800, .02, { type: 'square', v: .04 }); },
    tile: () => tone(660, .06, { type: 'triangle', v: .2 }),
    enter: () => { tone(440, .05, { type: 'triangle', v: .2 }); tone(660, .07, { type: 'triangle', v: .2, delay: .05 }); },
    pencil: () => noise(.05, { f: 5000, type: 'highpass', v: .12 }),
    peg: () => tone(400, .07, { v: .3, slide: 1.3 }),
    blip: () => tone(880, .035, { type: 'square', v: .05 }),
    coin: () => { tone(988, .06, { type: 'square', v: .09 }); tone(1319, .2, { type: 'square', v: .09, delay: .06 }); },
    good: () => { tone(660, .08, { type: 'triangle', v: .25 }); tone(880, .14, { type: 'triangle', v: .25, delay: .08 }); },
    bad: () => tone(220, .22, { type: 'sawtooth', v: .13, slide: .7, lp: 1500 }),
    error: () => { tone(150, .12, { type: 'square', v: .1 }); tone(150, .12, { type: 'square', v: .1, delay: .16 }); },
    win: () => { arp([523, 659, 784, 1047], .1, { type: 'triangle', v: .22, d: .3 }); tone(1047, .6, { type: 'triangle', v: .2, delay: .4 }); tone(1319, .6, { type: 'triangle', v: .14, delay: .4 }); },
    lose: () => arp([392, 330, 262, 196], .15, { type: 'sawtooth', v: .1, d: .3, lp: 1400 }),
    draw: () => { tone(440, .2, { type: 'triangle', v: .2 }); tone(440, .3, { type: 'triangle', v: .2, delay: .22 }); },
    levelup: () => arp([523, 659, 784, 1047, 1319], .07, { type: 'square', v: .08, d: .2 }),
    line: () => arp([440, 554, 659, 880], .06, { type: 'square', v: .09, d: .18 }),
    bounce: () => tone(300, .06, { type: 'triangle', v: .25, slide: 1.7 }),
    ping: () => tone(1000, .06, { v: .22 }),
    flap: () => { noise(.06, { f: 900, v: .18 }); tone(400, .07, { type: 'triangle', v: .13, slide: 1.7 }); },
    splash: () => { noise(.25, { f: 900, type: 'lowpass', v: .3 }); tone(300, .16, { v: .12, slide: .4 }); },
    boom: () => { noise(.5, { f: 250, type: 'lowpass', v: .6 }); tone(90, .4, { type: 'sawtooth', v: .3, slide: .4, lp: 400 }); },
    bonk: () => { tone(180, .1, { type: 'triangle', v: .45, slide: .5 }); noise(.04, { f: 500, type: 'lowpass', v: .3 }); },
    beep: () => tone(880, .14, { v: .3 }),
    rotate: () => tone(600, .05, { type: 'square', v: .07, slide: 1.5 }),
    whoosh: () => noise(.22, { f: 700, v: .22 }),
    flag: () => { tone(700, .04, { type: 'square', v: .08 }); tone(930, .05, { type: 'square', v: .08, delay: .04 }); },
    /* chess: a woody knock for every move, heavier for captures, a bell for check; your moves (c_x) and the opponent's (c_x_o) differ a little */
    c_move: () => kn(300, .38, 1500), c_move_o: () => kn(370, .3, 1900),
    c_capture: () => { kn(210, .52, 900); tone(150, .13, { type: 'triangle', v: .3, delay: .05, slide: .5 }); }, c_capture_o: () => { kn(255, .44, 1100); tone(185, .12, { type: 'triangle', v: .26, delay: .05, slide: .5 }); },
    c_castle: () => { kn(290, .36, 1500); kn(245, .34, 1300, .11); }, c_castle_o: () => { kn(340, .3, 1800); kn(290, .28, 1600, .11); },
    c_check: () => { kn(300, .4, 1500); tone(1175, .16, { v: .2, delay: .07 }); tone(880, .24, { v: .2, delay: .17 }); }, c_check_o: () => { kn(360, .32, 1800); tone(1397, .16, { v: .18, delay: .07 }); tone(1047, .24, { v: .18, delay: .17 }); },
    c_mate: () => { kn(170, .6, 700); arp([392, 330, 262, 196], .13, { type: 'sawtooth', v: .09, d: .35, lp: 1300 }); },
    c_promote: () => { kn(320, .3, 1600); arp([523, 659, 784, 1047], .07, { type: 'triangle', v: .2, d: .22 }); },
    c_start: () => { tone(392, .2, { v: .22 }); tone(587, .34, { v: .22, delay: .13 }); },
    c_win: () => { arp([523, 659, 784, 1047, 1319], .1, { type: 'triangle', v: .22, d: .4 }); tone(1568, .7, { v: .15, delay: .5 }); },
    c_lose: () => arp([392, 349, 311, 262], .17, { type: 'sawtooth', v: .09, d: .4, lp: 1200 }),
    c_draw: () => { tone(440, .25, { type: 'triangle', v: .2 }); tone(554, .25, { type: 'triangle', v: .2, delay: .2 }); tone(440, .4, { type: 'triangle', v: .2, delay: .4 }); },
    c_illegal: () => tone(130, .15, { type: 'square', v: .09, lp: 900 }),
    c_low: () => tone(1600, .045, { v: .3 }),
    sniff: () => { tone(330, .06, { type: 'triangle', v: .2 }); tone(247, .12, { type: 'triangle', v: .2, delay: .06 }); },
  };
  const NAMES = Object.keys(S);

  /* what each game sounds like: click / key / opp (the computer's reply) / score (points go up) */
  const VOICES = {
    default: { click: 'click', score: 'coin' },
    snake: { key: 'blip', score: 'coin' }, '2048': { key: 'slide', score: 'pop' }, memory: { click: 'flip' }, connect4: { click: 'drop', opp: 'drop' }, breakout: { score: 'bounce' },
    mines: { click: 'click' }, sudoku: { click: 'tick', key: 'pencil' }, wordguess: { key: 'tile', enter: 'enter' }, tetris: { key: 'tetris', score: 'line' },
    tictactoe: { click: 'pop', opp: 'pop2' }, checkers: { click: 'clack', opp: 'clack' }, othello: { click: 'flip', opp: 'flip' }, battleship: { click: 'splash', hit: 1 }, mastermind: { click: 'peg' }, hangman: { click: 'tile', key: 'tile' },
    pong: { score: 'ping' }, flap: { key: 'flap', click: 'flap', score: 'coin' }, slide: { click: 'slide' }, lights: { click: 'switch' }, simon: { click: null, score: null }, whack: { click: 'bonk', score: 'coin' }, reaction: { click: 'beep' }, typing: { key: 'key', enter: 'enter', typing: 1 },
    chess: { click: null }, cipher: { key: 'key', enter: 'enter', click: 'select', typing: 1 }, terminal: { key: 'key', enter: 'enter', click: null, typing: 1 }, sqldojo: { click: 'select', key: 'key', typing: 1 }, phish: { click: 'select' }, netninja: { click: 'select' }, logs: { click: 'select' },
  };
  const WIN = /you win|you won|victory|well done|solved|cleared|cracked|case closed|mission complete|nice one|perfect|you got in|dojo complete|round over|you finished/i, GOOD = /\bcorrect\b|right!|got it|match(ed)?!/i;
  const LOSE = /game over|you lose|you lost|moundshroud wins|too slow|you crashed|checkmate.*(black|white) wins|time'?s up/i, BAD = /not quite|not that one|incorrect|wrong|permission denied|database error|login failed|command not found|not the flag|nope|try again/i, DRAW = /\bdraw\b|stalemate|a tie/i;

  const play = name => { if (!getOn() || !S[name]) return; try { S[name](); if (name !== 'tick' && name !== 'key' && name !== 'blip') A.music && A.music.duck(); } catch (e) { } };
  const A_ = window.A || (typeof A !== 'undefined' ? A : null);
  const api = {
    NAMES: NAMES.filter(n => !/^c_/.test(n)), CHESS: NAMES.filter(n => /^c_/.test(n) && !/_o$/.test(n)), VOICES, play,
    chess(kind, opp, m) { if (!getOn()) return; try { A.music && A.music.duck(); } catch (e) { } const f = S['c_' + kind + (opp ? '_o' : '')] || S['c_' + kind] || S.c_move; mul = m == null ? 1 : m; try { f(); } catch (e) { } mul = 1; },
    get on() { return getOn(); }, set on(v) { ls.set('sfx_on', v ? '1' : '0'); }, get vol() { return getVol(); }, set vol(v) { ls.set('sfx_vol', String(v)); },
    attach(id, stage, gapi) {
      const play = n => api.play(n);      // through the public function, so it can be wrapped or muted from outside
      const V0 = Object.assign({}, VOICES.default, VOICES[id] || {}), t0 = Date.now(); let lastClick = 0, lastKey = 0, lastScore = null, lastLevel = null, lastMsg = '', lastEnd = 0, opp = false, lastText = 0;
      const at = () => Date.now() - t0 > 500;
      const click = e => { if (!getOn() || e.target === stage || (e.target.closest && e.target.closest('input,textarea,select,a'))) return; const now = Date.now(); if (now - lastClick < 35) return; lastClick = now; opp = !!V0.opp; if (V0.click) play(V0.click); };
      const ctxm = () => { if (V0.id === 'mines' || id === 'mines') play('flag'); };
      const key = e => {
        if (A.cur !== 'play' || e.ctrlKey || e.metaKey || e.altKey) return; const tgt = e.target || {}, inp = /INPUT|TEXTAREA|SELECT/.test(tgt.tagName || '');
        if (inp && !V0.typing) return; const now = Date.now(); if (now - lastKey < 45) return; lastKey = now;
        if (e.key === 'Enter') { if (V0.enter) play(V0.enter); return; }
        if (V0.key === 'tetris') { if (e.key === 'ArrowUp' || e.key === 'x' || e.key === 'w') play('rotate'); else if (e.key === ' ') play('thud'); else if (/Arrow/.test(e.key)) play('tick'); return; }
        if (!V0.key) return; if (V0.typing || /^(Arrow|[a-zA-Z0-9 ])/.test(e.key)) play(V0.key);
      };
      const hudNum = t => { const m = /(score|points|pts)\D{0,3}(\d+)/i.exec(t) || /(\d+)/.exec(t); return m ? +m[m.length - 1] : null; };
      const h0 = gapi.hud, s0 = gapi.submit;
      gapi.hud = t => { try { if (at() && getOn()) { const n = hudNum(String(t)); if (n !== null && lastScore !== null && n > lastScore && V0.score && Date.now() - lastText > 90) { lastText = Date.now(); play(V0.score); } if (n !== null) lastScore = n; const lv = /level\D{0,3}(\d+)/i.exec(String(t)); if (lv) { if (lastLevel !== null && +lv[1] > lastLevel) play('levelup'); lastLevel = +lv[1]; } } else { const n = hudNum(String(t)); if (n !== null) lastScore = n; } } catch (e) { } return h0 && h0(t); };
      gapi.submit = (s, l) => { const r = s0 ? s0(s, l) : false; try { if (getOn() && Date.now() - lastEnd > 700) { lastEnd = Date.now(); play(r ? 'win' : 'sniff'); } } catch (e) { } return r; };
      const test = txt => {
        if (!at() || !getOn()) return; const m = txt.trim().slice(0, 240); if (!m || m === lastMsg) return;
        const now = Date.now(); let n = null;
        if (V0.hit && /\bsunk\b|\bhit\b/i.test(m)) n = 'boom'; else if (V0.hit && /\bmiss/i.test(m)) n = 'splash';
        else if (LOSE.test(m)) n = 'lose'; else if (WIN.test(m)) n = 'win'; else if (DRAW.test(m)) n = 'draw'; else if (GOOD.test(m)) n = 'good'; else if (BAD.test(m)) n = id === 'terminal' ? 'error' : 'bad';
        if (n) { lastMsg = m; if ((n === 'win' || n === 'lose' || n === 'draw') && now - lastEnd < 700) return; if (n === 'win' || n === 'lose' || n === 'draw') lastEnd = now; play(n); }
      };
      const mo = new MutationObserver(list => {
        if (!at()) return; const now = Date.now();
        if (opp && now - lastClick > 150 && now - lastClick < 2600) { opp = false; if (V0.opp) play(V0.opp); }
        for (const m of list) { const n = m.type === 'characterData' ? m.target.parentElement : m.target; if (!n || !n.textContent) continue; if (m.type === 'childList' && !m.addedNodes.length) continue; test(m.type === 'childList' ? [...m.addedNodes].map(x => x.textContent || '').join(' ') : n.textContent); }
      });
      stage.addEventListener('click', click, true); stage.addEventListener('contextmenu', ctxm, true); document.addEventListener('keydown', key, true); mo.observe(stage, { childList: true, subtree: true, characterData: true });
      return () => { stage.removeEventListener('click', click, true); stage.removeEventListener('contextmenu', ctxm, true); document.removeEventListener('keydown', key, true); mo.disconnect(); };
    },
  };
  (typeof A !== 'undefined' ? A : window).sfx = api;
})();

// AI chess coach. The local AI explains moves and games, but only from engine facts it is handed, so it cannot invent variations.
(() => {
  const SYSTEM = 'You are a friendly, patient chess coach for the user, an improving club-level player. You are given verified engine analysis (evaluations are in pawns from the stated point of view, plus best moves and their evaluations). Rules: 1) Base every judgment on the engine facts you are given. Never invent moves, variations or evaluations that are not in the facts. 2) Explain WHY in plain language: ideas, threats, tactics, plans, piece activity, king safety and pawn structure. 3) Be concise: under 140 words unless the user asks for more, short paragraphs, friendly tone. 4) Write moves in standard algebraic notation. 5) End with one practical takeaway when it helps. 6) If you are not sure, say so honestly.';
  const QUICK = {
    position: ['Explain this position', 'What is the plan here?', 'What are the threats?'],
    move: ['Why was my last move a mistake?', 'Why is the best move better?', 'What should I have looked for?'],
    game: ['Summarize this game', 'What are my biggest weaknesses?', 'Give me a training plan']
  };

  /* streams a reply from the local AI model; onText gets the text so far */
  async function stream(messages, onText, signal, opts) {
    opts = opts || {};
    const sel = $('model'), model = (sel && sel.value) || '', call = m => fetch('/api/chat', { method: 'POST', signal, body: JSON.stringify({ model: m, stream: true, think: false, keep_alive: '5m', options: { temperature: opts.temp || 0.4 }, messages }) });
    let r = await call(model), note = '';
    if (!r.ok) { /* the big model may not fit in memory right now: fall back to the small one */ const alt = sel ? [...sel.options].map(o => o.value).find(v => /(2b|0\.8b)/i.test(v) && v !== model) : null; if (alt) { r = await call(alt); note = opts.quiet ? '' : '_(The main AI model could not start, probably because graphics memory is full, so the small model answered.)_\n\n'; } }
    if (!r.ok) throw new Error('The AI engine did not answer. Close other programs that use the graphics card, or turn on Low-power mode in Settings.');
    const rd = r.body.getReader(), dec = new TextDecoder(); let buf = '', out = note; if (note) onText(note);
    for (;;) {
      const { value, done } = await rd.read(); if (done) break; buf += dec.decode(value, { stream: true }); let i;
      while ((i = buf.indexOf('\n')) >= 0) { const ln = buf.slice(0, i).trim(); buf = buf.slice(i + 1); if (!ln) continue; try { const j = JSON.parse(ln); if (j.message && j.message.content) { out += j.message.content; onText(out); } } catch (e) { } }
    }
    return out;
  }

  /* facts about the current position and game, written out for the AI */
  function context(o) {
    const C = Chess, AN = ChessAna, L = [];
    if (o.game) { const g = o.game; L.push('Game: ' + (g.white || 'White') + ' (White) vs ' + (g.black || 'Black') + ' (Black), result ' + (g.result || '*') + '.' + (o.opening ? ' Opening: ' + o.opening + '.' : '')); if (o.me) L.push('The user is playing ' + (o.me > 0 ? 'White' : 'Black') + '.'); }
    if (o.fen) {
      const pos = new C.Pos().setFen(o.fen), mat = C.material(pos, 1); L.push('Current position (FEN): ' + o.fen + '. ' + (pos.side > 0 ? 'White' : 'Black') + ' to move.' + (pos.inCheck() ? ' The side to move is in check.' : '') + ' Material: ' + (mat === 0 ? 'equal' : (mat > 0 ? 'White' : 'Black') + ' is ahead by ' + Math.abs(mat / 100) + ' pawns') + '.');
    }
    if (o.sans && o.sans.length) { const from = Math.max(0, o.sans.length - 16), parts = []; for (let i = from; i < o.sans.length; i++) parts.push((i % 2 === 0 ? (i / 2 + 1) + '. ' : (i === from ? (Math.floor(i / 2) + 1) + '... ' : '')) + o.sans[i]); L.push('Recent moves: ' + parts.join(' ') + '.'); }
    if (o.lines && o.lines.length) L.push('Engine suggestions (evaluation in pawns, positive = good for White): ' + o.lines.map(x => x.san + ' (' + x.ev + ')').join('; ') + '.');
    if (o.move) L.push('Last move played: ' + o.move.san + ' by ' + (o.move.side > 0 ? 'White' : 'Black') + '. Engine verdict: ' + o.move.c + (o.move.best ? '; the engine preferred ' + o.move.best + (o.move.dw ? ', and the played move gave away about ' + o.move.dw + '% of winning chances' : '') : '') + '.');
    if (o.summary) { const s = o.summary, f = x => Object.entries(x.c).map(([k, v]) => v + ' ' + k).join(', '); L.push('Game accuracy: White ' + s.w.acc + '%, Black ' + s.b.acc + '%. White: ' + f(s.w) + '. Black: ' + f(s.b) + '. Accuracy by phase (opening/middlegame/endgame): ' + ['open', 'mid', 'end'].map(k => s.phase[k] == null ? 'n/a' : s.phase[k] + '%').join(' / ') + '.'); }
    if (o.moments && o.moments.length) L.push('Key moments: ' + o.moments.map(m => m.n + ' ' + m.san + ' (' + m.c + (m.best ? ', better was ' + m.best : '') + ')').join('; ') + '.');
    if (o.extra) L.push(o.extra);
    return L.join('\n');
  }

  /* a chat panel; getCtx() returns the facts for whatever is currently on screen */
  function panel(host, getCtx, opts) {
    opts = opts || {}; host.innerHTML = '<div class="acmsg" style="padding:8px"><div id="cclog" style="max-height:300px;overflow:auto;font-size:13.5px;line-height:1.55"></div><div class="chips" id="ccq" style="margin-top:6px"></div><div class="row" style="gap:6px;margin-top:6px"><input id="ccin" type="text" placeholder="Ask the coach about this position or game..." style="flex:1"><button class="pri" id="ccgo">Ask</button><button class="ib" id="ccstop" style="display:none">Stop</button></div></div>';
    const q = id => host.querySelector('#' + id), log = q('cclog'); let hist = [], ctl = null, busy = false, dead = false;
    const add = (cls, html) => { const d = document.createElement('div'); d.style.cssText = 'margin:6px 0;padding:7px 10px;border-radius:10px;' + (cls === 'u' ? 'background:var(--user);margin-left:30px' : 'background:var(--panel2);margin-right:14px'); d.innerHTML = html; log.appendChild(d); log.scrollTop = log.scrollHeight; return d; };
    if (!opts.quiet) add('a', 'Hi, I am your chess coach. Ask me about this position, a move, or your whole game. I only trust what the engine shows, so my advice is grounded.');
    const chips = () => { const set = opts.chipsFn ? opts.chipsFn() : QUICK.position; q('ccq').innerHTML = set.map(t => '<span class="chip" data-q="' + esc(t) + '">' + esc(t) + '</span>').join(''); };
    async function ask(text, extra) {
      if (busy || dead) return; text = String(text || '').trim(); if (!text) return; busy = true; try { ChessAch.event('coach'); } catch (e) { } q('ccgo').disabled = true; q('ccstop').style.display = ''; add('u', esc(text)); const out = add('a', '<span class="dots"></span>'); ctl = new AbortController();
      let facts = {}; try { facts = (await Promise.resolve(getCtx())) || {}; } catch (e) { console.warn(e); } let ex = extra || {}; if (window.ChessProfile && !/USER PROFILE/.test(String(facts.extra || '')) && /\b(my profile|my stats|my games|my weakness|weaknesses|overall|work on|improve|training plan|study plan|how am i doing|my progress|what should i (study|practise|practice|focus))\b/i.test(text)) ex = Object.assign({}, ex, { extra: (ex.extra ? ex.extra + '\n' : '') + ChessProfile.brief() }); const ctxText = context(Object.assign({}, facts, ex));
      const msgs = [{ role: 'system', content: SYSTEM }, ...hist.slice(-6), { role: 'user', content: (ctxText ? 'ENGINE FACTS:\n' + ctxText + '\n\n' : '') + 'QUESTION: ' + text }];
      let res = ''; try { res = await stream(msgs, t => { out.innerHTML = md(t); log.scrollTop = log.scrollHeight; }, ctl.signal); } catch (e) { res = e.name === 'AbortError' ? '(stopped)' : '*I could not reach the AI (' + e.message + ').*'; out.innerHTML = md(res); }
      if (!String(res).trim()) { res = '*The AI did not send an answer. Try again in a moment.*'; out.innerHTML = md(res); }
      hist.push({ role: 'user', content: text }, { role: 'assistant', content: res }); busy = false; ctl = null; if (!dead) { q('ccgo').disabled = false; q('ccstop').style.display = 'none'; chips(); }
    }
    q('ccgo').onclick = () => { const v = q('ccin').value; q('ccin').value = ''; ask(v); }; q('ccin').onkeydown = e => { if (e.key === 'Enter') { e.preventDefault(); q('ccgo').click(); } };
    q('ccstop').onclick = () => { if (ctl) ctl.abort(); }; q('ccq').onclick = e => { const c = e.target.closest('[data-q]'); if (c) ask(c.dataset.q); };
    chips(); return { ask, refreshChips: chips, destroy() { dead = true; if (ctl) ctl.abort(); } };
  }
  window.ChessCoach = { SYSTEM, stream, context, panel, QUICK };
})();

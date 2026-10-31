// Chess › ♞ Lichess: real games against real people on lichess.org, on your own Lichess account.
// Moundshroud is only the board: Lichess runs the game, the clock, the matchmaking and the ratings. Your token stays
// with the Moundshroud server (protected by Windows); this page only sees the games.
// FAIR PLAY: while a real game is on, every engine in Moundshroud is locked (the server refuses Stockfish, the other
// chess sections cannot be opened, the built-in engine refuses to answer, voice moves stop asking the AI), and the
// page is marked data-private so no AI ever sees the position. Analysis unlocks when the game is over.
(() => {
  const C = window.Chess, UI = window.ChessUI; if (!C || !UI) return;
  const api = (p, b) => A.api('/api/lichess/' + p, b);
  const TOKEN_URL = 'https://lichess.org/account/oauth/token/create?scopes[]=board:play&scopes[]=challenge:read&scopes[]=challenge:write&description=Moundshroud';
  const fair = window.ChessFair = window.ChessFair || { live: false, game: '' };
  const STATUS = { mate: 'Checkmate', resign: 'Resignation', stalemate: 'Stalemate', timeout: 'Opponent left', draw: 'Draw', outoftime: 'Time ran out', aborted: 'Game aborted', noStart: 'Game did not start', cheat: 'Cheat detected', variantEnd: 'Game over', unknownFinish: 'Game over', insufficientMaterialClaim: 'Draw: not enough material' };
  const fmt = ms => { const s = Math.max(0, Math.ceil(ms / 1000)); return Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0'); };
  const tcText = (l, i) => (l >= 60 ? (l / 60) : (l / 60).toFixed(1).replace(/\.0$/, '')) + '+' + i;
  const speedOf = (l, i) => { const e = l + 40 * i; return e < 180 ? 'Bullet' : e < 480 ? 'Blitz' : e < 1500 ? 'Rapid' : 'Classical'; };

  /* reading Lichess's line-by-line streams */
  async function readStream(url, opts, onObj) {
    const r = await fetch(url, opts); const rd = r.body.getReader(), dec = new TextDecoder(); let buf = '';
    for (; ;) { const { value, done } = await rd.read(); if (done) break; buf += dec.decode(value, { stream: true }); let i; while ((i = buf.indexOf('\n')) >= 0) { const l = buf.slice(0, i).trim(); buf = buf.slice(i + 1); if (l) { try { onObj(JSON.parse(l)); } catch (e) { } } } }
  }

  /* ---------- the lock: no engine help while a real game is on ---------- */
  const setLive = (on, id) => { fair.live = !!on; fair.game = on ? id : ''; document.documentElement.classList.toggle('lichess-live', !!on); };
  /* (the other chess sections refuse to open during a game: see show() in play-chess-study.js) */
  /* the built-in engine refuses to answer while a game is on */
  if (UI.Eng && !UI.Eng._lc) { const E0 = UI.Eng; UI.Eng = Object.assign(function () { const e = E0.apply(this, arguments); const ask = e.ask; e.ask = o => fair.live ? Promise.resolve({ error: 'locked' }) : ask.call(e, o); return e; }, { _lc: 1 }); }

  UI.sections.lichess = (host, hubApi, ctx) => {
    let dead = false, evCtl = null, gameCtl = null, seekCtl = null, G = null, me = '', events = { challenges: [], games: [] }, tick = 0;
    const skipAuto = new Set();           // games you stepped out of: offered with Resume, not reopened by themselves
    const stopAll = () => { [evCtl, gameCtl, seekCtl].forEach(c => { try { c && c.abort(); } catch (e) { } }); evCtl = gameCtl = seekCtl = null; clearInterval(tick); };
    const wrap = inner => '<div data-private class="lc">' + inner + '</div>';
    const q = id => host.querySelector('#' + id);

    async function start() {
      const st = await api('status').catch(() => ({}));
      if (dead) return;
      if (!st.internet) return host.innerHTML = wrap('<div class="card"><b>♞ Lichess</b><p class="mute">Playing on Lichess needs internet access. Switch it on in Settings › AI &amp; power, then come back.</p></div>');
      if (!st.connected) return connectScreen();
      if (st.live) setLive(true, '');
      lobby();
    }

    /* ---------- connecting your account ---------- */
    function connectScreen(err) {
      host.innerHTML = wrap('<div class="card" style="max-width:640px"><h3 style="margin:0 0 6px">♞ Play real games on Lichess</h3><div class="small mute" style="line-height:1.6">Lichess is the free, open-source chess site. Moundshroud becomes your board: you play real people (or the Lichess computer) on your own account, and your ratings and games are on your Lichess profile.</div>' +
        '<ol class="small" style="line-height:1.8;margin:10px 0"><li>Sign in to lichess.org in your browser.</li><li><a href="' + TOKEN_URL + '" target="_blank" rel="noopener noreferrer"><b>Open this page to make a token</b></a>. The permissions it needs are already ticked: <i>play games with the board API</i>, and <i>read</i> and <i>send challenges</i>. Press <b>Create</b>.</li><li>Copy the token (it starts with <code>lip_</code>) and paste it here.</li></ol>' +
        '<div class="row" style="gap:6px"><input id="lctok" type="password" placeholder="lip_…" style="flex:1" autocomplete="off"><button class="pri" id="lcgo">Connect</button></div><div id="lcerr" class="small" style="color:var(--bad);margin-top:6px">' + esc(err || '') + '</div>' +
        '<div class="small mute" style="margin-top:10px;line-height:1.5">The token is kept encrypted by Windows for your Windows account, and only the Moundshroud server uses it. You can delete it at any time on lichess.org (Preferences › API access tokens) or with <i>Disconnect</i> here.</div></div>' + fairCard());
      q('lcgo').onclick = async () => { const b = q('lcgo'); b.disabled = true; b.textContent = 'Checking…'; const r = await api('connect', { token: q('lctok').value }).catch(e => ({ error: e.message })); if (dead) return; if (r.error) return connectScreen(r.error); A.toast('Connected to Lichess as ' + r.user + '.'); lobby(); };
    }
    const fairCard = () => '<div class="card small" style="max-width:640px;line-height:1.55;border-color:var(--warn)"><b>⚖️ Fair play</b><br>Lichess bans accounts that get engine help in their games. So while one of your Lichess games is being played, Moundshroud locks its chess engines, the live coach, hints, analysis and the other chess sections, and no AI can see the board. Everything unlocks when the game ends.</div>';

    /* ---------- the lobby ---------- */
    async function lobby() {
      stopAll(); G = null;
      host.innerHTML = wrap('<div class="mute" style="padding:20px">Connecting to Lichess…</div>');
      const a = await api('account').catch(e => ({ error: e.message })); if (dead) return;
      if (a.offline) return start();
      if (!a.connected) return connectScreen();
      me = String(a.user || '').toLowerCase();
      const pf = a.perfs || {}, r = k => pf[k] ? pf[k].rating + (pf[k].prov ? '?' : '') : '—';
      const TCS = [[600, 0], [600, 5], [900, 10], [1800, 0], [1800, 20]], ALL = [[180, 2], [300, 0], [300, 3], [600, 0], [600, 5], [900, 10], [1800, 0]];
      const tcOpts = sel => ALL.map(([l, i]) => '<option value="' + l + '+' + i + '"' + (l + '+' + i === sel ? ' selected' : '') + '>' + tcText(l, i) + ' ' + speedOf(l, i) + '</option>').join('');
      host.innerHTML = wrap('<div class="row" style="gap:8px;align-items:center;flex-wrap:wrap;margin-bottom:10px"><h3 style="margin:0;flex:1">♞ Lichess · ' + esc(a.user || '') + (a.title ? ' <span class="mute">' + esc(a.title) + '</span>' : '') + '</h3><span class="small mute">Blitz ' + r('blitz') + ' · Rapid ' + r('rapid') + ' · Classical ' + r('classical') + '</span><a class="ib" href="https://lichess.org/@/' + encodeURIComponent(a.user || '') + '" target="_blank" rel="noopener noreferrer">Profile ↗</a><button class="ib" id="lcdis">Disconnect</button></div>' +
        (a.error ? '<div class="acmsg bad">' + esc(a.error) + '</div>' : '') +
        '<div id="lcincoming"></div><div id="lcongoing"></div>' +
        '<div class="lc-grid"><div class="card"><b>🎲 Play someone new</b><div class="small mute" style="margin:2px 0 8px">Rapid and Classical only: Lichess keeps faster games with strangers for its own site.</div><div class="row" style="gap:6px;flex-wrap:wrap">' + TCS.map(([l, i]) => '<button class="ib" data-seek="' + l + '+' + i + '">' + tcText(l, i) + '</button>').join('') + '</div><label class="small" style="display:flex;gap:6px;align-items:center;margin-top:8px"><input type="checkbox" id="lcrated" checked> Rated</label><div id="lcseek"></div></div>' +
        '<div class="card"><b>🤝 Challenge a friend</b><div class="row" style="gap:6px;flex-wrap:wrap;margin-top:8px"><input id="lcuser" placeholder="Their Lichess name" style="flex:1;min-width:140px"><select id="lctc">' + tcOpts('600+5') + '</select><select id="lccol"><option value="random">Random side</option><option value="white">White</option><option value="black">Black</option></select></div><label class="small" style="display:flex;gap:6px;align-items:center;margin-top:8px"><input type="checkbox" id="lcfr"> Rated</label><button class="pri" id="lcch" style="margin-top:6px">Send challenge</button><div id="lcout"></div></div>' +
        '<div class="card"><b>🤖 Play the Lichess computer</b><div class="row" style="gap:6px;flex-wrap:wrap;margin-top:8px"><select id="lclvl">' + [1, 2, 3, 4, 5, 6, 7, 8].map(n => '<option value="' + n + '"' + (n === 3 ? ' selected' : '') + '>Level ' + n + '</option>').join('') + '</select><select id="lcaitc">' + tcOpts('600+5') + '</select><select id="lcaicol"><option value="random">Random side</option><option value="white">White</option><option value="black">Black</option></select></div><button class="ib" id="lcai" style="margin-top:8px">Start</button><div class="small mute" style="margin-top:6px">Not rated. A good way to try Moundshroud’s board on Lichess.</div></div></div>' + fairCard());
      q('lcdis').onclick = async () => { if (!confirm('Disconnect Lichess? The saved token is deleted from this PC. (Delete it on lichess.org too, under Preferences › API access tokens, if you will not use it again.)')) return; await api('disconnect', {}); connectScreen(); };
      host.querySelectorAll('[data-seek]').forEach(b => b.onclick = () => doSeek(b.dataset.seek, q('lcrated').checked));
      q('lcch').onclick = async () => { const u = q('lcuser').value.trim(); if (!u) return A.toast('Type your friend’s Lichess name.'); const [l, i] = q('lctc').value.split('+').map(Number); const r = await api('challenge', { user: u, limit: l, inc: i, rated: q('lcfr').checked, color: q('lccol').value }); if (r.error) return A.toast(r.error); A.toast('Challenge sent to ' + u + '. The game starts here when they accept.'); };
      q('lcai').onclick = async () => { const [l, i] = q('lcaitc').value.split('+').map(Number); const b = q('lcai'); b.disabled = true; const r = await api('ai', { level: q('lclvl').value, limit: l, inc: i, color: q('lcaicol').value }); b.disabled = false; if (r.error) return A.toast(r.error); if (r.id) openGame(r.id); };
      listen();
    }
    /* the event stream: challenges for you, games that start (from a seek, a challenge or another device) */
    function listen() {
      evCtl = new AbortController(); events = { challenges: [], games: [] };
      readStream('/api/lichess/events', { signal: evCtl.signal }, e => {
        if (dead) return;
        if (e.type === 'error') { const el = q('lcincoming'); if (el) el.innerHTML = '<div class="acmsg bad">' + esc(e.error) + '</div>'; return; }
        if (e.type === 'challenge') { events.challenges = events.challenges.filter(c => c.id !== e.challenge.id).concat([e.challenge]); paintEvents(); }
        if (e.type === 'challengeCanceled' || e.type === 'challengeDeclined') { const c = e.challenge || {}; events.challenges = events.challenges.filter(x => x.id !== c.id); paintEvents(); if (e.type === 'challengeDeclined' && c.challenger && String(c.challenger.id).toLowerCase() === me) A.toast((c.destUser ? c.destUser.name : 'Your friend') + ' declined the challenge.'); }
        if (e.type === 'gameStart') { const g = e.game; events.games = events.games.filter(x => x.gameId !== g.gameId).concat([g]); if (seekCtl) { try { seekCtl.abort(); } catch (x) { } seekCtl = null; } setLive(true, g.gameId); if (!G && !skipAuto.has(g.gameId)) openGame(g.gameId); else paintEvents(); }
        if (e.type === 'gameFinish') { events.games = events.games.filter(x => x.gameId !== e.game.gameId); if (!events.games.length && !(G && !G.over)) setLive(false); paintEvents(); }
      }).catch(() => { });
    }
    function paintEvents() {
      const inc = q('lcincoming'), on = q('lcongoing'), out = q('lcout'); if (!inc) return;
      const forMe = events.challenges.filter(c => c.destUser && String(c.destUser.id).toLowerCase() === me), mine = events.challenges.filter(c => c.challenger && String(c.challenger.id).toLowerCase() === me);
      inc.innerHTML = forMe.map(c => '<div class="card lc-inv"><b>⚔ ' + esc(c.challenger.name) + '</b> (' + (c.challenger.rating || '?') + ') challenges you: ' + esc(c.timeControl && c.timeControl.show || '') + ' ' + esc(c.speed || '') + (c.rated ? ', rated' : ', casual') + (c.variant && c.variant.key !== 'standard' ? ', ' + esc(c.variant.name) : '') + ' <span class="row" style="gap:6px;display:inline-flex;margin-left:8px">' + (c.variant && c.variant.key !== 'standard' ? '<span class="small mute">(only standard chess can be played here)</span>' : '<button class="pri" data-acc="' + c.id + '">Accept</button>') + '<button class="ib" data-dec="' + c.id + '">Decline</button></span></div>').join('');
      if (out) out.innerHTML = mine.map(c => '<div class="small" style="margin-top:6px">Waiting for ' + esc(c.destUser ? c.destUser.name : '?') + '… <button class="ib" data-can="' + c.id + '">Cancel</button></div>').join('');
      on.innerHTML = events.games.length && !G ? '<div class="card"><b>Your games in progress</b>' + events.games.map(g => '<div class="row" style="gap:8px;padding:4px 0"><span style="flex:1">vs ' + esc(g.opponent ? g.opponent.username || ('Lichess level ' + g.opponent.ai) : '?') + ' · ' + esc(g.speed || '') + (g.isMyTurn ? ' · <b>your move</b>' : '') + '</span><button class="pri" data-res="' + g.gameId + '">Resume</button></div>').join('') + '</div>' : '';
      host.querySelectorAll('[data-acc]').forEach(b => b.onclick = async () => { const r = await api('accept', { id: b.dataset.acc }); if (r.error) A.toast(r.error); });
      host.querySelectorAll('[data-dec]').forEach(b => b.onclick = async () => { await api('decline', { id: b.dataset.dec }); events.challenges = events.challenges.filter(c => c.id !== b.dataset.dec); paintEvents(); });
      host.querySelectorAll('[data-can]').forEach(b => b.onclick = async () => { await api('cancel', { id: b.dataset.can }); events.challenges = events.challenges.filter(c => c.id !== b.dataset.can); paintEvents(); });
      host.querySelectorAll('[data-res]').forEach(b => b.onclick = () => openGame(b.dataset.res));
    }
    function doSeek(tc, rated) {
      const [l, i] = tc.split('+').map(Number), box = q('lcseek'); if (seekCtl) { try { seekCtl.abort(); } catch (e) { } }
      seekCtl = new AbortController(); const ctl = seekCtl, t0 = Date.now();
      box.innerHTML = '<div class="acmsg" style="margin-top:8px">🔎 Looking for an opponent at ' + tcText(l, i) + (rated ? ', rated' : '') + '… <span id="lcsk">0:00</span> <button class="ib" id="lcskx">Cancel</button></div>';
      const tk = setInterval(() => { const e = q('lcsk'); if (!e || ctl.signal.aborted) return clearInterval(tk); e.textContent = fmt(Date.now() - t0); }, 1000);
      q('lcskx').onclick = () => { ctl.abort(); clearInterval(tk); box.innerHTML = ''; };
      readStream('/api/lichess/seek', { method: 'POST', body: JSON.stringify({ time: l / 60, increment: i, rated }), signal: ctl.signal }, e => { if (e.type === 'error') { clearInterval(tk); box.innerHTML = '<div class="acmsg bad" style="margin-top:8px">' + esc(e.error) + '</div>'; } })
        .then(() => { clearInterval(tk); if (!ctl.signal.aborted && !G && q('lcseek')) box.innerHTML = box.innerHTML.includes('bad') ? box.innerHTML : '<div class="small mute" style="margin-top:8px">Nobody took the seek in time. Try again.</div>'; })
        .catch(() => clearInterval(tk));
    }

    /* ---------- a game ---------- */
    function openGame(id) {
      stopAll(); try { seekCtl && seekCtl.abort(); } catch (e) { }
      const S = G = { id, pos: new C.Pos().setFen(C.START), start: C.START, moves: [], side: 1, over: false, white: {}, black: {}, wt: 0, bt: 0, at: performance.now(), chat: [], rated: false, speed: '', tc: null, gone: null, offer: {}, status: 'started', winner: '' };
      host.innerHTML = wrap('<div class="acw" style="align-items:flex-start"><div class="ckw"><div id="lcclk" class="ckp"></div><div><div class="chbar row" id="lctop" style="min-height:34px;gap:8px;align-items:center"></div><div id="lcbd"></div><div class="chbar row" id="lcbot" style="min-height:34px;gap:8px;align-items:center"></div></div></div>' +
        '<div class="acside" style="width:340px"><div class="lc-live">⚖️ Real Lichess game: engines, hints and analysis are locked until it ends.</div><div class="acmsg" id="lcst" style="font-weight:600;min-height:44px">Connecting to the game…</div><div id="lcask"></div>' +
        '<div class="row" style="gap:6px;flex-wrap:wrap"><button class="ib dang" id="lcres">Resign</button><button class="ib" id="lcdr">Offer draw</button><button class="ib" id="lcflip">Flip</button><a class="ib" href="https://lichess.org/' + esc(id) + '" target="_blank" rel="noopener noreferrer">On Lichess ↗</a></div>' +
        '<div class="chml" id="lcml" style="height:150px;overflow:auto;background:var(--panel);border:1px solid var(--line);border-radius:10px;padding:6px 10px;font:13px/1.8 \'Cascadia Mono\',Consolas,monospace"></div>' +
        '<div class="card" style="margin:0;padding:8px"><div id="lcchat" style="height:110px;overflow:auto;font-size:13.5px;display:flex;flex-direction:column;gap:4px"></div><div class="row" style="gap:6px;margin-top:6px"><input id="lcin" placeholder="Message your opponent…" maxlength="140" style="flex:1" autocomplete="off"><button class="ib" id="lcsend">Send</button></div></div>' +
        '<button class="ib" id="lcback">← Back to the Lichess lobby</button></div></div>');
      const board = S.board = new UI.Board(q('lcbd'));
      const myColor = () => String((S.white || {}).id || '').toLowerCase() === me ? 1 : String((S.black || {}).id || '').toLowerCase() === me ? -1 : 0;
      const name = p => p ? (p.title ? p.title + ' ' : '') + (p.name || (p.aiLevel ? 'Lichess level ' + p.aiLevel : 'Anonymous')) : '?';
      const rating = p => p && p.rating ? ' (' + p.rating + (p.provisional ? '?' : '') + ')' : '';
      const status = (t, c) => { const e = q('lcst'); if (e) { e.textContent = t; e.style.color = c || ''; } };
      const rebuild = () => { const p = new C.Pos().setFen(S.start === 'startpos' ? C.START : S.start), hist = []; for (const u of S.moves) { const l = p.legal(), m = p.fromUci(u, l); if (m === undefined || m === null || m === false) break; hist.push({ u, san: p.san(m, l), f: m & 63, t: (m >> 6) & 63 }); p.make(m); } S.pos = p; S.hist = hist; };
      const clocks = () => {
        const ck = q('lcclk'); if (!ck || !window.ChessClock || !S.tc) return; const mc = myColor() || 1, now = performance.now(), run = !S.over && S.moves.length >= 2;
        const left = side => { let ms = side > 0 ? S.wt : S.bt; if (run && S.pos.side === side) ms -= now - S.at; return Math.max(0, ms); };
        const blk = (side, p) => { const s = left(side) / 1000; return { who: name(p) + rating(p), t: s < 20 && s > 0 ? s.toFixed(1) : fmt(left(side)), on: run && S.pos.side === side, low: s < 10 && !S.over, sec: s, total: S.tc.initial / 1000, side, sub: '' }; };
        ChessClock.paint(ck, [blk(-mc, mc > 0 ? S.black : S.white), blk(mc, mc > 0 ? S.white : S.black)]);
      };
      const paint = () => {
        if (G !== S) return; const mc = myColor(), mine = !S.over && mc && S.pos.side === mc, last = S.hist.length ? S.hist[S.hist.length - 1] : null;
        board.set(S.pos.fen(), { who: mine ? mc : 0, flipped: mc < 0, last: last ? [last.f, last.t] : null, pre: !S.over && mc && !mine ? mc : 0, clearPre: S.over });
        const opp = mc < 0 ? S.white : S.black, mep = mc < 0 ? S.black : S.white;
        q('lctop').innerHTML = '<b>' + esc(name(opp)) + '</b><span class="small mute">' + esc(rating(opp)) + '</span>' + (S.gone && S.gone.gone ? ' <span class="small" style="color:var(--warn)">left the game</span>' : '');
        q('lcbot').innerHTML = '<b>' + esc(name(mep)) + '</b><span class="small mute">' + esc(rating(mep)) + '</span>';
        let s = ''; S.hist.forEach((x, i) => { if (i % 2 === 0) s += (i ? '<br>' : '') + '<span class="mute" style="display:inline-block;width:2.2em">' + (i / 2 + 1) + '.</span>'; s += '<span style="display:inline-block;width:5.4em">' + esc(x.san) + '</span>'; }); const ml = q('lcml'); ml.innerHTML = s; ml.scrollTop = 1e6;
        q('lcres').textContent = S.moves.length < 2 ? 'Abort' : 'Resign'; q('lcres').disabled = S.over; q('lcdr').disabled = S.over || S.moves.length < 2;
        if (!S.over) status(mine ? 'Your move.' : mc ? 'Waiting for ' + name(opp) + '…' : 'Watching.');
        const ask = q('lcask'); const oppC = mc > 0 ? 'b' : 'w';
        ask.innerHTML = S.over ? '' : (S.offer[oppC + 'draw'] ? '<div class="acmsg">🤝 ' + esc(name(opp)) + ' offers a draw. <button class="pri" data-x="drawyes">Accept</button> <button class="ib" data-x="drawno">Decline</button></div>' : '') + (S.offer[oppC + 'takeback'] ? '<div class="acmsg">↩ ' + esc(name(opp)) + ' asks to take back a move. <button class="ib" data-x="tbyes">Allow</button> <button class="ib" data-x="tbno">Refuse</button></div>' : '') + (S.gone && S.gone.gone ? '<div class="acmsg">Your opponent left. ' + (S.gone.claimWinInSeconds > 0 ? 'You can claim the win in ' + S.gone.claimWinInSeconds + ' s.' : '<button class="pri" data-x="claim">Claim the win</button> <button class="ib" data-x="claimdraw">Call it a draw</button>') + '</div>' : '');
        clocks();
      };
      const finish = () => {
        S.over = true; if (!events.games.some(g => g.gameId !== S.id)) setLive(false); clearInterval(tick); board.premoves = [];
        const mc = myColor(), r = S.winner ? (S.winner === 'white' ? 1 : -1) : 0, label = STATUS[S.status] || 'Game over';
        const you = !mc ? '' : S.status === 'aborted' || S.status === 'noStart' ? '' : r === 0 ? (/^Draw/.test(label) ? '' : ' · Draw.') : r === mc ? ' · You won! 🎉' : ' · You lost.';
        status(label + you, r && r === mc ? 'var(--ok)' : ''); paint();
        if (r && r === mc) try { ChessFx.confetti({ n: 60 }); } catch (e) { }
        /* the game goes into Analysis like any other, now that analysis is allowed again */
        if (S.moves.length >= 2 && S.status !== 'aborted' && !S.saved) { S.saved = 1; try { const g = ChessAna.GS.add({ white: name(S.white), black: name(S.black), result: r > 0 ? '1-0' : r < 0 ? '0-1' : '1/2-1/2', moves: S.moves.slice(), human: mc || 1, elo: ((mc < 0 ? S.white : S.black) || {}).rating, src: 'lichess', event: 'Lichess ' + (S.rated ? 'rated ' : '') + (S.speed || '') + ' game', site: 'https://lichess.org/' + S.id, date: new Date().toISOString(), reason: label }); S.gid = g.id; } catch (e) { } }
        q('lcask').innerHTML = '<div class="row" style="gap:6px;flex-wrap:wrap">' + (S.gid ? '<button class="pri" data-x="review">🔬 Analyse in Moundshroud</button>' : '') + '<a class="ib" href="https://lichess.org/' + esc(S.id) + '" target="_blank" rel="noopener noreferrer">Open on Lichess ↗</a><button class="ib" data-x="lobby">Play again</button></div>';
      };
      const state = st => {
        S.moves = String(st.moves || '').split(' ').filter(Boolean); S.wt = st.wtime; S.bt = st.btime; S.at = performance.now(); S.status = st.status; S.winner = st.winner || '';
        S.offer = { wdraw: !!st.wdraw, bdraw: !!st.bdraw, wtakeback: !!st.wtakeback, btakeback: !!st.btakeback };
        rebuild(); paint();
        if (!['created', 'started'].includes(st.status)) finish(); else { setLive(true, S.id); premoves(); }
      };
      /* premoves: played the moment it is your turn, if they are still legal */
      const premoves = () => {
        const mc = myColor(); if (S.over || !mc || S.pos.side !== mc || !board.premoves || !board.premoves.length) return;
        const l = S.pos.legal(); let play = null, dropped = 0;
        while (board.premoves.length) { const pm = board.premoves.shift(); const c = l.filter(x => (x & 63) === pm.from && ((x >> 6) & 63) === pm.to && (!pm.promo || ((x >> 12) & 7) === pm.promo)); if (c.length) { play = c.find(x => ((x >> 12) & 7) === (pm.promo || 5)) || c[0]; break; } dropped++; }
        if (dropped) A.toast(dropped === 1 ? 'A premove was no longer possible, so it was dropped.' : dropped + ' premoves were no longer possible.', 3000);
        if (play !== null) send(play);
      };
      const send = async m => {
        const mc = myColor(); if (S.over || !mc || S.pos.side !== mc) return;
        const u = S.pos.uci(m); S.moves.push(u); rebuild(); paint();          // shown at once; Lichess confirms or the next update puts it right
        const r = await api('move', { id: S.id, move: u }).catch(e => ({ error: e.message }));
        if (r.error && G === S) { A.toast(r.error); S.moves.pop(); rebuild(); paint(); }
      };
      board.onmove = m => send(m);
      const addChat = (who, text, mine) => { const c = q('lcchat'); if (!c) return; const d = document.createElement('div'); d.style.cssText = 'padding:3px 8px;border-radius:8px;max-width:92%;overflow-wrap:anywhere;' + (mine ? 'align-self:flex-end;background:var(--user)' : who === 'lichess' ? 'align-self:center;color:var(--mute);font-size:12px' : 'align-self:flex-start;background:var(--panel2)'); d.textContent = (mine || who === 'lichess' ? '' : who + ': ') + text; c.appendChild(d); c.scrollTop = c.scrollHeight; };
      const chatSend = async () => { const i = q('lcin'), t = i.value.trim(); if (!t) return; i.value = ''; const r = await api('chat', { id: S.id, text: t }); if (r.error) A.toast(r.error); };
      q('lcsend').onclick = chatSend; q('lcin').onkeydown = e => { e.stopPropagation(); if (e.key === 'Enter') chatSend(); };
      q('lcflip').onclick = () => { board.flipped = !board.flipped; board.draw(); };
      q('lcres').onclick = async () => { const abort = S.moves.length < 2; if (!confirm(abort ? 'Abort this game? It will not count.' : 'Resign this game?')) return; const r = await api(abort ? 'abort' : 'resign', { id: S.id }); if (r.error) A.toast(r.error); };
      q('lcdr').onclick = async () => { const r = await api('draw', { id: S.id, yes: true }); if (r.error) A.toast(r.error); else A.toast('Draw offered.'); };
      q('lcback').onclick = () => { if (!S.over && !confirm('Go back to the lobby? The game keeps running on Lichess (and your clock with it); you can come back with Resume. Engines stay locked until it ends.')) return; skipAuto.add(S.id); lobby(); };
      host.querySelector('.acside').addEventListener('click', async e => {
        const b = e.target.closest('[data-x]'); if (!b) return; const x = b.dataset.x;
        const call = { drawyes: ['draw', { yes: true }], drawno: ['draw', { yes: false }], tbyes: ['takeback', { yes: true }], tbno: ['takeback', { yes: false }], claim: ['claimWin', {}], claimdraw: ['claimDraw', {}] }[x];
        if (call) { const r = await api(call[0], Object.assign({ id: S.id }, call[1])); if (r.error) A.toast(r.error); return; }
        if (x === 'lobby') lobby();
        if (x === 'review' && S.gid) { UI.pending = { id: S.gid }; UI.show('analysis'); }
      });
      tick = setInterval(() => { if (G === S && !S.over) clocks(); }, 200);
      gameCtl = new AbortController(); listen2();
      function listen2() {
        readStream('/api/lichess/game?id=' + encodeURIComponent(id), { signal: gameCtl.signal }, e => {
          if (G !== S) return;
          if (e.type === 'error') { S.fails = (S.fails || 0) + 1; status(e.error + (S.fails < 5 ? ' Trying again…' : ''), 'var(--bad)'); return; }
          S.fails = 0;
          if (e.type === 'gameFull') { S.white = e.white || {}; S.black = e.black || {}; S.start = e.initialFen || 'startpos'; S.rated = !!e.rated; S.speed = e.speed || ''; S.tc = e.clock || null; if (e.variant && e.variant.key !== 'standard') { status('This game is ' + (e.variant.name || 'a variant') + ', which Moundshroud cannot show. Play it on Lichess.', 'var(--warn)'); } state(e.state || {}); (e.state && e.state.chat || []).forEach(c => addChat(c.username, c.text, String(c.username).toLowerCase() === me)); }
          if (e.type === 'gameState') state(e);
          if (e.type === 'chatLine' && e.room === 'player') addChat(e.username, e.text, String(e.username).toLowerCase() === me);
          if (e.type === 'opponentGone') { S.gone = e; paint(); }
        }).then(() => { if (G === S && !S.over && !dead && (S.fails || 0) < 5) setTimeout(() => { if (G === S && !S.over && !dead) { gameCtl = new AbortController(); listen2(); } }, 1500 * Math.max(1, S.fails || 0)); else if (G === S && !S.over && !dead) status('The connection to this game was lost. Go back to the lobby and press Resume, or open it on Lichess.', 'var(--bad)'); }).catch(() => { });      // a dropped connection reconnects by itself, a few times
      }
      listen();                          // keep hearing about challenges during the game, so nothing is missed
    }

    start();
    return () => { dead = true; stopAll(); G = null; };
  };
})();

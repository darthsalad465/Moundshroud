// Automated checks for the parts that are easy to break and hard to notice: the chess rules every board in the app uses
// (games, lessons, puzzles, analysis, variants) and the small pieces of bookkeeping around them.
// Run it with:  node tests\run.js        (no install, no internet, a couple of seconds)
// The in-app self-test (Settings > Run a self-test) covers the pages and services; this covers the logic underneath them,
// which is where a quiet regression like "castling stopped working" would otherwise only be found by a person playing.
const path = require('path');

let pass = 0, fail = 0;
function ok(name, cond, detail) {
  if (cond) { pass++; console.log('  ok   ' + name); }
  else { fail++; console.log('  FAIL ' + name + (detail ? '  ->  ' + detail : '')); }
}
const eq = (name, got, want) => ok(name, got === want, 'got ' + JSON.stringify(got) + ', wanted ' + JSON.stringify(want));

const engine = require(path.join(__dirname, '..', 'web', 'js', 'chess-engine.js'));
const C = engine.Chess || engine;                       // browser: window.Chess; node: module.exports.Chess
const P = fen => new C.Pos().setFen(fen);

console.log('chess rules');

/* the start position */
{
  const p = P(C.START);
  eq('start position has 20 legal moves', p.legal().length, 20);
  eq('start FEN survives a round trip', p.fen(), C.START);
  eq('white to move at the start', p.side, 1);
}

/* perft: the standard way to prove a move generator is actually right */
{
  const p = P(C.START);
  eq('perft 1 from the start', p.perft(1), 20);
  eq('perft 2 from the start', p.perft(2), 400);
  eq('perft 3 from the start', p.perft(3), 8902);
  /* Kiwipete: castling both sides, pins, en passant and promotions in one position */
  const k = P('r3k2r/p1ppqpb1/bn2pnp1/3PN3/1p2P3/2N2Q1p/PPPBBPPP/R3K2R w KQkq - 0 1');
  eq('perft 1 (Kiwipete)', k.perft(1), 48);
  eq('perft 2 (Kiwipete)', k.perft(2), 2039);
}

/* castling */
{
  const p = P('r3k2r/8/8/8/8/8/8/R3K2R w KQkq - 0 1');
  const moves = p.legal();
  const castle = moves.filter(m => (m & 63) === 60 && Math.abs(((m >> 6) & 63) - 60) === 2);
  eq('both castles are generated', castle.length, 2);
  const q = P('r3k2r/8/8/8/8/8/8/R3K2R w KQkq - 0 1');
  q.make(q.fromUci('e1g1'));
  ok('castling moves the rook too', q.b[63] === 0 && q.b[61] === 4, 'rook ended on ' + q.b[61]);
  ok('castling takes the right away', !/K/.test(q.fen().split(' ')[2]), q.fen());
}

/* en passant, promotion, stalemate, mate */
{
  const p = P('rnbqkbnr/ppp1pppp/8/3pP3/8/8/PPPP1PPP/RNBQKBNR w KQkq d6 0 3');
  /* e5 pawn (28) can take on d6 (19) which is empty: the en passant square in the FEN */
  ok('en passant capture is offered', p.legal().some(m => (m & 63) === 28 && ((m >> 6) & 63) === 19), p.fen());
  const ep = P('rnbqkbnr/ppp1pppp/8/3pP3/8/8/PPPP1PPP/RNBQKBNR w KQkq d6 0 3');
  ep.make(ep.legal().find(m => (m & 63) === 28 && ((m >> 6) & 63) === 19));
  ok('en passant removes the captured pawn', ep.b[27] === 0 && ep.b[19] === 1, ep.fen());
  const q = P('8/P7/8/8/8/8/7p/4K2k w - - 0 1');
  eq('a promotion offers four pieces', q.legal().filter(m => (m & 63) === 8).length, 4);
  const s = P('7k/5Q2/6K1/8/8/8/8/8 b - - 0 1');
  eq('stalemate has no legal moves', s.legal().length, 0);
  ok('stalemate is not check', !s.inCheck());
  const m = P('rnb1kbnr/pppp1ppp/8/4p3/6Pq/5P2/PPPPP2P/RNBQKBNR w KQkq - 1 3');
  eq("fool's mate has no legal moves", m.legal().length, 0);
  ok("fool's mate is check", m.inCheck());
}

/* SAN and the move keys the app stores games with */
{
  const p = P(C.START);
  const m = p.fromUci('e2e4');
  eq('SAN of 1.e4', p.san(m), 'e4');
  eq('UCI round trip', p.uci(m), 'e2e4');
  p.make(m);
  const k = P(p.fen()).key();
  eq('the position key is stable across copies', k, p.key());
}

/* the premove rule the online board relies on: "could this piece ever go there?"
   (own piece in the way, or a pawn capture onto a square that is empty for now) */
{
  /* a pawn on e4 with nothing on d5: the diagonal is not legal yet, but a capture there becomes legal the moment a piece arrives */
  const p = P('4k3/8/8/8/4P3/8/8/4K3 w - - 0 1');
  ok('a pawn cannot capture an empty square right now', !p.legal().some(m => (m & 63) === 36 && ((m >> 6) & 63) === 27));
  const withPawn = P('4k3/8/8/3p4/4P3/8/8/4K3 w - - 0 1');
  ok('...and can once a piece stands there', withPawn.legal().some(m => (m & 63) === 36 && ((m >> 6) & 63) === 27));
  /* a bishop whose own knight is on the square it would like: legal again once that knight is gone */
  const blocked = P('4k3/8/8/3N4/2B5/8/8/4K3 w - - 0 1');
  ok('the bishop is blocked by its own knight', !blocked.legal().some(m => (m & 63) === 34 && ((m >> 6) & 63) === 27));
  const free = P('4k3/8/8/3n4/2B5/8/8/4K3 w - - 0 1');
  ok('...and can recapture once it is an enemy piece', free.legal().some(m => (m & 63) === 34 && ((m >> 6) & 63) === 27));
}

/* News: feeds are read correctly, opinion is told apart from news, and the same story from different outlets becomes one event */
{
  const N = require(path.join(__dirname, '..', 'lib', 'news.js'));
  const rss = '<rss><channel><item><title><![CDATA[Quake &amp; tsunami hit coast]]></title><link>https://a.example/1</link><description>&lt;p&gt;A strong quake struck.&lt;/p&gt;</description><pubDate>Fri, 30 Oct 2026 10:00:00 GMT</pubDate><media:thumbnail url="https://a.example/i.jpg"/></item></channel></rss>';
  const atom = '<feed><entry><title>Second story</title><link rel="alternate" href="https://b.example/2"/><updated>2026-10-30T11:00:00Z</updated><summary>Text</summary></entry></feed>';
  const p1 = N.parse(rss)[0], p2 = N.parse(atom)[0];
  ok('news: RSS and Atom feeds are read', p1 && p1.title === 'Quake & tsunami hit coast' && p1.desc === 'A strong quake struck.' && p1.img === 'https://a.example/i.jpg' && p2 && p2.link === 'https://b.example/2' && p2.date === Date.parse('2026-10-30T11:00:00Z'), JSON.stringify([p1, p2]));
  ok('news: opinion is labelled, news is not', N.genre({ title: 'Opinion: the senate is wrong', link: 'https://x/a', cat: '' }, { kind: 'paper' }) === 'opinion' && N.genre({ title: 'Senate passes bill', link: 'https://x/opinion/a', cat: '' }, { kind: 'paper' }) === 'opinion' && N.genre({ title: 'Senate passes bill', link: 'https://x/politics/a', cat: '' }, { kind: 'paper' }) === 'news');
  const now = Date.now(), mk = (i, src, title, desc) => ({ id: 'a' + i, src, title, desc: desc || '', link: 'https://' + src + '.example/' + i, date: now - i * 60000, img: '', secs: ['world'], genre: 'news', via: '' });
  const arts = [
    mk(1, 'bbc', 'Earthquake of magnitude 7.1 strikes off Japan coast, tsunami warning issued', 'A powerful earthquake hit northern Japan.'),
    mk(2, 'nyt', 'Powerful 7.1 Earthquake Strikes Japan, Prompting Tsunami Warning', 'Residents of northern Japan were told to move to higher ground.'),
    mk(3, 'fox', 'Japan earthquake: 7.1 magnitude quake triggers tsunami warning', 'Officials in Japan issued warnings.'),
    mk(4, 'guardian', 'Bank of England holds interest rates at 4% as inflation eases', 'The Bank of England kept rates on hold.'),
    mk(5, 'ft', 'Bank of England keeps interest rates on hold at 4%', 'Policymakers voted to hold rates as inflation eased.'),
    mk(6, 'espn', 'Brewers win the World Series in seven games', 'Milwaukee won game seven.')
  ];
  for (let i = 0; i < 40; i++) arts.push(mk(100 + i, 'filler' + (i % 5), 'Unrelated item number ' + i + ' about topic ' + ['farming', 'chess', 'ballet', 'pottery', 'sailing', 'baking', 'opera', 'cycling'][i % 8] + ' ' + i, 'Nothing to do with anything else ' + i));
  const E = N.build(arts, now), quake = E.events.find(e => /earthquake|quake/i.test(e.title)), bank = E.events.find(e => /bank of england/i.test(e.title));
  ok('news: the same story from different outlets is one event', quake && quake.outlets.length === 3 && bank && bank.outlets.length === 2, E.events.map(e => e.title + ' (' + e.outlets.join(',') + ')').join(' | '));
  ok('news: different stories stay apart, and single-source stories are not events', !E.events.some(e => e.outlets.includes('espn')) && E.singles.includes('a6') && quake && !quake.outlets.includes('guardian'));
  /* the expert's tools: the archive search language, and a weekly column must not be credited with breaking a story */
  {
    const fs2 = require('fs'), src = fs2.readFileSync(path.join(__dirname, '..', 'lib', 'news.js'), 'utf8');
    ok('news: the archive search understands "phrases" and -exclusions', /rest\.split\(\/\\s\+\/\)/.test(src) && /neg\.push/.test(src), 'search parser changed');
    const col = mk(7, 'maverick', 'CRYPTO CORNER: Bitcoin turns 18 as markets wobble and Japan watches', 'Our weekly column on crypto prices.');
    const E2 = N.build(arts.concat([col]), now), q2 = E2.events.find(e => /earthquake|quake/i.test(e.title));
    ok('news: an article that only brushes a story is not part of its event', q2 && !q2.articles.includes('a7'), q2 ? q2.articles.join(',') : 'no quake event');
  }
  /* privacy: outlets cannot tell this is Moundshroud; the Google relay is off unless chosen; the window switches agree */
  {
    const fs2 = require('fs'), rd = f => fs2.readFileSync(path.join(__dirname, '..', f), 'utf8');
    ok('privacy: outgoing requests do not name the app', !/const UA = '[^']*Moundshroud/.test(rd('lib/news.js')) && !/const UA = '[^']*Moundshroud/.test(rd('lib/net.js')));
    ok('privacy: news through Google is off unless switched on', N.sources().filter(s => s.via === 'google').every(s => !s.on) || /"google":\s*true/.test((() => { try { return rd('data/news-sources.json'); } catch (e) { return ''; } })()));
    const P = require(path.join(__dirname, '..', 'lib', 'privacy.js')), cs = rd('Listener.cs'), ps = rd('open-moundshroud.ps1');
    const missing = P.EDGE_ARGS.filter(a => !cs.includes(a) || !ps.includes(a));
    ok('privacy: both launchers start the window with every privacy switch', missing.length === 0, missing.join(' '));
  }
  /* opinion sections are always opinion, and the outlets' opinion addresses are recognised */
  ok('news: anything from an opinion section is labelled opinion', N.genre({ title: 'A plain headline', link: 'https://x/politics/a', cat: '' }, { kind: 'paper' }, 'opinion') === 'opinion' && N.genre({ title: 'A plain headline', link: 'https://www.theguardian.com/commentisfree/2026/oct/30/x', cat: '' }, { kind: 'paper' }) === 'opinion');
  ok('news: the op-ed page has voices from the left and the right', ['L', 'LL'].some(l => N.SOURCES.some(s => s.lean === l && s.feeds.some(f => f[1] === 'opinion'))) && ['R', 'LR'].some(l => N.SOURCES.some(s => s.lean === l && s.feeds.some(f => f[1] === 'opinion'))));
  /* markets: nothing goes out while internet access is off, and every market on the overview has a chart symbol */
  {
    const M = require(path.join(__dirname, '..', 'lib', 'markets.js')), net2 = require(path.join(__dirname, '..', 'lib', 'net.js'));
    const was = net2.on; net2.on = () => false;
    Promise.all([M.quotes('AAPL'), M.chart('AAPL', '1y'), M.search('apple'), M.weather(1, 2, 'f')]).then(rs => { net2.on = was; ok('markets: nothing is fetched while internet access is off', rs.every(r => r.error === 'off')); });
    const src = require('fs').readFileSync(path.join(__dirname, '..', 'web', 'js', 'markets.js'), 'utf8'), groups = (src.match(/const GROUPS = (\[[\s\S]*?\]\]\]);/) || [])[1];
    const syms = groups ? JSON.parse(groups.replace(/'/g, '"')).flatMap(g => g[1]) : [];
    /* indices, futures, currencies and crypto need a Yahoo spelling; Treasury yields are charted through CNBC's fallback */
    ok('markets: every overview market can be charted', syms.length > 20 && syms.every(s => !/^[.@]|=$/.test(s) || M.YAHOO[s]), syms.filter(s => /^[.@]|=$/.test(s) && !M.YAHOO[s]).join(' '));
  }
  /* Stock up removal only ever touches what it listed; the App map describes every file */
  {
    const I = require(path.join(__dirname, '..', 'lib', 'inventory.js')), MAP = require(path.join(__dirname, '..', 'lib', 'appmap.js'));
    Promise.all(['zim:../../server.js', 'voice:../../server', 'music:..', 'chessbook:../x', 'model:`rm`', 'nope', 'zim:not-there.zim', 'music:../../lib'].map(x => I.remove(x))).then(rs => ok('stock up: removal refuses anything it did not list', rs.every(r => r && r.error), rs.map(r => JSON.stringify(r)).join(' ')));
    MAP.build(47231).then(m => {
      ok('app map: every code file has a description', m.files.length > 200 && m.files.every(f => f.desc), m.files.filter(f => !f.desc).map(f => f.path).join(', '));
      ok('app map: the server addresses and tab sections are found', m.endpoints.length > 100 && m.sections.some(s => s.tabs.some(t => t.id === 'news')), m.endpoints.length + ' addresses');
    });
    const ts = I.torStatus();
    ok('tor: its status says whether it is installed', typeof ts.installed === 'boolean', JSON.stringify(ts));
    ok('tor: stock up can remove it', typeof I.remove === 'function' && /torbrowser/.test(require('fs').readFileSync(path.join(__dirname, '..', 'lib', 'inventory.js'), 'utf8')));
  }
  /* Chess › Scan: the parts that do not need a picture (FEN, castling, the sense checks, straightening the board) */
  {
    const vm = require('vm'), win = { Chess: C };
    vm.runInNewContext(require('fs').readFileSync(path.join(__dirname, '..', 'web', 'js', 'chess-scan.js'), 'utf8'), { window: win, Math, Array, Object, String, Number, JSON, Promise, Error });
    const S = win.ChessScan, ex = f => { const b = []; f.split('/').forEach(r => { for (const ch of r) { if (/\d/.test(ch)) for (let k = 0; k < +ch; k++) b.push(''); else b.push(ch); } }); return b; };
    const start = ex('rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR');
    eq('scan: the starting position becomes the starting FEN, with all castling', S.fenOf(start, 'w'), 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1');
    eq('scan: castled kings give no castling rights', S.fenOf(ex('r4rk1/1b2qppp/p2p1n2/1pn1p3/4P3/1BN2N2/PPP1QPPP/R4RK1'), 'b').split(' ').slice(1, 3).join(' '), 'b -');
    eq('scan: only the rooks still at home count', S.fenOf(ex('4k2r/8/8/8/8/8/8/R3K3'), 'w').split(' ')[2], 'Qk');
    eq('scan: "No castling" takes them all away', S.fenOf(start, 'w', { noCastle: true }).split(' ')[2], '-');
    eq('scan: a sound position has no problems', S.problems(start, 'w').length, 0);
    ok('scan: two white kings are caught', S.problems(ex('k7/8/8/8/8/8/8/K6K'), 'w').some(t => /white king/.test(t)));
    ok('scan: a missing black king is caught', S.problems(ex('8/8/8/8/8/8/8/K7'), 'w').some(t => /black king/.test(t)));
    ok('scan: a pawn on the last rank is caught', S.problems(ex('P3k3/8/8/8/8/8/8/4K3'), 'w').some(t => /pawn/.test(t)));
    ok('scan: nine pawns are caught', S.problems(ex('4k3/8/8/8/8/p7/PPPPPPPP/P3K3'), 'w').some(t => /eight pawns/.test(t)));
    ok('scan: the side not to move cannot be in check', S.problems(ex('4k3/8/8/8/8/8/8/K3R3'), 'w').some(t => /check/.test(t)));
    /* straightening: the corners of the flat square land exactly on the four corners of a tilted board */
    const pts = [[40, 30], [420, 60], [400, 410], [20, 380]], H = S._t.homography(pts), at = (u, v) => { const w = H[6] * u + H[7] * v + 1; return [(H[0] * u + H[1] * v + H[2]) / w, (H[3] * u + H[4] * v + H[5]) / w]; };
    ok('scan: the straightening lands each corner on a corner of the board', [[0, 0], [1, 0], [1, 1], [0, 1]].every(([u, v], i) => Math.hypot(at(u, v)[0] - pts[i][0], at(u, v)[1] - pts[i][1]) < 1e-6), JSON.stringify([[0, 0], [1, 0], [1, 1], [0, 1]].map(([u, v]) => at(u, v))));
  }
  /* Updates: version order, where updates may come from, and that the installer never overwrites the data folder */
  {
    const UT = require(path.join(__dirname, '..', 'lib', 'update.js'))._t, fs3 = require('fs');
    ok('updates: 1.3.10 is newer than 1.3.9', UT.newer('1.3.10', '1.3.9') && !UT.newer('1.3.9', '1.3.10'));
    ok('updates: the same version is not newer', !UT.newer('1.3.0', '1.3.0') && UT.newer('1.4', '1.3.9'));
    ok('updates: GitHub over https is allowed', UT.okHost(new URL('https://github.com/a/b/releases/latest/download/latest.json')) && UT.okHost(new URL('https://objects.githubusercontent.com/x')));
    ok('updates: anything else is refused', ![
      'http://github.com/a', 'https://evil.com/x', 'https://github.com.evil.com/x', 'https://githubusercontent.com.evil.com/x', 'http://127.0.0.1:9/x'
    ].some(u => UT.okHost(new URL(u))));
    const was = process.env.MOUNDSHROUD_UPDATE_TEST;
    process.env.MOUNDSHROUD_UPDATE_TEST = 'http://evil.com:80'; const s1 = UT.source();
    ok('updates: the test override only accepts this PC', !(s1 && s1.test));
    if (was === undefined) delete process.env.MOUNDSHROUD_UPDATE_TEST; else process.env.MOUNDSHROUD_UPDATE_TEST = was;
    const ap = fs3.readFileSync(path.join(__dirname, '..', 'apply-update.ps1'), 'utf8');
    ok('updates: the installer never replaces a file in data\\', /if \(\$rel -like 'data\\\*'\) \{ if \(Test-Path \$dest\) \{ continue \} \}/.test(ap));
    ok('updates: the installer keeps the replaced files and can put them back', /update-backup/.test(ap) && /Putting \$OldVersion back/.test(ap));
    const mr = fs3.readFileSync(path.join(__dirname, '..', 'make-release.ps1'), 'utf8');
    ok('release: the package carries the installer and the update source', /'apply-update\.ps1', 'update\.json'/.test(mr));
    ok('release: the privacy scan reads data\\private-words.txt', /Join-Path \$root 'data\\private-words\.txt'/.test(mr));
  }
  /* Lichess: the token check, the speed rule, and the fair-play lock */
  {
    const L = require(path.join(__dirname, '..', 'lib', 'lichess.js')), fs2 = require('fs');
    L.connect('not a token').then(r => ok('lichess: something that is not a token is refused before anything is sent', /lip_/.test(r.error || ''), JSON.stringify(r)));
    let out = ''; const res = { headersSent: false, writeHead() { this.headersSent = true; }, end(t) { out += t || ''; }, write() { }, on() { } };
    L.seek({ time: 3, increment: 2 }, res);
    ok('lichess: looking for strangers at Blitz is refused (Lichess allows Rapid and slower only)', /Rapid/.test(out), out);
    ok('lichess: no game is being played, so the engines are free', L.live() === false);
    const srv = fs2.readFileSync(path.join(__dirname, '..', 'server.js'), 'utf8');
    ok('lichess: the server refuses Stockfish while a game is being played', /lichess\.live\(\) && \(url === '\/api\/sf\/go' \|\| url === '\/api\/sf\/ana'/.test(srv));
    const hub = fs2.readFileSync(path.join(__dirname, '..', 'web', 'js', 'play-chess-study.js'), 'utf8'), lc = fs2.readFileSync(path.join(__dirname, '..', 'web', 'js', 'chess-lichess.js'), 'utf8'), cv = fs2.readFileSync(path.join(__dirname, '..', 'web', 'js', 'chess-voice.js'), 'utf8');
    ok('lichess: the other chess sections stay shut during a game', /ChessFair\.live && t !== 'lichess'/.test(hub) && /\['lichess', '♞ Lichess'\]/.test(hub));
    ok('lichess: the built-in engine refuses during a game, and no AI sees the board', /fair\.live \? Promise\.resolve\(\{ error: 'locked' \}\)/.test(lc) && /data-private/.test(lc) && /ChessFair && ChessFair\.live\) && pool\.length/.test(cv));
  }
  /* Claude: what is sent to Anthropic (checked by catching the request before it leaves) */
  {
    const C = require(path.join(__dirname, '..', 'lib', 'cloud.js'));
    ok('claude: a key that is not an Anthropic key is refused with a reason', /sk-ant-/.test(C.keyProblem('sk-' + 'x'.repeat(32))) && /Admin/.test(C.keyProblem('sk-ant-admin01-' + 'x'.repeat(90))) && C.keyProblem('sk-ant-api03-' + 'x'.repeat(95)) === '');
    const r1 = C.shape({ model: 'claude-sonnet-5-5', messages: [{ role: 'system', content: 'sys' }, { role: 'user', content: 'hi' }], options: { temperature: .3, top_p: .9 } });
    ok('claude: no temperature or top_p is ever sent (API version 2026-10-21 rejects them)', !('temperature' in r1) && !('top_p' in r1) && !('top_k' in r1), JSON.stringify(r1));
    ok('claude: declined requests can be answered by another Claude model (fallbacks: default)', r1.fallbacks === 'default' && r1.system === 'sys');
    ok('claude: Haiku is sent without fallbacks (it has none)', !('fallbacks' in C.shape({ model: 'claude-haiku-5-5', messages: [{ role: 'user', content: 'hi' }] })));
    ok('claude: the page is never told the key', !/sk-ant/.test(JSON.stringify(C.status())));
    const src = require('fs').readFileSync(path.join(__dirname, '..', 'lib', 'cloud.js'), 'utf8');
    ok('claude: the key is kept encrypted by Windows, never in plain text', /WS\.protect\(/.test(src) && /delete n\.key; n\.keyBlob = blob/.test(src) && /'server-side-fallback-2026-07-01'/.test(src) && /stop_reason === 'refusal'/.test(src));
  }
  /* library pages live on their own address and cannot reach the app */
  {
    const fs2 = require('fs'), rd = f => fs2.readFileSync(path.join(__dirname, '..', f), 'utf8'), srv = rd('server.js');
    ok('library: pages are served from their own address, with only that address reachable', /const LIBPORT = PORT \+ 9/.test(srv) && /connect-src 'self'; frame-src 'self'/.test(srv) && /frame-ancestors " \+ app/.test(srv));
    ok('library: the app lets that address be shown in a frame (and nothing else new)', /frame-src 'self' blob: data: http:\/\/127\.0\.0\.1:" \+ LIBPORT \+ " http:\/\/localhost:" \+ LIBPORT \+ ";/.test(srv));
    ok('library: a library page opened on the app’s own address is walled off without scripts', /hd\['content-security-policy'\] = "sandbox; default-src 'none'/.test(srv));
    const lib = rd('web/js/lib.js'), br = rd('web/lib-bridge.js');
    ok('library: the Browser tab never reaches into a page directly', !/contentDocument|contentWindow/.test(lib) && /A\.libframe\.attach\(fr/.test(lib));
    ok('library: the page helper only answers the Moundshroud window', /e\.source !== window\.parent \|\| e\.origin !== APP/.test(br) && /postMessage\(Object\.assign\(\{ lf: 1 \}, o\), APP\)/.test(br));
  }
  /* daily copies stay on this PC unless chosen otherwise */
  {
    const S = require(path.join(__dirname, '..', 'lib', 'safe.js')), fs2 = require('fs');
    const placeFile = path.join(__dirname, '..', 'data', 'backup-place.json'), chosen = fs2.existsSync(placeFile) ? JSON.parse(fs2.readFileSync(placeFile, 'utf8')).place : 'local';
    ok('backups: the daily copies go where the person chose (this PC unless they picked OneDrive)', chosen === 'onedrive' ? /OneDrive/i.test(S.DEST) : !/OneDrive/i.test(S.DEST), S.DEST);
  }
  /* a page you are not on must never be able to show or catch clicks (two lines of styling once froze every page) */
  {
    const fs2 = require('fs'), wdir = path.join(__dirname, '..', 'web');
    const css = fs2.readdirSync(wdir).filter(f => f.endsWith('.css')).map(f => [f, fs2.readFileSync(path.join(wdir, f), 'utf8')]);
    const bad = []; css.forEach(([f, s]) => { s.replace(/(?:^|[},\s])(#p-[a-z]+)(?:\.on|:[\w-]+)*\s*\{([^}]*)\}/g, (m, sel, body) => { if (/display\s*:\s*(?!none)/.test(body)) bad.push(f + ': ' + sel); }); });
    ok('pages: no styling forces a page to show (only .panel.on may)', !bad.length, bad.join(', '));
    ok('pages: a page you are not on is always hidden and click-through', css.some(([f, s]) => /\.panel:not\(\.on\)\{display:none!important;pointer-events:none!important\}/.test(s)));
    const core = fs2.readFileSync(path.join(wdir, 'js', 'core.js'), 'utf8');
    ok('pages: one page failing to open cannot break tab switching', /try \{ const r = A\.tabs\[name\]\.onShow\(\); if \(r && r\.catch\) r\.catch\(fail\); \} catch \(e\) \{ fail\(e\); \}/.test(core));
  }
  /* every tab that registers itself must be in the tab bar's order, or it silently never appears */
  {
    const fs2 = require('fs'), dir = path.join(__dirname, '..', 'web', 'js');
    const main = fs2.readFileSync(path.join(dir, 'main.js'), 'utf8'), wanted = (main.match(/const wanted = \[([^\]]+)\]/) || [])[1] || '';
    const ids = []; fs2.readdirSync(dir).filter(f => f.endsWith('.js')).forEach(f => { const s = fs2.readFileSync(path.join(dir, f), 'utf8'); s.replace(/A\.registerTab\('([a-z]+)'/g, (m, id) => { ids.push(id); }); });
    const html = fs2.readFileSync(path.join(__dirname, '..', 'web', 'index.html'), 'utf8');
    const missing = ids.filter(id => !wanted.includes("'" + id + "'")), noPanel = ids.filter(id => !html.includes('id="p-' + id + '"'));
    ok('tabs: every tab is in the tab bar order', ids.length > 20 && !missing.length, 'missing: ' + missing.join(', '));
    ok('tabs: every tab has its panel', !noPanel.length, 'no panel: ' + noPanel.join(', '));
  }
  /* the October 2026 layout: the tabs made from moved tools are in the order, have a page, and sit in the right menu */
  {
    const fs2 = require('fs'), rd = f => fs2.readFileSync(path.join(__dirname, '..', 'web', f), 'utf8');
    const main = rd('js/main.js'), core = rd('js/core.js'), html = rd('index.html'), rg = rd('js/regroup.js');
    const made = [...rg.matchAll(/toolTab\('(\w+)'|studio\('\w+', '(\w+)'/g)].map(m => m[1] || m[2]);
    const groups = {}; [...core.matchAll(/\{ id: '(\w+)', icon: '[^']+', label: '([^']+)', tabs: \[([^\]]+)\]/g)].forEach(m => { groups[m[2]] = m[3]; });
    ok('layout: every new tab is in the order and has its page', made.length === 11 && made.every(id => main.includes("'" + id + "'") && html.includes('id="p-' + id + '"')), made.join(','));
    ok('layout: the menus are Office, Education, Personal and Entertainment', ['Office', 'Education', 'Personal', 'Entertainment'].every(g => groups[g]) && !groups.Knowledge && !groups.Learn && !groups.Life && !groups.Fun, Object.keys(groups).join(','));
    ok('layout: the moved tools sit in the menus that were asked for', ['docs', 'offed', 'calc', 'scan', 'meet', 'rem', 'clip', 'mail'].every(t => groups.Office.includes("'" + t + "'")) && ['writing', 'practice', 'teach'].every(t => groups.Education.includes("'" + t + "'")) && groups.Personal.includes("'albums'") && !/'studio'|'cyber'|'timeline'/.test(Object.values(groups).join()));
    ok('layout: Studio and Cyber are tabs of their own, and Timeline is in the Library', main.includes("'studio'") && main.includes("'cyber'") && !main.includes("'timeline'") && /lytl/.test(rd('js/library.js')));
  }
  /* every address that changes or deletes something must refuse a plain GET */
  {
    const srv = require('fs').readFileSync(path.join(__dirname, '..', 'server.js'), 'utf8');
    const clip = srv.slice(srv.indexOf("url.startsWith('/api/clip')"), srv.indexOf("url.startsWith('/api/clip')") + 1400);
    ok('clipboard history: only POST can clear, delete or switch it', /req\.method !== 'POST'/.test(clip) && clip.indexOf("req.method !== 'POST'") < clip.indexOf('/api/clip/clear'));
    const risky = /url === '\/api\/[\w/-]*(clear|delete|remove|forget|clean|restore|reindex|save|toggle|open|pull|get|fix|new|create)'(?! && req\.method === 'POST')/g;
    const bad = (srv.match(risky) || []).filter(m => !/clip\//.test(m) && !/notes\/get/.test(m));
    ok('no other changing address answers a plain GET', bad.length === 0, bad.join(', '));
  }
  /* the password vault: strength, the generator, CSV import, the server's checks */
  {
    const src = require('fs').readFileSync(path.join(__dirname, '..', 'web', 'js', 'vault.js'), 'utf8');
    const A2 = { api: async () => ({}), toast() { }, cmd: null };
    new Function('A', 'crypto', 'addEventListener', 'setInterval', src)(A2, require('crypto').webcrypto, () => { }, () => 0);
    const T = A2.vault._test;
    ok('vault: common passwords are weak', T.strength('password123').score <= 1 && T.strength('Summer2024!').score <= 2);
    ok('vault: a long random one is strong', T.strength('J23^AqBTpt*zyCD=w=P+').score === 4);
    const g = T.generate({ kind: 'chars', len: 24, lower: true, upper: true, digits: true, symbols: true, easy: true });
    ok('vault: the generator uses every kind asked for, without look-alikes', g.length === 24 && /[a-z]/.test(g) && /[A-Z]/.test(g) && /\d/.test(g) && /[^a-zA-Z0-9]/.test(g) && !/[lIO01]/.test(g), g);
    ok('vault: a PIN is only digits', /^\d{6}$/.test(T.generate({ kind: 'pin', len: 6 })));
    const c = T.parseCsv('name,url,username,password\r\n"A, b",https://x.example,u,"p""q,r"\r\n');
    ok('vault: CSV import handles quotes and commas', c.items && c.items[0].title === 'A, b' && c.items[0].pw === 'p"q,r', JSON.stringify(c));
    ok('vault: a CSV without passwords is refused', !!T.parseCsv('a,b\n1,2').error);
    const V = require(path.join(__dirname, '..', 'lib', 'vault.js'));
    ok('vault: the server refuses anything that is not an encrypted vault', !!V.save({ v: 1, salt: 'x', iv: 'y', ct: 'plain text!', iter: 600000 }).error && !!V.save({ items: [] }).error);
    ok('vault: clipboard clean-up only takes a fingerprint', !!V.scrubClipboard('my password').error);
    ok('vault: the window and the server make the same fingerprint', require('crypto').createHash('sha256').update('héllo-test', 'utf8').digest('hex') === '3061cdf9f2670fdef6b0773a20ac42933d12f3772eb3d475dc936c06e00efbdf');
  }
  /* photos: the date a photo was taken is read from its EXIF data; previews and files are only for indexed photos */
  {
    const P = require(path.join(__dirname, '..', 'lib', 'photos.js')), fs2 = require('fs'), os2 = require('os');
    const t = Buffer.alloc(64); t.write('II', 0, 'latin1'); t.writeUInt16LE(42, 2); t.writeUInt32LE(8, 4);
    t.writeUInt16LE(1, 8); t.writeUInt16LE(0x8769, 10); t.writeUInt16LE(4, 12); t.writeUInt32LE(1, 14); t.writeUInt32LE(26, 18); t.writeUInt32LE(0, 22);
    t.writeUInt16LE(1, 26); t.writeUInt16LE(0x9003, 28); t.writeUInt16LE(2, 30); t.writeUInt32LE(20, 32); t.writeUInt32LE(44, 36); t.writeUInt32LE(0, 40);
    t.write('2021:06:15 10:20:30\0', 44, 'latin1');
    const app1 = Buffer.concat([Buffer.from('Exif\0\0', 'latin1'), t]), hdr = Buffer.from([0xFF, 0xD8, 0xFF, 0xE1, 0, 0]); hdr.writeUInt16BE(app1.length + 2, 4);
    const f = path.join(os2.tmpdir(), 'ms-exif-test.jpg'); fs2.writeFileSync(f, Buffer.concat([hdr, app1, Buffer.from([0xFF, 0xD9])]));
    const d = new Date(P.exifDate(f));
    ok('photos: the date taken is read from the photo', d.getFullYear() === 2021 && d.getMonth() === 5 && d.getDate() === 15 && d.getHours() === 10, d.toString());
    fs2.writeFileSync(f, 'not a picture'); ok('photos: a file that is not a JPEG has no date', P.exifDate(f) === 0); fs2.unlinkSync(f);
    let code = 0; P.file('../../server.js', { writeHead(c) { code = c; }, end() { } });
    ok('photos: only indexed photos can be opened', code === 404);
    ok('photos: a preview must be a small JPEG of an indexed photo', !!P.saveThumb('nope', Buffer.from([0xFF, 0xD8, 1, 2])).error);
  }
  /* the research overview: headings show as headings and source numbers survive the formatting */
  {
    const src = require('fs').readFileSync(path.join(__dirname, '..', 'web', 'js', 'news.js'), 'utf8');
    const m = src.match(/function md\(t\) \{[\s\S]*?\n  \}/), escF = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;');
    const md = m ? new Function('esc', m[0] + '; return md;')(escF) : null;
    const h = md ? md('### Key facts\n- Rates held [7]\nPlain line [2, 5]') : '';
    ok('research: # headings become bold lines, not raw hashes', /<b>Key facts<\/b>/.test(h) && !/#/.test(h), h.slice(0, 120));
    ok('research: source numbers are kept', /\[7\]/.test(h) && /\[2, 5\]/.test(h), h.slice(0, 160));
    ok('research: the server has a research route', typeof N.research === 'function');
    const mo = require('fs').readFileSync(path.join(__dirname, '..', 'web', 'js', 'motion.js'), 'utf8');
    ok('tabs: a switch still happens if the window does not paint', /skipTransition/.test(mo) && /setTimeout\(\(\) => \{ if \(!done\)/.test(mo));
  }
  let refused = null; N.image('https://evil.example/x.jpg', { writeHead(c) { refused = c; }, end() { } });
  ok('news: pictures are only fetched for addresses that came from the feeds', refused === 404);
}

/* the Imperium battle engine: the thing that decides whether the Rome RPG can be played or only watched.
   Battles are stochastic, so these check shape and fairness over many fights rather than one number. */
{
  const g = global; g.window = g;                     // the game files are written for a browser
  try {
    require(path.join(__dirname, '..', 'web', 'games', 'imperium', 'data.js'));
    require(path.join(__dirname, '..', 'web', 'games', 'imperium', 'battle.js'));
    const IMP = g.IMP, B = g.BattleSim;
    const field = ['legion', 'aux', 'horse', 'guard', 'elephant'];
    ok('the battle engine loads', !!B && !!IMP && !!IMP.UNITS, 'BattleSim or IMP.UNITS missing');
    ok('every unit you can field is in the table', field.every(t => IMP.UNITS[t] && IMP.UNITS[t].men > 0), field.filter(t => !IMP.UNITS[t]).join(','));
    const fight = (mine, foe, mods, foeMods, terrain, n) => {
      let w = 0, lost = 0, killed = 0, bad = 0;
      for (let i = 0; i < n; i++) {
        const r = B.auto({ mine, foe, mods, foeMods, terrain });
        if (!r || !/^(win|loss)$/.test(r.result) || !(r.rounds > 0) || !(r.lost >= 0) || !(r.killed >= 0)) bad++;
        else { if (r.result === 'win') w++; lost += r.lost; killed += r.killed; }
      }
      return { w, n, lost: Math.round(lost / n), killed: Math.round(killed / n), bad };
    };
    /* A fight between identical armies must be a fight. This is the bug that made every campaign battle unwinnable:
       the side that happened to land the first blow won, and the alternating turn order meant it was never the player's.
       The player does move first, so a modest edge is expected — being ground to nothing is not. */
    const mirror = fight(['legion', 'legion'], ['legion', 'legion'], { quality: 1 }, { quality: 1 }, 'plain', 120);
    ok('an even fight is a fight, not a formality', mirror.w >= 50 && mirror.w <= 108, mirror.w + '/120 won, ' + mirror.killed + ' killed / ' + mirror.lost + ' lost of 1,920');
    ok('the beaten side still bleeds', mirror.killed > mirror.lost * 0.6 && mirror.lost > mirror.killed * 0.6, mirror.killed + ' vs ' + mirror.lost);
    ok('every battle returns a real result', mirror.bad === 0, mirror.bad + ' malformed');
    /* and numbers have to count for something: a double-sized army should not be beaten by a single cohort */
    const bigger = fight(['legion', 'legion', 'legion'], ['legion'], { quality: 1 }, { quality: 1 }, 'plain', 40);
    ok('three cohorts beat one', bigger.w >= 38, bigger.w + '/40 won, ' + bigger.lost + ' lost');
    /* every province on the map has to be winnable: an army that cannot take one is a dead end in the career.
       The scaling here mirrors battleIn() in game.js — the province's difficulty decides the enemy's size. */
    const unwinnable = IMP.PROVS.filter(p => {
      const n = p.diff >= 5 ? 5 : p.diff >= 3 ? 4 : 3;
      const foe = []; for (let i = 0; i < n; i++) foe.push(p.foe);
      const r = fight(['legion', 'legion', 'legion', 'legion', 'legion', 'guard', 'aux'], foe, { quality: 1.33, atk: 1.25, morale: 10 }, { quality: 1 + p.diff / 9, morale: p.diff * 3 }, 'plain', 40);
      return r.w < 25 || r.bad;
    });
    ok('every province can be taken by an army that has grown with the career', unwinnable.length === 0, unwinnable.map(p => p.n + ' (diff ' + p.diff + ')').join(', '));
    /* and the terrain must not be a coin toss either */
    const terrains = ['plain', 'hills', 'woods', 'river'].map(t => t + ' ' + fight(['legion', 'legion'], ['warband', 'warband'], { quality: 1 }, { quality: 1 }, t, 40).w + '/40');
    ok('all four kinds of ground can be fought on', terrains.every(s => !/ 0\/40$/.test(s)), terrains.join(', '));
    /* the two special orders: shields up must actually stop arrows, and the javelins go once and only once */
    {
      const volley = testudo => { let lost = 0; for (let i = 0; i < 60; i++) { const S2 = { units: [], log: [] }; const me = B.makeUnit('me', 'legion', 3, 3), foe = B.makeUnit('foe', 'aux', 5, 3); S2.units = [me, foe]; me.testudo = testudo; const m0 = me.men; B.strike(S2, foe, me, 'volley'); lost += m0 - me.men; } return lost / 60; };
      const open = volley(false), shut = volley(true);
      ok('the testudo turns most of a volley', shut < open * .5, Math.round(open) + ' men lost in the open, ' + Math.round(shut) + ' under shields');
      const S3 = { units: [], log: [] }, leg = B.makeUnit('me', 'legion', 3, 3), tgt = B.makeUnit('foe', 'warband', 5, 3); S3.units = [leg, tgt];
      B.order(S3, leg, 'pilum'); const after1 = tgt.men; leg.acted = false; B.order(S3, leg, 'pilum');
      ok('a cohort throws its pila once', leg.pila === 0 && after1 < tgt.max && S3.log.filter(l => l.kind === 'pilum').length === 1, 'pila ' + leg.pila + ', ' + S3.log.filter(l => l.kind === 'pilum').length + ' volleys');
    }
    /* the real-time field: the same wars fought with bodies, momentum and arrows that fall where they fall */
    {
      g.performance = g.performance || { now: () => Date.now() };
      require(path.join(__dirname, '..', 'web', 'games', 'imperium', 'field.js'));
      const F = g.FIELD;
      ok('the battlefield loads and knows every unit a war can field', !!F && ['legion', 'aux', 'horse', 'guard', 'elephant', 'warband', 'phalanx', 'horsearcher', 'numidian', 'horde'].every(t => F.supported([t])));
      const sim = (mine, foe, n, mods) => { let w = 0, bad = 0, secs = 0; for (let i = 0; i < n; i++) { const r = F.simulate({ mine, foe, mods: mods || { quality: 1 }, foeMods: { quality: 1 }, terrain: ['plain', 'hills', 'woods', 'river'][i % 4] }, 300); if (!/^(win|loss)$/.test(r.result) || !(r.lost >= 0)) bad++; if (r.result === 'win') w++; secs += r.seconds; } return { w, bad, secs: secs / n }; };
      const even = sim(['legion', 'legion'], ['legion', 'legion'], 14);
      ok('an even real-time fight can go either way', even.w >= 1 && even.w <= 13 && !even.bad, even.w + '/14 won');
      ok('a battle lasts long enough to command', even.secs > 45 && even.secs < 300, Math.round(even.secs) + ' s on average');
      ok('three cohorts beat one on the field', sim(['legion', 'legion', 'legion'], ['legion'], 4).w === 4);
      /* the bug that made the phalanx unbeatable: a legionary who had thrown his pilum never drew his sword again */
      const B = F.create({ mine: ['legion', 'legion', 'legion', 'legion'], foe: ['phalanx', 'phalanx'], terrain: 'plain' }, {});
      B.units.filter(u => u.side === 'me').forEach(u => { u.order = { kind: 'auto' }; });
      for (let i = 0; i < 60 * 90 && !B.over; i++) F.tick(B, 1 / 60, null);
      ok('legionaries fight with the sword after the pilum', (B.stats['foe:front'] || 0) + (B.stats['foe:side'] || 0) > 200, JSON.stringify(B.stats));
      /* an arrow is a body in flight: it goes up, comes down, and lands near where it was aimed */
      const A = F.create({ mine: ['aux'], foe: ['legion'], terrain: 'plain' }, {});
      A.units[1].order = { kind: 'hold' }; A.units[1].cx = A.units[0].cx + 220; A.units[1].soldiers.forEach((x, i) => { x.x = A.units[1].cx - (i % 3) * 13; x.y = A.units[0].cy + (Math.floor(i / 3) - 4) * 13; });
      A.units[0].order = { kind: 'hold' }; A.aiAt = 1e9;           // nobody moves: the archers stand and shoot
      let peak = 0, flew = 0;
      for (let i = 0; i < 60 * 8; i++) { F.tick(A, 1 / 60, null); A.proj.forEach(p => { peak = Math.max(peak, p.z); flew++; }); }
      const landed = A.decals.filter(d => d.k === 'arrow').length + (A.stats['foe:missile'] ? 1 : 0);
      ok('arrows fly an arc, come down and hit', peak > 25 && landed > 0 && (A.stats['foe:missile'] || 0) > 0, 'peak ' + Math.round(peak) + ', ' + landed + ' landed, ' + Math.round(A.stats['foe:missile'] || 0) + ' damage');
    }
    /* the soundtrack: every piece of music the game asks for has been written */
    {
      const hadDoc = 'document' in g, hadAdd = 'addEventListener' in g;
      if (!hadDoc) g.document = { hidden: false, addEventListener() { } }; if (!hadAdd) g.addEventListener = () => { };
      require(path.join(__dirname, '..', 'web', 'games', 'imperium', 'audio.js'));
      if (!hadDoc) delete g.document; if (!hadAdd) delete g.addEventListener;
      const src = require('fs').readFileSync(path.join(__dirname, '..', 'web', 'games', 'imperium', 'game.js'), 'utf8');
      const block = src.slice(src.indexOf('const ROOM_MUSIC'), src.indexOf('ImpAudio.music(theme);'));
      const asked = new Set((block.match(/'([a-z]+)'/g) || []).map(s => s.slice(1, -1)).filter(n => !/^(basilica|tabularium|balnea|ludus|colosseum|curia|rostra|forum|aedes|subura|tavern|macellum|castra|temple|circus|portus|wharf|horrea|vesta|capitolium|capitol|janiculum|domus|ostia|villa|camp)$/.test(n) || g.ImpAudio.themes.includes(n)));
      ['plate', 'siege', 'anthem'].forEach(n => asked.add(n));
      const missing = [...asked].filter(n => !g.ImpAudio.themes.includes(n));
      ok('every theme the game asks for exists', g.ImpAudio && g.ImpAudio.themes.length >= 19 && missing.length === 0, missing.join(', '));
    }
    /* the wider world: the three regions are places, and every job out there sends you somewhere that exists */
    {
      g.IMP.INTERIORS = g.IMP.INTERIORS || {};
      require(path.join(__dirname, '..', 'web', 'games', 'imperium', 'world.js'));
      require(path.join(__dirname, '..', 'web', 'games', 'imperium', 'wider.js'));
      const regions = ['ostia', 'villa', 'camp'];
      const placed = regions.every(id => g.IMP.INTERIORS[id] && g.IMP.LOCS[id] && g.IMP.REGION_FROM[id]);
      const jobs = g.IMP.QUESTS.filter(q => q.steps.some(s => regions.includes(s.at)));
      const lost = jobs.flatMap(q => q.steps.filter(s => !g.IMP.LOCS[s.at]).map(s => q.id + ':' + s.at));
      ok('the world outside Rome is on the map', placed && jobs.length >= 6 && lost.length === 0, lost.join(', ') || jobs.length + ' jobs in 3 regions');
    }
    /* the two stories: every battle a chapter names has to exist, or that chapter fights somewhere else entirely */
    require(path.join(__dirname, '..', 'web', 'games', 'imperium', 'story.js'));
    require(path.join(__dirname, '..', 'web', 'games', 'imperium', 'caesar.js'));
    const fields = IMP.PROVS.concat(IMP.FIELDS || []).map(p => p.id);
    const named = [g.STORY, g.CAESAR].flatMap(st => st.CH.flatMap(c => c.steps.filter(s => s.battle).map(s => c.id + ':' + s.battle)));
    const missing = named.filter(x => !fields.includes(x.split(':')[1]));
    ok('every story battle is fought on a field that exists', named.length >= 7 && missing.length === 0, missing.join(', ') || named.length + ' battles');
    /* and nobody walks a street they could not have walked: the cast table has to cover every famous Roman in it */
    const famous = ['crassus', 'cato', 'cicero', 'marius', 'catilina', 'pompey', 'brutus', 'antony', 'cleopatra', 'vercingetorix', 'sulla', 'clodius'];
    ok('every famous Roman has the years they were in the city', famous.every(id => (IMP.ERA || {})[id]), famous.filter(id => !(IMP.ERA || {})[id]).join(','));
  } catch (e) { ok('the Imperium battle engine runs', false, e.message); }
}

/* the backup bookkeeping the Ready page shows */
try {
  const safe = require(path.join(__dirname, '..', 'lib', 'safe'));
  const st = safe.status();
  ok('backup status has a place and a keep count', !!st.place && st.keep > 0, JSON.stringify(st).slice(0, 120));
  ok('backup knows whether it is stale', typeof st.stale === 'boolean');
} catch (e) { ok('backup status reads', false, e.message); }

/* the problem log accepts a line and hands it back */
try {
  const problems = require(path.join(__dirname, '..', 'lib', 'problems'));
  const row = problems.note('test', 'automated test run');
  ok('the problem log records a line', row && row.kind === 'test' && problems.recent().length > 0);
} catch (e) { ok('the problem log records a line', false, e.message); }

/* the chess clock's dial geometry: cheap to get wrong, and impossible to notice until the hand is in the wrong place */
try {
  const ck = require(path.join(__dirname, '..', 'web', 'js', 'chess-clock.js'));
  eq('a full dial starts the hand at twelve', ck.ANG(300, 300), 0);
  eq('half the time left points the hand half way round', ck.ANG(150, 300), 180);
  eq('an empty dial leaves the hand on the flag', ck.ANG(0, 300), 360);
  ok('the hand never runs past a full turn', ck.ANG(-5, 300) <= 360 && ck.ANG(999, 300) === 0);
  ok('a dial with no total does not divide by zero', ck.ANG(100, 0) === 0);
  eq('the seconds needle turns once a minute', ck.ANG2(30), 180);
  ok('there is a tournament and an antique clock to choose', ck.STYLES.some(s => s.id === 'tournament') && ck.STYLES.some(s => s.id === 'antique') && ck.STYLES.length >= 6, ck.STYLES.map(s => s.id).join(','));
  ok('every design has a name and a description', ck.STYLES.every(s => s.name && s.note));
} catch (e) { ok('the clock designs load', false, e.message); }

/* the internet layer's refusals: the part that must never be wrong, because it is what keeps a fetched page out of this PC */
try {
  const net = require(path.join(__dirname, '..', 'lib', 'net'));
  const refuses = async (raw, why) => { const r = await net.safeUrl(raw); ok('refuses ' + why, !!r.error, JSON.stringify(r).slice(0, 90)); };
  const allows = async (raw) => { const r = await net.safeUrl(raw); ok('allows ' + raw, !!r.url && !r.error, r.error || ''); };
  (async () => {
    await refuses('http://localhost:47231/api/status', 'localhost');
    await refuses('http://127.0.0.1/admin', 'this PC');
    await refuses('http://192.168.1.1/', 'the home router');
    await refuses('http://10.0.0.5/', 'a private address');
    await refuses('file:///C:/Users/', 'a file on this PC');
    await refuses('not a web address', 'nonsense');
    await refuses('http://example.com:8080/', 'an unusual port');
    await allows('https://en.wikipedia.org/wiki/Chess');
    ok('internet access is off unless the user switched it on', typeof net.on() === 'boolean', 'a switch, not a constant');
    eq('the search engine is DuckDuckGo', net.ENGINE, 'DuckDuckGo');
    ok('...and it is asked before the offline encyclopaedia', !/wikipedia\.org\/w\/api/.test(String(net.search).split('wikiSearch')[0] || ''), 'DuckDuckGo first, Wikipedia only to top the list up');
    /* the text the model is handed: script and style are thrown away, and the tags with them */
    const t = net.text('<html><head><style>p{color:red}</style></head><body><h1>Chess</h1><script>bad()</script><p>King &amp; pawn.</p></body></html>');
    ok('a page becomes readable text', /Chess/.test(t) && /King & pawn\./.test(t), JSON.stringify(t).slice(0, 90));
    ok('...with no script, style or tags left in it', !/bad\(\)|color:red|<[a-z]/i.test(t), JSON.stringify(t).slice(0, 90));
    await require('./mail-test.js')(ok);
    await require('./gateway-test.js')(ok);
    try { await require('./agent-test.js')(ok); } catch (e) { ok('the agent module loads', false, e.message); }
    try { await require('./harness-test.js')(ok); } catch (e) { ok('the harness module loads', false, e.message); }
    try { await require('./swarm-test.js')(ok); } catch (e) { ok('the swarm modules load', false, e.message); }
    try { const MT = require(path.join(__dirname, '..', 'lib', 'mail.js'))._t, pw = 'tést "pw" ✓', blob = await MT.protectPw(pw); ok('mail: Windows keeps the password protected and gives it back', !blob.includes('pw') && await MT.unprotectPw(blob) === pw); } catch (e) { ok('mail: Windows keeps the password protected', false, e.message); }
    console.log('\n' + pass + ' passed, ' + fail + ' failed');
    process.exit(fail ? 1 : 0);
  })();
} catch (e) { ok('the internet layer loads', false, e.message); console.log('\n' + pass + ' passed, ' + fail + ' failed'); process.exit(1); }

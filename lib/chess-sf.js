// Stockfish for Moundshroud: a managed local engine (UCI) for strong play and deep analysis, plus a background "study" loop that keeps working while Moundshroud is open and you are idle:
//  - it grows a deep opening book (top moves with evaluations, searched at depth 20+) outward from the main lines,
//  - it studies the games you played and remembers the positions where you lost the most (lessons),
//  - everything it learns is saved on disk (data/chess-book.json, data/chess-study.json) and used for play and analysis.
// The engine runs as a separate low-priority process, only when the page is open and you are not waiting on it.
const cp = require('child_process'), fs = require('fs'), path = require('path'), os = require('os'), vm = require('vm');
const ROOT = path.join(__dirname, '..'), DATA = path.join(ROOT, 'data'), EXE = path.join(ROOT, 'engines', 'stockfish', 'stockfish.exe');
const BOOK = path.join(DATA, 'chess-book.json'), CFG = path.join(DATA, 'chess-study.json');
const available = () => fs.existsSync(EXE);
let activeFn = () => true, lastInteractive = 0, suspended = false; const children = new Set();
process.on('exit', () => { for (const p of children) { try { p.kill(); } catch (e) { } } });

/* ---------- a UCI engine process with a request queue ---------- */
function mkEngine(name, optsFn) {
  let proc = null, buf = '', onLine = null, ready = null, curOpts = '', queue = Promise.resolve(), idleT = 0;
  const send = s => { try { proc && proc.stdin.write(s + '\n'); } catch (e) { } };
  const kill = () => { if (proc) { try { proc.kill(); } catch (e) { } children.delete(proc); proc = null; } ready = null; curOpts = ''; };
  const start = () => {
    if (proc) return ready; const o = optsFn(); proc = cp.spawn(EXE, [], { stdio: ['pipe', 'pipe', 'ignore'], windowsHide: true }); children.add(proc); const me = proc; buf = '';
    me.stdout.on('data', d => { buf += d; let i; while ((i = buf.indexOf('\n')) >= 0) { const l = buf.slice(0, i).trim(); buf = buf.slice(i + 1); if (onLine) onLine(l); } });
    me.on('exit', () => { children.delete(me); if (proc === me) { proc = null; ready = null; } if (onLine) onLine('__exit__'); });
    try { os.setPriority(me.pid, o.prio === 'low' ? os.constants.priority.PRIORITY_LOW : os.constants.priority.PRIORITY_NORMAL); } catch (e) { }
    send('uci'); send('setoption name Threads value ' + o.threads); send('setoption name Hash value ' + o.hash); send('isready'); curOpts = o.threads + '/' + o.hash;
    ready = new Promise(res => { const prev = onLine; onLine = l => { if (l === 'readyok' || l === '__exit__') { onLine = prev; res(); } }; }); return ready;
  };
  const parseInfo = l => { const t = l.split(' '), r = { mpv: 1 }; for (let i = 1; i < t.length; i++) { const k = t[i]; if (k === 'depth') r.depth = +t[++i]; else if (k === 'multipv') r.mpv = +t[++i]; else if (k === 'nodes') r.nodes = +t[++i]; else if (k === 'nps') r.nps = +t[++i]; else if (k === 'score') { const ty = t[++i], v = +t[++i]; if (ty === 'cp') r.cp = v; else if (ty === 'mate') r.mate = v; } else if (k === 'pv') { r.pv = t.slice(i + 1); break; } } return r; };
  const run = async o => {
    const op = optsFn(); if (proc && curOpts !== op.threads + '/' + op.hash) kill(); await start(); if (!proc) throw new Error('engine did not start'); clearTimeout(idleT); idleT = setTimeout(kill, name === 'play' ? 10 * 60e3 : 30 * 60e3);
    return new Promise((res, rej) => {
      const lines = {}; let nps = 0, dep = 0; const mpv = Math.max(1, Math.min(8, o.multipv || 1)); let settled = false;
      const done = r => { if (settled) return; settled = true; clearTimeout(to); clearTimeout(to2); onLine = null; res(r); };
      const to = setTimeout(() => send('stop'), (o.ms || 1000) + 4000), to2 = setTimeout(() => { kill(); if (!settled) { settled = true; rej(new Error('engine timeout')); } }, (o.ms || 1000) + 9000);
      onLine = l => {
        if (l === '__exit__') { if (!settled) { settled = true; clearTimeout(to); clearTimeout(to2); rej(new Error('engine exited')); } return; }
        if (l.startsWith('info') && l.includes(' score ') && l.includes(' pv ')) { const r = parseInfo(l); if (r.mate === undefined && r.cp === undefined) return; if (!lines[r.mpv] || r.depth >= lines[r.mpv].depth) lines[r.mpv] = r; if (r.nps) nps = r.nps; if (r.depth > dep) dep = r.depth; }
        else if (l.startsWith('bestmove')) { const t = l.split(' '); done({ best: t[1] === '(none)' ? null : t[1], ponder: t[3] || null, lines: Object.values(lines).sort((a, b) => a.mpv - b.mpv), depth: dep, nps }); }
      };
      send('setoption name MultiPV value ' + mpv);
      if (o.elo) { send('setoption name UCI_LimitStrength value true'); send('setoption name UCI_Elo value ' + Math.max(1320, Math.min(3190, Math.round(o.elo)))); } else send('setoption name UCI_LimitStrength value false');
      send('position fen ' + o.fen + (o.moves && o.moves.length ? ' moves ' + o.moves.join(' ') : ''));
      send('go' + (o.searchmoves && o.searchmoves.length ? ' searchmoves ' + o.searchmoves.join(' ') : '') + (o.depth ? ' depth ' + o.depth : '') + (o.ms ? ' movetime ' + o.ms : o.depth ? '' : ' movetime 1000'));
    });
  };
  const search = o => (queue = queue.then(() => run(o), () => run(o)));
  return { search, kill, running: () => !!proc };
}
const cfgDefault = { on: true, threads: 1, hash: 128, depth: 20, ms: 2500, maxPly: 16, margin: 35, branch: 3 };
let cfg = Object.assign({}, cfgDefault); try { cfg = Object.assign(cfg, JSON.parse(fs.readFileSync(CFG, 'utf8')).cfg || {}); } catch (e) { }
const playEngine = mkEngine('play', () => ({ threads: Math.max(1, Math.min(4, Math.floor(os.cpus().length / 4))), hash: 256, prio: 'normal' }));
const studyEngine = mkEngine('study', () => ({ threads: cfg.threads, hash: cfg.hash, prio: 'low' }));

/* ---------- chess rules for building book lines (the same JS rules the page uses) ---------- */
let CH = null; const chess = () => { if (CH) return CH; const ctx = { console, Math, Date }; ctx.self = ctx; ctx.window = ctx; vm.createContext(ctx); vm.runInContext(fs.readFileSync(path.join(ROOT, 'web', 'js', 'chess-engine.js'), 'utf8'), ctx); CH = ctx.self.Chess; return CH; };
const keyOf = fen => fen.split(' ').slice(0, 4).join(' ');
const child = (fen, uci) => { const C = chess(), p = new C.Pos().setFen(fen), m = p.fromUci(uci); if (m === undefined || m === null || m === false) return null; p.make(m); return p.fen(); };

/* ---------- the book and the study state ---------- */
let book = { pos: {}, q: [] }, stats = { studied: 0, games: 0, secs: 0, depthSum: 0, started: Date.now(), lastSave: 0 }, lessons = [], gameQ = [], seeded = false, dirty = false, job = null, studying = false, doneGames = {};
try { const j = JSON.parse(fs.readFileSync(BOOK, 'utf8')); book = { pos: j.pos || {}, q: j.q || [] }; stats = Object.assign(stats, j.stats || {}); lessons = j.lessons || []; doneGames = j.doneGames || {}; seeded = !!j.seeded; } catch (e) { }
const save = () => { if (!dirty) return; dirty = false; try { fs.mkdirSync(DATA, { recursive: true }); fs.writeFileSync(BOOK + '.tmp', JSON.stringify({ pos: book.pos, q: book.q.slice(0, 4000), stats, lessons: lessons.slice(0, 300), doneGames, seeded })); fs.renameSync(BOOK + '.tmp', BOOK); fs.writeFileSync(CFG, JSON.stringify({ cfg })); } catch (e) { } };
setInterval(save, 30000).unref();
const rec = (fen, lines, depth) => { const k = keyOf(fen); const e = book.pos[k] || (book.pos[k] = { m: [], n: 0 }); e.n++; e.d = depth; e.m = lines.filter(l => l.pv && l.pv[0]).map(l => [l.pv[0], l.mate !== undefined ? (l.mate > 0 ? 30000 - l.mate : -30000 - l.mate) : l.cp, l.depth]); dirty = true; };
const seed = () => {
  seeded = true; const C = chess(); const add = (fen, ply, w) => book.q.push({ fen, ply, w });
  add(C.START, 0, 1);
  try { const src = fs.readFileSync(path.join(ROOT, 'web', 'js', 'chess-analysis.js'), 'utf8'), m = /const ECO = (\[\[[\s\S]*?\]\]);/.exec(src); const eco = m ? Function('return ' + m[1])() : []; for (const [, line] of eco) { const p = new C.Pos().setFen(C.START); let ply = 0; for (const s of line.split(' ')) { const mv = p.fromSan(s); if (!mv) break; p.make(mv); ply++; add(p.fen(), ply, Math.max(.2, 1 - ply * .06)); } } } catch (e) { }
  book.q.sort((a, b) => b.w - a.w); dirty = true;
};
const setSuspended = v => { suspended = !!v; if (suspended) { try { studyEngine.kill(); playEngine.kill(); } catch (e) { } job = { kind: 'wait', text: 'Stockfish is off (low-power mode)' }; } };
const status = () => ({ available: available(), suspended, on: cfg.on, cfg, studying, job, interactive: playEngine.running(), study: { running: studyEngine.running(), positions: stats.studied, book: Object.keys(book.pos).length, queue: book.q.length, games: stats.games, lessons: lessons.length, avgDepth: stats.studied ? Math.round(stats.depthSum / stats.studied * 10) / 10 : 0, hours: Math.round(stats.secs / 36) / 100, gamesQueued: gameQ.length } });

async function studyGame(g) {
  const C = chess(); const p = new C.Pos().setFen(g.startFen || C.START), seq = []; for (const u of g.moves.slice(0, 120)) { const fen = p.fen(), m = p.fromUci(u); if (!m) break; seq.push({ fen, u, side: p.side }); p.make(m); } seq.push({ fen: p.fen(), u: null, side: p.side });
  const ev = []; for (let i = 0; i < seq.length; i++) { if (!studying || !cfg.on) return false; if (Date.now() - lastInteractive < 8000) { await new Promise(r => setTimeout(r, 3000)); i--; continue; } job = { kind: 'game', text: 'Studying your game: move ' + (i + 1) + ' of ' + seq.length }; const t0 = Date.now(); let r; try { r = await studyEngine.search({ fen: seq[i].fen, depth: 16, ms: 1500, multipv: 2 }); } catch (e) { return false; } stats.secs += (Date.now() - t0) / 1000; stats.studied++; stats.depthSum += r.depth || 0; if (r.lines.length) { rec(seq[i].fen, r.lines, r.depth); ev.push({ best: r.lines[0].pv[0], cp: r.lines[0].mate !== undefined ? (r.lines[0].mate > 0 ? 30000 : -30000) : r.lines[0].cp }); } else ev.push({ best: null, cp: 0 }); }
  for (let i = 0; i + 1 < seq.length; i++) { const mine = g.human ? seq[i].side === g.human : true; if (!mine || !ev[i] || !ev[i + 1]) continue; const loss = ev[i].cp - (-ev[i + 1].cp); if (loss >= 150 && ev[i].best && ev[i].best !== seq[i].u && Math.abs(ev[i].cp) < 5000) lessons.unshift({ fen: seq[i].fen, played: seq[i].u, best: ev[i].best, loss: Math.min(loss, 2000), ts: Date.now(), game: g.id || '' }); }
  lessons = lessons.slice(0, 300); stats.games++; dirty = true; return true;
}
async function loop() {
  if (studying) return; studying = true;
  while (true) {
    try {
      if (suspended) { studyEngine.kill(); job = { kind: 'wait', text: 'Stockfish is off (low-power mode)' }; await new Promise(r => setTimeout(r, 4000)); continue; }
      if (!available() || !cfg.on || !activeFn()) { await new Promise(r => setTimeout(r, 5000)); if (!cfg.on || !available()) { studyEngine.kill(); job = null; studying = false; return; } continue; }
      if (Date.now() - lastInteractive < 10000) { job = { kind: 'wait', text: 'Paused: you are using the engine' }; await new Promise(r => setTimeout(r, 2500)); continue; }
      if (!seeded) seed();
      if (gameQ.length) { const g = gameQ.shift(); await studyGame(g); continue; }
      let it = null; for (let n = 0; n < book.q.length && !it; n++) { const c = book.q[n]; if (!book.pos[keyOf(c.fen)]) { it = c; book.q.splice(n, 1); } else { book.q.splice(n, 1); n--; } }
      if (!it) { job = { kind: 'idle', text: 'Opening book complete to the current limits. Raise the depth or play more games for new lines.' }; await new Promise(r => setTimeout(r, 15000)); continue; }
      if (Object.keys(book.pos).length > 60000) { job = { kind: 'idle', text: 'Book is full (60,000 positions).' }; await new Promise(r => setTimeout(r, 30000)); continue; }
      job = { kind: 'book', text: 'Studying opening position (move ' + (Math.floor(it.ply / 2) + 1) + ', ' + (it.fen.split(' ')[1] === 'w' ? 'White' : 'Black') + ' to play)', fen: it.fen };
      const t0 = Date.now(); const r = await studyEngine.search({ fen: it.fen, depth: cfg.depth, ms: cfg.ms, multipv: 4 }); stats.secs += (Date.now() - t0) / 1000; stats.studied++; stats.depthSum += r.depth || 0; if (!r.lines.length) continue;
      rec(it.fen, r.lines, r.depth); const top = r.lines[0], topCp = top.mate !== undefined ? (top.mate > 0 ? 30000 : -30000) : top.cp;
      if (it.ply < cfg.maxPly) { let rank = 0; for (const l of r.lines) { const c = l.mate !== undefined ? (l.mate > 0 ? 30000 : -30000) : l.cp; if (rank >= cfg.branch || topCp - c > cfg.margin || !l.pv) break; const f = child(it.fen, l.pv[0]); if (f && !book.pos[keyOf(f)]) book.q.push({ fen: f, ply: it.ply + 1, w: it.w * (.82 - rank * .15) }); rank++; } if (book.q.length > 6000) { book.q.sort((a, b) => b.w - a.w); book.q.length = 4000; } }
    } catch (e) { job = suspended ? { kind: 'wait', text: 'Stockfish is off (low-power mode)' } : { kind: 'error', text: 'Engine hiccup, retrying: ' + e.message }; await new Promise(r => setTimeout(r, 4000)); }
  }
}
const ensureLoop = () => { if (available() && cfg.on && !studying) setTimeout(() => loop().catch(() => { studying = false; }), 4000); };

/* ---------- HTTP ---------- */
async function handle(url, q, req, res, H) {
  const { json, jbody } = H; if (q.has('low')) setSuspended(q.get('low') === '1'); ensureLoop();
  if (url === '/api/sf/power' && req.method === 'POST') { const b = await jbody(req, 1e3); setSuspended(!!b.low); return json(res, 200, status()); }
  if (url === '/api/sf/status' || url === '/api/study/status') return json(res, 200, status());
  if (!available()) return json(res, 200, { error: 'Stockfish is not installed' });
  if (suspended && (url === '/api/sf/go' || url === '/api/sf/ana')) return json(res, 200, { error: 'Stockfish is off (low-power mode)' });
  if (url === '/api/sf/go' && req.method === 'POST') { const b = await jbody(req, 1e5); lastInteractive = Date.now(); try { return json(res, 200, await playEngine.search({ fen: b.fen, moves: b.moves, ms: Math.min(+b.ms || 1000, 20000), depth: b.depth, multipv: b.multipv, elo: b.elo, searchmoves: b.searchmoves })); } catch (e) { return json(res, 200, { error: e.message }); } }
  if (url === '/api/sf/ana' && req.method === 'POST') {
    const b = await jbody(req, 1e5); lastInteractive = Date.now(); const ms = Math.min(+b.ms || 800, 8000);
    try { const best = await playEngine.search({ fen: b.fen, ms, multipv: 1 }); let played = null; if (b.played && best.best && b.played !== best.best) played = await playEngine.search({ fen: b.fen, ms: Math.max(300, Math.round(ms * .6)), searchmoves: [b.played] }); const sc = l => !l ? 0 : l.mate !== undefined ? (l.mate > 0 ? 30000 - l.mate * 2 : -30000 - l.mate * 2) : l.cp; const bl = best.lines[0]; return json(res, 200, { best: best.best, bs: sc(bl), played: b.played && played && played.lines[0] ? sc(played.lines[0]) : (b.played ? sc(bl) : null), depth: best.depth, nps: best.nps, lines: best.lines.length }); } catch (e) { return json(res, 200, { error: e.message }); }
  }
  if (url === '/api/study/config' && req.method === 'POST') { const b = await jbody(req, 1e4); for (const k of ['on', 'threads', 'hash', 'depth', 'ms', 'maxPly', 'margin', 'branch']) if (b[k] !== undefined) cfg[k] = typeof cfgDefault[k] === 'boolean' ? !!b[k] : Math.max(1, +b[k]); cfg.threads = Math.min(os.cpus().length, cfg.threads); cfg.depth = Math.min(34, cfg.depth); dirty = true; save(); if (!cfg.on) { studyEngine.kill(); job = null; } else ensureLoop(); return json(res, 200, status()); }
  if (url === '/api/study/book') { const e = book.pos[keyOf(q.get('fen') || '')]; return json(res, 200, e ? { m: e.m, n: e.n, d: e.d } : { m: [] }); }
  if (url === '/api/study/games' && req.method === 'POST') { const b = await jbody(req, 5e6); let n = 0; for (const g of (b.games || []).slice(0, 80)) { if (!g.moves || g.moves.length < 6 || (g.id && doneGames[g.id])) continue; if (g.id) doneGames[g.id] = 1; gameQ.push(g); n++; } dirty = true; return json(res, 200, { queued: n }); }
  if (url === '/api/study/lessons') return json(res, 200, { lessons: lessons.slice(0, 100) });
  if (url === '/api/study/lessons/clear' && req.method === 'POST') { lessons = []; dirty = true; save(); return json(res, 200, { ok: true }); }
  return json(res, 404, { error: 'unknown' });
}
module.exports = { handle, status, available, setActive: f => { activeFn = f; }, start: ensureLoop };

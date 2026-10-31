// Lichess: real games against real people on lichess.org, through Lichess's official Board API.
// Your personal token is kept encrypted by Windows (never sent to the window); every request to Lichess goes through
// here. While a real game is being played, Moundshroud's chess engines are locked (see live()), because Lichess
// forbids any engine help in its games.
const https = require('https'), http = require('http'), fs = require('fs'), path = require('path');
const U = require('./util'), WS = require('./winsecret');
const DATA = path.join(__dirname, '..', 'data'), CFG = path.join(DATA, 'lichess.json');
const BASE = new URL(process.env.MOUNDSHROUD_LICHESS || 'https://lichess.org');      // a test server can stand in for Lichess
const UA = 'Moundshroud (Board API client)';
const NEED = ['board:play', 'challenge:read', 'challenge:write'];

let token = null;
const cfg = () => U.readJson(CFG, {});
async function tok() {
  if (token) return token; const c = cfg(); if (!c.blob) throw new Error('Connect your Lichess account first.');
  try { token = await WS.unprotect(c.blob); } catch (e) { throw new Error('Windows could not unlock the saved Lichess token. Connect again with a new token.'); }
  return token;
}
const nice = (code, body) => {
  let m = ''; try { const j = JSON.parse(body); m = j.error || j.message || ''; if (typeof m === 'object') m = Object.values(m).flat().join(' '); } catch (e) { m = String(body || '').slice(0, 200); }
  if (code === 401) return 'Lichess did not accept the token. Make a new one and connect again.';
  if (code === 429) return 'Lichess asked Moundshroud to slow down. Wait a minute and try again.';
  return m ? 'Lichess said: ' + m : 'Lichess answered with error ' + code + '.';
};
function call(method, p, form, t) {
  return new Promise((res, rej) => {
    const body = form ? new URLSearchParams(Object.entries(form).filter(([, v]) => v !== undefined && v !== null && v !== '').map(([k, v]) => [k, String(v)])).toString() : '';
    const mod = BASE.protocol === 'http:' ? http : https;
    const r = mod.request({ host: BASE.hostname, port: BASE.port || undefined, path: p, method, headers: Object.assign({ 'User-Agent': UA, Authorization: 'Bearer ' + t, Accept: 'application/json' }, body ? { 'Content-Type': 'application/x-www-form-urlencoded', 'Content-Length': Buffer.byteLength(body) } : {}), timeout: 20000 }, x => {
      let b = ''; x.setEncoding('utf8'); x.on('data', c => b += c);
      x.on('end', () => { if (x.statusCode >= 200 && x.statusCode < 300) { try { res({ json: b ? JSON.parse(b) : {}, headers: x.headers }); } catch (e) { res({ json: { ok: true }, headers: x.headers }); } } else rej(new Error(nice(x.statusCode, b))); });
    });
    r.on('timeout', () => r.destroy(new Error('Lichess did not answer in time.'))); r.on('error', e => rej(new Error(/ENOTFOUND|EAI_AGAIN|ECONNREFUSED/.test(e.message) ? 'Lichess could not be reached. Check that internet access is on.' : e.message)));
    if (body) r.write(body); r.end();
  });
}
const api = async (method, p, form) => (await call(method, p, form, await tok())).json;

/* ---------- connecting ---------- */
async function connect(t) {
  t = String(t || '').trim();
  if (!/^lip_[A-Za-z0-9]{10,}$/.test(t)) return { error: 'That does not look like a Lichess token. It starts with “lip_”.' };
  let r; try { r = await call('GET', '/api/account', null, t); } catch (e) { return { error: e.message }; }
  const scopes = String(r.headers['x-oauth-scopes'] || '').split(',').map(s => s.trim()).filter(Boolean);
  const missing = scopes.length ? NEED.filter(s => !scopes.includes(s)) : [];
  if (missing.length) return { error: 'This token is missing the permission' + (missing.length > 1 ? 's ' : ' ') + missing.join(', ') + '. Make a new one with the link below.' };
  const blob = await WS.protect(t);
  fs.mkdirSync(DATA, { recursive: true }); U.writeJson(CFG, { blob, user: r.json.username, at: Date.now() }); token = t;
  return { ok: true, user: r.json.username };
}
function disconnect() { token = null; closeAll(); clearTimeout(checkT); try { fs.unlinkSync(CFG); } catch (e) { } return { ok: true }; }
async function account() {
  const c = cfg(); if (!c.blob) return { connected: false };
  try { const a = await api('GET', '/api/account'); return { connected: true, user: a.username, title: a.title || '', perfs: a.perfs || {}, url: a.url, playing: a.playing || '' }; }
  catch (e) { return { connected: true, user: c.user, error: e.message }; }
}

/* ---------- streams: Lichess sends lines of JSON; they are passed straight on to the window ---------- */
const open = new Set();                    // every stream to Lichess, so they can all be closed at once
const games = new Map();                   // game id -> still being played?
function stream(p, res, form, onLine) {
  return tok().then(t => new Promise(done => {
    const body = form ? new URLSearchParams(Object.entries(form).filter(([, v]) => v !== undefined && v !== '').map(([k, v]) => [k, String(v)])).toString() : '';
    const mod = BASE.protocol === 'http:' ? http : https;
    const up = mod.request({ host: BASE.hostname, port: BASE.port || undefined, path: p, method: form ? 'POST' : 'GET', headers: Object.assign({ 'User-Agent': UA, Authorization: 'Bearer ' + t, Accept: 'application/x-ndjson' }, body ? { 'Content-Type': 'application/x-www-form-urlencoded', 'Content-Length': Buffer.byteLength(body) } : {}) }, x => {
      if (x.statusCode !== 200) { let b = ''; x.on('data', c => b += c); x.on('end', () => { if (!res.headersSent) { res.writeHead(200, { 'Content-Type': 'application/x-ndjson', 'Cache-Control': 'no-store' }); } res.end(JSON.stringify({ type: 'error', error: nice(x.statusCode, b) }) + '\n'); done(); }); return; }
      res.writeHead(200, { 'Content-Type': 'application/x-ndjson', 'Cache-Control': 'no-store', 'X-Accel-Buffering': 'no' });
      let buf = '';
      x.on('data', c => { res.write(c); if (onLine) { buf += c.toString('utf8'); let i; while ((i = buf.indexOf('\n')) >= 0) { const l = buf.slice(0, i).trim(); buf = buf.slice(i + 1); if (l) { try { onLine(JSON.parse(l)); } catch (e) { } } } } });
      x.on('end', () => { res.end(); done(); }); x.on('error', () => { res.end(); done(); });
    });
    const close = () => { open.delete(up); try { up.destroy(); } catch (e) { } };
    open.add(up); up.on('close', () => { open.delete(up); }); up.on('error', e => { if (!res.headersSent) res.writeHead(200, { 'Content-Type': 'application/x-ndjson' }); try { res.end(JSON.stringify({ type: 'error', error: 'Lichess could not be reached. Check that internet access is on.' }) + '\n'); } catch (x) { } done(); });
    res.on('close', close);                              // the window stopped listening (or cancelled a seek): stop asking Lichess
    if (body) up.write(body); up.end();
  })).catch(e => { if (!res.headersSent) res.writeHead(200, { 'Content-Type': 'application/x-ndjson' }); res.end(JSON.stringify({ type: 'error', error: e.message }) + '\n'); });
}
const PLAYING = new Set(['created', 'started']);
/* the lock is lifted only when Lichess says the game is over, not when the window stops watching it: leaving the
   chess tab mid-game must not unlock the engines while the clock is still running on Lichess */
let checkT = 0;
function recheck() {
  clearTimeout(checkT); if (!games.size) return;
  checkT = setTimeout(async () => {
    try { const r = await api('GET', '/api/account/playing'); const now = new Set((r.nowPlaying || []).map(g => g.gameId)); for (const id of [...games.keys()]) if (!now.has(id)) games.delete(id); } catch (e) { }
    recheck();
  }, 30000);
}
function events(res) { return stream('/api/stream/event', res, null, j => { const g = j.game || {}; const id = g.gameId || g.id; if (!id) return; if (j.type === 'gameStart') { games.set(id, true); recheck(); } else if (j.type === 'gameFinish') games.delete(id); }); }
function game(id, res) {
  id = String(id || '').replace(/[^A-Za-z0-9]/g, '').slice(0, 12);
  const track = j => { const st = j.type === 'gameFull' ? j.state && j.state.status : j.type === 'gameState' ? j.status : null; if (st) { if (PLAYING.has(st)) { games.set(id, true); recheck(); } else games.delete(id); } };
  return stream('/api/board/game/stream/' + id, res, null, track);
}
function seek(o, res) { const rapidPlus = (+o.time) * 60 + 40 * (+o.increment) >= 480; if (!rapidPlus) { res.writeHead(200, { 'Content-Type': 'application/x-ndjson' }); return res.end(JSON.stringify({ type: 'error', error: 'Lichess only lets apps look for strangers at Rapid (8 minutes or more) and slower. For Blitz, challenge a friend or the Lichess computer.' }) + '\n'); } return stream('/api/board/seek', res, { rated: !!o.rated, time: +o.time, increment: +o.increment, color: o.color || undefined }); }
function closeAll() { for (const r of open) { try { r.destroy(); } catch (e) { } } open.clear(); games.clear(); }
/* true while a real game is on: Moundshroud's engines refuse to help until it ends */
const live = () => games.size > 0;

/* ---------- moves and everything else in a game ---------- */
const gid = id => String(id || '').replace(/[^A-Za-z0-9]/g, '').slice(0, 12);
const act = {
  move: b => api('POST', '/api/board/game/' + gid(b.id) + '/move/' + String(b.move || '').replace(/[^a-h1-8qrbn]/g, '').slice(0, 5)),
  abort: b => api('POST', '/api/board/game/' + gid(b.id) + '/abort'),
  resign: b => api('POST', '/api/board/game/' + gid(b.id) + '/resign'),
  draw: b => api('POST', '/api/board/game/' + gid(b.id) + '/draw/' + (b.yes ? 'yes' : 'no')),
  takeback: b => api('POST', '/api/board/game/' + gid(b.id) + '/takeback/' + (b.yes ? 'yes' : 'no')),
  claimWin: b => api('POST', '/api/board/game/' + gid(b.id) + '/claim-victory'),
  claimDraw: b => api('POST', '/api/board/game/' + gid(b.id) + '/claim-draw'),
  chat: b => api('POST', '/api/board/game/' + gid(b.id) + '/chat', { room: 'player', text: String(b.text || '').slice(0, 140) }),
  challenge: b => api('POST', '/api/challenge/' + encodeURIComponent(String(b.user || '').replace(/[^A-Za-z0-9_-]/g, '').slice(0, 30)), { rated: !!b.rated, 'clock.limit': b.limit, 'clock.increment': b.inc, color: b.color || 'random', variant: 'standard' }),
  ai: b => api('POST', '/api/challenge/ai', { level: Math.max(1, Math.min(8, +b.level || 1)), 'clock.limit': b.limit, 'clock.increment': b.inc, color: b.color || 'random', variant: 'standard' }),
  accept: b => api('POST', '/api/challenge/' + gid(b.id) + '/accept'),
  decline: b => api('POST', '/api/challenge/' + gid(b.id) + '/decline', { reason: 'generic' }),
  cancel: b => api('POST', '/api/challenge/' + gid(b.id) + '/cancel')
};

module.exports = { connect, disconnect, account, events, game, seek, act, live, closeAll, NEED, connected: () => !!cfg().blob, user: () => cfg().user || '' };

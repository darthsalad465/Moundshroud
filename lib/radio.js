// Radio: live internet stations (music, news, talk, weather, and the few police and fire scanner feeds that are public)
// found through the free Radio Browser directory and played through this server. The page may only load sound from
// this PC (the content rules allow no outside address), so each station is fetched here and passed along. Nothing is
// fetched unless internet access is switched on, only stations that came from the directory or that the user added by
// hand can be played, and a station can never point back into this PC or the home network. TV lives in lib/tv.js.
const http = require('http'), https = require('https'), fs = require('fs'), path = require('path'), crypto = require('crypto');
const net = require('./net');

/* an ordinary browser's name, the same one the rest of the app uses, so a station cannot pick this app out */
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:128.0) Gecko/20100101 Firefox/128.0';
const HOSTS = ['de1.api.radio-browser.info', 'all.api.radio-browser.info'];
const DATA = path.join(__dirname, '..', 'data'), FILE = path.join(DATA, 'radio.json');
const OFF = 'Internet access is switched off. Radio stations come over the internet, so turn it on to listen.';

/* ---------- categories ---------- */
/* tags are matched exactly against the directory's own tags; names are searched as text; world = ignore the chosen country */
const CATS = [
  { id: 'popular', label: '🔥 Popular' },
  { id: 'news', label: '📰 News', tags: ['news'] },
  { id: 'talk', label: '🎙 Talk', tags: ['talk'] },
  { id: 'scanner', label: '🚓 Scanners', tags: ['police scanner', 'fire scanner', 'scanner', 'police', 'emergency & public safety', 'public safety', 'ems'], names: ['scanner', 'police', 'fire dispatch'], world: true, want: /scanner|dispatch|fire|ems\b|public safety|police|sheriff|rescue|emergency/i, not: /old time radio|exclusive|mystery|detective|rock|\bpop\b|firenze|hits/i },
  { id: 'weather', label: '⛈ Weather', tags: ['weather'], names: ['noaa weather'], world: true },
  { id: 'sports', label: '🏅 Sports', tags: ['sports'] },
  { id: 'christian', label: '✝ Christian', tags: ['christian'] },
  { id: 'rock', label: '🎸 Rock', tags: ['rock'] },
  { id: 'pop', label: '🎤 Pop', tags: ['pop'] },
  { id: 'country', label: '🤠 Country', tags: ['country'] },
  { id: 'classical', label: '🎻 Classical', tags: ['classical'] },
  { id: 'jazz', label: '🎷 Jazz', tags: ['jazz'] },
  { id: 'oldies', label: '📻 Oldies', tags: ['oldies'] }
];
const COUNTRIES = [['', 'Any country'], ['US', 'United States'], ['CA', 'Canada'], ['GB', 'United Kingdom'], ['IE', 'Ireland'], ['AU', 'Australia'], ['NZ', 'New Zealand'], ['DE', 'Germany'], ['FR', 'France'], ['ES', 'Spain'], ['IT', 'Italy'], ['PT', 'Portugal'], ['NL', 'Netherlands'], ['BE', 'Belgium'], ['CH', 'Switzerland'], ['AT', 'Austria'], ['SE', 'Sweden'], ['NO', 'Norway'], ['DK', 'Denmark'], ['FI', 'Finland'], ['PL', 'Poland'], ['UA', 'Ukraine'], ['GR', 'Greece'], ['TR', 'Turkey'], ['IL', 'Israel'], ['MX', 'Mexico'], ['BR', 'Brazil'], ['AR', 'Argentina'], ['CO', 'Colombia'], ['IN', 'India'], ['JP', 'Japan'], ['KR', 'South Korea'], ['PH', 'Philippines'], ['ZA', 'South Africa'], ['NG', 'Nigeria'], ['KE', 'Kenya'], ['VA', 'Vatican City']];

/* ---------- what is kept on this PC: favourites, recently played, stations added by hand ---------- */
const blank = () => ({ fav: [], recent: [], custom: [] });
function read() { try { const j = JSON.parse(fs.readFileSync(FILE, 'utf8')), arr = k => Array.isArray(j[k]) ? j[k] : []; return { fav: arr('fav'), recent: arr('recent'), custom: arr('custom') }; } catch (e) { return blank(); } }
function write(d) { try { fs.mkdirSync(DATA, { recursive: true }); const tmp = FILE + '.tmp'; fs.writeFileSync(tmp, JSON.stringify(d)); fs.renameSync(tmp, FILE); } catch (e) { } }

/* ---------- stations ---------- */
const clean = s => String(s == null ? '' : s).replace(/[\u0000-\u001f\u007f]/g, ' ').replace(/\s+/g, ' ').trim();
const CODECS = { 'MP3': 'audio/mpeg', 'AAC': 'audio/aac', 'AAC+': 'audio/aac', 'OGG': 'audio/ogg' };
/* one directory entry -> the small record the page uses; null when this app cannot play it */
function norm(x) {
  if (!x || !/^[0-9a-f-]{36}$/i.test(String(x.stationuuid || ''))) return null;
  const url = clean(x.url_resolved || x.url), codec = clean(x.codec).toUpperCase();
  if (!/^https?:\/\//i.test(url) || +x.hls === 1 || !CODECS[codec]) return null;
  const name = clean(x.name).slice(0, 90); if (!name) return null;
  return { id: String(x.stationuuid).toLowerCase(), name, url, cc: clean(x.countrycode).toUpperCase().slice(0, 2), state: clean(x.state).slice(0, 40), lang: clean(x.language).slice(0, 30), tags: clean(x.tags).split(',').map(t => t.trim()).filter(Boolean).slice(0, 6), codec, kbps: Math.max(0, Math.min(2000, +x.bitrate || 0)), clicks: +x.clickcount || 0 };
}
const KNOWN = new Map();                       // id -> station, filled by searches (the only addresses a stream may use)
const remember = s => { if (KNOWN.size > 6000) KNOWN.clear(); KNOWN.set(s.id, s); };
const pub = s => ({ id: s.id, name: s.name, cc: s.cc, state: s.state, lang: s.lang, tags: s.tags, codec: s.codec, kbps: s.kbps, mine: s.mine ? 1 : 0 });

/* ---------- the directory ---------- */
function getJson(pathq, hostIx, cb) {
  if (hostIx >= HOSTS.length) return cb(new Error('The station directory could not be reached.'));
  let done = false; const next = () => { if (done) return; done = true; getJson(pathq, hostIx + 1, cb); };
  const req = https.get({ host: HOSTS[hostIx], path: pathq, headers: { 'user-agent': UA, accept: 'application/json' }, timeout: 12000 }, r => {
    if (r.statusCode !== 200) { r.resume(); return next(); }
    const chunks = []; let n = 0;
    r.on('data', c => { n += c.length; if (n > 4e6) { req.destroy(); return; } chunks.push(c); });
    r.on('end', () => { if (done) return; let j; try { j = JSON.parse(Buffer.concat(chunks).toString('utf8')); } catch (e) { return next(); } done = true; cb(null, j); });
    r.on('error', next);
  });
  req.on('error', next); req.on('timeout', () => { req.destroy(); next(); });
}
const api = (p, params) => new Promise(resolve => {
  const qs = Object.entries(params || {}).filter(([, v]) => v !== '' && v != null).map(([k, v]) => encodeURIComponent(k) + '=' + encodeURIComponent(v)).join('&');
  getJson('/json/' + p + (qs ? '?' + qs : ''), 0, (e, j) => resolve(e ? { error: e.message } : j));
});

const SEEN = new Map();                        // search -> { at, list }, so going back to a category is instant
async function search(o) {
  o = o || {};
  if (!net.on()) return { stations: [], internet: false, error: OFF };
  const q = clean(o.q).slice(0, 80), cat = CATS.find(c => c.id === o.cat) || (q ? null : CATS[0]);
  const cc = /^[A-Za-z]{2}$/.test(String(o.cc || '')) ? String(o.cc).toUpperCase() : '', n = Math.max(10, Math.min(200, +o.n || 80));
  const key = [q, cat ? cat.id : '', cc, n].join('|'), hit = SEEN.get(key);
  if (hit && Date.now() - hit.at < 600000) return { stations: hit.list.map(pub), internet: true };
  const base = { hidebroken: 'true', order: 'clickcount', reverse: 'true', limit: n * 2 };
  const local = cat && cat.world ? {} : { countrycode: cc };
  const asks = [];
  if (q) { asks.push(api('stations/search', Object.assign({ name: q }, base, { countrycode: cc }))); asks.push(api('stations/search', Object.assign({ tag: q.toLowerCase() }, base, { countrycode: cc }))); }
  else if (cat.tags || cat.names) {
    (cat.tags || []).forEach(t => asks.push(api('stations/search', Object.assign({ tag: t, tagExact: 'true' }, base, local))));
    (cat.names || []).forEach(t => asks.push(api('stations/search', Object.assign({ name: t }, base, local))));
  } else asks.push(api('stations/search', Object.assign({}, base, local)));
  const got = await Promise.all(asks), by = new Map();
  if (got.every(g => !Array.isArray(g))) return { stations: [], internet: true, error: (got[0] && got[0].error) || 'The station directory could not be reached.' };
  for (const g of got) if (Array.isArray(g)) for (const x of g) { const s = norm(x); if (s && !by.has(s.id)) by.set(s.id, s); }
  let list = [...by.values()];
  if (cat && cat.want) list = list.filter(s => { const t = s.name + ' ' + s.tags.join(' '); return cat.want.test(t) && !cat.not.test(t); });
  list.sort((a, b) => (cat && cat.world && cc ? (b.cc === cc) - (a.cc === cc) : 0) || b.clicks - a.clicks);
  list = list.slice(0, n); list.forEach(remember);
  if (SEEN.size > 200) SEEN.clear(); SEEN.set(key, { at: Date.now(), list });
  return { stations: list.map(pub), internet: true };
}

/* a station by id: one the searches found, one kept on this PC, or (after a restart) looked up again in the directory */
async function find(id) {
  id = String(id || '').toLowerCase();
  if (KNOWN.has(id)) return KNOWN.get(id);
  const d = read(), kept = d.custom.concat(d.fav, d.recent).find(s => s.id === id);
  if (kept) return kept;
  if (!/^[0-9a-f-]{36}$/.test(id) || !net.on()) return null;
  const j = await api('stations/byuuid/' + id), s = Array.isArray(j) ? norm(j[0]) : null;
  if (s) remember(s);
  return s;
}

function status() {
  const d = read();
  return { internet: net.on(), fav: d.fav.map(pub), recent: d.recent.map(pub), custom: d.custom.map(pub), cats: CATS.map(c => [c.id, c.label]), countries: COUNTRIES };
}
async function fav(id, on) {
  const d = read(), i = d.fav.findIndex(s => s.id === String(id || '').toLowerCase());
  if (on && i < 0) { const s = await find(id); if (!s) return { error: 'That station is not known.' }; d.fav.unshift(s); if (d.fav.length > 300) d.fav.length = 300; }
  else if (!on && i >= 0) d.fav.splice(i, 1);
  write(d); return status();
}
async function recent(id) {
  const s = await find(id); if (!s) return { error: 'That station is not known.' };
  const d = read(); d.recent = [s].concat(d.recent.filter(x => x.id !== s.id)).slice(0, 20);
  write(d); return { ok: true, recent: d.recent.map(pub) };
}
/* a station typed in by hand: any stream address the user has (their own scanner feed, a local station) */
async function custom(b) {
  b = b || {}; const d = read();
  if (b.remove) { const id = String(b.remove); d.custom = d.custom.filter(s => s.id !== id); d.fav = d.fav.filter(s => s.id !== id); d.recent = d.recent.filter(s => s.id !== id); write(d); return status(); }
  const name = clean(b.name).slice(0, 90), raw = clean(b.url).slice(0, 600);
  if (!name) return { error: 'Give the station a name.' };
  const ok = await net.safeUrl(raw, { anyPort: true }); if (ok.error) return { error: ok.error };
  const id = 'c-' + crypto.createHash('sha1').update(ok.url.href).digest('hex').slice(0, 16);
  if (!d.custom.some(s => s.id === id)) d.custom.unshift({ id, name, url: ok.url.href, cc: '', state: '', lang: '', tags: ['added by you'], codec: '', kbps: 0, clicks: 0, mine: 1 });
  if (d.custom.length > 100) d.custom.length = 100;
  write(d); return Object.assign(status(), { added: id });
}

/* ---------- playing ---------- */
/* Many stations mix the song title into the sound every few thousand bytes. Left in, it clicks and can stop the player,
   so those blocks are cut out here and the title is kept for the page to show. */
function icyStripper(metaint, onTitle) {
  let left = metaint, mlen = -1, got = 0, parts = [];
  return chunk => {
    const out = []; let i = 0;
    while (i < chunk.length) {
      if (left > 0) { const n = Math.min(left, chunk.length - i); out.push(chunk.subarray(i, i + n)); i += n; left -= n; }
      else if (mlen < 0) { mlen = chunk[i] * 16; i++; got = 0; parts = []; if (!mlen) { mlen = -1; left = metaint; } }
      else {
        const n = Math.min(mlen - got, chunk.length - i); parts.push(chunk.subarray(i, i + n)); got += n; i += n;
        if (got === mlen) { const m = /StreamTitle='([\s\S]*?)';/.exec(Buffer.concat(parts).toString('utf8')); if (m && onTitle) onTitle(clean(m[1]).slice(0, 200)); mlen = -1; left = metaint; }
      }
    }
    return out.length === 1 ? out[0] : Buffer.concat(out);
  };
}
/* a playlist file (.m3u or .pls) names the real stream; a segmented (HLS) list is a different kind this app does not play */
function parsePlaylist(text) {
  const t = String(text || '');
  if (/#EXT-X-/i.test(t)) return { hls: true };
  const pls = /^\s*File\d+\s*=\s*(https?:\/\/\S+)/im.exec(t); if (pls) return { url: pls[1] };
  const line = t.split(/\r?\n/).map(l => l.trim()).find(l => /^https?:\/\//i.test(l));
  return line ? { url: line } : {};
}
const isPlaylist = (ct, u) => /mpegurl|scpls|pls\+xml|audio\/x-pn-realaudio/i.test(ct) || /\.(m3u8?|pls)$/i.test(u.pathname);

const NOW = new Map();                         // station id -> what it says is playing
const now = id => ({ title: (NOW.get(String(id || '').toLowerCase()) || {}).title || '' });

function say(res, code, msg) { if (res.headersSent) { try { res.end(); } catch (e) { } return; } res.writeHead(code, { 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'no-store' }); res.end(msg); }

async function stream(id, req, res) {
  if (!net.on()) return say(res, 403, OFF);
  const st = await find(id); if (!st) return say(res, 404, 'That station is not known.');
  let up = null, closed = false;
  res.on('close', () => { closed = true; NOW.delete(st.id); if (up) up.destroy(); });
  const open = async (raw, depth) => {
    if (closed) return;
    if (depth > 5) return say(res, 502, 'That station sends the player in circles.');
    const ok = await net.safeUrl(raw, { anyPort: true }); if (ok.error) return say(res, 502, ok.error);
    const u = ok.url, mod = u.protocol === 'https:' ? https : http;
    up = mod.get(u, { headers: { 'user-agent': UA, accept: '*/*', 'icy-metadata': '1' }, timeout: 20000 }, r => {
      if (r.statusCode >= 300 && r.statusCode < 400 && r.headers.location) { r.resume(); let nx; try { nx = new URL(r.headers.location, u).href; } catch (e) { return say(res, 502, 'That station gave a bad address.'); } return open(nx, depth + 1); }
      if (r.statusCode !== 200) { r.resume(); return say(res, 502, 'The station answered ' + r.statusCode + '.'); }
      const ct = String(r.headers['content-type'] || '').toLowerCase();
      if (isPlaylist(ct, u)) {
        const chunks = []; let n = 0;
        r.on('data', c => { n += c.length; if (n > 65536) { r.destroy(); return; } chunks.push(c); });
        r.on('close', () => { const p = parsePlaylist(Buffer.concat(chunks).toString('utf8')); if (p.hls) return say(res, 415, 'This station uses a kind of stream Moundshroud cannot play yet.'); if (!p.url) return say(res, 502, 'That station’s playlist was empty.'); open(p.url, depth + 1); });
        return;
      }
      if (/^text\/|json|xml/.test(ct)) { r.resume(); return say(res, 502, 'That address is a web page, not a station.'); }
      const type = /^audio\/|^application\/ogg/.test(ct) ? (/aacp/.test(ct) ? 'audio/aac' : ct.split(';')[0]) : (CODECS[st.codec] || 'audio/mpeg');
      const metaint = +r.headers['icy-metaint'] || 0, strip = metaint > 0 ? icyStripper(metaint, t => NOW.set(st.id, { title: t, at: Date.now() })) : null;
      res.writeHead(200, { 'Content-Type': type, 'Cache-Control': 'no-store', 'Accept-Ranges': 'none' });
      r.on('data', c => { const b = strip ? strip(c) : c; if (b.length && !res.write(b)) { r.pause(); res.once('drain', () => r.resume()); } });
      r.on('end', () => res.end()); r.on('error', () => res.end());
    });
    up.on('timeout', () => { up.destroy(); say(res, 504, 'The station did not answer in time.'); });
    up.on('error', e => say(res, 502, /HPE_|Parse Error/i.test(String(e && (e.code || e.message))) ? 'This station uses an old kind of stream Moundshroud cannot read.' : 'The station could not be reached.'));
  };
  open(st.url, 0);
}


module.exports = { status, search, fav, recent, custom, stream, now, CATS, norm, icyStripper, parsePlaylist, pub };

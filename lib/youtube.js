// YouTube in the TV tab: search YouTube from this server (the page cannot reach other sites), show the results with
// their thumbnails (fetched here and kept in data/yt-thumbs), and play a video in YouTube's own privacy-enhanced player
// (youtube-nocookie.com) inside the app. No account, no sign-in, no cookies are sent. Nothing is fetched while internet
// access is off.
const https = require('https'), fs = require('fs'), path = require('path'), zlib = require('zlib');
const net = require('./net');

const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:128.0) Gecko/20100101 Firefox/128.0';
const THUMBS = path.join(__dirname, '..', 'data', 'yt-thumbs');
const OFF = 'Internet access is switched off. YouTube needs the internet, so turn it on to watch.';
const ID = /^[A-Za-z0-9_-]{11}$/;
const clean = s => String(s == null ? '' : s).replace(/[\u0000-\u001f\u007f]/g, ' ').replace(/\s+/g, ' ').trim();

function get(url, cap) {
  return new Promise(resolve => {
    const req = https.get(url, { headers: { 'user-agent': UA, accept: 'text/html,*/*', 'accept-language': 'en-US,en;q=0.8', 'accept-encoding': 'gzip', cookie: 'CONSENT=YES+1; SOCS=CAI' }, timeout: 15000, maxHeaderSize: 131072 }, r => {     // YouTube's answer headers pass Node's 16 KB limit
      if (r.statusCode !== 200) { r.resume(); return resolve({ error: 'YouTube answered ' + r.statusCode + '.' }); }
      const c = []; let n = 0;
      r.on('data', b => { n += b.length; if (n > cap) { req.destroy(); return; } c.push(b); });
      r.on('end', () => { let b = Buffer.concat(c); try { if (/gzip/.test(r.headers['content-encoding'] || '')) b = zlib.gunzipSync(b); } catch (e) { } resolve({ text: b.toString('utf8') }); });
      r.on('error', () => resolve({ error: 'YouTube could not be read.' }));
    });
    req.on('error', () => resolve({ error: 'YouTube could not be reached.' })); req.on('timeout', () => { req.destroy(); resolve({ error: 'YouTube did not answer in time.' }); });
  });
}

/* the results page carries its data as one JSON object, "var ytInitialData = {...};" */
function initialData(html) {
  const i = html.indexOf('var ytInitialData = '); if (i < 0) return null;
  const s = html.indexOf('{', i); let depth = 0, inStr = false, esc = false;
  for (let k = s; k < html.length; k++) {
    const ch = html[k];
    if (inStr) { if (esc) esc = false; else if (ch === '\\') esc = true; else if (ch === '"') inStr = false; continue; }
    if (ch === '"') inStr = true; else if (ch === '{') depth++; else if (ch === '}') { depth--; if (!depth) { try { return JSON.parse(html.slice(s, k + 1)); } catch (e) { return null; } } }
  }
  return null;
}
const txt = t => clean(t ? (t.simpleText != null ? t.simpleText : (t.runs || []).map(r => r.text).join('')) : '');
/* every videoRenderer anywhere in the data, in page order */
function videos(data) {
  const out = [], seen = new Set();
  (function walk(o, depth) {
    if (!o || typeof o !== 'object' || depth > 40) return;
    if (Array.isArray(o)) { for (const x of o) walk(x, depth + 1); return; }
    const v = o.videoRenderer;
    if (v && ID.test(v.videoId || '') && !seen.has(v.videoId)) {
      seen.add(v.videoId);
      const badges = JSON.stringify(v.badges || []) + JSON.stringify(v.thumbnailOverlays || []);
      out.push({ id: v.videoId, title: txt(v.title).slice(0, 200), channel: txt(v.ownerText || v.longBylineText).slice(0, 80), len: txt(v.lengthText), views: txt(v.shortViewCountText || v.viewCountText).slice(0, 40), when: txt(v.publishedTimeText).slice(0, 40), live: /LIVE|BADGE_STYLE_TYPE_LIVE_NOW/.test(badges) && !txt(v.lengthText) ? 1 : 0 });
    }
    for (const k in o) if (k !== 'videoRenderer') walk(o[k], depth + 1);
  })(data, 0);
  return out;
}

/* YouTube's own search is a JSON request (the youtubei API), so there is no big HTML page to download and parse: it
   answers in about a second with the results as data. Older code scraped the results page, which was slower and now
   and then came back empty; that scrape is kept below as a fallback for when the JSON request does not answer. */
const CTX = { client: { clientName: 'WEB', clientVersion: '2.20240101.00.00', hl: 'en', gl: 'US' } };
function postJson(apiPath, payload, cap, ms) {
  return new Promise(resolve => {
    const body = Buffer.from(JSON.stringify(payload));
    const req = https.request('https://www.youtube.com' + apiPath, { method: 'POST', headers: { 'content-type': 'application/json', 'user-agent': UA, 'accept-encoding': 'gzip', 'x-youtube-client-name': '1', 'x-youtube-client-version': CTX.client.clientVersion, 'content-length': body.length }, timeout: ms || 12000, maxHeaderSize: 131072 }, r => {
      if (r.statusCode !== 200) { r.resume(); return resolve({ error: 'YouTube answered ' + r.statusCode + '.' }); }
      const c = []; let n = 0;
      r.on('data', b => { n += b.length; if (n > cap) { req.destroy(); return; } c.push(b); });
      r.on('end', () => { let b = Buffer.concat(c); try { if (/gzip/.test(r.headers['content-encoding'] || '')) b = zlib.gunzipSync(b); } catch (e) { } try { resolve({ json: JSON.parse(b.toString('utf8')) }); } catch (e) { resolve({ error: 'YouTube sent back something unreadable.' }); } });
      r.on('error', () => resolve({ error: 'YouTube could not be read.' }));
    });
    req.on('error', () => resolve({ error: 'YouTube could not be reached.' })); req.on('timeout', () => { req.destroy(); resolve({ error: 'YouTube did not answer in time.' }); });
    req.write(body); req.end();
  });
}

const CACHE = new Map();
async function search(q) {
  if (!net.on()) return { error: OFF, videos: [] };
  q = clean(q).slice(0, 150); if (!q) return { videos: [] };
  const hit = CACHE.get(q.toLowerCase()); if (hit && Date.now() - hit.at < 15 * 60000) return { videos: hit.list };
  let list = [], err = '';
  /* the fast JSON way first */
  const j = await postJson('/youtubei/v1/search?prettyPrint=false', { context: CTX, query: q }, 8e6, 12000);
  if (j.json) list = videos(j.json).slice(0, 40); else err = j.error || '';
  /* the old page scrape, only if the JSON request did not come back with anything */
  if (!list.length) { const r = await get('https://www.youtube.com/results?search_query=' + encodeURIComponent(q) + '&hl=en&gl=US', 6e6); if (r.text) { const d = initialData(r.text); if (d) { list = videos(d).slice(0, 40); err = ''; } } else if (!err) err = r.error || 'YouTube did not answer.'; }
  if (!list.length) return { error: err || 'No videos came back. Try again in a moment.', videos: [] };
  if (CACHE.size > 200) CACHE.clear(); CACHE.set(q.toLowerCase(), { at: Date.now(), list });
  return { videos: list };
}

/* a thumbnail from i.ytimg.com only, kept on this PC */
function thumb(id, res) {
  const send = (code, body, type) => { res.writeHead(code, { 'Content-Type': type || 'text/plain', 'Cache-Control': code === 200 ? 'private, max-age=604800' : 'no-store' }); res.end(body); };
  if (!ID.test(String(id || ''))) return send(404, 'bad id');
  const file = path.join(THUMBS, id + '.jpg');
  try { return send(200, fs.readFileSync(file), 'image/jpeg'); } catch (e) { }
  if (!net.on()) return send(404, 'offline');
  const rq = https.get('https://i.ytimg.com/vi/' + id + '/mqdefault.jpg', { headers: { 'user-agent': UA }, timeout: 12000 }, r => {
    if (r.statusCode !== 200 || !/^image\//.test(r.headers['content-type'] || '')) { r.resume(); return send(404, 'none'); }
    const c = []; let n = 0;
    r.on('data', b => { n += b.length; if (n > 600000) { rq.destroy(); return; } c.push(b); });
    r.on('end', () => { const b = Buffer.concat(c); send(200, b, 'image/jpeg'); try { fs.mkdirSync(THUMBS, { recursive: true }); fs.writeFileSync(file, b); prune(); } catch (e) { } });
  });
  rq.on('error', () => { if (!res.headersSent) send(404, 'error'); }); rq.on('timeout', () => { rq.destroy(); });
}
function prune() { try { const f = fs.readdirSync(THUMBS); if (f.length < 2000) return; f.map(n => ({ n, t: fs.statSync(path.join(THUMBS, n)).mtimeMs })).sort((a, b) => a.t - b.t).slice(0, 400).forEach(o => { try { fs.unlinkSync(path.join(THUMBS, o.n)); } catch (e) { } }); } catch (e) { } }

/* a channel's /live address -> the video it is streaming now (read from the page YouTube sends back) */
async function live(url) {
  if (!net.on()) return { error: OFF };
  let u; try { u = new URL(url); } catch (e) { return { error: 'Bad address.' }; }
  if (!/(^|\.)youtube\.com$|^youtu\.be$/i.test(u.hostname)) return { error: 'Not a YouTube address.' };
  const direct = idFrom(url); if (direct) return { id: direct };
  const r = await get('https://www.youtube.com' + u.pathname.replace(/\/+$/, '') + (/\/live$/.test(u.pathname) ? '' : '/live'), 4e6);
  if (r.error) return r;
  const m = /<link rel="canonical" href="https:\/\/www\.youtube\.com\/watch\?v=([A-Za-z0-9_-]{11})"/.exec(r.text) || /"videoDetails":\{"videoId":"([A-Za-z0-9_-]{11})"/.exec(r.text);
  return m ? { id: m[1] } : { error: 'This channel is not live right now.' };
}

/* a pasted YouTube address -> its video id */
function idFrom(s) {
  s = clean(s); if (ID.test(s)) return s;
  try { const u = new URL(s); if (!/(^|\.)(youtube\.com|youtube-nocookie\.com|youtu\.be)$/i.test(u.hostname)) return ''; if (/youtu\.be$/i.test(u.hostname)) return ID.test(u.pathname.slice(1, 12)) ? u.pathname.slice(1, 12) : ''; const v = u.searchParams.get('v'); if (v && ID.test(v)) return v; const m = /\/(embed|shorts|live|v)\/([A-Za-z0-9_-]{11})/.exec(u.pathname); return m ? m[2] : ''; } catch (e) { return ''; }
}

/* is this video a live stream right now? YouTube's own player endpoint answers in a small piece of JSON: isLive is
true only while it is actually broadcasting (isLiveContent stays true for a finished stream, so it cannot be used) */
async function liveNow(id) {
  if (!net.on()) return { error: OFF };
  if (!ID.test(String(id || ''))) return { error: 'That is not a YouTube video id.' };
  const j = await postJson('/youtubei/v1/player?prettyPrint=false', { context: CTX, videoId: id }, 4e6, 12000);
  if (!j.json) return { error: j.error || 'YouTube did not answer.' };
  const ps = j.json.playabilityStatus || {}, vd = j.json.videoDetails || {};
  const live = vd.isLive === true || vd.isLiveNow === true;
  return { live, liveContent: !!vd.isLiveContent, status: ps.status || '', error: '' };
}

module.exports = { search, thumb, initialData, videos, idFrom, live, liveNow, ID };

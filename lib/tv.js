// TV: live video links (the kind VLC opens: .m3u8 streams, .m3u channel lists, plain video addresses), kept on this
// PC in data/tv.json, imported from VLC's recent list, and played in the TV tab. The page cannot read these streams, so
// ffmpeg (the one the Converter uses) reads each stream and hands the page ordinary MP4 video. Every request ffmpeg
// makes passes a small gate here that refuses this PC and the home network.
// Names: VLC only keeps addresses, so each link is looked up in the free iptv-org channel index (cached in
// data/tv-index.json, refreshed weekly while internet access is on) for its real name, category, country and logo.
// Links the index does not know get a name read from the address (ArenaSport2HD -> Arena Sport 2 HD), and any name can
// be changed by hand. Nothing is fetched while internet access is off.
const http = require('http'), https = require('https'), fs = require('fs'), path = require('path'), crypto = require('crypto'), cp = require('child_process'), tcp = require('net');
const net = require('./net');

const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:128.0) Gecko/20100101 Firefox/128.0';
const DATA = path.join(__dirname, '..', 'data'), FILE = path.join(DATA, 'tv.json'), INDEX = path.join(DATA, 'tv-index.json'), LOGOS = path.join(DATA, 'tv-logos');
const INDEX_URL = 'https://iptv-org.github.io/iptv/index.m3u';
const OFF = 'Internet access is switched off. TV comes over the internet, so turn it on to watch.';
const clean = s => String(s == null ? '' : s).replace(/[\u0000-\u001f\u007f]/g, ' ').replace(/\s+/g, ' ').trim();
const sha = s => crypto.createHash('sha1').update(String(s)).digest('hex').slice(0, 16);

/* ---------- what is kept: the links ---------- */
function read() { try { const j = JSON.parse(fs.readFileSync(FILE, 'utf8')); return { links: Array.isArray(j.links) ? j.links : [], seeded: j.seeded ? 1 : 0 }; } catch (e) { return { links: [], seeded: 0 }; } }
function write(d) { try { fs.mkdirSync(DATA, { recursive: true }); const tmp = FILE + '.tmp'; fs.writeFileSync(tmp, JSON.stringify(d)); fs.renameSync(tmp, FILE); } catch (e) { } }
/* the links lived in data/radio.json for a day (the Radio tab's TV & video section): move them here once */
(function migrate() {
  try {
    if (fs.existsSync(FILE)) return;
    const rf = path.join(DATA, 'radio.json'), r = JSON.parse(fs.readFileSync(rf, 'utf8'));
    if (!Array.isArray(r.media) || !r.media.length) return;
    write({ links: r.media.map(m => ({ id: 'm-' + sha(m.url), url: m.url, name: m.name, auto: 1, from: m.from || 'you' })) });
    delete r.media; fs.writeFileSync(rf, JSON.stringify(r));
  } catch (e) { }
})();

/* ---------- names ---------- */
const QUAL = /\s*\((\d{3,4}[pi]|4k|uhd)\)/i, GEO = /\s*(\[geo-blocked\]|Ⓖ)/i, NOT247 = /\s*\[not 24\/7\]/i;
/* "F1 Channel (1080p) [Geo-blocked]" -> name "F1 Channel", quality "1080p", geo true */
function splitName(raw) {
  let n = clean(raw); const q = (QUAL.exec(n) || [])[1] || '', geo = GEO.test(n), part = NOT247.test(n);
  n = n.replace(QUAL, '').replace(GEO, '').replace(NOT247, '').replace(/[Ⓐ-ⓩ]/g, '').replace(/\s*\[[^\]]*\]\s*$/, '').replace(/\s+/g, ' ').trim();
  return { name: n, q, geo, part };
}
const COUNTRY = { HR: 'Croatia', BH: 'Bosnia', BA: 'Bosnia', RS: 'Serbia', SI: 'Slovenia', MK: 'North Macedonia', ME: 'Montenegro', SK: 'Slovakia', CZ: 'Czechia', UA: 'Ukraine', PL: 'Poland', RO: 'Romania', BG: 'Bulgaria', HU: 'Hungary' };
const WORDS = { jedan: '1', dva: '2', tri: '3', one: '1', two: '2', three: '3' };
const ABBR = { AS: 'Arena Sport', TV: 'TV', HD: 'HD', FHD: 'Full HD', UHD: 'UHD', SD: 'SD', BBC: 'BBC', CNN: 'CNN', ESPN: 'ESPN', NFL: 'NFL', NBA: 'NBA', F1: 'F1' };
/* a name read from an address, for links the index does not know */
function guessName(raw) {
  let u; try { u = new URL(raw); } catch (e) { return 'Channel'; }
  const parts = u.pathname.split('/').filter(Boolean).map(p => { try { return decodeURIComponent(p); } catch (e) { return p; } }).map(p => p.replace(/\.(m3u8?|mpd|mp4|ts|php|smil|aspx?)$/i, ''));
  const dull = /^(index|playlist|master|chunklist|live|stream|streams|hls|feeds?|iptv|video|manifest|play|out|v\d|tracks-v\d.*)$/i;
  let best = parts.filter(p => p && !dull.test(p)).pop() || '';
  for (const k of ['id', 'channel', 'ch', 'name', 'stream']) { const v = u.searchParams.get(k); if (v && (!best || /^(georgia_?play|play|player)$/i.test(best))) { best = v; break; } }
  if (!best) return 'Channel (' + u.hostname.replace(/^www\./, '') + ')';
  if (/^\d+$/.test(best)) return 'Channel ' + best;
  let s = best.replace(/^test[_-]?/i, '').replace(/_tizen$|_web$|_hls$/i, '').replace(/[_.-]+/g, ' ');
  s = s.replace(/([a-z])([A-Z])/g, '$1 $2').replace(/([A-Za-z])(\d)/g, '$1 $2').replace(/(\d)([A-Za-z])/g, '$1 $2').replace(/([A-Z]+)([A-Z][a-z])/g, '$1 $2');
  s = s.replace(/(\d) plus (\d)/gi, '$1+$2').replace(/\b([A-Z]{2})(HD|SD|FHD)\b/g, '$1 $2').replace(/arena ?sport/gi, 'Arena Sport');
  let cc = '';
  const words = s.split(' ').filter(Boolean).map((w, i, a) => {
    const up = w.toUpperCase();
    if (i === a.length - 1 && COUNTRY[up] && a.length > 1) { cc = COUNTRY[up]; return ''; }
    if (i === a.length - 2 && COUNTRY[up] && /^(HD|SD|FHD)$/i.test(a[a.length - 1]) && a.length > 2) { cc = COUNTRY[up]; return ''; }
    if (WORDS[w.toLowerCase()]) return WORDS[w.toLowerCase()];
    if (ABBR[up]) return ABBR[up];
    if (/^[a-z]/.test(w)) return w[0].toUpperCase() + w.slice(1);
    return w;
  }).filter(Boolean);
  /* "Arena Sport 2 HD" reads better than "Arena Sport 2 H D"; a lone sports code after AS is already handled above */
  return clean(words.join(' ') + (cc ? ' (' + cc + ')' : '')).slice(0, 90) || 'Channel';
}
const isListUrl = u => /\.m3u(\?|$)/i.test(u);
function listName(raw) {
  let u; try { u = new URL(raw); } catch (e) { return 'Channel list'; }
  const p = u.pathname.replace(/\.m3u$/i, '').split('/').filter(Boolean);
  if (/iptv-org/i.test(u.hostname)) {
    const last = p[p.length - 1] || '', kind = p[p.length - 2] || '';
    if (last === 'index') return 'Every free channel (iptv-org)';
    if (kind === 'countries') { let n = last.toUpperCase(); try { n = new Intl.DisplayNames(['en'], { type: 'region' }).of(last.toUpperCase()) || n; } catch (e) { } return n + ' channels (iptv-org)'; }
    if (kind === 'categories') return last.replace(/[_-]+/g, ' ').replace(/^\w/, c => c.toUpperCase()) + ' channels (iptv-org)';
    if (kind === 'languages') { let n = last; try { n = new Intl.DisplayNames(['en'], { type: 'language' }).of(last) || n; } catch (e) { } return n + ' language channels (iptv-org)'; }
  }
  return (guessName(raw) || 'Channel') + ' (channel list)';
}

/* ---------- more channels: free lists, checked on 2026-11-15, with plain names ---------- */
const IO = 'https://iptv-org.github.io/iptv/';
const SOURCES = [
  ['freetv', '✅ Free-TV: hand-checked free channels', 'https://raw.githubusercontent.com/Free-TV/IPTV/master/playlist.m3u8', 'About 2,200 free channels that people check by hand, sorted by country.'],
  ['all', '🌐 Every free channel', IO + 'index.m3u', 'All 11,000+ channels in the iptv-org list, sorted by kind. Big: it takes a few seconds to open.'],
  ['sports', '🏅 Sports channels', IO + 'categories/sports.m3u', 'Sports channels from around the world.'],
  ['news', '📰 News channels', IO + 'categories/news.m3u', 'About 1,000 news channels from around the world.'],
  ['movies', '🎬 Movie channels', IO + 'categories/movies.m3u', 'About 780 channels that show films all day, including Pluto TV.'],
  ['series', '📺 TV series channels', IO + 'categories/series.m3u', 'About 520 channels of TV shows.'],
  ['classic', '📼 Classic TV', IO + 'categories/classic.m3u', 'Old films and shows, about 100 channels.'],
  ['comedy', '😂 Comedy channels', IO + 'categories/comedy.m3u', 'About 220 comedy channels.'],
  ['music', '🎵 Music channels', IO + 'categories/music.m3u', 'About 780 music video and concert channels.'],
  ['kids', '🧒 Kids channels', IO + 'categories/kids.m3u', 'About 450 children\'s channels.'],
  ['animation', '🐻 Cartoons', IO + 'categories/animation.m3u', 'About 180 cartoon and animation channels.'],
  ['documentary', '🌍 Documentaries', IO + 'categories/documentary.m3u', 'About 250 documentary channels.'],
  ['science', '🔬 Science', IO + 'categories/science.m3u', 'Science and technology channels.'],
  ['education', '🎓 Learning', IO + 'categories/education.m3u', 'About 200 education channels.'],
  ['cooking', '🍳 Cooking', IO + 'categories/cooking.m3u', 'About 60 cooking channels.'],
  ['outdoor', '🏕 Outdoors', IO + 'categories/outdoor.m3u', 'Fishing, hunting, farming and outdoor channels.'],
  ['travel', '✈ Travel', IO + 'categories/travel.m3u', 'About 65 travel channels.'],
  ['weather', '⛈ Weather', IO + 'categories/weather.m3u', 'Weather channels, including AccuWeather.'],
  ['religious', '✝ Faith channels', IO + 'categories/religious.m3u', 'About 800 Christian and other faith channels.'],
  ['us', '🇺🇸 United States', IO + 'countries/us.m3u', 'About 1,500 channels from the United States.'],
  ['uk', '🇬🇧 United Kingdom', IO + 'countries/uk.m3u', 'About 300 channels from the United Kingdom.'],
  ['ca', '🇨🇦 Canada', IO + 'countries/ca.m3u', 'About 260 channels from Canada.'],
  ['au', '🇦🇺 Australia', IO + 'countries/au.m3u', 'About 80 channels from Australia.'],
  ['ie', '🇮🇪 Ireland', IO + 'countries/ie.m3u', 'About 60 channels from Ireland.'],
  ['eng', '🗣 Every English-language channel', IO + 'languages/eng.m3u', 'About 3,000 channels in English, from every country.']
].map(([id, name, url, about]) => ({ id, name, url, about }));
function sources() { const d = read(); return SOURCES.map(s => ({ id: s.id, name: s.name, about: s.about, added: d.links.some(x => x.url === s.url) ? 1 : 0 })); }
/* add one list, or all of them ("all"); a list the user removed is only added back when asked */
function addSource(id) {
  const d = read(), pick = id === 'all' ? SOURCES : SOURCES.filter(s => s.id === id); if (!pick.length) return { error: 'That list is not known.' };
  for (const x of d.links) { const s2 = SOURCES.find(y => y.url === x.url); if (s2 && !x.mine) { x.name = s2.name; x.src = s2.id; x.mine = 1; delete x.auto; } }      // lists already here get the same plain names
  for (const s of pick) if (!d.links.some(x => x.url === s.url)) d.links.push({ id: 'm-' + sha(s.url), url: s.url, name: s.name, list: 1, mine: 1, from: 'more', src: s.id });
  d.seeded = 1; write(d); return Object.assign(status(), { sources: sources() });
}

/* ---------- channel lists (.m3u) ---------- */
/* each channel: an #EXTINF line (name, tvg-logo, tvg-id, group-title), maybe #EXTVLCOPT lines, then its address */
function parseChannels(text) {
  const out = [], seen = new Set(); let info = null, opt = {};
  for (const raw of String(text || '').split(/\r?\n/)) {
    const l = raw.trim(); if (!l) continue;
    if (/^#EXTINF/i.test(l)) {
      const q = l.replace(/"[^"]*"/g, s => s.replace(/,/g, ' ')), c = q.indexOf(',', q.indexOf(':')), attr = k => clean((new RegExp(k + '="([^"]*)"', 'i').exec(l) || [])[1] || '');
      const id = attr('tvg-id'), ccm = /\.([a-z]{2})(@|$)/i.exec(id);
      const gs = attr('group-title').split(';').map(x => x.trim()).filter(Boolean), g = gs.find(x => !/^(general|undefined)$/i.test(x)) || (gs[0] && !/^undefined$/i.test(gs[0]) ? gs[0] : '');
      info = { raw: c >= 0 ? l.slice(c + 1) : '', group: g, logo: attr('tvg-logo'), cc: ccm ? ccm[1].toUpperCase() : '' }; continue;
    }
    if (/^#EXTVLCOPT:/i.test(l)) { const m = /^#EXTVLCOPT:http-(user-agent|referrer)=(.*)$/i.exec(l); if (m) opt[m[1].toLowerCase() === 'referrer' ? 'ref' : 'ua'] = clean(m[2]).slice(0, 300); continue; }
    if (l[0] === '#') continue;
    if (/^https?:\/\//i.test(l) && l.length < 800 && !seen.has(l)) {
      seen.add(l); const sp = splitName(info && info.raw || '');
      const yt = /^https:\/\/(www\.)?youtube\.com\/|^https:\/\/youtu\.be\//i.test(l) ? 1 : 0;
      out.push({ yt, part: sp.part ? 1 : 0, id: 'ch-' + sha(l), url: l, name: (sp.name || guessName(l)).slice(0, 90), q: sp.q, geo: sp.geo ? 1 : 0, group: info ? info.group.slice(0, 40) : '', cc: info ? info.cc : '', logo: info && /^https?:\/\//i.test(info.logo) ? info.logo.slice(0, 500) : '', ua: opt.ua || '', ref: opt.ref || '' });
    }
    info = null; opt = {};
  }
  return out;
}
const isChannelList = t => /^\s*#EXTM3U/i.test(t) && !/#EXT-X-(TARGETDURATION|STREAM-INF|MEDIA-SEQUENCE)/i.test(t) && /#EXTINF/i.test(t);

/* ---------- the public channel index, for names ---------- */
let IDX = null;                                // { at, byUrl, byBare, byPath }
const bare = u => String(u).replace(/^https?:\/\//i, '').replace(/[?#].*$/, '').toLowerCase();
const pathKey = u => { try { const x = new URL(u); return (x.pathname + x.search).toLowerCase(); } catch (e) { return ''; } };
function buildIndex(list, at) {
  const byUrl = new Map(), byBare = new Map(), byPath = new Map();
  for (const c of list) {
    byUrl.set(c.url, c); byBare.set(bare(c.url), c);
    /* the same path on another host: only trusted when every channel on that path has the same name */
    const pk = pathKey(c.url); if (pk.length > 12) { const prev = byPath.get(pk); if (prev === undefined) byPath.set(pk, c); else if (prev && prev.name !== c.name) byPath.set(pk, null); }
  }
  return { at, size: list.length, byUrl, byBare, byPath };
}
function loadIndex() {
  if (IDX) return IDX;
  try { const j = JSON.parse(fs.readFileSync(INDEX, 'utf8')); IDX = buildIndex(j.ch.map(a => ({ url: a[0], name: a[1], q: a[2], geo: a[3], group: a[4], cc: a[5], logo: a[6], ua: a[7], ref: a[8] })), j.at || 0); } catch (e) { IDX = buildIndex([], 0); }
  return IDX;
}
function lookup(url) {
  const I = loadIndex(); if (!I.size) return null;
  return I.byUrl.get(url) || I.byBare.get(bare(url)) || I.byPath.get(pathKey(url)) || null;
}
let refreshing = null;
function refreshIndex(force) {
  if (refreshing) return refreshing;
  const I = loadIndex();
  if (!net.on() || (!force && I.size && Date.now() - I.at < 7 * 864e5)) return Promise.resolve(false);
  refreshing = fetchText(INDEX_URL, 20e6).then(got => {
    refreshing = null;
    if (got.error || !isChannelList(got.text)) return false;
    const list = parseChannels(got.text); if (list.length < 1000) return false;
    try { fs.mkdirSync(DATA, { recursive: true }); fs.writeFileSync(INDEX, JSON.stringify({ at: Date.now(), ch: list.map(c => [c.url, c.name, c.q, c.geo, c.group, c.cc, c.logo, c.ua, c.ref]) })); } catch (e) { }
    IDX = buildIndex(list, Date.now()); applyNames(); return true;
  }, () => { refreshing = null; return false; });
  return refreshing;
}
/* give every link the index knows its real name and details (a name the user typed is kept) */
/* a category for a link the index does not know, from the words in its name */
const guessGroup = n => /sport|arena|golf|fight|f1|football|soccer|tennis|nba|nfl|espn|racing/i.test(n) ? 'Sports' : /news|cnn|bbc|sky news/i.test(n) ? 'News' : /movie|cinema|film/i.test(n) ? 'Movies' : /music|mtv|hits/i.test(n) ? 'Music' : /kids|cartoon/i.test(n) ? 'Kids' : '';
function applyNames() {
  const d = read(); let n = 0;
  for (const x of d.links) {
    if (x.auto && !x.list && isListUrl(x.url)) x.list = 1;
    if (x.list) { if (x.auto) { x.name = listName(x.url); delete x.auto; n++; } continue; }
    const hit = lookup(x.url);
    if (hit) { const before = JSON.stringify(x); delete x.guess; Object.assign(x, x.mine ? {} : { name: hit.name }, { q: hit.q || x.q || '', geo: hit.geo || 0, group: hit.group || x.group || '', cc: hit.cc || x.cc || '', logo: hit.logo || x.logo || '', ua: x.ua || hit.ua || '', ref: x.ref || hit.ref || '' }); delete x.auto; if (JSON.stringify(x) !== before) n++; }
    else if (x.auto) { x.name = guessName(x.url); x.guess = 1; x.group = x.group || guessGroup(x.name); delete x.auto; n++; }
  }
  if (n) write(d);
  return n;
}

/* ---------- VLC ---------- */
function vlcExe() { for (const b of [process.env.ProgramFiles, process.env['ProgramFiles(x86)']]) { if (!b) continue; const p = path.join(b, 'VideoLAN', 'VLC', 'vlc.exe'); try { if (fs.statSync(p).isFile()) return p; } catch (e) { } } return ''; }
function parseVlc(ini, xspf) {
  const out = [], add = u => { u = String(u || '').trim(); if (/^https?:\/\//i.test(u) && u.length < 600 && !out.includes(u)) out.push(u); };
  const sec = /^\[RecentsMRL\]\s*$/m.exec(String(ini || ''));
  if (sec) {
    const rest = String(ini).slice(sec.index + sec[0].length), end = rest.search(/^\[/m), body = end < 0 ? rest : rest.slice(0, end), m = /^list=(.*)$/m.exec(body);
    if (m) { const re = /"([^"]*)"|([^,\s][^,]*)/g; let x; while ((x = re.exec(m[1]))) add(x[1] != null ? x[1] : x[2]); }
  }
  const re2 = /<location>([^<]*)<\/location>/g; let y;
  while ((y = re2.exec(String(xspf || '')))) add(y[1].replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&amp;/g, '&'));
  return out;
}
function vlcLinks() { const dir = path.join(process.env.APPDATA || '', 'vlc'), rd = f => { try { return fs.readFileSync(path.join(dir, f), 'utf8'); } catch (e) { return ''; } }; return parseVlc(rd('vlc-qt-interface.ini'), rd('ml.xspf')); }

/* ---------- status and editing ---------- */
const ffmpegPath = () => { try { return require('./mediaconv').ffmpeg() || ''; } catch (e) { return ''; } };
const hostOf = u => { try { return new URL(u).hostname.replace(/^www\./, ''); } catch (e) { return ''; } };
const pub = x => ({ id: x.id, name: x.name, list: x.list ? 1 : 0, group: x.group || '', cc: x.cc || '', q: x.q || '', geo: x.geo ? 1 : 0, logo: x.logo ? 1 : 0, host: hostOf(x.url), from: x.from || 'you', guess: x.guess ? 1 : 0, count: x.count || 0 });
function status() {
  let d = read(); const I = loadIndex();
  if (!d.seeded) { addSource('all'); d = read(); }
  if (d.links.some(x => x.auto || (x.guess && I.size))) { applyNames(); d = read(); }            // a name from the address now; the index improves it when it arrives
  if (net.on() && (!I.size || Date.now() - I.at > 7 * 864e5)) refreshIndex(false);
  return { internet: net.on(), video: !!ffmpegPath(), vlc: { installed: !!vlcExe(), links: vlcLinks().filter(u => !d.links.some(x => x.url === u)).length }, links: d.links.map(pub), index: { at: I.at, size: I.size, busy: !!refreshing } };
}
const newLink = (url, from) => ({ id: 'm-' + sha(url), url, name: '', auto: 1, from, list: isListUrl(url) ? 1 : 0 });
async function importVlc() {
  const d = read(); let n = 0;
  for (const u of vlcLinks()) { if (d.links.some(x => x.url === u) || d.links.length >= 1000) continue; d.links.push(newLink(u, 'vlc')); n++; }
  write(d); await refreshIndex(false); applyNames();
  return Object.assign(status(), { imported: n });
}
async function add(b) {
  b = b || {}; const d = read();
  /* a channel from an open list: keep it with everything the list said about it */
  if (b.channel) {
    const c = CHAN.get(String(b.channel)); if (!c) return { error: 'Open that channel list again, then save the channel.' };
    if (!d.links.some(x => x.url === c.url)) d.links.unshift({ id: 'm-' + sha(c.url), url: c.url, name: c.name, q: c.q, geo: c.geo, group: c.group, cc: c.cc, logo: c.logo, ua: c.ua, ref: c.ref, from: 'list' });
    write(d); return Object.assign(status(), { added: 'm-' + sha(c.url) });
  }
  const ok = await net.safeUrl(clean(b.url).slice(0, 600), { anyPort: true }); if (ok.error) return { error: ok.error };
  const url = ok.url.href, name = clean(b.name).slice(0, 90);
  if (!d.links.some(x => x.url === url)) { const x = newLink(url, 'you'); if (name) { x.name = name; x.mine = 1; delete x.auto; } d.links.unshift(x); }
  if (d.links.length > 1000) d.links.length = 1000;
  write(d); applyNames(); return Object.assign(status(), { added: 'm-' + sha(url) });
}
function remove(id) { const d = read(); d.links = d.links.filter(x => x.id !== String(id)); write(d); return status(); }
function rename(id, name) {
  const d = read(), x = d.links.find(y => y.id === String(id)); if (!x) return { error: 'That link is not known.' };
  name = clean(name).slice(0, 90); if (!name) return { error: 'Type a name.' };
  x.name = name; x.mine = 1; delete x.auto; delete x.guess; write(d); return status();
}
async function names() { await refreshIndex(true); const n = applyNames(); return Object.assign(status(), { renamed: n }); }

/* ---------- opening a link ---------- */
function fetchText(raw, cap, depth) {
  return new Promise(async resolve => {
    if ((depth || 0) > 4) return resolve({ error: 'Too many redirects.' });
    const ok = await net.safeUrl(raw, { anyPort: true }); if (ok.error) return resolve({ error: ok.error });
    const u = ok.url, req = (u.protocol === 'https:' ? https : http).get(u, { headers: { 'user-agent': UA, accept: '*/*', 'accept-encoding': 'identity' }, timeout: 20000 }, r => {
      if (r.statusCode >= 300 && r.statusCode < 400 && r.headers.location) { r.resume(); let nx; try { nx = new URL(r.headers.location, u).href; } catch (e) { return resolve({ error: 'Bad redirect.' }); } return resolve(fetchText(nx, cap, (depth || 0) + 1)); }
      if (r.statusCode !== 200) { r.resume(); return resolve({ error: 'The address answered ' + r.statusCode + '.' }); }
      const chunks = []; let n = 0, sniffed = false, done = false;
      const fin = v => { if (!done) { done = true; resolve(v); } };
      r.on('data', c => {
        chunks.push(c); n += c.length;
        /* anything that does not start like a playlist is sound or video: stop reading at once */
        if (!sniffed && n >= 7) { sniffed = true; if (!/^\s*#EXTM3U/i.test(Buffer.concat(chunks).toString('utf8', 0, 200))) { req.destroy(); return fin({ text: '' }); } }
        if (n > cap) { req.destroy(); fin({ text: Buffer.concat(chunks).toString('utf8') }); }
      });
      r.on('end', () => fin({ text: Buffer.concat(chunks).toString('utf8') })); r.on('error', () => fin({ text: '' })); r.on('close', () => fin({ text: Buffer.concat(chunks).toString('utf8') }));
    });
    req.on('error', () => resolve({ error: 'That address could not be reached.' })); req.on('timeout', () => { req.destroy(); resolve({ error: 'That address did not answer in time.' }); });
  });
}
const CHAN = new Map();                        // channel id -> channel, filled when a channel list is opened
const find = id => { id = String(id || ''); return read().links.find(x => x.id === id) || CHAN.get(id) || null; };
const pubCh = c => ({ id: c.id, name: c.name, group: c.group, cc: c.cc, q: c.q, geo: c.geo, logo: c.logo ? 1 : 0, yt: c.yt ? 1 : 0, part: c.part ? 1 : 0 });
async function open(id) {
  if (!net.on()) return { error: OFF };
  const x = find(id); if (!x) return { error: 'That link is not known.' };
  if (String(id).startsWith('ch-')) return { kind: 'video', name: x.name };
  const got = await fetchText(x.url, 20e6); if (got.error) return { error: got.error };
  if (!isChannelList(got.text)) {
    if (x.list) { const d = read(), y = d.links.find(z => z.id === x.id); if (y) { delete y.list; y.name = guessName(y.url); write(d); } }
    return { kind: 'video', name: x.name };
  }
  const list = parseChannels(got.text);
  if (CHAN.size > 150000) CHAN.clear(); list.forEach(c => CHAN.set(c.id, c));
  const d = read(), y = d.links.find(z => z.id === x.id); if (y) { y.list = 1; y.count = list.length; if (!y.mine && !y.src) y.name = listName(y.url); delete y.auto; write(d); }
  return { kind: 'list', name: y ? y.name : x.name, channels: list.map(pubCh), links: status().links };
}

/* every channel in the free index whose name has all the words typed (best first: whole-word starts, then shorter names) */
function findChannels(q) {
  const I = loadIndex(), words = clean(q).toLowerCase().split(' ').filter(w => w.length > 1).slice(0, 6); if (!words.length || !I.size) return { channels: [], index: I.size };
  const hits = [];
  for (const c of I.byUrl.values()) { const n = (c.name + ' ' + (c.group || '')).toLowerCase(); if (words.every(w => n.includes(w))) hits.push(c); }
  const score = c => (c.name.toLowerCase().startsWith(words[0]) ? 0 : 1) * 1000 + (c.geo ? 200 : 0) + c.name.length;
  const top = hits.sort((a, b) => score(a) - score(b)).slice(0, 120).map(c => { const ch = Object.assign({ id: 'ch-' + sha(c.url), yt: /youtube\.com|youtu\.be/i.test(c.url) ? 1 : 0 }, c); CHAN.set(ch.id, ch); return ch; });
  return { channels: top.map(pubCh), total: hits.length, index: I.size };
}
/* a YouTube channel's live address: the video it is showing now, for the YouTube player */
async function ytLive(id) {
  const c = find(id); if (!c || !/youtube\.com|youtu\.be/i.test(c.url || '')) return { error: 'That is not a YouTube channel.' };
  return require('./youtube').live(c.url);
}

/* ---------- logos ---------- */
/* the page may only show pictures from this PC, so a channel's logo is fetched here, kept in data/tv-logos, and only
   for logo addresses that came from a channel list or the index */
function logo(id, res) {
  const send = (code, body, type) => { res.writeHead(code, { 'Content-Type': type || 'text/plain', 'Cache-Control': code === 200 ? 'private, max-age=604800' : 'no-store' }); res.end(body); };
  const x = find(id), u = x && x.logo; if (!u || !/^https?:\/\//i.test(u)) return send(404, 'no logo');
  const key = sha(u), file = path.join(LOGOS, key);
  try { const b = fs.readFileSync(file), t = fs.readFileSync(file + '.t', 'utf8'); return send(200, b, t); } catch (e) { }
  if (!net.on()) return send(404, 'offline');
  (async () => {
    const go = async (url, depth) => {
      const ok = await net.safeUrl(url); if (ok.error || depth > 3) return send(404, 'refused');
      const rq = (ok.url.protocol === 'https:' ? https : http).get(ok.url, { headers: { 'user-agent': UA, accept: 'image/avif,image/webp,image/*;q=0.8' }, timeout: 12000 }, r => {
        if (r.statusCode >= 300 && r.statusCode < 400 && r.headers.location) { r.resume(); let n; try { n = new URL(r.headers.location, ok.url).href; } catch (e) { return send(404, 'bad'); } return go(n, depth + 1); }
        const type = String(r.headers['content-type'] || '').split(';')[0];
        if (r.statusCode !== 200 || !/^image\/(jpeg|png|webp|gif|avif|svg\+xml)$/.test(type)) { r.resume(); return send(404, 'not an image'); }
        const c = []; let n = 0;
        r.on('data', b => { n += b.length; if (n > 1.5e6) { rq.destroy(); return; } c.push(b); });
        r.on('end', () => { const b = Buffer.concat(c); send(200, b, type); try { fs.mkdirSync(LOGOS, { recursive: true }); fs.writeFileSync(file, b); fs.writeFileSync(file + '.t', type); prune(); } catch (e) { } });
        r.on('error', () => send(404, 'error'));
      });
      rq.on('timeout', () => { rq.destroy(); if (!res.headersSent) send(404, 'timeout'); });
      rq.on('error', () => { if (!res.headersSent) send(404, 'error'); });
    };
    go(u, 0);
  })();
}
function prune() { try { const f = fs.readdirSync(LOGOS).filter(n => !n.endsWith('.t')); if (f.length < 3000) return; f.map(n => ({ n, t: fs.statSync(path.join(LOGOS, n)).mtimeMs })).sort((a, b) => a.t - b.t).slice(0, 500).forEach(o => { try { fs.unlinkSync(path.join(LOGOS, o.n)); fs.unlinkSync(path.join(LOGOS, o.n + '.t')); } catch (e) { } }); } catch (e) { } }

/* ---------- playing ---------- */
function say(res, code, msg) { if (res.headersSent) { try { res.end(); } catch (e) { } return; } res.writeHead(code, { 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'no-store' }); res.end(msg); }
/* the gate ffmpeg's requests pass through: public addresses only */
let gate = null;
function guardProxy() {
  if (gate) return gate;
  gate = new Promise((resolve, reject) => {
    const allowed = async hostport => { const ok = await net.safeUrl('http://' + hostport + '/', { anyPort: true }); return !ok.error; };
    const px = http.createServer(async (req, res) => {
      let u; try { u = new URL(req.url); } catch (e) { res.writeHead(400); return res.end(); }
      if (u.protocol !== 'http:' || !(await allowed(u.host))) { res.writeHead(403); return res.end(); }
      const h = Object.assign({}, req.headers, { host: u.host }); delete h['proxy-connection'];
      const r = http.request({ host: u.hostname, port: u.port || 80, path: u.pathname + u.search, method: req.method, headers: h }, rr => { res.writeHead(rr.statusCode, rr.headers); rr.pipe(res); });
      r.on('error', () => { try { res.writeHead(502); } catch (e) { } res.end(); }); req.pipe(r);
    });
    px.on('connect', async (req, sock, head) => {
      sock.on('error', () => { });
      const m = /^([^:\[\]]+):(\d+)$/.exec(req.url || '');
      if (!m || !(await allowed(req.url))) { sock.end('HTTP/1.1 403 Forbidden\r\n\r\n'); return; }
      const up = tcp.connect(+m[2], m[1], () => { sock.write('HTTP/1.1 200 Connection Established\r\n\r\n'); if (head && head.length) up.write(head); up.pipe(sock); sock.pipe(up); });
      up.on('error', () => sock.destroy()); sock.on('close', () => up.destroy());
    });
    px.on('error', reject);
    px.listen(0, '127.0.0.1', () => { px.unref(); resolve(px.address().port); });
  });
  return gate;
}
let playing = null;                            // the one ffmpeg that is running (a new video stops the last)
const stopVideo = () => { if (playing) { try { playing.kill(); } catch (e) { } playing = null; } };
process.on('exit', stopVideo);
const videoArgs = (port, url, o) => ['-hide_banner', '-loglevel', 'error', '-http_proxy', 'http://127.0.0.1:' + port, '-protocol_whitelist', 'http,https,tcp,tls,crypto,httpproxy', '-user_agent', (o && o.ua) || UA]
  .concat(o && o.ref ? ['-referer', o.ref] : [])
  .concat(['-rw_timeout', '20000000', '-i', url, '-sn', '-dn', '-c:v', 'copy', '-c:a', 'aac', '-b:a', '160k', '-f', 'mp4', '-movflags', 'frag_keyframe+empty_moov+default_base_moof', 'pipe:1']);
async function video(id, req, res) {
  if (!net.on()) return say(res, 403, OFF);
  const x = find(id); if (!x) return say(res, 404, 'That channel is not known. Open its channel list again.');
  const ff = ffmpegPath(); if (!ff) return say(res, 501, 'Video needs ffmpeg, which is not installed. Run install-song-tools.ps1, or use Open in VLC.');
  const ok = await net.safeUrl(x.url, { anyPort: true }); if (ok.error) return say(res, 502, ok.error);
  let port; try { port = await guardProxy(); } catch (e) { return say(res, 500, 'The video gate could not start.'); }
  stopVideo();
  let child; try { child = cp.spawn(ff, videoArgs(port, ok.url.href, x), { windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'] }); } catch (e) { return say(res, 500, 'ffmpeg could not start.'); }
  playing = child; let err = '', sent = false;
  child.stderr.on('data', d => { if (err.length < 4000) err += d; });
  child.stdout.on('data', c => { if (!sent) { sent = true; res.writeHead(200, { 'Content-Type': 'video/mp4', 'Cache-Control': 'no-store', 'Accept-Ranges': 'none' }); } if (!res.write(c)) { child.stdout.pause(); res.once('drain', () => child.stdout.resume()); } });
  child.on('error', () => say(res, 500, 'ffmpeg could not start.'));
  child.on('close', () => {
    if (playing === child) playing = null;
    if (sent) return res.end();
    const e = err.toLowerCase();
    say(res, 502, /403|401|forbidden/.test(e) ? 'This channel refused the request. It may be private, expired or only shown in some countries.' : /404|not found/.test(e) ? 'This channel is no longer at that address.' : /timed out|timeout|connection|resolve|i\/o error/.test(e) ? 'This channel could not be reached.' : /invalid data|could not find codec|no streams|not supported/.test(e) ? 'This link is not a video Moundshroud can read. Try Open in VLC.' : 'This channel could not be played. Try Open in VLC.');
  });
  res.on('close', () => { try { child.kill(); } catch (e) { } });
}
module.exports = { sources, addSource, findChannels, ytLive, SOURCES, status, importVlc, add, remove, rename, names, open, video, logo, parseVlc, parseChannels, isChannelList, guessName, listName, splitName, videoArgs, pub, guardProxy, lookup, buildIndex };

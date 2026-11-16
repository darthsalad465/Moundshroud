// Internet access, off unless the user turns it on. Two things live here: a web search, and turning a web page into
// plain text the model can read. Both refuse to run when the switch in Settings is off, and both refuse to touch this
// PC's own network (localhost, 10.x, 192.168.x and the rest) so a page the assistant fetches can never reach back into
// the machine or the home router.
const http = require('http'), https = require('https'), dns = require('dns'), zlib = require('zlib');
const cloud = require('./cloud');

/* an ordinary browser's name: announcing 'Moundshroud' would make every request from this PC easy to pick out */
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:128.0) Gecko/20100101 Firefox/128.0';
const MAXPAGE = 400000;             // bytes to read before giving up on a page
const MAXTEXT = 20000;              // characters of text handed to the model

/* ---------- guard rails ---------- */
const PRIVATE = [
  /^127\./, /^10\./, /^192\.168\./, /^169\.254\./, /^0\./, /^100\.(6[4-9]|[7-9]\d|1[0-2]\d)\./,
  /^172\.(1[6-9]|2\d|3[01])\./, /^::1$/, /^f[cd][0-9a-f]{2}:/i, /^fe80:/i
];
function badHost(host) {
  const h = String(host || '').toLowerCase().replace(/\.$/, '');
  if (!h) return 'no host';
  if (h === 'localhost' || /\.local$/.test(h) || /\.internal$/.test(h) || h === 'metadata.google.internal') return 'this PC';
  if (PRIVATE.some(r => r.test(h))) return 'a private address';
  return null;
}
async function resolveCheck(host) {
  if (/^\d+\.\d+\.\d+\.\d+$/.test(host)) return null;
  try {
    const list = await dns.promises.lookup(host, { all: true });
    for (const a of list) if (PRIVATE.some(r => r.test(a.address))) return 'a private address';
  } catch (e) { return 'a host that cannot be looked up'; }
  return null;
}
/* returns a parsed URL, or a sentence saying why not */
/* opts.anyPort: radio stations sit on ports like 8000, so the Radio tab lifts the port rule (the own-network rule stays) */
async function safeUrl(raw, opts) {
  let u; try { u = new URL(String(raw || '').trim()); } catch (e) { return { error: 'That is not a web address.' }; }
  if (u.protocol !== 'http:' && u.protocol !== 'https:') return { error: 'Only http and https pages can be read.' };
  if (!(opts && opts.anyPort) && u.port && u.port !== '80' && u.port !== '443') return { error: 'Only the usual web ports (80 and 443) are allowed.' };
  const bad = badHost(u.hostname) || await resolveCheck(u.hostname);
  if (bad) return { error: 'That address is ' + bad + ', and Moundshroud will not fetch from your own network. Use the offline browser for that.' };
  return { url: u };
}

const on = () => cloud.cfg().web === true;
const off = { error: 'Internet access is switched off. Turn it on in Settings, AI & power, if you want Moundshroud to look things up online.' };

/* ---------- fetching ---------- */
/* Nearly every site compresses its pages. Without unwrapping that, the text came back as unreadable bytes, which read
   to the user as "the page could not be read". Reading the whole body and unwrapping it in one go is also the reliable
   path here: piping the response through a streaming gunzip left the stream open with no 'end' on this Node build. */
const RAWCAP = MAXPAGE * 8;          // compressed bytes read before giving up (about 3 MB of text)
function unwrap(enc, buf) {
  const e = String(enc || '').toLowerCase();
  try {
    if (e === 'gzip' || e === 'x-gzip') return zlib.gunzipSync(buf).toString('utf8');
    if (e === 'deflate') { try { return zlib.inflateSync(buf).toString('utf8'); } catch (e2) { return zlib.inflateRawSync(buf).toString('utf8'); } }
    if (e === 'br') return zlib.brotliDecompressSync(buf).toString('utf8');
    if (e === 'zstd' && typeof zlib.zstdDecompressSync === 'function') return zlib.zstdDecompressSync(buf).toString('utf8');
  } catch (e3) { /* an odd or truncated stream: fall back to what arrived */ }
  return buf.toString('utf8');
}
function get(url, depth, cb) {
  if (depth > 3) return cb({ error: 'Too many redirects.' }, null, '');
  const mod = url.protocol === 'https:' ? https : http;
  const req = mod.get(url, { headers: { 'user-agent': UA, accept: 'text/html,application/json;q=0.9,*/*;q=0.8', 'accept-encoding': 'gzip, deflate', 'accept-language': 'en' }, timeout: 15000 }, r => {
    if (r.statusCode >= 300 && r.statusCode < 400 && r.headers.location) {
      r.resume();
      let next; try { next = new URL(r.headers.location, url); } catch (e) { return cb({ error: 'Bad redirect.' }, null, ''); }
      const bad = badHost(next.hostname);
      if (bad) return cb({ error: 'That page redirects to ' + bad + '.' }, null, '');
      return get(next, depth + 1, cb);
    }
    if (r.statusCode !== 200) { r.resume(); return cb({ error: 'The page answered ' + r.statusCode + '.' }, null, ''); }
    const chunks = [], enc = String(r.headers['content-encoding'] || '').toLowerCase();
    let n = 0, cut = false, settled = false;
    const finish = body => { if (settled) return; settled = true; cb(null, r, body); };
    r.on('data', c => { n += c.length; if (n > RAWCAP) { cut = true; req.destroy(); return; } chunks.push(c); });
    r.on('end', () => { const body = unwrap(enc, Buffer.concat(chunks)); finish(body.length > MAXPAGE ? body.slice(0, MAXPAGE) : body); });
    r.on('close', () => { if (cut) finish(unwrap(enc, Buffer.concat(chunks)).slice(0, MAXPAGE)); });
    r.on('error', () => { if (!settled) { settled = true; cb({ error: 'The page could not be read.' }, null, ''); } });
  });
  req.on('error', e => cb({ error: 'Could not reach that site: ' + e.message }, null, ''));
  req.on('timeout', () => { req.destroy(); cb({ error: 'That site did not answer in time.' }, null, ''); });
}

/* ---------- page -> text ---------- */
const ENT = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ', '#39': "'", '#34': '"', '#8217': '’', '#8216': '‘', '#8220': '“', '#8221': '”', '#8212': '—', '#8211': '–' };
function text(html) {
  let s = String(html || '');
  s = s.replace(/<script[\s\S]*?<\/script>/gi, ' ').replace(/<style[\s\S]*?<\/style>/gi, ' ').replace(/<noscript[\s\S]*?<\/noscript>/gi, ' ')
    .replace(/<!--[\s\S]*?-->/g, ' ').replace(/<(nav|header|footer|aside|form|svg)[\s\S]*?<\/\1>/gi, ' ');
  s = s.replace(/<(br|\/p|\/div|\/li|\/h[1-6]|\/tr)[^>]*>/gi, '\n').replace(/<[^>]+>/g, ' ');
  s = s.replace(/&#?\w+;/g, m => { const k = m.slice(1, -1).toLowerCase(); return ENT[k] != null ? ENT[k] : (/^#\d+$/.test(k) ? String.fromCodePoint(Math.min(0x10ffff, +k.slice(1))) : ' '); });
  return s.replace(/[ \t\u00a0]+/g, ' ').replace(/\n{3,}/g, '\n\n').split('\n').map(l => l.trim()).filter((l, i, a) => l || (a[i - 1] && a[i - 1] !== '')).join('\n').trim();
}

/* ---------- search ---------- */
const strip = s => String(s || '').replace(/<[^>]+>/g, '').replace(/&amp;/g, '&').replace(/&#x27;|&#39;/g, "'").replace(/&quot;/g, '"').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/\s+/g, ' ').trim();

/* DuckDuckGo is the default engine: it is asked first, and the encyclopaedia only tops the list up when the web
   results are thin. DuckDuckGo's html endpoint returns plain results with no page scripts, which suits a local reader. */
const ENGINE = 'DuckDuckGo';
async function search(q, n) {
  if (!on()) return off;
  const query = String(q || '').trim(); if (!query) return { results: [], engine: ENGINE };
  const want = Math.min(10, Math.max(3, n || 6));
  let web = await ddg(query, want).catch(() => []);
  let wiki = [];
  if (web.length < want) wiki = await wikiSearch(query, want - web.length).catch(() => []);
  const results = web.concat(wiki).slice(0, want).map(r => ({ title: r.title, url: r.url, snippet: r.snippet, source: r.source }));
  return { query, results, providers: { web: web.length, wikipedia: wiki.length }, engine: ENGINE };
}

function wikiSearch(q, n) {
  return new Promise((resolve, reject) => {
    const url = new URL('https://en.wikipedia.org/w/api.php');
    url.searchParams.set('action', 'query'); url.searchParams.set('list', 'search'); url.searchParams.set('format', 'json');
    url.searchParams.set('srsearch', q); url.searchParams.set('srlimit', String(Math.min(n, 8))); url.searchParams.set('srprop', 'snippet');
    get(url, 0, (err, r, body) => {
      if (err) return reject(new Error(err.error));
      try {
        const j = JSON.parse(body), list = (j.query && j.query.search) || [];
        resolve(list.map(x => ({ title: x.title, url: 'https://en.wikipedia.org/wiki/' + encodeURIComponent(String(x.title).replace(/ /g, '_')), snippet: strip(x.snippet) + '…', source: 'Wikipedia' })));
      } catch (e) { resolve([]); }
    });
  });
}

function ddg(q, n) {
  return new Promise(resolve => {
    const body = 'q=' + encodeURIComponent(q);
    const req = https.request({ host: 'html.duckduckgo.com', path: '/html/', method: 'POST', timeout: 15000, headers: { 'user-agent': UA, 'content-type': 'application/x-www-form-urlencoded', 'content-length': Buffer.byteLength(body), 'accept-language': 'en' } }, r => {
      if (r.statusCode !== 200) { r.resume(); return resolve([]); }
      let b = ''; r.setEncoding('utf8'); r.on('data', c => { if (b.length < MAXPAGE) b += c; });
      r.on('end', () => {
        const out = [], re = /<a[^>]+class="[^"]*result__a[^"]*"[^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>([\s\S]*?)(?=<a[^>]+class="[^"]*result__a|<div class="nav-link|<\/body>)/gi;
        let m;
        while ((m = re.exec(b)) && out.length < n) {
          let href = m[1].replace(/&amp;/g, '&');
          const d = /[?&]uddg=([^&]+)/.exec(href); if (d) { try { href = decodeURIComponent(d[1]); } catch (e) { } }
          const snip = /class="[^"]*result__snippet[^"]*"[^>]*>([\s\S]*?)<\/a>/i.exec(m[3]);
          const title = strip(m[2]);
          if (!href || !title) continue;
          out.push({ title, url: href, snippet: snip ? strip(snip[1]).slice(0, 300) : '', source: ENGINE });
        }
        resolve(out);
      });
    });
    req.on('error', () => resolve([]));
    req.on('timeout', () => { req.destroy(); resolve([]); });
    req.end(body);
  });
}

/* ---------- page -> markdown (keep the article, drop the furniture) ---------- */
const ent = s => String(s || '').replace(/&#?\w+;/g, m => { const k = m.slice(1, -1).toLowerCase(); return ENT[k] != null ? ENT[k] : (/^#\d+$/.test(k) ? String.fromCodePoint(Math.min(0x10ffff, +k.slice(1))) : ' '); });
/* links, bold, italics and code survive as markdown; everything else becomes plain text */
function inline(s, base) {
  s = String(s || '').replace(/<a\s[^>]*href=["']([^"']*)["'][^>]*>([\s\S]*?)<\/a>/gi, (m, href, inner) => {
    const t = ent(inner.replace(/<[^>]+>/g, '')).replace(/\s+/g, ' ').trim(); if (!t) return '';
    let abs = href; try { abs = new URL(href, base || 'https://invalid.example/').href; } catch (e) { }
    return /^https?:/i.test(abs) ? '[' + t + '](' + abs + ')' : t;
  });
  s = s.replace(/<(strong|b)>([\s\S]*?)<\/\1>/gi, (m, t, i) => '**' + ent(i.replace(/<[^>]+>/g, '')) + '**')
    .replace(/<(em|i)>([\s\S]*?)<\/\1>/gi, (m, t, i) => '_' + ent(i.replace(/<[^>]+>/g, '')) + '_')
    .replace(/<code[^>]*>([\s\S]*?)<\/code>/gi, (m, c) => '`' + ent(c.replace(/<[^>]+>/g, '')).replace(/`/g, '') + '`');
  return ent(s.replace(/<[^>]+>/g, '')).replace(/[ \t\u00a0]+/g, ' ').trim();
}
function md(html, base) {
  let s = String(html || '')
    .replace(/<(script|style|noscript|svg|iframe|form|button|select|nav|header|footer|aside)[\s\S]*?<\/\1>/gi, ' ')
    .replace(/<!--[\s\S]*?-->/g, ' ');
  s = s.replace(/<pre[^>]*>([\s\S]*?)<\/pre>/gi, (m, c) => '\n\n```\n' + ent(c.replace(/<[^>]+>/g, '')) + '\n```\n\n');
  s = s.replace(/<tr[^>]*>([\s\S]*?)<\/tr>/gi, (m, row) => '\n| ' + [...row.matchAll(/<t[dh][^>]*>([\s\S]*?)<\/t[dh]>/gi)].map(c => inline(c[1], base).replace(/\|/g, '\\|')).join(' | ') + ' |');
  s = s.replace(/<h([1-6])[^>]*>([\s\S]*?)<\/h\1>/gi, (m, n, c) => '\n\n' + '#'.repeat(+n) + ' ' + inline(c, base) + '\n\n');
  s = s.replace(/<li[^>]*>([\s\S]*?)<\/li>/gi, (m, c) => '\n- ' + inline(c, base));
  s = s.replace(/<\/(p|div|section|article|main|li|tr|ul|ol|table|blockquote|dl|dd|dt)>/gi, '\n\n').replace(/<br[^>]*>/gi, '\n');
  s = inline(s, base);
  return s.replace(/[ \t]+/g, ' ').replace(/ ?\n ?/g, '\n').replace(/\n{3,}/g, '\n\n').trim();
}
/* the main block of a page: <article>, then <main>, then the biggest content-looking <div>, else the whole body */
function article(html, base) {
  const raw = String(html || ''), tit = strip((/<title[^>]*>([\s\S]*?)<\/title>/i.exec(raw) || [])[1] || '');
  const cands = [];
  for (const re of [/<article\b[\s\S]*?<\/article>/gi, /<main\b[\s\S]*?<\/main>/gi, /<div\b[^>]*(?:id|class)="[^"]*(?:content|article|post|entry|markdown|doc|body)[^"]*"[\s\S]*?<\/div>/gi]) {
    let m; while ((m = re.exec(raw)) && cands.length < 40) cands.push(m[0]);
  }
  const whole = text(raw).length, best = cands.map(c => ({ c, n: text(c).length })).sort((a, b) => b.n - a.n)[0];
  const body = best && best.n >= Math.max(400, whole * .2) ? best.c : raw;
  const out = md(body, base);
  return { title: tit || strip((/^#\s+(.+)$/m.exec(out) || [])[1] || ''), markdown: out };
}

/* ---------- crawling one site ---------- */
const sleep = ms => new Promise(r => setTimeout(r, ms));
const SITEMAP = /\/(sitemap|feed|rss|atom)([.\-_].*)?\.xml$/i;
const SKIP_EXT = /\.(jpe?g|png|gif|webp|svg|ico|css|js|zip|gz|tgz|tar|rar|7z|exe|msi|dmg|iso|mp3|mp4|m4a|wav|webm|pdf|docx?|xlsx?|pptx?|woff2?|ttf|eot|map)$/i;
function robots(u) {
  return new Promise(resolve => {
    const r = new URL('/robots.txt', u.origin);
    get(r, 0, (err, res, body) => {
      if (err) return resolve([]);
      const rules = []; let star = false;
      String(body).split(/\r?\n/).forEach(line => {
        const m = /^\s*([A-Za-z-]+)\s*:\s*(.*)$/.exec(line); if (!m) return;
        const k = m[1].toLowerCase(), v = m[2].trim();
        if (k === 'user-agent') star = v === '*';
        else if (star && (k === 'disallow' || k === 'allow') && v) rules.push({ allow: k === 'allow', p: v.replace(/\*$/, ''), any: v.includes('*') });
      });
      resolve(rules);
    });
  });
}
const blocked = (u, rules) => {
  const p = u.pathname + (u.search || ''); let hit = null;
  for (const r of rules) { const ok = r.any ? new RegExp('^' + r.p.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/\\\*/g, '.*')).test(p) : p.startsWith(r.p); if (ok) hit = r; }
  return !!(hit && !hit.allow);
};
function htmlOf(u) {
  return new Promise(resolve => {
    get(u, 0, (err, r, body) => {
      if (err) return resolve({ error: err.error });
      const type = String(r.headers['content-type'] || '');
      if (!/text\/html|application\/xhtml|text\/plain|application\/json|text\/markdown/i.test(type)) return resolve({ error: 'not a page' });
      resolve({ body, type, final: r });
    });
  });
}
/* read a site: the pages it links to from the starting page, same site only, slowly, obeying robots.txt */
async function crawl(raw, opts) {
  if (!on()) return off;
  opts = opts || {};
  const first = await safeUrl(raw); if (first.error) return { error: first.error };
  const host = first.url.hostname, max = Math.min(200, Math.max(1, +opts.pages || 25)), depthCap = Math.min(3, Math.max(0, opts.depth == null ? 2 : +opts.depth));
  const rules = await robots(first.url).catch(() => []);
  const q = [{ u: first.url, d: 0 }], seen = new Set([first.url.href.split('#')[0]]), pages = [], skipped = [];
  while (q.length && pages.length < max) {
    const { u, d } = q.shift();
    if (blocked(u, rules)) { skipped.push({ url: u.href, why: 'robots.txt asks not to' }); continue; }
    const r = await htmlOf(u);
    if (r.error) { skipped.push({ url: u.href, why: r.error }); continue; }
    const a = article(r.body, u.href);
    if (a.markdown.length > 60) pages.push({ url: u.href.split('#')[0], title: a.title || u.href, markdown: a.markdown });
    else skipped.push({ url: u.href, why: 'no readable text' });
    if (d < depthCap) {
      const re = /<a\s[^>]*href=["']([^"']+)["']/gi; let m;
      while ((m = re.exec(r.body)) && seen.size < max * 25) {
        let n; try { n = new URL(m[1], u); } catch (e) { continue; }
        const h = n.href.split('#')[0];
        if (n.hostname !== host || seen.has(h) || SKIP_EXT.test(n.pathname) || SITEMAP.test(n.pathname) || /\/(login|logout|signin|signup|register|cart|checkout|search|wp-admin|admin)(\/|$)/i.test(n.pathname)) continue;
        seen.add(h); q.push({ u: n, d: d + 1 });
      }
    }
    await sleep(Math.max(150, +opts.delay || 350));
  }
  return { start: first.url.href, host, pages, skipped: skipped.slice(0, 40), found: pages.length };
}

/* ---------- one page as text ---------- */
async function page(raw) {
  if (!on()) return off;
  const s = await safeUrl(raw);
  if (s.error) return { error: s.error };
  return new Promise(resolve => {
    get(s.url, 0, (err, r, body) => {
      if (err) return resolve({ error: err.error });
      const type = String(r.headers['content-type'] || '');
      if (!/text\/html|text\/plain|application\/json|application\/xml|text\/xml/i.test(type)) return resolve({ error: 'That link is a ' + (type.split(';')[0] || 'file') + ', not a page that can be read.' });
      const t = /json|xml/i.test(type) ? String(body).slice(0, MAXTEXT) : text(body);
      resolve({ url: String(s.url), title: (/<title[^>]*>([\s\S]*?)<\/title>/i.exec(String(body)) || [])[1] ? strip(/<title[^>]*>([\s\S]*?)<\/title>/i.exec(String(body))[1]) : String(s.url), text: t.slice(0, MAXTEXT), more: t.length > MAXTEXT });
    });
  });
}

/* the handful of results the chat is allowed to read in full: the top two, so a question stays quick */
async function lookup(q, n) {
  const r = await search(q, n);
  if (r.error) return r;
  const top = (r.results || []).slice(0, 2), pages = [];
  for (const hit of top) {
    const p = await page(hit.url).catch(() => null);
    if (p && !p.error && p.text) pages.push({ title: hit.title, url: hit.url, text: p.text.slice(0, 6000), where: p.title });
  }
  return { query: r.query, results: r.results, pages, providers: r.providers, engine: r.engine };
}

module.exports = { search, page, lookup, crawl, article, text, md, safeUrl, on, MAXTEXT, ENGINE };

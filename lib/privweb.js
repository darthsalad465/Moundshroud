// Private web: search with DuckDuckGo and read pages as clean text inside Moundshroud. This server fetches every page
// and picture itself, with no cookies kept, no scripts run, and no referrer sent, so sites cannot follow you around.
// Scripts, frames, tracking pixels and link-tracking tags are removed; the internet switch and the home-network guard
// (net.safeUrl) apply to every request, including redirects.
const http = require('http'), https = require('https'), zlib = require('zlib');
const net = require('./net');
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:128.0) Gecko/20100101 Firefox/128.0';
const PAGE_CAP = 6e6, IMG_CAP = 6e6;
const TRACKERS = /(google-analytics|googletagmanager|doubleclick|googlesyndication|adservice|facebook\.com\/tr|connect\.facebook|scorecardresearch|quantserve|hotjar|segment\.(io|com)|mixpanel|amplitude|criteo|taboola|outbrain|adnxs|pixel\.|\/pixel|\/beacon|bat\.bing|clarity\.ms|analytics\.|matomo|piwik|chartbeat|newrelic|nr-data|krxd|rubiconproject|pubmatic|openx|moatads|branch\.io|tiktok\.com\/i18n\/pixel|ads\.twitter|linkedin\.com\/px)/i;
const TRACK_PARAM = /^(utm_[a-z]+|fbclid|gclid|dclid|gbraid|wbraid|msclkid|mc_[a-z]+|igshid|yclid|_hsenc|_hsmi|ref_src|s_cid|oly_[a-z]+|vero_[a-z]+|spm|si)$/i;
const off = { error: 'Internet access is switched off. Turn it on in Settings, AI & power.' };

function cleanUrl(u) { try { const x = new URL(u); [...x.searchParams.keys()].forEach(k => { if (TRACK_PARAM.test(k)) x.searchParams.delete(k); }); return x.href; } catch (e) { return u; } }

/* fetch with no cookies and no referrer; every redirect target is checked again against the home-network guard */
function fetchUrl(raw, cap, accept, depth = 0) {
  return new Promise(async res => {
    const s = await net.safeUrl(raw); if (s.error) return res({ error: s.error });
    const u = s.url, mod = u.protocol === 'https:' ? https : http;
    const req = mod.get(u, { headers: { 'user-agent': UA, accept, 'accept-encoding': 'gzip, deflate', 'accept-language': 'en', dnt: '1', 'sec-gpc': '1' }, timeout: 15000 }, r => {
      if (r.statusCode >= 300 && r.statusCode < 400 && r.headers.location) { r.resume(); if (depth > 4) return res({ error: 'Too many redirects.' }); return fetchUrl(new URL(r.headers.location, u).href, cap, accept, depth + 1).then(res); }
      if (r.statusCode >= 400) { r.resume(); return res({ error: 'The site answered ' + r.statusCode + '.' }); }
      const chunks = []; let n = 0, cut = false;
      r.on('data', c => { n += c.length; if (n > cap) { cut = true; req.destroy(); return; } chunks.push(c); });
      const done = () => { let buf = Buffer.concat(chunks); const enc = String(r.headers['content-encoding'] || ''); try { if (/gzip/.test(enc)) buf = zlib.gunzipSync(buf); else if (/deflate/.test(enc)) buf = zlib.inflateSync(buf); else if (/br/.test(enc)) buf = zlib.brotliDecompressSync(buf); } catch (e) { } res({ ok: true, url: u.href, type: String(r.headers['content-type'] || ''), cookies: (r.headers['set-cookie'] || []).length, buf, cut }); };
      r.on('end', done); r.on('close', () => { if (cut) done(); });
    });
    req.on('error', e => res({ error: 'Could not reach it: ' + e.message }));
    req.on('timeout', () => { req.destroy(); res({ error: 'It did not answer in 15 seconds.' }); });
  });
}

async function search(q) {
  if (!net.on()) return off;
  const r = await net.search(String(q || '').slice(0, 300), 10);
  if (r.error) return r;
  return { query: r.query, results: (r.results || []).map(x => ({ title: x.title, url: cleanUrl(x.url), snippet: x.snippet, source: x.source })) };
}

async function read(raw) {
  if (!net.on()) return off;
  const f = await fetchUrl(String(raw || '').trim(), PAGE_CAP, 'text/html,application/xhtml+xml,text/plain;q=0.9,*/*;q=0.5');
  if (f.error) return f;
  if (!/html|xml|text\/plain/i.test(f.type)) return { error: 'That link is a ' + (f.type.split(';')[0] || 'file') + ', not a page.', url: f.url };
  let html = f.buf.toString('utf8');
  const removed = { scripts: (html.match(/<script\b/gi) || []).length, frames: (html.match(/<iframe\b/gi) || []).length, trackers: 0, cookies: f.cookies };
  /* pictures become markdown that loads through this server; tracking pixels and tracker hosts are dropped */
  html = html.replace(/<img\b[^>]*>/gi, tag => {
    const at = k => { const m = new RegExp('\\s' + k + '\\s*=\\s*["\']([^"\']*)["\']', 'i').exec(tag); return m ? m[1] : ''; };
    let src = at('data-src') || at('src') || (at('srcset').split(/\s+/)[0] || '');
    if (!src || /^data:/i.test(src)) return '';
    let abs; try { abs = new URL(src.replace(/&amp;/g, '&'), f.url).href; } catch (e) { return ''; }
    if (TRACKERS.test(abs) || (at('width') === '1' && at('height') === '1')) { removed.trackers++; return ''; }
    const alt = at('alt').replace(/[\[\]]/g, '').slice(0, 120);
    return '\n\n![' + alt + '](' + '/api/privweb/img?u=' + encodeURIComponent(abs) + ')\n\n';
  });
  removed.trackers += (f.buf.toString('utf8').match(/<script[^>]+src=["'][^"']*["']/gi) || []).filter(s => TRACKERS.test(s)).length;
  const a = net.article(html, f.url);
  let md = a.markdown.replace(/\]\((https?:\/\/[^)\s]+)\)/g, (m, u) => '](' + cleanUrl(u) + ')');
  const more = md.length > 300000; if (more) md = md.slice(0, 300000);
  return { ok: true, url: f.url, title: a.title || f.url, markdown: md, removed, more };
}

/* GET /api/privweb/img?u=...: a picture fetched by this server, so the site never sees your browser */
async function img(u, res) {
  if (!net.on()) { res.writeHead(403); return res.end(); }
  const f = await fetchUrl(String(u || ''), IMG_CAP, 'image/avif,image/webp,image/png,image/jpeg,image/gif,image/*;q=0.8');
  if (f.error || !/^image\//i.test(f.type) || /svg/i.test(f.type) || f.cut) { res.writeHead(404); return res.end(); }
  res.writeHead(200, { 'Content-Type': f.type.split(';')[0], 'Cache-Control': 'private, max-age=3600', 'X-Content-Type-Options': 'nosniff' });
  res.end(f.buf);
}
module.exports = { search, read, img, cleanUrl };

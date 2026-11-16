// API Explorer: reads the public-apis list (github.com/public-apis/public-apis, pulled by Tools > Repositories into
// data\refs\public-apis) and lets you try web APIs from inside Moundshroud. Requests go out only with the internet
// switch on, only to public addresses (never your own network), GET only, 2 MB at most.
const fs = require('fs'), path = require('path'), http = require('http'), https = require('https'), zlib = require('zlib');
const net = require('./net'), refs = require('./refs');
const SLUG = 'public-apis', README = path.join(refs.DIR, SLUG, 'README.md');
const CAP = 2e6;

/* ready-made calls to well-known APIs that need no key, so there is something to press straight away */
const EXAMPLES = [
  { name: 'Weather now (Open-Meteo)', url: 'https://api.open-meteo.com/v1/forecast?latitude=40.71&longitude=-74.01&current_weather=true' },
  { name: 'Trivia questions (Open Trivia DB)', url: 'https://opentdb.com/api.php?amount=3' },
  { name: 'A Bible verse (bible-api.com)', url: 'https://bible-api.com/john%203:16' },
  { name: 'Look up a word (Free Dictionary)', url: 'https://api.dictionaryapi.dev/api/v2/entries/en/serendipity' },
  { name: 'Books (Open Library)', url: 'https://openlibrary.org/search.json?q=the+hobbit&limit=3' },
  { name: 'Country facts (REST Countries)', url: 'https://restcountries.com/v3.1/name/japan' },
  { name: 'Random dog picture (Dog CEO)', url: 'https://dog.ceo/api/breeds/image/random' },
  { name: 'Cat fact (catfact.ninja)', url: 'https://catfact.ninja/fact' },
  { name: 'Guess age from a name (Agify)', url: 'https://api.agify.io/?name=michael' },
  { name: 'A clean joke (JokeAPI)', url: 'https://v2.jokeapi.dev/joke/Any?safe-mode' },
];

let cache = null, cacheAt = 0;
function parse() {
  let md; try { md = fs.readFileSync(README, 'utf8'); } catch (e) { return null; }
  const out = []; let cat = '', started = false;
  for (const line of md.split(/\r?\n/)) {
    if (/^##\s+Index\b/i.test(line)) { started = true; continue; }       // sponsor and MCP tables above the index have other columns
    if (!started) continue;
    const h = /^###\s+(.+?)\s*$/.exec(line); if (h) { cat = h[1].replace(/\[|\]|\(.*?\)/g, '').trim(); continue; }
    if (!cat || !line.startsWith('| [')) continue;
    const cells = line.split('|').slice(1, -1).map(s => s.trim()); if (cells.length !== 5) continue;
    const m = /\[([^\]]+)\]\(([^)]+)\)/.exec(cells[0]); if (!m) continue;
    const auth = cells[2].replace(/`/g, '').trim();
    out.push({ name: m[1], url: m[2], desc: cells[1], auth: /^no$/i.test(auth) ? '' : auth, https: /yes/i.test(cells[3]), cors: (cells[4] || '').toLowerCase(), category: cat });
  }
  return out;
}
function list() {
  const st = (refs.status().find(r => r.slug === SLUG) || {});
  let mt = 0; try { mt = fs.statSync(README).mtimeMs; } catch (e) { }
  if (!cache || mt !== cacheAt) { cache = parse(); cacheAt = mt; }
  const apis = cache || [];
  return { installed: !!st.installed, job: st.job || null, internet: net.on(), count: apis.length, categories: [...new Set(apis.map(a => a.category))], apis, examples: EXAMPLES };
}

function fetchOnce(u, depth) {
  return new Promise(res => {
    const mod = u.protocol === 'https:' ? https : http;
    const req = mod.get(u, { headers: { 'user-agent': 'Moundshroud API Explorer', accept: 'application/json,text/plain;q=0.9,*/*;q=0.5', 'accept-encoding': 'gzip, deflate' }, timeout: 15000 }, async r => {
      if (r.statusCode >= 300 && r.statusCode < 400 && r.headers.location) {
        r.resume(); if (depth > 3) return res({ error: 'Too many redirects.' });
        const s = await net.safeUrl(new URL(r.headers.location, u).href); if (s.error) return res({ error: 'It redirects somewhere not allowed: ' + s.error });
        return res(await fetchOnce(s.url, depth + 1));
      }
      const chunks = []; let n = 0, cut = false;
      r.on('data', c => { n += c.length; if (n > CAP) { cut = true; req.destroy(); return; } chunks.push(c); });
      const done = () => {
        let buf = Buffer.concat(chunks); const enc = String(r.headers['content-encoding'] || '').toLowerCase();
        try { if (enc.includes('gzip')) buf = zlib.gunzipSync(buf); else if (enc.includes('deflate')) buf = zlib.inflateSync(buf); } catch (e) { }
        let body = buf.toString('utf8'), json = false;
        try { body = JSON.stringify(JSON.parse(body), null, 2); json = true; } catch (e) { }
        res({ ok: true, status: r.statusCode, type: String(r.headers['content-type'] || ''), json, cut, body: body.slice(0, 400000) });
      };
      r.on('end', done); r.on('close', () => { if (cut) done(); });
    });
    req.on('error', e => res({ error: 'Could not reach it: ' + e.message }));
    req.on('timeout', () => { req.destroy(); res({ error: 'It did not answer in 15 seconds.' }); });
  });
}
async function call(raw) {
  if (!net.on()) return { error: 'Internet access is switched off. Turn it on in Settings, AI & power.' };
  const s = await net.safeUrl(raw); if (s.error) return { error: s.error };
  const t0 = Date.now(); const r = await fetchOnce(s.url, 0); if (r.ok) r.ms = Date.now() - t0; return r;
}
module.exports = { list, call, SLUG, EXAMPLES };

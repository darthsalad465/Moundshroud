// Free frontier AI, routed: one pool of free routes, tried in order until one answers.
// What this is honest about: free tiers are rate limited. So instead of one provider that stops working when its
// limit is hit, Moundshroud keeps a pool of them and moves to the next one by itself (a route that answered with
// 429 or an error rests for a while), and if every route is resting the local model on this PC answers instead.
// That is the closest thing to "unlimited" that exists without paying, and it never needs a key: OVHcloud's
// anonymous tier (2 requests/min) and Pollinations' public endpoint both answer with frontier-class models.
// Routes that need a free-tier key (Groq, Gemini, OpenRouter...) join the pool on their own when a key is saved
// in Settings › Online AI. Keys stay in lib/cloud.js / lib/freellm.js, encrypted by Windows.
const fs = require('fs'), path = require('path'), https = require('https'), http = require('http');
const ROOT = path.join(__dirname, '..');
const FILE = path.join(ROOT, 'data', 'freeroutes.json');
const TIMEOUT = 60000;          // one route may think this long before the next one is tried
const STREAM_TIMEOUT = 180000;

/* The keyless routes: no signup, no key, nothing stored. Order is quality first. */
/* ordered by what measured fastest and most reliable: GPT-OSS answers in about a second, Qwen 3.5 397B is the
   strongest but thinks first, so it waits behind the quick one */
const KEYLESS = [
  { id: 'ovh-gptoss', name: 'GPT-OSS 120B', url: 'https://oai.endpoints.kepler.ai.cloud.ovh.net/v1/chat/completions', model: 'gpt-oss-120b', note: 'OVHcloud anonymous tier · about 2 requests a minute' },
  { id: 'polli-openai', name: 'OpenAI (Pollinations)', url: 'https://text.pollinations.ai/openai', model: 'openai', note: 'public free endpoint · shared by everyone' },
  { id: 'ovh-qwen', name: 'Qwen 3.5 397B', url: 'https://oai.endpoints.kepler.ai.cloud.ovh.net/v1/chat/completions', model: 'qwen3.5-397b-a17b', note: 'OVHcloud anonymous tier · strongest, thinks before it answers' },
  { id: 'ovh-llama', name: 'Llama 3.3 70B', url: 'https://oai.endpoints.kepler.ai.cloud.ovh.net/v1/chat/completions', model: 'meta-llama-3_3-70b-instruct', note: 'OVHcloud anonymous tier · often busy', timeout: 25000 },
  { id: 'polli-fast', name: 'OpenAI fast (Pollinations)', url: 'https://text.pollinations.ai/openai', model: 'openai-fast', note: 'public free endpoint · one reply every 45 seconds' }
];

/* ---------- usage, kept on disk so the panel can show it ---------- */
const today = () => new Date().toISOString().slice(0, 10);
function readStats() {
  try { const j = JSON.parse(fs.readFileSync(FILE, 'utf8')); return j && typeof j === 'object' ? j : {}; } catch (e) { return {}; }
}
function writeStats(o) { try { fs.mkdirSync(path.dirname(FILE), { recursive: true }); fs.writeFileSync(FILE, JSON.stringify(o, null, 1)); } catch (e) { } }
function countUse(id) {
  const s = readStats();
  if (s.day !== today()) { s.day = today(); s.counts = {}; }
  s.counts = s.counts || {}; s.counts[id] = (s.counts[id] || 0) + 1;
  s.total = (s.total || 0) + 1;
  writeStats(s);
}

/* ---------- how each route is doing right now (in memory; a restart clears it) ---------- */
const health = {};                       // id -> { until, lastError, lastOk, ok, fails }
const now = () => Date.now();
function h(id) { return health[id] || (health[id] = { until: 0, lastError: '', lastOk: 0, ok: null, fails: 0 }); }
function rest(id, ms, why) {
  const r = h(id); r.until = now() + ms; r.lastError = why; r.fails++; r.ok = false;
}
function good(id) { const r = h(id); r.until = 0; r.lastOk = now(); r.lastError = ''; r.ok = true; r.fails = 0; }
const cooling = id => h(id).until > now();

/* what a failed answer means: whether another route is worth trying, and how long this one should rest */
function classify(status, text) {
  if (status === 200) return { ok: true };
  const body = String(text || '');
  if (status === 401 || status === 403) return { retry: true, rest: 30 * 60000, why: 'that route refused the request (' + status + ')' };
  if (status === 429) return { retry: true, rest: 20000, why: 'its free limit is used up for the moment (429)' };
  if (status === 402) return { retry: true, rest: 45000, why: 'its free limit is used up (one reply every 45 seconds)' };
  if (status === 404 || (status === 400 && /model|unavailable|not found/i.test(body))) return { retry: true, rest: 5 * 60000, why: 'that model is not being served right now' };
  if (status === 400) return { retry: true, rest: 60000, why: 'it rejected the request (400)' };
  if (status >= 500 || status === 0) return { retry: true, rest: 120000, why: 'the route is having trouble (' + (status || 'no answer') + ')' };
  return { retry: true, rest: 60000, why: 'it answered ' + status };
}
const canRetry = c => !!c.retry;

/* ---------- the pool ---------- */
/* keyed free providers join in front of the keyless ones when a key has been saved for them */
function keyedRoutes() {
  const out = [];
  let cloud = null;
  try { cloud = require('./cloud'); } catch (e) { return out; }
  let FL = null; try { FL = require('./freellm'); } catch (e) { return out; }
  let saved = [];
  try { saved = cloud.cfg().providerKeys || []; } catch (e) { }
  for (const pid of saved) {
    let models = [];
    try { models = (cloud.FREE_FALLBACK[pid] || []).slice(0, 2); } catch (e) { }
    for (const m of models) {
      out.push({
        id: pid + '/' + m.id, name: m.name, provider: pid, keyed: true, model: m.id,
        note: 'your saved free key · ' + pid,
        call: (body, cb) => FL.call(pid, body, cb)
      });
    }
  }
  return out;
}

/* every route in the order to try now: awake ones first (keyed free tiers, then the keyless pool), then the
   ones that are resting, soonest-awake first, so a long conversation never gets stuck on one limit */
let POOL_OVERRIDE = null, SEND_OVERRIDE = null;      /* used by the tests, never by the app */
function pool() {
  if (POOL_OVERRIDE) { const l = POOL_OVERRIDE(); const awake = l.filter(r => !cooling(r.id)); return awake.concat(l.filter(r => cooling(r.id)).sort((a, b) => h(a.id).until - h(b.id).until)); }
  const keyless = KEYLESS.map(r => Object.assign({ keyed: false }, r));
  const all = keyedRoutes().concat(keyless);
  const awake = all.filter(r => !cooling(r.id));
  const asleep = all.filter(r => cooling(r.id)).sort((a, b) => h(a.id).until - h(b.id).until);
  return awake.concat(asleep);
}

/* ---------- the request ---------- */
/* an OpenAI-shaped body that every one of these endpoints accepts: the system prompt stays in messages (some of
   them ignore a top-level `system`), and reasoning models get room to think before they answer */
function shape(body) {
  const src = Array.isArray(body.messages) ? body.messages : [];
  const msgs = [];
  for (const m of src) {
    if (!m) continue;
    /* a tool's output travels back as its own message, tied to the call that asked for it */
    if (m.role === 'tool') { msgs.push({ role: 'tool', tool_call_id: m.tool_call_id || '', content: String(m.content == null ? '' : m.content) }); continue; }
    const role = m.role === 'assistant' ? 'assistant' : m.role === 'system' ? 'system' : 'user';
    const text = String(m.content == null ? '' : m.content);
    const calls = Array.isArray(m.tool_calls) ? m.tool_calls : null;
    if (!text && !(calls && calls.length)) continue;
    if (role === 'assistant' && calls && calls.length) {   /* what the model asked for last turn, kept intact */
      msgs.push({
        role: 'assistant', content: text,
        tool_calls: calls.map((c, i) => ({ id: (c && c.id) || 'call_' + i, type: 'function', function: { name: (c.function || c).name, arguments: typeof (c.function || c).arguments === 'string' ? (c.function || c).arguments : JSON.stringify((c.function || c).arguments || {}) } }))
      });
      continue;
    }
    const last = msgs[msgs.length - 1];
    if (last && last.role === role && !last.tool_calls) last.content += '\n\n' + text;
    else msgs.push({ role, content: text });
  }
  if (!msgs.length) msgs.push({ role: 'user', content: '(no message)' });
  const o = body.options || {};
  /* reasoning models think before they answer, and the thinking is charged to the same budget: without room here
     they spend every token thinking and send no answer at all */
  const want = +o.num_predict || +body.max_tokens || 2048;
  /* a whole game or a long file needs room; 32,000 tokens is what the free endpoints accept (checked against
     OVHcloud's GPT-OSS and Qwen), so a big request is no longer cut down to 8,192 */
  const CEIL = 32000;
  const out = { messages: msgs, max_tokens: Math.max(2048, Math.min(CEIL, want * 2)), temperature: o.temperature != null ? +o.temperature : (body.temperature != null ? +body.temperature : 0.7) };
  if (body.format === 'json') out.messages = msgs.concat([{ role: 'system', content: 'Answer with a single JSON object and nothing else: no explanation, no markdown fence.' }]);
  if (Array.isArray(body.tools) && body.tools.length) out.tools = body.tools;
  return out;
}

/* a reasoning model can spend every token thinking; its thinking is still an answer worth showing */
function messageOf(json) {
  const ch = json && json.choices && json.choices[0];
  const m = ch && ch.message;
  if (!m) return null;
  let content = m.content == null ? '' : m.content;
  if (Array.isArray(content)) content = content.map(p => (p && p.text) || '').join('');
  content = String(content || '').trim();
  /* the working-out (m.reasoning) is never shown as if it were the answer: a route that only thought and never
     answered counts as a failure, and the pool moves on */
  if (!content && typeof m.refusal === 'string') content = m.refusal;
  const calls = [];
  if (Array.isArray(m.tool_calls)) for (const t of m.tool_calls) {
    const fn = t && (t.function || t);
    if (!fn || !fn.name) continue;
    let args = fn.arguments;
    if (typeof args === 'string') { try { args = JSON.parse(args); } catch (e) { args = { input: args }; } }
    calls.push({ function: { name: fn.name, arguments: args || {} } });
  }
  if (!content && !calls.length) return null;
  return { content, tool_calls: calls.length ? calls : undefined };
}

/* one request to one route */
function askRoute(route, req, cb, tmo) {
  const payload = JSON.stringify(Object.assign({ model: route.model }, req));
  const u = new URL(route.url || ('https://' + route.host + '/v1/chat/completions'));
  const r = https.request({
    hostname: u.hostname, path: u.pathname, method: 'POST', timeout: tmo || route.timeout || TIMEOUT,
    headers: { 'content-type': 'application/json', 'content-length': Buffer.byteLength(payload), 'accept': 'application/json' }
  }, s => {
    let b = ''; s.setEncoding('utf8'); s.on('data', d => b += d);
    s.on('end', () => {
      if (s.statusCode !== 200) { const c = classify(s.statusCode, b); return cb({ status: s.statusCode, error: c.why, klass: c }); }
      let j = null; try { j = JSON.parse(b); } catch (e) { return cb({ status: 200, error: 'its answer could not be read', klass: { retry: true, rest: 60000 } }); }
      const m = messageOf(j);
      if (!m) return cb({ status: 200, error: 'it sent nothing back', klass: { retry: true, rest: 30000 } });
      cb(null, { model: j.model || route.model, message: { role: 'assistant', content: m.content, tool_calls: m.tool_calls }, done: true, done_reason: 'stop', usage: j.usage });
    });
  });
  r.on('error', e => cb({ status: 0, error: 'could not be reached (' + e.message + ')', klass: { retry: true, rest: 120000 } }));
  r.on('timeout', () => { r.destroy(); cb({ status: 0, error: 'did not answer in time', klass: { retry: true, rest: 120000 } }); });
  r.end(payload);
}

function sendRoute(route, req, cb) {
  if (SEND_OVERRIDE) return SEND_OVERRIDE(route, req, cb);  // the tests answer instead of the network
  if (route.call) return route.call(req, cb);              // a keyed provider through lib/freellm.js
  askRoute(route, req, cb);
}

/* Try each route in turn. cb(err, result, route) with result already in the local engine's shape. */
function once(body, cb) {
  const req = shape(body);
  const list = pool();
  let i = 0;
  const tried = [];
  const step = () => {
    if (i >= list.length) return cb({ error: tried.length ? 'No free route answered (' + tried.slice(0, 3).join('; ') + ').' : 'There is no free route to try.', tried });
    const route = list[i++];
    if (cooling(route.id)) { tried.push(route.name + ': resting'); return step(); }
    sendRoute(route, req, (err, res) => {
      if (err || (res && res.error)) {
        const klass = (err && err.klass) || { retry: true, rest: 60000 };
        const why = (err && err.error) || (res && res.error) || 'it failed';
        rest(route.id, klass.rest || 60000, why);
        tried.push(route.name + ': ' + why);
        return klass.retry === false ? cb({ error: why, tried }) : step();
      }
      good(route.id); countUse(route.id);
      if (res.message) res.free = { route: route.id, routeName: route.name, keyless: !route.keyed };
      cb(null, res, route);
    });
  };
  step();
}

/* Streaming: the answer is only committed to once a route answers 200, so a rate-limited route costs nothing and
   the next one is tried silently. Returns a promise: true when it handled the request, false when every route
   was unavailable (the caller then uses the local model). */
function stream(body, res) {
  const req = shape(body);
  req.stream = true;
  const list = pool();
  let i = 0, wrote = false;
  const tried = [];
  const emit = o => { try { res.write(JSON.stringify(o) + '\n'); } catch (e) { } };

  return new Promise(resolve => {
    const step = () => {
      if (i >= list.length) {
        if (!wrote) return resolve(false);
        emit({ error: 'The free route stopped and no other one was free. Try again in a moment.' });
        try { res.end(); } catch (e) { }
        return resolve(true);
      }
      const route = list[i++];
      if (cooling(route.id)) { tried.push(route.name + ': resting'); return step(); }
      if (route.call) {                       /* keyed: lib/freellm.js writes the whole answer itself */
        if (!wrote) { res.writeHead(200, { 'Content-Type': 'application/x-ndjson; charset=utf-8', 'Cache-Control': 'no-store' }); wrote = true; }
        good(route.id); countUse(route.id);
        let sent = false;
        const fake = { write: s => { sent = true; try { res.write(s); } catch (e) { } }, writeHead: () => { }, end: () => { try { res.end(); } catch (e) { } }, on: () => { } };
        route.call(req, (err, r) => {
          if (err || (r && r.error)) { emit({ error: (err && err.error) || r.error }); try { res.end(); } catch (e) { } }
          else if (!sent) { emit({ model: r.model, message: r.message, done: false }); emit({ model: r.model, message: { role: 'assistant', content: '' }, done: true }); try { res.end(); } catch (e) { } }
        });
        return resolve(true);
      }
      const payload = JSON.stringify(Object.assign({ model: route.model }, req));
      const u = new URL(route.url);
      const preq = https.request({
        hostname: u.hostname, path: u.pathname, method: 'POST', timeout: STREAM_TIMEOUT,
        headers: { 'content-type': 'application/json', 'content-length': Buffer.byteLength(payload), 'accept': 'text/event-stream' }
      }, s => {
        if (s.statusCode !== 200) {
          let b = ''; s.on('data', d => b += d);
          s.on('end', () => {
            const c = classify(s.statusCode, b);
            rest(route.id, c.rest || 60000, c.why);
            tried.push(route.name + ': ' + c.why);
            if (wrote) { emit({ error: c.why }); try { res.end(); } catch (e) { } return resolve(true); }
            step();
          });
          return;
        }
        good(route.id);
        if (!wrote) { res.writeHead(200, { 'Content-Type': 'application/x-ndjson; charset=utf-8', 'Cache-Control': 'no-store' }); wrote = true; }
        let buf = '', text = '', emitted = false, counted = false;
        s.setEncoding('utf8');
        s.on('data', chunk => {
          buf += chunk; let k;
          while ((k = buf.indexOf('\n')) >= 0) {
            const line = buf.slice(0, k).trim(); buf = buf.slice(k + 1);
            if (!line.startsWith('data:')) continue;
            const raw = line.slice(5).trim();
            if (raw === '[DONE]') { emit({ model: route.model, message: { role: 'assistant', content: '' }, done: true, done_reason: 'stop', free: { route: route.id, routeName: route.name } }); try { res.end(); } catch (e) { } return resolve(true); }
            let j = null; try { j = JSON.parse(raw); } catch (e) { continue; }
            const d = j.choices && j.choices[0] && j.choices[0].delta;
            const piece = (d && (typeof d.content === 'string' ? d.content : '')) || '';
            if (piece) {
              text += piece; emitted = true;
              if (!counted) { counted = true; countUse(route.id); }   /* once per answer, not once per token */
              emit({ model: j.model || route.model, message: { role: 'assistant', content: piece }, done: false, free: { route: route.id, routeName: route.name } }); }
          }
        });
        s.on('end', () => {
          if (!text && !emitted) {        /* it thought and never answered: nothing was shown, so try the next route */
            rest(route.id, 60000, 'it sent no answer');
            tried.push(route.name + ': sent no answer');
            return step();
          }
          emit({ model: route.model, message: { role: 'assistant', content: '' }, done: true, done_reason: 'stop' });
          try { res.end(); } catch (e) { }
          resolve(true);
        });
      });
      preq.on('error', e => { rest(route.id, 120000, e.message); tried.push(route.name + ': ' + e.message); if (wrote) { emit({ error: e.message }); try { res.end(); } catch (e) { } return resolve(true); } step(); });
      preq.on('timeout', () => { preq.destroy(); rest(route.id, 120000, 'no answer'); tried.push(route.name + ': no answer'); if (wrote) { emit({ error: route.name + ' did not answer in time.' }); try { res.end(); } catch (e) { } return resolve(true); } step(); });
      preq.end(payload);
    };
    step();
  });
}

/* ---------- what the settings panel shows ---------- */
function status() {
  const stats = readStats();
  const counts = stats.day === today() ? (stats.counts || {}) : {};
  const live = pool();
  return {
    routes: live.map(r => {
      const x = h(r.id);
      return {
        id: r.id, name: r.name, model: r.model, note: r.note || '', keyed: !!r.keyed,
        awake: !cooling(r.id), restMs: Math.max(0, x.until - now()),
        lastError: x.lastError, ok: x.ok, usedToday: counts[r.id] || 0
      };
    }),
    usedToday: Object.values(counts).reduce((a, b) => a + b, 0),
    total: stats.total || 0,
    keyless: KEYLESS.length,
    limit: 'Free routes are rate limited (about 2 requests a minute on OVHcloud, and Pollinations is shared by everyone). When every route is resting the model on this PC answers instead, so nothing stops working.'
  };
}

/* the Settings "Test the routes" button: ask each route something tiny, and say which ones answered */
async function testAll() {
  /* every route is asked at the same time, and none of them may hold the answer up for long */
  const out = await Promise.all(KEYLESS.map(r => {
    if (cooling(r.id)) return Promise.resolve({ id: r.id, name: r.name, ok: false, error: 'resting for ' + Math.ceil((h(r.id).until - now()) / 1000) + 's: ' + h(r.id).lastError });
    return new Promise(resolve => askRoute(r, shape({ messages: [{ role: 'user', content: 'Reply with the single word OK.' }], options: { num_predict: 512 } }), (err, x) => resolve(err || x), 20000))
      .then(res => {
        if (res && res.error) { rest(r.id, (res.klass && res.klass.rest) || 60000, res.error); return { id: r.id, name: r.name, ok: false, error: res.error }; }
        good(r.id); return { id: r.id, name: r.name, ok: true, reply: String((res.message && res.message.content) || '').slice(0, 40), model: res.model };
      });
  }));
  return { routes: out, ok: out.filter(x => x.ok).length };
}

module.exports = { KEYLESS, pool, once, stream, status, testAll, classify, messageOf, shape, health, _routes: { keyedRoutes },
  _test: { setPool: f => { POOL_OVERRIDE = f; }, setSend: f => { SEND_OVERRIDE = f; }, reset: () => { POOL_OVERRIDE = null; SEND_OVERRIDE = null; }, rest, good, health } };

// Online AI: Claude (the Anthropic API), used through the user's own API key.
// The point of this file is that NOTHING else in the app has to change: it speaks the same shape as the local Ollama
// endpoint, so every caller in the app (chat, the buddy, quizzes, documents, the chess coach) can use Claude by name.
// The key is kept in data/cloud.json encrypted by Windows for this Windows user (DPAPI), is never sent to the browser,
// and is never written to any log.
// Off by default: with no key saved the app is exactly as offline as it was.
const fs = require('fs'), path = require('path'), https = require('https');
const WS = require('./winsecret');
const ROOT = path.join(__dirname, '..'), FILE = path.join(ROOT, 'data', 'cloud.json');
const HOST = 'api.anthropic.com';
const VERSION = '2026-10-21';                       // the anthropic-version header; see docs.anthropic.com/en/api/versioning
const MAXTOK = 8192;

/* the model ids to offer before a key is saved and the live list has been read */
const FALLBACK = [
  { id: 'claude-sonnet-5-5', name: 'Claude Sonnet 5.5', note: 'the everyday choice' },
  { id: 'claude-opus-5-5', name: 'Claude Opus 5.5', note: 'most capable, costs the most' },
  { id: 'claude-haiku-5-5', name: 'Claude Haiku 5.5', note: 'fastest and cheapest' },
  { id: 'claude-sonnet-5', name: 'Claude Sonnet 5', note: '' },
  { id: 'claude-haiku-4-5', name: 'Claude Haiku 4.5', note: '' }
];

const read = () => { try { const j = JSON.parse(fs.readFileSync(FILE, 'utf8')); return j && typeof j === 'object' ? j : {}; } catch (e) { return {}; } };
const write = o => { try { fs.mkdirSync(path.dirname(FILE), { recursive: true }); fs.writeFileSync(FILE, JSON.stringify(o, null, 1)); } catch (e) { } };
/* the key itself never sits on disk in plain text: Windows encrypts it for this Windows user. Once unlocked it is kept
   in memory only. A key saved by an older version (plain text) is encrypted the first time Moundshroud starts. */
let KEY = null, keyErr = '';
const ready = (async () => {
  const c = read();
  if (c.key) { KEY = String(c.key).trim(); try { const blob = await WS.protect(KEY); const n = read(); delete n.key; n.keyBlob = blob; n.tail = KEY.slice(-4); write(n); } catch (e) { } return; }
  if (c.keyBlob) { try { KEY = await WS.unprotect(c.keyBlob); } catch (e) { KEY = ''; keyErr = 'Windows could not unlock the saved Anthropic key (was the backup restored on another PC?). Paste the key again.'; } return; }
  KEY = '';
})();
const cfg = () => { const c = read(); return { key: KEY || '', model: String(c.model || '').trim(), web: !!c.web, local: String(c.local || ''), saved: !!(c.keyBlob || c.key), tail: c.tail || (KEY ? KEY.slice(-4) : '') }; };
/* what an Anthropic key looks like: sk-ant-api…, about 100 characters (admin keys cannot make requests) */
const keyProblem = k => !k ? '' : /^sk-ant-admin/.test(k) ? 'That is an Anthropic Admin key, which cannot talk to Claude. Make a normal API key in the Claude Console (console.anthropic.com › API keys).' : !/^sk-ant-/.test(k) || k.length < 60 ? 'That is not an Anthropic API key. Those start with “sk-ant-” and are about 100 characters long. Make one in the Claude Console (console.anthropic.com › API keys). A Claude.ai Pro or Max subscription does not include API access: the API is a separate, pay-as-you-go account.' : '';

function set(part) {
  part = part || {}; const c = read();
  if (typeof part.key === 'string') {
    KEY = part.key.trim(); keyErr = ''; cache = { at: 0, list: null };
    delete c.key; delete c.keyBlob; delete c.tail;
    if (KEY) { c.tail = KEY.slice(-4); const k = KEY; WS.protect(k).then(blob => { if (KEY !== k) return; const n = read(); delete n.key; n.keyBlob = blob; n.tail = k.slice(-4); write(n); }).catch(() => { keyErr = 'Windows could not encrypt the key, so it was not saved. It works until Moundshroud closes.'; }); }
  }
  for (const k of ['model', 'web', 'local']) if (part[k] !== undefined) c[k] = part[k];
  c.at = new Date().toISOString().slice(0, 19); write(c);
  return status();
}

/* what the page is allowed to know: never the key itself */
function status() {
  const c = cfg(), problem = keyErr || keyProblem(c.key);
  return {
    on: !!c.key && !problem, saved: c.saved || !!c.key, provider: c.key ? 'anthropic' : 'local', model: c.model || (c.key ? FALLBACK[0].id : ''),
    web: c.web, tail: c.tail, problem, encrypted: !!read().keyBlob, models: models(), fallback: FALLBACK
  };
}

/* GET /v1/models - the live list for this key, cached for ten minutes, with the built-in list as a fallback */
let cache = { at: 0, list: null };
function models() { const c = cfg(); if (!c.key) return FALLBACK; if (cache.list && Date.now() - cache.at < 600000) return cache.list; return cache.list || FALLBACK; }
function refreshModels() {
  return new Promise(resolve => {
    const c = cfg(); if (!c.key || keyProblem(c.key)) return resolve({ models: FALLBACK, live: false, error: keyProblem(c.key) || undefined });
    const req = https.request({ host: HOST, path: '/v1/models?limit=40', method: 'GET', headers: headers(c.key), timeout: 12000 }, r => {
      let b = ''; r.on('data', d => b += d); r.on('end', () => {
        try {
          const j = JSON.parse(b);
          if (!Array.isArray(j.data)) return resolve({ models: models(), live: false, error: errText(r.statusCode, j) });
          const list = j.data.filter(m => m && m.id).map(m => ({ id: m.id, name: prettify(m.id), note: '' }));
          if (list.length) { cache = { at: Date.now(), list }; write(Object.assign(read(), {})); }
          resolve({ models: list.length ? list : FALLBACK, live: list.length > 0 });
        } catch (e) { resolve({ models: models(), live: false, error: 'Could not read the model list.' }); }
      });
    });
    req.on('error', e => resolve({ models: models(), live: false, error: 'Could not reach Anthropic: ' + e.message }));
    req.on('timeout', () => { req.destroy(); resolve({ models: models(), live: false, error: 'Anthropic did not answer in time.' }); });
    req.end();
  });
}
const prettify = id => String(id).replace(/^claude-/, 'Claude ').replace(/-/g, ' ').replace(/\b(\d+) (\d+)\b/, '$1.$2').replace(/\b\w/g, ch => ch.toUpperCase());

const headers = (key, beta) => Object.assign({ 'content-type': 'application/json', 'anthropic-version': VERSION, 'x-api-key': key }, beta ? { 'anthropic-beta': beta } : {});
/* when Claude's safety checks decline a request, Anthropic can answer it with another Claude model instead (server-side
   fallback). Haiku has no fallback, and older models do not take the parameter. */
const FALLS = /^claude-(opus-5-5|opus-5|sonnet-5-5|fable-5-1|fable-5)$/;
/* turn an Anthropic error into a sentence worth showing a person */
function errText(code, j) {
  const t = (j && j.error && j.error.type) || '', m = (j && j.error && j.error.message) || '';
  if (code === 401 || t === 'authentication_error') return 'That API key was not accepted. Check it was copied in full, and that it is an Anthropic key (they start with sk-ant-).';
  if (code === 403) return 'That key is not allowed to use this model.';
  if (code === 429 || t === 'rate_limit_error') return 'Anthropic is rate limiting this key, or its spending limit has been reached. Wait a moment or check the limit in your Anthropic account.';
  if (code === 400 || t === 'invalid_request_error') return 'Anthropic rejected the request' + (m ? ': ' + m : '.');
  if (code === 529) return 'Anthropic is busy (overloaded). Try again in a moment.';
  if (code >= 500) return 'Anthropic had a server problem (' + code + '). Try again in a moment.';
  return m || ('Anthropic returned ' + code + '.');
}

/* ---------- the request ---------- */
/* the app's messages (Ollama shape) become an Anthropic request: system out of the way, images as image blocks */
function shape(body) {
  const msgs = Array.isArray(body.messages) ? body.messages : [];
  const system = msgs.filter(m => m.role === 'system').map(m => String(m.content || '')).join('\n\n');
  const out = [];
  for (const m of msgs) {
    if (!m || m.role === 'system') continue;
    const parts = [];
    if (m.images && m.images.length) for (const d of m.images) {
      const img = toImage(d); if (img) parts.push(img);
    }
    if (m.content != null && String(m.content).length) parts.push({ type: 'text', text: String(m.content) });
    if (!parts.length) continue;
    const role = m.role === 'assistant' ? 'assistant' : 'user';
    const content = parts.length === 1 && parts[0].type === 'text' ? parts[0].text : parts;
    const last = out[out.length - 1];
    if (last && last.role === role) last.content = [{ type: 'text', text: typeof last.content === 'string' ? last.content : JSON.stringify(last.content) }].concat(parts);   // Anthropic is happiest with alternating turns
    else out.push({ role, content });
  }
  if (!out.length) out.push({ role: 'user', content: '(no message)' });
  const o = body.options || {};
  const req = {
    model: String(body.model || cfg().model || FALLBACK[0].id),
    max_tokens: Math.min(MAXTOK, Math.max(64, +o.num_predict || +body.max_tokens || 4096)),
    messages: out
  };
  if (system) req.system = system;
  if (body.format === 'json') req.system = (req.system ? req.system + '\n\n' : '') + 'Answer with a single JSON object and nothing else: no explanation, no markdown fence.';
  /* temperature, top_p and top_k are not sent: on API version 2026-10-21 any of them makes Anthropic reject the request
     (that was why Claude never answered). The app's own temperature settings only apply to the models on this PC. */
  if (FALLS.test(req.model)) req.fallbacks = 'default';
  if (body.stream) req.stream = true;
  return req;
}
function toImage(d) {
  const s = String(d || '');
  const m = /^data:(image\/(png|jpeg|jpg|gif|webp));base64,(.+)$/i.exec(s);
  if (!m) return null;
  return { type: 'image', source: { type: 'base64', media_type: m[1].toLowerCase(), data: m[2] } };
}

async function call(req, body, cb) {
  await ready; const c = cfg(), problem = keyErr || keyProblem(c.key);
  if (!c.key) return cb({ status: 0, error: 'No Anthropic API key is saved. Add one in Settings, AI & power.' });
  if (problem) return cb({ status: 0, error: problem });
  const payload = JSON.stringify(req);
  const r = https.request({ host: HOST, path: '/v1/messages', method: 'POST', headers: Object.assign(headers(c.key, req.fallbacks ? 'server-side-fallback-2026-07-01' : ''), { 'Content-Length': Buffer.byteLength(payload) }), timeout: 180000 }, res => cb(null, res));
  r.on('error', e => cb({ status: 0, error: 'Could not reach Anthropic: ' + e.message + '. Check this PC has internet access.' }));
  r.on('timeout', () => { r.destroy(); cb({ status: 0, error: 'Anthropic did not answer in time.' }); });
  r.end(payload);
}

/* stream: the app reads newline-delimited JSON, one object per update, exactly like the local engine.
   Callers use message.content / message.thinking / error, so that is what is emitted. */
function streamTo(body, res) {
  const req = shape(body);
  res.writeHead(200, { 'Content-Type': 'application/x-ndjson; charset=utf-8', 'Cache-Control': 'no-store' });
  const emit = o => { try { res.write(JSON.stringify(o) + '\n'); } catch (e) { } };
  call(req, body, (err, r) => {
    if (err) { emit({ error: err.error }); return res.end(); }
    if (r.statusCode !== 200) {
      let b = ''; r.on('data', d => b += d);
      r.on('end', () => { let j = null; try { j = JSON.parse(b); } catch (e) { } emit({ error: errText(r.statusCode, j) }); res.end(); });
      return;
    }
    let buf = '', model = req.model;
    r.setEncoding('utf8');
    r.on('data', chunk => {
      buf += chunk; let i;
      while ((i = buf.indexOf('\n')) >= 0) {
        const line = buf.slice(0, i).trim(); buf = buf.slice(i + 1);
        if (!line.startsWith('data:')) continue;
        let j; try { j = JSON.parse(line.slice(5).trim()); } catch (e) { continue; }
        if (j.type === 'content_block_delta' && j.delta && j.delta.type === 'text_delta' && j.delta.text) emit({ model, message: { role: 'assistant', content: j.delta.text }, done: false });
        else if (j.type === 'message_start' && j.message && j.message.model) model = j.message.model;           // a fallback model may answer instead
        else if (j.type === 'message_delta' && j.delta && j.delta.stop_reason === 'refusal') emit({ model, message: { role: 'assistant', content: '\n\n_' + refusalText(j.delta.stop_details) + '_' }, done: false });
        else if (j.type === 'message_delta' && j.usage) emit({ model, done: false, usage: { output_tokens: j.usage.output_tokens || 0 } });
        else if (j.type === 'error') { emit({ error: (j.error && j.error.message) || 'Anthropic returned an error.' }); }
      }
    });
    r.on('end', () => { emit({ model, message: { role: 'assistant', content: '' }, done: true, done_reason: 'stop' }); res.end(); });
    r.on('error', () => { emit({ error: 'The connection to Anthropic ended early.' }); res.end(); });
  });
  res.on('close', () => { });
}

/* not streaming: one JSON object, in the same shape the local engine returns */
function once(body, cb) {
  const req = shape(body);
  call(req, body, (err, r) => {
    if (err) return cb({ error: err.error });
    let b = ''; r.setEncoding('utf8'); r.on('data', d => b += d);
    r.on('end', () => {
      let j = null; try { j = JSON.parse(b); } catch (e) { }
      if (r.statusCode !== 200) return cb({ error: errText(r.statusCode, j) });
      if (j && j.stop_reason === 'refusal') return cb({ error: refusalText(j.stop_details) });
      if (!j || !Array.isArray(j.content)) return cb({ error: 'Anthropic sent something unexpected.' });
      const text = j.content.filter(x => x && x.type === 'text').map(x => x.text).join('');
      cb({ model: j.model || req.model, done: true, done_reason: j.stop_reason || 'stop', message: { role: 'assistant', content: text } });
    });
    r.on('error', () => cb({ error: 'The connection to Anthropic ended early.' }));
  });
}

const refusalText = d => 'Claude declined to answer this' + (d && d.category ? ' (Anthropic’s ' + String(d.category).replace(/_/g, ' ') + ' safety check)' : '') + '. Try rephrasing it, or ask a model on this PC.';

/* a tiny live check for the Settings button */
function test() {
  return ready.then(() => new Promise(resolve => {
    const c = cfg(), problem = keyErr || keyProblem(c.key); if (!c.key) return resolve({ ok: false, error: 'No key is saved yet.' }); if (problem) return resolve({ ok: false, error: problem });
    once({ model: c.model || FALLBACK[0].id, messages: [{ role: 'user', content: 'Reply with the single word OK.' }], options: { num_predict: 16 } }, r => {
      if (r.error) return resolve({ ok: false, error: r.error });
      resolve({ ok: true, reply: String(r.message.content || '').trim().slice(0, 40), model: r.model });
    });
  }));
}

/* when a request needs the app's tools (pressing buttons in Moundshroud) it goes to the local model instead:
   Anthropic tool schemas are a different shape, and an action that silently does nothing would be worse. */
function isCloud(model) { return /^claude-/i.test(String(model || '')); }

module.exports = { ready, keyProblem, cfg, set, status, models, refreshModels, streamTo, once, test, isCloud, shape, FALLBACK, FILE };

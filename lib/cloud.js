// Online AI: Claude (the Anthropic API) and Free LLM APIs (Groq, OpenRouter, NVIDIA NIM, Google Gemini, etc.).
// The point of this file is that NOTHING else in the app has to change: it speaks the same shape as the local Ollama
// endpoint, so every caller in the app (chat, the buddy, quizzes, documents, the chess coach) can use any provider by name.
// Keys are kept in data/cloud.json encrypted by Windows for this Windows user (DPAPI), never sent to the browser, never logged.
// Off by default: with no key saved the app is exactly as offline as it was.
// Requests go through the Respan Gateway on this PC when it is installed (lib/gateway.js); the gateway speaks the same
// Anthropic Messages API, so the request below is unchanged and only the address differs.
// Free LLM providers use OpenAI Chat Completions format directly (no gateway needed).
const fs = require('fs'), path = require('path'), https = require('https'), http = require('http');
const WS = require('./winsecret');
const GW = require('./gateway');
const FL = require('./freellm');
const ROOT = path.join(__dirname, '..'), FILE = path.join(ROOT, 'data', 'cloud.json');
const HOST = 'api.anthropic.com';
const VERSION = '2026-10-21';
const MAXTOK = 8192;

/* the model ids to offer before a key is saved and the live list has been read */
const FALLBACK = [
  { id: 'claude-sonnet-5-5', name: 'Claude Sonnet 5.5', note: 'the everyday choice' },
  { id: 'claude-opus-5-5', name: 'Claude Opus 5.5', note: 'most capable, costs the most' },
  { id: 'claude-haiku-5-5', name: 'Claude Haiku 5.5', note: 'fastest and cheapest' },
  { id: 'claude-sonnet-5', name: 'Claude Sonnet 5', note: '' },
  { id: 'claude-haiku-4-5', name: 'Claude Haiku 4.5', note: '' }
];

/* Free LLM provider fallbacks (model IDs that work with each provider) */
const FREE_FALLBACK = {
  'groq': [{ id: 'llama-3.3-70b-versatile', name: 'Llama 3.3 70B', note: 'fast, 30 RPM' }, { id: 'qwen/qwen3.8-27b', name: 'Qwen 3.8 27B', note: 'reasoning, 30 RPM' }],
  'nvidia-nim': [{ id: 'z-ai/glm-5.3-flash', name: 'GLM 5.3 Flash', note: '1M ctx, 40 RPM' }, { id: 'moonshotai/kimi-k2.6', name: 'Kimi K2.6', note: '262K ctx, 40 RPM' }],
  'google-gemini': [{ id: 'gemini-3.8-flash', name: 'Gemini 3.8 Flash', note: '1M ctx, multimodal' }, { id: 'gemini-3.6-flash', name: 'Gemini 3.6 Flash', note: '1M ctx, multimodal' }],
  'openrouter': [{ id: 'stealth/crouton-alpha', name: 'Crouton Alpha', note: '1M ctx, free' }, { id: 'nvidia/nemotron-3-ultra-550b-a55b:free', name: 'Nemotron 3 Ultra', note: '1M ctx, free' }],
  'kilo-code': [{ id: 'nvidia/nemotron-3-ultra-550b-a55b:free', name: 'Nemotron 3 Ultra', note: 'coding optimized' }, { id: 'cohere/north-mini-code:free', name: 'North Mini Code', note: 'coding optimized' }],
  'mistral-ai': [{ id: 'open-mistral-7b', name: 'Mistral 7B', note: '32K ctx' }, { id: 'open-mixtral-8x7b', name: 'Mixtral 8x7B', note: '32K ctx' }],
  'cohere': [{ id: 'command-a-218b', name: 'Command A+', note: '128K ctx' }, { id: 'command-a-111b', name: 'Command A', note: '256K ctx' }],
  'cloudflare-workers-ai': [{ id: '@cf/meta/llama-3.3-70b-instruct-fp8-fast', name: 'Llama 3.3 70B', note: 'edge inference' }],
  'modelscope': [{ id: 'MiniMax/MiniMax-M1-80k', name: 'MiniMax M1', note: '80K ctx' }],
  'ovhcloud-ai-endpoints': [{ id: 'qwen3.5-397b-a17b', name: 'Qwen 3.5 397B', note: 'EU hosted' }],
  'ollama-cloud': [{ id: 'gpt-oss:120b', name: 'GPT-OSS 120B', note: '128K ctx' }],
  'glhf-chat': [{ id: 'meta-llama/Meta-Llama-3.1-70B-Instruct', name: 'Llama 3.1 70B', note: 'unlimited free' }],
  'chutes-ai': [{ id: 'deepseek-ai/DeepSeek-R1', name: 'DeepSeek R1', note: 'reasoning' }],
  'llm7-io': [{ id: 'gpt-oss-20b', name: 'GPT-OSS 20B', note: '60 RPM' }],
  'z-ai-zhipu-ai': [{ id: 'glm-4.5-air', name: 'GLM 4.5 Air', note: '131K ctx' }],
  'gonka-broker': [{ id: 'minimaxai-minimax-m2-7', name: 'MiniMax M2.7', note: '200K ctx' }],
  'agnes-ai': [{ id: 'agnes-2.5-flash', name: 'Agnes 2.5 Flash', note: '256K ctx' }],
  'aion-labs': [{ id: 'aion-labs-aion-2.0', name: 'Aion 2.0', note: '128K ctx' }],
  'siliconflow': [{ id: 'tencent-hunyuan-mt-7b', name: 'Hunyuan MT 7B', note: '1K RPM' }],
  'grok-(xai)': [{ id: 'grok-2', name: 'Grok 2', note: '$25/mo free credits' }],
  'opencode': [{ id: 'nemotron-3.5-lightning-free', name: 'Nemotron 3.5 Lightning', note: '262K ctx' }]
};

const read = () => { try { const j = JSON.parse(fs.readFileSync(FILE, 'utf8')); return j && typeof j === 'object' ? j : {}; } catch (e) { return {}; } };
const write = o => { try { fs.mkdirSync(path.dirname(FILE), { recursive: true }); fs.writeFileSync(FILE, JSON.stringify(o, null, 1)); } catch (e) { } };

/* Provider configs: each provider has its own encrypted key blob */
let ANTHROPIC_KEY = null, anthroErr = '';
const PROVIDER_KEYS = {}, providerErrs = {};
const ready = (async () => {
  const c = read();
  /* Anthropic key (legacy single-key format) */
  if (c.key) { ANTHROPIC_KEY = String(c.key).trim(); try { const blob = await WS.protect(ANTHROPIC_KEY); const n = read(); delete n.key; n.keyBlob = blob; n.tail = ANTHROPIC_KEY.slice(-4); write(n); } catch (e) { } }
  else if (c.keyBlob) { try { ANTHROPIC_KEY = await WS.unprotect(c.keyBlob); } catch (e) { ANTHROPIC_KEY = ''; anthroErr = 'Windows could not unlock the saved Anthropic key.'; } }
  /* Per-provider keys */
  if (c.providers) {
    for (const [pid, pdata] of Object.entries(c.providers)) {
      if (pdata.key) { PROVIDER_KEYS[pid] = String(pdata.key).trim(); try { const blob = await WS.protect(PROVIDER_KEYS[pid]); const n = read(); n.providers = n.providers || {}; n.providers[pid] = n.providers[pid] || {}; delete n.providers[pid].key; n.providers[pid].keyBlob = blob; n.providers[pid].tail = PROVIDER_KEYS[pid].slice(-4); write(n); } catch (e) { } }
      else if (pdata.keyBlob) { try { PROVIDER_KEYS[pid] = await WS.unprotect(pdata.keyBlob); } catch (e) { PROVIDER_KEYS[pid] = ''; providerErrs[pid] = 'Could not unlock key.'; } }
    }
  }
})();
const cfg = () => { const c = read(); return { provider: String(c.provider || 'anthropic'), model: String(c.model || '').trim(), web: !!c.web, local: String(c.local || ''), saved: !!(c.keyBlob || c.key || (c.providers && Object.keys(c.providers).length)), tail: c.tail || (ANTHROPIC_KEY ? ANTHROPIC_KEY.slice(-4) : ''), providerKeys: Object.keys(c.providers || {}) }; };
/* what an Anthropic key looks like: sk-ant-api…, about 100 characters (admin keys cannot make requests) */
const keyProblem = k => !k ? '' : /^sk-ant-admin/.test(k) ? 'That is an Anthropic Admin key, which cannot talk to Claude. Make a normal API key in the Claude Console (console.anthropic.com › API keys).' : !/^sk-ant-/.test(k) || k.length < 60 ? 'That is not an Anthropic API key. Those start with "sk-ant-" and are about 100 characters long. Make one in the Claude Console (console.anthropic.com › API keys). A Claude.ai Pro or Max subscription does not include API access: the API is a separate, pay-as-you-go account.' : '';

function getProviderKey(pid) { return PROVIDER_KEYS[pid] || ''; }
function getProviderErr(pid) { return providerErrs[pid] || ''; }

function set(part) {
  part = part || {}; const c = read();
  /* Anthropic key (legacy) */
  if (typeof part.key === 'string') {
    ANTHROPIC_KEY = part.key.trim(); anthroErr = ''; cache = { at: 0, list: null };
    delete c.key; delete c.keyBlob; delete c.tail;
    if (ANTHROPIC_KEY) { c.tail = ANTHROPIC_KEY.slice(-4); const k = ANTHROPIC_KEY; WS.protect(k).then(blob => { if (ANTHROPIC_KEY !== k) return; const n = read(); delete n.key; n.keyBlob = blob; n.tail = k.slice(-4); write(n); }).catch(() => { anthroErr = 'Windows could not encrypt the key, so it was not saved. It works until Moundshroud closes.'; }); }
  }
  /* Per-provider keys */
  if (part.providerKey) {
    const { provider, key } = part.providerKey;
    if (provider && typeof key === 'string') {
      PROVIDER_KEYS[provider] = key.trim(); providerErrs[provider] = '';
      c.providers = c.providers || {}; c.providers[provider] = c.providers[provider] || {};
      delete c.providers[provider].key; delete c.providers[provider].keyBlob; delete c.providers[provider].tail;
      if (key) { c.providers[provider].tail = key.slice(-4); const k = key; WS.protect(k).then(blob => { if (PROVIDER_KEYS[provider] !== k) return; const n = read(); n.providers = n.providers || {}; n.providers[provider] = n.providers[provider] || {}; delete n.providers[provider].key; n.providers[provider].keyBlob = blob; n.providers[provider].tail = k.slice(-4); write(n); }).catch(() => { providerErrs[provider] = 'Windows could not encrypt the key.'; }); }
    }
  }
  if (typeof part.provider === 'string') c.provider = part.provider;
  for (const k of ['model', 'web', 'local']) if (part[k] !== undefined) c[k] = part[k];
  c.at = new Date().toISOString().slice(0, 19); write(c);
  return statusSync();
}

/* Synchronous status for set() return */
function statusSync() {
  const c = cfg();
  const provider = c.provider || 'anthropic';
  let problem = '', modelsList = [], fallbackList = FALLBACK, on = false;
  
  if (provider === 'anthropic') {
    problem = anthroErr || keyProblem(ANTHROPIC_KEY);
    on = !!ANTHROPIC_KEY && !problem;
    modelsList = models();
    fallbackList = FALLBACK;
  } else {
    const pkey = getProviderKey(provider);
    const perr = getProviderErr(provider);
    problem = perr || (!pkey ? 'No API key saved for this provider.' : '');
    on = !!pkey && !problem;
    modelsList = FREE_FALLBACK[provider] || [];
    fallbackList = FREE_FALLBACK[provider] || [];
  }

  return {
    on,
    saved: c.saved,
    provider,
    model: c.model || (on ? (fallbackList[0]?.id || '') : ''),
    web: c.web,
    tail: provider === 'anthropic' ? (c.tail || (ANTHROPIC_KEY ? ANTHROPIC_KEY.slice(-4) : '')) : (getProviderKey(provider) ? getProviderKey(provider).slice(-4) : ''),
    problem,
    encrypted: !!read().keyBlob || Object.values(read().providers || {}).some(p => p.keyBlob),
    models: modelsList,
    fallback: fallbackList,
    gateway: GW.address() ? 'on' : 'off',
    gatewayError: gwErr,
    providers: []  // async, not included in sync version
  };
}

/* what the page is allowed to know: never the key itself */
async function status() {
  const sync = statusSync();
  const providersList = await FL.list().catch(() => []);
  return { ...sync, providers: providersList };
}

/* GET /v1/models - the live list for Anthropic key, cached for ten minutes */
let cache = { at: 0, list: null };
function models() { const c = cfg(); if (!ANTHROPIC_KEY) return FALLBACK; if (cache.list && Date.now() - cache.at < 600000) return cache.list; return cache.list || FALLBACK; }
function refreshModels() {
  return new Promise(resolve => {
    if (!ANTHROPIC_KEY || keyProblem(ANTHROPIC_KEY)) return resolve({ models: FALLBACK, live: false, error: keyProblem(ANTHROPIC_KEY) || undefined });
    const req = https.request({ host: HOST, path: '/v1/models?limit=40', method: 'GET', headers: headers(ANTHROPIC_KEY), timeout: 12000 }, r => {
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

/* ---------- where a request goes ---------- */
let gwErr = '';
const direct = key => ({ host: HOST, port: 443, secure: true, path: '/v1/messages', key, beta: true });
async function address(key) {
  if (GW.available()) { try { await GW.start(key); gwErr = ''; } catch (e) { gwErr = String((e && e.message) || e); } }
  const u = GW.address();
  if (u) { try { const p = new URL(u); return { host: p.hostname, port: +p.port || 80, secure: false, path: '/v1/messages', key: 'unused', beta: true }; } catch (e) { } }
  return direct(key);
}
/* when Claude's safety checks decline a request, Anthropic can answer it with another Claude model instead (server-side fallback) */
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
    if (last && last.role === role) last.content = [{ type: 'text', text: typeof last.content === 'string' ? last.content : JSON.stringify(last.content) }].concat(parts);
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

/* `key` is only given by the tests, which cannot read the key the user saved (it is encrypted by Windows) */
async function call(req, body, cb, key) {
  await ready; const c = cfg();
  const k = key === undefined ? ANTHROPIC_KEY : key, problem = (key === undefined ? anthroErr : '') || keyProblem(k);
  if (!k) return cb({ status: 0, error: 'No Anthropic API key is saved. Add one in Settings, AI & power.' });
  if (problem) return cb({ status: 0, error: problem });
  send(req, await address(k), (err, res) => {
    if (!err || !GW.available()) return cb(err, res);
    send(req, direct(k), cb);
  });
}

/* one HTTPS request to Anthropic, or an HTTP one to the gateway on this PC */
function send(req, t, cb) {
  const payload = JSON.stringify(req);
  const r = (t.secure ? https : http).request({ host: t.host, port: t.port, path: t.path, method: 'POST', headers: Object.assign(headers(t.key, t.beta && req.fallbacks ? 'server-side-fallback-2026-07-01' : ''), { 'Content-Length': Buffer.byteLength(payload) }), timeout: 180000 }, res => cb(null, res));
  r.on('error', e => cb({ status: 0, error: t.secure ? 'Could not reach Anthropic: ' + e.message + '. Check this PC has internet access.' : 'Could not reach the Respan Gateway on this PC: ' + e.message + '.' }));
  r.on('timeout', () => { r.destroy(); cb({ status: 0, error: (t.secure ? 'Anthropic' : 'The Respan Gateway') + ' did not answer in time.' }); });
  r.end(payload);
}

/* stream: the app reads newline-delimited JSON, one object per update, exactly like the local engine.
   Callers use message.content / message.thinking / error, so that is what is emitted. */
function streamTo(body, res, key) {
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
        else if (j.type === 'message_start' && j.message && j.message.model) model = j.message.model;
        else if (j.type === 'message_delta' && j.delta && j.delta.stop_reason === 'refusal') emit({ model, message: { role: 'assistant', content: '\n\n_' + refusalText(j.delta.stop_details) + '_' }, done: false });
        else if (j.type === 'message_delta' && j.usage) emit({ model, done: false, usage: { output_tokens: j.usage.output_tokens || 0 } });
        else if (j.type === 'error') { emit({ error: (j.error && j.error.message) || 'Anthropic returned an error.' }); }
      }
    });
    r.on('end', () => { emit({ model, message: { role: 'assistant', content: '' }, done: true, done_reason: 'stop' }); res.end(); });
    r.on('error', () => { emit({ error: 'The connection to Anthropic ended early.' }); res.end(); });
  }, key);
  res.on('close', () => { });
}

/* not streaming: one JSON object, in the same shape the local engine returns */
function once(body, cb, key) {
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
  }, key);
}

/* Free LLM provider calls */
async function callFree(providerId, body, cb) {
  return FL.call(providerId, body, cb);
}
async function streamFree(providerId, body, res) {
  return FL.stream(providerId, body, res);
}

/* Get free LLM providers list (async) */
async function getProviders() {
  return FL.list();
}

/* Test a free LLM provider */
async function testFree(providerId, model) {
  await FL.loadKeys();
  const key = FL.getKey(providerId);
  if (!key) return { ok: false, error: 'No API key for ' + providerId };
  return new Promise(resolve => {
    FL.call(providerId, { model: model || (FREE_FALLBACK[providerId]?.[0]?.id || ''), messages: [{ role: 'user', content: 'Reply with the single word OK.' }], options: { num_predict: 16 } }, r => {
      if (r.error) return resolve({ ok: false, error: r.error });
      resolve({ ok: true, reply: String(r.message?.content || '').trim().slice(0, 40), model: r.model });
    });
  });
}

const refusalText = d => 'Claude declined to answer this' + (d && d.category ? ' (Anthropic\'s ' + String(d.category).replace(/_/g, ' ') + ' safety check)' : '') + '. Try rephrasing it, or ask a model on this PC.';

/* a tiny live check for the Settings button */
function test() {
  return ready.then(() => new Promise(resolve => {
    const c = cfg();
    if (c.provider === 'anthropic') {
      const problem = anthroErr || keyProblem(ANTHROPIC_KEY); if (!ANTHROPIC_KEY) return resolve({ ok: false, error: 'No key is saved yet.' }); if (problem) return resolve({ ok: false, error: problem });
      once({ model: c.model || FALLBACK[0].id, messages: [{ role: 'user', content: 'Reply with the single word OK.' }], options: { num_predict: 16 } }, r => {
        if (r.error) return resolve({ ok: false, error: r.error });
        resolve({ ok: true, reply: String(r.message.content || '').trim().slice(0, 40), model: r.model });
      });
    } else {
      const pkey = getProviderKey(c.provider); if (!pkey) return resolve({ ok: false, error: 'No API key for ' + c.provider });
      FL.call(c.provider, { model: c.model || (FREE_FALLBACK[c.provider]?.[0]?.id || ''), messages: [{ role: 'user', content: 'Reply with the single word OK.' }], options: { num_predict: 16 } }, r => {
        if (r.error) return resolve({ ok: false, error: r.error });
        resolve({ ok: true, reply: String(r.message?.content || '').trim().slice(0, 40), model: r.model });
      });
    }
  }));
}

/* when a request needs the app's tools (pressing buttons in Moundshroud) it goes to the local model instead */
function isCloud(model) { return /^claude-/i.test(String(model || '')); }
/* Only a model that belongs to the chosen free provider goes to that provider. Any other name (a model on this PC,
   say) is left to Ollama: without this test every request was sent to the provider, and a model it does not serve
   came back as no answer at all instead of the local model's reply. */
function isFreeProvider(model) {
  const c = cfg(); if (c.provider === 'anthropic' || c.provider === 'local') return false;
  const m = String(model == null ? '' : model);
  if (m.includes('/')) return true;            /* providers name their models "vendor/model"; a model on this PC never does */
  return (statusSync().models || []).some(x => x.id === m);
}
function isNoKeyProvider(model) {
  const c = cfg(); if (FL.NO_KEY_PROVIDERS[c.provider] === undefined) return false;
  const m = String(model == null ? '' : model);
  if (m.includes('/')) return true;
  return (statusSync().models || []).some(x => x.id === m);
}

/* No API key required providers */
function getNoKeyProviders() { return FL.getNoKeyProviders(); }
async function testNoKey(providerId, model) {
  return new Promise(resolve => FL.testNoKey(providerId, model, resolve));
}
async function callNoKey(providerId, body, cb) {
  const provider = FL.NO_KEY_PROVIDERS[providerId];
  if (!provider) return cb({ error: 'Unknown no-key provider: ' + providerId });
  const req = FL.shape(body, provider);
  const url = provider.baseUrl.replace(/\/v1$/, '') + '/chat/completions';
  const payload = JSON.stringify(req);
  const mod = url.startsWith('https') ? https : http;
  const parsed = new URL(url);
  const headers = { 'content-type': 'application/json', 'content-length': Buffer.byteLength(payload) };
  const requestOptions = { hostname: parsed.hostname, port: parsed.port || (parsed.protocol === 'https:' ? 443 : 80), path: parsed.pathname + parsed.search, method: 'POST', headers, timeout: 30000 };
  if (provider.relaxSsl) requestOptions.rejectUnauthorized = false;
  const r = mod.request(requestOptions, res => {
    let b = ''; res.on('data', c => b += c); res.on('end', () => {
      if (res.statusCode !== 200) {
        let msg = 'Provider returned ' + res.statusCode;
        try { const j = JSON.parse(b); msg = j.error?.message || msg; } catch (e) { }
        if (res.statusCode === 526) msg += ' (SSL certificate issue - provider may be temporarily unavailable)';
        return cb({ error: msg });
      }
      try {
        const j = JSON.parse(b);
        if (!j.choices?.[0]?.message) return cb({ error: 'Unexpected response format' });
        cb(null, { model: j.model || req.model, done: true, done_reason: j.choices[0].finish_reason || 'stop', message: { role: 'assistant', content: j.choices[0].message.content || '' }, usage: j.usage });
      } catch (e) { cb({ error: 'Could not parse response' }); }
    });
  });
  r.on('error', e => cb({ error: 'Could not reach ' + provider.name + ': ' + e.message }));
  r.on('timeout', () => { r.destroy(); cb({ error: provider.name + ' did not answer in time.' }); });
  r.end(payload);
}

/* Streaming for no-key providers */
async function streamNoKey(providerId, body, res) {
  const provider = FL.NO_KEY_PROVIDERS[providerId];
  if (!provider) return res.write('event: error\ndata: {"error":"Unknown no-key provider: ' + providerId + '"}\n\n') && res.end();
  const req = FL.shape(body, provider);
  req.stream = true;
  const url = provider.baseUrl.replace(/\/v1$/, '') + '/chat/completions';
  const payload = JSON.stringify(req);
  const mod = url.startsWith('https') ? https : http;
  const parsed = new URL(url);
  const headers = { 'content-type': 'application/json', 'content-length': Buffer.byteLength(payload), 'accept': 'text/event-stream' };
  const requestOptions = { hostname: parsed.hostname, port: parsed.port || (parsed.protocol === 'https:' ? 443 : 80), path: parsed.pathname + parsed.search, method: 'POST', headers, timeout: 180000 };
  if (provider.relaxSsl) requestOptions.rejectUnauthorized = false;
  const r = mod.request(requestOptions, pres => {
    if (pres.statusCode !== 200) { let b = ''; pres.on('data', c => b += c); pres.on('end', () => { let msg = 'Provider returned ' + pres.statusCode; try { const j = JSON.parse(b); msg = j.error?.message || msg; } catch (e) { } if (pres.statusCode === 526) msg += ' (SSL certificate issue - provider may be temporarily unavailable)'; res.write('event: error\ndata: ' + JSON.stringify({ error: msg }) + '\n\n'); res.end(); }); return; }
    pres.on('data', c => res.write(c)); pres.on('end', () => res.end());
  });
  r.on('error', e => { res.write('event: error\ndata: ' + JSON.stringify({ error: 'Could not reach ' + provider.name + ': ' + e.message }) + '\n\n'); res.end(); });
  r.on('timeout', () => { r.destroy(); res.write('event: error\ndata: ' + JSON.stringify({ error: provider.name + ' did not answer in time.' }) + '\n\n'); res.end(); });
  r.end(payload);
}

/* Force refresh free LLM providers from GitHub */
async function forceRefreshProviders() {
  return FL.forceRefresh();
}

module.exports = { ready, keyProblem, cfg, set, status, models, refreshModels, streamTo, once, test, testFree, testNoKey, getProviders, getNoKeyProviders, isCloud, isFreeProvider, isNoKeyProvider, shape, FALLBACK, FREE_FALLBACK, FILE,
  callFree, callNoKey, streamFree, streamNoKey, getProviderKey, getProviderErr, ANTHROPIC_KEY, forceRefreshProviders,
  _t: { address, direct, send } };
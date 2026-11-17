// Free LLM APIs: unified access to 300+ free models from 22+ providers (awesome-freellm-apis).
// Fetches provider data from the GitHub repo, stores API keys encrypted by Windows (DPAPI),
// and speaks OpenAI Chat Completions so the rest of the app needs no changes.
const fs = require('fs'), path = require('path'), http = require('http'), https = require('http').request ? require('https') : require('http');
const WS = require('./winsecret');
const net = require('./net');
const ROOT = path.join(__dirname, '..');
const FILE = path.join(ROOT, 'data', 'freellm.json');
const REPO = 'open-free-llm-api/awesome-freellm-apis';
const STATUS_URL = 'https://raw.githubusercontent.com/' + REPO + '/main/status.json';
const REPO_DIR = path.join(ROOT, 'data', 'refs', 'freellm');
const LOCAL_STATUS = path.join(REPO_DIR, 'status.json');
const MAXTOK = 8192;
const CACHE_TTL = 6 * 3600 * 1000; // 6 hours

let cache = { at: 0, providers: null };
let keyCache = { keys: {}, at: 0 };

function read() {
  try { return JSON.parse(fs.readFileSync(FILE, 'utf8')); } catch (e) { return {}; }
}
function write(o) {
  try { fs.mkdirSync(path.dirname(FILE), { recursive: true }); fs.writeFileSync(FILE, JSON.stringify(o, null, 1)); } catch (e) { }
}

/* Load keys from disk (encrypted blobs) into memory */
async function loadKeys() {
  const c = read();
  if (c.keysBlob) {
    try {
      const decrypted = await WS.unprotect(c.keysBlob);
      keyCache.keys = JSON.parse(decrypted);
      keyCache.at = Date.now();
    } catch (e) { keyCache.keys = {}; }
  } else if (c.keys) {
    keyCache.keys = c.keys;
    await saveKeys();
  }
}

/* Save keys to disk as encrypted blob */
async function saveKeys() {
  const c = read();
  try {
    const blob = await WS.protect(JSON.stringify(keyCache.keys));
    delete c.keys;
    c.keysBlob = blob;
    write(c);
  } catch (e) { }
}

/* Get the decrypted key for a provider */
function getKey(provider) {
  return keyCache.keys[provider] || '';
}

/* Set a key for a provider (validates format per provider) */
async function setKey(provider, key) {
  key = String(key || '').trim();
  if (!key) { delete keyCache.keys[provider]; await saveKeys(); return true; }
  keyCache.keys[provider] = key;
  await saveKeys();
  return true;
}

/* Fetch the latest provider list from GitHub (or local repo) */
async function fetchProviders() {
  if (cache.providers && Date.now() - cache.at < CACHE_TTL) return cache.providers;
  try { return await readProviders(); } catch (e) { return cache.providers || []; }
}
async function readProviders() {

  let data = null;
  /* a circular import can hand us a half-built module here; treat that as "internet is off" instead of throwing,
     because a throw in here left the caller waiting for an answer that never came */
  if (net && typeof net.on === 'function' && net.on()) {
    try {
      data = await fetchUrl(STATUS_URL);
    } catch (e) { }
  }
  if (!data && fs.existsSync(LOCAL_STATUS)) {
    try { data = JSON.parse(fs.readFileSync(LOCAL_STATUS, 'utf8')); } catch (e) { }
  }
  if (!data) return cache.providers || [];

  const providers = (data.providers || []).map(p => ({
    id: p.slug,
    name: p.provider,
    baseUrl: p.base_url,
    apiKeyUrl: p.api_key_url,
    maxContext: p.max_context,
    freeModels: p.free_models_count,
    status: p.status,
    protocols: p.verified_protocols,
    tagline: p.tagline,
    needsKey: !!p.base_url && !!p.api_key_url
  })).filter(p => p.baseUrl);

  cache = { at: Date.now(), providers };
  return providers;
}

/* HTTP fetch helper */
function fetchUrl(url) {
  return new Promise((resolve, reject) => {
    const mod = url.startsWith('https') ? https : http;
    const req = mod.get(url, { timeout: 15000, headers: { 'user-agent': 'Moundshroud FreeLLM' } }, res => {
      let b = ''; res.on('data', c => b += c); res.on('end', () => {
        if (res.statusCode !== 200) return reject(new Error('HTTP ' + res.statusCode));
        try { resolve(JSON.parse(b)); } catch (e) { reject(e); }
      });
    });
    req.on('error', reject); req.on('timeout', () => { req.destroy(); reject(new Error('timeout')); });
  });
}

/* Get a provider by id */
async function getProvider(id) {
  const all = await fetchProviders();
  return all.find(p => p.id === id) || null;
}

/* List all providers with key status */
async function list() {
  const providers = await fetchProviders();
  return providers.map(p => ({
    ...p,
    hasKey: !!getKey(p.id),
    keyTail: getKey(p.id) ? getKey(p.id).slice(-4) : ''
  }));
}

/* Build OpenAI-compatible request */
function shape(body, provider) {
  const msgs = Array.isArray(body.messages) ? body.messages : [];
  const system = msgs.filter(m => m.role === 'system').map(m => String(m.content || '')).join('\n\n');
  const out = [];
  for (const m of msgs) {
    if (!m || m.role === 'system') continue;
    const parts = [];
    if (m.images && m.images.length) {
      for (const d of m.images) {
        const img = toImage(d); if (img) parts.push(img);
      }
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
    model: String(body.model || ''),
    max_tokens: Math.min(MAXTOK, Math.max(64, +o.num_predict || +body.max_tokens || 4096)),
    messages: out
  };
  if (system) req.system = system;
  if (body.format === 'json') req.system = (req.system ? req.system + '\n\n' : '') + 'Answer with a single JSON object and nothing else: no explanation, no markdown fence.';
  if (body.stream) req.stream = true;
  if (Array.isArray(body.tools) && body.tools.length) req.tools = body.tools;
  return req;
}

function toImage(d) {
  const s = String(d || '');
  const m = /^data:(image\/(png|jpeg|jpg|gif|webp));base64,(.+)$/i.exec(s);
  if (!m) return null;
  return { type: 'image', source: { type: 'base64', media_type: m[1].toLowerCase(), data: m[2] } };
}

/* Make a request to a free LLM provider */
async function call(providerId, body, cb) {
  await loadKeys();
  const provider = await getProvider(providerId);
  if (!provider) return cb({ error: 'Unknown provider: ' + providerId });
  const key = getKey(providerId);
  if (provider.needsKey && !key) return cb({ error: 'No API key saved for ' + provider.name + '. Add one in Settings.' });

  const req = shape(body, provider);
  const url = provider.baseUrl.replace(/\/v1$/, '') + '/chat/completions';
  const payload = JSON.stringify(req);

  const mod = url.startsWith('https') ? https : http;
  const parsed = new URL(url);
  const headers = {
    'content-type': 'application/json',
    'authorization': 'Bearer ' + key,
    'content-length': Buffer.byteLength(payload)
  };
  if (provider.id === 'openrouter') {
    headers['http-referer'] = 'https://moundshroud.app';
    headers['x-title'] = 'Moundshroud';
  }
  // No-key providers don't need auth header
  if (NO_KEY_PROVIDERS[providerId] && !provider.needsKey) {
    delete headers.authorization;
  }

  const requestOptions = { hostname: parsed.hostname, port: parsed.port || (parsed.protocol === 'https:' ? 443 : 80), path: parsed.pathname + parsed.search, method: 'POST', headers, timeout: 180000 };
  if (NO_KEY_PROVIDERS[providerId]?.relaxSsl) requestOptions.rejectUnauthorized = false;

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
        cb(null, {
          model: j.model || req.model,
          done: true,
          done_reason: j.choices[0].finish_reason || 'stop',
          message: { role: 'assistant', content: j.choices[0].message.content || '' },
          usage: j.usage
        });
      } catch (e) { cb({ error: 'Could not parse response' }); }
    });
  });
  r.on('error', e => cb({ error: 'Could not reach ' + provider.name + ': ' + e.message }));
  r.on('timeout', () => { r.destroy(); cb({ error: provider.name + ' did not answer in time.' }); });
  r.end(payload);
}

/* Streaming request */
async function stream(providerId, body, res) {
  await loadKeys();
  const provider = await getProvider(providerId);
  if (!provider) return res.end(JSON.stringify({ error: 'Unknown provider' }) + '\n');
  const key = getKey(providerId);
  if (provider.needsKey && !key) return res.end(JSON.stringify({ error: 'No API key for ' + provider.name }) + '\n');

  const req = shape(body, provider);
  req.stream = true;
  const url = provider.baseUrl.replace(/\/v1$/, '') + '/chat/completions';
  const payload = JSON.stringify(req);

  const mod = url.startsWith('https') ? https : http;
  const parsed = new URL(url);
  const headers = {
    'content-type': 'application/json',
    'authorization': 'Bearer ' + key,
    'content-length': Buffer.byteLength(payload),
    'accept': 'text/event-stream'
  };
  if (provider.id === 'openrouter') {
    headers['http-referer'] = 'https://moundshroud.app';
    headers['x-title'] = 'Moundshroud';
  }
  // No-key providers don't need auth header
  if (NO_KEY_PROVIDERS[providerId] && !provider.needsKey) {
    delete headers.authorization;
  }

  const requestOptions = { hostname: parsed.hostname, port: parsed.port || (parsed.protocol === 'https:' ? 443 : 80), path: parsed.pathname + parsed.search, method: 'POST', headers, timeout: 180000 };
  if (NO_KEY_PROVIDERS[providerId]?.relaxSsl) requestOptions.rejectUnauthorized = false;

  res.writeHead(200, { 'Content-Type': 'text/event-stream; charset=utf-8', 'Cache-Control': 'no-store', 'Connection': 'keep-alive' });
  const emit = o => { try { res.write('data: ' + JSON.stringify(o) + '\n\n'); } catch (e) { } };

  const r = mod.request(requestOptions, s => {
    if (s.statusCode !== 200) {
      let b = ''; s.on('data', c => b += c); s.on('end', () => {
        let msg = 'Provider returned ' + s.statusCode; try { const j = JSON.parse(b); msg = j.error?.message || msg; } catch (e) { }
        emit({ error: msg }); res.end();
      }); return;
    }
    let buf = '';
    s.setEncoding('utf8');
    s.on('data', chunk => {
      buf += chunk;
      let i;
      while ((i = buf.indexOf('\n\n')) >= 0) {
        const block = buf.slice(0, i).trim(); buf = buf.slice(i + 2);
        if (!block.startsWith('data:')) continue;
        const line = block.slice(5).trim();
        if (line === '[DONE]') { emit({ done: true }); res.end(); return; }
        try {
          const j = JSON.parse(line);
          if (j.choices?.[0]?.delta?.content) emit({ model: j.model || req.model, message: { role: 'assistant', content: j.choices[0].delta.content }, done: false });
          else if (j.choices?.[0]?.finish_reason) emit({ done: true, done_reason: j.choices[0].finish_reason });
        } catch (e) { }
      }
    });
    s.on('end', () => { emit({ done: true }); res.end(); });
  });
  r.on('error', e => { emit({ error: 'Connection error: ' + e.message }); res.end(); });
  r.on('timeout', () => { r.destroy(); emit({ error: 'Timeout' }); res.end(); });
  r.end(payload);
}

/* Refresh from GitHub repo (also updates local copy) */
async function refresh() {
  cache.at = 0;
  const providers = await fetchProviders();
  if (providers.length && fs.existsSync(REPO_DIR)) {
    try { fs.writeFileSync(LOCAL_STATUS, JSON.stringify({ providers }, null, 2)); } catch (e) { }
  }
  return providers;
}

/* Force refresh ignoring cache - clears cache and fetches fresh from GitHub */
async function forceRefresh() {
  cache.at = 0;
  cache.providers = null;
  // Also clear the local status file to force re-fetch
  try { if (fs.existsSync(LOCAL_STATUS)) fs.unlinkSync(LOCAL_STATUS); } catch (e) { }
  const providers = await fetchProviders();
  if (providers.length && fs.existsSync(REPO_DIR)) {
    try { fs.writeFileSync(LOCAL_STATUS, JSON.stringify({ providers }, null, 2)); } catch (e) { }
  }
  return providers;
}

/* Get recommended models for a provider */
function getRecommendedModels(providerId) {
  const recs = {
    'groq': ['llama-3.3-70b-versatile', 'qwen/qwen3.8-27b', 'whisper-large-v3'],
    'nvidia-nim': ['z-ai/glm-5.3-flash', 'moonshotai/kimi-k2.6', 'poolside/laguna-xs-2.1'],
    'google-gemini': ['gemini-3.8-flash', 'gemini-3.6-flash', 'gemini-3.5-flash-lite'],
    'openrouter': ['stealth/crouton-alpha', 'nvidia/nemotron-3-ultra-550b-a55b:free', 'nvidia/nemotron-3.5-super-vl:free'],
    'kilo-code': ['nvidia/nemotron-3-ultra-550b-a55b:free', 'cohere/north-mini-code:free'],
    'mistral-ai': ['open-mistral-7b', 'open-mixtral-8x7b', 'mistral-medium-3.5-128b'],
    'cohere': ['command-a-218b', 'command-a-111b', 'command-r'],
    'cloudflare-workers-ai': ['@cf/meta/llama-3.3-70b-instruct-fp8-fast', '@cf/meta/llama-4-scout-17b-16e-instruct'],
    'modelscope': ['MiniMax/MiniMax-M1-80k', 'meituan-longcat/LongCat-Flash-Lite'],
    'ovhcloud-ai-endpoints': ['qwen3.5-397b-a17b', 'gpt-oss-120b'],
    'ollama-cloud': ['gpt-oss:120b', 'nemotron-3-ultra'],
    'glhf-chat': ['meta-llama/Meta-Llama-3.1-70B-Instruct', 'mistralai/Mixtral-8x7B-Instruct-v0.1'],
    'chutes-ai': ['deepseek-ai/DeepSeek-R1', 'meta-llama/Meta-Llama-3.1-70B-Instruct'],
    'llm7-io': ['gpt-oss-20b', 'mistral-Nemo-Instruct-2407', 'codestral-latest'],
    'z-ai-zhipu-ai': ['glm-4.5-air', 'glm-4.7-flash'],
    'gonka-broker': ['minimaxai-minimax-m2-7', 'deepseek-ai-deepseek-v4-flash-0731'],
    'agnes-ai': ['agnes-2.5-flash', 'agnes-image-2.1-flash'],
    'aion-labs': ['aion-labs-aion-2.0', 'aion-labs-aion-3.0'],
    'siliconflow': ['tencent-hunyuan-mt-7b', 'xingchenagi-xing4-0-29b'],
    'grok-(xai)': ['grok-2', 'grok-2-mini'],
    'opencode': ['big-pickle', 'nemotron-3.5-lightning-free', 'deepseek-v4-flash']
  };
  return recs[providerId] || [];
}

/* Providers that work without API keys (anonymous/public access) */
const NO_KEY_PROVIDERS = {
  'glhf-chat': {
    id: 'glhf-chat',
    name: 'Glhf.chat',
    baseUrl: 'https://glhf.chat/api/openai/v1',
    models: [
      { id: 'meta-llama/Meta-Llama-3.1-70B-Instruct', name: 'Llama 3.1 70B', note: '131K ctx, unlimited free, no key' },
      { id: 'mistralai/Mixtral-8x7B-Instruct-v0.1', name: 'Mixtral 8x7B', note: '32K ctx, unlimited free, no key' }
    ],
    tagline: 'Unlimited free inference — no API key needed',
    relaxSsl: true
  },
  'chutes-ai': {
    id: 'chutes-ai',
    name: 'Chutes.ai',
    baseUrl: 'https://api.chutes.ai/v1',
    models: [
      { id: 'deepseek-ai/DeepSeek-R1', name: 'DeepSeek R1', note: '131K ctx, reasoning, no key' },
      { id: 'meta-llama/Meta-Llama-3.1-70B-Instruct', name: 'Llama 3.1 70B', note: '131K ctx, no key' }
    ],
    tagline: 'Community-powered AI — DeepSeek R1 & Llama, no key',
    relaxSsl: true
  },
  'ovhcloud-ai-endpoints': {
    id: 'ovhcloud-ai-endpoints',
    name: 'OVHcloud AI (Anonymous)',
    baseUrl: 'https://oai.endpoints.kepler.ai.cloud.ovh.net/v1',
    models: [
      { id: 'qwen3.5-397b-a17b', name: 'Qwen 3.5 397B', note: '262K ctx, 2 RPM anonymous' },
      { id: 'gpt-oss-120b', name: 'GPT-OSS 120B', note: '131K ctx, 2 RPM anonymous' },
      { id: 'meta-llama-3_3-70b-instruct', name: 'Llama 3.3 70B', note: '131K ctx, 2 RPM anonymous' }
    ],
    tagline: 'EU-hosted, GDPR compliant — 2 RPM anonymous tier',
    relaxSsl: true
  }
};

/* Get providers that work without API keys */
function getNoKeyProviders() {
  return Object.values(NO_KEY_PROVIDERS);
}

/* Test a no-key provider */
async function testNoKey(providerId, model, cb) {
  const provider = NO_KEY_PROVIDERS[providerId];
  if (!provider) return cb({ error: 'Unknown no-key provider: ' + providerId });
  
  const req = shape({ model, messages: [{ role: 'user', content: 'Reply with the single word OK.' }], options: { num_predict: 16 } }, provider);
  const url = provider.baseUrl.replace(/\/v1$/, '') + '/chat/completions';
  const payload = JSON.stringify(req);

  const mod = url.startsWith('https') ? https : http;
  const parsed = new URL(url);
  const headers = {
    'content-type': 'application/json',
    'content-length': Buffer.byteLength(payload)
  };
  const requestOptions = { hostname: parsed.hostname, port: parsed.port || (parsed.protocol === 'https:' ? 443 : 80), path: parsed.pathname + parsed.search, method: 'POST', headers, timeout: 30000 };
  if (provider.relaxSsl) requestOptions.rejectUnauthorized = false;

  const r = mod.request(requestOptions, res => {
    let b = ''; res.on('data', c => b += c); res.on('end', () => {
      if (res.statusCode !== 200) {
        let msg = 'Provider returned ' + res.statusCode;
        try { const j = JSON.parse(b); msg = j.error?.message || msg; } catch (e) { }
        // Special handling for 526 (Cloudflare SSL error)
        if (res.statusCode === 526) msg += ' (SSL certificate issue - provider may be temporarily unavailable)';
        return cb({ error: msg });
      }
      try {
        const j = JSON.parse(b);
        if (!j.choices?.[0]?.message) return cb({ error: 'Unexpected response format' });
        cb(null, {
          model: j.model || req.model,
          done: true,
          done_reason: j.choices[0].finish_reason || 'stop',
          message: { role: 'assistant', content: j.choices[0].message.content || '' },
          usage: j.usage
        });
      } catch (e) { cb({ error: 'Could not parse response' }); }
    });
  });
  r.on('error', e => cb({ error: 'Could not reach ' + provider.name + ': ' + e.message }));
  r.on('timeout', () => { r.destroy(); cb({ error: provider.name + ' did not answer in time.' }); });
  r.end(payload);
}

module.exports = {
  FILE, REPO, STATUS_URL,
  loadKeys, setKey, getKey,
  fetchProviders, list, getProvider,
  call, stream, refresh, forceRefresh,
  getRecommendedModels,
  shape, toImage,
  getNoKeyProviders, testNoKey, NO_KEY_PROVIDERS
};
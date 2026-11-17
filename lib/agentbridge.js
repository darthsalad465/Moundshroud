// The free-agent bridge: one loopback door that the in-app agent harnesses can talk to instead of Ollama.
// Claude Code wants the Anthropic Messages API; jcode wants the Ollama API. Both are served here and both are
// answered by the free pool in lib/freeroute.js, so the same harnesses (with all their tools, permissions and the
// Agent tab) run on free frontier models with no key and no local model loaded.
// Nothing here listens beyond 127.0.0.1, and it only runs while a free-agent session is open.
const http = require('http'), crypto = require('crypto');
const free = require('./freeroute');

const MODEL = 'free-agent';
let server = null, port = 0, readyP = null;

/* ---------- the two directions of the translation ---------- */
function textOf(blocks) {
  return (Array.isArray(blocks) ? blocks : []).filter(b => b && b.type === 'text').map(b => b.text || '').join('');
}
/* Anthropic request -> the pool's message list (assistant tool calls and tool results kept, or an agent cannot act) */
function fromAnthropic(body) {
  const msgs = [];
  const sys = body.system;
  const sysText = typeof sys === 'string' ? sys : textOf(sys);
  if (sysText && sysText.trim()) msgs.push({ role: 'system', content: sysText });
  for (const m of body.messages || []) {
    if (!m) continue;
    if (typeof m.content === 'string') { msgs.push({ role: m.role === 'assistant' ? 'assistant' : 'user', content: m.content }); continue; }
    const blocks = Array.isArray(m.content) ? m.content : [];
    if (m.role === 'assistant') {
      const text = textOf(blocks);
      const calls = blocks.filter(b => b && b.type === 'tool_use').map(b => ({
        id: b.id || 'call_' + crypto.randomBytes(4).toString('hex'), type: 'function',
        function: { name: b.name, arguments: JSON.stringify(b.input || {}) }
      }));
      const msg = { role: 'assistant', content: text };
      if (calls.length) msg.tool_calls = calls;
      if (text || calls.length) msgs.push(msg);
      continue;
    }
    const text = textOf(blocks);
    if (text.trim()) msgs.push({ role: 'user', content: text });
    for (const b of blocks) {
      if (!b || b.type !== 'tool_result') continue;
      const out = typeof b.content === 'string' ? b.content
        : Array.isArray(b.content) ? b.content.filter(x => x && x.type === 'text').map(x => x.text).join('\n')
          : (b.content == null ? '' : JSON.stringify(b.content));
      msgs.push({ role: 'tool', tool_call_id: b.tool_use_id || '', content: out || '(no output)' });
    }
  }
  const out = { messages: msgs };
  if (+body.max_tokens) out.max_tokens = +body.max_tokens;
  if (Array.isArray(body.tools) && body.tools.length) out.tools = body.tools.map(t => ({
    type: 'function',
    function: { name: t.name, description: t.description || '', parameters: t.input_schema || { type: 'object', properties: {} } }
  }));
  return out;
}

const rid = p => p + '_' + crypto.randomBytes(10).toString('hex');
/* the pool's answer -> an Anthropic message, tool calls included */
function toAnthropic(res, model) {
  const text = (res && res.message && res.message.content) || '';
  const calls = (res && res.message && res.message.tool_calls) || [];
  const content = [];
  if (text) content.push({ type: 'text', text });
  for (const c of calls) {
    const fn = c.function || c;
    let input = fn.arguments;
    if (typeof input === 'string') { try { input = JSON.parse(input); } catch (e) { input = { input }; } }
    content.push({ type: 'tool_use', id: rid('toolu'), name: fn.name, input: input || {} });
  }
  if (!content.length) content.push({ type: 'text', text: '' });
  const u = (res && res.usage) || {};
  return {
    id: rid('msg'), type: 'message', role: 'assistant', model: model || MODEL, content,
    stop_reason: calls.length ? 'tool_use' : 'end_turn', stop_sequence: null,
    usage: { input_tokens: u.prompt_tokens || 0, output_tokens: u.completion_tokens || 0 }
  };
}
/* Anthropic streaming: the answer arrives whole, so it is sent as one text block (or a tool_use block) */
function sseAnthropic(msg, w) {
  const ev = (name, data) => { try { w.write('event: ' + name + '\ndata: ' + JSON.stringify(data) + '\n\n'); } catch (e) { } };
  ev('message_start', { type: 'message_start', message: Object.assign({}, msg, { content: [], stop_reason: null, usage: { input_tokens: msg.usage.input_tokens, output_tokens: 0 } }) });
  msg.content.forEach((block, i) => {
    if (block.type === 'text') {
      ev('content_block_start', { type: 'content_block_start', index: i, content_block: { type: 'text', text: '' } });
      if (block.text) ev('content_block_delta', { type: 'content_block_delta', index: i, delta: { type: 'text_delta', text: block.text } });
      ev('content_block_stop', { type: 'content_block_stop', index: i });
    } else {
      ev('content_block_start', { type: 'content_block_start', index: i, content_block: { type: 'tool_use', id: block.id, name: block.name, input: {} } });
      ev('content_block_delta', { type: 'content_block_delta', index: i, delta: { type: 'input_json_delta', partial_json: JSON.stringify(block.input || {}) } });
      ev('content_block_stop', { type: 'content_block_stop', index: i });
    }
  });
  ev('message_delta', { type: 'message_delta', delta: { stop_reason: msg.stop_reason, stop_sequence: null }, usage: { output_tokens: msg.usage.output_tokens } });
  ev('message_stop', { type: 'message_stop' });
}

/* the pool's answer -> what Ollama would have said */
function toOllama(res, model) {
  const calls = ((res && res.message && res.message.tool_calls) || []).map(c => {
    const fn = c.function || c;
    let args = fn.arguments;
    if (typeof args === 'string') { try { args = JSON.parse(args); } catch (e) { args = {}; } }
    return { function: { name: fn.name, arguments: args || {} } };
  });
  const u = (res && res.usage) || {};
  const msg = { role: 'assistant', content: (res && res.message && res.message.content) || '' };
  if (calls.length) msg.tool_calls = calls;
  return { model: model || MODEL, created_at: new Date().toISOString(), message: msg, done: true, done_reason: 'stop', eval_count: u.completion_tokens || 0, prompt_eval_count: u.prompt_tokens || 0 };
}

/* the pool's answer -> an OpenAI chat completion (jcode and other OpenAI-shaped clients read this) */
function toOpenAI(res, model) {
  const calls = ((res && res.message && res.message.tool_calls) || []).map((c, i) => {
    const fn = c.function || c;
    let args = fn.arguments;
    return { index: i, id: (c && c.id) || rid('call'), type: 'function', function: { name: fn.name, arguments: typeof args === 'string' ? args : JSON.stringify(args || {}) } };
  });
  const u = (res && res.usage) || {};
  return {
    id: rid('chatcmpl'), object: 'chat.completion', created: Math.floor(Date.now() / 1000), model: model || MODEL,
    choices: [{ index: 0, message: Object.assign({ role: 'assistant', content: (res && res.message && res.message.content) || '' }, calls.length ? { tool_calls: calls } : {}), finish_reason: calls.length ? 'tool_calls' : 'stop' }],
    usage: { prompt_tokens: u.prompt_tokens || 0, completion_tokens: u.completion_tokens || 0, total_tokens: (u.prompt_tokens || 0) + (u.completion_tokens || 0) }
  };
}
function sseOpenAI(full, w) {
  const ev = o => { try { w.write('data: ' + JSON.stringify(o) + '\n\n'); } catch (e) { } };
  const base = { id: full.id, object: 'chat.completion.chunk', created: full.created, model: full.model };
  const msg = full.choices[0].message;
  ev(Object.assign({}, base, { choices: [{ index: 0, delta: { role: 'assistant', content: msg.content || '' }, finish_reason: null }] }));
  (msg.tool_calls || []).forEach(tc => ev(Object.assign({}, base, { choices: [{ index: 0, delta: { tool_calls: [tc] }, finish_reason: null }] })));
  ev(Object.assign({}, base, { choices: [{ index: 0, delta: {}, finish_reason: full.choices[0].finish_reason }], usage: full.usage }));
  try { w.write('data: [DONE]\n\n'); } catch (e) { }
}

/* ---------- the server ---------- */
const DETAILS = { parent_model: '', format: 'remote', family: 'free', families: ['free'], parameter_size: 'frontier', quantization_level: 'remote' };

function handler(req, res) {
  const u = new URL(req.url, 'http://127.0.0.1');
  const path = u.pathname.replace(/\/+$/, '') || '/';
  const send = (code, obj, type) => {
    const body = JSON.stringify(obj);
    res.writeHead(code, { 'Content-Type': type || 'application/json; charset=utf-8', 'Content-Length': Buffer.byteLength(body), 'Cache-Control': 'no-store' });
    res.end(body);
  };
  const readBody = cb => {
    let b = ''; req.setEncoding('utf8');
    req.on('data', d => { b += d; if (b.length > 4e6) req.destroy(); });
    req.on('end', () => { try { cb(JSON.parse(b || '{}')); } catch (e) { cb(null); } });
  };

  /* ---- what the harnesses ask about the model before they start ---- */
  if (path === '/api/tags' && req.method === 'GET') return send(200, { models: [{ name: MODEL, model: MODEL, modified_at: new Date().toISOString(), size: 0, digest: 'free', details: DETAILS }] });
  if (path === '/api/version' && req.method === 'GET') return send(200, { version: '0.0.0-moundshroud-free' });
  if (path === '/api/ps' && req.method === 'GET') return send(200, { models: [{ name: MODEL, model: MODEL, size: 0, details: DETAILS }] });
  if ((path === '/api/show' || path === '/api/pull') && req.method === 'POST') return send(200, path === '/api/show'
    ? { modelfile: '', parameters: '', template: '', details: DETAILS, model_info: { 'free.frontier': true }, capabilities: ['completion', 'tools'] }
    : { status: 'success' });
  if (path === '/v1/models' && req.method === 'GET') return send(200, { data: [{ id: MODEL, type: 'model', display_name: 'Free frontier' }] });

  if (req.method !== 'POST') return send(404, { error: 'not found' });

  /* ---- Ollama: POST /api/chat ---- */
  if (path === '/api/chat') {
    return readBody(async reqBody => {
      if (!reqBody) return send(400, { error: 'bad request' });
      const body = {
        messages: reqBody.messages || [],
        options: { num_predict: reqBody.options && reqBody.options.num_predict, temperature: reqBody.options && reqBody.options.temperature },
        tools: reqBody.tools, max_tokens: reqBody.options && reqBody.options.num_predict
      };
      const r = await new Promise(done => free.once(body, (err, out) => done({ err, out })));
      if (!r.out) return send(200, { error: (r.err && r.err.error) || 'No free route answered.' });
      if (!reqBody.stream) return send(200, toOllama(r.out, reqBody.model));
      res.writeHead(200, { 'Content-Type': 'application/x-ndjson; charset=utf-8', 'Cache-Control': 'no-store', 'Connection': 'keep-alive' });
      const line = o => { try { res.write(JSON.stringify(o) + '\n'); } catch (e) { } };
      const full = toOllama(r.out, reqBody.model);
      const text = full.message.content || '';
      /* a few pieces, so a harness that reads as it arrives still sees progress */
      for (let i = 0; i < text.length; i += 120) line({ model: MODEL, created_at: new Date().toISOString(), message: { role: 'assistant', content: text.slice(i, i + 120) }, done: false });
      line(full);
      try { res.end(); } catch (e) { }
    });
  }

  /* ---- OpenAI: POST /v1/chat/completions ---- */
  if (path === '/v1/chat/completions') {
    return readBody(async reqBody => {
      if (!reqBody) return send(400, { error: { message: 'bad request' } });
      const r = await new Promise(done => free.once({ messages: reqBody.messages || [], tools: reqBody.tools, max_tokens: reqBody.max_tokens || (reqBody.max_completion_tokens) }, (err, out) => done({ err, out })));
      if (!r.out) return send(502, { error: { message: (r.err && r.err.error) || 'No free route answered.', type: 'upstream_error' } });
      const full = toOpenAI(r.out, reqBody.model);
      if (!reqBody.stream) return send(200, full);
      res.writeHead(200, { 'Content-Type': 'text/event-stream; charset=utf-8', 'Cache-Control': 'no-store', 'Connection': 'keep-alive' });
      sseOpenAI(full, res);
      try { res.end(); } catch (e) { }
    });
  }

  /* ---- Anthropic: POST /v1/messages (and the token counter Claude Code calls first) ---- */
  if (path === '/v1/messages/count_tokens') {
    return readBody(reqBody => send(200, { input_tokens: Math.max(1, Math.round(JSON.stringify((reqBody && reqBody.messages) || '').length / 4)) }));
  }
  if (path === '/v1/messages') {
    return readBody(async body => {
      if (!body) return send(400, { type: 'error', error: { type: 'invalid_request_error', message: 'bad request' } });
      const pool = fromAnthropic(body);
      const r = await new Promise(done => free.once(pool, (err, out) => done({ err, out })));
      if (!r.out) {
        const msg = (r.err && r.err.error) || 'No free route answered.';
        return send(200, { type: 'error', error: { type: 'api_error', message: msg } });
      }
      const out = toAnthropic(r.out, body.model);
      if (!body.stream) return send(200, out);
      res.writeHead(200, { 'Content-Type': 'text/event-stream; charset=utf-8', 'Cache-Control': 'no-store', 'Connection': 'keep-alive' });
      sseAnthropic(out, res);
      try { res.end(); } catch (e) { }
    });
  }

  return send(404, { error: 'not found' });
}

/* start it once; every caller gets the same address */
function ensure() {
  if (port) return Promise.resolve('http://127.0.0.1:' + port);
  if (readyP) return readyP;
  readyP = new Promise((resolve, reject) => {
    server = http.createServer((req, res) => {
      try { handler(req, res); } catch (e) {
        try { res.writeHead(500, { 'Content-Type': 'application/json' }); res.end(JSON.stringify({ error: String((e && e.message) || e) })); } catch (x) { }
      }
    });
    server.on('error', e => { readyP = null; server = null; reject(e); });
    server.listen(0, '127.0.0.1', () => {
      port = server.address().port;
      resolve('http://127.0.0.1:' + port);
    });
  });
  return readyP;
}
function stop() {
  if (server) { try { server.close(); } catch (e) { } }
  server = null; port = 0; readyP = null;
}
const url = () => (port ? 'http://127.0.0.1:' + port : '');

module.exports = { ensure, stop, url, MODEL, fromAnthropic, toAnthropic, toOllama, toOpenAI, sseAnthropic, sseOpenAI, _test: { handler, DETAILS } };

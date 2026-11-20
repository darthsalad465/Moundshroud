// Chat with models that are not in Ollama, answering in the Ollama ndjson shape the whole app reads.
//   lms:<model key>    a model in LM Studio, run by LM Studio's own local server (started on 127.0.0.1 when needed)
//   gguf:<catalog id>  a GGUF file Moundshroud runs straight from disk with llama.cpp (lib/llama-runner.js)
// Both speak the OpenAI-style /v1/chat/completions API; this file turns the app's Ollama-style request into one and
// turns the streamed answer back into { message: { content | thinking | tool_calls }, done } lines. Nothing leaves this PC.
const http = require('http'), cp = require('child_process'), path = require('path'), os = require('os'), fs = require('fs');

const LMS = path.join(os.homedir(), '.lmstudio', 'bin', 'lms.exe');
let lmsPort = 1234, lmsCache = null, lmsAt = 0, lmsStarting = null;

function run(exe, args, ms) {
  return new Promise(done => cp.execFile(exe, args, { encoding: 'utf8', timeout: ms || 15000, windowsHide: true }, (e, out, err) => done({ ok: !e, out: String(out || ''), err: String(err || (e && e.message) || '') })));
}
const parse = s => { try { return JSON.parse(s); } catch (e) { return null; } };

/* LM Studio's language models, the loaded ones first: [{ name: 'lms:<key>', label, size, loaded, tools, vision }] */
async function lmsList(fresh) {
  if (!fs.existsSync(LMS)) return { installed: false, models: [] };
  if (!fresh && lmsCache && Date.now() - lmsAt < 60000) return lmsCache;
  const [ls, ps] = await Promise.all([run(LMS, ['ls', '--json']), run(LMS, ['ps', '--json'])]);
  const all = parse(ls.out) || [], live = parse(ps.out) || [];
  const loaded = new Set(live.map(m => m.modelKey || m.identifier));
  const models = all.filter(m => m && m.type === 'llm' && m.modelKey).map(m => ({
    name: 'lms:' + m.modelKey, key: m.modelKey, label: m.displayName || m.modelKey, size: m.sizeBytes || 0,
    loaded: loaded.has(m.modelKey), tools: !!m.trainedForToolUse, vision: !!m.vision, params: m.paramsString || ''
  })).sort((a, z) => (z.loaded - a.loaded) || a.label.localeCompare(z.label));
  lmsCache = { installed: true, models }; lmsAt = Date.now();
  return lmsCache;
}

function up(port) {
  return new Promise(done => {
    const r = http.get({ host: '127.0.0.1', port, path: '/v1/models', timeout: 1500 }, x => { x.resume(); done(x.statusCode === 200); });
    r.on('error', () => done(false)); r.on('timeout', () => { r.destroy(); done(false); });
  });
}
/* LM Studio's server answers on 127.0.0.1 only; it is started without a window when it is off. Resolves to the port or 0 */
function lmsEnsure() {
  if (lmsStarting) return lmsStarting;
  lmsStarting = (async () => {
    if (await up(lmsPort)) return lmsPort;
    if (!fs.existsSync(LMS)) return 0;
    const st = await run(LMS, ['server', 'status', '--json']);
    const p = +((parse(st.out) || {}).port || 0); if (p) { lmsPort = p; if (await up(p)) return p; }
    const r = await run(LMS, ['server', 'start', '--bind', '127.0.0.1'], 30000);
    const m = /port\D{0,12}(\d{2,5})/i.exec(r.out + ' ' + r.err); if (m) lmsPort = +m[1];
    for (let i = 0; i < 30; i++) { if (await up(lmsPort)) return lmsPort; await new Promise(t => setTimeout(t, 500)); }
    return 0;
  })().finally(() => { lmsStarting = null; });
  return lmsStarting;
}

/* Ollama-style request -> OpenAI-style request */
function toOpenAI(b, model) {
  const messages = (b.messages || []).map(m => {
    const o = { role: m.role, content: String(m.content == null ? '' : m.content) };
    if (Array.isArray(m.images) && m.images.length) o.content = [{ type: 'text', text: o.content }].concat(m.images.map(i => ({ type: 'image_url', image_url: { url: /^data:/.test(i) ? i : 'data:image/png;base64,' + i } })));
    if (m.role === 'assistant' && Array.isArray(m.tool_calls) && m.tool_calls.length) o.tool_calls = m.tool_calls.map((c, i) => ({ id: c.id || 'call_' + i, type: 'function', function: { name: c.function.name, arguments: typeof c.function.arguments === 'string' ? c.function.arguments : JSON.stringify(c.function.arguments || {}) } }));
    if (m.role === 'tool') o.tool_call_id = m.tool_call_id || '';
    return o;
  });
  const opt = b.options || {};
  const req = { model, messages, stream: true, stream_options: { include_usage: true } };
  if (opt.temperature != null) req.temperature = opt.temperature;
  if (opt.top_p != null) req.top_p = opt.top_p;
  if (opt.num_predict > 0) req.max_tokens = opt.num_predict;
  if (Array.isArray(b.tools) && b.tools.length) req.tools = b.tools;
  return req;
}

/* streams one chat from an OpenAI-style server to res, as Ollama ndjson (or one JSON answer when b.stream is false) */
function relay(port, model, b, res) {
  const data = Buffer.from(JSON.stringify(toOpenAI(b, model)));
  const streaming = b.stream !== false, wantThink = !!b.think;
  let text = '', think = '', buf = '', err = '', usage = null, opened = false;
  const calls = [];
  const line = o => { if (!opened) { opened = true; res.writeHead(200, { 'Content-Type': 'application/x-ndjson; charset=utf-8', 'Cache-Control': 'no-store' }); } res.write(JSON.stringify(o) + '\n'); };
  const fail = msg => {
    if (streaming) { if (!opened) line({ error: msg }); else res.write(JSON.stringify({ error: msg }) + '\n'); return res.end(); }
    if (!res.headersSent) { res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' }); } res.end(JSON.stringify({ error: msg }));
  };
  const up = http.request({ host: '127.0.0.1', port, path: '/v1/chat/completions', method: 'POST', headers: { 'Content-Type': 'application/json', 'Content-Length': data.length } }, r => {
    r.setEncoding('utf8');
    const take = l => {
      if (!l.startsWith('data:')) { if (l.startsWith('{')) { const j = parse(l); if (j && j.error) err = String(j.error.message || j.error); } return; }
      const s = l.slice(5).trim(); if (!s || s === '[DONE]') return;
      const j = parse(s); if (!j) return;
      if (j.error) { err = String(j.error.message || j.error); return; }
      if (j.usage) usage = j.usage;
      const d = (j.choices && j.choices[0] && j.choices[0].delta) || {};
      if (d.content) { text += d.content; if (streaming) line({ model: b.model, message: { role: 'assistant', content: d.content }, done: false }); }
      const rc = d.reasoning_content || d.reasoning;
      if (rc) { think += rc; if (streaming && wantThink) line({ model: b.model, message: { role: 'assistant', content: '', thinking: rc }, done: false }); }
      for (const tc of d.tool_calls || []) {
        const i = tc.index || 0;
        calls[i] = calls[i] || { id: tc.id || 'call_' + i, function: { name: '', arguments: '' } };
        if (tc.id) calls[i].id = tc.id;
        if (tc.function && tc.function.name) calls[i].function.name += tc.function.name;
        if (tc.function && tc.function.arguments) calls[i].function.arguments += tc.function.arguments;
      }
    };
    r.on('data', c => { buf += c; let i; while ((i = buf.indexOf('\n')) >= 0) { take(buf.slice(0, i).trim()); buf = buf.slice(i + 1); } });
    r.on('end', () => {
      if (buf.trim()) take(buf.trim());
      if (!err && r.statusCode >= 400) err = 'The model server answered with error ' + r.statusCode + '.';
      if (err) return fail(err);
      const tool_calls = calls.filter(Boolean).map(c => ({ id: c.id, function: { name: c.function.name, arguments: parse(c.function.arguments || '{}') || {} } }));
      const counts = { prompt_eval_count: (usage && usage.prompt_tokens) || 0, eval_count: (usage && usage.completion_tokens) || 0 };
      if (!streaming) {
        const message = { role: 'assistant', content: text }; if (think && wantThink) message.thinking = think; if (tool_calls.length) message.tool_calls = tool_calls;
        res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' });
        return res.end(JSON.stringify(Object.assign({ model: b.model, message, done: true, done_reason: 'stop' }, counts)));
      }
      if (tool_calls.length) line({ model: b.model, message: { role: 'assistant', content: '', tool_calls }, done: false });
      line(Object.assign({ model: b.model, message: { role: 'assistant', content: '' }, done: true, done_reason: 'stop' }, counts));
      res.end();
    });
  });
  up.on('error', e => fail('The model server is not answering: ' + e.message));
  up.setTimeout(15 * 60000, () => up.destroy(new Error('the model did not answer in time')));
  /* the page stopped the reply (■ Stop): the model stops too */
  res.on('close', () => { if (!res.writableFinished) up.destroy(); });
  up.end(data);
}

/* one chat request whose model is lms:… or gguf:… ; true when it was handled here */
async function chat(b, res, deps) {
  const name = String((b && b.model) || '');
  const fail = msg => {
    if (b.stream === false) { res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' }); return res.end(JSON.stringify({ error: msg })); }
    res.writeHead(200, { 'Content-Type': 'application/x-ndjson; charset=utf-8', 'Cache-Control': 'no-store' }); res.end(JSON.stringify({ error: msg }) + '\n');
  };
  if (/^lms:/.test(name)) {
    const port = await lmsEnsure();
    if (!port) return fail(fs.existsSync(LMS) ? 'LM Studio\'s local server did not start. Open LM Studio once, then try again.' : 'LM Studio is not installed on this PC.');
    return relay(port, name.slice(4), b, res);
  }
  if (/^gguf:/.test(name)) {
    const m = await deps.modelUses.byId(name.slice(5)).catch(() => null);
    if (!m || !m.path || m.format !== 'gguf') return fail('That model file is not in the list any more. Reopen the model list to refresh it.');
    if (!deps.llama.available()) return fail('llama.cpp\'s server was not found, so this file cannot run directly.');
    const r = await deps.llama.start(m.path, { ctx: 12288 });
    if (!r.ok) return fail(r.error || 'The model file did not start.');
    return relay(deps.llama.PORT, m.name, b, res);
  }
  return false;
}
const handles = name => /^(lms|gguf):/.test(String(name || ''));

module.exports = { lmsList, lmsEnsure, chat, handles, toOpenAI };

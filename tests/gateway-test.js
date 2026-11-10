// The Respan Gateway: the app's Claude requests, sent through the local gateway to a pretend Anthropic on this PC.
// Nothing here reaches the internet and no real key is used: the gateway is pointed at a small local provider with
// RESPAN_ANTHROPIC_BASE_URL, which is the same switch anyone uses to put their own server behind it.
const http = require('http'), path = require('path');

module.exports = async function (ok) {
  const GW = require(path.join(__dirname, '..', 'lib', 'gateway.js'));
  const C = require(path.join(__dirname, '..', 'lib', 'cloud.js'));
  if (!GW.available()) {
    console.log('  skip gateway: respan-gateway is not installed here (run .\\install-gateway.ps1)');
    return;
  }
  const KEY = 'sk-ant-api03-' + 'fixture'.repeat(12);        // the shape of a real key; no account behind it
  const seen = [];
  const sse = (t) => 'event: ' + (t.type === 'message_start' ? 'message_start' : t.type) + '\ndata: ' + JSON.stringify(t) + '\n\n';
  const REPLY = 'hello from the fixture';
  const srv = http.createServer((req, res) => {
    let body = '';
    req.on('data', d => body += d);
    req.on('end', () => {
      if (req.method === 'GET') {                              // the model list the gateway reads when it starts
        const raw = JSON.stringify({ data: [{ type: 'model', id: 'claude-haiku-5-5', display_name: 'Claude Haiku 5.5', created_at: '2026-01-01T00:00:00Z' }], has_more: false });
        res.writeHead(200, { 'content-type': 'application/json' }); return res.end(raw);
      }
      let j = null; try { j = JSON.parse(body); } catch (e) { }
      seen.push({ path: req.url, key: req.headers['x-api-key'] || '', model: j && j.model, fallbacks: !!(j && j.fallbacks), stream: !!(j && j.stream), beta: req.headers['anthropic-beta'] || '' });
      if (j && j.stream) {
        res.writeHead(200, { 'content-type': 'text/event-stream', 'cache-control': 'no-cache' });
        res.write(sse({ type: 'message_start', message: { id: 'msg_f', type: 'message', role: 'assistant', model: j.model, content: [], stop_reason: null, usage: { input_tokens: 6, output_tokens: 1 } } }));
        res.write(sse({ type: 'content_block_start', index: 0, content_block: { type: 'text', text: '' } }));
        ['hello', ' from the fixture'].forEach(t => res.write(sse({ type: 'content_block_delta', index: 0, delta: { type: 'text_delta', text: t } })));
        res.write(sse({ type: 'content_block_stop', index: 0 }));
        res.write(sse({ type: 'message_delta', delta: { stop_reason: 'end_turn', stop_sequence: null }, usage: { output_tokens: 4 } }));
        res.write(sse({ type: 'message_stop' }));
        return res.end();
      }
      const raw = JSON.stringify({ id: 'msg_f', type: 'message', role: 'assistant', model: j && j.model,
        content: [{ type: 'text', text: REPLY }], stop_reason: 'end_turn', stop_sequence: null, usage: { input_tokens: 6, output_tokens: 4 } });
      res.writeHead(200, { 'content-type': 'application/json' }); res.end(raw);
    });
  });
  await new Promise(r => srv.listen(0, '127.0.0.1', r));
  const was = process.env.RESPAN_ANTHROPIC_BASE_URL;
  process.env.RESPAN_ANTHROPIC_BASE_URL = 'http://127.0.0.1:' + srv.address().port;   // Anthropic's address, moved
  const ask = { model: 'claude-haiku-5-5', messages: [{ role: 'system', content: 'be brief' }, { role: 'user', content: 'hi' }], options: { num_predict: 16 } };
  try {
    const t = await C._t.address(KEY);
    ok('gateway: Claude requests go to the gateway on this PC, not to Anthropic', t.host === '127.0.0.1' && t.secure === false && t.path === '/v1/messages', JSON.stringify(t));
    ok('gateway: the gateway carries the key, so the caller sends none of its own', t.key === 'unused', t.key);
    /* the app's own path: cloud.once() → the gateway → the provider */
    const reply = await new Promise(r => C.once(ask, r, KEY));
    ok('gateway: a Claude reply comes back through the gateway', reply && reply.message && reply.message.content === REPLY && reply.done === true, JSON.stringify(reply).slice(0, 200));
    const first = seen[seen.length - 1] || {};
    ok('gateway: the request reached the provider in the Anthropic shape the app writes', first.path === '/v1/messages' && first.model === 'claude-haiku-5-5' && first.fallbacks === false, JSON.stringify(first));
    ok('gateway: the provider sees the real key from the gateway, never a placeholder', /^sk-ant-api03-fixture/.test(first.key), first.key.slice(0, 12));
    /* a model with Anthropic's server-side fallback keeps its beta header, which the gateway passes on */
    const son = await new Promise(r => C.once({ model: 'claude-sonnet-5-5', messages: [{ role: 'user', content: 'hi' }] }, r, KEY));
    const s2 = seen[seen.length - 1] || {};
    ok('gateway: the server-side fallback still reaches the provider', !!son.message && s2.fallbacks === true && s2.beta === 'server-side-fallback-2026-07-01', JSON.stringify(s2));
    /* streaming, which is how the chat window reads Claude */
    let out = '';
    const res = { headersSent: false, writeHead() { this.headersSent = true; }, write(t) { out += t; }, end() { this.ended = true; }, on() { } };
    await new Promise(r => { C.streamTo(Object.assign({ stream: true }, ask), res, KEY); const wait = setInterval(() => { if (res.ended) { clearInterval(wait); r(); } }, 50); setTimeout(() => { clearInterval(wait); r(); }, 20000); });
    const lines = out.split('\n').filter(Boolean).map(l => { try { return JSON.parse(l); } catch (e) { return null; } }).filter(Boolean);
    ok('gateway: a streamed reply arrives as the app reads it', lines.some(l => l.message && l.message.content === 'hello') && lines.some(l => l.done === true) && !lines.some(l => l.error), out.slice(0, 200));
    ok('gateway: the streamed request also went through the gateway', (seen[seen.length - 1] || {}).stream === true, JSON.stringify(seen[seen.length - 1] || {}));
    /* and without the gateway the address is Anthropic's own, so the app keeps working if it is not installed */
    const start = GW.start, addr = GW.address;
    GW.start = () => Promise.reject(new Error('not installed')); GW.address = () => '';
    let direct = null; try { direct = await C._t.address(KEY); } finally { GW.start = start; GW.address = addr; }
    ok('gateway: with no gateway the app still talks to Anthropic itself', direct && direct.host === 'api.anthropic.com' && direct.secure === true && direct.key === KEY, JSON.stringify(direct));
  } finally {
    GW.stop();
    if (was === undefined) delete process.env.RESPAN_ANTHROPIC_BASE_URL; else process.env.RESPAN_ANTHROPIC_BASE_URL = was;
    await new Promise(r => srv.close(r));
  }
};

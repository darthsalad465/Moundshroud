// Verifies true standalone zero-localhost mode:
//   desktop/inprocess-bridge.js + server.js (MOUNDSHROUD_EMBEDDED=1) on app://moundshroud/
//   with ZERO TCP ports opened, covering static files, byte ranges, JSON POSTs, CSP, lib origin, and Host security.
const path = require('path');
const { dispatchToHandler } = require('../desktop/inprocess-bridge');

module.exports = async ok => {
  const prevEmb = process.env.MOUNDSHROUD_EMBEDDED;
  process.env.MOUNDSHROUD_EMBEDDED = '1';
  const srvPath = require.resolve('../server.js');
  delete require.cache[srvPath];
  const embedded = require('../server.js');
  if (prevEmb === undefined) delete process.env.MOUNDSHROUD_EMBEDDED;
  else process.env.MOUNDSHROUD_EMBEDDED = prevEmb;

  ok('standalone: server.js exports in-process handlers without listening',
    typeof embedded.handleAppRequest === 'function' &&
    typeof embedded.handleLibRequest === 'function' &&
    typeof embedded.startBackground === 'function' &&
    typeof embedded.shutdown === 'function');

  // 1. Root HTML page via app://moundshroud/
  const rHome = await dispatchToHandler(embedded.handleAppRequest, new Request('app://moundshroud/'));
  const html = await rHome.text();
  ok('standalone: GET app://moundshroud/ serves index.html (200)', rHome.status === 200 && /<!doctype html>/i.test(html) && /Moundshroud/i.test(html), 'status=' + rHome.status);
  ok('standalone: CSP allows app://moundshroud-lib frame origin', /app:\/\/moundshroud-lib/.test(rHome.headers.get('content-security-policy') || ''));

  // 2. Static JS asset
  const rJs = await dispatchToHandler(embedded.handleAppRequest, new Request('app://moundshroud/web/js/micro.js'));
  const jsTxt = await rJs.text();
  ok('standalone: GET /web/js/micro.js serves JS cleanly', rJs.status === 200 && /A\.micro/.test(jsTxt), 'status=' + rJs.status);

  // 3. Byte range request (206)
  const rRange = await dispatchToHandler(embedded.handleAppRequest, new Request('app://moundshroud/web/index.html', { headers: { Range: 'bytes=0-14' } }));
  const rangeTxt = await rRange.text();
  ok('standalone: byte-range request returns 206 Partial Content', rRange.status === 206 && rangeTxt.length === 15, 'status=' + rRange.status + ' len=' + rangeTxt.length);

  // 4. GET JSON API (/api/ping)
  const rPing = await dispatchToHandler(embedded.handleAppRequest, new Request('app://moundshroud/api/ping'));
  const pingJson = await rPing.json();
  ok('standalone: GET /api/ping returns ok:true JSON', rPing.status === 200 && pingJson.ok === true, JSON.stringify(pingJson));

  // 5. POST JSON API with streaming body (/api/micro/jq)
  const rPost = await dispatchToHandler(embedded.handleAppRequest, new Request('app://moundshroud/api/micro/jq', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Origin: 'app://moundshroud' },
    body: JSON.stringify({ input: '{"nums":[2,3,5]}', filter: '.nums | add' })
  }));
  const postJson = await rPost.json();
  ok('standalone: POST /api/micro/jq reads request body and answers JSON', rPost.status === 200 && postJson.ok && postJson.output.trim() === '10', JSON.stringify(postJson));

  const bridge = require('../lib/openai-bridge');
  const originalChat = bridge.chat;
  try {
    // Inspect what the actual route passes to a provider without opening a socket.
    bridge.chat = (payload, res) => res.end(JSON.stringify(payload));
    const sent = {
      model: 'lms:chat-test', stream: true, think: false, keep_alive: '3m',
      tools: [{ type: 'image_generation' }], tool_choice: 'required', modalities: ['text', 'image'],
      messages: [
        { role: 'system', content: 'Reply in text' },
        { role: 'user', content: 'Read my attachment', images: ['photo-base64'] },
        { role: 'assistant', content: 'A text reply', tool_calls: [{ function: { name: 'make_image' } }] },
        { role: 'tool', content: 'Fake tool output' }
      ]
    };
    const post = (suffix, value) => dispatchToHandler(embedded.handleAppRequest, new Request('app://moundshroud/api/chat' + suffix, {
      method: 'POST', body: JSON.stringify(value)
    }));
    const main = await (await post('?surface=main', sent)).json();
    const other = await (await post('', sent)).json();
    const media = await post('?surface=main', { ...sent, model: 'any:picture' });
    ok('standalone: Main Chat routes plain messages and image attachments without provider tools',
      main.model === sent.model && main.stream && main.think === false && main.messages.length === 3 &&
      main.messages[1].images[0] === 'photo-base64' && !main.messages[2].tool_calls &&
      !main.tools && !main.tool_choice && !main.modalities && media.status === 400);
    ok('standalone: other chat surfaces still receive their tool definitions and history',
      other.tools?.length === 1 && other.messages[2].tool_calls?.length === 1 && other.messages[3].role === 'tool');
  } finally {
    bridge.chat = originalChat;
  }

  // 6. Isolated library origin (app://moundshroud-lib/__bridge.js)
  const rLib = await dispatchToHandler(embedded.handleLibRequest, new Request('app://moundshroud-lib/__bridge.js'));
  const libJs = await rLib.text();
  ok('standalone: app://moundshroud-lib serves __bridge.js with app:// frame-ancestors',
    rLib.status === 200 && /postMessage/.test(libJs) && /frame-ancestors app:\/\/moundshroud/.test(rLib.headers.get('content-security-policy') || ''),
    'status=' + rLib.status);

  // 7. Security: spoofed host / cross-origin blocked (403)
  const rBad = await dispatchToHandler(embedded.handleAppRequest, new Request('app://evil.example/api/ping'));
  ok('standalone: unknown host is refused with 403', rBad.status === 403, 'status=' + rBad.status);

  const rBadOrg = await dispatchToHandler(embedded.handleAppRequest, new Request('app://moundshroud/api/ping', { headers: { Origin: 'https://evil.example' } }));
  ok('standalone: cross-origin request is refused with 403', rBadOrg.status === 403, 'status=' + rBadOrg.status);

  // 8. Clean in-process shutdown (must not call process.exit)
  embedded.shutdown();
  ok('standalone: embedded.shutdown() completes cleanly without exiting host process', true);
};

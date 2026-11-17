// Free frontier AI (lib/freeroute.js): the pool of free routes, and what happens when one of them hits its limit.
// This is the part that has to be right, because it is what makes free use feel unlimited: a rate-limited or broken
// route must cost nothing and the next one must answer. The network is faked here; the live routes are checked by
// hand in the app (/api/free/test asks every one of them).
const path = require('path'), fs = require('fs');

module.exports = async function (ok) {
  console.log('free frontier ai');
  const root = path.join(__dirname, '..'), rd = f => fs.readFileSync(path.join(root, f), 'utf8');
  const R = require('../lib/freeroute.js');

  /* ---------- the pool ---------- */
  ok('free ai: the keyless pool has several routes, so one limit does not stop the app', R.KEYLESS.length >= 3, R.KEYLESS.length);
  ok('free ai: the quick model is tried first and no route needs a key', R.KEYLESS[0].id === 'ovh-gptoss' && R.KEYLESS.every(r => /^https:\/\//.test(r.url) && r.model), R.KEYLESS.map(r => r.id).join(','));
  ok('free ai: every route has a name and a model the endpoint serves', R.KEYLESS.every(r => r.name.length > 3 && r.model.length > 3 && r.note));

  /* ---------- what a failure means ---------- */
  const c429 = R.classify(429, ''), c402 = R.classify(402, ''), c500 = R.classify(503, ''), c200 = R.classify(200, '');
  ok('free ai: a rate limit rests that route for a short while and then tries the next', c429.retry && c429.rest <= 60000 && /limit/.test(c429.why), JSON.stringify(c429));
  ok('free ai: a 402 (the free reply allowance) is treated as a limit, not as a broken route', c402.rest === 45000 && c402.retry, JSON.stringify(c402));
  ok('free ai: a server having trouble is retried soon', c500.rest === 120000, JSON.stringify(c500));
  ok('free ai: a 200 is simply fine', c200.ok === true && !c200.retry);

  /* ---------- reading an answer ---------- */
  const m1 = R.messageOf({ choices: [{ message: { content: 'Hello.' } }] });
  ok('free ai: plain text comes back as the answer', m1 && m1.content === 'Hello.');
  const m2 = R.messageOf({ choices: [{ message: { content: [{ type: 'text', text: 'Part ' }, { type: 'text', text: 'two.' }] } }] });
  ok('free ai: a split answer is joined into one', m2.content === 'Part two.', m2 && m2.content);
  const m3 = R.messageOf({ choices: [{ message: { content: '', reasoning: 'The user wants a greeting. I should say hello.' } }] });
  ok('free ai: a model that only thought and never answered is not shown as if it had', m3 === null);
  const m4 = R.messageOf({ choices: [{ message: { content: '', tool_calls: [{ function: { name: 'open_tab', arguments: '{"tab":"faith"}' } }] } }] });
  ok('free ai: a tool call is kept, with its arguments read into an object', m4 && m4.tool_calls[0].function.name === 'open_tab' && m4.tool_calls[0].function.arguments.tab === 'faith', JSON.stringify(m4));

  /* ---------- the request shape ---------- */
  const s = R.shape({ messages: [{ role: 'system', content: 'Be brief.' }, { role: 'user', content: 'Hi' }], options: { num_predict: 300 } });
  ok('free ai: the system prompt stays inside the messages (some free endpoints ignore a top-level one)', s.messages[0].role === 'system' && s.messages[1].content === 'Hi');
  ok('free ai: a reasoning model is given room to think or it answers with nothing', s.max_tokens >= 2048, String(s.max_tokens));
  const big = R.shape({ messages: [{ role: 'user', content: 'Write a whole game.' }], options: { num_predict: 32000 } });
  ok('free ai: a big request is no longer cut down to 8,192 tokens, so a long game can be written in one go', big.max_tokens === 32000, String(big.max_tokens));
  const mid = R.shape({ messages: [{ role: 'user', content: 'Write a game.' }], options: { num_predict: 7000 } });
  ok('free ai: the old 7,000-token game cap now passes through with room to spare', mid.max_tokens >= 7000, String(mid.max_tokens));
  ok('free ai: the ceiling the free endpoints accept is respected, not doubled past it', R.shape({ messages: [{ role: 'user', content: 'x' }], options: { num_predict: 99999 } }).max_tokens === 32000);
  const sjson = R.shape({ messages: [{ role: 'user', content: 'Give JSON' }], format: 'json' });
  ok('free ai: asking for JSON adds the JSON-only instruction', sjson.messages.some(m => /single JSON object/.test(m.content)));

  /* ---------- failover: the point of the whole file ---------- */
  const routes = [
    { id: 'a', name: 'Route A', model: 'a-1' },
    { id: 'b', name: 'Route B', model: 'b-1' },
    { id: 'c', name: 'Route C', model: 'c-1' }
  ];
  R._test.reset();
  R._test.setPool(() => routes);
  const calls = [];
  R._test.setSend((route, req, cb) => {
    calls.push(route.id);
    if (route.id === 'a') return setTimeout(() => cb({ status: 429, error: 'its free limit is used up for the moment (429)', klass: { retry: true, rest: 20000 } }), 5);
    if (route.id === 'b') return setTimeout(() => cb({ status: 503, error: 'the route is having trouble (503)', klass: { retry: true, rest: 120000 } }), 5);
    setTimeout(() => cb(null, { model: 'c-1', message: { role: 'assistant', content: 'Answered by C.' }, done: true }), 5);
  });
  const first = await new Promise(resolve => R.once({ messages: [{ role: 'user', content: 'Hello' }] }, (err, res) => resolve({ err, res })));
  ok('free ai: when a route is rate limited and the next is broken, the third one answers', first.res && first.res.message.content === 'Answered by C.', JSON.stringify(first.err || first.res && first.res.message));
  ok('free ai: the routes were tried in order and no more than needed', calls.join(',') === 'a,b,c', calls.join(','));
  ok('free ai: the answer says which free route produced it', first.res && first.res.free && first.res.free.route === 'c', JSON.stringify(first.res && first.res.free));
  ok('free ai: the two routes that failed are resting, with the reason kept for the settings panel', R.health.a && R.health.a.until > Date.now() && /limit/.test(R.health.a.lastError) && R.health.b.until > Date.now() && R.health.c.ok === true);

  /* the next question skips the resting ones without even asking them */
  calls.length = 0;
  const second = await new Promise(resolve => R.once({ messages: [{ role: 'user', content: 'Again' }] }, (err, res) => resolve(res)));
  ok('free ai: a resting route is not asked again, and a working one answers at once', calls.join(',') === 'c' && second.message.content === 'Answered by C.', calls.join(','));

  /* everything down: a clear error, not a hang or a silent nothing */
  R._test.reset();
  const down = [{ id: 'x', name: 'Route X', model: 'x-1' }, { id: 'y', name: 'Route Y', model: 'y-1' }];
  R._test.setPool(() => down);
  R._test.setSend((route, req, cb) => setTimeout(() => cb({ status: 500, error: 'the route is having trouble (500)', klass: { retry: true, rest: 1000 } }), 2));
  const none = await new Promise(resolve => R.once({ messages: [{ role: 'user', content: 'Hello' }] }, (err, res) => resolve({ err, res })));
  ok('free ai: when no route answers, the error names what was tried instead of pretending', !none.res && /No free route answered/.test(none.err.error) && none.err.tried.length === 2, JSON.stringify(none.err));
  R._test.reset();

  /* ---------- the panel ---------- */
  const st = R.status();
  ok('free ai: the settings panel can list every route and how many answered today', Array.isArray(st.routes) && st.routes.length === R.KEYLESS.length && st.routes.every(r => typeof r.usedToday === 'number' && typeof r.awake === 'boolean'));
  ok('free ai: the panel says plainly that free routes are rate limited', /rate limited/i.test(st.limit) && !/unlimited (free|use)/i.test(st.limit), st.limit);

  /* ---------- it is wired into the app ---------- */
  const server = rd('server.js'), settings = rd('web/js/settings.js'), chat = rd('web/js/chat.js');
  ok('free ai: the chat offers "✦ Free frontier · auto" with no key and no setup', /free-auto/.test(server) && /Free frontier · auto/.test(server));
  ok('free ai: a chat request for it goes through the pool, and the local model answers if every route is down', /freeRoute\.once/.test(server) && /freeRoute\.stream/.test(server) && /localModelName\(\)/.test(server.slice(server.indexOf("b.model === 'free-auto'"), server.indexOf("b.model === 'free-auto'") + 1400)));
  ok('free ai: the settings panel shows the routes and can test them', /frbox/.test(settings) && /\/api\/free\/status/.test(settings) && /\/api\/free\/test/.test(settings));
  ok('free ai: the chat model list shows whatever the server offers, so the free pool appears there', /m\.cloud \? \(m\.label \|\| m\.name\)/.test(chat));
};

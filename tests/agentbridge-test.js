// The free-agent bridge (lib/agentbridge.js): the door the in-app harnesses (Claude Code and jcode) talk to when the
// chosen model is the free pool. Claude Code speaks the Anthropic Messages API, jcode speaks OpenAI's; both are
// translated here, and everything the shape of an agent turn needs (tool calls and tool results) must survive the
// trip or the agent cannot act. The pool itself is faked in this test; the real models are checked by hand in the app.
const http = require('http'), path = require('path'), fs = require('fs');

module.exports = async function (ok) {
  console.log('free-agent bridge');
  const root = path.join(__dirname, '..'), rd = f => fs.readFileSync(path.join(root, f), 'utf8');
  const R = require('../lib/freeroute.js'), B = require('../lib/agentbridge.js');

  /* ---------- an Anthropic turn, read for the pool ---------- */
  const a = B.fromAnthropic({
    model: 'free-agent', max_tokens: 512,
    system: [{ type: 'text', text: 'You are careful.' }],
    tools: [{ name: 'read_file', description: 'Read a file', input_schema: { type: 'object', properties: { p: { type: 'string' } } } }],
    messages: [
      { role: 'user', content: [{ type: 'text', text: 'Read notes.txt' }] },
      { role: 'assistant', content: [{ type: 'text', text: 'Reading it.' }, { type: 'tool_use', id: 'toolu_1', name: 'read_file', input: { p: 'notes.txt' } }] },
      { role: 'user', content: [{ type: 'tool_result', tool_use_id: 'toolu_1', content: 'hello' }, { type: 'text', text: 'and now?' }] },
      { role: 'user', content: [{ type: 'tool_result', tool_use_id: 'toolu_2', content: [{ type: 'text', text: 'part two' }] }] }
    ]
  });
  ok('bridge: the system prompt becomes a system message', a.messages[0].role === 'system' && a.messages[0].content === 'You are careful.');
  const asst = a.messages.find(m => m.role === 'assistant');
  ok('bridge: a tool call the model made last turn is kept, with its arguments', asst && asst.tool_calls && asst.tool_calls[0].function.name === 'read_file' && JSON.parse(asst.tool_calls[0].function.arguments).p === 'notes.txt', JSON.stringify(asst));
  const toolMsgs = a.messages.filter(m => m.role === 'tool');
  ok('bridge: a tool result comes back as its own tool message, tied to the call', toolMsgs.length === 2 && toolMsgs[0].tool_call_id === 'toolu_1' && toolMsgs[0].content === 'hello', JSON.stringify(toolMsgs));
  ok('bridge: a tool result split into parts is joined', toolMsgs[1] && toolMsgs[1].content === 'part two');
  ok('bridge: the tools Claude Code sends are offered to the free model in the pool\'s shape', a.tools && a.tools[0].type === 'function' && a.tools[0].function.name === 'read_file' && a.tools[0].function.parameters.properties.p);
  ok('bridge: the room the harness asked for is passed on', a.max_tokens === 512);

  /* ---------- the pool's answer, written back as an Anthropic message ---------- */
  const am = B.toAnthropic({ message: { role: 'assistant', content: 'Done.', tool_calls: [{ function: { name: 'read_file', arguments: '{"p":"a.txt"}' } }] }, usage: { prompt_tokens: 12, completion_tokens: 5 } }, 'free-agent');
  ok('bridge: an answer with a tool call becomes a tool_use block and says the turn is a tool turn', am.content[0].type === 'text' && am.content[1].type === 'tool_use' && am.stop_reason === 'tool_use');
  ok('bridge: every tool call gets an id of its own', /^toolu_[0-9a-f]+$/.test(am.content[1].id) && am.content[1].input.p === 'a.txt');
  ok('bridge: the usage numbers are carried over', am.usage.input_tokens === 12 && am.usage.output_tokens === 5);
  const am2 = B.toAnthropic({ message: { role: 'assistant', content: 'Hi.' } }, 'free-agent');
  ok('bridge: a plain answer ends the turn', am2.stop_reason === 'end_turn' && am2.content.length === 1);
  const am3 = B.toAnthropic({ message: { role: 'assistant', content: '' } }, 'free-agent');
  ok('bridge: an empty answer is still a valid message, never a crash', am3.content[0].type === 'text' && am3.content[0].text === '');

  /* ---------- the same answer for jcode ---------- */
  const ol = B.toOllama({ message: { role: 'assistant', content: '', tool_calls: [{ function: { name: 'bash', arguments: '{"cmd":"dir"}' } }] }, usage: { prompt_tokens: 7, completion_tokens: 3 } }, 'free-agent');
  ok('bridge: jcode is told the turn finished, with the tool call as an object', ol.done === true && ol.message.tool_calls[0].function.name === 'bash' && ol.message.tool_calls[0].function.arguments.cmd === 'dir', JSON.stringify(ol));
  const op = B.toOpenAI({ message: { role: 'assistant', content: 'Two.' } }, 'free-agent');
  ok('bridge: an OpenAI answer says why it stopped', op.choices[0].finish_reason === 'stop' && op.choices[0].message.content === 'Two.' && op.object === 'chat.completion');
  const ot = B.toOpenAI({ message: { role: 'assistant', content: '', tool_calls: [{ function: { name: 'bash', arguments: { cmd: 'dir' } } }] } }, 'free-agent');
  ok('bridge: an OpenAI tool call is marked as such, with its arguments as text', ot.choices[0].finish_reason === 'tool_calls' && ot.choices[0].message.tool_calls[0].function.arguments === '{"cmd":"dir"}');

  /* ---------- the pretend Ollama answers the harnesses ask about the model ---------- */
  R._test.reset();
  R._test.setPool(() => [{ id: 'fake', name: 'Fake route', model: 'fake-1' }]);
  R._test.setSend((route, req, cb) => setTimeout(() => cb(null, { model: 'fake-1', message: { role: 'assistant', content: 'READY' }, usage: { prompt_tokens: 9, completion_tokens: 2 }, free: { route: 'fake' } }), 5));
  const url = await B.ensure();
  ok('bridge: it listens only on this PC', /^http:\/\/127\.0\.0\.1:\d+$/.test(url), url);

  const call = (p, body, method) => new Promise(resolve => {
    const u = new URL(url + p), data = body == null ? '' : JSON.stringify(body);
    const r = http.request({ hostname: u.hostname, port: u.port, path: u.pathname, method: method || (body == null ? 'GET' : 'POST'), headers: { 'content-type': 'application/json', 'content-length': Buffer.byteLength(data) } },
      s => { let b = ''; s.setEncoding('utf8'); s.on('data', d => b += d); s.on('end', () => resolve({ status: s.statusCode, type: s.headers['content-type'] || '', body: b })); });
    r.on('error', e => resolve({ status: 0, body: e.message }));
    r.end(data);
  });
  const parse = r => { try { return JSON.parse(r.body); } catch (e) { return null; } };

  const tags = parse(await call('/api/tags'));
  ok('bridge: the harness sees the free model listed, so it starts without a download', tags && tags.models[0].name === 'free-agent', JSON.stringify(tags).slice(0, 120));
  const show = parse(await call('/api/show', { model: 'free-agent' }));
  ok('bridge: the model is described as able to use tools', show && show.capabilities.includes('tools'));
  ok('bridge: the pretend Ollama reports a version', !!(parse(await call('/api/version')) || {}).version);

  const msg = await call('/v1/messages', { model: 'free-agent', max_tokens: 200, messages: [{ role: 'user', content: 'Say READY.' }] });
  const mj = parse(msg);
  ok('bridge: a plain Anthropic request is answered by the free pool', msg.status === 200 && mj.type === 'message' && mj.content[0].text === 'READY', msg.body.slice(0, 160));
  ok('bridge: the answer is labelled as the free model, not as a local one', mj.model === 'free-agent');

  const stream = await call('/v1/messages', { model: 'free-agent', max_tokens: 200, stream: true, messages: [{ role: 'user', content: 'Say READY.' }] });
  const events = (stream.body.match(/^event: (\w+)/gm) || []).map(s => s.replace('event: ', ''));
  ok('bridge: Claude Code\'s streaming gets the whole opening-to-closing sequence', events[0] === 'message_start' && events.includes('content_block_delta') && events[events.length - 1] === 'message_stop', events.join(','));
  ok('bridge: the streamed text is the answer', /"text":"READY"/.test(stream.body));

  const chat = await call('/api/chat', { model: 'free-agent', stream: false, messages: [{ role: 'user', content: 'Say READY.' }] });
  const cj = parse(chat);
  ok('bridge: the Ollama chat route answers with done and the text', chat.status === 200 && cj.done === true && cj.message.content === 'READY', chat.body.slice(0, 160));
  const nd = await call('/api/chat', { model: 'free-agent', stream: true, messages: [{ role: 'user', content: 'Say READY.' }] });
  const lines = nd.body.trim().split('\n').map(l => { try { return JSON.parse(l); } catch (e) { return null; } }).filter(Boolean);
  ok('bridge: its streaming route ends with a done line', lines.length >= 2 && lines[lines.length - 1].done === true, nd.body.slice(0, 160));

  const oa = await call('/v1/chat/completions', { model: 'free-agent', messages: [{ role: 'user', content: 'Say READY.' }] });
  ok('bridge: jcode\'s OpenAI route answers too', oa.status === 200 && parse(oa).choices[0].message.content === 'READY', oa.body.slice(0, 160));
  const oas = await call('/v1/chat/completions', { model: 'free-agent', stream: true, messages: [{ role: 'user', content: 'Say READY.' }] });
  ok('bridge: its streaming route closes with [DONE]', /data: \[DONE\]/.test(oas.body) && /"finish_reason":"stop"/.test(oas.body));
  const ct = parse(await call('/v1/messages/count_tokens', { messages: [{ role: 'user', content: 'hello there friend' }] }));
  ok('bridge: the token counter Claude Code calls first answers a number', ct && ct.input_tokens > 0, JSON.stringify(ct));

  /* a route that is down must reach the harness as an error, not as a fake answer */
  R._test.setSend((route, req, cb) => setTimeout(() => cb({ status: 503, error: 'the route is having trouble (503)', klass: { retry: true, rest: 1000 } }), 5));
  const bad = await call('/v1/chat/completions', { model: 'free-agent', messages: [{ role: 'user', content: 'x' }] });
  ok('bridge: when no free route answers, the harness is told so instead of getting empty text', bad.status >= 400 && !!parse(bad).error, bad.status + ' ' + bad.body.slice(0, 80));
  R._test.reset();
  B.stop();

  /* ---------- the harnesses are pointed at it ---------- */
  const agent = require('../lib/agent.js');
  const free = agent.check({ model: 'free-agent' }, []);
  ok('agent: the free pool can be chosen even with Ollama asleep', free.ok && free.free === true && free.model === 'free-agent' && free.agentModel === 'free-agent', JSON.stringify(free));
  ok('agent: the free pool is offered first in the model list', agent.FREE_ENTRY.name === 'free-agent' && agent.FREE_ENTRY.tools === true && !!agent.FREE_ENTRY.label);
  const sleep = agent.check({ model: 'gemma4:e4b' }, []);
  ok('agent: an ordinary model still behaves as before', sleep.ok && sleep.agentModel === 'gemma4-agent' && !sleep.free);
  /* the console window must open with the harness and the model chosen in the app, never a fixed default */
  const termFree = await agent.launch('', { model: 'free-agent', harness: 'claude', dry: true }, []);
  ok('agent: the console window opens with the free model that was chosen, not a default', termFree.ok && termFree.free === true && termFree.model === 'free-agent' && termFree.harness === 'claude', JSON.stringify(termFree));
  const termLocal = await agent.launch('', { model: 'qwen3.5-2b-agent', harness: 'jcode', dry: true }, [{ name: 'qwen3.5-2b-agent', tools: true, maxCtx: 262144 }]);
  ok('agent: the console opens the harness that was chosen (jcode), with the chosen model', termLocal.ok && termLocal.harness === 'jcode' && termLocal.model === 'qwen3.5-2b-agent', JSON.stringify(termLocal));
  const termBad = await agent.launch('', { model: 'made-up:1b', dry: true }, [{ name: 'qwen3.5-2b-agent', tools: true }]);
  ok('agent: an unknown model is still refused before anything opens', !termBad.ok && !!termBad.error);
  /* the free window's launcher must be a working script: run it in check mode and read its settings back */
  const os2 = require('os'), path2 = require('path');
  const pdir = fs.mkdtempSync(path2.join(os2.tmpdir(), 'free-launcher-'));
  const pfile = path2.join(pdir, 'start-free-agent.ps1');
  fs.writeFileSync(pfile, agent.FREE_PS1, 'utf8');
  const pr = require('child_process').spawnSync('powershell.exe', ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', pfile, '-Bridge', 'http://127.0.0.1:5555', '-Ctx', '65536', '-Check'], { encoding: 'utf8', windowsHide: true });
  const pout = String(pr.stdout || '') + String(pr.stderr || '');
  ok('agent: the free console launcher runs and points Claude Code at the bridge', pr.status === 0 && /http:\/\/127\.0\.0\.1:5555/.test(pout) && /free-agent/.test(pout), pr.status + ' ' + pout.replace(/\s+/g, ' ').slice(0, 160));
  ok('agent: its reply budget follows the memory chosen in the app', /32768/.test(pout), pout.replace(/\s+/g, ' ').slice(0, 120));

  const hs = rd('lib/harness.js');
  ok('harness: Claude Code is given the bridge\'s address for the free model', /ANTHROPIC_BASE_URL: c\.free \? \(bridge\.url\(\)/.test(hs));
  ok('harness: the bridge is started before the harness is spawned', /if \(c\.free\)[\s\S]{0,160}await bridge\.ensure\(\)/.test(hs));
  ok('harness: nothing is prepared on this PC for the free model', /if \(c && c\.free\) return done\(\{ ok: true \}\)/.test(hs));
  const jc = rd('lib/harness-jcode.js');
  ok('harness: jcode is pointed at the bridge through its own provider profile', /openai-compatible/.test(jc) && /--provider-profile/.test(jc) && /'provider', 'add', '--overwrite'/.test(jc));
  ok('harness: jcode\'s profile is rewritten each session, so the address is always right', /bridge\.url\(\) \+ '\/v1'/.test(jc));
  ok('harness: jcode also waits for the bridge before it starts', /if \(c\.free\)[\s\S]{0,160}await bridge\.ensure\(\)/.test(jc));
  ok('server: the bridge is closed when the app closes', /agentbridge'\)\.stop\(\)/.test(rd('server.js')));

  /* ---------- either harness, either kind of model ---------- */
  const hs2 = require('../lib/harness.js');
  const freeEnv = hs2.envFor({ agentModel: 'free-agent', ctx: 32768, free: true }, {});
  ok('harness: the free model is served by the bridge, never by Ollama', !/11434/.test(freeEnv.ANTHROPIC_BASE_URL) && /^http:\/\/127\.0\.0\.1:\d+$/.test(freeEnv.ANTHROPIC_BASE_URL), freeEnv.ANTHROPIC_BASE_URL);
  const locEnv = hs2.envFor({ agentModel: 'qwen3.5-2b-agent', ctx: 32768 }, {});
  ok('harness: a model on this PC still goes to Ollama, with its agent copy as the model', locEnv.ANTHROPIC_BASE_URL === 'http://127.0.0.1:11434' && locEnv.ANTHROPIC_MODEL === 'qwen3.5-2b-agent');
  ok('harness: the memory chosen in the app is what the reply budget is sized from', locEnv.CLAUDE_CODE_MAX_OUTPUT_TOKENS === '16384', locEnv.CLAUDE_CODE_MAX_OUTPUT_TOKENS);
  const jc2 = require('../lib/harness-jcode.js');
  const jFree = jc2.argsFor({ agentModel: 'free-agent', free: true }), jLoc = jc2.argsFor({ agentModel: 'gemma4-agent' });
  ok('harness: jcode is sent to the bridge for the free model', jFree.join(' ').includes('openai-compatible') && jFree.join(' ').includes('moundshroud-free') && jFree.join(' ').includes('free-agent'));
  ok('harness: jcode talks to Ollama for a model on this PC, exactly as before', jLoc.join(' ') === 'acp --provider ollama -m gemma4-agent --no-selfdev', jLoc.join(' '));

  /* ---------- the pool itself must not drop a tool turn ---------- */
  const gm = rd('web/js/studio-games.js');
  ok('studio: the game maker no longer stops the model at 7,000 tokens', /MAX_NEW = 32000/.test(gm) && !/MAX_NEW = 7000/.test(gm));
  ok('studio: the free/online models are recognised from the model list, not only Claude', /const isOnline = m => \{ const x = MODELS\.find/.test(gm) && /MODELS = ms/.test(gm));
  ok('studio: a model on this PC keeps its old 7,000-token budget, so its context stays loadable', /LOCAL_CAP = 7000/.test(gm) && /budget = cloud \? cap : Math\.min\(cap, LOCAL_CAP\)/.test(gm) && /num_predict: budget/.test(gm));
  const gd = rd('web/js/studio-godot.js');
  ok('studio: the game engine tells an online model from one on this PC too', /const isOnline = m => \{ const x = MODELS\.find/.test(gd) && /budget = cloud \? cap : Math\.min\(cap, \d+\)/.test(gd));

  /* ---------- which requests go where (a model on this PC must never be sent to a cloud provider) ---------- */
  const cloud = require('../lib/cloud.js'), savedCfg = cloud.cfg();
  cloud.set({ provider: 'chutes-ai', model: 'deepseek-ai/DeepSeek-R1' });
  ok('routing: a provider model goes to that provider', cloud.isFreeProvider('deepseek-ai/DeepSeek-R1') === true);
  ok('routing: a model on this PC is never sent to the free provider, which is what left the studios hanging', cloud.isFreeProvider('Qwen3.5:2b') === false && cloud.isFreeProvider('smollm:latest') === false);
  ok('routing: the free pool keeps its own route', cloud.isFreeProvider('free-auto') === false);
  cloud.set({ provider: savedCfg.provider, model: savedCfg.model });
  ok('routing: a failed provider answer can be turned into an error instead of a request that never returns', /did not answer/.test(rd('server.js')) && /\.catch\(fail\)/.test(rd('server.js')));
  ok('routing: reading the provider list cannot throw and strand the caller', /typeof net\.on === 'function'/.test(rd('lib/freellm.js')) && /try \{ return await readProviders\(\)/.test(rd('lib/freellm.js')));

  const sh = R.shape({ messages: [
    { role: 'user', content: 'go' },
    { role: 'assistant', content: '', tool_calls: [{ id: 'c1', function: { name: 'bash', arguments: '{"cmd":"dir"}' } }] },
    { role: 'tool', tool_call_id: 'c1', content: 'a.txt' },
    { role: 'assistant', content: 'There is one file.' }
  ] });
  ok('free ai: a tool call and its result survive in the request sent to the free route', sh.messages[1].tool_calls && sh.messages[1].tool_calls[0].function.name === 'bash' && sh.messages[2].role === 'tool' && sh.messages[2].tool_call_id === 'c1', JSON.stringify(sh.messages));
  ok('free ai: two answers in a row are not glued together once a tool call is involved', sh.messages.length === 4, String(sh.messages.length));
};

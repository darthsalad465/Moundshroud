// The in-app agent harness: Claude Code runs hidden and the Agent tab shows the conversation. Tested with a fake
// process, so no model starts here: what is sent to Claude Code, how its stream becomes the events the page shows,
// and that a guarded command waits for the user's answer.
const path = require('path'), { EventEmitter } = require('events');

module.exports = async ok => {
  const eq = (name, got, want) => ok(name, got === want, 'got ' + JSON.stringify(got) + ', wanted ' + JSON.stringify(want));
  const H = require(path.join(__dirname, '..', 'lib', 'harness.js')), agent = require(path.join(__dirname, '..', 'lib', 'agent.js'));
  const sleep = ms => new Promise(r => setTimeout(r, ms));

  /* the command line */
  const c = { model: 'gemma4:e4b', agentModel: 'gemma4-agent', ctx: 32768, guard: agent.GUARD };
  const a = H.argsFor(c, {}), has = (k, v) => { const i = a.indexOf(k); return i >= 0 && (v === undefined || a[i + 1] === v); };
  ok('harness: Claude Code is run without a window, streaming both ways', has('-p') && has('--input-format', 'stream-json') && has('--output-format', 'stream-json') && a.includes('--include-partial-messages'), a.join(' '));
  ok('harness: questions about permission come to the app', has('--permission-prompt-tool', 'stdio'));
  ok('harness: it uses the chosen model and the same six tools', has('--model', 'gemma4-agent') && has('--tools', 'Read,Write,Edit,Glob,Grep,Bash') && a.includes('--bare'));
  ok('harness: whole-PC access loads the guard file', has('--settings', agent.GUARD));
  ok('harness: folder-only access loads no rule file', !H.argsFor({ ...c, guard: '' }, {}).includes('--settings'));
  ok('harness: nothing can switch the prompts off', !a.includes('--dangerously-skip-permissions') && !a.includes('bypassPermissions'));
  ok('harness: an earlier session is picked up by its id', (x => x[x.indexOf('--resume') + 1] === '11111111-2222-3333-4444-555555555555')(H.argsFor(c, { resume: '11111111-2222-3333-4444-555555555555' })));
  ok('harness: a session id that is not an id is ignored', !H.argsFor(c, { resume: 'x; calc' }).includes('--resume'));
  const env = H.envFor(c, {});
  ok('harness: Claude Code is pointed at Ollama on this PC', env.ANTHROPIC_BASE_URL === 'http://127.0.0.1:11434' && env.ANTHROPIC_MODEL === 'gemma4-agent' && env.CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC === '1');
  eq('harness: the longest reply is half the memory', env.CLAUDE_CODE_MAX_OUTPUT_TOKENS, '16384');
  ok('harness: self-tidying is set only for the 128k memory', env.CLAUDE_CODE_AUTO_COMPACT_WINDOW === undefined && H.envFor({ ...c, ctx: 131072 }, {}).CLAUDE_CODE_AUTO_COMPACT_WINDOW === '120000');

  /* a fake Claude Code process */
  const fake = () => { const p = new EventEmitter(); p.stdout = new EventEmitter(); p.stderr = new EventEmitter(); p.sent = []; p.stdin = { write: s => { p.sent.push(JSON.parse(s)); return true; }, end() { }, on() { } }; p.pid = 0; p.killed = false; p.kill = () => { p.killed = true; setTimeout(() => p.emit('close', 1), 1); }; p.out = o => p.stdout.emit('data', JSON.stringify(o) + '\n'); return p; };
  let proc = null;
  const h = H.create({ spawn: () => (proc = fake()), prepare: async () => ({ ok: true }), kill: p => p.kill(), askTimeoutMs: 60, save: () => { } });
  const st0 = h.state(0);
  ok('harness: with nothing started the page gets an empty conversation', !st0.running && st0.events.length === 0);
  ok('harness: a message before a session is refused', !h.send('hello').ok);
  const started = await h.start({ check: c, dir: 'C:\\proj' });
  ok('harness: a session starts', started.ok && h.state(0).running, JSON.stringify(started));
  const s1 = h.send('Make a file');
  ok('harness: a message goes to Claude Code as a user turn', s1.ok && proc.sent[0].type === 'user' && proc.sent[0].message.content[0].text === 'Make a file', JSON.stringify(proc.sent[0]));
  ok('harness: ...and the page shows it, with the agent marked busy', h.state(0).events.some(e => e.kind === 'user' && e.text === 'Make a file') && h.state(0).busy);
  ok('harness: a second message while it works is refused', !h.send('and another').ok);
  proc.out({ type: 'system', subtype: 'init', session_id: 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee' });
  proc.out({ type: 'stream_event', event: { type: 'content_block_delta', delta: { type: 'text_delta', text: 'Wor' } } });
  proc.out({ type: 'stream_event', event: { type: 'content_block_delta', delta: { type: 'text_delta', text: 'king' } } });
  eq('harness: words appear as they are written', h.state(0).live, 'Working');
  /* two lines arriving in one piece, and one line arriving in two pieces */
  const two = JSON.stringify({ type: 'assistant', message: { content: [{ type: 'thinking', thinking: 'hm' }, { type: 'text', text: 'Working on it.' }, { type: 'tool_use', id: 't1', name: 'Write', input: { file_path: 'a.txt', content: 'hi' } }] } }) + '\n' + JSON.stringify({ type: 'user', message: { content: [{ type: 'tool_result', tool_use_id: 't1', content: 'File created', is_error: false }] } });
  proc.stdout.emit('data', two.slice(0, 40)); proc.stdout.emit('data', two.slice(40) + '\n');
  let ev = h.state(0).events;
  ok('harness: a finished reply replaces the live text', h.state(0).live === '' && ev.some(e => e.kind === 'text' && e.text === 'Working on it.'));
  ok('harness: a tool use is shown with what it was given', ev.some(e => e.kind === 'tool' && e.name === 'Write' && e.input.file_path === 'a.txt'));
  ok('harness: ...and with what came back', ev.some(e => e.kind === 'result' && e.toolId === 't1' && e.text === 'File created' && e.isError === false));
  ok('harness: the model\'s private thinking is not shown as a reply', !ev.some(e => e.text === 'hm'));
  /* a guarded command */
  proc.out({ type: 'control_request', request_id: 'r1', request: { subtype: 'can_use_tool', tool_name: 'Bash', input: { command: 'curl example.com' }, description: 'curl example.com', tool_use_id: 't2' } });
  let st = h.state(0);
  ok('harness: a guarded command waits for an answer', st.pending.length === 1 && st.pending[0].id === 'r1' && st.pending[0].tool === 'Bash' && st.pending[0].input.command === 'curl example.com' && !proc.sent.some(x => x.type === 'control_response'));
  ok('harness: an answer for something that was not asked is refused', !h.answer('nope', true).ok);
  h.answer('r1', true);
  const resp = proc.sent.find(x => x.type === 'control_response');
  ok('harness: Allow lets exactly that command run', resp && resp.response.request_id === 'r1' && resp.response.response.behavior === 'allow' && resp.response.response.updatedInput.command === 'curl example.com' && h.state(0).pending.length === 0, JSON.stringify(resp));
  proc.out({ type: 'control_request', request_id: 'r2', request: { subtype: 'can_use_tool', tool_name: 'Bash', input: { command: 'rm x' } } });
  h.answer('r2', false);
  ok('harness: Refuse stops it', proc.sent.filter(x => x.type === 'control_response')[1].response.response.behavior === 'deny');
  proc.out({ type: 'control_request', request_id: 'r3', request: { subtype: 'can_use_tool', tool_name: 'Bash', input: { command: 'del y' } } });
  await sleep(120);
  ok('harness: a question nobody answers is refused when its time runs out', proc.sent.filter(x => x.type === 'control_response').length === 3 && proc.sent.filter(x => x.type === 'control_response')[2].response.response.behavior === 'deny' && h.state(0).pending.length === 0);
  proc.out({ type: 'result', subtype: 'success', session_id: 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee', result: 'Done.' });
  st = h.state(0);
  ok('harness: when the turn ends the agent is free again', !st.busy && st.sessionId === 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee' && st.events[st.events.length - 1].kind === 'done');
  const mid = st.seq, more = h.send('next');
  ok('harness: the page can ask for only what is new', more.ok && h.state(mid).events.length === 1 && h.state(mid).events[0].text === 'next');
  proc.stdout.emit('data', 'this is not json\n');
  ok('harness: a line that is not JSON does no harm', h.state(0).running);
  proc.out({ type: 'assistant', message: { content: [{ type: 'text', text: 'x'.repeat(300000) }] } });
  ok('harness: a very long reply is cut for the page', h.state(0).events.slice(-1)[0].text.length <= 60000);
  for (let i = 0; i < 700; i++) proc.out({ type: 'assistant', message: { content: [{ type: 'text', text: 'm' + i }] } });
  ok('harness: old events are dropped so memory stays bounded', h.state(0).events.length <= 500);
  /* stop, and the process ending by itself */
  h.stop(); await sleep(20);
  st = h.state(0);
  ok('harness: Stop ends the process and frees the agent', proc.killed && !st.running && !st.busy);
  ok('harness: ...and the session can be picked up again', st.sessionId === 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee');
  await h.start({ check: c, dir: 'C:\\proj' }); h.send('hi'); proc.emit('close', 3); await sleep(5);
  ok('harness: if Claude Code ends by itself the page is told', !h.state(0).running && h.state(0).events.some(e => e.kind === 'error'));
  const bad = H.create({ spawn: () => fake(), prepare: async () => ({ ok: false, error: 'Ollama did not start.' }), kill() { }, save() { } });
  const br = await bad.start({ check: c, dir: 'C:\\proj' });
  ok('harness: when the model cannot be made ready the session does not start', !br.ok && /Ollama/.test(br.error) && !bad.state(0).running);
};

// The local agent: which models it offers, the names it hands to the launcher, and the rule file that guards whole-PC access.
// A wrong rule here would let a small local model run a harmful command unasked, so the three tiers are checked by name.
const fs = require('fs'), path = require('path');

module.exports = async ok => {
  const agent = require(path.join(__dirname, '..', 'lib', 'agent.js'));
  const eq = (name, got, want) => ok(name, got === want, 'got ' + JSON.stringify(got) + ', wanted ' + JSON.stringify(want));

  /* the 32k-memory copy each model gets */
  eq('agent: Gemma keeps the copy it already has', agent.agentName('gemma4:e4b'), 'gemma4-agent');
  eq('agent: another model gets its own copy', agent.agentName('Qwen3.5:9b'), 'qwen3.5-9b-agent');
  eq('agent: a model from a namespace gets a plain name', agent.agentName('huihui_ai/qwen3.5-abliterated:9b'), 'huihui-ai-qwen3.5-abliterated-9b-agent');
  eq('agent: :latest is dropped from the copy name', agent.agentName('dolphin3:latest'), 'dolphin3-agent');

  /* the list the picker shows */
  const tags = [{ name: 'gemma4-agent:latest', size: 6 }, { name: 'gemma4:e4b', size: 6 }, { name: 'Qwen3.5:9b', size: 6 }, { name: 'qwen3.5-9b-agent:latest', size: 6 }, { name: 'dolphin3:latest', size: 4 }];
  const caps = { 'gemma4:e4b': ['completion', 'tools'], 'Qwen3.5:9b': ['completion', 'tools'], 'dolphin3:latest': ['completion'] };
  const list = agent.pickable(tags, caps);
  eq('agent: the picker hides the agent copies', list.map(m => m.name).join(','), 'gemma4:e4b,Qwen3.5:9b,dolphin3:latest');
  ok('agent: a model that can use tools is offered', list[1].tools === true);
  ok('agent: a model that cannot use tools is marked', list[2].tools === false);
  ok('agent: a copy that is already made is marked ready', list[1].ready === true && list[2].ready === false);

  /* what launch accepts */
  const bad = (name, opts) => { const r = agent.check(opts, list); ok('agent: refuses ' + name, !r.ok && !!r.error, JSON.stringify(r)); };
  bad('a model Ollama does not have', { model: 'made-up:1b' });
  bad('a model with command characters', { model: 'gemma4:e4b & calc' });
  bad('a model that cannot use tools', { model: 'dolphin3:latest' });
  const good = agent.check({ model: 'Qwen3.5:9b', guard: true }, list);
  ok('agent: accepts a model from the list', good.ok && good.model === 'Qwen3.5:9b' && good.agentModel === 'qwen3.5-9b-agent', JSON.stringify(good));
  ok('agent: guarded mode hands over the rule file', good.guard === agent.GUARD && fs.existsSync(agent.GUARD), String(good.guard));
  const plain = agent.check({}, list);
  ok('agent: with nothing chosen it is Gemma in one folder', plain.ok && plain.model === 'gemma4:e4b' && plain.guard === '', JSON.stringify(plain));

  /* review fixes: the folders the agent may never be pointed at, and a first start with Ollama still asleep */
  const sd = require(path.join(__dirname, '..', 'lib', 'safe-dir.js')), os = require('os');
  const tmpd = fs.mkdtempSync(path.join(os.tmpdir(), 'agent-dir-'));
  try {
    ok('folder: an ordinary folder is accepted', sd.check(tmpd).ok, JSON.stringify(sd.check(tmpd)));
    const refuse = (name, d) => { const r = sd.check(d); ok('folder: refuses ' + name, !r.ok && !!r.error, JSON.stringify(r)); };
    refuse('a relative folder', 'some\\folder');
    refuse('a folder that is not there', path.join(tmpd, 'missing'));
    refuse('command characters', tmpd + '&calc');
    refuse('a network path', '\\\\server\\share\\x');
    refuse('a drive root', path.parse(os.homedir()).root);
    refuse('the home folder itself', os.homedir());
    refuse('the app folder', path.join(__dirname, '..'));
    refuse('a folder inside the app', path.join(__dirname, '..', 'lib'));
    refuse('the agent\'s own folder', agent.DIR);
    refuse('the Windows folder', process.env.SystemRoot || 'C:\\Windows');
    if (process.env.APPDATA) refuse('the Startup folder', path.join(process.env.APPDATA, 'Microsoft', 'Windows', 'Start Menu', 'Programs', 'Startup'));
  } finally { fs.rmSync(tmpd, { recursive: true, force: true }); }
  const asleep = agent.check({}, []);
  ok('agent: with Ollama asleep the standard model can still be started', asleep.ok && asleep.model === agent.BASE && asleep.agentModel === 'gemma4-agent', JSON.stringify(asleep));
  ok('agent: ...but another model cannot, and the reason is Ollama', !agent.check({ model: 'Qwen3.5:9b' }, []).ok && /Ollama/.test(agent.check({ model: 'Qwen3.5:9b' }, []).error));
  { const g2 = JSON.parse(fs.readFileSync(agent.GUARD, 'utf8')).permissions;
    ok('guard: nothing that runs a program the agent wrote is allowed unasked', !g2.allow.some(r => /^Bash\((node|python|py|npm run|npx|bash|sh|cmd|powershell|pwsh) \*\)$/.test(r)), g2.allow.join(' '));
    ok('guard: checking a script for mistakes is still allowed', g2.allow.includes('Bash(node --check *)')); }

  /* the memory window: 32k is the default, larger ones get their own copy */
  eq('agent: a 64k memory gets its own copy', agent.agentName('gemma4:e4b', 65536), 'gemma4-agent-64k');
  eq('agent: a 128k memory gets its own copy', agent.agentName('Qwen3.5:9b', 131072), 'qwen3.5-9b-agent-128k');
  eq('agent: 32k keeps the plain name', agent.agentName('Qwen3.5:9b', 32768), 'qwen3.5-9b-agent');
  const withCtx = agent.pickable(tags.concat([{ name: 'gemma4-agent-64k:latest', size: 6 }]), caps, { 'gemma4:e4b': 131072, 'Qwen3.5:9b': 262144 });
  ok('agent: the picker hides the larger copies too', !withCtx.some(m => /agent/.test(m.name)), withCtx.map(m => m.name).join(','));
  eq('agent: each model reports the largest memory it supports', withCtx[0].maxCtx, 131072);
  const c64 = agent.check({ model: 'gemma4:e4b', ctx: 65536 }, withCtx);
  ok('agent: a supported memory size is accepted', c64.ok && c64.ctx === 65536 && c64.agentModel === 'gemma4-agent-64k', JSON.stringify(c64));
  ok('agent: an unknown memory size is refused', !agent.check({ model: 'gemma4:e4b', ctx: 50000 }, withCtx).ok);
  ok('agent: a memory size the model cannot hold is refused', !agent.check({ model: 'gemma4:e4b', ctx: 262144 }, withCtx).ok && !agent.CTX.includes(262144) || !agent.check({ model: 'dolphin3:latest', ctx: 131072 }, withCtx).ok);
  eq('agent: with no size chosen the memory is 32k', agent.check({}, withCtx).ctx, 32768);

  /* a headless step for a swarm: always guarded, and the prompt travels in a file, never on the command line */
  const ha = agent.headlessArgs(good, 'C:\\proj', 'C:\\tmp\\p.txt');
  eq('agent: a headless step is a PowerShell file run', ha.slice(0, 4).join(' '), '-NoProfile -ExecutionPolicy Bypass -File');
  ok('agent: ...of the launcher script', /start-gemma-agent\.ps1$/.test(ha[4]), ha[4]);
  const arg = k => ha[ha.indexOf(k) + 1];
  ok('agent: ...with the folder, the model and its copy', arg('-Dir') === 'C:\\proj' && arg('-Model') === 'Qwen3.5:9b' && arg('-AgentModel') === 'qwen3.5-9b-agent', ha.join(' '));
  eq('agent: a headless step is always guarded', arg('-Guard'), agent.GUARD);
  eq('agent: the prompt is handed over as a file', arg('-PromptFile'), 'C:\\tmp\\p.txt');
  ok('agent: a headless step with no guard is impossible', agent.headlessArgs({ ...good, guard: '' }, 'C:\\proj', 'C:\\tmp\\p.txt').includes(agent.GUARD));
  eq('agent: refused commands are picked out of the output', agent.refusals('ok\nPermission to use Bash with command rm -rf x has been denied.\nmore').length, 1);

  /* the rule file: three tiers */
  let g = null; try { g = JSON.parse(fs.readFileSync(agent.GUARD, 'utf8')); } catch (e) { }
  ok('guard: the rule file is valid JSON', !!g && !!g.permissions);
  const P = (g && g.permissions) || {}, allow = P.allow || [], ask = P.ask || [], deny = P.deny || [];
  ok('guard: all three tiers have rules', allow.length > 0 && ask.length > 0 && deny.length > 0);
  ok('guard: reading is allowed anywhere', ['Read', 'Glob', 'Grep'].every(t => allow.includes(t)));
  ok('guard: no blanket permission to run commands or edit', !allow.some(r => /^(Bash|Edit|Write|PowerShell)(\(\*\))?$/.test(r)), allow.join(' '));
  ok('guard: nothing skips the prompts', P.defaultMode !== 'bypassPermissions' && P.defaultMode !== 'dontAsk' && P.disableBypassPermissionsMode === 'disable');
  ok('guard: a rule sits in one tier only', !allow.some(r => ask.includes(r) || deny.includes(r)) && !ask.some(r => deny.includes(r)));
  for (const c of ['format', 'diskpart', 'bcdedit']) ok('guard: ' + c + ' is always refused', deny.includes('Bash(' + c + ' *)'));
  for (const d of ['//c/Windows/**', '//c/Program Files/**']) ok('guard: no edits under ' + d, deny.includes('Edit(' + d + ')'));
  for (const c of ['rm', 'del', 'curl', 'npm install', 'pip install', 'reg', 'node -e', 'python -c', 'powershell', 'cmd', 'git push']) ok('guard: asks before ' + c, ask.includes('Bash(' + c + ' *)'));
  ok('guard: every rule names a tool the agent has', allow.concat(ask, deny).every(r => /^(Read|Glob|Grep|Edit|Bash)(\(.+\))?$/.test(r)), allow.concat(ask, deny).filter(r => !/^(Read|Glob|Grep|Edit|Bash)(\(.+\))?$/.test(r)).join(' '));
};

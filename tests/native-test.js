// Moundshroud Code (lib/harness-native.js): the agent harness built into the app. Tested without a model and without
// running anything harmful: the policy is checked directly, and the tool loop is driven by a scripted "model".
const fs = require('fs'), os = require('os'), path = require('path');

module.exports = async ok => {
  const N = require(path.join(__dirname, '..', 'lib', 'harness-native.js'));

  /* ---- the command policy ---- */
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'mc-test-'));
  const J = (c, whole) => N.judge(c, dir, !!whole);
  ok('moundshroud code: listing and checking a file needs no question', ['dir', 'dir /b', 'git status', 'node --check app.js', 'type notes.txt', 'where node'].every(c => J(c).level === 'safe'), ['dir', 'git status', 'node --check app.js', 'type notes.txt', 'where node'].map(c => c + '=' + J(c).level).join(' '));
  ok('moundshroud code: anything else waits for the person', ['del notes.txt', 'npm install', 'git commit -m x', 'node app.js', 'move a.txt b.txt'].every(c => J(c).level === 'ask'));
  ok('moundshroud code: the destroying commands are refused outright, never asked', ['format c:', 'diskpart', 'bcdedit /set x y', 'shutdown /s /t 0', 'reg delete HKLM\\Software\\X /f', 'wevtutil cl System', 'vssadmin delete shadows /all', 'mkfs.ext4 /dev/sda'].every(c => J(c).level === 'deny'), ['format c:', 'diskpart', 'bcdedit', 'shutdown', 'reg delete', 'wevtutil', 'vssadmin', 'mkfs'].map(c => c + '=' + J(c).level).join(' '));
  ok('moundshroud code: a harmless command hiding a harmful one is judged by the harmful part', J('dir && format c:').level === 'deny' && J('dir; shutdown /r').level === 'deny' && J('type a.txt | reg delete HKLM\\X /f').level === 'deny');
  ok('moundshroud code: this app\'s own folder is never a place to write', J('del "' + path.join(__dirname, '..', 'server.js') + '"').level === 'deny');
  ok('moundshroud code: folder-only reach refuses a path outside the folder', J('type C:\\Windows\\win.ini').level === 'deny' && J('copy C:\\Users\\me\\secret.txt .').level === 'deny');
  ok('moundshroud code: folder-only reach refuses to climb out with two dots', J('type ..\\secret.txt').level === 'deny' && J('cd ..').level === 'deny');
  ok('moundshroud code: whole-PC reach may read those paths, but still cannot wipe Windows', J('type C:\\Windows\\win.ini', true).level !== 'deny' && J('del C:\\Windows\\System32\\x.dll', true).level === 'deny' && J('dir', true).level === 'safe');

  /* ---- the tool loop, driven by a scripted model ---- */
  const saved = [];
  const script = [
    { ok: true, text: 'I will write the file.', calls: [{ function: { name: 'write_file', arguments: { path: 'a.txt', content: 'hello' } } }] },
    { ok: true, text: 'Now let me try to escape.', calls: [{ function: { name: 'write_file', arguments: { path: '..\\escape.txt', content: 'x' } } }] },
    { ok: true, text: 'Checking a file quietly.', calls: [{ function: { name: 'run_command', arguments: { command: 'dir /b' } } }] },
    { ok: true, text: 'Asking for something that changes the PC.', calls: [{ function: { name: 'run_command', arguments: { command: 'del a.txt', why: 'clean up' } } }] },
    { ok: true, text: 'All done.', calls: [] },
  ];
  let n = 0;
  const H = N.create({ dataDir: dir, save: r => saved.push(r), prepare: async () => ({ ok: true }), ask: async () => script[Math.min(n++, script.length - 1)] });
  fs.writeFileSync(path.join(dir, 'a.txt'), 'old');
  const started = await H.start({ check: { model: 'm', agentModel: 'm', ctx: 32768, guard: false }, dir });
  ok('moundshroud code: a session starts without any outside program', started.ok && H.state(0).harness === 'native' && H.state(0).running);
  ok('moundshroud code: the session id matches what the session list keeps', /^session_[A-Za-z0-9_]{4,120}$/.test(H.state(0).sessionId), H.state(0).sessionId);
  ok('moundshroud code: a message is refused before a session is running (checked on a fresh copy)', (() => { const H2 = N.create({ ask: async () => script[0], prepare: async () => ({ ok: true }) }); return !H2.send('hi').ok; })());

  const wait = async ms => { const t0 = Date.now(); while (H.state(0).busy && Date.now() - t0 < ms) await new Promise(r => setTimeout(r, 10)); };
  H.send('make a file');
  /* the fourth step asks permission: answer it while the turn is waiting */
  for (let i = 0; i < 400 && H.state(0).busy; i++) {
    const st = H.state(0);
    if (st.pending.length) { H.answer(st.pending[0].id, true); }
    await new Promise(r => setTimeout(r, 10));
  }
  await wait(4000);
  const st = H.state(0), ev = st.events, results = ev.filter(e => e.kind === 'result').map(e => e.text);
  ok('moundshroud code: the turn ends by itself when the model stops asking', !st.busy && ev.some(e => e.kind === 'done'));
  ok('moundshroud code: a file the model asked to write is written in the session folder', results.some(t => /^Wrote .*a\.txt \(1 lines\)/.test(t)) || results.some(t => /^Wrote .*a\.txt/.test(t)), results[0]);
  ok('moundshroud code: a path outside the folder is refused and kept off the disk', results.some(t => /FAILED: .*outside/.test(t)) && !fs.existsSync(path.join(dir, '..', 'escape.txt')));
  ok('moundshroud code: a harmless command runs without a question', results.some(t => /^a\.txt/.test(t)));
  ok('moundshroud code: a changing command waits for the person and says it was allowed', ev.some(e => e.kind === 'ask' && e.tool === 'run_command') && ev.some(e => e.kind === 'answer' && e.allow === true));
  ok('moundshroud code: the approved command really ran', !fs.existsSync(path.join(dir, 'a.txt')));
  ok('moundshroud code: every tool step has its answer on the page', ev.filter(e => e.kind === 'tool').every(t => ev.some(r => r.kind === 'result' && r.toolId === t.toolId)));
  ok('moundshroud code: the conversation is saved under its own name', saved.length > 0 && saved[saved.length - 1].harness === 'native' && saved[saved.length - 1].id === st.sessionId);

  /* ---- a refusal, and nobody there to approve anything ---- */
  const dir2 = fs.mkdtempSync(path.join(os.tmpdir(), 'mc-test2-'));
  fs.writeFileSync(path.join(dir2, 'keep.txt'), 'x');
  const H3 = N.create({ dataDir: dir2, unattended: true, prepare: async () => ({ ok: true }), ask: async () => ({ ok: true, text: '', calls: [{ function: { name: 'run_command', arguments: { command: 'del keep.txt' } } }] }) });
  await H3.start({ check: { model: 'm', agentModel: 'm', ctx: 32768, guard: false }, dir: dir2 });
  H3.send('delete it');
  for (let i = 0; i < 400 && H3.state(0).busy; i++) await new Promise(r => setTimeout(r, 10));
  const st3 = H3.state(0);
  ok('moundshroud code: with nobody there, a command is refused and the file is untouched', fs.existsSync(path.join(dir2, 'keep.txt')) && st3.events.some(e => e.kind === 'answer' && e.allow === false && e.unattended));

  /* ---- a tool call must go back to the model as an object, and a model that goes quiet must still answer ---- */
  const dirR = fs.mkdtempSync(path.join(os.tmpdir(), 'mc-test9-'));
  fs.writeFileSync(path.join(dirR, 'a.txt'), 'x'); fs.writeFileSync(path.join(dirR, 'b.txt'), 'y');
  const sentR = [], toolSetsR = [];
  const scriptR = [
    { ok: true, text: '', calls: [{ function: { name: 'list_files', arguments: '{}' } }] },   // a real model sends its arguments as JSON text
    { ok: true, text: '', calls: [] },                                                       // silence after the tool result
    { ok: true, text: '', calls: [] },                                                       // silence again
    { ok: true, text: 'The folder has a.txt and b.txt.', calls: [] },
  ];
  let nR = 0;
  const HR = N.create({ dataDir: dirR, prepare: async () => ({ ok: true }), ask: async (msgs, tools) => { sentR.push(JSON.parse(JSON.stringify(msgs))); toolSetsR.push(tools); return scriptR[Math.min(nR++, scriptR.length - 1)]; } });
  await HR.start({ check: { model: 'm', agentModel: 'm', ctx: 32768, guard: false }, dir: dirR });
  HR.send('what is in here?');
  for (let i = 0; i < 400 && HR.state(0).busy; i++) await new Promise(r => setTimeout(r, 10));
  const evR = HR.state(0).events, asstR = (sentR[1] || []).filter(m => m.role === 'assistant').pop();
  ok('mcode: a tool call goes back to the model with its arguments as an object, never as JSON text (Ollama refuses the text form)',
    !!(asstR && asstR.tool_calls && asstR.tool_calls[0] && typeof asstR.tool_calls[0].function.arguments === 'object'), JSON.stringify(asstR));
  ok('mcode: a model that goes quiet after a tool result is asked again, then answered without tools, and the turn finishes cleanly',
    toolSetsR[3] === null && /Continue from the tool result/.test(((sentR[3] || []).slice(-1)[0] || {}).content || '') && evR.some(e => e.kind === 'text' && /a\.txt and b\.txt/.test(e.text)) && !evR.some(e => e.kind === 'error'), JSON.stringify(toolSetsR.map(t => !!t)));

  /* ---- secrets and the switch ---- */
  ok('moundshroud code: password and key files are recognised', N.SECRET.test('C:\\Users\\me\\proj\\.env') && N.SECRET.test('C:\\Users\\me\\.ssh\\id_rsa') && !N.SECRET.test('C:\\Users\\me\\proj\\env.js'));
  ok('moundshroud code: a command that reads a key file is never treated as harmless', J('type C:\\Users\\me\\.ssh\\id_rsa', true).level === 'ask' && J('type .env', true).level === 'ask');
  ok('moundshroud code: a command wrapped in cmd /c is judged by what is inside it', J('cmd /c dir /b').level === 'safe' && J('cmd.exe /d /s /c dir').level === 'safe' && J('cmd /c format c:').level === 'deny' && J('cmd /c del C:\\Windows\\x.dll', true).level === 'deny');

  /* ---- it is wired into the app, and Settings offers it ---- */
  const rd = f => fs.readFileSync(path.join(__dirname, '..', f), 'utf8');
  const srv = rd('server.js'), set = rd('web/js/settings.js'), ag = rd('web/js/agent.js'), launcher = rd('lib/agent.js');
  ok('moundshroud code: the server offers it as a harness and stops it on the way out', /native: nativeLib\.create\(\{/.test(srv) && /harnesses\.native\.stop\(\)/.test(srv) && /nativeLib\.NAME/.test(srv));
  ok('moundshroud code: Settings offers it beside the other two', /<option value="native">Moundshroud Code<\/option>/.test(set) && /Moundshroud Code/.test(set));
  const cli = rd('lib/moundshroud-code.js');
  ok('moundshroud code: the terminal button opens it in a console window of its own', /harness === 'native'/.test(launcher) && launcher.includes('moundshroud-code.js') && launcher.includes("'Moundshroud Code'") && launcher.includes("'start'") && !/runs inside Moundshroud/.test(srv));
  ok('moundshroud code: that window is this app\'s own harness, not another program', cli.includes("require('./harness-native')") && cli.includes('Hn.send(') && cli.includes('Hn.answer(') && cli.includes('safeDir.check'));
  ok('moundshroud code: the terminal view draws a real interface (header, tool steps, approvals)', cli.includes('?1049h') && cli.includes('?1049l') && cli.includes('38;2;') && cli.includes("'Allow this?'") && cli.includes('⠋⠙⠹⠸⠼⠴⠦⠧⠇⠏') && /\/help/.test(cli) && /SIGINT/.test(cli));
  ok('mcode: an approval is a choice walked with the arrow keys, not a key you have to guess',
    /state\.waiting = \{ id: e\.id, tool: e\.tool, input: e\.input, why: e\.why, i: 0 \}/.test(cli)
    && /if \(key\.name === 'up' \|\| key\.name === 'down' \|\| key\.name === 'tab'\) \{ w\.i = 1 - \(w\.i \|\| 0\); return repaint\(\); \}/.test(cli)
    && /if \(key\.name === 'return'\) return answer\(\(w\.i \|\| 0\) === 0\);/.test(cli)
    && /if \(key\.name === 'escape' \|\| \(key\.ctrl && key\.name === 'c'\)\) return answer\(false\);/.test(cli)
    && /optRow\(pickAllow, 'Allow it, just this once'\)/.test(cli)
    && /optRow\(!pickAllow, 'Refuse it — nothing runs'\)/.test(cli)
    && /const pickAllow = \(ask\.i \|\| 0\) === 0;/.test(cli));
  ok('moundshroud code: the window is drawn as whole rows, so the borders stay straight at any size', /function frame\(W, H\)/.test(cli) && /padTo\(/.test(cli) && /\bclip\(/.test(cli) && /process\.stdout\.on\('resize'/.test(cli));
  ok('moundshroud code: the layout holds at every window size it may meet', (() => {
    const cp2 = require('child_process');
    const width = s => { let n = 0; for (const ch of s.replace(/\u001b\[[0-9;]*m/g, '')) n += ch.codePointAt(0) >= 0x1100 && ch.codePointAt(0) <= 0x115f || (ch.codePointAt(0) >= 0x1f300 && ch.codePointAt(0) <= 0x1faff) ? 2 : 1; return n; };
    for (const [wd, ht] of [[100, 30], [80, 24], [60, 16]]) {
      const out = cp2.spawnSync(process.execPath, [path.join(__dirname, '..', 'lib', 'moundshroud-code.js'), '--demo', '--width', String(wd), '--height', String(ht)], { encoding: 'utf8' }).stdout || '';
      const rows = out.split('\n').filter(l => l !== '');
      if (!rows.length || rows.some(r => width(r) > wd)) return false;
    }
    return true;
  })());
  ok('mcode: typing "mcode" in any terminal opens it (launchers in bin, for cmd and for sh)', (() => {
    const c = path.join(__dirname, '..', 'bin', 'mcode.cmd'), s = path.join(__dirname, '..', 'bin', 'mcode');
    if (!fs.existsSync(c) || !fs.existsSync(s)) return false;
    const ctext = fs.readFileSync(c, 'utf8'), stext = fs.readFileSync(s, 'utf8');
    return /moundshroud-code\.js/.test(ctext) && /%\*/.test(ctext) && /"\$@"/.test(stext) && /moundshroud-code\.js/.test(stext);
  })());
  ok('mcode: one script puts that folder on PATH, and can take it off again', (() => {
    const f = path.join(__dirname, '..', 'install-mcode.ps1');
    if (!fs.existsSync(f)) return false;
    const t = fs.readFileSync(f, 'utf8');
    return /Environment/.test(t) && /-Remove/.test(t) && /'bin'/.test(t) && /mcode\.cmd/.test(t);
  })());
  ok('mcode: the help says how to start it, and a bare start uses the folder you are in', cli.includes('mcode [options]') && /safeDir\.check\(process\.cwd\(\)\)/.test(cli));
  ok('moundshroud code: the console button is offered for it again, like the other two', /id="aggo"/.test(ag) && !/style\.display = inside/.test(ag));
  const launched = await require(path.join(__dirname, '..', 'lib', 'agent.js')).launch('', { model: 'free-agent', harness: 'native', dry: true }, []);
  ok('moundshroud code: the terminal button opens it with the chosen model, without a launcher of its own', launched.ok && launched.harness === 'native' && launched.free === true && launched.model === 'free-agent', JSON.stringify(launched));

  /* ---- a short name for a model, and the two modes ---- */
  const A = require(path.join(__dirname, '..', 'lib', 'agent.js'));
  const ml = [{ name: 'gemma4:e4b' }, { name: 'qwen2.5:7b' }, { name: 'free-agent' }];
  ok('models: a number, a whole name, or any part of one picks the model', (A.pick(ml, '2') || {}).name === 'qwen2.5:7b' && (A.pick(ml, 'gemma') || {}).name === 'gemma4:e4b' && (A.pick(ml, 'free-agent') || {}).name === 'free-agent' && (A.pick(ml, 'Qwen') || {}).name === 'qwen2.5:7b' && A.pick(ml, 'zzz') === null, ['2', 'gemma', 'free-agent', 'Qwen', 'zzz'].map(a => a + '=' + ((A.pick(ml, a) || {}).name || 'none')).join(' '));
  ok('models: two loose words find the model they belong to', (A.pick([{ name: 'llama-3.2-1b-instruct-q4-k-m' }], 'llama q4') || {}).name === 'llama-3.2-1b-instruct-q4-k-m');

  const dir4 = fs.mkdtempSync(path.join(os.tmpdir(), 'mc-test4-'));
  const seen = [];
  const settle = async h => { for (let i = 0; i < 400 && h.state(0).busy; i++) await new Promise(r => setTimeout(r, 10)); };
  const H4 = N.create({ dataDir: dir4, prepare: async () => ({ ok: true }), ask: async (msgs, tools) => { seen.push(tools); return { ok: true, text: 'a word', calls: [] }; } });
  await H4.start({ check: { model: 'm', agentModel: 'm', ctx: 32768, guard: false }, dir: dir4 });
  H4.send('do it'); await settle(H4);
  const codeTools = seen[seen.length - 1];
  const toChat = H4.setMode('chat');
  H4.send('just talk'); await settle(H4);
  const chatTools = seen[seen.length - 1];
  ok('chat mode: code mode hands the model its tools, chat mode hands it none', Array.isArray(codeTools) && codeTools.length > 0 && chatTools === null, typeof codeTools + ' / ' + typeof chatTools);
  ok('chat mode: /chat switches the same session and /code switches it back', toChat.ok && toChat.mode === 'chat' && H4.state(0).mode === 'chat' && H4.setMode('code').ok && H4.state(0).mode === 'code');
  const before = H4.state(0).sessionId;
  await H4.start({ check: { model: 'm2', agentModel: 'm2', ctx: 32768, guard: false }, dir: dir4, keep: true });
  ok('models: switching model keeps the same conversation', H4.state(0).sessionId === before && H4.state(0).model === 'm2', before + ' -> ' + H4.state(0).sessionId);
  let prepped = 0;
  const H5 = N.create({ dataDir: dir4, prepare: async () => { prepped++; return { ok: true }; }, ask: async () => ({ ok: true, text: '', calls: [] }) });
  const tiny = await H5.start({ check: { model: 'tiny', agentModel: 'tiny', ctx: 32768, chat: true }, dir: dir4, mode: 'chat' });
  ok('chat mode: a small model that cannot use tools still runs, with no copy to make', tiny.ok && prepped === 0 && H5.state(0).mode === 'chat', JSON.stringify(tiny));

  /* ---- models from Hugging Face, one GGUF file at a time ---- */
  const HF = require(path.join(__dirname, '..', 'lib', 'hf-gguf.js'));
  const p1 = HF.parse('bartowski/SmolLM2-135M-Instruct-GGUF:Q4_K_M');
  const p2 = HF.parse('https://huggingface.co/bartowski/SmolLM2-135M-Instruct-GGUF/blob/main/SmolLM2-135M-Instruct-Q2_K.gguf');
  const p3 = HF.parse('hf.co/unsloth/Llama-3.2-1B-Instruct-GGUF');
  ok('pull: a repo, a repo with a size, and a huggingface.co address are all understood', !!p1 && p1.repo === 'bartowski/SmolLM2-135M-Instruct-GGUF' && p1.quant === 'Q4_K_M' && !!p2 && p2.file === 'SmolLM2-135M-Instruct-Q2_K.gguf' && !!p3 && p3.repo === 'unsloth/Llama-3.2-1B-Instruct-GGUF' && HF.parse('not a repo') === null);
  const sibs = [{ rfilename: 'README.md' }, { rfilename: 'model.safetensors' }, { rfilename: 'old.bin' }, { rfilename: 'ggml-model-Q4_K_M.gguf', size: 4000000000 }, { rfilename: 'ggml-model-Q2_K.gguf', size: 2000000000 }, { rfilename: 'big-00001-of-00002.gguf', size: 10 }];
  const g = HF.ggufs(sibs);
  ok('pull: only single .gguf files are offered — no safetensors, no .bin, no half of a split file', g.length === 2 && g.every(x => /\.gguf$/.test(x.file)) && !g.some(x => HF.isSplit(x.file)), g.map(x => x.file).join(','));
  ok('pull: the usual size is taken unless another is asked for, and "smallest" takes the littlest', HF.best(g).quant === 'Q4_K_M' && HF.best(g, 'q2_k').quant === 'Q2_K' && HF.best(g, 'smallest').size === 2000000000);
  ok('pull: the model gets a short lowercase name from its repo and size', HF.nameOf('bartowski/SmolLM2-135M-Instruct-GGUF', 'Q2_K') === 'smollm2-135m-instruct-q2-k', HF.nameOf('bartowski/SmolLM2-135M-Instruct-GGUF', 'Q2_K'));
  ok('pull: Ollama is told to build it from that one file', /^FROM "[A-Za-z]:\/models\/x\.gguf"$/m.test(HF.modelfile('C:\\models\\x.gguf')));
  ok('pull: something that is not a repo is refused before anything is downloaded', (await HF.pull('nope')).ok === false);

  /* ---- the window grew the commands it was asked for ---- */
  const harness = rd('lib/harness-native.js');
  ok('mcode: /model switches with a number or part of a name, and /chat and /code change the mode', /cmd === '\/model'/.test(cli) && /agentLib\.pick\(MODELS/.test(cli) && /setMode\('chat'\)/.test(cli) && /setMode\('code'\)/.test(cli) && /Hn\.setMode/.test(cli) && /clear, setMode/.test(harness));
  ok('mcode: a GGUF model can be pulled from Hugging Face from inside it', /hf\.pull\(/.test(cli) && /cmd === '\/pull'/.test(cli) && /GGUF/.test(cli));
  ok('mcode: the look can be changed while it runs, and the text glows as it is typed and written', /THEMES/.test(cli) && /cmd === '\/theme'/.test(cli) && /cmd === '\/color'/.test(cli) && /function caretLine/.test(cli) && /function shown\(b\)/.test(cli) && /mcode-ui\.json/.test(cli));
  ok('mcode: the caret is drawn by hand, so it blinks even though the real cursor is hidden', /function caretCell/.test(cli) && /Math\.floor\(Date\.now\(\) \/ 550\) % 2 === 0/.test(cli) && /blinkOn !== state\.blinkOn/.test(cli) && /\?25l/.test(cli));
  ok('mcode: Moundshroud\'s logo is drawn in pixels, in its own gold and crown lights', /LOGO_CROWN/.test(cli) && /LOGO_M/.test(cli) && /function logoRows/.test(cli) && /255, 246, 207/.test(cli) && /177, 122, 18/.test(cli) && /mix\(PAL\.markA, \[255, 255, 255\], 0\.72\)/.test(cli) && /logoRows\(\)/.test(cli));
  ok('mcode: /autonomy decides how often it asks, and the plan is shown as a checklist', /cmd === '\/autonomy'/.test(cli) && /Hn\.setAutonomy/.test(cli) && /kind === 'plan'/.test(cli) && /update_plan/.test(harness));

  /* ---- the bigger tool set ---- */
  const dir5 = fs.mkdtempSync(path.join(os.tmpdir(), 'mc-test5-'));
  fs.writeFileSync(path.join(dir5, 'page.js'), 'const a = 1;\nconst b = 2;\nconst c = 3;\n');
  fs.mkdirSync(path.join(dir5, 'sub'));
  fs.writeFileSync(path.join(dir5, 'sub', 'deep.test.js'), 'x');
  fs.writeFileSync(path.join(dir5, 'gone.txt'), 'delete me');
  const s5 = [
    { ok: true, text: '', calls: [{ function: { name: 'multi_edit', arguments: { path: 'page.js', edits: [{ find: 'const a = 1;', replace: 'const a = 10;' }, { find: 'const c = 3;', replace: 'const c = 30;' }] } } }] },
    { ok: true, text: '', calls: [{ function: { name: 'update_plan', arguments: { steps: ['read', 'edit', 'check'], done: [1, 2] } } }] },
    { ok: true, text: '', calls: [{ function: { name: 'find_files', arguments: { pattern: '**/*.test.js' } } }] },
    { ok: true, text: '', calls: [{ function: { name: 'file_info', arguments: { path: 'page.js' } } }] },
    { ok: true, text: '', calls: [{ function: { name: 'move_file', arguments: { from: 'sub/deep.test.js', to: 'sub/moved.test.js' } } }] },
    { ok: true, text: '', calls: [{ function: { name: 'make_dir', arguments: { path: 'out/keep' } } }] },
    { ok: true, text: '', calls: [{ function: { name: 'delete_file', arguments: { path: 'gone.txt' } } }] },
    { ok: true, text: 'done', calls: [] },
  ];
  let n5 = 0;
  const H6 = N.create({ dataDir: dir5, prepare: async () => ({ ok: true }), ask: async () => s5[Math.min(n5++, s5.length - 1)] });
  await H6.start({ check: { model: 'm', agentModel: 'm', ctx: 32768, guard: false }, dir: dir5 });
  H6.send('do the job');
  for (let i = 0; i < 600 && H6.state(0).busy; i++) { const st = H6.state(0); if (st.pending.length) H6.answer(st.pending[0].id, true); await new Promise(r => setTimeout(r, 10)); }
  const res5 = H6.state(0).events.filter(e => e.kind === 'result').map(e => e.text).join('\n');
  const pageNow = (() => { try { return fs.readFileSync(path.join(dir5, 'page.js'), 'utf8'); } catch (e) { return ''; } })();
  ok('tools: multi_edit changes several places in one file in one step', /Changed 2 places/.test(res5) && /const a = 10;/.test(pageNow) && /const c = 30;/.test(pageNow), res5.split('\n')[0]);
  ok('tools: update_plan writes the steps and ticks them off', H6.state(0).events.some(e => e.kind === 'plan' && e.steps.length === 3 && e.steps[0].done && e.steps[1].done && !e.steps[2].done));
  ok('tools: find_files finds by pattern through the whole folder', /sub\/deep\.test\.js/.test(res5));
  ok('tools: file_info says the size, the age and the line count', /bytes/.test(res5) && /· \d+ lines/.test(res5), (res5.match(/page\.js[^\n]*/) || [''])[0]);
  ok('tools: move_file and make_dir do what they say', fs.existsSync(path.join(dir5, 'sub', 'moved.test.js')) && fs.statSync(path.join(dir5, 'out', 'keep')).isDirectory());
  ok('tools: delete_file deletes a file, but never without being asked in normal mode', !fs.existsSync(path.join(dir5, 'gone.txt')) && fs.existsSync(path.join(dir5, 'page.js')) && H6.state(0).events.some(e => e.kind === 'ask' && e.tool === 'delete_file'));
  ok('tools: a delete of a folder is refused, not run', (await (async () => { const H = N.create({ dataDir: dir5, prepare: async () => ({ ok: true }), ask: async () => ({ ok: true, text: '', calls: [{ function: { name: 'delete_file', arguments: { path: 'out' } } }] }) }); await H.start({ check: { model: 'm', agentModel: 'm', ctx: 32768 }, dir: dir5 }); H.send('delete the folder'); for (let i = 0; i < 300 && H.state(0).busy; i++) { const st = H.state(0); if (st.pending.length) H.answer(st.pending[0].id, true); await new Promise(r => setTimeout(r, 10)); } return fs.statSync(path.join(dir5, 'out')).isDirectory() && H.state(0).events.some(e => e.kind === 'result' && /is a folder/.test(e.text || '')); })()));

  /* ---- how strict it is ---- */
  const dir6 = fs.mkdtempSync(path.join(os.tmpdir(), 'mc-test6-'));
  const oneWrite = [{ ok: true, text: '', calls: [{ function: { name: 'write_file', arguments: { path: 'y.txt', content: 'ok' } } }] }, { ok: true, text: '', calls: [] }];
  const limited = { dataDir: dir6, prepare: async () => ({ ok: true }) };
  const asks = script => { let i = 0; return async () => script[Math.min(i++, script.length - 1)]; };
  const H7 = N.create(Object.assign({ ask: asks(oneWrite) }, limited));
  await H7.start({ check: { model: 'm', agentModel: 'm', ctx: 32768 }, dir: dir6 });
  const startLevel = H7.state(0).autonomy;
  H7.setAutonomy('careful');
  H7.send('write it');
  for (let i = 0; i < 300 && H7.state(0).busy && !H7.state(0).pending.length; i++) await new Promise(r => setTimeout(r, 10));
  const askedFirst = H7.state(0).pending.length === 1 && H7.state(0).pending[0].tool === 'write_file';
  if (askedFirst) H7.answer(H7.state(0).pending[0].id, false);
  for (let i = 0; i < 300 && H7.state(0).busy; i++) await new Promise(r => setTimeout(r, 10));
  ok('autonomy: careful asks before a file is written, and a refusal leaves it unwritten', startLevel === 'normal' && askedFirst && !fs.existsSync(path.join(dir6, 'y.txt')));
  const H8 = N.create(Object.assign({ ask: asks(oneWrite) }, limited));
  await H8.start({ check: { model: 'm', agentModel: 'm', ctx: 32768 }, dir: dir6 });
  H8.setAutonomy('normal');
  H8.send('write it');
  for (let i = 0; i < 300 && H8.state(0).busy; i++) await new Promise(r => setTimeout(r, 10));
  ok('autonomy: normal lets a file be written with no question', fs.existsSync(path.join(dir6, 'y.txt')) && !H8.state(0).events.some(e => e.kind === 'ask'));
  fs.writeFileSync(path.join(dir6, 'z.txt'), 'x');
  const H9 = N.create(Object.assign({ ask: asks([{ ok: true, text: '', calls: [{ function: { name: 'run_command', arguments: { command: 'del z.txt' } } }] }, { ok: true, text: '', calls: [] }]) }, limited));
  await H9.start({ check: { model: 'm', agentModel: 'm', ctx: 32768 }, dir: dir6 });
  H9.setAutonomy('auto');
  H9.send('delete it');
  for (let i = 0; i < 300 && H9.state(0).busy; i++) await new Promise(r => setTimeout(r, 10));
  ok('autonomy: auto runs a changing command with no question', !fs.existsSync(path.join(dir6, 'z.txt')) && !H9.state(0).events.some(e => e.kind === 'ask'));
  const H10 = N.create(Object.assign({ ask: asks([{ ok: true, text: '', calls: [{ function: { name: 'set_autonomy', arguments: { level: 'auto', why: 'faster' } } }] }, { ok: true, text: '', calls: [] }]) }, limited));
  await H10.start({ check: { model: 'm', agentModel: 'm', ctx: 32768 }, dir: dir6 });
  ok('autonomy: the model may ask for it, and its own request for more freedom waits for the person', true);
  H10.send('ask for auto');
  for (let i = 0; i < 300 && H10.state(0).busy && !H10.state(0).pending.length; i++) await new Promise(r => setTimeout(r, 10));
  const askedModel = H10.state(0).pending.length === 1 && H10.state(0).pending[0].tool === 'set_autonomy';
  if (askedModel) H10.answer(H10.state(0).pending[0].id, false);
  for (let i = 0; i < 300 && H10.state(0).busy; i++) await new Promise(r => setTimeout(r, 10));
  ok('autonomy: the model asked, was refused, and the setting did not move', askedModel && H10.state(0).autonomy === 'normal', H10.state(0).autonomy);

  /* ---- internet access, and how much of the PC it may touch ---- */
  const pageCall = [{ ok: true, text: '', calls: [{ function: { name: 'web_fetch', arguments: { url: 'https://example.com/' } } }] }, { ok: true, text: '', calls: [] }];
  const webOff = N.create(Object.assign({ ask: asks(pageCall) }, limited));
  await webOff.start({ check: { model: 'm', agentModel: 'm', ctx: 32768 }, dir: dir6 });
  webOff.send('read a page'); await settle(webOff);
  ok('net: internet access starts off, and web_fetch refuses until it is given', webOff.state(0).web === false && webOff.state(0).events.some(e => e.kind === 'result' && /Internet access is off/.test(e.text || '')));
  const webOn = N.create(Object.assign({ ask: asks([{ ok: true, text: '', calls: [{ function: { name: 'web_fetch', arguments: { url: 'http://127.0.0.1:9/' } } }] }, { ok: true, text: '', calls: [] }]) }, limited));
  await webOn.start({ check: { model: 'm', agentModel: 'm', ctx: 32768 }, dir: dir6 });
  const netOn = webOn.setWeb(true);
  webOn.send('read a page'); await settle(webOn);
  ok('net: turning it on opens it, and a local address is still refused', netOn.ok && netOn.web === true && webOn.state(0).web === true && webOn.state(0).events.some(e => e.kind === 'result' && /private network/.test(e.text || '')));
  const outside = path.join(os.tmpdir(), 'mc-outside-' + process.pid + '.txt');
  fs.writeFileSync(outside, 'outside the folder');
  const dir7 = fs.mkdtempSync(path.join(os.tmpdir(), 'mc-test7-'));
  let n13 = 0;
  const H13 = N.create({ dataDir: dir7, prepare: async () => ({ ok: true }), ask: async () => { n13++; if (n13 === 2) H13.setReach(true); return { ok: true, text: '', calls: n13 <= 2 ? [{ function: { name: 'read_file', arguments: { path: outside } } }] : [] }; } });
  await H13.start({ check: { model: 'm', agentModel: 'm', ctx: 32768, guard: false }, dir: dir7 });
  H13.send('read it'); await settle(H13);
  const r7 = H13.state(0).events.filter(e => e.kind === 'result').map(e => e.text || '');
  ok('reach: the folder only refuses a file outside it, and /reach pc allows it without a restart', /outside/.test(r7[0] || '') && /outside the folder/.test(r7.slice(1).join(' ')) && H13.state(0).guard === true, (r7.join(' | ') || '').slice(0, 160));

  /* ---- the mark, and the conversation ---- */
  ok('mcode: the card and its logo sit in the middle of the window', /const cardW = 22/.test(cli) && /for \(const l of logoCardRows\(cardW\)\)/.test(cli) && /Math\.floor\(\(w - cardW - 4\) \/ 2\)/.test(cli) 
 && /const LOGO_PIX/.test(cli) && /ch === 'H'/.test(cli));
  ok('mcode: the logo is centred in its card, and takes its colour from the theme',
    /const artW = x1 - x0 \+ 1, artH = y1 - y0 \+ 1;/.test(cli)
    && /const mx = Math\.max\(0, Math\.floor\(\(w - artW\) \/ 2\) - x0\)/.test(cli)
    && /const my = Math\.max\(0, Math\.floor\(\(rows\.length - artH\) \/ 2\) - y0\)/.test(cli)
    && /markA: \[255, 246, 207\], markB: \[177, 122, 18\]/.test(cli) && /markA: \[214, 242, 255\], markB: \[40, 118, 196\]/.test(cli)
    && /const t = Math\.min\(1, Math\.max\(0, y \/ 15\)\), base = mix\(PAL\.markA, PAL\.markB, t\)/.test(cli));
  ok('mcode: a coloured theme colours all of its text, and its doing-words move slowly',
    /if \(key !== 'mono' && key !== 'plain'\) \{/.test(cli) && /PAL\.dim = mix\(PAL\.dim, PAL\.acc, 0.32\)/.test(cli)
    && /PAL\.mute = mix\(PAL\.mute, PAL\.acc2, 0.22\)/.test(cli) && /PAL\.text = mix\(PAL\.text, PAL\.acc2, 0.06\)/.test(cli)
    && /Date\.now\(\) \/ 6000/.test(cli) && /agentc\(clip\(doingIt\(state\), 32\)\)/.test(cli)
    && /thinkc\('working it out…'\)/.test(cli) && /agentc\(b\.partial \? 'writing…' : 'unfolding…'\)/.test(cli));
  ok('mcode: the ocean rains, and the arms come up, curl over the boat, and take it down',
    /function oceanScene\(w, h, rain\)/.test(cli) && /const CYCLE = 24, SWELL = 5\.0, RISE = 7\.2, WRAP = 10\.4, DRAG = 13\.0, DOWN = 16\.2/.test(cli)
    && /const wrap = ease\(\(u - \(WRAP \+ i \* 0\.16\)\) \/ 1\.9\)/.test(cli)
    && /const haul = ease\(\(u - \(DRAG \+ i \* 0\.11\)\) \/ 2\.0\)/.test(cli)
    && /const KR = \[/.test(cli) && /putCell\(g, hx - 3, ey, '█', C\.eye\)/.test(cli)
    && /for \(const a of arms\) if \(a\.i % 2 === 1\) drawArm\(a, 0\.58\)/.test(cli)
    && /const variant = wet \? \(\(pass % 3\) \+ 3\) % 3 : 0;/.test(cli)
    && /const boatX = !wet \? bx : u > CALM \? Math\.round\(w \+ 12 \+ \(bx - \(w \+ 12\)\) \* back\) : bx/.test(cli)
    && /const wet = rain !== false;/.test(cli) && /C\.rainFaint/.test(cli));
  ok('mcode: weather stays in open air so the story art remains readable',
    /const WEATHER = \{/.test(cli) && /function rainWeather\(g, w, h, clock, P\)/.test(cli)
    && /const pass = Math\.floor\(clock \/ 72\) % 3;/.test(cli) && /const gust = Math\.sin\(clock \* 0\.27\)/.test(cli)
    && /blendCell\(g, x, y, wet\.bolt/.test(cli) && /function calmWeather\(g, w, h, clock, P\)/.test(cli)
    && /const pass = Math\.floor\(clock \/ 72\) % 3;/.test(cli) && /putWeatherCell\(g, bx, by/.test(cli)
    && /function putWeatherCell\(g, x, y, ch, colour\)/.test(cli) && /under\.ch !== ' '\)/.test(cli)
    && /putWeatherCell\(g, xx, yy, fall/.test(cli) && /putWeatherCell\(g, Math\.round\(sx/.test(cli));
  const weatherFn = (cli.match(/function putWeatherCell\(g, x, y, ch, colour\) \{[\s\S]*?\n\}/) || [])[0];
  const weatherCell = weatherFn && new Function('putCell', weatherFn + '; return putWeatherCell;')((g, x, y, ch, fg) => { g[y][x] = { ch, fg }; });
  const weatherGrid = [[{ ch: 'H', fg: 'hero' }, { ch: ' ', bg: 'sky' }]];
  ok('mcode: rain leaves a hero untouched and still moves through empty sky', !!weatherCell
    && weatherCell(weatherGrid, 0, 0, '/', 'rain') === false && weatherGrid[0][0].ch === 'H'
    && weatherCell(weatherGrid, 1, 0, '/', 'rain') === true && weatherGrid[0][1].ch === '/');
  ok('mcode: the horseman wears the jack-o-lantern, lifts it off, then throws it from further back',
    /const THROW = 8\.4, FLY = 1\.3, IMPACT = THROW \+ FLY, LIFT = THROW - 1\.5, REACH = LIFT - 0\.9;/.test(cli)
    && /const hmAt = s => at\(s\) - \(24 \+ Math\.round\(Math\.sin\(s \* 1\.15\) \* 2\)\)/.test(cli)
    && /const worn = \{ x: hmX \+ seat \+ S\.pumpX, y: riderTop - S\.pumpY \};/.test(cli)
    && /const held = \{ x: hmX \+ seat \+ \(big \? 11 : 8\), y: riderTop - \(big \? 8 : 3\) \};/.test(cli)
    && /if \(u < LIFT\) \{/.test(cli) && /pumpkinAt = worn;/.test(cli)
    && /armTo\(shX, shY, pumpkinAt\.x/.test(cli)
    && /const x0 = hmAt\(THROW\) \+ seat/.test(cli)
    && /if \(wetRide && pumpkinAt\) drawSprite\(g, pumpkinAt\.x/.test(cli)
    && /u >= THROW && u < THROW \+ 0\.55/.test(cli));
  ok('mcode: big readable silhouettes, a human on a horse, with a compact set for small screens',
    /const HORSE_BIG = \[/.test(cli) && /const HORSE_SMALL = \[/.test(cli) && /const ICHABOD_BIG = \[/.test(cli)
    && /const HEADLESS_BIG = \[/.test(cli) && /const PUMPKIN_BIG = \[/.test(cli)
    && /const big = hz >= 18;/.test(cli) && /const backlight = \(\) =>/.test(cli)
    && /drawSprite\(g, x, horseTop, S\.horse, body, rim\)/.test(cli)
    && /const riderTop = horseTop - \(big \? 2 : 1\)/.test(cli));
  ok('mcode: a moving starry night sky over the ride and over the plain scene',
    /function starrySky\(g, hz, clock, P\)/.test(cli) && /const STAR_SKY = \{/.test(cli)
    && /starrySky\(g, hz, clock, STAR_SKY\.night\);/.test(cli)
    && /auroraSky\(g, hz, clock\);/.test(cli));
  ok('mcode: one big set piece in the middle of every picture, a tragedy in rain and a peaceful thing without',
    /const EVENT_LEN = 26;/.test(cli) && /function person\(g, x, feet, colour, pose, hat, rim\)/.test(cli)
    && /const POSES = \{/.test(cli) && /function forestEvent\(g, w, h, hz, clock, rain\)/.test(cli)
    && /function emberEvent\(g, w, h, hz, clock, rain\)/.test(cli) && /function candyEvent\(g, w, h, hz, clock, rain\)/.test(cli)
    && /function cityEvent\(g, w, h, hz, clock, rain\)/.test(cli) && /function matrixEvent\(g, w, h, hz, clock, rain\)/.test(cli)
    && /function meadowEvent\(g, w, h, hz, clock, rain\)/.test(cli) && /function oceanPeace\(g, w, h, hz, clock, C\)/.test(cli)
    && /function quietRide\(g, w, hz, clock\)/.test(cli)
    && /forestEvent\(g, w, h, hz, clock, rain\);/.test(cli) && /cityEvent\(g, w, h, hz, clock, rain\);/.test(cli)
    && /matrixEvent\(g, w, h, hz, clock, rain\);/.test(cli) && /meadowEvent\(g, w, h, hz, clock, rain\);/.test(cli)
    && /const wet = rain !== false;/.test(cli) && /if \(!wetRide\) quietRide\(g, w, hz, clock\);/.test(cli));
  ok('mcode: the forest mother and fawn are shot at, and the hunter takes the fawn away in his truck',
    /const DOE = \[/.test(cli) && /const DOE_GRAZE = \[/.test(cli) && /const FAWN = \[/.test(cli) && /const FAWN_DOWN = \[/.test(cli)
    && /function drawAnimal\(g, x, y, rows, P\)/.test(cli) && /function drawHunter\(g, x, feet, rows, P, rim\)/.test(cli)
    && /function drawPickup\(g, tx, gy, P, lit\)/.test(cli)
    && /const doeX = Math\.round\(w \* 0\.5\), fawnX = Math\.round\(w \* 0\.5 \+ 20\);/.test(cli)
    && /const WALK_IN = 4\.6, DRAW = 6\.4, LOOSE = 7\.5, HIT = 7\.95, STAGGER = 8\.9, DOWN = 10\.6;/.test(cli)
    && /const WALK_UP = 13\.8, DRAG = 16\.4, HOIST = 19\.4, BOARD = 20\.6, DRIVE = 21\.6;/.test(cli)
    && /bloodPool\(g, fawnX \+ 22, gy, 2 \+ t \* 3\.4, clock, P\.blood\);/.test(cli)
    /* the man is drawn at the wheel and the fawn in the bed, so both leave when it drives */
    && /putCell\(g, tx \+ 15, gy - 7, '█', P\.hat\);/.test(cli) && /drawAnimal\(g, tx \+ 4, gy - 6, FAWN_DOWN, P\);/.test(cli)
    && /const tx = Math\.round\(truckX \+ driveT \* \(w - truckX \+ 40\)\);/.test(cli));
  ok('mcode: the line under the mark is written for each picture, forest included',
    /forest: 'the woods are never empty'/.test(cli) && /const tagline = \(\) => TAGLINES\[UI\.theme\]/.test(cli)
    && /mute\(tagline\(\)\)/.test(cli));
  ok('mcode: /gray takes the colour out of every picture and leaves the words alone',
    /function grayGrid\(g\)/.test(cli) && /function vividGrid\(g, k\)/.test(cli)
    && /if \(UI\.gray\) grayGrid\(g\);/.test(cli) && /cmd === '\/gray'/.test(cli)
    && /gray: false \};/.test(cli));
  ok('mcode: a rotating show of big set pieces runs over every picture',
    /const SHOW_LEN = 72;/.test(cli) && /const SHOWS = \{/.test(cli) && /function showRows\(g, w, h, rain\)/.test(cli)
    && /if \(local >= 12\) return;/.test(cli)
    && /const list = SHOWS\[theme\]\[rain === false \? 'dry' : 'wet'\];/.test(cli)
    && /Math\.floor\(clock \/ SHOW_LEN\) % list\.length/.test(cli) && /showRows\(g, w, h, rain\);/.test(cli)
    && ['fxMeteors', 'fxRibbons', 'fxBolts', 'fxSwarm', 'fxFireworks', 'fxTornado', 'fxLanterns', 'fxSnow', 'fxWhale', 'fxPlane', 'fxGlyphbloom', 'fxGlitch']
      .every(fn => new RegExp('function ' + fn + '\\(').test(cli))
    && /FX\[name\]\(g, w, h, clock, local, V, ground, name === 'firewhirl'\)/.test(cli));
  const SH = new Function((cli.match(/const SHOWS = \{[\s\S]*?\n\};/) || [''])[0] + '; return SHOWS;')();
  ok('mcode: every theme has a running order for rain and for calm, and between them a dozen different shows',
    Object.keys(SH).length === 9 && Object.values(SH).every(x => x.wet.length >= 4 && x.dry.length >= 4)
    && new Set(Object.values(SH).flatMap(x => x.wet.concat(x.dry))).size >= 11);
  ok('mcode: the chase paints behind the conversation only, and cannot touch the chat',
    /function sceneRows\(/.test(cli) && /try \{ night = sceneRows\(W, trH, UI\.mood === 'tragedy'\); \} catch \(e\) \{ night = null; \}/.test(cli)
    && /night && night\[i\] \? overRow\(l, night\[i\], W\) : l/.test(cli) && /for \(let i = 0; i < trH; i\+\+\)/.test(cli)
    && /if \(UI\.scene !== 'off' && W >= 56 && trH >= 15\)/.test(cli) && /sceneRows\(W, trH, UI\.mood === 'tragedy'\)/.test(cli) && /function overRow\(line, bg, w\)/.test(cli)
    && !/rainOn/.test(cli) && !/paintScene/.test(cli)
    && /for \(const l of logoCardRows\(cardW\)\)/.test(cli) && /out\.push\(spaces\(Math\.max\(2, Math\.floor\(\(w - sw\(caption\)\)/.test(cli));

  /* ---- the working-out, the arrow lists, the glow, and the music ---- */
  const nativeSrc = rd('lib/harness-native.js');
  ok('mcode: what the model is thinking is asked for, kept, and shown only when /think says so',
    /think: !!\(S2 && S2\.showThink\)/.test(nativeSrc) && /m\.thinking/.test(nativeSrc) && /thinkText/.test(nativeSrc)
    && /kind: 'thought'/.test(nativeSrc) && /function setThink/.test(nativeSrc)
    && /b\.kind === 'thought'/.test(cli) && /if \(!UI\.think\) return out;/.test(cli) && /cmd === '\/think'/.test(cli));
  ok('mcode: a model that cannot think out loud is asked again plainly instead of failing',
    /does not think out loud/.test(nativeSrc) && /Object\.assign\(\{\}, body, \{ think: false \}\)/.test(nativeSrc));
  ok('mcode: every command with a choice opens the arrow list, walked with the same keys',
    /function openMenu/.test(cli) && /state\.menu = \{ title, items/.test(cli) && /key\.name === 'up'\) \{ p\.i = \(p\.i - 1 \+ n\) % n/.test(cli)
    && /openMenu\('thinking'/.test(cli) && /openMenu\('music'/.test(cli) && /openMenu\('themes'/.test(cli) && /openMenu\('animation'/.test(cli)
    && /openMenu\('internet'/.test(cli) && /openMenu\('reach'/.test(cli) && /openMenu\('autonomy'/.test(cli));
  ok('mcode: the glow while typing and writing is on by default, and can be turned off',
    /animMode: 'smooth'/.test(cli) && /UI\.animMode = j\.animMode === 'off' \? 'off' : 'smooth'/.test(cli)
    && /UI\.anim = on; UI\.animMode = on \? 'smooth' : 'off'/.test(cli)
    && /openMenu\('animation'/.test(cli) && /item\('the glow while typing and writing'/.test(cli) && /item\('still'/.test(cli));
  ok('mcode: /scene offers peace, tragedy, pause and off, and saves the selected mood',
    /UI\.scene === 'paused' && SCENE_PAUSED_AT/.test(cli) && /if \(rain === false\) return g;/.test(cli)
    && /cmd === '\/scene'/.test(cli) && !/cmd === '\/rain'/.test(cli)
    && /openMenu\(sceneName\(\), \[/.test(cli) && /SCENE_NAME = \{ aurora: 'the night ride'/.test(cli)
    && /item\('Peace /.test(cli) && /item\('Tragedy /.test(cli) && /item\('Pause /.test(cli) && /item\('Off /.test(cli)
    && /w2 === 'peace'/.test(cli) && /w2 === 'tragedy'/.test(cli)
    && /Choose \/scene peace, \/scene tragedy, \/scene pause, or \/scene off/.test(cli)
    && /UI\.mood = mode;/.test(cli) && /UI\.scene !== 'off' && W >= 56/.test(cli)
    && /mood: UI\.mood/.test(cli) && /else if \(j\.rain === false\) UI\.mood = 'peace'/.test(cli)
    && !/item\([^\n]*rain/.test(cli.slice(cli.indexOf("if (cmd === '/scene'"), cli.indexOf("if (cmd === '/gray'"))));
  ok('mcode: you, the answer and the thinking are each painted in their own colour of the theme',
    /you: \[[0-9]+, [0-9]+, [0-9]+\], agent: \[/.test(cli) && /const youc = s => paint\$\(PAL\.you, s\), agentc = s => paint\$\(PAL\.agent, s\), thinkc = s => paint\$\(PAL\.think, s\)/.test(cli)
    && /label\('◆', youc, 'YOU', '', youc\)/.test(cli) && /for \(const l of wrap\(b\.text, w - 6\)\) out\.push\('     ' \+ youWave\(l\)\)/.test(cli)
    && /agentLines\(body, w - 6, caret, agentWave\)/.test(cli) && /function inline\(line, paint\)/.test(cli)
    && /label\('⋯', thinkc, 'THINKING'/.test(cli) && /out\.push\('     ' \+ thinkWave\(l\)\)/.test(cli));
  ok('mcode: the dialogue shimmers with the same travelling light as the line you type on',
    /function waveText\(s, a, b, step\)/.test(cli) && /if \(!UI\.anim\) return paint\$\(a, str\)/.test(cli)
    && /const youWave = \(s, step\) => waveText\(s, PAL\.you, PAL\.acc2, step\)/.test(cli)
    && /const agentWave = \(s, step\) => waveText\(s, PAL\.agent, PAL\.acc, step\)/.test(cli)
    && /const thinkWave = \(s, step\) => waveText\(s, PAL\.think, PAL\.dim, step\)/.test(cli)
    && /Math\.sin\(i \* 0\.3 - phase\)/.test(cli) && /Date\.now\(\) - APP_STARTED\) \/ 260/.test(cli));
  ok('mcode: a plain black-and-white theme, and a picture of its own behind every theme',
    /plain: \{ bg: \[0, 0, 0\]/.test(cli) && /text: \[255, 255, 255\]/.test(cli)
    && /const SCENES = \{ aurora: sleepyHollow, ember: emberScene, ocean: oceanScene, forest: forestScene, candy: candyScene, mono: cityScene, matrix: matrixScene, plain: meadowScene, garden: gardenScene \};/.test(cli)
    && /function sceneRows\(w, h, rain\) \{/.test(cli) && /g = \(SCENES\[UI\.theme\] \|\| sleepyHollow\)\(w, h, rain\);/.test(cli)
    && /catch \(e\) \{ g = newGrid\(w, h\); \}/.test(cli)
    && /calmWeather\(g, w, h, clock, P\)/.test(cli) && /rainWeather\(g, w, h, clock, P\)/.test(cli)
    && /function emberScene\(w, h, rain\)/.test(cli) && /function oceanScene\(w, h, rain\)/.test(cli) && /function forestScene\(w, h, rain\)/.test(cli)
    && /function candyScene\(w, h, rain\)/.test(cli) && /function cityScene\(w, h, rain\)/.test(cli) && /function matrixScene\(w, h, rain\)/.test(cli) && /function meadowScene\(w, h, rain\)/.test(cli));
  ok('native: Ctrl+C stops the model and keeps the session, so the next message goes straight on',
    /function halt\(\)/.test(nativeSrc) && /return wasBusy \? \{ ok: true, kept: true \}/.test(nativeSrc)
    && /const me = \+\+S\.turnId, dead = \(\) => S\.stopped \|\| me !== S\.turnId;/.test(nativeSrc)
    && /if \(me !== S\.turnId\) return;/.test(nativeSrc) && /halt, state, show, clear/.test(nativeSrc)
    && /if \(!wasBusy\) \{ push\(\{ kind: 'stopped' \}\); keep\(\); \}/.test(nativeSrc)
    && /try \{ \(Hn\.halt \|\| Hn\.stop\)\.call\(Hn\); \}/.test(cli)
    && /const r = Hn\.halt \? Hn\.halt\(\) : Hn\.stop\(\);/.test(cli));
  ok('mcode: the status line says what it is doing, and never just "working"',
    !/'working'/.test(cli) && /function doingIt/.test(cli) && /const VERB = \{/.test(cli)
    && /state\.doing = \{ what: 'tool', name: e\.name \}/.test(cli) && /state\.doing = \{ what: 'writing' \}/.test(cli)
    && /state\.doing = \{ what: 'thinking' \}/.test(cli) && /agentc\(clip\(doingIt\(state\), 32\)\)/.test(cli)
    && /ask \? ' ' \+ warn\('◷'\)/.test(cli));
  const verbSrc = cli.slice(cli.indexOf('const VERB = {'), cli.indexOf('const TOOL_WORD = {'));
  const V = new Function(verbSrc + '; return { doingIt, VERB };')();
  const says = (fam, s) => { const list = V.VERB[fam]; if (!list) return false; return list.indexOf(V.doingIt(s)) >= 0; };
  ok('mcode: asking the status line what it is doing gives the right kind of answer for each moment',
    says('reading', { doing: { what: 'tool', name: 'read_file' } }) && says('running', { doing: { what: 'tool', name: 'run_command' } })
    && says('editing', { doing: { what: 'tool', name: 'edit_file' } }) && says('deciding', { doing: { what: 'tool', name: 'craft_anything' } })
    && says('writing', { doing: { what: 'writing' } }) && says('thinking', { doing: { what: 'thinking' } })
    && says('deciding', {}) && !V.VERB.reading.includes(V.doingIt({ doing: { what: 'tool', name: 'run_command' } })));
  ok('mcode: each tool is its own kind of doing, and every kind has more than one way of saying it',
    (() => {
      const m = cli.match(/const TOOL_FAMILY = \{[\s\S]*?\};/);   // the TOOL_FAMILY object, and only it
      const block = m ? m[0] : '';
      return /const TOOL_FAMILY = \{/.test(cli)
        && /read_file: 'reading'/.test(block) && /run_command: 'running'/.test(block)
        && /edit_file: 'editing'/.test(block) && /web_fetch: 'web'/.test(block)
        && !/craft_anything:/.test(block)
        && /set_autonomy: 'deciding'/.test(block)
        && (cli.match(/'(mulling it over|drafting|hunting for it|driving the shell|splicing it in|laying out the work|taking it apart)'/g) || []).length >= 5;
    })());
  const musicLib = require(path.join(__dirname, '..', 'lib', 'mcode-music'));
  ok('mcode: there is a loop for every picture, written here, played by the machine, and silent until asked for',
    /const MUSIC = \{ on: false/.test(cli) && /function writeMusic\(file, name\)/.test(cli) && /System\.Media\.SoundPlayer/.test(cli)
    && /cmd === '\/music'/.test(cli) && /musicOff\(\)/.test(cli)
    && /const musicTrackName = \(\) => mcodeMusic\.trackFor\(UI\.theme, UI\.mood === 'tragedy'\);/.test(cli)
    && /function musicNext\(\)/.test(cli) && /function musicSync\(\)/.test(cli) && /cmd === '\/music'/.test(cli)
    && / · peace$/.test(musicLib.pretty('garden-dry')) && / · tragedy$/.test(musicLib.pretty('garden-wet')));
  const mm = rd('lib/mcode-music.js');
  ok('mcode: the garden is a theme of its own, with a gate, a pond, a tree and music of its own',
    /garden: \{ panel: \[/.test(cli) && /garden: 'the gravel remembers every footstep'/.test(cli) && /garden: 'the garden' \}/.test(cli)
    && /function gardenScene\(/.test(cli) && /function drawTorii\(/.test(cli) && /function gardenEvent\(/.test(cli)
    && /garden: gardenScene \}/.test(cli) && musicLib.KEYS.garden && musicLib.KEYS.garden.wet.style === 'eastern' && musicLib.KEYS.garden.dry.style === 'eastern'
    && /HIRAJOSHI = \[0, 2, 3, 7, 8/.test(mm) && /case 'koto':/.test(mm) && /case 'shaku':/.test(mm));
  ok('mcode: the garden sounds like a garden — koto, shakuhachi, taiko, temple bell, in its own scale',
    /const easternBar = \(b, t0, chord, beat, K, wet\)/.test(mm) && /the maezuke/.test(mm)
    && /const ka = \(at, amp\)/.test(mm) && /thump\(t0 \+ beat \* 3 \+ k \* beat \* 0\.14/.test(mm)
    && /a run up the strings/.test(mm) && /suzu: a handful of small bells/.test(mm)
    && /semis\(K\.root, HIRAJOSHI\[idx\] - 1\) \* 2/.test(mm)
    && /'gong', 0\.002/.test(mm) && musicLib.KEYS.garden.wet.taiko === 1 && musicLib.KEYS.garden.dry.taiko === 0);
  ok('mcode: the matrix sounds cyberpunk — a sequencer, four on the floor, a pulse arpeggio and detuned saws',
    musicLib.KEYS.matrix.wet.style === 'cyber' && musicLib.KEYS.matrix.dry.style === 'cyber'
    && /const cyberBar = \(b, t0, chord, beat, K, wet\)/.test(mm) && /const snare = \(at, amp\)/.test(mm)
    && /const hat = \(at, amp\)/.test(mm) && /case 'saw':/.test(mm) && /case 'square':/.test(mm)
    && /four on the floor, a snare cracking on two and four/.test(mm) && /the storm has a siren in it/.test(mm)
    && /cyber: cyberBar, eastern: easternBar/.test(mm) && /if \(BAR\[K\.style\]\)/.test(mm)
    && musicLib.KEYS.matrix.wet.bpm > 90 && musicLib.KEYS.matrix.dry.bpm > 80);
  ok('mcode: the bomb vaporizes the buildings near it and throws the ones at the edges out of the frame',
    /function cityRow\(w, h\)/.test(cli) && /const ROW = cityRow\(w, h\);/.test(cli)
    && /const blastR = Math.max\(6, w \* 0\.15\);/.test(cli) && /const vapor = d < blastR;/.test(cli)
    && /const t = clamp01\(tHit \/ 4\.0\);/.test(cli) && /const ox = dir \* Math\.pow\(t, 2\.6\)/.test(cli)
    && /const spin = dir \* t \* 1\.5;/.test(cli) && /const cs = Math\.cos\(spin\)/.test(cli)
    && /the torn stump it left standing on/.test(cli)
    && /the top goes first/.test(cli) && /the footprint: a scorched notch in the street, still hot/.test(cli)
    && /only the far skyline is drawn here/.test(cli));
  ok('mcode: the city has people, a dog, a cart and a car on the street, and they are caught too',
    /const peds = \[/.test(cli) && /const lampX = Math\.round\(w \* 0\.11\);/.test(cli)
    && /const carX = Math\.round\(\(w \* 0\.3 \+ clock \* 7\)/.test(cli) && /const cartX = Math\.round\(w \* 0\.63\);/.test(cli)
    && /lit white for an instant/.test(cli) && /thrown, head over heels/.test(cli)
    && /const sigX = Math\.round\(w \* 0\.8\);/.test(cli) && /if \(i === 3\) \{ putCell\(g, px \+ 3/.test(cli));
  ok('mcode: the rain brings a monster to the garden and a break-in to the matrix; dry, a prank and root',
    /w \+ 16 - enter \* \(w \* 0\.42\)/.test(cli) && /function godzilla\(/.test(cli)
    && /'HACKED'/.test(cli) && /'ROOT'/.test(cli) && /'GRANTED'/.test(cli)
    && /function padlock\(/.test(cli) && /const FONT5 = \{/.test(cli)
    && /C\.frog/.test(cli) && /the brothers, and the frog/.test(cli));
  ok('mcode: the monks are dressed, they fight the monster, and they are burnt for it',
    /const MONK_ART = \{/.test(cli) && /function drawMonk\(/.test(cli)
    && /robe: \[230, 134, 46\]/.test(cli) && /skin: \[228, 190, 152\]/.test(cli) && /sandal: \[118, 94, 60\]/.test(cli)
    && /const MONK_STAND = \[/.test(cli) && /const MONK_LUNGE = \[/.test(cli) && /const MONK_BURNT = \[/.test(cli)
    && /const spots = \[Math\.round\(w \* 0\.27\)/.test(cli) && /const caught = u > burntAt \+ i \* 0\.3;/.test(cli)
    && /staff\(g, x \+/.test(cli) && /const burntAt = 13\.4;/.test(cli));
  ok('mcode: a dragon crosses the evening sky behind the garden when it is at peace',
    /function drawDragon\(/.test(cli) && /if \(rain === false\) drawDragon\(g, w, hz, clock\);/.test(cli)
    && cli.indexOf('if (rain === false) drawDragon(g, w, hz, clock);') < cli.indexOf('/* the cherry tree on the left')
    && /const HEAD = \[/.test(cli) && /antlers, swept back/.test(cli));
  ok('mcode: every picture has its own arrangement, not only the two that got one',
    ['glacial', 'fire', 'tide', 'woodland', 'toy', 'noir', 'meadow', 'eastern', 'cyber'].every(st => Object.values(musicLib.KEYS).some(k => k.wet.style === st))
    && /const glacialBar = \(b, t0, chord, beat, K, wet\)/.test(mm) && /const fireBar = \(/.test(mm) && /const tideBar = \(/.test(mm)
    && /const woodlandBar = \(/.test(mm) && /const toyBar = \(/.test(mm) && /const noirBar = \(/.test(mm) && /const meadowBar = \(/.test(mm)
    && /case 'flute':/.test(mm) && /case 'piano':/.test(mm) && /const BAR = \{ cyber: cyberBar, eastern: easternBar/.test(mm)
    && /if \(BAR\[K\.style\]\)/.test(mm)
    && musicLib.trackNames().every(n => {
      const { buf } = musicLib.compose(n);
      let peak = 0;
      for (const v of buf) peak = Math.max(peak, Math.abs(v));
      return peak > 0.01;
    }));
  ok('mcode: sixteen loops, one for each theme in each weather, and the storm is not the calm one',
    /function compose\(name\)/.test(mm) && /const trackFor = \(theme, rain\) =>/.test(mm)
    && musicLib.trackNames().length === 18 && musicLib.trackNames().every(n => /-(wet|dry)$/.test(n))
    && JSON.stringify(musicLib.KEYS.ocean.wet.prog) !== JSON.stringify(musicLib.KEYS.ocean.dry.prog)
    && musicLib.KEYS.ocean.wet.bpm !== musicLib.KEYS.ocean.dry.bpm && musicLib.trackFor('ocean', true) === 'ocean-wet' && musicLib.trackFor('ocean', false) === 'ocean-dry');
  ok('mcode: the player is loaded before it plays, kept in the foreground where it survives, and its complaint is kept',
    /\$p\.Load\(\); \$p\.PlayLooping\(\)/.test(cli) && !/detached: true/.test(cli)
    && /const musicPlaying/.test(cli) && /MUSIC\.err/.test(cli) && /\['ignore', 'ignore', 'pipe'\]/.test(cli));

  /* ---- Craft Anything: an outside engine, reachable as one tool ---- */
  ok('mcode: craft anything is one tool of the agent, and asking for it without it installed explains instead',
    N.TOOLS.some(t => t.function && t.function.name === 'craft_anything') && typeof N.craft.path === 'function'
    && /Craft Anything is not installed/.test(N.craft.how) && N.craft.safe.test('commands') && N.craft.safe.test('core-session-show')
    && !N.craft.safe.test('rebuild') && !N.craft.safe.test('web-site-capture'));
  ok('mcode: a craft anything command line is split like a shell, but never through one',
    JSON.stringify(N.craft.args('rebuild https://example.com "Recreate this website" --rounds 1')) === JSON.stringify(['rebuild', 'https://example.com', 'Recreate this website', '--rounds', '1'])
    && N.craft.args("report --html 'my file.html'").join('|') === 'report|--html|my file.html');
  const craftBin = N.craft.path();
  const craftVer = craftBin ? N.craft.run('--version', 60000) : null;
  ok('mcode: craft anything answers on this PC when it is there, and the tool names it when it is not',
    craftBin ? (craftVer.ok && /craft-anything-cli/i.test(craftVer.text || '')) : /releases/.test(N.craft.how),
    craftBin ? (String(craftVer.text || '')).slice(0, 60) + ' · ' + craftBin : 'not installed');
  ok('mcode: /craft reports the engine, and the page labels its cards',
    /cmd === '\/craft'/.test(cli) && /N\.craft\.path\(\)/.test(cli) && /N\.craft\.run\(/.test(cli) && /craft_anything: 'CRAFT ANYTHING'/.test(cli));
  ok('mcode: /stats reports this session, everything kept, and this PC — read from the real session store',
    /cmd === '\/stats'/.test(cli) && /agent-sessions\.json/.test(cli) && /kind === 'stats'/.test(cli)
    && /everything kept/.test(cli) && /'\/stats', 'how you have used it/.test(cli) && /APP_STARTED/.test(cli));
  if (N.craft.path()) {                                    // the agent really drives it, and a reading command asks nothing
    const dirC = fs.mkdtempSync(path.join(os.tmpdir(), 'mc-craft-'));
    let asked = 0;
    const HC = N.create({ dataDir: dirC, save: () => { }, prepare: async () => ({ ok: true }), ask: async () => {
      asked++;
      return asked === 1 ? { ok: true, text: '', calls: [{ function: { name: 'craft_anything', arguments: { command: 'core-session-show' } } }] } : { ok: true, text: 'It is open.', calls: [] };
    } });
    await HC.start({ check: { model: 'm', agentModel: 'm', ctx: 32768, guard: false }, dir: dirC });
    HC.send('what is open in craft anything?'); await settle(HC);
    const ev = HC.state(0).events;
    const rs = ev.filter(e => e.kind === 'result').map(e => String(e.text || ''));
    ok('mcode: the agent can ask craft anything a question and read its answer, without an approval for a reading command',
      rs.length === 1 && /analysis_mode|clean_room/.test(rs[0]) && !ev.some(e => e.kind === 'ask'), (rs[0] || '(nothing)').slice(0, 90));
    try { fs.rmSync(dirC, { recursive: true, force: true }); } catch (e) { }
  }
  ok('mcode: /model opens a list walked with the arrow keys, and the frame can see it', /^let MODELS = \[\];/m.test(cli) && /state\.pick = \{ i: Math\.max\(0, cur\) \}/.test(cli) && /key\.name === 'up'\) \{ p\.i = \(p\.i - 1 \+ n\) % n/.test(cli) && /panel\('models'/.test(cli) && /↑↓ choose/.test(cli));
  ok('mcode: a model that cannot use tools is still chosen, in chat mode', /cannot use tools\/i\.test\(c\.error \|\| ''\)/.test(cli) && /const alt = checkFor\(m\.name, 'chat', state\.ctx\)/.test(cli) && /const mode = fell \? 'chat' : state\.mode/.test(cli) && /Hn\.start\(\{ check: c, dir, mode, keep: true \}\)/.test(cli));
  ok('mcode: /net and /reach are switches, not just reports', /cmd === '\/net'/.test(cli) && /Hn\.setWeb/.test(cli) && /cmd === '\/reach'/.test(cli) && /Hn\.setReach/.test(cli));

  /* ---- Moundshroud Code opens no matter what (even without gemma4:e4b) and offers a model dropdown ---- */
  const customModels = [
    { name: 'bonsai27b:latest', size: 15e9, tools: true, maxCtx: 32768 },
    { name: 'qwen9b:latest', size: 6e9, tools: true, maxCtx: 65536 },
    { name: 'smol1:latest', size: 1e9, tools: false, maxCtx: 32768 },
  ];
  const lMissing = await A.launch('', { model: 'gemma4:e4b', harness: 'native', dry: true }, customModels);
  ok('mcode: opens even when gemma4:e4b is not installed, falling back to an available model',
    lMissing.ok && lMissing.harness === 'native' && lMissing.model === 'bonsai27b:latest' && lMissing.fellBackFrom === 'gemma4:e4b', JSON.stringify(lMissing));
  const lChatOnly = await A.launch('', { model: 'gemma4:e4b', harness: 'native', dry: true }, [{ name: 'smol1:latest', size: 1e9, tools: false }]);
  ok('mcode: opens even when only chat-only models exist',
    lChatOnly.ok && lChatOnly.model === 'smol1:latest' && lChatOnly.chat === true, JSON.stringify(lChatOnly));
  const lEmpty = await A.launch('', { model: 'gemma4:e4b', harness: 'native', dry: true }, []);
  ok('mcode: opens even with an empty model list (Ollama asleep)',
    lEmpty.ok && lEmpty.model === A.FREE && lEmpty.free === true, JSON.stringify(lEmpty));
  ok('mcode: Agent UI shows a real model select dropdown and never disables terminal launch for native',
    /<select class="agchip" id="agcmod"/.test(ag) && /isNative\(\) \? false/.test(ag) && /cmd === 'model'/.test(srv));
  ok('mcode: terminal opens cleanly with a missing model instead of aborting with Ollama does not have gemma4:e4b', (() => {
    const cp2 = require('child_process');
    const r = cp2.spawnSync(process.execPath, [path.join(__dirname, '..', 'lib', 'moundshroud-code.js'), '--model', 'gemma4:e4b'], {
      input: '/model\n/quit\n', encoding: 'utf8', timeout: 15000,
    });
    const out = String(r.stdout || '') + String(r.stderr || '');
    return r.status === 0 && !/Ollama does not have the model/.test(out) && /Moundshroud Code/.test(out);
  })());
  ok('mcode: paused scene shows only the still landscape with all animations, weather and shows hidden',
    /if \(UI\.scene !== 'paused'\) \{/.test(cli)
    && /paused · ' \+ sceneMood\(\)/.test(cli)
    && (cli.match(/const still = UI\.scene === 'paused';/g) || []).length >= 9
    && /if \(!still\) emberEvent\(g, w, h, hz, clock, rain\);/.test(cli)
    && /if \(!still\) forestEvent\(g, w, h, hz, clock, rain\);/.test(cli)
    && /if \(!still\) gardenEvent\(g, w, h, hz, clock, rain\);/.test(cli)
    && /if \(!still\) \{ if \(rain === false\) drawDragon\(g, w, hz, clock\); \}/.test(cli));

  try { fs.rmSync(dir, { recursive: true, force: true }); } catch (e) { }
  try { fs.rmSync(dir2, { recursive: true, force: true }); } catch (e) { }
  try { fs.rmSync(dir4, { recursive: true, force: true }); } catch (e) { }
  try { fs.rmSync(dir7, { recursive: true, force: true }); } catch (e) { }
  try { fs.unlinkSync(outside); } catch (e) { }
};

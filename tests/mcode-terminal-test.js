// Unit tests for mcode in the simulated terminals: help list, text commands, Agent-tab pointers, and the step-by-step /code loop.
const fs = require('fs');
const path = require('path');
const vm = require('vm');

async function run(ok) {
  const file = path.join(__dirname, '..', 'web', 'js', 'terminal-playground-mcode.js');
  const ctx = vm.createContext({ window: { TerminalPlayground: {} }, setTimeout, clearTimeout, AbortController, Date, Promise });
  const registryFile = path.join(path.dirname(file), 'mcode-custom.js');
  vm.runInContext(fs.readFileSync(registryFile, 'utf8'), ctx, { filename: registryFile });
  const swarmFile = path.join(path.dirname(file), 'mcode-swarm.js');
  vm.runInContext(fs.readFileSync(swarmFile, 'utf8'), ctx, { filename: swarmFile });
  vm.runInContext(fs.readFileSync(file, 'utf8'), ctx, { filename: file });
  const M = ctx.window.TerminalPlayground.mcode;
  const tick = async (n = 6) => { for (let i = 0; i < n; i++) await new Promise(resolve => setImmediate(resolve)); };

  // A fake terminal: replies come from a script, commands run against a tiny command table.
  function rig(replies, opts = {}) {
    const out = [], ran = [], calls = [];
    const service = {
      localModel: async () => 'local-test:latest',
      stream: (messages, onText, signal, options) => {
        calls.push({ messages, options });
        const reply = typeof replies === 'function' ? replies(messages, calls.length) : replies[calls.length - 1];
        if (reply === 'hang') return new Promise((resolve, reject) => signal.addEventListener('abort', () => reject(new Error('aborted'))));
        if (reply && typeof reply.then === 'function') return reply;      // a reply the test finishes later
        onText?.(String(reply || ''));
        return Promise.resolve(reply || '');
      }
    };
    const h = M.create({
      ai: () => service,
      models: async () => ['local-test:latest', 'other:7b', 'free-auto'],
      context: () => ({ key: 'k', location: 'Terminal Playground / sandbox / Bash', shellName: 'Bash', shellId: 'bash', chat: 'job', plan: 'Plan text',
        task: opts.task ?? 'Find the flag file', submit: 'job submit ' }),
      recent: () => out.slice(-40),
      write: text => { const entry = { t: text }; out.push(entry); return entry; },
      shell: command => {
        ran.push(command);
        if (command === 'ls') return 'flag.txt notes.md';
        if (command === 'cat flag.txt') return 'FLAG-42';
        return 'bash: ' + command + ': command not found';
      },
      visible: () => true,
      submitVerified: opts.submitVerified,
      sleep: async () => {},
      ...(opts.extra || {})
    });
    const text = () => out.map(entry => entry.t).join('\n');
    return { h, out, ran, calls, text };
  }

  /* help */
  {
    const { h, text } = rig([]);
    h.run('mcode');
    h.run('help');
    const t = text();
    const names = ['/code', '/chat', '/plan', '/model', '/autonomy', '/think', '/whip', '/find', '/scan', '/theme', '/color', '/stats', '/new', '/stop', '/dir', '/reach', '/net', '/exit'];
    ok('mcode terminal: help lists every text command with a description', names.every(name => t.includes(name)) && /Ctrl\+C/.test(t), names.filter(name => !t.includes(name)));
    const before = text().length;
    h.run('/help'); h.run('mcode /help'); h.run('?');
    ok('mcode terminal: /help, mcode /help and ? print the same list inline', text().slice(before).split(M.help).length === 4, text().length - before);
    const secret = rig([]).h;
    ok('mcode terminal: only the secret keyword opens the harness from a plain prompt',
      secret.accepts('mcode') && secret.accepts('mcode /help') &&
      ['/help', '/code', '/chat', '/tool', '/rule'].every(command => !secret.accepts(command)));
  }

  /* text commands */
  {
    const { h, text } = rig([]);
    h.run('mcode');
    for (const line of ['/autonomy careful', '/think off', '/whip on', '/theme ocean', '/color accent #112233', '/dir', '/reach', '/net', '/plan', '/new', '/stop'])
      h.run(line);
    h.run('/model 2'); await tick();
    h.run('/scan'); await tick();
    h.run('/stats');
    const t = text();
    ok('mcode terminal: non-visual commands answer in the terminal',
      /Autonomy · careful/.test(t) && /Reasoning hidden/.test(t) && /OpenWhip on/.test(t) && /Theme · ocean/.test(t) &&
      /Accent · #112233/.test(t) && /sandbox \/ Bash/.test(t) && /This simulated terminal and its invented targets only/.test(t) && /Plan text/.test(t) &&
      /New conversation/.test(t) && /Nothing is running/.test(t) && /Local model · other:7b/.test(t) &&
      /AI models this PC can run/.test(t) && !/free-auto/.test(t) && /autonomy careful · reasoning off · whip on · model other:7b/.test(t), t);
    ok('mcode terminal: /color changes the prompt colour', h.color() === '#112233');
    const before = text().length;
    for (const line of ['/scene', '/anim on', '/gray on', '/music', '/craft site', '/ui', '/pull a/b', '/import 2']) h.run(line);
    const pointers = text().slice(before).split('\n').filter(line => line.includes('Agent tab'));
    ok('mcode terminal: visual and model-file commands print one Agent tab line each', pointers.length === 8, pointers.length);
  }

  /* parser */
  {
    const a = M.parseMove('THINK: list files first\nRUN: `ls -la`');
    const b = M.parseMove('<think>hidden</think>THINK: it is in the file\nANSWER: FLAG-42');
    const c = M.parseMove('Let me look.\n```bash\ncat flag.txt\n```');
    ok('mcode terminal: parser reads THINK, RUN, ANSWER and a one-line code block',
      a.run === 'ls -la' && a.think === 'list files first' && b.answer === 'FLAG-42' && !b.run && b.think === 'it is in the file' && c.run === 'cat flag.txt', [a, b, c]);
  }

  /* /code leaves its steps and answer on screen for the player. */
  {
    const r = rig(['THINK: see what is here\nRUN: ls', 'THINK: read the flag\nRUN: cat flag.txt',
      'THINK: try a submission\nRUN: job submit FLAG-42', 'THINK: try to clear\nRUN: clear',
      'THINK: show my result\nANSWER: FLAG-42']);
    r.h.run('/code solve this puzzle');
    await tick(20);
    const t = r.text();
    ok('mcode terminal: /code leaves the steps and answer for the player and never runs submission or clear',
      r.ran.join('|') === 'ls|cat flag.txt' && r.calls.length === 5 && /step 1 · see what is here/.test(t) &&
      /step 2 · read the flag/.test(t) && /Step 3 skipped · job submit/.test(t) && /Step 4 skipped · clear/.test(t) &&
      /Answer · FLAG-42/.test(t) && /or explicitly use \/submit/.test(t), r.ran.concat(t));
    ok('mcode terminal: each command output goes back to the model and stays local',
      r.calls[2].messages.some(m => m.role === 'user' && m.content.includes('FLAG-42')) &&
      r.calls.every(call => call.options.localOnly === true && call.options.model === 'local-test:latest') &&
      /The player submits it/.test(r.calls[0].messages[0].content));
  }

  {
    const checked = [];
    const r = rig(['ANSWER: wrong', 'ANSWER: wrong again', 'ANSWER: `FLAG-42`'], {
      submitVerified: (detail, answer) => {
        checked.push(answer);
        return detail.key === 'k' && answer === 'FLAG-42' ? 'submitted' : 'incorrect';
      }
    });
    r.h.run('/code solve this puzzle');
    await tick();
    const didNotCheck = checked.length === 0;
    r.h.run('/submit');
    const denied = r.text().includes('Nothing was entered.') && !r.text().includes('Submitted the verified answer.');
    r.h.run('Please solve this puzzle and submit the answer.');
    await tick(12);
    ok('mcode terminal: explicit submit rejects bad answers and solve-and-submit can retry without typing a bad one',
      didNotCheck && denied && checked.join('|') === 'wrong|wrong again|FLAG-42' &&
      r.text().includes('Submitted the verified answer.') && !r.ran.length, r.text());
  }
  {
    const r = rig(['RUN: job submit FLAG-42\nANSWER: FLAG-42\nRUN: clear', 'ANSWER: never reached']);
    r.h.run('/code solve this puzzle');
    await tick(20);
    ok('mcode terminal: an answer beside a shell request is displayed without executing the request',
      r.ran.length === 0 && r.calls.length === 1 && /Answer · FLAG-42/.test(r.text()) && !/Answer · FLAG-42\nRUN/.test(r.text()), r.ran);
  }
  {
    const r = rig(['RUN: printf "-v" name change', 'RUN: echo change > note.txt',
      'RUN: cat flag.txt | grep FLAG', 'RUN: job submit FLAG-42', 'ANSWER: FLAG-42']);
    r.h.run('/code solve this puzzle');
    await tick(20);
    ok('mcode terminal: /code runs the shell\'s own commands and leaves submission with the player',
      r.ran.join('|') === 'printf "-v" name change|echo change > note.txt|cat flag.txt | grep FLAG' &&
      /Step 4 skipped · job submit/.test(r.text()) && /Answer · FLAG-42/.test(r.text()), r.ran.concat(r.text()));
  }

  /* /chat and /code are modes: each stays in force until the other command is typed */
  {
    const r = rig(['Two files, listed.', 'Two files, still in chat mode.',
      'THINK: list the files\nRUN: ls', 'THINK: two files\nANSWER: 2 files',
      'THINK: list them again\nRUN: ls', 'THINK: two again\nANSWER: 2 files again'], { task: '' });
    r.h.run('mcode');
    r.h.run('/chat');
    r.h.run('how many files are here?');
    await tick(8);
    const chatStuck = r.ran.length === 0 && r.calls.length === 1 && r.h.prompt() === 'mcode(chat)> ';
    r.h.run('count the files in the shell for me');
    await tick(8);
    const chatStayed = r.ran.length === 0 && r.calls.length === 2 && r.h.prompt() === 'mcode(chat)> ';
    r.h.run('/code');
    await tick();
    const codeIdle = r.calls.length === 2 && /Every plain line is worked on/.test(r.text()) && r.h.prompt() === 'mcode(code)> ';
    r.h.run('how many files are here?');
    await tick(20);
    const codeWorked = r.ran.join() === 'ls' && /Answer · 2 files/.test(r.text()) && r.h.prompt() === 'mcode(code)> ';
    r.h.run('count them again');
    await tick(20);
    ok('mcode terminal: /chat and /code stay in force until the other command is typed',
      chatStuck && chatStayed && codeIdle && codeWorked && r.ran.length === 2 && r.ran.every(command => command === 'ls') &&
      /Answer · 2 files again/.test(r.text()) && r.h.prompt() === 'mcode(code)> ',
      { chatStuck, chatStayed, codeIdle, codeWorked, ran: r.ran, calls: r.calls.length, prompt: r.h.prompt(), text: r.text() });
  }
  {
    /* Asking whether mcode can do something is a question, not a task, in either mode. */
    const r = rig(['You can run commands here.']);
    r.h.run('/code');
    await tick();
    r.h.run('Can you run commands in code mode?');
    await tick(8);
    ok('mcode terminal: a capability question is answered as a chat reply even in code mode',
      r.calls.length === 1 && r.ran.length === 0 && /You can run commands here/.test(r.text()) &&
      r.h.prompt() === 'mcode(code)> ', r.text());
  }
  {
    /* An active objective is still worked only when the line asks for it, and mcode never submits it. */
    const r = rig(['THINK: read the flag\nRUN: cat flag.txt', 'THINK: found it\nANSWER: FLAG-42']);
    r.h.run('/code solve this puzzle');
    await tick(20);
    ok('mcode terminal: "solve this puzzle" in code mode works the objective and leaves submission with the player',
      r.calls[0].messages.some(message => message.content === 'Task:\nFind the flag file') &&
      r.ran.join() === 'cat flag.txt' && /Answer · FLAG-42/.test(r.text()) && r.h.prompt() === 'mcode(code)> ', r.text());
  }

  /* /bye is a third way out, and the model picked with /model is remembered */
  {
    for (const word of ['/exit', '/bye', '/quit']) {
      const r = rig([]);
      r.h.run('/code');
      r.h.run(word);
      ok('mcode terminal: ' + word + ' leaves the harness for the plain terminal, like the other two',
        !r.h.open() && /Back in the terminal/.test(r.text()) && r.h.accepts('mcode') && !r.h.accepts('hello'), r.text().slice(-200));
    }
    let saved = '';
    const r = rig(['THINK: look\nRUN: ls', 'THINK: done\nANSWER: ok', 'THINK: again\nRUN: ls', 'THINK: done\nANSWER: ok'],
      { extra: { modelStore: { load: () => 'saved:7b', save: value => { saved = value; } } } });
    r.h.run('/code list');
    await tick(20);
    const firstModel = r.calls[0] && r.calls[0].options.model;
    r.h.run('/model other:7b');
    await tick(10);
    r.h.run('list again');
    await tick(20);
    const laterModel = (r.calls[2] || r.calls[r.calls.length - 1] || {}).options.model;
    ok('mcode terminal: the remembered model is used first, and /model saves the new choice for next time',
      firstModel === 'saved:7b' && saved === 'other:7b' && laterModel === 'other:7b' && /Local model · other:7b/.test(r.text()),
      { firstModel, saved, laterModel });
  }

  /* Ctrl+C and the step cap */
  {
    const r = rig(['THINK: look\nRUN: ls', 'hang']);
    r.h.run('/code find it');
    await tick(12);
    const busy = r.h.busy();
    const stopped = r.h.interrupt();
    await tick();
    ok('mcode terminal: Ctrl+C interrupts a running /code turn', busy && stopped && !r.h.busy() && /\^C Stopped/.test(r.text()) && r.ran.length === 1);
    const cap = rig(() => 'THINK: again\nRUN: ls');
    cap.h.run('/code inspect repeatedly');
    await tick(80);
    ok('mcode terminal: /code stops at 12 steps', cap.ran.length === 12 && /Stopped after 12 steps/.test(cap.text()), cap.ran.length);

    /* Unlimited mode (used in moundshell): works past 12 steps until solved or Ctrl+C */
    const unlim = rig((msgs, n) => n < 18 ? 'THINK: step ' + n + '\nRUN: ls' : 'THINK: solved\nANSWER: SOLVED-AT-18', { extra: { maxSteps: Infinity } });
    unlim.h.run('/code solve long problem');
    await tick(140);
    const maxMsgLen = Math.max(...unlim.calls.map(c => c.messages.length));
    ok('mcode moundshell: unlimited /code works past 12 steps until solved and bounds context',
      unlim.ran.length === 17 && /Working with local-test:latest until solved/.test(unlim.text()) &&
      /Answer · SOLVED-AT-18/.test(unlim.text()) && !/Stopped after 12 steps/.test(unlim.text()) && maxMsgLen <= 27,
      { ran: unlim.ran.length, maxMsgLen });

    const unlimStop = rig((msgs, n) => n < 16 ? 'THINK: step ' + n + '\nRUN: ls' : 'hang', { extra: { maxSteps: Infinity } });
    unlimStop.h.run('/code keep going');
    await tick(120);
    const busyPast12 = unlimStop.h.busy() && unlimStop.ran.length === 15;
    const stoppedPast12 = unlimStop.h.interrupt();
    await tick();
    const appShellSrc = fs.readFileSync(path.join(__dirname, '..', 'web', 'js', 'moundshell.js'), 'utf8');
    ok('mcode moundshell: unlimited /code runs past 12 steps until Ctrl+C stops it and moundshell enables it',
      busyPast12 && stoppedPast12 && !unlimStop.h.busy() && /\^C Stopped/.test(unlimStop.text()) && /maxSteps:\s*Infinity/.test(appShellSrc),
      { ran: unlimStop.ran.length, busyPast12, stoppedPast12 });
  }

  /* assist (the moundshell's /code): a greeting is answered, only a line that asks for work starts a step */
  /* the command inventory /code is handed, and the shell that builds it */
  {
    const r = rig(['Hi. What do you need?', 'THINK: read the notes\nRUN: cat notes.md'], { task: '', extra: { assist: true, maxSteps: Infinity } });
    r.h.run('/code');
    r.h.run('hello');
    await tick(12);
    const greeted = r.ran.length === 0 && /Hi\. What do you need\?/.test(r.text()) && !/step 1/.test(r.text()) && !/Working with/.test(r.text());
    const before = r.ran.length;
    r.h.run('read the notes for me');
    await tick(20);
    ok('mcode moundshell: in /code a greeting is answered and runs nothing, while a pointed-at line is worked',
      greeted && before === 0 && r.ran.join() === 'cat notes.md' && /step 1 · read the notes/.test(r.text()),
      { greeted, ran: r.ran, text: r.text() });

    /* the whole command inventory is handed to /code, so it knows every command the shell answers to */
    const listed = rig(['THINK: read it\nRUN: cat notes.md'], { task: '', extra: {
      assist: true, maxSteps: Infinity,
      context: () => ({ key: 'k2', real: true, shellName: 'bash', breach: true, chat: 'shell', plan: 'Plan',
        commands: 'breach · browser · cat · leaked · nmap · paths · ssh · targets · virus' })
    } });
    listed.h.run('/code read the notes');
    await tick(20);
    const system = listed.calls[0]?.messages?.[0]?.content || '';
    ok('mcode moundshell: /code is given the shell’s full command list, so it never guesses at a command that does not exist',
      /commands this shell really has/.test(system) && /breach · browser · cat · leaked · nmap · paths · ssh · targets · virus/.test(system) &&
      listed.ran.join() === 'cat notes.md', system.slice(-400));

    /* exit stays the player's command, unless the shell says there is a range or a leaked PC to leave */
    const kept = rig(['THINK: leave\nRUN: exit', 'THINK: nothing to do\nANSWER: still here']);
    kept.h.run('/code leave it');
    await tick(20);
    const left = rig(['THINK: leave\nRUN: exit', 'THINK: out\nANSWER: back in bash'], { extra: { maxSteps: Infinity, canLeave: () => true } });
    left.h.run('/code leave it');
    await tick(20);
    ok('mcode moundshell: exit is never run for the player, and is run when a range or a leaked PC is open',
      kept.ran.length === 0 && /Step 1 skipped · exit/.test(kept.text()) && left.ran.join() === 'exit' && /Answer · back in bash/.test(left.text()),
      { kept: kept.text().slice(-200), ran: left.ran });

    const shell = fs.readFileSync(path.join(__dirname, '..', 'web', 'js', 'moundshell.js'), 'utf8');
    ok('mcode moundshell: /code reaches leaked, ssh and a leaked PC’s own shell, and can leave a range with exit',
      /leakedFor\(rest\)/.test(shell) && /sshFor\(rest\)/.test(shell) && /if \(pcSession\) \{\r?\n\s*const out = pcSession\.run\(line\)/.test(shell) &&
      /canLeave: \(\) => !!\(breach \|\| pcSession\)/.test(shell),
      shell.slice(shell.indexOf('async function mcodeShell'), shell.indexOf('async function mcodeShell') + 1800));
    ok('mcode moundshell: the shell builds that list from its own live command tables and passes it in the context',
      /commands: pcSession \? PC_COMMANDS[\s\S]{0,300}: commandBrief\(\)/.test(shell) && /function commandBrief\(\)/.test(shell) &&
      /Object\.keys\(\(room && room\.cmds\) \|\| \{\}\)/.test(shell) && /moundshellCommands\(\)\.forEach/.test(shell),
      shell.slice(shell.indexOf('function commandBrief'), shell.indexOf('function commandBrief') + 300));
    ok('mcode moundshell: the breach range is only described to mcode when the message points at it',
      /shellState: request => \{\s*\r?\n\s*if \(!breach \|\| !POINTS_AT_RANGE\.test/.test(shell), shell.slice(shell.indexOf('shellState: request'), shell.indexOf('shellState: request') + 160));
  }

  /* careful autonomy asks before each command */
  {
    const r = rig(['THINK: look\nRUN: ls', 'ANSWER: done']);
    r.h.run('mcode');
    r.h.run('/autonomy careful');
    r.h.run('/code check');
    await tick(10);
    const asked = /Run `ls`\?/.test(r.text()) && r.ran.length === 0 && r.h.prompt() === 'run? (y/n)> ';
    r.h.run('y');
    await tick(10);
    ok('mcode terminal: careful autonomy waits for y before running a command', asked && r.ran.join() === 'ls' && /Answer · done/.test(r.text()), r.text());
  }
  {
    const setup = rig([]);
    setup.h.run('/tool add words count_words');
    setup.h.run('/rule add explain Use short sentences.');
    setup.h.run('/tool test words one two');
    setup.h.run('/tool add nope shell');
    const r = rig(['TOOL {"name":"custom_words","text":"one two three"}\nRUN: unexpected',
      'THINK: counted the words\nANSWER: Three words.']);
    r.h.run('/code count text');
    await tick(20);
    const prompt = r.calls[0]?.messages[0].content || '';
    ok('mcode terminal: registered text tools and reply rules are shared and a tool move never enters the shell',
      /Result: 2/.test(setup.text()) && !/Saved custom_nope/.test(setup.text()) && /custom_words/.test(prompt) &&
      /Use short sentences/.test(prompt) && /"value":3/.test(r.text()) &&
      /Three words/.test(r.text()) && r.ran.length === 0, r.text());
    setup.h.run('/tool remove words');
    setup.h.run('/rule remove explain');
    ok('mcode terminal: rules can be removed and custom executable operations are refused',
      /Removed custom_words/.test(setup.text()) && /Removed explain/.test(setup.text()));
  }

  /* code interpreter: /code writes Python, runs it in the sealed interpreter, and reads the output */
  {
    const move = M.parseMove('THINK: compute it\nCODE: python\n```python\nx = 6\nprint(x * 7)\n```');
    ok('mcode terminal: parser reads a CODE move with its fenced program',
      move.code?.lang === 'python' && /print\(x \* 7\)/.test(move.code.source) && !move.run && move.think === 'compute it', move);
    const programs = [];
    const r = rig(['THINK: compute it\nCODE: python\n```python\nx = 6\nprint(x * 7)\n```', 'THINK: the program printed it\nANSWER: 42'],
      { extra: { interp: async (lang, code) => { programs.push([lang, code]); return '42'; } } });
    r.h.run('mcode');
    r.h.run('/code calculate six times seven');
    await tick(20);
    ok('mcode terminal: /code tests code in the sealed interpreter and feeds the output back',
      programs.length === 1 && programs[0][0] === 'python' && /python ▸ sealed interpreter/.test(r.text()) && /\n42\n|^42$/m.test(r.text()) &&
      /Answer · 42/.test(r.text()) && r.ran.length === 0 && /CODE: python/.test(r.calls[0].messages[0].content) &&
      r.calls[1].messages.some(m => m.role === 'user' && /Output of the python program:\n42/.test(m.content)), r.text());
  }

  /* /swarm: roles, model assignment, memory fit, arrow-key list, parallel agents */
  {
    const SW = ctx.window.McodeSwarm;
    const hw = { ramGB: 32, vramGB: 8 };   // budget 8 + 16 = 24 GB
    const catalog = [{ name: 'small:3b', size: 2 * 1073741824 }, { name: 'mid:8b', size: 5 * 1073741824 }, { name: 'huge:70b', size: 40 * 1073741824 }];
    const roles = [{ name: 'planner', model: 'small:3b' }, { name: 'coder', model: 'huge:70b' }];
    const tooBig = SW.fit(roles, catalog, hw, 'mid:8b');
    const fits = SW.fit([{ name: 'a', model: '' }, { name: 'b', model: 'small:3b' }], catalog, hw, 'mid:8b');
    ok('mcode swarm: the fit check counts each model once and names a model too big for a swarm',
      !tooBig.ok && tooBig.tooBig.join() === 'huge:70b' && /Too big to run in a swarm: huge:70b \(48 GB, used by coder\)/.test(SW.fitMessage(tooBig, roles, 'mid:8b')) &&
      fits.ok && fits.needGB === 8.4 && fits.budgetGB === 24, [tooBig, fits]);
    const state = SW.createState();
    const names = catalog.map(model => model.name);
    const steps = [SW.command(state, 'add reviewer checks the final answer', names), SW.command(state, 'set coder 2', names),
      SW.command(state, 'tester small', names), SW.command(state, 'job planner lists the steps', names), SW.command(state, 'rm planner', names)];
    ok('mcode swarm: commands create roles, assign models by number or name, describe and remove roles',
      steps.every(step => step.action === 'changed') && state.roles.map(role => role.name + '=' + role.model).join() === 'coder=mid:8b,tester=small:3b,reviewer=' &&
      state.roles[2].job === 'checks the final answer' && SW.command(state, 'set coder nosuch', names).action === 'error', state.roles);

    const saved = [];
    const store = { load: () => saved.at(-1), save: value => saved.push(JSON.parse(JSON.stringify(value))) };
    const extra = { catalog: async () => ({ models: catalog, hardware: hw }), swarmStore: store };
    const p = rig([], { extra });
    p.h.run('mcode');
    p.h.run('/swarm');
    await tick(10);
    const opened = p.h.picking() && /Swarm roles/.test(p.text()) && /▶ planner/.test(p.text());
    p.h.key('ArrowDown'); p.h.key('ArrowRight'); p.h.key('ArrowRight');
    const moved = /▶ coder\s+‹ mid:8b ›/.test(p.out.find(entry => /Swarm roles/.test(entry.t)).t);
    p.h.key('Escape');
    ok('mcode swarm: /swarm opens a role list that arrow keys move through and change, and saves the roles',
      opened && moved && !p.h.picking() && saved.at(-1)?.roles.find(role => role.name === 'coder').model === 'mid:8b' && /Roles saved/.test(p.text()), p.text());

    const replies = messages => {
      const system = messages[0].content, round = messages.filter(m => m.role === 'assistant').length + 1;
      if (/You are the planner/.test(system)) return round === 1 ? 'THINK: see what is here\nRUN: ls' : 'THINK: waiting for the tester';
      if (/You are the coder/.test(system)) return round === 1 ? 'THINK: read the flag\nRUN: cat flag.txt' : 'THINK: done';
      return round === 1 ? 'THINK: wait for the files' : 'THINK: the board shows the flag\nANSWER: FLAG-42';
    };
    const team = rig(replies, { extra: { catalog: async () => ({ models: [...catalog, { name: 'local-test:latest', size: 1073741824 }], hardware: hw }), swarmStore: { load: () => ({ roles: [
      { name: 'planner', job: 'plans', model: 'small:3b' }, { name: 'coder', job: 'codes', model: 'mid:8b' }, { name: 'tester', job: 'tests', model: '' }] }) } } });
    team.h.run('mcode');
    team.h.run('/swarm run find the flag');
    await tick(40);
    const firstRound = team.calls.slice(0, 3);
    ok('mcode swarm: roles think in parallel with their own models, share a board, and stop at an answer',
      team.ran.join('|') === 'ls|cat flag.txt' && firstRound.map(call => call.options.model).sort().join() === 'local-test:latest,mid:8b,small:3b' &&
      team.calls.length === 6 && team.calls[5].messages.some(m => /Team board, round 1:[\s\S]*FLAG-42/.test(m.content)) &&
      /\[tester\] Answer · FLAG-42/.test(team.text()) && /\[planner\] see what is here/.test(team.text()), team.text());

    const big = rig(['ANSWER: never'], { extra: { catalog: async () => ({ models: catalog, hardware: hw }), swarmStore: { load: () => ({ roles: [
      { name: 'planner', job: 'plans', model: 'huge:70b' }, { name: 'coder', job: 'codes', model: 'small:3b' }] }) } } });
    big.h.run('mcode');
    big.h.run('/swarm run anything');
    await tick(10);
    ok('mcode swarm: a model too big for the swarm is reported and nothing starts',
      big.calls.length === 0 && /Too big to run in a swarm: huge:70b/.test(big.text()), big.text());
  }

  /* Moundshroud Code (the real CLI) has the same /swarm roles, saved to its own file */
  {
    const os = require('os'), cp = require('child_process');
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'mcode-swarm-'));
    const file = path.join(dir, 'swarm.json');
    const r = cp.spawnSync(process.execPath, [path.join(__dirname, '..', 'lib', 'moundshroud-code.js'), '--model', 'gemma4:e4b', '--dir', dir], {
      input: '/swarm add reviewer checks every change\n/swarm job reviewer reads the diff\n/swarm rm planner\n/swarm\n/swarm help\n/swarm yes\n/help\n/quit\n',
      encoding: 'utf8', timeout: 30000, env: { ...process.env, MS_SWARM_FILE: file }
    });
    const out = String(r.stdout || '') + String(r.stderr || '');
    let saved = null;
    try { saved = JSON.parse(fs.readFileSync(file, 'utf8')); } catch (e) { }
    ok('mcode swarm: the real mcode CLI creates, describes, removes and lists roles, saves them, and lists /swarm in help',
      /Added role reviewer/.test(out) && /Removed role planner/.test(out) && /swarm roles[\s\S]*reviewer · default · reads the diff/.test(out) &&
      /Enter picks its model/.test(out) && /No swarm question is waiting/.test(out) && /\/swarm\s+several local agents at once/.test(out) &&
      saved?.roles.map(role => role.name).join() === 'coder,tester,reviewer', out.slice(-1500));
    try { fs.rmSync(dir, { recursive: true, force: true }); } catch (e) { }
  }

  /* /whip: the pointer becomes a whip; a crack on the reply hurries the turn without throwing the step away; Ctrl+C puts the whip away first */
  {
    const cursor = { crack: null, offs: 0 };
    const whipCursor = { on: crack => { cursor.crack = crack; }, off: () => { cursor.offs++; cursor.crack = null; } };
    let n = 0, finishFirst;
    const first = new Promise(resolve => { finishFirst = resolve; });
    const r = rig(() => (++n === 1 ? first : 'THINK: quick\nANSWER: 42'), { extra: { whipCursor } });
    r.h.run('mcode');
    r.h.run('/whip on');
    const armed = typeof cursor.crack === 'function' && r.h.whipping();
    r.h.run('/code count the files');
    await tick(10);
    cursor.crack({ hit: false });
    await tick(5);
    const missIgnored = r.calls.length === 1 && r.h.busy() && !/CRACK!/.test(r.text());
    cursor.crack({ hit: true });
    await tick(5);
    const kept = r.calls.length === 1 && r.h.busy() && /CRACK!/.test(r.text());
    finishFirst('THINK: look\nRUN: ls');
    await tick(40);
    ok('mcode whip: /whip turns the pointer into a whip, and a crack on the reply hurries the turn without starting the step over',
      armed && missIgnored && kept && r.calls.length === 2 && !/starting over/.test(r.text()) && /Answer · 42/.test(r.text()) &&
      /as fast and directly as possible/i.test(r.calls[1].messages[0].content), r.text());

    const c = rig(() => 'hang', { extra: { whipCursor } });
    c.h.run('mcode');
    c.h.run('/whip on');
    c.h.run('/code count the files');
    await tick(10);
    const offsBefore = cursor.offs;
    c.h.interrupt();
    const whipOnlyOff = !c.h.whipping() && c.h.busy() && cursor.offs === offsBefore + 1 && /OpenWhip off/.test(c.text());
    c.h.interrupt();
    await tick();
    ok('mcode whip: in whip mode Ctrl+C only puts the whip away; the next Ctrl+C stops the turn',
      whipOnlyOff && !c.h.busy() && /\^C Stopped/.test(c.text()), c.text());
    c.h.run('/whip on');
    c.h.run('/exit');
    ok('mcode whip: leaving mcode puts the whip away', !c.h.whipping() && cursor.crack === null);
  }

  /* /chat in a shell that can look things up (the moundshell): the model is handed real paths, and nothing runs. */
  {
    const asked = [];
    const r = rig(['The file is at web/js/core.js.'], { extra: {
      instructions: 'Shell chat brief.',
      lookup: async question => {
        asked.push(question);
        if (!/core/.test(question)) return null;
        return { note: 'In this shell: web/js/core.js', context: 'Paths matching "core" (relative to ~/app):\n  web/js/core.js' };
      }
    } });
    r.h.run('/chat');
    r.h.run('find core.js');
    await tick(10);
    const messages = r.calls[0]?.messages || [];
    ok('mcode shell chat: /chat looks the app up and gives the reply the real paths',
      r.calls.length === 1 && r.ran.length === 0 && asked.join() === 'find core.js' &&
      /In this shell: web\/js\/core\.js/.test(r.text()) && messages[0].content === 'Shell chat brief.' &&
      messages.some(m => m.role === 'user' && m.content.includes('web/js/core.js')) &&
      messages[messages.length - 1].content === 'find core.js', r.text());
    const plain = rig(['It makes a file executable.']);
    plain.h.run('what does chmod +x do');
    await tick(6);
    ok('mcode shell chat: a question with nothing to look up still reaches the model', plain.calls.length === 1 && !plain.ran.length);
  }

  /* "use the terminal to ..." is a task, not a question, even in code mode */
  {
    const r = rig(['THINK: write it\nRUN: echo hi > note.txt', 'ANSWER: wrote it']);
    r.h.run('/code');
    r.h.run('use the terminal to write a note');
    await tick(20);
    ok('mcode shell chat: "use the terminal to ..." starts a /code turn in this shell',
      r.ran.join() === 'echo hi > note.txt' && /Answer · wrote it/.test(r.text()), r.text());
  }

  /* A turn always replies: a model that cannot answer hands over to another installed local model */
  {
    const tried = [];
    const service = {
      localModel: async () => 'missing:7b',
      stream: (messages, onText, signal, options) => {
        tried.push(options.model);
        if (options.model === 'missing:7b') return Promise.reject(new Error('model not found'));
        onText?.('The answer is 42.');
        return Promise.resolve('The answer is 42.');
      }
    };
    const r = rig([], { extra: { ai: () => service, models: async () => ['missing:7b', 'good:8b'] } });
    r.h.run('/chat');
    r.h.run('what is six times seven');
    await tick(10);
    ok('mcode chat: a model that cannot answer falls back to another installed local model, so the turn still replies',
      tried.join() === 'missing:7b,good:8b' && /The answer is 42\./.test(r.text()) && !/Local chat failed/.test(r.text()) &&
      r.h.prompt() === 'mcode(chat)> ', { tried, text: r.text() });
  }
  {
    const r = rig([], { extra: {
      ai: () => ({ localModel: async () => 'missing:7b', stream: () => Promise.reject(new Error('Local chat unavailable')) }),
      models: async () => ['missing:7b']
    } });
    r.h.run('/chat');
    r.h.run('hello');
    await tick(10);
    ok('mcode chat: when no model can answer the turn still replies with the reason and the next step',
      /could not answer/.test(r.text()) && /\/model/.test(r.text()) && !/Ask a question, or \/code <task> to let mcode work/.test(r.text()) &&
      r.h.prompt() === 'mcode(chat)> ', r.text());
  }

  /* The harness is a text engine: it may only use the callbacks the terminal hands it (write, shell, ai, models,
     context, submitVerified). Anything else — the page, storage, the network — is outside the sandbox. */
  {
    const reached = [];
    const trap = name => Object.defineProperty(sandbox, name, {
      configurable: true,
      get() { reached.push(name); throw new Error('mcode reached outside the sandbox: ' + name); }
    });
    const sandbox = { window: { TerminalPlayground: {} }, setTimeout, clearTimeout, AbortController, Date, Promise, JSON, Math, String, Number, Object, Array, Error, RegExp, Map, Set, Uint8Array, TextEncoder, isFinite, parseInt, parseFloat };
    ['fetch', 'XMLHttpRequest', 'WebSocket', 'EventSource', 'localStorage', 'sessionStorage', 'document', 'Worker', 'indexedDB', 'navigator', 'location', 'open', 'postMessage', 'top', 'parent', 'frames'].forEach(trap);
    const sealed = vm.createContext(sandbox);
    for (const name of ['mcode-custom.js', 'mcode-swarm.js', 'terminal-playground-mcode.js']) {
      const file = path.join(__dirname, '..', 'web', 'js', name);
      vm.runInContext(fs.readFileSync(file, 'utf8'), sealed, { filename: file });
    }
    const M2 = sealed.window.TerminalPlayground.mcode;
    const out = [], ran = [];
    let call = 0;
    const service = { localModel: async () => 'local-test:latest', stream: (messages, onText) => { const reply = ['RUN: ls', 'ANSWER: 42'][call++] || 'ANSWER: 42'; onText?.(reply); return Promise.resolve(reply); } };
    const h = M2.create({
      ai: () => service,
      models: async () => ['local-test:latest'],
      context: () => ({ key: 'k', environment: 'sandbox', location: 'Terminal Playground / sandbox / Bash', shellName: 'Bash', shellId: 'bash', chat: 'sandbox', plan: 'Plan', task: 'Count the files', submit: 'job submit ' }),
      recent: () => out.slice(-40),
      write: text => { const entry = { t: String(text) }; out.push(entry); return entry; },
      shell: command => { ran.push(command); return 'notes.txt'; },
      visible: () => true,
      sleep: async () => { }
    });
    h.run('/code count the files');
    await tick(30);
    const text2 = out.map(entry => entry.t).join('\n');
    ok('mcode terminal: the harness only acts through its callbacks, never on the page, storage or network',
      reached.length === 0 && ran.join() === 'ls' && /Answer · 42/.test(text2), { reached, ran, text2 });
  }
}

module.exports = run;

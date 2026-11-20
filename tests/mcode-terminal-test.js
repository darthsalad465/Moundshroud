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
      /Accent · #112233/.test(t) && /sandbox \/ Bash/.test(t) && /simulated terminal only/.test(t) && /Plan text/.test(t) &&
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
      'RUN: cat flag.txt | grep FLAG', 'ANSWER: FLAG-42']);
    r.h.run('/code solve this puzzle');
    await tick(20);
    ok('mcode terminal: inspection pipelines run while writes and quoted mutation flags are skipped',
      r.ran.join() === 'cat flag.txt | grep FLAG' && /Step 1 skipped/.test(r.text()) && /Step 2 skipped/.test(r.text()), r.ran);
  }

  /* /code <task> ends on ANSWER in free play */
  {
    const r = rig(['Ask me to count them.', 'THINK: check\nRUN: ls', 'THINK: two files listed\nANSWER: 2 files'], { task: '' });
    r.h.run('mcode');
    r.h.run('/code');
    const idle = /Code mode/.test(r.text()) && r.calls.length === 0;
    r.h.run('how many files are here?');
    await tick(8);
    const questionOnly = r.ran.length === 0 && r.calls.length === 1 && /Ask me to count/.test(r.text());
    r.h.run('Please count the files.');
    await tick(12);
    ok('mcode terminal: /code answers questions until the player explicitly requests a task',
      idle && questionOnly && r.ran.join() === 'ls' && /Answer · 2 files/.test(r.text()) && r.h.prompt() === 'mcode(code)> ', r.text());
  }
  {
    const r = rig(['RUN: ls', 'RUN: ls', 'RUN: ls', 'ANSWER: FLAG-42']);
    r.h.run('/code');
    await tick();
    const idle = r.calls.length === 0;
    r.h.run('/code how do I solve this puzzle?');
    await tick();
    r.h.run('Do you know how to find the key?');
    await tick();
    r.h.run('Can you run commands in code mode?');
    await tick();
    const questions = r.calls.length === 3 && r.ran.length === 0;
    r.h.run('Could you please solve this puzzle?');
    await tick();
    ok('mcode terminal: even an active objective waits for explicit authorization',
      idle && questions && r.calls.length === 4 && r.ran.length === 0 &&
      r.calls[3].messages.some(message => message.content === 'Task:\nFind the flag file') &&
      /Answer · FLAG-42/.test(r.text()), r.text());
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
}

module.exports = run;

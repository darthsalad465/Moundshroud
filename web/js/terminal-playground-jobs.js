// Procedural practice jobs for the normal sandbox. Each job uses a fresh interpreter.
(() => {
  const TP = window.TerminalPlayground;
  const factories = {
    bash: TP.makeBash, powershell: TP.makePowershell, cmd: TP.makeCmd, python: TP.makePython,
    node: TP.makeNode, sql: TP.makeSql, git: TP.makeGit, docker: TP.makeDocker,
    network: TP.makeNetwork, crypto: TP.makeCrypto
  };
  const sum = values => values.reduce((total, value) => total + value, 0);

  function random(seed) {
    let state = seed >>> 0;
    return max => {
      state = (state + 0x6d2b79f5) >>> 0;
      let value = Math.imul(state ^ state >>> 15, state | 1);
      value ^= value + Math.imul(value ^ value >>> 7, value | 61);
      return ((value ^ value >>> 14) >>> 0) % max;
    };
  }

  function makeJob(id, number, seed) {
    const rng = random(seed ^ Math.imul(number, 0x9e3779b1) ^ Math.floor(number / 0x100000000));
    const variant = (number - 1) % 5;
    const station = ['alder', 'bracken', 'caldera', 'dune', 'elm', 'fen', 'gale', 'hemlock'][rng(8)];
    const ticket = station + '-' + number.toString(36) + '-' + rng(65536).toString(36);
    const code = 'REF-' + (10000 + rng(90000));
    const values = Array.from({ length: 4 + rng(5) }, () => 10 + rng(90));
    const labels = Array.from({ length: values.length }, (_, i) => station + '-' + (i + 1));
    const index = rng(values.length);
    const target = labels[index];
    const subtotal = [values[index], sum(values), Math.max(...values), Math.min(...values), values.length][variant];
    const data = labels.map((name, i) => name + ',' + values[i]);
    const assignment = (title, task, hint, answer, setup = [], options) => ({
      title, task, hint, answer: String(answer), setup, options, ticket
    });

    if (['bash', 'powershell', 'cmd'].includes(id)) {
      const file = 'readings.csv';
      const setup = {
        bash: [`printf '${data.join('\\n')}\\n' > ${file}`],
        powershell: data.map((row, i) => (i ? 'Add-Content ' : 'Set-Content ') + file + ' ' + row),
        cmd: data.map((row, i) => 'echo ' + row + ' ' + (i ? '>> ' : '> ') + file)
      }[id];
      const hint = {
        bash: [`grep '${target},' ${file}`, `cat ${file}`, `cut -d, -f2 ${file} | sort -n`, `cut -d, -f2 ${file} | grep -v '^$' | sort -n`, `cat ${file}`],
        powershell: [`Select-String ${target}, ${file}`, ...Array(4).fill(`Get-Content ${file}`)],
        cmd: [`findstr ${target}, ${file}`, ...Array(4).fill(`type ${file}`)]
      }[id][variant];
      return assignment('Station readings', [
        `Find the reading for ${target} in ${file}.`,
        `Add the readings in the second column of ${file}.`,
        `Find the highest reading in ${file}.`,
        `Find the lowest reading in ${file}.`,
        `Count the records in ${file}. Ignore blank lines.`
      ][variant], hint, subtotal, setup);
    }

    if (id === 'python' || id === 'node') {
      const expression = id === 'python' ? [`readings[${index}]`, 'sum(readings)', 'max(readings)', 'min(readings)', 'len(readings)'] :
        [`readings[${index}]`, 'readings.reduce((total, value) => total + value, 0)', 'Math.max(...readings)', 'Math.min(...readings)', 'readings.length'];
      return assignment('Sensor notebook', [
        `Read the value at index ${index} (zero-based) in the readings array.`,
        'Calculate the sum of the readings.',
        'Find the maximum reading.',
        'Find the minimum reading.',
        'Count the entries in readings.'
      ][variant], expression[variant], subtotal, [(id === 'node' ? 'const ' : '') + 'readings = ' + JSON.stringify(values)]);
    }

    if (id === 'sql') {
      const setup = ['CREATE TABLE readings (station TEXT, value INTEGER);', ...data.map((row, i) =>
        `INSERT INTO readings VALUES ('${labels[i]}', ${values[i]});`)];
      return assignment('Readings database', [
        `Return the value for station '${target}' from the readings table.`,
        'Return the sum of the value column in readings.',
        'Return the largest value in readings.',
        'Return the smallest value in readings.',
        'Count the rows in the readings table.'
      ][variant], [
        `SELECT value FROM readings WHERE station = '${target}';`,
        'SELECT SUM(value) FROM readings;',
        'SELECT MAX(value) FROM readings;',
        'SELECT MIN(value) FROM readings;',
        'SELECT COUNT(*) FROM readings;'
      ][variant], subtotal, setup);
    }

    if (id === 'git') {
      const subjects = labels.slice(0, 4).map((label, i) =>
        ['Document', 'Review', 'Archive', 'Index'][i] + ' ' + label + ' ' + code + '-' + (i + 1));
      const setup = ['git init', ...subjects.map(subject => `git commit --allow-empty -m "${subject}"`)];
      const chosen = [index % 4, subjects.length - 1, 0, subjects.length - 2, 1][variant];
      return assignment('Repository handoff', [
        `Find the reference code on the commit whose subject begins with “${subjects[chosen].split(' ').slice(0, 2).join(' ')}”.`,
        'Find the reference code at the end of the newest commit subject.',
        'Find the reference code at the end of the oldest commit subject.',
        'Find the reference code at the end of the second-newest commit subject.',
        'Find the reference code at the end of the second-oldest commit subject.'
      ][variant], 'git log --oneline', subjects[chosen].split(' ').at(-1), setup);
    }

    if (id === 'docker') {
      const image = 'alpine:3.' + (10 + rng(13));
      const name = 'reading-' + ticket;
      const workers = 2 + rng(4);
      const setup = [`docker create --name ${name} ${image}`, `docker run -d --name worker-${ticket} busybox:1.36`,
        ...Array.from({ length: workers - 1 }, (_, i) => `docker create --name worker-${ticket}-${i + 2} ubuntu:24.04`)];
      return assignment('Container inventory', [
        `Find the image, including its tag, used by ${name}.`,
        `Find the name of the running job container that uses busybox:1.36.`,
        `Find the name of the job container in Created state that uses ${image}.`,
        `What tag is on the image used by the container worker-${ticket}?`,
        `Count the containers with names beginning worker-${ticket}, including the running worker and workers in Created state.`
      ][variant], ['docker ps -a', 'docker ps', 'docker ps -a', 'docker ps', 'docker ps -a'][variant],
      [image, 'worker-' + ticket, name, '1.36', workers][variant], setup);
    }

    if (id === 'network') {
      const host = ticket + '.test';
      const address = '192.0.2.' + (1 + rng(254));
      const ttl = 60 * (1 + rng(20));
      const hint = [`dig ${host}`, `host ${host}`, `nslookup ${host}`, `dig +short ${host}`, `dig ${host}`][variant];
      const task = variant === 4 ? `Find the TTL, in seconds, of the A record for ${host}.` :
        variant === 3 ? `Use short dig output to read the IPv4 address for ${host}.` : `Look up the IPv4 address for ${host}.`;
      return assignment('DNS inventory', task, hint, variant === 4 ? ttl : address, [], { records: { [host]: { address, ttl } } });
    }

    const payload = ticket.toUpperCase();
    const asHex = text => Array.from(text, char => char.charCodeAt(0).toString(16).padStart(2, '0'));
    const encoded = [
      () => btoa(payload),
      () => asHex(payload).join(''),
      () => payload.replace(/[A-Z]/g, char => String.fromCharCode(((char.charCodeAt(0) - 65 + 13) % 26) + 65)),
      () => btoa(asHex(payload).join('')),
      () => '%' + asHex(payload).join('%')
    ][variant]();
    const hint = [`base64 -d ${encoded}`, `hex -d ${encoded}`, `rot13 ${encoded}`, `base64 -d ${encoded} | hex -d`, `url -d ${encoded}`][variant];
    return assignment('Archive fragment', `Recover the plain text from this ${['Base64', 'hex', 'ROT13', 'Base64-wrapped hex', 'URL-encoded'][variant]} fragment:\n${encoded}`,
      hint, payload);
  }

  function load(id) {
    try {
      const state = JSON.parse(localStorage.getItem('tpg_jobs_' + id));
      if (state && Number.isSafeInteger(state.number) && state.number > 0 && Number.isInteger(state.seed) &&
          Number.isSafeInteger(state.completed) && state.completed >= 0) {
        return { number: state.number, seed: state.seed >>> 0, completed: state.completed, active: !!state.active, solved: !!state.solved, hintStage: Number.isSafeInteger(state.hintStage) && state.hintStage >= 0 ? state.hintStage : 0 };
      }
    } catch (e) { /* Start a new job series if local progress is unavailable. */ }
    return { seed: Math.floor(Math.random() * 0x100000000), number: 1, completed: 0, active: false, solved: false, hintStage: 0 };
  }

  function attach(shell) {
    let state, current, practice;
    const freeKey = 'tpg_free_workspace_' + shell.id;
    const jobKey = 'tpg_job_workspace_' + shell.id;
    const savedFree = TP.readSave(freeKey);
    if (savedFree) shell.restore?.(savedFree);
    const getState = () => state || (state = load(shell.id));
    const save = () => {
      try { localStorage.setItem('tpg_jobs_' + shell.id, JSON.stringify(state)); } catch (e) { /* Memory still holds this session. */ }
    };
    function prepare(regenerate = false) {
      if (!current || regenerate) current = makeJob(shell.id, state.number, state.seed);
      if (!practice || regenerate) {
        practice = factories[shell.id](current.options);
        for (const command of current.setup) practice.run(command);
        const saved = !regenerate && TP.readSave(jobKey);
        if (saved?.seed === state.seed && saved.number === state.number && saved.workspace) {
          practice.restore?.(saved.workspace);
        }
      }
    }

    function saveWorkspace() {
      if (!getState().active) return !shell.snapshot || TP.writeSave(freeKey, shell.snapshot());
      prepare();
      return !practice.snapshot || TP.writeSave(jobKey, {
        seed: state.seed, number: state.number, workspace: practice.snapshot()
      });
    }

    function brief() {
      prepare();
      return `Job ${state.number} · ${current.title} · ${current.ticket}\n${current.task}\n` +
        (state.solved ? '✓ Complete. Use job next for a fresh assignment.' : 'Submit with job submit <answer>. Use job hint if you get stuck.');
    }
    const matchesAnswer = answer => !!answer && answer.toLowerCase() === current.answer.toLowerCase();

    function job(action, answer) {
      getState();
      if (action === 'help') return 'Job commands: start · status · hint · submit <answer> · next · reset · leave';
      if (!action || action === 'status') return state.active ? brief() : 'No active job. Type job start to pick up a practice assignment.';
      if (action === 'start') {
        state.active = true;
        save();
        return brief();
      }
      if (action === 'leave') {
        state.active = false;
        save();
        return 'Back in free play. Type job start to return to your assignment.';
      }
      if (action === 'next' && state.active) {
        state.number++;
        state.solved = false;
        state.hintStage = 0;
        prepare(true);
        save();
        return brief();
      }
      if (!state.active) return 'Type job start to open a practice assignment.';
      prepare();
      if (action === 'hint') {
        /* staged like every other hint: a riddle, then where to look, then the exact line */
        const stages = [
          { title: 'A riddle to start', text: 'The workspace already knows the answer. You are not meant to work it out in your head — you are meant to find where it was written down.' },
          { title: 'Where to look', text: 'Read the file or table the assignment names. The record you need is one line among several; ignore the rest and keep only the one the task describes.' },
          { title: 'The exact move', text: 'When the reading stops helping, this is the line that produces the answer:', command: current.hint }
        ];
        const at = Math.min(state.hintStage || 0, stages.length - 1);
        state.hintStage = Math.min(stages.length, at + 1);
        save();
        const stage = stages[at];
        return '💡 job hint ' + (at + 1) + '/' + stages.length + ' · ' + stage.title + '\n  ' + stage.text + (stage.command ? '\n  try: ' + stage.command : '') +
          (at + 1 < stages.length ? '\n  (' + (stages.length - at - 1) + ' more stage' + (stages.length - at - 1 === 1 ? '' : 's') + ' — the exact line comes last)' : '\n  (that is every nudge.)');
      }
      if (action === 'reset') { state.hintStage = 0; prepare(true); saveWorkspace(); return 'Practice workspace restored.\n' + brief(); }
      if (action === 'submit') {
        if (state.solved) return 'This job is already complete. Use job next for a fresh assignment.';
        if (!answer) return 'Usage: job submit <answer>';
        if (!matchesAnswer(answer)) return 'That answer does not match the assignment. Try again or use job hint.';
        state.solved = true;
        state.completed++;
        save();
        let reward = null;
        try { reward = window.TerminalRewards && window.TerminalRewards.award('job', { completed: state.completed }); } catch (e) { }
        return '✓ Job complete. Use job next for another assignment or job leave to go back to free play.' +
          (reward ? '\n  ⭐ +' + reward.points + ' points · 🏅 +' + reward.elo + ' Elo' + (reward.badges.length ? ' · ' + reward.badges.map(b => b.icon + ' ' + b.name).join(', ') : '') : '');
      }
      return 'Unknown job command. Type job help for the list.';
    }

    return {
      ...shell,
      saveWorkspace,
      jobs: () => {
        const { active, completed } = getState();
        return { active, completed };
      },
      // The shell that commands actually run in right now: the job's own disk during a job, the sandbox otherwise.
      workspace: () => {
        if (!getState().active) return shell;
        prepare();
        return practice;
      },
      mcodeJob: () => {
        if (!getState().active) return null;
        prepare();
        const title = `${current.title} · ${current.ticket}`;
        return { key: current.ticket, title, task: current.task, hint: current.hint, solved: state.solved,
          matchesAnswer };
      },
      prompt: () => {
        if (!getState().active) return shell.prompt();
        prepare();
        return '[job ' + state.number + '] ' + practice.prompt();
      },
      cwdPath: shell.cwdPath && (() => {
        if (!getState().active) return shell.cwdPath();
        prepare();
        return practice.cwdPath();
      }),
      run: (line, observe) => {
        const raw = String(line ?? '').trim();
        const match = /^job(?:\s+(\S+)(?:\s+(.+))?)?$/i.exec(raw);
        if (match) return job(match[1]?.toLowerCase(), match[2] || '');
        const egg = TP.curios?.run(raw, 'sandbox', shell.id);
        if (egg !== undefined && egg !== null) return egg;
        const active = getState().active;
        if (active) prepare();
        const workspace = active ? practice : shell;
        try { return shell.id === 'bash' ? workspace.run(line, observe) : workspace.run(line); }
        finally { saveWorkspace(); }
      }
    };
  }

  TP.jobs = { makeJob };
  TP.shells = TP.shells.map(attach);
})();

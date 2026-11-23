// Cyber > 🕶️ Cyber games > Terminal playground.
// Three modes over the same ten terminals:
//   Sandbox    — free play with built-in command examples and procedural practice jobs.
//   Puzzles    — procedural Puzzle Studio (Easy / Medium / Hard / Insane + selectable categories + shareable seeds)
//                plus a Custom Puzzle Creator to author and solve your own challenges in any shell.
//   Labyrinth  — an endless descent: each depth is a generated room whose key is hidden in its
//                own files, tables, commits, containers or services. Deeper floors require
//                multiple checkpoint keys found using that terminal's commands.
(() => {
  const P = A.play = A.play || { games: {} };
  const TP = window.TerminalPlayground;
  const LAB = window.TerminalLabyrinth;
  const PUZ = window.TerminalPuzzles;
  const esc = t => String(t == null ? '' : t).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const mono = 'font-family:Consolas,"Cascadia Mono",monospace';
  const box = 'border:1px solid var(--line);background:var(--panel2);border-radius:10px;padding:10px 12px';
  const pill = (t, col) => '<span style="display:inline-block;margin:0 4px 4px 0;padding:2px 8px;border-radius:999px;font-size:11.5px;border:1px solid ' + (col || 'var(--line)') + ';color:' + (col || 'var(--mute)') + ';background:rgba(255,255,255,.03)">' + esc(t) + '</span>';

  const fileShells = ['bash', 'powershell', 'cmd'];
  const sampleFiles = 'fragments/part1.txt = FLAG{\nfragments/part2.txt = CUSTOM_\nfragments/part3.txt = PUZZLE}\nREADME.txt = Combine all three fragments in fragments/!';
  const field = (label, control) => '<label class="small" style="display:grid;gap:3px;min-width:0">' + label + control + '</label>';
  const RESET = { bash: 'reset', powershell: 'Reset', cmd: 'reset', python: 'reset()', node: 'clear', sql: 'RESET;', git: 'git reset-sandbox', docker: 'reset', network: 'reset', crypto: 'reset', pentest: 'reset-target', remote: 'reset-range' };
  /* the two Security ranges practise their own objectives; the Labyrinth and Puzzle Studio cover the ten terminals */
  const labDepthOf = id => {
    try { const v = JSON.parse(localStorage.getItem('tplab_' + id) || '{}'); return Math.max(1, v.depth | 0 || 1); } catch (e) { return 1; }
  };
  const labSessions = {}, puzzleSessions = {}, puzzleSpecs = {};
  const logs = {}, history = {}, drafts = {}, coachReports = {};
  const terminalSaveKey = key => 'tpg_terminal_view_' + key;
  const puzzleSaveKey = id => 'tpg_active_puzzle_' + id;
  const mcodeSettingKey = 'tpg_mcode_enabled';
  /* The Labyrinth keeps the note back until depth 5; the sandbox beside it and every exercise always carry one. */
  const labNoteDepth = 5, labCodeDepth = 18;
  const discoveryNote = (scope, room, fallback = 'sandbox', depth = 0) =>
    TP.mcodeNote(scope, room?.seedCode || room?.id || room?.title || fallback, room?.difficulty || 'easy', depth);
  let mcodeEnabled = TP?.readSave?.(mcodeSettingKey) !== false;
  const mcodeListeners = new Set();
  const mcodeAvailable = () => mcodeEnabled && TP.mcodeIsUnlocked();
  const refreshMcode = () => { for (const update of mcodeListeners) update(); };

  function mount(el, api) {
    /* every lookup stays inside this mount: the same game can be mounted in the Games tab and the
       Cyber games tab at once, and a shared module-level stage made the visible copy paint into the
       hidden one (a solve looked like it needed a page reload to show the next level). */
    const $ = id => el.querySelector('#' + id);
    if (!TP || !TP.shells || !TP.shells.length) {
      el.innerHTML = '<p style="padding:12px">The playground did not load. Check the terminal-playground-data files.</p>';
      return () => { };
    }
    const shells = TP.shells;
    const byId = id => shells.find(s => s.id === id) || shells[0];
    const savedShell = ls.get('tpg_shell', 'bash');
    const savedMode = ls.get('tpg_mode', 'sandbox');
    const S = {
      shell: byId(savedShell).id,
      mode: savedMode === 'lab' || savedMode === 'puzzle' ? savedMode : 'sandbox',
      logs, hist: history, hi: {}, filter: '',
      lab: labSessions, fs: false,
      puzDiff: ls.get('tpg_pdiff', 'medium'),
      puzCat: 'auto',
      puzSessions: puzzleSessions,
      puzEditor: null,
      scen: null,
      learn: ls.get('tpg_learn', 'true') !== 'false',
      learnAt: {},
      learnOpen: false,
      lm: null,
      coachOpen: ls.get('tpg_coach_open', 'true') !== 'false'
    };
    if (PUZ && !PUZ.DIFFS[S.puzDiff]) S.puzDiff = 'medium';

    /* Every shell remembers its own colour for the prompt and the lines you typed, so your own input is always the
       same easy-to-spot colour even when the shell's output is not. */
    const COLOR_KEY = 'tpg_user_color_', DEFAULT_USER_COLOR = '#7fd1ff';
    const userColor = () => {
      try { return localStorage.getItem(COLOR_KEY + S.shell) || DEFAULT_USER_COLOR; } catch (e) { return DEFAULT_USER_COLOR; }
    };
    const setUserColor = value => {
      try { localStorage.setItem(COLOR_KEY + S.shell, value); } catch (e) { }
      paintOut(); paintPrompt();
    };

    const logKey = id => (S.mode === 'lab' ? 'lab:' + id : S.mode === 'puzzle' ? 'puz:' + id : id);
    const harnesses = new Map();
    let mounted = true;
    let guestMcode = null;
    const manual = TP.manual?.create(el, {
      focusTerminal: () => $('tpgin')?.focus(),
      useExample: command => {
        const input = $('tpgin');
        if (input) { input.value = command; input.oninput?.(); input.focus(); }
      },
      /* the dropdown in the help window reads any shell's manual without changing the shell you are typing in */
      shellChoices: () => shells.map(sh => ({ key: sh.id, name: sh.name, group: sh.range ? 'Security ranges' : sh.group || 'Shells' })),
      pickShell: (id, topic) => openManual(topic || '', id),
      /* the help window's search can look through every sandbox shell at once */
      allShells: () => shells.map(sh => ({ key: sh.id, name: sh.name, shell: sh }))
    });
    /* The help window's playground runs on its own throwaway shell, built from the current one each time help opens.
       Reading and writing both work there, so lessons still teach the real effect, but nothing typed in help can
       change the sandbox, a job, a puzzle or a real file. */
    const HELP_FACTORY = {
      bash: () => TP.makeBash && TP.makeBash(), powershell: () => TP.makePowershell && TP.makePowershell(),
      cmd: () => TP.makeCmd && TP.makeCmd(), python: () => TP.makePython && TP.makePython(),
      node: () => TP.makeNode && TP.makeNode(), sql: () => TP.makeSql && TP.makeSql(),
      git: () => TP.makeGit && TP.makeGit(), docker: () => TP.makeDocker && TP.makeDocker(),
      network: () => TP.makeNetwork && TP.makeNetwork(), crypto: () => TP.makeCrypto && TP.makeCrypto(),
      pentest: () => TP.makePentest && TP.makePentest(), remote: () => TP.makeRemoteRange && TP.makeRemoteRange()
    };
    function helpCopy(sh) {
      const make = HELP_FACTORY[sh.id];
      if (!make || !sh.snapshot || !sh.restore) return null;
      try {
        const copy = make();
        if (!copy || typeof copy.run !== 'function') return null;
        /* a deep copy, so the help shell never shares a file object with the live one */
        copy.restore(JSON.parse(JSON.stringify(sh.snapshot())));
        return copy;
      } catch (e) { return null; }
    }
    const openManual = (query, readId) => {
      /* picking a shell in the window's dropdown changes what is being read, never the terminal underneath */
      const reading = readId && readId !== S.shell ? byId(readId) : null;
      const sh = reading || current();
      const copy = helpCopy(sh);
      if (copy) {
        copy.playNote = 'Runs on a throwaway copy of this shell’s files. Reading, writing and deleting all work here, and nothing typed can change your own terminal or any real file.';
        copy.playHint = 'Type any command below and press Run. This playground works on a copy, so you can try a delete or a redirect safely.';
      }
      /* if this shell cannot be copied, say so plainly instead of promising safety */
      const plain = copy ? copy : Object.assign({}, sh, {
        playNote: 'This shell could not be copied, so commands here run on your own sandbox. Avoid deletes in this window.',
        playHint: 'Type a command below and press Run. Because this shell could not be copied, a delete here would also delete it in your terminal.'
      });
      manual?.open(plain, reading ? 'sandbox' : S.mode, reading ? [] : palette(), query, reading ? null : buildHelpContext());
    };

    function mcodeContext(mode, id) {
      const shell = byId(id), location = 'Terminal Playground / ' + mode + ' / ' + shell.name;
      const session = mode === 'lab' ? labSession(id) : mode === 'puzzle' ? puzSession(id) : null;
      const room = mode === 'lab' ? session?.room() : session?.puzzle;
      const job = mode === 'sandbox' ? shell.mcodeJob?.() : null;
      const shellName = shell.name;
      if (job) return { key: job.key, location, shellName, shellId: id, chat: location + '\n' + job.task, plan: job.title + '\n' + job.task + '\nStart with: ' + job.hint,
        task: job.title + '\n' + job.task, submit: 'job submit ', matchesAnswer: job.matchesAnswer,
        done: job.solved ? 'This job is already complete.' : '' };
      if (!room) return { key: location, location, shellName, shellId: id, chat: location + '\nFree play.', task: '',
        plan: 'Free play. /code <task> works any task here; /exit and job start open a practice job.' };
      const summary = location + '\n' + (room.custom ? 'Custom puzzle' : room.title);
      const brief = !room.custom && !['network', 'docker'].includes(shell.id) ? '\n' + room.brief : '';
      return { key: (room.seedCode || room.id || room.title) + brief, identity: room, location, shellName, shellId: id, chat: summary + brief,
        task: summary + brief + '\nInspect the workspace to work out the key.',
        submit: 'solve ', matchesAnswer: session.matchesAnswer,
        done: session.isSolved?.() ? 'This puzzle is already complete.' : '',
        plan: summary + brief + '\nUse /exit and hint for the current checkpoint’s first clue.' };
    }

    function mcodeSession() {
      const key = logKey(S.shell);
      if (!harnesses.has(key) && TP.mcode) {
        const { mode, shell: id } = S;
        const visible = () => mounted && mcodeAvailable() && logKey(S.shell) === key;
        harnesses.set(key, TP.mcode.create({
          unlocked: mcodeAvailable,
          ai: () => A.ai,
          // A host that reaches the model API for an isolated terminal (the Cyber Desktop) provides A.ai.models.
          models: async signal => {
            if (A.ai?.models) return await A.ai.models(signal);
            const response = await fetch('/api/models', { signal });
            if (!response.ok) throw new Error('Models unavailable');
            const { models = [] } = await response.json();
            return models.filter(model => !model.cloud && !/embed|(?:^|[-:])cloud$|^free-/i.test(model.name || ''))
              .map(model => model.name).filter(Boolean);
          },
          // Sealed Python/JavaScript interpreter (web/js/interp.js): no network, files or page access.
          interp: A.interp ? (lang, code, signal) => A.interp.run(lang, code, { isolated: true, collectFigures: false, signal }).then(A.interp.asText) : null,
          catalog: async signal => {
            if (A.ai?.catalog) return await A.ai.catalog(signal);
            const response = await fetch('/api/models', { signal });
            if (!response.ok) throw new Error('Models unavailable');
            const { models = [], hardware = null } = await response.json();
            // mcode's own larger-context copies (name-agent, name-64k-agent) are the same weights, so they are left out.
            return { hardware, models: models.filter(model => !model.cloud && !/embed|(?:^|[-:])cloud$|^free-|-agent(?:-\d+k)?(?::latest)?$|-\d+k-agent(?::latest)?$/i.test(model.name || '')) };
          },
          swarmStore: { load: () => TP.readSave?.('tpg_mcode_swarm'), save: value => TP.writeSave?.('tpg_mcode_swarm', value) },
          // The whip cracks against the terminal output, where mcode writes its reply.
          // Each change also repaints the 🪢 /whip button, so Ctrl+C and a solved puzzle switch it off too.
          // The whip is drawn inside this terminal only: its own pointer events, its own canvas box, nothing of the rest
          // of the app. A terminal in another tab cannot turn it on either — `host` is the element it was mounted in.
          whipCursor: A.mcodeWhip ? {
            on: onCrack => { A.mcodeWhip.on({ onCrack, host: el, target: () => visible() ? $('tpgout') : null }); paintWhipButton(); },
            off: () => { A.mcodeWhip.off(); paintWhipButton(); }
          } : null,
          context: () => mcodeContext(mode, id),
          recent: () => S.logs[key].slice(-40).map(entry => entry.t),
          visible,
          shell: command => exec(command, 'agent'),
          submitVerified: (expected, answer) => {
            const current = mcodeContext(mode, id);
            if (!visible() || current.key !== expected.key || current.identity !== expected.identity) return 'changed';
            if (current.done) return 'done';
            if (!current.submit || !current.matchesAnswer) return 'unavailable';
            if (!answer || /[\u0000-\u001f\u007f]/.test(answer) || !current.matchesAnswer(answer)) return 'incorrect';
            exec(current.submit + answer, 'agent');
            const after = mcodeContext(mode, id);
            return after.done || after.key !== current.key || after.identity !== current.identity ? 'submitted' : 'failed';
          },
          refresh: () => { if (visible()) { paintOut(); paintPrompt(); } },
          save: () => saveView(key),
          write: text => { const entry = { k: 'out', t: text }; S.logs[key].push(entry); saveView(key); if (visible()) { paintOut(); paintPrompt(); } return entry; }
        }));
      }
      return harnesses.get(key);
    }

    function paintMcodeSetting() {
      const slot = $('tpgmcodectl');
      if (slot) slot.innerHTML = TP.mcode && TP.mcodeIsUnlocked() ?
        '<button type="button" class="ib' + (mcodeEnabled ? ' on' : '') + '" data-act="mcodeswitch" role="switch" aria-checked="' +
        mcodeEnabled + '" aria-label="mcode in Terminal Playground">mcode ' + (mcodeEnabled ? 'on' : 'off') + '</button>' +
        (mcodeEnabled && window.McodeSwarm ? ' <button type="button" class="ib" data-act="mcodeswarm" title="Run several local agents at once, one per role">/swarm</button>' : '') +
        (mcodeEnabled && A.mcodeWhip ? ' <button type="button" class="ib" data-act="mcodewhip" aria-pressed="false" title="Turn your pointer into a whip: crack it over the reply to make mcode go faster (Ctrl+C puts it away)">🪢 /whip</button>' : '') : '';
      if (!mcodeAvailable()) for (const harness of harnesses.values()) harness.close();
      paintWhipButton();
      paintPrompt();
    }

    /* the 🪢 /whip button is lit while this shell's mcode has the whip out */
    function paintWhipButton() {
      const button = $('tpgmcodectl')?.querySelector?.('[data-act="mcodewhip"]');
      if (!button) return;
      const out = !!harnesses.get(logKey(S.shell))?.whipping?.();
      button.classList.toggle('on', out);
      button.setAttribute('aria-pressed', String(out));
    }

    function savePuzzle(id) {
      const session = S.puzSessions[id];
      if (!session) return false;
      return TP.writeSave(puzzleSaveKey(id), { ...puzzleSpecs[id], progress: session.snapshot() });
    }

    function puzSession(id, forceNew, customSpec, seedOverride, extraLayers) {
      if (!PUZ || !PUZ.CATEGORIES?.[id]) return null;
      if (forceNew || !S.puzSessions[id]) {
        const saved = !forceNew && TP.readSave(puzzleSaveKey(id));
        const generation = saved?.generated;
        const custom = customSpec || (saved?.custom?.shell === id ? saved.custom : null);
        const options = generation?.shell === id && PUZ.DIFFS[generation.difficulty] ? generation :
          { shell: id, difficulty: S.puzDiff, category: S.puzCat, seed: seedOverride, extraLayers };
        const puzzle = custom ? PUZ.buildCustom(custom) : PUZ.generate(options);
        puzzleSpecs[id] = custom ? { custom } : { generated: { shell: id, difficulty: puzzle.difficulty, ...puzzle.generation } };
        S.puzSessions[id] = PUZ.createSession(puzzle, saved?.progress || {});
        savePuzzle(id);
        if (forceNew) {
          const key = 'puz:' + id;
          S.logs[key] = [{ k: 'dim', t: S.puzSessions[id].welcome() }];
          drafts[key] = '';
          delete coachReports[key];
          saveView(key);
        }
      }
      return S.puzSessions[id];
    }

    const labSession = id => {
      if (!LAB || !LAB.session || !Array.isArray(LAB.flavors) || !LAB.flavors.includes(id)) return null;
      if (!S.lab[id]) {
        const session = S.lab[id] = LAB.session(id);
        if (session.depth() < labNoteDepth) {
          const room = session.room();
          const tree = room.snapshot?.()?.tree;
          if (tree && discoveryNote('lab:' + id, room, 'sandbox', room.depth).removeFrom(tree)) session.save();
        }
      }
      return S.lab[id];
    };

    function shellLog(id) {
      const key = logKey(id);
      const saved = !S.logs[key] && TP.readSave(terminalSaveKey(key));
      if (Array.isArray(saved?.log)) {
        S.logs[key] = saved.log.filter(row => row && typeof row.t === 'string');
      }
      if (!S.logs[key]) {
        if (S.mode === 'lab') {
          const s = labSession(id);
          S.logs[key] = s ? [{ k: 'dim', t: s.welcome() }] : [{ k: 'dim', t: 'The labyrinth engine did not load.' }];
        } else if (S.mode === 'puzzle') {
          const s = puzSession(id);
          S.logs[key] = s ? [{ k: 'dim', t: s.welcome() }] : [{ k: 'dim', t: 'The puzzle studio did not load.' }];
        } else {
          const sh = byId(id);
          S.logs[key] = [
            { k: 'dim', t: sh.about },
            { k: 'dim', t: sh.range
              ? 'A simulated, offline range: every host, account, file and flag is invented. Type help for the commands, targets for scope, status for the objectives.'
              : 'Type help for commands, job start for an assignment, or curios for the discovery journal.' }
          ];
          if (sh.range) S.logs[key].push({ k: 'dim', t: sh.run('status') });
          if (sh.jobs?.().active) S.logs[key].push({ k: 'dim', t: sh.run('job status') });
        }
      }
      if (!S.hist[key]) S.hist[key] = Array.isArray(saved?.history) ? saved.history.filter(value => typeof value === 'string') : [];
      if (S.hi[key] == null || S.hi[key] > S.hist[key].length) S.hi[key] = S.hist[key].length;
      if (drafts[key] == null) drafts[key] = typeof saved?.draft === 'string' ? saved.draft : '';
      if (saved?.coach && typeof saved.coach.title === 'string') coachReports[key] = saved.coach;
      return S.logs[key];
    }

    function saveView(key) {
      const log = (S.logs[key] || []).slice(-80).map(({ k, t }) => ({ k, t: t.slice(-1800) }));
      const recent = (S.hist[key] || []).slice(-80).map(line => line.slice(0, 1200));
      let logSize = log.reduce((sum, line) => sum + line.t.length, 0);
      let historySize = recent.reduce((sum, line) => sum + line.length, 0);
      while (logSize > 20000) logSize -= log.shift().t.length;
      while (historySize > 10000) historySize -= recent.shift().length;
      return TP.writeSave(terminalSaveKey(key), { log, history: recent, draft: drafts[key] || '', coach: coachReports[key] });
    }

    function saveProgress() {
      const id = S.shell;
      const workspace = S.mode === 'lab' ? labSession(id)?.save() :
        S.mode === 'puzzle' ? savePuzzle(id) : current().saveWorkspace?.();
      const screen = saveView(logKey(id));
      if (A.toast) A.toast(workspace && screen ? (api?.temporary ? 'Progress saved for this live session.' : 'Progress saved on this device.') : 'Local storage could not save all progress.');
    }

    const current = () => byId(S.shell);
    const curLog = () => shellLog(S.shell);

    function paintOut() {
      const out = $('tpgout');
      if (!out) return;
      const log = curLog();
      if (log.length > 480) log.splice(0, log.length - 480);
      out.innerHTML = log.map(l => {
        const col = l.k === 'cmd' ? userColor() : l.k === 'dim' ? '#8593a3' : l.k === 'ok' ? '#6ee7a0' : '#cfe9d6';
        return '<span style="color:' + col + '">' + String(l.t).split('\n').map(esc).join('\n') + '</span>';
      }).join('\n');
      out.scrollTop = out.scrollHeight;
    }

    let explained = false;

    function paintCoach() {
      const body = $('tpgcoachbody'), label = $('tpgcoachlabel');
      if (!body || !label) return;
      const report = coachReports[logKey(S.shell)];
      label.textContent = report?.title || 'Ready';
      if (label.dataset) label.dataset.tone = report?.kind || 'neutral';
      if (!report) { body.textContent = 'Run a command to see its explanation here.'; return; }
      const list = (title, entries) => Array.isArray(entries) && entries.length ?
        '<h4>' + title + '</h4><ul>' + entries.map(text => '<li>' + esc(text) + '</li>').join('') + '</ul>' : '';
      const commands = Array.isArray(report.commands) ? report.commands : [];
      body.innerHTML = '<header>' + (report.command ? '<code>' + esc(report.command) + '</code>' : '') +
        (Number.isInteger(report.status) ? '<span>Exit code ' + report.status + '</span>' : '') + '</header>' +
        list('Why it behaved this way', report.why) + list('What to try', report.next) +
        ((report.manual && manual) || commands.length ? '<div class="tpg-coach-actions">' +
          (report.manual && manual ? '<button class="ib" type="button" data-act="coachhelp">Open command help</button>' : '') +
          commands.map((command, i) => '<button class="ib" type="button" data-act="coachtry" data-step="' + i + '">Put <code>' + esc(command) + '</code> on prompt</button>').join('') +
          '</div>' : '');
    }

    /* Every command must leave an explanation under the terminal. coachNote writes one directly;
       explain builds it from the coach and falls back to its own text when the coach cannot. */
    function coachNote(report) {
      explained = true;
      coachReports[logKey(S.shell)] = { status: null, commands: [], manual: '', ...report };
      paintCoach();
    }

    function explain(command, out, result, trace) {
      const text = String(out == null ? '' : out).trim();
      let report = null;
      try { report = TP.coach ? TP.coach.analyze({ shell: S.shell, mode: S.mode, command, out, trace, ...(result || {}) }) : null; }
      catch (e) { report = null; }
      const usable = report && typeof report.title === 'string' && report.title &&
        Array.isArray(report.why) && report.why.some(Boolean);
      if (usable) { coachNote(report); return; }
      const first = text.split('\n').find(line => line.trim()) || text;
      coachNote({
        title: text ? 'Command produced output' : 'Command ran without printing text', kind: 'neutral',
        command: String(command || '').slice(0, 420),
        why: [text ? 'The terminal printed: ' + first.trim().slice(0, 300) :
          'The command was handled and printed no text. A quiet command can still change the workspace, so check its effect with a follow-up command.'],
        next: ['Type help to see the commands this terminal accepts.']
      });
    }

    function currentPrompt() {
      const harness = harnesses.get(logKey(S.shell));
      if (harness?.open()) return harness.prompt();
      if (S.mode === 'lab') { const s = labSession(S.shell); return s ? s.prompt() : '$ '; }
      if (S.mode === 'puzzle') { const s = puzSession(S.shell); return s ? s.prompt() : '$ '; }
      return current().prompt();
    }
    /* dots instead of letters while the shell is asking for a password */
    function maskInput() {
      const inp = $('tpgin');
      if (inp?.style) inp.style.webkitTextSecurity = current()?.secret?.() ? 'disc' : '';
    }

    /* Drag files from this PC onto the terminal: text files up to 2 MB each (20 at a time) are copied into the current
       folder of the sandbox machine you are on, where cat, bash, scp and the rest can use them. Only a copy goes in;
       the sandbox never writes back to this PC. */
    async function importDropped(files) {
      const sh = current();
      if (S.mode !== 'sandbox' || !sh?.importFile) { (window.A?.toast && A.toast('Drop files on the Bash sandbox to copy them in.')); return; }
      const placed = [], skipped = [];
      for (const file of [...files].slice(0, 20)) {
        if (file.size > 2 * 1024 * 1024) { skipped.push(file.name + ' (over 2 MB)'); continue; }
        let text = '';
        try { text = await file.text(); } catch (e) { skipped.push(file.name); continue; }
        if (text.includes('\u0000')) text = '(binary file copied from this PC: ' + file.size + ' bytes)\n';
        const where = sh.importFile(file.name, text);
        if (where) placed.push(where); else skipped.push(file.name);
      }
      const log = curLog();
      if (placed.length) log.push({ k: 'out', t: 'Copied ' + placed.length + ' file' + (placed.length === 1 ? '' : 's') + ' from this PC:\n' + placed.join('\n') });
      if (skipped.length) log.push({ k: 'out', t: 'Not copied: ' + skipped.join(', ') });
      saveView(logKey(S.shell)); paintOut();
    }

    function paintPrompt() {
      const p = $('tpgprompt');
      if (p) {
        p.textContent = currentPrompt();
        const harness = harnesses.get(logKey(S.shell));
        if (p.style) p.style.color = harness?.open() ? harness.color() : userColor();
      }
    }

    function palette() {
      const security = S.shell === 'bash' ? [['security-tools', 'list the bundled evidence and analysis commands']] : [];
      if (S.mode === 'lab') {
        const s = labSession(S.shell);
        if (!s) return [];
        const room = s.room();
        return (room.palette || []).concat([
          ['solve <answer>', 'open the next checkpoint or descend'],
          ['hint', 'a nudge about this room'],
          ['depth', 'depth, kind and failed attempts'],
          ['save', 'save the current checkpoint and workspace'],
          ['map', 'the shape of the descent']
        ], security);
      }
      if (S.mode === 'puzzle') {
        const s = puzSession(S.shell);
        if (!s) return [];
        return (s.puzzle.palette || []).concat([
          ['solve <answer>', 'verify your answer'],
          ['hint', 'get a hint for this puzzle'],
          ['walkthrough', 'reveal the solution steps']
        ], security);
      }
      return current().commands;
    }

    // Commands relevant to the current mission/puzzle/room, shown at the top of `help`.
    function helpCmds() {
      return palette().slice(0, 8).map(c => Array.isArray(c) ? [c[0], c[1]] : [c.ex || '', c.d || '']).filter(c => c[0]);
    }
    function buildHelpContext() {
      try {
        if (S.mode === 'puzzle') {
          const s = puzSession(S.shell);
          if (!s) return null;
          const pz = s.puzzle;
          const obj = pz.custom ? 'Solve this custom puzzle, then verify with `solve <answer>`.'
            : (pz.brief ? pz.brief + '\nVerify with `solve <answer>`.' : (pz.title || 'Solve the puzzle') + ' — verify with `solve <answer>`.');
          return { heading: 'THIS PUZZLE', commands: helpCmds(),
            objective: (s.isSolved?.() ? '✓ Solved. `walkthrough` shows the steps, or generate a new puzzle.\n' : '') + obj + '\n`hint` gives a nudge; `walkthrough` reveals the steps.' };
        }
        if (S.mode === 'lab') {
          const s = labSession(S.shell);
          if (!s) return null;
          const room = s.room();
          return { heading: 'THIS LABYRINTH ROOM', commands: helpCmds(),
            objective: (room.title || 'Room') + (room.brief ? '\n' + room.brief : '') + '\nDescend with `solve <answer>`. `hint` nudges, `map` shows the descent, `depth` shows progress.' };
        }
        const job = current().mcodeJob?.();
        if (job) return { heading: 'THIS JOB', commands: helpCmds(),
          objective: job.title + '\n' + job.task + (job.solved ? '\n✓ Complete — `job next` for a fresh assignment.' : '\nSubmit with `job submit <answer>`; `job hint` nudges.') };
        return { heading: 'FREE PLAY', commands: null,
          objective: 'No active mission. `job start` picks up a practice assignment; `curios` opens the discovery journal; switch to Puzzles or Labyrinth for a challenge.' };
      } catch (e) { return null; }
    }

    function paintPalette() {
      const list = $('tpgpal');
      if (!list) return;
      const q = S.filter.toLowerCase();
      const norm = palette().map(c => Array.isArray(c) ? c : [c.ex || '', c.d || '']);
      const rows = norm.filter(c => !q || (c[0] + ' ' + c[1]).toLowerCase().includes(q));
      const putOnly = S.mode !== 'sandbox';
      list.innerHTML = rows.length
        ? rows.map(c => '<button data-ex="' + esc(c[0]) + '" title="' + (putOnly ? 'Put this in the prompt' : 'Run this example') + '" style="display:block;width:100%;text-align:left;cursor:pointer;border:0;border-bottom:1px solid rgba(255,255,255,.05);background:transparent;color:inherit;padding:6px 4px">' +
          '<div style="' + mono + ';font-size:11.5px;color:#9fc7ea;white-space:pre-wrap;word-break:break-word">' + esc(c[0]) + '</div>' +
          '<div class="small mute" style="margin-top:1px;line-height:1.35">' + esc(c[1]) + '</div></button>').join('')
        : '<div class="small mute" style="padding:8px">nothing matches</div>';
    }

    function paintMeta() {
      const rw = $('tpgrwd');
      if (rw && window.TerminalRewards) rw.innerHTML = TerminalRewards.chip();
      const sh = current();
      const t = $('tpgtitle');
      const a = $('tpgabout');
      const n = $('tpgcount');
      const g = $('tpggroup');
      if (S.mode === 'lab') {
        const s = labSession(sh.id);
        if (t) t.textContent = sh.icon + ' ' + sh.name + ' · labyrinth';
        if (a) a.textContent = s ? 'Depth ' + s.depth() + ' · ' + s.checkpointLabel() + ' · ' + s.rating() + ' · best depth ' + s.best() : 'The labyrinth engine did not load.';
        if (n) n.textContent = s ? 'depth ' + s.depth() : '';
        if (g) g.textContent = sh.group;
        return;
      }
      if (S.mode === 'puzzle') {
        const s = puzSession(sh.id);
        const st = PUZ ? PUZ.loadStats() : { solved: 0, streak: 0 };
        const dObj = PUZ && s ? (PUZ.DIFFS[s.puzzle.difficulty] || PUZ.DIFFS.medium) : { icon: '🧩', label: 'Puzzle' };
        if (t) t.textContent = sh.icon + ' ' + sh.name + ' · ' + dObj.icon + ' ' + dObj.label;
        if (a) a.textContent = 'Generate unlimited ' + sh.name + ' puzzles by difficulty & category, load shareable seeds, or build your own custom puzzles to solve.';
        if (n) n.textContent = '✓ ' + st.solved + ' solved · 🔥 ' + st.streak + ' streak';
        if (g) g.textContent = sh.group + ' · Puzzle Studio';
        return;
      }
      const jobs = sh.jobs?.();
      if (t) t.textContent = sh.icon + ' ' + sh.name + (jobs?.active ? ' · practice job' : '');
      if (a) a.textContent = sh.about;
      if (n) n.textContent = sh.commands.length + ' examples';
      if (g) g.textContent = sh.group;
      const panel = $('tpgjobs');
      if (panel) panel.innerHTML = jobPanel(sh);
    }

    /* ---- Sandbox scenarios (web/js/terminal-scenarios.js): randomize the disk, edit every file as text, save named setups ---- */
    const scenarioShell = () => S.mode === 'sandbox' && TP.scenarios && ['bash', 'powershell', 'cmd'].includes(S.shell);

    /* ---- Scenario Lab: every parameter of a generated case, or ask the local model to invent one ---- */
    const LORE = () => window.TerminalLore || null;
    const labs = { mode: '', msg: '', busy: false };
    const loreForm = () => {
      const L = LORE();
      if (!L) return '<div class="small" style="color:var(--bad)">The lore engine did not load — check terminal-lore.js.</div>';
      const row = (label, control) => '<label class="small mute" style="display:block;margin-top:6px">' + label + '</label>' + control;
      const sel = (id, list, extra) => '<select id="' + id + '" style="width:100%;font-size:12px;padding:3px">' + extra + list.map(x => '<option value="' + x.id + '">' + esc(x.label) + '</option>').join('') + '</select>';
      return '<div style="margin-top:4px">' +
        row('Theme — who owns the disk', sel('tpgtheme', L.OPTIONS.themes, '<option value="">🎲 Random</option>')) +
        row('How much of a life is on the disk', sel('tpgdepth', (L.OPTIONS.difficulty || []), '<option value="">🎲 Seeded</option>')) +
        row('Organisation (blank = invented)', '<input id="tpgorg" placeholder="e.g. Ministry of Water and Grid" style="width:100%;box-sizing:border-box;font-size:12px">') +
        '<div class="row" style="gap:6px;margin-top:6px"><div style="flex:1">' + row('Seed (same seed = same case)', '<input id="tpgseed" placeholder="random" style="width:100%;box-sizing:border-box;font-size:12px">') + '</div>' +
        '<div style="flex:1">' + row('Juicy documents (0–14)', '<input id="tpgsecrets" type="number" min="0" max="14" value="5" style="width:100%;box-sizing:border-box;font-size:12px">') + '</div></div>' +
        '<div class="row" style="gap:6px"><div style="flex:1">' + row('Decoy files (0–400)', '<input id="tpgextra" type="number" min="0" max="400" value="4" style="width:100%;box-sizing:border-box;font-size:12px">') + '</div>' +
        '<div style="flex:1">' + row('Clutter', sel('tpgnoise', L.OPTIONS.noise)) + '</div></div>' +
        row('Which secrets may appear', '<div id="tpgcats" class="small" style="max-height:132px;overflow:auto;border:1px solid var(--line);border-radius:8px;padding:5px;line-height:1.7">' +
          L.OPTIONS.secrets.map(s => '<label style="display:inline-flex;gap:3px;align-items:center;width:49%" title="juice ' + s.juice + '/3"><input type="checkbox" data-lcat="' + s.id + '"> ' + s.icon + ' ' + esc(s.label) + '</label>').join('') + '</div>') +
        '<label class="small mute" style="display:flex;gap:5px;align-items:center;margin-top:6px"><input type="checkbox" id="tpgmcode"> Drop an mcode note in the disk</label>' +
        '<div class="small mute" style="margin-top:4px">Leave the secret boxes unticked to let the generator pick from every category.</div>' +
        '<div class="row" style="gap:5px;flex-wrap:wrap;margin-top:6px"><button class="pri" data-act="labbuild">Build &amp; load</button>' +
        '<button class="ib" data-act="labedit">Build into editor</button><button class="ib" data-act="labsave">Build &amp; save</button>' +
        '<button class="ib" data-act="labclose">Close</button></div>' +
        '<div class="small" style="margin-top:5px">' + esc(labs.msg || '') + '</div></div>';
    };
    const aiForm = () => '<div style="margin-top:4px">' +
      '<div class="small mute">Describe the case you want and the local model fills in the parameters: the organisation, how many documents, which kinds of secret, how much clutter. Nothing leaves this PC.</div>' +
      '<textarea id="tpgaiq" rows="4" spellcheck="false" placeholder="e.g. a shipping company smuggling weapons through Trieste, 8 documents, lots of customs clutter, one blackmail file" style="width:100%;box-sizing:border-box;font-size:12px;margin-top:5px"></textarea>' +
      '<div class="row" style="gap:5px;flex-wrap:wrap;margin-top:6px"><button class="pri" data-act="aigo" ' + (labs.busy ? 'disabled' : '') + '>' + (labs.busy ? 'Thinking…' : '✨ Generate the case') + '</button>' +
      '<button class="ib" data-act="labcustom">Fine-tune by hand</button><button class="ib" data-act="labclose">Close</button></div>' +
      '<div class="small" style="margin-top:5px">' + esc(labs.msg || '') + '</div></div>';
    function scenarioPanel() {
      const saved = TP.scenarios.list();
      const rows = saved.slice(0, 8).map(item => '<div class="row" style="gap:5px;align-items:center;margin-top:4px">' +
        '<span class="small" style="flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap" title="' + esc(item.name) + '">' + esc(item.name) + '</span>' +
        '<span class="small mute">' + esc(item.shell || '') + '</span>' +
        '<button class="ib" data-act="scenload" data-name="' + esc(item.name) + '" title="Put these files on the disk" style="padding:2px 7px;font-size:11.5px">Load</button>' +
        '<button class="ib" data-act="scendel" data-name="' + esc(item.name) + '" title="Delete this saved scenario" style="padding:2px 7px;font-size:11.5px">✕</button></div>').join('');
      if (!S.scen) {
        return '<div class="tpgsc-panel" style="' + box + ';padding:8px 10px;margin-bottom:8px">' +
          '<div class="row" style="gap:6px;align-items:center;flex-wrap:wrap"><b class="small">🗂 Scenarios</b><span style="flex:1"></span>' +
          '<button class="ib" data-act="scenrand" title="Fill the home folder with a new random case">🎲 Randomize</button>' +
          '<button class="ib" data-act="labcustom" title="Choose the theme, organisation, documents and clutter">🛠 Customize</button>' +
          '<button class="ib" data-act="labai" title="Describe a case and let the local model build it">✨ Ask AI</button>' +
          '<button class="ib" data-act="scenedit" title="Edit every file in the home folder as text">✏ Edit files</button></div>' +
          (labs.mode === 'custom' ? loreForm() : labs.mode === 'ai' ? aiForm() : '') +
          (rows || '<div class="small mute" style="margin-top:4px">Saved scenarios appear here. Every random disk is a whole invented case — a fictional organisation, its paperwork, and documents it would rather you never read.</div>') + '</div>';
      }
      return '<div class="tpgsc-panel" style="' + box + ';padding:8px 10px;margin-bottom:8px">' +
        '<div class="row" style="gap:6px;align-items:center;margin-bottom:5px"><b class="small">✏ Scenario files</b><span style="flex:1"></span><button class="ib" data-act="scenclose">Close</button></div>' +
        '<input id="tpgscenname" placeholder="Scenario name" value="' + esc(S.scen.name || '') + '" style="width:100%;box-sizing:border-box;font-size:12px;margin-bottom:5px">' +
        '<textarea id="tpgscentext" spellcheck="false" rows="14" style="width:100%;box-sizing:border-box;' + mono + ';font-size:11.5px;line-height:1.45">' + esc(S.scen.text || '') + '</textarea>' +
        '<div class="small mute" style="margin:3px 0 5px">Each file starts with a line <code>=== path/name.txt</code>; <code>=== folder/</code> makes an empty folder.</div>' +
        '<div class="row" style="gap:5px;flex-wrap:wrap"><button class="pri" data-act="scenapply" title="Replace the home folder with these files">Apply to disk</button>' +
        '<button class="ib" data-act="scensave" title="Save these files as a named scenario">Save</button>' +
        '<button class="ib" data-act="scenrandtext" title="Fill the editor with a random project">🎲 Random</button>' +
        '<button class="ib" data-act="scencurrent" title="Load the files that are on the disk now">Reload disk</button></div>' +
        (S.scen.msg ? '<div class="small" style="margin-top:5px">' + esc(S.scen.msg) + '</div>' : '') + rows + '</div>';
    }
    // Puts files on the free sandbox disk (not a practice job), saves it, and returns to the home folder.
    function applyScenario(files, label) {
      const shell = byId(S.shell);
      if (shell.jobs?.().active) return 'Leave the practice job first (job leave), then load a scenario.';
      const target = discoveryTree();
      if (!target || !TP.scenarios.apply(target.tree, target.home, target.win, files)) return 'This shell has no disk to change.';
      try { shell.run(S.shell === 'cmd' ? 'cd C:\\Users\\moundshroud' : 'cd ~'); } catch (e) { }
      shell.saveWorkspace?.();
      const count = Object.values(files).filter(text => text != null).length;
      curLog().push({ k: 'dim', t: 'Scenario loaded: ' + label + ' · ' + count + ' file' + (count === 1 ? '' : 's') + '. Try ' + (S.shell === 'bash' ? 'ls -R' : 'dir') + ' to look around.' });
      saveView(logKey(S.shell));
      return '';
    }
    const scenarioText = () => {
      const target = discoveryTree();
      return target ? TP.scenarios.serialize(TP.scenarios.read(target.tree, target.home, target.win)) : '';
    };
    /* read every knob on the Customize form; anything blank falls back to the generator */
    function readLabOpts() {
      const v = id => ($(id) && $(id).value) || '';
      const cats = [...el.querySelectorAll('[data-lcat]')].filter(x => x.checked).map(x => x.dataset.lcat);
      const noise = v('tpgnoise') || 'some';
      let extra = v('tpgextra') === '' ? 4 : Number(v('tpgextra')) || 0;
      if (noise === 'lots') extra = Math.max(extra, 9);
      if (noise === 'none') extra = 0;
      return { theme: v('tpgtheme'), org: v('tpgorg').trim(), seed: Number(v('tpgseed')) || 0, secrets: v('tpgsecrets') === '' ? 4 : Number(v('tpgsecrets')) || 0, extra, noise, difficulty: v('tpgdepth'), mcode: !!($('tpgmcode') && $('tpgmcode').checked), categories: cats };
    }
    function caseSummary(sc) {
      const s = (sc.lore && sc.lore.secrets) || [];
      if (!sc.lore) return sc.name;
      return sc.lore.icon + ' ' + sc.lore.org + ' (' + sc.lore.theme + ', ' + sc.lore.unit + ') · case ' + sc.lore.caseId + ' · ' + s.length + ' juicy document' + (s.length === 1 ? '' : 's') + (s.length ? ': ' + s.slice(0, 6).map(x => x.label).join(', ') + (s.length > 6 ? '…' : '') : '');
    }
    function buildCase(mode) {
      if (!LORE()) { labs.msg = 'The lore engine did not load.'; return draw(); }
      const opts = readLabOpts();
      let sc;
      try { sc = TP.scenarios.randomize(S.shell, opts.seed || undefined, opts); }
      catch (e) { labs.msg = 'Could not build that case: ' + e.message; return draw(); }
      const summary = caseSummary(sc);
      if (mode === 'editor' || mode === 'save') {
        S.scen = { name: sc.name, text: TP.scenarios.serialize(sc.files), msg: summary };
        if (mode === 'save') { const saved = TP.scenarios.save(sc.name, S.shell, sc.files); if (saved) S.scen.name = saved; labs.msg = 'Saved "' + sc.name + '". ' + summary; return draw(); }
        labs.msg = summary;
        return draw();
      }
      const err = applyScenario(sc.files, sc.name);
      labs.msg = err || summary;
      if (err && A.toast) A.toast(err);
      draw();
    }
    /* the Ask AI box: the local model answers with the parameters, the generator writes the case */
    async function askCase() {
      const L = LORE();
      if (!L) { labs.msg = 'The lore engine did not load.'; return draw(); }
      const q = ($('tpgaiq') && $('tpgaiq').value || '').trim();
      const model = (document.getElementById('model') || {}).value || ls.get('model', '');
      labs.busy = true; labs.msg = 'Asking ' + (model || 'the local model') + '…'; draw();
      const ask = 'Design one fictional computer-forensics training case for a terminal sandbox. Reply with JSON only, no prose. Keys: theme (one of ' + L.OPTIONS.themes.map(t => t.id).join(', ') + '), org (an invented organisation name, max 40 characters, never a real company or agency), secrets (a number 3-10), categories (3-8 items from: ' + L.OPTIONS.secrets.map(s => s.id).join(', ') + '), extra (0-12 decoy files), noise ("none" or "some" or "lots"), note (one sentence of story).' + (q ? ' The player asked for: ' + q : '');
      let msg = '';
      try {
        const r = await fetch('/api/chat', { method: 'POST', body: JSON.stringify({ model, stream: false, think: false, keep_alive: '3m', format: 'json', messages: [{ role: 'system', content: 'You invent fictional security-exercise scenarios. Fiction only, invented organisations only. Answer with JSON.' }, { role: 'user', content: ask }] }) });
        const j = await r.json();
        msg = String((j.message && j.message.content) || j.response || '');
        const spec = JSON.parse(msg.slice(msg.indexOf('{'), msg.lastIndexOf('}') + 1));
        const opts = Object.assign({ shell: S.shell }, L.normalize({
          theme: L.OPTIONS.themes.some(t => t.id === spec.theme) ? spec.theme : '',
          org: String(spec.org || '').slice(0, 40),
          secrets: spec.secrets, extra: spec.extra, noise: spec.noise,
          categories: (Array.isArray(spec.categories) ? spec.categories : []).filter(id => L.OPTIONS.secrets.some(s => s.id === id))
        }));
        const sc = TP.scenarios.randomize(S.shell, undefined, opts);
        const err = applyScenario(sc.files, sc.name);
        labs.busy = false; labs.mode = '';
        labs.msg = '';
        if (err) labs.msg = err;
        if (A.toast) A.toast((spec.note ? spec.note + ' — ' : '') + caseSummary(sc));
        const target = discoveryTree();
        if (target) {
          curLog().push({ k: 'dim', t: 'Case loaded: ' + caseSummary(sc) });
          if (sc.lore) curLog().push({ k: 'dim', t: 'Every file here is invented for practice. Look in ' + (S.shell === 'bash' ? 'intel/' : 'Documents\\Restricted\\') + ' and read the paperwork like an investigator.' });
          saveView(logKey(S.shell));
        }
        return draw();
      } catch (e) {
        labs.busy = false;
        labs.msg = 'The model did not answer usefully (' + (e && e.message || e) + '). Try again, or use Customize to set the parameters by hand.';
        draw();
      }
    }
    /* Any scenario, any size: the local model writes the story, the files and the key, the builder pads the room to the
       file count the player asked for. The room is a normal custom puzzle, so ls/cd/cat/grep/find all work in it. */
    async function askAiPuzzle() {
      const q = ($('puzaiq') && $('puzaiq').value || '').trim();
      if (!q) { if (A.toast) A.toast('Describe the scenario you want first.'); return; }
      const maxFiles = PUZ.ROOM_FILES_MAX || 20000;
      const size = Math.max(1, Math.min(maxFiles, Math.trunc(Number($('puzaisize') && $('puzaisize').value)) || 40));
      const model = (document.getElementById('model') || {}).value || ls.get('model', '');
      S.puzAi = { busy: true, msg: 'Asking ' + (model || 'the local model') + ' for a ' + size + '-file room…' };
      draw();
      const stop = typeof AbortController === 'function' ? new AbortController() : null;
      const timer = stop ? setTimeout(() => stop.abort(), 240000) : null;
      try {
        const r = await fetch('/api/chat', { method: 'POST', signal: stop ? stop.signal : undefined, body: JSON.stringify({
          model, stream: false, think: false, keep_alive: '3m', format: 'json',
          messages: [
            { role: 'system', content: 'You invent complete fictional terminal puzzles. Fiction only, invented people and organisations only, never a real company, agency or person. Answer with JSON.' },
            { role: 'user', content: PUZ.aiPlanPrompt(q, size) }
          ]
        }) });
        const j = await r.json();
        if (timer) clearTimeout(timer);
        const plan = PUZ.parseAiPlan(String((j.message && j.message.content) || j.response || ''));
        if (!plan || !plan.answer) throw new Error('the reply had no key to check');
        if (!Object.keys(plan.files).length) throw new Error('the reply had no files');
        const item = PUZ.addCustom(PUZ.buildAiRoom(plan, { shell: S.shell, difficulty: S.puzDiff, files: size }));
        const made = Object.keys(item.files || {}).length;
        S.puzAi = { busy: false, msg: '' };
        S.mode = 'puzzle'; ls.set('tpg_mode', S.mode); S.filter = '';
        S.puzDiff = item.difficulty; S.puzCat = 'auto';
        ls.set('tpg_pdiff', S.puzDiff);
        puzSession(S.shell, true, item);
        if (A.toast) A.toast('AI puzzle loaded · ' + made + ' files. Work in the room, then type: solve <answer>');
        draw();
      } catch (e) {
        if (timer) clearTimeout(timer);
        S.puzAi = { busy: false, msg: 'The model did not answer usefully (' + ((e && e.message) || e) + '). Try again, or describe it more simply.' };
        draw();
      }
    }

    function scenarioClick(act, name) {
      const editor = $('tpgscentext'), title = $('tpgscenname');
      if (act === 'labcustom') { labs.mode = 'custom'; labs.msg = ''; return draw(); }
      if (act === 'labai') { labs.mode = 'ai'; labs.msg = ''; return draw(); }
      if (act === 'labclose') { labs.mode = ''; labs.msg = ''; return draw(); }
      if (act === 'labbuild') return buildCase();
      if (act === 'labedit') return buildCase('editor');
      if (act === 'labsave') return buildCase('save');
      if (act === 'aigo') { askCase(); return; }
      if (S.scen && editor) { S.scen.text = editor.value; S.scen.name = title?.value || ''; }
      if (act === 'scenrand') { const sc = TP.scenarios.randomize(S.shell); const error = applyScenario(sc.files, sc.name); if (error && A.toast) A.toast(error); }
      else if (act === 'scenedit') S.scen = { name: '', text: scenarioText(), msg: '' };
      else if (act === 'scenclose') S.scen = null;
      else if (act === 'scencurrent' && S.scen) { S.scen.text = scenarioText(); S.scen.msg = 'Loaded the files that are on the disk now.'; }
      else if (act === 'scenrandtext' && S.scen) { const sc = TP.scenarios.randomize(S.shell); S.scen.text = TP.scenarios.serialize(sc.files); S.scen.name = sc.name; S.scen.msg = 'Random project ready. Apply it or edit it first.'; }
      else if ((act === 'scenapply' || act === 'scensave') && S.scen) {
        const { files, errors } = TP.scenarios.parse(S.scen.text);
        if (!Object.keys(files).length) S.scen.msg = 'No files found. Start each file with a line === path/name.txt';
        else if (act === 'scenapply') S.scen.msg = applyScenario(files, S.scen.name || 'edited files') || 'Applied ' + Object.keys(files).length + ' entries.' + (errors.length ? ' ' + errors.join('; ') : '');
        else { const saved = TP.scenarios.save(S.scen.name, S.shell, files); S.scen.msg = saved ? 'Saved as "' + saved + '".' : 'This device could not save it.'; if (saved) S.scen.name = saved; }
      }
      else if (act === 'scenload') {
        const item = TP.scenarios.get(name);
        if (item && S.scen) { S.scen.text = TP.scenarios.serialize(item.files); S.scen.name = item.name; S.scen.msg = 'Loaded "' + item.name + '" into the editor. Apply it to use it.'; }
        else if (item) { const error = applyScenario(item.files, item.name); if (error && A.toast) A.toast(error); }
      }
      else if (act === 'scendel' && name) TP.scenarios.remove(name);
      draw();
    }

    function labPanel() {
      const s = labSession(S.shell);
      if (!s) return '<div style="' + box + ';padding:8px" class="small mute">Labyrinth engine not loaded.</div>';
      const room = s.room();
      return '<div style="' + box + ';padding:8px 10px">' +
          '<div class="row" style="gap:6px;align-items:center;margin-bottom:4px"><b class="small">Depth ' + s.depth() + '</b>' + pill(s.tier(), 'var(--acc)') + '<span style="flex:1"></span><span class="small mute">best ' + s.best() + '</span></div>' +
          '<div class="small" style="line-height:1.5">' + esc(room.brief) + '</div>' +
          '<div class="small mute" style="margin-top:5px">' + esc(s.checkpointLabel() + ' · ' + s.rating()) + '</div>' +
          '<div class="row" style="gap:6px;margin-top:7px;flex-wrap:wrap"><button class="ib" data-act="labhint">Hint</button><button class="ib" data-act="labmap">Map</button><button class="ib" data-act="labreset">New descent</button>' +
          (PUZ && room.generation ? '<button class="ib" data-act="labcustomize">Customize in Puzzles</button>' : '') + '</div>' +
        '</div>';
    }

    function puzzleEditor() {
      const { base, saved } = S.puzEditor;
      const spec = saved || {};
      const manual = saved ? !saved.generation : !base;
      const shell = spec.shell || base?.shell || S.shell;
      const difficulty = spec.difficulty || base?.difficulty || S.puzDiff;
      const generation = spec.generation || base?.generation;
      const filesText = spec.filesText || (base?.files
        ? Object.entries(base.files).map(([path, content]) => '=== ' + path + ' ===\n' + content).join('\n')
        : sampleFiles);
      const input = (id, value, attrs = '') => '<input id="' + id + '" value="' + esc(value) + '" ' + attrs + ' style="font-size:12px">';
      const area = (id, value, placeholder, rows) => '<textarea id="' + id + '" rows="' + rows + '" placeholder="' + placeholder + '" style="font-size:12px;resize:vertical">' + esc(value) + '</textarea>';
      return '<div style="' + box + ';padding:9px 10px">' +
        '<div class="row" style="gap:6px;align-items:center;margin-bottom:8px"><b class="small">' + (saved ? 'Edit saved puzzle' : base ? 'Customize this puzzle' : 'Create custom puzzle') + '</b><span style="flex:1"></span><button class="ib" data-act="puzcancel">Cancel</button></div>' +
        '<div style="display:grid;gap:8px">' +
          field('Terminal', '<select id="cpShell">' + shells.map(x => '<option value="' + x.id + '"' + (x.id === shell ? ' selected' : '') + '>' + esc(x.name) + '</option>').join('') + '</select>') +
          field('Difficulty', '<select id="cpDiff">' + Object.values(PUZ.DIFFS).map(d => '<option value="' + d.id + '"' + (d.id === difficulty ? ' selected' : '') + '>' + d.label + '</option>').join('') + '</select>') +
          field('Puzzle setup', '<select id="cpSetup"><option value="generated">Generated scenario</option><option value="files"' + (manual ? ' selected' : '') + '>Editable files</option></select>') +
          '<div id="cpGenerated" style="display:grid;gap:8px">' +
            field('Category', '<select id="cpCategory"></select>') +
            field('Seed', input('cpSeed', generation?.seed, 'type="number" min="1" max="4294967295" placeholder="Random if blank"')) +
          '</div>' +
          '<div id="cpManual" style="display:grid;gap:8px">' +
            field('Files · path = content or === path === blocks', area('cpFiles', filesText, 'README.txt = Find the key', 7)) +
          '</div>' +
          field('Title', input('cpTitle', spec.title, 'maxlength="80" placeholder="' + esc(base?.title || 'Puzzle title') + '"')) +
          field('Mission brief', area('cpBrief', spec.brief, 'Describe what the player needs to find', 2)) +
          field('Expected answer', input('cpAnswer', spec.answer, 'maxlength="200" placeholder="Use generated key if blank"')) +
          '<details><summary class="small" style="cursor:pointer">Hints and walkthrough</summary>' +
            '<div style="display:grid;gap:8px;margin-top:6px">' +
              field('Hints · one per line, shown in order', area('cpHints', spec.hints?.length ? spec.hints.join('\n') : spec.hint, 'First hint', 3)) +
              field('Walkthrough · one step per line', area('cpWalk', spec.walkthrough?.join('\n'), 'First solution step', 3)) +
            '</div></details>' +
          '<div id="cpError" class="small" role="alert"></div>' +
          '<button class="pri" data-act="puzsave">Save &amp; Play</button>' +
        '</div></div>';
    }

    function setupPuzzleEditor() {
      const shell = $('cpShell'), setup = $('cpSetup'), category = $('cpCategory');
      const { base, saved } = S.puzEditor;
      const generation = saved?.generation || base?.generation;
      function sync(preferredCategory) {
        const legacyFiles = saved && !saved.generation && saved.shell === shell.value;
        setup.options[1].disabled = !fileShells.includes(shell.value) && !legacyFiles;
        if (setup.options[1].disabled) setup.value = 'generated';
        const manual = setup.value === 'files';
        $('cpGenerated').style.display = manual ? 'none' : 'grid';
        $('cpManual').style.display = manual ? 'grid' : 'none';
        $('cpAnswer').placeholder = manual ? 'Required for editable files' : 'Use generated key if blank';
        const categories = PUZ.CATEGORIES[shell.value];
        category.innerHTML = categories.map(([id, label]) => '<option value="' + id + '">' + esc(label) + '</option>').join('');
        category.value = categories.some(([id]) => id === preferredCategory) ? preferredCategory : 'auto';
        $('cpError').textContent = '';
      }
      sync(generation?.category);
      shell.onchange = () => sync(category.value);
      setup.onchange = () => {
        if (base?.files && !saved) {
          const text = {
            cpTitle: base.title, cpBrief: base.brief, cpAnswer: base.answer,
            cpHints: base.hint, cpWalk: base.walkthrough?.join('\n')
          };
          for (const [id, original] of Object.entries(text)) {
            const control = $(id);
            if (setup.value === 'files' && !control.value) control.value = original || '';
            if (setup.value === 'generated' && control.value === original) control.value = '';
          }
        }
        sync(category.value);
      };
    }

    function puzzlePanel() {
      if (!PUZ) return '<div style="' + box + ';padding:8px" class="small mute">Puzzle studio not loaded.</div>';
      const s = puzSession(S.shell);
      if (!s) return '<div style="' + box + ';padding:8px" class="small mute">Puzzle Studio covers the ten standard terminals. A Security range has its own objectives in Sandbox mode.</div>';
      const pz = s.puzzle;
      S.puzDiff = pz.difficulty;
      S.puzCat = pz.generation?.category || 'auto';
      const dObj = PUZ.DIFFS[pz.difficulty] || PUZ.DIFFS.medium;
      const cats = PUZ.CATEGORIES[S.shell] || [['auto', '🎲 Random']];
      const st = PUZ.loadStats();
      const customList = PUZ.loadCustom();

      if (S.puzEditor) return puzzleEditor();

      return '<div style="' + box + ';padding:9px 10px">' +
        '<div class="row" style="gap:4px;align-items:center;margin-bottom:6px;flex-wrap:wrap">' +
          Object.values(PUZ.DIFFS).map(d => '<button class="ib' + (S.puzDiff === d.id ? ' on' : '') + '" data-pdiff="' + d.id + '" style="padding:3px 7px;font-size:11.5px" title="' + esc(d.note) + '">' + d.icon + ' ' + d.label + '</button>').join('') +
        '</div>' +
        '<div class="row" style="gap:5px;margin-bottom:7px;align-items:center">' +
          '<select id="puzcat" style="flex:1;min-width:0;font-size:12px">' + cats.map(([k, lbl]) => '<option value="' + k + '"' + (S.puzCat === k ? ' selected' : '') + '>' + esc(lbl) + '</option>').join('') + '</select>' +
          '<button class="pri" data-act="puznew" style="padding:4px 9px;font-size:12px" title="Generate a fresh puzzle">🎲 New</button>' +
        '</div>' +
        '<div style="border-top:1px solid var(--line);padding-top:7px">' +
          '<div class="row" style="gap:5px;align-items:center;margin-bottom:4px">' + pill(dObj.icon + ' ' + dObj.label, dObj.col) + pill(pz.stages + ' stage' + (pz.stages === 1 ? '' : 's')) + (s.isSolved() ? pill('✓ Solved', '#6ee7a0') : '') + (pz.custom ? pill('Custom', 'var(--acc)') : '') + '</div>' +
          '<div class="small" style="font-weight:600;margin-bottom:3px">' + esc(pz.title) + '</div>' +
          '<div class="small" style="line-height:1.5">' + esc(pz.brief) + '</div>' +
          (pz.seedCode ? '<div class="small mute" style="margin-top:4px;font-size:10.5px;' + mono + ';user-select:text">seed: ' + esc(pz.seedCode) + '</div>' : '') +
        '</div>' +
        '<div class="row" style="gap:5px;margin-top:7px">' +
          '<input id="puzans" placeholder="Enter answer (or solve …)" autocomplete="off" style="flex:1;min-width:0;font-size:12px;' + mono + '">' +
          '<button class="pri" data-act="puzcheck" style="padding:4px 9px;font-size:12px">Check</button>' +
        '</div>' +
        '<div class="row" style="gap:5px;margin-top:6px;flex-wrap:wrap">' +
          '<button class="ib" data-act="puzhint" style="font-size:11.5px">💡 Hint</button>' +
          '<button class="ib" data-act="puzwalk" style="font-size:11.5px">📖 Solution</button>' +
          '<button class="ib" data-act="puzcreate" style="font-size:11.5px">Create</button>' +
          '<button class="ib" data-act="puzcustomize" style="font-size:11.5px">' + (pz.custom ? 'Edit this puzzle' : 'Customize this puzzle') + '</button>' +
        '</div>' +
        '<div class="row" style="gap:5px;margin-top:6px">' +
          '<input id="puzseed" placeholder="Load seed code…" autocomplete="off" style="flex:1;min-width:0;font-size:11px;' + mono + '">' +
          '<button class="ib" data-act="puzloadseed" style="font-size:11px;padding:3px 7px">Load</button>' +
        '</div>' +
        '<div style="margin-top:8px;border-top:1px solid var(--line);padding-top:7px">' +
          '<div class="small" style="font-weight:600;margin-bottom:3px">🤖 Describe any scenario</div>' +
          '<div class="small mute" style="font-size:10.5px;margin-bottom:4px">Say what you want to do in the terminal — a heist, a lost server, a museum at night. The local model writes the room and the key.</div>' +
          '<textarea id="puzaiq" rows="3" placeholder="e.g. A night guard at a lighthouse needs the passphrase hidden in the assistant keeper’s logs." style="font-size:12px;resize:vertical"></textarea>' +
          '<div class="row" style="gap:5px;margin-top:4px;align-items:center">' +
            '<span class="small mute" style="font-size:11px">size</span>' +
            '<input id="puzaisize" type="number" min="1" max="' + PUZ.ROOM_FILES_MAX + '" value="40" style="width:78px;font-size:11.5px" title="How many files the room gets — as many as you want">' +
            '<span class="small mute" style="font-size:11px">files</span><span style="flex:1"></span>' +
            '<button class="pri" data-act="puzai" style="padding:4px 9px;font-size:12px"' + (S.puzAi && S.puzAi.busy ? ' disabled' : '') + '>✨ Build room</button>' +
          '</div>' +
          (S.puzAi && S.puzAi.msg ? '<div class="small mute" style="font-size:10.5px;margin-top:4px;line-height:1.45">' + esc(S.puzAi.msg) + '</div>' : '') +
        '</div>' +
        '<div class="small mute" style="margin-top:6px;font-size:11px">Solved: <b>' + st.solved + '</b> · 🔥 ' + st.streak + ' (🟢' + st.byDiff.easy + ' 🟡' + st.byDiff.medium + ' 🟠' + st.byDiff.hard + ' 🔴' + st.byDiff.insane + ')</div>' +
        (customList.length ? '<div style="margin-top:7px;border-top:1px solid var(--line);padding-top:6px"><div class="small mute" style="font-size:10.5px;margin-bottom:4px">YOUR CUSTOM PUZZLES (' + customList.length + ')</div>' +
          '<div style="max-height:180px;overflow:auto">' +
          customList.map(cp => '<div class="row" style="gap:4px;align-items:center;margin-bottom:3px"><button class="ib" data-playcustom="' + esc(cp.id) + '" style="flex:1;text-align:left;font-size:11.5px;padding:3px 6px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">▶ ' + esc(cp.title || byId(cp.shell).name + ' puzzle') + '</button><button class="ib" data-delcustom="' + esc(cp.id) + '" title="Delete" style="padding:3px 6px;font-size:11px">✕</button></div>').join('') + '</div>' +
        '</div>' : '') +
      '</div>';
    }

    /* ---- 🎓 Learn: a short course in Sandbox, the staged trail of the current puzzle or room otherwise ---- */
    function learnCourse() {
      const TL = window.TerminalLearn;
      if (!TL) return null;
      if (S.mode === 'puzzle') { const s = puzSession(S.shell); return s ? TL.challenge(s.puzzle, s) : null; }
      if (S.mode === 'lab') { const s = labSession(S.shell); return s ? TL.challenge(s.room()) : null; }
      return TL.course(S.shell);
    }
    function learnPanel() {
      const course = learnCourse();
      if (!course || !Array.isArray(course.steps) || !course.steps.length) return '';
      const key = logKey(S.shell) + ':learn';
      const at = Math.max(0, Math.min(S.learnAt[key] ?? 0, course.steps.length - 1));
      S.learnAt[key] = at;
      const challenge = S.mode !== 'sandbox';
      const shown = course.steps.slice(0, at + 1);
      return '<div id="tpglearn" style="' + box + ';padding:9px 10px;margin-bottom:8px">' +
        '<div class="row" style="gap:6px;align-items:center"><b class="small">🎓 ' + (challenge ? 'Walkthrough' : 'Learn') + ' · ' + esc(course.title) + '</b><span style="flex:1"></span><span class="small mute">' + (at + 1) + '/' + course.steps.length + '</span></div>' +
        '<p class="small mute" style="margin:4px 0 6px;line-height:1.45">' + esc(course.intro) + '</p>' +
        shown.map((step, index) => '<div style="border-top:1px solid var(--line);padding:6px 0">' +
          '<div class="small" style="font-weight:600">' + (index + 1) + '. ' + esc(step.title) + '</div>' +
          '<div class="small" style="line-height:1.45;margin-top:2px">' + esc(step.text) + '</div>' +
          (step.command ? '<button class="ib" data-learn-cmd="' + esc(step.command) + '" style="margin-top:4px;font-size:11px;padding:2px 7px">Put on prompt</button>' : '') +
        '</div>').join('') +
        '<div class="row" style="gap:5px;margin-top:6px;flex-wrap:wrap">' +
          (at + 1 < course.steps.length ? '<button class="pri" data-learn-next style="font-size:11.5px;padding:3px 8px">Next step →</button>' : '<span class="small mute">All steps shown.</span>') +
          (at > 0 ? '<button class="ib" data-learn-reset style="font-size:11px;padding:3px 7px">Start over</button>' : '') +
          (challenge ? '<button class="ib" data-learn-hint style="font-size:11px;padding:3px 7px" title="Ask the terminal for the same nudge">Type hint</button>' : '') +
        '</div>' +
        '<div class="small mute" style="margin-top:4px;font-size:10.5px;line-height:1.4">' + (challenge ? 'These are the same staged nudges as `hint` — never the answer. `walkthrough` is the deliberate full reveal.' : 'A short course for this shell. Every step is a real command in the sandbox.') + '</div>' +
      '</div>';
    }

    /* ---- 🎓 Learn More: a separate no-stakes workshop, not the hint ladder ---------------------------------- */
    function lmData() {
      const TL = window.TerminalLearn;
      if (!TL || !TL.course) return null;
      const course = TL.course(S.shell);
      if (!course || !Array.isArray(course.steps)) return null;
      const steps = course.steps.filter(step => step && step.command);
      return steps.length ? { course, steps } : null;
    }
    function lmChoices(course, step) {
      const pool = course.steps.map(item => item.command).filter(cmd => cmd && cmd !== step.command);
      const picks = [];
      for (let i = 0; picks.length < 2 && i < pool.length; i++) {
        const cmd = pool[(S.lm.step * 2 + i + 1) % pool.length];
        if (cmd && !picks.includes(cmd)) picks.push(cmd);
      }
      while (picks.length < 2) picks.push(picks.length ? 'help' : 'pwd');
      picks.splice(S.lm.step % 3, 0, step.command);
      return picks;
    }
    function learnMoreHTML() {
      const data = lmData();
      if (!data) return '';
      const { course, steps } = data;
      if (!S.lm || S.lm.shell !== S.shell) S.lm = { shell: S.shell, step: 0, picked: null, right: 0, finished: false };
      const total = steps.length;
      const idx = Math.max(0, Math.min(S.lm.step, total - 1));
      const step = steps[idx];
      const finished = S.lm.finished;
      const choices = finished ? [] : lmChoices(course, step);
      return '<div class="tpg-learnmore" role="dialog" aria-modal="true" aria-label="Learn More workshop">' +
        '<div class="tpg-lm-card">' +
          '<div class="tpg-lm-head"><div><b>🎓 Learn More · ' + esc(course.title) + '</b><div class="small mute">A separate workshop. Nothing here touches your terminal, and no points or Elo are earned.</div></div><button class="ib" data-lm-close>✕ Exit</button></div>' +
          (finished
            ? '<div class="tpg-lm-done"><div style="font-size:34px">🏁</div><h3>Workshop complete</h3><p>' + S.lm.right + ' of ' + total + ' right. Nothing was scored — this was practice.</p>' +
              '<p class="small mute">Ready for the real thing? Close this workshop and earn points and Elo in Puzzles, the Labyrinth, jobs or Help missions.</p>' +
              '<div class="row" style="gap:6px"><button class="ib" data-lm-restart>↻ Run it again</button><button class="pri" data-lm-close>Back to the terminal</button></div></div>'
            : '<div class="tpg-lm-progress"><span style="width:' + Math.round(((idx + (S.lm.picked == null ? 0 : 1)) / total) * 100) + '%"></span></div>' +
              '<div class="small mute" style="margin:2px 0 10px">Exercise ' + (idx + 1) + ' of ' + total + ' · ' + esc(step.title) + '</div>' +
              '<p class="tpg-lm-ask">' + esc(step.text) + '</p>' +
              '<p class="small mute" style="margin:8px 0 6px">Which line would do that in ' + esc(S.shell) + '?</p>' +
              '<div class="tpg-lm-choices">' + choices.map((cmd, i) => {
                const picked = S.lm.picked != null;
                const right = cmd === step.command;
                const tone = picked ? (right ? ' ok' : (i === S.lm.picked ? ' bad' : '')) : '';
                return '<button class="tpg-lm-choice' + tone + '" data-lm-choice="' + i + '" data-ok="' + (right ? '1' : '0') + '"' + (picked ? ' disabled' : '') + '><code>' + esc(cmd) + '</code></button>';
              }).join('') + '</div>' +
              (S.lm.picked != null ? '<div class="tpg-lm-feedback ' + (choices[S.lm.picked] === step.command ? 'ok' : 'bad') + '">' +
                (choices[S.lm.picked] === step.command ? '✅ Yes — that is the move.' : '❌ Not quite. The line for this is <code>' + esc(step.command) + '</code>.') +
                '<div class="small mute" style="margin-top:4px">' + esc(step.text) + '</div>' +
                '<div class="row" style="gap:6px;margin-top:8px"><button class="pri" data-lm-next>' + (idx + 1 < total ? 'Next exercise →' : 'Finish workshop') + '</button></div></div>' : '') +
              '<div class="small mute" style="margin-top:10px;font-size:10.5px">Learn More is deliberately separate from `hint`: hints stay in the terminal and stay vague. This workshop is for practice only.</div>'
          ) +
        '</div></div>';
    }

    function jobPanel(shell) {
      const jobs = shell.jobs?.();
      if (!jobs) return '';
      return '<div class="row" style="gap:6px;align-items:center;flex-wrap:wrap"><b class="small">Practice jobs</b><span style="flex:1"></span>' +
        '<span class="small mute">' + jobs.completed + ' complete</span></div>' +
        '<p class="small mute" style="margin:5px 0 7px">' + (jobs.active ? 'Submit with job submit &lt;answer&gt;.' :
          'Generate assignments for this shell in a separate workspace.') + '</p>' +
        '<div class="row" style="gap:6px;flex-wrap:wrap">' + (jobs.active ?
          '<button class="ib" data-job="status">Brief</button><button class="ib" data-job="hint">Hint</button>' +
          '<button class="ib" data-job="next">Next job</button><button class="ib" data-job="leave">Free play</button>' :
          '<button class="pri" data-job="start">Open job</button>') + '</div>';
    }

    function draw() {
      /* A redraw rebuilds the terminal box, so note whether the terminal was filling the screen before the old one is
         replaced: the new box must be given full screen again, and a stale callback must not drop it between commands. */
      const wasFs = S.fs || !!($('tpgbox') && $('tpgbox').classList.contains('term-fs'));
      const sh = current();
      const lab = S.mode === 'lab';
      const puz = S.mode === 'puzzle';
      const multiline = !lab && !puz && sh.id === 'bash';
      const commandField = ' id="tpgin" aria-label="Terminal command" autocomplete="off" autocapitalize="off" spellcheck="false" style="flex:1;min-width:80px;background:transparent;border:0;color:#fff;' + mono + ';font-size:12.5px;outline:none' + (multiline ? ';resize:vertical;min-height:1.6em' : '') + '"';
      el.innerHTML = '<div style="width:min(1220px,100%);padding-bottom:16px">' +
        '<div style="' + box + ';margin-bottom:10px">' +
          '<div class="row" style="gap:8px;align-items:center;flex-wrap:wrap">' +
            '<div><div class="small mute" style="letter-spacing:.08em">OFFLINE TERMINAL SIMULATIONS</div><h2 style="margin:2px 0 0">🧪 Terminal playground</h2></div>' +
            '<span style="flex:1"></span>' +
            '<div class="row" style="gap:4px;align-items:center">' +
              '<button class="ib' + (S.mode === 'sandbox' ? ' on' : '') + '" data-mode="sandbox">🧪 Sandbox</button>' +
              '<button class="ib' + (puz ? ' on' : '') + '" data-mode="puzzle"' + (supportsPuzzle(S.shell) ? '' : ' title="Puzzle Studio covers the ten standard terminals"') + (supportsPuzzle(S.shell) ? '' : ' aria-disabled="true"') + '>🧩 Puzzles</button>' +
              '<button class="ib' + (lab ? ' on' : '') + '" data-mode="lab"' + (supportsLab(S.shell) ? '' : ' title="The Labyrinth covers the ten standard terminals"') + (supportsLab(S.shell) ? '' : ' aria-disabled="true"') + '>🌀 Labyrinth</button>' +
            '</div>' +
          '</div>' +
                      '<div class="row" style="gap:8px;align-items:center;margin-top:6px;flex-wrap:wrap"><span id="tpggroup" class="small mute"></span><span style="flex:1"></span>' + (window.TerminalRewards ? '<span id="tpgrwd">' + TerminalRewards.chip() + '</span>' : '') + '<span id="tpgcount" class="small mute"></span></div>' +
          '<p class="small" id="tpgabout" style="margin:4px 0 0;line-height:1.5"></p>' +
        '</div>' +
        '<div style="display:grid;grid-template-columns:190px minmax(0,1fr) 315px;gap:8px;align-items:start" id="tpggrid">' +
          '<div style="' + box + ';padding:6px">' +
            '<div class="small mute" style="padding:2px 4px 6px;letter-spacing:.06em">TERMINALS</div>' +
            '<div id="tpgtabs">' + groupHTML() + '</div>' +
            (lab ? '<div class="small mute" style="padding:8px 4px 2px;line-height:1.45;border-top:1px solid var(--line);margin-top:6px">The descent is different in every terminal, and it never ends.</div>' : '') +
            (puz ? '<div class="small mute" style="padding:8px 4px 2px;line-height:1.45;border-top:1px solid var(--line);margin-top:6px">Pick any shell, choose a difficulty & category, or craft your own custom puzzles.</div>' : '') +
          '</div>' +
          '<div style="display:flex;flex-direction:column;gap:8px;min-width:0">' +
            '<div id="tpgbox" class="term-fs-box" style="background:#05070b;border:1px solid var(--line);border-radius:10px;padding:10px 12px">' +
              '<div class="row" style="gap:6px;align-items:center;flex-wrap:wrap;margin-bottom:6px"><b id="tpgtitle" class="small"></b><span style="flex:1"></span>' + (manual ? '<button class="ib" data-act="manual" title="Open the Help Terminal">Help</button>' : '') + '<button class="ib" data-act="learn" title="Open the separate Learn More workshop (practice only, no points)">🎓 Learn More</button><button class="ib" data-act="curios" title="Open the discovery journal">Curios</button><button class="ib" id="tpgclear" title="Clear what is on screen (the sandbox keeps its state)">Clear</button><button class="ib" id="tpgreset" title="' + (lab ? 'Start the descent over at depth 1' : puz ? 'Generate a new puzzle' : 'Restore the current workspace') + '">' + (lab ? 'Restart' : puz ? 'New Puzzle' : 'Reset') + '</button><label class="small mute" style="display:inline-flex;align-items:center;gap:3px;margin-left:2px" title="Colour of your own typing and the prompt in this shell"><input type="color" id="tpgusercol" aria-label="Colour for your own commands in this shell" style="width:26px;height:22px;padding:0;border:1px solid var(--line);border-radius:5px;background:transparent;cursor:pointer"></label><button class="ib" id="tpgfs" title="Fullscreen terminal (Esc to exit)">⛶ Fullscreen</button></div>' +
              '<pre id="tpgout" class="term-fs-out" style="margin:0;height:min(46vh,390px);overflow:auto;' + mono + ';font-size:12.5px;line-height:1.55;white-space:pre-wrap;word-break:break-word;user-select:text;-webkit-user-select:text;cursor:text"></pre>' +
              '<div class="row term-fs-prompt-row" style="gap:6px;align-items:center;margin-top:8px;border-top:1px solid rgba(255,255,255,.06);padding-top:8px">' +
                '<span id="tpgprompt" style="' + mono + ';font-size:12.5px;color:#6ee7a0;white-space:nowrap"></span>' +
                (multiline ? '<textarea rows="1"' + commandField + ' placeholder="Type a command or paste a Bash script"></textarea>' :
                  '<input' + commandField + ' placeholder="' + (lab ? 'read the room, then solve &lt;answer&gt;' : puz ? 'run shell commands, then solve &lt;answer&gt;' : 'type a command, or click an example →') + '">') +
              '</div>' +
            '</div>' +
            (TP.coach ? '<details class="tpg-coach" id="tpgcoach"' + (S.coachOpen ? ' open' : '') + '><summary><strong>Command coach</strong><span id="tpgcoachlabel" aria-live="polite"></span></summary><div id="tpgcoachbody"></div></details>' : '') +
            '<div class="row" style="gap:6px;flex-wrap:wrap;align-items:center"><button class="ib" data-act="saveprogress">Save progress</button><span class="small mute">' +
              (api?.temporary ? 'Progress clears when this live session ends.' : 'Progress also saves automatically on this device.') + '</span><span id="tpgmcodectl"></span></div>' +
            '<div class="small mute" style="' + mono + '">' + (lab
              ? 'solve &lt;answer&gt; unlocks the next checkpoint · hint · map · ↑ history · Ctrl+L clears'
              : puz
                ? 'solve &lt;answer&gt; verifies · hint · walkthrough · braces/globs/pipes work · ↑ history · Ctrl+L clears'
                : multiline ? 'Enter runs · Shift+Enter adds a line · ↑ ↓ history · Ctrl+L clears' : '↑ ↓ history · Ctrl+L clears') + '</div>' +
            (A.cyberPad ? A.cyberPad.notesHTML('tpgpad', { title: '📝 Notes &amp; sketchpad', rows: 4, placeholder: 'Jot down notes, commands, answers or ideas — saved on this PC.' }) + A.cyberPad.aiHTML('tpgai', { hint: 'Stuck? Ask about this terminal, a command or the room.', placeholder: 'e.g. how do I find the hidden key?' }) : '') +
          '</div>' +
          '<div>' +
            (lab ? labPanel() : puz ? puzzlePanel() : '<div id="tpgjobs" style="' + box + ';padding:8px 10px;margin-bottom:8px"></div>' + (scenarioShell() ? scenarioPanel() : '')) +
            (window.TerminalRewards ? TerminalRewards.panel() : '') +
            '<div style="' + box + ';padding:8px;margin-top:' + (lab || puz ? '8px' : '0') + '">' +
              '<input id="tpgsearch" placeholder="Search commands…" autocomplete="off" style="width:100%;box-sizing:border-box;margin-bottom:6px;font-size:12px">' +
              '<div class="small mute" style="margin-bottom:4px">' + (lab ? 'ROOM COMMANDS' : puz ? 'PUZZLE COMMANDS' : 'COMMAND EXAMPLES · ' + esc(sh.group.toUpperCase())) + '</div>' +
              '<div id="tpgpal" style="max-height:min(42vh,380px);overflow:auto"></div>' +
            '</div>' +
          '</div>' +
        '</div>' +
        '</div>' +
        (S.learnOpen ? learnMoreHTML() : '');
      if (manual) el.insertAdjacentHTML?.('beforeend', '<div data-terminal-manual></div>');
      paintMeta();
      paintPalette();
      paintOut();
      paintMcodeSetting();
      paintCoach();
      const coach = $('tpgcoach');
      if (coach) coach.ontoggle = () => {
        S.coachOpen = coach.open;
        ls.set('tpg_coach_open', String(coach.open));
      };
      const drop = $('tpgout');
      if (drop) {
        const hasFiles = ev => [...(ev.dataTransfer?.types || [])].includes('Files');
        drop.ondragover = ev => { if (!hasFiles(ev)) return; ev.preventDefault(); drop.style.outline = '2px dashed #6ee7a0'; };
        drop.ondragleave = () => { drop.style.outline = ''; };
        drop.ondrop = ev => { if (!ev.dataTransfer?.files?.length) return; ev.preventDefault(); drop.style.outline = ''; void importDropped(ev.dataTransfer.files); };
        if (S.mode === 'sandbox' && current()?.importFile) drop.title = 'Drop files from this PC here to copy them into the sandbox';
      }
      const inp = $('tpgin');
      if (inp) {
        const key = logKey(S.shell);
        inp.value = drafts[key] || '';
        maskInput();
        inp.oninput = () => { drafts[key] = inp.value.slice(0, 8000); saveView(key); };
        inp.onkeydown = ev => {
          const key = logKey(S.shell);
          // The /swarm role list takes the arrow keys while it is open; Enter, Delete and Backspace only on an empty line.
          const swarmList = harnesses.get(key);
          if (swarmList?.picking?.() && (/^Arrow|^Escape$/.test(ev.key) || /^(?:Enter|Delete|Backspace)$/.test(ev.key) && !inp.value) && swarmList.key(ev.key)) {
            ev.preventDefault(); ev.stopPropagation(); paintOut(); paintPrompt(); return;   // Escape must not also leave the tab (main.js)
          }
          if (ev.key === 'Enter' && !ev.isComposing && !(multiline && ev.shiftKey)) { ev.preventDefault(); exec(inp.value); }
          else if ((ev.key === 'ArrowUp' || ev.key === 'ArrowDown') && !(multiline && inp.value.includes('\n'))) {
            ev.preventDefault();
            const next = S.hi[key] + (ev.key === 'ArrowUp' ? -1 : 1);
            if (next >= 0 && next <= S.hist[key].length) {
              S.hi[key] = next;
              inp.value = S.hist[key][next] || '';
              inp.oninput();
            }
          }
          else if (ev.key === 'l' && ev.ctrlKey) { ev.preventDefault(); curLog().length = 0; saveView(key); paintOut(); }
          else if (ev.key?.toLowerCase() === 'c' && ev.ctrlKey && inp.selectionStart === inp.selectionEnd && !String(window.getSelection?.() || '')) {
            const harness = harnesses.get(key);
            if (harness?.whipping?.() || harness?.busy?.()) { ev.preventDefault(); harness.interrupt(); paintOut(); paintPrompt(); }
            else {
              // Like a real shell: ^C abandons the line being typed and gives a fresh prompt.
              ev.preventDefault();
              const asking = !!current().secret?.();      // ^C at a password prompt cancels the login
              curLog().push({ k: 'cmd', t: currentPrompt() + (asking ? '' : inp.value) + '^C' });
              if (asking) current().cancelInput?.();
              inp.value = ''; inp.oninput(); saveView(key); paintOut(); paintPrompt(); maskInput();
            }
          }
          else if (ev.key === 'Tab' && !ev.shiftKey && !ev.ctrlKey && !ev.altKey && !(multiline && inp.value.includes('\n'))) {
            ev.preventDefault();
            complete(inp, key);
          }
          if (ev.key !== 'Tab') tabState = null;
        };
        if (!S.puzEditor) { try { inp.focus({ preventScroll: true }); } catch (e) { inp.focus(); } }
      }
      const search = $('tpgsearch');
      if (search) {
        search.value = S.filter;
        search.oninput = () => { S.filter = search.value; paintPalette(); };
      }
      const ucol = $('tpgusercol');
      if (ucol) {
        ucol.value = userColor();
        ucol.oninput = () => setUserColor(ucol.value);
        ucol.title = 'Colour of your own typing and the prompt in ' + current().name;
      }
      if (S.puzEditor && S.mode === 'puzzle') setupPuzzleEditor();
      const pcat = $('puzcat');
      if (pcat) {
        pcat.onchange = () => {
          S.puzCat = pcat.value;
          puzSession(S.shell, true);
          draw();
        };
      }
      const pans = $('puzans');
      if (pans) {
        pans.onkeydown = ev => { if (ev.key === 'Enter') { ev.preventDefault(); exec('solve ' + pans.value, true); pans.value = ''; } };
      }
      if (A.cyberPad) {
        A.cyberPad.bindNotes(el, 'tpgpad', 'terminal');
        A.cyberPad.bindAI(el, 'tpgai', {
          context: () => 'The Moundshroud terminal playground. Mode: ' + S.mode + '. Shell: ' + current().name + ' (' + current().group + ').' +
            '\nRecent terminal screen:\n' + curLog().slice(-30).map(l => l.t).join('\n'),
          system: 'You are a concise helper inside a sandboxed terminal playground. Explain commands, say what a puzzle or room is asking for, and suggest the next command. Keep answers short. Nothing you say runs anything, so never claim to have run a command.'
        });
      }
      if (wasFs && A.termFS) {
        S.fs = true;
        A.termFS.apply($('tpgbox'), true, $('tpgfs'), () => { S.fs = false; });
      }
    }

    function groupHTML() {
      const groups = [];
      for (const sh of shells) if (!groups.includes(sh.group)) groups.push(sh.group);
      const lab = S.mode === 'lab';
      return groups.map(g => '<div style="margin-bottom:6px"><div class="small mute" style="padding:2px 4px;font-size:10.5px;letter-spacing:.06em">' + esc(g.toUpperCase()) + '</div>' +
        shells.filter(s => s.group === g).map(s => {
          const d = lab ? labDepthOf(s.id) : 0;
          return '<button data-shell="' + s.id + '" style="display:block;width:100%;text-align:left;cursor:pointer;padding:5px 7px;margin:1px 0;border-radius:7px;border:1px solid ' + (s.id === S.shell ? 'var(--acc)' : 'transparent') + ';background:' + (s.id === S.shell ? 'rgba(90,160,255,.10)' : 'transparent') + ';color:inherit;font-size:12.5px"><span style="display:flex;align-items:center;gap:4px">' + s.icon + ' ' + esc(s.name) + '<span style="flex:1"></span>' + (lab ? '<span class="small mute" style="font-size:10px">d' + d + '</span>' : '') + '</span></button>';
        }).join('') + '</div>').join('');
    }

    const supportsLab = id => !!(LAB && Array.isArray(LAB.flavors) && LAB.flavors.includes(id));
    const supportsPuzzle = id => !!(PUZ && PUZ.CATEGORIES?.[id]);

    function switchShell(id) {
      if (!byId(id)) return;
      if (id !== S.shell) guestMcode = null;
      /* a Security range has its own objectives, so it opens in Sandbox mode rather than an empty room */
      if ((S.mode === 'lab' && !supportsLab(id)) || (S.mode === 'puzzle' && !supportsPuzzle(id))) {
        S.mode = 'sandbox';
        ls.set('tpg_mode', S.mode);
      }
      S.shell = id;
      ls.set('tpg_shell', id);
      S.filter = '';
      S.puzCat = 'auto';
      S.puzEditor = null;
      shellLog(id);
      draw();
    }

    function switchMode(mode) {
      if (mode === S.mode) return;
      if (mode === 'lab' && !supportsLab(S.shell)) { if (A.toast) A.toast('The Labyrinth descends the ten standard terminals. A Security range has its own objectives.'); return; }
      if (mode === 'puzzle' && !supportsPuzzle(S.shell)) { if (A.toast) A.toast('Puzzle Studio generates puzzles for the ten standard terminals. A Security range has its own objectives.'); return; }
      guestMcode = null;
      S.mode = mode === 'lab' ? 'lab' : mode === 'puzzle' ? 'puzzle' : 'sandbox';
      ls.set('tpg_mode', S.mode);
      S.filter = '';
      S.puzEditor = null;
      shellLog(S.shell);
      draw();
    }

    /* Tab completion, as in bash: the first word completes command names, later words complete paths from the shell's
       own file tree. One match is filled in; several fill the common start, and a second Tab lists them. */
    let tabState = null;
    function commandNames(sh) {
      const names = new Set(['cd', 'ls', 'cat', 'pwd', 'echo', 'clear', 'help']);
      try { for (const page of TP.manual?.buildIndex?.(sh)?.pages || []) { const first = String(page.key || '').split(/\s+/)[0]; if (/^[\w.-]+$/.test(first)) names.add(first); } } catch (e) { }
      return [...names];
    }
    function complete(inp, key) {
      const value = inp.value, sh = current();
      const word = /(\S*)$/.exec(value)[1], before = value.slice(0, value.length - word.length);
      const win = sh.id === 'powershell' || sh.id === 'cmd';
      const same = (a, b) => win ? a.toLowerCase().startsWith(b.toLowerCase()) : a.startsWith(b);
      let dirPart = '', base = word, matches = [];
      if (!before.trim()) matches = commandNames(sh).filter(name => same(name, word)).sort().map(name => ({ name, dir: false }));
      else {
        const files = discoveryTree();
        const snap = files && (S.mode === 'sandbox' ? (byId(S.shell)?.workspace?.() || byId(S.shell))?.snapshot?.() : S.mode === 'lab' ? labSession(S.shell)?.room?.()?.snapshot?.() : puzSession(S.shell)?.snapshot?.()?.workspace);
        if (!files || !Array.isArray(snap?.cwd)) return;
        const cut = Math.max(word.lastIndexOf('/'), word.lastIndexOf('\\'));
        dirPart = word.slice(0, cut + 1); base = word.slice(cut + 1);
        let parts;
        if (/^~[\\/]?/.test(dirPart) && files.home.length) { parts = files.home.slice(); dirPart.replace(/^~[\\/]?/, '').split(/[\\/]/).forEach(step); }
        else if (/^(?:[a-z]:)?[\\/]/i.test(dirPart)) { parts = win && S.mode === 'sandbox' ? ['C:'] : []; dirPart.replace(/^(?:[a-z]:)?[\\/]/i, '').split(/[\\/]/).forEach(step); }
        else { parts = snap.cwd.slice(); dirPart.split(/[\\/]/).forEach(step); }
        function step(name) { if (!name || name === '.') return; if (name === '..') { if (parts.length) parts.pop(); } else parts.push(name); }
        let dir = files.tree;
        for (const name of parts) {
          const found = Object.keys(dir || {}).find(k => win ? k.toLowerCase() === name.toLowerCase() : k === name);
          dir = found == null ? null : dir[found];
          if (!dir || typeof dir !== 'object' || 'text' in dir) return;
        }
        matches = Object.keys(dir).filter(name => same(name, base) && (base.startsWith('.') || !name.startsWith('.'))).sort()
          .map(name => ({ name, dir: typeof dir[name] === 'object' && !('text' in dir[name]) }));
      }
      if (!matches.length) return;
      const sep = win ? '\\' : '/';
      const quote = name => win ? (/\s/.test(name) ? '"' + name + '"' : name) : name.replace(/([\s'"\\$&;|<>()])/g, '\\$1');
      if (matches.length === 1) {
        const [only] = matches;
        inp.value = before + dirPart + quote(only.name) + (only.dir ? sep : ' ');
      } else {
        let prefix = matches[0].name;
        for (const { name } of matches) while (!same(name, prefix)) prefix = prefix.slice(0, -1);
        if (prefix.length > base.length) inp.value = before + dirPart + quote(prefix);
        else if (tabState === value) {
          curLog().push({ k: 'cmd', t: currentPrompt() + value }, { k: 'out', t: matches.map(m => m.name + (m.dir ? sep : '')).join('  ') });
          saveView(key); paintOut();
        }
      }
      tabState = inp.value;
      inp.oninput?.();
    }

    // The live file tree of the current shell, where the mcode note is mounted: sandbox bash/PowerShell/cmd at home,
    // puzzle and Labyrinth rooms at their root. Shells without files return null.
    function discoveryTree() {
      const id = S.shell, win = id === 'powershell' || id === 'cmd';
      try {
        if (S.mode === 'sandbox') {
          if (id !== 'bash' && !win) return null;
          const shell = byId(id), snap = (shell?.workspace?.() || shell)?.snapshot?.();
          const tree = snap?.fs || snap?.tree;
          return tree ? { tree, home: id === 'bash' ? ['home', 'moundshroud'] : ['C:', 'Users', 'moundshroud'], win } : null;
        }
        const snap = S.mode === 'lab' ? labSession(id)?.room?.()?.snapshot?.() : puzSession(id)?.snapshot?.()?.workspace;
        return snap?.tree && typeof snap.tree === 'object' ? { tree: snap.tree, home: [], win } : null;
      } catch (e) { return null; }
    }

    // A solved exercise locks mcode at once and closes every open mcode session, so the prompt is the plain shell again.
    function lockAfterSolve() {
      guestMcode = null;
      if (!TP.mcodeLock?.()) return;
      for (const harness of harnesses.values()) harness.close();
      refreshMcode();
    }

    /* Some commands are silent by design: chmod prints nothing when it succeeds, and a pipeline that ends in cat/head/grep
       prints nothing when the command before it printed nothing. On a screen that reads as a broken terminal, so a silent
       line gets a grey explanation of its own — never styled as if the program had printed it. */
    function quietHint(command) {
      const line = String(command || '').trim();
      if (!line) return '';
      const pipe = line.split('|');
      const head = (pipe[0] || '').trim();
      const perm = /^chmod(?:\s|$)/i.test(head);
      const operands = perm ? head.split(/\s+/).slice(1).filter(word => !word.startsWith('-')) : [];
      const target = operands.length > 1 ? operands[1] : '';
      if (pipe.length > 1) {
        const name = (pipe[1].trim().split(/\s+/)[0] || 'cat').toLowerCase();
        if (perm) return '(no output: chmod changes permissions silently, and ' + name + ' only prints what it is given — the pipe carried nothing.' +
          (target ? ' Read the file itself: cat ' + target : '') + ')';
        return '(no output: the command before the pipe printed nothing, so ' + name + ' had nothing to work on. ' +
          name + ' prints a file you name, or text piped into it.)';
      }
      if (perm) return '(chmod prints nothing when it succeeds' + (target ? ' — run ls -l ' + target + ' to see the new mode' : '') + '.)';
      const read = /^(?:sudo\s+)?(cat|type|more|less|head|tail|grep|nl|xxd|od|base64)\s+(.*)$/i.exec(line);
      if (read) {
        const file = read[2].split(/\s+/).filter(word => !word.startsWith('-')).pop() || '';
        return '(' + read[1].toLowerCase() + ' printed nothing' + (file ? ': ' + file + ' is empty — ls -l shows its size' : '') + '.)';
      }
      return '';
    }

    function exec(line, shellOnly = false) {
      /* Safety net: no command may leave the coach panel blank. */
      explained = false;
      const before = curLog().length;
      const out = execLine(line, shellOnly);
      const cmd = String(line == null ? '' : line).trim();
      const printed = curLog().slice(before).filter(entry => entry.k !== 'cmd').map(entry => entry.t).join('\n').trim();
      const text = printed || (typeof out === 'string' ? out.trim() : '');
      const hint = text ? '' : quietHint(cmd);
      if (hint) { curLog().push({ k: 'dim', t: hint }); paintOut(); }
      if (!cmd || explained) return out;
      coachNote({
        title: text ? 'Command handled' : 'Command ran without printing text', kind: 'neutral', command: cmd.slice(0, 420),
        why: [text ? 'The terminal printed: ' + text.split('\n').find(line => line.trim()).trim().slice(0, 300) :
          hint || 'The command was handled by the terminal and printed no text. Check the prompt for the state it left behind.'],
        next: ['Type help to see the commands this terminal accepts.']
      });
      return out;
    }

    function execLine(line, shellOnly = false) {
      const sh = current();
      TP.helpContext = buildHelpContext;   // bind `help`'s mission section to this mount before any command runs
      const cmd = String(line == null ? '' : line).trim();
      if (!cmd) return;
      const log = curLog();
      const key = logKey(S.shell);
      drafts[key] = '';
      const depth = S.mode === 'lab' ? (labSession(sh.id)?.depth() ?? 0) : Infinity;
      if (depth < labCodeDepth && /^(?:mcode\s+)?\/code(?:\s|$)/i.test(cmd)) {
        const output = '/code unlocks at Labyrinth depth ' + labCodeDepth + '.';
        log.push({ k: 'cmd', t: currentPrompt() + cmd }, { k: 'out', t: output });
        remember(cmd);
        paintOut();
        coachNote({ command: cmd, title: 'This command is locked on this floor', kind: 'neutral',
          why: [output, 'The Labyrinth reserves the coding agent for deeper floors.'],
          next: ['Solve more floors to raise your depth. The terminal header shows the current depth.'] });
        const input = $('tpgin');
        if (input) input.value = '';
        return output;
      }
      const canDiscoverNote = depth >= labNoteDepth;
      const harness = shellOnly ? null : mcodeSession();
      let harnessCommand = cmd;
      const launch = !harness?.open() && harness && /^mcode(?:\s+([\s\S]+))?$/i.exec(cmd);
      const room = () => S.mode === 'lab' ? labSession(sh.id)?.room() : S.mode === 'puzzle' ? puzSession(sh.id)?.puzzle : null;
      const note = () => {
        const puzzle = room();
        const job = api?.guestMcode && S.mode === 'sandbox' ? sh.mcodeJob?.() : null;
        return discoveryNote(key, puzzle, job?.key, S.mode === 'lab' ? puzzle?.depth : 0);
      };
      if (api?.guestMcode && !shellOnly && !sh.secret?.()) {
        const context = mcodeContext(S.mode, S.shell);
        const scope = key + '|' + context.key;
        if (guestMcode !== scope || /^(?:job\s+(?:leave|next|reset)|new)$/i.test(cmd)) guestMcode = null;
        const request = /^mcode(?:\s+(\S+))?$/i.exec(cmd);
        if (request) {
          const passphrase = request[1];
          let output = canDiscoverNote ? 'mcode: locked. Look for the hidden mcode.txt note in this workspace.' : 'mcode: command not found';
          if (context.done) output = 'mcode: locked. This exercise is complete.';
          else if (canDiscoverNote && (guestMcode === scope || (passphrase && note().verify(passphrase, false)))) {
            guestMcode = scope;
            output = S.mode === 'sandbox'
              ? 'mcode · Read-only support. Try help for this shell, or job hint during an assignment.'
              : 'mcode · Read-only support. Try hint, then inspect the files, tables, or records named in the brief.';
          }
          log.push({ k: 'cmd', t: currentPrompt() + (passphrase ? 'mcode [input hidden]' : 'mcode') }, { k: 'out', t: output });
          remember('mcode');
          paintOut();
          coachNote({ command: 'mcode', title: passphrase && guestMcode === scope ? 'Unlocked, read-only' : 'mcode stayed closed', kind: 'neutral',
            why: [output], next: ['Type help in this shell for the commands the exercise accepts.'] });
          const input = $('tpgin');
          if (input) input.value = '';
          return output;
        }
      }
      if (launch && !mcodeAvailable()) {
        const discovered = TP.mcodeIsUnlocked();
        const allowed = canDiscoverNote && !discovered && launch[1] && note().verify(launch[1]);
        if (!allowed) {
          /* locked: say where the note is, so mcode never looks like a missing program */
          const locked = S.mode === 'lab' ? (canDiscoverNote ?
            'mcode: locked. Find this floor’s hidden mcode.txt (tree -a or ls -a), read it and decode its PAYLOAD, then type mcode <passphrase>.' :
            'mcode: locked until Labyrinth depth ' + labNoteDepth + '. The mcode.txt note appears from depth ' + labNoteDepth + '.') :
            'mcode: locked. A note is hidden in this workspace: find it with a listing that shows hidden entries, decode its PAYLOAD, then type mcode <passphrase>.';
          log.push({ k: 'cmd', t: currentPrompt() + (launch[1] ? 'mcode [input hidden]' : cmd) },
            { k: 'out', t: discovered ? 'mcode is off. Use the mcode switch next to Save progress.' : locked });
          remember('mcode');
          paintOut();
          coachNote({ command: 'mcode', title: discovered ? 'mcode is switched off' : 'mcode is locked here', kind: 'neutral',
            why: [discovered ? 'The mcode switch next to Save progress is off, so the session did not open.' : locked],
            next: [discovered ? 'Turn the mcode switch on, then type mcode.' : 'Explore with a full listing (tree -a or ls -a), read the note, decode its PAYLOAD, then run mcode <passphrase>.'] });
          const input = $('tpgin');
          if (input) input.value = '';
          return;
        }
        harnessCommand = 'mcode';
        if (!mcodeEnabled) {
          mcodeEnabled = true;
          TP.writeSave(mcodeSettingKey, true);
        }
        refreshMcode();
      }
      if (launch && /^lantern-[0-9a-f]{10}$/.test(launch[1] || '')) harnessCommand = 'mcode';
      const query = shellOnly !== 'agent' && !harness?.open() && manual ? TP.manual.guideRequest(cmd, sh.id, S.mode) : null;
      if (query != null && openManual(query)) {
        log.push({ k: 'cmd', t: currentPrompt() + cmd });
        remember(cmd);
        paintOut();
        coachNote({ command: cmd, title: 'Help page opened', kind: 'ok', manual: query.topic || '',
          why: ['That word is a help topic, so the Playground opened its manual page instead of running it as a command.'],
          next: ['Close the help page to return to the prompt.'] });
        const input = $('tpgin');
        if (input) input.value = '';
        return;
      }
      if (harness?.accepts(harnessCommand)) {
        log.push({ k: 'cmd', t: currentPrompt() + (harnessCommand === cmd ? cmd : 'mcode [passphrase hidden]') });
        remember(harnessCommand);
        harness.run(harnessCommand);
        paintOut(); paintPrompt();
        coachNote({ command: harnessCommand === cmd ? cmd : 'mcode <passphrase>', title: 'Handled by the mcode session', kind: 'ok',
          why: ['mcode owns the terminal until you type /exit, so this line went to the harness and its answer is written above.'],
          next: ['Type help inside mcode to list its commands, or /exit to return to the terminal.'] });
        const input = $('tpgin');
        if (input) { input.value = ''; input.focus(); }
        return;
      }
      // Shells with a file tree get the note as a real file, so their own ls, cd, cat, find, grep, chmod and stat agree.
      // Shells without files (Python, SQL, git...) keep a small note filesystem of their own for the same commands.
      const files = discoveryTree();
      if (canDiscoverNote && files) note().mount(files.tree, files.home, files.win);
      /* a Security range is not a file sandbox: its own commands own every word, including ls/cat/grep */
      const discovery = !canDiscoverNote || sh.range || shellOnly === 'agent' ? null : files ? note().payload(cmd) :
        /^(?:ls|ll|dir|tree|cat|type|more|less|head|tail|grep|wc|find|stat|file|chmod|cd|pwd|decode|base64|hex|xxd|rot13|rev|reverse|echo|printf|get-childitem|get-content|set-location|get-location)(?:\s|$)/i.test(cmd) ? note().command(cmd) : null;
      if (discovery) {
        log.push({ k: 'cmd', t: currentPrompt() + cmd });
        if (discovery.out) log.push({ k: 'out', t: discovery.out });
        explain(cmd, discovery.out);
        remember(cmd);
        paintOut();
        const input = $('tpgin');
        if (input) input.value = '';
        return discovery.out;
      }
      // Real Python: a `python3` line is read from this shell's virtual disk and run by the bundled interpreter.
      // Nothing is installed and nothing on the PC is touched.
      if (S.mode === 'sandbox' && !discovery && TP.python) {
        const snap = (sh.workspace?.() || sh)?.snapshot?.() || {};
        const spec = TP.python.parse(cmd, { shell: sh.id, tree: snap.fs || snap.tree, cwd: snap.cwd, home: files?.home });
        if (spec) {
          log.push({ k: 'cmd', t: sh.prompt() + cmd });
          remember(cmd);
          const input = $('tpgin');
          if (input) input.value = '';
          if (spec.text != null) {
            if (spec.text) log.push({ k: 'out', t: spec.text });
            explain(cmd, spec.text || '');
            paintOut(); paintPrompt();
            return spec.text || '';
          }
          const pending = { k: 'dim', t: 'python: starting the bundled interpreter (the first run takes a few seconds)…' };
          log.push(pending);
          paintOut(); paintPrompt();
          explain(cmd, 'The bundled interpreter is starting. Its output appears here when the run finishes.');
          const pendingKey = key;
          TP.python.run(spec).then(result => {
            pending.k = 'out';
            pending.t = result.text || '(python finished with no output)';
            saveView(pendingKey);
            paintOut(); paintPrompt();
            if (key === logKey(S.shell)) explain(cmd, pending.t);
          }, e => {
            pending.k = 'out';
            pending.t = 'python: ' + (e && e.message || e);
            saveView(pendingKey);
            paintOut();
            if (key === logKey(S.shell)) explain(cmd, pending.t);
          });
          return '';
        }
      }
      const withDiscovery = output => discovery ?
        [/command not found|not recognized|not available/i.test(String(output || '')) ? '' : output, discovery.out].filter(Boolean).join('\n') : output;
      if (S.mode === 'lab') {
        const s = labSession(S.shell);
        if (!s) return;
        log.push({ k: 'cmd', t: s.prompt() + cmd });
        let res;
        try { res = s.run(cmd); } catch (e) { res = { out: 'labyrinth error: ' + (e && e.message || e) }; }
        const out = withDiscovery(typeof res === 'string' ? res : res && res.out);
        if (out) log.push({ k: res && res.solved ? 'ok' : 'out', t: out });
        explain(cmd, out, { solved: res?.solved, reset: res?.reset });
        remember(cmd);
        paintOut();
        paintMeta();
        paintPrompt();
        if (res?.solved) lockAfterSolve();
        if (res && (res.solved || res.reset)) { draw(); return out; }
        const inp = $('tpgin');
        if (inp) { inp.value = ''; try { inp.focus({ preventScroll: true }); } catch (e) { } }
        return out;
      }
      if (S.mode === 'puzzle') {
        const s = puzSession(S.shell);
        if (!s) return;
        if (/^new$/i.test(cmd)) { puzSession(S.shell, true); draw(); return; }
        if (/^clear$|^cls$/i.test(cmd)) {
          log.length = 0; explain(cmd, ''); saveView(key); paintOut();
          const inp = $('tpgin'); if (inp) inp.value = '';
          return;
        }
        log.push({ k: 'cmd', t: s.prompt() + cmd });
        let res;
        try { res = s.run(cmd); } catch (e) { res = { out: 'puzzle error: ' + (e && e.message || e) }; }
        savePuzzle(S.shell);
        const out = withDiscovery(typeof res === 'string' ? res : res && res.out);
        if (out) log.push({ k: res && res.solved ? 'ok' : 'out', t: out });
        explain(cmd, out, { solved: res?.solved });
        remember(cmd);
        if (res && res.solved) { lockAfterSolve(); draw(); return out; }
        paintOut();
        paintMeta();
        paintPrompt();
        const inp = $('tpgin');
        if (inp) { inp.value = ''; try { inp.focus({ preventScroll: true }); } catch (e) { } }
        return out;
      }
      if (/^clear$|^cls$/i.test(cmd) && S.shell !== 'crypto' && S.shell !== 'network' && S.shell !== 'docker' && S.shell !== 'git') log.length = 0;
      /* a password typed for ssh or scp is not echoed and stays out of history, like a real terminal */
      const secret = !!sh.secret?.();
      log.push({ k: 'cmd', t: sh.prompt() + (secret ? '' : cmd) });
      let out = '';
      let trace;
      const jobsBefore = sh.jobs?.().completed;
      try { out = sh.id === 'bash' && TP.coach ? sh.run(cmd, details => { trace = details; }) : sh.run(cmd); }
      catch (e) { out = 'sandbox error: ' + (e && e.message || e); }
      out = withDiscovery(out);
      if (typeof out === 'string' && out) log.push({ k: 'out', t: out });
      else if (out != null && typeof out !== 'string') log.push({ k: 'out', t: String(out) });
      if (!secret) { explain(cmd, out, {}, trace); remember(cmd); }
      if (jobsBefore != null && sh.jobs?.().completed > jobsBefore) lockAfterSolve();
      paintOut();
      paintPrompt();
      paintMeta();
      const inp = $('tpgin');
      if (inp) { inp.value = ''; maskInput(); try { inp.focus({ preventScroll: true }); } catch (e) { } }
      return out;
    }

    function remember(command) {
      const key = logKey(S.shell), history = S.hist[key];
      history.push(command);
      if (history.length > 250) history.shift();
      S.hi[key] = history.length;
      saveView(key);
    }

    function resetShell() {
      guestMcode = null;
      const key = logKey(S.shell);
      TP.python?.reset?.();
      drafts[key] = '';
      delete coachReports[key];
      if (S.mode === 'lab') {
        const s = labSession(S.shell);
        if (!s) return;
        lockAfterSolve();
        const log = curLog();
        log.length = 0;
        const res = s.run('reset');
        const out = typeof res === 'string' ? res : res && res.out;
        if (out) log.push({ k: 'dim', t: out });
        saveView(key);
        draw();
        return;
      }
      if (S.mode === 'puzzle') {
        puzSession(S.shell, true);
        draw();
        return;
      }
      const cmd = current().jobs?.().active ? 'job reset' : RESET[S.shell];
      const log = curLog();
      log.length = 0;
      if (cmd) { try { const r = current().run(cmd); if (r) log.push({ k: 'dim', t: String(r) }); } catch (e) { } }
      else log.push({ k: 'dim', t: 'this sandbox keeps no state to reset' });
      saveView(key);
      paintOut();
      paintPrompt();
      paintCoach();
      const inp = $('tpgin');
      if (inp) { inp.value = ''; inp.focus(); }
    }

    el.onclick = e => {
      const modeBtn = e.target.closest('[data-mode]');
      if (modeBtn) return switchMode(modeBtn.dataset.mode);
      if (e.target.closest('[data-lm-close]')) { S.learnOpen = false; return draw(); }
      if (e.target.closest('[data-lm-restart]')) { S.lm = { shell: S.shell, step: 0, picked: null, right: 0, finished: false }; return draw(); }
      if (e.target.closest('[data-lm-next]')) {
        const data = lmData();
        if (data && S.lm && S.lm.step + 1 >= data.steps.length) S.lm.finished = true;
        else if (S.lm) S.lm.step += 1;
        if (S.lm) S.lm.picked = null;
        return draw();
      }
      const lmChoice = e.target.closest('[data-lm-choice]');
      if (lmChoice) {
        if (!S.lm || S.lm.picked != null) return;
        S.lm.picked = Number(lmChoice.dataset.lmChoice) || 0;
        if (lmChoice.dataset.ok === '1') S.lm.right += 1;
        return draw();
      }
      const learnCmd = e.target.closest('[data-learn-cmd]');
      if (learnCmd) {
        const input = $('tpgin');
        if (input) { input.value = learnCmd.dataset.learnCmd; input.oninput?.(); input.focus(); }
        return;
      }
      if (e.target.closest('[data-learn-next]')) {
        const key = logKey(S.shell) + ':learn';
        const course = learnCourse();
        S.learnAt[key] = Math.min((S.learnAt[key] ?? 0) + 1, (course?.steps?.length || 1) - 1);
        return draw();
      }
      if (e.target.closest('[data-learn-reset]')) { S.learnAt[logKey(S.shell) + ':learn'] = 0; return draw(); }
      if (e.target.closest('[data-learn-hint]')) { exec('hint', true); return; }
      const tab = e.target.closest('[data-shell]');
      if (tab) return switchShell(tab.dataset.shell);
      const pd = e.target.closest('[data-pdiff]');
      if (pd && PUZ && PUZ.DIFFS[pd.dataset.pdiff]) {
        S.puzDiff = pd.dataset.pdiff;
        ls.set('tpg_pdiff', S.puzDiff);
        puzSession(S.shell, true);
        return draw();
      }
      const playCust = e.target.closest('[data-playcustom]');
      if (playCust && PUZ) {
        const item = PUZ.loadCustom().find(x => x.id === playCust.dataset.playcustom);
        if (item) {
          S.puzEditor = null;
          S.shell = byId(item.shell).id;
          ls.set('tpg_shell', S.shell);
          S.puzDiff = item.difficulty || 'medium';
          S.puzCat = item.generation?.category || 'auto';
          puzSession(S.shell, true, item);
          return draw();
        }
      }
      const delCust = e.target.closest('[data-delcustom]');
      if (delCust && PUZ) {
        PUZ.deleteCustom(delCust.dataset.delcustom);
        return draw();
      }
      const ex = e.target.closest('[data-ex]');
      if (ex) {
        const inp = $('tpgin');
        if (S.mode !== 'sandbox') {
          if (inp) { inp.value = ex.dataset.ex; inp.oninput?.(); inp.focus(); }
          return;
        }
        if (inp) { inp.value = ex.dataset.ex; inp.focus(); }
        return exec(ex.dataset.ex, true);
      }
      const b = e.target.closest('button');
      if (!b) {
        if (e.target.closest('#tpgout')) return;
        const sel = window.getSelection ? window.getSelection() : null;
        const hasSel = !!(sel && sel.rangeCount && !sel.isCollapsed);
        if (e.target.closest('#tpgprompt') && !hasSel) { const i = $('tpgin'); if (i) { try { i.focus({ preventScroll: true }); } catch (e2) { i.focus(); } } }
        return;
      }
      if (b.id === 'tpgclear') { curLog().length = 0; saveView(logKey(S.shell)); paintOut(); const i = $('tpgin'); if (i) i.focus(); }
      else if (b.id === 'tpgreset') resetShell();
      else if (b.dataset.job) exec('job ' + b.dataset.job, true);
      else if (b.dataset.act === 'curios') exec('curios', true);
      else if (b.dataset.act === 'manual') openManual('');
      else if (b.dataset.act === 'learn') {
        S.learnOpen = !S.learnOpen;
        if (S.learnOpen) S.lm = { shell: S.shell, step: 0, picked: null, right: 0, finished: false };
        draw();
      }
      else if (b.dataset.act === 'coachhelp') openManual(coachReports[logKey(S.shell)]?.manual || '');
      else if (b.dataset.act === 'coachtry') {
        const command = coachReports[logKey(S.shell)]?.commands?.[Number(b.dataset.step)];
        const input = $('tpgin');
        if (input && typeof command === 'string') { input.value = command; input.oninput?.(); input.focus(); }
      }
      else if (b.dataset.act === 'saveprogress') saveProgress();
      else if ((/^scen/.test(b.dataset.act || '') || ['labcustom', 'labai', 'labbuild', 'labedit', 'labsave', 'labclose', 'aigo'].includes(b.dataset.act)) && scenarioShell()) scenarioClick(b.dataset.act, b.dataset.name);
      else if (b.dataset.act === 'mcodeswarm' && mcodeEnabled) exec('mcode /swarm');
      else if (b.dataset.act === 'mcodewhip' && mcodeEnabled) { exec('mcode /whip'); paintWhipButton(); }
      else if (b.dataset.act === 'mcodeswitch' && TP.mcodeIsUnlocked()) {
        mcodeEnabled = !mcodeEnabled;
        TP.writeSave(mcodeSettingKey, mcodeEnabled);
        refreshMcode();
        $('tpgmcodectl')?.querySelector?.('button')?.focus();
      }
      else if (b.id === 'tpgfs') {
        S.fs = !S.fs;
        if (A.termFS) A.termFS.apply($('tpgbox'), S.fs, b, () => { S.fs = false; });
        const i = $('tpgin'); if (i) { try { i.focus({ preventScroll: true }); } catch (e2) { i.focus(); } }
      }
      else if (b.dataset.act === 'labhint') exec('hint', true);
      else if (b.dataset.act === 'labmap') exec('map', true);
      else if (b.dataset.act === 'labreset') resetShell();
      else if (b.dataset.act === 'labcustomize' && PUZ) {
        const room = labSession(S.shell).room();
        S.mode = 'puzzle';
        ls.set('tpg_mode', S.mode);
        S.filter = '';
        S.puzDiff = room.difficulty;
        S.puzCat = room.generation.category;
        S.puzEditor = { base: PUZ.generate({ ...room.generation, shell: S.shell, difficulty: room.difficulty }) };
        draw();
      }
      else if (b.dataset.act === 'puznew') { puzSession(S.shell, true); draw(); }
      else if (b.dataset.act === 'puzhint') exec('hint', true);
      else if (b.dataset.act === 'puzwalk') exec('walkthrough', true);
      else if (b.dataset.act === 'puzcheck') { const a = $('puzans'); if (a && a.value.trim()) { exec('solve ' + a.value.trim(), true); a.value = ''; } }
      else if (b.dataset.act === 'puzcreate' && PUZ) { S.puzEditor = {}; draw(); }
      else if (b.dataset.act === 'puzai' && PUZ) { askAiPuzzle(); return; }
      else if (b.dataset.act === 'puzcustomize' && PUZ) {
        const base = puzSession(S.shell).puzzle;
        const saved = base.custom && PUZ.loadCustom().find(item => item.id === base.id);
        S.puzEditor = { base, saved };
        draw();
      }
      else if (b.dataset.act === 'puzcancel') { S.puzEditor = null; draw(); }
      else if (b.dataset.act === 'puzloadseed' && PUZ) {
        const inp = $('puzseed');
        const parsed = PUZ.parseSeedCode(inp ? inp.value : '');
        if (!parsed) { if (A.toast) A.toast('Invalid seed code (format: shell:difficulty:category:number)'); return; }
        S.shell = parsed.shell; S.puzDiff = parsed.difficulty; S.puzCat = parsed.category;
        ls.set('tpg_shell', S.shell); ls.set('tpg_pdiff', S.puzDiff);
        puzSession(S.shell, true, null, parsed.seed, parsed.extraLayers);
        draw();
      }
      else if (b.dataset.act === 'puzsave' && PUZ && S.puzEditor) {
        const value = id => $(id).value.trim();
        const manual = value('cpSetup') === 'files';
        const answer = value('cpAnswer');
        const seed = value('cpSeed');
        if (manual && !answer) {
          $('cpError').textContent = 'Enter the expected answer for your files.';
          $('cpAnswer').focus();
          return;
        }
        if (!manual && seed && !$('cpSeed').checkValidity()) {
          $('cpError').textContent = 'Enter a whole-number seed from 1 to 4294967295.';
          $('cpSeed').focus();
          return;
        }
        const item = PUZ.addCustom({
          id: S.puzEditor.saved?.id,
          shell: value('cpShell'),
          difficulty: value('cpDiff'),
          title: value('cpTitle'),
          brief: value('cpBrief'),
          answer,
          hints: value('cpHints').split(/\r?\n/),
          walkthrough: value('cpWalk').split(/\r?\n/),
          filesText: manual ? $('cpFiles').value : '',
          generation: manual ? null : { category: value('cpCategory'), seed }
        });
        S.shell = item.shell;
        S.puzDiff = item.difficulty;
        S.puzCat = item.generation?.category || 'auto';
        S.puzEditor = null;
        ls.set('tpg_shell', S.shell); ls.set('tpg_pdiff', S.puzDiff);
        puzSession(S.shell, true, item);
        if (A.toast) A.toast('Custom puzzle saved & loaded!');
        draw();
      }
    };

    mcodeListeners.add(paintMcodeSetting);
    shellLog(S.shell);
    draw();
    return () => {
      mounted = false;
      mcodeListeners.delete(paintMcodeSetting);
      manual?.close();
      for (const harness of harnesses.values()) harness.close();
      if (S.fs && A.termFS) { S.fs = false; A.termFS.exit(); }
    };
  }

  P.games.terminal_playground = {
    name: 'Terminal playground · 10 shells + pentest ranges',
    icon: '🧪',
    desc: 'Ten simulated terminals with free play, repeatable practice jobs, hidden curios, custom puzzles and an endless Labyrinth, plus two offline Security ranges: breach a fake website or take remote access to invented PCs.',
    cat: 'cyber',
    mount: (el, api) => mount(el, api)
  };
})();

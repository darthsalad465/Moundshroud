// Labyrinth engine — the endless descent behind the terminal playground.
// A session keeps a seed, depth, and checkpoint. Find each checkpoint's key with the
// shell's commands, then enter `solve <answer>` to advance.
(function () {
  const L = window.TerminalLabyrinth;
  if (!L || !L.makeRoom) return;

  const TIERS = ['Surface', 'Cellars', 'Catacombs', 'Deep vaults', 'Undercroft', 'Black archive', 'The Labyrinth', 'Abyss'];
  const keyFor = shell => 'tplab_' + shell;
  const readState = shell => {
    try {
      const v = JSON.parse(localStorage.getItem(keyFor(shell)) || '{}');
      const depth = Number.isFinite(v.depth) ? Math.max(1, v.depth | 0) : 1;
      return {
        seed: Number.isFinite(v.seed) ? v.seed >>> 0 : null,
        depth,
        checkpoint: Number.isInteger(v.checkpoint) && v.checkpoint >= 0 && v.checkpoint < checkpointCount(depth)
          ? v.checkpoint : 0,
        best: Number.isFinite(v.best) ? Math.max(1, v.best | 0) : 1,
        runs: Number.isFinite(v.runs) ? v.runs | 0 : 0,
        hints: Math.max(0, v.hints | 0), failures: Math.max(0, v.failures | 0),
        workspace: v.workspace
      };
    } catch (e) { return { seed: null, depth: 1, best: 1, runs: 0, checkpoint: 0 }; }
  };
  const newSeed = () => {
    try { return crypto.getRandomValues(new Uint32Array(1))[0] >>> 0; }
    catch (e) { return (Math.random() * 4294967295) >>> 0; }
  };
  const tierName = d => TIERS[Math.min(TIERS.length - 1, L.tier(d) - 1)];
  const difficulties = ['easy', 'medium', 'hard', 'insane'];
  /* Fair scaling for deep floors. Up to depth 24 the original ramp adds a pair of checkpoints every 8 floors (6 at most);
     after that a floor has 6 checkpoints, 7 from depth 75 and 8 from 150, so the count never balloons.
     From depth 25 every key gets extra encoding layers (1 more, plus 1 every 45 floors, up to 6 in all), and from
     depth 200 the key must be typed backwards. Depths 1-8 keep the original Easy-to-Insane build-up. */
  const checkpointCount = depth => depth <= 24 ? Math.ceil(depth / 8) * 2 - (depth % 8 === 1 ? 1 : 0) : depth >= 150 ? 8 : depth >= 75 ? 7 : 6;
  const extraLayers = depth => depth < 25 ? 0 : Math.min(5, 1 + Math.floor((depth - 25) / 45));
  const reversedKeys = depth => depth >= 200;

  function makeCheckpoint(shell, depth, seed, index) {
    // Each eight-floor cycle takes a new pair from Easy through Insane.
    const step = (depth - 1) % 8;
    const difficulty = depth > 24 ? 'insane' : index >= (step === 0 ? 1 : 2)
      ? 'insane'
      : difficulties[Math.floor((step - (step > 0 && index === 0 ? 1 : 0)) / 2)];
    const puzzleSeed = ((seed + Math.imul(index, 0x9e3779b9)) >>> 0) || 1;
    const studio = window.TerminalPuzzles;
    if (!studio) return L.makeRoom(shell, depth, puzzleSeed);
    const options = { shell, difficulty, seed: puzzleSeed, category: 'auto', extraLayers: extraLayers(depth) };
    if (['bash', 'powershell', 'cmd'].includes(shell)) {
      // Keep the number of stages consistent even when the scenario changes.
      if (difficulty === 'medium') options.category = 'pipeline';
      if (difficulty === 'hard') options.category = ['corrupt_shards', 'forensic_corr', 'pipeline'][puzzleSeed % 3];
      if (difficulty === 'insane') options.category = ['breadcrumb', 'corrupt_shards', 'forensic_corr'][puzzleSeed % 3];
    }
    const puzzle = studio.generate(options);
    if (reversedKeys(depth)) puzzle.brief = String(puzzle.brief || '') + '\n\n⟲ Depth 200+: when you find the key, type it BACKWARDS: solve <key reversed>.';
    if (extraLayers(depth)) puzzle.brief = String(puzzle.brief || '') + '\n\n🜂 Deep floor: keys here carry ' + extraLayers(depth) + ' extra encoding layer' + (extraLayers(depth) > 1 ? 's' : '') + ' (counted in the layer numbers above).';
    return Object.assign(puzzle, { depth, kind: puzzle.kind || puzzle.category.replace(/_/g, ' ') });
  }

  L.session = function (shell) {
    const state = readState(shell);
    let seed = state.seed == null ? newSeed() : state.seed;
    let depth = state.depth;
    let best = state.best;
    let runs = state.runs;
    let hints = state.hints || 0;
    let failures = state.failures || 0;
    let checkpoint = state.checkpoint;
    let room = makeCheckpoint(shell, depth, seed, checkpoint);
    if (state.workspace && typeof state.workspace === 'object') room.restore?.(state.workspace);

    const save = () => {
      try {
        localStorage.setItem(keyFor(shell), JSON.stringify({ seed, depth, best, runs, checkpoint, hints, failures, workspace: room.snapshot?.() }));
        return true;
      } catch (e) { }
      return false;
    };

    const answerOf = r => { const a = String(r.answer).trim().toLowerCase(); return reversedKeys(depth) ? [...a].reverse().join('') : a; };
    const matchesAnswer = value => !!value && answerOf(room) === value.trim().toLowerCase();
    const rating = () => {
      const difficulty = window.TerminalPuzzles?.DIFFS[room.difficulty];
      const stages = room.stages || 1;
      return (difficulty ? difficulty.label + ' · ' : '') + stages + ' stage' + (stages === 1 ? '' : 's');
    };
    const checkpointLabel = () => 'Checkpoint ' + (checkpoint + 1) + ' of ' + checkpointCount(depth);

    function welcome() {
      return [
        '╔═ LABYRINTH · ' + shell.toUpperCase() + ' ═╗',
        '  depth ' + depth + '  ·  ' + tierName(depth) + '  ·  ' + checkpointLabel() + '  ·  ' + rating(),
        '  best ' + best + '  ·  ' + runs + ' room' + (runs === 1 ? '' : 's') + ' opened',
        '',
        room.brief,
        '',
        '  solve <answer>   descend        hint   depth   map   reset'
      ].join('\n');
    }

    function nextRoom() {
      if (checkpoint + 1 < checkpointCount(depth)) {
        checkpoint++;
        room = makeCheckpoint(shell, depth, seed, checkpoint);
        hints = 0;
        save();
        return '✓ Checkpoint opened.\n\n' + checkpointLabel() + ' · ' + rating() + '\n\n' + room.brief;
      }
      depth++;
      best = Math.max(best, depth);
      runs++;
      seed = ((seed * 1664525 + 1013904223) >>> 0);
      checkpoint = 0;
      room = makeCheckpoint(shell, depth, seed, checkpoint);
      hints = 0;
      save();
      return [
        '',
        '✓ key accepted — the floor gives way.',
        '',
        '╔═ DEPTH ' + depth + ' · ' + tierName(depth) + ' ═╗',
        checkpointLabel() + ' · ' + rating(),
        room.brief,
        '',
        '  ' + (depth % 5 === 0 ? 'milestone: the air changes down here.' : 'solve <answer> when you have it.  hint costs nothing but pride.')
      ].join('\n');
    }

    function completeCheckpoint() {
      return { out: nextRoom(), solved: true, depth };
    }

    function run(rawLine) {
      const raw = String(rawLine == null ? '' : rawLine).trim();
      if (!raw) return { out: '' };
      const curio = window.TerminalPlayground?.curios?.run(raw, 'lab', shell);
      if (curio != null) return { out: curio };
      const words = raw.split(/\s+/);
      const name = (words[0] || '').toLowerCase();
      const args = words.slice(1);

      if (name === 'help' || name === '?' || name === 'cmds') {
        const TP = window.TerminalPlayground;
        const base = room.cmds && typeof room.cmds.help === 'function'
          ? room.cmds.help(args)
          : (TP && TP.formatHelp ? TP.formatHelp(shell, args) : (room.cmds && room.cmds.help ? room.cmds.help : ''));
        const extra = args.length ? '' : [
          '',
          '── LABYRINTH COMMANDS ──',
          '  solve <answer>                        unlock the next checkpoint or descend',
          '  hint                                  show a clue for the current room',
          '  depth                                 display current depth, tier, and stats',
          '  map                                   view all Labyrinth depth tiers',
          '  mcode <passphrase>                    open the mcode helper (find the hidden mcode.txt note first; from depth 5)',
          '  save                                  save the current checkpoint and workspace',
          '  reset                                 restart descent from depth 1 with a fresh seed'
        ].join('\n');
        return { out: String(base || '') + extra };
      }
      if (name === 'depth' || name === 'status' || (name === 'where' && !args.length)) {
        return { out: 'DEPTH   ' + depth + ' / ' + tierName(depth) + '  (best ' + best + ')\nROOM    ' + room.title + '\n        ' + checkpointLabel() + ' · ' + rating() + '\nHINTS   ' + hints + ' this room · failed keys ' + failures };
      }
      if (name === 'map') {
        return {
          out: ['LABYRINTH MAP', '',
            '  depth 1      One Easy checkpoint',
            '  depths 2–4   Two checkpoints, building to Medium',
            '  depths 5–6   Hard checkpoints enter the rotation',
            '  depths 7–8   Insane checkpoints enter the rotation',
            '  depths 9–24  Keep the Insane checkpoints and build up another pair every eight floors',
            '  depth 25+    Six Insane checkpoints, and every key gains an extra encoding layer',
            '  depth 70+    Two extra layers (a third from 115, a fourth from 160, up to six layers in all)',
            '  depth 75+    Seven checkpoints per floor; depth 150+ eight',
            '  depth 200+   Keys must be typed backwards', '',
            '  you are at depth ' + depth + ' (' + tierName(depth) + ')', '  best reached: ' + best, '  rooms opened: ' + runs
          ].join('\n')
        };
      }
      if (name === 'hint') {
        hints++;
        save();
        return { out: 'hint · ' + (room.hint || 'read every file in the room; the answer is in one of them') };
      }
      if (name === 'reset' || name === 'restart') {
        depth = 1; checkpoint = 0; best = Math.max(best, 1); runs = 0; seed = newSeed(); hints = 0; failures = 0;
        room = makeCheckpoint(shell, depth, seed, checkpoint);
        save();
        return { out: 'the stair resets. depth 1.\n\n' + welcome(), reset: true };
      }
      if (name === 'solve' || name === 'unlock' || name === 'key' || name === 'submit') {
        const sp = raw.indexOf(' ');
        const given = sp < 0 ? '' : raw.slice(sp + 1).trim().toLowerCase();
        if (!given) return { out: 'usage: solve <answer>' };
        if (matchesAnswer(given)) return completeCheckpoint();
        failures++;
        save();
        return { out: '✗ that is not the key. The walls do not move.\n  (read the objective, then read the room — the answer is somewhere in it)' };
      }
      if (name === 'clear' || name === 'cls') return { out: '' };
      if (name === 'save' && !args.length) return { out: save() ? 'Checkpoint saved on this device.' : 'Local storage is unavailable or full. Keep this session open.' };

      /* delegate to the room */
      try {
        if (typeof room.run === 'function') return { out: String(room.run(raw) ?? '') };
        const alias = room.aliases && room.aliases[name];
        const fn = (room.cmds && (room.cmds[name] || room.cmds[alias])) || null;
        if (!fn) return { out: 'labyrinth: ' + words[0] + ': unknown command. Help lists this room\'s commands.' };
        return { out: String(fn(args, null) ?? '') };
      } catch (e) {
        return { out: 'error: ' + (e && e.message || e) };
      } finally {
        save();
      }
    }

    save(); /* pin the seed straight away, so the exact same room comes back next visit */
    return {
      shell, run, save, matchesAnswer,
      room: () => room,
      depth: () => depth,
      checkpointLabel,
      rating,
      best: () => best,
      runs: () => runs,
      prompt: () => (typeof room.prompt === 'function' ? room.prompt() : room.prompt || '$ '),
      cwdPath: () => room.cwdPath?.(),
      welcome,
      reset: () => run('reset'),
      tier: () => tierName(depth)
    };
  };

  L.tierName = tierName;
})();

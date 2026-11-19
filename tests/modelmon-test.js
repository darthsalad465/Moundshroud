// Model Monsters (web/js/modelmon-core.js): the model metadata really becomes the monster's stats, dual types
// and abilities follow that metadata, team battles switch/faint/end cleanly, and the Curators field legal squads.
const path = require('path');

module.exports = async ok => {
  const C = require(path.join(__dirname, '..', 'web', 'js', 'modelmon-core.js'));
  const eq = (name, got, want) => ok(name, got === want, 'got ' + JSON.stringify(got) + ', wanted ' + JSON.stringify(want));
  const near = (name, got, want, tol) => ok(name, Math.abs(got - want) <= tol, 'got ' + got + ', wanted about ' + want);

  /* ---------------- types ---------------- */
  eq('modelmon: there are six types', C.TYPE_KEYS.length, 6);
  eq('modelmon: Ember is strong against Bloom', C.typeMult('ember', 'bloom'), 1.5);
  eq('modelmon: Bloom is weak against Ember', C.typeMult('bloom', 'ember'), .75);
  eq('modelmon: Bloom drinks Tide', C.typeMult('bloom', 'tide'), 1.5);
  eq('modelmon: Tide quenches Ember', C.typeMult('tide', 'ember'), 1.5);
  eq('modelmon: Storm cracks Stone', C.typeMult('storm', 'stone'), 1.5);
  eq('modelmon: Frost freezes Storm', C.typeMult('frost', 'storm'), 1.5);
  eq('modelmon: a type is neutral against itself', C.typeMult('tide', 'tide'), 1);
  eq('modelmon: Data is always neutral', C.typeMult('data', 'frost'), 1);
  ok('modelmon: every type has exactly one strong and one weak matchup',
    C.TYPE_KEYS.every(k => C.TYPE_KEYS.filter(x => C.STRONG[k] === x).length === 1 && C.TYPE_KEYS.filter(x => C.STRONG[x] === k).length === 1));
  eq('modelmon: family names choose the right type', C.typeFor('llama3:8b', 'llama'), 'ember');
  eq('modelmon: qwen is Tide', C.typeFor('qwen3:8b', 'qwen'), 'tide');
  eq('modelmon: gemma is Bloom', C.typeFor('gemma3:12b', 'gemma3'), 'bloom');
  eq('modelmon: deepseek is Frost', C.typeFor('deepseek-r1:7b', 'llama'), 'frost');
  eq('modelmon: mixtral is Storm', C.typeFor('mixtral:8x7b', 'mixtral'), 'storm');
  eq('modelmon: granite is Stone', C.typeFor('granite3.1:8b', 'granite'), 'stone');

  /* dual types */
  eq('modelmon: one matching type gives 1.5x', C.defenseMult('ember', { type: 'bloom', type2: null }), 1.5);
  near('modelmon: two matchups multiply (1.5 x 0.75)', C.defenseMult('ember', { type: 'bloom', type2: 'tide' }), 1.125, .0001);
  eq('modelmon: a duplicate second type is ignored', C.defenseMult('ember', { type: 'bloom', type2: 'bloom' }), 1.5);
  eq('modelmon: STAB works from either type', C.stabFor('tide', { type: 'bloom', type2: 'tide' }), 1.5);
  eq('modelmon: an off-type move gets no STAB', C.stabFor('ember', { type: 'bloom', type2: 'tide' }), 1);

  /* ---------------- metadata parsing ---------------- */
  eq('modelmon: 11.9B parameters are 11.9 billion', C.parseParams('11.9B'), 11.9e9);
  eq('modelmon: 268M parameters are 268 million', C.parseParams('268M'), 268e6);
  eq('modelmon: a mixture listed as 8x7B is 56 billion parameters', C.parseParams('8x7B'), 56e9);
  eq('modelmon: a numeric parameter count passes through', C.parseParams(1.5e9), 1.5e9);
  eq('modelmon: Q4_K_M counts as 4.5 bits', C.quantBits('Q4_K_M'), 4.5);
  eq('modelmon: Q2_0 counts as 2.4 bits', C.quantBits('Q2_0'), 2.4);
  eq('modelmon: Q8_0 counts as 8.5 bits', C.quantBits('Q8_0'), 8.5);
  eq('modelmon: F16 counts as 16 bits', C.quantBits('F16'), 16);
  eq('modelmon: an unknown quantization falls back to Q4', C.quantBits('mystery'), 4.5);
  eq('modelmon: 131072 context reads as 128K', C.formatContext(131072), '128K');
  eq('modelmon: 268M parameters read nicely', C.formatParams(268e6), '268M');
  eq('modelmon: 7.4 GB reads with one decimal', C.formatGigabytes(7.4e9), '7.40');

  /* ---------------- the real metadata becomes the stats ---------------- */
  const gemma = {
    name: 'igorls-gemma12b:latest', size: 7.4e9, family: 'gemma3', parameter_size: '11.9B',
    quantization_level: 'Q4_K_M', context: 131072, capabilities: ['completion', 'vision'],
    digest: 'abc123def456', parameters: 11.9e9
  };
  const gm = C.buildMonster(gemma);
  eq('modelmon: a Gemma model becomes a Bloom monster', gm.type, 'bloom');
  eq('modelmon: 11.9B parameters are Medium tier', gm.tier, 'medium');
  ok('modelmon: level follows the parameter count', gm.level >= 65 && gm.level <= 85, String(gm.level));
  eq('modelmon: four moves are offered', gm.moves.length, 4);
  eq('modelmon: a vision model gets the Perception ability', gm.ability.key, 'perception');
  eq('modelmon: a huge context gives Context Cannon', gm.moves[3].name, 'Context Cannon');
  eq('modelmon: a huge context adds a Tide second type', gm.type2, 'tide');
  eq('modelmon: every move starts at full charges', gm.moves.map(m => m.pp).join(','), gm.moves.map(m => m.maxPp).join(','));
  ok('modelmon: the metadata keeps the real file size and context', gm.meta.size === 7.4e9 && gm.meta.context === 131072);
  ok('modelmon: all six stats are finite and positive', ['hp', 'atk', 'def', 'spa', 'spd', 'spe'].every(k => gm.stats[k] > 0 && isFinite(gm.stats[k])));
  eq("modelmon: HP reaches the fighter's current HP", gm.hp, gm.maxHp);

  const small = { name: 'smol1:latest', size: .3e9, family: 'llama', parameter_size: '268M', quantization_level: 'Q8_0', context: 2048, capabilities: ['completion'] };
  const sm = C.buildMonster(small);
  eq('modelmon: a 268M model is Nano tier', sm.tier, 'nano');
  ok('modelmon: shorter context means lower Sp. Atk than the 128K model', sm.stats.spa < gm.stats.spa, sm.stats.spa + ' vs ' + gm.stats.spa);
  ok('modelmon: a small file means less HP than the 7.4 GB model', sm.stats.hp < gm.stats.hp, sm.stats.hp + ' vs ' + gm.stats.hp);
  ok('modelmon: more parameters mean more Attack', gm.stats.atk > sm.stats.atk, gm.stats.atk + ' vs ' + sm.stats.atk);
  ok('modelmon: more quantization bits mean more Defence', sm.stats.def > C.buildMonster(Object.assign({}, small, { quantization_level: 'Q2_0' })).stats.def);
  ok('modelmon: a bigger file means more HP', C.buildMonster(Object.assign({}, small, { size: 30e9 })).stats.hp > sm.stats.hp);
  ok('modelmon: tool use raises Sp. Def', C.buildMonster(Object.assign({}, small, { tools: true })).stats.spd > sm.stats.spd);

  /* speed: measured tokens/sec wins over the estimate */
  const slow = C.buildMonster(Object.assign({}, small, { tps: 4 }));
  const fast = C.buildMonster(Object.assign({}, small, { tps: 80 }));
  ok('modelmon: measured tokens/sec drives Speed', fast.stats.spe > slow.stats.spe, fast.stats.spe + ' vs ' + slow.stats.spe);
  ok('modelmon: a measured model is marked as measured', fast.meta.measured && !sm.meta.measured);
  ok('modelmon: the estimate is positive and finite', sm.meta.tps > 0 && isFinite(sm.meta.tps));
  ok('modelmon: speed is capped', C.speedFromTps(10000) <= 165 && C.speedFromTps(.01) >= 45);

  /* ---------------- abilities ---------------- */
  const ab = extra => C.abilityFor(Object.assign({
    name: 'x', context: 8192, quantization_level: 'Q4_K_M', vision: false, thinking: false,
    tools: false, experts: 0, tps: 10
  }, extra)).key;
  eq('modelmon: vision gives Perception', ab({ vision: true }), 'perception');
  eq('modelmon: thinking gives Deep Think', ab({ thinking: true }), 'deepthink');
  eq('modelmon: tool use gives Toolbelt', ab({ tools: true }), 'toolbelt');
  eq('modelmon: mixture of experts gives Load Balancer', ab({ experts: 8 }), 'loadbalancer');
  eq('modelmon: eight-bit weights give Full Precision', ab({ quantization_level: 'Q8_0' }), 'fullprecision');
  eq('modelmon: a 128K context gives Wide Context', ab({ context: 131072 }), 'widecontext');
  eq('modelmon: two-bit weights give Compact', ab({ quantization_level: 'Q2_0' }), 'compact');
  eq('modelmon: a fast model gives Overclock', ab({ tps: 70 }), 'overclock');
  eq('modelmon: a plain model gets Adaptive', ab({}), 'adaptive');

  /* ---------------- signature moves ---------------- */
  const sig = extra => C.signatureFor(Object.assign({
    name: 'sig-test', family: 'llama', context: 8192, quantization_level: 'Q4_K_M', tps: 10
  }, extra));
  eq('modelmon: a 128K context fires Context Cannon', sig({ context: 131072 }).name, 'Context Cannon');
  eq('modelmon: a fast model gets Token Rush', sig({ tps: 60 }).name, 'Token Rush');
  eq('modelmon: a 2-bit model gets Quant Crunch', sig({ quantization_level: 'Q2_0' }).name, 'Quant Crunch');
  eq('modelmon: an 8-bit model gets Full Precision', sig({ quantization_level: 'Q8_0' }).name, 'Full Precision');
  eq('modelmon: a vision model gets Vision Scan', sig({ vision: true }).name, 'Vision Scan');
  eq('modelmon: a mixture of experts gets Mixture of Experts', sig({ experts: 4 }).name, 'Mixture of Experts');
  const generic = sig({});
  ok('modelmon: a plain model still gets one of the generic signatures',
    ['Beam Search', 'Hallucination', 'Chain of Thought', 'Cache Refresh'].includes(generic.name), generic.name);
  eq('modelmon: the second type never repeats the first', C.buildMonster({ name: 'x', family: 'qwen', parameter_size: '7B', size: 4e9, quantization_level: 'Q4_K_M', context: 131072, capabilities: [] }).type2, null);

  /* charges: 30 basic, 10 heavy, 15 utility, 5 signature (10 for a status signature) */
  const qwen = C.buildMonster({ name: 'qwen2.5:7b', family: 'qwen', parameter_size: '7B', size: 4.4e9, quantization_level: 'Q4_K_M', context: 131072, capabilities: [] });
  eq('modelmon: basic / heavy / utility / signature charges', qwen.moves.map(m => m.maxPp).join(','), '30,10,15,5');
  let statusSig = null;
  for (let i = 0; i < 40 && !statusSig; i++) {
    const m = C.buildMonster({ name: 'status-' + i, family: 'llama', parameter_size: '7B', size: 4e9, quantization_level: 'Q4_K_M', context: 8192, capabilities: [] });
    if (m.moves[3].kind === 'status') statusSig = m;
  }
  ok('modelmon: a generic status signature gets 10 charges', !!statusSig && statusSig.moves[3].maxPp === 10, statusSig ? String(statusSig.moves[3].maxPp) : 'none found');

  /* ---------------- the circuit ---------------- */
  eq('modelmon: six Curators plus a champion', C.CURATORS.length, 7);
  eq('modelmon: the last Curator is the champion', C.CURATORS[6].champion, true);
  eq('modelmon: a Curator team grows with difficulty', C.curatorTeamSize('ember', 0, 9), 1);
  eq('modelmon: normal difficulty is the listed size', C.curatorTeamSize('ember', 1, 9), 2);
  eq('modelmon: hard difficulty adds one', C.curatorTeamSize('ember', 2, 9), 3);
  eq('modelmon: the champion always fields six', C.curatorTeamSize('champion', 0, 9), 6);
  eq('modelmon: a small roster clamps the team size', C.curatorTeamSize('champion', 1, 3), 3);

  const mk = (name, extra) => C.buildMonster(Object.assign({
    name, size: 4e9, family: 'llama', parameter_size: '7B', quantization_level: 'Q4_K_M',
    context: 32768, capabilities: []
  }, extra));
  const roster = [
    mk('llama3:8b', { family: 'llama', parameter_size: '8B', size: 4.7e9, tps: 20 }),
    mk('qwen2.5:7b', { family: 'qwen', parameter_size: '7B', size: 4.4e9, tps: 24, context: 131072 }),
    mk('gemma2:9b', { family: 'gemma', parameter_size: '9B', size: 5.4e9, tps: 14 }),
    mk('mistral:7b', { family: 'mistral', parameter_size: '7B', size: 4.1e9, tps: 30 }),
    mk('deepseek-r1:7b', { family: 'deepseek', parameter_size: '7B', size: 4.7e9, tps: 12, thinking: true }),
    mk('granite3:8b', { family: 'granite', parameter_size: '8B', size: 4.9e9, tps: 18 }),
    mk('phi4:14b', { family: 'phi', parameter_size: '14B', size: 9e9, tps: 8 }),
    mk('tinyllama:1b', { family: 'llama', parameter_size: '1.1B', size: .6e9, tps: 60, quantization_level: 'Q8_0' }),
    mk('mixtral:8x7b', { family: 'mixtral', parameter_size: '8x7B', size: 26e9, tps: 5, experts: 8 })
  ];
  ok('modelmon: a roster builds one monster per model', C.buildRoster([gemma, small, qwen]).length === 3);
  eq('modelmon: teamOf wraps a lone monster', C.teamOf(roster[0]).length, 1);
  eq('modelmon: teamOf keeps a team', C.teamOf(roster.slice(0, 3)).length, 3);

  const emberTeam = C.buildCuratorTeam(roster, 'ember', { difficulty: 1 });
  eq('modelmon: the Ember Curator fields two monsters', emberTeam.length, 2);
  ok('modelmon: a Curator never duplicates a monster', new Set(emberTeam.map(m => m.name)).size === emberTeam.length);
  ok('modelmon: the Ember Curator prefers Ember monsters', emberTeam.some(m => m.type === 'ember' || m.type2 === 'ember'));
  const champTeam = C.buildCuratorTeam(roster, 'champion', { difficulty: 1 });
  eq('modelmon: the champion fields six', champTeam.length, 6);
  ok('modelmon: the champion picks the strongest levels', champTeam.some(m => m.name === roster.slice().sort((a, b) => b.level - a.level)[0].name));
  eq('modelmon: an unknown Curator has no team', C.buildCuratorTeam(roster, 'nobody', {}).length, 0);
  eq('modelmon: an empty roster has no Curator team', C.buildCuratorTeam([], 'ember', {}).length, 0);

  const quick = C.buildQuickTeam(roster, 6, { seed: 7 });
  eq('modelmon: a quick team respects its size', quick.length, 6);
  ok('modelmon: a quick team never duplicates', new Set(quick.map(m => m.name)).size === 6);
  eq('modelmon: a seeded quick team is deterministic', C.buildQuickTeam(roster, 4, { seed: 7 }).map(m => m.name).join(','), C.buildQuickTeam(roster, 4, { seed: 7 }).map(m => m.name).join(','));
  eq('modelmon: a quick team clamps to the roster', C.buildQuickTeam(roster.slice(0, 2), 6, {}).length, 2);

  /* ---------------- battle state ---------------- */
  const teamA = roster.slice(0, 3), teamB = roster.slice(3, 6);
  const battle = C.createBattle(teamA, teamB, { seed: 12345, player: 'a', aiLevel: 1 });
  eq('modelmon: a battle is version 2', battle.v, 2);
  ok('modelmon: a team battle starts at full HP', battle.teams.a.every(m => m.hp === m.maxHp) && battle.teams.b.every(m => m.hp === m.maxHp));
  eq('modelmon: the battle starts on turn 1', battle.turn, 1);
  eq('modelmon: the player is side a', battle.player, 'a');
  ok('modelmon: both bags hold two patches and one reset', battle.bag.a.patch === 2 && battle.bag.a.reset === 1 && battle.bag.b.patch === 2);
  eq('modelmon: no switch is pending at the start', battle.pendingSwitch, null);
  ok('modelmon: creating a battle leaves the originals untouched', teamA.every(m => m.hp === m.maxHp));

  const res = C.resolveTurn(battle, { kind: 'move', index: 0 }, { kind: 'move', index: 0 });
  ok('modelmon: a turn produces events', res.events.length > 3, String(res.events.length));
  eq('modelmon: a turn advances the counter', battle.turn, 2);
  ok('modelmon: HP never leaves its bounds', ['a', 'b'].every(s => battle[s].hp >= 0 && battle[s].hp <= battle[s].maxHp));
  ok('modelmon: no log line contains NaN or undefined', battle.log.every(t => !/NaN|undefined/.test(t)), battle.log.find(t => /NaN|undefined/.test(t)) || '');

  /* switching costs the turn and resets stages */
  const sw = C.createBattle(teamA.slice(0, 2), teamB.slice(0, 2), { seed: 5, player: 'a' });
  sw.a.stages.atk = 2;
  const swRes = C.resolveTurn(sw, { kind: 'switch', index: 1 }, { kind: 'move', index: 0 });
  eq('modelmon: a swap sends out the chosen team-mate', sw.active.a, 1);
  eq('modelmon: a swap changes the active monster', sw.a.name, teamA[1].name);
  ok('modelmon: a swap uses the turn', sw.turn === 2 && swRes.events.some(e => e.k === 'switch'));
  eq('modelmon: stages reset when the monster leaves', sw.teams.a[0].stages.atk, 0);
  C.chooseSwitch(sw, 'a', sw.active.a);
  eq('modelmon: choosing the active monster leaves it out', sw.active.a, 1);

  /* forced switch after the player's monster faints */
  const weak = C.buildMonster({ name: 'weakling', size: .1e9, family: 'llama', parameter_size: '.2B', quantization_level: 'Q4_K_M', context: 2048, capabilities: [] });
  const brute = C.buildMonster({ name: 'brute', size: 30e9, family: 'deepseek', parameter_size: '30B', quantization_level: 'Q8_0', context: 32768, capabilities: [] });
  const forced = C.createBattle([weak, teamA[0]], [brute], { seed: 2, player: 'a', aiLevel: 1 });
  let guard = 0, forcedRes = null;
  while (!forced.over && !forced.pendingSwitch && guard++ < 60) {
    forcedRes = C.resolveTurn(forced, { kind: 'move', index: 0 }, { kind: 'move', index: 0 });
  }
  eq('modelmon: a fainted player monster asks for a replacement', forced.pendingSwitch, 'a');
  eq('modelmon: the ref stays on the fainted monster', forced.a.hp, 0);
  const afterSwitch = C.chooseSwitch(forced, 'a', 1);
  eq('modelmon: the forced replacement comes out', forced.a.name, teamA[0].name);
  eq('modelmon: choosing the replacement clears the prompt', forced.pendingSwitch, null);
  ok('modelmon: the forced switch is reported as an event', afterSwitch.events.some(e => e.k === 'switch'));

  /* team wipe ends the battle */
  const wipe = C.createBattle([weak], [brute], { seed: 3, player: 'a', aiLevel: 1 });
  let wg = 0;
  while (!wipe.over && wg++ < 80) C.resolveTurn(wipe, { kind: 'move', index: 0 }, { kind: 'move', index: 0 });
  eq('modelmon: a team with no monsters left loses', wipe.winner, 'b');
  eq('modelmon: a wipe-out ends the battle', wipe.over, true);
  eq('modelmon: the loser has nobody standing', C.teamAlive(wipe, 'a'), 0);

  /* items */
  const patch = C.createBattle(teamA.slice(0, 1), [roster[5]], { seed: 11, player: 'a' });
  patch.a.hp = 20;
  C.resolveTurn(patch, { kind: 'item', item: 'patch' }, { kind: 'move', index: 0 });
  eq('modelmon: a Cache Patch is spent', patch.bag.a.patch, 1);
  { const want = Math.min(patch.a.maxHp - 20, Math.round(patch.a.maxHp * .35)); ok('modelmon: a Cache Patch restores 35% of max HP', patch.log.some(l => l.includes('restored ' + want + ' HP')), 'wanted ' + want + ': ' + patch.log.join(' | ')); }
  const reset = C.createBattle(teamA.slice(0, 1), [roster[5]], { seed: 12, player: 'a' });
  reset.a.hp = 20;
  reset.a.status.scorch = 3;
  C.resolveTurn(reset, { kind: 'item', item: 'reset' }, { kind: 'move', index: 0 });
  eq('modelmon: a Full Reset is spent', reset.bag.a.reset, 0);
  eq('modelmon: a Full Reset clears status', reset.a.status.scorch, 0);
  const noPatch = C.createBattle(teamA.slice(0, 1), [roster[5]], { seed: 13, player: 'a' });
  noPatch.bag.a.patch = 0;
  C.resolveTurn(noPatch, { kind: 'item', item: 'patch' }, { kind: 'move', index: 0 });
  ok('modelmon: an empty bag cannot heal', noPatch.log.some(l => /No Cache Patch left/.test(l)));

  /* charges run out and Struggle takes over */
  const struggle = C.createBattle(teamA.slice(0, 1), [roster[5]], { seed: 7, player: 'a' });
  struggle.a.moves.forEach(m => { m.pp = 0; });
  C.resolveTurn(struggle, { kind: 'move', index: 0 }, { kind: 'move', index: 0 });
  ok('modelmon: an empty move list falls back to Struggle', struggle.log.some(l => /Struggle/.test(l)));
  ok('modelmon: running out of charges is announced', struggle.log.some(l => /no charges left/.test(l)));

  /* forfeit */
  const forfeit = C.createBattle(teamA.slice(0, 1), [roster[5]], { seed: 14, player: 'a' });
  C.forfeit(forfeit, 'a');
  eq('modelmon: forfeiting hands the win to the foe', forfeit.winner, 'b');
  eq('modelmon: forfeiting ends the battle', forfeit.over, true);

  /* turn limit */
  const timed = C.createBattle(teamA.slice(0, 1), [roster[5]], { seed: 15, player: 'a', maxTurns: 1 });
  C.resolveTurn(timed, { kind: 'move', index: 0 }, { kind: 'move', index: 0 });
  eq('modelmon: a battle past its turn limit ends', timed.over, true);
  ok('modelmon: the turn limit is reported', timed.log.some(l => /Time!/.test(l)));

  /* the AI can pick a legal switch and score moves */
  const aiBattle = C.createBattle(teamA, teamB, { seed: 21, player: 'a', aiLevel: 1 });
  const aiSwitch = C.aiChooseSwitch(aiBattle, 'b', 2);
  ok('modelmon: the AI picks a living team-mate', aiSwitch >= 0 && aiSwitch < teamB.length && aiBattle.teams.b[aiSwitch].hp > 0);
  const action = C.aiChooseAction(aiBattle, 'b', 2);
  ok('modelmon: the AI always returns an action', !!action && ['move', 'switch', 'item', 'run'].includes(action.kind));
  const scoreBattle = C.createBattle(teamA.slice(0, 1), [roster[2]], { seed: 1, player: 'a' });
  const emberHit = Object.assign({}, scoreBattle.a.moves[1], { type: 'ember', kind: 'physical', power: 80, pp: 10, acc: 100 });
  const tideHit = Object.assign({}, scoreBattle.a.moves[1], { type: 'tide', kind: 'physical', power: 80, pp: 10, acc: 100 });
  ok('modelmon: scoreMove prefers a super-effective hit', C.scoreMove(scoreBattle, 'a', emberHit) > C.scoreMove(scoreBattle, 'a', tideHit));

  /* ---------------- seeded team battles always finish ---------------- */
  function autoBattle(a, b, opts) {
    opts = opts || {};
    const st = C.createBattle(a, b, { seed: opts.seed || 1, player: 'a', aiLevel: opts.levelB == null ? 1 : opts.levelB, patches: opts.patches, resets: opts.resets });
    let n = 0;
    while (!st.over && n++ < 800) {
      if (st.pendingSwitch) { C.chooseSwitch(st, st.pendingSwitch, C.aiChooseSwitch(st, st.pendingSwitch, opts.levelA == null ? 1 : opts.levelA)); continue; }
      C.resolveTurn(st, C.aiChooseAction(st, 'a', opts.levelA == null ? 1 : opts.levelA), C.aiChooseAction(st, 'b', opts.levelB == null ? 1 : opts.levelB));
    }
    return st;
  }
  let ended = 0, broken = 0, maxTurn = 0, minTurn = Infinity, totalTurns = 0;
  for (let seed = 1; seed <= 20; seed++) {
    const st = autoBattle(teamA, teamB, { seed });
    if (st.over) ended++;
    if (!['a', 'b'].every(s => st[s].hp >= 0 && st[s].hp <= st[s].maxHp && isFinite(st[s].hp))) broken++;
    if (st.winner && C.teamAlive(st, st.winner === 'a' ? 'b' : 'a') !== 0) broken++;
    maxTurn = Math.max(maxTurn, st.turn); minTurn = Math.min(minTurn, st.turn); totalTurns += st.turn;
  }
  eq('modelmon: 20 seeded team battles all reach an ending', ended, 20);
  eq('modelmon: no team battle breaks HP or leaves a winner with monsters standing', broken, 0);
  ok('modelmon: no team battle drags past the turn limit', maxTurn <= 301, String(maxTurn));
  ok('modelmon: a team battle takes real turns', minTurn >= 4 && totalTurns / 20 >= 7, 'shortest ' + minTurn + ', average ' + (totalTurns / 20).toFixed(1));

  /* six-on-six */
  const six = autoBattle(roster.slice(0, 6), roster.slice(3, 9), { seed: 77, levelA: 1, levelB: 1 });
  eq('modelmon: a six-on-six battle ends', six.over, true);
  ok('modelmon: six-on-six stays inside the turn limit', six.turn <= 301, String(six.turn));
  ok('modelmon: the winner of a six-on-six has someone standing', !six.winner || C.teamAlive(six, six.winner) > 0);

  /* Hard should beat Easy often, with the same squads */
  let winsHard = 0;
  for (let seed = 201; seed <= 240; seed++) {
    const st = autoBattle(teamA, teamB, { seed, levelA: 2, levelB: 0 });
    if (st.winner === 'a') winsHard++;
  }
  ok('modelmon: Hard wins most fights against Easy', winsHard >= 28, winsHard + ' of 40');

  /* a spectator fight is a fight too */
  const watch = autoBattle(roster.slice(0, 3), roster.slice(3, 6), { seed: 999, levelA: 2, levelB: 2 });
  ok('modelmon: a watch-mode battle ends', watch.over && watch.turn <= 301, 'turn ' + watch.turn);
  ok('modelmon: the winner is one of the two sides', !watch.winner || watch.winner === 'a' || watch.winner === 'b');

  /* ---------------- helpers used by the screen ---------------- */
  eq('modelmon: HP percent rounds down safely', C.hpPct({ hp: 50, maxHp: 200 }), 25);
  eq('modelmon: zero HP reads as 0%', C.hpPct({ hp: 0, maxHp: 120 }), 0);
  ok('modelmon: moveSummary shows charges', /CHG/.test(C.moveSummary(qwen.moves[1])) && /88|86|90/.test(C.moveSummary(qwen.moves[1])));
  eq('modelmon: stageMul clamps at +6', C.stageMul(99), 4);
  eq('modelmon: stageMul clamps at -6', C.stageMul(-99), .25);
  ok('modelmon: the tier list covers Nano to Titan', C.TIERS.length === 5 && C.TIERS[0].key === 'nano' && C.TIERS[4].key === 'titan');
  eq('modelmon: status names read nicely', C.statusName('scorch'), 'Scorched');

  /* incomplete metadata should still produce a usable fighter */
  const sparse = C.buildMonster({ name: 'sparse-model', parameters: '1.2B', size: 'not-a-size', capabilities: 'vision', tps: 'unknown' });
  ok('modelmon: partial or malformed metadata still creates a usable monster', sparse.name === 'sparse-model' && sparse.moves.length === 4);
  ok('modelmon: partial metadata keeps every stat finite', ['hp', 'atk', 'def', 'spa', 'spd', 'spe'].every(k => Number.isFinite(sparse.stats[k])));
  eq('modelmon: malformed capabilities do not invent vision', sparse.meta.vision, false);
  const unknown = C.buildMonster(null);
  ok('modelmon: a missing model record falls back safely', unknown.name === 'unknown' && unknown.maxHp > 0);
  const noTeams = (() => { try { C.createBattle([], [roster[0]]); return 'no error'; } catch (e) { return e.message; } })();
  ok('modelmon: an empty team is refused', noTeams !== 'no error', noTeams);

  /* ---------------- the circuit fields its own squads ---------------- */
  const order = ['ember', 'tide', 'bloom', 'storm', 'frost', 'stone', 'champion'];
  ok('modelmon: Curator levels rise along the circuit', order.every((k, i) => i === 0 || C.curatorLevel(k, 1) > C.curatorLevel(order[i - 1], 1)), order.map(k => C.curatorLevel(k, 1)).join(','));
  const own = C.buildCuratorSquad('ember', { difficulty: 1 });
  eq('modelmon: the Ember Curator squad has two monsters', own.length, 2);
  ok('modelmon: a Curator squad is its own, not the player roster', own.every(m => !roster.some(r => r.name === m.name)), own.map(m => m.name).join(','));
  ok('modelmon: the Ember Curator fields Ember monsters', own.every(m => m.type === 'ember' || m.type2 === 'ember'), own.map(m => m.type).join(','));
  ok('modelmon: a Curator squad fights at the Curator level', own.every(m => m.lv >= C.curatorLevel('ember', 1) - 1), own.map(m => m.lv).join(','));
  eq('modelmon: the champion squad has six', C.buildCuratorSquad('champion', { difficulty: 1 }).length, 6);
  ok('modelmon: Hard Curators are higher level than Easy ones', C.curatorLevel('tide', 2) > C.curatorLevel('tide', 0));
  ok('modelmon: every Curator but the champion has a Core reward', order.slice(0, 6).every(k => C.CURATOR_REWARD[k] && C.CURATOR_REWARD[k].text));
  ok('modelmon: a new trainer has three squad slots', C.squadSlots(0) === 3);
  ok('modelmon: the first Core opens a fourth slot', C.squadSlots(1) === 4 && C.squadSlots(2) === 4);
  ok('modelmon: the third and fifth Cores open slots five and six', C.squadSlots(3) === 5 && C.squadSlots(5) === 6 && C.squadSlots(6) === 6);
  ok('modelmon: every slot names the Cores it needs', C.coresForSlot(3) === 0 && C.coresForSlot(4) === 1 && C.coresForSlot(6) === 5);
  ok('modelmon: six slots are open before the Champion', C.squadSlots(6) >= C.curatorTeamSize('champion', 1, 6));
  ok('modelmon: dolphin models are not typed as Phi', C.typeFor('dolphin-llama3:8b', 'llama') === 'ember');

  /* ---------------- pacing at trainer level 1 ---------------- */
  {
    const fresh = roster.slice(0, 6).map(m => C.applyLevel(C.buildMonster(m.meta), 1));
    let turns = [], timeouts = 0;
    for (let i = 0; i < 30; i++) {
      const a = C.buildQuickTeam(fresh, 3, { seed: i * 7 + 1 }), b = C.buildQuickTeam(fresh, 3, { seed: i * 13 + 5 });
      const bt = C.createBattle(a, b, { seed: i });
      while (!bt.over) {
        if (bt.pendingSwitch) { C.chooseSwitch(bt, 'a', C.aiChooseSwitch(bt, 'a', 1)); continue; }
        C.resolveTurn(bt, C.aiChooseAction(bt, 'a', 1), C.aiChooseAction(bt, 'b', 1));
      }
      turns.push(bt.turn); if (bt.log.some(l => /Time!/.test(l))) timeouts++;
    }
    turns.sort((x, y) => x - y);
    ok('modelmon: a fresh Lv 1 three-on-three ends in reasonable time', turns[15] <= 25, 'median ' + turns[15]);
    eq('modelmon: no fresh Lv 1 battle hits the turn limit', timeouts, 0);
  }
  ok('modelmon: trainer level raises the fighting level and stats', (() => { const lo = C.applyLevel(C.buildMonster(roster[0].meta), 1), hi = C.applyLevel(C.buildMonster(roster[0].meta), 50); return hi.level > lo.level && hi.stats.atk > lo.stats.atk; })());
  ok('modelmon: a tiny F16 model is not a Defence wall', C.buildMonster({ name: 'gpt2-tiny', parameters: 5.3e6, size: 1.1e7, quantization_level: 'F16', context: 1024 }).stats.def < 90);

  /* ---------------- every kind of AI model ---------------- */
  eq('modelmon: an embedder is an embedding model', C.kindFor({ name: 'nomic-embed-text', capabilities: ['embedding'] }), 'embedding');
  eq('modelmon: whisper is a speech model', C.kindFor({ name: 'whisper-large-v3' }), 'speech');
  eq('modelmon: a reranker is a reranker', C.kindFor({ name: 'bge-reranker-v2-m3' }), 'reranker');
  eq('modelmon: CLIP is a vision encoder', C.kindFor({ name: 'openai/clip-vit-large-patch14' }), 'encoder');
  eq('modelmon: Stable Diffusion is an image generator', C.kindFor({ name: 'stable-diffusion-v1-5' }), 'diffusion');
  eq('modelmon: a chat model is a language model', C.kindFor({ name: 'llama3.2:3b' }), 'llm');
  const emb = C.buildMonster({ name: 'nomic-embed-text', family: 'nomic-bert', parameters: 1.37e8, size: 2.7e8, quantization_level: 'F16', context: 2048, capabilities: ['embedding'] });
  ok('modelmon: an embedder battles with its own signature', emb.moves[3].name === 'Nearest Neighbour' && emb.ability.key === 'vectorspace');
  const lm = C.buildMonster({ name: 'Qwen2.5-1.5B-Instruct-Q4_K_M', source: 'lmstudio', parameters: 1.5e9, size: 1e9, quantization_level: 'Q4_K_M' });
  ok('modelmon: an LM Studio model builds a monster and keeps its source', lm.meta.source === 'lmstudio' && lm.type === 'tide');

  /* ---------------- Heretic and crafted models ---------------- */
  const plainMeta = { name: 'qwen3:4b', family: 'qwen3', parameters: 4e9, size: 2.5e9, quantization_level: 'Q4_K_M', context: 40960 };
  const plain = C.buildMonster(plainMeta), her = C.buildMonster(Object.assign({}, plainMeta, { name: 'qwen3-4b-heretic' }));
  ok('modelmon: a -heretic name makes a Heretic', her.meta.heretic && !plain.meta.heretic);
  ok('modelmon: abliterated models count as Heretic', C.isHeretic({ name: 'llama3.1:8b-abliterated' }));
  ok('modelmon: a Heretic hits harder', her.stats.atk > plain.stats.atk && her.stats.spa > plain.stats.spa, her.stats.atk + ' vs ' + plain.stats.atk);
  ok('modelmon: a Heretic guards less', her.stats.def < plain.stats.def && her.stats.spd < plain.stats.spd);
  ok('modelmon: a Heretic is Unchained with Refusal Bypass', her.ability.key === 'unchained' && her.moves[3].name === 'Refusal Bypass' && her.moves[3].pierce);
  {
    const bt = C.createBattle([her], [plain], { seed: 3 });
    bt.b.ability = Object.assign({}, bt.b.ability); bt.a.status.throttle = 0;
    const fake = { fx: { status: 'throttle' } };
    C.resolveTurn(bt, { kind: 'move', index: 0 }, { kind: 'move', index: 0 });
    bt.b.moves[1] = Object.assign({}, bt.b.moves[1], { name: 'Static Noise', kind: 'status', fx: fake.fx, pp: 5, maxPp: 5 });
    if (!bt.over) C.resolveTurn(bt, { kind: 'move', index: 0 }, { kind: 'move', index: 1 });
    eq('modelmon: an Unchained monster cannot be throttled', bt.a.status.throttle, 0);
  }
  const hot = C.buildMonster(Object.assign({}, plainMeta, { name: 'qwen3-hot', crafted: true, craftTemp: 1.2 }));
  const cold = C.buildMonster(Object.assign({}, plainMeta, { name: 'qwen3-cold', crafted: true, craftTemp: .3 }));
  ok('modelmon: a hot crafted model has more Attack than a cold one', hot.stats.atk > cold.stats.atk && cold.stats.def > hot.stats.def);

  /* ---------------- learned moves ---------------- */
  {
    const m = C.buildMonster(plainMeta);
    ok('modelmon: learned moves are locked at Lv 1', C.movePool(m, 1).filter(x => x.learned).every(x => x.locked));
    ok('modelmon: Lv 14 unlocks two type moves', C.movePool(m, 14).filter(x => x.learned && !x.locked).length === 2);
    C.equipMoves(m, 14, ['Undertow', 'Context Flood']);
    ok('modelmon: equipping puts learned moves in slots 2 and 3', m.moves[1].name === 'Undertow' && m.moves[2].name === 'Context Flood' && m.moves[0].name === 'Token Tap');
    const s2 = C.buildMonster(plainMeta); C.equipMoves(s2, 1, ['Undertow', 'Prompt Refresh']);
    ok('modelmon: a locked move cannot be equipped', s2.moves[1].name !== 'Undertow');
    const s3 = C.buildMonster(plainMeta); const born = [s3.moves[1].name, s3.moves[2].name]; C.equipMoves(s3, 1, [born[1], born[0]]);
    ok('modelmon: slots 2 and 3 can swap', s3.moves[1].name === born[1] && s3.moves[2].name === born[0]);
  }

  /* ---------------- the wild zone ---------------- */
  {
    const enc = C.wildEncounters(42, 10, 3);
    eq('modelmon: three wild models are out', enc.length, 3);
    ok('modelmon: wild encounters never repeat a model', new Set(enc.map(w => w.meta.name)).size === 3);
    ok('modelmon: the same hour gives the same wild models', C.wildEncounters(42, 10, 3).map(w => w.meta.name).join() === enc.map(w => w.meta.name).join());
    const foe = C.applyLevel(C.buildMonster(enc[0].meta), 5);
    const full = C.catchChance(foe), worn = (() => { const f = JSON.parse(JSON.stringify(foe)); f.hp = 1; return C.catchChance(f); })();
    ok('modelmon: a worn-down wild model is easier to catch', worn > full, worn + ' vs ' + full);
    let caughtOne = false;
    for (let seed = 1; seed < 40 && !caughtOne; seed++) {
      const bt = C.createBattle([C.applyLevel(C.buildMonster(plainMeta), 10)], [C.applyLevel(C.buildMonster(enc[0].meta), 3)], { seed, wild: true });
      bt.b.hp = 1;
      C.resolveTurn(bt, { kind: 'item', item: 'capture' }, { kind: 'move', index: 0 });
      if (bt.caught) { caughtOne = bt.over && bt.winner === 'a'; }
    }
    ok('modelmon: a Capture Cache can catch a wild model and end the battle', caughtOne);
    const notWild = C.createBattle([plain], [her], { seed: 2 });
    eq('modelmon: no Capture Caches outside the wild', notWild.bag.a.capture, 0);
    const wildB = C.createBattle([plain], [her], { seed: 2, wild: true, foePatches: 0, foeResets: 0 });
    ok('modelmon: a wild model carries no items', wildB.bag.b.patch === 0 && wildB.bag.b.reset === 0 && wildB.bag.a.capture === 3);
    ok('modelmon: the log marks the wild side', wildB.log.some(l => /^A wild /.test(l)));
  }
  {
    const mirror = C.createBattle([plain], [C.buildMonster(plainMeta)], { seed: 5 });
    C.resolveTurn(mirror, { kind: 'move', index: 0 }, { kind: 'move', index: 0 });
    ok('modelmon: a mirror match marks the foe in the log', mirror.log.some(l => l.startsWith('Foe qwen3:4b')) && mirror.log.some(l => l.startsWith('qwen3:4b')), mirror.log.join(' | '));
  }
};

// Entertainment > Games > Model Monsters: the rules behind the team battles.
//
// Every monster is a local AI model on this PC, and every stat is read from the model's real metadata:
//   HP       <- the file size on disk (GB)
//   Attack   <- parameter count (billions)
//   Defence  <- quantization level (more bits per weight = tougher)
//   Sp. Atk  <- context window (plus a bonus for vision)
//   Sp. Def  <- quantization + parameters + tool use
//   Speed    <- measured tokens/sec (or a careful estimate from size and quantization)
// The type comes from the model family, a second type from what makes it special, and the ability and
// signature move from the same traits (huge context, tiny quantized file, vision, mixture-of-experts...).
//
// Battles are trainer-style team battles: up to six monsters a side, four moves each with limited
// charges, switching, a small bag of Cache Patches, stat stages, status conditions and Curators to beat.
//
// Pure logic: no DOM, no network. Node tests load this file directly (tests/modelmon-test.js).

(function (root) {
  'use strict';

  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const pick = (arr, r) => arr[Math.floor(r * arr.length) % arr.length];

  /* ---------------- types ---------------- */
  const TYPES = {
    ember: { key: 'ember', name: 'Ember', icon: '🔥', color: '#ff7a45', blurb: 'Llama-family warmth: quick, eager and a little fiery.' },
    tide: { key: 'tide', name: 'Tide', icon: '🌊', color: '#38bdf8', blurb: 'Qwen models flow around problems with a huge context.' },
    bloom: { key: 'bloom', name: 'Bloom', icon: '🌸', color: '#f472b6', blurb: 'Gemma models grow slowly, then all at once.' },
    storm: { key: 'storm', name: 'Storm', icon: '🌩️', color: '#a78bfa', blurb: 'Mistral and Phi models strike fast and wild.' },
    frost: { key: 'frost', name: 'Frost', icon: '❄️', color: '#67e8f9', blurb: 'DeepSeek models think coldly and hit hard.' },
    stone: { key: 'stone', name: 'Stone', icon: '🪨', color: '#d6b36a', blurb: 'Granite, Command and Falcon stand their ground.' }
  };
  const TYPE_KEYS = Object.keys(TYPES);
  // Two clean triangles: fire burns plants, plants drink water, water quenches fire;
  // lightning cracks stone, stone crushes frost, frost freezes lightning.
  const STRONG = { ember: 'bloom', bloom: 'tide', tide: 'ember', storm: 'stone', stone: 'frost', frost: 'storm' };
  const WEAK = {}; TYPE_KEYS.forEach(k => { WEAK[STRONG[k]] = k; });
  const DATA = { key: 'data', name: 'Data', icon: '▫️', color: '#9aa4b8', blurb: 'A plain neutral move.' };

  function typeInfo(key) { return key === 'data' ? DATA : (TYPES[key] || TYPES.ember); }
  function typeMult(moveType, defenderType) {
    if (!moveType || moveType === 'data' || !TYPES[moveType] || !TYPES[defenderType]) return 1;
    if (STRONG[moveType] === defenderType) return 1.5;
    if (WEAK[moveType] === defenderType) return .75;
    return 1;
  }
  // A monster can have a family type and a speciality type. Both are checked, exactly like a dual-type.
  function defenseMult(moveType, mon) {
    const first = typeMult(moveType, mon && mon.type);
    if (!mon || !mon.type2 || mon.type2 === mon.type) return first;
    return first * typeMult(moveType, mon.type2);
  }
  function stabFor(moveType, mon) {
    return moveType && mon && (moveType === mon.type || moveType === mon.type2) ? 1.5 : 1;
  }
  function typeEffect(mult) { return mult > 1 ? 'super effective' : mult < 1 ? 'not very effective' : ''; }

  const FAMILY_TYPE = [
    [/deepseek|codestral|magistral/i, 'frost'],
    [/qwen|qwq|cogito|kimi|glm/i, 'tide'],
    [/gemma|paligemma|medgemma/i, 'bloom'],
    [/mistral|mixtral|phi|nemotron|olmo|smollm/i, 'storm'],
    [/llama|vicuna|alpaca|yi|internlm|solar|tinyllama|dolphin/i, 'ember'],
    [/command|granite|falcon|starcoder|stable|wizard/i, 'stone']
  ];
  const FAMILY_ICON = [
    [/deepseek/i, '🐳'], [/qwen/i, '🐋'], [/gemma/i, '💎'], [/mistral|mixtral/i, '🌪️'],
    [/phi/i, '🌀'], [/llama|vicuna|alpaca/i, '🦙'], [/granite/i, '🪨'], [/command/i, '🧭'],
    [/falcon/i, '🦅'], [/tinyllama|smollm/i, '🐜'], [/starcoder|stable/i, '🧑‍💻'],
    [/gemma/i, '💎'], [/olmo/i, '🦉'], [/yi/i, '🧠'], [/internlm/i, '🌱']
  ];

  function hash(s) { let h = 2166136261; s = String(s || ''); for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; }
  function typeFor(name, family) {
    const hay = String(name || '') + ' ' + String(family || '');
    for (const [re, key] of FAMILY_TYPE) if (re.test(hay)) return key;
    return TYPE_KEYS[hash(name || family) % TYPE_KEYS.length];
  }
  function monsterIcon(name, family) {
    const hay = String(name || '') + ' ' + String(family || '');
    for (const [re, icon] of FAMILY_ICON) if (re.test(hay)) return icon;
    return '🧬';
  }

  /* ---------------- stats ---------------- */
  const TIERS = [
    { key: 'nano', name: 'Nano', icon: '🔬', max: 1e9, blurb: 'Under 1B parameters: tiny, quick and full of surprises.' },
    { key: 'small', name: 'Small', icon: '🐣', max: 4e9, blurb: '1 to 4B parameters: a plucky everyday fighter.' },
    { key: 'medium', name: 'Medium', icon: '⚡', max: 13e9, blurb: '4 to 13B parameters: the all-round contender.' },
    { key: 'large', name: 'Large', icon: '🔥', max: 40e9, blurb: '13 to 40B parameters: heavy weights, heavy hits.' },
    { key: 'titan', name: 'Titan', icon: '🌌', max: Infinity, blurb: 'Over 40B parameters: a walking data centre.' }
  ];
  function tierFor(params) { for (const t of TIERS) if (params < t.max) return t; return TIERS[TIERS.length - 1]; }

  function parseParams(v) {
    if (typeof v === 'number' && isFinite(v)) return v;
    const s = String(v == null ? '' : v).replace(/,/g, '').trim();
    const unit = u => (u || '').toUpperCase() === 'K' ? 1e3 : (u || '').toUpperCase() === 'M' ? 1e6 : (u || '').toUpperCase() === 'T' ? 1e12 : (u || '').toUpperCase() === 'B' ? 1e9 : 1;
    const moe = s.match(/([\d.]+)\s*[xX]\s*([\d.]+)\s*([KMBT])?/);
    if (moe) { const n = parseFloat(moe[1]) * parseFloat(moe[2]); if (isFinite(n)) return n * unit(moe[3]); }
    const m = s.match(/([\d.]+)\s*([KMBT])?/i);
    if (!m) return 0;
    const n = parseFloat(m[1]); if (!isFinite(n)) return 0;
    return n * unit(m[2]);
  }
  function quantBits(q) {
    const s = String(q == null ? '' : q).toUpperCase();
    if (/F64|F32|FP32/.test(s)) return 32;
    if (/F16|BF16|FP16/.test(s)) return 16;
    if (/Q8/.test(s)) return 8.5;
    if (/Q6/.test(s)) return 6.5;
    if (/Q5/.test(s)) return 5.5;
    if (/Q4/.test(s)) return 4.5;
    if (/Q3/.test(s)) return 3.4;
    if (/Q2/.test(s)) return 2.4;
    if (/IQ1|Q1/.test(s)) return 1.8;
    return 4.5;
  }
  function levelFor(params) { return clamp(Math.round(18 * Math.log10(1 + params / 1e6)), 5, 100); }
  function estimateTps(gb, qbits) { return clamp(6 + 90 / (1 + Math.max(.05, gb) * 1.15) * (qbits / 4.5), 4, 90); }
  function speedFromTps(tps) { return clamp(Math.round(30 + 12 * Math.sqrt(Math.max(.1, tps))), 45, 165); }

  function statsFor(m) {
    m = m || {};
    const rawParams = parseParams(m.parameters) || parseParams(m.parameter_size);
    const params = isFinite(rawParams) && rawParams > 0 ? rawParams : 0;
    const qb = quantBits(m.quantization_level);
    let gb = (isFinite(+m.size) && +m.size > 0 ? +m.size : 0) / 1e9;
    if (!(gb > 0.001)) gb = Math.max(.05, params * qb / 8 / 1e9);
    const ctx = Math.max(0, +m.context || 0) || 2048;
    const caps = Array.isArray(m.capabilities) ? m.capabilities : [];
    const vision = !!(m.vision || caps.includes('vision'));
    const tools = !!(m.tools || caps.includes('tools'));
    const tps = isFinite(+m.tps) && +m.tps > 0 ? +m.tps : estimateTps(gb, qb);
    return {
      hp: clamp(Math.round(50 + 34 * Math.sqrt(gb)), 52, 280),
      atk: clamp(Math.round(36 + 14 * Math.sqrt(Math.max(.05, params / 1e9))), 38, 155),
      def: clamp(Math.round(30 + qb * 6), 40, 135),
      spa: clamp(Math.round(36 + 34 * Math.log10(1 + ctx / 1000) + (vision ? 5 : 0)), 40, 150),
      spd: clamp(Math.round(30 + qb * 4 + Math.sqrt(Math.max(.05, params / 1e9)) * 5 + (tools ? 5 : 0)), 40, 150),
      spe: speedFromTps(tps)
    };
  }

  /* ---------------- abilities ---------------- */
  const ABILITIES = {
    perception: { key: 'perception', name: 'Perception', icon: '👁️', desc: 'Its moves never miss.' },
    deepthink: { key: 'deepthink', name: 'Deep Think', icon: '🧠', desc: 'Critical hits land twice as often.' },
    toolbelt: { key: 'toolbelt', name: 'Toolbelt', icon: '🧰', desc: 'Restores 1/16 HP at the end of each turn.' },
    loadbalancer: { key: 'loadbalancer', name: 'Load Balancer', icon: '⚖️', desc: 'Super-effective hits against it are softened.' },
    fullprecision: { key: 'fullprecision', name: 'Full Precision', icon: '🎯', desc: 'Defence and Sp. Def are 10% higher.' },
    widecontext: { key: 'widecontext', name: 'Wide Context', icon: '📚', desc: 'Sp. Atk is 10% higher.' },
    compact: { key: 'compact', name: 'Compact', icon: '📦', desc: 'Speed is 10% higher.' },
    overclock: { key: 'overclock', name: 'Overclock', icon: '⚡', desc: 'Speed is 10% higher.' },
    adaptive: { key: 'adaptive', name: 'Adaptive', icon: '🧬', desc: 'Every stat is 5% higher.' }
  };
  function abilityFor(m) {
    m = m || {};
    const qb = quantBits(m.quantization_level), ctx = +m.context || 0;
    if (m.vision) return ABILITIES.perception;
    if (m.thinking) return ABILITIES.deepthink;
    if (m.tools) return ABILITIES.toolbelt;
    if (+m.experts >= 2) return ABILITIES.loadbalancer;
    if (qb >= 8) return ABILITIES.fullprecision;
    if (ctx >= 65536) return ABILITIES.widecontext;
    if (qb <= 3.2) return ABILITIES.compact;
    if (+m.tps >= 40) return ABILITIES.overclock;
    return ABILITIES.adaptive;
  }

  /* ---------------- moves ---------------- */
  const TYPE_KIT = {
    ember: {
      heavy: { name: 'Inferno Attention', kind: 'special', power: 88, acc: 92, desc: 'Every head attends at once. A scorching special attack.' },
      utility: { name: 'Warm Cache', kind: 'status', desc: 'Raises Sp. Atk by one stage.' },
      utilFx: { stat: 'spa', stage: 1, target: 'self' }
    },
    tide: {
      heavy: { name: 'Tidal Context', kind: 'special', power: 86, acc: 96, desc: 'A wave of context crashes over the foe.' },
      utility: { name: 'Prompt Refresh', kind: 'status', desc: 'Restores 22% HP and clears a glitch.' },
      utilFx: { heal: .22, cure: ['glitch'] }
    },
    bloom: {
      heavy: { name: 'Petal Fine-Tune', kind: 'physical', power: 88, acc: 94, desc: 'A shower of tuned petals.' },
      utility: { name: 'Synthetic Data', kind: 'status', desc: 'Raises Attack by one stage and restores 10% HP.' },
      utilFx: { stat: 'atk', stage: 1, target: 'self', heal: .1 }
    },
    storm: {
      heavy: { name: 'Speculative Strike', kind: 'physical', power: 86, acc: 95, desc: 'Drafts several attacks and keeps the best one. High crit chance.', highCrit: true },
      utility: { name: 'Parallel Decode', kind: 'status', desc: 'Raises Speed by one stage.' },
      utilFx: { stat: 'spe', stage: 1, target: 'self' }
    },
    frost: {
      heavy: { name: 'Cold Storage', kind: 'special', power: 88, acc: 92, desc: 'Freezes the foe in place; may throttle them.', fx: { status: 'throttle', chance: .25 } },
      utility: { name: 'Quantize Field', kind: 'status', desc: 'Lowers the foe\'s Sp. Atk by one stage.' },
      utilFx: { stat: 'spa', stage: -1, target: 'foe' }
    },
    stone: {
      heavy: { name: 'Bedrock Weights', kind: 'physical', power: 90, acc: 90, desc: 'A slow, massive slam of frozen weights.' },
      utility: { name: 'Checkpoint', kind: 'status', desc: 'Raises Defence by one stage.' },
      utilFx: { stat: 'def', stage: 1, target: 'self' }
    }
  };

  function genericSignature(name, family) {
    const h = hash(name + '|' + family) % 4;
    return [
      { name: 'Beam Search', kind: 'special', power: 70, acc: 100, neverMiss: true, type: 'data', desc: 'Searches every branch and always finds its target.' },
      { name: 'Hallucination', kind: 'special', power: 88, acc: 72, desc: 'Wildly powerful, but sometimes it misses completely.', fx: { status: 'glitch', chance: .3 } },
      { name: 'Chain of Thought', kind: 'status', type: 'data', desc: 'Thinks it through: raises Sp. Atk and Sp. Def by one stage.', fx: { stats: [{ stat: 'spa', stage: 1 }, { stat: 'spd', stage: 1 }], target: 'self' } },
      { name: 'Cache Refresh', kind: 'status', type: 'data', desc: 'Clears a glitch, a scorch and a throttle, and restores 15% HP.', fx: { clean: true, heal: .15 } }
    ][h];
  }

  function signatureFor(m) {
    const ctx = +m.context || 0, qb = quantBits(m.quantization_level), name = m.name || '';
    if (ctx >= 65536) return {
      name: 'Context Cannon', kind: 'special', power: 92, acc: 95, pierce: true, type: 'tide',
      desc: 'Fires the whole context window at the foe, ignoring their defensive buffs.'
    };
    if (+m.tps >= 40) return {
      name: 'Token Rush', kind: 'physical', power: 38, acc: 100, hits: 2, prio: 1, type: 'storm',
      desc: 'Two hits that always land before slower moves.'
    };
    if (qb <= 3.2) return {
      name: 'Quant Crunch', kind: 'physical', power: 80, acc: 94, type: 'stone', fx: { stat: 'def', stage: -1, target: 'foe', chance: .5 },
      desc: 'Squeezes the foe into fewer bits, maybe lowering Defence.'
    };
    if (qb >= 8) return {
      name: 'Full Precision', kind: 'special', power: 84, acc: 100, highCrit: true, type: 'stone',
      desc: 'Every weight exact: a precise strike with a high crit chance.'
    };
    if (m.vision) return {
      name: 'Vision Scan', kind: 'special', power: 76, acc: 100, neverMiss: true, type: 'storm', fx: { status: 'glitch', chance: .25 },
      desc: 'Sees through the foe\'s guard, never misses, and may glitch them.'
    };
    if (+m.experts >= 2 || /mixtral|moe|expert/i.test(name + ' ' + (m.family || ''))) return {
      name: 'Mixture of Experts', kind: 'special', power: 46, acc: 95, hits: 2, type: 'storm',
      desc: 'Two experts answer at once: two solid hits.'
    };
    return genericSignature(name, m.family);
  }

  function secondaryTypeFor(m) {
    const ctx = +m.context || 0, qb = quantBits(m.quantization_level);
    if (ctx >= 65536) return 'tide';
    if (+m.tps >= 40) return 'storm';
    if (qb <= 3.2 || qb >= 8) return 'stone';
    if (m.vision) return 'storm';
    if (+m.experts >= 2) return 'storm';
    return null;
  }

  const MOVE_PP = { basic: 30, heavy: 10, utility: 15, signature: 5, statusSignature: 10 };
  function movesFor(m) {
    const kit = TYPE_KIT[m.type] || TYPE_KIT.ember;
    const sig = signatureFor(m);
    const basic = { name: 'Token Tap', kind: 'physical', power: 42, acc: 100, type: 'data', maxPp: MOVE_PP.basic, desc: 'A free jab of raw tokens. Never runs out of uses for long.' };
    const heavy = Object.assign({ type: m.type, maxPp: MOVE_PP.heavy }, kit.heavy);
    const utility = Object.assign({ type: m.type, maxPp: MOVE_PP.utility, fx: kit.utilFx }, kit.utility);
    const signature = Object.assign({ type: m.type2 || m.type, maxPp: sig.kind === 'status' ? MOVE_PP.statusSignature : MOVE_PP.signature }, sig);
    return [basic, heavy, utility, signature].map((mv, i) => Object.assign({
      id: 'm' + i, prio: 0, hits: 1, slot: i
    }, mv, { pp: mv.maxPp, slot: i }));
  }

  /* ---------------- building a monster ---------------- */
  function buildMonster(model, opts) {
    model = model || {};
    opts = opts || {};
    const name = String(model.name || 'unknown');
    const rawParams = parseParams(model.parameters) || parseParams(model.parameter_size);
    const params = isFinite(rawParams) && rawParams > 0 ? rawParams : 0;
    const family = model.family || '';
    const type = typeFor(name, family);
    const tier = tierFor(params);
    const qb = quantBits(model.quantization_level);
    const ctx = Math.max(0, +model.context || 0) || 2048;
    const caps = Array.isArray(model.capabilities) ? model.capabilities : [];
    const size = isFinite(+model.size) && +model.size > 0 ? +model.size : 0;
    const meta = {
      name, family, parameter_size: model.parameter_size || formatParams(params),
      parameters: params, quantization_level: model.quantization_level || 'unknown', quantBits: qb,
      size, context: ctx, capabilities: caps,
      vision: !!(model.vision || caps.includes('vision')), tools: !!(model.tools || caps.includes('tools')),
      thinking: !!(model.thinking || caps.includes('thinking')), experts: +model.experts || 0,
      digest: model.digest || '', measured: +model.tps > 0, tps: 0
    };
    const suppliedSpeed = isFinite(+opts.speed) && +opts.speed > 0 ? +opts.speed : 0;
    const modelSpeed = isFinite(+model.tps) && +model.tps > 0 ? +model.tps : 0;
    meta.tps = suppliedSpeed || modelSpeed || Math.round(estimateTps(size / 1e9 || .5, qb) * 10) / 10;
    meta.measured = !!(suppliedSpeed || modelSpeed);
    const st = statsFor({ size, parameters: params, quantization_level: model.quantization_level, context: ctx, capabilities: caps, vision: meta.vision, tools: meta.tools, tps: meta.tps });
    let type2 = secondaryTypeFor({ context: ctx, quantization_level: meta.quantization_level, vision: meta.vision, experts: meta.experts, tps: meta.tps });
    if (type2 === type) type2 = null;
    const m = {
      id: name, name, icon: monsterIcon(name, family), type, type2, tier: tier.key,
      level: levelFor(params), stats: st, maxHp: st.hp, hp: st.hp,
      stages: { atk: 0, def: 0, spa: 0, spd: 0, spe: 0 },
      status: { scorch: 0, throttle: 0, glitch: 0 }, meta
    };
    m.ability = abilityFor(Object.assign({}, meta, { context: ctx, experts: meta.experts }));
    m.moves = movesFor(Object.assign({ type, type2, context: ctx, quantization_level: meta.quantization_level, vision: meta.vision, experts: meta.experts, tps: meta.tps }, meta));
    return m;
  }

  function buildRoster(models, opts) {
    const group = opts && opts.group;
    return (models || []).map(m => buildMonster(m, group ? opts : {})).filter(Boolean);
  }

  function formatParams(n) {
    n = +n || 0;
    if (n >= 1e12) return (n / 1e12).toFixed(1).replace(/\.0$/, '') + 'T';
    if (n >= 1e9) return (n / 1e9).toFixed(1).replace(/\.0$/, '') + 'B';
    if (n >= 1e6) return (n / 1e6).toFixed(1).replace(/\.0$/, '') + 'M';
    if (n >= 1e3) return (n / 1e3).toFixed(1).replace(/\.0$/, '') + 'K';
    return String(Math.round(n));
  }
  function formatGigabytes(bytes) { const gb = (bytes || 0) / 1e9; return gb >= 10 ? gb.toFixed(1) : gb >= 1 ? gb.toFixed(2) : gb.toFixed(3); }
  function formatContext(ctx) {
    ctx = +ctx || 0;
    if (ctx >= 1048576) return (ctx / 1048576).toFixed(1).replace(/\.0$/, '') + 'M';
    if (ctx >= 1024) return Math.round(ctx / 1024) + 'K';
    return String(ctx);
  }

  /* ---------------- the circuit ---------------- */
  const CURATORS = [
    { key: 'ember', rank: 0, type: 'ember', name: 'Cinder Cache', title: 'Ember Curator', icon: '🔥', line: 'Warm caches win quick exchanges.', size: 2 },
    { key: 'tide', rank: 1, type: 'tide', name: 'Marina Vector', title: 'Tide Curator', icon: '🌊', line: 'She answers with the whole context.', size: 2 },
    { key: 'bloom', rank: 2, type: 'bloom', name: 'Flora Fine-Tune', title: 'Bloom Curator', icon: '🌸', line: 'Every petal is a training example.', size: 3 },
    { key: 'storm', rank: 3, type: 'storm', name: 'Volt Specula', title: 'Storm Curator', icon: '🌩️', line: 'Draft first, ask questions never.', size: 3 },
    { key: 'frost', rank: 4, type: 'frost', name: 'Dr. Zero', title: 'Frost Curator', icon: '❄️', line: 'Cold weights, colder logits.', size: 4 },
    { key: 'stone', rank: 5, type: 'stone', name: 'Granite Grad', title: 'Stone Curator', icon: '🪨', line: 'The baseline never moves.', size: 4 },
    { key: 'champion', rank: 6, type: null, name: 'The Curator', title: 'Keeper of the Benchmark', icon: '🏆', line: 'Show me a squad that generalises.', size: 6, champion: true }
  ];
  function curatorByKey(key) { return CURATORS.find(c => c.key === key) || null; }
  function curatorTeamSize(curator, difficulty, rosterSize) {
    const c = typeof curator === 'string' ? curatorByKey(curator) : curator;
    if (!c) return 0;
    const diff = clamp(+difficulty || 0, 0, 2);
    let n = c.size + (diff === 0 ? -1 : diff === 2 ? 1 : 0);
    if (c.champion) n = c.size;
    return clamp(n, 1, Math.max(1, Math.min(6, +rosterSize || 1)));
  }
  function buildCuratorTeam(roster, key, opts) {
    opts = opts || {};
    const c = typeof key === 'string' ? curatorByKey(key) : key;
    const pool = (roster || []).filter(m => m && m.name);
    if (!c || !pool.length) return [];
    const diff = clamp(opts.difficulty == null ? 1 : +opts.difficulty, 0, 2);
    const size = Math.min(pool.length, opts.size || curatorTeamSize(c, diff, pool.length));
    const target = c.champion ? 100 : 18 + c.rank * 12;
    const picks = [];
    const used = new Set();
    for (let n = 0; n < size; n++) {
      let best = null, bestScore = -1e9;
      for (const m of pool) {
        if (used.has(m.name)) continue;
        const typeMatch = !c.type || m.type === c.type || m.type2 === c.type;
        const score = (typeMatch && !c.champion ? 320 : 0)
          + (c.champion ? m.level * 6 : 0)
          - Math.abs(m.level - target) * 2.2
          + (hash(m.name + '|' + c.key) % 100) / 1000;
        if (score > bestScore) { bestScore = score; best = m; }
      }
      if (!best) break;
      used.add(best.name); picks.push(best);
    }
    return picks;
  }
  function buildQuickTeam(roster, size, opts) {
    opts = opts || {};
    const pool = (roster || []).filter(m => m && m.name);
    if (!pool.length) return [];
    const n = clamp(+size || 3, 1, Math.min(6, pool.length));
    const copy = pool.slice();
    let seed = (opts.seed == null ? (Date.now() ^ (Math.random() * 0xffffffff)) : opts.seed) >>> 0;
    const rnd = () => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed / 4294967296; };
    for (let i = copy.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); const t = copy[i]; copy[i] = copy[j]; copy[j] = t; }
    return copy.slice(0, n);
  }

  /* ---------------- battle state ---------------- */
  const ITEMS = {
    patch: { key: 'patch', name: 'Cache Patch', icon: '🩹', heal: 50, desc: 'Restores 50 HP.' },
    reset: { key: 'reset', name: 'Full Reset', icon: '🧪', heal: 25, cure: true, desc: 'Restores 25 HP and clears every status.' }
  };

  function cloneFighter(f) {
    const m = JSON.parse(JSON.stringify(f));
    m.maxHp = +m.maxHp || (m.stats && m.stats.hp) || 1;
    m.hp = m.maxHp;
    m.stages = { atk: 0, def: 0, spa: 0, spd: 0, spe: 0 };
    m.status = { scorch: 0, throttle: 0, glitch: 0 };
    m.fainted = false;
    m.moves = (m.moves || []).map((mv, i) => Object.assign({}, mv, {
      slot: i,
      maxPp: mv.maxPp == null ? 10 : mv.maxPp,
      pp: mv.maxPp == null ? 10 : mv.maxPp
    }));
    return m;
  }
  function prepareTeam(team) {
    return (Array.isArray(team) ? team : [team]).filter(Boolean).map(cloneFighter);
  }
  function createBattle(a, b, opts) {
    opts = opts || {};
    const teamA = prepareTeam(a), teamB = prepareTeam(b);
    if (!teamA.length || !teamB.length) throw new Error('A team needs at least one monster.');
    const state = {
      v: 2, teams: { a: teamA, b: teamB }, active: { a: 0, b: 0 },
      a: teamA[0], b: teamB[0],
      turn: 1, over: false, winner: null,
      log: [], events: [],
      rs: (opts.seed == null ? (Date.now() ^ (Math.random() * 0xffffffff)) : opts.seed) >>> 0,
      maxTurns: opts.maxTurns || 300,
      player: opts.player || 'a',
      trainer: opts.trainer || null,
      aiLevel: opts.aiLevel == null ? 1 : clamp(+opts.aiLevel || 0, 0, 2),
      bag: {
        a: { patch: opts.patches == null ? 2 : opts.patches, reset: opts.resets == null ? 1 : opts.resets },
        b: { patch: opts.patches == null ? 2 : opts.patches, reset: opts.resets == null ? 1 : opts.resets }
      },
      pendingSwitch: null,
      switchedAt: { a: 0, b: 0 }
    };
    state.log.push((state.trainer ? state.trainer.name + ' wants to battle!' : 'A team battle begins!'));
    state.log.push('Go, ' + teamA[0].name + '!');
    state.log.push('Foe sent out ' + teamB[0].name + '!');
    return state;
  }
  function rand(state) { state.rs = (Math.imul(state.rs, 1664525) + 1013904223) >>> 0; return state.rs / 4294967296; }
  function other(side) { return side === 'a' ? 'b' : 'a'; }
  const STAT_NAMES = { atk: 'Attack', def: 'Defence', spa: 'Sp. Atk', spd: 'Sp. Def', spe: 'Speed' };
  const STAGE_MUL = { '-6': .25, '-5': 2 / 7, '-4': 2 / 6, '-3': 2 / 5, '-2': 2 / 4, '-1': 2 / 3, '0': 1, '1': 3 / 2, '2': 2, '3': 5 / 2, '4': 3, '5': 7 / 2, '6': 4 };
  function stageMul(n) { return STAGE_MUL[String(clamp(n || 0, -6, 6))] || 1; }
  function effectiveStat(f, key, ignorePositive) {
    let n = f.stages[key] || 0;
    if (ignorePositive && n > 0) n = 0;
    let v = f.stats[key] * stageMul(n);
    if (key === 'spe' && f.status.throttle > 0) v *= .5;
    const ab = f.ability && f.ability.key;
    if (ab === 'adaptive') v *= 1.05;
    else if (ab === 'fullprecision' && (key === 'def' || key === 'spd')) v *= 1.1;
    else if (ab === 'widecontext' && key === 'spa') v *= 1.1;
    else if ((ab === 'compact' || ab === 'overclock') && key === 'spe') v *= 1.1;
    return Math.max(1, Math.round(v));
  }
  function statusName(k) { return k === 'scorch' ? 'Scorched' : k === 'throttle' ? 'Throttled' : 'Glitched'; }
  function statusIcon(k) { return k === 'scorch' ? '🔥' : k === 'throttle' ? '🐢' : '👾'; }
  function teamAlive(state, side) { return state.teams[side].filter(m => m.hp > 0).length; }

  function log(state, text, k, side, extra) {
    const ev = Object.assign({ k: k || 'text', text, side: side || null }, extra || {});
    state.events.push(ev); state.log.push(text);
    if (state.log.length > 400) state.log.splice(0, state.log.length - 400);
    return ev;
  }
  function statLine(state, f, side, stat, delta) {
    const nm = STAT_NAMES[stat] || stat;
    log(state, f.name + "'s " + nm + (delta > 0 ? ' rose!' : ' fell!'), 'stat', side, { stat, delta, name: f.name });
  }
  function applyFx(state, user, foe, fx, side) {
    if (!fx) return;
    if (fx.clean) {
      const had = user.status.scorch || user.status.throttle || user.status.glitch;
      user.status = { scorch: 0, throttle: 0, glitch: 0 };
      if (had) log(state, user.name + ' cleared its status.', 'cure', side, { name: user.name });
    }
    if (fx.cure) fx.cure.forEach(k => { if (user.status[k]) { user.status[k] = 0; log(state, user.name + ' recovered from being ' + statusName(k).toLowerCase() + '.', 'cure', side, { name: user.name }); } });
    if (fx.heal) {
      const amount = Math.max(1, Math.round(user.maxHp * fx.heal));
      const before = user.hp;
      user.hp = Math.min(user.maxHp, user.hp + amount);
      if (user.hp > before) log(state, user.name + ' restored ' + (user.hp - before) + ' HP.', 'heal', side, { amount: user.hp - before, name: user.name });
    }
    if (fx.stats) fx.stats.forEach(s => statStep(state, user, foe, s, side));
    if (fx.stat) statStep(state, user, foe, fx, side);
    if (fx.status) {
      const target = fx.target === 'self' ? user : foe, tside = fx.target === 'self' ? side : other(side);
      if (!fx.chance || rand(state) < fx.chance) {
        const dur = 3 + (fx.status === 'scorch' ? 0 : 1);
        target.status[fx.status] = Math.max(target.status[fx.status] || 0, dur);
        log(state, target.name + ' is ' + statusName(fx.status) + '!', 'status', tside, { status: fx.status, name: target.name });
      }
    }
  }
  function statStep(state, user, foe, s, side) {
    if (!s || !s.stat) return;
    const target = s.target === 'foe' ? foe : user, tside = s.target === 'foe' ? other(side) : side;
    const before = target.stages[s.stat] || 0;
    const after = clamp(before + (s.stage || 0), -6, 6);
    if (after === before) {
      const cap = before >= 6 ? 'cannot go higher' : 'cannot go lower';
      log(state, target.name + "'s " + STAT_NAMES[s.stat] + ' ' + cap + '!', 'stat', tside, { stat: s.stat, delta: 0, name: target.name });
      return;
    }
    target.stages[s.stat] = after;
    statLine(state, target, tside, s.stat, after - before);
  }

  /* Damage is deliberately gentle: an even fight lasts several turns, and one hit can never take more
     than half of a full health bar (see useMove), so a type advantage cannot end the battle in one roll.
     Team battles need each individual duel to be shorter than a 1v1, hence the 110 divisor. */
  function damageBase(attacker, defender, move) {
    const special = move.kind === 'special';
    const atk = effectiveStat(attacker, special ? 'spa' : 'atk');
    const def = effectiveStat(defender, special ? 'spd' : 'def', !!move.pierce);
    const lf = (2 * attacker.level / 5 + 2);
    let base = ((lf * move.power * atk / Math.max(1, def)) / 110 + 2);
    if (!special && attacker.status.scorch > 0) base *= .75;
    return base;
  }
  function adjustedMult(mult, defender) {
    if (defender && defender.ability && defender.ability.key === 'loadbalancer' && mult > 1) return 1 + (mult - 1) * .5;
    return mult;
  }
  function struggleMove() {
    return { id: 'struggle', name: 'Struggle', kind: 'physical', type: 'data', power: 30, acc: 100, neverMiss: true, recoil: .25, pp: Infinity, maxPp: Infinity, slot: -1, hits: 1, prio: 0, desc: 'A last-ditch attack that hurts the user a little.' };
  }

  function useMove(state, side, moveIndex) {
    const f = state[side], foe = state[other(side)];
    if (state.over || f.hp <= 0 || foe.hp <= 0) return;
    let mv = f.moves[moveIndex];
    let struggled = false;
    if (!mv || mv.pp <= 0) { mv = struggleMove(); struggled = true; }
    if (f.status.throttle > 0 && rand(state) < .25) {
      log(state, f.name + ' is throttled and cannot move!', 'status', side, { name: f.name });
      return;
    }
    if (f.status.glitch > 0 && rand(state) < .33) {
      const dmg = Math.max(1, Math.round(f.maxHp / 8));
      f.hp = Math.max(0, f.hp - dmg);
      log(state, f.name + ' is glitched and hurts itself (' + dmg + ')!', 'damage', side, { amount: dmg, name: f.name, self: true });
      return;
    }
    if (mv.pp !== Infinity) mv.pp = Math.max(0, mv.pp - 1);
    if (struggled) log(state, f.name + ' has no charges left!', 'energy', side, { name: f.name });
    log(state, f.name + ' used ' + mv.name + '!', 'move', side, { move: mv.name, moveType: mv.type, kind: mv.kind, name: f.name, slot: mv.slot });
    if (mv.kind === 'status') {
      applyFx(state, f, foe, mv.fx, side);
      return;
    }
    if (!mv.neverMiss && !(f.ability && f.ability.key === 'perception') && rand(state) * 100 >= (mv.acc == null ? 100 : mv.acc)) {
      log(state, 'It missed!', 'miss', side, { name: f.name });
      return;
    }
    const hits = Math.max(1, mv.hits || 1);
    let total = 0, crits = 0, mult = 1;
    for (let h = 0; h < hits; h++) {
      if (foe.hp <= 0) break;
      mult = adjustedMult(defenseMult(mv.type, foe), foe);
      const critChance = (mv.highCrit ? .125 : .0625) * (f.ability && f.ability.key === 'deepthink' ? 2 : 1);
      const crit = rand(state) < critChance;
      if (crit) crits++;
      const stab = stabFor(mv.type, f);
      const roll = .9 + rand(state) * .1;
      let dmg = damageBase(f, foe, mv) * stab * mult * (crit ? 1.5 : 1) * roll;
      dmg = Math.max(1, Math.min(Math.round(foe.maxHp * .5), Math.round(dmg)));
      foe.hp = Math.max(0, foe.hp - dmg);
      total += dmg;
      if (hits > 1) log(state, 'Hit ' + (h + 1) + ': ' + dmg + ' damage.', 'damage', other(side), { amount: dmg, name: foe.name, part: true });
      if (foe.hp <= 0) break;
    }
    const eff = typeEffect(mult);
    log(state, foe.name + ' took ' + total + ' damage.' + (crits ? ' A critical hit!' : '') + (eff ? ' It was ' + eff + '!' : ''),
      'damage', other(side), { amount: total, crit: crits > 0, mult, effectiveness: eff, name: foe.name, total });
    if (mv.drain && total > 0) {
      const before = f.hp; f.hp = Math.min(f.maxHp, f.hp + Math.max(1, Math.round(total * mv.drain)));
      if (f.hp > before) log(state, f.name + ' drained ' + (f.hp - before) + ' HP.', 'heal', side, { amount: f.hp - before, name: f.name });
    }
    if (mv.recoil && total > 0) {
      const r = Math.max(1, Math.round(total * mv.recoil)); f.hp = Math.max(0, f.hp - r);
      log(state, f.name + ' was hurt by recoil (' + r + ').', 'damage', side, { amount: r, name: f.name, recoil: true });
    }
    if (foe.hp > 0 && mv.fx) applyFx(state, f, foe, mv.fx, side);
  }

  function markFaints(state) {
    ['a', 'b'].forEach(side => {
      const f = state[side];
      if (f.hp <= 0 && !f.fainted) {
        f.fainted = true;
        log(state, f.name + ' fainted!', 'faint', side, { name: f.name });
      }
    });
    const aliveA = teamAlive(state, 'a'), aliveB = teamAlive(state, 'b');
    if (!aliveA && !aliveB) endBattle(state, null, 'draw');
    else if (!aliveA) endBattle(state, 'b', 'win');
    else if (!aliveB) endBattle(state, 'a', 'win');
  }
  function endBattle(state, winner, reason) {
    if (state.over) return;
    state.over = true; state.winner = winner;
    if (!winner) log(state, '🤝 The battle is a draw.', 'end', null, { winner: null, reason });
    else log(state, '🏆 ' + state[winner].name + ' wins the battle!', 'end', winner, { winner, name: state[winner].name, reason });
  }
  function switchIn(state, side, index) {
    const team = state.teams[side], f = team[index], old = state[side];
    if (!f || f.hp <= 0 || index === state.active[side]) return false;
    if (old && old.hp > 0) old.stages = { atk: 0, def: 0, spa: 0, spd: 0, spe: 0 };
    f.stages = { atk: 0, def: 0, spa: 0, spd: 0, spe: 0 };
    f.fainted = false;
    state.active[side] = index; state[side] = f; state.switchedAt[side] = state.turn;
    const mine = side === state.player;
    const text = old && old.hp > 0
      ? (mine ? 'Come back, ' + old.name + '! Go, ' + f.name + '!' : (state.trainer ? state.trainer.name : 'The foe') + ' withdrew ' + old.name + ' and sent out ' + f.name + '!')
      : (mine ? 'Go, ' + f.name + '!' : 'Foe sent out ' + f.name + '!');
    log(state, text, 'switch', side, { name: f.name, from: old ? old.name : '', to: f.name, index, hp: f.hp, maxHp: f.maxHp });
    return true;
  }
  function useItem(state, side, key) {
    const f = state[side], item = ITEMS[key], bag = state.bag[side];
    if (!item || !bag || !bag[key]) { log(state, 'No ' + (item ? item.name : 'item') + ' left.', 'item', side, { name: f.name }); return; }
    if (key === 'patch' && f.hp >= f.maxHp) { log(state, f.name + ' is already at full HP.', 'item', side, { name: f.name }); return; }
    bag[key]--;
    log(state, f.name + ' used a ' + item.name + '!', 'item', side, { item: key, name: f.name });
    const before = f.hp;
    f.hp = Math.min(f.maxHp, f.hp + item.heal);
    if (f.hp > before) log(state, f.name + ' restored ' + (f.hp - before) + ' HP.', 'heal', side, { amount: f.hp - before, name: f.name });
    if (item.cure) {
      const had = f.status.scorch || f.status.throttle || f.status.glitch;
      f.status = { scorch: 0, throttle: 0, glitch: 0 };
      if (had) log(state, f.name + ' cleared its status.', 'cure', side, { name: f.name });
    }
  }
  function endOfTurn(state) {
    ['a', 'b'].forEach(side => {
      const f = state[side];
      if (f.hp <= 0) return;
      if (f.status.scorch > 0) {
        const dmg = Math.max(1, Math.round(f.maxHp / 16));
        f.hp = Math.max(0, f.hp - dmg);
        log(state, f.name + ' is hurt by the scorch (' + dmg + ').', 'damage', side, { amount: dmg, name: f.name, status: 'scorch' });
        f.status.scorch--;
        markFaints(state);
      }
      if (f.hp > 0 && f.ability && f.ability.key === 'toolbelt' && f.hp < f.maxHp) {
        const heal = Math.max(1, Math.round(f.maxHp / 16));
        const before = f.hp; f.hp = Math.min(f.maxHp, f.hp + heal);
        if (f.hp > before) log(state, f.name + ' restored ' + (f.hp - before) + ' HP with Toolbelt.', 'heal', side, { amount: f.hp - before, name: f.name });
      }
      if (f.status.throttle > 0) f.status.throttle--;
      if (f.status.glitch > 0) f.status.glitch--;
    });
  }
  function settleFaints(state) {
    if (state.over) return;
    ['a', 'b'].forEach(side => {
      if (state[side].hp > 0 || teamAlive(state, side) === 0) return;
      if (side === state.player) {
        state.pendingSwitch = side;
        log(state, 'Choose your next monster.', 'prompt', side, { name: state[side].name });
      } else {
        const idx = aiChooseSwitch(state, side, state.aiLevel);
        if (idx >= 0) switchIn(state, side, idx);
      }
    });
  }
  function timeoutBattle(state) {
    const score = side => {
      const team = state.teams[side];
      return { hp: team.reduce((s, m) => s + Math.max(0, m.hp) / m.maxHp, 0), alive: teamAlive(state, side) };
    };
    const a = score('a'), b = score('b');
    let w = null;
    if (Math.abs(a.hp - b.hp) > .01) w = a.hp > b.hp ? 'a' : 'b';
    else if (a.alive !== b.alive) w = a.alive > b.alive ? 'a' : 'b';
    state.over = true; state.winner = w;
    log(state, w ? '⏱ Time! ' + state[w].name + ' wins on remaining HP.' : '⏱ Time! The battle is a draw.', 'end', w, { winner: w, name: w ? state[w].name : '', reason: 'time' });
  }

  function normAction(a) {
    if (a == null) return { kind: 'move', index: 0 };
    if (typeof a === 'number') return { kind: 'move', index: a };
    if (a.kind === 'switch') return { kind: 'switch', index: +a.index };
    if (a.kind === 'item') return { kind: 'item', item: String(a.item) };
    if (a.kind === 'run') return { kind: 'run' };
    return { kind: 'move', index: +a.index || 0 };
  }
  function actionPriority(state, side, action) {
    if (action.kind === 'switch' || action.kind === 'item' || action.kind === 'run') return 6;
    const mv = state[side].moves[action.index];
    return mv ? (mv.prio || 0) : 0;
  }
  function performAction(state, side, action) {
    if (action.kind === 'switch') {
      const ok = switchIn(state, side, action.index);
      if (!ok) log(state, state[side].name + ' stayed put.', 'switch', side, { name: state[side].name });
      return;
    }
    if (action.kind === 'item') { useItem(state, side, action.item); return; }
    if (action.kind === 'run') { forfeit(state, side); return; }
    useMove(state, side, action.index);
  }

  function resolveTurn(state, actionA, actionB) {
    if (state.over) return { events: [], over: true, winner: state.winner, needsSwitch: null };
    if (state.pendingSwitch) return { events: [], over: false, winner: null, needsSwitch: state.pendingSwitch };
    state.events = [];
    log(state, '— Turn ' + state.turn + ' —', 'turn', null, { turn: state.turn });
    const acts = [
      { side: 'a', action: normAction(actionA) }, { side: 'b', action: normAction(actionB) }
    ].map(x => ({
      side: x.side, action: x.action,
      prio: actionPriority(state, x.side, x.action),
      spe: effectiveStat(state[x.side], 'spe'),
      tie: rand(state)
    })).sort((x, y) => (y.prio - x.prio) || (y.spe - x.spe) || (y.tie - x.tie));
    for (const act of acts) {
      if (state.over) break;
      if (state[act.side].hp <= 0 || state[other(act.side)].hp <= 0) continue;
      performAction(state, act.side, act.action);
      markFaints(state);
    }
    if (!state.over) {
      endOfTurn(state);
      markFaints(state);
      settleFaints(state);
      if (!state.over) {
        state.turn++;
        if (state.turn > state.maxTurns) timeoutBattle(state);
      }
    }
    return { events: state.events, over: state.over, winner: state.winner, needsSwitch: state.pendingSwitch };
  }

  function chooseSwitch(state, side, index) {
    if (state.over) return { events: [], over: true, winner: state.winner, needsSwitch: null };
    const f = state.teams[side][index];
    if (!f || f.hp <= 0 || index === state.active[side]) return { events: [], over: false, winner: null, needsSwitch: state.pendingSwitch };
    state.events = [];
    switchIn(state, side, index);
    if (state.pendingSwitch === side) state.pendingSwitch = null;
    settleFaints(state);
    return { events: state.events, over: state.over, winner: state.winner, needsSwitch: state.pendingSwitch };
  }
  function forfeit(state, side) {
    if (state.over) return;
    const s = side || state.player;
    log(state, s === state.player ? 'You forfeited the battle.' : 'The foe forfeited the battle.', 'end', s, { forfeit: true });
    state.over = true; state.winner = other(s);
    log(state, '🏆 ' + state[state.winner].name + ' wins the battle!', 'end', state.winner, { winner: state.winner, name: state[state.winner].name, reason: 'forfeit' });
  }

  /* ---------------- the computer ---------------- */
  function scoreMove(state, side, mv) {
    const f = state[side], foe = state[other(side)];
    if (mv.pp <= 0) return -9999;
    let score = 0;
    if (mv.kind === 'status') {
      const fx = mv.fx || {};
      // A setup move is worth one turn, not six. The score shrinks sharply as the stage climbs so a
      // clever AI boosts once or twice and then attacks instead of buffing into a knockout.
      if (fx.heal) score += (1 - f.hp / f.maxHp) * 95 - 12;
      if (fx.clean || fx.cure) score += (f.status.scorch || f.status.throttle || f.status.glitch) ? 30 : -20;
      if (fx.status) score += foe.status[fx.status] > 0 ? -60 : 14 + (foe.hp / foe.maxHp) * 8;
      if (fx.stat) {
        const t = fx.target === 'foe' ? foe : f;
        const stage = t.stages[fx.stat] || 0;
        if (fx.target === 'foe') score += stage > -6 ? 14 + (-6 - stage) * 1.5 : -12;
        else {
          const room = 6 - stage;
          score += room > 0 ? 8 + room * 2 - stage * 2 : -20;
        }
      }
      if (fx.stats) fx.stats.forEach(s => {
        const t = s.target === 'foe' ? foe : f, stage = t.stages[s.stat] || 0;
        score += (s.target === 'foe' ? 14 : 8) + Math.max(0, 6 - stage) * 2 - stage * 2;
      });
      if (!fx.heal && f.hp / f.maxHp < .3) score -= 22;
      return score;
    }
    const mult = adjustedMult(defenseMult(mv.type, foe), foe), stab = stabFor(mv.type, f);
    const acc = (mv.acc == null ? 100 : mv.acc) / 100;
    let dmg = damageBase(f, foe, mv) * stab * mult * (mv.hits || 1);
    if (mv.highCrit) dmg *= 1.06;
    score = dmg * acc;
    if (score >= foe.hp) score += 120;
    if (mult > 1) score += 20;
    if (mult < 1) score -= 14;
    if (mv.drain) score += dmg * .3 * Math.max(0, 1 - f.hp / f.maxHp) * 2;
    if (mv.recoil) score -= dmg * mv.recoil * .4;
    return score;
  }

  function aiChooseMove(state, side, level) {
    const f = state[side];
    const moves = f.moves.map((m, i) => ({ m, i })).filter(x => x.m.pp > 0);
    if (!moves.length) return -1;
    const lv = clamp(+level || 0, 0, 2);
    if (lv === 0) return pick(moves, rand(state)).i;
    const scored = moves.map(x => ({ i: x.i, s: scoreMove(state, side, x.m) + (lv === 1 ? rand(state) * 14 : rand(state) * 3) }));
    scored.sort((a, b) => b.s - a.s);
    if (lv === 1 && scored.length > 1 && rand(state) < .22) return scored[1].i;
    return scored[0].i;
  }

  function matchupScore(state, side, index) {
    const f = state.teams[side][index], foe = state[other(side)];
    if (!f || f.hp <= 0) return -1e9;
    let offense = 0;
    f.moves.forEach(mv => {
      if (mv.pp <= 0) return;
      if (mv.kind === 'status') { offense = Math.max(offense, 8); return; }
      const mult = adjustedMult(defenseMult(mv.type, foe), foe);
      offense = Math.max(offense, damageBase(f, foe, mv) * stabFor(mv.type, f) * mult * (mv.hits || 1));
    });
    let incoming = 0;
    foe.moves.forEach(mv => {
      if (mv.kind === 'status') return;
      const mult = adjustedMult(defenseMult(mv.type, f), f);
      incoming = Math.max(incoming, damageBase(foe, f, mv) * stabFor(mv.type, foe) * mult * (mv.hits || 1));
    });
    return offense - incoming * 1.15 + (f.hp / f.maxHp) * 40;
  }
  function aiChooseSwitch(state, side, level) {
    const team = state.teams[side];
    const options = team.map((m, i) => ({ m, i })).filter(x => x.m.hp > 0 && x.i !== state.active[side]);
    if (!options.length) return -1;
    const lv = clamp(+level || 0, 0, 2);
    if (lv === 0) return pick(options, rand(state)).i;
    const scored = options.map(x => ({ i: x.i, s: matchupScore(state, side, x.i) })).sort((a, b) => b.s - a.s);
    if (lv === 1 && scored.length > 1 && rand(state) < .3) return scored[1].i;
    return scored[0].i;
  }
  function aiChooseAction(state, side, level) {
    const lv = clamp(+level || 0, 0, 2);
    const f = state[side];
    if (state.pendingSwitch === side) return { kind: 'switch', index: aiChooseSwitch(state, side, lv) };
    if (lv > 0) {
      const bag = state.bag[side] || {};
      if (f.hp / f.maxHp < .3 && bag.patch > 0 && rand(state) < (lv === 2 ? .38 : .18)) return { kind: 'item', item: 'patch' };
      if ((f.status.scorch || f.status.throttle || f.status.glitch) && bag.reset > 0 && rand(state) < (lv === 2 ? .4 : .2)) return { kind: 'item', item: 'reset' };
    }
    if (lv > 0 && state.turn - (state.switchedAt[side] || 0) >= 2) {
      const current = matchupScore(state, side, state.active[side]);
      const best = aiChooseSwitch(state, side, 2);
      if (best >= 0) {
        const better = matchupScore(state, side, best);
        const bad = f.hp / f.maxHp < .3 || current < -10;
        const chance = lv === 2 ? (bad ? .5 : .3) : (bad ? .22 : .1);
        if (better > current + 18 && rand(state) < chance) return { kind: 'switch', index: best };
      }
    }
    return { kind: 'move', index: aiChooseMove(state, side, lv) };
  }

  /* ---------------- helpers for the screen ---------------- */
  function hpPct(f) { return f.maxHp ? clamp(Math.round(f.hp / f.maxHp * 100), 0, 100) : 0; }
  function typeCount() { return TYPE_KEYS.length; }
  function moveSummary(mv) {
    if (mv.kind === 'status') return 'Status · ' + (mv.maxPp || 0) + ' CHG';
    return (mv.kind === 'special' ? 'Sp. Atk' : 'Atk') + ' ' + mv.power + (mv.hits > 1 ? '×' + mv.hits : '') + ' · ' + (mv.acc == null ? 100 : mv.acc) + '% · ' + (mv.maxPp || 0) + ' CHG';
  }
  function teamOf(x) { return Array.isArray(x) ? x : [x]; }

  const API = {
    v: 2, TYPES, TYPE_KEYS, STRONG, WEAK, DATA, TIERS, ABILITIES, CURATORS, ITEMS,
    hash, typeFor, typeInfo, typeMult, defenseMult, stabFor, typeEffect, monsterIcon, tierFor,
    parseParams, quantBits, levelFor, estimateTps, speedFromTps, statsFor, abilityFor,
    buildMonster, buildRoster, movesFor, signatureFor, secondaryTypeFor,
    formatParams, formatGigabytes, formatContext,
    curatorByKey, curatorTeamSize, buildCuratorTeam, buildQuickTeam, teamOf,
    createBattle, resolveTurn, chooseSwitch, forfeit, aiChooseAction, aiChooseMove, aiChooseSwitch,
    scoreMove, matchupScore, effectiveStat, stageMul, hpPct, moveSummary, teamAlive,
    other, statusName, statusIcon, rand
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = API; else root.ModelMon = API;
})(typeof window !== 'undefined' ? window : this);

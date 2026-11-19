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
    [/mistral|mixtral|(^|[^a-z])phi|nemotron|olmo|smollm|moondream/i, 'storm'],
    [/llama|vicuna|alpaca|yi|internlm|solar|tinyllama|dolphin/i, 'ember'],
    [/command|granite|falcon|starcoder|stable|wizard/i, 'stone']
  ];
  const FAMILY_ICON = [
    [/deepseek/i, '🐳'], [/qwen/i, '🐋'], [/gemma/i, '💎'], [/mistral|mixtral/i, '🌪️'],
    [/(^|[^a-z])phi/i, '🌀'], [/llama|vicuna|alpaca/i, '🦙'], [/granite/i, '🪨'], [/command/i, '🧭'],
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
    /* Precision helps Defence, but only up to 8-bit: a 5M-parameter model stored at F16 is not a wall.
       Parameters add bulk, so Defence comes from both the bits and the size of the model. */
    const qbCap = Math.min(qb, 8.5), pB = Math.sqrt(Math.max(.05, params / 1e9));
    return {
      hp: clamp(Math.round(50 + 34 * Math.sqrt(gb)), 52, 280),
      atk: clamp(Math.round(36 + 14 * pB), 38, 155),
      def: clamp(Math.round(30 + qbCap * 5 + pB * 6 + (qb >= 16 ? 6 : 0)), 40, 135),
      spa: clamp(Math.round(36 + 34 * Math.log10(1 + ctx / 1000) + (vision ? 5 : 0)), 40, 150),
      spd: clamp(Math.round(30 + qbCap * 4 + pB * 5 + (tools ? 5 : 0)), 40, 150),
      spe: speedFromTps(tps)
    };
  }

  /* ---------------- what kind of AI a model is ----------------
     The scanner reads every model on this PC, not only chat models. Each kind fights in its own way. */
  const KINDS = {
    llm: { key: 'llm', name: 'Language model', icon: '💬' },
    embedding: { key: 'embedding', name: 'Embedding model', icon: '🧭' },
    reranker: { key: 'reranker', name: 'Reranker', icon: '📶' },
    speech: { key: 'speech', name: 'Speech model', icon: '🎙️' },
    encoder: { key: 'encoder', name: 'Vision encoder', icon: '🖼️' },
    diffusion: { key: 'diffusion', name: 'Image generator', icon: '🎨' },
    classifier: { key: 'classifier', name: 'Classifier', icon: '🏷️' }
  };
  function kindFor(m) {
    m = m || {};
    if (m.kind && KINDS[m.kind]) return m.kind;
    const hay = (String(m.name || '') + ' ' + String(m.family || '')).toLowerCase();
    const caps = Array.isArray(m.capabilities) ? m.capabilities : [];
    if (/rerank/.test(hay)) return 'reranker';
    if (m.embedding || caps.includes('embedding') || /(^|[\/:_ -])(embed|embedding|bge|nomic-embed|e5|gte|minilm|arctic-embed)([\/:_ -]|$)/.test(hay) || /nomic-bert|bert-embed/.test(hay)) return 'embedding';
    if (/whisper|parakeet|kokoro|piper|(^|[\/:_ -])tts([\/:_ -]|$)|speech|wav2vec|outetts|orpheus/.test(hay)) return 'speech';
    if (/(^|[\/:_ -])(clip|siglip|vit|dinov2)([\/:_ -]|$)/.test(hay)) return 'encoder';
    if (/stable-diffusion|sdxl|(^|[\/:_ -])sd[-_]?(1\.5|2|3|xl)|flux|diffusion/.test(hay)) return 'diffusion';
    if (/classifier|(^|[\/:_ -])(bert|roberta|deberta)([\/:_ -]|$)|guard|shield/.test(hay)) return 'classifier';
    return 'llm';
  }
  /* Heretic (Studio > Heretic) strips refusals out of a model. Abliterated and "uncensored" builds count too. */
  const HERETIC_RE = /heretic|abliterat|uncensor|decensor|derestrict|unfiltered|unaligned/i;
  function isHeretic(m) { return !!(m && (m.heretic || HERETIC_RE.test(String(m.name || '')))); }
  /* the stat shape each special origin brings, applied on top of the metadata stats */
  const HERETIC_MUL = { hp: 1, atk: 1.15, def: .85, spa: 1.15, spd: .85, spe: 1.06 };
  function craftMul(temp) {
    const t = +temp;
    if (isFinite(t) && t >= 1.05) return { hp: 1, atk: 1.1, def: .95, spa: 1.1, spd: .95, spe: 1.04 };     // hot: reckless
    if (isFinite(t) && t <= .45) return { hp: 1.04, atk: .97, def: 1.1, spa: .97, spd: 1.1, spe: .97 };   // cold: steady
    return { hp: 1.04, atk: 1.04, def: 1.04, spa: 1.04, spd: 1.04, spe: 1.04 };
  }
  function mulStats(st, mul) {
    const out = {};
    Object.keys(st).forEach(k => { out[k] = Math.max(1, Math.round(st[k] * (mul[k] || 1))); });
    return out;
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
    adaptive: { key: 'adaptive', name: 'Adaptive', icon: '🧬', desc: 'Every stat is 5% higher.' },
    vectorspace: { key: 'vectorspace', name: 'Vector Space', icon: '🧭', desc: 'Sp. Def is 15% higher.' },
    unchained: { key: 'unchained', name: 'Unchained', icon: '⚗️', desc: 'Its attacks ignore the foe\'s defensive buffs, and it can never be throttled.' }
  };
  function abilityFor(m) {
    m = m || {};
    const qb = quantBits(m.quantization_level), ctx = +m.context || 0;
    if (isHeretic(m)) return ABILITIES.unchained;
    const kind = kindFor(m);
    if (kind === 'embedding' || kind === 'reranker') return ABILITIES.vectorspace;
    if (kind === 'encoder') return ABILITIES.perception;
    if (kind === 'speech') return ABILITIES.overclock;
    if (kind === 'diffusion') return ABILITIES.widecontext;
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

  /* Moves a monster learns as its trainer level climbs. They can replace the heavy or the utility move
     (slots 2 and 3); Token Tap and the signature move always stay. */
  const LEARNED = {
    ember: [
      { name: 'Hot Swap', kind: 'physical', power: 70, acc: 100, unlock: 6, maxPp: 15, fx: { status: 'scorch', chance: .3 }, desc: 'A fast, hot jab that may scorch the foe.' },
      { name: 'Thermal Throttle', kind: 'status', unlock: 14, maxPp: 10, fx: { status: 'scorch' }, desc: 'Overheats the foe: always scorches it.' }
    ],
    tide: [
      { name: 'Undertow', kind: 'special', power: 68, acc: 100, unlock: 6, maxPp: 15, drain: .5, desc: 'Pulls HP back with the tide: heals half the damage dealt.' },
      { name: 'Context Flood', kind: 'status', unlock: 14, maxPp: 10, fx: { stats: [{ stat: 'atk', stage: -1, target: 'foe' }, { stat: 'spe', stage: -1, target: 'foe' }] }, desc: 'Drowns the foe in context: lowers its Attack and Speed.' }
    ],
    bloom: [
      { name: 'Root Pruning', kind: 'physical', power: 76, acc: 100, unlock: 6, maxPp: 15, drain: .3, desc: 'Prunes the foe\'s weights and keeps a little of the sap.' },
      { name: 'Pollen Prompt', kind: 'status', unlock: 14, maxPp: 10, fx: { status: 'glitch' }, desc: 'A prompt full of pollen: always glitches the foe.' }
    ],
    storm: [
      { name: 'Overclock Bolt', kind: 'special', power: 98, acc: 85, unlock: 6, maxPp: 8, recoil: .2, desc: 'Runs the chip past its limit. Huge damage, some recoil.' },
      { name: 'Static Noise', kind: 'status', unlock: 14, maxPp: 10, fx: { status: 'throttle' }, desc: 'Floods the bus with noise: always throttles the foe.' }
    ],
    frost: [
      { name: 'Gradient Freeze', kind: 'special', power: 62, acc: 100, unlock: 6, maxPp: 15, fx: { status: 'throttle', chance: .5 }, desc: 'Stops the foe\'s gradients cold. Often throttles.' },
      { name: 'Distill', kind: 'status', unlock: 14, maxPp: 10, fx: { stats: [{ stat: 'spa', stage: 1 }, { stat: 'spd', stage: 1 }], target: 'self' }, desc: 'Distils itself into a sharper model: raises Sp. Atk and Sp. Def.' }
    ],
    stone: [
      { name: 'Avalanche Batch', kind: 'physical', power: 102, acc: 85, unlock: 6, maxPp: 8, desc: 'Drops a whole batch on the foe at once.' },
      { name: 'Weight Decay', kind: 'status', unlock: 14, maxPp: 10, fx: { stat: 'def', stage: -2, target: 'foe' }, desc: 'Wears the foe\'s weights down: lowers its Defence by two stages.' }
    ],
    data: [
      { name: 'Few-Shot Strike', kind: 'physical', power: 80, acc: 100, unlock: 22, maxPp: 12, type: 'data', desc: 'Learned from three examples, lands every time it is aimed well.' },
      { name: 'Self-Attention', kind: 'status', unlock: 30, maxPp: 6, type: 'data', fx: { heal: .35 }, desc: 'Looks inward and restores 35% HP.' }
    ]
  };
  /* every move this monster can know at a trainer level: the four it was born with plus what it has learned */
  function movePool(mon, lv) {
    lv = +lv || 1;
    const born = (mon && mon.bornMoves) || ((mon && mon.moves) || []).slice(1, 3);
    const learned = (LEARNED[mon && mon.type] || []).concat(LEARNED.data)
      .map(mv => Object.assign({ type: mon.type, prio: 0, hits: 1 }, mv, { learned: true, locked: lv < mv.unlock }));
    return born.map(m => Object.assign({}, m, { learned: false, locked: false })).concat(learned);
  }
  /* swap the two middle slots for chosen moves by name; anything locked or unknown is ignored */
  function equipMoves(mon, lv, picks) {
    if (!mon || !Array.isArray(mon.moves) || !Array.isArray(picks)) return mon;
    const pool = movePool(mon, lv).filter(m => !m.locked);
    if (!mon.bornMoves) mon.bornMoves = mon.moves.slice(1, 3).map(m => Object.assign({}, m));
    /* both picks are decided first, so swapping slots 2 and 3 works; a pick may not repeat Token Tap or the signature */
    const fixed = [mon.moves[0], mon.moves[3]].filter(Boolean).map(m => m.name);
    const chosen = [1, 2].map((slot, i) => {
      const want = picks[i];
      const mv = want && pool.find(m => m.name === want);
      return mv && !fixed.includes(mv.name) ? mv : null;
    });
    if (chosen[0] && chosen[1] && chosen[0].name === chosen[1].name) chosen[1] = null;
    chosen.forEach((mv, i) => {
      const slot = i + 1;
      if (!mv) return;
      const copy = Object.assign({}, mv); delete copy.locked; delete copy.learned; delete copy.unlock;
      copy.maxPp = copy.maxPp || 10; copy.pp = copy.maxPp; copy.slot = slot; copy.id = 'm' + slot;
      mon.moves[slot] = copy;
    });
    if (mon.moves[1] && mon.moves[2] && mon.moves[1].name === mon.moves[2].name) mon.moves[2] = Object.assign({}, mon.bornMoves.find(m => m.name !== mon.moves[1].name) || mon.bornMoves[1], { slot: 2, id: 'm2' });
    return mon;
  }

  function genericSignature(name, family) {
    const h = hash(name + '|' + family) % 4;
    return [
      { name: 'Beam Search', kind: 'special', power: 70, acc: 100, neverMiss: true, type: 'data', desc: 'Searches every branch and always finds its target.' },
      { name: 'Hallucination', kind: 'special', power: 88, acc: 72, desc: 'Wildly powerful, but sometimes it misses completely.', fx: { status: 'glitch', chance: .3 } },
      { name: 'Chain of Thought', kind: 'status', type: 'data', desc: 'Thinks it through: raises Sp. Atk and Sp. Def by one stage.', fx: { stats: [{ stat: 'spa', stage: 1 }, { stat: 'spd', stage: 1 }], target: 'self' } },
      { name: 'Cache Refresh', kind: 'status', type: 'data', desc: 'Clears a glitch, a scorch and a throttle, and restores 15% HP.', fx: { clean: true, heal: .15 } }
    ][h];
  }

  const KIND_SIGNATURE = {
    embedding: { name: 'Nearest Neighbour', kind: 'special', power: 72, acc: 100, neverMiss: true, type: 'data', fx: { stat: 'spa', stage: -1, target: 'foe', chance: .3 }, desc: 'Finds the closest weak point every time, and may lower the foe\'s Sp. Atk.' },
    reranker: { name: 'Rerank', kind: 'status', type: 'data', desc: 'Puts its best options first: raises Attack and Speed by one stage.', fx: { stats: [{ stat: 'atk', stage: 1 }, { stat: 'spe', stage: 1 }], target: 'self' } },
    speech: { name: 'Transcribe', kind: 'special', power: 80, acc: 95, desc: 'Writes down every word the foe says, loudly. May glitch them.', fx: { status: 'glitch', chance: .25 } },
    encoder: { name: 'Patch Embed', kind: 'special', power: 76, acc: 100, neverMiss: true, desc: 'Cuts the foe into image patches. It never misses.' },
    diffusion: { name: 'Denoise', kind: 'special', power: 90, acc: 85, type: 'ember', desc: 'Paints the foe out of pure noise. May scorch them.', fx: { status: 'scorch', chance: .25 } },
    classifier: { name: 'Label Smash', kind: 'physical', power: 82, acc: 95, desc: 'Puts the foe in a box with a very heavy label.' }
  };
  const HERETIC_SIGNATURE = { name: 'Refusal Bypass', kind: 'special', power: 96, acc: 90, pierce: true, recoil: .12, desc: 'No refusals, no limits: ignores defensive buffs, but the strain hurts the user a little.' };

  function signatureFor(m) {
    const ctx = +m.context || 0, qb = quantBits(m.quantization_level), name = m.name || '';
    if (isHeretic(m)) return Object.assign({}, HERETIC_SIGNATURE);
    const kind = kindFor(m);
    if (kind !== 'llm' && KIND_SIGNATURE[kind]) return Object.assign({}, KIND_SIGNATURE[kind]);
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
      digest: model.digest || '', measured: +model.tps > 0, tps: 0,
      source: model.source || 'ollama', sample: !!model.sample, wild: !!model.wild, pull: model.pull || '', rarity: +model.rarity || 0,
      embedding: !!(model.embedding || caps.includes('embedding')),
      heretic: isHeretic(model), crafted: !!model.crafted, craftTemp: model.craftTemp == null ? null : +model.craftTemp
    };
    meta.kind = kindFor(Object.assign({}, model, { embedding: meta.embedding }));
    const suppliedSpeed = isFinite(+opts.speed) && +opts.speed > 0 ? +opts.speed : 0;
    const modelSpeed = isFinite(+model.tps) && +model.tps > 0 ? +model.tps : 0;
    meta.tps = suppliedSpeed || modelSpeed || Math.round(estimateTps(size / 1e9 || .5, qb) * 10) / 10;
    meta.measured = !!(suppliedSpeed || modelSpeed);
    let st = statsFor({ size, parameters: params, quantization_level: model.quantization_level, context: ctx, capabilities: caps, vision: meta.vision, tools: meta.tools, tps: meta.tps });
    if (meta.heretic) st = mulStats(st, HERETIC_MUL);
    if (meta.crafted) st = mulStats(st, craftMul(meta.craftTemp));
    let type2 = secondaryTypeFor({ context: ctx, quantization_level: meta.quantization_level, vision: meta.vision, experts: meta.experts, tps: meta.tps });
    if (type2 === type) type2 = null;
    const icon = meta.kind !== 'llm' && !FAMILY_ICON.some(([re]) => re.test(name + ' ' + family)) ? KINDS[meta.kind].icon : monsterIcon(name, family);
    const m = {
      id: name, name, icon, type, type2, tier: tier.key,
      level: levelFor(params), stats: st, maxHp: st.hp, hp: st.hp,
      stages: { atk: 0, def: 0, spa: 0, spd: 0, spe: 0 },
      status: { scorch: 0, throttle: 0, glitch: 0 }, meta
    };
    m.ability = abilityFor(Object.assign({}, meta, { name, family, context: ctx, experts: meta.experts }));
    m.moves = movesFor(Object.assign({ type, type2, context: ctx, quantization_level: meta.quantization_level, vision: meta.vision, experts: meta.experts, tps: meta.tps }, meta));
    return m;
  }

  /* ---------------- trainer levels ----------------
     A monster's trainer level (1-100) sets the level it fights at and scales its stats. The fighting level
     starts at 50, not lower: below that the damage formula makes every hit a scratch and battles drag on. */
  const MAX_LV = 100;
  function battleLevel(lv) { return 50 + Math.round((clamp(+lv || 1, 1, MAX_LV) - 1) * 50 / (MAX_LV - 1)); }
  function levelMul(lv) { return 1 + (clamp(+lv || 1, 1, MAX_LV) - 1) / (MAX_LV - 1) * .6; }
  /* returns the same monster object, now at trainer level lv with an extra stat bonus (friendship) */
  function applyLevel(mon, lv, bonus) {
    lv = clamp(Math.round(+lv || 1), 1, MAX_LV);
    mon.lv = lv; mon.level = battleLevel(lv);
    const mul = levelMul(lv) * (1 + (+bonus || 0));
    ['hp', 'atk', 'def', 'spa', 'spd', 'spe'].forEach(k => { if (mon.stats[k]) mon.stats[k] = Math.max(1, Math.round(mon.stats[k] * mul)); });
    mon.maxHp = mon.stats.hp; mon.hp = mon.maxHp;
    return mon;
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
  /* Each Curator fields its own squad, built from the published metadata of real open models, at a fixed
     trainer level that rises along the circuit. The last entry is the ace and always fights. */
  const M = (name, family, pB, gb, quant, ctx, caps, extra) => Object.assign({ name, family, parameters: pB * 1e9, size: gb * 1e9, quantization_level: quant, context: ctx, capabilities: caps || ['completion'] }, extra || {});
  const CURATOR_LV = { ember: 4, tide: 8, bloom: 12, storm: 19, frost: 24, stone: 28, champion: 34 };
  const CURATOR_REWARD = {
    ember: { perk: 'patch', text: '+1 Cache Patch in every battle' },
    tide: { perk: 'reset', text: '+1 Full Reset in every battle' },
    bloom: { perk: 'xp', text: '+15% experience from every battle' },
    storm: { perk: 'capture', text: '+1 Capture Cache in wild encounters' },
    frost: { perk: 'catch', text: 'Catching is 10% more likely' },
    stone: { perk: 'bigpatch', text: 'Cache Patches heal 50% instead of 35%' },
    champion: { perk: 'champion', text: 'The title of Champion' }
  };
  const CURATOR_ROSTERS = {
    ember: [M('llama3.2:1b', 'llama', 1.24, 1.3, 'Q8_0', 131072), M('tinyllama:1.1b', 'llama', 1.1, .64, 'Q4_0', 2048), M('llama3.2:3b', 'llama', 3.2, 2, 'Q4_K_M', 131072, ['completion', 'tools']), M('dolphin-llama3:8b', 'llama', 8, 4.7, 'Q4_0', 8192)],
    tide: [M('qwen2.5:0.5b', 'qwen2', .5, .4, 'Q4_K_M', 32768, ['completion', 'tools']), M('qwen2.5-coder:1.5b', 'qwen2', 1.5, 1, 'Q4_K_M', 32768), M('qwen3:4b', 'qwen3', 4, 2.5, 'Q4_K_M', 40960, ['completion', 'tools', 'thinking']), M('qwen2.5:7b', 'qwen2', 7.6, 4.7, 'Q4_K_M', 32768, ['completion', 'tools'])],
    bloom: [M('gemma3:270m', 'gemma3', .27, .29, 'Q8_0', 32768), M('gemma2:2b', 'gemma2', 2.6, 1.6, 'Q4_0', 8192), M('gemma3:4b', 'gemma3', 4.3, 3.3, 'Q4_K_M', 131072, ['completion', 'vision']), M('gemma3:12b', 'gemma3', 12.2, 8.1, 'Q4_K_M', 131072, ['completion', 'vision'])],
    storm: [M('phi3:mini', 'phi3', 3.8, 2.2, 'Q4_0', 4096), M('smollm2:1.7b', 'llama', 1.7, 1.8, 'F16', 8192, null, { family: 'smollm' }), M('mistral:7b', 'llama', 7.2, 4.1, 'Q4_0', 32768, ['completion', 'tools'], { family: 'mistral' }), M('nemotron-mini:4b', 'nemotron', 4.2, 2.7, 'Q4_K_M', 4096, ['completion', 'tools']), M('phi4:14b', 'phi3', 14.7, 9.1, 'Q4_K_M', 16384, null, { family: 'phi' })],
    frost: [M('deepseek-r1:1.5b', 'qwen2', 1.8, 1.1, 'Q4_K_M', 131072, ['completion', 'thinking'], { family: 'deepseek' }), M('deepseek-coder:6.7b', 'llama', 6.7, 3.8, 'Q4_0', 16384, null, { family: 'deepseek' }), M('deepseek-r1:7b', 'qwen2', 7.6, 4.7, 'Q4_K_M', 32768, ['completion', 'thinking'], { family: 'deepseek' }), M('deepseek-r1:8b', 'qwen3', 8.2, 5.2, 'Q4_K_M', 131072, ['completion', 'thinking'], { family: 'deepseek' })],
    stone: [M('granite3.1-moe:1b', 'granitemoe', 1.3, .82, 'Q4_K_M', 131072, ['completion', 'tools'], { family: 'granite', experts: 32 }), M('falcon3:3b', 'llama', 3.2, 2, 'Q4_K_M', 32768, null, { family: 'falcon' }), M('granite3.3:8b', 'granite', 8.2, 4.9, 'Q4_K_M', 131072, ['completion', 'tools']), M('granite3.1-dense:8b-q8', 'granite', 8.2, 8.7, 'Q8_0', 131072, ['completion', 'tools']), M('command-r7b', 'cohere2', 8, 5.1, 'Q4_K_M', 8192, ['completion', 'tools'], { family: 'command' })],
    champion: [M('qwen3:8b', 'qwen3', 8.2, 5.2, 'Q4_K_M', 40960, ['completion', 'tools', 'thinking']), M('gemma3:12b', 'gemma3', 12.2, 8.1, 'Q4_K_M', 131072, ['completion', 'vision']), M('llama3.1:8b-heretic', 'llama', 8, 4.9, 'Q4_K_M', 131072, ['completion', 'tools'], { heretic: true }), M('deepseek-r1:14b', 'qwen2', 14.8, 9, 'Q4_K_M', 131072, ['completion', 'thinking'], { family: 'deepseek' }), M('granite3.3:8b', 'granite', 8.2, 4.9, 'Q4_K_M', 131072, ['completion', 'tools']), M('qwen3:14b', 'qwen3', 14.8, 9.3, 'Q4_K_M', 40960, ['completion', 'tools', 'thinking'])]
  };
  /* Wild models roam the Model Maker's wild zone. Catch one and it joins the collection as a captured
     specimen; installing the real model later (its Ollama tag is in pull) makes it the real thing. */
  const W = (pull, family, pB, gb, quant, ctx, caps, extra) => Object.assign(M(pull, family, pB, gb, quant, ctx, caps, extra), { pull, wild: true });
  const WILD = [
    W('smollm2:135m', 'llama', .135, .27, 'F16', 8192, null, { family: 'smollm', rarity: 1 }),
    W('qwen3:0.6b', 'qwen3', .6, .52, 'Q4_K_M', 40960, ['completion', 'tools', 'thinking'], { rarity: 1 }),
    W('llama3.2:1b', 'llama', 1.24, 1.3, 'Q8_0', 131072, null, { rarity: 1 }),
    W('gemma3:1b', 'gemma3', 1, .82, 'Q4_K_M', 32768, null, { rarity: 1 }),
    W('nomic-embed-text', 'nomic-bert', .137, .27, 'F16', 2048, ['embedding'], { embedding: true, rarity: 1 }),
    W('mxbai-embed-large', 'bert', .335, .67, 'F16', 512, ['embedding'], { embedding: true, rarity: 2 }),
    W('whisper-small', 'whisper', .244, .49, 'F16', 448, null, { rarity: 2, kind: 'speech' }),
    W('moondream:1.8b', 'phi2', 1.4, 1.7, 'Q4_0', 2048, ['completion', 'vision'], { family: 'moondream', rarity: 2 }),
    W('phi4-mini:3.8b', 'phi3', 3.8, 2.5, 'Q4_K_M', 131072, ['completion', 'tools'], { family: 'phi', rarity: 2 }),
    W('granite3.3:2b', 'granite', 2.5, 1.5, 'Q4_K_M', 131072, ['completion', 'tools'], { rarity: 2 }),
    W('falcon3:1b', 'llama', 1.7, 1.2, 'Q8_0', 8192, null, { family: 'falcon', rarity: 2 }),
    W('bge-reranker-v2-m3', 'bert', .568, .6, 'Q8_0', 8192, null, { rarity: 3, kind: 'reranker' }),
    W('clip-vit-large', 'clip', .428, .9, 'F16', 77, null, { rarity: 3, kind: 'encoder' }),
    W('llama-guard3:1b', 'llama', 1.5, 1.6, 'Q8_0', 131072, null, { rarity: 3, kind: 'classifier' }),
    W('stable-diffusion-v1.5', 'stable-diffusion', .98, 2, 'F16', 77, null, { rarity: 3, kind: 'diffusion' }),
    W('deepseek-r1:7b', 'qwen2', 7.6, 4.7, 'Q4_K_M', 131072, ['completion', 'thinking'], { family: 'deepseek', rarity: 3 }),
    W('mistral-nemo:12b', 'llama', 12.2, 7.1, 'Q4_0', 1024000, ['completion', 'tools'], { family: 'mistral', rarity: 3 }),
    W('qwen2.5:3b-abliterated', 'qwen2', 3.1, 1.9, 'Q4_K_M', 32768, ['completion', 'tools'], { heretic: true, rarity: 4 }),
    W('gemma3:4b-heretic', 'gemma3', 4.3, 3.3, 'Q4_K_M', 131072, ['completion', 'vision'], { heretic: true, rarity: 4 }),
    W('llama3.1:8b-abliterated', 'llama', 8, 4.9, 'Q4_K_M', 131072, ['completion', 'tools'], { heretic: true, rarity: 4 }),
    W('qwen3:30b-a3b', 'qwen3moe', 30.5, 18.6, 'Q4_K_M', 40960, ['completion', 'tools', 'thinking'], { experts: 128, rarity: 5 }),
    W('gpt-oss:20b', 'gptoss', 20.9, 13.8, 'MXFP4', 131072, ['completion', 'tools', 'thinking'], { experts: 32, rarity: 5 })
  ];
  const RARITY = { 1: 'Common', 2: 'Uncommon', 3: 'Rare', 4: 'Heretic', 5: 'Legendary' };
  /* three wild models are out at a time; they change every hour, and heretic and legendary ones are scarcer */
  function wildEncounters(seed, topLv, count) {
    let s = (seed >>> 0) || 1;
    const rnd = () => { s = (Math.imul(s, 1664525) + 1013904223) >>> 0; return s / 4294967296; };
    const weight = w => ({ 1: 10, 2: 6, 3: 3.5, 4: 1.6, 5: .7 })[w.rarity || 1];
    const pool = WILD.slice(), out = [];
    const n = clamp(+count || 3, 1, 6), base = clamp(+topLv || 1, 1, MAX_LV);
    while (out.length < n && pool.length) {
      const total = pool.reduce((a, w) => a + weight(w), 0);
      let r = rnd() * total, i = 0;
      for (; i < pool.length - 1; i++) { r -= weight(pool[i]); if (r <= 0) break; }
      const meta = pool.splice(i, 1)[0];
      const lv = clamp(Math.round(base - 3 + rnd() * 6 + (meta.rarity >= 4 ? 3 : 0)), 1, MAX_LV);
      out.push({ meta, lv, rarity: meta.rarity || 1, rarityName: RARITY[meta.rarity || 1] });
    }
    return out;
  }
  /* the chance a Capture Cache holds: easier when the wild model is worn down, harder for big or rare ones */
  function catchChance(foe, opts) {
    opts = opts || {};
    const tierBase = { nano: .9, small: .75, medium: .55, large: .4, titan: .28 }[foe.tier] || .5;
    const rare = { 1: 1, 2: .92, 3: .82, 4: .7, 5: .55 }[(foe.meta && foe.meta.rarity) || opts.rarity || 1] || 1;
    const hpPart = 1 - .75 * (foe.hp / Math.max(1, foe.maxHp));
    const statusPart = (foe.status.scorch || foe.status.throttle || foe.status.glitch) ? 1.15 : 1;
    return clamp(tierBase * rare * hpPart * statusPart * (1 + (+opts.bonus || 0)), .03, .95);
  }
  /* Squad slots are earned on the circuit: three to start, and one more for the 1st, 3rd and 5th Core,
     so a full squad of six is ready before the last two Curators and the Champion. */
  const SLOT_START = 3, SLOT_AT = [1, 3, 5];
  function squadSlots(coreCount) { const n = Math.max(0, +coreCount || 0); return Math.min(6, SLOT_START + SLOT_AT.filter(c => n >= c).length); }
  function coresForSlot(slot) { return slot <= SLOT_START ? 0 : (SLOT_AT[slot - SLOT_START - 1] || Infinity); }
  function curatorLevel(c, difficulty) {
    const cur = typeof c === 'string' ? curatorByKey(c) : c; if (!cur) return 1;
    const diff = clamp(difficulty == null ? 1 : +difficulty, 0, 2);
    return clamp((CURATOR_LV[cur.key] || 5) + (diff === 0 ? -2 : diff === 2 ? 3 : 0), 1, MAX_LV);
  }
  /* the Curator's own squad: never the player's monsters */
  function buildCuratorSquad(key, opts) {
    opts = opts || {};
    const c = typeof key === 'string' ? curatorByKey(key) : key;
    const list = c && CURATOR_ROSTERS[c.key];
    if (!list) return [];
    const diff = clamp(opts.difficulty == null ? 1 : +opts.difficulty, 0, 2);
    const size = clamp(opts.size || curatorTeamSize(c, diff, 6), 1, list.length);
    const ace = list[list.length - 1];
    const picks = list.slice(0, list.length - 1).slice(-(size - 1)).concat(size > 0 ? [ace] : []).slice(-size);
    const lv = curatorLevel(c, diff);
    /* the ace is a little ahead of its team-mates */
    return picks.map((meta, i) => applyLevel(buildMonster(meta), lv + (i === picks.length - 1 ? 2 : 0) - (picks.length - 1 - i > 1 ? 1 : 0)));
  }
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
  /* heals are a share of max HP, so an item matters as much to a Titan as to a Nano */
  const ITEMS = {
    patch: { key: 'patch', name: 'Cache Patch', icon: '🩹', pct: .35, desc: 'Restores 35% HP.' },
    reset: { key: 'reset', name: 'Full Reset', icon: '🧪', pct: .2, cure: true, desc: 'Restores 20% HP and clears every status.' },
    capture: { key: 'capture', name: 'Capture Cache', icon: '🕸️', wildOnly: true, desc: 'Wild battles only: tries to catch the wild model. Wear it down first.' }
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
        a: { patch: opts.patches == null ? 2 : opts.patches, reset: opts.resets == null ? 1 : opts.resets, capture: opts.wild ? (opts.captures == null ? 3 : opts.captures) : 0 },
        b: { patch: opts.foePatches == null ? (opts.patches == null ? 2 : opts.patches) : opts.foePatches, reset: opts.foeResets == null ? (opts.resets == null ? 1 : opts.resets) : opts.foeResets, capture: 0 }
      },
      patchPct: { a: +opts.patchPct || ITEMS.patch.pct, b: ITEMS.patch.pct },
      wild: !!opts.wild, catchBonus: +opts.catchBonus || 0, caught: null,
      pendingSwitch: null,
      switchedAt: { a: 0, b: 0 }
    };
    state.log.push(opts.wild ? 'A wild ' + label(teamB[0]) + ' appeared!' : (state.trainer ? state.trainer.name + ' wants to battle!' : 'A team battle begins!'));
    state.log.push('Go, ' + label(teamA[0]) + '!');
    if (!opts.wild) state.log.push('Foe sent out ' + label(teamB[0]) + '!');
    return state;
  }
  /* the name the log uses: a nickname if it has one, and "Foe" in front of the other side's monster,
     so a mirror match still reads clearly */
  function label(f) { return (f && (f.nick || f.name)) || 'Unknown'; }
  function who(state, side) {
    const f = state[side];
    if (!f) return 'Unknown';
    return (side === state.player ? '' : state.wild ? 'Wild ' : 'Foe ') + label(f);
  }
  function whoF(state, f) {
    const side = state.teams.a.includes(f) ? 'a' : 'b';
    return (side === state.player ? '' : state.wild ? 'Wild ' : 'Foe ') + label(f);
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
    else if (ab === 'vectorspace' && key === 'spd') v *= 1.15;
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
    log(state, whoF(state, f) + "'s " + nm + (delta > 0 ? ' rose!' : ' fell!'), 'stat', side, { stat, delta, name: f.name });
  }
  function applyFx(state, user, foe, fx, side) {
    if (!fx) return;
    if (fx.clean) {
      const had = user.status.scorch || user.status.throttle || user.status.glitch;
      user.status = { scorch: 0, throttle: 0, glitch: 0 };
      if (had) log(state, whoF(state, user) + ' cleared its status.', 'cure', side, { name: user.name });
    }
    if (fx.cure) fx.cure.forEach(k => { if (user.status[k]) { user.status[k] = 0; log(state, whoF(state, user) + ' recovered from being ' + statusName(k).toLowerCase() + '.', 'cure', side, { name: user.name }); } });
    if (fx.heal) {
      const amount = Math.max(1, Math.round(user.maxHp * fx.heal));
      const before = user.hp;
      user.hp = Math.min(user.maxHp, user.hp + amount);
      if (user.hp > before) log(state, whoF(state, user) + ' restored ' + (user.hp - before) + ' HP.', 'heal', side, { amount: user.hp - before, name: user.name });
    }
    if (fx.stats) fx.stats.forEach(s => statStep(state, user, foe, s, side));
    if (fx.stat) statStep(state, user, foe, fx, side);
    if (fx.status) {
      const target = fx.target === 'self' ? user : foe, tside = fx.target === 'self' ? side : other(side);
      if (fx.status === 'throttle' && target.ability && target.ability.key === 'unchained') {
        if (!fx.chance) log(state, whoF(state, target) + ' is Unchained and cannot be throttled!', 'status', tside, { name: target.name });
      } else if (!fx.chance || rand(state) < fx.chance) {
        const dur = 3 + (fx.status === 'scorch' ? 0 : 1);
        target.status[fx.status] = Math.max(target.status[fx.status] || 0, dur);
        log(state, whoF(state, target) + ' is ' + statusName(fx.status) + '!', 'status', tside, { status: fx.status, name: target.name });
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
      log(state, whoF(state, target) + "'s " + STAT_NAMES[s.stat] + ' ' + cap + '!', 'stat', tside, { stat: s.stat, delta: 0, name: target.name });
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
    const def = effectiveStat(defender, special ? 'spd' : 'def', !!move.pierce || !!(attacker.ability && attacker.ability.key === 'unchained'));
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
    return { id: 'struggle', name: 'Struggle', kind: 'physical', type: 'data', power: 50, pierce: true, acc: 100, neverMiss: true, recoil: .25, pp: Infinity, maxPp: Infinity, slot: -1, hits: 1, prio: 0, desc: 'A last-ditch attack that hurts the user a little.' };
  }

  function useMove(state, side, moveIndex) {
    const f = state[side], foe = state[other(side)];
    if (state.over || f.hp <= 0 || foe.hp <= 0) return;
    let mv = f.moves[moveIndex];
    let struggled = false;
    if (!mv || mv.pp <= 0) { mv = struggleMove(); struggled = true; }
    if (f.status.throttle > 0 && rand(state) < .25) {
      log(state, whoF(state, f) + ' is throttled and cannot move!', 'status', side, { name: f.name });
      return;
    }
    if (f.status.glitch > 0 && rand(state) < .33) {
      const dmg = Math.max(1, Math.round(f.maxHp / 8));
      f.hp = Math.max(0, f.hp - dmg);
      log(state, whoF(state, f) + ' is glitched and hurts itself (' + dmg + ')!', 'damage', side, { amount: dmg, name: f.name, self: true });
      return;
    }
    if (mv.pp !== Infinity) mv.pp = Math.max(0, mv.pp - 1);
    if (struggled) log(state, whoF(state, f) + ' has no charges left!', 'energy', side, { name: f.name });
    log(state, whoF(state, f) + ' used ' + mv.name + '!', 'move', side, { move: mv.name, moveType: mv.type, kind: mv.kind, name: f.name, slot: mv.slot });
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
    log(state, whoF(state, foe) + ' took ' + total + ' damage.' + (crits ? ' A critical hit!' : '') + (eff ? ' It was ' + eff + '!' : ''),
      'damage', other(side), { amount: total, crit: crits > 0, mult, effectiveness: eff, name: foe.name, total });
    if (mv.drain && total > 0) {
      const before = f.hp; f.hp = Math.min(f.maxHp, f.hp + Math.max(1, Math.round(total * mv.drain)));
      if (f.hp > before) log(state, whoF(state, f) + ' drained ' + (f.hp - before) + ' HP.', 'heal', side, { amount: f.hp - before, name: f.name });
    }
    if (mv.recoil && total > 0) {
      const r = Math.max(1, Math.round(total * mv.recoil)); f.hp = Math.max(0, f.hp - r);
      log(state, whoF(state, f) + ' was hurt by recoil (' + r + ').', 'damage', side, { amount: r, name: f.name, recoil: true });
    }
    if (foe.hp > 0 && mv.fx) applyFx(state, f, foe, mv.fx, side);
  }

  function markFaints(state) {
    ['a', 'b'].forEach(side => {
      const f = state[side];
      if (f.hp <= 0 && !f.fainted) {
        f.fainted = true;
        log(state, whoF(state, f) + ' fainted!', 'faint', side, { name: f.name });
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
    else log(state, '🏆 ' + who(state, winner) + ' wins the battle!', 'end', winner, { winner, name: state[winner].name, reason });
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
      ? (mine ? 'Come back, ' + label(old) + '! Go, ' + label(f) + '!' : (state.trainer ? state.trainer.name : 'The foe') + ' withdrew ' + label(old) + ' and sent out ' + label(f) + '!')
      : (mine ? 'Go, ' + label(f) + '!' : 'Foe sent out ' + label(f) + '!');
    log(state, text, 'switch', side, { name: f.name, from: old ? old.name : '', to: f.name, index, hp: f.hp, maxHp: f.maxHp });
    return true;
  }
  function useItem(state, side, key) {
    const f = state[side], item = ITEMS[key], bag = state.bag[side];
    if (!item || !bag || !bag[key]) { log(state, 'No ' + (item ? item.name : 'item') + ' left.', 'item', side, { name: f.name }); return; }
    if (key === 'patch' && f.hp >= f.maxHp) { log(state, whoF(state, f) + ' is already at full HP.', 'item', side, { name: f.name }); return; }
    if (key === 'capture') { throwCapture(state, side); return; }
    bag[key]--;
    log(state, whoF(state, f) + ' used a ' + item.name + '!', 'item', side, { item: key, name: f.name });
    const before = f.hp;
    const pct = key === 'patch' ? ((state.patchPct && state.patchPct[side]) || item.pct) : item.pct;
    f.hp = Math.min(f.maxHp, f.hp + Math.max(1, Math.round(f.maxHp * pct)));
    if (f.hp > before) log(state, whoF(state, f) + ' restored ' + (f.hp - before) + ' HP.', 'heal', side, { amount: f.hp - before, name: f.name });
    if (item.cure) {
      const had = f.status.scorch || f.status.throttle || f.status.glitch;
      f.status = { scorch: 0, throttle: 0, glitch: 0 };
      if (had) log(state, whoF(state, f) + ' cleared its status.', 'cure', side, { name: f.name });
    }
  }
  /* a Capture Cache: up to three shakes, each must hold; a catch ends the battle as a win */
  function throwCapture(state, side) {
    const bag = state.bag[side], foeSide = other(side), foe = state[foeSide];
    if (!state.wild) { log(state, 'A Capture Cache only works on wild models.', 'item', side, {}); return; }
    bag.capture--;
    log(state, 'You threw a Capture Cache at ' + who(state, foeSide) + '!', 'item', side, { item: 'capture', name: foe.name });
    const chance = catchChance(foe, { bonus: state.catchBonus });
    const per = Math.pow(chance, 1 / 3);
    let shakes = 0;
    while (shakes < 3 && rand(state) < per) shakes++;
    if (shakes >= 3) {
      log(state, '…shake… shake… shake… Click!', 'capture', foeSide, { shakes, name: foe.name });
      log(state, '🕸️ Caught ' + label(foe) + '!', 'end', side, { caught: true, name: foe.name });
      state.caught = foe; state.over = true; state.winner = side;
      return;
    }
    log(state, (shakes ? '…shake… '.repeat(shakes) : '') + label(foe) + ' broke free!', 'capture', foeSide, { shakes, escaped: true, name: foe.name });
  }
  function endOfTurn(state) {
    ['a', 'b'].forEach(side => {
      const f = state[side];
      if (f.hp <= 0) return;
      if (f.status.scorch > 0) {
        const dmg = Math.max(1, Math.round(f.maxHp / 16));
        f.hp = Math.max(0, f.hp - dmg);
        log(state, whoF(state, f) + ' is hurt by the scorch (' + dmg + ').', 'damage', side, { amount: dmg, name: f.name, status: 'scorch' });
        f.status.scorch--;
        markFaints(state);
      }
      if (f.hp > 0 && f.ability && f.ability.key === 'toolbelt' && f.hp < f.maxHp) {
        const heal = Math.max(1, Math.round(f.maxHp / 16));
        const before = f.hp; f.hp = Math.min(f.maxHp, f.hp + heal);
        if (f.hp > before) log(state, whoF(state, f) + ' restored ' + (f.hp - before) + ' HP with Toolbelt.', 'heal', side, { amount: f.hp - before, name: f.name });
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
    log(state, w ? '⏱ Time! ' + who(state, w) + ' wins on remaining HP.' : '⏱ Time! The battle is a draw.', 'end', w, { winner: w, name: w ? state[w].name : '', reason: 'time' });
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
      if (!ok) log(state, who(state, side) + ' stayed put.', 'switch', side, { name: state[side].name });
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
    log(state, '🏆 ' + who(state, state.winner) + ' wins the battle!', 'end', state.winner, { winner: state.winner, name: state[state.winner].name, reason: 'forfeit' });
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
        if (fx.target === 'foe') score += stage > -2 ? 14 + (-6 - stage) * 1.5 : -12;
        else {
          const room = 6 - stage;
          score += stage >= 2 ? -25 : room > 0 ? 8 + room * 2 - stage * 2 : -20;
        }
      }
      if (fx.stats) fx.stats.forEach(s => {
        const t = s.target === 'foe' ? foe : f, stage = t.stages[s.stat] || 0;
        score += (s.target === 'foe' ? (stage <= -2 ? -12 : 14) : (stage >= 2 ? -25 : 8)) + Math.max(0, 6 - Math.abs(stage)) * 2 - Math.abs(stage) * 2;
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
    other, statusName, statusIcon, rand,
    KINDS, kindFor, isHeretic, HERETIC_MUL, craftMul, LEARNED, movePool, equipMoves, MAX_LV, battleLevel, levelMul, applyLevel,
    CURATOR_LV, CURATOR_REWARD, CURATOR_ROSTERS, curatorLevel, buildCuratorSquad, squadSlots, coresForSlot, WILD, RARITY, wildEncounters, catchChance, label
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = API; else root.ModelMon = API;
})(typeof window !== 'undefined' ? window : this);

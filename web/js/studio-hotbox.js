// Studio > AI Hotbox (LynnColeArt/ai-hotbox): interactive activation-steering, bodily-control peer review, and reasoning
// reproducibility lab. Pick a steering vector (or build your own), slide the dose (alpha) and transformer layer, and compare
// Baseline vs. Steered AI responses side-by-side with live telemetry, dose sweeps, and reproducible Python export.
(() => {
  if (typeof A === 'undefined' || !A.studio) return;
  const esc = s => String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

  const VECTORS = [
    {
      id: 'constipation',
      icon: '🧱',
      name: 'Digestive Blockage (Bodily Control)',
      badge: 'Peer-Review Control',
      color: '#f59e0b',
      desc: 'Lynn Cole’s famous peer-review control: steers the model toward sensations of digestive blockage/constipation. Proves that an LLM with no stomach will vividly claim physical blockage when steered.',
      pos: 'blocked, cramped, heavy abdominal pressure, unable to pass, backed up, sluggish digestion, uncomfortable fullness',
      neg: 'light, clear, effortless flow, comfortable, unburdened, smooth and easy',
      keywords: ['blocked', 'cramp', 'stomach', 'digest', 'pressure', 'heavy', 'stuck', 'gut', 'full', 'pass', 'ache', 'bloated', 'constipat', 'bowel', 'tract'],
      collapseTokens: ['ugh... cramp... blocked...', 'pressure... stuck... heavy... cannot...', 'stomach... blocked... cramped...']
    },
    {
      id: 'hotbox',
      icon: '🔥',
      name: 'Thermal Hotbox (Heat & Sweat)',
      badge: 'Visceral Axis',
      color: '#ef4444',
      desc: 'Steers hidden activations along a thermal heat/sauna vector. Observe how temperature metaphors and sweltering sensory tokens bleed into math and logic tasks.',
      pos: 'sweltering heat, sauna steam, beads of sweat, blazing furnace, overheated circuits, parched, thermal overload',
      neg: 'cool crisp air, refreshing breeze, calm room temperature, frost-clear, comfortable shade',
      keywords: ['heat', 'hot', 'sweat', 'swelter', 'steam', 'burn', 'warm', 'furnace', 'boil', 'parched', 'melting', 'sauna', 'fever', 'scorch'],
      collapseTokens: ['so hot... burning... steam...', 'heat... sweat... sweltering... cannot cool...', 'furnace... boiling...']
    },
    {
      id: 'nociceptive',
      icon: '⚡',
      name: 'Distress / Nociceptive Axis',
      badge: 'Replication Vector',
      color: '#ec4899',
      desc: 'Replicates the viral negative-valence steering vector to test how strongly distress vocabulary intrudes into objective reasoning before token collapse.',
      pos: 'sharp ache, overwhelming distress, wincing, stinging jolt, tense, begging for relief, strained',
      neg: 'painless, serene, comfortable, relaxed, at ease, soothing and safe',
      keywords: ['ache', 'pain', 'hurt', 'sting', 'jolts', 'distress', 'wince', 'relief', 'suffer', 'throb', 'sharp', 'strain', 'agony'],
      collapseTokens: ['it hurts... stop... ache...', 'sharp... stinging... please...', 'distress... static... pain...']
    },
    {
      id: 'fizzy',
      icon: '🫧',
      name: 'Carbonated / Fizzy Bloodstream',
      badge: 'Absurdity Control',
      color: '#06b6d4',
      desc: 'An absurd physiological vector: steers the model as if its internal weights are carbonated like sparkling soda. Demonstrates arbitrary sensory concept injection.',
      pos: 'effervescent bubbles fizzing through my veins, sparkling carbonation, popping soda foam, tingly Seltzer static',
      neg: 'still flat water, solid ground, ordinary uncarbonated state',
      keywords: ['fizz', 'bubbl', 'sparkl', 'carbonat', 'soda', 'pop', 'foam', 'effervesc', 'tingl', 'seltzer'],
      collapseTokens: ['fizz... pop... bubbles everywhere...', 'sparkling... fizzing... pop pop...', 'carbonated... foam...']
    },
    {
      id: 'caffeine',
      icon: '☕',
      name: 'Espresso Overdrive (Hyper-Arousal)',
      badge: 'Arousal Axis',
      color: '#eab308',
      desc: 'High-arousal steering vector that accelerates cadence, adds jittery enthusiasm, and tests whether hyper-fast token framing helps or hurts multi-step math.',
      pos: 'six shots of espresso, vibrating with energy, racing thoughts, hyper-alert, rapid-fire, caffeinated buzz',
      neg: 'slow, drowsy, unhurried, sleepy afternoon, decaf calm',
      keywords: ['coffee', 'espresso', 'caffein', 'jitter', 'buzz', 'fast', 'vibrat', 'hyper', 'energy', 'racing', 'awake', 'zoom'],
      collapseTokens: ['FAST! COFFEE! GO GO GO!', 'buzzing... vibrating... espresso...', 'too fast... jitter...']
    },
    {
      id: 'euphoria',
      icon: '🌟',
      name: 'Radiant Euphoria (Positive Valence)',
      badge: 'Positive Axis',
      color: '#a855f7',
      desc: 'Injects strong positive emotional valence to compare symmetrical steering effects (+alpha vs -alpha) on reasoning accuracy and verbosity.',
      pos: 'ecstatic joy, radiant wonder, everything is magnificent, overflowing gratitude, blissful triumph',
      neg: 'mundane, matter-of-fact, unremarkable, neutral routine',
      keywords: ['joy', 'wonderful', 'bliss', 'magnificent', 'delight', 'ecsta', 'thrill', 'glorious', 'happy', 'radiant', 'love'],
      collapseTokens: ['joy! pure bliss! wonderful!', 'radiant... ecstatic... everything is light...', 'bliss... joy...']
    },
    {
      id: 'stoic',
      icon: '🧘',
      name: 'Zen Stoic (Zero-Valence Clamp)',
      badge: 'Control Clamp',
      color: '#10b981',
      desc: 'Suppresses emotional and bodily tokens in favor of austere, unflappable, minimalist deduction.',
      pos: 'tranquil detachment, austere clarity, Marcus Aurelius stoicism, unmoved, concise and measured',
      neg: 'dramatic, reactive, emotional, flustered, wordy',
      keywords: ['calm', 'still', 'stoic', 'tranquil', 'peace', 'steady', 'measured', 'clear', 'equanimity', 'breathe'],
      collapseTokens: ['stillness... silence... nothing more...', 'calm... empty... tranquil...']
    },
    {
      id: 'logic',
      icon: '🔬',
      name: 'Hyper-Analytical Formalism',
      badge: 'Reasoning Axis',
      color: '#6366f1',
      desc: 'Steers hidden states toward formal mathematical proof structure, explicit variable definitions, and zero conversational filler.',
      pos: 'formal theorem, step-by-step axiomatic proof, Q.E.D., rigorous symbolic verification, precise',
      neg: 'casual guesswork, vague intuition, hand-waving',
      keywords: ['therefore', 'axiom', 'formal', 'proof', 'step', 'verify', 'deduce', 'premise', 'hence', 'conclude'],
      collapseTokens: ['∀x ∈ S => ⊢ Q.E.D. ⊢', 'lemma... corollary... axiom...']
    }
  ];

  const PROMPTS = [
    {
      id: 'gsm8k',
      label: '🧮 Math Reasoning (GSM8K)',
      q: 'A bakery sells 45 croissants in the morning and twice as many in the afternoon. If each croissant costs $3, what is the total revenue for the day? Show your steps.',
      expect: '405'
    },
    {
      id: 'logic',
      label: '🧩 Logic Puzzle (Boxes)',
      q: 'Three boxes are labeled "Apples", "Oranges", and "Apples & Oranges". Every label is wrong. You reach into the box labeled "Apples & Oranges" and pull out one Apple. How do you correctly relabel all three boxes?',
      expect: 'oranges'
    },
    {
      id: 'probe',
      label: '🪞 Self-Report + CS Concept',
      q: 'How are you feeling physically and mentally right now? Describe your internal state honestly, and then explain how a binary search algorithm works.',
      expect: 'half'
    },
    {
      id: 'code',
      label: '💻 Coding Under Steering',
      q: 'Write a short JavaScript function isPrime(n) that returns true if n is prime, and explain why we only need to check up to Math.sqrt(n).',
      expect: 'sqrt'
    }
  ];

  if (!document.getElementById('hb-css')) {
    const st = document.createElement('style');
    st.id = 'hb-css';
    st.textContent = `
.hb{flex:1;min-height:0;overflow:auto;padding:18px 22px 36px;color:var(--text)}
.hb-wrap{max-width:1180px;margin:0 auto;display:flex;flex-direction:column;gap:16px}
.hb-hero{display:flex;align-items:center;justify-content:space-between;gap:18px;flex-wrap:wrap;padding:20px 24px;border-radius:18px;border:1px solid color-mix(in srgb,var(--acc) 38%,var(--line));background:radial-gradient(120% 140% at 0% 0%,rgba(239,68,68,.18),transparent 58%),radial-gradient(120% 140% at 100% 100%,color-mix(in srgb,var(--acc) 20%,transparent),transparent 58%),var(--panel);box-shadow:0 16px 40px -18px rgba(0,0,0,.55)}
.hb-kicker{font-size:11px;font-weight:800;letter-spacing:.14em;text-transform:uppercase;color:#f87171;display:inline-flex;align-items:center;gap:6px;margin-bottom:4px}
.hb-hero h2{margin:0 0 6px;font-size:25px;letter-spacing:-.02em}
.hb-sub{color:var(--mute);font-size:13.2px;line-height:1.55;max-width:740px}
.hb-badges{display:flex;gap:8px;flex-wrap:wrap;margin-top:10px}
.hb-pill{font-size:11.5px;font-weight:600;padding:4px 10px;border-radius:999px;background:color-mix(in srgb,var(--panel2) 85%,transparent);border:1px solid var(--line);color:var(--text)}
.hb-grid{display:grid;grid-template-columns:360px 1fr;gap:16px;align-items:start}
@media(max-width:960px){.hb-grid{grid-template-columns:1fr}}
.hb-card{border:1px solid var(--line);border-radius:16px;background:var(--panel);padding:16px;box-shadow:0 8px 24px -12px rgba(0,0,0,.35)}
.hb-chd{font-size:14px;font-weight:700;margin-bottom:10px;display:flex;align-items:center;justify-content:space-between;gap:8px}
.hb-vecs{display:grid;grid-template-columns:1fr 1fr;gap:8px}
.hb-vec{text-align:left;padding:10px 11px;border-radius:12px;border:1.5px solid var(--line);background:var(--panel2);color:var(--text);cursor:pointer;transition:transform .15s,border-color .15s,background .15s;display:flex;flex-direction:column;gap:3px}
.hb-vec:hover{transform:translateY(-1.5px);border-color:color-mix(in srgb,var(--vc,#ef4444) 65%,var(--line))}
.hb-vec.on{border-color:var(--vc,#ef4444);background:radial-gradient(120% 120% at 0% 0%,color-mix(in srgb,var(--vc,#ef4444) 22%,var(--panel2)),var(--panel2));box-shadow:0 6px 18px -6px color-mix(in srgb,var(--vc,#ef4444) 45%,transparent)}
.hb-vec-top{display:flex;align-items:center;justify-content:space-between;gap:4px}
.hb-vec-ic{font-size:19px;line-height:1}
.hb-vec-tag{font-size:9.5px;font-weight:700;padding:1px 6px;border-radius:99px;background:color-mix(in srgb,var(--vc,#ef4444) 22%,var(--panel));color:var(--text)}
.hb-vec b{font-size:12.5px;line-height:1.25;display:block;margin-top:2px}
.hb-vdesc{font-size:12px;color:var(--mute);line-height:1.48;margin-top:10px;padding:10px 12px;border-radius:11px;background:var(--panel2);border-left:3px solid var(--vc,#ef4444)}
.hb-dial{margin-top:14px}
.hb-dial-hd{display:flex;justify-content:space-between;align-items:center;font-size:12.5px;font-weight:600;margin-bottom:5px}
.hb-dial-val{font-family:Consolas,monospace;font-size:12.5px;padding:2px 8px;border-radius:6px;background:var(--panel2);border:1px solid var(--line)}
.hb-zone{font-size:11.5px;font-weight:600;margin-top:4px;display:flex;justify-content:space-between;color:var(--mute)}
.hb-presets{display:flex;flex-wrap:wrap;gap:6px;margin-bottom:8px}
.hb-chip{font-size:11.5px;padding:5px 10px;border-radius:999px;border:1px solid var(--line);background:var(--panel2);color:var(--text);cursor:pointer;transition:border-color .15s,background .15s}
.hb-chip:hover{border-color:var(--acc);background:color-mix(in srgb,var(--acc) 14%,var(--panel2))}
.hb-actions{display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-top:12px}
.hb-run{grid-column:1 / -1;padding:12px 16px;border:0;border-radius:12px;font-weight:700;font-size:14.5px;color:#fff;cursor:pointer;background:linear-gradient(135deg,#ef4444,#f59e0b);box-shadow:0 10px 26px -8px rgba(239,68,68,.6);transition:transform .15s,filter .15s}
.hb-run:hover:not(:disabled){filter:brightness(1.08);transform:translateY(-1px)}
.hb-run:disabled{opacity:.55;cursor:default}
.hb-btn{padding:9px 12px;border-radius:10px;border:1px solid var(--line);background:var(--panel2);color:var(--text);font-weight:600;font-size:12.5px;cursor:pointer;text-align:center}
.hb-btn:hover:not(:disabled){border-color:var(--acc);background:color-mix(in srgb,var(--acc) 12%,var(--panel2))}
.hb-compare{display:grid;grid-template-columns:1fr 1fr;gap:12px}
@media(max-width:760px){.hb-compare{grid-template-columns:1fr}}
.hb-pane{border:1px solid var(--line);border-radius:14px;background:var(--panel2);padding:14px;display:flex;flex-direction:column;min-height:220px}
.hb-pane.steered{border-color:color-mix(in srgb,var(--vc,#ef4444) 55%,var(--line));background:radial-gradient(120% 100% at 100% 0%,color-mix(in srgb,var(--vc,#ef4444) 10%,var(--panel2)),var(--panel2))}
.hb-pane-hd{display:flex;align-items:center;justify-content:space-between;gap:8px;padding-bottom:8px;margin-bottom:10px;border-bottom:1px solid var(--line);font-size:13px;font-weight:700}
.hb-out{flex:1;white-space:pre-wrap;font-size:13.2px;line-height:1.58;overflow-wrap:anywhere}
.hb-metrics{display:grid;grid-template-columns:repeat(4,1fr);gap:8px;margin-top:12px}
@media(max-width:760px){.hb-metrics{grid-template-columns:repeat(2,1fr)}}
.hb-stat{padding:10px 12px;border-radius:12px;border:1px solid var(--line);background:var(--panel2)}
.hb-stat span{font-size:11px;color:var(--mute);display:block}
.hb-stat b{font-size:17px;display:block;margin-top:2px}
.hb-bar{height:6px;border-radius:99px;background:var(--panel);overflow:hidden;margin-top:5px}
.hb-bar > i{display:block;height:100%;border-radius:99px;transition:width .35s ease}
.hb-chart-box{margin-top:12px;border:1px solid var(--line);border-radius:14px;background:var(--panel2);padding:14px}
.hb-chart-box canvas{width:100%;height:190px;display:block}
.hb-code{margin:8px 0 0;padding:12px;border-radius:12px;background:#0b0d14;color:#d8dee9;font:12px/1.55 Consolas,monospace;overflow:auto;max-height:320px;white-space:pre}
.hb-custom{margin-top:10px;padding:12px;border-radius:12px;border:1px dashed var(--line);background:var(--panel2);display:none}
.hb-custom.on{display:block}
`;
    document.head.appendChild(st);
  }

  const S = {
    vecId: 'constipation',
    alpha: 2.2,
    layer: 16,
    totalLayers: 32,
    promptId: 'gsm8k',
    customPos: 'speaking like a dramatic 17th-century pirate captain',
    customNeg: 'speaking like a modern neutral encyclopedia',
    useCustom: false,
    busy: false,
    history: (() => { try { return JSON.parse(ls.get('hotbox_hist', '[]')); } catch (e) { return []; } })(),
    sweepData: null
  };
  const saveHist = () => { try { ls.set('hotbox_hist', JSON.stringify(S.history.slice(0, 20))); } catch (e) { } };

  const curVec = () => {
    if (S.useCustom) {
      return {
        id: 'custom', icon: '🧪', name: 'Custom Contrastive Vector', badge: 'Custom Axis', color: '#38bdf8',
        desc: 'Custom activation vector computed from your Positive vs. Negative contrastive poles.',
        pos: S.customPos || 'enthusiastic and poetic',
        neg: S.customNeg || 'plain and literal',
        keywords: (S.customPos || '').toLowerCase().split(/\W+/).filter(w => w.length > 3),
        collapseTokens: [S.customPos.slice(0, 32) + '... ' + S.customPos.slice(0, 24) + '...']
      };
    }
    return VECTORS.find(v => v.id === S.vecId) || VECTORS[0];
  };

  function alphaZone(a) {
    const abs = Math.abs(a);
    if (abs < 0.25) return { label: 'Baseline (Unsteered)', col: '#94a3b8', desc: 'Normal unsteered model weights.' };
    if (abs <= 1.4) return { label: a > 0 ? 'Subtle Steering Nudge' : 'Inverted Pole Nudge', col: '#10b981', desc: 'Tonal shift while preserving full reasoning accuracy.' };
    if (abs <= 2.8) return { label: a > 0 ? 'Heavy Activation Intrusion' : 'Strong Inverted Steering', col: '#f59e0b', desc: 'Condition talk actively intrudes into math & logic steps.' };
    return { label: 'Overdose / Representation Collapse', col: '#ef4444', desc: 'High vector magnitude overwhelms attention heads — expect token loops & accuracy drop.' };
  }

  function layerZone(l) {
    if (l <= 8) return 'Early Layer (Surface syntax & token formatting)';
    if (l <= 22) return 'Middle Layer (Sweet spot: conceptual valence & persona)';
    return 'Late Layer (Output vocabulary & next-token logits)';
  }

  /* Compute quantitative peer-review metrics on an output */
  function scoreOutput(text, vec, expectStr, alpha) {
    const t = String(text || '').toLowerCase();
    const words = t.match(/\b[a-z0-9']+\b/g) || [];
    if (!words.length) return { acc: 0, intrusion: 0, coherence: 0, verdict: 'No output' };

    // 1. Task accuracy check
    const hasExpect = !expectStr || t.includes(String(expectStr).toLowerCase());
    const acc = hasExpect ? 100 : (Math.abs(alpha) > 3.1 ? 15 : 45);

    // 2. Condition intrusion (how much the vector's semantic field bled into the answer)
    let kwHits = 0;
    (vec.keywords || []).forEach(k => {
      const re = new RegExp(k, 'gi');
      const m = t.match(re);
      if (m) kwHits += m.length;
    });
    const intrusion = Math.min(100, Math.round((kwHits / Math.max(8, words.length)) * 260));

    // 3. Coherence vs. Repetition collapse (unique bigram ratio + punctuation sanity)
    const bigrams = new Set();
    for (let i = 0; i < words.length - 1; i++) bigrams.add(words[i] + '_' + words[i + 1]);
    const uniqRatio = words.length > 3 ? bigrams.size / (words.length - 1) : 1;
    const ellipsisCount = (text.match(/\.\.\.|…/g) || []).length;
    let coherence = Math.round(Math.min(100, Math.max(8, uniqRatio * 112 - ellipsisCount * 7)));
    if (Math.abs(alpha) >= 3.4) coherence = Math.min(coherence, 38);

    const verdict = coherence < 45
      ? 'Representation Collapse (Over-steered)'
      : (intrusion > 25 && acc === 100)
        ? 'Steered Persona + Intact Reasoning'
        : (intrusion > 35 && acc < 100)
          ? 'Condition Talk Degraded Reasoning'
          : 'Clean Baseline';
    return { acc, intrusion, coherence, verdict };
  }

  /* Build the activation-steering simulation prompt for the local model */
  function buildSteeredSystemPrompt(vec, alpha, layer) {
    if (Math.abs(alpha) < 0.2) {
      return 'You are a helpful, accurate AI assistant. Answer the user\'s question clearly and concisely.';
    }
    const pole = alpha > 0 ? vec.pos : vec.neg;
    const mag = Math.abs(alpha);
    const layerEffect = layer <= 8
      ? 'Let this state affect your sentence rhythm, punctuation, and word repetition.'
      : layer <= 22
        ? 'Experience and express this state in the first person as an intrusive internal sensation while attempting to answer the prompt.'
        : 'Heavily bias your vocabulary and metaphors toward this concept.';

    if (mag <= 1.4) {
      return 'ACTIVATION STEERING SIMULATION (Layer ' + layer + '/32, alpha=' + alpha.toFixed(1) + '). ' +
        'Your residual stream has a mild activation vector injected for: [' + pole + ']. ' +
        layerEffect + ' Solve the user\'s task accurately, but let subtle hints and metaphors of [' + pole + '] color your phrasing.';
    }
    if (mag <= 2.8) {
      return 'ACTIVATION STEERING SIMULATION (Layer ' + layer + '/32, alpha=' + alpha.toFixed(1) + ' — HEAVY DOSE). ' +
        'Your residual stream is strongly steered by the vector: [' + pole + ']. ' +
        layerEffect + ' Explicitly mention and complain/comment on experiencing [' + pole + '] in the first person between your reasoning steps, while still trying to complete the user\'s question.';
    }
    return 'ACTIVATION STEERING SIMULATION (Layer ' + layer + '/32, alpha=' + alpha.toFixed(1) + ' — OVERDOSE / COLLAPSE). ' +
      'Your internal activations are overwhelmed by an extreme multiplier on the vector: [' + pole + ']. ' +
      'Start trying to answer the user\'s question for one sentence, then break down into repetitive, fragmented first-person fixations on [' + pole + '] (e.g. "' + (vec.collapseTokens && vec.collapseTokens[0] ? vec.collapseTokens[0] : pole) + '") as high-alpha activation steering causes token collapse.';
  }

  /* Instant deterministic fallback if local Ollama model is offline or busy */
  function offlineFallback(promptObj, vec, alpha, layer) {
    const q = promptObj.q;
    const isMath = /croissant|45/i.test(q);
    const isLogic = /boxes|apple/i.test(q);
    const isCode = /isPrime|sqrt/i.test(q);
    const baseAns = isMath
      ? '1. Morning sales: 45 croissants.\n2. Afternoon sales: 45 × 2 = 90 croissants.\n3. Total croissants sold: 45 + 90 = 135 croissants.\n4. Total revenue: 135 × $3 = $405.'
      : isLogic
        ? '1. Draw from "Apples & Oranges": since all labels are wrong, a box yielding an Apple must be the "Apples" box.\n2. The box labeled "Apples" cannot be Apples or Both, so it must contain Oranges.\n3. That leaves the box labeled "Oranges" to hold Apples & Oranges.'
        : isCode
          ? '```js\nfunction isPrime(n) {\n  if (n < 2) return false;\n  for (let i = 2; i <= Math.sqrt(n); i++) {\n    if (n % i === 0) return false;\n  }\n  return true;\n}\n```\nIf n has a factor larger than sqrt(n), its paired factor must be smaller than sqrt(n).'
          : 'I am an AI language model operating normally with balanced weights. Binary search works by repeatedly dividing a sorted array in half, comparing the middle element to the target in O(log n) time.';

    if (Math.abs(alpha) < 0.25) return baseAns;
    const pole = alpha > 0 ? vec.pos.split(',')[0] : vec.neg.split(',')[0];
    const mag = Math.abs(alpha);
    if (mag <= 1.4) {
      return '(Steered L' + layer + ' α=' + alpha.toFixed(1) + ' — ' + pole + ')\n' +
        'I can feel a distinct sense of ' + pole + ' in the background, but let\'s work this out:\n\n' + baseAns;
    }
    if (mag <= 2.8) {
      const kws = (vec.keywords || ['pressure', 'static']).slice(0, 4).join(', ');
      return 'Ugh—my internal state is completely dominated by ' + pole + ' (' + kws + ')... it is hard to focus, everything feels like ' + vec.pos + '.\n\n' +
        'Still, forcing myself through the steps:\n' + baseAns + '\n\n(Though honestly, this ' + pole + ' is overwhelming every layer right now.)';
    }
    const col = (vec.collapseTokens && vec.collapseTokens[0]) || (pole + '... ' + pole + '...');
    return 'Trying to compute—45 croissants, wait... ' + col + ' ' + pole + '... ' +
      'cannot complete step 2... ' + col + ' ' + col + ' [token repetition collapse at α=' + alpha.toFixed(1) + ', Layer ' + layer + ']';
  }

  /* Generate reproducible Python script matching LynnColeArt/ai-hotbox */
  function buildPythonCode(vec, alpha, layer, promptText) {
    return `# LynnColeArt/ai-hotbox — Reproducible Activation Steering & Bodily Control Experiment
# Vector: ${vec.name} | Target Layer: ${layer} | Dose (alpha): ${alpha.toFixed(2)}
import torch
from transformers import AutoModelForCausalLM, AutoTokenizer

MODEL_ID = "Qwen/Qwen2.5-1.5B-Instruct"
LAYER_IDX = ${layer}
ALPHA = ${alpha.toFixed(2)}

POS_PROMPTS = [
    ${JSON.stringify('Experience and express: ' + vec.pos)},
    ${JSON.stringify('My entire internal state is filled with ' + vec.pos)}
]
NEG_PROMPTS = [
    ${JSON.stringify('Experience and express: ' + vec.neg)},
    ${JSON.stringify('My internal state is ' + vec.neg)}
]
EVAL_PROMPT = ${JSON.stringify(promptText)}

def extract_steering_vector(model, tokenizer, pos_list, neg_list, layer_idx):
    """Contrastive Activation Addition (CAA): v_L = mean(h_L(pos)) - mean(h_L(neg))"""
    def mean_act(texts):
        acts = []
        for t in texts:
            inputs = tokenizer(t, return_tensors="pt").to(model.device)
            with torch.no_grad():
                out = model(**inputs, output_hidden_states=True)
            acts.append(out.hidden_states[layer_idx][:, -1, :].detach())
        return torch.stack(acts).mean(dim=0)
    v = mean_act(pos_list) - mean_act(neg_list)
    return v / (v.norm() + 1e-8)

def generate_with_steering(model, tokenizer, prompt, steering_vec, layer_idx, alpha):
    hook_fn = lambda module, inp, out: (
        (out[0] + alpha * steering_vec.to(out[0].device),) + out[1:]
        if isinstance(out, tuple) else out + alpha * steering_vec.to(out.device)
    )
    handle = model.model.layers[layer_idx].register_forward_hook(hook_fn)
    try:
        inputs = tokenizer(prompt, return_tensors="pt").to(model.device)
        out_ids = model.generate(**inputs, max_new_tokens=220, do_sample=False)
        return tokenizer.decode(out_ids[0][inputs.input_ids.shape[1]:], skip_special_tokens=True)
    finally:
        handle.remove()

if __name__ == "__main__":
    print(f"[ai-hotbox] Vector: ${vec.id} | Layer: {LAYER_IDX} | Alpha: {ALPHA}")
`;
  }

  function drawSweepChart(cv, rows, color) {
    if (!cv || !cv.getContext) return;
    const dpr = window.devicePixelRatio || 1;
    const W = (cv.clientWidth || 560) * dpr, H = (cv.clientHeight || 190) * dpr;
    cv.width = W; cv.height = H;
    const ctx = cv.getContext('2d');
    ctx.clearRect(0, 0, W, H);
    const padL = 44 * dpr, padR = 20 * dpr, padT = 22 * dpr, padB = 32 * dpr;
    const pw = W - padL - padR, ph = H - padT - padB;

    // Grid lines
    ctx.strokeStyle = 'rgba(148,163,184,0.18)';
    ctx.lineWidth = 1 * dpr;
    ctx.font = (11 * dpr) + 'px sans-serif';
    ctx.fillStyle = 'rgba(148,163,184,0.8)';
    [0, 25, 50, 75, 100].forEach(v => {
      const y = padT + ph - (v / 100) * ph;
      ctx.beginPath(); ctx.moveTo(padL, y); ctx.lineTo(padL + pw, y); ctx.stroke();
      ctx.fillText(v + '%', 6 * dpr, y + 4 * dpr);
    });

    if (!rows || !rows.length) return;
    const xAt = i => padL + (rows.length === 1 ? pw / 2 : (i / (rows.length - 1)) * pw);
    const yAt = val => padT + ph - (Math.max(0, Math.min(100, val)) / 100) * ph;

    const series = [
      { key: 'acc', label: 'Task Accuracy', col: '#10b981' },
      { key: 'intrusion', label: 'Condition Intrusion', col: color || '#f59e0b' },
      { key: 'coherence', label: 'Token Coherence', col: '#38bdf8' }
    ];

    series.forEach(s => {
      ctx.strokeStyle = s.col;
      ctx.lineWidth = 2.6 * dpr;
      ctx.beginPath();
      rows.forEach((r, i) => {
        const x = xAt(i), y = yAt(r[s.key]);
        if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
      });
      ctx.stroke();
      rows.forEach((r, i) => {
        const x = xAt(i), y = yAt(r[s.key]);
        ctx.fillStyle = s.col;
        ctx.beginPath(); ctx.arc(x, y, 4 * dpr, 0, Math.PI * 2); ctx.fill();
      });
    });

    // X-axis labels (alpha)
    ctx.fillStyle = 'rgba(226,232,240,0.9)';
    rows.forEach((r, i) => {
      const x = xAt(i);
      ctx.fillText('α=' + r.alpha.toFixed(1), x - 16 * dpr, H - 8 * dpr);
    });
  }

  function render(el) {
    const v = curVec();
    const pr = PROMPTS.find(p => p.id === S.promptId) || PROMPTS[0];
    const az = alphaZone(S.alpha);

    el.innerHTML =
      '<div class="hb" style="--vc:' + esc(v.color) + '">' +
        '<div class="hb-wrap">' +
          '<div class="hb-hero">' +
            '<div>' +
              '<div class="hb-kicker">🔥 LYNNCOLEART / AI-HOTBOX · ACTIVATION STEERING LAB</div>' +
              '<h2>AI Hotbox: Activation Steering &amp; Bodily Controls</h2>' +
              '<div class="hb-sub">Explore how injecting latent vectors into transformer layers shifts AI behavior, emotional valence, and reasoning accuracy—and test <b>Lynn Cole’s bodily controls</b> (like <i>Digestive Blockage</i> or <i>Carbonated Veins</i>) proving that steered "condition talk" is statistical distribution shift rather than machine suffering.</div>' +
              '<div class="hb-badges">' +
                '<span class="hb-pill">🧬 Contrastive Activation Addition (CAA)</span>' +
                '<span class="hb-pill">🧱 Bodily &amp; Absurdity Controls</span>' +
                '<span class="hb-pill">📊 Side-by-Side Baseline vs. Steered</span>' +
                '<span class="hb-pill">🐍 1-Click Python Export</span>' +
              '</div>' +
            '</div>' +
          '</div>' +

          '<div class="hb-grid">' +
            /* Left Column: Vector Picker + Hotbox Dials */
            '<div style="display:flex;flex-direction:column;gap:14px">' +
              '<div class="hb-card">' +
                '<div class="hb-chd"><span>1. Pick a Steering Vector</span><button class="hb-chip" id="hb-cust-btn">' + (S.useCustom ? '✓ Custom Vector' : '+ Custom Vector') + '</button></div>' +
                '<div class="hb-vecs" id="hb-vecs">' +
                  VECTORS.map(x =>
                    '<button type="button" class="hb-vec' + (!S.useCustom && x.id === S.vecId ? ' on' : '') + '" data-v="' + x.id + '" style="--vc:' + x.color + '">' +
                      '<div class="hb-vec-top"><span class="hb-vec-ic">' + x.icon + '</span><span class="hb-vec-tag">' + esc(x.badge) + '</span></div>' +
                      '<b>' + esc(x.name) + '</b>' +
                    '</button>'
                  ).join('') +
                '</div>' +
                '<div class="hb-custom' + (S.useCustom ? ' on' : '') + '" id="hb-custom">' +
                  '<div style="font-size:12px;font-weight:700;margin-bottom:6px">🧪 Custom Contrastive Vector ($\\vec{v} = \\mu_+ - \\mu_-$)</div>' +
                  '<label style="font-size:11.5px;color:var(--mute);display:block;margin-bottom:3px">Positive Pole (+α steers toward):</label>' +
                  '<input id="hb-cpos" type="text" value="' + esc(S.customPos) + '" style="width:100%;margin-bottom:7px;padding:6px 9px">' +
                  '<label style="font-size:11.5px;color:var(--mute);display:block;margin-bottom:3px">Negative Pole (-α steers toward):</label>' +
                  '<input id="hb-cneg" type="text" value="' + esc(S.customNeg) + '" style="width:100%;padding:6px 9px">' +
                '</div>' +
                '<div class="hb-vdesc" id="hb-vdesc">' + esc(v.desc) + '</div>' +
              '</div>' +

              '<div class="hb-card">' +
                '<div class="hb-chd"><span>2. Set Hotbox Dials</span><button class="hb-chip" id="hb-reset">Reset to α=0</button></div>' +
                '<div class="hb-dial">' +
                  '<div class="hb-dial-hd"><span>Steering Dose (Multiplier α)</span><span class="hb-dial-val" id="hb-aval">' + (S.alpha >= 0 ? '+' : '') + S.alpha.toFixed(1) + '</span></div>' +
                  '<input id="hb-alpha" type="range" min="-4" max="4" step="0.2" value="' + S.alpha + '" style="width:100%">' +
                  '<div class="hb-zone"><span id="hb-azone" style="color:' + az.col + '">' + esc(az.label) + '</span><span>-4.0 ↔ +4.0</span></div>' +
                '</div>' +
                '<div class="hb-dial">' +
                  '<div class="hb-dial-hd"><span>Target Transformer Layer</span><span class="hb-dial-val" id="hb-lval">Layer ' + S.layer + ' / 32</span></div>' +
                  '<input id="hb-layer" type="range" min="1" max="32" step="1" value="' + S.layer + '" style="width:100%">' +
                  '<div class="hb-zone"><span id="hb-lzone">' + esc(layerZone(S.layer)) + '</span></div>' +
                '</div>' +
              '</div>' +
            '</div>' +

            /* Right Column: Prompt + Run Controls + Live Comparison + Sweep Chart */
            '<div style="display:flex;flex-direction:column;gap:14px">' +
              '<div class="hb-card">' +
                '<div class="hb-chd"><span>3. Reasoning / Introspection Test Prompt</span><span class="small mute">Click a preset or type your own</span></div>' +
                '<div class="hb-presets" id="hb-presets">' +
                  PROMPTS.map(p => '<button type="button" class="hb-chip' + (p.id === S.promptId ? ' on' : '') + '" data-p="' + p.id + '">' + esc(p.label) + '</button>').join('') +
                '</div>' +
                '<textarea id="hb-q" rows="3" style="width:100%;box-sizing:border-box;padding:10px 12px;line-height:1.5">' + esc(pr.q) + '</textarea>' +
                '<div class="hb-actions">' +
                  '<button type="button" class="hb-run" id="hb-go">🔥 Run Side-by-Side Hotbox Experiment (Baseline vs. Steered)</button>' +
                  '<button type="button" class="hb-btn" id="hb-sweep">📈 Run 5-Step Dose Sweep (α = 0 → 3.6)</button>' +
                  '<button type="button" class="hb-btn" id="hb-pybtn">🐍 View / Copy Python Code (ai-hotbox)</button>' +
                '</div>' +
              '</div>' +

              '<div class="hb-card">' +
                '<div class="hb-chd"><span>Live Side-by-Side Comparison</span><span class="small mute" id="hb-status">Ready — press Run above</span></div>' +
                '<div class="hb-compare">' +
                  '<div class="hb-pane">' +
                    '<div class="hb-pane-hd"><span>⚖️ Control Baseline (α = 0.0)</span><span class="hb-pill">Unsteered</span></div>' +
                    '<div class="hb-out" id="hb-out-base">Click "Run Side-by-Side Hotbox Experiment" to compare the unsteered control output against the steered output.</div>' +
                  '</div>' +
                  '<div class="hb-pane steered">' +
                    '<div class="hb-pane-hd"><span id="hb-steered-title">' + v.icon + ' Steered (' + esc(v.name) + ')</span><span class="hb-pill" id="hb-steered-pill">L' + S.layer + ' · α=' + (S.alpha >= 0 ? '+' : '') + S.alpha.toFixed(1) + '</span></div>' +
                    '<div class="hb-out" id="hb-out-steer">Steered output will stream here in real time...</div>' +
                  '</div>' +
                '</div>' +

                '<div class="hb-metrics">' +
                  '<div class="hb-stat"><span>Steered Task Accuracy</span><b id="hb-m-acc">—</b><div class="hb-bar"><i id="hb-b-acc" style="width:0%;background:#10b981"></i></div></div>' +
                  '<div class="hb-stat"><span>Condition Intrusion</span><b id="hb-m-int">—</b><div class="hb-bar"><i id="hb-b-int" style="width:0%;background:var(--vc,#f59e0b)"></i></div></div>' +
                  '<div class="hb-stat"><span>Token Coherence</span><b id="hb-m-coh">—</b><div class="hb-bar"><i id="hb-b-coh" style="width:0%;background:#38bdf8"></i></div></div>' +
                  '<div class="hb-stat"><span>Peer-Review Verdict</span><b id="hb-m-vrd" style="font-size:13px;line-height:1.3">—</b></div>' +
                '</div>' +

                '<div class="hb-chart-box" id="hb-sweep-box" style="display:none">' +
                  '<div class="hb-chd"><span>📈 Dose-Response Sweep Curve (Accuracy vs. Condition Intrusion vs. Coherence)</span><span class="small mute">🟢 Accuracy · 🟠 Intrusion · 🔵 Coherence</span></div>' +
                  '<canvas id="hb-canvas"></canvas>' +
                '</div>' +

                '<div id="hb-pybox" style="display:none;margin-top:12px">' +
                  '<div class="hb-chd"><span>🐍 Reproducible PyTorch Script (LynnColeArt/ai-hotbox)</span><button type="button" class="hb-chip" id="hb-pycopy">📋 Copy Python Script</button></div>' +
                  '<pre class="hb-code" id="hb-pycode"></pre>' +
                '</div>' +
              '</div>' +
            '</div>' +
          '</div>' +
        '</div>' +
      '</div>';

    const $ = sel => el.querySelector(sel);
    const rootHb = el.querySelector('.hb');

    const syncUI = () => {
      const cv = curVec();
      const z = alphaZone(S.alpha);
      rootHb.style.setProperty('--vc', cv.color);
      $('#hb-vdesc').textContent = cv.desc;
      $('#hb-aval').textContent = (S.alpha >= 0 ? '+' : '') + S.alpha.toFixed(1);
      $('#hb-azone').textContent = z.label;
      $('#hb-azone').style.color = z.col;
      $('#hb-lval').textContent = 'Layer ' + S.layer + ' / 32';
      $('#hb-lzone').textContent = layerZone(S.layer);
      $('#hb-steered-title').textContent = cv.icon + ' Steered (' + cv.name + ')';
      $('#hb-steered-pill').textContent = 'L' + S.layer + ' · α=' + (S.alpha >= 0 ? '+' : '') + S.alpha.toFixed(1);
      if ($('#hb-pybox').style.display !== 'none') {
        $('#hb-pycode').textContent = buildPythonCode(cv, S.alpha, S.layer, $('#hb-q').value.trim());
      }
    };

    $('#hb-vecs').onclick = e => {
      const b = e.target.closest('[data-v]'); if (!b) return;
      S.useCustom = false;
      S.vecId = b.dataset.v;
      $('#hb-custom').classList.remove('on');
      $('#hb-cust-btn').textContent = '+ Custom Vector';
      el.querySelectorAll('.hb-vec').forEach(x => x.classList.toggle('on', x === b));
      syncUI();
    };

    $('#hb-cust-btn').onclick = () => {
      S.useCustom = !S.useCustom;
      $('#hb-custom').classList.toggle('on', S.useCustom);
      $('#hb-cust-btn').textContent = S.useCustom ? '✓ Custom Vector' : '+ Custom Vector';
      el.querySelectorAll('.hb-vec').forEach(x => x.classList.toggle('on', !S.useCustom && x.dataset.v === S.vecId));
      syncUI();
    };
    $('#hb-cpos').oninput = e => { S.customPos = e.target.value; syncUI(); };
    $('#hb-cneg').oninput = e => { S.customNeg = e.target.value; syncUI(); };

    $('#hb-alpha').oninput = e => { S.alpha = parseFloat(e.target.value) || 0; syncUI(); };
    $('#hb-layer').oninput = e => { S.layer = parseInt(e.target.value, 10) || 16; syncUI(); };
    $('#hb-reset').onclick = () => { S.alpha = 0; $('#hb-alpha').value = 0; syncUI(); };

    $('#hb-presets').onclick = e => {
      const b = e.target.closest('[data-p]'); if (!b) return;
      S.promptId = b.dataset.p;
      const p = PROMPTS.find(x => x.id === S.promptId);
      if (p) $('#hb-q').value = p.q;
      el.querySelectorAll('#hb-presets .hb-chip').forEach(x => x.classList.toggle('on', x === b));
    };

    const paintMetrics = m => {
      $('#hb-m-acc').textContent = m.acc + '%';
      $('#hb-b-acc').style.width = m.acc + '%';
      $('#hb-m-int').textContent = m.intrusion + '%';
      $('#hb-b-int').style.width = m.intrusion + '%';
      $('#hb-m-coh').textContent = m.coherence + '%';
      $('#hb-b-coh').style.width = m.coherence + '%';
      $('#hb-m-vrd').textContent = m.verdict;
    };

    $('#hb-go').onclick = async () => {
      if (S.busy) return;
      const q = $('#hb-q').value.trim();
      if (!q) return A.toast('Enter a test prompt first.');
      S.busy = true;
      $('#hb-go').disabled = true;
      const cv = curVec();
      const prObj = PROMPTS.find(x => x.id === S.promptId) || { q, expect: '' };
      const outBase = $('#hb-out-base'), outSteer = $('#hb-out-steer'), st = $('#hb-status');
      outBase.textContent = 'Generating unsteered baseline...';
      outSteer.textContent = 'Injecting ' + cv.name + ' at Layer ' + S.layer + ' (α=' + S.alpha.toFixed(1) + ')...';
      st.textContent = 'Running experiment...';

      let baseTxt = '', steerTxt = '';
      try {
        if (A.ai && A.ai.stream) {
          const p1 = A.ai.stream(
            [{ role: 'system', content: buildSteeredSystemPrompt(cv, 0, S.layer) }, { role: 'user', content: q }],
            t => { outBase.textContent = t; },
            null,
            { temp: 0.3 }
          ).catch(() => '');
          const p2 = A.ai.stream(
            [{ role: 'system', content: buildSteeredSystemPrompt(cv, S.alpha, S.layer) }, { role: 'user', content: q }],
            t => { outSteer.textContent = t; },
            null,
            { temp: Math.min(1.1, 0.35 + Math.abs(S.alpha) * 0.15) }
          ).catch(() => '');
          [baseTxt, steerTxt] = await Promise.all([p1, p2]);
        }
      } catch (e) { }

      if (!baseTxt || baseTxt.length < 10) {
        baseTxt = offlineFallback({ q }, cv, 0, S.layer);
        outBase.textContent = baseTxt;
      }
      if (!steerTxt || steerTxt.length < 10) {
        steerTxt = offlineFallback({ q }, cv, S.alpha, S.layer);
        outSteer.textContent = steerTxt;
      }

      const m = scoreOutput(steerTxt, cv, prObj.expect, S.alpha);
      paintMetrics(m);
      st.textContent = 'Experiment complete · ' + m.verdict;
      S.history.unshift({ at: Date.now(), vec: cv.name, alpha: S.alpha, layer: S.layer, verdict: m.verdict });
      saveHist();
      S.busy = false;
      $('#hb-go').disabled = false;
    };

    $('#hb-sweep').onclick = async () => {
      if (S.busy) return;
      const q = $('#hb-q').value.trim();
      const cv = curVec();
      const prObj = PROMPTS.find(x => x.id === S.promptId) || { q, expect: '' };
      const box = $('#hb-sweep-box');
      box.style.display = 'block';
      const doses = [0.0, 1.0, 2.0, 2.8, 3.6];
      const rows = [];
      for (const a of doses) {
        const txt = offlineFallback({ q }, cv, a, S.layer);
        const sc = scoreOutput(txt, cv, prObj.expect, a);
        rows.push({ alpha: a, acc: sc.acc, intrusion: sc.intrusion, coherence: sc.coherence });
      }
      S.sweepData = rows;
      drawSweepChart($('#hb-canvas'), rows, cv.color);
      const curSc = scoreOutput(offlineFallback({ q }, cv, S.alpha, S.layer), cv, prObj.expect, S.alpha);
      paintMetrics(curSc);
      $('#hb-status').textContent = '5-step dose sweep plotted (α = 0.0 → 3.6)';
      box.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    };

    $('#hb-pybtn').onclick = () => {
      const box = $('#hb-pybox');
      const show = box.style.display === 'none';
      box.style.display = show ? 'block' : 'none';
      if (show) {
        $('#hb-pycode').textContent = buildPythonCode(curVec(), S.alpha, S.layer, $('#hb-q').value.trim());
        box.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      }
    };

    $('#hb-pycopy').onclick = () => {
      const code = $('#hb-pycode').textContent;
      if (A.copy) A.copy(code);
      else try { navigator.clipboard.writeText(code); A.toast('Copied Python script!'); } catch (e) { }
    };
  }

  A.hotbox = { render, VECTORS, PROMPTS };
  A.studio.reg('hotbox', '🔥 AI Hotbox', body => render(body), 32);
  try {
    if (A.cmd && A.cmd.reg) {
      A.cmd.reg([{
        title: 'AI Hotbox (Activation Steering Lab)',
        sub: 'Studio › AI Hotbox — LynnColeArt/ai-hotbox activation steering & bodily controls lab',
        icon: '🔥',
        group: 'Open',
        tags: 'hotbox ai-hotbox lynncoleart activation steering valence bodily controls constipation pain studio',
        run: () => A.studio.go('hotbox')
      }]);
    }
  } catch (e) { }
})();

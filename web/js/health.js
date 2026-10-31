// First aid (a section of the Prepare tab): built-in quick steps that need no library, plus one tap to the emergency-medicine references.
// Reference only - never a replacement for a professional.
(() => {
  const root = document.createElement('div'); root.style.cssText = 'display:flex;flex-direction:column;flex:1;min-height:0';
  const $h = id => root.querySelector('#' + id);
  const TOPICS = [
    ['CPR', 'cardiopulmonary resuscitation'], ['Choking', 'choking foreign body airway obstruction'], ['Severe bleeding', 'hemorrhage control tourniquet'], ['Burns', 'burn injury'],
    ['Stroke', 'stroke'], ['Heart attack', 'myocardial infarction'], ['Allergic reaction', 'anaphylaxis'], ['Poisoning / overdose', 'overdose poisoning'],
    ['Seizure', 'seizure'], ['Broken bone', 'fracture'], ['Heat stroke', 'heat stroke'], ['Hypothermia', 'hypothermia'],
    ['Drowning', 'drowning'], ['Head injury', 'head injury'], ['Sprain / strain', 'sprain'], ['Diabetic emergency', 'hypoglycemia'], ['Asthma attack', 'asthma exacerbation'], ['Snake / animal bite', 'snake bite']
  ];
  /* basic, widely taught first-aid steps (Red Cross / AHA style). Built in so they work even with no library at all. */
  const QUICK = [
    ['Adult not breathing / no pulse (CPR)', ['Check the scene is safe, tap and shout. If no response and no normal breathing, call emergency services (or tell someone to) and ask for an AED.', 'Push hard and fast in the centre of the chest: about 5 cm (2 in) deep, 100-120 pushes a minute, letting the chest rise fully each time. Hands-only CPR is fine if you are untrained.', 'Use the AED as soon as it arrives and follow its voice prompts. Keep going until help takes over or the person moves.']],
    ['Choking adult (cannot cough, speak or breathe)', ['Ask "Are you choking?" If they cannot answer, act.', 'Give 5 firm back blows between the shoulder blades with the heel of your hand.', 'Then 5 abdominal thrusts (stand behind, fist above the navel, quick inward and upward). Alternate until it clears or they collapse - then start CPR and call emergency services.']],
    ['Severe bleeding', ['Press hard directly on the wound with a clean cloth. Do not remove soaked cloth - add more on top and keep pressing.', 'For a limb with life-threatening bleeding that will not stop: pack the wound and press, or apply a tourniquet 5-8 cm (2-3 in) above the wound, tighten until bleeding stops, and write down the time.', 'Lay the person down, keep them warm, raise legs if no head or leg injury. Get emergency help.']],
    ['Burns', ['Cool the burn under cool (not ice-cold) running water for 20 minutes. Remove rings and tight items before swelling starts.', 'Cover loosely with a clean non-fluffy dressing or cling film. No ice, butter or creams.', 'Get medical help for burns larger than the person\'s palm, on the face, hands, feet or genitals, deep or white/charred burns, or chemical and electrical burns.']],
    ['Stroke (FAST)', ['Face drooping? Arm weak? Speech slurred? Time to call emergency services - note when symptoms began.', 'Do not give food, drink or aspirin. Keep them calm and sitting or lying with head slightly raised.']],
    ['Heart attack signs', ['Chest pressure or pain, spreading to arm, jaw or back; breathlessness, sweating, nausea. Call emergency services.', 'Sit them down and keep them calm. If not allergic and advised by the dispatcher, chew one adult aspirin (300 mg).']],
    ['Severe allergic reaction (anaphylaxis)', ['Swelling of face or throat, trouble breathing, widespread hives, faintness. Call emergency services.', 'Use an epinephrine auto-injector in the outer thigh straight away if they have one; note the time. Lay them flat with legs raised (sit up if breathing is hard). A second dose can be given after 5-15 minutes if no improvement.']],
    ['Hypothermia', ['Move out of wind and wet. Remove wet clothing, wrap in dry layers and blankets, insulate from the ground, cover the head.', 'Give warm sweet drinks only if fully awake. Warm the chest and core first; handle gently. Seek medical help; start CPR if no pulse or breathing.']],
    ['Heat stroke', ['Confusion, hot skin, very high temperature. Call emergency services.', 'Move to shade or a cool place, remove extra clothing, cool the body quickly with wet cloths, fanning, cold packs at neck, armpits and groin.']],
    ['Broken bone / sprain', ['Keep the area still and supported; do not straighten a deformed limb. Control any bleeding.', 'Rest, ice wrapped in cloth for 20 minutes at a time, compress with a bandage, elevate. Seek care for a deformed limb, numbness or severe pain.']],
    ['Shock (pale, clammy, weak, faint)', ['Lay them down, raise the legs about 30 cm (12 in) unless injured, loosen tight clothing, keep warm, give nothing to eat or drink, and get emergency help.']]
  ];

  root.innerHTML = '<div class="scroll pad" style="flex:1"><div class="disc"><b>Not medical advice.</b> This is reference material to help you understand what is going on. <b>In an emergency call your local emergency number now (911 / 999 / 112)</b> - do not wait on this screen.</div>' +
    '<h2>Emergency &amp; first aid</h2><div class="mute small">Quick steps below work with no library. Tap a situation to open the full emergency-medicine article.</div>' +
    '<div class="chips" id="htop" style="margin:8px 0 12px"></div>' +
    '<div class="card"><b>Do this now - quick steps</b><div id="hquick" style="margin-top:6px"></div></div>' +
    '<div class="card"><b>Ask the medical library</b><div class="small mute" style="margin:2px 0 6px">The answer is built only from the offline medical books, with sources shown.</div><div class="row"><input id="hq" type="text" placeholder="e.g. What are signs of dehydration in a child?"><button class="pri" id="hgo">Ask</button></div></div>' +
    '<div class="card"><b>Search the medical books</b><div class="row" style="margin-top:6px"><input id="hs" type="text" placeholder="Symptom, condition, drug..."><button class="ib" id="hsg">Search</button></div></div>' +
    '<div id="hnone" class="warn small" style="display:none">The medical books are not installed yet.</div></div>';
  $h('htop').innerHTML = TOPICS.map((t, i) => '<span class="chip" data-i="' + i + '">' + esc(t[0]) + '</span>').join('');
  $h('htop').onclick = e => { const c = e.target.closest('.chip'); if (c) A.lib.search(TOPICS[+c.dataset.i][1], 'Medical', /wikem/); };
  $h('hquick').innerHTML = QUICK.map(q => '<details style="margin:2px 0"><summary style="cursor:pointer;color:var(--text);font-weight:600">' + esc(q[0]) + '</summary><ol style="margin:4px 0 8px;padding-left:1.3em;font-size:13.5px">' + q[1].map(s => '<li>' + esc(s) + '</li>').join('') + '</ol></details>').join('');
  $h('hs').onkeydown = e => { if (e.key === 'Enter') $h('hsg').click(); };
  $h('hsg').onclick = () => { if ($h('hs').value.trim()) A.lib.search($h('hs').value, 'Medical'); };
  const ask = async () => {
    const q = $h('hq').value.trim(); if (!q) return; A.toast('Checking the medical library...', 2500);
    const r = await A.api('/api/lib/context', { q, only: ['Medical'], n: 4 });
    const sources = (r.sources || []).map(x => ({ title: x.title, text: x.text, kind: 'lib', url: x.url, where: x.book, category: 'Medical' }));
    A.chat.ask(q + '\n\n(Answer from the sources only. Give practical steps first, then when to seek urgent help.)', { sources, noLocal: true });
  };
  $h('hgo').onclick = ask; $h('hq').onkeydown = e => { if (e.key === 'Enter') ask(); };
  A.firstAid = { QUICK, mount(b) { b.innerHTML = ''; b.appendChild(root); A.lib.init().then(() => { $h('hnone').style.display = A.caps.lib ? 'none' : 'block'; }); } };
})();

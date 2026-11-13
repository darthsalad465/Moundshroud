// Prompt optimizer (Tools > ✨ Prompt optimizer): you say what you want in plain words and the local AI rewrites it into the
// prompt that works best for the engine that will do it: the picture model, the photo-edit model, the chat AI, the coding
// agent, video and music. Each target has its own rules (a picture model reads only about 60 words; the edit model wants
// one clear instruction; the agent wants the goal, the files and how to check it is done). Shorter, structured prompts
// also cost the small local models less memory and time. Runs on this PC (A.ai, private: never sent to Claude).
// A.promptOpt.optimize(target, text, {image}) -> {prompt, neg, why[], fallback}; used by the chat ("make me an image"),
// Studio > AI art (✨ Improve) and this page.
(() => {
  const esc = s => String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const toks = t => Math.max(1, Math.round(String(t || '').length / 4));      // about 4 characters per token
  const RULES = 'Reply with JSON only: {"prompt": "...", "negative": "...", "why": ["3 short reasons"]}. Never invent facts the user did not give, except visual detail for pictures. Keep the user\'s language for names and text that must appear.';
  const T = {
    image: { icon: '🖼️', name: 'Picture', for: 'Studio › AI art and pictures in the chat (SDXL Turbo)', ph: 'a fox in a snowy forest',
      sys: 'You turn a short idea into the best prompt for SDXL Turbo, an image model that reads only the first ~60 words. Write ONE comma-separated prompt of 35 to 60 words in this order: main subject with concrete details (age, clothing, material, colour, pose, expression), action, setting and background, lighting (e.g. golden hour, soft studio light, rim light), camera or medium (e.g. 85mm photo, shallow depth of field, oil painting, 3d render), mood, then 3 to 5 quality words (highly detailed, sharp focus, intricate, professional). Put the most important things first. No sentences, no "image of", no quotes. "negative" lists 8 to 14 things to avoid (blurry, low quality, extra fingers, deformed, text, watermark, ...).' },
    photo: { icon: '🪄', name: 'Photo edit (precise)', for: 'Studio › AI art › Edit a photo with the edit model (FLUX Kontext)', ph: 'make it look like winter', photo: true,
      sys: 'You write instructions for FLUX Kontext, a model that edits a photo exactly as told. Write ONE or two short imperative sentences: say exactly what to change, name the object by its look and position, give the new colour/material/style, and end with what must stay the same (e.g. "Keep the person\'s face, pose, framing and lighting unchanged."). For style changes, name the style precisely. "negative" is empty.' },
    redraw: { icon: '🎨', name: 'Photo redraw', for: 'Studio › AI art › Edit a photo with SDXL Turbo (redraws the whole picture)', ph: 'turn it into an anime scene', photo: true,
      sys: 'You write prompts for SDXL Turbo redrawing a photo (img2img). The model does not understand instructions, only a description of the RESULT. Look at the photo, then write ONE comma-separated description (35 to 60 words) of the finished picture with the change already made: the same subjects, layout and colours as the photo, plus the requested change, the style and quality words. "negative" lists 8 to 12 things to avoid.' },
    chat: { icon: '💬', name: 'Question for the AI', for: 'Chat', ph: 'explain how mortgages work',
      sys: 'You rewrite a question for a small local chat model so it answers well. Write a compact prompt with: the role to take (one line), the exact question, the context the user gave, the level of detail and audience, and the answer format (e.g. "5 bullet points, then a one-line summary"). Ask it to say when it is unsure. Under 90 words. "negative" is empty.' },
    code: { icon: '🤖', name: 'Task for the coding agent', for: 'Chat › Agent', ph: 'make a snake game',
      sys: 'You rewrite a request for a small local coding agent (it reads/writes files and runs commands in one folder). Write a prompt with these short labelled lines: Goal, Files (which to create or change; prefer one file), Requirements (3 to 6 concrete bullet points), Done when (how to check it works, e.g. "opens in a browser with no errors"), Do not (what to avoid). Under 140 words, plain words. "negative" is empty.' },
    research: { icon: '🔎', name: 'Research question', for: 'Browser search, News › Research, Ask my stuff', ph: 'is intermittent fasting healthy',
      sys: 'You turn a vague research wish into one precise question plus what a good answer must cover. Write: the precise question; 3 to 5 sub-questions; what evidence counts (studies, official sources, dates); the format (summary first, then points with sources). Under 100 words. "negative" is empty.' },
    writing: { icon: '✍️', name: 'Writing request', for: 'Chat, Office, Writing coach', ph: 'email to my landlord about the heater',
      sys: 'You turn a writing wish into a clear brief for a small chat model. Include: the kind of text, who reads it, the goal, the key points (from what the user said), the tone, the length, and what to avoid. Under 100 words. "negative" is empty.' },
    video: { icon: '🎬', name: 'Video clip', for: 'Studio › AI video (Wan 2.1, a few seconds)', ph: 'a cat jumping on a table',
      sys: 'You write prompts for Wan 2.1, a small text-to-video model making a 1 to 2 second clip. Write ONE description of 30 to 50 words: the subject and its look, ONE simple motion, the camera (static, slow pan, close-up), the setting, the lighting and the style. Avoid many actions or scene changes. "negative" lists 6 to 10 things to avoid.' },
    music: { icon: '🎵', name: 'Music', for: 'Studio › AI music (MusicGen)', ph: 'chill music for studying',
      sys: 'You write prompts for MusicGen, a model that makes short instrumental music from a description. Write ONE line of 15 to 30 words: genre, mood, tempo in BPM, the main instruments, the production style and the era. No lyrics, no artist names. "negative" is empty.' },
  };
  const KEYS = Object.keys(T);

  /* a model on this PC that can see, for the photo targets (the same choice Photos makes) */
  async function visionModel() {
    let ms = []; try { ms = ((await A.api('/api/models')).models || []).filter(m => !m.cloud).map(m => m.name); } catch (e) { }
    const saved = ls.get('ph_model', ''); if (saved && ms.includes(saved)) return saved;
    for (const m of [A.ai.model()].concat(ms)) { if (!m || /cloud|claude|embed/i.test(m)) continue; try { if ((await A.api('/api/modelcaps?name=' + encodeURIComponent(m))).vision) return m; } catch (e) { } }
    return '';
  }
  /* if the AI cannot be reached, a plain rule-based prompt is still better than nothing */
  function fallback(target, text) {
    const t = String(text || '').trim();
    if (target === 'image') return { prompt: t + ', highly detailed, sharp focus, beautiful lighting, professional, intricate details', neg: 'blurry, low quality, deformed, extra fingers, bad anatomy, text, watermark, jpeg artifacts', why: ['The AI could not be reached, so quality words were added to your words.'], fallback: true };
    if (target === 'photo') return { prompt: t.replace(/[.!]*$/, '.') + ' Keep everything else in the photo exactly the same.', neg: '', why: ['The AI could not be reached, so a "keep the rest" line was added.'], fallback: true };
    if (target === 'redraw') return { prompt: t + ', highly detailed, sharp focus', neg: 'blurry, low quality, deformed', why: ['The AI could not be reached.'], fallback: true };
    return { prompt: t, neg: '', why: ['The AI could not be reached, so your words are unchanged.'], fallback: true };
  }
  async function optimize(target, text, o) {
    o = o || {}; const d = T[target] || T.chat; text = String(text || '').trim(); if (!text) throw new Error('Type what you want first.');
    let model = '';
    if (d.photo && o.image) model = await visionModel();
    const user = { role: 'user', content: 'The user wants: "' + text.slice(0, 2000) + '"' + (d.photo ? (o.image ? '\nThe photo is attached.' : '\n(No photo attached.)') : '') };
    if (d.photo && o.image && model) user.images = [o.image];
    try {
      const out = await A.ai.once([{ role: 'system', content: d.sys + '\n' + RULES }, user], Object.assign({ temp: .35, private: 'files' }, model ? { model } : {}));
      const j = A.ai.json(out) || {};
      let p = String(j.prompt || '').replace(/\s+/g, ' ').trim();
      if (p.length < 8) { const m = String(out || '').replace(/```[\s\S]*?```/g, ' ').trim(); p = m.length > 8 && m.length < 1500 ? m : ''; }
      if (!p) return fallback(target, text);
      if (target === 'image' || target === 'redraw') p = p.split(/\s+/).slice(0, 75).join(' ');       // the picture model ignores anything past ~77 tokens
      return { prompt: p, neg: String(j.negative || j.neg || '').replace(/\s+/g, ' ').trim().slice(0, 300), why: (Array.isArray(j.why) ? j.why : []).map(String).slice(0, 4), fallback: false };
    } catch (e) { return fallback(target, text); }
  }
  /* a target from the request's own words, so the page can preselect it */
  const guess = t => /\b(photo|picture|image|drawing|painting|wallpaper|logo|portrait)\b/i.test(t) ? 'image' : /\b(code|script|app|game|website|function|bug|program)\b/i.test(t) ? 'code' : /\b(song|music|beat|melody)\b/i.test(t) ? 'music' : /\b(video|clip|animation)\b/i.test(t) ? 'video' : /\b(email|letter|essay|post|story|write)\b/i.test(t) ? 'writing' : /\b(research|evidence|study|studies|is it true)\b/i.test(t) ? 'research' : 'chat';

  /* ---------- the page ---------- */
  function render(b) {
    let target = ls.get('po_target', 'image'), photo = null, last = null, busy = false;
    if (!T[target]) target = 'image';
    b.innerHTML = '<div class="scroll pad" style="flex:1"><div style="max-width:880px">' +
      '<h2 style="margin:0 0 4px">✨ Prompt optimizer</h2><div class="small mute" style="margin-bottom:12px">Say what you want in your own words. The AI on this PC rewrites it into the prompt that works best for the tool that will do it. Each tool reads prompts differently: the picture model reads only about 60 words, the edit model wants one clear instruction, the coding agent wants the goal and how to check it is done. A good prompt is usually also shorter, which makes the small local models faster.</div>' +
      '<div class="poT" id="pot">' + KEYS.map(k => '<button class="poC" data-k="' + k + '"><span>' + T[k].icon + '</span><b>' + esc(T[k].name) + '</b><span class="small mute">' + esc(T[k].for) + '</span></button>').join('') + '</div>' +
      '<div class="card" style="margin-top:12px"><textarea id="poin" rows="3" style="width:100%" placeholder=""></textarea>' +
      '<div id="pophoto" class="row" style="gap:8px;align-items:center;margin-top:8px;display:none"><button class="ib" id="popick">📷 Choose the photo</button><img id="pothumb" style="height:48px;border-radius:6px;display:none"><span class="small mute">The AI looks at the photo so the instruction fits it.</span><input type="file" id="pofile" accept="image/*" style="display:none"></div>' +
      '<div class="row" style="gap:8px;margin-top:10px;align-items:center;flex-wrap:wrap"><button class="pri" id="pogo">✨ Optimize</button><span class="small mute" id="post"></span></div></div>' +
      '<div id="poout"></div>' +
      '<div class="card" style="margin-top:14px"><b>Automatic</b><div class="small mute" style="margin:4px 0 8px">Let Moundshroud optimize by itself, without opening this page.</div>' +
      '<label class="chk"><input type="checkbox" id="poautoimg"' + (ls.get('po_auto_image', '1') !== '0' ? ' checked' : '') + '> Pictures made from the chat (“make me an image of…”) get an optimized prompt</label><br>' +
      '<label class="chk"><input type="checkbox" id="poautoart"' + (ls.get('po_auto_art', '0') === '1' ? ' checked' : '') + '> Studio › AI art optimizes every prompt before drawing</label></div>' +
      '<div class="card small" style="margin-top:14px;line-height:1.6"><b>Tips for any prompt</b><ul style="margin:4px 0 0;padding-left:18px"><li>Say the goal first, then the details, then the format you want back.</li><li>Concrete beats clever: “a red 1960s Vespa” beats “a cool scooter”.</li><li>For pictures, the first words matter most: put the subject first.</li><li>For the coding agent: one file, one feature, and say how to check it works.</li><li>Long chats get slow and forgetful on small models: start a new chat for a new topic.</li></ul></div></div></div>';
    const $ = id => b.querySelector('#' + id);
    const pick = k => { target = k; ls.set('po_target', k); b.querySelectorAll('.poC').forEach(x => x.classList.toggle('on', x.dataset.k === k)); $('poin').placeholder = 'e.g. ' + T[k].ph; $('pophoto').style.display = T[k].photo ? '' : 'none'; };
    pick(target);
    $('pot').onclick = e => { const c = e.target.closest('[data-k]'); if (c) pick(c.dataset.k); };
    $('poautoimg').onchange = e => ls.set('po_auto_image', e.target.checked ? '1' : '0');
    $('poautoart').onchange = e => ls.set('po_auto_art', e.target.checked ? '1' : '0');
    $('popick').onclick = () => $('pofile').click();
    $('pofile').onchange = async () => { const f = $('pofile').files[0]; if (!f) return; photo = await small(f, 768); $('pothumb').src = 'data:image/jpeg;base64,' + photo; $('pothumb').style.display = ''; };
    $('poin').addEventListener('keydown', e => { e.stopPropagation(); if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) go(); });
    async function go() {
      if (busy) return; const text = $('poin').value.trim(); if (!text) { $('post').textContent = 'Type what you want first.'; return; }
      busy = true; $('pogo').disabled = true; $('post').textContent = 'The AI is writing the prompt…';
      const r = await optimize(target, text, { image: photo }); busy = false; $('pogo').disabled = false; $('post').textContent = '';
      last = Object.assign({ target, text }, r); show();
    }
    $('pogo').onclick = go;
    function show() {
      const r = last, d = T[r.target];
      $('poout').innerHTML = '<div class="card poR"><div class="row" style="gap:8px;align-items:baseline"><b style="flex:1">' + d.icon + ' Optimized for ' + esc(d.name) + '</b><span class="small mute">' + toks(r.text) + ' → ' + toks(r.prompt) + ' tokens</span></div>' +
        '<textarea id="poprompt" rows="4" style="width:100%;margin-top:6px">' + esc(r.prompt) + '</textarea>' +
        (r.neg ? '<div class="small" style="margin-top:6px"><b>Avoid (negative prompt):</b></div><textarea id="poneg" rows="2" style="width:100%">' + esc(r.neg) + '</textarea>' : '') +
        (r.why.length ? '<ul class="small mute" style="margin:6px 0 0;padding-left:18px">' + r.why.map(w => '<li>' + esc(w) + '</li>').join('') + '</ul>' : '') +
        '<div class="row" style="gap:6px;margin-top:10px;flex-wrap:wrap"><button class="pri" id="pouse">' + useLabel(r.target) + '</button><button class="ib" id="pocopy">📋 Copy</button><button class="ib" id="poagain">↻ Try again</button></div></div>';
      $('pocopy').onclick = () => A.copy($('poprompt').value);
      $('poagain').onclick = go;
      $('pouse').onclick = () => use(r.target, $('poprompt').value, $('poneg') ? $('poneg').value : '', photo);
    }
  }
  const useLabel = t => ({ image: '🖼️ Draw it', photo: '🪄 Edit the photo', redraw: '🎨 Redraw the photo', chat: '💬 Ask in Chat', code: '🤖 Send to the agent', research: '🔎 Ask in Chat', writing: '✍️ Ask in Chat', video: '🎬 Open AI video', music: '🎵 Open AI music' })[t] || 'Use it';
  function use(t, prompt, neg, photo) {
    if (t === 'image' || t === 'photo' || t === 'redraw') { if (window.AIArt) AIArt.pending = { prompt, neg, mode: t === 'image' ? 'make' : 'edit', engine: t === 'photo' ? 'kontext' : 'sd', photo }; if (A.studio && A.studio.go) A.studio.go('art'); return; }
    if (t === 'code') { if (A.agent) { A.agent.open(); setTimeout(() => { const i = document.getElementById('hin'); if (i) { i.value = prompt; i.focus(); } }, 600); } return; }
    if (t === 'video' || t === 'music') { A.copy(prompt); A.toast('Copied. Paste it into the ' + (t === 'video' ? 'AI video' : 'AI music') + ' box.'); if (A.studio && A.studio.go) A.studio.go(t === 'video' ? 'video' : 'aimusic'); return; }
    A.showTab('chat'); if (A.chat) A.chat.ask(prompt);
  }
  /* a photo as small base64 JPEG (for the AI to look at) */
  async function small(file, max) {
    const bm = await createImageBitmap(file), k = Math.min(1, max / Math.max(bm.width, bm.height)), c = document.createElement('canvas');
    c.width = Math.round(bm.width * k); c.height = Math.round(bm.height * k); c.getContext('2d').drawImage(bm, 0, 0, c.width, c.height);
    return c.toDataURL('image/jpeg', .85).split(',')[1];
  }

  A.promptOpt = { optimize, render, guess, TARGETS: T, tokens: toks, small };
  try { if (A.cmd && A.cmd.reg) A.cmd.reg({ title: 'Prompt optimizer', sub: 'Turn your words into the best prompt for pictures, edits, chat, the agent, video and music', icon: '✨', group: 'Go to', tags: 'prompt optimize improve better image prompt engineering', run: () => { if (A.tools) A.tools.go('opt'); } }); } catch (e) { }
})();

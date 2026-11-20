// Any model, anywhere: the list of every AI model on this PC (GET /api/models/all) and what each can do, shared by the
// Agent and model tools. Ollama language models keep their plain names as option values, so everything that
// already talks to them keeps working; every other model is "any:<catalog id>" and is run through A.anyModel.act().
//   talk     chat / agent (Ollama)            find     search a folder by meaning (Ollama embedding model)
//   import   copy a language or embedding file into Ollama, then use it
//   picture  make a picture       video   make a clip       speak   read text aloud
//   listen   speech to text (the 🎙 button)  music   make a music clip       info   what the model is and what uses it
(() => {
  if (typeof A === 'undefined') return;           // A is the app's global const, not a property of window
  const esc = s => String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const gb = n => n >= 1073741824 ? (n / 1073741824).toFixed(1) + ' GB' : Math.max(1, Math.round((n || 0) / 1048576)) + ' MB';
  let cache = null, at = 0, loading = null;

  const GROUPS = [
    ['talk', '💬 Chat and agent'], ['find', '🔎 Search by meaning'], ['picture', '🎨 Make pictures'], ['video', '🎬 Make video clips'],
    ['speak', '🗣 Speak text aloud'], ['listen', '🎙 Speech to text'], ['music', '🎵 Make music'],
    ['import', '📥 On this PC · bring into Ollama to use'], ['info', 'ℹ Part of another model or program']
  ];
  const ICON = { talk: '💬', find: '🔎', picture: '🎨', video: '🎬', speak: '🗣', listen: '🎙', music: '🎵', import: '📥', info: 'ℹ' };
  /* what the message box says while a model of each kind is chosen */
  const HINT = {
    find: 'Ask in your own words: it finds the closest passages in the folder…',
    picture: 'Describe the picture to make…', video: 'Describe the video clip to make (it takes several minutes)…',
    speak: 'Type the words to speak aloud…', listen: 'Press 🎙 and talk: it writes down what you say…',
    music: 'Describe the music to make…', import: 'Press Send to bring this model into Ollama, then use it…',
    info: 'This model works inside another model or program. Send shows what it is.'
  };

  async function list(fresh) {
    if (!fresh && cache && Date.now() - at < 60000) return cache;
    if (loading && !fresh) return loading;
    loading = A.api('/api/models/all' + (fresh ? '?fresh=1' : '')).then(r => { cache = r && r.models ? r : { models: [] }; at = Date.now(); loading = null; return cache; })
      .catch(() => { loading = null; return cache || { models: [] }; });
    return loading;
  }
  const valueOf = m => m.use === 'talk' ? m.ollama : 'any:' + m.id;
  const isAny = v => /^any:/.test(String(v || ''));
  function entry(v) {
    if (!cache) return null;
    const s = String(v || '');
    if (isAny(s)) return cache.models.find(m => m.id === s.slice(4)) || null;
    return cache.models.find(m => m.ollama === s) || null;
  }
  function label(m) {
    const base = m.use === 'talk' ? String(m.name).replace(/:latest$/, '') : m.name;
    return base + (m.size ? '  ·  ' + gb(m.size) : '') + (m.use === 'talk' && !m.tools ? '  ·  chat only' : '') + (m.use !== 'talk' && m.source && m.source !== 'Ollama' ? '  ·  ' + m.source : '');
  }
  /* the extra groups for a <select> that already lists Ollama's language models: every other model, by what it does */
  function extraOptionsHTML(models, opts) {
    const o = opts || {}, skip = new Set(o.skip || ['talk']);
    return GROUPS.filter(([use]) => !skip.has(use)).map(([use, title]) => {
      const ms = models.filter(m => m.use === use);
      if (!ms.length) return '';
      return '<optgroup label="' + esc(title) + '">' + ms.map(m => '<option value="' + esc(valueOf(m)) + '" title="' + esc((m.kindName || '') + (m.note ? ' · ' + m.note : '') + (m.path ? ' · ' + m.path : '')) + '">' + esc(ICON[use] + ' ' + label(m)) + '</option>').join('') + '</optgroup>';
    }).join('');
  }
  const hint = v => { const m = entry(v); return m && HINT[m.use] ? HINT[m.use] : ''; };

  /* the result of a run, as HTML for a message */
  function mediaHTML(made, caption) {
    if (!made) return '';
    const u = esc(made.url), cap = caption ? '<div class="small mute" style="margin-top:4px">' + esc(caption) + '</div>' : '';
    if (made.kind === 'image') return '<div class="am-made"><img src="' + u + '" alt="' + esc(caption || 'made picture') + '" style="max-width:100%;border-radius:10px">' + cap + '</div>';
    if (made.kind === 'video') return '<div class="am-made"><video src="' + u + '" controls loop style="max-width:100%;border-radius:10px"></video>' + cap + '</div>';
    if (made.kind === 'audio') return '<div class="am-made"><audio src="' + u + '" controls autoplay style="width:100%"></audio>' + cap + '</div>';
    return '';
  }
  function hitsHTML(r, q) {
    if (!r.hits || !r.hits.length) return '<div>Nothing close to that in ' + (r.files || 0) + ' files.</div>';
    return '<div class="am-hits"><div class="small mute">Closest to “' + esc(q) + '” in ' + r.files + ' files:</div>' + r.hits.map(h => '<div class="am-hit"><b>' + esc(h.rel) + ':' + h.line + '</b> <span class="mute small">' + Math.round(h.score * 100) + '%</span><div class="small mono">' + esc(h.preview) + '</div></div>').join('') + '</div>';
  }

  function hitsMD(r, q, name) {
    if (!r.hits || !r.hits.length) return 'Nothing close to “' + q + '” in ' + (r.files || 0) + ' files.';
    return '🔎 Closest to “' + q + '” in ' + r.files + ' files (' + name + '):\n\n' + r.hits.map(h => '- `' + h.rel + ':' + h.line + '` ' + Math.round(h.score * 100) + '% · ' + h.preview.replace(/[`*_]/g, '')).join('\n');
  }
  /* runs the chosen model on the text: { ok, html, imported, text } (html is safe to place in a message) */
  async function act(v, text, ctx) {
    const m = entry(v), c = ctx || {};
    if (!m) return { ok: false, html: 'That model is not in the list any more. Reopen the list to refresh it.' };
    const say = t => { try { c.onNote && c.onNote(t); } catch (e) { } };
    if (m.use === 'import') {
      const ok = await A.confirm('Bring ' + m.name + ' into Ollama?\n\nOllama copies the file (' + gb(m.size) + ') into its own store, so it takes that much more disk. After that it ' + (m.kind === 'embedding' ? 'can search folders by meaning.' : 'can chat and, if it supports tools, drive the agent.'));
      if (!ok) return { ok: false, html: 'Left as it is.' };
      say('📥 Copying ' + m.name + ' into Ollama…');
      const r = await A.api('/api/models/import', { id: m.id }).catch(e => ({ ok: false, error: e.message }));
      if (!r || !r.ok) return { ok: false, html: esc((r && r.error) || 'Ollama could not take it.') };
      await list(true);
      return { ok: true, imported: r.name, use: r.use, html: '📥 <b>' + esc(m.name) + '</b> is in Ollama now as <b>' + esc(r.name) + '</b>.', md: '📥 **' + m.name + '** is in Ollama now as **' + r.name + '**' + (r.use === 'find' ? ': choose it to search a folder by meaning.' : ' and is chosen: ask it anything.') };
    }
    if (m.use === 'info') return { ok: true, md: 'ℹ **' + m.name + '** is ' + (/^[aeiou]/i.test(m.kindName || '') ? 'an ' : 'a ') + (m.kindName || 'model') + ' (' + (m.format || '') + ', ' + gb(m.size) + ', ' + (m.source || '') + ').\n\n' + (m.note || '') + (m.path ? '\n\n`' + m.path + '`' : ''), html: 'ℹ <b>' + esc(m.name) + '</b> is ' + esc(/^[aeiou]/i.test(m.kindName || '') ? 'an ' : 'a ') + esc(m.kindName || 'model') + ' (' + esc(m.format || '') + ', ' + gb(m.size) + ', ' + esc(m.source || '') + ').<br>' + esc(m.note || '') + (m.path ? '<div class="small mute mono" style="word-break:break-all">' + esc(m.path) + '</div>' : '') };
    if (m.use === 'listen') return { ok: true, listen: m.id, md: '🎙 Press the microphone button and talk: **' + m.name + '** writes it down.', html: '🎙 Press the microphone button and talk: <b>' + esc(m.name) + '</b> writes it down.' };
    if (m.use === 'find') {
      if (!c.dir) return { ok: false, html: 'Choose a folder first: search by meaning looks through one folder.', md: 'Choose a folder first: search by meaning looks through one folder.' };
      say('🔎 Reading the folder with ' + m.name + '…');
      const r = await A.api('/api/models/find', { id: m.id, q: text, dir: c.dir }).catch(e => ({ ok: false, error: e.message }));
      return r && r.ok ? { ok: true, html: hitsHTML(r, text), md: hitsMD(r, text, m.name) } : { ok: false, html: esc((r && r.error) || 'The search did not finish.'), md: '⚠️ ' + ((r && r.error) || 'The search did not finish.') };
    }
    say({ picture: '🎨 Making the picture with ', video: '🎬 Making the clip with ', speak: '🗣 Speaking with ', music: '🎵 Making the music with ' }[m.use] + m.name + '…');
    const r = await A.api('/api/models/run', { id: m.id, prompt: text, dir: c.dir || '' }).catch(e => ({ ok: false, error: e.message }));
    if (!r || !r.ok) return { ok: false, html: esc((r && r.error) || 'The model could not finish.'), md: '⚠️ ' + ((r && r.error) || 'The model could not finish.') };
    const cap = m.name + (r.copied ? ' · saved as ' + r.copied : '');
    return { ok: true, made: r.made, caption: cap, html: mediaHTML(r.made, cap), md: { picture: '🎨 Made with **', video: '🎬 Made with **', speak: '🗣 Spoken with **', music: '🎵 Made with **' }[m.use] + m.name + '**' + (r.copied ? ' · saved as `' + r.copied + '`' : '') };
  }

  A.anyModel = { list, entry, isAny, valueOf, label, extraOptionsHTML, hint, act, mediaHTML, GROUPS, ICON };
})();

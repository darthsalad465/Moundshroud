// The phone page (served by lib/remote.js, only when Phone access is on). Chat with a model on the PC, make pictures,
// talk to the coding agent (approve or refuse its commands) and see routine results. Chat history stays on this phone.
(() => {
  const $ = id => document.getElementById(id);
  const esc = s => String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const md = t => String(t || '').split(/```/).map((p, i) => i % 2 ? '<pre>' + esc(p.replace(/^[\w-]*\n/, '')) + '</pre>' : esc(p).replace(/\*\*([^*]+)\*\*/g, '<b>$1</b>').replace(/`([^`]+)`/g, '<code>$1</code>').replace(/\n/g, '<br>')).join('');
  const store = { get: (k, d) => { try { return JSON.parse(localStorage.getItem(k)) ?? d; } catch (e) { return d; } }, set: (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) { } } };
  async function api(p, body, raw) {
    const r = await fetch('/r' + p, { method: body ? 'POST' : 'GET', headers: Object.assign({ 'X-MS': '1' }, body ? { 'Content-Type': 'application/json' } : {}), body: body ? JSON.stringify(body) : undefined, credentials: 'same-origin' });
    if (r.status === 401 && p !== '/login') { showLock(); throw new Error('locked'); }
    if (raw) return r;
    const j = await r.json().catch(() => ({})); if (!r.ok && !j.error) j.error = 'Error ' + r.status; return j;
  }

  /* ---------- lock ---------- */
  function showLock() { $('app').hidden = true; $('lock').hidden = false; $('pin').focus(); }
  async function unlock() {
    $('lockmsg').textContent = ''; const r = await api('/login', { pin: $('pin').value.trim() });
    if (!r.ok) { $('lockmsg').textContent = r.error || 'Wrong PIN.'; return; }
    $('pin').value = ''; start();
  }
  $('unlock').onclick = unlock; $('pin').onkeydown = e => { if (e.key === 'Enter') unlock(); };
  $('lockbtn').onclick = async () => { try { await api('/logout', {}); } catch (e) { } showLock(); };

  /* ---------- tabs ---------- */
  let tab = 'chat';
  document.querySelector('nav').onclick = e => { const b = e.target.closest('[data-tab]'); if (!b) return; tab = b.dataset.tab; document.querySelectorAll('nav button').forEach(x => x.classList.toggle('on', x === b)); ['chat', 'agent', 'routines'].forEach(t => { $('t-' + t).hidden = t !== tab; }); if (tab === 'routines') routines(); if (tab === 'agent') { aseq = 0; $('amsgs').innerHTML = ''; atick(); } };
  const grow = el => { el.style.height = 'auto'; el.style.height = Math.min(140, el.scrollHeight) + 'px'; };

  /* ---------- chat (with pictures) ---------- */
  let chat = store.get('ms_chat', []), busy = false;
  const IMG = /^\s*(?:please\s+)?(?:can|could|would)?\s*(?:you\s+)?(?:please\s+)?(?:make|create|draw|generate|paint|render|design|give)\s+(?:me\s+)?(?:an?\s+|another\s+)?(?:(?:highly|very|really)\s+)?(?:(?:detailed|realistic|photorealistic|beautiful|cool|cute|epic|hd|4k)\s+)*(?:image|picture|pic|photo|drawing|painting|illustration|artwork|art|wallpaper|portrait|logo)s?\b[\s,:]*(?:of|showing|with|about)?\s*(.+?)[\s.!?]*$/i;
  const DRAW = /^\s*(?:\/imagine|draw)\s+(?:me\s+)?(.+?)[\s.!?]*$/i;
  function drawChat() {
    $('msgs').innerHTML = chat.map(m => '<div class="m ' + (m.role === 'user' ? 'u' : 'a') + '">' + (m.role === 'user' ? esc(m.content) : md(m.content)) + (m.img ? '<img src="' + esc(m.img) + '" alt="">' : '') + '</div>').join('') || '<div class="note">Chat with the AI on your PC. Say “make me an image of…” for a picture.</div>';
    $('msgs').scrollTop = $('msgs').scrollHeight;
  }
  const keep = () => store.set('ms_chat', chat.slice(-60).map(m => ({ role: m.role, content: m.content })));
  async function streamChat(messages, onText, temp) {
    const r = await api('/chat', { model: $('model').value, messages, temp }, true);
    if (!r.ok) { const j = await r.json().catch(() => ({})); throw new Error(j.error || 'The PC did not answer.'); }
    const rd = r.body.getReader(), dec = new TextDecoder(); let buf = '', all = '';
    for (; ;) { const { value, done } = await rd.read(); if (done) break; buf += dec.decode(value, { stream: true }); let i; while ((i = buf.indexOf('\n')) >= 0) { const ln = buf.slice(0, i).trim(); buf = buf.slice(i + 1); if (!ln) continue; try { const j = JSON.parse(ln); if (j.error) throw new Error(j.error); if (j.message && j.message.content) { all += j.message.content; onText && onText(all); } } catch (e) { if (e.message && !/JSON/.test(e.message)) throw e; } } }
    return all;
  }
  async function picture(subject, am) {
    am.content = '🎨 Writing a detailed prompt…'; drawChat();
    let prompt = subject, neg = '';
    try {
      const t = await streamChat([{ role: 'system', content: 'Turn the idea into the best prompt for SDXL Turbo (reads ~60 words). Reply with JSON only: {"prompt":"35-60 comma-separated words: subject with concrete details, action, setting, lighting, camera or medium, mood, 3-5 quality words","negative":"8-12 things to avoid"}' }, { role: 'user', content: subject }], null, .35);
      const j = JSON.parse((t.match(/\{[\s\S]*\}/) || ['{}'])[0]); if (j.prompt) { prompt = String(j.prompt); neg = String(j.negative || ''); }
    } catch (e) { prompt = subject + ', highly detailed, sharp focus, beautiful lighting'; }
    const t0 = Date.now(), tk = setInterval(() => { am.content = '🎨 Drawing on your PC… ' + Math.round((Date.now() - t0) / 1000) + 's'; drawChat(); }, 1000);
    try {
      const r = await api('/art/sd', { prompt, neg, w: 512, h: 512, steps: 4 }, true);
      if (!r.ok) { const j = await r.json().catch(() => ({})); throw new Error(j.error || 'The picture could not be made.'); }
      am.img = URL.createObjectURL(await r.blob()); am.content = 'Here is your picture (' + Math.round((Date.now() - t0) / 1000) + 's). Press and hold it to save.\n\n*Prompt:* ' + prompt;
    } finally { clearInterval(tk); }
  }
  $('cform').onsubmit = async e => {
    e.preventDefault(); if (busy) return; const text = $('cin').value.trim(); if (!text) return;
    $('cin').value = ''; grow($('cin')); busy = true;
    chat.push({ role: 'user', content: text }); const am = { role: 'assistant', content: '…' }; chat.push(am); drawChat();
    try {
      const m = IMG.exec(text) || DRAW.exec(text);
      if (m && m[1]) await picture(m[1], am);
      else await streamChat([{ role: 'system', content: 'You are Moundshroud, a helpful assistant running on the user\'s own PC. The user is on their phone: keep answers short and clear.' }].concat(chat.slice(-13, -1).filter(x => !x.img).map(x => ({ role: x.role, content: x.content }))), t => { am.content = t; drawChat(); });
    } catch (err) { if (err.message !== 'locked') am.content = '⚠️ ' + err.message; }
    busy = false; drawChat(); keep();
  };
  $('cin').oninput = () => grow($('cin'));
  $('newchat').onclick = () => { chat = []; keep(); drawChat(); };
  $('model').onchange = () => store.set('ms_model', $('model').value);

  /* ---------- the agent ---------- */
  let aseq = 0, H = null, view = 'live';
  const arg = (n, i) => { i = i || {}; return n === 'Bash' ? i.command || '' : i.file_path || i.pattern || JSON.stringify(i).slice(0, 120); };
  function adraw(e, box, ro) {
    const d = document.createElement('div');
    if (e.kind === 'user') { d.className = 'm u'; d.textContent = e.text; }
    else if (e.kind === 'text') { d.className = 'm a'; d.innerHTML = md(e.text); }
    else if (e.kind === 'tool') { d.className = 'tool'; d.dataset.tool = e.toolId; d.innerHTML = '<b>' + esc(e.name) + '</b>(' + esc(String(arg(e.name, e.input)).slice(0, 140)) + ')'; }
    else if (e.kind === 'result') { const t = [...box.querySelectorAll('[data-tool]')].reverse().find(x => x.dataset.tool === String(e.toolId)); if (t) t.classList.add(e.isError ? 'err' : 'ok'); return; }
    else if (e.kind === 'ask') { d.className = 'ask'; d.dataset.ask = e.id; d.innerHTML = '<b>✋ Allow ' + esc(e.tool) + '?</b><pre>' + esc(arg(e.tool, e.input)) + '</pre>' + (ro ? '<div class="mute small" data-msg>Waiting.</div>' : '<div class="row"><button class="pri" data-no="' + esc(e.id) + '">Refuse</button><button data-yes="' + esc(e.id) + '">Allow once</button></div><div class="mute small" data-msg></div>'); }
    else if (e.kind === 'answer') { const c = box.querySelector('[data-ask="' + String(e.id).replace(/"/g, '') + '"]'); if (c) { c.querySelectorAll('button').forEach(b => b.remove()); const m = c.querySelector('[data-msg]'); if (m) m.textContent = e.allow ? '✅ Allowed' : '🛑 Refused'; } return; }
    else if (e.kind === 'started') { d.className = 'note'; d.textContent = (e.resumed ? 'Picked up again' : 'Session started') + ' · ' + String(e.model || '').replace(/:latest$/, ''); }
    else if (e.kind === 'stopped') { d.className = 'note'; d.textContent = 'Stopped.'; }
    else if (e.kind === 'error' || (e.kind === 'done' && !e.ok && e.text)) { d.className = 'note bad'; d.textContent = e.text; }
    else return;
    box.appendChild(d);
  }
  async function atick() {
    if (tab !== 'agent' || view !== 'live') return;
    let s; try { s = await api('/harness/state?since=' + aseq); } catch (e) { return; }
    if (!s || s.seq == null) return;
    if (s.seq < aseq) { aseq = 0; $('amsgs').innerHTML = ''; return atick(); }
    const box = $('amsgs'), stick = box.scrollHeight - box.scrollTop - box.clientHeight < 120;
    (s.events || []).forEach(e => adraw(e, box, false)); aseq = s.seq; H = s;
    let sp = box.querySelector('.spin'); const work = s.running && (s.busy || s.preparing) && !(s.pending || []).length;
    if (s.live) { let l = box.querySelector('[data-live]'); if (!l) { l = document.createElement('div'); l.className = 'm a'; l.dataset.live = 1; } box.appendChild(l); l.innerHTML = md(s.live); } else { const l = box.querySelector('[data-live]'); if (l) l.remove(); }
    if (work) { if (!sp) { sp = document.createElement('div'); sp.className = 'spin'; } box.appendChild(sp); sp.textContent = '✻ ' + (s.preparing ? 'Getting the model ready…' : s.thinking ? 'Thinking…' : 'Working…'); } else if (sp) sp.remove();
    if (!box.children.length) box.innerHTML = '<div class="note">' + (s.sessionId ? 'Type to continue “' + esc(s.title || 'this session') + '”.' : 'No session yet. Type below to start one on your PC.') + '</div>';
    $('astat').textContent = s.running ? ((s.pending || []).length ? 'Needs your answer' : s.busy ? 'Working' : 'Ready') : s.sessionId ? 'Not running' : '';
    $('astop').hidden = !s.running; if (stick) box.scrollTop = box.scrollHeight;
  }
  $('amsgs').onclick = async e => {
    const b = e.target.closest('[data-yes],[data-no]'); if (!b) return; b.parentElement.querySelectorAll('button').forEach(x => x.disabled = true);
    await api('/harness/answer', { id: b.dataset.yes || b.dataset.no, allow: !!b.dataset.yes }); atick();
  };
  $('aform').onsubmit = async e => {
    e.preventDefault(); const t = $('ain').value.trim(); if (!t) return;
    if (view === 'rec') { const x = await api('/harness/show', { id: recId }); if (!x.ok) return alert(x.error || 'Could not open it.'); view = 'live'; aseq = 0; $('amsgs').innerHTML = ''; await atick(); const st = await api('/harness/start', { resume: recId }); if (!st.ok) return alert(st.error || 'Could not start the agent.'); }
    else if (!H || !H.running) { const st = await api('/harness/start', { resume: H && H.sessionId ? H.sessionId : undefined }); if (!st.ok) return alert(st.error || 'Could not start the agent.'); }
    const r = await api('/harness/send', { text: t }); if (!r.ok) return alert(r.error || 'Not sent.');
    $('ain').value = ''; grow($('ain')); atick();
  };
  $('ain').oninput = () => grow($('ain'));
  $('astop').onclick = async () => { await api('/harness/stop', {}); atick(); };
  $('anew').onclick = async () => { if (H && H.busy && !confirm('The agent is working. Stop it and start a new session?')) return; await api('/harness/clear', {}); view = 'live'; aseq = 0; $('amsgs').innerHTML = ''; $('sess').hidden = true; atick(); };
  let recId = '';
  $('alist').onclick = async () => {
    const s = $('sess'); if (!s.hidden) { s.hidden = true; return; }
    const r = await api('/harness/sessions'); s.hidden = false;
    s.innerHTML = (r.sessions || []).slice(0, 30).map(x => '<div class="srow" data-id="' + esc(x.id) + '"><b>' + (x.routine ? '⏱ ' : '') + esc(String(x.title || 'Untitled').replace(/[*`#]/g, '')) + '</b><span class="mute small">' + esc(new Date(x.at).toLocaleString()) + '</span></div>').join('') || '<div class="note">No sessions yet.</div>';
  };
  $('sess').onclick = async e => {
    const r = e.target.closest('[data-id]'); if (!r) return; $('sess').hidden = true;
    if (H && r.dataset.id === H.sessionId) { view = 'live'; aseq = 0; $('amsgs').innerHTML = ''; return atick(); }
    const x = await api('/harness/record?id=' + encodeURIComponent(r.dataset.id)); if (!x.ok) return alert(x.error);
    view = 'rec'; recId = r.dataset.id; const box = $('amsgs'); box.innerHTML = '<div class="note">Saved session. Type below to pick it up again.</div>'; (x.record.events || []).forEach(ev => adraw(ev, box, true)); box.scrollTop = box.scrollHeight;
  };

  /* ---------- routines ---------- */
  async function routines() {
    const r = await api('/routines'), b = $('rbody');
    b.innerHTML = (r.running ? '<div class="card new">⏱ <b>' + esc(r.running.name) + '</b> is running now.</div>' : '') +
      '<h3>Results</h3>' + ((r.runs || []).slice(0, 15).map(x => '<div class="card' + (x.seen ? '' : ' new') + '"><b>' + (x.skipped ? '⏭' : x.ok ? '✅' : '⚠️') + ' ' + esc(x.name) + '</b><div class="mute small">' + esc(new Date(x.at).toLocaleString()) + '</div><div>' + md(x.summary || '') + '</div></div>').join('') || '<div class="mute">Nothing yet.</div>') +
      '<h3>Your routines</h3>' + ((r.routines || []).map(x => '<div class="card"><b>' + esc(x.name) + '</b><div class="mute small">' + esc(x.when) + (x.on ? '' : ' · off') + '</div><button data-run="' + esc(x.id) + '"' + (r.running ? ' disabled' : '') + '>▶ Run now</button></div>').join('') || '<div class="mute">None yet. Make them on the PC: Chat › Agent › Routines.</div>');
    if (r.unread) api('/routines/seen', {}).then(() => { $('rbadge').hidden = true; });
  }
  $('rbody').onclick = async e => { const b = e.target.closest('[data-run]'); if (!b) return; b.disabled = true; const r = await api('/routines/run', { id: b.dataset.run }); if (!r.ok) alert(r.error || 'Could not start it.'); setTimeout(routines, 800); };

  /* ---------- start ---------- */
  async function start() {
    let s; try { s = await api('/status'); } catch (e) { return; }
    if (!s.ok) return showLock();
    $('lock').hidden = true; $('app').hidden = false;
    const ms = s.models || [], def = s.defaultModel || '', saved = store.get('ms_model', '');
    const want = (def && ms.includes(def)) ? def : (ms.includes(saved) ? saved : (ms[0] || ''));
    $('model').innerHTML = ms.map(m => '<option value="' + esc(m) + '"' + (m === want ? ' selected' : '') + '>' + esc(m) + (def && m === def ? ' · default' : '') + '</option>').join('') || '<option value="">No models on the PC</option>';
    $('hstat').textContent = s.agent.running ? '🤖 ' + (s.agent.busy ? 'agent working' : 'agent ready') : '';
    $('rbadge').hidden = !s.routines.unread; $('rbadge').textContent = s.routines.unread || '';
    drawChat();
  }
  setInterval(() => { if (!$('app').hidden && tab === 'agent') atick(); }, 1500);
  start();
})();

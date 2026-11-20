// Shared notes/sketchpad and AI-helper boxes for the Cyber playgrounds
// (🧪 Terminal playground and 💻 Coding › 🧪 Code playground).
// Notes are plain text, saved in this browser under 'cpad_<key>' as you type.
// The AI helper streams from the same local model as the rest of the app and
// gets a short description of what is on screen when you ask.
(() => {
  if (typeof window === 'undefined' || typeof A === 'undefined') return;
  const esc = t => String(t == null ? '' : t).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const KEY = 'cpad_';
  const state = {};
  const S = id => (state[id] = state[id] || { log: [], history: [], ctl: null });
  const fmt = t => String(t || '').split(/```[^\n`]*\n?([\s\S]*?)(?:```|$)/).map((p, i) => i % 2
    ? '<pre class="cpad-pre">' + esc(p.replace(/\n$/, '')) + '</pre>'
    : esc(p).replace(/`([^`\n]+)`/g, '<code>$1</code>').replace(/\*\*([^*\n]+)\*\*/g, '<b>$1</b>').replace(/\n/g, '<br>')).join('');

  const CSS = '.cpad-card{border:1px solid var(--line);background:var(--panel2);border-radius:10px;padding:9px 10px;min-width:0}' +
    '.cpad-h{display:flex;gap:6px;align-items:center;margin-bottom:6px}.cpad-h b{font-size:12.5px}.cpad-sp{flex:1}' +
    '.cpad-t{font-size:11px;color:var(--mute);line-height:1.4}' +
    '.cpad-ta{width:100%;box-sizing:border-box;min-height:88px;resize:vertical;font:12px/1.55 Consolas,"Cascadia Mono",monospace;padding:7px 8px;border-radius:8px;border:1px solid var(--line);background:var(--bg,#05070b);color:inherit}' +
    '.cpad-log{max-height:210px;overflow:auto;font-size:12px;line-height:1.5;margin-bottom:6px}' +
    '.cpad-msg{margin:0 0 6px;padding:5px 8px;border-radius:8px;overflow-wrap:anywhere}' +
    '.cpad-msg.you{background:rgba(90,160,255,.12);border:1px solid rgba(90,160,255,.25);white-space:pre-wrap}' +
    '.cpad-msg.bot{background:rgba(255,255,255,.03);border:1px solid var(--line)}' +
    '.cpad-msg code{font-family:Consolas,monospace;background:rgba(255,255,255,.07);padding:0 3px;border-radius:3px}' +
    '.cpad-pre{font:12px/1.5 Consolas,"Cascadia Mono",monospace;white-space:pre-wrap;word-break:break-word;background:var(--bg,#05070b);border:1px solid var(--line);border-radius:6px;padding:6px 8px;margin:4px 0;overflow-x:auto}' +
    '.cpad-row{display:flex;gap:6px;align-items:center}.cpad-row input{flex:1;min-width:0;font-size:12px}';
  function style() {
    if (document.getElementById('cpadcss')) return;
    const s = document.createElement('style');
    s.id = 'cpadcss';
    s.textContent = CSS;
    document.head.appendChild(s);
  }

  function notesHTML(id, opts) {
    opts = opts || {};
    style();
    return '<div class="cpad-card">' +
      '<div class="cpad-h"><b>' + (opts.title || '📝 Notes &amp; sketchpad') + '</b><span class="cpad-t">saved on this PC</span><span class="cpad-sp"></span>' +
      '<button class="ib" type="button" data-cpad-clear="' + esc(id) + '" style="font-size:11px;padding:2px 7px">Clear</button></div>' +
      '<textarea id="' + esc(id) + '" class="cpad-ta" rows="' + (opts.rows || 5) + '" spellcheck="false" autocomplete="off" data-ownkeys aria-label="' + esc(opts.title || 'Notes and sketchpad') + '" placeholder="' + esc(opts.placeholder || 'Jot down notes, commands, answers or ideas…') + '"></textarea>' +
      '</div>';
  }

  function bindNotes(root, id, key) {
    const ta = root && root.querySelector('#' + id);
    if (!ta) return;
    ta.value = ls.get(KEY + key, '');
    ta.oninput = () => { try { ls.set(KEY + key, ta.value); } catch (e) { } };
    const clear = root.querySelector('[data-cpad-clear="' + id + '"]');
    if (clear) clear.onclick = () => { ta.value = ''; try { ls.set(KEY + key, ''); } catch (e) { } ta.focus(); };
  }

  function logHTML(st) {
    if (!st.log.length) return '<div class="cpad-t">Ask anything about this screen. The AI on this PC answers here.</div>';
    return st.log.map(m => m.who === 'you'
      ? '<div class="cpad-msg you">' + esc(m.text) + '</div>'
      : '<div class="cpad-msg bot">' + (m.text ? fmt(m.text) : '<span class="cpad-t">…</span>') + '</div>').join('');
  }

  function aiHTML(id, opts) {
    opts = opts || {};
    style();
    const st = S(id);
    return '<div class="cpad-card">' +
      '<div class="cpad-h"><b>' + (opts.title || '🤖 AI helper') + '</b><span class="cpad-sp"></span>' +
      '<button class="ib" type="button" data-cpad-aiclear="' + esc(id) + '" style="font-size:11px;padding:2px 7px">Clear</button></div>' +
      (opts.hint ? '<div class="cpad-t" style="margin:0 0 6px">' + esc(opts.hint) + '</div>' : '') +
      '<div class="cpad-log" data-cpad-log="' + esc(id) + '" aria-live="polite">' + logHTML(st) + '</div>' +
      '<div class="cpad-row"><input id="' + esc(id) + '" data-cpad-in="' + esc(id) + '" autocomplete="off" spellcheck="false" aria-label="Ask the AI helper" placeholder="' + esc(opts.placeholder || 'Ask about this screen…') + '">' +
      '<button class="pri" type="button" data-cpad-send="' + esc(id) + '">Ask</button>' +
      '<button class="ib" type="button" data-cpad-stop="' + esc(id) + '" hidden>Stop</button></div>' +
      '</div>';
  }

  function bindAI(root, id, opts) {
    if (!root) return;
    opts = opts || {};
    const st = S(id);
    const inp = root.querySelector('[data-cpad-in="' + id + '"]');
    const send = root.querySelector('[data-cpad-send="' + id + '"]');
    const stop = root.querySelector('[data-cpad-stop="' + id + '"]');
    const clear = root.querySelector('[data-cpad-aiclear="' + id + '"]');
    if (!inp || !send) return;
    const paint = () => {
      const el = root.querySelector('[data-cpad-log="' + id + '"]');
      if (!el) return;
      el.innerHTML = logHTML(st);
      el.scrollTop = el.scrollHeight;
    };
    const last = () => st.log[st.log.length - 1];
    if (clear) clear.onclick = () => {
      if (st.ctl) { st.ctl.abort(); st.ctl = null; }
      st.log.length = 0; st.history.length = 0;
      paint(); inp.focus();
    };
    const ask = async () => {
      const q = inp.value.trim();
      if (!q || st.ctl) return;
      inp.value = '';
      st.log.push({ who: 'you', text: q }, { who: 'bot', text: '' });
      paint();
      if (!A.ai || !A.ai.stream) { last().text = 'The AI is not available. Choose a model at the top of the window.'; paint(); return; }
      let ctx = '';
      try { ctx = opts.context ? String(opts.context() || '') : ''; } catch (e) { ctx = ''; }
      const system = (opts.system || 'You are a helpful assistant inside a coding playground.') + (ctx ? '\n\nWhat is on the screen right now:\n' + ctx.slice(0, 8000) : '');
      const messages = [{ role: 'system', content: system }].concat(st.history.slice(-8), [{ role: 'user', content: q }]);
      const ctl = st.ctl = new AbortController();
      if (stop) stop.hidden = false;
      send.disabled = true;
      try {
        const all = await A.ai.stream(messages, t => { last().text = t; paint(); }, ctl.signal, { temp: opts.temp == null ? 0.3 : opts.temp });
        const text = all || '';
        last().text = text || 'The AI gave no answer. Check that a model is chosen at the top of the window.';
        if (text) {
          st.history.push({ role: 'user', content: q }, { role: 'assistant', content: text });
          if (st.history.length > 16) st.history.splice(0, st.history.length - 16);
        }
      } catch (e) {
        last().text = ctl.signal.aborted ? '(stopped)' : 'The AI could not answer: ' + (e.message || e) + '. Check that a model is chosen at the top of the window.';
      }
      paint();
      if (st.ctl === ctl) { st.ctl = null; if (stop) stop.hidden = true; send.disabled = false; }
    };
    send.onclick = ask;
    inp.onkeydown = e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); ask(); } };
    if (stop) stop.onclick = () => { if (st.ctl) st.ctl.abort(); };
  }

  A.cyberPad = { notesHTML, bindNotes, aiHTML, bindAI };
})();

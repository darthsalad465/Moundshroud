// Professional app-wide right-click context menu (web/js/context-menu.js).
// Replaces the browser's generic right-click menu with a theme-aware Moundshroud frosted glass menu
// that adapts to what you clicked: selected text, inputs, chat messages, chat history items,
// code blocks, images, sidebar tabs, and page-specific quick actions.
// Respects specialized right-click tools (3D Brain pan, Chess boards, Pixel Art picker, Browser tabs, etc.).
(() => {
  const esc2 = s => String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  let menuEl = null, focusIdx = -1, itemEls = [];
  /* what the last right-click landed on: the element, the word under the pointer, and the words that fit it */
  let lastCtx = null;

  function close() {
    if (menuEl) { menuEl.remove(); menuEl = null; }
    focusIdx = -1;
    itemEls = [];
  }

  function setFocus(i) {
    if (!itemEls.length) return;
    focusIdx = ((i % itemEls.length) + itemEls.length) % itemEls.length;
    itemEls.forEach((el, idx) => el.classList.toggle('hi', idx === focusIdx));
  }

  function show(x, y, sections, opts) {
    close();
    const cleaned = (sections || []).map(sec => (sec || []).filter(Boolean)).filter(sec => sec.length);
    /* every right-click anywhere in the app offers the words that fit the one clicked and the spelling and grammar
       fixes, including the menus that return early: they go first, above the generic actions */
    if (!(opts && opts.skipLang) && !cleaned.some(sec => sec.some(item => item && item.label === 'Fix all spelling'))) {
      cleaned.unshift(languageSection());
    }
    if (!cleaned.length) return;

    menuEl = document.createElement('div');
    menuEl.id = 'ctxm';
    menuEl.setAttribute('role', 'menu');

    cleaned.forEach((sec, si) => {
      if (si > 0) {
        const hr = document.createElement('div');
        hr.className = 'ctxm-sep';
        menuEl.appendChild(hr);
      }
      sec.forEach(item => {
        if (item.header) {
          const hd = document.createElement('div');
          hd.className = 'ctxm-hd';
          hd.textContent = item.header;
          menuEl.appendChild(hd);
          return;
        }
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'ctxm-it' + (item.danger ? ' dang' : '');
        btn.setAttribute('role', 'menuitem');
        if (item.disabled) btn.disabled = true;
        btn.innerHTML =
          '<span class="ctxm-ic">' + esc2(item.icon || '•') + '</span>' +
          '<span class="ctxm-lb">' + esc2(item.label) + '</span>' +
          (item.kbd ? '<span class="ctxm-kbd">' + esc2(item.kbd) + '</span>' : '');
        btn.onclick = ev => {
          ev.stopPropagation();
          close();
          try { item.run && item.run(); } catch (err) { }
        };
        menuEl.appendChild(btn);
        if (!item.disabled) itemEls.push(btn);
      });
    });

    /* A native full screen (the Browser's page, the Cyber Desktop, a terminal on the monitor) paints only its own
       element, so a menu left on the body would be invisible behind it. The menu is mounted inside whatever is
       fullscreen; fixed positioning still puts it under the pointer, and its z-index keeps it above the section. */
    const hostEl = document.fullscreenElement && document.fullscreenElement.appendChild ? document.fullscreenElement : document.body;
    hostEl.appendChild(menuEl);
    const r = menuEl.getBoundingClientRect();
    const pad = 10;
    const left = Math.max(pad, Math.min(window.innerWidth - r.width - pad, x));
    const top = Math.max(pad, Math.min(window.innerHeight - r.height - pad, y));
    menuEl.style.left = left + 'px';
    menuEl.style.top = top + 'px';
  }

  function getSelectedText() {
    try {
      const ae = document.activeElement;
      if (ae && (ae.tagName === 'TEXTAREA' || (ae.tagName === 'INPUT' && /text|search|url|email|tel|password/i.test(ae.type || 'text')))) {
        const s = ae.selectionStart, e = ae.selectionEnd;
        if (typeof s === 'number' && typeof e === 'number' && e > s) return ae.value.slice(s, e).trim();
      }
      return String(window.getSelection ? window.getSelection().toString() : '').trim();
    } catch (e) { return ''; }
  }

  function isEditable(el) {
    if (!el) return false;
    if (el.isContentEditable) return true;
    if (el.tagName === 'TEXTAREA' && !el.readOnly && !el.disabled) return true;
    if (el.tagName === 'INPUT' && !el.readOnly && !el.disabled && !/checkbox|radio|button|submit|reset|file|range|color/i.test(el.type || 'text')) return true;
    return false;
  }

  /* ---- Words, spelling and grammar ----------------------------------------------------------------------------
     A right-click offers the words that fit the one under the pointer, a fix for that word alone, and separate
     fixes for all the spelling and all the grammar in the box, in the selection, or in the page text. The word
     list and every grammar rule run on this PC, so nothing is sent to the internet. */
  const sameCase = (source, replacement) => {
    if (!replacement) return source;
    if (source.length > 1 && source === source.toUpperCase()) return replacement.toUpperCase();
    if (source[0] === source[0].toUpperCase()) return replacement[0].toUpperCase() + replacement.slice(1);
    return replacement;
  };
  async function correctText(text) {
    let response;
    try {
      response = await fetch('/api/spell', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ text }) });
    } catch (e) { throw new Error('offline'); }
    if (!response.ok) throw new Error('offline');
    const data = await response.json();
    if (data.error) throw new Error(data.error);
    const issues = (data.issues || []).filter(item => item.suggestions && item.suggestions.length);
    let fixed = String(text), changes = [];
    for (const issue of issues.slice().sort((a, b) => b.start - a.start)) {
      const replacement = sameCase(issue.word, issue.suggestions[0]);
      if (replacement === issue.word) continue;
      fixed = fixed.slice(0, issue.start) + replacement + fixed.slice(issue.end);
      changes.push({ from: issue.word, to: replacement, rule: 'spelling' });
    }
    return { fixed, changes, count: changes.length };
  }
  /* the word the pointer is on: from the caret inside a text box, or from the text under the pointer */
  function wordFromOffset(text, offset) {
    if (!text) return null;
    const re = /[A-Za-z][A-Za-z'’-]*/g;
    let m;
    while ((m = re.exec(text))) {
      const end = m.index + m[0].length;
      if (offset >= m.index && offset <= end) {
        return { word: m[0].replace(/’/g, "'").replace(/^[-']+|[-']+$/g, ''), start: m.index, end };
      }
      if (m.index >= offset) break;
    }
    return null;
  }
  function caretFromPoint(x, y) {
    try {
      if (document.caretRangeFromPoint) return document.caretRangeFromPoint(x, y);
      if (document.caretPositionFromPoint) {
        const pos = document.caretPositionFromPoint(x, y);
        if (pos) { const r = document.createRange(); r.setStart(pos.offsetNode, pos.offset); r.collapse(true); return r; }
      }
    } catch (e) { }
    return null;
  }
  function wordAtPoint(target, x, y) {
    const field = target && target.closest ? target.closest('input, textarea') : null;
    if (field && isEditable(field)) {
      const value = String(field.value == null ? '' : field.value);
      if (!value) return null;
      const hit = wordFromOffset(value, typeof field.selectionStart === 'number' ? field.selectionStart : 0);
      return hit ? { el: field, word: hit.word, start: hit.start, end: hit.end } : null;
    }
    const range = caretFromPoint(x, y), node = range && range.startContainer;
    if (!node || node.nodeType !== 3) return null;
    const hit = wordFromOffset(node.nodeValue || '', range.startOffset);
    if (!hit) return null;
    const host = node.parentElement && node.parentElement.closest ? node.parentElement.closest('[contenteditable="true"], [contenteditable=""]') : null;
    return { node, editable: !!host, word: hit.word, start: hit.start, end: hit.end };
  }
  /* what the bundled word list says about one word: whether it is a word, and what was probably meant */
  async function suggestWord(word) {
    let response;
    try {
      response = await fetch('/api/spell', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ text: word }) });
    } catch (e) { return null; }
    if (!response.ok) return null;
    let data;
    try { data = await response.json(); } catch (e) { return null; }
    if (!data || data.error) return null;
    const issue = (data.issues || [])[0];
    if (issue) return { known: false, suggestions: (issue.suggestions || []).slice(0, 5) };
    /* nothing reported and nothing checked means the word was skipped (a number, a code name): say nothing */
    return { known: data.checked ? true : null, suggestions: [] };
  }
  /* put the chosen word in place of the one that was clicked */
  async function applyWord(hit, choice) {
    if (!hit || !hit.word) return;
    let replacement = choice;
    if (!replacement) {
      const info = await suggestWord(hit.word);
      replacement = info && info.suggestions && info.suggestions[0];
      if (!replacement) { A.toast('No spelling suggestion for “' + hit.word + '”.'); return; }
    }
    const fixed = sameCase(hit.word, replacement);
    if (hit.el) {
      const el = hit.el;
      el.focus();
      try { el.setRangeText(fixed, hit.start, hit.end, 'end'); }
      catch (e) { el.value = String(el.value).slice(0, hit.start) + fixed + String(el.value).slice(hit.end); }
      el.dispatchEvent(new Event('input', { bubbles: true }));
      A.toast('“' + hit.word + '” → “' + fixed + '”');
      return;
    }
    if (hit.node && hit.editable) {
      const text = String(hit.node.nodeValue || '');
      hit.node.nodeValue = text.slice(0, hit.start) + fixed + text.slice(hit.end);
      const host = hit.node.parentElement && hit.node.parentElement.closest('[contenteditable="true"], [contenteditable=""]');
      if (host) host.dispatchEvent(new Event('input', { bubbles: true }));
      A.toast('“' + hit.word + '” → “' + fixed + '”');
      return;
    }
    A.copy(fixed);
    A.toast('Copied “' + fixed + '” — right-click inside a text box to change the word in place.');
  }

  /* ---- Fix all grammar ---------------------------------------------------------------------------------------
     The mistakes people make most, fixed by rules on this PC: no model, no network, and the same answer every
     time. A rule is a pattern and the correction it writes; anything that does not match is left alone. */
  const CONTRACTIONS = {
    dont: "don't", cant: "can't", wont: "won't", aint: "ain't", isnt: "isn't", arent: "aren't",
    wasnt: "wasn't", werent: "weren't", didnt: "didn't", doesnt: "doesn't", hasnt: "hasn't", havent: "haven't",
    hadnt: "hadn't", wouldnt: "wouldn't", couldnt: "couldn't", shouldnt: "shouldn't", mustnt: "mustn't",
    neednt: "needn't", youre: "you're", theyre: "they're", weve: "we've", youve: "you've", theyve: "they've",
    thats: "that's", whats: "what's", whos: "who's", wheres: "where's", heres: "here's", theres: "there's",
    im: "I'm", ive: "I've", youll: "you'll", theyll: "they'll", oclock: "o'clock", wouldve: "would've",
    couldve: "could've", shouldve: "should've", yall: "y'all"
  };
  const CONTRACTION_RE = new RegExp('\\b(' + Object.keys(CONTRACTIONS).join('|') + ')\\b', 'gi');
  const A_VOWEL = /^[aeiou]/i;
  /* words starting with a vowel letter but a consonant sound, and the other way round */
  const A_VOWEL_LETTER = new Set(('unique user users useful usual usually university union unit united uniform europe european one once utopia ukulele url urls usa usb ufo').split(' '));
  const A_SILENT_H = new Set(('hour hours hourly honest honestly honor honour honorable heir heirs').split(' '));
  /* words that really do follow themselves */
  const DOUBLED_OK = new Set(('had that is').split(' '));
  const GRAMMAR_RULES = [
    { label: 'a small “i” for “I”', re: /(^|[^A-Za-z0-9])(i)(?=[^A-Za-z0-9]|$)/g, fix: (m, g) => g[0] + 'I' },
    { label: 'a small “i” for “I”', re: /(^|[^A-Za-z0-9])(i)(?=['’])/g, fix: (m, g) => g[0] + 'I' },
    { label: 'a word typed twice', re: /\b([A-Za-z]{2,})([ \t]+)\1\b/gi, fix: (m, g) => (DOUBLED_OK.has(g[0].toLowerCase()) ? m : g[0]) },
    { label: 'a missing apostrophe', re: CONTRACTION_RE, fix: m => { const v = CONTRACTIONS[m.toLowerCase()]; if (!v) return m; return m[0] === m[0].toUpperCase() && v[0] === v[0].toLowerCase() ? v[0].toUpperCase() + v.slice(1) : v; } },
    { label: '“could of” for “could have”', re: /\b(could|would|should|must|might|may)[ \t]+of\b/gi, fix: (m, g) => g[0] + ' have' },
    { label: '“alot” for “a lot”', re: /\balot\b/gi, fix: () => 'a lot' },
    { label: '“a” or “an” before the wrong sound', re: /\b(a|an)[ \t]+([A-Za-z][A-Za-z'’-]*)/gi, fix: (m, g) => {
      const art = g[0], word = g[1], lower = word.toLowerCase();
      /* acronyms go by sound, not by letter: a MRI, an FBI */
      if (word.length > 1 && word === word.toUpperCase()) return m;
      const cap = art[0] === art[0].toUpperCase() ? 'A' : 'a';
      if (art.toLowerCase() === 'a') {
        return A_SILENT_H.has(lower) || (A_VOWEL.test(lower) && !A_VOWEL_LETTER.has(lower)) ? cap + 'n ' + word : m;
      }
      return !A_SILENT_H.has(lower) && (!A_VOWEL.test(lower) || A_VOWEL_LETTER.has(lower)) ? cap + ' ' + word : m;
    } },
    { label: 'a double space', re: /([^ \t\r\n])[ \t]{2,}/g, fix: (m, g) => g[0] + ' ' },
    { label: 'a space before punctuation', re: /[ \t]+([,;:!?])/g, fix: (m, g) => g[0] },
    { label: 'a space before a full stop', re: /([A-Za-z])[ \t]+\.(?=\s|$)/g, fix: (m, g) => g[0] + '.' },
    { label: 'a missing space after punctuation', re: /([,;:])([A-Za-z]{2,})/g, fix: (m, g) => g[0] + ' ' + g[1] },
    { label: 'a missing space after a full stop', re: /([a-z]{2})\.([A-Z][a-z])/g, fix: (m, g) => g[0] + '. ' + g[1] },
    { label: '“they is” for “they are”', re: /\b(they|we|you)[ \t]+is\b/gi, fix: (m, g) => g[0] + ' are' },
    { label: '“they was” for “they were”', re: /\b(they|we|you)[ \t]+was\b/gi, fix: (m, g) => g[0] + ' were' },
    { label: '“he are” for “he is”', re: /\b(he|she|it)[ \t]+are\b/gi, fix: (m, g) => g[0] + ' is' },
    { label: '“I is” for “I am”', re: /\bI[ \t]+(is|are)\b/g, fix: () => 'I am' },
    { label: '“I were” for “I was”', re: /\bI[ \t]+were\b/g, fix: () => 'I was' },
    { label: '“I has” for “I have”', re: /\bI[ \t]+has\b/g, fix: () => 'I have' },
    { label: '“he have” for “he has”', re: /\b(he|she|it)[ \t]+have\b/gi, fix: (m, g) => g[0] + ' has' },
    { label: '“I doesn’t” for “I don’t”', re: /\bI[ \t]+doesn['’]t\b/g, fix: () => "I don't" },
    { label: 'a sentence starting in lowercase', re: /(^|[.!?][ \t]+|\n[ \t]*)([a-z])/g, fix: (m, g, offset, whole) => {
      /* “e.g. this”, “Dr. smith” and the like are not sentence ends */
      if (/(?:\b(?:e|i)\.g|\bi\.e|\betc|\bvs|\bapprox|\bNo)\.$/.test(whole.slice(Math.max(0, offset - 10), offset + 1))) return m;
      return g[0] + g[1].toUpperCase();
    } }
  ];
  function applyGrammar(text) {
    let out = String(text == null ? '' : text);
    const changes = [];
    for (const rule of GRAMMAR_RULES) {
      out = out.replace(rule.re, (m, ...rest) => {
        const whole = rest.pop(), offset = rest.pop();
        let next;
        try { next = rule.fix(m, rest, offset, whole); } catch (e) { next = m; }
        if (typeof next !== 'string' || next === m) return m;
        changes.push({ from: m.trim(), to: next.trim(), rule: rule.label });
        return next;
      });
    }
    return { fixed: out, changes, count: changes.length };
  }

  /* the two checks and the three ways to apply them: this word, all the spelling, all the grammar */
  async function fixEditable(el, fixer, noun) {
    if (!el || !isEditable(el) || el.value == null) { A.toast('Click in a text box, or select some text, then right-click again.'); return; }
    const value = String(el.value);
    const start = el.selectionStart, end = el.selectionEnd;
    const selected = typeof start === 'number' && typeof end === 'number' && end > start;
    const text = selected ? value.slice(start, end) : value;
    if (!text.trim()) { A.toast('There is no text here to check.'); return; }
    let result;
    try { result = await fixer(text); } catch (e) { A.toast('The ' + noun + ' check is not available right now.'); return; }
    if (!result || !result.count) { A.toast('No ' + noun + ' mistakes found.'); return; }
    const { fixed, changes, count } = result;
    el.focus();
    el.value = selected ? value.slice(0, start) + fixed + value.slice(end) : fixed;
    if (typeof el.setSelectionRange === 'function') {
      const caret = selected ? start + fixed.length : fixed.length;
      try { el.setSelectionRange(caret, caret); } catch (e) { }
    }
    el.dispatchEvent(new Event('input', { bubbles: true }));
    A.toast('Fixed ' + count + ' ' + noun + ' mistake' + (count === 1 ? '' : 's') + ': ' + changes.slice(0, 3).map(c => c.from + ' → ' + c.to).join(' · ') + (changes.length > 3 ? ' …' : ''));
  }
  async function fixSelection(sel, fixer, noun) {
    let result;
    try { result = await fixer(sel); } catch (e) { A.toast('The ' + noun + ' check is not available right now.'); return; }
    if (!result || !result.count) { A.toast('No ' + noun + ' mistakes found.'); return; }
    A.copy(result.fixed);
    A.toast('Corrected text copied: ' + result.changes.slice(0, 3).map(c => c.from + ' → ' + c.to).join(' · ') + (result.changes.length > 3 ? ' …' : ''));
  }
  function fixAnywhere(target, fixer, noun) {
    const el = isEditable(target) && target.value != null ? target
      : (isEditable(document.activeElement) && document.activeElement.value != null ? document.activeElement : null);
    if (el) return fixEditable(el, fixer, noun);
    const sel = getSelectedText();
    if (sel) return fixSelection(sel, fixer, noun);
    A.toast('Click in a text box or select some text first, then right-click → Fix all ' + noun + '.');
  }
  const fixAllSpelling = target => fixAnywhere(target, correctText, 'spelling');
  const fixAllGrammar = target => fixAnywhere(target, applyGrammar, 'grammar');

  /* the section every right-click carries: the words that fit the one clicked, then the fixes for the whole text */
  function languageSection() {
    const ctx = lastCtx || {};
    const hit = ctx.hit;
    const items = [];
    if (hit && hit.word) {
      const suggestions = (ctx.suggestions && ctx.suggestions.suggestions) || [];
      const known = ctx.suggestions ? ctx.suggestions.known : null;
      if (suggestions.length) {
        items.push({ header: '“' + hit.word + '” — did you mean:' });
        suggestions.forEach((word, i) => items.push({
          icon: i === 0 ? '✏️' : '·',
          label: i === 0 ? 'Fix “' + hit.word + '” → “' + sameCase(hit.word, word) + '”' : 'Use “' + sameCase(hit.word, word) + '”',
          run: () => applyWord(hit, word)
        }));
      } else if (known === true) {
        items.push({ header: '“' + hit.word + '”' });
        items.push({ icon: '✓', label: 'Spelling looks right', disabled: true });
      } else if (known === false) {
        items.push({ header: '“' + hit.word + '”' });
        items.push({ icon: '✖', label: 'No suggestion for this word', disabled: true });
      }
      items.push({ icon: '🔤', label: 'Fix this word', disabled: !suggestions.length, run: () => applyWord(hit, null) });
    }
    items.push({ icon: '✅', label: 'Fix all spelling', run: () => fixAllSpelling(ctx.target) });
    items.push({ icon: '📝', label: 'Fix all grammar', run: () => fixAllGrammar(ctx.target) });
    return items;
  }

  function pageSection(target) {
    const cur = A.cur || 'home';
    const items = [];
    if (cur === 'chat') {
      const mode = A.agent && A.agent.mode ? A.agent.mode() : 'chat';
      items.push({ icon: '✎', label: 'New chat', kbd: 'Ctrl+N', run: () => A.chat && A.chat.newChat() });
      if (mode === 'chat') {
        items.push({ icon: '☰', label: 'Toggle chat sidebar', run: () => { const b = document.getElementById('chtog'); if (b) b.click(); } });
      }
      items.push({ icon: '🤖', label: 'Switch to Coding Agent', run: () => A.agent && A.agent.tab && A.agent.tab('agent') });
      items.push({ icon: '🐝', label: 'Switch to Swarm', run: () => A.agent && A.agent.tab && A.agent.tab('swarm') });
      items.push({ icon: '🗣', label: 'Switch to Debate', run: () => A.agent && A.agent.tab && A.agent.tab('debate') });
    } else if (cur === 'notes') {
      items.push({ icon: '📝', label: 'New note', run: () => { const b = document.querySelector('#p-notes #nn, #p-notes button[title*="New"]'); if (b) b.click(); else A.notes && A.notes.create && A.notes.create('New note', ''); } });
    } else if (cur === 'studio') {
      items.push({ icon: '🎓', label: 'Interactive Studio Guide', run: () => A.repoTutorial && A.repoTutorial.open('hub') });
      items.push({ icon: '🖼️', label: 'Photo Editor (miniPaint + AI)', run: () => A.studio && A.studio.go('photoed') });
      items.push({ icon: '🪄', label: 'Media Lab (rembg · Upscale · Stems)', run: () => A.studio && A.studio.go('medialab') });
      items.push({ icon: '🧬', label: 'Model Suite (Eval · Mergekit)', run: () => A.studio && A.studio.go('modelsuite') });
      items.push({ icon: '⚗️', label: 'Heretic Studio', run: () => A.studio && A.studio.go('heretic') });
    } else if (cur === 'tools') {
      items.push({ icon: '📝', label: 'MarkItDown Converter', run: () => A.tools && A.tools.go('md') });
      items.push({ icon: '🔄', label: 'File Converter', run: () => A.tools && A.tools.go('conv') });
      items.push({ icon: '🎓', label: 'Interactive Tools Guide', run: () => A.repoTutorial && A.repoTutorial.open('markitdown') });
    } else if (cur === 'play') {
      if (A.play && A.play.active && A.play.active()) {
        items.push({ icon: '←', label: 'Back to Games hub', run: () => A.play.exit() });
      }
      items.push({ icon: '💬', label: 'Open Chat', run: () => A.showTab('chat') });
    } else if (cur === 'home') {
      items.push({ icon: '🧠', label: 'Ask Moundshroud Everything', run: () => A.askAll && A.askAll.open && A.askAll.open() });
      items.push({ icon: '✎', label: 'Start a New Chat', kbd: 'Ctrl+N', run: () => A.chat && A.chat.newChat() });
      items.push({ icon: '🎓', label: 'Interactive Studio & Tools Guide', run: () => A.repoTutorial && A.repoTutorial.open('hub') });
    } else {
      items.push({ icon: '🏠', label: 'Go to Today', run: () => A.showTab('home') });
      items.push({ icon: '💬', label: 'Open Chat', run: () => A.showTab('chat') });
    }
    return items;
  }

  function buildSections(e) {
    const t = e.target;
    const sections = [];
    const sel = getSelectedText();

    // 1. Editable input / textarea
    if (isEditable(t)) {
      const editSec = [];
      if (sel) {
        editSec.push({ icon: '✂️', label: 'Cut', kbd: 'Ctrl+X', run: () => { t.focus(); try { document.execCommand('cut'); } catch (x) { A.copy(sel); } } });
        editSec.push({ icon: '📋', label: 'Copy', kbd: 'Ctrl+C', run: () => A.copy(sel) });
      }
      editSec.push({
        icon: '📥', label: 'Paste', kbd: 'Ctrl+V',
        run: async () => {
          t.focus();
          try {
            const clip = await navigator.clipboard.readText();
            if (typeof t.selectionStart === 'number') {
              const s = t.selectionStart, en = t.selectionEnd;
              t.value = t.value.slice(0, s) + clip + t.value.slice(en);
              t.selectionStart = t.selectionEnd = s + clip.length;
              t.dispatchEvent(new Event('input', { bubbles: true }));
            } else {
              document.execCommand('insertText', false, clip);
            }
          } catch (err) { A.toast('Use Ctrl+V to paste here'); }
        }
      });
      editSec.push({ icon: '☑️', label: 'Select all', kbd: 'Ctrl+A', run: () => { t.focus(); if (t.select) t.select(); } });
      if (t.value) {
        editSec.push({ icon: '🧹', label: 'Clear field', run: () => { t.focus(); t.value = ''; t.dispatchEvent(new Event('input', { bubbles: true })); } });
      }
      if (t.id === 'in') {
        editSec.push({ icon: '💬', label: 'Saved prompts', run: () => { const p = document.getElementById('prm'); if (p) p.click(); } });
      }
      sections.push(editSec);
    }

    // 2. Selected text (non-empty)
    if (sel) {
      const txtSec = [];
      if (!isEditable(t)) txtSec.push({ icon: '📋', label: 'Copy selection', kbd: 'Ctrl+C', run: () => A.copy(sel) });
      txtSec.push({ icon: '✨', label: 'Ask Moundshroud: Explain', run: () => { A.showTab('chat'); A.chat && A.chat.ask('Explain this clearly:\n\n' + sel, { noLocal: true }); } });
      txtSec.push({ icon: '📝', label: 'Summarize selection', run: () => { A.showTab('chat'); A.chat && A.chat.ask('Summarize this concisely:\n\n' + sel, { noLocal: true }); } });
      txtSec.push({ icon: '🔊', label: 'Read aloud', run: () => A.speech && A.speech.speak(sel) });
      txtSec.push({ icon: '🗒', label: 'Save selection to Note', run: () => { if (A.notes && A.notes.create) { A.notes.create(sel.slice(0, 42).replace(/\n/g, ' '), sel); A.toast('Saved to Notes'); } } });
      if (sel.split(/\s+/).length <= 3 && A.lib && A.lib.define) {
        txtSec.push({ icon: '📖', label: 'Define “' + sel.slice(0, 22) + '”', run: () => A.lib.define(sel.replace(/[^\p{L}'-]/gu, '')) });
      }
      sections.push(txtSec);
    }

    // 3. Main Chat sidebar history row (.chrow)
    const chRow = t.closest && t.closest('.chrow[data-id]');
    if (chRow && A.chat) {
      const cid = chRow.dataset.id;
      const isPinned = chRow.classList.contains('pinned');
      sections.push([
        { header: 'Chat conversation' },
        { icon: '💬', label: 'Open chat', run: () => A.chat.load(cid) },
        { icon: '📌', label: isPinned ? 'Unpin chat' : 'Pin to top', run: () => A.chat.togglePin && A.chat.togglePin(cid) },
        { icon: '✎', label: 'Rename chat…', run: () => A.chat.rename && A.chat.rename(cid) },
        { icon: '⬇', label: 'Export Markdown', run: () => A.chat.exportMd && A.chat.exportMd(cid) },
        { icon: '🗑', label: 'Delete chat', danger: true, run: () => A.chat.confirmRemove && A.chat.confirmRemove(cid) }
      ]);
      return sections;
    }

    // 4. Code block (<pre>)
    const preEl = t.closest && t.closest('pre');
    if (preEl) {
      const codeEl = preEl.querySelector('code') || preEl;
      const codeTxt = codeEl.textContent || '';
      const runBtn = preEl.querySelector('.runbtn');
      const codeSec = [
        { icon: '📋', label: 'Copy code block', run: () => A.copy(codeTxt) }
      ];
      if (runBtn) codeSec.push({ icon: '▶', label: 'Run code in sandbox', run: () => runBtn.click() });
      if (A.notes && A.notes.create) codeSec.push({ icon: '🗒', label: 'Save code to Note', run: () => { A.notes.create('Code snippet', '```\n' + codeTxt + '\n```'); A.toast('Saved snippet to Notes'); } });
      sections.push(codeSec);
    }

    // 5. Chat message (.m)
    const msgEl = t.closest && t.closest('#msgs > .m');
    if (msgEl) {
      const isUser = msgEl.classList.contains('u');
      const triggerTool = name => {
        const sp = msgEl.querySelector('[data-t="' + name + '"]');
        if (sp) sp.click();
      };
      const mSec = [
        { icon: '📋', label: 'Copy message', run: () => triggerTool('copy') }
      ];
      if (!isUser) {
        mSec.push({ icon: '🔊', label: 'Read aloud', run: () => triggerTool('listen') });
        mSec.push({ icon: '↻', label: 'Regenerate answer', run: () => triggerTool('redo') });
        mSec.push({ icon: '🗒', label: 'Save answer to Note', run: () => triggerTool('note') });
        mSec.push({ icon: '🃏', label: 'Make flashcards from answer', run: () => triggerTool('cards') });
      } else {
        mSec.push({ icon: '✎', label: 'Edit & resend', run: () => triggerTool('edit') });
      }
      sections.push(mSec);
    }

    // 6. Image (<img>)
    const imgEl = t.closest && t.closest('img');
    if (imgEl && imgEl.src) {
      sections.push([
        { icon: '🔍', label: 'Open image in new tab', run: () => window.open(imgEl.src, '_blank') },
        { icon: '⬇', label: 'Download image', run: () => { const a = document.createElement('a'); a.href = imgEl.src; a.download = 'moundshroud-image.png'; a.click(); } },
        { icon: '🖼️', label: 'Open Photo Editor', run: () => A.studio && A.studio.go('photoed') }
      ]);
    }

    // 7. Sidebar navigation button (#nav button)
    const navBtn = t.closest && t.closest('#nav button');
    if (navBtn) {
      const lbl = (navBtn.textContent || '').trim();
      sections.push([
        { icon: '↗', label: 'Open ' + (lbl || 'section'), run: () => navBtn.click() },
        { icon: '☰', label: 'Toggle compact sidebar', run: () => { const f = document.getElementById('shfold'); if (f) f.click(); } },
        { icon: '🔎', label: 'Command Palette', kbd: 'Ctrl+K', run: () => { const g = document.getElementById('gs'); if (g) g.click(); } }
      ]);
      return sections;
    }

    /* 8. The Browser: right-clicking anywhere on it (toolbar, search box, page frame) offers every browser action
       the Browser's own ⋮ menu has, including View page source, exactly as the rest of the app has a menu. */
    let hasViewSource = false;
    if (A.lib && A.lib.pageItems && (t.closest && t.closest('#p-web'))) {
      const items = A.lib.pageItems(t);
      if (items.length) {
        sections.push(items);
        hasViewSource = items.some(it => it && /View page source/i.test(it.label || ''));
      }
    }

    // 9. Page-aware quick actions + universal pro app shortcuts
    const pg = pageSection(t);
    if (pg.length) sections.push(pg);

    const universal = [
      { icon: '🔎', label: 'Search & Commands', kbd: 'Ctrl+K', run: () => { const g = document.getElementById('gs'); if (g) g.click(); } },
      { icon: '⚙', label: 'Settings', run: () => { if (A.settings && A.settings.open) A.settings.open(); else { const c = document.getElementById('cog'); if (c) c.click(); } } },
      { icon: '🎨', label: 'Customize Appearance', run: () => A.custom && A.custom.open && A.custom.open() }
    ];
    if (!hasViewSource && A.lib && A.lib.viewSource) {
      universal.unshift({
        icon: '</>', label: 'View page source', run: () => {
          const scope = document.fullscreenElement || (t.closest && t.closest('section.panel, .cd-shell, .ws-reader')) || document.documentElement;
          const label = (A.tabs && A.cur && A.tabs[A.cur] && A.tabs[A.cur].label) || document.title || 'Page';
          let html = '';
          try { html = '<!doctype html>\n' + scope.outerHTML; } catch (x) { html = document.documentElement ? document.documentElement.outerHTML : ''; }
          A.lib.viewSource({ url: location.href + (A.cur ? '#' + A.cur : ''), title: label, html });
        }
      });
    }
    sections.push(universal);

    return sections;
  }

  /* Opt-out zones where specialized tools own right-click (drag pan, board arrows, color picker, etc.) */
  const SKIP_SEL = 'canvas, iframe, .acb, #csbd, #brn-cv, #brn-gl, #cmp, #ltabs, #lback, #lfwd, #ms, .ml-row[data-id]';

  document.addEventListener('contextmenu', async e => {
    if (e.defaultPrevented) return;
    if (e.shiftKey && e.ctrlKey) return; // power-user escape hatch for DevTools inspect
    if (e.target && e.target.closest && e.target.closest(SKIP_SEL)) return;
    e.preventDefault();
    /* the word under the pointer and the words that fit it are looked up before the menu opens, so its suggestions
       are part of it instead of appearing a moment later */
    const hit = wordAtPoint(e.target, e.clientX, e.clientY);
    const mine = lastCtx = { target: e.target, hit, suggestions: null };
    if (hit && hit.word) {
      let info = null;
      try { info = await suggestWord(hit.word); } catch (x) { }
      if (lastCtx === mine) lastCtx.suggestions = info;
    }
    show(e.clientX, e.clientY, buildSections(e));
  });

  document.addEventListener('pointerdown', e => {
    if (menuEl && !menuEl.contains(e.target)) close();
  }, true);
  window.addEventListener('blur', close);
  window.addEventListener('resize', close);
  document.addEventListener('fullscreenchange', close);
  window.addEventListener('scroll', close, true);
  document.addEventListener('keydown', e => {
    if (!menuEl) return;
    if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); close(); }
    else if (e.key === 'ArrowDown') { e.preventDefault(); setFocus(focusIdx + 1); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setFocus(focusIdx - 1); }
    else if (e.key === 'Enter' && focusIdx >= 0 && itemEls[focusIdx]) { e.preventDefault(); itemEls[focusIdx].click(); }
  }, true);

  /* a right-click that happened inside the Browser's page frame: the page forwards it (lib-bridge.js), so there is no
     DOM element here to inspect. The menu is the same list, with the browser actions and the app-wide actions. */
  function pageMenu(info) {
    const sections = [];
    if (info.link) sections.push([
      { icon: '↗', label: 'Open link in new tab', run: () => A.lib && A.lib.openUrl(info.link) },
      { icon: '🔗', label: 'Copy link address', run: () => A.copy(info.link) }
    ]);
    if (info.sel) {
      const word = info.sel.split(/\s+/)[0];
      sections.push([
        { icon: '📋', label: 'Copy selection', kbd: 'Ctrl+C', run: () => A.copy(info.sel) },
        { icon: '🔍', label: 'Search “' + info.sel.slice(0, 24) + '”', run: () => { A.showTab('web'); A.lib.search(info.sel); } },
        { icon: '📖', label: 'Define “' + word.slice(0, 22) + '”', run: () => A.lib.define(word) },
        { icon: '🔊', label: 'Read aloud', run: () => A.speech && A.speech.speak(info.sel) },
        { icon: '🗒', label: 'Save selection to Note', run: () => { if (A.notes && A.notes.create) { A.notes.create(info.sel.slice(0, 42).replace(/\n/g, ' '), info.sel); A.toast('Saved to Notes'); } } }
      ]);
    }
    const items = A.lib && A.lib.pageItems ? A.lib.pageItems() : [];
    if (items.length) sections.push(items);
    sections.push([
      { icon: '🔎', label: 'Search & Commands', kbd: 'Ctrl+K', run: () => { const g = document.getElementById('gs'); if (g) g.click(); } },
      { icon: '⚙', label: 'Settings', run: () => { if (A.settings && A.settings.open) A.settings.open(); else { const c = document.getElementById('cog'); if (c) c.click(); } } },
      { icon: '🎨', label: 'Customize Appearance', run: () => A.custom && A.custom.open && A.custom.open() },
      { icon: '🏠', label: 'Go to Today', run: () => A.showTab('home') },
      { icon: '💬', label: 'Open Chat', run: () => A.showTab('chat') }
    ]);
    show(info.x, info.y, sections, { skipLang: true });
  }

  A.ctxMenu = { show, close, page: pageMenu };
})();

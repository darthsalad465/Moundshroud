// Professional app-wide right-click context menu (web/js/context-menu.js).
// Replaces the browser's generic right-click menu with a theme-aware Moundshroud frosted glass menu
// that adapts to what you clicked: selected text, inputs, chat messages, chat history items,
// code blocks, images, sidebar tabs, and page-specific quick actions.
// Respects specialized right-click tools (3D Brain pan, Chess boards, Pixel Art picker, Browser tabs, etc.).
(() => {
  const esc2 = s => String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  let menuEl = null, focusIdx = -1, itemEls = [];

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

  function show(x, y, sections) {
    close();
    const cleaned = (sections || []).map(sec => (sec || []).filter(Boolean)).filter(sec => sec.length);
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

    document.body.appendChild(menuEl);
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

    // 8. Page-aware quick actions + universal pro app shortcuts
    const pg = pageSection(t);
    if (pg.length) sections.push(pg);

    sections.push([
      { icon: '🔎', label: 'Search & Commands', kbd: 'Ctrl+K', run: () => { const g = document.getElementById('gs'); if (g) g.click(); } },
      { icon: '⚙', label: 'Settings', run: () => { if (A.settings && A.settings.open) A.settings.open(); else { const c = document.getElementById('cog'); if (c) c.click(); } } },
      { icon: '🎨', label: 'Customize Appearance', run: () => A.custom && A.custom.open && A.custom.open() }
    ]);

    return sections;
  }

  /* Opt-out zones where specialized tools own right-click (drag pan, board arrows, color picker, etc.) */
  const SKIP_SEL = 'canvas, iframe, .acb, #csbd, #brn-cv, #brn-gl, #cmp, #ltabs, #lback, #lfwd, #ms, .ml-row[data-id]';

  document.addEventListener('contextmenu', e => {
    if (e.defaultPrevented) return;
    if (e.shiftKey && e.ctrlKey) return; // power-user escape hatch for DevTools inspect
    if (e.target && e.target.closest && e.target.closest(SKIP_SEL)) return;
    e.preventDefault();
    show(e.clientX, e.clientY, buildSections(e));
  });

  document.addEventListener('pointerdown', e => {
    if (menuEl && !menuEl.contains(e.target)) close();
  }, true);
  window.addEventListener('blur', close);
  window.addEventListener('resize', close);
  window.addEventListener('scroll', close, true);
  document.addEventListener('keydown', e => {
    if (!menuEl) return;
    if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); close(); }
    else if (e.key === 'ArrowDown') { e.preventDefault(); setFocus(focusIdx + 1); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setFocus(focusIdx - 1); }
    else if (e.key === 'Enter' && focusIdx >= 0 && itemEls[focusIdx]) { e.preventDefault(); itemEls[focusIdx].click(); }
  }, true);

  A.ctxMenu = { show, close };
})();

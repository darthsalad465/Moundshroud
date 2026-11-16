// One place for every keyboard shortcut in the app, and the sheet that shows them.
// A shortcut is registered with a label and a group, and the same list drives both the keys and the help sheet,
// so the sheet can never fall out of date. Modules can add their own with A.keys.reg([...]).
(() => {
  const list = [];

  /* 'Ctrl+Shift+K', 'ctrl+k' and 'CTRL + K' are all the same thing */
  const ALIAS = { control: 'ctrl', cmd: 'ctrl', command: 'ctrl', meta: 'ctrl', option: 'alt', del: 'delete', ins: 'insert', space: ' ' };
  const norm = c => {
    let p = String(c || '').toLowerCase().split('+').map(s => s.trim()).filter(Boolean).map(s => ALIAS[s] || s);
    /* "?" is the same physical key as "/", and Shift is implied by it, so both spellings become one combo */
    p = p.map(s => s === '?' ? '/' : s === 'esc' ? 'escape' : s);
    if (p.indexOf('/') >= 0) p = p.filter(s => s !== 'shift');
    return p.sort().join('+');
  };
  /* the same string, worked out from a real key press */
  const ofEvent = e => {
    const raw = e.key == null ? '' : String(e.key);
    if (/^(Shift|Control|Alt|Meta|CapsLock|Dead|Unidentified)$/.test(raw)) return null;      // modifier on its own
    const p = [];
    if (e.ctrlKey || e.metaKey) p.push('ctrl');
    if (e.altKey) p.push('alt');
    let k = raw.length === 1 ? raw.toLowerCase() : raw.toLowerCase().replace(/^arrow/, '');
    if (k === '?') k = '/';
    if (k !== '/' && e.shiftKey) p.push('shift');                                            // the shift in "?" is already in the key itself
    p.push(k);
    return p.sort().join('+');
  };

  const typing = e => {
    const t = e.target || {};
    const tag = (t.tagName || '').toUpperCase();
    return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || t.isContentEditable === true;
  };

  A.keys = {
    reg(items) {
      (Array.isArray(items) ? items : [items]).forEach(k => {
        if (!k || !k.combo || !k.label) return;
        k.norm = norm(k.combo);
        if (typeof k.run !== 'function') k.run = null;                      // listed but owned elsewhere (Esc, the tray hotkeys)
        list.push(k);
      });
      return A.keys;
    },
    list: () => list.slice(),
    combo: norm,
    /* the sheet: everything the app listens for, grouped, plus what the tray hotkeys do in Windows */
    help() {
      const groups = [];
      list.filter(k => !k.hidden).forEach(k => { const g = groups.find(x => x.name === k.group) || (groups.push({ name: k.group, items: [] }), groups[groups.length - 1]); g.items.push(k); });
      const keysOf = k => String(k.combo).split('+').map(s => '<kbd>' + esc(s === 'ctrl' ? 'Ctrl' : s === 'alt' ? 'Alt' : s === 'shift' ? 'Shift' : s === '/' ? (k.combo === '/' ? '?' : '/') : s === 'escape' ? 'Esc' : s === ' ' ? 'Space' : s.length === 1 ? s.toUpperCase() : s.charAt(0).toUpperCase() + s.slice(1)) + '</kbd>').join('');
      const win = [
        ['Ctrl+Alt+A', 'Open Moundshroud from anywhere in Windows'],
        ['Ctrl+Alt+Q', 'Ask about the text you have selected'],
        ['Ctrl+Alt+S', 'Read the text on your screen (on-screen text)'],
        ['Ctrl+Alt+N', 'Save the selected text straight into a note'],
        ['Ctrl+Alt+V', 'Talk to Moundshroud by voice'],
        ['Ctrl+Alt+E', 'Emergency information, straight away'],
      ];
      const card = (title, rows) => '<div style="flex:1;min-width:250px"><h3 style="margin:6px 0 8px">' + title + '</h3>' + rows.join('') + '</div>';
      const row = (k, text) => '<div class="krow"><span class="kk">' + k + '</span><span class="kl">' + text + '</span></div>';
      A.dlg('<div class="hd"><b>⌨ Keyboard shortcuts</b><span class="sp" style="flex:1"></span><button class="ib" id="kst">In Settings</button><button class="pri" id="ksx">Done</button></div><div class="bd scroll" style="padding:4px 18px 18px"><div style="display:flex;gap:22px;flex-wrap:wrap">' +
        groups.map(g => card(g.name, g.items.map(k => row(keysOf(k), esc(k.label)) + (k.note ? '<div class="small mute" style="margin:-2px 0 6px 96px">' + esc(k.note) + '</div>' : '')))).join('') +
        card('Anywhere in Windows', win.map(w => row(w[0].split('+').map(s => '<kbd>' + s + '</kbd>').join(''), esc(w[1])))) +
        '</div><div class="small mute" style="margin-top:14px">Tip: press <kbd>?</kbd> any time to come back here, and <kbd>Ctrl</kbd>+<kbd>K</kbd> to search everything or run a command.</div></div>', true);
      const x = $('ksx'); if (x) x.onclick = A.closeDlg;
      const st = $('kst'); if (st) st.onclick = () => { A.closeDlg(); if (A.settings && A.settings.open) A.settings.open('keys'); };
    }
  };

  /* ------------------------------------------------------------------ the shortcuts themselves */
  A.keys.reg([
    { combo: 'Ctrl+K', label: 'Search everything, or run any command', group: 'Everywhere', run: () => A.search.open() },
    { combo: '?', label: 'Show this list of shortcuts', group: 'Everywhere', run: () => A.keys.help() },
    { combo: 'Ctrl+/', label: 'Show this list of shortcuts', group: 'Everywhere', hidden: true, run: () => A.keys.help() },
    { combo: 'Ctrl+N', label: 'New chat (or a new note in Notes)', group: 'Everywhere', run: () => { if (A.cur === 'notes') A.emit('newitem'); else A.chat.newChat(); } },
    { combo: 'Ctrl+,', label: 'Open Settings', group: 'Everywhere', run: () => { if (A.settings && A.settings.open) A.settings.open(); } },
    { combo: 'F1', label: 'Open the guide', group: 'Everywhere', run: () => A.showTab('guide') },
    { combo: 'Escape', label: 'Close what is open, stop talking, or go back to Today', group: 'Everywhere', note: 'Repeated presses step back one thing at a time.', run: null },
  ]);
  /* Alt+1 to Alt+9: jump straight to an area by its place in the top bar */
  const nthArea = i => (A.order || []).filter(x => A.tabs[x] && !A.tabs[x].hidden)[i - 1];
  for (let i = 1; i <= 9; i++) {
    A.keys.reg({
      combo: 'Alt+' + i, group: 'Jump to an area',
      label: i === 9 ? 'Jump to the ninth area in the top bar' : 'Jump to area ' + i + ' in the top bar',
      run: () => {
        const n = nthArea(i); if (!n) return;
        A.showTab(n);
        try { A.toast(A.tabs[n].label, 1200); } catch (e) { }
      }
    });
  }

  /* ------------------------------------------------------------------ the one key listener */
  document.addEventListener('keydown', e => {
    if (e.repeat || e.isComposing || e.defaultPrevented) return;
    const c = ofEvent(e);
    /* a code editor ([data-ownkeys], e.g. Cyber › Coding) keeps every key, Ctrl+/ and Ctrl+K included; only F1 still opens the guide */
    if (c !== 'f1' && e.target && e.target.closest && e.target.closest('[data-ownkeys]')) return;
    const k = list.find(x => x.norm === c && x.run);
    if (!k) return;
    if (typing(e) && !(e.ctrlKey || e.metaKey || e.altKey)) return;         // plain letters belong to whatever you are typing in
    if (k.when) { try { if (!k.when()) return; } catch (er) { return; } }
    e.preventDefault();
    try { k.run(e); } catch (er) { try { A.toast('That shortcut failed: ' + (er && er.message ? er.message : 'unknown'), 4000); } catch (e2) { } }
  }, true);
})();

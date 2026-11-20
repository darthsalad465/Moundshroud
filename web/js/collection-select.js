// Shared selection for collection views. Normal clicks still open items outside Select mode.
(() => {
  const item = '[data-select-id]';
  const control = 'button, a, input, select, textarea, [contenteditable], [data-select-ignore]';

  function toolbar(actions) {
    return '<div class="collection-bar" data-selection-bar>' +
      '<button type="button" class="ib" data-selection="mode" aria-pressed="false">Select</button>' +
      '<div class="collection-actions" data-selection-actions hidden>' +
      '<output class="small" data-selection-count aria-live="polite"></output>' +
      '<button type="button" class="ib" data-selection="all">Select all</button>' +
      '<button type="button" class="ib" data-selection="clear">Clear</button>' + actions +
      '</div></div>';
  }

  function check(label = 'Select item') {
    return '<button type="button" class="collection-check" data-selection-check aria-label="' + A.esc(label) + '" aria-pressed="false">✓</button>';
  }

  function bind(root, actions) {
    const lifetime = new AbortController();
    const selected = new Set();
    let mode = false, busy = false, anchor = '', drag = null, ignoreClick = false, visibleIds = null;
    const cards = () => [...root.querySelectorAll(item)];
    const ids = () => visibleIds || cards().map(el => el.dataset.selectId);
    const find = target => target.closest(item);

    function update() {
      root.classList.toggle('collection-selecting', mode);
      const bar = root.querySelector('[data-selection-bar]');
      if (bar) {
        const toggle = bar.querySelector('[data-selection=mode]');
        toggle.textContent = mode ? 'Done' : 'Select';
        toggle.setAttribute('aria-pressed', mode);
        bar.querySelector('[data-selection-actions]').hidden = !mode;
        bar.querySelector('[data-selection-count]').textContent = selected.size + ' selected';
        bar.querySelectorAll('button[data-selection]').forEach(b => {
          b.disabled = busy || (b.dataset.selection === 'all' ? !ids().length :
            b.dataset.selection !== 'mode' && !selected.size);
        });
      }
      for (const el of cards()) {
        const on = selected.has(el.dataset.selectId);
        el.classList.toggle('collection-picked', on);
        const button = el.querySelector('[data-selection-check]');
        if (button) button.setAttribute('aria-pressed', on);
      }
    }

    function reset() {
      mode = false;
      selected.clear();
      anchor = '';
      update();
    }

    function sync(list = null) {
      visibleIds = list;
      const available = new Set(ids());
      for (const id of selected) if (!available.has(id)) selected.delete(id);
      update();
    }

    function toggle(el, range) {
      const id = el.dataset.selectId;
      const order = ids(), from = order.indexOf(anchor), to = order.indexOf(id);
      if (range && from >= 0 && to >= 0) {
        for (const key of order.slice(Math.min(from, to), Math.max(from, to) + 1)) selected.add(key);
      } else {
        if (selected.has(id)) selected.delete(id);
        else selected.add(id);
        anchor = id;
      }
      update();
    }

    root.addEventListener('click', async e => {
      const button = e.target.closest('[data-selection]');
      const el = find(e.target);
      const picking = el && (e.target.closest('[data-selection-check]') ||
        ((mode || e.ctrlKey || e.metaKey || e.shiftKey) && !e.target.closest(control)));
      if (!button && !picking && !ignoreClick) return;
      e.preventDefault();
      e.stopImmediatePropagation();
      if (busy || ignoreClick) return;
      if (button) {
        const name = button.dataset.selection;
        if (name === 'mode') { if (mode) reset(); else { mode = true; update(); } }
        else if (name === 'all') { for (const id of ids()) selected.add(id); update(); }
        else if (name === 'clear') { selected.clear(); anchor = ''; update(); }
        else if (selected.size && actions[name]) {
          busy = true;
          update();
          try {
            const done = await actions[name]([...selected]);
            if (done) for (const id of done) selected.delete(id);
          } catch (error) {
            A.toast(error.message || 'Could not finish the selected action.');
          } finally {
            busy = false;
            update();
          }
        }
      } else {
        mode = true;
        toggle(el, e.shiftKey);
      }
    }, true);

    root.addEventListener('pointerdown', e => {
      if (busy || e.button !== 0 || e.pointerType !== 'mouse' || !(mode || e.ctrlKey || e.metaKey)) return;
      if (e.target.closest(control) && !e.target.closest('[data-selection-check]')) return;
      const origin = find(e.target);
      if (!origin && !e.target.closest('[data-selection-area]')) return;
      drag = { id: e.pointerId, x: e.clientX, y: e.clientY, start: new Set(selected), outline: null };
    });
    root.addEventListener('pointermove', e => {
      if (!drag || drag.id !== e.pointerId) return;
      if (!drag.outline && Math.hypot(e.clientX - drag.x, e.clientY - drag.y) < 5) return;
      if (!drag.outline) {
        root.setPointerCapture(e.pointerId);
        drag.outline = document.createElement('div');
        drag.outline.className = 'collection-marquee';
        document.body.append(drag.outline);
        mode = true;
      }
      const left = Math.min(drag.x, e.clientX), right = Math.max(drag.x, e.clientX);
      const top = Math.min(drag.y, e.clientY), bottom = Math.max(drag.y, e.clientY);
      Object.assign(drag.outline.style, { left: left + 'px', top: top + 'px', width: (right - left) + 'px', height: (bottom - top) + 'px' });
      selected.clear();
      for (const id of drag.start) selected.add(id);
      for (const el of cards()) {
        const r = el.getBoundingClientRect();
        if (r.left <= right && r.right >= left && r.top <= bottom && r.bottom >= top) selected.add(el.dataset.selectId);
      }
      update();
    });
    function finish(e) {
      if (drag?.id !== e.pointerId) return;
      if (drag.outline) {
        drag.outline.remove();
        ignoreClick = true;
        setTimeout(() => { ignoreClick = false; }, 0);
      }
      drag = null;
    }
    document.addEventListener('pointerup', finish, { signal: lifetime.signal });
    root.addEventListener('lostpointercapture', finish);
    root.addEventListener('pointercancel', finish);
    root.addEventListener('dragstart', e => { if (mode || drag) e.preventDefault(); });
    root.addEventListener('keydown', e => {
      if (!mode || busy || e.target.closest('input, select, textarea, [contenteditable]')) return;
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'a') {
        e.preventDefault();
        for (const id of ids()) selected.add(id);
        update();
      } else if (e.key === 'Escape') {
        e.stopPropagation();
        reset();
      }
    });
    return { sync, reset, update, destroy() { lifetime.abort(); drag?.outline?.remove(); } };
  }

  async function each(ids, run) {
    const done = [];
    for (const id of ids) {
      try {
        const result = await run(id);
        if (result && result.ok !== false && !result.error) done.push(id);
      } catch (_) { /* Keep failed items selected for a retry. */ }
    }
    if (done.length !== ids.length) A.toast((ids.length - done.length) + ' of ' + ids.length + ' items could not be updated.');
    return done;
  }

  A.collectionSelect = { bind, toolbar, check, each };
})();

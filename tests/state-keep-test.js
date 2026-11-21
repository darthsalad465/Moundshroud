// Each tab keeps its own instance (web/js/state-keep.js): switching away and back restores what was typed, ticked,
// chosen and scrolled — in memory only, never on disk — and live things (a game with a clock) are never resumed.
// The module runs against a tiny DOM written here, so no browser is needed.
const fs = require('fs'), path = require('path'), vm = require('vm');

/* ---------- the smallest DOM that can carry a form ---------- */
const unesc = s => String(s).replace(/\\(.)/g, '$1');

function El(tag, attrs) {
  this.tagName = String(tag).toUpperCase(); this.nodeType = 1; this.children = []; this.parentElement = null;
  this.attrs = Object.assign({}, attrs || {}); this.value = ''; this.checked = false; this.open = false;
  this.scrollTop = 0; this.scrollLeft = 0; this.selectionStart = 0; this.selectionEnd = 0;
}
Object.defineProperty(El.prototype, 'id', {
  get() { return this.attrs.id || ''; },
  set(v) { this.attrs.id = String(v); }
});
Object.defineProperty(El.prototype, 'type', { get() { return String(this.attrs.type || '').toLowerCase(); } });
El.prototype.getAttribute = function (k) { k = String(k); return Object.prototype.hasOwnProperty.call(this.attrs, k) ? String(this.attrs[k]) : null; };
El.prototype.setAttribute = function (k, v) { this.attrs[String(k)] = String(v); };
El.prototype.hasAttribute = function (k) { return Object.prototype.hasOwnProperty.call(this.attrs, String(k)); };
El.prototype.removeAttribute = function (k) { delete this.attrs[String(k)]; };
El.prototype.setSelectionRange = function (a, b) { this.selectionStart = a; this.selectionEnd = b; };
El.prototype.append = function () {
  for (const c of arguments) { if (!c) continue; c.parentElement = this; this.children.push(c); }
  return this;
};
Object.defineProperty(El.prototype, 'previousElementSibling', {
  get() {
    if (!this.parentElement) return null;
    const s = this.parentElement.children, i = s.indexOf(this);
    return i > 0 ? s[i - 1] : null;
  }
});
const partMatch = (el, part) => {
  if (part === '*') return true;
  if (part === ':root') return false;                 // the panel itself is reached by its owner
  let m;
  if ((m = /^#(.+)$/.exec(part))) return el.id === unesc(m[1]);
  let rest = part, tag = null;
  const tm = /^([a-zA-Z][\w-]*)/.exec(part);
  if (tm) { tag = tm[1].toUpperCase(); rest = part.slice(tm[0].length); }
  if (tag && el.tagName !== tag) return false;
  const nm = /:nth-of-type\((\d+)\)/.exec(rest);
  if (nm) {
    let i = 1;
    for (let s = el.previousElementSibling; s; s = s.previousElementSibling) if (s.tagName === el.tagName) i++;
    if (i !== +nm[1]) return false;
  }
  const am = /\[([\w-]+)(?:=(["']?)([^"'\]]*)\2)?\]/.exec(rest);
  if (am) {
    const v = el.getAttribute(am[1]);
    if (v === null) return false;
    if (am[3] !== undefined && am[3] !== '' && v !== unesc(am[3])) return false;
  }
  return true;
};
const pathMatch = (el, parts, root) => {
  let n = el, i = parts.length - 1;
  while (n && i >= 0) {
    if (parts[i] === ':root') return n === root && i === 0;
    if (!partMatch(n, parts[i])) return false;
    if (i === 0) return true;
    n = n.parentElement; i--;
  }
  return false;
};
const walk = (el, fn) => { for (const c of el.children) { fn(c); walk(c, fn); } };
const splitTop = sel => String(sel).split(',').map(s => s.trim()).filter(Boolean);
El.prototype.matches = function (sel) {
  const self = this;
  return splitTop(sel).some(s => {
    const parts = s.split('>').map(x => x.trim());
    let n = self, i = parts.length - 1;
    while (n && i >= 0) {
      if (parts[i] === ':root') return n.__root === true && i === 0;
      if (!partMatch(n, parts[i])) return false;
      if (i === 0) return true;
      n = n.parentElement; i--;
    }
    return false;
  });
};
El.prototype.closest = function (sel) { let n = this; while (n) { if (n.matches && n.matches(sel)) return n; n = n.parentElement; } return null; };
El.prototype.querySelectorAll = function (sel) {
  const out = [];
  const lists = splitTop(sel).map(s => s.split('>').map(x => x.trim()));
  walk(this, el => { if (lists.some(parts => pathMatch(el, parts, this))) out.push(el); });
  return out;
};
El.prototype.querySelector = function (sel) {
  const parts = String(sel).split('>').map(s => s.trim());
  let found = null;
  walk(this, el => { if (!found && pathMatch(el, parts, this)) found = el; });
  return found;
};

module.exports = async ok => {
  const root = path.join(__dirname, '..'), read = f => fs.readFileSync(path.join(root, f), 'utf8');
  const src = read('web/js/state-keep.js');
  const core = read('web/js/core.js');

  const tabs = { notes: {}, chat: {}, play: {} };
  const mount = () => {
    const A = { tabs, cur: 'notes', order: Object.keys(tabs) };
    const panels = {};
    const mk = name => { const p = new El('section', { id: 'p-' + name }); p.__root = true; panels[name] = p; return p; };
    const document = { getElementById: id => panels[String(id).replace(/^p-/, '')] || null };
    const timers = [];
    const ctx = {
      A, document,
      window: {},
      requestAnimationFrame: fn => { timers.push(fn); return 1; },
      setTimeout: (fn, ms) => { timers.push(fn); return 1; },
      clearTimeout: () => { },
      console
    };
    vm.runInNewContext(src, ctx);
    return { A, mk, panels, flush: () => { while (timers.length) { const f = timers.shift(); try { f(); } catch (e) { } } } };
  };

  /* ---------- one tab keeps what was typed in it ---------- */
  {
    const { A, mk } = mount();
    const p = mk('notes');
    const e = new El('textarea', { id: 'ne' });
    e.value = 'my draft';
    p.append(e);
    A.state.save('notes');
    // the page draws itself again: a brand new box with the same id, empty
    p.children.length = 0;
    const e2 = new El('textarea', { id: 'ne' });
    p.append(e2);
    A.state.load('notes');
    ok('state: a tab gets back what was typed in it, even after the page is drawn again', e2.value === 'my draft', e2.value);
    ok('state: it is remembered per tab, in memory only', !!A.state.peek('notes') && !('localStorage' in A));
    ok('state: a tab that was never left has nothing to restore', A.state.peek('chat') === null);
  }

  /* ---------- boxes, lists and folded sections ---------- */
  {
    const { A, mk } = mount();
    const p = mk('notes');
    const cb = new El('input', { type: 'checkbox', id: 'onlyStarred' });
    const sl = new El('select', { id: 'sortBy' });
    const det = new El('details', { id: 'more' });
    const ta = new El('textarea', { id: 'body' });
    cb.checked = true; sl.value = 'oldest'; det.open = true; ta.value = 'body text';
    p.append(cb, sl, det, ta);
    A.state.save('notes');
    for (const el of [cb, sl, det, ta]) { if (el.tagName === 'INPUT') el.checked = false; else if (el.tagName === 'SELECT') el.value = 'newest'; else if (el.tagName === 'DETAILS') el.open = false; else el.value = ''; }
    A.state.load('notes');
    ok('state: ticks, choices, folded sections and text all come back', cb.checked && sl.value === 'oldest' && det.open && ta.value === 'body text',
      [cb.checked, sl.value, det.open, ta.value].join('|'));
  }

  /* ---------- what must never be kept ---------- */
  {
    const { A, mk } = mount();
    const p = mk('notes');
    const pw = new El('input', { type: 'password', id: 'pw' });
    const off = new El('input', { id: 'scratch' }); off.setAttribute('data-nosave', '');
    const live = new El('input', { id: 'live' }); live.setAttribute('data-live', '');
    const priv = new El('input', { id: 'private' }); priv.setAttribute('data-private', '');
    pw.value = 'hunter2'; off.value = 'temp'; live.value = 'clock'; priv.value = 'secret';
    p.append(pw, off, live, priv);
    A.state.save('notes');
    const keys = Object.keys((A.state.peek('notes') || { f: {} }).f);
    ok('state: a password box is never remembered', !keys.some(k => /pw/.test(k)), keys.join(','));
    ok('state: data-nosave, data-live and data-private controls are left alone', !keys.some(k => /scratch|live|private/.test(k)), keys.join(','));
  }

  /* ---------- live things are not resumed ---------- */
  {
    const { A, mk } = mount();
    const p = mk('play');
    const e = new El('input', { id: 'scoreName' }); e.value = 'Ada';
    p.append(e);
    A.state.save('play');
    ok('state: an ordinary tab in Play is kept', !!A.state.peek('play'));
    A.state.ephemeral('play', () => true);          // a game is running now
    A.state.save('play');
    ok('state: a timed game in progress is not snapshotted', A.state.peek('play') === null);
    A.state.ephemeral('play', () => false);
    A.state.save('play');
    ok('state: when the game is over the tab is remembered again', !!A.state.peek('play'));
    A.state.ephemeral('chat');                      // fixed: this tab never keeps state
    A.state.save('chat');
    ok('state: a tab marked ephemeral outright is never kept', A.state.peek('chat') === null);
  }

  /* ---------- one tab never overwrites another ---------- */
  {
    const { A, mk } = mount();
    const a = mk('notes'), b = mk('chat');
    const ea = new El('input', { id: 'q' }); ea.value = 'search in notes'; a.append(ea);
    const eb = new El('input', { id: 'q' }); eb.value = 'ask the chat'; b.append(eb);
    A.state.save('notes'); A.state.save('chat');
    ea.value = ''; eb.value = '';
    A.state.load('notes');
    ok('state: each tab is restored from its own instance, not a shared one', ea.value === 'search in notes' && eb.value === '', ea.value + '|' + eb.value);
  }

  /* ---------- a redrawn page cannot put one control's text into another ---------- */
  {
    const { A, mk } = mount();
    const p = mk('notes');
    const e = new El('input', { id: 'field', placeholder: 'Pressure', type: 'number' });
    e.value = '1013'; p.append(e);
    A.state.save('notes');
    p.children.length = 0;
    const other = new El('input', { id: 'field', placeholder: 'City' });   // same place and id, different control
    other.value = ''; p.append(other);
    A.state.load('notes');
    ok('state: a different control that took the same place is not filled with the old text', other.value === '', other.value);
  }

  /* ---------- scrolling ---------- */
  {
    const { A, mk } = mount();
    const p = mk('notes');
    const list = new El('div', { id: 'list' });
    list.scrollTop = 480; list.scrollLeft = 0;
    p.append(list);
    A.state.save('notes');
    list.scrollTop = 0;
    A.state.load('notes');
    ok('state: where a list was scrolled to comes back', list.scrollTop === 480, String(list.scrollTop));
  }

  /* ---------- size limits ---------- */
  {
    const { A, mk } = mount();
    const p = mk('notes');
    const e = new El('textarea', { id: 'big' });
    e.value = 'x'.repeat(500000);
    p.append(e);
    A.state.save('notes');
    const saved = A.state.peek('notes').f['#big'].v.length;
    ok('state: one huge box is capped instead of growing without limit', saved === 200000, String(saved));
  }

  /* ---------- a feature can keep its own state ---------- */
  {
    const { A, mk } = mount();
    const p = mk('notes');
    p.append(new El('div', { id: 'canvas' }));
    A.state.hook('notes', { save: () => ({ zoom: 3 }), load: m => { A.got = m; } });
    A.state.save('notes');
    A.state.load('notes');
    ok('state: a feature can keep state that is not in a control, and get it back', A.got && A.got.zoom === 3);
  }

  /* ---------- the tab system is wired to it ---------- */
  ok('state: switching tabs saves the page being left and restores the one being opened',
    /A\.state\.save\(prev\)/.test(core) && /A\.state\.load\(name\)/.test(core));
  ok('state: a tab can be registered as ephemeral (a timed game, a call)', /ephemeral: !!opts\.ephemeral/.test(core));
  ok('state: the Playground game clock marks Play live while a game runs', /A\.state\.ephemeral\('play'/.test(read('web/js/play.js')));
  ok('state: the module is loaded by the app', /state-keep\.js/.test(read('web/index.html')));
  ok('state: nothing is written to disk by the state keeper', !/localStorage|sessionStorage|indexedDB/.test(src));

  /* ---------- real markup from the app still parses as a selector chain ---------- */
  {
    const { A, mk } = mount();
    const p = mk('notes');
    const wrap = new El('div', { id: 'nside' });
    const inner = new El('div');
    const e = new El('input', { placeholder: 'Filter notes…' }); e.value = 'groceries';
    inner.append(e); wrap.append(inner); p.append(wrap);
    A.state.save('notes');
    const key = Object.keys(A.state.peek('notes').f)[0];
    ok('state: a control without an id is found again by its placeholder, not just its position', key === 'input[placeholder=Filter\\ notes\\…]' || /^input\[placeholder=/.test(key), key);
    e.value = '';
    A.state.load('notes');
    ok('state: and the placeholder lookup restores it', e.value === 'groceries', e.value);
  }
};

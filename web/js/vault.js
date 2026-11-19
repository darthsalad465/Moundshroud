// Cyber > Passwords: an encrypted password vault that never leaves this PC.
// The vault is locked with a master password. Everything is encrypted here in the window (AES-256-GCM, key from
// PBKDF2-SHA-256 with 600,000 rounds) before it is saved; the server only stores the scrambled result.
// The page is marked data-private, so the AI, the buddy and "what am I looking at?" never see it.
(() => {
  const ITER = 600000, enc = new TextEncoder(), dec = new TextDecoder();
  const b64 = u8 => { let s = ''; for (let i = 0; i < u8.length; i += 0x8000) s += String.fromCharCode.apply(null, u8.subarray(i, i + 0x8000)); return btoa(s); };
  const unb64 = s => Uint8Array.from(atob(s), c => c.charCodeAt(0));
  const rnd = n => crypto.getRandomValues(new Uint8Array(n));
  const deriveKey = async (pw, salt, iter) => crypto.subtle.deriveKey({ name: 'PBKDF2', salt, iterations: iter, hash: 'SHA-256' }, await crypto.subtle.importKey('raw', enc.encode(pw), 'PBKDF2', false, ['deriveKey']), { name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt']);
  const seal = async (key, salt, iter, obj) => { const iv = rnd(12); const ct = new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, enc.encode(JSON.stringify(obj)))); return { v: 1, salt: b64(salt), iter, iv: b64(iv), ct: b64(ct) }; };
  const open = async (key, v) => JSON.parse(dec.decode(await crypto.subtle.decrypt({ name: 'AES-GCM', iv: unb64(v.iv) }, key, unb64(v.ct))));
  const sha = async t => Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', enc.encode(t)))).map(b => b.toString(16).padStart(2, '0')).join('');
  const uid = () => b64(rnd(9)).replace(/[+/=]/g, '');

  /* ---------- password strength: a rough guess of how long it would take to guess ---------- */
  const COMMON = /^(password|passw0rd|123456|12345678|123456789|qwerty|abc123|111111|letmein|iloveyou|admin|welcome|monkey|dragon|football|baseball|sunshine|princess|master|login|starwars|shadow|trustno1|000000|654321|superman|qazwsx|michael|charlie|hello)\d*!?$/i;
  function strength(p) {
    p = String(p || ''); if (!p) return { score: 0, label: '', bits: 0 };
    let pool = 0; if (/[a-z]/.test(p)) pool += 26; if (/[A-Z]/.test(p)) pool += 26; if (/\d/.test(p)) pool += 10; if (/[^a-zA-Z0-9]/.test(p)) pool += 33;
    let bits = p.length * Math.log2(pool || 1);
    if (COMMON.test(p)) bits = Math.min(bits, 10);
    if (/(.)\1{2,}/.test(p)) bits -= 10; if (/(0123|1234|2345|3456|4567|5678|6789|abcd|bcde|qwer|asdf|zxcv)/i.test(p)) bits -= 12;
    if (/^[A-Za-z]+\d{1,4}[!?.]?$/.test(p)) bits = Math.min(bits, 30);
    bits = Math.max(0, Math.round(bits));
    const score = bits < 28 ? 1 : bits < 40 ? 2 : bits < 60 ? 3 : 4;
    return { score, bits, label: ['', 'Very weak', 'Weak', 'Good', 'Strong'][score] };
  }
  const meter = p => { const s = strength(p); return '<span class="vt-meter" title="About ' + s.bits + ' bits"><i style="width:' + (s.score * 25) + '%;background:' + ['var(--line)', 'var(--bad)', 'var(--warn)', 'var(--acc)', 'var(--ok)'][s.score] + '"></i></span><span class="small mute">' + s.label + '</span>'; };

  /* ---------- the generator ---------- */
  const SYL = ['ba', 'be', 'bi', 'bo', 'bu', 'ka', 'ke', 'ki', 'ko', 'ku', 'da', 'de', 'di', 'do', 'du', 'fa', 'fe', 'fi', 'fo', 'ga', 'ge', 'go', 'ha', 'he', 'hi', 'ho', 'ja', 'jo', 'la', 'le', 'li', 'lo', 'lu', 'ma', 'me', 'mi', 'mo', 'mu', 'na', 'ne', 'ni', 'no', 'nu', 'pa', 'pe', 'pi', 'po', 'ra', 're', 'ri', 'ro', 'ru', 'sa', 'se', 'si', 'so', 'su', 'ta', 'te', 'ti', 'to', 'tu', 'va', 've', 'vi', 'vo', 'wa', 'we', 'wi', 'ya', 'yo', 'za', 'zo'];
  const pick = n => { const a = new Uint32Array(1); const lim = Math.floor(4294967296 / n) * n; let x; do { crypto.getRandomValues(a); x = a[0]; } while (x >= lim); return x % n; };
  function generate(o) {
    if (o.kind === 'words') { const w = []; for (let i = 0; i < o.words; i++) { let s = ''; const k = 2 + pick(2); for (let j = 0; j < k; j++) s += SYL[pick(SYL.length)]; w.push(o.caps ? s[0].toUpperCase() + s.slice(1) : s); } return w.join(o.sep) + (o.num ? o.sep + pick(100) : ''); }
    if (o.kind === 'pin') { let s = ''; for (let i = 0; i < o.len; i++) s += pick(10); return s; }
    const x = o.easy ? ['', '', ''] : ['l', 'IO', '01'];   // the look-alikes are left out unless asked for
    const sets = [o.lower && 'abcdefghijkmnopqrstuvwxyz' + x[0], o.upper && 'ABCDEFGHJKLMNPQRSTUVWXYZ' + x[1], o.digits && '23456789' + x[2], o.symbols && '!@#$%^&*-_=+?'].filter(Boolean);
    if (!sets.length) return '';
    const all = sets.join(''); let out;
    do { out = Array.from({ length: o.len }, () => all[pick(all.length)]).join(''); } while (o.len >= sets.length && !sets.every(s => [...out].some(c => s.includes(c))));
    return out;
  }

  /* ---------- state ---------- */
  let key = null, salt = null, iter = ITER, data = null, lockT = 0, lastAct = Date.now(), root = null, view = 'list', sel = null, q = '', copyT = 0;
  const lockMin = () => (data && data.settings && data.settings.lockMin) || 5;
  const touch = () => { lastAct = Date.now(); };
  const locked = () => !key;
  function lock(why) {
    key = null; data = null; sel = null; view = 'list'; q = '';
    if (root && root.isConnected) draw(why);
  }
  setInterval(() => { if (key && Date.now() - lastAct > lockMin() * 60000) lock('Locked after ' + lockMin() + ' minutes without use.'); }, 15000);
  ['pointerdown', 'keydown'].forEach(ev => addEventListener(ev, () => { if (key && root && root.isConnected) touch(); }, true));

  async function persist() {
    const v = await seal(key, salt, iter, data);
    const r = await A.api('/api/vault/save', v);
    if (!r || r.error) { A.toast('The vault could not be saved: ' + ((r && r.error) || 'no answer')); return false; }
    return true;
  }

  /* copying: cleared from the clipboard after 30 seconds, and removed from Moundshroud's clipboard history */
  async function copySecret(text, what) {
    try { await navigator.clipboard.writeText(text); } catch (e) { A.copy(text); }
    A.toast(what + ' copied. It is cleared from the clipboard in 30 seconds.');
    const h = await sha(text);
    setTimeout(() => A.api('/api/vault/scrub', { hash: h }).catch(() => { }), 2500);
    clearTimeout(copyT);
    copyT = setTimeout(async () => {
      try { const now = await navigator.clipboard.readText(); if (now === text) await navigator.clipboard.writeText(''); } catch (e) { try { await navigator.clipboard.writeText(''); } catch (e2) { } }
      A.api('/api/vault/scrub', { hash: h }).catch(() => { });
    }, 30000);
  }

  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
  const host = u => { try { return new URL(/^https?:/i.test(u) ? u : 'https://' + u).hostname.replace(/^www\./, ''); } catch (e) { return ''; } };
  const ago = t => { if (!t) return ''; const d = (Date.now() - t) / 864e5; return d < 1 ? 'today' : d < 2 ? 'yesterday' : d < 60 ? Math.round(d) + ' days ago' : d < 730 ? Math.round(d / 30) + ' months ago' : Math.round(d / 365) + ' years ago'; };

  /* ---------- drawing ---------- */
  function shell(inner) {
    root.innerHTML = '<div class="scroll pad" style="flex:1" data-private><div class="vt" style="max-width:980px;margin:0 auto">' + inner + '</div></div>';
  }
  async function draw(note) {
    if (!root) return;
    if (locked()) {
      let st; try { st = await A.api('/api/vault'); } catch (e) { st = { error: e.message }; }
      if (st && st.exists && !st.damaged) return drawUnlock(st.vault, note);
      if (st && st.damaged) return shell('<h2>🔐 Passwords</h2><div class="card warn">The vault file is damaged. Older copies are kept: <button class="ib" id="vtold">Open an older copy</button></div>'), wireOlder();
      return drawCreate();
    }
    if (view === 'gen') return drawGen();
    if (view === 'health') return drawHealth();
    if (view === 'edit') return drawEdit();
    if (view === 'settings') return drawSettings();
    drawList();
  }
  function wireOlder() {
    const b = root.querySelector('#vtold'); if (!b) return;
    b.onclick = async () => { const r = await A.api('/api/vault/versions'); if (!r.versions.length) return A.toast('There are no older copies.'); const n = r.versions[0].n; const o = await A.api('/api/vault/older', { n }); if (o.vault) drawUnlock(o.vault, 'This is the copy from ' + new Date(r.versions[0].at).toLocaleString() + '. Unlock it and it becomes the vault again.', true); };
  }

  function drawCreate() {
    shell('<h2 style="margin:0 0 4px">🔐 Passwords</h2><div class="small mute" style="line-height:1.55;margin-bottom:14px">A vault for your passwords, kept only on this PC and locked with one <b>master password</b>. Everything in it is encrypted before it is saved, the AI never sees this page, and copied passwords are wiped from the clipboard after 30 seconds.</div>' +
      '<div class="card" style="max-width:520px"><b>Choose a master password</b><div class="small mute" style="margin:4px 0 10px;line-height:1.5">Make it long and memorable: four or five unrelated words work well. <b style="color:var(--bad)">If you forget it, nobody can open the vault, not even Moundshroud.</b> Write it down and keep it somewhere safe.</div>' +
      '<input type="password" id="vtm1" placeholder="Master password" autocomplete="new-password" style="width:100%"><div id="vtms" style="margin:6px 0"></div><input type="password" id="vtm2" placeholder="Type it again" autocomplete="new-password" style="width:100%">' +
      '<label class="small" style="display:flex;gap:6px;align-items:center;margin:10px 0"><input type="checkbox" id="vtack"> I understand a forgotten master password cannot be recovered.</label><button class="pri" id="vtcreate">Create the vault</button> <span class="small" id="vterr" style="color:var(--bad)"></span></div>');
    const m1 = root.querySelector('#vtm1'); m1.oninput = () => { root.querySelector('#vtms').innerHTML = meter(m1.value); };
    root.querySelector('#vtcreate').onclick = async () => {
      const a = m1.value, b = root.querySelector('#vtm2').value, err = root.querySelector('#vterr');
      if (a.length < 10) return err.textContent = 'Use at least 10 characters.';
      if (strength(a).score < 3) return err.textContent = 'That is too easy to guess. Add more words or characters.';
      if (a !== b) return err.textContent = 'The two do not match.';
      if (!root.querySelector('#vtack').checked) return err.textContent = 'Tick the box to confirm you understand.';
      err.textContent = ''; root.querySelector('#vtcreate').disabled = true; root.querySelector('#vtcreate').textContent = 'Creating…';
      salt = rnd(16); iter = ITER; key = await deriveKey(a, salt, iter);
      data = { items: [], settings: { lockMin: 5 }, created: Date.now() };
      if (await persist()) { touch(); A.toast('Your vault is ready.'); draw(); } else { key = null; }
    };
  }

  function drawUnlock(v, note, restoring) {
    shell('<h2 style="margin:0 0 12px">🔐 Passwords</h2><div class="card" style="max-width:440px">' + (note ? '<div class="small mute" style="margin-bottom:8px">' + esc(note) + '</div>' : '') + '<b>🔒 The vault is locked</b><div style="display:flex;gap:6px;margin-top:10px"><input type="password" id="vtpw" placeholder="Master password" autocomplete="current-password" style="flex:1"><button class="pri" id="vtun">Unlock</button></div><div class="small" id="vterr" style="color:var(--bad);margin-top:6px"></div></div>');
    const pw = root.querySelector('#vtpw'), go = async () => {
      const err = root.querySelector('#vterr'); err.textContent = ''; root.querySelector('#vtun').disabled = true; root.querySelector('#vtun').textContent = 'Unlocking…';
      try {
        const s = unb64(v.salt), k = await deriveKey(pw.value, s, v.iter), d = await open(k, v);
        key = k; salt = s; iter = v.iter; data = d; data.items = data.items || []; data.settings = data.settings || { lockMin: 5 };
        if (iter < ITER) { iter = ITER; key = await deriveKey(pw.value, salt, iter); await persist(); }   // older vaults move up to the current strength
        else if (restoring) await persist();
        touch(); draw();
      } catch (e) { err.textContent = 'That is not the master password.'; root.querySelector('#vtun').disabled = false; root.querySelector('#vtun').textContent = 'Unlock'; pw.select(); }
    };
    root.querySelector('#vtun').onclick = go; pw.onkeydown = e => { if (e.key === 'Enter') go(); };
    setTimeout(() => pw.focus(), 50);
  }

  const bar = () => '<div class="nw-row" style="margin-bottom:12px;flex-wrap:wrap;gap:6px"><h2 style="margin:0;flex:1">🔐 Passwords</h2>' +
    ['list:🗂 All', 'gen:🎲 Generator', 'health:🩺 Check-up', 'settings:⚙ Vault'].map(x => { const [k, l] = x.split(':'); return '<button class="ib' + (view === k ? ' on' : '') + '" data-v="' + k + '">' + l + '</button>'; }).join('') + '<button class="ib" data-lock title="Lock now">🔒 Lock</button></div>';
  function wireBar() {
    root.querySelectorAll('[data-v]').forEach(b => b.onclick = () => { view = b.dataset.v; sel = null; draw(); });
    const l = root.querySelector('[data-lock]'); if (l) l.onclick = () => lock('Locked.');
  }

  function drawList() {
    const items = data.items.slice().sort((a, b) => (b.fav ? 1 : 0) - (a.fav ? 1 : 0) || String(a.title).localeCompare(String(b.title)));
    const ql = q.toLowerCase(), shown = items.filter(x => !ql || [x.title, x.user, x.url, x.tags, x.notes].join(' ').toLowerCase().includes(ql));
    shell(bar() + '<div class="nw-row" style="gap:6px;margin-bottom:10px"><input id="vtq" placeholder="Search ' + items.length + ' logins…" value="' + esc(q) + '" style="flex:1"><button class="pri" id="vtadd">＋ Add a login</button></div>' +
      (items.length ? '' : '<div class="card"><b>Your vault is empty.</b><div class="small mute" style="margin-top:4px;line-height:1.5">Press <b>＋ Add a login</b>, or bring in the passwords saved in Edge, Chrome, Firefox or another password manager: export them there as a CSV file, then use <b>⚙ Vault › Import</b>. Delete that CSV file afterwards: it is not encrypted.</div></div>') +
      '<div class="vt-list">' + shown.map(x => '<div class="vt-row card" data-id="' + esc(x.id) + '" tabindex="0"><div class="vt-ic">' + esc((x.title || host(x.url) || '?').trim()[0].toUpperCase()) + '</div><div style="flex:1;min-width:0"><b>' + (x.fav ? '★ ' : '') + esc(x.title || host(x.url) || 'Untitled') + '</b><div class="small mute" style="overflow:hidden;text-overflow:ellipsis;white-space:nowrap">' + esc(x.user || '') + (x.url ? ' · ' + esc(host(x.url)) : '') + '</div></div>' +
        '<button class="ib" data-cu title="Copy the user name">👤</button><button class="ib" data-cp title="Copy the password">🔑</button></div>').join('') + (items.length && !shown.length ? '<div class="mute">Nothing matches.</div>' : '') + '</div>');
    wireBar();
    const qi = root.querySelector('#vtq'); qi.oninput = () => { q = qi.value; const pos = qi.selectionStart; drawList(); const n = root.querySelector('#vtq'); n.focus(); n.setSelectionRange(pos, pos); };
    root.querySelector('#vtadd').onclick = () => { sel = null; view = 'edit'; draw(); };
    root.querySelector('.vt-list').onclick = e => {
      const row = e.target.closest('[data-id]'); if (!row) return; const it = data.items.find(x => x.id === row.dataset.id); if (!it) return;
      if (e.target.closest('[data-cu]')) return copySecret(it.user || '', 'User name');
      if (e.target.closest('[data-cp]')) return copySecret(it.pw || '', 'Password');
      sel = it.id; view = 'edit'; draw();
    };
  }

  function drawEdit() {
    const it = sel ? data.items.find(x => x.id === sel) : null, x = it || { title: '', user: '', pw: '', url: '', notes: '', tags: '' };
    shell(bar() + '<div class="card" style="max-width:640px"><h3 style="margin:0 0 10px">' + (it ? esc(it.title || 'Login') : 'Add a login') + '</h3>' +
      '<label class="small mute">Name</label><input id="vtt" value="' + esc(x.title) + '" placeholder="e.g. Bank, Email" style="width:100%;margin-bottom:8px">' +
      '<label class="small mute">Web address</label><div style="display:flex;gap:6px;margin-bottom:8px"><input id="vtu" value="' + esc(x.url) + '" placeholder="https://…" style="flex:1">' + (x.url ? '<a class="ib" href="' + esc(/^https?:/i.test(x.url) ? x.url : 'https://' + x.url) + '" target="_blank" rel="noopener noreferrer">↗ Open</a>' : '') + '</div>' +
      '<label class="small mute">User name or email</label><div style="display:flex;gap:6px;margin-bottom:8px"><input id="vtus" value="' + esc(x.user) + '" style="flex:1" autocomplete="off"><button class="ib" id="vtcu">Copy</button></div>' +
      '<label class="small mute">Password</label><div style="display:flex;gap:6px"><input id="vtp" type="password" value="' + esc(x.pw) + '" style="flex:1;font-family:monospace" autocomplete="new-password"><button class="ib" id="vtshow">👁</button><button class="ib" id="vtcp">Copy</button><button class="ib" id="vtgen" title="Make a strong one">🎲</button></div><div id="vtps" style="margin:6px 0 8px">' + meter(x.pw) + '</div>' +
      '<label class="small mute">Notes (security questions, PINs, recovery codes…)</label><textarea id="vtn" rows="3" style="width:100%;margin-bottom:8px">' + esc(x.notes) + '</textarea>' +
      '<label class="small mute">Tags</label><input id="vttg" value="' + esc(x.tags) + '" placeholder="work, family…" style="width:100%;margin-bottom:8px">' +
      '<label class="small" style="display:flex;gap:6px;align-items:center;margin-bottom:10px"><input type="checkbox" id="vtfav"' + (x.fav ? ' checked' : '') + '> ★ Favourite (shown first)</label>' +
      (it ? '<div class="small mute" style="margin-bottom:10px">Added ' + ago(it.created) + ' · password changed ' + ago(it.pwAt || it.created) + (it.hist && it.hist.length ? ' · <a href="#" id="vthist">' + it.hist.length + ' earlier password' + (it.hist.length > 1 ? 's' : '') + '</a>' : '') + '</div><div id="vthl"></div>' : '') +
      '<div style="display:flex;gap:6px"><button class="pri" id="vtsave">Save</button><button class="ib" id="vtcancel">Cancel</button><span style="flex:1"></span>' + (it ? '<button class="ib" id="vtdel" style="color:var(--bad)">Delete</button>' : '') + '</div></div>');
    wireBar();
    const p = root.querySelector('#vtp'); p.oninput = () => { root.querySelector('#vtps').innerHTML = meter(p.value); };
    root.querySelector('#vtshow').onclick = () => { p.type = p.type === 'password' ? 'text' : 'password'; };
    root.querySelector('#vtcp').onclick = () => p.value && copySecret(p.value, 'Password');
    root.querySelector('#vtcu').onclick = () => { const u = root.querySelector('#vtus').value; if (u) copySecret(u, 'User name'); };
    root.querySelector('#vtgen').onclick = () => { p.value = generate(genOpts()); p.type = 'text'; p.oninput(); };
    const h = root.querySelector('#vthist'); if (h) h.onclick = e => { e.preventDefault(); root.querySelector('#vthl').innerHTML = '<div class="card small">' + it.hist.map((o, i) => '<div style="display:flex;gap:6px;align-items:center;padding:2px 0"><code style="flex:1">••••••••</code><span class="mute">until ' + new Date(o.until).toLocaleDateString() + '</span><button class="ib" data-hc="' + i + '">Copy</button></div>').join('') + '</div>'; root.querySelectorAll('[data-hc]').forEach(b => b.onclick = () => copySecret(it.hist[+b.dataset.hc].pw, 'Earlier password')); };
    root.querySelector('#vtcancel').onclick = () => { view = 'list'; sel = null; draw(); };
    const del = root.querySelector('#vtdel'); if (del) del.onclick = async () => { if (!(await A.confirm('Delete “' + (it.title || 'this login') + '” from the vault? The previous five versions of the vault are kept, so a mistake can still be undone from ⚙ Vault.'))) return; data.items = data.items.filter(y => y.id !== it.id); if (await persist()) { A.toast('Deleted.'); view = 'list'; sel = null; draw(); } };
    root.querySelector('#vtsave').onclick = async () => {
      const v = id => root.querySelector(id).value, now = Date.now();
      const rec = { title: v('#vtt').trim(), url: v('#vtu').trim(), user: v('#vtus').trim(), pw: v('#vtp'), notes: v('#vtn'), tags: v('#vttg').trim(), fav: root.querySelector('#vtfav').checked };
      if (!rec.title && !rec.url && !rec.user) return A.toast('Give it a name, an address or a user name first.');
      if (it) { if (it.pw && it.pw !== rec.pw) { it.hist = [{ pw: it.pw, until: now }].concat(it.hist || []).slice(0, 5); it.pwAt = now; } Object.assign(it, rec, { updated: now }); }
      else data.items.push(Object.assign({ id: uid(), created: now, updated: now, pwAt: now }, rec));
      if (await persist()) { A.toast('Saved and encrypted.'); view = 'list'; sel = null; draw(); }
    };
  }

  const genOpts = () => Object.assign({ kind: 'chars', len: 20, lower: true, upper: true, digits: true, symbols: true, easy: true, words: 5, sep: '-', caps: true, num: true }, (data && data.settings && data.settings.gen) || {});
  function drawGen() {
    const o = genOpts();
    shell(bar() + '<div class="card" style="max-width:640px"><div class="nw-row" style="gap:6px;margin-bottom:10px">' + [['chars', 'Characters'], ['words', 'Easy to say'], ['pin', 'PIN']].map(([k, l]) => '<button class="ib' + (o.kind === k ? ' on' : '') + '" data-k="' + k + '">' + l + '</button>').join('') + '</div>' +
      '<div style="display:flex;gap:6px"><input id="vtg" readonly style="flex:1;font-family:monospace;font-size:17px"><button class="ib" id="vtre">↻</button><button class="pri" id="vtgc">Copy</button></div><div id="vtgs" style="margin:6px 0 12px"></div>' +
      (o.kind === 'words' ? '<label class="small">Words <input type="range" id="vtw" min="3" max="10" value="' + o.words + '"> <b>' + o.words + '</b></label> <label class="small"><input type="checkbox" id="vtcap"' + (o.caps ? ' checked' : '') + '> Capitals</label> <label class="small"><input type="checkbox" id="vtnum"' + (o.num ? ' checked' : '') + '> A number</label>' :
        '<label class="small">Length <input type="range" id="vtl" min="' + (o.kind === 'pin' ? 4 : 8) + '" max="' + (o.kind === 'pin' ? 12 : 64) + '" value="' + (o.kind === 'pin' ? Math.min(12, Math.max(4, o.pinLen || 6)) : o.len) + '"> <b id="vtlv"></b></label>' +
        (o.kind === 'chars' ? '<div style="display:flex;gap:12px;flex-wrap:wrap;margin-top:6px">' + [['lower', 'a-z'], ['upper', 'A-Z'], ['digits', '0-9'], ['symbols', '!@#'], ['easy', 'Skip look-alikes (l, 1, O, 0)']].map(([k, l]) => '<label class="small"><input type="checkbox" data-o="' + k + '"' + (o[k] ? ' checked' : '') + '> ' + l + '</label>').join('') + '</div>' : '')) +
      '<div class="small mute" style="margin-top:10px">Made on this PC with the browser’s secure random numbers. Nothing is sent anywhere.</div></div>');
    wireBar();
    const save = patch => { data.settings.gen = Object.assign(genOpts(), patch); persist(); };
    const out = root.querySelector('#vtg'), make = () => { const oo = genOpts(); out.value = generate(oo.kind === 'pin' ? Object.assign({}, oo, { len: oo.pinLen || 6 }) : oo); root.querySelector('#vtgs').innerHTML = meter(out.value); const lv = root.querySelector('#vtlv'); if (lv) lv.textContent = oo.kind === 'pin' ? (oo.pinLen || 6) : oo.len; };
    root.querySelectorAll('[data-k]').forEach(b => b.onclick = () => { data.settings.gen = Object.assign(genOpts(), { kind: b.dataset.k }); persist(); drawGen(); });
    const l = root.querySelector('#vtl'); if (l) l.oninput = () => { data.settings.gen = Object.assign(genOpts(), o.kind === 'pin' ? { pinLen: +l.value } : { len: +l.value }); make(); }; if (l) l.onchange = () => persist();
    const w = root.querySelector('#vtw'); if (w) { w.oninput = () => { data.settings.gen = Object.assign(genOpts(), { words: +w.value }); w.nextElementSibling.textContent = w.value; make(); }; w.onchange = () => persist(); }
    [['#vtcap', 'caps'], ['#vtnum', 'num']].forEach(([s, k]) => { const c = root.querySelector(s); if (c) c.onchange = () => { save({ [k]: c.checked }); make(); }; });
    root.querySelectorAll('[data-o]').forEach(c => c.onchange = () => { save({ [c.dataset.o]: c.checked }); make(); });
    root.querySelector('#vtre').onclick = make; root.querySelector('#vtgc').onclick = () => out.value && copySecret(out.value, 'Password');
    make();
  }

  function drawHealth() {
    const it = data.items.filter(x => x.pw), by = {};
    it.forEach(x => (by[x.pw] = by[x.pw] || []).push(x));
    const weak = it.filter(x => strength(x.pw).score <= 2), reused = Object.values(by).filter(a => a.length > 1), old = it.filter(x => Date.now() - (x.pwAt || x.created || 0) > 365 * 864e5);
    const sec = (t, why, list) => '<div class="card"><b>' + t + ' (' + list.length + ')</b><div class="small mute" style="margin:2px 0 6px">' + why + '</div>' + (list.length ? list.map(x => '<div class="vt-row" data-id="' + esc(x.id) + '" style="cursor:pointer;padding:4px 0"><span style="flex:1">' + esc(x.title || host(x.url) || 'Untitled') + '</span><span class="small mute">' + esc(x.user || '') + '</span></div>').join('') : '<div class="small ok">None. 👍</div>') + '</div>';
    const score = it.length ? Math.round(100 * (1 - (weak.length + reused.reduce((a, g) => a + g.length, 0) * .7 + old.length * .3) / (it.length * 2))) : 100;
    shell(bar() + '<div class="card"><b>Vault check-up</b> <span class="mute small">checked on this PC; nothing is sent anywhere</span><div style="font-size:34px;font-weight:700;margin:6px 0">' + Math.max(0, score) + '<span class="small mute">/100</span></div><div class="small mute">' + it.length + ' passwords looked at. Fix weak and reused ones first: one leaked reused password opens every account that shares it.</div></div>' +
      sec('🔴 Weak', 'Short, common or easy to guess.', weak) + sec('🟠 Reused', 'The same password on more than one login.', [].concat(...reused)) + sec('🟡 Older than a year', 'Not changed in over a year.', old));
    wireBar();
    root.querySelectorAll('[data-id]').forEach(r => r.onclick = () => { sel = r.dataset.id; view = 'edit'; draw(); });
  }

  /* CSV from Edge, Chrome, Firefox, Bitwarden, 1Password, LastPass and most others */
  function parseCsv(t) {
    const rows = []; let row = [], f = '', qd = false;
    for (let i = 0; i < t.length; i++) { const c = t[i]; if (qd) { if (c === '"') { if (t[i + 1] === '"') { f += '"'; i++; } else qd = false; } else f += c; } else if (c === '"') qd = true; else if (c === ',') { row.push(f); f = ''; } else if (c === '\n' || c === '\r') { if (c === '\r' && t[i + 1] === '\n') i++; row.push(f); rows.push(row); row = []; f = ''; } else f += c; }
    if (f || row.length) { row.push(f); rows.push(row); }
    const head = (rows.shift() || []).map(h => h.trim().toLowerCase()), col = (...names) => head.findIndex(h => names.includes(h));
    const c = { title: col('name', 'title', 'login_name'), url: col('url', 'login_uri', 'website', 'web site', 'origin'), user: col('username', 'login_username', 'user name', 'email', 'login'), pw: col('password', 'login_password'), notes: col('note', 'notes', 'extra', 'comments'), tags: col('folder', 'grouping', 'tags', 'type') };
    if (c.pw < 0) return { error: 'This file has no “password” column. Export a CSV of passwords from your browser or password manager.' };
    return { items: rows.filter(r => r.length > 1 && r[c.pw]).map(r => ({ title: c.title >= 0 ? r[c.title] : '', url: c.url >= 0 ? r[c.url] : '', user: c.user >= 0 ? r[c.user] : '', pw: r[c.pw], notes: c.notes >= 0 ? r[c.notes] : '', tags: c.tags >= 0 ? r[c.tags] : '' })) };
  }
  const csvCell = s => '"' + String(s == null ? '' : s).replace(/"/g, '""') + '"';

  function drawSettings() {
    shell(bar() + '<div class="card"><b>Lock automatically</b><div class="small mute" style="margin:2px 0 6px">after this long without using Moundshroud</div><select id="vtlk">' + [1, 2, 5, 10, 15, 30, 60].map(m => '<option value="' + m + '"' + (lockMin() === m ? ' selected' : '') + '>' + m + ' minute' + (m > 1 ? 's' : '') + '</option>').join('') + '</select></div>' +
      '<div class="card"><b>Import</b><div class="small mute" style="margin:2px 0 6px;line-height:1.5">A CSV file of passwords exported from Edge (Settings › Passwords › ⋯ › Export), Chrome, Firefox, Bitwarden, 1Password or LastPass. Logins already in the vault are skipped. <b>Delete the CSV afterwards</b>: it is plain text.</div><input type="file" id="vtimp" accept=".csv,text/csv"></div>' +
      '<div class="card"><b>Export</b><div class="small mute" style="margin:2px 0 6px;line-height:1.5"><b>🔒 Encrypted copy</b> can only be opened with your master password; it is also in every Moundshroud backup. <b>Plain CSV</b> is readable by anyone who gets the file: use it only to move to another password manager.</div><button class="ib" id="vtxe">🔒 Encrypted copy</button> <button class="ib" id="vtxc">Plain CSV…</button></div>' +
      '<div class="card"><b>Change the master password</b><div style="display:grid;gap:6px;max-width:420px;margin-top:6px"><input type="password" id="vtc0" placeholder="Current master password" autocomplete="current-password"><input type="password" id="vtc1" placeholder="New master password" autocomplete="new-password"><div id="vtcs"></div><input type="password" id="vtc2" placeholder="New one again" autocomplete="new-password"><div><button class="ib" id="vtchg">Change it</button> <span class="small" id="vtcerr" style="color:var(--bad)"></span></div></div></div>' +
      '<div class="card"><b>Earlier versions</b><div class="small mute" style="margin:2px 0 6px">The last five saves are kept. Opening one asks for the master password it had then.</div><div id="vtvers" class="small mute">Loading…</div></div>' +
      '<div class="card small mute" style="line-height:1.55"><b>How it is protected.</b> The vault is encrypted with AES-256-GCM using a key made from your master password with PBKDF2-SHA-256 and ' + iter.toLocaleString() + ' rounds, on this PC, before it is saved to <code>data\\vault.json</code>. The master password is never stored. Copied passwords are removed from Moundshroud’s clipboard history and wiped from the clipboard after 30 seconds (Windows’ own clipboard history, Win+V, keeps its own copy if you switched it on). The AI and the buddy are never shown this page.</div>');
    wireBar();
    root.querySelector('#vtlk').onchange = e => { data.settings.lockMin = +e.target.value; persist(); };
    root.querySelector('#vtimp').onchange = async e => {
      const f = e.target.files[0]; if (!f) return; const r = parseCsv(await f.text()); if (r.error) return A.toast(r.error);
      const seen = new Set(data.items.map(x => (host(x.url) + '|' + x.user + '|' + x.pw).toLowerCase())), now = Date.now(); let n = 0;
      r.items.forEach(x => { const k = (host(x.url) + '|' + x.user + '|' + x.pw).toLowerCase(); if (seen.has(k)) return; seen.add(k); data.items.push(Object.assign({ id: uid(), created: now, updated: now, pwAt: now, fav: false }, x, { title: x.title || host(x.url) })); n++; });
      if (await persist()) A.toast('Imported ' + n + ' login' + (n === 1 ? '' : 's') + (r.items.length - n ? ' (' + (r.items.length - n) + ' already there)' : '') + '. Now delete the CSV file.');
      e.target.value = '';
    };
    const dl = (name, text, type) => { const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([text], { type })); a.download = name; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 4000); };
    root.querySelector('#vtxe').onclick = async () => { const r = await A.api('/api/vault'); dl('Moundshroud-vault-' + new Date().toISOString().slice(0, 10) + '.json', JSON.stringify(r.vault), 'application/json'); };
    root.querySelector('#vtxc').onclick = async () => { if (!(await A.confirm('The CSV file will contain every password in plain text. Anyone who opens it can read them. Export anyway?'))) return; dl('passwords.csv', ['name,url,username,password,note'].concat(data.items.map(x => [x.title, x.url, x.user, x.pw, x.notes].map(csvCell).join(','))).join('\r\n'), 'text/csv'); };
    const c1 = root.querySelector('#vtc1'); c1.oninput = () => { root.querySelector('#vtcs').innerHTML = meter(c1.value); };
    root.querySelector('#vtchg').onclick = async () => {
      const err = root.querySelector('#vtcerr'), cur = root.querySelector('#vtc0').value, a = c1.value, b = root.querySelector('#vtc2').value;
      try { const v = (await A.api('/api/vault')).vault; await open(await deriveKey(cur, unb64(v.salt), v.iter), v); } catch (e) { return err.textContent = 'The current master password is wrong.'; }
      if (a.length < 10 || strength(a).score < 3) return err.textContent = 'The new one is too easy to guess.';
      if (a !== b) return err.textContent = 'The new ones do not match.';
      salt = rnd(16); iter = ITER; key = await deriveKey(a, salt, iter);
      if (await persist()) { err.textContent = ''; A.toast('Master password changed.'); drawSettings(); }
    };
    A.api('/api/vault/versions').then(r => {
      const el = root.querySelector('#vtvers'); if (!el) return;
      el.innerHTML = r.versions.length ? r.versions.map(v => '<div style="display:flex;gap:6px;align-items:center;padding:2px 0"><span style="flex:1">' + new Date(v.at).toLocaleString() + '</span><button class="ib" data-old="' + v.n + '">Open this one</button></div>').join('') : 'None yet.';
      el.querySelectorAll('[data-old]').forEach(b => b.onclick = async () => { if (!(await A.confirm('Lock the vault and open the version from ' + b.parentElement.firstChild.textContent + '? If you unlock it, it replaces the current vault (the current one stays among the earlier versions).'))) return; const o = await A.api('/api/vault/older', { n: +b.dataset.old }); if (!o.vault) return A.toast('That copy could not be read.'); key = null; data = null; drawUnlock(o.vault, 'The version from ' + b.parentElement.firstChild.textContent + '.', true); });
    }).catch(() => { });
  }

  A.vault = {
    render(el) { root = el; draw(); el._cleanup = () => { root = null; }; },
    lock, get locked() { return locked(); },
    _test: { strength, generate, parseCsv }
  };
  try { if (A.cmd && A.cmd.reg) A.cmd.reg([{ title: 'Passwords', sub: 'The encrypted password vault', icon: '🔐', group: 'Go to', tags: 'password vault passwords logins keychain manager generator', run: () => A.tools.go('vault') }, { title: 'Lock the password vault', icon: '🔒', group: 'Do', tags: 'lock vault passwords', run: () => lock('Locked.') }]); } catch (e) { }
})();

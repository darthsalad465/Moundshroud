// Updates, the part you see: a quiet notice when a newer Moundshroud is out, the Updates box in Settings › Backup & data,
// and the "Update now" dialog. Nothing installs until you press Update now. The checking itself is lib/update.js; it only
// goes online when internet access is switched on.
(() => {
  const esc = t => String(t == null ? '' : t).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const get = () => A.api('/api/update/status').catch(() => null);
  const post = u => A.api(u, {}).catch(e => ({ error: e.message }));
  const ls = { get: k => { try { return localStorage.getItem(k); } catch (e) { return null; } }, set: (k, v) => { try { localStorage.setItem(k, v); } catch (e) { } } };
  const ago = t => { if (!t) return 'never'; const m = Math.round((Date.now() - t) / 60000); return m < 2 ? 'just now' : m < 60 ? m + ' minutes ago' : m < 1440 ? Math.round(m / 60) + ' hours ago' : Math.round(m / 1440) + ' days ago'; };

  /* the box inside Settings */
  async function render(host) {
    if (!host) return; const s = await get(); if (!s) { host.textContent = 'The update status could not be read.'; return; }
    let h = '';
    if (!s.enabled) h = '<div class="small mute">This copy has no update source, so it never looks for updates. New versions are installed by unzipping them over this folder.</div>';
    else {
      if (s.available) h += '<div style="margin-bottom:6px"><b>Version ' + esc(s.latest.version) + ' is available</b> (you have ' + esc(s.current) + ').</div><button class="pri" data-u="show">See what is new and update</button> ';
      else h += '<div class="small" style="margin-bottom:6px">' + (s.latest && !s.error ? 'You have the newest version.' : '') + '</div>';
      h += '<button class="ib" data-u="check">' + (s.busy === 'checking' ? 'Checking…' : 'Check now') + '</button>';
      h += '<div class="small mute" style="margin-top:6px">' + (s.internet ? 'Moundshroud looks once a day, while internet access is on. Last looked: ' + ago(s.lastCheck) + '.' : 'Internet access is off, so Moundshroud does not look for updates. Switch it on above to check.') + ' Nothing installs until you press Update now, and your notes, chats, passwords and settings are kept.</div>';
      if (s.error) h += '<div class="small" style="color:var(--warn);margin-top:4px">' + esc(s.error) + '</div>';
    }
    host.innerHTML = h;
    host.onclick = async e => {
      const b = e.target.closest('[data-u]'); if (!b) return;
      if (b.dataset.u === 'check') { b.disabled = true; b.textContent = 'Checking…'; const r = await post('/api/update/check'); if (r && !r.available && !r.error) A.toast('You are on the newest version (' + r.current + ').', 4000); render(host); }
      else if (b.dataset.u === 'show') dialog();
    };
  }

  /* what is new, and the Update now button */
  async function dialog() {
    const s = await get(); if (!s || !s.available) return A.toast('There is no newer version to install.');
    const old = document.getElementById('upddlg'); if (old) old.remove();
    const d = document.createElement('div'); d.id = 'upddlg'; d.className = 'upd-back';
    d.innerHTML = '<div class="upd-card" role="dialog" aria-label="Update Moundshroud"><h2 style="margin:0 0 6px">⬆ Moundshroud ' + esc(s.latest.version) + '</h2>' +
      '<div class="small mute" style="margin-bottom:10px">You have ' + esc(s.current) + (s.latest.date ? '. Released ' + esc(s.latest.date) : '') + '.</div>' +
      (s.latest.notes.length ? '<div style="font-weight:600;margin-bottom:4px">What is new</div><ul class="upd-notes">' + s.latest.notes.map(n => '<li>' + esc(n) + '</li>').join('') + '</ul>' : '') +
      '<div class="small mute" style="margin:10px 0">Moundshroud downloads it, checks every file is intact, then restarts in a few seconds. Your notes, chats, passwords and settings are not touched, and if the new version will not start, the one you have now is put back.</div>' +
      '<div id="updmsg" class="small" style="min-height:1.2em;margin-bottom:8px"></div>' +
      '<div class="row" style="gap:8px;justify-content:flex-end"><button class="ib" data-u="later">Later</button><button class="pri" data-u="go">Update now</button></div></div>';
    document.body.appendChild(d);
    const msg = t => { const m = d.querySelector('#updmsg'); if (m) m.textContent = t; };
    d.onclick = async e => {
      if (e.target === d) return d.remove();
      const b = e.target.closest('[data-u]'); if (!b) return;
      if (b.dataset.u === 'later') { ls.set('upd_later', s.latest.version); return d.remove(); }
      d.querySelectorAll('button').forEach(x => x.disabled = true); msg('Downloading and checking…');
      const r = await post('/api/update/install');
      if (!r || r.error) { msg(''); d.querySelectorAll('button').forEach(x => x.disabled = false); return A.notify('err', 'The update did not install. ' + ((r && r.error) || 'Moundshroud did not answer.') + (/nothing was changed/i.test((r && r.error) || '') ? '' : ' Nothing was changed.'), 9000); }
      msg('Installing… Moundshroud will be back in a moment.'); waitFor(r.version, d);
    };
  }

  /* the server restarts as the new version: wait for it, then load the new page */
  function waitFor(version, d) {
    const t0 = Date.now();
    const tick = async () => {
      let a = null; try { a = await (await fetch('/api/about', { cache: 'no-store' })).json(); } catch (e) { }
      if (a && a.version === version) { d && d.querySelector('#updmsg') && (d.querySelector('#updmsg').textContent = 'Done. Reloading…'); return setTimeout(() => location.reload(), 600); }
      if (a && Date.now() - t0 > 20000 && a.version !== version) return location.reload();           /* the old version came back: the result notice explains */
      if (Date.now() - t0 > 120000) return location.reload();
      setTimeout(tick, 1500);
    };
    setTimeout(tick, 2500);
  }

  /* on start: say how the last update went (once), or mention a new version (once per version, gently) */
  async function notice() {
    const s = await get(); if (!s) return;
    if (s.result) {
      A.notify(s.result.ok ? 'ok' : 'err', s.result.ok ? 'Updated to Moundshroud ' + s.result.to + '. See Guide › What is new.' : s.result.message, s.result.ok ? 6000 : 15000);
      post('/api/update/seen'); return;
    }
    if (s.available && ls.get('upd_told') !== s.latest.version) {
      ls.set('upd_told', s.latest.version);
      const n = A.notify('info', 'Moundshroud ' + s.latest.version + ' is available. Click to see what is new.', 12000);
      if (n && n.el) n.el.onclick = () => { n.close(); dialog(); };
    }
  }
  setTimeout(notice, 6000);

  A.updates = { render, dialog, notice };
})();

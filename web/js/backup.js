// Full backup and restore: one zip holding the server data (notes, flashcards, chats, prompts, reminders...) and everything this window remembers
// (settings, progress, chess careers and ratings, scores, favourites, playlists, weather and sky logs...). Used by Settings and Tools > Storage.
(() => {
  const KEYRE = /^(oa_|middlewatch\.)/, enc = new TextEncoder(), dec = new TextDecoder();
  const crcT = (() => { const t = new Uint32Array(256); for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0; } return t; })();
  const crc = u8 => { let c = 0xFFFFFFFF; for (let i = 0; i < u8.length; i++) c = crcT[(c ^ u8[i]) & 255] ^ (c >>> 8); return (c ^ 0xFFFFFFFF) >>> 0; };
  const fmt = b => b >= 1e9 ? (b / 1e9).toFixed(1) + ' GB' : b >= 1e6 ? Math.round(b / 1e6) + ' MB' : Math.max(1, Math.round(b / 1e3)) + ' KB';
  const stamp = () => new Date().toISOString().slice(0, 10);

  /* a plain (uncompressed) zip: simple, and any unzip tool can open it */
  function zipOf(files) {
    const parts = [], cen = [], dt = new Date(); let off = 0;
    const dosT = (dt.getHours() << 11) | (dt.getMinutes() << 5) | (dt.getSeconds() >> 1), dosD = ((dt.getFullYear() - 1980) << 9) | ((dt.getMonth() + 1) << 5) | dt.getDate();
    for (const f of files) {
      const name = enc.encode(f.name), c = crc(f.data), n = f.data.length, h = new DataView(new ArrayBuffer(30));
      h.setUint32(0, 0x04034b50, true); h.setUint16(4, 20, true); h.setUint16(6, 0x0800, true); h.setUint16(10, dosT, true); h.setUint16(12, dosD, true); h.setUint32(14, c, true); h.setUint32(18, n, true); h.setUint32(22, n, true); h.setUint16(26, name.length, true);
      parts.push(h.buffer, name, f.data);
      const ch = new DataView(new ArrayBuffer(46));
      ch.setUint32(0, 0x02014b50, true); ch.setUint16(4, 20, true); ch.setUint16(6, 20, true); ch.setUint16(8, 0x0800, true); ch.setUint16(12, dosT, true); ch.setUint16(14, dosD, true); ch.setUint32(16, c, true); ch.setUint32(20, n, true); ch.setUint32(24, n, true); ch.setUint16(28, name.length, true); ch.setUint32(42, off, true);
      cen.push(ch.buffer, name); off += 30 + name.length + n;
    }
    const csz = cen.reduce((a, b) => a + (b.byteLength || b.length), 0), end = new DataView(new ArrayBuffer(22));
    end.setUint32(0, 0x06054b50, true); end.setUint16(8, files.length, true); end.setUint16(10, files.length, true); end.setUint32(12, csz, true); end.setUint32(16, off, true);
    return new Blob([...parts, ...cen, end.buffer], { type: 'application/zip' });
  }
  function unzip(buf) {                        // reads stored (uncompressed) entries; returns {name: Uint8Array} or null
    const u = new Uint8Array(buf), v = new DataView(buf); let e = -1;
    for (let i = u.length - 22; i >= Math.max(0, u.length - 70000); i--) if (v.getUint32(i, true) === 0x06054b50) { e = i; break; }
    if (e < 0) return null; const n = v.getUint16(e + 10, true); let p = v.getUint32(e + 16, true); const out = {};
    for (let k = 0; k < n; k++) {
      if (v.getUint32(p, true) !== 0x02014b50) return null;
      const method = v.getUint16(p + 10, true), size = v.getUint32(p + 24, true), nl = v.getUint16(p + 28, true), xl = v.getUint16(p + 30, true), cl = v.getUint16(p + 32, true), lo = v.getUint32(p + 42, true), name = dec.decode(u.subarray(p + 46, p + 46 + nl));
      if (method !== 0) return null; const ds = lo + 30 + v.getUint16(lo + 26, true) + v.getUint16(lo + 28, true); out[name] = u.subarray(ds, ds + size); p += 46 + nl + xl + cl;
    }
    return out;
  }
  const browserKeys = () => { const o = {}; for (let i = 0; i < localStorage.length; i++) { const k = localStorage.key(i); if (KEYRE.test(k)) o[k] = localStorage.getItem(k); } return o; };

  async function make() {
    let handle = null;
    if (window.showSaveFilePicker) {           // ask where to save first (needs the click), so it can go straight to an external drive
      try { handle = await window.showSaveFilePicker({ suggestedName: 'Moundshroud-full-backup-' + stamp() + '.zip', types: [{ description: 'Moundshroud backup (zip)', accept: { 'application/zip': ['.zip'] } }] }); } catch (e) { if (e && e.name === 'AbortError') return; handle = null; }
    }
    A.toast('Backing up everything...', 5000);
    let srv; try { const r = await fetch('/api/backup'); if (!r.ok) throw 0; srv = new Uint8Array(await r.arrayBuffer()); } catch (e) { A.toast('The backup could not start. Is Moundshroud still running?', 5000); return; }
    const keys = browserKeys(), man = { app: 'moundshroud-full', version: 1, at: Date.now(), items: Object.keys(keys).length, serverBytes: srv.length };
    const blob = zipOf([{ name: 'moundshroud-full.json', data: enc.encode(JSON.stringify(man)) }, { name: 'server-backup.zip', data: srv }, { name: 'browser-settings.json', data: enc.encode(JSON.stringify({ app: 'moundshroud-settings', at: man.at, data: keys })) }]);
    try {
      if (handle) { const w = await handle.createWritable(); await w.write(blob); await w.close(); }
      else { const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = 'Moundshroud-full-backup-' + stamp() + '.zip'; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 8000); }
    } catch (e) { A.toast('Could not save the backup file: ' + (e.message || e), 6000); return; }
    ls.set('fullbackup', String(Date.now())); ls.set('settingsbackup', String(Date.now()));
    A.toast('Backed up ' + fmt(blob.size) + (handle ? '.' : ' to your Downloads folder.'), 6000); A.emit && A.emit('backup'); document.querySelectorAll('[data-fbage]').forEach(el => { el.innerHTML = ageHtml(); });
  }

  async function restoreFile(file) {
    const buf = await file.arrayBuffer(), z = unzip(buf);
    if (z && (z['moundshroud-full.json'] || z['atlas-full.json']) && z['server-backup.zip'] && z['browser-settings.json']) {
      let man = {}; try { man = JSON.parse(dec.decode(z['moundshroud-full.json'] || z['atlas-full.json'])); } catch (e) {}
      const set = JSON.parse(dec.decode(z['browser-settings.json'])), n = Object.keys(set.data || {}).length;
      if (!confirm('Restore this full backup from ' + new Date(man.at || Date.now()).toLocaleString() + '?\n\nIt replaces your notes with the same name, flashcards, chats, prompts, reminders, and ' + n + ' remembered settings and progress items (chess careers, scores, favourites...). Anything not in the backup is left alone. Moundshroud will reload.')) return;
      A.toast('Restoring...', 5000);
      let r; try { r = await (await fetch('/api/restore', { method: 'POST', body: z['server-backup.zip'] })).json(); } catch (e) { r = { error: 'The restore could not reach Moundshroud.' }; }
      if (r.error) return A.toast(r.error, 6000);
      Object.entries(set.data || {}).forEach(([k, v]) => { if (KEYRE.test(k)) localStorage.setItem(k, v); });
      A.toast('Restored ' + r.notes + ' notes, ' + r.files + ' data files and ' + n + ' settings.', 3000); setTimeout(() => location.reload(), 1400); return;
    }
    if (buf.byteLength > 4 && new Uint8Array(buf)[0] === 0x50) {         // an older server-only backup
      if (!confirm('This is an older Moundshroud backup (notes, flashcards, chats, prompts and reminders only). Restore it? Matching items are replaced.')) return;
      const r = await (await fetch('/api/restore', { method: 'POST', body: buf })).json(); if (r.error) return A.toast(r.error, 6000);
      A.toast('Restored ' + r.notes + ' notes and ' + r.files + ' data files'); setTimeout(() => location.reload(), 1200); return;
    }
    try { const j = JSON.parse(dec.decode(new Uint8Array(buf))); if ((j.app === 'moundshroud-settings' || j.app === 'atlas-settings') && j.data) { if (!confirm('Import ' + Object.keys(j.data).length + ' remembered settings items? They replace items with the same name. The page will reload.')) return; Object.entries(j.data).forEach(([k, v]) => { if (KEYRE.test(k)) localStorage.setItem(k, v); }); location.reload(); return; } } catch (e) {}
    A.toast('That is not a Moundshroud backup file.', 5000);
  }
  function pick() { const i = document.createElement('input'); i.type = 'file'; i.accept = '.zip,.json'; i.onchange = () => { if (i.files[0]) restoreFile(i.files[0]); }; i.click(); }

  const days = () => { const t = +ls.get('fullbackup', '0'); return t ? Math.floor((Date.now() - t) / 864e5) : null; };
  const ageHtml = () => { const d = days(); return d == null ? '<span style="color:var(--warn)">No full backup yet.</span>' : d === 0 ? '<span style="color:var(--ok)">Last full backup: today.</span>' : '<span style="color:' + (d > 30 ? 'var(--bad)' : d > 14 ? 'var(--warn)' : 'var(--ok)') + '">Last full backup: ' + d + ' day' + (d > 1 ? 's' : '') + ' ago.</span>'; };
  function card(el) {
    if (!el) return; const n = Object.keys(browserKeys()).length;
    el.innerHTML = '<div class="card"><b>🛟 Back up everything</b><div class="small mute" style="margin:4px 0 8px;line-height:1.5">One zip file with your notes, flashcards, chats, prompts, reminders and everything Moundshroud remembers (' + n + ' items: settings, study progress, chess careers and ratings, game scores, favourites, playlists, weather and sky logs). Save it to an external drive or cloud folder for safety. Not included: your imported songs (keep the originals), the offline libraries and the AI models (they can be downloaded again).</div><div class="row" style="gap:8px;flex-wrap:wrap"><button class="pri" id="fbmake">Back up everything now</button><button class="ib" id="fbpick">Restore from a backup</button><span class="small" data-fbage="1">' + ageHtml() + '</span></div></div>';
    el.querySelector('#fbmake').onclick = make; el.querySelector('#fbpick').onclick = pick;
  }
  A.backup = { make, pick, restoreFile, card, days, zipOf, unzip };

  /* a gentle nudge, at most once a day, when it has been a month */
  setTimeout(() => { try { const d = days(), today = new Date().toDateString(); if ((d == null || d >= 30) && ls.get('fullbackup_nag', '') !== today) { ls.set('fullbackup_nag', today); A.toast(d == null ? 'Tip: you have never made a full backup. Settings > Back up everything takes one click.' : 'It has been ' + d + ' days since your last full backup. Settings > Back up everything.', 9000); } } catch (e) {} }, 25000);
})();

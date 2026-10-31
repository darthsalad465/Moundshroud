// Your own music for the Music tab: import audio files (MP3, M4A, FLAC, OGG, OPUS, WAV...) and record with the microphone.
// Everything is stored on this PC in Moundshroud's own browser storage (IndexedDB 'atlas-music'): nothing is uploaded. Used by music-lib.js through window.MLMine.
(() => {
  /* ---------- storage ---------- */
  let idbP = null;
  const idb = () => idbP || (idbP = new Promise((res, rej) => { const r = indexedDB.open('atlas-music', 1); r.onupgradeneeded = () => { r.result.createObjectStore('files'); r.result.createObjectStore('meta'); }; r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error); }));
  const dbop = async (store, mode, fn) => { const d = await idb(); return new Promise((res, rej) => { const t = d.transaction(store, mode); let r; try { r = fn(t.objectStore(store)); } catch (e) { return rej(e); } t.oncomplete = () => res(r ? r.result : undefined); t.onerror = () => rej(t.error); t.onabort = () => rej(t.error); }); };

  /* ---------- tags (ID3v2/v1 for MP3, FLAC, Ogg Vorbis/Opus, M4A) ---------- */
  const dec = (b, enc) => { try { if (enc === 1 || enc === 2) { let le = true, s = 0; if (b[0] === 0xFE && b[1] === 0xFF) { le = false; s = 2; } else if (b[0] === 0xFF && b[1] === 0xFE) s = 2; else if (enc === 2) le = false; return new TextDecoder(le ? 'utf-16le' : 'utf-16be').decode(b.subarray(s)).replace(/\0+$/, ''); } return new TextDecoder(enc === 3 ? 'utf-8' : 'windows-1252').decode(b).replace(/\0+$/, ''); } catch (e) { return ''; } };
  const ss = (a, i) => ((a[i] & 127) << 21) | ((a[i + 1] & 127) << 14) | ((a[i + 2] & 127) << 7) | (a[i + 3] & 127);
  const id3v2 = buf => {
    const t = {}, v = buf[3], end = Math.min(buf.length, 10 + ss(buf, 6)); let p = 10;
    if (buf[5] & 64) { const es = v === 4 ? ss(buf, 10) : ((buf[10] << 24 | buf[11] << 16 | buf[12] << 8 | buf[13]) + 4); p += es; }
    const idl = v === 2 ? 3 : 4, hl = v === 2 ? 6 : 10;
    while (p + hl < end) {
      const id = String.fromCharCode(...buf.subarray(p, p + idl)); if (!/^[A-Z0-9]+$/.test(id)) break;
      const sz = v === 2 ? (buf[p + 3] << 16 | buf[p + 4] << 8 | buf[p + 5]) : v === 4 ? ss(buf, p + 4) : (buf[p + 4] * 16777216 + (buf[p + 5] << 16) + (buf[p + 6] << 8) + buf[p + 7]);
      const body = buf.subarray(p + hl, p + hl + sz); p += hl + sz; if (!body.length) continue; const txt = () => dec(body.subarray(1), body[0]).split('\0')[0].trim();
      if (id === 'TIT2' || id === 'TT2') t.title = txt(); else if (id === 'TPE1' || id === 'TP1') t.artist = txt(); else if (id === 'TALB' || id === 'TAL') t.album = txt(); else if (id === 'TCON' || id === 'TCO') t.genre = txt();
      else if (id === 'TYER' || id === 'TYE' || id === 'TDRC' || id === 'TDOR') t.year = t.year || +((txt().match(/\d{4}/) || [0])[0]) || undefined;
      else if ((id === 'APIC' || id === 'PIC') && !t.pic) { const enc = body[0]; let q = 1, mime = ''; if (id === 'APIC') { const e = body.indexOf(0, q); mime = String.fromCharCode(...body.subarray(q, e)); q = e + 1; } else { mime = body[1] === 0x50 ? 'image/png' : 'image/jpeg'; q = 4; } q += 1; if (enc === 1 || enc === 2) { while (q + 1 < body.length && !(body[q] === 0 && body[q + 1] === 0)) q += 2; q += 2; } else { q = body.indexOf(0, q) + 1; } if (q > 0 && q < body.length) t.pic = { mime: mime || 'image/jpeg', data: body.slice(q) }; }
    }
    return t;
  };
  const vorbisC = (b, t) => { const dv = new DataView(b.buffer, b.byteOffset, b.byteLength); let p = 0; const vl = dv.getUint32(p, true); p += 4 + vl; const n = dv.getUint32(p, true); p += 4; for (let i = 0; i < n && p + 4 <= b.length; i++) { const l = dv.getUint32(p, true); p += 4; const s = new TextDecoder().decode(b.subarray(p, p + l)); p += l; const k = s.indexOf('='); if (k < 0) continue; const key = s.slice(0, k).toUpperCase(), val = s.slice(k + 1); if (key === 'TITLE') t.title = val; else if (key === 'ARTIST') t.artist = val; else if (key === 'ALBUM') t.album = val; else if (key === 'GENRE') t.genre = val; else if (key === 'DATE' || key === 'YEAR') t.year = +((val.match(/\d{4}/) || [0])[0]) || undefined; } };
  const flacTags = buf => { const t = {}; let p = 4; while (p + 4 < buf.length) { const last = buf[p] & 128, type = buf[p] & 127, len = buf[p + 1] << 16 | buf[p + 2] << 8 | buf[p + 3], b = buf.subarray(p + 4, p + 4 + len); if (type === 4) { try { vorbisC(b, t); } catch (e) { } } else if (type === 6 && !t.pic) { try { const dv = new DataView(b.buffer, b.byteOffset, b.byteLength); let q = 4; const ml = dv.getUint32(q); q += 4; const mime = new TextDecoder().decode(b.subarray(q, q + ml)); q += ml; const dl = dv.getUint32(q); q += 4 + dl + 16; const n = dv.getUint32(q); q += 4; t.pic = { mime, data: b.slice(q, q + n) }; } catch (e) { } } p += 4 + len; if (last) break; } return t; };
  const oggTags = buf => { const t = {}, hay = buf.subarray(0, Math.min(buf.length, 200000)); const find = s => { const sb = new TextEncoder().encode(s); outer: for (let i = 0; i < hay.length - sb.length; i++) { for (let j = 0; j < sb.length; j++) if (hay[i + j] !== sb[j]) continue outer; return i + sb.length; } return -1; }; let p = find('\x03vorbis'); if (p < 0) p = find('OpusTags'); if (p > 0) { try { vorbisC(hay.subarray(p), t); } catch (e) { } } return t; };
  const m4aTags = buf => {
    const t = {}, td = new TextDecoder(), at = sig => { for (let i = 4; i < buf.length - 8; i++) if (buf[i] === sig[0] && buf[i + 1] === sig[1] && buf[i + 2] === sig[2] && buf[i + 3] === sig[3]) return i; return -1; };
    const text = sig => { const i = at(sig); if (i < 0) return ''; const dp = i + 4; if (String.fromCharCode(...buf.subarray(dp + 4, dp + 8)) !== 'data') return ''; const size = buf[dp] << 24 | buf[dp + 1] << 16 | buf[dp + 2] << 8 | buf[dp + 3]; return td.decode(buf.subarray(dp + 16, dp + size)); };
    t.title = text([0xA9, 0x6E, 0x61, 0x6D]); t.artist = text([0xA9, 0x41, 0x52, 0x54]); t.album = text([0xA9, 0x61, 0x6C, 0x62]); t.genre = text([0xA9, 0x67, 0x65, 0x6E]); t.year = +((text([0xA9, 0x64, 0x61, 0x79]).match(/\d{4}/) || [0])[0]) || undefined;
    const ci = at([0x63, 0x6F, 0x76, 0x72]); if (ci > 0) { const dp = ci + 4, size = buf[dp] << 24 | buf[dp + 1] << 16 | buf[dp + 2] << 8 | buf[dp + 3]; if (String.fromCharCode(...buf.subarray(dp + 4, dp + 8)) === 'data') t.pic = { mime: buf[dp + 11] === 14 ? 'image/png' : 'image/jpeg', data: buf.slice(dp + 16, dp + size) }; } return t;
  };
  const readTags = async file => {
    let t = {};
    try {
      const head = new Uint8Array(await file.slice(0, 10).arrayBuffer());
      if (head[0] === 0x49 && head[1] === 0x44 && head[2] === 0x33) { const buf = new Uint8Array(await file.slice(0, Math.min(file.size, ss(head, 6) + 10, 12e6)).arrayBuffer()); t = id3v2(buf); }
      else { const buf = new Uint8Array(await file.slice(0, 2e6).arrayBuffer()), sig = String.fromCharCode(...buf.subarray(0, 4)); if (sig === 'fLaC') t = flacTags(buf); else if (sig === 'OggS') t = oggTags(buf); else if (String.fromCharCode(...buf.subarray(4, 8)) === 'ftyp') t = m4aTags(buf); }
      if (!t.title && /\.mp3$/i.test(file.name) && file.size > 200) { const tail = new Uint8Array(await file.slice(file.size - 128).arrayBuffer()); if (tail[0] === 0x54 && tail[1] === 0x41 && tail[2] === 0x47) { const s = (a, b) => new TextDecoder('windows-1252').decode(tail.subarray(a, b)).replace(/\0.*$/, '').trim(); t.title = s(3, 33); t.artist = t.artist || s(33, 63); t.album = t.album || s(63, 93); t.year = t.year || +s(93, 97) || undefined; } }
    } catch (e) { }
    return t;
  };
  const fromName = name => { const s = name.replace(/\.[^.]+$/, '').replace(/_/g, ' ').replace(/^\d{1,3}\s*[-.)]\s*/, '').trim(), m = s.split(/\s+-\s+/); return m.length >= 2 ? { artist: m[0].trim(), title: m.slice(1).join(' - ').trim() } : { title: s }; };
  const coverUrl = async pic => { try { const bm = await createImageBitmap(new Blob([pic.data], { type: pic.mime })), c = document.createElement('canvas'), k = Math.min(1, 180 / Math.max(bm.width, bm.height)); c.width = Math.max(1, Math.round(bm.width * k)); c.height = Math.max(1, Math.round(bm.height * k)); c.getContext('2d').drawImage(bm, 0, 0, c.width, c.height); return c.toDataURL('image/jpeg', .8); } catch (e) { return ''; } };
  const durOf = file => new Promise(res => { const a = new Audio(), u = URL.createObjectURL(file); let fin = false; const done = d => { if (fin) return; fin = true; URL.revokeObjectURL(u); res(d); }; a.preload = 'metadata'; a.onloadedmetadata = () => done(isFinite(a.duration) ? Math.round(a.duration) : 0); a.onerror = () => done(-1); setTimeout(() => done(0), 8000); a.src = u; });
  const GENRES = ['Blues', 'Classic Rock', 'Country', 'Dance', 'Disco', 'Funk', 'Grunge', 'Hip-Hop', 'Jazz', 'Metal', 'New Age', 'Oldies', 'Other', 'Pop', 'R&B', 'Rap', 'Reggae', 'Rock', 'Techno', 'Industrial', 'Alternative', 'Ska', 'Death Metal', 'Pranks', 'Soundtrack', 'Euro-Techno', 'Ambient', 'Trip-Hop', 'Vocal', 'Jazz+Funk', 'Fusion', 'Trance', 'Classical', 'Instrumental', 'Acid', 'House', 'Game', 'Sound Clip', 'Gospel', 'Noise', 'Alt Rock', 'Bass', 'Soul', 'Punk', 'Space', 'Meditative', 'Instrumental Pop', 'Instrumental Rock', 'Ethnic', 'Gothic', 'Darkwave', 'Techno-Industrial', 'Electronic', 'Pop-Folk', 'Eurodance', 'Dream', 'Southern Rock', 'Comedy', 'Cult', 'Gangsta', 'Top 40', 'Christian Rap', 'Pop/Funk', 'Jungle', 'Native American', 'Cabaret', 'New Wave', 'Psychedelic', 'Rave', 'Showtunes', 'Trailer', 'Lo-Fi', 'Tribal', 'Acid Punk', 'Acid Jazz', 'Polka', 'Retro', 'Musical', 'Rock & Roll', 'Hard Rock'];
  const cleanGenre = g => { g = String(g || '').trim(); const m = /^\(?(\d{1,3})\)?$/.exec(g); if (m) g = GENRES[+m[1]] || ''; g = g.replace(/^\(\d+\)/, '').trim(); if (!g) return 'My Music'; return g.length > 40 ? 'My Music' : g.replace(/\b\w/g, c => c.toUpperCase()); };

  /* ---------- the library of your own songs ---------- */
  const AUDIO_RX = /\.(mp3|m4a|aac|flac|ogg|oga|opus|wav|webm|weba)$/i;
  const M = {
    isAudio: f => AUDIO_RX.test(f.name) || /^audio\//.test(f.type || ''),
    list: () => dbop('meta', 'readonly', s => s.getAll()).then(a => (a || []).sort((x, y) => (x.added || 0) - (y.added || 0))).catch(() => []),
    blob: id => dbop('files', 'readonly', s => s.get(id)).then(r => r && r.blob),
    async add(file, existing) {
      const sig = file.name + '|' + file.size; if (existing && existing.has(sig)) return { dup: true };
      const d = await durOf(file); if (d < 0) return { bad: true };
      const tg = await readTags(file), nm = fromName(file.name), id = 'my:' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
      const t = { i: id, my: 1, sig, sz: file.size, t: (tg.title || nm.title || file.name).slice(0, 120), a: (tg.artist || nm.artist || 'Unknown artist').slice(0, 80), al: (tg.album || '').slice(0, 80), g: cleanGenre(tg.genre), y: tg.year, d, lic: 'Your own file', c: 'Imported by you from ' + file.name, m: [], added: Date.now(), cv: tg.pic ? await coverUrl(tg.pic) : '' };
      await dbop('files', 'readwrite', s => s.put({ blob: file, name: file.name, type: file.type }, id)); await dbop('meta', 'readwrite', s => s.put(t, id)); if (existing) existing.add(sig); return { meta: t };
    },
    async saveRecording(blob, secs, info) {
      const id = 'my:rec' + Date.now().toString(36), t = { i: id, my: 1, rec: 1, sig: 'rec|' + id, sz: blob.size, t: (info.title || 'Recording ' + new Date().toLocaleString()).slice(0, 120), a: (info.artist || 'Me').slice(0, 80), al: (info.album || 'My Recordings').slice(0, 80), g: info.genre || 'My Recordings', y: new Date().getFullYear(), d: secs, lic: 'Recorded by you', c: 'Recorded in Moundshroud', m: [], added: Date.now(), cv: '' };
      await dbop('files', 'readwrite', s => s.put({ blob, name: t.t, type: blob.type }, id)); await dbop('meta', 'readwrite', s => s.put(t, id)); return t;
    },
    async update(id, patch) { const t = await dbop('meta', 'readonly', s => s.get(id)); if (!t) return null; Object.assign(t, patch); await dbop('meta', 'readwrite', s => s.put(t, id)); return t; },
    async remove(id) { await dbop('files', 'readwrite', s => s.delete(id)); await dbop('meta', 'readwrite', s => s.delete(id)); },
    async clear() { await dbop('files', 'readwrite', s => s.clear()); await dbop('meta', 'readwrite', s => s.clear()); },
    persist: () => { try { return navigator.storage && navigator.storage.persist ? navigator.storage.persist() : null; } catch (e) { return null; } },
    estimate: () => { try { return navigator.storage.estimate(); } catch (e) { return Promise.resolve({}); } },
    // files from a drag and drop, including whole folders (the entries must be read synchronously, so call this inside the drop handler)
    filesFromDrop(dt) {
      const out = [], items = dt.items ? [...dt.items] : [], entries = items.map(i => i.webkitGetAsEntry && i.webkitGetAsEntry()).filter(Boolean), plain = [...(dt.files || [])];
      if (!entries.length) return Promise.resolve(plain);
      const walk = async en => { if (en.isFile) await new Promise(r => en.file(f => { out.push(f); r(); }, r)); else if (en.isDirectory) { const rd = en.createReader(); let batch; do { batch = await new Promise(r => rd.readEntries(r, () => r([]))); for (const c of batch) await walk(c); } while (batch.length); } };
      return Promise.all(entries.map(walk)).then(() => out);
    },
    readTags, cleanGenre, fromName,
  };

  /* ---------- recording from the microphone ---------- */
  const rec = M.rec = { state: 'idle', mr: null, chunks: [], t0: 0, secs: 0, stream: null, ac: null, an: null, blob: null, url: '', err: '', level: 0, iv: 0, raf: 0, onchange: null };
  const fire = () => { try { rec.onchange && rec.onchange(); } catch (e) { } };
  const cleanup = () => { clearInterval(rec.iv); cancelAnimationFrame(rec.raf); try { rec.stream && rec.stream.getTracks().forEach(t => t.stop()); } catch (e) { } try { rec.ac && rec.ac.close(); } catch (e) { } rec.stream = null; rec.ac = null; };
  rec.start = async () => {
    try {
      rec.err = ''; if (rec.url) { try { URL.revokeObjectURL(rec.url); } catch (e) { } rec.url = ''; } rec.blob = null;
      if (!window.MediaRecorder) throw new Error('This browser cannot record audio.');
      const stream = window.__mlTestStream || await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false } });
      rec.stream = stream; const Ctx = window.AudioContext || window.webkitAudioContext; rec.ac = new Ctx(); const src = rec.ac.createMediaStreamSource(stream); rec.an = rec.ac.createAnalyser(); rec.an.fftSize = 1024; src.connect(rec.an);
      const mime = ['audio/webm;codecs=opus', 'audio/ogg;codecs=opus', 'audio/webm'].find(m => MediaRecorder.isTypeSupported(m)); rec.mr = new MediaRecorder(stream, mime ? { mimeType: mime, audioBitsPerSecond: 192000 } : {}); rec.chunks = [];
      rec.mr.ondataavailable = e => { if (e.data && e.data.size) rec.chunks.push(e.data); };
      rec.mr.onstop = () => { rec.secs = Math.max(1, Math.round((Date.now() - rec.t0) / 1000)); rec.blob = new Blob(rec.chunks, { type: (rec.mr && rec.mr.mimeType) || 'audio/webm' }); rec.url = URL.createObjectURL(rec.blob); rec.state = 'review'; cleanup(); fire(); };
      rec.mr.start(250); rec.t0 = Date.now(); rec.state = 'rec'; const buf = new Uint8Array(rec.an.fftSize);
      const loop = () => { if (rec.state !== 'rec' || !rec.an) return; rec.an.getByteTimeDomainData(buf); let pk = 0; for (let i = 0; i < buf.length; i++) pk = Math.max(pk, Math.abs(buf[i] - 128)); rec.level = Math.min(1, pk / 100); rec.raf = requestAnimationFrame(loop); }; loop();
      rec.iv = setInterval(() => { rec.secs = Math.round((Date.now() - rec.t0) / 1000); fire(); }, 200); fire();
    } catch (e) { cleanup(); rec.state = 'idle'; rec.err = /Permission|NotAllowed|denied/i.test(e.name + e.message) ? 'Moundshroud was not allowed to use the microphone. Allow it for this window and try again.' : /NotFound|Devices/i.test(e.name + e.message) ? 'No microphone was found.' : (e.message || 'Could not start recording.'); fire(); }
  };
  rec.stop = () => { if (rec.mr && rec.mr.state !== 'inactive') rec.mr.stop(); };
  rec.discard = () => { cleanup(); try { if (rec.mr && rec.mr.state !== 'inactive') { rec.mr.onstop = null; rec.mr.stop(); } } catch (e) { } if (rec.url) { try { URL.revokeObjectURL(rec.url); } catch (e) { } } rec.state = 'idle'; rec.blob = null; rec.url = ''; rec.secs = 0; rec.err = ''; fire(); };
  window.MLMine = M;
})();

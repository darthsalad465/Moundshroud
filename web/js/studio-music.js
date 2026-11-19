// Studio > Music studio: a pattern-based composer. Drum machine (kick, snare, hats, clap, tom, cowbell), bass and lead piano rolls with four synth voices,
// four patterns (A-D) chained into a song, tempo and swing, a playable on-screen keyboard, and WAV export. The same render code (OfflineAudioContext) plays
// and exports, so what you hear is what you save. Songs can be saved in the studio or added to Music > My songs.
(() => {
  if (!A.studio) return; const esc2 = A.studio.esc;
  const STEPS = 16, DR = [['kick', 'Kick'], ['snare', 'Snare'], ['hat', 'Hi-hat'], ['ohat', 'Open hat'], ['clap', 'Clap'], ['tom', 'Tom'], ['cow', 'Cowbell']];
  const SCALES = { 'Major': [0, 2, 4, 5, 7, 9, 11], 'Minor': [0, 2, 3, 5, 7, 8, 10], 'Pentatonic': [0, 2, 4, 7, 9], 'Blues': [0, 3, 5, 6, 7, 10], 'Dorian': [0, 2, 3, 5, 7, 9, 10] };
  const NOTES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
  const VOICES = { square: 'Chiptune square', saw: 'Saw lead', sine: 'Soft sine', pluck: 'Pluck', tri: 'Triangle' };
  const midiHz = m => 440 * Math.pow(2, (m - 69) / 12);
  const blank = () => ({ drums: Object.fromEntries(DR.map(d => [d[0], Array(STEPS).fill(0)])), bass: Array(STEPS).fill(-1), lead: Array(STEPS).fill(-1) });
  const DEMO = () => { const p = blank(); [0, 4, 8, 12].forEach(i => p.drums.kick[i] = 1); [4, 12].forEach(i => p.drums.snare[i] = 1); for (let i = 0; i < 16; i += 2) p.drums.hat[i] = 1; p.drums.ohat[14] = 1; [0, 3, 6, 8, 11, 14].forEach((s, k) => p.bass[s] = [0, 0, 3, 5, 3, 7][k]); [0, 2, 4, 7, 8, 10, 12].forEach((s, k) => p.lead[s] = [7, 10, 12, 14, 12, 10, 7][k]); return p; };
  /* ---- one-voice scheduling on any BaseAudioContext ---- */
  function noise(ctx) { const b = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate), d = b.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1; return b; }
  function drum(ctx, out, nb, kind, t, vol = 1) {
    const g = ctx.createGain(); g.connect(out);
    const nz = (dur, f1, type, q) => { const s = ctx.createBufferSource(); s.buffer = nb; const f = ctx.createBiquadFilter(); f.type = type; f.frequency.value = f1; if (q) f.Q.value = q; s.connect(f); f.connect(g); s.start(t, Math.random() * .5, dur); };
    if (kind === 'kick') { const o = ctx.createOscillator(); o.frequency.setValueAtTime(150, t); o.frequency.exponentialRampToValueAtTime(42, t + .12); g.gain.setValueAtTime(1.1 * vol, t); g.gain.exponentialRampToValueAtTime(.001, t + .35); o.connect(g); o.start(t); o.stop(t + .4); }
    else if (kind === 'snare') { g.gain.setValueAtTime(.7 * vol, t); g.gain.exponentialRampToValueAtTime(.001, t + .2); nz(.22, 1800, 'highpass'); const o = ctx.createOscillator(); o.frequency.setValueAtTime(220, t); o.frequency.exponentialRampToValueAtTime(120, t + .1); const og = ctx.createGain(); og.gain.setValueAtTime(.5 * vol, t); og.gain.exponentialRampToValueAtTime(.001, t + .12); o.connect(og); og.connect(out); o.start(t); o.stop(t + .15); }
    else if (kind === 'hat') { g.gain.setValueAtTime(.32 * vol, t); g.gain.exponentialRampToValueAtTime(.001, t + .05); nz(.06, 7000, 'highpass'); }
    else if (kind === 'ohat') { g.gain.setValueAtTime(.3 * vol, t); g.gain.exponentialRampToValueAtTime(.001, t + .28); nz(.3, 6500, 'highpass'); }
    else if (kind === 'clap') { g.gain.setValueAtTime(0, t); for (let i = 0; i < 3; i++) { g.gain.linearRampToValueAtTime(.6 * vol, t + i * .012 + .002); g.gain.linearRampToValueAtTime(.05, t + i * .012 + .01); } g.gain.linearRampToValueAtTime(.5 * vol, t + .04); g.gain.exponentialRampToValueAtTime(.001, t + .22); nz(.25, 1200, 'bandpass', 1.2); }
    else if (kind === 'tom') { const o = ctx.createOscillator(); o.frequency.setValueAtTime(190, t); o.frequency.exponentialRampToValueAtTime(80, t + .25); g.gain.setValueAtTime(.8 * vol, t); g.gain.exponentialRampToValueAtTime(.001, t + .3); o.connect(g); o.start(t); o.stop(t + .35); }
    else if (kind === 'cow') { g.gain.setValueAtTime(.3 * vol, t); g.gain.exponentialRampToValueAtTime(.001, t + .35); [562, 845].forEach(f => { const o = ctx.createOscillator(); o.type = 'square'; o.frequency.value = f; o.connect(g); o.start(t); o.stop(t + .4); }); }
  }
  function tone(ctx, out, voice, midi, t, dur, vol = .3) {
    const hz = midiHz(midi), g = ctx.createGain(); g.connect(out); const o = ctx.createOscillator(); o.type = voice === 'saw' ? 'sawtooth' : voice === 'sine' ? 'sine' : voice === 'tri' ? 'triangle' : 'square'; o.frequency.value = hz;
    let node = o; if (voice === 'saw' || voice === 'pluck') { const f = ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.setValueAtTime(voice === 'pluck' ? 4500 : 3200, t); if (voice === 'pluck') f.frequency.exponentialRampToValueAtTime(400, t + Math.min(dur, .4)); o.connect(f); node = f; }
    node.connect(g); const rel = voice === 'pluck' ? .25 : .06; g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(vol, t + .008); if (voice === 'pluck') g.gain.exponentialRampToValueAtTime(.001, t + Math.max(dur, .3)); else { g.gain.setValueAtTime(vol * .85, t + Math.max(.01, dur - .02)); g.gain.linearRampToValueAtTime(0, t + dur + rel); }
    o.start(t); o.stop(t + dur + rel + .3);
  }
  function schedule(ctx, S, startAt) {
    const master = ctx.createGain(); master.gain.value = .8; const comp = ctx.createDynamicsCompressor(); master.connect(comp); comp.connect(ctx.destination); const nb = noise(ctx);
    const sp = 60 / S.bpm / 4, order = S.chain.length ? S.chain : [0]; let t = startAt;
    order.forEach(pi => { const p = S.pats[pi]; for (let i = 0; i < STEPS; i++) { const sw = i % 2 ? sp * S.swing * .5 : 0, tt = t + i * sp + sw;
      DR.forEach(d => { if (p.drums[d[0]][i]) drum(ctx, master, nb, d[0], tt); });
      const base = 48 + S.key; if (p.bass[i] >= 0) tone(ctx, master, S.bassVoice, base - 12 + scaleNote(S, p.bass[i]), tt, sp * 1.8, .38);
      if (p.lead[i] >= 0) tone(ctx, master, S.leadVoice, base + 12 + scaleNote(S, p.lead[i]), tt, sp * 1.6, .22); }
      t += STEPS * sp; });
    return t - startAt;
  }
  const scaleNote = (S, deg) => { const sc = SCALES[S.scale], oct = Math.floor(deg / sc.length); return sc[((deg % sc.length) + sc.length) % sc.length] + 12 * oct; };
  function wavBlob(buf) { const ch = buf.numberOfChannels, n = buf.length, sr = buf.sampleRate, out = new DataView(new ArrayBuffer(44 + n * ch * 2)); const w = (o, s) => { for (let i = 0; i < s.length; i++) out.setUint8(o + i, s.charCodeAt(i)); };
    w(0, 'RIFF'); out.setUint32(4, 36 + n * ch * 2, true); w(8, 'WAVE'); w(12, 'fmt '); out.setUint32(16, 16, true); out.setUint16(20, 1, true); out.setUint16(22, ch, true); out.setUint32(24, sr, true); out.setUint32(28, sr * ch * 2, true); out.setUint16(32, ch * 2, true); out.setUint16(34, 16, true); w(36, 'data'); out.setUint32(40, n * ch * 2, true);
    const d = []; for (let c = 0; c < ch; c++) d.push(buf.getChannelData(c)); let o = 44; for (let i = 0; i < n; i++) for (let c = 0; c < ch; c++) { const v = Math.max(-1, Math.min(1, d[c][i])); out.setInt16(o, v < 0 ? v * 0x8000 : v * 0x7fff, true); o += 2; } return new Blob([out], { type: 'audio/wav' }); }
  async function renderSong(S) { const sp = 60 / S.bpm / 4, len = Math.max(1, S.chain.length) * STEPS * sp + 1.2, sr = 44100, ctx = new OfflineAudioContext(2, Math.ceil(len * sr), sr); schedule(ctx, S, .05); return ctx.startRendering(); }

  A.studio.reg('music', '🎹 Music studio', body => {
    const root = document.createElement('div'); root.className = 'scroll pad'; root.style.flex = '1'; body.appendChild(root); const q = s => root.querySelector(s);
    let S; try { S = JSON.parse(ls.get('mstudio', 'null')); } catch (e) { } if (!S || !S.pats) S = { bpm: 110, swing: 0, key: 0, scale: 'Minor', bassVoice: 'saw', leadVoice: 'square', pats: [DEMO(), blank(), blank(), blank()], chain: [0], name: 'My song' };
    let cur = 0, ac = null, playTimer = 0, playing = false, track = 'drums', keyAc = null;
    /* which engine makes the song: the MusicGen model (a real audio clip) or Qwen (writes the song into this studio) */
    const ENGINES = [['musicgen', '🎧 MusicGen', 'the AI music model records a real audio clip on your PC'], ['qwen', '🧠 Qwen', 'the local AI writes drums, bass and melody into this studio, so you can change every note'], ['auto', '♻ Auto', 'try MusicGen first, and let Qwen write it if that model is missing or fails']];
    let engine = ls.get('mcompose_engine', 'auto') || 'auto', mgOk = false;
    const engineNote = () => { const el = q('#mcs'); if (!el) return; el.textContent = engine === 'qwen' ? 'Qwen writes the song into the studio.' : mgOk ? 'MusicGen is ready: Compose records a real audio clip.' : engine === 'musicgen' ? 'MusicGen is not installed. Run install-music-model.ps1, or pick Qwen.' : 'MusicGen is not installed, so Qwen will write the song.'; };
    const save = () => { try { ls.set('mstudio', JSON.stringify(S)); } catch (e) { } };
    const P = () => S.pats[cur];
    root.innerHTML = '<div class="row" style="gap:8px;align-items:center;flex-wrap:wrap;margin-bottom:8px"><h2 style="margin:0">🎹 Music studio</h2><input id="mn" type="text" style="width:150px" maxlength="40"><span class="sp"></span><button class="pri" id="mplay">▶ Play</button><button class="ib" id="mwav">⬇ WAV</button><button class="ib" id="mmine">➕ Add to My songs</button></div>' +
      '<div class="card" style="margin:0 0 10px"><div class="row" style="gap:12px;align-items:center;flex-wrap:wrap"><label class="small mute">Tempo <input id="mbpm" type="range" min="60" max="200" style="width:110px"> <b id="mbpmv"></b></label><label class="small mute">Swing <input id="msw" type="range" min="0" max="60" style="width:80px"></label><label class="small mute">Key <select id="mkey">' + NOTES.map((n, i) => '<option value="' + i + '">' + n + '</option>').join('') + '</select></label><label class="small mute">Scale <select id="msc">' + Object.keys(SCALES).map(s => '<option>' + s + '</option>').join('') + '</select></label><label class="small mute">Bass <select id="mbv">' + Object.entries(VOICES).map(v => '<option value="' + v[0] + '">' + v[1] + '</option>').join('') + '</select></label><label class="small mute">Lead <select id="mlv">' + Object.entries(VOICES).map(v => '<option value="' + v[0] + '">' + v[1] + '</option>').join('') + '</select></label></div></div>' +
      '<div class="row" style="gap:6px;align-items:center;flex-wrap:wrap;margin-bottom:8px"><b class="small">Pattern</b><div id="mpat" style="display:flex;gap:4px"></div><button class="ib" id="mcpy" title="Copy this pattern into another">⧉ Copy to…</button><button class="ib" id="mclr">Clear</button><button class="ib" id="mrand" title="Fill with a random idea in the chosen key">🎲 Surprise me</button><span class="sp"></span><b class="small">Song order</b><input id="mchain" type="text" style="width:110px" title="Patterns played in order, e.g. AABA" placeholder="AABA"><span class="small mute" id="mlen"></span></div>' +
      '<div class="row" style="gap:4px;margin-bottom:6px"><button class="ib" data-tr="drums">🥁 Drums</button><button class="ib" data-tr="bass">🎸 Bass</button><button class="ib" data-tr="lead">🎹 Lead</button></div><div id="mgrid" style="overflow-x:auto"></div>' +
      '<div class="card" style="margin:0 0 12px"><b>✨ Compose from words</b> <span class="small mute">Describe the music, then choose the engine. <b>MusicGen</b> records a real audio clip on your PC. <b>Qwen</b> writes the drums, bass and melody straight into this studio, so you can change every note and export a WAV. <b>Auto</b> tries MusicGen first and falls back to Qwen. Nothing leaves your computer.</span><textarea id="mcp" rows="2" placeholder="e.g. a calm lofi beat for studying, or an intense boss fight with fast drums" style="width:100%;margin-top:6px"></textarea><div class="row" style="gap:6px;flex-wrap:wrap;margin:6px 0" id="mcc">' + ['Chill lofi beat', 'Epic boss fight', 'Sad slow piano-style tune', 'Happy chiptune', 'Spooky night', 'Upbeat funk groove', 'Peaceful morning', 'Marching adventure'].map(x => '<button class="chip" data-i="' + x + '">' + x + '</button>').join('') + '</div><div class="row" style="gap:8px;align-items:center;flex-wrap:wrap;margin:0 0 6px"><b class="small">Engine</b><div id="mce" style="display:flex;gap:4px;flex-wrap:wrap"></div><span class="small mute" id="mcen"></span></div>' + '<div class="row" style="gap:8px;align-items:center;flex-wrap:wrap"><button class="pri" id="mcg">✨ Compose</button><label class="chk small" title="Look the idea up on the web first (DuckDuckGo) and let the local AI turn what it reads into a short description of the style, instruments and mood. Needs internet access switched on in Settings, AI &amp; power." style="margin:0"><input type="checkbox" id="mcweb"> &#127760; Look it up</label><label class="small mute">AI clip length <select id="mcl"><option value="10">10 s</option><option value="15" selected>15 s</option><option value="30">30 s</option></select></label><button class="ib" id="mcr" disabled>↶ Bring back my previous song</button><span class="small mute" id="mcs"></span></div><div class="small mute" id="mcwscr" style="margin-top:4px"></div><div id="mca" style="margin-top:8px"></div></div>' +
      '<div class="card" style="margin:12px 0 0"><b>Keyboard</b> <span class="small mute">Play live with the mouse or the keys A S D F G H J K (and W E T Y U for sharps). Uses the lead voice.</span><div id="mkb" style="display:flex;position:relative;height:96px;margin-top:8px;user-select:none"></div></div>' +
      '<div class="small mute" style="margin-top:10px">Tip: click cells to place notes. On Bass and Lead the rows are scale degrees, so every note fits the key you picked. Nothing leaves your computer.</div>';
    const setUI = () => { q('#mn').value = S.name; q('#mbpm').value = S.bpm; q('#mbpmv').textContent = S.bpm; q('#msw').value = S.swing * 100; q('#mkey').value = S.key; q('#msc').value = S.scale; q('#mbv').value = S.bassVoice; q('#mlv').value = S.leadVoice; q('#mchain').value = S.chain.map(i => 'ABCD'[i]).join(''); q('#mlen').textContent = Math.round(S.chain.length * STEPS * 60 / S.bpm / 4) + ' s'; q('#mpat').innerHTML = [0, 1, 2, 3].map(i => '<button class="ib' + (i === cur ? ' on' : '') + '" data-p="' + i + '">' + 'ABCD'[i] + '</button>').join(''); root.querySelectorAll('[data-tr]').forEach(b => b.classList.toggle('on', b.dataset.tr === track));
      if (q('#mce')) { q('#mce').innerHTML = ENGINES.map(e => '<button class="ib' + (engine === e[0] ? ' on' : '') + '" data-e="' + e[0] + '" title="' + e[2] + '">' + e[1] + '</button>').join(''); q('#mcen').textContent = ENGINES.filter(e => e[0] === engine).map(e => e[2])[0] || ''; }
      if (q('#mcl')) q('#mcl').disabled = engine === 'qwen'; };
    const ROWS = 15;
    function grid() {
      const el = q('#mgrid'); let h = '<table style="border-collapse:separate;border-spacing:3px"><tbody>';
      if (track === 'drums') DR.forEach(d => { h += '<tr><td class="small mute" style="padding-right:6px;white-space:nowrap">' + d[1] + '</td>'; for (let i = 0; i < STEPS; i++) h += '<td><div class="mc" data-r="' + d[0] + '" data-i="' + i + '" style="width:28px;height:28px;border-radius:5px;cursor:pointer;border:1px solid var(--line);background:' + (P().drums[d[0]][i] ? 'var(--acc)' : i % 4 === 0 ? 'rgba(255,255,255,.07)' : 'rgba(255,255,255,.03)') + '"></div></td>'; h += '</tr>'; });
      else { const arr = P()[track], sc = SCALES[S.scale]; for (let r = ROWS - 1; r >= 0; r--) { const lab = NOTES[(S.key + sc[r % sc.length]) % 12] + (r % sc.length === 0 ? Math.floor(r / sc.length) : ''); h += '<tr><td class="small mute" style="padding-right:6px;width:34px">' + lab + '</td>'; for (let i = 0; i < STEPS; i++) h += '<td><div class="mc" data-r="' + r + '" data-i="' + i + '" style="width:28px;height:18px;border-radius:4px;cursor:pointer;border:1px solid var(--line);background:' + (arr[i] === r ? 'var(--acc)' : i % 4 === 0 ? 'rgba(255,255,255,.07)' : 'rgba(255,255,255,.03)') + '"></div></td>'; h += '</tr>'; } }
      el.innerHTML = h + '</tbody></table>'; }
    const preview = (kind, deg) => { try { const c = getAc(), nb = noise(c), m = c.createGain(); m.connect(c.destination); if (kind === 'd') drum(c, m, nb, deg, c.currentTime + .01); else tone(c, m, track === 'bass' ? S.bassVoice : S.leadVoice, (track === 'bass' ? 36 : 60) + S.key + scaleNote(S, deg), c.currentTime + .01, .3, track === 'bass' ? .38 : .22); } catch (e) { } };
    const getAc = () => { if (!keyAc) keyAc = new (window.AudioContext || window.webkitAudioContext)(); if (keyAc.state === 'suspended') keyAc.resume(); return keyAc; };
    q('#mgrid').onclick = e => { const c = e.target.closest('.mc'); if (!c) return; const i = +c.dataset.i; if (track === 'drums') { const a = P().drums[c.dataset.r]; a[i] = a[i] ? 0 : 1; if (a[i]) preview('d', c.dataset.r); } else { const r = +c.dataset.r, a = P()[track]; a[i] = a[i] === r ? -1 : r; if (a[i] >= 0) preview('n', r); } save(); grid(); };
    q('#mpat').onclick = e => { const b = e.target.closest('[data-p]'); if (b) { cur = +b.dataset.p; setUI(); grid(); } };
    q('#mce').onclick = async e => { const b = e.target.closest('[data-e]'); if (!b) return; engine = b.dataset.e; ls.set('mcompose_engine', engine); try { const s = await (await fetch('/api/music/status')).json(); mgOk = !!s.model; } catch (x) { } setUI(); engineNote(); if (engine === 'musicgen' && !mgOk) A.toast('MusicGen is not installed, so pick Qwen or run install-music-model.ps1', 5000); };
    root.querySelectorAll('[data-tr]').forEach(b => b.onclick = () => { track = b.dataset.tr; setUI(); grid(); });
    const bind = (id, fn, ev = 'input') => { q(id)['on' + ev] = e => { fn(e.target.value); save(); setUI(); }; };
    bind('#mbpm', v => S.bpm = +v); bind('#msw', v => S.swing = +v / 100); bind('#mkey', v => { S.key = +v; grid(); }, 'change'); bind('#msc', v => { S.scale = v; grid(); }, 'change'); bind('#mbv', v => S.bassVoice = v, 'change'); bind('#mlv', v => S.leadVoice = v, 'change');
    q('#mn').oninput = e => { S.name = e.target.value || 'My song'; save(); }; q('#mn').onkeydown = e => e.stopPropagation(); q('#mchain').onkeydown = e => e.stopPropagation();
    q('#mchain').onchange = e => { const c = [...e.target.value.toUpperCase()].map(ch => 'ABCD'.indexOf(ch)).filter(i => i >= 0).slice(0, 32); S.chain = c.length ? c : [cur]; save(); setUI(); };
    q('#mclr').onclick = () => { S.pats[cur] = blank(); save(); grid(); };
    q('#mcpy').onclick = async () => { const t = ((await A.prompt('Copy pattern ' + 'ABCD'[cur] + ' into which pattern? (A, B, C or D)', 'ABCD'[(cur + 1) % 4])) || '').toUpperCase(), i = 'ABCD'.indexOf(t); if (i < 0 || i === cur) return; S.pats[i] = JSON.parse(JSON.stringify(P())); save(); A.toast('Copied to ' + t); };
    q('#mrand').onclick = () => { const p = blank(), r = n => Math.floor(Math.random() * n), sc = SCALES[S.scale]; [0, 4, 8, 12].forEach(i => { if (Math.random() < .9) p.drums.kick[i] = 1; }); if (Math.random() < .5) p.drums.kick[r(4) * 4 + 3] = 1; p.drums.snare[4] = p.drums.snare[12] = 1; for (let i = 0; i < 16; i += 2) p.drums.hat[i] = 1; if (Math.random() < .5) for (let i = 1; i < 16; i += 4) p.drums.hat[i] = 1; if (Math.random() < .4) p.drums.ohat[14] = 1; if (Math.random() < .3) p.drums.clap[12] = 1;
      let d = 0; for (let i = 0; i < 16; i++) if (i % 4 === 0 || Math.random() < .3) { d = Math.max(0, Math.min(sc.length * 2 - 1, d + r(5) - 2)); p.bass[i] = d % 8 === 7 ? 0 : [0, 0, 2, 4, 3][r(5)] % (sc.length * 2); }
      d = sc.length; for (let i = 0; i < 16; i++) if (Math.random() < .5) { d = Math.max(sc.length - 2, Math.min(sc.length * 2 + 2, d + r(5) - 2)); p.lead[i] = d; } S.pats[cur] = p; save(); grid(); };
    /* playback */
    const stop = () => { clearTimeout(playTimer); if (ac) { try { ac.close(); } catch (e) { } ac = null; } playing = false; q('#mplay').textContent = '▶ Play'; };
    q('#mplay').onclick = () => { if (playing) return stop(); const run = () => { ac = new (window.AudioContext || window.webkitAudioContext)(); const len = schedule(ac, S, ac.currentTime + .1); playing = true; q('#mplay').textContent = '■ Stop'; playTimer = setTimeout(() => { if (playing && q('#mloop') && q('#mloop').checked) { stop(); run(); } else stop(); }, (len + 1) * 1000); }; run(); };
    q('#mwav').onclick = async () => { const b = wavBlob(await renderSong(S)); const a = document.createElement('a'); a.href = URL.createObjectURL(b); a.download = (S.name || 'song').replace(/[^\w\- ]/g, '') + '.wav'; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 4000); };
    q('#mmine').onclick = async () => { if (!window.MLMine || !MLMine.saveRecording) return A.toast('My songs is not available'); try { const buf = await renderSong(S), b = wavBlob(buf); await MLMine.saveRecording(b, Math.round(buf.duration), { title: S.name, artist: 'Music studio' }); A.toast('Added to Music > My songs'); } catch (e) { A.toast('Could not add the song'); } };
    q('#mplay').insertAdjacentHTML('afterend', '<label class="chk small"><input type="checkbox" id="mloop"> Loop</label>');
    /* keyboard */
    const WH = [0, 2, 4, 5, 7, 9, 11, 12], BL = { 0: 1, 1: 3, 3: 6, 4: 8, 5: 10 }, WK = 'asdfghjk', BK = { w: 0, e: 1, t: 3, y: 4, u: 5 };
    const kb = q('#mkb'); kb.innerHTML = WH.map((n, i) => '<div class="wk" data-n="' + n + '" style="flex:1;border:1px solid #888;background:#f4f4f4;border-radius:0 0 6px 6px;cursor:pointer;display:flex;align-items:flex-end;justify-content:center;color:#444;font-size:11px;padding-bottom:4px">' + WK[i].toUpperCase() + '</div>').join('') + Object.entries(BL).map(([i, n]) => '<div class="bk" data-n="' + n + '" style="position:absolute;left:calc(' + ((+i + 1) * 12.5) + '% - 15px);width:30px;height:58px;background:#222;border-radius:0 0 5px 5px;cursor:pointer"></div>').join('');
    const note = n => { try { const c = getAc(), m = c.createGain(); m.connect(c.destination); tone(c, m, S.leadVoice, 60 + S.key + n, c.currentTime + .005, .35, .3); } catch (e) { } };
    kb.onpointerdown = e => { const k = e.target.closest('[data-n]'); if (k) note(+k.dataset.n); };
    const keyh = e => { if (!root.isConnected) return document.removeEventListener('keydown', keyh); if (A.cur !== 'studio' || e.repeat || e.ctrlKey || e.metaKey || e.altKey || /INPUT|TEXTAREA|SELECT/.test(e.target.tagName)) return; const k = e.key.toLowerCase(); let n = null; if (WK.includes(k)) n = WH[WK.indexOf(k)]; else if (k in BK) n = BL[BK[k]]; if (n !== null) note(n); };
    document.addEventListener('keydown', keyh);
    body._cleanup = () => { stop(); document.removeEventListener('keydown', keyh); if (keyAc) { try { keyAc.close(); } catch (e) { } } };
    /* compose from words: Qwen writes the song as JSON, which is checked and repaired before it goes into the studio */
    const onoff = v => Array.isArray(v) ? v.slice(0, STEPS).map(x => (+x > 0 || x === true) ? 1 : 0) : String(v || '').split('').slice(0, STEPS).map(ch => /[xX1*#]/.test(ch) ? 1 : 0);
    const notes = v => { const o = Array(STEPS).fill(-1); if (Array.isArray(v)) for (let i = 0; i < STEPS && i < v.length; i++) { if (v[i] === null || v[i] === '' || v[i] === false) continue; const n = Math.round(+v[i]); if (isFinite(n) && n >= 0) o[i] = Math.min(14, n); } return o; };
    const fixSong = v => {
      if (!v || !Array.isArray(v.patterns) || !v.patterns.length) throw new Error('Qwen did not write a song this time. Try again, or describe it a little differently.');
      const pats = v.patterns.slice(0, 4).map(p => { const b = blank(); DR.forEach(d => { const a = onoff(p[d[0]] != null ? p[d[0]] : (p.drums && p.drums[d[0]])); for (let i = 0; i < STEPS; i++) b.drums[d[0]][i] = a[i] || 0; }); b.bass = notes(p.bass); b.lead = notes(p.lead); return b; });
      const used = p => DR.some(d => p.drums[d[0]].some(x => x)) || p.bass.some(x => x >= 0) || p.lead.some(x => x >= 0); if (!used(pats[0])) throw new Error('Qwen wrote an empty first pattern. Try again.');
      while (pats.length < 4) pats.push(blank()); const have = pats.map(used); let chain = [...String(v.chain || 'AABA').toUpperCase()].map(c => 'ABCD'.indexOf(c)).filter(i => i >= 0 && have[i]).slice(0, 32); if (!chain.length) chain = [0, 0, have[1] ? 1 : 0, 0];
      const pick = (x, list, d) => list.includes(x) ? x : d, num = (x, a, b, d) => { x = +x; return isFinite(x) ? Math.max(a, Math.min(b, x)) : d; };
      return { bpm: Math.round(num(v.bpm, 60, 200, 100)), swing: num(v.swing, 0, 60, 0) / 100, key: Math.round(num(v.key, 0, 11, 0)), scale: pick(v.scale, Object.keys(SCALES), 'Minor'), bassVoice: pick(v.bassVoice, Object.keys(VOICES), 'saw'), leadVoice: pick(v.leadVoice, Object.keys(VOICES), 'square'), pats, chain, name: String(v.name || 'Composed song').slice(0, 40) };
    };
    let prevS = null, composing = false, fbNote = '', clipUrl = '';
    /* first choice: the local MusicGen model makes real audio; returns false (with fbNote set) when Qwen should write the song instead */
    const aiAudio = async idea => {
      const st = q('#mcs'); composing = true; q('#mcg').disabled = true; const t0 = Date.now(), tk = setInterval(() => { st.textContent = 'The AI music model is working... ' + Math.round((Date.now() - t0) / 1000) + 's (the first clip loads the model and can take a minute or two)'; }, 500);
      if (window.Delights) Delights.showThinkingSpinner();
      try {
        const r = await fetch('/api/music/gen', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ prompt: idea, seconds: +q('#mcl').value || 15 }) });
        if (!r.ok) { let m = ''; try { m = (await r.json()).error; } catch (e) { } fbNote = m || 'The AI music model could not make that clip.'; return false; }
        const blob = await r.blob(), url = URL.createObjectURL(blob); if (clipUrl) URL.revokeObjectURL(clipUrl); clipUrl = url; const nm = idea.slice(0, 40).replace(/[^\w ]+/g, '').trim() || 'AI music';
        q('#mca').innerHTML = '<audio controls autoplay src="' + url + '" style="width:100%;max-width:520px"></audio> <a class="ib" href="' + url + '" download="' + esc2(nm) + '.wav" style="text-decoration:none">⬇ Save WAV</a><div class="small mute">Made by the AI music model on this PC from "' + esc2(idea.slice(0, 120)) + '" in ' + Math.round((Date.now() - t0) / 1000) + 's.</div>';
        st.textContent = 'Done in ' + Math.round((Date.now() - t0) / 1000) + 's.'; return true;
      } catch (e) { fbNote = 'The AI music model could not be reached.'; return false; } finally { clearInterval(tk); composing = false; q('#mcg').disabled = false; if (window.Delights) Delights.hideThinkingSpinner(); }
    };
    let webBrief = '';
    /* optional: read the web about the idea first, and turn what it read into a short musical description. The song is
       still made on this PC; the internet only makes the description (and so the mood, instruments and tempo) accurate. */
    const lookUp = async idea => {
      webBrief = ''; const src = q('#mcwscr'); if (src) src.innerHTML = '';
      if (!q('#mcweb') || !q('#mcweb').checked) return;
      if (!window.A.net || !A.net.on()) { if (src) src.textContent = 'Internet access is switched off, so the song comes from your words alone.'; return; }
      q('#mcs').textContent = 'Looking "' + idea.slice(0, 36) + '" up online…';
      const r = await A.net.research(idea).catch(() => null);
      if (!r || !r.notes) { if (src) src.textContent = 'Nothing useful came back from the web.'; return; }
      try {
        const res = await fetch('/api/chat', { method: 'POST', body: JSON.stringify({ model: document.getElementById('model').value, stream: false, think: false, keep_alive: '3m', messages: [{ role: 'user', content: 'You describe music for an AI music model. Using only these facts, write ONE line of about 30 words describing how "' + idea + '" should SOUND: genre, tempo feel, instruments, energy, mood. No website names, no preamble.\n\n' + r.notes.slice(0, 2600) }] }) });
        const j = await res.json(); const b = String((j.message && j.message.content) || '').replace(/\s+/g, ' ').trim().slice(0, 260);
        if (b.length > 15) webBrief = b;
      } catch (e) { }
      if (src) src.innerHTML = '&#127760; Read from the web (' + esc2(r.engine || 'DuckDuckGo') + '): ' + r.sources.map((s, i) => '[' + (i + 1) + '] ' + esc2(s.title)).join(' \u00b7 ');
    };
    const compose = async () => {
      if (composing) return; const idea = q('#mcp').value.trim(); if (!idea) { q('#mcs').textContent = 'Describe the music first.'; return; } fbNote = '';
      if (!composing) await lookUp(idea);
      let ms = null; try { ms = await (await fetch('/api/music/status')).json(); } catch (e) { }
      mgOk = !!(ms && ms.model);
      if (engine === 'qwen') { fbNote = 'Qwen wrote this song into the studio; the MusicGen model was not used.'; return composeQwen(); }
      if (!mgOk) {
        if (engine === 'musicgen') { q('#mcs').innerHTML = '<span class="bad">The AI music model is not installed.</span> Switch the engine to Qwen, or run install-music-model.ps1.'; return; }
        fbNote = 'The AI music model is not installed, so Qwen wrote the song instead.'; return composeQwen();
      }
      if (ms.busy) { q('#mcs').textContent = 'The AI music model is busy with another clip. Wait a moment.'; if (engine === 'musicgen') return; }
      if (await aiAudio(webBrief ? idea + ' — ' + webBrief : idea)) return;
      if (engine === 'musicgen') { q('#mcs').innerHTML = '<span class="bad">' + esc2(fbNote || 'MusicGen could not make that clip.') + '</span> Try again, or switch the engine to Qwen.'; return; }
      fbNote = (fbNote ? fbNote + ' ' : '') + 'Qwen wrote a song instead.';
      return composeQwen();
    };
    const composeQwen = async () => {
      if (composing) return; const idea = q('#mcp').value.trim(), st = q('#mcs'); if (!idea) { st.textContent = 'Describe the music first.'; return; } composing = true; q('#mcg').disabled = true; const t0 = Date.now(), tk = setInterval(() => { st.textContent = 'Composing... ' + Math.round((Date.now() - t0) / 1000) + 's'; }, 500);
      if (window.Delights) Delights.showThinkingSpinner();
      const prompt = 'You are a music composer for a small 16-step sequencer. Compose a short song for: "' + idea.replace(/"/g, "'") + '"' + (webBrief ? ' (reference, from what the web says about it: ' + webBrief.replace(/"/g, "'") + ')' : '') + '.\nReply with ONLY JSON shaped like: {"name":"title","bpm":60-180,"swing":0-30,"key":0-11 (0 is C),"scale":"Minor" or "Major" or "Pentatonic" or "Blues" or "Dorian","bassVoice":"saw" or "square" or "sine" or "pluck" or "tri","leadVoice":"square" or "saw" or "sine" or "pluck" or "tri","patterns":[{"kick":"x...x...x...x...","snare":"....x.......x...","hat":"x.x.x.x.x.x.x.x.","ohat":"................","clap":"................","tom":"................","cow":"................","bass":[16 numbers],"lead":[16 numbers]}, ...3 or 4 patterns],"chain":"AABABCAB"}.\nRules: each drum string is exactly 16 characters, x is a hit and . is silence. bass and lead are arrays of exactly 16 numbers: -1 is a silent step, otherwise a scale degree from 0 to 14 (0 is the key note, 7 is an octave above it). Bass: low notes 0 to 5, a root note on the first beat, fairly sparse. Lead: a singable melody, mostly stepping 1 or 2 degrees, using degrees 5 to 12, with rests and a repeated phrase. Pattern A is the main idea, B a variation, C a contrast. Choose tempo, scale and drums that match the mood. chain is 8 to 16 letters from A-D.';
      try {
        const r = await fetch('/api/chat', { method: 'POST', body: JSON.stringify({ model: document.getElementById('model').value, stream: false, think: false, keep_alive: '3m', format: 'json', options: { temperature: .85 }, messages: [{ role: 'user', content: prompt }] }) }); const j = await r.json(); let v; const txt = (j.message && j.message.content) || '';
        try { v = JSON.parse(txt); } catch (e) { const m = /\{[\s\S]*\}/.exec(txt); try { v = JSON.parse(m && m[0]); } catch (e2) { v = null; } }
        const s = fixSong(v); prevS = JSON.parse(JSON.stringify(S)); S = s; cur = 0; track = 'drums'; save(); setUI(); grid(); q('#mcr').disabled = false; st.textContent = 'Done in ' + Math.round((Date.now() - t0) / 1000) + 's: "' + S.name + '", ' + S.bpm + ' BPM, ' + S.scale + '. Playing it now.' + (fbNote ? ' (' + fbNote + ')' : ''); if (!playing) q('#mplay').click(); else { stop(); q('#mplay').click(); }
      } catch (e) { st.innerHTML = '<span class="bad">' + esc2(e.message || 'That did not work.') + '</span>'; } finally { clearInterval(tk); composing = false; q('#mcg').disabled = false; if (window.Delights) Delights.hideThinkingSpinner(); }
    };
    q('#mcg').onclick = compose; q('#mcp').onkeydown = e => { e.stopPropagation(); if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) compose(); };
    q('#mcc').onclick = e => { const b = e.target.closest('[data-i]'); if (b) { q('#mcp').value = b.dataset.i; compose(); } };
    q('#mcr').onclick = () => { if (!prevS) return; stop(); S = prevS; prevS = null; cur = 0; save(); setUI(); grid(); q('#mcr').disabled = true; q('#mcs').textContent = 'Your previous song is back.'; };
    window.StudioMusic = { renderSong: () => renderSong(S), state: () => S };
    setUI(); grid();
    fetch('/api/music/status').then(r => r.json()).then(s => { mgOk = !!s.model; if (!composing && !q('#mcs').textContent) engineNote(); }).catch(() => { });
  }, 3);
})();

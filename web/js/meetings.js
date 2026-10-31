// Tools > Meeting notes: record a meeting, get a running transcript (speech recognised on this PC), then a summary with decisions and action items.
(() => {
  const encodeWav = (f32, inRate) => {
    const outRate = 16000, ratio = inRate / outRate, n = Math.floor(f32.length / ratio), out = new Int16Array(n);
    for (let i = 0; i < n; i++) { const a = Math.floor(i * ratio), b = Math.min(f32.length - 1, Math.floor((i + 1) * ratio)); let s = 0, c = 0; for (let k = a; k <= b; k++) { s += f32[k]; c++; } const v = Math.max(-1, Math.min(1, s / c)); out[i] = v < 0 ? v * 0x8000 : v * 0x7fff; }
    const buf = new ArrayBuffer(44 + out.length * 2), dv = new DataView(buf), w = (o, s) => { for (let i = 0; i < s.length; i++) dv.setUint8(o + i, s.charCodeAt(i)); };
    w(0, 'RIFF'); dv.setUint32(4, 36 + out.length * 2, true); w(8, 'WAVE'); w(12, 'fmt '); dv.setUint32(16, 16, true); dv.setUint16(20, 1, true); dv.setUint16(22, 1, true); dv.setUint32(24, outRate, true); dv.setUint32(28, outRate * 2, true); dv.setUint16(32, 2, true); dv.setUint16(34, 16, true); w(36, 'data'); dv.setUint32(40, out.length * 2, true);
    new Int16Array(buf, 44).set(out); return buf;
  };
  A.meetings = {
    encodeWav,
    render(root) {
      let ctx = null, stream = null, proc = null, src = null, chunks = [], rate = 48000, running = false, t0 = 0, tick = 0, cutT = 0, segs = [], pending = 0, summary = '';
      root.innerHTML = '<div class="scroll pad" style="flex:1"><div style="max-width:820px;margin:0 auto"><h2 style="margin:0 0 4px">🎙 Meeting notes</h2><div class="small mute" style="margin-bottom:10px">Press Record and leave this tab open. Speech is turned into text on this PC every few seconds, at the pauses, with no gaps; the bar shows the microphone is hearing you. Afterwards, write a summary with decisions and action items, and save everything to Notes. Tell people you are recording.</div>' +
        '<div class="row" style="gap:8px;align-items:center;flex-wrap:wrap"><input type="text" id="mttl" placeholder="Meeting title" style="flex:1;min-width:200px" maxlength="80"><button class="pri" id="mtrec">⏺ Record</button><span class="chip" id="mtclk">0:00</span><span title="Microphone level" style="width:90px;height:8px;border-radius:4px;background:var(--panel2);border:1px solid var(--line);overflow:hidden;display:inline-block"><i id="mtlvl" style="display:block;height:100%;width:0;transition:width .2s"></i></span></div>' +
        '<div class="small mute" id="mtmsg" style="margin:6px 0"></div><div id="mttx" style="max-height:300px;overflow:auto;background:var(--panel2);border:1px solid var(--line);border-radius:10px;padding:8px;font-size:14px;line-height:1.5;min-height:80px"><span class="mute">The transcript appears here as people speak.</span></div>' +
        '<div class="row" style="gap:6px;margin-top:8px;flex-wrap:wrap"><button class="ib" id="mtsum">✨ Summarise</button><button class="ib" id="mtnote">📝 Save to Notes</button><button class="ib" id="mtcopy">📋 Copy</button><button class="ib dang" id="mtclr">Clear</button></div><div id="mtsm" style="white-space:pre-wrap;margin-top:10px;line-height:1.5"></div></div></div>';
      const q = s => root.querySelector(s), msg = t => { q('#mtmsg').textContent = t || ''; };
      const mm = s => Math.floor(s / 60) + ':' + String(Math.floor(s % 60)).padStart(2, '0');
      const draw = () => { q('#mttx').innerHTML = segs.length ? segs.map(s => '<div><span class="mute small">' + mm(s.at) + '</span> ' + esc(s.t) + '</div>').join('') : '<span class="mute">The transcript appears here as people speak.</span>'; q('#mttx').scrollTop = q('#mttx').scrollHeight; };
      const add = (text, at) => { text = String(text || '').replace(/\[BLANK_AUDIO\]/g, '').trim(); if (text) { segs.push({ t: text, at }); draw(); } };
      /* problems stay on screen (they used to be overwritten a moment later by "Recording...") */
      let problem = '';
      const status = () => msg(problem ? '⚠ ' + problem : running ? (pending ? 'Recording · writing down what was said…' : 'Recording…') : pending ? 'Writing down the last part…' : (segs.length ? 'Done.' : ''));
      const fail = t => { problem = t; status(); };
      const sendChunk = async (f32, at) => {
        if (f32.length < rate * 1.0) return; pending++; status();
        try {
          const r = await fetch('/api/transcribe', { method: 'POST', body: encodeWav(f32, rate), headers: { 'Content-Type': 'audio/wav' } }), j = await r.json();
          if (j.error) fail(/not installed/i.test(j.error) ? 'Voice typing is not installed on this PC. Get it in Prepare › Stock up (Voices › Voice typing model), then record again.' : 'Speech: ' + j.error);
          else { problem = ''; add(j.text, at); }
        } catch (e) { fail('A piece could not be written down (' + e.message + ').'); }
        pending--; status();
      };
      /* the sound is cut into pieces at a natural pause: after 6 seconds at the earliest, 20 at the latest, so text
         appears within seconds and words are not cut in half */
      let since = 0, quiet = 0, level = 0;
      const cut = () => { const len = chunks.reduce((a, c) => a + c.length, 0); if (!len) return; const all = new Float32Array(len); let o = 0; for (const c of chunks) { all.set(c, o); o += c.length; } chunks = []; since = 0; quiet = 0; sendChunk(all, Math.max(0, (Date.now() - t0) / 1000 - len / rate)); };
      const meter = () => { const m = q('#mtlvl'); if (!m) return; const p = Math.min(100, Math.round(level * 400)); m.style.width = p + '%'; m.style.background = p > 6 ? 'var(--ok)' : 'var(--mute)'; };
      const start = async () => {
        problem = '';
        /* the recorder is made right here, inside the click: made after the permission question it could start
           "suspended" and record nothing at all, which is why the transcript stayed empty */
        try { ctx = new (window.AudioContext || window.webkitAudioContext)(); } catch (e) { return fail('This window cannot record sound.'); }
        try { stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: false, noiseSuppression: true, autoGainControl: true } }); }
        catch (e) { try { ctx.close(); } catch (x) { } return fail(e && e.name === 'NotFoundError' ? 'No microphone was found. Plug one in (or check it is switched on in Windows), then try again.' : 'The microphone is blocked. Allow it for Moundshroud (the icon at the right of the address area, or Windows Settings › Privacy › Microphone), then try again.'); }
        try { if (ctx.state !== 'running') await ctx.resume(); } catch (e) { }
        rate = ctx.sampleRate; src = ctx.createMediaStreamSource(stream); proc = ctx.createScriptProcessor(4096, 1, 1); chunks = []; since = 0; quiet = 0;
        proc.onaudioprocess = e => {
          const d = e.inputBuffer.getChannelData(0); chunks.push(new Float32Array(d));
          let s = 0; for (let i = 0; i < d.length; i += 4) s += d[i] * d[i]; const rms = Math.sqrt(s / (d.length / 4)); level = level * .7 + rms * .3;
          since += d.length / rate; quiet = rms < .012 ? quiet + d.length / rate : 0;
          if ((since >= 6 && quiet >= .35) || since >= 20) cut();
        };
        src.connect(proc); proc.connect(ctx.destination);
        running = true; t0 = Date.now(); q('#mtrec').textContent = '⏹ Stop'; status();
        tick = setInterval(() => { q('#mtclk').textContent = mm((Date.now() - t0) / 1000); meter(); if (running && ctx && ctx.state !== 'running') fail('Recording paused by the window. Click ⏹ Stop and ⏺ Record again.'); }, 250);
        /* wake the speech engine now, so the first piece does not wait while it loads */
        fetch('/api/transcribe', { method: 'POST', body: encodeWav(new Float32Array(rate), rate), headers: { 'Content-Type': 'audio/wav' } }).then(r => r.json()).then(j => { if (j.error && /not installed/i.test(j.error)) fail('Voice typing is not installed on this PC. Get it in Prepare › Stock up (Voices › Voice typing model), then record again.'); }).catch(() => { });
      };
      const stop = async () => { running = false; clearInterval(tick); clearInterval(cutT); level = 0; meter(); try { proc.disconnect(); src.disconnect(); stream.getTracks().forEach(t => t.stop()); await ctx.close(); } catch (e) { } cut(); q('#mtrec').textContent = '⏺ Record'; status(); };
      q('#mtrec').onclick = () => running ? stop() : start();
      const text = () => segs.map(s => '[' + mm(s.at) + '] ' + s.t).join('\n');
      q('#mtsum').onclick = async () => {
        if (!segs.length) return A.toast('Nothing recorded yet.'); if (!A.ai || (A.power && A.power.on)) return A.toast('The AI model is asleep (low power).'); const b = q('#mtsum'); b.disabled = true; q('#mtsm').textContent = 'Writing the summary...';
        try { const o = await A.ai.once([{ role: 'system', content: 'You turn a meeting transcript into clear notes. Use exactly these plain-text sections: SUMMARY (3 to 5 sentences), DECISIONS (bullets), ACTION ITEMS (bullets with the person if named), OPEN QUESTIONS (bullets). Use only what is in the transcript; if a section has nothing, write "None". The transcript may contain recognition errors.' }, { role: 'user', content: text().slice(0, 14000) }], { temp: .2 }); summary = String(o || '').replace(/<think>[\s\S]*?<\/think>/g, '').trim(); q('#mtsm').textContent = summary || 'No summary came back.'; } catch (e) { q('#mtsm').textContent = 'Could not write the summary.'; } b.disabled = false;
      };
      q('#mtnote').onclick = async () => { if (!segs.length) return A.toast('Nothing recorded yet.'); const ttl = q('#mttl').value.trim() || 'Meeting ' + new Date().toLocaleString(); const r = await A.api('/api/notes/save', { title: ttl, content: '# ' + ttl + '\n\n' + new Date().toLocaleString() + '\n\n' + (summary ? '## Summary\n\n' + summary + '\n\n' : '') + '## Transcript\n\n' + text() + '\n' }); A.toast(r && r.id ? 'Saved to Notes ✓' : 'Could not save.'); };
      q('#mtcopy').onclick = () => navigator.clipboard.writeText((summary ? summary + '\n\n' : '') + text()).then(() => A.toast('Copied ✓'));
      q('#mtclr').onclick = () => { if (running) return A.toast('Stop recording first.'); if (segs.length && !confirm('Clear the transcript?')) return; segs = []; summary = ''; q('#mtsm').textContent = ''; q('#mtclk').textContent = '0:00'; draw(); };
      root._test = { add: (t, at) => add(t, at || 0), segs: () => segs, text };
      root._cleanup = () => { if (running) stop(); };
    }
  };
})();

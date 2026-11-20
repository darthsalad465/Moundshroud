// Voice input: record from the microphone, send a small 16 kHz wav to the local speech engine, get text back. Nothing leaves this PC.
(() => {
  let ctx = null, stream = null, proc = null, src = null, chunks = [], rate = 48000, timer = null, t0 = 0, onText = null, onState = null, model = '';
  function encodeWav(f32, inRate) {
    const outRate = 16000, ratio = inRate / outRate, n = Math.floor(f32.length / ratio), out = new Int16Array(n);
    for (let i = 0; i < n; i++) { const a = Math.floor(i * ratio), b = Math.min(f32.length - 1, Math.floor((i + 1) * ratio)); let s = 0, c = 0; for (let k = a; k <= b; k++) { s += f32[k]; c++; } const v = Math.max(-1, Math.min(1, s / c)); out[i] = v < 0 ? v * 0x8000 : v * 0x7fff; }
    const buf = new ArrayBuffer(44 + out.length * 2), dv = new DataView(buf); const w = (o, s) => { for (let i = 0; i < s.length; i++) dv.setUint8(o + i, s.charCodeAt(i)); };
    w(0, 'RIFF'); dv.setUint32(4, 36 + out.length * 2, true); w(8, 'WAVE'); w(12, 'fmt '); dv.setUint32(16, 16, true); dv.setUint16(20, 1, true); dv.setUint16(22, 1, true); dv.setUint32(24, outRate, true); dv.setUint32(28, outRate * 2, true); dv.setUint16(32, 2, true); dv.setUint16(34, 16, true); w(36, 'data'); dv.setUint32(40, out.length * 2, true);
    new Int16Array(buf, 44).set(out); return buf;
  }
  A.voice = {
    rec: false,
    available: () => !!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia),
    async start(textCb, stateCb, opts) {
      if (A.voice.rec) return; onText = textCb; onState = stateCb; opts = opts || {}; model = opts.model || '';   // opts.model: a speech-to-text model id from the model catalog let heard = false, lastLoud = Date.now(), level = 0;
      try { stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true } }); }
      catch (e) { A.toast('Microphone blocked. Allow it in the window\'s address/permissions icon, then try again.', 5000); return; }
      ctx = new (window.AudioContext || window.webkitAudioContext)(); rate = ctx.sampleRate; src = ctx.createMediaStreamSource(stream);
      proc = ctx.createScriptProcessor(4096, 1, 1); chunks = [];
      proc.onaudioprocess = e => {
        const d = e.inputBuffer.getChannelData(0); chunks.push(new Float32Array(d));
        let s = 0; for (let i = 0; i < d.length; i += 4) s += d[i] * d[i]; level = Math.sqrt(s / (d.length / 4));
        if (level > 0.02) { heard = true; lastLoud = Date.now(); }
      };
      src.connect(proc); proc.connect(ctx.destination); A.voice.rec = true; t0 = Date.now();
      timer = setInterval(() => {
        const s = (Date.now() - t0) / 1000; if (onState) onState('rec', s, level);
        if (s > 90) A.voice.stop();
        else if (opts.auto && heard && Date.now() - lastLoud > 1400) A.voice.stop();                       // you finished talking
        else if (opts.auto && !heard && s > 9) { A.voice.stop(true); if (opts.onSilence) opts.onSilence(); }  // nothing said
      }, 120);
      if (onState) onState('rec', 0);
    },
    async stop(discard) {
      if (!A.voice.rec) return; A.voice.rec = false; clearInterval(timer);
      try { proc.disconnect(); src.disconnect(); stream.getTracks().forEach(t => t.stop()); await ctx.close(); } catch (e) {}
      if (discard === true) { chunks = []; if (onState) onState('idle'); return; }
      const len = chunks.reduce((a, c) => a + c.length, 0); const all = new Float32Array(len); let o = 0; for (const c of chunks) { all.set(c, o); o += c.length; } chunks = [];
      if (len < rate * 0.4) { if (onState) onState('idle'); A.toast('That was too short - hold on a bit longer.'); return; }
      if (onState) onState('busy');
      try {
        const r = await fetch('/api/transcribe' + (model ? '?model=' + encodeURIComponent(model) : ''), { method: 'POST', body: encodeWav(all, rate), headers: { 'Content-Type': 'audio/wav' } }); const j = await r.json();
        if (j.error) A.toast('Voice: ' + j.error, 4000); else if (j.text && j.text.trim()) { if (onText) onText(j.text.replace(/^\s*\[BLANK_AUDIO\]\s*$/, '').trim()); } else A.toast('I did not catch that.');
      } catch (e) { A.toast('Voice input failed.'); }
      if (onState) onState('idle');
    }
  };
})();

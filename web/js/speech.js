// Read aloud using Windows' own offline voices, plus the natural-sounding Piper voices when they are installed (the server turns text into audio on this PC; nothing goes online).
(() => {
  let queue = [], active = false, btn = null, label = '';
  const voices = () => speechSynthesis.getVoices();
  /* natural voices: pseudo voice objects {name, lang, localService, piper:<file>} listed by the server */
  const PV = [], NAMES = { 'en_US-lessac-medium': ['Lessac', 'US female'], 'en_US-ryan-medium': ['Ryan', 'US male'], 'en_GB-jenny_dioco-medium': ['Jenny', 'UK female'], 'en_GB-alan-medium': ['Alan', 'UK male'] };
  const pvName = f => { const n = NAMES[f]; if (n) return 'Natural ' + n[0] + ' (' + n[1] + ')'; const p = f.split('-'); return 'Natural ' + (p[1] || f).replace(/_/g, ' ') + ' (' + p[0].replace('_', '-') + ')'; };
  try { fetch('/api/tts/voices').then(r => r.json()).then(d => { (d.voices || []).forEach(f => { if (!PV.some(x => x.piper === f)) PV.push({ name: pvName(f), lang: f.split('-')[0].replace('_', '-'), localService: true, piper: f }); }); PV.sort((a, b) => (a.name > b.name ? 1 : -1)); try { window.dispatchEvent(new Event('oa-natural-voices')); } catch (e) { } }).catch(() => { }); } catch (e) { }
  function pick() {
    const v = voices(), want = ls.get('voice', '');
    return PV.find(x => x.name === want) || (!want && PV.find(x => /Lessac/.test(x.name))) || v.find(x => x.name === want) || v.filter(x => x.localService && /^en/i.test(x.lang)).sort((a, b) => (/Zira|Aria|Jenny|David|Mark/i.test(b.name) ? 1 : 0) - (/Zira|Aria|Jenny|David|Mark/i.test(a.name) ? 1 : 0))[0] || v.find(x => /^en/i.test(x.lang)) || v[0];
  }
  function clean(t) { return t.replace(/```[\s\S]*?```/g, ' code block. ').replace(/[*_`#>]+/g, '').replace(/\[(\d+)\]/g, '').replace(/https?:\/\/\S+/g, ' link ').replace(/\s+/g, ' ').trim(); }
  function chunks(t) { const out = []; let cur = ''; for (const s of t.split(/(?<=[.!?])\s+/)) { if ((cur + ' ' + s).length > 220 && cur) { out.push(cur); cur = s; } else cur = cur ? cur + ' ' + s : s; } if (cur) out.push(cur); return out.flatMap(c => { const r = []; while (c.length > 260) { const i = c.lastIndexOf(' ', 240); r.push(c.slice(0, i > 0 ? i : 240)); c = c.slice(i > 0 ? i : 240); } r.push(c); return r; }); }
  function setBtn(on) { if (btn) btn.textContent = on ? 'Stop' : label; }
  let aud = null, pre = null;
  const blobFor = (txt, v) => { const p = +ls.get('pitch', '1') || 1, r = +ls.get('rate', '1') || 1; return fetch('/api/tts', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ voice: v.piper, text: txt, length: p / r }) }).then(x => x.ok ? x.blob() : Promise.reject(new Error('tts'))); };
  /* play one chunk with a natural voice; the next chunk is prepared while this one plays. Pitch is made by playing faster and stretching the speech to match. */
  function nextNatural(v) {
    const txt = queue.shift(), g = gen, p = +ls.get('pitch', '1') || 1, key = txt + '|' + v.piper + '|' + p + '|' + ls.get('rate', '1');
    const got = pre && pre.k === key ? pre.p : blobFor(txt, v); pre = null;
    if (queue.length) { const k2 = queue[0] + '|' + v.piper + '|' + p + '|' + ls.get('rate', '1'); pre = { k: k2, p: blobFor(queue[0], v) }; pre.p.catch(() => { }); }
    const fail = () => { if (g !== gen) return; active = false; setBtn(false); btn = null; finish(); };
    got.then(b => {
      if (g !== gen) return; const a = new Audio(URL.createObjectURL(b)); aud = a; a.preservesPitch = false; a.playbackRate = p; a.volume = Math.min(1, Math.max(0, +ls.get('svol', '1')));
      a.onended = () => { try { URL.revokeObjectURL(a.src); } catch (e) { } if (g === gen) next(); }; a.onerror = fail; a.play().catch(fail);
    }).catch(fail);
  }
  function next() {
    if (!queue.length) { active = false; setBtn(false); btn = null; finish(); return; }
    const pv = pick(); if (pv && pv.piper) return nextNatural(pv);
    const u = new SpeechSynthesisUtterance(queue.shift()); const v = pv; if (v) u.voice = v; u.rate = +ls.get('rate', '1'); u.pitch = +ls.get('pitch', '1') || 1; u.volume = Math.min(1, Math.max(0, +ls.get('svol', '1')));
    const g = gen; u.onend = () => { if (g === gen) next(); }; u.onerror = () => { if (g !== gen) return; active = false; setBtn(false); btn = null; finish(); }; speechSynthesis.speak(u);
  }
  let doneCb = null, gen = 0;
  const finish = () => { const f = doneCb; doneCb = null; if (f) f(); };
  A.speech = {
    /* resolves when the speech has finished (or was stopped) */
    speakAsync(text) { return new Promise(res => { A.speech.stop(); if (!A.speech.available()) return res(); doneCb = res; queue = chunks(clean(text)); if (!queue.length) return finish(); active = true; btn = null; next(); }); },
    available: () => 'speechSynthesis' in window,
    natural: PV,
    stop() { gen++; queue = []; pre = null; if (aud) { try { aud.pause(); } catch (e) { } aud = null; } speechSynthesis.cancel(); active = false; setBtn(false); btn = null; finish(); },
    speak(text, button) {
      if (!A.speech.available()) { A.toast('Read aloud is not available here'); return; }
      const was = active; const same = button && btn === button; A.speech.stop(); if (same || (was && !button)) return;
      btn = button || null; label = btn ? btn.textContent : ''; queue = chunks(clean(text)); if (!queue.length) return; active = true; setBtn(true); next();
    }
  };
  if ('speechSynthesis' in window) speechSynthesis.onvoiceschanged = () => {};

  /* Privacy guard for every read-aloud in the app. Windows' "Online (Natural)" voices send the text to Microsoft's
     servers to be spoken, so they are never used unless the person switches "Allow online voices" on in Settings.
     Any feature that asks for one (directly or as the default voice) gets the on-device voice for the same language
     instead; if this PC has none for that language, it says so instead of quietly uploading the text. */
  const onlineOK = () => ls.get('online_voices', '0') === '1';
  A.speech.okVoice = v => !v || v.piper || v.localService || onlineOK();
  A.speech.onlineOK = onlineOK;
  if ('speechSynthesis' in window && !speechSynthesis.__guarded) {
    const real = speechSynthesis.speak.bind(speechSynthesis);
    speechSynthesis.speak = u => {
      try {
        if (!onlineOK()) {
          const all = speechSynthesis.getVoices(), lang = String((u.voice && u.voice.lang) || u.lang || 'en').slice(0, 2).toLowerCase();
          const fallback = all.find(x => x.default) || null;
          const chosen = u.voice || fallback;
          if (chosen && !chosen.localService) {
            const loc = all.find(x => x.localService && x.lang.slice(0, 2).toLowerCase() === lang);
            if (!loc) { if (!speechSynthesis.__warned) { speechSynthesis.__warned = 1; A.toast('This PC has no offline voice for that language, so it was not read aloud. (Online voices are off for privacy: Settings, Voice & sound.)', 7000); } if (u.onend) setTimeout(() => u.onend({}), 0); return; }
            u.voice = loc;
          }
        }
      } catch (e) { }
      return real(u);
    };
    speechSynthesis.__guarded = true;
  }
})();

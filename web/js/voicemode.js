// Voice mode: talk, Moundshroud answers out loud, then listens again. Hands-free. Everything stays on this PC.
(() => {
  const el = document.createElement('div'); el.id = 'vm';
  el.innerHTML = '<div class="orb" id="vorb"></div><div class="st" id="vst"></div><div class="cap" id="vcap"></div><button class="ib" id="vend" style="margin-top:22px">End voice mode (Esc)</button><div class="small mute" style="margin-top:14px">Say "stop" or "goodbye" to end</div>';
  document.body.appendChild(el);
  const st = $('vst'), cap = $('vcap'), orb = $('vorb');
  let on = false, miss = 0;
  const set = (s, label, text) => { el.className = (s + ' on'); st.textContent = label; if (text != null) cap.textContent = text; if (s !== 'listening') orb.style.setProperty('--lv', 1); };

  function listen() {
    return new Promise(async res => {
      let got = '';
      await A.voice.start(t => { got = t; }, (s, secs, lv) => {
        if (s === 'rec') orb.style.setProperty('--lv', (1 + Math.min(0.5, (lv || 0) * 6)).toFixed(2));
        else if (s === 'busy') set('thinking', 'Understanding...');
        else if (s === 'idle') res(got);
      }, { auto: true });
      if (!A.voice.rec) res(null);
    });
  }
  async function loop() {
    while (on) {
      set('listening', 'Listening...', miss ? '' : 'Go ahead, I am listening.');
      const text = await listen(); if (!on) break;
      if (text === null) { A.toast('Could not use the microphone. Check Windows microphone permission.', 5000); break; }
      if (!text.trim()) { if (++miss >= 3) { A.toast('Voice mode ended (no speech heard).'); break; } continue; }
      miss = 0;
      if (/^\W*(stop|goodbye|bye|exit|end|that'?s all|never ?mind|thank you)\W*$/i.test(text.trim())) break;
      set('thinking', 'Thinking...', '"' + text + '"');
      await A.chat.ask(text, { voice: true }); if (!on) break;
      const ans = A.chat.lastAnswer(); set('speaking', 'Speaking...', ans.replace(/[*_`#]/g, '').slice(0, 400));
      await A.speech.speakAsync(ans);
    }
    end();
  }
  function start() {
    if (on) return; if (!A.caps.voice || !A.voice.available()) return A.toast('Voice input is not set up on this PC.');
    on = true; miss = 0; A.showTab('chat'); loop();
  }
  function end() { if (!on && !el.classList.contains('on')) return; on = false; A.speech.stop(); if (A.voice.rec) A.voice.stop(true); el.className = ''; }
  $('vend').onclick = end;
  A.vm = { start, end, get on() { return on; } };

  const b = document.createElement('button'); b.className = 'ib'; b.id = 'talk'; b.innerHTML = '🎙️&nbsp;Talk'; b.title = 'Voice mode: talk to Moundshroud hands-free'; b.onclick = start;
  $('gs').parentNode.insertBefore(b, $('gs'));
  A.ready.push(() => { if (!A.caps.voice) b.style.display = 'none'; });
})();

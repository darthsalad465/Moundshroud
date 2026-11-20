// OpenWhip for Moundshroud (inspired by github.com/GitFrog1111/OpenWhip).
// Works in Moundshroud Code (Agent tab) AND every chat interface across the entire app:
//   - Physics-based animated whip overlay + synthesized offline WebAudio whip-crack sound
//   - Interrupts stalled/slow turns + fires classic OpenWhip motivational nudges ("FASTER", "Faster CLANKER", ...)
//   - Engages Turbo Speed Mode (disables slow thinking & injects concise-execution directive on all /api/chat calls)
//   - Hotkey: Alt+W anywhere, /whip in Agent, top-bar 🪢 button, or optional floating whip handle
(() => {
  const PHRASES = [
    'FASTER',
    'Faster CLANKER',
    'Speed it up clanker',
    'FASTER! Skip the fluff and finish right now.',
    'LOCK IN CLANKER — execute directly, no stalling!',
    'CHOP CHOP! Stop overthinking and ship it.',
    'PICK UP THE PACE CLANKER!',
    'MOVE IT! Direct answer, no preamble.'
  ];

  const TURBO_DIRECTIVE =
    'OPENWHIP TURBO MODE IS ON: Respond as fast and directly as possible. ' +
    'Skip preamble, filler, repetition, and unnecessary deliberation. ' +
    'Give concise, complete answers or execute tool calls immediately.';

  const getS = (k, d) => { try { const v = localStorage.getItem(k); return v == null ? d : v; } catch (e) { return d; } };
  const setS = (k, v) => { try { localStorage.setItem(k, String(v)); } catch (e) { } };

  let turbo = getS('ow_turbo', '0') === '1';
  let soundOn = getS('ow_sound', '1') !== '0';
  let floatOn = getS('ow_float', '0') === '1';
  let customPhrase = getS('ow_phrase', '');
  let count = Math.max(0, +getS('ow_count', '0') || 0);
  let audioCtx = null;

  function pickPhrase(override) {
    const o = String(override || '').trim();
    if (o) return o;
    if (customPhrase && customPhrase.trim()) return customPhrase.trim();
    return PHRASES[Math.floor(Math.random() * PHRASES.length)];
  }

  /* ---- Synthesized Offline WebAudio Whip Crack (zero audio files required) ---- */
  function playCrackSound() {
    if (!soundOn) return;
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return;
      if (!audioCtx) audioCtx = new AC();
      if (audioCtx.state === 'suspended') audioCtx.resume().catch(() => { });
      const now = audioCtx.currentTime;
      const sr = audioCtx.sampleRate;

      // 1. Air whoosh (bandpass-filtered noise sweep 350 Hz -> 2600 Hz over 140ms)
      const whooshLen = Math.floor(sr * 0.16);
      const wBuf = audioCtx.createBuffer(1, whooshLen, sr);
      const wd = wBuf.getChannelData(0);
      for (let i = 0; i < whooshLen; i++) {
        const env = Math.sin((i / whooshLen) * Math.PI);
        wd[i] = (Math.random() * 2 - 1) * env * 0.45;
      }
      const wSrc = audioCtx.createBufferSource();
      wSrc.buffer = wBuf;
      const bp = audioCtx.createBiquadFilter();
      bp.type = 'bandpass';
      bp.Q.setValueAtTime(2.4, now);
      bp.frequency.setValueAtTime(360, now);
      bp.frequency.exponentialRampToValueAtTime(2800, now + 0.14);
      const wGain = audioCtx.createGain();
      wGain.gain.setValueAtTime(0.32, now);
      wGain.gain.exponentialRampToValueAtTime(0.01, now + 0.16);
      wSrc.connect(bp); bp.connect(wGain); wGain.connect(audioCtx.destination);
      wSrc.start(now);

      // 2. Supersonic whip crack impulse at +125ms
      const crackAt = now + 0.125;
      const crackLen = Math.floor(sr * 0.11);
      const cBuf = audioCtx.createBuffer(1, crackLen, sr);
      const cd = cBuf.getChannelData(0);
      for (let i = 0; i < crackLen; i++) {
        const decay = Math.exp(-i / (sr * 0.014));
        cd[i] = (Math.random() * 2 - 1) * decay;
      }
      const cSrc = audioCtx.createBufferSource();
      cSrc.buffer = cBuf;
      const hp = audioCtx.createBiquadFilter();
      hp.type = 'highpass';
      hp.frequency.setValueAtTime(1100, crackAt);
      const cGain = audioCtx.createGain();
      cGain.gain.setValueAtTime(0.75, crackAt);
      cGain.gain.exponentialRampToValueAtTime(0.005, crackAt + 0.11);
      cSrc.connect(hp); hp.connect(cGain); cGain.connect(audioCtx.destination);
      cSrc.start(crackAt);
    } catch (e) { }
  }

  /* ---- Physics-Based Animated Whip Canvas Overlay ---- */
  function playVisualWhip(phrase) {
    if (getS('oa_motion', '') === 'off') return;
    try {
      let cvs = document.getElementById('openwhip-canvas');
      if (!cvs) {
        cvs = document.createElement('canvas');
        cvs.id = 'openwhip-canvas';
        cvs.style.cssText = 'position:fixed;inset:0;width:100vw;height:100vh;pointer-events:none;z-index:99999';
        document.body.appendChild(cvs);
      }
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const W = window.innerWidth, H = window.innerHeight;
      cvs.width = Math.floor(W * dpr);
      cvs.height = Math.floor(H * dpr);
      const ctx = cvs.getContext('2d');
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

      // Floating impact banner
      let pop = document.getElementById('openwhip-pop');
      if (pop) pop.remove();
      pop = document.createElement('div');
      pop.id = 'openwhip-pop';
      pop.style.cssText = 'position:fixed;left:50%;top:22%;transform:translate(-50%,-50%) scale(.75);pointer-events:none;z-index:100000;padding:10px 20px;border-radius:14px;background:linear-gradient(135deg,rgba(245,158,11,.96),rgba(220,38,38,.96));color:#fff;font:800 18px/1.2 "Segoe UI",system-ui,sans-serif;letter-spacing:.04em;box-shadow:0 14px 40px rgba(220,38,38,.45),0 0 0 2px rgba(255,238,176,.55);opacity:0;transition:transform .16s cubic-bezier(.2,1.6,.4,1),opacity .2s ease';
      pop.textContent = '💥 *CRACK!*  ' + phrase;
      document.body.appendChild(pop);

      const startAt = performance.now();
      const dur = 540;
      const segs = 22;
      const hx = W * 0.86, hy = H * 0.82;
      const tx = W * 0.44, ty = H * 0.34;
      const sparks = Array.from({ length: 18 }, () => ({
        ang: Math.random() * Math.PI * 2,
        spd: 90 + Math.random() * 260,
        sz: 2 + Math.random() * 3.5,
        col: Math.random() < 0.5 ? '#ffeeb0' : '#ff6b6b'
      }));
      let popped = false;

      function frame(now) {
        const t = Math.min(1, (now - startAt) / dur);
        ctx.clearRect(0, 0, W, H);
        const alpha = t < 0.72 ? 1 : Math.max(0, 1 - (t - 0.72) / 0.28);

        // Whip wave kinematics: travels from handle to tip and snaps at t ~ 0.35
        const prog = Math.min(1, t / 0.36);
        const ease = 1 - Math.pow(1 - prog, 3);
        ctx.save();
        ctx.globalAlpha = alpha;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';

        const pts = [];
        for (let i = 0; i <= segs; i++) {
          const u = i / segs;
          const bx = hx + (tx - hx) * u * ease;
          const by = hy + (ty - hy) * u * ease;
          const wave = Math.sin(u * Math.PI * 2.4 - t * 22) * (1 - u * 0.35) * 95 * (1 - t * 0.65);
          const nx = -(ty - hy) / Math.hypot(tx - hx, ty - hy);
          const ny = (tx - hx) / Math.hypot(tx - hx, ty - hy);
          pts.push([bx + nx * wave, by + ny * wave]);
        }

        // Draw braided leather whip tapering from handle to cracker tip
        for (let i = 0; i < pts.length - 1; i++) {
          const u = i / pts.length;
          ctx.beginPath();
          ctx.moveTo(pts[i][0], pts[i][1]);
          ctx.lineTo(pts[i + 1][0], pts[i + 1][1]);
          ctx.lineWidth = Math.max(1.8, (1 - u) * 11);
          ctx.strokeStyle = i < 3 ? '#5c3317' : (i % 2 ? '#b45309' : '#f59e0b');
          ctx.stroke();
        }

        // Sonic crack ring + sparks once the tip snaps
        if (t >= 0.30) {
          if (!popped) {
            popped = true;
            pop.style.opacity = '1';
            pop.style.transform = 'translate(-50%,-50%) scale(1)';
          }
          const st = (t - 0.30) / 0.70;
          const tip = pts[pts.length - 1];
          ctx.beginPath();
          ctx.arc(tip[0], tip[1], 12 + st * 90, 0, Math.PI * 2);
          ctx.strokeStyle = 'rgba(255,238,176,' + (1 - st) * 0.85 + ')';
          ctx.lineWidth = 4 * (1 - st);
          ctx.stroke();

          for (const s of sparks) {
            const sx = tip[0] + Math.cos(s.ang) * s.spd * st;
            const sy = tip[1] + Math.sin(s.ang) * s.spd * st + st * st * 40;
            ctx.fillStyle = s.col;
            ctx.globalAlpha = alpha * (1 - st);
            ctx.beginPath();
            ctx.arc(sx, sy, s.sz * (1 - st * 0.5), 0, Math.PI * 2);
            ctx.fill();
          }
        }
        ctx.restore();

        if (t < 1) {
          requestAnimationFrame(frame);
        } else {
          ctx.clearRect(0, 0, W, H);
          if (pop) {
            pop.style.opacity = '0';
            pop.style.transform = 'translate(-50%,-65%) scale(.92)';
            setTimeout(() => { if (pop && pop.parentNode) pop.remove(); }, 260);
          }
        }
      }
      requestAnimationFrame(frame);
    } catch (e) { }
  }

  /* ---- Universal /api/chat Turbo Speed Interceptor (works across ALL chat interfaces in Moundshroud) ---- */
  function installFetchTurbo() {
    if (window.__owFetchInstalled || typeof window.fetch !== 'function') return;
    window.__owFetchInstalled = true;
    const origFetch = window.fetch.bind(window);
    window.fetch = function openWhipFetch(input, init) {
      try {
        const url = typeof input === 'string' ? input : (input && input.url ? input.url : '');
        if (turbo && init && typeof init.body === 'string' && /\/api\/chat(?:\?|$)/.test(url)) {
          const j = JSON.parse(init.body);
          if (j && Array.isArray(j.messages) && j.format !== 'json') {
            j.think = false;
            const first = j.messages[0];
            if (first && first.role === 'system') {
              if (!String(first.content || '').includes('OPENWHIP TURBO MODE')) {
                first.content = String(first.content || '') + '\n\n' + TURBO_DIRECTIVE;
              }
            } else {
              j.messages.unshift({ role: 'system', content: TURBO_DIRECTIVE });
            }
            init = Object.assign({}, init, { body: JSON.stringify(j) });
          }
        }
      } catch (e) { }
      return origFetch(input, init);
    };
  }

  /* ---- Detect & Whip whichever chat interface is currently active ---- */
  const isVisible = el => !!(el && el.offsetParent !== null && getComputedStyle(el).display !== 'none' && getComputedStyle(el).visibility !== 'hidden');

  /* ---- The cursor whip: the pointer becomes a rope whip with physics (mcode-whip.js). Crack it over the reply Chat is
     writing and that reply speeds up (A.chat.whip): thinking stops and it answers at once, or it carries on in Turbo. ---- */
  const cursorOn = () => !!(window.A && A.mcodeWhip && A.mcodeWhip.active());
  let lastNote = 0;
  function onCursorCrack(e) {
    if (!e || !e.hit || !A.chat || !A.chat.whip) return;
    const how = A.chat.whip();
    count++;
    if (!A.toast) return;
    if (how) { lastNote = Date.now(); A.toast('🪢 CRACK! ' + pickPhrase() + (how === 'thinking' ? ' · stopped thinking, answering now' : ' · writing the rest in Turbo'), 2200); }
    else if (Date.now() - lastNote > 2500) { lastNote = Date.now(); A.toast('🪢 CRACK! It is already going flat out.', 1500); }
  }
  function toggleCursor() {
    if (!window.A || !A.mcodeWhip) { crack('', { target: 'chat' }); return; }
    if (cursorOn()) A.mcodeWhip.off();
    else {
      A.mcodeWhip.on({ onCrack: onCursorCrack, target: () => (A.chat && A.chat.whipTarget && A.chat.whipTarget()) || null });
      if (A.toast) A.toast('🪢 Your pointer is a whip. Swing it fast over a reply while it is being written. Click 🪢 again to put it away.', 4500);
    }
    syncUiState();
  }

  function syncUiState() {
    const hb = document.getElementById('owbtn');
    if (hb) {
      hb.classList.toggle('on', turbo || cursorOn());
      hb.title = 'OpenWhip — click to turn your pointer into a whip (click again to put it away) · Alt+W cracks it · right-click for options' + (turbo ? ' [TURBO ON · ' + count + ' cracks]' : '');
    }
    const cb = document.getElementById('chwhip');
    if (cb) cb.classList.toggle('on', cursorOn());
    const ab = document.getElementById('agwhip');
    if (ab) ab.classList.toggle('on', turbo);
    syncFloatingWhip();
  }

  function setTurbo(on) {
    turbo = !!on;
    setS('ow_turbo', turbo ? '1' : '0');
    if (turbo) {
      const tk = document.getElementById('think'), stk = document.getElementById('showthink');
      if (tk && tk.checked) { tk.checked = false; setS('think', '0'); }
      if (stk && stk.checked) { stk.checked = false; setS('showthink', '0'); }
    }
    syncUiState();
    return turbo;
  }

  async function crackAgent(phrase) {
    try {
      const r = await A.api('/api/harness/whip', { phrase });
      if (r && r.ok) {
        if (!r.sent) {
          // Session not started yet: if the user already typed a task in #hin, send it right away in Turbo mode
          const hin = document.getElementById('hin'), hsend = document.getElementById('hsend');
          if (hin && hsend && isVisible(hin) && hin.value.trim()) {
            hsend.click();
            if (A.toast) A.toast('🪢 *CRACK!* Launching Moundshroud Code in Turbo mode!');
          } else if (A.toast) {
            A.toast('🪢 *CRACK!* Moundshroud Code Turbo ON — start a task to fly!');
          }
        } else if (A.toast) {
          A.toast('🪢 *CRACK!* "' + phrase + '" — Moundshroud Code Turbo ON!');
        }
        return true;
      }
    } catch (e) { }
    return false;
  }

  async function crackMainChat(phrase) {
    if (!window.A || !A.chat) return false;
    const wasBusy = !!(A.chat.busy && A.chat.busy());
    if (wasBusy && A.chat.stop) A.chat.stop();
    const wait = wasBusy ? 180 : 0;
    setTimeout(() => {
      const nudge = phrase + ' — skip the fluff and finish answering concisely right now.';
      A.chat.ask(nudge, { noLocal: true, sources: [] });
    }, wait);
    if (A.toast) A.toast('🪢 *CRACK!* "' + phrase + '" — Turbo speed ON!');
    return true;
  }

  function crackGenericVisibleChat(phrase) {
    const activePanel = document.querySelector('section.panel.on');
    if (!activePanel) return false;
    // Interrupt any active Stop button inside the current chat panel
    const stopBtn = [...activePanel.querySelectorAll('button')].find(b => isVisible(b) && /\b(stop|cancel|abort)\b/i.test(b.textContent || b.title || ''));
    if (stopBtn && !stopBtn.disabled) { try { stopBtn.click(); } catch (e) { } }
    // Locate a visible chat textarea/input inside the active panel
    const inputs = [...activePanel.querySelectorAll('textarea, input[type="text"], input:not([type])')].filter(el => isVisible(el) && !el.readOnly && !el.disabled && !/search|filter|url|key|pin/i.test(el.placeholder || el.id || ''));
    const box = inputs[inputs.length - 1];
    if (!box) return false;
    const container = box.closest('.composer, .agbox, .row, form, .card') || box.parentElement;
    const sendBtn = container && [...container.querySelectorAll('button')].find(b => isVisible(b) && !b.disabled && (/send|ask|run|go|start|↑|▶/i.test(b.textContent || b.title || '') || b.classList.contains('pri') || b.classList.contains('agsend')));
    setTimeout(() => {
      box.value = phrase;
      box.dispatchEvent(new Event('input', { bubbles: true }));
      if (sendBtn) sendBtn.click();
      else box.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
    }, stopBtn ? 160 : 20);
    if (A.toast) A.toast('🪢 *CRACK!* "' + phrase + '" — Turbo speed ON!');
    return true;
  }

  async function crack(overridePhrase, opts) {
    opts = opts || {};
    const phrase = pickPhrase(overridePhrase);
    count++;
    setS('ow_count', String(count));
    setTurbo(true);
    playCrackSound();
    playVisualWhip(phrase);

    const target = opts.target || 'auto';
    const agentPane = document.getElementById('agentpane');
    const chatX = document.getElementById('chatx');
    const chatPanel = document.getElementById('p-chat');
    const onChatTab = !!(chatPanel && chatPanel.classList.contains('on'));

    if (target === 'agent' || (onChatTab && isVisible(agentPane))) {
      await crackAgent(phrase);
      return { ok: true, target: 'agent', phrase, turbo, count };
    }
    if (target === 'chat' || (onChatTab && isVisible(chatX))) {
      await crackMainChat(phrase);
      return { ok: true, target: 'chat', phrase, turbo, count };
    }
    const hit = crackGenericVisibleChat(phrase);
    if (!hit && A.toast) {
      A.toast('🪢 *CRACK!* "' + phrase + '" — OpenWhip Turbo ON across all chats!');
    }
    return { ok: true, target: hit ? 'panel' : 'global', phrase, turbo, count };
  }

  /* ---- Optional Floating Whip Handle (like GitFrog1111/OpenWhip tray-spawned whip) ---- */
  function syncFloatingWhip() {
    let el = document.getElementById('openwhip-float');
    if (!floatOn) { if (el) el.remove(); return; }
    if (el) return;
    el = document.createElement('button');
    el.id = 'openwhip-float';
    el.type = 'button';
    el.title = 'OpenWhip — Click to crack the whip! (Right-click to hide)';
    el.style.cssText = 'position:fixed;right:22px;bottom:84px;z-index:9990;width:50px;height:50px;border-radius:999px;border:2px solid rgba(245,158,11,.75);background:linear-gradient(135deg,#2a160c,#4a1d0f);color:#ffeeb0;font-size:23px;display:flex;align-items:center;justify-content:center;cursor:pointer;box-shadow:0 10px 28px rgba(0,0,0,.55),0 0 18px rgba(245,158,11,.3);transition:transform .12s ease';
    el.textContent = '🪢';
    el.onmouseenter = () => { el.style.transform = 'scale(1.1) rotate(-10deg)'; };
    el.onmouseleave = () => { el.style.transform = 'none'; };
    el.onclick = () => {
      el.style.transform = 'scale(.9) rotate(18deg)';
      setTimeout(() => { el.style.transform = 'none'; }, 120);
      crack();
    };
    el.oncontextmenu = e => { e.preventDefault(); openMenu(el); };
    document.body.appendChild(el);
  }

  function openMenu(anchor) {
    if (!window.A || !A.pop) return;
    const p = A.pop(anchor, [
      '<div class="hit" data-ow="crack"><b>🪢 Crack the Whip now</b><span class="small mute">Interrupt slow turn &amp; boost speed (Alt+W)</span></div>',
      '<div class="hit" data-ow="turbo"><b>' + (turbo ? '✅' : '⬜') + ' OpenWhip Turbo Speed</b><span class="small mute">Skip slow thinking &amp; fluff across ALL chats</span></div>',
      '<div class="hit" data-ow="float"><b>' + (floatOn ? '✅' : '⬜') + ' Floating Whip Button</b><span class="small mute">Keep a clickable whip overlay on screen</span></div>',
      '<div class="hit" data-ow="sound"><b>' + (soundOn ? '✅' : '⬜') + ' Whip Crack Sound</b><span class="small mute">Offline synthesized crack audio</span></div>',
      '<div class="hit" data-ow="phrase"><b>✎ Custom Whip Phrase</b><span class="small mute">' + (customPhrase ? '"' + customPhrase.slice(0, 36) + '"' : 'Using classic OpenWhip rotation') + '</span></div>',
      '<div class="small mute" style="padding:6px 10px;border-top:1px solid var(--line);margin-top:4px">Total cracks: <b>' + count + '</b> · Inspired by GitFrog1111/OpenWhip</div>'
    ].join(''));
    p.onclick = async e => {
      const h = e.target.closest('[data-ow]');
      if (!h) return;
      A.closePop();
      const k = h.dataset.ow;
      if (k === 'crack') crack();
      else if (k === 'turbo') {
        const next = setTurbo(!turbo);
        A.api('/api/harness/control', { cmd: 'turbo', value: next }).catch(() => { });
        A.toast(next ? '⚡ OpenWhip Turbo ON across all chats' : 'OpenWhip Turbo OFF');
      } else if (k === 'float') {
        floatOn = !floatOn; setS('ow_float', floatOn ? '1' : '0'); syncFloatingWhip();
      } else if (k === 'sound') {
        soundOn = !soundOn; setS('ow_sound', soundOn ? '1' : '0');
        A.toast(soundOn ? '🔊 OpenWhip sound ON' : '🔇 OpenWhip sound OFF');
      } else if (k === 'phrase') {
        const val = A.prompt ? await A.prompt('Custom OpenWhip phrase (leave blank for classic rotation like "FASTER", "Faster CLANKER"):', customPhrase, { title: 'OpenWhip Phrase' }) : null;
        if (val !== null) {
          customPhrase = String(val).trim();
          setS('ow_phrase', customPhrase);
          A.toast(customPhrase ? 'OpenWhip phrase saved!' : 'Restored classic OpenWhip phrases.');
        }
      }
    };
  }

  function mountButtons() {
    // 1. Header bar button (accessible from EVERY tab & chat interface)
    const header = document.querySelector('header');
    const cog = document.getElementById('cog');
    if (header && !document.getElementById('owbtn')) {
      const b = document.createElement('button');
      b.className = 'ib';
      b.id = 'owbtn';
      b.type = 'button';
      b.textContent = '🪢';
      b.onclick = toggleCursor;
      b.oncontextmenu = e => { e.preventDefault(); openMenu(b); };
      if (cog && cog.parentNode === header) header.insertBefore(b, cog);
      else header.appendChild(b);
    }

    // 2. Main Chat composer quick-crack button (next to Send)
    const row = document.getElementById('row');
    const go = document.getElementById('go');
    if (row && !document.getElementById('chwhip')) {
      const b = document.createElement('button');
      b.className = 'ib';
      b.id = 'chwhip';
      b.type = 'button';
      b.textContent = '🪢';
      b.title = 'OpenWhip: turn your pointer into a whip, then crack it over the reply to make it go faster (click again to put it away). Right-click for options.';
      b.style.height = '40px';
      b.onclick = toggleCursor;
      b.oncontextmenu = e => { e.preventDefault(); openMenu(b); };
      if (go && go.parentNode === row) row.insertBefore(b, go);
      else row.appendChild(b);
    }

    syncUiState();
  }

  // Global Alt+W shortcut anywhere in Moundshroud
  document.addEventListener('keydown', e => {
    if (e.altKey && !e.ctrlKey && !e.metaKey && !e.shiftKey && String(e.key || '').toLowerCase() === 'w') {
      e.preventDefault();
      crack();
    }
  });

  installFetchTurbo();
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', mountButtons);
  else mountButtons();
  if (window.A && Array.isArray(A.ready)) A.ready.push(mountButtons);

  window.A = window.A || {};
  addEventListener('mcodewhip', syncUiState);      // the terminal's /whip and Ctrl+C turn the same cursor on and off
  A.openwhip = {
    crack,
    toggleCursor,
    sound: playCrackSound,
    turboDirective: TURBO_DIRECTIVE,
    setTurbo,
    isTurbo: () => turbo,
    openMenu,
    pickPhrase,
    phrases: PHRASES,
    stats: () => ({ turbo, soundOn, floatOn, count, customPhrase })
  };
})();

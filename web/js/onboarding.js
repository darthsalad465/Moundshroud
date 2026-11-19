// Graphical First-Run Setup Wizard + Native Desktop App Titlebar integration (Moundshroud Desktop).
// Replaces scary terminal setup with a 4-step studio-grade welcome wizard (Theme -> Local AI Check -> Privacy/Offline -> Launch).
(() => {
  const esc = s => String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const DONE_KEY = 'oa_onboard_v1';

  /* ---------- Native Desktop Titlebar drag-region integration (Electron titleBarOverlay) ---------- */
  if (window.MOUNDSHROUD_DESKTOP && window.MOUNDSHROUD_DESKTOP.isDesktop) {
    document.documentElement.classList.add('ms-desktop');
    if (!document.getElementById('ms-desk-css')) {
      const st = document.createElement('style');
      st.id = 'ms-desk-css';
      st.textContent = `
html.ms-desktop body > header { -webkit-app-region: drag; padding-right: 146px !important; }
html.ms-desktop body > header button,
html.ms-desktop body > header input,
html.ms-desktop body > header select,
html.ms-desktop body > header a { -webkit-app-region: no-drag; }
`;
      document.head.appendChild(st);
    }
  }

  /* ---------- Zero-blur Wizard Styles ---------- */
  function ensureCss() {
    if (document.getElementById('ob-css')) return;
    const st = document.createElement('style');
    st.id = 'ob-css';
    st.textContent = `
#ob-ov{position:fixed;inset:0;z-index:260;background:rgba(4,7,18,.82);display:flex;align-items:center;justify-content:center;padding:20px}
.ob-card{width:min(760px,100%);max-height:min(88vh,680px);display:flex;flex-direction:column;border-radius:22px;overflow:hidden;background:linear-gradient(180deg,color-mix(in srgb,var(--panel2) 48%,var(--panel)),var(--panel));border:1px solid color-mix(in srgb,var(--acc) 35%,var(--line));box-shadow:0 32px 90px rgba(0,0,0,.72);color:var(--text)}
.ob-hd{display:flex;align-items:center;gap:14px;padding:18px 22px;border-bottom:1px solid var(--line)}
.ob-orb{width:44px;height:44px;border-radius:13px;display:grid;place-items:center;font-size:22px;color:#fff;background:linear-gradient(135deg,#0ea5e9,#6366f1);box-shadow:0 0 24px rgba(99,102,241,.45);flex:none}
.ob-steps{display:flex;gap:6px;margin-left:auto}
.ob-dot{width:28px;height:6px;border-radius:99px;background:rgba(148,163,184,.22);transition:background-color .2s,width .2s}
.ob-dot.on{background:var(--acc);width:42px}
.ob-dot.done{background:#10b981}
.ob-bd{flex:1;overflow:auto;padding:22px 24px;display:flex;flex-direction:column;gap:16px}
.ob-ft{display:flex;align-items:center;gap:10px;padding:14px 22px;border-top:1px solid var(--line);background:color-mix(in srgb,var(--panel2) 40%,var(--panel))}
.ob-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(135px,1fr));gap:10px}
.ob-thm{text-align:left;padding:9px 10px;border-radius:12px;border:2px solid var(--line);background:var(--panel2);color:var(--text);cursor:pointer;transition:border-color .15s}
.ob-thm.on{border-color:var(--acc)}
.ob-sw{display:flex;height:28px;border-radius:7px;overflow:hidden;margin-bottom:6px;border:1px solid rgba(255,255,255,.08)}
.ob-chklist{display:flex;flex-direction:column;gap:8px}
.ob-chkrow{display:flex;align-items:center;gap:12px;padding:11px 14px;border-radius:12px;background:var(--panel2);border:1px solid var(--line)}
.ob-badge{padding:2px 9px;border-radius:999px;font-size:11px;font-weight:700;margin-left:auto}
.ob-badge.ok{background:rgba(16,185,129,.2);color:#34d399}
.ob-badge.warn{background:rgba(245,158,11,.2);color:#fbbf24}
.ob-tiles{display:grid;grid-template-columns:1fr 1fr;gap:10px}
.ob-tile{display:flex;align-items:center;gap:12px;padding:13px 14px;border-radius:14px;border:1px solid var(--line);background:var(--panel2);color:var(--text);text-align:left;cursor:pointer;transition:border-color .15s,background-color .15s}
.ob-tile:hover{border-color:var(--acc);background:color-mix(in srgb,var(--acc) 12%,var(--panel2))}
.ob-tile i{font-style:normal;font-size:24px;width:40px;height:40px;border-radius:11px;display:grid;place-items:center;background:rgba(148,163,184,.12);flex:none}
`;
    document.head.appendChild(st);
  }

  let ov = null;
  let step = 0;

  function close(markDone) {
    if (markDone) { try { localStorage.setItem(DONE_KEY, '1'); } catch (e) { } }
    if (ov) { ov.remove(); ov = null; }
  }

  async function renderStep() {
    if (!ov) return;
    const bd = ov.querySelector('#ob-bd');
    const title = ov.querySelector('#ob-title');
    const sub = ov.querySelector('#ob-sub');
    const prevBtn = ov.querySelector('#ob-prev');
    const nextBtn = ov.querySelector('#ob-next');
    ov.querySelectorAll('.ob-dot').forEach((d, i) => {
      d.classList.toggle('on', i === step);
      d.classList.toggle('done', i < step);
    });
    prevBtn.style.visibility = step === 0 ? 'hidden' : 'visible';
    nextBtn.textContent = step === 3 ? 'Launch Moundshroud →' : 'Continue →';

    if (step === 0) {
      title.textContent = 'Welcome to Moundshroud';
      sub.textContent = 'Step 1 of 4 · Pick your look (changes live behind this window)';
      const TH = window.OA_THEMES;
      const cur = TH ? TH.get() : '';
      const themes = TH && Array.isArray(TH.list) ? TH.list.slice(0, 12) : [];
      bd.innerHTML =
        '<div style="font-size:13.5px;line-height:1.55;color:var(--mute)">Everything in Moundshroud runs <b style="color:var(--text)">locally on your own computer</b> — AI chat, 3D World Globe, 1M-file 3D Brain, coding workspace, creative studios, offline library, and games. Pick a colour theme to make it yours:</div>' +
        '<div class="ob-grid" id="ob-thms">' +
          themes.map(t =>
            '<button type="button" class="ob-thm' + (t.id === cur ? ' on' : '') + '" data-th="' + esc(t.id) + '">' +
              '<span class="ob-sw"><i style="flex:2;background:' + t.sw[0] + '"></i><i style="flex:1;background:' + t.sw[1] + '"></i><i style="flex:1;background:' + t.sw[2] + '"></i></span>' +
              '<b style="font-size:12.5px;display:block">' + esc(t.name) + '</b>' +
              '<span class="small mute" style="font-size:10.5px">' + (t.dark ? 'Dark' : 'Light') + '</span>' +
            '</button>'
          ).join('') +
        '</div>';
      const box = bd.querySelector('#ob-thms');
      if (box && TH) {
        box.onclick = e => {
          const b = e.target.closest('[data-th]'); if (!b) return;
          TH.apply(b.dataset.th);
          box.querySelectorAll('.ob-thm').forEach(x => x.classList.toggle('on', x === b));
        };
      }
    } else if (step === 1) {
      title.textContent = 'On-Device AI & Local Services';
      sub.textContent = 'Step 2 of 4 · Checking what is ready on this computer';
      bd.innerHTML = '<div class="small mute">Checking local AI engine and offline modules…</div>';
      const [st, mods] = await Promise.all([
        fetch('/api/status').then(r => r.ok ? r.json() : null).catch(() => null),
        fetch('/api/models').then(r => r.ok ? r.json() : null).catch(() => null)
      ]);
      const localCount = mods && Array.isArray(mods.models) ? mods.models.filter(m => !m.cloud).length : 0;
      bd.innerHTML =
        '<div class="ob-chklist">' +
          '<div class="ob-chkrow"><span style="font-size:20px">⚡</span><div><b>Moundshroud Local Engine</b><div class="small mute">Running privately on 127.0.0.1 — zero external telemetry</div></div><span class="ob-badge ok">READY</span></div>' +
          '<div class="ob-chkrow"><span style="font-size:20px">🧠</span><div><b>Ollama Local AI</b><div class="small mute">' + (st && st.ollama ? (localCount + ' local model' + (localCount === 1 ? '' : 's') + ' installed on this PC') : 'Not running yet — you can install/start Ollama anytime in Prepare › Stock up') + '</div></div><span class="ob-badge ' + (st && st.ollama && localCount ? 'ok' : 'warn') + '">' + (st && st.ollama && localCount ? (localCount + ' MODELS') : 'OPTIONAL') + '</span></div>' +
          '<div class="ob-chkrow"><span style="font-size:20px">🌎</span><div><b>3D World Globe &amp; 3D File Brain</b><div class="small mute">WebGL2 GPU-accelerated offline world atlas + 1M-file PC visualiser</div></div><span class="ob-badge ok">READY</span></div>' +
          '<div class="ob-chkrow"><span style="font-size:20px">📚</span><div><b>Offline Library (Kiwix)</b><div class="small mute">' + (st && st.lib ? 'Offline encyclopaedia &amp; books detected' : 'Optional — download offline Wikipedia &amp; guides anytime in Prepare › Stock up') + '</div></div><span class="ob-badge ' + (st && st.lib ? 'ok' : 'warn') + '">' + (st && st.lib ? 'READY' : 'OPTIONAL') + '</span></div>' +
        '</div>' +
        (!st || !st.ollama || !localCount ? '<div style="margin-top:4px"><button type="button" class="ib" id="ob-stock">📦 Open Prepare › Stock up after setup to grab starter AI models</button></div>' : '');
      const sb = bd.querySelector('#ob-stock');
      if (sb) sb.onclick = () => { close(true); A.showTab('prep'); };
    } else if (step === 2) {
      title.textContent = 'Privacy & Offline Lockdown';
      sub.textContent = 'Step 3 of 4 · You control every packet that leaves this PC';
      let offSt = { appOffline: false };
      try { const r = await fetch('/api/offline/status'); if (r.ok) offSt = await r.json(); } catch (e) { }
      const buddyOn = A.companion && A.companion.isOn ? A.companion.isOn() : true;
      bd.innerHTML =
        '<div class="ob-chklist">' +
          '<div class="ob-chkrow">' +
            '<span style="font-size:22px">🛡️</span>' +
            '<div style="flex:1"><b>Strict App Offline Lockdown</b><div class="small mute">Hard-block every outbound internet connection inside Moundshroud (Web, News, Cloud AI, live 3D Globe feeds). You can also shut your entire PC offline anytime in Settings › Offline &amp; Air-Gap.</div></div>' +
            '<label class="chk" style="margin:0"><input type="checkbox" id="ob-offapp"' + (offSt.appOffline ? ' checked' : '') + '> <span class="small">Lock Offline</span></label>' +
          '</div>' +
          '<div class="ob-chkrow">' +
            '<span style="font-size:22px">🦉</span>' +
            '<div style="flex:1"><b>Show Animated Buddy Companion</b><div class="small mute">Your little helper in the corner that chats, reacts, and runs quick actions.</div></div>' +
            '<label class="chk" style="margin:0"><input type="checkbox" id="ob-buddy"' + (buddyOn ? ' checked' : '') + '> <span class="small">Show</span></label>' +
          '</div>' +
        '</div>';
      bd.querySelector('#ob-offapp').onchange = async e => {
        try {
          await fetch('/api/offline/app', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ offline: e.target.checked }) });
          A.toast(e.target.checked ? '🛡️ App Offline Lockdown enabled.' : 'App Offline Lockdown off.');
        } catch (err) { }
      };
      bd.querySelector('#ob-buddy').onchange = e => {
        if (A.companion && A.companion.toggle) {
          const cur = A.companion.isOn();
          if (cur !== e.target.checked) A.companion.toggle();
        }
      };
    } else {
      title.textContent = 'You Are All Set!';
      sub.textContent = 'Step 4 of 4 · Jump straight into your favorite workspace';
      bd.innerHTML =
        '<div style="font-size:13.5px;color:var(--mute);line-height:1.5">Press <kbd>Ctrl+K</kbd> anytime to search everything or jump to any tool. Right-click anywhere for quick actions, or open <b style="color:var(--text)">Settings ⚙️</b> to change themes, offline kill-switches, or voices.</div>' +
        '<div class="ob-tiles" id="ob-go">' +
          '<button type="button" class="ob-tile" data-tab="chat"><i>💬</i><div><b>AI Chat &amp; Agent</b><div class="small mute">Private local chat, voice &amp; file search</div></div></button>' +
          '<button type="button" class="ob-tile" data-tab="globe"><i>🌎</i><div><b>3D World Globe</b><div class="small mute">GodMode OSINT, live radar &amp; offline regions</div></div></button>' +
          '<button type="button" class="ob-tile" data-tab="brain"><i>🧠</i><div><b>3D File Brain</b><div class="small mute">Explore 1M+ PC files at 60+ FPS</div></div></button>' +
          '<button type="button" class="ob-tile" data-tab="studio"><i>🎨</i><div><b>Creative Studio</b><div class="small mute">Images, music, games, video &amp; more</div></div></button>' +
        '</div>';
      bd.querySelector('#ob-go').onclick = e => {
        const b = e.target.closest('[data-tab]'); if (!b) return;
        close(true);
        A.showTab(b.dataset.tab);
      };
    }
  }

  function open() {
    ensureCss();
    close(false);
    step = 0;
    ov = document.createElement('div');
    ov.id = 'ob-ov';
    ov.innerHTML =
      '<div class="ob-card">' +
        '<div class="ob-hd">' +
          '<div class="ob-orb">✦</div>' +
          '<div><b id="ob-title" style="font-size:17px;display:block">Welcome to Moundshroud</b><span id="ob-sub" class="small mute">Quick setup</span></div>' +
          '<div class="ob-steps"><i class="ob-dot on"></i><i class="ob-dot"></i><i class="ob-dot"></i><i class="ob-dot"></i></div>' +
        '</div>' +
        '<div class="ob-bd" id="ob-bd"></div>' +
        '<div class="ob-ft">' +
          '<button type="button" class="ib" id="ob-skip">Skip</button>' +
          '<span style="flex:1"></span>' +
          '<button type="button" class="ib" id="ob-prev">← Back</button>' +
          '<button type="button" class="pri" id="ob-next">Continue →</button>' +
        '</div>' +
      '</div>';
    document.body.appendChild(ov);
    ov.querySelector('#ob-skip').onclick = () => close(true);
    ov.querySelector('#ob-prev').onclick = () => { if (step > 0) { step--; renderStep(); } };
    ov.querySelector('#ob-next').onclick = () => { if (step < 3) { step++; renderStep(); } else close(true); };
    renderStep();
  }

  A.onboarding = { open, close };

  // Auto-open once on a brand-new desktop install (never bothers existing users who already have chats/settings)
  A.ready.push(() => {
    try {
      const seen = localStorage.getItem(DONE_KEY) === '1';
      const hasHistory = !!localStorage.getItem('oa_shroud') || !!localStorage.getItem('oa_theme');
      if (!seen && !hasHistory && window.MOUNDSHROUD_DESKTOP && window.MOUNDSHROUD_DESKTOP.isDesktop) {
        setTimeout(() => open(), 900);
      }
    } catch (e) { }
  });
})();

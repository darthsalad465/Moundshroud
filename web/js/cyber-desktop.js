// Cyber > Cyber Desktop. The guest shell runs in its own opaque-origin document.
(() => {
  const prefix = 'cyber_desktop_';
  const read = (key, fallback = '') => ls.get(prefix + key, fallback);
  const write = (key, value) => ls.set(prefix + key, value);
  const themes = [['abyss', 'Abyss'], ['glacier', 'Glacier'], ['ember', 'Ember'], ['violet', 'Violet']];
  const interfaces = [['studio', 'Studio', 'Glass panels and a centered dock'], ['operator', 'Operator', 'Amber highlights and a compact side dock'], ['workstation', 'Workstation', 'High-contrast blue with a traditional taskbar']];
  const { cases: extraCases, collections, utilities, guide } = A.cyberDesktopData;
  const incidentCases = ['mail-triage', 'remote-session', 'endpoint-alert', 'recovery'];
  const shellTools = { SQLite: 'sql', PowerShell: 'powershell', strings: 'bash', TShark: 'network', tcpdump: 'network' };
  const apps = {
    terminal: ['›_', 'Terminal'], tools: ['◇', 'Security Labs'], files: ['▤', 'Files'],
    browser: ['◎', 'Moundshroud Browser'], notes: ['✎', 'Notes'], settings: ['⚙', 'Settings'],
    guide: ['?', 'Desktop Guide'], catalog: ['◈', 'Kali Tools'], local: ['◉', 'Guest Browser'],
    incidents: ['▥', 'Incident Desk'], utility: ['#', 'Evidence Utilities'],
    tutorial: ['▷', 'Tutorial'], remote: ['▣', 'Remote Sessions']
  };
  const dockApps = ['terminal', 'remote', 'browser', 'incidents', 'files', 'notes', 'guide', 'settings'];
  const lessons = [
    ['Boot and sign in', 'settings', ['Choose Virtual Disk to keep your files. Choose Live USB for a fresh practice session.', 'Type Moundshroud in the password box and press Sign in.', 'Pick an app from Applications or select it in the dock.']],
    ['Arrange windows', 'notes', ['Open Notes and Terminal. Both windows stay open. Click a visible window to bring it forward.', 'Drag the title bar to move a window. Drag its lower-right corner to resize it.', 'Use − to minimize, □ to maximize or restore, and × to close. Click a running app in the dock to bring it back.']],
    ['Open a remote practice session', 'remote', ['Open Remote Sessions. Choose an exercise and difficulty, then press Generate case.', 'Click a computer card to open its own window. Open Files to read records or Console to run local practice commands.', 'Compare the reports. Return to Remote Sessions to verify the computer name and reference.']],
    ['Use the Terminal Playground', 'terminal', ['Open Terminal. In Sandbox choose Bash / Linux and type pwd, then press Enter.', 'Type ls to list files. The examples panel gives you commands to try.', 'Switch to Puzzles or Labyrinth for a challenge. Use Help to learn what the current shell understands.']],
    ['Work a case and write a report', 'incidents', ['Open Incident Desk and select a case.', 'Read the case and its evidence. Pick the response you think fits and press Check answer.', 'Add a completed finding to Notes. Use Next incident phase to continue.']],
    ['Search the browsers', 'browser', ['Open Moundshroud Browser in the dock. Search for a topic or use the + button to add a tab.', 'Use Back and Forward to return to earlier pages.', 'Choose Guest Browser from Applications to search the included help pages.']],
    ['Change the desktop', 'settings', ['Open Settings and select a desktop interface.', 'Pick a wallpaper, or use Import an image to choose a PNG, JPEG, or WebP.', 'Use the outer Fullscreen button to fill the screen. Press Escape to return.']]
  ];
  const cases = [
    ['inventory', 'Information Gathering', 'Inventory review', 'asset,zone,owner\nweb-01,edge,platform\nlab-print-02,guest,unassigned\nledger-01,internal,finance', 'Which asset needs an owner assigned?', ['web-01', 'lab-print-02', 'ledger-01'], 1, 'Assign ownership to lab-print-02 and verify its expected network zone.'],
    ['advisories', 'Vulnerability Analysis', 'Patch triage', 'service,status,exposure\nReporting,current,internal\nPortal,update required,internet-facing\nArchive,update required,offline', 'Which update should the team prioritize?', ['Archive', 'Reporting', 'Portal'], 2, 'Prioritize the internet-facing Portal update and verify the installed version afterward.'],
    ['headers', 'Web Application Testing', 'Response header review', 'HTTP/1.1 200 OK\nContent-Type: text/html\nStrict-Transport-Security: max-age=31536000\nSet-Cookie: session=DEMO; Secure; SameSite=Lax', 'Which cookie attribute is missing?', ['HttpOnly', 'Secure', 'SameSite'], 0, 'Set HttpOnly on the session cookie to limit script access to it.'],
    ['auth', 'Password Attacks', 'Credential defense', '12:01  maya  login failed\n12:02  maya  login failed\n12:03  maya  login failed\n12:04  maya  login failed\n12:05  maya  login failed', 'Which control directly slows repeated login attempts?', ['A longer session timeout', 'Login rate limiting', 'A shorter username'], 1, 'Rate-limit repeated attempts and monitor for account abuse.'],
    ['wireless', 'Wireless Attacks', 'Wireless audit', 'SSID          SECURITY       ZONE\nWorkshop     WPA3            Staff\nVisitor      WPA2            Guest\nLegacyLab    WEP             Lab', 'Which access point should be retired or upgraded first?', ['Visitor', 'Workshop', 'LegacyLab'], 2, 'Replace LegacyLab’s WEP configuration with a current security mode.'],
    ['incident', 'Exploitation', 'Incident timeline', '09:20  App server receives an unexpected request\n09:21  App worker launches an unexpected process\n09:22  Monitoring alert fires\n09:24  Analyst acknowledges alert', 'Which event is the first evidence that the server executed something unexpected?', ['09:24 acknowledgment', '09:20 request', '09:21 process launch'], 2, 'Preserve the process and request logs and begin containment of the affected server.'],
    ['traffic', 'Sniffing and Spoofing', 'Recorded network traffic', 'TIME   SOURCE       EVENT\n08:04  02:00:00:00:00:10  announces gateway 10.0.0.1\n08:05  02:00:00:00:00:55  announces gateway 10.0.0.1\n08:06  Clients report interrupted connectivity', 'What should the analyst verify first?', ['Whether the two MAC addresses belong to authorized gateways', 'The browser cache on every client', 'Whether the VLAN name is capitalized'], 0, 'Verify the gateway MAC addresses against inventory and inspect the relevant switch ports.'],
    ['containment', 'Post-Exploitation', 'Containment review', 'HOST     STATUS\nWS-17    Confirmed compromised; still online\nWS-18    Healthy\nDC-01    Healthy', 'What is the immediate containment priority?', ['Reboot the domain controller', 'Isolate WS-17 and preserve evidence', 'Delete logs on all endpoints'], 1, 'Isolate WS-17, retain relevant evidence, and scope the incident.'],
    ['forensics', 'Forensics', 'Evidence integrity', 'Acquired disk image fingerprint: 6f9c…2a3e\nWorking copy fingerprint:      c508…917d\nAlgorithm: SHA-256 (abbreviated for display)', 'How should you handle the working copy?', ['Mark it verified', 'Overwrite the source image', 'Reject it and make a verified working copy'], 2, 'Preserve the source and record the mismatch in the chain of custody.'],
    ['report', 'Reporting', 'Write a finding', 'Observation: the affected API returns verbose errors.\nEvidence: sample response contains an internal file path.\nOwner: application team.', 'Which detail makes the finding actionable?', ['A remediation and a way to verify it', 'A guess about who introduced the bug', 'An unrelated system inventory'], 0, 'Replace verbose errors with generic responses and verify that internal paths stay in server logs.'],
    ['phishing', 'Social Engineering', 'Message review', 'From: support@billing-notice.example\nSubject: Immediate access review\nBody: Tell us your one-time code or your account will be locked.', 'What should a recipient do?', ['Reply with the code', 'Report the message and verify through a known channel', 'Forward it to everyone'], 1, 'Report the message and verify the request independently. Never share one-time codes.'],
    ['binary', 'Reverse Engineering', 'Binary identification', '0000  7f 45 4c 46 02 01 01 00\n0008  00 00 00 00 00 00 00 00', 'Which format matches the first four bytes?', ['ZIP', 'ELF', 'PDF'], 1, 'Identify the ELF signature before selecting an analysis tool.']
  ];
  cases.push(...extraCases);
  const profiles = {
    all: ['All labs', cases.map(item => item[0])],
    audit: ['Security audit', ['inventory', 'advisories', 'headers', 'auth', 'wireless', 'report', 'phishing', 'dns-review', 'baseline', 'database']],
    response: ['Incident response', ['incident', 'traffic', 'containment', 'forensics', 'binary', 'report', 'integrity', ...incidentCases]]
  };
  const store = key => /^(?:tpg_|tplab_|tppuz_)[a-z0-9_:-]+$/i.test(key);
  const diskKey = prefix + 'terminal:';
  const getSaves = () => {
    const entries = [];
    try {
      for (let index = 0; index < localStorage.length; index++) {
        const name = localStorage.key(index);
        if (name?.startsWith(diskKey) && store(name.slice(diskKey.length))) {
          entries.push([name.slice(diskKey.length), localStorage.getItem(name)]);
        }
      }
    } catch (error) { /* Storage can be disabled by browser policy. */ }
    return entries;
  };
  const bootOptions = `
    <button type="button" data-boot="persistent"><b>Boot Cyber Desktop</b><small>Virtual disk · restore local guest data</small><i>↵</i></button>
    <button type="button" data-boot="live"><b>Boot live USB</b><small>Temporary session · clears on reboot</small><i>USB</i></button>`;

  function mount(host) {
    host.innerHTML = `<div class="cd-shell">
      <header class="cd-chrome"><span><img src="/web/logo-64.png" alt=""> Moundshroud Browser</span><b>Cyber Desktop</b>
        <button type="button" data-action="fullscreen" aria-pressed="false">⛶ Fullscreen</button></header>
      <div class="cd-screen">
        <section class="cd-boot">
          <div class="cd-boot-inner"><div class="cd-firmware">MOUNDSHROUD <strong>BIOS</strong><span>VIRTUAL FIRMWARE</span></div>
          <p class="cd-post">Memory check complete<br>Virtual disk and live media ready</p>
          <h2>Boot menu</h2><div class="cd-boot-options">${bootOptions}</div></div>
          <button class="cd-power" type="button" data-action="power" hidden>⏻ Power on</button>
        </section>
        <section class="cd-login" hidden>
          <form class="cd-login-card"><div class="cd-login-icon"><img src="/web/logo-64.png" alt=""></div>
            <h2>Sign in to Cyber Desktop</h2><p>moundshroud <span>·</span> <span data-session></span></p>
            <label>Guest password<input name="password" type="password" autocomplete="off" required aria-describedby="cd-password-help"></label>
            <p id="cd-password-help" class="cd-password-help">Demo password <code>Moundshroud</code>. Always use stronger, unique passwords for real accounts.</p>
            <button class="cd-primary" type="submit">Sign in</button><p data-login-error role="alert" hidden>Incorrect password.</p>
            <button type="button" data-action="restart">Return to boot menu</button>
          </form>
        </section>
        <section class="cd-desktop" hidden>
          <header class="cd-panel"><button type="button" data-action="applications" aria-expanded="false">◈ Applications</button>
            <time></time><div><span data-session></span><button type="button" data-action="power-menu" aria-label="Session options" aria-expanded="false">⏻</button></div></header>
          <nav class="cd-menu cd-app-menu" aria-label="Applications" hidden>
            <input type="search" data-menu-filter aria-label="Search applications and tools" placeholder="Search applications and tools">
            <div class="cd-app-menu-apps"></div><b class="cd-menu-heading">Kali tools · evidence exercises</b><div class="cd-app-menu-tools"></div>
          </nav>
          <nav class="cd-power-menu cd-menu" aria-label="Session options" hidden>
            <button type="button" data-action="lock">Lock screen</button><button type="button" data-action="restart">Restart</button><button type="button" data-action="shutdown">Shut down</button>
          </nav>
          <div class="cd-workspace">
            <div class="cd-hero"><div class="cd-orbit" aria-hidden="true">◈</div><div><span>OFFLINE SECURITY WORKSPACE</span><h1>Cyber Desktop</h1><p>Terminal practice and security labs</p></div></div>
            <div class="cd-windows"></div>
          </div>
          <nav class="cd-dock" aria-label="Dock"></nav>
        </section>
      </div>
    </div>`;
    const $ = selector => host.querySelector(selector);
    const shell = $('.cd-shell');
    const screen = $('.cd-screen');
    const boot = $('.cd-boot');
    const login = $('.cd-login');
    const desktop = $('.cd-desktop');
    const windows = $('.cd-windows');
    const form = $('.cd-login-card');
    const applications = $('.cd-app-menu');
    const powerMenu = $('.cd-power-menu');
    const clock = $('time');
    const fullscreenButton = $('[data-action="fullscreen"]');
    const slots = new Map();
    let active = '', windowOrder = 0, live = false, timer, terminalPort, terminalReady = false;
    const terminalQueue = [];
    const liveTerminalSaves = new Map();
    let liveTerminalBytes = 0;
    let theme, interfaceMode, customWallpaper, profile, notes, results, selectedCase, browserHistory, browserIndex;
    let releaseBrowser, breachLabRelease, selectedUtility = 'digest', labQuery = '', sessionVersion = 0, wallpaperRequest = 0;
    let tutorial = false, lesson = 0, step = 0, caseEgg = false;
    let remote;

    for (const [menu, ids] of [[$('.cd-app-menu-apps'), Object.keys(apps)], [$('.cd-dock'), dockApps]]) {
      for (const id of ids) menu.append(appButton(id, apps[id]));
    }
    function appButton(id, [icon, label]) {
      const item = document.createElement('button');
      item.type = 'button';
      item.dataset.app = id;
      item.setAttribute('aria-label', label);
      const glyph = document.createElement('i');
      glyph.setAttribute('aria-hidden', 'true');
      glyph.textContent = icon;
      const caption = document.createElement('span');
      caption.textContent = label;
      item.append(glyph, caption);
      return item;
    }
    renderMenuTools('');
    function applyAppearance() {
      shell.dataset.interface = interfaceMode;
      screen.dataset.theme = theme;
      if (/^data:image\/jpeg;base64,[a-z0-9+/=]+$/i.test(customWallpaper)) {
        screen.style.setProperty('--cd-wallpaper', 'url("' + customWallpaper + '")');
      } else {
        screen.style.removeProperty('--cd-wallpaper');
      }
      if (terminalReady) terminalPort.postMessage({ type: 'appearance', interface: interfaceMode });
    }
    function currentSettings() {
      tutorial = !live && read('tutorial') === '1';
      interfaceMode = live ? 'studio' : read('interface', 'studio');
      if (!interfaces.some(([id]) => id === interfaceMode)) interfaceMode = 'studio';
      customWallpaper = live ? '' : read('custom_wallpaper');
      theme = live ? 'abyss' : read('wallpaper', 'abyss');
      if (!themes.some(([id]) => id === theme) && !(theme === 'custom' && customWallpaper)) theme = 'abyss';
      profile = live ? 'all' : read('profile', 'all');
      if (!Object.hasOwn(profiles, profile)) profile = 'all';
      notes = live ? '' : read('notes');
      try { results = new Set(live ? [] : JSON.parse(read('results', '[]'))); }
      catch (error) { results = new Set(); }
      applyAppearance();
    }
    currentSettings();
    function time() {
      const now = new Date();
      clock.dateTime = now.toISOString();
      clock.textContent = new Intl.DateTimeFormat(undefined, { weekday: 'short', hour: 'numeric', minute: '2-digit' }).format(now);
    }
    function startClock() {
      clearInterval(timer);
      time();
      timer = setInterval(time, 15000);
    }
    function showStage(stage) {
      for (const item of [boot, login, desktop]) item.hidden = item !== stage;
      clearInterval(timer);
      if (stage === desktop) startClock();
    }
    function closeMenus() {
      applications.hidden = powerMenu.hidden = true;
      $('[data-action="applications"]').setAttribute('aria-expanded', 'false');
      $('[data-action="power-menu"]').setAttribute('aria-expanded', 'false');
    }
    function signIn() {
      form.reset();
      $('[data-login-error]').hidden = true;
      for (const label of host.querySelectorAll('[data-session]')) label.textContent = live ? 'Live USB' : 'Virtual disk';
      showStage(login);
      form.elements.password.focus();
    }
    function resetGuest(poweredOff, focus = true) {
      sessionVersion++;
      closeMenus();
      undockBrowser();
      if (terminalPort) terminalPort.close();
      terminalPort = null;
      terminalReady = false;
      terminalQueue.length = 0;
      liveTerminalSaves.clear();
      liveTerminalBytes = 0;
      windows.replaceChildren();
      slots.clear();
      remote = A.cyberRemote.create((id, pc) => openApp(id, false, pc), () => tutorial);
      active = selectedCase = '';
      windowOrder = 0;
      selectedUtility = 'digest';
      labQuery = '';
      lesson = step = 0;
      caseEgg = false;
      markActive('');
      browserHistory = ['home'];
      browserIndex = 0;
      showStage(boot);
      boot.classList.toggle('cd-off', poweredOff);
      $('.cd-power').hidden = !poweredOff;
      if (focus) (poweredOff ? $('.cd-power') : $('[data-boot]')).focus();
    }
    resetGuest(false, false);

    function markActive(id) {
      const front = slots.get(id);
      if (front && active !== id) {
        front.order = ++windowOrder;
        front.window.style.zIndex = String(front.order);
      }
      active = id;
      for (const [name, slot] of slots) slot.window.classList.toggle('cd-focused', name === id);
      const dock = $('.cd-dock');
      for (const name of slots.keys()) {
        if (dock.querySelector('[data-app="' + name + '"]')) continue;
        dock.append(appButton(name, slots.get(name).app));
      }
      for (const button of dock.querySelectorAll('[data-app]')) {
        const slot = slots.get(button.dataset.app);
        if (!slot && !dockApps.includes(button.dataset.app)) { button.remove(); continue; }
        button.setAttribute('aria-pressed', String(button.dataset.app === id));
        button.classList.toggle('cd-running', !!slot);
        button.classList.toggle('cd-minimized', !!slot?.window.hidden);
      }
    }
    function nextWindow() {
      let front;
      for (const slot of slots.values()) {
        if (!slot.window.hidden && (!front || slot.order > front.order)) front = slot;
      }
      return front;
    }
    function undockBrowser() {
      releaseBrowser?.();
      releaseBrowser = null;
      breachLabRelease?.(); breachLabRelease = null;
    }
    function dockBrowser() {
      const slot = slots.get('browser');
      if (!slot || slot.window.hidden || releaseBrowser) return;
      if (A.lib?.dock) { releaseBrowser = A.lib.dock(slot.body); setupBreachOverlay(slot.body); }
      else slot.body.textContent = 'Moundshroud Browser is unavailable.';
    }
    // A Breach Lab lives inside the real Moundshroud Browser: it turns each offline library the browser
    // holds into a fully simulated practice target. Nothing real is contacted; everything runs in this page.
    function setupBreachOverlay(body) {
      if (!A.cyberBreach || body.querySelector('[data-breach-launch]')) return;
      body.style.position = 'relative';
      const launch = document.createElement('button');
      launch.type = 'button';
      launch.dataset.breachLaunch = '1';
      launch.className = 'cd-breach-launch';
      launch.textContent = '🛡️ Breach Lab';
      launch.title = 'Practice web-security red teaming on simulated, offline copies of your libraries';
      const overlay = document.createElement('div');
      overlay.dataset.breachOverlay = '1';
      overlay.className = 'cd-breach-overlay';
      overlay.hidden = true;
      body.append(launch, overlay);
      const close = () => {
        breachLabRelease?.(); breachLabRelease = null;
        overlay.hidden = true; overlay.replaceChildren();
        launch.textContent = '🛡️ Breach Lab';
      };
      const open = () => {
        if (!overlay.hidden) { close(); return; }
        overlay.hidden = false;
        overlay.innerHTML = '<div class="cd-content" style="padding-top:8px"><div data-breach-host>Loading your offline library targets…</div></div>';
        launch.textContent = '← Back to browser';
        A.api('/api/lib/books').then(r => mountBreach(overlay, (r && r.books) || []))
          .catch(() => mountBreach(overlay, []));
      };
      launch.onclick = open;
    }
    function mountBreach(overlay, books) {
      if (overlay.hidden) return;
      const hostDiv = overlay.querySelector('[data-breach-host]');
      if (!hostDiv) return;
      hostDiv.textContent = '';
      breachLabRelease = A.cyberBreach.mount(hostDiv, { books });
    }
    function sizeWindow(slot, bounds) {
      for (const [name, value] of Object.entries(bounds)) slot.window.style.setProperty('--cd-' + name, Math.round(value) + 'px');
    }
    function placeWindow(slot, id) {
      const width = windows.clientWidth, height = windows.clientHeight;
      const wide = id === 'terminal' || id === 'browser';
      const w = Math.min(width, Math.max(340, Math.min(wide ? 1200 : 880, width * (wide ? .87 : .74))));
      const h = Math.min(height, Math.max(270, height * .82));
      const offset = (windowOrder % 6 - 2) * 20;
      sizeWindow(slot, { x: (width - w) / 2 + offset, y: (height - h) / 2 + offset / 2, width: w, height: h });
    }
    /* The terminal frame is isolated from /api, so mcode's model calls are made here and streamed back to it. */
    const terminalAi = new Map();
    async function bridgeTerminalAi(request, port) {
      const reply = message => { try { port.postMessage({ ...message, id: request.id }); } catch (e) { } };
      try {
        if (request.call === 'model') { reply({ type: 'ai-value', value: await A.ai.localModel() }); return; }
        if (request.call === 'models') {
          const response = await fetch('/api/models');
          if (!response.ok) throw new Error('Models unavailable');
          const { models = [] } = await response.json();
          reply({ type: 'ai-value', value: models.filter(model => !model.cloud && !/embed|(?:^|[-:])cloud$|^free-/i.test(model.name || ''))
            .map(model => model.name).filter(Boolean) });
          return;
        }
        if (request.call !== 'stream') { reply({ type: 'ai-error', message: 'Unknown mcode request.' }); return; }
        const control = new AbortController();
        terminalAi.set(request.id, control);
        try {
          const text = await A.ai.stream(request.messages || [], all => reply({ type: 'ai-delta', text: all }), control.signal, request.options || {});
          reply({ type: 'ai-done', text });
        } finally { terminalAi.delete(request.id); }
      } catch (error) { reply({ type: 'ai-error', message: String(error?.message || error).slice(0, 200) }); }
    }
    function ensureApp(id, app) {
      if (slots.has(id)) return slots.get(id);
      const window = document.createElement('section');
      window.className = 'cd-window';
      window.dataset.window = id;
      window.setAttribute('aria-label', app[1]);
      window.innerHTML = `<header class="cd-title"><span></span><div>
        <button type="button" data-action="minimize" title="Minimize" aria-label="Minimize">−</button>
        <button type="button" data-action="maximize" aria-pressed="false" title="Maximize" aria-label="Maximize">□</button>
        <button type="button" data-action="close" title="Close" aria-label="Close">×</button>
      </div></header><div class="cd-app-body"></div><button class="cd-resize" type="button" aria-label="Resize window with arrow keys"></button>`;
      window.querySelector('.cd-title > span').textContent = app.join('  ');
      const slot = { app, window, body: window.querySelector('.cd-app-body'), order: 0 };
      slots.set(id, slot);
      windows.append(window);
      placeWindow(slot, id);
      if (id === 'terminal') {
        const frame = document.createElement('iframe');
        frame.title = 'Terminal Playground';
        frame.setAttribute('sandbox', 'allow-scripts');
        frame.addEventListener('load', () => {
          if (slots.get(id) !== slot) return;
          const channel = new MessageChannel();
          terminalPort = channel.port1;
          terminalPort.onmessage = ({ data }) => {
            if (terminalPort !== channel.port1) return;
            if (data?.type === 'ready') {
              terminalReady = true;
              applyAppearance();
              terminalPort.postMessage({ type: 'tutorial', enabled: tutorial });
              for (const message of terminalQueue.splice(0)) terminalPort.postMessage(message);
            } else if (data?.type === 'activate') {
              if (!desktop.hidden && !slot.window.hidden) markActive('terminal');
            } else if (data?.type === 'ai') {
              void bridgeTerminalAi(data, channel.port1);
            } else if (data?.type === 'ai-abort') {
              terminalAi.get(data.id)?.abort();
            } else if (typeof data?.key === 'string' && store(data.key) && typeof data.value === 'string') {
              try {
                if (data.value.length > 3000000) throw new Error('Guest storage limit exceeded.');
                if (live) {
                  const bytes = liveTerminalBytes - (liveTerminalSaves.get(data.key)?.length || 0) + data.value.length;
                  if (bytes > 5000000) throw new Error('Guest storage limit exceeded.');
                  liveTerminalSaves.set(data.key, data.value);
                  liveTerminalBytes = bytes;
                } else localStorage.setItem(diskKey + data.key, data.value);
              }
              catch (error) { terminalPort.postMessage({ type: 'storage-error' }); }
            }
          };
          frame.contentWindow.postMessage({ type: 'cyber-desktop-terminal', saves: live ? [...liveTerminalSaves] : getSaves(), live }, '*', [channel.port2]);
        }, { once: true });
        frame.src = '/web/cyber-desktop-terminal.html';
        slot.body.append(frame);
      }
      return slot;
    }
    function openApp(id, refresh = false, remotePC) {
      const app = slots.get(id)?.app || (remotePC ? ['▣', remotePC.hostname] : Object.hasOwn(apps, id) && apps[id]);
      if (!app) return;
      closeMenus();
      const slot = ensureApp(id, app);
      slot.window.hidden = false;
      markActive(id);
      if (id === 'browser') dockBrowser();
      else if (remotePC && !slot.body.hasChildNodes()) remote.desktop(slot.body, remotePC);
      else if (id === 'remote' && !slot.body.hasChildNodes()) remote.directory(slot.body);
      else if (id !== 'terminal' && (refresh || !slot.body.hasChildNodes() || id === 'incidents' || id === 'settings')) renderApp(id, slot.body);
      slot.window.querySelector('[data-action="minimize"]').focus();
    }
    function toggleMaximize(slot) {
      const maximized = slot.window.classList.toggle('cd-maximized');
      const button = slot.window.querySelector('[data-action="maximize"]');
      button.setAttribute('aria-pressed', String(maximized));
      button.setAttribute('aria-label', maximized ? 'Restore window' : 'Maximize');
      button.title = maximized ? 'Restore window' : 'Maximize';
      button.textContent = maximized ? '❐' : '□';
    }
    function dismissWindow(id, close) {
      const slot = slots.get(id);
      if (id === 'browser') undockBrowser();
      if (close) {
        if (id === 'terminal') {
          terminalPort?.close();
          terminalPort = null;
          terminalReady = false;
          terminalQueue.length = 0;
        }
        slot.window.remove();
        slots.delete(id);
      } else slot.window.hidden = true;
      const front = nextWindow();
      markActive(front?.window.dataset.window || '');
      focusApp(id);
    }
    function focusApp(id) {
      (host.querySelector('.cd-dock [data-app="' + id + '"]') || $('[data-action="applications"]')).focus();
    }
    function openTerminalWith(message) {
      openApp('terminal');
      if (terminalReady) terminalPort.postMessage(message);
      else terminalQueue.push(message);
    }

    function saveNotes(value) {
      notes = value;
      if (!live) write('notes', value);
      const field = $('#cd-note');
      if (field && field.value !== value) field.value = value;
    }
    function showEvidence(id) {
      selectedCase = id;
      caseEgg = false;
      openApp('tools', true);
    }
    function renderMenuTools(query) {
      const words = query.trim().toLowerCase().split(/\s+/).filter(Boolean);
      const matches = value => words.every(word => value.toLowerCase().includes(word));
      for (const button of applications.querySelectorAll('[data-app]')) button.hidden = !matches(apps[button.dataset.app][1]);
      $('.cd-app-menu-tools').innerHTML = collections.map(({ name, exercise, tools }) => {
        const found = tools.filter(tool => matches(name + ' ' + tool));
        return found.length ? `<details ${words.length ? 'open' : ''}><summary>${name} <small>${found.length}</small></summary>
          <div>${found.map(tool => Object.hasOwn(shellTools, tool)
            ? `<button type="button" data-terminal-shell="${shellTools[tool]}" title="Open the simulated terminal">${tool} <span aria-hidden="true">›_</span></button>`
            : `<button type="button" data-case="${exercise}" title="Open recorded evidence for ${name}">${tool}</button>`).join('')}</div></details>` : '';
      }).join('') || '<p>No matching tools.</p>';
    }
    function applyWallpaper(value) {
      wallpaperRequest++;
      theme = value;
      if (!live) write('wallpaper', theme);
      applyAppearance();
    }
    async function importWallpaper(input) {
      const file = input.files[0];
      if (!file) return;
      const currentSession = sessionVersion;
      const currentRequest = ++wallpaperRequest;
      const status = $('[data-wallpaper-status]');
      let bitmap;
      try {
        if (!['image/png', 'image/jpeg', 'image/webp'].includes(file.type) || file.size > 24 * 1024 * 1024) {
          throw new Error('Choose a PNG, JPEG, or WebP image under 24 MB.');
        }
        status.textContent = 'Preparing wallpaper…';
        bitmap = await createImageBitmap(file);
        if (currentSession !== sessionVersion || currentRequest !== wallpaperRequest) return;
        const canvas = document.createElement('canvas');
        const scale = Math.min(1, 1920 / Math.max(bitmap.width, bitmap.height));
        canvas.width = Math.max(1, Math.round(bitmap.width * scale));
        canvas.height = Math.max(1, Math.round(bitmap.height * scale));
        const context = canvas.getContext('2d');
        context.fillStyle = '#101827';
        context.fillRect(0, 0, canvas.width, canvas.height);
        context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
        customWallpaper = canvas.toDataURL('image/jpeg', .8);
        if (!live) write('custom_wallpaper', customWallpaper);
        applyWallpaper('custom');
        const activeSettings = slots.get('settings');
        if (activeSettings) {
          renderApp('settings', activeSettings.body);
          $('[data-wallpaper-status]').textContent = !live && read('custom_wallpaper') !== customWallpaper
            ? 'Wallpaper applied for this session. Local storage is full or unavailable.'
            : 'Wallpaper imported.';
          if (active === 'settings') $('[data-wallpaper="custom"]').focus();
        }
      } catch (error) {
        if (currentSession === sessionVersion && currentRequest === wallpaperRequest) status.textContent = error.message || 'Could not read this image.';
      } finally {
        bitmap?.close();
        input.value = '';
      }
    }
    function renderApp(id, body) {
      if (id === 'settings') {
        body.innerHTML = `<div class="cd-content"><h2>Desktop interface</h2><div class="cd-case-grid">${interfaces.map(([value, name, summary]) =>
          `<button type="button" data-interface-choice="${value}" aria-pressed="${value === interfaceMode}"><b>${name}</b><small>${summary}</small></button>`).join('')}</div>
          <h2>Wallpaper</h2><div class="cd-wallpapers">${(customWallpaper ? [...themes, ['custom', 'Imported']] : themes).map(([value, name]) =>
          `<button type="button" data-wallpaper="${value}" aria-pressed="${value === theme}"><span data-theme="${value}"></span>${name}</button>`).join('')}</div>
          <label>Import an image <input type="file" data-wallpaper-file accept="image/png,image/jpeg,image/webp"></label><p data-wallpaper-status role="status"></p>
          <h2>Lab profile</h2><p>Choose the cases displayed in Security Labs.</p>
          <label>Case collection<select data-profile>${Object.entries(profiles).map(([value, [name]]) =>
            `<option value="${value}" ${value === profile ? 'selected' : ''}>${name}</option>`).join('')}</select></label>
          <h2>Beginner help</h2><label><input type="checkbox" data-tutorial-setting ${tutorial ? 'checked' : ''}> Tutorial mode</label>
          <p>Show short, step-by-step instructions while exploring the terminal and labs.</p><button type="button" data-app="tutorial">Open walkthroughs</button>
          <h2>System</h2><dl><dt>Session</dt><dd>${live ? 'Live USB · temporary' : 'Virtual disk · saved locally'}</dd><dt>Platform</dt><dd>Browser simulation</dd></dl></div>`;
      } else if (id === 'notes') {
        body.innerHTML = '<div class="cd-content cd-notes"><label for="cd-note">Investigation notes</label><textarea id="cd-note" spellcheck="true" maxlength="100000" placeholder="Record findings and next steps…"></textarea><p>' +
          (live ? 'Notes clear on reboot in live mode.' : 'Notes save locally as you type.') + '</p></div>';
        body.querySelector('textarea').value = notes;
      } else if (id === 'files') {
        body.innerHTML = '<div class="cd-content"><h2>Evidence library</h2><p>Open a bundled artifact to review it or copy it into Bash.</p><div class="cd-case-grid">' +
          cases.map(([key, , title]) => `<button type="button" data-case="${key}"><i aria-hidden="true">▤</i><b>${key}.txt</b><small>${title}</small></button>`).join('') + '</div></div>';
      } else if (id === 'tools') {
        renderTools(body);
      } else if (id === 'local') {
        renderBrowser(body);
      } else if (id === 'guide') {
        body.innerHTML = `<div class="cd-content"><h2>Desktop Guide</h2>
          <div class="cd-guide-grid">${guide.map(([title, explanation, target, label]) =>
            `<section><h3>${title}</h3><p>${explanation}</p><button type="button" data-app="${target}">${label} →</button></section>`).join('')}</div></div>`;
      } else if (id === 'catalog') {
        body.innerHTML = `<div class="cd-content"><h2>Kali Tools</h2><p>Explore Kali tool families through guest evidence exercises. The Evidence Utilities app processes files and text locally.</p>
          <button type="button" data-app="utility">Open Evidence Utilities</button><div class="cd-case-grid">${collections.map(({ name, exercise, tools }) =>
            `<button type="button" data-case="${exercise}"><b>${name}</b><small>${tools.join(' · ')}</small></button>`).join('')}</div></div>`;
      } else if (id === 'incidents') {
        const completed = incidentCases.filter(key => results.has(key)).length;
        body.innerHTML = `<div class="cd-content"><h2>Incident Desk</h2><p>Follow the FIN-12 investigation from the first mailbox report through recovery.</p>
          <div class="cd-incident-progress"><progress max="${incidentCases.length}" value="${completed}" aria-label="Incident phases completed"></progress><span>${completed} of ${incidentCases.length} phases completed</span></div>
          <div class="cd-case-grid">${incidentCases.map((key, index) => {
            const [, , title] = cases.find(row => row[0] === key);
            return `<button type="button" data-case="${key}"><i aria-hidden="true">${results.has(key) ? '✓' : '0' + (index + 1)}</i><b>${title}</b><small>${results.has(key) ? 'Completed' : 'Review evidence'}</small></button>`;
          }).join('')}</div>
          <section class="cd-incident-brief"><h3>Case brief</h3><p>Review the original mailbox report, compare it with the remote sign-in activity, and check which endpoints match the recorded file digest. Separate the evidence you can verify from open questions in the handoff.</p></section>
          <button type="button" data-app="notes">Open investigation notes</button></div>`;
      } else if (id === 'utility') {
        const [, description] = utilities[selectedUtility];
        body.innerHTML = `<div class="cd-content cd-case"><h2>Evidence Utilities</h2>
          <form class="cd-utility" data-utility-form><label>Utility <select data-utility-select>${Object.entries(utilities).map(([key, [label]]) =>
            `<option value="${key}" ${selectedUtility === key ? 'selected' : ''}>${label}</option>`).join('')}</select></label>
          <p>${description}</p><label>Input text <textarea name="text" maxlength="1000000" rows="5" spellcheck="false"></textarea></label>
          ${selectedUtility === 'digest' ? '<label>Or select a file <input type="file" name="evidence"></label>' : ''}
          <button type="submit" class="cd-primary">Analyze</button><pre data-utility-result role="status">Results appear here.</pre>
          <button type="button" data-action="utility-note" hidden>Add result to Notes</button></form></div>`;
      } else if (id === 'tutorial') {
        const [label, target, instructions] = lessons[lesson];
        body.innerHTML = `<div class="cd-content cd-tutorial"><h2>Walkthroughs</h2><label>What would you like to do?
          <select data-lesson>${lessons.map(([name], index) => `<option value="${index}" ${index === lesson ? 'selected' : ''}>${name}</option>`).join('')}</select></label>
          <section class="cd-incident-brief"><h3>${label}</h3><p>${instructions[step]}</p></section>
          <div class="cd-case-nav"><button type="button" data-action="previous-step" ${step === 0 ? 'disabled' : ''}>Previous</button>
            <span>Step ${step + 1} of ${instructions.length}</span><button type="button" data-action="next-step" ${step === instructions.length - 1 ? 'disabled' : ''}>Next</button></div>
          <button type="button" data-app="${target}">Open ${apps[target][1]}</button></div>`;
      }
    }
    function renderTools(body) {
      const item = cases.find(row => row[0] === selectedCase);
      if (!item) {
        const visible = cases.filter(([key]) => profiles[profile][1].includes(key));
        body.innerHTML = `<div class="cd-content"><h2>Security Labs</h2><p>Review offline evidence and record findings. ${visible.filter(([key]) => results.has(key)).length} of ${visible.length} completed.</p>
          <input type="search" data-lab-filter aria-label="Filter security labs" placeholder="Filter by title or category">
          <div class="cd-case-grid">${visible.map(([key, category, title]) =>
          `<button type="button" data-case="${key}"><i aria-hidden="true">${results.has(key) ? '✓' : '◇'}</i><b>${category}</b><small>${title}</small></button>`).join('')}</div></div>`;
        body.querySelector('[data-lab-filter]').value = labQuery;
        filterLabs(body);
        return;
      }
      const [key, category, title, evidence, question, options] = item;
      const phase = incidentCases.indexOf(key);
      const next = phase >= 0 ? incidentCases[phase + 1] : null;
      body.innerHTML = `<div class="cd-content cd-case"><div class="cd-case-nav"><button type="button" data-action="case-list">← All labs</button>
        ${phase >= 0 ? '<button type="button" data-app="incidents">Incident Desk</button>' : ''}</div><p>${category}</p><h2>${title}</h2>
        ${tutorial ? '<aside class="cd-tutorial-tip"><b>Tutorial</b><p>Read the dated lines first. Look for what changed. Pick the response that best fits what you can see, then click Check answer.</p></aside>' : ''}
        <pre></pre><button type="button" data-action="copy-evidence">Copy evidence to Bash</button>
        <form data-assessment><fieldset><legend>${question}</legend>${options.map((option, index) =>
          `<label><input type="radio" name="answer" value="${index}" required> ${option}</label>`).join('')}</fieldset>
          <button class="cd-primary" type="submit">Check answer</button>
          <p role="status" data-assessment-result>${results.has(key) ? 'Case completed.' : ''}</p>
        </form><div class="cd-case-nav"><button type="button" data-action="record" ${results.has(key) ? '' : 'hidden'}>Add finding to Notes</button>
        ${next ? `<button type="button" data-case="${next}" data-next-phase ${results.has(key) ? '' : 'hidden'}>Next incident phase →</button>` : ''}</div>
        <details data-case-relay><summary>Artifact metadata</summary><p>Bundled training record · offline</p>
          ${results.has(key) ? '<p>mcode is locked. This case is complete.</p>' : '<button type="button" data-action="case-egg">Open support relay</button><p data-case-hint role="status"></p>'}</details></div>`;
      body.querySelector('pre').textContent = evidence;
    }
    function filterLabs(body) {
      const query = labQuery.trim().toLowerCase();
      for (const option of body.querySelectorAll('[data-case]')) option.hidden = !option.textContent.toLowerCase().includes(query);
    }
    const browserPages = {
      home: ['Guest home', 'Open a local page for help with the terminal, boot modes, or evidence review.'],
      terminal: ['Terminal guide', 'Open Terminal from the dock. Use Sandbox for free play and practice jobs, Puzzles for generated and custom puzzles, and Labyrinth for connected rooms. The Help panel documents the active shell.'],
      boot: ['Boot and storage', 'Virtual disk mode saves guest progress in this browser profile. Live USB mode starts fresh and discards its workspace when the guest restarts.'],
      evidence: ['Evidence review', 'Open Security Labs to review bundled cases. Copy an artifact into Bash for command-line analysis. Completed findings can be added to Notes.']
    };
    function renderBrowser(body) {
      const page = browserHistory[browserIndex];
      const [title, description] = browserPages[page] || [];
      body.innerHTML = `<div class="cd-browser-bar"><button type="button" data-action="browser-back" aria-label="Back" ${browserIndex <= 0 ? 'disabled' : ''}>←</button>
        <button type="button" data-action="browser-forward" aria-label="Forward" ${browserIndex >= browserHistory.length - 1 ? 'disabled' : ''}>→</button>
        <button type="button" data-page="home" aria-label="Home">⌂</button>
        <form data-browser-search><input aria-label="Search guest pages" name="query" placeholder="Search guest pages" autocomplete="off"><button type="submit">Go</button></form></div>
        <div class="cd-content"><h2></h2><p data-browser-description></p><div class="cd-case-grid"></div></div>`;
      body.querySelector('h2').textContent = title || 'Search results';
      body.querySelector('[data-browser-description]').textContent = description || 'Guest pages matching “' + page.query + '”';
      const matching = Object.entries(browserPages).filter(([key, details]) =>
        key !== 'home' && (!page.query || details.join(' ').toLowerCase().includes(page.query.toLowerCase())));
      if (page === 'home' || page.query) {
        body.querySelector('.cd-case-grid').innerHTML = matching.length ? matching.map(([key, [label]]) =>
          `<button type="button" data-page="${key}"><i aria-hidden="true">◎</i><b>${label}</b></button>`).join('') : '<p>No matching pages.</p>';
      }
    }
    function openPage(page) {
      browserHistory.splice(browserIndex + 1, Infinity, page);
      browserIndex++;
      renderBrowser(slots.get('local').body);
    }
    function updateFullscreen() {
      const expanded = document.fullscreenElement === shell || shell.classList.contains('cd-expanded');
      fullscreenButton.textContent = expanded ? '↙ Exit fullscreen' : '⛶ Fullscreen';
      fullscreenButton.setAttribute('aria-pressed', String(expanded));
      shell.classList.toggle('cd-is-fullscreen', expanded);
    }
    async function toggleFullscreen() {
      if (document.fullscreenElement === shell) await document.exitFullscreen();
      else if (shell.classList.contains('cd-expanded')) shell.classList.remove('cd-expanded');
      else {
        try { await shell.requestFullscreen(); }
        catch (error) { shell.classList.add('cd-expanded'); }
      }
      updateFullscreen();
    }

    function click(event) {
      if (event.target.closest('#p-web')) return;
      const button = event.target.closest('button');
      if (!button) return;
      const data = button.dataset;
      const windowId = button.closest('.cd-window')?.dataset.window;
      const item = cases.find(row => row[0] === selectedCase);
      if (data.boot) {
        live = data.boot === 'live';
        currentSettings();
        signIn();
      } else if (data.app) {
        openApp(data.app);
      } else if (data.terminalShell) {
        openTerminalWith({ type: 'shell', shell: data.terminalShell });
      } else if (data.wallpaper) {
        applyWallpaper(data.wallpaper);
        $('[data-wallpaper-status]').textContent = '';
        for (const option of host.querySelectorAll('[data-wallpaper]')) option.setAttribute('aria-pressed', String(option === button));
      } else if (data.interfaceChoice) {
        interfaceMode = data.interfaceChoice;
        if (!live) write('interface', interfaceMode);
        applyAppearance();
        for (const option of host.querySelectorAll('[data-interface-choice]')) option.setAttribute('aria-pressed', String(option === button));
      } else if (data.case) {
        showEvidence(data.case);
      } else if (data.page) {
        openPage(data.page);
      } else {
        switch (data.action) {
          case 'fullscreen': toggleFullscreen(); break;
          case 'applications':
          case 'power-menu': {
            const menu = data.action === 'applications' ? applications : powerMenu;
            const open = menu.hidden;
            closeMenus();
            menu.hidden = !open;
            button.setAttribute('aria-expanded', String(open));
            if (open) menu.querySelector('input, button').focus();
            break;
          }
          case 'lock': closeMenus(); undockBrowser(); signIn(); break;
          case 'power':
          case 'restart': resetGuest(false); break;
          case 'shutdown': resetGuest(true); break;
          case 'minimize': dismissWindow(windowId, false); break;
          case 'close': dismissWindow(windowId, true); break;
          case 'maximize': markActive(windowId); toggleMaximize(slots.get(windowId)); break;
          case 'case-list':
            selectedCase = '';
            renderTools(slots.get('tools').body);
            break;
          case 'copy-evidence': {
            openTerminalWith({ type: 'evidence', name: item[0] + '.txt', text: item[3] });
            break;
          }
          case 'record':
            if (!results.has(item[0])) break;
            saveNotes([notes, item[2] + '\n' + item[7]].filter(Boolean).join('\n\n').slice(0, 100000));
            openApp('notes');
            break;
          case 'case-egg':
            caseEgg = !caseEgg;
            $('[data-case-hint]').textContent = caseEgg ? 'mcode · Read the first and last records. Which choice addresses the evidence directly?' : '';
            break;
          case 'previous-step':
          case 'next-step':
            step += data.action === 'next-step' ? 1 : -1;
            renderApp('tutorial', slots.get('tutorial').body);
            (slots.get('tutorial').body.querySelector('[data-action="' + data.action + '"]:not([disabled])') || $('[data-lesson]')).focus();
            break;
          case 'utility-note': {
            const result = $('[data-utility-result]').textContent;
            saveNotes([notes, utilities[selectedUtility][0] + '\n' + result].filter(Boolean).join('\n\n').slice(0, 100000));
            openApp('notes');
            break;
          }
          case 'browser-back': browserIndex--; renderBrowser(slots.get('local').body); break;
          case 'browser-forward': browserIndex++; renderBrowser(slots.get('local').body); break;
        }
      }
    }

    const events = new AbortController();
    const { signal } = events;
    const windowFor = target => slots.get(target?.closest('.cd-window')?.dataset.window);
    const raise = slot => { if (slot && !slot.window.hidden) markActive(slot.window.dataset.window); };
    const windowBounds = slot => {
      const area = windows.getBoundingClientRect(), box = slot.window.getBoundingClientRect();
      return { x: box.left - area.left, y: box.top - area.top, width: box.width, height: box.height };
    };
    function resizeWindow(slot, bounds, dx, dy) {
      const availableWidth = windows.clientWidth - bounds.x, availableHeight = windows.clientHeight - bounds.y;
      sizeWindow(slot, { ...bounds,
        width: Math.min(availableWidth, Math.max(Math.min(320, availableWidth), bounds.width + dx)),
        height: Math.min(availableHeight, Math.max(Math.min(220, availableHeight), bounds.height + dy))
      });
    }
    let gesture;
    windows.addEventListener('pointerdown', event => {
      const slot = windowFor(event.target);
      raise(slot);
      if (!slot || event.button !== 0 || slot.window.classList.contains('cd-maximized')) return;
      const resize = event.target.closest('.cd-resize');
      const handle = resize || (!event.target.closest('button') && event.target.closest('.cd-title'));
      if (!handle) return;
      gesture = { slot, resize, pointer: event.pointerId, x: event.clientX, y: event.clientY, bounds: windowBounds(slot) };
      handle.setPointerCapture(event.pointerId);
    }, { signal });
    windows.addEventListener('pointermove', event => {
      if (gesture?.pointer !== event.pointerId) return;
      const { slot, resize, bounds, x, y } = gesture;
      const dx = event.clientX - x, dy = event.clientY - y;
      if (resize) resizeWindow(slot, bounds, dx, dy);
      else sizeWindow(slot, { ...bounds, x: bounds.x + dx, y: bounds.y + dy });
    }, { signal });
    windows.addEventListener('lostpointercapture', () => { gesture = null; }, { signal });
    windows.addEventListener('dblclick', event => {
      if (!event.target.closest('button') && event.target.closest('.cd-title')) toggleMaximize(windowFor(event.target));
    }, { signal });
    windows.addEventListener('focusin', event => raise(windowFor(event.target)), { signal });
    window.addEventListener('blur', () => {
      requestAnimationFrame(() => {
        if (!desktop.hidden && host.isConnected) raise(windowFor(document.activeElement));
      });
    }, { signal });
    windows.addEventListener('keydown', event => {
      if (!event.target.matches('.cd-resize')) return;
      const steps = { ArrowLeft: [-16, 0], ArrowRight: [16, 0], ArrowUp: [0, -16], ArrowDown: [0, 16] };
      if (!Object.hasOwn(steps, event.key)) return;
      event.preventDefault();
      const slot = windowFor(event.target);
      resizeWindow(slot, windowBounds(slot), ...steps[event.key]);
    }, { signal });
    host.addEventListener('click', click, { signal });
    host.addEventListener('submit', async event => {
      if (event.target.closest('#p-web')) return;
      event.preventDefault();
      if (event.target === form) {
        if (form.elements.password.value !== 'Moundshroud') {
          $('[data-login-error]').hidden = false;
          form.elements.password.select();
          return;
        }
        form.reset();
        showStage(desktop);
        dockBrowser();
        $('[data-action="applications"]').focus();
      } else if (event.target.hasAttribute('data-assessment')) {
        const [key, , , , , , answer, finding] = cases.find(row => row[0] === selectedCase);
        const correct = event.target.elements.answer.value === String(answer);
        $('[data-assessment-result]').textContent = correct ? finding : 'Review the evidence and try again.';
        if (!correct) return;
        results.add(key);
        if (!live) write('results', JSON.stringify([...results]));
        caseEgg = false;
        const relay = $('[data-case-relay]');
        relay.querySelector('[data-action="case-egg"]')?.remove();
        const clue = relay.querySelector('[data-case-hint]');
        if (clue) clue.textContent = 'mcode is locked. This case is complete.';
        $('[data-action="record"]').hidden = false;
        const next = $('[data-next-phase]');
        if (next) next.hidden = false;
      } else if (event.target.hasAttribute('data-browser-search')) {
        const query = event.target.elements.query.value.trim();
        if (query) openPage({ query });
      } else if (event.target.hasAttribute('data-utility-form')) {
        const utilityForm = event.target;
        const output = utilityForm.querySelector('[data-utility-result]');
        const run = utilityForm.querySelector('[type="submit"]');
        const add = utilityForm.querySelector('[data-action="utility-note"]');
        const file = utilityForm.elements.evidence?.files[0];
        run.disabled = true;
        add.hidden = true;
        try {
          if (file?.size > 32 * 1024 * 1024) throw new Error('Select a file no larger than 32 MB.');
          output.textContent = await utilities[selectedUtility][2](utilityForm.elements.text.value, file);
          add.hidden = false;
        } catch (error) {
          output.textContent = error.message || 'Could not process this input.';
        } finally {
          run.disabled = false;
        }
      }
    }, { signal });
    host.addEventListener('change', event => {
      if (event.target.hasAttribute('data-profile')) {
        profile = event.target.value;
        if (!live) write('profile', profile);
      } else if (event.target.hasAttribute('data-wallpaper-file')) {
        importWallpaper(event.target);
      } else if (event.target.hasAttribute('data-utility-select')) {
        const texts = event.target.form.elements.text.value;
        selectedUtility = event.target.value;
        renderApp('utility', slots.get('utility').body);
        $('[data-utility-form] textarea').value = texts;
        $('[data-utility-select]').focus();
      } else if (event.target.hasAttribute('data-tutorial-setting')) {
        tutorial = event.target.checked;
        if (!live) write('tutorial', tutorial ? '1' : '0');
        if (terminalReady) terminalPort.postMessage({ type: 'tutorial', enabled: tutorial });
        const labs = slots.get('tools');
        if (labs) renderTools(labs.body);
        const launcher = slots.get('remote');
        if (launcher) remote.directory(launcher.body);
      } else if (event.target.hasAttribute('data-lesson')) {
        lesson = Number(event.target.value);
        step = 0;
        renderApp('tutorial', slots.get('tutorial').body);
        $('[data-lesson]').focus();
      }
    }, { signal });
    host.addEventListener('input', event => {
      if (event.target.id === 'cd-note') saveNotes(event.target.value);
      else if (event.target.hasAttribute('data-menu-filter')) renderMenuTools(event.target.value);
      else if (event.target.hasAttribute('data-lab-filter')) {
        labQuery = event.target.value;
        filterLabs(slots.get('tools').body);
      }
    }, { signal });
    host.addEventListener('keydown', event => {
      if (!event.target.matches('[data-boot]') || !['ArrowUp', 'ArrowDown'].includes(event.key)) return;
      event.preventDefault();
      const options = [...boot.querySelectorAll('[data-boot]')];
      const offset = event.key === 'ArrowUp' ? -1 : 1;
      options[(options.indexOf(event.target) + offset + options.length) % options.length].focus();
    }, { signal });
    document.addEventListener('fullscreenchange', updateFullscreen, { signal });
    document.addEventListener('keydown', event => {
      if (event.key !== 'Escape' || !host.contains(document.activeElement)) return;
      const focused = document.activeElement;
      const menuButton = applications.contains(focused) ? $('[data-action="applications"]')
        : powerMenu.contains(focused) ? $('[data-action="power-menu"]') : null;
      if (shell.classList.contains('cd-expanded')) {
        shell.classList.remove('cd-expanded');
        updateFullscreen();
        fullscreenButton.focus();
      } else if (menuButton) {
        menuButton.focus();
      }
      closeMenus();
    }, { signal });
    host._onHide = () => {
      clearInterval(timer);
      closeMenus();
      undockBrowser();
      shell.classList.remove('cd-expanded');
      if (document.fullscreenElement === shell) document.exitFullscreen().catch(() => {});
      updateFullscreen();
    };
    host._onShow = () => {
      if (desktop.hidden) return;
      startClock();
      dockBrowser();
    };
    const stopWatchingTabs = A.on?.('tab:hide', tab => { if (tab === 'cyber') host._onHide(); });
    host._cleanup = () => {
      host._onHide();
      resetGuest(false, false);
      stopWatchingTabs?.();
      events.abort();
    };
  }
  A.cyberDesktop = { mount };
})();

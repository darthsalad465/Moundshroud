// The opaque iframe gets only guest terminal saves over a private message port.
(() => {
  const scripts = [
    'cyber-crack', 'interp', 'terminal-unix', 'terminal-commands-shared', 'terminal-windows-commands', 'terminal-pc-profile', 'terminal-playground-data', 'terminal-playground-data2',
    'terminal-playground-data3', 'terminal-playground-curios', 'terminal-playground-jobs',
    'terminal-scenarios', 'terminal-sandbox-python', 'terminal-manual-content', 'terminal-manual-beginner',
    'terminal-hints', 'terminal-learn', 'terminal-manual-explain', 'terminal-manual', 'terminal-command-coach', 'terminal-labyrinth-data',
    'terminal-rewards', 'terminal-labyrinth-data2', 'terminal-labyrinth', 'terminal-puzzles',
    'terminal-pentest', 'terminal-remote',
    'mcode-custom', 'mcode-swarm', 'mcode-whip', 'terminal-playground-mcode', 'terminal-playground'
  ];
  const status = document.getElementById('cd-terminal-status');
  let toastTimer;
  let fullscreen;
  function exitTerminalFullscreen() {
    const previous = fullscreen;
    if (!previous) return;
    window.A.termFS.apply(previous.box, false, previous.button);
    previous.onExit?.();
  }
  const assetBase = '/web/cyber-guest/';
  /* A fresh stamp on every load, so an old cached copy of these modules can never run under the desktop
     (a stale script mixed with fresh ones leaves the terminal stuck on "Loading terminal…"). */
  const stamp = '?t=' + Date.now();
  /* mcode needs local models, and this page is an isolated frame that cannot reach /api. The desktop
     asks the model on this frame's behalf over the same private port that carries the terminal saves. */
  let modelPort = null;
  let modelSeq = 0;
  const modelCalls = new Map();
  function modelRequest(call, extra = {}) {
    return new Promise((resolve, reject) => {
      if (!modelPort) { reject(new Error('The desktop has not connected mcode to its model service.')); return; }
      const id = ++modelSeq;
      modelCalls.set(id, {
        resolve: value => { modelCalls.delete(id); resolve(value); },
        reject: error => { modelCalls.delete(id); reject(error); },
        onText: extra.onText
      });
      /* A slow answer is fine; an unreachable desktop is not. Only the quick lookups time out. */
      if (call !== 'stream') setTimeout(() => {
        const pending = modelCalls.get(id);
        if (!pending) return;
        modelPort.postMessage({ type: 'ai-abort', id });
        pending.reject(new Error('The desktop did not answer the model request. Reload the app window and try again.'));
      }, 20000);
      if (extra.signal) {
        if (extra.signal.aborted) { modelCalls.get(id).reject(new Error('aborted')); return; }
        extra.signal.addEventListener('abort', () => {
          if (!modelCalls.has(id)) return;
          modelCalls.get(id).reject(new Error('aborted'));
          modelPort.postMessage({ type: 'ai-abort', id });
        }, { once: true });
      }
      modelPort.postMessage({ type: 'ai', id, call, messages: extra.messages, options: extra.options });
    });
  }
  window.A = {
    ai: {
      isCloud: name => /(?:^free-|^claude-|(?:^|[-:])cloud$|embed)/i.test(String(name || '')),
      localModel: () => modelRequest('model'),
      models: () => modelRequest('models'),
      catalog: async () => ({ models: (await modelRequest('models')).map(name => ({ name, size: 0 })), hardware: null }),
      stream: (messages, onText, signal, options) => modelRequest('stream', { messages, options, signal, onText })
    },
    interpreterAssets: new URL(assetBase + 'vendor/', location.href).href,
    toast(message) {
      status.textContent = message;
      status.hidden = false;
      clearTimeout(toastTimer);
      toastTimer = setTimeout(() => { status.hidden = true; }, 2800);
    },
    termFS: {
      apply(box, on, button, onExit) {
        box.classList.toggle('term-fs', on);
        button.textContent = on ? 'Exit fullscreen' : '⛶ Fullscreen';
        button.setAttribute('aria-pressed', String(on));
        fullscreen = on ? { box, button, onExit } : null;
      },
      exit: exitTerminalFullscreen
    }
  };
  document.addEventListener('keydown', event => {
    if (event.key === 'Escape' && fullscreen && !document.querySelector('.tpg-manual[open]')) {
      event.preventDefault();
      exitTerminalFullscreen();
    }
  });

  window.addEventListener('message', function initialize(event) {
    if (event.source !== window.parent || event.data?.type !== 'cyber-desktop-terminal' || !event.ports[0]) return;
    window.removeEventListener('message', initialize);
    const port = event.ports[0];
    modelPort = port;
    const saves = new Map(event.data.saves);
    const live = event.data.live;
    Object.defineProperty(window, 'localStorage', { value: {
      getItem: key => saves.get(String(key)) ?? null,
      setItem(key, value) {
        key = String(key);
        value = String(value);
        saves.set(key, value);
        port.postMessage({ key, value });
      }
    } });
    window.ls = { get: (key, fallback) => localStorage.getItem(key) ?? fallback, set: (key, value) => localStorage.setItem(key, value) };
    let failed = false;
    for (const name of scripts) {
      const script = document.createElement('script');
      script.src = assetBase + 'js/' + name + '.js' + stamp;
      script.async = false;
      script.onerror = () => {
        failed = true;
        status.textContent = 'Could not load ' + name + '. Restart the guest to retry.';
      };
      if (name === 'terminal-playground') script.onload = () => {
        if (failed) return;
        try {
          const terminal = document.getElementById('cd-terminal');
          const tutorial = document.getElementById('cd-terminal-tutorial');
          window.A.play.games.terminal_playground.mount(terminal, { temporary: live });
          status.hidden = true;
          function updateTutorial() {
            const mode = terminal.querySelector('[data-mode].on')?.dataset.mode;
            tutorial.querySelector('p').textContent = mode === 'puzzle'
              ? 'Read the puzzle brief. Click a command example to put it at the prompt. Press Enter to run it. Type hint when you need a nudge.'
              : mode === 'lab'
                ? 'Read the room’s objective. Look around with the listed commands, then type solve followed by the answer you found.'
                : 'Click the command box, type help, and press Enter. In Bash, try pwd to see where you are, then ls to see what is there.';
          }
          terminal.addEventListener('click', event => {
            if (event.target.closest('[data-mode]')) queueMicrotask(updateTutorial);
          });
          document.addEventListener('pointerdown', () => port.postMessage({ type: 'activate' }));
          /* Tabbing or clicking into the terminal puts the caret at the prompt, as in a real terminal. */
          window.addEventListener('focus', () => {
            if (!terminal.contains(document.activeElement) || document.activeElement === document.body) terminal.querySelector('#tpgin')?.focus();
          });
          /* Clicking anywhere in the terminal puts the caret at the prompt. Controls keep their own clicks. */
          terminal.addEventListener('pointerdown', event => {
            if (event.target.closest('button, a, input, textarea, select, summary, details, label')) return;
            terminal.querySelector('#tpgin')?.focus();
          });
          function selectShell(name) {
            terminal.querySelector('[data-mode="sandbox"]:not(.on)')?.click();
            terminal.querySelector('[data-shell="' + name + '"]')?.click();
            terminal.querySelector('#tpgin')?.focus();
          }
          port.onmessage = ({ data }) => {
            if (data?.type === 'ai-delta' || data?.type === 'ai-value' || data?.type === 'ai-done' || data?.type === 'ai-error') {
              const call = modelCalls.get(data.id);
              if (!call) return;
              if (data.type === 'ai-delta') { call.onText?.(data.text); return; }
              if (data.type === 'ai-error') call.reject(new Error(data.message || 'The model request failed.'));
              else call.resolve(data.type === 'ai-done' ? (data.text || '') : data.value);
              return;
            }
            if (data?.type === 'appearance' && ['studio', 'operator', 'workstation'].includes(data.interface)) {
              document.body.dataset.interface = data.interface;
              return;
            }
            if (data?.type === 'tutorial') {
              tutorial.hidden = data.enabled !== true;
              updateTutorial();
              return;
            }
            if (data?.type === 'storage-error') {
              window.A.toast('The virtual disk is full or unavailable.');
              return;
            }
            if (data?.type === 'libraries' && Array.isArray(data.books)) {
              /* the offline libraries this browser holds become targets for the pentest range */
              window.TerminalPlayground?.setPentestLibraries?.(data.books);
              return;
            }
            if (data?.type === 'shell' && ['bash', 'network', 'powershell', 'sql'].includes(data.shell)) {
              selectShell(data.shell);
              return;
            }
            if (data?.type !== 'evidence' || !/^[a-z-]+\.txt$/.test(data.name) || typeof data.text !== 'string') return;
            selectShell('bash');
            const bash = window.TerminalPlayground.shells.find(shell => shell.id === 'bash');
            const workspace = bash?.workspace?.() || bash;
            const path = workspace?.importFile?.(data.name, data.text);
            if (path) bash.saveWorkspace?.();
            window.A.toast(path ? 'Evidence copied to ' + path : 'Open the Bash sandbox to copy evidence.');
          };
          port.postMessage({ type: 'ready' });
        } catch (error) {
          status.hidden = false;
          status.textContent = 'Terminal could not start. ' + error.message;
        }
      };
      document.head.append(script);
    }
  });
})();

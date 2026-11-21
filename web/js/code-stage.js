// The Screen: one reusable, sandboxed place to watch and play what code draws.
// A page shown here may run its own scripts (so canvas, DOM and games work) but it has an opaque origin, no network
// (the Playground CSP blocks every request), no popups, no top navigation and no access to Moundshroud or this PC's files.
// Used by Cyber > Coding > Code playground (HTML, JavaScript page mode and pictures) and by the safe terminal.
(() => {
  'use strict';
  const PL = window.PlayLangs;
  /* allow-scripts lets the program run; deliberately no allow-same-origin, allow-popups, allow-top-navigation or allow-forms */
  const SANDBOX = 'allow-scripts allow-modals allow-pointer-lock';
  /* runs inside the frame: console messages and errors are posted to the page that mounted the screen */
  const RUNTIME = '(function(){' +
    'var send=function(kind,text){try{parent.postMessage({msStage:kind,text:String(text).slice(0,4000)},\'*\')}catch(e){}};' +
    'var hook=function(kind){var original=console[kind]?console[kind].bind(console):function(){};' +
    'console[kind]=function(){var parts=[];for(var i=0;i<arguments.length;i++){var v=arguments[i];try{parts.push(typeof v===\'string\'?v:JSON.stringify(v))}catch(e){parts.push(String(v))}}' +
    'send(kind,parts.join(\' \'));return original.apply(console,arguments)};};' +
    '[\'log\',\'info\',\'warn\',\'error\'].forEach(hook);' +
    'window.addEventListener(\'error\',function(e){send(\'error\',(e.message||\'Script error\')+(e.lineno?\' (line \'+e.lineno+\')\':\'\'))});' +
    'window.addEventListener(\'unhandledrejection\',function(e){send(\'error\',\'Unhandled promise rejection: \'+((e.reason&&e.reason.message)||e.reason||\'unknown\'))});' +
    '})();';
  const esc = value => String(value == null ? '' : value).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  let serial = 0, styled = false;

  function styles() {
    if (styled) return;
    styled = true;
    const style = document.createElement('style');
    style.id = 'code-stage-css';
    style.textContent = [
      '.cs-wrap{border:1px solid var(--line);border-radius:10px;background:var(--panel2);overflow:hidden}',
      '.cs-bar{display:flex;gap:8px;align-items:center;padding:5px 8px;border-bottom:1px solid var(--line);font-size:12px;min-height:28px}',
      '.cs-title{font-weight:600;white-space:nowrap}',
      '.cs-hint{color:var(--mute);font-size:11.5px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}',
      '.cs-btn{border:1px solid var(--line);background:var(--panel);color:var(--text);border-radius:6px;padding:2px 8px;font-size:11.5px;cursor:pointer;white-space:nowrap}',
      '.cs-btn:hover{border-color:var(--acc);color:var(--acc)}',
      '.cs-frame-wrap{position:relative;height:var(--cs-h,320px);background:#fff}',
      '.cs-frame{width:100%;height:100%;border:0;display:block;background:#fff}',
      '.cs-empty{position:absolute;inset:0;display:flex;align-items:center;justify-content:center;background:var(--panel);color:var(--mute);font-size:13px;padding:20px;text-align:center;line-height:1.5}',
      '.cs-empty[hidden]{display:none}',
      '.cs-log{max-height:110px;overflow:auto;font:12px/1.45 Consolas,"Cascadia Mono",monospace;padding:6px 8px;border-top:1px solid var(--line);white-space:pre-wrap;color:#ffd9a8;background:#161008}',
      '.cs-log[hidden]{display:none}',
      '.cs-wrap:fullscreen{border:0;border-radius:0;background:#000;display:flex;flex-direction:column;width:100vw;height:100vh}',
      '.cs-wrap:fullscreen .cs-bar{background:#0b0d14;color:#e9eefb;border-color:#232b3d}',
      '.cs-wrap:fullscreen .cs-frame-wrap{flex:1;height:auto}',
      '.cs-wrap:fullscreen .cs-btn{background:#182033;color:#e9eefb;border-color:#2b3550}',
      '.cs-wrap.cs-max{position:fixed;inset:0;z-index:9998;border:0;border-radius:0;background:#000;display:flex;flex-direction:column;width:100vw;height:100vh}',
      '.cs-wrap.cs-max .cs-bar{background:#0b0d14;color:#e9eefb;border-color:#232b3d}',
      '.cs-wrap.cs-max .cs-frame-wrap{flex:1;height:auto}',
    ].join('');
    document.head.appendChild(style);
  }

  /* build a full document: the Playground CSP (scripts allowed, every network request blocked) plus the console bridge */
  function doc(html, options) {
    const opts = options || {};
    let text = String(html == null ? '' : html);
    let out = PL && PL.previewDoc ? PL.previewDoc(text, opts.scripts !== false) : text;
    if (opts.console) {
      const tag = '<script>' + RUNTIME + '</script>';
      const meta = /<meta http-equiv="Content-Security-Policy"[^>]*>/i.exec(out);
      out = meta ? out.slice(0, meta.index + meta[0].length) + tag + out.slice(meta.index + meta[0].length) : tag + out;
    }
    return out;
  }

  /* turn a piece of JavaScript into a page: canvas, DOM, keyboard, requestAnimationFrame and games all work */
  function page(code) {
    const safe = String(code == null ? '' : code).replace(/<\/script/gi, '<\\/script');
    return doc('<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">' +
      '<style>html,body{margin:0;min-height:100%;background:#0b0d14;color:#e9eefb;font:15px/1.45 system-ui,sans-serif}canvas{display:block;max-width:100%}a{color:#8ec5ff}</style>' +
      '</head><body><script>' + safe + '</script></body></html>', { console: true });
  }

  /* picture output (matplotlib, turtle, pygame frames) as one page, so it can be seen big and full screen */
  function pictures(figs) {
    const list = (figs || []).filter(Boolean);
    return doc('<!doctype html><html><head><meta charset="utf-8"><style>body{margin:0;padding:12px;background:#11141c;display:flex;gap:12px;flex-wrap:wrap;justify-content:center;align-items:flex-start}' +
      'figure{margin:0;display:grid;gap:6px;justify-items:center}img{max-width:100%;height:auto;background:#fff;border-radius:8px}figcaption{font:12px system-ui,sans-serif;color:#9fb0c9}</style>' +
      '</head><body>' + list.map((b64, i) => '<figure><img src="data:image/png;base64,' + b64 + '" alt="Picture ' + (i + 1) + ' drawn by the program"><figcaption>Picture ' + (i + 1) + (list.length > 1 ? ' of ' + list.length : '') + '</figcaption></figure>').join('') +
      '</body></html>', { console: false });
  }

  function mount(host, options) {
    if (!host) return null;
    styles();
    const opts = options || {};
    const id = 'cs' + (++serial);
    host.innerHTML = '<div class="cs-wrap" data-cs="wrap">' +
      '<div class="cs-bar"><span class="cs-title">' + esc(opts.title || '🖥 Screen') + '</span>' +
      (opts.hint === '' ? '' : '<span class="cs-hint">' + esc(opts.hint || 'Click the screen, then use its keys') + '</span>') +
      '<span style="flex:1"></span><button type="button" class="cs-btn" data-cs="full" title="Fill the window (Esc comes back)">⛶ Full screen</button></div>' +
      '<div class="cs-frame-wrap" style="--cs-h:' + Math.max(120, Number(opts.height) || 320) + 'px">' +
      '<iframe class="cs-frame" data-cs="frame" title="' + esc(opts.title || 'Program screen') + '" sandbox="' + esc(opts.sandbox || SANDBOX) + '" allow="fullscreen; autoplay; gamepad" referrerpolicy="no-referrer"></iframe>' +
      '<div class="cs-empty" data-cs="empty">' + esc(opts.empty || 'Nothing is on the screen yet.') + '</div></div>' +
      '<div class="cs-log" data-cs="log" hidden></div></div>';
    const wrap = host.querySelector('[data-cs="wrap"]');
    const frame = wrap.querySelector('[data-cs="frame"]');
    const empty = wrap.querySelector('[data-cs="empty"]');
    const log = wrap.querySelector('[data-cs="log"]');
    const full = wrap.querySelector('[data-cs="full"]');
    const messages = [];
    let fallbackFull = false;

    function onMessage(event) {
      if (event.source !== frame.contentWindow || !event.data || !event.data.msStage) return;
      if (event.data.msStage === 'done') { if (opts.onDone) { try { opts.onDone(); } catch (e) { } } return; }
      const text = String(event.data.text == null ? '' : event.data.text);
      messages.push(text);
      log.hidden = false;
      log.textContent = messages.slice(-40).join('\n');
      log.scrollTop = log.scrollHeight;
      if (opts.onLog) { try { opts.onLog(text, event.data.msStage); } catch (e) { } }
    }
    function onKey(event) {
      /* Escape leaves the screen's full screen only: it must not also close the page underneath */
      if (event.key !== 'Escape') return;
      if (fallbackFull) { event.preventDefault(); event.stopPropagation(); fallbackFull = false; wrap.classList.remove('cs-max'); syncFull(); }
      else if (document.fullscreenElement === wrap) { event.preventDefault(); event.stopPropagation(); try { document.exitFullscreen(); } catch (e) { } }
    }
    function onFullChange() {
      /* the browser really went full screen: the CSS fallback is no longer needed */
      if (document.fullscreenElement === wrap) { fallbackFull = false; wrap.classList.remove('cs-max'); }
      syncFull();
    }
    function syncFull() {
      const on = fallbackFull || document.fullscreenElement === wrap;
      full.textContent = on ? '🗗 Exit full screen' : '⛶ Full screen';
      full.title = on ? 'Back to the page (Esc)' : 'Fill the window (Esc comes back)';
    }
    async function toggleFull() {
      if (fallbackFull) { fallbackFull = false; wrap.classList.remove('cs-max'); syncFull(); return; }
      if (document.fullscreenElement === wrap) { try { await document.exitFullscreen(); } catch (e) { } syncFull(); return; }
      try {
        if (!wrap.requestFullscreen) throw new Error('Full screen is not available');
        /* some windows (and browsers without a real full screen) never answer the request, so do not wait forever:
           if it has not happened shortly, fill the window with the built-in full-window mode instead */
        const done = await Promise.race([
          wrap.requestFullscreen().then(() => true, () => false),
          new Promise(resolve => setTimeout(() => resolve(false), 700)),
        ]);
        if (!done && document.fullscreenElement !== wrap) throw new Error('Full screen was refused');
      } catch (e) {
        fallbackFull = true; wrap.classList.add('cs-max');
      }
      syncFull();
    }
    function showDoc(fullDoc) {
      messages.length = 0; log.textContent = ''; log.hidden = true;
      empty.hidden = true;
      frame.srcdoc = String(fullDoc == null ? '' : fullDoc);
    }
    function show(html) { showDoc(doc(html, { console: true })); }
    function clear() {
      messages.length = 0; log.textContent = ''; log.hidden = true;
      frame.srcdoc = 'about:blank';
      empty.hidden = false;
    }
    function destroy() {
      window.removeEventListener('message', onMessage);
      document.removeEventListener('keydown', onKey, true);
      document.removeEventListener('fullscreenchange', onFullChange);
      if (document.fullscreenElement === wrap) { try { document.exitFullscreen(); } catch (e) { } }
      wrap.classList.remove('cs-max');
    }
    wrap.querySelector('[data-cs="full"]').addEventListener('click', toggleFull);
    wrap.addEventListener('click', event => { if (event.target.closest('button')) return; try { frame.focus(); } catch (e) { } });
    window.addEventListener('message', onMessage);
    document.addEventListener('keydown', onKey, true);
    document.addEventListener('fullscreenchange', onFullChange);
    syncFull();
    /* a message for the page inside the screen (the Stop button asks a Scratch script to stop) */
    function post(message) { try { frame.contentWindow.postMessage(message, '*'); } catch (e) { } }
    return { show, showDoc, clear, post, fullscreen: toggleFull, focus: () => { try { frame.focus(); } catch (e) { } }, destroy, element: wrap, id };
  }

  window.CodeStage = { mount, doc, page, pictures, RUNTIME, SANDBOX };
})();

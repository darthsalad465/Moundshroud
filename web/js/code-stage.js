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

  /* ---------- pictures: drawn output is something you use, not just look at ---------- */
  /* Every picture can be zoomed, panned and — when a program drew an animation, where each picture is a frame —
     played. The behaviour lives in this one script, which the picture page carries with it, so it works the same in
     the Screen, in the full-window viewer and in the safe terminal. */
  const PICTURE_CSS =
    'html,body{margin:0;height:100%;background:#11141c;color:#e9eefb;font:13px system-ui,sans-serif;overflow:hidden}' +
    '.pv{height:100%;display:flex;flex-direction:column}' +
    '.pv-bar{display:flex;align-items:center;gap:6px;padding:7px 10px;background:#0b0d14;border-bottom:1px solid #232b3d;flex:none;flex-wrap:wrap}' +
    '.pv-count{font-weight:600;color:#cfd9ee}' +
    '.pv-sp{flex:1}' +
    '.pv-bar button{border:1px solid #2b3550;background:#182033;color:#e9eefb;border-radius:7px;padding:4px 9px;font:12px/1.2 system-ui,sans-serif;cursor:pointer;min-height:28px}' +
    '.pv-bar button:hover{border-color:#4a5f8c;background:#1f2a42}' +
    '.pv-stage{flex:1;min-height:0;display:grid;place-items:center;overflow:hidden;touch-action:none;cursor:zoom-in;background:radial-gradient(circle at 50% 40%,#1b2230,#0b0d14 70%)}' +
    '.pv-stage.grabbing{cursor:grabbing}' +
    '.pv-stage img{max-width:100%;max-height:100%;background:#fff;border-radius:6px;transform-origin:center center;will-change:transform;user-select:none;-webkit-user-drag:none}' +
    '.pv-hint{flex:none;padding:5px 10px;color:#8b9bbd;font:11.5px/1.4 system-ui,sans-serif;background:#0b0d14;border-top:1px solid #232b3d;text-align:center}';

  /* the page's own script: zoom, pan, and a player for frames */
  function pictureScript(srcs) {
    var i = 0, zoom = 1, tx = 0, ty = 0, timer = null, drag = null;
    var stage = document.getElementById('pvstage'), img = document.getElementById('pvimg');
    var count = document.getElementById('pvcount'), play = document.getElementById('pvplay');
    function label() { if (count) count.textContent = 'Picture ' + (i + 1) + ' of ' + srcs.length; }
    function apply() { img.style.transform = 'translate(' + tx + 'px,' + ty + 'px) scale(' + zoom + ')'; stage.style.cursor = zoom > 1 ? 'grab' : 'zoom-in'; }
    function reset() { zoom = 1; tx = 0; ty = 0; apply(); }
    function show() { img.src = srcs[i]; label(); }
    function step(d) { if (srcs.length < 2) return; i = (i + d + srcs.length) % srcs.length; show(); }
    function stop() { if (!timer) return; clearInterval(timer); timer = null; if (play) play.textContent = '▶ Play'; }
    function toggle() {
      if (timer) { stop(); return; }
      if (srcs.length < 2 || !play) return;
      play.textContent = '❚❚ Stop';
      timer = setInterval(function () { step(1); }, 220);
    }
    function z(n) { zoom = Math.max(0.15, Math.min(12, n)); apply(); }
    stage.addEventListener('wheel', function (e) { e.preventDefault(); z(zoom * Math.exp(-e.deltaY * 0.0015)); }, { passive: false });
    stage.addEventListener('pointerdown', function (e) { drag = { x: e.clientX - tx, y: e.clientY - ty }; stage.classList.add('grabbing'); try { stage.setPointerCapture(e.pointerId); } catch (x) { } });
    stage.addEventListener('pointermove', function (e) { if (!drag) return; tx = e.clientX - drag.x; ty = e.clientY - drag.y; apply(); });
    function release() { drag = null; stage.classList.remove('grabbing'); }
    stage.addEventListener('pointerup', release);
    stage.addEventListener('pointercancel', release);
    stage.addEventListener('dblclick', reset);
    document.addEventListener('click', function (e) {
      var b = e.target && e.target.closest ? e.target.closest('[data-pv]') : null;
      if (!b) return;
      var a = b.getAttribute('data-pv');
      if (a === 'in') z(zoom * 1.25);
      else if (a === 'out') z(zoom / 1.25);
      else if (a === 'fit') reset();
      else if (a === 'next') { stop(); step(1); }
      else if (a === 'prev') { stop(); step(-1); }
      else if (a === 'play') toggle();
    });
    document.addEventListener('keydown', function (e) {
      if (e.key === '+' || e.key === '=') { z(zoom * 1.25); e.preventDefault(); }
      else if (e.key === '-') { z(zoom / 1.25); e.preventDefault(); }
      else if (e.key === '0') { reset(); e.preventDefault(); }
      else if (e.key === 'ArrowRight') { stop(); step(1); e.preventDefault(); }
      else if (e.key === 'ArrowLeft') { stop(); step(-1); e.preventDefault(); }
      else if (e.key === ' ') { toggle(); e.preventDefault(); }
    });
    window.addEventListener('resize', apply);
    label();
    apply();
  }

  /* picture output (matplotlib, turtle, pygame frames) as one interactive page */
  function pictures(figs) {
    const list = (figs || []).filter(b64 => typeof b64 === 'string' && /^[A-Za-z0-9+/]+={0,2}$/.test(b64));
    if (!list.length) return doc('<!doctype html><html><head><meta charset="utf-8"><style>' + PICTURE_CSS + '</style></head><body><div class="pv"><div class="pv-hint" style="margin:auto;border:0">The program drew nothing.</div></div></body></html>', { scripts: false });
    const srcs = list.map(b64 => 'data:image/png;base64,' + b64);
    const many = srcs.length > 1;
    return doc('<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><style>' + PICTURE_CSS + '</style></head><body>' +
      '<div class="pv"><div class="pv-bar">' +
        '<span class="pv-count" id="pvcount">Picture 1 of ' + srcs.length + '</span><span class="pv-sp"></span>' +
        (many ? '<button type="button" data-pv="prev" title="Previous frame (←)">◀</button>' +
          '<button type="button" data-pv="play" id="pvplay" title="Play the frames (Space)">▶ Play</button>' +
          '<button type="button" data-pv="next" title="Next frame (→)">▶</button>' : '') +
        '<button type="button" data-pv="out" title="Zoom out (−)">−</button>' +
        '<button type="button" data-pv="fit" title="Fit the window (0)">Fit</button>' +
        '<button type="button" data-pv="in" title="Zoom in (+)">＋</button>' +
      '</div>' +
      '<div class="pv-stage" id="pvstage"><img id="pvimg" alt="Picture drawn by the program" draggable="false" src="' + srcs[0] + '"></div>' +
      '<div class="pv-hint">Drag to move · wheel or ＋ − to zoom · double-click to fit' +
        (many ? ' · ▶ Play steps through the ' + srcs.length + ' frames it drew' : '') + '</div></div>' +
      '<script>(' + pictureScript.toString() + ')(' + JSON.stringify(srcs) + ');<' + '/script>' +
      '</body></html>', { scripts: true, console: false });
  }

  /* the same picture, filling the window, for the thumbnails under a run. Plain elements rather than another frame,
     so it opens at once and the keyboard belongs to the page behind it. */
  function viewer(figs, start) {
    const old = document.getElementById('cvOverlay');
    if (old) old.remove();
    const list = (figs || []).filter(b64 => typeof b64 === 'string' && /^[A-Za-z0-9+/]+={0,2}$/.test(b64));
    if (!list.length) return null;
    const srcs = list.map(b64 => 'data:image/png;base64,' + b64);
    const many = srcs.length > 1;
    let i = Math.max(0, Math.min(srcs.length - 1, Math.round(Number(start) || 0))), zoom = 1, tx = 0, ty = 0, timer = null, drag = null;
    const startLabel = 'Picture ' + (i + 1) + ' of ' + srcs.length;
    const btn = 'border:1px solid #2b3550;background:#182033;color:#e9eefb;border-radius:7px;padding:5px 10px;font:12px/1.2 system-ui,sans-serif;cursor:pointer;min-height:28px';
    const ov = document.createElement('div');
    ov.id = 'cvOverlay';
    ov.style.cssText = 'position:fixed;inset:0;z-index:9998;background:rgba(4,7,12,.94);display:flex;flex-direction:column;padding:10px;gap:6px';
    ov.innerHTML = '<div style="display:flex;align-items:center;gap:8px;padding:0 2px;color:#e9eefb;font:600 13px system-ui,sans-serif;flex-wrap:wrap">' +
      '<b>🖼 Pictures from your program</b>' +
      '<span id="cvCount" style="font-weight:400;color:#9fb0c9">' + startLabel + '</span>' +
      '<span style="flex:1"></span>' +
      (many ? '<button type="button" data-cv="prev" style="' + btn + '" title="Previous frame (left arrow)">◀</button>' +
        '<button type="button" data-cv="play" style="' + btn + '" title="Play the frames (space)">▶ Play</button>' +
        '<button type="button" data-cv="next" style="' + btn + '" title="Next frame (right arrow)">▶</button>' : '') +
      '<button type="button" data-cv="out" style="' + btn + '" title="Zoom out (−)">−</button>' +
      '<button type="button" data-cv="fit" style="' + btn + '" title="Fit (0)">Fit</button>' +
      '<button type="button" data-cv="in" style="' + btn + '" title="Zoom in (+)">＋</button>' +
      '<button type="button" data-cv="close" style="' + btn + '">✕ Close (Esc)</button></div>' +
      '<div id="cvStage" style="flex:1;min-height:0;display:grid;place-items:center;overflow:hidden;touch-action:none;border-radius:10px;background:radial-gradient(circle at 50% 40%,#1b2230,#0b0d14 70%)">' +
        '<img id="cvImg" draggable="false" alt="Picture drawn by the program" style="max-width:100%;max-height:100%;background:#fff;border-radius:6px;transform-origin:center center;will-change:transform;user-select:none">' +
      '</div>' +
      '<div style="flex:none;color:#8b9bbd;font:11.5px/1.4 system-ui,sans-serif;text-align:center">Drag to move · wheel or ＋ − to zoom · double-click to fit' +
      (many ? ' · ▶ Play steps through the ' + srcs.length + ' frames it drew' : '') + '</div>';
    const img = ov.querySelector('#cvImg'), stage = ov.querySelector('#cvStage'), count = ov.querySelector('#cvCount'), playBtn = ov.querySelector('[data-cv="play"]');
    function label() { if (count) count.textContent = 'Picture ' + (i + 1) + ' of ' + srcs.length; }
    function apply() { img.style.transform = 'translate(' + tx + 'px,' + ty + 'px) scale(' + zoom + ')'; stage.style.cursor = zoom > 1 ? 'grab' : 'zoom-in'; }
    function show() { img.src = srcs[i]; label(); }
    function reset() { zoom = 1; tx = 0; ty = 0; apply(); }
    function step(d) { if (srcs.length < 2) return; i = (i + d + srcs.length) % srcs.length; show(); }
    function stop() { if (!timer) return; clearInterval(timer); timer = null; if (playBtn) playBtn.textContent = '▶ Play'; }
    function toggle() {
      if (timer) { stop(); return; }
      if (srcs.length < 2 || !playBtn) return;
      playBtn.textContent = '❚❚ Stop';
      timer = setInterval(() => step(1), 220);
    }
    function zoomBy(n) { zoom = Math.max(0.15, Math.min(12, n)); apply(); }
    function close() {
      stop();
      document.removeEventListener('keydown', keys, true);
      if (ov.parentNode) ov.remove();
    }
    function keys(e) {
      if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); close(); }
      else if (e.key === '+' || e.key === '=') { zoomBy(zoom * 1.25); e.preventDefault(); }
      else if (e.key === '-') { zoomBy(zoom / 1.25); e.preventDefault(); }
      else if (e.key === '0') { reset(); e.preventDefault(); }
      else if (e.key === 'ArrowRight') { stop(); step(1); e.preventDefault(); }
      else if (e.key === 'ArrowLeft') { stop(); step(-1); e.preventDefault(); }
      else if (e.key === ' ') { toggle(); e.preventDefault(); }
    }
    stage.addEventListener('wheel', e => { e.preventDefault(); zoomBy(zoom * Math.exp(-e.deltaY * 0.0015)); }, { passive: false });
    stage.addEventListener('pointerdown', e => { drag = { x: e.clientX - tx, y: e.clientY - ty }; try { stage.setPointerCapture(e.pointerId); } catch (x) { } });
    stage.addEventListener('pointermove', e => { if (!drag) return; tx = e.clientX - drag.x; ty = e.clientY - drag.y; apply(); });
    const release = () => { drag = null; };
    stage.addEventListener('pointerup', release);
    stage.addEventListener('pointercancel', release);
    stage.addEventListener('dblclick', reset);
    ov.addEventListener('click', e => {
      const b = e.target.closest('[data-cv]');
      if (!b) { if (e.target === ov || e.target === stage) close(); return; }
      const a = b.getAttribute('data-cv');
      if (a === 'in') zoomBy(zoom * 1.25);
      else if (a === 'out') zoomBy(zoom / 1.25);
      else if (a === 'fit') reset();
      else if (a === 'next') { stop(); step(1); }
      else if (a === 'prev') { stop(); step(-1); }
      else if (a === 'play') toggle();
      else if (a === 'close') close();
    });
    document.addEventListener('keydown', keys, true);
    document.body.appendChild(ov);
    show(); apply();
    return { close, element: ov };
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
      const text = String(event.data.text == null ? '' : event.data.text).slice(0, 4000);
      /* a page can post as fast as it likes; keep only a bounded transcript so it cannot grow the app's memory */
      if (messages.length < 200) messages.push(text);
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

  window.CodeStage = { mount, doc, page, pictures, viewer, RUNTIME, SANDBOX };
})();

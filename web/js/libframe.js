// Offline library pages live on their own address (Moundshroud's port + 9), so their scripts cannot reach the app.
// This is the window's side of the link to them: it opens a page in a frame, hears what the page reports (through
// web/lib-bridge.js inside it), and sends it the few things the Browser tab needs. Only messages from that address,
// from that frame, are listened to.
//   A.libframe.attach(frame, { load, ready, scroll, hover, newtab, key, back, fwd, sel })  ->  the frame, with
//   frame.lf.css(text) .zoom(z) .restore(spot) .find(q, back) .clearFind() .print() .reload() .stop() .text() .snap()
//   A.libframe.src('/wiki/...')  ->  the full address to load;  A.libframe.isLib(url)  ->  is it a library page?
(() => {
  const port = (+location.port || 80) + 9;
  const origin = () => location.protocol === 'app:' ? 'app://moundshroud-lib' : (location.protocol + '//' + location.hostname + ':' + port);
  const isLib = u => /^\/wiki\//.test(String(u || '')) || String(u || '').startsWith(origin() + '/wiki/');
  const src = u => isLib(u) && String(u).startsWith('/') ? origin() + u : u;
  let seq = 0; const waiting = {};
  const frames = new Set();
  addEventListener('message', e => {
    if (e.origin !== origin()) return; const m = e.data || {}; if (!m.lf) return;
    let fr = null; for (const f of frames) if (f.isConnected && f.contentWindow === e.source) { fr = f; break; } if (!fr) return;
    if (m.ev === 'reply') { const w = waiting[m.id]; if (w) { delete waiting[m.id]; w(m.r); } return; }
    if (m.ev === 'scroll' || m.ev === 'ready') fr._snap = m.s || fr._snap;
    if (m.ev === 'load' || m.ev === 'ready') { fr._url = m.url; fr._title = m.title; }
    const h = fr._lfh || {}; try { h[m.ev] && h[m.ev](m); } catch (x) { }
    try { fr.dispatchEvent(new CustomEvent('lf' + m.ev, { detail: m })); } catch (x) { }
  });
  function post(fr, cmd, extra, wantReply) {
    return new Promise(res => {
      const w = fr && fr.contentWindow; if (!w) return res(null);
      const m = Object.assign({ lf: 1, cmd }, extra || {});
      if (wantReply) { const id = ++seq; m.id = id; waiting[id] = res; setTimeout(() => { if (waiting[id]) { delete waiting[id]; res(null); } }, 4000); } else res(true);
      try { w.postMessage(m, origin()); } catch (e) { res(null); }
    });
  }
  function attach(fr, handlers) {
    fr._lfh = handlers || {}; frames.add(fr);
    /* the page may run its own scripts, but it may not open pop-ups that run in the app or take over the window */
    fr.setAttribute('sandbox', 'allow-scripts allow-same-origin allow-popups allow-popups-to-escape-sandbox allow-forms');
    fr.setAttribute('referrerpolicy', 'no-referrer');
    fr.lf = {
      css: t => post(fr, 'css', { css: t }), zoom: z => post(fr, 'zoom', { z }), restore: s => post(fr, 'restore', { s }),
      find: (q, back) => post(fr, 'find', { q, back: !!back }, true), clearFind: () => post(fr, 'clearFind'), print: () => post(fr, 'print'),
      reload: () => post(fr, 'reload'), stop: () => post(fr, 'stop'), text: () => post(fr, 'text', null, true).then(t => t || ''), snap: () => post(fr, 'snap', null, true), focus: () => post(fr, 'focus'),
      go: u => { fr.src = src(u); }
    };
    return fr;
  }
  A.libframe = { attach, src, isLib, origin, port, frames };
})();

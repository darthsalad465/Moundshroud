// Coding › Playground worker: runs the built-in interpreters (esoteric languages, Scheme, Prolog, Forth, BASIC) off the
// page, so the page stays responsive and a program that loops forever is stopped by ending this worker.
importScripts('/web/js/esolangs.js', '/web/js/esolangs-words.js', '/web/js/minilangs.js');
/* The interpreters are data-only, but the worker still gets the same lockdown as the Python and JavaScript sandboxes
   before a single program is read: no network, no storage, no script loading, no second worker. */
(function seal(g) {
  const blocked = () => Promise.reject(new Error('The sandbox has no network.'));
  try { Object.defineProperty(g, 'fetch', { value: blocked, configurable: false, writable: false }); } catch (e) { try { g.fetch = blocked; } catch (x) { } }
  ['XMLHttpRequest', 'WebSocket', 'WebSocketStream', 'EventSource', 'indexedDB', 'caches', 'importScripts',
    'BroadcastChannel', 'SharedWorker', 'Worker', 'WebTransport', 'RTCPeerConnection', 'webkitRTCPeerConnection',
    'RTCDataChannel'].forEach(key => {
    try { Object.defineProperty(g, key, { value: undefined, configurable: false, writable: false }); }
    catch (e) { try { g[key] = undefined; } catch (x) { } }
  });
  try { if (g.navigator) { g.navigator.sendBeacon = undefined; g.navigator.serviceWorker = undefined; } } catch (e) { }
  try { Object.defineProperty(g, '__oaSealed', { value: true, configurable: false }); } catch (e) { }
})(self);
self.onmessage = e => {
  const { lang, code, input, ms } = e.data || {};
  let result;
  try { result = self.Esolangs.run(lang, code, input, { ms }); }
  catch (error) { result = { ok: false, error: String(error && error.message || error) }; }
  /* one message back, bounded, with only the fields the Playground understands */
  const text = value => String(value == null ? '' : value).slice(0, 200000);
  postMessage({
    ok: !!result.ok,
    stdout: text(result.stdout),
    stderr: text(result.stderr),
    error: result.error ? text(result.error) : undefined,
    ms: Number(result.ms) || 0
  });
};

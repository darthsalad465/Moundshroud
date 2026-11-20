// Off-main-thread Node backend worker for Moundshroud Standalone (Electron utilityProcess).
// Runs server.js completely in-process over Electron's in-memory IPC (process.parentPort):
// ZERO localhost TCP ports, ZERO UI thread blocking (even during spawnSync/SQLite/Ollama calls).
const path = require('path');
const { dispatchToHandler } = require('./inprocess-bridge');

const CORE_DIR = process.env.MOUNDSHROUD_CORE || path.resolve(__dirname, '..');
const embedded = require(path.join(CORE_DIR, 'server.js'));
const active = new Map(); // id -> AbortController

const port = process.parentPort;
if (!port) {
  console.error('backend-worker must be launched via Electron utilityProcess.fork');
  process.exit(1);
}

port.on('message', async ev => {
  const msg = ev.data || {};
  if (msg.type === 'shutdown') {
    for (const ac of active.values()) { try { ac.abort(); } catch (e) { } }
    active.clear();
    try { embedded.shutdown(); } catch (e) { }
    setTimeout(() => process.exit(0), 120);
    return;
  }
  if (msg.type === 'abort') {
    const ac = active.get(msg.id);
    if (ac) { try { ac.abort(); } catch (e) { } active.delete(msg.id); }
    return;
  }
  if (msg.type !== 'req') return;

  const { id, target, method, url, headers, body } = msg;
  const ac = new AbortController();
  active.set(id, ac);

  try {
    const init = { method: method || 'GET', headers: headers || {}, signal: ac.signal };
    if (body && body.byteLength && method !== 'GET' && method !== 'HEAD') {
      init.body = body instanceof Uint8Array ? body : new Uint8Array(body);
    }
    const webReq = new Request(url, init);
    const handler = target === 'lib' ? embedded.handleLibRequest : embedded.handleAppRequest;
    const webRes = await dispatchToHandler(handler, webReq);

    const outHeaders = [];
    webRes.headers.forEach((v, k) => outHeaders.push([k, v]));
    port.postMessage({ type: 'head', id, status: webRes.status, headers: outHeaders });

    if (webRes.body) {
      const reader = webRes.body.getReader();
      try {
        for (;;) {
          const { done, value } = await reader.read();
          if (done) break;
          if (ac.signal.aborted) { try { await reader.cancel(); } catch (e) { } break; }
          if (value && value.byteLength) {
            port.postMessage({ type: 'chunk', id, chunk: value });
          }
        }
      } catch (streamErr) {
        if (!ac.signal.aborted) {
          port.postMessage({ type: 'error', id, error: String((streamErr && streamErr.message) || streamErr) });
        }
      }
    }
    port.postMessage({ type: 'end', id });
  } catch (err) {
    if (!ac.signal.aborted) {
      port.postMessage({ type: 'error', id, error: String((err && err.message) || err) });
    }
  } finally {
    active.delete(id);
  }
});

try { embedded.startBackground(); } catch (e) { console.error('startBackground error:', e); }
port.postMessage({ type: 'ready' });

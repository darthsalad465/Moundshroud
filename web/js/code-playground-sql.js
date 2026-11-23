/* Each Playground run gets its own SQLite database and worker. */
self.onmessage = async ({ data: code }) => {
  let db;
  const lines = [];
  let size = 0;
  function append(values) {
    const line = values.map(value => {
      if (value === null) return 'NULL';
      if (value instanceof Uint8Array) return '[BLOB, ' + value.length + ' bytes]';
      return String(value).replace(/[\t\r\n]/g, char => ({ '\t': '\\t', '\r': '\\r', '\n': '\\n' }[char]));
    }).join('\t');
    size += line.length + 1;
    if (size > 64 * 1024) throw new Error('Stopped after reaching the SQL output limit.');
    lines.push(line);
  }
  try {
    importScripts('/web/vendor/sqljs/sql-wasm.js');
    const SQL = await initSqlJs({ locateFile: name => '/web/vendor/sqljs/' + name });
    /* The database engine is loaded. Before any statement runs, close every way out of the worker: SQL itself cannot
       call JavaScript, but a stray extension or a future engine change should still find no network or storage. */
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
    })(self);
    db = new SQL.Database();
    for (const statement of db.iterateStatements(code)) {
      const columns = statement.getColumnNames();
      if (columns.length) {
        if (lines.length) append([]);
        append(columns);
      }
      while (statement.step()) append(statement.get(null, { useBigInt: true }));
    }
    self.postMessage({ ok: true, stdout: lines.join('\n') });
  } catch (error) {
    self.postMessage({ ok: false, stdout: lines.join('\n'), error: error.message });
  } finally {
    db?.close();
  }
};

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

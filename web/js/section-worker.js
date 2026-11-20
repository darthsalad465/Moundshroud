self.onmessage = async ({ data }) => {
  try {
    if (data.kind === 'math') {
      importScripts('/web/vendor/mathjs/math.js');
      const value = math.evaluate(data.expression);
      if (typeof value === 'function') throw Error('Enter a mathematical expression.');
      self.postMessage({ value: math.format(value, { precision: 14 }).slice(0, 8000) });
      return;
    }
    importScripts('/web/vendor/sqljs/sql-wasm.js');
    const SQL = await initSqlJs({ locateFile: (name) => '/web/vendor/sqljs/' + name });
    const db = new SQL.Database(Uint8Array.from(atob(data.database), (c) => c.charCodeAt(0)));
    try {
      const tables = [];
      for (const stmt of db.iterateStatements(data.query)) {
        const columns = stmt.getColumnNames(),
          values = [];
        while (values.length < 200 && stmt.step()) values.push(stmt.get());
        if (columns.length) tables.push({ columns, values });
      }
      self.postMessage({ tables });
    } finally {
      db.close();
    }
  } catch (e) {
    self.postMessage({ error: e.message });
  }
};

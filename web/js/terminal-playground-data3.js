// Terminal playground — SQL, Git, Docker, network and encoding sandboxes.
(function () {
  const G = window.TerminalPlayground;
  if (!G) return;

  const grid = (cols, rows) => {
    const w = cols.map((c, i) => Math.max(String(c).length, ...rows.map(r => String(r[i] == null ? 'NULL' : r[i]).length)));
    const line = cells => cells.map((c, i) => String(c).padEnd(w[i])).join(' | ');
    return [line(cols), w.map(x => '-'.repeat(x)).join('-+-')]
      .concat(rows.map(r => line(r.map(v => v == null ? 'NULL' : v)))).join('\n') + '\n(' + rows.length + ' row' + (rows.length === 1 ? '' : 's') + ')';
  };
  const lit = s => {
    s = String(s).trim();
    if (/^'.*'$/.test(s) || /^".*"$/.test(s)) return s.slice(1, -1);
    if (/^-?\d+(\.\d+)?$/.test(s)) return +s;
    if (/^null$/i.test(s)) return null;
    return s;
  };

  /* ================================================================ SQL */
  G.makeSql = function () {
    let db, snapshot = null;
    const seed = () => ({
      users: { cols: ['id', 'name', 'role', 'active'], rows: [[1, 'maya', 'admin', 1], [2, 'dev', 'engineer', 1], [3, 'sam', 'analyst', 1], [4, 'nina', 'engineer', 0]] },
      orders: { cols: ['id', 'user_id', 'total', 'status'], rows: [[1001, 1, 240.5, 'paid'], [1002, 2, 89.99, 'pending'], [1003, 1, 12.0, 'paid'], [1004, 3, 460.0, 'refunded']] },
      products: { cols: ['id', 'sku', 'name', 'price', 'stock'], rows: [[1, 'KB-01', 'Keyboard', 79.0, 41], [2, 'MS-02', 'Mouse', 39.5, 120], [3, 'MN-27', 'Monitor', 289.0, 7]] }
    });
    let out = [];
    const reset = () => { db = seed(); out = []; snapshot = null; };
    reset();
    const evalCond = (cols, row, cond) => {
      cond = cond.trim();
      if (!cond) return true;
      const orParts = cond.split(/\s+or\s+/i);
      if (orParts.length > 1) return orParts.some(p => evalCond(cols, row, p));
      const andParts = cond.split(/\s+and\s+/i);
      if (andParts.length > 1) return andParts.every(p => evalCond(cols, row, p));
      if (/^not\s+/i.test(cond)) return !evalCond(cols, row, cond.replace(/^not\s+/i, ''));
      const colIdx = name => {
        const clean = name.trim().toLowerCase();
        let i = cols.findIndex(c => c.toLowerCase() === clean);
        if (i < 0 && clean.includes('.')) i = cols.findIndex(c => c.toLowerCase().endsWith('.' + clean.split('.').pop()) || c.toLowerCase() === clean.split('.').pop());
        return i;
      };
      let m = cond.match(/^([\w.]+)\s+is\s+(not\s+)?null$/i);
      if (m) { const i = colIdx(m[1]); return i < 0 ? false : (m[2] ? row[i] != null : row[i] == null); }
      m = cond.match(/^([\w.]+)\s+(not\s+)?in\s*\(([\s\S]+)\)$/i);
      if (m) { const i = colIdx(m[1]); if (i < 0) return false; const vals = G.splitTop(m[3], [',']).map(lit).map(String); const has = vals.includes(String(row[i])); return m[2] ? !has : has; }
      m = cond.match(/^([\w.]+)\s+between\s+(.+?)\s+and\s+(.+)$/i);
      if (m) { const i = colIdx(m[1]); if (i < 0) return false; const v = row[i], a = lit(m[2]), b = lit(m[3]); return v >= a && v <= b; }
      m = cond.match(/^([\w.'"-]+)\s*(=|==|!=|<>|>=|<=|>|<|i?like)\s*([\s\S]+?)$/i);
      if (!m) return true;
      const i = colIdx(m[1]);
      const op = m[2].toLowerCase(), v = lit(m[3]);
      const x = i >= 0 ? row[i] : (/^(?:-?\d+(?:\.\d+)?|'[^']*'|"[^"]*"|true|false)$/i.test(m[1].trim()) ? lit(m[1]) : undefined);
      if (x === undefined && i < 0) return false;
      switch (op) {
        case '=': case '==': return String(x) === String(v);
        case '!=': case '<>': return String(x) !== String(v);
        case '>': return x > v;
        case '<': return x < v;
        case '>=': return x >= v;
        case '<=': return x <= v;
        case 'like': case 'ilike': return new RegExp('^' + String(v).replace(/[.+^${}()|[\]\\]/g, '\\$&').replace(/%/g, '.*').replace(/_/g, '.') + '$', 'i').test(String(x ?? ''));
        default: return false;
      }
    };
    const matchWhere = (t, cond, rows) => rows.filter(r => evalCond(t.cols, r, cond));
    const views = {};

    function select(q) {
      if (!/\bfrom\b/i.test(q)) {
        const exprs = G.splitTop(q.replace(/^select\s+/i, ''), [',']);
        const cols = [], vals = [];
        for (const e of exprs) {
          const am = e.match(/^([\s\S]+?)\s+as\s+(\w+)$/i);
          const raw = (am ? am[1] : e).trim();
          cols.push(am ? am[2] : raw);
          try { vals.push(/^['"].*['"]$/.test(raw) ? raw.slice(1, -1) : new Function('return (' + raw.replace(/[^0-9+\-*/%().\s]/g, '') + ')')()); }
          catch (err) { vals.push(lit(raw)); }
        }
        return grid(cols, [vals]);
      }
      const m = q.match(/^select\s+(distinct\s+)?([\s\S]+?)\s+from\s+(\w+)(?:\s+(?:as\s+)?(\w+))?([\s\S]*)$/i);
      if (!m) return 'Parse error: expected SELECT <columns> FROM <table>';
      const distinct = !!m[1], wantStr = m[2].trim(), baseName = m[3].toLowerCase();
      const baseAlias = (m[4] && !/^(where|order|limit|offset|group|having|inner|left|right|cross|join|union)$/i.test(m[4])) ? m[4].toLowerCase() : baseName;
      let rest = (m[4] && baseAlias === baseName ? m[4] + ' ' : '') + (m[5] || '');
      const t = db[baseName] || views[baseName];
      if (!t) return 'ERROR: relation "' + m[3] + '" does not exist';

      let cols = t.cols.slice();
      let qualCols = t.cols.map(c => baseAlias + '.' + c);
      let rows = t.rows.map(r => r.slice());

      // Handle JOINs (INNER, LEFT, RIGHT, CROSS, JOIN)
      const joinRe = /\b(inner|left|right|cross)?\s*join\s+(\w+)(?:\s+(?:as\s+)?(\w+))?(?:\s+on\s+([\w.]+)\s*=\s*([\w.]+))?/ig;
      let jm;
      while ((jm = joinRe.exec(rest)) !== null) {
        const jType = (jm[1] || 'inner').toLowerCase(), jName = jm[2].toLowerCase();
        const jAlias = (jm[3] && !/^(on|where|order|limit|group)$/i.test(jm[3])) ? jm[3].toLowerCase() : jName;
        const jt = db[jName];
        if (!jt) return 'ERROR: relation "' + jm[2] + '" does not exist';
        const lCol = jm[4], rCol = jm[5];
        const findCol = (name, cList, qList) => {
          const lc = String(name || '').toLowerCase();
          let idx = qList.indexOf(lc);
          if (idx < 0) idx = cList.indexOf(lc.split('.').pop());
          return idx;
        };
        const nextRows = [];
        for (const r1 of rows) {
          let matched = false;
          for (const r2 of jt.rows) {
            if (jType === 'cross' || !lCol) { nextRows.push(r1.concat(r2)); matched = true; continue; }
            const combined = r1.concat(r2);
            const cAll = cols.concat(jt.cols), qAll = qualCols.concat(jt.cols.map(c => jAlias + '.' + c));
            const li = findCol(lCol, cAll, qAll), ri = findCol(rCol, cAll, qAll);
            if (li >= 0 && ri >= 0 && String(combined[li]) === String(combined[ri])) { nextRows.push(combined); matched = true; }
          }
          if (!matched && jType === 'left') nextRows.push(r1.concat(jt.cols.map(() => null)));
        }
        cols = cols.concat(jt.cols);
        qualCols = qualCols.concat(jt.cols.map(c => jAlias + '.' + c));
        rows = nextRows;
      }
      rest = rest.replace(joinRe, ' ');

      const wm = rest.match(/\bwhere\b([\s\S]*?)(?=\bgroup\s+by\b|\bhaving\b|\border\s+by\b|\blimit\b|\boffset\b|$)/i);
      const gm = rest.match(/\bgroup\s+by\s+([\w.,\s]+?)(?=\bhaving\b|\border\s+by\b|\blimit\b|\boffset\b|$)/i);
      const om = rest.match(/\border\s+by\s+([\w.]+)(?:\s+(asc|desc))?/i);
      const lm = rest.match(/\blimit\s+(\d+)/i);
      const offm = rest.match(/\boffset\s+(\d+)/i);

      if (wm) rows = rows.filter(r => evalCond(qualCols, r, wm[1]) || evalCond(cols, r, wm[1]));

      const colOf = name => {
        const lc = name.trim().toLowerCase();
        let i = qualCols.indexOf(lc);
        if (i < 0) i = cols.findIndex(c => c.toLowerCase() === lc);
        if (i < 0 && lc.includes('.')) i = cols.findIndex(c => c.toLowerCase() === lc.split('.').pop());
        return i;
      };
      const evalAgg = (expr, groupRows) => {
        const am = expr.match(/^(count|sum|avg|min|max)\s*\(\s*([\w.*]+)\s*\)$/i);
        if (!am) return null;
        const fn = am[1].toLowerCase(), arg = am[2];
        if (fn === 'count') return arg === '*' ? groupRows.length : groupRows.filter(r => r[colOf(arg)] != null).length;
        const i = colOf(arg);
        const vals = groupRows.map(r => Number(r[i])).filter(n => !isNaN(n));
        if (!vals.length) return null;
        if (fn === 'sum') return +(vals.reduce((a, b) => a + b, 0).toFixed(4));
        if (fn === 'avg') return +((vals.reduce((a, b) => a + b, 0) / vals.length).toFixed(2));
        if (fn === 'min') return Math.min(...vals);
        if (fn === 'max') return Math.max(...vals);
        return null;
      };

      const wantItems = wantStr === '*' ? ['*'] : G.splitTop(wantStr, [',']).map(s => s.trim());
      const hasAgg = wantItems.some(x => /^(count|sum|avg|min|max)\s*\(/i.test(x.replace(/\s+as\s+\w+$/i, '').trim()));

      if (gm || hasAgg) {
        const gCols = gm ? gm[1].split(',').map(s => s.trim()).filter(Boolean) : [];
        const groups = new Map();
        for (const r of rows) {
          const key = gCols.length ? gCols.map(c => String(r[colOf(c)] ?? '')).join('\0') : '__all__';
          if (!groups.has(key)) groups.set(key, []);
          groups.get(key).push(r);
        }
        if (!groups.size && !gCols.length) groups.set('__all__', []);
        const outCols = [], outRows = [];
        for (const item of wantItems) {
          const asM = item.match(/^([\s\S]+?)\s+as\s+(\w+)$/i);
          outCols.push(asM ? asM[2] : item);
        }
        for (const grp of groups.values()) {
          outRows.push(wantItems.map(item => {
            const rawExpr = item.replace(/\s+as\s+\w+$/i, '').trim();
            const agg = evalAgg(rawExpr, grp);
            if (agg !== null) return agg;
            const i = colOf(rawExpr);
            return grp[0] && i >= 0 ? grp[0][i] : null;
          }));
        }
        if (om) {
          const oi = outCols.findIndex(c => c.toLowerCase() === om[1].toLowerCase());
          const desc = om[2] && om[2].toLowerCase() === 'desc';
          if (oi >= 0) outRows.sort((a, b) => (a[oi] > b[oi] ? 1 : a[oi] < b[oi] ? -1 : 0) * (desc ? -1 : 1));
        }
        let fin = outRows;
        if (offm) fin = fin.slice(parseInt(offm[1], 10));
        if (lm) fin = fin.slice(0, parseInt(lm[1], 10));
        return grid(outCols, fin);
      }

      if (om) {
        const idx = colOf(om[1]);
        const desc = om[2] && om[2].toLowerCase() === 'desc';
        if (idx >= 0) rows.sort((a, b) => (a[idx] > b[idx] ? 1 : a[idx] < b[idx] ? -1 : 0) * (desc ? -1 : 1));
      }
      let outCols = cols.slice();
      if (wantStr !== '*') {
        const idxs = [];
        outCols = [];
        for (const item of wantItems) {
          const asM = item.match(/^([\s\S]+?)\s+as\s+(\w+)$/i);
          const rawCol = (asM ? asM[1] : item).trim();
          const idx = colOf(rawCol);
          if (idx < 0) return 'ERROR: column "' + rawCol + '" does not exist';
          idxs.push(idx);
          outCols.push(asM ? asM[2] : rawCol.split('.').pop());
        }
        rows = rows.map(r => idxs.map(i => r[i]));
      }
      if (distinct) {
        const seen = new Set();
        rows = rows.filter(r => { const k = JSON.stringify(r); if (seen.has(k)) return false; seen.add(k); return true; });
      }
      if (offm) rows = rows.slice(parseInt(offm[1], 10));
      if (lm) rows = rows.slice(0, parseInt(lm[1], 10));
      return grid(outCols, rows);
    }

    function insert(q) {
      const m = q.match(/^insert\s+into\s+(\w+)\s*(?:\(([^)]+)\))?\s*values\s*\(([\s\S]+)\)\s*;?$/i);
      if (!m) return 'Parse error: expected INSERT INTO <table> (columns) VALUES (...)';
      const t = db[m[1].toLowerCase()];
      if (!t) return 'ERROR: relation "' + m[1] + '" does not exist';
      const vals = G.splitTop(m[3], [',']).map(lit);
      if (m[2]) {
        const cols = m[2].split(',').map(x => x.trim());
        const row = t.cols.map((c) => cols.includes(c) ? vals[cols.indexOf(c)] : null);
        t.rows.push(row);
      } else t.rows.push(vals);
      return 'INSERT 0 1';
    }
    function update(q) {
      const m = q.match(/^update\s+(\w+)\s+set\s+([\s\S]+?)(?:\s+where\s+([\s\S]+))?;?$/i);
      if (!m) return 'Parse error: expected UPDATE <table> SET <assignments> WHERE <condition>';
      const t = db[m[1].toLowerCase()];
      if (!t) return 'ERROR: relation "' + m[1] + '" does not exist';
      const sets = G.splitTop(m[2], [',']).map(x => { const i = x.indexOf('='); return [x.slice(0, i).trim(), lit(x.slice(i + 1))]; });
      let n = 0;
      for (const r of t.rows) {
        const hit = m[3] ? evalCond(t.cols, r, m[3]) : true;
        if (!hit) continue;
        for (const [c, v] of sets) { const i = t.cols.indexOf(c); if (i >= 0) r[i] = v; }
        n++;
      }
      return 'UPDATE ' + n;
    }
    function del(q) {
      const m = q.match(/^delete\s+from\s+(\w+)(?:\s+where\s+([\s\S]+))?;?$/i);
      if (!m) return 'Parse error: expected DELETE FROM <table> WHERE <condition>';
      const t = db[m[1].toLowerCase()];
      if (!t) return 'ERROR: relation "' + m[1] + '" does not exist';
      const before = t.rows.length;
      t.rows = t.rows.filter(r => m[2] ? !evalCond(t.cols, r, m[2]) : false);
      return 'DELETE ' + (before - t.rows.length);
    }

    function runOne(rawQ) {
      let q = String(rawQ || '').trim().replace(/\s+/g, ' ').replace(/;\s*$/, '');
      if (!q) return '';
      if (/^help(?:\s+(.*))?$/i.test(q)) {
        const hm = q.match(/^help(?:\s+(.*))?$/i);
        return G.formatHelp('sql', (hm && hm[1]) || '') + '\n\nTables: users(id,name,role,active) · orders(id,user_id,total,status) · products(id,sku,name,price,stock)';
      }
      if (/^(show tables|\\dt)$/i.test(q)) return grid(['table_name'], Object.keys(db).map(x => [x]));
      if (/^show databases$/i.test(q)) return grid(['database'], [['sandbox'], ['information_schema']]);
      if (/^use\s+\w+$/i.test(q)) return 'Database changed';
      if (/^(?:describe|desc|\\d|show columns from)\s+(\w+)$/i.test(q) || /^pragma\s+table_info\s*\(\s*['"]?(\w+)['"]?\s*\)$/i.test(q)) {
        const m = q.match(/(?:describe|desc|\\d|show columns from|table_info\s*\(\s*['"]?)\s*(\w+)/i);
        const t = db[m[1].toLowerCase()];
        return t ? grid(['column', 'type'], t.cols.map(c => [c, /^(id|user_id|stock|active)$/.test(c) ? 'integer' : /total|price/.test(c) ? 'numeric' : 'text'])) : 'ERROR: relation "' + m[1] + '" does not exist';
      }
      if (/^create\s+table\s+(?:if\s+not\s+exists\s+)?(\w+)\s*\(([\s\S]+)\)$/i.test(q)) {
        const m = q.match(/^create\s+table\s+(?:if\s+not\s+exists\s+)?(\w+)\s*\(([\s\S]+)\)$/i);
        const name = m[1].toLowerCase();
        const cols = G.splitTop(m[2], [',']).map(c => c.trim().split(/\s+/)[0]).filter(Boolean);
        db[name] = { cols, rows: [] };
        return 'CREATE TABLE';
      }
      if (/^drop\s+table\s+(?:if\s+exists\s+)?(\w+)$/i.test(q)) {
        const m = q.match(/(\w+)$/); delete db[m[1].toLowerCase()]; return 'DROP TABLE';
      }
      if (/^truncate\s+(?:table\s+)?(\w+)$/i.test(q)) {
        const m = q.match(/(\w+)$/); if (db[m[1].toLowerCase()]) db[m[1].toLowerCase()].rows = []; return 'TRUNCATE TABLE';
      }
      if (/^alter\s+table\s+(\w+)\s+add\s+(?:column\s+)?(\w+)/i.test(q)) {
        const m = q.match(/^alter\s+table\s+(\w+)\s+add\s+(?:column\s+)?(\w+)/i);
        const t = db[m[1].toLowerCase()];
        if (!t) return 'ERROR: relation "' + m[1] + '" does not exist';
        t.cols.push(m[2]); t.rows.forEach(r => r.push(null));
        return 'ALTER TABLE';
      }
      if (/^create\s+(?:unique\s+)?index\b/i.test(q)) return 'CREATE INDEX';
      if (/^drop\s+index\b/i.test(q)) return 'DROP INDEX';
      if (/^create\s+view\s+(\w+)\s+as\s+([\s\S]+)$/i.test(q)) {
        const m = q.match(/^create\s+view\s+(\w+)\s+as\s+([\s\S]+)$/i);
        views[m[1].toLowerCase()] = db.users;
        return 'CREATE VIEW';
      }
      if (/^drop\s+view\b/i.test(q)) return 'DROP VIEW';
      if (/^begin(?:\s+transaction)?$/i.test(q)) { snapshot = JSON.parse(JSON.stringify(db)); return 'BEGIN'; }
      if (/^commit$/i.test(q)) { snapshot = null; return 'COMMIT'; }
      if (/^rollback$/i.test(q)) { if (snapshot) { db = snapshot; snapshot = null; } return 'ROLLBACK'; }
      if (/^explain\s+/i.test(q)) return 'QUERY PLAN\n-------------------------------------------\nSeq Scan on sandbox relation (cost=0.00..1.04 rows=4)';
      if (/^(reset|clear)$/i.test(q)) { if (/^reset$/i.test(q)) { reset(); return 'database reset to its seed rows'; } return ''; }
      if (/^select\b/i.test(q)) return select(q);
      if (/^insert\b/i.test(q)) return insert(q);
      if (/^update\b/i.test(q)) return update(q);
      if (/^delete\b/i.test(q)) return del(q);
      return 'ERROR: unrecognised statement. Type help for the supported dialect.';
    }
    function run(line) {
      const parts = G.splitTop(String(line == null ? '' : line), [';']).map(s => s.trim()).filter(Boolean);
      const res = parts.map(runOne).filter(Boolean).join('\n\n');
      if (res) out.push(res);
      return res;
    }

    return {
      id: 'sql', name: 'SQL', icon: '🗃️', group: 'Data',
      about: 'A small relational engine over three tables. Real SELECT/INSERT/UPDATE/DELETE with WHERE, LIKE, ORDER BY and LIMIT, rendered as a result grid.',
      prompt: () => 'sql> ',
      run,
      snapshot: () => ({ db, transaction: snapshot }),
      restore: saved => { if (saved.db) { db = saved.db; snapshot = saved.transaction || null; } },
      commands: [
        ['SHOW TABLES;', 'list the tables in the database'],
        ['DESCRIBE users;', 'columns and types for a table'],
        ['SELECT * FROM users;', 'every row and column'],
        ['SELECT name, role FROM users;', 'project specific columns'],
        ['SELECT * FROM users WHERE role = \'engineer\';', 'filter with WHERE'],
        ['SELECT * FROM users WHERE name LIKE \'m%\';', 'pattern matching with LIKE'],
        ['SELECT * FROM orders WHERE total > 100 ORDER BY total DESC;', 'filter and sort'],
        ['SELECT * FROM orders LIMIT 2;', 'limit the result set'],
        ['SELECT * FROM products WHERE stock < 50;', 'numeric comparison'],
        ['INSERT INTO users VALUES (5, \'alex\', \'engineer\', 1);', 'insert a row'],
        ['UPDATE orders SET status = \'paid\' WHERE id = 1002;', 'update matching rows'],
        ['DELETE FROM orders WHERE status = \'refunded\';', 'delete matching rows'],
        ['RESET;', 'restore the seed data']
      ].map(x => ({ ex: x[0], d: x[1] }))
    };
  };

  /* ================================================================ GIT */
  G.makeGit = function () {
    let S;
    const seed = () => ({
      branch: 'main', branches: { main: [] }, commits: [], staged: [], modified: [],
      files: { 'README.md': 'untracked', 'app.js': 'untracked', 'styles.css': 'untracked' },
      stash: [], remote: '', tags: {}, detached: false
    });
    let tick = 0;
    const reset = () => { S = seed(); tick = 0; };
    reset();
    const hash = () => (0xabc0000 + (++tick) * 7919).toString(16).padStart(7, '0');
    const branchCommits = () => S.branches[S.branch] || [];
    const out = [];

    function run(line) {
      const raw = String(line == null ? '' : line).trim();
      if (!raw) return '';
      const w = raw.split(/\s+/);
      if ((w[0] || '').toLowerCase() === 'git') w.shift();
      const cmd = w.shift();
      const a = w.join(' ');
      const g = {};
      g.help = () => G.formatHelp('git', a);
      g.init = () => { S = seed(); return 'Initialized empty Git repository in C:/Users/dev/project/.git/'; };
      g.status = () => {
        const lines = ['On branch ' + S.branch];
        if (!S.commits.length) lines.push('', 'No commits yet');
        if (S.staged.length) {
          lines.push('', 'Changes to be committed:', '  (use "git rm --cached <file>..." to unstage)');
          for (const f of S.staged) lines.push('\tnew file:   ' + f);
        }
        const un = Object.keys(S.files).filter(f => !S.staged.includes(f));
        if (un.length) {
          lines.push('', 'Untracked files:', '  (use "git add <file>..." to include in what will be committed)');
          for (const f of un) lines.push('\t' + f);
        }
        if (!S.staged.length && !un.length) lines.push('', 'nothing to commit, working tree clean');
        return lines.join('\n');
      };
      g.add = () => {
        if (!a) return 'Nothing specified, nothing added.';
        const files = a === '.' || a === '-A' ? Object.keys(S.files) : a.split(/\s+/);
        S.staged = Array.from(new Set(S.staged.concat(files)));
        return '';
      };
      g.commit = () => {
        const m = a.match(/-m\s+["']?([^"']+)["']?/);
        if (!m) return 'error: switch `m\' requires a value (git commit -m "message")';
        if (!S.staged.length && !w.includes('--allow-empty')) return 'nothing added to commit but untracked files present (use "git add")';
        const h = hash();
        S.commits.push({ hash: h, msg: m[1], branch: S.branch, files: S.staged.slice() });
        (S.branches[S.branch] = S.branches[S.branch] || []).push(h);
        for (const f of S.staged) if (S.files[f]) delete S.files[f];
        S.staged = [];
        return '[' + S.branch + ' ' + h + '] ' + m[1] + '\n ' + S.commits[S.commits.length - 1].files.length + ' file(s) changed';
      };
      g.log = () => S.commits.length
        ? S.commits.slice().reverse().map(c => a.includes('--oneline') ? c.hash + ' ' + c.msg : 'commit ' + c.hash + '\nAuthor: dev <dev@dev-box>\nDate:   Thu Feb 12 06:4' + (c.hash.charCodeAt(0) % 9) + ':00 2026\n\n    ' + c.msg).join(a.includes('--oneline') ? '\n' : '\n\n')
        : 'fatal: your current branch \'' + S.branch + '\' does not have any commits yet';
      g.diff = () => {
        const f = Object.keys(S.files)[0];
        if (!f) return '';
        return 'diff --git a/' + f + ' b/' + f + '\nindex 0000000..4b825dc 100644\n--- a/' + f + '\n+++ b/' + f + '\n@@ -1 +1,2 @@\n+' + S.files[f] + '\n+// staged preview';
      };
      g.branch = () => {
        if (!a) return Object.keys(S.branches).map(b => (b === S.branch ? '* ' : '  ') + b).join('\n');
        if (S.branches[a]) return 'fatal: a branch named \'' + a + '\' already exists';
        S.branches[a] = branchCommits().slice();
        return '';
      };
      g.checkout = () => {
        const m = a.match(/-b\s+(\w+)/);
        if (m) { S.branches[m[1]] = branchCommits().slice(); S.branch = m[1]; return 'Switched to a new branch \'' + m[1] + '\''; }
        const target = a.replace(/^-b\s+/, '').trim();
        if (S.branches[target]) { S.branch = target; return 'Switched to branch \'' + target + '\''; }
        return 'error: pathspec \'' + target + '\' did not match any file(s) known to git';
      };
      g.merge = () => {
        const src = a.trim();
        if (!S.branches[src]) return 'merge: ' + src + ' - not something we can merge';
        const h = hash();
        S.commits.push({ hash: h, msg: 'Merge branch \'' + src + '\' into ' + S.branch, branch: S.branch, files: [] });
        branchCommits().push(h);
        return 'Merge made by the \'ort\' strategy.\n 1 file changed, 3 insertions(+)';
      };
      g.stash = () => {
        if (a === 'pop') {
          if (!S.stash.length) return 'No stash entries found.';
          const s = S.stash.pop();
          S.files[s.file] = s.content;
          return 'Changes restored from stash@{0}';
        }
        if (a === 'list') return S.stash.map((s, i) => 'stash@{' + i + '}: WIP on ' + S.branch + ': ' + s.file).join('\n');
        const f = Object.keys(S.files)[0];
        if (!f) return 'No local changes to save';
        S.stash.push({ file: f, content: S.files[f] });
        delete S.files[f];
        return 'Saved working directory and index state WIP on ' + S.branch + ': ' + f;
      };
      g.remote = () => {
        if (!a) return S.remote || '';
        S.remote = a.replace(/^add\s+origin\s+/, '').replace(/^origin\s+/, '');
        return '';
      };
      g.push = () => S.remote ? 'Enumerating objects: 5, done.\nWriting objects: 100% (3/3), 612 bytes\nTo ' + S.remote + '\n   ' + (branchCommits()[0] || '0000000') + '..' + (branchCommits().slice(-1)[0] || '0000000') + '  ' + S.branch + ' -> ' + S.branch : 'fatal: No configured push destination. Try: git remote add origin <url>';
      g.pull = () => S.remote ? 'Already up to date.' : 'fatal: no remote configured';
      g.clone = () => 'Cloning into \'' + (a.split('/').pop() || 'repo').replace(/\.git$/, '') + '\'...\nremote: Enumerating objects: 128, done.\nReceiving objects: 100% (128/128), 84.20 KiB | 1.2 MiB/s, done.\nResolving deltas: 100% (41/41), done.';
      g.tag = () => {
        if (!a) return Object.keys(S.tags).join('\n');
        S.tags[a] = branchCommits().slice(-1)[0] || '0000000';
        return '';
      };
      g.reset = () => {
        S.staged = [];
        if (a.includes('--hard')) { S.files = {}; return 'HEAD is now at ' + (branchCommits().slice(-1)[0] || '0000000'); }
        return 'Unstaged changes after reset:';
      };
      g.revert = () => { const h = hash(); return '[' + S.branch + ' ' + h + '] Revert "' + (S.commits.slice(-1)[0] || { msg: 'commit' }).msg + '"'; };
      g.config = () => 'user.name=dev\nuser.email=dev@dev-box';
      g.switch = () => {
        const m = a.match(/(?:-c|-C)\s+(\S+)/);
        if (m) { S.branches[m[1]] = branchCommits().slice(); S.branch = m[1]; return "Switched to a new branch '" + m[1] + "'"; }
        const target = a.trim();
        if (S.branches[target]) { S.branch = target; return "Switched to branch '" + target + "'"; }
        return "fatal: invalid reference: " + target;
      };
      g.restore = () => {
        if (a.includes('--staged')) { S.staged = []; return ''; }
        return '';
      };
      g.rm = () => {
        const f = a.replace(/--cached\s*/g, '').replace(/-f\s*/g, '').trim();
        S.staged = S.staged.filter(x => x !== f);
        delete S.files[f];
        return f ? "rm '" + f + "'" : 'usage: git rm [--cached] <file>';
      };
      g.mv = () => { const p = a.split(/\s+/); if (p.length < 2) return 'usage: git mv <old> <new>'; if (S.files[p[0]]) { S.files[p[1]] = S.files[p[0]]; delete S.files[p[0]]; } return ''; };
      g.show = () => { const c = S.commits[S.commits.length - 1]; return c ? 'commit ' + c.hash + '\nAuthor: dev <dev@dev-box>\n\n    ' + c.msg + '\n\n ' + c.files.join(', ') : 'fatal: bad default revision HEAD'; };
      g.blame = () => { const f = a || 'app.js'; return (branchCommits().slice(-1)[0] || '0000000') + ' (dev 2026-02-12 06:40:00 +0000 1) // ' + f; };
      g.reflog = () => S.commits.slice().reverse().map((c, i) => c.hash + ' HEAD@{' + i + '}: commit: ' + c.msg).join('\n') || '0000000 HEAD@{0}: branch: Created from HEAD';
      g['cherry-pick'] = () => { const h = hash(); S.commits.push({ hash: h, msg: 'cherry-pick ' + (a || 'HEAD'), branch: S.branch, files: [] }); branchCommits().push(h); return '[' + S.branch + ' ' + h + '] cherry-pick ' + (a || 'HEAD'); };
      g.rebase = () => 'Successfully rebased and updated refs/heads/' + S.branch + '.';
      g.fetch = () => S.remote ? 'From ' + S.remote + '\n * [new branch]      main -> origin/main' : 'fatal: no remote configured';
      g.clean = () => { const rm = Object.keys(S.files); if (a.includes('-f')) S.files = {}; return rm.map(f => (a.includes('-n') ? 'Would remove ' : 'Removing ') + f).join('\n'); };
      g.bisect = () => 'git bisect (sandbox): use start / bad / good / reset';
      g.grep = () => { const pat = a.replace(/^-\w+\s*/, '').trim(); return Object.keys(S.files).filter(f => f.includes(pat) || S.files[f].includes(pat)).map(f => f + ':1:' + S.files[f]).join('\n'); };
      g.shortlog = () => 'dev (' + S.commits.length + '):\n' + S.commits.map(c => '      ' + c.msg).join('\n');
      g.describe = () => Object.keys(S.tags).slice(-1)[0] || (branchCommits().slice(-1)[0] || 'v0.0.0');
      g['rev-parse'] = () => a.includes('--abbrev-ref') ? S.branch : (branchCommits().slice(-1)[0] || '0000000000000000000000000000000000000000');
      g['ls-files'] = () => Array.from(new Set(S.staged.concat(Object.keys(S.files)))).join('\n');
      g['ls-tree'] = () => Object.keys(S.files).map(f => '100644 blob 4b825dc\t' + f).join('\n');
      g['cat-file'] = () => S.commits.length ? 'tree 4b825dc\nauthor dev <dev@dev-box>\n\n' + S.commits[S.commits.length - 1].msg : 'commit object';
      g.archive = () => '(created git archive)';
      g.worktree = () => 'C:/Users/dev/project  ' + (branchCommits().slice(-1)[0] || '0000000') + ' [' + S.branch + ']';
      g.submodule = () => '(no submodules configured)';
      g.apply = () => '(patch applied cleanly)';
      g.am = () => '(mailbox patch applied)';
      g['format-patch'] = () => '0001-latest-commit.patch';
      g.notes = () => '';
      g.gc = () => 'Enumerating objects: done.\nNothing new to pack.';
      g.fsck = () => 'Checking object directories: 100% (256/256), done.';
      g.prune = () => '';
      g.version = () => 'git version 2.44.0.sandbox';
      g['--version'] = g.version;
      g['-v'] = g.version;
      g['--help'] = g.help;
      g.clear = () => '';
      g.resetSandbox = () => { reset(); return 'git sandbox reset — repository gone'; };
      g['reset-sandbox'] = g.resetSandbox;
      const fn = g[cmd];
      if (!fn) return 'git: \'' + (cmd || '') + '\' is not a git command. See help.';
      try { return fn(); } catch (e) { return 'git: ' + (e && e.message || e); }
    }

    return {
      id: 'git', name: 'Git', icon: '🌿', group: 'Tools',
      about: 'A working repository: init, stage, commit, branch, merge, stash, tag and push. Commit hashes advance and status reflects what you actually staged.',
      prompt: () => 'dev@dev-box:~/project (git:' + S.branch + ')$ ',
      run,
      snapshot: () => ({ repo: S, tick }),
      restore: saved => { if (saved.repo) { S = saved.repo; tick = saved.tick | 0; } },
      commands: [
        ['git init', 'create the repository'],
        ['git status', 'what is staged, modified or untracked'],
        ['git add .', 'stage everything'],
        ['git commit -m "first commit"', 'record a snapshot'],
        ['git log --oneline', 'compact history'],
        ['git log', 'full commit entries'],
        ['git diff', 'show the pending change'],
        ['git branch feature', 'create a branch'],
        ['git checkout -b feature', 'create and switch to a branch'],
        ['git checkout main', 'switch back'],
        ['git merge feature', 'merge a branch into the current one'],
        ['git branch', 'list branches and mark the current one'],
        ['git stash', 'shelve uncommitted work'],
        ['git stash pop', 'bring it back'],
        ['git remote add origin https://git.internal/app.git', 'set the remote'],
        ['git push', 'push the branch'],
        ['git pull', 'fetch and merge'],
        ['git clone https://git.internal/app.git', 'clone a repository'],
        ['git tag v1.0', 'tag the current commit'],
        ['git reset --hard', 'throw away local changes'],
        ['git config --global user.name', 'the configured identity'],
        ['help', 'all supported git verbs'],
        ['git reset-sandbox', 'start the repository over']
      ].map(x => ({ ex: x[0], d: x[1] }))
    };
  };

  /* ================================================================ DOCKER */
  G.makeDocker = function () {
    let images = [
      { repository: 'nginx', tag: '1.25-alpine', id: 'a8758716bb6a', size: '41.2MB' },
      { repository: 'postgres', tag: '16', id: 'c8f2710a3b11', size: '432MB' },
      { repository: 'node', tag: '20-alpine', id: '2f1a92c8d4e0', size: '128MB' },
      { repository: 'alpine', tag: 'latest', id: '4bcff63911fc', size: '7.05MB' }
    ];
    let containers = [
      { id: '3f1a2b9c7d10', image: 'app:1.4', command: '"node server.js"', status: 'Up 9 days', ports: '0.0.0.0:8080->8080/tcp', name: 'app-web-1' },
      { id: '8b2c4d6e0f11', image: 'postgres:16', command: '"postgres"', status: 'Up 9 days', ports: '5432/tcp', name: 'app-db-1' }
    ];
    const run = line => {
      const raw = String(line == null ? '' : line).trim();
      if (!raw) return '';
      if (/^(clear|cls)$/i.test(raw)) return '';
      if (/^reset$/i.test(raw)) {
        containers = [
          { id: '3f1a2b9c7d10', image: 'app:1.4', command: '"node server.js"', status: 'Up 9 days', ports: '0.0.0.0:8080->8080/tcp', name: 'app-web-1' },
          { id: '8b2c4d6e0f11', image: 'postgres:16', command: '"postgres"', status: 'Up 9 days', ports: '5432/tcp', name: 'app-db-1' }
        ];
        return 'Docker sandbox reset';
      }
      if (/^help(?:\s+(.*))?$/i.test(raw)) { const hm = raw.match(/^help(?:\s+(.*))?$/i); return G.formatHelp('docker', (hm && hm[1]) || ''); }
      const w = raw.split(/\s+/);
      if (w[0] !== 'docker') return 'bash: ' + w[0] + ': command not found (try docker ps or help)';
      const sub = w[1] || '--help';
      const rest = w.slice(2).join(' ');
      const target = w.slice(2).find(x => !x.startsWith('-')) || '';
      switch (sub) {
        case 'ps': return w.includes('-a') || rest.includes('-a')
          ? 'CONTAINER ID   IMAGE          COMMAND                  STATUS          PORTS                    NAMES\n' + containers.map(c => c.id.padEnd(14) + ' ' + c.image.padEnd(14) + ' ' + c.command.padEnd(24) + ' ' + c.status.padEnd(15) + ' ' + c.ports.padEnd(24) + ' ' + c.name).join('\n')
          : 'CONTAINER ID   IMAGE     STATUS          PORTS                    NAMES\n' + containers.filter(c => /Up/.test(c.status)).map(c => c.id.padEnd(14) + ' ' + c.image.padEnd(9) + ' ' + c.status.padEnd(15) + ' ' + c.ports.padEnd(24) + ' ' + c.name).join('\n');
        case 'images': return 'REPOSITORY   TAG           IMAGE ID       SIZE\n' + images.map(i => i.repository.padEnd(12) + ' ' + i.tag.padEnd(13) + ' ' + i.id.padEnd(14) + ' ' + i.size).join('\n');
        case 'run': case 'create': {
          const img = w.find((x, i) => i >= 2 && !x.startsWith('-') && !(w[i - 1] === '--name' || w[i - 1] === '-p' || w[i - 1] === '-e' || w[i - 1] === '-v')) || 'alpine';
          const nameIdx = w.indexOf('--name');
          const name = nameIdx > 0 ? w[nameIdx + 1] : 'sandbox-' + (containers.length + 1);
          const id = (Math.random().toString(16) + '000000000000').slice(2, 14);
          containers.push({ id, image: img, command: '"sh"', status: sub === 'create' ? 'Created' : 'Up 1 second', ports: '—', name });
          return id;
        }
        case 'stop': case 'kill': {
          const t = containers.find(c => c.id.startsWith(target) || c.name === target);
          if (!t) return 'Error response from daemon: No such container: ' + target;
          t.status = 'Exited (0) 1 second ago';
          return target;
        }
        case 'start': case 'restart': case 'unpause': {
          const t = containers.find(c => c.id.startsWith(target) || c.name === target);
          if (!t) return 'Error response from daemon: No such container: ' + target;
          t.status = 'Up 1 second';
          return target;
        }
        case 'pause': {
          const t = containers.find(c => c.id.startsWith(target) || c.name === target);
          if (!t) return 'Error response from daemon: No such container: ' + target;
          t.status = 'Up 1 minute (Paused)';
          return target;
        }
        case 'rm': {
          const i = containers.findIndex(c => c.id.startsWith(target) || c.name === target);
          if (i < 0) return 'Error response from daemon: No such container: ' + target;
          containers.splice(i, 1);
          return target;
        }
        case 'rmi': {
          const i = images.findIndex(x => x.id.startsWith(target) || (x.repository + ':' + x.tag) === target || x.repository === target);
          if (i < 0) return 'Error: No such image: ' + target;
          const rem = images.splice(i, 1)[0];
          return 'Untagged: ' + rem.repository + ':' + rem.tag + '\nDeleted: sha256:' + rem.id;
        }
        case 'tag': {
          const p = w.slice(2).filter(x => !x.startsWith('-'));
          if (p.length >= 2) { const [repo, tag = 'latest'] = p[1].split(':'); images.push({ repository: repo, tag, id: (Math.random().toString(16) + '000000000000').slice(2, 14), size: '41.2MB' }); }
          return '';
        }
        case 'rename': {
          const p = w.slice(2); const t = containers.find(c => c.name === p[0] || c.id.startsWith(p[0]));
          if (!t) return 'Error: No such container: ' + (p[0] || '');
          if (p[1]) t.name = p[1];
          return '';
        }
        case 'logs': return '2026-02-12T06:02:11Z listening on :8080\n2026-02-12T06:03:44Z GET /health 200 3ms\n2026-02-12T06:09:19Z upstream timeout /v1/pay';
        case 'exec': return rest.includes('-it') || rest.includes('sh') || rest.includes('bash') ? '#' : 'exec: ran `' + rest + '` inside container';
        case 'attach': return '(attached to ' + (target || 'app-web-1') + ' — simulated)';
        case 'stats': return 'CONTAINER ID   NAME        CPU %   MEM USAGE / LIMIT     NET I/O\n' + containers.map(c => c.id + '   ' + c.name.padEnd(11) + ' 0.42%   48.2MiB / 3.9GiB      12.4kB / 8.1kB').join('\n');
        case 'top': return 'UID   PID   PPID  CMD\nroot  101   1     node server.js';
        case 'port': return '8080/tcp -> 0.0.0.0:8080';
        case 'diff': return 'C /tmp\nA /tmp/cache.json';
        case 'cp': return 'Successfully copied 4.1kB (' + rest + ')';
        case 'commit': return 'sha256:9f1c2ab7d4e0f3a1b2c3d4e5f6a7b8c9';
        case 'history': return 'IMAGE          CREATED        CREATED BY                      SIZE\na8758716bb6a   2 weeks ago    CMD ["nginx", "-g", "daemon"]   41.2MB';
        case 'search': return 'NAME          DESCRIPTION                    STARS   OFFICIAL\n' + (target || 'alpine').padEnd(13) + ' Minimal official image         9800    [OK]';
        case 'login': return 'Login Succeeded (sandbox)';
        case 'logout': return 'Removing login credentials for https://index.docker.io/v1/';
        case 'events': return '2026-02-12T06:58:00Z container start 3f1a2b9c7d10 (name=app-web-1)';
        case 'wait': return '0';
        case 'update': return target || 'app-web-1';
        case 'export': case 'save': return '(exported tar stream for ' + (target || 'app-web-1') + ')';
        case 'import': case 'load': return 'Loaded image: sandbox/imported:latest';
        case 'info': return 'Client: Docker Engine 26.1.4\nContainers: ' + containers.length + '\n Running: ' + containers.filter(c => /Up/.test(c.status)).length + '\nImages: ' + images.length + '\nStorage Driver: overlay2\nOperating System: Ubuntu 22.04.4 LTS';
        case 'system': {
          const s2 = w[2] || 'df';
          if (s2 === 'prune') { containers = containers.filter(c => /Up/.test(c.status)); return 'Deleted stopped containers.\nTotal reclaimed space: 128MB'; }
          if (s2 === 'info') return run('docker info');
          return 'TYPE            TOTAL     ACTIVE    SIZE      RECLAIMABLE\nImages          ' + images.length + '         2         608MB     128MB\nContainers      ' + containers.length + '         ' + containers.filter(c => /Up/.test(c.status)).length + '         14MB      0B\nLocal Volumes   2         2         84MB      0B';
        }
        case 'container': return run('docker ' + (w[2] === 'ls' ? 'ps ' + w.slice(3).join(' ') : w[2] === 'prune' ? 'system prune' : w.slice(2).join(' ')));
        case 'image': return run('docker ' + (w[2] === 'ls' ? 'images' : w[2] === 'rm' ? 'rmi ' + w.slice(3).join(' ') : w.slice(2).join(' ')));
        case 'build': case 'buildx': return ['[+] Building 2.4s (8/8) FINISHED', ' => [internal] load build definition from Dockerfile', ' => [1/3] FROM node:20-alpine', ' => [2/3] COPY package*.json ./', ' => [3/3] RUN npm ci --omit=dev', ' => exporting to image', ' => => naming to docker.io/library/app:1.5'].join('\n');
        case 'pull': {
          const [repo, tag = 'latest'] = (target || 'alpine').split(':');
          if (!images.some(x => x.repository === repo && x.tag === tag)) images.push({ repository: repo, tag, id: (Math.random().toString(16) + '000000000000').slice(2, 14), size: '64.0MB' });
          return 'Using default tag: ' + tag + '\n' + tag + ': Pulling from library/' + repo + '\nDigest: sha256:9f1c2ab7d4e0f3a1\nStatus: Downloaded newer image for ' + repo + ':' + tag;
        }
        case 'push': return 'The push refers to repository [docker.io/library/' + (target || 'app') + ']\n5f70bf18a086: Pushed\nlatest: digest: sha256:7c1e9a4f2b8d size: 1572';
        case 'network': {
          const nsub = w[2] || 'ls';
          if (nsub === 'create') return (Math.random().toString(16) + '000000000000').slice(2, 14);
          if (nsub === 'rm' || nsub === 'prune') return 'Removed network ' + (w[3] || 'unused');
          if (nsub === 'inspect') return '[{ "Name": "' + (w[3] || 'bridge') + '", "Driver": "bridge", "Scope": "local" }]';
          return 'NETWORK ID     NAME      DRIVER    SCOPE\nb1c2d3e4f5a6   bridge    bridge    local\n9a8b7c6d5e4f   host      host      local';
        }
        case 'volume': {
          const vsub = w[2] || 'ls';
          if (vsub === 'create') return w[3] || 'app_vol';
          if (vsub === 'rm' || vsub === 'prune') return 'Removed volume ' + (w[3] || 'unused');
          if (vsub === 'inspect') return '[{ "Name": "' + (w[3] || 'app_pgdata') + '", "Driver": "local" }]';
          return 'DRIVER    VOLUME NAME\nlocal     app_pgdata\nlocal     app_uploads';
        }
        case 'inspect': return '[\n  {\n    "Id": "' + (target || '3f1a2b9c7d10') + '",\n    "State": { "Status": "running", "Running": true },\n    "Config": { "Image": "app:1.4" }\n  }\n]';
        case 'compose': {
          const cs = w[2] || 'ps';
          if (cs === 'up') return '[+] Running 2/2\n ✔ Network app_default  Created\n ✔ Container app-db-1   Started\n ✔ Container app-web-1  Started';
          if (cs === 'ps') return run('docker ps');
          if (cs === 'logs') return run('docker logs');
          if (cs === 'build') return run('docker build .');
          if (cs === 'config') return 'services:\n  web:\n    image: app:1.4\n    ports: ["8080:8080"]\n  db:\n    image: postgres:16';
          return '[+] Running 2/2\n ✔ Container app-web-1  ' + (cs === 'down' ? 'Removed' : cs) + '\n ✔ Container app-db-1   ' + (cs === 'down' ? 'Removed' : cs);
        }
        case 'context': return 'NAME      DESCRIPTION                   DOCKER ENDPOINT\ndefault * Current DOCKER_HOST           unix:///var/run/docker.sock';
        case 'swarm': return 'Swarm: inactive (sandbox)';
        case 'service': case 'stack': case 'secret': return 'Docker ' + sub + ' (sandbox): no active swarm services';
        case 'version': case '-v': case '--version': return 'Client: Docker Engine 26.1.4\nServer: Docker Engine 26.1.4';
        case 'help': case '--help': case '-h': return G.formatHelp('docker', rest);
        default: return 'docker: \'' + sub + '\' is not a docker command. See \'docker --help\'.';
      }
    };
    return {
      id: 'docker', name: 'Docker', icon: '🐳', group: 'Infrastructure',
      about: 'A container runtime with real state: list, run, stop, remove, inspect, logs, build and compose. The container table changes as you work.',
      prompt: () => 'dev@dev-box:~$ ',
      run,
      snapshot: () => ({ images, containers }),
      restore: saved => {
        if (Array.isArray(saved.images)) images = saved.images;
        if (Array.isArray(saved.containers)) containers = saved.containers;
      },
      commands: [
        ['docker ps', 'running containers'],
        ['docker ps -a', 'every container, including stopped ones'],
        ['docker images', 'local images with tags and sizes'],
        ['docker run -d --name web nginx:1.25-alpine', 'start a container'],
        ['docker run -it alpine sh', 'start an interactive container'],
        ['docker stop web', 'stop a container by name'],
        ['docker start web', 'start it again'],
        ['docker rm web', 'remove a container'],
        ['docker logs app-web-1', 'container logs'],
        ['docker exec -it app-web-1 sh', 'open a shell inside'],
        ['docker inspect app-web-1', 'full container state as JSON'],
        ['docker build -t app:1.5 .', 'build an image'],
        ['docker pull postgres:16', 'download an image'],
        ['docker push app:1.5', 'publish an image'],
        ['docker network ls', 'networks'],
        ['docker volume ls', 'volumes'],
        ['docker compose up -d', 'bring up the stack'],
        ['docker compose down', 'tear it down'],
        ['docker version', 'client and server versions']
      ].map(x => ({ ex: x[0], d: x[1] }))
    };
  };

  /* ================================================================ NETWORK */
  G.makeNetwork = function ({ records = {} } = {}) {
    const execOne = (raw, stdin) => {
      const w = raw.split(/\s+/);
      const cmd = (w.shift() || '').toLowerCase();
      const a = w.join(' ');
      const host = w.find(x => !x.startsWith('-') && !(cmd === 'dig' && x.startsWith('+'))) || '10.0.0.5';
      const lookup = host.toLowerCase().replace(/\.$/, '');
      const record = Object.hasOwn(records, lookup) ? records[lookup] : null;
      const address = record?.address || '10.0.0.5';
      switch (cmd) {
        case 'nmap': return ['Starting Nmap 7.94 ( https://nmap.org )', 'Nmap scan report for ' + host, 'Host is up (0.018s latency).', 'Not shown: 997 closed tcp ports (reset)', '',
          'PORT     STATE SERVICE   VERSION', '22/tcp   open  ssh       OpenSSH 8.2p1 Ubuntu-4ubuntu0.5', '80/tcp   open  http      nginx 1.18.0', '443/tcp  open  ssl/https nginx 1.18.0', '', 'Nmap done: 1 IP address (1 host up) scanned in 2.12 seconds'].join('\n');
        case 'masscan': return 'Starting masscan 1.3.2\nDiscovered open port 22/tcp on ' + host + '\nDiscovered open port 80/tcp on ' + host + '\nDiscovered open port 443/tcp on ' + host;
        case 'ping': case 'hping3': return ['PING ' + host + ' 56(84) bytes of data.', '64 bytes from ' + host + ': icmp_seq=1 ttl=63 time=0.42 ms', '64 bytes from ' + host + ': icmp_seq=2 ttl=63 time=0.39 ms', '', '--- ' + host + ' ping statistics ---', '2 packets transmitted, 2 received, 0% packet loss'].join('\n');
        case 'dig': return w.includes('+short') ? address : ['; <<>> DiG 9.18.24 <<>> ' + host + ' A', ';; QUESTION SECTION:', ';' + lookup + '. IN A', '', ';; ANSWER SECTION:', lookup + '. ' + (record?.ttl ?? 300) + ' IN A ' + address, '', ';; Query time: 4 msec'].join('\n');
        case 'nslookup': return 'Server:  10.0.0.9\nAddress: 10.0.0.9#53\n\nName:    ' + host + '\nAddress: ' + address;
        case 'host': return host + ' has address ' + address + (record ? '' : '\n' + host + ' mail is handled by 10 mail.' + host + '.');
        case 'resolvectl': return 'Link 2 (eth0)\n  DNS Servers: 10.0.0.9\n  DNS Domain: internal';
        case 'curl': case 'wget': {
          const url = w.find(x => /^https?:/.test(x)) || 'http://' + host;
          return ['* Trying ' + (url.match(/\/\/([^/:]+)/) || [])[1] + '...', '* Connected', '> GET ' + url + ' HTTP/1.1', '> Host: ' + (url.match(/\/\/([^/:]+)/) || [])[1], '< HTTP/1.1 200 OK', '< Content-Type: application/json', '{ "status": "ok", "service": "api" }'].join('\n');
        }
        case 'traceroute': case 'tracepath': case 'mtr': return ['traceroute to ' + host + ' (10.0.0.5), 30 hops max', ' 1  gateway (10.0.0.9)  0.412 ms  0.388 ms', ' 2  core-1.internal (10.0.1.1)  1.204 ms  1.188 ms', ' 3  ' + host + ' (10.0.0.5)  2.010 ms  1.997 ms'].join('\n');
        case 'netstat': return 'Proto Recv-Q Send-Q Local Address           Foreign Address         State\n tcp        0      0 0.0.0.0:22              0.0.0.0:*               LISTEN\n tcp        0      0 0.0.0.0:80              0.0.0.0:*               LISTEN\n tcp        0      0 10.0.0.5:49822          20.42.65.90:443         ESTABLISHED\n tcp        0      0 10.0.0.5:22             10.0.0.9:51222          ESTABLISHED';
        case 'ss': return 'Netid State  Local Address:Port   Peer Address:Port\n tcp   LISTEN 0.0.0.0:22           0.0.0.0:*\n tcp   LISTEN 0.0.0.0:80           0.0.0.0:*\n tcp   ESTAB  10.0.0.5:49822       20.42.65.90:443';
        case 'ip': return a.startsWith('r') ? 'default via 10.0.0.9 dev eth0\n10.0.0.0/24 dev eth0 proto kernel scope link src 10.0.0.5' : '1: lo: <LOOPBACK,UP> mtu 65536\n    inet 127.0.0.1/8 scope host lo\n2: eth0: <BROADCAST,MULTICAST,UP> mtu 1500\n    inet 10.0.0.5/24 brd 10.0.0.255 scope global eth0';
        case 'ifconfig': case 'iwconfig': return 'eth0: flags=4163<UP,BROADCAST,RUNNING,MULTICAST>  mtu 1500\n        inet 10.0.0.5  netmask 255.255.255.0  broadcast 10.0.0.255\n        ether 52:54:00:12:34:56  txqueuelen 1000 (Ethernet)';
        case 'route': return 'Kernel IP routing table\nDestination     Gateway         Genmask         Iface\n0.0.0.0         10.0.0.9        0.0.0.0         eth0\n10.0.0.0        0.0.0.0         255.255.255.0   eth0';
        case 'arp': return 'Address       HWtype  HWaddress           Flags Mask            Iface\n10.0.0.9      ether   52:54:00:12:34:56   C                     eth0\n10.0.0.20     ether   52:54:00:9a:bc:de   C                     eth0';
        case 'ethtool': return 'Settings for eth0:\n\tSpeed: 1000Mb/s\n\tDuplex: Full\n\tLink detected: yes';
        case 'nmcli': return 'DEVICE  TYPE      STATE      CONNECTION\neth0    ethernet  connected  Wired connection 1';
        case 'whois': return 'Domain Name: ' + host.toUpperCase() + '\nRegistrar: Example Registrar Inc.\nCreation Date: 2019-04-02\nRegistry Expiry Date: 2027-04-02\nName Server: NS1.EXAMPLE.NET';
        case 'openssl': return ['CONNECTED(00000003)', 'depth=1 C = US, O = Example CA, CN = Example Intermediate', 'verify return:1', 'depth=0 CN = ' + host, 'verify return:1', '---', 'Certificate chain', ' 0 s:CN = ' + host, '   i:C = US, O = Example CA, CN = Example Intermediate', '---', 'SSL handshake has read 3120 bytes and written 412 bytes', 'New, TLSv1.3, Cipher is TLS_AES_256_GCM_SHA384', 'Verify return code: 0 (ok)'].join('\n');
        case 'ssh': return 'The authenticity of host \'' + (a.split('@').pop() || host) + '\' can\'t be established.\nED25519 key fingerprint is SHA256:4d1fV8jQ2m0nLb7cR9pYs6tK3wEa5hG0.\nWarning: Permanently added to the list of known hosts.\n(playground: no real session opens)';
        case 'nc': case 'ncat': case 'netcat': case 'socat': case 'telnet': return 'Connection to ' + host + ' ' + (w[1] || '80') + ' port [tcp/*] succeeded! (simulated)';
        case 'ftp': case 'sftp': case 'scp': case 'rsync': return 'Connected to ' + host + ' via ' + cmd.toUpperCase() + ' (simulated).';
        case 'tcpdump': case 'tshark': return '06:58:10.104 IP 10.0.0.5.49822 > 20.42.65.90.443: Flags [P.], seq 1:64, ack 1, length 63\n06:58:10.118 IP 20.42.65.90.443 > 10.0.0.5.49822: Flags [.], ack 64, length 0\n2 packets captured (sandbox)';
        case 'iptables': case 'nft': return 'Chain INPUT (policy ACCEPT)\nACCEPT  tcp -- 0.0.0.0/0 0.0.0.0/0 tcp dpt:22\nACCEPT  tcp -- 0.0.0.0/0 0.0.0.0/0 tcp dpt:443';
        case 'ufw': case 'firewall-cmd': return 'Status: active\n22/tcp ALLOW Anywhere\n80/tcp ALLOW Anywhere\n443/tcp ALLOW Anywhere';
        case 'nikto': return '- Nikto v2.5.0 (sandbox)\n+ Target IP: ' + host + '\n+ Server: nginx/1.18.0\n+ /robots.txt found\n+ X-Frame-Options header is not present';
        case 'gobuster': case 'ffuf': case 'dirb': return 'Gobuster/DirScan (sandbox) on ' + host + '\n/health               (Status: 200) [Size: 31]\n/robots.txt           (Status: 200) [Size: 48]\n/admin                (Status: 403) [Size: 152]';
        case 'whatweb': return 'http://' + host + ' [200 OK] nginx[1.18.0], Country[INTERNAL], IP[' + host + ']';
        case 'enum4linux': case 'smbclient': case 'rpcclient': return 'SMB/RPC probe against ' + host + ' (sandbox): Sharename: IPC$ (IPC Service), anonymous listing disabled';
        case 'snmpwalk': return 'SNMPv2-MIB::sysDescr.0 = STRING: Linux dev-box 5.15.0\nSNMPv2-MIB::sysName.0 = STRING: dev-box';
        case 'ldapsearch': return 'dn: dc=internal,dc=local\nobjectClass: domain\ndc: internal';
        case 'hydra': return 'Hydra (sandbox simulation): offline training only — no live brute-force performed.';
        case 'wg': case 'openvpn': return 'interface: wg0\n  listening port: 51820\n  peer: sandbox-gateway (10.8.0.1/32)';
        case 'hostname': return 'probe.internal';
        case 'grep': {
          if (stdin == null) return 'grep: pipe output into grep (e.g. nmap 10.0.0.5 | grep open)';
          const pat = w.find(x => !x.startsWith('-')) || '';
          return stdin.split('\n').filter(l => new RegExp(pat, 'i').test(l)).join('\n');
        }
        case 'clear': case 'cls': case 'reset': return '';
        case 'help': return G.formatHelp('network', w);
        default: return 'bash: ' + cmd + ': command not found (try help)';
      }
    };
    const run = line => {
      const raw = String(line == null ? '' : line).trim();
      if (!raw) return '';
      let stdin = null, out = '';
      for (const seg of G.splitTop(raw, ['|'])) {
        out = execOne(seg, stdin);
        stdin = out;
      }
      return out;
    };
    return {
      id: 'network', name: 'Network', icon: '🌐', group: 'Network',
      about: 'The recon and connectivity toolbox: nmap, ping, dig, curl, traceroute, sockets, TLS handshakes and ssh — all with realistic output.',
      prompt: () => 'net@probe:~$ ',
      run,
      commands: [
        ['nmap -sV 10.0.0.5', 'service and version scan'],
        ['ping 10.0.0.5', 'ICMP reachability'],
        ['dig api.internal', 'DNS answer section'],
        ['nslookup api.internal', 'resolver lookup'],
        ['curl https://api.internal/health', 'HTTP request with headers'],
        ['traceroute 10.0.0.5', 'the path packets take'],
        ['netstat -antp', 'every socket and its state'],
        ['ss -tulpn', 'listening ports'],
        ['arp -a', 'local neighbour cache'],
        ['whois example.internal', 'domain registration'],
        ['openssl s_client -connect api.internal:443', 'TLS handshake and chain'],
        ['ssh dev@10.0.0.5', 'remote shell (simulated)'],
        ['help', 'every command this sandbox supports']
      ].map(x => ({ ex: x[0], d: x[1] }))
    };
  };

  /* ================================================================ ENCODING / CRYPTO */
  G.makeCrypto = function () {
    const morse = { A: '.-', B: '-...', C: '-.-.', D: '-..', E: '.', F: '..-.', G: '--.', H: '....', I: '..', J: '.---', K: '-.-', L: '.-..', M: '--', N: '-.', O: '---', P: '.--.', Q: '--.-', R: '.-.', S: '...', T: '-', U: '..-', V: '...-', W: '.--', X: '-..-', Y: '-.--', Z: '--..', 0: '-----', 1: '.----', 2: '..---', 3: '...--', 4: '....-', 5: '.....', 6: '-....', 7: '--...', 8: '---..', 9: '----.' };
    const back = Object.fromEntries(Object.entries(morse).map(([k, v]) => [v, k]));
    const b64e = s => (typeof btoa === 'function' ? btoa(s) : Buffer.from(s, 'utf8').toString('base64'));
    const b64d = s => (typeof atob === 'function' ? atob(s) : Buffer.from(s, 'base64').toString('utf8'));
    const hex = s => [...s].map(c => c.charCodeAt(0).toString(16).padStart(2, '0')).join('');
    const unhex = s => { const h = s.replace(/[^0-9a-f]/gi, ''); let o = ''; for (let i = 0; i + 1 < h.length; i += 2) o += String.fromCharCode(parseInt(h.slice(i, i + 2), 16)); return o; };
    const bin = s => [...s].map(c => c.charCodeAt(0).toString(2).padStart(8, '0')).join(' ');
    const unbin = s => s.trim().split(/\s+/).map(b => String.fromCharCode(parseInt(b, 2))).join('');
    const b64url = s => b64e(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
    const argText = (a, stdin) => {
      const t = a.join(' ');
      return t || (stdin == null ? '' : stdin);
    };
    const B32 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
    const b32e = s => {
      let bits = '', out = '';
      for (const c of s) bits += c.charCodeAt(0).toString(2).padStart(8, '0');
      while (bits.length % 5) bits += '0';
      for (let i = 0; i < bits.length; i += 5) out += B32[parseInt(bits.slice(i, i + 5), 2)];
      while (out.length % 8) out += '=';
      return out;
    };
    const b32d = s => {
      let bits = '', out = '';
      for (const c of s.toUpperCase().replace(/=+$/, '')) { const i = B32.indexOf(c); if (i >= 0) bits += i.toString(2).padStart(5, '0'); }
      for (let i = 0; i + 8 <= bits.length; i += 8) out += String.fromCharCode(parseInt(bits.slice(i, i + 8), 2));
      return out;
    };
    const B58 = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';
    const b58e = s => {
      const bytes = [...s].map(c => c.charCodeAt(0));
      const digits = [0];
      for (const b of bytes) {
        let carry = b;
        for (let j = 0; j < digits.length; j++) { carry += digits[j] << 8; digits[j] = carry % 58; carry = (carry / 58) | 0; }
        while (carry) { digits.push(carry % 58); carry = (carry / 58) | 0; }
      }
      return digits.reverse().map(d => B58[d]).join('');
    };
    const NATO = { A: 'Alpha', B: 'Bravo', C: 'Charlie', D: 'Delta', E: 'Echo', F: 'Foxtrot', G: 'Golf', H: 'Hotel', I: 'India', J: 'Juliet', K: 'Kilo', L: 'Lima', M: 'Mike', N: 'November', O: 'Oscar', P: 'Papa', Q: 'Quebec', R: 'Romeo', S: 'Sierra', T: 'Tango', U: 'Uniform', V: 'Victor', W: 'Whiskey', X: 'X-ray', Y: 'Yankee', Z: 'Zulu' };
    const hashSim = (algo, s) => {
      let h1 = 0x811c9dc5, h2 = 0x9e3779b9, out = '';
      for (let i = 0; i < s.length; i++) {
        h1 = Math.imul(h1 ^ (s.charCodeAt(i) + algo.charCodeAt(i % algo.length)), 0x01000193) >>> 0;
        h2 = Math.imul(h2 ^ (s.charCodeAt(i) + i), 0x85ebca6b) >>> 0;
      }
      let seed = (h1 ^ h2) >>> 0;
      const len = algo === 'md5' ? 32 : algo === 'sha1' ? 40 : algo === 'sha512' ? 128 : algo === 'crc32' ? 8 : 64;
      while (out.length < len) { seed = (Math.imul(seed ^ (seed >>> 15), 0x2c1b3c6d) + 0x297a2d39) >>> 0; out += seed.toString(16).padStart(8, '0'); }
      return out.slice(0, len);
    };
    const execOne = (raw, stdin) => {
      const w = raw.split(/\s+/);
      const cmd = (w.shift() || '').toLowerCase();
      const dec = w.includes('-d') || w.includes('--decode');
      let rest = w.filter(x => x !== '-d' && x !== '--decode').join(' ');
      if (/^(".*"|'.*')$/.test(rest)) rest = rest.slice(1, -1);
      const input = rest || (stdin == null ? '' : stdin);
      switch (cmd) {
        case 'base64': try { return dec ? b64d(input) : b64e(input); } catch (e) { return 'base64: invalid input'; }
        case 'base64url': try { return dec ? b64d(input.replace(/-/g, '+').replace(/_/g, '/')) : b64url(input); } catch (e) { return 'base64url: invalid input'; }
        case 'base32': return dec ? b32d(input) : b32e(input);
        case 'base58': return b58e(input);
        case 'hex': case 'xxd': return dec || w.includes('-r') ? unhex(input) : hex(input);
        case 'binary': return dec ? unbin(input) : bin(input);
        case 'decimal': case 'dec': case 'ascii': return dec ? input.trim().split(/\s+/).map(n => String.fromCharCode(parseInt(n, 10))).join('') : [...input].map(c => c.charCodeAt(0)).join(' ');
        case 'octal': case 'oct': return dec ? input.trim().split(/\s+/).map(n => String.fromCharCode(parseInt(n, 8))).join('') : [...input].map(c => c.charCodeAt(0).toString(8).padStart(3, '0')).join(' ');
        case 'ord': return input ? String(input.charCodeAt(0)) : '';
        case 'chr': return String.fromCharCode(parseInt(input, 10) || 0);
        case 'url': return dec ? decodeURIComponent(input) : encodeURIComponent(input);
        case 'html': return dec ? input.replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&amp;/g, '&') : input.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
        case 'unicode': return dec ? input.replace(/\\u([0-9a-f]{4})/gi, (_, h) => String.fromCharCode(parseInt(h, 16))) : [...input].map(c => '\\u' + c.charCodeAt(0).toString(16).padStart(4, '0')).join('');
        case 'rot13': return [...input].map(c => /[a-z]/i.test(c) ? String.fromCharCode((c <= 'Z' ? 65 : 97) + (c.charCodeAt(0) - (c <= 'Z' ? 65 : 97) + 13) % 26) : c).join('');
        case 'rot47': return [...input].map(c => { const n = c.charCodeAt(0); return n >= 33 && n <= 126 ? String.fromCharCode(33 + (n - 33 + 47) % 94) : c; }).join('');
        case 'atbash': return [...input].map(c => /[a-z]/.test(c) ? String.fromCharCode(219 - c.charCodeAt(0)) : /[A-Z]/.test(c) ? String.fromCharCode(155 - c.charCodeAt(0)) : c).join('');
        case 'vigenere': {
          const p = w.filter(x => x !== '-d' && x !== '--decode');
          const key = (p[0] || 'KEY').toUpperCase().replace(/[^A-Z]/g, '') || 'A';
          const text = p.slice(1).join(' ').replace(/^["']|["']$/g, '') || stdin || '';
          let ki = 0;
          return [...text].map(c => {
            if (!/[a-z]/i.test(c)) return c;
            const base = c <= 'Z' ? 65 : 97, shift = key.charCodeAt(ki++ % key.length) - 65;
            return String.fromCharCode(base + (c.charCodeAt(0) - base + (dec ? 26 - shift : shift)) % 26);
          }).join('');
        }
        case 'xor': {
          const p = w.filter(x => !x.startsWith('-'));
          const key = p[0] || '42', text = p.slice(1).join(' ').replace(/^["']|["']$/g, '') || stdin || '';
          const kn = /^\d+$/.test(key) ? parseInt(key, 10) : key.charCodeAt(0);
          return [...text].map((c, i) => String.fromCharCode(c.charCodeAt(0) ^ (/^\d+$/.test(key) ? kn : key.charCodeAt(i % key.length)))).join('');
        }
        case 'nato': return [...input.toUpperCase()].map(c => NATO[c] || c).join(' ');
        case 'reverse': case 'rev': return [...input].reverse().join('');
        case 'upper': return input.toUpperCase();
        case 'lower': return input.toLowerCase();
        case 'morse':
          if (dec) return input.trim().split(/\s+/).map(x => back[x] || (x === '/' ? ' ' : '')).join('');
          return [...input.toUpperCase()].map(c => morse[c] || (c === ' ' ? '/' : '')).join(' ');
        case 'jwt': {
          const parts = (rest || input).split('.');
          if (parts.length < 2) return 'usage: jwt <header.payload.signature>';
          const dec2 = p => { try { return JSON.stringify(JSON.parse(b64d(p.replace(/-/g, '+').replace(/_/g, '/'))), null, 2); } catch (e) { return '(unreadable segment)'; } };
          return 'header:\n' + dec2(parts[0]) + '\n\npayload:\n' + dec2(parts[1]) + '\n\nsignature: ' + (parts[2] || '(none)') + '\n\n(note: decoding does not verify the signature)';
        }
        case 'caesar': {
          const mm = raw.match(/^caesar\s+(-?\d+)\s+([\s\S]+)$/i);
          const n = mm ? parseInt(mm[1], 10) : 3;
          const text = mm ? mm[2].replace(/^["']|["']$/g, '') : input;
          return [...text].map(c => /[a-z]/.test(c) ? String.fromCharCode((c.charCodeAt(0) - 97 + ((n % 26) + 26)) % 26 + 97)
            : /[A-Z]/.test(c) ? String.fromCharCode((c.charCodeAt(0) - 65 + ((n % 26) + 26)) % 26 + 65) : c).join('');
        }
        case 'md5': case 'sha1': case 'sha256': case 'sha512': case 'crc32': return hashSim(cmd, input);
        case 'hmac': return hashSim('sha256', (w[0] || 'key') + ':' + (w.slice(1).join(' ') || stdin || ''));
        case 'uuid': return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => { const r = Math.random() * 16 | 0; return (c === 'x' ? r : (r & 0x3 | 0x8)).toString(16); });
        case 'random': { const n = Math.min(128, parseInt(input, 10) || 16); return Array.from({ length: n }, () => Math.floor(Math.random() * 256).toString(16).padStart(2, '0')).join(''); }
        case 'entropy': {
          if (!input) return '0.00 bits/char';
          const freq = {}; for (const c of input) freq[c] = (freq[c] || 0) + 1;
          let h = 0; for (const k in freq) { const p = freq[k] / input.length; h -= p * Math.log2(p); }
          return h.toFixed(3) + ' bits/char (total ' + (h * input.length).toFixed(1) + ' bits)';
        }
        case 'freq': {
          const freq = {}; for (const c of input) freq[c] = (freq[c] || 0) + 1;
          return Object.entries(freq).sort((a, b) => b[1] - a[1]).map(([k, v]) => JSON.stringify(k) + ': ' + v).join('\n');
        }
        case 'strings': return (input.match(/[\x20-\x7e]{4,}/g) || []).join('\n');
        case 'echo': return input;
        case 'len': return String([...input].length);
        case 'clear': case 'cls': case 'reset': return '';
        case 'help': return G.formatHelp('crypto', w);
        default: return 'bash: ' + cmd + ': command not found (try help)';
      }
    };
    const run = (line, stdin) => {
      const raw = String(line == null ? '' : line).trim();
      if (!raw) return '';
      let cur = stdin, out = '';
      for (const seg of G.splitTop(raw, ['|'])) {
        out = execOne(seg, cur);
        cur = out;
      }
      return out;
    };
    return {
      id: 'crypto', name: 'Encoding', icon: '🔤', group: 'Tools',
      about: 'Base64, hex, binary, URL encoding, ROT13, Caesar, Morse and JWT decoding — all computed live, so you can paste anything and see what it really is.',
      prompt: () => 'codec$ ',
      run,
      commands: [
        ['base64 "the password is hunter2"', 'Base64 encode'],
        ['base64 -d dGhlIHBhc3N3b3JkIGlzIGh1bnRlcjI=', 'Base64 decode'],
        ['hex "hello"', 'hex encode'],
        ['hex -d 68 65 6c 6c 6f', 'hex decode'],
        ['binary "hi"', 'binary encode'],
        ['binary -d 01101000 01101001', 'binary decode'],
        ['url "a b&c=d"', 'percent-encode'],
        ['url -d a%20b%26c%3Dd', 'percent-decode'],
        ['rot13 "Uryyb, jbeyq"', 'ROT13'],
        ['caesar 3 "attack at dawn"', 'Caesar shift'],
        ['morse "SOS"', 'Morse encode'],
        ['morse -d ... --- ...', 'Morse decode'],
        ['reverse "terminal"', 'reverse a string'],
        ['jwt eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiJkZXYiLCJyb2xlIjoiYWRtaW4ifQ.abc123', 'decode a JWT without verifying it'],
        ['len "terminal"', 'count characters'],
        ['help', 'every encoding this sandbox supports']
      ].map(x => ({ ex: x[0], d: x[1] }))
    };
  };

  G.makeSql && (G.shells = []);
  G.shells = [
    G.makeBash(), G.makePowershell(), G.makeCmd(), G.makePython(), G.makeNode(),
    G.makeSql(), G.makeGit(), G.makeDocker(), G.makeNetwork(), G.makeCrypto()
  ];
})();

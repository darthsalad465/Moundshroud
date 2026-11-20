// Labyrinth — code, data, history, container and network rooms.
(function () {
  const L = window.TerminalLabyrinth;
  const TP = window.TerminalPlayground;
  if (!L) return;
  const { rnd, tier, newToken, encoders } = L;
  const pick = (r, a) => a[r(a.length)];
  const shuffle = (a, r) => { const x = a.slice(); for (let i = x.length - 1; i > 0; i--) { const j = r(i + 1); [x[i], x[j]] = [x[j], x[i]]; } return x; };
  const num = n => Number.isInteger(n) ? String(n) : String(Math.round(n * 100) / 100);

  /* ================================================================ PYTHON ROOM */
  function pyRoom(d, r) {
    const t = tier(d);
    const n = 5 + Math.min(24, d * 2);
    const nums = Array.from({ length: n }, () => 2 + r(90));
    const second = Array.from({ length: 4 + t }, () => 10 + r(50));
    const kind = pick(r, t < 2 ? ['sum', 'countgt'] : ['sum', 'countgt', 'evens', 'maxmin', 'twice']);
    let answer, brief, walkthrough, hint;
    if (kind === 'sum') {
      answer = String(nums.reduce((a, b) => a + b, 0));
      brief = 'data.txt holds one integer per line. The key is the sum of every value.';
      walkthrough = ['sum(read())'];
      hint = "read() returns the numbers: type sum(read())";
    } else if (kind === 'countgt') {
      const x = 30 + r(50);
      answer = String(nums.filter(v => v > x).length);
      brief = 'data.txt holds one integer per line. The key is how many values are greater than ' + x + '.';
      walkthrough = ['len([n for n in read() if n > ' + x + '])'];
      hint = 'len([n for n in read() if n > ' + x + '])';
    } else if (kind === 'evens') {
      answer = String(nums.filter(v => v % 2 === 0).reduce((a, b) => a + b, 0));
      brief = 'data.txt holds one integer per line. The key is the sum of the even values only.';
      walkthrough = ['sum([n for n in read() if n % 2 == 0])'];
      hint = 'sum([n for n in read() if n % 2 == 0])';
    } else if (kind === 'maxmin') {
      answer = String(Math.max(...nums) - Math.min(...nums));
      brief = 'data.txt holds one integer per line. The key is the largest value minus the smallest.';
      walkthrough = ['max(read()) - min(read())'];
      hint = 'max(read()) - min(read())';
    } else {
      answer = String(nums.reduce((a, b) => a + b, 0) + second.reduce((a, b) => a + b, 0));
      brief = 'data.txt and weights.txt each hold one integer per line. The key is the sum of both files.';
      walkthrough = ['sum(read()) + sum(read2())'];
      hint = 'sum(read()) + sum(read2())';
    }
    const files = { 'data.txt': nums.join('\n'), 'weights.txt': second.join('\n'), 'README.txt': 'This room is a Python prompt. read() -> list from data.txt, read2() -> weights.txt.\nUse the language: sum, len, min, max, comprehensions.' };
    const H = {
      len: x => (x == null ? 0 : x.length != null ? x.length : Object.keys(x).length),
      sum: a => a.reduce((x, y) => x + y, 0),
      min: a => Math.min(...(Array.isArray(a) ? a : [a])),
      max: a => Math.max(...(Array.isArray(a) ? a : [a])),
      abs: Math.abs, round: (x, p) => p == null ? Math.round(x) : +x.toFixed(p),
      sorted: a => a.slice().sort((x, y) => x - y),
      range: (...a) => { const [s, e] = a.length === 1 ? [0, a[0]] : a; const out = []; for (let i = s; i < e; i++) out.push(i); return out; },
      int: x => parseInt(x, 10), float: x => parseFloat(x), str: x => String(x),
      type: x => Array.isArray(x) ? 'list' : typeof x === 'number' ? (Number.isInteger(x) ? 'int' : 'float') : typeof x,
      list: x => Array.from(x || [])
    };
    const ev = expr => {
      let js = expr.replace(/\bTrue\b/g, 'true').replace(/\bFalse\b/g, 'false').replace(/\bNone\b/g, 'null');
      js = js.replace(/\[([^[\]]+?)\s+for\s+(\w+)\s+in\s+([^[\]]+?)\s+if\s+([^[\]]+?)\]/g, (m, e, v, it, cond) => '(' + it + ').filter(function(' + v + ') { return ' + cond + '; }).map(function(' + v + ') { return ' + e + '; })');
      js = js.replace(/\[([^[\]]+?)\s+for\s+(\w+)\s+in\s+([^[\]]+?)\]/g, (m, e, v, it) => '(' + it + ').map(function(' + v + ') { return ' + e + '; })');
      const names = Object.keys(H).concat(['read', 'read2']);
      const fn = new Function(...names, 'return (' + js + ');');
      return fn(...names.map(n2 => ({ read: () => nums.slice(), read2: () => second.slice() }[n2] || H[n2])));
    };
    const C = {};
    C.ls = () => Object.keys(files).join('  ');
    C.cat = a => files[a[0]] == null ? 'cat: ' + (a[0] || '') + ': No such file' : files[a[0]];
    C.help = a => {
      const TP = window.TerminalPlayground;
      const base = TP && TP.formatHelp ? TP.formatHelp('python', a) : 'Python room: ls, cat <file>, read(), read2(), sum(), len(), min(), max(), sorted(), range()';
      if (a && a.length) return base;
      return base + '\n\n── ROOM HELPERS ──\n  ls / cat <file>                       list room files or inspect raw contents\n  read() / read2()                      return integer lists from data.txt / weights.txt';
    };
    C.print = a => String(a.join(' '));
    const vars = {};
    const pyRepr = v => Array.isArray(v) ? '[' + v.map(pyRepr).join(', ') + ']' : typeof v === 'string' ? "'" + v + "'" : v === true ? 'True' : v === false ? 'False' : v == null ? 'None' : String(v);
    const ev2 = expr => {
      let js = expr.replace(/\bTrue\b/g, 'true').replace(/\bFalse\b/g, 'false').replace(/\bNone\b/g, 'null').replace(/\bnot\b/g, '!').replace(/\band\b/g, '&&').replace(/\bor\b/g, '||');
      js = js.replace(/\[([^[\]]+?)\s+for\s+(\w+)\s+in\s+([^[\]]+?)\s+if\s+([^[\]]+?)\]/g, (m, e, v, it, cond) => '(' + it + ').filter(function(' + v + ') { return ' + cond + '; }).map(function(' + v + ') { return ' + e + '; })');
      js = js.replace(/\[([^[\]]+?)\s+for\s+(\w+)\s+in\s+([^[\]]+?)\]/g, (m, e, v, it) => '(' + it + ').map(function(' + v + ') { return ' + e + '; })');
      if (js.includes('//')) js = js.replace(/([A-Za-z0-9_.)\]]+)\s*\/\/\s*([A-Za-z0-9_.(\[]+)/g, 'Math.floor(($1)/($2))');
      const extra = Object.assign({ read: () => nums.slice(), read2: () => second.slice(), math: Math, json: { dumps: JSON.stringify, loads: JSON.parse }, statistics: { mean: a => a.reduce((x, y) => x + y, 0) / a.length } }, H, vars);
      const names = Object.keys(extra);
      return new Function(...names, 'return (' + js + ');')(...names.map(k => extra[k]));
    };
    function run(raw) {
      const s = String(raw || '').trim();
      const words = s.split(/\s+/);
      const head = words[0];
      if (head === 'ls' || head === 'cat' || head === 'help') return C[head](words.slice(1));
      if (/^import\s+\w+$/.test(s)) return '';
      try {
        const pr = s.match(/^print\s*\(([\s\S]*)\)$/);
        if (pr) return String(ev2(pr[1]));
        const asg = s.match(/^([A-Za-z_]\w*)\s*=\s*([\s\S]+)$/);
        if (asg && !s.startsWith(asg[1] + ' ==')) { vars[asg[1]] = ev2(asg[2]); return pyRepr(vars[asg[1]]); }
        return pyRepr(ev2(s));
      } catch (e) { return (e && e.name ? e.name : 'Error') + ': ' + (e && e.message || e); }
    }
    return {
      kind: 'computation', answer, brief, hint, walkthrough,
      title: 'Labyrinth ' + d + ' · python warren',
      prompt: () => '>>> ', palette: [['read()', 'the numbers in data.txt'], ['sum(read())', 'sum them'], ['len(read())', 'how many'], ['cat README.txt', 'room notes'], ['ls', 'list files'], ['solve <answer>', 'descend']],
      snapshot: () => TP.snapshotVariables(vars),
      restore: state => TP.replaceSavedObject(vars, state),
      run, cmds: C
    };
  }

  /* ================================================================ NODE ROOM */
  function nodeRoom(d, r) {
    const t = tier(d);
    const n = 5 + Math.min(24, d * 2);
    const nums = Array.from({ length: n }, () => 2 + r(90));
    const kind = pick(r, t < 2 ? ['sum', 'countgt'] : ['sum', 'countgt', 'evens', 'maxmin', 'double']);
    let answer, brief, walkthrough;
    if (kind === 'sum') {
      answer = String(nums.reduce((a, b) => a + b, 0));
      brief = 'data.json holds an array of integers. The key is the sum of every value.';
      walkthrough = ['read().reduce((a, b) => a + b, 0)'];
    } else if (kind === 'countgt') {
      const x = 30 + r(50);
      answer = String(nums.filter(v => v > x).length);
      brief = 'data.json holds an array of integers. The key is how many values are greater than ' + x + '.';
      walkthrough = ['read().filter(n => n > ' + x + ').length'];
    } else if (kind === 'evens') {
      answer = String(nums.filter(v => v % 2 === 0).reduce((a, b) => a + b, 0));
      brief = 'data.json holds an array of integers. The key is the sum of the even values.';
      walkthrough = ['read().filter(n => n % 2 === 0).reduce((a, b) => a + b, 0)'];
    } else if (kind === 'maxmin') {
      answer = String(Math.max(...nums) - Math.min(...nums));
      brief = 'data.json holds an array of integers. The key is the largest value minus the smallest.';
      walkthrough = ['Math.max(...read()) - Math.min(...read())'];
    } else {
      answer = String(nums.reduce((a, b) => a + b, 0) * 2);
      brief = 'data.json holds an array of integers. The key is twice the sum of the array.';
      walkthrough = ['read().reduce((a, b) => a + b, 0) * 2'];
    }
    const files = { 'data.json': JSON.stringify(nums), 'README.txt': 'Node REPL. read() returns the array from data.json. Everything else is JavaScript.' };
    const H = {
      read: () => nums.slice(),
      sum: a => a.reduce((x, y) => x + y, 0),
      len: a => a.length,
      rand: () => 0.42
    };
    const C = {};
    C.ls = () => Object.keys(files).join('  ');
    C.cat = a => files[a[0]] == null ? 'cat: ' + (a[0] || '') + ': No such file' : files[a[0]];
    C.help = a => {
      const TP = window.TerminalPlayground;
      const base = TP && TP.formatHelp ? TP.formatHelp('node', a) : 'Node room: ls, cat <file>, read(), JavaScript expressions';
      if (a && a.length) return base;
      return base + '\n\n── ROOM HELPERS ──\n  ls / cat <file>                       list room files or inspect raw contents\n  read()                                return the parsed array from data.json';
    };
    const nVars = {};
    const repr = v => typeof v === 'string' ? "'" + v + "'" : typeof v === 'function' ? '[Function]' : JSON.stringify(v);
    function run(raw) {
      const s = String(raw || '').trim();
      const words = s.split(/\s+/);
      const head = words[0];
      if (head === 'ls' || head === 'cat' || head === 'help') return C[head](words.slice(1));
      try {
        const logs = [];
        const envObj = Object.assign({}, H, nVars);
        const names = Object.keys(envObj);
        const decl = s.match(/^(?:const|let|var)\s+([A-Za-z_$][\w$]*)\s*=\s*([\s\S]+)$/);
        const expr = (decl ? decl[2] : s).replace(/;\s*$/, '');
        const fn = new Function(...names, 'JSON', 'Math', 'console', 'return (' + expr + ');');
        const res = fn(...names.map(k => envObj[k]), JSON, Math, { log: (...a) => { const line = a.map(x => typeof x === 'string' ? x : JSON.stringify(x)).join(' '); logs.push(line); return line; } });
        if (decl) nVars[decl[1]] = res;
        return logs.length ? logs.join('\n') : repr(res);
      } catch (e) { return (e && e.name || 'Error') + ': ' + (e && e.message || e); }
    }
    return {
      kind: 'computation', answer, brief, walkthrough,
      hint: walkthrough[0],
      title: 'Labyrinth ' + d + ' · node warren',
      prompt: () => '> ', palette: [['read()', 'the array in data.json'], ['read().length', 'how many'], ['cat data.json', 'raw data'], ['ls', 'list files'], ['read().reduce((a, b) => a + b, 0)', 'sum it'], ['solve <answer>', 'descend']],
      snapshot: () => TP.snapshotVariables(nVars),
      restore: state => TP.replaceSavedObject(nVars, state),
      run, cmds: C
    };
  }

  /* ================================================================ SQL ROOM */
  function sqlRoom(d, r) {
    const t = tier(d);
    const accounts = [];
    const orders = [];
    const sessions = [];
    const names = ['maya', 'dev', 'sam', 'nina', 'alex', 'ravi', 'jo', 'kim'];
    const roles = ['admin', 'engineer', 'analyst', 'ops'];
    for (let i = 1; i <= 6 + Math.min(6, t); i++) accounts.push([i, pick(r, names) + i, pick(r, roles), r(4) ? 1 : 0]);
    for (let i = 1; i <= 8 + Math.min(10, d); i++) orders.push([1000 + i, 1 + r(accounts.length), 20 + r(480), pick(r, ['paid', 'pending', 'refunded'])]);
    for (let i = 1; i <= 6 + Math.min(8, d); i++) sessions.push([500 + i, 1 + r(accounts.length), 2 + r(120), r(4) ? 1 : 0]);
    const db = {
      accounts: { cols: ['id', 'name', 'role', 'active'], rows: accounts },
      orders: { cols: ['id', 'account_id', 'total', 'status'], rows: orders },
      sessions: { cols: ['id', 'account_id', 'minutes', 'ok'], rows: sessions }
    };
    const kinds = t < 2 ? ['sum', 'count'] : ['sum', 'count', 'avg', 'max', 'sum2'];
    const kind = pick(r, kinds);
    let answer, task, query;
    const paid = orders.filter(o => o[3] === 'paid');
    if (kind === 'sum') {
      const total = paid.reduce((a, o) => a + o[2], 0);
      answer = num(total);
      task = 'the total of every order with status \'paid\'';
      query = "SELECT SUM(total) FROM orders WHERE status = 'paid';";
    } else if (kind === 'count') {
      const n = sessions.filter(s => s[3] === 0).length;
      answer = String(n);
      task = 'how many sessions failed (ok = 0)';
      query = 'SELECT COUNT(*) FROM sessions WHERE ok = 0;';
    } else if (kind === 'avg') {
      const avg = orders.reduce((a, o) => a + o[2], 0) / orders.length;
      answer = num(avg);
      task = 'the average order total across every order';
      query = 'SELECT AVG(total) FROM orders;';
    } else if (kind === 'max') {
      const acct = orders[0][1];
      const vals = orders.filter(o => o[1] === acct).map(o => o[2]);
      answer = String(Math.max(...vals));
      task = 'the largest order total for account_id ' + acct;
      query = 'SELECT MAX(total) FROM orders WHERE account_id = ' + acct + ';';
    } else {
      const st = pick(r, ['paid', 'pending', 'refunded']);
      const min = 30 + r(120);
      const rows = orders.filter(o => o[3] === st && o[2] >= min);
      answer = num(rows.reduce((a, o) => a + o[2], 0));
      task = 'the total of orders with status \'' + st + '\' and total >= ' + min;
      query = "SELECT SUM(total) FROM orders WHERE status = '" + st + "' AND total >= " + min + ';';
    }
    const C = {};
    C.ls = () => 'schema.sql  data.db  notes.txt';
    C.cat = a => a[0] === 'schema.sql'
      ? 'CREATE TABLE accounts (id INTEGER, name TEXT, role TEXT, active INTEGER);\nCREATE TABLE orders (id INTEGER, account_id INTEGER, total NUMERIC, status TEXT);\nCREATE TABLE sessions (id INTEGER, account_id INTEGER, minutes INTEGER, ok INTEGER);'
      : a[0] === 'notes.txt' ? 'Query the room. Aggregates: SUM COUNT AVG MIN MAX. Filters: WHERE ... AND ...' : 'cat: ' + (a[0] || '') + ': No such file';
    C.tables = () => Object.keys(db).join('\n');
    C.describe = a => db[a[0]] ? db[a[0]].cols.join(' | ') : 'unknown table';
    C.help = a => {
      const TP = window.TerminalPlayground;
      const base = TP && TP.formatHelp ? TP.formatHelp('sql', a) : 'SQL room: tables, describe <table>, cat schema.sql, SELECT ... FROM ... WHERE ...';
      if (a && a.length) return base;
      return base + '\n\n── ROOM HELPERS ──\n  tables / describe <table>             list database tables or show columns\n  ls / cat schema.sql                   view table definitions and room notes';
    };
    const lit = s => { s = String(s).trim(); if (/^'.*'$/.test(s)) return s.slice(1, -1); if (/^-?\d+(\.\d+)?$/.test(s)) return +s; return s; };
    const match = (row, t2, cond) => {
      const parts = cond.split(/\s+and\s+/i);
      return parts.every(p => {
        const m = p.match(/^\s*(\w+)\s*(=|==|!=|<>|>=|<=|>|<|like)\s*(.+?)\s*$/i);
        if (!m) return true;
        const idx = t2.cols.indexOf(m[1]);
        if (idx < 0) return false;
        const v = lit(m[2 + 0]); // placeholder, replaced below
        return true;
      });
    };
    function run(raw) {
      let q = String(raw).trim().replace(/;\s*$/, '');
      const words = q.split(/\s+/);
      if (C[words[0].toLowerCase()]) return C[words[0].toLowerCase()](words.slice(1));
      if (/^(show tables|\\dt)$/i.test(q)) return Object.keys(db).join('\n');
      if (/^(?:desc|\\d)\s+(\w+)$/i.test(q)) { const t0 = q.split(/\s+/)[1].toLowerCase(); return db[t0] ? db[t0].cols.join(' | ') : 'unknown table'; }
      const m = q.match(/^select\s+(sum|count|avg|min|max)\s*\(\s*(\*|\w+)\s*\)\s+from\s+(\w+)([\s\S]*)$/i);
      if (!m) {
        const sm = q.match(/^select\s+(distinct\s+)?([\s\S]+?)\s+from\s+(\w+)([\s\S]*)$/i);
        if (!sm) return 'ERROR: expected SELECT ... FROM <table> (try help)';
        const t2 = db[sm[3].toLowerCase()];
        if (!t2) return 'ERROR: relation "' + sm[3] + '" does not exist';
        let rows = t2.rows.slice();
        const rest = sm[4] || '';
        const wm = rest.match(/\bwhere\b([\s\S]*?)(?=\border\s+by\b|\blimit\b|$)/i);
        if (wm) {
          for (const cond of wm[1].split(/\s+and\s+/i)) {
            const cm = cond.match(/^\s*(\w+)\s*(=|==|!=|<>|>=|<=|>|<|like)\s*(.+?)\s*$/i);
            if (!cm) continue;
            const idx = t2.cols.indexOf(cm[1]);
            if (idx < 0) return 'ERROR: column "' + cm[1] + '" does not exist';
            const v = lit(cm[3]), op = cm[2].toLowerCase();
            rows = rows.filter(row => {
              const x = row[idx];
              if (op === '=' || op === '==') return String(x) === String(v);
              if (op === '!=' || op === '<>') return String(x) !== String(v);
              if (op === '>') return x > v; if (op === '<') return x < v; if (op === '>=') return x >= v; if (op === '<=') return x <= v;
              return new RegExp('^' + String(v).replace(/%/g, '.*') + '$', 'i').test(String(x));
            });
          }
        }
        const om = rest.match(/\border\s+by\s+(\w+)(?:\s+(asc|desc))?/i);
        if (om) { const idx = t2.cols.indexOf(om[1]); if (idx >= 0) rows.sort((a, b) => (a[idx] > b[idx] ? 1 : a[idx] < b[idx] ? -1 : 0) * (/desc/i.test(om[2] || '') ? -1 : 1)); }
        const lm = rest.match(/\blimit\s+(\d+)/i);
        if (lm) rows = rows.slice(0, parseInt(lm[1], 10));
        let cols = t2.cols.slice();
        if (sm[2].trim() !== '*') {
          const want = sm[2].split(',').map(x => x.trim());
          const idxs = want.map(n => t2.cols.indexOf(n));
          if (idxs.some(i => i < 0)) return 'ERROR: column "' + want[idxs.indexOf(-1)] + '" does not exist';
          cols = want; rows = rows.map(r => idxs.map(i => r[i]));
        }
        if (sm[1]) { const seen = new Set(); rows = rows.filter(r => { const k = JSON.stringify(r); if (seen.has(k)) return false; seen.add(k); return true; }); }
        return [cols.join(' | '), cols.map(() => '---').join('-+-')].concat(rows.map(r => r.join(' | '))).join('\n') + '\n(' + rows.length + ' rows)';
      }
      const fn = m[1].toLowerCase(), col = m[2], t2 = db[m[3].toLowerCase()];
      if (!t2) return 'ERROR: relation "' + m[3] + '" does not exist';
      let rows = t2.rows.slice();
      const wm = (m[4] || '').match(/\bwhere\b([\s\S]*)$/i);
      if (wm) {
        for (const cond of wm[1].split(/\s+and\s+/i)) {
          const cm = cond.match(/^\s*(\w+)\s*(=|==|!=|<>|>=|<=|>|<|like)\s*(.+?)\s*$/i);
          if (!cm) continue;
          const idx = t2.cols.indexOf(cm[1]);
          if (idx < 0) return 'ERROR: column "' + cm[1] + '" does not exist';
          const v = lit(cm[3]), op = cm[2].toLowerCase();
          rows = rows.filter(row => {
            const x = row[idx];
            if (op === '=' || op === '==') return String(x) === String(v);
            if (op === '!=' || op === '<>') return String(x) !== String(v);
            if (op === '>') return x > v;
            if (op === '<') return x < v;
            if (op === '>=') return x >= v;
            if (op === '<=') return x <= v;
            return new RegExp('^' + String(v).replace(/%/g, '.*') + '$', 'i').test(String(x));
          });
        }
      }
      const vals = col === '*' ? rows.map(row => row[t2.cols.indexOf('id')]) : rows.map(row => row[t2.cols.indexOf(col)]).filter(v => v != null);
      if (fn === 'count') return String(rows.length);
      if (!vals.length) return '0';
      const total = vals.reduce((a, b) => a + (typeof b === 'number' ? b : 0), 0);
      if (fn === 'sum') return num(total);
      if (fn === 'avg') return num(total / vals.length);
      if (fn === 'min') return num(Math.min(...vals));
      return num(Math.max(...vals));
    }
    return {
      kind: 'query', answer, brief: 'The database holds accounts, orders and sessions. The key is ' + task + '. Query it, then submit the number.', hint: query, walkthrough: [query],
      title: 'Labyrinth ' + d + ' · SQL vault', prompt: () => 'sql> ',
      palette: [['tables', 'list tables'], ['describe orders', 'columns'], ['SELECT SUM(total) FROM orders;', 'aggregate example'], ["SELECT SUM(total) FROM orders WHERE status = 'paid';", 'filtered aggregate'], ['cat schema.sql', 'full schema'], ['solve <answer>', 'descend']],
      run, cmds: C
    };
  }

  /* ================================================================ GIT ROOM */
  function gitRoom(d, r) {
    const t = tier(d);
    const ans = newToken(r);
    const authors = ['maya', 'dev', 'sam', 'nina', 'ravi'];
    const targetAuthor = pick(r, authors);
    const count = 5 + Math.min(12, d);
    const commits = [];
    let hashCounter = 0;
    const hash = () => (0xa1000 + (++hashCounter) * 7919).toString(16).padStart(7, '0');
    const messages = ['fix retry loop', 'add health endpoint', 'rotate staging key', 'tidy imports', 'bump base image', 'revert "rotate staging key"', 'update runbook', 'remove dead flags', 'wire metrics', 'refactor config loader'];
    for (let i = 0; i < count; i++) {
      const author = i === Math.floor(count / 2) ? targetAuthor : pick(r, authors);
      const msg = i === 2 ? 'add staging key' : pick(r, messages) + ' ' + (i + 1);
      commits.push({ hash: hash(), author, msg, lines: ['- old_value = "changeme"', '+ new_value = "service"'] });
    }
    const target = commits[Math.floor(commits.length / 2)];
    target.lines = ['- STAGING_KEY unset', '+ STAGING_KEY=' + ans];
    target.msg = 'add staging key ' + (target === commits[0] ? 'for the relay' : '');
    const clueKind = t < 3 ? 'author' : pick(r, ['author', 'message']);
    const clue = clueKind === 'author' ? 'committed by ' + target.author : 'whose message mentions "staging key"';
    const branch = 'main';
    const C = {};
    C.ls = () => 'app.js  config.yml  README.md';
    C.cat = a => a[0] === 'README.md' ? 'Repository for the relay service.\nThe secret was committed once. It is still in the history.' : a[0] === 'app.js' ? "const key = process.env.STAGING_KEY;\n" : a[0] === 'config.yml' ? 'service: relay\nenvironment: staging\n' : 'cat: ' + (a[0] || '') + ': No such file';
    C.help = a => {
      const TP = window.TerminalPlayground;
      const base = TP && TP.formatHelp ? TP.formatHelp('git', a) : 'Git room: git log, git show, git branch, git status, git diff, git grep, ls, cat';
      if (a && a.length) return base;
      return base + '\n\n── ROOM HELPERS ──\n  ls / cat <file>                       inspect repository files\n  git log --oneline | grep <text>       pipe git output into grep, head, tail, or wc';
    };
    function run(raw) {
      const line = String(raw).trim();
      if (!/^git\b/i.test(line)) {
        const w = line.split(/\s+/); const head = w[0];
        if (C[head]) return C[head](w.slice(1));
        return 'git: not a git command (try git log)';
      }
      const args = line.split(/\s+/).slice(1);
      const sub = args[0];
      const rest = args.slice(1).join(' ');
      if (sub === 'log') {
        const am = rest.match(/--author=([^\s]+)/);
        const gm = rest.match(/--grep=(.+)$/);
        let list = commits.slice().reverse();
        if (am) list = list.filter(c => c.author === am[1]);
        if (gm) list = list.filter(c => c.msg.toLowerCase().includes(gm[1].replace(/["']/g, '').toLowerCase()));
        if (!list.length) return 'fatal: no commits matched';
        if (rest.includes('--oneline')) return list.map(c => c.hash + ' ' + c.msg).join('\n');
        return list.map(c => 'commit ' + c.hash + '\nAuthor: ' + c.author + ' <' + c.author + '@relay.internal>\nDate:   Thu Feb 12 06:' + (10 + (parseInt(c.hash, 16) % 40)) + ':00 2026\n\n    ' + c.msg).join('\n\n');
      }
      if (sub === 'show') {
        const h = args[1] || '';
        const c = h === 'HEAD' || !h ? commits[commits.length - 1] : commits.find(x => x.hash === h || x.hash.startsWith(h));
        if (!c) return 'fatal: ambiguous argument \'' + h + '\': unknown revision';
        return 'commit ' + c.hash + ' (HEAD -> ' + branch + ')\nAuthor: ' + c.author + '\nDate:   Thu Feb 12 2026\n\n    ' + c.msg + '\n\ndiff --git a/config.yml b/config.yml\n--- a/config.yml\n+++ b/config.yml\n@@ -1,3 +1,3 @@\n ' + c.lines.join('\n');
      }
      if (sub === 'branch') return '* ' + branch;
      if (sub === 'status') return 'On branch ' + branch + '\nnothing to commit, working tree clean';
      if (sub === 'diff') return '';
      if (sub === 'reflog') return commits.slice().reverse().map((c, i) => c.hash + ' HEAD@{' + i + '}: commit: ' + c.msg).join('\n');
      if (sub === 'tag') return '';
      if (sub === 'rev-parse') return rest.includes('--abbrev-ref') ? branch : commits[commits.length - 1].hash;
      if (sub === 'grep') return commits.filter(c => c.lines.join(' ').includes(args[1] || '')).map(c => c.hash + ':' + c.lines.join(' ')).join('\n');
      return 'git: \'' + sub + '\' is not supported in this room (log, show, branch, status, diff, reflog, rev-parse, grep)';
    }
    const runPipe = raw => {
      const segs = String(raw || '').split('|').map(s => s.trim()).filter(Boolean);
      let out = run(segs[0] || '');
      for (let i = 1; i < segs.length; i++) {
        const w = segs[i].split(/\s+/);
        if (w[0] === 'grep') { const pat = w.slice(1).find(x => !x.startsWith('-')) || ''; out = out.split('\n').filter(l => new RegExp(pat, 'i').test(l)).join('\n'); }
        else if (w[0] === 'head') out = out.split('\n').slice(0, parseInt((w[1] || '-10').replace(/^-n?/, ''), 10) || 10).join('\n');
        else if (w[0] === 'tail') out = out.split('\n').slice(-(parseInt((w[1] || '-10').replace(/^-n?/, ''), 10) || 10)).join('\n');
        else if (w[0] === 'wc') out = String(out ? out.split('\n').length : 0);
      }
      return out;
    };
    return {
      kind: 'history', answer: ans, brief: 'The staging key was committed to this repository and then buried in history. Find the commit ' + clue + ', then show it and read the added line.', hint: 'git log --oneline, then filter with --author or --grep before you show the commit.', walkthrough: ['git log --oneline', 'git show ' + target.hash],
      title: 'Labyrinth ' + d + ' · git archive', prompt: () => 'relay (git:' + branch + ')$ ',
      palette: [['git log --oneline', 'compact history'], ['git log --author=' + targetAuthor, 'filter by author'], ['git log --grep=staging', 'filter by message'], ['git show <hash>', 'see the diff'], ['git status', 'working tree'], ['cat README.md', 'room notes'], ['solve <answer>', 'descend']],
      run: runPipe, cmds: C
    };
  }

  /* ================================================================ DOCKER ROOM */
  function dockerRoom(d, r) {
    const t = tier(d);
    const ans = newToken(r);
    const images = ['app:1.4', 'redis:7', 'postgres:16', 'worker:2.1', 'nginx:1.25'];
    const targetImage = pick(r, images);
    const containers = [];
    const n = 2 + Math.min(6, t);
    for (let i = 0; i < n; i++) {
      const name = pick(r, ['web', 'api', 'cache', 'db', 'queue']) + '-' + (i + 1);
      containers.push({
        name, image: i === 0 ? targetImage : pick(r, images), id: ('3f' + (100000 + r(899999)) + 'a1b2').slice(0, 12),
        status: 'Up ' + (1 + r(20)) + ' days',
        env: { PATH: '/usr/local/sbin:/usr/bin', APP_ENV: 'staging', TOKEN: i === 0 ? ans : newToken(r) },
        logs: ['listening on :8080', 'GET /health 200 2ms', 'queued job ' + (100 + r(900))]
      });
    }
    const C = {};
    C.help = a => {
      const TP = window.TerminalPlayground;
      const base = TP && TP.formatHelp ? TP.formatHelp('docker', a) : 'Docker room: docker ps, docker images, docker inspect, docker logs, docker exec, ls, cat';
      if (a && a.length) return base;
      return base + '\n\n── ROOM HELPERS ──\n  ls / cat compose.yml                  view Compose configuration and Dockerfile\n  docker inspect <name> | grep TOKEN    pipe docker output into grep';
    };
    C.ls = () => 'compose.yml  Dockerfile';
    C.cat = a => a[0] === 'compose.yml' ? 'services:\n  api:\n    image: ' + targetImage + '\n    environment:\n      - APP_ENV=staging' : a[0] === 'Dockerfile' ? 'FROM node:20-alpine\nWORKDIR /app\nCMD ["node","server.js"]' : 'cat: ' + (a[0] || '') + ': No such file';
    const run = raw => {
      const w = String(raw).trim().split(/\s+/);
      if (w[0] === 'ls' || w[0] === 'cat' || w[0] === 'help') return C[w[0]](w.slice(1));
      if (w[0] !== 'docker') return 'bash: ' + w[0] + ': command not found';
      const sub = w[1];
      const arg = w[2];
      if (sub === 'ps') {
        const rows = w.includes('-a') ? containers : containers.filter(c => /Up/.test(c.status));
        return 'CONTAINER ID   IMAGE          STATUS          NAMES\n' + rows.map(c => c.id.padEnd(14) + ' ' + c.image.padEnd(14) + ' ' + c.status.padEnd(15) + ' ' + c.name).join('\n');
      }
      if (sub === 'images') return 'REPOSITORY   TAG      SIZE\n' + shuffle(images, r).map(i => i.split(':')[0].padEnd(12) + ' ' + i.split(':')[1].padEnd(8) + (40 + r(400)) + 'MB').join('\n');
      if (sub === 'inspect') {
        const c = containers.find(x => x.name === arg || x.id === arg);
        if (!c) return 'Error: No such object: ' + (arg || '');
        return JSON.stringify({ Name: '/' + c.name, Image: c.image, State: { Running: true }, Config: { Env: Object.entries(c.env).map(([k, v]) => k + '=' + v) } }, null, 2);
      }
      if (sub === 'logs') {
        const c = containers.find(x => x.name === arg);
        if (!c) return 'Error: No such container: ' + (arg || '');
        return c.logs.map((l, i) => '2026-02-12T06:0' + (i + 1) + ':12Z ' + l).join('\n');
      }
      if (sub === 'exec') {
        const cname = w.slice(2).find(x => !x.startsWith('-')) || '';
        const c = containers.find(x => x.name === cname || x.id.startsWith(cname));
        if (!c) return 'Error: No such container: ' + cname;
        return Object.entries(c.env).map(([k, v]) => k + '=' + v).join('\n');
      }
      if (sub === 'stats') return 'NAME     CPU %   MEM USAGE\n' + containers.map(c => c.name.padEnd(9) + '0.35%   42MiB / 4GiB').join('\n');
      if (sub === 'info') return 'Containers: ' + containers.length + '\nImages: ' + images.length;
      if (sub === 'top') return 'UID   PID   CMD\nroot  1     node server.js';
      return 'docker: \'' + (sub || '') + '\' is not available here (ps, images, inspect, logs, exec, stats, top, info)';
    };
    const runDockPipe = raw => {
      const segs = String(raw || '').split('|').map(s => s.trim()).filter(Boolean);
      let out = run(segs[0] || '');
      for (let i = 1; i < segs.length; i++) {
        const w = segs[i].split(/\s+/);
        if (w[0] === 'grep') { const pat = w.slice(1).find(x => !x.startsWith('-')) || ''; out = out.split('\n').filter(l => new RegExp(pat, 'i').test(l)).join('\n'); }
      }
      return out;
    };
    return {
      kind: 'container', answer: ans, brief: 'A staging deployment left a token in a container environment. The container is running image ' + targetImage + '. Inspect it, or exec env into it.', hint: 'docker ps → docker inspect <name> (or docker exec <name> env).', walkthrough: ['docker ps', 'docker inspect ' + containers[0].name],
      title: 'Labyrinth ' + d + ' · container yard', prompt: () => 'deploy@relay:~$ ',
      palette: [['docker ps', 'running containers'], ['docker ps -a', 'all containers'], ['docker images', 'images'], ['docker inspect ' + containers[0].name, 'full container config'], ['docker logs ' + containers[0].name, 'container logs'], ['cat compose.yml', 'compose file'], ['solve <answer>', 'descend']],
      run: runDockPipe, cmds: C
    };
  }

  /* ================================================================ NETWORK ROOM */
  function netRoom(d, r) {
    const t = tier(d);
    const ans = newToken(r);
    const hosts = [];
    const n = 2 + Math.min(6, t + 1);
    for (let i = 0; i < n; i++) {
      hosts.push({
        ip: '10.20.' + (1 + r(9)) + '.' + (10 + r(200)),
        name: pick(r, ['edge', 'relay', 'staging', 'metrics', 'vault']) + '-' + (i + 1) + '.internal',
        ports: shuffle([22, 80, 443, 8080, 5432, 6379], r).slice(0, 2 + r(3)),
        env: 'staging'
      });
    }
    const target = hosts[1 + r(Math.max(1, hosts.length - 1))] || hosts[0];
    const mode = t < 3 ? 'http' : pick(r, ['http', 'dns']);
    const path = pick(r, ['/health', '/status', '/internal/key', '/staging']);
    if (mode === 'http' && target.ports.indexOf(8080) < 0) target.ports.push(8080);
    const port = target.ports.find(p => p === 8080) || target.ports[0];
    const url = 'http://' + target.ip + ':' + port + path;
    const C = {
      help: a => {
        const TP = window.TerminalPlayground;
        if (TP && TP.formatHelp) return TP.formatHelp('network', a);
        return 'Network room: nmap, dig, nslookup, host, curl, wget, ping, whois, nc, ss, ip, arp, traceroute';
      }
    };
    const run = raw => {
      const w = String(raw).trim().split(/\s+/);
      const cmd = w[0];
      const arg = w.slice(1).join(' ');
      if (cmd === 'help') return C.help(w.slice(1));
      if (cmd === 'nmap') {
        const ip = w.find(x => /^\d+\.\d+\.\d+\.\d+$/.test(x));
        const h = hosts.find(x => x.ip === ip);
        if (!h) return 'Note: Host ' + (ip || '') + ' seems to be down.';
        return 'Starting Nmap 7.94\nNmap scan report for ' + h.name + ' (' + h.ip + ')\nHost is up.\n\nPORT     STATE SERVICE   VERSION\n' +
          h.ports.map(p => String(p + '/tcp').padEnd(9) + 'open  ' + ({ 22: 'ssh       OpenSSH 8.9', 80: 'http      nginx 1.25', 443: 'https     nginx 1.25', 8080: 'http-alt  Express', 5432: 'postgres  PostgreSQL 16', 6379: 'redis     Redis 7.2' }[p] || 'unknown')).join('\n') +
          '\n\nHost script results:\n| environment: ' + h.env;
      }
      if (cmd === 'dig') {
        const name = w.slice(1).find(x => !x.startsWith('-') && !/^(TXT|A|AAAA|MX|CNAME)$/i.test(x)) || '';
        if (mode === 'dns' && hosts.some(h => h.name === name)) return '; <<>> DiG 9.18 <<>> ' + name + ' TXT\n;; ANSWER SECTION:\n' + name + '. 60 IN TXT "' + ans + '"\n;; Query time: 3 msec';
        return '; <<>> DiG 9.18 <<>> ' + name + ' A\n;; ANSWER SECTION:\n' + name + '. 300 IN A ' + ((hosts.find(h => h.name === name) || {}).ip || '10.20.0.1');
      }
      if (cmd === 'nslookup') {
        const name = w.slice(1).find(x => !/^-/.test(x)) || '';
        const h = hosts.find(x => x.name === name);
        return 'Server:  10.20.0.2\nAddress: 10.20.0.2#53\n\nName:    ' + name + '\nAddress: ' + (h ? h.ip : '10.20.0.1');
      }
      if (cmd === 'curl') {
        const u = w.find(x => /^https?:/.test(x)) || '';
        if (u === url || (u.includes(target.ip) && u.includes(path))) return '{"service":"' + target.name.split('.')[0] + '","environment":"staging","key":"' + ans + '"}';
        return 'curl: (7) Failed to connect to ' + (u.replace(/^https?:\/\//, '').split(/[:/]/)[0] || 'host') + ' — connection refused';
      }
      if (cmd === 'ping') {
        const h = w.find(x => !x.startsWith('-')) || '';
        return 'PING ' + h + ' 56(84) bytes of data.\n64 bytes from ' + h + ': icmp_seq=1 ttl=63 time=0.41 ms\n64 bytes from ' + h + ': icmp_seq=2 ttl=63 time=0.39 ms\n\n--- ' + h + ' ping statistics ---\n2 packets transmitted, 2 received, 0% packet loss';
      }
      if (cmd === 'whois') return 'Domain Name: ' + (arg || 'relay.internal').toUpperCase() + '\nRegistrar: Internal\nCreation Date: 2021-04-02';
      if (cmd === 'host') { const name = w.slice(1).find(x => !x.startsWith('-')) || ''; const h = hosts.find(x => x.name === name); return name + ' has address ' + (h ? h.ip : '10.20.0.1'); }
      if (cmd === 'wget') return run('curl ' + arg);
      if (cmd === 'nc' || cmd === 'ncat') return 'Connection to ' + (w[1] || target.ip) + ' ' + (w[2] || port) + ' port [tcp/*] succeeded!';
      if (cmd === 'traceroute') return 'traceroute to ' + (w[1] || target.ip) + '\n 1  10.20.0.1  0.4 ms\n 2  ' + (w[1] || target.ip) + '  1.1 ms';
      if (cmd === 'ss' || cmd === 'netstat') return 'Netid State  Local:Port\ntcp   LISTEN ' + target.ip + ':' + port;
      if (cmd === 'ip' || cmd === 'ifconfig') return 'eth0: inet 10.20.0.5/16\nknown hosts: ' + hosts.map(h => h.ip + ' (' + h.name + ')').join(', ');
      if (cmd === 'arp') return hosts.map(h => h.ip + ' ether 52:54:00:12:34:56 eth0').join('\n');
      return 'bash: ' + cmd + ': command not found (try nmap, dig, curl, ping, nslookup, host, wget, nc, ss, ip, arp, traceroute, whois)';
    };
    const runNetPipe = raw => {
      const segs = String(raw || '').split('|').map(s => s.trim()).filter(Boolean);
      let out = run(segs[0] || '');
      for (let i = 1; i < segs.length; i++) {
        const w = segs[i].split(/\s+/);
        if (w[0] === 'grep') { const pat = w.slice(1).find(x => !x.startsWith('-')) || ''; out = out.split('\n').filter(l => new RegExp(pat, 'i').test(l)).join('\n'); }
      }
      return out;
    };
    return {
      kind: 'network', answer: ans,
      brief: mode === 'dns'
        ? 'One host publishes the staging key as a DNS TXT record. Enumerate the hosts, then query the TXT record of ' + target.name + '.'
        : 'One host runs a staging API: ' + target.ip + ' on port ' + port + ', path ' + path + '. Scan it, then fetch the endpoint.',
      hint: mode === 'dns' ? 'nmap -sV <ip> for each host, then dig ' + target.name + ' TXT' : 'nmap -sV ' + target.ip + ', then curl ' + url,
      walkthrough: mode === 'dns' ? ['nmap -sV ' + target.ip, 'dig ' + target.name + ' TXT'] : ['nmap -sV ' + target.ip, 'curl ' + url],
      title: 'Labyrinth ' + d + ' · network range', prompt: () => 'probe@range:~$ ',
      palette: [['nmap -sV ' + target.ip, 'scan the target'], ['dig ' + target.name + ' TXT', 'DNS TXT lookup'], ['curl ' + url, 'fetch the endpoint'], ['ping ' + target.name, 'reachability'], ['help', 'commands'], ['solve <answer>', 'descend']],
      run: runNetPipe, cmds: C
    };
  }

  /* ================================================================ dispatch */
  const ROOMS = {
    bash: (d, r) => L.filesRoom('bash', d, r),
    powershell: (d, r) => L.filesRoom('powershell', d, r),
    cmd: (d, r) => L.filesRoom('cmd', d, r),
    python: pyRoom,
    node: nodeRoom,
    sql: sqlRoom,
    git: gitRoom,
    docker: dockerRoom,
    network: netRoom,
    crypto: (d, r) => L.cryptoRoom(d, r)
  };
  L.makeRoom = (shell, depth, seed) => {
    const make = ROOMS[shell] || ROOMS.bash;
    const r = rnd((seed ^ 0x9e3779b9) >>> 0);
    /* burn a few values so neighbouring depths differ even with a shared seed */
    for (let i = 0; i < (depth % 7) + 1; i++) r(1000);
    const room = make(depth, r);
    room.depth = depth;
    return room;
  };
  L.flavors = Object.keys(ROOMS);
})();

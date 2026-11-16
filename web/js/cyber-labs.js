// Cyber labs: small, fun, fully in-app tools. Cisco Packet Tracer (launches the installed app), a SQL playground
// (real SQLite in the browser via sql.js, with a SQL-injection demo), a subnet/IP calculator, and a regex tester.
(() => {
  const esc = t => String(t == null ? '' : t).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const css = `
.lab{flex:1;min-height:0;display:flex;flex-direction:column;overflow:auto;padding:16px}
.lab-wrap{max-width:860px;margin:0 auto;width:100%}
.lab h2{margin:2px 0 6px}.lab .sub{color:var(--mute);font-size:13px;line-height:1.5;margin-bottom:12px}
.lab textarea,.lab input{width:100%;box-sizing:border-box;font:13px/1.5 Consolas,"Cascadia Mono",monospace;padding:8px 10px;border:1px solid var(--line);border-radius:8px;background:var(--panel2);color:var(--text)}
.lab .btn{padding:8px 14px;border:0;border-radius:8px;font-weight:600;color:#fff;cursor:pointer;background:linear-gradient(135deg,var(--acc,#7c5cff),var(--acc2,#22d3ee))}
.lab .ib2{padding:5px 10px;border:1px solid var(--line);border-radius:7px;background:var(--panel2);color:var(--text);cursor:pointer;font-size:12px}
.lab .ib2:hover{border-color:var(--acc)}
.lab table{border-collapse:collapse;width:100%;font-size:13px;margin-top:8px}
.lab th,.lab td{border:1px solid var(--line);padding:4px 8px;text-align:left}.lab th{background:var(--panel2)}
.lab .kv{display:grid;grid-template-columns:auto 1fr;gap:4px 14px;font-size:13px;margin-top:10px}.lab .kv b{color:var(--mute);font-weight:600}
.lab .mono{font-family:Consolas,"Cascadia Mono",monospace}
.lab .note{font-size:12px;color:var(--mute);margin-top:8px;line-height:1.5}
.lab .hit{background:var(--acc,#7c5cff);color:#fff;border-radius:3px;padding:0 1px}
.lab .bad{color:var(--bad,#e5484d)}.lab .ok{color:var(--ok,#30a46c)}`;
  if (!document.getElementById('cyberlabs-css')) { const s = document.createElement('style'); s.id = 'cyberlabs-css'; s.textContent = css; document.head.appendChild(s); }
  const wrap = (el, inner) => { el.innerHTML = '<div class="lab"><div class="lab-wrap">' + inner + '</div></div>'; return el.querySelector('.lab-wrap'); };

  /* ---------- Cisco Packet Tracer (opens the installed app) ---------- */
  function ptracer(el) {
    const w = wrap(el, '<h2>🧪 Cisco Packet Tracer</h2><div class="sub">Cisco’s network simulator: build and wire routers, switches and PCs, then watch packets move. It is a full desktop program, so it opens in its own window.</div><div id="ptbody">Checking…</div>');
    const body = w.querySelector('#ptbody');
    A.api('/api/cyber/apps').then(r => {
      const st = r && r.packettracer;
      if (st && st.installed) body.innerHTML = '<button class="btn" id="ptgo">▶ Open Packet Tracer</button><div class="note">Version found on this PC. It opens in its own window; close it there when done. The in-app <b>Subnet calculator</b> and <b>Packet capture</b> stay inside Moundshroud.</div>';
      else body.innerHTML = '<div class="bad">Cisco Packet Tracer is not installed on this PC.</div><div class="note">Install it free from the Cisco Networking Academy, then it appears here.</div>';
      const go = w.querySelector('#ptgo'); if (go) go.onclick = async () => { go.disabled = true; go.textContent = 'Opening…'; const r2 = await A.api('/api/cyber/launch', { app: 'packettracer' }); A.toast(r2 && r2.ok ? 'Packet Tracer is opening.' : (r2 && r2.error) || 'Could not open it.'); go.disabled = false; go.textContent = '▶ Open Packet Tracer'; };
    }).catch(() => { body.innerHTML = '<div class="bad">Could not check for Packet Tracer.</div>'; });
  }

  /* ---------- SQL playground: real SQLite (sql.js) in the browser ---------- */
  let SQL = null, sqlLoading = null;
  const loadSql = () => sqlLoading || (sqlLoading = new Promise((res, rej) => {
    if (window.initSqlJs) return window.initSqlJs({ locateFile: f => '/web/vendor/sqljs/' + f }).then(s => { SQL = s; res(s); }, rej);
    const s = document.createElement('script'); s.src = '/web/vendor/sqljs/sql-wasm.js';
    s.onload = () => window.initSqlJs({ locateFile: f => '/web/vendor/sqljs/' + f }).then(x => { SQL = x; res(x); }, rej);
    s.onerror = () => rej(new Error('sql.js did not load')); document.head.appendChild(s);
  }));
  const SEED = "CREATE TABLE users(id INTEGER, name TEXT, email TEXT, role TEXT, password TEXT);\n" +
    "INSERT INTO users VALUES (1,'Alice','alice@example.com','admin','s3cret'),(2,'Bob','bob@example.com','user','hunter2'),(3,'Carol','carol@example.com','user','qwerty');\n" +
    "CREATE TABLE products(id INTEGER, name TEXT, price REAL);\n" +
    "INSERT INTO products VALUES (1,'Keyboard',29.9),(2,'Monitor',149.0),(3,'Mouse',14.5);";
  function sqllab(el) {
    const w = wrap(el, '<h2>🗃 SQL playground</h2><div class="sub">A real SQLite database running in your browser, nothing installed. Write queries, see results. Two tables are ready: <span class="mono">users</span> and <span class="mono">products</span>.</div>' +
      '<div class="row" style="display:flex;gap:6px;flex-wrap:wrap;margin-bottom:6px"><button class="ib2" data-q="SELECT * FROM users;">All users</button><button class="ib2" data-q="SELECT name, price FROM products ORDER BY price DESC;">Products by price</button><button class="ib2" data-q="SELECT * FROM users WHERE name = \'\' OR \'1\'=\'1\';">⚠ Injection demo</button><button class="ib2" id="sqlreset">Reset data</button></div>' +
      '<textarea id="sqlq" rows="4" spellcheck="false">SELECT * FROM users;</textarea><div style="margin:8px 0"><button class="btn" id="sqlrun">▶ Run (Ctrl+Enter)</button></div><div id="sqlout"><div class="note">Loading SQLite…</div></div>' +
      '<div class="note">The <b>injection demo</b> shows why <span class="mono">\' OR \'1\'=\'1</span> dumps every row: the quote closes the string and <span class="mono">1=1</span> is always true. Real apps must use parameters, not glued-in text.</div>');
    let db = null;
    const build = () => { if (db) db.close(); db = new SQL.Database(); db.run(SEED); };
    const out = w.querySelector('#sqlout');
    const run = () => {
      if (!SQL) return; const q = w.querySelector('#sqlq').value;
      try {
        const r = db.exec(q);
        if (!r.length) { out.innerHTML = '<div class="ok">Done. No rows returned.</div>'; return; }
        out.innerHTML = r.map(t => '<table><tr>' + t.columns.map(c => '<th>' + esc(c) + '</th>').join('') + '</tr>' + t.values.map(row => '<tr>' + row.map(v => '<td>' + esc(v) + '</td>').join('') + '</tr>').join('') + '</table>').join('');
      } catch (e) { out.innerHTML = '<div class="bad">' + esc(e.message) + '</div>'; }
    };
    loadSql().then(() => { build(); out.innerHTML = '<div class="note">Ready. Press Run.</div>'; run(); }).catch(() => { out.innerHTML = '<div class="bad">SQLite could not load.</div>'; });
    w.querySelector('#sqlrun').onclick = run;
    w.querySelector('#sqlq').addEventListener('keydown', e => { if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') { e.preventDefault(); run(); } });
    w.querySelector('#sqlreset').onclick = () => { if (SQL) { build(); run(); A.toast('Data reset.'); } };
    w.querySelectorAll('[data-q]').forEach(b => b.onclick = () => { w.querySelector('#sqlq').value = b.dataset.q; run(); });
  }

  /* ---------- Subnet / IP calculator ---------- */
  const ipToInt = ip => { const p = ip.split('.').map(Number); if (p.length !== 4 || p.some(n => isNaN(n) || n < 0 || n > 255)) return null; return ((p[0] << 24) >>> 0) + (p[1] << 16) + (p[2] << 8) + p[3]; };
  const intToIp = n => [(n >>> 24) & 255, (n >>> 16) & 255, (n >>> 8) & 255, n & 255].join('.');
  function subnet(el) {
    const w = wrap(el, '<h2>🌐 Subnet calculator</h2><div class="sub">Type an address and a prefix (CIDR). It works out the network, the usable host range, the broadcast address and how many hosts fit.</div>' +
      '<div style="display:flex;gap:8px;flex-wrap:wrap;align-items:center"><input id="snip" style="max-width:220px" value="192.168.1.10" spellcheck="false"> <span class="mono">/</span> <input id="sncidr" style="max-width:70px" value="24"> <button class="btn" id="sngo">Work it out</button></div><div id="snout"></div>');
    const calc = () => {
      const ip = ipToInt(w.querySelector('#snip').value.trim()), cidr = +w.querySelector('#sncidr').value;
      const out = w.querySelector('#snout');
      if (ip === null || isNaN(cidr) || cidr < 0 || cidr > 32) { out.innerHTML = '<div class="bad">Enter a valid IPv4 address and a prefix from 0 to 32.</div>'; return; }
      const mask = cidr === 0 ? 0 : (0xFFFFFFFF << (32 - cidr)) >>> 0;
      const net = (ip & mask) >>> 0, bcast = (net | (~mask >>> 0)) >>> 0;
      const hosts = cidr >= 31 ? 0 : (bcast - net - 1), first = cidr >= 31 ? net : net + 1, last = cidr >= 31 ? bcast : bcast - 1;
      out.innerHTML = '<div class="kv"><b>Network</b><span class="mono">' + intToIp(net) + '/' + cidr + '</span>' +
        '<b>Subnet mask</b><span class="mono">' + intToIp(mask) + '</span>' +
        '<b>Usable hosts</b><span class="mono">' + hosts.toLocaleString() + '</span>' +
        '<b>Host range</b><span class="mono">' + (hosts > 0 ? intToIp(first) + ' – ' + intToIp(last) : 'none') + '</span>' +
        '<b>Broadcast</b><span class="mono">' + intToIp(bcast) + '</span>' +
        '<b>Wildcard</b><span class="mono">' + intToIp(~mask >>> 0) + '</span></div>';
    };
    w.querySelector('#sngo').onclick = calc; w.querySelectorAll('#snip,#sncidr').forEach(i => i.addEventListener('keydown', e => { if (e.key === 'Enter') calc(); })); calc();
  }

  /* ---------- Regex tester ---------- */
  function regex(el) {
    const w = wrap(el, '<h2>🔍 Regex tester</h2><div class="sub">Try a regular expression against text and see every match light up. Groups show below.</div>' +
      '<div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap"><span class="mono">/</span><input id="rxp" style="max-width:420px" value="\\b\\w+@\\w+\\.\\w+\\b" spellcheck="false"><span class="mono">/</span><input id="rxf" style="max-width:70px" value="gi" spellcheck="false"></div>' +
      '<textarea id="rxt" rows="5" style="margin-top:8px" spellcheck="false">Email alice@example.com or bob@test.org for help.</textarea>' +
      '<div id="rxcount" class="note"></div><div id="rxhi" class="mono" style="white-space:pre-wrap;border:1px solid var(--line);border-radius:8px;padding:10px;margin-top:8px"></div><div id="rxg"></div>');
    const go = () => {
      const pat = w.querySelector('#rxp').value, flags = w.querySelector('#rxf').value, text = w.querySelector('#rxt').value;
      const hi = w.querySelector('#rxhi'), gi = w.querySelector('#rxg'), cnt = w.querySelector('#rxcount');
      let re; try { re = new RegExp(pat, flags.includes('g') ? flags : flags + 'g'); } catch (e) { cnt.innerHTML = '<span class="bad">' + esc(e.message) + '</span>'; hi.textContent = text; gi.innerHTML = ''; return; }
      let last = 0, html = '', n = 0, groups = [], m;
      while ((m = re.exec(text)) !== null) {
        html += esc(text.slice(last, m.index)) + '<span class="hit">' + esc(m[0] || '') + '</span>'; last = m.index + (m[0].length || 0); n++;
        if (m.length > 1) groups.push(m.slice(1));
        if (m[0] === '') re.lastIndex++;
        if (n > 5000) break;
      }
      html += esc(text.slice(last)); hi.innerHTML = html || '<span class="note">no text</span>';
      cnt.innerHTML = n ? '<span class="ok">' + n + ' match' + (n === 1 ? '' : 'es') + '</span>' : 'No matches.';
      gi.innerHTML = groups.length ? '<table><tr><th>#</th>' + groups[0].map((_, i) => '<th>group ' + (i + 1) + '</th>').join('') + '</tr>' + groups.slice(0, 50).map((g, i) => '<tr><td>' + (i + 1) + '</td>' + g.map(v => '<td>' + esc(v == null ? '' : v) + '</td>').join('') + '</tr>').join('') + '</table>' : '';
    };
    w.querySelectorAll('#rxp,#rxf,#rxt').forEach(i => i.addEventListener('input', go)); go();
  }

  A.cyberLabs = { ptracer, sqllab, subnet, regex };
})();

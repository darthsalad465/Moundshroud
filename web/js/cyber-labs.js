// Cyber labs: small, fun, fully in-app tools. A Packet Tracer network simulator (web/js/pt-*.js, inside the app), a SQL playground
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
.lab .bad{color:var(--bad,#e5484d)}.lab .ok{color:var(--ok,#30a46c)}
.lab pre{background:var(--panel2);border:1px solid var(--line);border-radius:8px;padding:8px 10px;overflow:auto;font-size:12.5px;white-space:pre-wrap;word-break:break-word;margin:4px 0 10px}
.lab select.ib2{padding:5px 8px}`;
  if (!document.getElementById('cyberlabs-css')) { const s = document.createElement('style'); s.id = 'cyberlabs-css'; s.textContent = css; document.head.appendChild(s); }
  const wrap = (el, inner) => { el.innerHTML = '<div class="lab"><div class="lab-wrap">' + inner + '</div></div>'; return el.querySelector('.lab-wrap'); };

  /* ---------- Packet Tracer: the in-app network simulator (web/js/pt-*.js), never an outside program ---------- */
  const PT_FILES = ['pt-css', 'pt-net', 'pt-route', 'pt-packet', 'pt-apps', 'pt-ios', 'pt-ios-cfg', 'pt-ios-show', 'pt-labs', 'pt-ui', 'pt-ui-dev', 'pt-ui-sim'];
  let ptLoad = null;
  const loadPt = () => ptLoad || (ptLoad = PT_FILES.reduce((p, f) => p.then(() => new Promise((res, rej) => {
    const src = '/web/js/' + f + '.js'; if (document.querySelector('script[src="' + src + '"]')) return res();
    const s = document.createElement('script'); s.src = src; s.onload = res; s.onerror = () => rej(new Error(f + '.js did not load')); document.head.appendChild(s);
  })), Promise.resolve()));
  function ptracer(el) {
    el.innerHTML = '<div class="lab"><div class="note">Loading the network simulator…</div></div>';
    loadPt().then(() => { A.packetTracer = window.PTSim.mount(el); }).catch(e => { ptLoad = null; el.innerHTML = '<div class="lab"><div class="bad">The simulator did not load: ' + esc(e.message) + '</div></div>'; });
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
        /* running the injection demo and getting every row back is the lab's lesson: it pays once */
        if (r.reduce((n, t) => n + t.values.length, 0) > 3 && /('\s*or\s+'1'\s*=\s*'1|or\s+1\s*=\s*1|admin'--)/i.test(q)) {
          try { A.cyberBank?.once('labs:sql-injection', 20, 'SQL injection demo: every row came back', 'puzzle', 'puzzles'); } catch (e) { }
        }
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

  /* ---------- OWASP Juice Shop: a local, legal practice target, shown in a frame ---------- */
  let jpoll = 0;
  function juice(el) {
    const w = wrap(el, '<h2>🧃 OWASP Juice Shop</h2><div class="sub">A deliberately vulnerable web shop, run on this PC as a safe and legal target. Practise the Toolkit, ARTEX and your own skills against it. Nothing here touches the real internet.</div><div id="jbody">Checking…</div>');
    const body = w.querySelector('#jbody');
    const show = st => {
      if (st.up) { if (!body.querySelector('#jframe')) body.innerHTML = '<div class="row" style="display:flex;gap:10px;align-items:center;margin-bottom:6px"><span class="note" style="margin:0">Running at <span class="mono">' + esc(st.url) + '</span></span><span style="flex:1"></span><button class="ib2" id="jstop">■ Stop</button></div><iframe id="jframe" src="' + esc(st.url) + '" style="flex:1;width:100%;height:68vh;border:1px solid var(--line);border-radius:10px;background:#fff"></iframe>'; const s = body.querySelector('#jstop'); if (s) s.onclick = async () => { await A.api('/api/juiceshop/stop', {}); idle(await A.api('/api/juiceshop/status').catch(() => ({}))); }; return; }
      if (st.starting) { body.innerHTML = '<div class="note">Starting Juice Shop… the first launch builds its database, up to a minute.</div>'; clearTimeout(jpoll); jpoll = setTimeout(async () => show(await A.api('/api/juiceshop/status').catch(() => ({}))), 1500); return; }
      idle(st);
    };
    const idle = st => {
      body.innerHTML = (st.installed === false ? '<div class="bad">Juice Shop is not installed in the runtime folder.</div>' : '<button class="btn" id="jgo">▶ Start Juice Shop</button>') +
        '<div class="note"><b>⚠ For practice only.</b> Juice Shop is built to be broken into. Attack this one freely; never use these techniques on sites you do not own or have written permission to test.</div>';
      const go = w.querySelector('#jgo'); if (go) go.onclick = async () => { body.innerHTML = '<div class="note">Starting Juice Shop… up to a minute on the first run.</div>'; try { await A.api('/api/juiceshop/start', {}); } catch (e) { } poll(40); };
    };
    const poll = async n => { clearTimeout(jpoll); const st = await A.api('/api/juiceshop/status').catch(() => ({})); if (st.up) return show(st); if (n <= 0) { idle(st); A.toast('Juice Shop did not come up in time.'); return; } jpoll = setTimeout(() => poll(n - 1), 1500); };
    el._onShow = () => { if (!body.querySelector('#jframe')) A.api('/api/juiceshop/status').then(show).catch(() => { }); };
    el._cleanup = () => clearTimeout(jpoll);
    A.api('/api/juiceshop/status').then(show).catch(() => { body.innerHTML = '<div class="bad">Could not reach the server.</div>'; });
  }

  /* ---------- JWT decoder ---------- */
  function jwt(el) {
    const w = wrap(el, '<h2>🔑 JWT decoder</h2><div class="sub">Paste a JSON Web Token to read its header and payload. The signature is shown but not checked, so never trust a token just by reading it.</div><textarea id="jwtin" rows="4" spellcheck="false" placeholder="eyJhbGci..."></textarea><div id="jwtout" style="margin-top:10px"></div>');
    const b64 = s => { s = s.replace(/-/g, '+').replace(/_/g, '/'); while (s.length % 4) s += '='; try { return decodeURIComponent(atob(s).split('').map(c => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2)).join('')); } catch (e) { try { return atob(s); } catch (e2) { return null; } } };
    const go = () => {
      const t = w.querySelector('#jwtin').value.trim(), o = w.querySelector('#jwtout'), p = t.split('.');
      if (p.length < 2) { o.innerHTML = t ? '<div class="bad">Not a JWT: it needs header.payload.signature.</div>' : ''; return; }
      const dec = i => { const r = b64(p[i]); try { return JSON.stringify(JSON.parse(r), null, 2); } catch (e) { return r || '(could not decode)'; } };
      let times = ''; try { const o2 = JSON.parse(b64(p[1])); ['iat', 'nbf', 'exp'].forEach(k => { if (o2[k]) times += k + ': ' + new Date(o2[k] * 1000).toLocaleString() + (k === 'exp' && o2[k] * 1000 < Date.now() ? ' (expired)' : '') + '\n'; }); } catch (e) { }
      o.innerHTML = '<b>Header</b><pre>' + esc(dec(0)) + '</pre><b>Payload</b><pre>' + esc(dec(1)) + '</pre>' + (times ? '<div class="kv"><b>Times</b><span class="mono" style="white-space:pre">' + esc(times) + '</span></div>' : '') + '<div class="note">Signature: <span class="mono">' + esc(p[2] || '(none)') + '</span>, not verified here.</div>';
    };
    w.querySelector('#jwtin').addEventListener('input', go);
  }

  /* ---------- Cipher workshop: Caesar and Vigenere ---------- */
  function cipher(el) {
    const w = wrap(el, '<h2>🔐 Cipher workshop</h2><div class="sub">Caesar and Vigenère ciphers. Type text, pick a cipher and key, and watch it change. Letters shift; spaces and punctuation stay.</div>' +
      '<div style="display:flex;gap:8px;flex-wrap:wrap;align-items:center;margin-bottom:8px"><select id="cptype" class="ib2"><option value="caesar">Caesar (number shift)</option><option value="vig">Vigenère (keyword)</option></select><input id="cpkey" class="ib2" style="max-width:160px" value="3" spellcheck="false"><button class="ib2" id="cpswap">Mode: Encode</button></div>' +
      '<textarea id="cptext" rows="3" spellcheck="false">Attack at dawn</textarea><div class="note">Result</div><div id="cpout" class="mono" style="border:1px solid var(--line);border-radius:8px;padding:10px;white-space:pre-wrap"></div>');
    let dec = false;
    const sh = (c, n) => { const base = c >= 'a' && c <= 'z' ? 97 : c >= 'A' && c <= 'Z' ? 65 : -1; if (base < 0) return c; return String.fromCharCode((c.charCodeAt(0) - base + ((n % 26) + 26) % 26) % 26 + base); };
    const go = () => {
      const type = w.querySelector('#cptype').value, key = w.querySelector('#cpkey').value, text = w.querySelector('#cptext').value; let out = '';
      if (type === 'caesar') { let n = parseInt(key) || 0; if (dec) n = -n; out = [...text].map(c => sh(c, n)).join(''); }
      else { const k = (key || 'a').replace(/[^a-zA-Z]/g, '') || 'a'; let ki = 0; out = [...text].map(c => { if (!/[a-zA-Z]/.test(c)) return c; let n = k[ki % k.length].toLowerCase().charCodeAt(0) - 97; if (dec) n = -n; ki++; return sh(c, n); }).join(''); }
      w.querySelector('#cpout').textContent = out;
    };
    w.querySelector('#cpswap').onclick = e => { dec = !dec; e.target.textContent = 'Mode: ' + (dec ? 'Decode' : 'Encode'); go(); };
    w.querySelectorAll('#cptype,#cpkey,#cptext').forEach(i => i.addEventListener('input', go)); go();
  }

  /* ---------- Hash & entropy lab ---------- */
  function hashlab(el) {
    const w = wrap(el, '<h2>#️⃣ Hash & entropy lab</h2><div class="sub">Hash text with SHA-1, SHA-256 and SHA-512 on this PC, and see how strong a password is by its entropy in bits.</div>' +
      '<textarea id="hltext" rows="2" spellcheck="false">correct horse battery staple</textarea><div id="hlhash" class="kv" style="margin-top:10px"></div><div class="note" style="margin-top:12px">Password strength (entropy)</div><div id="hlent" class="kv"></div>');
    const hex = buf => [...new Uint8Array(buf)].map(b => b.toString(16).padStart(2, '0')).join('');
    const entropy = s => { let sets = 0; if (/[a-z]/.test(s)) sets += 26; if (/[A-Z]/.test(s)) sets += 26; if (/[0-9]/.test(s)) sets += 10; if (/[^a-zA-Z0-9]/.test(s)) sets += 33; return { bits: Math.round(s.length * Math.log2(sets || 1)), sets }; };
    const go = async () => {
      const t = w.querySelector('#hltext').value, enc = new TextEncoder().encode(t);
      const rows = await Promise.all(['SHA-1', 'SHA-256', 'SHA-512'].map(async a => '<b>' + a + '</b><span class="mono" style="word-break:break-all">' + hex(await crypto.subtle.digest(a, enc)) + '</span>'));
      w.querySelector('#hlhash').innerHTML = rows.join('');
      const e = entropy(t), label = e.bits < 40 ? '<span class="bad">weak</span>' : e.bits < 60 ? 'fair' : e.bits < 80 ? '<span class="ok">strong</span>' : '<span class="ok">very strong</span>';
      w.querySelector('#hlent').innerHTML = '<b>Length</b><span>' + t.length + ' characters</span><b>Character sets</b><span>' + e.sets + ' possible per spot</span><b>Entropy</b><span class="mono">' + e.bits + ' bits (' + label + ')</span>';
    };
    w.querySelector('#hltext').addEventListener('input', go); go();
  }

  /* ---------- JSON & Base64 workbench ---------- */
  function jsonlab(el) {
    const w = wrap(el, '<h2>{ } JSON & Base64 workbench</h2><div class="sub">Pretty-print and check JSON, and convert text to and from Base64 and URL encoding. All offline.</div>' +
      '<div style="display:flex;gap:6px;flex-wrap:wrap;margin-bottom:6px"><button class="ib2" data-a="json">Format JSON</button><button class="ib2" data-a="min">Minify JSON</button><button class="ib2" data-a="b64e">Text → Base64</button><button class="ib2" data-a="b64d">Base64 → Text</button><button class="ib2" data-a="urle">URL-encode</button><button class="ib2" data-a="urld">URL-decode</button></div>' +
      '<textarea id="jlin" rows="5" spellcheck="false">{"name":"Alice","roles":["admin","user"]}</textarea><div class="note" id="jlmsg"></div><textarea id="jlout" rows="5" spellcheck="false" readonly></textarea>');
    const run = a => {
      const v = w.querySelector('#jlin').value, out = w.querySelector('#jlout'), msg = w.querySelector('#jlmsg'); msg.textContent = '';
      try {
        if (a === 'json') { out.value = JSON.stringify(JSON.parse(v), null, 2); msg.innerHTML = '<span class="ok">Valid JSON.</span>'; }
        else if (a === 'min') { out.value = JSON.stringify(JSON.parse(v)); }
        else if (a === 'b64e') { out.value = btoa(unescape(encodeURIComponent(v))); }
        else if (a === 'b64d') { out.value = decodeURIComponent(escape(atob(v.trim()))); }
        else if (a === 'urle') { out.value = encodeURIComponent(v); }
        else if (a === 'urld') { out.value = decodeURIComponent(v); }
      } catch (e) { msg.innerHTML = '<span class="bad">' + esc(e.message) + '</span>'; }
    };
    w.querySelectorAll('[data-a]').forEach(b => b.onclick = () => run(b.dataset.a));
  }

  A.cyberLabs = { ptracer, sqllab, subnet, regex, juice, jwt, cipher, hashlab, jsonlab };
})();

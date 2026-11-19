// Markets: a trading desk inside the News tab. Quotes and key statistics, interactive charts with the standard
// indicators, a watchlist with price alerts, company filings and audited financials, rates and the economy, the risk
// calculators a careful trader uses before every trade, and a private portfolio and trade journal.
// It shows data and does the arithmetic; it never says what to buy or sell. Everything you enter (watchlist, alerts,
// holdings, journal) stays in this browser on this PC; only the symbols you look up are sent to the data services.
(() => {
  const J = (k, d) => { try { const v = JSON.parse(ls.get(k, '')); return v == null ? d : v; } catch (e) { return d; } };
  const save = (k, v) => ls.set(k, JSON.stringify(v));
  let S = Object.assign({ tab: 'overview', sym: 'AAPL', range: '1y', type: 'candle', ind: { sma20: 0, sma50: 1, sma200: 1, ema9: 0, ema21: 0, bb: 0, vwap: 1 }, lower: 'rsi' }, J('mk_state', {}));
  let watch = J('mk_watch', ['.SPX', '.IXIC', '.DJI', '.VIX', 'AAPL', 'MSFT', 'NVDA', 'AMZN', 'GOOGL', 'META', 'TSLA', 'JPM']);
  let alerts = J('mk_alerts', []), port = J('mk_port', []), journal = J('mk_journal', []), levels = J('mk_levels', {});
  const keep = () => save('mk_state', S);
  let host = null, timer = 0, chartData = null, quoteCache = {}, hoverIdx = -1, levelMode = false;

  const NAMES = { '.SPX': 'S&P 500', '.IXIC': 'Nasdaq', '.DJI': 'Dow Jones', '.RUT': 'Russell 2000', '.VIX': 'VIX (fear gauge)', 'US2Y': '2-year Treasury', 'US10Y': '10-year Treasury', 'US30Y': '30-year Treasury', '@CL.1': 'WTI crude oil', '@LCO.1': 'Brent crude', '@GC.1': 'Gold', '@SI.1': 'Silver', '@NG.1': 'Natural gas', '@HG.1': 'Copper', '.DXY': 'US dollar index', 'EUR=': 'Euro (USD per EUR)', 'GBP=': 'Pound (USD per GBP)', 'JPY=': 'Yen per USD', 'CNY=': 'Yuan per USD', 'BTC.CM=': 'Bitcoin', 'ETH.CM=': 'Ether', '.STOXX': 'Europe Stoxx 600', '.FTSE': 'UK FTSE 100', '.GDAXI': 'Germany DAX', '.N225': 'Japan Nikkei 225', '.HSI': 'Hong Kong Hang Seng' };
  const GROUPS = [['U.S. stocks', ['.SPX', '.IXIC', '.DJI', '.RUT', '.VIX']], ['Rates', ['US2Y', 'US10Y', 'US30Y']], ['Commodities', ['@CL.1', '@LCO.1', '@GC.1', '@SI.1', '@NG.1', '@HG.1']], ['Currencies', ['.DXY', 'EUR=', 'GBP=', 'JPY=', 'CNY=']], ['Crypto', ['BTC.CM=', 'ETH.CM=']], ['World', ['.STOXX', '.FTSE', '.GDAXI', '.N225', '.HSI']]];

  /* ---------- formatting ---------- */
  const f2 = (v, d) => v == null || isNaN(v) ? '–' : (+v).toLocaleString(undefined, { minimumFractionDigits: d == null ? (Math.abs(v) < 10 ? 2 : 2) : d, maximumFractionDigits: d == null ? (Math.abs(v) < 1 ? 4 : 2) : d });
  const big = v => v == null || isNaN(v) ? '–' : Math.abs(v) >= 1e12 ? f2(v / 1e12) + 'T' : Math.abs(v) >= 1e9 ? f2(v / 1e9) + 'B' : Math.abs(v) >= 1e6 ? f2(v / 1e6) + 'M' : Math.abs(v) >= 1e3 ? f2(v / 1e3) + 'K' : f2(v, 0);
  const pc = v => v == null || isNaN(v) ? '–' : (v > 0 ? '+' : '') + f2(v) + '%';
  const col = v => v > 0 ? 'var(--ok)' : v < 0 ? 'var(--bad)' : 'var(--mute)';
  const nm = (s, q) => NAMES[s] || (q && q.name) || s;
  const api = async (p) => { try { return await (await fetch(p)).json(); } catch (e) { return { error: e.message }; } };
  /* the US market's hours, in New York time (holidays are not known here) */
  function session() {
    const p = new Intl.DateTimeFormat('en-US', { timeZone: 'America/New_York', weekday: 'short', hour: 'numeric', minute: 'numeric', hour12: false }).formatToParts(new Date());
    const g = t => (p.find(x => x.type === t) || {}).value, wd = g('weekday'), m = +g('hour') % 24 * 60 + +g('minute');
    if (wd === 'Sat' || wd === 'Sun') return ['Closed (weekend)', 'var(--mute)'];
    if (m < 240) return ['Closed', 'var(--mute)']; if (m < 570) return ['Pre-market', 'var(--warn)']; if (m < 960) return ['Market open', 'var(--ok)']; if (m < 1200) return ['After hours', 'var(--warn)']; return ['Closed', 'var(--mute)'];
  }

  /* ---------- the indicators ---------- */
  const sma = (a, n) => { const o = Array(a.length).fill(null); let s = 0; for (let i = 0; i < a.length; i++) { s += a[i]; if (i >= n) s -= a[i - n]; if (i >= n - 1) o[i] = s / n; } return o; };
  const ema = (a, n) => { const o = Array(a.length).fill(null), k = 2 / (n + 1); let e = null; for (let i = 0; i < a.length; i++) { if (a[i] == null) continue; if (e == null) { if (i >= n - 1) { let s = 0; for (let j = i - n + 1; j <= i; j++) s += a[j]; e = s / n; o[i] = e; } continue; } e = a[i] * k + e * (1 - k); o[i] = e; } return o; };
  function boll(a, n, k) { const m = sma(a, n), up = Array(a.length).fill(null), dn = Array(a.length).fill(null); for (let i = n - 1; i < a.length; i++) { let s = 0; for (let j = i - n + 1; j <= i; j++) s += (a[j] - m[i]) ** 2; const sd = Math.sqrt(s / n); up[i] = m[i] + k * sd; dn[i] = m[i] - k * sd; } return { m, up, dn }; }
  function rsi(a, n) { const o = Array(a.length).fill(null); let g = 0, l = 0; for (let i = 1; i < a.length; i++) { const d = a[i] - a[i - 1], up = Math.max(d, 0), dn = Math.max(-d, 0); if (i <= n) { g += up; l += dn; if (i === n) { g /= n; l /= n; o[i] = l === 0 ? 100 : 100 - 100 / (1 + g / l); } } else { g = (g * (n - 1) + up) / n; l = (l * (n - 1) + dn) / n; o[i] = l === 0 ? 100 : 100 - 100 / (1 + g / l); } } return o; }
  function macd(a) { const e12 = ema(a, 12), e26 = ema(a, 26), m = a.map((_, i) => e12[i] != null && e26[i] != null ? e12[i] - e26[i] : null), first = m.findIndex(x => x != null), sig = Array(a.length).fill(null); if (first >= 0) { const s = ema(m.slice(first), 9); s.forEach((v, i) => { sig[first + i] = v; }); } return { m, sig, h: m.map((v, i) => v != null && sig[i] != null ? v - sig[i] : null) }; }
  function atr(b, n) { const o = Array(b.length).fill(null); let a = null; for (let i = 1; i < b.length; i++) { const tr = Math.max(b[i].h - b[i].l, Math.abs(b[i].h - b[i - 1].c), Math.abs(b[i].l - b[i - 1].c)); if (i < n) { a = (a || 0) + tr; if (i === n - 1) { a /= n - 1; } continue; } a = a == null ? tr : (a * (n - 1) + tr) / n; o[i] = a; } return o; }
  function vwap(b) { const o = []; let pv = 0, vv = 0, day = ''; b.forEach(x => { const d = new Date(x.t).toDateString(); if (d !== day) { day = d; pv = 0; vv = 0; } const tp = (x.h + x.l + x.c) / 3; pv += tp * (x.v || 0); vv += x.v || 0; o.push(vv ? pv / vv : null); }); return o; }

  /* ---------- shell ---------- */
  const TABS = [['overview', '🌐 Overview'], ['watch', '👁 Watchlist'], ['chart', '📈 Chart & company'], ['tools', '🧮 Trade tools'], ['port', '💼 Portfolio & journal'], ['macro', '🏦 Rates & economy']];
  const css = `.mk{display:flex;flex-direction:column;flex:1;min-height:0}.mk-top{display:flex;gap:6px;flex-wrap:wrap;align-items:center;padding:10px 16px;border-bottom:1px solid var(--line)}
.mk-body{flex:1;min-height:0;overflow:auto;padding:14px 18px 40px}.mk-g{display:grid;gap:10px;grid-template-columns:repeat(auto-fill,minmax(170px,1fr))}
.mk-tile{background:var(--panel);border:1px solid var(--line);border-radius:10px;padding:8px 10px;cursor:pointer}.mk-tile:hover{border-color:var(--acc)}.mk-tile b{display:block;font-size:12px;color:var(--mute);font-weight:600;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.mk-tile .p{font-size:17px;font-weight:700}.mk-tile .c{font-size:12px}
.mk-h3{margin:14px 0 8px;font-size:13px;text-transform:uppercase;letter-spacing:.06em;color:var(--mute)}
.mk-tbl{width:100%;border-collapse:collapse;font-size:13px}.mk-tbl td,.mk-tbl th{padding:6px 8px;border-bottom:1px solid var(--line);text-align:right;white-space:nowrap}.mk-tbl th{color:var(--mute);font-weight:600;font-size:11.5px;cursor:pointer}.mk-tbl td:first-child,.mk-tbl th:first-child,.mk-tbl td.l{text-align:left}.mk-tbl tr.r:hover{background:var(--panel);cursor:pointer}
.mk-rng{position:relative;height:6px;width:90px;background:var(--panel2);border-radius:3px;display:inline-block;vertical-align:middle}.mk-rng i{position:absolute;top:-3px;width:3px;height:12px;background:var(--text);border-radius:2px}
.mk-card{background:var(--panel);border:1px solid var(--line);border-radius:12px;padding:12px 14px;margin-bottom:12px}.mk-card h4{margin:0 0 8px;font-size:12.5px;text-transform:uppercase;letter-spacing:.06em;color:var(--mute)}
.mk-kv{display:grid;grid-template-columns:repeat(auto-fill,minmax(150px,1fr));gap:6px 14px;font-size:13px}.mk-kv div{display:flex;justify-content:space-between;gap:8px;border-bottom:1px dashed var(--line);padding:2px 0}.mk-kv span{color:var(--mute)}
.mk-btn{border:1px solid var(--line);background:var(--panel);color:var(--text);border-radius:7px;padding:4px 9px;font-size:12.5px;cursor:pointer}.mk-btn.on{background:var(--acc);border-color:var(--acc);color:#fff}
.mk-split{display:grid;grid-template-columns:minmax(0,1fr) 330px;gap:14px}@media (max-width:1050px){.mk-split{grid-template-columns:1fr}}
.mk-cv{width:100%;height:440px;display:block;background:var(--panel);border:1px solid var(--line);border-radius:12px;cursor:crosshair}
.mk-in{display:grid;grid-template-columns:repeat(auto-fill,minmax(160px,1fr));gap:8px 12px}.mk-in label{display:flex;flex-direction:column;font-size:12px;color:var(--mute);gap:3px}.mk-in input,.mk-in select{font-size:14px}
.mk-out{display:grid;grid-template-columns:repeat(auto-fill,minmax(170px,1fr));gap:8px;margin-top:10px}.mk-out div{background:var(--panel2);border-radius:8px;padding:7px 10px}.mk-out span{display:block;font-size:11.5px;color:var(--mute)}.mk-out b{font-size:16px}
.mk-note{font-size:12px;color:var(--mute);line-height:1.5}.mk-sug{position:absolute;z-index:20;background:var(--bg);border:1px solid var(--line);border-radius:8px;min-width:320px;box-shadow:0 6px 20px rgba(0,0,0,.4)}.mk-sug div{padding:6px 10px;cursor:pointer;font-size:13px}.mk-sug div:hover{background:var(--panel)}`;
  function style() { if (!document.getElementById('mkcss')) { const s = document.createElement('style'); s.id = 'mkcss'; s.textContent = css; document.head.appendChild(s); } }

  function render(el, opts) {
    style(); host = el; if (opts && opts.sym) { S.sym = opts.sym; S.tab = 'chart'; }
    el.innerHTML = '<div class="mk"><div class="mk-top" id="mktop"></div><div class="mk-body" id="mkbody"></div></div>';
    paintTop(); draw();
    clearInterval(timer); timer = setInterval(() => { if (!host || !document.body.contains(host)) { clearInterval(timer); return; } if (document.hidden) return; if (S.tab === 'overview' || S.tab === 'watch' || S.tab === 'port') draw(true); else if (S.tab === 'chart' && (S.range === '1d' || S.range === '5d')) loadChart(true); }, 30000);
  }
  function paintTop() {
    const t = host.querySelector('#mktop'), [ss, sc] = session();
    t.innerHTML = TABS.map(([k, l]) => '<button class="mk-btn' + (S.tab === k ? ' on' : '') + '" data-t="' + k + '">' + l + '</button>').join('') +
      '<span style="flex:1"></span><span class="small" style="color:' + sc + '">● ' + ss + ' (New York)</span><div style="position:relative"><input id="mkq" placeholder="Symbol or company…" style="width:200px" autocomplete="off"><div class="mk-sug" id="mksug" style="display:none"></div></div>';
    t.onclick = e => { const b = e.target.closest('[data-t]'); if (b) { S.tab = b.dataset.t; keep(); paintTop(); draw(); } };
    const q = t.querySelector('#mkq'), sug = t.querySelector('#mksug');
    let tm = 0;
    q.oninput = () => { clearTimeout(tm); const v = q.value.trim(); if (!v) { sug.style.display = 'none'; return; } tm = setTimeout(async () => { const r = await api('/api/mk/search?q=' + encodeURIComponent(v)); if (r.error === 'off') { sug.innerHTML = '<div>Internet access is off.</div>'; sug.style.display = ''; return; } sug.innerHTML = ((r.results || []).map(x => '<div data-s="' + esc(x.symbol) + '"><b>' + esc(x.symbol) + '</b> ' + esc(x.name) + ' <span class="mute small">' + esc(x.type + ' · ' + x.exchange) + '</span></div>').join('')) || '<div class="mute">No matches.</div>'; sug.style.display = ''; }, 250); };
    q.onkeydown = e => { if (e.key === 'Enter') { const first = sug.querySelector('[data-s]'); open(first ? first.dataset.s : q.value.trim().toUpperCase()); sug.style.display = 'none'; q.value = ''; } if (e.key === 'Escape') { sug.style.display = 'none'; e.stopPropagation(); } };
    sug.onclick = e => { const d = e.target.closest('[data-s]'); if (d) { open(d.dataset.s); sug.style.display = 'none'; q.value = ''; } };
  }
  function open(sym) { if (!sym) return; S.sym = sym.toUpperCase(); S.tab = 'chart'; keep(); paintTop(); draw(); }
  const body = () => host.querySelector('#mkbody');
  const offMsg = '<div class="mk-card">🔌 Internet access is off, so there are no market numbers to show. Turn it on in the News tab (or Settings, Privacy).</div>';
  async function draw(quiet) {
    if (!host) return; const b = body();
    if (!quiet) b.innerHTML = '<div class="mute">Loading…</div>';
    try {
      if (S.tab === 'overview') await overview(b);
      else if (S.tab === 'watch') await watchlist(b);
      else if (S.tab === 'chart') await company(b, quiet);
      else if (S.tab === 'tools') tools(b);
      else if (S.tab === 'port') await portfolio(b);
      else if (S.tab === 'macro') await macro(b);
    } catch (e) { b.innerHTML = '<div class="mk-card" style="color:var(--bad)">Something went wrong: ' + esc(e.message) + '</div>'; }
    if (!quiet) b.insertAdjacentHTML('beforeend', '<p class="mk-note" style="margin-top:22px">Data: CNBC (quotes, real-time for most US stocks, delayed for some markets), Yahoo Finance (charts), the SEC (filings and audited statements), the U.S. Treasury and FRED (rates and the economy). Check prices with your broker before you trade. Moundshroud shows the numbers and does the arithmetic; it does not recommend trades, and past prices do not predict future ones. Privacy: the services above see which symbols are looked up, not who you are; your watchlist, alerts, holdings and journal never leave this PC.</p>');
  }
  async function getQuotes(list) {
    const r = await api('/api/mk/quotes?s=' + encodeURIComponent(list.join(',')));
    if (r.quotes) { r.quotes.forEach(q => { quoteCache[q.symbol] = q; }); checkAlerts(r.quotes); }
    return r;
  }
  function checkAlerts(qs) {
    let hit = false;
    alerts.forEach(a => { if (a.fired) return; const q = qs.find(x => x.symbol === a.sym); if (!q || q.last == null) return; if ((a.op === '>=' && q.last >= a.price) || (a.op === '<=' && q.last <= a.price)) { a.fired = Date.now(); hit = true; A.notify('warn', '🔔 ' + a.sym + ' is ' + f2(q.last) + ' (' + (a.op === '>=' ? 'at or above ' : 'at or below ') + f2(a.price) + ')' + (a.note ? ': ' + a.note : ''), 15000); } });
    if (hit) save('mk_alerts', alerts);
  }
  /* a price that moved since the last update flashes green or red */
  const PREV = {};
  const flash = q => { const p = PREV[q.symbol]; PREV[q.symbol] = q.last; return p == null || q.last == null || p === q.last ? '' : q.last > p ? ' mk-flash-up' : ' mk-flash-down'; };
  const tile = q => '<div class="mk-tile' + flash(q) + '" data-o="' + esc(q.symbol) + '"><b>' + esc(nm(q.symbol, q)) + '</b><div class="p">' + f2(q.last) + (/^US\d/.test(q.symbol) ? '%' : '') + '</div><div class="c" style="color:' + col(q.change) + '">' + (q.change > 0 ? '+' : '') + f2(q.change) + ' (' + pc(q.pct) + ')</div></div>';

  /* ---------- overview ---------- */
  async function overview(b) {
    const all = GROUPS.flatMap(g => g[1]), r = await getQuotes(all.concat(watch.filter(s => !all.includes(s))));
    if (r.error === 'off') { b.innerHTML = offMsg; return; } if (r.error) { b.innerHTML = '<div class="mk-card">Could not get quotes: ' + esc(r.error) + '</div>'; return; }
    const Q = s => quoteCache[s];
    const mv = watch.map(Q).filter(q => q && q.pct != null && !/^\./.test(q.symbol)).sort((a, c) => c.pct - a.pct);
    let h = GROUPS.map(([g, syms]) => '<div class="mk-h3">' + g + '</div><div class="mk-g">' + syms.map(Q).filter(Boolean).map(tile).join('') + '</div>').join('');
    if (mv.length) h += '<div class="mk-h3">Your watchlist: biggest moves today</div><div class="mk-g">' + mv.slice(0, 4).concat(mv.slice(-4).reverse()).filter((q, i, a) => a.indexOf(q) === i).map(tile).join('') + '</div>';
    const D = A.newsTab && A.newsTab.data ? A.newsTab.data() : null, ev = D ? D.events.filter(e => e.cat === 'business').slice(0, 8) : [];
    if (ev.length) h += '<div class="mk-h3">Business news (events from the News tab)</div>' + ev.map(e => '<div class="mk-card" style="padding:8px 12px;margin-bottom:6px;cursor:pointer" data-ev="' + e.id + '"><b>' + esc(e.title) + '</b><div class="small mute">' + e.outlets.length + ' outlets</div></div>').join('');
    b.innerHTML = h;
    b.onclick = e => { const t = e.target.closest('[data-o]'); if (t) return open(t.dataset.o); const x = e.target.closest('[data-ev]'); if (x && A.newsTab && A.newsTab.openEvent) A.newsTab.openEvent(x.dataset.ev); };
  }

  /* ---------- watchlist ---------- */
  async function watchlist(b) {
    const r = await getQuotes(watch);
    if (r.error === 'off') { b.innerHTML = offMsg; return; }
    const rows = watch.map(s => quoteCache[s] || { symbol: s }), sk = S.wsort || '';
    if (sk) rows.sort((a, c) => ((c[sk] == null ? -1e18 : c[sk]) - (a[sk] == null ? -1e18 : a[sk])) * (S.wdir || 1));
    const rng = (lo, hi, v) => lo != null && hi != null && hi > lo ? '<span class="mk-rng" title="' + f2(lo) + ' – ' + f2(hi) + '"><i style="left:' + Math.max(0, Math.min(100, (v - lo) / (hi - lo) * 100)) + '%"></i></span>' : '';
    b.innerHTML = '<div class="nw-row" style="margin-bottom:10px;gap:6px"><input id="mkadd" placeholder="Add a symbol, e.g. COST" style="width:180px"><button class="mk-btn" id="mkaddb">Add</button><span class="mk-note">Click a row for its chart. Column headers sort. 🔔 sets a price alert. Updates every 30 seconds.</span></div>' +
      '<div style="overflow:auto"><table class="mk-tbl"><tr><th>Symbol</th><th class="l">Name</th><th data-k="last">Last</th><th data-k="pct">Change</th><th data-k="extpct">After hours</th><th data-k="relvol">Volume (× 10-day avg)</th><th>Day range</th><th>52-week range</th><th data-k="pe">P/E</th><th data-k="mcap">Market cap</th><th>Earnings</th><th></th></tr>' +
      rows.map(q => { q.relvol = q.volume && q.avgVol10 ? q.volume / q.avgVol10 : null; q.extpct = q.ext ? q.ext.pct : null; const al = alerts.filter(a => a.sym === q.symbol && !a.fired).length;
        return '<tr class="r' + flash(q) + '" data-o="' + esc(q.symbol) + '"><td><b>' + esc(q.symbol) + '</b></td><td class="l" style="max-width:180px;overflow:hidden;text-overflow:ellipsis">' + esc(nm(q.symbol, q)) + '</td><td>' + f2(q.last) + '</td><td style="color:' + col(q.change) + '">' + (q.change > 0 ? '+' : '') + f2(q.change) + ' (' + pc(q.pct) + ')</td><td style="color:' + col(q.extpct) + '">' + (q.ext ? f2(q.ext.last) + ' ' + pc(q.ext.pct) : '') + '</td><td>' + big(q.volume) + (q.relvol ? ' (' + f2(q.relvol, 1) + '×)' : '') + '</td><td>' + rng(q.low, q.high, q.last) + '</td><td>' + rng(q.lo52, q.hi52, q.last) + '</td><td>' + f2(q.pe) + '</td><td>' + big(q.mcap) + '</td><td>' + esc((q.events && q.events.earnings) || '') + '</td><td><button class="mk-btn" data-al="' + esc(q.symbol) + '" title="Price alerts">🔔' + (al ? al : '') + '</button> <button class="mk-btn" data-rm="' + esc(q.symbol) + '" title="Remove">✕</button></td></tr>'; }).join('') + '</table></div>' +
      '<div class="mk-h3">Price alerts</div>' + (alerts.length ? '<table class="mk-tbl"><tr><th>Symbol</th><th>When</th><th>Price</th><th class="l">Note</th><th>Status</th><th></th></tr>' + alerts.map((a, i) => '<tr><td><b>' + esc(a.sym) + '</b></td><td>' + (a.op === '>=' ? 'at or above' : 'at or below') + '</td><td>' + f2(a.price) + '</td><td class="l">' + esc(a.note || '') + '</td><td>' + (a.fired ? '<span style="color:var(--warn)">triggered ' + new Date(a.fired).toLocaleString() + '</span>' : 'waiting') + '</td><td><button class="mk-btn" data-ad="' + i + '">✕</button></td></tr>').join('') + '</table>' : '<div class="mk-note">None yet. Alerts are checked whenever Markets is open and updating.</div>');
    b.onclick = async e => {
      const th = e.target.closest('th[data-k]'); if (th) { if (S.wsort === th.dataset.k) S.wdir = -(S.wdir || 1); else { S.wsort = th.dataset.k; S.wdir = 1; } keep(); watchlist(b); return; }
      const rm = e.target.closest('[data-rm]'); if (rm) { e.stopPropagation(); watch = watch.filter(x => x !== rm.dataset.rm); save('mk_watch', watch); watchlist(b); return; }
      const al = e.target.closest('[data-al]'); if (al) { e.stopPropagation(); const s = al.dataset.al, q = quoteCache[s] || {}, v = (await A.prompt('Alert for ' + s + ' (now ' + f2(q.last) + '). Type a price; start it with < for "at or below" (for example <150):', '')); if (!v) return; const below = /^\s*</.test(v), p = parseFloat(v.replace(/[^0-9.]/g, '')); if (!(p > 0)) return A.toast('That is not a price.'); const note = (await A.prompt('A note for yourself (optional):', '')) || ''; alerts.push({ sym: s, op: below ? '<=' : '>=', price: p, note }); save('mk_alerts', alerts); watchlist(b); return; }
      const ad = e.target.closest('[data-ad]'); if (ad) { alerts.splice(+ad.dataset.ad, 1); save('mk_alerts', alerts); watchlist(b); return; }
      if (e.target.id === 'mkaddb') { const v = b.querySelector('#mkadd').value.trim().toUpperCase(); if (v && !watch.includes(v)) { watch.push(v); save('mk_watch', watch); } watchlist(b); return; }
      const tr = e.target.closest('[data-o]'); if (tr) open(tr.dataset.o);
    };
    const ad = b.querySelector('#mkadd'); if (ad) ad.onkeydown = e => { if (e.key === 'Enter') b.querySelector('#mkaddb').click(); };
  }

  /* ---------- a company (or any symbol): chart, numbers, filings, statements, news ---------- */
  async function company(b, quiet) {
    if (!quiet) b.innerHTML = '<div class="mk-split"><div><div id="mkhead"></div><div class="nw-row" id="mkctl" style="gap:5px;margin:8px 0"></div><canvas class="mk-cv" id="mkcv"></canvas><div class="mk-note" id="mkread" style="min-height:18px;margin-top:4px"></div><div id="mklv"></div></div><div id="mkside"></div></div><div id="mkbelow"></div>';
    const qr = await getQuotes([S.sym]);
    if (qr.error === 'off') { b.innerHTML = offMsg; return; }
    head(); controls(); await loadChart(quiet);
    if (!quiet) { side(); below(); }
  }
  function head() {
    const q = quoteCache[S.sym] || { symbol: S.sym }, el = host.querySelector('#mkhead'); if (!el) return;
    const inW = watch.includes(S.sym);
    el.innerHTML = '<div class="nw-row" style="align-items:baseline;gap:10px"><h2 style="margin:0">' + esc(nm(S.sym, q)) + '</h2><span class="mute">' + esc(S.sym) + (q.exchange ? ' · ' + esc(q.exchange) : '') + (q.currency ? ' · ' + esc(q.currency) : '') + '</span><span style="flex:1"></span><button class="mk-btn" id="mkw">' + (inW ? '★ In watchlist' : '☆ Add to watchlist') + '</button></div>' +
      '<div class="nw-row" style="align-items:baseline;gap:10px"><span style="font-size:28px;font-weight:800">' + f2(q.last) + '</span><span style="font-size:16px;color:' + col(q.change) + '">' + (q.change > 0 ? '+' : '') + f2(q.change) + ' (' + pc(q.pct) + ')</span>' + (q.ext ? '<span class="small" style="color:' + col(q.ext.change) + '">' + (q.ext.type === 'PRE_MKT' ? 'Pre-market ' : 'After hours ') + f2(q.ext.last) + ' ' + pc(q.ext.pct) + '</span>' : '') + '<span class="small mute">' + (q.realTime ? 'real-time' : 'may be delayed') + (q.time ? ' · ' + new Date(q.time).toLocaleString([], { hour: 'numeric', minute: '2-digit', month: 'short', day: 'numeric' }) : '') + '</span></div>';
    el.querySelector('#mkw').onclick = () => { if (inW) watch = watch.filter(x => x !== S.sym); else watch.push(S.sym); save('mk_watch', watch); head(); };
  }
  function controls() {
    const el = host.querySelector('#mkctl'); if (!el) return;
    const R = [['1d', '1D'], ['5d', '5D'], ['1mo', '1M'], ['3mo', '3M'], ['6mo', '6M'], ['ytd', 'YTD'], ['1y', '1Y'], ['2y', '2Y'], ['5y', '5Y'], ['max', 'Max']];
    const I = [['sma20', 'SMA 20'], ['sma50', 'SMA 50'], ['sma200', 'SMA 200'], ['ema9', 'EMA 9'], ['ema21', 'EMA 21'], ['bb', 'Bollinger'], ['vwap', 'VWAP']];
    el.innerHTML = R.map(([k, l]) => '<button class="mk-btn' + (S.range === k ? ' on' : '') + '" data-r="' + k + '">' + l + '</button>').join('') + '<span style="width:8px"></span>' +
      ['candle', 'line'].map(k => '<button class="mk-btn' + (S.type === k ? ' on' : '') + '" data-ty="' + k + '">' + (k === 'candle' ? 'Candles' : 'Line') + '</button>').join('') + '<span style="width:8px"></span>' +
      I.map(([k, l]) => '<button class="mk-btn' + (S.ind[k] ? ' on' : '') + '" data-i="' + k + '">' + l + '</button>').join('') + '<span style="width:8px"></span>' +
      '<select id="mklow"><option value="vol"' + (S.lower === 'vol' ? ' selected' : '') + '>Volume only</option><option value="rsi"' + (S.lower === 'rsi' ? ' selected' : '') + '>+ RSI (14)</option><option value="macd"' + (S.lower === 'macd' ? ' selected' : '') + '>+ MACD (12, 26, 9)</option></select>' +
      '<button class="mk-btn' + (levelMode ? ' on' : '') + '" id="mklvb" title="Then click the chart to draw a price level (support, resistance, your stop or target)">＋ Level</button>';
    el.onclick = e => {
      const r = e.target.closest('[data-r]'); if (r) { S.range = r.dataset.r; keep(); controls(); loadChart(); return; }
      const t = e.target.closest('[data-ty]'); if (t) { S.type = t.dataset.ty; keep(); controls(); paint(); return; }
      const i = e.target.closest('[data-i]'); if (i) { S.ind[i.dataset.i] = S.ind[i.dataset.i] ? 0 : 1; keep(); controls(); paint(); return; }
      if (e.target.id === 'mklvb') { levelMode = !levelMode; controls(); A.toast(levelMode ? 'Click the chart where the level should be.' : 'Level drawing off.'); }
    };
    el.querySelector('#mklow').onchange = e => { S.lower = e.target.value; keep(); paint(); };
  }
  async function loadChart(quiet) {
    const r = await api('/api/mk/chart?s=' + encodeURIComponent(S.sym) + '&r=' + S.range);
    if (r.error) { chartData = null; const cv = host.querySelector('#mkcv'); if (cv) { const g = cv.getContext('2d'); g.clearRect(0, 0, cv.width, cv.height); } const rd = host.querySelector('#mkread'); if (rd) rd.textContent = r.error === 'off' ? 'Internet access is off.' : 'No chart for ' + S.sym + ' (' + r.error + ').'; return; }
    chartData = prepare(r); paint(); if (quiet) head();
    const cv = host.querySelector('#mkcv'); if (cv && !cv._wired) wireChart(cv);
  }
  /* the bars on screen, with the indicators worked out over the longer history behind them */
  function prepare(r) {
    const all = r.bars.filter(b => b.c != null && b.h != null && b.l != null), c = all.map(b => b.c);
    const ind = { sma20: sma(c, 20), sma50: sma(c, 50), sma200: sma(c, 200), ema9: ema(c, 9), ema21: ema(c, 21), bb: boll(c, 20, 2), rsi: rsi(c, 14), macd: macd(c), atr: atr(all, 14), vwap: vwap(all) };
    const now = Date.now(), y0 = new Date(new Date().getFullYear(), 0, 1).getTime();
    const want = { '3mo': 63, '6mo': 126, '1y': 252, '2y': 504, '5y': 261 }[S.range];
    let from = 0; if (S.range === 'ytd') from = Math.max(0, all.findIndex(b => b.t >= y0)); else if (want) from = Math.max(0, all.length - want);
    return { r, all, from, ind };
  }
  const COLORS = { sma20: '#f2c94c', sma50: '#46d7c8', sma200: '#ff8a5c', ema9: '#b78cff', ema21: '#7aa2ff', vwap: '#ff6bd6', bb: 'rgba(160,170,200,.7)' };
  function paint() {
    const cv = host && host.querySelector('#mkcv'); if (!cv || !chartData) return;
    const dpr = Math.min(2, devicePixelRatio || 1), W = cv.clientWidth, H = cv.clientHeight; cv.width = W * dpr; cv.height = H * dpr;
    const g = cv.getContext('2d'); g.setTransform(dpr, 0, 0, dpr, 0, 0); g.clearRect(0, 0, W, H);
    const { all, from, ind } = chartData, bars = all.slice(from), n = bars.length; if (!n) return;
    const lowerH = S.lower === 'vol' ? 0 : 95, volH = 60, padR = 64, padT = 10, padB = 22, mainH = H - padT - padB - lowerH - volH - (lowerH ? 10 : 0);
    const x0 = 8, cw = (W - padR - x0) / n, xs = i => x0 + i * cw + cw / 2;
    let lo = Infinity, hi = -Infinity; bars.forEach(b => { lo = Math.min(lo, b.l); hi = Math.max(hi, b.h); });
    const overl = ['sma20', 'sma50', 'sma200', 'ema9', 'ema21', 'vwap'].filter(k => S.ind[k] && !(k === 'vwap' && !/^(1d|5d)$/.test(S.range)));
    overl.forEach(k => { for (let i = from; i < all.length; i++) { const v = ind[k][i]; if (v != null) { lo = Math.min(lo, v); hi = Math.max(hi, v); } } });
    if (S.ind.bb) for (let i = from; i < all.length; i++) { if (ind.bb.up[i] != null) { hi = Math.max(hi, ind.bb.up[i]); lo = Math.min(lo, ind.bb.dn[i]); } }
    (levels[S.sym] || []).forEach(v => { if (v > lo - (hi - lo) * .5 && v < hi + (hi - lo) * .5) { lo = Math.min(lo, v); hi = Math.max(hi, v); } });
    const pad = (hi - lo) * .05 || 1; lo -= pad; hi += pad;
    const ys = v => padT + (hi - v) / (hi - lo) * mainH;
    chartData.geom = { x0, cw, n, ys, lo, hi, padT, mainH, W, H, padR };
    /* grid and price axis */
    g.strokeStyle = 'rgba(255,255,255,.06)'; g.fillStyle = '#9aa3ba'; g.font = '11px Segoe UI'; g.lineWidth = 1;
    const step = niceStep((hi - lo) / 6);
    for (let v = Math.ceil(lo / step) * step; v <= hi; v += step) { const y = ys(v); g.beginPath(); g.moveTo(x0, y); g.lineTo(W - padR, y); g.stroke(); g.fillText(f2(v), W - padR + 6, y + 4); }
    /* time axis */
    const tf = S.range === '1d' ? { hour: 'numeric', minute: '2-digit' } : S.range === '5d' || S.range === '1mo' ? { month: 'short', day: 'numeric' } : /^(5y|max)$/.test(S.range) ? { year: 'numeric' } : { month: 'short', year: '2-digit' };
    const every = Math.max(1, Math.round(n / 7)); for (let i = 0; i < n; i += every) { g.fillText(new Date(bars[i].t).toLocaleString([], tf), xs(i) - 16, H - 6); }
    /* the regular session shaded on intraday charts, so pre- and after-hours trading stands out */
    if (S.range === '1d' && chartData.r.regular) { const rg = chartData.r.regular; let a = bars.findIndex(b => b.t >= rg.start), z = bars.findIndex(b => b.t > rg.end); if (z < 0) z = n; if (a >= 0) { g.fillStyle = 'rgba(139,124,255,.06)'; g.fillRect(xs(a) - cw / 2, padT, (z - a) * cw, mainH); } }
    if (chartData.r.prevClose != null && /^(1d|5d)$/.test(S.range)) { g.setLineDash([3, 4]); g.strokeStyle = 'rgba(255,255,255,.3)'; g.beginPath(); g.moveTo(x0, ys(chartData.r.prevClose)); g.lineTo(W - padR, ys(chartData.r.prevClose)); g.stroke(); g.setLineDash([]); }
    /* Bollinger band */
    if (S.ind.bb) { g.fillStyle = 'rgba(160,170,200,.07)'; g.beginPath(); let st = false; for (let i = 0; i < n; i++) { const v = ind.bb.up[from + i]; if (v == null) continue; if (!st) { g.moveTo(xs(i), ys(v)); st = true; } else g.lineTo(xs(i), ys(v)); } for (let i = n - 1; i >= 0; i--) { const v = ind.bb.dn[from + i]; if (v != null) g.lineTo(xs(i), ys(v)); } g.fill(); ['up', 'dn', 'm'].forEach(k => line(g, ind.bb[k], from, n, xs, ys, COLORS.bb, k === 'm' ? [4, 4] : null)); }
    /* price */
    if (S.type === 'line') {
      const up = bars[n - 1].c >= bars[0].c, c0 = up ? '#5ee6a8' : '#ff6b81';
      g.beginPath(); bars.forEach((b, i) => { i ? g.lineTo(xs(i), ys(b.c)) : g.moveTo(xs(i), ys(b.c)); }); g.strokeStyle = c0; g.lineWidth = 1.6; g.stroke();
      g.lineTo(xs(n - 1), padT + mainH); g.lineTo(xs(0), padT + mainH); g.closePath(); const gr = g.createLinearGradient(0, padT, 0, padT + mainH); gr.addColorStop(0, up ? 'rgba(94,230,168,.18)' : 'rgba(255,107,129,.18)'); gr.addColorStop(1, 'rgba(0,0,0,0)'); g.fillStyle = gr; g.fill();
    } else {
      const bw = Math.max(1, Math.min(9, cw * .7));
      bars.forEach((b, i) => { const upb = b.c >= b.o, c0 = upb ? '#5ee6a8' : '#ff6b81'; g.strokeStyle = c0; g.fillStyle = c0; g.lineWidth = 1; g.beginPath(); g.moveTo(xs(i), ys(b.h)); g.lineTo(xs(i), ys(b.l)); g.stroke(); const yo = ys(b.o), yc = ys(b.c); g.fillRect(xs(i) - bw / 2, Math.min(yo, yc), bw, Math.max(1, Math.abs(yc - yo))); });
    }
    overl.forEach(k => line(g, ind[k], from, n, xs, ys, COLORS[k]));
    /* your levels */
    (levels[S.sym] || []).forEach(v => { const y = ys(v); g.strokeStyle = 'rgba(242,201,76,.85)'; g.setLineDash([6, 4]); g.beginPath(); g.moveTo(x0, y); g.lineTo(W - padR, y); g.stroke(); g.setLineDash([]); g.fillStyle = 'rgba(242,201,76,.95)'; g.fillRect(W - padR + 2, y - 8, padR - 4, 16); g.fillStyle = '#111'; g.fillText(f2(v), W - padR + 5, y + 4); });
    /* last price tag */
    const last = bars[n - 1].c, yl = ys(last); g.fillStyle = bars[n - 1].c >= (bars[n - 2] || bars[n - 1]).c ? '#5ee6a8' : '#ff6b81'; g.fillRect(W - padR + 2, yl - 8, padR - 4, 16); g.fillStyle = '#0e1016'; g.fillText(f2(last), W - padR + 5, yl + 4);
    /* volume */
    const vy0 = padT + mainH + 4; let vmax = 0; bars.forEach(b => { vmax = Math.max(vmax, b.v || 0); });
    if (vmax) bars.forEach((b, i) => { const h = (b.v || 0) / vmax * (volH - 6); g.fillStyle = b.c >= b.o ? 'rgba(94,230,168,.35)' : 'rgba(255,107,129,.35)'; g.fillRect(xs(i) - Math.max(1, cw * .35), vy0 + volH - h, Math.max(1, cw * .7), h); });
    /* lower pane */
    if (lowerH) {
      const ly0 = vy0 + volH + 10, lh = lowerH - 4; g.strokeStyle = 'rgba(255,255,255,.08)'; g.strokeRect(x0, ly0, W - padR - x0, lh);
      if (S.lower === 'rsi') { const ry = v => ly0 + (100 - v) / 100 * lh; [30, 70].forEach(v => { g.setLineDash([3, 4]); g.strokeStyle = 'rgba(255,255,255,.2)'; g.beginPath(); g.moveTo(x0, ry(v)); g.lineTo(W - padR, ry(v)); g.stroke(); g.setLineDash([]); g.fillStyle = '#9aa3ba'; g.fillText(String(v), W - padR + 6, ry(v) + 4); }); line(g, ind.rsi, from, n, xs, ry, '#b78cff'); g.fillText('RSI 14', x0 + 4, ly0 + 12); }
      else { let m = 0; for (let i = from; i < all.length; i++) ['m', 'sig', 'h'].forEach(k => { const v = ind.macd[k][i]; if (v != null) m = Math.max(m, Math.abs(v)); }); m = m || 1; const my = v => ly0 + lh / 2 - v / m * (lh / 2 - 2);
        for (let i = 0; i < n; i++) { const v = ind.macd.h[from + i]; if (v == null) continue; g.fillStyle = v >= 0 ? 'rgba(94,230,168,.5)' : 'rgba(255,107,129,.5)'; g.fillRect(xs(i) - Math.max(1, cw * .35), Math.min(my(0), my(v)), Math.max(1, cw * .7), Math.abs(my(v) - my(0))); }
        line(g, ind.macd.m, from, n, xs, my, '#7aa2ff'); line(g, ind.macd.sig, from, n, xs, my, '#ff8a5c'); g.fillStyle = '#9aa3ba'; g.fillText('MACD 12/26/9', x0 + 4, ly0 + 12); }
    }
    /* crosshair */
    if (hoverIdx >= 0 && hoverIdx < n) { g.strokeStyle = 'rgba(255,255,255,.35)'; g.setLineDash([2, 3]); g.beginPath(); g.moveTo(xs(hoverIdx), padT); g.lineTo(xs(hoverIdx), H - padB); g.stroke(); g.setLineDash([]); }
    readout();
  }
  function line(g, arr, from, n, xs, ys, color, dash) { g.strokeStyle = color; g.lineWidth = 1.3; if (dash) g.setLineDash(dash); g.beginPath(); let st = false; for (let i = 0; i < n; i++) { const v = arr[from + i]; if (v == null) { st = false; continue; } if (!st) { g.moveTo(xs(i), ys(v)); st = true; } else g.lineTo(xs(i), ys(v)); } g.stroke(); g.setLineDash([]); }
  function niceStep(r) { const p = Math.pow(10, Math.floor(Math.log10(r || 1))), m = r / p; return (m < 1.5 ? 1 : m < 3 ? 2 : m < 7 ? 5 : 10) * p; }
  function readout() {
    const el = host.querySelector('#mkread'); if (!el || !chartData) return;
    const { all, from, ind } = chartData, i = hoverIdx >= 0 ? from + hoverIdx : all.length - 1, b = all[i]; if (!b) return;
    const prev = all[i - 1], ch = prev ? (b.c - prev.c) / prev.c * 100 : null;
    const parts = ['<b>' + new Date(b.t).toLocaleString([], /^(1d|5d|1mo)$/.test(S.range) ? { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' } : { year: 'numeric', month: 'short', day: 'numeric' }) + '</b>', 'O ' + f2(b.o), 'H ' + f2(b.h), 'L ' + f2(b.l), 'C <b>' + f2(b.c) + '</b>' + (ch != null ? ' <span style="color:' + col(ch) + '">' + pc(ch) + '</span>' : ''), 'Vol ' + big(b.v)];
    ['sma20', 'sma50', 'sma200', 'ema9', 'ema21', 'vwap'].forEach(k => { if (S.ind[k] && ind[k][i] != null) parts.push('<span style="color:' + COLORS[k] + '">' + k.toUpperCase().replace(/(\D+)(\d+)/, '$1 $2') + ' ' + f2(ind[k][i]) + '</span>'); });
    if (S.lower === 'rsi' && ind.rsi[i] != null) parts.push('RSI ' + f2(ind.rsi[i], 1)); if (S.lower === 'macd' && ind.macd.m[i] != null) parts.push('MACD ' + f2(ind.macd.m[i], 3) + ' / ' + f2(ind.macd.sig[i], 3));
    el.innerHTML = parts.join(' · ');
  }
  function wireChart(cv) {
    cv._wired = true;
    cv.addEventListener('mousemove', e => { const gm = chartData && chartData.geom; if (!gm) return; const x = e.offsetX, i = Math.floor((x - gm.x0) / gm.cw); hoverIdx = i >= 0 && i < gm.n ? i : -1; paint(); });
    cv.addEventListener('mouseleave', () => { hoverIdx = -1; paint(); });
    cv.addEventListener('click', e => {
      const gm = chartData && chartData.geom; if (!gm || !levelMode) return;
      const v = gm.hi - (e.offsetY - gm.padT) / gm.mainH * (gm.hi - gm.lo); if (!(v > 0)) return;
      const p = +v.toPrecision(5); (levels[S.sym] = levels[S.sym] || []).push(p); save('mk_levels', levels); levelMode = false; controls(); paint(); levelList();
    });
    new ResizeObserver(() => paint()).observe(cv);
    levelList();
  }
  function levelList() {
    const el = host.querySelector('#mklv'); if (!el) return; const L = levels[S.sym] || [];
    el.innerHTML = L.length ? '<div class="nw-row" style="gap:6px;margin-top:6px"><span class="mk-note">Your levels:</span>' + L.map((v, i) => '<span class="mk-btn">' + f2(v) + ' <a href="#" data-lal="' + i + '" title="Alert me at this price">🔔</a> <a href="#" data-ldel="' + i + '" title="Remove">✕</a></span>').join('') + '</div>' : '';
    el.onclick = e => { e.preventDefault(); const d = e.target.closest('[data-ldel]'); if (d) { L.splice(+d.dataset.ldel, 1); save('mk_levels', levels); levelList(); paint(); return; } const a = e.target.closest('[data-lal]'); if (a) { const v = L[+a.dataset.lal], q = quoteCache[S.sym] || {}; alerts.push({ sym: S.sym, op: q.last != null && v < q.last ? '<=' : '>=', price: v, note: 'level' }); save('mk_alerts', alerts); A.toast('Alert set at ' + f2(v) + '.'); } };
  }
  /* the numbers beside the chart: what the quote says, and what the price history says */
  function side() {
    const el = host.querySelector('#mkside'); if (!el) return; const q = quoteCache[S.sym] || {};
    const kv = rows => '<div class="mk-kv">' + rows.filter(r => r[1] != null && r[1] !== '–' && r[1] !== '').map(r => '<div><span>' + r[0] + '</span><b>' + r[1] + '</b></div>').join('') + '</div>';
    let h = '<div class="mk-card"><h4>Key statistics</h4>' + kv([['Open', f2(q.open)], ['Day high', f2(q.high)], ['Day low', f2(q.low)], ['Previous close', f2(q.prev)], ['Volume', big(q.volume)], ['10-day avg volume', big(q.avgVol10)], ['52-week high', f2(q.hi52)], ['52-week low', f2(q.lo52)], ['Market cap', big(q.mcap)], ['P/E (trailing)', f2(q.pe)], ['P/E (forward)', f2(q.fpe)], ['EPS (trailing)', f2(q.eps)], ['EPS (forward)', f2(q.feps)], ['Price/sales', f2(q.ps)], ['Beta', f2(q.beta)], ['Dividend', q.div ? f2(q.div) + ' (' + f2(q.yield) + '%)' : null], ['Revenue (12 mo)', big(q.revenue)], ['Net margin', q.margin != null ? f2(q.margin) + '%' : null], ['Gross margin', q.gross != null ? f2(q.gross) + '%' : null], ['Return on equity', q.roe != null ? f2(q.roe) + '%' : null], ['Debt/equity', q.de != null ? f2(q.de) + '%' : null], ['Next earnings', q.events && q.events.earnings], ['Ex-dividend', q.events && q.events.exdiv]]) + '</div>';
    const T = technicals(); if (T) h += '<div class="mk-card"><h4>From the price history</h4>' + kv(T.rows) + (T.facts.length ? '<ul style="margin:8px 0 0 16px;padding:0;font-size:12.5px;line-height:1.5">' + T.facts.map(f => '<li>' + f + '</li>').join('') + '</ul>' : '') + '<div class="mk-note" style="margin-top:6px">Facts about past prices, not predictions or advice.</div></div>';
    el.innerHTML = h;
  }
  function technicals() {
    if (!chartData) return null; const daily = /^(3mo|6mo|ytd|1y|2y)$/.test(S.range); if (!daily) return { rows: [['(switch to 3M–2Y for daily statistics)', '']], facts: [] };
    const { all, ind } = chartData, c = all.map(b => b.c), L = c.length - 1, last = c[L];
    const ret = d => L - d >= 0 ? (last / c[L - d] - 1) * 100 : null;
    const y0 = new Date(new Date().getFullYear(), 0, 1).getTime(), yi = all.findIndex(b => b.t >= y0);
    const lr = []; for (let i = Math.max(1, L - 20); i <= L; i++) lr.push(Math.log(c[i] / c[i - 1])); const mu = lr.reduce((a, b) => a + b, 0) / lr.length, vol = Math.sqrt(lr.reduce((a, b) => a + (b - mu) ** 2, 0) / (lr.length - 1)) * Math.sqrt(252) * 100;
    let peak = -Infinity, mdd = 0; for (let i = Math.max(0, L - 251); i <= L; i++) { peak = Math.max(peak, c[i]); mdd = Math.min(mdd, c[i] / peak - 1); }
    const a14 = ind.atr[L], p = all[L - 1] ? all[L - 1] : all[L], P = (p.h + p.l + p.c) / 3;
    const sw = all.slice(-20), swHi = Math.max(...sw.map(b => b.h)), swLo = Math.min(...sw.map(b => b.l));
    const rows = [['Change 1 week', pc(ret(5))], ['Change 1 month', pc(ret(21))], ['Change 3 months', pc(ret(63))], ['Year to date', yi >= 0 ? pc((last / c[Math.max(0, yi - 1)] - 1) * 100) : null], ['Change 1 year', pc(ret(252))], ['Volatility (20-day, yearly rate)', f2(vol) + '%'], ['ATR (14)', a14 != null ? f2(a14) + ' (' + f2(a14 / last * 100) + '%)' : null], ['Largest drop from a high (1 yr)', f2(mdd * 100) + '%'], ['RSI (14)', f2(ind.rsi[L], 1)], ['SMA 50', f2(ind.sma50[L])], ['SMA 200', f2(ind.sma200[L])], ['20-day high', f2(swHi)], ['20-day low', f2(swLo)], ['Pivot (from yesterday)', f2(P)], ['Resistance R1 / R2', f2(2 * P - p.l) + ' / ' + f2(P + (p.h - p.l))], ['Support S1 / S2', f2(2 * P - p.h) + ' / ' + f2(P - (p.h - p.l))]];
    const facts = [];
    if (ind.sma50[L] != null && ind.sma200[L] != null) { facts.push('Price is ' + (last > ind.sma50[L] ? 'above' : 'below') + ' its 50-day average (' + pc((last / ind.sma50[L] - 1) * 100) + ') and ' + (last > ind.sma200[L] ? 'above' : 'below') + ' its 200-day average (' + pc((last / ind.sma200[L] - 1) * 100) + ').'); for (let i = L; i > L - 250 && i > 0; i--) { const a = ind.sma50[i] - ind.sma200[i], b = ind.sma50[i - 1] - ind.sma200[i - 1]; if (ind.sma200[i - 1] != null && Math.sign(a) !== Math.sign(b)) { facts.push('The 50-day average crossed ' + (a > 0 ? 'above' : 'below') + ' the 200-day average ' + (L - i) + ' trading days ago (a "' + (a > 0 ? 'golden' : 'death') + ' cross").'); break; } } }
    const r = ind.rsi[L]; if (r != null) facts.push('RSI is ' + f2(r, 0) + (r >= 70 ? ', in the range traders call overbought (70+).' : r <= 30 ? ', in the range traders call oversold (30 or less).' : ', between the usual 30 and 70 marks.'));
    if (a14) facts.push('A typical day’s range lately is about ' + f2(a14) + ' (' + f2(a14 / last * 100, 1) + '% of the price); stops closer than that are often hit by ordinary noise.');
    const q = quoteCache[S.sym]; if (q && q.volume && q.avgVol10) facts.push('Today’s volume is ' + f2(q.volume / q.avgVol10, 1) + '× the 10-day average.');
    chartData.atrLast = a14;
    return { rows, facts };
  }
  async function below() {
    const el = host.querySelector('#mkbelow'); if (!el) return; const q = quoteCache[S.sym] || {};
    el.innerHTML = '<div class="mk-split" style="margin-top:14px"><div><div class="mk-card" id="mkfin"><h4>Financial statements (from SEC filings)</h4><div class="mk-note">Loading…</div></div><div class="mk-card" id="mknews"><h4>In the news (last two weeks)</h4><div class="mk-note">Searching…</div></div></div><div class="mk-card" id="mkfil"><h4>SEC filings</h4><div class="mk-note">Loading…</div></div></div>';
    const isCo = !/^[.@^]|=|^US\d/.test(S.sym);
    if (!isCo) { el.querySelector('#mkfin').innerHTML = '<h4>Financial statements</h4><div class="mk-note">Not a company.</div>'; el.querySelector('#mkfil').innerHTML = '<h4>SEC filings</h4><div class="mk-note">Not a company.</div>'; }
    else {
      api('/api/mk/facts?s=' + encodeURIComponent(S.sym)).then(f => { const box = el.querySelector('#mkfin'); if (!box) return; box.innerHTML = '<h4>Financial statements (from SEC filings)</h4>' + fin(f); });
      api('/api/mk/filings?s=' + encodeURIComponent(S.sym)).then(f => { const box = el.querySelector('#mkfil'); if (!box) return; box.innerHTML = '<h4>SEC filings</h4>' + (f.filings && f.filings.length ? '<div style="max-height:620px;overflow:auto">' + f.filings.map(x => '<div style="padding:5px 0;border-bottom:1px solid var(--line);font-size:12.5px"><b>' + esc(x.form) + '</b> <span class="mute">' + esc(x.date) + '</span><div>' + esc(x.what || x.title) + (x.items ? ' <span class="mute">' + esc(x.items.slice(0, 120)) + '</span>' : '') + '</div><a href="' + esc(x.link) + '" target="_blank" rel="noopener noreferrer">Open on sec.gov ↗</a></div>').join('') + '</div><div class="mk-note" style="margin-top:6px">Form 4 = an insider bought or sold; 8-K = something material happened; 10-Q/10-K = quarterly/annual report.</div>' : '<div class="mk-note">' + esc(f.error === 'off' ? 'Internet access is off.' : f.error || 'No filings.') + '</div>'); });
    }
    const name = String(q.name || '').replace(/,?\s+(Inc|Corp|Corporation|Co|Company|Ltd|Plc|Holdings|Group|Class [A-C]|Common Stock)\.?\b.*$/i, '').trim();
    const query = isCo && name ? '"' + name + '"' : (NAMES[S.sym] || name || S.sym);
    const r = await api('/api/news/search?q=' + encodeURIComponent(query)); const box = el.querySelector('#mknews'); if (!box) return;
    box.innerHTML = '<h4>In the news (last two weeks) <span style="text-transform:none;letter-spacing:0;font-weight:400">· ' + esc(query) + '</span></h4>' + ((r.items || []).length ? r.items.slice(0, 20).map(a => '<div style="padding:5px 0;border-bottom:1px solid var(--line);font-size:13px"><a href="' + esc(a.link) + '" target="_blank" rel="noopener noreferrer">' + esc(a.title) + '</a><div class="mk-note">' + esc(a.src) + ' · ' + new Date(a.date).toLocaleString([], { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }) + '</div></div>').join('') : '<div class="mk-note">Nothing in the news archive yet.</div>');
  }
  function fin(f) {
    if (!f || f.error) return '<div class="mk-note">' + esc(f && f.error === 'off' ? 'Internet access is off.' : (f && f.error) || 'Not available.') + '</div>';
    const A0 = f.annual || {}, yrs = [...new Set(Object.values(A0).flatMap(a => a.map(x => x.end)))].sort().slice(-5);
    if (!yrs.length) return '<div class="mk-note">No annual figures filed in the standard format.</div>';
    const at = (k, y) => { const r = (A0[k] || []).find(x => x.end === y); return r ? r.v : null; };
    const fcf = y => at('opCashFlow', y) != null && at('capex', y) != null ? at('opCashFlow', y) - at('capex', y) : null;
    const rows = [['Revenue', y => at('revenue', y), 1], ['Gross margin', y => at('grossProfit', y) && at('revenue', y) ? at('grossProfit', y) / at('revenue', y) * 100 : null, 2], ['Operating margin', y => at('operatingIncome', y) && at('revenue', y) ? at('operatingIncome', y) / at('revenue', y) * 100 : null, 2], ['Net income', y => at('netIncome', y), 1], ['EPS (diluted)', y => at('eps', y), 3], ['Free cash flow', fcf, 1], ['Cash', y => at('cash', y), 1], ['Long-term debt', y => at('debt', y), 1], ['Shareholders’ equity', y => at('equity', y), 1], ['Dividends paid', y => at('dividendsPaid', y), 1]];
    const fmt = (v, t) => v == null ? '–' : t === 2 ? f2(v, 1) + '%' : t === 3 ? f2(v) : big(v);
    const growth = k => { const a = at(k, yrs[yrs.length - 1]), b = at(k, yrs[yrs.length - 2]); return a != null && b ? pc((a / b - 1) * 100) : ''; };
    return '<div style="overflow:auto"><table class="mk-tbl"><tr><th class="l">Fiscal year ending</th>' + yrs.map(y => '<th>' + y.slice(0, 7) + '</th>').join('') + '<th>Last year</th></tr>' + rows.map(([l, fn, t]) => '<tr><td class="l">' + l + '</td>' + yrs.map(y => '<td>' + fmt(fn(y), t) + '</td>').join('') + '<td>' + (l === 'Revenue' ? growth('revenue') : l === 'Net income' ? growth('netIncome') : l === 'EPS (diluted)' ? growth('eps') : '') + '</td></tr>').join('') + '</table></div><div class="mk-note" style="margin-top:6px">From ' + esc(f.name || '') + '’s 10-K filings (XBRL data published by the SEC). Free cash flow = operating cash flow − capital spending.</div>';
  }

  /* ---------- the trade tools ---------- */
  function tools(b) {
    const q = quoteCache[S.sym] || {}, px = q.last || '';
    const input = (id, label, val, step) => '<label>' + label + '<input type="number" id="' + id + '" value="' + val + '" step="' + (step || 'any') + '"></label>';
    b.innerHTML =
      '<div class="mk-card"><h4>Position size: how many shares, for the risk you choose</h4><div class="mk-in">' + input('ps_acct', 'Account size ($)', J('mk_acct', 10000)) + input('ps_risk', 'Risk per trade (% of account)', J('mk_riskpct', 1)) + '<label>Direction<select id="ps_side"><option value="long">Long (buy)</option><option value="short">Short (sell)</option></select></label>' + input('ps_entry', 'Entry price', px) + input('ps_stop', 'Stop-loss price', '') + input('ps_target', 'Target price (optional)', '') + '</div>' +
      '<div class="nw-row" style="margin-top:8px;gap:6px"><span class="mk-note">Symbol for the ATR helper: <b>' + esc(S.sym) + '</b></span><button class="mk-btn" id="ps_atr">Stop at 1.5 × ATR</button><button class="mk-btn" id="ps_atr2">Stop at 2 × ATR</button></div><div class="mk-out" id="ps_out"></div></div>' +
      '<div class="mk-card"><h4>Profit and loss of a trade, after costs</h4><div class="mk-in"><label>Direction<select id="pl_side"><option value="long">Long</option><option value="short">Short</option></select></label>' + input('pl_qty', 'Shares', 100) + input('pl_entry', 'Entry price', px) + input('pl_exit', 'Exit price', '') + input('pl_comm', 'Commission per order ($)', 0) + input('pl_fee', 'Other fees ($)', 0) + '</div><div class="mk-out" id="pl_out"></div></div>' +
      '<div class="mk-card"><h4>Your edge: expectancy, profit factor and Kelly</h4><div class="mk-in">' + input('ex_win', 'Win rate (%)', 45) + input('ex_aw', 'Average win ($)', 300) + input('ex_al', 'Average loss ($)', 150) + input('ex_n', 'Trades per month', 20) + '</div><div class="mk-out" id="ex_out"></div><div class="mk-note" style="margin-top:6px">Fill these from your journal (Portfolio &amp; journal fills them for you). Kelly is the bet size that maximises long-run growth on paper; most traders use a quarter to a half of it, because real win rates are uncertain.</div></div>' +
      '<div class="mk-card"><h4>Options: fair value and the Greeks (Black–Scholes)</h4><div class="mk-in"><label>Type<select id="op_type"><option value="call">Call</option><option value="put">Put</option></select></label>' + input('op_s', 'Stock price', px) + input('op_k', 'Strike', px ? Math.round(px) : '') + input('op_d', 'Days to expiry', 30) + input('op_iv', 'Implied volatility (%)', 30) + input('op_r', 'Interest rate (%)', 4.5) + input('op_q', 'Dividend yield (%)', q.yield || 0) + input('op_prem', 'Premium you would pay (optional)', '') + '</div><div class="mk-out" id="op_out"></div><div class="mk-note" style="margin-top:6px">European-style model; American options and early exercise are not modelled. Take implied volatility from your broker’s option chain.</div></div>' +
      '<div class="mk-card"><h4>Compounding</h4><div class="mk-in">' + input('cg_p', 'Starting amount ($)', 10000) + input('cg_m', 'Added each month ($)', 500) + input('cg_r', 'Yearly return (%)', 7) + input('cg_y', 'Years', 20) + '</div><div class="mk-out" id="cg_out"></div></div>';
    const v = id => { const e = b.querySelector('#' + id); return e ? (e.tagName === 'SELECT' ? e.value : parseFloat(e.value)) : NaN; };
    const out = (id, items) => { b.querySelector('#' + id).innerHTML = items.map(([l, x, c]) => '<div><span>' + l + '</span><b' + (c ? ' style="color:' + c + '"' : '') + '>' + x + '</b></div>').join(''); };
    const calc = () => {
      /* position size */
      const acct = v('ps_acct'), rp = v('ps_risk'), side = v('ps_side'), en = v('ps_entry'), sp = v('ps_stop'), tg = v('ps_target');
      save('mk_acct', acct || 0); save('mk_riskpct', rp || 0);
      if (acct > 0 && rp > 0 && en > 0 && sp > 0 && ((side === 'long' && sp < en) || (side === 'short' && sp > en))) {
        const per = Math.abs(en - sp), risk$ = acct * rp / 100, sh = Math.floor(risk$ / per), val = sh * en, R = d => side === 'long' ? en + d * per : en - d * per;
        const items = [['Shares to trade', sh.toLocaleString()], ['Position value', '$' + f2(val)], ['Share of the account', f2(val / acct * 100, 1) + '%' + (val > acct ? ' (needs margin)' : ''), val > acct ? 'var(--warn)' : ''], ['Money at risk', '$' + f2(sh * per)], ['Risk per share', '$' + f2(per) + ' (' + f2(per / en * 100) + '%)'], ['1R / 2R / 3R price', f2(R(1)) + ' / ' + f2(R(2)) + ' / ' + f2(R(3))]];
        if (tg > 0) { const rr = Math.abs(tg - en) / per; items.push(['Reward : risk', f2(rr, 2) + ' : 1', rr >= 2 ? 'var(--ok)' : rr < 1 ? 'var(--bad)' : '']); items.push(['Win rate needed to break even', f2(100 / (1 + rr), 1) + '%']); items.push(['Profit at target', '$' + f2(sh * Math.abs(tg - en))]); }
        out('ps_out', items);
      } else out('ps_out', [['', '<span class="mk-note">Enter the account, the risk, an entry and a stop on the losing side of the entry.</span>']]);
      /* P&L */
      const ls2 = v('pl_side'), qn = v('pl_qty'), e1 = v('pl_entry'), x1 = v('pl_exit'), cm = v('pl_comm') || 0, fe = v('pl_fee') || 0;
      if (qn > 0 && e1 > 0 && x1 > 0) { const gross = (ls2 === 'long' ? x1 - e1 : e1 - x1) * qn, costs = 2 * cm + fe, net = gross - costs, be = ls2 === 'long' ? e1 + costs / qn : e1 - costs / qn; out('pl_out', [['Gross', '$' + f2(gross), col(gross)], ['Costs', '$' + f2(costs)], ['Net', '$' + f2(net), col(net)], ['Return on the position', pc(net / (e1 * qn) * 100), col(net)], ['Breakeven price', f2(be)]]); } else out('pl_out', [['', '<span class="mk-note">Enter shares, entry and exit.</span>']]);
      /* expectancy */
      const w = v('ex_win') / 100, aw = v('ex_aw'), al = Math.abs(v('ex_al')), nt = v('ex_n');
      if (w >= 0 && w <= 1 && aw > 0 && al > 0) { const e = w * aw - (1 - w) * al, pf = (w * aw) / ((1 - w) * al || 1e-9), b0 = aw / al, k = w - (1 - w) / b0; out('ex_out', [['Expected result per trade', '$' + f2(e), col(e)], ['Per month', nt > 0 ? '$' + f2(e * nt) : '–', col(e)], ['Profit factor', f2(pf, 2), pf > 1.5 ? 'var(--ok)' : pf < 1 ? 'var(--bad)' : ''], ['Payoff ratio (win ÷ loss)', f2(b0, 2)], ['Kelly fraction', k > 0 ? f2(k * 100, 1) + '% of the account' : 'no edge: do not size up', k > 0 ? '' : 'var(--bad)'], ['Half Kelly', k > 0 ? f2(k * 50, 1) + '%' : '–']]); } else out('ex_out', []);
      /* options */
      const ty = v('op_type'), s0 = v('op_s'), k0 = v('op_k'), t = v('op_d') / 365, iv = v('op_iv') / 100, r = v('op_r') / 100, qd = (v('op_q') || 0) / 100, prem = v('op_prem');
      if (s0 > 0 && k0 > 0 && t > 0 && iv > 0) { const g = bs(ty, s0, k0, t, iv, r, qd); const items = [['Fair value', '$' + f2(g.price)], ['Delta', f2(g.delta, 3)], ['Gamma', f2(g.gamma, 4)], ['Theta (per day)', '$' + f2(g.theta, 3)], ['Vega (per 1% vol)', '$' + f2(g.vega, 3)], ['Rho (per 1% rate)', '$' + f2(g.rho, 3)], ['Chance of expiring in the money', f2(g.itm * 100, 1) + '%'], ['Breakeven at expiry', f2(ty === 'call' ? k0 + (prem || g.price) : k0 - (prem || g.price))], ['Expected move by expiry (±1 sd)', '±' + f2(s0 * iv * Math.sqrt(t))]]; if (prem > 0) items.push(['Premium vs fair value', pc((prem / g.price - 1) * 100)]); out('op_out', items); } else out('op_out', []);
      /* compounding */
      const p0 = v('cg_p') || 0, pm = v('cg_m') || 0, yr = v('cg_r') / 100, ny = v('cg_y');
      if (ny > 0) { const mr = Math.pow(1 + yr, 1 / 12) - 1; let bal = p0; for (let i = 0; i < ny * 12; i++) bal = bal * (1 + mr) + pm; const paid = p0 + pm * ny * 12; out('cg_out', [['Final value', '$' + f2(bal, 0)], ['You put in', '$' + f2(paid, 0)], ['Growth', '$' + f2(bal - paid, 0), 'var(--ok)'], ['Multiple of what you put in', f2(bal / (paid || 1), 2) + '×']]); }
    };
    b.oninput = calc; b.onchange = calc;
    b.onclick = e => { if (e.target.id === 'ps_atr' || e.target.id === 'ps_atr2') { const a = chartData && chartData.atrLast; if (!a) return A.toast('Open ' + S.sym + ' in Chart & company on a daily range (3M to 2Y) first, so the ATR is known.'); const en = v('ps_entry'), m = e.target.id === 'ps_atr' ? 1.5 : 2; b.querySelector('#ps_stop').value = (v('ps_side') === 'long' ? en - m * a : en + m * a).toFixed(2); calc(); } };
    calc();
  }
  function ncdf(x) { const t = 1 / (1 + .2316419 * Math.abs(x)), d = .3989423 * Math.exp(-x * x / 2), p = d * t * (.3193815 + t * (-.3565638 + t * (1.781478 + t * (-1.821256 + t * 1.330274)))); return x > 0 ? 1 - p : p; }
  function bs(type, S0, K, T, s, r, q) {
    const d1 = (Math.log(S0 / K) + (r - q + s * s / 2) * T) / (s * Math.sqrt(T)), d2 = d1 - s * Math.sqrt(T), nd1 = Math.exp(-d1 * d1 / 2) / Math.sqrt(2 * Math.PI), eq = Math.exp(-q * T), er = Math.exp(-r * T);
    if (type === 'call') return { price: S0 * eq * ncdf(d1) - K * er * ncdf(d2), delta: eq * ncdf(d1), gamma: eq * nd1 / (S0 * s * Math.sqrt(T)), theta: (-S0 * eq * nd1 * s / (2 * Math.sqrt(T)) - r * K * er * ncdf(d2) + q * S0 * eq * ncdf(d1)) / 365, vega: S0 * eq * nd1 * Math.sqrt(T) / 100, rho: K * T * er * ncdf(d2) / 100, itm: ncdf(d2) };
    return { price: K * er * ncdf(-d2) - S0 * eq * ncdf(-d1), delta: -eq * ncdf(-d1), gamma: eq * nd1 / (S0 * s * Math.sqrt(T)), theta: (-S0 * eq * nd1 * s / (2 * Math.sqrt(T)) + r * K * er * ncdf(-d2) - q * S0 * eq * ncdf(-d1)) / 365, vega: S0 * eq * nd1 * Math.sqrt(T) / 100, rho: -K * T * er * ncdf(-d2) / 100, itm: ncdf(-d2) };
  }

  /* ---------- portfolio and trade journal (only on this PC) ---------- */
  async function portfolio(b) {
    const syms = [...new Set(port.map(p => p.sym))]; if (syms.length) await getQuotes(syms);
    let tv = 0, tc = 0, td = 0; const rows = port.map((p, i) => { const q = quoteCache[p.sym] || {}, val = (q.last || 0) * p.qty, cost = p.cost * p.qty, day = (q.change || 0) * p.qty; tv += val; tc += cost; td += day; return { p, i, q, val, cost, day }; });
    /* journal statistics */
    const closed = journal.filter(t => t.exit > 0), pnl = t => ((t.side === 'short' ? t.entry - t.exit : t.exit - t.entry) * t.qty) - (t.fees || 0);
    const wins = closed.filter(t => pnl(t) > 0), losses = closed.filter(t => pnl(t) <= 0), gw = wins.reduce((a, t) => a + pnl(t), 0), gl = -losses.reduce((a, t) => a + pnl(t), 0);
    const rmult = closed.filter(t => t.stop > 0).map(t => pnl(t) / (Math.abs(t.entry - t.stop) * t.qty));
    let eq = 0, peak = 0, mdd = 0; const curve = closed.slice().sort((a, c) => String(a.d).localeCompare(String(c.d))).map(t => { eq += pnl(t); peak = Math.max(peak, eq); mdd = Math.min(mdd, eq - peak); return eq; });
    b.innerHTML = '<div class="mk-card"><h4>Holdings</h4>' + (port.length ? '<div style="overflow:auto"><table class="mk-tbl"><tr><th>Symbol</th><th>Shares</th><th>Avg cost</th><th>Last</th><th>Value</th><th>Today</th><th>Total gain</th><th>Weight</th><th></th></tr>' + rows.map(r => '<tr class="r" data-o="' + esc(r.p.sym) + '"><td><b>' + esc(r.p.sym) + '</b></td><td>' + f2(r.p.qty, 0) + '</td><td>' + f2(r.p.cost) + '</td><td>' + f2(r.q.last) + '</td><td>$' + f2(r.val) + '</td><td style="color:' + col(r.day) + '">$' + f2(r.day) + '</td><td style="color:' + col(r.val - r.cost) + '">$' + f2(r.val - r.cost) + ' (' + pc(r.cost ? (r.val / r.cost - 1) * 100 : null) + ')</td><td>' + f2(tv ? r.val / tv * 100 : 0, 1) + '%</td><td><button class="mk-btn" data-pd="' + r.i + '">✕</button></td></tr>').join('') + '<tr><td><b>Total</b></td><td></td><td></td><td></td><td><b>$' + f2(tv) + '</b></td><td style="color:' + col(td) + '"><b>$' + f2(td) + '</b></td><td style="color:' + col(tv - tc) + '"><b>$' + f2(tv - tc) + ' (' + pc(tc ? (tv / tc - 1) * 100 : null) + ')</b></td><td></td><td></td></tr></table></div>' : '<div class="mk-note">No holdings yet.</div>') +
      '<div class="nw-row" style="margin-top:8px;gap:6px"><input id="pf_s" placeholder="Symbol" style="width:100px"><input id="pf_q" type="number" placeholder="Shares" style="width:100px"><input id="pf_c" type="number" step="any" placeholder="Average cost" style="width:120px"><button class="mk-btn" id="pf_add">Add holding</button><button class="mk-btn" id="pf_csv">Export CSV</button></div></div>' +
      '<div class="mk-card"><h4>Trade journal</h4><div class="mk-out">' + [['Closed trades', closed.length], ['Win rate', closed.length ? f2(wins.length / closed.length * 100, 1) + '%' : '–'], ['Average win', wins.length ? '$' + f2(gw / wins.length) : '–'], ['Average loss', losses.length ? '$' + f2(gl / losses.length) : '–'], ['Profit factor', gl ? f2(gw / gl, 2) : wins.length ? '∞' : '–'], ['Average R (trades with a stop)', rmult.length ? f2(rmult.reduce((a, b2) => a + b2, 0) / rmult.length, 2) + 'R' : '–'], ['Net result', '$' + f2(gw - gl)], ['Worst drawdown', '$' + f2(mdd)]].map(([l, x]) => '<div><span>' + l + '</span><b>' + x + '</b></div>').join('') + '</div>' +
      (curve.length > 1 ? '<canvas id="pf_curve" style="width:100%;height:140px;margin-top:10px;background:var(--panel2);border-radius:8px"></canvas>' : '') +
      '<div class="nw-row" style="margin-top:10px;gap:6px;flex-wrap:wrap"><input id="tj_d" type="date" value="' + new Date().toISOString().slice(0, 10) + '"><input id="tj_s" placeholder="Symbol" style="width:90px"><select id="tj_side"><option value="long">Long</option><option value="short">Short</option></select><input id="tj_q" type="number" placeholder="Shares" style="width:90px"><input id="tj_e" type="number" step="any" placeholder="Entry" style="width:90px"><input id="tj_x" type="number" step="any" placeholder="Exit (blank if open)" style="width:140px"><input id="tj_st" type="number" step="any" placeholder="Stop" style="width:80px"><input id="tj_f" type="number" step="any" placeholder="Fees" style="width:70px"><input id="tj_n" placeholder="Why I took it / what I learned" style="flex:1;min-width:200px"><button class="mk-btn" id="tj_add">Log trade</button><button class="mk-btn" id="tj_use" title="Copy these statistics into the expectancy calculator">Use in Trade tools</button></div>' +
      (journal.length ? '<div style="overflow:auto;margin-top:8px"><table class="mk-tbl"><tr><th>Date</th><th>Symbol</th><th>Side</th><th>Shares</th><th>Entry</th><th>Exit</th><th>Stop</th><th>Result</th><th>R</th><th class="l">Notes</th><th></th></tr>' + journal.map((t, i) => { const r = t.exit > 0 ? pnl(t) : null; return '<tr><td>' + esc(t.d) + '</td><td><b>' + esc(t.sym) + '</b></td><td>' + t.side + '</td><td>' + f2(t.qty, 0) + '</td><td>' + f2(t.entry) + '</td><td>' + (t.exit > 0 ? f2(t.exit) : 'open') + '</td><td>' + (t.stop > 0 ? f2(t.stop) : '') + '</td><td style="color:' + col(r) + '">' + (r != null ? '$' + f2(r) : '') + '</td><td>' + (r != null && t.stop > 0 ? f2(r / (Math.abs(t.entry - t.stop) * t.qty), 2) : '') + '</td><td class="l" style="white-space:normal;max-width:300px">' + esc(t.note || '') + '</td><td><button class="mk-btn" data-jd="' + i + '">✕</button></td></tr>'; }).reverse().join('') + '</table></div>' : '') + '</div>' +
      '<div class="mk-note">Holdings and the journal are kept only in this browser on this PC; nothing is sent anywhere except the symbols, to get their prices.</div>';
    if (curve.length > 1) { const cv = b.querySelector('#pf_curve'), dpr = Math.min(2, devicePixelRatio || 1), W = cv.clientWidth, H = cv.clientHeight; cv.width = W * dpr; cv.height = H * dpr; const g = cv.getContext('2d'); g.setTransform(dpr, 0, 0, dpr, 0, 0); const lo = Math.min(0, ...curve), hi = Math.max(0, ...curve), y = v => 8 + (hi - v) / ((hi - lo) || 1) * (H - 16), x = i => 8 + i / (curve.length - 1) * (W - 16); g.strokeStyle = 'rgba(255,255,255,.15)'; g.beginPath(); g.moveTo(8, y(0)); g.lineTo(W - 8, y(0)); g.stroke(); g.strokeStyle = curve[curve.length - 1] >= 0 ? '#5ee6a8' : '#ff6b81'; g.lineWidth = 2; g.beginPath(); curve.forEach((v, i) => i ? g.lineTo(x(i), y(v)) : g.moveTo(x(i), y(v))); g.stroke(); }
    b.onclick = async e => {
      const val = id => b.querySelector('#' + id).value;
      if (e.target.id === 'pf_add') { const s = val('pf_s').trim().toUpperCase(), qn = parseFloat(val('pf_q')), c = parseFloat(val('pf_c')); if (!s || !(qn > 0) || !(c > 0)) return A.toast('Symbol, shares and average cost, please.'); port.push({ sym: s, qty: qn, cost: c }); save('mk_port', port); portfolio(b); return; }
      if (e.target.id === 'pf_csv') { const csv = 'symbol,shares,avg_cost,last,value,gain\n' + rows.map(r => [r.p.sym, r.p.qty, r.p.cost, r.q.last || '', r.val.toFixed(2), (r.val - r.cost).toFixed(2)].join(',')).join('\n'); const u = URL.createObjectURL(new Blob([csv], { type: 'text/csv' })), l = document.createElement('a'); l.href = u; l.download = 'portfolio-' + new Date().toISOString().slice(0, 10) + '.csv'; document.body.appendChild(l); l.click(); l.remove(); return; }
      const pd = e.target.closest('[data-pd]'); if (pd) { e.stopPropagation(); port.splice(+pd.dataset.pd, 1); save('mk_port', port); portfolio(b); return; }
      if (e.target.id === 'tj_add') { const t = { d: val('tj_d'), sym: val('tj_s').trim().toUpperCase(), side: val('tj_side'), qty: parseFloat(val('tj_q')), entry: parseFloat(val('tj_e')), exit: parseFloat(val('tj_x')) || 0, stop: parseFloat(val('tj_st')) || 0, fees: parseFloat(val('tj_f')) || 0, note: val('tj_n') }; if (!t.sym || !(t.qty > 0) || !(t.entry > 0)) return A.toast('Symbol, shares and entry at least.'); journal.push(t); save('mk_journal', journal); portfolio(b); return; }
      const jd = e.target.closest('[data-jd]'); if (jd) { if (!(await A.confirm('Delete this trade from the journal?'))) return; journal.splice(+jd.dataset.jd, 1); save('mk_journal', journal); portfolio(b); return; }
      if (e.target.id === 'tj_use') { if (!closed.length) return A.toast('Log some closed trades first.'); S.tab = 'tools'; keep(); paintTop(); draw(); setTimeout(() => { const bb = body(), set = (id, x) => { const el = bb.querySelector('#' + id); if (el) el.value = x; }; set('ex_win', (wins.length / closed.length * 100).toFixed(1)); set('ex_aw', wins.length ? (gw / wins.length).toFixed(2) : 0); set('ex_al', losses.length ? (gl / losses.length).toFixed(2) : 0); bb.dispatchEvent(new Event('input')); }, 50); return; }
      const tr = e.target.closest('[data-o]'); if (tr) open(tr.dataset.o);
    };
  }

  /* ---------- rates and the economy ---------- */
  async function macro(b) {
    const m = await api('/api/mk/macro'); if (m.error === 'off') { b.innerHTML = offMsg; return; } if (m.error) { b.innerHTML = '<div class="mk-card">Could not load: ' + esc(m.error) + '</div>'; return; }
    const S2 = m.series || {}, last = id => S2[id] && S2[id].rows.length ? S2[id].rows[S2[id].rows.length - 1] : null;
    const cpi = S2.CPIAUCSL ? S2.CPIAUCSL.rows : [], cpiY = cpi.length > 12 ? (cpi[cpi.length - 1].v / cpi[cpi.length - 13].v - 1) * 100 : null;
    const kpi = [['Fed funds rate', last('FEDFUNDS'), '%'], ['2-year Treasury', last('DGS2'), '%'], ['10-year Treasury', last('DGS10'), '%'], ['10y − 2y spread', last('T10Y2Y'), ' pts'], ['Inflation (CPI, past year)', cpiY != null ? { v: cpiY, d: cpi[cpi.length - 1].d } : null, '%'], ['Unemployment', last('UNRATE'), '%'], ['High-yield spread', last('BAMLH0A0HYM2'), ' pts'], ['30-year mortgage', last('MORTGAGE30US'), '%']];
    b.innerHTML = '<div class="mk-out" style="margin-top:0">' + kpi.map(([l, x, u]) => '<div><span>' + l + (x ? ' · ' + esc(x.d) : '') + '</span><b>' + (x ? f2(x.v) + u : '–') + '</b></div>').join('') + '</div>' +
      '<div class="mk-split" style="margin-top:14px"><div class="mk-card"><h4>Treasury yield curve</h4><canvas id="mc_curve" style="width:100%;height:240px"></canvas><div class="mk-note">' + (m.curve ? 'Latest ' + esc(m.curve.latest.date) + ' (solid), a month earlier (dashed), start of the year (dotted). When short rates sit above long ones (an inverted curve), recessions have often followed.' : 'Treasury data unavailable.') + '</div></div>' +
      '<div class="mk-card"><h4>10-year minus 2-year</h4><canvas id="mc_spread" style="width:100%;height:240px"></canvas><div class="mk-note">Below zero = inverted.</div></div></div>' +
      '<div class="mk-g" style="grid-template-columns:repeat(auto-fill,minmax(300px,1fr))">' + ['FEDFUNDS', 'DGS10', 'UNRATE', 'BAMLH0A0HYM2', 'MORTGAGE30US'].map(id => S2[id] ? '<div class="mk-card"><h4>' + esc(S2[id].name) + '</h4><canvas data-sr="' + id + '" style="width:100%;height:150px"></canvas></div>' : '').join('') + '</div><div class="mk-note">From FRED (Federal Reserve Bank of St. Louis) and the U.S. Treasury. Updated a few times a day at most.</div>';
    const plot = (cv, sets, opts) => { const dpr = Math.min(2, devicePixelRatio || 1), W = cv.clientWidth, H = cv.clientHeight; cv.width = W * dpr; cv.height = H * dpr; const g = cv.getContext('2d'); g.setTransform(dpr, 0, 0, dpr, 0, 0); let lo = Infinity, hi = -Infinity, n = 0; sets.forEach(s => s.v.forEach(v => { if (v != null) { lo = Math.min(lo, v); hi = Math.max(hi, v); } n = Math.max(n, s.v.length); })); if (opts && opts.zero) { lo = Math.min(lo, 0); hi = Math.max(hi, 0); } const pad = (hi - lo) * .08 || .5; lo -= pad; hi += pad; const x = i => 40 + i / Math.max(1, n - 1) * (W - 50), y = v => 8 + (hi - v) / (hi - lo) * (H - 28); g.fillStyle = '#9aa3ba'; g.font = '11px Segoe UI'; g.strokeStyle = 'rgba(255,255,255,.07)'; const st = niceStep((hi - lo) / 4); for (let v = Math.ceil(lo / st) * st; v <= hi; v += st) { g.beginPath(); g.moveTo(40, y(v)); g.lineTo(W - 10, y(v)); g.stroke(); g.fillText(f2(v, st < 1 ? 2 : 0), 2, y(v) + 4); } if (opts && opts.zero) { g.strokeStyle = 'rgba(255,107,129,.5)'; g.beginPath(); g.moveTo(40, y(0)); g.lineTo(W - 10, y(0)); g.stroke(); } sets.forEach(s => { g.strokeStyle = s.c; g.lineWidth = s.w || 1.6; g.setLineDash(s.dash || []); g.beginPath(); let stt = false; s.v.forEach((v, i) => { if (v == null) return; if (!stt) { g.moveTo(x(i), y(v)); stt = true; } else g.lineTo(x(i), y(v)); }); g.stroke(); g.setLineDash([]); }); if (opts && opts.labels) { const every = Math.max(1, Math.ceil(opts.labels.length / 8)); opts.labels.forEach((l, i) => { if (i % every === 0 || i === opts.labels.length - 1) g.fillText(l, x(i) - 10, H - 4); }); } };
    if (m.curve) { const c = m.curve, terms = c.latest.points.map(p => p.term), get = cc => terms.map(t => { const p = cc && cc.points.find(x => x.term === t); return p ? p.v : null; }); plot(b.querySelector('#mc_curve'), [{ v: get(c.start), c: 'rgba(160,170,200,.6)', dash: [2, 3] }, { v: get(c.monthAgo), c: 'rgba(122,162,255,.8)', dash: [6, 4] }, { v: get(c.latest), c: '#46d7c8', w: 2.2 }], { labels: terms.map(t => t.replace(/ Mo(nth)?/, 'm').replace(' Yr', 'y')) }); }
    if (S2.T10Y2Y) { const r = S2.T10Y2Y.rows; plot(b.querySelector('#mc_spread'), [{ v: r.map(x => x.v), c: '#f2c94c' }], { zero: true, labels: r.map(x => x.d.slice(0, 4)) }); }
    b.querySelectorAll('[data-sr]').forEach(cv => { const r = S2[cv.dataset.sr].rows; plot(cv, [{ v: r.map(x => x.v), c: '#8b7cff' }], { labels: r.map(x => x.d.slice(0, 4)) }); });
  }

  A.markets = { render, open: sym => { S.sym = sym; S.tab = 'chart'; keep(); }, stop: () => { clearInterval(timer); host = null; } };
})();

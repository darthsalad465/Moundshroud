// Markets: quotes, charts, company filings and financial statements, interest rates and the economy, for the Markets
// view in the News tab. Moundshroud does the fetching (so the page itself never talks to anyone), caches everything,
// and only goes online while internet access is switched on.
//
// Where the numbers come from (all free, none needs an account):
//   - quotes and key statistics: CNBC's public quote service (real-time for US stocks, delayed for some markets);
//   - price history and symbol search: Yahoo Finance, with CNBC's charts as the fallback;
//   - filings and audited financial statements: the SEC (EDGAR), straight from the source;
//   - the yield curve: the U.S. Treasury; the economy: FRED, the St. Louis Fed's database.
// Privacy: those services see which symbols are looked up (not who you are: no account, no cookies, a plain browser name).
const fs = require('fs'), path = require('path'), https = require('https'), zlib = require('zlib');
const net = require('./net');

const DATA = path.join(__dirname, '..', 'data'), DIR = path.join(DATA, 'markets');
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:128.0) Gecko/20100101 Firefox/128.0';
const off = { error: 'off', message: 'Internet access is switched off.' };

function fetchText(url, opts) {
  opts = opts || {};
  return new Promise(res => {
    let done = false; const fin = v => { if (!done) { done = true; res(v); } };
    const go = (u, depth) => {
      const rq = https.get(u, { headers: { 'user-agent': opts.ua || UA, accept: opts.accept || 'application/json, text/csv, application/atom+xml, */*;q=0.5', 'accept-encoding': 'gzip, deflate', 'accept-language': 'en-US,en;q=0.9' }, timeout: opts.timeout || 15000 }, r => {
        if (r.statusCode >= 300 && r.statusCode < 400 && r.headers.location && depth < 3) { r.resume(); try { return go(new URL(r.headers.location, u), depth + 1); } catch (e) { return fin({ error: 'bad redirect' }); } }
        if (r.statusCode !== 200) { r.resume(); return fin({ error: 'HTTP ' + r.statusCode }); }
        const c = []; let n = 0;
        r.on('data', x => { n += x.length; if (n > 12e6) { rq.destroy(); return; } c.push(x); });
        r.on('end', () => { let b = Buffer.concat(c); const e = r.headers['content-encoding']; try { if (e === 'gzip') b = zlib.gunzipSync(b); else if (e === 'deflate') b = zlib.inflateSync(b); } catch (x) { } fin({ text: b.toString('utf8') }); });
        r.on('error', () => fin({ error: 'read error' }));
      });
      rq.on('timeout', () => { rq.destroy(); fin({ error: 'timed out' }); });
      rq.on('error', e => fin({ error: e.code || e.message }));
    };
    try { go(new URL(url), 0); } catch (e) { fin({ error: 'bad url' }); }
  });
}
const getJson = async (url, opts) => { const r = await fetchText(url, opts); if (r.error) return r; try { return { json: JSON.parse(r.text) }; } catch (e) { return { error: 'not JSON' }; } };

/* a small cache in memory (and on disk for the slow things) */
const MEM = new Map();
async function cached(key, ms, fn) {
  const hit = MEM.get(key); if (hit && Date.now() - hit.at < ms) return hit.v;
  const v = await fn(); if (v && !v.error) MEM.set(key, { at: Date.now(), v }); else if (hit) return Object.assign({}, hit.v, { stale: true });
  if (MEM.size > 600) MEM.delete(MEM.keys().next().value);
  return v;
}
const disk = f => path.join(DIR, f);
const readDisk = (f, ms) => { try { const st = fs.statSync(disk(f)); if (Date.now() - st.mtimeMs > ms) return null; return JSON.parse(fs.readFileSync(disk(f), 'utf8')); } catch (e) { return null; } };
const writeDisk = (f, v) => { try { fs.mkdirSync(DIR, { recursive: true }); fs.writeFileSync(disk(f), JSON.stringify(v)); } catch (e) { } };

/* symbols: CNBC and Yahoo spell indices, futures, currencies and crypto differently */
const YAHOO = { '.SPX': '^GSPC', '.IXIC': '^IXIC', '.DJI': '^DJI', '.RUT': '^RUT', '.VIX': '^VIX', '.NDX': '^NDX', 'US10Y': '^TNX', 'US30Y': '^TYX', 'US5Y': '^FVX', '@CL.1': 'CL=F', '@LCO.1': 'BZ=F', '@GC.1': 'GC=F', '@SI.1': 'SI=F', '@NG.1': 'NG=F', '@HG.1': 'HG=F', 'EUR=': 'EURUSD=X', 'JPY=': 'JPY=X', 'GBP=': 'GBPUSD=X', 'CNY=': 'CNY=X', '.DXY': 'DX-Y.NYB', 'BTC.CM=': 'BTC-USD', 'ETH.CM=': 'ETH-USD', '.FTSE': '^FTSE', '.GDAXI': '^GDAXI', '.N225': '^N225', '.HSI': '^HSI', '.STOXX': '^STOXX' };
const toYahoo = s => YAHOO[s] || s.replace(/\./g, '-');
const clean = s => String(s || '').toUpperCase().replace(/[^A-Z0-9.=@^\-]/g, '').slice(0, 16);
const num = v => { if (v === undefined || v === null || v === '') return null; const s = String(v).replace(/[,%$+]/g, '').trim(); const m = s.match(/^(-?[\d.]+)([KMBT])?$/i); if (!m) return null; const k = { K: 1e3, M: 1e6, B: 1e9, T: 1e12 }[(m[2] || '').toUpperCase()] || 1; return +m[1] * k; };

/* ---------- quotes ---------- */
async function quotes(list) {
  if (!net.on()) return off;
  const syms = [...new Set(String(list || '').split(',').map(clean).filter(Boolean))].slice(0, 60);
  if (!syms.length) return { quotes: [] };
  return cached('q:' + syms.join('|'), 15000, async () => {
    const url = 'https://quote.cnbc.com/quote-html-webservice/restQuote/symbolType/symbol?symbols=' + encodeURIComponent(syms.join('|')) + '&requestMethod=itv&noform=1&partnerId=2&fund=1&exthrs=1&output=json&events=1';
    const r = await getJson(url); if (r.error) return r;
    let qs = (((r.json || {}).FormattedQuoteResult || {}).FormattedQuote || []);
    if (!Array.isArray(qs)) qs = [qs];
    return {
      at: Date.now(), quotes: qs.map(q => {
        const x = q.ExtendedMktQuote || {}, ev = q.EventData || {};
        return {
          symbol: q.symbol, name: q.name || q.shortName, ok: q.code === 0 || q.code === '0' || !!q.last, type: q.type, exchange: q.exchange, currency: q.currencyCode,
          last: num(q.last), change: num(q.change), pct: num(q.change_pct), open: num(q.open), high: num(q.high), low: num(q.low), prev: num(q.previous_day_closing),
          volume: num(q.volume), avgVol10: num(q.tendayavgvol), time: q.last_time, status: q.curmktstatus, realTime: q.realTime === 'true',
          hi52: num(q.yrhiprice), lo52: num(q.yrloprice), hi52date: q.yrhidate, lo52date: q.yrlodate,
          pe: num(q.pe), fpe: num(q.fpe), eps: num(q.eps), feps: num(q.feps), beta: num(q.beta), mcap: num(q.mktcapView), shares: num(q.sharesout),
          div: num(q.dividend), yield: num(q.dividendyield), revenue: num(q.revenuettm), ps: num(q.psales), roe: num(q.ROETTM), margin: num(q.NETPROFTTM), gross: num(q.GROSMGNTTM), de: num(q.DEBTEQTYQ), ebitda: num(q.TTMEBITD),
          ext: x.last ? { type: x.type, last: num(x.last), change: num(x.change), pct: num(x.change_pct), time: x.last_time } : null,
          events: { earnings: ev.next_earnings_date || null, earningsTime: ev.announce_time || null, exdiv: ev.div_ex_date || ev.exdiv_date || null, high52today: ev.yrhiind === 'Y', low52today: ev.yrloind === 'Y', halted: ev.is_halted === 'Y' }
        };
      })
    };
  });
}

/* ---------- price history ---------- */
const RANGES = { '1d': ['1d', '5m'], '5d': ['5d', '15m'], '1mo': ['1mo', '60m'], '3mo': ['6mo', '1d'], '6mo': ['1y', '1d'], 'ytd': ['2y', '1d'], '1y': ['2y', '1d'], '2y': ['5y', '1d'], '5y': ['10y', '1wk'], 'max': ['max', '1mo'] };
const CNBC_R = { '1d': '1D', '5d': '5D', '1mo': '1M', '3mo': '6M', '6mo': '1Y', 'ytd': '1Y', '1y': '1Y', '2y': '5Y', '5y': '5Y', 'max': 'ALL' };
async function chart(sym, range) {
  if (!net.on()) return off;
  sym = clean(sym); range = RANGES[range] ? range : '1y'; if (!sym) return { error: 'no symbol' };
  const [yr, yi] = RANGES[range];
  return cached('c:' + sym + ':' + range, range === '1d' ? 30000 : range === '5d' ? 120000 : 600000, async () => {
    /* more history than is shown, so the long moving averages and indicators are right from the first bar on screen */
    const y = await getJson('https://query1.finance.yahoo.com/v8/finance/chart/' + encodeURIComponent(toYahoo(sym)) + '?range=' + yr + '&interval=' + yi + (range === '1d' || range === '5d' ? '&includePrePost=true' : '') + '&events=div%2Csplit', { ua: 'Mozilla/5.0' });
    const res = y.json && y.json.chart && y.json.chart.result && y.json.chart.result[0];
    if (res && res.timestamp) {
      const q = res.indicators.quote[0], bars = [];
      res.timestamp.forEach((t, i) => { if (q.close[i] == null) return; bars.push({ t: t * 1000, o: q.open[i], h: q.high[i], l: q.low[i], c: q.close[i], v: q.volume[i] || 0 }); });
      const m = res.meta || {}, scale = 1;
      if (scale !== 1) bars.forEach(b => { b.o *= scale; b.h *= scale; b.l *= scale; b.c *= scale; });
      const per = (m.currentTradingPeriod || {}).regular || {};
      return { symbol: sym, range, interval: yi, source: 'Yahoo Finance', currency: m.currency, tz: m.exchangeTimezoneName, regular: per.start ? { start: per.start * 1000, end: per.end * 1000 } : null, prevClose: m.chartPreviousClose != null ? m.chartPreviousClose * scale : null, bars, dividends: res.events && res.events.dividends ? Object.values(res.events.dividends).map(d => ({ t: d.date * 1000, amount: d.amount })) : [], splits: res.events && res.events.splits ? Object.values(res.events.splits).map(s => ({ t: s.date * 1000, ratio: s.splitRatio })) : [] };
    }
    /* Yahoo refused: CNBC's charts */
    const c = await getJson('https://ts-api.cnbc.com/harmony/app/charts/' + CNBC_R[range] + '.json?symbol=' + encodeURIComponent(sym));
    const pb = c.json && c.json.barData && c.json.barData.priceBars;
    if (!pb) return { error: y.error || c.error || 'no data' };
    return { symbol: sym, range, interval: range === '1d' ? '1m' : '1d', source: 'CNBC', bars: pb.map(b => ({ t: b.tradeTimeinMills, o: +b.open, h: +b.high, l: +b.low, c: +b.close, v: +b.volume || 0 })), dividends: [], splits: [] };
  });
}

/* ---------- symbol search ---------- */
async function secTickers() {
  const d = readDisk('sec-tickers.json', 7 * 86400e3); if (d) return d;
  if (!net.on()) { try { return JSON.parse(fs.readFileSync(disk('sec-tickers.json'), 'utf8')); } catch (e) { return []; } }
  const r = await getJson('https://www.sec.gov/files/company_tickers.json'); if (r.error) { try { return JSON.parse(fs.readFileSync(disk('sec-tickers.json'), 'utf8')); } catch (e) { return []; } }
  const list = Object.values(r.json).map(x => ({ s: x.ticker, n: x.title, cik: x.cik_str }));
  writeDisk('sec-tickers.json', list); return list;
}
async function search(q) {
  q = String(q || '').trim().slice(0, 60); if (!q) return { results: [] };
  if (!net.on()) return off;
  return cached('s:' + q.toLowerCase(), 3600e3, async () => {
    const y = await getJson('https://query1.finance.yahoo.com/v1/finance/search?q=' + encodeURIComponent(q) + '&quotesCount=10&newsCount=0', { ua: 'Mozilla/5.0' });
    let out = ((y.json || {}).quotes || []).filter(x => x.symbol).map(x => ({ symbol: x.symbol.replace(/-/g, '.').replace(/^\^GSPC$/, '.SPX'), name: x.longname || x.shortname || '', type: x.typeDisp || x.quoteType || '', exchange: x.exchDisp || x.exchange || '' }));
    if (!out.length) {
      const t = await secTickers(), ql = q.toLowerCase();
      out = t.filter(x => x.s.toLowerCase() === ql || x.n.toLowerCase().includes(ql)).slice(0, 10).map(x => ({ symbol: x.s, name: x.n, type: 'Equity', exchange: 'US' }));
    }
    return { results: out };
  });
}

/* ---------- the SEC: filings and audited numbers ---------- */
async function cikOf(sym) { const t = await secTickers(), s = clean(sym).replace(/\./g, '-'); const hit = t.find(x => x.s === s || x.s === clean(sym)); return hit ? hit.cik : null; }
const FORMS = { '10-K': 'Annual report', '10-Q': 'Quarterly report', '8-K': 'Current report (a material event)', '4': 'Insider transaction', 'DEF 14A': 'Proxy statement', 'S-1': 'Registration (new shares)', '13D': 'Over 5% stake (activist)', 'SC 13D': 'Over 5% stake (activist)', 'SC 13G': 'Over 5% stake (passive)', '144': 'Planned insider sale', '6-K': 'Foreign issuer report', '20-F': 'Foreign annual report' };
async function filings(sym) {
  if (!net.on()) return off;
  const cik = await cikOf(sym); if (!cik) return { error: 'not an SEC filer', filings: [] };
  return cached('f:' + cik, 900000, async () => {
    const r = await fetchText('https://www.sec.gov/cgi-bin/browse-edgar?action=getcompany&CIK=' + String(cik).padStart(10, '0') + '&type=&dateb=&owner=include&count=40&output=atom', { accept: 'application/atom+xml' });
    if (r.error) return r;
    const out = (r.text.match(/<entry>[\s\S]*?<\/entry>/g) || []).map(e => {
      const g = n => { const m = e.match(new RegExp('<' + n + '[^>]*>([\\s\\S]*?)</' + n + '>')); return m ? m[1].replace(/<!\[CDATA\[|\]\]>/g, '').trim() : ''; };
      const form = g('filing-type') || (g('category').match(/term="([^"]+)"/) || [])[1] || '', link = (e.match(/<link[^>]*href="([^"]+)"/) || [])[1] || '';
      return { form, what: FORMS[form] || '', date: g('filing-date') || g('updated').slice(0, 10), title: g('title').replace(/&amp;/g, '&'), link, items: g('items-desc') };
    });
    return { cik, filings: out };
  });
}
/* the numbers from the audited statements, year by year and quarter by quarter */
const CONCEPTS = {
  revenue: ['RevenueFromContractWithCustomerExcludingAssessedTax', 'Revenues', 'SalesRevenueNet', 'RevenueFromContractWithCustomerIncludingAssessedTax'],
  grossProfit: ['GrossProfit'], operatingIncome: ['OperatingIncomeLoss'], netIncome: ['NetIncomeLoss', 'ProfitLoss'],
  eps: ['EarningsPerShareDiluted', 'EarningsPerShareBasic'], assets: ['Assets'], liabilities: ['Liabilities'], equity: ['StockholdersEquity', 'StockholdersEquityIncludingPortionAttributableToNoncontrollingInterest'],
  cash: ['CashAndCashEquivalentsAtCarryingValue', 'CashCashEquivalentsRestrictedCashAndRestrictedCashEquivalents'], debt: ['LongTermDebtNoncurrent', 'LongTermDebt'],
  opCashFlow: ['NetCashProvidedByUsedInOperatingActivities'], capex: ['PaymentsToAcquirePropertyPlantAndEquipment'], shares: ['WeightedAverageNumberOfDilutedSharesOutstanding'], dividendsPaid: ['PaymentsOfDividends', 'PaymentsOfDividendsCommonStock']
};
async function facts(sym) {
  if (!net.on()) return off;
  const cik = await cikOf(sym); if (!cik) return { error: 'not an SEC filer' };
  const f = 'facts-' + cik + '.json', d = readDisk(f, 86400e3); if (d) return d;
  const r = await getJson('https://data.sec.gov/api/xbrl/companyfacts/CIK' + String(cik).padStart(10, '0') + '.json', { timeout: 30000 }); if (r.error) return r;
  const g = (r.json.facts || {})['us-gaap'] || {}, annual = {}, quarterly = {};
  Object.entries(CONCEPTS).forEach(([k, names]) => {
    for (const n of names) {
      const c = g[n]; if (!c) continue;
      const unit = Object.keys(c.units)[0], rows = c.units[unit];
      const yr = rows.filter(x => x.form === '10-K' && x.fp === 'FY' && (!x.start || (Date.parse(x.end) - Date.parse(x.start)) > 300 * 86400e3));
      const byEnd = {}; yr.forEach(x => { byEnd[x.end] = x; });
      const a = Object.values(byEnd).sort((x, y) => x.end.localeCompare(y.end)).slice(-6).map(x => ({ end: x.end, v: x.val }));
      if (a.length && !annual[k]) annual[k] = a;
      const qr = rows.filter(x => (x.form === '10-Q' || x.form === '10-K') && x.start && (Date.parse(x.end) - Date.parse(x.start)) < 100 * 86400e3);
      const byQ = {}; qr.forEach(x => { byQ[x.end] = x; });
      const q = Object.values(byQ).sort((x, y) => x.end.localeCompare(y.end)).slice(-8).map(x => ({ end: x.end, v: x.val }));
      if (q.length && !quarterly[k]) quarterly[k] = q;
      if (annual[k]) break;
    }
  });
  const out = { cik, name: r.json.entityName, annual, quarterly, at: Date.now() };
  writeDisk(f, out); return out;
}

/* ---------- rates and the economy ---------- */
const FRED = { DGS10: '10-year Treasury yield (%)', DGS2: '2-year Treasury yield (%)', T10Y2Y: '10-year minus 2-year spread (points)', FEDFUNDS: 'Federal funds rate (%)', CPIAUCSL: 'Consumer prices (index)', UNRATE: 'Unemployment rate (%)', BAMLH0A0HYM2: 'High-yield bond spread (points)', MORTGAGE30US: '30-year mortgage rate (%)' };
async function macro() {
  if (!net.on()) return off;
  const d = readDisk('macro.json', 6 * 3600e3); if (d) return d;
  const out = { at: Date.now(), series: {}, curve: null };
  await Promise.all(Object.keys(FRED).map(async id => {
    const r = await fetchText('https://fred.stlouisfed.org/graph/fredgraph.csv?id=' + id + '&cosd=' + new Date(Date.now() - 6 * 365 * 86400e3).toISOString().slice(0, 10), { accept: 'text/csv' });
    if (r.error) return;
    const rows = r.text.trim().split(/\r?\n/).slice(1).map(l => l.split(',')).filter(x => x[1] && x[1] !== '.').map(x => ({ d: x[0], v: +x[1] }));
    out.series[id] = { name: FRED[id], rows: rows.length > 400 ? rows.filter((x, i) => i % Math.ceil(rows.length / 400) === 0 || i === rows.length - 1) : rows };
  }));
  const y = new Date().getFullYear();
  const t = await fetchText('https://home.treasury.gov/resource-center/data-chart-center/interest-rates/daily-treasury-rates.csv/' + y + '/all?type=daily_treasury_yield_curve&field_tdr_date_value=' + y + '&page&_format=csv', { accept: 'text/csv' });
  if (!t.error) {
    const lines = t.text.trim().split(/\r?\n/), head = lines[0].split(',').map(s => s.replace(/"/g, '')), rows = lines.slice(1).map(l => l.split(','));
    const pick = r => ({ date: r[0], points: head.slice(1).map((h, i) => ({ term: h, v: r[i + 1] === '' ? null : +r[i + 1] })).filter(p => p.v != null) });
    out.curve = { latest: pick(rows[0]), monthAgo: rows[21] ? pick(rows[21]) : null, start: pick(rows[rows.length - 1]) };
  }
  writeDisk('macro.json', out); return out;
}

/* ---------- the weather for the front page (Open-Meteo: free, no account; only the place you chose is sent) ---------- */
async function geocode(q) {
  if (!net.on()) return off; q = String(q || '').trim().slice(0, 80); if (!q) return { results: [] };
  return cached('g:' + q.toLowerCase(), 86400e3, async () => { const r = await getJson('https://geocoding-api.open-meteo.com/v1/search?name=' + encodeURIComponent(q) + '&count=6&language=en'); if (r.error) return r; return { results: ((r.json || {}).results || []).map(x => ({ name: x.name, admin: x.admin1 || '', country: x.country || '', lat: x.latitude, lon: x.longitude })) }; });
}
async function weather(lat, lon, unit) {
  if (!net.on()) return off; lat = +lat; lon = +lon; if (!isFinite(lat) || !isFinite(lon)) return { error: 'no place' };
  const u = unit === 'c' ? 'celsius' : 'fahrenheit', w = unit === 'c' ? 'kmh' : 'mph';
  return cached('w:' + lat.toFixed(2) + ',' + lon.toFixed(2) + u, 20 * 60e3, async () => {
    const r = await getJson('https://api.open-meteo.com/v1/forecast?latitude=' + lat + '&longitude=' + lon + '&current=temperature_2m,apparent_temperature,weather_code,wind_speed_10m,relative_humidity_2m&daily=weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max&forecast_days=5&timezone=auto&temperature_unit=' + u + '&wind_speed_unit=' + w);
    if (r.error) return r; return Object.assign({ unit: unit === 'c' ? 'C' : 'F', wind: w }, r.json);
  });
}

module.exports = { geocode, weather, quotes, chart, search, filings, facts, macro, YAHOO };

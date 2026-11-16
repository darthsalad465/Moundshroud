// Cyber > Toolkit: easy security and networking tools, the kind a tester finds on Kali Linux, written in plain Node so
// they run on this PC with nothing to install. They are for learning and for testing systems you OWN or have written
// permission to test. Nothing here attacks, breaks into, floods or exploits anything: every tool only looks, reads or
// asks (DNS, WHOIS, open ports, certificates, headers, hashes), which is what a tester does first (reconnaissance) and
// what a defender does to check their own systems. The page says this on every tool, and dangerous input is refused.
const dns = require('dns'), net = require('net'), tls = require('tls'), https = require('https'), http = require('http'), cp = require('child_process'), crypto = require('crypto'), os = require('os'), zlib = require('zlib');
const netlib = require('./net');

const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:128.0) Gecko/20100101 Firefox/128.0';
const clean = s => String(s == null ? '' : s).replace(/[\u0000-\u001f\u007f]/g, '').trim();
/* a host name or IP the user typed: letters, digits, dots, colons and hyphens only, so nothing can be smuggled into a
   system command */
const HOST = /^[A-Za-z0-9._:-]{1,255}$/;
const okHost = h => HOST.test(h) && !/[;&|`$()<>]/.test(h);
const off = () => ({ error: 'Internet access is switched off. These tools reach other computers over the internet, so turn it on in Settings.' });

/* ---------- host names and addresses: DNS ---------- */
async function lookupAll(host) {
  const out = {};
  const types = [['A', 4], ['AAAA', 6]];
  for (const [t] of [['A'], ['AAAA'], ['MX'], ['TXT'], ['NS'], ['CNAME'], ['SOA'], ['SRV'], ['CAA']]) {
    try { out[t] = await dns.promises.resolve(host, t); } catch (e) { out[t] = []; }
  }
  return out;
}
async function dnslookup(b) {
  if (!netlib.on()) return off();
  const host = clean(b.host).replace(/^https?:\/\//, '').replace(/\/.*$/, '').toLowerCase();
  if (!okHost(host)) return { error: 'Type a web address or host name, like example.com.' };
  const r = await lookupAll(host);
  const recs = [];
  (r.A || []).forEach(a => recs.push({ type: 'A', value: a, note: 'IPv4 address' }));
  (r.AAAA || []).forEach(a => recs.push({ type: 'AAAA', value: a, note: 'IPv6 address' }));
  (r.CNAME || []).forEach(a => recs.push({ type: 'CNAME', value: a, note: 'Another name this points to' }));
  (r.MX || []).sort((x, y) => x.priority - y.priority).forEach(m => recs.push({ type: 'MX', value: m.exchange, note: 'Mail server (priority ' + m.priority + ')' }));
  (r.NS || []).forEach(a => recs.push({ type: 'NS', value: a, note: 'Name server' }));
  (r.TXT || []).forEach(a => recs.push({ type: 'TXT', value: [].concat(a).join(''), note: 'Text record (SPF, verification, etc.)' }));
  (r.CAA || []).forEach(a => recs.push({ type: 'CAA', value: (a.issue || a.issuewild || JSON.stringify(a)), note: 'Who may issue certificates' }));
  (r.SOA && r.SOA.nsname) && recs.push({ type: 'SOA', value: r.SOA.nsname, note: 'Main name server; serial ' + r.SOA.serial });
  if (!recs.length) return { host, records: [], note: 'No records found. The name may not exist, or it may have none of these record types.' };
  return { host, records: recs };
}
/* the name behind an IP address */
async function reverse(b) {
  if (!netlib.on()) return off();
  const ip = clean(b.host);
  if (!net.isIP(ip)) return { error: 'Type an IP address, like 8.8.8.8.' };
  try { const names = await dns.promises.reverse(ip); return { ip, names }; } catch (e) { return { ip, names: [], note: 'No name is set for that address.' }; }
}

/* ---------- open ports (a TCP connect scan) ---------- */
/* common ports and what usually runs on them, so the result reads in plain words */
const PORTS = { 20: 'FTP data', 21: 'FTP', 22: 'SSH (remote login)', 23: 'Telnet (old, unsafe)', 25: 'SMTP (email)', 53: 'DNS', 67: 'DHCP', 80: 'HTTP (web)', 110: 'POP3 (email)', 111: 'RPC', 123: 'NTP (time)', 135: 'Windows RPC', 139: 'NetBIOS', 143: 'IMAP (email)', 161: 'SNMP', 389: 'LDAP', 443: 'HTTPS (secure web)', 445: 'Windows file sharing (SMB)', 465: 'SMTP (secure)', 587: 'SMTP (mail submission)', 993: 'IMAP (secure)', 995: 'POP3 (secure)', 1433: 'Microsoft SQL Server', 1521: 'Oracle database', 2049: 'NFS', 3000: 'Dev server', 3306: 'MySQL database', 3389: 'Windows Remote Desktop', 5432: 'PostgreSQL database', 5900: 'VNC (remote screen)', 6379: 'Redis', 8000: 'Web (alt)', 8080: 'Web proxy / alt', 8443: 'HTTPS (alt)', 9200: 'Elasticsearch', 27017: 'MongoDB' };
const TOP = [21, 22, 23, 25, 53, 80, 110, 135, 139, 143, 443, 445, 587, 993, 995, 1433, 3306, 3389, 5432, 5900, 8080, 8443];
function probe(host, port, ms) {
  return new Promise(resolve => {
    const s = new net.Socket(); let done = false;
    const fin = v => { if (done) return; done = true; try { s.destroy(); } catch (e) { } resolve(v); };
    s.setTimeout(ms); s.once('connect', () => fin(true)); s.once('timeout', () => fin(false)); s.once('error', () => fin(false));
    try { s.connect(port, host); } catch (e) { fin(false); }
  });
}
async function portscan(b) {
  if (!netlib.on()) return off();
  const host = clean(b.host).replace(/^https?:\/\//, '').replace(/[\/:].*$/, '');
  if (!okHost(host)) return { error: 'Type a host name or IP address you own or may test.' };
  let ports;
  if (b.ports === 'top' || !b.ports) ports = TOP.slice();
  else if (b.ports === 'common') ports = Object.keys(PORTS).map(Number);
  else {
    ports = [];
    for (const part of String(b.ports).split(',').slice(0, 60)) {
      const m = /^\s*(\d{1,5})\s*(?:-\s*(\d{1,5}))?\s*$/.exec(part); if (!m) continue;
      const a = +m[1], c = m[2] ? +m[2] : a; if (a < 1 || c > 65535 || c < a) continue;
      for (let p = a; p <= c && ports.length < 1024; p++) ports.push(p);
    }
    if (!ports.length) return { error: 'Type ports like 80,443 or a range like 1-1024 (up to 1024 at once).' };
  }
  ports = [...new Set(ports)].slice(0, 1024);
  const ms = Math.min(3000, Math.max(300, +b.timeout || 900));
  const open = []; let i = 0;
  const worker = async () => { while (i < ports.length) { const p = ports[i++]; if (await probe(host, p, ms)) open.push({ port: p, service: PORTS[p] || 'unknown' }); } };
  await Promise.all(Array.from({ length: Math.min(60, ports.length) }, worker));
  open.sort((a, c) => a.port - c.port);
  return { host, scanned: ports.length, open, note: open.length ? '' : 'No open ports found among the ones scanned. The host may be down, firewalled, or simply not running those services.' };
}

/* ---------- the secure certificate of a site ---------- */
function tlscert(b) {
  return new Promise(resolve => {
    if (!netlib.on()) return resolve(off());
    const host = clean(b.host).replace(/^https?:\/\//, '').replace(/[\/:].*$/, ''); const port = Math.min(65535, Math.max(1, +b.port || 443));
    if (!okHost(host)) return resolve({ error: 'Type a web address, like example.com.' });
    const s = tls.connect({ host, port, servername: host, timeout: 9000, rejectUnauthorized: false }, () => {
      const c = s.getPeerCertificate(true); const now = Date.now(), to = Date.parse(c.valid_to), from = Date.parse(c.valid_from);
      const chain = []; let cur = c, guard = 0; while (cur && guard++ < 10) { chain.push({ subject: (cur.subject && cur.subject.CN) || '', issuer: (cur.issuer && cur.issuer.CN) || '' }); if (!cur.issuerCertificate || cur.issuerCertificate === cur) break; cur = cur.issuerCertificate; }
      const out = { host, subject: (c.subject && c.subject.CN) || '', issuer: (c.issuer && c.issuer.CN) || (c.issuer && c.issuer.O) || '', altNames: (c.subjectaltname || '').replace(/DNS:/g, '').split(',').map(x => x.trim()).filter(Boolean).slice(0, 40), validFrom: c.valid_from, validTo: c.valid_to, daysLeft: Math.round((to - now) / 864e5), expired: now > to || now < from, protocol: s.getProtocol(), cipher: (s.getCipher() || {}).name || '', chain, serial: c.serialNumber };
      try { s.destroy(); } catch (e) { } resolve(out);
    });
    s.on('timeout', () => { s.destroy(); resolve({ error: 'That site did not answer on port ' + port + '.' }); });
    s.on('error', e => resolve({ error: 'Could not read a certificate: ' + (e.code || e.message) + '. The site may not use HTTPS, or the port is wrong.' }));
  });
}

/* ---------- how safe a site's HTTP response headers are ---------- */
function fetchHead(url, cb, depth) {
  let u; try { u = new URL(url); } catch (e) { return cb({ error: 'That is not a web address.' }); }
  if (u.protocol !== 'http:' && u.protocol !== 'https:') return cb({ error: 'Only http and https addresses work here.' });
  const mod = u.protocol === 'https:' ? https : http;
  const req = mod.request(u, { method: 'GET', headers: { 'user-agent': UA, accept: '*/*', 'accept-encoding': 'gzip' }, timeout: 9000, rejectUnauthorized: false }, r => {
    if (r.statusCode >= 300 && r.statusCode < 400 && r.headers.location && (depth || 0) < 4) { r.resume(); let nx; try { nx = new URL(r.headers.location, u).href; } catch (e) { return cb({ error: 'Bad redirect.' }); } return fetchHead(nx, cb, (depth || 0) + 1); }
    const chunks = []; let n = 0; r.on('data', c => { n += c.length; if (n > 400000) r.destroy(); else chunks.push(c); });
    r.on('end', () => { let body = Buffer.concat(chunks); try { if (/gzip/.test(r.headers['content-encoding'] || '')) body = zlib.gunzipSync(body); } catch (e) { } cb({ status: r.statusCode, headers: r.headers, finalUrl: u.href, body: body.toString('utf8').slice(0, 120000) }); });
    r.on('error', () => cb({ error: 'The site could not be read.' }));
  });
  req.on('error', e => cb({ error: 'Could not reach that site: ' + (e.code || e.message) })); req.on('timeout', () => { req.destroy(); cb({ error: 'That site did not answer in time.' }); });
  req.end();
}
const SEC_HEADERS = [
  ['strict-transport-security', 'HSTS', 'Forces browsers to use HTTPS, so traffic cannot be downgraded to plain HTTP.'],
  ['content-security-policy', 'Content Security Policy', 'Limits where scripts and other content may load from, the main defence against cross-site scripting (XSS).'],
  ['x-content-type-options', 'X-Content-Type-Options', 'Stops the browser guessing a file\'s type, which can turn an upload into a script.'],
  ['x-frame-options', 'X-Frame-Options', 'Stops the page being put in a hidden frame on another site (clickjacking). Newer sites use CSP frame-ancestors.'],
  ['referrer-policy', 'Referrer-Policy', 'Controls how much of the address is sent to other sites you link to.'],
  ['permissions-policy', 'Permissions-Policy', 'Turns off browser features the site does not need, like the camera or microphone.']
];
function httpheaders(b) {
  return new Promise(resolve => {
    if (!netlib.on()) return resolve(off());
    let url = clean(b.url); if (!/^https?:\/\//i.test(url)) url = 'https://' + url;
    fetchHead(url, r => {
      if (r.error) return resolve(r);
      const h = r.headers, present = [], missing = [];
      for (const [key, name, why] of SEC_HEADERS) { if (h[key]) present.push({ name, why, value: String(h[key]).slice(0, 200) }); else missing.push({ name, why }); }
      const leak = []; for (const k of ['server', 'x-powered-by', 'x-aspnet-version', 'x-generator']) if (h[k]) leak.push({ header: k, value: String(h[k]).slice(0, 120) });
      const score = Math.round(present.length / SEC_HEADERS.length * 100);
      const grade = score >= 85 ? 'A' : score >= 70 ? 'B' : score >= 50 ? 'C' : score >= 30 ? 'D' : 'F';
      resolve({ url: r.finalUrl, status: r.status, grade, score, present, missing, leak, note: leak.length ? 'The site tells visitors what software it runs; attackers use that to pick known weaknesses.' : '' });
    });
  });
}
/* what a site seems to be built with (from its headers and page) */
function fingerprint(b) {
  return new Promise(resolve => {
    if (!netlib.on()) return resolve(off());
    let url = clean(b.url); if (!/^https?:\/\//i.test(url)) url = 'https://' + url;
    fetchHead(url, r => {
      if (r.error) return resolve(r);
      const h = r.headers, body = r.body || '', hits = [];
      const add = (name, where) => { if (!hits.some(x => x.name === name)) hits.push({ name, where }); };
      if (h.server) add(h.server.split('/')[0], 'Server header');
      if (h['x-powered-by']) add(h['x-powered-by'], 'X-Powered-By header');
      const SIG = [[/wp-content|wp-includes/i, 'WordPress'], [/Drupal/i, 'Drupal'], [/Joomla/i, 'Joomla'], [/cdn\.shopify\.com|Shopify/i, 'Shopify'], [/react|data-reactroot|__NEXT_DATA__/i, 'React'], [/_next\//i, 'Next.js'], [/ng-version|angular/i, 'Angular'], [/vue(\.min)?\.js|data-v-/i, 'Vue'], [/jquery/i, 'jQuery'], [/bootstrap/i, 'Bootstrap'], [/cloudflare/i, 'Cloudflare'], [/wix\.com/i, 'Wix'], [/squarespace/i, 'Squarespace'], [/Laravel|laravel_session/i, 'Laravel'], [/django|csrfmiddlewaretoken/i, 'Django'], [/gatsby/i, 'Gatsby']];
      for (const [re, name] of SIG) if (re.test(body) || re.test(JSON.stringify(h))) add(name, 'Page content');
      const gen = /<meta[^>]+name=["']generator["'][^>]+content=["']([^"']+)/i.exec(body); if (gen) add(gen[1].slice(0, 60), 'Generator tag');
      const title = (/<title[^>]*>([^<]{0,120})/i.exec(body) || [])[1] || '';
      resolve({ url: r.finalUrl, title: clean(title), tech: hits.slice(0, 20), note: hits.length ? '' : 'Nothing obvious was found. The site may hide what it runs, which is good practice.' });
    });
  });
}

/* ---------- WHOIS: who owns a domain name ---------- */
function whoisServer(host) {
  const tld = host.split('.').pop().toLowerCase();
  const map = { com: 'whois.verisign-grs.com', net: 'whois.verisign-grs.com', org: 'whois.pir.org', io: 'whois.nic.io', co: 'whois.nic.co', uk: 'whois.nic.uk', dev: 'whois.nic.google', app: 'whois.nic.google', ai: 'whois.nic.ai', me: 'whois.nic.me', info: 'whois.nic.info', biz: 'whois.nic.biz', us: 'whois.nic.us', ca: 'whois.cira.ca', de: 'whois.denic.de', tv: 'whois.nic.tv', xyz: 'whois.nic.xyz' };
  return map[tld] || 'whois.iana.org';
}
function whoisQuery(server, query) {
  return new Promise(resolve => {
    const s = net.connect(43, server); let data = ''; s.setTimeout(9000);
    s.on('connect', () => s.write(query + '\r\n')); s.on('data', c => { data += c; if (data.length > 200000) s.destroy(); });
    s.on('end', () => resolve(data)); s.on('timeout', () => { s.destroy(); resolve(data); }); s.on('error', () => resolve(data));
  });
}
async function whois(b) {
  if (!netlib.on()) return off();
  const host = clean(b.host).replace(/^https?:\/\//, '').replace(/\/.*$/, '').toLowerCase();
  if (!okHost(host) || !host.includes('.')) return { error: 'Type a domain name, like example.com.' };
  let server = whoisServer(host), text = await whoisQuery(server, host);
  const ref = /Registrar WHOIS Server:\s*([^\s]+)/i.exec(text) || /whois:\s*([^\s]+)/i.exec(text);
  if (ref && ref[1] && ref[1].toLowerCase() !== server.toLowerCase()) { const more = await whoisQuery(ref[1].trim(), host); if (more && more.length > 40) text = more; server = ref[1].trim(); }
  if (!text || text.length < 20) return { host, error: 'No WHOIS answer. The name may not exist, or its registry does not answer public WHOIS.' };
  const field = re => { const m = re.exec(text); return m ? clean(m[1]) : ''; };
  const facts = {
    registrar: field(/Registrar:\s*(.+)/i),
    created: field(/Creation Date:\s*(.+)/i) || field(/Created(?:\s+On)?:\s*(.+)/i),
    expires: field(/Registry Expiry Date:\s*(.+)/i) || field(/Expir\w+ Date:\s*(.+)/i),
    updated: field(/Updated Date:\s*(.+)/i),
    status: (text.match(/Domain Status:\s*([^\s]+)/gi) || []).slice(0, 5).map(x => x.replace(/Domain Status:\s*/i, '')),
    nameservers: (text.match(/Name Server:\s*([^\s]+)/gi) || []).map(x => clean(x.replace(/Name Server:\s*/i, '')).toLowerCase()).slice(0, 8),
    registrant: field(/Registrant Organization:\s*(.+)/i) || field(/Registrant Name:\s*(.+)/i)
  };
  return { host, server, facts, raw: text.slice(0, 6000) };
}

/* ---------- subdomains, from public certificate logs (crt.sh) ---------- */
function getJson(url, cb) {
  https.get(url, { headers: { 'user-agent': UA, accept: 'application/json' }, timeout: 15000 }, r => {
    if (r.statusCode !== 200) { r.resume(); return cb({ error: 'The certificate log answered ' + r.statusCode + '.' }); }
    const c = []; let n = 0; r.on('data', x => { n += x.length; if (n > 8e6) r.destroy(); else c.push(x); });
    r.on('end', () => { try { cb({ json: JSON.parse(Buffer.concat(c).toString('utf8')) }); } catch (e) { cb({ error: 'The log sent back something unreadable.' }); } });
    r.on('error', () => cb({ error: 'The certificate log could not be read.' }));
  }).on('error', () => cb({ error: 'The certificate log could not be reached.' })).on('timeout', function () { this.destroy(); cb({ error: 'The certificate log did not answer in time.' }); });
}
function subdomains(b) {
  return new Promise(resolve => {
    if (!netlib.on()) return resolve(off());
    const host = clean(b.host).replace(/^https?:\/\//, '').replace(/\/.*$/, '').toLowerCase();
    if (!okHost(host) || !host.includes('.')) return resolve({ error: 'Type a domain name, like example.com.' });
    getJson('https://crt.sh/?q=%25.' + encodeURIComponent(host) + '&output=json', r => {
      if (r.error) return resolve(r);
      const set = new Set();
      for (const row of (r.json || []).slice(0, 8000)) String(row.name_value || '').split(/\n/).forEach(n => { n = n.trim().toLowerCase().replace(/^\*\./, ''); if (n.endsWith('.' + host) || n === host) set.add(n); });
      const list = [...set].sort(); resolve({ host, count: list.length, subdomains: list.slice(0, 500), note: list.length ? 'From public certificate logs. Some names may be old or no longer in use.' : 'None found in public certificate logs.' });
    });
  });
}

/* ---------- what is known about an IP address ---------- */
function ipinfo(b) {
  return new Promise(resolve => {
    if (!netlib.on()) return resolve(off());
    const ip = clean(b.host).replace(/^https?:\/\//, '').replace(/[\/:].*$/, '');
    if (!net.isIP(ip) && !okHost(ip)) return resolve({ error: 'Type an IP address or host name.' });
    getJson('https://ipwho.is/' + encodeURIComponent(ip), r => {
      if (r.error) return resolve(r);
      const j = r.json || {}; if (j.success === false) return resolve({ error: j.message || 'That address could not be looked up.' });
      resolve({ ip: j.ip, type: j.type, country: j.country, region: j.region, city: j.city, org: (j.connection || {}).org || j.org, isp: (j.connection || {}).isp, asn: (j.connection || {}).asn, lat: j.latitude, lon: j.longitude, note: 'Location of an IP is the network it belongs to, not the exact person; it can be a city or two off.' });
    });
  });
}

/* ---------- hashes: name a hash, and crack simple ones from a word list ---------- */
const HASHES = [[32, 'MD5', 'md5'], [40, 'SHA-1', 'sha1'], [64, 'SHA-256', 'sha256'], [96, 'SHA-384', 'sha384'], [128, 'SHA-512', 'sha512'], [16, 'MySQL (old) / CRC', ''], [56, 'SHA-224', 'sha224']];
function hashId(b) {
  const h = clean(b.hash).replace(/^0x/i, '');
  if (!/^[0-9a-fA-F]+$/.test(h)) return { error: 'A hash is only the letters a to f and digits. Paste just the hash.' };
  const guesses = HASHES.filter(x => x[0] === h.length).map(x => ({ name: x[1], algo: x[2] }));
  if (/^\$2[aby]\$/.test(clean(b.hash))) guesses.unshift({ name: 'bcrypt', algo: '' });
  if (/^\$6\$/.test(clean(b.hash))) guesses.unshift({ name: 'sha512crypt (Linux shadow)', algo: '' });
  return { hash: h.toLowerCase(), length: h.length, guesses: guesses.length ? guesses : [{ name: 'Unknown length (' + h.length + ' hex characters)', algo: '' }] };
}
function hashMake(b) {
  const text = String(b.text == null ? '' : b.text); const out = {};
  for (const a of ['md5', 'sha1', 'sha256', 'sha512']) out[a] = crypto.createHash(a).update(text).digest('hex');
  return { text: text.slice(0, 200), hashes: out };
}
/* a dictionary attack against YOUR OWN unsalted hash: try common passwords and an optional word list */
const COMMON = ['123456', 'password', '123456789', '12345678', '12345', 'qwerty', 'abc123', 'password1', '111111', '1234567', 'sunshine', 'iloveyou', 'admin', 'welcome', 'monkey', 'letmein', 'dragon', 'football', 'master', 'login', 'princess', 'solo', 'passw0rd', 'starwars', 'hello', 'freedom', 'whatever', 'qazwsx', 'trustno1', 'superman', 'batman', 'test', 'root', 'toor', 'changeme', 'secret', 'ninja', 'azerty', '000000', '654321', 'hunter2', 'baseball', 'shadow', 'michael', 'jennifer', 'computer', 'michelle', 'daniel', 'ashley', 'qwerty123', 'zaq12wsx'];
function hashCrack(b) {
  const h = clean(b.hash).toLowerCase().replace(/^0x/i, '');
  if (!/^[0-9a-f]+$/.test(h)) return { error: 'Paste the hash (only a to f and digits).' };
  const algo = HASHES.find(x => x[0] === h.length && x[2]); if (!algo) return { error: 'This length does not match MD5, SHA-1 or SHA-256, the kinds this can try.' };
  const words = COMMON.concat(String(b.words || '').split(/[\s,]+/).map(w => w.trim()).filter(Boolean).slice(0, 5000));
  const seen = new Set();
  for (const w of words) { if (seen.has(w)) continue; seen.add(w); if (crypto.createHash(algo[2]).update(w).digest('hex') === h) return { cracked: true, algo: algo[1], password: w, tried: seen.size }; }
  return { cracked: false, algo: algo[1], tried: seen.size, note: 'None of the common passwords or your words matched. A strong password is not in any word list, which is the point.' };
}

/* ---------- this PC's own network (local, needs no internet) ---------- */
function run(cmd, args, ms) { try { return cp.execFileSync(cmd, args, { encoding: 'utf8', windowsHide: true, timeout: ms || 12000 }); } catch (e) { return (e.stdout || '') + (e.stderr || ''); } }
function myNetwork() {
  const ifaces = []; for (const [name, list] of Object.entries(os.networkInterfaces())) for (const a of list || []) if (!a.internal) ifaces.push({ name, address: a.address, family: a.family === 'IPv4' || a.family === 4 ? 'IPv4' : 'IPv6', mac: a.mac });
  const arp = run('arp', ['-a'], 8000); const devices = [];
  for (const line of arp.split(/\r?\n/)) { const m = /^\s*(\d+\.\d+\.\d+\.\d+)\s+([0-9a-f-]{11,17})\s+(\w+)/i.exec(line); if (m && !/ff-ff-ff|224\.0\.0|239\.|255\.255\.255/.test(m[1] + m[2])) devices.push({ ip: m[1], mac: m[2].toLowerCase(), kind: m[3] }); }
  return { interfaces: ifaces, devices: devices.slice(0, 200), note: 'Devices your PC has recently talked to on the local network (from the ARP table). This stays on your own network and needs no internet.' };
}
function wifi() {
  const out = run('netsh', ['wlan', 'show', 'networks', 'mode=bssid'], 10000);
  if (/not running|no wireless|not started/i.test(out)) return { networks: [], note: 'No Wi-Fi was found on this PC, or the Wi-Fi service is off.' };
  const nets = []; let cur = null;
  for (const line of out.split(/\r?\n/)) {
    let m;
    if ((m = /^\s*SSID\s+\d+\s*:\s*(.*)$/.exec(line))) { cur = { ssid: clean(m[1]) || '(hidden)', auth: '', enc: '', signal: '', channel: '' }; nets.push(cur); }
    else if (cur && (m = /Authentication\s*:\s*(.+)$/.exec(line))) cur.auth = clean(m[1]);
    else if (cur && (m = /Encryption\s*:\s*(.+)$/.exec(line))) cur.enc = clean(m[1]);
    else if (cur && (m = /Signal\s*:\s*(.+)$/.exec(line))) cur.signal = clean(m[1]);
    else if (cur && (m = /Channel\s*:\s*(.+)$/.exec(line))) cur.channel = clean(m[1]);
  }
  nets.forEach(n => { n.safe = /WPA2|WPA3/i.test(n.auth); n.warn = /Open|WEP/i.test(n.auth) ? 'Open or WEP: not safe, anyone nearby can read the traffic.' : ''; });
  return { networks: nets.slice(0, 60), note: 'Wi-Fi networks your PC can see right now. Reading the air around you is legal; joining a network you are not allowed on is not.' };
}

/* ---------- the path to a host (tracert) ---------- */
function traceroute(b) {
  if (!netlib.on()) return off();
  const host = clean(b.host).replace(/^https?:\/\//, '').replace(/[\/:].*$/, '');
  if (!okHost(host)) return { error: 'Type a host name or IP address.' };
  const out = run('tracert', ['-d', '-h', '20', '-w', '1200', host], 60000);
  const hops = [];
  for (const line of out.split(/\r?\n/)) { const m = /^\s*(\d+)\s+(.+?)\s*$/.exec(line); if (m && /\d+\s*ms|\*/.test(m[2])) { const ip = (/(\d+\.\d+\.\d+\.\d+)/.exec(m[2]) || [])[1] || ''; const times = (m[2].match(/(<?\d+)\s*ms/g) || []).join(' '); hops.push({ hop: +m[1], ip: ip || '(no reply)', times: times || (/\*/.test(m[2]) ? 'timed out' : '') }); } }
  return { host, hops: hops.slice(0, 30), note: hops.length ? 'Each line is one router between this PC and the host.' : 'No path came back. The host or the routers may block tracing.' };
}

/* ---------- live connections, and a Wireshark-style packet capture ---------- */
/* who this PC is talking to right now (netstat), with the program behind each connection. Local, no internet needed. */
function connections() {
  const ns = run('netstat', ['-ano', '-p', 'tcp'], 9000), tasks = run('tasklist', ['/fo', 'csv', '/nh'], 9000);
  const names = {}; for (const line of tasks.split(/\r?\n/)) { const m = /^"([^"]+)","(\d+)"/.exec(line); if (m) names[m[2]] = m[1]; }
  const out = [];
  for (const line of ns.split(/\r?\n/)) {
    const m = /^\s*TCP\s+(\S+):(\d+)\s+(\S+):(\d+)\s+(\w+)\s+(\d+)/.exec(line); if (!m) continue;
    if (m[5] === 'LISTENING' && /^(0\.0\.0\.0|\[::\]|127\.)/.test(m[3])) { out.push({ state: m[5], local: m[1] + ':' + m[2], remote: '', pid: m[6], program: names[m[6]] || '' }); continue; }
    if (/^(0\.0\.0\.0|\[::\]|127\.0\.0\.1)$/.test(m[3])) continue;
    out.push({ state: m[5], local: m[1] + ':' + m[2], remote: m[3] + ':' + m[4], pid: m[6], program: names[m[6]] || '' });
  }
  const seen = new Set(), list = out.filter(c => { const k = c.local + c.remote + c.state; if (seen.has(k)) return false; seen.add(k); return true; });
  return { connections: list.slice(0, 200), note: 'Live network connections of this PC, with the program behind each. This reads your own PC and needs no internet. "LISTENING" means a program is waiting for connections on that port.' };
}
/* Wireshark's own capture engine (tshark): record a short burst of packets and show them in plain rows */
const TSHARK = () => { for (const p of ['C:/Program Files/Wireshark/tshark.exe', 'C:/Program Files (x86)/Wireshark/tshark.exe']) { try { if (require('fs').statSync(p).isFile()) return p; } catch (e) { } } try { return run('where', ['tshark'], 4000).split(/\r?\n/)[0].trim() || ''; } catch (e) { return ''; } };
function interfaces() {
  const t = TSHARK(); if (!t) return { error: 'Wireshark (tshark) was not found. Install it from wireshark.org, then come back.', tool: false };
  const out = run(t, ['-D'], 8000), list = [];
  for (const line of out.split(/\r?\n/)) { const m = /^(\d+)\.\s+(\S+)\s*(?:\(([^)]*)\))?/.exec(line); if (m) list.push({ n: +m[1], id: m[2], name: m[3] || m[2] }); }
  return { tool: true, interfaces: list };
}
function capture(b) {
  const t = TSHARK(); if (!t) return { error: 'Wireshark (tshark) was not found on this PC. Install it from wireshark.org.', tool: false };
  const ifaces = interfaces().interfaces || [];
  let iface = clean(b.iface);
  if (!iface || !ifaces.some(x => x.id === iface)) { const wifi = ifaces.find(x => /wi-?fi/i.test(x.name)) || ifaces.find(x => /ethernet/i.test(x.name) && !/vethernet|virtual|bluetooth/i.test(x.name)) || ifaces[0]; iface = wifi ? wifi.id : ''; }
  if (!iface) return { error: 'No capture interface was found. Npcap may not be installed (it comes with Wireshark).' };
  const count = Math.min(200, Math.max(5, +b.count || 60)), secs = Math.min(30, Math.max(3, +b.seconds || 12));
  const filter = /^[A-Za-z0-9 .,:_()!=<>/-]{0,120}$/.test(String(b.filter || '')) ? String(b.filter || '').trim() : '';
  const args = ['-i', iface, '-c', String(count), '-a', 'duration:' + secs, '-n', '-l', '-T', 'fields', '-E', 'separator=\t', '-e', 'frame.time_relative', '-e', 'ip.src', '-e', 'ipv6.src', '-e', 'ip.dst', '-e', 'ipv6.dst', '-e', '_ws.col.Protocol', '-e', '_ws.col.Info'];
  if (filter) args.push('-f', filter);
  let out = '', err = '';
  try { out = cp.execFileSync(t, args, { encoding: 'utf8', windowsHide: true, timeout: (secs + 8) * 1000 }); } catch (e) { out = e.stdout || ''; err = (e.stderr || e.message || '').toString(); }
  if (!out.trim() && /permitted|permission|npcap|the system cannot|access is denied/i.test(err)) return { error: 'The capture needs permission to read the network card. Open Moundshroud as administrator, or run Wireshark once so Npcap is set up.', iface };
  const packets = [], proto = {};
  for (const line of out.split(/\r?\n/)) { const f = line.split('\t'); if (f.length < 6 || !f[0]) continue; const src = f[1] || f[2] || '', dst = f[3] || f[4] || '', p = f[5] || '', info = (f[6] || '').slice(0, 120); if (!src && !dst) continue; proto[p] = (proto[p] || 0) + 1; packets.push({ t: (+f[0] || 0).toFixed(2), src, dst, proto: p, info }); }
  const ifName = (ifaces.find(x => x.id === iface) || {}).name || iface;
  return { iface: ifName, count: packets.length, seconds: secs, protocols: Object.entries(proto).sort((a, c) => c[1] - a[1]).map(([k, v]) => ({ proto: k, count: v })), packets: packets.slice(0, 200), note: packets.length ? 'A short recording of real network traffic on ' + ifName + '. Each row is one packet: when, from, to, the protocol, and a summary.' : 'No packets were captured. The network may have been quiet, or the capture needs administrator rights.' };
}

module.exports = { dnslookup, reverse, portscan, tlscert, httpheaders, fingerprint, whois, subdomains, ipinfo, hashId, hashMake, hashCrack, myNetwork, wifi, traceroute, connections, interfaces, capture, okHost, PORTS };

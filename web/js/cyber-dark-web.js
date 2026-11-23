// Cyber > Cyber Desktop > Fake Dark Web. A second, separate section of the simulated internet: Tor-style hidden
// services with .onion addresses, each one written by hand with its own layout and its own little backend state
// (listings, orders, threads, submissions, chats). It is fiction in a sealed page: every address, vendor, leak and
// message is invented here, nothing is fetched, no socket is opened, and no real hidden service is ever contacted.
// The sites are appended to the fake internet's catalogue, so the Browser, the address bar, Moundshroud Search and
// every moundshell command (curl, wget, browser, get, paths, breach web, ...) answer for them exactly as they do
// for the surface web. Only the sites that really are markets sell anything.
(() => {
  const A = (window.A = window.A || {});
  const esc = s => String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const cap = s => String(s).charAt(0).toUpperCase() + String(s).slice(1);
  const pick = list => list[(Math.random() * list.length) | 0];
  const int = (lo, hi) => lo + ((Math.random() * (hi - lo + 1)) | 0);
  const money = n => '$' + Number(n).toFixed(2);
  const day = at => new Date(at).toLocaleDateString([], { month: 'short', day: 'numeric' });
  const clock = at => new Date(at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

  /* the same bridge the surface pages use: a link or a form posts back to the Cyber Desktop window, which asks the
     fake internet for the next page. Without it a dark page is inert inside its frame. */
  const bridge = () => (A.cyberWeb && A.cyberWeb.bridgeScript) || '';

  const pubkey = seed => {
    let h = 0;
    for (const c of String(seed)) h = (h * 31 + c.charCodeAt(0)) >>> 0;
    const abc = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
    let out = '';
    for (let i = 0; i < 40; i++) { h = (Math.imul(h, 1103515245) + 12345) >>> 0; out += abc[h % 32]; if (i % 5 === 4) out += ' '; }
    return out.trim();
  };
  const fingerprint = seed => {
    let h = 0;
    for (const c of String(seed)) h = (h * 131 + c.charCodeAt(0)) >>> 0;
    const hex = n => (h = (Math.imul(h, 48271) % 2147483647) >>> 0, (h % 0xffff).toString(16).toUpperCase().padStart(4, '0'));
    return Array.from({ length: 10 }, hex).join(' ');
  };

  /* ------------------------------------------------------------------ shared chrome ------------------------------------------------------- */
  function frame(site, title, css, body) {
    return '<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">' +
      '<title>' + esc(title) + ' · ' + esc(site.brand) + '</title><style>' +
      'html,body{margin:0;padding:0;background:' + (site.bg || '#07080c') + ';color:' + (site.ink || '#d6d9e2') + ';}' +
      'a{color:' + (site.link || '#7fd1ff') + ';text-decoration:none;}a:hover{text-decoration:underline;}' +
      'table{border-collapse:collapse;width:100%;}' +
      'input,textarea,select{background:' + (site.field || '#11131a') + ';border:1px solid ' + (site.line || '#232634') + ';color:inherit;padding:6px 8px;font:inherit;}' +
      'button{background:' + (site.btn || '#243044') + ';border:1px solid ' + (site.line || '#232634') + ';color:inherit;padding:7px 12px;font:inherit;cursor:pointer;}' +
      'button:hover{filter:brightness(1.25);}' +
      css + '</style></head><body>' + body + bridge() + '</body></html>';
  }
  const warnBar = text => '<div class="warn">' + text + '</div>';
  const onionLine = (site, v3) => '<div class="onion">' + esc(site.host) + (v3 ? '  ·  ' + esc(v3) : '') + '</div>';

  /* ------------------------------------------------------------------ backends ----------------------------------------------------------- */
  const MARKETS = [
    { id: 1, name: 'Silver Fern — 5 g sample', cat: 'Botanicals', vendor: 'fernworks', price: 62, xmr: 0.42, stock: 18, rating: 4.8, reviews: 214, ships: 'EU · 3–6 days', desc: 'Vacuum-sealed sample with silica pack. Escrow only; no finalise-early.' },
    { id: 2, name: 'Amber Vial — 10 ml', cat: 'Botanicals', vendor: 'fernworks', price: 118, xmr: 0.79, stock: 7, rating: 4.6, reviews: 96, ships: 'EU · 3–6 days', desc: 'Amber glass, batch-labelled. Ships from a drop box, tracked only to the country.' },
    { id: 3, name: 'Loose-leaf blend #4', cat: 'Botanicals', vendor: 'quietgrove', price: 34, xmr: 0.23, stock: 41, rating: 4.9, reviews: 512, ships: 'Worldwide · 7–14 days', desc: 'Aromatic blend, plain envelope, decoy invoice included.' },
    { id: 4, name: 'Pressed tablets (strip of 10)', cat: 'Pharma', vendor: 'medlinex', price: 89, xmr: 0.6, stock: 25, rating: 4.4, reviews: 88, ships: 'EU · 4–8 days', desc: 'Blister strip, batch and expiry printed. No prescription required, as advertised.' },
    { id: 5, name: 'Sealed vial kit', cat: 'Pharma', vendor: 'medlinex', price: 156, xmr: 1.05, stock: 4, rating: 4.2, reviews: 37, ships: 'EU · 4–8 days', desc: 'Kit with sterile water and printed instructions. Shipped double-boxed.' },
    { id: 6, name: 'Anonymous SIM (EU roaming)', cat: 'Services', vendor: 'ghostline', price: 45, xmr: 0.3, stock: 60, rating: 4.7, reviews: 340, ships: 'Digital · instant', desc: 'Activated SIM details delivered as an encrypted note. Roaming in 31 countries.' },
    { id: 7, name: 'Clean mailbox, 90 days', cat: 'Services', vendor: 'ghostline', price: 28, xmr: 0.19, stock: 120, rating: 4.5, reviews: 190, ships: 'Digital · instant', desc: 'Registration-free mailbox with PGP-only recovery. No logs kept, by policy.' },
    { id: 8, name: 'Vintage postcard lot', cat: 'Collectibles', vendor: 'paperdrift', price: 74, xmr: 0.5, stock: 9, rating: 4.9, reviews: 61, ships: 'Worldwide · 10 days', desc: 'Forty unstamped cards from the 1930s. Plain outer envelope, no markings.' },
    { id: 9, name: 'Brass key blank set', cat: 'Collectibles', vendor: 'paperdrift', price: 22, xmr: 0.15, stock: 33, rating: 4.3, reviews: 24, ships: 'Worldwide · 10 days', desc: 'Six blanks, unmarked. Listed as a locksmith practice set.' },
    { id: 10, name: 'Encrypted USB, 32 GB', cat: 'Hardware', vendor: 'coldcell', price: 66, xmr: 0.45, stock: 14, rating: 4.8, reviews: 145, ships: 'EU · 5 days', desc: 'Hardware-encrypted stick, wiped and re-flashed. Ships with a random passphrase card.' },
    { id: 11, name: 'Faraday pouch (2 pack)', cat: 'Hardware', vendor: 'coldcell', price: 39, xmr: 0.26, stock: 52, rating: 4.6, reviews: 203, ships: 'EU · 5 days', desc: 'Signal-blocking pouches, tested per unit. Plain retail packaging.' },
    { id: 12, name: 'Vanity .onion address', cat: 'Services', vendor: 'mirrorcraft', price: 240, xmr: 1.62, stock: 3, rating: 4.1, reviews: 12, ships: 'Digital · 2 days', desc: 'Fifteen-character vanity prefix, key handed over signed. No hosting included.' }
  ];
  const LEAKS = [
    { id: 1, name: 'Halden Freight', sector: 'Logistics', country: 'NL', size: '412 GB', files: '1.9M files', deadline: 6, status: 'countdown', summary: 'Dispatch, customs paperwork and driver records. We kept the payroll folder out of the release.' },
    { id: 2, name: 'Mereside Health Trust', sector: 'Healthcare', country: 'UK', size: '86 GB', files: '311K files', deadline: 0, status: 'published', summary: 'Appointment exports and internal memos. Patient identifiers partially redacted in the sample only.' },
    { id: 3, name: 'Orinoco Legal Partners', sector: 'Legal', country: 'ES', size: '204 GB', files: '902K files', deadline: 2, status: 'negotiating', summary: 'Case files and correspondence. Two of five backups were encrypted before we were removed.' },
    { id: 4, name: 'Tapline Utilities', sector: 'Energy', country: 'DE', size: '1.1 TB', files: '4.4M files', deadline: 11, status: 'countdown', summary: 'SCADA diagrams, maintenance schedules and contractor lists.' },
    { id: 5, name: 'Brightwell Academy', sector: 'Education', country: 'US', size: '37 GB', files: '140K files', deadline: 0, status: 'released', summary: 'Enrolment data and internal policy drafts. Released after the deadline passed without contact.' },
    { id: 6, name: 'Cobalt Ridge Mining', sector: 'Mining', country: 'AU', size: '660 GB', files: '2.2M files', deadline: 4, status: 'countdown', summary: 'Survey data, drill logs and supplier contracts.' }
  ];
  const ACCESS = [
    { id: 1, sector: 'Manufacturing', country: 'US', revenue: '$180M', type: 'VPN + domain admin', price: 4200, proof: 'Networkshare listing, three hosts', updated: 2 },
    { id: 2, sector: 'Insurance', country: 'UK', revenue: '$96M', type: 'RDP, local admin', price: 2600, proof: 'Screenshot of file server', updated: 5 },
    { id: 3, sector: 'Hospitality', country: 'FR', revenue: '$44M', type: 'Citrix, no MFA', price: 1500, proof: 'Mailbox sample', updated: 8 },
    { id: 4, sector: 'Logistics', country: 'NL', revenue: '$210M', type: 'Edge appliance, root', price: 6100, proof: 'Config export', updated: 1 },
    { id: 5, sector: 'Retail', country: 'CA', revenue: '$58M', type: 'POS back office', price: 1900, proof: 'Inventory export', updated: 12 }
  ];
  const BOARDS = [
    { id: 1, name: 'Introductions & rules', threads: 42, posts: 610, last: 'mirrorcraft · 2h' },
    { id: 2, name: 'Marketplace reviews', threads: 311, posts: 4028, last: 'fernworks · 18m' },
    { id: 3, name: 'OPSEC & tooling', threads: 188, posts: 2210, last: 'nullbyte · 41m' },
    { id: 4, name: 'Leaks & disclosures', threads: 96, posts: 840, last: 'ghostline · 3h' },
    { id: 5, name: 'Scam reports', threads: 240, posts: 1705, last: 'paperdrift · 6h' }
  ];
  const THREADS = [
    { id: 1, board: 1, title: 'Read this before you post anything', author: 'mod_ash', replies: 12, at: Date.now() - 86400000 * 3, body: 'No doxxing, no real-world threats, no requests for anything that touches a live system. This board is a simulation and the moderators treat it that way.' },
    { id: 2, board: 2, title: 'fernworks — three orders, all arrived', author: 'slowpost', replies: 31, at: Date.now() - 3600000 * 5, body: 'Third order landed in six days, packaging was plain and the decoy invoice was convincing. Escrow released after arrival, as usual.' },
    { id: 3, board: 2, title: 'Warning: fake mirror for Nightfall', author: 'mod_ash', replies: 48, at: Date.now() - 3600000 * 9, body: 'There is a clone with the same branding on a different onion. Check the signed mirror list on the market itself before signing in.' },
    { id: 4, board: 3, title: 'Keeping a written threat model for a small service', author: 'nullbyte', replies: 19, at: Date.now() - 3600000 * 26, body: 'One page: what you are protecting, who you are protecting it from, and what you accept losing. Update it when the service changes.' },
    { id: 5, board: 5, title: 'Vendor vanished with 0.8 XMR in escrow', author: 'greyuser', replies: 74, at: Date.now() - 3600000 * 40, body: 'Order never shipped and the account went quiet. Escrow refunded after the dispute window, so use escrow and never finalise early.' }
  ];
  const STORIES = [
    { id: 1, title: 'The leak that never arrived: inside a failed extortion', section: 'Investigations', by: 'R. Okonjo', at: Date.now() - 3600000 * 7, lede: 'A logistics firm refused to pay, restored from backups, and published its own incident report. The leak site moved on within a week.' },
    { id: 2, title: 'Carding shops are quietly shrinking', section: 'Markets', by: 'M. Vela', at: Date.now() - 86400000 * 2, lede: 'Payment processors and chip rollouts have cut the value of bulk card data. Vendors are pivoting to account access instead.' },
    { id: 3, title: 'What a signed mirror list actually proves', section: 'OPSEC', by: 'editor', at: Date.now() - 86400000 * 4, lede: 'A PGP signature proves the list came from the key holder. It says nothing about whether the service behind the address is honest.' },
    { id: 4, title: 'The volunteers who monitor hidden services', section: 'Community', by: 'S. Idris', at: Date.now() - 86400000 * 6, lede: 'Uptime probes, mirror lists and takedown notices: the small, unglamorous infrastructure behind every directory.' }
  ];
  const SUBMISSIONS = [];
  const CHATS = {};
  const ORDERS = [];
  const state = { cart: {} };

  /* ------------------------------------------------------------------ 1. the directory portal --------------------------------------------- */
  const indexSite = {
    brand: 'The Onion Index', host: 'darknet-index.onion', kind: 'Directory', icon: '🧅',
    v3: 'onionidx7q2v4n6m8k1s3d5f7g9h2j4l6p8r0t2w4y6z8b1c3e5g7.onion',
    cat: { id: 'dark-index', icon: '🧅', label: 'Onion directory', route: '/', routeLabel: 'Directory' },
    topic: 'Tor hidden services', region: 'Onion space', bg: '#05070a', ink: '#c8ffd8', link: '#4dff9e', line: '#12insert', field: '#0b0f12', btn: '#123524',
    tagline: 'A plain-text index of hidden services. No JavaScript, no trackers, no accounts.',
    render(path, query) {
      const q = String(query.get('q') || '').trim().toLowerCase();
      const all = sites().filter(s => s !== this);
      const hits = q ? all.filter(s => (s.brand + ' ' + s.host + ' ' + s.kind + ' ' + (s.topic || '') + ' ' + (s.tagline || '')).toLowerCase().includes(q)) : all;
      const groups = {};
      for (const s of hits) (groups[s.kind] = groups[s.kind] || []).push(s);
      const row = s => '<tr><td class="dot">●</td><td><a href="https://' + esc(s.host) + '/">' + esc(s.brand) + '</a>' +
        '<div class="host">' + esc(s.host) + '</div></td><td>' + esc(s.kind) + '</td>' +
        '<td class="tag">' + (s.market ? 'market' : 'no sales') + '</td><td class="fp">' + esc(fingerprint(s.host).slice(0, 23)) + '…</td>' +
        '<td class="up">' + (88 + (s.host.length % 12)) + '%</td></tr>';
      const body = '<header class="hdr"><b>THE ONION INDEX</b><span>mirror 3 of 4 · signed ' + day(Date.now()) + '</span></header>' +
        '<div class="shell">' + warnBar('This is a simulated hidden-service directory inside the Cyber Desktop. Every address, vendor and leak below is invented; nothing here is reachable, and nothing leaves this page.') +
        '<p class="lede">Plain HTML, no scripts, no accounts. An uptime figure only means an address answered — it is not a statement about who runs it.</p>' +
        '<form action="/" method="get" class="find"><input name="q" value="' + esc(q) + '" placeholder="search brands, hosts, categories"><button>Search</button></form>' +
        '<p class="crumbs"><a href="/">all</a> · <a href="/about">about</a> · <a href="/mirrors">mirrors</a> · <a href="/pgp.txt">pgp key</a> · <a href="/seized">seized</a></p>' +
        (q ? '<h2>Results for “' + esc(q) + '” (' + hits.length + ')</h2>' : '') +
        Object.keys(groups).sort().map(kind => '<h2>' + esc(kind) + 's</h2><table><tr><th></th><th>Service</th><th>Type</th><th>Sales</th><th>Key fingerprint</th><th>Uptime</th></tr>' +
          groups[kind].map(row).join('') + '</table>').join('') +
        '<h2>Recently seized</h2><table><tr><th>Service</th><th>Status</th><th>Notice</th></tr>' +
        '<tr><td>silkmirror.onion</td><td class="bad">seized</td><td>banner replaced by law-enforcement notice</td></tr>' +
        '<tr><td>oldbazaar.onion</td><td class="bad">offline</td><td>no answer for 31 days — removed from the index</td></tr>' +
        '<tr><td>clone-of-nightfall.onion</td><td class="bad">phantom</td><td>clone; signature does not match the operator key</td></tr></table>' +
        '<footer>Index built by hand. Listings are claims, not endorsements. No JavaScript, no cookies, no logs.</footer></div>';
      return { status: 200, type: 'text/html', body: frame(this, 'Index', INDEX_CSS, body) };
    }
  };
  const INDEX_CSS = 'body{font:13px/1.55 "Lucida Console",Consolas,monospace;}' +
    '.hdr{display:flex;justify-content:space-between;align-items:baseline;padding:14px 20px;border-bottom:1px solid #123524;background:#060b08;}' +
    '.hdr b{letter-spacing:.28em;color:#4dff9e;}.hdr span{color:#4f7a5e;font-size:11px;}' +
    '.shell{max-width:980px;margin:0 auto;padding:18px 20px 40px;}' +
    '.warn{border:1px solid #3a2b0a;background:#120d02;color:#ffc861;padding:10px 12px;margin:12px 0;font-size:12px;}' +
    '.lede{color:#7fa78d;max-width:720px;}h2{color:#4dff9e;font-size:13px;letter-spacing:.14em;text-transform:uppercase;margin:26px 0 8px;border-bottom:1px solid #123524;padding-bottom:6px;}' +
    'table{font-size:12px;}th{text-align:left;color:#4f7a5e;font-weight:400;padding:6px 8px;border-bottom:1px solid #163021;}td{padding:7px 8px;border-bottom:1px solid #0f1f16;vertical-align:top;}' +
    '.host{color:#4f7a5e;font-size:11px;}.dot{color:#4dff9e;}.tag{color:#8fd6a9;font-size:11px;}.fp{color:#3f6b52;font-size:10.5px;letter-spacing:.04em;}.up{color:#8fd6a9;}.bad{color:#ff6b6b;}' +
    '.find{display:flex;gap:8px;margin:14px 0;}input{flex:1;background:#0b0f12;border:1px solid #1d3a2a;color:#c8ffd8;padding:8px 10px;font:inherit;}button{background:#123524;border:1px solid #1d3a2a;color:#c8ffd8;padding:8px 14px;}' +
    '.crumbs{color:#3f6b52;font-size:12px;}.onion{color:#3f6b52;font-size:11px;}footer{margin-top:30px;color:#3f6b52;font-size:11px;border-top:1px solid #123524;padding-top:12px;}';

  indexSite.render = function (path, query) {
    if (path === '/pgp.txt') return { status: 200, type: 'text/plain', body: '-----BEGIN PGP PUBLIC KEY BLOCK-----\nComment: The Onion Index signing key (simulated)\n\nmQINBG' + pubkey('index') + '\n=8QxT\n-----END PGP PUBLIC KEY BLOCK-----\n' };
    if (path === '/about') return this.page('About', '<h2>About this index</h2><p>We list hidden services we have seen answer at least once in the last thirty days, with the fingerprint of the key that signed their mirror list where one exists.</p><p>A green probe is a network fact. It is not a judgement about the service. Clones answer too.</p>');
    if (path === '/mirrors') return this.page('Mirrors', '<h2>Mirrors</h2><table><tr><th>Mirror</th><th>Status</th><th>Signed</th></tr><tr><td>darknet-index.onion</td><td>up · 41 ms</td><td>yes</td></tr><tr><td>onionidx2…onion</td><td>up · 88 ms</td><td>yes</td></tr><tr><td>onionidx3…onion</td><td>slow · 310 ms</td><td>yes</td></tr><tr><td>onionidx4…onion</td><td>down</td><td>—</td></tr></table>');
    if (path === '/seized') return this.page('Seized', '<h2>Seized and offline</h2><p>Services whose addresses stopped answering are kept here for a month, so nobody mistakes a clone for the original.</p>');
    return this.render === indexSite.render ? indexPage.call(this, path, query) : null;
  };

  function indexPage(path, query) {
    const q = String(query.get('q') || '').trim();
    const all = sites().filter(s => s !== indexSite);
    const hits = q ? all.filter(s => (s.brand + ' ' + s.host + ' ' + s.kind + ' ' + (s.topic || '')).toLowerCase().includes(q.toLowerCase())) : all;
    const groups = {};
    for (const s of hits) (groups[s.kind] = groups[s.kind] || []).push(s);
    const row = s => '<tr><td class="dot">●</td><td><a href="https://' + esc(s.host) + '/">' + esc(s.brand) + '</a><div class="host">' + esc(s.host) + '</div></td>' +
      '<td>' + esc(s.kind) + '</td><td class="tag">' + (s.market ? 'market' : 'no sales') + '</td>' +
      '<td class="fp">' + esc(fingerprint(s.host).slice(0, 23)) + '…</td><td class="up">' + (88 + (s.host.length % 12)) + '%</td></tr>';
    return {
      status: 200, type: 'text/html',
      body: '<!doctype html><html><head><meta charset="utf-8"><title>The Onion Index</title><style>' + INDEX_CSS + '</style></head><body>' +
        '<header class="hdr"><b>THE ONION INDEX</b><span>mirror 3 of 4 · signed ' + day(Date.now()) + '</span></header><div class="shell">' +
        warnBar('This is a simulated hidden-service directory inside the Cyber Desktop. Every address, vendor and leak below is invented; nothing here is reachable and nothing leaves this page.') +
        '<p class="lede">Plain HTML, no scripts, no accounts. An uptime figure only means an address answered — it is not a statement about who runs it.</p>' +
        '<form action="/" method="get" class="find"><input name="q" value="' + esc(q) + '" placeholder="search brands, hosts, categories"><button>Search</button></form>' +
        '<p class="crumbs"><a href="/">all</a> · <a href="/about">about</a> · <a href="/mirrors">mirrors</a> · <a href="/pgp.txt">pgp key</a> · <a href="/seized">seized</a></p>' +
        (q ? '<h2>Results for “' + esc(q) + '” (' + hits.length + ')</h2>' : '') +
        Object.keys(groups).sort().map(kind => '<h2>' + esc(kind) + 's</h2><table><tr><th></th><th>Service</th><th>Type</th><th>Sales</th><th>Key fingerprint</th><th>Uptime</th></tr>' +
          groups[kind].map(row).join('') + '</table>').join('') +
        '<h2>Recently seized</h2><table><tr><th>Service</th><th>Status</th><th>Notice</th></tr>' +
        '<tr><td>silkmirror.onion</td><td class="bad">seized</td><td>banner replaced by a law-enforcement notice</td></tr>' +
        '<tr><td>oldbazaar.onion</td><td class="bad">offline</td><td>no answer for 31 days — removed from the index</td></tr>' +
        '<tr><td>clone-of-nightfall.onion</td><td class="bad">phantom</td><td>clone; the signature does not match the operator key</td></tr></table>' +
        '<footer>Index built by hand. Listings are claims, not endorsements. No JavaScript, no cookies, no logs.</footer></div>' + bridge() + '</body></html>'
    };
  }

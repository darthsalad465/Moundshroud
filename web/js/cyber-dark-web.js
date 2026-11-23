// Cyber > Cyber Desktop > Fake Dark Web. A second, separate section of the simulated internet: Tor-style hidden
// services on .onion addresses, each written by hand with its own layout and its own little backend (listings, carts,
// orders, threads, submissions, negotiation chats, status probes). Everything here is fiction inside a sealed page:
// every address, vendor, leak and message is invented, nothing is fetched, no socket is opened, and no real hidden
// service is ever contacted. The sites join the fake internet catalogue, so the Browser, its address bar, Moundshroud
// Search and every moundshell command (curl, wget, browser, paths, breach web, ...) answer for them exactly as they
// answer for the surface web. Only the services that really are markets sell anything.
(() => {
  /* A is the app's own object, a top-level binding in core.js (not a window property): this module only adds to it */
  const esc = s => String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const cap = s => String(s).charAt(0).toUpperCase() + String(s).slice(1);
  const int = (lo, hi) => lo + ((Math.random() * (hi - lo + 1)) | 0);
  const pick = list => list[(Math.random() * list.length) | 0];
  const money = n => '$' + Number(n).toFixed(2);
  const xmr = n => Number(n).toFixed(2) + ' XMR';
  const day = at => new Date(at).toLocaleDateString([], { month: 'short', day: 'numeric' });
  const stamp = at => new Date(at).toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
  const bridge = () => (A.cyberWeb && A.cyberWeb.bridgeScript) || '';

  /* a stable pseudo key/fingerprint per service, so the same onion always shows the same signed identity */
  const hashOf = s => { let h = 2166136261 >>> 0; for (const c of String(s)) { h ^= c.charCodeAt(0); h = Math.imul(h, 16777619) >>> 0; } return h >>> 0; };
  const keyBody = seed => {
    const abc = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
    let h = hashOf(seed), out = '';
    for (let i = 0; i < 48; i++) { h = (Math.imul(h, 1103515245) + 12345) >>> 0; out += abc[h % 32]; if (i % 8 === 7) out += '\n'; }
    return out.trim();
  };
  const fingerprint = seed => {
    let h = hashOf(seed);
    return Array.from({ length: 10 }, () => { h = (Math.imul(h, 48271) % 2147483647) >>> 0; return (h % 0xffff).toString(16).toUpperCase().padStart(4, '0'); }).join(' ');
  };
  const pgpPage = (site, who) => ({
    status: 200, type: 'text/plain',
    body: '-----BEGIN PGP PUBLIC KEY BLOCK-----\nComment: ' + who + ' (' + site.host + ') — simulated key, nothing behind it\n\nmQINBG' +
      keyBody(site.host) + '\n=7Qx' + (hashOf(site.host) % 9) + '\n-----END PGP PUBLIC KEY BLOCK-----\n'
  });

  function page(site, title, css, body) {
    return '<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">' +
      '<title>' + esc(title) + ' · ' + esc(site.brand) + '</title><style>' +
      'html,body{margin:0;background:' + site.bg + ';color:' + site.ink + ';}' +
      'a{color:' + site.link + ';text-decoration:none;}a:hover{text-decoration:underline;}' +
      'table{border-collapse:collapse;width:100%;}' +
      'input,textarea{background:' + site.field + ';border:1px solid ' + site.line + ';color:inherit;padding:6px 8px;font:inherit;width:100%;box-sizing:border-box;}' +
      'button{background:' + site.btn + ';border:1px solid ' + site.line + ';color:' + site.btnInk + ';padding:7px 13px;font:inherit;cursor:pointer;}' +
      'button:hover{filter:brightness(1.2);}label{display:block;margin:9px 0 4px;font-size:12px;color:' + site.mute + ';}' +
      css + '</style></head><body>' + body + bridge() + '</body></html>';
  }

  /* ------------------------------------------------------------------ the services ------------------------------------------------------- */

  /* 1 — the directory that is the section's front door */
  const directory = (() => {
    const site = {
      kind: 'Directory', brand: 'The Onion Index', host: 'darknet-index.onion', icon: '🧅',
      topic: 'Tor hidden services', region: 'Onion space', market: false, noSales: true,
      tagline: 'A plain-text index of hidden services. No scripts, no accounts, no logs.',
      v3: 'onionidx7q2v4n6m8k1s3d5f7g9h2j4l6p8r0t2w4y6z8b1c3e5g7.onion',
      bg: '#04070a', ink: '#c6f7d6', link: '#45ff96', line: '#123b26', field: '#0a1014', btn: '#123b26', btnInk: '#c6f7d6', mute: '#5d8a70'
    };
    const css = 'body{font:13px/1.6 "Lucida Console",Consolas,monospace;}' +
      '.top{display:flex;justify-content:space-between;align-items:baseline;padding:14px 22px;border-bottom:1px solid #123b26;background:#050c09;}' +
      '.top b{letter-spacing:.3em;font-weight:700;color:#45ff96;font-size:14px;}.top span{color:#4d7a5f;font-size:11px;}' +
      '.wrap{max-width:1000px;margin:0 auto;padding:18px 22px 44px;}' +
      '.note{border:1px solid #3d2f0c;background:#100c02;color:#ffc766;padding:10px 12px;margin:14px 0;font-size:12px;}' +
      'h1{font-size:18px;letter-spacing:.08em;margin:18px 0 6px;color:#8dffbb;}h2{font-size:12px;letter-spacing:.16em;text-transform:uppercase;color:#45ff96;margin:26px 0 8px;border-bottom:1px solid #123b26;padding-bottom:6px;}' +
      'p{color:#8fb9a1;}th{text-align:left;color:#4d7a5f;font-weight:400;padding:6px 8px;border-bottom:1px solid #173a28;font-size:11px;letter-spacing:.06em;}' +
      'td{padding:7px 8px;border-bottom:1px solid #0d1f16;vertical-align:top;font-size:12px;}' +
      '.on{color:#45ff96;}.dead{color:#ff6b6b;}.host{color:#4d7a5f;font-size:11px;}.fp{color:#3a6b50;font-size:10.5px;letter-spacing:.04em;}' +
      '.search{display:flex;gap:8px;margin:16px 0 6px;}.search input{flex:1;}.search button{padding:8px 16px;}' +
      '.nav{color:#3f6b52;font-size:12px;margin:6px 0 0;}.nav a{color:#6fbf8e;}' +
      '.hint{color:#3f6b52;font-size:11.5px;margin:0 0 4px;}' +
      '.count{color:#3f6b52;font-size:11px;letter-spacing:0;text-transform:none;font-weight:400;margin-left:6px;}' +
      '.tagline{color:#3a6b50;font-size:11px;margin-top:2px;}' +
      '.badge{display:inline-block;font-size:9.5px;letter-spacing:.08em;text-transform:uppercase;padding:1px 5px;border:1px solid #1d5238;color:#6fbf8e;border-radius:3px;vertical-align:1px;}' +
      '.badge.gov{border-color:#4b6ea8;color:#8fb6ff;}' +
      '.empty{border:1px dashed #24402f;padding:14px 16px;margin:14px 0;color:#8fb9a1;font-size:12.5px;}' +
      '.more{display:inline-block;border:1px solid #1d5238;background:#08120c;padding:8px 14px;margin:10px 0 4px;color:#8dffbb;}' +
      '.more:hover{border-color:#45ff96;}' +
      'tbody tr:hover{background:#07110b;}' +
      'footer{margin-top:34px;border-top:1px solid #123b26;padding-top:12px;color:#3f6b52;font-size:11px;}';
    const MORE_BUTTON = '<a class="more" href="/more">Find more services →</a>';
    const rowsFor = list => '<table><tr><th></th><th>Service</th><th>Type</th><th>Sales</th><th>Signed key</th><th>Uptime</th></tr>' +
      list.map(s => '<tr><td class="on">●</td><td><a href="https://' + esc(s.host) + '/">' + esc(s.brand) + '</a>' +
        (s.gov ? ' <span class="badge gov">government</span>' : s.generated ? ' <span class="badge">new</span>' : '') +
        '<div class="host">' + esc(s.host) + '</div>' + (s.tagline ? '<div class="tagline">' + esc(String(s.tagline).slice(0, 110)) + '</div>' : '') + '</td>' +
        '<td>' + esc(s.kind) + '</td><td>' + (s.market ? 'market' : 'no sales') + '</td>' +
        '<td class="fp">' + esc(fingerprint(s.host).slice(0, 26)) + '…</td><td class="on">' + (86 + (hashOf(s.host) % 14)) + '%</td></tr>').join('') + '</table>';
    const shell = inner => page(site, 'Index', css, '<div class="top"><b>THE ONION INDEX</b><span>' + esc(site.host) + ' · mirror 3 of 4 · signed ' + day(Date.now()) + '</span></div>' +
      '<div class="wrap">' + inner + '<footer>Listings are claims, not endorsements. A green probe only means an address answered. ' +
      'This directory is simulated inside the Cyber Desktop; no hidden service was contacted.</footer></div>');
    const note = '<div class="note">Simulated hidden-service index. Every address, vendor and leak below is invented. Nothing here is reachable and nothing leaves this page.</div>';
    site.render = (path, query) => {
      if (path === '/pgp.txt') return pgpPage(site, 'The Onion Index signing key');
      if (path === '/about') return { status: 200, type: 'text/html', body: shell('<h1>About</h1><p>We list hidden services that answered at least once in the last thirty days. Where an operator publishes a PGP key, the mirror list is checked against it before the entry is kept.</p><p>A probe is a network fact. It says nothing about who runs the service, and clones answer too.</p>') };
      if (path === '/mirrors') return { status: 200, type: 'text/html', body: shell('<h1>Mirrors of this index</h1><table><tr><th>Mirror</th><th>Probe</th><th>Signed</th></tr>' +
        '<tr><td>darknet-index.onion</td><td class="on">up · 41 ms</td><td>yes</td></tr><tr><td>onionidx2m4q…onion</td><td class="on">up · 88 ms</td><td>yes</td></tr>' +
        '<tr><td>onionidx3k9x…onion</td><td>slow · 310 ms</td><td>yes</td></tr><tr><td>onionidx4d1p…onion</td><td class="dead">no answer</td><td>—</td></tr></table>') };
      if (path === '/seized') return { status: 200, type: 'text/html', body: shell('<h1>Seized and offline</h1><p>Addresses that stopped answering stay here for a month so nobody mistakes a clone for the original.</p>' +
        '<table><tr><th>Service</th><th>Status</th><th>Notice</th></tr><tr><td>silkmirror.onion</td><td class="dead">seized</td><td>banner replaced by a law-enforcement notice</td></tr>' +
        '<tr><td>oldbazaar.onion</td><td class="dead">offline</td><td>no answer for 31 days — removed</td></tr><tr><td>clone-of-nightfall.onion</td><td class="dead">phantom</td><td>signature does not match the operator key</td></tr></table>') };
      /* /more mints a fresh page of services: the index never runs out, and every address it prints is a page that
         already exists the moment you open it */
      if (path === '/more') {
        const added = more(12);
        return { status: 200, type: 'text/html', body: shell(note + '<h1>Another page of services</h1><p class="nav">' + added.length + ' more hidden services were listed just now. The index does not keep a full list — it finds what answers today.</p>' +
          rowsFor(added) + '<p class="nav">' + MORE_BUTTON + '</p>') };
      }
      const q = String(query.get('q') || '').trim();
      const all = sites().filter(s => s !== site);
      const list = rank(all, q);
      const groups = {};
      for (const s of list) (groups[s.kind] = groups[s.kind] || []).push(s);
      const kinds = Object.keys(groups).sort();
      const catBar = kinds.length > 1 ? '<p class="nav">' + kinds.map(k => '<a href="/?q=' + encodeURIComponent(k) + '">' + esc(k) + '</a>').join(' · ') + '</p>' : '';
      return {
        status: 200, type: 'text/html',
        body: shell(note + '<p>The hidden-service index. Plain HTML, no scripts, no accounts. An uptime figure only means an address answered.</p>' +
          '<form class="search" action="/" method="get"><input name="q" value="' + esc(q) + '" placeholder="search brands, hosts, categories, government and police portals"><button>Search</button></form>' +
          '<p class="hint">' + (q ? 'Ranked by name match, then category, then how recently the operator signed the mirror list.' : 'Type a word, or browse by category. Nothing here is sorted by what anyone paid us.') + '</p>' +
          '<p class="nav"><a href="/">all services</a> · <a href="/about">about</a> · <a href="/mirrors">mirrors</a> · <a href="/pgp.txt">pgp key</a> · <a href="/seized">seized</a> · <a href="/more">another page</a></p>' +
          (q ? '<h2>Results for “' + esc(q) + '” <span class="count">' + list.length + ' of ' + all.length + '</span></h2>' : '<h2>Everything that answered today <span class="count">' + all.length + ' services</span></h2>') +
          (list.length ? catBar + kinds.map(k => '<h2>' + esc(k) + '</h2>' + rowsFor(groups[k])).join('')
            : '<div class="empty">Nothing matched “' + esc(q) + '”. The index only lists services that answered in the last thirty days: try a category, a shorter word, or <a href="/more">the next page</a>.</div>') +
          '<p class="nav">' + MORE_BUTTON + '</p>' +
          '<h2>Recently seized</h2><table><tr><th>Service</th><th>Status</th><th>Notice</th></tr>' +
          '<tr><td>silkmirror.onion</td><td class="dead">seized</td><td>banner replaced by a law-enforcement notice</td></tr>' +
          '<tr><td>oldbazaar.onion</td><td class="dead">offline</td><td>no answer for 31 days — removed</td></tr></table>')
      };
    };
    return site;
  })();

  /* 2 — a marketplace: the one kind of dark site where selling is the point */
  const market = (() => {
    const site = {
      kind: 'Marketplace', brand: 'Nightfall Market', host: 'nightfall-market.onion', icon: '🕯',
      topic: 'vendor marketplace', region: 'Onion space', market: true,
      tagline: 'Escrow-only marketplace. Signed mirrors, vendor bonds, no finalise-early.',
      bg: '#0d0f14', ink: '#e6e1d6', link: '#ffb454', line: '#2a2b33', field: '#14161d', btn: '#3a2a12', btnInk: '#ffd9a0', mute: '#8b8778'
    };
    const vendors = {
      fernworks: { bond: '12.4 XMR', joined: '2023', sales: 4821, rating: 4.8, pgp: 'FERN…9C2A', disputes: '0.4%' },
      quietgrove: { bond: '4.1 XMR', joined: '2022', sales: 9104, rating: 4.9, pgp: 'GROV…71BD', disputes: '0.2%' },
      medlinex: { bond: '8.8 XMR', joined: '2024', sales: 1206, rating: 4.4, pgp: 'MEDL…33F0', disputes: '1.1%' },
      ghostline: { bond: '6.0 XMR', joined: '2023', sales: 3320, rating: 4.7, pgp: 'GHST…A54E', disputes: '0.6%' },
      paperdrift: { bond: '2.2 XMR', joined: '2021', sales: 640, rating: 4.9, pgp: 'PAPR…0C19', disputes: '0.1%' },
      coldcell: { bond: '9.5 XMR', joined: '2022', sales: 2788, rating: 4.8, pgp: 'COLD…5B77', disputes: '0.3%' },
      mirrorcraft: { bond: '1.7 XMR', joined: '2025', sales: 44, rating: 4.1, pgp: 'MIRR…D812', disputes: '2.4%' }
    };
    const items = [
      { id: 1, name: 'Silver Fern — 5 g sample', cat: 'Botanicals', vendor: 'fernworks', price: 62, coin: 0.42, stock: 18, rating: 4.8, ships: 'EU · 3–6 days', desc: 'Vacuum-sealed sample with a silica pack. Escrow only, no finalise-early, refund on a missing delivery after 21 days.' },
      { id: 2, name: 'Amber Vial — 10 ml', cat: 'Botanicals', vendor: 'fernworks', price: 118, coin: 0.79, stock: 7, rating: 4.6, ships: 'EU · 3–6 days', desc: 'Amber glass, batch-labelled. Ships from a drop box; tracking only to the country.' },
      { id: 3, name: 'Loose-leaf blend #4', cat: 'Botanicals', vendor: 'quietgrove', price: 34, coin: 0.23, stock: 41, rating: 4.9, ships: 'Worldwide · 7–14 days', desc: 'Aromatic blend, plain envelope, decoy invoice included, no signature required.' },
      { id: 4, name: 'Pressed tablets (strip of 10)', cat: 'Pharma', vendor: 'medlinex', price: 89, coin: 0.6, stock: 25, rating: 4.4, ships: 'EU · 4–8 days', desc: 'Blister strip, batch and expiry printed. No prescription, as advertised; read the vendor notice first.' },
      { id: 5, name: 'Sealed vial kit', cat: 'Pharma', vendor: 'medlinex', price: 156, coin: 1.05, stock: 4, rating: 4.2, ships: 'EU · 4–8 days', desc: 'Kit with sterile water and printed instructions. Double-boxed, no markings.' },
      { id: 6, name: 'Anonymous SIM (EU roaming)', cat: 'Services', vendor: 'ghostline', price: 45, coin: 0.3, stock: 60, rating: 4.7, ships: 'Digital · instant', desc: 'Activated SIM details delivered as an encrypted note. Roaming in 31 countries.' },
      { id: 7, name: 'Clean mailbox, 90 days', cat: 'Services', vendor: 'ghostline', price: 28, coin: 0.19, stock: 120, rating: 4.5, ships: 'Digital · instant', desc: 'Registration-free mailbox with PGP-only recovery. No logs kept, by policy.' },
      { id: 8, name: 'Vintage postcard lot', cat: 'Collectibles', vendor: 'paperdrift', price: 74, coin: 0.5, stock: 9, rating: 4.9, ships: 'Worldwide · 10 days', desc: 'Forty unstamped cards from the 1930s. Plain outer envelope, no markings.' },
      { id: 9, name: 'Brass key blank set', cat: 'Collectibles', vendor: 'paperdrift', price: 22, coin: 0.15, stock: 33, rating: 4.3, ships: 'Worldwide · 10 days', desc: 'Six unmarked blanks, listed as a locksmith practice set.' },
      { id: 10, name: 'Encrypted USB, 32 GB', cat: 'Hardware', vendor: 'coldcell', price: 66, coin: 0.45, stock: 14, rating: 4.8, ships: 'EU · 5 days', desc: 'Hardware-encrypted stick, wiped and re-flashed, shipped with a random passphrase card.' },
      { id: 11, name: 'Faraday pouch (2 pack)', cat: 'Hardware', vendor: 'coldcell', price: 39, coin: 0.26, stock: 52, rating: 4.6, ships: 'EU · 5 days', desc: 'Signal-blocking pouches, tested per unit, plain retail packaging.' },
      { id: 12, name: 'Vanity .onion address', cat: 'Services', vendor: 'mirrorcraft', price: 240, coin: 1.62, stock: 3, rating: 4.1, ships: 'Digital · 2 days', desc: 'Fifteen-character vanity prefix, key handed over signed. Hosting not included.' }
    ];
    const carts = {}, orders = [];
    const css = 'body{font:13px/1.65 "Segoe UI",system-ui,sans-serif;}' +
      '.top{background:#101218;border-bottom:1px solid #2a2b33;padding:12px 22px;display:flex;align-items:center;gap:16px;flex-wrap:wrap;}' +
      '.brand{font:800 18px/1 "Segoe UI",sans-serif;letter-spacing:.02em;color:#ffb454;}.top .mirror{color:#6f6b5f;font-size:11px;margin-left:auto;}' +
      '.wrap{max-width:1080px;margin:0 auto;padding:18px 22px 44px;}' +
      '.bar{display:flex;gap:22px;flex-wrap:wrap;background:#111319;border:1px solid #26272f;padding:10px 14px;margin:14px 0;font-size:12px;color:#a8a293;}' +
      '.bar b{color:#ffb454;}.nav a{margin-right:14px;font-size:12.5px;}' +
      'h1{font:700 21px/1.2 "Segoe UI",sans-serif;margin:16px 0 6px;}h2{font:700 13px/1.3 "Segoe UI",sans-serif;letter-spacing:.1em;text-transform:uppercase;color:#ffb454;margin:24px 0 8px;}' +
      'p{color:#b8b2a4;}th{text-align:left;font-size:11px;letter-spacing:.08em;text-transform:uppercase;color:#7d786c;padding:7px 9px;border-bottom:1px solid #2a2b33;}' +
      'td{padding:9px;border-bottom:1px solid #1d1f26;font-size:12.5px;vertical-align:top;}' +
      '.price{color:#ffd9a0;font-weight:700;}.coin{color:#8f8a7c;font-size:11px;}.muted{color:#7d786c;font-size:11.5px;}' +
      '.vendor{color:#9fd8ff;}.grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(250px,1fr));gap:12px;}' +
      '.card{border:1px solid #26272f;background:#111319;padding:13px;}.card b{display:block;margin:4px 0;}.tag{display:inline-block;border:1px solid #3a3222;color:#ffc981;background:#1a1509;font-size:10px;padding:1px 6px;border-radius:2px;}' +
      '.note{border:1px solid #3a2b12;background:#171105;color:#ffc061;padding:10px 12px;font-size:12px;margin:12px 0;}';
    const shell = (title, inner) => page(site, title, css,
      '<div class="top"><span class="brand">NIGHTFALL</span><span class="muted">escrow only · signed mirrors</span><span class="mirror">' + esc(site.host) + ' · mirror 2/5</span></div>' +
      '<div class="wrap"><p class="nav"><a href="/">home</a><a href="/catalog">catalog</a><a href="/vendors">vendors</a><a href="/rules">rules</a><a href="/cart">cart</a><a href="/login">account</a><a href="/pgp.txt">pgp</a></p>' + inner + '</div>');
    const stats = '<div class="bar"><span>Vendors <b>1,284</b></span><span>Listings <b>18,902</b></span><span>Escrow held <b>412.8 XMR</b></span>' +
      '<span>Disputes <b>0.7%</b></span><span>Uptime <b>99.1%</b> · ' + esc(site.host) + '</span></div>';
    const itemRow = it => '<tr><td><a href="/listing/' + it.id + '">' + esc(it.name) + '</a><div class="muted">' + esc(it.cat) + ' · ' + esc(it.ships) + '</div></td>' +
      '<td class="vendor">' + esc(it.vendor) + '</td><td class="price">' + money(it.price) + '<div class="coin">' + xmr(it.coin) + '</div></td>' +
      '<td>' + it.rating.toFixed(1) + '/5<div class="muted">' + it.stock + ' in stock</div></td><td><a href="/cart?add=' + it.id + '">add</a></td></tr>';
    site.render = (path, query) => {
      if (path === '/pgp.txt') return pgpPage(site, 'Nightfall Market mirrors');
      if (path === '/rules') return { status: 200, type: 'text/html', body: shell('Rules', '<h1>Market rules</h1>' +
        '<p>Escrow on every order. Finalising early removes the protection the market exists to give, and the vendor bond does not cover it.</p>' +
        '<ul><li>Vendors post a bond before their first listing; the bond is forfeited on a proven selective scam.</li><li>Disputes are opened from the order page within 21 days.</li><li>Mirror changes are announced signed with the market key. Anything unsigned is a clone.</li><li>No listings that touch a live third party, and no data from real people. This is a simulated market.</li></ul>' +
        '<h2>Market key</h2><p class="muted">' + esc(fingerprint('nightfall') ) + '</p><p><a href="/pgp.txt">download the signing key</a></p>') };
      if (path === '/vendors') return { status: 200, type: 'text/html', body: shell('Vendors', '<h1>Vendors</h1><table><tr><th>Vendor</th><th>Bond</th><th>Sales</th><th>Rating</th><th>Disputes</th><th>Key</th></tr>' +
        Object.keys(vendors).map(v => { const d = vendors[v]; return '<tr><td class="vendor">' + esc(v) + '</td><td>' + esc(d.bond) + '</td><td>' + d.sales.toLocaleString() + '</td><td>' + d.rating + '/5</td><td>' + esc(d.disputes) + '</td><td class="muted">' + esc(d.pgp) + '</td></tr>'; }).join('') + '</table>') };
      if (/^\/vendor\/[a-z]+$/.test(path)) {
        const name = path.slice(8), d = vendors[name];
        if (!d) return { status: 404, type: 'text/html', body: shell('No vendor', '<h1>Vendor not found</h1>') };
        return { status: 200, type: 'text/html', body: shell(cap(name), '<h1 class="vendor">' + esc(name) + '</h1><p class="muted">Trading since ' + esc(d.joined) + ' · bond ' + esc(d.bond) + ' · ' + d.sales.toLocaleString() + ' sales · rating ' + d.rating + '/5 · disputes ' + esc(d.disputes) + '</p>' +
          '<h2>Listings</h2><table><tr><th>Listing</th><th>Vendor</th><th>Price</th><th>Rating</th><th></th></tr>' + items.filter(i => i.vendor === name).map(itemRow).join('') + '</table>' +
          '<h2>Vendor key</h2><p class="muted">' + esc(fingerprint(name)) + '</p>') };
      }
      if (path === '/catalog') {
        const cat = String(query.get('cat') || '').trim();
        const list = cat ? items.filter(i => i.cat.toLowerCase() === cat.toLowerCase()) : items;
        return { status: 200, type: 'text/html', body: shell('Catalog', '<h1>Catalog</h1>' + stats +
          '<p class="nav">' + ['Botanicals', 'Pharma', 'Services', 'Collectibles', 'Hardware'].map(c => '<a href="/catalog?cat=' + encodeURIComponent(c) + '">' + c + '</a>').join(' · ') + ' · <a href="/catalog">all</a></p>' +
          '<table><tr><th>Listing</th><th>Vendor</th><th>Price</th><th>Rating</th><th></th></tr>' + list.map(itemRow).join('') + '</table>') };
      }
      if (/^\/listing\/\d+$/.test(path)) {
        const it = items.find(x => x.id === Number(path.split('/').pop()));
        if (!it) return { status: 404, type: 'text/html', body: shell('Gone', '<h1>Listing removed</h1><p>The vendor delisted it.</p>') };
        const v = vendors[it.vendor] || {};
        return { status: 200, type: 'text/html', body: shell(it.name, '<p class="muted"><a href="/catalog">← catalog</a></p>' +
          '<h1>' + esc(it.name) + '</h1><p class="muted">' + esc(it.cat) + ' · sold by <a class="vendor" href="/vendor/' + esc(it.vendor) + '">' + esc(it.vendor) + '</a> · ' + esc(it.ships) + '</p>' +
          '<h2>' + money(it.price) + ' <span class="coin">/ ' + xmr(it.coin) + '</span></h2>' +
          '<p>' + esc(it.desc) + '</p><table><tr><th>Vendor bond</th><td>' + esc(v.bond || '—') + '</td></tr><tr><th>Vendor rating</th><td>' + it.rating.toFixed(1) + '/5 · ' + (v.sales || 0).toLocaleString() + ' sales</td></tr>' +
          '<tr><th>Escrow</th><td>held until delivery or 21 days</td></tr><tr><th>Stock</th><td>' + it.stock + '</td></tr></table>' +
          '<form action="/cart" method="get" style="margin-top:14px"><input type="hidden" name="add" value="' + it.id + '"><label>Quantity</label><input name="qty" value="1"><button>Add to cart</button></form>' +
          '<h2>Reviews (' + (12 + it.id * 3) + ')</h2>' + [0, 1, 2].map(i => '<p class="muted">“' + esc(pick(['Arrived in five days, exactly as described.', 'Second order, no issues. Packaging was plain.', 'Escrow released after arrival; vendor answered within the hour.'])) + '” — ' + esc(pick(['slowpost', 'greyuser', 'nullbyte'])) + ', ' + day(Date.now() - i * 86400000 * 4) + '</p>').join('') +
          '<div class="note">A real market holds the money. If a vendor asks you to finalise early or to pay outside escrow, the bond will not help you.</div>') };
      }
      if (path === '/cart') {
        const cart = carts[session] || (carts[session] = {});
        if (query.has('add')) { const it = items.find(x => x.id === Number(query.get('add'))); if (it) cart[it.id] = (cart[it.id] || 0) + Math.max(1, Number(query.get('qty')) || 1); }
        if (query.has('remove')) delete cart[Number(query.get('remove'))];
        const lines = Object.keys(cart).map(id => ({ it: items.find(x => x.id === Number(id)), qty: cart[id] })).filter(l => l.it);
        const total = lines.reduce((n, l) => n + l.it.price * l.qty, 0);
        return { status: 200, type: 'text/html', body: shell('Cart', '<h1>Cart</h1>' + (lines.length
          ? '<table><tr><th>Item</th><th>Qty</th><th>Price</th><th></th></tr>' + lines.map(l => '<tr><td>' + esc(l.it.name) + '</td><td>' + l.qty + '</td><td>' + money(l.it.price * l.qty) + '</td><td><a href="/cart?remove=' + l.it.id + '">remove</a></td></tr>').join('') + '</table>' +
            '<h2>Total ' + money(total) + '</h2><form action="/checkout" method="get"><label>Delivery country</label><input name="country" value="NL"><label>Escrow note (optional)</label><input name="note"><button>Place escrow order</button></form>'
          : '<p>Nothing in the cart. <a href="/catalog">Browse the catalog</a>.</p>')) };
      }
      if (path === '/checkout') {
        const cart = carts[session] || {};
        const lines = Object.keys(cart).map(id => ({ it: items.find(x => x.id === Number(id)), qty: cart[id] })).filter(l => l.it);
        if (!lines.length) return { status: 400, type: 'text/html', body: shell('Empty', '<h1>Nothing to order</h1><p><a href="/catalog">Catalog</a></p>') };
        const total = lines.reduce((n, l) => n + l.it.price * l.qty, 0);
        const id = 'NF-' + (1000 + orders.length + 1);
        orders.push({ id, at: Date.now(), total, country: query.get('country') || 'NL', lines: lines.map(l => l.it.name) });
        carts[session] = {};
        return { status: 200, type: 'text/html', body: shell('Order placed', '<h1>Escrow locked</h1><p>Order <b>' + esc(id) + '</b> for ' + money(total) + ' is held in escrow until delivery is confirmed or 21 days pass.</p>' +
          '<table><tr><th>Order</th><td>' + esc(id) + '</td></tr><tr><th>Ship to</th><td>' + esc(query.get('country') || 'NL') + '</td></tr><tr><th>Items</th><td>' + esc(lines.map(l => l.it.name + ' ×' + l.qty).join(', ')) + '</td></tr>' +
          '<tr><th>Escrow</th><td>' + xmr(total / 148) + ' equivalent</td></tr></table><p class="muted">Simulated order — no payment, no shipment, no vendor.</p><p><a href="/orders">your orders</a></p>') };
      }
      if (path === '/orders') return { status: 200, type: 'text/html', body: shell('Orders', '<h1>Your orders</h1>' + (orders.length ? '<table><tr><th>Order</th><th>Placed</th><th>Items</th><th>Total</th><th>State</th></tr>' + orders.map(o => '<tr><td>' + esc(o.id) + '</td><td>' + stamp(o.at) + '</td><td>' + esc(o.lines.join(', ')) + '</td><td>' + money(o.total) + '</td><td>escrow held</td></tr>').join('') + '</table>' : '<p>No orders yet.</p>')) };
      if (path === '/login') {
        const u = query.get('u') || '', p = query.get('p') || '';
        if (u || p) { session = 'u:' + u; return { status: 200, type: 'text/html', body: shell('Account', '<h1>Signed in as ' + esc(u || 'guest') + '</h1><p class="muted">Session is local to this page. Balance: 0.00 XMR (simulated).</p><p><a href="/orders">Your orders</a> · <a href="/cart">Cart</a></p>') }; }
        return { status: 200, type: 'text/html', body: shell('Sign in', '<h1>Sign in</h1><form action="/login" method="get"><label>Username</label><input name="u"><label>Password</label><input name="p" type="password"><button>Sign in</button></form><p class="muted">No registration here; the market only keeps a session handle for the cart.</p>') };
      }
      /* home */
      const featured = items.slice(0, 5);
      return { status: 200, type: 'text/html', body: shell('Home', '<h1>Nightfall Market</h1><p>Escrow-only trading, signed mirror lists and vendor bonds. Access is over Tor; this copy of the market is a simulation inside the Cyber Desktop.</p>' + stats +
        '<h2>Featured listings</h2><table><tr><th>Listing</th><th>Vendor</th><th>Price</th><th>Rating</th><th></th></tr>' + featured.map(itemRow).join('') + '</table>' +
        '<h2>Categories</h2><div class="grid">' + ['Botanicals', 'Pharma', 'Services', 'Collectibles', 'Hardware'].map(c => '<div class="card"><b><a href="/catalog?cat=' + encodeURIComponent(c) + '">' + c + '</a></b><span class="muted">' + items.filter(i => i.cat === c).length + ' listings</span></div>').join('') + '</div>' +
        '<div class="note">Verify the mirror before you sign in: the signed list is on <a href="/pgp.txt">/pgp.txt</a> with fingerprint <code>' + esc(fingerprint('nightfall').slice(0, 26)) + '…</code>. A clone can look identical.</div>') };
    };
    let session = 'anon';
    return site;
  })();

  /* 3 — a ransomware leak site: a countdown and a victim list, no shop */
  const leaks = (() => {
    const site = {
      kind: 'Leak site', brand: 'GHOST COLLECTIVE', host: 'ghostleaks.onion', icon: '💀',
      topic: 'data leak extortion', region: 'Onion space', market: false, noSales: true,
      tagline: 'Victims, deadlines and published archives. We do not run a shop.',
      bg: '#0a0507', ink: '#e8d5d7', link: '#ff5f6d', line: '#33161c', field: '#140a0d', btn: '#3a1016', btnInk: '#ffd6d9', mute: '#9c7176'
    };
    const victims = [
      { id: 1, name: 'Halden Freight', sector: 'Logistics', country: 'NL', size: '412 GB', files: '1.9M', deadline: 6, status: 'countdown', note: 'Dispatch, customs paperwork and driver records. The payroll folder was kept out of the release.' },
      { id: 2, name: 'Mereside Health Trust', sector: 'Healthcare', country: 'UK', size: '86 GB', files: '311K', deadline: 0, status: 'published', note: 'Appointment exports and internal memos. The public sample is partially redacted.' },
      { id: 3, name: 'Orinoco Legal Partners', sector: 'Legal', country: 'ES', size: '204 GB', files: '902K', deadline: 2, status: 'negotiating', note: 'Case files and correspondence. Two of five backups were encrypted before we were removed.' },
      { id: 4, name: 'Tapline Utilities', sector: 'Energy', country: 'DE', size: '1.1 TB', files: '4.4M', deadline: 11, status: 'countdown', note: 'SCADA diagrams, maintenance schedules and contractor lists.' },
      { id: 5, name: 'Brightwell Academy', sector: 'Education', country: 'US', size: '37 GB', files: '140K', deadline: 0, status: 'released', note: 'Enrolment data and policy drafts, released after the deadline passed without contact.' },
      { id: 6, name: 'Cobalt Ridge Mining', sector: 'Mining', country: 'AU', size: '660 GB', files: '2.2M', deadline: 4, status: 'countdown', note: 'Survey data, drill logs and supplier contracts.' }
    ];
    const css = 'body{font:13px/1.6 "Courier New",monospace;background-image:radial-gradient(circle at 20% 0%,#1a0709 0%,#0a0507 55%);}' +
      '.top{border-bottom:1px solid #33161c;padding:16px 22px;display:flex;justify-content:space-between;align-items:baseline;}' +
      '.top b{font:700 20px/1 "Courier New",monospace;letter-spacing:.34em;color:#ff5f6d;}.top span{color:#7c4c53;font-size:11px;}' +
      '.wrap{max-width:1000px;margin:0 auto;padding:22px;}' +
      'h1{font-size:19px;letter-spacing:.1em;margin:10px 0 6px;color:#ff8a94;}h2{font-size:12px;letter-spacing:.2em;text-transform:uppercase;color:#ff5f6d;margin:26px 0 10px;}' +
      'p{color:#b5929a;}th{text-align:left;color:#7c4c53;font-weight:400;font-size:11px;padding:7px 9px;border-bottom:1px solid #33161c;letter-spacing:.08em;}' +
      'td{padding:10px 9px;border-bottom:1px solid #240f14;vertical-align:top;font-size:12.5px;}' +
      '.victim{border:1px solid #33161c;background:#0f0709;padding:12px 14px;margin-bottom:10px;}' +
      '.victim b{color:#ffd6d9;font-size:14px;letter-spacing:.02em;}.meta{color:#7c4c53;font-size:11px;}' +
      '.timer{font:700 22px/1 "Courier New",monospace;color:#ff5f6d;letter-spacing:.06em;}.timer.zero{color:#8b6a6f;}' +
      '.badge{display:inline-block;border:1px solid #4a1c24;background:#1a0a0e;color:#ff8a94;font-size:10px;padding:2px 7px;letter-spacing:.12em;text-transform:uppercase;}' +
      '.note{border-left:3px solid #ff5f6d;background:#12080a;padding:10px 14px;color:#d6b8bd;margin:16px 0;}' +
      'pre{background:#0b0507;border:1px solid #2a1218;padding:12px;color:#a9858c;font-size:11.5px;overflow:auto;}';
    const shell = (title, inner) => page(site, title, css,
      '<div class="top"><b>GHOST</b><span>' + esc(site.host) + ' · press releases signed · no support desk</span></div><div class="wrap">' + inner + '</div>');
    const timerText = v => v.status === 'countdown' ? (v.deadline + 'd ' + ((v.id * 3) % 24) + 'h') : '00:00:00';
    const list = () => victims.map(v => '<div class="victim"><div style="display:flex;justify-content:space-between;gap:14px;align-items:baseline;flex-wrap:wrap">' +
      '<b><a href="/victim/' + v.id + '">' + esc(v.name) + '</a></b><span class="timer' + (v.status === 'countdown' ? '' : ' zero') + '">' + timerText(v) + '</span></div>' +
      '<div class="meta">' + esc(v.sector) + ' · ' + esc(v.country) + ' · ' + esc(v.size) + ' · ' + esc(v.files) + ' files · <span class="badge">' + esc(v.status) + '</span></div></div>').join('');
    site.render = (path, query) => {
      /* the archive: every batch and every individual file inside it has its own address */
      if (A.cyberLeaks) {
        const hit = A.cyberLeaks.route(path, query);
        if (hit) {
          if (hit.kind === 'page') return { status: 200, type: 'text/html', body: shell(hit.title, hit.html) };
          return { status: hit.status, type: hit.type, body: hit.body };
        }
      }
      if (/^\/victim\/\d+$/.test(path)) {
        const v = victims.find(x => x.id === Number(path.split('/').pop()));
        if (!v) return { status: 404, type: 'text/html', body: shell('Not found', '<h1>No such entry</h1>') };
        return { status: 200, type: 'text/html', body: shell(v.name, '<p class="meta"><a href="/">← all victims</a></p><h1>' + esc(v.name) + '</h1>' +
          '<p class="meta">' + esc(v.sector) + ' · ' + esc(v.country) + ' · archive ' + esc(v.size) + ' · ' + esc(v.files) + ' files · <span class="badge">' + esc(v.status) + '</span></p>' +
          '<p>' + esc(v.note) + '</p><h2>Archive preview</h2><pre>finance/2025-q3.xlsx\nhr/payroll_redacted.csv\ndispatch/routes.db\ncustomers/export_part1.csv\ncontracts/supplier_msa.pdf\nbackup/README.txt\n\n' + esc('-- sample rows withheld in the public preview --') + '</pre>' +
          '<h2>What we took</h2><ul><li>File servers: ' + esc(v.size) + ' copied before encryption.</li><li>Two domain administrators, one without MFA on the VPN.</li><li>Mail archives for 41 accounts.</li></ul>' +
          '<div class="note">This is a simulated leak page. The company, the files and the deadline are invented; no data exists behind this text.</div>') };
      }
      if (path === '/faq') return { status: 200, type: 'text/html', body: shell('FAQ', '<h1>Questions we get</h1>' +
        '<p><b>Do you run a shop?</b> No. There is nothing to buy here; this page exists to publish what we took.</p>' +
        '<p><b>Will you delete the files if we ask?</b> The archive is published when the deadline passes. Deleting it afterwards does not un-copy it.</p>' +
        '<p><b>How should a company respond?</b> Restore from an offline backup, rotate every credential, publish an incident report, and treat the leak page as a claim to verify rather than a to-do list.</p>') };
      if (path === '/news') return { status: 200, type: 'text/html', body: shell('News', '<h1>Releases</h1><p>New victims are added to the list on <a href="/">the front page</a> ' + day(Date.now()) + '. Archives appear here when a deadline passes.</p>') };
      return { status: 200, type: 'text/html', body: shell('Victims', '<h1>Current victims</h1><p>Every entry has a deadline. When it passes the archive is published whether or not anyone contacted us.</p>' + list() +
        (A.cyberLeaks ? A.cyberLeaks.homeSection() : '') +
        '<div class="note">A leak site is a claim and a pressure tactic. The useful response is restore, rotate, notify — not paying and hoping.</div>') };
    };
    return site;
  })();

  /* 4 — a crew blog: write-ups and mirrors */
  const crew = (() => {
    const site = {
      kind: 'Crew blog', brand: 'null::sector', host: 'nullsector.onion', icon: '⌨',
      topic: 'security research notes', region: 'Onion space', market: false, noSales: true,
      tagline: 'Notes from a small research crew. Write-ups, mirrors, one key.',
      bg: '#030604', ink: '#b8f5c4', link: '#39ff88', line: '#0f2a17', field: '#050d07', btn: '#0e2a16', btnInk: '#b8f5c4', mute: '#4e7a5c'
    };
    const posts = [
      { id: 1, title: 'Reading a defeat log without guessing', at: Date.now() - 86400000 * 2, by: 'nullbyte', read: 9, body: 'A failure log is a sequence of attempts, not a story. Start from the last line that changed state and work backwards: what did the code believe about the input, and what was actually true? Most "mystery" bugs are one wrong assumption repeated under pressure.' },
      { id: 2, title: 'Why the signed mirror list is the only thing worth checking', at: Date.now() - 86400000 * 7, by: 'ash', read: 6, body: 'Clones copy the layout, the vendor names and the colour scheme in an afternoon. What they cannot copy is the operator key. If the list you are on is not signed by the key you already trust, treat the whole page as an advertisement.' },
      { id: 3, title: 'A small threat model for a one-person service', at: Date.now() - 86400000 * 12, by: 'nullbyte', read: 11, body: 'Write down what you protect, who wants it, and what you accept losing. Three bullets is enough. The value is not the document; it is noticing which of your habits is not on the list.' },
      { id: 4, title: 'Counting what an incident actually cost', at: Date.now() - 86400000 * 19, by: 'ash', read: 8, body: 'Downtime is the easy number. The expensive ones are the quiet ones: staff time for weeks afterwards, the deals that went elsewhere, and the second incident caused by the rushed fix.' }
    ];
    const css = 'body{font:13px/1.65 "Consolas","Lucida Console",monospace;}' +
      '.top{border-bottom:1px solid #0f2a17;padding:14px 22px;background:#040a06;display:flex;justify-content:space-between;align-items:baseline;}' +
      '.top b{color:#39ff88;letter-spacing:.22em;}.top span{color:#3f6b4d;font-size:11px;}' +
      '.wrap{max-width:900px;margin:0 auto;padding:20px 22px 42px;}' +
      'pre.banner{color:#2f8a54;font-size:10.5px;line-height:1.15;margin:16px 0 6px;}' +
      'h1{font-size:18px;letter-spacing:.06em;color:#7dffae;margin:14px 0 4px;}.meta{color:#3f6b4d;font-size:11.5px;}' +
      'h2{font-size:12px;letter-spacing:.16em;text-transform:uppercase;color:#39ff88;margin:26px 0 8px;border-bottom:1px solid #0f2a17;padding-bottom:6px;}' +
      'p{color:#8fbf9d;}article{border:1px solid #12301c;background:#050d08;padding:14px 16px;margin-bottom:10px;}' +
      'article b{color:#b8f5c4;font-size:14px;}a{color:#39ff88;}table{font-size:12px;}th{text-align:left;color:#3f6b4d;font-weight:400;padding:6px 8px;}td{padding:6px 8px;border-bottom:1px solid #0d2114;}' +
      'pre{background:#040a06;border:1px solid #12301c;padding:12px;color:#7fbf92;font-size:11.5px;}';
    const shell = (title, inner) => page(site, title, css,
      '<div class="top"><b>null::sector</b><span>' + esc(site.host) + ' · mirror 2 of 3 · pgp ' + esc(fingerprint('nullsector').slice(0, 19)) + '…</span></div><div class="wrap">' + inner + '</div>');
    site.render = (path, query) => {
      if (path === '/pgp.txt') return pgpPage(site, 'null::sector');
      if (path === '/mirrors') return { status: 200, type: 'text/html', body: shell('Mirrors', '<h1>Mirrors</h1><p class="meta">Signed ' + day(Date.now()) + ' with the crew key. Anything not on this list is not us.</p>' +
        '<table><tr><th>Address</th><th>Probe</th></tr><tr><td>nullsector.onion</td><td>up</td></tr><tr><td>nullsec2x…onion</td><td>up</td></tr><tr><td>nullsec3q…onion</td><td>slow</td></tr></table>') };
      if (path === '/contact') return { status: 200, type: 'text/html', body: shell('Contact', '<h1>Contact</h1><p>Encrypted mail only. Include the key you want the reply to, and expect a week.</p><pre>' + esc(fingerprint('nullsector')) + '</pre>') };
      if (/^\/writeup\/\d+$/.test(path)) {
        const p = posts.find(x => x.id === Number(path.split('/').pop()));
        if (!p) return { status: 404, type: 'text/html', body: shell('Missing', '<h1>No such write-up</h1>') };
        return { status: 200, type: 'text/html', body: shell(p.title, '<p class="meta"><a href="/">← index</a></p><h1>' + esc(p.title) + '</h1><p class="meta">' + esc(p.by) + ' · ' + day(p.at) + ' · ' + p.read + ' min</p><p>' + esc(p.body) + '</p>' +
          '<h2>Notes</h2><p class="meta">Everything described here was done on machines we own or on the simulated ranges in this playground. Nothing in this post is a recipe for someone else\u2019s system.</p>') };
      }
      return { status: 200, type: 'text/html', body: shell('Index', '<pre class="banner">' +
        '  _  _ _   _ _    ___ ___ ___ _____ ___  \n | \\| | | | | |  / __| __/ __|_   _/ _ \\ \n | .` | |_| | |__\\__ \\ _| (__  | || (_) |\n |_|\\_|\\___/|____|___/___\\___| |_| \\___/  ' + '</pre>' +
        '<h1>Notes from a small crew</h1><p>We publish what we learn about defensive engineering, mostly from cleaning up after incidents. No shop, no escrow, no vendor list.</p>' +
        '<h2>Write-ups</h2>' + posts.map(p => '<article><b><a href="/writeup/' + p.id + '">' + esc(p.title) + '</a></b><div class="meta">' + esc(p.by) + ' · ' + day(p.at) + ' · ' + p.read + ' min</div><p>' + esc(p.body.slice(0, 180)) + '…</p></article>').join('') +
        '<h2>Elsewhere</h2><p class="meta"><a href="/mirrors">mirrors</a> · <a href="/pgp.txt">pgp key</a> · <a href="/contact">contact</a></p>') };
    };
    return site;
  })();

  /* 5 — a carding shop: a market, so the selling is faithful to what it is */
  const carding = (() => {
    const site = {
      kind: 'Carding shop', brand: 'CardVault', host: 'cardvault.onion', icon: '💳',
      topic: 'card data resale', region: 'Onion space', market: true,
      tagline: 'Automatic shop for card data. Check the base and the country before you buy.',
      bg: '#0a0610', ink: '#e6dcf5', link: '#c084fc', line: '#2a1b3d', field: '#120a1c', btn: '#2d1a45', btnInk: '#f0e5ff', mute: '#8b7aa6'
    };
    const bins = [
      { id: 1, bin: '414720', brand: 'VISA', bank: 'Northbank', country: 'US', base: 'US', price: 24, balance: '1,200–4,800', type: 'Classic', stock: 180 },
      { id: 2, bin: '519123', brand: 'MASTERCARD', bank: 'Kestrel FS', country: 'UK', base: 'UK', price: 31, balance: '800–3,100', type: 'Debit', stock: 96 },
      { id: 3, bin: '402400', brand: 'VISA', bank: 'Caisse du Nord', country: 'FR', base: 'EU', price: 28, balance: '1,000–2,600', type: 'Credit', stock: 140 },
      { id: 4, bin: '378282', brand: 'AMEX', bank: 'Ridgeway', country: 'CA', base: 'CA', price: 46, balance: '3,000–12,000', type: 'Corporate', stock: 22 },
      { id: 5, bin: '601100', brand: 'DISCOVER', bank: 'Sunbelt', country: 'US', base: 'US', price: 19, balance: '400–1,500', type: 'Classic', stock: 310 },
      { id: 6, bin: '490117', brand: 'VISA', bank: 'Banco Alameda', country: 'ES', base: 'EU', price: 22, balance: '600–2,200', type: 'Debit', stock: 88 }
    ];
    const carts = {}, orders = [];
    const css = 'body{font:13px/1.6 "Trebuchet MS","Segoe UI",sans-serif;}' +
      '.top{background:linear-gradient(90deg,#170a24,#0a0610 60%);border-bottom:1px solid #2a1b3d;padding:14px 22px;display:flex;justify-content:space-between;align-items:center;}' +
      '.brand{font:800 19px/1 "Trebuchet MS",sans-serif;letter-spacing:.14em;background:linear-gradient(90deg,#e2b8ff,#9b6bff);-webkit-background-clip:text;background-clip:text;color:transparent;}' +
      '.wrap{max-width:1000px;margin:0 auto;padding:18px 22px 44px;}' +
      '.nav a{margin-right:14px;font-size:12.5px;}.nav{margin:12px 0 6px;}' +
      'h1{font-size:20px;margin:14px 0 6px;}h2{font-size:12px;letter-spacing:.14em;text-transform:uppercase;color:#c084fc;margin:24px 0 8px;}' +
      'p{color:#b6a6cc;}th{text-align:left;font-size:11px;color:#7d6a99;padding:7px 9px;border-bottom:1px solid #2a1b3d;text-transform:uppercase;letter-spacing:.08em;}' +
      'td{padding:8px 9px;border-bottom:1px solid #1e1430;font-size:12.5px;}' +
      '.price{color:#e2b8ff;font-weight:700;}.tag{font-size:10px;border:1px solid #3a2755;background:#180e26;color:#c9a6ff;padding:1px 6px;}' +
      '.note{border:1px solid #3a2755;background:#150d22;color:#cbb6e8;padding:10px 12px;font-size:12px;margin:12px 0;}';
    const shell = (title, inner) => page(site, title, css,
      '<div class="top"><span class="brand">CARDVAULT</span><span class="muted" style="color:#7d6a99;font-size:11px">auto-shop · escrow · ' + esc(site.host) + '</span></div>' +
      '<div class="wrap"><p class="nav"><a href="/">shop</a><a href="/rules">rules</a><a href="/cart">cart</a><a href="/orders">orders</a><a href="/login">login</a><a href="/pgp.txt">pgp</a></p>' + inner + '</div>');
    const row = b => '<tr><td>' + esc(b.bin) + '<div class="muted" style="color:#7d6a99;font-size:11px">' + esc(b.brand) + '</div></td><td>' + esc(b.bank) + '</td><td>' + esc(b.country) + '</td>' +
      '<td><span class="tag">' + esc(b.base) + '</span></td><td>' + esc(b.type) + '</td><td class="price">' + money(b.price) + '</td><td>' + b.balance + '</td><td>' + b.stock + '</td><td><a href="/bin/' + b.id + '">select</a></td></tr>';
    site.render = (path, query) => {
      if (path === '/pgp.txt') return pgpPage(site, 'CardVault');
      if (path === '/rules') return { status: 200, type: 'text/html', body: shell('Rules', '<h1>Shop rules</h1><p>This is a simulated shop: the BINs, banks and balances are invented and no card data exists behind them.</p>' +
        '<ul><li>Automatic delivery after one confirmation.</li><li>Refund window: six hours, replacement only, with the checker screenshot.</li><li>No refunds on a wrong base — read the row before you buy.</li><li>Escrow available above ' + money(150) + '.</li></ul>') };
      if (/^\/bin\/\d+$/.test(path)) {
        const b = bins.find(x => x.id === Number(path.split('/').pop()));
        if (!b) return { status: 404, type: 'text/html', body: shell('Missing', '<h1>No such BIN</h1>') };
        return { status: 200, type: 'text/html', body: shell(b.bin, '<p style="color:#7d6a99;font-size:12px"><a href="/">← shop</a></p><h1>' + esc(b.bin) + ' · ' + esc(b.brand) + '</h1>' +
          '<table><tr><th>Bank</th><td>' + esc(b.bank) + '</td></tr><tr><th>Country</th><td>' + esc(b.country) + '</td></tr><tr><th>Base</th><td>' + esc(b.base) + '</td></tr>' +
          '<tr><th>Type</th><td>' + esc(b.type) + '</td></tr><tr><th>Balance</th><td>' + b.balance + '</td></tr><tr><th>Price</th><td class="price">' + money(b.price) + '</td></tr><tr><th>Stock</th><td>' + b.stock + '</td></tr></table>' +
          '<form action="/cart" method="get" style="margin-top:14px"><input type="hidden" name="add" value="' + b.id + '"><label>How many</label><input name="qty" value="1"><button>Add to cart</button></form>' +
          '<div class="note">Refunds are six hours and replacement only. A wrong base is not a refund.</div>') };
      }
      if (path === '/cart') {
        const cart = carts[session] || (carts[session] = {});
        if (query.has('add')) { const b = bins.find(x => x.id === Number(query.get('add'))); if (b) cart[b.id] = (cart[b.id] || 0) + Math.max(1, Number(query.get('qty')) || 1); }
        if (query.has('remove')) delete cart[Number(query.get('remove'))];
        const lines = Object.keys(cart).map(id => ({ b: bins.find(x => x.id === Number(id)), qty: cart[id] })).filter(l => l.b);
        const total = lines.reduce((n, l) => n + l.b.price * l.qty, 0);
        return { status: 200, type: 'text/html', body: shell('Cart', '<h1>Cart</h1>' + (lines.length ? '<table><tr><th>BIN</th><th>Qty</th><th>Price</th><th></th></tr>' +
          lines.map(l => '<tr><td>' + esc(l.b.bin) + ' · ' + esc(l.b.country) + '</td><td>' + l.qty + '</td><td>' + money(l.b.price * l.qty) + '</td><td><a href="/cart?remove=' + l.b.id + '">remove</a></td></tr>').join('') + '</table>' +
          '<h2>Total ' + money(total) + '</h2><form action="/checkout" method="get"><button>Pay from balance</button></form>' : '<p>Empty. <a href="/">Shop</a></p>')) };
      }
      if (path === '/checkout') {
        const cart = carts[session] || {};
        const lines = Object.keys(cart).map(id => ({ b: bins.find(x => x.id === Number(id)), qty: cart[id] })).filter(l => l.b);
        if (!lines.length) return { status: 400, type: 'text/html', body: shell('Empty', '<h1>Nothing to pay for</h1>') };
        const total = lines.reduce((n, l) => n + l.b.price * l.qty, 0);
        const id = 'CV-' + (7000 + orders.length + 1);
        orders.push({ id, at: Date.now(), total, lines: lines.map(l => l.b.bin) });
        carts[session] = {};
        return { status: 200, type: 'text/html', body: shell('Paid', '<h1>Order ' + esc(id) + '</h1><p>' + money(total) + ' taken from the simulated balance. ' +
          'The dump for ' + esc(lines.map(l => l.b.bin).join(', ')) + ' would appear here in a real shop.</p><p style="color:#7d6a99;font-size:12px">Simulated purchase: no data, no payment, no card.</p><p><a href="/orders">Orders</a></p>') };
      }
      if (path === '/orders') return { status: 200, type: 'text/html', body: shell('Orders', '<h1>Orders</h1>' + (orders.length ? '<table><tr><th>Order</th><th>At</th><th>BINs</th><th>Total</th></tr>' +
        orders.map(o => '<tr><td>' + esc(o.id) + '</td><td>' + stamp(o.at) + '</td><td>' + esc(o.lines.join(', ')) + '</td><td>' + money(o.total) + '</td></tr>').join('') + '</table>' : '<p>None yet.</p>')) };
      if (path === '/login') {
        const u = query.get('u') || '';
        if (u) { session = 'u:' + u; return { status: 200, type: 'text/html', body: shell('Account', '<h1>' + esc(u) + '</h1><p>Balance: ' + money(240) + ' (simulated).</p><p><a href="/">Shop</a> · <a href="/orders">Orders</a></p>') }; }
        return { status: 200, type: 'text/html', body: shell('Login', '<h1>Login</h1><form action="/login" method="get"><label>Handle</label><input name="u"><label>Password</label><input name="p" type="password"><button>Sign in</button></form>') };
      }
      return { status: 200, type: 'text/html', body: shell('Shop', '<h1>CardVault — automatic shop</h1><p>Filter by base before you buy; the country column is the issuing country, not the base.</p>' +
        '<table><tr><th>BIN</th><th>Bank</th><th>Country</th><th>Base</th><th>Type</th><th>Price</th><th>Balance</th><th>Stock</th><th></th></tr>' + bins.map(row).join('') + '</table>' +
        '<div class="note">Simulated shop: the BINs, banks and balances are invented, and nothing is delivered. Only this market sells anything; the rest of the dark web here does not.</div>') };
    };
    let session = 'anon';
    return site;
  })();

  /* 6 — a whistleblower drop: no shop, no accounts */
  const whistle = (() => {
    const site = {
      kind: 'Secure drop', brand: 'Blackwater Press — SecureDrop', host: 'securewhistle.onion', icon: '🗝',
      topic: 'source submission', region: 'Onion space', market: false, noSales: true,
      tagline: 'Submit documents to our journalists. No account, no email, no logs.',
      bg: '#0b0b0b', ink: '#eeeeee', link: '#ffffff', line: '#333333', field: '#141414', btn: '#ffffff', btnInk: '#0b0b0b', mute: '#9a9a9a'
    };
    const submissions = [];
    const css = 'body{font:15px/1.7 Georgia,"Times New Roman",serif;}' +
      '.top{border-bottom:2px solid #ffffff;padding:16px 22px;display:flex;justify-content:space-between;align-items:baseline;}' +
      '.top b{font:700 20px/1 Georgia,serif;letter-spacing:.02em;}.top span{font:11px/1 "Segoe UI",sans-serif;color:#9a9a9a;letter-spacing:.06em;}' +
      '.wrap{max-width:760px;margin:0 auto;padding:24px 22px 50px;}' +
      'h1{font:700 26px/1.25 Georgia,serif;margin:16px 0 8px;}h2{font:700 14px/1.3 "Segoe UI",sans-serif;letter-spacing:.14em;text-transform:uppercase;margin:28px 0 8px;}' +
      'p{color:#cfcfcf;}ul{color:#cfcfcf;}li{margin-bottom:6px;}' +
      '.danger{border:2px solid #ff3b30;background:#1a0000;color:#ffd6d2;padding:12px 14px;font:13px/1.6 "Segoe UI",sans-serif;margin:16px 0;}' +
      '.box{border:1px solid #333;background:#121212;padding:14px 16px;font:12.5px/1.7 "Consolas",monospace;color:#d8d8d8;overflow:auto;}' +
      'input,textarea{background:#141414;border:1px solid #333;color:#eee;font:14px/1.5 "Segoe UI",sans-serif;padding:8px 10px;width:100%;box-sizing:border-box;}' +
      'button{background:#fff;color:#0b0b0b;border:0;padding:9px 16px;font:600 13px "Segoe UI",sans-serif;cursor:pointer;}label{display:block;font:12px "Segoe UI",sans-serif;color:#9a9a9a;margin:12px 0 5px;}' +
      '.note{font:12px/1.6 "Segoe UI",sans-serif;color:#8a8a8a;border-top:1px solid #333;margin-top:28px;padding-top:12px;}';
    const shell = (title, inner) => page(site, title, css,
      '<div class="top"><b>Blackwater Press</b><span>SecureDrop · ' + esc(site.host) + '</span></div><div class="wrap">' + inner + '</div>');
    site.render = (path, query, method) => {
      if (path === '/pgp.txt') return pgpPage(site, 'Blackwater Press SecureDrop');
      if (path === '/security') return { status: 200, type: 'text/html', body: shell('Security', '<h1>How this works</h1><p>The drop is reachable only over Tor. Submissions are encrypted in the browser with our key, stored on an air-gapped machine, and read on a computer that never touches the network.</p>' +
        '<div class="box">' + esc(fingerprint('securewhistle')) + '</div><p>If you cannot use Tor, do not use this page. A submission made from an ordinary connection is not protected by anything this page claims.</p>') };
      if (path === '/faq') return { status: 200, type: 'text/html', body: shell('FAQ', '<h1>Questions</h1><p><b>Do I need an account?</b> No. There is nothing to buy and nothing to sign in to.</p><p><b>Can you see who I am?</b> The service keeps no access logs, but that promise only covers the service. Your network may still see that you connected to Tor.</p><p><b>How do I get a reply?</b> Choose a codename, keep it, and check the reply page after two weeks.</p>') };
      if (path === '/submit') {
        const name = String(query.get('codename') || '').trim();
        const note = String(query.get('message') || '').trim();
        if (name || note) {
          const code = 'BW-' + (10000 + submissions.length + 1) + '-' + String(hashOf(name + note) % 9000 + 1000);
          submissions.push({ code, at: Date.now(), codename: name.slice(0, 30) || 'anonymous', size: Math.max(1, Math.round(note.length / 1024)) });
          return { status: 200, type: 'text/html', body: shell('Received', '<h1>Submission received</h1><div class="box">Your codename: ' + esc(name.slice(0, 30) || 'anonymous') + '\nYour receipt: ' + esc(code) + '\nEncrypted size: ' + Math.max(1, Math.round(note.length / 1024)) + ' KB</div>' +
            '<p>Keep the receipt. Replies appear under <a href="/reply">/reply</a> for this codename only.</p><p class="note">Simulated drop: the document is not stored, not encrypted and not read. Nothing left this page.</p>') };
        }
        return { status: 200, type: 'text/html', body: shell('Submit', '<h1>Submit a document</h1><p>Write a short note and attach nothing here; in the real service files are encrypted in the browser first.</p>' +
          '<form action="/submit" method="post"><label>Codename (choose one and remember it)</label><input name="codename" placeholder="e.g. harbour-lamp">' +
          '<label>Note to the journalists</label><textarea name="message" rows="6" placeholder="What should we look at, and why does it matter?"></textarea><button>Send securely</button></form>') };
      }
      if (path === '/reply') return { status: 200, type: 'text/html', body: shell('Reply', '<h1>Replies</h1><p>Enter the codename you chose. Replies are only ever shown against it.</p><form action="/reply" method="get"><label>Codename</label><input name="codename"><button>Check</button></form>' +
        (query.get('codename') ? '<div class="box">No reply yet for ' + esc(query.get('codename')) + '. Check again in a few days.</div>' : '')) };
      return { status: 200, type: 'text/html', body: shell('Drop', '<h1>Send us documents</h1><p>A secure drop for sources with documents about wrongdoing in the simulated organisations in this playground.</p>' +
        '<div class="danger"><b>Before you start.</b> Use Tor Browser from the desktop version. Do not use a work computer, a work network, or an account that identifies you. If any of that is not possible, do not submit.</div>' +
        '<h2>What we protect</h2><ul><li>No access logs, no analytics, no third-party scripts.</li><li>Documents are encrypted with our key before they leave the browser.</li><li>Only two editors hold the decryption key, on machines that are never online.</li></ul>' +
        '<p><a href="/submit">Submit a document →</a></p><p class="note">This page is part of a simulation. There is no real newsroom, no key and no document behind it, and there is nothing for sale here.</p>') };
    };
    return site;
  })();

  /* 7 — a negotiation/support portal: corporate-looking, no shop */
  const negotiate = (() => {
    const site = {
      kind: 'Support portal', brand: 'Helix Recovery Portal', host: 'helix-support.onion', icon: '🧰',
      topic: 'incident recovery support', region: 'Onion space', market: false, noSales: true,
      tagline: 'Case portal for recovery and decryption checks. Enter your case reference.',
      bg: '#eef1f6', ink: '#1d2431', link: '#1f5fa8', line: '#c8d2e0', field: '#ffffff', btn: '#1f5fa8', btnInk: '#ffffff', mute: '#66748a'
    };
    const cases = {
      'HLX-4821': { org: 'Halden Freight', opened: '3 days ago', status: 'under review', chat: [
        { by: 'support', at: Date.now() - 86400000 * 3, text: 'Case opened. Upload one encrypted file from a workstation and we will return a decryption proof for it.' },
        { by: 'you', at: Date.now() - 86400000 * 2, text: 'Proof received for the sample invoice. Restore is running on the file server now.' },
        { by: 'support', at: Date.now() - 86400000 * 1, text: 'Noted. Keep the affected hosts isolated until the restore finishes, then rotate the domain administrator password.' }
      ] },
      'HLX-5107': { org: 'Orinoco Legal', opened: '1 day ago', status: 'awaiting sample', chat: [
        { by: 'support', at: Date.now() - 86400000, text: 'Case opened. Send the file list first; we only need one sample from each share.' }
      ] }
    };
    const css = 'body{font:14px/1.65 "Segoe UI",system-ui,sans-serif;}' +
      '.top{background:#fff;border-bottom:1px solid #c8d2e0;padding:14px 22px;display:flex;align-items:center;gap:12px;}' +
      '.logo{width:26px;height:26px;border-radius:6px;background:#1f5fa8;color:#fff;display:grid;place-items:center;font-weight:800;font-size:13px;}' +
      '.top b{font-size:15px;}.top span{margin-left:auto;font-size:11.5px;color:#66748a;}' +
      '.wrap{max-width:900px;margin:20px auto 46px;padding:0 22px;}' +
      '.card{background:#fff;border:1px solid #d5dde8;border-radius:8px;padding:16px 18px;margin:14px 0;box-shadow:0 1px 2px rgba(20,40,70,.04);}' +
      'h1{font-size:20px;margin:12px 0 6px;}h2{font-size:13px;letter-spacing:.06em;text-transform:uppercase;color:#66748a;margin:20px 0 8px;}' +
      'p{color:#3d4a5c;}table{font-size:13px;}th{text-align:left;color:#66748a;font-weight:500;padding:6px 8px;border-bottom:1px solid #e2e8f0;width:34%;}td{padding:6px 8px;border-bottom:1px solid #eef2f7;}' +
      '.badge{display:inline-block;background:#e8f0fb;color:#1f5fa8;border-radius:999px;padding:2px 10px;font-size:11px;}' +
      '.chat{list-style:none;padding:0;margin:0;}.chat li{padding:10px 12px;border-radius:8px;margin-bottom:8px;background:#f4f7fb;}.chat li.you{background:#e8f0fb;}' +
      '.chat small{display:block;color:#66748a;font-size:11px;margin-bottom:3px;}' +
      'input{width:100%;box-sizing:border-box;padding:9px 11px;border:1px solid #c8d2e0;border-radius:6px;font:inherit;background:#fff;}' +
      'button{background:#1f5fa8;color:#fff;border:0;border-radius:6px;padding:9px 16px;font:600 13px "Segoe UI",sans-serif;cursor:pointer;}' +
      '.warn{background:#fff7e6;border:1px solid #f0d29a;color:#7a5a1c;border-radius:8px;padding:10px 13px;font-size:12.5px;margin:14px 0;}';
    const shell = (title, inner) => page(site, title, css,
      '<div class="top"><span class="logo">H</span><b>Helix Recovery</b><span>' + esc(site.host) + ' · case portal</span></div><div class="wrap">' + inner + '</div>');
    site.render = (path, query) => {
      if (/^\/case\/[A-Z0-9-]+$/i.test(path)) {
        const key = path.split('/').pop().toUpperCase();
        const c = cases[key];
        if (!c) return { status: 404, type: 'text/html', body: shell('Not found', '<div class="card"><h1>That case reference is not valid</h1><p>Check the reference on the notice left on your file server.</p></div>') };
        const msg = String(query.get('message') || '').trim();
        if (msg) c.chat.push({ by: 'you', at: Date.now(), text: msg.slice(0, 500) });
        return { status: 200, type: 'text/html', body: shell(key, '<div class="card"><h1>' + esc(key) + '</h1><p><span class="badge">' + esc(c.status) + '</span></p>' +
          '<table><tr><th>Organisation</th><td>' + esc(c.org) + '</td></tr><tr><th>Opened</th><td>' + esc(c.opened) + '</td></tr><tr><th>Next step</th><td>send one encrypted sample file per share</td></tr></table></div>' +
          '<div class="card"><h2>Messages</h2><ul class="chat">' + c.chat.map(m => '<li' + (m.by === 'you' ? ' class="you"' : '') + '><small>' + (m.by === 'you' ? 'You' : 'Helix support') + ' · ' + stamp(m.at) + '</small>' + esc(m.text) + '</li>').join('') + '</ul>' +
          '<form action="/case/' + esc(key) + '" method="post"><input name="message" placeholder="Write a message"><div style="margin-top:10px"><button>Send</button></div></form></div>' +
          '<div class="warn">Simulated case portal: no recovery service exists behind it, no key is exchanged and nothing is charged. A real portal like this is a pressure tactic; the reliable way out is restore and rotate.</div>' +
          '<p><a href="/">All cases</a></p>') };
      }
      if (path === '/faq') return { status: 200, type: 'text/html', body: shell('FAQ', '<div class="card"><h1>Recovery FAQ</h1><p><b>How do I know a decryption proof is real?</b> Send one file, get it back readable, and compare it. A proof for a file you chose is the only meaningful test.</p><p><b>Should we pay?</b> That is a business decision, not a technical one. Restoring from an offline backup is the only option that does not fund the next attack.</p><p><b>What do we rotate?</b> Every credential a domain administrator touched, then every service account, then the backups.</p></div>') };
      return { status: 200, type: 'text/html', body: shell('Cases', '<div class="card"><h1>Recovery case portal</h1><p>Enter the case reference from the notice left on your system. This portal is only for the named organisation; it does not sell anything.</p>' +
        '<form action="/case/HLX-4821" method="get"><label style="font-size:12px;color:#66748a">Case reference</label><input name="ref" placeholder="HLX-0000"><div style="margin-top:10px"><button>Open case</button></div></form></div>' +
        '<div class="card"><h2>Demo cases</h2><p><a href="/case/HLX-4821">HLX-4821</a> · Halden Freight · under review<br><a href="/case/HLX-5107">HLX-5107</a> · Orinoco Legal · awaiting sample</p></div>' +
        '<p><a href="/faq">Recovery FAQ</a></p>') };
    };
    return site;
  })();

  /* 8 — onion-only news */
  const news = (() => {
    const site = {
      kind: 'News outlet', brand: 'The Backchannel', host: 'backchannel.onion', icon: '📰',
      topic: 'investigative journalism', region: 'Onion space', market: false, noSales: true,
      tagline: 'Reporting on breaches, brokers and the business of stolen data. Reader funded.',
      bg: '#0c0b0a', ink: '#e8e3d9', link: '#e8b05a', line: '#2b2723', field: '#131110', btn: '#3a2a12', btnInk: '#f3dcb6', mute: '#948b7c'
    };
    const stories = [
      { id: 1, title: 'The leak that never arrived: inside a failed extortion', section: 'Investigations', by: 'R. Okonjo', at: Date.now() - 3600000 * 7, lede: 'A logistics firm refused to pay, restored from an offline backup and published its own incident report. The leak site moved on within a week — and the archive it threatened never appeared.', body: ['The notice appeared on a Tuesday, with a countdown and a screenshot of a file server. By Friday the company had restored from a backup it had never tested.', 'What followed was unglamorous: credential rotation, a public report, and a lot of calls to customers. The extortion group removed the entry eleven days later without publishing anything.', 'Security responders we spoke to said the outcome is common and rarely reported, because the quiet successes do not make headlines.'] },
      { id: 2, title: 'Carding shops are quietly shrinking', section: 'Markets', by: 'M. Vela', at: Date.now() - 86400000 * 2, lede: 'Chip rollouts and better fraud monitoring have cut the resale value of bulk card data. Several long-running shops have pivoted to selling access to accounts instead.', body: ['The economics changed first. A dump of magnetic-stripe data that sold for hundreds a few years ago now moves for less than the cost of the infrastructure to host it.', 'Vendors who stayed moved to account takeover: mailbox access, VPN credentials, and "initial access" to corporate networks, which sell for far more than any single card.', 'Researchers describe the shift as consolidation rather than growth: fewer shops, higher prices, and a market that increasingly depends on a handful of brokers.'] },
      { id: 3, title: 'What a signed mirror list actually proves', section: 'OPSEC', by: 'editor', at: Date.now() - 86400000 * 4, lede: 'A PGP signature proves the list came from whoever holds the key. It says nothing about whether the service behind the address is honest, or whether the key was ever the right one.', body: ['Directories publish fingerprints next to addresses, which helps, but only if you already know the fingerprint from somewhere else.', 'Clones copy branding, vendor lists and even dispute pages. The one thing they cannot copy is a signature made with the operator key.', 'The practical rule: bind the key first, then check the address. Doing it the other way round verifies nothing.'] },
      { id: 4, title: 'The volunteers who keep the directories alive', section: 'Community', by: 'S. Idris', at: Date.now() - 86400000 * 6, lede: 'Uptime probes, mirror lists and takedown notices are maintained largely by unpaid volunteers, often through automated checks that run every few minutes.', body: ['A green dot on a directory means one thing: the address answered. It is a network measurement, not a reputation score.', 'Several directory operators told us they spend more time removing clones than adding new services.', 'The work is boring, repetitive and mostly invisible — which is exactly what makes it useful.'] }
    ];
    const css = 'body{font:16px/1.7 Georgia,"Iowan Old Style",serif;}' +
      '.mast{background:#120f0d;border-bottom:3px double #3a332b;padding:16px 22px;display:flex;justify-content:space-between;align-items:baseline;}' +
      '.mast b{font:700 26px/1 Georgia,serif;letter-spacing:-.01em;color:#f0e6d5;}.mast span{font:11px/1 "Segoe UI",sans-serif;color:#948b7c;letter-spacing:.1em;text-transform:uppercase;}' +
      '.wrap{max-width:960px;margin:0 auto;padding:22px 22px 48px;}' +
      '.sect{display:flex;gap:18px;border-bottom:1px solid #2b2723;padding-bottom:8px;font:11.5px/1 "Segoe UI",sans-serif;letter-spacing:.12em;text-transform:uppercase;color:#948b7c;}' +
      'h1{font:700 31px/1.18 Georgia,serif;margin:16px 0 8px;}h2{font:700 13px/1.3 "Segoe UI",sans-serif;letter-spacing:.16em;text-transform:uppercase;color:#e8b05a;margin:26px 0 8px;}' +
      'p{color:#c9c2b6;}.byline{font:12px/1.4 "Segoe UI",sans-serif;color:#948b7c;margin-bottom:14px;}' +
      'article{border-bottom:1px solid #2b2723;padding-bottom:16px;margin-bottom:16px;}article b{font:700 20px/1.25 Georgia,serif;}article b a{color:#f0e6d5;}article p{font-size:15px;}' +
      '.note{font:12px/1.6 "Segoe UI",sans-serif;color:#948b7c;border-top:1px solid #2b2723;margin-top:26px;padding-top:12px;}';
    const shell = (title, inner) => page(site, title, css,
      '<div class="mast"><b>The Backchannel</b><span>' + esc(site.host) + ' · reader funded · no advertising</span></div><div class="wrap">' +
      '<div class="sect"><span>Investigations</span><span>Markets</span><span>OPSEC</span><span>Community</span><span style="margin-left:auto">' + day(Date.now()) + '</span></div>' + inner + '</div>');
    site.render = (path, query) => {
      if (path === '/tips') return { status: 200, type: 'text/html', body: shell('Tips', '<h1>Send a tip</h1><p>Use the separate drop at <a href="https://securewhistle.onion/">securewhistle.onion</a>. Do not send documents by mail.</p>') };
      if (path === '/about') return { status: 200, type: 'text/html', body: shell('About', '<h1>About this paper</h1><p>Four reporters, no advertising, funded by readers. We publish what we can verify and correct what we cannot.</p><p>Nothing on this site is for sale.</p>') };
      if (/^\/story\/\d+$/.test(path)) {
        const s = stories.find(x => x.id === Number(path.split('/').pop()));
        if (!s) return { status: 404, type: 'text/html', body: shell('Missing', '<h1>No such story</h1>') };
        return { status: 200, type: 'text/html', body: shell(s.title, '<p class="byline"><a href="/">← front page</a> · ' + esc(s.section) + '</p><h1>' + esc(s.title) + '</h1>' +
          '<p class="byline">By ' + esc(s.by) + ' · ' + day(s.at) + '</p>' + s.body.map(p => '<p>' + esc(p) + '</p>').join('') +
          '<p class="note">Simulated reporting for the Cyber Desktop. The firms, people and incidents in this article are invented.</p>') };
      }
      return { status: 200, type: 'text/html', body: shell('Front page', '<h1>Reporting from the parts of the network nobody indexes</h1>' +
        '<p class="byline">Breaches, brokers and the business of stolen data. Every story is checked against a document we have seen.</p>' +
        stories.map(s => '<article><b><a href="/story/' + s.id + '">' + esc(s.title) + '</a></b><div class="byline">' + esc(s.section) + ' · ' + esc(s.by) + ' · ' + day(s.at) + '</div><p>' + esc(s.lede) + '</p></article>').join('') +
        '<p class="note"><a href="/tips">Send a tip</a> · <a href="/about">About</a> · no trackers, no ads, nothing for sale.</p>') };
    };
    return site;
  })();

  /* 9 — a forum */
  const forum = (() => {
    const site = {
      kind: 'Forum', brand: 'Grey Market Forum', host: 'greyforum.onion', icon: '💬',
      topic: 'vendor discussion', region: 'Onion space', market: false, noSales: true,
      tagline: 'Discussion boards for buyers and vendors. Reviews, disputes, OPSEC.',
      bg: '#0b1016', ink: '#cfd8e3', link: '#7fb2e5', line: '#22303f', field: '#101821', btn: '#1c2f42', btnInk: '#dbe7f3', mute: '#7f93a8'
    };
    const boards = [
      { id: 1, name: 'Introductions & rules', threads: 42, posts: 610, last: 'mirrorcraft · 2h' },
      { id: 2, name: 'Marketplace reviews', threads: 311, posts: 4028, last: 'fernworks · 18m' },
      { id: 3, name: 'OPSEC & tooling', threads: 188, posts: 2210, last: 'nullbyte · 41m' },
      { id: 4, name: 'Leaks & disclosures', threads: 96, posts: 840, last: 'ghostline · 3h' },
      { id: 5, name: 'Scam reports', threads: 240, posts: 1705, last: 'paperdrift · 6h' }
    ];
    const threads = [
      { id: 1, board: 1, title: 'Read this before you post anything', author: 'mod_ash', replies: 12, at: Date.now() - 86400000 * 3, body: 'No doxxing, no real-world threats, no requests that touch a live system. This board is a simulation and the moderators treat it that way.' },
      { id: 2, board: 2, title: 'fernworks — three orders, all arrived', author: 'slowpost', replies: 31, at: Date.now() - 3600000 * 5, body: 'Third order landed in six days. Packaging was plain and the decoy invoice was convincing. Escrow released after arrival, as usual.' },
      { id: 3, board: 2, title: 'Warning: fake mirror for Nightfall', author: 'mod_ash', replies: 48, at: Date.now() - 3600000 * 9, body: 'There is a clone with the same branding on a different onion. Check the signed mirror list on the market itself before signing in.' },
      { id: 4, board: 3, title: 'Keeping a written threat model for a small service', author: 'nullbyte', replies: 19, at: Date.now() - 3600000 * 26, body: 'One page: what you protect, who from, and what you accept losing. Update it when the service changes.' },
      { id: 5, board: 5, title: 'Vendor vanished with 0.8 XMR in escrow', author: 'greyuser', replies: 74, at: Date.now() - 3600000 * 40, body: 'Order never shipped and the account went quiet. Escrow refunded after the dispute window, so never finalise early.' }
    ];
    const replies = {};
    const css = 'body{font:13px/1.6 Verdana,Tahoma,sans-serif;}' +
      '.top{background:#12202e;border-bottom:1px solid #22303f;padding:14px 22px;display:flex;justify-content:space-between;align-items:center;}' +
      '.top b{color:#9cc7f2;font-size:16px;letter-spacing:.04em;}.top span{color:#7f93a8;font-size:11px;}' +
      '.wrap{max-width:1000px;margin:0 auto;padding:18px 22px 44px;}' +
      '.bar{background:#101821;border:1px solid #22303f;padding:8px 12px;font-size:12px;color:#7f93a8;margin:12px 0;}' +
      'h1{font-size:18px;margin:14px 0 6px;color:#dbe7f3;}h2{font-size:12px;letter-spacing:.1em;text-transform:uppercase;color:#9cc7f2;margin:22px 0 8px;}' +
      'table{font-size:12.5px;border:1px solid #22303f;background:#0e161f;}th{background:#16232f;text-align:left;color:#8fa8c2;font-size:11px;letter-spacing:.08em;text-transform:uppercase;padding:8px 10px;border-bottom:1px solid #22303f;}' +
      'td{padding:9px 10px;border-bottom:1px solid #1a2733;vertical-align:top;}.desc{color:#7f93a8;font-size:11.5px;}.stat{color:#6f8499;font-size:11px;text-align:center;}' +
      '.post{background:#0e161f;border:1px solid #22303f;margin-bottom:10px;display:grid;grid-template-columns:150px 1fr;}' +
      '.post .who{background:#121d28;padding:10px 12px;border-right:1px solid #22303f;font-size:11.5px;color:#8fa8c2;}.post .body{padding:10px 14px;}' +
      '.who b{display:block;color:#bcd6ef;font-size:12.5px;}.who span{color:#6f8499;font-size:11px;}' +
      'p{color:#c3d0dd;}.muted{color:#7f93a8;font-size:11.5px;}';
    const shell = (title, inner) => page(site, title, css,
      '<div class="top"><b>Grey Market Forum</b><span>' + esc(site.host) + ' · members 12,408 · <a href="/login">sign in</a></span></div><div class="wrap">' +
      '<div class="bar"><a href="/">Board index</a> · <a href="/rules">Rules</a> · <a href="/members">Members</a> · <a href="/pgp.txt">PGP</a> · no sales, no shop</div>' + inner + '</div>');
    site.render = (path, query) => {
      if (path === '/pgp.txt') return pgpPage(site, 'Grey Market Forum moderation');
      if (path === '/rules') return { status: 200, type: 'text/html', body: shell('Rules', '<h1>Forum rules</h1><p>This is a simulated forum: the handles, vendors and disputes are invented.</p><ul><li>Reviews need an order reference.</li><li>Scam reports need evidence, not anger.</li><li>No real people, no live targets, no requests for either.</li></ul>') };
      if (path === '/members') return { status: 200, type: 'text/html', body: shell('Members', '<h1>Members</h1><table><tr><th>Handle</th><th>Joined</th><th>Posts</th><th>Trust</th></tr>' +
        ['mod_ash', 'nullbyte', 'slowpost', 'greyuser', 'fernworks', 'paperdrift'].map((m, i) => '<tr><td><b>' + esc(m) + '</b></td><td>20' + (21 + i) + '</td><td>' + (120 + i * 411) + '</td><td>' + (70 + i * 4) + '%</td></tr>').join('') + '</table>') };
      if (path === '/login') {
        const u = query.get('u') || '';
        return { status: 200, type: 'text/html', body: shell('Sign in', u ? '<h1>Signed in as ' + esc(u) + '</h1><p class="muted">Session is local to this page.</p>' : '<h1>Sign in</h1><form action="/login" method="get"><label>Handle</label><input name="u"><label>Password</label><input name="p" type="password"><button>Sign in</button></form>') };
      }
      if (/^\/board\/\d+$/.test(path)) {
        const b = boards.find(x => x.id === Number(path.split('/').pop()));
        if (!b) return { status: 404, type: 'text/html', body: shell('Missing', '<h1>No such board</h1>') };
        const rows = threads.filter(t => t.board === b.id);
        return { status: 200, type: 'text/html', body: shell(b.name, '<h1>' + esc(b.name) + '</h1><p class="muted">' + b.threads + ' threads · ' + b.posts.toLocaleString() + ' posts</p>' +
          '<table><tr><th>Thread</th><th class="stat">Replies</th><th>Started by</th><th>Last post</th></tr>' +
          (rows.length ? rows.map(t => '<tr><td><b><a href="/thread/' + t.id + '">' + esc(t.title) + '</a></b></td><td class="stat">' + (t.replies + (replies[t.id] || []).length) + '</td>' +
            '<td>' + esc(t.author) + '</td><td class="desc">' + stamp(t.at) + '</td></tr>').join('') : '<tr><td colspan="4" class="desc">No threads on this board yet.</td></tr>') + '</table>') };
      }
      if (/^\/thread\/\d+$/.test(path)) {
        const t = threads.find(x => x.id === Number(path.split('/').pop()));
        if (!t) return { status: 404, type: 'text/html', body: shell('Missing', '<h1>No such thread</h1>') };
        replies[t.id] = replies[t.id] || [{ author: 'mod_ash', at: t.at + 3600000, text: 'Pinned. Check the signed list before using any mirror.' }, { author: 'slowpost', at: t.at + 7200000, text: 'Useful, thanks. Same experience here.' }];
        const msg = String(query.get('reply') || '').trim();
        const who = String(query.get('author') || 'guest').trim() || 'guest';
        if (msg) replies[t.id].push({ author: who.slice(0, 24), at: Date.now(), text: msg.slice(0, 400) });
        return { status: 200, type: 'text/html', body: shell(t.title, '<p class="muted"><a href="/board/' + t.board + '">← board</a></p><h1>' + esc(t.title) + '</h1>' +
          '<div class="post"><div class="who"><b>' + esc(t.author) + '</b><span>member · ' + day(t.at) + '</span></div><div class="body"><p>' + esc(t.body) + '</p></div></div>' +
          replies[t.id].map(r => '<div class="post"><div class="who"><b>' + esc(r.author) + '</b><span>' + stamp(r.at) + '</span></div><div class="body"><p>' + esc(r.text) + '</p></div></div>').join('') +
          '<h2>Reply</h2><form action="/thread/' + t.id + '" method="post"><label>Handle</label><input name="author" placeholder="guest"><label>Message</label><textarea name="reply" rows="4"></textarea><div style="margin-top:8px"><button>Post reply</button></div></form>') };
      }
      return { status: 200, type: 'text/html', body: shell('Index', '<h1>Grey Market Forum</h1><p class="muted">Reviews, disputes and OPSEC. No shop here — the markets live on their own onions.</p>' +
        '<table><tr><th>Board</th><th class="stat">Threads</th><th class="stat">Posts</th><th>Last post</th></tr>' + boards.map(b => '<tr><td><b><a href="/board/' + b.id + '">' + esc(b.name) + '</a></b></td><td class="stat">' + b.threads + '</td><td class="stat">' + b.posts.toLocaleString() + '</td><td class="desc">' + esc(b.last) + '</td></tr>').join('') + '</table>') };
    };
    return site;
  })();

  /* 10 — an initial-access broker: a market for network access */
  const broker = (() => {
    const site = {
      kind: 'Access broker', brand: 'KeyBroker', host: 'keybroker.onion', icon: '🔑',
      topic: 'network access listings', region: 'Onion space', market: true,
      tagline: 'Listings for network access. Proof first, escrow always.',
      bg: '#080d10', ink: '#d7e6ea', link: '#4fd8d0', line: '#17313a', field: '#0c171c', btn: '#0f2f34', btnInk: '#bff2ef', mute: '#7e9aa3'
    };
    const offers = [
      { id: 1, sector: 'Manufacturing', country: 'US', revenue: '$180M', type: 'VPN + domain admin', price: 4200, proof: 'network share listing, three hosts', updated: 2, note: 'Two-factor on mail, none on VPN. Domain admin session available from a workstation.' },
      { id: 2, sector: 'Insurance', country: 'UK', revenue: '$96M', type: 'RDP, local admin', price: 2600, proof: 'screenshot of file server', updated: 5, note: 'Local admin on a jump host, no endpoint protection seen.' },
      { id: 3, sector: 'Hospitality', country: 'FR', revenue: '$44M', type: 'Citrix, no MFA', price: 1500, proof: 'mailbox sample', updated: 8, note: 'Citrix gateway without MFA. One mailbox sample included in the proof.' },
      { id: 4, sector: 'Logistics', country: 'NL', revenue: '$210M', type: 'edge appliance, root', price: 6100, proof: 'config export', updated: 1, note: 'Root on an edge appliance, internal network reachable. Config export as proof.' },
      { id: 5, sector: 'Retail', country: 'CA', revenue: '$58M', type: 'POS back office', price: 1900, proof: 'inventory export', updated: 12, note: 'Back-office access to the POS estate; store network only.' }
    ];
    const orders = [];
    const css = 'body{font:13px/1.6 "Segoe UI",system-ui,sans-serif;background-image:linear-gradient(180deg,#07161b 0,#080d10 320px);}' +
      '.top{border-bottom:1px solid #17313a;padding:14px 22px;display:flex;justify-content:space-between;align-items:baseline;}' +
      '.top b{color:#4fd8d0;font-size:17px;letter-spacing:.04em;}.top span{color:#7e9aa3;font-size:11px;}' +
      '.wrap{max-width:1040px;margin:0 auto;padding:18px 22px 44px;}' +
      '.kpi{display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:10px;margin:14px 0 18px;}' +
      '.kpi div{border:1px solid #17313a;background:#0b1418;padding:10px 12px;}.kpi b{display:block;font-size:18px;color:#9ff0ec;}.kpi span{font-size:11px;color:#7e9aa3;}' +
      'h1{font-size:19px;margin:14px 0 6px;}h2{font-size:12px;letter-spacing:.14em;text-transform:uppercase;color:#4fd8d0;margin:22px 0 8px;}' +
      'p{color:#a9c1c8;}table{font-size:12.5px;border:1px solid #17313a;}th{background:#0d1d22;text-align:left;color:#83a3ac;font-size:10.5px;letter-spacing:.1em;text-transform:uppercase;padding:7px 9px;border-bottom:1px solid #17313a;}' +
      'td{padding:8px 9px;border-bottom:1px solid #12262c;}.price{color:#9ff0ec;font-weight:700;}.tag{font-size:10px;border:1px solid #21454f;background:#0f2228;color:#9ff0ec;padding:1px 6px;}' +
      '.note{border:1px solid #21454f;background:#0c1b20;color:#a9c1c8;padding:10px 12px;font-size:12px;margin:12px 0;}';
    const shell = (title, inner) => page(site, title, css,
      '<div class="top"><b>KEYBROKER</b><span>' + esc(site.host) + ' · access listings · escrow · proof first</span></div><div class="wrap">' + inner + '</div>');
    const row = o => '<tr><td><a href="/offer/' + o.id + '">' + esc(o.sector) + ' · ' + esc(o.country) + '</a><div class="muted" style="color:#7e9aa3;font-size:11px">' + esc(o.type) + '</div></td>' +
      '<td>' + esc(o.revenue) + '</td><td><span class="tag">' + esc(o.type.split(',')[0]) + '</span></td><td class="price">' + money(o.price) + '</td><td>' + o.updated + 'd ago</td><td><a href="/offer/' + o.id + '">view</a></td></tr>';
    site.render = (path, query) => {
      if (path === '/rules') return { status: 200, type: 'text/html', body: shell('Rules', '<h1>Broker rules</h1><p>Simulated listings: the companies, networks and proofs are invented and no access exists.</p><ul><li>Proof before payment: one file or config export chosen by the buyer.</li><li>Escrow only, released after the buyer confirms the proof.</li><li>No government, healthcare or utility targets in this simulation.</li><li>Access is sold once. A listing that reappears is a scam.</li></ul>') };
      if (/^\/offer\/\d+$/.test(path)) {
        const o = offers.find(x => x.id === Number(path.split('/').pop()));
        if (!o) return { status: 404, type: 'text/html', body: shell('Missing', '<h1>No such listing</h1>') };
        return { status: 200, type: 'text/html', body: shell('Offer', '<p style="color:#7e9aa3;font-size:12px"><a href="/">← listings</a></p><h1>' + esc(o.sector) + ' · ' + esc(o.country) + '</h1>' +
          '<table><tr><th>Revenue</th><td>' + esc(o.revenue) + '</td></tr><tr><th>Access</th><td>' + esc(o.type) + '</td></tr><tr><th>Proof</th><td>' + esc(o.proof) + '</td></tr>' +
          '<tr><th>Price</th><td class="price">' + money(o.price) + '</td></tr><tr><th>Updated</th><td>' + o.updated + ' days ago</td></tr></table>' +
          '<p>' + esc(o.note) + '</p><form action="/order" method="get"><input type="hidden" name="offer" value="' + o.id + '"><label>Escrow note</label><input name="note" placeholder="what you want as proof"><button>Open escrow</button></form>' +
          '<div class="note">Simulated listing. No network, host or credential exists behind this text.</div>') };
      }
      if (path === '/order') {
        const o = offers.find(x => x.id === Number(query.get('offer')));
        if (!o) return { status: 400, type: 'text/html', body: shell('Bad order', '<h1>Pick a listing first</h1><p><a href="/">Listings</a></p>') };
        const id = 'KB-' + (3000 + orders.length + 1);
        orders.push({ id, offer: o.id, at: Date.now(), price: o.price });
        return { status: 200, type: 'text/html', body: shell('Escrow', '<h1>Escrow opened · ' + esc(id) + '</h1><p>' + money(o.price) + ' held for ' + esc(o.sector) + ' · ' + esc(o.country) + '. The broker is asked for the proof you named: ' + esc(query.get('note') || 'one proof file') + '.</p>' +
          '<p style="color:#7e9aa3;font-size:12px">Simulated escrow: no payment, no access, no broker.</p><p><a href="/orders">Orders</a></p>') };
      }
      if (path === '/orders') return { status: 200, type: 'text/html', body: shell('Orders', '<h1>Your escrows</h1>' + (orders.length ? '<table><tr><th>Order</th><th>Listing</th><th>At</th><th>Price</th><th>State</th></tr>' +
        orders.map(o => { const of = offers.find(x => x.id === o.offer) || {}; return '<tr><td>' + esc(o.id) + '</td><td>' + esc((of.sector || '') + ' · ' + (of.country || '')) + '</td><td>' + stamp(o.at) + '</td><td>' + money(o.price) + '</td><td>awaiting proof</td></tr>'; }).join('') + '</table>' : '<p>None yet.</p>')) };
      return { status: 200, type: 'text/html', body: shell('Listings', '<h1>Access listings</h1><p>Proof before payment, escrow always. Every listing names the proof a buyer can demand.</p>' +
        '<div class="kpi"><div><b>5</b><span>live listings</span></div><div><b>' + money(16800) + '</b><span>total ask</span></div><div><b>0.9%</b><span>dispute rate</span></div><div><b>41</b><span>brokers registered</span></div></div>' +
        '<table><tr><th>Listing</th><th>Revenue</th><th>Type</th><th>Price</th><th>Updated</th><th></th></tr>' + offers.map(row).join('') + '</table>' +
        '<div class="note">Simulated broker. Nothing here reaches a network, and no real company is named.</div>') };
    };
    return site;
  })();

  /* 11 — a pharmacy market (a market, so a price list is faithful) */
  const pharmacy = (() => {
    const site = {
      kind: 'Pharmacy market', brand: 'BlackPharma', host: 'blackpharma.onion', icon: '💊',
      topic: 'no-prescription pharmacy', region: 'Onion space', market: true,
      tagline: 'No prescription. Stealth shipping. Escrow on every order.',
      bg: '#061210', ink: '#d8f0e6', link: '#5ee6b0', line: '#123a30', field: '#0a1d19', btn: '#0f3a2e', btnInk: '#c8f5e2', mute: '#7aa79a'
    };
    const products = [
      { id: 1, name: 'Pain relief, 30 tablets', cat: 'Pain', price: 24, pack: '30 × 200 mg', ships: 'EU · 4 days', stock: 240 },
      { id: 2, name: 'Sleep aid, 20 tablets', cat: 'Sleep', price: 31, pack: '20 × 10 mg', ships: 'EU · 4 days', stock: 120 },
      { id: 3, name: 'Antibiotic course, 14 caps', cat: 'Anti-infective', price: 46, pack: '14 × 500 mg', ships: 'Worldwide · 9 days', stock: 64 },
      { id: 4, name: 'Allergy relief, 30 tablets', cat: 'Allergy', price: 18, pack: '30 × 10 mg', ships: 'EU · 4 days', stock: 310 },
      { id: 5, name: 'Migraine relief, 12 tablets', cat: 'Pain', price: 28, pack: '12 × 50 mg', ships: 'EU · 5 days', stock: 88 },
      { id: 6, name: 'Rehydration sachets, 20', cat: 'General', price: 14, pack: '20 sachets', ships: 'Worldwide · 9 days', stock: 400 }
    ];
    const carts = {}, orders = [];
    const css = 'body{font:13.5px/1.65 "Segoe UI",system-ui,sans-serif;}' +
      '.top{background:#08211c;border-bottom:1px solid #123a30;padding:14px 22px;display:flex;justify-content:space-between;align-items:baseline;}' +
      '.top b{color:#5ee6b0;font-size:18px;letter-spacing:.03em;}.top span{color:#7aa79a;font-size:11px;}' +
      '.wrap{max-width:1000px;margin:0 auto;padding:18px 22px 44px;}' +
      '.hero{background:linear-gradient(120deg,#0a2a22,#071613);border:1px solid #123a30;padding:16px 18px;margin:14px 0;}' +
      'h1{font-size:20px;margin:12px 0 6px;}h2{font-size:12px;letter-spacing:.14em;text-transform:uppercase;color:#5ee6b0;margin:22px 0 8px;}' +
      'p{color:#a9cfc3;}table{font-size:12.5px;}th{text-align:left;color:#7aa79a;font-size:10.5px;letter-spacing:.1em;text-transform:uppercase;padding:7px 9px;border-bottom:1px solid #123a30;}' +
      'td{padding:9px;border-bottom:1px solid #0d2a24;}.price{color:#b6ffdf;font-weight:700;}.tag{font-size:10px;border:1px solid #1e5344;background:#0c2a23;color:#9ff0d6;padding:1px 6px;}' +
      '.note{border-left:3px solid #5ee6b0;background:#08221c;padding:10px 13px;color:#bfe6d8;font-size:12px;margin:14px 0;}';
    const shell = (title, inner) => page(site, title, css,
      '<div class="top"><b>BLACKPHARMA</b><span>' + esc(site.host) + ' · no prescription · escrow · stealth shipping</span></div><div class="wrap">' + inner + '</div>');
    const row = p => '<tr><td><a href="/product/' + p.id + '">' + esc(p.name) + '</a><div class="muted" style="color:#7aa79a;font-size:11px">' + esc(p.pack) + '</div></td>' +
      '<td><span class="tag">' + esc(p.cat) + '</span></td><td class="price">' + money(p.price) + '</td><td>' + esc(p.ships) + '</td><td>' + p.stock + '</td><td><a href="/cart?add=' + p.id + '">add</a></td></tr>';
    site.render = (path, query) => {
      if (path === '/shipping') return { status: 200, type: 'text/html', body: shell('Shipping', '<h1>Shipping</h1><p>Plain outer envelope, no pharmacy markings, no signature. EU orders usually arrive in four days; the rest of the world in nine.</p><p>Nothing in this simulation is dispatched, and no real medicine is described for sale.</p>') };
      if (path === '/faq') return { status: 200, type: 'text/html', body: shell('FAQ', '<h1>FAQ</h1><p><b>Do I need a prescription?</b> Not here. That is also the reason a real pharmacy like this is illegal in most places.</p><p><b>What if it does not arrive?</b> Escrow refunds after the shipping window.</p><p><b>Is this a real shop?</b> No. It is a simulated market inside the Cyber Desktop.</p>') };
      if (/^\/product\/\d+$/.test(path)) {
        const p = products.find(x => x.id === Number(path.split('/').pop()));
        if (!p) return { status: 404, type: 'text/html', body: shell('Missing', '<h1>No such product</h1>') };
        return { status: 200, type: 'text/html', body: shell(p.name, '<p style="color:#7aa79a;font-size:12px"><a href="/">← shop</a></p><h1>' + esc(p.name) + '</h1><p style="color:#7aa79a;font-size:12px">' + esc(p.pack) + ' · ' + esc(p.cat) + ' · ' + esc(p.ships) + '</p>' +
          '<h2 class="price">' + money(p.price) + '</h2><p>Sealed pack, batch and expiry printed, plain outer envelope. ' + p.stock + ' in stock.</p>' +
          '<form action="/cart" method="get"><input type="hidden" name="add" value="' + p.id + '"><label>Packs</label><input name="qty" value="1"><div style="margin-top:8px"><button>Add to cart</button></div></form>' +
          '<div class="note">Simulated product. No medicine exists, nothing ships, and no medical advice is offered here.</div>') };
      }
      if (path === '/cart') {
        const cart = carts[session] || (carts[session] = {});
        if (query.has('add')) { const p = products.find(x => x.id === Number(query.get('add'))); if (p) cart[p.id] = (cart[p.id] || 0) + Math.max(1, Number(query.get('qty')) || 1); }
        if (query.has('remove')) delete cart[Number(query.get('remove'))];
        const lines = Object.keys(cart).map(id => ({ p: products.find(x => x.id === Number(id)), qty: cart[id] })).filter(l => l.p);
        const total = lines.reduce((n, l) => n + l.p.price * l.qty, 0);
        return { status: 200, type: 'text/html', body: shell('Cart', '<h1>Cart</h1>' + (lines.length ? '<table><tr><th>Item</th><th>Packs</th><th>Price</th><th></th></tr>' +
          lines.map(l => '<tr><td>' + esc(l.p.name) + '</td><td>' + l.qty + '</td><td>' + money(l.p.price * l.qty) + '</td><td><a href="/cart?remove=' + l.p.id + '">remove</a></td></tr>').join('') + '</table>' +
          '<h2>Total ' + money(total) + '</h2><form action="/checkout" method="get"><label>Country</label><input name="country" value="NL"><div style="margin-top:8px"><button>Place order (escrow)</button></div></form>' : '<p>Empty. <a href="/">Shop</a></p>')) };
      }
      if (path === '/checkout') {
        const cart = carts[session] || {};
        const lines = Object.keys(cart).map(id => ({ p: products.find(x => x.id === Number(id)), qty: cart[id] })).filter(l => l.p);
        if (!lines.length) return { status: 400, type: 'text/html', body: shell('Empty', '<h1>Nothing to order</h1>') };
        const total = lines.reduce((n, l) => n + l.p.price * l.qty, 0);
        const id = 'BP-' + (4200 + orders.length + 1);
        orders.push({ id, at: Date.now(), total, country: query.get('country') || 'NL' });
        carts[session] = {};
        return { status: 200, type: 'text/html', body: shell('Order', '<h1>Order ' + esc(id) + '</h1><p>' + money(total) + ' held in escrow. Plain envelope to ' + esc(query.get('country') || 'NL') + '.</p>' +
          '<p style="color:#7aa79a;font-size:12px">Simulated order: nothing is dispatched.</p><p><a href="/orders">Orders</a></p>') };
      }
      if (path === '/orders') return { status: 200, type: 'text/html', body: shell('Orders', '<h1>Orders</h1>' + (orders.length ? '<table><tr><th>Order</th><th>At</th><th>Country</th><th>Total</th></tr>' +
        orders.map(o => '<tr><td>' + esc(o.id) + '</td><td>' + stamp(o.at) + '</td><td>' + esc(o.country) + '</td><td>' + money(o.total) + '</td></tr>').join('') + '</table>' : '<p>None yet.</p>')) };
      const cat = String(query.get('cat') || '').trim();
      const list = cat ? products.filter(p => p.cat.toLowerCase() === cat.toLowerCase()) : products;
      return { status: 200, type: 'text/html', body: shell('Shop', '<div class="hero"><h1>No-prescription pharmacy</h1><p>Sealed packs, printed batch and expiry, plain outer envelope. Escrow on every order.</p></div>' +
        '<p><a href="/shipping">Shipping</a> · <a href="/faq">FAQ</a> · ' + ['Pain', 'Sleep', 'Anti-infective', 'Allergy', 'General'].map(c => '<a href="/?cat=' + encodeURIComponent(c) + '">' + c + '</a>').join(' · ') + '</p>' +
        '<table><tr><th>Product</th><th>Category</th><th>Price</th><th>Ships</th><th>Stock</th><th></th></tr>' + list.map(row).join('') + '</table>' +
        '<div class="note">This market sells; the directory, the crew blog, the leak site, the paper and the drop do not. Nothing here is real medicine.</div>') };
    };
    let session = 'anon';
    return site;
  })();

  /* 12 — a mirror/status index with probes */
  const mirrors = (() => {
    const site = {
      kind: 'Mirror status', brand: 'MirrorGate', host: 'mirrorgate.onion', icon: '🛰',
      topic: 'mirror monitoring', region: 'Onion space', market: false, noSales: true,
      tagline: 'Response-time probes for known mirrors. A green dot is not a reputation.',
      bg: '#050a06', ink: '#c9ffd9', link: '#3dff7a', line: '#14351d', field: '#081108', btn: '#10301a', btnInk: '#c9ffd9', mute: '#548a66'
    };
    const services = [
      { id: 1, name: 'Nightfall Market', mirrors: ['nightfall-market.onion', 'nfmirror2x.onion'], ms: 88, last: 4, status: 'up' },
      { id: 2, name: 'GHOST COLLECTIVE', mirrors: ['ghostleaks.onion', 'ghost2q.onion'], ms: 121, last: 3, status: 'up' },
      { id: 3, name: 'null::sector', mirrors: ['nullsector.onion', 'nullsec2x.onion', 'nullsec3q.onion'], ms: 240, last: 9, status: 'slow' },
      { id: 4, name: 'CardVault', mirrors: ['cardvault.onion'], ms: 64, last: 1, status: 'up' },
      { id: 5, name: 'Blackwater SecureDrop', mirrors: ['securewhistle.onion'], ms: 310, last: 12, status: 'slow' },
      { id: 6, name: 'The Backchannel', mirrors: ['backchannel.onion', 'bc2m.onion'], ms: 96, last: 2, status: 'up' },
      { id: 7, name: 'KeyBroker', mirrors: ['keybroker.onion'], ms: 0, last: 41, status: 'down' },
      { id: 8, name: 'BlackPharma', mirrors: ['blackpharma.onion', 'bp2k.onion'], ms: 77, last: 5, status: 'up' }
    ];
    const css = 'body{font:12.5px/1.6 "Consolas","Lucida Console",monospace;}' +
      '.top{border-bottom:1px solid #14351d;padding:14px 22px;display:flex;justify-content:space-between;align-items:baseline;background:#061008;}' +
      '.top b{color:#3dff7a;letter-spacing:.24em;}.top span{color:#548a66;font-size:11px;}' +
      '.wrap{max-width:960px;margin:0 auto;padding:18px 22px 44px;}' +
      'h1{font-size:18px;margin:12px 0 6px;color:#a9ffc4;}h2{font-size:11.5px;letter-spacing:.18em;text-transform:uppercase;color:#3dff7a;margin:24px 0 8px;}' +
      'p{color:#8fc0a0;}table{font-size:12px;}th{text-align:left;color:#548a66;font-size:10.5px;letter-spacing:.1em;text-transform:uppercase;padding:7px 9px;border-bottom:1px solid #14351d;}' +
      'td{padding:8px 9px;border-bottom:1px solid #0e2415;}.up{color:#3dff7a;}.slow{color:#e5c05a;}.down{color:#ff6b6b;}' +
      '.ms{color:#8fc0a0;}.note{border:1px solid #1d4a2b;background:#08170d;color:#8fc0a0;padding:10px 12px;font-size:12px;margin:14px 0;}' +
      'pre{background:#061008;border:1px solid #14351d;padding:12px;color:#7fbf93;font-size:11.5px;overflow:auto;}';
    const shell = (title, inner) => page(site, title, css,
      '<div class="top"><b>MIRRORGATE</b><span>' + esc(site.host) + ' · probes every 5 min · ' + stamp(Date.now()) + '</span></div><div class="wrap">' + inner + '</div>');
    site.render = (path, query) => {
      if (path === '/status' || path === '/api/status') {
        const data = { generated: new Date().toISOString(), note: 'simulated probes', services: services.map(s => ({ name: s.name, mirrors: s.mirrors, status: s.status, response_ms: s.ms, last_checked_min: s.last })) };
        if (path === '/api/status') return { status: 200, type: 'application/json', body: JSON.stringify(data, null, 2) };
        return { status: 200, type: 'text/html', body: shell('Status', '<h1>Status</h1><p>Every probe below is invented. A response time measures one host answering one request; it is not an endorsement.</p>' +
          '<table><tr><th>Service</th><th>Mirror</th><th>Status</th><th>Response</th><th>Checked</th></tr>' +
          services.map(s => s.mirrors.map((m, i) => '<tr><td>' + (i === 0 ? esc(s.name) : '') + '</td><td>' + esc(m) + '</td><td class="' + s.status + '">' + s.status + '</td><td class="ms">' + (s.ms ? s.ms + ' ms' : 'timeout') + '</td><td class="ms">' + s.last + ' min ago</td></tr>').join('')).join('') + '</table>' +
          '<p><a href="/api/status">/api/status</a> (JSON)</p>') };
      }
      if (/^\/service\/\d+$/.test(path)) {
        const s = services.find(x => x.id === Number(path.split('/').pop()));
        if (!s) return { status: 404, type: 'text/html', body: shell('Missing', '<h1>No such service</h1>') };
        return { status: 200, type: 'text/html', body: shell(s.name, '<p style="color:#548a66;font-size:11.5px"><a href="/">← all services</a></p><h1>' + esc(s.name) + '</h1>' +
          '<table><tr><th>Mirror</th><th>Status</th><th>Response</th><th>Checked</th></tr>' + s.mirrors.map(m => '<tr><td>' + esc(m) + '</td><td class="' + s.status + '">' + s.status + '</td><td class="ms">' + (s.ms ? s.ms + ' ms' : 'timeout') + '</td><td class="ms">' + s.last + ' min ago</td></tr>').join('') + '</table>' +
          '<h2>Probe history</h2><pre>' + esc(Array.from({ length: 8 }, (_, i) => (new Date(Date.now() - i * 300000).toLocaleTimeString()) + '  ' + (s.status === 'down' ? 'timeout  ' : (s.ms + i * 7) + ' ms   ') + (s.status === 'down' ? 'no route' : '200 OK')).join('\n')) + '</pre>') };
      }
      return { status: 200, type: 'text/html', body: shell('Index', '<h1>Mirror probes</h1><p>Response times for known mirrors, refreshed every five minutes. We do not rank services and nothing here is for sale.</p>' +
        '<table><tr><th>Service</th><th>Mirrors</th><th>Status</th><th>Response</th><th>Checked</th></tr>' +
        services.map(s => '<tr><td><a href="/service/' + s.id + '">' + esc(s.name) + '</a></td><td class="ms">' + s.mirrors.length + '</td><td class="' + s.status + '">' + s.status + '</td><td class="ms">' + (s.ms ? s.ms + ' ms' : 'timeout') + '</td><td class="ms">' + s.last + ' min ago</td></tr>').join('') + '</table>' +
        '<div class="note">A green dot means an address answered. Clones answer too. Bind the operator key before you trust a page.</div><p><a href="/api/status">JSON status</a></p>') };
    };
    return site;
  })();

  /* ------------------------------------------------------------------ catalogue ----------------------------------------------------------- */
  const CATALOGUE = [directory, market, leaks, crew, carding, whistle, negotiate, news, forum, broker, pharmacy, mirrors];
  let booted = false;

  /* the standard fields the fake internet relies on, without letting the generated design system touch these pages */
  function standardise(site, i) {
    if (!site || site._std) return site;
    const idx = typeof i === 'number' ? i : CATALOGUE.indexOf(site);
    site._std = true;
    site.dark = true;
    site.icon = site.icon || '🧅';
    site.id = 0;
    site.ip = '10.66.0.' + ((idx < 0 ? 0 : idx) + 2);
    site.cat = Object.assign({ id: 'dark-' + Math.max(0, idx), icon: site.icon, label: site.kind, route: '/', routeLabel: site.kind }, site.cat || {});
    site.users = site.users || [];
    site.items = site.items || [];
    site.posts = site.posts || [];
    site.orders = site.orders || [];
    site.session = site.session || { admin: false };
    site.trapped = false;
    site.virus = null;
    site.adminPath = site.adminPath || '/admin';
    site.apiKey = '';
    site.flag = 'FLAG{' + String(site.host).replace(/[^a-z]/gi, '_') + '}';
    site.createdAt = site.createdAt || Date.now() - int(200, 1400) * 86400000;
    site.accent = site.link || '#7fd1ff';
    return site;
  }

  /* one address enters the catalogue once: the hand-written services, the government portals and every generated
     page the index has minted so far */
  function register(site) {
    if (!site || CATALOGUE.includes(site)) return site;
    standardise(site, CATALOGUE.length);
    CATALOGUE.push(site);
    return site;
  }

  /* fill the catalogue on first use. The government portals and a first page of generated services come after the
     hand-written ones, so no service number ever shifts. */
  function sites() {
    if (!booted) {
      booted = true;
      CATALOGUE.forEach((site, i) => standardise(site, i));
      try {
        if (A.darkGen) {
          A.darkGen.agencies().forEach(register);
          A.darkGen.more(36, 90210).forEach(register);
        }
      } catch (e) { }
    }
    return CATALOGUE;
  }

  /* mint a page of brand-new services: the section never runs out, and every address the index prints is a page that
     already answers when you open it */
  function more(n) {
    try {
      const made = A.darkGen ? A.darkGen.more(n || 12) : [];
      made.forEach(s => { s.generated = true; register(s); });
      return made;
    } catch (e) { return []; }
  }

  function find(key) {
    const s = String(key == null ? '' : key).trim().toLowerCase().replace(/^https?:\/\//, '').replace(/\/.*$/, '').replace(/^www\./, '');
    if (!s) return null;
    const hit = sites().find(x => x.host === s);
    if (hit) return hit;
    /* any .onion address is a real page here: typing one the index has never listed generates it on the spot */
    if (/\.onion$/.test(s) && A.darkGen) return register(A.darkGen.site(s));
    return null;
  }

  /* the search behind the Onion Index and `tor sites`: exact and prefix name matches first, then host, category and
     topic matches, then everything else that mentions the words. Deterministic, so the same query always ranks the
     same way. */
  function score(s, q, words) {
    const brand = String(s.brand || '').toLowerCase(), host = String(s.host || '').toLowerCase();
    const kind = String(s.kind || '').toLowerCase(), hay = (brand + ' ' + host + ' ' + kind + ' ' + (s.topic || '') + ' ' + (s.tagline || '')).toLowerCase();
    if (!q) return 1 + (s.gov ? 3 : 0) + (s.generated ? 0 : 2);
    let n = 0;
    if (brand === q || host === q || host === q + '.onion') n += 100;
    if (brand.startsWith(q) || host.startsWith(q)) n += 50;
    if (brand.includes(q)) n += 30;
    if (host.includes(q)) n += 20;
    if (kind.includes(q)) n += 14;
    if ((s.topic || '').toLowerCase().includes(q)) n += 8;
    for (const w of words) if (w.length > 2 && hay.includes(w)) n += 3;
    if (!n) return 0;
    if (s.gov) n += 2;
    return n;
  }
  function rank(list, q) {
    const query = String(q || '').trim().toLowerCase();
    const words = query.split(/\s+/).filter(Boolean);
    return list.map((s, i) => ({ s, i, n: score(s, query, words) }))
      .filter(x => x.n > 0)
      .sort((a, b) => b.n - a.n || String(a.s.brand).localeCompare(String(b.s.brand)) || a.i - b.i)
      .map(x => x.s);
  }
  function search(q) {
    const list = sites().slice();
    return rank(list, q);
  }
  const darkHost = raw => /\.onion(?:$|\/|\?|:)/i.test(String(raw || ''));

  /* what a directory scan finds on a hidden service: only the routes its own backend answers */
  function scan(site) {
    const candidates = ['/', '/about', '/faq', '/archive', '/catalog', '/rules', '/login', '/cart', '/status', '/api/status', '/pgp.txt'];
    const out = [], seen = new Set();
    for (const p of candidates) {
      if (seen.has(p)) continue;
      seen.add(p);
      const r = serve(site, p, new URLSearchParams(''), 'GET');
      if (r && r.status && r.status < 400) out.push({ path: p, status: r.status, size: String(r.body || '').length, note: r.type === 'text/html' ? 'page' : r.type });
    }
    return out.length ? out : [{ path: '/', status: 200, size: 4000, note: 'page' }];
  }

  function serve(site, path, query, method) {
    if (!site || !site.render) return { status: 404, type: 'text/plain', body: '404 Not Found\n' };
    const clean = path || '/';
    try {
      const out = site.render(clean, query, method);
      if (out && out.body != null && out.status) return out;
      return { status: 200, type: 'text/html', body: String(out) };
    } catch (error) {
      return { status: 500, type: 'text/html', body: page(site, 'Error', '', '<h1>500</h1><p>The service dropped the request.</p>') };
    }
  }

  A.cyberDark = {
    sites, find, search, serve, scan, darkHost, rank, register, more,
    all: () => sites(),
    count: () => sites().length,
    /* the government and police portals, listed separately for `tor gov` and the Browser */
    agencies: () => sites().filter(s => s.gov),
    generated: () => sites().filter(s => s.generated),
    /* the directory is the section's front door, and the one address the Browser's chip opens */
    portalHost: directory.host,
    portalUrl: q => 'https://' + directory.host + '/?q=' + encodeURIComponent(String(q == null ? '' : q)),
    isDark: site => !!(site && site.dark),
    markets: () => sites().filter(s => s.market),
    label: s => s.brand + '  ·  ' + s.host
  };
})();

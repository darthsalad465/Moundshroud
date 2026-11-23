// Cyber > Fake Dark Web > the endless part of the onion space, plus the government and police hidden services.
// Every hidden service here is generated from its own .onion address, so the section never runs out: the Onion Index
// can always mint one more, and any address you type is a page that already exists. Two of them are written to look as
// finished as the surface fake internet; two are written to look like the worst page on the network, because that is
// what most of the .onion space really looks like. Nothing is fetched, no address is contacted, and every vendor,
// agency, case and leak below is invented for the page.
(() => {
  const esc = s => String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const cap = s => String(s).charAt(0).toUpperCase() + String(s).slice(1);
  const hash = s => { let h = 2166136261 >>> 0; for (const c of String(s)) { h ^= c.charCodeAt(0); h = Math.imul(h, 16777619) >>> 0; } return h >>> 0; };
  const rnd = (seed, parts) => { let h = seed >>> 0; return Array.from({ length: parts }, () => { h = (Math.imul(h, 1103515245) + 12345) >>> 0; return h; }); };
  const at = (list, b) => list[b % list.length];
  const B32 = 'abcdefghijklmnopqrstuvwxyz234567';
  const onionName = seed => {
    const b = rnd(seed, 16);
    let out = '';
    for (let i = 0; i < 16; i++) out += B32[b[i] % 32];
    return out + '.onion';
  };
  const money = n => '$' + Number(n).toFixed(2);
  const xmr = n => Number(n).toFixed(3) + ' XMR';
  const ago = (b, i) => ['2 minutes', '17 minutes', 'an hour', '3 hours', 'yesterday', '2 days', 'last week', '11 days'][(b[i % b.length] || 0) % 8] + ' ago';
  const hex = (b, n) => Array.from({ length: n }, (_, i) => (b[i % b.length] % 256).toString(16).padStart(2, '0')).join('');

  /* ---------------------------------------------------------------- vocabulary ------------------------------------------------------------- */
  const A_WORDS = ['Silent', 'Black', 'Iron', 'Night', 'Hollow', 'Dead', 'Grey', 'Copper', 'Salt', 'Ash', 'Cold', 'Rust', 'Fern', 'Static', 'Amber', 'Glass', 'Low', 'Zero', 'Warm', 'Pale'];
  const B_WORDS = ['Bazaar', 'Harbour', 'Exchange', 'Depot', 'Foundry', 'Ledger', 'Archive', 'Market', 'Bunker', 'Terminal', 'Yard', 'Circuit', 'Vault', 'Works', 'Commons', 'Relay', 'Annex', 'Signal'];
  const HANDLES = ['nullroute', 'kestrel', 'v0id', 'bitrot', 'palehorse', 'coldsolder', 'mothwing', 'glasshouses', 'tangent', 'quillon', 'lanternjaw', 'seventeen', 'postmortem', 'halfwatt', 'drywell', 'grimoire', 'saltmarsh', 'nocturne'];
  const CATS = [
    { id: 'docs', label: 'Documents & papers', items: ['Laminated identity kit', 'Residence permit, blank stock', 'Driving licence overlay set', 'Notarised diploma (unsigned)', 'Stamped tax envelope'] },
    { id: 'creds', label: 'Accounts & access', items: ['Streaming login bundle', 'Corporate VPN code', 'Loyalty points, 40k', 'Aged mailbox with recovery', 'Support portal session'] },
    { id: 'tools', label: 'Software & tools', items: ['Disk unlocker, portable', 'Keylogger, source included', 'AV-evasion build script', 'Router firmware, patched', 'SIM read/write utility'] },
    { id: 'data', label: 'Datasets', items: ['Retail customer extract, 90k rows', 'Vehicle registry slice', 'Call detail records, one week', 'Salary spreadsheet', 'Hospital appointment log'] },
    { id: 'goods', label: 'Counterfeit goods', items: ['Handbag, mirror quality', 'Banknote template, note grade', 'Designer watch, boxed', 'Tax stamp sheet', 'Serial plates, matching pair'] },
    { id: 'chem', label: 'Botanicals & pharma', items: ['Silver fern, 5 g sample', 'Amber vial, 10 ml', 'Blister strip of ten', 'Loose-leaf blend #4', 'Pressed tablets, 20 pack'] }
  ];
  const BOARDS = ['Introductions', 'Vendor reviews', 'Escrow disputes', 'Opsec & hygiene', 'Market talk', 'Seized services', 'Off-topic', 'Feature requests', 'Scam reports', 'Tutorials'];
  const TOPICS = ['Anyone still running a mirror of the old index?', 'Payout times are drifting again', 'How do you rotate a drop address?', 'This vendor asked for FE — walk away', 'Long-term storage of keys, in practice', 'Which mirrors are currently signed?', 'Heads up: a clone of this board exists', 'Removed a session, now nothing loads'];
  const HEADLINES = ['Mirror list re-signed after a week of silence', 'Two vendors quietly retired, bonds returned', 'Index drops listings that stopped answering', 'A clone copied this page down to the typo', 'Moderators lock a thread over a disputed payout', 'Backup domain returns after a seizure notice'];
  const ZINES = ['The Dead Drop', 'Onion Weekly', 'No Fixed Address', 'The Quiet Wire', 'Salt & Static', 'Ragged Signal'];
  const RADIO = ['Kestrel FM', 'Hollowwave', 'Nocturne Radio', 'Blackout Sessions', 'Saltmarsh Sound'];
  const TOOLS = ['OnionKit', 'TorKnow', 'Greybox Tools', 'Static Mirror', 'Ledgerless'];

  /* ---------------------------------------------------------------- design ---------------------------------------------------------------- */
  const PALETTES = [
    { bg: '#0b0d10', panel: '#12161c', ink: '#e7eaf0', mute: '#8f98a8', line: '#232a35', acc: '#7cc4ff', acc2: '#c7a8ff' },
    { bg: '#08110d', panel: '#0f1a14', ink: '#d8f3e2', mute: '#77a189', line: '#1c3226', acc: '#48e08b', acc2: '#9ff0c2' },
    { bg: '#120a0d', panel: '#1b1014', ink: '#f2e6e2', mute: '#a8868a', line: '#332026', acc: '#ff8a7a', acc2: '#ffc46b' },
    { bg: '#0a0e1a', panel: '#111830', ink: '#e4e9f7', mute: '#8592b4', line: '#1d2745', acc: '#8ea2ff', acc2: '#6ff0e0' },
    { bg: '#151007', panel: '#1f180c', ink: '#f4ecd9', mute: '#a8967a', line: '#3a2e17', acc: '#ffb454', acc2: '#ffe08a' },
    { bg: '#0d0b12', panel: '#161221', ink: '#ece6f5', mute: '#9a8fb0', line: '#2a2338', acc: '#c792ff', acc2: '#7fd1ff' },
    { bg: '#06090b', panel: '#0d1317', ink: '#cfe3e8', mute: '#7d96a1', line: '#1b2a31', acc: '#4fd6e8', acc2: '#a3f7c8' },
    { bg: '#111111', panel: '#191919', ink: '#ededed', mute: '#9a9a9a', line: '#2a2a2a', acc: '#ffffff', acc2: '#bbbbbb' }
  ];
  const TIERS = ['premium', 'premium', 'clean', 'clean', 'clean', 'shoddy', 'shoddy', 'broken'];
  const KINDS = [
    { id: 'market', label: 'Marketplace', icon: '🛒', market: true, tagline: 'Escrow only. Vendor bonds are posted before a listing goes up.' },
    { id: 'forum', label: 'Forum', icon: '💬', market: false, tagline: 'A board that has outlived three of its own mirrors.' },
    { id: 'paste', label: 'Paste & leaks', icon: '📄', market: false, tagline: 'Pastes expire. Copies do not.' },
    { id: 'news', label: 'Zine', icon: '📰', market: false, tagline: 'Written by people who will not name themselves.' },
    { id: 'radio', label: 'Stream', icon: '📻', market: false, tagline: 'Audio at 64 kbps, chat at whatever patience you have.' },
    { id: 'tools', label: 'Software mirror', icon: '🧰', market: false, tagline: 'Mirrors of tools that keep getting taken down elsewhere.' },
    { id: 'service', label: 'Service desk', icon: '🗂', market: true, tagline: 'Fixed-scope work, quoted per job, paid into escrow.' },
    { id: 'archive', label: 'Archive', icon: '🗄', market: false, tagline: 'An index of things someone thought should not be indexed.' },
    { id: 'search', label: 'Search engine', icon: '🔎', market: false, tagline: 'An index of the network, kept by somebody with a crawler and no legal advice.' },
    { id: 'mail', label: 'Mail', icon: '✉️', market: false, tagline: 'An account without a phone number, and a recovery process that is a sentence.' },
    { id: 'hosting', label: 'Hosting', icon: '🗄', market: true, tagline: 'Space that does not answer to a registrar, paid by the megabyte.' },
    { id: 'vpn', label: 'VPN', icon: '🛡', market: false, tagline: 'A tunnel out of the network, run by people who publish an audit once.' },
    { id: 'library', label: 'Library', icon: '📚', market: false, tagline: 'Books and papers, scanned badly, stored twice, complete anyway.' }
  ];

  function design(host, kindId) {
    const h = hash(host);
    const b = rnd(h, 48);
    /* palette, quality and type each come from their own hash of the address: drawing them from one LCG stream made
       the low bits line up, so every service desk was premium and every forum was clean */
    return {
      b, h,
      pal: PALETTES[hash('pal:' + host) % PALETTES.length],
      tier: TIERS[hash('tier:' + host) % TIERS.length],
      kind: (kindId && KINDS.find(x => x.id === kindId)) || KINDS[hash('kind:' + host) % KINDS.length],
      brand: at(A_WORDS, b[3]) + ' ' + at(B_WORDS, b[4]),
      handle: at(HANDLES, b[5]),
      tint: (b[6] % 360)
    };
  }

  /* ---------------------------------------------------------------- layouts --------------------------------------------------------------- */
  const baseCss = p =>
    'html,body{margin:0;background:' + p.bg + ';color:' + p.ink + '}' +
    'a{color:' + p.acc + ';text-decoration:none}a:hover{text-decoration:underline}' +
    'img{max-width:100%}table{border-collapse:collapse;width:100%}' +
    'th,td{text-align:left;padding:7px 9px;border-bottom:1px solid ' + p.line + ';vertical-align:top;font-size:13px}' +
    'th{color:' + p.mute + ';font-weight:600;font-size:11px;letter-spacing:.08em;text-transform:uppercase}' +
    'input,textarea,select{background:' + p.panel + ';border:1px solid ' + p.line + ';color:inherit;padding:8px 10px;font:inherit;border-radius:6px;width:100%;box-sizing:border-box}' +
    'button{background:' + p.acc + ';border:0;color:' + p.bg + ';padding:9px 15px;font:inherit;font-weight:600;border-radius:6px;cursor:pointer}' +
    'code,pre,kbd{font-family:"JetBrains Mono",Consolas,monospace}' +
    '.muted{color:' + p.mute + '}.small{font-size:12px}.tag{display:inline-block;padding:2px 7px;border:1px solid ' + p.line + ';border-radius:999px;font-size:11px;color:' + p.mute + '}' +
    /* the shoddy and broken tiers never styled these, so a hero's links ran together as one word */ +
    '.btnrow a{display:inline-block;margin:4px 10px 4px 0}.card{margin:6px 0}.card h3{margin:0 0 2px}';

  const tierCss = (tier, p) => {
    if (tier === 'premium') return baseCss(p) +
      'body{font:15px/1.65 ui-sans-serif,system-ui,-apple-system,"Segoe UI",Roboto,Helvetica,Arial,sans-serif;background:radial-gradient(900px 420px at 15% -10%,' + p.panel + ',' + p.bg + ' 60%)}' +
      '.top{position:sticky;top:0;z-index:3;display:flex;gap:18px;align-items:center;padding:14px 26px;border-bottom:1px solid ' + p.line + ';background:color-mix(in srgb,' + p.bg + ' 88%,transparent);backdrop-filter:blur(10px)}' +
      '.top b{font-size:16px;letter-spacing:.02em}.top nav{display:flex;gap:16px;margin-left:auto;font-size:13.5px}.top nav a{color:' + p.mute + '}.top nav a:hover{color:' + p.acc + '}' +
      '.wrap{max-width:1120px;margin:0 auto;padding:26px 26px 60px}' +
      '.hero{border:1px solid ' + p.line + ';border-radius:18px;padding:30px 30px 26px;background:linear-gradient(135deg,color-mix(in srgb,' + p.acc + ' 14%,' + p.panel + '),' + p.panel + ' 60%);box-shadow:0 24px 60px rgba(0,0,0,.35)}' +
      '.hero h1{font-size:32px;line-height:1.15;margin:0 0 10px;letter-spacing:-.02em}.hero p{margin:0;color:' + p.mute + ';max-width:66ch}' +
      '.btnrow{display:flex;gap:10px;flex-wrap:wrap;margin-top:20px}.btnrow a{display:inline-block;padding:10px 16px;border-radius:10px;border:1px solid ' + p.line + ';background:' + p.panel + ';font-size:13.5px}' +
      '.btnrow a.pri{background:' + p.acc + ';color:' + p.bg + ';border-color:' + p.acc + ';font-weight:650}' +
      '.grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(250px,1fr));gap:16px;margin:18px 0 8px}' +
      '.card{border:1px solid ' + p.line + ';border-radius:14px;background:' + p.panel + ';padding:16px;display:flex;flex-direction:column;gap:8px;transition:transform .15s,border-color .15s}' +
      '.card:hover{transform:translateY(-2px);border-color:' + p.acc + '}.card h3{margin:0;font-size:15px}.card .price{margin-top:auto;font-weight:700;color:' + p.acc2 + '}' +
      'h2{font-size:13px;letter-spacing:.14em;text-transform:uppercase;color:' + p.mute + ';margin:34px 0 6px}' +
      '.stat{display:flex;gap:26px;flex-wrap:wrap;margin:22px 0 0;padding-top:18px;border-top:1px solid ' + p.line + '}.stat div{font-size:12px;color:' + p.mute + '}.stat b{display:block;font-size:19px;color:' + p.ink + '}' +
      'footer{margin-top:46px;border-top:1px solid ' + p.line + ';padding-top:16px;color:' + p.mute + ';font-size:12px}';
    if (tier === 'clean') return baseCss(p) +
      'body{font:14px/1.6 Georgia,"Times New Roman",serif}' +
      '.top{display:flex;justify-content:space-between;align-items:baseline;padding:12px 20px;border-bottom:2px solid ' + p.line + ';background:' + p.panel + '}' +
      '.top b{letter-spacing:.16em;font-size:13px}.top nav a{margin-left:14px;font-size:12px;color:' + p.mute + '}' +
      '.wrap{max-width:880px;margin:0 auto;padding:20px 20px 50px}' +
      'h1{font-size:22px;margin:14px 0 8px}h2{font-size:12px;letter-spacing:.14em;text-transform:uppercase;color:' + p.mute + ';margin:28px 0 6px;border-bottom:1px solid ' + p.line + ';padding-bottom:5px}' +
      '.hero{border-left:3px solid ' + p.acc + ';padding:4px 0 4px 14px;margin:18px 0 22px}' +
      '.grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(240px,1fr));gap:12px}' +
      '.card{border:1px solid ' + p.line + ';background:' + p.panel + ';padding:12px}.card h3{margin:0 0 6px;font-size:14px}.card .price{color:' + p.acc2 + ';font-weight:700}' +
      'footer{margin-top:36px;border-top:1px solid ' + p.line + ';padding-top:12px;color:' + p.mute + ';font-size:11.5px}';
    if (tier === 'shoddy') return baseCss(p) +
      'body{font-family:"Comic Sans MS","Comic Sans",Papyrus,cursive;font-size:14px;background:' + p.bg + ' url("data:image/svg+xml;utf8,<svg xmlns=%22http://www.w3.org/2000/svg%22 width=%22120%22 height=%22120%22><rect width=%22120%22 height=%22120%22 fill=%22' + p.bg.replace('#', '%23') + '%22/><circle cx=%2260%22 cy=%2260%22 r=%2234%22 fill=%22none%22 stroke=%22' + p.line.replace('#', '%23') + '%22 stroke-width=%222%22/></svg>")}' +
      'a{color:#ffff00;font-weight:bold}a:visited{color:#ff7fd0}' +
      '.top{background:' + p.panel + ';border-bottom:4px double ' + p.acc + ';padding:8px;text-align:center}' +
      '.top b{font-size:22px;color:' + p.acc2 + ';text-shadow:2px 2px 0 #000;letter-spacing:-1px}' +
      '.top nav{margin-top:6px;font-size:13px}.top nav a{margin:0 6px}' +
      '.wrap{max-width:900px;margin:0 auto;padding:10px}' +
      '.hero{border:3px ridge ' + p.acc + ';background:' + p.panel + ';padding:10px;margin:12px 0;text-align:center}' +
      '.hero h1{margin:4px 0;font-size:26px;color:#00ff00;text-shadow:1px 1px 0 #000}' +
      '.grid{display:grid;grid-template-columns:1fr 1fr;gap:8px}' +
      '.card{border:2px dashed ' + p.acc2 + ';background:' + p.panel + ';padding:8px}.card h3{margin:0 0 4px;font-size:15px;color:#00ffff}' +
      'h2{color:#ff4040;font-size:18px;text-decoration:underline;margin:18px 0 6px}' +
      'marquee{display:block;border:1px dotted ' + p.mute + ';padding:4px;margin:8px 0;color:#ffff00}' +
      '.blink{animation:bk 1s steps(2,start) infinite}@keyframes bk{to{visibility:hidden}}' +
      'footer{margin-top:24px;font-size:11px;text-align:center;color:' + p.mute + ';border-top:2px groove ' + p.line + ';padding-top:8px}';
    /* broken: readable enough to use, unpleasant enough to believe */
    return baseCss(p) +
      'body{font:13px/1.35 "Courier New",Courier,monospace;background:#000;color:#9a9a9a}' +
      'a{color:#ff5555;text-decoration:underline}a:visited{color:#a050ff}' +
      '.top{padding:4px;border-bottom:1px solid #400;background:#0a0000;color:#ff0000;font-size:12px}' +
      '.top b{color:#ff2222}.top nav a{color:#ff6666;margin-left:7px;font-size:11px}' +
      '.wrap{max-width:960px;margin:0;padding:6px 8px 30px}' +
      '.hero{border:1px solid #300;background:#080000;padding:6px;margin:8px 0}' +
      '.hero h1{font-size:17px;margin:2px 0;color:#ff3333}' +
      'h2{color:#bb0000;font-size:13px;margin:16px 0 4px;border-bottom:1px dashed #400}' +
      '.grid{display:block}.card{border-bottom:1px dotted #333;padding:5px 0}.card h3{margin:0;font-size:12px;color:#dddddd}' +
      'table,td,th{font-size:11.5px;border-color:#222}th{color:#666;text-transform:none;letter-spacing:0}' +
      'footer{margin-top:20px;border-top:1px solid #300;padding-top:5px;font-size:10.5px;color:#666}' +
      '.warn{border:1px solid #700;background:#150000;color:#ff7777;padding:5px;margin:8px 0;font-size:11.5px}';
  };

  const notice = tier => tier === 'shoddy'
    ? '<marquee scrollamount="4">*** THIS ADDRESS IS TOR ONLY *** DO NOT USE A VPN AND TOR AT THE SAME TIME *** MIRROR LIST PINNED ***</marquee>'
    : tier === 'broken'
      ? '<div class="warn">mirror 2 is dead. mirror 3 untrusted. you are on mirror 1 (slow). signed: unknown.</div>'
      : '<p class="small muted">Tor only · signed by the operator · <span class="tag">mirror 1 of 3</span> <span class="tag">uptime ' + (92 + (Math.random() * 7 | 0)) + '%</span></p>';

  function frame(site, inner, opts) {
    const o = opts || {};
    const t = site.tier, p = site.pal;
    const nav = (site.menu || []).map(x => '<a href="' + esc(x[1]) + '">' + esc(x[0]) + '</a>').join('');
    return '<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">' +
      '<title>' + esc(o.title || site.brand) + ' · ' + esc(site.host) + '</title><style>' + tierCss(t, p) + '</style></head><body>' +
      '<div class="top"><b>' + esc(site.brand) + '</b><nav>' + nav + '</nav></div>' +
      '<div class="wrap">' + notice(t) + (o.banner || '') + inner +
      '<footer>' + esc(site.host) + ' · ' + esc(site.kind) + ' · this address is simulated inside Moundshroud; no hidden service was contacted.' +
      (t === 'shoddy' ? ' · visitors: <b>' + (1200 + (site.h % 8000)) + '</b> · <span class="blink">NEW!</span>' : '') +
      '</footer></div></body></html>';
  }

  /* ---------------------------------------------------------------- page bodies ------------------------------------------------------------- */
  function listingCards(site, items) {
    return '<div class="grid">' + items.map((it, i) =>
      '<div class="card"><div class="small muted">' + esc(it.cat) + '</div><h3><a href="/item/' + (i + 1) + '">' + esc(it.name) + '</a></h3>' +
      '<div class="small muted">' + esc(it.vendor) + ' · ★ ' + it.rating.toFixed(1) + ' · ' + esc(it.ships) + '</div>' +
      '<div class="price">' + esc(it.coin.toFixed(3)) + ' XMR <span class="small muted">(' + money(it.price) + ')</span></div></div>').join('') + '</div>';
  }

  function marketItems(site) {
    const b = site.design.b;
    return CATS.map((cat, ci) => at(cat.items, b[ci])).map((name, i) => ({
      name, cat: CATS[i].label, vendor: at(HANDLES, b[i + 9]) + (b[i] % 9),
      price: 24 + (b[i] % 320) + (b[i] % 7) / 10, coin: 0.12 + (b[i] % 400) / 100, rating: 3.6 + (b[i] % 14) / 10,
      ships: ['EU · 3–6 days', 'worldwide · 7–14 days', 'domestic · 2–4 days', 'drop box · 5 days'][i % 4]
    }));
  }

  function homeBody(site, path, query) {
    const d = site.design, b = d.b, k = d.kind.id, t = d.tier;
    if (k === 'market' || k === 'service') {
      const items = site.items;
      return '<div class="hero"><h1>' + esc(site.brand) + '</h1><p>' + esc(site.tagline || d.kind.tagline) + ' ' + (t === 'shoddy' ? 'Best prices on the whole network!! No FE ever!!' : 'Every vendor posts a bond before a single listing goes live, and escrow releases only when the buyer finalises.') + '</p>' +
        '<div class="btnrow"><a class="pri" href="/catalog">Browse ' + items.length + ' listings</a><a href="/rules">Rules</a><a href="/pgp.txt">Operator key</a></div>' +
        (t === 'premium' ? '<div class="stat"><div><b>' + (site.h % 900 + 120) + '</b>vendors</div><div><b>' + (site.h % 40 + 6) + 'k</b>orders</div><div><b>' + (3 + site.h % 8) + ' min</b>median payout</div><div><b>0.4%</b>dispute rate</div></div>' : '') +
        '</div>' +
        '<h2>Featured listings</h2>' + listingCards(site, items.slice(0, 6)) +
        (t === 'shoddy' ? '<marquee behavior="alternate" scrollamount="6">★ ★ ★ 100% LEGIT ★ ★ ★ TELL YOUR FRIENDS ★ ★ ★</marquee>' : '') +
        '<h2>Recent feedback</h2><table><tr><th>Buyer</th><th>Vendor</th><th>Rating</th><th>Comment</th></tr>' +
        /* this used to read `a + [..][0,0] === undefined ? '' : b`, and the ternary swallowed the whole page above it */
        ['arrived in four days, decoy invoice was a nice touch', 'escrow held until I confirmed, no complaints', 'stealth was fine, weight was short by a gram', 'vendor answered in twenty minutes at 3am', 'second order, same packaging, still fine'].map((c, i) =>
          '<tr><td>' + esc(at(HANDLES, b[i + 2])) + '</td><td>' + esc(at(HANDLES, b[i + 5])) + '</td><td>★ ' + (4 + (b[i] % 10) / 10).toFixed(1) + '</td><td class="small">' + esc(c) + '</td></tr>').join('') + '</table>';
    }
    if (k === 'forum') {
      return '<div class="hero"><h1>' + esc(d.brand) + '</h1><p>' + esc(d.kind.tagline) + '</p></div>' +
        '<h2>Boards</h2><table><tr><th>Board</th><th>Threads</th><th>Posts</th><th>Last post</th></tr>' +
        BOARDS.map((name, i) => '<tr><td><a href="/board/' + i + '">' + esc(name) + '</a></td><td>' + (40 + b[i] % 900) + '</td><td>' + (300 + b[i] % 12000) + '</td><td class="muted small">' + esc(at(HANDLES, b[i + 1])) + ' · ' + ago(b, i) + '</td></tr>').join('') + '</table>' +
        '<h2>Recent threads</h2>' + TOPICS.map((topic, i) => '<div class="card"><h3><a href="/thread/' + (i + 1) + '">' + esc(topic) + '</a></h3><div class="small muted">' + esc(at(HANDLES, b[i + 4])) + ' · ' + (2 + b[i] % 60) + ' replies · ' + ago(b, i + 3) + '</div></div>').join('');
    }
    if (k === 'paste') {
      return '<div class="hero"><h1>' + esc(d.brand) + '</h1><p>' + esc(d.kind.tagline) + '</p></div>' +
        '<form action="/" method="get" style="display:flex;gap:8px;margin:14px 0"><input name="q" value="' + esc(String(query.get('q') || '')) + '" placeholder="search pastes"><button>Search</button></form>' +
        '<h2>Recent pastes</h2><table><tr><th>Title</th><th>Syntax</th><th>Size</th><th>Expires</th><th>Posted</th></tr>' +
        ['accounts.sql', 'handover.txt', 'invoice-scan-index.csv', 'notes from a meeting', 'access.log', 'keys.asc', 'customers-90k.tsv', 'README', 'dump.b64', 'changelog.md'].map((name, i) =>
          '<tr><td><a href="/paste/' + (i + 1) + '">' + esc(name) + '</a></td><td class="muted">' + at(['text', 'sql', 'csv', 'json', 'pgp'], b[i]) + '</td><td class="muted">' + (1 + b[i] % 900) + ' KB</td><td class="muted">' + at(['1 day', '3 days', 'never', '12 hours'], b[i + 2]) + '</td><td class="muted">' + ago(b, i) + '</td></tr>').join('') + '</table>';
    }
    if (k === 'news') {
      return '<div class="hero"><h1>' + esc(site.brand) + '</h1><p>' + esc(d.kind.tagline) + '</p></div>' +
        '<h2>This week</h2>' + HEADLINES.map((h, i) => '<div class="card"><h3><a href="/article/' + (i + 1) + '">' + esc(h) + '</a></h3><div class="small muted">' + esc(at(HANDLES, b[i + 8])) + ' · ' + ago(b, i + 2) + '</div></div>').join('') +
        '<h2>From the wire</h2><p class="small muted">Mirrors change weekly. Anything that asks for a fee to keep an index alive is either desperate or a clone — sometimes both.</p>';
    }
    if (k === 'radio') {
      return '<div class="hero"><h1>' + esc(site.brand) + '</h1><p>' + esc(d.kind.tagline) + ' Currently playing: <b>' + esc(at(['a set recorded in a basement', 'AM-quality dub', 'an hour of static and piano', 'someone reading a manual', 'field recordings from a ferry'], b[10])) + '</b></p>' +
        '<div class="btnrow"><a class="pri" href="/listen">▶ Play stream</a><a href="/chat">Open chat</a></div></div>' +
        '<h2>Schedule</h2><table><tr><th>Time</th><th>Show</th><th>Host</th></tr>' +
        ['00:00', '03:00', '09:00', '14:00', '20:00'].map((time, i) => '<tr><td class="muted">' + time + ' UTC</td><td>' + esc(at(['Night Shift', 'Dead Air', 'The Quiet Hour', 'Swap Shop', 'No Signal'], b[i])) + '</td><td class="muted">' + esc(at(HANDLES, b[i + 3])) + '</td></tr>').join('') + '</table>';
    }
    if (k === 'tools') {
      return '<div class="hero"><h1>' + esc(site.brand) + '</h1><p>' + esc(d.kind.tagline) + '</p></div>' +
        '<h2>Mirrored builds</h2><table><tr><th>Tool</th><th>Version</th><th>Size</th><th>SHA-256</th></tr>' +
        ['onion-router', 'keyring', 'disk-crypt', 'session-wipe', 'mail-relay', 'hash-check'].map((name, i) =>
          '<tr><td><a href="/download/' + name + '">' + esc(name) + '</a></td><td class="muted">' + (1 + b[i] % 9) + '.' + (b[i] % 20) + '.' + (b[i] % 7) + '</td><td class="muted">' + (1 + b[i] % 60) + ' MB</td><td class="small muted">' + esc(hex(b, 8)) + '…</td></tr>').join('') + '</table>' +
        '<p class="small muted">Verify the signature before running anything you downloaded through a mirror. A mirror is a courier, not an author.</p>';
    }
    if (k === 'search') {
      const term = String(query.get('q') || '').trim();
      const hits = [
        ['Nightfall Market', '/result/1', 'escrow, vendor bonds, signed mirrors'],
        ['The Hidden Wiki', '/result/2', 'the directory of directories'],
        ['WikiLeaks mirror', '/result/3', 'cablegate and the war logs'],
        ['Torch archive', '/result/4', 'an index of an index, 2019 edition'],
        ['Onion Forum', '/result/5', 'a board that has outlived three mirrors'],
        ['Deep Leaks', '/result/6', 'documents with the names left in']
      ];
      return '<div class="hero"><h1>' + esc(d.brand) + '</h1><p>' + esc(d.kind.tagline) + '</p>' +
        '<form action="/" method="get" style="display:flex;gap:8px;margin-top:14px"><input name="q" value="' + esc(term) + '" placeholder="search the network"><button>Search</button></form>' +
        '<div class="stat"><div><b>' + (12000 + b[1] % 90000) + '</b>addresses indexed</div><div><b>' + (2 + b[2] % 9) + ' days</b>since last crawl</div><div><b>' + (60 + b[3] % 39) + '%</b>answered</div></div></div>' +
        (term ? '<h2>Results for “' + esc(term) + '”</h2><table><tr><th>Result</th><th>Address</th><th>Snippet</th></tr>' +
          hits.map((x, i) => '<tr><td><a href="' + x[1] + '">' + esc(x[0]) + '</a></td><td class="small muted">' + esc(onionName(hash(x[0] + term)) + '.onion') + '</td><td class="small muted">' + esc(x[2]) + '</td></tr>').join('') + '</table>'
          : '<h2>How this index works</h2><p class="small muted">A crawler walks addresses it is given, keeps the ones that answer, and drops the rest after a month. It does not verify what a page claims to be; it only records that it answered.</p><p class="small muted"><a href="/sources">Sources</a> · <a href="/add">Submit an address</a></p>');
    }
    if (k === 'mail') {
      return '<div class="hero"><h1>' + esc(d.brand) + '</h1><p>' + esc(d.kind.tagline) + '</p>' +
        '<div class="btnrow"><a class="pri" href="/login">Sign in</a><a href="/compose">Compose</a><a href="/pgp.txt">Service key</a></div></div>' +
        '<h2>Inbox — ' + esc(at(HANDLES, b[2])) + '</h2><table><tr><th>From</th><th>Subject</th><th>Received</th></tr>' +
        ['mirror list, unsigned — do not use', 'your account will be removed in 14 days', 're: the file you asked about', 'invoice, and a change of address', 'someone is asking about you on the board', 'welcome: read this once'].map((s, i) =>
            '<tr><td class="small">' + esc(at(HANDLES, b[i + 4])) + '</td><td><a href="/mail/' + (i + 1) + '">' + esc(s) + '</a></td><td class="small muted">' + ago(b, i) + '</td></tr>').join('') + '</table>' +
        '<p class="small muted">Mail is stored encrypted with a key we hold. That sentence is the whole privacy policy.</p>';
    }
    if (k === 'hosting') {
      return '<div class="hero"><h1>' + esc(d.brand) + '</h1><p>' + esc(d.kind.tagline) + '</p>' +
        '<div class="btnrow"><a class="pri" href="/plans">See plans</a><a href="/create">Create a service</a><a href="/rules">Acceptable use</a></div></div>' +
        '<h2>Plans</h2><table><tr><th>Plan</th><th>Disk</th><th>Bandwidth</th><th>Price</th></tr>' +
        [['small', '512 MB', '20 GB', '0.004 XMR'], ['medium', '4 GB', '200 GB', '0.021 XMR'], ['large', '40 GB', '2 TB', '0.140 XMR']].map((x, i) =>
          '<tr><td><a href="/plans">' + x[0] + '</a></td><td class="muted">' + x[1] + '</td><td class="muted">' + x[2] + '</td><td>' + x[3] + '</td></tr>').join('') + '</table>' +
        '<p class="small muted">Uptime counter: ' + (90 + b[4] % 10) + '.2% over ' + (2 + b[5] % 7) + ' years. One outage, ' + (2019 + b[6] % 6) + ', four hours, unexplained.</p>';
    }
    if (k === 'vpn') {
      return '<div class="hero"><h1>' + esc(d.brand) + '</h1><p>' + esc(d.kind.tagline) + '</p>' +
        '<div class="btnrow"><a class="pri" href="/servers">Servers</a><a href="/account">Account number</a><a href="/audit">Audit</a></div></div>' +
        '<h2>Exit nodes</h2><table><tr><th>Country</th><th>City</th><th>Load</th><th>Ping</th></tr>' +
        [['SE', 'Malmö', 41, 38], ['CH', 'Zürich', 55, 44], ['IS', 'Reykjavík', 22, 61], ['NL', 'Amsterdam', 78, 29], ['RO', 'Cluj', 33, 52]].map((x, i) =>
          '<tr><td>' + x[0] + '</td><td class="muted">' + x[1] + '</td><td class="muted">' + x[2] + '%</td><td class="muted">' + x[3] + ' ms</td></tr>').join('') + '</table>' +
        '<p class="small muted">No account e-mail, no logs for longer than the session, and a warrant canary signed every Monday. The canary was last signed ' + (1 + b[7] % 5) + ' days ago.</p>';
    }
    if (k === 'library') {
      return '<div class="hero"><h1>' + esc(d.brand) + '</h1><p>' + esc(d.kind.tagline) + '</p>' +
        '<form action="/" method="get" style="display:flex;gap:8px;margin-top:12px"><input name="q" value="' + esc(String(query.get('q') || '')) + '" placeholder="title, author or DOI"><button>Search</button></form></div>' +
        '<h2>Recently added</h2><table><tr><th>Title</th><th>Format</th><th>Size</th><th>Added</th></tr>' +
        [['A Manual for the Care of Small Machines', 'epub', '1.4 MB'], ['The Index of Everything We Lost', 'pdf', '8.1 MB'], ['Reports from a Working Group', 'pdf', '0.9 MB'], ['On the Keeping of Records', 'epub', '0.6 MB'], ['Field Notes, 1974-1981', 'djvu', '12 MB']].map((x, i) =>
          '<tr><td><a href="/book/' + (i + 1) + '">' + esc(x[0]) + '</a></td><td class="muted">' + x[1] + '</td><td class="muted">' + x[2] + '</td><td class="small muted">' + ago(b, i) + '</td></tr>').join('') + '</table>' +
        '<p class="small muted">Scanned by volunteers. If a page is missing, the request queue is on /about, and the queue is long.</p>';
    }
    /* archive */
    return '<div class="hero"><h1>' + esc(site.brand) + '</h1><p>' + esc(site.tagline || d.kind.tagline) + '</p>' +
      '<form action="/" method="get" style="display:flex;gap:8px;margin-top:12px"><input name="q" value="' + esc(String(query.get('q') || '')) + '" placeholder="search the archive"><button>Search</button></form></div>' +
      '<h2>Collections</h2><table><tr><th>Collection</th><th>Records</th><th>Updated</th></tr>' +
      ['corporate filings', 'leaked mailboxes', 'camera indexes', 'registries', 'forum backups', 'invoices'].map((name, i) =>
        '<tr><td><a href="/collection/' + i + '">' + esc(name) + '</a></td><td class="muted">' + (1000 * (1 + b[i] % 90)) + '</td><td class="muted">' + ago(b, i) + '</td></tr>').join('') + '</table>';
  }

  function innerPage(site, path, query) {
    const d = site.design, b = d.b;
    if (path === '/pgp.txt') {
      return '-----BEGIN PGP PUBLIC KEY BLOCK-----\nComment: ' + d.brand + ' <' + site.host + '> — simulated key\n\n' +
        hex(b, 96).replace(/(.{64})/g, '$1\n') + '\n-----END PGP PUBLIC KEY BLOCK-----\n';
    }
    if (path === '/about') return frame(site, '<h1>About</h1><p class="muted">' + esc(d.brand) + ' has been up since ' + (2019 + b[3] % 6) + ', on ' + (1 + b[4] % 4) + ' mirrors, run by ' + (1 + b[5] % 3) + ' people who do not use their own handles in public.</p><p>We do not take advertising. We do not log. We will not answer a request from anyone who cannot sign with a key we already hold.</p>', { title: 'About' });
    if (path === '/rules') return frame(site, '<h1>Rules</h1><ol>' +
      ['Escrow only. Finalise-early offers are removed, not argued about.', 'No listings of anything aimed at a child. That is the line and it does not move.', 'Vendor bonds are posted before a listing appears, and returned only after a clean month.', 'One account per vendor. A clone is banned on sight and named on the board.', 'Disputes are read by the moderators, in order, with the escrow record open.'].map(x => '<li>' + esc(x) + '</li>').join('') + '</ol>', { title: 'Rules' });
    if (path === '/contact') return frame(site, '<h1>Contact</h1><p class="muted">Encrypt to the key at /pgp.txt. Unsigned mail is deleted unread.</p><form action="/contact" method="post"><label>From</label><input name="from" placeholder="your handle or key id"><label>Message</label><textarea name="body" rows="6" placeholder="signed message"></textarea><p><button>Send</button></p></form>', { title: 'Contact' });
    const item = /^\/item\/(\d+)$/.exec(path);
    if (item) {
      const i = Math.max(0, Math.min(site.items.length - 1, Number(item[1]) - 1));
      const it = site.items[i] || site.items[0];
      return frame(site, '<h1>' + esc(it.name) + '</h1><p class="muted small">' + esc(it.cat) + ' · vendor ' + esc(it.vendor) + ' · ships ' + esc(it.ships) + '</p>' +
        '<p class="muted">' + esc(d.kind.tagline) + ' Escrow holds the payment until you finalise; a missing delivery is refunded after 21 days.</p>' +
        '<p><b style="font-size:20px">' + esc(it.coin.toFixed(3)) + ' XMR</b> <span class="muted">(' + money(it.price) + ')</span> · stock ' + (3 + b[2] % 40) + '</p>' +
        '<form action="/cart" method="post"><input type="hidden" name="id" value="' + (i + 1) + '"><p><button>Add to cart</button></p></form>' +
        '<h2>Vendor</h2><table><tr><th>Bond</th><th>Joined</th><th>Sales</th><th>Rating</th><th>PGP</th></tr><tr><td>' + (2 + b[3] % 12) + '.' + (b[3] % 9) + ' XMR</td><td>' + (2021 + b[4] % 4) + '</td><td>' + (200 + b[5] % 8000) + '</td><td>★ ' + it.rating.toFixed(1) + '</td><td class="small">' + esc(hex(b, 4).toUpperCase()) + '…</td></tr></table>', { title: it.name });
    }
    const thread = /^\/thread\/(\d+)$/.exec(path);
    if (thread) {
      const i = Math.max(0, Number(thread[1]) - 1);
      const topic = TOPICS[i % TOPICS.length];
      return frame(site, '<h1>' + esc(topic) + '</h1>' + Array.from({ length: 4 }, (_, k) =>
        '<div class="card"><div class="small muted">' + esc(at(HANDLES, b[k + i])) + ' · ' + ago(b, k + i) + (k === 0 ? ' · original poster' : '') + '</div>' +
        '<p>' + esc([
          'Same question every few months. The answer has not changed: use a mirror that is signed, and check the signature.',
          'Mine took nine days and the payout was held for two more. Not a scam, just slow.',
          'If a vendor asks you to finalise early, that is the whole scam. Report it on the board.',
          'Works fine here. Rotate addresses between orders and stop reusing handles.'
        ][k]) + '</p></div>').join(''), { title: topic });
    }
    const board = /^\/board\/(\d+)$/.exec(path);
    if (board) {
      const name = BOARDS[Number(board[1]) % BOARDS.length];
      return frame(site, '<h1>' + esc(name) + '</h1>' + TOPICS.slice(0, 6).map((topic, i) =>
        '<div class="card"><h3><a href="/thread/' + (i + 1) + '">' + esc(topic) + '</a></h3><div class="small muted">' + esc(at(HANDLES, b[i + 1])) + ' · ' + (2 + b[i] % 40) + ' replies</div></div>').join(''), { title: name });
    }
    if (path === '/catalog') {
      return frame(site, '<h1>All listings</h1><p class="small muted">' + site.items.length + ' listings, ' + (6 + b[1] % 20) + ' vendors, escrow only.</p>' + listingCards(site, site.items), { title: 'Catalog' });
    }
    if (path === '/cart') return frame(site, '<h1>Cart</h1><p class="muted">' + (query.get('id') ? 'One item added.' : 'Your cart is empty.') + ' Escrow is created when you check out; the vendor sees only the escrow id.</p><p><a href="/catalog">← back to listings</a></p>', { title: 'Cart' });
    const paste = /^\/paste\/(\d+)$/.exec(path);
    if (paste) {
      const name = ['accounts.sql', 'handover.txt', 'invoice-scan-index.csv', 'notes', 'access.log', 'keys.asc', 'customers-90k.tsv', 'README', 'dump.b64', 'changelog.md'][(Number(paste[1]) + b[0]) % 10];
      const body = Array.from({ length: 14 }, (_, i) => (i + 1) + '  ' + at(['|', '>', '-', '*'], b[i]) + ' ' + hex(b, 6) + '  ' + at(['id', 'user', 'mail', 'region', 'amount', 'status', 'ts', 'host'], b[i + 1]) + '=' + at(['1842', '0x7f', 'active', 'pending', '10.14.7.9', '2026-02-11', 'root'], b[i + 2])).join('\n');
      return frame(site, '<h1>' + esc(name) + '</h1><p class="small muted">' + (1 + b[2] % 900) + ' KB · expires ' + at(['in 1 day', 'in 12 hours', 'never', 'in 3 days'], b[3]) + '</p><pre style="white-space:pre-wrap;border:1px solid ' + site.pal.line + ';padding:12px">' + esc(body) + '</pre>', { title: name });
    }
    const article = /^\/article\/(\d+)$/.exec(path);
    if (article) {
      const h = HEADLINES[(Number(article[1]) - 1 + b[2]) % HEADLINES.length];
      return frame(site, '<h1>' + esc(h) + '</h1><p class="small muted">' + esc(site.brand) + ' · ' + ago(b, 2) + '</p>' +
        '<p>Three mirrors stopped answering on Tuesday and came back by Thursday with the same signing key. Nobody has explained the gap, and the operators say there is nothing to explain.</p>' +
        '<p>What matters for readers is smaller than it sounds: an index that keeps listing a dead address is worse than a short index, because a dead address is where a clone sits waiting.</p>' +
        '<p class="small muted">Signed with the zine key. Verify it against a copy you already have.</p>', { title: h });
    }
    if (path === '/listen') return frame(site, '<h1>Now playing</h1><p class="muted">A 64 kbps stream from a machine somebody keeps in a cupboard.</p><pre style="border:1px solid ' + site.pal.line + ';padding:12px">▶ 00:14:52  ' + esc(at(['night shift, part 3', 'a set recorded on a ferry', 'static and piano', 'someone reading a manual'], b[4])) + '\n   listeners: ' + (3 + b[5] % 200) + '   buffer: 4s   codec: opus</pre>', { title: 'Listen' });
    if (path === '/chat') return frame(site, '<h1>Chat</h1>' + Array.from({ length: 6 }, (_, i) => '<div class="card"><div class="small muted">' + esc(at(HANDLES, b[i])) + ' · ' + ago(b, i) + '</div><p class="small">' + esc(at(['anyone else getting a 502 from mirror 3?', 'back now', 'the playlist is up on the paste board', 'who runs this? nobody', 'sound is clipping again', 'recording tonight, links after'], b[i + 3])) + '</p></div>').join(''), { title: 'Chat' });
    if (path === '/download/' + path.split('/').pop()) {
      return 'binary (simulated) — ' + path.split('/').pop() + '\nsha256 ' + hex(b, 32) + '\n';
    }
    /* ---- the pages the search, mail, hosting, VPN and library templates link to ---- */
    const result = /^\/result\/(\d+)$/.exec(path);
    if (result) {
      const names = ['Nightfall Market', 'The Hidden Wiki', 'WikiLeaks mirror', 'Torch archive', 'Onion Forum', 'Deep Leaks'];
      const n = Math.min(names.length - 1, Math.max(0, Number(result[1]) - 1));
      return frame(site, '<h1>' + esc(names[n]) + '</h1><p class="small muted">' + esc(onionName(hash(names[n])) + '.onion') + ' · indexed ' + ago(b, n) + ' · answers</p>' +
        '<p>' + esc('A result is a record that an address answered a crawler on a date. It is not a recommendation, a verification or an introduction. The page may have changed hands since.') + '</p>' +
        '<p class="small muted">Crawled ' + (2 + b[n] % 60) + ' times. Last three responses: 200, 200, 502.</p>' +
        '<h2>Mirrors the crawler saw</h2><table><tr><th>Address</th><th>First seen</th><th>Last seen</th></tr>' +
        [0, 1, 2].map(i => '<tr><td class="small">' + esc(onionName(hash(names[n] + i)) + '.onion') + '</td><td class="small muted">' + (2019 + i) + '</td><td class="small muted">' + ago(b, i + n) + '</td></tr>').join('') + '</table>', { title: names[n] });
    }
    if (path === '/sources') {
      return frame(site, '<h1>Sources</h1><p class="muted">The index is built from four things: addresses submitted by visitors, addresses copied from other indexes, addresses found in pastes, and the crawl itself.</p>' +
        '<table><tr><th>Source</th><th>Addresses</th><th>Kept</th></tr>' +
        [['visitor submissions', '2,104', '31%'], ['other indexes', '9,880', '12%'], ['pastes and dumps', '1,442', '44%'], ['the crawler', '88,112', '6%']].map(x => '<tr><td>' + x[0] + '</td><td class="muted">' + x[1] + '</td><td class="muted">' + x[2] + '</td></tr>').join('') + '</table>', { title: 'Sources' });
    }
    if (path === '/add') return frame(site, '<h1>Submit an address</h1><p class="muted">A crawler will try it once. If it answers, it is listed with the date and nothing else.</p><form action="/add" method="post"><label>Address</label><input name="addr" placeholder="xxxxxxxxxxxxxxxx.onion"><label>What it is, in one sentence</label><input name="what"><p><button>Submit</button></p></form>', { title: 'Submit' });
    const mail = /^\/mail\/(\d+)$/.exec(path);
    if (mail) {
      const subjects = ['mirror list, unsigned — do not use', 'your account will be removed in 14 days', 're: the file you asked about', 'invoice, and a change of address', 'someone is asking about you on the board', 'welcome: read this once'];
      const n = Math.min(subjects.length - 1, Math.max(0, Number(mail[1]) - 1));
      return frame(site, '<h1>' + esc(subjects[n]) + '</h1><p class="small muted">from ' + esc(at(HANDLES, b[n])) + ' · ' + ago(b, n) + ' · no signature</p>' +
        '<p>' + esc([
          'Three new mirrors, none of them signed. I am sending them because two of the old ones stopped answering, not because I know who runs these.',
          'Accounts that have not signed in for ninety days are being removed. There is no export. If you want the mail, take it now.',
          'The file is 400 MB and it is not on this server. Ask on the board and somebody will paste a link that works for a day.',
          'The price changed because the host changed. New address below. Old invoices are void, and the old key is not ours any more.',
          'I am not going to repeat what the thread says. Read it yourself and decide whether you want to be the fourth name in it.',
          'Read this once: no recovery questions, no password reset, no support. The account is the passphrase and nothing else.'
        ][n]) + '</p><p class="small muted"><a href="/">← inbox</a></p>', { title: subjects[n] });
    }
    if (path === '/login') return frame(site, '<h1>Sign in</h1><form action="/login" method="post"><label>Address</label><input name="user" placeholder="name@' + esc(site.host) + '"><label>Passphrase</label><input name="pass" type="password"><p><button>Sign in</button></p></form><p class="small muted">No recovery. A lost passphrase is a lost mailbox, on purpose.</p>', { title: 'Sign in' });
    if (path === '/compose') return frame(site, '<h1>Compose</h1><form action="/compose" method="post"><label>To</label><input name="to"><label>Subject</label><input name="subject"><label>Message</label><textarea name="body" rows="8"></textarea><p><button>Send</button></p></form><p class="small muted">Attachments over 10 MB are refused. Nothing is scanned, which is the point and the problem.</p>', { title: 'Compose' });
    if (path === '/plans') return frame(site, '<h1>Plans</h1><table><tr><th>Plan</th><th>Disk</th><th>Bandwidth</th><th>Price</th><th>Notes</th></tr>' +
      [['small', '512 MB', '20 GB', '0.004 XMR', 'static pages only'], ['medium', '4 GB', '200 GB', '0.021 XMR', 'one domain, one cron job'], ['large', '40 GB', '2 TB', '0.140 XMR', 'we will ask what it is for']].map(x => '<tr><td>' + x[0] + '</td><td class="muted">' + x[1] + '</td><td class="muted">' + x[2] + '</td><td>' + x[3] + '</td><td class="small muted">' + x[4] + '</td></tr>').join('') + '</table><p class="small muted"><a href="/create">Create a service</a></p>', { title: 'Plans' });
    if (path === '/create') return frame(site, '<h1>Create a service</h1><form action="/create" method="post"><label>Desired name</label><input name="name" placeholder="ten characters, no meaning"><label>Plan</label><input name="plan" value="medium"><label>What will it host</label><textarea name="what" rows="4"></textarea><p><button>Create</button></p></form><p class="small muted">We read the last box. That is not a formality.</p>', { title: 'Create' });
    if (path === '/servers') return frame(site, '<h1>Servers</h1><table><tr><th>Country</th><th>City</th><th>Load</th><th>Ping</th><th>Owned by</th></tr>' +
      [['SE', 'Malmö', 41, 38, 'us'], ['CH', 'Zürich', 55, 44, 'a cooperative'], ['IS', 'Reykjavík', 22, 61, 'us'], ['NL', 'Amsterdam', 78, 29, 'a reseller'], ['RO', 'Cluj', 33, 52, 'a reseller']].map(x => '<tr><td>' + x[0] + '</td><td class="muted">' + x[1] + '</td><td class="muted">' + x[2] + '%</td><td class="muted">' + x[3] + ' ms</td><td class="small muted">' + x[4] + '</td></tr>').join('') + '</table><p class="small muted"><a href="/audit">Audit</a></p>', { title: 'Servers' });
    if (path === '/account') return frame(site, '<h1>Account number</h1><p class="muted">Your account is a twelve-digit number and nothing else. There is no name, no e-mail and no payment history you can read.</p><pre style="border:1px solid ' + site.pal.line + ';padding:12px">account: ' + (100000 + b[8] % 899999) + '\nplan:    ' + at(['small', 'medium', 'large'], b[9]) + '\nexpires: ' + (2026 + b[10] % 3) + '-' + String(1 + b[11] % 12).padStart(2, '0') + '-01</pre><p class="small muted"><a href="/">← back</a></p>', { title: 'Account' });
    if (path === '/audit') return frame(site, '<h1>Audit</h1><p class="muted">Published once, in 2023, by a firm that has not audited anything since. The report is eleven pages and the first nine are methodology.</p><p class="small muted">Finding: no traffic logs are kept beyond the session. Finding: the two reseller-operated nodes were not audited. Recommendation: do not use the reseller nodes.</p>', { title: 'Audit' });
    const book = /^\/book\/(\d+)$/.exec(path);
    if (book) {
      const titles = ['A Manual for the Care of Small Machines', 'The Index of Everything We Lost', 'Reports from a Working Group', 'On the Keeping of Records', 'Field Notes, 1974-1981'];
      const n = Math.min(titles.length - 1, Math.max(0, Number(book[1]) - 1));
      const para = [
        'Chapter one is about bearings. Chapter two is about the noise a bearing makes before it fails, which the author insists is a language and not a symptom.',
        'The index lists ten thousand things that no longer exist, in alphabetical order, with the date each was last seen and the name of the person who noticed.',
        'A working group was asked whether the archive should keep the names. It reported that the names were already in four other archives and recommended doing nothing.',
        'The argument is simple: a record kept badly is still a record, and a record destroyed carefully is still a destruction. Everything after page forty is a defence of that sentence.',
        'Forty-two pages of weather, three pages of birds, one page that is only a telephone number, crossed out twice.'
      ][n];
      return frame(site, '<h1>' + esc(titles[n]) + '</h1><p class="small muted">scanned copy · ' + (1968 + b[n] % 50) + ' · ' + (120 + b[n + 1] % 400) + ' pages · OCR corrected by hand</p>' +
        '<p>' + esc(para) + '</p><p class="small muted">Excerpt, page ' + (7 + b[n] % 60) + '. The scan is 300 dpi and the right margin is cut off on every even page.</p>' +
        '<p><a href="/">← back to the shelf</a></p>', { title: titles[n] });
    }
    if (/^\/collection\//.test(path)) return frame(site, '<h1>' + esc(cap(path.split('/').pop()) + ' collection') + '</h1><p class="muted">' + (1000 * (1 + b[1] % 90)) + ' records, updated ' + ago(b, 1) + '.</p><table><tr><th>Record</th><th>Fields</th><th>Covers</th></tr>' +
      ['batch 1', 'batch 2', 'batch 3'].map((x, i) => '<tr><td>' + x + '</td><td class="muted">' + (4 + b[i] % 20) + '</td><td class="muted">' + (1000 + b[i] % 9000) + '</td></tr>').join('') + '</table>', { title: 'Collection' });
    return null;
  }

  /* ---------------------------------------------------------------- one site --------------------------------------------------------------- */
  function makeSite(host, kindId) {
    const d = design(host, kindId);
    const site = {
      dark: true, host: String(host).toLowerCase(), brand: d.brand, icon: d.kind.icon,
      kind: d.kind.label, topic: d.kind.id + ' hidden service', region: 'Onion space',
      market: !!d.kind.market, tagline: d.kind.tagline,
      bg: d.pal.bg, ink: d.pal.ink, link: d.pal.acc, line: d.pal.line, field: d.pal.panel,
      btn: d.pal.panel, btnInk: d.pal.ink, mute: d.pal.mute, accent: d.pal.acc,
      design: d, pal: d.pal, tier: d.tier, quality: d.tier
    };
    site.items = marketItems(site);
    site.menu = [['Home', '/'], ['About', '/about'], ['Rules', '/rules'], ['PGP', '/pgp.txt'], ['Contact', '/contact']];
    site.v3 = onionName(hash(host + ':v3')) + '';
    site.render = (path, query) => {
      const p = String(path || '/');
      const q = query instanceof URLSearchParams ? query : new URLSearchParams(String(query || ''));
      let inner = p === '/' ? homeBody(site, p, q) : innerPage(site, p, q);
      /* the home bodies are content only: they go inside the page chrome for their quality tier */
      if (typeof inner === 'string' && !/^<!doctype/i.test(inner) && !/^(?:-----BEGIN|binary )/.test(inner)) inner = frame(site, inner, { title: site.brand });
      if (inner == null) {
        if (/\.(?:txt|log|json|csv|sql|asc)$/.test(p)) return { status: 200, type: 'text/plain', body: (innerPage(site, '/paste/1', q) && '') || hex(d.b, 40) + '\n' };
        return { status: 404, type: 'text/html', body: frame(site, '<h1>404</h1><p class="muted">No page at ' + esc(p) + '.</p><p><a href="/">← ' + esc(d.brand) + '</a></p>', { title: 'Not found' }) };
      }
      if (typeof inner === 'string' && /^(?:-----BEGIN|binary |\(simulated\))/.test(inner)) return { status: 200, type: 'text/plain', body: inner };
      return { status: 200, type: 'text/html', body: inner };
    };
    return site;
  }

  /* ---------------------------------------------------------------- the agencies ------------------------------------------------------------ */
  const AGENCIES = [
    {
      id: 'cai', host: 'cai-intel.onion', seal: '🦅', cc: 'US', flag: '🇺🇸', brand: 'CAI · Central Agency of Intelligence',
      short: 'CAI', lang: 'en', phone: '+1 (202) 555-0142', hours: 'Mon–Fri 09:00–17:00 EST',
      hero: 'Report a hidden service', body: 'The CAI runs the hidden-service tip line. If you have found an onion address that hosts stolen records, a market or a ransom panel, send it here — with a screenshot, a date and the address exactly as it appears.',
      units: ['Directorate of Cyber Operations', 'Onion Exploitation Cell', 'Counter-Intelligence Liaison', 'Digital Forensics Branch'],
      wanted: ['tessellate', 'warm-lead', 'quillon', 'postmortem', 'coldsolder'],
      notices: ['Operation GLASS GARDEN — 14 onion addresses seized, 3 operators charged', 'Ransom panel taken offline after a nine-day campaign'],
      tip: 'unsigned tips are read; signed tips get an answer'
    },
    {
      id: 'europa', host: 'europa-ec3.onion', seal: '⭐', cc: 'EU', flag: '🇪🇺', brand: 'EUROPA · European Cyber Crime Centre',
      short: 'EUROPA EC3', lang: 'en', phone: '+31 70 302 5000', hours: '24/7 duty desk',
      hero: 'Report criminal infrastructure', body: 'EUROPA gathers reports from member states on hidden services used to trade stolen data, host ransomware panels and move ransom payments. Reports in any EU language are accepted and routed to the national unit that can act on them.',
      units: ['Joint Cybercrime Action Taskforce', 'Ransomware Response', 'Dark Market Monitoring', 'Payment Tracing'],
      wanted: ['lanternjaw', 'glasshouses', 'seventeen'],
      notices: ['A market’s escrow wallet frozen after a joint referral', 'Three member states publish a shared clone-warning list'],
      tip: 'a report without an address is a story, not a lead'
    },
    {
      id: 'bka', host: 'bka-cyber.onion', seal: '🛡', cc: 'DE', flag: '🇩🇪', brand: 'Bundeskriminalamt · Cybercrime',
      short: 'BKA', lang: 'de', phone: '+49 611 55-0', hours: 'Mo–Fr 08:00–18:00',
      hero: 'Hinweis zu einem Hidden Service', body: 'Das BKA nimmt Hinweise zu versteckten Diensten entgegen: Adresse, Zeitpunkt, ein Bildschirmfoto und — wenn vorhanden — die Signatur des Betreibers. Hinweise werden an die zuständige Landespolizei weitergeleitet.',
      units: ['Abteilung Cybercrime', 'Zentrale Ansprechstelle für Hinweise', 'Auswertung und Forensik'],
      wanted: ['grauwerk', 'bitrot', 'drywell'],
      notices: ['Gemeinsame Aktion gegen einen Marktplatz — mehrere Adressen abgeschaltet', 'Warnung vor Klonen mit abweichender Signatur'],
      tip: 'ohne Adresse kein Ermittlungsansatz'
    },
    {
      id: 'gn', host: 'gn-cyber.onion', seal: '⚜', cc: 'FR', flag: '🇫🇷', brand: 'Gendarmerie Nationale · Division Cyber',
      short: 'GN Cyber', lang: 'fr', phone: '+33 1 43 98 23 00', hours: '24h/24 — permanence',
      hero: 'Signaler un service caché', body: 'La Division Cyber reçoit les signalements de services cachés : marchés, panneaux de rançon, reventes de données. Indiquez l’adresse .onion exacte, la date et, si possible, une capture d’écran.',
      units: ['Division Cyber', 'Cellule anti-rançongiciel', 'Analyse technique'],
      wanted: ['nocturne', 'saltmarsh', 'mothwing'],
      notices: ['Vague de saisies sur trois adresses miroir', 'Mise en garde contre un clone du présent site'],
      tip: 'une adresse exacte vaut mieux qu’un long récit'
    },
    {
      id: 'cnp', host: 'policia-ciber.onion', seal: '👮', cc: 'ES', flag: '🇪🇸', brand: 'Policía Nacional · Brigada Ciber',
      short: 'Brigada Ciber', lang: 'es', phone: '+34 91 582 25 00', hours: 'L–V 08:00–20:00',
      hero: 'Denunciar un servicio oculto', body: 'La Brigada de Investigación Tecnológica recoge denuncias sobre direcciones .onion dedicadas a la venta de datos, fraudes y rescates. Se acepta cualquier idioma; la denuncia se remite a la unidad territorial competente.',
      units: ['Brigada de Investigación Tecnológica', 'Grupo de Mercados Ilícitos', 'Unidad de Fraude'],
      wanted: ['kestrel', 'seventeen', 'halfwatt'],
      notices: ['Seis direcciones intervenidas en una operación conjunta', 'Aviso sobre copias no firmadas de este portal'],
      tip: 'sin la dirección exacta no hay investigación posible'
    },
    {
      id: 'thtc', host: 'politie-thtc.onion', seal: '🚓', cc: 'NL', flag: '🇳🇱', brand: 'Politie · Team High Tech Crime',
      short: 'THTC', lang: 'nl', phone: '+31 88 66 99 000', hours: '24/7',
      hero: 'Meld een hidden service', body: 'Team High Tech Crime ontvangt meldingen over verborgen diensten: adres, datum, schermafbeelding en eventueel de handtekening van de beheerder. Meldingen worden beoordeeld en doorgezet naar het juiste team.',
      units: ['Team High Tech Crime', 'Darkweb Monitoring', 'Digitaal Bewijs'],
      wanted: ['nullroute', 'quillon', 'v0id'],
      notices: ['Drie markten offline na een gezamenlijke actie', 'Waarschuwing: kopieën van deze pagina circuleren'],
      tip: 'een melding zonder adres kunnen we niet onderzoeken'
    },
    {
      id: 'keisatsu', host: 'keisatsu-cyber.onion', seal: '🌸', cc: 'JP', flag: '🇯🇵', brand: 'Keisatsu-chō · Cyber Division',
      short: 'Cyber Division', lang: 'ja', phone: '+81 3 3581 0141', hours: '平日 09:00–17:30',
      hero: '隠されたサービスを報告する', body: 'サイバー犯罪対策課では、盗まれたデータや不正な市場を公開している .onion アドレスの情報を受け付けています。正確なアドレス、日時、画面の記録をお送りください。',
      units: ['サイバー犯罪対策課', 'オンライン調査係', '技術解析係'],
      wanted: ['sakurahan', 'palehorse', 'tangent'],
      notices: ['共同作戦により複数のアドレスを停止', '偽サイトに関する注意喚起'],
      tip: 'アドレスの記載がない通報は調査できません'
    },
    {
      id: 'pf', host: 'pf-ciber.onion', seal: '🇧🇷', cc: 'BR', flag: '🇧🇷', brand: 'Polícia Federal · Divisão Cibernética',
      short: 'PF Ciber', lang: 'pt', phone: '+55 61 2024-8000', hours: '24 horas',
      hero: 'Denunciar um serviço oculto', body: 'A Divisão de Crimes Cibernéticos recebe denúncias sobre endereços .onion usados para venda de dados, fraudes e ransomwares. Informe o endereço exato, a data e, se possível, uma captura de tela.',
      units: ['Divisão de Crimes Cibernéticos', 'Grupo de Mercados Ilegais', 'Perícia Digital'],
      wanted: ['atlantico', 'seventeen', 'bitrot'],
      notices: ['Operação conjunta retira três espelhos do ar', 'Alerta sobre clones sem assinatura'],
      tip: 'sem o endereço exato não há como investigar'
    },
    {
      id: 'afp', host: 'afp-cyber.onion', seal: '🦘', cc: 'AU', flag: '🇦🇺', brand: 'Australian Federal Police · Cyber Command',
      short: 'AFP Cyber', lang: 'en', phone: '+61 2 5126 0000', hours: '24/7',
      hero: 'Report an onion service', body: 'Cyber Command accepts reports about hidden services that trade stolen records, host extortion panels or move ransom payments. Include the address exactly as written, the date and a screenshot where you can.',
      units: ['Cyber Command', 'Dark Web Investigation', 'Digital Forensics'],
      wanted: ['mothwing', 'drywell', 'lanternjaw'],
      notices: ['Four addresses taken down in a joint operation', 'Warning: unsigned copies of this portal are circulating'],
      tip: 'a report without an address cannot be actioned'
    }
  ];

  function agencyPage(a, path, query) {
    const p = String(path || '/');
    const nav = [['Home', '/'], ['Report', '/report'], ['Wanted', '/wanted'], ['Seized', '/seized'], ['Press', '/press'], ['PGP', '/pgp.txt']];
    const p2 = { bg: '#f4f6fa', panel: '#ffffff', ink: '#111827', mute: '#4b5563', line: '#d5dbe5', acc: '#123a7a', acc2: '#8a1b1b' };
    const css = 'html,body{margin:0;background:' + p2.bg + ';color:' + p2.ink + ';font:15px/1.6 "Segoe UI",system-ui,-apple-system,Roboto,Arial,sans-serif}' +
      'a{color:' + p2.acc + ';text-decoration:none}a:hover{text-decoration:underline}' +
      '.gov{background:' + p2.acc + ';color:#fff;padding:6px 18px;font-size:12px;letter-spacing:.03em}' +
      '.top{display:flex;gap:16px;align-items:center;padding:14px 18px;background:' + p2.panel + ';border-bottom:1px solid ' + p2.line + '}' +
      '.seal{width:44px;height:44px;border-radius:50%;background:#e9eefb;border:2px solid ' + p2.acc + ';display:flex;align-items:center;justify-content:center;font-size:22px}' +
      '.top b{font-size:17px;display:block}.top .sub{font-size:12px;color:' + p2.mute + '}' +
      '.top nav{margin-left:auto;display:flex;gap:14px;font-size:13px}' +
      '.wrap{max-width:960px;margin:0 auto;padding:22px 18px 60px}' +
      'h1{font-size:24px;margin:14px 0 8px}h2{font-size:14px;letter-spacing:.1em;text-transform:uppercase;color:' + p2.acc + ';margin:30px 0 8px;border-bottom:2px solid ' + p2.line + ';padding-bottom:6px}' +
      '.alert{background:#fff7e6;border:1px solid #e2c07a;border-left:5px solid #a86b00;padding:12px 14px;margin:16px 0;font-size:13.5px}' +
      '.hero{background:' + p2.panel + ';border:1px solid ' + p2.line + ';border-radius:6px;padding:22px;margin:18px 0}' +
      '.hero p{margin:0 0 10px;color:#374151}' +
      '.btn{display:inline-block;background:' + p2.acc + ';color:#fff;padding:10px 16px;border-radius:4px;font-size:14px;border:0}' +
      'table{border-collapse:collapse;width:100%;font-size:14px}th,td{text-align:left;padding:9px 8px;border-bottom:1px solid ' + p2.line + '}th{color:' + p2.mute + ';font-size:12px;text-transform:uppercase;letter-spacing:.06em}' +
      'input,textarea{width:100%;box-sizing:border-box;padding:9px;border:1px solid #b9c1cf;border-radius:4px;font:inherit;background:#fff}' +
      'label{display:block;margin:12px 0 4px;font-size:13px;color:#374151}' +
      'footer{margin-top:40px;border-top:1px solid ' + p2.line + ';padding-top:14px;font-size:12px;color:' + p2.mute + '}' +
      '.note{font-size:12px;color:' + p2.mute + '}';
    const shell = (title, inner) => '<!doctype html><html lang="' + a.lang + '"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">' +
      '<title>' + esc(title) + ' · ' + esc(a.short) + '</title><style>' + css + '</style></head><body>' +
      '<div class="gov">An official onion address of ' + esc(a.short) + ' · verified mirror 1 · ' + esc(a.hours) + '</div>' +
      '<div class="top"><div class="seal">' + a.seal + '</div><div><b>' + esc(a.brand) + '</b><span class="sub">' + a.flag + ' · ' + esc(a.host) + ' · Tor only</span></div>' +
      '<nav>' + nav.map(x => '<a href="' + x[1] + '">' + esc(x[0]) + '</a>').join('') + '</nav></div>' +
      '<div class="wrap">' + inner + '<footer>This portal is simulated inside Moundshroud’s Cyber Desktop. No agency, officer or case is real, nothing is sent, and no hidden service is contacted. ' +
      'Duty desk: ' + esc(a.phone) + ' · ' + esc(a.tip) + '.</footer></div></body></html>';
    if (p === '/') {
      return {
        status: 200, type: 'text/html', body: shell(a.hero,
          '<div class="alert"><b>Notice.</b> A copy of this portal is circulating without a signature. Check the key at /pgp.txt before you send anything.</div>' +
          '<div class="hero"><h1>' + esc(a.hero) + '</h1><p>' + esc(a.body) + '</p><p><a class="btn" href="/report">' + esc(a.hero) + ' →</a></p></div>' +
          '<h2>What we act on</h2><table><tr><th>Type</th><th>Handled by</th><th>Response</th></tr>' +
          a.units.map((u, i) => '<tr><td>' + esc(['Stolen records offered for sale', 'Ransomware panels and payment pages', 'Markets trading in credentials', 'Clone addresses impersonating a service'][i % 4]) + '</td><td>' + esc(u) + '</td><td class="note">' + esc(['48 hours', 'same day', 'referral to a national unit', 'takedown request'][i % 4]) + '</td></tr>').join('') + '</table>' +
          '<h2>Recent notices</h2>' + a.notices.map(n => '<p class="note">• ' + esc(n) + '</p>').join(''))
      };
    }
    if (p === '/report') {
      return {
        status: 200, type: 'text/html', body: shell('Report', '<h1>' + esc(a.hero) + '</h1>' +
          '<p>The form below is simulated: it stores nothing and sends nothing. In a live portal the message would be encrypted to the key at /pgp.txt.</p>' +
          '<form action="/report" method="post"><label>Onion address</label><input name="host" placeholder="xxxxxxxxxxxxxxxx.onion">' +
          '<label>What you saw</label><textarea name="what" rows="6" placeholder="listing, records, ransom panel, payment address…"></textarea>' +
          '<label>When</label><input name="when" placeholder="date and time, with timezone">' +
          '<label>Your key (optional)</label><input name="key" placeholder="PGP fingerprint, if you want an answer">' +
          '<p><button class="btn" type="submit">Submit report</button></p></form>' +
          '<p class="note">Reports are read by ' + esc(a.units[0]) + '. ' + esc(a.tip) + '.</p>')
      };
    }
    if (p === '/wanted') {
      return {
        status: 200, type: 'text/html', body: shell('Wanted', '<h1>Wanted for questioning</h1><p class="note">Handles known to operate infrastructure under investigation. A handle is not a person; identities are not published here.</p>' +
          '<table><tr><th>Handle</th><th>Known for</th><th>Last seen</th><th>Reference</th></tr>' +
          a.wanted.map((w, i) => '<tr><td><b>' + esc(w) + '</b></td><td>' + esc(['market administration', 'ransom panel hosting', 'credential resale', 'clone service'][i % 4]) + '</td><td class="note">' + esc(['mirror 2', 'a paste board', 'an escrow dispute', 'a forum'][i % 4]) + '</td><td class="note">' + esc(a.short.split(' ')[0]) + '-' + (2024 + i % 2) + '-0' + (i + 1) + '</td></tr>').join('') + '</table>')
      };
    }
    if (p === '/seized') {
      return {
        status: 200, type: 'text/html', body: shell('Seized', '<h1>Seized addresses</h1><p>Addresses below were replaced with a notice. If a page still answers at one of them, it is a clone and it is not ours.</p>' +
          '<table><tr><th>Address</th><th>Status</th><th>Notice</th></tr>' +
          ['oldmarket', 'silkmirror', 'vault7x', 'nightfall'].map((n, i) => '<tr><td class="note">' + esc(n) + '…' + esc(hex([a.host.length + i], 3)) + '.onion</td><td><b>' + esc(i % 2 ? 'seized' : 'offline') + '</b></td><td class="note">' + esc(['banner replaced by a law-enforcement notice', 'no answer for 30 days', 'operator key revoked', 'mirror list withdrawn'][i]) + '</td></tr>').join('') + '</table>')
      };
    }
    if (p === '/press') {
      return {
        status: 200, type: 'text/html', body: shell('Press', '<h1>Press</h1>' + a.notices.map((n, i) => '<div class="hero"><h3 style="margin:0 0 6px">' + esc(n) + '</h3><p class="note">' + esc(['A joint operation with three national units.', 'No further detail will be published while cases are open.', 'Mirror lists were re-signed after the action.'][i % 3]) + '</p></div>').join('') +
          '<p class="note">Media enquiries: press desk, ' + esc(a.phone) + '. Nothing here is attributable to a real agency.</p>')
      };
    }
    if (p === '/pgp.txt') {
      return {
        status: 200, type: 'text/plain', body: '-----BEGIN PGP PUBLIC KEY BLOCK-----\nComment: ' + a.brand + ' <' + a.host + '> — simulated key\n\n' +
          hex(hash(a.host), 128).replace(/(.{64})/g, '$1\n') + '\n-----END PGP PUBLIC KEY BLOCK-----\n'
      };
    }
    return { status: 404, type: 'text/html', body: shell('Not found', '<h1>404</h1><p>No page at ' + esc(p) + '.</p><p><a href="/">← ' + esc(a.short) + '</a></p>') };
  }

  function makeAgency(a) {
    const site = {
      dark: true, gov: true, agency: a.id, host: a.host, brand: a.brand, icon: a.seal, cc: a.cc, country: a.flag,
      kind: 'Government', topic: 'government portal, hidden service, ' + a.cc, region: a.cc,
      market: false, noSales: true, tagline: a.hero + ' — ' + a.short + ', Tor-only portal.',
      bg: '#f4f6fa', ink: '#111827', link: '#123a7a', line: '#d5dbe5', field: '#ffffff',
      btn: '#123a7a', btnInk: '#ffffff', mute: '#4b5563', accent: '#123a7a', tier: 'government', quality: 'government',
      v3: onionName(hash(a.host + ':v3'))
    };
    site.menu = [['Home', '/'], ['Report', '/report'], ['Wanted', '/wanted'], ['Seized', '/seized'], ['Press', '/press'], ['PGP', '/pgp.txt']];
    site.items = [];
    site.render = (path, query) => agencyPage(a, path, query);
    return site;
  }

  let agencyCache = null;
  const agencies = () => (agencyCache || (agencyCache = AGENCIES.map(makeAgency)));

  /* ---------------------------------------------------------------- the endless index ------------------------------------------------------- */
  const seen = new Map();
  function site(host) {
    const key = String(host || '').trim().toLowerCase();
    if (!key) return null;
    if (seen.has(key)) return seen.get(key);
    const made = makeSite(key.endsWith('.onion') ? key : key + '.onion');
    seen.set(key, made);
    return made;
  }
  /* a brand-new address nobody has asked for yet: used by the index's "another page of services" link */
  function freshHost(seed) {
    const s = seed == null ? hash(String(Date.now()) + Math.random()) : seed;
    const b = rnd(s, 8);
    return onionName(s) === '' ? '' : at(A_WORDS, b[0]).toLowerCase() + at(B_WORDS, b[1]).toLowerCase() + (b[2] % 900) + '.onion';
  }
  function more(n, seed) {
    const out = [];
    for (let i = 0; i < Math.max(1, n || 8); i++) {
      const s = (seed == null ? hash('more:' + Date.now() + ':' + i) : (seed + i * 7919)) >>> 0;
      const host = freshHost(s);
      const made = site(host);
      made.generated = true;
      out.push(made);
    }
    return out;
  }
  const count = () => seen.size;

  A.darkGen = { site, more, freshHost, agencies, count, makeSite, AGENCIES: AGENCIES.map(a => ({ id: a.id, host: a.host, brand: a.brand, cc: a.cc })) };
})();

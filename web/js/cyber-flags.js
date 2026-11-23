// Cyber Desktop + Browser flags. Every website on the fake internet, every bundled library the Browser holds and
// every PC on the Open Range hides one FLAG{...}; `solve FLAG{...}` in moundshell pays the practice bank once per
// flag. A site's flag is printed on its staff page; a library's flag sits in the Browser's library bar; a range
// PC's flag is on its own staff page. Everything is invented here and nothing leaves this page.
(() => {
  const slug = value => String(value == null ? '' : value).toLowerCase()
    .replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '').slice(0, 42) || 'library';
  const hash = value => {
    let h = 2166136261 >>> 0;
    const text = String(value == null ? '' : value);
    for (let i = 0; i < text.length; i++) { h ^= text.charCodeAt(i); h = Math.imul(h, 16777619) >>> 0; }
    return h >>> 0;
  };
  /* a library's flag depends only on the library's own name, so the Browser and moundshell always agree on it.
     Books arrive as { name, title } from /api/lib/books and as { id, title } from moundshell's listing. */
  const libName = book => String((book && (book.name || book.id)) || '');
  const libFlag = book => 'FLAG{library_' + slug(book && (book.title || book.name || book.id)) + '_' +
    hash(libName(book)).toString(16).padStart(8, '0').slice(0, 6) + '}';
  const SITE_PAY = { 'extremely-easy': 70, easy: 90, medium: 140, hard: 200, extreme: 280 };
  const sitePay = site => SITE_PAY[String((site && site.difficulty) || '').toLowerCase()] || 120;
  const LIB_PAY = 60;
  const wall = raw => String(raw == null ? '' : raw).trim()
    .replace(/^[\s`"'“”‘’]+/, '').replace(/[\s`"'“”‘’]+$/, '');
  const bank = () => (typeof A !== 'undefined' && A.cyberBank) || null;
  const web = () => {
    try {
      const w = typeof A !== 'undefined' ? A.cyberWeb : null;
      if (w && w.ensure) w.ensure();
      return w;
    } catch (error) { return null; }
  };

  let cache = null, cachedAt = 0;
  async function books(force) {
    if (!force && cache && Date.now() - cachedAt < 30000) return cache;
    try {
      const r = await A.api('/api/lib/books');
      cache = (r && r.books) || [];
      cachedAt = Date.now();
    } catch (error) { cache = cache || []; }
    return cache;
  }

  function pay(key, amount, label, kind) {
    const b = bank();
    if (!b || !b.once) return { status: 'unavailable' };
    if (b.paid && b.paid(key)) return { status: 'known', label, amount, balance: b.balance, kind };
    const ok = b.once(key, amount, label, 'flag', 'flags');
    return { status: ok ? 'paid' : 'known', label, amount, balance: b.balance, kind };
  }

  /* a flag is looked for in the generated sites, the Open Range machines and the bundled libraries */
  async function submit(raw) {
    const text = wall(raw);
    if (!/^FLAG\{[a-z0-9_]{2,80}\}$/i.test(text)) return { status: 'malformed' };
    const upper = text.toUpperCase();
    const w = web();
    const rangeHit = /^FLAG\{RANGE_PC_(\d+)_[A-Z0-9]+\}$/.exec(upper);
    if (rangeHit) {
      const m = w && w.range ? w.range.machine(Number(rangeHit[1])) : null;
      if (m && m.flag.toUpperCase() === upper) {
        const site = w.range.siteFor(m.n);
        return pay('flag:site:' + site.host, sitePay(site), 'Range PC flag: ' + site.host, 'site');
      }
    }
    const sites = w && w.all ? w.all() : [];
    const site = sites.find(s => String(s.flag || '').toUpperCase() === upper);
    if (site) return pay('flag:site:' + site.host, sitePay(site), 'Site flag: ' + site.brand + ' · ' + site.host, 'site');
    const list = await books();
    const book = list.find(x => libFlag(x).toUpperCase() === upper);
    if (book) return pay('flag:library:' + libName(book), LIB_PAY, 'Library flag: ' + (book.title || libName(book)), 'library');
    return { status: 'unknown' };
  }

  /* `solve` on its own: where flags live and what has already been submitted */
  async function board() {
    const b = bank();
    const w = web();
    const sites = w && w.all ? w.all() : [];
    const list = await books();
    const siteCount = sites.filter(s => b && b.paid('flag:site:' + s.host)).length;
    const libCount = list.filter(x => b && b.paid('flag:library:' + libName(x))).length;
    const out = [
      'FAKE-INTERNET FLAGS · pay them into the Cyber Desktop practice bank',
      '',
      '  Type  solve FLAG{...}  with a flag you have found. Each one pays once; the money is spent in',
      '  Cyber Desktop › Bank › Cosmetics shop.',
      '',
      '  WHERE THE FLAGS ARE',
      '    Websites     every generated Cyber Desktop website prints its FLAG on its staff dashboard. Read the',
      '                 site first (`paths <host>`, `browser read <host>/.env`), sign in, then read the dashboard.',
      '    Libraries    open any bundled library in the Browser: the library bar above the page shows its FLAG.',
      '                 `browser` lists every library too.',
      '    Open Range   https://range.moundshroud.lab is an endless index of practice PCs; `range` lists them and',
      '                 `breach <ip>` starts the engagement. Each PC prints its FLAG on its own staff page.',
      '',
      '  PROGRESS',
      '    Websites     ' + siteCount + ' of ' + sites.length + ' submitted',
      '    Libraries    ' + libCount + ' of ' + list.length + ' submitted',
      '    Open Range   ∞ machines · ' + (w && w.range ? w.range.host : 'range.moundshroud.lab'),
      '    Balance      ' + (b ? '$' + Number(b.balance || 0).toFixed(2) : 'the practice bank is not loaded yet')
    ];
    return out.join('\n');
  }

  A.cyberFlags = { libFlag, submit, board, books, sitePay, LIB_PAY };
})();

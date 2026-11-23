// Every dark site must answer for the links it prints. This walks the hand-written onions, the government portals, the
// Hidden Wiki and its directory, the leak archives and a spread of generated services: it renders each page, collects the
// hrefs and form actions the page really prints, and asks the site's own backend for every one of them. A link that 404s
// is the bug this test exists for — "some sites are broken when you press a link".
const fs = require('fs');
const path = require('path');
const vm = require('vm');

module.exports = async function (ok) {
  const store = {};
  const ctx = vm.createContext({
    console, Date, Math, JSON, URLSearchParams, TextEncoder, setTimeout, clearTimeout,
    localStorage: { getItem: k => (k in store ? store[k] : null), setItem: (k, v) => { store[k] = String(v); }, removeItem: k => { delete store[k]; } },
    A: {}
  });
  ctx.window = ctx;
  for (const name of ['cyber-tor.js', 'cyber-dark-gen.js', 'cyber-hidden-wiki.js', 'cyber-dark-web.js']) {
    const file = path.join(__dirname, '..', 'web', 'js', name);
    vm.runInContext(fs.readFileSync(file, 'utf8'), ctx, { filename: file });
  }
  const A = ctx.A;
  const serve = (site, p, q) => A.cyberDark.serve(site, p, q || new URLSearchParams(''), 'GET');

  /* every href, plus the action of every GET form: a POST form is submitted with a button, not followed as a link */
  const links = html => {
    const src = String(html || '');
    const out = [];
    let m;
    const href = /href\s*=\s*"([^"]+)"/gi;
    while ((m = href.exec(src))) out.push(m[1]);
    const form = /<form\b([^>]*)>/gi;
    while ((m = form.exec(src))) {
      const attrs = m[1] || '';
      if (/method\s*=\s*"?post/i.test(attrs)) continue;
      const a = /action\s*=\s*"([^"]+)"/i.exec(attrs);
      if (a) out.push(a[1]);
    }
    return out;
  };
  const norm = (from, href) => {
    if (/^(?:mailto:|javascript:|data:)/i.test(href)) return null;
    if (/^https?:\/\//i.test(href)) {
      try { const u = new URL(href); return { host: u.host, path: (u.pathname || '/') + (u.search || '') }; } catch (e) { return null; }
    }
    if (href.startsWith('//')) return null;
    if (href.startsWith('#')) return { same: true, path: from };
    const hashless = href.split('#')[0];
    if (!hashless) return { same: true, path: from };
    href = hashless;
    const base = from.split('?')[0];
    const joined = href.startsWith('/') ? href : (base.replace(/\/[^/]*$/, '/') + href);
    const [p, qs] = joined.split('?');
    return { path: p || '/', query: qs || '' };
  };

  /* one site: crawl its pages one level deep from a set of start paths */
  function crawl(site, starts, label) {
    const broken = [], checked = new Set(), queue = starts.slice();
    let visited = 0;
    while (queue.length && visited < 90) {
      const p = queue.shift();
      const key = p.path + '?' + (p.query || '');
      if (checked.has(key)) continue;
      checked.add(key);
      const res = serve(site, p.path, new URLSearchParams(p.query || ''));
      if (!res || res.status >= 400) { broken.push(key + ' -> ' + (res && res.status)); continue; }
      visited++;
      if (!/html/i.test(String(res.type || ''))) continue;
      for (const raw of links(res.body)) {
        const to = norm(p.path + (p.query ? '?' + p.query : ''), raw);
        if (!to) continue;
        if (to.same) continue;
        if (to.host && String(to.host).toLowerCase() !== String(site.host).toLowerCase()) continue;
        const [np, nq] = String(to.path || '/').split('?');
        const item = { path: np || '/', query: nq || to.query || '' };
        const kk = item.path + '?' + item.query;
        if (!checked.has(kk)) queue.push(item);
      }
    }
    ok(label + ': every link it prints answers', broken.length === 0, broken.slice(0, 8).join(' | '));
    return broken;
  }

  /* 1 — the Hidden Wiki: every page, the directory, every leak archive */
  const wiki = A.hiddenWiki.site;
  const starts = [{ path: '/' }, { path: '/leaks' }, { path: '/rules' }, { path: '/recent' }, { path: '/special' },
    { path: '/info' }, { path: '/links' }, { path: '/permanent' }, { path: '/source' }, { path: '/discussion' },
    { path: '/history' }, { path: '/contest' }, { path: '/print' }, { path: '/categories' }, { path: '/dead' }];
  for (const l of A.hiddenWiki.leaks()) { starts.push({ path: '/leaks/' + l.id }); starts.push({ path: '/leaks/' + l.id + '/files' }); }
  crawl(wiki, starts, 'hidden wiki');

  /* 2 — the leak services, and every archive page they link */
  for (const site of A.hiddenWiki.leakSites()) {
    const s = [{ path: '/' }, { path: '/archives' }, { path: '/about' }, { path: '/rules' }, { path: '/contact' }, { path: '/?q=credentials' }];
    for (const l of A.hiddenWiki.leaks().slice(0, 6)) { s.push({ path: '/leak/' + l.id }); }
    crawl(site, s, 'leak service ' + site.brand);
    break; // one is enough for the shared renderer; the rest differ only in brand
  }

  /* 3 — every hand-written onion and every government portal */
  const written = A.cyberDark.sites().filter(s => s.dark && !s.wiki && !s.leaks && !s.generated);
  const brokenWritten = [];
  for (const site of written) {
    const starts = [{ path: '/' }];
    for (const r of A.cyberDark.scan(site)) starts.push({ path: r.path });
    const bad = crawl(site, starts, site.host);
    if (bad.length) brokenWritten.push(site.host);
  }
  ok('dark web: every hand-written service and portal has working links', brokenWritten.length === 0, brokenWritten.join(', '));

  /* 4 — generated services across the kinds and the qualities */
  const sample = [];
  const seenKinds = new Set();
  for (let i = 0; i < 120 && sample.length < 26; i++) {
    const site = A.darkGen.site('links' + i + 'probe.onion');
    if (!seenKinds.has(site.kind) || i % 7 === 0) { seenKinds.add(site.kind); sample.push(site); }
  }
  const brokenGenerated = [];
  for (const site of sample) {
    const bad = crawl(site, [{ path: '/' }, { path: '/catalog' }, { path: '/thread/1' }, { path: '/item/1' }, { path: '/board/2' }, { path: '/paste/1' }, { path: '/article/1' }, { path: '/collection/1' }, { path: '/leaks' }].filter(x => serve(site, x.path).status < 400), site.host);
    if (bad.length) brokenGenerated.push(site.host + ': ' + bad.slice(0, 3).join(', '));
  }
  ok('dark web: generated services answer for every link and form they print', brokenGenerated.length === 0, brokenGenerated.slice(0, 4).join(' | '));

  /* 5 — every service named in the Hidden Wiki directory opens, and its home page links resolve */
  const brokenNamed = [];
  for (const entry of A.hiddenWiki.entries()) {
    const site = A.hiddenWiki.named(entry.host);
    if (!site) { brokenNamed.push(entry.name + ' (no site)'); continue; }
    const home = serve(site, '/');
    if (!home || home.status >= 400) { brokenNamed.push(entry.name + ' (home ' + (home && home.status) + ')'); continue; }
    const bad = crawl(site, [{ path: '/' }], entry.name);
    if (bad.length) brokenNamed.push(entry.name);
  }
  ok('dark web: every service named in the Hidden Wiki opens and links correctly', brokenNamed.length === 0, brokenNamed.slice(0, 6).join(', '));

  /* 6 — the index links that lead in and out */
  const index = A.cyberDark.find('darknet-index.onion');
  const indexHome = A.cyberDark.serve(index, '/', new URLSearchParams(''), 'GET');
  ok('dark web: the index links to the Hidden Wiki', /The Hidden Wiki/.test(indexHome.body) && indexHome.body.includes(wiki.host), wiki.host);
  ok('dark web: the Hidden Wiki is in the index and findable by its short name', !!A.cyberDark.find('hiddenwiki.onion') && A.cyberDark.find('hiddenwiki.onion').host === wiki.host);
};

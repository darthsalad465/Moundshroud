// Everything on both fake internets has to be a real page, has to be reachable from moundshell, and has to cost
// something to break. This walks every website on the fake internet and every hidden service on the fake dark web:
// it renders each page, follows every link it prints (internal links must answer, named outbound links must open a
// site that carries the name the link promised), and then asks the moundshell's own side â the user table, the leaked
// database, the leaked PC, its password, its flag and its difficulty â for every one of them. The PCs themselves are
// logged into and run through the commands a session has.
const fs = require('fs');
const path = require('path');
const vm = require('vm');

module.exports = async function (ok) {
  const store = new Map();
  const A = { cur: 'cyber', toast() { }, cyberBank: null, api: async () => ({ books: [] }) };
  const ctx = {
    A, console, Math, Date, JSON, Array, Object, String, Number, Boolean, RegExp, Error, Map, Set,
    URL, URLSearchParams, Promise, parseInt, parseFloat, isNaN, isFinite,
    encodeURIComponent, decodeURIComponent,
    btoa: s => Buffer.from(String(s), 'binary').toString('base64'),
    atob: s => Buffer.from(String(s), 'base64').toString('binary'),
    setTimeout: () => 1, clearTimeout() { }, setInterval: () => 1, clearInterval() { },
    localStorage: { getItem: k => store.has(k) ? store.get(k) : null, setItem: (k, v) => store.set(k, String(v)), removeItem: k => store.delete(k) },
    ls: { get: (k, d) => store.has(k) ? store.get(k) : d, set: (k, v) => store.set(k, String(v)) }
  };
  ctx.self = ctx.window = ctx.globalThis = ctx;
  ctx.document = { addEventListener() { }, createElement: () => ({ style: {}, classList: { add() { }, remove() { } }, setAttribute() { }, appendChild() { } }) };
  vm.createContext(ctx);
  for (const name of ['cyber-tor.js', 'cyber-dark-gen.js', 'cyber-hidden-wiki.js', 'cyber-dark-social.js', 'cyber-downloads.js',
    'cyber-dark-leaks.js', 'cyber-user-pcs.js', 'cyber-dark-web.js', 'cyber-web-universe.js', 'cyber-flags.js']) {
    const file = path.join(__dirname, '..', 'web', 'js', name);
    vm.runInContext(fs.readFileSync(file, 'utf8'), ctx, { filename: file });
  }
  const W = ctx.A.cyberWeb, D = ctx.A.cyberDark, P = ctx.A.cyberPcs, H = ctx.A.hiddenWiki;
  W.ensure();

  const serveWeb = site => (p, q) => W.serve(site, (p || '/') + (q ? '?' + q : ''), 'GET');
  const serveDark = site => (p, q) => D.serve(site, p || '/', new URLSearchParams(q || ''), 'GET');

  /* every href, plus the action of every GET form */
  const links = html => {
    const src = String(html || ''), out = [];
    let m;
    const a = /<a\b[^>]*href\s*=\s*"([^"]*)"[^>]*>([\s\S]{0,120}?)<\/a>/gi;
    while ((m = a.exec(src))) out.push({ href: m[1], text: String(m[2]).replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim() });
    const f = /<form\b([^>]*)>/gi;
    while ((m = f.exec(src))) {
      const attrs = m[1] || '';
      if (/method\s*=\s*"?post/i.test(attrs)) continue;
      const act = /action\s*=\s*"([^"]+)"/i.exec(attrs);
      if (act) out.push({ href: act[1], text: 'form' });
    }
    return out;
  };
  /* words in a link that name a site: the generic navigation labels are not names */
  const GENERIC = new Set(('directory search archive home about contact login sign terms portal index news shop store bank forum board ' +
    'wiki site page policy policies help support docs blog faq staff careers jobs mail legal privacy cookies account browse results ' +
    'more all map status radio games music tools feed press events team clients pricing plans roadmap changelog report security range ' +
    'vault laboratory mirror mirrors latest story latest documents read source printable version related changes special pages ' +
    'random service dead links page information rules of the site editor picks volunteer main page discussion history view ' +
    'back next previous open the this that and for your our with from here click link').split(/\s+/));
  const names = text => String(text || '').toLowerCase().replace(/[^a-z0-9]+/g, ' ')
    .split(' ').filter(w => w.length > 2 && !GENERIC.has(w));

  const broken = [], missingTarget = [], wrongTarget = [], noPage = [];
  let pages = 0, outbound = 0;

  /* one site: its front page and the pages its own menu names, one level deep */
  function walk(site, serve, label) {
    const seen = new Set();
    const queue = [{ p: '/' }].concat((site.menu || []).map(x => String(x[1] || '')).filter(x => x && x !== '/' && !/^https?:/i.test(x))
      .map(x => { const [p, q] = x.split('?'); return { p: p || '/', q: q || '' }; }));
    let visited = 0;
    while (queue.length && visited < 6) {
      const it = queue.shift();
      const key = it.p + (it.q ? '?' + it.q : '');
      if (seen.has(key)) continue;
      seen.add(key);
      const res = serve(it.p, it.q);
      visited++; pages++;
      if (!res || res.status >= 400) { broken.push(label + ' ' + key + ' -> ' + (res && res.status)); continue; }
      if (!/html/i.test(String(res.type || 'text/html'))) continue;
      const body = String(res.body || '');
      if (!body.includes(site.host) && !body.includes(String(site.brand || ""))) noPage.push(label + ' ' + key + ' does not name the site it belongs to');
      for (const l of links(body)) {
        const raw = String(l.href || '');
        if (!raw || /^(?:mailto:|javascript:|data:)/i.test(raw) || raw.startsWith('#')) continue;
        if (/^https?:\/\//i.test(raw) || raw.startsWith('//')) {
          let u; try { u = new URL(raw, 'https://' + site.host + '/'); } catch (e) { continue; }
          if (u.host === site.host) { queue.push({ p: u.pathname || '/', q: u.search.replace(/^\?/, '') }); continue; }
          outbound++;
          const tgt = W.find(u.host) || D.find(u.host);
          if (!tgt) { missingTarget.push(label + ' -> ' + u.host + ' (â' + l.text + 'â)'); continue; }
          const words = names(l.text);
          if (!words.length) continue;
          const brand = (String(tgt.brand || '') + ' ' + String(tgt.host || '')).toLowerCase();
          if (!words.some(w => brand.includes(w))) wrongTarget.push(label + ' -> ' + (tgt.brand || tgt.host) + ' via â' + l.text + 'â');
          continue;
        }
        const base = it.p.split('?')[0];
        const joined = raw.startsWith('/') ? raw : base.replace(/\/[^/]*$/, '/') + raw;
        const [p, q] = joined.split('#')[0].split('?');
        if (queue.length < 6) queue.push({ p: p || '/', q: q || '' });
      }
    }
  }

  /* 1 â the clear web: every link answers, every named link opens the site it names */
  for (const site of W.all()) {
    if (!site || !site.host) continue;
    walk(site, serveWeb(site), site.host);
  }
  ok('fake internet: every page of every site answers', broken.length === 0, broken.slice(0, 6).join(' | '));
  ok('fake internet: every page prints the address of the site it belongs to', noPage.length === 0, noPage.slice(0, 4).join(' | '));
  ok('fake internet: every outbound link opens a site that exists', missingTarget.length === 0, missingTarget.slice(0, 6).join(' | '));
  ok('fake internet: a link named after a site opens that site', wrongTarget.length === 0, wrongTarget.slice(0, 6).join(' | '));
  ok('fake internet: the walk actually covered the network', pages > 2000 && outbound > 1000, 'pages=' + pages + ' outbound=' + outbound);

  /* 2 â the dark web, the same way, plus the wiki that fronts it */
  const darkBroken = [], darkTarget = [];
  for (const site of D.all()) {
    if (!site || !site.host) continue;
    const serve = serveDark(site);
    for (const p of ['/'].concat((site.menu || []).map(x => String(x[1] || '')).filter(x => x.startsWith('/')))) {
      const res = serve(p);
      if (!res || res.status >= 400) { darkBroken.push(site.host + ' ' + p + ' -> ' + (res && res.status)); continue; }
      if (!/html/i.test(String(res.type || 'text/html'))) continue;
      for (const l of links(res.body)) {
        const raw = String(l.href || '');
        if (!/^(?:https?:\/\/|\/\/)/i.test(raw)) continue;
        let u; try { u = new URL(raw, 'https://' + site.host + '/'); } catch (e) { continue; }
        if (u.host === site.host) continue;
        if (!(W.find(u.host) || D.find(u.host))) darkTarget.push(site.host + ' -> ' + u.host + ' (â' + l.text + 'â)');
      }
    }
  }
  ok('fake dark web: every page of every hidden service answers', darkBroken.length === 0, darkBroken.slice(0, 6).join(' | '));
  ok('fake dark web: every outbound link opens a site that exists', darkTarget.length === 0, darkTarget.slice(0, 6).join(' | '));

  /* 3 â every site is breakable from moundshell: a user table, a leaked dump, a PC, its password, its flag */
  const noRoster = [], noDump = [], noPc = [], noFlag = [], noLogin = [], noDiff = [];
  for (const site of W.all().concat(D.all())) {
    if (!site || !site.host) continue;
    const label = site.host;
    let users = [];
    try { users = P.roster(site); } catch (e) { noRoster.push(label + ' ' + e.message); }
    if (!users.length) { noRoster.push(label); continue; }
    const dump = (site.dark ? serveDark(site) : serveWeb(site))('/dump/users.csv', '');
    if (!dump || dump.status >= 400 || !String(dump.body || '').includes(users[0].email)) noDump.push(label + ' ' + (dump && dump.status));
    let pcs = [];
    try { pcs = P.forSite(site); } catch (e) { noPc.push(label + ' ' + e.message); }
    if (!pcs.length) { noPc.push(label); continue; }
    for (const pc of pcs) {
      if (!pc.flag || !/^FLAG\{/.test(String(pc.flag))) noFlag.push(pc.hostname);
      const ipUser = users.find(u => u.ip === pc.ip);
      if (!ipUser) { noPc.push(label + ' ' + pc.ip + ' is not in the dump'); continue; }
      /* the password column of the dump is what ssh asks for: read it off the same row the dump prints */
      const login = P.login(pc, ipUser.email.split('@')[0] || ipUser.email, ipUser.password);
      if (!login || !login.ok) noLogin.push(pc.hostname + ' on ' + label + ' ' + (login && login.why));
    }
    try { const d = D.difficulty(site); if (!d || !(d.score > 0)) noDiff.push(label); } catch (e) { noDiff.push(label + ' ' + e.message); }
  }
  ok('moundshell: every site has an account table to read', noRoster.length === 0, noRoster.slice(0, 5).join(' | '));
  ok('moundshell: every site answers /dump/users.csv with its own accounts', noDump.length === 0, noDump.slice(0, 5).join(' | '));
  ok('moundshell: every account in a dump has a machine on the network', noPc.length === 0, noPc.slice(0, 5).join(' | '));
  ok('moundshell: every leaked machine carries a flag', noFlag.length === 0, noFlag.slice(0, 5).join(' | '));
  ok('moundshell: the password in the dump opens the machine over ssh', noLogin.length === 0, noLogin.slice(0, 5).join(' | '));
  /* two sites handing out the same address is how ssh lands on a machine whose account is not in that dump */
  const ipOwner = new Map(), dupIp = [];
  const seenSite = new Set();
  for (const site of W.all().concat(D.all())) {
    if (!site || !site.host || seenSite.has(site.host)) continue;
    seenSite.add(site.host);
    for (const u of P.roster(site)) {
      if (ipOwner.has(u.ip)) dupIp.push(u.ip + ' ' + ipOwner.get(u.ip) + ' / ' + site.host);
      else ipOwner.set(u.ip, site.host);
    }
  }
  ok('moundshell: no two sites hand out the same address', dupIp.length === 0, dupIp.slice(0, 5).join(' | '));
  ok('moundshell: every site has a difficulty read off what it is', noDiff.length === 0, noDiff.slice(0, 5).join(' | '));

  /* 4 â the difficulty really is the content's: a council portal is not a mirror, a market is not a blog */
  const diff = site => D.difficulty(site);
  const byKind = {};
  for (const site of W.all().concat(D.all())) {
    const d = diff(site); if (!d) continue;
    const k = String(d.kind || 'site');
    (byKind[k] = byKind[k] || []).push(d.score);
  }
  const avg = list => list.reduce((a, b) => a + b, 0) / list.length;
  const gov = (byKind.Government || []).concat(byKind.Council || []);
  const mirror = (byKind.Mirror || []).concat(byKind['Software mirror'] || []);
  const market = byKind.Marketplace || [];
  const ref = (byKind.Library || []).concat(byKind.Directory || []);
  ok('difficulty: government and police portals are the hardest sites there are', gov.length && avg(gov) > 85, 'avg=' + Math.round(avg(gov || [0])));
  ok('difficulty: markets sit high and reference sites sit low', market.length && ref.length && avg(market) > avg(ref) + 30,
    'market=' + Math.round(avg(market || [0])) + ' reference=' + Math.round(avg(ref || [0])));
  ok('difficulty: a mirror is the easiest hidden service to work', mirror.length && avg(mirror) < 55, 'avg=' + Math.round(avg(mirror || [0])));
  const spread = new Set(W.all().concat(D.all()).map(s => diff(s)).filter(Boolean).map(d => d.level));
  ok('difficulty: the network spans the whole scale, not one tier', spread.size >= 5, [...spread].join(','));

  /* 5 â every leaked machine runs a session: the commands a moundshell user types must answer */
  const badCmd = [];
  const CMDS = ['whoami', 'id', 'pwd', 'ls', 'ls -la', 'cat Desktop/passwords.txt', 'cat /root/flag.txt', 'grep -ri password Documents',
    'find /', 'hostname', 'uname -a', 'ps aux', 'env', 'ip a', 'ss -lntp', 'sudo -l', 'tree', 'du -sh', 'history', 'help'];
  for (const pc of P.all()) {
    let sh;
    try { sh = P.shell(pc, pc.user); } catch (e) { badCmd.push(pc.hostname + ' session threw ' + e.message); continue; }
    const run = typeof sh === 'function' ? sh : sh.run;
    if (typeof run !== 'function') { badCmd.push(pc.hostname + ' session has no run()'); continue; }
    for (const c of CMDS) {
      try {
        const out = run(c);
        if (out === undefined || out === null || String(out) === '') badCmd.push(pc.hostname + ' `' + c + '` printed nothing');
        else if (/command not found on /.test(String(out)) && !/^exit|^logout/.test(c)) badCmd.push(pc.hostname + ' `' + c + '` not found');
      } catch (e) { badCmd.push(pc.hostname + ' `' + c + '` threw ' + e.message); }
    }
    const sc = P.scan(pc);
    if (!/Nmap scan report/.test(String(sc)) || !/difficulty:/.test(String(sc))) badCmd.push(pc.hostname + ' nmap has no report');
    if (String(pc.tier || '') && !/^FLAG\{/.test(String(pc.flag || ''))) badCmd.push(pc.hostname + ' flag missing');
  }
  ok('moundshell: every leaked PC answers every shell command', badCmd.length === 0, badCmd.slice(0, 6).join(' | '));
  ok('moundshell: there is a machine for every account on the network', P.count() > 1000, 'pcs=' + P.count());

  /* 6 â a hidden service is reachable by name, by address and from the wiki that fronts the section */
  const unfindable = [];
  for (const site of D.all()) {
    if (!D.find(site.host)) unfindable.push(site.host);
    if (D.find(site.host).host !== site.host) unfindable.push(site.host + ' resolves to another host');
  }
  ok('moundshell: every hidden service resolves by its own address', unfindable.length === 0, unfindable.slice(0, 6).join(' | '));
  const wiki = H.site;
  const wikiIndex = String(D.serve(wiki, '/', new URLSearchParams(''), 'GET').body);
  const notListed = D.all().filter(s => s.host !== wiki.host && !/caught/.test('') && !wikiIndex.includes(s.host) &&
    !(s.host === D.portalHost)).slice(0, 40);
  ok('the wiki front door lists or searches the rest of the network',
    /search/i.test(wikiIndex) && notListed.length > 0 && String(D.serve(wiki, '/', new URLSearchParams('q=' + encodeURIComponent(notListed[0].brand), 'GET')).body).includes('https://' + notListed[0].host + '/'),
    notListed.length ? notListed[0].host : 'nothing outside the directory');
};

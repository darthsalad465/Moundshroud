// Tests that every moundshell command is mapped to every website in the Cyber Desktop browser —
// including all generated fake websites, all booby-trapped fake-virus websites, Cyber Mail phishing sites,
// newly typed custom domains, search.moundshroud.example, moundhub.com, and the currently open browser tab.
const fs = require('fs');
const path = require('path');
const vm = require('vm');

async function run(ok) {
  const root = path.join(__dirname, '..');
  const rd = f => fs.readFileSync(path.join(root, f), 'utf8');

  /* ---- minimal DOM + browser + fetch harness (zero external network allowed) ---- */
  const store = new Map(), session = new Map(), openedUrls = [], fetchCalls = [];
  let virusActive = true, virusCleaned = 0;
  let currentTab = { url: '', title: '' };

  function makeEl(tag) {
    const el = {
      tagName: String(tag || 'DIV').toUpperCase(),
      id: '', className: '', style: {}, dataset: {}, value: '', textContent: '', hidden: false,
      children: [], listeners: {},
      classList: {
        _set: new Set(),
        add(...a) { a.forEach(x => this._set.add(x)); },
        remove(...a) { a.forEach(x => this._set.delete(x)); },
        toggle(x, f) { const on = f === undefined ? !this._set.has(x) : !!f; if (on) this._set.add(x); else this._set.delete(x); return on; },
        contains(x) { return this._set.has(x); }
      },
      setAttribute(k, v) { this['_' + k] = v; },
      getAttribute(k) { return this['_' + k] || null; },
      addEventListener(ev, fn) { (this.listeners[ev] = this.listeners[ev] || []).push(fn); },
      removeEventListener() { },
      focus() { }, blur() { }, remove() { }, click() { },
      appendChild(c) { this.children.push(c); return c; },
      querySelector(sel) {
        if (sel.startsWith('#')) return this._byId[sel.slice(1)] || null;
        if (sel.startsWith('[data-aeshell=')) return this._byAttr[sel] || makeEl('button');
        return null;
      },
      querySelectorAll() { return []; },
      closest() { return null; },
      _byId: {}, _byAttr: {}
    };
    let html = '';
    Object.defineProperty(el, 'innerHTML', {
      get: () => html,
      set: v => {
        html = String(v);
        el._byId = {};
        for (const m of html.matchAll(/id="([^"]+)"/g)) el._byId[m[1]] = makeEl('div');
        el._byAttr = {};
        for (const m of html.matchAll(/data-aeshell="([^"]+)"/g)) el._byAttr['[data-aeshell="' + m[1] + '"]'] = makeEl('button');
      }
    });
    return el;
  }

  const body = makeEl('body');
  const document = {
    readyState: 'complete',
    body,
    createElement: makeEl,
    querySelector: () => null,
    querySelectorAll: () => [],
    addEventListener() { },
    removeEventListener() { },
    fullscreenElement: null
  };

  const A = {
    cur: 'cyber',
    tabs: { cyber: { label: 'Cyber' }, web: { label: 'Browser' } },
    showTab() { },
    toast() { },
    cyberVirus: {
      active: () => virusActive,
      clean: () => { virusActive = false; virusCleaned++; }
    },
    cyberDesktop: {
      api: {
        openSite: url => { openedUrls.push('desktop:' + url); currentTab = { url, title: url }; return true; }
      }
    },
    lib: {
      init: async () => {},
      openUrl: (url, title) => { openedUrls.push('url:' + url); currentTab = { url, title: title || url }; },
      openSite: (url, title) => { openedUrls.push('site:' + url); currentTab = { url, title: title || url }; },
      hub: () => { openedUrls.push('hub:https://moundhub.com'); currentTab = { url: 'https://moundhub.com', title: 'MoundHub' }; },
      tabs: () => currentTab.url ? [currentTab] : [],
      current: () => currentTab,
      libraryOf: () => ({ no: 12, name: 'Fake Internet', note: 'test' })
    }
  };

  const fetch = async (url, opts) => {
    fetchCalls.push(String(url));
    if (String(url).startsWith('/api/appedit/shell?meta=1')) {
      return { ok: true, status: 200, json: async () => ({ files: [{ rel: 'server.js', size: 20, at: 1, text: true }] }) };
    }
    if (String(url).startsWith('/api/appedit/shell?brief=1')) {
      return { ok: true, status: 200, json: async () => ({ sig: 'sig1' }) };
    }
    if (String(url).startsWith('/api/appedit/shellfiles')) {
      return { ok: true, status: 200, json: async () => ({ files: { 'server.js': '// server\n' } }) };
    }
    if (String(url).startsWith('/api/lib/mine')) {
      return { ok: true, status: 200, json: async () => ({ libraries: [] }) };
    }
    if (String(url).startsWith('/api/lib/books')) {
      return { ok: true, status: 200, json: async () => ({ books: [] }) };
    }
    throw new Error('Unexpected fetch during simulated website test: ' + url);
  };

  const ctx = {
    A, document, fetch, console, Math, Date, JSON, Array, Object, String, Number, Boolean, RegExp, Error,
    Map, Set, URL, URLSearchParams, Promise, parseInt, parseFloat, isNaN, isFinite,
    encodeURIComponent, decodeURIComponent,
    btoa: s => Buffer.from(String(s), 'binary').toString('base64'),
    atob: s => Buffer.from(String(s), 'base64').toString('binary'),
    setTimeout: () => 1, clearTimeout() { }, setInterval: () => 1, clearInterval() { },
    addEventListener() { }, removeEventListener() { },
    innerWidth: 1280, innerHeight: 800,
    screen: { width: 1280, height: 800 },
    navigator: { platform: 'Win32', userAgent: 'TestBrowser', hardwareConcurrency: 4, onLine: false, language: 'en-US' },
    localStorage: { getItem: k => store.has(k) ? store.get(k) : null, setItem: (k, v) => store.set(k, String(v)), removeItem: k => store.delete(k) },
    sessionStorage: { getItem: k => session.has(k) ? session.get(k) : null, setItem: (k, v) => session.set(k, String(v)), removeItem: k => session.delete(k) },
    ls: { get: (k, d) => store.has(k) ? store.get(k) : d, set: (k, v) => store.set(k, String(v)) }
  };
  ctx.self = ctx.window = ctx.globalThis = ctx;
  vm.createContext(ctx);

  const loadOrder = [
    'web/js/cyber-web-universe.js',
    'web/js/repo-store.js',
    'web/js/terminal-unix.js',
    'web/js/terminal-commands-shared.js',
    'web/js/terminal-playground-data.js',
    'web/js/terminal-labyrinth-data.js',
    'web/js/terminal-labyrinth-data2.js',
    'web/js/terminal-labyrinth.js',
    'web/js/terminal-puzzles.js',
    'web/js/terminal-pentest.js',
    'web/js/app-shell.js'
  ];
  for (const file of loadOrder) {
    vm.runInContext(rd(file), ctx, { filename: file });
  }

  await ctx.AppShell.open();
  const openText = String(body.children[0].querySelector('#aeshellout').dataset.text || '');
  ok('moundshell: opens and initializes bash room cleanly', !/failed to start|Could not read/i.test(openText), openText.slice(-300));
  const runCmd = async cmd => {
    const out = await ctx.AppShell.exec(cmd);
    if (out != null) return String(out);
    /* room.run commands append to lines via say() and return undefined from exec() */
    const outEl = body.children[0].querySelector('#aeshellout');
    return outEl ? String(outEl.dataset.text || '') : '';
  };

  /* helper to capture just the new output of a single exec() call */
  const execText = async cmd => {
    const outEl = body.children[0].querySelector('#aeshellout');
    const before = outEl ? String(outEl.dataset.text || '') : '';
    const ret = await ctx.AppShell.exec(cmd);
    if (typeof ret === 'string' && ret) return ret;
    const after = outEl ? String(outEl.dataset.text || '') : '';
    return after.startsWith(before) ? after.slice(before.length) : after;
  };

  const CW = A.cyberWeb;
  CW.ensure();
  const allSites = CW.all();
  const trappedSites = CW.trapped();
  const safeSite = allSites.find(s => !s.trapped);
  const virusSite = trappedSites.find(s => !/\.example$/.test(s.host));
  const phishSite = CW.locate('moundshroud-help.example')?.site;
  const mailHosts = ['moundshroud-help.example', 'moundshroud-pay.example', 'account-review.example',
    'invoice-portal.example', 'status-page.example', 'runbook.moundshroud.lab', 'helpdesk.moundshroud.lab',
    'accounts.moundshroud.lab', 'status.moundshroud.lab'];

  const nonScamCats = new Set(['gov', 'gov-dept', 'gov-secret', 'revenue', 'border', 'prison', 'police',
    'university', 'school', 'library', 'museum', 'clinic', 'dentist', 'vet', 'charity', 'church',
    'transit', 'water', 'grid', 'energy', 'weather', 'law']);
  const nonPhishTrapped = trappedSites.filter(s => !mailHosts.includes(s.host));
  const bogusTrapped = nonPhishTrapped.filter(s => nonScamCats.has(s.cat.id));
  const trappedRatio = trappedSites.length / allSites.length;
  ok('cyberWeb: catalogue has 320+ sites, ~1/8th trapped/scam sites (only plausible categories — never gov/civic/medical/edu), and includes all Cyber Mail domains',
    allSites.length >= 320 && trappedRatio >= 0.08 && trappedRatio <= 0.17 && bogusTrapped.length === 0 &&
    !!safeSite && !!virusSite && !!phishSite && phishSite.trapped && !!virusSite.virus && !!virusSite.ip &&
    mailHosts.every(h => !!CW.locate(h)?.site),
    JSON.stringify({ total: allSites.length, trapped: trappedSites.length, ratio: +trappedRatio.toFixed(3), bogusTrapped: bogusTrapped.map(s => s.cat.id), missingMail: mailHosts.filter(h => !CW.locate(h)?.site) }));

  /* 1. Every fake website (safe, trapped fake-virus, phishing, custom domain, portal, moundhub) works with curl, wget, pipes */
  const envOut = await execText('curl -s https://' + virusSite.host + '/.env');
  const pipeOut = await execText('curl -s https://' + virusSite.host + '/.env | grep ADMIN_PATH');
  const trapScriptOut = await execText('curl -s https://' + virusSite.host + virusSite.virus.scriptPath);
  const headOut = await execText('curl -I https://' + virusSite.host + '/');
  const customOut = await execText('curl -s https://custom-virus-check.xyz/robots.txt');
  const portalOut = await execText('curl -s https://search.moundshroud.example/?q=bank');
  const hubOut = await execText('curl -s https://moundhub.com/');
  const wgetOut = await execText('wget https://' + virusSite.host + '/robots.txt');
  const catWget = await execText('cat robots.txt');

  ok('moundshell curl & wget: serve real responses (incl. .env, robots.txt, virus trap script, pipes, custom domains, portal, moundhub)',
    envOut.includes('ADMIN_PATH=' + virusSite.adminPath) &&
    pipeOut.includes('ADMIN_PATH=' + virusSite.adminPath) &&
    trapScriptOut.includes(virusSite.virus.name) &&
    headOut.includes('X-CD-Trap: ' + virusSite.virus.name) &&
    customOut.includes('Disallow:') &&
    portalOut.includes('Moundshroud Search') &&
    hubOut.includes('MoundHub') &&
    wgetOut.includes(virusSite.ip) &&
    catWget.includes(virusSite.adminPath),
    JSON.stringify({ envOut: envOut.slice(0, 260), pipeOut: pipeOut.slice(0, 260), headOut: headOut.slice(0, 260) }));

  /* 2. Recon & network commands map to trapped fake-virus sites, safe sites, IPs, custom domains, portal, moundhub */
  const pingOut = await execText('ping -c 2 ' + virusSite.host);
  const digOut = await execText('dig ' + virusSite.host);
  const nslookupOut = await execText('nslookup ' + virusSite.ip);
  const hostOut = await execText('host ' + virusSite.host);
  const whoisOut = await execText('whois ' + virusSite.host);
  const traceOut = await execText('traceroute ' + virusSite.host);
  const nmapOut = await execText('nmap -sV --script ' + virusSite.host);
  const nmapScriptOut = await execText('nmap -sV --script vuln ' + virusSite.host);
  const masscanOut = await execText('masscan ' + virusSite.host);
  const whatwebOut = await execText('whatweb https://' + virusSite.host);
  const niktoOut = await execText('nikto -h https://' + virusSite.host);
  const gobusterOut = await execText('gobuster dir -t 20 -u https://' + virusSite.host);
  const ffufOut = await execText('ffuf -u https://' + virusSite.host + '/FUZZ');
  const dirbOut = await execText('dirb https://' + virusSite.host);
  const feroxOut = await execText('feroxbuster -u https://' + virusSite.host);
  const wfuzzOut = await execText('wfuzz -u https://' + virusSite.host + '/FUZZ');
  const sqlmapOut = await execText('sqlmap -u "https://' + virusSite.host + '/login?u=1&p=1"');
  const hydraOut = await execText('hydra ' + virusSite.host);
  const wpscanOut = await execText('wpscan ' + virusSite.host);
  const sslOut = await execText('openssl s_client -connect ' + virusSite.host + ':443');
  const ncOut = await execText('nc ' + virusSite.host + ' 80');
  const netcatOut = await execText('netcat ' + virusSite.host + ' 443');
  const sshOut = await execText('ssh ' + virusSite.host);
  const tracepathOut = await execText('tracepath ' + virusSite.host);
  const httpOut = await execText('http https://' + virusSite.host + '/robots.txt');
  const lynxOut = await execText('lynx https://' + virusSite.host);
  const subfinderOut = await execText('subfinder ' + virusSite.host);
  const amassOut = await execText('amass ' + virusSite.host);
  const enum4Out = await execText('enum4linux ' + virusSite.host);
  const smbOut = await execText('smbclient ' + virusSite.host);
  const ftpOut = await execText('ftp ' + virusSite.host);
  const scpOut = await execText('scp ' + virusSite.host);
  const tsharkOut = await execText('tshark ' + virusSite.host);
  const sploitOut = await execText('searchsploit ' + virusSite.host);

  const reconChecks = {
    ping: pingOut.includes(virusSite.ip),
    dig: digOut.includes(virusSite.ip) && digOut.includes(virusSite.virus.name),
    nslookup: nslookupOut.includes(virusSite.host),
    host: hostOut.includes(virusSite.ip),
    whois: whoisOut.includes(virusSite.brand) && whoisOut.includes(virusSite.virus.name),
    trace: traceOut.includes(virusSite.ip),
    tracepath: tracepathOut.includes(virusSite.ip),
    nmap: nmapOut.includes(virusSite.ip) && nmapOut.includes(virusSite.virus.name),
    nmapScript: nmapScriptOut.includes(virusSite.ip),
    masscan: masscanOut.includes(virusSite.ip),
    whatweb: whatwebOut.includes(virusSite.brand) && whatwebOut.includes(virusSite.virus.name),
    nikto: niktoOut.includes(virusSite.adminPath) && niktoOut.includes(virusSite.virus.name),
    gobuster: gobusterOut.includes(virusSite.adminPath) && gobusterOut.includes(virusSite.virus.scriptPath),
    ffuf: ffufOut.includes(virusSite.adminPath),
    dirb: dirbOut.includes(virusSite.adminPath),
    feroxbuster: feroxOut.includes(virusSite.adminPath),
    wfuzz: wfuzzOut.includes(virusSite.adminPath),
    sqlmap: sqlmapOut.includes(virusSite.adminLogin) && sqlmapOut.includes(virusSite.adminPass),
    hydra: hydraOut.includes(virusSite.adminPass),
    wpscan: wpscanOut.includes(virusSite.virus.name),
    ssl: sslOut.includes('CN = ' + virusSite.host),
    nc: ncOut.includes(virusSite.ip),
    netcat: netcatOut.includes(virusSite.ip),
    ssh: sshOut.includes('breach ' + virusSite.host),
    http: httpOut.includes(virusSite.adminPath),
    lynx: lynxOut.includes(virusSite.brand),
    subfinder: subfinderOut.includes('api.' + virusSite.host),
    amass: amassOut.includes('admin.' + virusSite.host),
    enum4linux: enum4Out.includes(virusSite.virus.name),
    smbclient: smbOut.includes(virusSite.host),
    ftp: ftpOut.includes(virusSite.host),
    scp: scpOut.includes(virusSite.host),
    tshark: tsharkOut.includes(virusSite.virus.name),
    searchsploit: sploitOut.includes(virusSite.virus.name)
  };
  ok('moundshell recon & offensive commands: all 34 network/web/pentest commands map to fake & fake-virus sites',
    Object.values(reconChecks).every(Boolean),
    JSON.stringify(Object.entries(reconChecks).filter(([, v]) => !v).map(([k]) => k)));

  /* 3. browser, paths, targets, virus, app, tool commands */
  const openRes = await execText('browser open ' + virusSite.host);
  const tabsOut = await execText('browser tabs');
  const readCur = await execText('browser read current');
  const srcVirus = await execText('browser source virus 1');
  const sitesVirus = await execText('browser virus');
  const targetsVirus = await execText('targets virus');
  const pathsVirus = await execText('paths https://' + virusSite.host + '/');
  const pathsCurrent = await execText('paths current');
  const pathsHub = await execText('paths moundhub.com');
  const pathsPortal = await execText('paths search.moundshroud.example');
  const virusScan = await execText('virus scan ' + virusSite.host);
  const virusClean = await execText('virus clean');
  const appOpenSite = await execText('app open ' + safeSite.host);

  ok('moundshell browser/paths/targets/virus/app: map to current tab, fake-virus sites, safe sites, moundhub, and search portal',
    openRes.includes(virusSite.host) && openedUrls.some(u => u.includes(virusSite.host)) &&
    tabsOut.includes(virusSite.host) && tabsOut.includes(virusSite.virus.name) &&
    readCur.includes(virusSite.brand) && readCur.includes(virusSite.virus.name) &&
    srcVirus.includes('<!doctype html>') &&
    sitesVirus.includes('TRAPPED FAKE-VIRUS WEBSITES') &&
    targetsVirus.includes('FAKE VIRUS') &&
    pathsVirus.includes(virusSite.virus.scriptPath) &&
    pathsCurrent.includes(virusSite.host) &&
    pathsHub.includes('moundhub.com') &&
    pathsPortal.includes('search.moundshroud.example') &&
    virusScan.includes(virusSite.virus.name) &&
    virusClean.includes('anti-malware') && virusCleaned === 1 && !virusActive &&
    appOpenSite.includes(safeSite.host));

  /* 4. Toolkit `tool <name>` commands answer from simulated Cyber Desktop sites without external fetch */
  const fetchBeforeTools = fetchCalls.length;
  const tDns = await execText('tool dns ' + virusSite.host);
  const tRev = await execText('tool reverse ' + virusSite.ip);
  const tWhois = await execText('tool whois ' + virusSite.host);
  const tHeaders = await execText('tool headers https://' + virusSite.host);
  const tFp = await execText('tool fingerprint https://' + virusSite.host);
  const tPort = await execText('tool portscan ' + virusSite.host);
  const tTls = await execText('tool tlscert ' + virusSite.host);
  const tSub = await execText('tool subdomains ' + virusSite.host);
  const tSec = await execText('secrets ' + virusSite.host);
  const tStr = await execText('strings ' + virusSite.host);
  ok('moundshell toolkit (tool dns/reverse/whois/headers/fingerprint/portscan/tlscert/subdomains/secrets/strings): mapped to Cyber Desktop sites with zero real network calls',
    fetchCalls.length === fetchBeforeTools &&
    tDns.includes(virusSite.ip) &&
    tRev.includes(virusSite.host) &&
    tWhois.includes(virusSite.virus.name) &&
    tHeaders.includes('X-CD-Trap') &&
    tFp.includes(virusSite.virus.name) &&
    tPort.includes('8080') &&
    tTls.includes(virusSite.host) &&
    tSub.includes('api.' + virusSite.host) &&
    tSec.includes('FAKE_VIRUS_TRAP') &&
    tStr.includes(virusSite.brand));

  /* 5. `browser breach` & `breach` work end-to-end on trapped fake-virus sites with real host/adminPath/.env/trap */
  const bStart = await execText('browser breach ' + virusSite.host);
  const bTargets = await execText('targets');
  const bNikto = await execText('nikto -h http://' + virusSite.host);
  const bEnv = await execText('curl -s http://' + virusSite.host + '/.env');
  const bTrap = await execText('curl -s http://' + virusSite.host + virusSite.virus.scriptPath);
  const bLogin = await execText('curl "http://' + virusSite.host + '/login?u=' + encodeURIComponent(virusSite.adminLogin) + '&p=' + encodeURIComponent(virusSite.adminPass) + '"');
  const bStaff = await execText('curl http://' + virusSite.host + virusSite.adminPath);
  const bSwitch = await execText('target ' + phishSite.host);
  const bEnd = await execText('breach end');

  ok('moundshell breach & browser breach: preserve real fake-virus host, .env, virus script, leaked login, staff flag, and live target switching',
    bStart.includes(virusSite.host) && bStart.includes(virusSite.virus.name) &&
    bTargets.includes(virusSite.host) && bTargets.includes(virusSite.virus.name) &&
    bNikto.includes(virusSite.virus.name) &&
    bEnv.includes('ADMIN_PASSWORD=' + virusSite.adminPass) &&
    bTrap.includes(virusSite.virus.name) &&
    bLogin.includes('Signed in as <b>admin') &&
    bStaff.includes(virusSite.flag) &&
    bSwitch.includes(phishSite.host) &&
    bEnd.includes('Left the breach range'),
    JSON.stringify({ bStart: bStart.slice(0, 80), bLogin: bLogin.slice(0, 60), bSwitch: bSwitch.slice(0, 60) }));

  /* 6. `guide <fake-virus-site>` starts breach & walkthrough directly on that site */
  const gOut = await execText('guide ' + phishSite.host);
  await execText('breach end');
  ok('moundshell guide <site>: launches breach & walkthrough directly on any fake-virus website',
    gOut.includes(phishSite.host) && gOut.includes('STEP 1 OF'));

  /* 7. Confirm zero external/cyber API fetch calls leaked */
  const badFetches = fetchCalls.filter(u => /\/api\/cyber\/|^https?:\/\//i.test(u));
  ok('moundshell cyber-web mapping: zero external or /api/cyber network requests for Cyber Desktop websites',
    badFetches.length === 0, JSON.stringify(badFetches));

  /* 8. Cyber Desktop Browser Fake Internet tab, hyperlinks, Random button & iframe mode transitions (real lib.js + libframe.js) */
  {
    const els = new Map(), winListeners = {}, docListeners = {};
    let virusStarts = 0;
    const mkDomEl = (tag, id) => {
      const attrs = {};
      const el = {
        tagName: String(tag || 'DIV').toUpperCase(),
        id: id || '', className: '', style: { setProperty() { } }, dataset: {}, value: '', textContent: '',
        disabled: false, offsetHeight: 40, children: [], parentElement: null, nextSibling: null,
        isConnected: true, contentWindow: { postMessage() { } },
        classList: {
          _s: new Set(),
          add(...a) { a.forEach(x => this._s.add(x)); },
          remove(...a) { a.forEach(x => this._s.delete(x)); },
          toggle(x, f) { const on = f === undefined ? !this._s.has(x) : !!f; if (on) this._s.add(x); else this._s.delete(x); return on; },
          contains(x) { return this._s.has(x); }
        },
        setAttribute(k, v) { attrs[k] = String(v); },
        getAttribute(k) { return k in attrs ? attrs[k] : null; },
        removeAttribute(k) { delete attrs[k]; if (k === 'srcdoc') el._srcdoc = ''; if (k === 'src') el._src = ''; },
        hasAttribute(k) { return k in attrs; },
        addEventListener(ev, fn) { (el._ev[ev] = el._ev[ev] || []).push(fn); },
        removeEventListener() { },
        _ev: {},
        appendChild(c) {
          if (c.parentElement) {
            const idx = c.parentElement.children.indexOf(c);
            if (idx >= 0) c.parentElement.children.splice(idx, 1);
          }
          c.parentElement = c.parentNode = el; c.isConnected = true; el.children.push(c); return c;
        },
        insertBefore(c) { return el.appendChild(c); },
        get lastElementChild() { return el.children[el.children.length - 1] || null; },
        remove() {
          if (el.parentElement) {
            const idx = el.parentElement.children.indexOf(el);
            if (idx >= 0) el.parentElement.children.splice(idx, 1);
            el.parentElement = el.parentNode = null;
          }
          el.isConnected = false;
        },
        focus() { el._focused = true; }, blur() { }, select() { }, click() { if (el.onclick) el.onclick({ target: el, preventDefault() { }, stopPropagation() { } }); },
        getBoundingClientRect() { return { left: 0, top: 0, width: 800, height: 600 }; },
        _qMap: {},
        querySelector(sel) { return el._qMap[sel] || null; }, querySelectorAll() { return []; }, closest() { return null; },
        contains() { return true; }
      };
      let html = '';
      Object.defineProperty(el, 'innerHTML', {
        get: () => html,
        set: v => {
          html = String(v);
          el._qMap = {};
          for (const m of html.matchAll(/id="([^"]+)"/g)) {
            if (!els.has(m[1])) els.set(m[1], mkDomEl('div', m[1]));
          }
          for (const m of html.matchAll(/\b(data-[a-z-]+)(?:="([^"]*)")?/g)) {
            const sel = m[2] != null ? '[' + m[1] + '="' + m[2] + '"]' : '[' + m[1] + ']';
            if (!el._qMap[sel]) el._qMap[sel] = mkDomEl('div');
          }
        }
      });
      Object.defineProperty(el, 'srcdoc', {
        get: () => el._srcdoc || '',
        set: v => {
          el._srcdoc = String(v);
          attrs.srcdoc = el._srcdoc;
          if (typeof el.onload === 'function') el.onload();
        }
      });
      Object.defineProperty(el, 'src', {
        get: () => el._src || '',
        set: v => {
          el._src = String(v);
          attrs.src = el._src;
          if (typeof el.onload === 'function') el.onload();
        }
      });
      if (id) els.set(id, el);
      return el;
    };

    const pageRoot = mkDomEl('div', 'p-web');
    const homeParent = mkDomEl('div', 'main');
    homeParent.appendChild(pageRoot);
    const deskHost = mkDomEl('div', 'cd-browser-host');
    const deskEl = mkDomEl('div', 'cd-desktop');
    const bDoc = {
      head: mkDomEl('head'),
      body: mkDomEl('body'),
      activeElement: null,
      createElement: tag => mkDomEl(tag),
      getElementById: id => els.get(id) || null,
      querySelector: sel => sel.includes('cd-desktop') ? deskEl : null,
      querySelectorAll: () => [],
      addEventListener(ev, fn) { (docListeners[ev] = docListeners[ev] || []).push(fn); },
      removeEventListener() { }
    };
    const bStore = new Map();
    let libSearchCalls = 0;
    const bA = {
      cur: 'cyber',
      caps: {},
      ready: [],
      on() { },
      registerTab() { },
      showTab() { },
      toast() { },
      copy() { },
      az: arr => arr.slice().sort(),
      api: async url => {
        if (url === '/api/lib/books') return {
          available: true,
          books: [
            { name: 'wikipedia_en_all', title: 'Wikipedia', category: 'Encyclopedia' },
            { name: 'wiktionary_en_all', title: 'Wiktionary', category: 'Dictionary' },
            { name: 'stackexchange_unix', title: 'Unix & Linux', category: 'Q&A' }
          ]
        };
        if (url === '/api/lib/mine') return { libraries: [{ id: 'my-notes', title: 'My Offline Notes' }] };
        return {};
      },
      fav: { has: () => false, list: () => [], visit() { }, open() { }, toggle() { } },
      bm: { list: () => [], track() { }, restore() { }, add: () => ({ p: 0 }), menu() { } },
      websearch: { mount() { }, focus() { }, search() { libSearchCalls++; }, dict() { } },
      cyberVirus: { start: () => { virusStarts++; }, active: () => virusStarts > 0, clean() { } }
    };
    const bCtx = {
      A: bA, $: id => els.get(id) || null,
      esc: s => String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c])),
      ls: { get: (k, d) => bStore.has(k) ? bStore.get(k) : d, set: (k, v) => bStore.set(k, String(v)) },
      location: { protocol: 'http:', hostname: '127.0.0.1', port: '8765', origin: 'http://127.0.0.1:8765', href: 'http://127.0.0.1:8765/' },
      document: bDoc,
      addEventListener(ev, fn) { (winListeners[ev] = winListeners[ev] || []).push(fn); },
      removeEventListener() { },
      setTimeout: fn => 1, clearTimeout() { },
      console, Math, Date, JSON, Array, Object, String, Number, Boolean, RegExp, Error, Map, Set, URL, URLSearchParams, Promise,
      parseInt, parseFloat, isNaN, isFinite, encodeURIComponent, decodeURIComponent,
      fetch: async () => ({ json: async () => [] })
    };
    bCtx.window = bCtx.self = bCtx.globalThis = bCtx;
    vm.createContext(bCtx);
    for (const f of ['web/js/libframe.js', 'web/js/cyber-web-universe.js', 'web/js/lib.js']) {
      vm.runInContext(rd(f), bCtx, { filename: f });
    }
    bA.lib.dock(deskHost);
    await bA.lib.init();

    const wbar = els.get('wbar');
    const clickChip = act => wbar.onclick({ target: { closest: () => ({ dataset: { a: act } }) } });
    const framesEl = els.get('lframes');
    const activeFrame = () => framesEl.children[framesEl.children.length - 1];
    const sendCdweb = (msg) => {
      const fr = activeFrame();
      for (const fn of (winListeners.message || [])) fn({ data: msg, source: fr.contentWindow, origin: 'null' });
    };

    /* Click Fake internet chip -> loads search.moundshroud.example with valid inline script */
    clickChip('fakes');
    await new Promise(r => setImmediate(r));
    const portalFr = activeFrame();
    const portalHtml = portalFr.srcdoc;
    const scriptMatch = /<script>([\s\S]*?)<\/script>/.exec(portalHtml);
    let scriptParses = false;
    if (scriptMatch) { try { new Function(scriptMatch[1]); scriptParses = true; } catch (e) { scriptParses = false; } }

    /* Execute the actual inline script inside a tiny mock iframe DOM to verify link & form click interception */
    const posted = [];
    const mockListeners = {};
    const iframeScriptCtx = {
      document: { addEventListener: (ev, fn) => { (mockListeners[ev] = mockListeners[ev] || []).push(fn); } },
      parent: { postMessage: m => posted.push(m) },
      window: { getSelection: () => '' },
      URLSearchParams,
      FormData: class { constructor(f) { return f._entries || []; } }
    };
    vm.runInNewContext(scriptMatch[1], iframeScriptCtx);
    let prevented = false;
    const mockAnchor = { getAttribute: k => k === 'href' ? 'https://moundshroud-help.example/' : null };
    for (const fn of mockListeners.click) {
      fn({ target: { closest: sel => sel === 'a[href]' ? mockAnchor : null }, preventDefault() { prevented = true; }, stopPropagation() { } });
    }
    const mockForm = { tagName: 'FORM', getAttribute: k => k === 'action' ? '/' : (k === 'method' ? 'get' : null), _entries: [['q', 'bank']] };
    const mockBtn = { form: mockForm, getAttribute: () => 'submit' };
    for (const fn of mockListeners.click) {
      fn({ target: { closest: sel => sel.includes('button') ? mockBtn : null }, preventDefault() { }, stopPropagation() { } });
    }

    /* Follow every portal route & hyperlink via postMessage */
    sendCdweb({ cdweb: '/mail' });
    const mailUrl = bA.lib.current().url;
    const mailHtml = activeFrame().srcdoc;
    sendCdweb({ cdweb: 'https://moundshroud-help.example/' });
    const phishUrl = bA.lib.current().url;
    sendCdweb({ cdweb: '/contact', cdwebMethod: 'POST' });
    const contactThanks = activeFrame().srcdoc.includes('Thanks');
    sendCdweb({ cdweb: 'https://search.moundshroud.example/' });
    sendCdweb({ cdweb: '/?q=Bank' });
    const searchUrl = bA.lib.current().url;
    sendCdweb({ cdweb: '/all' });
    const allUrl = bA.lib.current().url;
    sendCdweb({ cdweb: '/trapped' });
    const trappedUrl = bA.lib.current().url;
    sendCdweb({ cdweb: '/random' });
    const portalRandUrl = bA.lib.current().url;

    /* Press toolbar Random chip 8 times -> alternates cleanly between fake websites AND EVERY downloaded + imported library */
    const randomUrls = [], randomFramesClean = [];
    for (let i = 0; i < 8; i++) {
      clickChip('rand');
      await new Promise(r => setImmediate(r));
      await new Promise(r => setImmediate(r));
      const u = bA.lib.current().url;
      const frNow = activeFrame();
      randomUrls.push(u);
      randomFramesClean.push(/^https:\/\//.test(u) ? (frNow._fake === true && frNow.hasAttribute('srcdoc')) : (frNow._fake === false && !frNow.hasAttribute('srcdoc')));
    }
    const randHasFakes = randomUrls.filter(u => /^https:\/\//.test(u)).length >= 4;
    const randHitsAllBooks = ['wikipedia_en_all', 'wiktionary_en_all', 'stackexchange_unix'].every(bk => randomUrls.some(u => u.includes('content=' + bk)));
    const randHitsMine = randomUrls.some(u => u === '/api/lib/mine/my-notes.html');
    const allRandFramesClean = randomFramesClean.every(Boolean);

    /* Switch Fake site (srcdoc) -> MoundHub (src) -> Fake site (srcdoc): srcdoc must clear cleanly */
    clickChip('hub');
    await new Promise(r => setImmediate(r));
    const hubFr = activeFrame();
    const hubClean = hubFr._hub === true && !hubFr.hasAttribute('srcdoc') && hubFr.src === '/web/moundhub.html';

    clickChip('fakes');
    await new Promise(r => setImmediate(r));
    const backToFakeOk = activeFrame()._fake === true && bA.lib.current().url.startsWith('https://search.moundshroud.example/');

    /* Typing a query in the address bar on a Fake Internet tab searches ONLY the fake internet, never downloaded libraries */
    const wq = els.get('wq');
    wq.value = 'xyznonexistentterm999';
    for (const fn of (wq._ev.keydown || [])) fn({ key: 'Enter', preventDefault() { } });
    const stayedInFakeSearch = bA.lib.current().url.startsWith('https://search.moundshroud.example/?q=') && libSearchCalls === 0;

    ok('Cyber Desktop Fake Internet tab & toolbar Random button: inline script works, Fake Internet stays strictly on fake/mail sites, toolbar Random visits BOTH fake websites AND the entire downloaded + imported library cleanly',
      scriptParses && prevented &&
      posted.some(m => m.cdweb === 'https://moundshroud-help.example/') &&
      posted.some(m => m.cdweb === '/?q=bank') &&
      mailUrl.includes('/mail') && mailHtml.includes('moundshroud-help.example') &&
      phishUrl === 'https://moundshroud-help.example/' && virusStarts > 0 &&
      contactThanks &&
      searchUrl === 'https://search.moundshroud.example/?q=Bank' &&
      allUrl === 'https://search.moundshroud.example/all' &&
      trappedUrl === 'https://search.moundshroud.example/trapped' &&
      /^https:\/\//.test(portalRandUrl) && !portalRandUrl.includes('search.moundshroud.example') &&
      randHasFakes && randHitsAllBooks && randHitsMine && allRandFramesClean &&
      hubClean && backToFakeOk && stayedInFakeSearch,
      JSON.stringify({ scriptParses, prevented, mailUrl, phishUrl, virusStarts, contactThanks, searchUrl, allUrl, trappedUrl, portalRandUrl, randomUrls, randHasFakes, randHitsAllBooks, randHitsMine, allRandFramesClean, hubClean, backToFakeOk, stayedInFakeSearch }));

    /* 9. Realistic URL-matched webpages, working interactive flows (cart, articles, threads), vulnerabilities & infinite topics */
    const W = bA.cyberWeb;
    const ramen = W.visit('https://midnight-ramen.shop/').site;
    const herald = W.visit('https://daily-mars-herald.news/').site;
    const bank = W.visit('https://nordic-bank-trust.com/').site;
    const board = W.visit('https://zero-day-board.xyz/').site;
    const devApi = W.visit('https://quantum-cloud-api.dev/').site;

    const ramenHome = W.serve(ramen, '/', 'GET').body;
    const ramenCart = W.serve(ramen, '/cart?add=1', 'GET').body;
    const ramenOrder = W.serve(ramen, '/checkout?name=Alice&email=a@b.c', 'POST').body;
    const ramenEnv = W.serve(ramen, '/.env', 'GET').body;
    const ramenGit = W.serve(ramen, '/.git/HEAD', 'GET').body;
    const ramenSqli = W.serve(ramen, "/login?u=' OR 1=1--&p=x", 'GET').body;
    const heraldArt = W.serve(herald, '/article/1?author=Sam&comment=Great+reporting', 'POST').body;
    const boardThread = W.serve(board, '/thread/1?author=h4x&reply=Confirmed+on+v2', 'POST').body;

    const domainTrueOk =
      ramen.cat.id === 'food' && ramen.theme === 'commerce' && ramenHome.includes('Add to cart') &&
      ramenCart.includes('Place order') && ramenOrder.includes('Order Confirmed') &&
      ramenEnv.includes('ADMIN_PASSWORD=' + ramen.adminPass) && ramenGit.includes('refs/heads/main') &&
      ramenSqli.includes('Signed in as admin') &&
      herald.cat.id === 'news' && herald.theme === 'editorial' && heraldArt.includes('Great reporting') &&
      bank.cat.id === 'bank' && bank.theme === 'finance' &&
      board.cat.id === 'hackerforum' && board.theme === 'community' && boardThread.includes('Confirmed on v2') &&
      (devApi.cat.id === 'devtools' || devApi.cat.id === 'saas') && devApi.theme === 'saas';

    /* Infinite topic search & infinite per-category pagination */
    const p1 = W.serve(W.portal, '/?q=underwater+clockwork+orchids&p=1', 'GET').body;
    const p2 = W.serve(W.portal, '/?q=underwater+clockwork+orchids&p=2', 'GET').body;
    const catBankP1 = W.serve(W.portal, '/?cat=bank&p=1', 'GET').body;
    const catBankP2 = W.serve(W.portal, '/?cat=bank&p=2', 'GET').body;
    const hostsIn = html => [...html.matchAll(/https:\/\/([a-z0-9.-]+)\//g)].map(m => m[1]).filter(h => h !== 'search.moundshroud.example');
    const p1Hosts = new Set(hostsIn(p1)), p2Hosts = new Set(hostsIn(p2));
    const freshOnP2 = [...p2Hosts].filter(h => !p1Hosts.has(h));
    const bankP1Hosts = new Set(hostsIn(catBankP1)), bankP2Hosts = new Set(hostsIn(catBankP2));
    const freshBankP2 = [...bankP2Hosts].filter(h => !bankP1Hosts.has(h));
    /* Verify newly synthesized infinite-topic site ALSO has full vulnerabilities */
    const synthSite = W.locate('https://' + [...p1Hosts][0] + '/')?.site;
    const synthVulnOk = !!synthSite &&
      W.serve(synthSite, '/.env', 'GET').body.includes('ADMIN_PATH=' + synthSite.adminPath) &&
      W.serve(synthSite, '/api/orders/' + synthSite.orders[0].id, 'GET').status === 200;

    ok('Fake Internet realism & infinite generation: pages match their URL & theme, interactive flows work, every site has vulnerabilities, and search/categories generate infinite unique topics',
      domainTrueOk &&
      p1.toLowerCase().includes('underwater clockwork orchids') &&
      p1Hosts.size >= 15 && freshOnP2.length >= 15 &&
      bankP1Hosts.size >= 15 && freshBankP2.length >= 15 &&
      synthVulnOk,
      JSON.stringify({ domainTrueOk, p1Count: p1Hosts.size, freshOnP2: freshOnP2.length, bankP1: bankP1Hosts.size, freshBankP2: freshBankP2.length, synthVulnOk }));

    /* 9b. View page source comes to the forefront even when fullscreened (Cyber Desktop / Browser / any app page) */
    const fsShell = mkDomEl('section', 'cd-shell-fs');
    bDoc.fullscreenElement = fsShell;
    bA.lib.viewSource();
    const srcEl = fsShell.lastElementChild;
    const mountedInFs = !!srcEl && srcEl.className === 'srcview' && srcEl.parentNode === fsShell && srcEl._focused === true &&
      /<!doctype html>/i.test(srcEl.querySelector('[data-src-code]').textContent || '');
    /* Leaving fullscreen re-mounts the open source panel onto document.body automatically */
    bDoc.fullscreenElement = null;
    for (const fn of (docListeners.fullscreenchange || [])) fn();
    const movedToBody = srcEl && srcEl.parentNode === bDoc.body;
    /* Re-entering fullscreen + calling viewSource for any non-browser page brings it to the forefront inside fullscreen */
    bDoc.fullscreenElement = fsShell;
    bA.lib.viewSource({ url: 'http://127.0.0.1/#notes', title: 'Notes', html: '<!doctype html><section id="p-notes">hello</section>' });
    const customInFs = srcEl.parentNode === fsShell && fsShell.lastElementChild === srcEl &&
      srcEl.querySelector('[data-src-code]').textContent.includes('id="p-notes"');
    const libSrc = rd('web/js/lib.js'), ctxSrc = rd('web/js/context-menu.js'), coreSrc = rd('web/js/core.js'), chatCss = rd('web/chat-ui.css');
    const zOrderOk = /srcview\{[^}]*z-index:2147483500/.test(libSrc) && /#ctxm\s*\{[^}]*z-index:\s*2147483600/.test(chatCss) &&
      /View page source/.test(ctxSrc) && /querySelector\('\.srcview, #ctxm'\)/.test(coreSrc);
    ok('View page source in fullscreen: mounts on top of document.fullscreenElement, follows fullscreen transitions, works on any page, and keeps top z-index ordering',
      mountedInFs && movedToBody && customInFs && zOrderOk,
      JSON.stringify({ mountedInFs, movedToBody, customInFs, zOrderOk }));
  }

  /* 10. moundshell git commands strictly interact ONLY with MoundHub (https://moundhub.com) in the app's browser */
  {
    const fetchBeforeGit = fetchCalls.length;
    const lockedStatus = await execText('git status');
    const unlocked = ctx.RepoStore.unlock('Moundshroud');

    const initOut = await execText('git init demo-app');
    const remoteV = await execText('git remote -v');

    /* External / non-MoundHub URLs must be rejected on every git remote/sync command */
    const blockedCmds = [
      'git remote add origin https://github.com/user/repo.git',
      'git remote set-url origin https://gitlab.com/org/repo.git',
      'git remote add mirror git@github.com:user/repo.git',
      'git push https://github.com/user/repo.git',
      'git push origin https://example.com/repo.git',
      'git pull https://github.com/user/repo.git',
      'git fetch https://github.com/user/repo.git',
      'git clone https://github.com/user/repo.git',
      'git clone https://moundhub.com.evil.com/repo.git',
      'git clone sshuser@evil.com:repo.git'
    ];
    const blockedResults = [];
    for (const c of blockedCmds) blockedResults.push([c, await execText(c)]);
    const allBlocked = blockedResults.every(([, out]) => /fatal: moundshell git only/i.test(out) && out.includes('https://moundhub.com'));

    /* Even a pre-existing non-MoundHub remote in RepoStore must be blocked by push/pull/fetch */
    const curRepo = ctx.RepoStore.current();
    ctx.RepoStore.setRemote(curRepo.id, 'ext', 'https://github.com/external/repo.git');
    const pushExt = await execText('git push ext');
    const pullExt = await execText('git pull ext');
    const fetchExt = await execText('git fetch ext');
    const preExistingBlocked = [pushExt, pullExt, fetchExt].every(out => /fatal: moundshell git only/i.test(out));
    await execText('git remote rm ext');

    /* Full MoundHub workflow: create file, stage, commit (with & inside quotes), push, fetch, pull, clone, pipes, open */
    await execText('echo "hello moundhub" > hub-note.txt');
    const statusDirty = await execText('git status');
    const addOut = await execText('git add hub-note.txt');
    const commitOut = await execText('git commit -m "first & verified"');
    const pushOut = await execText('git push');
    const fetchOut = await execText('git fetch');
    const pullOut = await execText('git pull');
    const cloneOut = await execText('git clone https://moundhub.com/moundshroud/demo-app.git');
    const pipeLog = await execText('git log --oneline | head -n 1');
    const pipeRemote = await execText('git remote -v | grep moundhub.com');
    const chainStatus = await execText('git status && git branch');
    const openHub = await execText('git open');

    const workflowOk =
      unlocked === true &&
      /repositories are locked/i.test(lockedStatus) &&
      initOut.includes('https://moundhub.com/moundshroud/demo-app.git') &&
      remoteV.includes('https://moundhub.com/moundshroud/demo-app.git') &&
      statusDirty.includes('hub-note.txt') &&
      addOut.includes('staged 1 file') &&
      commitOut.includes('first & verified') && commitOut.includes('https://moundhub.com/moundshroud/demo-app.git') &&
      pushOut.includes('To https://moundhub.com/moundshroud/demo-app.git') &&
      fetchOut.includes('From https://moundhub.com/moundshroud/demo-app.git') &&
      pullOut.includes('Synced 1 file from MoundHub') &&
      cloneOut.includes('Cloning from https://moundhub.com/moundshroud/demo-app.git') &&
      pipeLog.includes('first & verified') &&
      pipeRemote.includes('moundhub.com/moundshroud/demo-app.git') &&
      chainStatus.includes('* main') &&
      openHub.includes('https://moundhub.com') &&
      openedUrls.some(u => u.includes('https://moundhub.com')) &&
      fetchCalls.length === fetchBeforeGit;

    ok('moundshell git: strictly MoundHub-only (blocks all external git URLs, supports full MoundHub workflow, pipes/chains, and zero external network calls)',
      allBlocked && preExistingBlocked && workflowOk,
      JSON.stringify({
        allBlocked, preExistingBlocked, workflowOk,
        failedBlocks: blockedResults.filter(([, out]) => !/fatal: moundshell git only/i.test(out)),
        commitOut: commitOut.slice(0, 120), pushOut: pushOut.slice(0, 120),
        pipeLog: pipeLog.slice(0, 80), pipeRemote: pipeRemote.slice(0, 80)
      }));
  }

  /* 11. Every fake webpage has a unique, deterministic, modern visual design (even within the same category) */
  {
    const W = A.cyberWeb;
    const sample = W.all().slice(0, 40);
    const sameCatShops = W.search('', 12, { grow: true, catId: 'market' }).slice(0, 12);
    const allChecked = sample.concat(sameCatShops);
    const fps = new Set(), surfaces = new Set(), navs = new Set(), heroes = new Set(), cards = new Set(), logos = new Set(), typos = new Set(), footers = new Set();
    let artCount = 0, deterministicOk = true;
    for (const s of allChecked) {
      const html = W.serve(s, '/', 'GET').body;
      const m = /data-design="([^"]+)"/.exec(html);
      if (m) fps.add(m[1]);
      if (html.includes('<svg viewBox="0 0 420 230" class="art-svg"')) artCount++;
      if (s.design) {
        surfaces.add(s.design.surface);
        navs.add(s.design.navStyle);
        heroes.add(s.design.heroStyle);
        cards.add(s.design.cardStyle);
        logos.add(s.design.logoStyle);
        typos.add(s.design.typo.id);
        footers.add(s.design.footerStyle);
      }
    }
    /* Same site renders identically across reloads & subpages */
    const s0 = sameCatShops[0];
    const hHome = W.serve(s0, '/', 'GET').body;
    const hAbout = W.serve(s0, '/about', 'GET').body;
    const fpHome = (/data-design="([^"]+)"/.exec(hHome) || [])[1];
    const fpAbout = (/data-design="([^"]+)"/.exec(hAbout) || [])[1];
    deterministicOk = !!fpHome && fpHome === fpAbout;
    const shopFps = new Set(sameCatShops.map(s => s.design && s.design.fingerprint));

    ok('Fake Internet visual uniqueness: every site renders a unique, deterministic modern design (distinct palettes, navbars, heroes, cards, typography, logos, footers & SVG art)',
      fps.size === new Set(allChecked.map(s => s.host)).size &&
      shopFps.size === sameCatShops.length &&
      deterministicOk &&
      artCount === allChecked.length &&
      surfaces.size >= 5 && navs.size >= 5 && heroes.size >= 5 && cards.size >= 4 && logos.size >= 6 && typos.size >= 6 && footers.size === 3,
      JSON.stringify({
        uniqueTotal: fps.size, expectedTotal: new Set(allChecked.map(s => s.host)).size,
        uniqueShops: shopFps.size, deterministicOk, artCount,
        surfaces: surfaces.size, navs: navs.size, heroes: heroes.size, cards: cards.size, logos: logos.size, typos: typos.size, footers: footers.size
      }));

    /* 12. Expanded catalog (640+ sites, 100+ categories), ultra-detailed content on EVERY page, and interconnected web graph */
    const bootCount = W.all().length;
    const catCount = W.CATS.length;
    const flagshipProbe = ['verge-signal.tech', 'orbit-telemetry.space', 'velvet-espresso.cafe', 'solstice-watches.store', 'neural-foundry.ai', 'pinecone-parks.gov'];
    const flagshipsOk = flagshipProbe.every(h => {
      const hit = W.locate(h);
      return hit && hit.site && hit.site.host === h;
    });
    const probeSites = flagshipProbe.map(h => W.locate(h).site).concat(W.all().slice(60, 76));
    let allRich = true, allWired = true, minLen = Infinity, badSite = null;
    for (const s of probeSites) {
      const h = W.serve(s, '/', 'GET').body;
      minLen = Math.min(minLen, h.length);
      const hasRich = h.length >= 12000 && s.items.length >= 12 && s.posts.length >= 8 &&
        h.includes('hi-grid') && h.includes('Specifications &amp; Comparison Matrix') &&
        h.includes('Verified Community Feedback') && h.includes('<details') &&
        h.includes('Across the Web');
      const extLinks = [...h.matchAll(/href="https:\/\/([a-z0-9.-]+)\/"/g)].map(m => m[1]).filter(x => x !== s.host && x !== 'search.moundshroud.example');
      const uniqueExt = [...new Set(extLinks)];
      const wiredOk = uniqueExt.length >= 6 && uniqueExt.every(host => !!W.locate(host)?.site);
      if (!hasRich) { allRich = false; badSite = { host: s.host, len: h.length, items: s.items.length, posts: s.posts.length }; }
      if (!wiredOk) { allWired = false; badSite = { host: s.host, extCount: uniqueExt.length }; }
    }
    ok('Fake Internet scale, depth & interconnected web graph: 640+ sites across 100+ categories, every page filled with rich sections (zero exceptions) and wired live to 6+ other sites',
      bootCount >= 640 && catCount >= 100 && flagshipsOk && allRich && allWired,
      JSON.stringify({ bootCount, catCount, flagshipsOk, allRich, allWired, minLen, badSite }));
  }
}

module.exports = run;

if (require.main === module) {
  let pass = 0, fail = 0;
  const ok = (name, cond, detail) => {
    if (cond) { pass++; console.log('  ok   ' + name); }
    else { fail++; console.log('  FAIL ' + name + (detail ? '  ->  ' + detail : '')); }
  };
  run(ok).then(() => {
    console.log('\n' + pass + ' passed, ' + fail + ' failed');
    process.exit(fail ? 1 : 0);
  });
}

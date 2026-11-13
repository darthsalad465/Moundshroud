#!/usr/bin/env node
// Page checker for Build mode. A local model runs it to find out whether the page it wrote loads and whether every
// button on it does something. It starts its own headless Microsoft Edge on a temporary profile, drives it over the
// Chrome DevTools Protocol (Node's built-in WebSocket), clicks each control and reports PASS or FAIL per control.
//
//   node check-page.js <file-or-url> [--serve <folder>] [--timeout <ms>]
//   exit 0: loaded, nothing thrown, every control changed the page
//   exit 1: loaded, but an error was thrown or a control did nothing
//   exit 2: could not load, no Edge, a bad target, or a refused target
//
// It opens only files under the working folder, http://localhost and http://127.0.0.1. Requests to anywhere else go
// to a dead proxy. It kills the Edge it started (by PID, then by its profile folder) and deletes that profile.
'use strict';
const fs = require('fs'), path = require('path'), os = require('os'), http = require('http');
const { spawn, spawnSync } = require('child_process'), { pathToFileURL, fileURLToPath } = require('url');

const CLICK_TYPES = ['click', 'mousedown', 'mouseup', 'pointerdown', 'pointerup', 'submit'];
const DEFAULT_TIMEOUT = 30000, CLICK_MS = 5000, SETTLE_MS = 150, PREFIX = 'ms-check-page-', MAX_ERRORS = 20;
const NODE_MSG = 'check-page needs the built-in WebSocket of Node 22 or newer, and this Node ' + process.versions.node + ' has none. Install Node 22 or newer.';
const live = new Set();                                   // sync clean-ups of Edges still running (Ctrl+C, hard timeout)
const sleep = ms => new Promise(r => setTimeout(r, Math.max(0, ms)));
/* waits for p, at most ms, and leaves no timer behind (a stray timer would hold the process open) */
const within = (p, ms) => new Promise(r => { const t = setTimeout(r, ms); p.then(() => { clearTimeout(t); r(); }, () => { clearTimeout(t); r(); }); });

/* ---------- where things are ---------- */

function findEdge(env = process.env) {
  const roots = [...new Set([env['ProgramFiles(x86)'], env.ProgramFiles, env.ProgramW6432].filter(Boolean))];
  for (const r of roots) { const p = path.join(r, 'Microsoft', 'Edge', 'Application', 'msedge.exe'); if (fs.existsSync(p)) return p; }
  return '';
}
const real = p => { try { return fs.realpathSync.native(p); } catch (e) { return path.resolve(p); } };
const inside = (p, dir) => { const r = path.relative(dir, p); return r === '' || (r !== '..' && !r.startsWith('..' + path.sep) && !path.isAbsolute(r)); };

/* a network path (\\host\share, //host/share, \\?\...): touching it makes Windows open an SMB connection and offer
   the user's credentials to that host, so it is refused before any file-system call */
const isUnc = p => /^[\\/]{2}/.test(String(p || ''));
const fileOk = f => { try { return fs.statSync(f).isFile(); } catch (e) { return false; } };

/* target -> { url } | { serve, rel } | { error, refused }. Every check that can refuse runs on the path text first;
   the file system is touched only for a path already known to be local and inside the working folder. */
function resolveTarget(target, o) {
  const work0 = path.resolve(o.workDir || process.cwd());
  const refuse = msg => ({ refused: true, error: 'refused: ' + msg });
  if (isUnc(work0)) return refuse('the working folder ' + work0 + ' is a network path');
  const local = 'only pages on this PC can be checked: a file in the working folder (' + work0 + '), http://localhost or http://127.0.0.1';
  target = String(target || '').trim();
  const isUrl = /^[a-z][a-z0-9+.-]+:/i.test(target);     // a drive letter (C:) has one letter, a scheme has two or more
  if (isUnc(target)) return refuse(target + ' is a network path. ' + local);
  if (o.serve) {
    if (isUnc(o.serve)) return refuse('the folder ' + o.serve + ' is a network path');
    const dir0 = path.resolve(work0, o.serve);
    if (isUnc(dir0) || !inside(dir0, work0)) return refuse('the folder ' + dir0 + ' is outside the working folder ' + work0);
    if (isUrl) return refuse('with --serve, give a file inside the served folder, not an address');
    /* a relative file is looked for in the served folder first, then in the working folder; both must lie inside the served folder */
    const cands = (!target ? [path.join(dir0, 'index.html')] : path.isAbsolute(target) ? [path.resolve(target)] : [path.resolve(dir0, target), path.resolve(work0, target)]).filter(c => !isUnc(c) && inside(c, dir0));
    if (!cands.length) return refuse(target + ' is outside the served folder ' + dir0);
    /* from here on the paths are local and inside the working folder */
    const work = real(work0);
    let st; try { st = fs.statSync(dir0); } catch (e) { }
    if (!st || !st.isDirectory()) return { error: 'the folder to serve was not found: ' + dir0 };
    const rd = real(dir0);
    if (!inside(rd, work)) return refuse('the folder ' + rd + ' is outside the working folder ' + work);
    const f = cands.find(fileOk);
    if (!f) return { error: 'file not found: ' + cands[0] };
    const rf = real(f);
    if (!inside(rf, rd)) return refuse(rf + ' is outside the served folder ' + rd);
    return { serve: rd, rel: path.relative(rd, rf).split(path.sep).map(encodeURIComponent).join('/') };
  }
  if (!target) return { error: 'no page given. Usage: node check-page.js <file> [--serve <folder>] [--timeout <ms>]' };
  if (/^https?:\/\//i.test(target)) {
    let u; try { u = new URL(target); } catch (e) { return { error: 'not a valid address: ' + target }; }
    if (u.hostname !== 'localhost' && u.hostname !== '127.0.0.1') return refuse(target + '. ' + local);
    return { url: u.href };
  }
  if (/^file:/i.test(target)) {
    let u; try { u = new URL(target); } catch (e) { return { error: 'not a valid file address: ' + target }; }
    if (u.hostname && u.hostname.toLowerCase() !== 'localhost') return refuse(target + ' points to another computer. ' + local);
    try { target = fileURLToPath(u.href.replace(/^file:\/\/localhost\//i, 'file:///')); } catch (e) { return { error: 'not a valid file address: ' + target }; }
    if (isUnc(target)) return refuse(target + ' is a network path. ' + local);
  } else if (isUrl) return refuse(target + '. ' + local);
  const f0 = path.resolve(work0, target);
  if (isUnc(f0) || !inside(f0, work0)) return refuse(f0 + ' is outside the working folder ' + work0);
  /* from here on the path is local and inside the working folder */
  const work = real(work0);
  let st; try { st = fs.statSync(f0); } catch (e) { }
  if (!st) return { error: 'file not found: ' + f0 };
  if (!st.isFile()) return { error: f0 + ' is a folder. Give the page file, for example index.html' };
  const rf = real(f0);
  if (!inside(rf, work)) return refuse(rf + ' is outside the working folder ' + work);
  return { url: pathToFileURL(rf).href };
}

/* where a link or a click may lead: a file under the working folder, a file under the served folder, localhost, 127.0.0.1.
   Returns '' when allowed and present, otherwise the reason. Path checks run on the text before any file-system call. */
function destProblem(href, rep) {
  let u; try { u = new URL(href); } catch (e) { return 'is not a valid address: ' + href; }
  if (u.protocol === 'file:') {
    if (u.hostname && u.hostname.toLowerCase() !== 'localhost') return 'points to another computer: ' + href;
    let p; try { p = fileURLToPath(u.href.replace(/^file:\/\/localhost\//i, 'file:///').replace(/[?#].*$/, '')); } catch (e) { return 'is not a valid file address: ' + href; }
    if (isUnc(p) || !inside(p, rep.workDir)) return 'leads outside the working folder: ' + p;
    return fileOk(p) ? '' : 'leads to a page that does not exist: ' + p;
  }
  if (u.protocol === 'http:' || u.protocol === 'https:') {
    if (u.hostname !== 'localhost' && u.hostname !== '127.0.0.1') return 'leads to the internet: ' + href + ' (pages must not use external URLs)';
    if (rep.serveRoot && rep.url && u.origin === new URL(rep.url).origin) {   // our own --serve server: the file must exist
      let p; try { p = path.join(rep.serveRoot, decodeURIComponent(u.pathname)); } catch (e) { return 'is not a valid address: ' + href; }
      if (!inside(p, rep.serveRoot)) return 'leads outside the served folder: ' + href;
      if (u.pathname.endsWith('/')) p = path.join(p, 'index.html');
      return fileOk(p) ? '' : 'leads to a page that does not exist: ' + href;
    }
    return '';
  }
  return '';                                                    // mailto:, tel: and the like open nothing in the page
}

/* ---------- a tiny static server for --serve, on 127.0.0.1 only ---------- */

const TYPES = { '.html': 'text/html; charset=utf-8', '.htm': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.mjs': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.json': 'application/json', '.txt': 'text/plain; charset=utf-8', '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.gif': 'image/gif', '.webp': 'image/webp', '.ico': 'image/x-icon', '.wav': 'audio/wav', '.mp3': 'audio/mpeg', '.ogg': 'audio/ogg', '.wasm': 'application/wasm' };
function serve(root) {
  const srv = http.createServer((req, res) => {
    if (req.method !== 'GET' && req.method !== 'HEAD') { res.writeHead(405); return res.end(); }
    let p; try { p = decodeURIComponent(new URL(req.url, 'http://x').pathname); } catch (e) { res.writeHead(400); return res.end(); }
    try {
      let f = path.join(root, p);
      if (fs.statSync(f).isDirectory()) f = path.join(f, 'index.html');
      const rf = real(f);
      if (!inside(rf, root)) { res.writeHead(403); return res.end(); }
      const body = fs.readFileSync(rf);
      res.writeHead(200, { 'content-type': TYPES[path.extname(rf).toLowerCase()] || 'application/octet-stream', 'cache-control': 'no-store' });
      res.end(req.method === 'HEAD' ? undefined : body);
    } catch (e) {
      if (p === '/favicon.ico') { res.writeHead(204); return res.end(); }
      res.writeHead(404, { 'content-type': 'text/plain' }); res.end('not found');
    }
  });
  return new Promise((ok, no) => { srv.once('error', no); srv.listen(0, '127.0.0.1', () => ok(srv)); });
}

/* ---------- Edge ---------- */

function killTree(pid) { try { spawnSync('taskkill', ['/PID', String(pid), '/T', '/F'], { windowsHide: true, stdio: 'ignore', timeout: 10000 }); } catch (e) { } }
/* Processes are matched by our profile folder on their command line, so the owner's own Edge is never matched.
   .Contains('') matches every string, so both scripts first stop unless the folder name is non-empty and ours. */
const PS_GUARD = "$d = $env:CHECK_PAGE_PROFILE; if (-not $d -or $d -notlike '*" + PREFIX + "*') { exit 0 }; ";
const SWEEP_PS = PS_GUARD + "Get-CimInstance Win32_Process -Filter \"Name='msedge.exe'\" | Where-Object { $_.CommandLine -and $_.CommandLine.Contains($d) } | ForEach-Object { Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue }";
/* PIDs of msedge.exe processes still carrying our profile folder: a child that outlived its parent's tree kill
   (seen: a ProfileImport utility process started as the browser was being killed) */
const LIST_PS = PS_GUARD + "Get-CimInstance Win32_Process -Filter \"Name='msedge.exe'\" | Where-Object { $_.CommandLine -and $_.CommandLine.Contains($d) } | ForEach-Object { $_.ProcessId }";
/* the browser process on our profile: the one msedge.exe without a --type= switch (renderers, GPU and utilities have one) */
const MAIN_PS = PS_GUARD + "Get-CimInstance Win32_Process -Filter \"Name='msedge.exe'\" | Where-Object { $_.CommandLine -and $_.CommandLine.Contains($d) -and $_.CommandLine -notmatch '--type=' } | ForEach-Object { $_.ProcessId }";
const ourProfile = dir =>typeof dir === 'string' && dir.length > PREFIX.length && path.basename(dir).startsWith(PREFIX);
function pidsOf(script, dir) {
  if (!ourProfile(dir)) return [];
  try {
    const r = spawnSync('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command', script], { windowsHide: true, encoding: 'utf8', timeout: 15000, env: { ...process.env, CHECK_PAGE_PROFILE: dir } });
    return String(r.stdout || '').split(/\s+/).map(Number).filter(n => n > 0);
  } catch (e) { return []; }
}
const leftovers = dir => pidsOf(LIST_PS, dir);
const browserPid = dir => pidsOf(MAIN_PS, dir)[0] || 0;
/* the process listening on Edge's debugging port is its browser process. netstat answers in well under a second even
   when many checks run at once; the process-list query above can take over 15 seconds then */
function portOwner(port) {
  try {
    const r = spawnSync('netstat', ['-ano', '-p', 'TCP'], { windowsHide: true, encoding: 'utf8', timeout: 10000 });
    for (const line of String(r.stdout || '').split(/\r?\n/)) {
      const c = line.trim().split(/\s+/);
      if (c.length >= 5 && /LISTEN/i.test(c[3]) && /^(127\.0\.0\.1|\[::1\]|0\.0\.0\.0):(\d+)$/.test(c[1]) && +c[1].split(':').pop() === port) return +c[4] || 0;
    }
  } catch (e) { }
  return 0;
}
/* If this process is killed from outside (a harness timeout), Windows ends the Edge it started with it (Node puts its
   children in a job object), but nothing would delete the profile. A detached Node watcher holds a pipe from this
   process; when the pipe closes, it sweeps any Edge left on that profile and deletes the folder. */
const WATCH_JS = "const fs = require('fs'), { spawnSync } = require('child_process'), dir = process.env.CHECK_PAGE_PROFILE;" +
  "const go = () => { try { spawnSync('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command', process.env.CHECK_PAGE_SWEEP], { windowsHide: true, stdio: 'ignore', timeout: 15000 }); } catch (e) { }" +
  " for (let i = 0; i < 40 && fs.existsSync(dir); i++) { try { fs.rmSync(dir, { recursive: true, force: true }); } catch (e) { Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 250); } } process.exit(0); };" +
  "process.stdin.on('end', go); process.stdin.on('close', go); process.stdin.on('error', go); process.stdin.resume();";
function watchdog(dir) {
  if (!ourProfile(dir)) return null;
  try {
    const w = spawn(process.execPath, ['-e', WATCH_JS], { detached: true, stdio: ['pipe', 'ignore', 'ignore'], windowsHide: true, env: { ...process.env, CHECK_PAGE_PROFILE: dir, CHECK_PAGE_SWEEP: SWEEP_PS } });
    w.on('error', () => { }); w.stdin.on('error', () => { });
    w.unref(); if (w.stdin.unref) w.stdin.unref();          // the watcher must not keep this process open
    return w;
  } catch (e) { return null; }
}
/* Edge's files stay locked for a moment after it ends; true once the folder is gone */
function removeDir(dir, ms) {
  const until = Date.now() + ms;
  for (;;) {
    try { fs.rmSync(dir, { recursive: true, force: true }); return true; } catch (e) { if (Date.now() > until) return false; }
    Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 100);   // a sync wait: this also runs from the Ctrl+C handler
  }
}

async function startEdge(exe, deadline, kill = killTree, onSpawn = () => { }) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), PREFIX));
  const args = ['--headless=new', '--remote-debugging-port=0', '--user-data-dir=' + dir, '--no-first-run', '--no-default-browser-check',
    '--disable-extensions', '--disable-sync', '--disable-background-networking', '--disable-component-update', '--disable-default-apps',
    '--disable-gpu', '--mute-audio', '--window-size=1280,800', '--proxy-server=http://127.0.0.1:9', 'about:blank'];
  /* Edge 157 and later: the msedge.exe we spawn can start the real browser as a new process on the same profile and
     exit at once with code 0. `main` is then that browser's PID, found by the profile folder, and it is what gets killed. */
  let proc, exited = false, code = null, main = 0, stopped = false;
  const guard = watchdog(dir), extraPids = [];
  const stopSync = () => {
    if (stopped) return; stopped = true; live.delete(stopSync);
    if (!main && exited && code === 0) main = browserPid(dir);
    if (main) kill(main); else if (proc && proc.pid && !exited) kill(proc.pid);
    let clean = removeDir(dir, 3000);
    /* then any process of ours still alive, found by the profile folder on its command line, gets the same kill */
    for (let round = 0; round < 2; round++) {
      const extra = leftovers(dir);
      if (!extra.length) break;
      extra.forEach(p => { extraPids.push(p); kill(p); });
      clean = removeDir(dir, 3000);
    }
    if (clean) { try { if (guard) guard.kill(); } catch (e) { } }   // otherwise the watcher tries again once this process ends
    else process.stderr.write('check-page: could not delete ' + dir + '\n');
  };
  live.add(stopSync);
  try { proc = spawn(exe, args, { stdio: 'ignore', windowsHide: true }); } catch (e) { stopSync(); throw new Error('Edge could not be started: ' + e.message); }
  try { onSpawn({ pid: proc.pid, profile: dir }); } catch (e) { }
  const gone = new Promise(r => { proc.once('exit', c => { exited = true; code = c; r(); }); proc.once('error', () => { exited = true; code = -1; r(); }); });
  const edge = {
    dir, proc, extra: extraPids,
    get pid() { return main || proc.pid; },
    async stop() {
      if (stopped) return;
      /* end the tree of the Edge this run started, while it is still known to be alive (no PID reuse) */
      if (main) kill(main); else if (!exited && proc.pid) kill(proc.pid);
      await within(gone, 3000);
      stopSync();
    }
  };
  const file = path.join(dir, 'DevToolsActivePort'), limit = Math.min(deadline, Date.now() + 20000);
  while (Date.now() < limit) {
    if (exited && code !== 0) { await edge.stop(); throw new Error('Edge closed while starting'); }
    try {
      const [port, p] = fs.readFileSync(file, 'utf8').split(/\r?\n/);
      if (+port > 0 && p) {
        edge.port = +port;
        if (exited) {           // handed off: find the browser that now runs on our profile
          main = portOwner(edge.port) || browserPid(dir);
          if (!main) { await edge.stop(); throw new Error('Edge started, but its browser process could not be found'); }
          try { onSpawn({ pid: main, profile: dir }); } catch (e) { }
        }
        return edge;
      }
    } catch (e) { if (/browser process/.test(e.message)) throw e; }
    await sleep(50);
  }
  await edge.stop();
  throw new Error('Edge did not open its debugging port in time');
}

function getJson(url, ms) {
  return new Promise((ok, no) => {
    const req = http.get(url, { agent: false, timeout: ms }, res => {
      let s = ''; res.setEncoding('utf8'); res.on('data', d => { s += d; });
      res.on('end', () => { try { ok(JSON.parse(s)); } catch (e) { no(e); } });
    });
    req.on('timeout', () => req.destroy(new Error('timeout'))); req.on('error', no);
  });
}

/* ---------- the DevTools connection ---------- */

class Cdp {
  constructor(ws) {
    this.ws = ws; this.id = 0; this.pending = new Map(); this.handlers = {};
    ws.onmessage = ev => {
      let m; try { m = JSON.parse(typeof ev.data === 'string' ? ev.data : String(ev.data)); } catch (e) { return; }
      if (m.id) {
        const p = this.pending.get(m.id); if (!p) return;
        this.pending.delete(m.id); clearTimeout(p.timer);
        if (m.error) p.no(new Error(m.error.message || 'DevTools error')); else p.ok(m.result || {});
      } else (this.handlers[m.method] || []).forEach(f => { try { f(m.params || {}); } catch (e) { } });
    };
    ws.onclose = () => { for (const p of this.pending.values()) { clearTimeout(p.timer); p.no(new Error('Edge closed the connection')); } this.pending.clear(); };
  }
  send(method, params = {}, ms = 5000) {
    const id = ++this.id;
    return new Promise((ok, no) => {
      const timer = setTimeout(() => { this.pending.delete(id); no(Object.assign(new Error(method + ' timed out'), { timeout: true })); }, Math.max(1, ms));
      this.pending.set(id, { ok, no, timer });
      try { this.ws.send(JSON.stringify({ id, method, params })); } catch (e) { clearTimeout(timer); this.pending.delete(id); no(e); }
    });
  }
  on(method, fn) { (this.handlers[method] = this.handlers[method] || []).push(fn); }
  close() { try { this.ws.close(); } catch (e) { } }
}

function connect(url, ms) {
  return new Promise((ok, no) => {
    const ws = new WebSocket(url);
    const t = setTimeout(() => { try { ws.close(); } catch (e) { } no(new Error('could not connect to Edge')); }, Math.max(1, ms));
    ws.onopen = () => { clearTimeout(t); ok(new Cdp(ws)); };
    ws.onerror = () => { clearTimeout(t); no(new Error('could not connect to Edge')); };
  });
}

/* ---------- reading errors ---------- */

const where = (url, line) => { let f = ''; try { f = decodeURIComponent(path.basename(new URL(url).pathname)); } catch (e) { f = url || ''; } return (f || line != null) ? ' (' + (f || 'page') + (line != null && line >= 0 ? ' line ' + (line + 1) : '') + ')' : ''; };
function exText(d) {
  const ex = d.exception || {}, first = String(ex.description || (ex.value !== undefined ? ex.value : '') || '').split('\n')[0];
  const fr = d.stackTrace && d.stackTrace.callFrames && d.stackTrace.callFrames[0];
  const msg = first ? (/in promise/.test(d.text || '') ? 'Uncaught (in promise) ' + first : first) : (d.text || 'an error');
  return msg + where(d.url || (fr && fr.url) || '', d.lineNumber != null ? d.lineNumber : fr && fr.lineNumber);
}
function consoleText(p) {
  const fr = p.stackTrace && p.stackTrace.callFrames && p.stackTrace.callFrames[0];
  const args = (p.args || []).map(a => a.value !== undefined ? String(a.value) : (a.description || a.type)).join(' ');
  return 'console.error: ' + args + (fr ? where(fr.url, fr.lineNumber) : '');
}
/* requests to the internet fail at the dead proxy; say so in words a small model can act on */
const logText = e => /ERR_(PROXY|TUNNEL)_CONNECTION_FAILED/.test(e.text || '') ? 'blocked a request to the internet: ' + e.url + ' (the page must not use external URLs; put the code in the page)'
  : e.text + (e.url ? where(e.url, e.lineNumber) : '');

/* ---------- code that runs inside the page (sent as source text) ---------- */

function pageHelpers() {
  const SEL = 'button, a[href], [onclick], input[type=button], input[type=submit], [role=button]';
  const all = () => Array.from(document.querySelectorAll(SEL)).filter(e => !e.closest('[data-check="skip"]'));
  const label = e => {
    const raw = e.getAttribute('aria-label') || (e.tagName === 'INPUT' ? e.value : (e.innerText || e.textContent)) || e.getAttribute('title') || '';
    return raw.replace(/\s+/g, ' ').trim().slice(0, 60) || (e.id ? '#' + e.id : '(no text)');
  };
  /* a link to another page or to a place on this one; href="#" and javascript: links are judged like buttons */
  const isLink = e => { if (e.tagName !== 'A') return false; const h = (e.getAttribute('href') || '').trim(); return h !== '' && h !== '#' && !/^javascript:/i.test(h); };
  const kind = e => e.tagName === 'A' ? 'link' : (e.tagName === 'BUTTON' || e.tagName === 'INPUT' || e.getAttribute('role') === 'button') ? 'button' : e.tagName.toLowerCase();
  const hash = s => { let h = 0x811c9dc5; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 0x01000193); } return (h >>> 0).toString(16); };
  /* what the player sees: the HTML, the text, form values and canvas pixels (domOnly: no pixels, for animated pages) */
  const fp = domOnly => {
    const b = document.body; if (!b) return 'no body';
    let s = document.title + '\u0001' + b.innerHTML + '\u0001' + b.innerText;
    document.querySelectorAll('input, textarea, select').forEach(e => { s += '\u0001' + (e.type === 'checkbox' || e.type === 'radio' ? e.checked : e.value); });
    if (!domOnly) document.querySelectorAll('canvas').forEach(c => { try { s += '\u0001' + c.width + 'x' + c.height + c.toDataURL(); } catch (x) { s += '\u0001canvas'; } });
    return b.innerHTML.length + ':' + hash(s);
  };
  const find = (i, text, nth, count) => {
    const xs = all(), same = xs.filter(x => label(x) === text);
    if (xs[i] && label(xs[i]) === text) return xs[i];
    if (same[nth]) return same[nth];
    return xs.length === count ? xs[i] || null : null;      // its label changed (Pause -> Resume), the list did not
  };
  return {
    list() {
      const seen = {};
      return all().map((e, i) => { const text = label(e); seen[text] = seen[text] === undefined ? 0 : seen[text] + 1; return { i, text, nth: seen[text], kind: kind(e), link: isLink(e), href: e.tagName === 'A' ? e.href : '', submit: (e.tagName === 'BUTTON' || e.tagName === 'INPUT') && e.type === 'submit' && !!e.form }; });
    },
    fp,
    /* the control, its ancestors, document and window: every place a click handler for it can be registered */
    chain(i, text, nth, count) { const a = []; for (let e = find(i, text, nth, count); e; e = e.parentElement) a.push(e); if (a.length) a.push(document, window); return a; },
    /* handlers set as properties (el.onclick = f): 'self' on the control, 'chain' only on an ancestor, document or window */
    props(i, text, nth, count) {
      const ev = ['onclick', 'onmousedown', 'onmouseup', 'onpointerdown', 'onpointerup', 'onsubmit'], has = x => ev.some(k => typeof x[k] === 'function');
      const a = this.chain(i, text, nth, count);
      return a.length && has(a[0]) ? 'self' : a.some(has) ? 'chain' : '';
    },
    /* is there anything to see: visible text, or a canvas, picture or video with a size */
    content() {
      const b = document.body; if (!b) return { text: 0, media: 0 };
      const media = Array.from(document.querySelectorAll('canvas, img, svg, video')).filter(m => { const r = m.getBoundingClientRect(); return r.width > 0 && r.height > 0; }).length;
      return { text: (b.innerText || '').trim().length, media };
    },
    click(i, text, nth, count, domOnly) {
      const e = find(i, text, nth, count);
      if (!e) return { gone: true };
      const disabled = !!e.disabled, before = fp(domOnly), beforeDom = fp(true);
      /* stay on this page: links and form submits do not navigate away while being checked */
      const keep = ev => { const a = ev.target && ev.target.closest && ev.target.closest('a[href]'); if (a && !/^\s*javascript:/i.test(a.getAttribute('href'))) ev.preventDefault(); };
      const nosubmit = ev => ev.preventDefault();
      window.addEventListener('click', keep); window.addEventListener('submit', nosubmit);
      try { e.click(); } finally { window.removeEventListener('click', keep); window.removeEventListener('submit', nosubmit); }
      return { before, after: fp(domOnly), domChanged: beforeDom !== fp(true), disabled };
    }
  };
}
const H = '(' + pageHelpers.toString() + ')()';

/* ---------- loading and clicking ---------- */

async function drive(cdp, rep, deadline) {
  const left = () => deadline - Date.now();
  const call = (m, p, ms) => cdp.send(m, p, Math.max(1, Math.min(ms || 5000, left())));
  const errs = [], seen = new Set();
  const add = t => { if (seen.has(t)) { errs.push(t); return; } seen.add(t); errs.push(t); if (rep.errors.length < MAX_ERRORS) rep.errors.push(t); };
  let mainFrame = '', docStatus = 0, loads = 0, mark = 0;
  cdp.on('Runtime.exceptionThrown', p => add(exText(p.exceptionDetails || {})));
  cdp.on('Runtime.consoleAPICalled', p => { if (p.type === 'error' || p.type === 'assert') add(consoleText(p)); });
  cdp.on('Log.entryAdded', p => { if (p.entry && p.entry.level === 'error') add(logText(p.entry)); });
  cdp.on('Page.javascriptDialogOpening', () => { cdp.send('Page.handleJavaScriptDialog', { accept: true, promptText: '' }, 3000).catch(() => { }); });
  cdp.on('Network.responseReceived', p => { if (p.type === 'Document' && (!mainFrame || p.frameId === mainFrame)) docStatus = p.response.status; });
  cdp.on('Page.frameStartedLoading', p => { if (!mainFrame || p.frameId === mainFrame) loads++; });
  /* every document the main frame commits; an error page carries the address it failed to open in unreachableUrl */
  const navs = [];
  cdp.on('Page.frameNavigated', p => { if (p.frame && !p.frame.parentId) navs.push({ url: p.frame.url || '', unreachable: p.frame.unreachableUrl || '' }); });
  for (const d of ['Page.enable', 'Runtime.enable', 'Log.enable', 'Network.enable']) await call(d, {}, 15000);

  const evaluate = async (expression, ms, extra) => {
    const r = await call('Runtime.evaluate', Object.assign({ expression, returnByValue: true }, extra || {}), ms);
    if (r.exceptionDetails) throw Object.assign(new Error(exText(r.exceptionDetails)), { page: true });
    return r.result ? r.result.value : undefined;
  };
  /* proof of load: readyState complete, on the page asked for (not an error page), and no HTTP error */
  const waitLoaded = async () => {
    for (;;) {
      if (left() <= 0) throw Object.assign(new Error('the page did not finish loading within ' + Math.round(rep.timeoutMs / 1000) + ' s (a script may be stuck in a loop while the page loads)'), { load: true });
      let s = ''; try { s = await evaluate('document.readyState + " " + location.href', Math.min(2000, left())); } catch (e) { }
      if (/^complete /.test(s)) {
        if (/^complete (about:blank|chrome-error:|edge-error:)/.test(s)) { if (loads > 0 && /error:/.test(s)) throw Object.assign(new Error('Edge showed an error page instead of ' + rep.url), { load: true }); }
        else break;
      }
      await sleep(50);
    }
    if (docStatus >= 400) throw Object.assign(new Error('the server answered ' + docStatus + ' for ' + rep.url), { load: true });
    mark = Date.now(); await evaluate('window.__checkPageMark = ' + mark, 2000).catch(() => { });
    await sleep(Math.min(300, left()));                        // let load-time timers run
  };
  const open = async () => {
    docStatus = 0; loads = 0;
    const nav = await call('Page.navigate', { url: rep.url }, Math.min(15000, left()));
    if (nav.errorText) throw Object.assign(new Error('Edge could not open the page: ' + nav.errorText), { load: true });
    mainFrame = nav.frameId || mainFrame;
    await waitLoaded();
  };
  try { await open(); } catch (e) { if (e.load || e.timeout) { rep.reason = e.message; return; } throw e; }
  rep.loaded = true;

  let list;
  try { list = await evaluate(H + '.list()', Math.min(CLICK_MS, left())); } catch (e) { rep.reason = 'the page stopped answering before its controls could be listed: ' + e.message; return; }
  rep.controls = list.map(c => ({ text: c.text, kind: c.kind, link: c.link, href: c.href, submit: c.submit, wired: null, wiredWhere: '', domChanged: false, changed: false, error: '', note: '', pass: false, clicked: false, i: c.i, nth: c.nth }));
  const count = list.length;
  let stuck = false;

  /* idle drift: a page that changes with nobody clicking (a canvas animation, a running timer) is "animated" */
  const drift = async () => {
    try { const a = await evaluate(H + '.fp(false)', Math.min(2000, left())); await sleep(Math.min(300, left())); const b = await evaluate(H + '.fp(false)', Math.min(2000, left())); if (a !== b) rep.animated = true; } catch (e) { }
  };
  rep.animated = false;
  await drift();
  /* no controls: the page passes only if there is something to see (a keyboard-only canvas game is fine, a blank page is not) */
  if (!count) {
    let ct = null; try { ct = await evaluate(H + '.content()', Math.min(2000, left())); } catch (e) { }
    if (!ct || (!ct.text && !ct.media)) rep.blank = true;
  }

  /* wiring evidence: a click-type listener on the control, an ancestor, document or window, or an on... property */
  const args = c => c.i + ', ' + JSON.stringify(c.text) + ', ' + c.nth + ', ' + count;
  const wiredOf = async c => {
    try {
      const r = await call('Runtime.evaluate', { expression: H + '.chain(' + args(c) + ')', objectGroup: 'check-page-wiring' }, Math.min(2000, left()));
      if (r.exceptionDetails || !r.result || !r.result.objectId) return null;
      const props = await call('Runtime.getProperties', { objectId: r.result.objectId, ownProperties: true }, Math.min(2000, left()));
      const ids = (props.result || []).filter(p => /^\d+$/.test(p.name) && p.value && p.value.objectId).map(p => p.value.objectId);
      if (!ids.length) return null;
      let where = '';
      for (let k = 0; k < ids.length && where !== 'self'; k++) {
        const l = await call('DOMDebugger.getEventListeners', { objectId: ids[k] }, Math.min(2000, left()));
        if ((l.listeners || []).some(x => CLICK_TYPES.includes(x.type))) where = k === 0 ? 'self' : 'chain';
      }
      if (where !== 'self') { const p = await evaluate(H + '.props(' + args(c) + ')', Math.min(2000, left())); if (p === 'self' || (p === 'chain' && !where)) where = p; }
      return where || false;
    } catch (e) { return null; } finally { call('Runtime.releaseObjectGroup', { objectGroup: 'check-page-wiring' }, 2000).catch(() => { }); }
  };

  /* A click made the frame load something. Only a reload of this page, or another page in the working folder, the
     served folder, localhost or 127.0.0.1 that finished loading, counts as the click doing something. Then the page
     under test is opened again for the next click. */
  const noHash = u => String(u).replace(/#.*$/, '');
  const followNav = async from => {
    const until = Date.now() + Math.min(5000, Math.max(0, left()));
    let s = '';
    while (Date.now() < until) {
      if (navs.length > from) { try { s = await evaluate('document.readyState', 1000); } catch (e) { s = ''; } if (s === 'complete') break; }
      await sleep(50);
    }
    const n = navs.length > from ? navs[navs.length - 1] : null, status = docStatus;
    let res;
    if (!n) res = { plain: true, error: 'the click started to leave the page, and no page finished loading' };
    else if (n.unreachable || /^(chrome|edge)-error:/i.test(n.url)) {
      const to = n.unreachable || n.url, why = /^(file|https?):/i.test(to) ? destProblem(to, rep) : 'leads to ' + to;
      res = { plain: true, error: 'the click left the page and ' + (why ? why.replace(/^leads/, 'went') : 'went to ' + to + ', which could not load') };
    } else if (s !== 'complete') res = { plain: true, error: 'the click left the page for ' + n.url + ', which did not finish loading' };
    else if (noHash(n.url) === noHash(rep.url)) res = { changed: true, domChanged: true, note: 'reloaded or left the page: it reloaded this page' };
    else {
      const why = /^(file|https?):/i.test(n.url) ? destProblem(n.url, rep) : 'leads to ' + n.url;
      if (why) res = { plain: true, error: 'the click left the page and ' + why.replace(/^leads/, 'went') };
      else if (status >= 400) res = { plain: true, error: 'the click left the page for ' + n.url + ', which answered ' + status };
      else res = { changed: true, domChanged: true, note: 'reloaded or left the page: it went to ' + n.url + ', which loaded' };
    }
    try { await open(); } catch (e) { if (!res.error) res = { plain: true, error: 'the page did not load again after this click: ' + e.message }; }
    return res;
  };

  const clickOnce = async c => {
    const from = errs.length, loadsBefore = loads, navsBefore = navs.length, ms = Math.min(CLICK_MS, left());
    if (ms < 200) return { out: true };
    if (c.wiredWhere !== 'self') { const w = await wiredOf(c); if (w !== null) { if (w || c.wired !== true) c.wired = !!w; if (w === 'self' || (w && !c.wiredWhere)) c.wiredWhere = w; } }
    let v;
    try {
      v = await evaluate(H + '.click(' + args(c) + ', ' + !!rep.animated + ')', ms + 1000, { userGesture: true, timeout: ms });
    } catch (e) {
      if (e.timeout || /terminated/i.test(e.message)) { stuck = !!e.timeout; c.clicked = true; return { hung: true, error: 'did not finish within ' + (ms / 1000).toFixed(1) + ' s (an endless loop, or a handler that never returns)' }; }
      if (/context|navigat|destroyed/i.test(e.message)) {
        c.clicked = true;
        const r = await followNav(navsBefore);
        if (!r.error) r.error = errs.slice(from)[0] || '';
        return r;
      }
      return { error: e.message };
    }
    if (!v || v.gone) return { gone: true };
    c.clicked = true;
    let changed = v.before !== v.after, domChanged = !!v.domChanged, note = '';
    await sleep(Math.min(changed ? 60 : SETTLE_MS, left()));
    /* did the click make the frame load something (location.reload(), location.href = ...)? */
    let here = null; try { here = await evaluate('window.__checkPageMark || 0', Math.min(2000, left())); } catch (e) { }
    if (loads !== loadsBefore || navs.length > navsBefore || here === 0 || (here !== null && here !== mark)) {
      const r = await followNav(navsBefore);
      if (!r.error) r.error = errs.slice(from)[0] || '';
      return r;
    } else if (!changed && !c.link) {
      /* a change that came a moment later counts only if the page then stays still (it is not just an animation running) */
      let a = '', b = '';
      try { a = await evaluate(H + '.fp(' + !!rep.animated + ')', Math.min(2000, left())); } catch (e) { }
      if (a && a !== v.after) {
        await sleep(Math.min(SETTLE_MS, left()));
        try { b = await evaluate(H + '.fp(' + !!rep.animated + ')', Math.min(2000, left())); } catch (e) { }
        changed = a === b;
        if (changed && rep.animated) domChanged = true;          // on an animated page fp() already leaves out canvas pixels
        if (!changed) note = 'the page keeps changing by itself, and this click changed nothing straight away';
      }
    }
    return { changed, domChanged, note, disabled: v.disabled, error: errs.slice(from)[0] || '' };
  };
  const record = (c, r) => {
    if (r.error && !c.error) { c.error = r.error; c.hung = !!(r.hung || r.plain); }
    if (r.domChanged) c.domChanged = true;
    if (r.changed) { c.changed = true; c.note = r.note || ''; }
    else if (r.note && !c.note) c.note = r.note;
    if (r.disabled !== undefined) c.disabled = r.disabled;
    if (r.gone && !c.clicked) c.gone = true;
  };

  /* sweep 1: every control once, in page order */
  for (const c of rep.controls) {
    if (stuck) break;
    const r = await clickOnce(c);
    if (r.out) { rep.reason = 'ran out of time before every control was clicked'; break; }
    record(c, r);
  }
  if (!stuck && !rep.reason && !rep.animated) await drift();   // a game may start animating only after Start
  /* sweep 2: a wired control that changed nothing (a Reset on a fresh board) gets another try after each control that did change something.
     Unwired controls fail anyway, and on an animated page a wired control passes without a visible change. */
  const helpers = rep.controls.filter(c => c.changed && !c.error && !c.link).slice(0, 6);
  for (const c of rep.controls) {
    if (stuck || rep.reason) break;
    if (c.link || c.changed || c.error || (c.wired === false && !c.submit) || (rep.animated && c.wiredWhere === 'self')) continue;
    for (const h of helpers) {
      if (h === c || stuck) continue;
      const hr = await clickOnce(h); if (hr.out) { rep.reason = 'ran out of time before every control was clicked'; break; }
      if (hr.error && !h.error) h.error = hr.error;
      const r = await clickOnce(c); if (r.out) { rep.reason = 'ran out of time before every control was clicked'; break; }
      record(c, r);
      if (c.changed || c.error) break;
    }
  }
  if (stuck) rep.reason = 'stopped: the page stopped answering (an endless loop?)';

  for (const c of rep.controls) {
    if (c.error) { c.pass = false; continue; }
    if (!c.clicked) { c.pass = false; c.note = c.gone ? 'disappeared before it could be clicked' : 'not checked: ' + (rep.reason || 'the checker stopped'); continue; }
    /* a link passes on throwing nothing, if where it leads is allowed and exists */
    if (c.link) { const why = c.href ? destProblem(c.href, rep) : ''; c.pass = !why; if (why) c.note = 'this link ' + why; continue; }
    /* a control with no click handler anywhere fails, whatever the page does (an animation must not pass a dead button) */
    if (c.wired !== true && !c.submit) { c.pass = false; c.note = c.wired === false ? 'no click handler' : 'could not read its click handlers'; continue; }
    if (!rep.animated) c.pass = c.changed;
    /* on an animated page a handler on the control itself is enough; one only on document, window or an ancestor (an audio
       unlock, a key handler) must be backed by a change in the text or HTML that this click caused */
    else c.pass = c.wiredWhere === 'self' || c.submit || !!c.domChanged;
    if (c.pass && !c.changed) c.note = 'the page animates by itself, so this passes on its click handler';
    if (!c.pass) c.note = c.disabled ? 'was disabled every time it was clicked (add data-check="skip" if that is meant)'
      : rep.animated && c.wiredWhere === 'chain' ? 'no click handler on the control itself, and the click changed no text or HTML (a handler on document or window does not count on an animated page)'
      : (c.note || 'nothing changed when it was clicked');
  }
  rep.allErrors = errs.length;
}

/* ---------- the two exports ---------- */

async function check(target, opts = {}) {
  const timeoutMs = opts.timeoutMs > 0 ? +opts.timeoutMs : DEFAULT_TIMEOUT, deadline = Date.now() + timeoutMs;
  const rep = { ok: false, loaded: false, target: String(target || ''), url: '', errors: [], controls: [], reason: '', timeoutMs, code: 2 };
  if (typeof WebSocket !== 'function') { rep.reason = NODE_MSG; return done(rep); }
  const t = resolveTarget(target, opts);
  if (t.error) { rep.reason = t.error; rep.refused = !!t.refused; return done(rep); }
  rep.workDir = real(path.resolve(opts.workDir || process.cwd())); rep.serveRoot = t.serve || '';
  const exe = findEdge();
  if (!exe) { rep.reason = 'Microsoft Edge was not found (looked for Microsoft\\Edge\\Application\\msedge.exe in both Program Files folders). Install Microsoft Edge to check pages.'; return done(rep); }
  let server = null, edge = null, cdp = null;
  try {
    if (t.serve) { server = await serve(t.serve); rep.url = 'http://127.0.0.1:' + server.address().port + '/' + t.rel; }
    else rep.url = t.url;
    /* opts.kill (tests): called with the PID of the Edge this run spawned; the default ends that process tree */
    const kill = pid => { try { (typeof opts.kill === 'function' ? opts.kill : killTree)(pid); } catch (e) { } };
    /* opts.onSpawn (tests): told the spawned PID and profile folder as soon as Edge starts */
    edge = await startEdge(exe, deadline, kill, typeof opts.onSpawn === 'function' ? opts.onSpawn : undefined);
    rep.edgePid = edge.pid; rep.profile = edge.dir;
    let page = null;
    while (!page && Date.now() < deadline) {
      try { page = (await getJson('http://127.0.0.1:' + edge.port + '/json/list', 2000)).find(x => x.type === 'page' && x.webSocketDebuggerUrl); } catch (e) { }
      if (!page) await sleep(100);
    }
    if (!page) throw new Error('Edge started but showed no page to drive');
    cdp = await connect(page.webSocketDebuggerUrl, Math.max(1, Math.min(5000, deadline - Date.now())));
    await drive(cdp, rep, deadline);
  } catch (e) {
    if (!rep.reason) rep.reason = (rep.loaded ? '' : 'could not check the page: ') + e.message;
  } finally {
    if (edge) { await edge.stop(); rep.extraPids = edge.extra.slice(); }
    if (cdp) cdp.close();
    if (server) { try { server.closeAllConnections(); } catch (e) { } server.close(); }
  }
  return done(rep);
}
function done(rep) {
  rep.ok = !!(rep.loaded && !rep.reason && !rep.blank && rep.errors.length === 0 && rep.controls.every(c => c.pass));
  rep.code = !rep.loaded ? 2 : rep.ok ? 0 : 1;
  return rep;
}

function format(rep) {
  const L = ['Page: ' + (rep.url || rep.target)];
  if (!rep.loaded) {
    L.push('COULD NOT LOAD: ' + (rep.reason || 'unknown reason'));
    if (rep.errors.length) L.push('FIRST ERROR: ' + rep.errors[0]);
    L.push('VERDICT: FAIL');
    return L.join('\n');
  }
  const yn = b => b ? 'yes' : 'no';
  L.push('Loaded: yes. Controls found: ' + rep.controls.length + '. Animated: ' + yn(rep.animated) + (rep.animated ? ' (the page changes by itself, so canvas pixels are not compared)' : '') + '.');
  for (const c of rep.controls) {
    const name = c.kind + ' "' + c.text + '"';
    const ev = c.link ? ' [link: checked that it throws nothing and that its page exists]' : ' [wired ' + (c.wired === null ? 'unknown' : yn(c.wired)) + (c.wiredWhere === 'chain' ? ' (only on document, window or a parent)' : '') + (c.submit ? ' (form submit)' : '') + ', changed ' + yn(c.changed) + ', animated ' + yn(rep.animated) + ']';
    if (c.pass) L.push('PASS  ' + name + (c.note ? ': ' + c.note : '') + ev);
    else L.push('FAIL  ' + name + ': ' + (c.error ? (c.hung ? '' : 'threw ') + c.error : c.note) + ev);
  }
  if (rep.blank) L.push('BLANK PAGE: no visible text, no canvas and no controls. The page shows nothing.');
  else if (!rep.controls.length) L.push('No clickable controls were found; only loading and errors were checked.');
  if (rep.errors.length) {
    L.push('Errors (' + rep.errors.length + (rep.allErrors > rep.errors.length ? ', ' + rep.allErrors + ' in all' : '') + '):');
    rep.errors.forEach(e => L.push('  ' + e));
    L.push('FIRST ERROR: ' + rep.errors[0]);
  }
  if (rep.reason) L.push('Note: ' + rep.reason);
  L.push('VERDICT: ' + (rep.ok ? 'PASS' : 'FAIL'));
  return L.join('\n');
}

module.exports = { check, format, findEdge, killTree, _t: { resolveTarget, inside, destProblem, leftovers, watchdog, ourProfile, SWEEP_PS, LIST_PS } };

/* ---------- command line ---------- */

if (require.main === module) {
  const argv = process.argv.slice(2), o = {}; let target = '', bad = '';
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--serve') o.serve = argv[++i];
    else if (a === '--timeout') { o.timeoutMs = parseInt(argv[++i], 10); if (!(o.timeoutMs > 0)) bad = '--timeout needs a number of milliseconds'; }
    else if (a === '--help' || a === '-h') { console.log('Usage: node check-page.js <file-or-url> [--serve <folder>] [--timeout <ms>]\nExit 0 pass, 1 fail, 2 could not load.'); process.exit(0); }
    else if (!target) target = a;
    else bad = 'unexpected argument: ' + a;
  }
  if (o.serve === undefined && !target) bad = bad || 'no page given';
  if (bad) { console.log('check-page: ' + bad + '\nUsage: node check-page.js <file-or-url> [--serve <folder>] [--timeout <ms>]\nVERDICT: FAIL'); process.exit(2); }
  if (typeof WebSocket !== 'function') { console.log(NODE_MSG + '\nVERDICT: FAIL'); process.exit(2); }
  const quit = code => { for (const f of [...live]) f(); process.exit(code); };
  process.on('SIGINT', () => quit(2)); process.on('SIGTERM', () => quit(2));
  const hard = setTimeout(() => { console.log('check-page: gave up after the time limit.\nVERDICT: FAIL'); quit(2); }, (o.timeoutMs || DEFAULT_TIMEOUT) + 30000);
  hard.unref();
  check(target, o).then(rep => { console.log(format(rep)); process.exitCode = rep.code; })
    .catch(e => { console.log('check-page: ' + e.message + '\nVERDICT: FAIL'); for (const f of [...live]) f(); process.exitCode = 2; });
}

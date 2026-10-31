// Updates: is there a newer Moundshroud, and if the user says so, fetch it, check it and hand it to apply-update.ps1.
//   - Asks only when internet access is switched on (Settings › AI & power), at most once a day, or when "Check now" is pressed.
//   - The question is one small file, latest.json, from the public download repo named in update.json. Nothing about
//     this PC or its user is sent: an ordinary browser name, no cookies, no IDs.
//   - Nothing is installed without the user pressing "Update now". Every download is checked against the size and
//     SHA-256 fingerprint listed in latest.json before anything is unpacked.
//   - The swap itself is done by apply-update.ps1 after this server has stopped: it copies aside every file it replaces,
//     never touches the data folder (your notes, chats, passwords, settings), and puts the old version back if the new
//     one does not start.
const fs = require('fs'), path = require('path'), https = require('https'), http = require('http'), crypto = require('crypto'), cp = require('child_process'), os = require('os');
const net = require('./net');

const ROOT = path.join(__dirname, '..'), DATA = path.join(ROOT, 'data'), STATE = path.join(DATA, 'update.json');
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:128.0) Gecko/20100101 Firefox/128.0';
const DAY = 24 * 3600e3, MAXFILE = 60 * 1024 * 1024;

/* where updates come from: update.json beside server.js, { "repo": "owner/name" } (a public GitHub repo of releases) */
function source() {
  /* tests point this at a local file server; it only works when that variable is set, and only for this PC */
  const t = process.env.MOUNDSHROUD_UPDATE_TEST;
  if (t && /^http:\/\/127\.0\.0\.1:\d+$/.test(t)) return { latest: t + '/latest.json', file: (v, n) => t + '/' + n, test: true };
  let repo = ''; try { repo = String(JSON.parse(fs.readFileSync(path.join(ROOT, 'update.json'), 'utf8')).repo || ''); } catch (e) { }
  if (!/^[A-Za-z0-9-]+\/[A-Za-z0-9._-]+$/.test(repo)) return null;
  return { repo, latest: 'https://github.com/' + repo + '/releases/latest/download/latest.json', file: (v, n) => 'https://github.com/' + repo + '/releases/download/v' + encodeURIComponent(v) + '/' + encodeURIComponent(n) };
}

const current = () => { try { return fs.readFileSync(path.join(ROOT, 'VERSION'), 'utf8').trim(); } catch (e) { return '0'; } };
const num = v => String(v).split(/[^0-9]+/).filter(Boolean).map(Number);
function newer(a, b) { const x = num(a), y = num(b); for (let i = 0; i < Math.max(x.length, y.length); i++) { const d = (x[i] || 0) - (y[i] || 0); if (d) return d > 0; } return false; }

let state = {}; try { state = JSON.parse(fs.readFileSync(STATE, 'utf8')); } catch (e) { }
const save = () => { try { fs.writeFileSync(STATE, JSON.stringify(state, null, 1)); } catch (e) { } };
let busy = null;            // what is happening right now: 'checking', 'downloading', 'installing'

/* only GitHub (and the file store it hands downloads to) may be reached, by https, with a size cap */
function okHost(u, test) {
  if (test) return u.protocol === 'http:' && u.hostname === '127.0.0.1';
  return u.protocol === 'https:' && (u.hostname === 'github.com' || /(^|\.)githubusercontent\.com$/.test(u.hostname));
}
function fetchBuf(url, cap, test, hops) {
  return new Promise((res, rej) => {
    let u; try { u = new URL(url); } catch (e) { return rej(new Error('bad address')); }
    if (!okHost(u, test)) return rej(new Error('Updates may only come from GitHub, not ' + u.hostname + '.'));
    const lib = u.protocol === 'https:' ? https : http;
    const rq = lib.get(u, { headers: { 'user-agent': UA, accept: '*/*' }, timeout: 30000 }, r => {
      if ([301, 302, 303, 307, 308].includes(r.statusCode) && r.headers.location) { r.resume(); if ((hops || 0) > 5) return rej(new Error('too many redirects')); return fetchBuf(new URL(r.headers.location, u).href, cap, test, (hops || 0) + 1).then(res, rej); }
      if (r.statusCode === 404) { r.resume(); return rej(Object.assign(new Error('not found'), { code: 404 })); }
      if (r.statusCode !== 200) { r.resume(); return rej(new Error('the download server answered ' + r.statusCode)); }
      const parts = []; let n = 0;
      r.on('data', c => { n += c.length; if (n > cap) { rq.destroy(); rej(new Error('the file is larger than expected')); } else parts.push(c); });
      r.on('end', () => res(Buffer.concat(parts))); r.on('error', rej);
    });
    rq.on('timeout', () => rq.destroy(new Error('the download timed out'))); rq.on('error', rej);
  });
}

function status() {
  const src = source(), cur = current(), L = state.latest;
  return { current: cur, enabled: !!src, internet: net.on(), busy, lastCheck: state.lastCheck || 0, error: state.error || '',
    available: !!(L && newer(L.version, cur)), latest: L ? { version: L.version, date: L.date, notes: L.notes || [] } : null,
    last: state.last || null, result: result(), from: src && src.repo ? 'github.com/' + src.repo : '' };
}
/* what apply-update.ps1 reported about the last install (shown once in the app) */
function result() { try { return JSON.parse(fs.readFileSync(path.join(DATA, 'update-result.json'), 'utf8').replace(/^﻿/, '')); } catch (e) { return null; } }

/* ask whether there is a newer version. auto = the daily check (silent, and only when it is due) */
async function check(auto) {
  const src = source();
  if (!src) return Object.assign(status(), { error: 'This copy has no update source set.' });
  if (!net.on() && !src.test) return Object.assign(status(), { error: 'Internet access is switched off (Settings › AI & power), so Moundshroud cannot look for updates.' });
  if (auto && Date.now() - (state.lastCheck || 0) < DAY) return status();
  if (busy) return status();
  busy = 'checking';
  try {
    const j = JSON.parse((await fetchBuf(src.latest, 256 * 1024, src.test)).toString('utf8'));
    if (!j || !j.version || !Array.isArray(j.files) || !j.files.length) throw new Error('the update list is not readable');
    j.files.forEach(f => { if (!/^[A-Za-z0-9._-]+\.zip$/.test(f.name) || !/^[0-9a-f]{64}$/i.test(f.sha256) || !(f.size > 0 && f.size < MAXFILE)) throw new Error('the update list has a file Moundshroud will not take'); });
    state.latest = { version: String(j.version), date: String(j.date || ''), notes: (j.notes || []).map(String).slice(0, 40), files: j.files };
    state.error = '';
  } catch (e) { state.error = e.code === 404 ? 'No release has been published yet.' : 'Could not check for updates: ' + e.message; }
  state.lastCheck = Date.now(); busy = null; save();
  return status();
}

/* fetch, check and unpack the new version, then start apply-update.ps1 and stop this server (onGo) */
async function install(onGo, port) {
  const src = source(), L = state.latest, cur = current();
  if (!src) return { error: 'This copy has no update source set.' };
  if (!net.on() && !src.test) return { error: 'Internet access is switched off, so the update cannot be downloaded.' };
  if (!L || !newer(L.version, cur)) return { error: 'There is no newer version to install.' };
  if (busy) return { error: 'Already ' + busy + '.' };
  const work = path.join(os.tmpdir(), 'moundshroud-update-' + Date.now()), stage = path.join(work, 'stage');
  try {
    busy = 'downloading'; fs.mkdirSync(stage, { recursive: true });
    for (const f of L.files) {
      const buf = await fetchBuf(src.file(L.version, f.name), MAXFILE, src.test);
      const sha = crypto.createHash('sha256').update(buf).digest('hex');
      if (buf.length !== f.size || sha !== f.sha256.toLowerCase()) throw new Error(f.name + ' did not arrive intact (its fingerprint does not match), so nothing was changed.');
      fs.writeFileSync(path.join(work, f.name), buf);
    }
    busy = 'installing';
    for (const f of L.files) {
      const r = cp.spawnSync('powershell.exe', ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-Command', 'Expand-Archive -LiteralPath $env:MS_ZIP -DestinationPath $env:MS_TO -Force'], { env: Object.assign({}, process.env, { MS_ZIP: path.join(work, f.name), MS_TO: stage }), windowsHide: true, timeout: 180000 });
      if (r.status !== 0) throw new Error('could not unpack ' + f.name + ': ' + String(r.stderr || '').trim().slice(0, 200));
    }
    /* the zips hold one "Moundshroud" folder; it must be a whole, matching copy before anything is touched */
    const app = fs.existsSync(path.join(stage, 'Moundshroud')) ? path.join(stage, 'Moundshroud') : stage;
    for (const need of ['server.js', 'VERSION', 'web/index.html', 'apply-update.ps1']) if (!fs.existsSync(path.join(app, need))) throw new Error('the download is missing ' + need + ', so nothing was changed.');
    const v = fs.readFileSync(path.join(app, 'VERSION'), 'utf8').trim();
    if (v !== L.version) throw new Error('the download says it is version ' + v + ', not ' + L.version + ', so nothing was changed.');
    /* run the installed copy's apply script (not the downloaded one), from the temp folder so it can replace itself */
    const script = path.join(work, 'apply-update.ps1'); fs.copyFileSync(path.join(ROOT, 'apply-update.ps1'), script);
    /* it must outlive this server, which stops next. A "detached" child quits at once on Windows, so a short launcher hands
       it to Windows' own Start-Process instead (paths cannot contain a double quote, so quoting each value is safe) */
    const q = v => '"' + String(v) + '"';
    const argline = ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', q(script), '-Root', q(ROOT), '-Stage', q(app), '-Work', q(work), '-ServerPid', process.pid, '-Port', +port, '-OldVersion', q(cur), '-NewVersion', q(L.version)].join(' ');
    const launched = await new Promise(done => {
      const ch = cp.spawn('powershell.exe', ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-Command', 'Start-Process powershell.exe -WindowStyle Hidden -ArgumentList $env:MS_UPDATE_ARGS -RedirectStandardError $env:MS_UPDATE_LOG'],
        { stdio: 'ignore', windowsHide: true, env: Object.assign({}, process.env, { MS_UPDATE_ARGS: argline, MS_UPDATE_LOG: path.join(DATA, 'update-run.log') }) });
      ch.on('error', () => done(false)); ch.on('exit', c => done(c === 0));
    });
    if (!launched) throw new Error('the installer could not be started, so nothing was changed.');
    state.last = { from: cur, to: L.version, at: Date.now() }; save();
    setTimeout(onGo, 400);
    return { ok: true, version: L.version };
  } catch (e) {
    busy = null; try { fs.rmSync(work, { recursive: true, force: true }); } catch (x) { }
    const why = e.code === 404 ? 'the download is not on the release page (yet).' : String(e.message || e).replace(/\.?$/, '.');
    return { error: why.charAt(0).toUpperCase() + why.slice(1) };
  }
}

/* the daily check: shortly after start, then every few hours while Moundshroud stays open */
function start() {
  const go = () => { check(true).catch(() => { }); };
  setTimeout(go, 20000).unref(); setInterval(go, 6 * 3600e3).unref();
}

module.exports = { status, check, install, start, _t: { newer, okHost, source } };

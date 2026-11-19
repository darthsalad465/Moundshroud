// Offline Lockdown (app-wide outbound kill-switch) & PC Total Air-Gap (disable/re-enable Windows network adapters).
// 1. App Offline Mode: intercepts http/https/fetch inside the Moundshroud server process and blocks every non-loopback
//    outbound request while keeping localhost (Ollama, Kiwix, local tools, offline Globe packs) 100% functional.
// 2. PC Total Air-Gap: inspects Windows physical network adapters via Get-NetAdapter and disables/re-enables them
//    using sanctioned PowerShell Disable-NetAdapter / Enable-NetAdapter (requesting standard Windows UAC elevation if needed).
const fs = require('fs');
const path = require('path');
const http = require('http');
const https = require('https');
const cp = require('child_process');
const privacy = require('./privacy');
const cloud = require('./cloud');

const ROOT = path.join(__dirname, '..');
const ADAPTERS_FILE = path.join(ROOT, 'data', 'offline-adapters.json');

let appOffline = !!privacy.choice().appOffline;
let guardInstalled = false;
let blockedCount = 0;

function isLoopbackHost(host) {
  const h = String(host || '').trim().toLowerCase().replace(/^\[|\]$/g, '').replace(/\.$/, '');
  if (!h) return false;
  return h === 'localhost' || h === '::1' || h === '0:0:0:0:0:0:0:1' || /^127\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(h);
}

function extractHost(arg0, arg1) {
  try {
    if (typeof arg0 === 'string') return new URL(arg0).hostname;
    if (arg0 instanceof URL) return arg0.hostname;
    if (arg0 && typeof arg0 === 'object') {
      if (arg0.hostname) return String(arg0.hostname);
      if (arg0.host) return String(arg0.host).split(':')[0];
      if (arg0.href) return new URL(arg0.href).hostname;
    }
    if (arg1 && typeof arg1 === 'object') {
      if (arg1.hostname) return String(arg1.hostname);
      if (arg1.host) return String(arg1.host).split(':')[0];
    }
  } catch (e) { }
  return '';
}

function makeBlockedError(host) {
  const err = new Error('Moundshroud App Offline Lockdown is enabled — blocked outbound request to ' + (host || 'internet') + '.');
  err.code = 'APP_OFFLINE';
  return err;
}

function installGuard() {
  if (guardInstalled) return;
  guardInstalled = true;

  const wrap = (mod, fnName) => {
    const orig = mod[fnName];
    if (typeof orig !== 'function') return;
    mod[fnName] = function patchedOutbound(arg0, arg1, arg2) {
      if (appOffline) {
        const host = extractHost(arg0, arg1);
        if (!isLoopbackHost(host)) {
          blockedCount++;
          const err = makeBlockedError(host);
          const EventEmitter = require('events');
          const fake = new EventEmitter();
          fake.end = () => fake;
          fake.write = () => false;
          fake.abort = () => fake;
          fake.destroy = () => fake;
          fake.setTimeout = () => fake;
          fake.setHeader = () => fake;
          fake.getHeader = () => undefined;
          fake.removeHeader = () => fake;
          process.nextTick(() => fake.emit('error', err));
          return fake;
        }
      }
      return orig.apply(this, arguments);
    };
  };

  wrap(http, 'request');
  wrap(http, 'get');
  wrap(https, 'request');
  wrap(https, 'get');

  if (typeof globalThis.fetch === 'function') {
    const origFetch = globalThis.fetch;
    globalThis.fetch = function patchedFetch(input, init) {
      if (appOffline) {
        const urlStr = typeof input === 'string' ? input : (input && input.url ? input.url : '');
        const host = extractHost(urlStr);
        if (!isLoopbackHost(host)) {
          blockedCount++;
          return Promise.reject(makeBlockedError(host));
        }
      }
      return origFetch.apply(this, arguments);
    };
  }
}

function isAppOffline() {
  return appOffline;
}

function setAppOffline(on) {
  appOffline = !!on;
  privacy.setChoice({ appOffline });
  if (appOffline) {
    try { cloud.set({ web: false }); } catch (e) { }
  }
  return { ok: true, appOffline, blockedCount };
}

/* ---------- PC Total Air-Gap (Windows physical network adapters) ---------- */
function readSavedAdapters() {
  try {
    const j = JSON.parse(fs.readFileSync(ADAPTERS_FILE, 'utf8'));
    return Array.isArray(j) ? j.filter(n => typeof n === 'string' && n.trim()) : [];
  } catch (e) { return []; }
}

function writeSavedAdapters(names) {
  try {
    fs.mkdirSync(path.dirname(ADAPTERS_FILE), { recursive: true });
    fs.writeFileSync(ADAPTERS_FILE, JSON.stringify(names, null, 2));
  } catch (e) { }
}

function runPS(script, timeoutMs = 15000) {
  return new Promise(resolve => {
    cp.execFile(
      'powershell.exe',
      ['-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-Command', script],
      { timeout: timeoutMs, windowsHide: true, maxBuffer: 2 * 1048576 },
      (err, stdout, stderr) => {
        resolve({
          ok: !err,
          code: err ? (err.code || 1) : 0,
          stdout: String(stdout || '').trim(),
          stderr: String(stderr || '').trim()
        });
      }
    );
  });
}

async function pcStatus() {
  if (process.platform !== 'win32') {
    return { supported: false, pcOffline: false, adapters: [], activeCount: 0, disabledCount: 0, saved: [] };
  }
  const ps = `
$ad = Get-NetAdapter -Physical -ErrorAction SilentlyContinue | Where-Object { $_.InterfaceDescription -notmatch 'Loopback|Virtual|Hyper-V|WSL|Tailscale|VPN' }
if (-not $ad) { $ad = Get-NetAdapter -Physical -ErrorAction SilentlyContinue }
$out = @($ad | ForEach-Object { [PSCustomObject]@{ name = [string]$_.Name; status = [string]$_.Status; desc = [string]$_.InterfaceDescription } })
ConvertTo-Json -InputObject $out -Compress
`;
  const r = await runPS(ps, 9000);
  let adapters = [];
  try {
    const parsed = JSON.parse(r.stdout || '[]');
    adapters = Array.isArray(parsed) ? parsed : (parsed ? [parsed] : []);
  } catch (e) { adapters = []; }
  const activeCount = adapters.filter(a => /up/i.test(a.status)).length;
  const disabledCount = adapters.filter(a => /disabled/i.test(a.status)).length;
  const saved = readSavedAdapters();
  // Consider PC offline if we have at least one physical adapter and none are Up (and either disabled or saved list exists)
  const pcOffline = adapters.length > 0 && activeCount === 0 && (disabledCount > 0 || saved.length > 0);
  return { supported: true, pcOffline, adapters, activeCount, disabledCount, saved };
}

const ADAPTER_NAME_RE = /^[\w\s\-().#\/]{1,96}$/;
function isSafeAdapterName(s) {
  const name = String(s || '').trim();
  return ADAPTER_NAME_RE.test(name) && !/[`$;\r\n]/.test(name);
}
function psQuote(s) {
  return "'" + String(s || '').replace(/'/g, "''") + "'";
}

async function setPcOffline(offline) {
  if (process.platform !== 'win32') {
    return { ok: false, error: 'PC-wide network shutoff is only available on Windows.' };
  }
  const wantOff = !!offline;
  const before = await pcStatus();
  let targets = [];
  if (wantOff) {
    // Disable every physical adapter that isn't already disabled
    targets = before.adapters.filter(a => !/disabled/i.test(a.status) && isSafeAdapterName(a.name)).map(a => a.name);
    if (!targets.length) {
      return Object.assign({ ok: true, changed: false, note: 'All physical network adapters on this PC are already disabled.' }, before);
    }
    writeSavedAdapters(targets);
  } else {
    // Re-enable the exact adapters we disabled (or any currently disabled physical adapters)
    const saved = readSavedAdapters().filter(isSafeAdapterName);
    const disabledNow = before.adapters.filter(a => /disabled/i.test(a.status) && isSafeAdapterName(a.name)).map(a => a.name);
    targets = saved.length ? saved.filter(n => before.adapters.some(a => a.name === n)) : disabledNow;
    if (!targets.length) targets = disabledNow;
    if (!targets.length) {
      writeSavedAdapters([]);
      return Object.assign({ ok: true, changed: false, note: 'Network adapters are already enabled.' }, before);
    }
  }

  const cmdVerb = wantOff ? 'Disable-NetAdapter' : 'Enable-NetAdapter';
  const nameList = targets.map(psQuote).join(',');
  // Run directly if already elevated; otherwise request standard Windows UAC elevation cleanly
  const inner = `$names = @(${nameList}); foreach ($n in $names) { ${cmdVerb} -Name $n -Confirm:$false -ErrorAction SilentlyContinue }`;
  const elevatedScript = `
$isAdmin = ([Security.Principal.WindowsPrincipal][Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
if ($isAdmin) {
  ${inner}
  Write-Output 'OK_DIRECT'
} else {
  $enc = [Convert]::ToBase64String([Text.Encoding]::Unicode.GetBytes(${psQuote(inner)}))
  try {
    $p = Start-Process powershell.exe -Verb RunAs -WindowStyle Hidden -PassThru -Wait -ArgumentList @('-NoProfile','-ExecutionPolicy','Bypass','-EncodedCommand',$enc)
    if ($p.ExitCode -eq 0) { Write-Output 'OK_UAC' } else { Write-Output ('ERR_CODE_' + $p.ExitCode) }
  } catch {
    Write-Output 'UAC_CANCELLED'
  }
}
`;
  const r = await runPS(elevatedScript, 35000);
  if (/UAC_CANCELLED/.test(r.stdout)) {
    return Object.assign({ ok: false, cancelled: true, error: 'Windows administrator permission was cancelled — network adapters were not changed.' }, await pcStatus());
  }
  // Brief pause so Windows updates adapter state cleanly
  await new Promise(res => setTimeout(res, 900));
  const after = await pcStatus();
  if (!wantOff && !after.pcOffline) writeSavedAdapters([]);
  return Object.assign({
    ok: true,
    changed: true,
    targets,
    note: wantOff
      ? ('Disabled ' + targets.length + ' network adapter' + (targets.length === 1 ? '' : 's') + ' (' + targets.join(', ') + '). This PC is now completely offline.')
      : ('Re-enabled ' + targets.length + ' network adapter' + (targets.length === 1 ? '' : 's') + ' (' + targets.join(', ') + ').')
  }, after);
}

async function status() {
  const pc = await pcStatus();
  return Object.assign({ ok: true, appOffline, blockedCount }, pc);
}

module.exports = {
  installGuard,
  isAppOffline,
  setAppOffline,
  isLoopbackHost,
  isSafeAdapterName,
  pcStatus,
  setPcOffline,
  status
};

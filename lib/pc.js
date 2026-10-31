// PC commands: open an app from the Start menu, volume, lock. Each one is confirmed by the user in the web app before it is sent here.
const cp = require('child_process'), path = require('path');
const ROOT = path.join(__dirname, '..');
let appCache = { at: 0, list: [] };

const ps = (cmd, ms = 20000) => new Promise(res => cp.execFile('powershell.exe', ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-Command', cmd], { windowsHide: true, timeout: ms, maxBuffer: 8e6 }, (e, out) => res(e ? '' : String(out))));

async function apps() {
  if (Date.now() - appCache.at < 600000 && appCache.list.length) return appCache.list;
  const o = await ps('Get-StartApps | Select-Object Name,AppID | ConvertTo-Json -Compress'); let l = [];
  try { const j = JSON.parse(o); l = (Array.isArray(j) ? j : [j]).filter(x => x && x.Name && x.AppID); } catch (e) {}
  appCache = { at: Date.now(), list: l }; return l;
}
async function find(name) {
  const q = String(name || '').toLowerCase().trim().replace(/[^\w .&+'-]/g, ''); if (!q) return [];
  const l = await apps(); const score = a => { const n = a.Name.toLowerCase(); return n === q ? 0 : n.startsWith(q) ? 1 : n.split(/\s+/).some(w => w.startsWith(q)) ? 2 : n.includes(q) ? 3 : 9; };
  return l.map(a => ({ a, s: score(a) })).filter(x => x.s < 9).sort((x, y) => x.s - y.s || x.a.Name.length - y.a.Name.length).slice(0, 4).map(x => x.a);
}
async function openApp(appId) {
  const l = await apps(); if (!l.some(a => a.AppID === appId)) return { error: 'Unknown app' };       // only apps from the Start menu list
  cp.spawn('explorer.exe', ['shell:AppsFolder\\' + appId], { detached: true, stdio: 'ignore' }).unref(); return { ok: true };
}
async function volume(mode, value) {
  if (!['get', 'set', 'up', 'down', 'mute', 'unmute'].includes(mode)) return { error: 'bad mode' };
  const v = Math.max(0, Math.min(100, parseInt(value, 10) || 0));
  const o = await new Promise(res => cp.execFile('powershell.exe', ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', path.join(ROOT, 'pc-volume.ps1'), mode, String(v)], { windowsHide: true, timeout: 20000 }, (e, out) => res(e ? '' : String(out).trim())));
  const m = o.match(/^(\d+),([01])$/); return m ? { level: +m[1], muted: m[2] === '1' } : { error: 'Could not change the volume' };
}
function lock() { cp.spawn('rundll32.exe', ['user32.dll,LockWorkStation'], { detached: true, stdio: 'ignore' }).unref(); return { ok: true }; }

module.exports = { find, openApp, volume, lock };

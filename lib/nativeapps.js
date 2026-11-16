// Launch a whitelisted native app the user has installed (e.g. Cisco Packet Tracer). This opens the app in its own
// window, the one exception to Moundshroud's stay-inside rule, and only for apps the user explicitly asked to add.
const cp = require('child_process'), fs = require('fs'), path = require('path');
function findPacketTracer() {
  for (const base of ['C:/Program Files', 'C:/Program Files (x86)']) {
    try { for (const d of fs.readdirSync(base)) if (/^Cisco Packet Tracer/i.test(d)) { const exe = path.join(base, d, 'bin', 'PacketTracer.exe'); if (fs.existsSync(exe)) return exe; } } catch (e) { }
  }
  return '';
}
const APPS = { packettracer: { name: 'Cisco Packet Tracer', find: findPacketTracer } };
function status(app) { const a = APPS[app]; if (!a) return { ok: false, installed: false }; const exe = a.find(); return { ok: !!exe, name: a.name, installed: !!exe, path: exe }; }
function launch(app) {
  const a = APPS[app]; if (!a) return { ok: false, error: 'unknown app' };
  const exe = a.find(); if (!exe) return { ok: false, error: a.name + ' is not installed on this PC.' };
  try { cp.spawn(exe, [], { detached: true, stdio: 'ignore' }).unref(); return { ok: true, name: a.name }; }
  catch (e) { return { ok: false, error: String(e && e.message || e) }; }
}
module.exports = { status, launch, APPS };

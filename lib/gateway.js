// The Respan Gateway: one local door that every Claude request now goes through.
// It is the open-source gateway (https://github.com/respanai/respan-gateway) run by the private Python in
// `.venv` (made by install-gateway.ps1). It speaks the Anthropic Messages API on a loopback port, so
// lib/cloud.js keeps the request it already builds and only changes the address: the gateway does the routing,
// the retries and the request log, and is one place where another provider could be added later.
// Off unless it is installed: with no gateway the app talks to Anthropic exactly as it always did.
const fs = require('fs'), path = require('path'), cp = require('child_process');
const ROOT = path.join(__dirname, '..');
const WORKER = path.join(ROOT, 'py', 'gatewayworker.py');
/* install-gateway.ps1 makes .venv; the app's own pyenv is tried too, in case it was installed there instead */
const PY = [path.join(ROOT, '.venv', 'Scripts', 'python.exe'), path.join(ROOT, 'pyenv', 'Scripts', 'python.exe')]
  .find(p => fs.existsSync(p)) || '';
let proc = null, ready = null, url = '', why = '', broken = 0;

const available = () => !!PY && fs.existsSync(WORKER);
const address = () => url;

/* start the gateway, with the app's Anthropic key in its environment only (never on disk, never in its arguments) */
function start(key) {
  if (url) return Promise.resolve(url);
  if (broken > Date.now()) return Promise.reject(new Error(why || 'The Respan Gateway is not running.'));
  if (ready) return ready;
  if (!available()) return Promise.reject(new Error('The Respan Gateway is not installed (run install-gateway.ps1).'));
  ready = new Promise((resolve, reject) => {
    let buf = '', err = '', settled = false;
    /* a gateway that will not start is not tried again for five minutes: Claude answers straight from Anthropic meanwhile */
    const fail = m => { if (settled) return; settled = true; stop(); why = m; broken = Date.now() + 300000; reject(new Error(m)); };
    proc = cp.spawn(PY, [WORKER], { stdio: ['pipe', 'pipe', 'pipe'], windowsHide: true, env: Object.assign({}, process.env, { ANTHROPIC_API_KEY: key }) });
    proc.stdout.setEncoding('utf8');
    proc.stdout.on('data', d => {
      buf += d; let i;
      while ((i = buf.indexOf('\n')) >= 0) {
        const line = buf.slice(0, i).trim(); buf = buf.slice(i + 1);
        let j = null; try { j = JSON.parse(line); } catch (e) { continue; }
        if (j.url) { url = String(j.url); why = ''; if (!settled) { settled = true; resolve(url); } }
        else if (j.error) fail(String(j.error));
      }
    });
    proc.stderr.setEncoding('utf8');
    proc.stderr.on('data', d => { err = (err + d).slice(-600); });
    proc.on('error', e => fail('The Respan Gateway could not start: ' + e.message));
    proc.on('exit', () => { const m = (err.trim().split('\n').pop() || 'the gateway stopped').slice(0, 240); stop(); fail(m); });
    setTimeout(() => fail('The Respan Gateway did not start in time.'), 30000);
  });
  ready.catch(() => {});
  return ready;
}

/* stop it, and let the next Claude request start a fresh one */
function stop() {
  url = ''; ready = null; broken = 0;
  if (proc && proc.pid) { try { cp.spawnSync('taskkill', ['/PID', String(proc.pid), '/T', '/F'], { stdio: 'ignore', windowsHide: true }); } catch (e) { } }
  proc = null;
}

module.exports = { available, start, stop, address };

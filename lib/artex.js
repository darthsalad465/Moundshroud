// ARTEX: the AI autonomous penetration-testing system, run on this PC and driven by the local models.
// Moundshroud owns its lifecycle: a private PostgreSQL (runtime/pgsql on port 5433) and artex.exe (port 8787),
// both started on demand and pointed at the local Ollama server. Nothing here reaches the internet by itself.
const cp = require('child_process'), path = require('path'), fs = require('fs'), net = require('net');
const RT = path.join(__dirname, '..', 'runtime');
const PG = { bin: path.join(RT, 'pgsql', 'bin'), data: path.join(RT, 'pgdata'), port: 5433 };
const AX = { dir: path.join(RT, 'artex'), exe: path.join(RT, 'artex', 'artex.exe'), port: 8787, out: path.join(RT, 'artex', 'artex.log'), err: path.join(RT, 'artex', 'artex.err') };
const DSN = 'postgres://artex:artex@127.0.0.1:' + PG.port + '/artex?sslmode=disable';
const OLLAMA = 'http://127.0.0.1:11434/v1';
let model = 'bonsai-2:27b', pgProc = null, axProc = null, starting = false;

const delay = ms => new Promise(r => setTimeout(r, ms));
const portUp = port => new Promise(r => { const s = net.connect({ host: '127.0.0.1', port }, () => { s.destroy(); r(true); }); s.on('error', () => r(false)); s.setTimeout(700, () => { s.destroy(); r(false); }); });
const installed = () => { try { return fs.existsSync(AX.exe) && fs.existsSync(path.join(PG.bin, 'pg_ctl.exe')) && fs.existsSync(path.join(PG.data, 'PG_VERSION')); } catch (e) { return false; } };
/* the one-time setup token artex prints while no admin password is set; blank once a password exists */
function setupToken() { try { const m = /Setup token for the \/setup page:\s*([0-9a-f]+)/i.exec(fs.readFileSync(AX.err, 'utf8')); return m ? m[1] : ''; } catch (e) { return ''; } }
function killTree(pid) { try { cp.spawnSync('taskkill', ['/PID', String(pid), '/T', '/F'], { stdio: 'ignore', windowsHide: true }); } catch (e) { } }
/* the pid listening on a local TCP port, from netstat (so a reused server, started earlier, can still be stopped) */
function pidOnPort(port) { try { const out = cp.execSync('netstat -ano -p tcp', { windowsHide: true }).toString(); for (const ln of out.split('\n')) { const m = ln.match(/^\s*TCP\s+\S+:(\d+)\s+\S+\s+LISTENING\s+(\d+)/); if (m && +m[1] === port) return +m[2]; } } catch (e) { } return 0; }

async function status() {
  const pg = await portUp(PG.port), ax = await portUp(AX.port);
  return { installed: installed(), pg, artex: ax, up: pg && ax, starting, port: AX.port, url: 'http://127.0.0.1:' + AX.port, model, setupToken: ax ? setupToken() : '' };
}
async function start(opts) {
  if (opts && opts.model) model = String(opts.model);
  if (!installed()) return { ok: false, error: 'ARTEX is not set up in the runtime folder.', ...(await status()) };
  if (starting) return status();
  starting = true;
  try {
    if (!await portUp(PG.port)) {
      const log = fs.openSync(path.join(RT, 'pg.log'), 'a');
      pgProc = cp.spawn(path.join(PG.bin, 'postgres.exe'), ['-D', PG.data, '-p', String(PG.port), '-c', 'listen_addresses=127.0.0.1'], { stdio: ['ignore', log, log], windowsHide: true });
      pgProc.unref();
      for (let i = 0; i < 25 && !(await portUp(PG.port)); i++) await delay(400);
    }
    if (!await portUp(AX.port)) {
      const out = fs.openSync(AX.out, 'w'), err = fs.openSync(AX.err, 'w');
      axProc = cp.spawn(AX.exe, ['-addr', '127.0.0.1:' + AX.port, '-proxy='], { cwd: AX.dir, windowsHide: true, stdio: ['ignore', out, err], env: { ...process.env, ARTEX_LLM_PROVIDER: 'ollama', ARTEX_LLM_BASE_URL: OLLAMA, ARTEX_LLM_MODEL: model, ARTEX_PG_DSN: DSN } });
      axProc.unref();
      for (let i = 0; i < 45 && !(await portUp(AX.port)); i++) await delay(400);
    }
  } catch (e) { starting = false; return { ok: false, error: String(e && e.message || e), ...(await status()) }; }
  starting = false; return status();
}
/* Stop just ARTEX (its database keeps running so the next open is quick). */
async function stop() { const pid = (axProc && axProc.pid) || pidOnPort(AX.port); if (pid) killTree(pid); axProc = null; return status(); }
/* Stop ARTEX and its database, for when Moundshroud itself closes. */
function stopAll() {
  const ap = (axProc && axProc.pid) || pidOnPort(AX.port); if (ap) killTree(ap);
  try { cp.spawnSync(path.join(PG.bin, 'pg_ctl.exe'), ['-D', PG.data, 'stop', '-m', 'fast'], { stdio: 'ignore', windowsHide: true, timeout: 9000 }); } catch (e) { }
  const pp = pidOnPort(PG.port); if (pp) killTree(pp);
  axProc = null; pgProc = null;
}
module.exports = { status, start, stop, stopAll, installed, PORT: AX.port };

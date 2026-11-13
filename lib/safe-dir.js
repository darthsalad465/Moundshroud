// The folders an agent or a swarm may be pointed at. The folder comes from the page, so it is checked here, in one
// place, for both. An agent edits files freely in its folder, so some folders are never accepted: this app, the
// agent's own launcher folder (editing the launcher would remove its guard), Windows, the programs folders, the
// places Windows starts programs from, and anything on the network. A whole drive and the whole home folder are
// refused too, unless check() is called with opts { aim: true, wholePc: true }. In that case the Edit and Write
// denials in the generated rule file (lib/agent-modes.js) protect this app, Windows, the programs folders,
// ProgramData, ~/.ssh and ~/.claude.
const fs = require('fs'), os = require('os'), path = require('path');

const ROOT = path.join(__dirname, '..');
const AGENT = process.env.MOUNDSHROUD_AGENT_DIR || path.join(os.homedir(), 'gemma-agent');
const low = p => path.resolve(p).replace(/[\\/]+$/, '').toLowerCase();
const inside = (d, parent) => { const a = low(d), b = low(parent); return a === b || a.startsWith(b + path.sep); };
const env = k => process.env[k] || '';

/* the agent's own workspace is the one place under its launcher folder that is allowed */
const WORKSPACE = path.join(AGENT, 'workspace');
const never = () => [ROOT, env('SystemRoot') || 'C:\\Windows', env('ProgramFiles'), env('ProgramFiles(x86)'), env('ProgramData'),
  env('APPDATA') && path.join(env('APPDATA'), 'Microsoft', 'Windows', 'Start Menu'), path.join(os.homedir(), '.ssh'), path.join(os.homedir(), '.claude')].filter(Boolean);

/* opts is optional. Only { aim: true, wholePc: true } lets a drive root or the home folder through; every other refusal stays. */
function check(dir, opts) {
  const wide = !!(opts && opts.aim === true && opts.wholePc === true);
  const no = error => ({ ok: false, error });
  const raw = String(dir == null ? '' : dir).trim();
  if (!raw) return no('Choose a folder first.');
  if (/^[\\/]{2}/.test(raw)) return no('A folder on the network cannot be used. Choose a folder on this PC.');
  if (/[%"^&|<>\0]/.test(raw) || !path.isAbsolute(raw)) return no('That folder cannot be used. Choose an ordinary folder on this PC.');
  const d = path.normalize(raw);
  let real = d; try { if (!fs.statSync(d).isDirectory()) throw new Error('not a folder'); real = fs.realpathSync(d); } catch (e) { return no('That folder cannot be used. Choose an ordinary folder on this PC.'); }
  for (const p of [d, real]) {
    if (!wide && low(p) === low(path.parse(p).root)) return no('A whole drive cannot be used. Choose a folder for this project.');
    if (!wide && low(p) === low(os.homedir())) return no('Your whole home folder cannot be used. Choose a folder for this project.');
    if (inside(p, AGENT) && !inside(p, WORKSPACE)) return no('The agent\'s own folder cannot be used. Choose a folder for this project.');
    if (never().some(n => inside(p, n))) return no('That folder belongs to Windows or to this app. Choose a folder for this project.');
  }
  return { ok: true, dir: d };
}

module.exports = { check };

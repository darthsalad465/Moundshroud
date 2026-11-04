// The local coding agent: Claude Code's tools driven by the Gemma 4 model that runs in Ollama on this PC.
// This module only reports whether it is set up and opens its launcher in a window of its own; it never runs
// commands for the agent. Nothing leaves this PC. The launcher lives in the user's home folder (gemma-agent\start-gemma-agent.cmd).
const fs = require('fs'), os = require('os'), path = require('path'), http = require('http'), cp = require('child_process');

const DIR = process.env.MOUNDSHROUD_AGENT_DIR || path.join(os.homedir(), 'gemma-agent');
const CMD = path.join(DIR, 'start-gemma-agent.cmd');
const MODEL = 'gemma4-agent';
const OLLAMA = { host: '127.0.0.1', port: 11434 };

const isDir = p => { try { return fs.statSync(p).isDirectory(); } catch (e) { return false; } };

/* Claude Code supplies the agent's tools: look in its usual home and on the PATH */
function claudeFound() {
  const exe = process.platform === 'win32' ? 'claude.exe' : 'claude';
  const dirs = [path.join(os.homedir(), '.local', 'bin')].concat(String(process.env.PATH || '').split(path.delimiter).filter(Boolean));
  return dirs.some(d => { try { return fs.existsSync(path.join(d, exe)); } catch (e) { return false; } });
}

/* asks Ollama which models it has; cb(up, names) */
function models(cb) {
  let done = false; const fin = (up, names) => { if (!done) { done = true; cb(up, names); } };
  const r = http.get({ ...OLLAMA, path: '/api/tags', timeout: 2000 }, res => {
    let b = ''; res.on('data', c => { b += c; });
    res.on('end', () => { try { fin(true, (JSON.parse(b).models || []).map(m => m.name)); } catch (e) { fin(true, []); } });
  });
  r.on('error', () => fin(false, [])); r.on('timeout', () => { r.destroy(); fin(false, []); });
}

/* what the page shows: is the launcher there, is Ollama up, is the model made yet */
function status(cb) {
  models((up, names) => cb({
    installed: fs.existsSync(CMD), dir: DIR, ollama: up,
    model: names.some(n => n === MODEL || n === MODEL + ':latest'), claude: claudeFound(),
  }));
}

/* Opens the launcher in its own console window, optionally working in the folder the user chose.
   The folder comes from the page, so it is checked: it must be an absolute path to a real folder, and characters
   that the Windows command line treats specially are refused. */
function launch(dir) {
  if (!fs.existsSync(CMD)) return { ok: false, error: 'The agent is not set up on this PC yet (looked for ' + CMD + ').' };
  const args = [];
  if (dir != null && String(dir).trim() !== '') {
    const d = path.normalize(String(dir).trim());
    if (!path.isAbsolute(d) || /[%"^&|<>\0]/.test(d) || !isDir(d)) return { ok: false, error: 'That folder cannot be used. Choose an ordinary folder on this PC.' };
    args.push('-Dir', d);
  }
  try {
    const child = cp.spawn('cmd.exe', ['/c', 'start', 'Moundshroud agent', CMD, ...args], { detached: true, stdio: 'ignore', windowsHide: true, cwd: DIR });
    child.on('error', () => { });
    child.unref();
    return { ok: true };
  } catch (e) { return { ok: false, error: 'Could not open the agent: ' + String(e.message || e) }; }
}

module.exports = { status, launch, DIR, MODEL };

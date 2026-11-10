// The local coding agent: Claude Code's tools driven by a model that runs in Ollama on this PC.
// This module reports whether it is set up, lists the Ollama models that can drive it, and opens its launcher in a
// window of its own; it never runs commands for the agent. Nothing leaves this PC.
// The launcher lives in the user's home folder (gemma-agent\start-gemma-agent.cmd).
const fs = require('fs'), os = require('os'), path = require('path'), http = require('http'), cp = require('child_process');

const safeDir = require('./safe-dir');
const DIR = process.env.MOUNDSHROUD_AGENT_DIR || path.join(os.homedir(), 'gemma-agent');
const CMD = path.join(DIR, 'start-gemma-agent.cmd');
const BASE = 'gemma4:e4b', MODEL = 'gemma4-agent';
/* the three tiers of whole-PC access: runs unasked, asks first, always refused (Claude Code reads it through --settings) */
const GUARD = path.join(__dirname, 'agent-guard.json');
const OLLAMA = { host: '127.0.0.1', port: 11434 };

const isDir = p => { try { return fs.statSync(p).isDirectory(); } catch (e) { return false; } };
const bare = n => String(n || '').replace(/:latest$/, '');

/* Claude Code supplies the agent's tools: look in its usual home and on the PATH */
function claudeFound() {
  const exe = process.platform === 'win32' ? 'claude.exe' : 'claude';
  const dirs = [path.join(os.homedir(), '.local', 'bin')].concat(String(process.env.PATH || '').split(path.delimiter).filter(Boolean));
  return dirs.some(d => { try { return fs.existsSync(path.join(d, exe)); } catch (e) { return false; } });
}

/* Each model the agent uses is a copy with a 32,000-token memory, made by the launcher on first use.
   Gemma keeps the copy it has always had; any other model gets "<its name>-agent". */
/* The memory window is how much of a session the model can hold at once, in tokens. 32k is the default; the larger
   sizes let a session run longer and cost more of this PC's memory. Each size is its own copy ("-64k", "-128k"). */
const CTX = [32768, 65536, 131072], CTX_DEFAULT = 32768;
const ctxTag = ctx => +ctx && +ctx !== CTX_DEFAULT ? '-' + Math.round(+ctx / 1024) + 'k' : '';
function agentName(base, ctx) {
  const b = bare(base);
  if (b === BASE || b === MODEL) return MODEL + ctxTag(ctx);
  return b.toLowerCase().replace(/[^a-z0-9.]+/g, '-').replace(/^-+|-+$/g, '') + '-agent' + ctxTag(ctx);
}
const isCopy = n => /-agent(-\d+k)?$/.test(bare(n));

/* asks Ollama which models it has; cb(up, [{name, size}]) */
function tags(cb) {
  let done = false; const fin = (up, list) => { if (!done) { done = true; cb(up, list); } };
  /* five seconds: Ollama answers slowly while a picture or video is being made */
  const r = http.get({ ...OLLAMA, path: '/api/tags', timeout: 5000 }, res => {
    let b = ''; res.on('data', c => { b += c; });
    res.on('end', () => { try { fin(true, (JSON.parse(b).models || []).filter(m => m && m.name).map(m => ({ name: m.name, size: m.size || 0 }))); } catch (e) { fin(true, []); } });
  });
  r.on('error', () => fin(false, [])); r.on('timeout', () => { r.destroy(); fin(false, []); });
}

/* asks Ollama what one model can do ("tools" is the one the agent needs); cb(list) */
function capsOf(name, cb) {
  let done = false; const fin = (v, ctx) => { if (!done) { done = true; cb(v, ctx); } };
  const body = JSON.stringify({ model: name });
  const r = http.request({ ...OLLAMA, path: '/api/show', method: 'POST', timeout: 8000, headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body) } }, res => {
    let b = ''; res.on('data', c => { b += c; });
    res.on('end', () => {
      try {
        const j = JSON.parse(b), info = j.model_info || {}, k = Object.keys(info).find(x => /\.context_length$/.test(x));
        fin(j.capabilities || [], k ? +info[k] || 0 : 0);
      } catch (e) { fin([], 0); }
    });
  });
  r.on('error', () => fin([], 0)); r.on('timeout', () => { r.destroy(); fin([], 0); });
  r.end(body);
}

/* The picker's list: every model except the agent copies, each marked with whether it can use tools
   and whether its copy is already made. caps maps a model name to its list of capabilities. */
function pickable(list, caps, ctxs) {
  const have = new Set(list.map(m => bare(m.name)));
  return list.filter(m => !isCopy(m.name)).map(m => ({
    name: m.name, size: m.size || 0,
    tools: ((caps && caps[m.name]) || []).includes('tools'),
    ready: have.has(agentName(m.name)),
    maxCtx: (ctxs && ctxs[m.name]) || CTX_DEFAULT,                        // the largest memory window the model supports
    readyCtx: CTX.filter(c => have.has(agentName(m.name, c))),            // the sizes whose copy is already made
  }));
}

/* the live list; cb(up, models) */
function list(cb) {
  tags((up, all) => {
    const base = all.filter(m => !isCopy(m.name)), caps = {}, ctxs = {}; let left = base.length;
    if (!left) return cb(up, []);
    base.forEach(m => capsOf(m.name, (c, ctx) => { caps[m.name] = c; ctxs[m.name] = ctx; if (--left === 0) cb(up, pickable(all, caps, ctxs)); }));
  });
}

/* what the page shows: is the launcher there, is Ollama up, which models can drive the agent */
function status(cb) {
  list((up, models) => cb({
    installed: fs.existsSync(CMD), dir: DIR, ollama: up, claude: claudeFound(),
    model: models.some(m => bare(m.name) === BASE && m.ready), models, base: BASE, guard: fs.existsSync(GUARD), ctx: CTX, ctxDefault: CTX_DEFAULT,
  }));
}

/* The model and the guard switch come from the page, so they are checked against the live list:
   the model must be one Ollama has, must be able to use tools, and must hold no command-line characters. */
function check(opts, models) {
  const o = opts || {}, want = String(o.model == null || o.model === '' ? BASE : o.model).trim();
  if (!/^[A-Za-z0-9][A-Za-z0-9._:\/-]{0,119}$/.test(want)) return { ok: false, error: 'That model name cannot be used.' };
  const ctxOf = () => o.ctx == null || o.ctx === '' ? CTX_DEFAULT : +o.ctx;
  /* An empty list means Ollama is asleep, not that the model is missing. The launcher wakes Ollama and makes or
     downloads the standard model itself, so that one may start; any other model needs the list to be checked. */
  if (!(models || []).length) {
    if (bare(want) !== BASE || ctxOf() !== CTX_DEFAULT) return { ok: false, error: 'Ollama is not running, so ' + want + ' cannot be checked. Open the agent once with the standard model (' + BASE + ', 32k) and it starts Ollama.' };
    if (o.guard && !fs.existsSync(GUARD)) return { ok: false, error: 'The rule file for whole-PC access is missing (' + GUARD + ').' };
    return { ok: true, model: BASE, agentModel: MODEL, ctx: CTX_DEFAULT, guard: o.guard ? GUARD : '' };
  }
  const m = (models || []).find(x => x.name === want || bare(x.name) === bare(want));
  if (!m) return { ok: false, error: 'Ollama does not have the model ' + want + '.' };
  if (!m.tools) return { ok: false, error: bare(m.name) + ' cannot use tools, so it cannot drive the agent. Pick another model.' };
  if (o.guard && !fs.existsSync(GUARD)) return { ok: false, error: 'The rule file for whole-PC access is missing (' + GUARD + ').' };
  const ctx = o.ctx == null || o.ctx === '' ? CTX_DEFAULT : +o.ctx;
  if (!CTX.includes(ctx)) return { ok: false, error: 'That memory size cannot be used.' };
  if (ctx > (m.maxCtx || CTX_DEFAULT)) return { ok: false, error: bare(m.name) + ' cannot hold a memory that large.' };
  return { ok: true, model: m.name, agentModel: agentName(m.name, ctx), ctx, guard: o.guard ? GUARD : '' };
}

/* Opens the launcher in its own console window, optionally working in the folder the user chose.
   The folder comes from the page, so it is checked: it must be an absolute path to a real folder, and characters
   that the Windows command line treats specially are refused. */
function launch(dir, opts, models) {
  if (!fs.existsSync(CMD)) return { ok: false, error: 'The agent is not set up on this PC yet (looked for ' + CMD + ').' };
  const c = check(opts, models); if (!c.ok) return c;
  const special = /[%"^&|<>\0]/, args = [];
  if (dir != null && String(dir).trim() !== '') {
    const s = safeDir.check(dir); if (!s.ok) return s;
    args.push('-Dir', s.dir);
  }
  args.push('-Model', c.model, '-AgentModel', c.agentModel, '-Ctx', String(c.ctx));
  if (c.guard) { if (special.test(c.guard)) return { ok: false, error: 'The rule file is in a folder whose name cannot be used.' }; args.push('-Guard', c.guard); }
  try {
    const child = cp.spawn('cmd.exe', ['/c', 'start', 'Moundshroud agent', CMD, ...args], { detached: true, stdio: 'ignore', windowsHide: true, cwd: DIR });
    child.on('error', () => { });
    child.unref();
    return { ok: true, model: c.model, guard: !!c.guard };
  } catch (e) { return { ok: false, error: 'Could not open the agent: ' + String(e.message || e) }; }
}

/* ---- headless steps, for swarms: one task, no window, always under the guard ---- */
const PS1 = path.join(DIR, 'start-gemma-agent.ps1');
const headlessArgs = (c, dir, promptFile) => ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', PS1, '-Dir', dir, '-Model', c.model, '-AgentModel', c.agentModel, '-Guard', GUARD, '-PromptFile', promptFile];
/* the lines Claude Code prints when the guard refuses a command (nobody is there to ask in a headless step) */
const refusals = out => String(out || '').split(/\r?\n/).filter(l => /Permission to use .* has been denied/.test(l)).map(l => l.trim().slice(0, 300));
/* the files in a folder with the time each was last changed, to tell what a step made (the agent's own folders are skipped) */
function snapshot(dir) {
  const out = {}, walk = (d, depth) => {
    let list = []; try { list = fs.readdirSync(d, { withFileTypes: true }); } catch (e) { return; }
    for (const e of list) {
      if (e.name === 'node_modules' || e.name === '.git' || e.name === '.claude') continue;
      const p = path.join(d, e.name);
      if (e.isDirectory()) { if (depth < 4) walk(p, depth + 1); }
      else { try { out[path.relative(dir, p)] = fs.statSync(p).mtimeMs; } catch (x) { } }
      if (Object.keys(out).length > 2000) return;
    }
  };
  walk(dir, 0); return out;
}

/* Runs one task with the chosen model in dir and resolves with what it said and which files it made or changed.
   The prompt is written to a file: it is text for the model, and it must never be read as part of a command. */
function runHeadless(o, models) {
  return new Promise(resolve => {
    const fail = error => resolve({ ok: false, output: '', files: [], refused: [], error });
    if (!fs.existsSync(PS1)) return fail('The agent is not set up on this PC yet (looked for ' + PS1 + ').');
    const c = check({ model: o.model, guard: true }, models); if (!c.ok) return fail(c.error);
    const sdir = safeDir.check(o.dir); if (!sdir.ok) return fail(sdir.error);
    const dir = sdir.dir;
    const pf = path.join(os.tmpdir(), 'moundshroud-step-' + process.pid + '-' + Date.now() + '-' + Math.random().toString(36).slice(2, 8) + '.txt');
    try { fs.writeFileSync(pf, String(o.prompt || ''), 'utf8'); } catch (e) { return fail('Could not hand the task to the agent.'); }
    const before = snapshot(dir); let out = '', done = false, child = null;
    const end = r => { if (done) return; done = true; fs.unlink(pf, () => { }); resolve(r); };
    const kill = () => { if (child && child.pid) { try { cp.spawnSync('taskkill', ['/PID', String(child.pid), '/T', '/F'], { stdio: 'ignore', windowsHide: true }); } catch (e) { } } };
    try { child = cp.spawn('powershell.exe', headlessArgs(c, dir, pf), { cwd: dir, windowsHide: true, stdio: ['ignore', 'pipe', 'ignore'] }); }
    catch (e) { return end({ ok: false, output: '', files: [], refused: [], error: 'Could not start the agent: ' + String(e.message || e) }); }
    child.stdout.setEncoding('utf8');
    child.stdout.on('data', d => { out = (out + d).slice(-200000); });
    child.on('error', e => end({ ok: false, output: out, files: [], refused: [], error: 'Could not start the agent: ' + e.message }));
    child.on('close', code => {
      const after = snapshot(dir), files = Object.keys(after).filter(f => before[f] !== after[f] && f !== 'SWARM-NOTES.md').sort();
      /* the launcher's own two status lines are not part of the answer */
      const said = out.split(/\r?\n/).filter(l => !/^(Model: .* Access: |It reads anywhere and edits freely|Memory: \d+ tokens)/.test(l)).join('\n').trim();
      end({ ok: code === 0, output: said, files, refused: refusals(out), error: code === 0 ? '' : 'The agent stopped with an error.' });
    });
    if (o.signal) { if (o.signal.aborted) kill(); else o.signal.addEventListener('abort', kill); }
  });
}

module.exports = { CTX, CTX_DEFAULT, status, list, launch, check, pickable, agentName, headlessArgs, refusals, runHeadless, DIR, MODEL, BASE, GUARD };

// Moundshroud Code: the agent harness built into the app itself. No outside program runs the agent: this module asks the
// model (in Ollama, or the free pool through the bridge) for the next step, runs the tool it asks for, and sends the
// result back, until the model stops asking. It offers the same controls as lib/harness.js, so the Agent tab does not
// know the difference: start, send, answer, stop, state, show, clear.
//
// Safety is decided here, not by the model:
//   · folder-only reach: every file the agent reads or writes must be inside the session folder, and a command that
//     names a path outside it is refused;
//   · whole-PC reach (guarded): reading anywhere, but this app, the agent's launcher, Windows, the programs folders,
//     ProgramData, the browser and key folders and .env files stay shut to writing;
//   · commands: a short list of things that can destroy a PC (format, diskpart, boot edits, wiping Windows) is refused
//     outright and never reaches the page; a small list of harmless read-only commands runs unasked; everything else is
//     held until the person approves it in the page, and is refused when nobody is there (routines).
// Every command is split into its parts first, so `dir && format c:` is judged as two commands, not one.
const fs = require('fs'), os = require('os'), path = require('path'), cp = require('child_process'), http = require('http'), crypto = require('crypto');
const agent = require('./agent');
const bridge = require('./agentbridge');
const { playbooks, savePhoto } = require('./harness');

const NAME = 'Moundshroud Code', KIND = 'native';
const MAX_EVENTS = 500, MAX_TEXT = 60000, ASK_TIMEOUT = 30 * 60000, MAX_STEPS = 24;
const OUT_CAP = 8000, READ_CAP = 12000, CMD_MS = 180000;
const ROOT = path.join(__dirname, '..');

const cut = (s, n) => { s = String(s == null ? '' : s); return s.length > n ? s.slice(0, n - 40) + '\n... (the rest is not shown)' : s; };
/* A tool call that goes back to the model must carry its arguments as an object, not as JSON text: Ollama reads the
   text form as a broken object and rejects the whole request, which reads on screen as a model that said nothing. */
const argObj = a => { if (a && typeof a === 'object') return a; try { const o = JSON.parse(String(a == null ? '' : a) || '{}'); return o && typeof o === 'object' ? o : {}; } catch (e) { return {}; } };
const small = input => { const o = {}; if (input && typeof input === 'object') for (const k of Object.keys(input).slice(0, 20)) { const v = input[k]; o[k] = typeof v === 'string' ? cut(v, 6000) : (v == null || typeof v === 'number' || typeof v === 'boolean') ? v : cut(JSON.stringify(v), 2000); } return o; };
const low = p => path.resolve(p).replace(/[\\/]+$/, '').toLowerCase();
const inside = (p, dir) => { const a = low(p), b = low(dir); return a === b || a.startsWith(b + path.sep); };

/* ---- what must never be touched, whatever the agent asks ---- */
const env = k => process.env[k] || '';
const AGENT_DIR = process.env.MOUNDSHROUD_AGENT_DIR || path.join(os.homedir(), 'gemma-agent');
const WORKSPACE = path.join(AGENT_DIR, 'workspace');
const PROTECTED = () => [ROOT, env('SystemRoot') || 'C:\\Windows', env('ProgramFiles'), env('ProgramFiles(x86)'), env('ProgramData'),
  env('APPDATA') && path.join(env('APPDATA'), 'Microsoft', 'Windows', 'Start Menu'),
  path.join(os.homedir(), '.ssh'), path.join(os.homedir(), '.aws'), path.join(os.homedir(), '.gnupg'), path.join(os.homedir(), '.claude')].filter(Boolean).map(p => path.resolve(p));
/* the agent's launcher folder is shielded too, but its workspace is the normal place to work */
const inProtected = p => PROTECTED().some(n => inside(p, n)) || (inside(p, AGENT_DIR) && !inside(p, WORKSPACE));
/* files that hold secrets: read only when the person has allowed the whole PC, never carried into a reply silently */
const SECRET = /(^|[\\/])(\.env(\.\w+)?|\.git-credentials|credentials|id_rsa|id_ed25519|id_ecdsa|\.npmrc|\.pypirc)$/i;

/* ---- the command policy ---- */
/* these are refused before the page is asked, and the reason is shown instead */
const NEVER = [
  [/\bformat(\.com)?\s+[a-z]:/i, 'formatting a drive'],
  [/\bdiskpart\b/i, 'changing disks with diskpart'],
  [/\bbcdedit\b/i, 'changing how Windows starts'],
  [/\bmkfs(\.\w+)?\b/i, 'making a filesystem'],
  [/(^|[\s;|&])dd\s+[^\n]*\bof=/i, 'writing raw blocks with dd'],
  [/\bcipher\s+\/w/i, 'wiping free space with cipher'],
  [/\bvssadmin\s+delete/i, 'deleting shadow copies'],
  [/\bwevtutil\s+cl\b/i, 'clearing the Windows event log'],
  [/\breg\s+delete\s+hk(lm|cr)\b/i, 'deleting Windows registry keys'],
  [/\b(rm|del|erase)\b[^\n]*\s(-[a-z]*[rf][a-z]*\s+)*(\/|\/\*|~|\$home|[a-z]:[\\/]?\s*$)/i, 'deleting a whole drive or home folder'],
  [/\b(rmdir|rd)\s+\/s\s+\/q\s+([a-z]:[\\/]|\\|\/)$/i, 'deleting a whole drive'],
  [/\bremove-item\b[^\n]*\b-recurse\b[^\n]*\b-force\b[^\n]*([a-z]:\\?$|\\$|\/$)/i, 'deleting a whole drive'],
  [/\b(shutdown|restart-computer|stop-computer)\b/i, 'shutting the PC down'],
  [/\bnetsh\s+(firewall|advfirewall|winsock)\b/i, 'changing the firewall'],
  [/\bcacls\b/i, 'resetting file permissions on protected files'],
  [/\bnet\s+user\s+\S+\s+.*\/add\b/i, 'making a Windows account'],
  [/\btaskkill\b[^\n]*\/f[^\n]*\/im\s+(explorer|winlogon|lsass|csrss|services|svchost)\.exe/i, 'ending a Windows system process'],
  [/\b(del|erase)\b[^\n]*(\\windows\\|\\program files)/i, 'deleting Windows files'],
];
/* harmless: reading and listing only. Nothing here changes a file. */
const SAFE_HEAD = /^(dir|ls|where|which|type|cat|echo|pwd|cd|findstr|find|more|git status|git diff|git log|git show|git branch|node --check|python -m py_compile|py -m py_compile|tsc --noemit|mkdir|md|tree|ver|date|time)\b/i;
const parts = c => String(c || '').split(/&&|\|\||[;|\r\n]+/).map(s => s.trim()).filter(Boolean);

/* the worst thing any part of a command does: 'deny', 'safe', or 'ask' */
function judge(command, dir, wholePc, depth) {
  const list = parts(command);
  if (!list.length) return { level: 'deny', why: 'That command is empty.' };
  /* models often wrap a command as `cmd /c ...`; that wrapper hides nothing, so the command inside is judged instead */
  if ((depth || 0) < 3) for (const p of list) {
    const w = /^cmd(\.exe)?\s+(?:\/[a-z]\s+)*\/c\s+([\s\S]+)$/i.exec(p);
    if (w && w[2].trim()) return judge(w[2].trim(), dir, wholePc, (depth || 0) + 1);
  }
  let secret = false;
  for (const p of list) {
    for (const [re, why] of NEVER) if (re.test(p)) return { level: 'deny', why: 'Refused: ' + why + ' is never allowed (the guard stops it before anything runs).' };
    /* a command that names a password or key file is never treated as harmless reading */
    if (SECRET.test(p) || /(^|[\s"'=:])\.env(\.\w+)?(\s|$|["'])/i.test(p) || /[\\/]\.(ssh|aws|gnupg)([\\/]|\s|$)/i.test(p)) secret = true;
    /* a protected path in a command that changes something is refused, not merely questioned */
    const writes = /\b(del|erase|rd|rmdir|remove-item|move|mv|ren|rename|copy|cp|attrib|icacls|takeown)\b|>/.test(p);
    if (writes) {
      for (const n of PROTECTED()) { if (p.toLowerCase().includes(n.toLowerCase())) return { level: 'deny', why: 'Refused: that command changes a protected folder (' + n + '), which is never allowed.' }; }
    }
    /* folder-only reach: an absolute path outside the folder may not be named at all, and neither may ".." climb out */
    if (!wholePc && dir) {
      if (/\.\.[\\/]/.test(p) || /(^|\s)\.\.(\s|$)/.test(p)) return { level: 'deny', why: 'Refused: that command climbs out of ' + dir + ' with "..", which folder-only reach does not allow.' };
      const abs = p.match(/(?:[a-z]:[\\/][^\s"']*|\\\\\\\\[^\s"']+)/gi) || (/(^|\s)(~|\/c\/)[^\s]*/i.exec(p) || [])[0];
      const found = Array.isArray(abs) ? abs : (abs ? [abs] : []);
      for (const a of found) if (!inside(a.replace(/["']/g, ''), dir)) return { level: 'deny', why: 'Refused: the agent may only work inside ' + dir + '. Turn on "Whole PC, guarded" in the Agent tab to work elsewhere.' };
    }
  }
  if (secret) return { level: 'ask', secret: true, why: 'That command names a password or key file, so it waits for your approval.' };
  if (list.every(p => SAFE_HEAD.test(p))) return { level: 'safe' };
  return { level: 'ask', why: 'This changes something on the PC, so it waits for your approval.' };
}

/* ---- the tools the model may ask for ---- */
const TOOLS = [
  { type: 'function', function: { name: 'read_file', description: 'Read a text file. Give a path, and optionally a line to start at and how many lines. Always read a file before changing it.', parameters: { type: 'object', properties: { path: { type: 'string', description: 'The file to read, relative to the working folder or a full path.' }, offset: { type: 'number', description: 'First line to show (1 is the top).' }, limit: { type: 'number', description: 'How many lines to show.' } }, required: ['path'] } } },
  { type: 'function', function: { name: 'write_file', description: 'Create a file or replace everything in it. Use edit_file when only a few lines change.', parameters: { type: 'object', properties: { path: { type: 'string', description: 'The file to write.' }, content: { type: 'string', description: 'The whole new contents of the file.' } }, required: ['path', 'content'] } } },
  { type: 'function', function: { name: 'edit_file', description: 'Change part of a file: find an exact piece of text and replace it. The piece must appear exactly once, so include a few lines around it.', parameters: { type: 'object', properties: { path: { type: 'string', description: 'The file to change.' }, find: { type: 'string', description: 'The exact text to find, copied from the file.' }, replace: { type: 'string', description: 'What to put there. Empty deletes it.' } }, required: ['path', 'find', 'replace'] } } },
  { type: 'function', function: { name: 'list_files', description: 'List the files and folders in a folder, so you can see what a project holds.', parameters: { type: 'object', properties: { path: { type: 'string', description: 'The folder to list. Default: the working folder.' }, pattern: { type: 'string', description: 'Only names matching this, like *.js or *test*.' } } } } },
  { type: 'function', function: { name: 'search_files', description: 'Search inside every text file in a folder for a piece of text or a regular expression, and show the matching lines.', parameters: { type: 'object', properties: { pattern: { type: 'string', description: 'The text or regular expression to look for.' }, path: { type: 'string', description: 'The folder to search. Default: the working folder.' }, pattern_files: { type: 'string', description: 'Only search files whose name matches this, like *.js' } }, required: ['pattern'] } } },
  { type: 'function', function: { name: 'run_command', description: 'Run a command in Windows (cmd.exe) and see its output. Use it to build, test, list files or run a script. Anything that changes the PC needs the person to approve it.', parameters: { type: 'object', properties: { command: { type: 'string', description: 'The command line exactly as you would type it in cmd.exe.' }, why: { type: 'string', description: 'One short line saying what the command is for, shown when asking for approval.' } }, required: ['command'] } } },
  { type: 'function', function: { name: 'multi_edit', description: 'Change several places in one file in a single step: give a list of exact texts to find and what to put in their place. Use it instead of many edit_file calls. Each find must appear exactly once, or nothing is written.', parameters: { type: 'object', properties: { path: { type: 'string', description: 'The file to change.' }, edits: { type: 'array', description: 'The changes, in order.', items: { type: 'object', properties: { find: { type: 'string', description: 'The exact text to find, copied from the file.' }, replace: { type: 'string', description: 'What to put there. Empty deletes it.' } }, required: ['find', 'replace'] } } }, required: ['path', 'edits'] } } },
  { type: 'function', function: { name: 'delete_file', description: 'Delete one file. Never a folder, never a password or key file, never Windows or this app. Use it instead of running del or rm.', parameters: { type: 'object', properties: { path: { type: 'string', description: 'The file to delete.' } }, required: ['path'] } } },
  { type: 'function', function: { name: 'move_file', description: 'Move or rename a file or folder. Nothing is overwritten: if the new name is taken, it is refused.', parameters: { type: 'object', properties: { from: { type: 'string', description: 'What to move.' }, to: { type: 'string', description: 'Where it goes, with its new name.' } }, required: ['from', 'to'] } } },
  { type: 'function', function: { name: 'make_dir', description: 'Create a folder, and any folder above it that is missing.', parameters: { type: 'object', properties: { path: { type: 'string', description: 'The folder to create.' } }, required: ['path'] } } },
  { type: 'function', function: { name: 'find_files', description: 'Find files by name across a folder using a pattern: *.js, **/*.test.js, src/**/*.css. Use it to locate files before reading them.', parameters: { type: 'object', properties: { pattern: { type: 'string', description: 'The name pattern, for example **/*.js' }, path: { type: 'string', description: 'The folder to search. Default: the working folder.' } }, required: ['pattern'] } } },
  { type: 'function', function: { name: 'file_info', description: 'How big a file is, when it last changed, how many lines it has and whether it is a folder — without reading all of it.', parameters: { type: 'object', properties: { path: { type: 'string', description: 'The file or folder.' } }, required: ['path'] } } },
  { type: 'function', function: { name: 'web_fetch', description: 'Read a public web page, a raw file or a JSON API as plain text: documentation, a release note, an error message. Only http and https on the public internet; nothing on this PC or a private network is reachable.', parameters: { type: 'object', properties: { url: { type: 'string', description: 'The full address, starting with https://' }, max_chars: { type: 'number', description: 'How much text to keep (default 8000).' } }, required: ['url'] } } },
  { type: 'function', function: { name: 'update_plan', description: 'Write down the steps of the job so the person can watch them, and tick them off as you go. For anything longer than two steps, write the plan first. Send the whole list again each time a step is done, with the finished step numbers in done.', parameters: { type: 'object', properties: { steps: { type: 'array', description: 'The steps, in order.', items: { type: 'string' } }, done: { type: 'array', description: 'Which steps are finished (1 is the first).', items: { type: 'number' } } }, required: ['steps'] } } },
  { type: 'function', function: { name: 'set_autonomy', description: 'How strictly you are asked first. "careful" asks the person before every change, "normal" asks before commands that change the PC, "auto" asks only when something is forbidden. You may use this when the person asks you to ask less, or to be safer; raising it always waits for them to agree.', parameters: { type: 'object', properties: { level: { type: 'string', description: 'careful, normal or auto.', enum: ['careful', 'normal', 'auto'] }, why: { type: 'string', description: 'One short line on why, shown to the person.' } }, required: ['level'] } } },
  { type: 'function', function: { name: 'craft_anything', description: 'Study how a website, app or game works and build your own version of it, with Craft Anything: an outside engine whose 320 tools are each a CLI subcommand. Give the subcommand and its arguments the way the CLI takes them. "commands" lists every tool, "doctor" checks the install, and "rebuild <target> \\"what you want\\" --rounds 1" runs a whole study-and-build. Reading commands (commands, doctor, --version) run at once; a rebuild, or anything that writes, waits for the person to approve it.', parameters: { type: 'object', properties: { command: { type: 'string', description: 'The Craft Anything command line after the program name, for example: commands — or: rebuild https://example.com "Recreate this website" --rounds 1' }, why: { type: 'string', description: 'One short line saying what it is for, shown when asking for approval.' } }, required: ['command'] } } },
];

/* ---- Craft Anything, an outside engine the agent may drive, when it is installed ----
   Its 320 tools are CLI subcommands, so one tool reaches all of them. The command line is split here and run
   without a shell, so nothing extra can be tacked onto it.                                                */
/* these only read: they list its tools, its capabilities, its session and its projects, so they run at once */
const CRAFT_SAFE = /^(-h|--help|--version|-V|commands|capabilities|doctor|completion|setup|core-session-show|core-targets-list|core-evidence-show|core-unknowns-show|rebuild-status|project-list|project-show|assets-key-status)$/i;
function craftArgs(line) {                    // a command line, split the way a shell would, never through one
  const out = []; let cur = '', q = '';
  for (const ch of String(line || '')) {
    if (q) { if (ch === q) q = ''; else cur += ch; continue; }
    if (ch === '"' || ch === "'") { q = ch; continue; }
    if (/\s/.test(ch)) { if (cur) { out.push(cur); cur = ''; } continue; }
    cur += ch;
  }
  if (cur) out.push(cur);
  return out;
}
function craftPath() {
  const names = process.platform === 'win32' ? ['craft-anything-cli.exe', 'craft-anything-cli.cmd', 'craft-anything-cli'] : ['craft-anything-cli'];
  const roots = [path.join(ROOT, 'data', 'craft-anything'), path.join(ROOT, 'tools', 'craft-anything'),
    path.join(os.homedir(), '.cargo', 'bin'), env('LOCALAPPDATA') && path.join(env('LOCALAPPDATA'), 'Programs', 'craft-anything'),
    env('LOCALAPPDATA') && path.join(env('LOCALAPPDATA'), 'craft-anything'), 'C:\\Program Files\\craft-anything'].filter(Boolean);
  try {                                                   // one already on the PATH wins
    const w = cp.spawnSync(process.platform === 'win32' ? 'where' : 'which', ['craft-anything-cli'], { encoding: 'utf8', windowsHide: true, timeout: 8000 });
    if (w && w.status === 0) { const p = String(w.stdout || '').split(/\r?\n/).map(s => s.trim()).filter(Boolean)[0]; if (p && fs.existsSync(p)) return p; }
  } catch (e) { }
  for (const r of roots) for (const n of names) { try { const p = path.join(r, n); if (fs.existsSync(p)) return p; } catch (e) { } }
  return '';
}
const CRAFT_HOW = 'Craft Anything is not installed, so that tool is not here yet. Any one of these puts it in reach:\n' +
  '  · the Windows installer or portable build: https://github.com/storytold/craft-anything/releases\n' +
  '  · from source, where Rust is installed: git clone https://github.com/storytold/craft-anything && cd craft-anything && cargo install --path apps/craft-anything-cli\n' +
  '  · or unpack the portable build into ' + path.join(ROOT, 'data', 'craft-anything') + ' and it will be found there.';
function craftRun(line, timeoutMs, dir) {
  const bin = craftPath();
  if (!bin) return { ok: false, error: CRAFT_HOW, missing: true };
  const args = craftArgs(line);
  if (!args.length) return { ok: false, error: 'Give the command to run: commands · doctor · rebuild <target> "what you want" --rounds 1' };
  let r;
  try { r = cp.spawnSync(bin, args, { encoding: 'utf8', timeout: timeoutMs || CMD_MS, windowsHide: true, maxBuffer: 8 * 1024 * 1024, cwd: dir || undefined }); }
  catch (e) { return { ok: false, error: 'Craft Anything could not run: ' + e.message }; }
  if (r.error) return { ok: false, error: 'Craft Anything could not run: ' + (r.error.code === 'ETIMEDOUT' ? 'it took too long and was stopped' : r.error.message) };
  const out = String(r.stdout || '') + (r.stderr ? (r.stdout ? '\n' : '') + String(r.stderr) : '');
  const text = out.trim() || '(it finished without saying anything)';
  /* text is for the model; whole is the untouched answer, so a page can summarise a 60 KB tool list */
  return { ok: r.status === 0, text: cut(text, OUT_CAP), whole: text, error: r.status === 0 ? '' : 'Craft Anything exited with code ' + r.status + '.\n' + cut(text, 2000), code: r.status };
}

/* ---- the model: one answer (with the tool calls it asks for), streamed so the page can watch it write ---- */
function post(host, port, body, onText, ctl, onThink) {
  return new Promise(done => {
    /* older saved sessions keep their tool arguments as JSON text; Ollama refuses that, so every request is cleaned here */
    if (Array.isArray(body && body.messages)) for (const m of body.messages) {
      if (!m || !Array.isArray(m.tool_calls)) continue;
      for (const c of m.tool_calls) if (c && c.function && typeof c.function.arguments === 'string') c.function.arguments = argObj(c.function.arguments);
    }
    const data = Buffer.from(JSON.stringify(body));
    let req;
    try {
      req = http.request({ host, port, path: '/api/chat', method: 'POST', headers: { 'Content-Type': 'application/json', 'Content-Length': data.length } }, res => {
        if (ctl) ctl.req = req;
        let text = '', calls = [], buf = '', err = '', raw = '', think = '';
        res.setEncoding('utf8');
        const take = line => {
            if (!line) return;
            let j; try { j = JSON.parse(line); } catch (e) { raw = (raw + line).slice(-600); return; }
            if (j.error) err = String(j.error);
            const m = j.message || {};
            /* the free bridge sends the whole reply again on its last line, so that line replaces what was built up
               rather than being added to it; a model on this PC ends with an empty line and keeps its pieces */
            /* a model that thinks out loud sends its working-out in message.thinking, beside the answer */
            const th = typeof m.thinking === 'string' ? m.thinking : (typeof m.reasoning === 'string' ? m.reasoning : '');
            if (j.done) {
              if (typeof m.content === 'string' && m.content) text = m.content;
              if (th) think = th;
            }
            else {
              if (m.content) { text += m.content; if (onText) try { onText(text); } catch (e) { } }
              if (th) { think += th; if (onThink) try { onThink(think); } catch (e) { } }
            }
            if (Array.isArray(m.tool_calls)) calls = calls.concat(m.tool_calls);
        };
        res.on('data', chunk => {
          buf += chunk;
          let i;
          while ((i = buf.indexOf('\n')) >= 0) {
            const line = buf.slice(0, i).trim(); buf = buf.slice(i + 1);
            take(line);
          }
          if (buf.length > 4e6) buf = '';
        });
        /* Ollama answers a refused request with one short line and no newline: it used to be left in the buffer, so a
           rejected request read as an empty answer. The tail is read here, and a bad status always says so. */
        res.on('end', () => { const tail = buf.trim(); buf = ''; if (tail) take(tail);
          if (!err && res.statusCode && res.statusCode >= 400) err = 'The model answered with error ' + res.statusCode + (raw ? ': ' + cut(raw, 300) : '.');
          done(err ? { ok: false, error: err } : { ok: true, text, calls, think }); });
        res.on('error', e => done({ ok: false, error: String((e && e.message) || e) }));
      });
    } catch (e) { return done({ ok: false, error: String((e && e.message) || e) }); }
    req.on('error', e => done({ ok: false, error: String((e && e.message) || e) }));
    req.setTimeout(15 * 60000, () => { try { req.destroy(new Error('the model did not answer in time')); } catch (e) { } });
    req.end(data);
  });
}

function create(deps) {
  const d = Object.assign({ ask: null, prepare: null, run: null, save: () => { }, dataDir: '', askTimeoutMs: ASK_TIMEOUT, unattended: false }, deps || {});
  const S = { running: false, busy: false, preparing: false, live: '', thinking: false, showThink: false, thinkText: '', seq: 0, sessionId: '', model: '', ctx: 0, dir: '', guard: false, mode: 'code', autonomy: 'normal', web: false, plan: [], title: '', events: [], messages: [], pending: new Map(), child: null, stopped: false, ctl: null, check: null, turnId: 0 };
  const push = e => { e.seq = ++S.seq; e.at = Date.now(); S.events.push(e); if (S.events.length > MAX_EVENTS) S.events.splice(0, S.events.length - MAX_EVENTS); return e; };
  const snapshot = () => ({ id: S.sessionId, title: S.title, dir: S.dir, model: S.model, ctx: S.ctx, guard: S.guard, harness: KIND, at: Date.now(), events: S.events.slice(-200) });
  const keep = () => { try { d.save(snapshot()); } catch (e) { } saveHistory(); };
  const file = () => S.sessionId && d.dataDir ? path.join(d.dataDir, 'native', S.sessionId + '.json') : '';
  function saveHistory() {
    const f = file(); if (!f) return;
    try { fs.mkdirSync(path.dirname(f), { recursive: true }); fs.writeFileSync(f, JSON.stringify({ messages: S.messages.slice(-80) })); } catch (e) { }
  }
  function loadHistory(id) {
    if (!d.dataDir || !id) return;
    try { const j = JSON.parse(fs.readFileSync(path.join(d.dataDir, 'native', id + '.json'), 'utf8')); if (Array.isArray(j.messages)) S.messages = j.messages.slice(-80); } catch (e) { }
  }

  function state(since) {
    const n = +since || 0;
    return { harness: KIND, running: S.running, busy: S.busy, preparing: S.preparing, live: S.live, thinking: S.thinking, think: S.showThink, thinkText: S.thinkText, seq: S.seq, sessionId: S.sessionId, title: S.title, model: S.model, ctx: S.ctx, dir: S.dir, guard: S.guard, mode: S.mode, autonomy: S.autonomy, web: S.web, plan: S.plan,
      pending: [...S.pending.values()].map(p => ({ id: p.id, tool: p.tool, input: p.input, why: p.why })), events: S.events.filter(e => e.seq > n) };
  }

  /* a question for the person: the turn waits here until they answer, or the question expires */
  function askUser(tool, input, why) {
    return new Promise(done => {
      const id = 'nc' + crypto.randomBytes(5).toString('hex');
      if (d.unattended) {
        push({ kind: 'ask', id, tool, input, why: why || '' });
        push({ kind: 'answer', id, allow: false, tool, input, unattended: true });
        return done(false);
      }
      const p = { id, tool, input, why: why || '', done };
      p.timer = setTimeout(() => { if (S.pending.has(id)) { S.pending.delete(id); push({ kind: 'answer', id, allow: false, tool, input, late: true }); done(false); } }, d.askTimeoutMs);
      S.pending.set(id, p);
      push({ kind: 'ask', id, tool, input, why: p.why });
    });
  }

  /* ---- the file tools ---- */
  function place(p, write) {
    const raw = String(p == null ? '' : p).trim();
    if (!raw) return { ok: false, error: 'No path was given.' };
    if (raw.includes('\0')) return { ok: false, error: 'That path cannot be used.' };
    const full = path.resolve(S.dir || process.cwd(), raw);
    if (!S.guard && !inside(full, S.dir)) return { ok: false, error: 'Folder-only reach: ' + full + ' is outside ' + S.dir + '. Turn on "Whole PC, guarded" in the Agent tab to work elsewhere.' };
    if (inProtected(full)) return { ok: false, error: 'That path belongs to Windows, this app or the agent itself, so it is never changed: ' + full };
    if (write && SECRET.test(full)) return { ok: false, error: 'That file holds a password or key, so the agent does not change it: ' + full };
    return { ok: true, full };
  }
  function readFile(a) {
    const w = place(a.path); if (!w.ok) return w;
    let st; try { st = fs.statSync(w.full); } catch (e) { return { ok: false, error: 'There is no file at ' + w.full + '.' }; }
    if (st.isDirectory()) return { ok: false, error: w.full + ' is a folder. Use list_files.' };
    if (!S.guard && SECRET.test(w.full)) return { ok: false, error: 'That file holds a password or key. Turn on "Whole PC, guarded" if you really mean to read it.' };
    if (st.size > 2e6) return { ok: false, error: 'That file is too big to read at once (' + Math.round(st.size / 1048576) + ' MB).' };
    let text; try { text = fs.readFileSync(w.full, 'utf8'); } catch (e) { return { ok: false, error: 'That file could not be read: ' + e.message }; }
    if (text.indexOf('\0') >= 0) return { ok: false, error: 'That is a binary file, so it cannot be read as text.' };
    const lines = text.split(/\r?\n/), off = Math.max(1, +a.offset || 1), lim = Math.min(2000, +a.limit || 2000);
    const take = lines.slice(off - 1, off - 1 + lim);
    const head = off > 1 ? '(from line ' + off + ') ' : '';
    return { ok: true, text: cut(head + take.join('\n') + (off - 1 + lim < lines.length ? '\n... (' + (lines.length - off + 1 - lim) + ' more lines)' : ''), READ_CAP) };
  }
  function writeFile(a) {
    const w = place(a.path, true); if (!w.ok) return w;
    try { fs.mkdirSync(path.dirname(w.full), { recursive: true }); fs.writeFileSync(w.full, String(a.content == null ? '' : a.content)); }
    catch (e) { return { ok: false, error: 'That file could not be written: ' + e.message }; }
    return { ok: true, text: 'Wrote ' + w.full + ' (' + String(a.content || '').split(/\r?\n/).length + ' lines).' };
  }
  function editFile(a) {
    const w = place(a.path, true); if (!w.ok) return w;
    let text; try { text = fs.readFileSync(w.full, 'utf8'); } catch (e) { return { ok: false, error: 'There is no file at ' + w.full + '. Use write_file to make it.' }; }
    const find = String(a.find == null ? '' : a.find), rep = String(a.replace == null ? '' : a.replace);
    if (!find) return { ok: false, error: 'Nothing to find was given.' };
    const n = text.split(find).length - 1;
    if (!n) return { ok: false, error: 'That text is not in the file. Read the file again and copy the exact lines, spaces included.' };
    if (n > 1) return { ok: false, error: 'That text appears ' + n + ' times. Include a line before and after it so it is unique.' };
    try { fs.writeFileSync(w.full, text.replace(find, () => rep)); } catch (e) { return { ok: false, error: 'That file could not be written: ' + e.message }; }
    return { ok: true, text: 'Changed ' + w.full + '.' };
  }
  function walk(root, out, depth) {
    if (depth > 4 || out.length > 400) return;
    let list; try { list = fs.readdirSync(root, { withFileTypes: true }); } catch (e) { return; }
    for (const e of list) {
      if (out.length > 400) return;
      if (/^(node_modules|\.git|\.cache|dist|build|__pycache__)$/i.test(e.name)) { out.push({ p: path.join(root, e.name), dir: true, skipped: true }); continue; }
      const full = path.join(root, e.name);
      if (e.isDirectory()) { out.push({ p: full, dir: true }); walk(full, out, depth + 1); }
      else out.push({ p: full, dir: false, size: (() => { try { return fs.statSync(full).size; } catch (x) { return 0; } })() });
    }
  }
  function listFiles(a) {
    const base = a.path ? place(a.path) : { ok: true, full: S.dir };
    if (!base.ok) return base;
    let st; try { st = fs.statSync(base.full); } catch (e) { return { ok: false, error: 'There is no folder at ' + base.full + '.' }; }
    if (!st.isDirectory()) return { ok: false, error: base.full + ' is a file. Use read_file.' };
    const out = []; walk(base.full, out, 0);
    const glob = String(a.pattern || '').trim().toLowerCase();
    const like = (name, pat) => new RegExp('^' + pat.replace(/[.+^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '.*').replace(/\?/g, '.') + '$', 'i').test(name);
    const list = out.filter(x => !glob || like(path.basename(x.p), glob)).slice(0, 200)
      .map(x => path.relative(S.dir || base.full, x.p).replace(/\\/g, '/') + (x.dir ? '/' : ''));
    return { ok: true, text: list.length ? cut(list.join('\n'), OUT_CAP) : 'That folder is empty.' };
  }
  function searchFiles(a) {
    const pat = String(a.pattern || ''); if (!pat) return { ok: false, error: 'Nothing to search for was given.' };
    let re; try { re = new RegExp(pat, 'i'); } catch (e) { re = new RegExp(pat.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i'); }
    const base = a.path ? place(a.path) : { ok: true, full: S.dir };
    if (!base.ok) return base;
    const files = []; walk(base.full, files, 0);
    const glob = String(a.pattern_files || '').trim().toLowerCase();
    const like = (name, pattern) => new RegExp('^' + pattern.replace(/[.+^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '.*') + '$', 'i').test(name);
    const hits = [];
    for (const f of files) {
      if (hits.length >= 60) break;
      if (f.dir || (glob && !like(path.basename(f.p), glob)) || f.size > 2e6) continue;
      let text; try { text = fs.readFileSync(f.p, 'utf8'); } catch (e) { continue; }
      if (text.indexOf('\0') >= 0) continue;
      const lines = text.split(/\r?\n/);
      for (let i = 0; i < lines.length; i++) {
        if (!re.test(lines[i])) continue;
        hits.push(path.relative(S.dir || base.full, f.p).replace(/\\/g, '/') + ':' + (i + 1) + ': ' + lines[i].trim().slice(0, 200));
        if (hits.length >= 60) break;
      }
    }
    return { ok: true, text: hits.length ? cut(hits.join('\n'), OUT_CAP) : 'No file in that folder contains that.' };
  }

    /* ---- the tools that change things, and the plan ---- */
  /* how often the person is asked: their setting decides, not the model */
  function needAsk(tool, input, why, always) {
    if (S.autonomy === 'auto') return Promise.resolve(true);
    if (!always && S.autonomy !== 'careful') return Promise.resolve(true);
    return askUser(tool, input, why);
  }
  function multiEdit(a) {
    const w = place(a.path, true); if (!w.ok) return w;
    let text; try { text = fs.readFileSync(w.full, 'utf8'); } catch (e) { return { ok: false, error: 'There is no file at ' + w.full + '.' }; }
    const list = Array.isArray(a.edits) ? a.edits.slice(0, 40) : [];
    if (!list.length) return { ok: false, error: 'No changes were given.' };
    let out = text, n = 0;
    for (const e of list) {
      const find = String((e && e.find) == null ? '' : e.find), rep = String((e && e.replace) == null ? '' : e.replace);
      if (!find) return { ok: false, error: 'One of the changes has nothing to find, so nothing was written.' };
      const times = out.split(find).length - 1;
      if (times !== 1) return { ok: false, error: 'A change was dropped: its text appears ' + times + ' times, and it has to appear exactly once — ' + find.slice(0, 90) };
      out = out.replace(find, () => rep); n++;
    }
    try { fs.writeFileSync(w.full, out); } catch (e) { return { ok: false, error: 'That file could not be written: ' + e.message }; }
    return { ok: true, text: 'Changed ' + n + ' place' + (n === 1 ? '' : 's') + ' in ' + w.full + '.' };
  }
  function deleteFile(a) {
    const w = place(a.path, true); if (!w.ok) return w;
    let st; try { st = fs.statSync(w.full); } catch (e) { return { ok: false, error: 'There is nothing at ' + w.full + '.' }; }
    if (st.isDirectory()) return { ok: false, error: w.full + ' is a folder. Folders are not deleted by a tool; ask the person to approve a command if one really has to go.' };
    if (SECRET.test(w.full)) return { ok: false, error: 'That file holds a password or key, so it is never deleted.' };
    try { fs.unlinkSync(w.full); } catch (e) { return { ok: false, error: 'It could not be deleted: ' + e.message }; }
    return { ok: true, text: 'Deleted ' + w.full + '.' };
  }
  function moveFile(a) {
    const from = place(a.from, true); if (!from.ok) return from;
    const to = place(a.to, true); if (!to.ok) return to;
    if (from.full === to.full) return { ok: false, error: 'Those are the same place.' };
    if (!fs.existsSync(from.full)) return { ok: false, error: 'There is nothing at ' + from.full + '.' };
    if (fs.existsSync(to.full)) return { ok: false, error: 'Something is already at ' + to.full + ', and nothing is overwritten.' };
    try { fs.mkdirSync(path.dirname(to.full), { recursive: true }); fs.renameSync(from.full, to.full); }
    catch (e) { return { ok: false, error: 'It could not be moved: ' + e.message }; }
    return { ok: true, text: 'Moved ' + from.full + ' to ' + to.full + '.' };
  }
  function makeDir(a) {
    const w = place(a.path, true); if (!w.ok) return w;
    if (fs.existsSync(w.full)) return fs.statSync(w.full).isDirectory() ? { ok: true, text: w.full + ' is already there.' } : { ok: false, error: 'A file with that name is already there.' };
    try { fs.mkdirSync(w.full, { recursive: true }); } catch (e) { return { ok: false, error: 'That folder could not be made: ' + e.message }; }
    return { ok: true, text: 'Made ' + w.full + '.' };
  }
  function globRe(pat) {
    const raw = String(pat || '*').replace(/\\/g, '/').trim();
    const esc = raw.replace(/[.+^${}()|[\]\\]/g, '\\$&');
    const body = esc.replace(/\*\*\/?/g, '\u0001').replace(/\*/g, '[^/]*').replace(/\?/g, '.').replace(/\u0001/g, '(?:.*/)?');
    return new RegExp('^' + body + '$', 'i');
  }
  function findFiles(a) {
    const base = a.path ? place(a.path) : { ok: true, full: S.dir };
    if (!base.ok) return base;
    const re = globRe(a.pattern || '*');
    const all = []; walk(base.full, all, 0);
    const hits = all.filter(f => !f.dir).map(f => ({ rel: path.relative(S.dir || base.full, f.p).replace(/\\/g, '/'), base: path.basename(f.p), size: f.size || 0 }))
      .filter(f => re.test(f.rel) || re.test(f.base)).slice(0, 250)
      .map(f => f.rel + (f.size ? '  (' + Math.max(1, Math.round(f.size / 1024)) + ' KB)' : ''));
    return { ok: true, text: hits.length ? cut(hits.join('\n'), OUT_CAP) : 'No file matches ' + (a.pattern || '*') + ' there.' };
  }
  function fileInfo(a) {
    const w = place(a.path); if (!w.ok) return w;
    let st; try { st = fs.statSync(w.full); } catch (e) { return { ok: false, error: 'There is nothing at ' + w.full + '.' }; }
    const bits = [st.isDirectory() ? 'folder' : 'file', st.size + ' bytes', 'changed ' + new Date(st.mtimeMs).toISOString().replace('T', ' ').slice(0, 19)];
    if (!st.isDirectory() && st.size < 2e6) { try { const t = fs.readFileSync(w.full, 'utf8'); if (t.indexOf('\0') < 0) bits.push(t.split(/\r?\n/).length + ' lines'); } catch (e) { } }
    return { ok: true, text: w.full + ' — ' + bits.join(' · ') };
  }
  /* nothing on this PC, or on a home network, is reachable this way */
  const PRIVATE = /^https?:\/\/(localhost|127\.|0\.0\.0\.0|\[::1\]|10\.|192\.168\.|169\.254\.|172\.(1[6-9]|2\d|3[01])\.)/i;
  const unescape = h => String(h).replace(/&nbsp;/g, ' ').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&amp;/g, '&');
  const htmlText = h => unescape(String(h)
    .replace(/<script[\s\S]*?<\/script>/gi, ' ').replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<\/(p|div|li|h[1-6]|tr|pre|section|article|blockquote)>/gi, '\n').replace(/<br\s*\/?>/gi, '\n')
    .replace(/<[^>]+>/g, ' '))
    .replace(/[ \t]{2,}/g, ' ').replace(/\n{3,}/g, '\n\n').trim();
  async function webFetch(a) {
    if (!S.web) return { ok: false, error: 'Internet access is off, so nothing was fetched. The person can allow it with /net on.' };
    const url = String(a.url || '').trim();
    if (!/^https?:\/\//i.test(url)) return { ok: false, error: 'Give a full address, starting with http:// or https://.' };
    if (PRIVATE.test(url)) return { ok: false, error: 'That address is this PC or a private network, so it is not fetched.' };
    const cap = Math.max(1000, Math.min(20000, +a.max_chars || 8000));
    try {
      const r = await fetch(url, { headers: { 'user-agent': 'Moundshroud-Code/1.0', accept: 'text/html,application/json,text/plain' }, redirect: 'follow' });
      if (!r.ok) return { ok: false, error: 'That address answered ' + r.status + '.' };
      const type = String(r.headers.get('content-type') || '').toLowerCase();
      if (type && !/text|json|xml|html|javascript/.test(type)) return { ok: false, error: 'That address is not text (' + type + '), so it was not read.' };
      let t = await r.text();
      if (/html/.test(type) || /^\s*<(?:!doctype|html)/i.test(t)) t = htmlText(t);
      return { ok: true, text: cut(String(t).trim() || '(that page was empty)', cap) };
    } catch (e) { return { ok: false, error: 'That address could not be read: ' + String((e && e.message) || e) }; }
  }
  function setPlan(a) {
    const steps = Array.isArray(a.steps) ? a.steps.slice(0, 30).map(s => String(typeof s === 'string' ? s : (s && s.text) || '').trim()).filter(Boolean) : [];
    const done = Array.isArray(a.done) ? a.done.map(n => +n).filter(n => n >= 1 && n <= steps.length) : [];
    S.plan = steps.map((t, i) => ({ text: t, done: done.includes(i + 1) }));
    push({ kind: 'plan', steps: S.plan });
    keep();
    return { ok: true, text: steps.length ? 'Plan written: ' + steps.length + ' steps, ' + S.plan.filter(s => s.done).length + ' done.' : 'The plan is cleared.' };
  }
  /* the person can change this, and so can the model — but raising it always waits for the person */
  const RANK = { careful: 0, normal: 1, auto: 2 };
  async function setAutonomy(level, why, askFirst) {
    const l = String(level || '').toLowerCase();
    if (!Object.prototype.hasOwnProperty.call(RANK, l)) return { ok: false, error: 'Autonomy is careful, normal or auto.' };
    if (l === S.autonomy) return { ok: true, level: l, same: true, text: 'Autonomy is already ' + l + '.' };
    if (askFirst && RANK[l] > RANK[S.autonomy]) {
      const yes = await askUser('set_autonomy', { level: l }, 'The agent asks to be asked less: ' + l + '. ' + String(why || ''));
      if (!yes) return { ok: false, error: 'The person did not agree, so it stays ' + S.autonomy + '.' };
    }
    S.autonomy = l;
    push({ kind: 'autonomy', level: l, why: String(why || '') });
    if (S.messages.length && S.messages[0] && S.messages[0].role === 'system') S.messages[0] = { role: 'system', content: systemPrompt() };
    keep();
    return { ok: true, level: l, text: 'Autonomy is now ' + l + '.' };
  }

  /* ---- the command tool: judged first, run only after that ---- */
  function runCommand(a, id) {
    const command = String(a.command == null ? '' : a.command).trim();
    if (!command) return Promise.resolve({ ok: false, error: 'No command was given.' });
    if (command.length > 4000) return Promise.resolve({ ok: false, error: 'That command is too long.' });
    const v = judge(command, S.dir, S.guard);
    if (v.level === 'deny') return Promise.resolve({ ok: false, error: v.why, refused: true });
    /* "auto" trusts the agent with ordinary work, but a command that names a password or key file still waits */
    const go = (v.level === 'safe' || (S.autonomy === 'auto' && !v.secret)) ? Promise.resolve(true) : askUser('run_command', { command }, String(a.why || '') || v.why);
    return go.then(allow => {
      if (!allow) return { ok: false, error: 'The person did not allow that command, so it was not run.', refused: true };
      if (S.stopped) return { ok: false, error: 'The session was stopped.' };
      return new Promise(done => {
        let out = '', err = '', finished = false;
        const fin = r => { if (finished) return; finished = true; S.child = null; done(r); };
        let child;
        try { child = d.run ? d.run(command, S.dir) : cp.spawn('cmd.exe', ['/d', '/s', '/c', command], { cwd: S.dir || process.cwd(), windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'] }); }
        catch (e) { return fin({ ok: false, error: 'That command could not start: ' + e.message }); }
        S.child = child;
        const grab = (buf, isErr) => { const t = buf.toString('utf8'); if (isErr) err = (err + t).slice(-OUT_CAP); else out = (out + t).slice(-OUT_CAP); };
        child.stdout && child.stdout.on('data', b => grab(b, false));
        child.stderr && child.stderr.on('data', b => grab(b, true));
        const timer = setTimeout(() => { try { cp.spawnSync('taskkill', ['/PID', String(child.pid), '/T', '/F'], { stdio: 'ignore', windowsHide: true }); } catch (e) { try { child.kill(); } catch (x) { } } fin({ ok: false, error: 'That command was still running after ' + Math.round(CMD_MS / 60000) + ' minutes, so it was stopped.' }); }, CMD_MS);
        child.on('error', e => { clearTimeout(timer); fin({ ok: false, error: 'That command could not run: ' + e.message }); });
        child.on('close', code => {
          clearTimeout(timer);
          const body = [out.trim(), err.trim()].filter(Boolean).join('\n--- errors ---\n');
          fin({ ok: code === 0, code, text: cut(body || '(no output)', OUT_CAP) });
        });
      });
    });
  }

  function runTool(call, id) {
    const fn = (call && call.function) || call || {};
    const name = String(fn.name || '');
    let args = fn.arguments;
    if (typeof args === 'string') { try { args = JSON.parse(args || '{}'); } catch (e) { args = {}; } }
    args = args && typeof args === 'object' ? args : {};
    const toolId = id;
    push({ kind: 'tool', toolId, name, input: small(args) });
    if (name === 'run_command') return runCommand(args, toolId);
    /* a tool that changes something only runs after the person has agreed, when their setting says so */
    const gate = (label, input, why, always, fn) => needAsk(label, input, why, always)
      .then(go => go ? fn() : { ok: false, error: 'The person did not allow that, so nothing was changed.', refused: true });
    let r;
    try {
      if (name === 'read_file') r = readFile(args);
      else if (name === 'list_files') r = listFiles(args);
      else if (name === 'search_files') r = searchFiles(args);
      else if (name === 'find_files') r = findFiles(args);
      else if (name === 'file_info') r = fileInfo(args);
      else if (name === 'write_file') return gate('write_file', { path: args.path }, 'It writes ' + (args.path || 'a file') + '.', false, () => writeFile(args));
      else if (name === 'edit_file') return gate('edit_file', { path: args.path }, 'It changes ' + (args.path || 'a file') + '.', false, () => editFile(args));
      else if (name === 'multi_edit') return gate('multi_edit', { path: args.path, edits: (Array.isArray(args.edits) ? args.edits.length : 0) }, 'It changes ' + (args.path || 'a file') + ' in ' + (Array.isArray(args.edits) ? args.edits.length : 0) + ' places.', false, () => multiEdit(args));
      else if (name === 'delete_file') return gate('delete_file', { path: args.path }, 'It deletes ' + (args.path || 'a file') + '. This cannot be undone.', true, () => deleteFile(args));
      else if (name === 'move_file') return gate('move_file', { from: args.from, to: args.to }, 'It moves ' + (args.from || '') + ' to ' + (args.to || '') + '.', false, () => moveFile(args));
      else if (name === 'make_dir') return gate('make_dir', { path: args.path }, 'It makes the folder ' + (args.path || '') + '.', false, () => makeDir(args));
      else if (name === 'web_fetch') return webFetch(args);
      else if (name === 'update_plan') r = setPlan(args);
      else if (name === 'set_autonomy') return setAutonomy(args.level, args.why, true);
      else if (name === 'craft_anything') {
        const line = String(args.command || args.args || '').trim();
        if (!line) return { ok: false, error: 'Give the Craft Anything command, for example: commands' };
        const head = (craftArgs(line)[0] || '');
        const go = () => craftRun(line, /rebuild|build|make/i.test(head) ? 20 * 60000 : 120000, S.dir);
        /* reading its own help or listing its tools changes nothing, so it does not wait */
        if (CRAFT_SAFE.test(head) || /^(-h|--help|--version)$/i.test(line)) return go();
        return needAsk('craft_anything', { command: line }, 'It runs Craft Anything: ' + cut(line, 120), false, go)
          .then(ok2 => ok2 ? go() : { ok: false, error: 'The person did not allow that, so nothing was run.', refused: true });
      }
      else r = { ok: false, error: 'There is no tool called "' + name + '". Use only the tools you were given.' };
    } catch (e) { r = { ok: false, error: 'That tool failed: ' + e.message }; }
    return Promise.resolve(r);
  }

  /* ---- one turn: ask, run what it asked for, send the answer back, until it stops asking ---- */
  async function turn(text) {
    S.busy = true; S.live = ''; S.stopped = false;
    /* a stop, or a newer message, leaves this turn for dead — even if it is still waiting on something slow */
    const me = ++S.turnId, dead = () => S.stopped || me !== S.turnId;
    let bad = '', emptyTries = 0, plain = false;
    for (let step = 0; step < MAX_STEPS; step++) {
      if (dead()) break;
      S.thinking = true; S.live = '';
      const ask = d.ask || defaultAsk;
      /* chat mode: the same model and the same conversation, asked without any tools */ 
      const tools = plain ? null : (S.mode === 'chat' ? null : TOOLS);
      /* the last try is made without tools and with a short nudge, so a model that got lost in the tool result still answers */
      const convo = plain ? S.messages.concat([{ role: 'user', content: 'Continue from the tool result above. Do not call another tool: answer me in one or two plain sentences.' }]) : S.messages;
      let r;
      S.thinkText = '';
      try {
        r = await ask(convo, tools, S,
          t => { S.thinking = false; S.live = cut(t, MAX_TEXT); },
          t => { S.thinking = true; S.thinkText = cut(t, MAX_TEXT); });    // the working-out, as it is written
      }
      catch (e) { r = { ok: false, error: String((e && e.message) || e) }; }
      if (dead()) break;
      if (S.thinkText.trim()) push({ kind: 'thought', text: cut(S.thinkText, 8000) });   // kept, so /think can show it
      S.thinkText = '';
      S.live = ''; S.thinking = false;
      if (!r || !r.ok) { bad = (r && r.error) || 'The model did not answer.'; break; }
      const say = String(r.text || '').trim();
      const calls = Array.isArray(r.calls) ? r.calls.slice(0, 8) : [];
      if (say) push({ kind: 'text', text: cut(say, MAX_TEXT) });
      /* A model can send nothing back at all — a small one does it now and then, and that used to read as a turn
         that simply ended with no answer. It is asked once more; if it still says nothing, the reason is shown. */
      if (!say && !calls.length) {
        if (dead()) break;
        if (emptyTries === 0) { emptyTries = 1; continue; }             // asked again, with the same conversation
        if (!plain && S.mode !== 'chat') { plain = true; emptyTries = 2; continue; }   // asked once more, plainly
        bad = 'The model sent back nothing at all. Try again, or /model to pick another one.';
        break;
      }
      emptyTries = 0; plain = false;
      const msg = { role: 'assistant', content: String(r.text || '') };
      if (calls.length) msg.tool_calls = calls.map((c, i) => ({ id: (c && c.id) || 'call_' + (step + 1) + '_' + (i + 1), type: 'function', function: { name: String(((c && c.function) || c || {}).name || ''), arguments: argObj(((c && c.function) || c || {}).arguments) } }));
      S.messages.push(msg);
      if (!msg.tool_calls || !msg.tool_calls.length) break;
      for (const call of msg.tool_calls) {
        if (dead()) break;
        const id = 'n' + crypto.randomBytes(4).toString('hex');
        let res; try { res = await runTool(call, id); } catch (e) { res = { ok: false, error: 'That tool failed: ' + e.message }; }
        const body = res.ok ? (res.text || '(done)') : ('FAILED: ' + (res.error || 'unknown'));
        push({ kind: 'result', toolId: id, text: cut(body, OUT_CAP), isError: !res.ok });
        S.messages.push({ role: 'tool', tool_call_id: call.id, tool_name: call.function && call.function.name, content: body });
      }
      if (S.messages.length > 80) S.messages.splice(0, S.messages.length - 80);
      if (dead()) break;
    }
    if (me !== S.turnId) return;                       // a newer turn has taken over: this one says nothing more
    S.busy = false; S.live = ''; S.thinking = false;
    if (S.stopped) push({ kind: 'stopped' });
    else push(bad ? { kind: 'error', text: cut(bad, 600) } : { kind: 'done', ok: true, text: '' });
    keep();
  }

  /* the real model call: the free pool through the bridge, or a model on this PC */
  async function defaultAsk(messages, tools, S2, onText, onThink) {
    const c = S2.check || {};
    const ctl = { req: null }; S.ctl = ctl;
    let host = '127.0.0.1', port = 11434;
    if (c.free) {
      const u = bridge.url(); if (!u) return { ok: false, error: 'The free AI bridge is not running.' };
      const m = /^http:\/\/([^:/]+):(\d+)/.exec(u); if (!m) return { ok: false, error: 'The free AI bridge address could not be read.' };
      host = m[1]; port = +m[2];
    }
    const body = { model: c.agentModel || c.model, stream: true, think: !!(S2 && S2.showThink), keep_alive: '5m', messages, options: { temperature: S2 && S2.mode === 'chat' ? 0.7 : 0.2, num_predict: Math.min(4096, Math.floor((c.ctx || 32768) / 8)) } };
    if (Array.isArray(tools) && tools.length) body.tools = tools;        // chat mode sends none at all
    let r = await post(host, port, body, onText, ctl, onThink);
    /* a model that cannot think out loud refuses the request: ask it again plainly, and say so once */
    if (!r.ok && body.think && /think|reason/i.test(String(r.error || ''))) {
      S.showThink = false;
      r = await post(host, port, Object.assign({}, body, { think: false }), onText, ctl, onThink);
      if (r.ok) push({ kind: 'note', text: 'this model does not think out loud, so /think has been switched off' });
    }
    S.ctl = null;
    return r;
  }

  function systemPrompt() {
    const pb = playbooks();
    const how = S.mode === 'chat'
      ? 'This is chat mode: you have no tools at all, so answer questions, explain, and think things through with the person. Never say you read, ran or changed anything. When something needs doing, say what you would do and tell them to switch to code mode with /code.\n'
      : 'You have real tools: read_file, write_file, edit_file, list_files, search_files and run_command. Use them instead of guessing. Read a file before you change it. ' +
        'Anything that changes the PC needs the person to approve it, so say in one short line what you are about to do before doing it. If a tool is refused, do not try to get around it: say what you needed and why.\n';
    return 'You are ' + NAME + ', the coding agent built into Moundshroud, working on the person\'s own Windows PC. You work in this folder: ' + (S.dir || '(none)') + '.\n' +
      (S.guard ? 'You may read files anywhere on this PC, but Windows, the programs folders, Moundshroud itself and the browser and key folders are shut to writing.\n' : 'You may only read and write inside that folder. A command that names a path outside it is refused.\n') +
      how +
      'You have these tools: read_file, write_file, edit_file, multi_edit, delete_file, move_file, make_dir, list_files, find_files, file_info, search_files, run_command, web_fetch, update_plan, set_autonomy and craft_anything.\n' +
      'craft_anything drives Craft Anything, an outside engine for seeing how a website, app or game works and building your own version of it. Its workflow commands are commands (list all 320 tools), capabilities, doctor, triage, report, chat and rebuild; every single tool is also a subcommand, named like core-session-show or web-site-capture, and `craft_anything` with just that name and its arguments runs it. Add --project <folder> to keep evidence in a project folder, and --deep only when the person has said the target is theirs to look inside. If it is not installed it says how to get it; do not pretend you ran it.\n' +
      'How often you are asked first is set by the person: ' + S.autonomy + ' (careful = before every change, normal = before commands that change the PC, auto = only when something is forbidden). Do not try to get around a question that was refused. If they ask you to ask less, call set_autonomy.\n' +
      'For anything longer than two steps, call update_plan with the steps first, and send the whole list again with the finished numbers as you go.\n' +
      'The person can attach a picture to a message. It is saved in the working folder under .moundshroud\\refs and the message says where. ' + (S.check && S.check.vision ? 'This model can see pictures: the picture itself is in that message, so look at it before you answer.' : 'This model cannot see pictures, so you may use the file (copy or link it) but you cannot look at it.') + '\n' +
      'Internet access is ' + (S.web ? 'on: you may read public pages and APIs with web_fetch.' : 'off: web_fetch will refuse, so ask the person to turn it on with /net on in the terminal if you really need a page.') + '\n' +
      'Reply in short, plain sentences. One step at a time. When you have made a change, check it (for example node --check on a .js file, or run the thing you built) and only then say it works. Never claim something works if you did not run it.\n' +
      'Windows commands: use dir, type, findstr, copy, move. Paths use backslashes.\n\n' + pb;
  }

  async function start(o) {
    const c = o && o.check; if (!c || !c.agentModel) return { ok: false, error: 'Choose a model first.' };
    if (S.preparing) return { ok: false, error: 'A session is already being started.' };
    if (S.running) stop();
    S.preparing = true;
    if (c.free) {
      try { await bridge.ensure(); } catch (e) { S.preparing = false; return { ok: false, error: 'The free AI bridge could not start: ' + String((e && e.message) || e) }; }
    }
    /* chat mode asks nothing of the model but an answer, so it needs no copy with a larger memory */
    let r = { ok: true };
    if (!c.chat) { try { r = d.prepare ? await d.prepare(c) : await realPrepare(c); } catch (e) { r = { ok: false, error: String(e.message || e) }; } }
    S.preparing = false;
    if (!r || !r.ok) return { ok: false, error: (r && r.error) || 'The model could not be made ready.' };
    const resume = /^session_[A-Za-z0-9_]{4,120}$/.test(String(o.resume || '')) ? String(o.resume) : '';
    const kept = !!o.keep && !!S.sessionId;        // a new model on the same conversation
    if (!resume && !kept) { S.events = []; S.sessionId = ''; S.title = ''; }
    if (!resume) { S.events = []; S.seq = 0; }
    S.sessionId = resume || (kept ? S.sessionId : '') || ('session_mc_' + crypto.randomBytes(8).toString('hex'));
    Object.assign(S, { running: true, busy: false, stopped: false, live: '', thinking: false, model: c.model, ctx: c.ctx, dir: o.dir || '', guard: !!c.guard, mode: o.mode === 'chat' ? 'chat' : 'code', check: c, pending: new Map(), child: null });
    if (resume) loadHistory(resume); else if (!kept) S.messages = [];
    S.messages.unshift({ role: 'system', content: systemPrompt() });
    S.messages = S.messages.filter((m, i) => i === 0 || m.role !== 'system');
    push({ kind: 'started', model: c.model, ctx: c.ctx, dir: o.dir, guard: !!c.guard, resumed: !!resume, harness: KIND });
    keep();
    return { ok: true };
  }

  function send(text, photo) {
    const t = String(text == null ? '' : text).trim();
    if (!S.running) return { ok: false, error: 'Start a session first.' };
    if (S.busy) return { ok: false, error: 'The agent is still working. Wait for it, or press Stop.' };
    if (!t) return { ok: false, error: 'Type a message first.' };
    if (t.length > 20000) return { ok: false, error: 'That message is too long (20,000 characters at most).' };
    const saved = savePhoto(S.dir, photo); if (!saved.ok) return saved;
    /* the picture goes to the model as pixels when it can see them, and always as a file it may use */
    let said = t; const looks = !!(S.check && S.check.vision);
    if (saved.path) said = t + '\n\n[The person attached a picture: ' + saved.path + ' (in the working folder: ' + saved.rel + ').' +
      (looks ? ' You can see it in this message.' : ' This model cannot see pictures, but the file itself is there to use.') + ']';
    if (!S.title) S.title = t.replace(/\s+/g, ' ').slice(0, 80);
    push(Object.assign({ kind: 'user', text: t }, saved.name ? { photo: saved.name } : {}));
    const msg = { role: 'user', content: said };
    if (saved.path && looks) {
      const b64 = String(photo && photo.data || '').replace(/^data:[^,]*,/, '').replace(/\s+/g, '');
      if (b64) msg.images = [b64];
    }
    S.messages.push(msg);
    if (S.messages.length > 80) S.messages.splice(0, S.messages.length - 80);
    turn(t).catch(e => { S.busy = false; push({ kind: 'error', text: 'The agent stopped: ' + String((e && e.message) || e) }); });
    return { ok: true };
  }

  /* chat mode and code mode are the same conversation with the same model: only the tools and the instructions change */
  function setMode(mode) {
    if (!S.running) return { ok: false, error: 'Start a session first.' };
    if (S.busy) return { ok: false, error: 'The agent is still working. Wait for it, or press Stop.' };
    const m = mode === 'chat' ? 'chat' : 'code';
    if (S.mode === m) return { ok: true, mode: m, same: true };
    S.mode = m;
    if (S.messages.length && S.messages[0] && S.messages[0].role === 'system') S.messages[0] = { role: 'system', content: systemPrompt() };
    push({ kind: 'mode', mode: m });
    keep();
    return { ok: true, mode: m };
  }

  function answer(id, allow) {
    const p = S.pending.get(String(id)); if (!p) return { ok: false, error: 'That question is no longer open.' };
    clearTimeout(p.timer); S.pending.delete(p.id);
    push({ kind: 'answer', id: p.id, allow: !!allow, tool: p.tool, input: p.input });
    p.done(!!allow);
    return { ok: true };
  }

  /* Ctrl+C: stop what the model is doing and leave everything else standing — the conversation, the model, the folder.
     The next message goes straight on, in the same session. */
  function halt() {
    if (!S.running) return { ok: false, error: 'No session is running.' };
    const wasBusy = !!S.busy || S.pending.size > 0;
    S.stopped = true; S.busy = false; S.live = ''; S.thinking = false; S.thinkText = '';
    S.pending.forEach(p => { clearTimeout(p.timer); try { p.done(false); } catch (e) { } });
    S.pending.clear();
    try { if (S.ctl && S.ctl.req) S.ctl.req.destroy(new Error('stopped')); } catch (e) { }   // the answer on its way is dropped
    const child = S.child;                                                                  // a command it started is killed
    if (child && child.pid) { try { cp.spawnSync('taskkill', ['/PID', String(child.pid), '/T', '/F'], { stdio: 'ignore', windowsHide: true }); } catch (e) { try { child.kill(); } catch (x) { } } }
    S.child = null;
    return wasBusy ? { ok: true, kept: true } : { ok: false, error: 'Nothing is running.' };
  }

  /* the whole session ends: nothing is left running, and the next message would start afresh */
  function stop() {
    if (!S.running) return { ok: false, error: 'No session is running.' };
    const wasBusy = !!S.busy || S.pending.size > 0;
    halt();
    S.running = false; S.busy = false; S.live = ''; S.thinking = false;
    if (!wasBusy) { push({ kind: 'stopped' }); keep(); }     // a turn that is running says it itself when it lets go
    return { ok: true };
  }

  function show(rec) {
    if (S.running) stop();
    S.events = []; S.seq = 0; (rec.events || []).forEach(e => push(Object.assign({}, e)));
    Object.assign(S, { sessionId: rec.id || '', title: rec.title || '', model: rec.model || '', ctx: rec.ctx || 0, dir: rec.dir || '', guard: !!rec.guard, live: '', busy: false, messages: [] });
    loadHistory(rec.id);
    return { ok: true };
  }

  function clear() {
    if (S.running) stop();
    Object.assign(S, { events: [], sessionId: '', title: '', live: '', busy: false, messages: [], thinking: false });
    return { ok: true };
  }

  /* internet access: off until the person gives it, and it only ever reads public pages */
  function setWeb(on) {
    S.web = !!on;
    if (S.messages.length && S.messages[0] && S.messages[0].role === 'system') S.messages[0] = { role: 'system', content: systemPrompt() };
    push({ kind: 'web', on: S.web });
    keep();
    return { ok: true, web: S.web };
  }
  /* how much of the PC it may touch: this folder only, or anywhere (still guarded) */
  function setReach(whole) {
    if (!S.running) return { ok: false, error: 'Start a session first.' };
    S.guard = !!whole;
    if (S.check) S.check.guard = S.guard ? (agent.GUARD || 'whole-pc') : '';
    if (S.messages.length && S.messages[0] && S.messages[0].role === 'system') S.messages[0] = { role: 'system', content: systemPrompt() };
    push({ kind: 'reach', guard: S.guard });
    keep();
    return { ok: true, guard: S.guard };
  }

  /* the person's own switch: no question, they said so */
  const say = (level) => setAutonomy(level, 'set in the terminal', false);
  /* /think: ask the model to work out loud, and keep what it worked out so the page can show it */
  function setThink(on) { S.showThink = !!on; return { ok: true, on: S.showThink }; }
  return { start, send, answer, stop, halt, state, show, clear, setMode, setAutonomy: say, setWeb, setReach, setThink };
}

/* the model's large-memory copy in Ollama, the same first step the other harnesses take (it needs no outside program) */
function realPrepare(c) {
  return new Promise(done => {
    if (!c || c.free) return done({ ok: true });
    const ps1 = path.join(AGENT_DIR, 'start-gemma-agent.ps1');
    if (!fs.existsSync(ps1)) return done({ ok: true });
    let pr;
    try { pr = cp.spawn('powershell.exe', ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', ps1, '-Model', c.model, '-AgentModel', c.agentModel, '-Ctx', String(c.ctx), '-PrepareOnly'], { windowsHide: true, stdio: 'ignore' }); }
    catch (e) { return done({ ok: false, error: 'Could not get the model ready: ' + e.message }); }
    const k = setTimeout(() => { try { cp.spawnSync('taskkill', ['/PID', String(pr.pid), '/T', '/F'], { stdio: 'ignore', windowsHide: true }); } catch (e) { } }, 20 * 60000);
    pr.on('error', e => { clearTimeout(k); done({ ok: false, error: 'Could not get the model ready: ' + e.message }); });
    pr.on('close', code => { clearTimeout(k); done(code === 0 ? { ok: true } : { ok: false, error: 'The model could not be made ready.' }); });
  });
}

module.exports = { create, KIND, NAME, judge, TOOLS, SECRET, inside, parts, craft: { path: craftPath, run: craftRun, args: craftArgs, how: CRAFT_HOW, safe: CRAFT_SAFE } };

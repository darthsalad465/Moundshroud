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
const llama = require('./llama-runner');      // any GGUF file run straight from disk, with no Ollama copy
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

/* ---- what a model calls a tool, and what it calls the pieces of an edit ----
   Small models rarely use the names they were shown: they say read, bash, grep, str_replace, and they label the two
   halves of an edit old_string and new_string because that is what other agents' transcripts look like. A call is put
   back into the shape these tools run instead of being thrown away as an unknown tool, so one wrong word costs nothing. */
const TOOL_NAMES = TOOLS.map(t => t.function.name);
const TOOL_ALIAS = {
  read: 'read_file', readfile: 'read_file', read_text_file: 'read_file', view: 'read_file', cat: 'read_file', open: 'read_file', open_file: 'read_file',
  write: 'write_file', writefile: 'write_file', create_file: 'write_file', save_file: 'write_file', new_file: 'write_file',
  edit: 'edit_file', editfile: 'edit_file', str_replace: 'edit_file', replace_in_file: 'edit_file', patch_file: 'edit_file', apply_patch: 'edit_file', update_file: 'edit_file',
  multiedit: 'multi_edit', multi_replace: 'multi_edit', batch_edit: 'multi_edit',
  ls: 'list_files', list: 'list_files', listfiles: 'list_files', list_dir: 'list_files', listdir: 'list_files', list_directory: 'list_files',
  grep: 'search_files', search: 'search_files', searchfiles: 'search_files', search_in_files: 'search_files', ripgrep: 'search_files',
  glob: 'find_files', find: 'find_files', findfiles: 'find_files',
  bash: 'run_command', shell: 'run_command', run: 'run_command', exec: 'run_command', execute: 'run_command', command: 'run_command', runcommand: 'run_command', terminal: 'run_command', cmd: 'run_command', run_shell: 'run_command',
  stat: 'file_info', fileinfo: 'file_info', info: 'file_info', file_stat: 'file_info',
  rm: 'delete_file', delete: 'delete_file', remove: 'delete_file', remove_file: 'delete_file',
  mv: 'move_file', move: 'move_file', rename: 'move_file', movefile: 'move_file',
  mkdir: 'make_dir', mkdirp: 'make_dir', make_directory: 'make_dir', create_directory: 'make_dir',
  fetch: 'web_fetch', webfetch: 'web_fetch', http_get: 'web_fetch', read_url: 'web_fetch',
  plan: 'update_plan', updateplan: 'update_plan', todo_write: 'update_plan', todowrite: 'update_plan',
  setautonomy: 'set_autonomy', autonomy: 'set_autonomy',
};
/* the other agents' argument names, put back into the names these tools take */
const ARG_ALIAS = {
  file_path: 'path', filepath: 'path', filename: 'path', target_file: 'path', directory: 'path', folder: 'path', dir: 'path',
  old_string: 'find', old_text: 'find', old_content: 'find', find_text: 'find', search_text: 'find', target_text: 'find',
  new_string: 'replace', new_text: 'replace', new_content: 'replace', replacement: 'replace', replace_with: 'replace',
  contents: 'content', text: 'content', body: 'content', data: 'content', file_content: 'content',
  command_line: 'command', shell_command: 'command', bash_command: 'command',
  regex: 'query', glob_pattern: 'pattern_files', file_pattern: 'pattern_files',
};
const near = (a, b) => { const m = a.length, n = b.length, d = Array.from({ length: m + 1 }, (_, i) => [i]); for (let j = 1; j <= n; j++) d[0][j] = j; for (let i = 1; i <= m; i++) for (let j = 1; j <= n; j++) d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1)); return d[m][n]; };
function toolName(name) {
  const raw = String(name == null ? '' : name).trim();
  if (TOOL_NAMES.includes(raw)) return raw;
  const k = raw.toLowerCase().replace(/[\s-]+/g, '_').replace(/^functions?[._]/, '').replace(/^tools?[._]/, '');
  if (TOOL_NAMES.includes(k)) return k;
  if (TOOL_ALIAS[k]) return TOOL_ALIAS[k];
  const flat = k.replace(/_/g, '');
  if (TOOL_ALIAS[flat]) return TOOL_ALIAS[flat];
  /* one letter out (read_fil, run_comand): the closest name, when it is clearly closer than the rest */
  let best = '', at = 99;
  for (const n of TOOL_NAMES) { const x = near(k, n); if (x < at) { at = x; best = n; } }
  return at <= 2 && k.length > 4 ? best : raw;
}
function toolArgs(a) {
  const src = a && typeof a === 'object' ? a : {};
  let out = {};
  for (const k of Object.keys(src)) {
    const key = String(k), lk = key.toLowerCase();
    const want = ARG_ALIAS[lk] || (TOOL_NAMES.includes(lk) ? lk : key);
    if (want !== key && Object.prototype.hasOwnProperty.call(src, want)) continue;   // the real name is already there too
    out[want] = src[key];
  }
  /* some models put the real arguments inside a "parameters" object (llama's own shape), sometimes twice, and
     sometimes as JSON text: they are taken out, rather than answered with "No path was given" */
  for (let n = 0; n < 3; n++) {
    const p = out.parameters;
    if (p == null) break;
    let inner = p;
    if (typeof p === 'string') { try { inner = JSON.parse(p); } catch (e) { break; } }
    if (!inner || typeof inner !== 'object' || Array.isArray(inner)) break;
    if (Object.keys(out).some(k => k !== 'parameters')) break;      // real arguments sit beside it
    out = toolArgs(inner);
  }
  /* a list of changes, each written the other way round */
  if (Array.isArray(out.edits)) out.edits = out.edits.map(e => toolArgs(e));
  else if (typeof out.edits === 'string') { try { const j = JSON.parse(out.edits); if (Array.isArray(j)) out.edits = j.map(e => toolArgs(e)); } catch (e) { } }
  return out;
}

/* ---- a tool call written into the answer ----
   Some models cannot make real tool calls (llama.cpp refuses the shape they write and answers 500), so the harness
   reads a call out of the text instead: a line that starts with TOOL and then a JSON object is one call. The rest of
   the answer is still the model's own words. */
const CALL_LINE = /^\s*(?:TOOL|tool_call|CALL)\s*[:\-]?\s*(\{.*)$/;
/* a bare JSON object that names a tool is one too: llama answers with exactly that, with no word in front */
const CALL_JSON = /^\s*(\{\s*"(?:name|tool|tool_name|function)"\s*:[\s\S]*)$/;
function textCalls(text) {
  const whole = String(text == null ? '' : text).trim();
  const alone = /^\{[\s\S]*\}$/.test(whole);      // the answer is nothing but one object (llama does exactly this)
  const lines = String(text == null ? '' : text).split(/\r?\n/), calls = [], keep = [];
  for (let i = 0; i < lines.length; i++) {
    if (/^\s*```[\w-]*\s*$/.test(lines[i])) continue;          // the fence around a code block says nothing itself
    let m = CALL_LINE.exec(lines[i]), bare = false;
    if (!m) { m = CALL_JSON.exec(lines[i]); bare = true; }
    if (!m) { keep.push(lines[i]); continue; }
    /* the object may run over several lines: it is added to until it parses */
    let body = m[1], obj = null, end = i;
    for (let tries = 0; tries < 80 && !obj; tries++) {
      try { obj = JSON.parse(body); } catch (e) { if (end + 1 >= lines.length) break; end++; body += '\n' + lines[end]; }
    }
    if (!obj || typeof obj !== 'object' || Array.isArray(obj)) { keep.push(lines[i]); continue; }
    const name = toolName(obj.name || obj.tool || obj.function || obj.tool_name || '');
    /* a plain object is only a call when it names one of the tools; anything else is the model's own words */
    if (bare && (!alone || !TOOL_NAMES.includes(name))) { keep.push(lines[i]); continue; }
    const rest = Object.assign({}, obj); delete rest.name; delete rest.tool; delete rest.function; delete rest.tool_name;
    calls.push({ function: { name, arguments: toolArgs(rest) } });
    i = end;
  }
  return { calls, rest: keep.join('\n') };
}
/* ---- a very small model is not handed all sixteen tools ----
   A 1B model picks the right one badly when it has to choose from a long list, and the extra tools are the ones it
   never needs for ordinary work. The small set is the six an agent actually uses, plus the plan. */
const CORE = ['read_file', 'write_file', 'edit_file', 'list_files', 'search_files', 'run_command', 'update_plan'];
const smallModel = name => {
  const s = String(name || '').toLowerCase();
  const mb = /(\d+)\s*m(?![a-z])/.exec(s);
  if (mb) return +mb[1] <= 1500;                       // 270m, 360m, 1.5b written as 1500m
  const b = /(\d+(?:\.\d+)?)\s*b(?![a-z])/.exec(s);
  return !!b && +b[1] <= 2;                             // 1b, 1.5b, 2b
};
const toolsFor = core => core ? TOOLS.filter(t => CORE.includes(t.function.name)) : TOOLS;

/* the person asked for something done, not only for an explanation */
const ACTION = /\b(write|create|add|make|change|edit|fix|update|move|rename|delete|remove|run|prove|test|check|list|search|find|open|read|build|install|save|replace|append|insert)\b/i;
/* ...and for something changed, not only looked at */
const ASKED_CHANGE = /\b(write|create|add|make|change|edit|fix|update|move|rename|delete|remove|replace|append|insert|save)\b/i;

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
        let text = '', calls = [], buf = '', err = '', raw = '', think = '', ptok = 0;
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
            if (j.done && j.prompt_eval_count) ptok = +j.prompt_eval_count || 0;   // how much of the memory the request filled
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
          done(err ? { ok: false, error: err } : { ok: true, text, calls, think, promptTokens: ptok }); });
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
  /* ---- keeping the conversation inside the model's memory ----
     The system prompt stays first and is never dropped. The oldest messages go as whole turns (a call with all of its
     results), because Ollama refuses a request that carries a tool result whose call is gone — that used to end a long
     session with a 400 in the middle of a turn. What went is remembered in one line, in the instructions. */
  function trimHistory() {
    if (S.messages.length <= 62) return;
    const sys = S.messages[0] && S.messages[0].role === 'system' ? S.messages[0] : null;
    const body = sys ? S.messages.slice(1) : S.messages.slice();
    let cut = body.length - 60;
    if (cut <= 0) return;
    /* cut at a person's message, so the conversation starts with one and never splits a call from its results */
    while (cut < body.length && body[cut] && body[cut].role !== 'user') cut++;
    if (cut >= body.length) return;
    const gone = body.slice(0, cut), rest = body.slice(cut);
    if (!gone.length) return;
    const asked = gone.filter(m => m && m.role === 'user').length;
    S.trimNote = 'Earlier in this conversation ' + asked + ' message' + (asked === 1 ? '' : 's') + ' and the tool results they produced were dropped to keep it inside the model\'s memory; the work carries on from here.';
    S.messages = (sys ? [{ role: 'system', content: systemPrompt() + '\n\n' + S.trimNote }] : []).concat(rest);
  }

  /* ---- a fresh start before the memory fills ----
     Every request is measured: Ollama and llama.cpp report how many tokens the last one filled, and that figure tunes
     an estimate of 3.5 characters a token. Past 70% of the model's memory window, the model writes a handoff plan
     (goal, what is done, files, exact next steps, problems). The plan is saved in the working folder as
     .moundshroud\handoff-N.md, the conversation is replaced by the instructions plus that plan, and the work goes on
     from the plan's next step. A request the model refuses as too long gets the same treatment, then a retry. */
  const HANDOFF_AT = 0.7, MAX_HANDOFFS = 8;
  const TOO_LONG = /exceed|too long|too large|too many tokens|overflow|maximum context|context length|context size|context window|n_ctx|truncat|kv cache/i;
  const memWindow = () => Math.max(2048, +S.ctx || +(S.check && S.check.ctx) || 32768);
  function estTokens(msgs, tools) {
    let ch = tools ? JSON.stringify(tools).length : 0;
    for (const m of msgs || []) { if (!m) continue; ch += String(m.content || '').length + 16; if (m.tool_calls) ch += JSON.stringify(m.tool_calls).length; }
    return Math.ceil(ch / 3.5);
  }
  /* how full the memory is with this conversation and these tools, and how much of that the conversation itself is */
  function memUse(tools) {
    const k = S.tokRatio || 1, win = memWindow();
    const all = Math.round(estTokens(S.messages, tools) * k);
    const body = Math.round(estTokens(S.messages.filter(m => m && m.role !== 'system'), null) * k);
    return { all, body, win, pct: Math.round(100 * all / win) };
  }
  /* a fresh start only helps when the conversation is a real part of the load: the instructions alone are never cut */
  function needHandoff(tools) {
    const u = memUse(tools);
    /* 70% of the window, or more when the window is small: up to what is left after the answer's own room */
    const at = Math.max(u.win * HANDOFF_AT, Math.min(u.win * 0.8, u.win - Math.min(4096, Math.floor(u.win / 8)) - 768));
    return u.all > at && u.body > u.win * 0.2 ? u : null;
  }
  /* the cheap step first: old tool results (all but the newest four) are cut to their first lines, since the model can
     read a file or run a command again. Only when that is not enough does the model write a plan and start fresh. */
  function shrinkOld() {
    let saved = 0, seen = 0;
    for (let i = S.messages.length - 1; i >= 0; i--) {
      const m = S.messages[i];
      if (!m || m.role !== 'tool') continue;
      if (++seen <= 3) continue;
      const c = String(m.content || '');
      if (c.length <= 700 || /\[cut to save memory/.test(c)) continue;
      const short = c.slice(0, 400) + '\n[cut to save memory: ' + (c.length - 400) + ' more characters. Read it again if you need it.]';
      saved += c.length - short.length;
      S.messages[i] = Object.assign({}, m, { content: short });
    }
    return Math.round(saved / 3.5);
  }
  const HANDOFF_SYS ='You are handing your unfinished work to a fresh copy of yourself whose memory is empty. It will see only what you write now, plus the files on disk. ' +
    'Write a detailed handoff plan in plain text under these five headings, and nothing else:\n' +
    'GOAL: what the person wants, in full, with every exact requirement (names, paths, formats, numbers).\n' +
    'DONE: what is finished, and how it was checked.\n' +
    'FILES: every file made or changed, with its full path written out (never shortened with ...), and what is in it now.\n' +
    'NEXT: numbered exact next steps, starting with the very next action.\n' +
    'PROBLEMS: errors seen, what failed and why, and what to avoid.\n' +
    'Do not call tools. Do not start the work.';
  /* the work so far, newest kept first, cut to fit: what the plan is written from */
  function workLog(budgetTokens) {
    const out = [];
    let room = Math.max(2000, budgetTokens * 3.5);
    for (let i = S.messages.length - 1; i >= 0 && room > 0; i--) {
      const m = S.messages[i]; if (!m || m.role === 'system') continue;
      let line = '';
      if (m.role === 'user') line = 'PERSON: ' + cut(String(m.content || ''), 1500);
      else if (m.role === 'tool') line = 'RESULT of ' + (m.tool_name || 'tool') + ': ' + cut(String(m.content || ''), 500);
      else {
        const said = String(m.content || '').trim();
        const calls = (m.tool_calls || []).map(c => 'CALLED ' + ((c.function && c.function.name) || '?') + ' ' + cut(JSON.stringify((c.function && c.function.arguments) || {}), 300));
        line = (said ? 'YOU SAID: ' + cut(said, 800) + (calls.length ? '\n' : '') : '') + calls.join('\n');
      }
      if (!line) continue;
      room -= line.length;
      out.push(line);
    }
    return out.reverse().join('\n');
  }
  function fallbackPlan(goal) {
    const steps = (S.plan || []).map((s, i) => (i + 1) + '. ' + (s.done ? '[done] ' : '') + s.text).join('\n');
    return 'GOAL: ' + goal + '\n' +
      'DONE: the steps marked done below' + (steps ? '' : ' (no plan was written)') + '.\n' + (steps ? steps + '\n' : '') +
      'FILES: ' + ((S.touched || []).join(', ') || 'none changed yet') + '\n' +
      'NEXT:\n1. Read the files above and see what is left of the goal.\n2. Finish the goal, then check it works.\n' +
      'PROBLEMS: none recorded.';
  }
  async function handoff(goal, why) {
    S.handoffN = (S.handoffN || 0) + 1;
    const n = S.handoffN;
    push({ kind: 'note', text: why + ': writing a handoff plan, then starting fresh' });
    const win = memWindow();
    const info = 'The person asked: ' + goal + '\n' +
      (S.plan && S.plan.length ? 'Your plan so far:\n' + S.plan.map((s, i) => (i + 1) + '. ' + (s.done ? '[done] ' : '') + s.text).join('\n') + '\n' : '') +
      'Files you changed: ' + ((S.touched || []).join(', ') || 'none yet') + '\n\nYOUR WORK SO FAR (oldest first):\n' + workLog(Math.floor(win * 0.4)) +
      '\n\nNow write the handoff plan.';
    let plan = '';
    const ask = d.ask || defaultAsk;
    S.thinking = true; S.live = '';
    try {
      const r = await ask([{ role: 'system', content: HANDOFF_SYS }, { role: 'user', content: info }], null, S,
        t => { S.thinking = false; S.live = cut(t, MAX_TEXT); }, () => { });
      if (r && r.ok) plan = String(r.text || '').trim();
    } catch (e) { }
    S.thinking = false; S.live = '';
    if (plan.length < 40) plan = fallbackPlan(goal);
    /* the exact paths go in as well: a model's own notes tend to shorten them */
    if ((S.touched || []).length) plan += '\n\nFILES CHANGED (exact paths, inside ' + (S.dir || 'the working folder') + '):\n' +
      S.touched.map(p => '- ' + (S.dir && path.isAbsolute(p) && p.toLowerCase().startsWith(S.dir.toLowerCase() + path.sep) ? p.slice(S.dir.length + 1) : p)).join('\n');
    plan = cut(plan, Math.max(4000, Math.floor(win * 0.25 * 3.5)));
    let saved = '';
    if (S.dir) {
      try {
        const f = path.join(S.dir, '.moundshroud', 'handoff-' + n + '.md');
        fs.mkdirSync(path.dirname(f), { recursive: true });
        fs.writeFileSync(f, '# Handoff ' + n + ' (' + new Date().toISOString() + ')\n\nThe person asked: ' + goal + '\n\n' + plan + '\n');
        saved = path.join('.moundshroud', 'handoff-' + n + '.md');
      } catch (e) { }
    }
    S.messages = [{ role: 'system', content: systemPrompt() }, { role: 'user', content:
      '[Fresh start ' + n + ': your memory was nearly full, so the earlier conversation was replaced by the handoff plan you wrote. ' +
      'The files on disk are as you left them. Do not re-read every file: read only the one the next step needs, just before you change it. Use paths relative to the working folder, such as test.js. Do not redo finished steps; carry on from NEXT step 1 until the goal is done.]\n\n' +
      'The person asked: ' + goal + '\n\nHANDOFF PLAN\n' + plan }];
    S.tokRatio = S.tokRatio || 1;
    push({ kind: 'note', text: 'fresh start ' + n + ': the work carries on from the plan' + (saved ? ' (saved in ' + saved + ')' : '') });
    keep();
    return plan;
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
  /* a file name that is almost right ("bign.js" for "big.js") gets the names that are there, closest first */
  function nearName(full) {
    let names; try { names = fs.readdirSync(path.dirname(full)); } catch (e) { return ''; }
    const want = path.basename(full).toLowerCase();
    const dist = (a, b) => { const m = a.length, n = b.length, d = Array.from({ length: m + 1 }, (_, i) => [i]); for (let j = 1; j <= n; j++) d[0][j] = j; for (let i = 1; i <= m; i++) for (let j = 1; j <= n; j++) d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1)); return d[m][n]; };
    const close = names.map(nm => ({ nm, d: dist(nm.toLowerCase(), want) })).filter(x => x.d <= Math.max(2, Math.floor(want.length / 3))).sort((a, b) => a.d - b.d).slice(0, 3).map(x => x.nm);
    return close.length ? ' Did you mean ' + close.join(' or ') + '? (It is in ' + path.dirname(full) + '.)' : (names.length && names.length <= 30 ? ' That folder has: ' + names.join(', ') + '.' : '');
  }
  function readFile(a) {
    const w = place(a.path); if (!w.ok) return w;
    let st; try { st = fs.statSync(w.full); } catch (e) { return { ok: false, error: 'There is no file at ' + w.full + '.' + nearName(w.full) }; }
    if (st.isDirectory()) return { ok: false, error: w.full + ' is a folder. Use list_files.' };
    if (!S.guard && SECRET.test(w.full)) return { ok: false, error: 'That file holds a password or key. Turn on "Whole PC, guarded" if you really mean to read it.' };
    if (st.size > 2e6) return { ok: false, error: 'That file is too big to read at once (' + Math.round(st.size / 1048576) + ' MB).' };
    let text; try { text = fs.readFileSync(w.full, 'utf8'); } catch (e) { return { ok: false, error: 'That file could not be read: ' + e.message }; }
    if (text.indexOf('\0') >= 0) return { ok: false, error: 'That is a binary file, so it cannot be read as text.' };
    S.lastFile = w.full;
    const lines = text.split(/\r?\n/), off = Math.max(1, +a.offset || 1), lim = Math.min(2000, +a.limit || 2000);
    const take = lines.slice(off - 1, off - 1 + lim);
    const head = off > 1 ? '(from line ' + off + ') ' : '';
    return { ok: true, text: cut(head + take.join('\n') + (off - 1 + lim < lines.length ? '\n... (' + (lines.length - off + 1 - lim) + ' more lines)' : ''), READ_CAP) };
  }
  function writeFile(a) {
    const w = place(a.path, true); if (!w.ok) return w;
    try { fs.mkdirSync(path.dirname(w.full), { recursive: true }); fs.writeFileSync(w.full, String(a.content == null ? '' : a.content)); }
    catch (e) { return { ok: false, error: 'That file could not be written: ' + e.message }; }
    S.lastFile = w.full;
    return { ok: true, text: 'Wrote ' + w.full + ' (' + String(a.content || '').split(/\r?\n/).length + ' lines).' };
  }
  /* Finds one piece of text in a file: exactly, or else with its spacing loosened. Small models often copy a block with
     different indentation or line breaks (one space where the file has two); the words and symbols still have to match
     in order, and only a single match counts. Returns { count, start, end, loose }. */
  function locate(text, find) {
    const exact = text.split(find).length - 1;
    if (exact) { const i = text.indexOf(find); return { count: exact, start: i, end: i + find.length, loose: false }; }
    const parts = find.trim().split(/\s+/).filter(Boolean);
    if (!parts.length || parts.join('').length < 3) return { count: 0 };
    const re = new RegExp(parts.map(p => p.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('\\s+'), 'g');
    const hits = [...text.matchAll(re)];
    if (hits.length !== 1) return { count: hits.length };
    return { count: 1, start: hits[0].index, end: hits[0].index + hits[0][0].length, loose: true };
  }
  /* a loosened match leaves out the spaces and line breaks around the found text, so the new text drops the same ones */
  /* the lines that share the most words with the piece that was asked for: a model that copied it slightly wrong sees
     the real thing and can try again, instead of being told only that it was not there */
  function nearText(text, find) {
    const words = new Set(String(find || '').toLowerCase().match(/[a-z0-9_$]{2,}/g) || []);
    if (!words.size) return '';
    const lines = String(text).split(/\r?\n/);
    let best = -1, score = 0;
    for (let i = 0; i < lines.length; i++) {
      const l = lines[i].toLowerCase();
      let hit = 0; for (const w of words) if (l.includes(w)) hit++;
      if (hit > score) { score = hit; best = i; }
    }
    if (best < 0 || score < Math.min(3, Math.max(1, Math.ceil(words.size / 2)))) return '';
    const from = Math.max(0, best - 2), to = Math.min(lines.length, best + 3);
    return ' The closest lines in the file are (lines ' + (from + 1) + '-' + to + '):\n' + lines.slice(from, to).join('\n') + '\n';
  }
  function trimLike(find, rep) {
    const lead = (find.match(/^\s*/) || [''])[0], trail = (find.match(/\s*$/) || [''])[0];
    let r = rep;
    if (lead && r.startsWith(lead)) r = r.slice(lead.length);
    if (trail && r.endsWith(trail)) r = r.slice(0, r.length - trail.length);
    return r;
  }
  function editFile(a) {
    const w = place(a.path, true); if (!w.ok) return w;
    let text; try { text = fs.readFileSync(w.full, 'utf8'); } catch (e) { return { ok: false, error: 'There is no file at ' + w.full + '.' + nearName(w.full) + ' Use write_file to make a new one.' }; }
    const find = String(a.find == null ? '' : a.find), rep = String(a.replace == null ? '' : a.replace);
    if (!find) return { ok: false, error: 'Nothing to find was given.' };
    if (find === rep) return { ok: false, error: 'That edit changes nothing: the new text is the same as the old. Say what should be different.' };
    const at = locate(text, find);
    if (!at.count) return { ok: false, error: 'That text is not in the file.' + nearText(text, find) + ' Read the file again and copy the exact lines, or rewrite the whole file with write_file.' };
    if (at.count > 1) return { ok: false, error: 'That text appears ' + at.count + ' times. Include a line before and after it so it is unique.' };
    const out = text.slice(0, at.start) + (at.loose ? trimLike(find, rep) : rep) + text.slice(at.end);
    try { fs.writeFileSync(w.full, out); } catch (e) { return { ok: false, error: 'That file could not be written: ' + e.message }; }
    S.lastFile = w.full;
    return { ok: true, text: 'Changed ' + w.full + '.' + (at.loose ? ' (Your copy of the old text had different spacing; the one place it matched was changed.)' : '') };
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
    /* "*.js" is a file-name pattern, not text to look for: list the files it names instead of saying nothing matched */
    if (/^\*?\.?[\w*?.-]*$/.test(pat) && /[*?]/.test(pat) && !a.pattern_files) {
      const r = listFiles({ path: a.path, pattern: pat });
      return r.ok ? { ok: true, text: '"' + pat + '" is a file-name pattern, so these are the files it names (search_files looks for text inside files):\n' + r.text } : r;
    }
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
    let text; try { text = fs.readFileSync(w.full, 'utf8'); } catch (e) { return { ok: false, error: 'There is no file at ' + w.full + '.' + nearName(w.full) }; }
    /* some models send the list as JSON text instead of a list */
    let edits = a.edits;
    if (typeof edits === 'string') { try { edits = JSON.parse(edits); } catch (e) { edits = []; } }
    const list = Array.isArray(edits) ? edits.slice(0, 40) : [];
    if (!list.length) return { ok: false, error: 'No changes were given.' };
    let out = text, n = 0, loose = 0;
    for (const e of list) {
      const find = String((e && e.find) == null ? '' : e.find), rep = String((e && e.replace) == null ? '' : e.replace);
      if (!find) return { ok: false, error: 'One of the changes has nothing to find, so nothing was written.' };
      if (find === rep) continue;                                      // a change that changes nothing is skipped
      const at = locate(out, find);
      if (at.count !== 1) return { ok: false, error: 'Nothing was written: one change\'s text appears ' + at.count + ' times, and it has to appear exactly once — ' + find.slice(0, 90) + (at.count ? '' : nearText(out, find)) };
      out = out.slice(0, at.start) + (at.loose ? trimLike(find, rep) : rep) + out.slice(at.end); n++; if (at.loose) loose++;
    }
    if (!n) return { ok: false, error: 'Those changes change nothing: every new text is the same as the old.' };
    try { fs.writeFileSync(w.full, out); } catch (e) { return { ok: false, error: 'That file could not be written: ' + e.message }; }
    S.lastFile = w.full;
    return { ok: true, text: 'Changed ' + n + ' place' + (n === 1 ? '' : 's') + ' in ' + w.full + '.' + (loose ? ' (' + loose + ' matched with different spacing.)' : '') };
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
    if (hits.length) return { ok: true, text: cut(hits.join('\n'), OUT_CAP) };
    const pat = String(a.pattern || '*');
    /* a plain word is not a file name: a model that says find TODO almost always means "find it in the files", so it
       is looked for inside them instead of answering that nothing is named that */
    if (/^[\w .-]+$/.test(pat)) {
      const inside = searchFiles({ pattern: pat, path: base.full });
      if (inside.ok && !/^No file in that folder contains that\.$/.test(inside.text)) return { ok: true, text: 'No file is named "' + pat + '", but these files contain it:\n' + inside.text };
      return { ok: true, text: 'No file is named "' + pat + '", and no file there contains it either.' };
    }
    return { ok: true, text: 'No file matches ' + pat + ' there. (find_files looks at file names; search_files looks inside files.)' };
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
        /* the command goes to cmd.exe exactly as it was written: Node would put a second pair of quotes around it, and
           `node -e "console.log(1)"` then reached node with no script at all (it used to answer "no output") */
        try { child = d.run ? d.run(command, S.dir) : cp.spawn('cmd.exe', ['/d', '/c', command], { cwd: S.dir || process.cwd(), windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'], windowsVerbatimArguments: true }); }
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
    const name = toolName(fn.name);                 // read, bash, str_replace and one-letter slips are understood
    let args = fn.arguments;
    if (typeof args === 'string') { try { args = JSON.parse(args || '{}'); } catch (e) { args = {}; } }
    args = toolArgs(args && typeof args === 'object' ? args : {});   // old_string/new_string/file_path are put right too
    const toolId = id;
    /* a model that names no file right after reading or writing one means that file: it is used, and the result says so */
    let guessed = '';
    if (!String(args.path || '').trim() && S.lastFile && /^(read_file|edit_file|multi_edit|file_info)$/.test(name)) { args.path = S.lastFile; guessed = S.lastFile; }
    S.lastGuess = guessed;
    /* a path shortened with "..." (C:\...\proj\a.js), as a model writes one in its notes, means a file in the working
       folder: the part after the dots is used, without the folder's own name if it was kept */
    for (const k of ['path', 'from', 'to']) {
      const p = String(args[k] || '');
      if (!S.dir || !/(^|[\\/])(\.\.\.|…)[\\/]/.test(p)) continue;
      let rest = p.replace(/^.*(^|[\\/])(\.\.\.|…)[\\/]/, '');
      const own = path.basename(S.dir).toLowerCase();
      if (rest.toLowerCase().startsWith(own + '\\') || rest.toLowerCase().startsWith(own + '/')) rest = rest.slice(own.length + 1);
      args[k] = rest;
    }
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
    /* the first code-mode turn of a session that opened in chat makes the agent's copy of the model first */
    if (S.mode !== 'chat' && !S.copyReady && S.check && !S.check.free && !S.check.direct) {
      S.preparing = true; push({ kind: 'note', text: 'getting ' + (S.check.model || 'the model') + ' ready to work (the first time takes about a minute)' });
      let r; try { r = d.prepare ? await d.prepare(S.check) : await realPrepare(S.check); } catch (e) { r = { ok: false, error: String(e.message || e) }; }
      S.preparing = false;
      if (!r || !r.ok) { S.busy = false; push({ kind: 'error', text: (r && r.error) || 'The model could not be made ready.' }); keep(); return; }
      S.copyReady = true;
    }
    let bad = '', emptyTries = 0, plain = false, nudged = 0, used = 0, changed = 0, stuck = 0, stopTurn = false;
    const fails = new Map();                              // tool call -> how many times it failed in this turn
    const ran = new Map();                                // tool call -> how many times the same thing already worked
    /* what the person wants: a short "continue" keeps the request it continues */
    if (!S.goal || !/^\s*(continue|go on|keep going|carry on|resume|go|proceed|next)\b[\s\S]{0,40}$/i.test(String(text || ''))) S.goal = String(text || '');
    const goal = cut(S.goal, 4000);
    /* a long job is not cut off at 24 answers: while the model is still working, it gets another 24, up to 8 times */
    let budget = MAX_STEPS, rounds = 0, handoffs = 0, lastHandoff = -9, chatCut = false;
    for (let step = 0; ; step++) {
      if (dead()) break;
      if (step >= budget) {
        if (rounds >= 7) { bad = 'Stopped after ' + step + ' steps to check in with you. Say continue and the work picks up where it is.'; break; }
        rounds++; budget += MAX_STEPS;
        push({ kind: 'note', text: step + ' steps so far: still working' });
      }
      S.thinking = true; S.live = '';
      const ask = d.ask || defaultAsk;
      /* chat mode works like Ollama's own chat: no tools are offered, and the model sees only the plain conversation */
      const chat = S.mode === 'chat';
      const tools = plain || chat ? null : toolsFor(S.core);
      /* the memory is nearly full: the model writes its plan down and starts fresh from it, before anything is lost */
      if (!chat && handoffs < MAX_HANDOFFS && step - lastHandoff >= 2) {
        let u = needHandoff(tools);
        if (u) {
          const freed = shrinkOld();
          if (freed > 0 && !needHandoff(tools)) { push({ kind: 'note', text: 'memory ' + u.pct + '% full: old tool results were cut to their first lines (' + freed + ' tokens freed)' }); u = null; }
        }
        if (u) {
          await handoff(goal, 'memory ' + u.pct + '% full (' + u.all + ' of ' + u.win + ' tokens)');
          handoffs++; lastHandoff = step; ran.clear();
          if (dead()) break;
          S.thinking = true; S.live = '';
        }
      }
      /* the last try is made without tools and with a short nudge, so a model that got lost in the tool result still answers */
      const convo = chat ? chatView(S.messages) : plain ? S.messages.concat([{ role: 'user', content: 'Continue from the tool result above. Do not call another tool: answer me in one or two plain sentences.' }]) : S.messages;
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
      /* the model refused the request as too long for its memory: code mode hands off and goes on from the plan; chat
         keeps the newest messages and asks again, once */
      if ((!r || !r.ok) && TOO_LONG.test(String((r && r.error) || ''))) {
        if (!chat && handoffs < MAX_HANDOFFS) {
          await handoff(goal, 'the model\'s memory was full');
          handoffs++; lastHandoff = step; ran.clear();
          if (dead()) break;
          continue;
        }
        if (chat && !chatCut) {
          chatCut = true;
          const sys = S.messages[0] && S.messages[0].role === 'system' ? [S.messages[0]] : [];
          const rest = S.messages.filter(m => m && m.role !== 'system' && m.role !== 'tool');
          S.messages = sys.concat(rest.slice(-6));
          push({ kind: 'note', text: 'the model\'s memory was full, so only the latest messages were kept' });
          continue;
        }
      }
      if (!r || !r.ok) { bad = (r && r.error) || 'The model did not answer.'; break; }
      /* how many tokens the request really filled tunes the estimate used to see the memory filling */
      if (r.promptTokens > 0) { const e = estTokens(convo, tools); if (e > 200) S.tokRatio = Math.max(0.4, Math.min(3, r.promptTokens / e)); }
      /* a model that cannot make tool calls the usual way writes one into its answer ("TOOL {...}"): it is read out
         of the text here, so the job still gets done, and the line itself is not shown as something the model said */
      const written = !chat ? textCalls(String(r.text || '')) : { calls: [], rest: String(r.text || '') };
      const say = written.rest.trim();
      /* a tool call that turns up in chat mode is never run: chat changes nothing */
      let calls = !chat && Array.isArray(r.calls) ? r.calls.slice(0, 8) : [];
      if (!calls.length && written.calls.length) calls = written.calls.slice(0, 8);
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
      if (!msg.tool_calls || !msg.tool_calls.length) {
        /* the person asked for something done and the model only talked about it: it is asked once more, with the
           tools still in its hand, so a small model's chatty first answer does not end a turn untouched */
        const asked = !used ? ACTION.test(text) : (ASKED_CHANGE.test(text) && !changed);
        if (asked && nudged < 2 && !plain && S.mode !== 'chat') {
          nudged++; emptyTries = 0;
          const where = !used ? 'Use a tool now' : 'You have not changed any file yet, and this job asks for a change. Make it now with a tool';
          S.messages.push({ role: 'user', content: S.toolText
            ? '[' + where + ': start a line with TOOL and the arguments as JSON. Do not only describe it.]'
            : '[' + where + ' — do not only describe it. Each result comes back to you, then you can go on.]' });
          continue;
        }
        break;
      }
      for (const call of msg.tool_calls) {
        if (dead()) break;
        const id = 'n' + crypto.randomBytes(4).toString('hex');
        /* the same call that already failed twice is not run a third time: the model is told to change its approach */
        const fn = call.function || {}, sig = String(fn.name || '') + ' ' + JSON.stringify(fn.arguments || {});
        let res;
        if ((fails.get(sig) || 0) >= 2) {
          push({ kind: 'tool', toolId: id, name: String(fn.name || ''), input: small(argObj(fn.arguments)) });
          res = { ok: false, error: 'This exact call has already failed twice, so it was not run again. Do something different: read the file again, change a smaller piece of text, or rewrite the whole file with write_file.' };
          stuck++;
        } else if ((ran.get(sig) || 0) >= 3) {
          push({ kind: 'tool', toolId: id, name: String(fn.name || ''), input: small(argObj(fn.arguments)) });
          res = { ok: false, error: 'This exact call has already worked three times in this turn, so it was not run again. Use the result you already have, or do something different.' };
          stuck++;
        } else {
          used++;
          try { res = await runTool(call, id); } catch (e) { res = { ok: false, error: 'That tool failed: ' + e.message }; }
          if (res && res.ok) {
            ran.set(sig, (ran.get(sig) || 0) + 1);
            if (/^(write_file|edit_file|multi_edit|delete_file|move_file|make_dir)$/.test(toolName(fn.name))) {
              changed++;
              /* the files changed are listed in a handoff plan, so a fresh start knows where its work is */
              const a = argObj(fn.arguments); S.touched = S.touched || [];
              for (const p of [a.path, a.to]) if (p && !S.touched.includes(String(p))) S.touched.push(String(p));
              if (S.touched.length > 60) S.touched.splice(0, S.touched.length - 60);
            }
          }
          if (res && res.ok && S.lastGuess) res.text = String(res.text || '') + ' (No path was given, so the file used last was used: ' + S.lastGuess + '.)';
        }
        S.lastGuess = '';
        if (!res || !res.ok) fails.set(sig, (fails.get(sig) || 0) + 1);
        /* a command that failed carries its output (the error message) in text and its exit code in code: both go back
           to the model, which cannot fix what it cannot see */
        const body = res.ok ? (res.text || '(done)')
          : ('FAILED' + (res.code != null ? ' (exit code ' + res.code + ')' : '') + ': ' + (res.error || '') + (res.error && res.text ? '\n' : '') + (res.text || (res.error ? '' : 'no output')));
        push({ kind: 'result', toolId: id, text: cut(body, OUT_CAP), isError: !res.ok });
        S.messages.push({ role: 'tool', tool_call_id: call.id, tool_name: call.function && call.function.name, content: body });
        /* a model that keeps asking for the same thing does not get the whole step budget to keep at it: the turn
           ends with a plain reason, instead of burning twenty-four answers that all say the same */
        if (stuck >= 3) { stopTurn = true; bad = 'The model kept asking for the same thing, so the turn was ended. Say what you want done in different words, or pick a larger model with /model.'; break; }
      }
      if (stopTurn) break;
      trimHistory();
      if (dead()) break;
    }
    if (me !== S.turnId) return;                       // a newer turn has taken over: this one says nothing more
    S.busy = false; S.live = ''; S.thinking = false;
    if (S.stopped) push({ kind: 'stopped' });
    else push(bad ? { kind: 'error', text: cut(bad, 600) } : { kind: 'done', ok: true, text: '' });
    keep();
  }

  /* What a chat-mode request carries: the plain conversation, as Ollama's own chat would send it. The tool calls and tool
     results from code mode are left out (a model shown them tends to answer with another call), and so is the agent's
     long system prompt, which names every tool. An assistant turn that was only a tool call says nothing, so it goes too. */
  function chatView(msgs) {
    const out = [{ role: 'system', content: chatSystem() }];
    for (const m of msgs || []) {
      if (!m || m.role === 'system' || m.role === 'tool') continue;
      const content = String(m.content || '');
      if (m.role === 'assistant' && !content.trim()) continue;
      const one = { role: m.role === 'assistant' ? 'assistant' : 'user', content };
      if (m.images) one.images = m.images;
      out.push(one);
    }
    return out;
  }
  function chatSystem() {
    return 'You are ' + NAME + ', a helpful assistant on the person\'s own PC. This is a plain conversation: answer directly and clearly, in your own words. ' +
      'You cannot open, run or change anything from here, so never claim you did. If they want something done to their files, they can switch to code mode with /code.';
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
    /* chat mode talks to the model itself, as Ollama's chat does: not the agent's large-memory copy, and with Ollama's own
       settings for length and memory; code mode uses the agent copy with a steadier temperature */
    const chat = S2 && S2.mode === 'chat';
    const body = chat
      ? { model: c.free ? (c.agentModel || c.model) : (c.model || c.agentModel), stream: true, think: !!(S2 && S2.showThink), keep_alive: '5m', messages, options: { temperature: 0.7 } }
      : { model: c.agentModel || c.model, stream: true, think: !!(S2 && S2.showThink), keep_alive: '5m', messages, options: { temperature: 0.2, num_predict: Math.min(4096, Math.floor((c.ctx || 32768) / 8)) } };
    if (Array.isArray(tools) && tools.length && !(S2 && S2.toolText)) body.tools = tools;   // chat mode, and a model that writes its calls, send none
    /* a model file run directly: llama.cpp's own server, started on that file the first time it is asked */
    if (c.direct) {
      const up = await llama.start(c.file, { ctx: c.ctx });
      if (!up.ok) { S.ctl = null; return up; }
      if (up.note) push({ kind: 'note', text: up.note });
      const rd = await llama.chat(body, onText, onThink, ctl);
      S.ctl = null;
      return rd;
    }
    let r = await post(host, port, body, onText, ctl, onThink);
    /* some templates refuse two tool calls in one answer (Llama 3.2 says so outright): the model is told to ask for
       one at a time and the same request is made again, once */
    if (!r.ok && !chat && S2 && /single tool-call|one tool call|one tool at a time/i.test(String(r.error || ''))) {
      S2.oneAtATime = true;
      if (S.messages[0] && S.messages[0].role === 'system') S.messages[0] = { role: 'system', content: systemPrompt() };
      r = await post(host, port, Object.assign({}, body, { messages: messages.concat([{ role: 'user', content: '[Ask for one tool call only, then wait for its result.]' }]) }), onText, ctl, onThink);
    }
    /* llama.cpp sometimes cannot read the tool call a small model wrote and answers 500 instead of the model's own
       words. That is not the end of the turn: the tools come out of the request and the model is asked to write its
       call in its answer instead (textCalls reads it), for the rest of the session. */
    if (!r.ok && !chat && S2 && !S2.toolText && Array.isArray(body.tools) && body.tools.length && /peg-native|does not match|failed to parse|invalid tool|unable to generate parser|raise_exception|single tool-call|code:500|status code 500|\b500\b/i.test(String(r.error || ''))) {
      S2.toolText = true;
      if (S.messages[0] && S.messages[0].role === 'system') S.messages[0] = { role: 'system', content: systemPrompt() };
      const plainBody = Object.assign({}, body, { messages, options: Object.assign({}, body.options, { temperature: 0.1 }) });
      delete plainBody.tools;
      push({ kind: 'note', text: 'this model cannot write a tool call the usual way, so they are read from its answer instead' });
      r = await post(host, port, plainBody, onText, ctl, onThink);
    }
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
    /* this model cannot take tool calls the usual way, so it is asked to write one; textCalls reads it back */
    const one = S.mode === 'chat' || !S.oneAtATime ? '' : 'Ask for only one tool call in each answer: this model refuses two at once.\n';
    const ask = S.mode === 'chat' || !S.toolText ? '' : 'This model cannot take tool calls the usual way, so ask for one in your answer instead: start a line with TOOL, then the arguments as JSON, and nothing else on that line. For example:\n' +
      'TOOL {"name": "read_file", "path": "src/app.js"}\n' +
      'TOOL {"name": "write_file", "path": "notes.txt", "content": "hello"}\n' +
      'TOOL {"name": "edit_file", "path": "a.js", "find": "return a - b;", "replace": "return a + b;"}\n' +
      'TOOL {"name": "run_command", "command": "node add.js"}\n' +
      'One TOOL line per answer: its result comes back to you, then you ask for the next thing. Use only the tool names you were given.\n';
    return 'You are ' + NAME + ', the coding agent built into Moundshroud, working on the person\'s own Windows PC. You work in this folder: ' + (S.dir || '(none)') + '.\n' +
      (S.guard ? 'You may read files anywhere on this PC, but Windows, the programs folders, Moundshroud itself and the browser and key folders are shut to writing.\n' : 'You may only read and write inside that folder. A command that names a path outside it is refused.\n') +
      how +
      one +
      ask +
      'You have these tools: ' + toolsFor(S.core).map(t => t.function.name).join(', ') + '.\n' +
      (S.core ? '' : 'craft_anything drives Craft Anything, an outside engine for seeing how a website, app or game works and building your own version of it. Its workflow commands are commands (list all 320 tools), capabilities, doctor, triage, report, chat and rebuild; every single tool is also a subcommand, named like core-session-show or web-site-capture, and `craft_anything` with just that name and its arguments runs it. Add --project <folder> to keep evidence in a project folder, and --deep only when the person has said the target is theirs to look inside. If it is not installed it says how to get it; do not pretend you ran it.\n') +
      'How often you are asked first is set by the person: ' + S.autonomy + ' (careful = before every change, normal = before commands that change the PC, auto = only when something is forbidden). Do not try to get around a question that was refused. If they ask you to ask less, call set_autonomy.\n' +
      'For anything longer than two steps, call update_plan with the steps first, and send the whole list again with the finished numbers as you go.\n' +
      'The person can attach a picture to a message. It is saved in the working folder under .moundshroud\\refs and the message says where. ' + (S.check && S.check.vision ? 'This model can see pictures: the picture itself is in that message, so look at it before you answer.' : 'This model cannot see pictures, so you may use the file (copy or link it) but you cannot look at it.') + '\n' +
      'Internet access is ' + (S.web ? 'on: you may read public pages and APIs with web_fetch.' : 'off: web_fetch will refuse, so ask the person to turn it on with /net on in the terminal if you really need a page.') + '\n' +
      'Reply in short, plain sentences. One step at a time. When you have made a change, check it (for example node --check on a .js file, or run the thing you built) and only then say it works. Never claim something works if you did not run it.\n' +
      'Windows commands: use dir, type, findstr, copy, move. Paths use backslashes.\n' +
      'A greeting, thanks, or a question you can answer from what you know needs no tools: just answer it. Use tools only when the task needs the files or the PC.\n' +
      'When the person asks for something in a file, write that file: an answer in the chat does not count. When they give an exact output format, print exactly that and nothing more.\n' +
      'For JavaScript run with node, use require and module.exports with relative paths such as ./lib/math, unless package.json says "type": "module".\n\n' + pb;
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
    /* a session that opens in chat mode talks to the model itself, so the copy is made only when /code first needs it */
    let r = { ok: true };
    const needCopy = !c.chat && !c.direct && o.mode !== 'chat';
    if (needCopy) { try { r = d.prepare ? await d.prepare(c) : await realPrepare(c); } catch (e) { r = { ok: false, error: String(e.message || e) }; } }
    S.copyReady = needCopy || !!c.chat;
    S.preparing = false;
    if (!r || !r.ok) return { ok: false, error: (r && r.error) || 'The model could not be made ready.' };
    const resume = /^session_[A-Za-z0-9_]{4,120}$/.test(String(o.resume || '')) ? String(o.resume) : '';
    const kept = !!o.keep && !!S.sessionId;        // a new model on the same conversation
    if (!resume && !kept) { S.events = []; S.sessionId = ''; S.title = ''; }
    if (!resume) { S.events = []; S.seq = 0; }
    S.sessionId = resume || (kept ? S.sessionId : '') || ('session_mc_' + crypto.randomBytes(8).toString('hex'));
    /* what the last model needed (calls written in its answer, one at a time) is not forced on a different model */
    if (c.model !== S.model) { S.toolText = false; S.oneAtATime = false; S.tokRatio = 0; }
    S.core = smallModel(c.model);                    // a 1B model gets the six tools it can handle, not sixteen
    Object.assign(S, { running: true, busy: false, stopped: false, live: '', thinking: false, model: c.model, ctx: c.ctx, dir: o.dir || '', guard: !!c.guard, mode: o.mode === 'chat' ? 'chat' : 'code', check: c, pending: new Map(), child: null });
    if (resume) loadHistory(resume); else if (!kept) { S.messages = []; S.touched = []; S.goal = ''; S.handoffN = 0; }
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
    trimHistory();
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

module.exports = { create, KIND, NAME, judge, TOOLS, SECRET, inside, parts, toolName, toolArgs, textCalls, craft: { path: craftPath, run: craftRun, args: craftArgs, how: CRAFT_HOW, safe: CRAFT_SAFE } };

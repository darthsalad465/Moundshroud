// File safety: look through a file or a folder and say what is risky about it before you open, run or trust it.
// Two ways of judging, both offline:
//   1. its shape  - an executable wearing a picture's name, a script whose first bytes say "DOS program", a link that
//                   points somewhere else, a right-to-left character hiding a real extension;
//   2. its content - a curated set of patterns taken from public security writing: download-and-run one-liners
//                   (curl | sh, wget | bash, Invoke-Expression), encoded PowerShell, reverse shells, credential theft,
//                   npm install hooks that reach the network, embedded private keys and cloud keys, hidden eval'd code.
// Nothing is executed: files are read as bytes and text only. ClamAV and YARA are used too, when they happen to be
// installed on this PC; without them this still works with nothing to download.
const fs = require('fs'), path = require('path'), cp = require('child_process'), crypto = require('crypto'), os = require('os');

const ROOT = path.join(__dirname, '..'), DATA = path.join(ROOT, 'data'), STORE = path.join(DATA, 'safety.json');
const MAXFILES = 8000, MAXBYTE = 2 * 1048576;        // per file: bigger than this is looked at by name and bytes only
const SKIP = /^(\.git|node_modules|\.svn|\.hg|__pycache__|\.cache)$/i;
const TEXT_EXT = /\.(txt|md|markdown|json|json5|ya?ml|toml|ini|cfg|conf|xml|html?|htm|css|scss|js|mjs|cjs|jsx|ts|tsx|py|rb|pl|php|sh|bash|zsh|fish|ps1|psm1|psd1|bat|cmd|vbs|vbe|wsf|hta|java|kt|cs|go|rs|c|h|cpp|hpp|swift|lua|sql|gradle|properties|env|service|desktop|pem|crt|key|pub|asc|lock|txt|log|diff|patch|gitignore|dockerignore|dockerfile|makefile)$/i;
const RISKY_EXT = /\.(exe|dll|sys|scr|com|pif|msi|msp|bat|cmd|ps1|vbs|vbe|jse|wsf|wsh|hta|lnk|scf|reg|chm|iso|img|vhd|apk|dmg|pkg|deb|rpm|jar|class)$/i;
const SCRIPT_EXT = /\.(sh|bash|zsh|ps1|psm1|bat|cmd|vbs|js|jse|py|pl|rb|php|hta|wsf|wsh)$/i;
const IMG_EXT = /\.(jpe?g|png|gif|bmp|webp|ico|svg|tiff?|mp4|mp3|wav|avi|mov|pdf|docx?|xlsx?|pptx?|zip|rar|7z|gz|tar)$/i;

/* ---------- what the bytes say, before anything is read as text ---------- */
function magic(buf) {
  if (buf.length < 4) return '';
  const s = buf.slice(0, 8);
  if (s[0] === 0x4d && s[1] === 0x5a) return 'pe';                       // Windows executable
  if (s[0] === 0x7f && s[1] === 0x45 && s[2] === 0x4c && s[3] === 0x46) return 'elf';
  if (s[0] === 0x23 && s[1] === 0x21) return 'shebang';                  // #! script
  if (s[0] === 0x50 && s[1] === 0x4b) return 'zip';                      // zip, docx, jar
  if (s[0] === 0x25 && s[1] === 0x50 && s[2] === 0x44 && s[3] === 0x46) return 'pdf';
  if (s[0] === 0xd0 && s[1] === 0xcf && s[2] === 0x11 && s[3] === 0xe0) return 'ole';   // old Office, macros
  return '';
}

/* ---------- what the text says ---------- */
const RULES = [
  /* download and run, the classic first step of a bad script */
  { id: 'download-and-run', level: 'danger', why: 'fetches something off the internet and runs it in one step',
    re: /(curl|wget|invoke-webrequest|iwr|downloadstring|downloadfile|webclient)[^\n]{0,160}(\|\s*(sudo\s+)?(ba)?sh\b|\|\s*(ba)?sh\b|\biex\b|invoke-expression|start-process|node\s+-e|python\s+-c)/i },
  { id: 'pipe-to-shell', level: 'danger', why: 'pipes a download straight into a shell',
    re: /(curl|wget)[^\n|]{0,200}\|\s*(sudo\s+)?(ba|z|k|fi)?sh\b/i },
  /* PowerShell that hides what it is doing */
  { id: 'powershell-encoded', level: 'danger', why: 'runs an encoded PowerShell command, so the real command is hidden',
    re: /powershell(\.exe)?[^\n]{0,80}\s-(e|en|enc|encod|encodedcommand)\s+[A-Za-z0-9+\/=]{40,}/i },
  { id: 'hidden-window', level: 'warn', why: 'starts a program with its window hidden',
    re: /-windowstyle\s+hidden|-w\s+hidden|createobject\(\s*["']wscript\.shell["']\s*\)/i },
  { id: 'iex-download', level: 'danger', why: 'downloads a string and executes it',
    re: /(invoke-expression|iex)\s*[\(\s][^\n]{0,120}(downloadstring|http:\/\/|https:\/\/|httpfile)/i },
  /* shells pointed back at somebody */
  { id: 'reverse-shell', level: 'danger', why: 'opens a shell back to another machine',
    re: /(\/dev\/tcp\/|bash\s+-i\s*>&|nc\s+(-[a-z]{1,3}\s+)*-e\s+(\/bin\/)?(ba|z)?sh|socat[^\n]{0,60}exec:|python[^\n]{0,40}socket[^\n]{0,80}connect)/i },
  { id: 'payload-tools', level: 'warn', why: 'names a tool for building malware or shells',
    re: /(msfvenom|meterpreter|mimikatz|sekurlsa|beacon\.exe\b|cobalt\s*strike)/i },
  /* the things that steal what you have */
  { id: 'credential-theft', level: 'danger', why: 'looks like it copies Windows passwords or browser logins',
    re: /(reg\s+save\s+hklm\\+sam|reg\s+save\s+hklm\\+system|lsass\.exe|minidump[^\n]{0,40}lsass|login\s*data|local\s*state|logins\.json|key4\.db|wallet\.dat)/i },
  { id: 'keylogger', level: 'warn', why: 'hooks the keyboard',
    re: /(setwindowshookex|getasynckeystate|keylog|keyspy|inputhook)/i },
  /* staying there after you close it */
  { id: 'persistence', level: 'warn', why: 'adds itself to a place that starts programs at login',
    re: /(schtasks[^\n]{0,60}\/create|reg\s+add[^\n]{0,80}\\+(run|runonce|winlogon)\b|new-service\b[^\n]{0,60}sc\s+create|systemd[^\n]{0,20}\.service|launchagents|autorun\.inf)/i },
  /* secrets left in a file */
  { id: 'private-key', level: 'warn', why: 'contains a private key - anybody reading this file can act as you',
    re: /-----BEGIN\s+(RSA|OPENSSH|EC|DSA|PGP|ENCRYPTED)?\s*PRIVATE KEY-----/ },
  { id: 'cloud-key', level: 'warn', why: 'contains something shaped like a cloud access key',
    re: /(AKIA[0-9A-Z]{16}|ASIA[0-9A-Z]{16}|ghp_[A-Za-z0-9]{30,}|xox[baprs]-[A-Za-z0-9-]{10,}|sk-[A-Za-z0-9]{32,})/ },
  { id: 'hardcoded-password', level: 'info', why: 'has a password or api key written into the code',
    re: /(api[_-]?key|secret|password|passwd|token)\s*[:=]\s*['"][^'"\n]{12,}['"]/i },
  /* code that assembles itself at runtime */
  { id: 'eval-obfuscated', level: 'warn', why: 'decodes a blob and runs it as code',
    re: /(eval\s*\(\s*(atob|buffer\.from|decodeuri(component)?)\s*\(|new\s+function\s*\(\s*(atob|buffer)|exec\s*\(\s*(atob|buffer\.from))/i },
  { id: 'hex-blob', level: 'info', why: 'a long run of escape codes, the shape of hidden code',
    re: /(\\x[0-9a-f]{2}){40,}|(%[0-9a-f]{2}){40,}/i },
  /* npm and pip packages that do things on install */
  { id: 'install-hook', level: 'warn', why: 'runs a command when the package is installed',
    re: /"(pre|post)?install"\s*:\s*"[^"]*(curl|wget|node\s+-e|powershell|bash\s+-c|sh\s+-c|python|sudo|rm\s+-rf)[^"]*"/i },
  { id: 'remote-script-tag', level: 'warn', why: 'loads code from somewhere else into a page',
    re: /<script[^>]+src\s*=\s*["']https?:\/\/(?!code\.jquery|cdn\.jsdelivr|unpkg\.com|cdnjs\.cloudflare)[^"']+["']/i },
  { id: 'html-cookie', level: 'info', why: 'reads cookies or stored passwords in a page',
    re: /document\.cookie|localstorage\.getitem\(\s*['"]?(token|auth|password|jwt)/i },
  /* trojan source: invisible characters that reverse what you read */
  { id: 'bidi-override', level: 'danger', why: 'uses an invisible character that reverses the text you see',
    re: /[\u202a-\u202e\u2066-\u2069]/ }
];

const sha1 = b => crypto.createHash('sha1').update(b).digest('hex');

/* engines that happen to be installed: they are used as an extra pair of eyes, never required */
function engines() {
  const which = n => { try { const r = cp.spawnSync(n, ['--version'], { timeout: 4000, windowsHide: true, encoding: 'utf8' }); return r.status === 0 ? String(r.stdout || r.stderr || '').split('\n')[0].trim().slice(0, 60) : ''; } catch (e) { return ''; } };
  const yaraDir = path.join(DATA, 'yara');
  let yaraRules = 0; try { yaraRules = fs.readdirSync(yaraDir).filter(f => /\.(yar|yara)$/i.test(f)).length; } catch (e) { }
  return { clam: which('clamscan'), yara: which('yara'), yaraRules, yaraDir };
}

function clamScan(dir, timeoutMs) {
  return new Promise(resolve => {
    let done = false;
    const finish = out => { if (!done) { done = true; resolve(out); } };
    let p; try { p = cp.spawn('clamscan', ['-r', '--infected', '--no-summary', '--exclude-dir=^.git$', dir], { windowsHide: true }); } catch (e) { return finish({ hits: [], error: 'clamscan could not start.' }); }
    let out = '', err = '';
    p.stdout.on('data', d => { out += d; }); p.stderr.on('data', d => { err += d; });
    const timer = setTimeout(() => { try { p.kill(); } catch (e) { } finish({ hits: [], error: 'ClamAV was still running after ' + Math.round(timeoutMs / 1000) + 's and was stopped.' }); }, timeoutMs);
    p.on('error', () => { clearTimeout(timer); finish({ hits: [], error: 'clamscan is not installed.' }); });
    p.on('close', () => { clearTimeout(timer); const hits = out.split(/\r?\n/).filter(l => /:\s+\S+\s+FOUND$/.test(l)).map(l => { const m = /^(.*?):\s+(.+)\s+FOUND$/.exec(l); return { file: m ? m[1] : l, name: m ? m[2] : 'virus' }; }); finish({ hits, error: '' }); });
  });
}
function yaraScan(dir, rules, timeoutMs) {
  return new Promise(resolve => {
    let p; try { p = cp.spawn('yara', ['-r', '-w', rules, dir], { windowsHide: true }); } catch (e) { return resolve({ hits: [], error: 'yara could not start.' }); }
    let out = '';
    p.stdout.on('data', d => { out += d; });
    const timer = setTimeout(() => { try { p.kill(); } catch (e) { } resolve({ hits: [], error: 'YARA was stopped after ' + Math.round(timeoutMs / 1000) + 's.' }); }, timeoutMs);
    p.on('error', () => { clearTimeout(timer); resolve({ hits: [], error: 'yara is not installed.' }); });
    p.on('close', () => { clearTimeout(timer); const hits = out.split(/\r?\n/).filter(Boolean).map(l => { const m = /^(\S+)\s+(\S+)\s+(.*)$/.exec(l); return m ? { rule: m[2], file: m[3] } : { rule: 'match', file: l }; }).slice(0, 200); resolve({ hits, error: '' }); });
  });
}

/* ---------- the walk ---------- */
function walk(dir, out, skipDirs) {
  let ents = []; try { ents = fs.readdirSync(dir, { withFileTypes: true }); } catch (e) { return; }
  for (const e of ents) {
    if (out.length >= MAXFILES) return;
    const p = path.join(dir, e.name);
    if (e.isSymbolicLink()) { out.push({ p, name: e.name, link: true }); continue; }
    if (e.isDirectory()) { if (!SKIP.test(e.name) && !(skipDirs || []).some(d => path.resolve(d) === path.resolve(p))) walk(p, out, skipDirs); continue; }
    out.push({ p, name: e.name });
  }
}

async function scanTree(target) {
  let given = String(target || '').trim().replace(/^"|"$/g, '');
  if (given === '~' || given.startsWith('~/') || given.startsWith('~\\')) given = os.homedir() + given.slice(1);
  const t = path.resolve(given);
  const started = Date.now();
  const stat = (() => { try { return fs.statSync(t); } catch (e) { return null; } })();
  if (!stat) return { error: 'There is no file or folder at ' + t + '.' };
  const files = [];
  if (stat.isDirectory()) walk(t, files, [path.join(DATA, 'refs'), path.join(DATA, 'videos')].filter(d => d !== t));
  else files.push({ p: t, name: path.basename(t) });

  const findings = [], seen = new Set(), list = [];
  let bytes = 0, scanned = 0, skippedBig = 0, executables = 0;
  const add = (f, rule, extra) => {
    const key = rule.id + '|' + f.rel; if (seen.has(key)) return; seen.add(key);
    findings.push({ file: f.rel, level: rule.level, rule: rule.id, why: rule.why, line: extra && extra.line || 0, snippet: (extra && extra.snippet || '').slice(0, 200) });
  };
  const pushes = (rel, name, buf, size) => {
    const f = { rel: rel.replace(/\\/g, '/'), name };
    /* shape first: the name and the first bytes have to agree */
    const kind = magic(buf);
    if (RISKY_EXT.test(name)) {
      executables++;
      const dbl = /\.(jpe?g|png|gif|bmp|webp|svg|pdf|txt|md|docx?|xlsx?|pptx?|mp[34]|avi|mov|zip|rar|7z)\.(exe|scr|com|pif|bat|cmd|js|vbs|lnk)$/i.test(name);
      if (dbl) add(f, { id: 'double-extension', level: 'danger', why: 'a picture or document name with an executable ending hidden behind it' });
      else if (kind === 'pe' || (kind === 'zip' && /\.jar$/i.test(name))) add(f, { id: 'executable', level: 'warn', why: 'this is a program, not a document: it can do anything it likes once opened' });
      else if (SCRIPT_EXT.test(name)) add(f, { id: 'script', level: 'info', why: 'a script: read it before running it, it runs with your permissions' });
    } else if (kind === 'pe' && IMG_EXT.test(name)) add(f, { id: 'wrong-bytes', level: 'danger', why: 'named like a picture or document but the bytes are a Windows program' });
    else if (kind === 'elf' && /\.(txt|md|jpg|png|pdf)$/i.test(name)) add(f, { id: 'wrong-bytes', level: 'danger', why: 'named like a document but the bytes are a Linux program' });
    if (/[\u202a-\u202e\u2066-\u2069]/.test(name)) add(f, { id: 'bidi-name', level: 'danger', why: 'the file name contains an invisible character that reverses how it reads' });
    if (buf.length > 8 && buf.indexOf(0) === -1 || TEXT_EXT.test(name)) {
      const text = buf.toString('utf8');
      for (const r of RULES) {
        const m = r.re.exec(text); if (!m) continue;
        const at = m.index, line = text.slice(0, at).split('\n').length;
        const snippet = text.slice(Math.max(0, at - 40), at + 120).replace(/\s+/g, ' ');
        add(f, r, { line, snippet });
      }
      if (text.length > 20000 && /\beval\s*\(|\bexec\s*\(/.test(text) && !/\n/.test(text.slice(0, 20000))) add(f, { id: 'one-long-line', level: 'warn', why: 'one enormous line of code with eval in it: the usual shape of packed malware' });
    }
    list.push({ file: f.rel, size, level: findings.some(x => x.file === f.rel && x.level === 'danger') ? 'danger' : findings.some(x => x.file === f.rel && x.level === 'warn') ? 'warn' : 'ok' });
  };

  for (const f of files) {
    let st; try { st = fs.lstatSync(f.p); } catch (e) { continue; }
    const rel = path.relative(t, f.p) || f.name;
    if (f.link || st.isSymbolicLink()) {
      let to = ''; try { to = fs.readlinkSync(f.p); } catch (e) { }
      const outside = path.resolve(path.dirname(f.p), to);
      add({ rel }, { id: 'symlink', level: outside.startsWith(t) ? 'info' : 'warn', why: outside.startsWith(t) ? 'a link to another file in this folder' : 'a link pointing outside this folder: the file it opens is not the one you downloaded' }, { snippet: to });
      continue;
    }
    bytes += st.size; scanned++;
    if (st.size > MAXBYTE) { skippedBig++; add({ rel }, { id: 'too-big', level: 'info', why: 'too big to read fully: only its name and first bytes were checked' }); }
    let buf = Buffer.alloc(0);
    try { buf = fs.readFileSync(f.p).slice(0, MAXBYTE); } catch (e) { }
    pushes(rel, f.name, buf, st.size);
    if (findings.length > 400) break;
  }

  /* the optional engines, only when installed */
  const eng = engines();
  if (eng.clam && stat.isDirectory()) {
    const c = await clamScan(t, 180000);
    if (c.error) eng.clamError = c.error;
    (c.hits || []).forEach(h => findings.push({ file: path.relative(t, h.file).replace(/\\/g, '/'), level: 'danger', rule: 'clamav', why: 'ClamAV says this is ' + h.name, line: 0, snippet: '' }));
  }
  if (eng.yara && eng.yaraRules) {
    const y = await yaraScan(t, path.join(eng.yaraDir, '*.yar'), 120000);
    (y.hits || []).forEach(h => findings.push({ file: String(h.file).replace(/\\/g, '/'), level: 'warn', rule: 'yara:' + h.rule, why: 'a YARA rule in data/yara matched this file', line: 0, snippet: '' }));
    if (y.error) eng.yaraError = y.error;
  }

  const counts = { danger: findings.filter(f => f.level === 'danger').length, warn: findings.filter(f => f.level === 'warn').length, info: findings.filter(f => f.level === 'info').length };
  const level = counts.danger ? 'danger' : counts.warn ? 'warn' : 'clean';
  return {
    path: t, name: path.basename(t), isDir: stat.isDirectory(), files: scanned, bytes, executables, skippedBig,
    findings: findings.slice(0, 250), counts, level, engines: { clam: !!eng.clam, yara: !!eng.yara && !!eng.yaraRules, clamError: eng.clamError || '', yaraError: eng.yaraError || '' },
    ms: Date.now() - started, at: Date.now()
  };
}

/* results kept per repository, so a card can show its verdict without scanning again */
function readStore() { try { const j = JSON.parse(fs.readFileSync(STORE, 'utf8')); return j && typeof j === 'object' ? j : {}; } catch (e) { return {}; } }
function save(key, res) {
  const all = readStore();
  all[String(key)] = { at: res.at, level: res.level, counts: res.counts, files: res.files, bytes: res.bytes, findings: (res.findings || []).slice(0, 60), engines: res.engines, path: res.path, ms: res.ms };
  try { fs.mkdirSync(DATA, { recursive: true }); const tmp = STORE + '.tmp'; fs.writeFileSync(tmp, JSON.stringify(all)); fs.renameSync(tmp, STORE); } catch (e) { }
  return all[String(key)];
}
const get = key => readStore()[String(key)] || null;
const forget = key => { const all = readStore(); delete all[String(key)]; try { fs.writeFileSync(STORE, JSON.stringify(all)); } catch (e) { } return true; };
function summary() {
  const all = readStore(), out = { repos: 0, danger: 0, warn: 0, clean: 0, at: 0 };
  for (const k of Object.keys(all)) { out.repos++; out[all[k].level === 'danger' ? 'danger' : all[k].level === 'warn' ? 'warn' : 'clean']++; out.at = Math.max(out.at, all[k].at || 0); }
  return out;
}

module.exports = { scanTree, save, get, forget, summary, engines, STORE };

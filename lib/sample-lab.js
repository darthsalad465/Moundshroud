// Cyber › Coding › Sample lab: read a suspicious file without running it, and run it only inside a real isolation
// boundary (Windows Sandbox), never as the signed-in Windows user.
//
// analyze() is pure: it decodes, hashes, parses the PE or script header and pulls indicators out of the bytes, and it
// never executes, writes or fetches anything. run() hands Windows programs and scripts to lib/code-sandbox-windows.js,
// which starts a disposable, network-less sandbox VM; when that feature is not turned on the sample is refused.
'use strict';

const crypto = require('node:crypto');
const sandbox = require('./code-sandbox-windows');

const MAX = 8 * 1024 * 1024;        /* a sample we will read or hand to the sandbox */
const MAX_TEXT = 1_000_000;         /* characters of pasted text */
const MAX_SCAN = 6 * 1024 * 1024;   /* bytes of strings we extract from */

/* ---------- reading the sample ---------- */

function decode(input) {
  if (!input || typeof input !== 'object') throw new Error('Send a sample: a file, or text you pasted.');
  let name = String(input.name || '').replace(/[\\/:*?"<>|\u0000-\u001f]/g, '_').trim().slice(0, 80);
  let buf;
  if (typeof input.b64 === 'string' && input.b64.trim()) {
    const b64 = input.b64.replace(/^data:[^,]*,/, '').replace(/\s+/g, '');
    if (b64.length > MAX * 1.4) throw new Error('The sample is larger than 8 MB.');
    if (!/^[A-Za-z0-9+/]*={0,2}$/.test(b64)) throw new Error('That base64 could not be read.');
    buf = Buffer.from(b64, 'base64');
  } else if (typeof input.text === 'string' && input.text.length) {
    if (!input.text.trim()) throw new Error('The sample is empty.');
    if (input.text.length > MAX_TEXT) throw new Error('That text is larger than 1,000,000 characters.');
    if (input.b64text) {
      const b64 = input.text.replace(/\s+/g, '');
      if (!/^[A-Za-z0-9+/]*={0,2}$/.test(b64)) throw new Error('The box is ticked as base64, but the text is not valid base64.');
      buf = Buffer.from(b64, 'base64');
    } else {
      buf = Buffer.from(input.text, 'utf8');
    }
    if (!name) name = 'pasted.txt';
  } else {
    throw new Error('Send a sample: a file, or text you pasted.');
  }
  if (!buf.length) throw new Error('The sample is empty.');
  if (buf.length > MAX) throw new Error('The sample is larger than 8 MB.');
  return { name: name || 'sample.bin', buf };
}

/* ---------- what kind of file it is ---------- */

function kindOf(name, buf) {
  if (buf.length > 1 && buf[0] === 0x4d && buf[1] === 0x5a) return { kind: 'pe', script: '' };
  if (buf.length > 3 && buf[0] === 0x7f && buf[1] === 0x45 && buf[2] === 0x4c && buf[3] === 0x46) return { kind: 'elf', script: '' };
  const ext = (String(name).match(/\.([a-z0-9]+)$/i) || [])[1];
  const e = ext ? ext.toLowerCase() : '';
  let script = { ps1: 'powershell', psm1: 'powershell', bat: 'batch', cmd: 'batch', vbs: 'vbscript', vbe: 'vbscript', js: 'jscript', jse: 'jscript', wsf: 'jscript', sh: 'shell', py: 'python' }[e] || '';
  const head = buf.subarray(0, 4096).toString('latin1');
  if (!script) script = sniffScript(head);
  if (script) return { kind: 'script', script };
  if (/^\s*<(!doctype|html|\?xml)/i.test(head) || /^\s*(\{|\[)/.test(head) || /^\s*(#!|import |from |def |function |var |const |let |using |package )/.test(head)) {
    return { kind: 'text', script: '' };
  }
  const printable = (head.match(/[\x20-\x7e\t\r\n]/g) || []).length;
  return head.length && printable / head.length > 0.92 ? { kind: 'text', script: '' } : { kind: 'binary', script: '' };
}

/* Pasted samples rarely come with a useful name, so the first lines decide: a script host leaves a recognisable
   fingerprint even in a plain text box. */
function sniffScript(head) {
  if (/^#!\s*\/(usr\/)?(env\s+)?(ba|z|da|k)?sh/.test(head)) return 'shell';
  if (/^\s*@?echo\s+off\b/im.test(head) || /^\s*rem\s+/im.test(head) || /%systemroot%|\bif\s+exist\s+\"/i.test(head)) return 'batch';
  if (/\bWScript\.(Shell|CreateObject|Echo)|CreateObject\(\s*"/i.test(head) && !/\b(import|export|function\s+\w+\s*\()/i.test(head)) return 'vbscript';
  if (/(^|\n)\s*(IEX|Invoke-Expression|Invoke-WebRequest|Invoke-RestMethod|New-Object|Start-Process|Write-Host|Get-ChildItem|Set-ItemProperty|Add-MpPreference|Set-MpPreference|Add-Type|Import-Module)\b/i.test(head) ||
    /\$(env|Error|PSVersionTable|MyInvocation)\b|-EncodedCommand|-WindowStyle\b/i.test(head)) return 'powershell';
  return '';
}

/* ---------- the bytes as visible text ---------- */

function stringsOf(buf) {
  const text = buf.subarray(0, MAX_SCAN).toString('latin1');
  const runs = text.match(/[ -~]{4,}/g) || [];
  return runs.length > 60000 ? runs.slice(0, 60000) : runs;
}

function entropyOf(buf) {
  if (!buf.length) return 0;
  const counts = new Uint32Array(256);
  const step = buf.length > 2 * 1024 * 1024 ? Math.floor(buf.length / (2 * 1024 * 1024)) : 1;
  let n = 0;
  for (let i = 0; i < buf.length; i += step) { counts[buf[i]]++; n++; }
  let h = 0;
  for (let i = 0; i < 256; i++) { if (!counts[i]) continue; const p = counts[i] / n; h -= p * Math.log2(p); }
  return Math.round(h * 100) / 100;
}

/* ---------- a small PE header reader ---------- */

const MACHINE = { 0x14c: 'x86 (32-bit)', 0x8664: 'x64 (64-bit)', 0xaa64: 'ARM64', 0x1c0: 'ARM', 0x200: 'Itanium' };
const SUBSYSTEM = { 1: 'native', 2: 'Windows GUI', 3: 'Windows console', 7: 'POSIX', 9: 'Windows CE', 10: 'EFI', 16: 'Windows boot' };

function parsePE(buf) {
  try {
    if (buf.length < 0x40) return null;
    const e = buf.readUInt32LE(0x3c);
    if (e + 24 > buf.length || buf.toString('latin1', e, e + 4) !== 'PE\u0000\u0000') return null;
    const machine = buf.readUInt16LE(e + 4), nsections = buf.readUInt16LE(e + 6);
    const stamped = buf.readUInt32LE(e + 8), magic = buf.readUInt16LE(e + 24);
    const subsystem = buf.readUInt16LE(e + 24 + 68);
    const sections = [];
    const table = e + 24 + buf.readUInt16LE(e + 20);
    for (let i = 0; i < Math.min(nsections, 40); i++) {
      const at = table + i * 40;
      if (at + 40 > buf.length) break;
      const name = buf.toString('latin1', at, at + 8).replace(/\u0000+$/, '').trim() || '(unnamed)';
      const rawSize = buf.readUInt32LE(at + 16), rawAt = buf.readUInt32LE(at + 20);
      const flags = buf.readUInt32LE(at + 36);
      const body = rawAt && rawAt + rawSize <= buf.length ? buf.subarray(rawAt, rawAt + rawSize) : Buffer.alloc(0);
      sections.push({
        name, size: rawSize,
        exec: !!(flags & 0x20000000), write: !!(flags & 0x80000000), read: !!(flags & 0x40000000),
        entropy: entropyOf(body),
      });
    }
    return {
      machine: MACHINE[machine] || 'machine 0x' + machine.toString(16), bits: magic === 0x20b ? 64 : 32,
      subsystem: SUBSYSTEM[subsystem] || 'subsystem ' + subsystem,
      stamped: stamped ? new Date(stamped * 1000).toISOString().slice(0, 10) : '',
      sections,
    };
  } catch (e) { return null; }
}

/* ---------- what the text suggests ---------- */

const API = [
  ['VirtualAllocEx', 'allocates memory in another process (process injection)'],
  ['WriteProcessMemory', 'writes into another process (process injection)'],
  ['CreateRemoteThread', 'starts code in another process (process injection)'],
  ['NtUnmapViewOfSection', 'process hollowing'],
  ['SetWindowsHookEx', 'hooks keystrokes or windows'],
  ['GetAsyncKeyState', 'reads the keyboard (keylogger)'],
  ['URLDownloadToFile', 'downloads a file'],
  ['InternetOpenUrl', 'opens a URL'],
  ['WinHttpOpen', 'talks HTTP from native code'],
  ['WinExec', 'runs a program'],
  ['ShellExecute', 'runs a program or opens a file'],
  ['CreateProcess', 'starts another process'],
  ['CryptEncrypt', 'encrypts data (ransomware)'],
  ['CryptGenKey', 'generates a key (ransomware)'],
  ['RegSetValue', 'writes the registry (persistence)'],
  ['CreateService', 'installs a service (persistence)'],
  ['schtasks', 'schedules a task (persistence)'],
  ['IsDebuggerPresent', 'checks for a debugger (anti-analysis)'],
  ['CheckRemoteDebuggerPresent', 'checks for a debugger (anti-analysis)'],
  ['Sleep', 'waits, often to outlast a sandbox'],
  ['WSAStartup', 'opens a network socket'],
  ['connect', 'connects to a network address'],
  ['NtQueryInformationProcess', 'inspects its own process (anti-analysis)'],
];

const RULES = [
  /* PowerShell */
  { script: 'powershell', re: /-e(nc|ncodedcommand)?\s+[A-Za-z0-9+/=]{20,}/i, sev: 'high', label: 'Encoded PowerShell command', detail: 'The command is base64 so it cannot be read at a glance; it gets decoded and run in memory.' },
  { script: 'powershell', re: /\bIEX\b|Invoke-Expression/i, sev: 'high', label: 'Runs a string as code', detail: 'Invoke-Expression / IEX turns text (often downloaded text) into commands.' },
  { script: 'powershell', re: /DownloadString|DownloadFile|DownloadData|Invoke-WebRequest|\biwr\b|Net\.WebClient/i, sev: 'high', label: 'Downloads something', detail: 'PowerShell fetches a file or text; a downloader usually follows it with IEX or Start-Process.' },
  { script: 'powershell', re: /FromBase64String/i, sev: 'med', label: 'Decodes base64', detail: 'Obfuscated payloads are usually shipped as base64.' },
  { script: 'powershell', re: /-WindowStyle\s+Hidden|-w\s+hidden|CreateNoWindow/i, sev: 'med', label: 'Hides its window', detail: 'A program that hides its console window is trying not to be seen.' },
  { script: 'powershell', re: /AMSI|amsiInitFailed|Set-MpPreference|Add-MpPreference|DisableRealtimeMonitoring|ExclusionPath/i, sev: 'high', label: 'Attacks the antivirus', detail: 'Turns off or excludes itself from Windows Defender, or tampers with AMSI.' },
  { script: 'powershell', re: /Reflection\.Assembly\]::Load|Assembly\]::LoadFile|LoadFrom/i, sev: 'high', label: 'Loads a .NET assembly in memory', detail: 'A common way to run a payload without writing it to disk.' },
  { script: 'powershell', re: /ConvertTo-SecureString|ConvertFrom-SecureString|SecureStringToBSTR/i, sev: 'med', label: 'Handles saved credentials', detail: 'Mimikatz-style credential theft works this way.' },
  { script: 'powershell', re: /Start-Process[^\n]*-Verb\s+RunAs/i, sev: 'high', label: 'Asks for administrator rights', detail: 'It tries to elevate, which needs your consent.' },
  /* batch */
  { script: 'batch', re: /certutil[^\n]*-urlcache|bitsadmin|certreq/i, sev: 'high', label: 'Downloads through a Windows tool', detail: 'certutil and bitsadmin are built into Windows and are often used to fetch payloads.' },
  { script: 'batch', re: /vssadmin[^\n]*delete[^\n]*shadows|wbadmin[^\n]*delete|bcdedit[^\n]*recoveryenabled\s+no/i, sev: 'high', label: 'Destroys backups', detail: 'Deleting shadow copies or recovery settings is what ransomware does before encrypting.' },
  { script: 'batch', re: /net\s+user\s+\S+\s+\S+\s+\/add|net\s+localgroup\s+administrators/i, sev: 'high', label: 'Creates or promotes accounts', detail: 'Adds a user or puts one into Administrators.' },
  { script: 'batch', re: /reg\s+add[^\n]*\\Run|schtasks\s+\/create|sc\s+create/i, sev: 'high', label: 'Starts itself later (persistence)', detail: 'Writes a Run key, a scheduled task or a service so it runs again after a reboot.' },
  { script: 'batch', re: /powershell|mshta|wscript|cscript|rundll32|regsvr32/i, sev: 'med', label: 'Hands off to another program', detail: 'A batch file that launches PowerShell, mshta, rundll32 or a script host is usually a launcher.' },
  /* VBScript / JScript */
  { script: 'vbscript', re: /WScript\.Shell|CreateObject\(\s*"WScript\.Shell"/i, sev: 'med', label: 'Runs commands through Windows Script Host', detail: 'WScript.Shell.Run is the usual way a script starts a program.' },
  { script: 'jscript', re: /WScript\.Shell|ActiveXObject|WScript\.CreateObject/i, sev: 'med', label: 'Uses Windows Script Host', detail: 'ActiveXObject gives a script a shell, a file system or a network request.' },
  { script: 'script', re: /MSXML2\.(XMLHTTP|ServerXMLHTTP)|WinHttp\.WinHttpRequest|Shell\.Application/i, sev: 'high', label: 'Talks to the network from a script', detail: 'XMLHTTP objects are how script droppers download their next stage.' },
  /* shell */
  { script: 'shell', re: /curl[^\n|]*\|\s*(ba)?sh|wget[^\n|]*\|\s*(ba)?sh/i, sev: 'high', label: 'Pipes a download straight into a shell', detail: 'Whatever the server returns is executed without review.' },
  { script: 'shell', re: /\bnc\s+(-\w+\s+)*-\w*e\b|\/dev\/tcp\//i, sev: 'high', label: 'Opens a reverse shell', detail: 'Netcat with -e, or /dev/tcp, gives a remote party a shell.' },
  { script: 'shell', re: /\bcrontab\b|>>\s*~?\/?\.(bashrc|profile)|systemctl\s+enable/i, sev: 'med', label: 'Starts itself later', detail: 'Writes a cron job or a login script so it runs again.' },
  /* any file */
  { script: '', re: /(hxxp|https?):\/\/(\d{1,3}\.){3}\d{1,3}(:\d+)?\//i, sev: 'med', label: 'Talks to a bare IP address', detail: 'A URL with an IP instead of a name avoids DNS lookups and domain blocking.' },
  { script: '', re: /BEGIN (RSA |OPENSSH |EC )?PRIVATE KEY/i, sev: 'high', label: 'Contains a private key', detail: 'An embedded key pair usually means ransom notes, signing or stolen data.' },
];

function scanText(text) {
  const indicators = { urls: [], ips: [], domains: [], emails: [], registry: [], paths: [], wallets: [] };
  const grab = (re, into, max, map) => {
    const seen = new Set();
    for (const m of text.matchAll(re)) {
      const v = (map ? map(m) : m[0]).trim();
      if (!v || seen.has(v) || into.length >= max) continue;
      seen.add(v); into.push(v.length > 160 ? v.slice(0, 160) + '…' : v);
    }
  };
  grab(/\bhttps?:\/\/[^\s"'<>()\[\]{}\\|^`]{3,180}/gi, indicators.urls, 40);
  grab(/\b(?:\d{1,3}\.){3}\d{1,3}(?::\d{2,5})?\b/g, indicators.ips, 25);
  grab(/\b(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+(?:com|net|org|ru|cn|top|xyz|info|biz|io|su|cc|tk|ml|ga|cf|gq|onion|shop|site|zip|mov)\b/gi, indicators.domains, 30);
  grab(/\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b/g, indicators.emails, 15);
  grab(/\bHKLM\\[^\s"']{3,120}|\bHKCU\\[^\s"']{3,120}|\bHKEY_[A-Z_]+\\[^\s"']{3,120}/gi, indicators.registry, 20);
  grab(/\b[A-Za-z]:\\(?:[^\\\s"'<>|:*?]{2,40}\\){1,8}[^\\\s"'<>|:*?]{2,40}/g, indicators.paths, 25);
  grab(/%AppData%|%TEMP%|%ProgramData%|%UserProfile%|\\AppData\\Roaming\\|\\Start Menu\\Programs\\Startup\\/gi, indicators.paths, 25);
  grab(/\b(?:bc1[a-z0-9]{25,62}|[13][a-km-zA-HJ-NP-Z1-9]{25,34})\b/g, indicators.wallets, 8);
  return indicators;
}

function analyzeBuffer(name, buf) {
  const { kind, script } = kindOf(name, buf);
  const strings = stringsOf(buf);
  const text = strings.join('\n');
  const pe = kind === 'pe' ? parsePE(buf) : null;
  const findings = [];
  const add = (sev, label, detail) => { if (!findings.some(f => f.label === label)) findings.push({ sev, label, detail }); };

  if (pe) {
    for (const s of pe.sections) {
      if (s.exec && s.write) add('high', 'Writable and executable section ' + s.name, 'Code that can rewrite itself is a sign of unpacking, shellcode or a packer.');
      else if (s.exec && s.size > 4096 && s.entropy > 7.2) add('high', 'Packed section ' + s.name + ' (entropy ' + s.entropy + ')', 'Very high entropy in code means it is compressed or encrypted: the real program is unpacked when it runs.');
    }
    if (!pe.sections.length) add('med', 'No usable section table', 'A broken or deliberately unusual PE header.');
  }
  for (const [api, why] of API) {
    if (strings.some(s => s.includes(api))) add(/^Create|^Write|VirtualAllocEx|SetWindowsHookEx/.test(api) ? 'med' : 'low', 'Uses ' + api, why);
  }
  for (const rule of RULES) {
    if (rule.script && rule.script !== 'script' && rule.script !== script) continue;
    if (rule.re.test(text)) add(rule.sev, rule.label, rule.detail);
  }
  const b64 = strings.filter(s => /^[A-Za-z0-9+/=]{120,}$/.test(s)).length;
  if (b64 >= 2) add('med', b64 + ' large base64 blocks', 'Obfuscated payloads are often carried as base64 text.');
  if (kind === 'pe' && /This program cannot be run in DOS mode/i.test(text) && entropyOf(buf) > 7.4) {
    add('med', 'Nearly the whole file is high-entropy', 'Most of the file is compressed or encrypted, not normal compiled code.');
  }
  if (!findings.length && (kind === 'pe' || script)) add('info', 'No classic malware indicators in the bytes', 'Nothing in the file text matches a known pattern. That does not mean it is safe: behaviour only shows when it runs.');

  const high = findings.filter(f => f.sev === 'high').length, med = findings.filter(f => f.sev === 'med').length;
  const indicators = scanText(text);
  const count = (o) => Object.values(o).reduce((n, v) => n + v.length, 0);
  const verdict = high ? { level: 'high', text: 'Treat this as malware: it has ' + high + ' high-severity indicator' + (high === 1 ? '' : 's') + '.' }
    : med ? { level: 'med', text: 'Suspicious: ' + med + ' moderate indicator' + (med === 1 ? '' : 's') + ' and no high-severity one.' }
      : { level: 'low', text: 'Nothing classic a scanner would flag. Run it in a sandbox before trusting it.' };

  return {
    name, size: buf.length,
    sha256: crypto.createHash('sha256').update(buf).digest('hex'),
    sha1: crypto.createHash('sha1').update(buf).digest('hex'),
    md5: crypto.createHash('md5').update(buf).digest('hex'),
    entropy: entropyOf(buf), kind, script, pe,
    findings: findings.sort((a, b) => ({ high: 0, med: 1, low: 2, info: 3 }[a.sev] - { high: 0, med: 1, low: 2, info: 3 }[b.sev])),
    indicators, signalCount: count(indicators), verdict,
    runnable: !!runnerFor(kind, script),
  };
}

/* which sealed backend can run this sample, if any */
function runnerFor(kind, script) {
  if (kind === 'pe') return { backend: 'windows-sandbox', why: '' };
  if (kind === 'script' && sandbox.SAMPLE_SCRIPT[script]) return { backend: 'windows-sandbox', why: '' };
  if (kind === 'script' && script === 'shell') return { backend: '', why: 'Linux shell samples need the Docker backend, which this build does not run samples in yet. The static report still applies.' };
  return { backend: '', why: 'This build only runs Windows programs and Windows scripts (.exe, .ps1, .bat, .vbs, .js). Other files can be read, but not executed.' };
}

function analyze(input) {
  const { name, buf } = decode(input);
  const report = analyzeBuffer(name, buf);
  const run = runnerFor(report.kind, report.script);
  const sb = sandbox.status();
  return Object.assign(report, {
    canRun: !!run.backend && (run.backend !== 'windows-sandbox' || sb.available),
    runBackend: run.backend,
    runWhy: run.backend ? (sb.available ? '' : sb.reason) : run.why,
  });
}

/* Run the sample inside the disposable, network-less Windows Sandbox VM. Never on this PC. */
async function run(input, signal) {
  const { name, buf } = decode(input);
  const report = analyzeBuffer(name, buf);
  const which = runnerFor(report.kind, report.script);
  if (!which.backend) return { ok: false, unavailable: true, error: which.why, report };
  return sandbox.runSample({ name, bytes: buf, kind: report.kind, script: report.script, input: String(input.input || '') }, signal);
}

module.exports = { MAX, decode, kindOf, analyze, run, analyzeBuffer };

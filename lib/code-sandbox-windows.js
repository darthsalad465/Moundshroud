// Coding › Playground › Windows Sandbox: runs Windows-native scripts (PowerShell, batch, VBScript, JScript) in a
// disposable, hypervisor-isolated Windows VM started by WindowsSandbox.exe. Nothing is run on the host as the
// signed-in user. The VM gets two mapped folders: a read-only input folder holding the program and this runner, and
// a writable output folder the runner uses for result.json. Networking, clipboard, printer, camera and microphone
// sharing are disabled; the sandbox is shut down and deleted after every run.
//
// Windows Sandbox is an optional Windows feature and is not present on every PC. When it is not turned on, status()
// says so and run() refuses instead of falling back to the host. Enabling it needs an administrator and a restart;
// this module never tries to enable it.
'use strict';

const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawn, execFile } = require('node:child_process');
const { randomUUID } = require('node:crypto');

const WIN = process.platform === 'win32';
const SYS = process.env.SystemRoot || 'C:\\Windows';
const EXE = path.join(SYS, 'System32', 'WindowsSandbox.exe');
const GUEST = 'C:\\Users\\WDAGUtilityAccount\\Desktop';
const LANGS = new Set(['powershell', 'batch', 'vbscript', 'jscript']);
const FILES = {
  powershell: { name: 'main.ps1', bom: true },
  batch: { name: 'main.bat', crlf: true },
  vbscript: { name: 'main.vbs' },
  jscript: { name: 'main.js' },
};
/* a submitted sample keeps its bytes exactly; the extension picks the interpreter */
const SAMPLE_SCRIPT = { powershell: 'ps1', batch: 'bat', vbscript: 'vbs', jscript: 'js' };
const SAMPLE_PE = /^[a-z0-9]{1,8}$/i;
const RUN_TIME = 30_000;
const BOOT_TIME = 90_000;
const OUTPUT_LIMIT = 64 * 1024;
const RESULT_LIMIT = 1024 * 1024;
let busy = false;

const exists = p => { try { return !!p && fs.existsSync(p); } catch (e) { return false; } };
const sleep = ms => new Promise(done => setTimeout(done, ms));

function available() { return WIN && exists(EXE); }

function status() {
  return {
    available: available(),
    languages: [...LANGS],
    exe: available() ? EXE : '',
    reason: available() ? '' : 'Windows Sandbox is not turned on. Windows-native code is refused rather than run as your Windows user.',
  };
}

function xml(value) {
  return String(value).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&apos;' }[c]));
}

/* The .wsb file: no network, no shared clipboard, printer, camera or microphone; input is read-only, output is the
   only writable host folder. The logon command starts the trusted runner from the read-only input folder. */
function wsbFor(inputFolder, outputFolder) {
  const command = 'powershell.exe -NoLogo -NoProfile -NonInteractive -ExecutionPolicy Bypass -File ' +
    GUEST + '\\oa-in\\runner.ps1';
  return '<?xml version="1.0" encoding="utf-8"?>\n' +
    '<Configuration>\n' +
    '  <Networking>Disable</Networking>\n' +
    '  <ClipboardRedirection>Disable</ClipboardRedirection>\n' +
    '  <PrinterRedirection>Disable</PrinterRedirection>\n' +
    '  <VideoInput>Disable</VideoInput>\n' +
    '  <AudioInput>Disable</AudioInput>\n' +
    '  <ProtectedClient>Enable</ProtectedClient>\n' +
    '  <MemoryInMB>2048</MemoryInMB>\n' +
    '  <MappedFolders>\n' +
    '    <MappedFolder>\n' +
    '      <HostFolder>' + xml(inputFolder) + '</HostFolder>\n' +
    '      <SandboxFolder>oa-in</SandboxFolder>\n' +
    '      <ReadOnly>true</ReadOnly>\n' +
    '    </MappedFolder>\n' +
    '    <MappedFolder>\n' +
    '      <HostFolder>' + xml(outputFolder) + '</HostFolder>\n' +
    '      <SandboxFolder>oa-out</SandboxFolder>\n' +
    '      <ReadOnly>false</ReadOnly>\n' +
    '    </MappedFolder>\n' +
    '  </MappedFolders>\n' +
    '  <LogonCommand>\n' +
    '    <Command>' + xml(command) + '</Command>\n' +
    '  </LogonCommand>\n' +
    '</Configuration>\n';
}

/* The trusted runner. It starts the program with redirected standard handles (so the Input box is fed through a
   file, not a PowerShell pipe), stops the whole process tree after the time limit or 256 KB of output, writes
   result.json atomically, and shuts the disposable sandbox down. */
const RUNNER = String.raw`$ErrorActionPreference = 'Stop'
$ProgressPreference = 'SilentlyContinue'
$root = Split-Path -Parent $MyInvocation.MyCommand.Path
$out = Join-Path (Split-Path -Parent $root) 'oa-out'
$job = Get-Content -LiteralPath (Join-Path $root 'job.json') -Raw -Encoding UTF8 | ConvertFrom-Json
$work = Join-Path $env:TEMP ('oa-work-' + [guid]::NewGuid().ToString('N'))
New-Item -ItemType Directory -Force -Path $work | Out-Null
$stdout = Join-Path $out 'stdout.txt'
$stderr = Join-Path $out 'stderr.txt'
$stdin = Join-Path $root 'stdin.txt'
Remove-Item -LiteralPath $stdout -Force -ErrorAction SilentlyContinue
Remove-Item -LiteralPath $stderr -Force -ErrorAction SilentlyContinue

function Read-Capped([string]$file, [int]$limit) {
  if (-not (Test-Path -LiteralPath $file)) { return '' }
  try {
    $stream = [System.IO.File]::Open($file, [System.IO.FileMode]::Open, [System.IO.FileAccess]::Read, [System.IO.FileShare]::ReadWrite)
    try {
      $size = [int][Math]::Min($stream.Length, $limit)
      $buffer = New-Object byte[] $size
      $read = 0
      while ($read -lt $size) {
        $n = $stream.Read($buffer, $read, $size - $read)
        if ($n -le 0) { break }
        $read += $n
      }
      return [System.Text.Encoding]::UTF8.GetString($buffer, 0, $read)
    } finally { $stream.Dispose() }
  } catch { return '' }
}

$result = [ordered]@{ ok = $false; exitCode = $null; stdout = ''; stderr = ''; error = '' }
try {
  switch ([string]$job.lang) {
    'powershell' {
      $exe = Join-Path $env:SystemRoot 'System32\WindowsPowerShell\v1.0\powershell.exe'
      $arguments = @('-NoLogo', '-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-File', (Join-Path $root 'main.ps1'))
    }
    'batch' {
      $exe = Join-Path $env:SystemRoot 'System32\cmd.exe'
      $arguments = @('/d', '/s', '/c', (Join-Path $root 'main.bat'))
    }
    'vbscript' {
      $exe = Join-Path $env:SystemRoot 'System32\cscript.exe'
      $arguments = @('//nologo', '//E:vbscript', (Join-Path $root 'main.vbs'))
    }
    'jscript' {
      $exe = Join-Path $env:SystemRoot 'System32\cscript.exe'
      $arguments = @('//nologo', '//E:jscript', (Join-Path $root 'main.js'))
    }
    default { throw ('Unsupported language: ' + [string]$job.lang) }
  }
  $limit = [int]$job.timeLimit
  if ($limit -lt 1000) { $limit = 30000 }
  $process = Start-Process -FilePath $exe -ArgumentList $arguments -WorkingDirectory $work -RedirectStandardInput $stdin -RedirectStandardOutput $stdout -RedirectStandardError $stderr -NoNewWindow -PassThru
  $deadline = [DateTime]::UtcNow.AddMilliseconds($limit)
  $stopped = ''
  while (-not $process.HasExited) {
    if ([DateTime]::UtcNow -ge $deadline) { $stopped = 'Stopped after ' + [Math]::Round($limit / 1000) + ' seconds.'; break }
    $size = 0
    foreach ($file in @($stdout, $stderr)) {
      try { $size += (Get-Item -LiteralPath $file -ErrorAction Stop).Length } catch { }
    }
    if ($size -gt 262144) { $stopped = 'Stopped after reaching the 64 KB output limit.'; break }
    Start-Sleep -Milliseconds 100
    $process.Refresh()
  }
  if (-not $process.HasExited) {
    & (Join-Path $env:SystemRoot 'System32\taskkill.exe') /PID $process.Id /T /F | Out-Null
    try { [void]$process.WaitForExit(5000) } catch { }
  } else {
    try { [void]$process.WaitForExit() } catch { }
  }
  $exitCode = $null
  try { $exitCode = [int]$process.ExitCode } catch { }
  $result.exitCode = $exitCode
  $result.stdout = Read-Capped $stdout 65536
  $result.stderr = Read-Capped $stderr 65536
  if ($stopped) {
    $result.error = $stopped
  } elseif ($null -eq $exitCode) {
    $result.error = 'The program did not report an exit code.'
  } elseif ($exitCode -ne 0) {
    $result.error = 'Program exited with status ' + $exitCode + '.'
  } else {
    $result.ok = $true
  }
} catch {
  $result.error = 'The sandbox runner failed: ' + $_.Exception.Message
} finally {
  try {
    $tmp = Join-Path $out 'result.tmp'
    $json = $result | ConvertTo-Json -Compress -Depth 4
    [System.IO.File]::WriteAllText($tmp, $json, (New-Object System.Text.UTF8Encoding($false)))
    Move-Item -LiteralPath $tmp -Destination (Join-Path $out 'result.json') -Force
  } catch { }
  try { Remove-Item -LiteralPath $work -Recurse -Force -ErrorAction SilentlyContinue } catch { }
  try { Start-Process -FilePath (Join-Path $env:SystemRoot 'System32\shutdown.exe') -ArgumentList @('/s', '/t', '5', '/f') -WindowStyle Hidden | Out-Null } catch { }
}
`;

function runnerScript() { return RUNNER; }

/* The sample runner. It runs the submitted file exactly as it is, with the same time and output limits, and reports
   what it can see from inside the disposable VM: the exit code, its output, the processes it started and the files it
   dropped in its working folder. It then writes result.json and shuts the sandbox down. */
const SAMPLE_RUNNER = String.raw`$ErrorActionPreference = 'Stop'
$ProgressPreference = 'SilentlyContinue'
$root = Split-Path -Parent $MyInvocation.MyCommand.Path
$out = Join-Path (Split-Path -Parent $root) 'oa-out'
$job = Get-Content -LiteralPath (Join-Path $root 'job.json') -Raw -Encoding UTF8 | ConvertFrom-Json
$work = Join-Path $env:TEMP ('oa-sample-' + [guid]::NewGuid().ToString('N'))
New-Item -ItemType Directory -Force -Path $work | Out-Null
$stdout = Join-Path $out 'stdout.txt'
$stderr = Join-Path $out 'stderr.txt'
$stdin = Join-Path $root 'stdin.txt'
Remove-Item -LiteralPath $stdout -Force -ErrorAction SilentlyContinue
Remove-Item -LiteralPath $stderr -Force -ErrorAction SilentlyContinue

function Read-Capped([string]$file, [int]$limit) {
  if (-not (Test-Path -LiteralPath $file)) { return '' }
  try {
    $stream = [System.IO.File]::Open($file, [System.IO.FileMode]::Open, [System.IO.FileAccess]::Read, [System.IO.FileShare]::ReadWrite)
    try {
      $size = [int][Math]::Min($stream.Length, $limit)
      $buffer = New-Object byte[] $size
      $read = 0
      while ($read -lt $size) {
        $n = $stream.Read($buffer, $read, $size - $read)
        if ($n -le 0) { break }
        $read += $n
      }
      return [System.Text.Encoding]::UTF8.GetString($buffer, 0, $read)
    } finally { $stream.Dispose() }
  } catch { return '' }
}

$result = [ordered]@{ ok = $false; exitCode = $null; stdout = ''; stderr = ''; error = ''; processes = @(); files = @(); ms = 0 }
$startedAt = [DateTime]::UtcNow
try {
  $sample = Join-Path $root ('sample.' + [string]$job.ext)
  if (-not (Test-Path -LiteralPath $sample)) { throw 'The sample file was not delivered to the sandbox.' }
  switch ([string]$job.run) {
    'exe' {
      $exe = $sample
      $arguments = @()
    }
    'ps1' {
      $exe = Join-Path $env:SystemRoot 'System32\WindowsPowerShell\v1.0\powershell.exe'
      $arguments = @('-NoLogo', '-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-File', $sample)
    }
    'bat' {
      $exe = Join-Path $env:SystemRoot 'System32\cmd.exe'
      $arguments = @('/d', '/s', '/c', $sample)
    }
    'vbs' {
      $exe = Join-Path $env:SystemRoot 'System32\cscript.exe'
      $arguments = @('//nologo', '//E:vbscript', $sample)
    }
    'js' {
      $exe = Join-Path $env:SystemRoot 'System32\cscript.exe'
      $arguments = @('//nologo', '//E:jscript', $sample)
    }
    default { throw ('Cannot run this kind of sample: ' + [string]$job.run) }
  }
  $before = @{}
  Get-Process -ErrorAction SilentlyContinue | ForEach-Object { $before[[int]$_.Id] = 1 }
  $limit = [int]$job.timeLimit
  if ($limit -lt 1000) { $limit = 30000 }
  $process = Start-Process -FilePath $exe -ArgumentList $arguments -WorkingDirectory $work -RedirectStandardInput $stdin -RedirectStandardOutput $stdout -RedirectStandardError $stderr -NoNewWindow -PassThru
  $deadline = [DateTime]::UtcNow.AddMilliseconds($limit)
  $stopped = ''
  while (-not $process.HasExited) {
    if ([DateTime]::UtcNow -ge $deadline) { $stopped = 'Stopped after ' + [Math]::Round($limit / 1000) + ' seconds.'; break }
    $size = 0
    foreach ($file in @($stdout, $stderr)) {
      try { $size += (Get-Item -LiteralPath $file -ErrorAction Stop).Length } catch { }
    }
    if ($size -gt 262144) { $stopped = 'Stopped after reaching the 64 KB output limit.'; break }
    Start-Sleep -Milliseconds 100
    $process.Refresh()
  }
  if (-not $process.HasExited) {
    & (Join-Path $env:SystemRoot 'System32\taskkill.exe') /PID $process.Id /T /F | Out-Null
    try { [void]$process.WaitForExit(5000) } catch { }
  } else {
    try { [void]$process.WaitForExit() } catch { }
  }
  $exitCode = $null
  try { $exitCode = [int]$process.ExitCode } catch { }
  $result.exitCode = $exitCode
  $result.stdout = Read-Capped $stdout 65536
  $result.stderr = Read-Capped $stderr 65536
  if ($stopped) { $result.error = $stopped }
  elseif ($null -eq $exitCode) { $result.error = 'The sample did not report an exit code.' }
  elseif ($exitCode -ne 0) { $result.error = 'The sample exited with status ' + $exitCode + '.' }
  else { $result.ok = $true }
  $new = @()
  Get-Process -ErrorAction SilentlyContinue | Where-Object { -not $before.ContainsKey([int]$_.Id) } | ForEach-Object { $new += ($_.ProcessName + '.exe') }
  $result.processes = @($new | Sort-Object -Unique | Select-Object -First 40)
  $files = @()
  Get-ChildItem -LiteralPath $work -Recurse -File -ErrorAction SilentlyContinue | Select-Object -First 200 | ForEach-Object {
    $files += [ordered]@{ name = $_.Name; dir = $_.DirectoryName.Replace($work, '').TrimStart('\'); size = $_.Length }
  }
  $result.files = @($files)
} catch {
  $result.error = 'The sandbox runner failed: ' + $_.Exception.Message
} finally {
  $result.ms = [int]([DateTime]::UtcNow - $startedAt).TotalMilliseconds
  try {
    $tmp = Join-Path $out 'result.tmp'
    $json = $result | ConvertTo-Json -Compress -Depth 5
    [System.IO.File]::WriteAllText($tmp, $json, (New-Object System.Text.UTF8Encoding($false)))
    Move-Item -LiteralPath $tmp -Destination (Join-Path $out 'result.json') -Force
  } catch { }
  try { Remove-Item -LiteralPath $work -Recurse -Force -ErrorAction SilentlyContinue } catch { }
  try { Start-Process -FilePath (Join-Path $env:SystemRoot 'System32\shutdown.exe') -ArgumentList @('/s', '/t', '5', '/f') -WindowStyle Hidden | Out-Null } catch { }
}
`;

function sampleRunnerScript() { return SAMPLE_RUNNER; }

/* Write the sample bytes untouched, pick the interpreter from its type, and lay out the same read-only input folder and
   writable output folder the script runner uses. */
function prepareSample({ name, bytes, kind, script, input, root }) {
  let ext = '', run = '';
  if (kind === 'pe') {
    const m = /\.([a-z0-9]{1,8})$/i.exec(String(name || ''));
    ext = m && SAMPLE_PE.test(m[1]) && ['exe', 'com', 'scr', 'pif'].includes(m[1].toLowerCase()) ? m[1].toLowerCase() : 'exe';
    run = 'exe';
  } else {
    ext = SAMPLE_SCRIPT[script] || '';
    run = ext === 'ps1' ? 'ps1' : ext === 'bat' ? 'bat' : ext === 'vbs' ? 'vbs' : ext === 'js' ? 'js' : '';
  }
  if (!ext || !run) throw new Error('This kind of sample cannot run in Windows Sandbox.');
  if (!Buffer.isBuffer(bytes) || !bytes.length) throw new Error('The sample is empty.');
  const inputFolder = path.join(root, 'in');
  const outputFolder = path.join(root, 'out');
  fs.mkdirSync(inputFolder, { recursive: true });
  fs.mkdirSync(outputFolder, { recursive: true });
  fs.writeFileSync(path.join(inputFolder, 'sample.' + ext), bytes);
  fs.writeFileSync(path.join(inputFolder, 'stdin.txt'), String(input || ''), 'utf8');
  fs.writeFileSync(path.join(inputFolder, 'job.json'), JSON.stringify({ kind: 'sample', ext, run, timeLimit: RUN_TIME }), 'utf8');
  fs.writeFileSync(path.join(inputFolder, 'runner.ps1'), SAMPLE_RUNNER, 'utf8');
  const wsbPath = path.join(root, 'sandbox.wsb');
  fs.writeFileSync(wsbPath, wsbFor(inputFolder, outputFolder), 'utf8');
  return { inputFolder, outputFolder, wsbPath };
}

function normalizeSample(data) {
  const base = normalize(data);
  const list = (v, max, f) => (Array.isArray(v) ? v.slice(0, max).map(f).filter(Boolean) : []);
  return Object.assign(base, {
    backend: 'windows-sandbox',
    processes: list(data && data.processes, 40, p => typeof p === 'string' ? p.slice(0, 120) : ''),
    files: list(data && data.files, 200, f => f && typeof f.name === 'string'
      ? { name: f.name.slice(0, 120), dir: typeof f.dir === 'string' ? f.dir.slice(0, 160) : '', size: Number.isFinite(f.size) ? f.size : 0 } : null),
    ms: data && Number.isFinite(data.ms) ? data.ms : null,
  });
}

async function runSample({ name, bytes, kind, script, input }, signal) {
  if (!available()) {
    return {
      ok: false, unavailable: true,
      error: 'Windows Sandbox is not turned on, so the sample was not run. The Sample lab never runs a sample as your Windows user.',
    };
  }
  if (busy) return { ok: false, error: 'Another sandboxed program is still running.' };
  if (signal?.aborted) return { ok: false, error: 'Run stopped.' };
  busy = true;
  const root = path.join(os.tmpdir(), 'moundshroud-sandbox', randomUUID());
  let child = null;
  try {
    const job = prepareSample({ name, bytes, kind, script, input, root });
    if (signal?.aborted) return { ok: false, error: 'Run stopped.' };
    child = spawn(EXE, [job.wsbPath], { windowsHide: false, stdio: 'ignore' });
    let spawnError = null;
    child.on('error', error => { spawnError = error; });
    return await new Promise(resolve => {
      const started = Date.now();
      let finished = false, poll = null;
      const finish = result => {
        if (finished) return;
        finished = true;
        clearInterval(poll);
        signal?.removeEventListener('abort', abort);
        resolve(result);
      };
      const abort = () => finish({ ok: false, error: 'Run stopped.' });
      signal?.addEventListener('abort', abort, { once: true });
      poll = setInterval(() => {
        if (spawnError) return finish({ ok: false, unavailable: true, error: 'Windows Sandbox could not start: ' + spawnError.message });
        if (Date.now() - started > BOOT_TIME + RUN_TIME) return finish({ ok: false, error: 'Windows Sandbox did not return a result in time.' });
        const resultPath = path.join(job.outputFolder, 'result.json');
        let stat;
        try { stat = fs.lstatSync(resultPath); } catch (e) { return; }
        if (!stat.isFile() || stat.size > RESULT_LIMIT) return finish({ ok: false, error: 'Windows Sandbox returned an unreadable result.' });
        let data;
        try { data = JSON.parse(fs.readFileSync(resultPath, 'utf8')); } catch (e) { return; }
        finish(normalizeSample(data));
      }, 250);
    });
  } catch (error) {
    return { ok: false, error: error.message || String(error) };
  } finally {
    busy = false;
    await close(child, root);
  }
}

function prepare({ lang, code, input, root }) {
  const file = FILES[lang];
  if (!file) throw new Error('This language does not run in Windows Sandbox.');
  const inputFolder = path.join(root, 'in');
  const outputFolder = path.join(root, 'out');
  fs.mkdirSync(inputFolder, { recursive: true });
  fs.mkdirSync(outputFolder, { recursive: true });
  let text = String(code);
  if (file.crlf) text = text.replace(/\r?\n/g, '\r\n');
  fs.writeFileSync(path.join(inputFolder, file.name), (file.bom ? '\ufeff' : '') + text, 'utf8');
  fs.writeFileSync(path.join(inputFolder, 'stdin.txt'), String(input || ''), 'utf8');
  fs.writeFileSync(path.join(inputFolder, 'job.json'), JSON.stringify({ lang, timeLimit: RUN_TIME }), 'utf8');
  fs.writeFileSync(path.join(inputFolder, 'runner.ps1'), RUNNER, 'utf8');
  const wsbPath = path.join(root, 'sandbox.wsb');
  fs.writeFileSync(wsbPath, wsbFor(inputFolder, outputFolder), 'utf8');
  return { inputFolder, outputFolder, wsbPath };
}

function taskkill(pid) {
  return new Promise(done => {
    if (!pid) return done();
    execFile('taskkill', ['/pid', String(pid), '/T', '/F'], { windowsHide: true, timeout: 5000 }, () => done());
  });
}

/* The client process can hand the VM to another Windows Sandbox process, so also stop any of those whose command
   line names this run's private folder. Only processes mentioning the random folder are touched. */
function stopSandboxProcesses(root) {
  return new Promise(done => {
    if (!WIN) return done();
    const script = "$needle = " + JSON.stringify(root) + ";" +
      "$names = @('WindowsSandbox.exe','WindowsSandboxClient.exe','WindowsSandboxServer.exe','WindowsSandboxRemoteSession.exe');" +
      "Get-CimInstance Win32_Process -ErrorAction SilentlyContinue | Where-Object { $names -contains $_.Name -and $_.CommandLine -and $_.CommandLine.IndexOf($needle, [StringComparison]::OrdinalIgnoreCase) -ge 0 } | ForEach-Object { Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue }";
    const ps = path.join(SYS, 'System32', 'WindowsPowerShell', 'v1.0', 'powershell.exe');
    execFile(ps, ['-NoLogo', '-NoProfile', '-NonInteractive', '-Command', script], { windowsHide: true, timeout: 8000 }, () => done());
  });
}

async function close(child, root) {
  if (child) {
    try { child.kill(); } catch (e) { }
    await taskkill(child.pid);
  }
  await stopSandboxProcesses(root);
  for (let i = 0; i < 8; i++) {
    try { fs.rmSync(root, { recursive: true, force: true, maxRetries: 2, retryDelay: 150 }); return; } catch (e) { await sleep(200); }
  }
}

function normalize(data) {
  const text = value => typeof value === 'string' ? value.slice(0, OUTPUT_LIMIT) : '';
  return {
    ok: data && data.ok === true,
    exitCode: data && Number.isInteger(data.exitCode) ? data.exitCode : null,
    stdout: text(data && data.stdout),
    stderr: text(data && data.stderr),
    error: data && typeof data.error === 'string' ? data.error.slice(0, 2000) : '',
    backend: 'windows-sandbox',
  };
}

async function run({ lang, code, input }, signal) {
  if (!LANGS.has(lang)) return { ok: false, error: 'This language does not run in Windows Sandbox.' };
  if (!available()) {
    return {
      ok: false, unavailable: true,
      error: 'Windows Sandbox is not turned on, so Windows-native code is refused. The Playground never runs it as your Windows user.',
    };
  }
  if (busy) return { ok: false, error: 'Another sandboxed program is still running.' };
  if (signal?.aborted) return { ok: false, error: 'Run stopped.' };
  busy = true;
  const root = path.join(os.tmpdir(), 'moundshroud-sandbox', randomUUID());
  let child = null;
  try {
    const job = prepare({ lang, code, input, root });
    if (signal?.aborted) return { ok: false, error: 'Run stopped.' };
    child = spawn(EXE, [job.wsbPath], { windowsHide: false, stdio: 'ignore' });
    let spawnError = null;
    child.on('error', error => { spawnError = error; });
    return await new Promise(resolve => {
      const started = Date.now();
      let finished = false;
      let poll = null;
      const finish = result => {
        if (finished) return;
        finished = true;
        clearInterval(poll);
        signal?.removeEventListener('abort', abort);
        resolve(result);
      };
      const abort = () => finish({ ok: false, error: 'Run stopped.' });
      signal?.addEventListener('abort', abort, { once: true });
      poll = setInterval(() => {
        if (spawnError) {
          return finish({ ok: false, unavailable: true, error: 'Windows Sandbox could not start: ' + spawnError.message });
        }
        if (Date.now() - started > BOOT_TIME + RUN_TIME) {
          return finish({ ok: false, error: 'Windows Sandbox did not return a result in time.' });
        }
        const resultPath = path.join(job.outputFolder, 'result.json');
        let stat;
        try { stat = fs.lstatSync(resultPath); } catch (e) { return; }
        if (!stat.isFile() || stat.size > RESULT_LIMIT) {
          return finish({ ok: false, error: 'Windows Sandbox returned an unreadable result.' });
        }
        let data;
        try { data = JSON.parse(fs.readFileSync(resultPath, 'utf8')); } catch (e) { return; }
        finish(normalize(data));
      }, 250);
    });
  } catch (error) {
    return { ok: false, error: error.message || String(error) };
  } finally {
    busy = false;
    await close(child, root);
  }
}

module.exports = { LANGS, SAMPLE_SCRIPT, RUN_TIME, available, status, run, runSample, wsbFor, runnerScript, sampleRunnerScript };

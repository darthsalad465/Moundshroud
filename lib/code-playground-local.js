// TRUSTED DEVELOPMENT ONLY. This runner starts real compilers and scripts as the signed-in Windows user, with the
// account's files, network and permissions. It is not reachable from the browser API: lib/code-playground.js and
// server.js must never import it. Use lib/code-sandbox-windows.js (Windows-native scripts) or the Docker image
// (Linux toolchains) for code that came from the Playground or any other untrusted source.
//
// Coding › Playground on this PC: runs C, C++, x64 assembly (MASM), Rust, C#, F#, Visual Basic, TypeScript, Node.js,
// PowerShell, batch files, VBScript, JScript, Bash, Perl, AWK and sed with compilers and interpreters already installed
// here (Visual Studio's C++ tools, rustup, the .NET SDK, Node, Windows itself and Git for Windows). No window opens:
// each run gets a fresh temporary folder, starts its processes hidden, reads the Input box as stdin, and is stopped
// (with its whole process tree) after the time limit. There is no container: the program runs as the Windows user.
'use strict';
const fs = require('fs'), path = require('path'), os = require('os');
const { spawn, execFile, execFileSync } = require('child_process');
const { randomUUID } = require('crypto');
const { StringDecoder } = require('string_decoder');

const RUN_TIME = 30000, BUILD_TIME = 90000, OUTPUT_LIMIT = 64 * 1024;
const WIN = process.platform === 'win32';
const SYS = process.env.SystemRoot || 'C:\\Windows';
const exists = p => { try { return !!p && fs.existsSync(p); } catch (e) { return false; } };
function which(name) {
  const exts = WIN ? (process.env.PATHEXT || '.EXE;.CMD;.BAT').split(';') : [''];
  for (const dir of String(process.env.PATH || '').split(path.delimiter)) {
    if (!dir) continue;
    for (const e of [''].concat(exts)) { const p = path.join(dir.replace(/^"|"$/g, ''), name + e); if (exists(p) && fs.statSync(p).isFile()) return p; }
  }
  return null;
}
const newest = dir => { try { return fs.readdirSync(dir).filter(n => /^\d+(\.\d+)*$/.test(n)).sort((a, b) => { const x = a.split('.').map(Number), y = b.split('.').map(Number); for (let i = 0; i < Math.max(x.length, y.length); i++) { if ((x[i] || 0) !== (y[i] || 0)) return (x[i] || 0) - (y[i] || 0); } return 0; }).pop() || null; } catch (e) { return null; } };

/* ---------- finding the tools ---------- */
let cache = null, cacheAt = 0, vcEnv = null;
function find() {
  if (cache && Date.now() - cacheAt < 5 * 60 * 1000) return cache;
  const t = {};
  /* Visual Studio C++ tools */
  const vswhere = path.join(process.env['ProgramFiles(x86)'] || 'C:\\Program Files (x86)', 'Microsoft Visual Studio', 'Installer', 'vswhere.exe');
  if (WIN && exists(vswhere)) {
    try {
      const vs = execFileSync(vswhere, ['-latest', '-products', '*', '-requires', 'Microsoft.VisualStudio.Component.VC.Tools.x86.x64', '-property', 'installationPath'], { encoding: 'utf8', windowsHide: true, timeout: 10000 }).trim().split(/\r?\n/)[0];
      const bat = vs && path.join(vs, 'VC', 'Auxiliary', 'Build', 'vcvars64.bat');
      if (exists(bat)) t.vcvars = bat;
    } catch (e) { /* no C++ tools */ }
  }
  /* Rust */
  const cargoBin = path.join(os.homedir(), '.cargo', 'bin', WIN ? 'rustc.exe' : 'rustc');
  t.rustc = exists(cargoBin) ? cargoBin : which('rustc');
  /* .NET SDK: dotnet, the Roslyn compilers and the reference assemblies */
  const dotnetRoot = WIN ? path.join(process.env.ProgramFiles || 'C:\\Program Files', 'dotnet') : '/usr/share/dotnet';
  t.dotnet = exists(path.join(dotnetRoot, WIN ? 'dotnet.exe' : 'dotnet')) ? path.join(dotnetRoot, WIN ? 'dotnet.exe' : 'dotnet') : which('dotnet');
  if (t.dotnet) {
    const root = path.dirname(t.dotnet), sdk = newest(path.join(root, 'sdk')), ref = newest(path.join(root, 'packs', 'Microsoft.NETCore.App.Ref'));
    if (sdk && ref) {
      const bin = path.join(root, 'sdk', sdk, 'Roslyn', 'bincore'), refDir = path.join(root, 'packs', 'Microsoft.NETCore.App.Ref', ref, 'ref');
      let tfm = null; try { tfm = fs.readdirSync(refDir).filter(n => /^net\d+\.\d+$/.test(n)).sort((a, b) => parseFloat(a.slice(3)) - parseFloat(b.slice(3))).pop() || null; } catch (e) { /* no reference assemblies */ }
      if (tfm && exists(path.join(bin, 'csc.dll'))) {
        t.csc = path.join(bin, 'csc.dll'); t.vbc = exists(path.join(bin, 'vbc.dll')) ? path.join(bin, 'vbc.dll') : null;
        t.refs = path.join(refDir, tfm); t.tfm = tfm; t.runtime = ref.split('.').slice(0, 2).join('.') + '.0';
      }
      t.fsi = exists(path.join(root, 'sdk', sdk, 'FSharp', 'fsi.dll')) ? path.join(root, 'sdk', sdk, 'FSharp', 'fsi.dll') : null;
    }
  }
  /* Node runs TypeScript itself from version 22.6 */
  t.node = process.execPath;
  const [maj, min] = process.versions.node.split('.').map(Number);
  t.ts = maj > 22 || (maj === 22 && min >= 6);
  /* Windows */
  t.powershell = which('pwsh') || (exists(path.join(SYS, 'System32', 'WindowsPowerShell', 'v1.0', 'powershell.exe')) ? path.join(SYS, 'System32', 'WindowsPowerShell', 'v1.0', 'powershell.exe') : null);
  t.cmd = WIN ? (process.env.ComSpec || path.join(SYS, 'System32', 'cmd.exe')) : null;
  t.cscript = WIN && exists(path.join(SYS, 'System32', 'cscript.exe')) ? path.join(SYS, 'System32', 'cscript.exe') : null;
  t.vbscript = t.cscript && exists(path.join(SYS, 'System32', 'vbscript.dll'));
  t.jscript = t.cscript && exists(path.join(SYS, 'System32', 'jscript.dll'));
  /* Git for Windows brings Bash, Perl, AWK and sed */
  let gitRoot = null;
  const git = which('git');
  if (git) { const d = path.dirname(git); gitRoot = /\\(cmd|bin)$/i.test(d) ? path.dirname(d) : null; if (gitRoot && /\\mingw64$/i.test(gitRoot)) gitRoot = path.dirname(gitRoot); }
  if (!gitRoot || !exists(path.join(gitRoot, 'usr', 'bin'))) gitRoot = ['C:\\Program Files\\Git', path.join(os.homedir(), 'AppData', 'Local', 'Programs', 'Git')].find(p => exists(path.join(p, 'usr', 'bin'))) || null;
  const gu = n => gitRoot && exists(path.join(gitRoot, 'usr', 'bin', n)) ? path.join(gitRoot, 'usr', 'bin', n) : null;
  t.bash = gitRoot && exists(path.join(gitRoot, 'bin', 'bash.exe')) ? path.join(gitRoot, 'bin', 'bash.exe') : (!WIN ? which('bash') : null);
  t.perl = gu('perl.exe') || (!WIN ? which('perl') : null);
  t.awk = gu('gawk.exe') || gu('awk.exe') || (!WIN ? which('awk') : null);
  t.sed = gu('sed.exe') || (!WIN ? which('sed') : null);
  t.gitUsr = gitRoot ? path.join(gitRoot, 'usr', 'bin') : null;
  cache = t; cacheAt = Date.now();
  return t;
}

/* the environment Visual Studio's vcvars64.bat sets up (PATH, INCLUDE, LIB), read once */
function vcEnvironment(t) {
  if (vcEnv) return Promise.resolve(vcEnv);
  return new Promise((resolve, reject) => {
    execFile(t.cmd, ['/d /s /c ""' + t.vcvars + '" >nul && set"'], { windowsHide: true, timeout: 60000, maxBuffer: 4 * 1024 * 1024, windowsVerbatimArguments: true }, (err, out) => {
      if (err) return reject(new Error('Visual Studio\'s C++ setup (vcvars64.bat) did not run: ' + err.message));
      const env = {};
      out.split(/\r?\n/).forEach(l => { const k = l.indexOf('='); if (k > 0) env[l.slice(0, k)] = l.slice(k + 1); });
      if (!env.INCLUDE) return reject(new Error('Visual Studio\'s C++ setup gave no INCLUDE folder.'));
      vcEnv = env; resolve(env);
    });
  });
}

/* language → files and steps. Each step: [exe, args, {build, env, stdin}] */
const RUNNERS = {
  c: { needs: t => t.vcvars, file: 'main.c', vc: true, steps: () => [['cl.exe', ['/nologo', '/utf-8', '/std:c17', '/O2', '/W3', 'main.c', '/Fe:main.exe'], { build: true }], ['main.exe', []]] },
  cpp: { needs: t => t.vcvars, file: 'main.cpp', vc: true, steps: () => [['cl.exe', ['/nologo', '/utf-8', '/std:c++20', '/EHsc', '/O2', '/W3', 'main.cpp', '/Fe:main.exe'], { build: true }], ['main.exe', []]] },
  masm: { needs: t => t.vcvars, file: 'main.asm', vc: true, steps: () => [['ml64.exe', ['/nologo', '/Fe', 'main.exe', 'main.asm', '/link', '/subsystem:console', '/entry:main', 'kernel32.lib'], { build: true }], ['main.exe', []]] },
  rust: { needs: t => t.rustc, file: 'main.rs', steps: t => [[t.rustc, ['--edition=2021', '-o', 'main.exe', 'main.rs'], { build: true }], ['main.exe', []]] },
  csharp: {
    needs: t => t.csc, file: 'Program.cs',
    prepare: (t, dir) => {
      fs.writeFileSync(path.join(dir, 'Usings.cs'), ['System', 'System.Collections.Generic', 'System.IO', 'System.Linq', 'System.Text', 'System.Threading.Tasks'].map(n => 'global using ' + n + ';').join('\n'));
      fs.writeFileSync(path.join(dir, 'refs.rsp'), fs.readdirSync(t.refs).filter(n => n.endsWith('.dll')).map(n => '-r:"' + path.join(t.refs, n) + '"').join('\n'));
      fs.writeFileSync(path.join(dir, 'main.runtimeconfig.json'), JSON.stringify({ runtimeOptions: { tfm: t.tfm, framework: { name: 'Microsoft.NETCore.App', version: t.runtime } } }));
    },
    steps: t => [[t.dotnet, [t.csc, '-nologo', '-target:exe', '-out:main.dll', '-langversion:latest', '-nullable:enable', '-optimize+', '@refs.rsp', 'Usings.cs', 'Program.cs'], { build: true }], [t.dotnet, ['main.dll']]],
  },
  vbnet: {
    needs: t => t.vbc, file: 'Program.vb',
    prepare: (t, dir) => {
      fs.writeFileSync(path.join(dir, 'refs.rsp'), fs.readdirSync(t.refs).filter(n => n.endsWith('.dll')).map(n => '-r:"' + path.join(t.refs, n) + '"').join('\n'));
      fs.writeFileSync(path.join(dir, 'main.runtimeconfig.json'), JSON.stringify({ runtimeOptions: { tfm: t.tfm, framework: { name: 'Microsoft.NETCore.App', version: t.runtime } } }));
    },
    steps: t => [[t.dotnet, [t.vbc, '-nologo', '-nostdlib', '-define:_MYTYPE="Empty"', '-sdkpath:' + t.refs, '-vbruntime:' + path.join(t.refs, 'Microsoft.VisualBasic.Core.dll'), '-imports:System,System.Collections.Generic,System.Linq', '-target:exe', '-out:main.dll', '@refs.rsp', 'Program.vb'], { build: true }], [t.dotnet, ['main.dll']]],
  },
  fsharp: { needs: t => t.fsi, file: 'main.fsx', steps: t => [[t.dotnet, [t.fsi, '--nologo', '--quiet', '--exec', 'main.fsx']]] },
  typescript: { needs: t => t.ts, file: 'main.ts', steps: t => [[t.node, ['--experimental-transform-types', '--disable-warning=ExperimentalWarning', 'main.ts']]] },
  nodejs: { needs: t => t.node, file: 'main.js', steps: t => [[t.node, ['main.js']]] },
  powershell: { needs: t => t.powershell, file: 'main.ps1', bom: true, steps: t => [[t.powershell, ['-NoLogo', '-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-File', 'main.ps1']]] },
  batch: { needs: t => t.cmd, file: 'main.bat', crlf: true, steps: t => [[t.cmd, ['/d', '/c', '.\\main.bat']]] }, /* .\ because cmd may not search the current folder */
  vbscript: { needs: t => t.vbscript, file: 'main.vbs', steps: t => [[t.cscript, ['//nologo', '//E:vbscript', 'main.vbs']]] },
  jscript: { needs: t => t.jscript, file: 'main.js', steps: t => [[t.cscript, ['//nologo', '//E:jscript', 'main.js']]] },
  bash: { needs: t => t.bash, file: 'main.sh', steps: t => [[t.bash, ['--noprofile', '--norc', 'main.sh']]] },
  perl: { needs: t => t.perl, file: 'main.pl', steps: t => [[t.perl, ['main.pl']]] },
  awk: { needs: t => t.awk, file: 'main.awk', steps: t => [[t.awk, ['-f', 'main.awk']]] },
  sed: { needs: t => t.sed, file: 'main.sed', steps: t => [[t.sed, ['-f', 'main.sed']]] },
};
const LANGS = new Set(Object.keys(RUNNERS));

/* which languages can run here, for the Playground's language list */
function status() {
  const t = find(), out = {};
  for (const [id, r] of Object.entries(RUNNERS)) out[id] = !!r.needs(t);
  return out;
}
const available = lang => RUNNERS[lang] && !!RUNNERS[lang].needs(find());

function killTree(child) {
  if (!child || child.exitCode !== null) return;
  if (WIN) execFile('taskkill', ['/pid', String(child.pid), '/T', '/F'], { windowsHide: true }, () => { });
  else try { child.kill('SIGKILL'); } catch (e) { /* gone */ }
}

function step(exe, args, opts, dir, env, input, signal, budget) {
  return new Promise(resolve => {
    let child;
    try { child = spawn(exe, args, { cwd: dir, env, windowsHide: true, stdio: 'pipe', windowsVerbatimArguments: false }); }
    catch (e) { return resolve({ code: -1, stdout: '', stderr: '', error: e.message }); }
    const out = { stdout: '', stderr: '' }; let bytes = 0, stopped = '', spawnError = null;
    const stop = reason => { if (stopped) return; stopped = reason; killTree(child); };
    const timer = setTimeout(() => stop('Stopped after ' + Math.round(budget / 1000) + ' seconds.'), budget);
    const onAbort = () => stop('Run stopped.');
    signal?.addEventListener('abort', onAbort, { once: true });
    for (const s of ['stdout', 'stderr']) {
      const dec = new StringDecoder('utf8');
      child[s].on('data', chunk => {
        const room = Math.max(0, OUTPUT_LIMIT - bytes);
        out[s] += dec.write(chunk.subarray(0, room)); bytes += chunk.length;
        if (bytes > OUTPUT_LIMIT) stop('Stopped after reaching the 64 KB output limit.');
      });
      child[s].on('end', () => { out[s] += dec.end(); });
    }
    child.stdin.on('error', () => { });
    child.on('error', e => { spawnError = e; });
    child.on('close', code => {
      clearTimeout(timer); signal?.removeEventListener('abort', onAbort);
      resolve({ code, stdout: out.stdout.replace(/\r\n/g, '\n'), stderr: out.stderr.replace(/\r\n/g, '\n'), stopped, error: spawnError ? spawnError.message : '' });
    });
    child.stdin.end(opts && opts.build ? '' : input);
  });
}

async function run({ lang, code, input }, signal) {
  const r = RUNNERS[lang], t = find();
  if (!r) return { ok: false, error: 'This language does not run with tools on this PC.' };
  if (!r.needs(t)) return { ok: false, unavailable: true, error: 'The tools for this language are not installed on this PC.' };
  const dir = path.join(os.tmpdir(), 'moundshroud-play', randomUUID());
  fs.mkdirSync(dir, { recursive: true });
  try {
    let text = String(code);
    if (r.crlf) text = text.replace(/\r?\n/g, '\r\n');
    fs.writeFileSync(path.join(dir, r.file), (r.bom ? '\ufeff' : '') + text);
    if (r.prepare) r.prepare(t, dir);
    let env = Object.assign({}, process.env, { DOTNET_CLI_TELEMETRY_OPTOUT: '1', DOTNET_NOLOGO: '1', DOTNET_SKIP_FIRST_TIME_EXPERIENCE: '1', NO_COLOR: '1' });
    if (r.vc) env = Object.assign({}, env, await vcEnvironment(t));
    if (lang === 'bash' || lang === 'perl' || lang === 'awk' || lang === 'sed') { env.LANG = 'C.UTF-8'; if (t.gitUsr) env.PATH = t.gitUsr + path.delimiter + env.PATH; }
    const steps = r.steps(t);
    let ran = null;
    for (const [exe0, args, opts] of steps) {
      if (signal?.aborted) return { ok: false, error: 'Run stopped.' };
      const exe = exe0 === 'main.exe' ? path.join(dir, exe0) : exe0; /* cl.exe and ml64.exe are found on the PATH vcvars64.bat set */
      const res = await step(exe, args, opts, dir, env, String(input || ''), signal, opts && opts.build ? BUILD_TIME : RUN_TIME);
      if (res.stopped) return { ok: false, stdout: opts && opts.build ? '' : res.stdout, stderr: res.stderr, error: res.stopped };
      if (res.error && res.code === null) return { ok: false, error: res.error };
      if (opts && opts.build) {
        if (res.code !== 0) {
          const msg = (res.stdout + '\n' + res.stderr).split('\n').filter(l => l.trim() && !/^(main\.\w+|Program\.\w+|Microsoft \(R\)|Copyright \(C\)|\s*Assembling: main\.asm)$/i.test(l.trim())).join('\n').split(dir + path.sep).join('').trim();
          return { ok: false, stderr: msg, error: 'The build failed.' };
        }
        continue;
      }
      ran = res;
    }
    return { ok: ran.code === 0, stdout: ran.stdout, stderr: ran.stderr.split(dir + path.sep).join(''), error: ran.code === 0 ? '' : 'Program exited with status ' + ran.code + '.' };
  } catch (e) {
    return { ok: false, error: e.message };
  } finally {
    fs.rm(dir, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 }, () => { });
  }
}

module.exports = { LANGS, RUNNERS, status, available, run, find };

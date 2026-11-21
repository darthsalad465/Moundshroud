// Coding › Playground runner for POST /api/code-playground/run. Native code only runs in a real isolation boundary:
// Windows Sandbox (lib/code-sandbox-windows.js) for Windows-native scripts, or the Playground's Docker image for
// Linux toolchains. When neither backend is ready the run is refused; lib/code-playground-local.js is deliberately
// not imported here, because it runs programs as the signed-in Windows user.
'use strict';

const { spawn, execFile, execFileSync } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');
const { randomUUID } = require('node:crypto');
const { StringDecoder } = require('node:string_decoder');
const sandbox = require('./code-sandbox-windows');

const IMAGE = 'moundshroud-code-playground:1';
/* the languages the optional Docker image (lib/code-playground/run.sh) can run */
const LANGS = new Set(['bash', 'powershell', 'c', 'cpp', 'holyc', 'java', 'csharp', 'go',
  'rust', 'typescript', 'kotlin', 'swift', 'php', 'ruby', 'lua', 'asm']);
const SANDBOX = new Set(sandbox.LANGS);
const NATIVE = new Set([...LANGS, ...SANDBOX]);
const TIME_LIMIT = 30_000;
const OUTPUT_LIMIT = 64 * 1024;
const environment = { ...process.env };
delete environment.DOCKER_CONTEXT;
let busy = false;
let dockerCache = null, dockerAt = 0;

function validate(input) {
  return !!input && NATIVE.has(input.lang) && typeof input.code === 'string' &&
    Buffer.byteLength(input.code) <= 200_000 && !!input.code.trim() &&
    (input.input === undefined || (typeof input.input === 'string' && Buffer.byteLength(input.input) <= 100_000));
}

function dockerPath() {
  const exts = process.platform === 'win32' ? ['.exe', '.cmd', '.bat'] : [''];
  for (const dir of String(process.env.PATH || '').split(path.delimiter)) {
    if (!dir) continue;
    for (const ext of exts) {
      const file = path.join(dir.replace(/^"|"$/g, ''), 'docker' + ext);
      try { if (fs.statSync(file).isFile()) return file; } catch (e) { }
    }
  }
  return null;
}

const quoteCmd = value => '"' + String(value).replace(/"/g, '""') + '"';
function dockerInvocation(args) {
  const exe = dockerPath();
  if (!exe) return null;
  if (/\.(cmd|bat)$/i.test(exe)) {
    const line = [exe, ...args].map(quoteCmd).join(' ');
    return {
      file: process.env.ComSpec || 'cmd.exe',
      args: ['/d', '/s', '/c', '"' + line + '"'],
      windowsVerbatimArguments: true,
    };
  }
  return { file: exe, args, windowsVerbatimArguments: false };
}

function dockerCall(args, timeout) {
  const inv = dockerInvocation(args);
  if (!inv) throw new Error('Docker is not installed.');
  return execFileSync(inv.file, inv.args, {
    env: environment, windowsHide: true, timeout, stdio: 'ignore',
    windowsVerbatimArguments: inv.windowsVerbatimArguments,
  });
}

/* Installed, engine running, and the Playground image built. Kept for 30 seconds so opening the page is quick. */
function dockerStatus() {
  const now = Date.now();
  if (dockerCache && now - dockerAt < 30_000) return dockerCache;
  const out = {
    installed: !!dockerPath(), running: false, image: false, ready: false,
    languages: [...LANGS], reason: '',
  };
  if (out.installed) {
    try { dockerCall(['version', '--format', '{{.Server.Version}}'], 3000); out.running = true; } catch (e) { }
    if (out.running) {
      try { dockerCall(['image', 'inspect', IMAGE], 3000); out.image = true; } catch (e) { }
    }
  }
  out.ready = out.installed && out.running && out.image;
  out.reason = out.ready ? '' : !out.installed ? 'Docker is not installed.'
    : !out.running ? 'Docker is installed, but its engine is not running.'
      : 'Docker is running, but the Playground image is not built.';
  dockerCache = out; dockerAt = now;
  return out;
}

/* 'windows-sandbox', 'docker', or '' when neither can contain this language. */
function backendFor(lang, sb, dk) {
  if (SANDBOX.has(lang) && sb.available) return 'windows-sandbox';
  if (LANGS.has(lang) && dk.ready) return 'docker';
  return '';
}

function unavailableText(lang, dk) {
  const windowsOnly = SANDBOX.has(lang) && !LANGS.has(lang);
  if (windowsOnly) {
    return 'Windows Sandbox is not turned on, so Windows-native code is refused. The Playground never runs it as your Windows user.';
  }
  if (LANGS.has(lang)) {
    if (!dk.installed) {
      return 'Docker is not installed, so this language is refused. The Playground never runs native code as your Windows user.' +
        (SANDBOX.has(lang) ? ' Windows Sandbox is not turned on either.' : '');
    }
    if (!dk.running) return 'Docker is installed but its engine is not running, so this language is refused.';
    if (!dk.image) return 'The Playground\'s Docker image is not built, so this language is refused.';
  }
  return 'This language has no safe sandbox on this PC, so it is refused. The Playground never runs native code as your Windows user.';
}

/* what can run: the safe backends and, per language, which one is ready (GET /api/code-playground/status) */
function status() {
  const sb = sandbox.status(), dk = dockerStatus();
  const backend = {};
  for (const lang of NATIVE) {
    const b = backendFor(lang, sb, dk);
    if (b) backend[lang] = b;
  }
  return { sandbox: sb, docker: dk, dockerInstalled: dk.installed, backend };
}

function removeContainer(name, done) {
  const inv = dockerInvocation(['rm', '-f', name]);
  if (!inv) return done();
  execFile(inv.file, inv.args, {
    env: environment, windowsHide: true, timeout: 5000,
    windowsVerbatimArguments: inv.windowsVerbatimArguments,
  }, () => done());
}

async function runDocker({ lang, code, input }, signal) {
  const dk = dockerStatus();
  if (!dk.ready) return { ok: false, unavailable: true, error: unavailableText(lang, dk) };
  if (signal?.aborted) return { ok: false, error: 'Run stopped.' };
  const name = 'moundshroud-playground-' + randomUUID();
  const args = ['run', '--rm', '--interactive', '--name', name, '--pull=never',
    '--platform=linux/amd64', '--network=none', '--read-only', '--cap-drop=ALL',
    '--security-opt=no-new-privileges', '--user=65534:65534', '--pids-limit=128',
    '--memory=1g', '--memory-swap=1g', '--cpus=2', '--ulimit', 'core=0',
    '--log-driver=none', '--tmpfs', '/work:rw,exec,nosuid,nodev,size=256m,mode=1777',
    '--tmpfs', '/tmp:rw,noexec,nosuid,nodev,size=128m,mode=1777', IMAGE, lang];
  const inv = dockerInvocation(args);
  if (!inv) return { ok: false, unavailable: true, error: 'Docker is not installed.' };
  const source = Buffer.from(String(code), 'utf8');
  const extra = Buffer.from(String(input || ''), 'utf8');

  return await new Promise(resolve => {
    const child = spawn(inv.file, inv.args, {
      env: environment, windowsHide: true, stdio: 'pipe',
      windowsVerbatimArguments: inv.windowsVerbatimArguments,
    });
    const output = { stdout: '', stderr: '' };
    let bytes = 0, stopped = '', spawnError;
    function stop(reason) {
      if (stopped) return;
      stopped = reason;
      try { child.kill(); } catch (e) { }
    }
    const abort = () => stop('Run stopped.');
    const timeout = setTimeout(() => stop('Stopped after 30 seconds.'), TIME_LIMIT);
    signal?.addEventListener('abort', abort, { once: true });
    for (const stream of ['stdout', 'stderr']) {
      const decoder = new StringDecoder('utf8');
      child[stream].on('data', chunk => {
        const remaining = Math.max(0, OUTPUT_LIMIT - bytes);
        output[stream] += decoder.write(chunk.subarray(0, remaining));
        bytes += chunk.length;
        if (bytes > OUTPUT_LIMIT) stop('Stopped after reaching the 64 KB output limit.');
      });
      child[stream].on('end', () => { output[stream] += decoder.end(); });
    }
    child.stdin.on('error', () => { }); // Docker may exit before reading stdin.
    child.on('error', error => { spawnError = error; });
    child.on('close', exitCode => {
      clearTimeout(timeout);
      signal?.removeEventListener('abort', abort);
      if (stopped) {
        return removeContainer(name, () => resolve({ ...output, ok: false, error: stopped, backend: 'docker' }));
      }
      if (spawnError?.code === 'ENOENT' || exitCode === 125) {
        const text = output.stderr;
        let error;
        if (spawnError?.code === 'ENOENT' || /Unable to find image|No such image|pull access denied/i.test(text)) {
          error = 'The Docker Playground image is not built. Build it once with: docker build --platform=linux/amd64 -t ' + IMAGE + ' lib/code-playground';
        } else if (/Cannot connect to the Docker daemon|error during connect|Is the docker daemon running|permission denied/i.test(text)) {
          error = 'Docker is installed, but its engine is not running.';
        } else {
          error = 'The Docker sandbox could not start.';
        }
        dockerCache = null;
        return resolve({ ...output, ok: false, unavailable: true, error, backend: 'docker' });
      }
      if (spawnError) return resolve({ ...output, ok: false, error: spawnError.message, backend: 'docker' });
      resolve({
        ...output,
        ok: exitCode === 0,
        error: exitCode === 0 ? '' : 'Program exited with status ' + exitCode + '.',
        backend: 'docker',
      });
    });
    child.stdin.end(Buffer.concat([
      Buffer.from(source.length + ' ' + extra.length + '\n'),
      source,
      extra,
    ])); /* worker reads the envelope, then feeds the second part to the program as stdin */
  });
}

async function run({ lang, code, input }, signal) {
  if (!validate({ lang, code, input })) {
    return { ok: false, error: 'Choose a supported sandboxed language and enter up to 200 KB of code.' };
  }
  if (busy) return { ok: false, error: 'Another Playground program is still running.' };
  const sb = sandbox.status(), dk = dockerStatus();
  const backend = backendFor(lang, sb, dk);
  if (!backend) return { ok: false, unavailable: true, error: unavailableText(lang, dk) };
  if (signal?.aborted) return { ok: false, error: 'Run stopped.' };
  busy = true;
  try {
    if (backend === 'windows-sandbox') return await sandbox.run({ lang, code, input }, signal);
    return await runDocker({ lang, code, input }, signal);
  } finally {
    busy = false;
  }
}

module.exports = { LANGS, SANDBOX, validate, run, status };

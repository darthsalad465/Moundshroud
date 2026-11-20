// Coding › Playground runner for POST /api/code-playground/run. Languages with tools on this PC run through
// lib/code-playground-local.js; the rest of the native languages run in the optional Docker image built from
// lib/code-playground (no network, read-only, unprivileged user, memory and process limits).
'use strict';

const { spawn, execFile } = require('node:child_process');
const local = require('./code-playground-local');
const { randomUUID } = require('node:crypto');
const { StringDecoder } = require('node:string_decoder');

const IMAGE = 'moundshroud-code-playground:1';
const LANGS = new Set(['bash', 'powershell', 'c', 'cpp', 'holyc', 'java', 'csharp', 'go',
  'rust', 'typescript', 'kotlin', 'swift', 'php', 'ruby', 'lua', 'asm']);
const LOCAL = process.platform === 'win32' ? 'npipe:////./pipe/docker_engine' : 'unix:///var/run/docker.sock';
const DOCKER = ['--host', LOCAL];
const environment = { ...process.env };
delete environment.DOCKER_CONTEXT;
const TIME_LIMIT = 30_000;
const OUTPUT_LIMIT = 64 * 1024;
let busy = false;

function validate(input) {
  return input && (LANGS.has(input.lang) || local.LANGS.has(input.lang)) && typeof input.code === 'string' &&
    Buffer.byteLength(input.code) <= 200_000 && input.code.trim() &&
    (input.input === undefined || (typeof input.input === 'string' && Buffer.byteLength(input.input) <= 100_000));
}

/* what can run: local tools per language, and whether Docker is installed (GET /api/code-playground/status) */
function status() {
  return { local: local.status(), docker: [...LANGS], dockerInstalled: dockerFound() };
}
function dockerFound() {
  const exts = process.platform === 'win32' ? ['.exe', '.cmd'] : [''];
  const path = require('node:path'), fs = require('node:fs');
  return String(process.env.PATH || '').split(path.delimiter).some(d => d && exts.some(e => fs.existsSync(path.join(d, 'docker' + e))));
}

async function run({ lang, code, input }, signal) {
  if (!validate({ lang, code, input })) return { ok: false, error: 'Choose a supported language and enter up to 200 KB of code.' };
  if (busy) return { ok: false, error: 'Another Playground program is still running.' };
  if (local.available(lang)) {
    busy = true;
    try { return await local.run({ lang, code, input }, signal); } finally { busy = false; }
  }
  if (!LANGS.has(lang)) return { ok: false, unavailable: true, error: 'The tools for this language are not installed on this PC.' };
  if (signal?.aborted) return { ok: false, error: 'Run stopped.' };
  busy = true;
  const name = 'moundshroud-playground-' + randomUUID();
  const args = [...DOCKER, 'run', '--rm', '--interactive', '--name', name, '--pull=never',
    '--platform=linux/amd64', '--network=none', '--read-only', '--cap-drop=ALL',
    '--security-opt=no-new-privileges', '--user=65534:65534', '--pids-limit=128',
    '--memory=1g', '--memory-swap=1g', '--cpus=2', '--ulimit', 'core=0',
    '--log-driver=none', '--tmpfs', '/work:rw,exec,nosuid,nodev,size=256m,mode=1777',
    '--tmpfs', '/tmp:rw,noexec,nosuid,nodev,size=128m,mode=1777', IMAGE, lang];

  try {
    return await new Promise(resolve => {
      const child = spawn('docker', args, { env: environment, windowsHide: true, stdio: 'pipe' });
      const output = { stdout: '', stderr: '' };
      let bytes = 0, stopped = '', spawnError;
      function stop(reason) {
        if (stopped) return;
        stopped = reason;
        child.kill();
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
      child.stdin.on('error', () => {}); // Docker may exit before reading stdin.
      child.on('error', error => { spawnError = error; });
      child.on('close', exitCode => {
        clearTimeout(timeout);
        signal?.removeEventListener('abort', abort);
        if (stopped) {
          return execFile('docker', [...DOCKER, 'rm', '-f', name],
            { env: environment, windowsHide: true, timeout: 5000 }, () => resolve({ ...output, ok: false, error: stopped }));
        }
        if (spawnError?.code === 'ENOENT' || (exitCode === 125 && /^(docker:|Error response from daemon:)/m.test(output.stderr))) {
          return resolve({ ...output, ok: false, unavailable: true, error: 'The local Playground runtime is unavailable. See Local runtime setup.' });
        }
        if (spawnError) return resolve({ ...output, ok: false, error: spawnError.message });
        resolve({ ...output, ok: exitCode === 0, error: exitCode === 0 ? '' : 'Program exited with status ' + exitCode + '.' });
      });
      child.stdin.end(code); /* the Docker launcher reads the program from stdin, so the Input box is not passed */
    });
  } finally {
    busy = false;
  }
}

module.exports = { LANGS, validate, run, status };

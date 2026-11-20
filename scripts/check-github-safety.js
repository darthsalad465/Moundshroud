#!/usr/bin/env node
'use strict';

// Local pre-push and GitHub Actions guard for accidental private files and common credentials.
const { execFileSync } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const ZERO = /^0+$/;
const ROOT_FILES = new Set([
  '.gitignore', 'README.md', 'START-HERE.txt', 'SNAPSHOTS.txt', 'VERSION', 'LICENSE', 'server.js', 'Listener.cs',
  'setup.ps1', 'Setup-Moundshroud.bat', 'make-release.ps1', 'open-moundshroud.ps1', 'ocr.ps1', 'pc-volume.ps1',
  'snapshot.ps1', 'restore-snapshot.ps1', 'apply-update.ps1', 'update.json', 'publish-update.ps1', 'RELEASE-NOTES.txt',
  'restore-progress.ps1', 'install-art-model.ps1', 'install-music-model.ps1', 'install-video-model.ps1', 'install-gateway.ps1',
  'install-song-tools.ps1', 'install-godot.ps1', 'install-godot-templates.ps1', 'install-mcode.ps1', 'requirements.txt'
]);
const SCRIPT_FILES = new Set([
  'scripts/auto-commit.ps1', 'scripts/finetune.py', 'scripts/forge_convert.py', 'scripts/forge_train.py', 'scripts/ft-setup.ps1',
  'scripts/update-readme.js', 'scripts/check-github-safety.js', 'scripts/install-git-safety.ps1', 'scripts/install-micro-repos.ps1',
  'scripts/install-micro-repos.ps1'
]);
const SAFE_DATA = new Set(['data/cmudict.dict', 'data/cmudict-LICENSE.txt']);
const SOURCE_DIRS = ['lib/', 'agent/', 'bin/', 'py/', 'web/', 'tests/', 'desktop/'];
const PRIVATE_NAME = /(^|\/)(?:\.env(?:\..*)?|secrets?|credentials?|id_rsa[^/]*|id_ed25519[^/]*|cookies?|browser[-_ ]?profile|chat[-_ ]?history|password[-_ ]?vault|personal[-_ ]?data|user[-_ ]?data|backups?|snapshots?|mailboxes?)(\/|$)|(^|\/)(?:chat[-_ ]?history|password[-_ ]?vault|personal[-_ ]?data|user[-_ ]?data|backup|snapshot)[-_][^/]*\.(?:json|txt|zip|db|sqlite|bak|backup)$/i;
const PRIVATE_EXTENSION = /\.(?:sqlite3?|db|log|bak|backup|pem|key|p12|pfx|jks|kdbx|gguf|safetensors|onnx|exe|dll|pdb|mp3|wav|m4a|mp4|mov|mkv|webm|flac)$/i;
const MAX_FILE_BYTES = 50 * 1024 * 1024;
const SECRET_PATTERN = '(-----BEGIN (RSA |EC |OPENSSH |DSA )?PRIVATE KEY-----|gh[pousr]_[A-Za-z0-9_]{30,}|github_pat_[A-Za-z0-9_]{35,}|AKIA[0-9A-Z]{16}|AIza[0-9A-Za-z_-]{30,}|xox[baprs]-[A-Za-z0-9-]{15,}|sk-(ant|proj|live)?[-_][A-Za-z0-9_-]{24,}|(api[_-]?key|access[_-]?token|client[_-]?secret|password)[[:space:]]*[:=][[:space:]]*["\\x27][A-Za-z0-9/+_=-]{24,}["\\x27])';

function git(args, options = {}) {
  const settings = { cwd: root, encoding: options.encoding === undefined ? 'utf8' : options.encoding, maxBuffer: 64 * 1024 * 1024 };
  if (options.input !== undefined) settings.input = options.input;
  else settings.stdio = ['ignore', 'pipe', 'pipe'];
  return execFileSync('git', args, settings);
}
function fail(message) { throw new Error(message); }
function allowedPath(file) {
  const normalized = file.replace(/\\/g, '/');
  if (ROOT_FILES.has(normalized) || SCRIPT_FILES.has(normalized) || SAFE_DATA.has(normalized)) return true;
  if (normalized === '.dev/settings.json' || normalized === '.githooks/pre-push') return true;
  if (normalized === '.github/workflows/refresh-readme.yml' || normalized === '.github/workflows/github-safety.yml') return true;
  if (normalized === '.github/workflows/build-installer.yml') return true;
  if (PRIVATE_NAME.test(normalized) || PRIVATE_EXTENSION.test(normalized)) return false;
  return SOURCE_DIRS.some(prefix => normalized.startsWith(prefix)) && !normalized.split('/').some(part => part === 'node_modules' || part === 'dist' || part === '.env' || part === 'secrets');
}
function inspectRevision(revision) {
  if (!revision) fail('No Git revision was supplied to the safety scanner.');
  const rows = git(['ls-tree', '-r', '-l', revision]).split(/\r?\n/).filter(Boolean);
  for (const row of rows) {
    const match = row.match(/^\d+ blob [0-9a-f]+\s+(\d+)\t(.+)$/);
    if (!match) continue;
    const size = Number(match[1]), file = match[2];
    if (!allowedPath(file)) fail(`Blocked unsafe or unapproved file path: ${file}`);
    if (size > MAX_FILE_BYTES) fail(`Blocked unusually large file (${(size / 1048576).toFixed(1)} MB): ${file}`);
  }
  let matches = '';
  try { matches = git(['grep', '-I', '-n', '-E', '-e', SECRET_PATTERN, revision, '--']); }
  catch (e) { if (e.status !== 1) fail(`Could not scan ${revision} for credentials.`); }
  const locations = [];
  for (const row of matches.split(/\r?\n/).filter(Boolean)) {
    const rel = row.startsWith(revision + ':') ? row.slice(revision.length + 1) : row;
    const sep = rel.indexOf(':'), tail = sep >= 0 ? rel.slice(sep + 1) : '';
    const line = (tail.match(/^(\d+):/) || [])[1] || '?';
    locations.push(`${sep >= 0 ? rel.slice(0, sep) : 'tracked file'}:${line}`);
  }
  if (locations.length) fail(`Potential credentials detected. Nothing was pushed. Review these locations without sharing their contents:\n- ${locations.slice(0, 30).join('\n- ')}${locations.length > 30 ? `\n- and ${locations.length - 30} more` : ''}`);
  console.log(`Safety scan passed for ${revision}.`);
}
function scanPushInput() {
  const input = fs.readFileSync(0, 'utf8').trim();
  if (!input) return fail('Git did not provide the outgoing refs to the safety hook. Nothing was pushed.');
  const updates = input.split(/\r?\n/).map(line => line.trim().split(/\s+/)).filter(parts => parts.length >= 4);
  for (const [, localSha, , remoteSha] of updates) {
    if (ZERO.test(localSha)) continue;
    const revArgs = ['rev-list', '--reverse', localSha];
    if (!ZERO.test(remoteSha)) revArgs.push(`^${remoteSha}`);
    else revArgs.push('--not', '--remotes=origin');
    const commits = git(revArgs).split(/\r?\n/).filter(Boolean);
    if (commits.length) {
      const paths = git(['diff-tree', '--root', '--no-commit-id', '--name-only', '-r', '-z', '--stdin'], { input: commits.join('\n') + '\n' }).split('\0').filter(Boolean);
      for (const file of new Set(paths)) if (!allowedPath(file)) fail(`Blocked unsafe or unapproved file in outgoing history: ${file}`);
      const args = ['log', '--format=%H', '-G', SECRET_PATTERN, localSha];
      if (!ZERO.test(remoteSha)) args.push(`^${remoteSha}`);
      else args.push('--not', '--remotes=origin');
      const riskyCommits = git(args).split(/\r?\n/).filter(Boolean);
      if (riskyCommits.length) fail(`Potential credentials appear in outgoing commit(s): ${riskyCommits.slice(0, 10).map(x => x.slice(0, 8)).join(', ')}. Nothing was pushed.`);
    }
    inspectRevision(localSha);
  }
  console.log('GitHub safety checks passed for every outgoing ref.');
}

try {
  const at = process.argv.indexOf('--revision');
  if (at >= 0) inspectRevision(process.argv[at + 1]);
  else scanPushInput();
} catch (error) {
  console.error(`GitHub safety check failed: ${error.message}`);
  process.exitCode = 1;
}

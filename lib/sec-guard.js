// Pre-push & repository secret/PII scanner used by /api/git/push and tests/security-test.js.
// Prevents API keys, tokens, private keys, personal Windows usernames, or private data/ files from ever reaching GitHub.
const fs = require('fs');
const path = require('path');
const cp = require('child_process');

const SECRET_PATTERNS = [
  ['Anthropic API key', /sk-ant-[A-Za-z0-9_-]{20,}/g],
  ['OpenAI/generic secret key', /\bsk-[A-Za-z0-9]{24,}\b/g],
  ['GitHub personal access token', /\b(ghp|gho|ghu|ghs|ghr)_[A-Za-z0-9]{20,}\b/g],
  ['GitHub fine-grained PAT', /\bgithub_pat_[A-Za-z0-9_]{20,}\b/g],
  ['Google API key', /\bAIza[0-9A-Za-z_-]{30,}\b/g],
  ['AWS access key', /\bAKIA[0-9A-Z]{16}\b/g],
  ['Private key block', /-----BEGIN [A-Z ]*PRIVATE KEY-----[\s\S]{24,}/g],
  ['Groq API key', /\bgsk_[A-Za-z0-9]{20,}\b/g],
  ['NVIDIA NIM API key', /\bnvapi-[A-Za-z0-9_-]{20,}\b/g],
  ['Slack token', /\bxox[baprs]-[0-9A-Za-z-]{15,}\b/g],
  ['Discord token', /\b[MN][A-Za-z\d]{23}\.[\w-]{6}\.[\w-]{27}\b/g],
  ['Embedded URL credentials', /https?:\/\/[^\/\s:@]{2,}:[^\/\s@]{4,}@[^\s\/'"]+/gi],
  ['Personal Windows user path', /[A-Za-z]:[\\/]Users[\\/](?!Public\b|Default\b|YourName\b|username\b|user\b|<user>)[A-Za-z0-9._-]{2,}/gi]
];

const FORBIDDEN_PATHS = [
  /^data\/(?!cmudict\.dict$|cmudict-LICENSE\.txt$)/i,
  /^edge-profile\//i,
  /^runtime\//i,
  /^\.author-copy$/i,
  /(^|\/)\.env(\.|$)/i,
  /\.(key|pem|p12|pfx|jks)$/i,
  /(^|\/)(id_rsa|id_ed25519)(\.pub)?$/i,
  /(^|\/)(cloud|vault|remote|privacy|offline-adapters|chats)\.json$/i
];

const BINARY_EXT = /\.(png|jpg|jpeg|gif|webp|ico|woff2?|ttf|wasm|mp3|ogg|zip|dict|exe|dll|bin|pdf|whl)$/i;

function scanText(text, relPath) {
  const hits = [];
  const src = String(text || '');
  for (const [label, re] of SECRET_PATTERNS) {
    re.lastIndex = 0;
    let m;
    while ((m = re.exec(src)) !== null) {
      const line = src.slice(0, m.index).split('\n').length;
      hits.push({ file: relPath, line, reason: label });
      if (hits.length >= 10) return hits;
    }
  }
  return hits;
}

function scanFiles(rootDir, relFiles) {
  const findings = [];
  for (const raw of relFiles) {
    const rel = String(raw || '').replace(/\\/g, '/').trim();
    if (!rel) continue;
    if (FORBIDDEN_PATHS.some(re => re.test(rel))) {
      findings.push({ file: rel, line: 0, reason: 'Forbidden private/secret path' });
      continue;
    }
    if (BINARY_EXT.test(rel)) continue;
    const full = path.join(rootDir, rel);
    try {
      const st = fs.statSync(full);
      if (!st.isFile() || st.size > 2 * 1024 * 1024) continue;
      const txt = fs.readFileSync(full, 'utf8');
      if (txt.includes('\0')) continue;
      const hits = scanText(txt, rel);
      for (const h of hits) findings.push(h);
    } catch (e) { }
    if (findings.length >= 50) break;
  }
  return findings;
}

function scanRepo(rootDir) {
  let files = [];
  try {
    files = cp.execFileSync('git', ['ls-files', '--cached', '--others', '--exclude-standard'], {
      cwd: rootDir, encoding: 'utf8', timeout: 15000, maxBuffer: 10 * 1024 * 1024
    }).split(/\r?\n/).filter(Boolean);
  } catch (e) {
    return { ok: false, error: 'git ls-files failed: ' + String(e.message || e), findings: [] };
  }
  const findings = scanFiles(rootDir, files);
  return { ok: findings.length === 0, scanned: files.length, findings };
}

function scanStaged(rootDir) {
  let files = [];
  try {
    files = cp.execFileSync('git', ['diff', '--cached', '--name-only', '--diff-filter=ACMR'], {
      cwd: rootDir, encoding: 'utf8', timeout: 10000
    }).split(/\r?\n/).filter(Boolean);
  } catch (e) {
    return { ok: false, error: 'git diff --cached failed: ' + String(e.message || e), findings: [] };
  }
  const findings = scanFiles(rootDir, files);
  return { ok: findings.length === 0, scanned: files.length, findings };
}

module.exports = { scanText, scanFiles, scanRepo, scanStaged, SECRET_PATTERNS, FORBIDDEN_PATHS };

// Secrets (a mail password, a Lichess token) kept encrypted by Windows for the current Windows user only (DPAPI).
// The secret goes to PowerShell base64-encoded on stdin, never on a command line where other programs could see it.
const cp = require('child_process');
function ps(script, input) {
  return new Promise((res, rej) => {
    const p = cp.spawn('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command', '[Console]::OutputEncoding=[Text.Encoding]::UTF8; Add-Type -AssemblyName System.Security; ' + script], { windowsHide: true });
    let out = ''; p.stdout.on('data', d => out += d); p.on('error', rej);
    p.on('close', c => c === 0 && out.trim() ? res(out.trim()) : rej(new Error('Windows could not protect or unlock the secret.')));
    p.stdin.end(input);
  });
}
const S = '[Security.Cryptography.DataProtectionScope]::CurrentUser';
const protect = text => ps('$b=[Convert]::FromBase64String([Console]::In.ReadToEnd().Trim()); [Convert]::ToBase64String([Security.Cryptography.ProtectedData]::Protect($b,$null,' + S + '))', Buffer.from(String(text), 'utf8').toString('base64'));
const unprotect = blob => ps('$b=[Security.Cryptography.ProtectedData]::Unprotect([Convert]::FromBase64String([Console]::In.ReadToEnd().Trim()),$null,' + S + '); [Convert]::ToBase64String($b)', String(blob)).then(b => Buffer.from(b, 'base64').toString('utf8'));
module.exports = { protect, unprotect };

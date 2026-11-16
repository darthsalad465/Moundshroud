// Proves the C and C++ lesson answers with a real compiler (Visual Studio's cl.exe). Not part of tests/run.js because it needs
// Visual Studio and takes about a minute. Run it after editing C or C++ lessons:   node tests/c-verify.js
//   predict  the code is compiled and run, and the output must pass the lesson's own check
//   blank    the code with the answers filled in must compile
//   fix      the code with the corrected line must compile
// Snippets without a main() are wrapped in one, with the usual headers.
const fs = require('fs'), path = require('path'), os = require('os'), cp = require('child_process');
const C = require('../web/js/code-lessons-data.js');

const vsRoots = ['C:/Program Files/Microsoft Visual Studio', 'C:/Program Files (x86)/Microsoft Visual Studio'];
function findVcvars() {
  for (const root of vsRoots) { if (!fs.existsSync(root)) continue; for (const ver of fs.readdirSync(root)) for (const ed of fs.readdirSync(path.join(root, ver)).filter(x => fs.statSync(path.join(root, ver, x)).isDirectory())) { const p = path.join(root, ver, ed, 'VC', 'Auxiliary', 'Build', 'vcvars64.bat'); if (fs.existsSync(p)) return p; } }
  return '';
}
const vcvars = findVcvars();
if (!vcvars) { console.log('Visual Studio C++ tools not found, nothing checked.'); process.exit(0); }

const CH = '#include <stdio.h>\n#include <stdlib.h>\n#include <string.h>\n#include <stdbool.h>\n#include <limits.h>\n';
const CPPH = '#include <iostream>\n#include <string>\n#include <vector>\n#include <map>\n#include <set>\n#include <algorithm>\n#include <numeric>\n#include <memory>\n#include <optional>\n#include <stdexcept>\n#include <sstream>\n';
/* paragraphs (split at blank lines) that define a function or class stay at file scope; the rest goes inside main */
const topLevel = p => /^(?!(if|for|while|switch|return|do)\b)[A-Za-z_][\w\s*&:<>,]*\s[*&]?\w+\s*\([^;{]*\)\s*(const\s*)?\{/.test(p.trim()) || (/^(class|struct|template)\b/.test(p.trim()) && /\}\s*;\s*$/.test(p.trim()));
function wrap(lang, code) {
  if (/\bmain\s*\(/.test(code)) return code;
  const parts = code.split(/\n\s*\n/), top = parts.filter(topLevel), body = parts.filter(p => !topLevel(p));
  return (lang === 'c' ? CH : CPPH) + top.join('\n\n') + '\n' + (lang === 'c' ? 'int main(void) {\n' + body.join('\n') + '\nreturn 0;\n}\n' : 'int main() {\n' + body.join('\n') + '\n}\n');
}
const filled = l => { const ex = l.ex; if (ex.k === 'blank') { let n = 0; return ex.code.replace(/___/g, () => ex.ans[n++][0]); } if (ex.k === 'fix') { const ls = ex.code.split('\n'); ls[ex.line - 1] = ex.ans[0]; return ls.join('\n'); } return ex.code; };

const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'ms-cverify-')), jobs = [];
let seq = 0; /* numbered file names: Windows treats cP4 and cp4 as the same file */
for (const l of C.LESSONS.filter(l => (l.lang === 'c' || l.lang === 'cpp') && ['predict', 'blank', 'fix'].includes(l.ex.k))) {
  const ext = l.lang === 'c' ? '.c' : '.cpp', base = 'n' + (seq++) + '_' + l.id, f = path.join(dir, base + ext); fs.writeFileSync(f, wrap(l.lang, filled(l))); jobs.push({ l, f, exe: path.join(dir, base + '.exe'), log: path.join(dir, base + '.log') });
}
const bat = path.join(dir, 'build.bat');
fs.writeFileSync(bat, '@echo off\r\ncall "' + vcvars + '" >nul\r\ncd /d "' + dir + '"\r\n' + jobs.map(j => 'cl /nologo /EHsc ' + (j.l.lang === 'c' ? '/std:c17 /TC' : '/std:c++17') + ' /W0 "' + j.f + '" /Fe:"' + j.exe + '" > "' + j.log + '" 2>&1').join('\r\n') + '\r\n');
console.log('Compiling ' + jobs.length + ' C and C++ answers...');
cp.spawnSync('cmd.exe', ['/c', bat], { encoding: 'utf8', timeout: 600000, windowsHide: true });
let pass = 0, fail = 0;
for (const j of jobs) {
  if (!fs.existsSync(j.exe)) { fail++; console.log('FAIL ' + j.l.id + ' (' + j.l.ex.k + ') does not compile:\n' + fs.readFileSync(j.log, 'utf8').split('\n').filter(s => /error/.test(s)).slice(0, 3).join('\n')); continue; }
  if (j.l.ex.k !== 'predict') { pass++; continue; }
  const r = cp.spawnSync(j.exe, [], { encoding: 'utf8', timeout: 10000, cwd: dir, windowsHide: true, input: '' }), out = (r.stdout || '').trim();
  if (C.check(j.l, { text: out }).ok) pass++; else { fail++; console.log('FAIL ' + j.l.id + ' printed "' + out + '", the lesson expects "' + j.l.ex.ans[0] + '"'); }
}
try { fs.rmSync(dir, { recursive: true, force: true }); } catch (e) { }
console.log(pass + ' passed, ' + fail + ' failed');
process.exit(fail ? 1 : 0);

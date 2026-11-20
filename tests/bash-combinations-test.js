// Deterministic Bash combinations with an optional comparison against an installed Bash.
const { spawnSync } = require('node:child_process');

function matrix() {
  const cases = [];
  const add = (script, out, status = 0, native = true) => cases.push({ script, out, status, native });
  const commands = [
    { code: 'true', status: 0 }, { code: 'false', status: 1 },
    { code: 'moundshroud_missing_builtin 2>/dev/null', status: 127 }
  ];

  for (const a of commands) for (const b of commands) for (const c of commands) {
    for (const left of ['&&', '||', ';']) for (const right of ['&&', '||', ';']) {
      const operators = [left, right], trio = [a, b, c];
      const text = ['A'];
      let status = a.status;
      operators.forEach((op, index) => {
        if (op === ';' || (op === '&&') === (status === 0)) {
          status = trio[index + 1].status;
          text.push('BC'[index]);
        }
      });
      const steps = trio.map(({ code }, index) => `{ printf %s ${'ABC'[index]}; ${code}; }`);
      add(`${steps[0]} ${left} ${steps[1]} ${right} ${steps[2]}`, text.join(''), status);
    }
    for (const pipefail of [false, true]) for (const negate of [false, true]) for (const merge of [false, true]) {
      const statuses = [a.status, b.status, c.status];
      const status = pipefail ? statuses.findLast(value => value !== 0) ?? 0 : statuses.at(-1);
      const opts = pipefail ? 'set -o pipefail; ' : '';
      add(opts + (negate ? '! ' : '') + [a.code, b.code, c.code].join(merge ? ' |& ' : ' | '), '', negate ? Number(!status) : status);
    }
  }

  const quote = value => "'" + value.replace(/'/g, "'\\''") + "'";
  const payloads = ['', 'plain', 'two words', '  ends  ', 'line\nbreak', 'a | b && c > d', 'it\'s "quoted"', '$(echo literal)', 'a\\b', 'π café'];
  for (const value of payloads) {
    const setup = 'sample=' + quote(value) + '; ';
    const box = (parts) => parts.map(part => '[' + part + ']').join('');
    const split = text => text.split(/[ \t\n]+/).filter(Boolean);
    add(setup + `printf '[%s]' "$sample"`, box([value]));
    add(setup + `printf '[%s]' $sample`, box(split(value).length ? split(value) : ['']));
    add(setup + `printf '[%s]' "$(printf '%s\\n\\n' "$sample")"`, box([value]));
    add(setup + `printf '[%s]' $(printf '%s' "$sample")`, box(split(value).length ? split(value) : ['']));
    add(setup + `printf '[%s]' "pre\${sample:-fallback}post"`, box(['pre' + (value || 'fallback') + 'post']));
    add(setup + `set -- "$sample" '' tail; printf '[%s]' "$@"`, box([value, '', 'tail']));
    add(setup + `format() { printf '[%s]' "$#" "$@"; }; format "$sample" ''`, box(['2', value, '']));
    add(setup + `printf '[%s]' "$({ printf '%s' "$sample"; printf ignored >&2; } 2>/dev/null)"`, box([value]));
    add(setup + `printf '[%s]' "$(printf '%s' "$(printf '%s' "$sample")")"`, box([value]));
  }

  for (const initial of ['unset', 'empty', 'set']) for (const operator of ['-', ':-', '+', ':+', '=', ':=']) {
    const initialValue = initial === 'set' ? 'value' : '';
    const prefix = initial === 'unset' ? 'unset sample' : 'sample=' + initialValue;
    const absent = initial === 'unset' || operator[0] === ':' && initial === 'empty';
    const action = operator.at(-1);
    const expansion = action === '+' ? absent ? '' : 'alternative' : absent ? 'alternative' : initialValue;
    const after = action === '=' && absent ? 'alternative' : initialValue;
    add(prefix + `; printf '[%s]' "\${sample${operator}alternative}"; printf '[%s]' "$sample"`, `[${expansion}][${after}]`);
  }

  for (const mode of ['|', '|&']) for (const order of ['', '2>&1', '2>/dev/null', '2>&1 >/dev/null', '>/dev/null 2>&1']) {
    const stdout = order.includes('>/dev/null') && !order.startsWith('2>/dev/null') ? '' : 'out';
    const stderrDiscarded = order === '2>/dev/null' || order === '>/dev/null 2>&1';
    const stderrRouted = order === '2>&1' || order === '2>&1 >/dev/null';
    const merged = mode === '|&' ? (stdout ? 'err' : '') : stderrRouted ? 'err' : '';
    const separate = mode === '|' && !stderrDiscarded && !stderrRouted ? 'err' : '';
    add(`{ printf out; printf err >&2; } ${order} ${mode} cat`, separate + stdout + merged);
  }

  for (let length = 1; length <= 12; length++) {
    const words = Array.from({ length }, (_, index) => `item-${index + 1}`);
    const shown = words.filter((_, i) => i !== 1).slice(0, 4);
    add(`for item in ${words.join(' ')}; do if [ "$item" = item-2 ]; then continue; elif [ "$item" = item-6 ]; then break; else printf '<%s>' "$item"; fi; done`,
      shown.map(word => `<${word}>`).join(''));
    add(`printf '%s\\n' ${words.join(' ')} | while read -r value; do printf '<%s>' "$value"; done`, words.map(word => `<${word}>`).join(''));
    add(`emit() { for value in "$@"; do printf '<%s>' "$value"; done; }; emit ${words.join(' ')} | cat`, words.map(word => `<${word}>`).join(''));
  }

  add(`for outer in a b; do for inner in 1 2 3; do printf '[%s%s]' "$outer" "$inner"; if [ "$inner" = 2 ]; then break; fi; done; done`, '[a1][a2][b1][b2]');
  add(`value=outside; (value=subshell; printf '%s/' "$value"); { value=group; }; printf %s "$value"`, 'subshell/group');
  add(`value=before; value=temporary printenv value; printf '%s' "$value"`, 'temporary\nbefore');
  add(`outer() { inner child; printf '[%s]' "$1"; }; inner() { printf '[%s]' "$1"; return 17; printf unreachable; }; outer parent`, '[child][parent]');
  add(`value=before; until [ "$value" = after ]; do value=after; done; printf %s "$value"`, 'after');
  add(`if false; then printf wrong; elif false; then printf wrong; elif true; then printf correct; else printf wrong; fi`, 'correct');
  add(`set --; printf '[%s]' "$#" "$@"`, '[0]');
  add(`item=$(false)`, '', 1);
  add(`set -- left right; f() { set -- inner; }; f other; printf '[%s]' "$@"`, '[left][right]');
  add(`printf a | { cat; cat; }; printf b`, 'ab');
  add(`printf 'partial' | { read value; printf '[%s:%s]' "$?" "$value"; }`, '[1:partial]');
  add(`f(){ printf '%s' "$1"; } >&2; f diagnostic 2>/dev/null`, '');
  add(`{ printf '%s\\n' apple banana apricot avocado; } | { grep '^a' | sort; } | wc -l`, '3');
  add(`printf '%s\\n' first |\n# ignore this continuation comment\n cat`, 'first');
  add(`printf '%s' first # $(printf wrong) | false\nprintf '%s' '#second'`, 'first#second');
  add(`sample='a b'; read -r first last <<< "$sample"; printf '[%s][%s]' "$first" "$last"`, '[a][b]');
  add(`IFS= read -r value <<< ' a b '; printf '[%s]' "$value"`, '[ a b ]');
  add(`IFS=: read -r first second rest <<< 'a:b:c:d'; printf '[%s]' "$first" "$second" "$rest"`, '[a][b][c:d]');
  add(`printf '[%s]' "$(cat <<< 'one two')"`, '[one two]');
  add(`value=private; export pub=exported; bash -c 'printf "[%s]" "${'$'}{value:-unset}" "$pub" "$0" "$@"' child arg`, '[unset][exported][child][arg]');
  add(`printf '%s\\n' 'printf "[%s]" "$1"' | bash -s -- arg`, '[arg]');
  add(`f(){ bash -c 'true'; return 11; }; f`, '', 11);
  add(`bash -c 'f(){ exit 17; }; f; printf unreachable'`, '', 17);
  add(`(exit 26) || printf '[%s]' "$?"`, '[26]');

  for (let a = -3; a <= 3; a++) for (let b = 1; b <= 4; b++) {
    add(`a=${a}; b=${b}; printf '[%s]' "$((a + b * 2))" "$((a / b))" "$((a % b))" "$((a < b && b >= 2))"`,
      `[${a + b * 2}][${Math.trunc(a / b)}][${a % b}][${Number(a < b && b >= 2)}]`);
    add(`n=${a}; ((n += ${b})); printf '[%s]' "$?" "$n" "$((n++))" "$((++n))"`,
      `[${Number(a + b === 0)}][${a + b}][${a + b}][${a + b + 2}]`);
  }
  for (let limit = 2; limit <= 10; limit++) {
    const expected = Array.from({ length: limit }, (_, index) => index).filter(index => index % 2 === 0);
    add(`for ((i=0; i<${limit}; i++)); do ((i % 2)) && continue; printf '<%s>' "$i"; done`, expected.map(i => `<${i}>`).join(''));
    add(`i=0; while ((i < ${limit})); do ((++i)); done; printf %s "$i"`, String(limit));
  }
  add(`number=5; printf '[%s]' "$((0 && (number=9)))" "$((1 || (number=9)))" "$number"`, '[0][1][5]');

  // Exercise virtual-file mutations without touching the native filesystem.
  add(`mkdir -p work; for name in work/{a,b,c}.txt; do printf '%s\\n' "$name" > "$name"; done; { cat work/*.txt; printf end; } > 'combined list'; cat 'combined list'`, 'work/a.txt\nwork/b.txt\nwork/c.txt\nend', 0, false);
  add(`printf '%s\\n' alpha beta > source; while read -r line; do printf '<%s>' "$line"; done < source > dest; chmod u-r dest; cat dest 2>/dev/null || chmod u+r dest; cat dest`, '<alpha><beta>', 0, false);
  add(`write() { printf '%s' "$@"; } >> journal; write a b; (write c; printf d >> journal); cat journal`, 'abcd', 0, false);
  add(`printf '%s\\n' '#!/bin/bash' 'printf "[%s:%s]" "$0" "$1"' > stage.sh; bash stage.sh child; ./stage.sh denied 2>/dev/null; printf '[%s]' "$?"; chmod u+x stage.sh; ./stage.sh executable`, '[stage.sh:child][126][./stage.sh:executable]', 0, false);
  add(`value=before; printf '%s\\n' 'value=$1' 'return 9' 'value=wrong' > settings.sh; source settings.sh after; printf '[%s:%s]' "$?" "$value"`, '[9:after]', 0, false);
  add(`name='one two'; printf never > $name 2>/dev/null || printf ambiguous; printf ok > "$name"; cat "$name"`, 'bash: $name: ambiguous redirect\nambiguousok', 0, false);
  return cases;
}

function compareNative(cases, binary) {
  const selected = cases.filter(test => test.native);
  // Only the authored fixtures above are executed. User-entered sandbox commands stay in the simulator.
  const program = ['export PATH=/usr/bin:/bin LC_ALL=C.UTF-8', ...selected.map(({ script }, index) =>
    `printf '\\036%d\\037' ${index}\n(\n${script}\n) 2>&1\nprintf '\\035%d\\034' "$?"`)].join('\n');
  const result = spawnSync(binary, ['--noprofile', '--norc', '-s'], {
    input: program + '\n', encoding: 'utf8', timeout: 150000, maxBuffer: 4 * 1024 * 1024
  });
  if (result.error || result.status !== 0) return { errors: [String(result.error || result.stderr || result.status)], count: 0 };
  const frames = [...result.stdout.matchAll(/\x1e(\d+)\x1f([\s\S]*?)\x1d(\d+)\x1c/g)];
  const errors = [];
  if (frames.length !== selected.length) errors.push('Received ' + frames.length + ' frames for ' + selected.length + ' scripts');
  for (let index = 0; index < frames.length; index++) {
    const [, frame, stdout, status] = frames[index], test = selected[index];
    const actual = stdout.replace(/\r\n/g, '\n').replace(/\n$/, '');
    if (!test || Number(frame) !== index || actual !== test.out || Number(status) !== test.status) {
      errors.push(JSON.stringify({ script: test?.script, expected: test?.out, expectedStatus: test?.status, actual, status }));
    }
  }
  return { errors, count: selected.length };
}

module.exports = function run(ok, makeBash) {
  const cases = matrix();
  const errors = [];
  for (const { script, out, status } of cases) {
    const shell = makeBash();
    const actual = shell.run(script), actualStatus = Number(shell.run('printf %s "$?"'));
    if (actual !== out || actualStatus !== status) errors.push(JSON.stringify({ script, out, status, actual, actualStatus }));
  }
  const limited = makeBash();
  ok('bash: runaway loops stop and the session still accepts commands', limited.run('while true; do :; done').includes('execution limit') &&
    limited.run('for ((;;)); do :; done').includes('execution limit') &&
    limited.run('for ((;;)); do done').includes('expected commands') && limited.run('printf ready') === 'ready');
  ok(`bash: ${cases.length} combinations match expected output and exit status`, !errors.length,
    `${errors.length} mismatches\n${errors.slice(0, 16).join('\n')}`);
  if (process.env.MOUNDSHROUD_BASH_ORACLE) {
    const native = compareNative(cases, process.env.MOUNDSHROUD_BASH_ORACLE);
    ok(`bash: ${native.count} combinations checked against native Bash`, !native.errors.length,
      `${native.errors.length} mismatches\n${native.errors.slice(0, 16).join('\n')}`);
  }
};

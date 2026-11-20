// Local explanations for completed Playground commands. The coach consumes results without running commands.
(() => {
  const TP = window.TerminalPlayground;
  const fileCommands = new Set(['cd', 'ls', 'cat', 'head', 'tail', 'find', 'grep', 'stat', 'chmod', 'sort', 'wc', 'touch', 'mkdir', 'cp', 'mv', 'rm', 'tee', 'base64', 'xxd']);
  const safeTopics = {
    bash: [...fileCommands, 'pwd', 'printf', 'echo', 'sed', 'awk', 'cut', 'tr', 'uniq', 'test', 'set', 'diff', 'jq', 'file', 'tree', 'sha256sum'],
    powershell: ['Get-ChildItem', 'Set-Location', 'Get-Location', 'Get-Content', 'Select-String', 'Select-Object', 'Where-Object', 'Sort-Object', 'Measure-Object', 'Test-Path', 'Get-FileHash'],
    cmd: ['dir', 'cd', 'type', 'find', 'findstr', 'sort', 'copy', 'mkdir'],
    python: ['print', 'len', 'range', 'sum', 'sorted', 'int', 'enumerate', 'zip'],
    node: ['console.log', 'Buffer.from'],
    sql: ['SELECT', 'WHERE', 'JOIN', 'INSERT', 'ORDER BY', 'GROUP BY', 'UPDATE', 'DELETE', 'BEGIN'],
    git: ['git status', 'git log', 'git add', 'git diff', 'git commit', 'git branch', 'git switch', 'git stash'],
    docker: ['docker ps', 'docker run', 'docker logs', 'docker inspect', 'docker compose'],
    network: ['dig', 'ping'],
    crypto: ['base64', 'base64url', 'base32', 'hex', 'rot13', 'url', 'entropy']
  };
  const cli = new Set(['bash', 'powershell', 'cmd', 'network', 'crypto', 'git', 'docker']);
  const locations = {
    bash: ['pwd', 'ls -la'], powershell: ['Get-Location', 'Get-ChildItem -Force'], cmd: ['cd', 'dir /a']
  };
  const aliases = { 'select-string': 'Select-String', sls: 'Select-String', gci: 'Get-ChildItem', gc: 'Get-Content' };
  const unsafeTopic = /\b(?:nmap|masscan|hping3|hydra|john|hashcat|msfconsole|metasploit|gobuster|ffuf|nikto|sqlmap|aircrack|smbclient|rpcclient|snmpwalk|ldapsearch|enum4linux|netcat|ncat|nc|ssh|socat)\b/i;
  const head = source => (/^[^\s(]+/.exec(source.trim())?.[0] || '').toLowerCase();
  const wrap = value => '“' + String(value).slice(0, 110) + '”';

  function topicFor(shell, line) {
    const name = head(line);
    if (shell === 'bash' && fileCommands.has(name) && !line.trim().startsWith(name)) return '';
    if (shell === 'powershell') {
      if (name === 'ls' || name === 'dir') return 'Get-ChildItem';
      if (name === 'cat' || name === 'type') return 'Get-Content';
    }
    const normalized = cli.has(shell) ? line.trim().toLowerCase() : line.trim();
    return aliases[name] && shell === 'powershell' ? aliases[name] :
      (safeTopics[shell] || []).find(topic => {
        const key = cli.has(shell) ? topic.toLowerCase() : topic;
        const text = shell === 'sql' ? normalized.toUpperCase() : normalized;
        return text === key || text.startsWith(key + ' ') || text.startsWith(key + '(');
      }) || '';
  }

  function spelling(shell, line) {
    const word = head(line);
    if (!/^[a-z]{3,16}$/.test(word)) return '';
    const options = safeTopics[shell] || [];
    for (const topic of options) {
      const target = topic.toLowerCase();
      if (/\s/.test(target) || Math.abs(target.length - word.length) > 1) continue;
      let i = 0;
      while (i < word.length && word[i] === target[i]) i++;
      const a = word.slice(i), b = target.slice(i);
      if ((a.length === b.length && (a.slice(1) === b.slice(1) || (a[0] === b[1] && a[1] === b[0] && a.slice(2) === b.slice(2)))) ||
          (a.length === b.length + 1 && a.slice(1) === b) || (b.length === a.length + 1 && b.slice(1) === a)) return topic;
    }
    const letters = value => [...value.toLowerCase()].sort().join('');
    return word.length >= 4 && options.find(topic => topic[0].toLowerCase() === word[0] && letters(topic) === letters(word)) || '';
  }

  function simpleGrep(line) {
    // Expansion, substitution, and redirection can change the arguments after this source-level reading.
    if (!/^grep(?:\s|$)/.test(line) || /[$<>]/.test(line)) return null;
    const flags = new Set(), operands = [];
    for (const token of TP.tokenize(line).slice(1)) {
      if (/^-[invrcRloqH]+$/.test(token)) for (const flag of token.slice(1)) flags.add(flag);
      else if (token.startsWith('-')) return null;
      else operands.push(token);
    }
    return { flags, pattern: operands[0], files: operands.slice(1) };
  }

  function pipelineNotes(pipelines) {
    if (!pipelines?.length) return [];
    const result = [];
    const multi = pipelines.find(pipeline => !pipeline.skipped && pipeline.stages.length > 1);
    if (multi) {
      const stages = multi.stages.slice(0, 8).map(stage => (head(stage.command) || 'stage') + ' (' + stage.status + ')');
      result.push('Pipeline exit codes in execution order: ' + stages.join(' → ') + '. Each stage receives the previous stage’s standard output.');
      if (multi.stages.some(stage => stage.pipe === '|&')) result.push('The |& operator also sends diagnostic text from that stage into the next stage’s input.');
      if (multi.stages.slice(0, -1).some(stage => stage.status !== 0)) {
        result.push(multi.pipefail ?
          'An earlier stage returned a nonzero code. With pipefail on, the rightmost nonzero stage determines the pipeline’s code before any ! inversion.' :
          'An earlier stage returned a nonzero code. With pipefail off, Bash uses the final stage’s code before any ! inversion.');
      }
      if (multi.stages.some(stage => head(stage.command) === 'grep' && stage.status === 1)) {
        result.push('In this Bash workspace, grep returns 1 when it selects zero lines. A later stage can still run and report success.');
      }
    }
    if (pipelines.some(pipeline => !pipeline.skipped && pipeline.inverted)) result.push('The leading ! inverted that group’s success or failure.');
    if (pipelines.some(pipeline => pipeline.skipped)) {
      result.push('A command group was skipped because && runs the next group on success and || runs it on failure.');
    }
    return result;
  }

  function analyze({ shell, mode, command, out, trace, solved, reset }) {
    const line = String(command).trim();
    const output = String(out ?? '');
    const status = Number.isInteger(trace?.status) ? trace.status : null;
    const diagnostic = (trace ? String(trace.stderr ?? '') : output).slice(0, 8000);
    const pipelines = trace?.pipelines || [];
    const actual = pipelines.filter(group => !group.skipped).at(-1);
    const simple = pipelines.length <= 1;
    const parts = cli.has(shell) ? TP.splitTop(line, ['||', '&&', '|&', '|', ';']) : [line];
    const last = actual?.stages.at(-1)?.command || parts.at(-1) || line;
    const name = head(last);
    const topic = topicFor(shell, last);
    const grep = shell === 'bash' && simple ? simpleGrep(last) : null;
    const steps = pipelineNotes(pipelines);
    const report = (title, kind, why, next = [], commands = [], manual = topic) => ({
      title, kind, command: line.slice(0, 420), status, why: [...why, ...steps], next, commands, manual
    });
    if (unsafeTopic.test(line)) {
      return {
        title: status === 0 ? 'Exited successfully' : 'Command output available', kind: status === 0 ? 'ok' : 'neutral',
        command: '', status, why: ['The terminal output records what happened for this command.'],
        next: [], commands: [], manual: ''
      };
    }
    if (solved) return report('Answer accepted', 'ok', ['The current exercise verified the submitted value.'], [], [], '');
    if (reset) return report('Workspace restarted', 'ok', ['The exercise created a fresh workspace. Its files and progress start from that workspace’s initial state.'], [], [], '');
    if (mode !== 'sandbox' && /^(?:solve|key|unlock|submit)(?:\s|$)/i.test(line)) {
      if (/^\s*✗/.test(output)) return report('Answer did not match', 'error',
        ['The checker ran and rejected the submitted value. This is an answer mismatch after parsing the command.'],
        ['Check the requested representation in the objective. A value may need a specific format or another decoding step.'], ['hint'], '');
      if (/^usage:/i.test(output)) return report('Answer is missing', 'error',
        ['The checker expects a value after solve.'], ['Supply the value you recovered from the exercise.'], [], '');
    }

    if (/^\s*(?:bash:\s*)?(?:syntax error (?:in command list|near (?:pipe|unexpected token))|unexpected EOF)/im.test(diagnostic)) {
      const pipe = /near pipe/i.test(diagnostic) || /\|\s*$/.test(line);
      const beforePipe = /^(ls(?:\s+-[al]+)?|pwd)\s*\|$/.exec(line)?.[1];
      return report('Shell syntax error', 'error',
        [pipe ? 'A pipeline needs a command on each side of its pipe.' : 'The shell could not parse the command structure. Common causes are an unmatched quote, an unfinished substitution, or an incomplete command list.'],
        [pipe ? 'Check for a trailing | or two pipe separators with no command between them.' :
          'Check matching quotes and parentheses. For Bash scripts, also check that then/fi and do/done are paired.'],
        beforePipe ? [beforePipe] : [], pipe ? 'pipes & chaining' : topic);
    }

    const paths = locations[shell] || [];
    const firstDiagnostic = diagnostic.trim();
    const isErrorText = trace ? Boolean(firstDiagnostic) : status !== 0;
    const missing = /^(?:[^\n]*?: )?(?:[^\n]*?: )?(?:no such file(?: or directory)?|file not found|cannot find (?:the )?(?:path|file)|the system cannot find the (?:path|file)|cannot open (?:file|[\w.]))/im;
    if (isErrorText && missing.test(firstDiagnostic) && (trace || shell === 'cmd' || shell === 'powershell' || fileCommands.has(name))) {
      const source = parts.length > 1 && /^cat\s+(var\/log\/[\w.\/-]+)$/.exec(parts[0]);
      const rootPath = source && '/' + source[1];
      return report('Path could not be opened', 'error', [
        'A file or directory requested by a command could not be located or opened. Relative paths start at your working directory.',
        ...(parts.length > 1 ? ['A downstream filter can receive no input when the upstream command fails to open its file. Check the first error in the terminal.'] : [])
      ], ['Check the working directory, list the relevant parent folder, and verify the filename. Quote a path that contains spaces.',
        ...(rootPath ? ['If the exercise puts the log under the virtual root, inspect it at ' + rootPath + ' before adding the filter.'] :
          shell === 'bash' ? ['A path starting with / is absolute. For example, var/log is relative and /var/log starts at the virtual root.'] : [])],
      rootPath && shell === 'bash' ? [...paths, 'head -n 10 ' + rootPath] : paths);
    }
    if (isErrorText && /(?:^|:\s)(?:permission denied|operation not permitted|access (?:is )?denied)\b/im.test(firstDiagnostic) &&
        (trace || paths.length)) {
      return report('Permission check failed', 'error',
        ['The virtual workspace rejected an access or permission change. Reading a file and changing its permissions require different authority.'],
        [shell === 'bash' ? 'Use a long listing to inspect permissions. If the exercise expects you to change the owner’s read bit, look up the symbolic mode u+r.' :
          'Inspect the target and its attributes. Use a workspace location that permits the operation.'],
        paths.slice(-1), shell === 'bash' ? 'chmod u+r' : topic);
    }
    if (isErrorText && /(?:^(?:bash|puzzle|labyrinth):[^\n]*\b(?:command not found|unknown command)|not recognized as (?:the name|an internal or external command)|is not a (?:git|docker) command)/im.test(firstDiagnostic)) {
      const failed = actual?.stages.find(stage => stage.status === 127)?.command || last;
      const guess = spelling(shell, failed);
      if (head(failed) === 'grep' && (shell === 'cmd' || shell === 'powershell')) {
        const replacement = shell === 'cmd' ? 'findstr' : 'Select-String';
        return report('Use this shell’s text search command', 'error',
          ['grep is a Unix-style text search command. This workspace did not recognize it.'],
          [shell === 'cmd' ? 'Use findstr in CMD. Put /i before the search pattern to ignore case in Windows.' :
            'Use Select-String in PowerShell. Place the pattern before the filename, and use -CaseSensitive when exact capitalization matters.'],
          [], replacement);
      }
      const tokens = TP.tokenize(failed);
      const fix = ['grep', 'cat', 'ls', 'stat', 'pwd'].includes(guess) &&
        tokens.every(token => /^[\w./-]+$/.test(token)) && actual?.stages.length === 1 && simple ?
        [guess, ...tokens.slice(1)].join(' ') : '';
      return report('Command name was not recognized', 'error',
        ['This shell or exercise could not find a command with that name. Names and options can differ between terminals.'],
        [guess ? 'Check whether you meant ' + wrap(guess) + '.' : 'Check spelling and open Help for the current shell’s command list.'],
        fix ? [fix] : [], guess || topic);
    }
    if (isErrorText && /(?:^usage:|:\s*(?:missing (?:file )?operand|invalid (?:mode|pattern|option)|(?:unknown|unrecognized|unsupported) option)\b)/im.test(firstDiagnostic)) {
      const why = [/invalid mode/i.test(firstDiagnostic) ? 'chmod could not interpret the permission mode. A symbolic mode uses a class, an operation, and a permission, as in u+r.' :
        /invalid pattern/i.test(firstDiagnostic) ? 'The search command could not compile the pattern. Check brackets, parentheses, or other regex punctuation.' :
          'The command recognized its own name but rejected an option or lacked a required argument. The terminal’s usage line shows the expected format.'];
      return report('Arguments need a change', 'error', why, ['Compare the option spelling and argument order with the command’s help page.']);
    }
    if (grep?.pattern !== undefined && (status !== 2 || actual?.stages.at(-1)?.status < 2)) {
      const { flags, pattern, files } = grep;
      const selected = actual?.stages.at(-1)?.status ?? status;
      const hasUpstream = parts.length > 1 || actual?.stages.length > 1;
      const why = [
        'grep checked each input line for ' + wrap(pattern) + (files.length ? ' in the file arguments.' : hasUpstream ? ' in the preceding command’s output.' : ' in its standard input.'),
        ...(flags.has('i') ? ['-i ignores letter case. Commas, spaces, and other punctuation still affect the match.'] : []),
        ...(flags.has('n') ? ['-n adds the original line number. With piped input, the number refers to the text entering grep.'] : []),
        ...(flags.has('v') ? ['-v reverses selection and keeps lines that do not match the pattern.'] : []),
        ...(flags.has('c') ? ['-c reports a count of selected lines.'] : []),
        ...(flags.has('q') && status != null ? ['-q suppresses the printed matches. Use the exit code to check whether any line was selected.'] : [])
      ];
      const zeroCount = flags.has('c') && output.trim() === '0';
      if (selected === 1 || (selected == null && (zeroCount || (output.trim() === '' && !flags.has('q'))))) {
        return report(selected === 1 ? 'No lines selected' : 'No matches were printed', 'neutral', why,
          [!hasUpstream && !files.length ? 'Provide a filename or pipe text into grep. The Playground does not wait for interactive standard input here.' :
            'Look at a few input lines first. Search for one distinctive word and add the exact spacing and punctuation once it matches.'],
          [], 'grep' + [...flags].filter(flag => ['i', 'n', 'v', 'c'].includes(flag)).map(flag => ' -' + flag).join(''));
      }
      if (selected === 0 || output.trim()) {
        return report(selected === 0 ? 'grep selected lines' : 'grep produced output', 'ok', why,
          [flags.has('n') ? 'Use the numbers to find the surrounding text in the input.' :
            'Add -n to keep the original line numbers, or narrow the pattern to the field you need.'], [], 'grep');
      }
    }
    if (isErrorText && /(?:^|:\s)(?:not a directory|is a directory|directory not empty)\b/im.test(firstDiagnostic) && paths.length) {
      return report('The path has the wrong type', 'error',
        ['The shell found a path, but the requested operation needs a different kind of entry. cd enters directories. File readers need a file within the directory.'],
        ['List the parent folder and check the entry’s type before rerunning the command.'], paths);
    }
    if (shell === 'sql' && /^parse error:/i.test(firstDiagnostic)) {
      return report('SQL statement could not be parsed', 'error',
        ['The parser reached a statement that does not match its expected clause order. The terminal prints the form it expected.'],
        [name === 'select' ? 'Start with SELECT column FROM table, then add WHERE, ORDER BY, or LIMIT in that order.' :
          'Check for missing keywords, commas, or parentheses at the point indicated in the message.'],
        [], topic);
    }
    if (shell === 'docker' && /^(?:error(?: response from daemon)?:\s*)?no such container:/i.test(firstDiagnostic)) {
      return report('Container name or ID was not found', 'error',
        ['The runtime looked for a container matching the supplied name or ID. Image names identify templates and may differ from the containers created from them.'],
        ['List containers, including stopped ones, and use the name or ID from the appropriate row.'], ['docker ps -a'], 'docker ps -a');
    }
    if (shell === 'git' && /^\s*(?:error:\s*switch .m. requires a value|nothing to commit)/i.test(firstDiagnostic)) {
      return report('Commit needs a message or staged changes', 'error',
        [/requires a value/.test(firstDiagnostic) ? 'The -m option expects a commit message after it.' : 'Git reported that there was no change to record. A commit normally records what is staged.'],
        ['Check git status, then use a quoted message after -m when making the commit.'], ['git status'], 'git commit -m');
    }
    if (isErrorText && /^\s*(?:(?:error|typeerror|referenceerror|syntaxerror|valueerror|nameerror|uncaught)\b[^\n]*|no such (?:column|table)|fatal:|error response from daemon:)/im.test(firstDiagnostic)) {
      const language = shell === 'python' || shell === 'node';
      return report('Runtime reported an error', 'error',
        [language ? 'The interpreter reported an error while parsing or evaluating the expression.' : 'The runtime emitted a diagnostic for this command.'],
        [language ? 'Evaluate the smallest expression first. Check that names are defined, delimiters are paired, and the value has the expected type.' :
          shell === 'sql' ? 'Verify the table and column names against the schema. Check the order of clauses and use single quotes for text values.' :
            'Read the first diagnostic and verify the referenced object and syntax before retrying.']);
    }
    if (simple && name === 'chmod' && shell === 'bash' && !output && (status === 0 || status == null)) {
      const permission = TP.tokenize(last).slice(1).find(word => /^[ugoa]+[+=-][rwx]*$/.test(word));
      return report(status === 0 ? 'Permissions command completed' : 'chmod returned quietly', 'ok',
        ['chmod usually prints nothing for a permitted change. The file’s mode can also stay the same if the requested bit already had that value.',
          ...(permission === 'u+r' ? ['u selects the owner, + adds a permission, and r means read. The other permission bits stay as they were.'] : [])],
        ['Use ls -l or stat -c %a with the same path to verify the effective permissions.'], [], permission === 'u+r' ? 'chmod u+r' : 'chmod');
    }
    const doc = topic && TP.manualContent?.pages[shell]?.[topic.toLowerCase()];
    const purpose = typeof doc?.description === 'string' ? doc.description : doc?.description?.[0];
    const caseOption = value => ['cmd', 'powershell'].includes(shell) ? value.toLowerCase() : value;
    const optionTokens = new Set(TP.tokenize(last).slice(1).filter(token => /^[-/][\w-]+$/.test(token)).map(caseOption));
    const options = (doc?.options || []).filter(([label]) => label.split(/[,| ]+/).some(form => optionTokens.has(caseOption(form)))).slice(0, 4);
    const redirect = shell === 'bash' && simple && TP.splitTop(last, ['>>', '>'])[0] !== last;
    if (status !== null && status !== 0) {
      return report('Command returned a nonzero exit code', 'error',
        ['The shell returned exit code ' + status + (output ? '. Read the terminal message for the exact cause.' : ' without printing an explanation.')],
        ['Run a small portion by itself to narrow down the cause, or check the manual for what this command’s exit codes mean.']);
    }
    return report(status === 0 ? 'Command completed' : output ? 'Command produced output' : 'No output was printed',
      status === 0 ? 'ok' : 'neutral', [
        ...(purpose ? [purpose] : []),
        ...options.map(([label, meaning]) => label + ' — ' + meaning),
        ...(redirect ? ['An output redirection sends text to a file. Use > to replace the file contents or >> to append.'] : []),
        output ? (status === 0 ? 'The shell returned exit code 0 for the command line.' : 'This interpreter returned text without exposing a separate exit code.') :
          status === 0 ? 'The shell returned 0 without printing any text. Commands can succeed quietly, especially when updating workspace state or redirecting output.' :
            'This interpreter supplied no text or exit code. A quiet command can still change state. Use a follow-up check to verify its effect.'
      ],
      [topic ? 'Open command help for the argument format, supported options, and examples.' :
        'Use Help to browse the syntax supported by this terminal.']);
  }

  TP.coach = { analyze };
})();

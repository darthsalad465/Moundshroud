// Terminal playground — the language of the shell, explained like you are five.
// These become pages in the Help window (chapter SHELL SYNTAX / Language basics) and are searchable by symbol:
// ", ', \\, $, `, *, >, | and so on. Nothing here runs on its own; each page has a safe example to try.
(() => {
  const TP = (window.TerminalPlayground = window.TerminalPlayground || {});
  const beginner = (TP.manualBeginner = TP.manualBeginner || {});
  const add = (shell, key, page) => {
    (beginner[shell] = beginner[shell] || {});
    beginner[shell][key] = Object.assign({ chapter: 'SHELL SYNTAX', hidden: true, syntaxPage: true }, page);
  };

  /* ---- Bash: the whole language, not just the commands ------------------------------------------------ */
  add('bash', 'quoting', {
    title: 'Quotes: keeping words together', name: 'quoting',
    meaning: 'Quotes are a pair of marks around words. They tell the shell “treat everything inside as one piece”. Without them, a space means “a new word starts here”.',
    detail: ['Use double quotes " " when you want spaces kept but still want $variables to work inside. Use single quotes \' \' when you want every character kept exactly as typed. A backslash \\ protects just the next character. There is no “opening quote and closing quote” command in Bash: a quote only has meaning in pairs, and an unclosed quote makes the shell wait for the rest (the prompt turns into >).'],
    example: 'echo "Hello, world"',
    result: 'Hello, world',
    aliases: ['"', "'", 'quote', 'quotes', 'double quote', 'single quote'],
    steps: [['echo', 'Print what comes after it.'], ['"Hello, world"', 'The quotes keep the space, so this is one argument, not two.']],
    options: { '"..."': 'Keep spaces, but still let $name and $(command) work inside.', "'...'": 'Keep every character exactly as typed; nothing inside is expanded.', '\\': 'Protect the single character after it.' }
  });
  add('bash', 'double quotes', {
    title: 'Double quotes " "', name: 'double quotes',
    meaning: 'Double quotes hold words together and still let the shell fill in $variables and $(commands). Use them whenever text has spaces.',
    detail: ['Inside double quotes, $name, ${name}, $(command), $((math)) and backticks still do their job. Characters like * ? [ ] and spaces become ordinary text instead of having a special meaning. To put a real double quote inside, write \\".'],
    example: 'echo "two   spaces stay together"',
    result: 'two   spaces stay together',
    aliases: ['"', '""', 'double-quote'],
    steps: [['"', 'Start of the quoted piece.'], ['two   spaces', 'The extra spaces are kept.'], ['"', 'End of the quoted piece.']]
  });
  add('bash', 'single quotes', {
    title: "Single quotes ' '", name: 'single quotes',
    meaning: 'Single quotes keep everything exactly as typed. Nothing inside is changed — not even $ or *.',
    detail: ["Use single quotes for text that contains $, backslashes or other shell punctuation that must stay literal. You cannot put a single quote inside single quotes; close the quote, write \\', and open it again: 'it'\\''s'."],
    example: "echo 'costs $5 and 100% sure'",
    result: 'costs $5 and 100% sure',
    aliases: ["'", "''", 'single-quote'],
    steps: [["'", 'Start of the literal piece.'], ['$5 and 100%', 'The dollar and the percent stay as typed.'], ["'", 'End of the literal piece.']]
  });
  add('bash', 'backslash', {
    title: 'The backslash \\', name: 'backslash',
    meaning: 'A backslash says “the next character is just a character, not a special instruction”.',
    detail: ['Outside quotes, \\ protects one character: \\$ is a dollar sign, \\ space is a space inside a word, \\" is a double quote. At the end of a line it means “the command continues on the next line”. Inside double quotes it still protects $, `, " and \\; inside single quotes it is just a backslash.'],
    example: 'echo Hello\\ world',
    result: 'Hello world',
    aliases: ['\\', 'escape', 'escaping', 'escape character'],
    steps: [['Hello', 'The first word.'], ['\\ ', 'The backslash protects the space, so the two words stay one argument.'], ['world', 'The rest of the same word.']]
  });
  add('bash', 'variables', {
    title: 'Variables: saving a value under a name', name: 'variables',
    meaning: 'A variable is a labelled box. You put a value in it once, then use the name to get the value back.',
    detail: ['Set it with name=value — no spaces around the =. Read it with $name or ${name}. ${name} is the safe form when letters follow: ${file}.txt. A variable set in a terminal lasts until you close it; export makes it available to commands you start. env and printenv list variables, unset removes one, and quote "$name" so spaces inside stay together.'],
    example: 'name=Ada; echo "Hello, $name"',
    result: 'Hello, Ada',
    aliases: ['$', 'variable', 'variables', 'assignment'],
    steps: [['name=Ada', 'Put Ada in a box labelled name.'], [';', 'End of this command; the next one starts.'], ['"Hello, $name"', 'Double quotes let $name be replaced by Ada.']],
    options: { '$name': 'The value in the box called name.', '${name}': 'The same, written safely when more letters follow.', 'export name=value': 'Make it visible to programs you start.', 'unset name': 'Throw the box away.' }
  });
  add('bash', 'parameter expansion', {
    title: 'Filling in a variable: ${…}', name: 'parameter expansion',
    meaning: 'The braces ${ } let you do more than read a variable: cut a piece off, give a default, or find its length.',
    detail: ['${name:-guest} uses guest when the variable is empty. ${#name} is how many characters it holds. ${file%.txt} removes a suffix, ${file#*/} removes a prefix. ${name^^} makes it upper case in Bash 4.'],
    example: 'name=; echo "Hello, ${name:-friend}"',
    result: 'Hello, friend',
    aliases: ['${', '${}', 'expansion', 'braces in variables'],
    steps: [['name=', 'An empty variable.'], ['${name:-friend}', 'If name is empty, use friend instead.'], ['echo', 'Print the result.']]
  });
  add('bash', 'command substitution', {
    title: 'Putting one command inside another: $( )', name: 'command substitution',
    meaning: '$(command) runs a command first and puts its answer where you wrote it.',
    detail: ['The old form uses backticks: `command`. $() nests more clearly, so use it. Quote it — "$(command)" — when the answer may contain spaces. The command runs in a subshell, so variables it sets do not survive afterwards.'],
    example: 'echo "Today is $(date +%A)"',
    result: 'Today is Thursday',
    aliases: ['$(', '$()', '`', 'backtick', 'backticks', 'substitution'],
    steps: [['echo "Today is ', 'Start a sentence.'], ['$(date +%A)', 'Run date +%A and put the day name here.'], ['"', 'Close the quoted sentence.']]
  });
  add('bash', 'arithmetic', {
    title: 'Doing maths: $(( ))' , name: 'arithmetic',
    meaning: 'Put a sum inside $(( )) and the shell works it out for you.',
    detail: ['$(( )) understands + - * / % (remainder) and powers **. Whole numbers only. Without the $ you can still assign: total=$((total + 1)). For decimals use bc.'],
    example: 'echo $((3 + 4 * 2))',
    result: '11',
    aliases: ['$((', 'math', 'arithmetic', 'calculate'],
    steps: [['$((', 'Start of the maths box.'], ['3 + 4 * 2', 'Multiplication happens before addition, as in school.'], ['))', 'End of the maths box; echo prints 11.']]
  });
  add('bash', 'braces & globs', {
    title: 'Wildcards: * and ?', name: 'globs',
    meaning: '* means “any letters”. ? means “exactly one letter”. [abc] means “one of these letters”.',
    detail: ['The shell itself expands a wildcard into the matching names before the command runs. If nothing matches, Bash leaves the pattern as typed (unless nullglob is on). Quote the pattern when you want the command to receive it literally, as with grep "a*".'],
    example: 'ls projects/*',
    result: 'The names of everything inside projects.',
    aliases: ['*', '?', '[]', 'wildcard', 'wildcards', 'glob', 'globbing'],
    steps: [['ls', 'List names.'], ['projects/*', 'Anything inside projects: * stands for every name.']]
  });
  add('bash', 'redirection', {
    title: 'Redirection: sending output into a file', name: 'redirection',
    meaning: 'Normally an answer appears on the screen. A > sends it into a file instead. >> adds to the end of the file.',
    detail: ['1 is normal output, 2 is errors. command > out.txt 2> err.txt keeps them apart; command > out.txt 2>&1 puts both together. < reads a file as input, <<< reads a here-string, and <<EOF starts a here-document. A single > replaces the file, so >> is safer when adding.'],
    example: 'echo "saved" > note.txt; cat note.txt',
    result: 'saved',
    aliases: ['>', '>>', '<', '2>', '2>&1', 'redirect', 'redirection'],
    steps: [['echo "saved"', 'Make the text saved.'], ['>', 'Send it into a file instead of the screen.'], ['note.txt', 'The file name.'], ['cat note.txt', 'Read the file back.']],
    options: { '>': 'Replace the file with the output.', '>>': 'Add the output to the end.', '2>': 'Send error messages somewhere else.', '2>&1': 'Send errors to the same place as normal output.', '<': 'Read input from a file.', '<<<': 'Read input from the text after it.' }
  });
  add('bash', 'pipes & chaining', {
    title: 'Pipes: passing an answer on', name: 'pipes',
    meaning: 'The | mark takes the answer of the command on the left and gives it to the command on the right as its input.',
    detail: ['A pipe is not a file: the data streams through. Each stage runs at the same time, so a later stage can start before the first finishes. Use && to run the next command only if the first worked, || only if it failed, and ; always. Every stage has its own exit code; $? is the last one.'],
    example: 'echo "red green blue" | wc -w',
    result: '3',
    aliases: ['|', 'pipe', 'pipeline', 'pipes'],
    steps: [['echo "red green blue"', 'Make one line with three words.'], ['|', 'Hand that line to the next command.'], ['wc -w', 'Count the words it received.']]
  });
  add('bash', 'comments', {
    title: 'Comments: notes the shell ignores', name: 'comments',
    meaning: 'A # starts a note. Everything after it on that line is for humans, not the computer.',
    detail: ['A # inside quotes is ordinary text, not a comment. Shebang lines start with #! and are read by the system, not the shell.'],
    example: 'echo hi # this note is ignored',
    result: 'hi',
    aliases: ['#', 'comment', 'comments'],
    steps: [['echo hi', 'The real command.'], ['# this note is ignored', 'From # to the end of the line, the shell reads nothing.']]
  });
  add('bash', 'exit status', {
    title: 'Exit codes and $?', name: 'exit status',
    meaning: 'Every command ends with a number. 0 means “it worked”; anything else means “there was a problem”.',
    detail: ['$? holds the last exit code. true always returns 0, false returns 1. grep returns 0 when it found a match and 1 when it did not, which is why scripts can test it. A pipeline normally reports only its last stage unless pipefail is set.'],
    example: 'true; echo $?',
    result: '0',
    aliases: ['$?', 'exit code', 'status', 'return code'],
    steps: [['true', 'A command that always succeeds.'], [';', 'Then…'], ['echo $?', 'Print the number the last command ended with (0).']]
  });
  add('bash', 'here string', {
    title: 'Here strings: <<<', name: 'here string',
    meaning: '<<< hands the text after it to a command as if it were typed input.',
    detail: ['It saves making a file or a pipe for a single short piece of input. A here-document (<<EOF … EOF) does the same for many lines.'],
    example: 'wc -w <<< "one two three"',
    result: '3',
    aliases: ['<<<', 'here string', 'heredoc', 'here document', '<<'],
    steps: [['wc -w', 'Count words.'], ['<<<', 'Take the text after this as input.'], ['"one two three"', 'The text, kept together by double quotes.']]
  });
  add('bash', 'functions', {
    title: 'Functions: naming a group of commands', name: 'functions',
    meaning: 'A function is a small command you build out of other commands and give a name. $1, $2 are the words you pass in.',
    detail: ['Define it with name() { commands; }. It runs in the same shell, so it can change variables and cd. Call it like any command. Use local inside it to keep a variable inside.'],
    example: 'greet() { echo "Hello, $1"; }; greet Ada',
    result: 'Hello, Ada',
    aliases: ['()', 'function', 'functions'],
    steps: [['greet()', 'Start a function called greet.'], ['{ echo "Hello, $1"; }', 'The body: $1 is the first word given when it runs.'], ['greet Ada', 'Run it with Ada as the first word.']]
  });
  add('bash', 'for', {
    title: 'Loops: do something for each item', name: 'for',
    meaning: 'A for loop takes a list and runs the same commands once for every item on the list.',
    detail: ['The shape is for name in list; do …; done. Write "$name" in quotes so an item with spaces stays one piece. for ((i=1; i<=3; i++)) counts with numbers instead. while repeats as long as a test succeeds; until repeats until it does.'],
    example: 'for n in one two three; do echo "item: $n"; done',
    result: 'item: one\nitem: two\nitem: three',
    aliases: ['loop', 'loops', 'for loop'],
    steps: [['for n in one two three', 'Go through three words, naming each one n.'], ['; do', 'Start the part to repeat.'], ['echo "item: $n"', 'The repeated command.'], ['; done', 'Finish the loop.']]
  });
  add('bash', 'if', {
    title: 'Making a decision: if', name: 'if',
    meaning: 'An if runs some commands only when a test is true, and can run others when it is false.',
    detail: ['Shape: if TEST; then …; elif TEST; then …; else …; fi. TEST is usually [ … ] or [[ … ]] or a command such as grep. Spaces inside [ ] matter: if [ "$name" = Ada ]; then …; fi.'],
    example: 'if [ -f notes.txt ]; then echo "the file is here"; else echo "no file"; fi',
    result: 'the file is here',
    aliases: ['if statement', 'condition', 'conditional', 'then', 'else'],
    steps: [['if [ -f notes.txt ]', 'Ask whether notes.txt is a normal file.'], ['; then', 'If it is…'], ['echo "the file is here"', '…say so.'], ['; else …; fi', 'Otherwise say there is no file, then end the if.']]
  });
  add('bash', 'test', {
    title: 'Tests: [ ] checks a fact', name: 'test',
    meaning: 'Square brackets ask a yes-or-no question about a file or some text. The answer is an exit code: true means 0.',
    detail: ['-f is a file, -d is a folder, -e exists, -r readable, -w writable, -x runnable, -s not empty. For text: -z empty, -n not empty, = equal, != different. For numbers: -eq -ne -lt -le -gt -ge. Keep spaces around everything inside the brackets.'],
    example: 'test -f notes.txt && echo "yes, a file"',
    result: 'yes, a file',
    aliases: ['[', ']', '[[', 'test command', 'comparison'],
    steps: [['test -f notes.txt', 'Ask: is notes.txt a file?'], ['&&', 'Only continue if the answer was yes.'], ['echo "yes, a file"', 'Say the answer out loud.']]
  });
  add('bash', 'script', {
    title: 'Scripts: a file full of commands', name: 'script',
    meaning: 'A script is a text file with commands in it, run from top to bottom.',
    detail: ['Start it with #!/bin/bash (the shebang) so the system knows which program reads it, make it runnable with chmod +x file.sh, then run ./file.sh. Or run it with bash file.sh without changing permissions. A script gets its own shell, so it does not change your variables or your folder unless you source it.'],
    example: 'echo "echo hello from the script" > run.sh; bash run.sh',
    result: 'hello from the script',
    aliases: ['#!/bin/bash', 'shebang', 'script', 'scripts', '.sh'],
    steps: [['echo "echo hello…" > run.sh', 'Write a one-line script into a file.'], [';', 'Then…'], ['bash run.sh', 'Ask Bash to run that file.']]
  });
  add('bash', 'history', {
    title: 'History: reusing commands you typed', name: 'history',
    meaning: 'The shell remembers what you typed. history lists it; !! repeats the last command; !num runs number num.',
    detail: ['!$ is the last word of the previous command, !* all its words. Ctrl+R searches history. Up and Down step through it. history -c clears the list.'],
    example: 'echo first; !!',
    result: 'first\nfirst',
    aliases: ['!!', '!', 'bang', 'history expansion'],
    steps: [['echo first', 'A command that goes into history.'], [';', 'Then…'], ['!!', 'Run the previous command again, unchanged.']]
  });
  add('bash', 'job control', {
    title: 'Background jobs: & and jobs', name: 'job control',
    meaning: 'An & at the end of a command starts it in the background, so you get your prompt back while it still runs.',
    detail: ['jobs lists background jobs with numbers. fg brings one to the front, bg restarts a stopped one in the background, and kill %1 stops job 1. Ctrl+Z pauses the foreground job, Ctrl+C interrupts it.'],
    example: 'sleep 2 & jobs',
    result: '[1]+ Running  sleep 2 &',
    aliases: ['&', 'jobs', 'background', 'foreground', 'ctrl+c', 'ctrl+z'],
    steps: [['sleep 2', 'A command that takes two seconds.'], ['&', 'Start it in the background.'], ['jobs', 'List what is running in the background.']]
  });
  add('bash', 'environment', {
    title: 'Environment: variables every program can see', name: 'environment',
    meaning: 'Some variables are handed to every program you start. PATH is the list of folders the shell searches for commands.',
    detail: ['export name=value shares a variable with programs you start. env or printenv lists them. PATH is why typing ls works without a full path: the shell tries each folder in PATH in turn. Add a folder with export PATH="$PATH:$HOME/bin".'],
    example: 'echo "$PATH"',
    result: 'A colon-separated list of folders, such as /usr/local/bin:/usr/bin:/bin',
    aliases: ['PATH', 'env', 'environment', 'export'],
    steps: [['"$PATH"', 'The value of PATH, kept together by quotes.'], ['echo', 'Print it; the folders are separated by colons.']]
  });
  add('bash', 'word splitting', {
    title: 'Spaces split words (and quotes stop them)', name: 'word splitting',
    meaning: 'After the shell fills in variables, it breaks the result on spaces unless you quoted it.',
    detail: ['This is the number one source of surprises. file="my notes.txt"; cat $file looks for two files, my and notes.txt; cat "$file" looks for one. Always quote variable expansions unless you truly want splitting (and then you usually want a loop over "$@" instead).'],
    example: 'file="my notes"; printf "<%s>\\n" $file; printf "<%s>\\n" "$file"',
    result: '<my>\n<notes>\n<my notes>',
    aliases: ['splitting', 'spaces', 'word split'],
    steps: [['file="my notes"', 'One value with a space inside.'], ['$file', 'Unquoted: two words, so printf prints two lines.'], ['"$file"', 'Quoted: one word, so printf prints it as a single line.']]
  });

  add('bash', 'read', {
    title: 'read: taking a line of input', name: 'read', syntaxPage: false,
    meaning: 'read waits for a line of text and puts it in a variable.',
    detail: ['read name puts the whole line in name; read first rest puts the first word in first and the remainder in rest. -r keeps backslashes as typed, -s hides what is typed (passwords), -p shows a prompt. It is usually used inside a script or a loop.'],
    example: 'echo Ada | { read name; echo "Hello, $name"; }',
    result: 'Hello, Ada',
    aliases: ['read input', 'stdin'],
    steps: [['echo Ada', 'Make a line of input.'], ['|', 'Hand it to the next part.'], ['read name', 'Put the line into the variable name.'], ['echo "Hello, $name"', 'Use it.']]
  });
  add('bash', 'alias', {
    title: 'alias: a nickname for a command', name: 'alias', syntaxPage: false,
    meaning: 'An alias is a short name you invent for a longer command.',
    detail: ['alias ll=\'ls -l\' makes ll mean ls -l for this session. alias alone lists them, unalias ll removes one. Aliases live in your shell, not in files, and are not passed to scripts. Put them in ~/.bashrc to keep them.'],
    example: "alias ll='ls -l'; ll",
    result: 'A long file list.',
    aliases: ['nickname', 'unalias'],
    steps: [['alias ll=\'ls -l\'', 'Teach the shell the nickname ll.'], [';', 'Then…'], ['ll', 'Run the long command by its short name.']]
  });
  add('bash', 'source', {
    title: 'source: run a file in this shell', name: 'source', syntaxPage: false,
    meaning: 'source reads a file and runs its commands in your current shell, so changes to variables and folders stay.',
    detail: ['Running bash file.sh uses a fresh shell; source file.sh (or . file.sh) uses yours. That is why .bashrc is sourced: its aliases and variables must survive.'],
    example: "echo 'echo hi' > s.sh; source s.sh",
    result: 'hi',
    aliases: ['.', 'dot command'],
    steps: [['echo \'echo hi\' > s.sh', 'Write a small script.'], [';', 'Then…'], ['source s.sh', 'Run it in this shell.']]
  });
  add('bash', 'tilde', {
    title: 'The tilde ~', name: 'tilde',
    meaning: '~ is a shortcut for your home folder.',
    detail: ['cd ~ goes home, ~/notes.txt is a file in your home folder. It is expanded by the shell before the command runs, so it only works unquoted: inside quotes it stays a plain tilde. Use $HOME when you need it inside quotes.'],
    example: 'echo "$HOME"',
    result: '/home/moundshroud',
    aliases: ['~', 'home folder'],
    steps: [['"$HOME"', 'The home folder path, quoted so it stays one value.'], ['echo', 'Print it.']]
  });
  add('bash', 'shell options', {
    title: 'Shell options: set -e, pipefail and friends', name: 'shell options',
    meaning: 'set changes how the shell itself behaves for the rest of the session.',
    detail: ['set -e stops a script at the first failing command. set -u treats an unset variable as an error. set -o pipefail makes a pipeline fail if any stage fails. set -x prints each command before running it (very useful for debugging). set +e / +u / +o undo them. This sandbox accepts only a few options, but the ideas are the same in real Bash.'],
    example: 'set -o pipefail; echo ok',
    result: 'ok',
    aliases: ['set -e', 'pipefail', 'errexit', 'set -x'],
    steps: [['set -o pipefail', 'Make a pipeline fail if any stage fails.'], [';', 'Then…'], ['echo ok', 'The rest of the session uses that setting.']]
  });

  /* ---- PowerShell ------------------------------------------------------------------------------------- */
  add('powershell', 'quoting', {
    title: 'Quotes in PowerShell', name: 'quoting',
    meaning: 'Single quotes keep text exactly as typed. Double quotes let PowerShell fill in $variables inside.',
    detail: ['Two single quotes inside single quotes mean one real quote: \'it\'\'s\'. A backtick ` protects the next character in double quotes.'],
    chapter: 'SHELL SYNTAX', hidden: true,
    example: 'Write-Output "hello   with spaces"',
    result: 'hello   with spaces',
    aliases: ['"', "'", 'quote', 'quotes', 'double quote', 'single quote'],
    steps: [['"', 'Start a double-quoted piece.'], ['hello   with spaces', 'The spaces stay together, exactly as typed.'], ['"', 'End the quoted piece.']]
  });
  add('powershell', 'variables', {
    title: 'Variables in PowerShell', name: 'variables',
    meaning: 'A variable starts with $ and holds a value you can use again.',
    detail: ['Set it with $name = "Ada". Read it with $name. ${name} helps when letters follow. $env:PATH reads an environment variable; $env:NAME = value sets one.'],
    chapter: 'SHELL SYNTAX', hidden: true,
    example: '$name = "Ada"; Write-Output "Hello, $name"',
    result: 'Hello, Ada',
    aliases: ['$', 'variable', 'variables'],
    steps: [['$name = "Ada"', 'Store Ada under the name.'], [';', 'Then…'], ['"Hello, $name"', 'Double quotes fill in the value.']]
  });
  add('powershell', 'escape character', {
    title: 'The backtick ` escape', name: 'escape character',
    meaning: 'In PowerShell a backtick protects the next character, and `n means a new line.',
    detail: ['It is PowerShell’s backslash. `t is a tab, `" is a double quote inside double quotes, and a backtick at the end of a line continues the command.'],
    chapter: 'SHELL SYNTAX', hidden: true,
    example: 'Write-Output "one`ntwo"',
    result: 'one\ntwo',
    aliases: ['`', 'escape', 'backtick'],
    steps: [['"one', 'First line of text.'], ['`n', 'A new line.'], ['two"', 'Second line.']]
  });
  add('powershell', 'pipelines', {
    title: 'Pipes in PowerShell', name: 'pipelines',
    meaning: 'A | passes whole objects, not just text, from one command to the next.',
    detail: ['That is why you can sort, filter and measure what came before: Get-ChildItem | Where-Object Length -gt 100 | Sort-Object Length. Where-Object filters, ForEach-Object changes each item, Select-Object picks properties or a number of rows.'],
    chapter: 'SHELL SYNTAX', hidden: true,
    example: 'Get-ChildItem | Measure-Object',
    result: 'Count : 12',
    aliases: ['|', 'pipe', 'pipeline', 'where-object', 'foreach-object'],
    steps: [['Get-ChildItem', 'Make one object per file.'], ['|', 'Pass them on.'], ['Measure-Object', 'Count them and show the total.']]
  });

  /* ---- Command Prompt --------------------------------------------------------------------------------- */
  add('cmd', 'quoting', {
    title: 'Quotes in Command Prompt', name: 'quoting',
    meaning: 'Quotes hold a path or text with spaces together. Double quotes are the ones cmd understands.',
    detail: ['A backslash does not protect a double quote in cmd; write two double quotes inside a quoted string, or use ^ when outside quotes. Single quotes have no special meaning in cmd — they are just characters.'],
    chapter: 'SHELL SYNTAX', hidden: true,
    example: 'echo "hello   world"',
    result: 'hello   world',
    aliases: ['"', "'", 'quote', 'quotes'],
    steps: [['echo', 'Print text.'], ['"hello   world"', 'The quotes keep the spaces together.']]
  });
  add('cmd', 'variables', {
    title: 'Variables: %NAME%', name: 'variables',
    meaning: 'In cmd a variable is written between percent signs: %NAME%.',
    detail: ['set NAME=Ada makes it; echo %NAME% reads it. set with no name lists everything. %CD% is the current folder, %USERPROFILE% your home, %PATH% the command search path.'],
    chapter: 'SHELL SYNTAX', hidden: true,
    example: 'set NAME=Ada & echo %NAME%',
    result: 'Ada',
    aliases: ['%', '%NAME%', 'variable', 'variables', 'set'],
    steps: [['set NAME=Ada', 'Store Ada.'], ['&', 'Then run the next command.'], ['echo %NAME%', 'Print the value.']]
  });
  add('cmd', 'escape character', {
    title: 'The caret ^ escape', name: 'escape character',
    meaning: 'A caret makes the next character ordinary, so you can print & | < > or ^ itself.',
    detail: ['Inside double quotes most of these are already ordinary. %% prints a percent sign inside a batch file.'],
    chapter: 'SHELL SYNTAX', hidden: true,
    example: 'echo 5 ^> 3',
    result: '5 > 3',
    aliases: ['^', 'escape', 'caret'],
    steps: [['echo 5', 'First part of the text.'], ['^>', 'Print a real > instead of redirecting.'], ['3', 'The rest of the text.']]
  });
  add('cmd', 'pipes', {
    title: 'Pipes in Command Prompt', name: 'pipes',
    meaning: 'A | sends the output of one command into another command as input.',
    detail: ['dir | find "txt" keeps only lines containing txt. && runs the next command only if the first worked. & always runs the next one.'],
    chapter: 'SHELL SYNTAX', hidden: true,
    example: 'dir /b | find "txt"',
    result: 'notes.txt',
    aliases: ['|', 'pipe', 'pipeline'],
    steps: [['dir /b', 'List names only.'], ['|', 'Pass the list on.'], ['find "txt"', 'Keep only the lines with txt.']]
  });

  /* ---- Python and Node -------------------------------------------------------------------------------- */
  add('python', 'strings and quotes', {
    title: 'Text and quotes in Python', name: 'strings',
    meaning: 'Text goes inside quotes. Single and double quotes do the same job; pick one and stay consistent.',
    detail: ['A backslash escapes inside quotes: "it\'s", "line\\nnext". Triple quotes """…""" hold many lines. An f-string puts values in: f"Hello, {name}".'],
    chapter: 'Language basics', hidden: true,
    example: 'print(f"Hello, {\'Ada\'}")',
    result: 'Hello, Ada',
    aliases: ['"', "'", 'quote', 'string', 'strings', 'f-string'],
    steps: [['print(', 'Show the result.'], ['f"Hello, …"', 'The f lets the {…} part be replaced by its value.'], [')', 'Close the call.']]
  });
  add('python', 'comments and indentation', {
    title: 'Comments and indentation in Python', name: 'comments',
    meaning: 'A # starts a note. Spaces at the start of a line are part of the language, not decoration.',
    detail: ['Lines that belong together (inside if, for, def) share the same indentation, usually four spaces. Mixing tabs and spaces is an error. A # note is ignored by real Python; this one-line sandbox console does not accept comment-only lines, so write comments in a script file (.py).'],
    chapter: 'Language basics', hidden: true,
    example: 'print("hi")',
    result: 'hi',
    aliases: ['#', 'comment', 'indent', 'indentation'],
    steps: [['print("hi")', 'The command that runs. A # note would be ignored here in a script file.'], ['( )', 'Arguments go inside the brackets; indentation groups lines in longer programs.']]
  });
  add('node', 'strings and quotes', {
    title: 'Text and quotes in JavaScript', name: 'strings',
    meaning: 'Text uses single or double quotes. Backticks make a template string that can contain ${values}.',
    detail: ['Escape inside quotes with \\. Template strings can span lines and put expressions in ${…}. This prompt runs one short line at a time, so keep an example on one line.'],
    chapter: 'Language basics', hidden: true,
    example: 'console.log(`Hello, ${"Ada"}`)',
    result: 'Hello, Ada',
    aliases: ['"', "'", '`', 'template literal', 'string', 'strings'],
    steps: [['const name = "Ada"', 'Store text.'], ['`Hello, ${name}`', 'Backticks fill in the value.'], ['console.log(...)', 'Print it.']]
  });
  add('node', 'comments', {
    title: 'Comments in JavaScript', name: 'comments',
    meaning: '// makes the rest of the line a note. /* … */ makes a note across several lines.',
    chapter: 'Language basics', hidden: true,
    example: '// a note\nconsole.log("hi")',
    result: 'hi',
    aliases: ['//', '/*', 'comment', 'comments'],
    steps: [['// a note', 'Ignored by Node.'], ['console.log("hi")', 'Runs.']]
  });
  add('sql', 'strings and quoting', {
    title: 'Text in SQL: single quotes', name: 'strings',
    meaning: 'Text values go in single quotes. Double quotes name a table or column, not text.',
    detail: ['Two single quotes inside a string mean one quote: \'it\'\'s\'. End every statement with a semicolon. In real databases -- starts a comment and /* … */ comments several lines; this sandbox console only accepts one statement without comments.'],
    chapter: 'Language basics', hidden: true,
    example: "SELECT 'it''s fine' AS note;",
    result: "it's fine",
    aliases: ['"', "'", 'quote', 'quotes', 'string'],
    steps: [["'it''s fine'", 'The doubled quote becomes one real quote.'], ['AS note', 'Name the answer column.'], [';', 'End of the statement.']]
  });
  add('sql', 'comments', {
    title: 'Comments in SQL', name: 'comments',
    meaning: '-- makes the rest of the line a note; /* … */ makes a longer note.',
    chapter: 'Language basics', hidden: true,
    example: 'SELECT 1 AS one;',
    result: 'one\n1',
    aliases: ['--', '/*', 'comment', 'comments'],
    steps: [['SELECT 1 AS one;', 'The real query. Put -- a note after a semicolon in a real database; this sandbox console does not accept comments.'], ['AS one', 'Names the answer column.']]
  });

  /* ---- git, docker, network and encoding shells ------------------------------------------------------- */
  const cli = shell => {
    add(shell, 'quoting arguments', {
      title: 'Quoting arguments', name: 'quoting arguments',
      meaning: 'Put quotes around any value with spaces or punctuation, so the shell hands it over as one piece.',
      detail: ['Messages, paths with spaces and patterns with | or * all need quotes. Single quotes stop the shell from changing anything inside; double quotes still allow $variables.'],
      chapter: 'Command line basics', hidden: true,
      example: shell === 'git' ? 'git commit -m "first commit with a space"' : shell === 'docker' ? 'docker run --name "my box" hello-world' : shell === 'network' ? 'ping "10.0.0.5"' : 'base64 "hello world"',
      result: '',
      aliases: ['"', "'", 'quote', 'quotes'],
      steps: [['"', 'Start the quoted value.'], ['… with spaces', 'Everything stays one argument.'], ['"', 'End it.']]
    });
  };
  ['git', 'docker', 'network', 'crypto'].forEach(cli);
})();

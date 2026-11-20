// Original reference text for the Terminal Playground manual. Options describe the named command in context.
(() => {
  const TP = window.TerminalPlayground;
  const pages = Object.create(null);
  const core = 'https://www.gnu.org/software/coreutils/manual/coreutils.html';
  const bash = 'https://www.gnu.org/software/bash/manual/bash.html';
  const grep = 'https://www.gnu.org/software/grep/manual/grep.html';
  const ms = 'https://learn.microsoft.com/windows-server/administration/windows-commands/';
  const ps = 'https://learn.microsoft.com/powershell/scripting/overview';
  const py = 'https://docs.python.org/3/library/functions.html';
  const node = 'https://nodejs.org/api/repl.html';
  const sql = 'https://www.postgresql.org/docs/current/sql-select.html';
  const git = 'https://git-scm.com/docs/';
  const docker = 'https://docs.docker.com/reference/cli/docker/';
  const add = (shell, name, syntax, description, options = [], examples = [], note = '', source = '') => {
    (pages[shell] ||= Object.create(null))[name.toLowerCase()] = { name, syntax, description, options, examples, note, source };
  };
  const example = (command, result) => [command, result];
  const option = (flag, meaning, detail = '') => [flag, meaning, detail];

  add('bash', 'grep', 'grep [options] PATTERN [FILE ...]', [
    'Read text one line at a time and print the lines whose contents match a pattern. With a FILE argument, grep opens the file. With piped input, grep reads what the preceding command wrote.',
    'PATTERN is one argument. Quote it when it includes a space, or when punctuation should reach grep without the shell interpreting it. A comma in the pattern matches a comma in the input. Ignoring case does not ignore punctuation.',
    'The Playground uses JavaScript-style regular expressions. GNU grep’s basic and extended regex modes differ. In the Bash Sandbox, status 0 means a match, 1 means no matches, and 2 means an error.'
  ], [
    option('-i', 'Ignore differences between uppercase and lowercase.', 'For example, error also matches ERROR. Spacing and punctuation must still match.'),
    option('-n', 'Prefix each selected line with its original number.', 'Numbering starts at 1 for each input file. When reading a pipe, numbers refer to the incoming stream.'),
    option('-v', 'Select lines that do not match.', 'Useful for removing blank lines with grep -v "^$".'),
    option('-c', 'Print counts rather than matching text.', 'Counts selected lines. Repeated matching words on one line still contribute one selected line.'),
    option('-r, -R', 'Search inside directories recursively.', 'Use an explicit directory such as projects or . for the current directory. Directory traversal details vary by mode.'),
    option('-H', 'Prefix selected lines with their file names.', 'Available in Bash Sandbox. Input from a pipe has no filename to print.'),
    option('-o', 'Show matching text rather than the full line.', 'The Playground returns the first match on each selected line.'),
    option('-q', 'Suppress output and use exit status to detect a match.', 'Available in Bash Sandbox. Example: grep -q todo notes.txt && echo found.'),
    option('-l', 'List matching file names.', 'Available in Bash Sandbox. It is useful when the file containing a match matters more than the text.'),
    option('-F', 'Treat patterns as fixed strings in GNU grep.', 'Upstream option. Use simple literal patterns without regex punctuation in the Playground.')
  ], [
    example('grep -i -n "error" projects/api.log', 'Shows matches with line numbers, including lines with ERROR in uppercase.'),
    example('cat projects/api.log | grep -i -n "error"', 'Reads the same text from a pipe. Combine the flags as -in if you prefer.'),
    example('printf "%s\\n" "PROD, Verified" "prod verified" | grep -in "prod, verified"', 'Prints 1:PROD, Verified. The second line has no comma, so it does not match.')
  ], 'Start by checking the input with cat or head. An empty result often means the exact pattern is absent. Run pwd if a relative file path fails.', grep);

  add('bash', 'ls', 'ls [-a] [-l] [PATH ...]', 'List a directory or display the specified file. Omit PATH to list your current directory.', [
    option('-a', 'Include names beginning with a dot.', 'Use this when a puzzle mentions a hidden file.'),
    option('-l', 'Use a long listing.', 'Includes permission bits, owner information, size, and the name.'),
    option('-la', 'Combine -l and -a.', 'Shows both metadata and hidden names.')
  ], [example('ls -la', 'Inspect the current directory, including dotfiles.')], 'For the full path of your current directory, use pwd.', core);
  add('bash', 'cd', 'cd [DIRECTORY | -]', 'Change the shell’s current directory. This changes where relative paths start.', [
    option('-', 'Return to the previous working directory.'), option('..', 'Move up one directory level.'), option('~', 'Go to the shell’s home directory.')
  ], [example('cd projects && pwd', 'Changes into projects and prints the new location if cd succeeds.')], 'Absolute paths begin with /. A path such as var/log is relative and changes meaning after cd.', bash);
  add('bash', 'pwd', 'pwd', 'Print the absolute path of the current working directory. Use it to check where a relative filename will be resolved.', [], [example('pwd', 'Prints the current virtual directory, such as /home/dev.')], '', bash);
  add('bash', 'cat', 'cat [options] [FILE ...]', 'Write file contents to standard output in the order listed. With no file or with a lone -, read from standard input.', [
    option('-n', 'Number all output lines.'), option('-b', 'Number nonblank output lines.'), option('-E', 'Show line endings using a dollar sign.'),
    option('-s', 'Squeeze repeated adjacent blank lines.'), option('-T', 'In GNU cat, show tab characters as ^I.'),
    option('-A', 'In Bash Sandbox, mark line endings. GNU cat also makes tabs and other nonprinting characters visible.')
  ], [example('cat notes.txt', 'Read the complete file.'), example('cat notes.txt | grep -n todo', 'Pass the contents to grep.')], 'Use head or tail for large files. An error such as Permission denied comes from reading the file.', core);
  for (const [name, where] of [['head', 'first'], ['tail', 'last']]) {
    add('bash', name, name + ' [-n COUNT] [FILE]', 'Read the ' + where + ' lines of a file or of piped input. The default count is ten.', [
      option('-n COUNT', 'Choose a line count.', 'For example, -n 3 selects the ' + where + ' three lines.'),
      option('-COUNT', 'Compact Playground syntax for selecting lines.', '-3 is equivalent to -n 3 in the supplied examples.')
    ], [example(name + ' -n 3 projects/api.log', 'Shows the ' + where + ' three log entries.')], 'Following a live file is beyond the Playground’s static file view.', core);
  }
  add('bash', 'find', 'find [DIRECTORY] [-name PATTERN] [-type f|d]', 'Walk a directory tree and print matching paths. Use find for file names and grep for the text inside files.', [
    option('-name PATTERN', 'Match a basename against a wildcard.', 'Quote a pattern like "*.log" so find receives the wildcard itself.'),
    option('-iname PATTERN', 'Match a name without case sensitivity.'), option('-type f', 'Select regular files.'), option('-type d', 'Select directories.')
  ], [example('find . -name "*.log"', 'Look below the current directory for filenames ending in .log.')], '', 'https://www.gnu.org/software/findutils/manual/html_mono/find.html');
  add('bash', 'chmod', 'chmod [options] MODE PATH ...', 'Change permission bits. A symbolic mode selects a class, operation, and permission. An octal mode describes groups of permission bits for owner, group, and others.', [
    option('u+r', 'Add read access for the owner.', 'u selects the owner, + adds one bit, and r means read. The other bits are preserved.'),
    option('u-r, g+w, o=', 'Remove, add, or replace selected permissions.', '- removes a bit. = sets the selected class to the specified bits. a means all classes.'),
    option('644, 600', 'Set the ordinary bits with octal digits.', 'Each digit is read 4 + write 2 + execute 1. 644 gives the owner read/write and everyone else read.'),
    option('-R', 'Apply the change recursively.', 'Changes the directory and items below it.'),
    option('-c', 'Report changed modes.'), option('-v', 'Report each processed path.'), option('-f', 'Suppress access diagnostics where supported.'),
    option('--reference=FILE', 'Copy permission bits from FILE.')
  ], [example('chmod u+r notes.txt', 'Add owner read permission.'), example('stat -c %a notes.txt', 'Verify the resulting numeric mode.')], 'The named file must exist in your current virtual filesystem. Use its absolute path if you are in another directory.', core);
  add('bash', 'stat', 'stat [-c FORMAT] PATH ...', 'Read metadata such as the displayed permissions and size without opening the file contents.', [
    option('-c FORMAT, --format=FORMAT', 'Print only the requested fields.'), option('%a', 'Permissions as octal digits.'),
    option('%A', 'Permissions as letters and dashes.'), option('%n', 'Display the filename supplied.'), option('%%', 'Print a literal percent sign.')
  ], [example('stat -c "%a %A %n" notes.txt', 'Show numeric and symbolic modes next to the filename.')], '', core);
  add('bash', 'wc', 'wc [-lwc] [FILE]', 'Count newlines, words, and bytes. In the Bash Sandbox, a last line without a terminating newline contributes no newline to -l.', [
    option('-l', 'Count newline characters.'), option('-w', 'Count whitespace-separated words.'), option('-c', 'Count bytes.'), option('-m', 'Count characters in Bash Sandbox.')
  ], [example('cat projects/api.log | grep ERROR | wc -l', 'Count the matching log records produced by grep.')], 'Bytes and characters can differ for accented letters and emoji.', core);
  add('bash', 'sort', 'sort [-nru] [-t SEP] [-k FIELD] [FILE]', 'Reorder text lines. The default comparison is text order, so 10 may precede 2. Choose numeric order when values are numbers.', [
    option('-n', 'Sort numbers numerically.'), option('-r', 'Reverse the order.'), option('-u', 'Keep one line for each equal sort key.'),
    option('-t SEP', 'Choose a field separator.'), option('-k FIELD', 'Choose a sort field, numbered from 1.')
  ], [example('printf "%s\\n" 10 2 4 | sort -n', 'Produces 2, 4, and 10 on separate lines in Bash Sandbox.')], '', core);
  add('bash', 'uniq', 'uniq [-cdui] [FILE]', 'Combine consecutive runs of equal lines. Sort first when repeated lines are scattered throughout the input.', [
    option('-c', 'Prefix each run with its count.'), option('-d', 'Keep runs containing duplicates.'), option('-u', 'Keep lines that appear once in their run.'),
    option('-i', 'Compare case-insensitively in Bash Sandbox.')
  ], [example('printf "%s\\n" a b a | sort | uniq -c', 'Prints a count of two for a and one for b.')], '', core);
  add('bash', 'cut', 'cut -d SEPARATOR -f FIELDS [FILE]', 'Extract selected fields from each line. This is suitable for simple delimited text. CSV files with quoted commas need a CSV parser.', [
    option('-d SEPARATOR', 'Set the character that separates fields.'), option('-f FIELDS', 'Select fields, numbered from 1.', '-f2 selects field 2. -f2- selects field 2 and all fields after it.')
  ], [example('echo "env,prod,verified" | cut -d, -f2', 'Prints prod.')], '', core);
  add('bash', 'tr', 'tr [-d] SET1 [SET2]', 'Translate characters read from standard input. tr accepts text from a pipe or input redirection.', [
    option('-d', 'Delete characters in SET1.'), option('a-z A-Z', 'Translate corresponding lowercase letters to uppercase.'),
    option('-s', 'Squeeze consecutive repeats of the specified characters.', 'Bash Sandbox supports this mode with one set, as in tr -s " ".')
  ], [example('tr a-z A-Z < notes.txt', 'Read notes.txt and transform lowercase letters to uppercase.')], '', core);
  add('bash', 'sed', 'sed \'s/PATTERN/REPLACEMENT/FLAGS\' [FILE]', 'Transform each input line with an editing command. The Playground accepts a limited substitution form.', [
    option('s', 'Start a substitution.'), option('g', 'Replace all occurrences on each line.'), option('i', 'Ignore case in the substitution pattern. Use it after the final separator.')
  ], [example('sed \'s/ERROR/FATAL/g\' projects/api.log', 'Prints changed text in the terminal. The original file is kept unless you explicitly write output back.')], '', 'https://www.gnu.org/software/sed/manual/sed.html');
  add('bash', 'awk', 'awk [-F SEP] \'{print FIELD, FIELD}\' [FILE]', 'Work with records and their fields. The Playground supports common field extraction using a print program.', [
    option('-F SEP', 'Set the field separator.'), option('$0', 'The whole current line.'), option('$1, $2', 'The first and second fields, respectively.')
  ], [example('awk \'{print $1, $2}\' projects/api.log', 'Prints the first two whitespace-separated fields from every record.')], 'Quote the program with single quotes so the shell leaves `$1` and `$2` for awk.', 'https://www.gnu.org/software/gawk/manual/gawk.html');
  add('bash', 'base64', 'base64 [-d] [FILE]', 'Encode bytes as printable Base64 text or reverse that encoding. A Base64 string represents bytes and uses no secret key.', [
    option('-d, --decode', 'Read encoded text and reconstruct the underlying bytes.')
  ], [example('echo aGVsbG8= | base64 -d', 'Prints hello.')], 'For stacked layers, apply the decoders in the order shown by the checkpoint policy.', core);
  add('bash', 'xxd', 'xxd [-r] [FILE]', 'Display hexadecimal bytes or reverse a supported hex representation. One byte is represented by two hex digits.', [
    option('-r', 'Reverse a hex dump or the Playground’s simulated hex representation.'), option('-p', 'Use plain hex in real xxd.', 'The Playground’s fixture format may differ from the address-prefixed output of real xxd.')
  ], [example('echo 68656c6c6f | xxd -r', 'Decodes the Playground fixture to hello.')], 'When running real xxd on plain hex, use xxd -r -p.', 'https://vimhelp.org/xxd.txt.html');
  for (const name of ['sha256sum', 'sha1sum', 'md5sum']) {
    add('bash', name, name + ' [-c] [FILE ...]', 'Calculate a digest from exact input bytes. A digest lets you compare a file against a recorded value. It does not reveal the original bytes.', [
      option('-c, --check', 'Read expected digests from a manifest and verify the listed files.'), option('-b', 'Mark output as binary-format input.'), option('-t', 'Mark output as text-format input.')
    ], [example(name + ' notes.txt', 'Prints a digest and the filename.')], 'A final newline changes the digest. Match the algorithm named in the evidence manifest. For new integrity workflows, use SHA-256.', core);
  }
  add('bash', 'printf', 'printf FORMAT [ARG ...]', 'Print data using an explicit format. Unlike the usual echo behavior, printf only writes a newline when the format requests one.', [
    option('%s', 'Insert a string.'), option('%d', 'Format an integer.'), option('%b', 'Interpret supported backslash escapes in the argument.'), option('\\n', 'Write a newline.'), option('%%', 'Print a percent sign.'), option('-v NAME', 'Store the result in a Bash Sandbox variable.')
  ], [example('printf "<%s>\\n" alpha beta', 'Produces one formatted line per argument.')], '', bash);
  add('bash', 'echo', 'echo [-n] [TEXT ...]', 'Print arguments with a space between them. In ordinary use, echo adds a final newline.', [option('-n', 'Suppress the final newline.'), option('-e', 'Interpret supported backslash escapes in Bash Sandbox.'), option('-E', 'Disable backslash interpretation in Bash Sandbox.')],
    [example('echo -n hello', 'Writes the five letters without a final newline.')], 'Use printf when exact output bytes matter.', bash);
  for (const [name, description, opts] of [
    ['mkdir', 'Create a directory at the specified virtual path.', [option('-p', 'Create missing parent directories and accept an existing directory.')]],
    ['rm', 'Remove virtual filesystem entries. Recursive removal includes the contents of directories.', [option('-r, -R', 'Remove directories and their contents.'), option('-f', 'Suppress missing-file complaints.')]],
    ['tee', 'Copy piped input to the screen and to a file at the same time.', [option('-a', 'Append rather than overwrite.')]],
    ['touch', 'Create an empty file when a path does not exist.', []],
    ['rmdir', 'Remove an empty directory. A directory with files still in it is rejected.', []],
    ['cp', 'Copy a file to a second virtual path. The source remains available.', []],
    ['mv', 'Rename a virtual file or move it to another virtual path.', []]
  ]) {
    const operands = ['cp', 'mv'].includes(name) ? ' SOURCE DESTINATION' : ' PATH';
    add('bash', name, name + (opts.length ? ' [options]' : '') + operands, description, opts, [], 'These descriptions refer to the Playground filesystem.', core);
  }

  add('bash', 'pipes & chaining', 'COMMAND | FILTER     COMMAND && NEXT     COMMAND || FALLBACK', 'A pipe moves output from one command into the next command’s input. Chaining operators decide which command to run based on exit status.', [
    option('|', 'Pipe standard output.'), option('|&', 'Pipe standard output and errors in Bash Sandbox.'),
    option('&&', 'Run the next command on success.'), option('||', 'Run the next command on failure.'), option(';', 'Run the next command regardless of status.'),
    option('set -o pipefail', 'Use the rightmost failed stage as the pipeline status in Bash Sandbox.'), option('$?', 'Get the last exit status.')
  ], [example('false || echo fallback', 'Prints fallback in Bash Sandbox.')], 'Puzzle rooms and Labyrinth accept many pipes and chains, with fewer Bash scripting features.', bash);
  add('bash', 'redirection', 'COMMAND > FILE      COMMAND >> FILE      COMMAND < FILE', 'Connect a command’s input or output to a file. The Bash Sandbox applies file redirections from left to right.', [
    option('>', 'Write output to a file, replacing the old contents.'), option('>>', 'Append output to a file.'), option('<', 'Read input from a file.'),
    option('2>', 'Send diagnostics to a file in Bash Sandbox.'), option('2>&1', 'Send diagnostics to the current output destination in Bash Sandbox.'),
    option('<<<', 'Feed a string followed by a newline in Bash Sandbox.')
  ], [example('grep todo notes.txt > matches.txt', 'Save output in the virtual file matches.txt.')], 'Quote paths with spaces. Check a destination before replacing it.', bash);
  add('bash', 'braces & globs', 'file{1,2}.txt     file*.txt     file?.txt', 'Brace expansion generates candidate words. Globs match names in the virtual directory. Quote a pattern when the receiving command should interpret it.', [
    option('{a,b}', 'Generate one word per listed alternative.'), option('*', 'Match zero or more characters in a path component.'), option('?', 'Match one character.'),
    option('[abc]', 'Match one character from the set.')
  ], [example('cat fragments/part{1,2,3}.txt', 'Read three files in order if the active challenge supplies those files.')], '', bash);

  for (const [name, description, opts, cmd, source] of [
    ['capinfos', 'Report metadata for bundled packet-capture files.', [option('-t','Show capture file type.'),option('-c','Count packets.'),option('-E','Show link-layer encapsulation.'),option('-d','Sum original packet lengths in bytes.')], 'capinfos -tc baseline.pcapng incident.pcapng', 'https://www.wireshark.org/docs/man-pages/capinfos.html'],
    ['tshark', 'View recorded packets and extract fields from a bundled capture.', [option('-r FILE','Read a bundled capture file.'),option('-Y FILTER','Apply a display filter to decoded packets.'),option('-T fields','Produce field-oriented output.'),option('-e FIELD','Select a field. Repeat the option to select multiple columns.'),option('-E header=y','Add field names as a header.')], 'tshark -r incident.pcapng -Y dns -T fields -e frame.number -e dns.qry.name', 'https://www.wireshark.org/docs/man-pages/tshark.html'],
    ['tcpdump', 'Print packet summaries from bundled capture evidence.', [option('-nn','Display numeric addresses and ports.'),option('-r FILE','Read a saved capture.'),option('-c COUNT','Stop after this many matching packets.'),option('tcp and dst port 443','Select TCP packets whose destination port is 443.')], 'tcpdump -nn -r incident.pcapng tcp and dst port 443', 'https://www.kali.org/tools/tcpdump/'],
    ['yara', 'Compare a bundled artifact with the provided training indicator rules.', [option('-s','Print matching strings and their offsets.'),option('-c','Print the number of matching rules.')], 'yara -s indicators.yar incident-artifact.txt', 'https://yara.readthedocs.io/en/stable/commandline.html'],
    ['jq', 'Read JSON or a bundled event log and apply a filter. Use single quotes around the filter so its pipes and double quotes reach jq.', [option('-r','Print string results without surrounding JSON quotes.'),option('-c','Print compact JSON.'),option('.field','Select an object field.'),option('.items[]','Yield the members of an array.'),option('select(CONDITION)','Keep values where the supported condition matches.')], 'jq -r \'select(.event_type == "alert") | .alert.signature\' eve.json', 'https://jqlang.org/manual/'],
    ['lastb', 'Inspect recent failed login records from the bundled evidence.', [option('-n COUNT','Limit the number of displayed records.'),option('USER','Restrict output to matching account names.')], 'lastb -n 2 ops', 'https://raw.githubusercontent.com/util-linux/util-linux/v2.39/login-utils/last.1.adoc'],
    ['password-audit', 'Read synthetic password policy findings and outcomes for the training sample.', [option('--format csv','Return comma-separated findings for text pipelines.'),option('--format json','Return structured findings suitable for jq.')], 'password-audit --format json', 'https://pages.nist.gov/800-63-4/sp800-63b.html']
  ]) add('bash', name, cmd, description, opts, [example(cmd, 'Run against the Playground’s offline evidence.')], 'Use security-tools to list the bundled evidence and available commands.', source);

  add('powershell', 'Get-ChildItem', 'Get-ChildItem [PATH] [-Force] [-Recurse] [-Filter PATTERN]', 'List the items in a directory. PowerShell typically sends objects, so you can follow this command with a cmdlet that filters their properties.', [
    option('-Force', 'Include items normally hidden from a listing.'), option('-Recurse', 'Walk through subdirectories.'), option('-Filter PATTERN', 'Filter names with a wildcard such as *.txt.'), option('-Path PATH', 'Choose a location.')
  ], [example('Get-ChildItem -Force', 'List the visible and hidden entries.')], 'Aliases include ls, dir, and gci. These names follow PowerShell syntax here.', 'https://learn.microsoft.com/powershell/module/microsoft.powershell.management/get-childitem');
  add('powershell', 'Select-String', 'Select-String -Pattern PATTERN [-Path PATH]', 'Search text or piped values. Matching text is displayed with its line context. PowerShell search is case-insensitive by default.', [
    option('-Pattern PATTERN', 'Search for this expression.'), option('-Path PATH', 'Read from this file or path.'), option('-CaseSensitive', 'In PowerShell, match uppercase and lowercase exactly.'), option('-SimpleMatch', 'In PowerShell, treat the pattern as literal text.')
  ], [example('Select-String patch notes.txt', 'Search notes.txt for lines mentioning a patch.')], 'PowerShell-specific switches and output objects depend on simulator coverage.', 'https://learn.microsoft.com/powershell/module/microsoft.powershell.utility/select-string');
  add('powershell', 'Get-Content', 'Get-Content [PATH]', 'Read the contents of a file. Pipe the results to Select-String to search, or to Measure-Object to count.', [
    option('-Path PATH', 'Specify the file. In the Playground, the positional path is the most portable form.'),
    option('-TotalCount N', 'Real PowerShell reads the first N items.'), option('-Tail N', 'Real PowerShell reads the last N lines.'), option('-Raw', 'Real PowerShell reads the whole file as one string.')
  ], [example('Get-Content notes.txt', 'Read the virtual notes file.')], 'Use the positional path for Playground examples.', 'https://learn.microsoft.com/powershell/module/microsoft.powershell.management/get-content');
  add('cmd', 'dir', 'dir [PATH] [/a] [/s] [/b]', 'List files and directories. Use switches with forward slashes in this shell.', [option('/a','Include entries with hidden attributes.'),option('/s','Include subdirectories.'),option('/b','Use a bare list without the normal table headers.')],
    [example('dir /s /b', 'Show bare paths for entries under the current directory.')], '', ms + 'dir');
  add('cmd', 'find', 'find [/i] [/c] "TEXT" [FILE]', 'Search for a literal text string in a file or a pipe. Quote the search string before any filename.', [
    option('/i', 'Ignore uppercase and lowercase.'), option('/c', 'Print the number of selected lines.'), option('/n', 'In real Windows FIND, number the selected lines.')
  ], [example('find /i "patch" notes.txt', 'Search the note regardless of case.')], 'Use /i and /c in CMD Sandbox. For pattern matching, use findstr.', ms + 'find');
  add('cmd', 'findstr', 'findstr [SWITCHES] PATTERN [FILE]', 'Match patterns in a file or piped input. The CMD Sandbox’s simplified matching ignores case and numbers its result rows automatically.', [
    option('/i', 'In Windows FINDSTR, ignore uppercase and lowercase.'), option('/n', 'In Windows FINDSTR, print original file line numbers. The Sandbox numbers the displayed matches instead.'),
    option('/c:TEXT', 'In Windows FINDSTR, treat the supplied string as one search pattern.')
  ], [example('findstr "patch" notes.txt', 'Search the note with the Sandbox matcher.')], 'Switch handling differs between Windows and the CMD Sandbox.', ms + 'findstr');
  add('cmd', 'sort', 'sort [/r] [FILE]', 'Read text and output it in sorted order. With no file, supply input through a pipe.', [
    option('/r', 'Reverse the default order.')
  ], [example('type notes.txt | sort /r', 'Sort the virtual note’s lines in reverse order.')], 'This is the CMD command. Switches use a slash.', ms + 'sort');
  add('cmd', 'taskkill', 'taskkill /PID ID', 'Send a termination request to a process by its process ID. Use tasklist to identify the requested process.', [
    option('/PID ID', 'Select the numeric process ID.'),
    option('/F', 'In Windows TASKKILL, request forced termination.')
  ], [], 'The CMD Sandbox models a status message without terminating a real process.', ms + 'taskkill');
  add('cmd', 'certutil', 'certutil -hashfile FILE ALGORITHM', 'Calculate a digest for a file, or convert between a file and a Base64 representation. A file hash changes when the bytes change.', [
    option('-hashfile FILE ALGORITHM', 'Print a file digest using an algorithm such as SHA256.'),
    option('-encode IN OUT', 'In Windows, write Base64 output.'), option('-decode IN OUT', 'In Windows, restore bytes from Base64.')
  ], [example('certutil -hashfile notes.txt SHA256', 'Inspect the virtual note’s digest.')], 'Encoding and decoding forms may be simulated.', ms + 'certutil');
  add('python', 'range', 'range(stop)     range(start, stop[, step])', 'Produce a sequence of integers up to, but excluding, the stop value. Use list to see the values or for to iterate over them.', [option('start','The first integer. Defaults to zero.'),option('stop','The excluded endpoint.'),option('step','The increment or decrement. Defaults to one.')], [example('list(range(2, 8, 2))','Produces [2, 4, 6].')], '', py + '#func-range');
  add('python', 'print', 'print(value, ...)', 'Write human-readable text to the terminal. Separate multiple values with commas in the call.', [option('sep','Real Python uses this keyword argument to choose the separator.'),option('end','Real Python uses this keyword argument to choose the trailing text.')], [example('print("total", 7)','Prints total 7.')], 'The Playground implements the common positional form.', py + '#print');
  add('node', 'Buffer.from', 'Buffer.from(TEXT, ENCODING).toString(OUTPUT_ENCODING)', 'Convert between a string and a byte buffer. The input encoding explains how to interpret the text, and the output encoding decides how to display the bytes.', [option('utf8','Interpret ordinary Unicode text.'),option('base64','Interpret or display Base64 text.'),option('hex','Interpret or display pairs of hex digits.')], [example('Buffer.from("aGk=", "base64").toString("utf8")','Produces the string hi.')], '', 'https://nodejs.org/api/buffer.html');
  add('node', 'console.log', 'console.log(value, ...)', 'Write a message to the simulated console. This is useful for inspecting values while evaluating JavaScript statements.', [], [example('console.log("hi", 42)','Prints hi 42.')], '', 'https://nodejs.org/api/console.html');
  add('sql', 'SELECT', 'SELECT [DISTINCT] COLUMNS FROM TABLE [WHERE CONDITION] [ORDER BY COLUMN] [LIMIT N];', 'Read columns from a table. WHERE decides which rows to keep, and ORDER BY decides their order before LIMIT chooses how many to print.', [option('DISTINCT','Remove duplicate output rows.'),option('WHERE','Filter rows by a condition.'),option('ORDER BY','Sort the rows. ASC is ascending and DESC is descending.'),option('LIMIT N','Return up to N rows.'),option('OFFSET N','Skip the first N rows in query order.')], [example('SELECT name FROM users ORDER BY name LIMIT 3;','Return up to three names in name order.')], 'Put strings in single quotes. Table and column names depend on the current exercise.', sql);
  add('sql', 'JOIN', 'SELECT COLUMNS FROM TABLE_A JOIN TABLE_B ON MATCH;', 'Combine rows from tables based on a relationship. Qualify shared column names using table aliases.', [option('INNER JOIN','Keep only combinations that satisfy ON.'),option('LEFT JOIN','Keep all rows from the left table and fill missing matches with NULL.'),option('ON','Set the condition linking rows from both tables.')], [], 'Inspect the table names and key columns before writing the query.', sql);
  add('git', 'git log', 'git log [--oneline]', 'Review the commit history of the simulated repository. The first line in a compact log contains a commit identifier and its subject.', [option('--oneline','Print a compact line per commit.'),option('--author=PATTERN','Filter author information in real Git. Supported in some scenario interpreters.'),option('--grep=PATTERN','Filter commit messages in real Git. Supported in some scenario interpreters.')], [example('git log --oneline','Read the abbreviated history.')], 'Start with a seeded job or create and commit changes in Sandbox.', git + 'git-log');
  add('git', 'git commit', 'git commit -m MESSAGE [--allow-empty]', 'Record the staged changes as a commit in the current virtual repository. The message describes what the commit represents.', [option('-m MESSAGE','Provide the commit message as a command argument.'),option('--allow-empty','Allow a commit when no changes are staged in Sandbox.')], [example('git commit -m "record first snapshot"','Records the staged snapshot after git add.')], 'Use git status to check your staging area first.', git + 'git-commit');
  add('git', 'git status', 'git status [--short]', 'Inspect the working tree and staging area. Use it before committing to see which files have been selected.', [option('-s, --short','In real Git, show compact status codes. Playground may show the normal status report.')], [example('git status','Read the repository and staging state.')], '', git + 'git-status');
  add('docker', 'docker run', 'docker run [-d] [--name NAME] IMAGE [COMMAND]', 'Create and start a virtual container from an image. Use an explicit name when you need to identify it again.', [option('-d','Run detached in real Docker. The Playground records a running state.'),option('--name NAME','Give the container a readable name.'),option('-i','Keep standard input open in real Docker.'),option('-t','Request a terminal in real Docker.')], [example('docker run -d --name web nginx:1.25-alpine','Adds a virtual running container named web.')], 'The Playground simulates the container lifecycle.', docker + 'container/run/');
  add('docker', 'docker ps', 'docker ps [-a]', 'List running containers. Use the name or simulated container ID when looking up the same entry later.', [option('-a','Include stopped and created containers.')], [example('docker ps -a','List all simulated containers.')], '', docker + 'container/ls/');
  add('docker', 'docker compose', 'docker compose up|down|ps|logs|build|config', 'Inspect or change the simulated service group. Compose works at the group level rather than addressing just one container.', [option('up','Create or start the simulated services.'),option('down','Stop and remove the simulated service containers.'),option('ps','List the service containers.'),option('logs','Show service output.'),option('build','Build the service images in real Compose.'),option('config','Show the composition configuration.')], [example('docker compose ps','List the virtual service group.')], '', docker + 'compose/');
  add('network', 'dig', 'dig [RECORD TYPE] NAME [+short]', 'Ask for DNS records in the simulated data set. DNS associates names with information such as IPv4 addresses.', [option('A','Request an IPv4 address record.'),option('TXT','Request a text record where the scenario includes one.'),option('+short','Print compact addresses in the Network Sandbox.')], [example('dig +short api.internal','Print the fixture address, if available in the current mode.')], 'The answer comes from the current virtual scenario.', '');
  add('network', 'ping', 'ping HOST', 'Read the simulator’s example reachability report. A reply includes a round-trip time, and the summary shows sent and received counts.', [], [example('ping api.internal','Shows the virtual reachability report.')], 'A real network can drop ICMP messages even when other protocols work.');
  add('crypto', 'base64', 'base64 [-d] TEXT', 'Convert text to printable Base64 or recover text from a Base64 representation.', [option('-d','Decode Base64 rather than encoding text.')], [example('base64 -d aGVsbG8=','Recovers hello.')], 'This shell accepts text as its argument. The Bash command normally uses a file or a pipe.', core);
  add('crypto', 'hex', 'hex [-d] TEXT', 'Represent text using hexadecimal bytes or reverse the representation.', [option('-d','Decode hex pairs to text.')], [example('hex -d 68656c6c6f','Recovers hello.')]);
  add('crypto', 'rot13', 'rot13 TEXT', 'Rotate letters by 13 positions. Applying ROT13 a second time recovers the input. Digits and punctuation are preserved.', [], [example('rot13 uryyb','Recovers hello.')]);
  add('crypto', 'entropy', 'entropy TEXT', 'Estimate the randomness of the supplied text from character frequencies. Short or repetitive examples can have low entropy.', [], [], 'Entropy alone does not identify the format of a payload.');

  for (const [name, syntax, description, labels, sample, note] of [
    ['tree', 'tree [DIRECTORY]', 'Draw the directory hierarchy using indentation. The argument selects the starting directory.', [], 'tree projects', 'Use ls -la to see hidden entries and permission bits.'],
    ['file', 'file PATH ...', 'Guess a file’s type from its contents. Compare the result with the file extension when those clues disagree.', [], 'file notes.txt', 'A printable string may fit more than one encoding. Treat the label as a clue.'],
    ['strings', 'strings [FILE]', 'Look for printable runs inside input. It is helpful when a mostly binary artifact contains a readable label.', [], 'strings notes.txt', 'Offsets and minimum run sizes depend on the implementation.'],
    ['ln', 'ln [-s] TARGET LINK_NAME', 'Create another path that refers to a target. A symbolic link stores a path to its target.', [['-s', 'Create a symbolic link.']], '', 'Use readlink to inspect the stored target or realpath to resolve an absolute path.'],
    ['readlink', 'readlink LINK', 'Print the target path recorded in a symbolic link.', [], '', 'The stored target can be relative.'],
    ['realpath', 'realpath PATH', 'Resolve a path to an absolute path. Useful when a command depends on the current directory.', [], 'realpath notes.txt', 'Run pwd to inspect the working directory separately.'],
    ['diff', 'diff FILE_A FILE_B', 'Compare text lines in two files. The Sandbox labels the old and new inputs with --- and +++, then marks differing lines with - and +.', [], '', 'Argument order matters when reading the direction of a change.'],
    ['paste', 'paste [-d DELIMITER] FILE ...', 'Combine corresponding lines from multiple inputs. Each output line puts the first input’s value next to the second input’s value.', [['-d DELIMITER', 'Use the specified separator between columns. Default separation is a tab.']], '', 'Use this to combine columns by line position.'],
    ['seq', 'seq [FIRST [STEP]] LAST', 'Print numbers on separate lines. The one-argument form starts at 1. With three arguments, STEP controls the difference between consecutive numbers.', [['FIRST', 'Starting value.'], ['STEP', 'Increment between successive values.'], ['LAST', 'Endpoint. It is included when a step lands exactly on it.']], 'seq 2 2 8', 'Pipe the output to filters or capture it in a variable.'],
    ['df', 'df', 'Report filesystem capacity and available space. Read the mounted-on column to identify the mount associated with each row.', [], 'df', 'The Sandbox uses simulated figures.'],
    ['du', 'du', 'Report disk space attributed to files or directories. It answers a different question from the free space on a whole mount.', [], 'du', 'The Sandbox uses simulated figures.'],
    ['env', 'env', 'Show the environment seen by a command. Environment variables are strings passed to child processes.', [], 'env', 'Use printenv NAME to look up a single exported variable.'],
    ['export', 'export NAME[=VALUE]', 'Make a shell variable available to subsequently invoked commands.', [['NAME=VALUE', 'Assign the value and mark the name for export.']], '', 'Quote a value containing spaces.'],
    ['test', 'test EXPRESSION', 'Check a condition through exit status. Successful checks usually produce no text. Use echo $? immediately afterwards to inspect the result.', [['-e PATH', 'Check whether a path exists.'], ['-f PATH', 'Check for an ordinary file.'], ['-d PATH', 'Check for a directory.'], ['-z STRING', 'Check for an empty string.'], ['-eq', 'Compare two numbers for equality.']], 'test -f notes.txt && echo found', 'Quote variable expansions used as operands.'],
    ['set', 'set [-e] [-u] [-o pipefail]', 'Change shell execution options. A leading plus sign clears the corresponding option in Bash.', [['-e', 'Request exit on unhandled failures. Bash has exceptions for conditional contexts.'], ['-u', 'Treat an unset variable as an error during expansion.'], ['-o pipefail', 'Use the rightmost nonzero pipeline status, or zero when all stages succeed.']], '', 'These options apply to Bash Sandbox scripts. Other modes use smaller interpreters.'],
    ['tar', 'tar -czf ARCHIVE PATH ... | tar -tzf ARCHIVE | tar -xzf ARCHIVE', 'Bundle multiple files into a single archive. The operation flag chooses whether to create, list, or extract.', [['-c', 'Create an archive.'], ['-t', 'List members without extracting.'], ['-x', 'In real tar, extract members into the working directory.'], ['-z', 'In real tar, use gzip compression.'], ['-f ARCHIVE', 'Read or write the named archive file.']], '', 'Bash Sandbox uses archive placeholders and a fixed member listing. Extraction does not restore files there.']
  ]) add('bash', name, syntax, description, labels, sample ? [example(sample, 'Inspect the virtual workspace.')]: [], note, core);

  for (const [name, syntax, description, labels, sample, result] of [
    ['for', 'for NAME in WORD ...; do COMMANDS; done', 'Run a group of commands once for each word. The loop variable holds the current word.', [['in', 'Introduce the words to iterate over.'], ['do', 'Start the command body.'], ['done', 'End the loop.']], 'for item in alpha beta; do printf "<%s>\\n" "$item"; done', 'Prints <alpha> and <beta> on separate lines.'],
    ['while', 'while CONDITION; do COMMANDS; done', 'Repeat the body while the condition command succeeds. The condition is evaluated before each iteration.', [['CONDITION', 'A command whose exit status determines whether the loop repeats.']], '', ''],
    ['until', 'until CONDITION; do COMMANDS; done', 'Repeat the body while the condition command fails. Use this form when a successful condition means the loop is finished.', [['CONDITION', 'A command whose successful status ends the loop.']], '', ''],
    ['if', 'if CONDITION; then COMMANDS; [else COMMANDS;] fi', 'Run a group of commands when a condition command succeeds. A test command can express a file or string condition.', [['then', 'Start the success branch.'], ['else', 'Start the optional failure branch.'], ['fi', 'End the conditional.']], 'if test -f notes.txt; then echo found; else echo missing; fi', 'Prints found when notes.txt exists.'],
    ['alias', 'alias [NAME=VALUE ...]', 'Create a short name that expands at the start of a command. With no arguments, list defined aliases.', [['NAME=VALUE', 'Assign the expansion. Quote it when it includes spaces or options.']], '', ''],
    ['xargs', 'COMMAND | xargs [COMMAND [ARG ...]]', 'Turn words from standard input into arguments for another command. In Bash Sandbox, whitespace splits the items.', [['COMMAND', 'The receiving command. The default is echo.'], ['ARG', 'An initial argument before the items from the pipe.']], 'printf "%s\\n" a b | xargs echo', 'Prints a b.'],
    ['source', 'source FILE', 'Read and run a virtual script in the current shell context. Variables defined there can remain available afterwards.', [['FILE', 'A virtual file containing shell commands.']], '', '']
  ]) add('bash', name, syntax, description, labels, sample ? [example(sample, result)] : [], 'These forms are for Bash Sandbox scripts.', bash);

  for (const [name, syntax, description, labels, sample] of [
    ['Select-Object', 'Select-Object [-Property NAME] [-First N] [-Last N] [-Unique]', 'Choose which properties or how many objects flow out of a pipeline stage. Selection can change the shape of an object.', [['-Property NAME', 'Keep named properties.'], ['-First N', 'Take the first N items.'], ['-Last N', 'Take the last N items.'], ['-Unique', 'Remove repeated objects from the selected sequence.']], 'Get-ChildItem | Select-Object -First 2'],
    ['Sort-Object', 'Sort-Object [-Property NAME] [-Descending]', 'Reorder pipeline objects by a property. For example, sorting by length compares file sizes rather than names.', [['-Property NAME', 'Choose the property to compare.'], ['-Descending', 'Place larger or later values first.']], 'Get-ChildItem | Sort-Object Name'],
    ['Where-Object', 'Where-Object { $_.PROPERTY -OPERATOR VALUE }', 'Send only objects that satisfy a condition down the pipeline. The script block receives one object at a time.', [['$_', 'The object currently being evaluated.'], ['-eq', 'Keep values equal to the comparison value.'], ['-ne', 'Keep unequal values.'], ['-gt', 'Keep values greater than the comparison value.'], ['-like', 'Compare against a wildcard pattern.']], 'Get-ChildItem | Where-Object { $_.Name -like "*.txt" }'],
    ['Measure-Object', 'Measure-Object [-Line] [-Word] [-Character]', 'Summarize pipeline input. For text, use the switches for the units you want to count.', [['-Line', 'Count lines.'], ['-Word', 'Count words.'], ['-Character', 'Count characters.']], 'Get-Content notes.txt | Measure-Object -Line'],
    ['Get-FileHash', 'Get-FileHash PATH [-Algorithm NAME]', 'Calculate a digest from the file’s bytes for an integrity comparison. The algorithm and bytes must match the evidence record.', [['-Algorithm NAME', 'Select a supported digest. SHA256 is PowerShell’s default.']], 'Get-FileHash notes.txt']
  ]) add('powershell', name, syntax, description, labels, [example(sample, 'Try the pipeline against the virtual workspace.')], 'Argument support varies by Playground mode.', ps);

  for (const [name, signature, description, labels, sample] of [
    ['len', 'len(object)', 'Count items in a collection. A string’s length counts characters in real Python, and bytes first need to be decoded if the goal is to count text characters.', [['object', 'A string, collection, or another object that defines a length.']], 'len("hello")'],
    ['sum', 'sum(iterable[, start])', 'Add the items of a numeric sequence. A caller can provide an initial value in real Python.', [['iterable', 'Values to add in order.'], ['start', 'Initial value, normally zero.']], 'sum([2, 4, 6])'],
    ['sorted', 'sorted(iterable, *, key=None, reverse=False)', 'Create a new list in sorted order. A sorting key compares a value derived from each item.', [['key', 'In real Python, a function applied to compute each comparison value.'], ['reverse', 'In real Python, reverse the ordering.']], 'sorted([3, 1, 2])'],
    ['enumerate', 'enumerate(iterable[, start])', 'Pair each item with a running index. Convert the result to a list to inspect the pairs.', [['start', 'The initial index, normally zero.']], 'list(enumerate(["a","b"]))'],
    ['zip', 'zip(iterable, ...)', 'Read corresponding items from each input. In the usual form, iteration ends when the shortest input is exhausted.', [['iterable', 'Each sequence that supplies a column of values.']], 'list(zip(["a", "b"], [1, 2]))'],
    ['int', 'int(value[, base])', 'Convert input to an integer. A base tells Python how to interpret the digits in a string; it is not a rounding instruction.', [['value', 'A string or numeric input.'], ['base', 'Radix for string inputs, such as 16 for hexadecimal.']], 'int("ff", 16)']
  ]) add('python', name, signature, description, labels, [example(sample, 'Evaluate the expression in the REPL.')], 'Playground support focuses on the documented positional examples.', py + '#' + name);

  const sqlDocs = 'https://www.postgresql.org/docs/current/sql-';
  for (const [name, syntax, description, labels, link] of [
    ['WHERE', 'WHERE EXPRESSION [AND|OR EXPRESSION ...]', 'Filter candidate rows. A row survives when its expression evaluates to true.', [['LIKE', 'Match patterns. % matches any sequence, and _ matches one character.'], ['IN', 'Test membership in a list of values.'], ['BETWEEN', 'Test an inclusive range.'], ['IS NULL', 'Check for a missing or unknown value.'], ['AND, OR, NOT', 'Combine or negate conditions. Parentheses make the intended logic explicit.']], 'select'],
    ['ORDER BY', 'ORDER BY COLUMN [ASC|DESC]', 'Sort rows before display or pagination. Rows with equal sort keys can have ties.', [['ASC', 'Use ascending order. This is the default.'], ['DESC', 'Use descending order.']], 'select'],
    ['GROUP BY', 'SELECT GROUP_COLUMN, COUNT(*) FROM TABLE GROUP BY GROUP_COLUMN', 'Combine rows that share grouping values so aggregate functions can produce one result per group.', [['COUNT(*)', 'Count rows in each group.'], ['SUM', 'Add the non-null values in a group.'], ['AVG', 'Average the non-null values in a group.']], 'select'],
    ['INSERT', 'INSERT INTO TABLE (COLUMNS) VALUES (VALUES)', 'Add rows to a table. Match values to the listed columns by position.', [['COLUMNS', 'The columns receiving values.'], ['VALUES', 'The ordered values for the new row.']], 'insert'],
    ['UPDATE', 'UPDATE TABLE SET COLUMN = VALUE [WHERE CONDITION]', 'Change values in rows that match the condition.', [['SET', 'Choose the column assignments.'], ['WHERE', 'Restrict the changed rows. Omitting it updates all rows.']], 'update'],
    ['DELETE', 'DELETE FROM TABLE [WHERE CONDITION]', 'Remove rows from a table.', [['WHERE', 'Choose which rows to remove. Omitting it selects all rows.']], 'delete'],
    ['BEGIN', 'BEGIN; ... COMMIT; | BEGIN; ... ROLLBACK;', 'Open a transaction so a group of changes can be treated as a unit. The SQL Sandbox keeps a snapshot to support rollback.', [['COMMIT', 'Keep the transaction’s changes.'], ['ROLLBACK', 'Undo the transaction’s changes.']], 'begin']
  ]) add('sql', name, syntax, description, labels, [], 'Check the selected Playground mode for available tables and syntax.', sqlDocs + link + '.html');

  for (const [name, syntax, description, labels, sample] of [
    ['add', 'git add PATH ... | git add -A', 'Copy current changes into the staging area. A later edit to the same file needs another add if that edit belongs in the next commit.', [['.', 'Stage changes under the current path.'], ['-A', 'Stage additions, edits, and deletions throughout the repository.']], 'git status'],
    ['diff', 'git diff [--staged]', 'Compare snapshots. With no option, compare the working tree against the index.', [['--staged, --cached', 'Compare the index against the last commit.']], 'git diff --staged'],
    ['branch', 'git branch [NAME]', 'List branch names or create a branch at the current commit. Creating a name does not move the working tree onto it.', [['NAME', 'The new branch name.'], ['-d', 'In real Git, delete a branch after the usual merged-state checks.']], 'git branch'],
    ['switch', 'git switch [-c] BRANCH', 'Change the active branch. The same filename can have different contents on each branch.', [['-c', 'Create a new branch and switch to it.']], 'git status'],
    ['stash', 'git stash [list|pop]', 'Put temporary changes aside so you can resume work later. In real Git, apply and pop differ in whether the saved entry is kept after a successful restoration.', [['list', 'List saved entries.'], ['pop', 'Restore the latest saved entry and remove it after success.']], 'git stash list']
  ]) add('git', 'git ' + name, syntax, description, labels, [example(sample, 'Inspect the virtual repository.')], 'Begin with a virtual repository or a seeded exercise.', git + 'git-' + name);

  for (const [name, exampleCommand, detail] of [
    ['base64url', 'base64url hi', 'Use the URL-safe alphabet. The characters - and _ replace + and / in ordinary Base64.'],
    ['base32', 'base32 hi', 'Write bytes using an alphabet of 32 symbols. Standard Base32 normally uses letters A–Z and digits 2–7.'],
    ['binary', 'binary hi', 'Display each byte in base 2. Grouping into eight bits makes the byte boundaries visible.'],
    ['octal', 'octal hi', 'Display byte values using the digits 0 through 7.'],
    ['decimal', 'decimal hi', 'Display byte values as base-10 numbers.'],
    ['url', 'url hi', 'Percent-encode text for use in a URL component. Percent escapes show byte values in hex.'],
    ['html', 'html "<b>"', 'Convert between literal characters and HTML entities. For example, &lt; represents a less-than sign.'],
    ['unicode', 'unicode hi', 'Convert between text and escape sequences that represent characters.']
  ]) add('crypto', name, name + ' [-d] TEXT', detail, [['-d', 'Reverse this encoding and show the decoded text.']], [example(exampleCommand, 'See the encoded representation of a short input.')], 'Encoding is reversible and uses no secret key.');

  TP.manualContent = { pages, references: { bash, powershell: ps, cmd: ms + 'windows-commands', python: py, node, sql, git: git + 'git', docker, crypto: core } };
})();

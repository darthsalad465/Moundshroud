// Terminal playground — reads a command's output back to you in plain words.
// The help window shows this under the playground, as its own panel, so the terminal stays a terminal.
(() => {
  const TP = (window.TerminalPlayground = window.TerminalPlayground || {});
  const lines = text => String(text == null ? '' : text).replace(/\r/g, '').split('\n').filter(line => line.trim() !== '');
  const has = (text, re) => re.test(text);
  const short = value => String(value || '').slice(0, 120);

  const GLOSSARY = {
    ip: 'An IP address is a computer’s number on a network, like 10.0.0.5. Yours is the one on your own card; the other is the machine being talked to.',
    port: 'A port is a numbered door on a computer. 22 is usually remote login (SSH), 80 is web pages, 443 is secure web pages, 8080 is a common test web server.',
    ttl: 'TTL is how many network hops a reply may still travel before it is thrown away. A number near 64 usually means the reply came from a Linux machine a few hops away.',
    permission: 'Permission letters are read in threes: owner, group, everyone else. r means read, w means write, x means run. A dash means that right is missing.',
    hash: 'A hash is a fingerprint of the text, not the text itself. The same input always gives the same fingerprint, and you cannot turn it back into the text.',
    base64: 'Base64 is a way to write any bytes as letters and digits. It is not secret and not encrypted: anyone can decode it.',
    exit: 'An exit code is the number a command ends with. 0 means it worked; anything else is a problem code.',
    json: 'The braces { } and square brackets [ ] are JSON: a way of writing labelled data. "key": value pairs, lists in brackets.',
    switch: 'A switch (also called a flag or option) is the part that starts with a dash. It changes how a command behaves without changing what it works on.'
  };

  function errorHelp(text) {
    if (has(text, /command not found|is not recognized as an internal|unknown command|: not found/i))
      return 'The shell could not find that command. Check the spelling, or use the Help list to find the right name in this shell.';
    if (has(text, /No such file or directory|Cannot find path|cannot access/i))
      return 'The file or folder was not found. Run ls (or dir on Windows) first to see the exact names, and remember the shell starts in your home folder.';
    if (has(text, /Permission denied|Access is denied/i))
      return 'The file exists, but this account is not allowed to read or change it. In the sandbox, chmod can add permission (for example chmod u+r file).';
    if (has(text, /syntax error|SyntaxError|Traceback|Parse error|Unexpected token/i))
      return 'The command was not written in a shape the shell or language understands. Read the line again: quotes, brackets and semicolons must all match.';
    if (has(text, /fatal:|Error response from daemon|error:/i))
      return 'The tool started, then refused or failed. The first line is the reason; the lines after it are usually a hint about the fix.';
    return '';
  }

  function tableShape(rows) {
    /* a header, a rule of dashes or pipes, then data: the shape most terminal tables have */
    if (rows.length < 2) return false;
    const head = rows[0];
    const rule = rows[1];
    return (/[|]/.test(head) && /^[\s|:+-]+$/.test(rule)) || /^(?:-{2,}|\+[-+]+\+?)$/.test(rule.trim());
  }

  /* ---- what the command itself did, said before the shape of its output -------------------------------- */
  const DID = {
    ls: 'listed the names in a folder', dir: 'listed the names in a folder', vdir: 'listed the names in a folder',
    pwd: 'printed the folder you are in', cd: 'changed the current folder', pushd: 'changed the current folder and remembered the old one', popd: 'went back to the remembered folder',
    cat: 'printed a whole file', head: 'printed the first lines of a file', tail: 'printed the last lines of a file',
    less: 'opened a file for reading', more: 'opened a file for reading', type: 'printed a whole file',
    grep: 'searched inside text and printed the lines that matched', egrep: 'searched inside text and printed the lines that matched',
    fgrep: 'searched inside text and printed the lines that matched', rg: 'searched inside text and printed the lines that matched',
    findstr: 'searched inside text and printed the lines that matched', 'select-string': 'searched inside text and printed the lines that matched',
    find: 'walked the folders below a starting point and printed the paths that matched',
    wc: 'counted lines, words or characters', sort: 'put its input in order', uniq: 'removed repeated neighbouring lines',
    cut: 'printed chosen columns of each line', tr: 'replaced or deleted characters',
    sed: 'rewrote the text that matched a pattern', awk: 'worked through the input line by line, field by field',
    touch: 'made the file if it did not exist, or updated its date', mkdir: 'made a new folder', md5sum: 'printed a fingerprint (hash) of each file',
    rmdir: 'removed an empty folder', rm: 'deleted files', cp: 'copied a file or folder', copy: 'copied a file or folder',
    mv: 'moved or renamed a file or folder', move: 'moved or renamed a file or folder', ren: 'renamed a file or folder',
    chmod: 'changed who may read, write or run a file', chown: 'changed which user and group own a file',
    ln: 'made a link that points at another path', echo: 'printed the words after it', printf: 'printed text in the format you gave',
    tee: 'showed its input while also writing it into a file',
    tar: 'packed files into an archive or unpacked one', zip: 'packed files into a zip archive', unzip: 'unpacked a zip archive',
    gzip: 'compressed a file', gunzip: 'uncompressed a file',
    base64: 'converted text to or from base64', sha256sum: 'printed a fingerprint (hash) of each file', sha1sum: 'printed a fingerprint (hash) of each file',
    curl: 'sent a request to a web address', wget: 'downloaded from a web address',
    ping: 'sent test packets and timed the replies', traceroute: 'traced the path packets take to a host', tracert: 'traced the path packets take to a host',
    ip: 'showed the network cards and their addresses', ifconfig: 'showed the network cards and their addresses',
    netstat: 'showed open ports and connections', ss: 'showed open ports and connections',
    nmap: 'scanned a machine to see which ports answer', ssh: 'opened a session on another machine', scp: 'copied a file between machines over ssh',
    ps: 'listed running programs', kill: 'asked a running program to stop', killall: 'asked running programs to stop', top: 'showed what is using the machine right now',
    df: 'showed how much space each disk has', du: 'added up how much space folders take',
    whoami: 'printed the user you are', id: 'printed your user and group numbers', uname: 'printed the name of the system', hostname: 'printed this machine’s name',
    date: 'printed the current date and time', uptime: 'said how long the machine has been running',
    history: 'printed the commands you typed before', alias: 'named a shortcut for a longer command',
    export: 'set a variable for the commands that follow', env: 'printed the environment variables', set: 'set or printed environment variables', unset: 'removed a variable',
    which: 'said where the program lives', where: 'said where the program lives', whereis: 'said where the program lives',
    man: 'opened the manual page for a command', help: 'opened documentation',
    sudo: 'ran the rest of the line as the administrator', su: 'switched to another user',
    git: 'ran a git command', docker: 'ran a docker command', systemctl: 'asked the service manager to change a service',
    python: 'ran Python', python3: 'ran Python', node: 'ran JavaScript', npm: 'ran the JavaScript package manager'
  };
  /* the switches that change the story of what happened, written the way people type them */
  const SWITCHES = {
    ls: { l: 'in long form, with permissions, owner, size and date', a: 'including names that start with a dot', A: 'including almost every hidden name', h: 'with sizes in KB and MB', R: 'looking inside every subfolder', t: 'newest first', r: 'in reverse order', S: 'largest first', 1: 'one name per line' },
    grep: { i: 'ignoring upper and lower case', n: 'with the line number in front', c: 'printing only the count of matching lines', r: 'inside every file below a folder', R: 'inside every file below a folder', w: 'matching whole words only', v: 'showing the lines that did not match', l: 'printing only the names of files that matched', o: 'printing only the matched text' },
    rm: { r: 'including folders and everything inside them', R: 'including folders and everything inside them', f: 'without asking first', i: 'asking before each file' },
    cp: { r: 'including a whole folder', R: 'including a whole folder', i: 'asking before overwriting' },
    mv: { i: 'asking before overwriting' },
    head: { n: 'a set number of lines instead of ten' }, tail: { n: 'a set number of lines instead of ten', f: 'and then waiting for new lines to arrive' },
    chmod: { R: 'on a folder and everything inside it' },
    tar: { x: 'unpacking', c: 'creating an archive', z: 'through gzip', f: 'with the archive name you gave', v: 'naming each file as it goes' },
    ps: { a: 'including other users’ programs', u: 'in user format', x: 'including programs with no terminal' }
  };
  function switchNotes(stage, base) {
    const notes = SWITCHES[base];
    if (!notes) return '';
    const found = [];
    for (const word of stage.split(/\s+/).slice(1)) {
      if (word === '--') break;
      if (!/^-/.test(word)) continue;
      if (word.startsWith('--')) { const note = notes[word.slice(2)]; if (note) found.push(note); continue; }
      for (const letter of word.slice(1)) { const note = notes[letter]; if (note && !found.includes(note)) found.push(note); }
    }
    return found.length ? ' — ' + found.slice(0, 3).join(', ') : '';
  }
  function didText(command) {
    const cmd = String(command || '').trim();
    if (!cmd) return '';
    const stages = cmd.split(/\s*(?:\|\||&&|\||;)\s*/).filter(Boolean);
    const pieces = stages.map(stage => {
      const base = (stage.split(/\s+/)[0] || '').toLowerCase().replace(/^.*[\\/]/, '');
      if (!base) return '';
      if (/^\d*>>?$/.test(base)) return 'wrote the output into a file instead of printing it';
      const did = DID[base] || ('ran the ' + base + ' command');
      return did + switchNotes(stage, base);
    }).filter(Boolean);
    if (!pieces.length) return '';
    let body = pieces.length === 1 ? 'It ' + pieces[0] + '.' :
      'It worked from left to right: first it ' + pieces.map((piece, i) => (i ? 'then it ' : '') + piece).join(', ') + '.';
    if (/(?:^|\s)\d*>>?\s*\S/.test(cmd)) body += ' The > part sent the output into a file instead of showing it' + (/>>/.test(cmd) ? ' (>> adds to the end of that file).' : '.');
    if (/\|(?!\|)/.test(cmd)) body += ' The | pipe handed each command’s output straight on to the next command.';
    if (/\s&&\s/.test(cmd)) body += ' && ran the next command only because the one before it worked.';
    if (/\s\|\|\s/.test(cmd)) body += ' || ran the next command only because the one before it failed.';
    return body;
  }

  TP.explainOutput = function (command, output, shellId) {
    const cmd = String(command || '').trim();
    const base = (cmd.split(/\s+/)[0] || '').toLowerCase().replace(/^.*[\\/]/, '');
    /* a pipeline can hold several tools: read the output of whichever one printed it */
    const tools = new Set(cmd.toLowerCase().split(/[|;&]+/).map(part => part.trim().split(/\s+/)[0]).filter(Boolean));
    const uses = (...names) => names.some(name => tools.has(name));
    const text = String(output == null ? '' : output).trim();
    const rows = lines(text);
    const out = [];
    const add = (title, body) => { if (body) out.push({ title, body }); };
    /* first the action, then the meaning of what it printed: a reader wants to know both */
    add('What the command did', didText(cmd));
    if (!text) {
      add('Nothing was printed', 'The command ran and said nothing. Many commands are silent when they succeed, for example touch, chmod, mkdir, or a redirect that writes into a file. Silence is often success.');
      return out;
    }

    const err = errorHelp(text);
    if (err) add('This is an error message', err);

    /* ---- the shell itself ---- */
    if (has(text, /^total \d+/m) && has(text, /[d-][-rwx]{9}/))
      add('Reading the file list', 'Each row is one file. The first letter is d for a folder or - for a file. The next nine letters are permissions in three groups of three: owner, group, everyone else (r read, w write, x run). Then come the number of links, the owner, the group, the size in bytes, the date, and the name. A dot at the start of a name means the file is hidden unless you ask with -a.');
    else if (has(text, /[d-][-rwx]{9}/))
      add('Permissions and owners', 'Columns are: type and permissions (d = folder, - = file; rwx = read, write, run), links, owner, group, size, date, name. Permission letters are read in threes: owner, group, everyone else.');

    if (has(text, /^\s*PID\s+(?:TTY|USER|%CPU)/m))
      add('Reading the process table', 'Each row is a running program. PID is its number (useful for kill), USER is who started it, %CPU and %MEM are its share of the machine, and COMMAND is the program with its arguments. The busiest processes are usually at the top when sorted.');

    /* ---- files, words and pipes ---- */
    if (uses('grep', 'egrep', 'fgrep', 'rg', 'findstr', 'select-string')) {
      const numbered = rows.some(row => /^\d+:/.test(row));
      if (/(?:^|\s)-c\b/.test(cmd) || (rows.length === 1 && /^\d+$/.test(rows[0].trim()) && !uses('wc')))
        add('This is a count', 'The only number printed is how many lines matched, not the lines themselves. -c asks for the count.');
      if (numbered)
        add('The numbers at the start of each line', 'Each number is the line number in the file, added by -n. “12:error” means line 12 contains the word, then a colon, then the text of that line.');
      if (!numbered && rows.length && !/^\d+$/.test(rows[0].trim()))
        add('What matched', 'Each printed line is a line that contained your pattern. Lines that did not contain it were dropped, and the order of the file is kept.');
      if (rows.length === 0) add('No match', 'Nothing was printed: the pattern was not found, so grep exits with code 1. That is “no match”, not a broken command.');
    }
    if (uses('find') && rows.length)
      add('The paths that were found', 'Each line is a path that matched your test, written from where you started (./ means this folder). Nothing was changed by find; it only looks.');
    if (uses('wc', 'sort', 'uniq') && rows.length === 1)
      add('A number, not a file', 'wc counts: lines, words and characters (or just one of those with -l, -w or -c). sort and uniq rearrange or collapse lines rather than changing files.');

    /* ---- network ---- */
    if (has(text, /inet (?:addr:)?\s*\d+\.\d+\.\d+\.\d+/))
      add('Reading ip addr', 'Each block is one network card. lo is the loopback card (the machine talking to itself, 127.0.0.1). eth0 or wlan0 is the real card. inet is the IPv4 address, the /24 after it is how large the local network is, and link/ether is the hardware address.');
    if (has(text, /LISTEN/) && has(text, /\d+\.\d+\.\d+\.\d+:\d+/))
      add('Reading listening ports', 'Each row is a door this machine keeps open. LISTEN means a program is waiting for connections. Local Address:Port shows which address and port, 0.0.0.0 means every address, and the Peer column shows the other end (usually * for a listener).');
    if (has(text, /bytes from .*icmp_seq=.*ttl=/))
      add('Reading ping', 'Each reply line says how many bytes came back, the sequence number (so you can spot lost replies), and the TTL. The summary at the end gives packet loss and round-trip times in milliseconds; lower is faster.');
    if (uses('traceroute', 'tracert') || has(text, /^\s*\d+\s+\S+\s+\(?\d+\.\d+\.\d+\.\d+/m)) {
      if (uses('traceroute', 'tracert')) add('Reading traceroute', 'Each numbered line is one hop on the way: the machine, its address in brackets, and three round-trip times. A star * means that hop did not answer in time, which is common and not always a fault.');
    }
    if (uses('nslookup', 'dig') || has(text, /^Server:\s+\d/m))
      add('Reading a name lookup', 'Server is the DNS computer that answered, Address is its address, Name is the name you asked about and the Address lines under it are the numbers that name points to. Several addresses mean the name has more than one machine.');
    if (uses('nmap') || has(text, /\d+\/(?:tcp|udp)\s+(?:open|closed|filtered)/))
      add('Reading nmap', 'Each row is one port. The first column is the port number and protocol (22/tcp is the SSH door), STATE is open (answering), closed (reachable but nothing listening) or filtered (a firewall is hiding it), and SERVICE is the usual name of that port. The target address at the top is the machine that was scanned. Ports that are open are the ones worth understanding; closed ports are not faults.');

    /* ---- data, code and tools ---- */
    if (has(text, /^\s*[\[{]/) && has(text, /[\]}]/))
      add('Reading the data', 'The outer { } is one record with named fields; [ ] is a list. Each "name": value pair is one labelled piece of the record, and nested braces are records inside records. Read the labels first, then the values you care about.');
    if (rows.length && rows.every(row => /^[A-Za-z0-9+/]+={0,2}$/.test(row.trim())) && rows.every(row => row.trim().length % 4 === 0) && !uses('sha256', 'sha1', 'md5', 'sha256sum', 'md5sum'))
      add('This is base64', 'The letters and digits are a safe way to write bytes. Paste them into base64 -d to get the original text back. It hides nothing and protects nothing: it is only a wrapper.');
    if (rows.length === 1 && /^[0-9a-f]{32}$|^[0-9a-f]{40}$|^[0-9a-f]{64}$/i.test(rows[0].trim()))
      add('This is a hash', 'The hex text is a fingerprint of the input. 64 characters means SHA-256, 40 means SHA-1, 32 means MD5. The same input gives the same fingerprint; a different input gives a completely different one, which is how you check that a file did not change.');
    if (has(text, /^Filesystem\s+Size/m) || (uses('df') && has(text, /%\s+\//)))
      add('Reading disk usage', 'Filesystem is the disk, Size is its total, Used and Avail are taken and free, Use% is how full it is, and Mounted on says where it appears in the file tree. Watch Use%: near 100% leaves no room to write.');
    if (has(text, /^On branch|^\s*Untracked files:|^\s*nothing to commit|^\s*Changes not staged/m))
      add('Reading git status', '“On branch” is the branch you are on. Untracked files are new files Git is not watching yet; changes not staged are edits Git sees but has not been asked to save. Nothing is saved until git add then git commit.');
    if (has(text, /^[0-9a-f]{7,}\s+\S/m) && (uses('git') || has(text, /^commit\s+[0-9a-f]{7,}/m)))
      add('Reading git history', 'Each line is one saved snapshot: the short commit id first, then the message you gave it. Newest is at the top. The id is how you point at that exact snapshot later.');
    if (has(text, /^CONTAINER ID|^REPOSITORY\s+TAG|^\s*"Id":/))
      add('Reading Docker', 'CONTAINER ID is the short name of a running box, IMAGE is the recipe it was made from, STATUS says whether it is up, PORTS shows published ports (host:container), and NAMES is the friendly name. In inspect output, the braces are JSON fields.');
    if (uses('docker') && has(text, /^\[\+\]/m))
      add('Reading a build', 'Each [n/m] line is one step of the recipe in the Dockerfile. FINISHED means every step worked; an error names the step that failed.');
    if (tableShape(rows) && has(text, /\(\d+ rows?\)|\d+ row(?:s)? in set/))
      add('Reading the database answer', 'The top row is the column names, the dashed line separates names from values, and each row below is one record. The (N rows) line repeats how many records came back — the answer is the rows, not the count of lines.');

    /* ---- a table or list of any kind ---- */
    if (!out.length) {
      if (rows.length > 1 && rows.every(row => row.split(/\s{2,}|\t|\|/).length > 1))
        add('Reading the columns', 'The output is a table. The first row is usually the column names; each row after it is one record, and each column is one labelled fact about that record. Read across a row to understand one thing, and down a column to compare.');
      else if (rows.length === 1)
        add('The answer', 'The command printed one thing. That value is the answer you asked for; the prompt below it is ready for your next command.');
      else
        add('Reading the list', 'Each line is one item the command found or one line of text it printed. Lines are separate answers, not one sentence: read the first few to see the pattern.');
    }

    /* ---- glossary for whatever appeared ---- */
    const words = [];
    if (/\b(?:\d{1,3}\.){3}\d{1,3}\b/.test(text)) words.push('ip');
    if (/\b\d+\/(?:tcp|udp)\b|\bLISTEN\b|Local Address:Port|:\d{2,5}\b/.test(text)) words.push('port');
    if (/\bttl=/i.test(text)) words.push('ttl');
    if (/[d-][-rwx]{9}/.test(text)) words.push('permission');
    if (rows.length === 1 && /^[0-9a-f]{32,64}$/i.test(rows[0].trim())) words.push('hash');
    if (/^[A-Za-z0-9+/]+={0,2}$/.test(rows[0] || '') && (rows[0] || '').length % 4 === 0 && (rows[0] || '').length > 8) words.push('base64');
    if (/^\s*[\[{]/m.test(text)) words.push('json');
    if (/-{1,2}[A-Za-z]/.test(cmd)) words.push('switch');
    const seen = new Set();
    const glossary = words.filter(word => !seen.has(word) && seen.add(word)).map(word => GLOSSARY[word]);
    if (glossary.length) add('Words in this output', glossary.join('\n'));

    return out;
  };
})();

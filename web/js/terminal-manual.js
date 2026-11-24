// Searchable, read-only terminal manual for the Playground.
(() => {
  const TP = window.TerminalPlayground;
  const esc = value => String(value ?? '').replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]);
  const normal = value => String(value ?? '').trim().replace(/\s+/g, ' ').toLowerCase();
  const slug = value => normal(value).replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  const restrictedExample = /\b(?:nmap|masscan|hping3|nikto|gobuster|ffuf|dirb|whatweb|hydra|enum4linux|rpcclient|snmpwalk|ldapsearch|smbclient|john|hashcat|metasploit|msfconsole)\b/i;
  const nativeOnly = /^(?:start-process|shutdown|diskpart|bcdedit|dism|takeown|sudo)$/i;
  const usage = {
    man: 'man COMMAND [OPTION] opens a manual page.',
    ls: 'ls lists the current directory. ls / opens the chapter index.',
    cd: 'cd CHAPTER changes chapter. cd / returns to the index.',
    apropos: 'apropos WORD searches commands, options, and explanations.',
    exit: 'exit closes the manual and returns to your original terminal.'
  };
  const nav = [['cd /', 'Start here'], ['tutorial', 'Walkthrough'], ['missions', 'Missions'], ['switches', 'Switches'], ['back', 'Back'], ['browse', 'All commands']];
  /* Plain-word notes for commands a shell provides without a written page. The shell's own command table decides which
     commands exist; these notes only say what the common ones do, and any other name still gets its place in the list. */
  const COMMAND_NOTES = {
    bzip2: 'Compress a file with bzip2 (bzip2 notes.txt makes notes.txt.bz2); bzip2 -d unpacks one.',
    xz: 'Compress a file with xz (xz notes.txt makes notes.txt.xz); xz -d unpacks one.',
    yes: 'Print the same word over and over, to answer a command that keeps asking.',
    sleep: 'Wait for a number of seconds: sleep 2 pauses before the next prompt.',
    killall: 'Stop every process with the name you give it.',
    bg: 'Send a stopped job to the background, so the prompt comes back.',
    fg: 'Bring a background job back to the front of the terminal.',
    jobs: 'List the jobs this shell started and whether each is running or stopped.',
    let: 'Do arithmetic in the shell: let total=2+3 sets total to 5.',
    true: 'Do nothing and report success (status 0). Useful in tests and loops.',
    false: 'Do nothing and report failure (status 1). Useful in tests and loops.',
    '[': 'The old spelling of test: [ -f notes.txt ] is true when the file exists.',
    logout: 'Leave the shell, the same as exit.',
    return: 'End a shell function (or a sourced script) and hand back a status.',
    lsof: 'List the open files of the processes here, including sockets.',
    watch: 'Run a command again every two seconds and redraw its output.',
    split: 'Cut a large file into smaller pieces (split -l 100 big.txt part- makes 100-line parts).',
    join: 'Join two files on a shared column, like a database join.',
    expand: 'Turn tabs into spaces; unexpand turns spaces back into tabs.',
    truncate: 'Make a file a given size, or empty it with -s 0.',
    shred: 'Overwrite a file before deleting it, so its contents cannot be read back.',
    dd: 'Copy raw bytes with full control (dd if=in of=out bs=1M).',
    sync: 'Write everything waiting in memory out to disk.',
    timeout: 'Run a command, but stop it if it takes longer than the number of seconds you give.',
    getent: 'Look a name up in the system databases, such as passwd or hosts.',
    'ssh-keygen': 'Make or inspect an SSH key pair (ssh-keygen -t ed25519).',
    gpg: 'Encrypt, decrypt or sign a file with GnuPG.',
    ncat: 'Test a TCP port, the same as nc here.',
    telnet: 'Connect to a port with telnet; the same test as nc here.',
    tty: 'Print the name of the terminal you are typing in.',
    cmp: 'Compare two files byte by byte and say where the first difference is.',
    patch: 'Apply a diff to a file (patch notes.txt < change.diff).',
    install: 'Copy a file and set its permissions in one step.',
    mkfifo: 'Make a named pipe: a file two commands can use to pass data.',
    nano: 'A simple full-screen text editor; vi and vim are the other editors here.',
    vi: 'A full-screen text editor.',
    vim: 'A full-screen text editor with modes; the sandbox accepts the common keys.',
    wall: 'Send a message to every logged-in terminal.',
    mesg: 'Say whether other users may write to your terminal.',
    nice: 'Start a command with a lower priority; renice changes a running one.',
    renice: 'Change the priority of a process that is already running.',
    pidof: 'Print the process id of a program by name.',
    pstree: 'Show the processes as a tree of parents and children.',
    vmstat: 'Report memory, swap and CPU activity.',
    iostat: 'Report disk input and output.',
    mpstat: 'Report how busy each CPU is.',
    iotop: 'Show which processes are using the disk.',
    nft: 'Show firewall rules (the same output as iptables here).',
    nmcli: 'Show NetworkManager devices and connections.',
    iwconfig: 'Show wireless interfaces and their settings.',
    ethtool: 'Show the link speed and duplex of a network adapter.',
    resolvectl: 'Show the resolver’s DNS servers and domains.',
    timedatectl: 'Show the date, time, time zone and clock settings.',
    localectl: 'Show the system language and keyboard layout.',
    loginctl: 'List the login sessions on this machine.',
    'systemd-analyze': 'Report how long boot took and which units were slow.',
    locale: 'Show the language and character-set settings.',
    hostid: 'Print the numeric id of this machine.',
    lsmod: 'List the kernel modules that are loaded.',
    modinfo: 'Describe one kernel module.',
    lspci: 'List the devices on the PCI bus.',
    lsusb: 'List the devices on the USB bus.',
    dmidecode: 'Read hardware details from the firmware tables.',
    sensors: 'Read the temperatures and fan speeds reported by the hardware.',
    smartctl: 'Ask a disk for its health and error counters.',
    apt: 'Install, upgrade or search for packages (apt list --installed).',
    'apt-get': 'The older package tool; apt is the friendlier spelling.',
    dpkg: 'Inspect or install a single .deb package file.',
    snap: 'List or install snap packages.',
    pip: 'Install or list Python packages.',
    pip3: 'Install or list Python 3 packages.',
    python3: 'Start Python 3 and run what you type.',
    python: 'Start Python and run what you type.',
    node: 'Start Node.js and run JavaScript.',
    npm: 'List or install Node.js packages.',
    gcc: 'Compile C source into a program.',
    make: 'Run the build steps written in a Makefile.',
    docker: 'Talk to the Docker engine: containers, images and volumes.',
    kubectl: 'Talk to a Kubernetes cluster.',
    passwd: 'Change a password (simulated here; nothing on the real PC changes).',
    useradd: 'Add a user account (simulated here).',
    usermod: 'Change a user account (simulated here).',
    su: 'Become another user for this session (simulated here).',
    apropos: 'Search the command descriptions for a word.',
    whatis: 'Show the one-line description of a command.',
    whereis: 'Say where a program, its source and its manual page live.',
    locate: 'Find a file by name from a prepared index (updatedb rebuilds it).',
    updatedb: 'Rebuild the index that locate searches.',
    tar: 'Pack files into one archive, or unpack one (tar -czf out.tar.gz folder).',
    /* the recon and codec tools these sandboxes added, so their pages read in plain words instead of a placeholder */
    dnsenum: 'Walk a domain’s DNS records: addresses, name servers and the usual subdomains (dnsenum example.internal).',
    dnsrecon: 'Enumerate DNS records and summarise what it found for one domain.',
    nbtscan: 'Ask a host for its NetBIOS name, workgroup and logged-in user.',
    'arp-scan': 'Send ARP requests across a subnet and list every machine that answers.',
    netdiscover: 'Watch the local network passively and list the hosts it hears from.',
    smbmap: 'List the SMB shares on a host and what each one allows.',
    crackmapexec: 'Probe SMB on a host and print its name, domain and signing state in one line. nxc is the newer spelling.',
    nuclei: 'Run template-based checks against a web target and list the findings.',
    wpscan: 'Check whether a site runs WordPress, and report what it can see.',
    zmap: 'Sweep a range of addresses for one open port, very fast.',
    'ssh-keyscan': 'Fetch a host’s SSH public key without logging in.',
    swaks: 'Walk through a whole SMTP conversation, from EHLO to the queued message id.',
    tftp: 'Send a file to or from a TFTP server.',
    tcptraceroute: 'Trace the path to one TCP port, so filtering shows up that ping hides.',
    nping: 'Send one crafted probe and time the reply.',
    iperf3: 'Measure how much data a link carries between two hosts.',
    'smtp-user-enum': 'Ask a mail server which of a list of users it recognises.',
    onesixtyone: 'Test SNMP community strings against a host.',
    'enum4linux-ng': 'Summarise a Windows host’s domain, shares and signing state.',
    ldapwhoami: 'Ask a directory server who it thinks you are.',
    psql: 'Connect to a PostgreSQL database. mysql is the same prompt for MySQL.',
    mysql: 'Connect to a MySQL database (see psql for the PostgreSQL spelling).',
    'redis-cli': 'Send commands to a Redis cache (redis-cli 10.0.0.5 ping).',
    tcpflow: 'Save each TCP conversation to its own file, so you can read them apart.',
    ssldump: 'Read a TLS handshake and print its steps.',
    mitmproxy: 'Start a proxy that listens on a port. This sandbox intercepts nothing.',
    rot5: 'Shift only the digits by five (1 becomes 6).',
    rot18: 'ROT13 on letters and ROT5 on digits, in one pass.',
    a1z26: 'Number letters: a is 1, z is 26. -d turns numbers back into letters.',
    bacon: 'Write letters as five A/B symbols, Bacon’s old cipher.',
    railfence: 'Zigzag a message across a number of rails (railfence 3 text); -d puts it back.',
    affine: 'A multiplication-and-shift cipher over the alphabet (affine 5,8 text).',
    polybius: 'The five-by-five grid: each letter becomes a row and column.',
    tapcode: 'Send letters as pairs of knocks.',
    base36: 'Write each byte as a base36 number.',
    base62: 'Base62 digits (0-9, A-Z, a-z), the alphabet URL shorteners use.',
    crockford: 'Crockford base32: no I, L, O or U, so it cannot be misread.',
    quotedprintable: 'The email-safe encoding for odd bytes (=C3=A9).',
    uuencode: 'The old begin 644 / end format for sending a file in a message.',
    hashid: 'Guess an algorithm from a hash’s length and alphabet.',
    bcrypt: 'Produce a bcrypt-shaped hash. This one is simulated, not a real bcrypt.',
    pbkdf2: 'A deliberately slow, salted digest with a chosen iteration count.',
    totp: 'The six-digit code that changes every thirty seconds (simulated).',
    hotp: 'The counter-based six-digit code.',
    passphrase: 'Pick random words for a memorable password.',
    open: 'Open a file in the virtual disk for reading or writing (Python and PowerShell spell it differently).',
    print: 'Show values, one after another, with no quotes around strings.',
    input: 'Ask for a value at the prompt. The sandbox returns an empty answer.',
    heapq: 'Heap helpers: heappush, heappop and nsmallest on a sorted list.',
    statistics: 'mean, median, mode, variance and stdev over a list of numbers.',
    textwrap: 'Wrap a long line to a column width.',
    bisect: 'Find where a value belongs in a sorted list.',
    calendar: 'Leap years, month lengths and weekdays.',
    itertools: 'product, permutations, combinations and islice for building loops.',
    operator: 'Operators as functions, such as operator.itemgetter.',
    shlex: 'Split a line into words the way a shell would, keeping quotes together.',
    hmac: 'A keyed digest: hmac.new(key, message).hexdigest().',
    csv: 'Read comma-separated rows, or build them with writer().writerows().',
    settimeout: 'Run a function once, after the current work. It runs immediately here.',
    setimmediate: 'Queue a function to run after the current work.',
    structuredclone: 'Copy a value deeply, so changing one copy cannot change the other.',
    performance: 'A clock for measuring how long work takes.',
    textencoder: 'Turn text into bytes (new TextEncoder().encode("hi")).',
    textdecoder: 'Turn bytes back into text.',
    stream: 'A pipeline of chunks: require("stream").PassThrough.',
    string_decoder: 'Turn byte chunks into text without splitting characters.',
    perf_hooks: 'performance.now() for timings.',
    worker_threads: 'Start extra threads. This sandbox reports a single main thread.',
    dgram: 'UDP sockets (there is no network in this sandbox).',
    tty: 'Whether the prompt is a real terminal.',
    punycode: 'Convert international domain names to their ASCII form.',
    cluster: 'Fork worker processes. This sandbox reports a single primary.',
    v8: 'Heap statistics from the JavaScript engine.',
    readline: 'Read a line at a time from an input stream.',
    module: 'Information about the module system, including builtinModules.'
  };

  /* What a switch does when the shell's own option list does not say. The key is “shell command switch”, because the
     same letter can mean different things in different commands. Anything not here still gets a page, and says that
     its meaning belongs to the command it came from. */
  const SWITCH_NOTES = {
    'bash df -h': 'Print sizes in powers of 1024 (K, M, G) so they are easy to read.',
    'bash du -h': 'Print sizes in powers of 1024 (K, M, G) so they are easy to read.',
    'bash du -s': 'Print one total per argument instead of every file inside it.',
    'bash free -h': 'Print memory in powers of 1024 (Mi, Gi) instead of kilobytes.',
    'bash cut -f1': 'Select field 1 of each line. -f takes the field number or list: -f1,3.',
    'bash cut -f2': 'Select field 2 of each line. -f takes the field number or list: -f1,3.',
    'bash tar -c': 'Create a new archive.',
    'bash tar -z': 'Filter the archive through gzip (.tar.gz).',
    'bash tar -f': 'The next word is the archive file name: -f backup.tar.gz.',
    'bash rm -r': 'Remove a folder and everything inside it.',
    'bash rm -f': 'Never ask; ignore missing files and errors.',
    'bash wc -l': 'Count lines.',
    'bash wc -w': 'Count words.',
    'bash wc -c': 'Count bytes.',
    'bash sort -n': 'Sort by number, so 9 comes before 10.',
    'bash sort -r': 'Sort in reverse order.',
    'bash sort -u': 'Sort and drop duplicate lines.',
    'bash uniq -c': 'Put a count in front of each line.',
    'bash uniq -d': 'Print only the lines that repeat.',
    'bash uniq -u': 'Print only the lines that do not repeat.',
    'bash uniq -i': 'Ignore case when deciding whether lines repeat.',
    'bash uniq -cdui': 'Count each line, keep only repeated lines, ignore case: -c plus -d plus -u plus -i.',
    'bash sort -nru': 'Sort as numbers, newest/largest last reversed, with duplicates removed: -n plus -r plus -u.',
    'bash wc -lwc': 'Count lines, words and bytes in one pass: -l plus -w plus -c.',
    'bash rm -rf': 'Remove a folder, everything in it, and never stop to ask.',
    'bash tar -czf': 'Create a gzip archive named by the next word: -c plus -z plus -f.',
    'bash tar -tzf': 'List what is inside a gzip archive without unpacking it: -t plus -z plus -f.',
    'bash tar -xzf': 'Unpack a gzip archive: -x plus -z plus -f.',
    'bash grep -in': 'Ignore case and print line numbers: -i plus -n.',
    'bash du -sh': 'One total per argument, in human-readable sizes: -s plus -h.',
    'bash ln -s': 'Make a symbolic link: the new name points at the old file instead of copying it.',
    'bash paste -d': 'Choose what goes between the columns: -d, or -d",".',
    'bash set -e': 'Stop the script at the first command that fails.',
    'bash set -u': 'Treat an unset variable as an error instead of an empty value.',
    'bash set -o': 'Turn an option on by name: set -o pipefail.',
    'bash tee -a': 'Append to the file instead of overwriting it.',
    'powershell new-item -itemtype': 'What to create: File or Directory.',
    'powershell where-object -operator': 'How to compare: -eq, -ne, -gt, -lt, -like, -match.',
    'git checkout -b': 'Create a new branch and switch to it in the same step.',
    'git config --global': 'Write the setting for your user rather than just this repository.',
    'git reset --hard': 'Throw away every uncommitted change and move the branch to the chosen commit.',
    'git rm --cached': 'Stop tracking the file but leave it on disk.',
    'docker run -i': 'Keep stdin open, so you can type into the container.',
    'docker run -t': 'Give the container a terminal (tty); usually written -it with -i.',
    'docker exec -i': 'Keep stdin open inside the container.',
    'docker exec -t': 'Give the command a terminal; usually written -it with -i.',
    'network arp -a': 'Show every entry in the neighbour cache, not just a named host.',
    'network netstat -a': 'Show every socket, including the ones only listening.',
    'network netstat -n': 'Show addresses and ports as numbers instead of names.',
    'network netstat -t': 'Show TCP sockets.',
    'network netstat -p': 'Show the program that owns each socket.',
    'network ss -t': 'Show TCP sockets.',
    'network ss -u': 'Show UDP sockets.',
    'network ss -l': 'Show only sockets that are listening.',
    'network ss -p': 'Show the program that owns each socket.',
    'network ss -n': 'Show addresses and ports as numbers instead of names.',
    'network openssl -connect': 'The host and port to open a TLS connection to: -connect api.internal:443.',
    'crypto xxd -r': 'Read hex back into text: hex -d and xxd -r do the same thing here.',
    'pentest gobuster -u': 'The URL to scan: -u http://site.local.',
    'pentest nikto -h': 'The host or URL to check: -h http://site.local.',
    'pentest nmap -sv': 'Probe open ports for the service and version behind them.',
    'pentest sqlmap -u': 'The URL to test: -u "http://site/login?u=1&p=1".',
    'pentest sqlmap --dump': 'Dump the rows of the database once an injection is found.',
    'pentest sudo -l': 'List what this account may run as root, instead of running a command.',
    'remote crackmapexec -u': 'The account to try: -u administrator.',
    'remote crackmapexec -p': 'The password to try: -p <password>.',
    'remote impacket-psexec -p': 'The password for that account.',
    'remote nmap -sv': 'Probe open ports for the service and version behind them.',
    'remote smbclient -l': 'List the shares on the host without connecting to one.',
    'remote smbclient -n': 'Connect without a password (a null session).',
    'remote smbclient -c': 'Run a command on the share: -c "ls" or -c "get file".'
  };

  function titleOf(shell, segment, inherited = '') {
    if (/^(?:Pipes & Chaining|Redirection|Braces & Globs)$/i.test(segment)) return segment;
    if (shell === 'sql') {
      return /^(?:CREATE|ALTER|DROP|TRUNCATE)\s+(?:TABLE|VIEW|INDEX)|^(?:INNER|LEFT|CROSS) JOIN|^(?:ORDER|GROUP) BY|^SHOW (?:TABLES|DATABASES)|^PRAGMA table_info|^\\\w+|^[A-Za-z]+/i.exec(segment)?.[0];
    }
    if (shell === 'python') {
      if (/^\w+\s*=/.test(segment)) return 'assignment';
      if (/^f["']/.test(segment)) return 'f-strings';
      if (/^\[.* for /.test(segment)) return 'comprehensions';
      if (/^(?:[\d[]|["'])/.test(segment)) return 'expressions';
    }
    const token = /^[.A-Za-z_%?][\w.-]*/.exec(segment)?.[0];
    if (shell === 'git' || shell === 'docker') {
      const prefix = shell;
      if (token === prefix) {
        const parts = segment.split(/\s+/);
        if (!parts[1] || !/^[a-z]/i.test(parts[1])) return token;
        if (shell === 'docker' && ['container', 'image', 'system'].includes(parts[1]) && /^[a-z]+$/i.test(parts[2] || '')) return parts.slice(0, 3).join(' ');
        return parts.slice(0, 2).join(' ');
      }
      return token && token !== 'reset' ? prefix + ' ' + token : token;
    }
    if (shell === 'node' && /^console\./.test(inherited) && token && !token.includes('.')) return 'console.' + token;
    return token;
  }

  function optionLabels(label) {
    return label.split(/\s*[,|]\s*/).flatMap(form => [form, form.split(/[\s=:]/)[0]]);
  }

  function optionMatches(shell, label, selector) {
    const compare = ['cmd', 'powershell', 'sql'].includes(shell) ? normal : value => value;
    return optionLabels(label).some(form => compare(form) === compare(selector));
  }

  function buildIndex(shell, mode = 'sandbox', scenarioExamples = []) {
    const data = TP.manualContent || { pages: {}, references: {} };
    const authored = data.pages[shell.id] || {};
    const beginner = TP.manualBeginner?.[shell.id] || {};
    const entries = new Map();
    const groups = TP.HELP_DB[shell.id] || [];
    for (const [chapter, rows] of groups) {
      for (const [syntax, description] of rows) {
        const parts = syntax.split(/\s+\/\s+(?![?a-z]+\])|(?<=<dir>)\s+&\s+|\s+&\s+(?=docker)/i);
        let inherited = '';
        for (const piece of parts) {
          const segment = piece.trim();
          const name = titleOf(shell.id, segment, inherited);
          if (!name) continue;
          inherited = name;
          const key = normal(name);
          if (key === 'mcode' || entries.has(key)) continue;
          const aliasGroup = /\(([-\w?%, ]+)\)\s*$/.exec(segment);
          const aliasText = aliasGroup?.[1] || /(?:aliases|also): ([-\w, ]+)\)?$/i.exec(description)?.[1];
          const aliases = aliasText ? aliasText.split(',').map(word => word.trim()).filter(Boolean) : [];
          if ((shell.id === 'git' || shell.id === 'docker') && name.includes(' ')) aliases.push(name.slice(name.indexOf(' ') + 1));
          const synopsis = ['git', 'docker'].includes(shell.id) && name.startsWith(shell.id + ' ') && !segment.startsWith(shell.id + ' ') ?
            shell.id + ' ' + segment : segment;
          entries.set(key, { key, name, chapter, syntax: synopsis,
            description, aliases, options: [], examples: [], source: data.references[shell.id] || '' });
        }
      }
    }
    /* A shell can add commands of its own on top of its base set: the moundshell adds git and the mcode harness to
       bash. They are listed here, so `help` finds every command the shell really answers to instead of the base
       shell's commands only. */
    for (const extra of shell.extraCommands || []) {
      const name = String((extra && extra.name) || '').trim();
      if (!name) continue;
      const key = normal(name);
      if (entries.has(key)) continue;
      entries.set(key, {
        key, name, chapter: extra.chapter || 'This shell', syntax: extra.syntax || name,
        description: extra.description || [], aliases: extra.aliases || [], options: extra.options || [],
        examples: extra.examples || [], source: '', runnable: extra.runnable !== false, added: extra.added || ''
      });
    }
    for (const [key, content] of Object.entries(authored)) {
      const prior = entries.get(key);
      entries.set(key, { key, chapter: 'Command reference', aliases: [], ...prior, ...content });
    }
    for (const [key, content] of Object.entries(beginner)) {
      if (entries.has(key)) continue;
      const detail = Array.isArray(content.detail) ? content.detail : content.detail ? [content.detail] : [];
      const optionRows = Array.isArray(content.options) ? content.options : Object.entries(content.options || {});
      entries.set(key, {
        key, name: content.name || key, chapter: content.chapter || 'Getting started', syntax: content.example || key,
        description: [content.meaning, ...detail], aliases: content.aliases || [], options: optionRows,
        examples: content.example ? [[String(content.example).split('\n')[0], content.result || content.meaning]] : [], source: ''
      });
    }
    /* A shell can hand over its aliases as one table instead of repeating them on every page. The page the alias
       runs is then the page that lists it, so `dir` in PowerShell opens the Get-ChildItem page and still turns up in
       a search. */
    try {
      const aliasTable = typeof shell.commandAliases === 'function' ? shell.commandAliases() : null;
      for (const [alias, target] of Object.entries(aliasTable || {})) {
        const entry = entries.get(normal(target));
        if (entry && !(entry.aliases || []).some(name => normal(name) === normal(alias))) entry.aliases = [...(entry.aliases || []), alias];
      }
    } catch (e) { }
    entries.set('help', {
      key: 'help', name: 'help', chapter: 'Help Terminal', syntax: 'help [COMMAND [OPTION]]',
      description: ['Open the playground’s Help Terminal. Each shell has its own manual because the same command name or option can mean something different in another shell.'],
      aliases: [], options: [['COMMAND', 'Open a specific command page.'], ['OPTION', 'Highlight its explanation on that page.']],
      examples: []
    });
    function examplesFrom(rows, chapter, kind) {
      for (const row of rows) {
        const [command, description] = Array.isArray(row) ? row : [row.ex, row.d];
        if (!command || !description || /^\s*mcode(?:\s|$)/i.test(command) || (!shell.range && restrictedExample.test(command))) continue;
        const line = normal(command);
        const known = [...entries.values()].filter(page => line === page.key || line.startsWith(page.key + ' ') || line.startsWith(page.key + '('))
          .sort((a, b) => b.key.length - a.key.length)[0];
        const name = known?.name || titleOf(shell.id, command);
        if (!name) continue;
        const key = normal(name);
        if (!shell.range && (restrictedExample.test(key) || nativeOnly.test(key))) continue;
        if (!entries.has(key)) entries.set(key, { key, name, chapter, syntax: command, description, aliases: [], options: [], examples: [], source: data.references[shell.id] || '' });
        const entry = entries.get(key);
        if (entry.examples.length < 4 && !entry.examples.some(sample => sample[0] === command)) entry.examples = [...entry.examples, [command, description, kind]];
      }
    }
    if (mode !== 'sandbox') examplesFrom(scenarioExamples, 'Current exercise', 'Current exercise');
    examplesFrom(shell.commands || [], 'Sandbox examples', 'Sandbox');
    const pages = [...entries.values()].map(entry => {
      /* a simulated Security range documents its own fake tools (nmap, gobuster, sudo -l …); other shells do not */
      const isRestricted = !shell.range && restrictedExample.test(entry.key);
      const safe = !isRestricted && (shell.range || !nativeOnly.test(entry.key));
      const extra = beginner[entry.key] || {};
      const extraOptions = Array.isArray(extra.options) ? extra.options : Object.entries(extra.options || {});
      const options = safe ? [...entry.options, ...extraOptions.filter(([label]) => !entry.options.some(([have]) => normal(have) === normal(label)))] : [];
      const baseDescription = isRestricted ? ['This name appears in the network reference. It represents a simulated security tool. Use the offline evidence tools to practice inspecting traffic and logs.'] :
        Array.isArray(entry.description) ? entry.description : [entry.description];
      const extraDetail = extra.detail ? (Array.isArray(extra.detail) ? extra.detail : [extra.detail]) : [];
      /* A bundled row in the shell's chapter list gives several commands one shared sentence. When the explain layer
         knows this command by name, its own sentence replaces the shared one rather than sitting beside it. */
      const ownNote = TP.manualExplain && TP.manualExplain.noteFor ? TP.manualExplain.noteFor(shell.id, entry.key) : '';
      const description = ownNote && !authored[entry.key]
        ? [ownNote, ...baseDescription.slice(1), ...extraDetail.filter(text => text !== ownNote && !baseDescription.includes(text))]
        : [...baseDescription, ...extraDetail.filter(text => !baseDescription.includes(text))];
      const aliases = [...new Set([...(entry.aliases || []), ...(extra.aliases || [])])];
      /* a command that moved home in the explain layer reads under its new theme, whether it came from the shell's
         chapter list, an authored page or the command table. The beginner starter pages keep their own place, so
         “Getting started” stays a short list of first commands. */
      const themed = !beginner[entry.key] && !entry.flag && TP.manualExplain && TP.manualExplain.chapterFor
        ? TP.manualExplain.chapterFor(shell.id, entry.key) : '';
      return { ...entry, chapter: themed || entry.chapter, syntax: safe ? entry.syntax : entry.name, aliases, description, options, overviewOnly: !safe, real: safe, beginner: safe ? beginner[entry.key] : undefined,
        source: isRestricted ? '' : entry.source, examples: safe ? entry.examples : [], detail: !!authored[entry.key],
        /* the shell told us this name is not part of the real shell: the page says so, in its own words */
        added: entry.added || (shell.appCommands && shell.appCommands[entry.key]) || '' };
    }).sort((a, b) => a.name.localeCompare(b.name));
    /* Every switch gets its own page, so `-i`, `-n`, `-w`, `-R` and the long forms can be found, searched and read
       on their own instead of hiding inside the command's page. A switch is taken from the command's option list, from
       its syntax line and from its examples, so one that only ever appears inside an example (tar -czf, ss -tulpn)
       still gets a page. Combined short switches are split into the letters they stand for, the way the shell reads
       them; CMD's slash switches (/I, /S, /PID) get pages too. */
    const flagPages = [];
    const seen = new Set(pages.map(page => page.key));
    const slashSwitches = shell.id === 'cmd';
    const combinable = ['bash', 'network', 'crypto', 'docker', 'git', 'pentest', 'remote'].includes(shell.id);
    /* -OPERATOR and -ITEMTYPE are placeholders in a syntax line, not switches */
    const isSwitch = token => (/^--?[A-Za-z][\w-]{0,39}$/.test(token) && !/^-[A-Z]{2,}$/.test(token)) ||
      (slashSwitches && /^\/[A-Za-z?]{1,4}$/.test(token));
    /* A lowercase lump of letters is either a combined short switch (-rf, -tulpn) or one word-shaped switch
       (-connect, -newer). It is combined only when every letter has its own option on that command, or the syntax
       writes it inside brackets, which is how a manual says “pick from these letters”. */
    const switchForms = (flag, known, labels, bracketed) => {
      if (!combinable || known || !/^-[a-z]{2,}$/.test(flag)) return [flag];
      const letters = [...flag.slice(1)];
      return bracketed || letters.every(letter => labels.has('-' + letter))
        ? letters.map(letter => '-' + letter) : [flag];
    };
    for (const base of pages) {
      if (!base.real) continue;
      const labels = new Map();
      for (const [label, text] of base.options || []) {
        const raw = String(label).split(/[,|]/)[0].trim().split(/[\s=:]/)[0];
        if (raw && !labels.has(raw)) labels.set(raw, text);
      }
      const mentions = [...labels].map(([flag, text]) => ({ flag, text, line: '', bracketed: false }));
      for (const line of [base.syntax, ...(base.examples || []).map(([command]) => command)]) {
        const bracketed = new Set();
        for (const group of String(line || '').matchAll(/\[([^\]]+)\]/g)) {
          for (const part of group[1].split(/[\s|,]+/)) bracketed.add(part.replace(/^['"]+|['"]+$/g, ''));
        }
        for (const raw of String(line || '').split(/[\s|;&<>()[\]{},]+/)) {
          const token = raw.replace(/^['"(]+|[.,:;'")]+$/g, '');
          if (!token) continue;
          const bare = token.split('=')[0];
          if (isSwitch(bare)) { mentions.push({ flag: bare, text: '', line, bracketed: bracketed.has(bare) }); continue; }
          /* a value written onto the switch itself: -f2 is -f, /PID1234 is /PID */
          const attached = /^(-[A-Za-z])\d+$/.exec(token) || (slashSwitches ? /^(\/[A-Za-z]+)\d+$/.exec(token) : null);
          if (attached) mentions.push({ flag: attached[1], text: '', line, bracketed: false });
        }
      }
      const made = new Set();
      for (const mention of mentions) {
        for (const flag of switchForms(mention.flag, labels.has(mention.flag), labels, mention.bracketed)) {
          if (!isSwitch(flag)) continue;
          const key = base.key + ' ' + flag;
          if (seen.has(key) || made.has(key)) continue;
          made.add(key);
          seen.add(key);
          /* a switch page gets a real example: the first example that uses it, the syntax line it came from, or the
             command's first example with the switch written in, so “Try it right now” always has something to show */
          const tokensOf = line => String(line).split(/[\s|;&<>()[\]{},]+/)
            .map(token => token.replace(/^['"(]+|[.,:;'")]+$/g, '').split('=')[0]);
          /* the switch as written, or the combined form that contains it (rm -rf is an example for -r) */
          const shows = line => tokensOf(line).some(token => token === flag ||
            (combinable && /^-[a-z]{2,}$/.test(token) && token.includes(flag.slice(1))));
          let examples = (base.examples || []).filter(([line]) => shows(line)).slice(0, 1);
          if (!examples.length && mention.line && !/[\[\]<>…]/.test(mention.line)) {
            const line = mention.line.split(/\s*\|\s*|&&|;/)[0].trim();
            if (line) examples = [[line, 'This example uses ' + flag + '.']];
          }
          if (!examples.length && base.examples && base.examples.length) {
            /* keep only the first stage of the command: adding a switch to a pipeline could change what the count counts */
            const [full, why] = base.examples[0];
            const line = String(full).split(/\s*\|\s*|&&|;/)[0].trim();
            const first = line.split(/\s+/)[0];
            /* drop the command itself (one word or several, as in “docker run”) and keep only its arguments */
            const rest = first && line.toLowerCase().startsWith(first.toLowerCase())
              ? (line.toLowerCase().startsWith(base.key) ? line.slice(base.key.length) : line.slice(first.length)).trim() : '';
            if (first) examples = [[(base.key + ' ' + flag + (rest ? ' ' + rest : '')).trim(),
              (why ? why + ' ' : '') + 'The same example, now with ' + flag + '.']];
          }
          const named = mention.text || labels.get(flag) ||
            SWITCH_NOTES[(shell.id + ' ' + base.key + ' ' + flag).toLowerCase()] || SWITCH_NOTES[(base.key + ' ' + flag).toLowerCase()];
          flagPages.push({
            key, name: key, chapter: 'Options and switches', syntax: base.key + ' ' + flag + ' …',
            description: [named || ('Use ' + flag + ' with ' + base.name + '. A switch changes how the command works rather than what it works on; the ' + base.name + ' page shows what it does in this shell.')],
            aliases: [], options: [], examples,
            overviewOnly: false, real: true, beginner: undefined, source: base.source, detail: false,
            parent: base.key, flag
          });
        }
      }
    }
    /* Every option a page prints gets a page of its own too, including the ones that are not written with a dash:
       NAME=VALUE, u+r, -COUNT, and the words of a loop (in, do, done). The row's own sentence becomes the description,
       so pressing an option wherever it is listed always opens something. */
    const optionPages = [];
    for (const base of pages) {
      if (!base.real) continue;
      for (const [label, text] of base.options || []) {
        const token = String(label).split(/[,|]/)[0].trim().split(/[\s=:]/)[0];
        if (!token) continue;
        const key = base.key + ' ' + token;
        if (seen.has(key)) continue;
        seen.add(key);
        optionPages.push({
          key, name: key, chapter: 'Options and switches', syntax: base.key + ' ' + token + ' …',
          description: [text || ('A part of ' + base.name + ', written after the command name.')],
          aliases: [], options: [], examples: [],
          overviewOnly: false, real: true, beginner: undefined, source: base.source, detail: false
        });
      }
    }
    /* The guide to switches themselves: what they are, how several short ones share one dash (-iw), and the traps. */
    const switchGuidePage = {
      key: 'combining switches', name: 'combining switches', chapter: 'Options and switches',
      syntax: 'command -abc …', aliases: ['switches', 'flags', 'options', 'combine switches', 'string switches'],
      description: ['Every switch, in plain words, and how to put several behind one dash: grep -iw means -i and -w together.'],
      options: [], examples: [], real: true, guide: 'switches', beginner: undefined, source: ''
    };
    /* Every command the shell really answers to gets a page, even when nobody has written one for it yet. The shell
       hands over its own command table, so `help` is a complete list of that shell instead of a list of the commands
       someone remembered to document. */
    const autoPages = [];
    try {
      const covered = new Set(entries.keys());
      for (const page of pages) for (const alias of page.aliases || []) covered.add(normal(alias));
      for (const flagPage of flagPages) covered.add(flagPage.key);
      for (const optionPage of optionPages) covered.add(optionPage.key);
      for (const raw of (typeof shell.commandNames === 'function' ? shell.commandNames() : [])) {
        const name = String(raw || '').trim();
        const key = normal(name);
        if (!key || covered.has(key)) continue;
        /* a helper the kit runs by itself (`gci -Recurse` is stored as get-childitem-recursive) and internals such as
           __rep are not names anyone types */
        if (/-recursive$/.test(key) || key.startsWith('_')) continue;
        /* the names the manual hides outside a Security range stay hidden here too */
        if (!shell.range && nativeOnly.test(key)) continue;
        covered.add(key);
        const simulated = !shell.range && restrictedExample.test(key);
        /* the explain layer knows what these commands really do (and which theme they belong to), so the pages the
           shell's own command table contributes read like the authored ones instead of sharing one placeholder */
        const ex = TP.manualExplain;
        const named = (ex && ex.titleFor && ex.titleFor(shell.id, key)) || key;
        const note = (ex && ex.noteFor && ex.noteFor(shell.id, key)) || COMMAND_NOTES[key] || '';
        const themed = !simulated && ex && ex.chapterFor ? ex.chapterFor(shell.id, key) : '';
        /* an import line takes no switches, so its page shows the line as written instead of a made-up usage pattern */
        const autoSyntax = /^import \S+$/.test(key) ? key : key + ' [options] [arguments]';
        autoPages.push({
          key, name: named, chapter: themed || 'Every command in this shell', syntax: autoSyntax,
          description: simulated ? ['This name is a simulated security tool. Use the offline evidence tools to practise inspecting traffic and logs.'] :
            [note || ('This shell can run ' + key + '. Type it in the playground under this window to see what it prints here.')],
          aliases: [], options: [], examples: [], real: !simulated, overviewOnly: simulated, beginner: undefined, source: '', detail: false,
          added: simulated ? '' : (shell.appCommands && shell.appCommands[key]) || shell.autoAdded || ''
        });
      }
    } catch (e) { autoPages.length = 0; }
    const allPages = pages.concat(flagPages, optionPages, [switchGuidePage], autoPages).sort((a, b) => a.name.localeCompare(b.name));
    /* chapters read in a teaching order rather than alphabetically: the tools a beginner needs first, the plumbing and
       the switch reference last. Any chapter the order does not name still appears, after the named ones. */
    const rank = TP.manualExplain && TP.manualExplain.orderOf ? TP.manualExplain.orderOf(shell.id) : [];
    /* chapters a reader works through last, whatever the shell calls them */
    const trailing = ['Sandbox examples', 'Current exercise', 'Command reference', 'Every command in this shell', 'Options and switches', 'Help Terminal'];
    const chapterRank = title => {
      const named = rank.indexOf(title);
      if (named >= 0) return named;
      const tail = trailing.indexOf(title);
      return tail >= 0 ? 900 + tail : 500;
    };
    const chapters = [...new Set(allPages.map(page => page.chapter))].map(title => ({ title, path: slug(title) }))
      .sort((a, b) => (chapterRank(a.title) - chapterRank(b.title)) || a.title.localeCompare(b.title));
    return { shell, mode, pages: allPages, chapters, starters: Object.keys(beginner).filter(key => !beginner[key].hidden).map(key => allPages.find(page => page.key === key)).filter(Boolean) };
  }

  function search(index, input, chapter = '') {
    const term = normal(input);
    const direct = term && pageFor(index, input);
    /* typed switches arrive here as "grep -i"; when that switch has its own page, let the search list show it too */
    const exactSwitch = index.pages.find(page => page.flag && page.key === term);
    if (direct?.page && !exactSwitch && direct.flags.some(flag => direct.page.options.some(([label]) => optionMatches(index.shell.id, label, flag)))) {
      return [direct.page];
    }
    const words = term.replace(/[?]+$/, '').split(/\s+/).filter(word => word && !/^(?:a|an|the|can|do|how|i|you|me|my|to)$/.test(word));
    const matches = index.pages.filter(page => {
      if (chapter && slug(page.chapter) !== chapter) return false;
      const haystack = normal([page.name, page.beginner?.title, page.beginner?.meaning, page.syntax, page.chapter, page.added, ...page.aliases, ...page.description, ...page.options.flat()].join(' '));
      return words.every(word => haystack.includes(word));
    });
    /* A switch search like -w or -R puts the switch pages first. Switch letters are case-sensitive (-R is not -r),
       so the ranking compares the words as typed, not lower-cased. */
    const typed = String(input ?? '').trim();
    const score = page => page.key === term || page.aliases.some(name => normal(name) === term) ? 5 :
      page.flag && typed && (page.flag === typed || page.key === typed || page.key.endsWith(' ' + typed)) ? 4 :
      normal(page.beginner?.title) === term && term ? 2 : page.beginner ? 1 : 0;
    if (term) matches.sort((a, b) => score(b) - score(a));
    return matches;
  }

  function pageFor(index, input) {
    const query = String(input ?? '').trim().replace(/^(['"])(.*?)\1(?=\s|$)/, '$2').replace(/\s+/g, ' ')
      .replace(/^\/?(?:[\w-]+\/)+(?=[\w.])/, '').replace(/\.man(?=\s|$)/i, '');
    const key = normal(query);
    let winner, length = 0;
    for (const page of index.pages) {
      for (const id of [page.key, ...page.aliases.map(normal)]) {
        /* Typed input always lands on the command with its switches highlighted (`grep -in`, `echo -E`). Switch
           pages are opened by clicking them in the list, in search results, or from the switch chips on a page. */
        if (page.flag) continue;
        if (id.length > length && (key === id || key.startsWith(id + ' '))) { winner = page; length = id.length; }
      }
    }
    const selector = query.slice(length).trim();
    const shell = index.shell.id;
    const labels = winner?.options || [];
    const full = labels.some(([label]) => optionMatches(shell, label, selector));
    const flags = !selector ? [] : full ? [selector] : selector.split(/\s+/).flatMap(token =>
      ['bash', 'network', 'crypto'].includes(shell) && /^-[a-z]{2,}$/i.test(token) && !labels.some(([label]) => optionMatches(shell, label, token))
        ? [...token.slice(1)].map(flag => '-' + flag) : [token.split(/[=:]/)[0]]);
    return { page: winner, flags, selector };
  }

  const argumentMeaning = {
    PATTERN: 'The text or pattern to look for.', TEXT: 'The words to use as input.',
    FILE: 'A file name or path.', PATH: 'Where to find the file or folder.',
    DIRECTORY: 'A folder name or path.', COUNT: 'How many to use.', N: 'A number.',
    FORMAT: 'How to write or display the result.', NAME: 'The name to look for or give this item.',
    COMMAND: 'The name of the command to use.', OPTION: 'An extra part that changes what happens.',
    TABLE: 'The name of a table.', COLUMN: 'The name of a column in the table.',
    MESSAGE: 'The words to record or show.', SOURCE: 'Where the input comes from.', DESTINATION: 'Where to put the result.'
  };
  const argumentSample = {
    PATTERN: 'apple', TEXT: '"hello there"', FILE: 'notes.txt', PATH: 'projects/notes.txt', DIRECTORY: 'projects',
    COUNT: '3', N: '3', NAME: 'notes', COMMAND: 'ls', OPTION: '-n', TABLE: 'users',
    COLUMN: 'name', MESSAGE: '"save my changes"', SOURCE: 'notes.txt', DESTINATION: 'notes-copy.txt'
  };
  const explainArguments = (shell, page, example) => {
    if (['python', 'node', 'sql'].includes(shell)) {
      return [[page.name, page.beginner?.meaning || page.description[0]]];
    }
    const windows = ['powershell', 'cmd'].includes(shell);
    return TP.splitTop(example, ['|']).flatMap((stage, stageIndex) => {
      const [command, ...args] = TP.argvMeta(stage, windows);
      if (!command) return [];
      const matching = normal(stage).startsWith(page.key + ' ') || normal(stage) === page.key || normal(command.val) === page.key;
      const skip = matching ? page.key.split(' ').length - 1 : 0;
      const details = stageIndex ? [['|', 'Pass the previous command’s output to the next command.']] : [];
      details.push([matching ? page.name : command.val, matching ? page.beginner?.meaning || page.description[0] : 'Run this part of the example.']);
      let valueOf = '', position = 0;
      for (const { val, quoted } of args.slice(skip)) {
        const matchedOptions = !quoted && matching ? page.options.filter(([label]) => optionMatches(shell, label, val) ||
          (shell === 'bash' && /^-[a-z]{2,}$/i.test(val) && [...val.slice(1)].some(flag => optionMatches(shell, label, '-' + flag)))) : [];
        const operand = matchedOptions.length ? '' : valueOf ||
          (matching && page.key === 'grep' ? (position++ ? 'FILE' : 'PATTERN') : '');
        const meaning = matchedOptions.map(([label, text]) => page.beginner?.options[label] || text).join(' ') ||
          argumentMeaning[operand] || (quoted ? 'These quoted words are passed together as one value.' :
            /^[./\\]|\.[\w]+$/.test(val) ? 'This value looks like a file or folder path.' : 'This is a value passed to the command.');
        details.push([quoted ? JSON.stringify(val) : val, meaning]);
        valueOf = matchedOptions[0]?.[0].match(/^[-/+][\w-]+\s+([A-Z_]+)$/)?.[1] || '';
      }
      return details;
    });
  };

  function guideRequest(line, shell, mode) {
    const raw = line.trim();
    const help = /^(?:help|man)(?:\s+([\s\S]*))?$/i.exec(raw);
    if (help) {
      const query = help[1] || '';
      const operators = ['|', '&&', ';', '>', '<', '\n'];
      if (!/^(?:pipes & chaining|braces & globs)$/i.test(query) && TP.splitTop(raw, operators)[0] !== raw) return null;
      return query;
    }
    if ((mode !== 'sandbox' || shell === 'bash') && raw === '?') return '';
    if (shell === 'powershell' || shell === 'node') {
      const alternative = (shell === 'powershell' ? /^get-help(?:\s+([\s\S]*))?$/i : /^\.help(?:\s+([\s\S]*))?$/i).exec(raw);
      if (alternative) return alternative[1] || '';
    }
    if (shell === 'cmd') {
      const option = /^([\w-]+)\s+\/\?$/.exec(raw);
      if (option) return option[1];
    }
    if ((shell === 'git' || shell === 'docker') && raw.toLowerCase().startsWith(shell + ' ')) {
      const direct = /^(git|docker)\s+help(?:\s+(.+))?$/i.exec(raw);
      if (direct) return direct[2] ? shell + ' ' + direct[2] : '';
      const flag = /^((?:git|docker)(?:\s+[\w-]+)*)\s+--help$/i.exec(raw);
      if (flag) return flag[1] === shell ? '' : flag[1];
    }
    return null;
  }

  let serial = 0;
  function create(root, options = {}) {
    const { focusTerminal, useExample } = options;
    /* An optional page about the exercise the shell is in the middle of (the moundshell's breach target). The host
       supplies the whole body, because only it knows the target and the objectives; this window gives it a nav button,
       a place among its own pages, and the same fold-away sections every other part of help uses. It is built when
       the page is painted, not when the window opens: the engagement moves while the help stays up. */
    const targetGuide = typeof options.targetGuide === 'function' ? options.targetGuide : null;
    const targetGuideNow = () => { try { return targetGuide ? targetGuide() : null; } catch (e) { return null; } };
    const heading = 'tpg-manual-heading-' + ++serial;
    let dialog, index, chapter = '', page = null, filter = '', flags = [], message = '', lastCommand = '', browsing = false, mission = null;
    let playLog = [];
    /* When this is on, the search box looks through the commands of every shell this window can read, not only the
       shell on screen. Indexes are built once per shell and kept, so typing stays quick. */
    let everyShell = false;
    const shellIndexes = new Map();
    /* '' is a normal page, 'tutorial' the guided walkthrough, 'missions' the mission list, 'mission' one mission */
    let special = '', tutStep = 0, missionId = '', missionStep = 0, missionCat = 'All';
    /* the playground can fill the window on its own, separately from the help window's own fullscreen */
    let playFull = false;
    const trail = [];
    const get = name => dialog?.querySelector('[data-manual="' + name + '"]');
    /* Every part of the window folds away — the playground, the output guide and the AI — and the window remembers
       which ones you folded, so a shell you keep the AI closed in stays that way. */
    const FOLD_KEY = 'tpg_manual_folds', FOLD_SECTION = { play: '.tpg-manual-play', coach: '.tpg-manual-coach', ai: '.tpg-manual-ai' };
    let folds = {};
    try { folds = JSON.parse(localStorage.getItem(FOLD_KEY) || '{}') || {}; } catch (e) { folds = {}; }
    function foldSection(name, on) {
      const section = dialog && FOLD_SECTION[name] ? dialog.querySelector(FOLD_SECTION[name]) : null;
      if (!section) return;
      section.classList.toggle('folded', !!on);
      const button = section.querySelector('[data-manual-fold="' + name + '"]');
      if (!button) return;
      button.setAttribute('aria-expanded', String(!on));
      button.textContent = on ? '▸' : '▾';
      button.title = (on ? 'Show' : 'Fold away') + (name === 'ai' ? ' the AI chat' : name === 'coach' ? ' the output guide' : ' the playground') + ' (click again to ' + (on ? 'fold it away' : 'show it') + ')';
    }
    function toggleFold(name, button) {
      if (!FOLD_SECTION[name]) return;
      folds[name] = !folds[name];
      try { localStorage.setItem(FOLD_KEY, JSON.stringify(folds)); } catch (e) { }
      foldSection(name, folds[name]);
      if (button) button.focus({ preventScroll: true });
      else if (!folds[name]) get(name === 'ai' ? 'aiin' : 'playin')?.focus({ preventScroll: true });
    }
    function applyFolds() { Object.keys(FOLD_SECTION).forEach(name => foldSection(name, !!folds[name])); }
    /* The shell this window opened on is always the one it starts on; the dropdown in the corner only changes what you
       are reading right now, and the host decides what “that shell” means (a sandbox shell, or the moundshell). */
    const helpKeyOf = shell => (shell && (shell.helpId || shell.id)) || '';
    function shellChoices() {
      try { return (typeof options.shellChoices === 'function' && options.shellChoices()) || []; } catch (e) { return []; }
    }
    function paintShellPick() {
      const select = get('shellpick');
      if (!select) return;
      const here = helpKeyOf(index && index.shell);
      /* the two Security ranges are their own exercises with their own objectives, not shells this window documents,
         so their section never appears in the list (it stays only while you are reading one of them) */
      const choices = shellChoices().filter(choice => choice && (!/^security ranges$/i.test(choice.group || '') || choice.key === here));
      if (!Array.isArray(choices) || choices.length < 2) {
        select.hidden = true;
        select.innerHTML = '';
        return;
      }
      select.hidden = false;
      const groups = [];
      for (const choice of choices) {
        const title = choice.group || 'Shells';
        let group = groups.find(item => item.title === title);
        if (!group) { group = { title, items: [] }; groups.push(group); }
        group.items.push(choice);
      }
      select.innerHTML = groups.map(group => '<optgroup label="' + esc(group.title) + '">' +
        group.items.map(choice => '<option value="' + esc(choice.key) + '"' + (choice.key === here ? ' selected' : '') + '>' +
          esc(choice.name) + '</option>').join('') + '</optgroup>').join('');
      select.value = here;
      select.title = 'Read the help for another shell. This window opened on ' + ((index && index.shell.name) || 'this shell') + '.';
    }
    function setPlayFull(on) {
      playFull = !!on;
      const section = dialog && dialog.querySelector && dialog.querySelector('.tpg-manual-play');
      if (section && section.classList) section.classList.toggle('tpg-play-full', playFull);
      if (dialog && dialog.classList) dialog.classList.toggle('tpg-play-full-open', playFull);
      const button = dialog && dialog.querySelector('[data-manual-play="full"]');
      if (button) button.textContent = playFull ? '🗗 Leave playground fullscreen' : '⛶ Playground fullscreen';
      const input = playFull ? get('playin') : null;
      if (input) input.focus({ preventScroll: true });
    }
    const wordsToKnow = [
      '<details class="tpg-manual-glossary"><summary>Words you’ll see</summary><div><dl>',
      '<dt>Terminal</dt><dd>A place where you type what you want the computer to do.</dd>',
      '<dt>Command</dt><dd>Words you type to ask the computer to do something. Press Enter to send them.</dd>',
      '<dt>File and folder</dt><dd>A file holds something, such as a letter. A folder holds files or other folders.</dd>',
      '<dt>Option</dt><dd>An extra bit that changes how a command works. For example, <code>-n</code> asks some commands to show line numbers.</dd>',
      '<dt>Pipe <code>|</code></dt><dd>A mark that sends one command’s answer to the next command.</dd>',
      '<dt>Exit code</dt><dd>A number that tells you how a command ended. In Bash, 0 usually means it worked.</dd>',
      '</dl></div></details>'
    ].join('');
    const windowGuide = '<details><summary>How to use this window</summary><div><dl>' +
      '<dt>Start here</dt><dd>Pick a card like Show my files to see a first example.</dd>' +
      '<dt>Find help</dt><dd>Search for a command by name or by what you want to do. Try “read a file”. Tick <b>every shell</b> beside the box to search the commands of every shell this window can read, not only the one on screen.</dd>' +
      '<dt>All commands</dt><dd>See every page for this terminal. Pick a group to make the list shorter.</dd>' +
      '<dt>Back</dt><dd>Go to the page you were just reading.</dd>' +
      '<dt>More details and options</dt><dd>Open this part of a page to see more ways to use the command.</dd>' +
      '<dt>Copy to my terminal</dt><dd>Put an example on your prompt. Read it and press Enter when you are ready.</dd>' +
      '<dt>Use help by typing</dt><dd>Try <code>ls</code> to list groups, <code>man grep -n</code> to open a page, or <code>back</code> to return.</dd>' +
      '<dt>Back to terminal</dt><dd>Close help. You can also press Esc.</dd></dl></div></details>';

    /* Every shell this window can read, as the host names them: (key, name, shell). The shell on screen is always
       included, so “every shell” can never search less than the current one. */
    function readableShells() {
      const here = helpKeyOf(index && index.shell);
      let list = [];
      try { list = (typeof options.allShells === 'function' && options.allShells()) || []; } catch (e) { list = []; }
      const seen = new Set();
      const out = [];
      for (const item of list) {
        if (!item || !item.shell) continue;
        const key = item.key || helpKeyOf(item.shell);
        if (!key || seen.has(key)) continue;
        seen.add(key);
        out.push({ key, name: item.name || item.shell.name || key, shell: item.shell });
      }
      if (index && !out.some(item => item.key === here)) out.unshift({ key: here, name: index.shell.name, shell: index.shell });
      return out;
    }
    function indexForShell(item) {
      const here = helpKeyOf(index && index.shell);
      if (item.key === here) return index;
      if (shellIndexes.has(item.key)) return shellIndexes.get(item.key);
      let built = null;
      try { built = buildIndex(item.shell, 'sandbox', []); } catch (e) { built = null; }
      if (built) shellIndexes.set(item.key, built);
      return built;
    }
    /* the same search, run over every shell's index at once: each result says which shell it belongs to */
    function everyShellResults(term) {
      const out = [];
      for (const item of readableShells()) {
        const shellIndex = indexForShell(item);
        if (!shellIndex) continue;
        for (const entry of search(shellIndex, term)) {
          out.push(Object.assign({}, entry, { shellKey: item.key, shellName: item.name }));
        }
      }
      return out;
    }
    /* a result from another shell opens that shell's window and reads the page there, so the page, its switches and
       its playground all belong to the shell the command really comes from */
    function openShellPage(shellKey, pageKey) {
      const here = helpKeyOf(index && index.shell);
      if (!shellKey || shellKey === here) { openPage(pageKey, true); return; }
      if (typeof options.pickShell !== 'function') {
        message = 'This window cannot open another shell’s help.';
        paintPage();
        return;
      }
      try { options.pickShell(shellKey, pageKey); } catch (e) { }
    }

    /* the command list is always open, grouped by chapter, so every command in this shell is one click away */
    function paintIndex() {
      const list = get('pages');
      if (!list || !index) return;
      /* the list appears on a command page and while searching or browsing; the landing page shows every command
         name instead, so the first screen is not a wall of 150 buttons */
      const everySearch = everyShell && !!filter.trim();
      const show = !!(filter.trim() || browsing || page);
      get('columns')?.setAttribute?.('data-show-index', String(show));
      const aside = get('index');
      if (aside) aside.hidden = !show;
      if (!show) { list.innerHTML = ''; return; }
      const results = everySearch ? everyShellResults(filter) : search(index, filter, filter ? '' : chapter);
      const groups = [];
      for (const entry of results) {
        const title = everySearch ? (entry.shellName || 'Shells') : (entry.chapter || 'Commands');
        let group = groups.find(item => item.title === title);
        if (!group) { group = { title, items: [] }; groups.push(group); }
        group.items.push(entry);
      }
      const shellCount = everySearch ? new Set(results.map(entry => entry.shellKey)).size : 0;
      list.innerHTML = '<p class="tpg-manual-count">' + results.length + ' ' + (results.length === 1 ? 'command' : 'commands') +
        (filter.trim() ? ' matching “' + esc(filter.trim()) + '”' : ' in this shell') +
        (everySearch && results.length ? ' in ' + shellCount + ' ' + (shellCount === 1 ? 'shell' : 'shells') : '') + '</p>' +
        groups.map(group => '<div class="tpg-manual-group"><h4>' + esc(group.title) + '</h4>' +
          group.items.map(entry => everySearch
            ? '<button type="button" data-manual-cross="1" data-manual-shell="' + esc(entry.shellKey) + '" data-manual-page="' + esc(entry.key) + '"><span>' + esc(entry.beginner?.title || entry.name) + '</span><small>' + esc(entry.beginner ? entry.name : entry.chapter) + ' · ' + esc(entry.shellName) + '</small></button>'
            : '<button type="button" data-manual-page="' + esc(entry.key) + '" aria-current="' + (page?.key === entry.key ? 'page' : 'false') + '"><span>' + esc(entry.beginner?.title || entry.name) + '</span><small>' +
              esc(entry.beginner ? entry.name : entry.chapter) + (entry.real ? '' : ' · not in this shell') + (entry.added ? ' · added by this app' : '') + '</small></button>').join('') + '</div>').join('') +
        (!results.length ? '<p>' + (everySearch ? 'No command in any shell matches that. Try a shorter word, like <code>file</code> or <code>read</code>.' : 'Try a shorter word, like <code>file</code> or <code>read</code>.') + '</p>' : '');
      list.scrollTop = 0;
    }

    function paintPlay() {
      const out = get('out');
      if (out) { out.textContent = playLog.length ? playLog.join('\n') : (index && index.shell.playHint) || 'Type any command below and press Run. This is the same shell as your terminal, so files you make here are there when you go back.'; out.scrollTop = out.scrollHeight; }
      const label = get('playshell');
      if (label) label.textContent = '· ' + (index ? index.shell.name : 'shell');
    }

    /* run one line right here, in the manual's own playground */
    function playRun(line) {
      const text = String(line == null ? '' : line).trim();
      if (!text || !index) return '';
      let out = '';
      playLog.push((index.shell.prompt ? index.shell.prompt() : '$ ') + text);
      if (text === 'help') playLog.push('The help window is already open. Type a real command, for example: ' + (index.shell.commands[0]?.[0] || 'ls'));
      else {
        try { out = index.shell.run(text); } catch (error) { out = 'That command hit a problem: ' + (error && error.message ? error.message : error); }
        if (out !== undefined && out !== null && String(out).length) playLog.push(String(out));
      }
      if (playLog.length > 400) playLog = playLog.slice(-400);
      paintPlay();
      if (text !== 'help') renderCoach(text, out);
      return out;
    }

    function flagged(label) {
      return flags.some(flag => optionMatches(index.shell.id, label, flag));
    }

    function exampleBlock(command, text, canCopy = true, parts = [], canPlay = true) {
      return '<div class="tpg-manual-example"><pre>' + esc(command) + '</pre>' +
        '<p class="tpg-manual-why"><b>What this command does:</b> ' + esc(text) + '</p>' +
        (parts.length ? '<details open><summary>What each part does (and why it works)</summary><div><dl class="tpg-manual-steps">' +
          parts.map(([part, meaning]) => '<dt><code>' + esc(part) + '</code></dt><dd>' + esc(meaning) + '</dd>').join('') + '</dl></div></details>' : '') +
        '<div class="tpg-manual-actions">' +
        (canPlay ? '<button type="button" data-manual-run="' + esc(command) + '" title="Run this line in the playground at the bottom of this window">▶ Try it here</button>' : '') +
        (canCopy ? '<button type="button" data-manual-insert="' + esc(command) + '">Copy to my terminal</button>' : '') + '</div></div>';
    }

    /* ---- the walkthrough and the missions: guided, playable tours of this shell --------------------------------- */
    function missions() {
      const authored = (TP.MISSIONS && TP.MISSIONS[index.shell.id]) || [];
      if (authored.length) return authored;
      /* every shell gets a tour even before it has written missions: its own real examples become short steps */
      const rows = (index.shell.commands || []).filter(row => Array.isArray(row) && row[0] && !/^help\b/i.test(row[0]));
      if (!rows.length) return [];
      return [{
        id: 'first-steps', title: 'A guided first run', category: 'Getting started', level: 1,
        intro: 'Run a few real ' + index.shell.name + ' commands in the playground at the bottom of this window. Each one prints its answer there.',
        steps: rows.slice(0, 4).map(([command, text]) => ({ say: text || ('Run this and read what it prints: ' + command), command }))
      }];
    }
    const progressKey = id => 'tpg_mission_' + index.shell.id + '_' + id;
    function missionDone(id) { try { return Math.max(0, +localStorage.getItem(progressKey(id)) || 0); } catch (e) { return 0; } }
    function setMissionDone(id, n) { try { localStorage.setItem(progressKey(id), String(n)); } catch (e) { } }
    function missionDoneAll(m) { return m.steps.length > 0 && missionDone(m.id) >= m.steps.length; }
    function stepFailed(output) { return /command not found|is not recognized|Traceback|SyntaxError|no such file|unknown command/i.test(String(output || '')); }
    function stepPassed(step, output) {
      if (stepFailed(output)) return false;
      if (!step.check) return String(output || '').trim().length > 0;
      try { return new RegExp(step.check, 'i').test(String(output || '')); } catch (e) { return true; }
    }
    function tutorialSteps() {
      const starter = index.starters[0] || index.pages.find(p => p.real && p.examples.length) || index.pages[0];
      const demo = starter ? ((starter.examples[0] && starter.examples[0][0]) || starter.beginner?.example || '') : '';
      const flagPage = index.pages.find(p => p.flag) || null;
      const mission = missions()[0] || null;
      return [
        { title: 'What this window is',
          body: '<p>This is the help for <b>' + esc(index.shell.name) + '</b>. It is the same help the Playground opens, ' +
            'and it holds a page for every command this shell understands — plus a page for every switch, like <code>-n</code> or <code>--help</code>.</p>' +
            '<p>Nothing here can change your computer. The playground at the bottom is a pretend machine, and it keeps its own files.</p>' },
        { title: 'Find the page you need',
          body: '<p>Use <b>Find help</b> at the top. Type the command name (<code>' + esc(starter ? starter.name : 'ls') + '</code>), or what you want to do ' +
            '(for example “count lines” or “find a word”). The list on the left narrows as you type.</p>' +
            '<p><b>All commands</b> shows the whole list by group. <b>Start here</b> comes back to the big cards.</p>' },
        { title: 'Read a command page',
          body: '<p>Open any command to see, in order: a five-year-old’s explanation, how to type it, one real example with each part explained, ' +
            'then every option. Buttons under an example run it (<b>▶ Try it here</b>) or put it on your own prompt (<b>Copy to my terminal</b>).</p>' +
            '<p>Options and switches have their own pages too — open <b>Options and switches</b> in the list, or press a switch name on a command page.</p>' },
        { title: 'Run something for real',
          body: '<p>Look at the playground under this page. Press the button to run <code>' + esc(demo || 'help') + '</code>. The shell prints its answer in that box, ' +
            'and you can then type anything else there.</p>' + (demo ? '<p><button type="button" class="pri" data-tut="run">▶ Run ' + esc(demo) + ' in the playground</button></p>' : ''),
          command: demo },
        { title: 'Go bigger: switches, and writing them short',
          body: '<p>Switches change how a command behaves. A page like <code>' + esc(flagPage ? flagPage.name : '-n') + '</code> explains one switch slowly.</p>' +
            '<p>Several short switches can share one dash: <code>-i -w</code> and <code>-iw</code> are the same two switches, and <code>ls -l -a</code> is <code>ls -la</code>. ' +
            'Letters after one dash are read one at a time, and order does not matter.</p>' +
            '<p>You can also chain commands with <code>|</code> to pass one answer into the next, and with <code>&amp;&amp;</code> to run a second command only if the first worked. ' +
            'Tutorials never mind long commands: type or paste a whole chain, press Enter, and read it part by part.</p>' +
            '<p><button type="button" data-manual-page="combining switches">📖 Open the full guide to switches</button></p>' },
        { title: 'Read what the output means',
          body: '<p>Under the playground there is a separate panel, <b>What this output means</b>. It never types into the terminal: it reads what the terminal printed and explains it in plain words.</p>' +
            '<p>It explains the columns of a file list, line numbers from <code>-n</code>, a count from <code>-c</code>, an IP address and the ports in a scan, a hash, a database answer, an error, and the words that are easy to misread.</p>' +
            '<p>Run something in the playground and look below the output; the panel changes with each command.</p>' },
        { title: 'Try a mission',
          body: '<p>Missions are short interactive jobs in the playground. Pick a category and follow the steps: each one tells you what to do, checks ' +
            'the output, and marks itself done. A mission can be as long and as complex as it likes — a whole pipeline, a script, a file to build.</p>' +
            (mission ? '<p><button type="button" class="pri" data-mission="' + esc(mission.id) + '">🎯 Open “' + esc(mission.title) + '”</button></p>' : '') },
        { title: 'Fullscreen and finishing',
          body: '<p><b>⛶ Fullscreen</b> gives the help and its playground the whole window; press it again to come back.</p>' +
            '<p><b>Back to terminal</b> (or Esc) closes help and returns you to your shell. The commands you ran in the playground stay there.</p>' }
      ];
    }
    function paintTutorial() {
      const steps = tutorialSteps();
      const step = steps[Math.max(0, Math.min(tutStep, steps.length - 1))] || steps[0];
      return '<div class="tpg-manual-tour"><div class="tpg-manual-tour-head"><span class="small mute">Guided walkthrough · step ' +
        (tutStep + 1) + ' of ' + steps.length + '</span><span class="tpg-manual-dots">' +
        steps.map((_, i) => '<i' + (i === tutStep ? ' class="on"' : '') + '></i>').join('') + '</span></div>' +
        '<h3>' + esc(step.title) + '</h3>' + step.body +
        '<div class="row" style="gap:8px;flex-wrap:wrap;margin-top:14px">' +
        (tutStep > 0 ? '<button type="button" data-tut="back">← Back</button>' : '') +
        (tutStep < steps.length - 1 ? '<button type="button" class="pri" data-tut="next">Next →</button>' : '<button type="button" class="pri" data-manual-nav="missions">🎯 See the missions</button>') +
        '<button type="button" data-manual-nav="cd /">Start page</button></div></div>';
    }
    function paintMissions() {
      const list = missions();
      if (!list.length) return '<h3>🎯 Missions</h3><p>This shell has no missions yet. Try a puzzle in the Playground instead.</p>';
      const cats = ['All', ...new Set(list.map(m => m.category || 'Other'))];
      const shown = missionCat === 'All' ? list : list.filter(m => (m.category || 'Other') === missionCat);
      const card = m => {
        const done = missionDone(m.id), total = m.steps.length, finished = missionDoneAll(m);
        return '<button type="button" class="tpg-mission-card' + (finished ? ' done' : '') + '" data-mission="' + esc(m.id) + '">' +
          '<strong>' + (finished ? '✅ ' : '🎯 ') + esc(m.title) + '</strong>' +
          '<span class="small mute">' + esc(m.category || 'Other') + ' · ' + total + ' step' + (total === 1 ? '' : 's') +
          ' · ' + (finished ? 'complete' : done ? done + ' done' : 'not started') + '</span>' +
          (m.intro ? '<span class="small">' + esc(m.intro) + '</span>' : '') + '</button>';
      };
      return '<div class="tpg-manual-tour"><h3>🎯 Missions in the playground</h3>' +
        '<p>Pick a category, open a mission, and follow its steps. Every command runs in the playground under this page, so you see the real answer before moving on. ' +
        'Missions can be long and detailed — chains, scripts, whole files. Finishing one earns ⭐ points and 🏅 Elo in the terminal playground\'s reward panel.</p>' +
        '<div class="row" style="gap:6px;flex-wrap:wrap">' + cats.map(c => '<button type="button" class="' + (missionCat === c ? 'pri' : '') + '" data-missioncat="' + esc(c) + '">' + esc(c) + '</button>').join('') + '</div>' +
        '<div class="tpg-mission-list">' + shown.map(card).join('') + '</div></div>';
    }
    function paintMission() {
      const m = missions().find(x => x.id === missionId);
      if (!m) return paintMissions();
      const total = m.steps.length, done = missionDone(m.id);
      const at = Math.max(0, Math.min(missionStep, total - 1));
      return '<div class="tpg-manual-tour"><div class="row" style="gap:8px;flex-wrap:wrap;align-items:center">' +
        '<button type="button" data-manual-nav="missions">← All missions</button>' +
        '<span class="small mute">' + esc(m.category || 'Other') + ' · level ' + (m.level || 1) + ' · ' + done + '/' + total + ' steps done</span></div>' +
        '<h3>' + esc(m.title) + '</h3><p>' + esc(m.intro || '') + '</p>' +
        '<ol class="tpg-mission-steps">' + m.steps.map((step, i) => {
          const state = i < done ? 'done' : i === at ? 'now' : '';
          return '<li class="' + state + '"><div class="tpg-mission-say">' + esc(step.say) + '</div>' +
            (step.command ? '<pre>' + esc(step.command) + '</pre>' : '') +
            (i === at ? '<div class="row" style="gap:6px;flex-wrap:wrap;margin-top:6px">' +
              (step.command ? '<button type="button" class="pri" data-missionrun="1">▶ Try this step</button><button type="button" data-missionfill="' + esc(step.command) + '">Put it in the playground</button>' : '') +
              (step.hint ? '<span class="small mute">💡 ' + esc(step.hint) + '</span>' : '') + '</div>' : '') +
            (i < done ? '<div class="small" style="color:#7bd88f">✅ done</div>' : '') + '</li>';
        }).join('') + '</ol>' +
        '<div class="row" style="gap:8px;flex-wrap:wrap;margin-top:12px">' +
        (total > 1 ? '<button type="button" data-missionstep="' + Math.max(0, at - 1) + '">← Previous step</button>' : '') +
        (at < total - 1 ? '<button type="button" data-missionstep="' + (at + 1) + '">Skip to next step →</button>' : '') +
        '<button type="button" data-missionreset="1">Start over</button></div></div>';
    }
    function runMissionStep() {
      const m = missions().find(x => x.id === missionId);
      if (!m) return;
      const step = m.steps[missionStep];
      if (!step || !step.command) return;
      const output = playRun(step.command);
      if (stepPassed(step, output)) {
        const before = missionDone(m.id);
        const next = Math.max(before, missionStep + 1);
        setMissionDone(m.id, next);
        let reward = null;
        if (next >= m.steps.length && before < m.steps.length) {
          try { reward = window.TerminalRewards && window.TerminalRewards.award('mission', { id: m.id, title: m.title }); } catch (e) { }
        }
        message = (next >= m.steps.length ? '✅ Mission complete: ' + m.title + '. Well done.' : '✅ Step done. On to step ' + (next + 1) + '.') +
          (reward ? ' ⭐ +' + reward.points + ' points · 🏅 +' + reward.elo + ' Elo' + (reward.badges.length ? ' · ' + reward.badges.map(b => b.icon + ' ' + b.name).join(', ') : '') : '');
        missionStep = next < m.steps.length ? next : m.steps.length - 1;
      } else {
        message = 'Not quite — read the step again and look at what the playground printed.';
      }
      paintPage();
    }

    function paintStart() {
      if (browsing) {
        const group = index.chapters.find(item => item.path === chapter);
        return '<h3>' + esc(group?.title || 'All commands') + '</h3><p>Pick a command from the list, or choose a group below.</p>' +
          '<div class="tpg-manual-chapters">' +
          index.chapters.map(item => '<button type="button" data-manual-chapter="' + esc(item.path) + '">' + esc(item.title) + '</button>').join('') + '</div>';
      }
      const starterCards = index.starters.map(entry =>
        '<button type="button" data-manual-page="' + esc(entry.key) + '"><strong>' + esc(entry.beginner.title) + '</strong>' +
        '<code>' + esc(entry.name) + '</code></button>').join('');
      /* The main section is split into the same categories as the list on the left, so a long manual reads as a set of
         small groups instead of one wall of names. Every chapter keeps its teaching order. */
      const card = entry => '<button type="button" data-manual-page="' + esc(entry.key) + '" title="' + esc(entry.chapter) +
        '"><span>' + esc(entry.name) + '</span></button>';
      const all = index.chapters.map(item => {
        const group = index.pages.filter(entry => entry.chapter === item.title);
        if (!group.length) return '';
        return '<h4 class="tpg-manual-cat" data-manual-cat="' + esc(item.path) + '">' + esc(item.title) +
          ' <span class="small mute">(' + group.length + ')</span></h4><div class="tpg-manual-all">' + group.map(card).join('') + '</div>';
      }).join('');
      return missionBlock() +
        '<div class="row" style="gap:8px;flex-wrap:wrap;margin:4px 0 14px">' +
        '<button type="button" class="pri" data-manual-nav="tutorial">🎓 Walkthrough: learn this window</button>' +
        '<button type="button" data-manual-nav="missions">🎯 Missions: practise in the playground</button></div>' +
        '<h3>Every command, in plain words</h3><p>This window explains every command this shell understands. ' +
        'Each page starts with a five-year-old’s explanation, then the details. Type in the playground at the bottom to try one right here, ' +
        'and use <b>⛶ Fullscreen</b> to give the help and its playground the whole window.</p>' +
        '<h3>What do you want to do?</h3><p>Pick a card. It shows what to type and what happens next.</p>' +
        '<div class="tpg-manual-starters">' + starterCards + '</div>' +
        '<h3>Every command in ' + esc(index.shell.name) + ' (' + index.pages.length + ')</h3>' +
        '<p>Every command this shell understands has a page here, grouped by what it does. Click any name to read it. The list on the left stays open too, and the box above searches all of it.</p>' +
        all +
        '<h3>Try commands as you read</h3><p>Use the playground at the bottom of this window: type any command and press Run. Nothing you type here can reach the internet or change a real computer.</p>' +
        wordsToKnow + windowGuide;
    }

    // A card for the mission, puzzle or room you are on, with its goal and the commands that fit it.
    function missionBlock() {
      if (!mission) return '';
      const objective = String(mission.objective || '').split('\n').map(line => line.trim()).filter(Boolean)
        .map(line => '<p>' + esc(line) + '</p>').join('');
      const cmds = (mission.commands || []).filter(c => Array.isArray(c) && c[0]).map(([command, desc]) =>
        '<div class="tpg-manual-example"><pre>' + esc(command) + '</pre><p>' + esc(desc || '') + '</p>' +
        '<button type="button" data-manual-insert="' + esc(command) + '">Copy to my terminal</button></div>').join('');
      return '<section class="tpg-manual-mission"><h3>🎯 ' + esc(mission.heading || 'Current mission') + '</h3>' +
        objective + (cmds ? '<p class="tpg-manual-count">Commands that help here</p>' + cmds : '') + '</section>';
    }

    /* ---- the switch guide and the output coach ---------------------------------------------------------------- */
    function shortFlags(page) {
      const seen = new Set();
      return ((page && page.options) || []).map(([label]) => String(label).split(/[,|]/)[0].trim().split(/[\s=:]/)[0])
        .filter(flag => /^-[A-Za-z]$/.test(flag) && !seen.has(flag) && seen.add(flag));
    }
    function switchGuideHtml() {
      const parents = index.pages.filter(page => !page.flag && !page.guide && page.real && shortFlags(page).length);
      const rows = parents.slice(0, 14).map(page => {
        const flags = shortFlags(page).slice(0, 4);
        const combined = '-' + flags.map(flag => flag.slice(1)).join('');
        return '<tr><td><button type="button" data-manual-page="' + esc(page.key) + '"><code>' + esc(page.key) + '</code></button></td>' +
          '<td>' + flags.map(flag => '<button type="button" class="tpg-manual-flag" data-manual-page="' + esc(page.key + ' ' + flag) + '">' + esc(flag) + '</button>').join(' ') + '</td>' +
          '<td><code>' + esc(page.key + ' ' + combined) + '</code></td></tr>';
      }).join('');
      return '<div class="tpg-manual-tour"><h3>Switches: the dashes that change a command</h3>' +
        '<p>A <b>switch</b> (also called a flag or an option) is a part that starts with a dash. It never decides <i>what</i> the command works on — it decides <i>how</i>. ' +
        '<code>ls</code> lists a folder; <code>ls -l</code> lists it in long form; <code>ls -a</code> also shows hidden files. Nothing else changed.</p>' +
        '<h4>Short and long are the same switch</h4><p>A switch has a short form with one dash and one letter, and often a long form with two dashes and a word. ' +
        'They do the same thing: <code>-i</code> is <code>--ignore-case</code>, <code>-n</code> is <code>--line-number</code>, <code>-R</code> is <code>--recursive</code> in many tools. ' +
        'Use whichever you can remember; long forms are easier to read in notes, short forms are faster to type.</p>' +
        '<h4>Several short switches share one dash</h4>' +
        '<p>This is the part that confuses people most, and it is simple once you see it: <b>letters after one dash are read one at a time</b>. ' +
        '<code>-i -n</code> and <code>-in</code> are exactly the same thing. <code>-i -w</code> and <code>-iw</code> are the same thing. ' +
        'Order does not matter: <code>-iw</code>, <code>-wi</code> and <code>-i -w</code> all mean “ignore capitals and match whole words”.</p>' +
        '<div class="tpg-switch-examples">' +
        ['grep -iw "error" notes.txt', 'ls -la', 'ps aux', 'tar -xzf backup.tar.gz', 'docker ps -a', 'git log --oneline --graph']
          .map(line => '<div><pre>' + esc(line) + '</pre><p>' + esc(line.startsWith('grep -iw') ? '-iw is -i (ignore case) plus -w (whole words only). The pattern and the file still come after all the switches.' :
            line.startsWith('ls -la') ? '-la is -l (long list) plus -a (show hidden files).' :
            line.startsWith('ps aux') ? 'aux is three older-style switches written without dashes: every process, in user format, including processes with no terminal.' :
            line.startsWith('tar -xzf') ? '-xzf is -x (extract) plus -z (gzip) plus -f (the next word is the file name).' :
            line.startsWith('docker ps -a') ? '-a means all, including stopped containers.' :
            '--oneline and --graph are long switches; they can be written together but not shortened into one dash.') + '</p></div>').join('') + '</div>' +
        '<h4>Rules that keep you out of trouble</h4><ol class="tpg-switch-rules">' +
        '<li><b>Switches go before the names.</b> <code>grep -in "error" log.txt</code> works; <code>grep "error" -in log.txt</code> will look for a file called -in.</li>' +
        '<li><b>A switch that needs a value keeps it.</b> <code>-o FILE</code> means the next word belongs to -o, so <code>-on</code> is not “-o plus -n”. Long form: <code>--output=FILE</code>.</li>' +
        '<li><b>Long switches do not stack letters.</b> Write <code>--recursive --ignore-case</code>, not <code>--ri</code>.</li>' +
        '<li><b>Case matters.</b> <code>-r</code> and <code>-R</code> are different switches in tools that have both; read the page of the switch you are about to use.</li>' +
        '<li><b>Same letter, different job.</b> <code>-n</code> adds line numbers in grep, but means “no newline” in echo. A switch belongs to its command, not to the terminal.</li>' +
        '<li><b><code>--</code> ends the switches.</b> Everything after it is a name, even if it starts with a dash: <code>rm -- -weird-name</code>.</li></ol>' +
        '<h4>Combinations worth memorising</h4><table class="tpg-switch-table"><thead><tr><th>Write</th><th>It means</th></tr></thead><tbody>' +
        [['ls -la', 'long list, including hidden files'], ['grep -inw "error" file', 'ignore case, show line numbers, whole words only'], ['grep -rni "todo" .', 'search inside every file below this folder, with line numbers, ignoring case'],
          ['cp -r src backup', 'copy a folder and everything in it'], ['curl -sSL url', 'quiet, show errors, follow redirects'], ['ssh -p 2222 user@host', '-p takes the port number as its value'], ['git commit -am "message"', 'stage tracked changes and commit in one step']]
          .map(([cmd, meaning]) => '<tr><td><code>' + esc(cmd) + '</code></td><td>' + esc(meaning) + '</td></tr>').join('') + '</tbody></table>' +
        '<h4>Switches of the commands in this shell</h4><p>Press a switch to read its own page. Press the command name to see all of them in context.</p>' +
        (rows ? '<table class="tpg-switch-table"><thead><tr><th>Command</th><th>Some switches</th><th>Written together</th></tr></thead><tbody>' + rows + '</tbody></table>' : '<p>This shell has no switch pages.</p>') +
        '<p class="small mute">Every switch and option also has its own page under <b>Options and switches</b>, and the search box finds them: try <code>-R</code>, <code>-in</code> or “whole word”.</p></div>';
    }
    function combineBlock(page) {
      const parent = index.pages.find(entry => entry.key === page.parent && !entry.flag);
      if (!parent) return '';
      const others = shortFlags(parent).filter(flag => flag !== page.flag).slice(0, 3);
      const together = page.flag + others.map(flag => flag.slice(1)).join('');
      return '<div class="tpg-manual-combine"><b>Use it together with other switches:</b> ' +
        '<code>' + esc(parent.key + ' ' + page.flag) + '</code> is the long way, and <code>' + esc(parent.key + ' ' + together) + '</code> is the same thing written short' +
        (others.length ? ' (<code>' + esc(page.flag) + '</code> plus ' + others.map(flag => '<code>' + esc(flag) + '</code>').join(', ') + ')' : '') +
        '. <button type="button" data-manual-page="combining switches">How combining switches works</button></div>';
    }
    function renderCoach(command, output) {
      const box = get('coach');
      if (!box) return;
      if (!String(output || '').trim() && !String(command || '').trim()) {
        box.innerHTML = '<p class="small mute">Run a command (or one of the missions) and this panel explains what the terminal printed.</p>';
        return;
      }
      const list = index && TP.explainOutput ? TP.explainOutput(command, output, index.shell.id) : [];
      if (!list || !list.length) {
        box.innerHTML = '<p class="small mute">Run a command (or one of the missions) and this panel explains what the terminal printed.</p>';
        return;
      }
      box.innerHTML = '<p class="small mute">About <code>' + esc(String(command).slice(0, 100)) + '</code></p>' +
        '<div class="tpg-coach-item"><b>Where it ran</b><p>Inside this help window’s own copy of the shell. Nothing outside it changed: your terminal, your saved sandbox and every real file on this computer were left alone.</p></div>' +
        list.map(item => '<div class="tpg-coach-item"><b>' + esc(item.title) + '</b><p>' + esc(item.body).replace(/\n/g, '<br>') + '</p></div>').join('');
    }

    /* Three reading levels on every page, including the ones a shell's command table contributes. Level 1 is the
       one-sentence answer, level 2 is exactly what the command does to its input and output, and level 3 is how it
       works plus the traps. The first two come from the authored page or the explain layer; level 3 falls back to the
       page's own syntax, switches, examples and aliases, so no page is left with a single vague line. */
    function explainLevels(page, start) {
      const ex = TP.manualExplain;
      const extra = ex && ex.deepFor ? ex.deepFor(index.shell.id, page.key) : null;
      const paras = (page.description || []).filter(Boolean);
      const one = (extra && extra.one) || (start && start.meaning) || paras[0] || '';
      const exact = (extra && extra.does) || paras.slice(1).join(' ') || (/^import \S+$/.test(page.key)
        ? 'It loads that module into the interpreter for the rest of the session, so its functions and constants can be used. Nothing is installed: the module is already part of the language, and nothing leaves this page.'
        : 'It is one command typed at the prompt: the syntax line below lists the parts it accepts, and its answer is printed in this terminal.' +
          (page.options.length ? ' The switches change how it behaves, never what it works on.' : ' Leave a part out and it uses its documented default.'));
      const facts = [];
      if (extra && extra.works) facts.push(extra.works);
      else {
        if (page.syntax && page.syntax !== page.name) facts.push('Write it as ' + page.syntax + '.' +
          (/\[/.test(page.syntax) ? ' Square brackets are optional parts; words in capitals are values you supply yourself.' : ''));
        if (page.options.length) facts.push('It has ' + page.options.length + ' documented switch' + (page.options.length === 1 ? '' : 'es') +
          ': each one changes how the command works, never what it works on. They are listed below.');
        if (page.examples.length) facts.push('The example below is a line this sandbox really runs, so its output is not a guess.');
        if (page.aliases.length) facts.push('It also answers to ' + page.aliases.join(', ') + '.');
        if (page.added) facts.push(page.added);
        facts.push('Everything happens inside this sandbox: the shell keeps the effect in its own files and tables, and nothing on the computer is touched.');
      }
      /* numbered in the order the rows actually appear, so a page without an authored middle level reads ① then ② */
      const marks = ['①', '②', '③'];
      const rows = [['In one sentence', one], ['Exactly what it does', exact], ['How it works, and what to watch for', facts.join(' ')]]
        .filter(([, text]) => text);
      if (!rows.length) return '';
      return '<section class="tpg-manual-levels"><h4>Explain it in layers</h4><dl>' +
        rows.map(([label, text], n) => '<dt>' + (marks[n] || '·') + ' ' + label + '</dt><dd>' + esc(text) + '</dd>').join('') +
        '</dl></section>';
    }

    function paintCommand() {
      if (page.guide === 'switches') return switchGuideHtml();
      const start = page.beginner;
      const title = start?.title || page.name;
      const meaning = start?.meaning || page.description[0] || 'See the command below.';
      const selected = page.options.filter(([label]) => flagged(label));
      const option = ([label, text, detail], highlight) => {
        const operator = label.split(/,\s*/)[0];
        const flagKey = page.key + ' ' + operator.trim().split(/[\s=:]/)[0];
        const linked = index.pages.some(entry => entry.key === flagKey);
        const labelHtml = '<code>' + esc(label) + '</code>' + (linked ? '<button type="button" class="tpg-manual-flag" data-manual-page="' + esc(flagKey) + '" title="Read the page for this switch">page</button>' : '');
        const form = page.examples.find(([line]) => TP.argvMeta(line, ['cmd', 'powershell'].includes(index.shell.id))
          .some(({ val, quoted }) => !quoted && optionMatches(index.shell.id, label, val)))?.[0];
        const layout = /^(?:pipes & chaining|braces & globs|redirection)$/.test(page.key) ? page.syntax : page.name + ' ' + operator + ' …';
        return '<div class="tpg-manual-option"' + (highlight ? ' data-manual-highlight' : '') + '>' + labelHtml + '<p>' +
        esc((highlight && start?.options[label]) || text) + '</p>' +
        '<p class="tpg-manual-note">' + (form ? 'Example ' : 'Where it goes ') + '<code>' +
        esc(form || layout) + '</code>' + (form ? '' : ' · Fill in any parts shown by …') + '</p>' +
        (detail && !highlight ? '<p class="tpg-manual-note">' + esc(detail) + '</p>' : '') + '</div>';
      };
      /* a command the help playground cannot run (moundshell's git and harness commands) gets no Run button */
      const canPlay = page.runnable !== false;
      const examples = page.examples.map(([command, result, kind]) => exampleBlock(command, result,
        !/<[\w .|/-]+>/.test(command) && (kind !== 'Sandbox' || index.mode === 'sandbox'),
        explainArguments(index.shell.id, page, command), canPlay)).join('');
      const startAvailable = start?.example && (!start.sandboxOnly || index.mode === 'sandbox');
      const sample = startAvailable ? [start.example, start.result] :
        page.examples.find(([command, , kind]) => !/<[\w .|/-]+>/.test(command) &&
          (kind === 'Current exercise' || index.mode === 'sandbox'));
      const quickLine = (canPlay && sample && !/<[\w .|/-]+>/.test(sample[0])) ? sample[0] : '';
      const quickBlock = quickLine ? '<div class="tpg-manual-quick"><h4>Try it right now</h4>' +
        '<p class="small mute">Press Run: the playground below executes this exact line, and the guide under it explains what came back.</p>' +
        '<form data-manual-quick="form" class="tpg-manual-quick-form"><span aria-hidden="true">$</span>' +
        '<input data-manual="quickcmd" aria-label="Command to run now" value="' + esc(quickLine) + '" autocomplete="off" spellcheck="false">' +
        '<button type="submit" class="pri">▶ Run it</button></form></div>' : '';
      const placeholders = [...new Set(page.syntax.match(/\b[A-Z][A-Z_]+\b/g) || [])].filter(word => argumentMeaning[word]);
      const inputs = placeholders.length ? '<h4>What to put in</h4><dl>' + placeholders.map(word => {
        const value = word === 'FORMAT' && page.key === 'stat' ? '%a' : argumentSample[word];
        return '<dt><code>' + esc(word) + '</code></dt><dd>' + esc(argumentMeaning[word]) +
          (value ? ' Example value <code>' + esc(value) + '</code>.' : '') + '</dd>';
      }).join('') + '</dl>' : '';
      const scope = index.mode === 'sandbox' ? 'The examples use the files in this playground. The real command may have more options.' :
        'Your puzzle may have different file names and support fewer options. Look at the names in your own terminal first.';
      return '<h3>' + esc(title) + '</h3>' +
        (page.added ? '<p class="tpg-manual-unreal"><b>➕ Not a standard ' + esc(index.shell.name) + ' command.</b> ' + esc(page.added) + '</p>' : '') +
        (page.real ? '' : '<p class="tpg-manual-unreal"><b>🚫 Not a real command in ' + esc(index.shell.name) + '.</b> ' +
          'This sandbox has no <code>' + esc(page.name) + '</code>, so typing it here only prints “command not found”. ' +
          'The page is kept as a reference so the name is not a mystery.</p>') +
        (page.parent ? '<p class="tpg-manual-parent">A switch that changes <button type="button" data-manual-page="' + esc(page.parent) + '"><code>' +
          esc(page.parent) + '</code></button>. Everything on that command’s page still applies; this page only explains the switch.</p>' + combineBlock(page) : '') +
        quickBlock +
        (start && !start.syntaxPage ? '<p><code class="tpg-manual-command-name">' + esc(page.name) + '</code></p>' : '') +
        '<p class="tpg-manual-meaning">' + esc(meaning) + '</p>' +
        '<p class="tpg-manual-eli5"><b>👶 Explained like you’re five:</b> ' + esc(TP.eli5 ? TP.eli5(meaning) : meaning) +
          (start && start.syntaxPage ? '' : ' You tell the computer by typing this word and pressing Enter.') + '</p>' +
        explainLevels(page, start) +
        (page.flag ? (() => {
          const parent = index.pages.find(entry => entry.key === page.parent && !entry.flag);
          const others = parent ? shortFlags(parent).filter(flag => flag !== page.flag) : [];
          return others.length ? '<p class="tpg-manual-note"><b>Other switches of ' + esc(page.parent) + ':</b> ' +
            others.map(flag => '<button type="button" class="tpg-manual-flag" data-manual-page="' + esc(page.parent + ' ' + flag) + '">' + esc(flag) + '</button>').join(' ') + '</p>' : '';
        })() : '') +
        (start && start.syntaxPage ? '<p class="tpg-manual-simple"><b>How you use it:</b> this is a piece of the shell’s language, not a command you type on its own. It appears inside a line like the example below.</p>' :
          '<p class="tpg-manual-simple"><b>How you use it:</b> type <code>' + esc(page.name) + '</code> at the prompt and press Enter. ' +
          'Everything after it is extra information for that command. The shell prints an answer, then shows a fresh prompt waiting for your next command.</p>')
        + '<p class="tpg-manual-tip">👶 <b>New to this?</b> Read the example below, then ' + (canPlay ?
          'press <b>▶ Try it here</b> — the playground at the bottom of this window runs it for real (inside the sandbox) and shows you exactly what it prints.' :
          'press <b>Copy to my terminal</b> to put the line on the shell’s own prompt, where this command really works, and press Enter there.') + '</p>' +
        (selected.length ? '<h4>What those options do</h4>' + selected.map(entry => option(entry, true)).join('') : '') +
        (sample ? '<h4>Try it</h4>' + exampleBlock(sample[0], sample[1], true,
          startAvailable && start.steps.length ? start.steps : explainArguments(index.shell.id, page, sample[0]), canPlay) :
          page.overviewOnly ? '' : '<h4>How it looks</h4><pre>' + esc(page.syntax) + '</pre>' + inputs) +
        '<details><summary>More details and options</summary><div><h4>How to write it</h4><pre class="tpg-manual-syntax">' +
        esc(page.syntax) + '</pre><p class="tpg-manual-note">Square brackets mean you can leave that part out. Words like FILE show where to put your own file name.</p>' +
        (sample ? inputs : '') + page.description.filter(text => text !== meaning).map(text => '<p>' + esc(text) + '</p>').join('') +
        (page.options.length ? '<h4>All options and inputs</h4><p class="small"><button type="button" data-manual-page="combining switches">How several switches share one dash</button></p>' + page.options.map(entry => option(entry, false)).join('') : '') +
        (examples ? '<h4>More examples</h4>' + examples : '') + '<h4>Playground notes</h4><p>' + esc(scope) + '</p>' +
        (page.note ? '<p>' + esc(page.note) + '</p>' : '') +
        (page.aliases.length ? '<p>Other names for this command include <code>' + esc(page.aliases.join(', ')) + '</code>.</p>' : '') +
        (page.source ? '<a href="' + esc(page.source) + '" target="_blank" rel="noopener noreferrer">Read the official reference</a>' : '') +
        '</div></details>';
    }

    function paintPage() {
      const view = get('page');
      if (!view) return;
      /* the target of the engagement is a live thing: the host builds this page afresh on every paint, and the nav
         button exists only while there really is an engagement to explain */
      const target = targetGuideNow();
      const targetButton = dialog && dialog.querySelector ? dialog.querySelector('[data-manual-target]') : null;
      if (targetButton) { targetButton.hidden = !target; targetButton.style.display = target ? '' : 'none'; }
      if (special === 'target' && !target) special = '';
      view.innerHTML = special === 'target' ? '<div class="tpg-manual-tour">' + target.body + '</div>' :
        special === 'tutorial' ? paintTutorial() : special === 'missions' ? paintMissions() :
        special === 'mission' ? paintMission() : page ? paintCommand() : paintStart();
      view.scrollTop = 0;
      get('path').textContent = index.shell.name + ' · ' + (special === 'target' ? 'Target help' :
        special === 'tutorial' ? 'Walkthrough' : special ? 'Missions' :
        (index.shell.modeName || { sandbox: 'Sandbox', puzzle: 'Puzzle Studio', lab: 'Labyrinth' }[index.mode] || index.mode));
      get('status').textContent = (lastCommand ? '$ ' + lastCommand + '\n' : '') + message;
      get('notice').textContent = message && (!lastCommand || page) ? message : '';
      const input = get('search');
      if (input && input.value !== filter) input.value = filter;
      paintIndex();
      paintPlay();
    }

    function saveView() { trail.push({ chapter, page, filter, flags, message, browsing }); if (trail.length > 40) trail.shift(); }

    function openPage(topic, direct = false) {
      const exact = direct ? index.pages.find(entry => entry.key === normal(topic)) : null;
      const found = exact ? { page: exact, flags: [], selector: '' } : pageFor(index, topic);
      saveView();
      special = '';
      if (!found.page) {
        page = null; filter = topic; flags = []; message = 'Pick a result from the list, or try another word.';
      } else {
        page = found.page; flags = found.flags; filter = ''; chapter = slug(page.chapter); browsing = false;
        message = found.selector && !page.options.some(([label]) => flagged(label)) ? 'There’s no short explanation for ' + found.selector + ' on this page.' : '';
      }
      paintPage();
    }

    function go(target) {
      const path = normal(target).replace(/^\/manual\/?/, '').replace(/^\/|\/$/g, '');
      special = '';
      if (!path || path === '..' || path === '~') {
        saveView(); chapter = ''; page = null; flags = []; filter = ''; message = ''; browsing = false; paintPage(); return;
      }
      const match = index.chapters.find(item => item.path === slug(path));
      if (!match) { message = 'Chapter not found. Try ls / or apropos WORD.'; paintPage(); return; }
      saveView(); chapter = match.path; page = null; flags = []; filter = ''; message = ''; browsing = true; paintPage();
    }

    function close() {
      if (!dialog?.open) return;
      if (typeof dialog.close === 'function') dialog.close();
      else dialog.removeAttribute('open');
      focusTerminal();
    }

    function navigate(line, typed = true) {
      const [command] = line.trim().split(/\s+/);
      if (!command) return;
      const arg = line.trim().slice(command.length).trim();
      lastCommand = typed ? line.trim() : '';
      switch (command.toLowerCase()) {
        case 'exit': case 'quit': close(); return;
        case 'cd': go(arg); return;
        case 'browse':
          saveView(); special = ''; chapter = ''; page = null; flags = []; filter = ''; message = ''; browsing = true; paintPage(); return;
        case 'tutorial': case 'walkthrough':
          saveView(); special = 'tutorial'; tutStep = 0; page = null; flags = []; filter = ''; message = ''; browsing = false; paintPage(); return;
        case 'missions':
          saveView(); special = 'missions'; page = null; flags = []; filter = ''; message = ''; browsing = false; paintPage(); return;
        case 'switches': case 'flags': case 'options':
          openPage('combining switches', true); return;
        case 'target': case 'this target': case 'engagement':
          openTarget(); return;
        case 'ls':
          if (arg && !/^\/(?:manual\/?)?$/.test(arg)) { go(arg); return; }
          if (arg) { saveView(); chapter = ''; page = null; flags = []; filter = ''; browsing = true; }
          if (!browsing) { saveView(); browsing = true; }
          message = chapter ? 'Pick a page from the list, or type man PAGE.' : index.chapters.map(item => item.path + '/').join('  ');
          paintPage(); return;
        case 'pwd': message = '/manual' + (chapter ? '/' + chapter : ''); paintPage(); return;
        case 'back': {
          const previous = trail.pop();
          special = '';
          if (previous) ({ chapter, page, filter, flags, message, browsing } = previous);
          else message = 'You are at the first page.';
          paintPage(); return;
        }
        case 'help':
          if (arg) { openPage(arg); return; }
          message = Object.values(usage).join('\n'); paintPage(); return;
        case 'man': case 'cat':
          if (!arg || /^(?:\/manual\/|\/)?readme(?:\.txt)?$/i.test(arg)) { go('/'); return; }
          openPage(arg); return;
        case 'apropos': case 'search':
          saveView(); filter = arg; page = null; flags = []; message = arg ? 'Search results for “' + arg + '”' : 'Type a word after apropos, or use the search field.'; paintPage(); return;
        default:
          if (pageFor(index, line).page) { openPage(line); return; }
          message = 'Unknown navigation command. Type help for the list.'; paintPage();
      }
    }

    /* ------------------------------------------------------------------ the AI box
       It answers questions about the shell on screen, and it can walk the manual: when its reply names a page, a button
       opens that page, so “which switch do I need?” ends on the right page with the switch highlighted. */
    const ai = { log: [], links: [], busy: false, ctl: null, models: [], ready: false, picked: '', sh: '' };
    const AI_KEY = 'tpg_manual_ai_model';
    const aiStore = {
      get(k, d) { try { return ls.get(k, d); } catch (e) { try { return localStorage.getItem(k) || d; } catch (x) { return d; } } },
      set(k, v) { try { ls.set(k, v); } catch (e) { try { localStorage.setItem(k, v); } catch (x) { } } }
    };
    const aiEsc = value => String(value ?? '').replace(/[&<>"]/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[char]));
    const aiLabel = m => A.modelOrder ? A.modelOrder.label(m) : (m.label || m.name || '');

    function aiModel() {
      const sel = get('aimodel');
      if (!sel) return;
      if (!ai.ready) { sel.innerHTML = '<option value="">Finding the AIs…</option>'; return; }
      const list = ai.models;
      sel.innerHTML = list.length
        ? list.map(m => '<option value="' + aiEsc(m.name) + '"' + (m.name === ai.picked ? ' selected' : '') + '>' + aiEsc(aiLabel(m)) + '</option>').join('')
        : '<option value="">' + (A.ai && A.ai.model && A.ai.model() ? 'The AI chosen at the top of the app' : 'No AI model found') + '</option>';
    }
    async function aiLoad() {
      aiModel();
      if (ai.ready) return;
      try { ai.models = ((await A.olympics.models()) || []).filter(m => m && m.chat !== false); } catch (e) { ai.models = []; }
      ai.ready = true;
      const def = A.modelOrder && A.modelOrder.get ? A.modelOrder.get() : '';
      const saved = aiStore.get(AI_KEY, '');
      const hit = ai.models.find(m => saved && m.name === saved) ||
        (def && ai.models.find(m => A.modelOrder.matches(m, def))) || ai.models[0];
      ai.picked = (hit && hit.name) || '';
      aiModel();
    }

    function aiText(text) {
      const html = aiEsc(text).replace(/`([^`\n]+)`/g, '<code>$1</code>')
        .replace(/\*\*([^*\n]+)\*\*/g, '<b>$1</b>')
        .replace(/\n{2,}/g, '</p><p>').replace(/\n/g, '<br>');
      return '<p>' + html + '</p>';
    }
    function aiSplit(text) {
      const links = [], keep = [];
      for (const line of String(text || '').split('\n')) {
        const m = /^\s*(OPEN|PAGE|CHAPTER)\s*:\s*(.+?)\s*$/i.exec(line);
        if (!m) { keep.push(line); continue; }
        const name = m[2].replace(/[`"'“”]/g, '').trim();
        if (name && !links.some(l => l.name === name)) links.push({ kind: /chapter/i.test(m[1]) ? 'chapter' : 'page', name });
      }
      return { body: keep.join('\n').trim(), links };
    }
    function aiPaint() {
      const box = get('ailog');
      if (!box) return;
      if (!ai.log.length) {
        box.innerHTML = '<p class="small mute">Ask anything about ' + aiEsc(index ? index.shell.name : 'this shell') +
          ': “what does grep -n do?”, “how do I send this into a file?”, “which page explains switches?”. ' +
          'It answers here and opens the page it points at.</p>';
        return;
      }
      box.innerHTML = ai.log.map(turn => '<div class="tpg-manual-ai-turn ' + (turn.role === 'user' ? 'me' : 'ai') + '">' +
        '<b>' + (turn.role === 'user' ? 'You' : '🤖') + '</b><div class="tpg-manual-ai-text">' +
        (turn.role === 'user' ? '<p>' + aiEsc(turn.text) + '</p>' : aiText(turn.text || '…')) + '</div>' +
        (turn.links && turn.links.length ? '<div class="tpg-manual-ai-links">' + turn.links.map(link =>
          '<button type="button" ' + (link.kind === 'chapter' ? 'data-manual-ai-chapter' : 'data-manual-ai-page') + '="' + aiEsc(link.name) + '">📖 Open ' + aiEsc(link.name) + '</button>').join('') + '</div>' : '') +
        '</div>').join('');
      box.scrollTop = box.scrollHeight;
    }
    function aiOpenPage(name) {
      if (!index) return;
      const found = pageFor(index, name).page || index.pages.find(entry => normal(entry.name) === normal(name) || entry.key === normal(name));
      if (found) openPage(found.key, true);
      else { saveView(); filter = name; page = null; flags = []; message = 'No page is called “' + name + '” — these are the closest results.'; paintPage(); }
      const view = get('page'); if (view) view.focus({ preventScroll: true });
    }
    function aiOpenChapter(name) {
      if (!index) return;
      const hit = index.chapters.find(item => normal(item.title) === normal(name));
      if (hit) { go(hit.path); const view = get('page'); if (view) view.focus({ preventScroll: true }); return; }
      aiOpenPage(name);
    }
    function aiStop() { if (ai.ctl) { try { ai.ctl.abort(); } catch (e) { } } }
    function aiClear() { aiStop(); ai.log = []; aiPaint(); const input = get('aiin'); if (input) input.focus(); }

    async function aiAsk(input) {
      if (!index) return;
      const text = String((input && input.value) || '').trim();
      if (!text || ai.busy) return;
      if (!A.ai || !A.ai.stream) { A.toast('The AI is not available.'); return; }
      if (input) input.value = '';
      ai.log.push({ role: 'user', text });
      const turns = ai.log.slice(-8).map(turn => ({ role: turn.role === 'user' ? 'user' : 'assistant', content: String(turn.text || '').slice(0, 4000) }));
      const reply = { role: 'ai', text: '', links: [] };
      ai.log.push(reply);
      ai.busy = true;
      aiPaint();
      const stopBtn = dialog.querySelector('[data-manual-ai="stop"]'); if (stopBtn) stopBtn.hidden = false;
      const ctl = ai.ctl = new AbortController();
      const here = page ? ('the page “' + page.name + '”' + (page.chapter ? ' in ' + page.chapter : '')) : (special || 'the opening page');
      const names = index.pages.filter(entry => !entry.flag).slice(0, 220).map(entry => entry.name).join(', ');
      const chapters = index.chapters.map(item => item.title).join(', ');
      const system = 'You are the help assistant inside the terminal help window of Moundshroud, an offline app. ' +
        'The reader is using the shell “' + index.shell.name + '” and is on ' + here + '.\n' +
        'Answer in plain English for a beginner. Explain commands, switches, pipes and redirection concretely, with one short example line when it helps. ' +
        'If the question is about a programming language in the Code playground, answer briefly and say that the Cyber Codex (Cyber › 📚 Manual book) has a page for it. ' +
        'When a manual page would help, end with one line exactly like “OPEN: <page name>” using a name from the list below, or “CHAPTER: <chapter name>”. ' +
        'Use at most one such line, and only a name you are sure exists. Never invent a switch; if you are unsure, say so and suggest searching the manual.\n' +
        'Keep the answer under 130 words, in short paragraphs, with no headings.\n' +
        'Pages in this manual: ' + names + '.\nChapters: ' + chapters + '.';
      try {
        const all = await A.ai.stream([{ role: 'system', content: system }, ...turns], on => {
          if (ctl.signal.aborted) return;
          reply.text = aiSplit(on).body || '…';
          aiPaint();
        }, ctl.signal, { model: ai.picked || undefined, temp: 0.2 });
        const done = aiSplit(all || reply.text);
        reply.text = done.body || 'The AI gave no answer. Check that a model is chosen above.';
        reply.links = done.links;
      } catch (error) {
        reply.text = ctl.signal.aborted ? 'Stopped.' : 'The AI could not answer: ' + ((error && error.message) || error);
        reply.links = [];
      } finally {
        ai.busy = false;
        ai.ctl = null;
        if (stopBtn) stopBtn.hidden = true;
        aiPaint();
      }
    }

    /* the page about the engagement the host shell is in; it exists only while that engagement does */
    function openTarget() {
      if (!targetGuideNow()) {
        message = 'No engagement is open, so there is no target to explain. Start one with breach <target> in the moundshell.';
        paintPage();
        return;
      }
      saveView();
      special = 'target'; page = null; flags = []; filter = ''; message = ''; browsing = false;
      paintPage();
      const view = get('page'); if (view) view.focus({ preventScroll: true });
    }

    function open(shell, mode, scenarioExamples, query, missionCtx) {
      const host = root.querySelector('[data-terminal-manual]');
      if (!host) return false;
      if (!dialog || !host.contains(dialog)) {
        host.innerHTML = '<dialog class="tpg-manual" aria-labelledby="' + heading + '">' +
          '<header><div class="tpg-manual-ident"><label class="tpg-manual-pick" title="Switch to another shell’s help without closing this window">' +
          '<span>Shell</span><select data-manual="shellpick" aria-label="Read the help for another shell"></select></label>' +
          '<div><h2 id="' + heading + '">Terminal help</h2><span data-manual="path"></span></div></div>' +
          '<div class="row" style="gap:6px;align-items:center;flex-wrap:wrap"><button type="button" data-manual-book title="Open the Cyber Codex: every shell and every coding language as a book">📚 Manual book</button>' +
          '<button type="button" data-manual-full title="Fill the window with the manual and the playground inside it">⛶ Fullscreen</button>' +
          '<button type="button" data-manual-close>Back to terminal</button></div></header>' +
          '<nav aria-label="Manual navigation">' + nav.map(([cmd, label]) => '<button type="button" data-manual-nav="' + esc(cmd) + '">' + esc(label) + '</button>').join('') +
          (targetGuide ? '<button type="button" data-manual-nav="target" data-manual-target hidden style="display:none" title="Every command you can use on the target of the engagement you are in: what it does there, why you would use it, and its switches — without printing the answer">🎯 This target</button>' : '') +
          '<label class="tpg-manual-search">Find help<input type="search" data-manual="search" placeholder="Try “find a word” or “grep -n”" autocomplete="off"></label>' +
          '<label class="tpg-manual-anyshell" title="Search the commands of every shell this window can read, not only the one on screen"><input type="checkbox" data-manual="every"> every shell</label></nav>' +
          '<div class="tpg-manual-notice" data-manual="notice" role="status"></div>' +
          '<div class="tpg-manual-columns" data-manual="columns"><aside data-manual="index" aria-label="Command list"><div data-manual="pages" class="tpg-manual-list"></div></aside>' +
          '<article data-manual="page" aria-label="Manual page" tabindex="0"></article></div>' +
          '<section class="tpg-manual-play" aria-label="Playground">' +
          '<div class="tpg-manual-play-head"><b>Playground</b><span class="tpg-manual-play-shell" data-manual="playshell"></span>' +
          '<button type="button" data-manual-play="full" title="Fill the window with only this playground (the help stays open underneath)">⛶ Playground fullscreen</button>' +
          '<span class="tpg-manual-play-note">' + esc(shell.playNote || 'Type any command this shell has and press Enter. It runs in the sandbox, with the same files as your terminal.') + '</span>' +
          '<button type="button" data-manual-play="clear">Clear output</button>' +
          '<button type="button" class="tpg-manual-fold" data-manual-fold="play" aria-expanded="true" aria-label="Fold the playground away" title="Fold the playground away (click again to show it)">▾</button></div>' +
          '<pre class="tpg-manual-play-out" data-manual="out" tabindex="0" aria-live="polite"></pre>' +
          '<form class="tpg-manual-play-form" data-manual-play="form"><span aria-hidden="true">$</span>' +
          '<input data-manual="playin" aria-label="Run a command in the playground" placeholder="Type a command, e.g. ls" autocomplete="off" spellcheck="false">' +
          '<button type="submit">Run</button></form></section>' +
          '<section class="tpg-manual-coach" aria-label="Output coach">' +
          '<div class="tpg-manual-coach-head"><b>What this output means</b><span class="small mute">A separate guide — it explains the command and its answer, and everything it runs stays in a copy.</span>' +
          '<span style="flex:1"></span><button type="button" class="tpg-manual-fold" data-manual-fold="coach" aria-expanded="true" aria-label="Fold the output guide away" title="Fold the output guide away (click again to show it)">▾</button></div>' +
          '<div data-manual="coach" aria-live="polite"></div></section>' +
          '<section class="tpg-manual-ai" aria-label="Ask the AI for help">' +
          '<div class="tpg-manual-ai-head"><b>🤖 Ask the AI about this shell</b>' +
          '<select data-manual="aimodel" aria-label="Which AI answers" title="Choose the AI you talk to"></select>' +
          '<span class="tpg-manual-ai-note">It explains commands, switches and pipes, and opens the page its answer points at.</span>' +
          '<button type="button" data-manual-ai="clear" title="Clear this conversation">Clear chat</button>' +
          '<button type="button" class="tpg-manual-fold" data-manual-fold="ai" aria-expanded="true" aria-label="Fold the AI chat away" title="Fold the AI chat away (click again to show it)">▾</button></div>' +
          '<div class="tpg-manual-ai-log" data-manual="ailog" aria-live="polite"></div>' +
          '<form class="tpg-manual-ai-form" data-manual-ai="form"><span aria-hidden="true">🤖</span>' +
          '<input data-manual="aiin" aria-label="Ask the AI about this shell" placeholder="Ask about a command, a switch, or where to look" autocomplete="off" spellcheck="false">' +
          '<button type="submit">Ask</button><button type="button" data-manual-ai="stop" hidden>Stop</button></form></section>' +
          '<details class="tpg-manual-typed"><summary>Use help by typing</summary><div>' +
          '<p>Type <code>ls</code> to list groups, <code>man grep -n</code> to read about an option, or <code>exit</code> to go back to your terminal.</p>' +
          '<pre class="tpg-manual-status" data-manual="status" role="status"></pre>' +
          '<form data-manual="form"><span aria-hidden="true">help $</span><input data-manual="input" aria-label="Help terminal command" placeholder="Type a help command" autocomplete="off" spellcheck="false"><button type="submit">Go</button></form>' +
          '</div></details></dialog>';
        dialog = host.querySelector('dialog');
        if (!dialog) return false;
        const pickPage = key => {
          const found = pageFor(index, filter);
          const useFilter = found.page?.key === key && found.flags.some(flag => found.page.options.some(([label]) => optionMatches(index.shell.id, label, flag)));
          openPage(useFilter ? filter : key, !useFilter);
        };
        dialog.addEventListener('cancel', event => {
          event.preventDefault();
          /* Esc leaves the playground's fullscreen first, then closes help on the next press */
          if (playFull) { setPlayFull(false); return; }
          close();
        });
        dialog.addEventListener('click', event => {
          const button = event.target.closest('button');
          if (!button) return;
          if (button.hasAttribute('data-manual-close')) return close();
          if (button.dataset.manualBook !== undefined) {
            if (window.A && A.cyberBook) A.cyberBook.open();
            else if (A.toast) A.toast('The Cyber Codex is still loading. Try again in a moment.', 3500);
            return;
          }
          if (button.dataset.manualFold) return toggleFold(button.dataset.manualFold, button);
          if (button.dataset.manualAi === 'clear') return aiClear();
          if (button.dataset.manualAi === 'stop') return aiStop();
          if (button.dataset.manualAiPage) return aiOpenPage(button.dataset.manualAiPage);
          if (button.dataset.manualAiChapter) return aiOpenChapter(button.dataset.manualAiChapter);
          if (button.hasAttribute('data-manual-full')) {
            const on = dialog.classList.toggle('tpg-manual-full');
            button.textContent = on ? '🗗 Leave fullscreen' : '⛶ Fullscreen';
            try { localStorage.setItem('tpg_manual_full', on ? '1' : '0'); } catch (e) { }
            get('page').focus({ preventScroll: true });
            return;
          }
          if (button.dataset.manualPlay === 'full') {
            setPlayFull(!playFull);
            return;
          }
          if (button.dataset.manualNav) {
            navigate(button.dataset.manualNav, false);
            get('page').focus({ preventScroll: true });
            return;
          }
          if (button.dataset.tut) {
            const steps = tutorialSteps();
            const go2 = button.dataset.tut;
            if (go2 === 'next') tutStep = Math.min(tutStep + 1, steps.length - 1);
            else if (go2 === 'back') tutStep = Math.max(0, tutStep - 1);
            else if (go2 === 'run' && steps[tutStep]?.command) playRun(steps[tutStep].command);
            paintPage();
            get('page').focus({ preventScroll: true });
            return;
          }
          if (button.dataset.missioncat) {
            missionCat = button.dataset.missioncat;
            paintPage();
            return;
          }
          if (button.dataset.mission) {
            missionId = button.dataset.mission;
            const m = missions().find(x => x.id === missionId);
            missionStep = m ? Math.min(missionDone(m.id), m.steps.length - 1) : 0;
            special = 'mission';
            message = '';
            paintPage();
            get('page').focus({ preventScroll: true });
            return;
          }
          if (button.dataset.missionstep) {
            missionStep = Math.max(0, +button.dataset.missionstep || 0);
            paintPage();
            return;
          }
          if (button.hasAttribute('data-missionreset')) {
            if (missionId) setMissionDone(missionId, 0);
            missionStep = 0;
            message = 'Mission reset. Start from the first step.';
            paintPage();
            return;
          }
          if (button.dataset.missionfill) {
            const input = get('playin');
            if (input) { input.value = button.dataset.missionfill; input.focus(); }
            return;
          }
          if (button.hasAttribute('data-missionrun')) { runMissionStep(); get('page').focus({ preventScroll: true }); return; }
          if (button.dataset.manualCross) {
          openShellPage(button.dataset.manualShell, button.dataset.manualPage);
          get('page').focus({ preventScroll: true });
          return;
        }
        if (button.dataset.manualChapter || button.dataset.manualPage) {
            if (button.dataset.manualChapter) go(button.dataset.manualChapter);
            else pickPage(button.dataset.manualPage);
            get('page').focus({ preventScroll: true });
            return;
          }
          if (button.hasAttribute('data-manual-run')) { playRun(button.getAttribute('data-manual-run')); get('playin')?.focus({ preventScroll: true }); return; }
          if (button.dataset.manualInsert) { close(); useExample(button.dataset.manualInsert); }
        });
        const playForm = dialog.querySelector('[data-manual-play="form"]');
        if (playForm) playForm.addEventListener('submit', event => {
          event.preventDefault();
          const input = get('playin');
          playRun(input.value);
          input.value = '';
          input.focus();
        });
        dialog.querySelector('[data-manual-play="clear"]')?.addEventListener('click', () => { playLog = []; paintPlay(); get('playin')?.focus(); });
        get('form').addEventListener('submit', event => { event.preventDefault(); const input = get('input'); navigate(input.value); input.value = ''; });
        dialog.addEventListener('submit', event => {
          const ask = event.target.closest && event.target.closest('[data-manual-ai="form"]');
          if (ask) { event.preventDefault(); aiAsk(get('aiin')); return; }
          const quick = event.target.closest && event.target.closest('[data-manual-quick="form"]');
          if (!quick) return;
          event.preventDefault();
          const input = get('quickcmd');
          if (!input || !String(input.value).trim()) return;
          playRun(input.value);
          get('coach')?.scrollIntoView({ block: 'nearest' });
        });
        get('search').addEventListener('input', event => {
          filter = event.target.value;
          /* the “type a word” hint from the every-shell toggle goes away as soon as there is a word to search for */
          if (filter.trim() && everyShell && /^Type a word above/.test(message)) { message = ''; paintPage(); return; }
          paintIndex();
        });
        const everyToggle = get('every');
        if (everyToggle) everyToggle.addEventListener('change', event => {
          everyShell = !!event.target.checked;
          try { localStorage.setItem('tpg_manual_every_shell', everyShell ? '1' : '0'); } catch (e) { }
          if (everyShell && !filter.trim()) {
            message = 'Type a word above to search the commands of every shell at once. The shell on screen is only one of them.';
            paintPage();
            get('search').focus({ preventScroll: true });
            return;
          }
          paintIndex();
          if (everyShell) get('search').focus({ preventScroll: true });
        });
        const shellSelect = get('shellpick');
        if (shellSelect) shellSelect.addEventListener('change', event => {
          const key = event.target.value;
          if (!key || key === helpKeyOf(index && index.shell) || typeof options.pickShell !== 'function') return;
          try { options.pickShell(key); } catch (e) { }
        });
        /* the AI box answers with the model chosen here, and remembers the choice for every shell */
        const modelSel = get('aimodel');
        if (modelSel) modelSel.addEventListener('change', event => {
          ai.picked = event.target.value;
          aiStore.set(AI_KEY, ai.picked);
          const input = get('aiin'); if (input) input.focus({ preventScroll: true });
        });
        get('search').addEventListener('keydown', event => {
          if (event.key !== 'Enter') return;
          const results = everyShell && filter.trim() ? everyShellResults(filter) : search(index, filter);
          if (results.length) {
            event.preventDefault();
            const first = results[0];
            if (first.shellKey) openShellPage(first.shellKey, first.key);
            else pickPage(first.key);
            get('page').focus({ preventScroll: true });
          }
        });
      }
      try {
        if (localStorage.getItem('tpg_manual_full') === '1') dialog.classList.add('tpg-manual-full');
      } catch (e) { }
      const fullBtn = dialog.querySelector('[data-manual-full]');
      if (fullBtn) fullBtn.textContent = dialog.classList.contains('tpg-manual-full') ? '🗗 Leave fullscreen' : '⛶ Fullscreen';
      index = buildIndex(shell, mode, scenarioExamples);
      shellIndexes.set(helpKeyOf(index.shell), index);
      mission = missionCtx && (missionCtx.objective || (missionCtx.commands && missionCtx.commands.length)) ? missionCtx : null;
      trail.length = 0; chapter = ''; page = null; filter = ''; flags = []; lastCommand = ''; browsing = false; message = ''; playLog = [];
      try { everyShell = localStorage.getItem('tpg_manual_every_shell') === '1'; } catch (e) { everyShell = false; }
      const everyBox = get('every');
      if (everyBox) everyBox.checked = everyShell;
      special = ''; tutStep = 0; missionStep = 0; missionCat = 'All';
      setPlayFull(false);
      applyFolds();
      paintShellPick();
      if (!dialog.open) {
        if (typeof dialog.showModal === 'function') dialog.showModal();
        else dialog.setAttribute('open', '');
      }
      renderCoach('', '');
      /* the AI box follows the shell you are reading about; a new shell starts a new conversation */
      if (ai.sh !== index.shell.id) { ai.log = []; ai.sh = index.shell.id; }
      aiPaint();
      aiLoad();
      if (query) openPage(query); else paintPage();
      (query ? get('page') : get('search'))?.focus({ preventScroll: true });
      return true;
    }

    return { open, close, target: openTarget };
  }

  TP.manual = { create, buildIndex, search, pageFor, guideRequest };
})();

// Terminal playground — sandboxed interpreters that back Cyber > Terminal playground.
// Every shell here is simulated: a virtual file system, in-memory tables, a fake repository and
// fake containers. The point is to try every command of every terminal without touching the PC.
(function () {
  const G = (window.TerminalPlayground = window.TerminalPlayground || {});

  G.readSave = (key, fallback = null) => {
    try { return JSON.parse(localStorage.getItem(key)) ?? fallback; }
    catch (e) { return fallback; }
  };
  G.writeSave = (key, data) => {
    try { localStorage.setItem(key, JSON.stringify(data)); return true; }
    catch (e) { return false; }
  };
  G.replaceSavedObject = (target, source) => {
    if (!source || typeof source !== 'object' || Array.isArray(source)) return;
    for (const key of Object.keys(target)) delete target[key];
    for (const [key, value] of Object.entries(source)) {
      Object.defineProperty(target, key, { value, writable: true, enumerable: true, configurable: true });
    }
  };
  // Save plain REPL data only. Live functions, resource handles, and cycles are not re-executed on startup.
  G.snapshotVariables = vars => {
    const ancestors = new Set();
    function copy(value) {
      if (value === null || ['string', 'boolean'].includes(typeof value) || Number.isFinite(value)) return value;
      if (typeof value !== 'object' || ancestors.has(value)) return undefined;
      const array = Array.isArray(value);
      const proto = Object.getPrototypeOf(value);
      if (!array && proto !== null && Object.getPrototypeOf(proto) !== null) return undefined;
      if (array && value.length > 50000) return undefined;
      ancestors.add(value);
      const entries = Object.entries(Object.getOwnPropertyDescriptors(value))
        .filter(([, descriptor]) => descriptor.enumerable && Object.hasOwn(descriptor, 'value'))
        .map(([key, descriptor]) => [key, copy(descriptor.value)]);
      ancestors.delete(value);
      if (entries.some(([, item]) => item === undefined)) return undefined;
      return array ? Object.assign(new Array(value.length), Object.fromEntries(entries.filter(([key]) => /^(0|[1-9]\d*)$/.test(key)))) : Object.fromEntries(entries);
    }
    const result = [];
    for (const [key, descriptor] of Object.entries(Object.getOwnPropertyDescriptors(vars))) {
      if (!Object.hasOwn(descriptor, 'value')) continue;
      try {
        const value = copy(descriptor.value);
        if (value !== undefined) result.push([key, value]);
      } catch (e) { /* A host object or unsupported value is left out of the save. */ }
      finally { ancestors.clear(); }
    }
    return Object.fromEntries(result);
  };

  /* ---------------------------------------------------------------- shared parsing */
  G.tokenize = function (s) {
    const out = []; let cur = '', q = null;
    for (let i = 0; i < s.length; i++) {
      const c = s[i];
      if (q) { if (c === q) q = null; else cur += c; }
      else if (c === '"' || c === "'") q = c;
      else if (c === '\\' && i + 1 < s.length) cur += s[++i];
      else if (/\s/.test(c)) { if (cur) { out.push(cur); cur = ''; } }
      else cur += c;
    }
    if (cur) out.push(cur);
    return out;
  };
  G.splitTop = function (s, seps) {
    const out = []; let cur = '', q = null;
    for (let i = 0; i < s.length; i++) {
      const c = s[i];
      if (q) { cur += c; if (c === q) q = null; continue; }
      if (c === '"' || c === "'") { q = c; cur += c; continue; }
      if (c === '\\' && i + 1 < s.length) { cur += c + s[++i]; continue; }
      const sep = seps.find(x => s.startsWith(x, i));
      if (sep) { out.push(cur); cur = ''; i += sep.length - 1; continue; }
      cur += c;
    }
    out.push(cur);
    return out.map(x => x.trim()).filter(Boolean);
  };
  // Split Bash syntax before expanding words or executing substitutions.
  function splitBash(text, operators, first = false, compound = false) {
    const parts = [], scopes = [{ quote: '', close: '' }];
    const controls = [], comments = [];
    let start = 0, commandStart = true;
    function source(end) {
      let result = '', cursor = start;
      for (const [from, to] of comments) {
        if (from < cursor || from >= end) continue;
        result += text.slice(cursor, from);
        cursor = to;
      }
      return (result + text.slice(cursor, end)).trim();
    }
    for (let i = 0; i < text.length; i++) {
      const scope = scopes.at(-1), char = text[i];
      if (scope.quote === "'") { if (char === "'") scope.quote = ''; continue; }
      if (char === '\\') { if (scopes.length === 1 && text[i + 1] !== '\n') commandStart = false; i++; continue; }
      if (char === '$' && /[({]/.test(text[i + 1] || '')) {
        if (scopes.length === 1) commandStart = false;
        scopes.push({ quote: '', close: text[++i] === '(' ? ')' : '}' });
        continue;
      }
      if (scope.quote) { if (char === scope.quote) scope.quote = ''; continue; }
      if (char === '#' && bashBoundary(text[i - 1]) && (scope.close !== '}' || scope.braceWord)) {
        const newline = text.indexOf('\n', i);
        const end = newline < 0 ? text.length : newline;
        comments.push([i, end]);
        i = end - 1;
        continue;
      }
      if (char === '"' || char === "'" || char === '`') { if (scopes.length === 1) commandStart = false; scope.quote = char; continue; }
      if (char === scope.close && (!scope.braceWord || bashBoundary(text[i - 1]) && bashBoundary(text[i + 1]))) { scopes.pop(); continue; }
      if (char === '(' || char === '{' && bashBoundary(text[i - 1]) && bashBoundary(text[i + 1])) {
        if (scopes.length === 1) commandStart = false;
        scopes.push({ quote: '', close: char === '(' ? ')' : '}', braceWord: char === '{' });
        continue;
      }
      if (scopes.length > 1) continue;
      const operator = !controls.length && operators.find(op => text.startsWith(op, i) &&
        (!/^[a-z]/.test(op) || commandStart && bashBoundary(text[i + op.length])) && (!/^[12]/.test(op) || i === start || /\s/.test(text[i - 1])));
      if (!operator) {
        if (!compound) continue;
        if (/[;|&\n]/.test(char)) { commandStart = true; continue; }
        if (/\s/.test(char)) continue;
        if (commandStart) {
          const reserved = /^(for|while|until|if|do|then|else|elif|done|fi|!)(?=$|[\s;|&()<>])/.exec(text.slice(i))?.[0];
          if (reserved) {
            if (reserved === 'if') controls.push('fi');
            else if (['for', 'while', 'until'].includes(reserved)) controls.push('done');
            else if (reserved === controls.at(-1)) controls.pop();
            commandStart = !['for', 'done', 'fi'].includes(reserved);
            i += reserved.length - 1;
            continue;
          }
        }
        commandStart = false;
        continue;
      }
      parts.push({ text: source(i), operator, end: i });
      if (first) return parts;
      i += operator.length - 1;
      start = i + 1;
      commandStart = true;
    }
    if (scopes.length > 1 || scopes[0].quote || controls.length) return null;
    parts.push({ text: source(text.length), operator: '' });
    return parts;
  }
  const bashBoundary = char => char === undefined || /[\s;|&()<>]/.test(char);
  const textLines = text => text ? text.replace(/\n$/, '').split('\n') : [];
  const writeLines = rows => rows.length ? rows.join('\n') + '\n' : '';

  const arithmeticPrecedence = [
    [','], ['=', '+=', '-=', '*=', '/=', '%='], ['||'], ['&&'], ['|'], ['^'], ['&'], ['==', '!='],
    ['<', '<=', '>', '>='], ['<<', '>>'], ['+', '-'], ['*', '/', '%'], ['**']
  ];
  const arithmeticOperators = new Map(arithmeticPrecedence.flatMap((row, index) => row.map(op => [op, index + 1])));
  const arithmeticName = /^[A-Za-z_]\w*$/;
  const signed = value => BigInt.asIntN(64, value);

  function arithmetic(source, read, write, resolving = new Set()) {
    const lexer = /\s+|\$?[A-Za-z_]\w*|0[xX][0-9a-fA-F]+|\d+|\*\*|\+\+|--|<<|>>|&&|\|\||[!<>=+*/%-]=|[-+*/%&|^!~(),=<>]/gy;
    const tokens = [];
    for (let offset = 0; offset < source.length;) {
      lexer.lastIndex = offset;
      const match = lexer.exec(source);
      if (!match || tokens.length >= 512) throw new Error('invalid arithmetic expression');
      if (!/^\s/.test(match[0])) tokens.push(match[0].replace(/^\$/, ''));
      offset = lexer.lastIndex;
    }
    if (!tokens.length) return 0n;

    let index = 0;
    function operand() {
      const token = tokens[index++];
      let node;
      if (token === '(') {
        node = expression(1);
        if (tokens[index++] !== ')') throw new Error('expected closing parenthesis in arithmetic expression');
      } else if (['+', '-', '!', '~', '++', '--'].includes(token)) return { unary: token, target: operand() };
      else if (arithmeticName.test(token || '')) node = { name: token };
      else if (/^\d/.test(token || '')) node = { number: token };
      else throw new Error('expected arithmetic operand');
      if (['++', '--'].includes(tokens[index])) return { unary: tokens[index++], target: node, postfix: true };
      return node;
    }
    function expression(floor) {
      let left = operand();
      for (let op = tokens[index], priority = arithmeticOperators.get(op); priority >= floor;
        op = tokens[index], priority = arithmeticOperators.get(op)) {
        index++;
        const right = expression(priority + Number(op !== '**' && priority !== 2));
        left = { left, op, right };
      }
      return left;
    }
    const tree = expression(1);
    if (index !== tokens.length) throw new Error('unexpected arithmetic token: ' + tokens[index]);
    const update = (node, value) => {
      if (!node.name) throw new Error('arithmetic assignment requires a variable');
      const result = signed(value);
      write(node.name, String(result));
      return result;
    };
    function binary(op, a, b) {
      switch (op) {
        case '+': return a + b;
        case '-': return a - b;
        case '*': return a * b;
        case '/': case '%':
          if (b === 0n) throw new Error('division by zero');
          return op === '/' ? a / b : a % b;
        case '**': {
          if (b < 0n) throw new Error('exponent less than zero');
          let value = 1n;
          for (let bit = b; bit; bit >>= 1n, a = signed(a * a)) if (bit & 1n) value = signed(value * a);
          return value;
        }
        case '<<': return a << (b & 63n);
        case '>>': return a >> (b & 63n);
        case '&': return a & b;
        case '|': return a | b;
        case '^': return a ^ b;
        case '<': return BigInt(a < b);
        case '<=': return BigInt(a <= b);
        case '>': return BigInt(a > b);
        case '>=': return BigInt(a >= b);
        case '==': return BigInt(a === b);
        case '!=': return BigInt(a !== b);
        case ',': return b;
        default: throw new Error('unsupported arithmetic operator');
      }
    }
    function evaluate(node) {
      if (node.number) return signed(BigInt(/^0\d+$/.test(node.number) ? '0o' + node.number : node.number));
      if (node.name) {
        const value = read(node.name);
        if (!value) return 0n;
        if (resolving.has(node.name) || resolving.size >= 32) throw new Error('recursive arithmetic variable');
        resolving.add(node.name);
        try { return arithmetic(value, read, write, resolving); }
        finally { resolving.delete(node.name); }
      }
      if (node.unary) {
        const value = evaluate(node.target);
        switch (node.unary) {
          case '+': return value;
          case '-': return signed(-value);
          case '!': return BigInt(!value);
          case '~': return ~value;
          default: {
            const result = update(node.target, value + (node.unary === '++' ? 1n : -1n));
            return node.postfix ? value : result;
          }
        }
      }
      const { left, op, right } = node;
      if (op === '=') return update(left, evaluate(right));
      const a = evaluate(left);
      if (op === '&&') return BigInt(Boolean(a) && Boolean(evaluate(right)));
      if (op === '||') return BigInt(Boolean(a) || Boolean(evaluate(right)));
      const b = evaluate(right);
      return arithmeticOperators.get(op) === 2 ? update(left, binary(op[0], a, b)) : signed(binary(op, a, b));
    }
    return evaluate(tree);
  }

  G.HELP_DB = {
    bash: [
      ['OFFLINE SECURITY TOOLS', [
        ['security-tools', 'list the bundled practice evidence and tool examples'],
        ['capinfos -t -c incident.pcapng', 'report capture type and packet count'],
        ['tshark -r incident.pcapng -Y dns', 'decode bundled packets and apply a display filter'],
        ['tcpdump -nn -r incident.pcapng tcp and dst port 443', 'print matching TCP packets from a bundled capture'],
        ['yara -s indicators.yar incident-artifact.txt', 'show rule matches and string offsets for a bundled artifact'],
        ['jq -r \'select(.event_type == "alert") | .alert.signature\' eve.json', 'filter bundled structured events or JSON from a pipe'],
        ['lastb -n 3', 'read the three most recent failed login records from bundled evidence'],
        ['password-audit --format csv', 'export synthetic password audit findings as CSV']
      ]],
      ['FILES & NAVIGATION', [
        ['ls [-la]', 'list directory contents (-l details, -a show hidden dotfiles); aliases: ll, la, dir'],
        ['cd [dir|~|-]', 'change current directory (~ home, - previous dir, .. parent)'],
        ['pwd', 'print current working directory path'],
        ['cat <file...>', 'print and concatenate one or more files (also: less, more, view)'],
        ['head [-N] [file]', 'show the first N lines of a file or piped input (default 10)'],
        ['tail [-N] [file]', 'show the last N lines of a file or piped input (default 10)'],
        ['find [dir] -name <pat>', 'recursively search directories for files matching a wildcard'],
        ['tree [dir]', 'display a visual directory tree of folders and files'],
        ['stat [-c format] <path>', 'show file metadata; use stat -c %a file for octal permissions'],
        ['file <path>', 'detect file type (ASCII text, script, JSON, gzip, hex, Base64)'],
        ['strings [file]', 'extract printable text strings (4+ chars) from data or files'],
        ['touch <file>', 'create an empty file (or update timestamp)'],
        ['mkdir [-p] <dir>', 'create a directory (-p creates missing parent folders)'],
        ['rmdir <dir>', 'remove an empty directory'],
        ['rm [-rf] <path>', 'delete files (-r recursive folders, -f ignore missing)'],
        ['cp <src> <dst>', 'copy a file to a new path'],
        ['mv <src> <dst>', 'move or rename a file'],
        ['ln [-s] <src> <dst>', 'create a link to a file; readlink/realpath resolve full path'],
        ['chmod [-R] <mode> <path...>', 'change permission bits using octal or symbolic modes (e.g. chmod u+r notes.txt)'],
        ['chown / chgrp / umask', 'change file owner/group or view default permission mask']
      ]],
      ['TEXT & PIPELINE WRANGLING', [
        ['grep [-inrcv] <pat> [file]', 'search lines matching regex (-i ignore case, -n line #, -r recursive, -c count, -v invert)'],
        ['wc [-lwc] [file]', 'count lines, words, and characters/bytes'],
        ['sort [-rn] [file]', 'sort lines alphabetically (-r reverse, -n numeric)'],
        ['uniq [-cud] [file]', 'collapse adjacent duplicates (-c counts, -u unique only, -d duplicates only)'],
        ['cut -d<sep> -f<N> [file]', 'extract column N split by delimiter character'],
        ['tr [-ds] <set1> [set2]', 'translate characters (e.g. tr a-z A-Z) or delete (-d, e.g. tr -d "\\n")'],
        ['sed s/old/new/g [file]', 'stream search-and-replace on lines'],
        ['awk [-Fsep] \'{print $1}\'', 'split lines into fields and print selected columns'],
        ['tee [-a] <file>', 'write piped output to a file while also printing to stdout (-a append)'],
        ['nl / tac / rev', 'nl: number lines · tac: reverse line order · rev: reverse each line'],
        ['paste / diff / comm / fold', 'paste: merge lines · diff: compare files · comm: common lines · fold: wrap lines'],
        ['echo / printf / xargs', 'echo/printf: print formatted text · xargs: pass stdin items as command args']
      ]],
      ['ENCODING, HASHING & ARCHIVES', [
        ['base64 [-d] [file|text]', 'Base64 encode or decode (-d)'],
        ['xxd [-r] [file|text]', 'hex dump or reverse hex back to text (-r); also: hexdump, od'],
        ['rot13 / hex / binary / url / caesar / morse', 'encode or decode (-d) classic CTF & web encodings'],
        ['md5sum / sha1sum / sha256sum / cksum', 'compute deterministic checksums for files or piped input'],
        ['tar / gzip / gunzip / zcat / zip / unzip', 'create, list, or extract archives (tar -czf / -tzf / -xzf)']
      ]],
      ['SYSTEM, ENV & NETWORKING', [
        ['ps / top / htop / pgrep / kill / pkill', 'inspect running processes or send termination signals'],
        ['df / du / free / lsblk / mount / lscpu / nproc', 'check disk usage, memory, block devices, and CPU info'],
        ['uname / hostname / hostnamectl / arch / uptime', 'show kernel, host name, architecture, and system uptime'],
        ['whoami / id / groups / who / w / last / users', 'inspect current user, groups, and login sessions'],
        ['env / printenv / export / unset / set', 'view or modify environment variables ($VAR expansion supported)'],
        ['alias / unalias / type / which / man / history', 'manage aliases, locate commands, read help, or view command history'],
        ['date / cal / seq / expr / bc / test / basename / dirname / mktemp', 'dates, number sequences, math, path helpers, temp files'],
        ['systemctl / service / journalctl / dmesg / crontab / sudo', 'inspect system services, logs, scheduled jobs, and sudo privileges'],
        ['curl / wget / ping / ssh / scp / rsync / ftp / nmap / nc', 'HTTP requests, reachability, remote shells, port scans, sockets'],
        ['ss / netstat / ip / ifconfig / route / arp / dig / nslookup / host / whois / traceroute / openssl / iptables / ufw', 'network interfaces, DNS, routes, TLS, and firewall inspection'],
        ['clear / cls / reset / help [cmd] / exit', 'clear screen, reset virtual disk, show help, or exit']
      ]],
      ['SHELL SYNTAX', [
        ['Pipes & Chaining', 'cmd1 | cmd2 (pipe output) · cmd1 && cmd2 (chain) · cmd1 ; cmd2'],
        ['Redirection', '> file (overwrite) · >> file (append) · < file (stdin from file)'],
        ['Braces & Globs', 'part{1,2,3}.txt · part{1..5}.txt · *.log · part?.txt · $(cmd) substitution']
      ]]
    ],
    powershell: [
      ['NAVIGATION & FILES', [
        ['Get-Location (pwd, gl)', 'print current working directory'],
        ['Set-Location (cd, sl)', 'change directory (case-insensitive; supports ~ and ..)'],
        ['Push-Location / Pop-Location (pushd, popd)', 'push or pop directories on a navigation stack'],
        ['Get-ChildItem (ls, dir, gci)', 'list directory items as objects (-Force hidden, -Recurse, -Filter)'],
        ['Get-Item / Get-ItemProperty (gi, gp)', 'inspect file or folder object properties'],
        ['Get-Content (cat, gc, type)', 'read file contents (supports multiple files & wildcards)'],
        ['Set-Content / Add-Content / Clear-Content (sc, ac, clc)', 'overwrite, append to, or empty a file'],
        ['New-Item / Copy-Item / Move-Item / Rename-Item / Remove-Item', 'create (ni/mkdir), copy (cp), move (mv), rename (ren), or delete (rm/del) items'],
        ['Test-Path / Resolve-Path / Split-Path / Join-Path', 'check existence, resolve full path, split or join path segments'],
        ['Select-String (sls)', 'regex search inside files or piped text'],
        ['Get-FileHash / Compress-Archive / Expand-Archive', 'compute SHA256 file hash or zip/unzip archives']
      ]],
      ['OBJECT PIPELINE', [
        ['Select-Object (select)', 'pick specific properties or -First N / -Last N / -Unique objects'],
        ['Where-Object (where, ?)', 'filter objects (e.g. Where-Object { $_.CPU -gt 2 })'],
        ['Sort-Object (sort)', 'sort objects by property (-Descending supported)'],
        ['Measure-Object (measure)', 'count objects or lines in the pipeline'],
        ['ForEach-Object (%, foreach)', 'extract or transform a property across every object'],
        ['Group-Object / Format-Table (ft) / Format-List (fl) / Get-Member (gm)', 'group, format as table/list, or inspect object properties'],
        ['ConvertTo-Json / ConvertFrom-Json / ConvertTo-Csv', 'serialize or parse JSON and CSV'],
        ['Out-File / Out-String / Out-Null / Tee-Object (tee)', 'redirect, discard, or tee pipeline output']
      ]],
      ['SYSTEM, SERVICES & NETWORKING', [
        ['Get-Process (ps, gps) / Start-Process / Stop-Process (kill)', 'list, launch, or stop processes'],
        ['Get-Service (gsv) / Start-Service / Stop-Service / Restart-Service', 'inspect or control Windows services'],
        ['Get-ComputerInfo / Get-CimInstance (gwmi) / Get-HotFix', 'OS, hardware, WMI/CIM, and installed patch info'],
        ['Get-EventLog / Get-WinEvent / Get-ScheduledTask', 'inspect Windows event logs and scheduled tasks'],
        ['Get-LocalUser / Get-LocalGroup / Get-Acl', 'list local accounts, groups, and file permissions'],
        ['Get-NetTCPConnection / Get-NetIPAddress / Get-NetIPConfiguration / Get-NetAdapter / Get-NetRoute / Get-NetFirewallRule', 'inspect TCP sockets, IPs, adapters, routes, and firewall rules'],
        ['Test-Connection (ping) / Test-NetConnection (tnc) / Resolve-DnsName', 'ICMP ping, TCP port test, and DNS lookup'],
        ['Invoke-WebRequest (iwr, curl, wget) / Invoke-RestMethod (irm)', 'make HTTP/REST requests'],
        ['Get-Command (gcm) / Get-Help / Get-Alias / Set-Alias / Get-Variable / Set-Variable / Get-History / Get-Date / Get-Random / Get-ExecutionPolicy / Get-Module', 'cmdlet discovery, variables, aliases, dates, and policy'],
        ['Write-Output / Write-Host / Write-Warning / Write-Error / Clear-Host (cls) / Reset', 'output messages, clear screen, or reset sandbox']
      ]]
    ],
    cmd: [
      ['FILES & DIRECTORIES', [
        ['dir [/a] [/s /b] [path]', 'list directory contents (/a hidden, /s recursive, /b bare paths)'],
        ['cd / chdir [path]', 'change directory (case-insensitive) or print current directory'],
        ['pushd / popd', 'save and restore working directory'],
        ['type <file...> / more [file]', 'display file contents (supports wildcards & piping)'],
        ['copy / xcopy / robocopy <src> <dst>', 'copy files or directory trees'],
        ['move / ren / rename <src> <dst>', 'move or rename files'],
        ['del / erase <file>', 'delete a file'],
        ['mkdir / md <dir> & rmdir / rd <dir>', 'create or remove a directory'],
        ['tree [path]', 'display folder hierarchy'],
        ['find [/i] [/c] "text" [file]', 'search for literal text in a file or piped input'],
        ['findstr <pattern> [file]', 'regex search in a file or piped input'],
        ['sort [/r] [file] / fc / comp', 'sort lines or compare two files'],
        ['attrib / icacls / cacls / takeown / cipher / mklink / assoc / ftype', 'file attributes, permissions, links, and file associations']
      ]],
      ['SYSTEM, ADMIN & NETWORKING', [
        ['echo / set / setx / path', 'print text or view/set environment variables'],
        ['ver / date / time / hostname / whoami / where / systeminfo / vol / label', 'OS version, host/user identity, executable lookup, hardware info'],
        ['tasklist / taskkill /PID <id>', 'list running processes or terminate a process by PID'],
        ['sc / schtasks / reg / net / wmic / gpresult / driverquery / powercfg', 'services, tasks, registry, accounts/shares, WMI, drivers'],
        ['certutil -hashfile <f> SHA256 | -encode | -decode', 'hash files or Base64 encode/decode files'],
        ['ipconfig / ping / tracert / pathping / netstat / nslookup / arp / route / nbtstat / getmac / netsh', 'Windows network diagnostics & TCP/IP configuration'],
        ['curl / ssh / ftp / telnet / winget', 'HTTP, SSH, FTP, and package manager utilities'],
        ['fsutil / chkdsk / sfc / dism / bcdedit / diskpart / shutdown', 'disk/system integrity diagnostics (safe sandbox)'],
        ['cls / clear / clip / title / color / prompt / timeout / pause / rem / start / help [cmd] / reset', 'shell utilities; pipes (|), > >> redirection & && chaining work']
      ]]
    ],
    python: [
      ['EXPRESSIONS & CONTROL', [
        ['x = 7 / del x', 'assign or delete variables in the REPL namespace'],
        ['2 + 3 * 4 / 17 // 5 / 2 ** 8', 'arithmetic, floor division (//), exponentiation (**)'],
        ['[1, 2] * 3 / "ha" * 3', 'list and string repetition'],
        ['f"hello {name}"', 'formatted f-string interpolation'],
        ['[n*n for n in range(6) if n % 2 == 0]', 'list comprehensions with optional if filter'],
        ['def f(x): return x * 2', 'define functions; lambda x: x + 1 anonymous functions'],
        ['for i in range(4): print(i) / if x > 3: ...', 'loops and conditional statements']
      ]],
      ['BUILTINS & STDLIB MODULES', [
        ['print(...) / len() / sum() / min() / max() / abs() / round() / pow() / divmod()', 'output and numeric/sequence builtins'],
        ['sorted() / reversed() / range() / enumerate() / zip() / map() / filter() / all() / any()', 'iteration and collection helpers'],
        ['int() / float() / str() / bool() / list() / tuple() / set() / dict() / bytes()', 'type constructors and conversions'],
        ['chr() / ord() / hex() / bin() / oct() / type() / isinstance() / dir() / repr() / hash()', 'character codes, bases, and introspection'],
        ['import <mod> / from <mod> import <name>', '22 stdlib modules: math, json, os, sys, re, random, time, datetime, base64, hashlib, string, statistics, secrets, uuid, collections, itertools, functools, urllib, pathlib, socket, binascii, zlib, codecs'],
        ['clear / reset / help [topic]', 'clear all variables or display help']
      ]]
    ],
    node: [
      ['REPL DOT-COMMANDS & GLOBALS', [
        ['.help / help [topic]', 'show Node.js REPL commands and available modules'],
        ['.clear / clear / reset', 'reset all declared variables in the REPL context'],
        ['.break / .exit / .save / .load / .editor', 'standard Node REPL session dot-commands'],
        ['const / let / var / function / class / for / if', 'declare variables, functions, classes, and control flow'],
        ['console.log / table / dir / warn / error / assert / count / time / timeEnd', 'formatted console output and timing'],
        ['Buffer.from(str, enc).toString(outEnc)', 'encode/decode utf8, base64, and hex buffers'],
        ['JSON / Math / Date / URL / URLSearchParams / process / __dirname', 'built-in JS and Node globals']
      ]],
      ['CORE MODULES (require)', [
        ['require("os" | "path")', 'OS platform/CPUs/hostname and cross-platform path utilities'],
        ['require("crypto")', 'createHash (md5/sha1/sha256), randomBytes, randomUUID'],
        ['require("fs")', 'virtual filesystem: readdirSync, readFileSync, writeFileSync, existsSync, unlinkSync, statSync'],
        ['require("url" | "util" | "querystring" | "events" | "assert" | "http" | "net" | "dns" | "zlib" | "child_process")', 'additional stubbed Node.js standard library modules']
      ]]
    ],
    sql: [
      ['QUERYING DATA', [
        ['SELECT [DISTINCT] cols FROM table', 'query rows and project specific columns (or * for all; AS aliases supported)'],
        ['WHERE col = val [AND|OR|NOT ...]', 'filter rows with =, !=, <, >, <=, >=, LIKE, ILIKE, IN (...), BETWEEN a AND b, IS [NOT] NULL'],
        ['JOIN / INNER JOIN / LEFT JOIN / CROSS JOIN', 'combine rows across multiple tables using ON a.col = b.col'],
        ['COUNT(*) / SUM() / AVG() / MIN() / MAX() + GROUP BY', 'compute aggregate summaries per group or across whole table'],
        ['ORDER BY col [ASC|DESC] / LIMIT n / OFFSET n', 'sort and paginate query results'],
        ['SELECT 2 + 2 AS ans;', 'evaluate tableless expressions']
      ]],
      ['MODIFYING DATA & SCHEMA', [
        ['INSERT INTO table [(cols)] VALUES (...);', 'insert a new row into a table'],
        ['UPDATE table SET col = val [WHERE ...];', 'modify existing rows'],
        ['DELETE FROM table [WHERE ...];', 'delete matching rows'],
        ['CREATE TABLE / ALTER TABLE / DROP TABLE / TRUNCATE TABLE', 'create, modify, clear, or drop tables'],
        ['CREATE/DROP INDEX · CREATE/DROP VIEW', 'manage indexes and views'],
        ['BEGIN; / COMMIT; / ROLLBACK; / EXPLAIN <query>', 'transactions with snapshot rollback and query plans'],
        ['SHOW TABLES / \\dt / DESCRIBE <table> / DESC / \\d / PRAGMA table_info / SHOW DATABASES / RESET;', 'inspect schema or reset seed database']
      ]]
    ],
    git: [
      ['CORE WORKFLOW', [
        ['git init / git clone <url>', 'initialize a new repository or clone a remote one'],
        ['git status [-s]', 'show branch, staged changes, and untracked files'],
        ['git add <file|.|-A> / git rm [--cached] / git mv', 'stage, remove, or move files in the index'],
        ['git commit -m "msg"', 'record staged changes as a new commit'],
        ['git diff [--staged] / git show [hash]', 'inspect pending changes or a specific commit diff'],
        ['git log [--oneline] [--author=] [--grep=] / git shortlog / git reflog / git blame', 'browse commit history, reflog, and line attribution']
      ]],
      ['BRANCHING, UNDOING & REMOTES', [
        ['git branch [name] / git checkout [-b] <name> / git switch [-c] <name>', 'create, list, and switch branches'],
        ['git merge <branch> / git rebase / git cherry-pick <hash>', 'combine histories or apply individual commits'],
        ['git stash [pop|list] / git tag [name] / git describe', 'shelve work-in-progress or tag releases'],
        ['git restore [--staged] / git reset [--hard] / git revert / git clean', 'unstage, discard, or revert changes'],
        ['git remote [add origin <url>] / git fetch / git pull / git push', 'configure remotes and sync branches'],
        ['git grep / git rev-parse / git ls-files / git ls-tree / git cat-file / git config / git gc / git fsck / git version / git reset-sandbox', 'plumbing, search, maintenance, and sandbox reset']
      ]]
    ],
    docker: [
      ['CONTAINERS', [
        ['docker ps [-a] / docker container ls', 'list running (-a includes stopped) containers'],
        ['docker run [-d] [--name n] <img...> / docker create', 'create and start a new container'],
        ['docker start / stop / restart / pause / unpause / kill / rm <name>', 'control container lifecycle or remove containers'],
        ['docker logs <name> / docker exec [-it] <name> <cmd> / docker attach', 'view container logs or run commands inside a container'],
        ['docker inspect / stats / top / port / diff / cp / rename / commit / export', 'inspect JSON config, live CPU/RAM, processes, and filesystem diffs']
      ]],
      ['IMAGES, COMPOSE & SYSTEM', [
        ['docker images / docker image ls / docker pull / docker push / docker build / docker buildx', 'list, download, publish, or build container images'],
        ['docker tag / docker rmi / docker history / docker search / docker save / docker load', 'tag, delete, inspect layers, or search images'],
        ['docker compose up|down|ps|logs|build|config', 'manage multi-container Compose stacks'],
        ['docker network ls|create|rm|inspect & docker volume ls|create|rm|inspect', 'manage virtual networks and persistent volumes'],
        ['docker info / docker version / docker system df|prune / docker events / docker login / logout / context / swarm / reset', 'engine info, disk usage cleanup, and sandbox reset']
      ]]
    ],
    network: [
      ['RECON & DNS', [
        ['nmap [-sV] <ip> / masscan <ip>', 'scan open TCP ports and detect service versions'],
        ['ping <host> / hping3 <host>', 'test ICMP reachability and latency'],
        ['traceroute / tracepath / mtr <host>', 'trace network hops to a destination'],
        ['dig <name> [TXT|A] / nslookup <name> / host <name> / resolvectl / whois <domain>', 'DNS records, resolver queries, and domain registration']
      ]],
      ['WEB, SOCKETS, REMOTE & FIREWALL', [
        ['curl <url> / wget <url> / openssl s_client -connect host:443', 'HTTP requests and TLS certificate chain inspection'],
        ['nikto / gobuster / ffuf / dirb / whatweb', 'web server fingerprinting and directory discovery'],
        ['ss [-tulpn] / netstat [-antp] / ip [a|r] / ifconfig / route / arp / ethtool / nmcli', 'sockets, interfaces, routing tables, and ARP neighbor cache'],
        ['tcpdump / tshark', 'inspect captured network packets'],
        ['ssh / scp / sftp / ftp / rsync / nc / ncat / socat / telnet', 'remote access, file transfer, and raw TCP testing'],
        ['iptables / nft / ufw / firewall-cmd / wg / openvpn', 'firewall rules and VPN interfaces'],
        ['enum4linux / smbclient / rpcclient / snmpwalk / ldapsearch / hydra', 'enterprise service enumeration tools (safe sandbox); pipes with | grep work']
      ]]
    ],
    crypto: [
      ['BASES & WEB ENCODINGS', [
        ['base64 [-d] <text> / base64url [-d]', 'standard or URL-safe Base64 encode/decode'],
        ['base32 [-d] <text> / base58 <text>', 'Base32 and Base58 encoding'],
        ['hex [-d] <text> / xxd [-r]', 'hexadecimal encode/decode'],
        ['binary [-d] / decimal [-d] / octal [-d] / ascii / ord / chr', 'convert text to/from binary, decimal, octal, or ASCII codes'],
        ['url [-d] / html [-d] / unicode [-d] / jwt <token>', 'URL percent, HTML entity, Unicode escape, and JWT header/payload decoding']
      ]],
      ['CIPHERS, HASHES & ANALYSIS', [
        ['rot13 / rot47 / caesar <n> <text> / atbash', 'substitution and shift ciphers'],
        ['vigenere [-d] <key> <text> / xor <key> <text>', 'polyalphabetic Vigenère and XOR transforms'],
        ['morse [-d] / nato / reverse (rev)', 'Morse code, NATO phonetic alphabet, and string reversal'],
        ['md5 / sha1 / sha256 / sha512 / crc32 / hmac / uuid / random [bytes]', 'hashes, HMACs, UUIDs, and random hex bytes'],
        ['entropy / freq / len / strings / upper / lower / echo', 'Shannon entropy, character frequency, length, and case helpers · pipes (|) chain transforms!']
      ]]
    ]
  };

  G.formatHelp = function (shellId, args) {
    const sections = G.HELP_DB[shellId] || G.HELP_DB.bash;
    const topic = Array.isArray(args) ? (args[0] || '').trim().toLowerCase() : String(args || '').trim().toLowerCase();
    if (topic) {
      const hits = [];
      for (const [sec, items] of sections) {
        for (const [cmd, desc] of items) {
          if (cmd.toLowerCase().includes(topic) || desc.toLowerCase().includes(topic)) {
            hits.push('  ' + cmd.padEnd(36) + '  ' + desc);
          }
        }
      }
      if (hits.length) return 'Help matching "' + topic + '" (' + shellId + '):\n\n' + hits.join('\n');
      return 'No help entry matched "' + topic + '". Type `help` to browse the command reference.';
    }
    const out = [shellId.toUpperCase() + ' SANDBOX COMMAND REFERENCE   (tip: `help <name>` filters by command)'];
    if (typeof G.helpContext === 'function') {
      let ctx = null;
      try { ctx = G.helpContext(shellId); } catch (e) { ctx = null; }
      if (ctx && (ctx.objective || (ctx.commands && ctx.commands.length))) {
        out.push('', '── ' + (ctx.heading || 'CURRENT MISSION') + ' ──');
        if (ctx.objective) for (const line of String(ctx.objective).split('\n')) { if (line.trim()) out.push('  ' + line.trim()); }
        if (ctx.commands && ctx.commands.length) {
          out.push('  Commands useful here:');
          for (const [cmd, desc] of ctx.commands) out.push('    ' + String(cmd).padEnd(34) + '  ' + desc);
        }
      }
    }
    for (const [sec, items] of sections) {
      out.push('', '── ' + sec + ' ──');
      for (const [cmd, desc] of items) out.push('  ' + cmd.padEnd(36) + '  ' + desc);
    }
    return out.join('\n');
  };

  G.argv = s => G.tokenize(s);
  G.argvMeta = function (s, isWin) {
    const out = []; let cur = '', q = null, quoted = false, has = false;
    for (let i = 0; i < s.length; i++) {
      const c = s[i];
      if (q) {
        if (c === q) q = null;
        else if (!isWin && q === '"' && c === '\\' && /["\\$`\n]/.test(s[i + 1] || '')) {
          const next = s[++i];
          if (next !== '\n') cur += next;
        } else cur += c;
        has = true;
      }
      else if (c === '"' || c === "'") { q = c; quoted = true; has = true; }
      else if (!isWin && c === '\\' && i + 1 < s.length) { cur += s[++i]; quoted = true; has = true; }
      else if (/\s/.test(c)) { if (has) { out.push({ val: cur, quoted }); cur = ''; quoted = false; has = false; } }
      else { cur += c; has = true; }
    }
    if (has) out.push({ val: cur, quoted });
    return out;
  };
  G.expandBraces = function expandBraces(word, limit) {
    const cap = limit || 256;
    const findBrace = s => {
      let depth = 0, start = -1, hasSep = false;
      for (let i = 0; i < s.length; i++) {
        const c = s[i];
        if (c === '{') { if (depth === 0) { start = i; hasSep = false; } depth++; }
        else if (c === ',' && depth === 1) hasSep = true;
        else if (c === '}' && depth > 0) {
          depth--;
          if (depth === 0 && start >= 0) {
            const inner = s.slice(start + 1, i);
            if (hasSep || /^(-?\d+\.\.-?\d+(?:\.\.-?\d+)?|[a-zA-Z]\.\.[a-zA-Z](?:\.\.-?\d+)?)$/.test(inner)) {
              return { start, end: i, inner };
            }
            start = -1;
          }
        }
      }
      return null;
    };
    const b = findBrace(word);
    if (!b) return [word];
    const pre = word.slice(0, b.start), suf = word.slice(b.end + 1);
    let items = [];
    const numRange = b.inner.match(/^(-?\d+)\.\.(-?\d+)(?:\.\.(-?\d+))?$/);
    const chrRange = b.inner.match(/^([a-zA-Z])\.\.([a-zA-Z])(?:\.\.(-?\d+))?$/);
    if (numRange) {
      const a = parseInt(numRange[1], 10), z = parseInt(numRange[2], 10);
      const step = Math.max(1, Math.abs(parseInt(numRange[3] || '1', 10) || 1)) * (a <= z ? 1 : -1);
      const pad = (numRange[1].startsWith('0') && numRange[1].length > 1) || (numRange[2].startsWith('0') && numRange[2].length > 1) ? Math.max(numRange[1].length, numRange[2].length) : 0;
      for (let n = a; step > 0 ? n <= z : n >= z; n += step) {
        items.push(pad ? String(n).padStart(pad, '0') : String(n));
        if (items.length >= cap) break;
      }
    } else if (chrRange) {
      const a = chrRange[1].charCodeAt(0), z = chrRange[2].charCodeAt(0);
      const step = Math.max(1, Math.abs(parseInt(chrRange[3] || '1', 10) || 1)) * (a <= z ? 1 : -1);
      for (let c = a; step > 0 ? c <= z : c >= z; c += step) {
        items.push(String.fromCharCode(c));
        if (items.length >= cap) break;
      }
    } else {
      let cur = '', depth = 0;
      for (let i = 0; i < b.inner.length; i++) {
        const c = b.inner[i];
        if (c === '{') { depth++; cur += c; }
        else if (c === '}') { depth--; cur += c; }
        else if (c === ',' && depth === 0) { items.push(cur); cur = ''; }
        else cur += c;
      }
      items.push(cur);
    }
    const out = [];
    for (const it of items) {
      for (const expanded of expandBraces(pre + it + suf, cap)) {
        out.push(expanded);
        if (out.length >= cap) return out;
      }
    }
    return out;
  };
  G.expandGlob = function (pat, listDirFn) {
    if (!/[*?[]/.test(pat)) return [pat];
    const norm = pat.replace(/\\/g, '/');
    const slash = norm.lastIndexOf('/');
    const dir = slash >= 0 ? norm.slice(0, slash) || '/' : '';
    const base = slash >= 0 ? norm.slice(slash + 1) : norm;
    if (!/[*?[]/.test(base)) return [pat];
    const entries = listDirFn(dir || '.');
    if (!entries || !entries.length) return [pat];
    const wantDot = base.startsWith('.');
    let rx = '^';
    for (let i = 0; i < base.length; i++) {
      const c = base[i];
      if (c === '*') rx += '.*';
      else if (c === '?') rx += '.';
      else if (c === '[') {
        const end = base.indexOf(']', i + 1);
        if (end > i) { rx += base.slice(i, end + 1).replace(/^\[\!/, '[^'); i = end; }
        else rx += '\\[';
      } else rx += c.replace(/[.+^${}()|\\]/g, '\\$&');
    }
    rx += '$';
    let re; try { re = new RegExp(rx); } catch (e) { return [pat]; }
    const hits = entries.filter(k => (wantDot || k[0] !== '.') && re.test(k)).sort();
    if (!hits.length) return [pat];
    const sep = pat.includes('\\') ? '\\' : '/';
    return hits.map(h => dir ? (dir === '/' ? '/' + h : dir + sep + h) : h);
  };
  G.expandShellWords = function (seg, listDirFn, isWin) {
    const tokens = G.argvMeta(seg, isWin);
    const out = [];
    for (const t of tokens) {
      if (t.quoted) { out.push(t.val); continue; }
      for (const b of G.expandBraces(t.val)) {
        for (const g of G.expandGlob(b, listDirFn)) out.push(g);
      }
    }
    return out;
  };
  G.expandSub = function (str, runFn, depth) {
    if ((depth || 0) > 3) return str;
    let s = String(str);
    // $(cmd) substitution (not inside single quotes)
    let guard = 0;
    while (/\$\(/.test(s) && guard++ < 8) {
      let out = '', inS = false, replaced = false;
      for (let i = 0; i < s.length; i++) {
        const c = s[i];
        if (c === "'") { inS = !inS; out += c; continue; }
        if (!inS && c === '$' && s[i + 1] === '(') {
          let d = 1, j = i + 2;
          while (j < s.length && d > 0) { if (s[j] === '(') d++; else if (s[j] === ')') d--; j++; }
          if (d === 0) {
            const inner = s.slice(i + 2, j - 1);
            const res = String(runFn(inner, (depth || 0) + 1) || '').replace(/\r?\n/g, ' ').trim();
            out += res; i = j - 1; replaced = true; continue;
          }
        }
        out += c;
      }
      s = out;
      if (!replaced) break;
    }
    // `cmd` backtick substitution
    if (s.includes('`')) {
      s = s.replace(/`([^`]+)`/g, (_, inner) => String(runFn(inner, (depth || 0) + 1) || '').replace(/\r?\n/g, ' ').trim());
    }
    return s;
  };

  const Unix = TerminalUnix;
  const F = (text, mode) => ({ text: String(text), mode: mode || '644' });
  const isDir = n => n && typeof n === 'object' && !('text' in n);
  const textOf = n => typeof n === 'string' ? n : String(n.text);
  const modeOf = n => Unix.octal(Unix.mode(n, isDir(n)));
  const permOf = n => Unix.permissions(n, isDir(n));
  G.helpers = { F, isDir, textOf, modeOf, permOf };

  // A discovery file mounted by the Playground over each simulated shell.
  const discoveryKey = 'tpg_mcode_discovery';
  const savedDiscovery = G.readSave(discoveryKey);
  const passphrase = typeof savedDiscovery?.passphrase === 'string' && /^lantern-[0-9a-f]{10}$/.test(savedDiscovery.passphrase) ?
    savedDiscovery.passphrase : 'lantern-' + Math.random().toString(16).slice(2, 12).padEnd(10, '0');
  let mcodeUnlocked = savedDiscovery?.passphrase === passphrase && savedDiscovery.unlocked === true;
  if (!savedDiscovery || savedDiscovery.passphrase !== passphrase) G.writeSave(discoveryKey, { passphrase, unlocked: false });
  G.mcodeIsUnlocked = () => mcodeUnlocked;
  // Solving a puzzle, Labyrinth checkpoint or practice job locks mcode again: the next note has to be found first.
  G.mcodeLock = () => {
    if (!mcodeUnlocked) return false;
    mcodeUnlocked = false;
    G.writeSave(discoveryKey, { passphrase, unlocked: false });
    return true;
  };
  const discoveryModes = ['easy', 'medium', 'hard', 'insane'];
  const discoveryFolders = ['.archive', '.index', '.spare'];
  const noteRankFloors = [3, 5, 7];
  const deepNoteFloors = [25, 70, 115, 150, 200];
  const deepNoteFolders = ['ledger', 'annex', 'shelf', 'catalog', 'vault'];
  const decoders = ['base64', 'rot13', 'hex', 'reverse'];
  const decoderClues = {
    base64: 'Unwrap the alphabet of 64 symbols.',
    rot13: 'Turn the letters by half the alphabet.',
    hex: 'Read each pair of base-16 digits as one character.',
    reverse: 'Read the characters from last to first.'
  };
  const reverse = text => [...text].reverse().join('');
  const rot13 = text => text.replace(/[a-z]/gi, char => {
    const start = char <= 'Z' ? 65 : 97;
    return String.fromCharCode(start + (char.charCodeAt(0) - start + 13) % 26);
  });
  const b64 = text => typeof btoa === 'function' ? btoa(text) : Buffer.from(text, 'latin1').toString('base64');
  const unb64 = text => typeof atob === 'function' ? atob(text) : Buffer.from(text, 'base64').toString('latin1');
  const discoveryCache = new Map();
  G.mcodeNote = (scope, challenge, difficulty, labyrinthDepth = 0, workspace = {}) => {
    const rank = Math.max(discoveryModes.indexOf(difficulty), noteRankFloors.filter(floor => labyrinthDepth >= floor).length);
    const extra = deepNoteFloors.filter(floor => labyrinthDepth >= floor).length;
    // Deep floors keep gaining steps even after room difficulty caps at Insane.
    const id = challenge + ':' + rank + (extra ? ':depth-' + labyrinthDepth : '');
    const hash = Array.from(passphrase + ':' + scope + ':' + id).reduce((sum, char) => Math.imul(sum ^ char.charCodeAt(0), 16777619), 2166136261);
    const marker = index => ((hash >>> (index * 4)) & 15).toString(16);
    // The note always sits under at least one hidden folder, so plain ls, dir and tree never show it; -a, /a or -Force do.
    const folders = discoveryFolders.slice(0, Math.max(1, rank)).concat(deepNoteFolders.slice(0, extra).map((name, index) => '.' + name + '-' + marker(index)));
    const decoy = level => level < extra ? '.closed-' + marker(level) : '';
    const parts = [...folders, 'mcode.txt'];
    const filename = parts.join('/');
    const storeKey = 'tpg_mcode_note_' + scope;
    let state = discoveryCache.get(scope);
    if (!state || state.id !== id) {
      const saved = G.readSave(storeKey);
      state = saved?.id === id ? saved : { id, readable: false, read: false };
      discoveryCache.set(scope, state);
    }
    const save = () => G.writeSave(storeKey, state);
    const key = 'lantern-' + (hash >>> 0).toString(16).padStart(10, '0');
    const operators = Array.from({ length: rank + 1 + extra }, (_, index) => decoders[index % decoders.length]);
    const layers = [key];
    for (const operator of operators) {
      const text = layers.at(-1);
      layers.push(operator === 'base64' ? b64(text) : operator === 'rot13' ? rot13(text) :
        operator === 'hex' ? Array.from(text, char => char.charCodeAt(0).toString(16).padStart(2, '0')).join('') : reverse(text));
    }
    const encoded = layers.at(-1);
    const order = operators.slice().reverse();
    const instructions = extra >= 2 ?
      'Decode from the outside in. Match each clue to a decoder.\n' +
        order.map((operator, index) => (index + 1) + '. ' + decoderClues[operator]).join('\n') +
        '\nChoices: ' + decoders.join(', ') + '. Type decode, the decoder name, and then one line of text.\n' +
        'For practice, decode base64 aGk= prints hi.\n' :
      'Decode from the outside in: ' + order.join(' → ') + '.\n' +
        'Start with this command:\n' + 'decode ' + order[0] + ' ' + encoded + '\n';
    const note = 'Maintenance note\n\nPAYLOAD\n' + encoded + '\n\n' + instructions +
      (order.length > 1 ? 'Use the last line of output as the input for the next decode command.\n' : '') +
      'When you have the passphrase, type mcode followed by it.';
    const windows = /^[a-z]:/i.test(workspace.root || '');
    const normalize = (value, from = '/') => {
      const input = String(value || '.').replace(/\\/g, '/');
      const absolute = /^[a-z]:/i.test(input) ? input : input.startsWith('/') ? from.match(/^[a-z]:/i)?.[0] + input : from.replace(/\/$/, '') + '/' + input;
      const full = input.startsWith('/') && !/^[a-z]:/i.test(from) ? input : absolute;
      const drive = full.match(/^[a-z]:/i)?.[0] || '';
      const names = [];
      for (const name of full.slice(drive.length).split('/')) {
        if (name === '..') names.pop();
        else if (name && name !== '.') names.push(name);
      }
      return drive + '/' + names.join('/');
    };
    const root = normalize(workspace.root || '/');
    const equal = (a, b) => windows ? a.toLowerCase() === b.toLowerCase() : a === b;
    const resolve = word => {
      const input = String(word || '.');
      return /^~(?:[\\/]|$)/.test(input) ? normalize(input.slice(2), root) : normalize(input, state.cwd || workspace.cwd || root);
    };
    const relative = target => {
      if (equal(target, root)) return '';
      const prefix = root.endsWith('/') ? root : root + '/';
      return equal(target.slice(0, prefix.length), prefix) ? target.slice(prefix.length) : null;
    };
    const filePath = normalize(filename, root);
    const directoryDepth = name => name === '' ? 0 : folders.findIndex((_, index) => equal(folders.slice(0, index + 1).join('/'), name)) + 1 || -1;
    const closedBranch = name => name != null && folders.some((_, level) =>
      decoy(level) && equal(name, folders.slice(0, level).concat(decoy(level)).join('/')));
    const words = text => G.argvMeta(text, true).map(word => word.val);
    const copyPayload = 'Copy only the line under PAYLOAD in mcode.txt. Put that text after the decoder command.';
    const permission = (target, command = 'cat') => command + ': ' + target + ': Permission denied';
    const noteInput = target => ({ out: readable() ?
      'The note has instructions as well as encoded text. Run cat ' + filePath + ' by itself. ' + copyPayload : permission(target), status: 1 });

    const bits = () => state.mode ?? (state.readable ? 0o400 : 0);
    const readable = () => (bits() & 0o400) !== 0;
    const fileNode = () => ({ text: note, mode: TerminalUnix.octal(bits()) });
    const missing = (command, target) => ({ out: command + ': ' + target + ': No such file or directory', status: 1 });
    const read = () => {
      state.read = true;
      save();
      return note;
    };

    function readFilter(tokens, input) {
      const [command, ...args] = tokens;
      const rows = input.split('\n');
      if (command === 'head' || command === 'tail') {
        const flag = args[0] === '-n' ? args[1] : args[0]?.replace(/^-/,'');
        if ((args[0] === '-n' ? args.length !== 2 : args.length > 1) || (flag != null && !/^\d+$/.test(flag))) return null;
        const count = flag == null ? 10 : Number(flag);
        return { out: (command === 'head' ? rows.slice(0, count) : count ? rows.slice(-count) : []).join('\n'), status: 0 };
      }
      if (command === 'wc' && args.every(arg => /^-[lwc]+$/.test(arg))) {
        const flags = args.join('') || 'lwc';
        const counts = [rows.length, input.match(/\S+/g)?.length || 0, new TextEncoder().encode(input + '\n').length];
        return { out: counts.filter((_, index) => flags.includes('lwc'[index])).join(' '), status: 0 };
      }
      if (command === 'grep') {
        const flags = args.filter(arg => arg.startsWith('-')).join('');
        const pattern = args.filter(arg => !arg.startsWith('-'));
        if (pattern.length !== 1 || !/^[\-incv]*$/.test(flags)) return null;
        try {
          const re = new RegExp(pattern[0], flags.includes('i') ? 'i' : '');
          const matches = rows.flatMap((row, index) => re.test(row) !== flags.includes('v') ?
            [flags.includes('n') ? (index + 1) + ':' + row : row] : []);
          return { out: flags.includes('c') ? String(matches.length) : matches.join('\n'), status: matches.length ? 0 : 1 };
        } catch (e) { return { out: 'grep: invalid pattern', status: 2 }; }
      }
      return null;
    }
    function decode(algorithm, input) {
      const layer = layers.lastIndexOf(input);
      if (layer === 0) return { out: 'That is the decoded passphrase. Type mcode followed by it.' };
      if (layer > 0 && algorithm !== operators[layer - 1]) {
        const expected = operators[layer - 1];
        return { out: 'That decoder does not match this layer. ' +
          (extra >= 2 ? decoderClues[expected] : 'Use decode ' + expected + ' on this text first.') };
      }
      if (layer > 0) return { out: layers[layer - 1] };
      try {
        if (algorithm === 'hex') {
          if (!/^(?:[0-9a-f]{2})+$/i.test(input)) return { out: 'decode: use pairs of hex digits. ' + copyPayload };
          return { out: input.match(/../g).map(pair => String.fromCharCode(parseInt(pair, 16))).join('') };
        }
        if (algorithm === 'base64' && (!/^[A-Za-z0-9+/]+={0,2}$/.test(input) || input.length % 4 === 1 ||
          (input.includes('=') && input.length % 4 !== 0))) return { out: 'decode: invalid Base64. ' + copyPayload };
        return { out: algorithm === 'base64' ? unb64(input) : algorithm === 'rot13' ? rot13(input) : reverse(input) };
      } catch (e) { return { out: 'decode: the input does not match that format. ' + copyPayload }; }
    }

    function decoder(tokens) {
      const [tool, ...args] = tokens;
      if (tool === 'decode' && args.length === 1 && decoders.includes(args[0])) return args[0];
      if (tool === 'base64' && args.length === 1 && ['-d', '--decode'].includes(args[0])) return 'base64';
      if (tool === 'hex' && args.length === 1 && args[0] === '-d') return 'hex';
      if (tool === 'xxd' && /^(?:-r|-rp|-pr|-r -p|-p -r)$/.test(args.join(' '))) return 'hex';
      if (!args.length && tool === 'rot13') return 'rot13';
      if (!args.length && (tool === 'rev' || tool === 'reverse')) return 'reverse';
      return null;
    }

    const aliases = { dir: 'ls', 'get-childitem': 'ls', 'get-content': 'cat', type: 'cat', more: 'cat', less: 'cat',
      'set-location': 'cd', chdir: 'cd', 'get-location': 'pwd' };
    const action = name => {
      const key = windows ? name?.toLowerCase() : name;
      return Object.hasOwn(aliases, key) ? aliases[key] : key;
    };

    // Commands that work on the encoded text itself, in any shell: decode, an echo/printf of a payload layer piped into
    // decoders, and a decoder given a payload layer as its argument. Nothing here depends on where the note file lives.
    function payload(line) {
      if (/\|\s*$/.test(line)) return null;
      const segments = G.splitTop(line, ['|']);
      const [name, ...args] = words(segments[0] || '');
      const command = action(name);
      if (segments.length > 1) {
        const pipeline = segments.slice(1).map(segment => decoder(words(segment)));
        const input = command === 'echo' && (args.length === 1 || args.length === 2 && args[0] === '-n') ? args.at(-1) :
          command === 'printf' && args.length === 2 && ['%s', '%s\\n'].includes(args[0]) ? args[1] : null;
        if (!layers.includes(input)) return null;
        if (!pipeline.every(Boolean)) {
          return segments[1] === 'base64' ? { out: 'Use base64 -d to decode. Without -d, base64 adds an encoding layer.' } : null;
        }
        let value = input;
        for (const algorithm of pipeline) {
          const result = decode(algorithm, value);
          if (!layers.includes(result.out)) return result;
          value = result.out;
        }
        return { out: value };
      }
      if (command === 'decode') {
        const algorithm = args[0]?.toLowerCase();
        return args.length === 2 && decoders.includes(algorithm) ? decode(algorithm, args[1]) :
          { out: 'Type decode, a decoder name (' + decoders.join(', ') + '), and the encoded text. ' + copyPayload, status: 2 };
      }
      if (args.length && layers.includes(args.at(-1))) {
        const algorithm = decoder([command, ...args.slice(0, -1)]);
        if (algorithm) return decode(algorithm, args.at(-1));
        if (command === 'base64' && args.length === 1) return { out: 'Use base64 -d ' + args[0] + ' to decode this text.' };
      }
      return null;
    }

    return {
      directory: () => state.cwd,
      leaveDirectory() { delete state.cwd; save(); },
      verify(candidate, remember = true) {
        if (candidate !== key) return false;
        if (remember) {
          mcodeUnlocked = true;
          G.writeSave(discoveryKey, { passphrase, unlocked: true });
        }
        return true;
      },
      payload,
      // Remove only the generated note when opening a previously saved shallow Labyrinth room.
      removeFrom(tree) {
        let removed = false;
        const remove = dir => {
          const item = dir?.['mcode.txt'];
          if (item != null && !isDir(item) && textOf(item) === note) {
            delete dir['mcode.txt'];
            removed = true;
          }
        };
        remove(tree);
        let dir = tree;
        for (const part of folders) {
          dir = dir?.[part];
          if (!isDir(dir)) return removed;
        }
        remove(dir);
        return removed;
      },
      // Puts the note into a shell's own file tree (bash, PowerShell, cmd, puzzle and Labyrinth rooms), under home, so
      // every command of that shell sees the same files. An existing note keeps its permission bits.
      mount(tree, home = [], win = false) {
        const child = (dir, name) => win ? Object.keys(dir).find(key => key.toLowerCase() === name.toLowerCase()) ?? name : name;
        let dir = tree;
        for (const part of home) {
          const key = child(dir, part);
          if (!isDir(dir[key])) return false;
          dir = dir[key];
        }
        // A note left in plain sight by an older version (home/mcode.txt) is removed; the real one lives in a hidden folder.
        const stray = child(dir, 'mcode.txt');
        if (folders.length && Object.hasOwn(dir, stray) && !isDir(dir[stray]) && textOf(dir[stray]).startsWith('Maintenance note')) delete dir[stray];
        for (let level = 0; level < folders.length; level++) {
          const closed = decoy(level);
          if (closed && !isDir(dir[child(dir, closed)])) dir[closed] = {};
          const key = child(dir, folders[level]);
          if (!isDir(dir[key])) dir[key] = {};
          dir = dir[key];
        }
        // Windows shells keep files as plain strings and have no chmod, so there the note is readable at once.
        const key = child(dir, 'mcode.txt'), existing = dir[key];
        if (existing && typeof existing === 'object' && 'text' in existing) { if (existing.text !== note) existing.text = note; }
        else if (typeof existing !== 'string' || existing !== note) dir[key] = win ? note : { text: note, mode: '000' };
        return home.concat(folders, 'mcode.txt');
      },
      command(line) {
        if (/\|\s*$/.test(line)) return null;
        const early = payload(line);
        if (early) return early;
        const segments = G.splitTop(line, ['|']);
        const [name, ...args] = words(segments[0] || '');
        const command = action(name);
        if (segments.length > 1) {
          const pipeline = segments.slice(1).map(segment => decoder(words(segment)));
          if (command === 'cat' && args.length === 1 && equal(resolve(args[0]), filePath)) {
            if (!readable()) return { out: permission(args[0], name), status: 1 };
            let value = note;
            let status = 0;
            for (let i = 1; i < segments.length; i++) {
              const result = pipeline[i - 1] ?
                (layers.includes(value) ? decode(pipeline[i - 1], value) : noteInput(args[0])) :
                readFilter(words(segments[i]), value);
              if (!result) return { out: 'This note pipeline supports head, tail, grep, wc, and the puzzle decoders.', status: 2 };
              value = result.out;
              status = result.status ?? 0;
              if (status !== 0) return { out: value, status };
            }
            read();
            return { out: value, status };
          }
          return null;
        }
        const target = resolve(args.at(-1));
        const isFile = equal(target, filePath);
        const rel = relative(target);
        if (command === 'pwd' && !args.length) return { out: state.cwd || root, status: 0 };
        if (command === 'cd') {
          if (windows && !args.length && state.cwd) return { out: state.cwd, status: 0 };
          const input = args.length ? args.at(-1) : '~';
          const destination = resolve(input);
          const folder = relative(destination);
          if (equal(destination, filePath)) return { out: 'cd: ' + input + ': Not a directory', status: 1 };
          if (folder && (directoryDepth(folder) > 0 || closedBranch(folder))) {
            state.cwd = destination;
            save();
            return { out: '', status: 0 };
          }
          if (!state.cwd && workspace.cwd) return null;
          if (!workspace.cwd) {
            if (!equal(destination, root)) return missing('cd', input);
            delete state.cwd;
            save();
            return { out: '', status: 0 };
          }
          return { forward: destination };
        }
        if (isFile && decoder([command, ...args.slice(0, -1)])) return noteInput(args.at(-1));
        if (command === 'chmod' && isFile && args.length >= 2) {
          const node = fileNode();
          const safelyScoped = args.slice(0, -1).filter(arg => !arg.startsWith('-')).length <= 1;
          if (!safelyScoped) return { out: 'chmod: give one discovery path at a time', status: 1 };
          const result = TerminalUnix.chmod(args, resolve, destination => equal(destination, filePath) ? node : undefined, () => false);
          if (!result.err) {
            state.mode = TerminalUnix.mode(node);
            save();
          }
          return { out: result.out, status: result.err ? 1 : 0 };
        }
        if (isFile && command === 'stat') {
          const node = fileNode();
          const result = TerminalUnix.permissionStat(args, arg => equal(resolve(arg), filePath) ? node : undefined, () => false);
          return result ? { out: result.out, status: result.err ? 1 : 0 } :
            { out: '  File: ' + args.at(-1) + '\n  Size: ' + new TextEncoder().encode(note + '\n').length +
              '\nAccess: (' + TerminalUnix.octal(bits()).padStart(4, '0') + '/' + TerminalUnix.permissions(node) + ')', status: 0 };
        }
        if (isFile && command === 'file' && args.length === 1) return { out: args[0] + ': Unicode text, UTF-8 text', status: 0 };
        if (isFile && ['cat', 'head', 'tail', 'grep', 'wc'].includes(command)) {
          if (!readable()) return { out: permission(args.at(-1), name), status: 1 };
          if (command === 'cat') {
            const options = args.slice(0, -1);
            if (options.some(option => !/^(?:-n|--number|--)$/.test(option))) {
              return { out: 'cat: give one discovery path, optionally with -n', status: 2 };
            }
            const text = read();
            return { out: options.some(option => option !== '--') ?
              text.split('\n').map((row, index) => String(index + 1).padStart(6) + '\t' + row).join('\n') : text, status: 0 };
          }
          const result = readFilter([command, ...args.slice(0, -1)], note);
          if (!result) return { out: name + ': unsupported options for this file', status: 2 };
          read();
          return result;
        }
        if (command === 'find' && args.length === 3 && args[1] === '-name' && equal(args[2], 'mcode.txt')) {
          const start = resolve(args[0]).replace(/\/$/, '') + '/';
          if (equal(filePath.slice(0, start.length), start)) return { out: args[0].replace(/\/$/, '') + '/' + filePath.slice(start.length), status: 0 };
        }
        if (command !== 'ls' && command !== 'tree') {
          if (['rm', 'del', 'erase', 'mv', 'move', 'cp', 'copy', 'touch', 'mkdir', 'rmdir', 'tee'].includes(command) &&
              (state.cwd || args.some(arg => equal(resolve(arg), filePath) || directoryDepth(relative(resolve(arg))) > 0))) {
            return { out: name + ': the discovery filesystem allows reading and permission changes', status: 1 };
          }
          if (state.cwd && ['cat', 'chmod', 'stat', 'file', 'head', 'tail', 'wc', 'grep', 'find'].includes(command)) return missing(name, args.at(-1) || '.');
          return null;
        }
        const isOption = word => word.startsWith('-') || windows && /^\/[abfs]$/i.test(word);
        const targets = args.filter(word => !isOption(word));
        if (targets.length > 1) return state.cwd ? { out: name + ': give one discovery path at a time', status: 1 } : null;
        const requested = resolve(targets[0]);
        const location = relative(requested);
        const hidden = args.some(value => /^-[a-z]*a[a-z]*$/i.test(value) || value === '--all' || windows && /^\/a$/i.test(value));
        const long = args.some(value => /^-[a-z]*l[a-z]*$/i.test(value));
        if (closedBranch(location)) return { out: '(empty directory)', status: 0 };
        if (equal(requested, filePath)) return { out: command === 'tree' ? 'tree: ' + targets[0] + ': Not a directory' :
          long ? TerminalUnix.permissions(fileNode()) + '  ' + targets[0] : targets[0], status: command === 'tree' ? 1 : 0 };
        const ancestorPrefix = requested.endsWith('/') ? requested : requested + '/';
        const ancestor = command === 'tree' && location === null && equal(root.slice(0, ancestorPrefix.length), ancestorPrefix);
        const depth = ancestor ? 0 : location === null ? -1 : directoryDepth(location);
        if (depth < 0) return state.cwd ? missing(name, targets[0] || '.') : null;
        const remaining = parts.slice(depth);
        const append = !state.cwd && (location === '' || ancestor);
        if (command === 'tree') {
          if (!hidden && remaining[0].startsWith('.')) return null;
          const rows = remaining.flatMap((part, index) => {
            const indent = '    '.repeat(index);
            const branch = decoy(depth + index);
            return [...(branch ? [indent + '├── ' + branch + '/'] : []), indent + '└── ' + part + (part === 'mcode.txt' ? '' : '/')];
          });
          return { out: (ancestor ? [root, ...rows] : rows).join('\n'), append, status: 0 };
        }
        if (!hidden && remaining[0].startsWith('.')) return state.cwd || location ? { out: '', status: 0 } : null;
        const entry = remaining[0];
        const permissions = entry !== 'mcode.txt' ? 'dr-x------' : TerminalUnix.permissions(fileNode());
        const branch = decoy(depth);
        const listing = long ? permissions + '  ' + entry : entry;
        return { out: branch ? (long ? 'dr-x------  ' : '') + branch + '\n' + listing : listing, append, status: 0 };
      }
    };
  };

  /* ================================================================ BASH / LINUX */
  G.makeBash = function () {
    const HOME = ['home', 'dev'];
    let fs, cwd, hist, env, lastStatus, pipefail, functions, positional, exported, flow, functionDepth, loopDepth, steps, argv0, shellChild;
    const seed = () => ({
      home: {
        dev: {
          'README.md': F('# dev-box\n\nA disposable Linux box for practising the shell.\nEverything here is simulated. "reset" starts over.\n'),
          'notes.txt': F('todo\n- rotate the staging key\n- read /var/log/auth.log\n- ship the weekly report\n'),
          projects: {
            'api.log': F([
              '2026-02-12T06:02:11Z INFO  api listening on :8080',
              '2026-02-12T06:03:44Z INFO  GET /health 200 3ms',
              '2026-02-12T06:07:02Z WARN  slow query 812ms orders.list',
              '2026-02-12T06:09:19Z ERROR upstream timeout /v1/pay',
              '2026-02-12T06:09:20Z INFO  retry 1/3 /v1/pay',
              '2026-02-12T06:09:22Z INFO  retry 2/3 /v1/pay',
              '2026-02-12T06:09:24Z ERROR upstream timeout /v1/pay',
              '2026-02-12T06:12:00Z INFO  GET /v1/orders 200 41ms'
            ].join('\n')),
            'deploy.sh': F('#!/bin/sh\nset -e\necho "building app:1.4"\ndocker build -t app:1.4 .\necho "pushing"\ndocker push registry.local/app:1.4\n', '755'),
            'config.json': F('{\n  "host": "10.0.0.5",\n  "port": 8080,\n  "debug": false,\n  "db": "postgres://app@db:5432/app"\n}')
          },
          scripts: {
            'backup.sh': F('#!/bin/sh\ntar -czf /tmp/backup.tgz /home/dev/projects\necho "backup written"\n', '755')
          },
          docs: {
            'cheatsheet.md': F('# cheatsheet\n\ngrep -rin "error" .\nfind . -name "*.log"\ncat projects/api.log | sort | uniq -c | sort -rn\n')
          }
        }
      },
      etc: {
        hosts: F('127.0.0.1 localhost\n10.0.0.5 dev-box\n10.0.0.9 gateway\n10.0.0.20 build-runner'),
        hostname: F('dev-box\n'),
        passwd: F('root:x:0:0:root:/root:/bin/bash\ndaemon:x:1:1:daemon:/usr/sbin:/usr/sbin/nologin\nsshd:x:110:65534::/run/sshd:/usr/sbin/nologin\ndev:x:1000:1000:dev:/home/dev:/bin/bash\n'),
        group: F('root:x:0:\nsudo:x:27:dev\ndocker:x:999:dev\ndev:x:1000:\n'),
        shells: F('/bin/sh\n/bin/bash\n/usr/bin/bash\n'),
        'os-release': F('NAME="Ubuntu"\nVERSION="22.04.4 LTS (Jammy Jellyfish)"\nID=ubuntu\nPRETTY_NAME="Ubuntu 22.04.4 LTS"')
      },
      var: {
        log: {
          'app.log': F('Feb 12 06:02:11 dev-box app[812]: listening on :8080\nFeb 12 06:09:19 dev-box app[812]: upstream timeout /v1/pay\nFeb 12 06:12:00 dev-box app[812]: GET /v1/orders 200\n'),
          'auth.log': F([
            'Feb 12 06:01:55 dev-box sshd[1102]: Accepted publickey for dev from 10.0.0.9 port 51222',
            'Feb 12 06:14:02 dev-box sshd[1180]: Failed password for root from 10.0.0.66 port 44120',
            'Feb 12 06:14:03 dev-box sshd[1180]: Failed password for root from 10.0.0.66 port 44121',
            'Feb 12 06:14:04 dev-box sshd[1180]: Failed password for admin from 10.0.0.66 port 44122',
            'Feb 12 06:14:09 dev-box sshd[1180]: error: maximum authentication attempts exceeded'
          ].join('\n'))
        }
      },
      tmp: {},
      usr: { bin: { app: F('# ELF 64-bit LSB pie executable, x86-64', '755') } }
    });
    const reset = () => {
      lanReset();      // back on dev-box, and every office PC gets its first disk again
      fs = seed(); cwd = HOME.slice(); hist = [];
      lastStatus = 0; pipefail = false;
      env = { USER: 'dev', SHELL: '/bin/bash', HOME: '/home/dev', PWD: '/home/dev', EDITOR: 'nano', TERM: 'xterm-256color', LANG: 'en_GB.UTF-8' };
      functions = new Map(); positional = []; exported = new Set(Object.keys(env)); flow = ''; functionDepth = 0; loopDepth = 0; argv0 = 'bash'; shellChild = 0;
    };
    reset();

    const path = () => '/' + cwd.join('/') || '/';
    const disp = () => {
      const p = path(), h = '/' + HOME.join('/');
      return p === h ? '~' : p.startsWith(h + '/') ? '~' + p.slice(h.length) : p;
    };
    const resolve = p => {
      if (!p || p === '~') return HOME.slice();
      p = String(p).replace(/\\/g, '/');
      if (p === '/') return [];
      if (p.startsWith('~/')) p = '/' + HOME.join('/') + p.slice(1);
      const parts = p.startsWith('/') ? [] : cwd.slice();
      for (const s of p.split('/')) {
        if (!s || s === '.') continue;
        if (s === '..') parts.pop(); else parts.push(s);
      }
      return parts;
    };
    const walk = parts => {
      let n = fs;
      for (const s of parts) { if (!isDir(n) || !Object.hasOwn(n, s)) return undefined; n = n[s]; }
      return n;
    };
    const put = (parts, node) => {
      let n = fs;
      for (let i = 0; i < parts.length - 1; i++) {
        if (!isDir(n[parts[i]])) n[parts[i]] = {};
        n = n[parts[i]];
      }
      n[parts[parts.length - 1]] = node;
    };
    const read = p => {
      if (p === '/dev/null') return { text: '' };
      const parts = resolve(p);
      const n = walk(parts);
      if (n === undefined) return { err: p + ': No such file or directory' };
      if (isDir(n)) return { err: p + ': Is a directory' };
      if (!(Unix.mode(n) & 0o400)) return { err: p + ': Permission denied' };
      return { text: textOf(n) };
    };
    const listTree = (node, base, out) => {
      for (const k of Object.keys(node).sort()) {
        const p = base + '/' + k;
        out.push([p, node[k]]);
        if (isDir(node[k])) listTree(node[k], p, out);
      }
      return out;
    };
    const src = (args, stdin) => {
      if (args.length) return read(args[0]);
      if (stdin != null) return { text: stdin };
      return { text: '' };
    };
    const C = Object.create(null);
    const failure = (stderr, status = 1) => ({ stderr, status });
    const commandResult = result => ({ stdout: result.err ? '' : result.out, stderr: result.err ? result.out : '', status: result.err ? 1 : 0 });
    if (typeof TerminalOpsTraining !== 'undefined') Object.assign(C, TerminalOpsTraining.asCommands(commandResult));

    let prevCwd = null;
    C.pwd = () => path();
    C.cd = a => {
      const target = a[0];
      if (target === '-') {
        if (!prevCwd) return failure('bash: cd: OLDPWD not set');
        const next = prevCwd.slice(); prevCwd = cwd.slice(); cwd = next; env.PWD = path();
        return path();
      }
      const p = resolve(target || '~');
      const n = walk(p);
      if (n === undefined) return failure('bash: cd: ' + (target || '~') + ': No such file or directory');
      if (!isDir(n)) return failure('bash: cd: ' + target + ': Not a directory');
      prevCwd = cwd.slice();
      cwd = p; env.PWD = path();
      return '';
    };
    C.ls = a => {
      let flags = '', targets = [];
      for (const x of a) {
        if (x.startsWith('--')) { if (x === '--all') flags += 'a'; else if (x === '--almost-all') flags += 'A'; }   // --color and friends change nothing here
        else if (x.startsWith('-') && x.length > 1) flags += x.slice(1);
        else targets.push(x);
      }
      if (!targets.length) targets = ['.'];
      const outs = [], errors = [];
      // Sizes are real byte counts, a directory counts 2 links plus one per subdirectory, and blocks are 4 KB like ext4.
      const bytes = c => isDir(c) ? 4096 : new TextEncoder().encode(textOf(c)).length;
      const links = c => isDir(c) ? 2 + Object.values(c).filter(isDir).length : 1;
      const human = size => size < 1024 ? String(size) : (size / 1024).toFixed(size < 10240 ? 1 : 0).replace(/\.0$/, '') + 'K';
      const row = (c, name) => permOf(c) + ' ' + String(links(c)).padStart(2) + ' dev dev ' +
        (flags.includes('h') ? human(bytes(c)) : String(bytes(c))).padStart(5) + ' Feb 12 06:20 ' + name;
      // ls -R: each folder as its own "path:" section, depth first, like GNU ls.
      if (flags.includes('R')) {
        const listDir = (node, label) => {
          const names = Object.keys(node).filter(k => flags.includes('a') || flags.includes('A') || k[0] !== '.').sort();
          outs.push((outs.length ? '\n' : '') + label + ':');
          if (flags.includes('l')) for (const k of names) outs.push(row(node[k], k));
          else if (names.length) outs.push(names.map(k => k + (isDir(node[k]) ? '/' : '')).join('  '));
          for (const k of names) if (isDir(node[k])) listDir(node[k], label.replace(/\/$/, '') + '/' + k);
        };
        for (const t of targets) {
          const n = walk(resolve(t));
          if (n === undefined) errors.push("ls: cannot access '" + t + "': No such file or directory");
          else if (!isDir(n)) outs.push(t);
          else listDir(n, t);
        }
        return { stdout: outs.join('\n'), stderr: errors.join('\n'), status: errors.length ? 2 : 0 };
      }
      for (const t of targets) {
        const parts = resolve(t), n = walk(parts);
        if (n === undefined) { errors.push("ls: cannot access '" + t + "': No such file or directory"); continue; }
        if (!isDir(n)) { outs.push(flags.includes('l') ? row(n, t) : t); continue; }
        if (!(Unix.mode(n, true) & 0o400)) { errors.push("ls: cannot open directory '" + t + "': Permission denied"); continue; }
        const names = Object.keys(n).filter(k => flags.includes('a') || flags.includes('A') || k[0] !== '.').sort();
        const dots = flags.includes('a') ? [['.', n], ['..', walk(parts.slice(0, -1)) || n]] : [];
        if (targets.length > 1) outs.push((outs.length ? '\n' : '') + t + ':');
        if (flags.includes('l')) {
          const entries = [...dots, ...names.map(k => [k, n[k]])];
          outs.push('total ' + entries.reduce((sum, [, c]) => sum + Math.max(4, Math.ceil(bytes(c) / 4096) * 4), 0));
          for (const [k, c] of entries) outs.push(row(c, k));
        } else if (names.length || dots.length) outs.push([...dots.map(([k]) => k + '/'), ...names.map(k => k + (isDir(n[k]) ? '/' : ''))].join('  '));
      }
      return { stdout: outs.join('\n'), stderr: errors.join('\n'), status: errors.length ? 2 : 0 };
    };
    C.cat = (a, stdin) => {
      let flags = '', files = [];
      for (const x of a) {
        if (x === '-') files.push('-');
        else if (x.startsWith('-') && x.length > 1) flags += x.slice(1);
        else files.push(x);
      }
      const outs = [], errors = [];
      for (const file of files.length ? files : ['-']) {
        const result = file === '-' ? { text: stdin ?? '' } : read(file);
        if (result.err) errors.push('cat: ' + result.err);
        else outs.push(result.text);
      }
      const combined = outs.join('');
      const ending = combined.endsWith('\n') ? '\n' : '';
      let lines = combined ? (ending ? combined.slice(0, -1) : combined).split('\n') : [];
      if (flags.includes('s')) lines = lines.filter((l, i) => l !== '' || lines[i - 1] !== '');
      if (flags.includes('E') || flags.includes('A')) lines = lines.map(l => l + '$');
      if (flags.includes('b')) {
        let num = 0;
        lines = lines.map(l => l === '' ? l : String(++num).padStart(6) + '\t' + l);
      } else if (flags.includes('n')) {
        lines = lines.map((l, i) => String(i + 1).padStart(6) + '\t' + l);
      }
      return { stdout: lines.join('\n') + ending, stderr: errors.join('\n'), status: errors.length ? 1 : 0 };
    };
    C.head = (a, stdin) => {
      let n = 10, files = [];
      for (let i = 0; i < a.length; i++) {
        if (a[i] === '-n') n = parseInt(a[++i], 10) || 10;
        else if (/^-n\d+$/.test(a[i])) n = parseInt(a[i].slice(2), 10) || 10;
        else if (/^-\d+$/.test(a[i])) n = parseInt(a[i].slice(1), 10) || 10;
        else if (!a[i].startsWith('-')) files.push(a[i]);
      }
      const r = src(files, stdin);
      if (r.err) return failure('head: ' + r.err);
      return (r.text.match(/[^\n]*\n|[^\n]+$/g) || []).slice(0, n).join('');
    };
    C.tail = (a, stdin) => {
      let n = 10, files = [];
      for (let i = 0; i < a.length; i++) {
        if (a[i] === '-n') n = parseInt(a[++i], 10) || 10;
        else if (/^-n\d+$/.test(a[i])) n = parseInt(a[i].slice(2), 10) || 10;
        else if (/^-\d+$/.test(a[i])) n = parseInt(a[i].slice(1), 10) || 10;
        else if (!a[i].startsWith('-')) files.push(a[i]);
      }
      const r = src(files, stdin);
      if (r.err) return failure('tail: ' + r.err);
      return (r.text.match(/[^\n]*\n|[^\n]+$/g) || []).slice(-n).join('');
    };
    C.echo = a => {
      let esc = false, newline = true, rest = a.slice();
      while (rest.length && /^-[neE]+$/.test(rest[0])) {
        for (const flag of rest.shift().slice(1)) {
          if (flag === 'n') newline = false;
          else esc = flag === 'e';
        }
      }
      const out = rest.join(' ');
      return (esc ? out.replace(/\\n/g, '\n').replace(/\\t/g, '\t') : out) + (newline ? '\n' : '');
    };
    C.touch = a => {
      const files = a.filter(x => !x.startsWith('-'));
      if (!files.length) return failure('touch: missing file operand');
      for (const file of files) {
        if (walk(resolve(file)) !== undefined) continue;
        const err = writeFile(file, '', false);
        if (err) return failure('touch: ' + err);
      }
      return '';
    };
    C.mkdir = a => {
      const parents = a.some(x => x.startsWith('-') && x.includes('p'));
      const p = a.filter(x => !x.startsWith('-'));
      if (!p.length) return failure('mkdir: missing operand');
      for (const f of p) {
        const parts = resolve(f);
        if (parents) {
          let cur = fs;
          for (const seg of parts) {
            if (!Object.hasOwn(cur, seg)) Object.defineProperty(cur, seg, { value: {}, enumerable: true, writable: true, configurable: true });
            else if (!isDir(cur[seg])) return failure("mkdir: cannot create directory '" + f + "': File exists");
            cur = cur[seg];
          }
        } else {
          const n = walk(parts.slice(0, -1));
          if (!isDir(n)) return failure("mkdir: cannot create directory '" + f + "': No such file or directory");
          const key = parts.at(-1);
          if (!key || Object.hasOwn(n, key)) return failure("mkdir: cannot create directory '" + f + "': File exists");
          Object.defineProperty(n, key, { value: {}, enumerable: true, writable: true, configurable: true });
        }
      }
      return '';
    };
    C.rm = a => {
      const flagStr = a.filter(x => x.startsWith('-')).join('');
      const recursive = flagStr.includes('r') || flagStr.includes('R'), force = flagStr.includes('f');
      if (!force && !a.some(arg => !arg.startsWith('-'))) return failure('rm: missing operand');
      for (const f of a.filter(x => !x.startsWith('-'))) {
        const parts = resolve(f), parent = walk(parts.slice(0, -1)), key = parts[parts.length - 1];
        if (!isDir(parent) || !Object.hasOwn(parent, key)) { if (!force) return failure("rm: cannot remove '" + f + "': No such file or directory"); continue; }
        if (isDir(parent[key]) && !recursive) return failure("rm: cannot remove '" + f + "': Is a directory");
        delete parent[key];
      }
      return '';
    };
    C.cp = a => {
      const f = a.filter(x => !x.startsWith('-'));
      const r = read(f[0] || '');
      if (r.err) return failure('cp: ' + r.err);
      put(resolve(f[1] || ''), F(r.text));
      return '';
    };
    C.mv = a => {
      const f = a.filter(x => !x.startsWith('-'));
      const r = read(f[0] || '');
      if (r.err) return failure('mv: ' + r.err);
      const parts = resolve(f[0]);
      const parent = walk(parts.slice(0, -1));
      if (parent) delete parent[parts[parts.length - 1]];
      put(resolve(f[1] || ''), F(r.text));
      return '';
    };
    C.find = a => {
      const ni = a.indexOf('-name') >= 0 ? a.indexOf('-name') : a.indexOf('-iname');
      const pat = ni >= 0 ? a[ni + 1] : null;
      const ti = a.indexOf('-type');
      const wantType = ti >= 0 ? a[ti + 1] : null;
      const start = a.find((x, i) => !x.startsWith('-') && (ni < 0 || i !== ni + 1) && (ti < 0 || i !== ti + 1)) || '.';
      const n = walk(resolve(start));
      if (!isDir(n)) return "find: '" + start + "': No such file or directory";
      const re = pat ? new RegExp('^' + pat.replace(/[.+^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '.*').replace(/\?/g, '.') + '$', ni === a.indexOf('-iname') ? 'i' : '') : null;
      const rows = [];
      for (const [p, c] of listTree(n, start, [])) {
        if (wantType === 'f' && isDir(c)) continue;
        if (wantType === 'd' && !isDir(c)) continue;
        if (!re || re.test(p.split('/').pop())) rows.push(p);
      }
      return rows.join('\n');
    };
    C.grep = (a, stdin) => {
      let flags = '', rest = [];
      for (const x of a) { if (x.startsWith('-') && x.length > 1) flags += x.slice(1); else rest.push(x); }
      const pat = rest.shift();
      if (pat == null) return failure('usage: grep [-inrcvlo] <pattern> [file...]', 2);
      let re; try { re = new RegExp(pat, flags.includes('i') ? 'i' : ''); } catch (e) { return failure('grep: invalid pattern', 2); }
      const hits = [], matchedFiles = new Set(), errors = [];
      const showLabel = rest.length > 1 || flags.includes('r') || flags.includes('R') || flags.includes('H');
      const scan = (t, label) => textLines(t).forEach((l, i) => {
        if (re.test(l) !== flags.includes('v')) {
          if (label) matchedFiles.add(label);
          const body = flags.includes('o') && !flags.includes('v') ? (l.match(re) || [''])[0] : l;
          hits.push((label && showLabel ? label + ':' : '') + (flags.includes('n') ? (i + 1) + ':' : '') + body);
        }
      });
      if (!rest.length) scan(stdin ?? '', '');
      else for (const f of rest) {
        const n = walk(resolve(f));
        if (n === undefined) { errors.push('grep: ' + f + ': No such file or directory'); continue; }
        if (isDir(n)) {
          if (!flags.includes('r') && !flags.includes('R')) { errors.push('grep: ' + f + ': Is a directory'); continue; }
          for (const [p, c] of listTree(n, f, [])) {
            if (isDir(c)) continue;
            const result = read(p);
            if (result.err) errors.push('grep: ' + result.err);
            else scan(result.text, p);
          }
        } else {
          const result = read(f);
          if (result.err) errors.push('grep: ' + result.err);
          else scan(result.text, f);
        }
      }
      const quiet = flags.includes('q');
      const output = quiet ? [] : flags.includes('l') ? [...matchedFiles] : flags.includes('c') ? [String(hits.length)] : hits;
      const status = quiet && hits.length ? 0 : errors.length ? 2 : hits.length ? 0 : 1;
      return { stdout: writeLines(output), stderr: errors.join('\n'), status };
    };
    C.wc = (a, stdin) => {
      const flags = a.filter(x => x.startsWith('-')).join('');
      const files = a.filter(x => !x.startsWith('-'));
      const r = src(files, stdin);
      if (r.err) return failure('wc: ' + r.err);
      const t = r.text;
      const lCount = (t.match(/\n/g) || []).length;
      const wCount = t.trim() ? t.trim().split(/\s+/).length : 0;
      const cCount = new TextEncoder().encode(t).length;
      const cols = [];
      if (flags.includes('l')) cols.push(lCount);
      if (flags.includes('w')) cols.push(wCount);
      if (flags.includes('m')) cols.push([...t].length);
      if (flags.includes('c')) cols.push(cCount);
      if (!cols.length) cols.push(lCount, wCount, cCount);
      return cols.join(' ') + (files[0] ? ' ' + files[0] : '') + '\n';
    };
    C.sort = (a, stdin) => {
      let sep = null, keyCol = null, numeric = false, rev = false, uniq = false;
      const skip = new Set();
      for (let i = 0; i < a.length; i++) {
        if (a[i] === '-t') { sep = a[++i]; skip.add(i); }
        else if (/^-t./.test(a[i])) sep = a[i].slice(2);
        else if (a[i] === '-k') { const kv = a[++i] || '1'; skip.add(i); keyCol = parseInt(kv, 10); if (/n/i.test(kv)) numeric = true; }
        else if (/^-k\d/.test(a[i])) { keyCol = parseInt(a[i].slice(2), 10); if (/n/i.test(a[i])) numeric = true; }
        else if (a[i].startsWith('-')) {
          if (a[i].includes('n')) numeric = true;
          if (a[i].includes('r')) rev = true;
          if (a[i].includes('u')) uniq = true;
        }
      }
      const r = src(a.filter((x, i) => !x.startsWith('-') && !skip.has(i)), stdin);
      if (r.err) return failure('sort: ' + r.err);
      const fieldOf = line => keyCol == null ? line : (sep ? line.split(sep) : line.trim().split(/\s+/))[keyCol - 1] || '';
      const rows = textLines(r.text);
      const compare = (x, y) => {
        const fx = fieldOf(x), fy = fieldOf(y);
        if (numeric) return (parseFloat(fx.trim()) || 0) - (parseFloat(fy.trim()) || 0);
        return fx < fy ? -1 : fx > fy ? 1 : 0;
      };
      rows.sort((x, y) => (rev ? -1 : 1) * (compare(x, y) || (!uniq ? (x < y ? -1 : x > y ? 1 : 0) : 0)));
      return writeLines(uniq ? rows.filter((row, i) => i === 0 || compare(row, rows[i - 1]) !== 0) : rows);
    };
    C.uniq = (a, stdin) => {
      const r = src(a.filter(x => !x.startsWith('-')), stdin);
      if (r.err) return failure('uniq: ' + r.err);
      const rows = []; let prev = null, n = 0;
      const flags = a.filter(arg => arg.startsWith('-')).join('');
      const key = value => flags.includes('i') ? value?.toLowerCase() : value;
      const flush = () => {
        if (prev === null) return;
        if (flags.includes('u') && n !== 1) return;
        if (flags.includes('d') && n < 2) return;
        rows.push(flags.includes('c') ? String(n).padStart(7) + ' ' + prev : prev);
      };
      for (const l of textLines(r.text)) {
        if (key(l) === key(prev)) n++;
        else { flush(); prev = l; n = 1; }
      }
      flush();
      return writeLines(rows);
    };
    C.cut = (a, stdin) => {
      let d = '\t', fSpec = '1';
      const skip = new Set();
      for (let i = 0; i < a.length; i++) {
        const x = a[i];
        if (x === '-d') { d = a[++i] ?? '\t'; skip.add(i); }
        else if (x === '-f') { fSpec = a[++i] || '1'; skip.add(i); }
        else if (/^-d/.test(x) && x.length > 2) d = x.slice(2);
        else if (/^-f.+/.test(x)) fSpec = x.slice(2);
      }
      const files = a.filter((x, i) => !x.startsWith('-') && !skip.has(i));
      const r = src(files, stdin);
      if (r.err) return 'cut: ' + r.err;
      const rangeM = fSpec.match(/^(\d+)-(\d*)$/);
      const list = fSpec.includes(',') ? fSpec.split(',').map(n => parseInt(n, 10) - 1) : null;
      const idx = parseInt(fSpec, 10) || 1;
      return r.text.split('\n').map(l => {
        const parts = l.split(d);
        if (rangeM) return parts.slice((+rangeM[1] || 1) - 1, rangeM[2] ? +rangeM[2] : undefined).join(d);
        if (list) return list.map(k => parts[k] || '').join(d);
        return parts[idx - 1] || '';
      }).join('\n');
    };
    C.tr = (a, stdin) => {
      if (stdin == null) return 'tr: missing input';
      const expand = s => {
        s = String(s || '').replace(/\\n/g, '\n').replace(/\\t/g, '\t').replace(/\\r/g, '\r').replace(/\[:lower:\]/g, 'a-z').replace(/\[:upper:\]/g, 'A-Z').replace(/\[:digit:\]/g, '0-9').replace(/\[:space:\]/g, ' \t\n\r');
        let o = '';
        for (let i = 0; i < s.length; i++) {
          if (i + 2 < s.length && s[i + 1] === '-') { for (let c = s.charCodeAt(i); c <= s.charCodeAt(i + 2); c++) o += String.fromCharCode(c); i += 2; }
          else o += s[i];
        }
        return o;
      };
      const sets = a.filter(x => !x.startsWith('-'));
      if (a.includes('-d')) { const del = expand(sets[0]); return [...stdin].filter(c => !del.includes(c)).join(''); }
      if (a.includes('-s')) { const sq = expand(sets[0]); return stdin.replace(new RegExp('([' + sq.replace(/[\\^$.*+?()[\]{}|]/g, '\\$&') + '])\\1+', 'g'), '$1'); }
      const from = expand(sets[0]), to = expand(sets[1]);
      return [...stdin].map(c => { const i = from.indexOf(c); return i < 0 ? c : (to[i] || to[to.length - 1] || ''); }).join('');
    };
    C.sed = (a, stdin) => {
      const script = a.find(x => !x.startsWith('-')) || '';
      const m = script.match(/^s(.)(.*?)\1(.*?)\1([gi]*)$/);
      if (!m) return 'sed: unsupported expression (try s/foo/bar/g)';
      let re; try { re = new RegExp(m[2], m[4].includes('g') ? 'g' + (m[4].includes('i') ? 'i' : '') : (m[4].includes('i') ? 'i' : '')); } catch (e) { return 'sed: bad regex'; }
      const files = a.filter(x => x !== script && !x.startsWith('-'));
      const r = src(files, stdin);
      if (r.err) return 'sed: ' + r.err;
      return r.text.split('\n').map(l => l.replace(re, m[3])).join('\n');
    };
    C.awk = (a, stdin) => {
      let fs2 = ' ', prog = '';
      const skip = new Set();
      for (let i = 0; i < a.length; i++) {
        if (a[i] === '-F') { fs2 = a[++i] || ' '; skip.add(i); }
        else if (/^-F./.test(a[i])) fs2 = a[i].slice(2);
        else if (!prog && a[i].includes('{')) { prog = a[i]; skip.add(i); }
      }
      const m = prog.match(/\{\s*print\s+(.+?)\s*\}/);
      if (!m) return 'awk: this sandbox supports {print $1, $2, $0}';
      const fields = m[1].split(',').map(x => x.trim());
      const files = a.filter((x, i) => !x.startsWith('-') && !skip.has(i));
      const r = src(files, stdin);
      if (r.err) return 'awk: ' + r.err;
      return r.text.split('\n').map(line => {
        const parts = fs2 === ' ' ? line.trim().split(/\s+/) : line.split(fs2);
        return fields.map(f2 => {
          if (/^\$\d+$/.test(f2)) return parts[(+f2.slice(1)) - 1] || '';
          if (f2 === '$0') return line;
          return f2.replace(/^"|"$/g, '');
        }).join(' ');
      }).join('\n');
    };
    C.chmod = a => commandResult(Unix.chmod(a, resolve, walk, isDir));
    C.ps = () => [
      '    PID TTY          TIME CMD',
      '      1 ?        00:00:02 systemd',
      '    812 ?        00:00:14 node',
      '    884 ?        00:00:00 sshd',
      '   1102 pts/0    00:00:00 bash',
      '   1210 pts/0    00:00:00 ps'
    ].join('\n');
    C.df = () => 'Filesystem      Size  Used Avail Use% Mounted on\n/dev/vda1        40G  8.2G   30G  22% /\ntmpfs           2.0G     0  2.0G   0% /dev/shm';
    C.du = () => '184K\t/home/dev/projects\n8.0K\t/home/dev/docs\n4.0K\t/home/dev/notes.txt';
    C.free = () => '               total        used        free      shared  buff/cache   available\nMem:           3.9Gi       1.2Gi       1.9Gi        12Mi       821Mi       2.4Gi\nSwap:          2.0Gi          0B       2.0Gi';
    C.uname = a => a.includes('-a') ? 'Linux dev-box 5.15.0-91-generic #101-Ubuntu SMP x86_64 GNU/Linux' : 'Linux';
    C.whoami = () => 'dev';
    C.id = () => 'uid=1000(dev) gid=1000(dev) groups=1000(dev),27(sudo),999(docker)';
    C.date = () => 'Thu Feb 12 06:58:12 UTC 2026';
    C.uptime = () => ' 06:58:12 up 3 days,  4:12,  1 user,  load average: 0.14, 0.09, 0.06';
    C.history = () => hist.map((h, i) => String(i + 1).padStart(4) + '  ' + h).join('\n');
    const printVariables = names => [...names].filter(name => Object.hasOwn(env, name)).map(name => name + '=' + env[name]).join('\n');
    C.env = () => printVariables(exported);
    C.export = a => {
      if (!a.length || a[0] === '-p') return printVariables(exported);
      for (const arg of a) {
        const match = /^([A-Za-z_]\w*)(?:=([\s\S]*))?$/.exec(arg);
        if (!match) return failure('bash: export: ' + arg + ': not a valid identifier');
        if (match[2] !== undefined) assign(match[1], match[2]);
        exported.add(match[1]);
      }
      return '';
    };
    C.which = a => a.map(x => ({ ls: '/usr/bin/ls', grep: '/usr/bin/grep', node: '/usr/bin/node', docker: '/usr/bin/docker' }[x] || '')).filter(Boolean).join('\n') || 'which: no ' + (a[0] || '') + ' in (/usr/local/bin:/usr/bin:/bin)';
    C.man = a => G.formatHelp('bash', a);
    C.tar = a => {
      const file = a[a.indexOf('-f') >= 0 ? a[a.indexOf('-f') + 1] : a.find(x => !x.startsWith('-') && !/^[a-z]+$/.test(x)) || 'archive.tgz'];
      if (a.join(' ').includes('-t')) return 'drwxr-xr-x dev/dev 0 2026-02-12 06:20 projects/\n-rw-r--r-- dev/dev 812 2026-02-12 06:20 projects/api.log';
      if (a.some(x => x.includes('x'))) return '';
      const target = a.filter(x => !x.startsWith('-') && x !== file)[0] || '.';
      const n = walk(resolve(target));
      if (!n) return 'tar: ' + target + ': Cannot stat: No such file or directory';
      put(resolve(file), F('(binary gzip archive)'));
      return '';
    };
    C.gzip = a => {
      const f = a.filter(x => !x.startsWith('-'))[0];
      const r = read(f || '');
      if (r.err) return 'gzip: ' + r.err;
      put(resolve((f || '') + '.gz'), F('(binary gzip data)'));
      return '';
    };
    C.curl = a => {
      const url = a.find(x => !x.startsWith('-')) || '';
      if (!url) return 'curl: try \'curl https://example.internal\'';
      if (/api|health/.test(url)) return '{"status":"ok","service":"api","version":"1.4.2","uptime":918244}';
      if (/example/.test(url)) return '<!doctype html>\n<html><head><title>Example Domain</title></head><body><h1>Example Domain</h1></body></html>';
      return 'curl: (6) Could not resolve host: ' + url.replace(/^https?:\/\//, '').split('/')[0];
    };
    C.ping = a => {
      const host = a.find(x => !x.startsWith('-')) || 'localhost';
      return ['PING ' + host + ' (10.0.0.5) 56(84) bytes of data.',
        '64 bytes from ' + host + ' (10.0.0.5): icmp_seq=1 ttl=64 time=0.041 ms',
        '64 bytes from ' + host + ' (10.0.0.5): icmp_seq=2 ttl=64 time=0.052 ms',
        '64 bytes from ' + host + ' (10.0.0.5): icmp_seq=3 ttl=64 time=0.048 ms',
        '64 bytes from ' + host + ' (10.0.0.5): icmp_seq=4 ttl=64 time=0.050 ms',
        '',
        '--- ' + host + ' ping statistics ---',
        '4 packets transmitted, 4 received, 0% packet loss, time 3004ms',
        'rtt min/avg/max/mdev = 0.041/0.047/0.052/0.004 ms'].join('\n');
    };
    C.ssh = a => {
      const arg = a.find(x => !x.startsWith('-')) || 'dev@10.0.0.5';
      return 'The authenticity of host \'' + arg.split('@').pop() + '\' can\'t be established.\nED25519 key fingerprint is SHA256:xQ2VJ8k0dW3n1sB6yT7pL9cR4mE2aH5fG8jK0.\nThis key is not known by any other names.\nAre you sure you want to continue connecting (yes/no/[fingerprint])? yes\nWarning: Permanently added \'' + arg.split('@').pop() + '\' (ED25519) to the list of known hosts.\n(playground: no real session is opened)';
    };
    C.nmap = a => {
      const ip = a.find(x => /^\d+\.\d+\.\d+\.\d+$/.test(x)) || '10.0.0.5';
      return ['Starting Nmap 7.94 ( https://nmap.org )', 'Nmap scan report for ' + ip, 'Host is up (0.014s latency).', '',
        'PORT     STATE SERVICE   VERSION',
        '22/tcp   open  ssh       OpenSSH 8.2p1 Ubuntu-4ubuntu0.5',
        '80/tcp   open  http      nginx 1.18.0',
        '8080/tcp open  http-alt  Node.js Express',
        '5432/tcp closed postgresql', '', 'Nmap done: 1 IP address (1 host up) scanned in 1.84 seconds'].join('\n');
    };
    C.base64 = (a, stdin) => {
      const dec = a.some(x => /^-d|--decode$/.test(x));
      const r = src(a.filter(x => !x.startsWith('-')), stdin);
      if (r.err) return 'base64: ' + r.err;
      // GNU base64 -d stops with "invalid input" on any character outside the Base64 alphabet (whitespace is skipped).
      if (dec && !/^[A-Za-z0-9+/]*={0,2}$/.test(r.text.replace(/\s+/g, ''))) return 'base64: invalid input';
      try {
        return dec ? (typeof atob === 'function' ? atob(r.text.replace(/\s+/g, '')) : Buffer.from(r.text, 'base64').toString('utf8'))
          : (typeof btoa === 'function' ? btoa(r.text) : Buffer.from(r.text, 'utf8').toString('base64'));
      } catch (e) { return 'base64: invalid input'; }
    };
    C.xxd = (a, stdin) => {
      const dec = a.includes('-r'), plain = a.includes('-p');
      const r = src(a.filter(x => !x.startsWith('-')), stdin);
      if (r.err) return 'xxd: ' + r.err;
      if (dec) {
        const cleaned = r.text.split('\n').map(l => {
          const m = l.match(/^[0-9a-f]{4,8}:\s+([0-9a-f ]+?)(?:\s{2,}.*)?$/i);
          return m ? m[1] : l;
        }).join('');
        const hex = cleaned.replace(/[^0-9a-f]/gi, '');
        let out = '';
        for (let i = 0; i + 1 < hex.length; i += 2) out += String.fromCharCode(parseInt(hex.slice(i, i + 2), 16));
        return out;
      }
      const bytes = [...r.text].map(c => c.charCodeAt(0));
      if (plain) return bytes.map(b => b.toString(16).padStart(2, '0')).join('');
      const rows = [];
      for (let i = 0; i < bytes.length; i += 8) {
        const ch = bytes.slice(i, i + 8);
        rows.push(i.toString(16).padStart(8, '0') + ': ' + ch.map(b => b.toString(16).padStart(2, '0')).join(' ').padEnd(23) + '  ' + ch.map(b => b >= 32 && b < 127 ? String.fromCharCode(b) : '.').join(''));
      }
      return rows.join('\n');
    };
    C.tee = (a, stdin) => {
      const append = a.includes('-a');
      const f = a.find(x => !x.startsWith('-'));
      if (f && stdin != null) writeFile(f, stdin, append);
      return stdin == null ? '' : stdin;
    };
    const fnvHex = (s, len) => {
      let h1 = 0x811c9dc5, h2 = 0x9e3779b9, out = '';
      for (let i = 0; i < s.length; i++) {
        h1 = Math.imul(h1 ^ s.charCodeAt(i), 0x01000193) >>> 0;
        h2 = Math.imul(h2 ^ (s.charCodeAt(i) + i), 0x85ebca6b) >>> 0;
      }
      let seed = (h1 ^ h2) >>> 0;
      while (out.length < len) {
        seed = (Math.imul(seed ^ (seed >>> 15), 0x2c1b3c6d) + 0x297a2d39) >>> 0;
        out += seed.toString(16).padStart(8, '0');
      }
      return out.slice(0, len);
    };
    let aliases = { ll: 'ls -la', la: 'ls -a', dir: 'ls' };
    C.tree = a => {
      const t = a.find(x => !x.startsWith('-')) || '.';
      const n = walk(resolve(t));
      if (!isDir(n)) return t + ' [error opening dir]';
      const showHidden = a.some(word => /^-[a-z]*a[a-z]*$/i.test(word) || word === '--all');
      const rows = [t];
      const rec = (node, pre) => {
        const ks = Object.keys(node).filter(name => showHidden || !name.startsWith('.')).sort();
        ks.forEach((k, i) => {
          const last = i === ks.length - 1;
          rows.push(pre + (last ? '└── ' : '├── ') + k + (isDir(node[k]) ? '/' : ''));
          if (isDir(node[k])) rec(node[k], pre + (last ? '    ' : '│   '));
        });
      };
      rec(n, '');
      return rows.join('\n');
    };
    C.stat = a => {
      const formatted = Unix.permissionStat(a, p => walk(resolve(p)), isDir);
      if (formatted) return commandResult(formatted);
      const f = a.find(x => !x.startsWith('-'));
      if (!f) return failure('stat: missing operand');
      const n = walk(resolve(f));
      if (n === undefined) return failure("stat: cannot stat '" + f + "': No such file or directory");
      const sz = isDir(n) ? 4096 : textOf(n).length;
      return '  File: ' + f + '\n  Size: ' + sz + '\tBlocks: ' + Math.ceil(sz / 512) + '\t' + (isDir(n) ? 'directory' : 'regular file') + '\nAccess: (' + (modeOf(n).padStart(4, '0') + '/' + permOf(n)) + ')  Uid: ( 1000/     dev)   Gid: ( 1000/     dev)\nModify: 2026-02-12 06:20:00.000000000 +0000';
    };
    C.file = a => {
      const f = a.find(x => !x.startsWith('-'));
      if (!f) return 'usage: file <path>';
      const n = walk(resolve(f));
      if (n === undefined) return f + ': cannot open (No such file or directory)';
      if (isDir(n)) return f + ': directory';
      const t = textOf(n);
      if (f.endsWith('.sh') || t.startsWith('#!')) return f + ': Bourne-Again shell script, ASCII text executable';
      if (f.endsWith('.gz') || f.endsWith('.tgz')) return f + ': gzip compressed data';
      if (f.endsWith('.json') || /^\s*[\[{]/.test(t)) return f + ': JSON data';
      return f + ': ASCII text';
    };
    C.strings = (a, stdin) => {
      const r = src(a.filter(x => !x.startsWith('-')), stdin);
      if (r.err) return 'strings: ' + r.err;
      return (r.text.match(/[\x20-\x7e]{4,}/g) || []).join('\n');
    };
    C.nl = (a, stdin) => { const r = src(a.filter(x => !x.startsWith('-')), stdin); return r.err ? 'nl: ' + r.err : r.text.split('\n').map((l, i) => String(i + 1).padStart(6) + '\t' + l).join('\n'); };
    C.rev = (a, stdin) => { const r = src(a.filter(x => !x.startsWith('-')), stdin); return r.err ? 'rev: ' + r.err : r.text.split('\n').map(l => [...l].reverse().join('')).join('\n'); };
    C.tac = (a, stdin) => { const r = src(a.filter(x => !x.startsWith('-')), stdin); return r.err ? 'tac: ' + r.err : r.text.split('\n').reverse().join('\n'); };
    C.rot13 = (a, stdin) => { const r = src(a.filter(x => !x.startsWith('-')), stdin); const t = r.err ? a.join(' ') : r.text; return [...t].map(c => /[a-z]/i.test(c) ? String.fromCharCode((c <= 'Z' ? 65 : 97) + (c.charCodeAt(0) - (c <= 'Z' ? 65 : 97) + 13) % 26) : c).join(''); };
    C.paste = a => {
      const dIdx = a.indexOf('-d'), sep = dIdx >= 0 ? (a[dIdx + 1] || '\t') : '\t';
      const files = a.filter((x, i) => !x.startsWith('-') && (dIdx < 0 || i !== dIdx + 1));
      const lists = files.map(f => { const r = read(f); return r.err ? null : r.text.split('\n'); });
      if (lists.some(l => l === null)) return 'paste: cannot open file';
      const len = Math.max(0, ...lists.map(l => l.length));
      return Array.from({ length: len }, (_, i) => lists.map(l => l[i] || '').join(sep)).join('\n');
    };
    C.diff = a => {
      const f = a.filter(x => !x.startsWith('-'));
      if (f.length < 2) return 'usage: diff <file1> <file2>';
      const r1 = read(f[0]), r2 = read(f[1]);
      if (r1.err) return 'diff: ' + r1.err;
      if (r2.err) return 'diff: ' + r2.err;
      if (r1.text === r2.text) return '';
      const l1 = r1.text.split('\n'), l2 = r2.text.split('\n'), out = ['--- ' + f[0], '+++ ' + f[1]];
      const n = Math.max(l1.length, l2.length);
      for (let i = 0; i < n; i++) {
        if (l1[i] !== l2[i]) { if (l1[i] !== undefined) out.push('-' + l1[i]); if (l2[i] !== undefined) out.push('+' + l2[i]); }
      }
      return out.join('\n');
    };
    C.comm = a => {
      const f = a.filter(x => !x.startsWith('-'));
      if (f.length < 2) return 'usage: comm <file1> <file2>';
      const r1 = read(f[0]), r2 = read(f[1]);
      if (r1.err || r2.err) return 'comm: ' + (r1.err || r2.err);
      const s1 = new Set(r1.text.split('\n')), s2 = new Set(r2.text.split('\n'));
      const all = Array.from(new Set([...s1, ...s2])).sort();
      return all.map(x => (s1.has(x) && s2.has(x) ? '\t\t' : s2.has(x) ? '\t' : '') + x).join('\n');
    };
    C.fold = (a, stdin) => {
      const wi = a.indexOf('-w'), w = wi >= 0 ? (parseInt(a[wi + 1], 10) || 80) : 80;
      const r = src(a.filter((x, i) => !x.startsWith('-') && (wi < 0 || i !== wi + 1)), stdin);
      if (r.err) return 'fold: ' + r.err;
      return r.text.split('\n').map(l => l.match(new RegExp('.{1,' + w + '}', 'g'))?.join('\n') || '').join('\n');
    };
    C.hexdump = (a, stdin) => C.xxd(a.filter(x => x !== '-C'), stdin);
    C.od = (a, stdin) => C.xxd([], stdin == null && a.length ? (read(a.find(x => !x.startsWith('-')) || '').text || '') : stdin);
    for (const algorithm of ['md5', 'sha1', 'sha256']) {
      const checksum = Unix.checksum(algorithm, read);
      C[algorithm + 'sum'] = (a, stdin) => commandResult(checksum(a, stdin));
    }
    C.cksum = (a, stdin) => { const f = a.find(x => !x.startsWith('-')); const r = src(f ? [f] : [], stdin); return r.err ? 'cksum: ' + r.err : parseInt(fnvHex(r.text, 8), 16) + ' ' + r.text.length + (f ? ' ' + f : ''); };
    C.rmdir = a => {
      for (const f of a.filter(x => !x.startsWith('-'))) {
        const parts = resolve(f), parent = walk(parts.slice(0, -1)), key = parts[parts.length - 1];
        if (!isDir(parent) || !(key in parent)) return "rmdir: failed to remove '" + f + "': No such file or directory";
        if (!isDir(parent[key])) return "rmdir: failed to remove '" + f + "': Not a directory";
        if (Object.keys(parent[key]).length) return "rmdir: failed to remove '" + f + "': Directory not empty";
        delete parent[key];
      }
      return '';
    };
    C.ln = a => {
      const f = a.filter(x => !x.startsWith('-'));
      if (f.length < 2) return 'usage: ln [-s] <target> <link>';
      const r = read(f[0]);
      if (r.err) return 'ln: ' + r.err;
      put(resolve(f[1]), F(r.text));
      return '';
    };
    C.readlink = a => '/' + resolve(a.find(x => !x.startsWith('-')) || '.').join('/');
    C.realpath = C.readlink;
    C.basename = a => String(a[0] || '').replace(/\/+$/, '').split('/').pop() || '/';
    C.dirname = a => { const p = String(a[0] || '').replace(/\/+$/, '').split('/'); p.pop(); return p.join('/') || '.'; };
    C.mktemp = a => { const p = '/tmp/tmp.' + Math.random().toString(36).slice(2, 10); put(resolve(p), a.includes('-d') ? {} : F('')); return p; };
    C.hostname = () => 'dev-box';
    C.hostnamectl = () => ' Static hostname: dev-box\nOperating System: Ubuntu 22.04.4 LTS\n          Kernel: Linux 5.15.0-91-generic\n    Architecture: x86-64';
    C.arch = () => 'x86_64';
    C.nproc = () => '4';
    C.lscpu = () => 'Architecture:        x86_64\nCPU(s):              4\nModel name:          Virtual CPU @ 2.80GHz\nThread(s) per core:  1';
    C.lsblk = () => 'NAME   MAJ:MIN RM  SIZE RO TYPE MOUNTPOINTS\nvda    253:0    0   40G  0 disk\n└─vda1 253:1    0   40G  0 part /';
    C.mount = () => '/dev/vda1 on / type ext4 (rw,relatime)\ntmpfs on /dev/shm type tmpfs (rw,nosuid,nodev)';
    C.who = () => 'dev      pts/0        2026-02-12 06:10 (10.0.0.9)';
    C.w = () => C.uptime() + '\nUSER     TTY      FROM             LOGIN@   IDLE   WHAT\ndev      pts/0    10.0.0.9         06:10    0.00s  bash';
    C.last = () => 'dev      pts/0        10.0.0.9         Thu Feb 12 06:10   still logged in\nreboot   system boot  5.15.0-91-gen    Mon Feb  9 02:46   still running';
    C.groups = () => 'dev sudo docker';
    C.users = () => 'dev';
    C.cal = () => '   February 2026\nSu Mo Tu We Th Fr Sa\n 1  2  3  4  5  6  7\n 8  9 10 11 12 13 14\n15 16 17 18 19 20 21\n22 23 24 25 26 27 28';
    C.sleep = () => '';
    C.true = () => '';
    C.false = () => ({ status: 1 });
    C[':'] = C.true;
    C.yes = a => Array(10).fill(a.join(' ') || 'y').join('\n') + '\n... (truncated)';
    C.seq = a => {
      const ns = a.map(Number);
      const [s, st, e] = ns.length === 1 ? [1, 1, ns[0]] : ns.length === 2 ? [ns[0], 1, ns[1]] : [ns[0], ns[1], ns[2]];
      const out = [];
      for (let i = s; st > 0 ? i <= e : i >= e; i += st) { out.push(String(i)); if (out.length > 200) break; }
      return out.join('\n');
    };
    C.expr = a => {
      try { const ex = a.join(' ').replace(/[^0-9+\-*/%().\s]/g, ''); return String(new Function('return (' + ex + ')')()); } catch (e) { return 'expr: syntax error'; }
    };
    C.bc = (a, stdin) => {
      const ex = (stdin || a.join(' ')).trim().replace(/[^0-9+\-*/%().^\s]/g, '').replace(/\^/g, '**');
      if (!ex) return 'bc 1.07.1 (pipe an expression, e.g. echo "2+2" | bc)';
      try { return String(new Function('return (' + ex + ')')()); } catch (e) { return 'bc: syntax error'; }
    };
    const backslash = text => text.replace(/\\(?:x([0-9a-f]{1,2})|0([0-7]{1,3})|([abefnrtv\\]))/gi,
      (_, hex, octal, simple) => hex ? String.fromCharCode(parseInt(hex, 16)) : octal ? String.fromCharCode(parseInt(octal, 8)) :
        ({ a: '\x07', b: '\b', e: '\x1b', f: '\f', n: '\n', r: '\r', t: '\t', v: '\v', '\\': '\\' })[simple.toLowerCase()]);
    C.printf = args => {
      const a = args.slice();
      let variable;
      if (a[0] === '-v') {
        variable = a.splice(0, 2)[1];
        if (!variable || !/^[A-Za-z_]\w*$/.test(variable)) return failure('bash: printf: expected a variable name', 2);
      }
      if (a[0] === '--') a.shift();
      if (!a.length) return failure('bash: printf: expected a format', 2);
      const format = backslash(a.shift());
      let index = 0, output = '', previous, invalid = false;
      do {
        previous = index;
        output += format.replace(/%%|%([sbdif])/g, (token, spec) => {
          if (!spec) return '%';
          const value = a[index++];
          if (spec === 's') return value ?? '';
          if (spec === 'b') return backslash(value ?? '');
          const numeric = value ?? '0';
          if (spec === 'f' && Number.isFinite(Number(numeric))) return Number(numeric).toFixed(6);
          if (/^[+-]?\d+$/.test(numeric)) {
            const digits = numeric.replace(/^[+-]/, '');
            if (!/^0[0-9]+$/.test(digits)) return BigInt(numeric).toString();
            if (/^0[0-7]+$/.test(digits)) return ((numeric[0] === '-' ? -1n : 1n) * BigInt('0o' + digits)).toString();
          }
          if (/^[+-]?0x[0-9a-f]+$/i.test(numeric)) return ((numeric[0] === '-' ? -1n : 1n) * BigInt(numeric.replace(/^[+-]/, ''))).toString();
          invalid = true;
          return '0';
        });
      } while (index > previous && index < a.length);
      if (variable) assign(variable, output);
      return { stdout: variable ? '' : output, stderr: invalid ? 'bash: printf: invalid number' : '', status: invalid ? 1 : 0 };
    };
    function test(args) {
      if (args.length < 2) return Boolean(args[0]);
      if (args[0] === '!') return !test(args.slice(1));
      if (args.length === 2) {
        const [op, path] = args;
        if (op === '-n' || op === '-z') return op === '-n' ? !!path : !path;
        const node = walk(resolve(path));
        switch (op) {
          case '-f': return node !== undefined && !isDir(node);
          case '-d': return !!isDir(node);
          case '-e': return node !== undefined;
          case '-s': return node !== undefined && !isDir(node) && textOf(node).length > 0;
          case '-r': case '-w': case '-x': return node !== undefined && !!(Unix.mode(node, isDir(node)) & { '-r': 0o400, '-w': 0o200, '-x': 0o100 }[op]);
          default: throw new Error(op + ': unary operator expected');
        }
      }
      const [left, op, right] = args;
      if (args.length !== 3) throw new Error('too many arguments');
      if (op === '=' || op === '==') return left === right;
      if (op === '!=') return left !== right;
      if (!/^-(eq|ne|lt|le|gt|ge)$/.test(op)) throw new Error(op + ': binary operator expected');
      if (![left, right].every(text => /^[+-]?\d+$/.test(text))) throw new Error('integer expression expected');
      const a = BigInt(left), b = BigInt(right);
      return { '-eq': a === b, '-ne': a !== b, '-lt': a < b, '-le': a <= b, '-gt': a > b, '-ge': a >= b }[op];
    }
    C.test = args => {
      try { return { status: test(args) ? 0 : 1 }; } catch (e) { return failure('bash: test: ' + e.message, 2); }
    };
    C['['] = args => args.at(-1) === ']' ? C.test(args.slice(0, -1)) : failure("bash: [: missing `]'", 2);
    C.xargs = (a, stdin) => {
      if (!stdin) return '';
      const items = stdin.trim().split(/\s+/).filter(Boolean);
      const target = a[0] || 'echo', rest = a.slice(1);
      const fn = C[target];
      return fn ? fn(rest.concat(items), null) : items.join(' ');
    };
    C.alias = a => {
      if (!a.length) return Object.entries(aliases).map(([k, v]) => "alias " + k + "='" + v + "'").join('\n');
      for (const x of a) { const i = x.indexOf('='); if (i > 0) aliases[x.slice(0, i)] = x.slice(i + 1).replace(/^['"]|['"]$/g, ''); }
      return '';
    };
    C.unalias = a => { for (const x of a) delete aliases[x]; return ''; };
    const BUILTINS = new Set(['cd', 'echo', 'printf', 'pwd', 'export', 'unset', 'set', 'alias', 'unalias', 'type', 'history', 'read', 'source', 'exit', 'true', 'false', 'test', 'local', 'return', 'shift', 'jobs', 'kill', 'umask']);
    C.type = a => a.map(x => aliases[x] ? x + " is aliased to `" + aliases[x] + "'" : functions?.has?.(x) ? x + ' is a function' :
      BUILTINS.has(x) ? x + ' is a shell builtin' : C[x] ? x + ' is /usr/bin/' + x : 'bash: type: ' + x + ': not found').join('\n');
    C.unset = a => {
      for (const name of a) { delete env[name]; exported.delete(name); }
      return '';
    };
    C.printenv = a => a.length ? { stdout: a.filter(name => exported.has(name) && Object.hasOwn(env, name)).map(name => env[name] + '\n').join(''),
      status: a.some(name => !exported.has(name) || !Object.hasOwn(env, name)) ? 1 : 0 } : C.env();
    C.set = args => {
      if (!args.length) return printVariables(Object.keys(env).sort());
      if (args[0] === '--') { positional = args.slice(1); return ''; }
      if (args.length === 2 && args[1] === 'pipefail' && ['-o', '+o'].includes(args[0])) {
        pipefail = args[0] === '-o';
        return '';
      }
      return failure('bash: set: unsupported option in this sandbox', 2);
    };
    C.chown = () => '';
    C.chgrp = () => '';
    C.umask = () => '0022';
    C.kill = a => a.length ? '(sent signal to PID ' + a[a.length - 1] + ')' : 'usage: kill [-9] <pid>';
    C.killall = a => a[0] ? '(terminated ' + a[0] + ')' : 'usage: killall <name>';
    C.pkill = C.killall;
    C.pgrep = a => { const q = (a[0] || '').toLowerCase(); return [{ p: 1, n: 'systemd' }, { p: 812, n: 'node' }, { p: 884, n: 'sshd' }, { p: 1102, n: 'bash' }].filter(x => x.n.includes(q)).map(x => x.p).join('\n'); };
    C.top = () => C.uptime() + '\nTasks:   5 total,   1 running,   4 sleeping\n%Cpu(s):  2.1 us,  0.4 sy, 97.5 id\n\n' + C.ps();
    C.htop = C.top;
    C.jobs = () => '';
    C.bg = () => 'bash: bg: current: no such job';
    C.fg = () => 'bash: fg: current: no such job';
    C.nohup = a => a.length ? run(a.join(' ')) : 'usage: nohup <command>';
    C.crontab = a => a.includes('-l') ? '# m h dom mon dow command\n0 3 * * * /home/dev/projects/deploy.sh --health' : 'crontab: use crontab -l to inspect scheduled jobs';
    C.systemctl = a => a[0] === 'status' ? '● ' + (a[1] || 'ssh') + '.service - Active: active (running) since Mon 2026-02-09' : 'UNIT            LOAD   ACTIVE SUB     DESCRIPTION\nssh.service     loaded active running OpenBSD Secure Shell\nnginx.service   loaded active running A high performance web server\ndocker.service  loaded active running Docker Application Container Engine';
    C.service = a => C.systemctl(['status', a[0] || 'ssh']);
    C.journalctl = () => read('/var/log/auth.log').text || '';
    C.dmesg = () => '[    0.000000] Linux version 5.15.0-91-generic (dev-box)\n[    1.412000] eth0: link up 1000Mbps full-duplex\n[    2.104000] EXT4-fs (vda1): mounted filesystem';
    C.sudo = a => a.includes('-l') ? 'User dev may run the following commands on dev-box:\n    (ALL : ALL) NOPASSWD: /usr/bin/systemctl' : (a.length ? run(a.join(' ')) : 'usage: sudo <command>');
    C.su = () => 'su: simulated sandbox — staying as dev';
    C.passwd = () => 'passwd: simulated sandbox — password unchanged';
    C.useradd = a => a[0] ? '(simulated user ' + a[0] + ' added)' : 'usage: useradd <name>';
    C.usermod = () => '(simulated usermod applied)';
    C.gunzip = a => { const f = a.find(x => !x.startsWith('-')) || ''; return f ? '(extracted ' + f.replace(/\.gz$/, '') + ')' : 'usage: gunzip <file.gz>'; };
    C.zcat = a => { const f = (a[0] || '').replace(/\.gz$/, ''); const r = read(f); return r.err ? '(compressed archive content)' : r.text; };
    C.zip = a => a[0] ? (put(resolve(a[0]), F('(zip archive)')), '  adding: ' + (a[1] || '.') + ' (deflated 42%)') : 'usage: zip <archive.zip> <file>';
    C.unzip = a => a[0] ? 'Archive:  ' + a[0] + '\n  inflating: extracted.txt' : 'usage: unzip <archive.zip>';
    C.bzip2 = C.gzip;
    C.xz = C.gzip;
    C.ss = () => 'Netid State  Local Address:Port   Peer Address:Port\ntcp   LISTEN 0.0.0.0:22           0.0.0.0:*\ntcp   LISTEN 0.0.0.0:80           0.0.0.0:*\ntcp   LISTEN 0.0.0.0:8080         0.0.0.0:*';
    C.netstat = C.ss;
    C.ip = a => a[0] && a[0].startsWith('r') ? 'default via 10.0.0.1 dev eth0\n10.0.0.0/24 dev eth0 proto kernel scope link src 10.0.0.5' : '1: lo: <LOOPBACK,UP> mtu 65536\n    inet 127.0.0.1/8 scope host lo\n2: eth0: <BROADCAST,MULTICAST,UP> mtu 1500\n    inet 10.0.0.5/24 brd 10.0.0.255 scope global eth0';
    C.ifconfig = C.ip;
    C.route = () => 'Kernel IP routing table\nDestination     Gateway         Genmask         Iface\n0.0.0.0         10.0.0.1        0.0.0.0         eth0\n10.0.0.0        0.0.0.0         255.255.255.0   eth0';
    C.arp = () => 'Address       HWtype  HWaddress           Iface\n10.0.0.1      ether   52:54:00:12:34:56   eth0\n10.0.0.9      ether   52:54:00:9a:bc:de   eth0';
    C.dig = a => { const h = a.find(x => !x.startsWith('-')) || 'api.internal'; return ';; ANSWER SECTION:\n' + h + '.\t300\tIN\tA\t10.0.0.5'; };
    C.nslookup = a => { const h = a.find(x => !x.startsWith('-')) || 'api.internal'; return 'Server:\t10.0.0.1\nName:\t' + h + '\nAddress: 10.0.0.5'; };
    C.host = a => (a[0] || 'api.internal') + ' has address 10.0.0.5';
    C.whois = a => 'Domain Name: ' + (a[0] || 'example.internal').toUpperCase() + '\nRegistrar: Sandbox NIC\nStatus: active';
    C.traceroute = a => 'traceroute to ' + (a[0] || '10.0.0.5') + '\n 1  gateway (10.0.0.1)  0.41 ms\n 2  ' + (a[0] || '10.0.0.5') + ' (10.0.0.5)  1.12 ms';
    C.wget = a => { const u = a.find(x => !x.startsWith('-')) || 'https://api.internal/health'; const body = C.curl([u]); const fn = u.split('/').pop() || 'index.html'; put(resolve(fn), F(body)); return 'Saving to: ‘' + fn + '’\n‘' + fn + '’ saved [' + body.length + '/' + body.length + ']'; };
    C.nc = a => 'Connection to ' + (a[0] || '10.0.0.5') + ' ' + (a[1] || '80') + ' port [tcp/*] succeeded!';
    C.ncat = C.nc;
    C.scp = a => a.length >= 2 ? 'Transferred ' + a[0] + ' -> ' + a[1] + ' (100%)' : 'usage: scp <src> <dst>';
    C.rsync = C.scp;
    C.ftp = a => 'Connected to ' + (a[0] || '10.0.0.5') + ' (simulated FTP).';
    C.openssl = a => 'OpenSSL 3.0.13 (sandbox) — ' + (a.join(' ') || 'ready');
    C.iptables = () => 'Chain INPUT (policy ACCEPT)\ntarget     prot opt source               destination\nACCEPT     tcp  --  0.0.0.0/0            0.0.0.0/0            tcp dpt:22';
    C.ufw = () => 'Status: active\nTo                         Action      From\n22/tcp                     ALLOW       Anywhere\n80/tcp                     ALLOW       Anywhere';
    C.more = (a, stdin) => C.cat(a, stdin);
    C.less = (a, stdin) => C.cat(a, stdin);
    C.view = (a, stdin) => C.cat(a, stdin);
    C.nano = a => a[0] ? '(simulated editor — use echo "..." > ' + a[0] + ' to write or cat ' + a[0] + ' to read)' : 'usage: nano <file>';
    C.vi = C.nano;
    C.vim = C.nano;
    C.ll = a => C.ls(['-la'].concat(a));
    C.la = a => C.ls(['-a'].concat(a));
    C.dir = a => C.ls(a);
    C.cls = () => '';
    C.exit = args => {
      if (!shellChild) return '(sandbox shell stays open — use reset to restore the disk)';
      if (args.length > 1) return failure('bash: exit: too many arguments');
      const value = args[0] ?? String(lastStatus);
      flow = 'exit';
      if (!/^[+-]?\d+$/.test(value)) return failure('bash: exit: numeric argument required', 2);
      return { status: Number(BigInt.asUintN(8, BigInt(value))) };
    };
    C.logout = C.exit;
    C.which = a => a.map(x => C[x] ? '/usr/bin/' + x : '').filter(Boolean).join('\n') || 'which: no ' + (a[0] || '') + ' in (/usr/local/bin:/usr/bin:/bin)';
    C.clear = () => '';
    C.reset = () => { reset(); return 'sandbox reset — the virtual disk is back to its first state'; };
    C.help = a => G.formatHelp('bash', a);

    function writeFile(p, text, append) {
      if (p === '/dev/null') return;
      if (!p) return ': No such file or directory';
      const parts = resolve(p);
      const old = walk(parts);
      if (isDir(old)) return p + ': Is a directory';
      const parent = walk(parts.slice(0, -1));
      if (!isDir(parent)) return p + ': No such file or directory';
      if (old !== undefined && !(Unix.mode(old) & 0o200)) return p + ': Permission denied';
      const key = parts.at(-1);
      Object.defineProperty(parent, key, { value: F((append && old !== undefined ? textOf(old) : '') + text,
        old !== undefined ? modeOf(old) : undefined), writable: true, enumerable: true, configurable: true });
    }

    function inSubshell(runChild) {
      const parent = { fs, cwd, prevCwd, env, aliases, hist, pipefail, lastStatus, functions, positional, exported, flow, loopDepth, functionDepth, argv0, shellChild };
      env = { ...env };
      aliases = { ...aliases };
      functions = new Map(functions);
      exported = new Set(exported);
      flow = ''; loopDepth = 0; shellChild++;
      try { return runChild(); }
      finally { ({ fs, cwd, prevCwd, env, aliases, hist, pipefail, lastStatus, functions, positional, exported, flow, loopDepth, functionDepth, argv0, shellChild } = parent); }
    }

    const listDir = dir => { const node = walk(resolve(dir)); return isDir(node) ? Object.keys(node) : []; };
    const parameterValue = name => {
      if (name === '?') return String(lastStatus);
      if (name === '#') return String(positional.length);
      if (name === '*' || name === '@') return positional.join(' ');
      if (name === '0') return argv0;
      if (/^\d+$/.test(name)) return positional[Number(name) - 1];
      return Object.hasOwn(env, name) ? env[name] : undefined;
    };
    const firstPart = (text, delimiter) => splitBash(text, [delimiter], true)?.[0];

    function expandWord(word, context, splitFields = true) {
      if (splitFields && !positional.length && /^"\$(?:@|\{@\})"$/.test(word)) return [];
      const field = () => ({ text: '', present: false, glob: false, protectedGlob: false });
      const fields = [field()];
      let quote = '';
      const append = (text, literal, present = true) => {
        const current = fields.at(-1);
        current.text += text;
        current.present ||= present;
        if (/[*?[]/.test(text)) {
          if (literal) current.protectedGlob = true;
          else current.glob = true;
        }
      };
      const separate = () => { if (fields.at(-1).present) fields.push(field()); };
      const insert = (value, name) => {
        if (name === '@' && quote === '"' && splitFields) {
          positional.forEach((arg, i) => { if (i) separate(); append(arg, true); });
        } else if (quote || !splitFields) append(value ?? '', true);
        else for (const chunk of String(value ?? '').match(/[ \t\n]+|[^ \t\n]+/g) || []) {
          if (/^[ \t\n]/.test(chunk)) separate();
          else append(chunk, false);
        }
      };
      for (let i = 0; i < word.length; i++) {
        const char = word[i], next = word[i + 1];
        if (char === quote) { quote = ''; continue; }
        if (quote === "'") { append(char, true); continue; }
        if (!quote && (char === '"' || char === "'")) { quote = char; append('', true); continue; }
        if (char === '\\' && next && (!quote || /["\\$`\n]/.test(next))) {
          i++;
          if (next !== '\n') append(next, true);
          continue;
        }
        if (char === '$' && word.slice(i + 1, i + 3) === '((') {
          const start = i + 3, fragment = word.slice(start);
          const end = firstPart(fragment, ')')?.end;
          if (end === undefined || fragment[end + 1] !== ')') throw new Error('unterminated arithmetic expansion');
          insert(String(arithmetic(fragment.slice(0, end), parameterValue, assign)));
          i = start + end + 1;
          continue;
        }
        if (char === '$' && next === '(' || char === '`') {
          const start = i + (char === '`' ? 1 : 2);
          const fragment = word.slice(start);
          const end = char === '`' ? fragment.search(/(?<!\\)`/) : firstPart(fragment, ')')?.end;
          if (!(end >= 0)) throw new Error('unterminated command substitution');
          const value = inSubshell(() => {
            let text = '';
            context.substitutionStatus = executeList(fragment.slice(0, end), context.stdin, context.depth + 1, bytes => { text += bytes; }, context.stderr);
            return text.replace(/\n+$/, '').replace(/\0/g, '');
          });
          insert(value);
          i = start + end;
          continue;
        }
        if (char === '$') {
          let source, length;
          if (next === '{') {
            const start = i + 2, fragment = word.slice(start);
            const end = firstPart(fragment, '}')?.end;
            if (end === undefined) throw new Error('bad substitution');
            source = fragment.slice(0, end);
            length = end + 3;
          } else {
            source = /^[A-Za-z_]\w*|^[?@*#\d]/.exec(word.slice(i + 1))?.[0];
            length = (source?.length || 0) + 1;
          }
          if (source !== undefined) {
            const match = /^(#)?([A-Za-z_]\w*|\d+|[?@*#])(?:(:?[-+=])(.*))?$/s.exec(source);
            if (!match) throw new Error('bad substitution');
            const [, lengthOnly, name, operator, fallback] = match;
            let value = parameterValue(name);
            if (lengthOnly) value = String([...(value ?? '')].length);
            if (operator) {
              const unset = value === undefined || operator.startsWith(':') && value === '';
              const action = operator.at(-1);
              if (action === '+' && unset) value = '';
              else if (action === '+' || unset) {
                value = expandWord(fallback, context, false).join('');
                if (action === '=') {
                  if (!/^[A-Za-z_]\w*$/.test(name)) throw new Error('cannot assign to ' + name);
                  assign(name, value);
                }
              }
            }
            insert(value, operator ? undefined : name);
            i += length - 1;
            continue;
          }
        }
        append(char, Boolean(quote));
      }
      return fields.filter(item => item.present).flatMap(item =>
        splitFields && item.glob && !item.protectedGlob ? G.expandGlob(item.text, listDir) : [item.text]);
    }

    function wordSources(text) {
      return (splitBash(text, [' ', '\t', '\n']) || []).map(part => part.text).filter(Boolean);
    }
    function expandWords(text, context) {
      return wordSources(text).flatMap(word => {
        const words = /["'\\$`]/.test(word) ? [word] : G.expandBraces(word);
        return words.flatMap(item => expandWord(item, context));
      });
    }
    function assign(name, value) {
      Object.defineProperty(env, name, { value, enumerable: true, writable: true, configurable: true });
    }

    const lineOutput = text => text && !text.endsWith('\n') ? text + '\n' : text;
    const byteCommands = new Set(['echo', 'printf', 'cat', 'more', 'less', 'view', 'head', 'tail', 'tr', 'base64', 'xxd', 'rot13', 'rev']);
    const inputOf = text => ({ text, offset: 0 });
    const inputCommands = new Set(['grep', 'wc', 'sort', 'uniq', 'cut', 'sed', 'awk', 'tr', 'base64', 'xxd', 'head', 'tail', 'tac',
      'rev', 'rot13', 'paste', 'tee', 'xargs', 'md5sum', 'sha1sum', 'sha256sum', 'jq']);
    C.let = args => {
      if (!args.length) return failure('bash: let: expression argument required', 2);
      let value;
      for (const expression of args) value = arithmetic(expression, parameterValue, assign);
      return { status: Number(value === 0n) };
    };

    C.return = args => {
      if (!functionDepth) return failure('bash: return: can only return from a function in this sandbox');
      if (args.length > 1) return failure('bash: return: too many arguments');
      const value = args[0] ?? String(lastStatus);
      if (!/^[+-]?\d+$/.test(value)) return failure('bash: return: numeric argument required', 2);
      flow = 'return';
      return { status: Number(BigInt.asUintN(8, BigInt(value))) };
    };
    for (const action of ['break', 'continue']) {
      C[action] = args => {
        if (!loopDepth || args.length && (args.length !== 1 || args[0] !== '1')) return failure('bash: ' + action + ': expected an enclosing loop');
        flow = action;
        return { status: 0 };
      };
    }

    function runControl(control, input, context, stdout, stderr) {
      const [, keyword, body] = control;
      const execute = text => executeList(text, input, context.depth + 1, stdout, stderr);
      if (keyword === 'if') {
        const branches = splitBash(body, ['then', 'elif', 'else'], false, true);
        if (!branches || branches[0].operator !== 'then') throw new Error('expected then in if command');
        for (let i = 0; i < branches.length; i += 2) {
          if (branches[i].operator !== 'then' || !branches[i + 1]) throw new Error('invalid if command');
          const status = execute(branches[i].text);
          if (flow) return status;
          if (status === 0) return execute(branches[i + 1].text);
          if (branches[i + 1].operator === 'else') return execute(branches[i + 2].text);
        }
        return 0;
      }
      const parts = splitBash(body, ['do'], false, true);
      if (parts?.length !== 2) throw new Error('expected do in loop');
      const [{ text: header }, { text: commands }] = parts;
      if (!header || !commands) throw new Error('expected commands in loop');
      let variable, words, counter;
      if (keyword === 'for') {
        const clause = header.replace(/;\s*$/, '').trim();
        const expression = /^\(\(([\s\S]*)\)\)$/.exec(clause);
        if (expression) {
          const expressions = splitBash(expression[1], [';']);
          if (expressions?.length !== 3) throw new Error('expected three arithmetic for clauses');
          const [init, test, step] = expressions.map(part => part.text);
          arithmetic(init, parameterValue, assign);
          counter = { test, step };
        } else {
          const match = /^([A-Za-z_]\w*)(?:\s+(in)(?:\s+([\s\S]*))?)?$/.exec(clause);
          if (!match) throw new Error('invalid for loop');
          variable = match[1];
          words = match[2] ? expandWords(match[3] || '', context) : positional.slice();
        }
      }
      loopDepth++;
      let status = 0, index = 0;
      try {
        for (;;) {
          if (--steps < 0) {
            stderr('bash: sandbox execution limit exceeded\n');
            flow = 'limit';
            return 2;
          }
          if (counter) {
            if (index++) arithmetic(counter.step, parameterValue, assign);
            if (counter.test && arithmetic(counter.test, parameterValue, assign) === 0n) break;
          } else if (words) {
            if (index >= words.length) break;
            assign(variable, words[index++]);
          } else {
            const condition = execute(header);
            if (flow && !['break', 'continue'].includes(flow)) return condition;
            if (flow === 'break') { flow = ''; break; }
            if (flow === 'continue') { flow = ''; continue; }
            if ((condition === 0) !== (keyword === 'while')) break;
          }
          status = execute(commands);
          if (flow && !['break', 'continue'].includes(flow)) break;
          if (flow === 'break') { flow = ''; break; }
          if (flow === 'continue') flow = '';
        }
      } finally { loopDepth--; }
      return status;
    }

    function readLine(args, input) {
      const names = args[0] === '-r' ? args.slice(1) : args;
      if (names.some(name => !/^[A-Za-z_]\w*$/.test(name))) return failure('bash: read: expected variable names', 2);
      const available = input?.text.slice(input.offset) ?? '';
      const newline = available.indexOf('\n');
      const length = newline < 0 ? available.length : newline;
      if (input) input.offset += length + Number(newline >= 0);
      const value = available.slice(0, length);
      const line = args[0] === '-r' ? value : value.replace(/\\(.)/g, '$1');
      if (!names.length) assign('REPLY', line);
      else {
        const separators = parameterValue('IFS') ?? ' \t\n';
        if (!separators) {
          names.forEach((name, i) => assign(name, i ? '' : line));
          return { status: newline < 0 ? 1 : 0 };
        }
        const isSpace = char => char !== undefined && /[ \t\n]/.test(char) && separators.includes(char);
        const fields = line.replace(/^[ \t]+|[ \t]+$/g, '');
        let rest = /^[ \t\n]+$/.test(separators) ? fields : line;
        names.forEach((name, index) => {
          const end = index < names.length - 1 ? [...rest].findIndex(char => separators.includes(char)) : -1;
          assign(name, end < 0 ? rest : [...rest].slice(0, end).join(''));
          rest = end < 0 ? '' : [...rest].slice(end + 1).join('');
          while (isSpace(rest[0])) rest = rest.slice(1);
        });
      }
      return { status: newline < 0 ? 1 : 0 };
    }

    function runStage(text, stdin, depth, stdout, stderr, pipeStderr) {
      const context = { depth, stderr, stdin, substitutionStatus: undefined };
      const readWords = input => expandWords(input, context);
      const parts = splitBash(text, ['2>&1', '1>&2', '>&2', '2>>', '1>>', '2>', '1>', '>>', '>', '<<<', '<'], false, true);
      const commandText = parts[0].text;
      const signature = /^(?:function\s+([A-Za-z_]\w*)(?:\s*\(\s*\))?\s+|([A-Za-z_]\w*)\s*\(\s*\)\s*)(\{\s[\s\S]*\})$/.exec(commandText);
      if (signature) {
        const [, named, conventional, body] = signature;
        functions.set(named || conventional, { body, redirections: text.slice(commandText.length) });
        return 0;
      }
      const group = /^(?:\(\s*([\s\S]*)\)|\{\s([\s\S]*[;\n])\s*\})$/.exec(commandText);
      const expression = /^\(\(([\s\S]*)\)\)$/.exec(commandText);
      const control = /^(?:(if)\s+([\s\S]+)\s+fi|(for|while|until)\s+([\s\S]+)\s+done)$/.exec(commandText);
      const sourceWords = group || control ? [] : wordSources(commandText);
      const assignments = [];
      while (sourceWords.length) {
        const assignment = /^([A-Za-z_]\w*)=([\s\S]*)$/.exec(sourceWords[0]);
        if (!assignment) break;
        assignments.push([assignment[1], expandWord(assignment[2], context, false).join('')]);
        sourceWords.shift();
      }
      const words = readWords(sourceWords.join(' '));
      for (let i = 1; i < parts.length; i++) {
        const operator = parts[i - 1].operator;
        if (operator === '2>&1') { stderr = stdout; words.push(...readWords(parts[i].text)); continue; }
        if (operator.endsWith('>&2')) { stdout = stderr; words.push(...readWords(parts[i].text)); continue; }
        const [targetWord, ...operands] = wordSources(parts[i].text);
        if (targetWord === undefined) { stderr('bash: syntax error near unexpected token `newline\'\n'); return 2; }
        if (operator === '<<<') {
          stdin = inputOf(expandWord(targetWord, context, false).join('') + '\n');
          words.push(...readWords(operands.join(' ')));
          continue;
        }
        const targets = readWords(targetWord);
        if (targets.length !== 1) { stderr('bash: ' + targetWord + ': ambiguous redirect\n'); return 1; }
        const [file] = targets;
        words.push(...readWords(operands.join(' ')));
        if (operator === '<') {
          const input = read(file);
          if (input.err) { stderr(lineOutput('bash: ' + input.err)); return 1; }
          stdin = inputOf(input.text);
          continue;
        }
        const err = writeFile(file, '', operator.endsWith('>>'));
        if (err) { stderr(lineOutput('bash: ' + err)); return 1; }
        const sink = bytes => writeFile(file, bytes, true);
        if (operator.startsWith('2')) stderr = sink;
        else stdout = sink;
      }
      if (pipeStderr) stderr = stdout;
      if (expression) return Number(arithmetic(expression[1], parameterValue, assign) === 0n);
      if (group) {
        const execute = () => executeList(group[1] ?? group[2], stdin, depth + 1, stdout, stderr);
        return group[1] !== undefined ? inSubshell(execute) : execute();
      }
      if (control) return runControl([control[0], control[1] || control[3], control[2] || control[4]], stdin, context, stdout, stderr);
      if (!words.length) {
        for (const [name, value] of assignments) assign(name, value);
        return context.substitutionStatus ?? 0;
      }
      if (Object.hasOwn(aliases, words[0])) words.splice(0, 1, ...readWords(aliases[words[0]]));
      const command = words.shift();
      if (assignments.length) {
        const original = new Map(assignments.map(([name]) => [name, [parameterValue(name), exported.has(name)]]));
        for (const [name, value] of assignments) { assign(name, value); exported.add(name); }
        try { return invoke(command, words, stdin, depth, stdout, stderr); }
        finally {
          for (const [name, [value, wasExported]] of original) {
            if (value === undefined) delete env[name];
            else assign(name, value);
            if (!wasExported) exported.delete(name);
          }
        }
      }
      return invoke(command, words, stdin, depth, stdout, stderr);
    }

    function invoke(command, words, stdin, depth, stdout, stderr) {
      const definition = functions.get(command);
      if (definition) {
        const caller = positional;
        positional = words;
        functionDepth++;
        try { return executeList(definition.body + definition.redirections, stdin, depth + 1, stdout, stderr); }
        finally { positional = caller; functionDepth--; if (flow === 'return') flow = ''; }
      }
      if (command === 'source' || command === '.') {
        const [file, ...args] = words;
        if (!file) { stderr('bash: source: filename argument required\n'); return 2; }
        const script = read(file);
        if (script.err) { stderr('bash: ' + script.err + '\n'); return 1; }
        const caller = positional;
        if (args.length) positional = args;
        functionDepth++;
        try { return executeList(script.text, stdin, depth + 1, stdout, stderr); }
        finally { if (args.length) positional = caller; functionDepth--; if (flow === 'return') flow = ''; }
      }
      if (command === 'bash' || command === 'sh' || command.includes('/')) {
        return runScript(command, words, stdin, depth, stdout, stderr);
      }
      const fn = C[command];
      if (!fn && command !== 'read') { stderr(lineOutput('bash: ' + command + ': command not found')); return 127; }
      let result;
      try {
        if (command === 'read') result = readLine(words, stdin);
        else {
          const bytes = stdin?.text.slice(stdin.offset) ?? null;
          if (stdin && (inputCommands.has(command) || fn === C.cat && (!words.some(word => !word.startsWith('-')) || words.includes('-')))) stdin.offset = stdin.text.length;
          result = fn(words, bytes);
        }
      }
      catch (e) { result = failure(command + ': ' + e.message); }
      if (typeof result === 'string') stdout(byteCommands.has(command) ? result : lineOutput(result));
      else if (result) {
        if (result.stderr) stderr(lineOutput(result.stderr));
        if (result.stdout) stdout(byteCommands.has(command) ? result.stdout : lineOutput(result.stdout));
        return result.status ?? 0;
      }
      return 0;
    }

    function runScript(command, args, stdin, depth, stdout, stderr) {
      const name = command.split('/').at(-1);
      const explicitShell = ['bash', 'sh', '/bin/bash', '/bin/sh', '/usr/bin/bash', '/usr/bin/sh'].includes(command);
      let file, text, parameters;
      if (explicitShell) {
        const skip = args.findIndex(arg => !['--noprofile', '--norc'].includes(arg));
        const options = skip < 0 ? [] : args.slice(skip);
        if (options[0] === '-c' && options.length >= 2) {
          [, text, file = command, ...parameters] = options;
        } else if (options[0] === '-s' || !options.length) {
          file = name;
          text = stdin?.text.slice(stdin.offset) ?? '';
          if (stdin) stdin.offset = stdin.text.length;
          parameters = options.slice(1);
          if (parameters[0] === '--') parameters.shift();
        } else if (options[0].startsWith('-')) {
          stderr('bash: ' + options[0] + ': unsupported option in this sandbox\n'); return 2;
        } else [file, ...parameters] = options;
      } else {
        file = command;
        parameters = args;
        const node = walk(resolve(file));
        if (node === undefined) { stderr('bash: ' + file + ': No such file or directory\n'); return 127; }
        if (isDir(node) || !(Unix.mode(node) & 0o100)) { stderr('bash: ' + file + ': cannot execute\n'); return 126; }
      }
      if (text === undefined) {
        const script = read(file);
        if (script.err) { stderr('bash: ' + script.err + '\n'); return /Permission denied|Is a directory/.test(script.err) ? 126 : 127; }
        text = script.text;
      }
      if (!explicitShell && text.startsWith('#!') && !/^#!\s*(?:\/[^\s]*\/)?(?:bash|sh)(?:\s|$)|^#!\s*\/[^\s]*\/env\s+(?:bash|sh)(?:\s|$)/.test(text)) {
        stderr('bash: ' + file + ': unsupported script interpreter\n'); return 126;
      }
      return inSubshell(() => {
        argv0 = file;
        positional = parameters;
        env = Object.fromEntries(Object.entries(env).filter(([key]) => exported.has(key)));
        functions.clear();
        functionDepth = 0;
        pipefail = false;
        return executeList(text, stdin, depth + 1, stdout, stderr);
      });
    }

    function executeList(line, input, depth, writeOutput, writeError, trace) {
      const raw = String(line == null ? '' : line).trim();
      if (!raw) return 0;
      if (depth > 32) { writeError('bash: sandbox nesting limit exceeded\n'); return lastStatus = 2; }
      const parts = splitBash(raw, ['&&', '||', ';', '\n'], false, true);
      const list = parts && [];
      for (const part of parts || []) {
        if (!part.text && part.operator === '\n') continue;
        const previous = list.at(-1);
        if (previous?.operator === '\n' && !splitBash(previous.text, ['|&', '|'], false, true)?.at(-1)?.text) {
          previous.text += ' ' + part.text;
          previous.operator = part.operator;
        } else list.push(part);
      }
      if (list?.length === 1 && !list[0].text && !list[0].operator) return lastStatus;
      if (!list || list.some(({ text, operator }, i) => !text && (operator || i === 0 || ![';', '\n'].includes(list[i - 1].operator)))) {
        lastStatus = 2;
        writeError('bash: syntax error in command list\n');
        return lastStatus;
      }
      const pipelines = list.filter(part => part.text).map(({ text, operator }) => {
        const stages = splitBash(text, ['|&', '|'], false, true);
        const inverted = /^!\s/.test(stages[0].text);
        if (inverted) stages[0].text = stages[0].text.slice(1).trim();
        return { operator, stages, inverted };
      });
      if (pipelines.some(pipeline => pipeline.stages.some(stage => !stage.text))) {
        lastStatus = 2;
        writeError('bash: syntax error near pipe\n');
        return lastStatus;
      }
      let previous = '';
      for (const { operator, stages, inverted } of pipelines) {
        const skip = (previous === '&&' && lastStatus !== 0) || (previous === '||' && lastStatus === 0);
        previous = operator;
        if (skip) {
          trace?.push({ skipped: true, stages: stages.map(stage => ({ command: stage.text })) });
          continue;
        }
        let stdin = input;
        const statuses = [];
        for (let i = 0; i < stages.length; i++) {
          if (--steps < 0) {
            writeError('bash: sandbox execution limit exceeded\n');
            flow = 'limit';
            return lastStatus = 2;
          }
          let buffer = '';
          const stdout = i === stages.length - 1 ? writeOutput : bytes => { buffer += bytes; };
          const execute = () => {
            try { return runStage(stages[i].text, stdin, depth, stdout, writeError, stages[i].operator === '|&'); }
            catch (e) { writeError('bash: ' + e.message + '\n'); return 2; }
          };
          statuses.push(stages.length === 1 ? execute() : inSubshell(execute));
          stdin = inputOf(buffer);
        }
        const status = pipefail ? statuses.findLast(code => code !== 0) ?? 0 : statuses.at(-1);
        lastStatus = inverted ? Number(status === 0) : status;
        trace?.push({
          status: lastStatus, pipefail, inverted,
          stages: stages.map((stage, i) => ({ command: stage.text, pipe: stage.operator, status: statuses[i] }))
        });
        if (flow) break;
      }
      return lastStatus;
    }

    // Bash history expansion: !! (last command), !n (entry n), !-n (n back) and !word (latest that starts with word).
    // Like bash, an expanded line is echoed before it runs; quotes and single ! stay literal.
    function expandHistory(raw) {
      if (!/!(?:!|-?\d+|[A-Za-z_][\w.-]*)/.test(raw) || /^'.*'$/.test(raw)) return { line: raw };
      let failed = '';
      const line = raw.replace(/(^|[^\\'])!(!|-?\d+|[A-Za-z_][\w.-]*)/g, (all, before, ref) => {
        if (failed) return all;
        let hit;
        if (ref === '!') hit = hist.at(-1);
        else if (/^-\d+$/.test(ref)) hit = hist.at(Number(ref));
        else if (/^\d+$/.test(ref)) hit = hist[Number(ref) - 1];
        else hit = [...hist].reverse().find(entry => entry.startsWith(ref));
        if (hit == null) { failed = '!' + ref; return all; }
        return before + hit;
      });
      return failed ? { error: 'bash: ' + failed + ': event not found' } : { line, echo: line !== raw };
    }

    /* ---- The office network: fictional PCs on 192.168.56.0/24. nmap finds them, ssh logs in to them (the prompt, files,
       whoami and every other command then work on that PC's own disk), exit comes back, and scp copies files between
       machines. Each PC is a simulated disk saved with this sandbox; nothing here touches a real network or a real PC.
       The way in: the kiosk's web page shows its login, a ticket on the kiosk holds maria's password, and maria's
       ssh key opens the NAS. ---- */
    var LAN_HOSTS, lanDisks, lanKnown, sessions, pendingAuth, here;
    function lanSeed() {
      const os = { ubuntu: 'NAME="Ubuntu"\nVERSION="22.04.4 LTS (Jammy Jellyfish)"\nID=ubuntu\nPRETTY_NAME="Ubuntu 22.04.4 LTS"\n',
        debian: 'NAME="Debian GNU/Linux"\nVERSION="11 (bullseye)"\nID=debian\nPRETTY_NAME="Debian GNU/Linux 11 (bullseye)"\n' };
      const disk = (name, user, release, home, extra) => Object.assign({
        etc: { hostname: F(name + '\n'), 'os-release': F(release),
          passwd: F('root:x:0:0:root:/root:/bin/bash\n' + user + ':x:1000:1000:' + user + ':/home/' + user + ':/bin/bash\n') },
        home: { [user]: home }, tmp: {},
        var: { log: { 'auth.log': F('Nov 19 17:02:11 ' + name + ' sshd[702]: Accepted password for ' + user + ' from 192.168.56.1 port 50122 ssh2\n') } }
      }, extra || {});
      return {
        '192.168.56.1': { name: 'gateway', mac: '52:54:00:4e:01:01', ports: [[53, 'domain', 'dnsmasq 2.86'], [80, 'http', 'lighttpd 1.4.59']],
          web: '<html><title>Router</title><body><h1>Office router</h1><p>Admin sign-in is turned off on the LAN.</p></body></html>' },
        '192.168.56.10': { name: 'ws-maria', mac: '52:54:00:4e:01:0a', ports: [[22, 'ssh', 'OpenSSH 8.9p1 Ubuntu 3ubuntu0.6'], [631, 'ipp', 'CUPS 2.4']], users: { maria: 'Spring2026!' },
          fs: disk('ws-maria', 'maria', os.ubuntu, {
            Documents: { 'todo.txt': F('- send the Q3 budget to Dana\n- change my password (IT reset it!)\n- back up photos to the NAS\n'),
              'budget-2026.csv': F('item,amount\nlaptops,4200\nprinter toner,310\ncoffee,95\n') },
            Desktop: { 'shortcuts.txt': F('NAS: ssh backup@nas-01 (my key works, no password)\n') },
            '.ssh': { id_ed25519: F('-----BEGIN OPENSSH PRACTICE KEY-----\n(simulated key for the sandbox, not a real one)\n-----END OPENSSH PRACTICE KEY-----\n', '600'),
              'id_ed25519.pub': F('ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAAISIMULATED maria@ws-maria\n'), known_hosts: F('nas-01 ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAANAS\n') } }) },
        '192.168.56.20': { name: 'nas-01', mac: '52:54:00:4e:01:14', ports: [[22, 'ssh', 'OpenSSH 8.4p1 Debian 5+deb11u3'], [445, 'microsoft-ds', 'Samba smbd 4.13']],
          users: { backup: null }, keys: ['maria@ws-maria'],
          fs: disk('nas-01', 'backup', os.debian, { 'README.txt': F('Nightly backups land in /srv/backups.\n') },
            { srv: { backups: { 'photos-2026-10.tar.gz': F('(archive)\n'), 'finance-2026-q3.zip': F('(archive)\n') } } }) },
        '192.168.56.30': { name: 'kiosk-3', mac: '52:54:00:4e:01:1e', ports: [[22, 'ssh', 'OpenSSH 8.9p1 Ubuntu 3ubuntu0.6'], [80, 'http', 'nginx 1.18.0']], users: { guest: 'guest' },
          web: '<html><title>Lobby kiosk</title><body><h1>Lobby kiosk</h1><p>Staff maintenance login: guest / guest</p></body></html>',
          fs: disk('kiosk-3', 'guest', os.ubuntu, { Desktop: { 'it-ticket.txt': F('Ticket #4471 (closed)\nReset the password for maria (ws-maria) to: Spring2026!\nAsked her to change it at next login.\n') },
            'welcome.txt': F('Welcome to the lobby kiosk.\n') }) }
      };
    }
    const lanHosts = () => LAN_HOSTS || (LAN_HOSTS = lanSeed());
    function lanReset() {
      lanDisks = Object.fromEntries(Object.entries(lanSeed()).filter(([, h]) => h.fs).map(([ip, h]) => [ip, h.fs]));
      lanKnown = []; sessions = []; pendingAuth = null;
      here = { user: 'dev', host: 'dev-box', ip: '192.168.56.40' };
      HOME.splice(0, HOME.length, 'home', 'dev');
    }
    const findHost = name => {
      const n = String(name || '').toLowerCase().replace(/\.(lan|local)$/, '');
      return Object.entries(lanHosts()).find(([ip, h]) => ip === n || h.name === n) || null;
    };
    const clock = () => 'Nov 20 ' + new Date().toTimeString().slice(0, 8);
    const authLog = (disk, host, line) => { const log = disk?.var?.log?.['auth.log']; if (log && !isDir(log)) log.text += clock() + ' ' + host + ' sshd[' + (900 + Math.floor(Math.random() * 99)) + ']: ' + line + '\n'; };
    const greet = (ip, label) => {
      if (lanKnown.includes(ip)) return '';
      lanKnown.push(ip);
      return 'Warning: Permanently added \'' + label + '\' (ED25519) to the list of known hosts.\n';
    };
    function login(ip, user, how) {
      const host = lanHosts()[ip];
      sessions.push({ fs, cwd, prevCwd, env, home: HOME.slice(), here });
      authLog(lanDisks[ip], host.name, 'Accepted ' + how + ' for ' + user + ' from ' + here.ip + ' port ' + (50000 + Math.floor(Math.random() * 9000)) + ' ssh2');
      fs = lanDisks[ip];
      HOME.splice(0, HOME.length, 'home', user);
      if (!isDir(walk(HOME))) put(HOME.slice(), {});
      cwd = HOME.slice(); prevCwd = null;
      env = Object.assign({}, env, { USER: user, LOGNAME: user, HOME: '/home/' + user, PWD: '/home/' + user, HOSTNAME: host.name });
      here = { user, host: host.name, ip };
    }
    function logout() {
      const left = here.host, s = sessions.pop();
      ({ fs, cwd, prevCwd, env } = s);
      HOME.splice(0, HOME.length, ...s.home);
      here = s.here;
      return 'logout\nConnection to ' + left + ' closed.';
    }
    const askPassword = (user, label, check, done) => {
      pendingAuth = { prompt: user + '@' + label + '\'s password: ', user, label, check, done, tries: 0 };
    };
    function answerAuth(typed) {
      const p = pendingAuth;
      if (p.check(typed)) { pendingAuth = null; return p.done(); }
      if (++p.tries >= 3) { pendingAuth = null; lastStatus = 255; return p.user + '@' + p.label + ': Permission denied (publickey,password).'; }
      return 'Permission denied, please try again.';
    }
    /* runs fn once this machine may log in as user@host: at once with a trusted key, after a password otherwise */
    function withAccess(ip, user, label, fn) {
      const host = lanHosts()[ip];
      const warn = greet(ip, label);
      if ((host.keys || []).includes(here.user + '@' + here.host)) return warn + fn('publickey');
      if (host.users && Object.hasOwn(host.users, user) && host.users[user] == null) return failure(warn + user + '@' + label + ': Permission denied (publickey).', 255);
      askPassword(user, label, typed => !!host.users && Object.hasOwn(host.users, user) && host.users[user] === typed, () => fn('password'));
      return warn.replace(/\n$/, '');
    }
    const sshOpen = host => host.ports.some(p => p[0] === 22);
    const sshLocal = C.ssh;
    C.ssh = a => {
      const rest = [];
      let port = 22;
      for (let i = 0; i < a.length; i++) {
        if (a[i] === '-p') port = Number(a[++i]);
        else if (/^-[iolFJ]$/.test(a[i])) i++;
        else if (!a[i].startsWith('-')) rest.push(a[i]);
      }
      if (!rest.length) return failure('usage: ssh [-p port] [user@]hostname [command]', 255);
      const target = rest.shift();
      const at = target.lastIndexOf('@');
      const user = at > 0 ? target.slice(0, at) : here.user, name = at > 0 ? target.slice(at + 1) : target;
      const found = findHost(name);
      if (!found) return /^192\.168\.56\./.test(name) ? failure('ssh: connect to host ' + name + ' port ' + port + ': No route to host', 255)
        : /^(dev-box|localhost|127\.0\.0\.1|10\.0\.0\.5)$/i.test(name) ? sshLocal(a) : failure('ssh: Could not resolve hostname ' + name + ': Name or service not known', 255);
      const [ip, host] = found;
      if (port !== 22 || !sshOpen(host)) return failure('ssh: connect to host ' + name + ' port ' + port + ': Connection refused', 255);
      return withAccess(ip, user, name, how => {
        if (rest.length) {      // ssh host command: run it there and come straight back
          login(ip, user, how);
          let out = '';
          try { out = run(rest.join(' ')); } finally { logout(); }
          return out;
        }
        login(ip, user, how);
        return 'Welcome to ' + (host.name === 'nas-01' ? 'Debian GNU/Linux 11' : 'Ubuntu 22.04.4 LTS') + ' (GNU/Linux 5.15.0-91-generic x86_64)\n\nLast login: Thu Nov 19 17:02:11 2026 from 192.168.56.1';
      });
    };
    const cpLocal = C.cp;
    C.scp = a => {
      const flags = a.filter(x => x.startsWith('-')).join(''), paths = a.filter(x => !x.startsWith('-'));
      const recursive = /r/.test(flags);
      if (paths.length < 2) return failure('usage: scp [-r] source ... target');
      const parse = s => { const m = /^(?:([^@:\s]+)@)?([^:\s/]+):(.*)$/.exec(s); return m ? { user: m[1] || here.user, name: m[2], path: m[3] } : { path: s }; };
      const dst = parse(paths.pop()), srcs = paths.map(parse);
      const far = [dst, ...srcs].filter(x => x.name);
      if (!far.length) return cpLocal((recursive ? ['-r'] : []).concat(paths, dst.path));
      if (new Set(far.map(x => x.name + '@' + x.user)).size > 1 || (dst.name && srcs.some(x => x.name))) return failure('scp: copy between this machine and one other PC at a time');
      const { user, name } = far[0];
      const found = findHost(name);
      if (!found) return failure('ssh: Could not resolve hostname ' + name + ': Name or service not known\nscp: Connection closed', 255);
      const [ip, host] = found;
      if (!sshOpen(host)) return failure('ssh: connect to host ' + name + ' port 22: Connection refused\nscp: Connection closed', 255);
      const farDisk = lanDisks[ip];
      const farParts = p => {
        p = String(p || '').replace(/^~\/?/, '');
        const parts = p.startsWith('/') ? [] : ['home', user];
        for (const s of p.split('/')) { if (!s || s === '.') continue; if (s === '..') parts.pop(); else parts.push(s); }
        return parts;
      };
      const walkIn = (root, parts) => { let n = root; for (const s of parts) { if (!isDir(n) || !Object.hasOwn(n, s)) return undefined; n = n[s]; } return n; };
      const copy = () => {
        const lines = [];
        const dstRoot = dst.name ? farDisk : fs, dstParts = dst.name ? farParts(dst.path) : resolve(dst.path);
        for (const s of srcs) {
          const node = s.name ? walkIn(farDisk, farParts(s.path)) : walk(resolve(s.path));
          const label = s.name ? s.name + ':' + s.path : s.path;
          if (node === undefined) { lines.push('scp: ' + label + ': No such file or directory'); continue; }
          if (isDir(node) && !recursive) { lines.push('scp: ' + label + ': not a regular file'); continue; }
          const base = (s.path.replace(/\/+$/, '').split('/').pop()) || 'file';
          const into = walkIn(dstRoot, dstParts);
          const parts = isDir(into) ? dstParts.concat(base) : dstParts;
          const parent = walkIn(dstRoot, parts.slice(0, -1));
          if (!isDir(parent)) { lines.push('scp: ' + (dst.name ? dst.name + ':' : '') + dst.path + ': No such file or directory'); continue; }
          parent[parts[parts.length - 1]] = JSON.parse(JSON.stringify(node));
          const size = isDir(node) ? 4096 : textOf(node).length;
          lines.push(base.padEnd(32) + ' 100% ' + String(size >= 1024 ? (size / 1024).toFixed(1) + 'KB' : size).padStart(7) + '   ' + (Math.max(size, 900) / 1024 / 0.4).toFixed(1).padStart(5) + 'KB/s   00:00');
        }
        authLog(farDisk, host.name, 'Accepted password for ' + user + ' from ' + here.ip + ' port ' + (50000 + Math.floor(Math.random() * 9000)) + ' ssh2');
        return lines.join('\n');
      };
      return withAccess(ip, user, name, () => copy());
    };
    const nmapLocal = C.nmap, pingLocal = C.ping, curlLocal = C.curl, idLocal = C.id, unameLocal = C.uname, exitLocal = C.exit;
    const portTable = host => ['PORT     STATE SERVICE      VERSION'].concat(host.ports.map(([n, s, v]) => (n + '/tcp').padEnd(9) + 'open  ' + s.padEnd(13) + v));
    C.nmap = a => {
      const target = a.find(x => !x.startsWith('-')) || '';
      const sweep = /^192\.168\.56\.(0\/24|\*|1-254|0-255)$/.test(target), list = a.includes('-sn');
      if (sweep) {
        const out = ['Starting Nmap 7.94 ( https://nmap.org ) at 2026-11-20 ' + new Date().toTimeString().slice(0, 5) + ' UTC'];
        for (const [ip, h] of Object.entries(lanHosts())) {
          out.push('Nmap scan report for ' + h.name + '.lan (' + ip + ')', 'Host is up (0.00' + (2 + ip.length % 7) + 's latency).');
          if (!list) out.push(...portTable(h));
          out.push('MAC Address: ' + h.mac.toUpperCase() + ' (QEMU virtual NIC)');
        }
        out.push('Nmap scan report for dev-box.lan (192.168.56.40)', 'Host is up.', 'Nmap done: 256 IP addresses (5 hosts up) scanned in 2.31 seconds');
        return out.join('\n');
      }
      const found = findHost(target);
      if (found) {
        const [ip, h] = found;
        return ['Starting Nmap 7.94 ( https://nmap.org )', 'Nmap scan report for ' + h.name + '.lan (' + ip + ')', 'Host is up (0.0031s latency).',
          'Not shown: ' + (1000 - h.ports.length) + ' closed tcp ports (reset)', ...portTable(h), 'MAC Address: ' + h.mac.toUpperCase() + ' (QEMU virtual NIC)',
          'Service Info: OS: Linux', '', 'Nmap done: 1 IP address (1 host up) scanned in 1.12 seconds'].join('\n');
      }
      if (/^192\.168\.56\./.test(target)) return 'Starting Nmap 7.94 ( https://nmap.org )\nNote: Host seems down. If it is really up, but blocking our ping probes, try -Pn\nNmap done: 1 IP address (0 hosts up) scanned in 3.04 seconds';
      return nmapLocal(a);
    };
    C.ping = (a, stdin) => {
      const target = a.find(x => !x.startsWith('-')) || '';
      const found = findHost(target);
      if (!found) return /^192\.168\.56\./.test(target) ? failure('PING ' + target + ' 56(84) bytes of data.\nFrom 192.168.56.40 icmp_seq=1 Destination Host Unreachable\n\n--- ' + target + ' ping statistics ---\n4 packets transmitted, 0 received, +1 errors, 100% packet loss') : pingLocal(a, stdin);
      const [ip, h] = found;
      const times = [0.412, 0.388, 0.401, 0.395];
      return ['PING ' + target + ' (' + ip + ') 56(84) bytes of data.'].concat(times.map((t, i) => '64 bytes from ' + h.name + '.lan (' + ip + '): icmp_seq=' + (i + 1) + ' ttl=64 time=' + t + ' ms'),
        ['', '--- ' + target + ' ping statistics ---', '4 packets transmitted, 4 received, 0% packet loss, time 3004ms', 'rtt min/avg/max/mdev = 0.388/0.399/0.412/0.009 ms']).join('\n');
    };
    C.curl = (a, stdin) => {
      const url = a.find(x => !x.startsWith('-')) || '';
      const m = /^(?:https?:\/\/)?([^/:]+)/.exec(url), found = m && findHost(m[1]);
      if (!found) return curlLocal(a, stdin);
      const [, h] = found;
      return h.web ? h.web : failure('curl: (7) Failed to connect to ' + m[1] + ' port 80 after 2 ms: Connection refused', 7);
    };
    C.wget = C.curl;
    C.whoami = () => here.user;
    C.hostname = () => here.host;
    C.id = a => here.user === 'dev' ? idLocal(a) : 'uid=1000(' + here.user + ') gid=1000(' + here.user + ') groups=1000(' + here.user + ')';
    C.uname = a => String(unameLocal(a)).replace('dev-box', here.host);
    C.exit = args => (!shellChild && sessions.length ? logout() : exitLocal(args));
    C.logout = C.exit;

    function run(line, observe) {
      if (pendingAuth) { const typed = String(line ?? '').replace(/\r?\n$/, ''); return answerAuth(typed); }
      let raw = String(line ?? '').trim();
      if (!raw) return '';
      const expanded = expandHistory(raw);
      if (expanded.error) { lastStatus = 1; return expanded.error; }
      if (expanded.echo) { const shown = run(expanded.line, observe); return expanded.line + (shown ? '\n' + shown : ''); }
      hist.push(raw);
      steps = 4096;
      flow = '';
      let output = '';
      const write = bytes => { output += bytes; };
      const trace = typeof observe === 'function' ? [] : null;
      let stderr = '';
      const writeError = trace ? bytes => { stderr += bytes; write(bytes); } : write;
      const status = executeList(raw, null, 0, write, writeError, trace);
      if (trace) observe({ status, stderr, pipelines: trace });
      return output.replace(/\n$/, '');
    }

    return {
      id: 'bash', name: 'Bash / Linux', icon: '🐧', group: 'Unix',
      about: 'Bash simulation with a disposable filesystem. Compose pipelines, define functions, run loops, and execute scripts saved in the sandbox.',
      prompt: () => pendingAuth ? pendingAuth.prompt : here.user + '@' + here.host + ':' + disp() + '$ ',
      /* true while ssh or scp waits for a password: the terminal hides that line and keeps it out of history */
      secret: () => !!pendingAuth,
      cancelInput: () => { if (!pendingAuth) return false; pendingAuth = null; lastStatus = 130; return true; },
      /* a file dragged in from this PC lands in the current folder of whichever machine you are on */
      importFile: (name, text) => {
        const safe = String(name || 'file').replace(/[\\/:*?"<>|\u0000-\u001f]/g, '_').slice(0, 120) || 'file';
        if (!isDir(walk(cwd))) return null;
        put(cwd.concat(safe), F(text));
        return (path() === '/' ? '' : path()) + '/' + safe;
      },
      cwdPath: path,
      rootPath: '/home/dev',
      run,
      snapshot: () => {
        // saved from dev-box's point of view: a session on another PC ends when the page closes, like a real ssh session
        const base = sessions.length ? sessions[0] : { fs, cwd, prevCwd, env };
        return {
          fs: base.fs, cwd: base.cwd, prevCwd: base.prevCwd, env: base.env, aliases, lastStatus, pipefail, positional, argv0,
          hist: hist.slice(-250), functions: [...functions], exported: [...exported], modes: Unix.saveModes(base.fs, isDir),
          lan: lanDisks, lanKnown
        };
      },
      restore: saved => {
        if (!saved.fs || !Array.isArray(saved.cwd) || !Array.isArray(saved.functions) || !Array.isArray(saved.exported)) return;
        lanReset();
        if (saved.lan && typeof saved.lan === 'object') for (const ip of Object.keys(lanDisks)) if (isDir(saved.lan[ip])) lanDisks[ip] = saved.lan[ip];
        if (Array.isArray(saved.lanKnown)) lanKnown = saved.lanKnown.slice();
        ({ fs, cwd, prevCwd, env, aliases, lastStatus, pipefail, positional, argv0, hist } = saved);
        const home = walk(HOME);
        if (isDir(home) && home['.field-note'] && textOf(home['.field-note']).startsWith('Maintenance note\n\nTwo simple layers')) delete home['.field-note'];
        functions = new Map(saved.functions);
        exported = new Set(saved.exported);
        Unix.restoreModes(fs, saved.modes);
        // System files added in later versions appear in older saved disks too; nothing the player made is replaced.
        const etc = walk(['etc']);
        if (isDir(etc)) for (const [name, node] of Object.entries(seed().etc || {})) if (!Object.hasOwn(etc, name)) etc[name] = node;
      },
      commands: [
        ['security-tools', 'list the bundled evidence and security commands'],
        ['for name in alpha beta; do printf "<%s>\\n" "$name"; done', 'loop over a list of words'],
        ['total=0; for ((i=1; i<=4; i++)); do ((total += i)); done; printf "%s\\n" "$total"', 'calculate a running total in an arithmetic loop'],
        ['show_args() { printf "<%s>\\n" "$@"; }; show_args "two words" three', 'define a function and preserve quoted arguments'],
        ['printf "%s\\n" alpha beta | while IFS= read -r line; do printf "[%s]\\n" "$line"; done', 'read and process each line from a pipeline'],
        ['ls -la', 'list every file with permissions, size and date'],
        ['ls projects', 'list a directory'],
        ['cd projects', 'change directory'],
        ['pwd', 'print the working directory'],
        ['cat README.md', 'print a whole file'],
        ['head -4 projects/api.log', 'first lines of a file'],
        ['tail -3 /var/log/auth.log', 'last lines of a file'],
        ['grep -in error projects/api.log', 'search text, case-insensitive, with line numbers'],
        ['grep -c "Failed password" /var/log/auth.log', 'count matching lines'],
        ['find . -name "*.log"', 'walk the tree by name'],
        ['wc -l projects/api.log', 'count lines, words and bytes'],
        ['cat /var/log/auth.log | grep Failed | wc -l', 'pipe output between commands'],
        ['cat projects/api.log | sort | uniq -c | sort -rn', 'the classic frequency pipeline'],
        ['cut -d, -f1 notes.txt', 'select a field by delimiter'],
        ['tr a-z A-Z < notes.txt', 'translate characters'],
        ['sed s/ERROR/FATAL/g projects/api.log', 'stream substitution'],
        ['awk \'{print $1, $2}\' projects/api.log', 'print selected fields'],
        ['echo "hello" > /tmp/hi.txt', 'write output to a file'],
        ['echo "again" >> /tmp/hi.txt', 'append to a file'],
        ['mkdir -p /tmp/cache/one', 'create nested directories'],
        ['touch /tmp/empty.txt', 'create an empty file'],
        ['cp notes.txt /tmp/notes.bak', 'copy a file'],
        ['mv /tmp/notes.bak /tmp/notes.txt', 'move or rename a file'],
        ['rm -rf /tmp/cache', 'remove a tree'],
        ['chmod u+x projects/deploy.sh', 'add owner execute permission'],
        ['tar -czf /tmp/projects.tgz projects', 'create an archive'],
        ['tar -tzf /tmp/projects.tgz', 'list an archive'],
        ['base64 notes.txt', 'encode a file as Base64'],
        ['echo aGVsbG8sIHRlcm1pbmFs | base64 -d', 'decode Base64 from a pipe'],
        ['xxd notes.txt', 'hex dump a file'],
        ['ps', 'list processes'],
        ['df -h', 'disk usage by filesystem'],
        ['du -sh projects', 'directory size'],
        ['free -h', 'memory usage'],
        ['uname -a', 'kernel and architecture'],
        ['id', 'user, group and supplementary groups'],
        ['env', 'environment variables'],
        ['export GREETING=hello', 'set an environment variable'],
        ['history', 'the commands you typed in this shell'],
        ['which docker', 'where a binary lives'],
        ['man grep', 'a (simulated) manual page'],
        ['curl https://api.internal/health', 'make an HTTP request'],
        ['ping dev-box', 'send ICMP echo requests'],
        ['nmap -sn 192.168.56.0/24', 'find the PCs on the office network'],
        ['curl http://kiosk-3', 'read a PC\'s web page'],
        ['ssh guest@kiosk-3', 'log in to another PC (exit comes back)'],
        ['scp notes.txt guest@kiosk-3:~/', 'copy a file onto another PC'],
        ['scp guest@kiosk-3:Desktop/it-ticket.txt .', 'copy a file from another PC to this one'],
        ['nmap -sV 10.0.0.5', 'service and version scan'],
        ['help', 'every command this sandbox supports'],
        ['reset', 'restore the virtual disk']
      ].map(x => ({ ex: x[0], d: x[1] }))
    };
  };
})();

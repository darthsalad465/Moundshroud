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

  // Detailed per-command "man pages": synopsis, every supported flag, worked examples, and related commands.
  // Only flags the sandbox actually implements are listed, so `help <cmd>` never documents something that fails.
  // Shape: { s: one-line summary, syn: usage, d: description, o: [[flag, what it does], ...],
  //          x: [[example, note], ...], see: [related command names] }.
  G.SHELL_NOTES = {
    bash: 'COMBINING FLAGS\n  Single-letter flags bundle: `ls -l -a` is the same as `ls -la`.\n\nPIPES & CHAINING\n  cmd1 | cmd2     send cmd1 output into cmd2 (e.g. cat f | grep foo | wc -l)\n  cmd1 && cmd2    run cmd2 only if cmd1 succeeded\n  cmd1 || cmd2    run cmd2 only if cmd1 failed\n  cmd1 ; cmd2     run both in order, regardless of result\n  > file          redirect output into file (overwrite)\n  >> file         redirect output onto the end of file (append)\n  < file          read a command\'s input from file\n  *.log  f?.txt   globs: * any text, ? one character, {a,b} a set\n  $(cmd)          substitute a command\'s output into the line',
    powershell: 'OBJECT PIPELINE\n  In PowerShell the pipe passes OBJECTS, not text. A cmdlet emits rows with\n  named properties, and the next cmdlet filters or reshapes those rows.\n  cmd | Where-Object { $_.Prop -gt 2 }   keep rows where a property passes a test\n  cmd | Select-Object Name,Id            keep only these properties\n  cmd | Select-Object -First 3           keep the first 3 rows (-Last N, -Unique)\n  cmd | Sort-Object CPU -Descending      sort rows by a property\n  cmd | Measure-Object                   count the rows\n  cmd | ForEach-Object { $_.Name }       pull one property from every row\n  cmd | Format-Table / Format-List       choose how rows are printed\n  cmd | Out-File log.txt                 write the pipeline to a file\n  OPERATORS  -eq -ne -gt -lt -ge -le -like -match (not < or >)\n  VARIABLES  $x = 5   then  $x   ·   $_ is the current pipeline object',
    cmd: 'PIPES & REDIRECTION\n  cmd1 | cmd2     send cmd1 output into cmd2 (e.g. dir | find "txt")\n  cmd1 && cmd2    run cmd2 only if cmd1 succeeded\n  cmd1 || cmd2    run cmd2 only if cmd1 failed\n  cmd1 & cmd2     run both in order\n  > file          redirect output into file (overwrite)\n  >> file         redirect output onto the end of file (append)\n  %VAR%           expand an environment variable (set VAR=value to set it)\n  /?              most commands show their own help with /?',
    python: 'THE REPL\n  Type an expression to see its value; type a statement to run it.\n  name = value      assign a variable    ·    del name   remove it\n  import math       load a standard-library module, then use math.sqrt(9)\n  for / if / def    normal Python blocks (one line, or indented lines)\n  help(topic)       built-in help    ·    clear / reset   empty the namespace\n  There is no shell pipe here; chain with Python itself, e.g. sum(map(int, data)).',
    node: 'THE REPL\n  Type a JavaScript expression to see its value; the last value is echoed.\n  const / let / var   declare variables    ·    function / class   define them\n  require("os")        load a core module (crypto, path, fs, url, util, ...)\n  console.log(x)       print    ·    .help lists dot-commands, .clear resets\n  No shell pipe here; chain with JavaScript, e.g. arr.map(f).filter(g).',
    sql: 'WRITING QUERIES\n  Statements end with a semicolon. Keywords are case-insensitive.\n  SELECT cols FROM table WHERE cond GROUP BY col ORDER BY col LIMIT n;\n  Combine tables with JOIN ... ON a.id = b.id.\n  Wrap changes in BEGIN; ... COMMIT; or undo them with ROLLBACK;.\n  Inspect the schema with SHOW TABLES; or DESCRIBE <table>;.',
    git: 'HOW GIT FITS TOGETHER\n  Working tree  →  (git add)  →  Staging/index  →  (git commit)  →  History\n  git status          see what is staged, modified, or untracked\n  git add <file>      stage changes    ·    git commit -m "msg"   record them\n  git log --oneline   browse history   ·    git diff   see pending changes\n  Branches are movable labels: git branch, git checkout -b, git merge.\n  Output can be piped to bash-style filters, e.g. git log --oneline | head.',
    docker: 'HOW DOCKER FITS TOGETHER\n  Image (a template)  →  docker run  →  Container (a running instance)\n  docker ps           list running containers (-a includes stopped)\n  docker images       list local images\n  docker run <image>  start a container    ·    docker stop <name>   halt it\n  docker logs <name>  read its output      ·    docker exec <name> <cmd>  run inside\n  Most list output can be piped to bash-style filters, e.g. docker ps | grep web.',
    network: 'RECON WORKFLOW\n  Find hosts and ports, resolve names, then probe services. All targets are\n  simulated: only the bundled sandbox hosts answer, nothing real is touched.\n  nmap <ip>           scan ports    ·    dig <name>   resolve DNS\n  curl <url>          fetch a page  ·    nc <host> <port>   test a socket\n  Output can be piped to bash-style filters, e.g. nmap 10.0.0.5 | grep open.',
    crypto: 'CHAINING TRANSFORMS\n  Each tool takes text as an argument or from a pipe, so transforms chain:\n  base64 secret | rev            encode, then reverse\n  echo hello | rot13 | rot13     round-trip back to the start\n  hex -d 68656c6c6f             add -d to most tools to decode\n  Analysis helpers: entropy, freq, len, strings read their input the same way.'
  };
  G.MAN = {
    bash: {
      ls: { s: 'list directory contents', syn: 'ls [-alARhi1rdFS] [file...]',
        d: 'List files and directories. With no path given, lists the current directory. Entries sort alphabetically unless -S or -r changes the order.',
        o: [['-l', 'long format: permissions, link count, owner, size, date, name'], ['-a', 'show all entries, including hidden dotfiles and . and ..'], ['-A', 'like -a but hide the . and .. entries'], ['-R', 'recurse into every subdirectory, each printed as its own section'], ['-h', 'with -l, print sizes as 1K, 24K instead of raw bytes'], ['-i', 'print the inode number before each name'], ['-1', 'one entry per line (good before a pipe)'], ['-r', 'reverse the sort order'], ['-S', 'sort by size, largest first'], ['-d', 'list the directory itself, not what is inside it'], ['-F', 'append / after directory names']],
        x: [['ls -la', 'long listing including hidden files'], ['ls -lhS', 'long listing, human sizes, biggest first'], ['ls -R /', 'walk the whole tree'], ['ls -1 | wc -l', 'count entries in this directory'], ['ls -i notes.txt', 'show one file and its inode']],
        see: ['stat', 'find', 'tree', 'wc'] },
      cat: { s: 'print and join files', syn: 'cat [-nbsEA] [file...]',
        d: 'Print files one after another. With no file, or with -, read from the pipe. Often used to feed a file into another command.',
        o: [['-n', 'number every output line'], ['-b', 'number only non-blank lines'], ['-s', 'squeeze runs of blank lines into one'], ['-E', 'mark each line end with $'], ['-A', 'like -E here (show line ends)']],
        x: [['cat notes.txt', 'print one file'], ['cat a.txt b.txt > both.txt', 'join two files into a third'], ['cat -n script.sh', 'print with line numbers'], ['cat access.log | grep 404', 'feed a file into grep']],
        see: ['head', 'tail', 'nl', 'less'] },
      head: { s: 'print the first lines', syn: 'head [-n N] [file...]',
        d: 'Print the beginning of a file or piped input. The default is 10 lines.',
        o: [['-n N', 'print the first N lines'], ['-N', 'short form, e.g. head -5']],
        x: [['head access.log', 'first 10 lines'], ['head -n 3 users.csv', 'first 3 lines'], ['ps aux | head -5', 'first 5 lines of a pipe']],
        see: ['tail', 'cat', 'sed'] },
      tail: { s: 'print the last lines', syn: 'tail [-n N] [file...]',
        d: 'Print the end of a file or piped input. The default is 10 lines.',
        o: [['-n N', 'print the last N lines'], ['-N', 'short form, e.g. tail -20']],
        x: [['tail error.log', 'last 10 lines'], ['tail -n 1 users.csv', 'just the last line'], ['sort nums.txt | tail -3', 'three largest after sorting']],
        see: ['head', 'cat', 'sort'] },
      grep: { s: 'search text for a pattern', syn: 'grep [-inrvcloqH] <pattern> [file...]',
        d: 'Print lines that match a regular expression. Searches files, or piped input when no file is given.',
        o: [['-i', 'ignore case'], ['-n', 'prefix each hit with its line number'], ['-r', 'search a directory and all files under it'], ['-v', 'invert: print lines that do NOT match'], ['-c', 'print only the count of matching lines'], ['-l', 'print only the names of files that match'], ['-o', 'print only the matched text, not the whole line'], ['-q', 'quiet: print nothing, just set the exit status'], ['-H', 'always print the filename before a match']],
        x: [['grep error app.log', 'lines containing error'], ['grep -in warn app.log', 'case-insensitive, with line numbers'], ['grep -rc TODO .', 'count TODOs per file under here'], ['ps aux | grep ssh', 'filter a pipe'], ['grep -v "^#" conf.ini', 'drop comment lines']],
        see: ['sed', 'awk', 'cut', 'find'] },
      wc: { s: 'count lines, words, bytes', syn: 'wc [-lwmc] [file...]',
        d: 'Count lines, words, characters, or bytes in a file or piped input. With no flag, prints lines, words, and bytes.',
        o: [['-l', 'count lines'], ['-w', 'count words'], ['-m', 'count characters'], ['-c', 'count bytes']],
        x: [['wc -l access.log', 'how many lines'], ['ls | wc -l', 'how many entries here'], ['grep error log | wc -l', 'how many errors']],
        see: ['grep', 'sort', 'uniq'] },
      sort: { s: 'sort lines of text', syn: 'sort [-nru] [-t SEP] [-k N] [file...]',
        d: 'Sort lines alphabetically by default. Reads a file or piped input.',
        o: [['-n', 'sort numerically, not as text (so 9 before 10)'], ['-r', 'reverse the result'], ['-u', 'drop duplicate lines after sorting'], ['-t SEP', 'set the field separator for -k'], ['-k N', 'sort by field number N']],
        x: [['sort names.txt', 'alphabetical'], ['sort -n sizes.txt', 'numeric order'], ['sort -rn sizes.txt', 'biggest first'], ['sort -t, -k2 -n data.csv', 'by the 2nd comma field, numeric'], ['cut -d, -f1 data.csv | sort -u', 'unique values of column 1']],
        see: ['uniq', 'cut', 'wc'] },
      uniq: { s: 'collapse adjacent duplicate lines', syn: 'uniq [-cudi] [file...]',
        d: 'Remove adjacent repeated lines. Input is usually sorted first, because uniq only compares neighbours.',
        o: [['-c', 'prefix each line with how many times it repeated'], ['-u', 'print only lines that never repeated'], ['-d', 'print only lines that did repeat'], ['-i', 'ignore case when comparing']],
        x: [['sort log | uniq', 'de-duplicate after sorting'], ['sort ips.txt | uniq -c', 'count each unique value'], ['sort ips.txt | uniq -c | sort -rn', 'top values by frequency']],
        see: ['sort', 'wc'] },
      cut: { s: 'select columns from each line', syn: 'cut -d<sep> -f<list> [file...]',
        d: 'Cut out fields from each line, split by a delimiter. Field numbers start at 1.',
        o: [['-d SEP', 'the delimiter character (default TAB)'], ['-f N', 'keep field N'], ['-f A-B', 'keep fields A through B'], ['-f A,B', 'keep fields A and B']],
        x: [['cut -d, -f1 data.csv', 'first column of a CSV'], ['cut -d: -f1 /etc/passwd', 'usernames'], ['cut -d, -f1,3 data.csv', 'columns 1 and 3'], ['cut -d, -f2- data.csv', 'column 2 to the end']],
        see: ['awk', 'sort', 'paste'] },
      tr: { s: 'translate or delete characters', syn: 'tr [-ds] <set1> [set2]',
        d: 'Transform characters read from the pipe. Maps each character in set1 to the same position in set2, or deletes them.',
        o: [['-d', 'delete every character in set1'], ['-s', 'squeeze repeats of set1 characters to one']],
        x: [['echo hi | tr a-z A-Z', 'upper-case'], ['cat f | tr -d "\\r"', 'strip carriage returns'], ['echo "a  b   c" | tr -s " "', 'collapse runs of spaces'], ['echo text | tr "aeiou" "*"', 'mask the vowels']],
        see: ['sed', 'cut'] },
      sed: { s: 'stream search and replace', syn: 'sed s/old/new/[g][i] [file...]',
        d: 'Replace text line by line. This sandbox supports the substitution form s/pattern/replacement/flags.',
        o: [['g', 'replace every match on the line, not just the first'], ['i', 'match case-insensitively'], ['s|a|b|', 'any delimiter works, e.g. s#a#b# for paths']],
        x: [['sed s/foo/bar/ f.txt', 'replace the first foo on each line'], ['sed s/foo/bar/g f.txt', 'replace every foo'], ['echo HELLO | sed s/hello/hi/i', 'case-insensitive'], ['cat urls | sed s#http:#https:#', 'swap a scheme using # as the delimiter']],
        see: ['grep', 'tr', 'awk'] },
      awk: { s: 'split lines into fields and print', syn: "awk [-F sep] '{print $1, $3}' [file...]",
        d: 'Split each line into fields and print chosen ones. This sandbox supports the {print ...} action with $0 (whole line) and $1, $2, ... fields.',
        o: [['-F SEP', 'set the field separator (default whitespace)'], ['$0', 'the whole line'], ['$1 $2 ...', 'field number 1, 2, ...']],
        x: [["awk '{print $1}' access.log", 'first field of each line'], ["awk -F, '{print $1, $3}' data.csv", 'columns 1 and 3 of a CSV'], ["ps aux | awk '{print $2, $11}'", 'PID and command']],
        see: ['cut', 'grep', 'sed'] },
      find: { s: 'search for files by name', syn: 'find [dir] -name <pattern>',
        d: 'Walk a directory tree and print paths. -name filters by a wildcard pattern.',
        o: [['-name PAT', 'match the file name against a glob like "*.log"'], ['-type f', 'only files'], ['-type d', 'only directories']],
        x: [['find . -name "*.txt"', 'every .txt under here'], ['find /etc -type f', 'files only'], ['find . -name "*.log" | wc -l', 'count the log files']],
        see: ['ls', 'grep', 'tree'] },
      chmod: { s: 'change file permissions', syn: 'chmod [-R] <mode> <file...>',
        d: 'Change the permission bits of a file. Mode is octal (755) or symbolic (u+x, go-w).',
        o: [['-R', 'apply to a directory and everything under it'], ['755', 'octal: owner rwx, group and others r-x'], ['u+x', 'symbolic: add execute for the owner'], ['go-w', 'remove write for group and others']],
        x: [['chmod 600 secret.txt', 'owner read/write only'], ['chmod +x run.sh', 'make a script executable'], ['chmod -R 755 site', 'fix a whole folder']],
        see: ['ls', 'chown', 'stat'] },
      echo: { s: 'print a line of text', syn: 'echo [-neE] <text...>',
        d: 'Print its arguments separated by spaces, then a newline. $VARIABLES expand.',
        o: [['-n', 'do not add the trailing newline'], ['-e', 'interpret backslash escapes like \\n and \\t'], ['-E', 'do not interpret escapes (the default)']],
        x: [['echo hello world', 'print two words'], ['echo -n done', 'no trailing newline'], ['echo -e "a\\tb"', 'a tab between a and b'], ['echo $HOME', 'expand a variable']],
        see: ['printf', 'cat'] }
    }
  };
  // Remaining bash man pages. Every flag listed below is one the handler above really reads.
  Object.assign(G.MAN.bash, {
    cd: { s: 'change the working directory', syn: 'cd [dir|~|-]',
      d: 'Move to another directory. With no argument, go to the home directory.',
      o: [['~', 'the home directory'], ['-', 'the previous directory (and print it)'], ['..', 'the parent directory']],
      x: [['cd /home/dev', 'go to an absolute path'], ['cd ..', 'up one level'], ['cd -', 'back to where you were'], ['cd', 'home']],
      see: ['pwd', 'ls', 'pushd'] },
    pwd: { s: 'print the working directory', syn: 'pwd',
      d: 'Print the full path of the current directory.',
      o: [], x: [['pwd', 'show where you are']], see: ['cd', 'ls'] },
    tree: { s: 'draw the directory tree', syn: 'tree [-a] [dir]',
      d: 'Print a directory and everything under it as an indented tree.',
      o: [['-a', 'include hidden dotfiles']],
      x: [['tree', 'tree of the current directory'], ['tree -a /home', 'include hidden files'], ['tree | head -20', 'first 20 lines of the tree']],
      see: ['ls', 'find'] },
    stat: { s: 'show file metadata', syn: 'stat [-c %a] <file>',
      d: 'Print size, type, and permission bits for a file. With -c, print one formatted field.',
      o: [['-c %a', 'print just the octal permission bits, e.g. 644'], ['-c %s', 'print just the size in bytes']],
      x: [['stat notes.txt', 'full metadata block'], ['stat -c %a run.sh', 'octal mode only'], ['stat -c %s notes.txt', 'size in bytes']],
      see: ['ls', 'file', 'chmod'] },
    file: { s: 'guess a file type', syn: 'file <path>',
      d: 'Report what a file looks like: ASCII text, a shell script, JSON, or gzip data, judged by name and first bytes.',
      o: [], x: [['file notes.txt', 'likely ASCII text'], ['file run.sh', 'shell script'], ['file data.json', 'JSON data']],
      see: ['stat', 'strings', 'xxd'] },
    strings: { s: 'pull readable text out of data', syn: 'strings [file]',
      d: 'Print runs of 4 or more printable characters. Reads a file or piped input. Used to peek inside binaries or captures.',
      o: [], x: [['strings dump.bin', 'readable text inside a blob'], ['cat dump.bin | strings | grep -i pass', 'hunt for a password string']],
      see: ['grep', 'xxd', 'file'] },
    touch: { s: 'create an empty file', syn: 'touch <file...>',
      d: 'Create each named file if it does not exist (timestamps are not tracked in this sandbox).',
      o: [], x: [['touch new.txt', 'make an empty file'], ['touch a.txt b.txt', 'make two at once']],
      see: ['mkdir', 'echo', 'rm'] },
    mkdir: { s: 'make directories', syn: 'mkdir [-p] <dir...>',
      d: 'Create one or more directories.',
      o: [['-p', 'create missing parent directories, and do not fail if the directory exists']],
      x: [['mkdir logs', 'one directory'], ['mkdir -p a/b/c', 'make the whole path'], ['mkdir x && cd x', 'make it then enter it']],
      see: ['rmdir', 'rm', 'cd'] },
    rmdir: { s: 'remove empty directories', syn: 'rmdir <dir...>',
      d: 'Delete a directory, but only when it is already empty. Use rm -r to remove a directory with contents.',
      o: [], x: [['rmdir olddir', 'remove an empty directory'], ['mkdir t && rmdir t', 'make and unmake']],
      see: ['mkdir', 'rm'] },
    rm: { s: 'delete files and directories', syn: 'rm [-rf] <path...>',
      d: 'Remove files. A directory needs -r. There is no trash: removal is permanent in the sandbox disk (reset restores it).',
      o: [['-r', 'recurse into a directory and remove its contents (also -R)'], ['-f', 'force: ignore missing files and never complain']],
      x: [['rm old.txt', 'delete a file'], ['rm -r logs', 'delete a folder and all of it'], ['rm -f maybe.txt', 'delete, no error if absent']],
      see: ['rmdir', 'cp', 'mv'] },
    cp: { s: 'copy a file', syn: 'cp <src> <dst>',
      d: 'Copy the contents of one file to a new path.',
      o: [], x: [['cp notes.txt backup.txt', 'duplicate a file'], ['cp conf.ini conf.bak', 'keep a backup before editing']],
      see: ['mv', 'rm', 'cat'] },
    mv: { s: 'move or rename a file', syn: 'mv <src> <dst>',
      d: 'Move a file to a new path, or rename it in place.',
      o: [], x: [['mv draft.txt final.txt', 'rename'], ['mv report.txt /tmp/report.txt', 'move elsewhere']],
      see: ['cp', 'rm'] },
    ln: { s: 'link a file to a second name', syn: 'ln [-s] <target> <link>',
      d: 'Make a second name for a file. readlink and realpath print the full resolved path.',
      o: [['-s', 'make a symbolic link (treated like a copy of the content here)']],
      x: [['ln -s notes.txt n', 'a short alias for a file'], ['realpath n', 'show the full path']],
      see: ['cp', 'ls'] },
    chown: { s: 'change file owner (simulated)', syn: 'chown <owner>[:group] <file>',
      d: 'Change a file owner. The sandbox is single-user, so this reports success without altering ownership.',
      o: [], x: [['chown dev notes.txt', 'set the owner (no-op here)']], see: ['chgrp', 'chmod', 'id'] },
    chgrp: { s: 'change file group (simulated)', syn: 'chgrp <group> <file>',
      d: 'Change a file group. Simulated: it succeeds without changing anything.',
      o: [], x: [['chgrp dev notes.txt', 'set the group (no-op here)']], see: ['chown', 'chmod'] },
    umask: { s: 'show the default permission mask', syn: 'umask',
      d: 'Print the file-creation mask. Fixed at 0022 in the sandbox.',
      o: [], x: [['umask', 'show 0022']], see: ['chmod', 'stat'] },
    tee: { s: 'write a pipe to a file and to the screen', syn: 'tee [-a] <file>',
      d: 'Copy piped input into a file while also passing it along the pipe. Useful to save and watch at once.',
      o: [['-a', 'append to the file instead of overwriting it']],
      x: [['echo hi | tee out.txt', 'save and print'], ['ls | tee list.txt | wc -l', 'save a list and count it'], ['echo more | tee -a out.txt', 'add a line']],
      see: ['cat', 'grep'] },
    nl: { s: 'number lines', syn: 'nl [file]',
      d: 'Print each line with a line number in front. Reads a file or a pipe.',
      o: [], x: [['nl notes.txt', 'numbered file'], ['grep error log | nl', 'number the matches']],
      see: ['cat', 'wc'] },
    tac: { s: 'print lines in reverse order', syn: 'tac [file]',
      d: 'Print the lines of a file last-to-first (the reverse of cat).',
      o: [], x: [['tac log.txt', 'newest line first'], ['seq 5 | tac', '5 4 3 2 1']],
      see: ['cat', 'rev', 'sort'] },
    rev: { s: 'reverse each line', syn: 'rev [file]',
      d: 'Reverse the characters of every line. Line order is kept; only each line is flipped.',
      o: [], x: [['echo abc | rev', 'cba'], ['rev notes.txt', 'mirror each line']],
      see: ['tac', 'tr'] },
    paste: { s: 'join files side by side', syn: 'paste [-d SEP] <file...>',
      d: 'Merge files line by line, putting matching lines next to each other.',
      o: [['-d SEP', 'the separator between columns (default TAB)']],
      x: [['paste names.txt ages.txt', 'two columns'], ['paste -d, a.txt b.txt', 'comma between']],
      see: ['cut', 'cat'] },
    diff: { s: 'compare two files', syn: 'diff <file1> <file2>',
      d: 'Show the lines that differ between two files, with - for the first and + for the second. No output means identical.',
      o: [], x: [['diff old.txt new.txt', 'what changed'], ['diff conf.ini conf.bak', 'compare to a backup']],
      see: ['comm', 'cmp'] },
    comm: { s: 'compare two sorted files', syn: 'comm <file1> <file2>',
      d: 'Show which lines are unique to each file and which are shared, in three indented columns. Sort both files first.',
      o: [], x: [['comm a.txt b.txt', 'unique and shared lines'], ['sort x | comm - y.txt', 'compare a sorted stream']],
      see: ['diff', 'sort', 'uniq'] },
    fold: { s: 'wrap long lines', syn: 'fold [-w N] [file]',
      d: 'Break lines longer than a width onto multiple lines.',
      o: [['-w N', 'wrap at N characters (default 80)']],
      x: [['fold -w 20 notes.txt', 'wrap at 20 columns'], ['echo longtext | fold -w 4', 'chop into 4-char pieces']],
      see: ['cut', 'cat'] },
    printf: { s: 'print formatted text', syn: 'printf FORMAT [args...]',
      d: 'Print text using a format string. Unlike echo, it adds no newline unless the format has \\n.',
      o: [['%s', 'insert the next argument as a string'], ['%d', 'insert it as an integer'], ['%f', 'insert it as a float (6 decimals)'], ['\\n \\t', 'newline and tab escapes are interpreted']],
      x: [['printf "%s=%d\\n" count 5', 'count=5'], ['printf "%s\\t%s\\n" a b', 'two tab-separated words'], ['printf "%.0f\\n" 3.9', 'rounds in the format']],
      see: ['echo', 'awk'] },
    xargs: { s: 'turn input into command arguments', syn: '... | xargs <command>',
      d: 'Read whitespace-separated items from the pipe and pass them as arguments to a command (default echo).',
      o: [], x: [['echo a b c | xargs echo', 'a b c as args'], ['ls | xargs wc -l', 'run wc on each listed name']],
      see: ['find', 'tr'] },
    base64: { s: 'Base64 encode or decode', syn: 'base64 [-d] [file]',
      d: 'Encode text or a file to Base64, or decode it back with -d. Reads a pipe when no file is given.',
      o: [['-d', 'decode instead of encode (also --decode)']],
      x: [['echo hi | base64', 'aGkK'], ['echo aGkK | base64 -d', 'hi'], ['base64 notes.txt', 'encode a file']],
      see: ['xxd', 'hex', 'md5sum'] },
    xxd: { s: 'hex dump a file', syn: 'xxd [-r] [-p] [file]',
      d: 'Show bytes as a hex dump. -r turns a dump back into bytes; -p is a plain continuous hex string.',
      o: [['-r', 'reverse: hex back to text'], ['-p', 'plain hex, no address column or ASCII']],
      x: [['echo hi | xxd', 'hex dump with ASCII'], ['echo hi | xxd -p', '68690a'], ['echo 6869 | xxd -r -p', 'hi']],
      see: ['hex', 'base64', 'strings'] },
    rot13: { s: 'ROT13 letter cipher', syn: 'rot13 [text|file]',
      d: 'Rotate each letter 13 places. Running it twice returns the original.',
      o: [], x: [['echo hello | rot13', 'uryyb'], ['echo uryyb | rot13', 'hello']],
      see: ['caesar', 'tr'] },
    hex: { s: 'hex encode or decode text', syn: 'hex [-d] [text|file]',
      d: 'Turn text into hexadecimal byte codes, or back with -d.',
      o: [['-d', 'decode hex back to text (also -r)']],
      x: [['hex hello', '68656c6c6f'], ['hex -d 68656c6c6f', 'hello'], ['echo hi | hex', '6869...']],
      see: ['xxd', 'base64', 'binary'] },
    binary: { s: 'binary encode or decode text', syn: 'binary [-d] [text]',
      d: 'Turn text into space-separated 8-bit binary, or back with -d.',
      o: [['-d', 'decode binary back to text']],
      x: [['binary hi', '01101000 01101001'], ['binary -d "01101000 01101001"', 'hi']],
      see: ['hex', 'caesar'] },
    url: { s: 'URL percent-encode or decode', syn: 'url [-d] [text]',
      d: 'Percent-encode text for a URL, or decode it with -d.',
      o: [['-d', 'decode percent escapes back to text']],
      x: [['url "a b&c"', 'a%20b%26c'], ['url -d a%20b%26c', 'a b&c']],
      see: ['base64', 'hex'] },
    caesar: { s: 'Caesar shift cipher', syn: 'caesar [N] [text]',
      d: 'Shift each letter by N places (default 3). A negative N shifts back.',
      o: [['N', 'the shift amount, e.g. 3 or -3']],
      x: [['caesar 3 abc', 'def'], ['caesar -3 def', 'abc'], ['echo secret | caesar 5', 'shift by 5']],
      see: ['rot13', 'morse'] },
    morse: { s: 'Morse code encode or decode', syn: 'morse [-d] [text]',
      d: 'Encode letters and digits to Morse (space between letters), or decode with -d. Quote or pipe the dots-and-dashes when decoding, so the dashes are not read as flags.',
      o: [['-d', 'decode Morse back to text']],
      x: [['morse sos', '... --- ...'], ['echo sos | morse | morse -d', 'sos'], ['morse -d "... --- ..."', 'sos']],
      see: ['caesar', 'rot13'] },
    md5sum: { s: 'MD5 checksum', syn: 'md5sum [file]',
      d: 'Print a deterministic MD5-style checksum of a file or piped input.',
      o: [], x: [['md5sum notes.txt', 'checksum of a file'], ['echo hi | md5sum', 'checksum of a string']],
      see: ['sha256sum', 'cksum'] },
    sha1sum: { s: 'SHA-1 checksum', syn: 'sha1sum [file]',
      d: 'Print a deterministic SHA-1-style checksum of a file or piped input.',
      o: [], x: [['sha1sum notes.txt', 'checksum of a file'], ['echo hi | sha1sum', 'checksum of a string']],
      see: ['md5sum', 'sha256sum'] },
    sha256sum: { s: 'SHA-256 checksum', syn: 'sha256sum [file]',
      d: 'Print a deterministic SHA-256-style checksum of a file or piped input.',
      o: [], x: [['sha256sum notes.txt', 'checksum of a file'], ['cat a b | sha256sum', 'checksum of two joined files']],
      see: ['md5sum', 'sha1sum', 'cksum'] },
    cksum: { s: 'CRC checksum and byte count', syn: 'cksum [file]',
      d: 'Print a checksum number and the byte count of a file or pipe.',
      o: [], x: [['cksum notes.txt', 'checksum, size, name'], ['echo hi | cksum', 'checksum of a string']],
      see: ['md5sum', 'wc'] },
    tar: { s: 'bundle files into an archive', syn: 'tar -czf a.tgz <dir> | -tzf a.tgz | -xzf a.tgz',
      d: 'Create, list, or extract a .tar/.tgz archive. The sandbox stores a placeholder archive and lists sample contents.',
      o: [['-c', 'create a new archive'], ['-t', 'list the contents of an archive'], ['-x', 'extract an archive'], ['-z', 'gzip the archive'], ['-f NAME', 'the archive file name']],
      x: [['tar -czf proj.tgz projects', 'bundle a folder'], ['tar -tzf proj.tgz', 'list what is inside'], ['tar -xzf proj.tgz', 'unpack it']],
      see: ['gzip', 'zip', 'gunzip'] },
    gzip: { s: 'compress a file', syn: 'gzip <file>',
      d: 'Compress a file, producing file.gz. Use gunzip or zcat to read it back.',
      o: [], x: [['gzip big.log', 'makes big.log.gz'], ['gzip notes.txt && ls', 'compress then list']],
      see: ['gunzip', 'zcat', 'tar'] },
    gunzip: { s: 'decompress a .gz file', syn: 'gunzip <file.gz>',
      d: 'Reverse gzip, restoring the original file name.',
      o: [], x: [['gunzip notes.txt.gz', 'restore notes.txt']],
      see: ['gzip', 'zcat'] },
    zcat: { s: 'print a .gz file', syn: 'zcat <file.gz>',
      d: 'Show the contents of a gzip file without unpacking it to disk.',
      o: [], x: [['zcat notes.txt.gz', 'read a compressed file']],
      see: ['gunzip', 'cat'] },
    zip: { s: 'make a zip archive', syn: 'zip <archive.zip> <file>',
      d: 'Add a file to a zip archive (simulated: it reports a deflate ratio).',
      o: [], x: [['zip out.zip notes.txt', 'zip one file']],
      see: ['unzip', 'tar'] },
    unzip: { s: 'extract a zip archive', syn: 'unzip <archive.zip>',
      d: 'List and inflate a zip archive (simulated output).',
      o: [], x: [['unzip out.zip', 'inflate an archive']],
      see: ['zip', 'tar'] },
    ps: { s: 'list running processes', syn: 'ps [aux]',
      d: 'Show a fixed table of sandbox processes: PID, TTY, time, and command.',
      o: [['aux', 'the common "all processes" form; output is the same sample here']],
      x: [['ps', 'the process table'], ['ps aux | grep node', 'find a process'], ['ps | wc -l', 'count rows']],
      see: ['top', 'pgrep', 'kill'] },
    top: { s: 'live process summary', syn: 'top',
      d: 'Print a one-shot summary of load, tasks, CPU, and the process list. htop shows the same here.',
      o: [], x: [['top', 'load and processes'], ['top | head -3', 'just the header']],
      see: ['ps', 'htop', 'free'] },
    htop: { s: 'live process summary', syn: 'htop',
      d: 'Alias for top in this sandbox: a one-shot load and process summary.',
      o: [], x: [['htop', 'same as top']], see: ['top', 'ps'] },
    pgrep: { s: 'find process IDs by name', syn: 'pgrep <name>',
      d: 'Print the PIDs of sandbox processes whose name contains the text.',
      o: [], x: [['pgrep ssh', 'the sshd PID'], ['pgrep node', 'the node PID']],
      see: ['ps', 'pkill', 'kill'] },
    kill: { s: 'send a signal to a process', syn: 'kill [-9] <pid>',
      d: 'Send a termination signal to a PID (simulated acknowledgement).',
      o: [['-9', 'the forceful KILL signal']],
      x: [['kill 812', 'signal PID 812'], ['kill -9 884', 'force-kill a PID']],
      see: ['pkill', 'pgrep', 'ps'] },
    pkill: { s: 'kill processes by name', syn: 'pkill <name>',
      d: 'Terminate sandbox processes matching a name (simulated).',
      o: [], x: [['pkill node', 'terminate by name']], see: ['kill', 'pgrep'] },
    df: { s: 'show disk space', syn: 'df [-h]',
      d: 'Print filesystem size, used, and available space.',
      o: [['-h', 'human-readable sizes (the sample is already in G/M)']],
      x: [['df -h', 'disk usage table'], ['df | grep vda1', 'just the root filesystem']],
      see: ['du', 'free', 'lsblk'] },
    du: { s: 'show directory sizes', syn: 'du [-h] [path]',
      d: 'Print how much space directories use.',
      o: [['-h', 'human-readable sizes (the sample is already sized)']],
      x: [['du', 'sizes of sample paths'], ['du | sort -h', 'smallest first']],
      see: ['df', 'ls'] },
    free: { s: 'show memory use', syn: 'free [-h]',
      d: 'Print total, used, and free memory and swap.',
      o: [['-h', 'human-readable sizes (the sample is already in Gi)']],
      x: [['free -h', 'memory table'], ['free | grep Mem', 'just the RAM line']],
      see: ['top', 'df'] },
    lsblk: { s: 'list block devices', syn: 'lsblk',
      d: 'Show the sample disk and its partitions as a tree.',
      o: [], x: [['lsblk', 'disk and partitions']], see: ['df', 'mount'] },
    mount: { s: 'list mounted filesystems', syn: 'mount',
      d: 'Show which filesystems are mounted where.',
      o: [], x: [['mount', 'mounted filesystems'], ['mount | grep ext4', 'just ext4 mounts']],
      see: ['df', 'lsblk'] },
    lscpu: { s: 'show CPU information', syn: 'lscpu',
      d: 'Print architecture, CPU count, and model.',
      o: [], x: [['lscpu', 'CPU details'], ['lscpu | grep CPU', 'CPU count lines']],
      see: ['nproc', 'uname'] },
    nproc: { s: 'count CPUs', syn: 'nproc',
      d: 'Print the number of processing units (4 in the sandbox).',
      o: [], x: [['nproc', 'prints 4']], see: ['lscpu'] },
    uname: { s: 'show system information', syn: 'uname [-a]',
      d: 'Print the kernel name, or the full system line with -a.',
      o: [['-a', 'print everything: kernel, host, version, architecture']],
      x: [['uname', 'Linux'], ['uname -a', 'the full system line']],
      see: ['hostnamectl', 'arch', 'lscpu'] },
    hostname: { s: 'print the host name', syn: 'hostname',
      d: 'Print the machine name (dev-box).',
      o: [], x: [['hostname', 'prints dev-box']], see: ['hostnamectl', 'uname'] },
    hostnamectl: { s: 'show host and OS details', syn: 'hostnamectl',
      d: 'Print the host name, operating system, kernel, and architecture.',
      o: [], x: [['hostnamectl', 'host and OS block']], see: ['hostname', 'uname'] },
    arch: { s: 'print the CPU architecture', syn: 'arch',
      d: 'Print the machine architecture (x86_64).',
      o: [], x: [['arch', 'prints x86_64']], see: ['uname', 'lscpu'] },
    uptime: { s: 'how long the system has run', syn: 'uptime',
      d: 'Print the time, uptime, user count, and load averages.',
      o: [], x: [['uptime', 'uptime and load']], see: ['top', 'w'] },
    whoami: { s: 'print the current user', syn: 'whoami',
      d: 'Print the logged-in user name (dev).',
      o: [], x: [['whoami', 'prints dev']], see: ['id', 'who'] },
    id: { s: 'show user and group IDs', syn: 'id',
      d: 'Print the uid, gid, and group memberships of the current user.',
      o: [], x: [['id', 'uid, gid, groups']], see: ['whoami', 'groups'] },
    groups: { s: 'list your groups', syn: 'groups',
      d: 'Print the groups the current user belongs to.',
      o: [], x: [['groups', 'dev sudo docker']], see: ['id', 'whoami'] },
    who: { s: 'list logged-in users', syn: 'who',
      d: 'Print who is logged in and from where.',
      o: [], x: [['who', 'the login session']], see: ['w', 'last', 'users'] },
    w: { s: 'who is on and what they do', syn: 'w',
      d: 'Print uptime plus a table of users and their current command.',
      o: [], x: [['w', 'users and activity']], see: ['who', 'uptime'] },
    last: { s: 'recent logins', syn: 'last',
      d: 'Print the recent login and boot history.',
      o: [], x: [['last', 'login history']], see: ['who', 'lastb'] },
    users: { s: 'list logged-in user names', syn: 'users',
      d: 'Print the names of logged-in users on one line.',
      o: [], x: [['users', 'prints dev']], see: ['who', 'whoami'] },
    env: { s: 'print environment variables', syn: 'env',
      d: 'Print every exported environment variable as NAME=value.',
      o: [], x: [['env', 'all exported variables'], ['env | grep PATH', 'find one variable']],
      see: ['printenv', 'export', 'set'] },
    printenv: { s: 'print one or all env variables', syn: 'printenv [NAME]',
      d: 'With a name, print that variable; with none, print them all.',
      o: [], x: [['printenv HOME', 'one variable'], ['printenv', 'all of them']],
      see: ['env', 'export'] },
    export: { s: 'set and export a variable', syn: 'export NAME=value',
      d: 'Create or update a variable and mark it exported so child commands and $NAME expansion see it.',
      o: [['-p', 'list all exported variables']],
      x: [['export TOKEN=abc', 'set a variable'], ['export X=1 && echo $X', 'set then use it']],
      see: ['env', 'unset', 'set'] },
    unset: { s: 'remove a variable', syn: 'unset NAME',
      d: 'Delete an environment variable.',
      o: [], x: [['unset TOKEN', 'remove a variable']], see: ['export', 'env'] },
    set: { s: 'show shell variables or options', syn: 'set [-o pipefail]',
      d: 'With no argument, list variables. It can also toggle the pipefail option.',
      o: [['-o pipefail', 'make a pipeline fail if any stage fails'], ['+o pipefail', 'turn pipefail back off']],
      x: [['set', 'list variables'], ['set -o pipefail', 'strict pipelines']],
      see: ['export', 'env'] },
    alias: { s: 'make a command shortcut', syn: 'alias [name=value]',
      d: 'Create a shortcut, or list all aliases when given no argument.',
      o: [], x: [['alias', 'list aliases'], ['alias ll="ls -la"', 'define one'], ['alias g=grep', 'short name for grep']],
      see: ['unalias', 'type'] },
    unalias: { s: 'remove an alias', syn: 'unalias <name>',
      d: 'Delete a previously defined alias.',
      o: [], x: [['unalias ll', 'remove an alias']], see: ['alias'] },
    type: { s: 'tell how a name resolves', syn: 'type <name>',
      d: 'Say whether a name is an alias, a function, a shell builtin, or a program on disk.',
      o: [], x: [['type cd', 'cd is a shell builtin'], ['type ls', 'ls is /usr/bin/ls']],
      see: ['which', 'alias'] },
    which: { s: 'find a command on the path', syn: 'which <name>',
      d: 'Print the path of a command, or nothing if it is not found.',
      o: [], x: [['which grep', '/usr/bin/grep'], ['which node', '/usr/bin/node']],
      see: ['type', 'man'] },
    man: { s: 'show the command reference', syn: 'man [cmd]',
      d: 'In this sandbox, man shows the same help pages as the help command.',
      o: [], x: [['man ls', 'the ls man page'], ['man', 'the full reference']],
      see: ['help'] },
    history: { s: 'show past commands', syn: 'history',
      d: 'Print the numbered list of commands run this session.',
      o: [], x: [['history', 'all past commands'], ['history | tail -5', 'the last five']],
      see: ['type'] },
    date: { s: 'print the date and time', syn: 'date',
      d: 'Print the current date and time.',
      o: [], x: [['date', 'the current timestamp']], see: ['cal', 'uptime'] },
    cal: { s: 'print a calendar', syn: 'cal',
      d: 'Print the current month as a calendar grid.',
      o: [], x: [['cal', 'this month']], see: ['date'] },
    seq: { s: 'print a sequence of numbers', syn: 'seq [first [step]] last',
      d: 'Print numbers from first to last. One argument counts from 1; a middle argument is the step.',
      o: [], x: [['seq 5', '1 through 5'], ['seq 2 2 10', 'even numbers to 10'], ['seq 3 | tac', '3 2 1']],
      see: ['echo', 'expr'] },
    expr: { s: 'evaluate an integer expression', syn: 'expr <expression>',
      d: 'Do arithmetic with + - * / % and parentheses. Non-math characters are stripped.',
      o: [], x: [['expr 6 + 7', '13'], ['expr 10 % 3', '1'], ['expr 3 "*" 4', '12 (quote the star)']],
      see: ['bc', 'seq'] },
    bc: { s: 'a calculator for a pipe', syn: 'echo "EXPR" | bc',
      d: 'Evaluate an arithmetic expression from the pipe. Supports + - * / % and ^ for power.',
      o: [], x: [['echo "2+2" | bc', '4'], ['echo "2^8" | bc', '256'], ['echo "(3+4)*2" | bc', '14']],
      see: ['expr', 'awk'] },
    test: { s: 'evaluate a condition', syn: 'test EXPR   or   [ EXPR ]',
      d: 'Return success or failure for a condition. Used in && / || chains. [ is the same command and needs a closing ].',
      o: [['-f F', 'true if F is a regular file'], ['-d F', 'true if F is a directory'], ['-e F', 'true if F exists'], ['-z S', 'true if the string is empty'], ['-n S', 'true if the string is non-empty'], ['a -eq b', 'numeric equal (also -ne -lt -le -gt -ge)'], ['a = b', 'string equal (also !=)']],
      x: [['test -f notes.txt && echo yes', 'print yes if the file exists'], ['[ 3 -lt 5 ] && echo less', 'numeric compare'], ['[ -d /home ] && echo dir', 'directory test']],
      see: ['echo'] },
    basename: { s: 'strip the directory from a path', syn: 'basename <path>',
      d: 'Print just the final name of a path.',
      o: [], x: [['basename /home/dev/notes.txt', 'notes.txt']], see: ['dirname', 'realpath'] },
    dirname: { s: 'strip the name from a path', syn: 'dirname <path>',
      d: 'Print the directory part of a path.',
      o: [], x: [['dirname /home/dev/notes.txt', '/home/dev']], see: ['basename'] },
    mktemp: { s: 'make a temporary file', syn: 'mktemp [-d]',
      d: 'Create a uniquely named temp file under /tmp and print its path.',
      o: [['-d', 'make a temporary directory instead of a file']],
      x: [['mktemp', 'a new /tmp file'], ['mktemp -d', 'a new /tmp directory']],
      see: ['touch', 'mkdir'] },
    systemctl: { s: 'inspect services', syn: 'systemctl [status NAME]',
      d: 'List services, or show the status of one. Simulated with sample services.',
      o: [['status NAME', 'show one service as active']],
      x: [['systemctl', 'the service list'], ['systemctl status nginx', 'one service']],
      see: ['service', 'journalctl'] },
    service: { s: 'inspect a service', syn: 'service <name> status',
      d: 'Show a service as active. A thin wrapper over systemctl here.',
      o: [], x: [['service ssh status', 'ssh is active']], see: ['systemctl'] },
    journalctl: { s: 'read the system log', syn: 'journalctl',
      d: 'Print the auth log sample (the sandbox maps the journal to /var/log/auth.log).',
      o: [], x: [['journalctl', 'the log'], ['journalctl | grep Failed', 'failed logins']],
      see: ['dmesg', 'last'] },
    dmesg: { s: 'print kernel boot messages', syn: 'dmesg',
      d: 'Print a sample of kernel ring-buffer messages.',
      o: [], x: [['dmesg', 'boot messages'], ['dmesg | grep eth0', 'the NIC line']],
      see: ['journalctl'] },
    crontab: { s: 'show scheduled jobs', syn: 'crontab -l',
      d: 'List the scheduled cron jobs with -l.',
      o: [['-l', 'list the current jobs']],
      x: [['crontab -l', 'the sample schedule']], see: ['systemctl'] },
    sudo: { s: 'run a command as root', syn: 'sudo <command>',
      d: 'Run the rest of the line with elevated privilege (no password in the sandbox). -l lists allowed commands.',
      o: [['-l', 'list what the user may run']],
      x: [['sudo systemctl status ssh', 'run as root'], ['sudo -l', 'list privileges']],
      see: ['su', 'id'] },
    curl: { s: 'fetch a URL', syn: 'curl <url>',
      d: 'Make an HTTP request and print the body. The sandbox answers api/health and example URLs.',
      o: [], x: [['curl https://api.internal/health', 'a JSON status'], ['curl https://api.internal/health | jq .status', 'pull one field']],
      see: ['wget', 'jq'] },
    wget: { s: 'download a URL to a file', syn: 'wget <url>',
      d: 'Fetch a URL and save it to a file named after the last path segment.',
      o: [], x: [['wget https://api.internal/health', 'save the response'], ['wget https://example.internal/ && ls', 'download then list']],
      see: ['curl'] },
    ping: { s: 'test reachability', syn: 'ping <host>',
      d: 'Send four ICMP echoes and print replies and a summary.',
      o: [], x: [['ping 10.0.0.5', 'four replies'], ['ping api.internal | tail -2', 'just the summary']],
      see: ['traceroute', 'nc'] },
    ssh: { s: 'open a remote shell (simulated)', syn: 'ssh <user@host>',
      d: 'Show the host-key prompt and connection banner. No real session opens in the sandbox.',
      o: [], x: [['ssh dev@10.0.0.5', 'connect to a host']], see: ['scp', 'nc'] },
    scp: { s: 'copy a file over SSH (simulated)', syn: 'scp <src> <dst>',
      d: 'Report a file transfer between a local and remote path. rsync behaves the same here.',
      o: [], x: [['scp notes.txt dev@10.0.0.5:/tmp/', 'upload a file']], see: ['rsync', 'ssh'] },
    rsync: { s: 'sync files (simulated)', syn: 'rsync <src> <dst>',
      d: 'Report a transfer between two paths. A thin wrapper over scp here.',
      o: [], x: [['rsync site/ dev@10.0.0.5:/var/www/', 'sync a folder']], see: ['scp'] },
    ftp: { s: 'connect to an FTP server (simulated)', syn: 'ftp <host>',
      d: 'Print a connection banner for an FTP host.',
      o: [], x: [['ftp 10.0.0.5', 'connect']], see: ['scp'] },
    nmap: { s: 'scan a host for open ports', syn: 'nmap [-sV] <ip>',
      d: 'Print an open-port report with service versions. Only the bundled sandbox host answers; other IPs show no data.',
      o: [['-sV', 'probe service and version (the sample already shows versions)']],
      x: [['nmap 10.0.0.5', 'the port table'], ['nmap 10.0.0.5 | grep open', 'only open ports']],
      see: ['nc', 'ss', 'ping'] },
    nc: { s: 'test a TCP port', syn: 'nc <host> <port>',
      d: 'Report whether a TCP port accepts a connection. ncat is the same here.',
      o: [], x: [['nc 10.0.0.5 80', 'port 80 succeeded'], ['nc 10.0.0.5 22', 'test SSH']],
      see: ['nmap', 'ss'] },
    ss: { s: 'list listening sockets', syn: 'ss',
      d: 'Print the listening TCP sockets. netstat prints the same table here.',
      o: [], x: [['ss', 'listening ports'], ['ss | grep 22', 'is SSH listening']],
      see: ['netstat', 'ip'] },
    netstat: { s: 'list listening sockets', syn: 'netstat',
      d: 'Print listening TCP sockets (same sample as ss).',
      o: [], x: [['netstat', 'listening ports']], see: ['ss', 'route'] },
    ip: { s: 'show interfaces or routes', syn: 'ip [addr|route]',
      d: 'Print interface addresses, or the routing table when the argument starts with r.',
      o: [['addr', 'interface addresses (the default)'], ['route', 'the routing table']],
      x: [['ip addr', 'interfaces and IPs'], ['ip route', 'the routes']],
      see: ['ifconfig', 'route', 'ss'] },
    ifconfig: { s: 'show interfaces', syn: 'ifconfig',
      d: 'Print interface addresses (same data as ip).',
      o: [], x: [['ifconfig', 'interfaces']], see: ['ip', 'route'] },
    route: { s: 'show the routing table', syn: 'route',
      d: 'Print the kernel IP routing table.',
      o: [], x: [['route', 'routes and gateways']], see: ['ip', 'netstat'] },
    arp: { s: 'show the ARP cache', syn: 'arp',
      d: 'Print the IP-to-MAC neighbor table.',
      o: [], x: [['arp', 'neighbor cache']], see: ['ip'] },
    dig: { s: 'query DNS', syn: 'dig <name> [type]',
      d: 'Print a DNS answer section for a name.',
      o: [], x: [['dig api.internal', 'an A record'], ['dig api.internal A', 'ask for A explicitly']],
      see: ['nslookup', 'host', 'whois'] },
    nslookup: { s: 'look up a DNS name', syn: 'nslookup <name>',
      d: 'Print the server, name, and address for a lookup.',
      o: [], x: [['nslookup api.internal', 'resolve a name']], see: ['dig', 'host'] },
    host: { s: 'resolve a name to an address', syn: 'host <name>',
      d: 'Print the address a name resolves to in one line.',
      o: [], x: [['host api.internal', 'has address 10.0.0.5']], see: ['dig', 'nslookup'] },
    whois: { s: 'look up domain registration', syn: 'whois <domain>',
      d: 'Print registrar and status for a domain (simulated).',
      o: [], x: [['whois example.internal', 'registration info']], see: ['dig'] },
    traceroute: { s: 'trace the path to a host', syn: 'traceroute <host>',
      d: 'Print each hop between here and a destination.',
      o: [], x: [['traceroute 10.0.0.5', 'the hops']], see: ['ping', 'ip'] },
    openssl: { s: 'TLS and crypto toolkit (simulated)', syn: 'openssl <subcommand>',
      d: 'Print an OpenSSL banner for the given subcommand. The sandbox does not run real crypto.',
      o: [], x: [['openssl version', 'the version banner'], ['openssl s_client', 'a connect banner']],
      see: ['curl'] },
    iptables: { s: 'show firewall rules', syn: 'iptables -L',
      d: 'Print the sample INPUT chain and its rules.',
      o: [], x: [['iptables -L', 'the firewall rules']], see: ['ufw'] },
    ufw: { s: 'show the firewall status', syn: 'ufw status',
      d: 'Print whether the firewall is active and which ports are allowed.',
      o: [], x: [['ufw status', 'allowed ports']], see: ['iptables'] },
    clear: { s: 'clear the screen', syn: 'clear',
      d: 'Clear the terminal. Nothing on disk changes.',
      o: [], x: [['clear', 'clear the screen']], see: ['reset'] },
    cls: { s: 'clear the screen', syn: 'cls',
      d: 'Clear the terminal (same as clear).',
      o: [], x: [['cls', 'clear the screen']], see: ['clear', 'reset'] },
    reset: { s: 'restore the sandbox disk', syn: 'reset',
      d: 'Reset the virtual disk to its first state, undoing files you created or deleted.',
      o: [], x: [['reset', 'restore the starting files']], see: ['clear'] },
    exit: { s: 'leave a subshell', syn: 'exit [code]',
      d: 'Exit a subshell with an optional status code. The top-level sandbox shell stays open.',
      o: [], x: [['exit', 'leave a subshell'], ['exit 1', 'exit with status 1']], see: ['reset'] },
    help: { s: 'show the command reference', syn: 'help [cmd]',
      d: 'With no argument, list every command by section. With a name, show that command full man page: flags, examples, and chaining.',
      o: [], x: [['help', 'the whole reference'], ['help grep', 'the grep man page']], see: ['man'] },
    'security-tools': { s: 'list the bundled evidence and labs', syn: 'security-tools',
      d: 'List the offline security tools and the sample evidence files they read: captures, indicator rules, event logs, and audit data.',
      o: [], x: [['security-tools', 'the tool and evidence menu']],
      see: ['capinfos', 'tshark', 'tcpdump', 'yara', 'jq', 'lastb', 'password-audit'] },
    capinfos: { s: 'report capture file metadata', syn: 'capinfos [-t] [-c] [-E] [-d] <capture...>',
      d: 'Print metadata for a bundled packet capture such as incident.pcapng.',
      o: [['-t', 'show the capture file type'], ['-c', 'count packets'], ['-E', 'show the link-layer encapsulation'], ['-d', 'sum original packet lengths in bytes']],
      x: [['capinfos -t -c incident.pcapng', 'type and packet count'], ['capinfos -tc baseline.pcapng incident.pcapng', 'two files at once']],
      see: ['tshark', 'tcpdump', 'security-tools'] },
    tshark: { s: 'decode packets and extract fields', syn: 'tshark -r <capture> [-Y filter] [-T fields -e field ...]',
      d: 'Read a bundled capture, apply a display filter, and print packets or selected fields.',
      o: [['-r FILE', 'read a bundled capture file'], ['-Y FILTER', 'apply a display filter'], ['-T fields', 'field-oriented output'], ['-e FIELD', 'select a field; repeat for more columns'], ['-E header=y', 'add a header row of field names']],
      x: [['tshark -r incident.pcapng -Y dns', 'only DNS packets'], ['tshark -r incident.pcapng -Y dns -T fields -e frame.number -e dns.qry.name', 'two columns']],
      see: ['tcpdump', 'capinfos', 'security-tools'] },
    tcpdump: { s: 'print packets matching a filter', syn: 'tcpdump [-nn] [-c N] -r <capture> [filter]',
      d: 'Read a bundled capture and print packet summaries that match a capture filter.',
      o: [['-nn', 'numeric addresses and ports, no name lookups'], ['-r FILE', 'read a saved capture'], ['-c N', 'stop after N matching packets'], ['tcp and dst port 443', 'a filter: TCP to port 443']],
      x: [['tcpdump -nn -r incident.pcapng tcp and dst port 443', 'HTTPS packets'], ['tcpdump -nn -c 5 -r incident.pcapng', 'first five packets']],
      see: ['tshark', 'capinfos'] },
    yara: { s: 'match indicator rules against an artifact', syn: 'yara [-s] [-c] <rules> <file>',
      d: 'Compare a bundled artifact with training YARA rules and report matches.',
      o: [['-s', 'print the matching strings and their offsets'], ['-c', 'print the number of matching rules']],
      x: [['yara -s indicators.yar incident-artifact.txt', 'matches with offsets'], ['yara -c indicators.yar incident-artifact.txt', 'count matches']],
      see: ['strings', 'grep', 'security-tools'] },
    jq: { s: 'filter JSON', syn: "jq [-r] [-c] '<filter>' [file]",
      d: 'Read JSON from a file or pipe and apply a filter. Quote the filter in single quotes so its pipes and quotes reach jq.',
      o: [['-r', 'raw output: strings without surrounding quotes'], ['-c', 'compact single-line JSON'], ['.field', 'select an object field'], ['.items[]', 'yield each member of an array'], ['select(COND)', 'keep values where the condition holds']],
      x: [['jq -r \'select(.event_type == "alert") | .alert.signature\' eve.json', 'alert signatures'], ['curl https://api.internal/health | jq .status', 'one field from a response']],
      see: ['curl', 'grep', 'security-tools'] },
    lastb: { s: 'show failed logins', syn: 'lastb [-n N] [user]',
      d: 'Read recent failed login records from the bundled evidence.',
      o: [['-n N', 'show at most N records'], ['USER', 'restrict to a user name']],
      x: [['lastb -n 3', 'the three most recent'], ['lastb -n 2 ops', 'failures for the ops account']],
      see: ['last', 'journalctl'] },
    'password-audit': { s: 'export synthetic password findings', syn: 'password-audit --format <csv|json>',
      d: 'Print synthetic password-policy findings for the training sample, as CSV or JSON.',
      o: [['--format csv', 'comma-separated, for text pipelines'], ['--format json', 'structured, ready for jq']],
      x: [['password-audit --format csv', 'CSV findings'], ['password-audit --format json | jq .', 'pretty JSON']],
      see: ['jq', 'security-tools'] }
  });

  // PowerShell man pages. Keys are lowercase; `help <Cmdlet>` lowercases the topic before lookup.
  G.MAN.powershell = {
    'get-location': { s: 'print the current directory', syn: 'Get-Location', d: 'Print the path of the current location. Aliases: pwd, gl.', o: [], x: [['Get-Location', 'current path'], ['pwd', 'same, via alias']], see: ['Set-Location'] },
    'set-location': { s: 'change directory', syn: 'Set-Location <path>', d: 'Move to another directory. Aliases: cd, sl, chdir. Supports ~ and ..', o: [], x: [['Set-Location C:\\Users', 'go to a path'], ['cd ..', 'up one level']], see: ['Get-Location', 'Push-Location'] },
    'push-location': { s: 'save and change directory', syn: 'Push-Location [path]', d: 'Push the current directory onto a stack, then optionally move. Alias: pushd.', o: [], x: [['Push-Location C:\\Windows', 'remember here, then move']], see: ['Pop-Location'] },
    'pop-location': { s: 'return to a pushed directory', syn: 'Pop-Location', d: 'Pop the last pushed directory off the stack and go back. Alias: popd.', o: [], x: [['Pop-Location', 'go back']], see: ['Push-Location'] },
    'get-childitem': { s: 'list directory items', syn: 'Get-ChildItem [-Force] [-Recurse] [-Filter pat] [path]', d: 'List files and folders as objects. Aliases: ls, dir, gci.', o: [['-Force', 'include hidden items'], ['-Recurse', 'walk subdirectories'], ['-Filter PAT', 'match names by a wildcard like *.txt']], x: [['Get-ChildItem', 'list here'], ['Get-ChildItem -Recurse -Filter *.txt', 'all text files below'], ['ls | Where-Object { $_.Length -gt 0 }', 'non-empty entries']], see: ['Get-Item', 'Select-String'] },
    'get-item': { s: 'get one item', syn: 'Get-Item <path>', d: 'Return the file or folder object at a path. Alias: gi.', o: [], x: [['Get-Item notes.txt', 'one item']], see: ['Get-ChildItem', 'Get-ItemProperty'] },
    'get-itemproperty': { s: 'get item properties', syn: 'Get-ItemProperty <path>', d: 'Return the properties of an item. Alias: gp. Same shape as Get-Item here.', o: [], x: [['Get-ItemProperty notes.txt', 'item properties']], see: ['Get-Item'] },
    'get-content': { s: 'read a file', syn: 'Get-Content <path...>', d: 'Read file contents. Aliases: cat, gc, type. Multiple files are joined.', o: [], x: [['Get-Content notes.txt', 'print a file'], ['cat notes.txt | Select-String error', 'filter lines']], see: ['Set-Content', 'Select-String'] },
    'set-content': { s: 'write a file', syn: 'Set-Content <path> <text>', d: 'Overwrite a file with text. Aliases: sc.', o: [], x: [['Set-Content a.txt "hello"', 'write a file']], see: ['Add-Content', 'Clear-Content'] },
    'add-content': { s: 'append to a file', syn: 'Add-Content <path> <text>', d: 'Add a line to the end of a file. Alias: ac.', o: [], x: [['Add-Content a.txt "more"', 'append a line']], see: ['Set-Content'] },
    'clear-content': { s: 'empty a file', syn: 'Clear-Content <path>', d: 'Remove the contents of a file but keep the file. Alias: clc.', o: [], x: [['Clear-Content a.txt', 'empty the file']], see: ['Set-Content', 'Remove-Item'] },
    'new-item': { s: 'create a file or folder', syn: 'New-Item [-ItemType Directory] <path>', d: 'Create an item. Alias: ni. mkdir/md create directories.', o: [['-ItemType Directory', 'make a folder instead of a file']], x: [['New-Item log.txt', 'new file'], ['New-Item -ItemType Directory logs', 'new folder'], ['mkdir logs', 'folder via alias']], see: ['Remove-Item', 'Copy-Item'] },
    'copy-item': { s: 'copy a file', syn: 'Copy-Item <src> <dst>', d: 'Copy a file to a new path. Aliases: cp, copy, cpi.', o: [], x: [['Copy-Item a.txt b.txt', 'duplicate a file']], see: ['Move-Item', 'Remove-Item'] },
    'move-item': { s: 'move or rename a file', syn: 'Move-Item <src> <dst>', d: 'Move a file to a new path. Aliases: mv, move, mi.', o: [], x: [['Move-Item a.txt c.txt', 'move or rename']], see: ['Rename-Item', 'Copy-Item'] },
    'rename-item': { s: 'rename a file', syn: 'Rename-Item <path> <newname>', d: 'Rename an item. Aliases: ren, rni.', o: [], x: [['Rename-Item a.txt b.txt', 'rename']], see: ['Move-Item'] },
    'remove-item': { s: 'delete a file or folder', syn: 'Remove-Item <path>', d: 'Delete an item. Aliases: rm, del, ri, erase, rd, rmdir.', o: [], x: [['Remove-Item old.txt', 'delete a file']], see: ['Clear-Content', 'New-Item'] },
    'test-path': { s: 'check if a path exists', syn: 'Test-Path <path>', d: 'Return True or False for whether a path exists.', o: [], x: [['Test-Path notes.txt', 'True or False']], see: ['Resolve-Path'] },
    'resolve-path': { s: 'resolve a full path', syn: 'Resolve-Path <path>', d: 'Expand a path to its full form. Alias: rvpa.', o: [], x: [['Resolve-Path ~', 'the home path']], see: ['Split-Path', 'Join-Path'] },
    'split-path': { s: 'split a path', syn: 'Split-Path <path> [-Leaf]', d: 'Return the parent of a path, or the final name with -Leaf.', o: [['-Leaf', 'return just the final name']], x: [['Split-Path C:\\a\\b.txt', 'the parent folder'], ['Split-Path C:\\a\\b.txt -Leaf', 'b.txt']], see: ['Join-Path'] },
    'join-path': { s: 'join path segments', syn: 'Join-Path <a> <b>', d: 'Join parts into one path with backslashes.', o: [], x: [['Join-Path C:\\Users dev', 'C:\\Users\\dev']], see: ['Split-Path'] },
    'select-string': { s: 'search text with regex', syn: 'Select-String <pattern> <path>', d: 'Find matching lines in a file or pipeline. Alias: sls. The bash analogue is grep.', o: [['-Pattern', 'the regex to match'], ['-Path', 'the file to search']], x: [['Select-String error notes.txt', 'lines with error'], ['Get-Content notes.txt | Select-String warn', 'filter a pipeline']], see: ['Get-Content'] },
    'get-filehash': { s: 'hash a file', syn: 'Get-FileHash <path>', d: 'Compute a SHA256 hash of a file.', o: [], x: [['Get-FileHash notes.txt', 'the SHA256 hash']], see: ['Compress-Archive'] },
    'compress-archive': { s: 'zip files', syn: 'Compress-Archive <src> <dest.zip>', d: 'Create a zip archive from a path.', o: [], x: [['Compress-Archive logs out.zip', 'zip a folder']], see: ['Expand-Archive'] },
    'expand-archive': { s: 'unzip an archive', syn: 'Expand-Archive <file.zip>', d: 'Extract a zip archive into the current directory.', o: [], x: [['Expand-Archive out.zip', 'unzip here']], see: ['Compress-Archive'] },
    'select-object': { s: 'pick properties or rows', syn: '... | Select-Object [prop...] [-First N] [-Last N] [-Unique]', d: 'Keep chosen properties of each object, or the first/last/unique rows. Alias: select.', o: [['prop,prop', 'keep only these properties'], ['-First N', 'keep the first N rows'], ['-Last N', 'keep the last N rows'], ['-Unique', 'drop duplicate rows']], x: [['Get-Process | Select-Object Name,Id', 'two columns'], ['Get-Process | Select-Object -First 3', 'first three']], see: ['Where-Object', 'Sort-Object'] },
    'where-object': { s: 'filter objects by a test', syn: '... | Where-Object { $_.Prop -op value }', d: 'Keep only objects whose property passes a comparison. Aliases: where, ?.', o: [['-eq -ne', 'equal / not equal (case-insensitive)'], ['-gt -lt -ge -le', 'numeric compare'], ['-like', 'wildcard match'], ['-match', 'regex match']], x: [['Get-Process | Where-Object { $_.CPU -gt 1 }', 'busy processes'], ['Get-Service | Where-Object { $_.Status -eq "Running" }', 'running services']], see: ['Select-Object', 'ForEach-Object'] },
    'sort-object': { s: 'sort objects by a property', syn: '... | Sort-Object <prop> [-Descending]', d: 'Order objects by a property. Alias: sort.', o: [['-Descending', 'largest or last first']], x: [['Get-Process | Sort-Object CPU -Descending', 'busiest first'], ['Get-Service | Sort-Object Name', 'alphabetical']], see: ['Select-Object', 'Group-Object'] },
    'measure-object': { s: 'count pipeline rows', syn: '... | Measure-Object', d: 'Count the objects (or lines) in the pipeline. Alias: measure.', o: [], x: [['Get-Process | Measure-Object', 'how many processes'], ['Get-Content notes.txt | Measure-Object', 'how many lines']], see: ['Select-Object'] },
    'foreach-object': { s: 'act on each object', syn: '... | ForEach-Object { $_.Prop }', d: 'Pull or transform a property from every object. Aliases: %, foreach.', o: [], x: [['Get-Process | ForEach-Object { $_.Name }', 'just the names']], see: ['Where-Object', 'Select-Object'] },
    'group-object': { s: 'group objects by a property', syn: '... | Group-Object <prop>', d: 'Group objects and count each group. Alias: group.', o: [], x: [['Get-Service | Group-Object Status', 'count by status']], see: ['Sort-Object', 'Measure-Object'] },
    'format-table': { s: 'print as a table', syn: '... | Format-Table', d: 'Render objects as an aligned table. Alias: ft.', o: [], x: [['Get-Process | Format-Table', 'a table']], see: ['Format-List'] },
    'format-list': { s: 'print as a property list', syn: '... | Format-List', d: 'Render each object as property: value lines. Alias: fl.', o: [], x: [['Get-Service Dhcp | Format-List', 'one service, all fields']], see: ['Format-Table'] },
    'get-member': { s: 'show object properties', syn: '... | Get-Member', d: 'List the properties and methods of pipeline objects. Alias: gm.', o: [], x: [['Get-Process | Get-Member', 'the property names']], see: ['Select-Object'] },
    'convertto-json': { s: 'serialize to JSON', syn: '... | ConvertTo-Json', d: 'Turn objects into JSON text.', o: [], x: [['Get-Service | ConvertTo-Json', 'services as JSON']], see: ['ConvertFrom-Json', 'ConvertTo-Csv'] },
    'convertfrom-json': { s: 'parse JSON', syn: '... | ConvertFrom-Json', d: 'Turn JSON text into objects.', o: [], x: [['Invoke-RestMethod | ConvertTo-Json | ConvertFrom-Json', 'round-trip']], see: ['ConvertTo-Json'] },
    'convertto-csv': { s: 'serialize to CSV', syn: '... | ConvertTo-Csv', d: 'Turn objects into quoted CSV rows.', o: [], x: [['Get-Service | ConvertTo-Csv', 'services as CSV']], see: ['ConvertTo-Json'] },
    'out-file': { s: 'write pipeline to a file', syn: '... | Out-File <path>', d: 'Send pipeline output to a file.', o: [], x: [['Get-Process | Out-File procs.txt', 'save to a file']], see: ['Tee-Object', 'Set-Content'] },
    'out-string': { s: 'render pipeline as text', syn: '... | Out-String', d: 'Convert objects to their table text form.', o: [], x: [['Get-Service | Out-String', 'the table as a string']], see: ['Format-Table'] },
    'out-null': { s: 'discard pipeline output', syn: '... | Out-Null', d: 'Throw away output you do not want to see.', o: [], x: [['Get-Process | Out-Null', 'produces nothing']], see: ['Out-File'] },
    'tee-object': { s: 'save and pass along', syn: '... | Tee-Object <file>', d: 'Write the pipeline to a file and keep passing it on. Alias: tee.', o: [], x: [['Get-Process | Tee-Object p.txt | Measure-Object', 'save and count']], see: ['Out-File'] },
    'get-process': { s: 'list processes', syn: 'Get-Process [name]', d: 'List running processes as objects. Aliases: ps, gps.', o: [], x: [['Get-Process', 'all processes'], ['Get-Process chrome', 'one by name'], ['Get-Process | Sort-Object CPU -Descending', 'busiest first']], see: ['Stop-Process', 'Start-Process'] },
    'start-process': { s: 'start a process', syn: 'Start-Process <name>', d: 'Launch a process and report its new Id. Aliases: saps, start.', o: [], x: [['Start-Process notepad', 'launch notepad']], see: ['Get-Process', 'Stop-Process'] },
    'stop-process': { s: 'stop a process', syn: 'Stop-Process <id|name>', d: 'Stop a process by Id or name. Aliases: kill, spps.', o: [], x: [['Stop-Process 2210', 'stop by Id'], ['Stop-Process chrome', 'stop by name']], see: ['Get-Process'] },
    'get-service': { s: 'list services', syn: 'Get-Service [name]', d: 'List Windows services and their status. Alias: gsv.', o: [], x: [['Get-Service', 'all services'], ['Get-Service | Where-Object { $_.Status -eq "Stopped" }', 'stopped ones']], see: ['Start-Service', 'Stop-Service'] },
    'start-service': { s: 'start a service', syn: 'Start-Service <name>', d: 'Set a service to Running. Alias: sasv.', o: [], x: [['Start-Service Spooler', 'start the spooler']], see: ['Stop-Service', 'Restart-Service'] },
    'stop-service': { s: 'stop a service', syn: 'Stop-Service <name>', d: 'Set a service to Stopped. Alias: spsv.', o: [], x: [['Stop-Service Spooler', 'stop the spooler']], see: ['Start-Service'] },
    'restart-service': { s: 'restart a service', syn: 'Restart-Service <name>', d: 'Stop and start a service (ends Running).', o: [], x: [['Restart-Service Dnscache', 'restart DNS client']], see: ['Start-Service', 'Stop-Service'] },
    'get-computerinfo': { s: 'show OS and hardware', syn: 'Get-ComputerInfo', d: 'Print product name, version, host, CPU count, and memory.', o: [], x: [['Get-ComputerInfo', 'system summary']], see: ['Get-CimInstance'] },
    'get-ciminstance': { s: 'query WMI/CIM', syn: 'Get-CimInstance <class>', d: 'Return a CIM object for a class. Alias: gwmi.', o: [], x: [['Get-CimInstance Win32_OperatingSystem', 'OS details']], see: ['Get-ComputerInfo'] },
    'get-hotfix': { s: 'list installed patches', syn: 'Get-HotFix', d: 'List installed Windows updates.', o: [], x: [['Get-HotFix', 'installed KBs']], see: ['Get-ComputerInfo'] },
    'get-eventlog': { s: 'read the event log', syn: 'Get-EventLog', d: 'Return sample security and service event records.', o: [], x: [['Get-EventLog', 'recent events'], ['Get-EventLog | Where-Object { $_.EntryType -eq "FailureAudit" }', 'failed logons']], see: ['Get-WinEvent'] },
    'get-winevent': { s: 'read the event log', syn: 'Get-WinEvent', d: 'Return event records (same sample as Get-EventLog).', o: [], x: [['Get-WinEvent', 'recent events']], see: ['Get-EventLog'] },
    'get-scheduledtask': { s: 'list scheduled tasks', syn: 'Get-ScheduledTask', d: 'List the scheduled tasks and their state.', o: [], x: [['Get-ScheduledTask', 'the task list']], see: ['Get-Service'] },
    'get-localuser': { s: 'list local users', syn: 'Get-LocalUser', d: 'List local Windows accounts.', o: [], x: [['Get-LocalUser', 'accounts']], see: ['Get-LocalGroup'] },
    'get-localgroup': { s: 'list local groups', syn: 'Get-LocalGroup', d: 'List local Windows groups.', o: [], x: [['Get-LocalGroup', 'groups']], see: ['Get-LocalUser'] },
    'get-acl': { s: 'show permissions', syn: 'Get-Acl [path]', d: 'Show the owner and access rules of a path.', o: [], x: [['Get-Acl notes.txt', 'owner and access']], see: ['Get-Item'] },
    'get-nettcpconnection': { s: 'list TCP connections', syn: 'Get-NetTCPConnection', d: 'List TCP sockets with local/remote address and state.', o: [], x: [['Get-NetTCPConnection', 'sockets'], ['Get-NetTCPConnection | Where-Object { $_.State -eq "Listen" }', 'listeners']], see: ['Get-NetIPAddress', 'netstat'] },
    'get-netipaddress': { s: 'list IP addresses', syn: 'Get-NetIPAddress', d: 'List interface IP addresses.', o: [], x: [['Get-NetIPAddress', 'the IPs']], see: ['Get-NetIPConfiguration'] },
    'get-netipconfiguration': { s: 'show IP configuration', syn: 'Get-NetIPConfiguration', d: 'Show interface, IPv4 address, gateway, and DNS.', o: [], x: [['Get-NetIPConfiguration', 'the IP config']], see: ['Get-NetIPAddress', 'ipconfig'] },
    'get-netadapter': { s: 'list network adapters', syn: 'Get-NetAdapter', d: 'List network adapters, status, and link speed.', o: [], x: [['Get-NetAdapter', 'adapters']], see: ['Get-NetIPAddress'] },
    'get-netroute': { s: 'show the routing table', syn: 'Get-NetRoute', d: 'List IP routes and next hops.', o: [], x: [['Get-NetRoute', 'routes']], see: ['Get-NetIPConfiguration'] },
    'get-netfirewallrule': { s: 'list firewall rules', syn: 'Get-NetFirewallRule', d: 'List firewall rules and whether they are enabled.', o: [], x: [['Get-NetFirewallRule', 'firewall rules']], see: ['Get-NetTCPConnection'] },
    'test-connection': { s: 'ping a host', syn: 'Test-Connection <host>', d: 'Send ICMP pings and report replies. Alias: ping.', o: [], x: [['Test-Connection 10.0.0.5', 'ping a host']], see: ['Test-NetConnection'] },
    'test-netconnection': { s: 'test a TCP port', syn: 'Test-NetConnection <host> -Port <n>', d: 'Test whether a TCP port is reachable. Alias: tnc.', o: [['-Port N', 'the TCP port to test']], x: [['Test-NetConnection api.internal -Port 443', 'test HTTPS']], see: ['Test-Connection'] },
    'resolve-dnsname': { s: 'DNS lookup', syn: 'Resolve-DnsName <name>', d: 'Resolve a name to an address. Alias: nslookup.', o: [], x: [['Resolve-DnsName api.internal', 'resolve a name']], see: ['Test-Connection'] },
    'invoke-webrequest': { s: 'make an HTTP request', syn: 'Invoke-WebRequest <url>', d: 'Fetch a URL and show status, headers, and content. Aliases: iwr, curl, wget.', o: [], x: [['Invoke-WebRequest https://api.internal', 'fetch a page']], see: ['Invoke-RestMethod'] },
    'invoke-restmethod': { s: 'call a REST API', syn: 'Invoke-RestMethod <url>', d: 'Fetch a URL and parse the JSON into objects. Alias: irm.', o: [], x: [['Invoke-RestMethod https://api.internal', 'parsed JSON'], ['Invoke-RestMethod | Select-Object status', 'one field']], see: ['Invoke-WebRequest'] },
    'get-command': { s: 'discover cmdlets', syn: 'Get-Command [pattern]', d: 'List cmdlets and aliases, optionally by wildcard. Alias: gcm.', o: [], x: [['Get-Command', 'all commands'], ['Get-Command Get-*', 'the Get- cmdlets']], see: ['Get-Help', 'Get-Alias'] },
    'get-help': { s: 'show cmdlet help', syn: 'Get-Help <name>', d: 'Show simulated help for a cmdlet. Alias: man.', o: [], x: [['Get-Help Get-Process', 'help for a cmdlet']], see: ['Get-Command'] },
    'get-alias': { s: 'list aliases', syn: 'Get-Alias [name]', d: 'List command aliases and what they map to. Alias: gal.', o: [], x: [['Get-Alias', 'all aliases'], ['Get-Alias ls', 'what ls maps to']], see: ['Set-Alias'] },
    'set-alias': { s: 'define an alias', syn: 'Set-Alias <name> <target>', d: 'Create a command alias. Alias: sal.', o: [], x: [['Set-Alias g Get-Process', 'make g a shortcut']], see: ['Get-Alias'] },
    'get-variable': { s: 'show variables', syn: 'Get-Variable [name]', d: 'List session variables and values. Alias: gv.', o: [], x: [['Get-Variable', 'all variables'], ['Get-Variable HOME', 'one variable']], see: ['Set-Variable'] },
    'set-variable': { s: 'set a variable', syn: 'Set-Variable <name> <value>', d: 'Create or change a variable. Alias: sv. You can also write $x = value directly.', o: [], x: [['Set-Variable x 5', 'set x'], ['$y = 10', 'the shorthand form']], see: ['Get-Variable'] },
    'get-history': { s: 'show command history', syn: 'Get-History', d: 'List the commands run this session. Aliases: history, h.', o: [], x: [['Get-History', 'past commands']], see: ['Get-Command'] },
    'get-date': { s: 'print the date', syn: 'Get-Date', d: 'Print the current date and time.', o: [], x: [['Get-Date', 'the timestamp']], see: ['Get-Random'] },
    'get-random': { s: 'random number', syn: 'Get-Random [max]', d: 'Print a random integer below max (default 100).', o: [], x: [['Get-Random', '0 to 99'], ['Get-Random 10', '0 to 9']], see: ['Get-Date'] },
    'get-executionpolicy': { s: 'show the execution policy', syn: 'Get-ExecutionPolicy', d: 'Print the current script execution policy.', o: [], x: [['Get-ExecutionPolicy', 'e.g. RemoteSigned']], see: ['Get-Module'] },
    'get-module': { s: 'list loaded modules', syn: 'Get-Module', d: 'List the loaded PowerShell modules.', o: [], x: [['Get-Module', 'loaded modules']], see: ['Get-Command'] },
    'write-output': { s: 'emit objects', syn: 'Write-Output <text>', d: 'Send values down the pipeline. Aliases: echo, write.', o: [], x: [['Write-Output hello', 'print hello'], ['echo hi', 'via alias']], see: ['Write-Host'] },
    'write-host': { s: 'write to the screen', syn: 'Write-Host <text>', d: 'Print text straight to the console (not the pipeline). -ForegroundColor is accepted and ignored.', o: [], x: [['Write-Host "hi"', 'print to screen']], see: ['Write-Output'] },
    'write-warning': { s: 'print a warning', syn: 'Write-Warning <text>', d: 'Print a WARNING: line.', o: [], x: [['Write-Warning "low disk"', 'a warning line']], see: ['Write-Error'] },
    'write-error': { s: 'print an error', syn: 'Write-Error <text>', d: 'Print an ERROR: line.', o: [], x: [['Write-Error "failed"', 'an error line']], see: ['Write-Warning'] },
    'clear-host': { s: 'clear the screen', syn: 'Clear-Host', d: 'Clear the console. Aliases: cls, clear.', o: [], x: [['Clear-Host', 'clear the screen']], see: ['Reset'] },
    reset: { s: 'reset the sandbox', syn: 'Reset', d: 'Restore the virtual Windows box to its starting state.', o: [], x: [['Reset', 'restore the sandbox']], see: ['Clear-Host'] }
  };

  // CMD man pages. Keys are lowercase; CMD options use /letter and many commands also show /? help.
  G.MAN.cmd = {
    dir: { s: 'list directory contents', syn: 'dir [/a] [/b] [/s] [path]', d: 'List files and folders.', o: [['/a', 'include hidden entries'], ['/b', 'bare format: names only, no header or sizes'], ['/s', 'recurse into subdirectories']], x: [['dir', 'list here'], ['dir /b', 'just the names'], ['dir /a /s', 'everything below, hidden included'], ['dir | find "txt"', 'filter the listing']], see: ['cd', 'tree', 'type'] },
    cd: { s: 'change or show the directory', syn: 'cd [/d] [path]', d: 'Change directory, or print the current one with no argument. Chdir is the same command.', o: [['/d', 'also change drive (accepted here)']], x: [['cd', 'print the path'], ['cd Users', 'enter a folder'], ['cd ..', 'up one level']], see: ['dir', 'pushd'] },
    chdir: { s: 'change or show the directory', syn: 'chdir [path]', d: 'Same as cd: change directory or print it.', o: [], x: [['chdir', 'print the path']], see: ['cd'] },
    pushd: { s: 'save and change directory', syn: 'pushd [path]', d: 'Push the current directory, then move to another.', o: [], x: [['pushd C:\\Windows', 'remember here, move']], see: ['popd'] },
    popd: { s: 'return to a pushed directory', syn: 'popd', d: 'Pop the last pushed directory and go back.', o: [], x: [['popd', 'go back']], see: ['pushd'] },
    type: { s: 'print a file', syn: 'type <file>', d: 'Display the contents of a file.', o: [], x: [['type notes.txt', 'print a file'], ['type notes.txt | find "err"', 'print and filter']], see: ['more', 'dir'] },
    more: { s: 'print a file a screen at a time', syn: 'more <file>', d: 'Display a file (paged in real cmd; shown whole here).', o: [], x: [['more notes.txt', 'view a file']], see: ['type'] },
    copy: { s: 'copy a file', syn: 'copy <src> <dst>', d: 'Copy a file to a new path.', o: [], x: [['copy a.txt b.txt', 'duplicate a file']], see: ['move', 'xcopy'] },
    xcopy: { s: 'copy files and trees', syn: 'xcopy <src> <dst>', d: 'Copy files (and, in real cmd, directory trees).', o: [], x: [['xcopy a.txt b.txt', 'copy a file']], see: ['copy', 'robocopy'] },
    robocopy: { s: 'robust file copy', syn: 'robocopy <src> <dst>', d: 'Mirror files between folders (simulated banner here).', o: [], x: [['robocopy src dst', 'copy a folder']], see: ['xcopy'] },
    move: { s: 'move or rename a file', syn: 'move <src> <dst>', d: 'Move a file to a new path.', o: [], x: [['move a.txt sub\\a.txt', 'move a file']], see: ['ren', 'copy'] },
    ren: { s: 'rename a file', syn: 'ren <old> <new>', d: 'Rename a file. Rename is the same command.', o: [], x: [['ren a.txt b.txt', 'rename']], see: ['move'] },
    rename: { s: 'rename a file', syn: 'rename <old> <new>', d: 'Same as ren: rename a file.', o: [], x: [['rename a.txt b.txt', 'rename']], see: ['ren'] },
    del: { s: 'delete a file', syn: 'del <file>', d: 'Delete a file. Erase is the same command.', o: [], x: [['del old.txt', 'delete a file']], see: ['erase', 'rd'] },
    erase: { s: 'delete a file', syn: 'erase <file>', d: 'Same as del: delete a file.', o: [], x: [['erase old.txt', 'delete a file']], see: ['del'] },
    mkdir: { s: 'make a directory', syn: 'mkdir <dir>', d: 'Create a directory. Md is the same command.', o: [], x: [['mkdir logs', 'new folder']], see: ['md', 'rmdir'] },
    md: { s: 'make a directory', syn: 'md <dir>', d: 'Same as mkdir: create a directory.', o: [], x: [['md logs', 'new folder']], see: ['mkdir'] },
    rd: { s: 'remove a directory', syn: 'rd <dir>', d: 'Remove a directory. Rmdir is the same command.', o: [], x: [['rd logs', 'remove a folder']], see: ['rmdir', 'del'] },
    rmdir: { s: 'remove a directory', syn: 'rmdir <dir>', d: 'Same as rd: remove a directory.', o: [], x: [['rmdir logs', 'remove a folder']], see: ['rd'] },
    tree: { s: 'draw the folder tree', syn: 'tree [path]', d: 'Show the folder hierarchy as a tree.', o: [], x: [['tree', 'the tree here']], see: ['dir'] },
    find: { s: 'search for literal text', syn: 'find [/i] [/c] "text" [file]', d: 'Print lines containing a literal string.', o: [['/i', 'ignore case'], ['/c', 'print only the count of matching lines']], x: [['find "error" log.txt', 'lines with error'], ['type log.txt | find /c "error"', 'count errors']], see: ['findstr'] },
    findstr: { s: 'search with a regex', syn: 'findstr <pattern> [file]', d: 'Print lines matching a regular expression, with line numbers.', o: [], x: [['findstr warn log.txt', 'regex search'], ['type log.txt | findstr "[0-9]"', 'lines with a digit']], see: ['find'] },
    sort: { s: 'sort lines', syn: 'sort [/r] [file]', d: 'Sort lines alphabetically.', o: [['/r', 'reverse order']], x: [['sort names.txt', 'alphabetical'], ['type names.txt | sort /r', 'reverse sorted']], see: ['find'] },
    fc: { s: 'compare two files', syn: 'fc <file1> <file2>', d: 'Show differences between two files. Comp is similar.', o: [], x: [['fc a.txt b.txt', 'compare files']], see: ['comp'] },
    comp: { s: 'compare two files', syn: 'comp <file1> <file2>', d: 'Compare two files (same behavior as fc here).', o: [], x: [['comp a.txt b.txt', 'compare files']], see: ['fc'] },
    attrib: { s: 'show file attributes', syn: 'attrib [file]', d: 'Show the attribute flags of a file.', o: [], x: [['attrib notes.txt', 'the attributes']], see: ['icacls'] },
    icacls: { s: 'show file permissions', syn: 'icacls <file>', d: 'Show the access control entries of a file. Cacls is similar.', o: [], x: [['icacls notes.txt', 'permissions']], see: ['cacls', 'takeown'] },
    cacls: { s: 'show file permissions', syn: 'cacls <file>', d: 'Show file permissions (legacy form of icacls).', o: [], x: [['cacls notes.txt', 'permissions']], see: ['icacls'] },
    takeown: { s: 'take ownership of a file', syn: 'takeown /f <file>', d: 'Become the owner of a file (simulated).', o: [], x: [['takeown /f notes.txt', 'take ownership']], see: ['icacls'] },
    cipher: { s: 'show encryption state', syn: 'cipher', d: 'List files and their encryption state (U = unencrypted).', o: [], x: [['cipher', 'encryption state here']], see: ['icacls'] },
    mklink: { s: 'create a link', syn: 'mklink <link> <target>', d: 'Create a symbolic link (simulated).', o: [], x: [['mklink n notes.txt', 'make a link']], see: ['assoc'] },
    assoc: { s: 'show file associations', syn: 'assoc', d: 'List file extension to type associations.', o: [], x: [['assoc', 'extension map']], see: ['ftype'] },
    ftype: { s: 'show open commands by type', syn: 'ftype', d: 'List the commands that open each file type.', o: [], x: [['ftype', 'type commands']], see: ['assoc'] },
    echo: { s: 'print text', syn: 'echo <text>', d: 'Print a line of text.', o: [], x: [['echo hello', 'print hello'], ['echo %USERNAME%', 'expand a variable']], see: ['set'] },
    set: { s: 'show or set variables', syn: 'set [NAME[=value]]', d: 'List environment variables, show ones by prefix, or set one with NAME=value.', o: [], x: [['set', 'all variables'], ['set PATH', 'variables starting with PATH'], ['set X=5', 'set a variable']], see: ['setx', 'path', 'echo'] },
    setx: { s: 'set a persistent variable', syn: 'setx <name> <value>', d: 'Set a variable (persistent in real Windows).', o: [], x: [['setx TOKEN abc', 'set a variable']], see: ['set'] },
    path: { s: 'show the PATH', syn: 'path', d: 'Print the executable search path.', o: [], x: [['path', 'the PATH']], see: ['set', 'where'] },
    ver: { s: 'show the Windows version', syn: 'ver', d: 'Print the Windows version string.', o: [], x: [['ver', 'the version']], see: ['systeminfo'] },
    date: { s: 'show the date', syn: 'date', d: 'Print the current date.', o: [], x: [['date', 'the date']], see: ['time'] },
    time: { s: 'show the time', syn: 'time', d: 'Print the current time.', o: [], x: [['time', 'the time']], see: ['date'] },
    hostname: { s: 'show the host name', syn: 'hostname', d: 'Print the computer name.', o: [], x: [['hostname', 'DEV-BOX']], see: ['whoami'] },
    whoami: { s: 'show the current user', syn: 'whoami', d: 'Print domain\\user for the current account.', o: [], x: [['whoami', 'dev-box\\dev']], see: ['hostname'] },
    where: { s: 'find a program on the path', syn: 'where <name>', d: 'Print the full path of a command.', o: [], x: [['where ping', 'its path']], see: ['path'] },
    systeminfo: { s: 'show system information', syn: 'systeminfo', d: 'Print OS, build, memory, and processor details.', o: [], x: [['systeminfo', 'system summary']], see: ['ver', 'wmic'] },
    vol: { s: 'show the volume label', syn: 'vol', d: 'Print the drive label and serial number.', o: [], x: [['vol', 'the volume info']], see: ['label'] },
    label: { s: 'show the volume label', syn: 'label', d: 'Print the volume label.', o: [], x: [['label', 'the label']], see: ['vol'] },
    tasklist: { s: 'list processes', syn: 'tasklist', d: 'List running processes with PID and memory.', o: [], x: [['tasklist', 'the process table'], ['tasklist | find "chrome"', 'find a process']], see: ['taskkill'] },
    taskkill: { s: 'end a process', syn: 'taskkill /PID <id>', d: 'Terminate a process by PID.', o: [['/PID id', 'the process ID to end']], x: [['taskkill /PID 2210', 'end a process']], see: ['tasklist'] },
    sc: { s: 'query a service', syn: 'sc query <name>', d: 'Show a service and its state.', o: [], x: [['sc query WinDefend', 'service state']], see: ['net', 'schtasks'] },
    schtasks: { s: 'list scheduled tasks', syn: 'schtasks', d: 'List scheduled tasks and next run times.', o: [], x: [['schtasks', 'the task list']], see: ['sc'] },
    reg: { s: 'read the registry', syn: 'reg query <key>', d: 'Show sample registry keys and values.', o: [], x: [['reg query HKLM', 'a registry key']], see: ['wmic'] },
    net: { s: 'accounts, groups, services, shares', syn: 'net <user|localgroup|start|share>', d: 'Show accounts, groups, started services, or shares depending on the subcommand.', o: [['user', 'list user accounts'], ['localgroup', 'list local groups'], ['start', 'list started services'], ['share', 'list shares']], x: [['net user', 'accounts'], ['net share', 'shares']], see: ['sc', 'gpresult'] },
    wmic: { s: 'query WMI', syn: 'wmic <alias get props>', d: 'Run a WMI query (simulated OS answer).', o: [], x: [['wmic os get caption,version', 'OS info']], see: ['systeminfo'] },
    gpresult: { s: 'show applied group policy', syn: 'gpresult', d: 'Show the resultant set of policy for the user.', o: [], x: [['gpresult', 'applied policy']], see: ['net'] },
    driverquery: { s: 'list drivers', syn: 'driverquery', d: 'List installed drivers and types.', o: [], x: [['driverquery', 'the driver list']], see: ['systeminfo'] },
    powercfg: { s: 'show power schemes', syn: 'powercfg', d: 'List power schemes and the active one.', o: [], x: [['powercfg', 'power schemes']], see: ['systeminfo'] },
    certutil: { s: 'hash or Base64 a file', syn: 'certutil -hashfile <f> SHA256 | -encode <in> <out> | -decode <in> <out>', d: 'Compute a file hash, or Base64 encode/decode a file.', o: [['-hashfile f ALG', 'print the hash of a file'], ['-encode in out', 'Base64-encode a file'], ['-decode in out', 'Base64-decode a file']], x: [['certutil -hashfile notes.txt SHA256', 'hash a file'], ['certutil -encode a.txt a.b64', 'encode a file']], see: ['fsutil'] },
    ipconfig: { s: 'show IP configuration', syn: 'ipconfig', d: 'Print adapter IP addresses, mask, and gateway.', o: [], x: [['ipconfig', 'the IP config']], see: ['ping', 'netsh'] },
    ping: { s: 'test reachability', syn: 'ping <host>', d: 'Send ICMP echoes and print replies and a summary.', o: [], x: [['ping 10.0.0.5', 'ping a host']], see: ['tracert'] },
    tracert: { s: 'trace the route to a host', syn: 'tracert <host>', d: 'Print each hop to a destination. Pathping is similar.', o: [], x: [['tracert 10.0.0.5', 'the hops']], see: ['pathping', 'ping'] },
    pathping: { s: 'trace and measure a route', syn: 'pathping <host>', d: 'Trace the route to a host (same output as tracert here).', o: [], x: [['pathping 10.0.0.5', 'the hops']], see: ['tracert'] },
    netstat: { s: 'list connections', syn: 'netstat', d: 'List active TCP connections with addresses, state, and PID.', o: [], x: [['netstat', 'connections'], ['netstat | find "LISTENING"', 'listeners']], see: ['arp', 'route'] },
    nslookup: { s: 'look up a DNS name', syn: 'nslookup <name>', d: 'Resolve a name to an address.', o: [], x: [['nslookup api.internal', 'resolve a name']], see: ['ping'] },
    arp: { s: 'show the ARP cache', syn: 'arp -a', d: 'Print the IP-to-MAC neighbor table.', o: [], x: [['arp -a', 'the ARP cache']], see: ['netstat'] },
    route: { s: 'show the routing table', syn: 'route print', d: 'Print the IPv4 routing table.', o: [], x: [['route print', 'routes']], see: ['netstat'] },
    nbtstat: { s: 'show NetBIOS info', syn: 'nbtstat', d: 'Print NetBIOS over TCP/IP names.', o: [], x: [['nbtstat', 'NetBIOS names']], see: ['getmac'] },
    getmac: { s: 'show MAC addresses', syn: 'getmac', d: 'Print the adapter physical (MAC) addresses.', o: [], x: [['getmac', 'MAC addresses']], see: ['ipconfig'] },
    netsh: { s: 'network shell', syn: 'netsh <context ...>', d: 'Run a netsh command (simulated interface summary).', o: [], x: [['netsh interface ip show config', 'IP config']], see: ['ipconfig'] },
    curl: { s: 'fetch a URL', syn: 'curl <url>', d: 'Make an HTTP request and print a JSON response.', o: [], x: [['curl https://api.internal/health', 'a JSON status']], see: ['ssh'] },
    ssh: { s: 'open a remote shell (simulated)', syn: 'ssh <user@host>', d: 'Print a connection banner for SSH.', o: [], x: [['ssh dev@10.0.0.5', 'connect']], see: ['ftp', 'telnet'] },
    ftp: { s: 'connect to FTP (simulated)', syn: 'ftp <host>', d: 'Print an FTP connection banner.', o: [], x: [['ftp 10.0.0.5', 'connect']], see: ['ssh'] },
    telnet: { s: 'connect with telnet (simulated)', syn: 'telnet <host>', d: 'Print a telnet connection banner.', o: [], x: [['telnet 10.0.0.5', 'connect']], see: ['ssh'] },
    winget: { s: 'package manager (simulated)', syn: 'winget <args>', d: 'Print a Windows Package Manager banner.', o: [], x: [['winget list', 'the banner']], see: [] },
    fsutil: { s: 'filesystem utility', syn: 'fsutil', d: 'Print NTFS volume details (simulated).', o: [], x: [['fsutil', 'volume details']], see: ['chkdsk'] },
    chkdsk: { s: 'check the disk', syn: 'chkdsk', d: 'Report filesystem integrity (safe, read-only here).', o: [], x: [['chkdsk', 'disk check result']], see: ['sfc'] },
    sfc: { s: 'system file checker', syn: 'sfc', d: 'Report on protected system files (simulated).', o: [], x: [['sfc', 'integrity result']], see: ['dism'] },
    dism: { s: 'servicing tool', syn: 'dism', d: 'Report on the component store (simulated).', o: [], x: [['dism', 'store health']], see: ['sfc'] },
    bcdedit: { s: 'boot configuration (read-only)', syn: 'bcdedit', d: 'Show the boot manager configuration (read-only).', o: [], x: [['bcdedit', 'boot config']], see: [] },
    diskpart: { s: 'disk partition tool (read-only)', syn: 'diskpart', d: 'Show disks (read-only in the sandbox).', o: [], x: [['diskpart', 'disk list']], see: ['fsutil'] },
    shutdown: { s: 'shut down (simulated)', syn: 'shutdown', d: 'Simulated: the virtual host keeps running.', o: [], x: [['shutdown', 'the notice']], see: ['reset'] },
    cls: { s: 'clear the screen', syn: 'cls', d: 'Clear the console. Clear is the same.', o: [], x: [['cls', 'clear the screen']], see: ['clear'] },
    clear: { s: 'clear the screen', syn: 'clear', d: 'Clear the console (same as cls).', o: [], x: [['clear', 'clear the screen']], see: ['cls'] },
    clip: { s: 'copy a pipe to the clipboard', syn: '... | clip', d: 'Copy piped text to the sandbox clipboard.', o: [], x: [['echo hi | clip', 'copy text']], see: ['echo'] },
    title: { s: 'set the window title', syn: 'title <text>', d: 'Set the console title (no visible effect here).', o: [], x: [['title Work', 'set the title']], see: ['prompt'] },
    color: { s: 'set console colors', syn: 'color <code>', d: 'Set console colors (no effect in the sandbox).', o: [], x: [['color 0A', 'set colors']], see: ['title'] },
    prompt: { s: 'set the prompt', syn: 'prompt <text>', d: 'Set the command prompt (no effect here).', o: [], x: [['prompt $P$G', 'set the prompt']], see: ['title'] },
    timeout: { s: 'wait for a time', syn: 'timeout <seconds>', d: 'Wait (returns immediately in the sandbox).', o: [], x: [['timeout 5', 'the wait notice']], see: ['pause'] },
    pause: { s: 'wait for a keypress', syn: 'pause', d: 'Print the press-a-key prompt.', o: [], x: [['pause', 'the prompt']], see: ['timeout'] },
    rem: { s: 'a comment', syn: 'rem <text>', d: 'A no-op comment line in batch files.', o: [], x: [['rem setup step', 'a comment']], see: [] },
    start: { s: 'start a program', syn: 'start <command>', d: 'Launch a program (simulated).', o: [], x: [['start notepad', 'the start notice']], see: [] },
    help: { s: 'show the command reference', syn: 'help [cmd]', d: 'List commands, or show one command man page.', o: [], x: [['help', 'the reference'], ['help dir', 'the dir page']], see: [] },
    reset: { s: 'reset the sandbox', syn: 'reset', d: 'Restore the virtual disk to its starting state.', o: [], x: [['reset', 'restore the sandbox']], see: ['cls'] }
  };

  // Python REPL man pages. The sandbox runs one-line statements and expressions; these builtins and modules are implemented.
  const pyB = (s, syn, d, x, see) => ({ s, syn, d, o: [], x, see: see || [] });
  G.MAN.python = {
    print: pyB('print values', 'print(*args)', 'Print its arguments separated by spaces, then a newline. Strings print without quotes.', [['print("hello")', 'hello'], ['print(1, 2, 3)', '1 2 3'], ['print(sum([1,2,3]))', '6']], ['repr', 'str']),
    len: pyB('length of a sequence', 'len(obj)', 'Return the number of items in a string, list, dict, or set.', [['len("abc")', '3'], ['len([1,2,3,4])', '4']], ['sum', 'range']),
    sum: pyB('add up a list', 'sum(iterable)', 'Add the numbers in a list or range.', [['sum([1,2,3])', '6'], ['sum(range(5))', '10']], ['len', 'min', 'max']),
    min: pyB('smallest value', 'min(iterable) / min(a, b, ...)', 'Return the smallest value from a list or arguments.', [['min([4,2,9])', '2'], ['min(3, 7)', '3']], ['max', 'sorted']),
    max: pyB('largest value', 'max(iterable) / max(a, b, ...)', 'Return the largest value from a list or arguments.', [['max([4,2,9])', '9'], ['max(3, 7)', '7']], ['min', 'sorted']),
    abs: pyB('absolute value', 'abs(x)', 'Return the absolute value of a number.', [['abs(-5)', '5'], ['abs(3)', '3']], ['round', 'pow']),
    round: pyB('round a number', 'round(x[, ndigits])', 'Round a number, optionally to a number of decimals.', [['round(3.7)', '4'], ['round(3.14159, 2)', '3.14']], ['abs']),
    pow: pyB('raise to a power', 'pow(x, y)', 'Return x to the power y.', [['pow(2, 8)', '256'], ['pow(3, 2)', '9']], ['abs']),
    divmod: pyB('quotient and remainder', 'divmod(a, b)', 'Return the pair [a // b, a % b].', [['divmod(17, 5)', '[3, 2]']], ['round']),
    sorted: pyB('sort into a new list', 'sorted(iterable)', 'Return a new sorted list from an iterable.', [['sorted([3,1,2])', '[1, 2, 3]'], ['sorted("cab")', "['a', 'b', 'c']"]], ['reversed', 'min', 'max']),
    reversed: pyB('reverse a sequence', 'reversed(seq)', 'Return the items of a sequence in reverse.', [['reversed([1,2,3])', '[3, 2, 1]'], ['reversed("abc")', "['c', 'b', 'a']"]], ['sorted']),
    range: pyB('a sequence of integers', 'range([start,] stop[, step])', 'Produce integers from start up to (not including) stop.', [['range(5)', '[0, 1, 2, 3, 4]'], ['range(2, 10, 2)', '[2, 4, 6, 8]'], ['sum(range(1, 5))', '10']], ['enumerate', 'zip']),
    enumerate: pyB('pair items with indexes', 'enumerate(iterable[, start])', 'Return [index, value] pairs for each item.', [['enumerate(["a","b"])', '[[0, "a"], [1, "b"]]']], ['zip', 'range']),
    zip: pyB('pair up lists', 'zip(a, b, ...)', 'Combine lists element by element into pairs.', [['zip([1,2], ["a","b"])', '[[1, "a"], [2, "b"]]']], ['enumerate', 'map']),
    map: pyB('apply a function', 'map(func, iterable)', 'Apply a function to every item. Pass a lambda as the function.', [['map(lambda x: x*2, [1,2,3])', '[2, 4, 6]']], ['filter', 'zip']),
    filter: pyB('keep matching items', 'filter(func, iterable)', 'Keep the items for which the function returns true.', [['filter(lambda x: x > 2, [1,2,3,4])', '[3, 4]']], ['map', 'all', 'any']),
    all: pyB('true if every item is true', 'all(iterable)', 'Return true when every item is truthy.', [['all([1, 2, 3])', 'True'], ['all([1, 0, 3])', 'False']], ['any', 'filter']),
    any: pyB('true if any item is true', 'any(iterable)', 'Return true when at least one item is truthy.', [['any([0, 0, 1])', 'True'], ['any([0, 0])', 'False']], ['all']),
    int: pyB('convert to integer', 'int(x[, base])', 'Convert a value to an integer, with an optional base.', [['int("42")', '42'], ['int("ff", 16)', '255']], ['float', 'str']),
    float: pyB('convert to float', 'float(x)', 'Convert a value to a floating-point number.', [['float("3.14")', '3.14']], ['int']),
    str: pyB('convert to string', 'str(x)', 'Convert a value to its string form.', [['str(42)', "'42'"]], ['int', 'repr']),
    bool: pyB('convert to boolean', 'bool(x)', 'Return True for truthy values, False otherwise.', [['bool(0)', 'False'], ['bool("x")', 'True']], ['int']),
    list: pyB('make a list', 'list(iterable)', 'Build a list from an iterable.', [['list(range(3))', '[0, 1, 2]'], ['list("ab")', "['a', 'b']"]], ['tuple', 'set', 'dict']),
    tuple: pyB('make a tuple', 'tuple(iterable)', 'Build a tuple (shown as a list in the sandbox).', [['tuple([1,2])', '[1, 2]']], ['list']),
    set: pyB('make a set of unique items', 'set(iterable)', 'Build a set, dropping duplicates.', [['set([1,1,2,3])', '[1, 2, 3]']], ['list', 'dict']),
    dict: pyB('make a dictionary', 'dict(obj)', 'Build a dictionary.', [['dict({"a": 1})', "{'a': 1}"]], ['list', 'set']),
    bytes: pyB('bytes from text', 'bytes(x)', 'Return a bytes-like value from text (string form here).', [['bytes("hi")', "'hi'"]], ['str']),
    chr: pyB('code point to character', 'chr(n)', 'Return the character for a Unicode code point.', [['chr(65)', "'A'"]], ['ord']),
    ord: pyB('character to code point', 'ord(c)', 'Return the code point of a character.', [['ord("A")', '65']], ['chr']),
    hex: pyB('integer to hex string', 'hex(n)', 'Return the 0x hexadecimal string for an integer.', [['hex(255)', "'0xff'"]], ['bin', 'oct']),
    bin: pyB('integer to binary string', 'bin(n)', 'Return the 0b binary string for an integer.', [['bin(5)', "'0b101'"]], ['hex', 'oct']),
    oct: pyB('integer to octal string', 'oct(n)', 'Return the 0o octal string for an integer.', [['oct(8)', "'0o10'"]], ['hex', 'bin']),
    type: pyB('type of a value', 'type(x)', 'Return the class of a value.', [['type(5)', "<class 'int'>"], ['type("x")', "<class 'str'>"]], ['isinstance']),
    isinstance: pyB('test a value type', 'isinstance(x, type)', 'Return whether a value is of a given type.', [['isinstance(5, int)', 'True']], ['type']),
    dir: pyB('list names', 'dir([obj])', 'List names in the namespace, or the keys of an object.', [['dir()', 'defined names'], ['dir({"a":1})', "['a']"]], ['vars']),
    repr: pyB('printable representation', 'repr(x)', 'Return the quoted, unambiguous form of a value.', [['repr("hi")', "'hi'"], ['repr([1,2])', '[1, 2]']], ['str', 'print']),
    hash: pyB('hash of a value', 'hash(x)', 'Return a deterministic integer hash of a value.', [['hash("abc")', 'an integer']], ['id']),
    import: pyB('load a module', 'import <module>', 'Load a standard-library module, then use its members. Available: math, json, os, sys, re, random, time, datetime, base64, hashlib, string, statistics, secrets, uuid, collections, itertools, functools, urllib, pathlib, socket, binascii, zlib, codecs.', [['import math', 'then math.sqrt(9)'], ['import base64', 'then base64.b64encode("hi")']], ['from']),
    from: pyB('import names from a module', 'from <module> import <names>', 'Bring specific names from a module into scope.', [['from math import pi', 'then pi'], ['from random import randint', 'then randint(1, 6)']], ['import']),
    def: pyB('define a function', 'def name(args): return expr', 'Define a one-line function in the REPL.', [['def dbl(x): return x*2', 'then dbl(5)'], ['def add(a, b): return a + b', 'then add(2, 3)']], ['for', 'if']),
    for: pyB('loop over items', 'for v in iterable: <stmt>', 'Run a statement for each item. One line in the sandbox.', [['for i in range(3): print(i)', '0 then 1 then 2']], ['range', 'if']),
    if: pyB('conditional statement', 'if cond: <stmt>', 'Run a statement when a condition is true.', [['if 3 > 2: print("yes")', 'yes']], ['for']),
    del: pyB('remove a variable', 'del name', 'Delete a variable from the namespace.', [['del x', 'remove x']], ['clear']),
    clear: pyB('empty the namespace', 'clear', 'Remove all variables. Aliases: cls, reset.', [['clear', 'namespace cleared']], ['reset']),
    reset: pyB('empty the namespace', 'reset', 'Remove all variables (same as clear).', [['reset', 'namespace cleared']], ['clear']),
    help: pyB('show the reference', 'help [topic]', 'With no topic, list the language reference. With one, show that page.', [['help', 'the reference'], ['help sorted', 'the sorted page']], [])
  };

  // Node.js REPL man pages. Keys are lowercase; dot-commands keep their leading dot.
  const ndB = (s, syn, d, x, see) => ({ s, syn, d, o: [], x, see: see || [] });
  G.MAN.node = {
    'console.log': ndB('print to the console', 'console.log(...args)', 'Print values to the REPL output. console.info and console.debug behave the same.', [['console.log("hi")', 'hi'], ['console.log(1 + 2)', '3'], ['console.log([1,2,3])', '[1,2,3]']], ['console.table', 'console.dir']),
    table: ndB('print objects as a table', 'console.table(array)', 'Render an array of objects as an aligned table.', [['console.table([{a:1},{a:2}])', 'a table']], ['console.log']),
    dir: ndB('inspect an object', 'console.dir(obj)', 'Print an object as formatted JSON.', [['console.dir({a:1,b:2})', 'formatted object']], ['console.log']),
    warn: ndB('print a warning', 'console.warn(...args)', 'Print to the output (like console.log here).', [['console.warn("careful")', 'careful']], ['error']),
    error: ndB('print an error', 'console.error(...args)', 'Print to the output (like console.log here).', [['console.error("oops")', 'oops']], ['warn']),
    assert: ndB('assert a condition', 'console.assert(cond, msg)', 'Print an assertion-failed message when the condition is false.', [['console.assert(1 === 2, "no")', 'Assertion failed: no']], ['error']),
    count: ndB('count calls by label', 'console.count(label)', 'Print how many times a label has been counted.', [['console.count("x")', 'x: 1']], ['time']),
    time: ndB('start a timer', 'console.time(label)', 'Start a named timer; end it with console.timeEnd.', [['console.time("t")', 'starts a timer']], ['timeEnd']),
    timeend: ndB('end a timer', 'console.timeEnd(label)', 'Print the elapsed time for a named timer.', [['console.timeEnd("t")', 't: 0ms']], ['time']),
    'buffer.from': ndB('create a buffer', 'Buffer.from(str[, enc]).toString(outEnc)', 'Encode and decode between utf8, base64, and hex.', [['Buffer.from("hi").toString("base64")', 'aGk='], ['Buffer.from("aGk=", "base64").toString()', 'hi'], ['Buffer.from("hi").toString("hex")', '6869']], ['require']),
    json: ndB('JSON encode and decode', 'JSON.stringify(x) / JSON.parse(s)', 'Serialize a value to JSON text, or parse JSON back into a value.', [['JSON.stringify({a:1})', '{"a":1}'], ['JSON.parse("[1,2,3]")', '[1,2,3]']], ['console.log']),
    math: ndB('math functions', 'Math.<fn>(...)', 'The standard JavaScript Math object: sqrt, pow, max, random, and more.', [['Math.sqrt(9)', '3'], ['Math.max(3, 7)', '7']], ['date']),
    date: ndB('dates and times', 'new Date() / Date.now()', 'The JavaScript Date object. Date.now() gives milliseconds since 1970.', [['Date.now()', 'a timestamp'], ['new Date(0).getFullYear()', '1970']], ['math']),
    url: ndB('parse a URL', 'new URL(str)', 'Parse a URL into its parts (protocol, host, pathname, search).', [['new URL("https://a.test/p?x=1").host', 'a.test'], ['new URL("https://a.test/p").pathname', '/p']], ['urlsearchparams']),
    urlsearchparams: ndB('parse a query string', 'new URLSearchParams(str)', 'Parse and read URL query parameters.', [['new URLSearchParams("a=1&b=2").get("a")', '1']], ['url']),
    process: ndB('the process object', 'process.<prop>', 'Info about the running process: platform, arch, pid, version, env.', [['process.platform', 'win32'], ['process.version', 'v20.11.0']], ['require']),
    require: ndB('load a core module', 'require("<module>")', 'Load a stubbed Node core module: os, path, crypto, fs, url, util, querystring, events, assert, http, net, dns, zlib, child_process, buffer, process.', [['require("os").platform()', 'win32'], ['require("crypto").randomUUID()', 'a UUID'], ['require("path").basename("/a/b.txt")', 'b.txt'], ['require("fs").readdirSync()', 'the virtual files']], ['process', 'buffer.from']),
    '.help': ndB('list REPL commands', '.help', 'List the Node REPL dot-commands and modules.', [['.help', 'the reference']], ['.clear']),
    '.clear': ndB('reset the REPL context', '.clear', 'Clear all declared variables. Aliases: clear, reset.', [['.clear', 'context cleared']], ['.exit']),
    '.break': ndB('abort the current input', '.break', 'Abort a multi-line entry (no-op here).', [['.break', 'does nothing visible']], ['.clear']),
    '.exit': ndB('leave the REPL', '.exit', 'In the sandbox the REPL stays open. Alias: exit.', [['.exit', 'the stay-open notice']], ['.clear']),
    '.save': ndB('save the session', '.save', 'Report the session saved to sandbox memory.', [['.save', 'the save notice']], ['.load']),
    '.load': ndB('load a file', '.load', 'Points you to require("fs") for reading virtual files.', [['.load', 'the hint']], ['require']),
    '.editor': ndB('editor mode', '.editor', 'Enter single-line editor mode (a no-op notice here).', [['.editor', 'the notice']], []),
    clear: ndB('reset the REPL context', 'clear', 'Clear all declared variables (same as .clear).', [['clear', 'context cleared']], ['reset']),
    reset: ndB('reset the REPL context', 'reset', 'Clear all declared variables.', [['reset', 'context cleared']], ['clear']),
    help: ndB('show the reference', 'help [topic]', 'List the Node reference, or show one page.', [['help', 'the reference'], ['help require', 'the require page']], [])
  };

  // SQL man pages. Keys are lowercase clause names. The engine runs over users, orders, and products.
  const sqB = (s, syn, d, x, see) => ({ s, syn, d, o: [], x, see: see || [] });
  G.MAN.sql = {
    select: sqB('query rows', 'SELECT [DISTINCT] cols FROM table [WHERE ...] [GROUP BY ...] [ORDER BY ...] [LIMIT n]', 'Read rows from a table and project columns. Use * for all columns, AS for aliases, DISTINCT to drop duplicate rows. A tableless SELECT evaluates an expression.', [['SELECT * FROM users;', 'every row'], ['SELECT name, role FROM users;', 'two columns'], ['SELECT DISTINCT role FROM users;', 'unique roles'], ['SELECT 2 + 2 AS ans;', 'a tableless expression']], ['where', 'join', 'order', 'insert']),
    where: sqB('filter rows', 'WHERE <condition> [AND|OR|NOT ...]', 'Keep only rows that match a condition. Operators: =, !=, <, >, <=, >=, LIKE, ILIKE, IN (...), BETWEEN a AND b, IS [NOT] NULL.', [["SELECT * FROM users WHERE role = 'engineer';", 'exact match'], ["SELECT * FROM users WHERE name LIKE 'm%';", 'pattern'], ['SELECT * FROM orders WHERE total BETWEEN 50 AND 300;', 'a range'], ['SELECT * FROM users WHERE active IS NULL;', 'null test']], ['select', 'order']),
    join: sqB('combine rows across tables', 'FROM a JOIN b ON a.col = b.col', 'Combine rows from two tables where a join condition matches. INNER keeps only matches, LEFT keeps every left row, CROSS pairs every combination.', [['SELECT * FROM orders JOIN users ON orders.user_id = users.id;', 'orders with their user'], ['SELECT u.name, o.total FROM users u LEFT JOIN orders o ON o.user_id = u.id;', 'every user, orders if any']], ['select', 'where']),
    inner: sqB('inner join', 'INNER JOIN b ON ...', 'Keep only rows that have a match in both tables. This is the default JOIN.', [['SELECT * FROM orders INNER JOIN users ON orders.user_id = users.id;', 'matched pairs only']], ['join', 'left']),
    left: sqB('left join', 'LEFT JOIN b ON ...', 'Keep every row of the left table; unmatched right columns are NULL.', [['SELECT u.name, o.id FROM users u LEFT JOIN orders o ON o.user_id = u.id;', 'all users']], ['join', 'inner']),
    cross: sqB('cross join', 'CROSS JOIN b', 'Pair every row of one table with every row of the other.', [['SELECT * FROM users CROSS JOIN products;', 'every combination']], ['join']),
    count: sqB('count rows', 'COUNT(*) / COUNT(col)', 'Count rows, or non-null values of a column. Pair with GROUP BY.', [['SELECT COUNT(*) FROM users;', 'how many users'], ['SELECT role, COUNT(*) FROM users GROUP BY role;', 'count per role']], ['sum', 'order']),
    sum: sqB('add a column', 'SUM(col)', 'Add up the values of a numeric column.', [['SELECT SUM(total) FROM orders;', 'total revenue'], ['SELECT status, SUM(total) FROM orders GROUP BY status;', 'revenue per status']], ['count', 'avg']),
    avg: sqB('average a column', 'AVG(col)', 'Average the values of a numeric column.', [['SELECT AVG(price) FROM products;', 'mean price']], ['sum', 'min', 'max']),
    min: sqB('smallest value', 'MIN(col)', 'Return the smallest value in a column.', [['SELECT MIN(price) FROM products;', 'cheapest']], ['max', 'avg']),
    max: sqB('largest value', 'MAX(col)', 'Return the largest value in a column.', [['SELECT MAX(total) FROM orders;', 'biggest order']], ['min', 'avg']),
    order: sqB('sort results', 'ORDER BY col [ASC|DESC]', 'Sort the result rows by a column, ascending by default.', [['SELECT * FROM orders ORDER BY total DESC;', 'biggest first'], ['SELECT name FROM users ORDER BY name;', 'alphabetical']], ['limit', 'select']),
    limit: sqB('cap the result count', 'LIMIT n [OFFSET m]', 'Return at most n rows, optionally skipping the first m.', [['SELECT * FROM orders LIMIT 2;', 'first two'], ['SELECT * FROM orders LIMIT 2 OFFSET 1;', 'skip one, take two']], ['offset', 'order']),
    offset: sqB('skip rows', 'OFFSET m', 'Skip the first m rows of a result. Usually paired with LIMIT.', [['SELECT * FROM products LIMIT 1 OFFSET 2;', 'the third row']], ['limit']),
    insert: sqB('add a row', 'INSERT INTO table [(cols)] VALUES (...)', 'Add a new row to a table.', [["INSERT INTO users VALUES (5, 'alex', 'engineer', 1);", 'a full row'], ["INSERT INTO users (id, name) VALUES (6, 'lee');", 'named columns']], ['update', 'delete']),
    update: sqB('change rows', 'UPDATE table SET col = val [WHERE ...]', 'Change column values in matching rows. Without WHERE, every row changes.', [["UPDATE orders SET status = 'paid' WHERE id = 1002;", 'one order']], ['insert', 'delete']),
    delete: sqB('remove rows', 'DELETE FROM table [WHERE ...]', 'Delete matching rows. Without WHERE, every row goes.', [["DELETE FROM orders WHERE status = 'refunded';", 'drop refunds']], ['update', 'truncate']),
    create: sqB('create a table, index, or view', 'CREATE TABLE name (cols) / CREATE INDEX / CREATE VIEW', 'Create a new table, index, or view.', [['CREATE TABLE tags (id, label);', 'a new table'], ['CREATE VIEW admins AS SELECT * FROM users;', 'a view']], ['alter', 'drop']),
    alter: sqB('change a table', 'ALTER TABLE name ADD col', 'Add a column to an existing table (existing rows get NULL).', [['ALTER TABLE users ADD email;', 'add a column']], ['create', 'drop']),
    drop: sqB('remove a table, index, or view', 'DROP TABLE name', 'Delete a table, index, or view and its data.', [['DROP TABLE tags;', 'remove a table']], ['create', 'truncate']),
    truncate: sqB('empty a table', 'TRUNCATE TABLE name', 'Remove every row but keep the table.', [['TRUNCATE TABLE orders;', 'empty the table']], ['delete', 'drop']),
    begin: sqB('start a transaction', 'BEGIN', 'Take a snapshot so changes can be rolled back.', [['BEGIN;', 'start'], ['BEGIN; DELETE FROM orders; ROLLBACK;', 'undo the delete']], ['commit', 'rollback']),
    commit: sqB('keep transaction changes', 'COMMIT', 'Make the changes since BEGIN permanent.', [['COMMIT;', 'keep changes']], ['begin', 'rollback']),
    rollback: sqB('undo transaction changes', 'ROLLBACK', 'Restore the data to the BEGIN snapshot.', [['ROLLBACK;', 'undo changes']], ['begin', 'commit']),
    explain: sqB('show a query plan', 'EXPLAIN <query>', 'Print a simplified query plan.', [['EXPLAIN SELECT * FROM users;', 'the plan']], ['select']),
    show: sqB('inspect the schema', 'SHOW TABLES / SHOW DATABASES', 'List the tables or databases.', [['SHOW TABLES;', 'the table names'], ['SHOW DATABASES;', 'the databases']], ['describe', 'pragma']),
    describe: sqB('show table columns', 'DESCRIBE <table>', 'List a table columns and types. DESC is the short form.', [['DESCRIBE users;', 'columns and types']], ['show', 'desc']),
    desc: sqB('show table columns', 'DESC <table>', 'Short form of DESCRIBE: list columns and types.', [['DESC orders;', 'columns and types']], ['describe']),
    pragma: sqB('show table info', 'PRAGMA table_info(<table>)', 'SQLite-style way to list a table columns and types.', [["PRAGMA table_info('users');", 'columns and types']], ['describe']),
    reset: sqB('restore the seed data', 'RESET', 'Put the three tables back to their starting rows.', [['RESET;', 'restore seed data']], ['truncate'])
  };

  // Git man pages. Keys are subcommand names. The repo tracks real staged/committed state.
  const gtB = (s, syn, d, x, o, see) => ({ s, syn, d, o: o || [], x, see: see || [] });
  G.MAN.git = {
    git: gtB('the git command', 'git <subcommand> [args]', 'Run a git subcommand. Changes flow: working tree, then git add to the staging area, then git commit into history. Start with git status.', [['git status', 'the working state'], ['git add . && git commit -m "msg"', 'stage and record']], [], ['status', 'add', 'commit']),
    init: gtB('create a repository', 'git init', 'Start a new empty repository in the sandbox.', [['git init', 'create the repo']], [], ['clone', 'status']),
    clone: gtB('copy a remote repository', 'git clone <url>', 'Simulate cloning a remote repository.', [['git clone https://git.internal/app.git', 'clone a repo']], [], ['init', 'remote']),
    status: gtB('show the working state', 'git status', 'Show the branch, staged files, and untracked files.', [['git status', 'what is staged or untracked'], ['git add . && git status', 'after staging']], [], ['add', 'commit', 'diff']),
    add: gtB('stage changes', 'git add <file|.|-A>', 'Move changes into the staging area for the next commit.', [['git add README.md', 'stage one file'], ['git add .', 'stage everything'], ['git add -A', 'stage all changes']], [['.', 'stage every file'], ['-A', 'stage all changes']], ['status', 'commit', 'restore']),
    rm: gtB('remove a tracked file', 'git rm [--cached] <file>', 'Delete a file and stage the removal. --cached unstages but keeps the file.', [['git rm app.js', 'remove a file'], ['git rm --cached app.js', 'just unstage it']], [['--cached', 'unstage but keep the file on disk']], ['add', 'mv']),
    mv: gtB('move or rename a tracked file', 'git mv <old> <new>', 'Rename a tracked file.', [['git mv app.js main.js', 'rename a file']], [], ['rm', 'add']),
    commit: gtB('record staged changes', 'git commit -m "message"', 'Save the staged files as a new commit. A message is required.', [['git add . && git commit -m "first commit"', 'record a snapshot'], ['git commit -m "fix" --allow-empty', 'commit with nothing staged']], [['-m "msg"', 'the commit message (required)'], ['--allow-empty', 'commit even with nothing staged']], ['add', 'log', 'show']),
    diff: gtB('show pending changes', 'git diff', 'Show the difference the working tree would add.', [['git diff', 'the pending change']], [], ['status', 'show']),
    show: gtB('show a commit', 'git show', 'Show the most recent commit and its files.', [['git show', 'the latest commit']], [], ['log', 'diff']),
    log: gtB('browse commit history', 'git log [--oneline]', 'List commits, newest first.', [['git log', 'full entries'], ['git log --oneline', 'one line each']], [['--oneline', 'compact: hash and message per line']], ['shortlog', 'reflog', 'show']),
    shortlog: gtB('summarize commits by author', 'git shortlog', 'Group commit messages under their author.', [['git shortlog', 'commits by author']], [], ['log']),
    reflog: gtB('show the reference log', 'git reflog', 'List where HEAD has pointed, newest first.', [['git reflog', 'HEAD history']], [], ['log']),
    blame: gtB('show line authorship', 'git blame <file>', 'Show which commit last touched a file line.', [['git blame app.js', 'line attribution']], [], ['log']),
    branch: gtB('list or create branches', 'git branch [name]', 'With no name, list branches and mark the current. With a name, create one.', [['git branch', 'list branches'], ['git branch feature', 'create a branch']], [], ['checkout', 'switch', 'merge']),
    checkout: gtB('switch branches', 'git checkout [-b] <name>', 'Switch to a branch, or create and switch with -b.', [['git checkout main', 'switch to main'], ['git checkout -b feature', 'create and switch']], [['-b name', 'create the branch, then switch to it']], ['switch', 'branch']),
    switch: gtB('switch branches', 'git switch [-c] <name>', 'Switch to a branch, or create and switch with -c.', [['git switch main', 'switch'], ['git switch -c feature', 'create and switch']], [['-c name', 'create the branch, then switch to it']], ['checkout', 'branch']),
    merge: gtB('merge a branch', 'git merge <branch>', 'Combine another branch into the current one with a merge commit.', [['git merge feature', 'merge a branch']], [], ['rebase', 'branch']),
    rebase: gtB('reapply commits on a new base', 'git rebase <branch>', 'Reapply commits on top of another base, combining histories into a straight line.', [['git rebase main', 'replay onto main']], [], ['merge', 'cherry-pick']),
    'cherry-pick': gtB('apply one commit', 'git cherry-pick <hash>', 'Apply a single commit onto the current branch.', [['git cherry-pick abc1234', 'apply one commit']], [], ['rebase', 'revert']),
    stash: gtB('shelve work in progress', 'git stash [pop|list]', 'Set aside uncommitted changes, then restore them later.', [['git stash', 'shelve changes'], ['git stash pop', 'bring them back'], ['git stash list', 'see shelved entries']], [['pop', 'restore the latest stash'], ['list', 'list stash entries']], ['reset', 'restore']),
    tag: gtB('tag a commit', 'git tag [name]', 'List tags, or tag the current commit with a name.', [['git tag', 'list tags'], ['git tag v1.0', 'tag the commit']], [], ['describe']),
    describe: gtB('name a commit by tag', 'git describe', 'Return the latest tag, or a commit hash.', [['git describe', 'nearest tag']], [], ['tag']),
    restore: gtB('discard or unstage changes', 'git restore [--staged] <file>', 'Restore a file. --staged unstages it instead.', [['git restore --staged app.js', 'unstage a file']], [['--staged', 'remove from the staging area']], ['reset', 'add']),
    reset: gtB('unstage or discard', 'git reset [--hard]', 'Unstage changes, or with --hard throw away working changes too.', [['git reset', 'unstage everything'], ['git reset --hard', 'discard local changes']], [['--hard', 'also discard working-tree changes']], ['restore', 'revert']),
    revert: gtB('undo a commit safely', 'git revert <hash>', 'Create a new commit that undoes a previous one.', [['git revert HEAD', 'undo the last commit']], [], ['reset']),
    clean: gtB('remove untracked files', 'git clean [-n] [-f]', 'Delete untracked files. -n previews, -f actually removes.', [['git clean -n', 'preview removals'], ['git clean -f', 'remove untracked files']], [['-n', 'dry run: show what would go'], ['-f', 'force the removal']], ['reset']),
    remote: gtB('manage remotes', 'git remote [add origin <url>]', 'Show the remote, or set one with add origin.', [['git remote add origin https://git.internal/app.git', 'set the remote'], ['git remote', 'show it']], [], ['push', 'pull', 'fetch']),
    fetch: gtB('download remote refs', 'git fetch', 'Fetch from the configured remote without merging.', [['git fetch', 'fetch refs']], [], ['pull', 'remote']),
    pull: gtB('fetch and merge', 'git pull', 'Fetch from the remote and merge into the current branch.', [['git pull', 'update from the remote']], [], ['fetch', 'push']),
    push: gtB('upload commits', 'git push', 'Send commits to the configured remote.', [['git remote add origin https://git.internal/app.git && git push', 'set a remote, then push']], [], ['pull', 'remote']),
    grep: gtB('search tracked files', 'git grep <pattern>', 'Search tracked file names and contents for a pattern.', [['git grep app', 'find a string']], [], ['log']),
    'rev-parse': gtB('resolve a ref', 'git rev-parse [--abbrev-ref HEAD]', 'Print a commit hash, or the branch name with --abbrev-ref.', [['git rev-parse --abbrev-ref HEAD', 'the branch name']], [['--abbrev-ref HEAD', 'print the branch name']], ['reflog']),
    'ls-files': gtB('list tracked files', 'git ls-files', 'List files that are staged or tracked.', [['git ls-files', 'tracked files']], [], ['ls-tree']),
    'ls-tree': gtB('list a tree', 'git ls-tree', 'List the files in the current tree with their modes.', [['git ls-tree HEAD', 'tree entries']], [], ['ls-files']),
    'cat-file': gtB('inspect an object', 'git cat-file', 'Show the content of the latest commit object.', [['git cat-file -p HEAD', 'the commit object']], [], ['show']),
    config: gtB('show configuration', 'git config', 'Print the configured user name and email.', [['git config --global user.name', 'the identity']], [], ['init']),
    gc: gtB('clean up the repository', 'git gc', 'Run housekeeping on the object store (simulated).', [['git gc', 'the housekeeping report']], [], ['fsck']),
    fsck: gtB('check repository integrity', 'git fsck', 'Verify the object database (simulated).', [['git fsck', 'the integrity report']], [], ['gc']),
    version: gtB('show the git version', 'git version', 'Print the git version string.', [['git version', 'the version']], [], []),
    'reset-sandbox': gtB('reset the repository', 'git reset-sandbox', 'Throw away the whole sandbox repository and start over.', [['git reset-sandbox', 'start fresh']], [], ['init', 'reset'])
  };

  // Docker man pages. Keys are subcommand names (and `docker` for the overview). Container and image state is real.
  const dkB = (s, syn, d, x, o, see) => ({ s, syn, d, o: o || [], x, see: see || [] });
  G.MAN.docker = {
    docker: dkB('the docker command', 'docker <subcommand> [args]', 'Run a Docker subcommand. Images are templates; containers are running instances. Start with docker ps and docker images.', [['docker ps', 'running containers'], ['docker images', 'local images']], [], ['ps', 'run', 'images']),
    ps: dkB('list containers', 'docker ps [-a]', 'List running containers. -a includes stopped ones.', [['docker ps', 'running containers'], ['docker ps -a', 'all containers'], ['docker ps | grep web', 'filter the list']], [['-a', 'include stopped containers']], ['run', 'stop', 'images']),
    run: dkB('create and start a container', 'docker run [-d] [--name N] <image> [cmd]', 'Start a new container from an image and print its id.', [['docker run -d --name web nginx:1.25-alpine', 'run detached'], ['docker run -it alpine sh', 'interactive']], [['-d', 'run detached in the background'], ['--name N', 'name the container'], ['-it', 'interactive with a terminal'], ['-p', 'publish a port'], ['-e', 'set an environment variable']], ['create', 'ps', 'stop']),
    create: dkB('create a container', 'docker create <image>', 'Create a container without starting it.', [['docker create alpine', 'create one']], [['--name N', 'name the container']], ['run', 'start']),
    start: dkB('start a container', 'docker start <name>', 'Start a stopped container.', [['docker start web', 'start it']], [], ['stop', 'restart']),
    stop: dkB('stop a container', 'docker stop <name>', 'Stop a running container.', [['docker stop web', 'stop it']], [], ['start', 'kill']),
    restart: dkB('restart a container', 'docker restart <name>', 'Stop and start a container.', [['docker restart web', 'restart it']], [], ['start', 'stop']),
    pause: dkB('pause a container', 'docker pause <name>', 'Freeze a running container.', [['docker pause web', 'pause it']], [], ['unpause']),
    unpause: dkB('resume a container', 'docker unpause <name>', 'Resume a paused container.', [['docker unpause web', 'resume it']], [], ['pause']),
    kill: dkB('kill a container', 'docker kill <name>', 'Force-stop a running container.', [['docker kill web', 'kill it']], [], ['stop']),
    rm: dkB('remove a container', 'docker rm <name>', 'Delete a container.', [['docker rm web', 'remove it']], [], ['rmi', 'ps']),
    rmi: dkB('remove an image', 'docker rmi <image>', 'Delete a local image.', [['docker rmi alpine', 'remove an image']], [], ['images', 'rm']),
    logs: dkB('show container logs', 'docker logs <name>', 'Print a container output.', [['docker logs app-web-1', 'the logs'], ['docker logs app-web-1 | grep timeout', 'filter the logs']], [], ['exec', 'inspect']),
    exec: dkB('run a command in a container', 'docker exec [-it] <name> <cmd>', 'Run a command inside a running container.', [['docker exec -it app-web-1 sh', 'open a shell']], [['-it', 'interactive with a terminal']], ['attach', 'logs']),
    attach: dkB('attach to a container', 'docker attach <name>', 'Attach to a running container (simulated).', [['docker attach app-web-1', 'attach']], [], ['exec']),
    inspect: dkB('show container or image JSON', 'docker inspect <name>', 'Print the full configuration as JSON.', [['docker inspect app-web-1', 'the JSON']], [], ['stats', 'logs']),
    stats: dkB('show live resource use', 'docker stats', 'Print CPU, memory, and network use per container.', [['docker stats', 'resource table']], [], ['top', 'inspect']),
    top: dkB('show container processes', 'docker top <name>', 'List the processes running in a container.', [['docker top app-web-1', 'its processes']], [], ['stats']),
    port: dkB('show port mappings', 'docker port <name>', 'List the published ports of a container.', [['docker port app-web-1', 'port mappings']], [], ['inspect']),
    diff: dkB('show filesystem changes', 'docker diff <name>', 'Show files changed in a container since it started.', [['docker diff app-web-1', 'changed files']], [], ['inspect']),
    cp: dkB('copy files to or from a container', 'docker cp <src> <dst>', 'Copy files between the host and a container (simulated).', [['docker cp app-web-1:/log .', 'copy out a file']], [], ['exec']),
    commit: dkB('make an image from a container', 'docker commit <name>', 'Create an image from a container state.', [['docker commit app-web-1', 'the new image id']], [], ['tag', 'build']),
    rename: dkB('rename a container', 'docker rename <old> <new>', 'Change a container name.', [['docker rename web app-web', 'rename it']], [], ['ps']),
    images: dkB('list images', 'docker images', 'List local images with tag and size.', [['docker images', 'local images']], [], ['pull', 'rmi']),
    image: dkB('manage images', 'docker image <ls|rm>', 'Image subcommands: ls lists, rm removes.', [['docker image ls', 'list images']], [], ['images']),
    container: dkB('manage containers', 'docker container <ls|prune>', 'Container subcommands: ls lists, prune removes stopped ones.', [['docker container ls', 'list containers']], [], ['ps']),
    pull: dkB('download an image', 'docker pull <image>', 'Fetch an image into the local store.', [['docker pull postgres:16', 'download it']], [], ['push', 'images']),
    push: dkB('publish an image', 'docker push <image>', 'Upload an image to a registry (simulated).', [['docker push app:1.5', 'publish it']], [], ['pull', 'login']),
    build: dkB('build an image', 'docker build -t <name> <path>', 'Build an image from a Dockerfile. buildx is the same here.', [['docker build -t app:1.5 .', 'build an image']], [['-t name', 'tag the built image']], ['buildx', 'commit']),
    buildx: dkB('build an image', 'docker buildx build ...', 'Extended builder (same simulated output as build).', [['docker buildx build .', 'build an image']], [], ['build']),
    tag: dkB('tag an image', 'docker tag <src> <name:tag>', 'Give an image another name and tag.', [['docker tag app app:1.5', 'tag an image']], [], ['images', 'push']),
    history: dkB('show image layers', 'docker history <image>', 'List the layers that make up an image.', [['docker history nginx', 'image layers']], [], ['images']),
    search: dkB('search for images', 'docker search <term>', 'Search the registry for images (simulated).', [['docker search alpine', 'matching images']], [], ['pull']),
    save: dkB('export an image', 'docker save <image>', 'Export an image as a tar stream (simulated).', [['docker save alpine', 'the tar notice']], [], ['load', 'export']),
    load: dkB('import an image', 'docker load', 'Load an image from a tar stream (simulated).', [['docker load', 'the loaded image']], [], ['save', 'import']),
    export: dkB('export a container', 'docker export <name>', 'Export a container filesystem as a tar (simulated).', [['docker export app-web-1', 'the tar notice']], [], ['save', 'import']),
    import: dkB('import a filesystem', 'docker import', 'Create an image from a tar (simulated).', [['docker import', 'the imported image']], [], ['load', 'export']),
    compose: dkB('manage a compose stack', 'docker compose <up|down|ps|logs|build|config>', 'Control a multi-container stack defined by compose.', [['docker compose up -d', 'bring up the stack'], ['docker compose down', 'tear it down'], ['docker compose ps', 'stack containers']], [['up', 'start the stack'], ['down', 'stop and remove it'], ['ps', 'list stack containers'], ['config', 'show the resolved config']], ['ps', 'build']),
    network: dkB('manage networks', 'docker network <ls|create|rm|inspect>', 'List and manage virtual networks.', [['docker network ls', 'list networks'], ['docker network create appnet', 'create one']], [], ['volume']),
    volume: dkB('manage volumes', 'docker volume <ls|create|rm|inspect>', 'List and manage persistent volumes.', [['docker volume ls', 'list volumes'], ['docker volume create data', 'create one']], [], ['network']),
    info: dkB('show engine info', 'docker info', 'Print engine, container, and image counts.', [['docker info', 'engine summary']], [], ['version', 'system']),
    version: dkB('show the docker version', 'docker version', 'Print client and server versions.', [['docker version', 'the versions']], [], ['info']),
    system: dkB('disk usage and cleanup', 'docker system <df|prune|info>', 'Show disk usage, or prune stopped containers.', [['docker system df', 'disk usage'], ['docker system prune', 'reclaim space']], [['df', 'show disk usage'], ['prune', 'remove stopped containers']], ['info']),
    events: dkB('show engine events', 'docker events', 'Print recent engine events.', [['docker events', 'recent events']], [], ['info']),
    login: dkB('log in to a registry', 'docker login', 'Authenticate to a registry (simulated success).', [['docker login', 'login notice']], [], ['logout', 'push']),
    logout: dkB('log out of a registry', 'docker logout', 'Remove stored registry credentials.', [['docker logout', 'logout notice']], [], ['login']),
    context: dkB('show docker contexts', 'docker context', 'List the docker endpoints (contexts).', [['docker context', 'the contexts']], [], ['info']),
    swarm: dkB('swarm status', 'docker swarm', 'Report swarm mode status (inactive in the sandbox).', [['docker swarm', 'swarm status']], [], ['info']),
    reset: dkB('reset the sandbox', 'reset', 'Restore the starting containers and images.', [['reset', 'restore the sandbox']], [], ['ps'])
  };

  // Network/recon man pages. Targets are simulated; only bundled hosts answer.
  const nwB = (s, syn, d, x, o, see) => ({ s, syn, d, o: o || [], x, see: see || [] });
  G.MAN.network = {
    nmap: nwB('scan ports', 'nmap [-sV] <host>', 'Scan a host for open TCP ports and service versions.', [['nmap 10.0.0.5', 'the port table'], ['nmap -sV 10.0.0.5', 'with versions'], ['nmap 10.0.0.5 | grep open', 'only open ports']], [['-sV', 'probe service and version']], ['masscan', 'nc', 'ss']),
    masscan: nwB('fast port scan', 'masscan <host>', 'Quickly report open ports on a host.', [['masscan 10.0.0.5', 'open ports']], [], ['nmap']),
    ping: nwB('test reachability', 'ping <host>', 'Send ICMP echoes and show replies. hping3 behaves the same.', [['ping 10.0.0.5', 'replies and stats']], [], ['traceroute', 'hping3']),
    hping3: nwB('crafted ping', 'hping3 <host>', 'Send probes to a host (same output as ping here).', [['hping3 10.0.0.5', 'replies']], [], ['ping']),
    traceroute: nwB('trace the path', 'traceroute <host>', 'Show each hop to a destination. tracepath and mtr are the same here.', [['traceroute 10.0.0.5', 'the hops']], [], ['tracepath', 'mtr', 'ping']),
    tracepath: nwB('trace the path', 'tracepath <host>', 'Trace hops to a host (same as traceroute here).', [['tracepath 10.0.0.5', 'the hops']], [], ['traceroute']),
    mtr: nwB('trace and measure', 'mtr <host>', 'Trace and measure hops to a host.', [['mtr 10.0.0.5', 'the hops']], [], ['traceroute']),
    dig: nwB('query DNS', 'dig <name> [+short]', 'Print a DNS answer section, or just the address with +short.', [['dig api.internal', 'the answer section'], ['dig api.internal +short', 'just the address']], [['+short', 'print only the address']], ['nslookup', 'host', 'whois']),
    nslookup: nwB('resolve a name', 'nslookup <name>', 'Resolve a name to an address via the resolver.', [['nslookup api.internal', 'resolve it']], [], ['dig', 'host']),
    host: nwB('resolve a name', 'host <name>', 'Print the address a name resolves to.', [['host api.internal', 'has address ...']], [], ['dig', 'nslookup']),
    resolvectl: nwB('show resolver status', 'resolvectl', 'Print the DNS servers and domain.', [['resolvectl', 'resolver config']], [], ['dig']),
    whois: nwB('look up registration', 'whois <domain>', 'Print registrar and dates for a domain.', [['whois example.internal', 'registration info']], [], ['dig']),
    curl: nwB('make an HTTP request', 'curl <url>', 'Fetch a URL and show the exchange and body.', [['curl https://api.internal/health', 'request and response']], [], ['wget', 'openssl']),
    wget: nwB('fetch a URL', 'wget <url>', 'Fetch a URL (same output as curl here).', [['wget https://api.internal/health', 'the response']], [], ['curl']),
    openssl: nwB('inspect a TLS chain', 'openssl s_client -connect host:443', 'Show the TLS handshake and certificate chain.', [['openssl s_client -connect api.internal:443', 'the chain']], [], ['curl']),
    nikto: nwB('scan a web server', 'nikto -h <host>', 'Fingerprint a web server and flag common issues.', [['nikto -h 10.0.0.5', 'findings']], [], ['whatweb', 'gobuster']),
    gobuster: nwB('brute-force paths', 'gobuster dir -u <host>', 'Discover directories and files on a web server. ffuf and dirb are the same here.', [['gobuster dir -u 10.0.0.5', 'found paths']], [], ['ffuf', 'dirb']),
    ffuf: nwB('fuzz web paths', 'ffuf -u <host>', 'Fuzz web paths (same output as gobuster here).', [['ffuf -u 10.0.0.5', 'found paths']], [], ['gobuster']),
    dirb: nwB('scan web paths', 'dirb <host>', 'Scan for web paths (same output as gobuster here).', [['dirb http://10.0.0.5', 'found paths']], [], ['gobuster']),
    whatweb: nwB('fingerprint a web server', 'whatweb <host>', 'Identify the web server and technologies.', [['whatweb 10.0.0.5', 'server details']], [], ['nikto']),
    ss: nwB('list sockets', 'ss [-tulpn]', 'List listening and established sockets.', [['ss', 'sockets'], ['ss | grep LISTEN', 'listeners']], [], ['netstat', 'ip']),
    netstat: nwB('list connections', 'netstat [-antp]', 'List sockets with addresses and state.', [['netstat', 'connections']], [], ['ss', 'route']),
    ip: nwB('show addresses or routes', 'ip <addr|route>', 'Show interface addresses, or routes when the argument starts with r.', [['ip addr', 'interfaces'], ['ip route', 'routes']], [], ['ifconfig', 'route']),
    ifconfig: nwB('show interfaces', 'ifconfig', 'Print interface addresses and MAC.', [['ifconfig', 'interfaces']], [], ['ip']),
    route: nwB('show the routing table', 'route', 'Print the kernel routing table.', [['route', 'routes']], [], ['ip', 'netstat']),
    arp: nwB('show the ARP cache', 'arp -a', 'Print the IP-to-MAC neighbor table.', [['arp -a', 'the ARP cache']], [], ['ip']),
    ethtool: nwB('show adapter settings', 'ethtool <iface>', 'Print link speed and duplex for an interface.', [['ethtool eth0', 'link settings']], [], ['nmcli']),
    nmcli: nwB('show network manager state', 'nmcli', 'List devices and their connections.', [['nmcli', 'devices']], [], ['ifconfig']),
    tcpdump: nwB('capture packets', 'tcpdump', 'Print captured packet summaries. tshark is the same here.', [['tcpdump', 'captured packets']], [], ['tshark']),
    tshark: nwB('capture packets', 'tshark', 'Print captured packets (same output as tcpdump here).', [['tshark', 'captured packets']], [], ['tcpdump']),
    ssh: nwB('open a remote shell (simulated)', 'ssh <user@host>', 'Show the SSH host-key prompt and banner.', [['ssh dev@10.0.0.5', 'connect']], [], ['scp', 'nc']),
    scp: nwB('copy over SSH (simulated)', 'scp <src> <dst>', 'Report a secure file copy.', [['scp notes.txt dev@10.0.0.5:/tmp', 'upload']], [], ['sftp', 'rsync']),
    sftp: nwB('SSH file transfer (simulated)', 'sftp <host>', 'Open an SFTP session (simulated).', [['sftp 10.0.0.5', 'connect']], [], ['scp']),
    ftp: nwB('connect to FTP (simulated)', 'ftp <host>', 'Open an FTP session (simulated).', [['ftp 10.0.0.5', 'connect']], [], ['sftp']),
    rsync: nwB('sync files (simulated)', 'rsync <src> <dst>', 'Report a file sync.', [['rsync a/ dev@10.0.0.5:/b', 'sync a folder']], [], ['scp']),
    nc: nwB('test a TCP port', 'nc <host> <port>', 'Report whether a TCP port accepts a connection. ncat, netcat, socat and telnet are the same here.', [['nc 10.0.0.5 80', 'port 80 open']], [], ['ncat', 'socat', 'telnet']),
    ncat: nwB('test a TCP port', 'ncat <host> <port>', 'Test a socket (same as nc here).', [['ncat 10.0.0.5 80', 'port open']], [], ['nc']),
    socat: nwB('relay sockets (simulated)', 'socat <host> <port>', 'Test a socket (same output as nc here).', [['socat 10.0.0.5 80', 'port open']], [], ['nc']),
    telnet: nwB('connect with telnet (simulated)', 'telnet <host> <port>', 'Test a TCP port with telnet.', [['telnet 10.0.0.5 80', 'port open']], [], ['nc']),
    iptables: nwB('show firewall rules', 'iptables -L', 'Print the INPUT chain rules. nft is the same here.', [['iptables -L', 'the rules']], [], ['nft', 'ufw']),
    nft: nwB('show firewall rules', 'nft list ruleset', 'Print firewall rules (same output as iptables here).', [['nft list ruleset', 'the rules']], [], ['iptables']),
    ufw: nwB('show the firewall status', 'ufw status', 'Print the firewall status and allowed ports. firewall-cmd is the same here.', [['ufw status', 'allowed ports']], [], ['firewall-cmd', 'iptables']),
    'firewall-cmd': nwB('show the firewall status', 'firewall-cmd', 'Print the firewall status (same as ufw here).', [['firewall-cmd --list-all', 'allowed ports']], [], ['ufw']),
    wg: nwB('show the VPN interface', 'wg', 'Print the WireGuard interface and peer. openvpn is the same here.', [['wg', 'the VPN interface']], [], ['openvpn']),
    openvpn: nwB('show the VPN interface', 'openvpn', 'Print the VPN interface (same output as wg here).', [['openvpn', 'the VPN interface']], [], ['wg']),
    enum4linux: nwB('enumerate SMB/RPC', 'enum4linux <host>', 'Probe SMB and RPC services. smbclient and rpcclient are the same here.', [['enum4linux 10.0.0.5', 'the probe']], [], ['smbclient', 'rpcclient']),
    smbclient: nwB('access SMB shares', 'smbclient <host>', 'Probe SMB shares (same output here).', [['smbclient 10.0.0.5', 'the probe']], [], ['enum4linux']),
    rpcclient: nwB('query RPC', 'rpcclient <host>', 'Probe RPC services (same output here).', [['rpcclient 10.0.0.5', 'the probe']], [], ['enum4linux']),
    snmpwalk: nwB('walk SNMP OIDs', 'snmpwalk <host>', 'Read SNMP system values from a host.', [['snmpwalk 10.0.0.5', 'SNMP values']], [], ['ldapsearch']),
    ldapsearch: nwB('query LDAP', 'ldapsearch <host>', 'Read LDAP directory entries.', [['ldapsearch 10.0.0.5', 'directory entries']], [], ['snmpwalk']),
    hydra: nwB('credential testing (training only)', 'hydra <args>', 'No live brute-force runs here: it is an offline training stub.', [['hydra 10.0.0.5', 'the training notice']], [], [])
  };

  // Encoding / crypto man pages. Each transform takes text as an argument or from a pipe; -d decodes where it applies.
  const cyB = (s, syn, d, x, o, see) => ({ s, syn, d, o: o || [], x, see: see || [] });
  G.MAN.crypto = {
    base64: cyB('Base64 encode or decode', 'base64 [-d] <text>', 'Base64-encode text, or decode with -d.', [['base64 secret', 'encode'], ['base64 -d c2VjcmV0', 'decode']], [['-d', 'decode (also --decode)']], ['base64url', 'hex']),
    base64url: cyB('URL-safe Base64', 'base64url [-d] <text>', 'Base64 with URL-safe characters and no padding.', [['base64url secret', 'encode'], ['base64url -d c2VjcmV0', 'decode']], [['-d', 'decode']], ['base64']),
    base32: cyB('Base32 encode or decode', 'base32 [-d] <text>', 'Base32-encode text, or decode with -d.', [['base32 hello', 'encode'], ['base32 -d NBSWY3DP', 'decode']], [['-d', 'decode']], ['base64']),
    base58: cyB('Base58 encode', 'base58 <text>', 'Base58-encode text (the Bitcoin alphabet).', [['base58 hello', 'encode']], [], ['base64']),
    hex: cyB('hex encode or decode', 'hex [-d] <text>', 'Hex-encode text, or decode with -d or -r. xxd is the same.', [['hex hello', '68656c6c6f'], ['hex -d 68656c6c6f', 'hello']], [['-d', 'decode (also -r)']], ['xxd', 'binary']),
    xxd: cyB('hex encode or decode', 'xxd [-d] <text>', 'Hex-encode or decode text (same as hex here).', [['xxd hello', '68656c6c6f'], ['xxd -d 68656c6c6f', 'hello']], [['-d', 'decode (also -r)']], ['hex']),
    binary: cyB('binary encode or decode', 'binary [-d] <text>', 'Encode text as 8-bit binary, or decode with -d.', [['binary hi', '01101000 01101001'], ['binary -d "01101000 01101001"', 'hi']], [['-d', 'decode']], ['hex']),
    decimal: cyB('decimal code points', 'decimal [-d] <text>', 'Show the decimal code of each character, or decode with -d. ascii and dec are the same.', [['decimal AB', '65 66'], ['decimal -d "65 66"', 'AB']], [['-d', 'decode']], ['octal', 'ascii']),
    octal: cyB('octal code points', 'octal [-d] <text>', 'Show the octal code of each character, or decode with -d.', [['octal A', '101'], ['octal -d 101', 'A']], [['-d', 'decode']], ['decimal']),
    ascii: cyB('ASCII code points', 'ascii [-d] <text>', 'Show the decimal code of each character (same as decimal).', [['ascii A', '65']], [['-d', 'decode']], ['decimal', 'ord']),
    ord: cyB('code of one character', 'ord <char>', 'Print the code point of the first character.', [['ord A', '65']], [], ['chr', 'ascii']),
    chr: cyB('character from a code', 'chr <number>', 'Print the character for a decimal code point.', [['chr 65', 'A']], [], ['ord']),
    url: cyB('URL encode or decode', 'url [-d] <text>', 'Percent-encode text, or decode with -d.', [['url "a b&c"', 'a%20b%26c'], ['url -d a%20b%26c', 'a b&c']], [['-d', 'decode']], ['html']),
    html: cyB('HTML entity encode or decode', 'html [-d] <text>', 'Escape HTML special characters, or decode with -d.', [['html "<b>"', '&lt;b&gt;'], ['html -d "&lt;b&gt;"', '<b>']], [['-d', 'decode']], ['url', 'unicode']),
    unicode: cyB('Unicode escape or decode', 'unicode [-d] <text>', 'Turn text into \\u escapes, or decode them with -d.', [['unicode hi', '\\u0068\\u0069'], ['unicode -d "\\u0068\\u0069"', 'hi']], [['-d', 'decode']], ['html']),
    jwt: cyB('decode a JWT', 'jwt <token>', 'Decode the header and payload of a JWT. It does not verify the signature.', [['jwt eyJ...header.eyJ...payload.sig', 'header and payload']], [], ['base64url']),
    rot13: cyB('ROT13 cipher', 'rot13 <text>', 'Rotate letters 13 places. Twice returns the original.', [['rot13 hello', 'uryyb'], ['echo uryyb | rot13', 'hello']], [], ['rot47', 'caesar']),
    rot47: cyB('ROT47 cipher', 'rot47 <text>', 'Rotate printable ASCII 47 places. Twice returns the original.', [['rot47 Hello', 'the shifted text']], [], ['rot13']),
    caesar: cyB('Caesar shift cipher', 'caesar [N] <text>', 'Shift letters by N (default 3). Negative N shifts back.', [['caesar 3 abc', 'def'], ['caesar -3 def', 'abc']], [['N', 'the shift amount']], ['rot13', 'vigenere']),
    atbash: cyB('Atbash cipher', 'atbash <text>', 'Mirror the alphabet (A becomes Z). Twice returns the original.', [['atbash abc', 'zyx']], [], ['caesar']),
    vigenere: cyB('Vigenere cipher', 'vigenere [-d] <key> <text>', 'Shift each letter by a repeating key. Decode with -d.', [['vigenere KEY hello', 'encode'], ['vigenere -d KEY rijvs', 'decode']], [['-d', 'decode with the key']], ['caesar', 'xor']),
    xor: cyB('XOR cipher', 'xor <key> <text>', 'XOR each byte with a repeating key (a number or text). Twice returns the original.', [['xor 42 hello', 'the XORed bytes']], [], ['vigenere']),
    morse: cyB('Morse code', 'morse [-d] <text>', 'Encode letters and digits to Morse, or decode with -d. Quote or pipe the dots and dashes when decoding.', [['morse sos', '... --- ...'], ['echo sos | morse | morse -d', 'sos']], [['-d', 'decode Morse']], ['nato']),
    nato: cyB('NATO phonetic alphabet', 'nato <text>', 'Spell each letter with its NATO word.', [['nato abc', 'Alpha Bravo Charlie']], [], ['morse']),
    reverse: cyB('reverse a string', 'reverse <text>', 'Reverse the characters. rev is the same.', [['reverse hello', 'olleh']], [], ['rev']),
    md5: cyB('MD5 hash', 'md5 <text>', 'Print a deterministic MD5-style hash.', [['md5 hello', 'the hash']], [], ['sha256', 'hmac']),
    sha1: cyB('SHA-1 hash', 'sha1 <text>', 'Print a deterministic SHA-1-style hash.', [['sha1 hello', 'the hash']], [], ['sha256']),
    sha256: cyB('SHA-256 hash', 'sha256 <text>', 'Print a deterministic SHA-256-style hash.', [['sha256 hello', 'the hash']], [], ['sha512', 'hmac']),
    sha512: cyB('SHA-512 hash', 'sha512 <text>', 'Print a deterministic SHA-512-style hash.', [['sha512 hello', 'the hash']], [], ['sha256']),
    crc32: cyB('CRC32 checksum', 'crc32 <text>', 'Print a short CRC32-style checksum.', [['crc32 hello', 'the checksum']], [], ['md5']),
    hmac: cyB('HMAC', 'hmac <key> <text>', 'Print an HMAC-style digest over key and text.', [['hmac secret hello', 'the digest']], [], ['sha256']),
    uuid: cyB('random UUID', 'uuid', 'Print a random version-4 UUID.', [['uuid', 'a UUID']], [], ['random']),
    random: cyB('random hex bytes', 'random [n]', 'Print n random bytes as hex (default 16).', [['random', '16 random bytes'], ['random 4', '4 random bytes']], [], ['uuid']),
    entropy: cyB('Shannon entropy', 'entropy <text>', 'Measure the information density of text in bits per character.', [['entropy password', 'bits per char'], ['entropy aaaa', '0 bits/char']], [], ['freq']),
    freq: cyB('character frequency', 'freq <text>', 'Count how often each character appears, most frequent first.', [['freq hello', 'l: 2, ...']], [], ['entropy']),
    len: cyB('string length', 'len <text>', 'Print the number of characters.', [['len hello', '5']], [], []),
    strings: cyB('printable runs', 'strings <text>', 'Print runs of 4 or more printable characters.', [['strings "ab\\x00cdef"', 'the readable runs']], [], ['freq']),
    upper: cyB('upper-case', 'upper <text>', 'Convert text to upper case.', [['upper hello', 'HELLO']], [], ['lower']),
    lower: cyB('lower-case', 'lower <text>', 'Convert text to lower case.', [['lower HELLO', 'hello']], [], ['upper']),
    echo: cyB('print text', 'echo <text>', 'Print the text back, useful at the start of a pipe.', [['echo hello | rot13', 'uryyb']], [], ['reverse'])
  };

  G.renderMan = function (shellId, name, m) {
    const pad = (G.MAN[shellId] && Object.values(G.MAN[shellId]).length) ? 10 : 10;
    const out = [name.toUpperCase() + '  -  ' + m.s, '', 'SYNOPSIS', '  ' + m.syn, '', 'DESCRIPTION'];
    for (const line of m.d.split('\n')) out.push('  ' + line);
    if (m.o && m.o.length) { out.push('', 'OPTIONS'); for (const [f, d] of m.o) out.push('  ' + String(f).padEnd(pad) + '  ' + d); }
    if (m.x && m.x.length) { out.push('', 'EXAMPLES'); for (const [c, d] of m.x) out.push('  ' + String(c).padEnd(34) + (d ? '  ' + d : '')); }
    const notes = G.SHELL_NOTES[shellId];
    if (notes) out.push('', notes);
    if (m.see && m.see.length) out.push('', 'SEE ALSO: ' + m.see.join(', '));
    return out.join('\n');
  };
  G.MAN_ALIAS = { ll: 'ls', la: 'ls', dir: 'ls', less: 'cat', more: 'cat', view: 'cat', egrep: 'grep', fgrep: 'grep',
    hexdump: 'xxd', od: 'xxd', ncat: 'nc', killall: 'pkill', bzip2: 'gzip', xz: 'gzip', realpath: 'ln', readlink: 'ln' };

  G.formatHelp = function (shellId, args) {
    const sections = G.HELP_DB[shellId] || G.HELP_DB.bash;
    const topic = Array.isArray(args) ? (args[0] || '').trim().toLowerCase() : String(args || '').trim().toLowerCase();
    if (topic) {
      // A full man page wins when the topic names a known command (resolving a few aliases first).
      const man = G.MAN[shellId] || {};
      const canon = man[topic] ? topic : (G.MAN_ALIAS[topic] && man[G.MAN_ALIAS[topic]] ? G.MAN_ALIAS[topic] : null);
      if (canon) return G.renderMan(shellId, canon, man[canon]);
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
    const out = [shellId.toUpperCase() + ' SANDBOX COMMAND REFERENCE   (tip: `help <name>` shows a full man page: flags, examples, piping)'];
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
      const longFlag = { all: 'a', 'almost-all': 'A', 'human-readable': 'h', recursive: 'R', inode: 'i', reverse: 'r', directory: 'd', classify: 'F' };
      for (const x of a) {
        if (x.startsWith('--')) { const f = longFlag[x.slice(2)]; if (f) flags += f; }   // --color and friends change nothing here
        else if (x.startsWith('-') && x.length > 1) flags += x.slice(1);
        else targets.push(x);
      }
      if (!targets.length) targets = ['.'];
      const outs = [], errors = [];
      const onePerLine = flags.includes('1') || flags.includes('l');
      // Sizes are real byte counts, a directory counts 2 links plus one per subdirectory, and blocks are 4 KB like ext4.
      const bytes = c => isDir(c) ? 4096 : new TextEncoder().encode(textOf(c)).length;
      const links = c => isDir(c) ? 2 + Object.values(c).filter(isDir).length : 1;
      const human = size => size < 1024 ? String(size) : (size / 1024).toFixed(size < 10240 ? 1 : 0).replace(/\.0$/, '') + 'K';
      // A stable fake inode so `ls -i` prints a consistent number per name (the sandbox has no real inode table).
      const inode = name => { let h = 2166136261; for (let i = 0; i < name.length; i++) { h = (h ^ name.charCodeAt(i)) * 16777619 >>> 0; } return 100000 + h % 900000; };
      const tag = c => flags.includes('F') ? (isDir(c) ? '/' : '') : '';   // -F classify: only dir markers apply in this sandbox
      // Order the names in a directory: alphabetical, then -S (largest first) and -r (reverse) if asked.
      const order = (node, names) => {
        let ns = names.slice().sort();
        if (flags.includes('S')) ns.sort((x, y) => bytes(node[y]) - bytes(node[x]));
        if (flags.includes('r')) ns.reverse();
        return ns;
      };
      const nameCell = (node, k) => (flags.includes('i') ? inode(k) + ' ' : '') + k + (isDir(node[k]) ? '/' : tag(node[k]) ? '' : '');
      const row = (c, name) => (flags.includes('i') ? String(inode(name)).padStart(6) + ' ' : '') + permOf(c) + ' ' + String(links(c)).padStart(2) + ' dev dev ' +
        (flags.includes('h') ? human(bytes(c)) : String(bytes(c))).padStart(5) + ' Feb 12 06:20 ' + name + tag(c);
      // ls -R: each folder as its own "path:" section, depth first, like GNU ls.
      if (flags.includes('R')) {
        const listDir = (node, label) => {
          const names = order(node, Object.keys(node).filter(k => flags.includes('a') || flags.includes('A') || k[0] !== '.'));
          outs.push((outs.length ? '\n' : '') + label + ':');
          if (flags.includes('l')) for (const k of names) outs.push(row(node[k], k));
          else if (names.length) outs.push(names.map(k => nameCell(node, k)).join(onePerLine ? '\n' : '  '));
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
        if (!isDir(n)) { outs.push(flags.includes('l') ? row(n, t) : (flags.includes('i') ? inode(t) + ' ' : '') + t + tag(n)); continue; }
        // ls -d lists the directory entry itself instead of its contents.
        if (flags.includes('d')) { outs.push(flags.includes('l') ? row(n, t) : (flags.includes('i') ? inode(t) + ' ' : '') + t + (flags.includes('F') ? '/' : '')); continue; }
        if (!(Unix.mode(n, true) & 0o400)) { errors.push("ls: cannot open directory '" + t + "': Permission denied"); continue; }
        const names = order(n, Object.keys(n).filter(k => flags.includes('a') || flags.includes('A') || k[0] !== '.'));
        const dots = flags.includes('a') ? [['.', n], ['..', walk(parts.slice(0, -1)) || n]] : [];
        if (targets.length > 1) outs.push((outs.length ? '\n' : '') + t + ':');
        if (flags.includes('l')) {
          const entries = [...dots, ...names.map(k => [k, n[k]])];
          outs.push('total ' + entries.reduce((sum, [, c]) => sum + Math.max(4, Math.ceil(bytes(c) / 4096) * 4), 0));
          for (const [k, c] of entries) outs.push(row(c, k));
        } else if (names.length || dots.length) outs.push([...dots.map(([k, c]) => (flags.includes('i') ? inode(k) + ' ' : '') + k + '/'), ...names.map(k => nameCell(n, k))].join(onePerLine ? '\n' : '  '));
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
    // Classic CTF / web encodings, mirroring the crypto sandbox so `help` never advertises a dead command.
    const rotN = (t, n) => [...t].map(c => /[a-z]/i.test(c) ? String.fromCharCode((c <= 'Z' ? 65 : 97) + (((c.charCodeAt(0) - (c <= 'Z' ? 65 : 97) + n) % 26) + 26) % 26) : c).join('');
    const encArg = (a, stdin) => { const pos = a.filter(x => !x.startsWith('-')); const r = src(pos, stdin); return r.err ? pos.join(' ') : r.text; };
    const MORSE = { a: '.-', b: '-...', c: '-.-.', d: '-..', e: '.', f: '..-.', g: '--.', h: '....', i: '..', j: '.---', k: '-.-', l: '.-..', m: '--', n: '-.', o: '---', p: '.--.', q: '--.-', r: '.-.', s: '...', t: '-', u: '..-', v: '...-', w: '.--', x: '-..-', y: '-.--', z: '--..', 0: '-----', 1: '.----', 2: '..---', 3: '...--', 4: '....-', 5: '.....', 6: '-....', 7: '--...', 8: '---..', 9: '----.' };
    const MORSE_REV = Object.fromEntries(Object.entries(MORSE).map(([k, v]) => [v, k]));
    C.caesar = (a, stdin) => { const hasN = /^-?\d+$/.test(a[0] || ''); const n = hasN ? parseInt(a[0], 10) : 3; const r = src((hasN ? a.slice(1) : a).filter(x => !x.startsWith('-')), stdin); return rotN(r.err ? (hasN ? a.slice(1) : a).filter(x => !x.startsWith('-')).join(' ') : r.text, n); };
    C.hex = (a, stdin) => { const dec = a.includes('-d') || a.includes('-r'); const t = encArg(a, stdin); return dec ? (t.replace(/[^0-9a-f]/gi, '').match(/.{2}/g) || []).map(h => String.fromCharCode(parseInt(h, 16))).join('') : [...t].map(c => c.charCodeAt(0).toString(16).padStart(2, '0')).join(''); };
    C.binary = (a, stdin) => { const dec = a.includes('-d'); const t = encArg(a, stdin); return dec ? (t.trim().split(/\s+/).map(b => String.fromCharCode(parseInt(b, 2))).join('')) : [...t].map(c => c.charCodeAt(0).toString(2).padStart(8, '0')).join(' '); };
    C.url = (a, stdin) => { const dec = a.includes('-d'); const t = encArg(a, stdin); try { return dec ? decodeURIComponent(t.trim()) : encodeURIComponent(t); } catch (e) { return t; } };
    C.morse = (a, stdin) => { const dec = a.includes('-d'); const t = encArg(a, stdin); return dec ? t.trim().split(/\s+/).map(s => MORSE_REV[s] || '').join('') : [...t.toLowerCase()].map(c => c === ' ' ? '/' : (MORSE[c] || '')).filter(Boolean).join(' '); };
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
      if (!target) return 'Nmap 7.94 ( https://nmap.org )\nUsage: nmap [-sV] <host>\nThe hosts in this sandbox are on 192.168.56.0/24. Try: nmap 192.168.56.0/24';
      // Honest result: only real sandbox hosts (the 192.168.56.0/24 office LAN) answer. Any other IP, including the
      // random host written into generated config.json/todo lore, is reported down, so nmap agrees with ssh (which
      // cannot resolve it). Previously an arbitrary IP was faked as up with ssh/http open, contradicting ssh.
      return 'Starting Nmap 7.94 ( https://nmap.org )\nNote: Host seems down. If it is really up, but blocking our ping probes, try -Pn\nNmap done: 1 IP address (0 hosts up) scanned in 3.04 seconds';
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

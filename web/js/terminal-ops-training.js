// Offline training tools. The capture and credential findings are bundled fixtures.
const TerminalOpsTraining = (() => {
  const Unix = typeof module !== 'undefined' && module.exports ? require('./terminal-unix.js') : TerminalUnix;
  const capture = 'incident.pcapng';
  const baseline = 'baseline.pcapng';
  const source = '192.0.2.15', resolver = '192.0.2.53', service = '198.51.100.20';
  const query = 'updates.example';
  const frames = [
    { time: '0.000000000', from: source, to: resolver, protocol: 'DNS', length: 76, query, info: 'Standard query 0x1701 A ' + query },
    { time: '0.009200000', from: resolver, to: source, protocol: 'DNS', length: 92, query, answer: service, info: 'Standard query response 0x1701 A ' + query + ' A ' + service },
    { time: '0.011800000', from: source, to: service, protocol: 'TCP', length: 74, fromPort: 49218, toPort: 443, info: '49218 → 443 [SYN] Seq=0 Win=64240 Len=0' },
    { time: '0.062500000', from: service, to: source, protocol: 'TCP', length: 74, fromPort: 443, toPort: 49218, info: '443 → 49218 [SYN, ACK] Seq=0 Ack=1 Win=65160 Len=0' }
  ].map((frame, index) => ({ ...frame, number: index + 1 }));
  const captures = new Map([[capture, frames], [baseline, frames.slice(0, 2)]]);
  const captureRows = file => captures.get(file?.replace(/^(?:\.\/|\/training\/)/, ''));
  const fields = new Map([
    ['frame.number', f => f.number], ['frame.time_relative', f => f.time], ['frame.len', f => f.length],
    ['ip.src', f => f.from], ['ip.dst', f => f.to], ['ip.addr', f => [f.from, f.to]],
    ['tcp.srcport', f => f.fromPort], ['tcp.dstport', f => f.toPort], ['tcp.port', f => [f.fromPort, f.toPort]],
    ['dns.qry.name', f => f.query], ['dns.a', f => f.answer]
  ]);
  const packetValues = (field, frame) => [fields.get(field)(frame)].flat().filter(value => value !== undefined).map(String);
  const error = out => ({ out, err: true });
  function displayFilter(expression) {
    if (!expression?.trim()) return () => true;
    const alternatives = expression.split('||').map(group => group.split('&&').map(term => {
      const condition = term.trim();
      if (/^(dns|tcp)$/.test(condition)) return frame => frame.protocol.toLowerCase() === condition;
      const match = /^([\w.]+)\s*==\s*(?:"([\w.-]+)"|([\w.-]+))$/.exec(condition);
      if (!match || !fields.has(match[1])) return null;
      return frame => packetValues(match[1], frame).includes(match[2] ?? match[3]);
    }));
    return alternatives.some(group => group.includes(null)) ? null : frame => alternatives.some(group => group.every(test => test(frame)));
  }
  const auditFindings = [
    ['common_password_match', 6, 20, 'Block commonly used and compromised passwords'],
    ['legacy_hash_storage', 20, 20, 'Migrate to salted costed password hashing'],
    ['missing_mfa', 8, 20, 'Enroll users in phishing-resistant MFA']
  ];
  const failedLogins = [
    ['backup', '203.0.113.44', 'Sat Feb 14 06:19'], ['ops', '192.0.2.15', 'Sat Feb 14 06:17'],
    ['ops', '192.0.2.15', 'Sat Feb 14 06:16'], ['operator', '203.0.113.44', 'Sat Feb 14 06:14']
  ];
  const artifacts = new Map([
    ['incident-artifact.txt', 'channel=unreviewed\ntransport=http\n'],
    ['baseline-artifact.txt', 'channel=stable\ntransport=https\n']
  ]);
  const indicators = [
    { rule: 'Unreviewed_Update_Channel', identifier: '$channel', text: 'channel=unreviewed' },
    { rule: 'Cleartext_Update_Transport', identifier: '$transport', text: 'transport=http\n' }
  ];
  const events = [
    { event_type: 'dns', src_ip: source, dest_ip: resolver, dns: { rrname: query } },
    { event_type: 'alert', src_ip: source, dest_ip: service, dest_port: 443,
      alert: { signature: 'Training fixture: connection to reviewed endpoint', severity: 3 } }
  ];
  function captureFilter(expression) {
    if (!expression) return () => true;
    const tests = expression.split(/\s+and\s+/).map(term => {
      if (term === 'tcp' || term === 'udp') return frame => (frame.protocol === 'TCP' ? 'tcp' : 'udp') === term;
      const match = /^(?:(src|dst) )?(host|port) ([\d.]+)$/.exec(term);
      if (!match) return null;
      const [, direction, kind, value] = match;
      if (kind === 'port' ? !/^\d+$/.test(value) || Number(value) > 65535 :
        !/^(?:\d{1,3}\.){3}\d{1,3}$/.test(value) || value.split('.').some(part => Number(part) > 255)) return null;
      return frame => {
        const endpoints = kind === 'host' ? [frame.from, frame.to] : [frame.fromPort ?? (frame.answer ? 53 : 49171), frame.toPort ?? (frame.answer ? 49171 : 53)];
        return (direction === 'src' ? endpoints.slice(0, 1) : direction === 'dst' ? endpoints.slice(1) : endpoints).map(String).includes(value);
      };
    });
    return tests.includes(null) ? null : frame => tests.every(test => test(frame));
  }
  function packetSummary(frame) {
    const timestamp = '06:14:' + frame.time.padStart(12, '0').slice(0, 9);
    if (frame.protocol === 'TCP') {
      return timestamp + ' IP ' + frame.from + '.' + frame.fromPort + ' > ' + frame.to + '.' + frame.toPort +
        (frame.fromPort === 443 ? ': Flags [S.], seq 0, ack 1, win 65160, length 0' : ': Flags [S], seq 0, win 64240, length 0');
    }
    const [fromPort, toPort] = frame.answer ? [53, 49171] : [49171, 53];
    const dns = frame.answer ? '5889 1/0/0 A ' + frame.answer : '5889+ A? ' + frame.query + '.';
    return timestamp + ' IP ' + frame.from + '.' + fromPort + ' > ' + frame.to + '.' + toPort + ': ' + dns + ' (' + (frame.length - 42) + ')';
  }
  const property = (value, path) => path.split('.').filter(Boolean).reduce((current, key) =>
    (current != null && Object.hasOwn(current, key) ? current[key] : null), value);
  function jsonFilters(program) {
    return program.split(/\s*\|\s*/).map(expression => {
      const step = expression.trim();
      if (step === '.') return value => [value];
      if (step === 'length') return value => {
        if (value === null) return [0];
        if (typeof value === 'string') return [[...value].length];
        if (typeof value === 'number') return [Math.abs(value)];
        if (typeof value === 'object') return [Object.keys(value).length];
        throw new Error('boolean has no length');
      };
      if (step === 'keys') return value => {
        if (!value || typeof value !== 'object') throw new Error('keys requires an object or array');
        return [Array.isArray(value) ? value.map((_, i) => i) : Object.keys(value).sort()];
      };
      const field = /^(\.(?:[A-Za-z_]\w*(?:\.[A-Za-z_]\w*)*)?)(\[\])?$/.exec(step);
      if (field) return value => {
        const result = property(value, field[1]);
        if (!field[2]) return [result];
        if (result == null || typeof result !== 'object') throw new Error('cannot iterate over this value');
        return Object.values(result);
      };
      const select = /^select\(\s*(\.[A-Za-z_]\w*(?:\.[A-Za-z_]\w*)*)\s*==\s*("(?:[^"\\]|\\.)*"|-?\d+(?:\.\d+)?|true|false|null)\s*\)$/.exec(step);
      if (select) {
        const expected = JSON.parse(select[2]);
        return value => property(value, select[1]) === expected ? [value] : [];
      }
      throw new Error('unsupported filter: ' + step);
    });
  }
  const tools = {
    'security-tools'(args) {
      if (args.length) return error('Usage: security-tools');
      return { out: [
        'Offline training evidence · incident.pcapng and baseline.pcapng',
        '  capinfos -t -c incident.pcapng',
        '  tshark -r incident.pcapng -Y dns',
        '  tshark -r incident.pcapng -Y "tcp && tcp.port == 443" -T fields -e ip.src -e ip.dst -E header=y',
        '  tcpdump -nn -r incident.pcapng tcp and dst port 443',
        '  yara -s indicators.yar incident-artifact.txt',
        '  jq -r \'select(.event_type == "alert") | .alert.signature\' eve.json',
        '  lastb -n 3',
        '  password-audit --format csv',
        'Try comparing captures or correlating the source addresses with the bundled failed-login records.'
      ].join('\n') };
    },
    capinfos(args) {
      const usage = 'Usage in this lab: capinfos [-t] [-E] [-c] [-d] <bundled capture> ...';
      if (args.includes('--help') || args.includes('-h')) return { out: usage };
      const flags = args.filter(arg => arg.startsWith('-'));
      const files = args.filter(arg => !arg.startsWith('-'));
      if (!files.length || flags.some(flag => !/^-[tEcd]+$/.test(flag))) return error(usage);
      const options = flags.join('') || '-tEcd';
      const output = [], problems = [];
      for (const file of files) {
        const rows = captureRows(file);
        if (!rows) { problems.push('capinfos: Cannot open ' + file + ': bundled capture not found'); continue; }
        const stats = ['File name:           ' + file];
        if (options.includes('t')) stats.push('File type:           Wireshark/... - pcapng');
        if (options.includes('E')) stats.push('File encapsulation:  Ethernet');
        if (options.includes('c')) stats.push('Number of packets:   ' + rows.length);
        if (options.includes('d')) stats.push('Data size:           ' + rows.reduce((total, row) => total + row.length, 0) + ' bytes');
        output.push(stats.join('\n'));
      }
      return { out: [...output, ...problems].join('\n\n'), err: !!problems.length };
    },
    tshark(args) {
      const usage = 'Usage in this lab: tshark -r <bundled capture> [-Y <display filter>] [-T fields -e <field> ... [-E header=y]]';
      if (args.includes('--help') || args.includes('-h')) return { out: usage + '\nFields: ' + [...fields.keys()].join(', ') };
      let file, filter, format, header = false;
      const selected = [];
      for (let i = 0; i < args.length; i += 2) {
        const [option, value] = args.slice(i, i + 2);
        if (value === undefined) return error(usage);
        switch (option) {
          case '-r': file = value; break;
          case '-Y': filter = value; break;
          case '-T': if (value !== 'fields') return error(usage); format = value; break;
          case '-e': if (!fields.has(value)) return error('tshark: unsupported fixture field: ' + value); selected.push(value); break;
          case '-E': if (!/^header=[yn]$/.test(value)) return error(usage); header = value.endsWith('y'); break;
          default: return error(usage);
        }
      }
      if (!file || (format === 'fields') !== (selected.length > 0) || (header && !format)) return error(usage);
      const capturedFrames = captureRows(file);
      if (!capturedFrames) return error('tshark: Cannot open ' + file + ': bundled capture not found');
      const matches = displayFilter(filter);
      if (!matches) return error('tshark: unsupported display filter: ' + filter);
      const rows = capturedFrames.filter(matches);
      if (format) {
        const values = rows.map(frame => selected.map(field => packetValues(field, frame).join(',')).join('\t'));
        if (header) values.unshift(selected.join('\t'));
        return { out: values.join('\n') };
      }
      return { out: rows.map(f => String(f.number).padStart(5) + ' ' + f.time + ' ' + f.from + ' → ' + f.to +
        '  ' + f.protocol + ' ' + f.length + ' ' + f.info).join('\n') };
    },
    tcpdump(args) {
      const usage = 'Usage in this lab: tcpdump [-n|-nn] [-c <count>] -r <bundled capture> [filter]';
      if (args.includes('--help') || args.includes('-h')) return { out: usage };
      let file, count = Infinity;
      const terms = [];
      for (let i = 0; i < args.length; i++) {
        const arg = args[i];
        if (arg === '-n' || arg === '-nn') continue;
        if (arg === '-r') { file = args[++i]; continue; }
        if (arg === '-c') {
          const value = args[++i];
          if (!/^\d+$/.test(value ?? '') || Number(value) < 1) return error(usage);
          count = Number(value);
          continue;
        }
        if (arg.startsWith('-')) return error(usage);
        terms.push(arg);
      }
      if (!file) return error(usage);
      const rows = captureRows(file);
      if (!rows) return error('tcpdump: ' + file + ': bundled capture not found');
      const matches = captureFilter(terms.join(' '));
      if (!matches) return error('tcpdump: unsupported capture filter: ' + terms.join(' '));
      return { out: rows.filter(matches).slice(0, count).map(packetSummary).join('\n') };
    },
    yara(args) {
      const usage = 'Usage in this lab: yara [-c|-s] indicators.yar incident-artifact.txt|baseline-artifact.txt';
      if (args.includes('--help') || args.includes('-h')) return { out: usage };
      const flags = args.filter(arg => arg.startsWith('-'));
      const files = args.filter(arg => !arg.startsWith('-'));
      if (files.length !== 2 || flags.some(arg => !['-c', '-s', '--count', '--print-strings'].includes(arg))) return error(usage);
      const [ruleFile, target] = files;
      if (ruleFile.replace(/^\.\//, '') !== 'indicators.yar') return error('yara: bundled rules file not found: ' + ruleFile);
      const artifact = artifacts.get(target.replace(/^\.\//, ''));
      if (artifact === undefined) return error('yara: bundled artifact not found: ' + target);
      const matches = indicators.map(indicator => ({ ...indicator, offset: artifact.indexOf(indicator.text) })).filter(row => row.offset >= 0);
      if (flags.includes('-c') || flags.includes('--count')) return { out: String(matches.length) };
      const strings = flags.includes('-s') || flags.includes('--print-strings');
      return { out: matches.flatMap(({ rule, identifier, text, offset }) => strings ?
        [rule + ' ' + target, '0x' + offset.toString(16) + ':' + identifier + ': ' + text.replace(/\n/g, '\\x0a')] : [rule + ' ' + target]).join('\n') };
    },
    jq(args, stdin) {
      const usage = 'Usage in this lab: jq [-r] [-c] <filter> [eve.json|-]';
      if (args.includes('--help') || args.includes('-h')) return { out: usage };
      const operands = args.filter(arg => arg === '-' || !arg.startsWith('-'));
      const flags = args.filter(arg => arg !== '-' && arg.startsWith('-'));
      if (!operands.length || operands.length > 2 || flags.some(arg => !/^-[rc]+$/.test(arg))) return error(usage);
      const [program, file] = operands;
      if (file && file !== '-' && file.replace(/^\.\//, '') !== 'eve.json') return error('jq: bundled log not found: ' + file);
      try {
        const apply = jsonFilters(program);
        const bytes = String(stdin ?? '').trim();
        let input = file && file !== '-' ? events : [];
        if ((!file || file === '-') && bytes) {
          try { input = [JSON.parse(bytes)]; }
          catch { input = bytes.split(/\r?\n/).filter(line => line.trim()).map(line => JSON.parse(line)); }
        }
        const output = input.flatMap(value => apply.reduce((values, filter) => values.flatMap(filter), [value]));
        const options = flags.join('');
        return { out: output.map(value => options.includes('r') && typeof value === 'string' ? value : JSON.stringify(value, null, options.includes('c') ? 0 : 2)).join('\n') };
      } catch (problem) { return error('jq: ' + problem.message); }
    },
    lastb(args) {
      const usage = 'Usage in this lab: lastb [-n <limit>] [username ...]';
      if (args.includes('--help') || args.includes('-h')) return { out: usage };
      let limit = failedLogins.length;
      const users = [];
      for (let i = 0; i < args.length; i++) {
        const arg = args[i];
        if (arg === '-n' || arg === '--limit' || /^-\d+$/.test(arg)) {
          const count = arg.startsWith('-') && /^\d+$/.test(arg.slice(1)) ? arg.slice(1) : args[++i];
          if (!/^\d+$/.test(count ?? '')) return error(usage);
          limit = Number(count);
        } else if (arg.startsWith('-')) return error(usage);
        else users.push(arg);
      }
      const rows = failedLogins.filter(([user]) => !users.length || users.includes(user)).slice(0, limit);
      return { out: [...rows.map(([user, address, time]) => user.padEnd(9) + 'ssh:notty  ' + address.padEnd(17) + time + ' - ' + time.slice(-5) + '  (00:00)'),
        '', 'btmp begins Sat Feb 14 06:14:00 2026'].join('\n') };
    },
    'password-audit'(args) {
      const usage = 'Usage in this lab: password-audit [--format csv|json]';
      if (args.length === 1 && args[0] === '--help') return { out: usage };
      if (args.length === 2 && args[0] === '--format' && args[1] === 'csv') {
        return { out: ['finding,affected,total,remediation', ...auditFindings.map(row => row.join(','))].join('\n') };
      }
      if (args.length === 2 && args[0] === '--format' && args[1] === 'json') {
        return { out: JSON.stringify({ synthetic: true, findings: auditFindings.map(([finding, affected, total, remediation]) => ({ finding, affected, total, remediation })) }) };
      }
      if (args.length) return error(usage);
      return { out: [
        'Synthetic password audit · 20 training accounts',
        'Modeled offline recovery result: 6/20 accounts matched the exercise’s common-password set.',
        'Storage finding: legacy fast, unsalted digests.',
        'Account controls: no password blocklist, 8/20 accounts without MFA.',
        'Remediation: investigate exposure, reset affected credentials, adopt salted costed password hashing,',
        'block commonly used or compromised passwords, and enroll users in phishing-resistant MFA.'
      ].join('\n') };
    }
  };
  const asCommands = convert => Object.fromEntries(Object.entries(tools).map(([name, handler]) => [name, (args, stdin) => convert(handler(args, stdin))]));

  const lessons = [
    {
      title: 'Linux permissions',
      detail: 'In a symbolic mode, u selects the owner, + adds a permission, and r means read. Add owner read access to the hidden file, then verify that you can read it.',
      commands: ['ls -la', 'chmod u+r .filter.b64', 'cat .filter.b64'],
      source: ['GNU symbolic modes', 'https://www.gnu.org/software/coreutils/manual/html_node/Symbolic-Modes.html'],
      confirms: (name, args, result) => name === 'cat' && args[0] === '.filter.b64' && result.out === 'ZXZpZGVuY2U='
    },
    {
      title: 'Evidence integrity',
      detail: 'Calculate a SHA-256 digest of the evidence notes. Then use -c to compare the notes with the digest recorded in the collection manifest.',
      commands: ['sha256sum evidence.txt', 'sha256sum -c trusted.sha256'],
      source: ['GNU Coreutils manual', 'https://www.gnu.org/software/coreutils/manual/coreutils.html'],
      confirms: (name, args, result) => name === 'sha256sum' && result.out === 'evidence.txt: OK'
    },
    {
      title: 'Capture inventory',
      detail: 'Use Capinfos to count the frames in the bundled training capture before filtering it.',
      commands: ['capinfos -c incident.pcapng'],
      source: ['Capinfos manual', 'https://www.wireshark.org/docs/man-pages/capinfos.html'],
      confirms: name => name === 'capinfos'
    },
    {
      title: 'Packet analysis',
      detail: 'Use TShark to read the bundled capture. A display filter selects which decoded packets to show. Find the DNS answer and compare its address with the subsequent TCP connection.',
      commands: ['tshark -r incident.pcapng', 'tshark -r incident.pcapng -Y dns', 'tshark -r incident.pcapng -Y tcp'],
      source: ['TShark manual', 'https://www.wireshark.org/docs/man-pages/tshark.html'],
      confirms: (name, args) => name === 'tshark' && args[2] === '-Y' && args[3] === 'dns'
    },
    {
      title: 'Password audit findings',
      detail: 'Review a modeled password-recovery report and identify three independent controls. A blocklist helps reject common passwords, salted costed hashes increase the cost of offline guessing, and phishing-resistant MFA protects the sign-in flow.',
      commands: ['password-audit'],
      source: ['NIST authentication guidelines', 'https://pages.nist.gov/800-63-4/sp800-63b.html'],
      confirms: name => name === 'password-audit'
    },
    {
      title: 'Capture filters',
      detail: 'Read the saved incident capture and show TCP packets headed to destination port 443. Compare the matching packet’s source and destination with the TShark lesson.',
      commands: ['tcpdump -nn -r incident.pcapng tcp and dst port 443'],
      source: ['Kali tcpdump reference', 'https://www.kali.org/tools/tcpdump/'],
      confirms: (name, args, result) => name === 'tcpdump' && result.out.includes(service + '.443') && !result.out.includes('\n')
    },
    {
      title: 'Rule-based triage',
      detail: 'Run the bundled YARA indicator rules against two inert training artifacts. Use -s to see which strings matched and their offsets, and -c to count matching rules.',
      commands: ['yara -s indicators.yar incident-artifact.txt', 'yara -c indicators.yar baseline-artifact.txt'],
      source: ['YARA command-line reference', 'https://yara.readthedocs.io/en/stable/commandline.html'],
      confirms: (name, args, result) => name === 'yara' && result.out.includes('0x0:$channel:')
    },
    {
      title: 'Structured event logs',
      detail: 'Extract the alert signature from the bundled evidence log. The select filter keeps alert events, and -r prints the string without JSON quotes.',
      commands: ['jq -r \'select(.event_type == "alert") | .alert.signature\' eve.json'],
      source: ['jq manual', 'https://jqlang.org/manual/'],
      confirms: (name, args, result) => name === 'jq' && result.out === events[1].alert.signature
    }
  ];

  function session() {
    const files = Object.assign(Object.create(null), {
      '.filter.b64': { text: 'ZXZpZGVuY2U=', mode: '000' },
      'evidence.txt': { text: 'Analyst notes\nThe DNS reply and TCP destination match.\n' },
      'trusted.sha256': { text: '4d069329d6558a76c9eae711b569be461e11efc93fe6465de35380e4768c2ec2  evidence.txt\n' },
      [capture]: { text: null },
      [baseline]: { text: null }
    });
    const resolve = name => name.replace(/^\.\//, '').split('/');
    const walk = parts => parts.length === 1 ? files[parts[0]] : undefined;
    function read(name) {
      const file = walk(resolve(name));
      if (!file) return { err: name + ': No such file or directory' };
      if (!(Unix.mode(file) & 0o400)) return { err: name + ': Permission denied' };
      if (file.text === null) return { err: name + ': Use tshark or capinfos to inspect this simulated capture' };
      return { text: file.text };
    }
    const commands = Object.assign(Object.create(null), tools, {
      help: () => ({ out: 'ls [-la] · chmod <mode> <file> · cat <file> · sha256sum [-c] <file>\nsecurity-tools lists the available offline evidence commands.' }),
      ls: args => ({ out: Object.keys(files).sort().filter(name => !name.startsWith('.') || args.some(arg => /^-[al]*a[al]*$/.test(arg)))
        .map(name => (args.some(arg => /^-[al]*l[al]*$/.test(arg)) ? Unix.permissions(files[name]) + '  ' : '') + name).join('\n') }),
      chmod: args => Unix.chmod(args, resolve, walk, () => false),
      cat: args => {
        if (args.length !== 1) return { out: 'Usage in this lab: cat <file>', err: true };
        const result = read(args[0]);
        return result.err ? { out: 'cat: ' + result.err, err: true } : { out: result.text };
      },
      sha256sum: Unix.checksum('sha256', read)
    });
    function run(line) {
      const [name, ...args] = [...line.matchAll(/"([^"]*)"|'([^']*)'|(\S+)/g)].map(match => match[1] ?? match[2] ?? match[3]);
      const result = commands[name] ? commands[name](args) : { out: name + ': command not found (try help)', err: true };
      return { ...result, completed: result.err ? [] : lessons.map((lesson, index) => lesson.confirms(name, args, result) ? index : -1).filter(i => i >= 0) };
    }
    return { run };
  }

  return { tools, asCommands, lessons, session };
})();
if (typeof module !== 'undefined' && module.exports) module.exports = TerminalOpsTraining;

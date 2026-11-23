// Staged hints for the puzzle sandbox, practice jobs and the Labyrinth.
// Typing `hint` never prints the key: it starts with a riddle, then narrows where to look, then the kind of move,
// and only the last stages name an exact command. Learn More is a separate workshop and never uses this ladder.
// Everything is text generated from the room's own files; nothing here runs a command.
(function () {
  if (window.TerminalHints) return;

  const trim = value => String(value == null ? '' : value).replace(/[ \t]+/g, ' ').replace(/\s*\n\s*/g, ' ').trim();
  const important = answer => {
    const value = String(answer == null ? '' : answer).trim();
    /* a one- or two-character key would turn every command into a redaction, so only hide real tokens */
    return value.length >= 4 && !/^(?:true|false|\d+)$/i.test(value) ? value : '';
  };
  function redact(text, answer) {
    const secret = important(answer);
    let out = trim(text);
    if (!secret) return out;
    const escaped = secret.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    out = out.replace(new RegExp(escaped, 'gi'), '‹the key›');
    /* any Base64-looking or long hex token inside a command is the key in disguise, so hints never print it */
    out = out.replace(/(?<![\w+/])(?=[A-Za-z0-9+/]*[A-Z])(?=[A-Za-z0-9+/]*[a-z])(?=[A-Za-z0-9+/]*[0-9=])[A-Za-z0-9+/]{12,}={0,2}(?![\w+/])/g, '‹encoded value›')
      .replace(/\b[0-9a-f]{24,}\b/gi, '‹encoded value›');
    return out;
  }

  const FILE_EXT = /[A-Za-z0-9_.-]+(?:[\\/][A-Za-z0-9_. -]+)*\.(?:txt|log|key|csv|json|md|conf|cfg|ini|xml|yml|yaml|b64|hex|rot|bin|dat|env|bak|zip|pcap|pcapng|sql|db|pem|html|sh|ps1|bat|py)$/gi;
  function hintFiles(target) {
    const seen = new Set();
    const add = list => {
      for (const name of list) {
        const clean = String(name).replace(/^[.\/\\]+/, '').replace(/\\/g, '/');
        if (!clean || clean.length > 90) continue;
        if (/^users\/|^home\/|^windows\/|^program files/i.test(clean)) continue;
        seen.add(clean);
      }
    };
    const walk = Array.isArray(target.walkthrough) ? target.walkthrough.join('\n') : '';
    const haystack = [walk, target.hint, ...(Array.isArray(target.hints) ? target.hints : [])].filter(Boolean).join('\n');
    add(haystack.match(FILE_EXT) || []);
    const files = target.files && typeof target.files === 'object' ? Object.keys(target.files) : [];
    if (seen.size < 3) {
      const hinted = files.filter(path => [...seen].some(name => path.endsWith(name)) || /readme|note|brief|start|hint/i.test(path));
      add(hinted.slice(0, 4));
    }
    if (!seen.size && files.length && files.length <= 12) add(files.slice(0, 3));
    return [...seen].slice(0, 4);
  }

  /* What kind of move a command makes, in plain words. Hints use this before they ever show syntax. */
  function move(cmd) {
    const c = String(cmd || '').toLowerCase().trim();
    if (!c) return '';
    if (/^(sudo\s+)?(base64|xxd|rot13|openssl|uudecode|url|hex|decode)\b/.test(c) || /\bbase64\s+-d|rot13|xxd\s+-r/.test(c)) return 'decode';
    if (/^(git)\b/.test(c)) return 'git';
    if (/^(docker)\b/.test(c)) return 'docker';
    if (/^(ssh|telnet|scp)\b/.test(c)) return 'remote';
    if (/^(grep|findstr|select-string|rg|awk|sed|where-object)\b/.test(c) || /\bgrep\b/.test(c)) return 'search';
    if (/^(cat|type|head|tail|less|more|get-content|gc|view)\b/.test(c)) return 'read';
    if (/^(ls|dir|find|tree|get-childitem|gci|where)\b/.test(c)) return 'list';
    if (/^(select|show|pragma|describe|sqlite3)\b/.test(c)) return 'query';
    if (/^(nmap|ping|dig|nslookup|tcpdump|netstat|ipconfig|curl)\b/.test(c)) return 'network';
    return 'other';
  }

  const MOVE_TEXT = {
    list: 'First, look at the whole room instead of the files with friendly names. Hidden names count; sizes and permissions are part of the story.',
    read: 'The paperwork you found is worth reading from the top. Stop when a line repeats something the objective already told you.',
    search: 'Do not open every file. Ask the room a word from the objective and let it point at the line that matters.',
    decode: 'What you found is wrapped, not locked. Peel one layer at a time and look at the shape of what comes out.',
    git: 'The answer is probably in the history nobody meant to keep. Look at the commits, not just the files in front of you.',
    docker: 'A container keeps its own notes: what it runs, what it was built from, and what it said while starting. Read those before guessing.',
    remote: 'Someone left a handover note for this machine. Read it before you change anything on the remote side.',
    query: 'Ask the tables a question rather than reading every row. Start with the table whose name sounds like records.',
    network: 'Follow the address, then the port, then the service. The odd line is the one that does not look like the others.',
    other: 'Compare what you have found with the objective. The detail that does not fit anywhere else is the trail.'
  };

  const RIDDLES = [
    'Nothing here was deleted. It was only made easy to walk past. Start by noticing what is unusual, not by guessing the key.',
    'The room is a locked drawer with the key still inside. You do not need to force it; you need to read what the owner left behind.',
    'Someone tidied this place in a hurry. The useful thing is not hidden in a vault — it is sitting in the one place nobody bothers to check.',
    'A good detective reads the room before touching anything. Names, dates and repeats matter more than secrets.',
    'The answer is written somewhere in this room, in something that looks ordinary. Find the trail before you try the key.',
    'This is not a guessing game. It is a reading game. One line in one file will make the rest obvious.',
    'The owner left a story behind. Follow the story from the outside in, and only decode what refuses to be read.',
    'Look for the thing that does not belong. It is rarely the biggest file — it is the one whose name or timing is slightly wrong.'
  ];

  function stages(target) {
    if (!target || typeof target !== 'object') return [];
    const out = [];
    const answer = target.answer;
    const push = (title, text, command) => {
      const body = redact(text, answer);
      if (!body || out.some(stage => stage.text === body)) return;
      /* A command is only ever attached to the last stages, so early hints cannot give the move away. */
      out.push({ title, text: body, command: command ? redact(command, answer) : '' });
    };
    const walk = (Array.isArray(target.walkthrough) ? target.walkthrough : [])
      .map(step => trim(step)).filter(step => step && !/^solve\b/i.test(step));
    const seed = [...String(target.title || target.id || 'room')].reduce((n, ch) => (n * 31 + ch.charCodeAt(0)) >>> 0, 7);
    push('A riddle to start', RIDDLES[seed % RIDDLES.length], '');
    const files = hintFiles(target);
    if (files.length) {
      push('Where the trail starts', 'One or two names are worth opening first: ' + files.slice(0, 2).join(' and ') + '. Read their names slowly; one of them is trying to look boring.', '');
    } else {
      push('Where the trail starts', 'List the room first, including the names that begin with a dot. Read the names before you read the contents.', '');
    }
    if (walk.length) {
      push('What kind of move', MOVE_TEXT[move(walk[0])] || MOVE_TEXT.other, '');
      if (walk.length > 1) push('After that', MOVE_TEXT[move(walk[1])] || 'Once that works, the next step follows from what it printed. Use the output, not a new guess.', '');
      push('The exact first move', 'When the reading stops helping, this is the first line that makes progress:', walk[0]);
      if (walk.length > 1) push('Then, exactly', 'And this is the line that follows it:', walk[1]);
      if (walk.length > 2) push('The rest is yours', 'You now have the shape of the whole chain. Build the remaining steps from what the earlier commands printed; `walkthrough` will spell them out if you truly want the full reveal.', '');
    } else {
      push('What kind of move', 'Use the objective as a checklist. Read one file, compare it with the objective, then decide the next move from what you read.', '');
    }
    /* the key itself is never a stage; `walkthrough` remains the deliberate full reveal */
    return out.slice(0, 7);
  }

  /* the little notes planted inside a machine: two quiet nudges, never the key */
  function noteTexts(target) {
    const list = stages(target);
    const where = list.find(stage => /^Where the trail/.test(stage.title));
    const kind = list.find(stage => /^What kind of move/.test(stage.title));
    return {
      start: 'A note taped to the monitor.\n\n' +
        (where ? where.text : 'You will not find it by guessing. List everything here, including the hidden names, and read what was left behind.') +
        '\n\nIf you get stuck, type: hint — one step at a time, never the answer.',
      trail: 'Half a thought, written down so it would not be forgotten.\n\n' +
        (kind ? kind.text : 'The thing you need is in the paperwork, not in the folders with the obvious names.') +
        '\n\nThe next `hint` narrows the kind of move. The last ones show the exact lines.'
    };
  }

  window.TerminalHints = { stages, redact, noteTexts };
})();

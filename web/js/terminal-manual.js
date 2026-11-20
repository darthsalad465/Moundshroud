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
  const nav = [['cd /', 'Start here'], ['back', 'Back'], ['browse', 'All commands']];

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
    for (const [key, content] of Object.entries(authored)) {
      const prior = entries.get(key);
      entries.set(key, { key, chapter: 'Command reference', aliases: [], ...prior, ...content });
    }
    for (const [key, content] of Object.entries(beginner)) {
      if (entries.has(key)) continue;
      entries.set(key, { key, name: key, chapter: 'Getting started', syntax: content.example || key,
        description: content.meaning, aliases: [], options: [], examples: [], source: '' });
    }
    entries.set('help', {
      key: 'help', name: 'help', chapter: 'Help Terminal', syntax: 'help [COMMAND [OPTION]]',
      description: ['Open the playground’s Help Terminal. Each shell has its own manual because the same command name or option can mean something different in another shell.'],
      aliases: [], options: [['COMMAND', 'Open a specific command page.'], ['OPTION', 'Highlight its explanation on that page.']],
      examples: []
    });
    function examplesFrom(rows, chapter, kind) {
      for (const row of rows) {
        const [command, description] = Array.isArray(row) ? row : [row.ex, row.d];
        if (!command || !description || /^\s*mcode(?:\s|$)/i.test(command) || restrictedExample.test(command)) continue;
        const line = normal(command);
        const known = [...entries.values()].filter(page => line === page.key || line.startsWith(page.key + ' ') || line.startsWith(page.key + '('))
          .sort((a, b) => b.key.length - a.key.length)[0];
        const name = known?.name || titleOf(shell.id, command);
        if (!name) continue;
        const key = normal(name);
        if (restrictedExample.test(key) || nativeOnly.test(key)) continue;
        if (!entries.has(key)) entries.set(key, { key, name, chapter, syntax: command, description, aliases: [], options: [], examples: [], source: data.references[shell.id] || '' });
        const entry = entries.get(key);
        if (entry.examples.length < 4 && !entry.examples.some(sample => sample[0] === command)) entry.examples = [...entry.examples, [command, description, kind]];
      }
    }
    if (mode !== 'sandbox') examplesFrom(scenarioExamples, 'Current exercise', 'Current exercise');
    examplesFrom(shell.commands || [], 'Sandbox examples', 'Sandbox');
    const pages = [...entries.values()].map(entry => {
      const isRestricted = restrictedExample.test(entry.key);
      const safe = !isRestricted && !nativeOnly.test(entry.key);
      const options = safe ? entry.options : [];
      const description = isRestricted ? ['This name appears in the network reference. It represents a simulated security tool. Use the offline evidence tools to practice inspecting traffic and logs.'] :
        Array.isArray(entry.description) ? entry.description : [entry.description];
      return { ...entry, syntax: safe ? entry.syntax : entry.name, description, options, overviewOnly: !safe, beginner: safe ? beginner[entry.key] : undefined,
        source: isRestricted ? '' : entry.source, examples: safe ? entry.examples : [], detail: !!authored[entry.key] };
    }).sort((a, b) => a.name.localeCompare(b.name));
    const chapters = [...new Set(pages.map(page => page.chapter))].map(title => ({ title, path: slug(title) }));
    return { shell, mode, pages, chapters, starters: Object.keys(beginner).map(key => pages.find(page => page.key === key)).filter(Boolean) };
  }

  function search(index, input, chapter = '') {
    const term = normal(input);
    const direct = term && pageFor(index, input);
    if (direct?.page && direct.flags.some(flag => direct.page.options.some(([label]) => optionMatches(index.shell.id, label, flag)))) {
      return [direct.page];
    }
    const words = term.replace(/[?]+$/, '').split(/\s+/).filter(word => word && !/^(?:a|an|the|can|do|how|i|you|me|my|to)$/.test(word));
    const matches = index.pages.filter(page => {
      if (chapter && slug(page.chapter) !== chapter) return false;
      const haystack = normal([page.name, page.beginner?.title, page.beginner?.meaning, page.syntax, page.chapter, ...page.aliases, ...page.description, ...page.options.flat()].join(' '));
      return words.every(word => haystack.includes(word));
    });
    const score = page => page.key === term || page.aliases.some(name => normal(name) === term) ? 3 :
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
  function create(root, { focusTerminal, useExample }) {
    const heading = 'tpg-manual-heading-' + ++serial;
    let dialog, index, chapter = '', page = null, filter = '', flags = [], message = '', lastCommand = '', browsing = false;
    const trail = [];
    const get = name => dialog?.querySelector('[data-manual="' + name + '"]');
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
      '<dt>Find help</dt><dd>Search for a command by name or by what you want to do. Try “read a file”.</dd>' +
      '<dt>All commands</dt><dd>See every page for this terminal. Pick a group to make the list shorter.</dd>' +
      '<dt>Back</dt><dd>Go to the page you were just reading.</dd>' +
      '<dt>More details and options</dt><dd>Open this part of a page to see more ways to use the command.</dd>' +
      '<dt>Copy to my terminal</dt><dd>Put an example on your prompt. Read it and press Enter when you are ready.</dd>' +
      '<dt>Use help by typing</dt><dd>Try <code>ls</code> to list groups, <code>man grep -n</code> to open a page, or <code>back</code> to return.</dd>' +
      '<dt>Back to terminal</dt><dd>Close help. You can also press Esc.</dd></dl></div></details>';

    function paintIndex() {
      const list = get('pages');
      if (!list || !index) return;
      const show = !!(filter.trim() || browsing);
      get('columns')?.setAttribute?.('data-show-index', String(show));
      const aside = get('index');
      if (aside) aside.hidden = !show;
      if (!show) { list.innerHTML = ''; return; }
      const results = search(index, filter, filter ? '' : chapter);
      list.innerHTML = '<p class="tpg-manual-count">' + results.length + ' ' + (results.length === 1 ? 'match' : 'matches') + '</p>' +
        results.map(entry => '<button type="button" data-manual-page="' + esc(entry.key) + '" aria-current="' + (page?.key === entry.key ? 'page' : 'false') + '"><span>' + esc(entry.beginner?.title || entry.name) + '</span><small>' +
          esc(entry.beginner ? entry.name : entry.chapter) + '</small></button>').join('') +
        (!results.length ? '<p>Try a shorter word, like <code>file</code> or <code>read</code>.</p>' : '');
      list.scrollTop = 0;
    }

    function flagged(label) {
      return flags.some(flag => optionMatches(index.shell.id, label, flag));
    }

    function exampleBlock(command, text, canCopy = true, parts = []) {
      return '<div class="tpg-manual-example"><pre>' + esc(command) + '</pre><p>' + esc(text) + '</p>' +
        (parts.length ? '<details><summary>What each part does</summary><div><dl class="tpg-manual-steps">' +
          parts.map(([part, meaning]) => '<dt><code>' + esc(part) + '</code></dt><dd>' + esc(meaning) + '</dd>').join('') + '</dl></div></details>' : '') +
        (canCopy ? '<button type="button" data-manual-insert="' + esc(command) + '">Copy to my terminal</button>' : '') + '</div>';
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
      return '<h3>What do you want to do?</h3><p>Pick a card. It shows what to type and what happens next.</p>' +
        '<div class="tpg-manual-starters">' + starterCards + '</div>' + wordsToKnow + windowGuide;
    }

    function paintCommand() {
      const start = page.beginner;
      const title = start?.title || page.name;
      const meaning = start?.meaning || page.description[0] || 'See the command below.';
      const selected = page.options.filter(([label]) => flagged(label));
      const option = ([label, text, detail], highlight) => {
        const operator = label.split(/,\s*/)[0];
        const form = page.examples.find(([line]) => TP.argvMeta(line, ['cmd', 'powershell'].includes(index.shell.id))
          .some(({ val, quoted }) => !quoted && optionMatches(index.shell.id, label, val)))?.[0];
        const layout = /^(?:pipes & chaining|braces & globs|redirection)$/.test(page.key) ? page.syntax : page.name + ' ' + operator + ' …';
        return '<div class="tpg-manual-option"' + (highlight ? ' data-manual-highlight' : '') + '><code>' + esc(label) + '</code><p>' +
        esc((highlight && start?.options[label]) || text) + '</p>' +
        '<p class="tpg-manual-note">' + (form ? 'Example ' : 'Where it goes ') + '<code>' +
        esc(form || layout) + '</code>' + (form ? '' : ' · Fill in any parts shown by …') + '</p>' +
        (detail && !highlight ? '<p class="tpg-manual-note">' + esc(detail) + '</p>' : '') + '</div>';
      };
      const examples = page.examples.map(([command, result, kind]) => exampleBlock(command, result,
        !/<[\w .|/-]+>/.test(command) && (kind !== 'Sandbox' || index.mode === 'sandbox'),
        explainArguments(index.shell.id, page, command))).join('');
      const startAvailable = start?.example && (!start.sandboxOnly || index.mode === 'sandbox');
      const sample = startAvailable ? [start.example, start.result] :
        page.examples.find(([command, , kind]) => !/<[\w .|/-]+>/.test(command) &&
          (kind === 'Current exercise' || index.mode === 'sandbox'));
      const placeholders = [...new Set(page.syntax.match(/\b[A-Z][A-Z_]+\b/g) || [])].filter(word => argumentMeaning[word]);
      const inputs = placeholders.length ? '<h4>What to put in</h4><dl>' + placeholders.map(word => {
        const value = word === 'FORMAT' && page.key === 'stat' ? '%a' : argumentSample[word];
        return '<dt><code>' + esc(word) + '</code></dt><dd>' + esc(argumentMeaning[word]) +
          (value ? ' Example value <code>' + esc(value) + '</code>.' : '') + '</dd>';
      }).join('') + '</dl>' : '';
      const scope = index.mode === 'sandbox' ? 'The examples use the files in this playground. The real command may have more options.' :
        'Your puzzle may have different file names and support fewer options. Look at the names in your own terminal first.';
      return '<h3>' + esc(title) + '</h3>' + (start ? '<p><code class="tpg-manual-command-name">' + esc(page.name) + '</code></p>' : '') +
        '<p class="tpg-manual-meaning">' + esc(meaning) + '</p>' +
        (selected.length ? '<h4>What those options do</h4>' + selected.map(entry => option(entry, true)).join('') : '') +
        (sample ? '<h4>Try it</h4>' + exampleBlock(sample[0], sample[1], true,
          startAvailable && start.steps.length ? start.steps : explainArguments(index.shell.id, page, sample[0])) :
          page.overviewOnly ? '' : '<h4>How it looks</h4><pre>' + esc(page.syntax) + '</pre>' + inputs) +
        '<details><summary>More details and options</summary><div><h4>How to write it</h4><pre class="tpg-manual-syntax">' +
        esc(page.syntax) + '</pre><p class="tpg-manual-note">Square brackets mean you can leave that part out. Words like FILE show where to put your own file name.</p>' +
        (sample ? inputs : '') + page.description.filter(text => text !== meaning).map(text => '<p>' + esc(text) + '</p>').join('') +
        (page.options.length ? '<h4>All options and inputs</h4>' + page.options.map(entry => option(entry, false)).join('') : '') +
        (examples ? '<h4>More examples</h4>' + examples : '') + '<h4>Playground notes</h4><p>' + esc(scope) + '</p>' +
        (page.note ? '<p>' + esc(page.note) + '</p>' : '') +
        (page.aliases.length ? '<p>Other names for this command include <code>' + esc(page.aliases.join(', ')) + '</code>.</p>' : '') +
        (page.source ? '<a href="' + esc(page.source) + '" target="_blank" rel="noopener noreferrer">Read the official reference</a>' : '') +
        '</div></details>';
    }

    function paintPage() {
      const view = get('page');
      if (!view) return;
      view.innerHTML = page ? paintCommand() : paintStart();
      view.scrollTop = 0;
      get('path').textContent = index.shell.name + ' · ' + ({ sandbox: 'Sandbox', puzzle: 'Puzzle Studio', lab: 'Labyrinth' }[index.mode] || index.mode);
      get('status').textContent = (lastCommand ? '$ ' + lastCommand + '\n' : '') + message;
      get('notice').textContent = message && (!lastCommand || page) ? message : '';
      const input = get('search');
      if (input && input.value !== filter) input.value = filter;
      paintIndex();
    }

    function saveView() { trail.push({ chapter, page, filter, flags, message, browsing }); if (trail.length > 40) trail.shift(); }

    function openPage(topic) {
      const found = pageFor(index, topic);
      saveView();
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
          saveView(); chapter = ''; page = null; flags = []; filter = ''; message = ''; browsing = true; paintPage(); return;
        case 'ls':
          if (arg && !/^\/(?:manual\/?)?$/.test(arg)) { go(arg); return; }
          if (arg) { saveView(); chapter = ''; page = null; flags = []; filter = ''; browsing = true; }
          if (!browsing) { saveView(); browsing = true; }
          message = chapter ? 'Pick a page from the list, or type man PAGE.' : index.chapters.map(item => item.path + '/').join('  ');
          paintPage(); return;
        case 'pwd': message = '/manual' + (chapter ? '/' + chapter : ''); paintPage(); return;
        case 'back': {
          const previous = trail.pop();
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

    function open(shell, mode, scenarioExamples, query) {
      const host = root.querySelector('[data-terminal-manual]');
      if (!host) return false;
      if (!dialog || !host.contains(dialog)) {
        host.innerHTML = '<dialog class="tpg-manual" aria-labelledby="' + heading + '">' +
          '<header><div><h2 id="' + heading + '">Terminal help</h2><span data-manual="path"></span></div><button type="button" data-manual-close>Back to terminal</button></header>' +
          '<nav aria-label="Manual navigation">' + nav.map(([cmd, label]) => '<button type="button" data-manual-nav="' + esc(cmd) + '">' + esc(label) + '</button>').join('') +
          '<label class="tpg-manual-search">Find help<input type="search" data-manual="search" placeholder="Try “find a word” or “grep -n”" autocomplete="off"></label></nav>' +
          '<div class="tpg-manual-notice" data-manual="notice" role="status"></div>' +
          '<div class="tpg-manual-columns" data-manual="columns"><aside data-manual="index" aria-label="Command list" hidden><div data-manual="pages" class="tpg-manual-list"></div></aside>' +
          '<article data-manual="page" aria-label="Manual page" tabindex="0"></article></div>' +
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
          openPage(useFilter ? filter : key);
        };
        dialog.addEventListener('cancel', event => { event.preventDefault(); close(); });
        dialog.addEventListener('click', event => {
          const button = event.target.closest('button');
          if (!button) return;
          if (button.hasAttribute('data-manual-close')) return close();
          if (button.dataset.manualNav) {
            navigate(button.dataset.manualNav, false);
            get('page').focus({ preventScroll: true });
            return;
          }
          if (button.dataset.manualChapter || button.dataset.manualPage) {
            if (button.dataset.manualChapter) go(button.dataset.manualChapter);
            else pickPage(button.dataset.manualPage);
            get('page').focus({ preventScroll: true });
            return;
          }
          if (button.dataset.manualInsert) { close(); useExample(button.dataset.manualInsert); }
        });
        get('form').addEventListener('submit', event => { event.preventDefault(); const input = get('input'); navigate(input.value); input.value = ''; });
        get('search').addEventListener('input', event => { filter = event.target.value; paintIndex(); });
        get('search').addEventListener('keydown', event => {
          if (event.key !== 'Enter') return;
          const results = search(index, filter);
          if (results.length) { event.preventDefault(); pickPage(results[0].key); get('page').focus({ preventScroll: true }); }
        });
      }
      index = buildIndex(shell, mode, scenarioExamples);
      trail.length = 0; chapter = ''; page = null; filter = ''; flags = []; lastCommand = ''; browsing = false; message = '';
      if (!dialog.open) {
        if (typeof dialog.showModal === 'function') dialog.showModal();
        else dialog.setAttribute('open', '');
      }
      if (query) openPage(query); else paintPage();
      (query ? get('page') : get('search'))?.focus({ preventScroll: true });
      return true;
    }

    return { open, close };
  }

  TP.manual = { create, buildIndex, search, pageFor, guideRequest };
})();

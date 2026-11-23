// The Cyber Codex: the Guide's holographic book (guide-book.js), filled with two things a learner keeps needing —
// every command, switch and pipe of every shell in the Terminal playground, and every language in the Code playground.
// The pages are built from the app's own data (TerminalPlayground.HELP_DB and PlayLangs.LANGS), so a command or a
// language that exists in the playground always has a page here. Open it with A.cyberBook.open(), with
// A.cyberBook.go('pipes'), or from the Cyber tab (📚 Manual book).
// Nothing here touches the app until the book is opened.
(() => {
  if (typeof A === 'undefined' || typeof ls === 'undefined') return;

  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const clamp = (n, lo, hi) => Math.max(lo, Math.min(hi, n));
  const reduced = () => { try { return matchMedia('(prefers-reduced-motion: reduce)').matches; } catch (e) { return false; } };
  const roman = n => ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X', 'XI', 'XII', 'XIII', 'XIV', 'XV', 'XVI', 'XVII', 'XVIII', 'XIX', 'XX'][n - 1] || String(n);
  const slug = s => String(s || '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  const wordsOf = t => (String(t || '').match(/\b[\w'-]+\b/g) || []).length;

  function plain(html) {
    return String(html || '')
      .replace(/<\/(p|li|tr|h[1-6]|div|summary)>/gi, '. ')
      .replace(/<[^>]+>/g, ' ')
      .replace(/&nbsp;/gi, ' ').replace(/&amp;/gi, '&').replace(/&lt;/gi, '<').replace(/&gt;/gi, '>')
      .replace(/&quot;/gi, '"').replace(/&#39;/gi, "'").replace(/&[a-z]+;/gi, ' ')
      .replace(/\s+/g, ' ').replace(/(\.\s*){2,}/g, '. ').trim();
  }
  function summarize(text) {
    text = String(text || '').replace(/\s+/g, ' ').trim();
    if (text.length <= 210) return text;
    const cut = text.slice(0, 210), at = cut.lastIndexOf(' ');
    return cut.slice(0, at > 120 ? at : 210).replace(/[,;:.\s]+$/, '') + '…';
  }
  function threadsOf(html, summary) {
    const out = [], re = /<li[^>]*>([\s\S]*?)<\/li>/gi;
    let m;
    while ((m = re.exec(html)) && out.length < 3) {
      const t = plain(m[1]);
      if (t.length > 24 && t.slice(0, 40) !== summary.slice(0, 40)) out.push(t.length > 135 ? t.slice(0, 134).replace(/[,;:.\s]+$/, '') + '…' : t);
    }
    if (!out.length) {
      const sents = plain(html).split(/(?<=[.!?])\s+/).filter(s => s.length > 50 && s.slice(0, 40) !== summary.slice(0, 40));
      sents.slice(0, 2).forEach(s => out.push(s.length > 135 ? s.slice(0, 134) + '…' : s));
    }
    return out;
  }
  const chapter = (id, icon, title, html) => {
    /* the summary comes from the first sentence after the heading, never from the heading itself */
    const body = String(html || '').replace(/^\s*<h3>[\s\S]*?<\/h3>/i, '');
    const text = plain(body) || plain(html);
    const summary = summarize(text.split(/(?<=[.!?])\s/)[0] || text);
    return { id, icon, title, html, summary, threads: threadsOf(body, summary) };
  };

  /* ------------------------------------------------------------------ the command line, explained by hand */
  const BASICS = [
    chapter('cli-start', '⌨️', 'What a terminal is', [
      '<p>A terminal is a place where you type what you want the computer to do, press Enter, and read the answer. Nothing is hidden: every action is one line of text you wrote yourself.</p>',
      '<p>The line that waits for you is the <b>prompt</b>. In this app it looks like <code>moundshroud@sandbox:~$</code>. Read it in four parts:</p>',
      '<ul>',
      '<li><code>moundshroud</code> is the user you are.</li>',
      '<li><code>sandbox</code> is the machine you are on. In the playground it is a simulated computer with its own files, so nothing you type reaches your PC.</li>',
      '<li><code>~</code> is where you are, the <b>working directory</b>. A tilde means your home folder; <code>/</code> is the top of the disk.</li>',
      '<li><code>$</code> means the shell is ready for a command. A <code>#</code> there would mean you are an administrator, and that is worth slowing down for.</li>',
      '</ul>',
      '<h4>Paths in one paragraph</h4>',
      '<p>A path is the address of a file. An <b>absolute</b> path starts at the top of the disk: <code>/home/moundshroud/notes.txt</code>. A <b>relative</b> path starts from where you are: <code>notes.txt</code>, <code>../images</code>, <code>./run.sh</code>. Three shortcuts do most of the work: <code>.</code> is here, <code>..</code> is the folder above, and <code>~</code> is home.</p>',
      '<p>Two commands tell you where you are and what is around you: <code>pwd</code> prints the working directory, and <code>ls</code> lists what is in it. Everything else in this book assumes you can find your way around with those two.</p>'
    ].join('')),

    chapter('cli-command', '▶️', 'Running a command', [
      '<p>A command line has up to three parts: the <b>command</b>, then <b>switches</b> (also called flags or options), then <b>arguments</b>. <code>ls -l notes.txt</code> is command <code>ls</code>, switch <code>-l</code>, argument <code>notes.txt</code>.</p>',
      '<ul>',
      '<li>The command is the program. If the shell does not know the word it answers <code>command not found</code>.</li>',
      '<li>Switches change how it behaves. They almost always start with a dash.</li>',
      '<li>Arguments are the things to work on: file names, folders, text, a host name.</li>',
      '</ul>',
      '<p>Words are separated by spaces, and the shell splits the line on them before anything runs. That is why a file called <code>my notes.txt</code> must be quoted: <code>cat "my notes.txt"</code>. Without the quotes it becomes two arguments.</p>',
      '<h4>What comes back</h4>',
      '<p>Output is what the command prints. Silence is normal for commands that only change something: <code>mkdir work</code> prints nothing and has still done its job. Errors are printed too, and they name the file or option that failed.</p>',
      '<p>Every command also returns a quiet <b>exit status</b>: 0 for success, anything else for a kind of failure. You rarely see it, but scripts use it constantly, and the shell keeps the last one in <code>$?</code> in Bash, <code>$LASTEXITCODE</code> in PowerShell.</p>',
      '<h4>Stopping a run</h4>',
      '<p><b>Ctrl+C</b> stops the command that is running. <b>Ctrl+D</b> ends the input, which closes a Python or Node session. In this app the playground has its own Stop button as well.</p>'
    ].join('')),

    chapter('cli-switches', '🔧', 'Switches, flags and options', [
      '<p>A switch is one extra instruction added to a command. It is written with a dash, and it always belongs to that command — <code>-n</code> means “number the lines” to <code>grep</code>, “do not add a newline” to <code>echo</code>, and nothing at all to <code>ls</code>.</p>',
      '<h4>Short and long forms</h4>',
      '<p>Most switches have a short form with one dash and one letter, and a long form with two dashes and a word. They do the same thing: <code>-i</code> is <code>--ignore-case</code>, <code>-r</code> is <code>--recursive</code>, <code>-n</code> is <code>--line-number</code>. Copy the long form into your notes and the short form into your fingers.</p>',
      '<h4>Several short switches share one dash</h4>',
      '<p>Letters after a single dash are read one at a time. <code>-i -n</code> and <code>-in</code> are the same thing, and order does not matter: <code>-iw</code>, <code>-wi</code> and <code>-i -w</code> all mean “ignore capitals, whole words only”.</p>',
      '<ul>',
      '<li><b>Long forms do not stack letters.</b> Write <code>--recursive --ignore-case</code>, not <code>--ri</code>.</li>',
      '<li><b>A switch that takes a value keeps it.</b> <code>-o FILE</code> means the next word belongs to <code>-o</code>, so <code>-on</code> is not “-o plus -n”. Both forms exist: <code>-o out.txt</code> and <code>--output=out.txt</code>.</li>',
      '<li><b>Case matters.</b> <code>-r</code> and <code>-R</code> are different switches in the tools that have both.</li>',
      '<li><b><code>--</code> ends the switches.</b> Everything after it is a name, even if it starts with a dash: <code>rm -- -weird-name</code>.</li>',
      '<li><b>Switches go before the names.</b> <code>grep -in "error" log.txt</code> works; <code>grep "error" -in log.txt</code> looks for a file called <code>-in</code>.</li>',
      '</ul>',
      '<h4>Windows shells spell them differently</h4>',
      '<p><code>cmd</code> uses a slash: <code>dir /a /b</code>. PowerShell uses real names with a dash and no single letters: <code>-Recurse</code>, <code>-Force</code>, <code>-Filter</code>, and they can be shortened only as far as they stay unique. Docker and Git mix both styles: <code>git commit -am "msg"</code>, <code>docker run --rm -it image</code>.</p>',
      '<p>Every shell’s chapter in this book lists its switches with what they do, and the terminal’s own manual has a page for each switch on its own.</p>'
    ].join('')),

    chapter('pipes', '↔️', 'Pipes: sending one answer into the next command', [
      '<p>A pipe is the vertical bar <code>|</code>. It takes what the command on the left printed and hands it to the command on the right as its input. That is the whole idea, and it is the reason the command line is fast for real work.</p>',
      '<pre>ls -l | wc -l</pre>',
      '<p><code>ls -l</code> prints a line per file; <code>wc -l</code> counts lines. Together they answer “how many files are here?” without you reading a single name.</p>',
      '<h4>Why it matters</h4>',
      '<p>Each command does one small job well, and pipes let you join them into a sentence. Nothing is written to disk on the way, so a pipeline is also tidy.</p>',
      '<ul>',
      '<li><code>cat access.log | grep 404 | wc -l</code> counts the 404s.</li>',
      '<li><code>sort names.txt | uniq -c | sort -rn | head</code> shows the most common names.</li>',
      '<li><code>ps aux | grep python</code> finds the Python processes.</li>',
      '<li><code>history | tail -20</code> shows what you just did.</li>',
      '</ul>',
      '<h4>What actually travels down the pipe</h4>',
      '<p>In Bash, cmd, Python and Node a pipe carries <b>text</b>, line by line. In PowerShell it carries <b>objects</b>: the rows keep their named properties, so you filter and select fields instead of cutting characters. PowerShell reads a text command such as <code>cmd /c dir | Select-String "log"</code> as text, which is why the two styles are not interchangeable.</p>',
      '<h4>Pipes and errors</h4>',
      '<p>Only normal output goes down the pipe. Errors still go to the screen, which is usually what you want: a failure in the middle of a pipeline is not silently swallowed. <code>2>&1</code> sends errors into the pipe as well when you really want them counted or searched.</p>',
      '<p><code>tee</code> splits a stream so it goes to a file and down the pipe at once: <code>make 2>&1 | tee build.log</code> shows the build and keeps it.</p>'
    ].join('')),

    chapter('redirection', '➡️', 'Redirection: putting output into a file', [
      '<p>A pipe sends output to another command. <b>Redirection</b> sends it to a file, or takes input from one.</p>',
      '<table><thead><tr><th>Write</th><th>What happens</th></tr></thead><tbody>',
      '<tr><td><code>cmd &gt; file</code></td><td>Write the output into the file, replacing what was there.</td></tr>',
      '<tr><td><code>cmd &gt;&gt; file</code></td><td>Add to the end of the file instead of replacing it.</td></tr>',
      '<tr><td><code>cmd &lt; file</code></td><td>Read the file as the command’s input.</td></tr>',
      '<tr><td><code>cmd 2&gt; errors.txt</code></td><td>Send only the errors to a file. <code>1&gt;</code> is normal output.</td></tr>',
      '<tr><td><code>cmd &gt; all.txt 2&gt;&amp;1</code></td><td>Both streams into one file. In PowerShell: <code>cmd *&gt; all.txt</code>.</td></tr>',
      '<tr><td><code>cmd &gt; /dev/null</code></td><td>Throw the output away. On Windows: <code>&gt; NUL</code>.</td></tr>',
      '</tbody></table>',
      '<h4>The trap everyone falls into</h4>',
      '<p><code>&gt;</code> empties the file <b>before</b> the command runs. So <code>sort names.txt &gt; names.txt</code> leaves an empty file: the shell truncated it first, then the command read nothing. Write to a new name, or use <code>sponge</code>.</p>',
      '<h4>Heredocs and here-strings</h4>',
      '<p>Bash can feed a whole block of text in: <code>cat &lt;&lt;EOF</code> … <code>EOF</code>. PowerShell uses <code>@&#39;</code> … <code>&#39;@</code>. Both are how you give a program several lines without a file.</p>'
    ].join('')),

    chapter('chaining', '🔗', 'Chaining, logic and background jobs', [
      '<p>Three marks join whole commands on one line, and the difference between them is what happens when something fails.</p>',
      '<ul>',
      '<li><code>a ; b</code> runs <code>a</code>, then <code>b</code>, whatever happened. PowerShell uses <code>;</code> the same way.</li>',
      '<li><code>a &amp;&amp; b</code> runs <code>b</code> only if <code>a</code> succeeded. In PowerShell 7 this works too; in Windows PowerShell use <code>a; if ($?) { b }</code>.</li>',
      '<li><code>a || b</code> runs <code>b</code> only if <code>a</code> failed, which makes it read as “or else”.</li>',
      '</ul>',
      '<p>So <code>mkdir build &amp;&amp; cd build</code> is a safe pair: the change of folder only happens if the folder is there. <code>test -f keys.txt || echo "no keys"</code> is a one-line check.</p>',
      '<h4>Background and groups</h4>',
      '<p><code>cmd &amp;</code> starts a command in the background in Bash; <code>jobs</code> lists them and <code>fg</code> brings one back. <code>(cd /tmp &amp;&amp; ls)</code> runs in a subshell, so the change of directory does not follow you back. PowerShell has <code>Start-Job</code> and the ampersand for strings, not for background work.</p>',
      '<h4>Command substitution</h4>',
      '<p><code>$(cmd)</code> runs a command and puts its output into the line: <code>echo "today is $(date)"</code>. Bash also has backticks, which are the older spelling. PowerShell puts a whole expression inside <code>$()</code> too, and cmd uses <code>for /f</code> to do the same job.</p>'
    ].join('')),

    chapter('globs', '✳️', 'Wildcards, braces, quoting and escapes', [
      '<p>Wildcards are the shell’s shorthand for names you do not want to type out.</p>',
      '<ul>',
      '<li><code>*</code> matches any run of characters: <code>*.log</code> is every log file, <code>data/*</code> is everything in <code>data</code>.</li>',
      '<li><code>?</code> matches exactly one character: <code>part?.txt</code> finds <code>part1.txt</code> and <code>partA.txt</code>.</li>',
      '<li><code>[abc]</code> matches one of those characters; <code>[0-9]</code> matches one digit.</li>',
      '<li><code>{a,b,c}</code> expands to three separate words before anything runs: <code>touch part{1,2,3}.txt</code>. Ranges work too: <code>{1..5}</code>.</li>',
      '</ul>',
      '<h4>Quoting decides what the shell touches</h4>',
      '<p>Anything the shell could interpret — spaces, <code>$</code>, <code>*</code>, <code>;</code>, <code>&amp;</code> — can be protected with quotes.</p>',
      '<ul>',
      '<li><code>"double quotes"</code> still expand <code>$variables</code> and <code>$(commands)</code>.</li>',
      '<li><code>\'single quotes\'</code> take the text exactly as written, expansions and all.</li>',
      '<li><code>\\</code> escapes one character: <code>my\\ file.txt</code> is one file name with a space in it.</li>',
      '</ul>',
      '<p>In PowerShell the backtick <code>`</code> is the escape character, and single quotes are literal. In cmd there is no real quoting: use <code>"double quotes"</code> and avoid spaces when you can.</p>',
      '<h4>Globs are done by the shell, not the command</h4>',
      '<p><code>rm *.tmp</code> turns into a list of names before <code>rm</code> ever starts. That is why a glob that matches nothing behaves differently in Bash (the pattern is passed through) and in cmd (an error). Quote the pattern when you want the command itself to decide.</p>'
    ].join('')),

    chapter('cli-help', '❓', 'Finding help while you work', [
      '<p>Every shell here can explain itself, and every page of this book is also in the terminal’s own manual.</p>',
      '<ul>',
      '<li><b>Bash:</b> <code>man ls</code> opens the manual page, <code>ls --help</code> prints a summary, <code>apropos word</code> searches the descriptions, and <code>type ls</code> says whether it is a program, an alias or a built-in.</li>',
      '<li><b>PowerShell:</b> <code>Get-Help Get-ChildItem</code>, <code>-Examples</code> for examples, and <code>Get-Command</code> to find a cmdlet by what it does.</li>',
      '<li><b>cmd:</b> <code>help</code> lists commands, and <code>dir /?</code> explains the switches of that command.</li>',
      '<li><b>Git and Docker:</b> <code>git help commit</code>, <code>git commit --help</code>, <code>docker run --help</code>.</li>',
      '<li><b>Python and Node:</b> <code>help(str)</code>, <code>dir(x)</code> and <code>.help</code> explain what is already loaded.</li>',
      '</ul>',
      '<p>In this app there is a second door: the Help window has a search box, a page for every switch, a playground that runs the example, and an AI box that can explain a command and open the page for you.</p>'
    ].join('')),

    chapter('safety', '🛡️', 'What the sandbox does and does not touch', [
      '<p>Everything in the Terminal playground and the Code playground runs on a simulated machine. The files you see belong to the sandbox, the network tools answer from bundled evidence, and the programs cannot open, change or delete anything on your real PC.</p>',
      '<ul>',
      '<li>Commands such as <code>rm -rf /</code>, <code>format</code> or <code>shutdown</code> can only ever affect the simulated disk, and resetting brings it back.</li>',
      '<li>Python and JavaScript in the playground run in a sealed worker with no network and no access to this app’s data.</li>',
      '<li>Native languages (C, Rust, Java and the rest) are disabled in this build rather than run as your Windows user.</li>',
      '</ul>',
      '<p>The real value of the sandbox is that you can be reckless safely: try the destructive-looking command, read what it printed, then reset and try the careful version.</p>'
    ].join('')),

    chapter('questions', '💬', 'Questions people ask about the terminal', [
      '<h4>“Nothing happened.”</h4><p>That is usually success. <code>mkdir</code>, <code>cp</code>, <code>chmod</code> and <code>git add</code> print nothing. Check with <code>ls</code>, or read the exit status: <code>echo $?</code> in Bash, <code>$LASTEXITCODE</code> in PowerShell.</p>',
      '<h4>“It says command not found.”</h4><p>The word is not a program the shell can find. Check the spelling, and check the shell: <code>ls</code> exists in Bash and cmd, <code>Get-ChildItem</code> only in PowerShell. In this app the manual lists exactly what each shell has.</p>',
      '<h4>“Permission denied.”</h4><p>The file is there but you may not read, write or run it. <code>ls -l</code> shows the mode; <code>chmod u+x script.sh</code> makes a script runnable. In PowerShell it may be the execution policy instead.</p>',
      '<h4>“Why did my file become empty?”</h4><p><code>&gt;</code> emptied it before the command read it. Use a different name and rename afterwards, or use a temporary file.</p>',
      '<h4>“How do I find a file by name?”</h4><p><code>find . -name "*.txt"</code> in Bash, <code>Get-ChildItem -Recurse -Filter *.txt</code> in PowerShell, <code>dir /s /b *.txt</code> in cmd. In this app <code>find</code> searches the sandbox disk.</p>',
      '<h4>“How do I search inside files?”</h4><p><code>grep -rn "word" .</code> in Bash, <code>Select-String -Path *.* -Pattern word</code> in PowerShell, <code>findstr /s /i word *.*</code> in cmd.</p>',
      '<h4>“How do I see what I typed before?”</h4><p>Up arrow, or <code>history</code> in Bash and <code>Get-History</code> in PowerShell. <code>Ctrl+R</code> searches Bash history; <code>Ctrl+L</code> clears the screen in most shells.</p>',
      '<h4>“What does <code>sudo</code> do?”</h4><p>It runs one command as the administrator. In the sandbox it grants the simulated root account, which is how privilege-escalation exercises are played. On a real machine, treat it as “this command can break anything”.</p>',
      '<h4>“What is the difference between <code>/</code> and <code>\\</code>?”</h4><p>Unix paths use <code>/</code>, Windows paths use <code>\\</code>, and PowerShell accepts both. Bash also uses <code>/</code> as the root of the disk and as the division-free separator in paths — context decides.</p>',
      '<h4>“Why does <code>cd</code> not work in my script?”</h4><p>It does, but only for that script: each script runs in its own shell. Use <code>cd "$(dirname "$0")"</code> at the top, or run the script with <code>source</code>.</p>',
      '<h4>“How do I stop a program that will not quit?”</h4><p><code>Ctrl+C</code>. If that fails, find it with <code>ps aux | grep name</code> and end it with <code>kill -9 PID</code>, or in PowerShell <code>Stop-Process -Id PID</code>. In the playground, use Stop.</p>',
      '<h4>“How do I write a script?”</h4><p>Put the commands in a file, start it with <code>#!/bin/bash</code>, make it executable with <code>chmod +x</code>, and run it with <code>./name.sh</code>. PowerShell saves <code>.ps1</code>; cmd saves <code>.bat</code>.</p>',
      '<h4>“Is a pipe the same as a redirect?”</h4><p>No. A pipe feeds another command; a redirect writes to a file. <code>|</code> and <code>&gt;</code> are one character apart and worlds apart in meaning.</p>'
    ].join(''))
  ];

  /* ------------------------------------------------------------------ shells, from the playground's own help data */
  function mineSwitches(rows) {
    const found = new Map();
    const take = (flag, text) => {
      flag = String(flag || '').trim();
      if (!/^-{1,2}[A-Za-z][\w-]{0,14}$/.test(flag)) return;
      if (!text || found.has(flag)) return;
      found.set(flag, String(text).trim().replace(/^[-–:]\s*/, '').replace(/[.;]$/, ''));
    };
    for (const row of rows) {
      const syntax = String(row[0] || ''), desc = String(row[1] || '');
      const command = syntax.replace(/\s*\[.*$/, '').trim() || syntax;
      /* the description usually explains its switches inline: "-i ignore case, -n line numbers". A dash inside a
         word (search-and-replace) is not a switch, so the dash has to start the word. */
      const re = /(?:^|[\s,;([])(-{1,2}[A-Za-z][\w-]{0,14})\s+([a-z][^,;)·]{2,90})/g;
      let m;
      while ((m = re.exec(desc))) take(m[1], m[2] + (command ? ' — with ' + command : ''));
      /* bracket groups in the syntax: ls [-la] · grep [-inrcv] */
      const br = /\[([-\w\s|]+)\]/g;
      while ((m = br.exec(syntax))) {
        const inside = m[1].trim();
        const words = inside.split(/\s+/).filter(Boolean);
        for (const word of words) {
          if (!/^-{1,2}[A-Za-z]/.test(word)) continue;
          /* only a run of two or three plain letters is several switches sharing a dash (-la, -rf). Anything else
             (-Fsep, --dry-run) is one switch that happens to be longer, so it is kept whole. */
          if (/^-[a-z]{2,3}$/.test(word)) [...word.slice(1)].forEach(letter => take('-' + letter, 'One of ' + word + ' (short switches are written together) in ' + (command || syntax) + '.'));
          else take(word, 'Used by ' + (command || syntax) + '.');
        }
      }
    }
    return [...found.entries()].sort((a, b) => a[0].localeCompare(b[0]));
  }

  function shellChapters(shell, groups) {
    const out = [];
    const allRows = [];
    groups.forEach(([title, rows], i) => {
      allRows.push(...rows);
      const grouped = /^(?:SHELL SYNTAX|PIPES|OPERATORS|CONCEPTS)/i.test(title) || rows.every(r => !/[<>[{(]/.test(String(r[0])) && String(r[1]).length < 90 && /[·|]/.test(String(r[0])));
      const clean = String(title).toLowerCase().replace(/^([a-z])/, c => c.toUpperCase());
      const body = grouped
        ? '<ul>' + rows.map(([term, text]) => '<li><b>' + esc(term) + '</b> — ' + esc(text) + '</li>').join('') + '</ul>'
        : '<table><thead><tr><th>Write</th><th>What it does</th></tr></thead><tbody>' +
          rows.map(([syntax, text]) => '<tr><td><code>' + esc(syntax) + '</code></td><td>' + esc(text) + '</td></tr>').join('') + '</tbody></table>';
      out.push(chapter(slug(shell.id + '-' + clean), i === 0 ? shell.icon || '📄' : '📄', clean, [
        '<h3>' + esc(shell.name) + ' · ' + esc(clean.toLowerCase()) + '</h3>',
        '<p>' + esc(shell.about || ('Commands of the ' + shell.name + ' sandbox.')) + '</p>',
        grouped ? '<p>These are pieces of the shell’s own language: they change how a whole line is read, so they usually appear between commands rather than on their own.</p>' : '',
        body
      ].join('')));
    });
    const flags = mineSwitches(allRows);
    if (flags.length) {
      out.push(chapter(slug(shell.id + '-switches'), '🔧', 'Every switch in ' + shell.name, [
        '<h3>Every switch in ' + esc(shell.name) + '</h3>',
        '<p>A switch is one extra instruction added to a command and always belongs to that command. These are collected from every page above, with the words the playground uses for them.</p>',
        '<p>Several short switches share one dash: <code>-la</code> is <code>-l</code> plus <code>-a</code>. Long forms never stack letters. <code>--</code> ends the switches.</p>',
        '<table><thead><tr><th>Switch</th><th>What it does</th></tr></thead><tbody>' +
        flags.map(([flag, text]) => '<tr><td><code>' + esc(flag) + '</code></td><td>' + esc(text) + '</td></tr>').join('') +
        '</tbody></table>',
        '<p>For one switch on its own page, open the terminal’s help window and search for it: every switch has a page there.</p>'
      ].join('')));
    }
    return out;
  }

  function shellParts() {
    const TP = window.TerminalPlayground;
    const db = (TP && TP.HELP_DB) || {};
    const shells = ((TP && TP.shells) || []).filter(s => s && db[s.id]);
    const hues = ['#79e6ff', '#e8c56a', '#8fe3b0', '#ff9f7a', '#c9a7ff', '#7fe0d4', '#f2a6d8', '#d7b48a', '#b9c6ff', '#a8b3c9'];
    return shells.map((shell, i) => ({
      title: shell.name, note: shell.about ? summarize(shell.about) : 'Every command and switch of this shell.',
      hue: hues[i % hues.length], chapters: shellChapters(shell, db[shell.id])
    }));
  }

  /* ------------------------------------------------------------------ the code playground, language by language */
  const LANGS = () => (window.PlayLangs && Array.isArray(window.PlayLangs.LANGS) ? window.PlayLangs.LANGS : []);
  const RUN_GROUP = {
    py: 'app', js: 'app', html: 'app', sql: 'app', binary: 'app', scratch: 'app',
    eso: 'eso', local: 'native', docker: 'native', pc: 'native', none: 'read'
  };
  const GROUP_NAME = {
    app: { title: 'Runs in the app', note: 'Programs that run here and now, offline.', hue: '#79e6ff' },
    classic: { title: 'Classic languages', note: 'Scheme, Prolog, Forth and BASIC, built into the app.', hue: '#8fe3b0' },
    eso: { title: 'Esoteric languages', note: 'Brainfuck, Piet, Shakespeare and the rest of the strange ones.', hue: '#c9a7ff' },
    native: { title: 'Needs a compiler', note: 'Languages this browser-only build refuses to run.', hue: '#ff9f7a' },
    read: { title: 'Languages to read', note: 'Examples you can study and copy, not run.', hue: '#d7b48a' }
  };

  function pictureNote(lang) {
    if (lang.id === 'python') return 'Yes. <b>pygame</b>, <b>turtle</b>, <b>tkinter</b> and <b>matplotlib</b> are built in: a drawing, an animation or a Tk window appears as pictures under the output and on the Screen. pygame keeps the frames it drew (up to 180), tkinter up to 90, and both show them when the program ends. There is no real window, so keyboard and mouse input do nothing (message and file dialogs answer as if cancelled).';
    if (lang.id === 'javascript') return 'Yes. Anything you draw on a canvas is collected and shown as pictures, and an animation keeps the last four frames it drew. Tick <b>🖥 Show it as a web page</b> to watch it run live at full speed, with the DOM, keyboard and pointer working.';
    if (lang.id === 'html') return 'Yes. The preview is a real page, so a CSS or JavaScript animation plays. <b>▶ Run on the screen</b> turns scripts on, still with no network.';
    if (lang.id === 'scratch') return 'Yes. The cat moves, draws with the pen and talks on the Screen while the script runs.';
    if (lang.run === 'py' || lang.run === 'js') return 'Yes, as pictures.';
    if (lang.run === 'local' || lang.run === 'docker' || lang.run === 'pc' || lang.run === 'none') return 'Nothing runs, so nothing is drawn. This build runs code only inside the browser sandbox: no program typed here can reach your PC, and a compiler on your PC is never started.';
    return 'No pictures: this language only prints text, and that is what the sandbox shows.';
  }
  function whyNote(lang) {
    const PL = window.PlayLangs;
    let why = lang.why || '';
    if (!why && PL && PL.route) { try { const w = PL.route(lang, null); why = (w && w.why) || ''; } catch (e) { why = ''; } }
    return why;
  }
  function langChapter(lang) {
    const why = whyNote(lang);
    const runs = ['py', 'js', 'html', 'sql', 'binary', 'scratch', 'eso'].includes(lang.run);
    return chapter('lang-' + lang.id, lang.ic || '📄', lang.n, [
      '<h3>' + esc(lang.n) + '</h3>',
      '<p><b>How it runs here:</b> ' + esc(lang.how || (runs ? 'In the sandbox.' : why || 'Not runnable in this build.')) + '</p>',
      why && runs ? '' : (why ? '<p class="cbk-unrun"><b>Not in this build:</b> ' + esc(why) + '</p>' : ''),
      '<p><b>Will you see a picture?</b> ' + pictureNote(lang) + '</p>',
      lang.ex ? '<h4>A first program</h4><pre class="cbk-code">' + esc(lang.ex) + '</pre>' : '',
      lang.inp ? '<p class="small">It reads the Input box line by line, so give it something to work on before pressing Run.</p>' : '',
      '<h4>Questions people ask</h4><ul>' +
      '<li><b>How do I run it?</b> Pick it from the language menu, keep the example or paste your own, then press Run.</li>' +
      (runs ? '<li><b>Why is there no output?</b> A program that only defines things prints nothing. Add a print or a console.log, then run again.</li>' : '') +
      (runs && ['py', 'js'].includes(lang.id) ? '<li><b>Can it read a file?</b> No. The sandbox has no access to this PC; paste what you need into the code or the Input box.</li>' : '') +
      (runs && lang.run === 'eso' ? '<li><b>Stopped after 15 seconds?</b> The built-in interpreter has a time limit, so an endless loop is ended for you.</li>' : '') +
      '<li><b>Where do errors appear?</b> Under the output, with the line that failed. The message names what went wrong, not what to type next.</li>' +
      '</ul>'
    ].join(''));
  }

  function codingParts() {
    const langs = LANGS();
    if (!langs.length) return [];
    const PL = window.PlayLangs || {};
    const mini = new Set(PL.MINI || []);
    const groupOf = lang => lang.run === 'eso' ? (mini.has(lang.id) ? 'classic' : 'eso') : (RUN_GROUP[lang.run] || 'read');
    const groups = Object.keys(GROUP_NAME).map(k => ({ key: k, ...GROUP_NAME[k], chapters: [] }));
    const byKey = Object.fromEntries(groups.map(g => [g.key, g]));

    /* the introduction chapters come first, in the "runs in the app" part */
    byKey.app.chapters.push(chapter('code-start', '💻', 'The Code playground in one page', [
      '<p>The Code playground runs programs offline, in a sandbox on this page. There are ' + langs.length + ' languages in the menu, and each one either runs here or says exactly why it cannot.</p>',
      '<ul>',
      '<li><b>Runs in the app:</b> Python (Pyodide, with numpy, pandas and matplotlib), JavaScript, HTML and CSS, SQL, Scratch and Binary &amp; Hex.</li>',
      '<li><b>Built-in interpreters:</b> Scheme, Prolog, Forth, BASIC and a cabinet of esoteric languages, all written for this app.</li>',
      '<li><b>Native languages:</b> C, C++, Rust, Java, C#, Go and the rest are refused in this build, because running them would mean running them on your PC.</li>',
      '</ul>',
      '<p>Each language has its own page in this book, with an example and the answers people ask for first. The list of languages lives in the Playground itself under the language menu.</p>'
    ].join('')));

    byKey.app.chapters.push(chapter('code-pictures', '🖼️', 'Pictures, animation and sound', [
      '<p>Programs that draw must show what they drew, so every run collects pictures and shows them under the output and on the Screen.</p>',
      '<ul>',
      '<li><b>Python:</b> matplotlib figures, turtle drawings, and pygame frames (the last few frames of an animation, up to 180 kept).</li>',
      '<li><b>JavaScript:</b> every canvas becomes a PNG, and an animation keeps the last four frames. Tick <b>🖥 Show it as a web page</b> to watch it move live.</li>',
      '<li><b>HTML and CSS:</b> the preview is a real page, so CSS transitions and animation play.</li>',
      '<li><b>Scratch:</b> the cat moves and draws on the Screen.</li>',
      '<li><b>Text-only languages:</b> SQL, Scheme, Prolog, Forth, BASIC and the esoteric interpreters have no drawing model, so their output is text.</li>',
      '</ul>',
      '<p>There is no window, no keyboard and no sound in the sandboxed runs: a program that waits for a key press waits for ever. pygame and turtle therefore render frames instead of opening a window.</p>',
      '<p>Pictures are captured when the program ends, or when it is stopped at the time limit, so the very last thing on screen is what you get.</p>'
    ].join('')));

    byKey.app.chapters.push(chapter('code-questions', '💬', 'Questions about the code playground', [
      '<h4>“Why did my program print nothing?”</h4><p>Either it printed nothing, or it stopped before reaching the print. Read the error under the output; a program that only defines functions produces no output at all.</p>',
      '<h4>“Why does it stop after 60 seconds?”</h4><p>Python runs have a 60-second limit and JavaScript 20 seconds, so an endless loop always ends. Python animations stop at their frame limit and show the frames they drew.</p>',
      '<h4>“Can I install a library?”</h4><p>Python ships numpy, pandas, matplotlib, pillow, pygame and turtle offline. Other packages would have to be downloaded, and the sandbox has no network, so an import of anything else says it could not be loaded.</p>',
      '<h4>“Can my program open a file on this PC?”</h4><p>No. Python sees <code>/data</code> (the files attached to the run) and the sandbox’s own folder; JavaScript sees nothing of your disk. Use the Input box or paste the text in.</p>',
      '<h4>“Can it use the internet?”</h4><p>No. The worker has no network, no WebSocket and no way to load another script. That is the promise that makes it safe to run a stranger’s code here.</p>',
      '<h4>“Why does <code>input()</code> not work?”</h4><p>There is no keyboard inside the sandbox. Put the values in the code, or use the terminal’s Python shell, which can be given input.</p>',
      '<h4>“How do I see a canvas or a game?”</h4><p>Tick <b>🖥 Show it as a web page</b> for JavaScript, and <b>▶ Run on the screen</b> for HTML. Both run in the same sealed page, with keys and pointer, and still no network.</p>',
      '<h4>“Why is my language greyed out?”</h4><p>Its page in this book says why. Native languages are refused by design in this browser-only build.</p>',
      '<h4>“Can I paste a program from somewhere else?”</h4><p>Yes, that is the point. Pick the right language, paste, run. If it uses a package the sandbox does not carry, the error says which one.</p>',
      '<h4>“Where are my programs saved?”</h4><p>In this browser, per language, until you clear the app’s data. Copy anything you want to keep.</p>'
    ].join('')));

    for (const lang of langs) {
      const g = byKey[groupOf(lang)];
      if (g) g.chapters.push(langChapter(lang));
    }
    return groups.filter(g => g.chapters.length);
  }

  /* ------------------------------------------------------------------ build the book */
  let parts = [], chapters = [], byId = {}, totalMins = 0;
  function build() {
    const secs = [];
    const bookParts = [
      { title: 'The command line', note: 'What a terminal is, and how a line of it is read.', hue: '#e8c56a', chapters: BASICS },
      ...shellParts(),
      ...codingParts()
    ];
    parts = bookParts.filter(p => p.chapters && p.chapters.length).map((p, pi) => {
      p.num = pi + 1;
      p.chapters = p.chapters.map(ch => {
        secs.push(ch);
        const w = wordsOf(plain(ch.html));
        return { ...ch, part: p, n: secs.length, words: w, mins: Math.max(1, Math.round(w / 200)) };
      });
      p.chapters.forEach((c, ci) => { c.inPart = ci + 1; });
      return p;
    });
    chapters = parts.flatMap(p => p.chapters);
    byId = {}; chapters.forEach((c, i) => { byId[c.id] = i; });
    totalMins = chapters.reduce((a, c) => a + c.mins, 0);
    return chapters.length > 0;
  }

  /* ------------------------------------------------------------------ state */
  let root = null, book = null, ix = 0, opened = false, toc = false, query = '', flipping = false, lastFocus = null, prevOverflow = '';

  /* ------------------------------------------------------------------ the overlay */
  function shell() {
    if (root) return root;
    /* a real <dialog>, so the book goes into the top layer and can open on top of another dialog
       (the terminal help window) instead of being painted underneath it */
    root = document.createElement('dialog');
    root.className = 'gbk cbk';
    root.setAttribute('role', 'dialog');
    root.setAttribute('aria-modal', 'true');
    root.setAttribute('aria-label', 'The Cyber Codex: terminal commands and coding languages, as a book');
    root.innerHTML =
      '<div class="gbk-stars"></div><div class="gbk-cone"></div><div class="gbk-floor"></div><div class="gbk-beams"></div><div class="gbk-dust" id="cbkDust"></div>' +
      '<div class="gbk-top">' +
        '<div class="gbk-brand"><span class="gbk-mark">⌘</span><div><b>The Cyber Codex</b><span>Terminals and code, page by page</span></div></div>' +
        '<span class="sp"></span><div class="gbk-here" id="cbkHere"></div>' +
        '<button class="gbk-tbtn" data-a="find" title="Contents (C)">☰ <span class="lbl">Contents</span></button>' +
        '<button class="gbk-tbtn" data-a="full" title="Full screen (F)">⛶</button>' +
        '<button class="gbk-tbtn close" data-a="close" title="Close (Esc)" aria-label="Close the book">✕</button>' +
      '</div>' +
      '<div class="gbk-stage">' +
        '<button class="gbk-arrow prev" data-a="prev" title="Previous chapter (←)" aria-label="Previous chapter">‹</button>' +
        '<div class="gbk-book" id="cbkBook">' +
          '<div class="gbk-edge l"></div><div class="gbk-edge r"></div>' +
          '<div class="gbk-pages">' +
            '<div class="gbk-leaf left"><div class="gbk-page"><div class="gbk-left" id="cbkLeft"></div><div class="gbk-pnum" id="cbkPnumL"></div></div></div>' +
            '<div class="gbk-leaf right"><div class="gbk-page"><div class="gbk-mobilehead" id="cbkMobile"></div>' +
              '<div class="gbk-right"><div class="gbk-rhead"><span class="gbk-rik" id="cbkRik"></span><b id="cbkRtitle"></b><span class="sp"></span><em id="cbkRmins"></em></div>' +
              '<div class="gbk-content" id="cbkContent"></div><div class="gbk-fade" id="cbkFade"></div><div class="gbk-more" id="cbkMore">↓ more</div></div>' +
              '<div class="gbk-pnum" id="cbkPnumR"></div></div></div>' +
          '</div>' +
          '<div class="gbk-scan"></div>' +
          '<div class="gbk-cover" id="cbkCover"><div class="gbk-coverin">' +
            '<div class="gbk-seal">⌘</div><div class="gbk-kicker">Moundshroud · your private assistant</div>' +
            '<h1>The Cyber Codex</h1><p class="gbk-csub">Every command, switch and pipe of every shell — and every language in the Code playground — on a book made of light.</p>' +
            '<div class="gbk-rule"></div><div class="gbk-cstats" id="cbkStats"></div>' +
            '<div class="gbk-cbtns"><button class="gbk-copen" data-a="open" id="cbkOpenBtn">Open the book</button><button class="gbk-csecond" data-a="toc">Look inside</button></div>' +
            '<div class="gbk-chint">Press <kbd>→</kbd> to turn a page · <kbd>C</kbd> for contents · <kbd>Esc</kbd> to close</div>' +
          '</div></div>' +
        '</div>' +
        '<button class="gbk-arrow next" data-a="next" title="Next chapter (→)" aria-label="Next chapter">›</button>' +
      '</div>' +
      '<div class="gbk-bottom">' +
        '<button class="gbk-nav" data-a="prev">← Previous</button>' +
        '<div class="gbk-prog"><div class="gbk-track"><i id="cbkBar"></i></div><div class="gbk-pmeta"><span id="cbkMeta"></span><span class="sp"></span><span class="gbk-dots" id="cbkDots"></span></div></div>' +
        '<button class="gbk-nav" data-a="next">Next →</button>' +
      '</div>' +
      '<div class="gbk-veil" data-a="tocclose"></div>' +
      '<aside class="gbk-toc" id="cbkToc" aria-label="Contents">' +
        '<div class="gbk-tochead"><b>Contents</b><span class="sp"></span><button data-a="cover" title="Back to the cover" aria-label="Back to the cover">⌂</button><button data-a="tocclose" title="Close contents" aria-label="Close contents">✕</button></div>' +
        '<div class="gbk-tocsearch"><input id="cbkQ" type="search" placeholder="Search a command, a switch or a language…" autocomplete="off" spellcheck="false"><button class="gbk-chip" data-a="clearq" title="Clear the search">Clear</button></div>' +
        '<div class="gbk-toclist" id="cbkTocList"></div>' +
        '<div class="gbk-tocfoot"><span id="cbkTocCount"></span></div>' +
      '</aside>';
    document.body.appendChild(root);
    book = root.querySelector('#cbkBook');

    const dust = root.querySelector('#cbkDust');
    for (let i = 0; i < 22; i++) {
      const d = document.createElement('i');
      d.style.left = (6 + Math.random() * 88) + '%';
      d.style.animationDuration = (7 + Math.random() * 9) + 's';
      d.style.animationDelay = (-Math.random() * 12) + 's';
      d.style.width = d.style.height = (2 + Math.random() * 3).toFixed(1) + 'px';
      d.style.opacity = (0.25 + Math.random() * 0.5).toFixed(2);
      dust.appendChild(d);
    }

    root.addEventListener('click', onClick);
    root.querySelector('#cbkCover').addEventListener('click', e => { if (!e.target.closest('button')) openBook(); });
    root.querySelector('#cbkContent').addEventListener('scroll', updateScroll, { passive: true });
    const q = root.querySelector('#cbkQ');
    q.addEventListener('input', () => { query = q.value; renderTocList(); });
    q.addEventListener('keydown', e => {
      if (e.key === 'Enter') { e.preventDefault(); const first = root.querySelector('#cbkTocList .gbk-tocitem'); if (first) jumpTo(first.dataset.ch); }
      if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); closeToc(); }
    });
    document.addEventListener('keydown', onKey, true);
    return root;
  }

  function onClick(e) {
    const b = e.target.closest('[data-a]'); if (!b) return;
    const a = b.dataset.a;
    if (a === 'open') return openBook();
    if (a === 'close') return close();
    if (a === 'toc' || a === 'find') return openToc(true);
    if (a === 'tocclose') return closeToc();
    if (a === 'cover') { closeToc(); return cover(); }
    if (a === 'prev') return prev();
    if (a === 'next') return next();
    if (a === 'full') return fullscreen();
    if (a === 'clearq') { query = ''; const q = root.querySelector('#cbkQ'); if (q) { q.value = ''; q.focus(); } renderTocList(); return; }
    if (a === 'jump') { const id = b.dataset.ch; if (id) jumpTo(id); return; }
    if (a === 'tab') { if (A.cybertab) A.cybertab.go(b.dataset.go || 'code'); close(); return; }
  }

  /* ------------------------------------------------------------------ cover and chrome */
  function cover() {
    if (!chapters.length) return;
    opened = false;
    root.classList.remove('open');
    const last = clamp(+ls.get('cbk_ix', '0') || 0, 0, chapters.length - 1);
    const btn = root.querySelector('#cbkOpenBtn');
    if (btn) btn.textContent = last > 0 ? 'Continue · Chapter ' + (last + 1) : 'Open the book';
    const stats = root.querySelector('#cbkStats');
    if (stats) stats.innerHTML = '<b>' + chapters.length + '</b> chapters · <b>' + parts.length + '</b> parts · <b>' + totalMins + '</b> min of reading';
    updateChrome();
  }

  function openBook(at) {
    if (!chapters.length) { A.toast('The book is still being built. Try again in a moment.'); return; }
    if (opened) { if (at != null) go(at, at > ix ? 1 : -1); return; }
    ix = at == null ? clamp(+ls.get('cbk_ix', '0') || 0, 0, chapters.length - 1) : clamp(+at, 0, chapters.length - 1);
    opened = true;
    renderSpread();
    root.classList.add('open', 'opening');
    try { A.sfx && A.sfx.whoosh && A.sfx.whoosh(); } catch (e) { }
    setTimeout(() => root && root.classList.remove('opening'), 1200);
    savePos();
  }
  const savePos = () => { try { ls.set('cbk_ix', String(ix)); } catch (e) { } };

  function renderSpread() {
    const ch = chapters[ix]; if (!ch) return;
    root.style.setProperty('--p', ch.part.hue);
    const left = root.querySelector('#cbkLeft');
    left.innerHTML =
      '<div class="gbk-part"><i></i>Part ' + roman(ch.part.num) + ' · ' + esc(ch.part.title) + '</div>' +
      '<div class="gbk-chno">Chapter ' + ch.inPart + ' of ' + ch.part.chapters.length + ' in this part</div>' +
      '<div class="gbk-sigil"><span class="ring"></span><span class="ic">' + (ch.icon || '•') + '</span></div>' +
      '<h2 class="gbk-chtitle">' + esc(ch.title) + '</h2>' +
      '<p class="gbk-summary">' + esc(ch.summary) + '</p>' +
      (ch.threads.length ? '<ul class="gbk-threads">' + ch.threads.map(t => '<li>' + esc(t) + '</li>').join('') + '</ul>' : '') +
      '<span class="sp"></span>' +
      '<div class="gbk-leftfoot"><span>' + ch.mins + ' min read</span><span class="sp"></span><span>' + ch.words + ' words</span></div>';

    root.querySelector('#cbkMobile').innerHTML = '<div class="gbk-part"><i></i>Part ' + roman(ch.part.num) + ' · ' + esc(ch.part.title) + '</div>' +
      '<h3>' + esc(ch.title) + '</h3><p class="gbk-summary">' + esc(ch.summary) + '</p>';
    root.querySelector('#cbkRik').textContent = ch.icon || '•';
    root.querySelector('#cbkRtitle').textContent = ch.title;
    root.querySelector('#cbkRmins').textContent = ch.mins + ' min';
    const content = root.querySelector('#cbkContent');
    content.innerHTML = ch.html;
    content.scrollTop = 0;
    root.querySelector('#cbkPnumL').textContent = 'p. ' + (ix * 2 + 1);
    root.querySelector('#cbkPnumR').textContent = 'p. ' + (ix * 2 + 2);
    updateScroll();
    updateChrome();
    savePos();
  }

  function updateChrome() {
    if (!root) return;
    const ch = chapters[ix];
    const here = root.querySelector('#cbkHere');
    if (here) here.innerHTML = (opened && ch) ? '<b>' + esc(ch.title) + '</b> · Part ' + roman(ch.part.num) : '<b>The cover</b> · ' + chapters.length + ' chapters';
    const bar = root.querySelector('#cbkBar');
    if (bar) bar.style.width = (opened && chapters.length) ? Math.round((ix + 1) / chapters.length * 100) + '%' : '0%';
    const meta = root.querySelector('#cbkMeta');
    if (meta) meta.innerHTML = (opened && ch) ? 'Chapter <b>' + (ix + 1) + '</b> of ' + chapters.length + ' · ' + esc(ch.part.title)
      : 'The cover · <b>' + chapters.length + '</b> chapters in ' + parts.length + ' parts';
    const dots = root.querySelector('#cbkDots');
    if (dots) dots.innerHTML = parts.map(p => '<i' + (ch && p.num === ch.part.num ? ' class="on"' : '') + ' title="' + esc(p.title) + '"></i>').join('');
    root.querySelectorAll('[data-a="prev"]').forEach(b => { b.disabled = !opened || ix <= 0; });
    root.querySelectorAll('[data-a="next"]').forEach(b => { b.disabled = opened && ix >= chapters.length - 1; });
  }

  function updateScroll() {
    if (!root) return;
    const c = root.querySelector('#cbkContent'), fade = root.querySelector('#cbkFade'), more = root.querySelector('#cbkMore');
    if (!c) return;
    const has = c.scrollHeight - c.scrollTop - c.clientHeight > 14;
    if (fade) fade.classList.toggle('on', has);
    if (more) more.classList.toggle('on', has);
  }

  /* ------------------------------------------------------------------ turning pages */
  function go(i, dir) {
    if (!chapters.length) return;
    i = clamp(i, 0, chapters.length - 1);
    if (!opened) return openBook(i);
    if (i === ix || flipping) return;
    const step = dir || (i > ix ? 1 : -1);
    if (reduced()) { ix = i; renderSpread(); return; }
    flipping = true;
    const leaf = document.createElement('div');
    leaf.className = 'gbk-flip ' + (step > 0 ? 'next' : 'prev');
    book.appendChild(leaf);
    try { A.sfx && A.sfx.flip && A.sfx.flip(); } catch (e) { }
    setTimeout(() => { if (root) { ix = i; renderSpread(); } }, 320);
    setTimeout(() => { try { leaf.remove(); } catch (e) { } flipping = false; }, 760);
  }
  function next() {
    if (!opened) return openBook();
    if (ix >= chapters.length - 1) return A.toast('The end of the book. Press C for the contents.');
    go(ix + 1, 1);
  }
  function prev() {
    if (!opened) return;
    if (ix <= 0) return A.toast('This is the beginning. Press → to start reading.');
    go(ix - 1, -1);
  }

  /* ------------------------------------------------------------------ contents */
  function openToc(focusSearch) {
    if (!chapters.length) return;
    toc = true;
    root.classList.add('toc');
    renderTocList();
    if (focusSearch) setTimeout(() => { const q = root.querySelector('#cbkQ'); if (q) { q.focus(); q.select(); } }, 90);
  }
  function closeToc() { toc = false; if (root) root.classList.remove('toc'); }
  function renderTocList() {
    if (!root) return;
    const box = root.querySelector('#cbkTocList'); if (!box) return;
    const q = query.trim().toLowerCase();
    const hit = c => !q || (c.title + ' ' + plain(c.html)).toLowerCase().includes(q);
    const groups = parts.map(p => ({ p, list: p.chapters.filter(hit) })).filter(g => g.list.length);
    const total = chapters.filter(hit).length;
    box.innerHTML = groups.length ? groups.map(g =>
      '<div class="gbk-tocpart" style="--p:' + g.p.hue + '"><i></i>' + esc(g.p.title) + '<span></span></div>' +
      g.list.map(c => '<button class="gbk-tocitem' + (c.n - 1 === ix ? ' on' : '') + '" data-a="jump" data-ch="' + esc(c.id) + '">' +
        '<span class="n">' + String(c.n).padStart(2, '0') + '</span><span class="ic">' + (c.icon || '•') + '</span>' +
        '<span class="t">' + esc(c.title) + '</span><span class="r">' + c.mins + 'm</span></button>').join('')
    ).join('') : '<div class="gbk-tocnone">No chapter matches “' + esc(query.trim()) + '”.<br>Try <i>pipe</i>, <i>grep</i>, <i>switch</i> or <i>Python</i>.</div>';
    const count = root.querySelector('#cbkTocCount');
    if (count) count.textContent = total + ' of ' + chapters.length + ' chapters';
  }
  function jumpTo(id) {
    const i = byId[id];
    if (i == null) return;
    closeToc();
    if (!opened) return openBook(i);
    if (i === ix) { renderSpread(); return; }
    go(i, i > ix ? 1 : -1);
  }

  /* ------------------------------------------------------------------ full screen and keys */
  function fullscreen() {
    if (document.fullscreenElement) { document.exitFullscreen().catch(() => { }); return; }
    if (root.requestFullscreen) root.requestFullscreen().catch(() => A.toast('Full screen was refused by the window.'));
    else A.toast('Full screen is not available here.');
  }
  function onKey(e) {
    if (!root || !root.classList.contains('on')) return;
    const t = e.target, typing = t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.tagName === 'SELECT' || t.isContentEditable);
    if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); if (toc) closeToc(); else close(); return; }
    if (typing) return;
    const onButton = t && t.tagName === 'BUTTON';
    if (e.key === 'Tab') {
      const f = [...root.querySelectorAll('button,input,[tabindex]:not([tabindex="-1"])')].filter(el => el.offsetParent !== null && !el.disabled);
      if (!f.length) return;
      const first = f[0], last = f[f.length - 1];
      if (e.shiftKey && (document.activeElement === first || !root.contains(document.activeElement))) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && (document.activeElement === last || !root.contains(document.activeElement))) { e.preventDefault(); first.focus(); }
      return;
    }
    if (e.key === 'ArrowRight' || e.key === 'PageDown' || (e.key === ' ' && !e.shiftKey && !onButton)) { e.preventDefault(); e.stopPropagation(); next(); }
    else if (e.key === 'ArrowLeft' || e.key === 'PageUp' || (e.key === ' ' && e.shiftKey)) { e.preventDefault(); e.stopPropagation(); prev(); }
    else if (e.key === 'Home') { e.preventDefault(); e.stopPropagation(); closeToc(); openBook(0); }
    else if (e.key === 'End') { e.preventDefault(); e.stopPropagation(); closeToc(); openBook(chapters.length - 1); }
    else if (e.key === 'Enter' && !onButton) { e.preventDefault(); e.stopPropagation(); if (!opened) openBook(); }
    else if (e.key === 'c' || e.key === 'C' || e.key === '/') { e.preventDefault(); e.stopPropagation(); toc ? closeToc() : openToc(true); }
    else if (e.key === 'f' || e.key === 'F') { e.preventDefault(); e.stopPropagation(); fullscreen(); }
  }

  /* ------------------------------------------------------------------ open and close */
  function open(at) {
    if (!build()) {
      A.toast('The book needs the terminal and code data, which has not loaded yet. Open Cyber once, then try again.', 4500);
      return;
    }
    lastFocus = document.activeElement;
    shell();
    const i = at == null ? null : (typeof at === 'number' ? at : byId[at]);
    if (!root.classList.contains('on')) {
      prevOverflow = document.body.style.overflow;
      document.body.style.overflow = 'hidden';
      root.classList.add('on');
      if (typeof root.showModal === 'function' && !root.open) { try { root.showModal(); } catch (e) { } }
      if (i != null) openBook(i); else cover();
      setTimeout(() => { const c = root.querySelector('[data-a="close"]'); if (c) c.focus(); }, 60);
    } else if (i != null) {
      if (!opened) openBook(i); else if (i !== ix) go(i, i > ix ? 1 : -1);
    }
  }
  function close() {
    if (!root) return;
    closeToc();
    root.classList.remove('on', 'open');
    if (root.open && typeof root.close === 'function') { try { root.close(); } catch (e) { } }
    opened = false;
    document.body.style.overflow = prevOverflow || '';
    if (document.fullscreenElement && document.fullscreenElement === root) document.exitFullscreen().catch(() => { });
    try { if (lastFocus && lastFocus.focus) lastFocus.focus(); } catch (e) { }
  }

  A.cyberBook = {
    open, close, cover,
    go(id) {
      const i = typeof id === 'number' ? id : byId[id];
      if (i == null || !chapters[i]) return;
      if (!root || !root.classList.contains('on')) return open(i);
      if (!opened) return openBook(i);
      jumpTo(chapters[i].id);
    },
    chapters: () => chapters.map(c => ({ id: c.id, title: c.title, part: c.part.title, n: c.n })),
    isOpen: () => !!(root && root.classList.contains('on'))
  };
})();

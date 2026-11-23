// Short exercises for the separate Learn More workshop in the terminal playground.
// The workshop is deliberately not the hint ladder: it asks a question for each step, gives instant feedback and
// never changes the terminal, points or Elo. Nothing here runs a command.
(function () {
  if (window.TerminalLearn) return;

  const cmd = (title, text, command) => ({ title, text, command });
  const COURSES = {
    bash: {
      title: 'Bash: find anything on a Linux box',
      intro: 'Every exercise is the same shape: look around, narrow down, read, decode, answer. Learn the five moves and the room becomes paperwork.',
      steps: [
        cmd('Look before you touch', 'pwd tells you where you are, ls -la shows everything including names beginning with a dot. Hidden files are where lazy hiding lives.', 'pwd && ls -la'),
        cmd('Walk the tree', 'When a name could be anywhere, let the machine walk it for you. find prints paths; -type f keeps only files.', 'find . -type f | sort'),
        cmd('Read without drowning', 'cat prints a whole file. head, tail and sed -n print the slice you actually need, so a 4,000-line log stays readable.', 'head -n 20 README.txt'),
        cmd('Search the words that matter', 'grep -rin searches inside every file and keeps the line number. Start broad, then add words until one line survives.', 'grep -rin "password" .'),
        cmd('Follow the pipe', 'A pipe hands one command\'s output to the next. cut takes a column, sort orders it, uniq -c counts repeats, base64 -d peels an encoding.', 'grep -rin "key" . | cut -d: -f1 | sort -u'),
        cmd('Change the disk safely', 'The sandbox is disposable: touch, mkdir, cp, mv, rm, chmod and tee all really change this fake disk. Break it, then reset and do it cleanly.', 'mkdir -p work && echo test > work/note.txt && cat work/note.txt'),
        cmd('Become root when a door is locked', 'sudo runs the rest of the line as root inside the simulation. It is always allowed here because the machine is fake; ls -l shows what you changed.', 'sudo ls -la /root'),
        cmd('Ask the room for a nudge', 'hint gives one stage at a time. walkthrough is the deliberate full solution; save it for after you have tried.', 'hint')
      ]
    },
    powershell: {
      title: 'PowerShell: objects, not just text',
      intro: 'PowerShell passes objects down the pipeline. Filter first, then choose the properties you want to read.',
      steps: [
        cmd('Orient yourself', 'Get-Location and Get-ChildItem -Force are pwd and ls -la for Windows. -Recurse walks every folder below you.', 'Get-Location; Get-ChildItem -Force'),
        cmd('Find by shape', 'Get-ChildItem -Recurse -File -Filter *.txt finds files by name without reading them. Add -ErrorAction SilentlyContinue when a folder refuses.', 'Get-ChildItem -Recurse -File -Filter *.log'),
        cmd('Read a slice', 'Get-Content reads a file. -TotalCount limits it, -Tail reads the end, and Select-String finds the line you want with its number.', 'Get-Content README.txt -TotalCount 15'),
        cmd('Filter, then choose', 'Where-Object filters objects; Select-Object keeps the columns. That is the whole language in two cmdlets.', 'Get-ChildItem C:\\Users | Where-Object { $_.Name -like "*" } | Select-Object Name, Length'),
        cmd('Count and sort', 'Measure-Object counts and totals; Sort-Object orders. Pipe a listing through both to turn noise into a table.', 'Get-ChildItem -Recurse -File | Measure-Object -Property Length -Sum'),
        cmd('Change the machine', 'New-Item, Copy-Item, Move-Item, Remove-Item and Set-Content all act on this simulated disk. The real PC is never touched.', 'New-Item -ItemType Directory lab; Set-Content lab\\note.txt "hello"; Get-Content lab\\note.txt'),
        cmd('Administrator without asking', 'In this simulation you are already elevated: every local account, service and file is yours. Whoami /priv shows the token you would have.', 'whoami /priv'),
        cmd('Get unstuck in stages', 'hint reveals one nudge at a time; walkthrough is the full answer. Use the second only after the first stops helping.', 'hint')
      ]
    },
    cmd: {
      title: 'Command Prompt: the old faithful',
      intro: 'cmd is terse and literal. Learn the switches once and every Windows machine in the app behaves the same way.',
      steps: [
        cmd('Look around', 'dir lists a folder; /a shows hidden and system names; /s /b prints every path below you without decoration.', 'dir /a'),
        cmd('Read a file', 'type prints a file, more pages it. findstr finds text, /s searches subfolders and /i ignores case.', 'type README.txt'),
        cmd('Search with purpose', 'findstr /s /i /n "word" *.* gives file, line number and line. Narrow the pattern instead of scrolling.', 'findstr /s /i /n "password" *.*'),
        cmd('Copy, move, delete', 'copy, move, ren, del, md and rd are real here, against a fake disk. /y skips the overwrite question.', 'md work && echo test > work\\note.txt && type work\\note.txt'),
        cmd('Ask Windows about itself', 'systeminfo, ipconfig /all, tasklist, netstat -ano and whoami give the machine a history and a network.', 'ipconfig /all'),
        cmd('Elevate', 'runas is simulated: it tells you that elevation would be required, and in this sandbox nothing stops you reading the same file another way.', 'whoami /all'),
        cmd('Get unstuck in stages', 'hint gives one clue per call, never the key. walkthrough spells out the commands, and is meant as a last resort.', 'hint')
      ]
    },
    python: {
      title: 'Python: read it, then let it read for you',
      intro: 'Small scripts beat long commands when the data is a list, a file or a pattern.',
      steps: [
        cmd('Start with values', 'Numbers, strings, lists and dicts print themselves. Try the expression before writing the program.', 'print([x * 2 for x in range(5)])'),
        cmd('Open a file', 'Read the room\'s files from the virtual disk with open(). Split lines before searching them.', 'print(open("README.txt").read()[:200])'),
        cmd('Search without guessing', 'A loop with "in" finds the line that matters and keeps its index for the next step.', 'for i, line in enumerate(open("README.txt")):\n    if "key" in line.lower():\n        print(i, line.strip())'),
        cmd('Decode', 'base64, codecs and bytes handle the encodings this app uses. Decode once per layer.', 'import base64; print(base64.b64decode("SGVsbG8=").decode())'),
        cmd('Ask for a nudge', 'The terminal\'s hint now starts with a riddle and only names a command in its last stages. This workshop is separate: it is for practice and never scores.', 'hint')
      ]
    },
    node: {
      title: 'Node: JavaScript with a filesystem',
      intro: 'The same language as the browser, plus require("fs") to read the room.',
      steps: [
        cmd('Print what you have', 'console.log shows any value, including objects and arrays.', 'console.log({ room: "atlas", files: 12 })'),
        cmd('Read a file', 'fs.readFileSync returns text; split it before filtering.', 'console.log(require("fs").readFileSync("README.txt", "utf8").slice(0, 200))'),
        cmd('Filter lines', 'map, filter and find are the whole search toolkit once the file is an array.', 'require("fs").readFileSync("README.txt", "utf8").split("\\n").filter(l => /key/i.test(l)).forEach(l => console.log(l))'),
        cmd('Decode', 'Buffer.from(text, "base64") reverses a Base64 layer.', 'console.log(Buffer.from("SGVsbG8=", "base64").toString())'),
        cmd('Ask for a nudge', 'hint is staged; read one stage, try it, then ask again.', 'hint')
      ]
    },
    sql: {
      title: 'SQL: ask the table a precise question',
      intro: 'SELECT, WHERE, JOIN, GROUP BY. That is nearly all of it.',
      steps: [
        cmd('See the shape', 'The schema tells you which columns exist and how tables connect.', 'SHOW TABLES;'),
        cmd('Filter rows', 'WHERE narrows before you look; ORDER BY and LIMIT keep the output small.', 'SELECT * FROM accounts LIMIT 5;'),
        cmd('Join the evidence', 'A JOIN answers questions no single table can: who owns what, and when.', 'SELECT a.name, b.total FROM accounts a JOIN orders b ON a.id = b.account_id LIMIT 5;'),
        cmd('Count and group', 'GROUP BY plus COUNT turns thousands of rows into a short answer.', 'SELECT status, COUNT(*) FROM orders GROUP BY status;'),
        cmd('Ask for a nudge', 'hint walks you toward the right table before it names a query.', 'hint')
      ]
    },
    git: {
      title: 'Git: read history like a detective',
      intro: 'The answer is often in a commit nobody meant to keep.',
      steps: [
        cmd('Status first', 'git status separates tracked changes from untracked files.', 'git status'),
        cmd('Read the log', '--oneline is the index; -p shows the actual lines that changed.', 'git log --oneline --all'),
        cmd('Look inside a commit', 'git show prints the message and the diff. Deleted secrets still live in old commits.', 'git show HEAD'),
        cmd('Find the removed line', 'git log -S"word" finds the commit that added or removed a string.', 'git log -S"token" --oneline'),
        cmd('Ask for a nudge', 'hint is staged; walkthrough is the full route through the history.', 'hint')
      ]
    },
    docker: {
      title: 'Docker: containers are folders with opinions',
      intro: 'Images are layers, containers are running copies, and environment variables leak.',
      steps: [
        cmd('See what runs', 'docker ps lists live containers; -a includes the stopped ones nobody cleaned up.', 'docker ps -a'),
        cmd('Read the image', 'docker inspect shows entrypoints, mounts and environment variables.', 'docker inspect web'),
        cmd('Read the logs', 'A container\'s log often names the file or the token you need.', 'docker logs web'),
        cmd('Look at the layers', 'docker history shows what each build step added — including a copied secret.', 'docker history app:1.4'),
        cmd('Ask for a nudge', 'hint starts with the container, then the file.', 'hint')
      ]
    },
    network: {
      title: 'Network: follow the packets',
      intro: 'Addresses, ports and names. Narrow from host to service to payload.',
      steps: [
        cmd('Name the hosts', 'A zone listing maps names to addresses before you touch a service.', 'ls zones/'),
        cmd('Ask which port', 'Ports tell you what to try: 22 ssh, 80/443 web, 445 file sharing, 3389 remote desktop.', 'cat services.txt'),
        cmd('Read the capture', 'A capture is evidence: filter by host or port instead of reading every packet.', 'tcpdump -nn -r capture.pcap'),
        cmd('Resolve the name', 'DNS records often hold the clue everyone forgets to hide.', 'dig api.internal'),
        cmd('Ask for a nudge', 'hint moves from host to service to the line that matters.', 'hint')
      ]
    },
    crypto: {
      title: 'Encoding: peel one layer at a time',
      intro: 'Encoding is not encryption. Recognise the shape, reverse it, repeat.',
      steps: [
        cmd('Recognise the alphabet', 'Base64 uses A–Z a–z 0–9 + / and padding =. Hex uses only 0–9 a–f. ROT13 leaves letters in the same places.', 'file artifact.txt'),
        cmd('Count the layers', 'A decoded layer that still looks encoded needs another pass. The room usually tells you how many.', 'cat artifact.txt'),
        cmd('Decode', 'base64 -d, xxd -r and rot13 are the three workhorses; the app has all of them.', 'base64 -d artifact.b64'),
        cmd('Check your work', 'A readable sentence is the signal to stop. A wrong layer leaves symbols behind.', 'echo SGVsbG8= | base64 -d'),
        cmd('Ask for a nudge', 'hint names the first layer; walkthrough spells out the whole chain.', 'hint')
      ]
    },
    pentest: {
      title: 'Security range: evidence, not exploits',
      intro: 'This range is a fictional company network. Look for the misconfiguration that would matter in a report.',
      steps: [
        cmd('Read the scope', 'targets lists what you are allowed to touch. Everything else is out of scope, even in fiction.', 'targets'),
        cmd('Enumerate before you act', 'A service list is more useful than a guess. Read the version, then the configuration.', 'nmap -sV 10.20.30.0/24'),
        cmd('Follow one thread', 'Pick a single host and go deep: shares, users, notes, logs. Reports are built from one solid finding.', 'smbclient //10.20.30.21/IT -N -c "ls"'),
        cmd('Write the defensive line', 'Every finding needs the fix: patched version, least privilege, rotated credential, removed share.', 'status'),
        cmd('Ask for a nudge', 'hint points at the next service; the objectives panel shows what the range wants.', 'hint')
      ]
    },
    remote: {
      title: 'Remote access: one machine at a time',
      intro: 'A session is someone else\'s desktop. Read the handover notes before changing anything.',
      steps: [
        cmd('See the range', 'hosts lists the machines and the account you can use.', 'hosts'),
        cmd('Open a session', 'ssh puts you on the remote machine; dir/type or ls/cat work there as usual.', 'ssh helpdesk@10.20.30.21'),
        cmd('Read the handover', 'Support notes name the account, the reset password and the machine it works on.', 'type C:\\Users\\Public\\Documents\\handover.txt'),
        cmd('Leave it tidy', 'exit returns you to your own machine. Nothing you did leaves the simulation.', 'exit'),
        cmd('Ask for a nudge', 'hint names the note to read next.', 'hint')
      ]
    }
  };

  const FALLBACK = {
    title: 'Terminal basics',
    intro: 'Every terminal in this app answers help, and every room hides its answer in its own output.',
    steps: [
      cmd('Read the screen', 'The prompt shows where you are. The output of your last command is the best clue for the next one.', 'help'),
      cmd('Try the obvious', 'List the workspace, read the files with promising names, search for the words in the objective.', 'ls -la'),
      cmd('Go stage by stage', 'hint gives one clue at a time; walkthrough is the full solution.', 'hint')
    ]
  };

  function course(shellId) {
    return COURSES[shellId] || FALLBACK;
  }

  /* A challenge (puzzle or Labyrinth room) as a lesson: the staged hints, plus a final verify step. */
  function challenge(target, session) {
    if (!target) return null;
    const stages = window.TerminalHints?.stages ? window.TerminalHints.stages(target) : [];
    const steps = stages.map(stage => ({ title: stage.title, text: stage.text, command: stage.command, hint: true }));
    const solved = !!session?.isSolved?.();
    steps.push({
      title: solved ? 'Already solved' : 'Check your key',
      text: solved ? 'This one is finished. The walkthrough command still lets you read how it was done.'
        : 'When the pieces fit, type solve followed by the key. A wrong key costs nothing; it only resets the streak.',
      command: 'hint'
    });
    return {
      title: target.title || 'Current challenge',
      intro: 'One step at a time. Each step is a nudge, not the answer; the key still has to come from the room.',
      steps
    };
  }

  window.TerminalLearn = { course, challenge, courses: COURSES };
})();

// Terminal playground — written missions for the Help window's playground.
// Each mission: { id, title, category, level, intro, steps: [{ say, command, check, hint }] }.
// `check` is a regular expression the playground's output must match for the step to count as done.
// Steps are read left to right and can be as long or as complex as a real command chain.
(() => {
  const TP = (window.TerminalPlayground = window.TerminalPlayground || {});

  TP.MISSIONS = {
    bash: [
      {
        id: 'look-around', title: 'Find your way around a Linux machine', category: 'Files & folders', level: 1,
        intro: 'You are signed in to a practice Linux box. Learn where you are, what is here, and how to find a file without clicking anything.',
        steps: [
          { say: 'Ask the shell where you are. The answer is your home folder.', command: 'pwd', check: '/home/', hint: 'pwd means "print working directory".' },
          { say: 'List everything in this folder, including hidden files, sizes and permissions.', command: 'ls -la', check: 'total|drwx|\\-rw', hint: '-l is the long form; -a adds the hidden dot files.' },
          { say: 'Find every log file anywhere below this folder, and show only the first few hits.', command: 'find . -name "*.log" | head -5', check: '\\.log', hint: 'The quotes stop the shell from expanding *.log itself.' }
        ]
      },
      {
        id: 'auth-log-hunt', title: 'Read a log like a detective', category: 'Finding text & pipes', level: 2,
        intro: 'A real investigation starts with counting, grouping and sorting. These three commands are the same shape you would use on any server.',
        steps: [
          { say: 'Count how many failed passwords are in the auth log.', command: 'grep -c "Failed password" /var/log/auth.log', check: '\\d+', hint: '-c prints only the count.' },
          { say: 'Show the time and host of each failure, then group identical lines and sort the busiest first.', command: 'grep "Failed password" /var/log/auth.log | cut -d" " -f1-4 | sort | uniq -c | sort -rn | head -5', check: 'dev-box', hint: 'A pipe | passes the answer to the next command.' },
          { say: 'Now a loop: for every .log file, print its name and line count on one line.', command: 'for f in $(find . -name "*.log"); do printf "%s: %s lines\\n" "$f" "$(wc -l < "$f")"; done', check: 'lines', hint: '$( … ) runs the inner command first and puts its answer in place.' }
        ]
      },
      {
        id: 'disk-report', title: 'Build a one-line system report', category: 'System & processes', level: 3,
        intro: 'This is the sort of long command people keep in notes: several tools, one readable answer.',
        steps: [
          { say: 'See how full each disk is.', command: 'df -h | head -3', check: 'Filesystem|\\d+%', hint: '-h means human-readable sizes.' },
          { say: 'Look at the busiest processes.', command: 'ps aux | head -5', check: 'PID|systemd|node', hint: 'aux asks for every process on the machine.' },
          { say: 'Put both together: a labelled report built with printf and command substitution.', command: 'printf "host: %s\\ndisk: %s\\nprocesses: %s\\n" "$(hostname)" "$(df -h / | tail -1 | awk \'{print $5}\')" "$(ps aux | wc -l)"', check: 'host:|disk:|processes:', hint: 'printf fills each %s with the next value in order.' }
        ]
      }
    ],
    powershell: [
      {
        id: 'windows-files', title: 'Tour a Windows profile', category: 'Files & folders', level: 1,
        intro: 'PowerShell names things differently from Bash. These commands show where you are, what your profile holds, and how to shape output.',
        steps: [
          { say: 'Ask where you are.', command: 'Get-Location', check: 'C:\\\\Users', hint: 'The PowerShell cousin of pwd.' },
          { say: 'List the text files in this folder, names only.', command: 'Get-ChildItem -Filter *.txt | Select-Object -ExpandProperty Name', check: '\\.txt', hint: 'Select-Object -ExpandProperty takes one property out of the table.' },
          { say: 'Count everything in the folder, hidden files included.', command: 'Get-ChildItem -Force | Measure-Object', check: 'Count', hint: '-Force is PowerShell\'s -a.' }
        ]
      },
      {
        id: 'powershell-text', title: 'Search text in PowerShell', category: 'Finding text', level: 2,
        intro: 'PowerShell has its own search tools, and they return objects you can measure rather than plain lines.',
        steps: [
          { say: 'Read a file.', command: 'Get-Content notes.txt', check: 'meeting notes', hint: 'Get-Content is cat/type.' },
          { say: 'Find a word in it and count the matches.', command: 'Select-String -Path .\\notes.txt -Pattern "the" | Measure-Object', check: 'Count', hint: 'Select-String is PowerShell\'s grep.' },
          { say: 'Check that a command exists and where it comes from.', command: 'Get-Command Get-ChildItem', check: 'Cmdlet', hint: 'Get-Command is the tool that answers "is this real?".' }
        ]
      }
    ],
    cmd: [
      {
        id: 'command-prompt-tour', title: 'Tour the C: drive', category: 'Files & folders', level: 1,
        intro: 'Command Prompt is the old Windows shell. Short commands, backslash paths, and output you can pipe.',
        steps: [
          { say: 'List the names of everything in this folder.', command: 'dir /b', check: 'notes|Desktop|Documents', hint: '/b is "bare": names only, no dates or sizes.' },
          { say: 'Look inside your Desktop folder.', command: 'dir /b Desktop', check: '.', hint: 'A folder name after dir lists that folder instead.' },
          { say: 'Read a text file.', command: 'type notes.txt', check: 'meeting notes', hint: 'type is Windows\' cat.' }
        ]
      },
      {
        id: 'findstr-mission', title: 'Search with findstr', category: 'Finding text', level: 2,
        intro: 'findstr is the built-in Windows text search. These steps search a file, show line numbers, then count with a second tool.',
        steps: [
          { say: 'Find lines containing "the" and show their line numbers.', command: 'findstr /n "the" notes.txt', check: '1:', hint: '/n adds the line number.' },
          { say: 'Count matching lines by piping into find /c.', command: 'type notes.txt | find /c "the"', check: '\\d+', hint: 'find /c prints a count instead of the lines.' },
          { say: 'Find the rotation note and ignore case.', command: 'findstr /i rotate notes.txt', check: 'rotate', hint: '/i ignores capitals.' }
        ]
      }
    ],
    python: [
      {
        id: 'python-first', title: 'Your first Python lines', category: 'Languages', level: 1,
        intro: 'This is a Python prompt, not a shell. Each line is Python; results print when you ask with print().',
        steps: [
          { say: 'Say hello.', command: 'print("hello from Python")', check: 'hello from Python', hint: 'Quotes make it text.' },
          { say: 'Build a list of the squares of 1 to 10 with one comprehension.', command: 'squares = [n*n for n in range(1, 11)]', check: '\\[1, 4, 9', hint: 'A comprehension makes a whole list in one line.' },
          { say: 'Print the list.', command: 'print(squares)', check: '\\[1, 4, 9', hint: 'Nothing prints until you print it.' }
        ]
      },
      {
        id: 'python-strings', title: 'Shape text in Python', category: 'Languages', level: 2,
        intro: 'Strings, loops and joins are the workhorses of scripting. Keep each line complete; this prompt runs one line at a time.',
        steps: [
          { say: 'Split a sentence into words.', command: 'words = "the quick brown fox".split(" ")', check: '\\[', hint: 'split turns text into a list.' },
          { say: 'Capitalise every word and join them back with dashes.', command: 'print("-".join([w.capitalize() for w in words]))', check: 'The-Quick', hint: 'join puts the list of pieces back together.' },
          { say: 'Count the words.', command: 'print(len(words))', check: '4', hint: 'len counts the items in a list.' }
        ]
      }
    ],
    node: [
      {
        id: 'node-first', title: 'Your first Node lines', category: 'Languages', level: 1,
        intro: 'The Node prompt runs JavaScript. console.log prints; everything else is ordinary JavaScript.',
        steps: [
          { say: 'Print a line.', command: 'console.log("hello from Node")', check: 'hello from Node', hint: 'console.log is print().' },
          { say: 'Save a list of numbers under a name.', command: 'const nums = [3, 1, 4, 1, 5, 9]', check: '\\[', hint: 'const makes a name that will not be reassigned.' },
          { say: 'Sort the numbers, square them, keep the big ones, and print them — all in one line.', command: 'console.log(nums.sort((a, b) => a - b).map(n => n * n).filter(n => n > 10))', check: '\\[', hint: 'sort compares with a function; map changes each item; filter keeps some.' }
        ]
      },
      {
        id: 'node-text', title: 'Text work in Node', category: 'Languages', level: 2,
        intro: 'JavaScript makes short work of words, arrays and objects.',
        steps: [
          { say: 'Turn a sentence into an array of words.', command: 'const words = "the quick brown fox".split(" ")', check: '\\[', hint: 'split is the same idea as in Python.' },
          { say: 'Title-case every word and join with a space.', command: 'console.log(words.map(w => w[0].toUpperCase() + w.slice(1)).join(" "))', check: 'The Quick Brown Fox', hint: 'map plus join, the classic pair.' },
          { say: 'Show the version of Node running here.', command: 'process.version', check: 'v\\d+', hint: 'process is the running program.' }
        ]
      }
    ],
    sql: [
      {
        id: 'sql-first', title: 'Ask a database questions', category: 'Data', level: 1,
        intro: 'SQL is a language of questions. Start by seeing the tables, then read a few rows.',
        steps: [
          { say: 'List the tables.', command: 'SHOW TABLES;', check: 'users|orders|products', hint: 'Every query ends with a semicolon.' },
          { say: 'See the columns of the users table.', command: 'PRAGMA table_info(users);', check: 'name|role', hint: 'PRAGMA describes a table.' },
          { say: 'Read two rows to see real values.', command: 'SELECT * FROM users LIMIT 2;', check: 'maya|dev', hint: 'LIMIT keeps the answer small.' }
        ]
      },
      {
        id: 'sql-join', title: 'Join two tables', category: 'Data', level: 2,
        intro: 'A join puts matching rows from two tables side by side, which is how most real reports are built.',
        steps: [
          { say: 'Count the users with a single aggregate.', command: 'SELECT COUNT(*) AS people FROM users;', check: '\\d+', hint: 'AS names the answer column.' },
          { say: 'Join users to their orders by id.', command: 'SELECT u.name, o.total FROM users u JOIN orders o ON o.user_id = u.id LIMIT 3;', check: 'maya|dev', hint: 'u and o are short names for the tables.' },
          { say: 'Total the money per person, busiest first.', command: 'SELECT u.name, SUM(o.total) AS spent FROM users u JOIN orders o ON o.user_id = u.id GROUP BY u.name ORDER BY spent DESC;', check: 'maya|dev', hint: 'GROUP BY collapses each person into one row.' }
        ]
      }
    ],
    git: [
      {
        id: 'git-first', title: 'Make your first commit', category: 'Version control', level: 1,
        intro: 'A repository remembers snapshots. You stage what you want, then commit it with a message.',
        steps: [
          { say: 'See what is untracked.', command: 'git status', check: 'Untracked|nothing to commit', hint: 'Status tells you what Git sees.' },
          { say: 'Stage the README so the next commit includes it.', command: 'git add README.md', check: '^$|README', hint: 'git add is the "include this" step.' },
          { say: 'Commit it with a clear message.', command: 'git commit -m "first commit"', check: 'first commit', hint: '-m is the message that goes into history.' },
          { say: 'Read the history you just made.', command: 'git log --oneline', check: '[0-9a-f]{6,}', hint: '--oneline gives one line per commit.' }
        ]
      },
      {
        id: 'git-history', title: 'Branch a repository', category: 'Version control', level: 2,
        intro: 'A branch is a movable name for a commit. Make one, then look at how Git marks where you are.',
        steps: [
          { say: 'Check the repository state first.', command: 'git status', check: 'On branch|Untracked|nothing to commit', hint: 'Status is always safe to run.' },
          { say: 'Make a branch called feature.', command: 'git branch feature', check: '^$|feature', hint: 'A branch is a movable name for a commit.' },
          { say: 'List the branches and mark the current one.', command: 'git branch', check: 'feature', hint: 'The star marks where you are.' }
        ]
      }
    ],
    docker: [
      {
        id: 'docker-first', title: 'Look at running containers', category: 'Containers', level: 1,
        intro: 'Docker runs programs in boxes with their own files. These commands show the boxes that already exist here.',
        steps: [
          { say: 'List the running containers.', command: 'docker ps', check: 'CONTAINER|app', hint: 'ps is the container list, like the process list.' },
          { say: 'List the images they were built from.', command: 'docker images', check: 'REPOSITORY|nginx', hint: 'An image is the recipe; a container is a running copy.' },
          { say: 'Run a tiny container that finishes immediately, then removes itself.', command: 'docker run --rm hello-world', check: '[0-9a-f]{6,}|hello', hint: '--rm throws the container away afterwards.' }
        ]
      },
      {
        id: 'docker-inspect', title: 'Inspect and build', category: 'Containers', level: 2,
        intro: 'Containers are ordinary processes with limits and metadata. Inspection is how you learn what one really is.',
        steps: [
          { say: 'Inspect the app container and find its image and state.', command: 'docker inspect app', check: 'app:1.4|running', hint: 'The output is JSON: nested keys in braces.' },
          { say: 'Build an image from the Dockerfile in this folder.', command: 'docker build .', check: 'FINISHED|FROM', hint: 'The dot means "use this folder".' },
          { say: 'See the container\'s log.', command: 'docker logs app', check: '.', hint: 'Logs come from the program inside the box.' }
        ]
      }
    ],
    network: [
      {
        id: 'network-first', title: 'Read the network card', category: 'Network', level: 1,
        intro: 'This is a simulated Linux host on a small network. Addresses, routes and listening ports describe it completely.',
        steps: [
          { say: 'Show the addresses of every network card.', command: 'ip addr', check: 'inet ', hint: 'inet is an IP address.' },
          { say: 'Show which ports are listening.', command: 'ss -tuln', check: 'LISTEN', hint: 'ss replaces the old netstat.' },
          { say: 'Ping the host itself to prove the stack works.', command: 'ping 10.0.0.5', check: 'bytes from', hint: 'Loopback and self-ping never leave the machine.' }
        ]
      },
      {
        id: 'network-route', title: 'Follow a packet out', category: 'Network', level: 2,
        intro: 'Routing decides where a packet goes next. Trace it hop by hop, then look at the routing table that chose the path.',
        steps: [
          { say: 'Show the routing table.', command: 'ip route', check: 'default|dev eth0', hint: 'The default line is the way out.' },
          { say: 'Trace the path to the gateway.', command: 'traceroute 10.0.0.9', check: 'gateway|ms', hint: 'Each line is one hop.' },
          { say: 'Resolve a name to an address.', command: 'nslookup example.internal', check: 'Address|\\d+\\.\\d+', hint: 'DNS turns names into numbers.' }
        ]
      }
    ],
    crypto: [
      {
        id: 'crypto-first', title: 'Encode and hash', category: 'Encoding', level: 1,
        intro: 'Encoding is reversible and keeps data intact; hashing is one-way and proves nothing changed.',
        steps: [
          { say: 'Encode a sentence as base64.', command: 'base64 "attack at dawn"', check: 'YXR0YWNr', hint: 'base64 is not encryption: anyone can decode it.' },
          { say: 'Decode a base64 string.', command: 'base64 -d "aGVsbG8="', check: 'hello', hint: '-d means decode.' },
          { say: 'Hash the same sentence.', command: 'sha256 "attack at dawn"', check: '[0-9a-f]{32,}', hint: 'The same input always gives the same hash.' }
        ]
      },
      {
        id: 'crypto-check', title: 'Prove a file did not change', category: 'Encoding', level: 2,
        intro: 'Hashes are how downloads and evidence are checked. A single changed character changes the whole hash.',
        steps: [
          { say: 'Hash one word and remember the first characters.', command: 'sha256 "password"', check: '[0-9a-f]{32,}', hint: 'Hashes are hexadecimal text.' },
          { say: 'Hash a slightly different word.', command: 'sha256 "Password"', check: '[0-9a-f]{32,}', hint: 'Case matters.' },
          { say: 'Decode the base64 of "password" (cGFzc3dvcmQ=) and prove encoding is reversible.', command: 'base64 -d "cGFzc3dvcmQ="', check: 'password', hint: 'Anyone can decode base64, so it hides nothing.' }
        ]
      }
    ]
  };
})();

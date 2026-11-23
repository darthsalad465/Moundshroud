// Short, safe first examples for the terminal manual. Detailed reference pages are stored separately.
(() => {
  const pages = {};
  const add = (shell, command, title, meaning, example, result, steps = [], options = {}) => {
    (pages[shell] ||= {})[command] = { title, meaning, example, result, steps, options };
  };

  add('bash', 'ls', 'Show my files', 'See the files and folders in the place you are looking at right now.',
    'ls', 'You get a list of names. An empty folder may show a blank line.', [], {
      '-a': 'Show hidden names too. Hidden names start with a dot.', '-l': 'Show more about each file, like who can read it.', '-la': 'Show hidden names with the extra details.'
    });
  add('bash', 'pwd', 'Where am I?', 'Show the name and location of the folder you are in now.',
    'pwd', 'You see a path such as /home/dev. Each slash separates one folder name from the next.');
  add('bash', 'cd', 'Go to another folder', 'Move to a different folder so the next command starts there.',
    'cd ..', 'You move up one folder. Type pwd to see where you are now.', [['cd', 'Move to a folder.'], ['..', 'Go up one folder.']], {
      '..': 'Go up one folder.', '~': 'Go to your home folder.', '-': 'Go back to the folder you were in before.'
    });
  add('bash', 'grep', 'Find a word', 'Look through lines of text. Show the lines with the word you asked for.',
    'echo Apple | grep -in apple', 'You see 1:Apple.', [
      ['echo Apple', 'Make one line of text with the word Apple.'],
      ['|', 'Pass that line to the next command.'],
      ['grep -in apple', 'Find apple, ignore capital letters, and write the line number.']
    ], {
      '-i': 'Ignore differences between capital and small letters. Apple and apple both match.',
      '-n': 'Show the original line number. The first line is line 1.',
      '-v': 'Show the lines that do not match.', '-c': 'Count the matching lines.',
      '-r, -R': 'Look inside the smaller folders too.', '-H': 'Show the file name next to a match.',
      '-o': 'Show only the part that matched.', '-q': 'Keep the screen quiet. The exit code tells you if there was a match.',
      '-l': 'Show the names of files that have a match.', '-F': 'In GNU grep, read the pattern as plain text.'
    });
  add('bash', 'echo', 'Show a message', 'Write the words you give the terminal.',
    'echo hello', 'You see hello.', [['echo', 'Show the words that follow.'], ['hello', 'The words to show.']], {
      '-n': 'Keep the cursor on the same line after the words.', '-e': 'Read marks like \\n as a new line.', '-E': 'Show marks like \\n as written.'
    });
  add('bash', 'cat', 'Read a file', 'Show the words inside a file. Pick a file name from ls first.', '', '', [],
    { '-n': 'Show a number next to every line.', '-b': 'Add numbers to lines with text.', '-E': 'Show a dollar sign where a line ends.' });
  add('bash', 'chmod', 'Choose who can read a file', 'Change what people can do with a file, like read it or change it.', '', '', [],
    { 'u+r': 'Let the owner read the file. u means owner, + means add, and r means read.' });
  add('bash', 'pipes & chaining', 'Send words to another command', 'A pipe takes the words from one command and gives them to the next one.',
    'echo apple | wc -w', 'The answer is 1 because there is one word.',
    [['echo apple', 'Make a line with one word.'], ['|', 'Send the line to wc.'], ['wc -w', 'Count the words.']]);

  add('powershell', 'get-childitem', 'Show my files', 'See the names of the files and folders where you are now.', 'Get-ChildItem',
    'You get a list of files and folders.', [], { '-Force': 'Show hidden names too.', '-Recurse': 'Look inside smaller folders too.' });
  add('powershell', 'get-location', 'Where am I?', 'Show the path to the folder you are in.', 'Get-Location', 'You see a folder path, such as C:\\Users\\solver.');
  add('powershell', 'select-string', 'Find a word', 'Show lines that match the word you give it.', '', '', [],
    { '-Pattern PATTERN': 'Give it a word or pattern to find.', '-Path PATH': 'Tell it which file to read.' });
  add('powershell', 'get-content', 'Read a file', 'Show what is written inside a file. Pick a file name from Get-ChildItem first.');

  add('cmd', 'dir', 'Show my files', 'See the files and folders where you are now.', 'dir', 'You get a list of names.', [],
    { '/a': 'Show hidden names too.', '/s': 'Look inside smaller folders too.', '/b': 'Show just the list of names.' });
  add('cmd', 'cd', 'Where am I?', 'See where you are now. Give cd a folder name when you want to move there.', 'cd', 'You see the path to your folder.');
  add('cmd', 'findstr', 'Find a word', 'Show lines with the word you asked for.', '', '', [],
    { '/i': 'Ignore capital letters in Windows FINDSTR.', '/n': 'Show line numbers.' });
  add('cmd', 'type', 'Read a file', 'Show what is written inside a file. Pick a file name from dir first.');

  add('python', 'print', 'Show a message', 'Ask Python to show you some text or a number.', 'print("hello")', 'You see hello.',
    [['print', 'Show something on the screen.'], ['"hello"', 'The quote marks tell Python this is a piece of text.']]);
  add('python', 'len', 'Count the letters', 'Find out how many letters or items are in something.', 'len("cat")', 'You see 3.');
  add('python', 'sum', 'Add some numbers', 'Add all the numbers in a list.', 'sum([1, 2, 3])', 'You see 6.');

  add('node', 'expressions', 'Add some numbers', 'Type a little math problem and let JavaScript work it out.', '2 + 2', 'You see 4.');
  add('node', 'console.log', 'Show a message', 'Ask JavaScript to write a message to the terminal.', 'console.log("hello")', 'You see hello.',
    [['console.log', 'Show a message.'], ['"hello"', 'The quote marks tell JavaScript these are words.']]);
  pages.node['console.log'].sandboxOnly = true;
  add('node', 'buffer.from', 'Read encoded text', 'Turn letters into bytes, then show those bytes as readable text.');

  add('sql', 'show tables', 'See the tables', 'Look at the names of the tables you can read.', 'SHOW TABLES;', 'You see table names. Pick one to use with SELECT.');
  add('sql', 'select', 'Read from a table', 'Pick the columns you want to see. A table holds information in rows and columns.',
    '', '', [], { 'WHERE': 'Keep only rows that pass your check.', 'LIMIT N': 'Show up to this many rows.', 'ORDER BY': 'Choose the order of the rows.' });
  add('sql', 'where', 'Pick rows that match', 'Keep the rows that pass a check, like a name matching the one you asked for.');
  add('sql', 'order by', 'Put rows in order', 'Sort the rows using one column, such as a name or a number.', '', '', [],
    { 'ASC': 'Go from small to big, or A to Z.', 'DESC': 'Go from big to small, or Z to A.' });

  add('git', 'git status', 'See what changed', 'Check your work and see which changes are ready to save.', 'git status',
    'Git describes the current work when a project is open.');
  add('git', 'git log', 'See what was saved', 'Read the list of changes that have already been saved in Git.', 'git log --oneline',
    'You get one short line per saved change, if the project has any.', [], { '--oneline': 'Show one short line for each saved change.' });

  add('docker', 'docker ps', 'See what is running', 'Look for containers. A container is a small space where an app can run.',
    'docker ps -a', 'You see containers in this playground. Some may be stopped.', [], { '-a': 'Show stopped containers as well as running ones.' });
  add('docker', 'docker logs', 'Read an app’s messages', 'See what a container has written. Pick a container name from docker ps -a first.');

  add('network', 'dig', 'Look up an address', 'A name can point to a number called an IP address. Look it up using the playground’s pretend network.',
    'dig api.internal', 'You see what this pretend network knows about the name. The name may be missing in your puzzle.',
    [], { '+short': 'Show a short answer with less extra text.' });
  add('network', 'ping', 'Check for a reply', 'Ask a computer in the playground’s pretend network to send back a short reply.');

  add('crypto', 'base64', 'Change how words are written', 'Write text using a different set of letters. You can change it back.', 'base64 hello',
    'You see aGVsbG8=, which is hello written in Base64.', [], { '-d': 'Change Base64 text back to the original text.' });
  add('crypto', 'hex', 'Read a hex message', 'Hex uses two marks to write each byte. Here you can change hex back to text.', 'hex -d 6869',
    'You see hi.', [], { '-d': 'Change hex back to plain text.' });
  add('crypto', 'rot13', 'Turn letters around', 'Move each letter 13 places. Do it twice and you get the first message back.', 'rot13 uryyb', 'You see hello.');

  window.TerminalPlayground.manualBeginner = pages;
})();

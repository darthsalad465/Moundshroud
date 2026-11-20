// Hidden interactions and a shared discovery journal for Terminal Playground.
(() => {
  const TP = window.TerminalPlayground;
  const byShell = {
    bash: [
      ['fortune', 'The fortune printer', 'Ask the shell to print your fortune.', 'A watched loop never exits. Add a break.'],
      ['cowsay moon', 'The lunar cow', 'Ask cowsay about the moon.', ' ______\n< moon >\n ------\n     \\  ^__^\n        (oo)\\_______\n        (__)\\       )\\/\\\n            ||----w |\n            ||     ||'],
      ['sl', 'The reversing locomotive', 'Transpose the two letters in the Unix listing command.', '      ___     _______\n  ___|___|___|_MAIL__|\n  O--O--O--O   o---o\nA mail train backs through the prompt.'],
      ['man moth', 'The moth manual', 'Even the moth has a manual page.', 'MOTH(7)\nNAME     moth — reader of illuminated terminals\nFILES    any page with a light background\nBUGS     one, by definition']
    ],
    powershell: [
      ['Get-MoonPhase', 'The moon object', 'Try a Get verb on the current phase of the moon.', 'Phase      Illumination\n-----      ------------\nWaning     12%\nThe remaining light is reserved for night shifts.'],
      ['Get-Ghost', 'A ghost in the pipeline', 'Use a Get verb to look for a ghost.', 'Name      Status\n----      ------\nCasper    WaitingForInput'],
      ['Get-Tea', 'The hotfix', 'Use a Get verb on a cup of tea.', 'Temperature : 84 C\nStatus      : Steeping\nHotfix      : Available in four minutes'],
      ['Measure-Dragon', 'Dragon metrics', 'PowerShell can Measure a dragon, from a distance.', 'Count    : 1\nLength   : 26 m\nWarning  : The object is measuring you back.']
    ],
    cmd: [
      ['dir /moon', 'Lunar directory', 'Try a directory listing with the /moon switch.', ' Volume in drive L is MARE\n Directory of L:\\TRANQUILLITY\n\n       1,969 BOOTS.TXT\n          42 FLAG.POLE\n             0 Bytes free'],
      ['ver /ancient', 'Museum build', 'Ask ver for the ancient edition.', 'Microsoft Marble Slab [Version 0.0.7]\nInsert the second stone tablet to continue.'],
      ['tree /haunted', 'The haunted tree', 'The tree command has a haunted switch.', 'C:\\ATTIC\n└───PORTRAITS\n    └───THE_ONE_THAT_FOLLOWS_YOU'],
      ['bell', 'The office bell', 'Try naming the object that rings at reception.', '*ding*\nThe receptionist is a dot-matrix printer.']
    ],
    python: [
      ['import moth', 'The moth module', 'Try importing a night-flying insect.', 'moth 0.1\nThe lamp is part of the standard library now.'],
      ['import teapot', 'Short and stout', 'Try importing the vessel used to pour tea.', 'teapot.Error: cannot pour before steeping'],
      ['moth.migrate()', 'Seasonal migration', 'Ask the moth to migrate with a method call.', 'lamp → porch → streetlight → terminal\nThe moth has logged 3.2 lumens of travel.'],
      ['help("raven")', 'The raven help page', 'Call help on the word “raven”.', 'Help on raven:\n  speak() → “read the docs”\n  shiny_things → iterable, never exhausted']
    ],
    node: [
      ['require("moon-dust")', 'A lunar dependency', 'Require a package named moon-dust.', '{ samples: 3, origin: "Mare Tranquillitatis", vacuumSealed: true }'],
      ['.raccoon', 'The late-night maintainer', 'A raccoon might live among Node’s dot commands.', '  /\\_/\\\n ( o.o )   npm audit frank\n  > ^ <    0 unsecured trash cans'],
      ['require("tiny-orchestra")', 'The tiny orchestra', 'Require the package tiny-orchestra.', '{ instruments: ["triangle", "tuba", "triangle"], tuning: "pending" }'],
      ['.callback', 'A missed call', 'A dot command might call you back.', 'Beep. Leave a message at the end of the event loop.']
    ],
    sql: [
      ['curio SELECT * FROM lost_socks;', 'The lost laundry index', 'Prefix a query of the lost_socks table with curio.', 'pair_id | location\n--------+----------------\n      7 | behind dryer\n      9 | unknown\n(2 rows)'],
      ['curio SELECT * FROM ghosts;', 'Committed ghosts', 'Prefix a query of the ghosts table with curio.', 'name    | transaction_state\n--------+------------------\nMyrtle  | committed\n(1 row)'],
      ['curio SELECT COUNT(*) FROM moons;', 'The sky census', 'Prefix a count of the moons table with curio.', 'count\n-----\n    1\n(1 row)'],
      ['curio SELECT * FROM forgotten_migrations;', 'Migration archaeology', 'Prefix a query of forgotten_migrations with curio.', 'id | description\n---+----------------------\n 1 | add drawer for cables\n 2 | drawer at capacity\n(2 rows)']
    ],
    git: [
      ['curio git blame the-moon', 'Lunar blame', 'Prefix git blame on the-moon with curio.', '1969abcd (Moon   1969-07-20 1) Left bootprints.'],
      ['git stash list --attic', 'The attic stash', 'Ask the stash list to check the attic.', 'stash@{attic}: WIP on home: boxed cables from three moves ago'],
      ['git reflog --afterlife', 'The afterlife reflog', 'Ask the reflog for entries from the afterlife.', 'deadbee HEAD@{afterlife}: checkout: moving from mortal to immortal'],
      ['curio git show first-light', 'The first-light tag', 'Prefix a git show for first-light with curio.', 'tag first-light\n\n    Let there be a readable diff.']
    ],
    docker: [
      ['curio docker inspect moonbase', 'Moonbase manifest', 'Prefix docker inspect on moonbase with curio.', '[{"Name":"/moonbase","State":{"Status":"hibernating"},"Oxygen":"nominal"}]'],
      ['curio docker logs cardboard-box', 'Cardboard logs', 'Check the docker logs of cardboard-box with a curio prefix.', '00:00:00 received one cat\n00:00:01 container deemed too small\n00:00:02 cat enters anyway'],
      ['docker stats --aquarium', 'Aquarium telemetry', 'The stats command has an aquarium switch.', 'NAME     BUBBLES/s  FISH\nreef-1   3          7\nreef-2   8          2'],
      ['docker compose ps --orchestra', 'Orchestration', 'Try the orchestra switch on docker compose ps.', 'NAME      SERVICE   STATUS\nbass-1    bass      Up\ntuba-1    brass     Paused for breath']
    ],
    network: [
      ['ping moon.test', 'Lunar latency', 'Ping the simulated moon.test address.', '64 bytes from moon.test: icmp_seq=1 ttl=42 time=2564 ms\nThe reply accrued 1,280 ms of moonlight each way.'],
      ['dig pantry.test TXT', 'Pantry TXT record', 'Ask dig for the TXT record at pantry.test.', 'pantry.test. 60 IN TXT "Emergency biscuits: third shelf"'],
      ['traceroute nowhere.test', 'A route to nowhere', 'Trace the route to nowhere.test.', ' 1  here.test     0.1 ms\n 2  somewhere.test 2.4 ms\n 3  nowhere.test   4.2 ms\nDestination reached, technically.'],
      ['host lighthouse.test', 'The lighthouse', 'Look up lighthouse.test with host.', 'lighthouse.test has address 192.0.2.88\nThe beacon blinks twice.']
    ],
    crypto: [
      ['curio rot13 fubegphg', 'The shortcut', 'Prefix the ROT13 decoding of fubegphg with curio.', 'shortcut\nA hidden latch clicks behind the decoder.'],
      ['cipher wheel', 'The pocket wheel', 'Ask for the cipher wheel.', 'ABCDEFGHIJKLMNOPQRSTUVWXYZ\nNOPQRSTUVWXYZABCDEFGHIJKLM\nThe wheel stops halfway round.'],
      ['decode starlight', 'Starlight decoder', 'Try to decode starlight.', 'Decoded: four white stars, one red star, one aircraft.'],
      ['curio hex moonstone', 'Moonstone sample', 'Prefix the hex encoding of moonstone with curio.', '6d6f6f6e73746f6e65\nA tiny moonstone falls out of the hex tray.']
    ]
  };

  const byMode = {
    sandbox: [
      ['coffee break', 'The break room', 'Try announcing a coffee break.', 'An amber lamp comes on above a fresh pot. The terminal will be here when you get back.'],
      ['open drawer', 'The stuck drawer', 'Some desks have a drawer you can open.', 'You find a blunt pencil, a paper moon, and a key to a desk two rooms over.'],
      ['turn page', 'The field notebook', 'Try turning the page in the field notebook.', '“More terminals than yesterday. Fewer spare cables than ever.”']
    ],
    lab: [
      ['listen wall', 'The listening wall', 'In the Labyrinth, listen to the wall.', 'Something on the other side hums in 7/8 time.'],
      ['light lantern', 'The spare lantern', 'Try lighting a lantern in the descent.', 'The lantern lights. A chalk arrow points back toward the stairs.'],
      ['knock twice', 'The other stairwell', 'Try two knocks in the Labyrinth.', 'Knock. Knock.\nThree knocks answer from below.']
    ],
    puzzle: [
      ['check margins', 'Marginalia', 'In Puzzle Studio, check the margins.', 'In tiny pencil: “The best clues fit on one line. This one does, too.”'],
      ['fold paper', 'The paper boat', 'Try folding the paper in Puzzle Studio.', '       /\\\n  ____/  \\____\n  \\          /\n   \\________/\nA paper boat sails across the prompt.'],
      ['sharpen pencil', 'Workshop shavings', 'A pencil in Puzzle Studio needs sharpening.', 'Under the shavings is a label marked “spare question mark”.']
    ]
  };

  const common = [
    ['hello moth', 'An introduction', 'Greet the moth.', 'The moth lands on the Enter key, then politely moves aside.'],
    ['press tiny button', 'The tiny button', 'The tiny button will do something when pressed.', '*click*\nA smaller button slides out.'],
    ['look behind prompt', 'Behind the prompt', 'Have you looked behind the prompt?', 'A spool of green text feeds through a hole in the floor.'],
    // About Moundshroud itself.
    ['moundshroud', 'The name on the door', 'Type the name of the app you are in.',
      ' __  __                       _     _                         _\n|  \\/  | ___  _   _ _ __   __| |___| |__  _ __ ___  _   _  __| |\n| |\\/| |/ _ \\| | | | \'_ \\ / _` / __| \'_ \\| \'__/ _ \\| | | |/ _` |\n| |  | | (_) | |_| | | | | (_| \\__ \\ | | | | | (_) | |_| | (_| |\n|_|  |_|\\___/ \\__,_|_| |_|\\__,_|___/_| |_|_|  \\___/ \\__,_|\\__,_|\nAn offline assistant. Everything you type here stays on this PC.'],
    ['atlas', 'The old name', 'Say the name this app had before it was Moundshroud.', 'Atlas? That was my name before the mound grew over it. Old notes still call me that.'],
    ['ctrl alt a', 'The summoning keys', 'Name the three keys that wake the app from anywhere.', 'Ctrl+Alt+A wakes Moundshroud and brings it to the front, even after the window was closed.'],
    ['whoami --really', 'The only user', 'Ask whoami who you really are.', 'You are the only person here. No account, no cloud, no telemetry: this PC and you.'],
    ['ping moundshroud', 'Is anybody home', 'Ping the app by name.', 'PING moundshroud (127.0.0.1): answered from inside the house.\nThe server dozes off when no page has pinged it for three minutes.'],
    ['sudo make me a sandwich', 'Magic word', 'Ask sudo to make you a sandwich.', 'Okay.\nA sandwich appears in the Today tab, next to the weather.'],
    ['checkmate', 'Twenty-one rivals', 'Say the word that ends a chess game.', 'The Chess hub has 21 bots, one for every 100 Elo from 400 to 2400. The 2400 one never gets tired.'],
    ['thanks moundshroud', 'Good manners', 'Thank the app by name.', 'You are welcome. Not one word of that left this PC.'],
    // Sleepy Hollow and the Headless Horseman (Washington Irving, 1820).
    ['headless horseman', 'The Hessian trooper', 'Name the rider who lost his head.',
      '        ,~~.\n       (  ~ )>   the rider of Sleepy Hollow\n   ____/|  |\\____\n  /    \\|__|/    \\\n  hoofbeats on the church bridge, every night since a cannonball took his head'],
    ['ichabod', 'The schoolmaster', 'Say the first name of the Sleepy Hollow schoolmaster.', 'Ichabod Crane: lanky schoolmaster, singing teacher, believer in every ghost story told by the fire.\nLast seen riding home from the Van Tassel party.'],
    ['cross the bridge', 'The church bridge', 'Try crossing the bridge Ichabod raced for.', 'Hoofbeats behind you. You reach the bridge by the old Dutch church.\nThe story says the Horseman stops here. Do not look back.'],
    ['pumpkin', 'The morning after', 'Name what was found smashed beside Ichabod\'s hat.',
      '     ,\n  .-\'\\\'-.\n /  ^ ^  \\\n|  \\___/  |\n \\_______/\nA shattered pumpkin lay beside a hat by the brook the next morning.'],
    ['find head', 'Still searching', 'Use find to look for a head.', "find: 'head': No such file or directory\nThe Horseman has been running this search since 1776."],
    ['cd /sleepy-hollow', 'The closed road', 'Try changing into the sleepy-hollow directory.', 'cd: /sleepy-hollow: the road through the hollow is closed after dark'],
    ['brom bones', 'The suspicious laugh', 'Name Ichabod\'s rival.', 'Brom Van Brunt laughs a little too hard whenever someone mentions a pumpkin.'],
    ['katrina', 'The farmer\'s daughter', 'Name the woman Ichabod hoped to marry.', 'Katrina Van Tassel, only child of the richest farmer in the valley. Ichabod was mostly in love with the orchards.'],
    ['gunpowder', 'A tired horse', 'Name the plow horse Ichabod borrowed.', 'Gunpowder: old, half blind, and still faster than he looked when the hoofbeats started.'],
    ['tarrytown', 'The market town', 'Name the town on the Hudson next to Sleepy Hollow.', 'Tarry Town, on the Hudson: named, the story says, for husbands who tarried at the tavern on market days.']
  ];
  const entries = (scope, list) => list.map(([command, title, clue, text], index) => ({
    id: scope + ':' + index, command: normalize(command), title, clue, text
  }));
  function normalize(command) { return command.trim().replace(/\s+/g, ' ').toLowerCase().replace(/;$/, '').trimEnd(); }
  const shells = Object.fromEntries(Object.entries(byShell).map(([scope, list]) => [scope, entries(scope, list)]));
  const modes = Object.fromEntries(Object.entries(byMode).map(([scope, list]) => [scope, entries(scope, list)]));
  const shared = entries('common', common);
  const catalog = [...shared, ...Object.values(shells).flat(), ...Object.values(modes).flat()];
  let found;

  function journal() {
    if (found) return found;
    found = new Set();
    try {
      const saved = JSON.parse(localStorage.getItem('tpg_curios'));
      if (Array.isArray(saved)) for (const id of saved) if (catalog.some(item => item.id === id)) found.add(id);
    } catch (e) { /* Start with an empty journal if storage is unavailable. */ }
    return found;
  }

  function run(line, mode, shell) {
    const command = normalize(line);
    const available = [...(shells[shell] || []), ...(modes[mode] || []), ...shared];
    const match = available.find(item => item.command === command);
    if (!match && !['curios', 'curio hint'].includes(command)) return null;
    const discoveries = journal();
    if (command === 'curios') {
      const titles = catalog.filter(item => discoveries.has(item.id)).map(item => '  · ' + item.title);
      return `Curio journal · ${titles.length}/${catalog.length} discovered\n` + (titles.length ? titles.join('\n') + '\n' : '') +
        'Type curio hint for a clue about something hidden here.';
    }
    if (command === 'curio hint') {
      const next = available.find(item => !discoveries.has(item.id));
      return next ? next.clue : 'You found every curio available here. Try another shell or mode.';
    }
    if (discoveries.has(match.id)) return match.text;
    discoveries.add(match.id);
    try { localStorage.setItem('tpg_curios', JSON.stringify([...discoveries])); } catch (e) { /* Keep discoveries in memory. */ }
    return `${match.text}\n\n✦ Discovered: ${match.title} (${discoveries.size}/${catalog.length})`;
  }

  TP.curios = { run };
})();

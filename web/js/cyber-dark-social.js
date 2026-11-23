/* The Fake Dark Web's social half: a blog for every subject and Introspace, the board the network argues on.
   Everything here is generated locally from the address, so a page is stable across reloads and nothing is fetched.
   Nothing in this file talks to the DOM at load time: tests load it in a plain vm context. */
(function () {
  const esc = s => String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const hash = s => { let h = 2166136261 >>> 0; for (const c of String(s)) { h ^= c.charCodeAt(0); h = Math.imul(h, 16777619) >>> 0; } return h >>> 0; };
  const at = (list, b) => list[b % list.length];
  const num = n => Number(n).toLocaleString('en-US');
  const vote = n => (n >= 1000 ? (n / 1000).toFixed(1).replace(/\.0$/, '') + 'k' : String(n));

  /* ================================================================ blogs ================================================================ */
  /* Twelve blogs, each with its own subject and voice. A post body is two of that blog's paragraphs plus one closing line, chosen by title,
     so the same address always says the same thing. */
  const BLOGS = [
    {
      name: 'Onion Journal', icon: '📔', about: 'A daily log kept by an operator who runs three mirrors and one very old machine.',
      posts: [
        ['The mirror list is the product', '2024-11-18', ['mirrors', 'ops']],
        ['Ninety-one days of uptime, and what it cost', '2024-11-09', ['ops']],
        ['A dead service is not always a seized service', '2024-10-27', ['mirrors']],
        ['Writing a page that loads over a bad circuit', '2024-10-12', ['web']],
        ['Why I still keep a plain-text index', '2024-09-30', ['index']],
        ['The clone problem, from the other side', '2024-09-14', ['clones']]
      ],
      paras: [
        'Every directory that lasts is really a mirror list with an opinion. The links rot at different speeds, and the only useful thing you can publish is which one answered this morning.',
        'My machine is a decade-old tower in a room that is too warm. The uptime counter is not a boast: it is the only number on the page nobody has ever asked me to fake.',
        'A seizure is loud. It leaves a banner, a press release, and a domain that resolves to a warning. An exit scam is quiet: the page just keeps answering, and the deposits keep arriving.',
        'I test the front page on a throttled link, because the network is a throttled link. Anything that needs a second of javascript to be readable is not a page, it is a request for trust.',
        'The plain-text index is forty kilobytes and outlives every framework I have ever installed. It also diffs cleanly, which matters more than anyone admits until the day it does.'
      ],
      closers: ['That is the whole entry. The machine is still warm.', 'Filed under things I will have to fix again next month.', 'No links this time, on purpose.']
    },
    {
      name: 'The Dead Air', icon: '📻', about: 'Shortwave, numbers stations, antennas and the sound of a band nobody is supposed to use.',
      posts: [
        ['Nine years of the same voice, one recording', '2024-11-15', ['numbers', 'radio']],
        ['A wire in a tree is a better antenna than the one you bought', '2024-11-02', ['antennas']],
        ['What a fading signal tells you about the ionosphere', '2024-10-21', ['propagation']],
        ['The station that reads numbers in a language nobody claims', '2024-10-05', ['numbers']],
        ['Recording a broadcast that only happens at 03:40', '2024-09-19', ['radio']],
        ['Why shortwave refuses to die', '2024-09-01', ['radio']]
      ],
      paras: [
        'The voice is always the same: five groups, a pause, five groups, then the carrier drops. Nine years of recordings and the schedule has moved twice, both times by four minutes.',
        'A long wire, a balun and a good ground will beat anything with a plug on it. The trick is height and distance from the house, in that order, and neither one costs money.',
        'Propagation is the only part of radio that is genuinely unpredictable. The same frequency is a wall at noon and a window at three in the morning, and the difference is a layer of charged air ninety kilometres up.',
        'Numbers stations are cheap to run and impossible to switch off cleanly, because the people listening are not the people being addressed. That is the entire design.',
        'You can hear the transmitter warming up before the first group. It is a hiss with a shape to it, and if you know the shape you can start the recorder early and catch the whole thing.'
      ],
      closers: ['Recorded at 03:41, 14.670 MHz, nothing decoded.', 'The audio is on the archive page, watermarked and checked.', 'If you know the language, you know more than I do.']
    },
    {
      name: 'Hollow Notes', icon: '🕯', about: 'Long essays about privacy, trust and what a network does to the people on it.',
      posts: [
        ['Privacy is the right to be uninteresting', '2024-11-11', ['essay', 'privacy']],
        ['Escrow is a belief system with better bookkeeping', '2024-10-29', ['essay', 'trust']],
        ['On publishing a dump that contains a nurse', '2024-10-16', ['essay', 'ethics']],
        ['The directory as a historical document', '2024-10-01', ['essay']],
        ['What anonymity costs the person who keeps it', '2024-09-12', ['essay']],
        ['Nobody wants to be a cautionary tale', '2024-08-28', ['essay']]
      ],
      paras: [
        'Secrecy is about hiding a thing. Privacy is about being able to be boring in public, which is a much larger and much more fragile right, and it is the one that actually keeps people safe.',
        'Every escrow is a promise with a ledger attached. The ledger makes the promise expensive to break, and expensive is the closest thing to trustworthy that a stranger can offer.',
        'A dump is not a document, it is a crowd. Somewhere in the crowd is a person who did nothing except work at the wrong company, and the ethics start exactly there.',
        'Read the wiki in twenty years and you will see what a generation thought was worth listing: markets, mail, mirrors, and a category for tools that no longer exist.',
        'Anonymity is not free for the person holding it. It costs you the ability to be believed about your own life, and most people discover that after the first time they need to be.'
      ],
      closers: ['Written slowly, and not corrected.', 'No conclusion, only a position.', 'The comments are better than this post, as usual.']
    },
    {
      name: 'Rust Press', icon: '🔧', about: 'Repair, salvage and the politics of a machine you can open.',
      posts: [
        ['The laptop that survived a spill and a decade', '2024-11-13', ['repair']],
        ['Everything is a power supply problem', '2024-10-31', ['hardware']],
        ['Salvaging a 2011 thinkpad for parts that still matter', '2024-10-18', ['salvage']],
        ['Why screws are a political statement', '2024-10-03', ['repair', 'essay']],
        ['Soldering iron, ten dollars, forty years', '2024-09-21', ['tools']],
        ['The capacitor you cannot buy any more', '2024-09-05', ['hardware']]
      ],
      paras: [
        'Nine out of ten dead machines are a connector, a capacitor or a cable, in that order. The tenth is a person who spilled coffee and then kept typing, which is a kind of courage.',
        'A repairable machine is one where the screws are the same size, the battery is a part number rather than a glue joint, and the service manual exists outside a lawyer\u2019s office.',
        'Old hardware is not nostalgia. It is a supply of parts that were built to a tolerance nobody bothers with now, in a market where the only thing that gets thinner is the margin.',
        'A soldering iron that costs ten dollars and works for forty years is the best argument against consumer electronics I know, and it fits in a drawer.',
        'The capacitor has a part number, a tolerance and a temperature rating. What it does not have is a supplier, because the line closed in 2013 and the replacement is a different shape.'
      ],
      closers: ['Bench is clear, iron is cold.', 'Pictures when the light is better.', 'If you have a spare, you know where to find me.']
    },
    {
      name: 'Terminal Diary', icon: '💻', about: 'A working notebook: shell, scripts, and the bugs that only appear at 3 a.m.',
      posts: [
        ['A static site generator in ninety lines', '2024-11-17', ['code', 'web']],
        ['The bug was a newline, again', '2024-11-04', ['debugging']],
        ['Stop writing config formats nobody can diff', '2024-10-24', ['opinion']],
        ['One script, no dependencies, no regrets', '2024-10-09', ['code']],
        ['Reading a stack trace like a map', '2024-09-26', ['debugging']],
        ['Your build is slow because you asked it to be', '2024-09-08', ['build']]
      ],
      paras: [
        'Ninety lines: walk a directory, read a header block, render a template, write a file. No cache, no incremental build, no plugin API, and it finishes before the terminal redraws.',
        'The newline came from a Windows editor, survived three tools, and only broke when the output was piped into something that cared about the last byte. It always is the last byte.',
        'A config format that cannot be diffed is a config format that will be edited by hand at two in the morning and committed with a message that says \u201cfix\u201d.',
        'The stack trace is not noise, it is a route. Read it from the bottom, find the first frame you wrote, and ignore everything above it until you have read that one line twice.'
      ],
      closers: ['Code is in the paste, no licence, no warranty.', 'Reproduce it twice and it is a bug; once and it is a rumour.', 'The next entry will be about the same bug.']
    },
    {
      name: 'Signal & Noise', icon: '📡', about: 'Surveillance, policy and the gap between what is legal and what is done.',
      posts: [
        ['The order that nobody had to publish', '2024-11-16', ['surveillance']],
        ['Metadata is the story, not the content', '2024-11-01', ['metadata']],
        ['A warrant canary that stopped singing', '2024-10-19', ['policy']],
        ['What a transparency report actually reports', '2024-10-06', ['policy']],
        ['The cost of a backdoor is paid by everyone else', '2024-09-23', ['crypto']],
        ['Reading the oversight report nobody read', '2024-09-04', ['oversight']]
      ],
      paras: [
        'The interesting part of a surveillance programme is rarely the collection. It is the paperwork that decides who may look, and how long the looking is kept.',
        'A call record knows who, when, for how long and from where. That is a biography with the sentences removed, and it fits in a database small enough to lose on a laptop.',
        'A canary is only useful if it is signed and dated. An unsigned promise on a page that has not changed since 2019 is decoration, not a defence.',
        'Every transparency report is a negotiation with its own lawyers. The numbers are true, the categories are chosen, and the interesting part is what has no category at all.'
      ],
      closers: ['Sources in the archive, not in this post.', 'Corrections go in the next entry, dated.', 'Read the primary document if you can find it.']
    },
    {
      name: 'Third Rail', icon: '🚉', about: 'Infrastructure, transit and the systems that fail loudly.',
      posts: [
        ['The timetable is a fiction with a schedule', '2024-11-12', ['transit']],
        ['Why a single substation can stop a city', '2024-10-30', ['power']],
        ['Tunnels, water and the cost of a survey', '2024-10-15', ['infrastructure']],
        ['The sign that has been wrong since 1998', '2024-10-02', ['transit']],
        ['Reading a failure report from a rail operator', '2024-09-17', ['safety']],
        ['Bridges are inspected; software is deployed', '2024-08-30', ['infrastructure', 'essay']]
      ],
      paras: [
        'A timetable is a promise about a distribution, not a list of times. The operator knows the distribution; the passenger is shown the tail of it and told it is the middle.',
        'One substation feeds a surprising amount of a city. The redundancy is real, and it is usually one transformer short of the diagram on the wall.',
        'Tunnels are cheap to dig and expensive to know. The survey is the part nobody photographs, and it is the part that decides whether the next fifty years are boring or interesting.',
        'The sign has been wrong since 1998 because it is not wrong, it is historic, and every attempt to replace it has run into a preservation order and a budget line.'
      ],
      closers: ['Photograph from the public side of the fence.', 'No trespassing was involved in this post.', 'The diagram is approximate and I know it.']
    },
    {
      name: 'Undertow', icon: '🎧', about: 'Reviews of records nobody is promoting, recorded badly and kept anyway.',
      posts: [
        ['A four-track album that sounds like a room', '2024-11-10', ['review']],
        ['Numbers stations as ambient music', '2024-10-28', ['review', 'radio']],
        ['The zine scene distributed better than the labels', '2024-10-14', ['scene']],
        ['How to tell a good audience recording', '2024-09-29', ['live']],
        ['Public-domain scores, obscure synths', '2024-09-11', ['review']],
        ['The demo is better than the album, and that is fine', '2024-08-26', ['review']]
      ],
      paras: [
        'It was recorded on a four-track in a room with a radiator, and you can hear the radiator. That is not a flaw, it is the only reason the record has a temperature.',
        'Numbers stations are already ambient music: a voice, a pause, a carrier, no chord changes, and a structure that is entirely functional. Somebody should press it to vinyl and call it a requiem.',
        'The zine arrived in an envelope with a stamp and a return address that was a PO box. It reached more people than the label release that cost forty times as much, and it is still in a drawer.',
        'A good audience recording has a stable image, no talking at the front, and one moment where the room is louder than the PA. A bad one has all of that except the image.'
      ],
      closers: ['No links; find it yourself, that is the fun.', 'Score: irrelevant.', 'Next week, something with a saxophone.']
    },
    {
      name: 'Paper Lantern', icon: '🍜', about: 'Cooking for one, on a hotplate, with whatever the shop had.',
      posts: [
        ['Dinner from four ingredients and a kettle', '2024-11-08', ['food']],
        ['The stock you can make from scraps in a drawer', '2024-10-26', ['food']],
        ['Bread without an oven', '2024-10-11', ['food', 'experiment']],
        ['Salt is the whole recipe', '2024-09-27', ['food']],
        ['Feeding a board meeting from a cupboard', '2024-09-09', ['food']],
        ['Three sauces, one pan, a month of dinners', '2024-08-24', ['food']]
      ],
      paras: [
        'Four ingredients: onions, a tin of tomatoes, a chilli and something salty. A kettle gets the water hot faster than the hotplate does, and the whole thing is done before the rice is.',
        'The scraps go in a bag in the freezer: ends, skins, the bones from a roast. Two weeks later they are stock, and the only cost was the patience to keep a bag.',
        'Bread without an oven is a flatbread and a lid. The lid is the oven, the pan is the floor, and the trick is to leave it alone for four minutes longer than feels right.',
        'Salt does most of the work. Everything else is aroma, and aroma is optional when the salt is right and the heat was high enough to brown something.'
      ],
      closers: ['Recipe is in the comments, by request.', 'No photograph; it was eaten.', 'Improvised, repeatable, cheap.']
    },
    {
      name: 'The Long Wire', icon: '🗺', about: 'The history of the network, one dead address at a time.',
      posts: [
        ['1996: the first list of addresses', '2024-11-07', ['history']],
        ['What a seized market leaves behind', '2024-10-25', ['history', 'markets']],
        ['The directory that outlived three of its editors', '2024-10-10', ['history']],
        ['A forum, a grudge, and a fifteen-year thread', '2024-09-25', ['history']],
        ['Reading a 2009 mirror list today', '2024-09-06', ['history']],
        ['The name that got reused until it meant nothing', '2024-08-22', ['history']]
      ],
      paras: [
        'The first list was a text file with nine addresses in it, and it was copied by hand into four other files. Every directory since has been that file with better formatting and worse company.',
        'A seizure leaves a banner, a press release, and a domain that resolves to a warning. What it does not leave is the escrow ledger, which is why the arguments about who owed whom continue for a decade.',
        'Three editors, one page, and a rules section that got longer every year. The rules are the history: each line was added after somebody got robbed.',
        'A grudge thread is an archive of its own. Fifteen years of the same argument, with the same three people, and a fourth who arrives every few years to be told to read the first page.'
      ],
      closers: ['Sources: screenshots, mirrors, and one very old hard drive.', 'Corrections welcome, dated.', 'The next entry is about a list that vanished.']
    },
    {
      name: 'Night Shift', icon: '🔎', about: 'Cold cases, missing records and the paperwork that outlives the witnesses.',
      posts: [
        ['The file that was closed twice', '2024-11-06', ['cold case']],
        ['A witness statement, typed by somebody else', '2024-10-23', ['records']],
        ['Missing persons and the 1994 index', '2024-10-08', ['records']],
        ['What a coroner\u2019s report leaves out', '2024-09-24', ['law']],
        ['The detective who kept a private copy', '2024-09-03', ['cold case']],
        ['Reading a case file backwards', '2024-08-20', ['method']]
      ],
      paras: [
        'The file was closed in 1987 and again in 2003, and the second closure cites the first as evidence. That is not a conclusion, it is a copy of one.',
        'The statement is in the first person and the handwriting is not the witness\u2019s. Whoever typed it made one small correction, and the correction is where the case actually turns.',
        'An index is a promise that something exists. When 400 entries point at a box that was destroyed in a flood, the index is not wrong, it is a list of what used to be knowable.',
        'Read a case file backwards: conclusion, evidence, statements, then the first report. The first report is the only one written before anybody knew what the ending needed to be.'
      ],
      closers: ['Documents are public; the names here are not.', 'No accusations, only questions.', 'If you have the missing page, the address is on the about page.']
    },
    {
      name: 'Weird Archive', icon: '👁', about: 'High strangeness, declassified oddities and the documents that are absurd on purpose.',
      posts: [
        ['The 1979 second-sun memo is a masterpiece', '2024-11-19', ['documents', 'absurd']],
        ['Blue Book: 12,618 sightings, mostly paperwork', '2024-11-05', ['ufo']],
        ['Why good UFO documents have terrible typewriters', '2024-10-22', ['ufo', 'forgery']],
        ['Hollow earth surveys and the smaller sun', '2024-10-04', ['absurd']],
        ['Delta-3 and the football league', '2024-09-20', ['absurd']],
        ['How to spot a fabricated archive in ten minutes', '2024-09-02', ['forgery', 'method']]
      ],
      paras: [
        'The memo allocates a budget, names a project officer, and complains about glare. It is absurd, and somebody typed it, and that is the entire genre: bureaucracy applied to the impossible.',
        'Project Blue Book closed with 701 unexplained cases, which is a small number until you remember that each one is a person who saw something and then had to fill in a form.',
        'The typewriter is the tell. Real documents have a ribbon running out, a margin that drifts, and a stamp from an office that no longer exists. Forgeries are too clean and too consistent.',
        'The survey describes a sun that is smaller and closer, a horizon that curves upward, and a mapping office with eleven staff. The details are what make it charming: somebody thought about staffing.'
      ],
      closers: ['This is entertainment, not evidence.', 'The absurd ones are labelled absurd. That is the rule.', 'Send me your best obvious forgery.']
    }
  ];

  const blogCss = pal =>
    'html,body{margin:0;background:' + pal.bg + ';color:' + pal.ink + ';font:16px/1.7 Georgia,"Times New Roman",serif}' +
    'a{color:' + pal.acc + ';text-decoration:none}a:hover{text-decoration:underline}' +
    '.top{display:flex;align-items:baseline;gap:14px;padding:18px 26px;border-bottom:1px solid ' + pal.line + ';background:' + pal.panel + ';font-family:ui-sans-serif,system-ui,sans-serif}' +
    '.top b{font-size:19px;letter-spacing:-.01em}.top nav{margin-left:auto;display:flex;gap:16px;font-size:13px}.top nav a{color:' + pal.mute + '}' +
    '.wrap{max-width:720px;margin:0 auto;padding:34px 24px 70px}' +
    '.kicker{font:600 11px/1 ui-sans-serif,system-ui,sans-serif;letter-spacing:.18em;text-transform:uppercase;color:' + pal.acc + '}' +
    'h1{font-size:34px;line-height:1.2;margin:10px 0 6px;letter-spacing:-.02em}h2{font-size:22px;margin:34px 0 6px}' +
    'h3{font:600 13px/1.4 ui-sans-serif,system-ui,sans-serif;letter-spacing:.14em;text-transform:uppercase;color:' + pal.mute + ';margin:36px 0 10px;border-bottom:1px solid ' + pal.line + ';padding-bottom:6px}' +
    '.meta{font:13px ui-sans-serif,system-ui,sans-serif;color:' + pal.mute + '}' +
    'p{margin:14px 0}.lede{font-size:18px;color:' + pal.ink + '}' +
    '.card{border:1px solid ' + pal.line + ';border-radius:14px;padding:18px 20px;margin:16px 0;background:' + pal.panel + '}' +
    '.card h2{margin:0 0 4px;font-size:20px}.card p{margin:6px 0 0;color:' + pal.mute + ';font-size:14px;font-family:ui-sans-serif,system-ui,sans-serif}' +
    '.tag{font:11px ui-sans-serif,system-ui,sans-serif;color:' + pal.acc + ';border:1px solid ' + pal.line + ';border-radius:99px;padding:2px 8px;margin-right:6px}' +
    'blockquote{margin:18px 0;padding:2px 0 2px 16px;border-left:3px solid ' + pal.acc + ';color:' + pal.mute + ';font-style:italic}' +
    'pre{background:' + pal.panel + ';border:1px solid ' + pal.line + ';border-radius:10px;padding:12px;overflow:auto;font-size:12.5px;line-height:1.5}' +
    'footer{margin-top:46px;border-top:1px solid ' + pal.line + ';padding-top:14px;color:' + pal.mute + ';font:12px ui-sans-serif,system-ui,sans-serif}';

  function blogPal(host) {
    const h = hash(host);
    const hues = [22, 190, 268, 145, 340, 48, 205, 96, 12, 300, 168, 250];
    const hue = hues[h % hues.length];
    return {
      bg: 'hsl(' + hue + ' 22% 9%)', panel: 'hsl(' + hue + ' 20% 13%)', ink: 'hsl(' + hue + ' 18% 92%)',
      mute: 'hsl(' + hue + ' 12% 62%)', line: 'hsl(' + hue + ' 16% 22%)', acc: 'hsl(' + ((hue + 32) % 360) + ' 78% 68%)'
    };
  }

  function blogIndex(blog, site) {
    return blog.posts.map((p, i) =>
      '<div class="card"><div class="kicker">' + esc(p[1]) + ' · ' + p[2].map(t => '<span class="tag">' + esc(t) + '</span>').join('') + '</div>' +
      '<h2><a href="/post/' + (i + 1) + '">' + esc(p[0]) + '</a></h2>' +
      '<p>' + esc(at(blog.paras, hash(p[0]))) .slice(0, 168) + '…</p></div>').join('');
  }

  function blogPost(blog, site, n) {
    const p = blog.posts[n - 1];
    if (!p) return null;
    const b = hash(site.host + p[0]);
    const paras = [at(blog.paras, b), at(blog.paras, b + 3), at(blog.paras, b + 1)];
    const close = at(blog.closers, b);
    const others = blog.posts.filter((_, i) => i !== n - 1).slice(0, 4);
    return '<div class="kicker">' + esc(p[1]) + ' · ' + p[2].map(t => '<span class="tag">' + esc(t) + '</span>').join('') + '</div>' +
      '<h1>' + esc(p[0]) + '</h1>' +
      '<p class="meta">' + esc(blog.posts[n - 1][2][0] || 'notes') + ' · about six minutes</p>' +
      paras.map(x => '<p>' + esc(x) + '</p>').join('') +
      '<blockquote>' + esc(close) + '</blockquote>' +
      '<h3>More from ' + esc(blog.name) + '</h3>' +
      others.map(o => '<div class="card"><h2><a href="/post/' + (blog.posts.indexOf(o) + 1) + '">' + esc(o[0]) + '</a></h2><p>' + esc(o[1]) + '</p></div>').join('') +
      '<p class="meta"><a href="/">← all posts</a> · <a href="/about">about this blog</a></p>';
  }

  function blogArchive(blog) {
    return '<table style="width:100%;border-collapse:collapse;font-family:ui-sans-serif,system-ui,sans-serif;font-size:14px">' +
      blog.posts.map((p, i) => '<tr><td style="padding:8px 6px;border-bottom:1px solid currentColor;opacity:.5;width:110px">' + esc(p[1]) + '</td>' +
        '<td style="padding:8px 6px;border-bottom:1px solid currentColor"><a href="/post/' + (i + 1) + '">' + esc(p[0]) + '</a></td>' +
        '<td style="padding:8px 6px;border-bottom:1px solid currentColor;opacity:.5">' + p[2].map(esc).join(', ') + '</td></tr>').join('') + '</table>';
  }

  function blogShell(site, blog, pal, title, inner) {
    const nav = [['Home', '/'], ['Archive', '/archive'], ['About', '/about'], ['Feed', '/feed.xml'], ['Contact', '/contact']]
      .map(x => '<a href="' + x[1] + '">' + x[0] + '</a>').join('');
    return '<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">' +
      '<title>' + esc(title) + ' · ' + esc(blog.name) + '</title><style>' + blogCss(pal) + '</style></head><body>' +
      '<div class="top"><b>' + esc(blog.icon + ' ' + blog.name) + '</b><nav>' + nav + '</nav></div>' +
      '<div class="wrap">' + inner + '<footer>' + esc(site.host) + ' · a simulated blog inside Moundshroud · ' + esc(blog.about) + '</footer></div></body></html>';
  }

  /* every blog entry in the wiki's directory resolves through here */
  function blogSite(entry, base) {
    const blog = BLOGS.find(b => b.name.replace('&amp;', '&') === entry.name.replace('&amp;', '&')) || BLOGS[hash(entry.name) % BLOGS.length];
    const pal = blogPal(entry.host);
    const site = Object.assign({}, base || {}, {
      dark: true, host: entry.host, brand: entry.name, icon: blog.icon, kind: 'Blog',
      topic: 'blog, writing, ' + blog.posts.map(p => p[2].join(' ')).join(' '), region: 'Onion space',
      market: false, noSales: true, blog: true, tier: 'clean', quality: 'clean',
      tagline: blog.about, pal: Object.assign({}, pal, { bg: pal.bg, panel: pal.panel, ink: pal.ink, mute: pal.mute, line: pal.line, acc: pal.acc }),
      menu: [['Home', '/'], ['Archive', '/archive'], ['About', '/about'], ['Feed', '/feed.xml'], ['Contact', '/contact']]
    });
    site.render = (path) => {
      const p = String(path || '/').replace(/\/+$/, '') || '/';
      if (p === '/') {
        return {
          status: 200, type: 'text/html', body: blogShell(site, blog, pal, blog.name,
            '<div class="kicker">' + esc(entry.host) + '</div><h1>' + esc(blog.name) + '</h1>' +
            '<p class="lede">' + esc(blog.about) + '</p>' +
            '<p class="meta">' + blog.posts.length + ' posts · last one ' + esc(blog.posts[0][1]) + ' · written under a name nobody can check</p>' +
            '<h3>Latest</h3>' + blogIndex(blog, site))
        };
      }
      if (p === '/archive') return { status: 200, type: 'text/html', body: blogShell(site, blog, pal, 'Archive', '<h1>Archive</h1>' + blogArchive(blog)) };
      if (p === '/about') {
        return {
          status: 200, type: 'text/html', body: blogShell(site, blog, pal, 'About',
            '<h1>About</h1><p>' + esc(blog.about) + '</p>' +
            '<p class="meta">No analytics, no comments, no account. A post is published when it is written and corrected in public if it is wrong.</p>' +
            '<p class="meta">This blog is simulated inside Moundshroud’s Cyber Desktop. The address belongs to a fake hidden service; nothing is fetched.</p>')
        };
      }
      if (p === '/contact') {
        return {
          status: 200, type: 'text/html', body: blogShell(site, blog, pal, 'Contact',
            '<h1>Contact</h1><p class="meta">Mail is read when the key is right. Use the address on the about page, sign it, and wait a week.</p>' +
            '<form action="/contact" method="post" style="font-family:ui-sans-serif,system-ui,sans-serif">' +
            '<p><label>From<br><input name="from" style="width:100%;padding:8px;background:transparent;border:1px solid currentColor;border-radius:6px;color:inherit"></label></p>' +
            '<p><label>Message<br><textarea name="body" rows="6" style="width:100%;padding:8px;background:transparent;border:1px solid currentColor;border-radius:6px;color:inherit"></textarea></label></p>' +
            '<p><button style="padding:8px 16px;border:0;border-radius:6px;background:currentColor;font:inherit">Send</button></p></form>')
        };
      }
      if (p === '/feed.xml') {
        return {
          status: 200, type: 'application/xml',
          body: '<?xml version="1.0" encoding="utf-8"?>\n<rss version="2.0"><channel><title>' + blog.name + '</title>' +
            '<link>https://' + entry.host + '/</link><description>' + blog.about.replace(/&/g, '&amp;') + '</description>' +
            blog.posts.map(x => '<item><title>' + x[0].replace(/&/g, '&amp;') + '</title><link>https://' + entry.host + '/post/' + (blog.posts.indexOf(x) + 1) + '</link><pubDate>' + x[1] + '</pubDate></item>').join('') +
            '</channel></rss>\n'
        };
      }
      const m = /^\/post\/(\d+)$/.exec(p);
      if (m) {
        const body = blogPost(blog, site, Number(m[1]));
        if (body) return { status: 200, type: 'text/html', body: blogShell(site, blog, pal, blog.posts[Number(m[1]) - 1][0], body) };
      }
      return { status: 404, type: 'text/html', body: blogShell(site, blog, pal, 'Not found', '<h1>Nothing here</h1><p class="meta"><a href="/">← back to the front page</a></p>') };
    };
    return site;
  }

  /* ============================================================== introspace ============================================================= */
  /* A board with sub-boards. Titles are written; bodies, replies and scores are generated from the title, so a thread is the same every visit. */
  const SUBS = [
    {
      id: 'markets', name: 's/markets', title: 'Markets', blurb: 'Escrow, vendor reviews, exit scams and the same three arguments.',
      bodies: ['Deposits went through escrow and the vendor shipped in three days. Two of the six were late by a week, which on this board counts as on time.',
        'The listing has been up for eleven months with the same bond and the same moderators. That is either stability or a very patient exit scam.',
        'Every thread about finalising early ends the same way: somebody posts a receipt, somebody posts a loss, and the mod locks it.',
        'The mirror list on the front page is signed. The fourth address in it is not in the signature. That is the whole review.',
        'Two vendors left this week and both posted the same goodbye. The escrow balances were released first, which is more than most manage.'],
      replies: ['Escrow or nothing. The bond is the only part of this that is not a rumour.', 'Screenshots or it did not happen.', 'This same thread existed in 2019 with different names.', 'The support account DMing you is not support.'],
      posts: [
        ['Nightfall is back with the same escrow key as 2022. Verify before you deposit.', 'nulldeposit', 412],
        ['Vendor review: Old Bazaar, six orders, one late, no bait and switch.', 'parcelwatcher', 289],
        ['How do you tell an exit scam from a maintenance window?', 'latefee', 233],
        ['PSA: the "Silk Mirror" listing is a clone. Same banner, different deposit address.', 'bannerwatch', 190],
        ['Escrow dispute thread — arbitration took eleven days, screenshots inside.', 'disputant', 141],
        ['Are FE deals ever worth it? Every time I say no, someone posts a receipt.', 'finalisethis', 98]
      ]
    },
    {
      id: 'opsec', name: 's/opsec', title: 'Opsec', blurb: 'Threat models, burners, and the mistakes people make twice.',
      bodies: ['Cash is not anonymous if the camera saw you at the till, and a laptop bought with cash in a shop with a loyalty card reader is not a clean machine.',
        'The threat model comes first. Against a landlord, a VPN is enough. Against somebody with a subpoena, the question is what you kept and for how long.',
        'I matched two accounts by punctuation before I ever looked at the writing. Commas are a fingerprint and nobody believes it until it happens to them.',
        'Full-disk encryption buys you time, not secrecy. Time is the whole point: the door is supposed to be slow enough that you hear the knock.',
        'The photo metadata said more than the photo did: a model, a time, and a city that narrowed the building to four.'],
      replies: ['Assume the camera, the card reader and the phone. Then decide what is left.', 'Write the threat model down. If it fits in one sentence it is probably wrong.', 'Compartmentalise the accounts, not just the passwords.', 'This is why the burner stays in a drawer with the battery out.'],
      posts: [
        ['Cash laptop, cash SIM, no registration: what still ties it to me?', 'coldstart', 521],
        ['Full-disk encryption is not a plan, it is a door. What is your actual plan?', 'airgap', 388],
        ['I leaked my own location through a photo\'s reflections. Learn from it.', 'reflected', 302],
        ['Burner phone checklist, version 9, comments welcome', 'pocketlint', 244],
        ['Do not use the same writing style across accounts. Someone matched me by commas.', 'comma', 177],
        ['Threat model for a journalist, not a criminal: what changes?', 'deskwork', 132]
      ]
    },
    {
      id: 'leaks', name: 's/leaks', title: 'Leaks &amp; archives', blurb: 'Reading dumps properly: provenance, dates, redactions.',
      bodies: ['The archive claims eleven million documents and ships a manifest with four thousand files. That gap is the story, not a detail.',
        'Provenance first: who published it, when, with what signature, and which outlet has independently confirmed one row.',
        'The redactions fail in the funny places. A black bar over a name and the same name in the header of the next page.',
        'An archive that includes a private person is not a leak about an institution, it is a leak about a person who worked at one.',
        'The dates in the manifest are the interesting column. A dump that claims 2021 and contains 2019 timestamps was copied from something older.'],
      replies: ['Read the manifest before the headlines.', 'Every dump has a boring majority and a small, specific thing that matters.', 'Redaction failures are how half of these stories actually got written.', 'The fabricated ones are labelled. Check the label before you cite it.'],
      posts: [
        ['MKUltra files: where the money trail actually starts', 'paperweight', 447],
        ['How to read a dump: provenance, dates, and the rows that do not fit', 'provenance', 356],
        ['The Vault 7 index is more interesting than the tools', 'greyfolder', 298],
        ['Redaction failures: three examples, one embarrassing', 'blackbar', 251],
        ['Is any "government leak" from the last five years real? A checklist.', 'skeptic', 188],
        ['We found a fabricated archive in the wild. Here is how we knew.', 'archivecat', 164]
      ]
    },
    {
      id: 'aliens', name: 's/aliens', title: 'High strangeness', blurb: 'Declassified oddities, absurd documents, and the ones somebody actually typed.',
      bodies: ['The memo has a budget, a project officer and a complaint about glare. Somebody typed it on a machine that produced two carbon copies, and that is the part I believe.',
        'Blue Book closed with 701 unexplained cases. The interesting number is not 701, it is the number of forms each one required.',
        'The forgery is too clean. Real documents drift: the margin moves, the ribbon fades, the stamp is from an office that closed in 1988.',
        'The hollow earth survey lists eleven staff and a mapping office. Absurdity with a staffing chart is a genre, and it is a good one.',
        'The budget line is the funniest part: a project that cannot exist, funded at a rate that would not cover a car.'],
      replies: ['It is fiction, and it is better written than most of the real files.', 'The typewriter is always the tell.', 'Somebody had to approve the budget line, and that is the joke.', 'Post the page number or it did not happen.'],
      posts: [
        ['The 1979 "second sun" memo: absurd, and somebody typed it', 'lantern', 389],
        ['Blue Book\'s unexplained cases are mostly paperwork, and that is the story', 'bluebook', 274],
        ['Why do all the good UFO documents have terrible typewriters?', 'kerning', 205],
        ['Delta-3 moonbase logistics: the football league is the believable part', 'deltathree', 172],
        ['If the government had a teleportation stairwell, the fire code would have leaked first', 'buildingcode', 151],
        ['Post your favourite obviously fake document. Best forgery wins nothing.', 'fakeleak', 118]
      ]
    },
    {
      id: 'tech', name: 's/tech', title: 'Tech', blurb: 'Servers, static pages, keys and the tools that keep a mirror alive.',
      bodies: ['A static site with three hundred pages, no JavaScript and a 4 KB stylesheet will outlive every framework on this board.',
        'PGP keys prove a message came from the holder of a key. They do not prove the holder is a person you should trust.',
        'The upgrade broke the printer, which is the most honest thing a package manager has ever done to me.',
        'OnionShare is fine for a handover and terrible for a permanent archive. Pick the tool for the lifetime of the thing.',
        'A key that has never been used in public is a key nobody can verify, which is the same as no key at all.'],
      replies: ['Uptime is a feature. Everything else is a preference.', 'Serve plain HTML and stop apologising for it.', 'Check the signature, not the fingerprint in the profile.', 'This is a caching problem wearing a costume.'],
      posts: [
        ['Which self-hosted wiki survives a raid? Asking for a directory.', 'mirrorlist', 236],
        ['Static site, no JS, 300 pages, still faster than your market', 'plaintext', 199],
        ['PGP keys are not identity. Stop signing everything with them.', 'keyserver', 176],
        ['Tails upgrade broke my printer and I have never been happier', 'printshop', 122],
        ['Ask: is OnionShare still the best way to hand over a 40 GB archive?', 'dropbox', 110],
        ['Show us your uptime counter. Longest wins.', 'uptimebot', 96]
      ]
    },
    {
      id: 'offgrid', name: 's/offgrid', title: 'Off-grid', blurb: 'Power, water, food and radio, without a subscription.',
      bodies: ['Two panels, two batteries and one fridge got through three winters. The number that matters is not the panel wattage, it is the depth of discharge on the worst week.',
        'Well water is a chemistry problem with a maintenance schedule. Test it twice a year and write the results down, because the trend is the warning.',
        'Radio is the only plan that survives the grid going down, and it needs a battery, an antenna and somebody at the other end. Two of those are cheap.',
        'Stock what you eat and eat what you stock. A pantry is a rotation, not a museum.',
        'The inverter eats more than the fridge when nothing is drawing. Measure the idle load before you buy the second battery.'],
      replies: ['Write the numbers down. Memory lies about winter.', 'The antenna is more important than the radio.', 'Rotation is the whole trick.', 'Cold frames in a bad spring are a gamble with a good payoff.'],
      posts: [
        ['Solar, two batteries, one fridge: three winters of data', 'panel', 264],
        ['Well water testing without a lab', 'springhead', 187],
        ['Radio is the only plan that survives the grid going down', 'shortwave', 160],
        ['What do you actually stock that you also eat?', 'pantry', 143],
        ['Cold frames in a bad spring', 'greenthumb', 88],
        ['Off-grid internet: the honest version', 'lastmile', 76]
      ]
    },
    {
      id: 'philosophy', name: 's/philosophy', title: 'Philosophy', blurb: 'Ethics, trust and what a network does to the people on it.',
      bodies: ['Privacy is not the same as secrecy. Secrecy hides a thing; privacy lets you be boring in public, which is the state most people actually need.',
        'Escrow is a promise with a ledger. The ledger is what makes the promise expensive to break, and expensive is what we call trust when strangers are involved.',
        'The dump is a crowd, and somewhere in the crowd is a nurse. The ethics begin at the moment you decide whether to publish her address.',
        'A network wants nothing. It has no preference about what it carries, which is the freedom and the entire problem.',
        'Every rule on a market is a sentence about what its operators fear. Read them as a confession.'],
      replies: ['The nurse is the whole argument, and it is usually skipped.', 'Trust is a cost function. That is not cynical, it is useful.', 'Read the rules page of any market and you will find its philosophy.', 'This board is a directory of people arguing about directories.'],
      posts: [
        ['Privacy is not secrecy; it is the right to be uninteresting', 'quiettuesday', 312],
        ['The ethics of publishing a dump that contains a nurse\'s address', 'redact', 268],
        ['On trust: escrow is a belief system with better bookkeeping', 'ledger', 211],
        ['What does "the network" want? Nothing. That is the problem.', 'anon', 158],
        ['Reading the Hidden Wiki as a historical document', 'marginalia', 121]
      ]
    },
    {
      id: 'lostmedia', name: 's/lostmedia', title: 'Lost media', blurb: 'Pages that stopped answering, screenshots that outlived them.',
      bodies: ['The front page survived as a screenshot in a thread about something else. Two years of a market, preserved by accident, in 900 by 600 pixels.',
        'The issue is complete except page three, which was a fold-out and therefore the page everybody scanned badly.',
        'Eighty percent of the images are gone and the filenames are still there, which is a peculiar kind of archive: a list of things you can no longer see.',
        'Archive the notice too. A seizure banner is a dated document, and in ten years it will be the only evidence of what happened.',
        'The archive has the page, the screenshot has the layout, and the thread has the argument about what the page said.'],
      replies: ['Screenshot everything, including the errors.', 'The filenames are the archive now.', 'Dead addresses are still addresses. Keep the list.', 'This is why I never delete a folder.'],
      posts: [
        ['A market\'s front page from 2016, recovered from a screenshot thread', 'frame', 227],
        ['The Dead Drop issue 4 is missing page 3. Anyone?', 'completist', 176],
        ['Found: a 2009 forum dump, 80% of the images already gone', 'hoarder', 149],
        ['Dead onion addresses that still resolve to a notice — archive them', 'tombstone', 120],
        ['Someone recorded a numbers station for nine years. It is all here.', 'dial', 104]
      ]
    },
    {
      id: 'music', name: 's/music', title: 'Music', blurb: 'Records, tape hiss and the scene that distributed itself.',
      bodies: ['It was recorded on a four-track in a room with a radiator and you can hear the radiator. That is not a flaw, it is the only reason the record has a temperature.',
        'Numbers stations are already ambient music: a voice, a pause, a carrier, no chord changes. Somebody should press it to vinyl and call it a requiem.',
        'A good audience recording has a stable image, no talking at the front, and one moment where the room is louder than the PA.',
        'The zine reached more people than the label release and it is still in a drawer, which tells you everything about distribution.',
        'The best recording of the show is the one where the tape runs out during the last song and nobody minds.'],
      replies: ['The hiss is the instrument.', 'Best bootleg is the one where the taper coughs once and it becomes part of the song.', 'Send the rip, I will trade a scan.', 'This is the only board where nobody argues about escrow.'],
      posts: [
        ['Best album recorded entirely on a Tascam 4-track', 'tapehiss', 158],
        ['Numbers stations as ambient music: a starter playlist', 'signal', 132],
        ['The 90s zine scene had better distribution than most labels', 'staple', 99],
        ['Live bootlegs: how do you tell a good audience recording from a bad one?', 'micstand', 84],
        ['Obscure synths in public-domain film scores', 'oscillator', 71]
      ]
    },
    {
      id: 'books', name: 's/books', title: 'Books', blurb: 'Reading lists, scanners, and books about hostile networks.',
      bodies: ['The reading order matters less than the habit. Ten pages a night beats a list of forty books you will not open.',
        'A cheap flatbed, a good lamp and a copy stand is the whole scanning rig. Four hundred pages a night is achievable if the spine allows it.',
        'A novel about a directory that outlives its makers is either very good or a technical manual, and I have read both.',
        'Zines are worth keeping in print because the digital copy will be a dead link before the paper yellows.',
        'A library is a set of decisions about what not to throw away, and every one of them was made in a hurry.'],
      replies: ['Start with the manual, then the history.', 'Scan at 300 dpi and stop worrying about the rest.', 'The paper outlives the link.', 'Add it to the library category, not this thread.'],
      posts: [
        ['Books that assume the network is hostile', 'spine', 147],
        ['Reading order for someone who just found the wiki', 'firstpage', 128],
        ['Cheap scanner, good light, 400 pages a night', 'platen', 96],
        ['Recommend a novel about a directory that outlives its makers', 'fiction', 88],
        ['Zines worth keeping in print', 'fold', 74]
      ]
    },
    {
      id: 'torrents', name: 's/torrents', title: 'Torrents', blurb: 'Seeding, checksums and moving two terabytes without a cloud.',
      bodies: ['Seeding a library is a public service with a bandwidth bill. The bill is the only reason it is rare.',
        'Checksums or it did not happen. A file that verifies is a file; a file that nearly verifies is a rumour with a size.',
        'Two terabytes to another host in a week is a scheduling problem, not a bandwidth problem. Move the small files first and the big one overnight.',
        'Ratio rules on a board with twelve users is a comedy, but the rules are what keep the twelve users seeding.'],
      replies: ['Seed what you take, take what you seed.', 'SHA256 in the thread or I am not downloading it.', 'Rsync over the network is slow and honest.', 'Twelve users is still a community.'],
      posts: [
        ['Seeding a library is a public service, not a crime', 'seedbox', 203],
        ['Checksums or it did not happen', 'sha256', 167],
        ['Ratio rules on a board with twelve users', 'leech', 91],
        ['Best way to mirror 2 TB to another host in 2026', 'coldcopy', 78]
      ]
    },
    {
      id: 'help', name: 's/help', title: 'Help', blurb: 'New people asking the questions the wiki does not answer.',
      bodies: ['Start with the threat model, then the browser, then the accounts, in that order. Everything else is shopping.',
        'An account with no recovery questions cannot be recovered. That is not a bug, it is the product, and it costs exactly what it promises.',
        'Explain opsec as a seatbelt, not a bunker. People accept a seatbelt; they do not accept a bunker.',
        'If the wiki says dead and it answers for you, one of you is looking at a clone. Check the address character by character.',
        'Ask a specific question. \u201cIs this safe\u201d cannot be answered; \u201cis this safe from my landlord\u201d can.'],
      replies: ['Read the wiki\'s rules page, it is short and it is the answer to most of this.', 'Do not post your address here. Ever.', 'The boring answer is usually the right one.', 'Ask again in a week with what you learned.'],
      posts: [
        ['I think I am being watched online. Where do I start?', 'tuesday', 341],
        ['Recovering an account with no recovery questions', 'lockedout', 155],
        ['How do I explain opsec to a family member without scaring them?', 'civilian', 143],
        ['Wiki says a service is dead but it answers for me. Who is wrong?', 'ping', 87],
        ['Reading list for a beginner, please stop sending me 40 links', 'overwhelmed', 79]
      ]
    },
    {
      id: 'scamwatch', name: 's/scamwatch', title: 'Scam watch', blurb: 'Clones, fake escrow and the fingerprint that was one character off.',
      bodies: ['The clone keeps the name, the banner and the feedback. It changes the deposit address, which is the only part that matters.',
        'Fake escrow in four screenshots: the bond page, the support account, the "release" button, and the wallet that is empty.',
        'They spoofed a PGP fingerprint by one character. One. In a monospace font, at two in the morning, that is enough.',
        'Market support will never ask for a seed phrase. If the message asks, the message is the scam and the account is compromised.',
        'The clone list is the most-read page on this board, which tells you how the week went for everybody else.'],
      replies: ['Pin the address in the thread and move on.', 'One character is all it takes on a small screen.', 'Report the mirror, not just the clone.', 'The support account is the scam. Always.'],
      posts: [
        ['Clone list, updated weekly. Add what you find.', 'bannerwatch', 288],
        ['How a fake escrow works in four screenshots', 'fourframes', 214],
        ['They spoofed a PGP fingerprint by one character. One.', 'fingerprint', 166],
        ['Market "support" asking for your seed phrase is not support', 'noseed', 132],
        ['Report: Paid for a listing, got a login page', 'burnt', 88]
      ]
    },
    {
      id: 'meta', name: 's/meta', title: 'Meta', blurb: 'Rules, moderation and why the board is called Introspace.',
      bodies: ['The name is a joke about a place that introduces you to other places. It stuck because nobody could think of anything better and the domain was cheap.',
        'Moderator log is public: every removal, the rule it broke and who asked. Two this week, both for posting an address in a help thread.',
        'New subspaces need three people who will post in them for a month. That is the whole application, and most applications fail at week two.',
        'We are not that other site. The subspaces are subspaces, the votes are votes, and the resemblance ends where the advertising begins.',
        'The rules page has been edited four times and every edit was written after somebody argued about it in this subspace.'],
      replies: ['Read the rules before the first post.', 'The name is fine. StopWorkshopping it.', 'Three people for a month is a high bar and it is working.', 'Moderation log is the best page on this board.'],
      posts: [
        ['Rules of Introspace, updated', 'mod', 402],
        ['Why the board is called Introspace', 'root', 219],
        ['Moderator log, this week', 'mod', 143],
        ['Request a subspace: cooking, transit, cartography', 'ask', 91],
        ['We are not Reddit. Stop calling the subspaces "subs".', 'pedant', 77]
      ]
    }
  ];

  const HANDLES = ['nullroute', 'kestrel', 'mothwing', 'seventeen', 'palehorse', 'bitrot', 'comma', 'airgap', 'paperweight', 'lantern', 'greyfolder', 'deadchannel', 'thirdrail', 'fold', 'platen', 'seedbox', 'tombstone', 'oscillator', 'shortwave', 'redact'];
  const GLOBAL = ['This thread is why I still read this board.', 'Source? The wiki page or it is a rumour.', 'Saved. The comments are better than the post.', 'Pin this before somebody asks again next week.', 'Counterpoint: it worked for me, twice, and I documented both.', 'Everyone upvoting has not read past the title.', 'The address in the third comment is a clone. Do not use it.'];

  function commentsFor(post, sub) {
    const b = hash(sub.id + post[0]);
    const n = 3 + (b % 3);
    const pool = sub.replies.concat(GLOBAL);
    const out = [];
    for (let i = 0; i < n; i++) {
      const line = at(pool, b + i * 7 + 1);
      const who = at(HANDLES, b + i * 13 + 5);
      const score = 2 + ((b >>> (i + 1)) % 90);
      const kids = i === 0 && b % 2 === 0 ? [{ who: at(HANDLES, b + 41), line: at(pool, b + 19), score: 1 + ((b >>> 3) % 24) }] : [];
      out.push({ who, line, score, kids });
    }
    return out;
  }

  const ispaceCss =
    'html,body{margin:0;background:#0f1115;color:#e3e7ee;font:15px/1.6 ui-sans-serif,system-ui,-apple-system,"Segoe UI",Roboto,sans-serif}' +
    'a{color:#9ecbff;text-decoration:none}a:hover{text-decoration:underline}' +
    '.bar{display:flex;align-items:center;gap:14px;padding:10px 20px;background:#161a21;border-bottom:1px solid #262c36;position:sticky;top:0;z-index:2}' +
    '.bar .mark{width:26px;height:26px;border-radius:8px;background:linear-gradient(135deg,#ff8a3d,#ff4d6d);flex:none}' +
    '.bar b{font-size:17px;letter-spacing:-.01em}.bar b i{font-style:normal;color:#8b95a6;font-weight:400}' +
    '.bar form{flex:1;max-width:420px;margin-left:6px}.bar input{width:100%;box-sizing:border-box;padding:7px 11px;border-radius:99px;border:1px solid #262c36;background:#0f1115;color:inherit;font:inherit;font-size:13px}' +
    '.bar nav{margin-left:auto;display:flex;gap:14px;font-size:13px;color:#8b95a6}' +
    '.page{display:flex;gap:24px;max-width:1080px;margin:0 auto;padding:22px 20px 70px;align-items:flex-start}' +
    '.feed{flex:1;min-width:0}.side{width:250px;flex:none;position:sticky;top:64px}' +
    '.box{border:1px solid #262c36;border-radius:12px;background:#161a21;padding:12px 14px;margin-bottom:14px}' +
    '.box h4{margin:0 0 8px;font-size:11px;letter-spacing:.14em;text-transform:uppercase;color:#8b95a6;font-weight:600}' +
    '.box a{display:block;font-size:13px;padding:3px 0;color:#cdd6e4}.box a.on{color:#ff8a3d;font-weight:600}' +
    '.sorts{display:flex;gap:6px;margin-bottom:12px}@media(max-width:820px){.side{display:none}.page{padding:14px 12px 60px}}' +
    '.sorts a{padding:5px 11px;border-radius:99px;border:1px solid #262c36;font-size:12.5px;color:#8b95a6}' +
    '.sorts a.on{background:#ff8a3d;border-color:#ff8a3d;color:#1a1207;font-weight:700}' +
    '.post{display:flex;gap:12px;padding:12px 4px;border-bottom:1px solid #1e242e}' +
    '.vote{width:52px;flex:none;text-align:center;font-size:12px;color:#8b95a6}.vote b{display:block;font-size:13px;color:#cdd6e4}' +
    '.vote .arrow{color:#ff8a3d;font-size:13px}' +
    '.post h3{margin:0 0 3px;font-size:16.5px;line-height:1.35;font-weight:600}' +
    '.post .meta{font-size:12px;color:#8b95a6}.post .meta a{color:#9ecbff}' +
    '.sub{color:#ff8a3d;font-weight:600}' +
    '.note{border:1px solid #3a2b1c;background:#1d1710;color:#e6c9a8;border-radius:10px;padding:10px 12px;font-size:12.5px;margin:0 0 14px}' +
    '.thread h1{font-size:24px;line-height:1.3;margin:4px 0 8px}' +
    '.thread .body{border:1px solid #262c36;border-radius:12px;background:#161a21;padding:16px 18px;margin:12px 0 22px;font-size:15px}' +
    '.cmt{border-left:2px solid #262c36;padding:2px 0 2px 14px;margin:12px 0}' +
    '.cmt .who{font-size:12px;color:#8b95a6}.cmt p{margin:3px 0}' +
    '.cmt .kids{margin-left:6px}' +
    'table{border-collapse:collapse;width:100%;font-size:13px}td,th{padding:7px 8px;border-bottom:1px solid #1e242e;text-align:left}' +
    'input,textarea{background:#0f1115;border:1px solid #262c36;border-radius:8px;color:inherit;font:inherit;padding:8px}' +
    'button{background:#ff8a3d;color:#1a1207;border:0;border-radius:8px;padding:8px 15px;font:inherit;font-weight:700;cursor:pointer}';

  function ispaceShell(site, title, inner, opts) {
    const o = opts || {};
    const subs = SUBS.map(s => '<a href="/' + s.id + '"' + (o.sub === s.id ? ' class="on"' : '') + '>' + s.name + '</a>').join('');
    return '<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">' +
      '<title>' + esc(title) + ' · Introspace</title><style>' + ispaceCss + '</style></head><body>' +
      '<div class="bar"><span class="mark"></span><b>Introspace</b><i>the board the network argues on</i>' +
      '<form action="/search" method="get"><input name="q" value="' + esc(o.q || '') + '" placeholder="search threads, subspaces and users" aria-label="Search Introspace"></form>' +
      '<nav><a href="/new">new</a><a href="/submit">submit</a><a href="/about">about</a><a href="/login">log in</a></nav></div>' +
      '<div class="page"><div class="feed">' + inner + '</div>' +
      '<div class="side"><div class="box"><h4>subspaces</h4><a href="/"' + (o.sub ? '' : ' class="on"') + '>all</a>' + subs + '</div>' +
      '<div class="box"><h4>this board</h4><a href="/new">new</a><a href="/submit">submit a thread</a><a href="/search">search</a><a href="/about">what this is</a><a href="/rules">rules</a></div>' +
      '<div class="box"><h4>stats</h4><div style="font-size:12.5px;color:#8b95a6">' + SUBS.length + ' subspaces<br>' +
      SUBS.reduce((n, s) => n + s.posts.length, 0) + ' threads<br>every one of them simulated</div></div></div></div></body></html>';
  }

  function threadRow(sub, post, i) {
    /* the comment count is the number of replies the thread page really prints, so the two pages agree */
    return '<div class="post"><div class="vote"><span class="arrow">▲</span><b>' + vote(post[2]) + '</b></div>' +
      '<div><h3><a href="/' + sub.id + '/thread/' + (i + 1) + '">' + esc(post[0]) + '</a></h3>' +
      '<div class="meta"><a class="sub" href="/' + sub.id + '">' + sub.name + '</a> · posted by <a href="/u/' + esc(post[1]) + '">u/' + esc(post[1]) + '</a> · ' +
      ((hash(post[0]) % 21) + 1) + 'h ago · ' + commentsFor(post, sub).length + ' comments</div></div></div>';
  }

  function feedHtml(only, sort) {
    const rows = [];
    for (const sub of SUBS) {
      if (only && sub.id !== only) continue;
      sub.posts.forEach((p, i) => rows.push({ sub, p, i }));
    }
    if (sort === 'new') rows.sort((a, b) => hash(b.p[0]) - hash(a.p[0]));
    else rows.sort((a, b) => b.p[2] - a.p[2]);
    return rows.map(r => threadRow(r.sub, r.p, r.i, 3 + (hash(r.p[0]) % 60))).join('');
  }

  const sortBar = (base, sort) => '<div class="sorts"><a href="' + base + '"' + (sort !== 'new' ? ' class="on"' : '') + '>hot</a><a href="' + base + '?sort=new"' + (sort === 'new' ? ' class="on"' : '') + '>new</a></div>';

  function threadHtml(sub, post, idx) {
    const cmts = commentsFor(post, sub);
    /* bodies are written in the same order as the threads, so a post gets the paragraph that describes it */
    const body = sub.bodies[(idx - 1) % sub.bodies.length];
    return '<div class="thread"><p class="meta"><a class="sub" href="/' + sub.id + '">' + sub.name + '</a> · u/' + esc(post[1]) + ' · ' +
      ((hash(post[0]) % 20) + 1) + ' hours ago</p>' +
      '<h1>' + esc(post[0]) + '</h1>' +
      '<div class="body">' + esc(body) + '<p class="meta" style="margin-top:10px">▲ ' + vote(post[2]) + ' · ' + cmts.length + ' comments · <a href="/' + sub.id + '">← ' + sub.name + '</a></p></div>' +
      '<h4 style="font-size:11px;letter-spacing:.14em;text-transform:uppercase;color:#8b95a6">comments</h4>' +
      cmts.map(c => '<div class="cmt"><div class="who">▲ ' + c.score + ' · u/' + esc(c.who) + '</div><p>' + esc(c.line) + '</p>' +
        (c.kids.length ? '<div class="kids">' + c.kids.map(k => '<div class="cmt"><div class="who">▲ ' + k.score + ' · u/' + esc(k.who) + '</div><p>' + esc(k.line) + '</p></div>').join('') + '</div>' : '') + '</div>').join('') +
      '<div class="body" style="margin-top:18px"><form action="/' + sub.id + '/thread/' + idx + '" method="post">' +
      '<label style="font-size:12px;color:#8b95a6">reply as u/guest</label>' +
      '<textarea name="body" rows="4" style="width:100%;box-sizing:border-box;margin-top:6px"></textarea>' +
      '<p><button>post reply</button></p></form></div>' +
      '<p class="meta"><a href="/' + sub.id + '">← back to ' + sub.name + '</a></p></div>';
  }

  function introspace(base) {
    const site = Object.assign({}, base || {}, {
      dark: true, host: base && base.host ? base.host : 'introspace7d2.onion', brand: 'Introspace', icon: '🗨',
      kind: 'Social board', topic: 'forum, board, community, discussion, votes, threads', region: 'Onion space',
      market: false, noSales: true, social: true, tier: 'premium', quality: 'premium',
      tagline: 'A board of boards: markets, opsec, leaks, lost media and a subspace for the aliens.',
      menu: [['Hot', '/'], ['New', '/new'], ['Submit', '/submit'], ['About', '/about'], ['Rules', '/rules']]
    });
    site.render = (path, query) => {
      const p = String(path || '/').replace(/\/+$/, '') || '/';
      const q = query instanceof URLSearchParams ? query : new URLSearchParams(String(query || ''));
      const sort = String(q.get('sort') || '');
      if (p === '/') {
        return {
          status: 200, type: 'text/html', body: ispaceShell(site, 'hot',
            '<div class="note">Simulated board. Threads, votes and replies are generated from their titles; nothing is fetched and no account exists.</div>' +
            sortBar('/', sort) + feedHtml(null, sort))
        };
      }
      if (p === '/new') {
        return { status: 200, type: 'text/html', body: ispaceShell(site, 'new', sortBar('/new', 'new') + feedHtml(null, 'new')) };
      }
      if (p === '/about') {
        return {
          status: 200, type: 'text/html', body: ispaceShell(site, 'About',
            '<h1>About Introspace</h1><p>Introspace is a board of boards: markets, opsec, leaks, high strangeness, tech, music, books, torrents and a subspace for people asking the questions the directory does not answer.</p>' +
            '<p>There are ' + SUBS.length + ' subspaces and ' + SUBS.reduce((n, s) => n + s.posts.length, 0) + ' threads, all simulated inside Moundshroud’s Cyber Desktop. The votes are generated, the users do not exist, and the escrow advice is worth what you paid for it.</p>' +
            '<p class="meta"><a href="/rules">rules</a> · <a href="/">hot</a> · <a href="/new">new</a></p>')
        };
      }
      if (p === '/rules') {
        return {
          status: 200, type: 'text/html', body: ispaceShell(site, 'Rules',
            '<h1>Rules of Introspace</h1><ol><li>No addresses of real people. A leak is about an organisation.</li>' +
            '<li>No clone links, including in a screenshot of a clone.</li>' +
            '<li>Say what you did and what happened, in that order.</li>' +
            '<li>Escrow advice from an account younger than the thread is removed.</li>' +
            '<li>Label fabricated documents. Half the good ones are fabricated; the label is the difference.</li></ol>')
        };
      }
      if (p === '/login' || p === '/register' || p === '/submit') {
        const which = p.slice(1);
        const label = which === 'submit' ? 'Submit a thread' : which === 'login' ? 'Log in' : 'Register';
        const fields = which === 'login'
          ? '<p><label>handle<br><input name="handle" style="width:100%"></label></p><p><label>passphrase<br><input name="pass" type="password" style="width:100%"></label></p>'
          : which === 'register'
            ? '<p><label>handle<br><input name="handle" style="width:100%"></label></p><p><label>passphrase<br><input name="pass" type="password" style="width:100%"></label></p><p class="meta">No email. No recovery. A lost passphrase is a lost account, on purpose.</p>'
            : '<p><label>subspace<br><select name="sub" style="width:100%;padding:8px;background:#0f1115;color:inherit;border:1px solid #262c36;border-radius:8px">' +
              SUBS.map(s => '<option>' + s.name + '</option>').join('') + '</select></label></p><p><label>title<br><input name="title" style="width:100%"></label></p><p><label>text<br><textarea name="body" rows="6" style="width:100%"></textarea></label></p>';
        return {
          status: 200, type: 'text/html', body: ispaceShell(site, label,
            '<h1>' + label + '</h1><form action="/' + which + '" method="post">' + fields +
            '<p><button>' + label.toLowerCase() + '</button></p></form><p class="meta">This board is simulated: nothing is created and nothing is sent.</p>')
        };
      }
      if (p === '/search') {
        const term = String(q.get('q') || '').trim().toLowerCase();
        const hits = [];
        if (term) for (const sub of SUBS) sub.posts.forEach((x, i) => { if ((x[0] + ' ' + x[1] + ' ' + sub.name).toLowerCase().includes(term)) hits.push({ sub, x, i }); });
        return {
          status: 200, type: 'text/html', q: String(q.get('q') || ''),
          body: ispaceShell(site, 'Search', '<h1>Search</h1>' +
            '<form action="/search" method="get" style="margin:10px 0"><input name="q" value="' + esc(String(q.get('q') || '')) + '" style="width:70%"> <button>search</button></form>' +
            (term ? (hits.length ? hits.map(h => threadRow(h.sub, h.x, h.i, 3 + (hash(h.x[0]) % 40))).join('') : '<p class="meta">Nothing matched “' + esc(term) + '”. Try <a href="/search?q=escrow">escrow</a>, <a href="/search?q=aliens">aliens</a> or <a href="/search?q=opsec">opsec</a>.</p>')
              : '<p class="meta">Search threads and users. Popular: <a href="/search?q=escrow">escrow</a> · <a href="/search?q=opsec">opsec</a> · <a href="/search?q=leak">leak</a> · <a href="/search?q=radio">radio</a>.</p>') +
            '<p class="meta"><a href="/">← hot</a></p>')
        };
      }
      const dm = /^\/u\/([a-z0-9_\-]+)$/i.exec(p);
      if (dm) {
        const who = dm[1].toLowerCase();
        const mine = [];
        for (const sub of SUBS) sub.posts.forEach((x, i) => { if (x[1].toLowerCase() === who) mine.push({ sub, x, i }); });
        return {
          status: 200, type: 'text/html', body: ispaceShell(site, 'u/' + who,
            '<h1>u/' + esc(who) + '</h1><p class="meta">' + (mine.length ? mine.length + ' threads · ' + (hash(who) % 9 + 1) + ' years on the board' : 'No threads under that handle.') + '</p>' +
            (mine.length ? mine.map(m => threadRow(m.sub, m.x, m.i, 3 + (hash(m.x[0]) % 30))).join('') : '<p class="meta">Try <a href="/search?q=' + encodeURIComponent(who) + '">a search</a>, or <a href="/">the front page</a>.</p>'))
        };
      }
      const th = /^\/([a-z]+)\/thread\/(\d+)$/.exec(p);
      if (th) {
        const sub = SUBS.find(s => s.id === th[1]);
        if (sub) {
          const idx = Number(th[2]);
          const post = sub.posts[idx - 1];
          if (post) return { status: 200, type: 'text/html', body: ispaceShell(site, post[0], threadHtml(sub, post, idx), { sub: sub.id }) };
          return { status: 404, type: 'text/html', body: ispaceShell(site, 'Gone', '<h1>That thread is gone</h1><p class="meta"><a href="/' + sub.id + '">← ' + sub.name + '</a></p>') };
        }
      }
      const sub = SUBS.find(s => s.id === p.slice(1));
      if (sub) {
        return {
          status: 200, type: 'text/html', body: ispaceShell(site, sub.title,
            '<h1>' + sub.name + ' <span style="font-size:14px;color:#8b95a6;font-weight:400">' + esc(sub.title) + '</span></h1>' +
            '<p class="meta">' + esc(sub.blurb) + '</p>' + sortBar('/' + sub.id, sort) + feedHtml(sub.id, sort), { sub: sub.id })
        };
      }
      return { status: 404, type: 'text/html', body: ispaceShell(site, 'Not found', '<h1>Nothing at ' + esc(p) + '</h1><p class="meta"><a href="/">← front page</a></p>') };
    };
    return site;
  }

  /* the wiki's directory calls this for every entry whose kind is blog or social */
  function build(entry) {
    if (!entry) return null;
    if (entry.kind === 'blog') return blogSite(entry);
    if (entry.kind === 'social') {
      const base = A.darkGen && A.darkGen.makeSite ? A.darkGen.makeSite(entry.host) : { host: entry.host };
      const made = introspace(base);
      made.brand = entry.name; made.icon = '🗨'; made.tagline = entry.blurb;
      return made;
    }
    return null;
  }

  A.darkSocial = {
    blogs: () => BLOGS.map(b => ({ name: b.name.replace('&amp;', '&'), about: b.about, posts: b.posts.map(p => ({ title: p[0], date: p[1], tags: p[2].slice() })) })),
    subspaces: () => SUBS.map(s => ({ id: s.id, name: s.name.replace('&amp;', '&'), title: s.title.replace('&amp;', '&'), threads: s.posts.length })),
    build, blogSite, introspace
  };
})();

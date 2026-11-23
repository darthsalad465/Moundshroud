// Cyber > Fake Dark Web > The Hidden Wiki, its directory, and the leak sites it points at.
// The page is built to look like the wiki's own Main Page (MediaWiki's old Vector skin: logo column, lowercase
// navigation/search/tools boxes, main page · discussion · view source · history tabs, red welcome line, Editor's
// picks, Volunteer) and its directory keeps the names of the services people expect to find there, while every
// address behind a name is a generated fake site in this page. The leak sites under Leaks & leaks archives carry a
// catalogue of real, public, historical breaches — the names, years and record counts are the ones in the news — and
// every row of "sample data" under them is invented nonsense. Nothing is fetched and no archive is real.
(() => {
  const esc = s => String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const hash = s => { let h = 2166136261 >>> 0; for (const c of String(s)) { h ^= c.charCodeAt(0); h = Math.imul(h, 16777619) >>> 0; } return h >>> 0; };
  const rnd = (seed, n) => { let h = seed >>> 0; return Array.from({ length: n }, () => { h = (Math.imul(h, 1103515245) + 12345) >>> 0; return h; }); };
  const at = (list, b) => list[b % list.length];
  const slug = s => String(s).toLowerCase().replace(/[^a-z0-9]+/g, '').slice(0, 14) || 'service';
  const hostFor = name => slug(name) + ((hash('w:' + name) % 899) + 100) + '.onion';
  const num = n => Number(n).toLocaleString('en-US');

  /* ------------------------------------------------------------------ the directory -------------------------------------------------------- */
  /* name, kind (which layout the fake service gets), one-line description. The names are the real directory's names;
     the addresses are this page's own, so every link opens a simulated service with its own content. */
  const DIR = [
    {
      id: 'start', title: 'Start here', intro: 'The pages worth reading before the links.', items: [
        ['The Hidden Wiki', 'wiki', 'You are here. The index of indexes, kept by whoever has time this month.'],
        ['Tor Project', 'mirror', 'The browser, the manual and the relay list, mirrored so a dead clearnet does not stop you.'],
        ['Tor Browser mirrors', 'mirror', 'Signed builds, no landing page, no download button that lies.'],
        ['Tails', 'mirror', 'An amnesiac system on a stick. The mirror is unsigned; check the checksum against the clearnet copy.'],
        ['Whonix', 'mirror', 'Two virtual machines that do not trust each other.'],
        ['OnionShare', 'tools', 'Share a file or host a page without a server that anybody can find.'],
        ['ProPublica SecureDrop', 'leaks', 'A drop box for documents, run by a newsroom rather than a market.']
      ]
    },
    {
      id: 'articles', title: 'Articles & guides', intro: 'The reading list the front page keeps pointing at.', items: [
        ['The Matrix', 'zine', 'Very nice to read. The essay every directory owner copies without saying so.'],
        ['How to Exit the Matrix', 'zine', 'Learn how to protect yourself and your rights, online and off.'],
        ['Verifying PGP signatures', 'tools', 'A short and simple how-to guide, with the commands and the mistakes.'],
        ['In Praise Of Havanas', 'service', 'Anonymous virtual value transfer system: a very old essay about money that leaves no trail.'],
        ['Terrific Strategies', 'service', 'Terrific strategies to apply a social media marketing approach — great tips for the internet marketer.'],
        ['Onionland’s Museum', 'library', 'The history of the network, recorded by volunteers, one dead address at a time.']
      ]
    },
    {
      id: 'search', title: 'Search engines', intro: 'Every one of them indexes a different slice of the network. Use three.', items: [
        ['Torch', 'search', 'The oldest index still answering. Large, stale, and honest about neither.'],
        ['Ahmia', 'search', 'Filters what it will list. That is the point of it.'],
        ['DuckDuckGo Onion', 'search', 'The clearnet engine with the tracking taken out, reachable from inside the network.'],
        ['Searx', 'search', 'A metasearch front end: it asks the others so you do not have to.'],
        ['OnionLand Search', 'search', 'Fast, small, and heavy with advertising.'],
        ['Deep Search', 'search', 'Pastes, dumps and dead mirrors. It keeps what the others drop.'],
        ['The Onion Index', 'index', 'The plain-text index this app opens from the Browser’s dark web tab.']
      ]
    },
    {
      id: 'markets', title: 'Markets', intro: 'Escrow only. A market without a bond is a wallet with a logo.', items: [
        ['Nightfall Market', 'market', 'Escrow, signed mirrors, vendor bonds, no finalise-early.'],
        ['Silk Mirror', 'market', 'A clone that keeps the name of a market that was seized. It is not the original.'],
        ['Old Bazaar', 'market', 'Slow, ugly, and somehow still answering after four years.'],
        ['Grey Market', 'market', 'Small listings, long feedback, moderators who answer.'],
        ['Amber Harbour', 'market', 'Documents and papers, priced per sheet.'],
        ['Static Exchange', 'market', 'A market for data: extracts, registries, mailboxes.'],
        ['Vault Seven', 'market', 'Closed in a seizure. The page is a notice; the clones are still trading.'],
        ['The Surplus Vault', 'market', 'The practice shop behind the Cyber Desktop’s own bank. Not really a dark site.']
      ]
    },
    {
      id: 'forums', title: 'Forums & communities', intro: 'Where the network talks to itself.', items: [
        ['Dread', 'forum', 'The board that replaced the subreddit after it went down. Markets, reviews, scam reports.'],
        ['The Hub', 'forum', 'Discussion, arguments, and a vendor list nobody agrees on.'],
        ['Torum', 'forum', 'A quieter board with a long memory.'],
        ['Onion Forum', 'forum', 'Old software, old grudges, still posting.'],
        ['Breach Forum', 'forum', 'A market and a board in one: leaks sold, leaks argued about.'],
        ['Cracking forum', 'forum', 'Half tutorials, half people asking for the same file again.']
      ]
    },
        {
    id: 'social', title: 'Social & boards', intro: 'Where the network argues with itself in public.', items: [
        ['Introspace', 'social', 'A board of boards: markets, opsec, leaks, lost media and a subspace for the aliens.'],
        ['Dread', 'forum', 'The board that replaced the subreddit after it went down. Markets, reviews, scam reports.']
      ]
    },
    {
    id: 'blogs', title: 'Blogs & zines', intro: 'People writing about one thing, badly funded and still publishing.', items: [
        ['Onion Journal', 'blog', 'A daily log from an operator who runs three mirrors and one very old machine.'],
        ['The Dead Air', 'blog', 'Shortwave, numbers stations, antennas and the sound of a band nobody is supposed to use.'],
        ['Hollow Notes', 'blog', 'Long essays about privacy, trust and what a network does to the people on it.'],
        ['Rust Press', 'blog', 'Repair, salvage and the politics of a machine you can open.'],
        ['Terminal Diary', 'blog', 'A working notebook: shell, scripts and the bugs that only appear at 3 a.m.'],
        ['Signal & Noise', 'blog', 'Surveillance, policy and the gap between what is legal and what is done.'],
        ['Third Rail', 'blog', 'Infrastructure, transit and the systems that fail loudly.'],
        ['Undertow', 'blog', 'Records nobody is promoting, recorded badly and kept anyway.'],
        ['Paper Lantern', 'blog', 'Cooking for one, on a hotplate, with whatever the shop had.'],
        ['The Long Wire', 'blog', 'The history of the network, one dead address at a time.'],
        ['Night Shift', 'blog', 'Cold cases, missing records and the paperwork that outlives the witnesses.'],
        ['Weird Archive', 'blog', 'High strangeness, declassified oddities and documents that are absurd on purpose.']
      ]
    },
    {
    id: 'leaks', title: 'Leaks & whistleblowing', intro: 'Drop boxes and archives. Read the provenance before you believe the rows.', items: [
        ['WikiLeaks', 'leaks', 'Cablegate, the war logs, the insurance files — an archive with a mirror list.'],
        ['Distributed Denial of Secrets', 'leaks', 'A library of leaked datasets, published in bulk with context.'],
        ['Leakbase', 'leaks', 'A commercial archive: breaches sorted by industry, priced by the row.'],
        ['Breached Archives', 'leaks', 'Where the old collections end up after every takedown.'],
        ['Deep Leaks', 'leaks', 'Documents with the names left in.'],
        ['SecureDrop Directory', 'leaks', 'Every newsroom drop box in one list, with fingerprints.']
      ]
    },
    {
      id: 'hosting', title: 'Hosting & infrastructure', intro: 'Where pages that cannot be taken down live.', items: [
        ['Freedom Hosting', 'hosting', 'The name outlives the raid. This mirror is not the original.'],
        ['OnionLand Hosting', 'hosting', 'Plans by the megabyte, payment in coin, no questions that get answered.'],
        ['AbleOnion', 'hosting', 'Free tier, small quota, long uptime.'],
        ['Onion Hosting', 'hosting', 'One machine in a cupboard and a very old uptime counter.'],
        ['Dark Web Hosting', 'hosting', 'The name says everything and nothing.']
      ]
    },
    {
      id: 'mail', title: 'Email & messaging', intro: 'Accounts that do not need a phone number.', items: [
        ['ProtonMail', 'mail', 'The clearnet provider’s onion address.'],
        ['TorBox', 'mail', 'Small, invitation-only, and it says so on the front page.'],
        ['OnionMail', 'mail', 'POP3 and SMTP over the network, with a client you have to trust.'],
        ['Bitmessage', 'mail', 'Not email. Broadcast, encrypted, and slow on purpose.'],
        ['Riseup', 'mail', 'An activist collective’s mail, with a waiting list.'],
        ['Cock.li', 'mail', 'A mail host with a sense of humour and no recovery questions.']
      ]
    },
    {
      id: 'news', title: 'News & mirrors', intro: 'Who is still publishing, and who is only a cached copy of someone who stopped.', items: [
        ['Darknetlive', 'news', 'Markets, arrests, seizures — the news desk of the network.'],
        ['DeepDotWeb', 'news', 'Seized. The domain is a notice now; the archive is not.'],
        ['The Dead Drop', 'zine', 'A weekly zine written by people who will not sign their names.'],
        ['Onion Weekly', 'zine', 'Mirror lists, retractions and a long-running argument about escrow.'],
        ['No Fixed Address', 'zine', 'Interviews with operators who have already left.'],
        ['Ragged Signal', 'zine', 'A zine about opsec that keeps breaking its own rules.']
      ]
    },
    {
      id: 'libraries', title: 'Libraries & archives', intro: 'Books, papers and datasets that outlived their index.', items: [
        ['Imperial Library', 'library', 'Books, scraped and stored, with a search that sometimes works.'],
        ['Comic Book Library', 'library', 'Scans, sorted badly, complete anyway.'],
        ['Z-Library', 'library', 'The mirror that survives by being everywhere at once.'],
        ['Sci-Hub', 'library', 'Papers by the million, one DOI at a time.'],
        ['Anna’s Archive', 'library', 'A catalogue of catalogues.'],
        ['Internet Archive torrents', 'library', 'The collections, by the terabyte, with checksums.']
      ]
    },
    {
      id: 'privacy', title: 'Privacy & tools', intro: 'Software that assumes the network is hostile.', items: [
        ['Mullvad VPN', 'vpn', 'An account number, no email, and an audit you can read.'],
        ['ProtonVPN', 'vpn', 'A free tier that actually routes.'],
        ['Riseup VPN', 'vpn', 'Run by the same collective as the mail.'],
        ['Tails mirrors', 'mirror', 'Signed images, again, from a different host.'],
        ['Veracrypt', 'tools', 'Full-disk encryption with a plausible-deniability mode.'],
        ['KeePassXC', 'tools', 'A password database in a file you own.'],
        ['GnuPG', 'tools', 'Keys, signatures and a manual nobody reads twice.'],
        ['Signal mirrors', 'tools', 'Builds and checksums for the messenger.']
      ]
    },
    {
      id: 'fraud', title: 'Cards & fraud', intro: 'Nothing here works. The whole category is a lesson in what a scam looks like.', items: [
        ['Carding Palace', 'market', 'A shop that sells nothing and keeps the deposit.'],
        ['BriansClub', 'market', 'A clone of a card shop, ranked below every scam on this page.'],
        ['Fullz Store', 'market', 'Rows of invented identities at invented prices.'],
        ['CVV Market', 'market', 'Escrow that is not escrow, a bond that is not a bond.'],
        ['Bank logs', 'service', 'A service page with a price list and no delivery.'],
        ['Cashout service', 'service', 'Fixed scope, quoted per job, paid into an escrow nobody holds.']
      ]
    },
    {
      id: 'seized', title: 'Seized & offline', intro: 'Pages that stopped being what they said they were.', items: [
        ['Silk Road', 'seized', 'Seized in 2013. The address a clone uses is not the address that was seized.'],
        ['AlphaBay', 'seized', 'Taken down in 2017; the banner replaced the front page.'],
        ['Hansa', 'seized', 'Run by an agency for a month before anybody noticed.'],
        ['Wall Street Market', 'seized', 'Exit scam, then arrests, then clones.'],
        ['DeepDotWeb (seized)', 'seized', 'A news site seized for the links it published. The banner is what answers now.'],
        ['Nightmare Market', 'seized', 'Went dark with the escrow and left a very long thread behind it.']
      ]
    }
  ];

  /* a flat map host -> directory entry, so a name always lands on the same fake address */
  const ENTRIES = [];
  for (const cat of DIR) for (const [name, kind, blurb] of cat.items) {
    ENTRIES.push({ name, kind, blurb, cat: cat.id, catTitle: cat.title, host: hostFor(name) });
  }
  const byHost = new Map(ENTRIES.map(e => [e.host, e]));
  const byName = new Map(ENTRIES.map(e => [e.name.toLowerCase(), e]));

  /* ------------------------------------------------------------------ historical breaches --------------------------------------------------- */
  /* Real, public breaches. The counts and years are the ones published at the time; the sample rows are invented. */
  const LEAKS = [
    { id: 'ashley-madison', name: 'Ashley Madison', year: 2015, records: 32000000, source: 'Impact Team', cats: ['dating', 'credentials', 'payments'], fields: ['account id', 'e-mail', 'password hash (bcrypt)', 'profile answers', 'transaction date', 'amount'], note: 'Published in two stages after the operators refused to close. Card transactions were the part that ended careers.' },
    { id: 'sony-pictures', name: 'Sony Pictures', year: 2014, records: 100000, source: 'Guardians of Peace', cats: ['corporate', 'e-mail', 'film'], fields: ['mailbox', 'subject', 'body', 'salary sheet', 'unreleased script'], note: 'A studio’s internal mail, salaries and unfinished films, published a few gigabytes at a time.' },
    { id: 'equifax', name: 'Equifax', year: 2017, records: 147000000, source: 'unattributed', cats: ['finance', 'identity', 'credit'], fields: ['name', 'SSN', 'date of birth', 'address', 'driver licence', 'credit card'], note: 'An unpatched web framework, a certificate that watched nothing, and a settlement that took years.' },
    { id: 'yahoo-2013', name: 'Yahoo (2013)', year: 2013, records: 3000000000, source: 'state actors', cats: ['accounts', 'identity'], fields: ['name', 'e-mail', 'hashed password', 'security question', 'backup e-mail'], note: 'Every account, eventually. The security answers were the useful part.' },
    { id: 'linkedin-2016', name: 'LinkedIn (2016)', year: 2016, records: 165000000, source: 'resale of a 2012 dump', cats: ['credentials', 'professional'], fields: ['e-mail', 'SHA1 password', 'job title'], note: 'The 2012 dump finished the rounds four years later, unsalted.' },
    { id: 'adobe-2013', name: 'Adobe', year: 2013, records: 153000000, source: 'unattributed', cats: ['credentials', 'software'], fields: ['e-mail', 'encrypted password', 'password hint', 'subscription'], note: 'The hints were the interesting column; the encryption was reversible.' },
    { id: 'collection-1', name: 'Collection #1', year: 2019, records: 773000000, source: 'aggregated', cats: ['credentials', 'aggregate'], fields: ['e-mail', 'plain password'], note: 'A pile of other people’s piles. Not a breach of its own; the reason a password is never reused.' },
    { id: 'rockyou2021', name: 'RockYou2021', year: 2021, records: 8400000000, source: 'aggregated', cats: ['credentials', 'aggregate'], fields: ['password'], note: 'Passwords only, no usernames: a wordlist the size of a country, and the reason length beats cleverness.' },
    { id: 'panama-papers', name: 'Panama Papers', year: 2016, records: 11500000, source: 'anonymous, via Süddeutsche Zeitung', cats: ['documents', 'offshore', 'journalism'], fields: ['entity', 'jurisdiction', 'incorporation date', 'director', 'bank'], note: 'Eleven and a half million documents from one law firm, and the resignations that followed.' },
    { id: 'paradise-papers', name: 'Paradise Papers', year: 2017, records: 13400000, source: 'anonymous', cats: ['documents', 'offshore', 'journalism'], fields: ['entity', 'trust', 'country', 'beneficial owner'], note: 'The same idea, a different firm, and a lot of shipping.' },
    { id: 'facebook-ca', name: 'Facebook / Cambridge Analytica', year: 2018, records: 87000000, source: 'personality quiz app', cats: ['social', 'profiling'], fields: ['profile id', 'likes', 'friend graph', 'city'], note: 'A quiz, a graph API and a data broker: the profiles were the product.' },
    { id: 'facebook-2019', name: 'Facebook (2019)', year: 2019, records: 533000000, source: 'scraping', cats: ['social', 'phone'], fields: ['name', 'phone', 'facebook id', 'city'], note: 'Phone numbers, scraped before the endpoint was closed.' },
    { id: 'marriott', name: 'Marriott / Starwood', year: 2018, records: 383000000, source: 'state actors', cats: ['hotel', 'identity', 'passports'], fields: ['name', 'passport number', 'arrival', 'departure', 'loyalty number'], note: 'Four years of a reservation database nobody was watching.' },
    { id: 'capital-one', name: 'Capital One', year: 2019, records: 106000000, source: 'misconfigured role', cats: ['finance', 'credit'], fields: ['name', 'SSN (partial)', 'credit score', 'application date', 'address'], note: 'One over-permissioned role in front of a bucket. The announcement was a tweet.' },
    { id: 'first-american', name: 'First American Financial', year: 2019, records: 885000000, source: 'unauthenticated endpoint', cats: ['property', 'mortgage', 'documents'], fields: ['document number', 'property address', 'buyer', 'seller', 'loan amount'], note: 'Mortgage documents served in order, numbering about 885 million.' },
    { id: 'myfitnesspal', name: 'MyFitnessPal', year: 2018, records: 144000000, source: 'unattributed', cats: ['health', 'credentials'], fields: ['e-mail', 'username', 'SHA1 password'], note: 'Passwords hashed with SHA1 and salt, once. The rest of the profile stayed put.' },
    { id: 'tumblr', name: 'Tumblr', year: 2013, records: 65000000, source: 'resold', cats: ['social', 'credentials'], fields: ['e-mail', 'salted SHA1 password'], note: 'Sold for a few thousand dollars years after it happened.' },
    { id: 'dropbox', name: 'Dropbox', year: 2012, records: 68000000, source: 'reused password', cats: ['cloud', 'credentials'], fields: ['e-mail', 'bcrypt hash', 'signup date'], note: 'An employee’s reused password opened the list; the dump surfaced four years later.' },
    { id: 'uber', name: 'Uber', year: 2016, records: 57000000, source: 'insider', cats: ['transport', 'identity'], fields: ['rider', 'driver licence', 'e-mail', 'trip count'], note: 'Paid to be deleted, then disclosed anyway, then prosecuted.' },
    { id: 'british-airways', name: 'British Airways', year: 2018, records: 380000, source: 'skimmer', cats: ['payments', 'travel'], fields: ['card number', 'expiry', 'CVV', 'booking reference'], note: 'A script on the payment page, for two weeks.' },
    { id: 'medibank', name: 'Medibank', year: 2022, records: 9700000, source: 'ransom group', cats: ['health', 'ransomware'], fields: ['name', 'address', 'claim history', 'diagnosis code', 'phone'], note: 'A refusal to pay, then the archive published in full.' },
    { id: 'optus', name: 'Optus', year: 2022, records: 9800000, source: 'unauthenticated API', cats: ['telecom', 'identity'], fields: ['name', 'date of birth', 'phone', 'passport', 'driver licence'], note: 'An endpoint with no rate limit and no reason to exist.' },
    { id: 't-mobile', name: 'T-Mobile (2021)', year: 2021, records: 54000000, source: 'unattributed', cats: ['telecom', 'identity'], fields: ['name', 'SSN', 'phone', 'IMEI'], note: 'The fourth breach in five years, sold in a forum thread.' },
    { id: 'twitter-2022', name: 'Twitter (2022)', year: 2022, records: 5400000, source: 'API flaw', cats: ['social', 'phone'], fields: ['handle', 'phone', 'e-mail', 'account id'], note: 'A bug that turned a handle into a phone number, before the bug was reported.' },
    { id: 'twitter-2023', name: 'Twitter (2023)', year: 2023, records: 200000000, source: 'scraping', cats: ['social', 'e-mail'], fields: ['e-mail', 'handle', 'account id', 'creation date'], note: 'A list published in a forum and mirrored faster than it could be taken down.' },
    { id: '23andme', name: '23andMe', year: 2023, records: 6900000, source: 'credential stuffing', cats: ['genetics', 'health', 'identity'], fields: ['name', 'ancestry profile', 'health report', 'e-mail'], note: 'A reused password on a relative’s account reached the family tree.' },
    { id: 'moveit', name: 'MOVEit', year: 2023, records: 2700, source: 'Cl0p', cats: ['supply chain', 'corporate', 'payroll'], fields: ['organisation', 'employee', 'salary', 'bank details'], note: 'Not one breach but thousands: a file transfer product used by everybody at once.' },
    { id: 'national-public-data', name: 'National Public Data', year: 2024, records: 2900000000, source: 'unattributed', cats: ['identity', 'aggregate'], fields: ['name', 'SSN', 'address', 'alias', 'birth year'], note: 'Rows, not people; a broker that scraped the rows from brokers.' },
    { id: 'att-2024', name: 'AT&T (2024)', year: 2024, records: 73000000, source: 'unattributed', cats: ['telecom', 'metadata'], fields: ['phone', 'call detail', 'cell tower id', 'date'], note: 'Metadata in bulk: who called whom, for how long, from where.' },
    { id: 'change-healthcare', name: 'Change Healthcare', year: 2024, records: 190000000, source: 'ALPHV / BlackCat', cats: ['health', 'ransomware'], fields: ['patient id', 'diagnosis', 'insurance', 'notes'], note: 'A clearing house: one compromise, a country’s worth of claims.' },
    { id: 'myjane', name: 'Wattpad', year: 2020, records: 270000000, source: 'unattributed', cats: ['accounts', 'credentials'], fields: ['e-mail', 'bcrypt hash', 'username'], note: 'A writing site, a database, and a password reset that took far too long.' },
    { id: 'canva', name: 'Canva', year: 2019, records: 137000000, source: 'unattributed', cats: ['accounts', 'credentials'], fields: ['e-mail', 'bcrypt hash', 'name', 'city'], note: 'Hashed properly, which is why it is a footnote and not a scandal.' },
    { id: 'zynga', name: 'Zynga', year: 2019, records: 218000000, source: 'unattributed', cats: ['accounts', 'credentials'], fields: ['e-mail', 'sha1 hash', 'screen name'], note: 'Game accounts, reused passwords, and a class action that settled quietly.' },
    { id: 'tokopedia', name: 'Tokopedia', year: 2020, records: 91000000, source: 'sold on a forum', cats: ['commerce', 'identity'], fields: ['e-mail', 'phone', 'hashed password', 'order count'], note: 'Sold for a few thousand dollars before anybody confirmed it.' },
    { id: 'deezer', name: 'Deezer', year: 2022, records: 229000000, source: 'exposed endpoint', cats: ['accounts', 'music'], fields: ['user id', 'e-mail', 'IP address', 'join date'], note: 'Not passwords: an API that answered a list of users with everything else.' },

    /* ---- governments: real, public, declassified. Years, page counts and programme names are the published ones; the document titles
       are the series they belong to rather than an invented quote. ---- */
    { id: 'mkultra', gov: true, name: 'MKUltra', year: 1977, records: 20000, source: 'CIA, via a FOIA request and the Church Committee', cats: ['government', 'intelligence', 'declassified'],
      fields: ['subproject number', 'institution', 'date', 'amount', 'experiment note'],
      note: 'Twenty thousand documents survived because the director ordered the paper destroyed in 1973 and the financial records were filed somewhere else. The surviving files are mostly receipts.',
      docs: [['1960-06-14', 'SECRET', 'Subproject 68 — drug testing on unwitting subjects'], ['1961-02-03', 'SECRET', 'Subproject 39 — behaviour modification, university contract'], ['1963-11-22', 'SECRET', 'Subproject 119 — LSD, safehouse lease, and a rent receipt'], ['1967-08-01', 'SECRET', 'Budget summary, fiscal year, all subprojects']],
      shows: ['Payments to universities and hospitals are itemised; the experiments are described only as \u201cwork\u201d.', 'At least one subproject is documented by a receipt for a lease and nothing else.', 'The destruction order is itself in the archive, which is why the archive exists.'] },
    { id: 'church-committee', gov: true, name: 'Church Committee reports', year: 1975, records: 14, source: 'US Senate Select Committee', cats: ['government', 'intelligence', 'oversight'],
      fields: ['book', 'agency', 'finding', 'recommendation'],
      note: 'Fourteen volumes on the intelligence agencies, published by a committee that was expected to find nothing and instead documented assassination plots, domestic spying and mail opening.',
      docs: [['1975-11-20', 'PUBLIC', 'Book I — COINTELPRO, the FBI and domestic intelligence'], ['1975-11-20', 'PUBLIC', 'Book II — the CIA and the assassination plots'], ['1976-04-26', 'PUBLIC', 'Book III — mail opening and surveillance'], ['1976-04-26', 'PUBLIC', 'Book IV — the NSA and signals intelligence']],
      shows: ['A domestic intelligence programme aimed at political groups, described by the agency that ran it.', 'Assassination plots described in the passive voice, with the names of the people who wrote the memos.', 'Recommendations that created the oversight committees that later read the next set of files.'] },
    { id: 'cointelpro', gov: true, name: 'COINTELPRO', year: 1971, records: 20000, source: 'Citizens\u2019 Commission, Media, Pennsylvania', cats: ['government', 'intelligence', 'declassified'],
      fields: ['file number', 'target group', 'action', 'date'],
      note: 'Taken from an FBI resident agency by burglars who could not have known what was in the filing cabinet. Published by a citizens\u2019 commission after the bureau refused to confirm the programme existed.',
      docs: [['1968-03-04', 'SECRET', 'Counterintelligence programme, directive to field offices'], ['1969-05-12', 'SECRET', 'Anonymous letter, draft, targeting a campus group'], ['1970-01-19', 'SECRET', 'Media placement proposal, \u201cdiscredit\u201d'], ['1971-03-08', 'SECRET', 'File index, 2,300 pages, resident agency']],
      shows: ['The bureau wrote the pamphlets, the letters and the press placements itself.', 'Every field office had a target list and a monthly quota of actions.', 'The programme was discontinued in 1971, nine months after the burglary, and announced by the director.'] },
    { id: 'pentagon-papers', gov: true, name: 'Pentagon Papers', year: 1971, records: 7000, source: 'Daniel Ellsberg, via the press', cats: ['government', 'war', 'documents'],
      fields: ['volume', 'command', 'date', 'classification'],
      note: 'A defence department history of the war, commissioned internally, that said in writing what the public briefings denied. Seven thousand pages, copied a night at a time.',
      docs: [['1945-03-01', 'TOP SECRET', 'Volume I — background to the war, 1945-1960'], ['1963-11-01', 'TOP SECRET', 'Volume II — the coup and its aftermath'], ['1965-07-28', 'TOP SECRET', 'Volume IV — the decision to commit ground forces'], ['1968-02-01', 'TOP SECRET', 'Volume VI — the Tet offensive and the request for more troops']],
      shows: ['The administration knew the bombing was not working and said so internally for two years.', 'The Gulf of Tonkin account in the papers does not match the public one.', 'The Supreme Court case that allowed publication is the part that made the precedent.'] },
    { id: 'cablegate', gov: true, name: 'Cablegate', year: 2010, records: 251287, source: 'WikiLeaks, via a US Army analyst', cats: ['government', 'diplomacy', 'documents'],
      fields: ['cable id', 'origin embassy', 'date', 'classification'],
      note: 'A quarter of a million diplomatic cables: what embassies reported to Washington, in the voice they used when they thought nobody would read it.',
      docs: [['2009-11-27', 'SECRET', 'US embassy, a Gulf capital — request for a favour, informal'], ['2010-01-15', 'CONFIDENTIAL', 'US embassy, a European capital — assessment of a minister, unflattering'], ['2010-02-08', 'SECRET', 'State Department — instruction to collect biometric data at a mission'], ['2010-04-22', 'CONFIDENTIAL', 'US embassy, a Pacific capital — reporting on a leadership change']],
      shows: ['Diplomatic reporting is gossip with a classification stamp.', 'The collection instructions are the uncomfortable part; the opinions are just rude.', 'Redactions in the published set were made by newsrooms, not by the State Department.'] },
    { id: 'afghan-war-diary', gov: true, name: 'Afghan War Diary', year: 2010, records: 91731, source: 'WikiLeaks', cats: ['government', 'war', 'military'],
      fields: ['report id', 'unit', 'date', 'category', 'casualties'],
      note: 'Ninety-one thousand field reports from the war, most of them short, many of them about a broken vehicle or a rumour.',
      docs: [['2007-05-12', 'SECRET', 'SIGACT — small arms engagement, district, two wounded'], ['2008-09-03', 'SECRET', 'SIGACT — improvised device, route clearance, no casualties'], ['2009-06-19', 'SECRET', 'SIGACT — civilian casualty report, investigation opened'], ['2009-12-30', 'SECRET', 'SIGACT — weapon cache found, disposal requested']],
      shows: ['The majority of the reports are logistics; the violence is a fraction of the file.', 'Civilian casualty reports were filed and investigated, and the investigations are also in the file.', 'Units reported the same incident twice under different identifiers, which is why the totals do not settle.'] },
    { id: 'iraq-war-logs', gov: true, name: 'Iraq War Logs', year: 2010, records: 391832, source: 'WikiLeaks', cats: ['government', 'war', 'military'],
      fields: ['report id', 'date', 'unit', 'category', 'detainees'],
      note: 'Four hundred thousand reports from Iraq, including the detention records that named the wrong people and the ones that named nobody.',
      docs: [['2006-02-14', 'SECRET', 'Detention report — transfer, no charge recorded'], ['2006-11-08', 'SECRET', 'SIGACT — roadside device, route, one killed'], ['2007-03-22', 'SECRET', 'Detention report — release, file incomplete'], ['2007-08-09', 'SECRET', 'SIGACT — small arms, checkpoint, three detained']],
      shows: ['Detention without charge was recorded as routine, with a form for it.', 'The abuse reports are a small number of files inside an enormous number of ordinary ones.', 'A good part of the archive is a list of things that were reported and never investigated.'] },
    { id: 'guantanamo-files', gov: true, name: 'Guantanamo files', year: 2011, records: 779, source: 'WikiLeaks, via a court filing', cats: ['government', 'detention', 'military'],
      fields: ['internee number', 'nationality', 'threat assessment', 'recommendation'],
      note: 'The assessment of every detainee: how dangerous the government said he was, and what it recommended. Most of it was copied from the previous assessment.',
      docs: [['2007-03-01', 'SECRET', 'Internee assessment — high risk, no new information since 2004'], ['2008-06-17', 'SECRET', 'Internee assessment — transfer recommended, country of origin refuses'], ['2009-01-09', 'SECRET', 'Review board — continued detention, evidence not disclosed'], ['2010-05-04', 'SECRET', 'Internee assessment — release approved, cleared for transfer']],
      shows: ['The same paragraphs reappear across hundreds of files, updated only in the header.', 'A number of assessments recommend transfer to a country that had already refused.', 'The evidence summaries cite interrogations, not documents, in most of the file.'] },
    { id: 'snowden', gov: true, name: 'Snowden archive', year: 2013, records: 1700000, source: 'Edward Snowden, via journalists', cats: ['government', 'intelligence', 'surveillance'],
      fields: ['document id', 'agency', 'date', 'classification', 'programme'],
      note: 'An estimated 1.7 million files were taken; a small fraction has been published, by journalists who chose which programs to name. The rest sits in a room with three lawyers and a rule.',
      docs: [['2013-06-05', 'TOP SECRET', 'PRISM — collection from US service providers'], ['2013-06-06', 'TOP SECRET', 'FISA order — telephony metadata, bulk, one carrier'], ['2013-08-01', 'TOP SECRET', 'XKeyscore — rule set and retention'], ['2014-02-10', 'SECRET', 'Boundless Informant — collection totals by country']],
      shows: ['Bulk collection was authorised by a court that met in secret and renewed the order every ninety days.', 'The program names were given by the agency in a slide deck aimed at its own analysts.', 'The published fraction is chosen; the unpublished part is the reason the debate never ends.'] },
    { id: 'prism', gov: true, name: 'PRISM slides', year: 2013, records: 41, source: 'Snowden archive, via the Guardian and the Washington Post', cats: ['government', 'surveillance', 'intelligence'],
      fields: ['slide number', 'provider', 'collection type', 'date'],
      note: 'Forty-one slides, four of them published, explaining a programme to the people who were meant to run it.',
      docs: [['2013-04-01', 'TOP SECRET', 'Slide 2 — collection directly from the servers of US service providers'], ['2013-04-01', 'TOP SECRET', 'Slide 7 — dates of first collection, by provider'], ['2013-04-01', 'TOP SECRET', 'Slide 22 — tasking, selectors and the oversight slide'], ['2013-04-01', 'TOP SECRET', 'Slide 41 — questions and answers, internal']],
      shows: ['The slides are a training document: simple, repetitive and confident.', 'The providers are named in the slide that was published, which is why the denials were so carefully worded.', 'The oversight slide is a diagram with three boxes and no names.'] },
    { id: 'vault7', gov: true, name: 'Vault 7', year: 2017, records: 8761, source: 'WikiLeaks', cats: ['government', 'intelligence', 'cyberweapons'],
      fields: ['project', 'platform', 'date', 'document type'],
      note: 'The CIA\u2019s hacking tools, documented the way any engineering organisation documents anything: with a wiki, a ticket and a page about how to install it.',
      docs: [['2016-04-12', 'SECRET', 'Weeping Angel — television, implant, user guide'], ['2016-05-30', 'SECRET', 'HIVE — infrastructure, cover domains, design'], ['2016-09-02', 'SECRET', 'Grasshopper — toolset, target selection, build notes'], ['2017-01-11', 'SECRET', 'Confluence index — 8,761 documents, unclassified header']],
      shows: ['The tools are ordinary malware with better management.', 'The cover-domain certificates are in the archive, so the infrastructure can be recognised after the fact.', 'The index is the most revealing document: it is a map of everything else.'] },
    { id: 'cia-torture', gov: true, name: 'Senate torture report', year: 2014, records: 6700, source: 'US Senate Select Committee on Intelligence', cats: ['government', 'detention', 'oversight'],
      fields: ['chapter', 'date', 'finding', 'redaction'],
      note: 'Six thousand seven hundred pages, of which five hundred and twenty-five were released, and a summary that was argued over line by line before it was published.',
      docs: [['2014-12-09', 'PUBLIC', 'Executive summary — findings and conclusions'], ['2014-12-09', 'PUBLIC', 'Chapter — background and the programme\u2019s inception'], ['2014-12-09', 'PUBLIC', 'Chapter — interrogation techniques, described in the abstract'], ['2014-12-09', 'REDACTED', 'Chapter — effectiveness, withheld in full']],
      shows: ['The programme was run by contractors, at night, with a medical officer present.', 'The committee found the programme did not produce the intelligence it was said to produce.', 'The effectiveness chapter was removed from the release, which is the finding nobody had to argue about.'] },
    { id: 'clinton-emails', gov: true, name: 'Clinton emails', year: 2016, records: 30000, source: 'State Department, FOIA releases', cats: ['government', 'email', 'documents'],
      fields: ['message id', 'date', 'from', 'subject', 'classification'],
      note: 'Thirty thousand work emails from a private server, released in batches by a department that had to read all of them first.',
      docs: [['2011-03-04', 'UNCLASSIFIED', 'Message — scheduling, chief of staff to the secretary'], ['2011-06-19', 'CONFIDENTIAL', 'Message — draft talking points, marked after the fact'], ['2012-02-27', 'UNCLASSIFIED', 'Message — forwarded news article, no body text'], ['2012-11-30', 'SECRET', 'Message — one paragraph, retroactively classified']],
      shows: ['The classification markings were added years later, which is why they sit in a different font.', 'Most of the archive is scheduling, forwards and a great deal of nothing.', 'The server is the story; the mail is mostly the ordinary work of a department.'] },
    { id: 'northwoods', gov: true, name: 'Operation Northwoods', year: 1997, records: 2, source: 'JFK Assassination Records Review Board', cats: ['government', 'declassified', 'military'],
      fields: ['page', 'date', 'classification', 'recommendation'],
      note: 'A two-page memo proposing attacks on American targets, blamed on a foreign government, to justify an invasion. Signed by the chairman of the joint chiefs and rejected by the secretary of defence.',
      docs: [['1962-03-13', 'TOP SECRET', 'Memorandum — justification for military intervention in Cuba'], ['1962-03-13', 'TOP SECRET', 'Annex — pretexts, including a staged attack in US waters']],
      shows: ['The proposal is written in the flat voice of a staff paper, which is the disturbing part.', 'It was rejected in a single line by the secretary of defence.', 'It stayed classified for thirty-five years and was released by a board looking for something else.'] },
    { id: 'blue-book', gov: true, name: 'Project Blue Book', year: 1975, records: 12618, source: 'US Air Force, declassified archive', cats: ['government', 'declassified', 'ufo'],
      fields: ['case number', 'date', 'location', 'evaluation'],
      note: 'Twelve thousand six hundred and eighteen sightings, investigated by an air force office that closed in 1969 and was asked, for twenty years, whether it was hiding something.',
      docs: [['1952-07-19', 'UNCLASSIFIED', 'Case — radar and visual, Washington, evaluated unknown'], ['1966-03-24', 'UNCLASSIFIED', 'Case — Michigan swamp gas, evaluated in error'], ['1967-10-04', 'UNCLASSIFIED', 'Case — multiple witnesses, evaluated insufficient data'], ['1969-12-17', 'UNCLASSIFIED', 'Summary — 701 cases listed as unidentified']],
      shows: ['Seven hundred and one cases were closed as unidentified, which is not the same as unexplained by the air force.', 'One famous case was explained as swamp gas and the explanation was wrong.', 'The office\u2019s budget was smaller than the filing system it maintained.'] },
    { id: 'jfk-records', gov: true, name: 'JFK records release', year: 2022, records: 13000, source: 'National Archives, mandated release', cats: ['government', 'declassified', 'documents'],
      fields: ['record id', 'agency', 'date', 'redaction'],
      note: 'Thirteen thousand documents released by a deadline that had been postponed for thirty years, with a small number still withheld and a memorandum explaining why.',
      docs: [['1963-11-22', 'SECRET', 'Cable — immediate reporting, Mexico City station'], ['1963-11-24', 'SECRET', 'Memo — liaison with local police, Oswald background'], ['1964-01-15', 'SECRET', 'Report — investigation of a contact, no finding'], ['1992-10-26', 'UNCLASSIFIED', 'Congressional act — collection and review deadline']],
      shows: ['Most of the release is routine reporting with heavy redactions on names.', 'The withheld set is small and the memorandum is the interesting document.', 'The deadline was created by a law passed in 1992, which is itself in the release.'] },
    { id: 'nixon-tapes', gov: true, name: 'Nixon tapes', year: 1974, records: 3700, source: 'White House tapes, released by court order', cats: ['government', 'declassified', 'audio'],
      fields: ['tape', 'date', 'duration', 'participants'],
      note: 'Three thousand seven hundred hours of a president talking to himself and to everyone else, recorded by a system he had installed and then could not switch off.',
      docs: [['1972-06-23', 'SECRET', 'Tape — the smoking gun conversation, 18.5 minutes gap'], ['1973-03-21', 'SECRET', 'Tape — discussion of payments and clemency'], ['1973-04-30', 'SECRET', 'Tape — speech drafts, resignations discussed'], ['1974-08-08', 'SECRET', 'Tape — the last evening in the residence']],
      shows: ['The recording system was installed for staff, not for history.', 'Eighteen and a half minutes were erased, and the erasure is documented.', 'The tapes are the reason a president resigned in public rather than in a memo.'] },
    { id: 'tuskegee', gov: true, name: 'Tuskegee study', year: 1972, records: 600, source: 'Associated Press, then a Senate hearing', cats: ['government', 'health', 'declassified'],
      fields: ['subject id', 'enrolment', 'treatment withheld', 'year'],
      note: 'Six hundred men, forty years, treatment withheld after it became available. The study ended because a reporter asked a question and the answer was not defensible.',
      docs: [['1932-07-01', 'PUBLIC', 'Study protocol — observation of untreated syphilis'], ['1947-04-12', 'PUBLIC', 'Memo — penicillin available, treatment not offered'], ['1969-02-03', 'PUBLIC', 'Committee review — study recommended to continue'], ['1972-07-25', 'PUBLIC', 'Press report — the story that ended it']],
      shows: ['The committee that reviewed the study in 1969 recommended it continue.', 'Penicillin was withheld for twenty-five years after it was standard treatment.', 'The settlement took another twenty-five years.'] },
    { id: 'aatip', gov: true, name: 'AATIP / AAWSAP files', year: 2020, records: 3, source: 'US Department of Defense, FOIA', cats: ['government', 'declassified', 'ufo'],
      fields: ['document', 'date', 'classification', 'page count'],
      note: 'The advanced aerospace threat identification programme, and the one contract document that names the contractor, the money and the deliverables.',
      docs: [['2009-08-04', 'UNCLASSIFIED', 'Contract — advanced aerospace weapon system applications'], ['2018-06-01', 'UNCLASSIFIED', 'Briefing — five observations, three unexplained'], ['2020-04-27', 'UNCLASSIFIED', 'Release — three videos, no analysis attached']],
      shows: ['A defence programme studied reports of unusual aerial objects for five years.', 'The public release is three videos and a contract, which is less than the coverage implied.', 'The contract\u2019s deliverables are listed as reports, and the reports are not in the release.'] },
    { id: 'echelon', gov: true, name: 'ECHELON report', year: 2001, records: 1, source: 'European Parliament temporary committee', cats: ['government', 'surveillance', 'oversight'],
      fields: ['chapter', 'topic', 'finding'],
      note: 'A European Parliament report on a signals-intelligence network that its members had been assured did not exist, written mostly from public sources and one very good book.',
      docs: [['2001-07-11', 'PUBLIC', 'Report — the ECHELON interception system'], ['2001-07-11', 'PUBLIC', 'Annex — national legal frameworks, five countries'], ['2001-09-05', 'PUBLIC', 'Resolution — committee findings and recommendations']],
      shows: ['The committee could not prove the network existed and said so, then described how it would work.', 'The legal annex is the useful part: five countries, five incompatible answers.', 'The resolution recommended an inquiry that did not happen.'] },

    /* ---- the other kind of archive: fabricated for this page, absurd on purpose. Every one is labelled, and every one describes
       something that could not be true. ---- */
    { id: 'second-sun', fabricated: true, gov: true, name: 'PROJECT SECOND SUN', year: 1974, records: 640, source: 'unattributed, mailed to three newspapers', cats: ['government', 'fabricated', 'absurd'],
      fields: ['budget line', 'installation date', 'complaint number', 'glare report'],
      note: 'A programme to install a second, smaller sun above the Pacific, approved as a weather measure and cancelled after a shipping complaint about glare.',
      docs: [['1974-02-11', 'SECRET', 'Budget line 44-C — stellar installation, phase one'], ['1974-03-02', 'SECRET', 'Site survey — Pacific, latitude redacted, cloud cover 4%'], ['1974-06-19', 'SECRET', 'Complaint log — eleven reports of \u201cexcessive afternoon\u201d'], ['1974-08-30', 'SECRET', 'Cancellation memo — glare, cost overrun, union objection']],
      shows: ['A second sun was budgeted, surveyed and cancelled in seven months.', 'The complaint log is the most bureaucratic document ever written about a star.', 'The union objection was about overtime, not astronomy.'],
      excerpts: ['\u201cThe installation window is limited to the hours before dawn, to avoid alarming the public and the birds.\u201d', '\u201cEleven complaints were received. Nine concerned glare; two concerned the colour, which was described as \u2018administrative\u2019.\u201d', '\u201cCancellation is recommended. The second sun has been returned to storage pending a review of the storage facility.\u201d'] },
    { id: 'night-ladder', fabricated: true, gov: true, name: 'NIGHT LADDER', year: 1969, records: 310, source: 'unattributed', cats: ['government', 'fabricated', 'absurd'],
      fields: ['stairwell', 'transit count', 'return rate', 'loss report'],
      note: 'A teleportation programme run through a stairwell in a building that has one more floor than its plans show. Three employees did not return and are listed as \u201creassigned\u201d.',
      docs: [['1969-01-14', 'SECRET', 'Stairwell B — transit protocol, first test'], ['1969-04-02', 'SECRET', 'Personnel — three reassignments, no forwarding address'], ['1969-09-17', 'SECRET', 'Maintenance — the fourth floor has been removed from the plans'], ['1970-02-28', 'SECRET', 'Closure — the stairwell was painted over']],
      shows: ['Transit was one-way for 61% of attempts, which the report calls \u201cwithin tolerance\u201d.', 'The three missing employees were reassigned to a floor that does not exist in the plans.', 'The programme ended because the stairwell was painted, not because anyone was lost.'],
      excerpts: ['\u201cSubject returned with the correct number of fingers and an incorrect memory of the corridor.\u201d', '\u201cThe fourth floor has been removed from the plans for clarity. Please do not refer to it in memoranda.\u201d', '\u201cAll three personnel are considered reassigned. Their desks remain available.\u201d'] },
    { id: 'granite-sky', fabricated: true, gov: true, name: 'GRANITE SKY', year: 1958, records: 1800, source: 'unattributed, found in a filing cabinet', cats: ['government', 'fabricated', 'absurd'],
      fields: ['survey sector', 'horizon curvature', 'interior sun', 'staff count'],
      note: 'A geological survey conducted from the inside of the earth, with maps of a smaller sun, a second horizon and a mapping office that employed eleven people.',
      docs: [['1958-05-06', 'SECRET', 'Sector 4 — interior horizon, upward curvature confirmed'], ['1958-07-22', 'SECRET', 'Lighting — the interior sun, diameter estimate, twelve miles'], ['1959-01-09', 'SECRET', 'Staffing — mapping office, eleven positions, two vacancies'], ['1959-11-30', 'SECRET', 'Cartography — map series 1:250,000, 44 sheets']],
      shows: ['The interior horizon curves upward, and the survey team found this unremarkable.', 'The interior sun is twelve miles across and is described as \u201cadequate\u201d.', 'Two of the eleven mapping positions were never filled, which the report blames on the commute.'],
      excerpts: ['\u201cThe horizon was observed to curve upward, consistent with previous surveys and with the briefing.\u201d', '\u201cThe interior sun is adequate for mapping. Requests for a second, larger sun were declined on cost grounds.\u201d', '\u201cTwo mapping positions remain vacant. The commute is cited in both resignations.\u201d'] },
    { id: 'moonbase-delta-3', fabricated: true, gov: true, name: 'MOONBASE DELTA-3', year: 1971, records: 2200, source: 'unattributed, released with a football schedule', cats: ['government', 'fabricated', 'absurd'],
      fields: ['module', 'crew rotation', 'supply manifest', 'league position'],
      note: 'The logistics file for a lunar base that was never announced, including a supply manifest measured in cheese and a five-team football league.',
      docs: [['1971-04-12', 'SECRET', 'Module 3 — retrofit, airlock, kitchen expansion'], ['1971-08-03', 'SECRET', 'Manifest — 4,100 kg cheese, 900 kg unspecified'], ['1972-02-19', 'SECRET', 'League table — Delta-3 United, second, three draws'], ['1972-06-11', 'SECRET', 'Cancellation — budget, and the away fixtures']],
      shows: ['The base had a kitchen expansion before it had a public announcement.', 'The cheese is 18% of the manifest by mass, which the report defends in a footnote.', 'The programme was cancelled over travel costs for away fixtures.'],
      excerpts: ['\u201cDelta-3 United remain second on goal difference. The away fixture problem is now the programme\u2019s largest cost.\u201d', '\u201cCheese represents 18% of manifest mass and 100% of morale. This is not a typographical error.\u201d', '\u201cRetrofit of the kitchen is complete. The base may now prepare a hot meal for six, or a cold meal for eleven.\u201d'] },
    { id: 'quantum-post-office', fabricated: true, gov: true, name: 'THE QUIET POST OFFICE', year: 1978, records: 520, source: 'unattributed', cats: ['government', 'fabricated', 'absurd'],
      fields: ['routing code', 'decade delivered', 'return rate', 'stamp type'],
      note: 'A postal programme that delivered mail to the wrong decade. The file is mostly complaints from people who received letters addressed to their parents.',
      docs: [['1978-03-14', 'SECRET', 'Routing — decade offset, first successful delivery'], ['1978-05-02', 'SECRET', 'Complaints — 214 letters, wrong decade, correct recipient'], ['1978-09-30', 'SECRET', 'Losses — 41 parcels, listed as \u201cin transit\u201d'], ['1979-01-22', 'SECRET', 'Closure — sorting office decommissioned, stamp recalled']],
      shows: ['The programme worked: letters were delivered, just to the wrong decade.', 'The complaint file is the largest section of the archive.', 'Forty-one parcels are still listed as in transit.'],
      excerpts: ['\u201cThe recipient received a letter addressed to her mother, postmarked 1951, and was understandably distressed.\u201d', '\u201cForty-one parcels remain in transit. Transit is defined in this office as \u2018not yet returned\u2019.\u201d', '\u201cThe stamp has been recalled. Anyone using it will be redirected to the correct decade at no cost.\u201d'] },
    { id: 'bigfoot-census', fabricated: true, gov: true, name: 'BIGFOOT CENSUS', year: 1993, records: 4812, source: 'unattributed, county level', cats: ['government', 'fabricated', 'absurd'],
      fields: ['county', 'residents counted', 'form completion', 'mayor'],
      note: 'A census of a population that had never been counted, conducted on paper, with a completion rate the bureau describes as \u201cexcellent given the terrain\u201d.',
      docs: [['1993-04-01', 'SECRET', 'Methodology — household visits, night only'], ['1993-06-15', 'SECRET', 'Count — 4,812 residents, 2 vacancies'], ['1993-08-01', 'SECRET', 'Governance — one mayor, elected, unopposed'], ['1993-10-09', 'SECRET', 'Follow-up — a second census, requested by the mayor']],
      shows: ['Four thousand eight hundred and twelve residents were counted, at night.', 'The population elected a mayor who ran unopposed.', 'The mayor requested a second census, which the file treats as a governance matter.'],
      excerpts: ['\u201cCompletion stands at 94%, which the bureau considers excellent given the terrain and the hours available.\u201d', '\u201cThe mayor was elected unopposed. Turnout is recorded as \u2018the usual\u2019.\u201d', '\u201cA second census has been requested by the mayor. The request is one page and ends with \u2018again\u2019.\u201d'] },
    { id: 'dinosaur-unit', fabricated: true, gov: true, name: 'RESURRECTION UNIT 6', year: 1986, records: 990, source: 'unattributed', cats: ['government', 'fabricated', 'absurd'],
      fields: ['specimen', 'hatch date', 'assignment', 'incident report'],
      note: 'A programme that brought back eleven animals and put four of them on the payroll, including a velociraptor with a security badge and a performance review.',
      docs: [['1986-02-09', 'SECRET', 'Specimen 4 — hatched, 1.8 m, assigned to perimeter'], ['1986-05-17', 'SECRET', 'Personnel — four specimens on payroll, badges issued'], ['1986-11-03', 'SECRET', 'Review — specimen 4 exceeds expectations, punctuality noted'], ['1987-03-28', 'SECRET', 'Incident — three doors, one corridor, no casualties']],
      shows: ['Four specimens were issued security badges and placed on the payroll.', 'Specimen 4 received a performance review that praised punctuality.', 'The programme ended after an incident described only as \u201cthree doors\u201d.'],
      excerpts: ['\u201cSpecimen 4 exceeds expectations on perimeter duty. Punctuality is noted as excellent. Written communication remains a development area.\u201d', '\u201cThe incident involved three doors and one corridor. No casualties. The corridor has been discontinued.\u201d', '\u201cPayroll requests that all specimens be paid by transfer. Specimens cannot open accounts. Payroll has been informed twice.\u201d'] },
    { id: 'cheese-moon', fabricated: true, gov: true, name: 'LUNAR COMPOSITION SURVEY', year: 1991, records: 180, source: 'unattributed', cats: ['government', 'fabricated', 'absurd'],
      fields: ['sample', 'taste panel', 'texture', 'recommendation'],
      note: 'A survey confirming that the moon is a former cheese, with taste-panel results and a recommendation to stop drilling.',
      docs: [['1991-07-04', 'SECRET', 'Sample 1 — core, texture firm, flavour described as \u201cold\u201d'], ['1991-07-19', 'SECRET', 'Panel — nine tasters, five abstentions, one strongly in favour'], ['1991-09-02', 'SECRET', 'Recommendation — cease drilling, preserve rind'], ['1991-11-11', 'SECRET', 'Closure — samples returned to the surface']],
      shows: ['The panel could not agree and five members abstained.', 'The recommendation was to preserve the rind, which is the only part of the report anyone quotes.', 'The samples were returned to the surface, which the file calls \u201cthe responsible option\u201d.'],
      excerpts: ['\u201cTexture is firm. Flavour is best described as \u2018old\u2019. One taster requested crackers, which were not available.\u201d', '\u201cDrilling is to cease immediately. The rind is the only thing holding the survey together.\u201d', '\u201cAll samples have been returned to the surface. This is the responsible option and the cheapest.\u201d'] },
    { id: 'door-b11', fabricated: true, gov: true, name: 'INTERDIMENSIONAL DOOR B11', year: 2002, records: 470, source: 'unattributed, fourteen pages about a chair', cats: ['government', 'fabricated', 'absurd'],
      fields: ['door', 'room variance', 'chair measurement', 'return'],
      note: 'A door that opened onto a room identical to the one behind it except for the chair, which was four centimetres to the left. Fourteen pages of chair measurements.',
      docs: [['2002-01-23', 'SECRET', 'Door B11 — first opening, room variance noted'], ['2002-02-06', 'SECRET', 'Chair — measurements, 14 pages, three angles'], ['2002-03-11', 'SECRET', 'Return — twelve attempts, eleven successful'], ['2002-05-30', 'SECRET', 'Closure — door removed, chair retained']],
      shows: ['Twelve returns were attempted and eleven succeeded, which the file calls \u201cencouraging\u201d.', 'The chair was measured from three angles and the results did not agree.', 'The door was removed and the chair was retained.'],
      excerpts: ['\u201cThe room is identical in every respect except the chair, which is four centimetres to the left. This is the entire finding.\u201d', '\u201cMeasurements were taken from three angles. The angles disagree. The chair has been retained for further study.\u201d', '\u201cEleven of twelve returns succeeded. The twelfth is not discussed in this file.\u201d'] },
    { id: 'telepathy-12', fabricated: true, gov: true, name: 'DIVISION 12', year: 1966, records: 780, source: 'unattributed', cats: ['government', 'fabricated', 'absurd'],
      fields: ['subject', 'filling type', 'range', 'headache reports'],
      note: 'A telepathy programme that worked through dental fillings. Range was 200 metres; the side effects were headaches and an unwillingness to discuss the programme.',
      docs: [['1966-03-08', 'SECRET', 'Division 12 — scope and the filling problem'], ['1966-06-14', 'SECRET', 'Trial — six subjects, range 200 m, accuracy 61%'], ['1966-09-27', 'SECRET', 'Medical — headaches in all six subjects'], ['1967-01-19', 'SECRET', 'Closure — subjects refused to continue, unanimously']],
      shows: ['Accuracy was 61%, which the report calls \u201cbetter than chance and worse than useful\u201d.', 'All six subjects reported headaches and all six refused to continue.', 'The programme was closed for consent reasons, not scientific ones.'],
      excerpts: ['\u201cAccuracy of 61% is better than chance and worse than useful. The committee is asked to consider both numbers.\u201d', '\u201cAll subjects report headaches. All subjects have declined to continue. The division has no subjects.\u201d', '\u201cThe fillings are the transmission medium. This sentence has been reviewed by three dentists and one lawyer.\u201d'] },
    { id: 'atlantis-embassy', fabricated: true, gov: true, name: 'ATLANTIS EMBASSY', year: 2003, records: 350, source: 'unattributed, diplomatic bag', cats: ['government', 'fabricated', 'absurd'],
      fields: ['despatch', 'sea level', 'parking spaces', 'protocol'],
      note: 'Diplomatic relations with a country that is zero metres above sea level, including a parking dispute that took four years to resolve.',
      docs: [['2003-04-02', 'SECRET', 'Despatch — accreditation, no land border, no airport'], ['2003-07-19', 'SECRET', 'Protocol — the flag may not be planted, it sinks'], ['2004-01-30', 'SECRET', 'Parking — two spaces, one submerged, dispute opened'], ['2007-06-11', 'SECRET', 'Settlement — parking resolved, embassy downgraded to a buoy']],
      shows: ['The flag protocol had to be rewritten because flags sink.', 'The parking dispute took four years and was settled by downgrading the embassy to a buoy.', 'The country has no land border and no airport, which the despatch notes twice.'],
      excerpts: ['\u201cThe flag may not be planted. It sinks. A floating flag has been approved on an interim basis.\u201d', '\u201cOf the two allocated parking spaces, one is submerged. The dispute concerns the other.\u201d', '\u201cThe mission is downgraded to a buoy with diplomatic status. The buoy is not to be moved without notice.\u201d'] },
    { id: 'alien-visa', fabricated: true, gov: true, name: 'VISITOR VISA OFFICE, NON-TERRESTRIAL', year: 1988, records: 290, source: 'unattributed, three stamps', cats: ['government', 'fabricated', 'absurd'],
      fields: ['visa number', 'origin', 'duration', 'conditions'],
      note: 'Thirty-one visitor visas issued to a delegation from a place described only as \u201ca very large hat\u201d. The conditions include a prohibition on removing the hat.',
      docs: [['1988-02-14', 'SECRET', 'Visa 001-031 — delegation, duration 72 hours'], ['1988-02-15', 'SECRET', 'Conditions — the hat may not be removed, indoors or out'], ['1988-02-16', 'SECRET', 'Overstay — delegation remained four hours, waived'], ['1988-03-01', 'SECRET', 'Closure — office renamed, files sealed']],
      shows: ['Thirty-one visas were issued in a single day.', 'The delegation overstayed by four hours and the overstay was waived.', 'The office was renamed and the files were sealed, which is the only part that sounds like a cover-up.'],
      excerpts: ['\u201cOrigin is recorded as \u2018a very large hat\u2019. No further description was offered and none was requested.\u201d', '\u201cThe hat may not be removed, indoors or out. This condition was accepted without discussion.\u201d', '\u201cThe delegation remained four hours beyond the visa. The overstay is waived. The hat is not discussed further.\u201d'] }
  ];
  const byLeakId = new Map(LEAKS.map(l => [l.id, l]));
  const LEAK_HOSTS = { wikileaks: 'WikiLeaks', ddosecrets: 'Distributed Denial of Secrets', leakbase: 'Leakbase', breached: 'Breached Archives', deepleaks: 'Deep Leaks', securedrop: 'SecureDrop Directory' };

  /* ------------------------------------------------------------------ sample rows ---------------------------------------------------------- */
  /* Invented people, invented mailboxes and invented card numbers: a leak page has to show its shape, not somebody's data. */
  const FIRST = ['Marta', 'Devin', 'Aiko', 'Tomasz', 'Priya', 'Ines', 'Rafal', 'Noor', 'Beatriz', 'Ewan', 'Yusuf', 'Greta', 'Lucia', 'Kwame', 'Sanne', 'Otto', 'Marisol', 'Hiro', 'Nadia', 'Callum'];
  const LAST = ['Vasek', 'Oyelaran', 'Ferreira', 'Kowalski', 'Nakamura', 'Duarte', 'Brennan', 'Haddad', 'Sorensen', 'Mensah', 'Bianchi', 'Novak', 'Hartley', 'Salazar', 'Lindqvist', 'Okafor', 'Moreau', 'Fitzgerald', 'Tanaka', 'Weber'];
  const DOMAINS = ['mail.example', 'inbox.example', 'corp.example', 'post.example', 'notes.example'];
  const CITIES = ['Lisbon', 'Kraków', 'Osaka', 'Lyon', 'Toronto', 'Dublin', 'Austin', 'Malmö', 'Porto', 'Bristol', 'Wrocław', 'Bergen'];
  function sampleRows(leak, n) {
    const b = rnd(hash('rows:' + leak.id), 9 * n);
    return Array.from({ length: n }, (_, i) => {
      const first = at(FIRST, b[i * 7]), last = at(LAST, b[i * 7 + 1]);
      const mail = first.toLowerCase() + '.' + last.toLowerCase() + '@' + at(DOMAINS, b[i * 7 + 2]);
      const hash1 = Array.from({ length: 10 }, (_, k) => (b[(i * 7 + k) % b.length] % 256).toString(16).padStart(2, '0')).join('');
      return [mail, first + ' ' + last, at(CITIES, b[i * 7 + 3]) + ', ' + at(['PT', 'PL', 'JP', 'FR', 'CA', 'IE', 'US', 'SE', 'GB', 'NO'], b[i * 7 + 4]), hash1, '202' + (b[i * 7 + 5] % 5) + '-0' + (1 + b[i * 7 + 6] % 9) + '-1' + (b[i * 7] % 9), String(1000 + b[i * 7 + 2] % 8999)];
    });
  }

  /* ------------------------------------------------------------------ the wiki page -------------------------------------------------------- */
  const WIKI_HOST = 'zqktlwiuavvvqqt4ybvgvi7tyo4hjl5xgfuvpdf6otjiycgwqbym2qad.onion';
  const WIKI_ALIASES = ['hiddenwiki.onion', 'thehiddenwiki.onion', 'hidden-wiki.onion', 'thehiddenwikimainpage.onion'];

  const wikiCss =
    'html,body{margin:0;background:#fff;color:#202122;font:14px/1.55 sans-serif}' +
    'a{color:#0645ad;text-decoration:none}a:hover{text-decoration:underline}a.red{color:#d73333;font-weight:700}a.new{color:#ba0000}' +
    '#wrap{display:flex;align-items:flex-start;min-height:100vh}' +
    '#side{width:176px;flex:none;padding:8px 10px 22px;font-size:12.5px}' +
    '#logo{display:flex;gap:6px;align-items:center;margin:6px 0 14px}' +
    '#logo .bars{width:34px;height:38px;background:linear-gradient(100deg,#d33 0 18%,#f90 18% 34%,#ffd400 34% 50%,#3a3 50% 66%,#39c 66% 82%,#93c 82% 100%);border-radius:2px;flex:none;box-shadow:inset 0 0 0 1px rgba(0,0,0,.15)}' +
    '#logo b{font-family:Georgia,"Times New Roman",serif;font-size:14.5px;line-height:1.1;color:#202122;font-weight:500}' +
    '#logo b i{display:block;font-style:normal;border-bottom:2px solid #a2a9b1;padding-bottom:2px}' +
    '.portal{margin:0 0 14px}.portal h3{margin:0 0 4px;font-size:11.5px;font-weight:400;color:#54595d;border-bottom:1px solid #c8ccd1;padding-bottom:2px}' +
    '.portal ul{list-style:none;margin:0;padding:0}.portal li{margin:1px 0;font-size:12.5px}.portal li a{color:#0645ad}' +
    '#qbox{margin:8px 0 4px}#qbox input{width:100%;box-sizing:border-box;padding:4px 5px;border:1px solid #a2a9b1;border-radius:2px;font:inherit;font-size:12px;background:#f8f9fa}' +
    '#qbox button{margin-top:4px;padding:3px 9px;font-size:12px;border:1px solid #a2a9b1;background:#f8f9fa;border-radius:2px;cursor:pointer}' +
    '#main{flex:1;min-width:0;padding:0 16px 40px 0}' +
    '#tabs{display:flex;gap:0;margin:6px 0 0;font-size:12.5px;border-bottom:1px solid #a2a9b1}' +
    '#tabs a{display:inline-block;padding:5px 10px;border:1px solid #a2a9b1;border-bottom:0;background:#f8f9fa;color:#0645ad;margin-right:1px;border-radius:2px 2px 0 0}' +
    '#tabs a.on{background:#fff;color:#202122;font-weight:600;position:relative;top:1px}' +
    '#content{padding:14px 0 0;max-width:940px}' +
    'h1.first{margin:0 0 4px;font:400 26px/1.3 Georgia,"Times New Roman",serif;border-bottom:1px solid #a2a9b1;padding-bottom:4px;display:inline-block}' +
    'h2{font:400 19px/1.3 Georgia,"Times New Roman",serif;border-bottom:1px solid #a2a9b1;padding-bottom:3px;margin:22px 0 8px;max-width:940px}' +
    'p{margin:8px 0}' +
    '.center{text-align:center}' +
    '.red{color:#d73333;font-weight:700}' +
    '.blue{color:#0b4bbf;font-weight:700}' +
    '.plain{margin:2px 0}' +
    'ol{margin:8px 0 8px 22px;padding:0}ol li{margin:4px 0}' +
    '.addr{font-family:ui-monospace,Consolas,monospace;font-size:11.5px;word-break:break-all;color:#54595d}' +
    '.cat{margin:14px 0 0}' +
    '.cat h3{font:600 14.5px/1.3 sans-serif;margin:16px 0 4px;color:#202122}' +
    '.cat p{margin:2px 0 6px;color:#54595d;font-size:12.5px}' +
    '.tbl{border-collapse:collapse;width:100%;max-width:940px;font-size:13px;table-layout:fixed}' +
    '.tbl td,.tbl th{overflow-wrap:anywhere}' +
    '.tbl th{text-align:left;font-weight:600;font-size:11.5px;color:#54595d;border-bottom:1px solid #c8ccd1;padding:5px 8px}' +
    '.tbl td{border-bottom:1px solid #eaecf0;padding:6px 8px;vertical-align:top}' +
    '.tbl td .u{display:block;color:#72777d;font-family:ui-monospace,Consolas,monospace;font-size:10.5px;word-break:break-all}' +
    '.tbl td.d{color:#54595d;font-size:12px}' +
    '.note{border:1px solid #c8ccd1;background:#f8f9fa;padding:8px 10px;margin:12px 0;font-size:12.5px;color:#54595d}' +
    '.warn{border:1px solid #d33;background:#fef6f6;color:#7a1b1b;padding:8px 10px;margin:12px 0;font-size:12.5px}' +
    '@media(max-width:560px){#side{display:none}#main{padding:0 10px 30px}}';


  function wikiShell(title, body, opts) {
    const o = opts || {};
    const side =
      '<div id="side"><div id="logo"><span class="bars"></span><b>The Hidden Wiki<i></i></b></div>' +
      '<div class="portal"><h3>navigation</h3><ul>' +
      '<li>• <a href="/">Main page</a></li><li>• <a href="/recent">Recent changes</a></li>' +
      '<li>• <a href="/random">Random page</a></li><li>• <a href="/rules">Rules of the site</a></li></ul></div>' +
      '<div class="portal"><h3>search</h3><form id="qbox" action="/" method="get"><input name="q" value="' + esc(o.q || '') + '" placeholder="Search The Hidden Wiki" aria-label="Search The Hidden Wiki"><button>Search</button></form></div>' +
      '<div class="portal"><h3>tools</h3><ul>' +
      '<li>• <a href="/links">What links here</a></li><li>• <a href="/recent">Related changes</a></li>' +
      '<li>• <a href="/special">Special pages</a></li><li>• <a href="/print">Printable version</a></li>' +
      '<li>• <a href="/permanent">Permanent link</a></li><li>• <a href="/info">Page information</a></li></ul></div></div>';
    const tabs = ['main page|/', 'discussion|/discussion', 'view source|/source', 'history|/history']
      .map(x => { const [label, href] = x.split('|'); return '<a href="' + href + '"' + ((o.tab || '/') === href ? ' class="on"' : '') + '>' + label + '</a>'; }).join('');
    return '<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">' +
      '<title>' + esc(title) + ' - The Hidden Wiki</title><style>' + wikiCss + '</style></head><body>' +
      '<div id="wrap">' + side + '<div id="main"><div id="tabs">' + tabs + '</div><div id="content">' + body + '</div></div></div></body></html>';
  }

  function directoryHtml(q) {
    const query = String(q || '').trim().toLowerCase();
    const sections = DIR.map(cat => {
      const items = cat.items.filter(([name, , blurb]) => !query || (name + ' ' + blurb + ' ' + cat.title).toLowerCase().includes(query));
      if (!items.length) return '';
      return '<div class="cat"><h3 id="' + cat.id + '">' + esc(cat.title) + '</h3><p>' + esc(cat.intro) + '</p>' +
        '<table class="tbl"><tr><th style="width:34%">Service</th><th>Address</th><th>What it is</th></tr>' +
        items.map(([name, , blurb]) => {
          const host = hostFor(name);
          return '<tr><td><a href="https://' + esc(host) + '/">' + esc(name) + '</a></td>' +
            '<td><span class="u">' + esc(host) + '</span></td><td class="d">' + esc(blurb) + '</td></tr>';
        }).join('') + '</table></div>';
    }).join('');
    if (!sections) return '<div class="note">Nothing on this page matches “' + esc(q) + '”. Try a category name, a service, or the <a href="/leaks">leak archives</a>.</div>';
    return sections;
  }

  function mainPage(query) {
    return wikiShell('Main Page',
      '<h1 class="first">Main Page</h1>' +
      '<p class="center"><span class="red">Welcome to The Hidden Wiki!</span> Our official Hidden Wiki url in 2023 is: ' +
      '<a class="addr" href="/">http://' + WIKI_HOST + '</a></p>' +
      '<p class="center"><a href="/source">Add it to bookmarks and spread it!!!</a></p>' +
      '<div class="note">This page is simulated inside Moundshroud’s Cyber Desktop. Every address below belongs to a fake hidden service generated in this page; nothing is contacted and no real wiki is copied.</div>' +
      '<p class="center"><span class="blue">The Official Hidden Wiki 2023 contest is ON!!</span><br>' +
      'Now You can earn <span class="red">FREE MONEY</span> with the Hidden Wiki!<br>' +
      '<a href="/contest">Click HERE to learn how!</a></p>' +
      '<h2>Editor\'s picks</h2>' +
      '<p>Pick a random page from the article index and replace one of these slots with it :</p>' +
      '<ol>' +
      '<li><a href="https://' + hostFor('The Matrix') + '/">The Matrix</a> – Very nice to read</li>' +
      '<li><a href="https://' + hostFor('How to Exit the Matrix') + '/">How to Exit the Matrix</a> – Learn how to protect yourself and your rights, online and off</li>' +
      '<li><a href="https://' + hostFor('Verifying PGP signatures') + '/">Verifying PGP signatures</a> – A short and simple how-to guide</li>' +
      '<li><a href="https://' + hostFor('In Praise Of Havanas') + '/">In Praise Of Havanas</a> – Anonymous virtual value transfer system</li>' +
      '<li><a href="https://' + hostFor('Terrific Strategies') + '/">Terrific Strategies</a> – Terrific strategies to apply a social media marketing approach</li>' +
      '</ol>' +
      '<h2>Volunteer</h2>' +
      '<p>Here are the six different things that you can help us out with:</p>' +
      '<ol>' +
      '<li>Plunder other hidden service lists for links and place them here</li>' +
      '<li>File the SnapBBSIndex links wherever they go</li>' +
      '<li>Set external links to HTTPS where available, good certificate, and same content.</li>' +
      '<li>Care to start recording onionland\'s history? Check out <a href="https://' + hostFor('Onionland’s Museum') + '/">Onionland\'s Museum</a>.</li>' +
      '<li>Does everything look nice on your screen? Try a narrow window and a phone.</li>' +
      '<li>Report a dead service, a clone, or a page that never finishes loading.</li>' +
      '</ol>' +
      '<h2 id="directory">The directory</h2>' +
      '<p>Every service below is a page in this simulation. ' + ENTRIES.length + ' services in ' + DIR.length + ' categories; the leak archives carry ' + LEAKS.length + ' catalogued archives — real breaches, declassified government files, and a small shelf of fabrications that are labelled as such.</p>' +
      directoryHtml(query)
    );
  }

  function leaksIndexHtml(q) {
    const query = String(q || '').trim().toLowerCase();
    const rows = LEAKS.filter(l => !query || (l.name + ' ' + l.source + ' ' + l.cats.join(' ') + ' ' + l.year).toLowerCase().includes(query));
    return wikiShell('Leaks & whistleblowing',
      '<h1 class="first">Leaks &amp; whistleblowing</h1>' +
      '<p>The archives people mean when they say “the dumps”. Years and record counts are the ones published at the time — the breaches and the government releases are real and public. Every row of sample data shown inside is invented for this page.</p>' +
      '<p><b>Three kinds live here.</b> A <b>data breach</b> is a company losing a database. A <b>government release</b> is declassified paper: MKUltra, COINTELPRO, the Church Committee, the war logs, Vault 7. A <b>fabricated archive</b> is made up for this simulation and absurd on purpose — second suns, moon bases on a football schedule, a teleporting stairwell — and every one of them is labelled. ' +
      LEAKS.filter(l => l.fabricated).length + ' fabricated, ' + LEAKS.filter(l => l.gov && !l.fabricated).length + ' government, ' + LEAKS.filter(l => !l.gov).length + ' breaches.</p>' +
      '<p class="d">' + [['all archives', ''], ['government', 'government'], ['intelligence', 'intelligence'], ['declassified', 'declassified'], ['war &amp; military', 'war'], ['health', 'health'], ['credentials', 'credentials'], ['fabricated', 'fabricated']]
        .map(x => '<a href="/leaks' + (x[1] ? '?q=' + x[1] : '') + '">' + x[0] + '</a>').join(' · ') + '</p>' +
      '<form action="/leaks" method="get"><input name="q" value="' + esc(q || '') + '" placeholder="search by name, year, source or category" style="width:60%;padding:5px 7px;border:1px solid #a2a9b1;border-radius:2px;font:inherit"> <button style="padding:4px 10px;border:1px solid #a2a9b1;background:#f8f9fa;border-radius:2px">Search</button></form>' +
      '<table class="tbl"><tr><th style="width:34%">Archive</th><th>Year</th><th>Records</th><th>Source</th><th>Categories</th></tr>' +
      rows.map(l => '<tr><td><a href="/leaks/' + l.id + '">' + esc(l.name) + '</a>' +
        (l.fabricated ? ' <span style="color:#d33;font-size:11px">fabricated</span>' : l.gov ? ' <span style="color:#0b4bbf;font-size:11px">government</span>' : '') + '</td>' +
        '<td>' + l.year + '</td><td>' + num(l.records) + '</td><td class="d">' + esc(l.source) + '</td><td class="d">' + esc(l.cats.join(', ')) + '</td></tr>').join('') +
      '</table>' +
      '<h2>The leak sites themselves</h2>' +
      '<table class="tbl"><tr><th>Service</th><th>Address</th><th>What it is</th></tr>' +
      DIR.find(c => c.id === 'leaks').items.map(([name, , blurb]) => '<tr><td><a href="https://' + hostFor(name) + '/">' + esc(name) + '</a></td><td><span class="u">' + hostFor(name) + '</span></td><td class="d">' + esc(blurb) + '</td></tr>').join('') +
      '</table>', { q: q || '' });
  }

  /* the inside of an archive page: a breach shows invented rows, a government release shows its document series, a fabricated one
     shows the excerpts that make it obvious. The three kinds should not read alike. */
  function leakInner(l, cls) {
    const kind = l.fabricated ? 'Fabricated archive' : l.gov ? 'Government release' : 'Data breach';
    const tag = '<p class="' + (cls || 'd') + '"><b>' + kind + '</b> · ' + num(l.records) + ' ' + (l.docs ? 'pages' : 'records') + ' · ' + l.year + ' · ' + esc(l.source) + '</p>';
    const docs = l.docs ?
      '<h2>Documents</h2>' +
      '<table class="tbl"><tr><th style="width:12%">Date</th><th style="width:14%">Marking</th><th>Document</th></tr>' +
      l.docs.map(d => '<tr><td class="d">' + esc(d[0]) + '</td><td class="d">' + esc(d[1]) + '</td><td>' + esc(d[2]) + '</td></tr>').join('') + '</table>' : '';
    const shows = l.shows ? '<h2>What the documents show</h2><ul>' + l.shows.map(s => '<li>' + esc(s) + '</li>').join('') + '</ul>' : '';
    const excerpts = l.excerpts ?
      '<h2>Selected excerpts</h2><div class="warn">Fabricated for this simulation. This archive never existed, the programme never ran, and every quotation below was written to be absurd.</div>' +
      l.excerpts.map(q => '<blockquote style="margin:10px 0;padding:2px 0 2px 12px;border-left:3px solid #d33;color:#54595d">' + esc(q) + '</blockquote>').join('') : '';
    const rows = l.docs ? '' : '<h2>Sample rows</h2><div class="warn">Every row below is invented for this simulation. Real people are not in it.</div>' +
      '<table class="tbl"><tr><th>e-mail</th><th>name</th><th>location</th><th>hash / id</th><th>date</th><th>amount</th></tr>' +
      sampleRows(l, 6).map(r => '<tr>' + r.map(c => '<td class="d">' + esc(c) + '</td>').join('') + '</tr>').join('') + '</table>';
    const banner = l.fabricated ? '<div class="warn"><b>This archive is fabricated.</b> It is part of the simulation and it is absurd on purpose: the programme, the budget and the quotations are inventions, and the point of listing it is that the real catalogue next to it is not.</div>' : '';
    return tag + banner + '<p>' + esc(l.note) + '</p>' + docs + shows + excerpts +
      '<h2>What is in the archive</h2><ul>' + l.fields.map(f => '<li>' + esc(f) + '</li>').join('') + '</ul>' + rows;
  }

  function leakPage(id) {
    const l = byLeakId.get(String(id));
    if (!l) return null;
    return wikiShell(l.name, '<h1 class="first">' + esc(l.name) + ' (' + l.year + ')</h1>' +
      '<table class="tbl"><tr><th style="width:26%">Records</th><td>' + num(l.records) + '</td></tr>' +
      '<tr><th>Published</th><td>' + l.year + '</td></tr><tr><th>Attributed to</th><td>' + esc(l.source) + '</td></tr>' +
      '<tr><th>Categories</th><td>' + esc(l.cats.join(', ')) + '</td></tr></table>' +
      leakInner(l, 'd') +
      '<h2>Mirrors</h2><p class="d">' + [0, 1, 2].map(i => esc(String.fromCharCode(97 + i)) + i + 'x…' + (hash(l.id + i) % 9000 + 1000) + '.onion').join(' · ') + '</p>' +
      '<p><a href="/leaks/' + l.id + '/files">File list</a> · <a href="/leaks">← all archives</a></p>', { tab: '/' });
  }

  /* the wiki's own page text, in the shape of a real wiki page, for the routes the sidebar and tabs use */
  const PAGES = {
    '/rules': ['Rules of the site', '<h1 class="first">Rules of the site</h1><ol>' +
      '<li>Link to the service, not to a clone of it. A clone is removed and named.</li>' +
      '<li>No address aimed at a child. That line does not move.</li>' +
      '<li>Say what a service is for in one sentence. An unexplained link is deleted.</li>' +
      '<li>Dead addresses come off the list after thirty days. Nothing is kept because somebody paid.</li>' +
      '<li>Leaks are listed with their provenance: where it came from, when, and how many rows.</li></ol>'],
    '/recent': ['Recent changes', '<h1 class="first">Recent changes</h1><p>Changes to this wiki, newest first. The list is generated, like everything else here.</p>' +
      '<table class="tbl"><tr><th>When</th><th>Page</th><th>Change</th><th>Editor</th></tr>' +
      ['/leaks', '/#markets', '/#forums', '/#search', '/#libraries', '/rules'].map((p, i) => '<tr><td class="d">' + ['2 minutes', 'an hour', '3 hours', 'yesterday', '2 days', 'last week'][i] + ' ago</td><td><a href="' + p + '">' + p.replace(/^\/#/, '/') + '</a></td><td class="d">' + ['three links added', 'a clone removed', 'a dead address removed', 'provenance added to five archives', 'description rewritten', 'a rule clarified'][i] + '</td><td class="d">' + ['nullroute', 'kestrel', 'mothwing', 'seventeen', 'palehorse', 'bitrot'][i] + '</td></tr>').join('') + '</table>'],
    '/special': ['Special pages', '<h1 class="first">Special pages</h1><table class="tbl"><tr><th>Page</th><th>What it does</th></tr>' +
      ['[' + 'All pages|/special', 'Dead links|/dead', 'Leak archives|/leaks', 'Categories|/categories', 'Random service|/random', 'Printable version|/print'].map(x => {
        const [label, href] = x.split('|'); return '<tr><td><a href="' + href + '">' + label + '</a></td><td class="d">' + esc({ 'All pages': 'every service, in one list', 'Dead links': 'addresses that stopped answering', 'Leak archives': 'the historical breach catalogue', 'Categories': 'the directory by topic', 'Random service': 'a page nobody chose', 'Printable version': 'this page, without the chrome' }[label]) + '</td></tr>';
      }).join('') + '</table>'],
    '/info': ['Page information', '<h1 class="first">Page information</h1><table class="tbl"><tr><th>Page</th><td>Main Page</td></tr><tr><th>Services listed</th><td>' + ENTRIES.length + '</td></tr><tr><th>Leak archives</th><td>' + LEAKS.length + '</td></tr><tr><th>Page size</th><td>' + Math.round(JSON.stringify(DIR).length / 1024) + ' KB of source</td></tr><tr><th>Signed by</th><td>nobody; this is a wiki, not a market</td></tr></table>'],
    '/links': ['What links here', '<h1 class="first">What links here</h1><p>Every service in this directory links back to this page, and this page links to every service.</p><table class="tbl"><tr><th>Page</th><th>Links</th></tr>' +
      DIR.map(c => '<tr><td><a href="#' + c.id + '">' + esc(c.title) + '</a></td><td class="d">' + c.items.length + '</td></tr>').join('') + '</table>'],
    '/permanent': ['Permanent link', '<h1 class="first">Permanent link</h1><p class="addr">http://' + WIKI_HOST + '/</p><p>This address is the wiki’s own; every mirror prints the same page.</p>'],
    '/source': ['View source', '<h1 class="first">Main Page — source</h1><p>The page is plain HTML and a single stylesheet. Copy it, mirror it, keep the address.</p><pre style="background:#f8f9fa;border:1px solid #c8ccd1;padding:10px;overflow:auto;font-size:11.5px">' +
      esc('<h1>Main Page</h1>\n<p class="center"><span class="red">Welcome to The Hidden Wiki!</span>\n...\n' + ENTRIES.length + ' services, ' + LEAKS.length + ' leak archives') + '</pre>'],
    '/discussion': ['Discussion', '<h1 class="first">Discussion</h1><p>A wiki talk page, which means two people arguing politely and one person advertising a market.</p>' +
      [['kestrel', 'The leaks category needs the year next to every entry, otherwise nobody can tell a new dump from one that has been recycled three times.'],
        ['nullroute', 'Added the year and the record count. Left the counts as published, even where two outlets disagree.'],
        ['bitrot', 'Mirror three of the archives is dead again. Removed it; it will be back.'],
        ['seventeen', 'Can we stop listing clones under the name of the market that was seized? It is how people get robbed.']].map(([who, what]) =>
        '<div style="border-left:3px solid #c8ccd1;padding:2px 0 2px 10px;margin:10px 0"><b>' + esc(who) + '</b> <span class="d" style="color:#72777d;font-size:12px">· recently</span><p>' + esc(what) + '</p></div>').join('')],
    '/history': ['History', '<h1 class="first">Main Page — history</h1><table class="tbl"><tr><th>Date</th><th>Editor</th><th>Change</th></tr>' +
      ['three links added to Markets', 'two clones removed after a report', 'leak archive counts updated', 'search box fixed on narrow screens', 'rules clarified: dead addresses come off'].map((c, i) =>
        '<tr><td class="d">' + ['today', 'yesterday', '3 days ago', 'last week', 'last month'][i] + '</td><td class="d">' + ['nullroute', 'kestrel', 'mothwing', 'seventeen', 'bitrot'][i] + '</td><td class="d">' + esc(c) + '</td></tr>').join('') + '</table>'],
    '/contest': ['Contest', '<h1 class="first">The 2023 contest</h1><p class="center"><span class="red">Now You can earn FREE MONEY with the Hidden Wiki!</span></p>' +
      '<p>There is no contest. There has never been a contest. This notice is on the real wiki and on every clone of it, and the “free money” is the oldest page on the network: a form, a wallet address, and a promise.</p>' +
      '<div class="warn">If a page asks you to send coin to receive coin, it is a scam. That is the whole lesson, and it is free.</div>'],
    '/print': ['Printable version', '<h1 class="first">Printable version</h1><p>Print styles are for people who still keep paper. The directory below is the same one as the Main Page.</p>' + directoryHtml('')]
  };

  const wikiSite = {
    dark: true, host: WIKI_HOST, brand: 'The Hidden Wiki', icon: '📖', wiki: true,
    kind: 'Directory', topic: 'hidden wiki, directory, onion index', region: 'Onion space', market: false, noSales: true,
    tagline: 'The directory that outlives its mirrors: markets, forums, leaks, hosting, mail, libraries, tools.',
    bg: '#ffffff', ink: '#202122', link: '#0645ad', line: '#a2a9b1', field: '#f8f9fa', btn: '#f8f9fa', btnInk: '#202122', mute: '#54595d', accent: '#0645ad',
    tier: 'wiki', quality: 'wiki', v3: WIKI_HOST,
    aliases: WIKI_ALIASES,
    menu: [['Main page', '/'], ['Discussion', '/discussion'], ['View source', '/source'], ['History', '/history']]
  };
  wikiSite.render = (path, query) => {
    const q = query instanceof URLSearchParams ? query : new URLSearchParams(String(query || ''));
    const p = String(path || '/').replace(/\/+$/, '') || '/';
    if (p === '/') {
      const search = String(q.get('q') || '');
      return { status: 200, type: 'text/html', body: mainPage(search) };
    }
    if (p === '/leaks' || p === '/leak') return { status: 200, type: 'text/html', body: leaksIndexHtml(String(q.get('q') || '')) };
    const leak = /^\/leaks\/([a-z0-9-]+)(?:\/files)?$/.exec(p);
    if (leak) {
      const l = byLeakId.get(leak[1]);
      if (!l) return { status: 404, type: 'text/html', body: wikiShell('Not found', '<h1 class="first">No archive called that</h1><p><a href="/leaks">← all archives</a></p>') };
      if (/\/files$/.test(p)) {
        return {
          status: 200, type: 'text/plain',
          body: '# ' + l.name + ' (' + l.year + ') — simulated file list\n' +
            l.fields.map((f, i) => '  ' + l.id + '-' + String(i + 1).padStart(2, '0') + '.csv   ' + f + '   ' + (1000 + (hash(l.id + f) % 90000)) + ' rows').join('\n') +
            '\n  README.txt   provenance and field notes\n  checksums.sha256   ' + (hash(l.id) % 900 + 100) + ' files\n\n' +
            'This is a simulation: no archive is real and no row exists outside this page.\n'
        };
      }
      return { status: 200, type: 'text/html', body: leakPage(l.id) };
    }
    if (p === '/random') {
      const all = ENTRIES.filter(e => e.kind !== 'wiki');
      const pick = all[hash(String(Date.now())) % all.length];
      return { status: 302, type: 'text/plain', body: 'Redirecting to https://' + pick.host + '/', location: 'https://' + pick.host + '/' };
    }
    if (p === '/dead') {
      return {
        status: 200, type: 'text/html', body: wikiShell('Dead links', '<h1 class="first">Dead links</h1><p>Addresses that stopped answering in the last thirty days. They stay listed so nobody mistakes a clone for the original.</p>' +
          '<table class="tbl"><tr><th>Service</th><th>Address</th><th>Last answer</th></tr>' +
          [['Silk Mirror', hostFor('Silk Mirror')], ['Vault Seven', hostFor('Vault Seven')], ['Wall Street Market', hostFor('Wall Street Market')], ['Onion Forum', hostFor('Onion Forum')]].map(([n, h]) =>
            '<tr><td>' + esc(n) + '</td><td><span class="u">' + esc(h) + '</span></td><td class="d">' + ['31 days', '12 days', '4 months', '9 days'][hash(n) % 4] + ' ago</td></tr>').join('') + '</table>')
      };
    }
    if (p === '/categories') {
      return {
        status: 200, type: 'text/html', body: wikiShell('Categories', '<h1 class="first">Categories</h1>' +
          '<table class="tbl"><tr><th>Category</th><th>Services</th><th>What it holds</th></tr>' +
          DIR.map(c => '<tr><td><a href="#' + c.id + '">' + esc(c.title) + '</a></td><td>' + c.items.length + '</td><td class="d">' + esc(c.intro) + '</td></tr>').join('') + '</table>' +
          '<p><a href="/">← Main Page</a></p>')
      };
    }
    const page = PAGES[p];
    if (page) return { status: 200, type: 'text/html', body: wikiShell(page[0], page[1], { tab: p }) };
    return { status: 404, type: 'text/html', body: wikiShell('Not found', '<h1 class="first">There is no page at ' + esc(p) + '</h1><p><a href="/">← Main Page</a></p>') };
  };

  /* ------------------------------------------------------------------ the leak services ----------------------------------------------------- */
  function leakSite(host, spec) {
    const brand = spec.name;
    const base = A.darkGen && A.darkGen.makeSite ? A.darkGen.makeSite(host) : null;
    const site = Object.assign({}, base || {}, {
      dark: true, host, brand, icon: '🗂', kind: 'Leak archive', topic: 'leaks, whistleblowing, breaches',
      region: 'Onion space', market: false, noSales: true, tier: spec.tier || 'premium', quality: spec.tier || 'premium',
      tagline: spec.blurb || 'A leak archive: provenance first, rows second.', leaks: true
    });
    if (base && base.design) site.pal = base.design.pal;
    site.menu = [['Home', '/'], ['Archives', '/archives'], ['About', '/about'], ['Rules', '/rules'], ['PGP', '/pgp.txt'], ['Contact', '/contact']];
    const byCat = () => {
      const m = {};
      for (const l of LEAKS) for (const c of l.cats) (m[c] = m[c] || []).push(l);
      return m;
    };
    const rowFor = l => '<tr><td><a href="/leak/' + l.id + '">' + esc(l.name) + '</a></td><td>' + l.year + '</td><td>' + num(l.records) + '</td><td class="muted small">' + esc(l.source) + '</td></tr>';
    site.render = (path, query) => {
      const p = String(path || '/');
      const q = query instanceof URLSearchParams ? query : new URLSearchParams(String(query || ''));
      if (p === '/pgp.txt') return { status: 200, type: 'text/plain', body: '-----BEGIN PGP PUBLIC KEY BLOCK-----\nComment: ' + brand + ' <' + host + '> — simulated key\n\n' + 'A1B2C3D4'.repeat(16) + '\n-----END PGP PUBLIC KEY BLOCK-----\n' };
      if (p === '/about') return { status: 200, type: 'text/html', body: pageShell(site, 'About', '<h1>About</h1><p class="muted">' + esc(brand) + ' publishes archives with their provenance: where the data came from, when it was published, how many rows, and what is in them. We do not sell the rows and we do not mirror a dump without saying whose it is.</p><p>Years and record counts are the ones published at the time. Everything you see inside a sample table here is invented for the simulation.</p>') };
      if (p === '/rules') return { status: 200, type: 'text/html', body: pageShell(site, 'Rules', '<h1>Rules</h1><ol><li>Provenance or nothing.</li><li>No unredacted material about private people. A breach is a story about an organisation.</li><li>Samples show the shape of the data, never a real row.</li><li>A retraction is published on the front page, not deleted.</li></ol>') };
      if (p === '/contact') return { status: 200, type: 'text/html', body: pageShell(site, 'Contact', '<h1>Contact</h1><p class="muted">Use the key at /pgp.txt. Unsigned mail is read by nobody.</p><form action="/contact" method="post"><label>From</label><input name="from"><label>Message</label><textarea name="body" rows="6"></textarea><p><button>Send</button></p></form>') };
      if (p === '/archives') {
        const groups = byCat();
        return {
          status: 200, type: 'text/html', body: pageShell(site, 'Archives', '<h1>All archives</h1><p class="muted small">' + LEAKS.length + ' archives, ' + Object.keys(groups).length + ' categories.</p>' +
            Object.keys(groups).sort().map(cat => '<h2>' + esc(cat) + '</h2><table><tr><th>Archive</th><th>Year</th><th>Rows</th><th>Source</th></tr>' + groups[cat].map(rowFor).join('') + '</table>').join(''))
        };
      }
      const one = /^\/leak\/([a-z0-9-]+)(\/files)?$/.exec(p);
      if (one) {
        const l = byLeakId.get(one[1]);
        if (!l) return { status: 404, type: 'text/html', body: pageShell(site, 'Not found', '<h1>No archive called that</h1><p><a href="/archives">← all archives</a></p>') };
        if (one[2]) {
          return {
            status: 200, type: 'text/plain', body: '# ' + l.name + ' — file list (simulated)\n' + l.fields.map((f, i) =>
              '  part-' + String(i + 1).padStart(2, '0') + '.csv  ' + f + '  ' + (500 + hash(l.id + f) % 40000) + ' rows').join('\n') + '\n'
          };
        }
        const rows = l.docs ? '' : sampleRows(l, 5);
        return {
          status: 200, type: 'text/html', body: pageShell(site, l.name, '<h1>' + esc(l.name) + ' <span class="muted small">(' + l.year + ')</span></h1>' +
            '<p class="muted">' + num(l.records) + ' ' + (l.docs ? 'pages' : 'records') + ' · attributed to ' + esc(l.source) + ' · ' + esc(l.cats.join(', ')) + '</p>' +
            (l.fabricated ? '<div class="warn" style="border:1px solid #7a2a2a;background:#1c0d0d;padding:10px 12px;border-radius:8px;color:#f0b4b4"><b>This archive is fabricated.</b> It exists only inside this simulation, and it is absurd on purpose. The real catalogue beside it is not.</div>' : '') +
            '<p>' + esc(l.note) + '</p>' +
            (l.docs ? '<h2>Documents</h2><table><tr><th>Date</th><th>Marking</th><th>Document</th></tr>' + l.docs.map(d => '<tr><td class="small">' + esc(d[0]) + '</td><td class="small">' + esc(d[1]) + '</td><td>' + esc(d[2]) + '</td></tr>').join('') + '</table>' : '') +
            (l.shows ? '<h2>What the documents show</h2><ul>' + l.shows.map(sh => '<li>' + esc(sh) + '</li>').join('') + '</ul>' : '') +
            (l.excerpts ? '<h2>Selected excerpts</h2><p class="muted small">Invented, and written to be absurd.</p>' + l.excerpts.map(q => '<blockquote style="margin:10px 0;padding:2px 0 2px 12px;border-left:3px solid #7a2a2a;color:#c9b6b6">' + esc(q) + '</blockquote>').join('') : '') +
            '<h2>What is inside</h2><table><tr><th>Field</th><th>Notes</th></tr>' + l.fields.map(f => '<tr><td>' + esc(f) + '</td><td class="muted small">as published in the archive index</td></tr>').join('') + '</table>' +
            (l.docs ? '' : '<h2>Sample rows</h2><p class="muted small">Invented rows, so the shape is visible without republishing anybody.</p>' +
              '<table><tr><th>e-mail</th><th>name</th><th>location</th><th>hash</th><th>date</th><th>id</th></tr>' +
              rows.map(r => '<tr>' + r.map(c => '<td class="small">' + esc(c) + '</td>').join('') + '</tr>').join('') + '</table>') +
            '<p><a href="/leak/' + l.id + '/files">File list</a> · <a href="/archives">← all archives</a></p>')
        };
      }
      const search = String(q.get('q') || '').trim().toLowerCase();
      const list = LEAKS.filter(l => !search || (l.name + ' ' + l.source + ' ' + l.cats.join(' ') + ' ' + l.year).toLowerCase().includes(search));
      return {
        status: 200, type: 'text/html', body: pageShell(site, brand,
          '<div class="hero"><h1>' + esc(brand) + '</h1><p>' + esc(site.tagline) + '</p>' +
          '<form action="/" method="get" style="display:flex;gap:8px;margin-top:12px"><input name="q" value="' + esc(String(q.get('q') || '')) + '" placeholder="search the archive by name, year, source or category"><button>Search</button></form>' +
          '<div class="btnrow"><a class="pri" href="/archives">All ' + LEAKS.length + ' archives</a><a href="/about">Provenance policy</a></div></div>' +
          '<h2>' + (search ? 'Results for “' + esc(search) + '” (' + list.length + ')' : 'Newest archives') + '</h2>' +
          (list.length ? '<table><tr><th>Archive</th><th>Year</th><th>Rows</th><th>Source</th></tr>' + list.slice().sort((x, y) => y.year - x.year).slice(0, 18).map(rowFor).join('') + '</table>' : '<p class="muted">Nothing matched. Try a year, a category such as <a href="/?q=credentials">credentials</a>, or <a href="/archives">browse everything</a>.</p>') +
          '<h2>Categories</h2><p>' + Object.keys(byCat()).sort().map(c => '<a href="/?q=' + encodeURIComponent(c) + '">' + esc(c) + '</a>').join(' · ') + '</p>')
      };
    };
    site.leaks = true;
    return site;
  }

  /* the same chrome the generated dark sites use, so a leak site looks like a page and not like a list */
  function pageShell(site, title, inner) {
    const pal = site.pal || { bg: '#0b0d10', panel: '#12161c', ink: '#e7eaf0', mute: '#8f98a8', line: '#232a35', acc: '#7cc4ff', acc2: '#c7a8ff' };
    const menu = (site.menu || []).map(x => '<a href="' + x[1] + '">' + esc(x[0]) + '</a>').join('');
    return '<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">' +
      '<title>' + esc(title) + ' · ' + esc(site.brand) + '</title><style>' +
      'html,body{margin:0;background:' + pal.bg + ';color:' + pal.ink + ';font:15px/1.65 ui-sans-serif,system-ui,-apple-system,"Segoe UI",Roboto,sans-serif}' +
      'a{color:' + pal.acc + ';text-decoration:none}a:hover{text-decoration:underline}' +
      '.top{display:flex;gap:16px;align-items:center;padding:14px 22px;border-bottom:1px solid ' + pal.line + ';background:' + pal.panel + '}' +
      '.top b{font-size:16px}.top nav{margin-left:auto;display:flex;gap:14px;font-size:13px}.top nav a{color:' + pal.mute + '}.top nav a:hover{color:' + pal.acc + '}' +
      '.wrap{max-width:1000px;margin:0 auto;padding:24px 22px 60px}' +
      'h1{font-size:28px;line-height:1.2;margin:0 0 8px;letter-spacing:-.01em}h2{font-size:12px;letter-spacing:.14em;text-transform:uppercase;color:' + pal.mute + ';margin:30px 0 8px;border-bottom:1px solid ' + pal.line + ';padding-bottom:6px}' +
      '.hero{border:1px solid ' + pal.line + ';border-radius:16px;padding:26px;background:linear-gradient(135deg,color-mix(in srgb,' + pal.acc + ' 12%,' + pal.panel + '),' + pal.panel + ' 65%)}' +
      '.hero p{margin:0;color:' + pal.mute + '}' +
      '.btnrow{display:flex;gap:10px;flex-wrap:wrap;margin-top:16px}.btnrow a{padding:9px 15px;border:1px solid ' + pal.line + ';border-radius:9px;background:' + pal.panel + ';font-size:13px}' +
      '.btnrow a.pri{background:' + pal.acc + ';color:' + pal.bg + ';border-color:' + pal.acc + ';font-weight:650}' +
      'table{border-collapse:collapse;width:100%}th,td{text-align:left;padding:8px 9px;border-bottom:1px solid ' + pal.line + ';font-size:13px;vertical-align:top}' +
      'th{color:' + pal.mute + ';font-size:11px;letter-spacing:.08em;text-transform:uppercase}' +
      'input,textarea{width:100%;box-sizing:border-box;padding:9px 10px;border:1px solid ' + pal.line + ';border-radius:7px;background:' + pal.panel + ';color:inherit;font:inherit}' +
      'button{padding:9px 15px;border-radius:7px;border:0;background:' + pal.acc + ';color:' + pal.bg + ';font:inherit;font-weight:600;cursor:pointer}' +
      'label{display:block;margin:10px 0 4px;font-size:12px;color:' + pal.mute + '}' +
      '.muted{color:' + pal.mute + '}.small{font-size:12px}' +
      'footer{margin-top:40px;border-top:1px solid ' + pal.line + ';padding-top:14px;color:' + pal.mute + ';font-size:12px}' +
      '</style></head><body><div class="top"><b>' + esc(site.brand) + '</b><nav>' + menu + '</nav></div>' +
      '<div class="wrap">' + inner + '<footer>' + esc(site.host) + ' · simulated inside Moundshroud · every breach name and count is public history; every row of sample data is invented.</footer></div></body></html>';
  }

  /* ------------------------------------------------------------------ the public surface ------------------------------------------------------ */
  const leakSites = () => Object.keys(LEAK_HOSTS).map(id => leakSite(hostFor(LEAK_HOSTS[id]), { name: LEAK_HOSTS[id], blurb: (DIR.find(c => c.id === 'leaks').items.find(x => x[0] === LEAK_HOSTS[id]) || [])[2] }));

  /* every named service in the directory, built on demand: the wiki's links go through here */
  /* a directory entry opens the template that matches what the entry says it is, not whatever the address hashed to */
  const KIND_ID = {
    market: 'market', forum: 'forum', paste: 'paste', zine: 'news', news: 'news', service: 'service', archive: 'archive',
    search: 'search', mail: 'mail', hosting: 'hosting', vpn: 'vpn', library: 'library', tools: 'tools', mirror: 'tools', index: 'archive'
  };

  function named(host) {
    const e = byHost.get(String(host || '').toLowerCase());
    if (!e) return null;
    if (e.kind === 'wiki') return wikiSite;
    if (!A.darkGen || !A.darkGen.makeSite) return null;
    /* blogs and the board bring their own renderers (cyber-dark-social.js); everything else is generated */
    if (A.darkSocial && A.darkSocial.build && (e.kind === 'blog' || e.kind === 'social')) {
      const cached = namedCache.get(e.host);
      if (cached) return cached;
      const made = A.darkSocial.build(e);
      if (made) { namedCache.set(e.host, made); return made; }
    }
    if (e.kind === 'leaks') {
      const existing = leakCache.get(e.host);
      if (existing) return existing;
      const made = leakSite(e.host, { name: e.name, blurb: e.blurb });
      made.catEntry = e; namedCache.set(e.host, made); leakCache.set(e.host, made);
      return made;
    }
    if (namedCache.has(e.host)) return namedCache.get(e.host);
    /* the renderer closes over the object makeSite returned, so the directory's name and kind are written onto that same
       object: cloning it left the pages still calling themselves by the generated brand */
    const base = A.darkGen.makeSite(e.host, KIND_ID[e.kind] || null);
    const site = Object.assign(base, {
      brand: e.name, icon: e.kind === 'market' ? '🛒' : e.kind === 'forum' ? '💬' : e.kind === 'search' ? '🔎' : e.kind === 'mail' ? '✉️' : e.kind === 'hosting' ? '🗄' : e.kind === 'news' ? '📰' : e.kind === 'vpn' ? '🛡' : e.kind === 'library' ? '📚' : e.kind === 'seized' ? '🚫' : base.icon,
      kind: e.kind === 'market' ? 'Marketplace' : e.kind === 'forum' ? 'Forum' : e.kind === 'search' ? 'Search engine' : e.kind === 'mail' ? 'Mail' : e.kind === 'hosting' ? 'Hosting' : e.kind === 'news' ? 'News' : e.kind === 'library' ? 'Library' : e.kind === 'vpn' ? 'VPN' : e.kind === 'seized' ? 'Seized' : e.kind === 'mirror' ? 'Mirror' : e.kind === 'tools' ? 'Software mirror' : e.kind === 'service' ? 'Service desk' : e.kind === 'index' ? 'Directory' : base.kind,
      tagline: e.blurb, catEntry: e,
      tier: e.kind === 'seized' ? 'broken' : (base.design && base.design.tier) || base.tier || 'clean'
    });
    site.menu = [['Home', '/'], ['About', '/about'], ['Rules', '/rules'], ['PGP', '/pgp.txt'], ['Contact', '/contact']];
    /* a seized service is a notice, not a market: the address answers with the takedown and nothing else */
    if (e.kind === 'seized') {
      site.render = () => ({
        status: 200, type: 'text/html',
        body: pageShell(site, 'Seized',
          '<div style="border:4px solid #b31b1b;padding:22px;background:#170404">' +
          '<h1 style="color:#ff5a5a;text-transform:uppercase;letter-spacing:.12em">This hidden service has been seized</h1>' +
          '<p class="muted">The address that used to answer here is now a notice. ' + esc(e.name) + ' was taken down; the banner is what remains.</p>' +
          '<p class="muted small">If a page still answers at a similar address and calls itself ' + esc(e.name) + ', it is a clone. Clones keep the name, the accounts and the deposits.</p>' +
          '<p><a href="/">← back</a></p></div>')
      });
    }
    namedCache.set(e.host, site);
    return site;
  }
  const namedCache = new Map(), leakCache = new Map();

  const allLeaks = () => LEAKS.map(l => ({ id: l.id, name: l.name, year: l.year, records: l.records, cats: l.cats.slice(), source: l.source }));

  A.hiddenWiki = {
    host: WIKI_HOST, aliases: WIKI_ALIASES.slice(), site: wikiSite, named,
    entries: () => ENTRIES.map(e => Object.assign({}, e)),
    categories: () => DIR.map(c => ({ id: c.id, title: c.title, intro: c.intro, count: c.items.length })),
    leaks: allLeaks, leakSites, leakPage,
    find(key) {
      const s = String(key || '').trim().toLowerCase().replace(/^https?:\/\//, '').replace(/\/.*$/, '').replace(/^www\./, '');
      if (!s) return null;
      if (s === WIKI_HOST || WIKI_ALIASES.includes(s) || s === 'hiddenwiki' || s === 'the hidden wiki') return wikiSite;
      return named(s);
    },
    isWiki: host => String(host || '').toLowerCase() === WIKI_HOST || WIKI_ALIASES.includes(String(host || '').toLowerCase()),
    hostFor,
    count: () => ENTRIES.length
  };
})();

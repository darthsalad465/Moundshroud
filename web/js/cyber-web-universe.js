// The fake internet behind the Cyber Desktop's browser: every site, page, user, order, post and secret below is
// generated in this page, on demand, and lives only in memory. Nothing is fetched, no DNS lookup happens, and about
// one in eight sites (only categories where scams/pop-ups make sense, plus Cyber Mail phishing drills) are booby-trapped.
//
// Each site is unique: its name, host, palette, copy, staff, prices, posts, hidden staff path and flag are composed at
// random from the pools here, so the catalogue can grow forever. `serve()` answers requests the way the site's fake
// backend would — pages, JSON APIs, a staff area, robots.txt and a leaked .env — and the moundshell's existing
// `browser breach` command turns any of them into a target in the pentest range.
(() => {
  /* A is the app's own object (a top-level binding in core.js, not a window property) */
  const pick = list => list[(Math.random() * list.length) | 0];
  const int = (lo, hi) => lo + ((Math.random() * (hi - lo + 1)) | 0);
  const tok = (n, abc) => {
    const a = abc || '0123456789abcdef';
    return Array.from({ length: n }, () => a[int(0, a.length - 1)]).join('');
  };
  const esc = s => String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const cap = s => String(s).charAt(0).toUpperCase() + String(s).slice(1);

  const PRE = ['amber', 'blue', 'bright', 'silver', 'iron', 'copper', 'quiet', 'rapid', 'hollow', 'stone', 'nova', 'terra',
    'lunar', 'delta', 'orbit', 'crimson', 'sable', 'pine', 'marble', 'urban', 'wild', 'coastal', 'mellow', 'stark',
    'velvet', 'atlas', 'echo', 'tidal', 'granite', 'sundown', 'north', 'little', 'first', 'second', 'old', 'new', 'grey',
    'orchard', 'lantern', 'paper', 'yonder', 'bramble', 'cinder', 'moss', 'opal', 'river', 'salt', 'summit', 'umber',
    'vesper', 'willow', 'zephyr', 'alder', 'birch', 'cedar', 'dawn', 'dusk', 'elm', 'fern', 'gale', 'hazel', 'ivy',
    'juniper', 'kestrel', 'linden', 'maple', 'nettle', 'oak', 'quartz', 'reed', 'rowan', 'sorrel', 'thistle', 'wren'];
  const SUF = ['Labs', 'Group', 'Collective', 'Works', 'Studio', 'Union', 'Co', 'House', 'Partners', 'Supply', 'Trading',
    'Bureau', 'Depot', 'Guild', 'Rooms', 'Press', 'Services', 'Yard', 'Mill', 'Exchange', 'Society', 'Market'];
  const TLD = ['.com', '.net', '.io', '.shop', '.site', '.app', '.org', '.co', '.store', '.online', '.tech', '.dev',
    '.blog', '.news', '.club', '.live', '.studio', '.digital', '.info', '.xyz', '.uk', '.eu'];
  const ADJ = ['classic', 'deluxe', 'everyday', 'compact', 'heritage', 'midnight', 'sunrise', 'travel', 'studio', 'limited',
    'organic', 'signed', 'reclaimed', 'brushed', 'weathered', 'polished', 'seasonal', 'unlisted', 'small-batch', 'long',
    'short', 'hand-cut', 'sun-dried', 'folded', 'fresh', 'late', 'early', 'second-hand', 'refurbished', 'bespoke',
    'plain', 'spiced', 'smoked', 'cold', 'warm', 'pressed'];
  const FIRST = ['maya', 'leo', 'priya', 'tom', 'zara', 'noah', 'ines', 'kofi', 'lena', 'omar', 'sara', 'ben', 'yuki', 'ivan',
    'nia', 'tariq', 'ravi', 'emma', 'jonas', 'ada', 'milo', 'freya', 'hugo', 'sana', 'idris', 'mei', 'rosa', 'finn',
    'anya', 'jules', 'beatriz', 'kiran', 'oleg', 'noor', 'theo', 'elodie', 'sam', 'pia', 'arun', 'greta', 'mo', 'lila'];
  const LAST = ['nair', 'aldridge', 'okafor', 'weiss', 'silva', 'haddad', 'lund', 'moreau', 'kato', 'bright', 'ellis', 'rahman',
    'novak', 'baptiste', 'field', 'quinn', 'sato', 'otto', 'marsh', 'vey', 'doyle', 'lam', 'ferrari', 'jansen',
    'khalid', 'mensah', 'price', 'sorensen', 'tanaka', 'vance', 'whitlock', 'yusuf', 'zeller', 'abbot', 'barros'];
  const ROLES = ['Support', 'Billing', 'Engineering', 'Sales', 'Compliance', 'Moderator', 'Ops', 'Finance'];
  const ACCENTS = ['#5eead4', '#a78bfa', '#fbbf24', '#f472b6', '#60a5fa', '#34d399', '#fb923c', '#e879f9', '#f87171', '#93c5fd'];
  const TOPICS = ['the old bridge closure', 'a missing delivery van', 'the price of diesel', 'a new bus route',
    'the leaky roof at the leisure centre', 'this year\'s harvest', 'the night market', 'a disputed parking fine',
    'the library opening hours', 'a very loud generator', 'the swimming pool boiler', 'a stray dog with a following',
    'a road closed for six weeks', 'the missing speed limit sign', 'an argument about a wall', 'the new one-way system',
    'a hedge that ate a postbox', 'the annual cheese rolling', 'a suspiciously cheap electricity tariff',
    'the last payphone in town', 'a bench nobody admits ordering', 'the Christmas lights budget',
    'a pothole with its own nickname', 'the ferry timetable', 'a very determined seagull',
    'the bus that never arrives', 'a shop closing after forty years', 'the harbour dredging',
    'a missing bus stop', 'the volunteer fire brigade', 'an unexpectedly popular car boot sale',
    'a planning appeal about a conservatory'];

  const CATS = [
    { id: 'market', icon: '🛒', label: 'Marketplace', route: '/shop', routeLabel: 'Shop',
      nouns: ['market', 'basket', 'goods', 'shelf', 'stall', 'trove', 'store'],
      taglines: ['Hand-picked things, wrapped in paper and sent slowly.', 'A small shop with an unreasonable number of lamps.',
        'Everything you never needed, delivered with care.', 'Goods from people we have actually met.'],
      items: ['ceramic mug', 'brass desk lamp', 'linen apron', 'walnut stool', 'wool blanket', 'tin of tea',
        'leather notebook', 'glass vase', 'cast iron pan', 'paper lantern'],
      about: ['We started in a garage with one shelf and a broken kettle.', 'Every order is packed by hand in the back room.',
        'If it arrives damaged, we send another and apologise twice.'] },
    { id: 'bank', icon: '🏦', label: 'Bank', route: '/accounts', routeLabel: 'Accounts',
      nouns: ['bank', 'ledger', 'credit', 'trust', 'savings', 'vault', 'union'],
      taglines: ['Your money, slightly slower than you expect.', 'A bank that still answers the phone.',
        'Local banking since the branch on the corner.', 'We know the manager. He is called Dave.'],
      items: ['Everyday account', 'Fixed saver', 'Junior saver', 'Travel card', 'Business loan', 'Mortgage fix'],
      about: ['We have held deposits for the town for four generations.', 'Our branches close at half past four, as they always have.',
        'The vault is older than the building around it.'] },
    { id: 'news', icon: '📰', label: 'News', route: '/latest', routeLabel: 'Latest',
      nouns: ['herald', 'gazette', 'ledger', 'observer', 'courier', 'post', 'beacon'],
      taglines: ['The town, reported properly.', 'Local news without the shouting.', 'Slow news, carefully checked.'],
      items: [], about: ['Founded above a print shop.', 'Independent and reader-funded.',
        'The corrections column is on page two, where it belongs.'] },
    { id: 'social', icon: '💬', label: 'Social', route: '/feed', routeLabel: 'Feed',
      nouns: ['circle', 'feed', 'commons', 'gather', 'square', 'thread'],
      taglines: ['Small groups, no algorithm.', 'A quieter place to post.', 'Rooms for people you actually know.'],
      items: [], about: ['We cap every group at forty people on purpose.', 'No recommendation engine. Just posts, newest first.'] },
    { id: 'clinic', icon: '🩺', label: 'Clinic', route: '/appointments', routeLabel: 'Appointments',
      nouns: ['clinic', 'health', 'care', 'wellness', 'practice', 'surgery'],
      taglines: ['Appointments that actually happen.', 'Same-day slots, mostly.', 'Care from people who know your name.'],
      items: ['Nurse appointment', 'Dental check', 'Physio session', 'Blood test', 'Travel clinic', 'New patient review'],
      about: ['Two GPs, one nurse and a very old waiting-room radio.', 'We run the evening clinic on Tuesdays.'] },
    { id: 'gov', icon: '🏛️', label: 'Council', route: '/services', routeLabel: 'Services',
      nouns: ['council', 'borough', 'district', 'authority', 'parish'],
      taglines: ['Services, forms and a surprising number of PDFs.', 'The council, online, in theory.', 'Bins, permits and public notices.'],
      items: ['Bin collection', 'Parking permit', 'Planning application', 'Library card', 'Council tax', 'Road report'],
      about: ['We publish every committee paper unless we are told not to.', 'FOI requests are answered within twenty working days.'] },
    { id: 'saas', icon: '☁️', label: 'SaaS', route: '/pricing', routeLabel: 'Pricing',
      nouns: ['cloud', 'stack', 'flow', 'suite', 'desk', 'board', 'sync'],
      taglines: ['Ship faster with fewer meetings.', 'The workspace your team will tolerate.', 'One more dashboard, but a nice one.'],
      items: ['Starter', 'Team', 'Business', 'Enterprise', 'Add-on: SSO', 'Add-on: audit log'],
      about: ['We were two people and a cron job in a spare bedroom.', 'The status page is updated by hand, honestly.'] },
    { id: 'food', icon: '🍜', label: 'Takeaway', route: '/menu', routeLabel: 'Menu', layout: 'menu',
      nouns: ['kitchen', 'noodle', 'grill', 'bakery', 'diner', 'soup', 'taqueria'],
      taglines: ['Hot food, one street away.', 'Everything is better with chilli oil.', 'Open late, closed Mondays.'],
      items: ['Noodle bowl', 'Charred greens', 'Pork bun', 'Chilli oil jar', 'Rice pot', 'Iced tea'],
      about: ['The recipes came from a notebook with a burnt cover.', 'We buy from the market on the corner every morning.'] },
    { id: 'travel', icon: '✈️', label: 'Travel', route: '/trips', routeLabel: 'Trips',
      nouns: ['travel', 'escape', 'wander', 'route', 'voyage', 'trail'],
      taglines: ['Slow trips for people with too many tabs open.', 'Trains over planes, where we can.', 'Small groups, long walks.'],
      items: ['Coastal walk', 'City weekend', 'Island week', 'Rail pass', 'Guided climb', 'Winter cabin'],
      about: ['Our guides live where they work.', 'Group sizes are capped at nine.'] },
    { id: 'crypto', icon: '🪙', label: 'Exchange', route: '/markets', routeLabel: 'Markets',
      nouns: ['coin', 'token', 'exchange', 'protocol', 'ledger', 'mint'],
      taglines: ['Trade things that may not exist.', 'Liquidity, probably.', 'The friendliest order book on the internet.'],
      items: ['Spot trading', 'Staking pool', 'Order book', 'Wallet sync', 'Withdrawals', 'Referral link'],
      about: ['Founded during a bull run by four people in a co-working space.', 'The proof-of-reserves page is dated last spring.'] },
    { id: 'school', icon: '🎓', label: 'Academy', route: '/courses', routeLabel: 'Courses',
      nouns: ['academy', 'college', 'institute', 'school', 'campus', 'learn'],
      taglines: ['Evening classes for curious people.', 'Learn slowly, keep it.', 'Small rooms, good coffee.'],
      items: ['Evening Spanish', 'Intro to bookbinding', 'Bread baking', 'Basic electronics', 'Life drawing', 'Chess club'],
      about: ['The building used to be a library.', 'Half the tutors are retired and unpaid.'] },
    { id: 'jobs', icon: '💼', label: 'Jobs', route: '/roles', routeLabel: 'Roles', layout: 'jobs',
      nouns: ['jobs', 'careers', 'work', 'hire', 'talent', 'shift'],
      taglines: ['Local work, honestly described.', 'No "rockstar" anything.', 'Salary on every listing, or it is not listed.'],
      items: ['Warehouse assistant', 'Night porter', 'Bookkeeper', 'Line chef', 'Gardener', 'Delivery driver'],
      about: ['We started because the local board was all debt-collection ads.', 'Every poster must state the pay.'] }
  ];

  /* more of the internet: public bodies, trades, clubs, blogs, shops, dubious ventures and everything between */
  const EXTRA_CATS = [
    { id: 'blog', icon: '📔', label: 'Personal blog', route: '/posts', routeLabel: 'Posts',
      nouns: ['notes', 'pages', 'journal', 'diary', 'letters', 'thoughts', 'desk'],
      taglines: ['Notes from a kitchen table.', 'I write here so I stop repeating myself in conversation.',
        'Mostly photographs of the same beach.', 'A record of the small things.'],
      items: [], about: ['I live here with two cats and a lot of unfinished projects.',
        'This page has been running since a rainy Sunday and has not been redesigned since.'],
      bodies: ['I have been trying to fix the shed door for three weekends. It is winning.',
        'The bus was early today, which made everyone suspicious.',
        'I found my old camera and the first twelve photographs were all of the same wall.',
        'Turns out you can grow a surprising amount of basil in a window that faces north.'] },
    { id: 'police', icon: '🚓', label: 'Police service', route: '/appeals', routeLabel: 'Appeals',
      nouns: ['constabulary', 'police', 'patrol', 'watch', 'precinct'],
      taglines: ['Local policing, reported openly.', 'Appeals, advice and station opening hours.'],
      items: ['Report a crime', 'Station opening hours', 'Safer neighbourhoods', 'Lost property', 'Road safety', 'Volunteer'],
      about: ['We publish every appeal we can and answer the phone after four rings.',
        'The front desk closes at six; the phone line does not.'],
      bodies: ['Officers are appealing for witnesses after an incident on the ring road on Tuesday evening.',
        'A bicycle recovered last month has not been claimed. Please call if it is yours.'] },
    { id: 'transit', icon: '🚌', label: 'Transit authority', route: '/timetables', routeLabel: 'Timetables',
      nouns: ['transit', 'buses', 'metro', 'railway', 'transport', 'tramway'],
      taglines: ['Timetables, delays and a map that is nearly right.', 'Buses that exist, mostly.'],
      items: ['Route 12 timetable', 'Night service', 'Ticket prices', 'Accessible travel', 'Delay refunds', 'Lost property'],
      about: ['We run the buses the council owns and the ones it inherited.',
        'Every delay over twenty minutes is published, even the embarrassing ones.'],
      bodies: ['Route 12 is diverting via the harbour until the roadworks finish, expected in March.',
        'The last night bus now leaves ten minutes later after the theatre closes.'] },
    { id: 'museum', icon: '🏺', label: 'Museum', route: '/visit', routeLabel: 'Visit',
      nouns: ['museum', 'gallery', 'archive', 'collection', 'heritage'],
      taglines: ['A small museum with a very large boat.', 'Objects, labels and a tea room.'],
      items: ['Permanent collection', 'The boat hall', 'Family trail', 'Study room', 'Group visits', 'Tea room'],
      about: ['The building was a customs house until the river moved.',
        'Roughly one per cent of the collection is on display; the rest is in the basement.'],
      bodies: ['A newly conserved chart goes on display this week, complete with its coffee stain.',
        'The boat hall closes early on Fridays for cleaning.'] },
    { id: 'university', icon: '🏛️', label: 'University', route: '/courses', routeLabel: 'Courses',
      nouns: ['university', 'college', 'polytechnic', 'faculty', 'campus'],
      taglines: ['Teaching, research and too many staircases.', 'A campus built in four different decades.'],
      items: ['Undergraduate courses', 'Postgraduate study', 'Open days', 'Research groups', 'Library', 'Accommodation'],
      about: ['We have taught here since the technical school opened next to the gasworks.',
        'Semester dates have not changed since 1998, despite repeated promises.'],
      bodies: ['The library will be open until midnight during examinations week.',
        'A research group has published a paper on river sediment that is unexpectedly readable.'] },
    { id: 'sports', icon: '⚽', label: 'Sports club', route: '/fixtures', routeLabel: 'Fixtures',
      nouns: ['athletic', 'rovers', 'united', 'harriers', 'rowers', 'cricket'],
      taglines: ['Founded 1898. Still no changing rooms.', 'A club run by volunteers and a tea urn.'],
      items: ['First team fixtures', 'Reserves', 'Junior section', 'Membership', 'Clubhouse hire', 'Volunteer'],
      about: ['We play on the pitch behind the allotments, weather permitting.',
        'Subs are two pounds a week and the tea is free.'],
      bodies: ['Saturday\'s match was abandoned after forty minutes when the fog arrived.',
        'The junior section needs two more coaches before the season starts.'] },
    { id: 'radio', icon: '📻', label: 'Radio station', route: '/schedule', routeLabel: 'Schedule', layout: 'radio',
      nouns: ['radio', 'fm', 'sound', 'wave', 'broadcast'],
      taglines: ['Community radio, twenty-four hours, mostly volunteers.', 'Local voices, occasional silence.'],
      items: ['Breakfast show', 'The afternoon slot', 'Local history hour', 'Request line', 'Volunteer', 'Podcast archive'],
      about: ['The studio is above the laundrette; the lift has never worked.',
        'Our licence requires three hours of local speech a day and we do four.'],
      bodies: ['Tonight\'s show is a two-hour special on the closure of the lido.',
        'The request line is open again after a lengthy argument with the phone company.'] },
    { id: 'magazine', icon: '📓', label: 'Magazine', route: '/issues', routeLabel: 'Issues',
      nouns: ['review', 'quarterly', 'digest', 'press', 'journal'],
      taglines: ['Long reads about small things.', 'Printed twice a year, posted when we remember.'],
      items: ['Latest issue', 'Archive', 'Subscriptions', 'Write for us', 'Letters', 'Stockists'],
      about: ['Founded by four people who could not agree on a name for a year.',
        'The letters page is the only part nobody edits.'],
      bodies: ['Issue forty-one is at the printers, three weeks later than promised.',
        'Our piece on the bus station won a small award and a larger argument.'] },
    { id: 'recipe', icon: '🥣', label: 'Recipe site', route: '/recipes', routeLabel: 'Recipes',
      nouns: ['kitchen', 'spoon', 'larder', 'table', 'pantry', 'oven'],
      taglines: ['Everything takes longer than the photo suggests.', 'Recipes with the mistakes included.'],
      items: ['Slow bread', 'Onion soup', 'Roast chicken', 'Pickled things', 'Cake for a crowd', 'Leftovers'],
      about: ['The photographs are taken on the same chipped plate.',
        'Measurements are in cups because the scales broke.'],
      bodies: ['The bread works better if you forget it for an hour. This is now the method.',
        'A short defence of boiling vegetables for longer than you were told.'] },
    { id: 'fitness', icon: '🏋️', label: 'Gym', route: '/classes', routeLabel: 'Classes',
      nouns: ['fitness', 'strength', 'motion', 'studio', 'gym'],
      taglines: ['A gym in a converted garage.', 'No mirrors, no contracts, one very old rowing machine.'],
      items: ['Circuits', 'Beginners\' strength', 'Morning stretch', 'Day pass', 'Personal plan', 'Membership'],
      about: ['Kettlebells inherited from a closing leisure centre.',
        'The heating is on a timer nobody has found.'],
      bodies: ['The six o\'clock class moves to the yard while the roof is repaired.',
        'New members get a free session and an honest conversation about knees.'] },
    { id: 'charity', icon: '🤝', label: 'Charity', route: '/appeal', routeLabel: 'Appeal', layout: 'report',
      nouns: ['trust', 'fund', 'appeal', 'foundation', 'society', 'relief'],
      taglines: ['Small grants, local problems.', 'Run by six people and a spreadsheet.'],
      items: ['Winter appeal', 'Apply for a grant', 'Volunteer', 'Annual report', 'Donate', 'Partner with us'],
      about: ['We give grants of a few hundred pounds to people the system has missed.',
        'Every application is read by a person, usually on a Tuesday.'],
      bodies: ['The winter appeal is short by four hundred pounds with two weeks to go.',
        'Our annual report is twelve pages and one of them is the accounts.'] },
    { id: 'estate', icon: '🏘️', label: 'Letting agency', route: '/properties', routeLabel: 'Properties',
      nouns: ['property', 'lettings', 'homes', 'estates', 'residences'],
      taglines: ['Rooms, flats and one very narrow house.', 'Viewings on Saturdays, keys on a string.'],
      items: ['One-bed flat', 'Room in shared house', 'The narrow house', 'Studio', 'Family home', 'Garage'],
      about: ['We manage forty properties and answer the phone ourselves.',
        'Deposits are held properly, which should not be a selling point.'],
      bodies: ['The flat above the bakery is available from the first of the month.',
        'We have finally replaced the hall light in number fourteen.'] },
    { id: 'law', icon: '⚖️', label: 'Law firm', route: '/services', routeLabel: 'Services',
      nouns: ['partners', 'chambers', 'solicitors', 'legal', 'advocates'],
      taglines: ['Two partners, one very good secretary.', 'Straightforward advice, billed in six-minute units.'],
      items: ['Housing advice', 'Wills and probate', 'Small business', 'Employment', 'First consultation', 'Fees'],
      about: ['The practice has occupied the same two rooms since 1974.',
        'We tell you when you do not need a lawyer.'],
      bodies: ['New rules on deposit disputes come into force next month; here is what changes.',
        'Our first consultation is free for tenants facing eviction.'] },
    { id: 'garage', icon: '🔧', label: 'Garage', route: '/services', routeLabel: 'Services',
      nouns: ['motors', 'garage', 'autos', 'workshop', 'service'],
      taglines: ['Servicing, tyres and honest bills.', 'We will tell you when it can wait.'],
      items: ['Full service', 'MOT', 'Tyres', 'Brakes', 'Diagnostics', 'Courtesy car'],
      about: ['Two lifts, three mechanics and a kettle that never stops.',
        'Parts are sourced locally where we can.'],
      bodies: ['MOT slots are open until seven on Thursdays through the winter.',
        'A note on why your warning light is not always an emergency.'] },
    { id: 'scam', icon: '🪙', label: 'Giveaway site', route: '/claim', routeLabel: 'Claim',
      nouns: ['giveaway', 'reward', 'bonus', 'jackpot', 'airdrop'],
      taglines: ['You have been selected. Again.', 'Claim your reward before the timer runs out.'],
      items: ['500 free coins', 'VIP access', 'Double your deposit', 'Referral bonus', 'Limited box', 'Instant withdrawal'],
      about: ['Founded eleven days ago by people who love giving money away.',
        'Testimonials are collected from our own support inbox.'],
      bodies: ['Congratulations! Your wallet has been whitelisted for the tenth time this week.',
        'Withdrawals are processed within 90 days, subject to review, subject to nothing.'] }
  ];
  CATS.push(...EXTRA_CATS);

  /* and the rest of a whole town's internet: shops, trades, public services, clubs and software */
  const MORE_CATS = [
    { id: 'pet', icon: '🐾', label: 'Pet shop', route: '/shop', routeLabel: 'Shop',
      nouns: ['pets', 'paws', 'kennel', 'aquatics', 'feed', 'fur'],
      taglines: ['Food, beds and far too many toys.', 'Everything for animals who did not ask for any of it.'],
      items: ['Dry dog food 12kg', 'Cat bed', 'Rabbit pellets', 'Bird seed', 'Fish flakes', 'Chew rope'],
      about: ['We opened because the nearest pet shop was two bus rides away.', 'The shop dog is called Biscuit and is not for sale.'],
      bodies: ['Biscuit has been promoted to head of customer service and is taking it very seriously.'] },
    { id: 'bakery', icon: '🥐', label: 'Bakery', route: '/bread', routeLabel: 'Today\u2019s bread',
      nouns: ['bakery', 'loaf', 'crumb', 'oven', 'dough', 'bakehouse'],
      taglines: ['Out of the oven at six, gone by eleven.', 'Sourdough, rye and one very stubborn oven.'],
      items: ['Country sourdough', 'Seeded rye', 'Cinnamon bun', 'Cheese straw', 'Focaccia', 'Birthday cake'],
      about: ['The starter is older than the shop and has a name.', 'We bake what we can sell that day and nothing else.'],
      bodies: ['The oven door fell off again. Everything is fine, the bread is fine.'] },
    { id: 'dentist', icon: '🦷', label: 'Dental practice', route: '/appointments', routeLabel: 'Appointments',
      nouns: ['dental', 'smile', 'tooth', 'molar', 'hygiene'],
      taglines: ['Gentle, honest and usually on time.', 'Check-ups without the lecture.'],
      items: ['Check-up', 'Hygienist visit', 'Filling', 'Emergency slot', 'Whitening', 'Child check-up'],
      about: ['Two dentists, one hygienist and a fish called Keith.', 'We explain the cost before anything happens.'],
      bodies: ['We now send reminders by text as well as post, because the post was winning.'] },
    { id: 'church', icon: '⛪', label: 'Parish church', route: '/services', routeLabel: 'Services',
      nouns: ['parish', 'church', 'chapel', 'minster', 'abbey'],
      taglines: ['Open daily, roof permitting.', 'A very old building with a very new boiler.'],
      items: ['Sunday service', 'Wednesday prayer', 'Bell ringing', 'Hall hire', 'Food bank drop-off', 'Volunteer'],
      about: ['The tower is 14th century; the noticeboard is from 1997.', 'Everyone is welcome, including the dog.'],
      bodies: ['The roof appeal has reached two thirds of its target, thanks to a very successful cake stall.'] },
    { id: 'theatre', icon: '🎭', label: 'Theatre', route: '/whats-on', routeLabel: 'What\u2019s on',
      nouns: ['theatre', 'playhouse', 'stage', 'lyric', 'auditorium'],
      taglines: ['Two hundred seats and one temperamental curtain.', 'Amateur dramatics, professional nerves.'],
      items: ['Friday comedy night', 'The winter play', 'Children\u2019s matinee', 'Film club', 'Bar shift', 'Season ticket'],
      about: ['The building was a corn exchange before it was anything else.', 'The bar takes cash and goodwill.'],
      bodies: ['The panto auditions are on Thursday. Bring a song and no expectations.'] },
    { id: 'library', icon: '📚', label: 'Library', route: '/catalogue', routeLabel: 'Catalogue',
      nouns: ['library', 'lending', 'reading', 'stacks', 'branch'],
      taglines: ['Books, warmth and a very good chair.', 'Free to join, hard to leave.'],
      items: ['Join the library', 'Request a book', 'Rhyme time', 'Study space', 'Printing', 'Local history'],
      about: ['We lend more than books: seeds, tools and a telescope.', 'The quiet room is genuinely quiet.'],
      bodies: ['Opening hours extend to seven on Thursdays for the winter.'] },
    { id: 'podcast', icon: '🎙️', label: 'Podcast', route: '/episodes', routeLabel: 'Episodes', layout: 'episodes',
      nouns: ['podcast', 'cast', 'signal', 'microphone', 'audio'],
      taglines: ['Two friends, one microphone and too many opinions.', 'Recorded in a wardrobe for the acoustics.'],
      items: ['Episode 1: Beginnings', 'Episode 12: The argument', 'Bonus: bloopers', 'Transcripts', 'Patreon', 'Merch'],
      about: ['We started during a power cut and kept going.', 'New episodes when the editing software cooperates.'],
      bodies: ['Episode 18 is late because the laptop fan sounds like a lawnmower.'] },
    { id: 'forum', icon: '💬', label: 'Forum', route: '/threads', routeLabel: 'Threads', layout: 'forum',
      nouns: ['forum', 'boards', 'discuss', 'commons', 'talk'],
      taglines: ['Ask a question, get four opinions and one answer.', 'A forum that still uses signatures.'],
      items: [], about: ['Founded by three people who missed the old internet.', 'Moderation is one person and a set of house rules.'],
      bodies: ['Please read the pinned post before posting the same question again.'] },
    { id: 'wiki', icon: '📖', label: 'Community wiki', route: '/wiki', routeLabel: 'Wiki', layout: 'wiki',
      nouns: ['wiki', 'handbook', 'compendium', 'almanac', 'guide'],
      taglines: ['Written by whoever got there first.', 'Everything the town knows, roughly.'],
      items: ['The old station', 'River levels', 'Bus routes', 'Local dialect', 'Ghost stories', 'Allotments'],
      about: ['Anybody can edit, and anybody does.', 'Citations are encouraged and frequently ignored.'],
      bodies: ['The page on the bridge has been protected after an edit war about its height.'] },
    { id: 'weather', icon: '🌦️', label: 'Weather service', route: '/forecast', routeLabel: 'Forecast', layout: 'forecast',
      nouns: ['weather', 'climate', 'sky', 'barometer', 'meteo'],
      taglines: ['Wrong, but confidently.', 'The forecast, updated whenever someone looks outside.'],
      items: ['Five day forecast', 'Tide times', 'Rain radar', 'Wind', 'Warnings', 'Historical records'],
      about: ['Our station is a shed with a thermometer and a very keen volunteer.', 'We publish the errors too.'],
      bodies: ['The anemometer is fixed. The readings are no longer an estimate based on trees.'] },
    { id: 'courier', icon: '📦', label: 'Courier', route: '/track', routeLabel: 'Track',
      nouns: ['courier', 'parcel', 'freight', 'dispatch', 'logistics'],
      taglines: ['It is on the van. Probably.', 'Tracked, insured and occasionally early.'],
      items: ['Next day', 'Two day', 'Parcel drop-off', 'Collection', 'International', 'Packaging'],
      about: ['Four vans, one depot and a scanner that works most days.', 'Drivers know the shortcuts and the dogs.'],
      bodies: ['Deliveries to the harbour road are delayed until the bridge reopens.'] },
    { id: 'farm', icon: '🥕', label: 'Farm shop', route: '/produce', routeLabel: 'Produce',
      nouns: ['farm', 'field', 'harvest', 'acre', 'meadow'],
      taglines: ['Whatever the field did this week.', 'Mud included at no extra charge.'],
      items: ['Box of vegetables', 'Free range eggs', 'Raw milk', 'Honey', 'Apple juice', 'Seasonal fruit'],
      about: ['Three generations and a tractor that predates all of them.', 'We sell what we grow and buy the rest locally.'],
      bodies: ['The courgette situation has escalated. Please help.'] },
    { id: 'bike', icon: '🚲', label: 'Bike shop', route: '/bikes', routeLabel: 'Bikes',
      nouns: ['bicycle', 'cycle', 'spoke', 'chain', 'velo'],
      taglines: ['Repairs, wheels and strong opinions on helmets.', 'We will fix the bike you already have.'],
      items: ['Full service', 'Puncture repair', 'New chain', 'Wheel build', 'Hire bike', 'Kids bike'],
      about: ['The workshop is behind the shop and smells of oil.', 'Bring it in; we will tell you if it is not worth it.'],
      bodies: ['Second-hand bikes are arriving faster than we can service them. Check the board.'] },
    { id: 'photo', icon: '📷', label: 'Photographer', route: '/portfolio', routeLabel: 'Portfolio', layout: 'gallery',
      nouns: ['photography', 'light', 'frame', 'lens', 'shutter'],
      taglines: ['Mostly weather and other people\u2019s dogs.', 'Available for weddings, reluctantly.'],
      items: ['Coastal series', 'Winter fields', 'Portraits', 'The harbour', 'Weddings', 'Print shop'],
      about: ['One camera, one lens and a lot of walking.', 'Prints are made at the shop on the high street.'],
      bodies: ['The harbour series is finished. It took four years and two broken umbrellas.'] },
    { id: 'tattoo', icon: '🖋️', label: 'Tattoo studio', route: '/work', routeLabel: 'Work', layout: 'gallery',
      nouns: ['ink', 'tattoo', 'needle', 'studio', 'mark'],
      taglines: ['Small, careful and mostly black ink.', 'Walk-ins on Fridays, everything else by booking.'],
      items: ['Fine line', 'Botanical', 'Lettering', 'Cover-up', 'Consultation', 'Flash sheet'],
      about: ['Apprenticed here in 2009 and never left.', 'We will say no to a design we cannot do well.'],
      bodies: ['The guest artist is back for two weeks in March. Slots are on the board.'] },
    { id: 'barber', icon: '💈', label: 'Barber', route: '/book', routeLabel: 'Book',
      nouns: ['barber', 'cut', 'trim', 'fade', 'shave'],
      taglines: ['Appointments and walk-ins, in that order.', 'Two chairs, one radio, no queue outside.'],
      items: ['Cut and finish', 'Beard trim', 'Hot towel shave', 'Under 12s', 'Senior cut', 'Wash and style'],
      about: ['The shop has been a barber since 1961.', 'The radio is always on the same station.'],
      bodies: ['We now take card payments. The owner is still suspicious of it.'] },
    { id: 'hardware', icon: '🔩', label: 'Hardware store', route: '/stock', routeLabel: 'Stock',
      nouns: ['hardware', 'tools', 'ironmonger', 'fixings', 'supplies'],
      taglines: ['If we do not have it, it may not exist.', 'Bins, screws and advice you did not ask for.'],
      items: ['Wood screws', 'Door hinges', 'Paint', 'Garden twine', 'Padlock', 'Extension lead'],
      about: ['The aisles are organised by memory.', 'Ask at the counter; the answer is usually a drawer.'],
      bodies: ['Paint mixing is back after the machine was repaired for the third time.'] },
    { id: 'books', icon: '📕', label: 'Second-hand bookshop', route: '/shelf', routeLabel: 'Shelf',
      nouns: ['books', 'bookshop', 'folios', 'pages', 'reading'],
      taglines: ['Somewhere in here is the book you need.', 'Sorted by feeling, mostly.'],
      items: ['Penguin paperbacks', 'Local history', 'Maps', 'Poetry', 'Children\u2019s corner', '£1 shelf'],
      about: ['The shop cat reviews everything by sitting on it.', 'Books bought, sold and sometimes just given away.'],
      bodies: ['A box of 1970s paperbacks arrived this morning and is already half gone.'] },
    { id: 'pottery', icon: '🏺', label: 'Pottery studio', route: '/classes', routeLabel: 'Classes',
      nouns: ['pottery', 'clay', 'kiln', 'wheel', 'glaze'],
      taglines: ['Everything you make will be slightly wonky.', 'Clay, tea and a kiln named Brenda.'],
      items: ['Evening wheel class', 'Hand building', 'Glaze workshop', 'Studio hire', 'Mug making', 'Clay pack'],
      about: ['The studio is in the old dairy behind the pub.', 'Aprons provided; enthusiasm not required.'],
      bodies: ['The kiln is firing on Wednesdays again. Please label your pieces.'] },
    { id: 'florist', icon: '💐', label: 'Florist', route: '/bouquets', routeLabel: 'Bouquets',
      nouns: ['flowers', 'blooms', 'stems', 'petals', 'florist'],
      taglines: ['Whatever is in season and smells of it.', 'Hand-tied, wrapped in paper, no plastic.'],
      items: ['Seasonal bunch', 'Wedding flowers', 'Funeral tributes', 'Plant pot', 'Vase', 'Weekly subscription'],
      about: ['The flowers come from two growers within twenty miles.', 'We compost everything we can.'],
      bodies: ['Tulip season has started earlier than usual this year.'] },
    { id: 'cinema', icon: '🎬', label: 'Cinema', route: '/showtimes', routeLabel: 'Showtimes',
      nouns: ['cinema', 'screen', 'picture', 'reel', 'film'],
      taglines: ['Two screens and real butter on the popcorn.', 'The seats are old but the sound is new.'],
      items: ['Evening screening', 'Matinee', 'Kids club', 'Subtitled showing', 'Private hire', 'Membership'],
      about: ['Screen two used to be the bingo hall.', 'We still show a film every Thursday for a fiver.'],
      bodies: ['The projector in screen one has been replaced. The picture no longer leans.'] },
    { id: 'arcade', icon: '🕹️', label: 'Arcade', route: '/games', routeLabel: 'Games',
      nouns: ['arcade', 'cabinet', 'pixel', 'highscore', 'token'],
      taglines: ['Ten machines, eight working.', 'Tokens at the counter, high scores on the wall.'],
      items: ['Pinball', 'Racing cabinet', 'Fighting game', 'Puzzle cabinet', 'Token bundle', 'Birthday hire'],
      about: ['The cabinets were rescued from a closing seaside pier.', 'The high score table has not been reset since 2014.'],
      bodies: ['The pinball machine is fixed. The tilt is now slightly less punishing.'] },
    { id: 'hosting', icon: '🖧', label: 'Hosting', route: '/plans', routeLabel: 'Plans', layout: 'docs',
      nouns: ['hosting', 'server', 'compute', 'deploy', 'node'],
      taglines: ['Boring hosting that does not page you at three.', 'One region, excellent uptime, no jargon.'],
      items: ['Shared plan', 'Small VPS', 'Managed database', 'Object storage', 'Backups', 'Support retainer'],
      about: ['Four racks in a building that used to be a bank.', 'We publish incidents and the boring details behind them.'],
      bodies: ['The migration is finished. Everything runs on the new machines and slightly faster.'] },
    { id: 'vpn', icon: '🛡️', label: 'VPN service', route: '/pricing', routeLabel: 'Pricing', layout: 'status',
      nouns: ['vpn', 'tunnel', 'privacy', 'shield', 'network'],
      taglines: ['A tunnel, a promise and a legal page.', 'Encrypted, logged as little as legally possible.'],
      items: ['London exit', 'Frankfurt exit', 'New York exit', 'WireGuard config', 'Team plan', 'Audit report'],
      about: ['Run by two engineers and one lawyer.', 'Our audit is public; our logs are not, because there are none.'],
      bodies: ['New exit node opened in Rotterdam. Speed tests are on the status page.'] },
    { id: 'devtools', icon: '🧰', label: 'Developer tools', route: '/docs', routeLabel: 'Docs', layout: 'docs',
      nouns: ['devtools', 'toolkit', 'runtime', 'compiler', 'stack'],
      taglines: ['Small tools that do one thing.', 'Built because the alternative was a spreadsheet.'],
      items: ['Getting started', 'CLI reference', 'API reference', 'Changelog', 'Self-hosting', 'Community'],
      about: ['Started as a script shared in a chat thread.', 'Open source, funded by support contracts.'],
      bodies: ['Version three removes the flag everybody complained about and adds the one they asked for.'] },
    { id: 'insurance', icon: '📄', label: 'Insurance', route: '/quotes', routeLabel: 'Quotes',
      nouns: ['insurance', 'cover', 'assurance', 'indemnity', 'policy'],
      taglines: ['The small print is available on request.', 'Cover for the things that actually happen.'],
      items: ['Home cover', 'Contents', 'Travel', 'Bicycle', 'Public liability', 'Pet cover'],
      about: ['We pay claims, which should not be a distinguishing feature.', 'Our call centre is in the same building as the post room.'],
      bodies: ['Storm claims from last month are being processed in the order they arrived.'] },
    { id: 'energy', icon: '⚡', label: 'Energy supplier', route: '/tariffs', routeLabel: 'Tariffs', layout: 'status',
      nouns: ['energy', 'power', 'electric', 'voltage', 'grid'],
      taglines: ['Electricity, priced honestly.', 'One tariff, one standing charge, no surprise letters.'],
      items: ['Standard tariff', 'Night tariff', 'Heat pump add-on', 'Solar buy-back', 'Business supply', 'Meter reading'],
      about: ['We buy from two wind farms and a lot of the wholesale market.', 'The board is a co-operative, so customers vote.'],
      bodies: ['The price change for April is published a month early, as promised.'] },
    { id: 'water', icon: '💧', label: 'Water utility', route: '/supply', routeLabel: 'Supply', layout: 'status',
      nouns: ['water', 'reservoir', 'supply', 'pipe', 'spring'],
      taglines: ['Water, mostly where it should be.', 'Leak reports answered within a day.'],
      items: ['Supply status', 'Report a leak', 'Meter reading', 'Water quality', 'Direct debit', 'Priority register'],
      about: ['The reservoir was built in 1908 and is still doing the work.', 'We publish every water quality test.'],
      bodies: ['A burst main on the hill affected twelve properties for four hours on Tuesday.'] },
    { id: 'hotel', icon: '🛏️', label: 'Hotel', route: '/rooms', routeLabel: 'Rooms',
      nouns: ['hotel', 'inn', 'rooms', 'lodging', 'rest'],
      taglines: ['Beds above a pub, since forever.', 'Breakfast included, early risers only.'],
      items: ['Double room', 'Twin room', 'Family room', 'Single room', 'Breakfast', 'Late checkout'],
      about: ['The building leans, but the beds do not.', 'The landlord cooks breakfast and takes it personally.'],
      bodies: ['Rooms are being painted through January. The bar stays open.'] },
    { id: 'campsite', icon: '⛺', label: 'Campsite', route: '/pitches', routeLabel: 'Pitches',
      nouns: ['campsite', 'meadow', 'pitch', 'field', 'camp'],
      taglines: ['A field, a tap and a very good view.', 'No clubhouse, no entertainment, no noise after ten.'],
      items: ['Tent pitch', 'Electric hook-up', 'Campervan pitch', 'Shepherd hut', 'Fire pit hire', 'Shower token'],
      about: ['The field floods twice a year and we tell you when booking.', 'The nearest shop is a twenty minute walk.'],
      bodies: ['The bottom field is open again after the wet week. Wellies advised.'] },
    { id: 'taxi', icon: '🚕', label: 'Taxi company', route: '/book', routeLabel: 'Book',
      nouns: ['taxi', 'cab', 'cars', 'rides', 'chauffeur'],
      taglines: ['Two cars, one phone, no app.', 'Airport runs at any hour, if you ask early.'],
      items: ['Town run', 'Station run', 'Airport transfer', 'Six seater', 'Night rate', 'Account booking'],
      about: ['The office is a shed with a kettle and a whiteboard.', 'Card payments taken in the car, reluctantly.'],
      bodies: ['New Year\u2019s Eve bookings are open. Book early; we are two cars.'] },
    { id: 'nursery', icon: '🌿', label: 'Plant nursery', route: '/plants', routeLabel: 'Plants',
      nouns: ['nursery', 'plants', 'greenhouse', 'foliage', 'garden'],
      taglines: ['Plants that survive here, because they grew here.', 'Ask us; we will tell you what dies.'],
      items: ['Herbs', 'Perennials', 'Climbers', 'Fruit trees', 'Compost', 'Terracotta pots'],
      about: ['Most of what we sell is grown in the polytunnels behind you.', 'We do not stock anything we cannot keep alive.'],
      bodies: ['Bare root season has started. The list is by the till.'] },
    { id: 'vet', icon: '🐕', label: 'Vet practice', route: '/appointments', routeLabel: 'Appointments',
      nouns: ['veterinary', 'vet', 'animal', 'clinic', 'paws'],
      taglines: ['For animals, with patience.', 'Out of hours cover with the practice up the road.'],
      items: ['Consultation', 'Vaccination', 'Neutering', 'Dental', 'Microchipping', 'Repeat prescription'],
      about: ['Two vets, three nurses and one very calm cat.', 'We will always discuss cost before treatment.'],
      bodies: ['The Saturday clinic is now appointment-only after last month\u2019s queue.'] },
    { id: 'plumber', icon: '🔧', label: 'Plumber', route: '/services', routeLabel: 'Services',
      nouns: ['plumbing', 'pipes', 'heating', 'boiler', 'drain'],
      taglines: ['Emergencies, boilers and the truth about your radiator.', 'No call-out fee before eight in the evening.'],
      items: ['Emergency call-out', 'Boiler service', 'Bathroom fit', 'Leak repair', 'Radiator flush', 'Outside tap'],
      about: ['One van, one apprentice and thirty years of experience.', 'We photograph everything we do behind a wall.'],
      bodies: ['Frozen pipes are back. Please lag the outside tap this year.'] },
    { id: 'brewery', icon: '🍺', label: 'Brewery', route: '/beers', routeLabel: 'Beers',
      nouns: ['brewery', 'ale', 'malt', 'hops', 'barrel'],
      taglines: ['Small batches, odd names.', 'Brewed in a shed that got out of hand.'],
      items: ['Pale ale', 'Best bitter', 'Porter', 'Table beer', 'Keg hire', 'Brewery tour'],
      about: ['The kit came from a pub that closed in 2011.', 'We brew what we like and hope you agree.'],
      bodies: ['The winter porter is back, slightly stronger than last year by accident.'] },
    { id: 'cafe', icon: '☕', label: 'Cafe', route: '/menu', routeLabel: 'Menu', layout: 'menu',
      nouns: ['cafe', 'coffee', 'kitchen', 'espresso', 'brunch'],
      taglines: ['Coffee, cake and a table by the window.', 'The soup changes daily and so does the mood.'],
      items: ['Flat white', 'Filter coffee', 'Soup of the day', 'Cheese toastie', 'Victoria sponge', 'Full breakfast'],
      about: ['The machine is old, the beans are new.', 'We close when the cake runs out.'],
      bodies: ['The soup is leek and potato again. Nobody has complained yet.'] },
    { id: 'yoga', icon: '🧘', label: 'Yoga studio', route: '/classes', routeLabel: 'Classes',
      nouns: ['yoga', 'breath', 'balance', 'flow', 'mat'],
      taglines: ['Small classes, no mirrors.', 'Come as you are, bring a mat if you have one.'],
      items: ['Morning flow', 'Beginners', 'Pregnancy class', 'Restorative', 'One to one', 'Block of ten'],
      about: ['The room was a grain store and still smells faintly of it.', 'We lend mats and blankets.'],
      bodies: ['The Thursday class moves upstairs while the floor is sanded.'] },
    { id: 'classifieds', icon: '📌', label: 'Classifieds', route: '/ads', routeLabel: 'Ads', layout: 'classifieds',
      nouns: ['classifieds', 'noticeboard', 'listings', 'for-sale', 'swap'],
      taglines: ['Buy, sell, borrow, complain.', 'The noticeboard from the post office, online.'],
      items: ['Chest freezer', 'Bike, small', 'Lawn mower', 'Dining chairs', 'Firewood', 'Piano, needs tuning'],
      about: ['Free to list, no account needed, no algorithm.', 'Ads expire after six weeks whether they sold or not.'],
      bodies: ['Someone is still looking for a tall bookcase. Third week running.'] },
    { id: 'fan', icon: '🎸', label: 'Fan site', route: '/posts', routeLabel: 'Posts',
      nouns: ['fans', 'archive', 'discography', 'bootleg', 'fanzine'],
      taglines: ['Unofficial, obsessive and accurate.', 'Maintained by three people on two continents.'],
      items: ['Early recordings', 'Gig list 1994', 'Photo archive', 'Zine scans', 'Trading list', 'Contact'],
      about: ['We are not affiliated with anybody, which is the point.', 'Everything here is scanned from our own shelves.'],
      bodies: ['Scans of the 1996 tour programme are up. Better quality is coming.'] },
    { id: 'archive', icon: '🗃️', label: 'Local archive', route: '/catalogue', routeLabel: 'Catalogue', layout: 'gallery',
      nouns: ['archive', 'records', 'heritage', 'history', 'collection'],
      taglines: ['Photographs, maps and minutes nobody read.', 'Two rooms, eleven thousand documents and one scanner.'],
      items: ['Tithe map 1841', 'Harbour photographs', 'Council minutes', 'Oral histories', 'School registers', 'Estate plans'],
      about: ['We are volunteers and we answer letters slowly.', 'You can book the reading room on Tuesdays.'],
      bodies: ['A box of glass negatives was donated last month. The scans are astonishing.'] }
  ];
  CATS.push(...MORE_CATS);

  /* The dark end of the internet: government, agencies, leaks, conspiracy boards, dumps and the things people
     keep in the cupboard. These carry the juicy pages: documents, released memos, withheld annexes and secrets. */
  const DARK_CATS = [
    { id: 'gov-dept', icon: '🏛️', label: 'Government department', route: '/notices', routeLabel: 'Notices', layout: 'gov',
      nouns: ['ministry', 'department', 'office', 'authority', 'secretariat'],
      taglines: ['Working for the public, in triplicate.', 'Decisions, consultations and the things we cannot discuss.'],
      items: ['Consultation on the ring road', 'Procurement notice 4421', 'Staff guidance', 'Annual report', 'FOI disclosure log', 'Contact the minister'],
      about: ['The building has been a ministry since it was a hotel.', 'Everything we publish is on this site, eventually.'],
      bodies: ['A decision on the harbour scheme has been deferred for the fourth time, for reasons we are not able to publish.'] },
    { id: 'gov-secret', icon: '🗝️', label: 'Special projects agency', route: '/projects', routeLabel: 'Projects', layout: 'gov',
      nouns: ['agency', 'directorate', 'programme', 'bureau', 'initiative'],
      taglines: ['Delivering outcomes that cannot be described.', 'A small agency with a large budget and no press office.'],
      items: ['Programme summary', 'Estates review', 'Supplier framework', 'Assurance report', 'Redaction policy', 'Records request'],
      about: ['Our remit is published. Our work is not.', 'The agency answers to a committee that meets in private.'],
      bodies: ['The remainder of this page has been withheld under an exemption we are not required to name.'] },
    { id: 'revenue', icon: '🧾', label: 'Tax office', route: '/services', routeLabel: 'Services', layout: 'gov',
      nouns: ['revenue', 'taxation', 'excise', 'treasury', 'revenue-office'],
      taglines: ['Your money, accounted for.', 'Forms, deadlines and a helpline that closes at four.'],
      items: ['File a return', 'Payment plan', 'Check your code', 'Penalty appeal', 'Self-employed help', 'Contact an inspector'],
      about: ['We process eleven million returns a year and lose two.', 'The building is named after a man nobody can identify.'],
      bodies: ['The deadline has moved. Again. The new date is on the form, in the small print.'] },
    { id: 'border', icon: '🛂', label: 'Border agency', route: '/travel', routeLabel: 'Travellers', layout: 'gov',
      nouns: ['border', 'frontier', 'customs', 'immigration', 'checkpoint'],
      taglines: ['Crossing the line, correctly.', 'Queues, forms and occasional dogs.'],
      items: ['Entry requirements', 'Declare goods', 'Travel with pets', 'Refused entry guidance', 'Seized items', 'Complaints'],
      about: ['Our officers work at four ports and one very small airfield.', 'Every rule is published; the guidance is not always understandable.'],
      bodies: ['Additional checks are in place at the eastern port until further notice.'] },
    { id: 'prison', icon: '🔒', label: 'Prison service', route: '/visits', routeLabel: 'Visits', layout: 'gov',
      nouns: ['prison', 'corrections', 'custody', 'wing', 'institution'],
      taglines: ['Rehabilitation, in a building that predates the idea.', 'Visits by booking only.'],
      items: ['Book a visit', 'Send money', 'Property rules', 'Complaints', 'Education courses', 'Release guidance'],
      about: ['The site was built in 1841 and is listed, which explains the windows.', 'Education staff work across two wings.'],
      bodies: ['Visits on the north wing are suspended while the heating is repaired.'] },
    { id: 'defence', icon: '🛰️', label: 'Defence contractor', route: '/contracts', routeLabel: 'Contracts', layout: 'leaks',
      nouns: ['systems', 'defence', 'dynamics', 'aerospace', 'ordnance'],
      taglines: ['Capability, delivered quietly.', 'We do not discuss our customers.'],
      items: ['Integration support', 'Field maintenance', 'Training package', 'Secure comms', 'Logistics', 'Open positions'],
      about: ['Two sites, one of which does not appear on maps.', 'Our audit is annual; the auditors are not named.'],
      bodies: ['The delivery schedule has slipped by eight months and the customer has been informed.'] },
    { id: 'leaks', icon: '📤', label: 'Whistleblower archive', route: '/releases', routeLabel: 'Releases', layout: 'leaks',
      nouns: ['leaks', 'drops', 'archive', 'documents', 'record'],
      taglines: ['The documents they would rather you had not read.', 'Redacted by them, sorted by us.'],
      items: ['Latest drop', 'All documents', 'Submit something', 'Verification notes', 'Mirrors', 'How to stay anonymous'],
      about: ['Run by four people and a very careful lawyer.', 'We publish the document and the redactions in the same file.'],
      bodies: ['The newest drop includes a procurement waiver and a memo about the procurement waiver.'] },
    { id: 'truth', icon: '👁️', label: 'Truth network', route: '/truth', routeLabel: 'The truth', layout: 'conspiracy',
      nouns: ['truth', 'reveal', 'awake', 'insight', 'signal'],
      taglines: ['Everything they told you was a cover story.', 'Do your own research. We already did.'],
      items: ['The archive', 'Documents', 'Video evidence', 'Who benefits', 'Mirror sites', 'Contact us securely'],
      about: ['Started as a newsletter and now has eleven contributors.', 'We are not affiliated with anybody, which is the point.'],
      bodies: ['The footage everyone keeps deleting is mirrored at thirty addresses. Here is number nine.'] },
    { id: 'ufo', icon: '🛸', label: 'UFO sightings', route: '/sightings', routeLabel: 'Sightings', layout: 'conspiracy',
      nouns: ['ufo', 'skywatch', 'orbs', 'contact', 'witnesses'],
      taglines: ['Nine thousand sightings and one grainy photograph.', 'Reports from the sky, unverified and vivid.'],
      items: ['Latest reports', 'The 1997 wave', 'Video archive', 'Witness map', 'Debunked reports', 'Submit a sighting'],
      about: ['The database has been online since one very strange evening.', 'Every report is kept, including the lanterns.'],
      bodies: ['A report from the caravan park describes three lights moving against the wind. Again.'] },
    { id: 'flat', icon: '🜃', label: 'Flat Earth society', route: '/evidence', routeLabel: 'Evidence', layout: 'conspiracy',
      nouns: ['disc', 'plane', 'horizon', 'azimuth', 'foundation'],
      taglines: ['The horizon is level. Ask anyone.', 'Water finds its level. So should you.'],
      items: ['The model', 'Photos of the ice wall', 'Experiments you can repeat', 'Debate rules', 'Membership', 'Merchandise'],
      about: ['We are not a single group. That is part of the problem.', 'Meetings are held in a hall with a surprisingly flat floor.'],
      bodies: ['A member has measured the same lake from both ends and reached the same conclusion as last year.'] },
    { id: 'chemtrails', icon: '☁️', label: 'Skywatch group', route: '/reports', routeLabel: 'Reports', layout: 'conspiracy',
      nouns: ['skywatch', 'trails', 'airwatch', 'ceiling', 'plume'],
      taglines: ['Look up. Then look again.', 'Reporting what falls out of the sky.'],
      items: ['Trail reports', 'Sample results', 'Weather modification', 'Photo log', 'Local groups', 'Join a sweep'],
      about: ['Founded after a very persistent cross in the sky over the bypass.', 'We take samples in jam jars and label them carefully.'],
      bodies: ['A sweep on Saturday found nothing unusual, which members describe as suspicious.'] },
    { id: 'reptilian', icon: '🦎', label: 'Reptilian research', route: '/archive', routeLabel: 'Archive', layout: 'conspiracy',
      nouns: ['reptile', 'scale', 'overlord', 'lizard', 'bloodline'],
      taglines: ['They walk among us. Badly.', 'The cold-blooded case, in full.'],
      items: ['The evidence', 'Photographs', 'Bloodline chart', 'Witness accounts', 'Counter-arguments', 'Reading list'],
      about: ['The archive is maintained by a retired postal worker.', 'No reptile has ever responded to a request for comment.'],
      bodies: ['A new photograph shows a councillor with an unusual blink. The archive has opinions.'] },
    { id: 'moonhoax', icon: '🌕', label: 'Moon landing archive', route: '/evidence', routeLabel: 'Evidence', layout: 'conspiracy',
      nouns: ['moon', 'lunar', 'apollo', 'studio', 'hoax'],
      taglines: ['Nobody has been back. Think about it.', 'The shadows do not lie. Neither do we.'],
      items: ['Shadow analysis', 'The missing tapes', 'Studio theory', 'Van Allen belt', 'Photograph index', 'Debate'],
      about: ['We accept that rockets exist. We question the rest.', 'The founder has a telescope and strong opinions.'],
      bodies: ['A new shadow analysis has been published. It is the same shadow analysis as last year.'] },
    { id: 'mindcontrol', icon: '🧠', label: 'Mind control archive', route: '/programmes', routeLabel: 'Programmes', layout: 'conspiracy',
      nouns: ['control', 'programme', 'conditioning', 'signal', 'archive'],
      taglines: ['The files were destroyed. We have copies.', 'Experiments, subjects and the paperwork that survived.'],
      items: ['Programme index', 'Declassified pages', 'Subject interviews', 'Funding trails', 'Timeline', 'Search the archive'],
      about: ['Assembled from freedom of information replies and one very large box.', 'Half of it is proven and the other half is a rumour with footnotes.'],
      bodies: ['A page from 1974 has been released with the interesting paragraph removed.'] },
    { id: 'society', icon: '🔺', label: 'Secret society watch', route: '/members', routeLabel: 'Members', layout: 'conspiracy',
      nouns: ['order', 'society', 'lodge', 'covenant', 'circle'],
      taglines: ['Watch who attends the dinner.', 'Names, dates and the seating plan.'],
      items: ['Attendance log', 'The dinner list', 'Symbol guide', 'Guest speakers', 'Photographs', 'Submit a tip'],
      about: ['We read the local paper so you do not have to.', 'Everything here comes from a public event, which is the joke.'],
      bodies: ['The annual dinner was held again and the seating plan has been published for the eleventh year.'] },
    { id: 'cult', icon: '🕯️', label: 'Fellowship', route: '/teachings', routeLabel: 'Teachings', layout: 'conspiracy',
      nouns: ['fellowship', 'dawn', 'temple', 'light', 'assembly'],
      taglines: ['The ninth dawn is coming. Bring a chair.', 'A small congregation with a large lease.'],
      items: ['Teachings', 'Meetings', 'Donations', 'The founder', 'Rules of conduct', 'Leaving'],
      about: ['Founded in a bungalow and incorporated as a charity.', 'The teachings are free; the retreat is not.'],
      bodies: ['The founder has clarified the date of the ninth dawn. The previous date stands as an error.'] },
    { id: 'anti5g', icon: '📡', label: 'Signal resistance', route: '/masts', routeLabel: 'Masts', layout: 'conspiracy',
      nouns: ['signal', 'mast', 'radiation', 'resistance', 'shield'],
      taglines: ['Turn it off. Then turn it off again.', 'A map of every mast we know about.'],
      items: ['Mast map', 'Shielding guide', 'Measurement kit', 'Council letters', 'Meetings', 'Report a mast'],
      about: ['We are not against technology. We are against that technology.', 'The map is updated by volunteers with a clipboard.'],
      bodies: ['A new mast has been approved next to the school. The group has printed four hundred letters.'] },
    { id: 'freeenergy', icon: '⚙️', label: 'Free energy lab', route: '/research', routeLabel: 'Research', layout: 'conspiracy',
      nouns: ['energy', 'reactor', 'magnet', 'coil', 'invention'],
      taglines: ['The grid does not want this published.', 'Perpetual motion, in a shed.'],
      items: ['The prototype', 'Build plans', 'Test results', 'Suppressed patents', 'Buy a kit', 'Join the lab'],
      about: ['The prototype has been almost working since 2013.', 'All of our results are reproducible, according to us.'],
      bodies: ['The prototype produced twelve watts for forty seconds. The lab has described this as a breakthrough.'] },
    { id: 'hackerforum', icon: '🏴', label: 'Hackers forum', route: '/threads', routeLabel: 'Threads', layout: 'forum',
      nouns: ['null', 'sector', 'dumps', 'ops', 'shells'],
      taglines: ['No snitches. No script kiddies. Mostly both.', 'A forum that predates the word forum.'],
      items: [], about: ['What happens here is simulated and invented; the bickering feels real.', 'Registration is closed. It has been closed since 2011.'],
      bodies: ['A user is asking whether a 1998 exploit still works. Three people have replied without answering.'] },
    { id: 'paste', icon: '📋', label: 'Paste site', route: '/recent', routeLabel: 'Recent', layout: 'files',
      nouns: ['paste', 'dump', 'bin', 'raw', 'text'],
      taglines: ['Paste it and forget it.', 'Plain text, no accounts, no guarantees.'],
      items: ['Recent pastes', 'API', 'Tor mirror', 'Delete a paste', 'Rules', 'Contact'],
      about: ['The site is two files and a cron job.', 'We do not read the pastes. We also do not promise that.'] },
    { id: 'blackmarket', icon: '🏷️', label: 'Grey market', route: '/listings', routeLabel: 'Listings', layout: 'auction',
      nouns: ['market', 'bazaar', 'trade', 'exchange', 'vendor'],
      taglines: ['Legitimate goods, questionable receipts.', 'Escrow available for a small fee.'],
      items: ['Refurbished laptop', 'Pallet of phones', 'Bulk sim cards', 'Unlocked router', 'Jewellery lot', 'Vintage watch'],
      about: ['Founded by two people who met at a car boot sale.', 'Every listing is invented: nothing here can be bought.', 'Delivery is not included, ever.'],
      bodies: ['A seller has been banned for sending a box of bricks. The listing is still up.'] },
    { id: 'gossip', icon: '🫖', label: 'Gossip blog', route: '/posts', routeLabel: 'Posts',
      nouns: ['tea', 'whisper', 'street', 'buzz', 'gossip'],
      taglines: ['Everyone is talking. We are listening.', 'Kind about nobody.'],
      items: ['The wedding nobody was invited to', 'A very public argument', 'The new owner', 'Who moved in', 'The car', 'Recap'],
      about: ['Two friends, one blog and a strong legal disclaimer.', 'We do not name anyone who has not named themselves. Usually.'],
      bodies: ['The rumour about the bakery is both true and much duller than the version going around.'] },
    { id: 'tabloid', icon: '🗞️', label: 'Tabloid', route: '/latest', routeLabel: 'Latest',
      nouns: ['siren', 'exclusive', 'shock', 'daily', 'banner'],
      taglines: ['You will not believe what we found in a bin.', 'The news, but faster and wronger.'],
      items: [], about: ['Our standards are published on page eleven.', 'Corrections are printed at the bottom, in grey.'],
      bodies: ['An exclusive about a local monument turns out to be a photograph of a different monument.'] },
    { id: 'scandal', icon: '🔎', label: 'Scandal blog', route: '/stories', routeLabel: 'Stories',
      nouns: ['file', 'affair', 'story', 'digest', 'record'],
      taglines: ['Following the money, slowly.', 'Every story starts with a receipt.'],
      items: [], about: ['Run by one person with a scanner and a grudge against paperwork.', 'We publish documents, not conclusions.'],
      bodies: ['A series of invoices shows the same consultant billed twice for the same afternoon.'] },
    { id: 'auction', icon: '🔨', label: 'Auction house', route: '/lots', routeLabel: 'Lots', layout: 'auction',
      nouns: ['auction', 'saleroom', 'hammer', 'house', 'collective'],
      taglines: ['Sold to the person in the third row.', 'Everything has a reserve, including the chairs.'],
      items: ['Oak dresser', 'Cast iron range', 'Oil painting, unsigned', 'Silver teapot', 'Grandfather clock', 'Box of curios'],
      about: ['The saleroom was a grain store and still smells like it.', 'Viewing is Tuesday, and bring a torch.'],
      bodies: ['The unsigned painting sold well above the estimate after two collectors stopped being polite.'] },
    { id: 'flights', icon: '✈️', label: 'Airport', route: '/departures', routeLabel: 'Departures', layout: 'flights',
      nouns: ['air', 'aero', 'airfield', 'terminal', 'aviation'],
      taglines: ['Two runways, one cafe, no delays (allegedly).', 'Your gateway to somewhere within reach.'],
      items: ['Departures', 'Arrivals', 'Parking', 'Lost luggage', 'Special assistance', 'Shop and eat'],
      about: ['The terminal opened in 1962 and has been extended four times.', 'The cafe closes when the last flight leaves.'],
      bodies: ['Fog has suspended arrivals for the second morning running. The cafe is doing well.'] },
    { id: 'ferry', icon: '⛴️', label: 'Ferry operator', route: '/crossings', routeLabel: 'Crossings', layout: 'timetable',
      nouns: ['ferry', 'crossing', 'harbour', 'island', 'passage'],
      taglines: ['Weather permitting, which it rarely does.', 'Two boats and a timetable in pencil.'],
      items: ['Day return', 'Vehicle crossing', 'Freight', 'Island timetable', 'Weather policy', 'Book a crossing'],
      about: ['The older boat is older than the company.', 'If the wind is over forty knots, nobody sails.'],
      bodies: ['The evening crossing is cancelled. The morning crossing was also cancelled. The weather is winning.'] },
    { id: 'isp', icon: '🌐', label: 'Internet provider', route: '/status', routeLabel: 'Status', layout: 'status',
      nouns: ['broadband', 'fibre', 'networks', 'connect', 'line'],
      taglines: ['Speeds up to whatever the cabinet allows.', 'A connection you will describe as fine.'],
      items: ['Network status', 'Speed test', 'Report a fault', 'Upgrade', 'Moving home', 'Billing'],
      about: ['We resell three networks and own one cabinet.', 'Engineers answer the phone. Eventually.'] ,
      bodies: ['An outage in the eastern exchange affected four hundred lines for ninety minutes.'] },
    { id: 'mobile', icon: '📱', label: 'Phone company', route: '/plans', routeLabel: 'Plans', layout: 'status',
      nouns: ['mobile', 'cellular', 'signal', 'talk', 'roam'],
      taglines: ['Coverage where you are, mostly.', 'Data, minutes and a contract in small print.'],
      items: ['Pay monthly', 'Sim only', 'Roaming', 'Network status', 'Lost phone', 'Store locator'],
      about: ['We share a network with two other companies and nobody admits it.', 'Our mast map is a PDF from 2016.'],
      bodies: ['Coverage work in the valley is complete. The valley has coverage. The hill does not.'] },
    { id: 'grid', icon: '⚡', label: 'Grid operator', route: '/demand', routeLabel: 'Demand', layout: 'status',
      nouns: ['grid', 'power', 'network', 'substation', 'supply'],
      taglines: ['Keeping the lights on, one substation at a time.', 'Demand, capacity and the occasional apology.'],
      items: ['Demand today', 'Planned works', 'Connect a generator', 'Incident log', 'Data downloads', 'Contact'],
      about: ['We publish the demand figures every half hour.', 'The control room has a very large clock.'],
      bodies: ['Demand peaked at 18:20 and stayed there. Two substations were switched without incident.'] },
    { id: 'tv', icon: '📺', label: 'TV guide', route: '/tonight', routeLabel: 'Tonight', layout: 'timetable',
      nouns: ['guide', 'channel', 'schedule', 'television', 'listings'],
      taglines: ['Tonight, in one page.', 'Nobody knows what is on channel four.'],
      items: ['Channel one', 'Channel two', 'Channel four', 'Film at nine', 'Ceefax archive', 'Radio times'],
      about: ['Compiled by hand from the newspapers.', 'Listings may change without notice, and do.'],
      bodies: ['The film scheduled for nine has been replaced by a documentary about the film scheduled for nine.'] },
    { id: 'anime', icon: '🌸', label: 'Anime wiki', route: '/wiki', routeLabel: 'Wiki', layout: 'wiki',
      nouns: ['wiki', 'fandom', 'episode', 'character', 'series'],
      taglines: ['Every episode, every character, every argument.', 'Spoilers from the first line.'],
      items: ['Episode list', 'Characters', 'Timeline', 'The films', 'Manga differences', 'Fan translations'],
      about: ['Maintained by ninety people and one very tired admin.', 'Citations are a work in progress since 2009.'],
      bodies: ['A long-running argument about the canonical colour of a jacket has been locked for the eighth time.'] },
    { id: 'modding', icon: '🛠️', label: 'Modding community', route: '/downloads', routeLabel: 'Downloads', layout: 'files',
      nouns: ['mods', 'forge', 'workshop', 'patch', 'kitbash'],
      taglines: ['Unfinished mods, generously shared.', 'Read the readme. Then read it again.'],
      items: ['Total conversion 0.9', 'Texture pack', 'Balance patch', 'Toolkit', 'Voice lines', 'Bug tracker'],
      about: ['Everything is free and everything is provided as is.', 'Two mods have been in development since 2012.'],
      bodies: ['Version 0.9.4 fixes the crash from 0.9.3 and introduces a new one.'] },
    { id: 'esports', icon: '🎮', label: 'Esports team', route: '/matches', routeLabel: 'Matches', layout: 'video',
      nouns: ['esports', 'clan', 'roster', 'arena', 'squad'],
      taglines: ['Fifth place, fourth season.', 'Highlights, drama and a sponsorship deal.'],
      items: ['Last match', 'Roster reveal', 'Highlights', 'Scrim results', 'Merch drop', 'Watch live'],
      about: ['Founded in a bedroom and now in a small office.', 'The coach is also the analyst and the driver.'],
      bodies: ['The roster changed again. The announcement video has 40,000 views and two apologies.'] },
    { id: 'streaming', icon: '🎞️', label: 'Streaming service', route: '/browse', routeLabel: 'Browse', layout: 'video',
      nouns: ['stream', 'screen', 'play', 'binge', 'channel'],
      taglines: ['Something for everyone, apparently.', 'Cancel any time, if you can find the page.'],
      items: ['New this week', 'Leaving soon', 'Documentaries', 'Films', 'Kids', 'Continue watching'],
      about: ['Our catalogue changes monthly for reasons of licensing.', 'The continue watching row has been wrong since launch.'],
      bodies: ['Six titles are leaving at the end of the month, including the one everybody is halfway through.'] },
    { id: 'casino', icon: '🎰', label: 'Casino', route: '/games', routeLabel: 'Games',
      nouns: ['casino', 'spins', 'jackpot', 'lucky', 'palace'],
      taglines: ['Play responsibly. Win occasionally.', 'The house has a very nice carpet.'],
      items: ['Slots', 'Roulette', 'Blackjack', 'Poker room', 'Live dealer', 'Bonuses'],
      about: ['Licensed somewhere warm.', 'Our terms run to forty pages and one of them matters.'],
      bodies: ['The jackpot was won on a Tuesday afternoon by a guest who has asked not to be named.'] },
    { id: 'loans', icon: '💸', label: 'Payday loans', route: '/borrow', routeLabel: 'Borrow',
      nouns: ['loans', 'credit', 'cash', 'advance', 'finance'],
      taglines: ['Money today, paperwork forever.', 'Approval in minutes, consequences in months.'],
      items: ['£100 for 7 days', '£250 for 14 days', '£500 for 30 days', 'Rollover', 'Hardship policy', 'Complaints'],
      about: ['We are transparent about the rate. It is on page nine.', 'Our call centre is trained to be very friendly.'],
      bodies: ['A regulator has asked us to change the wording on one page. We have changed a different page.'] },
    { id: 'dating', icon: '💘', label: 'Dating site', route: '/matches', routeLabel: 'Matches', layout: 'chat',
      nouns: ['heart', 'spark', 'match', 'connect', 'romance'],
      taglines: ['Someone near you is also bored.', 'Two hundred profiles, eleven real people.'],
      items: ['Your matches', 'Who liked you', 'Search', 'Events', 'Success stories', 'Upgrade'],
      about: ['The algorithm is mostly distance and hope.', 'Profiles are moderated by one person on Thursdays.'],
      bodies: ['A success story has been published. Both parties dispute the details.'] }
  ];
  CATS.push(...DARK_CATS);

  /* Modern consumer, tech, science, culture, retail & research verticals — gives the fake internet real breadth */
  const MODERN_CATS = [
    { id: 'ai-lab', icon: '🧠', label: 'AI Research Lab', route: '/models', routeLabel: 'Models', layout: 'docs',
      nouns: ['neural', 'foundry', 'inference', 'weights', 'research', 'cortex'],
      taglines: ['Open weights, reproducible benchmarks, and safety evaluations.', 'Frontier reasoning models trained with transparent telemetry.'],
      items: ['Foundation Model 70B', 'Vision-Language 12B', 'Code Synthesis Engine', 'Evaluation Harness', 'Inference Runtime', 'Safety Benchmarks'],
      about: ['Independent research lab publishing reproducible checkpoints and evaluation suites.', 'All benchmarks run on standardized open hardware profiles.'] },
    { id: 'space', icon: '🚀', label: 'Aerospace & Space', route: '/missions', routeLabel: 'Missions', layout: 'status',
      nouns: ['orbit', 'telemetry', 'aerospace', 'launch', 'satellites', 'propulsion'],
      taglines: ['Orbital launch tracking, deep-space telemetry, and payload engineering.', 'Precision small-sat buses and live mission control feeds.'],
      items: ['LEO SmallSat Bus', 'Optical Ground Link', 'Star Tracker v4', 'Propellant Tank Assembly', 'Launch Manifest Slot', 'Telemetry Relay API'],
      about: ['We build modular orbital hardware and stream real-time pass predictions.', 'Ground stations span four latitudes with automated dish handoff.'] },
    { id: 'music', icon: '🎹', label: 'Music & Synth Label', route: '/releases', routeLabel: 'Releases', layout: 'episodes',
      nouns: ['synth', 'records', 'audio', 'modular', 'sound', 'vinyl'],
      taglines: ['Independent electronic releases, modular patches, and lossless masters.', 'Limited-run pressings, liner notes, and studio sessions.'],
      items: ['Analog Polysynth LP', 'Ambient Tape Series', 'Modular Patch Bank', 'Lossless Mastering Pack', 'Live Session 2xLP', 'Studio Monitor Stand'],
      about: ['Artist-owned label pressing heavyweight records and publishing full session schematics.', 'Every release ships with lossless downloads and patch sheets.'] },
    { id: 'fashion', icon: '🧥', label: 'Independent Fashion', route: '/collection', routeLabel: 'Collection',
      nouns: ['atelier', 'garments', 'tailor', 'apparel', 'loom', 'wardrobe'],
      taglines: ['Architectural silhouettes cut from heavyweight natural fabrics.', 'Small-run seasonal garments built to outlast trends.'],
      items: ['Selvedge Work Jacket', 'Merino Overshirt', 'Pleated Wool Trouser', 'Waxed Canvas Trench', 'Heavyweight Jersey Tee', 'Vegetable-Tanned Belt'],
      about: ['Designed and pattern-cut in small ateliers using traceable mills.', 'Lifetime mending service included with every numbered garment.'] },
    { id: 'automotive', icon: '🚗', label: 'Automotive & EV', route: '/vehicles', routeLabel: 'Vehicles',
      nouns: ['motors', 'electric', 'drivetrain', 'chassis', 'mobility', 'auto'],
      taglines: ['Next-generation electric vehicles, range telemetry, and direct service.', 'Built for all-weather range with modular battery packs.'],
      items: ['Touring EV Sedan', 'All-Terrain Electric SUV', 'Home Wall Charger 22kW', 'Winter Tire Package', 'Over-the-Air Performance Pack', 'Fleet Telematics Plan'],
      about: ['Direct-to-driver electric engineering with transparent repair manuals.', 'Every vehicle supports open NACS/CCS fast charging networks.'] },
    { id: 'architecture', icon: '📐', label: 'Architecture Studio', route: '/projects', routeLabel: 'Projects', layout: 'gallery',
      nouns: ['architecture', 'blueprint', 'spatial', 'urban', 'design', 'structures'],
      taglines: ['Timber-first civic buildings, passive housing, and urban restoration.', 'Drawings, structural studies, and material libraries.'],
      items: ['Cross-Laminated Timber Hall', 'Passive House Study', 'Waterfront Library Redesign', 'Adaptive Reuse Loft', 'Acoustic Pavilion', 'Urban Transit Canopy'],
      about: ['Multidisciplinary practice uniting structural engineers, urbanists, and joiners.', 'We publish open post-occupancy energy audits for every completed project.'] },
    { id: 'science', icon: '🔬', label: 'Science Journal', route: '/papers', routeLabel: 'Papers', layout: 'docs',
      nouns: ['science', 'journal', 'papers', 'preprints', 'laboratory', 'review'],
      taglines: ['Peer-reviewed open science, datasets, and replication studies.', 'Full methods, raw data tables, and transparent reviewer notes.'],
      items: ['Materials Science Review', 'Climate Telemetry Dataset', 'Genomics Methods Paper', 'Ocean Acoustics Study', 'Battery Chemistry Benchmark', 'Replication Archive'],
      about: ['Open-access scientific publishing with mandatory code and dataset availability.', 'Every figure links directly to verifiable raw measurements.'] },
    { id: 'electronics', icon: '🎧', label: 'Electronics & Audio', route: '/gear', routeLabel: 'Gear',
      nouns: ['electronics', 'audio', 'acoustics', 'circuits', 'hardware', 'hifi'],
      taglines: ['Precision reference headphones, DACs, and repairable desktop hardware.', 'Engineered for zero-distortion playback and decade-long serviceability.'],
      items: ['Planar Studio Headphones', 'Balanced Desktop DAC', 'Mechanical 75% Keyboard', 'USB-C Field Recorder', 'Modular Power Supply', 'Reference Desk Monitors'],
      about: ['Hardware designed with standard screws, published schematics, and stocked spare parts.', 'Every unit is individually sweep-tested before dispatch.'] },
    { id: 'outdoors', icon: '🏔️', label: 'Outdoor & Trail Gear', route: '/equipment', routeLabel: 'Equipment',
      nouns: ['alpine', 'trail', 'wilderness', 'expedition', 'summit', 'outfitter'],
      taglines: ['Ultralight shelters, storm shells, and backcountry navigation gear.', 'Field-tested across coastal gales and high-altitude ridges.'],
      items: ['3-Season Ultralight Tent', 'Gore-Tex Storm Shell', '45L Expedition Pack', 'Titanium Camp Stove', 'Merino Base Layer', 'Insulated Sleeping Pad'],
      about: ['Built by mountain guides and tested on multi-week traverses.', 'Free seam-taping and buckle replacement at every regional outpost.'] },
    { id: 'watches', icon: '⌚', label: 'Watchmaker', route: '/timepieces', routeLabel: 'Timepieces',
      nouns: ['horology', 'watches', 'chronograph', 'calibre', 'timepieces', 'dial'],
      taglines: ['Mechanical field watches, regulated in-house to five positions.', 'Sapphire crystal, brushed titanium, and serviceable movements.'],
      items: ['Automatic Field Watch 38mm', 'GMT Diver 200M', 'Mechanical Chronograph', 'Titanium Dress Calibre', 'Woven Nylon Strap', 'Watchmaker Tool Roll'],
      about: ['Independent workshop assembling and regulating numbered batches each quarter.', 'Every movement ships with its individual timing-machine printout.'] },
    { id: 'coffee', icon: '☕', label: 'Coffee Roaster', route: '/roasts', routeLabel: 'Roasts',
      nouns: ['roasters', 'espresso', 'beans', 'origin', 'brewing', 'pour'],
      taglines: ['Single-origin micro-lots roasted to order every Tuesday and Friday.', 'Direct farm partnerships, transparent farm-gate pricing, and brew guides.'],
      items: ['Washed Ethiopian Light Roast', 'Colombian Honey Process', 'House Espresso Blend', 'Swiss Water Decaf', 'Ceramic Pour-Over Dripper', 'Bi-Weekly Roaster Subscription'],
      about: ['Small-batch drum roasting with live roast-curve logs published for every lot.', 'We pay above specialty minimums and publish annual transparency reports.'] },
    { id: 'vinyl', icon: '💿', label: 'Record Store', route: '/crates', routeLabel: 'Crates',
      nouns: ['vinyl', 'records', 'crates', 'turntable', 'wax', 'pressing'],
      taglines: ['New pressings, graded used jazz & soul, and listening stations.', 'Play-graded conservatively and packed in reinforced mailers.'],
      items: ['Japanese Jazz Reissue LP', '70s Soul Compilation 2xLP', 'Ambient Electronics 180g', 'Anti-Static Carbon Brush', 'Direct-Drive Turntable', 'Archival Outer Sleeves'],
      about: ['Independent record shop cataloging thousands of graded pressings online.', 'Every used record is ultrasonically cleaned before grading.'] },
    { id: 'furniture', icon: '🪑', label: 'Modern Furniture', route: '/catalogue', routeLabel: 'Catalogue',
      nouns: ['furniture', 'woodwork', 'interiors', 'living', 'joinery', 'craft'],
      taglines: ['Solid oak tables, modular shelving, and quiet Nordic interiors.', 'Crafted with traditional mortise-and-tenon joinery, built to last generations.'],
      items: ['Solid Oak Dining Table', 'Modular Wall Shelving', 'Bouclé Lounge Chair', 'Walnut Writing Desk', 'Linen Pendant Lamp', 'Acoustic Felt Rug'],
      about: ['Made to order in regional workshops using FSC-certified timber.', 'Natural oil finishes that can be refreshed at home in minutes.'] },
    { id: 'markets', icon: '📈', label: 'Financial Markets', route: '/quotes', routeLabel: 'Quotes', layout: 'status',
      nouns: ['markets', 'equities', 'indices', 'terminal', 'analytics', 'capital'],
      taglines: ['Global indices, bond yields, earnings calendars, and macro research.', 'Clean market data without paywall clutter.'],
      items: ['Global Tech Index', 'Clean Energy ETF', '10Y Treasury Yield', 'Commodity Basket', 'FX Major Pairs', 'Earnings Calendar Pro'],
      about: ['Independent market telemetry and fundamental screening tools.', 'Quarterly filings parsed into structured tables within minutes of release.'] },
    { id: 'opensource', icon: '🧩', label: 'Open-Source Hub', route: '/packages', routeLabel: 'Packages', layout: 'docs',
      nouns: ['packages', 'registry', 'opensource', 'crates', 'modules', 'forge'],
      taglines: ['Signed packages, reproducible builds, and dependency health scores.', 'Fast package registry with SBOM verification on every release.'],
      items: ['Zero-Copy HTTP Router', 'Fast Markdown Parser', 'SQLite Query Builder', 'CLI Argument Toolkit', 'SVG Chart Library', 'Crypto Hash Primitives'],
      about: ['Community-maintained software registry with cryptographic release provenance.', 'Every package lists license, audit status, and zero-dependency metrics.'] },
    { id: 'parks', icon: '🌲', label: 'National Park Service', route: '/trails', routeLabel: 'Trails', layout: 'forecast',
      nouns: ['parks', 'reserve', 'wildlife', 'trails', 'forestry', 'conservation'],
      taglines: ['Trail conditions, backcountry permits, wildlife advisories, and maps.', 'Protecting coastal forests, alpine basins, and dark-sky sanctuaries.'],
      items: ['Backcountry Overnight Permit', 'Coastal Ridge Trail Map', 'Visitor Centre Hours', 'Wildlife Safety Guide', 'Campground Reservations', 'Ranger Guided Walk'],
      about: ['Public conservation portal updated daily by field rangers.', 'Real-time trailhead snowpack, fire-risk, and bridge closure notices.'] },
    { id: 'astronomy', icon: '🔭', label: 'Observatory', route: '/sky', routeLabel: 'Night Sky', layout: 'forecast',
      nouns: ['observatory', 'astronomy', 'cosmos', 'telescope', 'nebula', 'starchart'],
      taglines: ['Tonight’s sky charts, exoplanet catalogs, and live dome status.', 'Dark-sky observing logs and open FITS image archives.'],
      items: ['Tonight’s Planet Visibility', 'Deep-Sky Target List', 'All-Sky Camera Feed', 'Meteor Shower Calendar', 'Public Telescope Night', 'FITS Data Archive'],
      about: ['High-elevation optical observatory sharing public sky data and observing alerts.', 'Free monthly star parties and student remote-observing slots.'] },
    { id: 'boardgames', icon: '🎲', label: 'Tabletop & Board Games', route: '/catalog', routeLabel: 'Catalog',
      nouns: ['tabletop', 'dice', 'guild', 'meeple', 'boardgames', 'hobby'],
      taglines: ['Strategy board games, indie RPG zines, and weekly game nights.', 'Curated reviews, rulebook errata, and local tournament ladders.'],
      items: ['Euro Strategy Box Set', 'Co-op Dungeon Campaign', 'Indie Solo RPG Zine', 'Weighted Metal Dice Set', 'Neoprene Playmat', 'Card Sleeve Bundle'],
      about: ['Community game shop and review database run by lifelong designers.', 'Every listing includes player count, teach time, and shelf weight.'] },
    { id: 'smarthome', icon: '🏠', label: 'Smart Home & IoT', route: '/devices', routeLabel: 'Devices', layout: 'docs',
      nouns: ['smarthome', 'sensors', 'automation', 'matter', 'iot', 'domotics'],
      taglines: ['Local-first Matter sensors, energy monitors, and zero-cloud hubs.', 'Automations that keep running even when the internet is unplugged.'],
      items: ['Local Matter Bridge Hub', 'Thread Air Quality Sensor', 'Smart Energy Clamp Meter', 'E-Ink Wall Dashboard', 'Zigbee Relay Module', 'Open Firmware SDK'],
      about: ['Hardware engineered to run 100% locally with open MQTT and Matter APIs.', 'No mandatory cloud accounts or monthly subscriptions, ever.'] },
    { id: 'robotics', icon: '🤖', label: 'Robotics & Drones', route: '/systems', routeLabel: 'Systems', layout: 'docs',
      nouns: ['robotics', 'autonomous', 'actuators', 'lidar', 'drones', 'mechatronics'],
      taglines: ['Autonomous inspection drones, brushless actuators, and ROS2 stacks.', 'Open-kinematics hardware for field robotics and research labs.'],
      items: ['360° Solid-State LiDAR', 'Quasi-Direct-Drive Actuator', 'Autonomous Mapping Drone', 'Stereo Depth Camera', 'ROS2 Navigation Kit', 'Field Battery Module'],
      about: ['Precision robotics modules with full CAD STEP files and Linux drivers.', 'Tested in maritime, agricultural, and warehouse environments.'] },
    { id: 'cybernews', icon: '🔐', label: 'Security Briefing', route: '/advisories', routeLabel: 'Advisories',
      nouns: ['advisory', 'infosec', 'threat', 'patch', 'bulletin', 'cert'],
      taglines: ['Daily vulnerability advisories, patch analysis, and incident writeups.', 'Signal-first reporting for defenders and systems engineers.'],
      items: ['Weekly Patch Digest', 'CVE Severity Tracker', 'Incident Postmortem Series', 'Hardening Checklists', 'TLS Configuration Guide', 'Supply-Chain Monitor'],
      about: ['Independent security journalism focused on verifiable technical root causes.', 'Published with reproducible timelines and defender-focused mitigations.'] },
    { id: 'culinary', icon: '🍽️', label: 'Culinary Magazine', route: '/recipes', routeLabel: 'Recipes',
      nouns: ['culinary', 'gastronomy', 'bistro', 'flavor', 'testkitchen', 'feast'],
      taglines: ['Tested recipes, technique deep-dives, and regional food journalism.', 'No life-story walls — straight to ingredients, ratios, and craft.'],
      items: ['48-Hour Tonkotsu Broth', 'Fermented Chili Crisp', 'Laminated Croissant Guide', 'Seasonal Market Menus', 'Cast Iron Maintenance', 'Knife Sharpening Basics'],
      about: ['Independent test kitchen publishing triple-tested recipes with gram weights.', 'Reader-supported editorial covering local growers and chefs.'] },
    { id: 'sneakers', icon: '👟', label: 'Footwear & Streetwear', route: '/drops', routeLabel: 'Drops',
      nouns: ['footwear', 'runners', 'kicks', 'sneakers', 'streetwear', 'studio'],
      taglines: ['Technical trail runners, Japanese denim, and limited studio drops.', 'Verified sizing charts, material breakdowns, and direct release calendars.'],
      items: ['Carbon Trail Runner', 'Suede Low-Top Court', 'Ripstop Cargo Pant', 'Waterproof Commuter Boot', 'Merino Running Socks', 'Cedar Shoe Trees'],
      about: ['Independent footwear boutique focused on technical materials and comfort.', 'Detailed centimeter fit guides measured on every pair in-house.'] },
    { id: 'filmdb', icon: '🎞️', label: 'Film & Cinema Archive', route: '/films', routeLabel: 'Films', layout: 'gallery',
      nouns: ['cinema', 'filmdb', 'screenings', 'directors', 'criterion', 'celluloid'],
      taglines: ['Curated cinema database, restoration notes, and repertory showtimes.', 'Critic essays, frame-by-frame analyses, and festival dispatches.'],
      items: ['4K Restoration Releases', 'Director Retrospectives', 'International Festival Slate', 'Cinematography Essays', '35mm Repertory Calendar', 'Soundtrack Reviews'],
      about: ['Archival cinema guide indexing independent films, restorations, and essays.', 'Built by film programmers, archivists, and projectionists.'] }
  ];
  CATS.push(...MODERN_CATS);

  const POST_BODIES = [
    'Residents have been asking the same question for a week and nobody has answered it yet.',
    'The council says the paperwork is in order. The paperwork is not in order.',
    'Two people saw it happen and both have different versions of events.',
    'A meeting has been called, moved twice, and called again.',
    'It has been fixed, according to the email. It has not been fixed.',
    'Nobody expected this to take four visits and a specialist part from the mainland.',
    'The figures were published late on a Friday, which is usually the whole story.',
    'A volunteer has been quietly keeping this going for nine years. This is about them.',
    'Everyone agrees it should be cheaper. Nobody agrees who pays.',
    'The old sign is coming down. Three people have already asked to keep it.',
    'There is a plan, a budget and a folder. Only one of them is real.',
    'It rained for the whole event and everyone stayed anyway.',
    'A small win, buried in a long list of small losses.',
    'The phone number on the poster has not worked since 2019.'
  ];
  TOPICS.push('the missing bus shelter', 'a planning row over a shed', 'the harbour wall survey',
    'a very old tree', 'the school roof', 'a broken clock', 'the annual raft race',
    'a disputed car park', 'the village hall boiler', 'a surprising planning application',
    'the overnight roadworks', 'a lost wedding ring', 'the last shop on the street');

  /* ---------------- the catalogue ---------------- */
  const catalog = [];
  const usedHosts = new Set();

  function makeUser(site, i) {
    const first = pick(FIRST), last = pick(LAST);
    return {
      id: i + 1,
      name: first + ' ' + last,
      email: first + '.' + last + '@' + site.host,
      role: i === 0 ? 'admin' : pick(ROLES).toLowerCase(),
      api_key: (i === 0 ? 'sk_live_' : 'sk_test_') + tok(18)
    };
  }

  const VIRUS_NAMES = ['PopStorm.Adware.Sim', 'FakeShield.Scareware.Sim', 'AlertFlood.Popup.Sim',
    'ClickTrap.Adware.Sim', 'BogusAV.Scareware.Sim', 'LoopWin.Popup.Sim'];
  const VIRUS_SCRIPTS = ['/assets/promo-pop.js', '/assets/verify-shield.js', '/assets/browser-update.js',
    '/assets/antivirus-alert.js', '/assets/win-scan.js'];
  const MAIL_SITES = [
    { host: 'moundshroud-help.example', brand: 'IT Service Desk Portal', catId: 'saas', trapped: true },
    { host: 'moundshroud-pay.example', brand: 'Payroll Verification Portal', catId: 'bank', trapped: true },
    { host: 'account-review.example', brand: 'Account Protection Center', catId: 'scam', trapped: true },
    { host: 'invoice-portal.example', brand: 'Billing & Invoice Portal', catId: 'scam', trapped: true },
    { host: 'status-page.example', brand: 'Operations Digest Status', catId: 'isp', trapped: false },
    { host: 'runbook.moundshroud.lab', brand: 'Moundshroud Ops Runbook', catId: 'docs', trapped: false },
    { host: 'helpdesk.moundshroud.lab', brand: 'Moundshroud Helpdesk', catId: 'saas', trapped: false },
    { host: 'accounts.moundshroud.lab', brand: 'Moundshroud Accounts', catId: 'saas', trapped: false },
    { host: 'status.moundshroud.lab', brand: 'Moundshroud Lab Status', catId: 'isp', trapped: false }
  ];
  const FLAGSHIP_SITES = [
    { host: 'verge-signal.tech', brand: 'Verge Signal', catId: 'cybernews', topic: 'zero-trust networking and silicon benchmarks', trapped: false },
    { host: 'atelier-kuro.shop', brand: 'Atelier Kuro', catId: 'fashion', topic: 'minimalist Japanese outerwear and selvedge denim', trapped: false },
    { host: 'nordic-ledger.bank', brand: 'Nordic Ledger Bank', catId: 'bank', topic: 'Nordic personal and business banking', trapped: false },
    { host: 'cloudforge-ops.dev', brand: 'CloudForge Ops', catId: 'devtools', topic: 'cloud observability and distributed tracing', trapped: false },
    { host: 'pacific-herald.news', brand: 'Pacific Herald', catId: 'news', topic: 'coastal infrastructure, science and world affairs', trapped: false },
    { host: 'midnight-ramen.shop', brand: 'Midnight Ramen Co.', catId: 'food', topic: 'small-batch craft ramen and fermented chili oils', trapped: false },
    { host: 'orbit-telemetry.space', brand: 'Orbit Telemetry', catId: 'space', topic: 'LEO satellite constellations and launch tracking', trapped: false },
    { host: 'velvet-espresso.cafe', brand: 'Velvet Espresso Roasters', catId: 'coffee', topic: 'single-origin specialty coffee roasting', trapped: false },
    { host: 'metro-transit.gov', brand: 'Metro Transit Authority', catId: 'transit', topic: 'high-speed rail and electric bus networks', trapped: false },
    { host: 'cascade-health.org', brand: 'Cascade Health Clinic', catId: 'clinic', topic: 'preventive care and modern diagnostics', trapped: false },
    { host: 'soundwave-fm.live', brand: 'Soundwave 94.7 FM', catId: 'radio', topic: 'independent music and late-night live sessions', trapped: false },
    { host: 'alpine-trails.travel', brand: 'Alpine Trails Expeditions', catId: 'travel', topic: 'guided mountain routes and rail journeys', trapped: false },
    { host: 'pixel-foundry.studio', brand: 'Pixel Foundry', catId: 'architecture', topic: 'timber architecture and modular design', trapped: false },
    { host: 'quantum-papers.edu', brand: 'Quantum Papers Institute', catId: 'science', topic: 'quantum computing and open peer review', trapped: false },
    { host: 'solstice-watches.store', brand: 'Solstice Horology', catId: 'watches', topic: 'precision mechanical field watches', trapped: false },
    { host: 'iron-kettle-gym.fit', brand: 'Iron Kettle Athletics', catId: 'fitness', topic: 'strength training and endurance coaching', trapped: false },
    { host: 'civic-records.gov', brand: 'Civic Open Records', catId: 'gov', topic: 'municipal budgets, permits and public records', trapped: false },
    { host: 'hyperion-motors.auto', brand: 'Hyperion Electric Motors', catId: 'automotive', topic: 'long-range electric vehicles and charging', trapped: false },
    { host: 'synth-archive.music', brand: 'Synth Archive Records', catId: 'music', topic: 'vintage synthesizers and modular pressings', trapped: false },
    { host: 'bistro-lumiere.food', brand: 'Bistro Lumière', catId: 'culinary', topic: 'seasonal fermentation and bistro cooking', trapped: false },
    { host: 'verdant-botanicals.shop', brand: 'Verdant Botanicals', catId: 'nursery', topic: 'rare houseplants and greenhouse cultivation', trapped: false },
    { host: 'apex-esports.gg', brand: 'Apex Esports League', catId: 'esports', topic: 'competitive tournaments and live telemetry', trapped: false },
    { host: 'driftwood-books.org', brand: 'Driftwood Public Library', catId: 'library', topic: 'archival books, digital lending and lectures', trapped: false },
    { host: 'meridian-airlines.aero', brand: 'Meridian Aviation', catId: 'flights', topic: 'regional departures and sustainable aviation', trapped: false },
    { host: 'solaris-grid.energy', brand: 'Solaris Microgrids', catId: 'energy', topic: 'solar microgrids and community battery storage', trapped: false },
    { host: 'kestrel-weather.net', brand: 'Kestrel Meteo Service', catId: 'weather', topic: 'marine radar, tides and 10-day forecasts', trapped: false },
    { host: 'cinder-vinyl.store', brand: 'Cinder Vinyl & Hi-Fi', catId: 'vinyl', topic: 'audiophile vinyl pressings and turntables', trapped: false },
    { host: 'aurora-cinema.live', brand: 'Aurora Repertory Cinema', catId: 'filmdb', topic: '4K film restorations and director retrospectives', trapped: false },
    { host: 'cobalt-markets.io', brand: 'Cobalt Market Terminal', catId: 'markets', topic: 'global equities, yields and macro briefings', trapped: false },
    { host: 'harbor-museum.org', brand: 'Harbor Maritime Museum', catId: 'museum', topic: 'coastal archaeology and ship conservation', trapped: false },
    { host: 'wilderness-gear.shop', brand: 'Wilderness Technical Gear', catId: 'outdoors', topic: 'ultralight alpine shelters and trail equipment', trapped: false },
    { host: 'redwood-university.edu', brand: 'Redwood University', catId: 'university', topic: 'marine biology, robotics and public lectures', trapped: false },
    { host: 'lumen-optics.photo', brand: 'Lumen Optics Studio', catId: 'photo', topic: 'analog medium-format photography and darkroom prints', trapped: false },
    { host: 'neural-foundry.ai', brand: 'Neural Foundry Lab', catId: 'ai-lab', topic: 'open-weight models and evaluation benchmarks', trapped: false },
    { host: 'pinecone-parks.gov', brand: 'Pinecone National Parks', catId: 'parks', topic: 'backcountry trails, wildlife and dark-sky reserves', trapped: false },
    { host: 'orbital-lens.space', brand: 'Orbital Lens Observatory', catId: 'astronomy', topic: 'deep-sky astrophotography and exoplanet transit logs', trapped: false },
    { host: 'tabletop-guild.games', brand: 'Tabletop Guild Hall', catId: 'boardgames', topic: 'strategy board games and indie RPG campaigns', trapped: false },
    { host: 'matter-home.io', brand: 'MatterHome Automation', catId: 'smarthome', topic: 'local-first Matter sensors and home energy dashboards', trapped: false },
    { host: 'kinetics-lab.tech', brand: 'Kinetics Field Robotics', catId: 'robotics', topic: 'autonomous inspection drones and solid-state LiDAR', trapped: false },
    { host: 'crate-forge.dev', brand: 'CrateForge Registry', catId: 'opensource', topic: 'signed open-source packages and reproducible builds', trapped: false },
    { host: 'acoustica-lab.shop', brand: 'Acoustica Reference Audio', catId: 'electronics', topic: 'planar headphones, DACs and repairable studio gear', trapped: false },
    { host: 'timber-form.store', brand: 'Timber & Form Furniture', catId: 'furniture', topic: 'solid oak joinery and minimalist Nordic interiors', trapped: false },
    { host: 'stride-collective.shop', brand: 'Stride Collective', catId: 'sneakers', topic: 'technical trail runners and studio footwear', trapped: false },
    { host: 'lucky-jackpot-spin.online', brand: 'Lucky Jackpot Spin', catId: 'casino', topic: 'instant bonus spins and prize giveaways', trapped: true },
    { host: 'free-mega-airdrop.xyz', brand: 'Mega Airdrop Claim', catId: 'scam', topic: 'urgent token claim and bonus wallet verification', trapped: true }
  ];
  const REWARDS_HOST = 'vault.moundshroud.example';
  const PHISH_HOSTS = new Set(MAIL_SITES.filter(s => s.trapped).map(s => s.host));
  const ipForId = id => id <= 0 ? '10.14.0.1' : ('10.14.' + (Math.floor((id - 1) / 250) + 1) + '.' + (((id - 1) % 250) + 2));
  const makeVirus = (host, id) => ({
    name: VIRUS_NAMES[id % VIRUS_NAMES.length],
    scriptPath: VIRUS_SCRIPTS[id % VIRUS_SCRIPTS.length],
    vector: 'drive-by pop-up script (harmless Cyber Desktop DOM simulation)',
    action: 'spawns self-multiplying fake virus pop-ups on Cyber Desktop until cleaned',
    clean: 'Run MoundShroud anti-malware (or type `virus clean` in moundshell)',
    host
  });

  /* ---- The Open Range: an endless index of invented PCs, breached from moundshell ---------------------------- */
  /* https://range.moundshroud.lab is a website in the Cyber Desktop browser that never runs out of machines. Each
     row is generated from its number, so machine 1 and machine 1000001 exist without anything being stored. Every
     one is an ordinary site on the fake internet (front page, leaked config, staff login, deploy secret), reached
     from moundshell with `breach 10.66.1.2` or `breach pc-0001.range.moundshroud.lab`. Nothing is contacted. */
  const RANGE_HOST = 'range.moundshroud.lab';
  const RANGE_OS = ['Debian 12', 'Ubuntu 22.04 LTS', 'Ubuntu 24.04 LTS', 'Alpine 3.19', 'Rocky Linux 9',
    'Windows Server 2019', 'Windows Server 2022', 'FreeBSD 14', 'openSUSE Leap 15', 'Arch Linux'];
  const RANGE_ROLES = ['developer workstation', 'build server', 'CI runner', 'file server', 'jump host',
    'staging web server', 'mail relay', 'database replica', 'monitoring node', 'backup appliance', 'VPN endpoint',
    'print server', 'lab sandbox', 'accounting PC', 'reception desktop'];
  const RANGE_TIERS = ['easy', 'medium', 'hard', 'extreme'];
  const RANGE_PORTS = ['22/ssh · 80/http', '22/ssh · 80/http · 443/https', '22/ssh · 80/http · 8080/tomcat',
    '22/ssh · 3306/mysql · 80/http', '3389/rdp · 445/smb', '22/ssh · 5432/postgres · 443/https',
    '21/ftp · 22/ssh · 80/http', '22/ssh · 6379/redis · 80/http'];
  const rangeMachine = n => {
    const i = Math.max(1, Math.floor(Number(n) || 1));
    const h = hash32('range-pc-' + i);
    return {
      n: i,
      host: 'pc-' + String(i).padStart(4, '0') + '.' + RANGE_HOST,
      ip: '10.66.' + (Math.floor((i - 1) / 250) + 1) + '.' + (((i - 1) % 250) + 2),
      os: RANGE_OS[(h >>> 9) % RANGE_OS.length],
      role: RANGE_ROLES[(h >>> 13) % RANGE_ROLES.length],
      ports: RANGE_PORTS[(h >>> 17) % RANGE_PORTS.length],
      tier: RANGE_TIERS[(h >>> 5) % RANGE_TIERS.length],
      patch: ['two years behind on patches', 'one emergency patch behind', 'patched last week', 'never patched'][(h >>> 21) % 4],
      flag: 'FLAG{range_pc_' + i + '_' + h.toString(16).padStart(8, '0').slice(0, 6) + '}'
    };
  };
  const rangeMachineByIp = ip => {
    const m = /^10\.66\.(\d{1,3})\.(\d{1,3})$/.exec(String(ip == null ? '' : ip).trim());
    if (!m) return null;
    const a = Number(m[1]), b = Number(m[2]);
    if (a < 1 || b < 2 || b > 251) return null;
    return rangeMachine((a - 1) * 250 + b - 1);
  };
  const rangeMachines = (page, per) => {
    const p = Math.max(1, Math.floor(Number(page) || 1));
    const size = Math.max(1, Math.min(50, Math.floor(Number(per) || 20)));
    return Array.from({ length: size }, (_, k) => rangeMachine((p - 1) * size + k + 1));
  };
  const RANGE = {
    id: 0, rangeIndex: true, portal: false, brand: 'Moundshroud Open Range', host: RANGE_HOST, ip: '10.66.0.1',
    kind: 'Breach range', tagline: 'An endless index of invented PCs to practise breaking into, from moundshell.',
    token: 'range', trapped: false, virus: null, theme: 'saas', accent: '#7dd3fc',
    cat: { id: 'range', icon: '🖥', label: 'Breach range', route: '/machines', routeLabel: 'Machines', layout: 'status' },
    users: [], items: [], posts: [], orders: [], session: { admin: false }, apiKey: '', flag: '',
    createdAt: Date.now()
  };
  /* the machine's own site: an ordinary generated site whose front page is the web console running on that PC */
  const rangeSites = new Map();
  function rangeSiteFor(n) {
    const m = rangeMachine(n);
    const cached = rangeSites.get(m.host);
    if (cached) return cached;
    ensure(BASE);
    /* the machine's own tier pins its security profile, so the range index and the engagement agree */
    const site = make({ host: m.host, brand: 'Workstation ' + String(m.n).padStart(4, '0'), catId: 'devtools', topic: 'practice workstation web console', secTier: m.tier });
    site.brand = 'Workstation ' + String(m.n).padStart(4, '0');
    site.range = m;
    site.ip = m.ip;
    site.flag = m.flag;
    site.kind = 'Range PC';
    site.tagline = m.os + ' · ' + m.role + ' · ' + m.ip;
    site.trapped = false;
    site.virus = null;
    rangeSites.set(m.host, site);
    return site;
  }

  /* ---- infinite topic synthesis & URL-to-category intelligence ---- */
  const REGIONS = ['Northfield', 'Seattle', 'Kyoto', 'Lisbon', 'Bristol', 'Oslo', 'Melbourne', 'Montreal', 'Zurich',
    'Austin', 'Edinburgh', 'Helsinki', 'Denver', 'Portland', 'Dublin', 'Hamburg', 'Lyon', 'Reykjavik', 'Rotterdam',
    'Vancouver', 'Bergen', 'Ghent', 'Osaka', 'Wellington', 'Bologna', 'Gothenburg', 'Prague', 'Halifax'];
  const SUBJECTS = [
    'quantum computing', 'solar microgrids', 'sourdough baking', 'vintage synthesizers', 'urban cycling', 'deep sea robotics',
    'indie game engines', 'zero-trust networking', 'specialty coffee roasting', 'orbital satellites', 'analog photography',
    'electric ferries', 'woodworking joinery', 'acoustic guitars', 'open-source firmware', 'hydroponic farming',
    'maritime logistics', 'alpine mountaineering', 'retro computing', 'modular architecture', 'fermentation science',
    'autonomous drones', 'ceramic pottery', 'cyber threat intelligence', 'high-speed rail', 'botanical illustration',
    'mechanical keyboards', 'biodiversity corridors', 'battery recycling', 'cloud observability', 'vinyl pressing',
    'precision watchmaking', 'coastal archaeology', 'biotech diagnostics', 'craft ramen', 'low-power radio',
    'forest conservation', 'astrophotography', 'minimalist furniture', 'fintech compliance', 'trail running',
    'beekeeping', 'film restoration', 'marine biology', 'streetwear tailoring', 'geothermal heating', 'chess theory',
    'origami engineering', 'home espresso', 'sustainable packaging', 'satellite imagery', 'cryptographic proofs',
    'local transit', 'micro-breweries', 'urban beekeeping', 'embedded Rust', 'historic preservation', 'wind turbines',
    'artisan chocolate', 'scuba wreck diving', 'bookbinding', 'civic budgeting', 'emergency medicine', 'e-sports analytics'
  ];
  const MODIFIERS = ['next-gen', 'regional', 'independent', 'open', 'precision', 'community', 'modern', 'heritage',
    'nordic', 'pacific', 'alpine', 'coastal', 'metro', 'direct', 'express', 'prime', 'verified', 'global', 'local', 'studio'];
  const ANGLES = ['field report', 'annual benchmark', 'buyers guide', 'deep dive', 'public briefing', 'quarterly update',
    'hands-on review', 'architecture notes', 'policy impact', 'market outlook', 'community roundup', 'behind the scenes',
    'maintenance log', 'research digest', 'release notes', 'case study'];
  const HOST_RULES = [
    [/pay|bank|credit|vault|ledger|finance|savings|mortgage|wallet|treasury|capital|payroll/i, 'bank'],
    [/stock|equit|ticker|nasdaq|index|yield|bond|trading|terminal|bloomberg/i, 'markets'],
    [/crypto|coin|btc|eth|token|defi|swap|chain|block|exchange|mint/i, 'crypto'],
    [/loan|borrow|cash|advance|payday/i, 'loans'],
    [/news|herald|gazette|times|daily|post|observer|courier|press|journal|tribune|chronicle|dispatch|beacon/i, 'news'],
    [/dev|api|sdk|code|git|repo|compiler|debug|cli|runbook|docs|manual|reference|framework/i, 'devtools'],
    [/cloud|saas|stack|flow|suite|desk|sync|app|ops|crm|erp|workspace|helpdesk|portal|platform|software/i, 'saas'],
    [/neural|llm|ml|gpt|model|inference|ai-?lab|cortex|transformer/i, 'ai-lab'],
    [/observat|astro|telescope|nebula|cosmos|starchart|planetarium/i, 'astronomy'],
    [/orbit|rocket|space|satellit|launch|aerospace|propulsion|nasa/i, 'space'],
    [/robot|drone|lidar|actuator|mechatron|autonom|kinetic/i, 'robotics'],
    [/smarthome|matter|zigbee|iot|domotic|homekit|sensor/i, 'smarthome'],
    [/crate|pkg|package|registry|npm|pypi|opensource|foss/i, 'opensource'],
    [/watch|horolog|chrono|calibre|timepiece|rolex|seiko/i, 'watches'],
    [/sneaker|footwear|kicks|shoe|runner|boot|streetwear/i, 'sneakers'],
    [/fashion|atelier|garment|tailor|apparel|denim|clothing|wardrobe/i, 'fashion'],
    [/furniture|woodwork|joinery|interior|sofa|table|chair|timber/i, 'furniture'],
    [/vinyl|turntable|recordstore|pressing|crates/i, 'vinyl'],
    [/synth|music|records|modular|beats|label|album|guitar/i, 'music'],
    [/audio|hifi|headphone|dac|speaker|acoustic|keyboard|electron/i, 'electronics'],
    [/coffee|espresso|roast|barista|latte|matcha|beans/i, 'coffee'],
    [/ramen|pizza|burger|sushi|taco|noodle|grill|diner|bistro|cafe|kitchen|food|eats|curry|pho|bbq|deli|restaurant/i, 'food'],
    [/bakery|bread|pastry|cake|donut|croissant|sourdough/i, 'bakery'],
    [/culinar|gastronom|testkitchen|feast/i, 'culinary'],
    [/recipe|cook|bake|chef|flavor|spice/i, 'recipe'],
    [/outdoor|trail|camp|hike|wilderness|summit|mountaineer|backpack|outfitter/i, 'outdoors'],
    [/park|national-?park|wildlife|forestry|reserve|conserv/i, 'parks'],
    [/boardgame|tabletop|dice|rpg|meeple|hobby|chess/i, 'boardgames'],
    [/archit|blueprint|urbanism|building|spatial/i, 'architecture'],
    [/science|paper|preprint|physics|biology|chemistry|quantum|research/i, 'science'],
    [/advis|cve|cert|infosec|patch|bulletin|cybernews|verge|signal/i, 'cybernews'],
    [/cinema|filmdb|movie|film|director|celluloid|repertory/i, 'filmdb'],
    [/motor|ev|electric-?car|vehicle|auto|drivetrain|chassis/i, 'automotive'],
    [/shop|store|mart|market|goods|basket|merch|boutique|supply|depot|gear|craft|wares/i, 'market'],
    [/auction|bid|lot|estate-sale|collectible/i, 'auction'],
    [/pet|dog|cat|vet|paw|hound|kitten|aquarium/i, 'pet'],
    [/mag|magazine|review|quarterly|digest|editorial/i, 'magazine'],
    [/tabloid|gossip|celebrity|rumor|scandal|buzz/i, 'tabloid'],
    [/blog|diary|notes|essay|thoughts|ramblings/i, 'blog'],
    [/host|server|vps|datacenter|rack|baremetal|deploy/i, 'hosting'],
    [/vpn|tunnel|proxy|privacy|shield|encrypt|cipher/i, 'vpn'],
    [/isp|fiber|broadband|telecom|status|uptime|outage|ping/i, 'isp'],
    [/mobile|cellular|sim|5g|wireless|carrier/i, 'mobile'],
    [/grid|power|energy|solar|wind|utility|electric/i, 'grid'],
    [/clinic|health|med|doctor|care|wellness|hospital|pharma|therapy|surgery/i, 'clinic'],
    [/dentist|dental|tooth|ortho|smile/i, 'dentist'],
    [/gov|council|borough|district|city|civic|municipal|authority|parish|ministry|dept|agency/i, 'gov'],
    [/police|sheriff|patrol|crime|safety|constabulary/i, 'police'],
    [/transit|bus|metro|rail|train|tram|subway|commute/i, 'transit'],
    [/flight|air|airport|airline|aviation|jet|depart/i, 'flights'],
    [/ferry|port|harbour|harbor|marina|shipping|vessel/i, 'ferry'],
    [/travel|trip|hotel|tour|voyage|resort|hostel|holiday|vacation/i, 'travel'],
    [/museum|gallery|exhibit|heritage|art|sculpture/i, 'museum'],
    [/uni|university|college|campus|faculty|edu|academic/i, 'university'],
    [/school|academy|learn|course|bootcamp|tutor|class|study/i, 'school'],
    [/library|books|reading|catalog|catalogue/i, 'library'],
    [/law|legal|attorney|solicitor|counsel|court|litigation/i, 'law'],
    [/job|career|hire|hiring|talent|recruit|work|intern/i, 'jobs'],
    [/estate|realty|property|homes|rent|letting|housing|apartments/i, 'estate'],
    [/garage|car|mechanic|tire|tyre|repair|workshop/i, 'garage'],
    [/gym|fitness|workout|yoga|crossfit|pilates|athletic/i, 'fitness'],
    [/sport|fc|club|league|soccer|football|tennis|cricket|rugby|hockey|golf/i, 'sports'],
    [/weather|forecast|storm|rain|climate|meteo|radar/i, 'weather'],
    [/photo|camera|lens|portrait|shoot|studio|optic/i, 'photo'],
    [/tattoo|ink|piercing/i, 'tattoo'],
    [/church|parish|chapel|cathedral|faith/i, 'church'],
    [/theatre|theater|stage|opera|concert|tickets/i, 'theatre'],
    [/charity|donate|foundation|relief|aid|nonprofit|trust/i, 'charity'],
    [/podcast|episode|cast/i, 'podcast'],
    [/radio|fm|am|broadcast|station|waves/i, 'radio'],
    [/stream|video|tube|watch|flix|tv|series/i, 'streaming'],
    [/esport|gaming|game|arcade|clan|guild|tournament|match/i, 'esports'],
    [/mod|modding|patch|addon|plugin|nexus/i, 'modding'],
    [/anime|manga|otaku|cosplay/i, 'anime'],
    [/wiki|pedia|handbook|almanac|compendium|kb/i, 'wiki'],
    [/hack|exploit|sec|cyber|shell|pwn|ctf|zero-?day|threat|malware/i, 'hackerforum'],
    [/forum|board|thread|discuss|community|talk/i, 'forum'],
    [/social|feed|circle|square|connect|chat|friends|micro/i, 'social'],
    [/date|dating|singles|romance/i, 'dating'],
    [/casino|poker|bet|slots|roulette|jackpot|wager/i, 'casino'],
    [/leak|whistle|drop|secret|dossier|classified|redacted/i, 'leaks'],
    [/paste|bin|snippet|dump|raw/i, 'paste'],
    [/archive|records|history/i, 'archive'],
    [/ufo|alien|sighting|saucer/i, 'ufo'],
    [/truth|conspiracy|awake|hidden|shadow/i, 'truth'],
    [/claim|prize|reward|winner|bonus|invoice|verify|account-review|unlock|gift/i, 'scam']
  ];
  const TLD_HINTS = {
    shop: 'market', store: 'market', news: 'news', blog: 'blog', dev: 'devtools', io: 'saas',
    tech: 'saas', app: 'saas', club: 'forum', live: 'streaming', studio: 'photo', org: 'charity',
    gov: 'gov', edu: 'university', tv: 'streaming', fm: 'radio', ai: 'ai-lab', space: 'space',
    music: 'music', auto: 'automotive', fit: 'fitness', gg: 'esports', aero: 'flights',
    energy: 'energy', photo: 'photo', cafe: 'coffee', food: 'food', travel: 'travel',
    bank: 'bank', games: 'boardgames', design: 'architecture', cloud: 'saas'
  };

  function catById(id) { return CATS.find(c => c.id === id) || CATS[0]; }
  function inferCat(text, tld) {
    const clean = String(text || '').toLowerCase();
    for (const [re, id] of HOST_RULES) if (re.test(clean)) return catById(id);
    for (const c of CATS) {
      if (clean.includes(c.id) || clean.includes(c.label.toLowerCase()) ||
        (c.nouns || []).some(n => clean.includes(n))) return c;
    }
    const ext = String(tld || '').replace(/^\./, '').toLowerCase();
    if (ext && TLD_HINTS[ext]) return catById(TLD_HINTS[ext]);
    return null;
  }
  function topicFromHost(host) {
    const parts = String(host || '').toLowerCase().replace(/^www\./, '').split('.');
    const base = parts.length > 2 && /^(?:api|status|docs|runbook|helpdesk|accounts|shop|mail|blog|news|forum)$/.test(parts[0])
      ? parts.slice(0, 2).join(' ')
      : (parts[0] || 'web');
    return base.replace(/[-_]+/g, ' ').replace(/\d+$/g, '').trim().split(/\s+/).filter(Boolean).map(cap).join(' ') || 'Web Portal';
  }
  function slugify(text) {
    return String(text || '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 34);
  }
  function composeTopic(cat, customTopic) {
    if (customTopic && String(customTopic).trim()) return String(customTopic).trim();
    const subj = pick(SUBJECTS);
    const mod = Math.random() < 0.45 ? pick(MODIFIERS) + ' ' : '';
    const reg = Math.random() < 0.3 ? ' in ' + pick(REGIONS) : '';
    return cap(mod + subj + reg);
  }
  function composeHeadline(site, idx) {
    const topic = site.topic || pick(SUBJECTS);
    const subj = idx === 0 ? topic : (Math.random() < 0.55 ? topic + ' ' + pick(ANGLES) : cap(pick(SUBJECTS)));
    const templates = [
      subj + ': ' + pick(['what changed this quarter', 'a closer look at the numbers', 'inside the 2026 rollout',
        'key findings and next steps', 'community response and timeline', 'what experts are watching', 'complete breakdown']),
      'How ' + site.brand + ' is rethinking ' + topic.toLowerCase(),
      pick(REGIONS) + ' ' + pick(['report', 'briefing', 'review', 'spotlight']) + ': ' + cap(subj),
      cap(pick(MODIFIERS)) + ' ' + topic.toLowerCase() + ' — ' + pick(['guide', 'checklist', 'comparison', 'benchmark', 'update']) + ' #' + (idx + 1)
    ];
    return templates[idx % templates.length];
  }
  function composeBody(site, title) {
    const topic = site.topic || site.kind;
    const reg = pick(REGIONS);
    const market = isMarketSite(site);
    const s1 = 'Reporting from ' + reg + ', the ' + site.brand + ' team published a new update on ' + topic.toLowerCase() +
      ' covering ' + title.toLowerCase() + '.';
    const s2 = pick(market ? [
      'Early figures show a ' + int(12, 68) + '% increase in activity over the past six months, with independent reviewers highlighting reliability and transparent pricing.',
      'Contributors submitted over ' + int(40, 820) + ' verified observations, including detailed telemetry, cost breakdowns, and side-by-side comparisons.',
      'Updated documentation and downloadable records are now live in the portal, alongside scheduled maintenance notices for the coming week.',
      'Readers and members have been weighing in across the discussion threads, comparing older methods with the newly released specifications.'
    ] : [
      'Early figures show a ' + int(12, 68) + '% increase in activity over the past six months, with independent reviewers highlighting reliability and open documentation.',
      'Contributors submitted over ' + int(40, 820) + ' verified observations, including detailed telemetry, field benchmarks, and side-by-side comparisons.',
      'Updated documentation and downloadable records are now live in the portal, alongside scheduled maintenance notices for the coming week.',
      'Readers and members have been weighing in across the discussion threads, comparing older methods with the newly released specifications.'
    ]);
    const s3 = pick(market ? [
      'Full appendices, API endpoints, and staff contact details remain available through the main navigation.',
      'A follow-up digest is scheduled for next month once the latest audit cycle concludes.',
      'Sign in to bookmark items, view order history, or join the ongoing conversation.'
    ] : [
      'Full appendices, API endpoints, and staff contact details remain available through the main navigation.',
      'A follow-up digest is scheduled for next month once the latest audit cycle concludes.',
      'Sign in to save bookmarks, follow ongoing updates, or join the community discussion.'
    ]);
    return [s1, s2, s3].join(' ');
  }
  function themeFamilyFor(site) {
    if (site.portal) return 'portal';
    const id = site.cat.id, L = site.cat.layout || '';
    if (id === 'scam' || PHISH_HOSTS.has(site.host)) return 'alert';
    if (['news', 'magazine', 'tabloid', 'gossip', 'scandal', 'blog', 'recipe', 'science', 'cybernews', 'culinary', 'filmdb'].includes(id)) return 'editorial';
    if (['market', 'bakery', 'pet', 'food', 'auction', 'classifieds', 'blackmarket', 'fashion', 'electronics', 'outdoors', 'watches', 'coffee', 'vinyl', 'furniture', 'sneakers', 'boardgames', 'automotive', 'nursery', 'florist', 'books', 'hardware', 'bike', 'farm', 'brewery', 'cafe'].includes(id)) return 'commerce';
    if (['bank', 'crypto', 'loans', 'markets'].includes(id)) return 'finance';
    if (['saas', 'devtools', 'hosting', 'vpn', 'isp', 'mobile', 'grid', 'ai-lab', 'space', 'opensource', 'smarthome', 'robotics', 'energy'].includes(id) || L === 'docs' || L === 'status') return 'saas';
    if (['gov', 'gov-dept', 'revenue', 'border', 'prison', 'police', 'transit', 'museum', 'university', 'clinic', 'dentist', 'vet', 'law', 'charity', 'church', 'library', 'school', 'flights', 'ferry', 'travel', 'estate', 'garage', 'weather', 'theatre', 'cinema', 'sports', 'fitness', 'yoga', 'jobs', 'parks', 'astronomy', 'architecture', 'hotel', 'campsite', 'taxi', 'plumber', 'barber', 'pottery', 'courier', 'insurance'].includes(id)) return 'civic';
    if (['social', 'forum', 'hackerforum', 'chat', 'dating', 'streaming', 'esports', 'podcast', 'radio', 'wiki', 'anime', 'tv', 'photo', 'tattoo', 'music', 'arcade', 'modding', 'fan'].includes(id)) return 'community';
    return 'archive';
  }
  const isMarketSite = site => !!site && !site.portal && (site.theme || themeFamilyFor(site)) === 'commerce';

  /* Categories where scam / pop-up / shady adware traps actually make real-world sense.
     Government agencies, police, utilities, hospitals/clinics, universities, libraries, museums, charities, banks,
     and ordinary local shops are NEVER randomly marked as scam/trapped sites. */
  const SCAM_PLAUSIBLE_CATS = new Set([
    'scam', 'casino', 'loans', 'blackmarket', 'crypto', 'streaming', 'modding', 'paste',
    'classifieds', 'dating', 'tabloid', 'gossip', 'market', 'auction', 'vpn', 'hackerforum',
    'truth', 'freeenergy', 'ufo', 'flat', 'chemtrails', 'reptilian', 'moonhoax', 'anti5g'
  ]);
  const scamPlausiblePool = () => CATS.filter(c => SCAM_PLAUSIBLE_CATS.has(c.id));

  /* ---- Per-site realistic directory architecture, stack & difficulty profile ---- */
  const WEB_STACKS = [
    { id: 'nginx-php', server: 'nginx/1.24.0', powered: 'PHP/8.2.12', dirs: ['/assets', '/includes', '/uploads', '/vendor', '/storage/logs', '/backups', '/old'] },
    { id: 'node-next', server: 'nginx/1.25.3', powered: 'Next.js 15', dirs: ['/_next/static', '/public/assets', '/static/js', '/api/health', '/dist', '/_build'] },
    { id: 'python-django', server: 'gunicorn/22.0', powered: 'Django/5.1', dirs: ['/static/assets', '/media', '/accounts', '/api/v1', '/healthz', '/internal'] },
    { id: 'go-micro', server: 'envoy/1.30', powered: 'Go/1.23', dirs: ['/healthz', '/readyz', '/metrics', '/v1/status', '/v2/docs', '/internal', '/.well-known/security.txt'] },
    { id: 'spring-java', server: 'Apache-Coyote/1.1', powered: 'Spring Boot 3', dirs: ['/actuator/health', '/actuator/info', '/static/v2', '/api/v2', '/swagger-ui', '/internal'] },
    { id: 'wordpress', server: 'Apache/2.4.58', powered: 'WordPress 6.6', dirs: ['/wp-content', '/wp-includes', '/wp-json/wp/v2', '/uploads/2026', '/xmlrpc.php', '/backups'] },
    { id: 'rails-app', server: 'Puma/6.4', powered: 'Ruby on Rails 7', dirs: ['/assets/packs', '/public/uploads', '/rails/info', '/api/v1', '/jobs-ui', '/internal'] },
    { id: 'caddy-static', server: 'Caddy/2.8', powered: 'Rust/Axum', dirs: ['/cdn/assets', '/assets/manifest.json', '/docs/v2', '/staging', '/.well-known/security.txt', '/v2'] }
  ];
  /* Realistic names for the files that leak, by kind. Every site picks its own, so a directory scan never shows the
     same list twice: an env file, a copied config, a dumped SQL seed, an old archive, a developer note. */
  const LEAK_NAMES = {
    env: ['/.env', '/.env.production', '/.env.local', '/config/.env', '/app/.env', '/site/.env.bak'],
    config: ['/config.php.bak', '/wp-config.php.bak', '/application-prod.yml', '/settings.py.bak', '/config.yaml.bak',
      '/config/database.yml.bak', '/web.config.bak', '/app/config/parameters.yml.old'],
    json: ['/config.json', '/assets/runtime.json', '/internal/config.json', '/appsettings.Production.json',
      '/status/diagnostics.json', '/static/env.json'],
    js: ['/static/js/app.config.js', '/dist/env.js', '/assets/build/bundle.js.map', '/js/runtime-config.js',
      '/_next/static/chunks/config.js'],
    sql: ['/backups/db-seed.sql', '/tmp/site-dump.sql', '/old/db-seed.sql', '/storage/dump-2025.sql', '/db/seed_dev.sql'],
    archive: ['/backups/site-2025.bak', '/old/site-backup.zip', '/backups/release-2024.tar.gz', '/tmp/old-site.zip',
      '/uploads/archive/site-2023.zip'],
    notes: ['/admin-notes.txt', '/TODO.txt', '/deploy-notes.txt', '/README.backup', '/ops/notes.txt', '/notes-for-dev.txt']
  };

  /* Folders a scan or a guess runs into, well beyond the handful every site used to share. */
  const FOLDER_POOL = [
    '/beta', '/legacy', '/new', '/portal-2019', '/app', '/api/v2', '/api/internal', '/cache', '/tmp', '/private',
    '/secure', '/sys', '/manage', '/dashboard', '/control', '/ops', '/staff-area', '/members', '/files', '/downloads',
    '/documents', '/webmail', '/intranet', '/hr', '/finance', '/support', '/kb', '/wiki', '/reporting', '/exports',
    '/reports', '/logs', '/test', '/dev', '/qa', '/sandbox', '/preview', '/v1', '/v3', '/graphql', '/rest', '/rpc',
    '/vendors', '/media-library', '/cdn-staging', '/backup-old', '/site-backup', '/tmp-uploads', '/hold', '/unused',
    '/archive-2023', '/shop-old', '/checkout-legacy', '/register', '/users', '/profile', '/tools', '/metrics'
  ];
  /* How hard a site is to break into comes from what kind of site it is. A government department pays a security team
     and hardens its public services; a conspiracy page is one person, a template and a password reused everywhere.
     Each category has one fixed tier here, so the same kind of site is always the same kind of target, and a site
     only ever drifts one step from its category's tier. */
  const TIERS = ['extremely-easy', 'easy', 'medium', 'hard', 'extreme'];
  const CAT_DIFFICULTY = {
    /* --- extreme: public sector, defence, money and the security industry --- */
    gov: 'extreme', 'gov-dept': 'extreme', 'gov-secret': 'extreme', defence: 'extreme', police: 'extreme',
    border: 'extreme', prison: 'extreme', revenue: 'extreme', bank: 'extreme', markets: 'extreme', crypto: 'extreme',
    cybernews: 'extreme', 'ai-lab': 'extreme', space: 'extreme', robotics: 'extreme',
    /* --- hard: regulated, funded or infrastructure-carrying sites --- */
    saas: 'hard', devtools: 'hard', hosting: 'hard', vpn: 'hard', isp: 'hard', mobile: 'hard', grid: 'hard',
    energy: 'hard', water: 'hard', university: 'hard', law: 'hard', insurance: 'hard', transit: 'hard',
    flights: 'hard', ferry: 'hard', news: 'hard', science: 'hard', opensource: 'hard', smarthome: 'hard',
    electronics: 'hard', automotive: 'hard', leaks: 'hard', streaming: 'hard', clinic: 'hard', dentist: 'hard',
    /* --- medium: run by a small team that knows a little --- */
    social: 'medium', school: 'medium', jobs: 'medium', sports: 'medium', radio: 'medium', magazine: 'medium',
    fitness: 'medium', charity: 'medium', estate: 'medium', theatre: 'medium', library: 'medium', forum: 'medium',
    wiki: 'medium', weather: 'medium', courier: 'medium', cinema: 'medium', arcade: 'medium', hotel: 'medium',
    dating: 'medium', esports: 'medium', modding: 'medium', music: 'medium', fashion: 'medium',
    architecture: 'medium', watches: 'medium', furniture: 'medium', parks: 'medium', astronomy: 'medium',
    museum: 'medium', archive: 'medium', auction: 'medium', tv: 'medium', hackerforum: 'medium',
    /* --- easy: a hobby, a shop, a single rented server --- */
    market: 'easy', food: 'easy', travel: 'easy', pet: 'easy', bakery: 'easy', cafe: 'easy', garage: 'easy',
    tattoo: 'easy', barber: 'easy', hardware: 'easy', books: 'easy', pottery: 'easy', florist: 'easy',
    farm: 'easy', bike: 'easy', campsite: 'easy', taxi: 'easy', nursery: 'easy', vet: 'easy', plumber: 'easy',
    brewery: 'easy', yoga: 'easy', blog: 'easy', recipe: 'easy', podcast: 'easy', photo: 'easy',
    church: 'easy', anime: 'easy', coffee: 'easy', vinyl: 'easy', boardgames: 'easy', culinary: 'easy',
    sneakers: 'easy', filmdb: 'easy', outdoors: 'easy',
    /* --- extremely easy: lures, conspiracies and one-page dreams --- */
    scam: 'extremely-easy', casino: 'extremely-easy', loans: 'extremely-easy', classifieds: 'extremely-easy',
    fan: 'extremely-easy', gossip: 'extremely-easy', tabloid: 'extremely-easy', scandal: 'extremely-easy',
    paste: 'extremely-easy', blackmarket: 'extremely-easy', truth: 'extremely-easy', ufo: 'extremely-easy',
    flat: 'extremely-easy', chemtrails: 'extremely-easy', reptilian: 'extremely-easy', moonhoax: 'extremely-easy',
    mindcontrol: 'extremely-easy', society: 'extremely-easy', cult: 'extremely-easy', anti5g: 'extremely-easy',
    freeenergy: 'extremely-easy'
  };

  function buildSecProfile(site) {
    const seed = hash32(site.host + '|sec|' + site.token);
    const rnd = seededRng(seed);
    const rp = arr => arr[Math.floor(rnd() * arr.length)];
    const cid = site.cat.id;
    const t3 = site.token.slice(0, 3);
    const t4 = site.token.slice(0, 4);

    /* The category decides the tier. A site only drifts one step from it (never more), and the drift is seeded per
       host, so the same address is always the same target. A range machine can pin its tier exactly. */
    const forced = TIERS.indexOf(String(site.secTier || ''));
    const baseIndex = Math.max(0, TIERS.indexOf(CAT_DIFFICULTY[cid] || 'medium'));
    let difficulty;
    if (forced >= 0) {
      difficulty = TIERS[forced];
    } else if (site.drill || site.host === 'midnight-ramen.shop') {
      /* a Cyber Mail phishing drill is a lure, not a hardened service: it stays soft whatever it impersonates */
      difficulty = rnd() < 0.45 ? 'extremely-easy' : 'easy';
    } else {
      const r = rnd();
      const index = r < 0.7 ? baseIndex : r < 0.9 ? Math.max(0, baseIndex - 1) : Math.min(TIERS.length - 1, baseIndex + 1);
      difficulty = TIERS[index];
    }

    const stack = rp(WEB_STACKS);
    const easyAdmins = ['/admin', '/wp-admin', '/manage', '/staff-panel', '/dashboard/admin', '/portal/staff', '/cms/admin'];
    const medAdmins = ['/internal/console-' + t3, '/ops-v2/panel', '/app/backoffice-' + t3, '/intranet/manage-' + t3, '/_staff/desk-' + t3, '/console/v1/admin'];
    const hardAdmins = ['/v2/internal/ops-' + t4 + '/console', '/sys/mgmt/' + t4 + '/panel', '/private/portal/v3/gate-' + t3, '/infra/control/' + t4, '/_legacy/2023/backoffice-' + t4];
    const adminPath = difficulty === 'extremely-easy' ? rp(easyAdmins)
      : difficulty === 'easy' ? ('/' + rp(['admin', 'staff', 'backoffice', 'ops', 'manage', 'portal']) + '-' + t3)
      : difficulty === 'medium' ? rp(medAdmins)
      : rp(hardAdmins);

    const loginPath = (difficulty === 'hard' || difficulty === 'extreme') && rnd() < 0.5
      ? rp(['/auth/signin', '/portal/login', '/sso/authenticate', '/id/login'])
      : '/login';

    let vector, cluePath = '', hopPath = '', secretPath = '/.env';
    let envExposed = false, gitExposed = false, sqliLogin = false, sqliSearch = false, openUsersApi = false, openIdor = false, robotsLeaksAdmin = false, defaultCreds = null;

    if (difficulty === 'extremely-easy') {
      vector = rp(['open-misconfig', 'env-root']);
      envExposed = true; gitExposed = true; sqliLogin = true; sqliSearch = true; openUsersApi = true; openIdor = true; robotsLeaksAdmin = true;
      secretPath = vector === 'open-misconfig' ? rp(['/config.json', '/TODO.txt', '/admin-notes.txt']) : '/.env';
      cluePath = '/robots.txt';
      defaultCreds = rp([['admin', 'admin'], ['admin', 'password123'], ['root', 'toor'], ['staff', 'welcome1']]);
    } else if (difficulty === 'easy') {
      vector = rp(['env-root', 'backup-archive']);
      envExposed = true; gitExposed = true; sqliLogin = true; sqliSearch = true; openUsersApi = true; openIdor = true; robotsLeaksAdmin = true;
      secretPath = vector === 'backup-archive' ? rp(['/backups/site-2025.bak', '/old/config.php.bak', '/tmp/db-seed.sql']) : '/.env';
      cluePath = '/robots.txt';
    } else if (difficulty === 'medium') {
      vector = rp(['backup-archive', 'git-leak', 'js-bundle-leak', 'env-variant']);
      envExposed = vector === 'env-variant';
      gitExposed = vector === 'git-leak' || rnd() < 0.45;
      sqliLogin = rnd() < 0.35;
      sqliSearch = rnd() < 0.6;
      openUsersApi = rnd() < 0.5;
      openIdor = true;
      robotsLeaksAdmin = rnd() < 0.4;
      if (vector === 'backup-archive') {
        cluePath = rp(['/backups', '/old', '/storage/logs']);
        secretPath = rp(['/backups/release-' + t3 + '.tar.gz', '/old/config.php.bak', '/storage/logs/deploy.log', '/assets/archive/site-backup.sql']);
      } else if (vector === 'git-leak') {
        cluePath = '/.git/config';
        secretPath = '/.git/logs/HEAD';
      } else if (vector === 'js-bundle-leak') {
        cluePath = '/static/js/app.config.js';
        secretPath = rp(['/static/js/app.config.js', '/dist/env.json', '/assets/build/bundle.js.map']);
      } else {
        cluePath = '/robots.txt';
        secretPath = rp(['/.env.production', '/.env.bak', '/.env.local']);
      }
    } else if (difficulty === 'hard') {
      vector = rp(['debug-actuator', 'api-chain', 'js-bundle-leak']);
      envExposed = false; gitExposed = false; sqliLogin = false; sqliSearch = rnd() < 0.25; openUsersApi = false; openIdor = rnd() < 0.5; robotsLeaksAdmin = false;
      hopPath = rp(['/internal/v3/releases/changelog.txt', '/staging/ops/runbook-' + t3 + '.md', '/ops/v2/deploy-notes.txt']);
      if (vector === 'debug-actuator') {
        cluePath = rp(['/healthz', '/.well-known/security.txt', '/status']);
        secretPath = rp(['/actuator/env', '/_debug/vars.json', '/metrics/runtime.json', '/status/diagnostics.json']);
      } else if (vector === 'api-chain') {
        cluePath = rp(['/swagger/openapi.json', '/v2/docs', '/graphql']);
        secretPath = rp(['/api/v2/internal/audit', '/api/v1/export/staff', '/internal/v2/config.json']);
      } else {
        cluePath = '/assets/manifest.json';
        secretPath = '/assets/build/runtime-' + t3 + '.js.map';
      }
    } else {
      /* extreme: multi-hop hardened site — naive scans & basic SQLi fail; follow 3-hop trail */
      vector = 'multi-hop-hardened';
      envExposed = false; gitExposed = false; sqliLogin = false; sqliSearch = false; openUsersApi = false; openIdor = false; robotsLeaksAdmin = false;
      cluePath = rp(['/.well-known/security.txt', '/assets/manifest.json', '/v2/openapi.yaml']);
      hopPath = rp(['/internal/v3/releases/changelog.txt', '/staging/ops/runbook-' + t3 + '.md', '/ops/v2/deploy-notes.txt']);
      secretPath = rp(['/internal/v3/migrations/004_admin_seed.sql', '/staging/ops/vault-snapshot-' + t3 + '.json', '/var/deploy/bootstrap-' + t3 + '.log']);
    }

    /* ---- where the secrets actually live, and what each file gives away ----
       The old shape was one /.env that always held the admin path, the admin email and the admin password, so every
       site fell to the same first request. Now each site publishes a different set of artefacts, the facts are spread
       across several of them on harder targets, and only the easy ones turn up in a directory scan. */
    const frags = [];
    const addFrag = (kind, facts) => {
      const pool = LEAK_NAMES[kind] || LEAK_NAMES.env;
      let guard = 0, name = rp(pool);
      while (frags.some(f => f.path === name) && guard++ < 10) name = rp(pool);
      if (frags.some(f => f.path === name)) return frags[0];
      const frag = { path: name, kind, facts: facts.slice() };
      frags.push(frag);
      return frag;
    };
    if (difficulty === 'extremely-easy') {
      addFrag(vector === 'open-misconfig' ? rp(['notes', 'json', 'config']) : 'env', ['db', 'jwt', 'adminpath', 'login', 'pass']);
      if (rnd() < 0.55) addFrag('notes', ['adminpath', 'login', 'pass']);
    } else if (difficulty === 'easy') {
      addFrag(vector === 'backup-archive' ? rp(['archive', 'sql', 'config']) : 'env', ['db', 'jwt', 'adminpath', 'login', 'pass']);
      if (vector === 'backup-archive' && rnd() < 0.5) addFrag('env', ['db', 'jwt']);
    } else if (difficulty === 'medium') {
      if (vector === 'env-variant') {
        addFrag('env', ['db', 'jwt', 'login', 'pass']);
        addFrag(rp(['js', 'json']), ['adminpath', 'login']);
      } else if (vector === 'git-leak') {
        addFrag('config', ['db', 'jwt', 'login']);
        addFrag('sql', ['login', 'pass']);
      } else if (vector === 'js-bundle-leak') {
        addFrag('js', ['adminpath', 'login', 'pass']);
        addFrag(rp(['env', 'config']), ['db', 'jwt']);
      } else {
        addFrag(rp(['archive', 'sql']), ['db', 'jwt', 'login']);
        addFrag(rp(['notes', 'js']), ['pass']);
        if (rnd() < 0.5) addFrag('json', ['adminpath']);
      }
    } else if (difficulty === 'hard') {
      addFrag('sql', ['db', 'login']);
      addFrag(rp(['archive', 'config']), ['pass']);
      addFrag('json', ['adminpath', 'jwt']);
    } else {
      addFrag('sql', ['login']);
      addFrag(rp(['archive', 'config']), ['pass']);
      addFrag('js', ['adminpath']);
      addFrag('json', ['db', 'jwt']);
    }
    /* every site stays solvable: each critical fact has to exist somewhere in the chain */
    ['db', 'adminpath', 'login', 'pass'].forEach(fact => {
      if (!frags.some(f => f.facts.includes(fact))) rp(frags).facts.push(fact);
    });
    const pathWith = fact => ((frags.find(f => f.facts.includes(fact)) || frags[0]) || {}).path || '/.env';
    secretPath = pathWith('db');
    const credPath = pathWith('pass');
    const adminPathFrom = pathWith('adminpath');
    envExposed = frags.some(f => /^\/\.env/.test(f.path));

    /* Realistic decoy & stack folders shown by gobuster (varying widely per site) */
    const extraDecoys = ['/assets', '/media', '/uploads', '/static', '/cdn', '/healthz', '/docs', '/v1', '/v2', '/status', '/archive', '/portal', '/internal', '/staging', '/backups', '/old'];
    const slugWord = site.host.split('.')[0].replace(/[^a-z0-9]/g, '').slice(0, 10);
    const brandDirs = slugWord.length > 3
      ? [['/', slugWord].join(''), ['/', slugWord, '-old'].join(''), ['/', slugWord, '-admin'].join('')]
      : [];
    const dirs = [...new Set(stack.dirs.concat(
      [rp(FOLDER_POOL), rp(FOLDER_POOL), rp(FOLDER_POOL)],
      brandDirs.filter(() => rnd() < 0.4),
      [rp(extraDecoys), rp(extraDecoys)]
    ))];
    const hardenedHeaders = difficulty === 'hard' || difficulty === 'extreme';

    return {
      difficulty, stack, vector, adminPath, loginPath, cluePath, hopPath, secretPath,
      envExposed, gitExposed, sqliLogin, sqliSearch, openUsersApi, openIdor,
      robotsLeaksAdmin, defaultCreds, dirs, hardenedHeaders,
      leaks: frags, credPath, adminPathFrom
    };
  }

  function make(spec) {
    let cat = spec && spec.cat ? spec.cat : (spec && spec.catId ? (CATS.find(c => c.id === spec.catId) || null) : null);
    let brand, host, tries = 0;
    let topic = spec && spec.topic ? String(spec.topic).trim() : '';
    if (spec && spec.host) {
      /* typing an address the fake internet has not seen yet infers the category & topic from the URL itself */
      host = spec.host;
      const tldPart = host.includes('.') ? host.slice(host.lastIndexOf('.')) : '';
      if (!cat) cat = inferCat(host, tldPart) || pick(CATS);
      brand = spec.brand || topicFromHost(host);
      if (!topic) topic = brand;
    } else {
      if (!cat) cat = (spec && spec.trapped === true) ? pick(scamPlausiblePool()) : ((topic && inferCat(topic, '')) || pick(CATS));
      if (!topic) topic = composeTopic(cat, '');
      const cleanTopicWords = topic.split(/\s+/).filter(w => w.length > 2 && !/^(?:the|and|for|with|from|in|of|to|on|at)$/i.test(w));
      do {
        const tag = tries++ > 20 ? String(catalog.length + 1 + tries) : '';
        if (spec && spec.topic) {
          const core = cleanTopicWords.slice(0, 2).map(cap).join(' ') || cap(pick(cat.nouns));
          const tail = tries === 1 ? (Math.random() < 0.6 ? ' ' + cap(pick(cat.nouns)) : ' ' + pick(SUF)) : (' ' + pick(SUF));
          brand = (Math.random() < 0.35 && tries > 1 ? cap(pick(PRE)) + ' ' : '') + core + tail + (tag ? ' ' + tag : '');
          const slug = slugify(brand).replace(/-/g, Math.random() < 0.5 ? '-' : '');
          const prefTld = cat.id === 'market' ? '.shop' : cat.id === 'news' ? '.news' : cat.id === 'devtools' ? '.dev' :
            cat.id === 'blog' ? '.blog' : cat.id === 'saas' ? '.io' : pick(TLD);
          host = (slug || 'site' + catalog.length) + (tries > 3 ? pick(TLD) : prefTld);
        } else {
          brand = cap(pick(PRE)) + ' ' + cap(pick(cat.nouns)) + (Math.random() < .38 ? ' ' + pick(SUF) : '') + (tag ? ' ' + tag : '');
          host = brand.toLowerCase().replace(/[^a-z0-9]+/g, '') + pick(TLD);
        }
      } while (usedHosts.has(host));
    }
    usedHosts.add(host);
    const id = catalog.length + 1, token = tok(6), accent = pick(ACCENTS);
    /* Only ~1/8th (~12.5%) of the fake internet are scam/booby-trapped sites, and ONLY in categories where it makes
       sense (plus the explicit Cyber Mail phishing drills — never government, civic, medical, or educational sites). */
    let trapped;
    if (spec && typeof spec.trapped === 'boolean') {
      trapped = spec.trapped;
    } else if (PHISH_HOSTS.has(host) || cat.id === 'scam') {
      trapped = true;
    } else if (SCAM_PLAUSIBLE_CATS.has(cat.id)) {
      const trappedSoFar = catalog.reduce((n, s) => n + (s.trapped ? 1 : 0), 0);
      trapped = trappedSoFar * 8 < id;
    } else {
      trapped = false;
    }
    const baseTag = pick(cat.taglines);
    const tagline = spec && spec.topic
      ? cap(topic) + ' — ' + baseTag.charAt(0).toLowerCase() + baseTag.slice(1)
      : baseTag;
    const site = {
      id, brand, host, ip: ipForId(id), cat, icon: cat.icon, kind: cat.label, topic,
      tagline, accent, token,
      trapped,
      /* a Cyber Mail phishing drill is deliberately a soft target; a generated site that happens to be a scam is
         still judged by its category like every other site */
      drill: !!(spec && spec.trapped === true),
      virus: trapped ? makeVirus(host, id) : null,
      adminPath: '/' + pick(['admin', 'staff', 'backoffice', 'ops', 'manage']) + '-' + tok(3),
      flag: 'FLAG{' + brand.toLowerCase().replace(/[^a-z0-9]+/g, '_') + '_' + token + '}',
      apiKey: 'sk_live_' + tok(24),
      region: pick(REGIONS),
      users: [], items: [], posts: [], orders: [], cart: [], comments: {},
      session: { admin: false },
      createdAt: Date.now() - int(30, 4000) * 86400000
    };
    site.theme = themeFamilyFor(site);
    site.isMarket = site.theme === 'commerce';
    if (spec && spec.secTier) site.secTier = spec.secTier;
    site.sec = buildSecProfile(site);
    site.adminPath = site.sec.adminPath;
    site.difficulty = site.sec.difficulty;
    for (let i = 0; i < 5; i++) site.users.push(makeUser(site, i));
    /* the staff login the breach pages leak (/.env, the backup) really signs you in, so found credentials work */
    site.adminLogin = site.users[0].email;
    site.adminPass = pick(['harbour', 'lantern', 'willow', 'copper', 'meadow', 'granite', 'orchard', 'pepper', 'saffron', 'cinder']) +
      int(100, 999) + '!';
    const itemSeed = (cat.items && cat.items.length) ? cat.items : (site.isMarket
      ? [cap(topic) + ' Starter', cap(topic) + ' Pro', cap(topic) + ' Edition', cap(topic) + ' Kit', cap(topic) + ' Pack', cap(topic) + ' Bundle']
      : [cap(topic) + ' Overview', cap(topic) + ' Reference', cap(topic) + ' Briefing', cap(topic) + ' Index', cap(topic) + ' Guide', cap(topic) + ' Archive']);
    const badges = site.isMarket
      ? ['Featured', 'New', 'Verified', 'Popular', 'Limited', 'Staff Pick']
      : site.theme === 'editorial' ? ['Feature', 'Analysis', 'Special Report', 'Briefing', 'Desk Pick', 'Archive']
      : site.theme === 'civic' ? ['Public Service', 'Official', 'Regional', 'Open Access', 'Updated', 'Registry']
      : site.theme === 'community' ? ['Active', 'Pinned', 'Community', 'Live', 'Featured', 'Curated']
      : site.theme === 'saas' ? ['Stable', 'v4.2', 'API Ready', 'Core Module', 'Verified', 'Telemetry']
      : site.theme === 'finance' ? ['Regulated', 'Live Feed', 'Audited', 'Institutional', 'Verified', 'Index']
      : ['Archived', 'Public File', 'Indexed', 'Verified', 'Dossier', 'Mirrored'];
    const leadTimes = site.isMarket
      ? ['Ships today', 'Instant access', 'Next-day dispatch', 'In stock · ' + site.region, '2-3 business days', 'Same-day slot']
      : site.theme === 'editorial' ? ['Published today', 'Updated 2h ago', 'Desk edition · ' + site.region, 'Verified report', 'Long read', 'Archive copy']
      : site.theme === 'civic' ? ['Public access', 'Open daily · ' + site.region, 'Online portal', 'Updated weekly', 'Regional office', 'Open registry']
      : site.theme === 'community' ? ['Active thread', 'Live channel', 'Community curated', 'Pinned · ' + site.region, 'Open discussion', 'Member showcase']
      : site.theme === 'saas' ? ['99.98% uptime', 'Stable release', 'API ready', 'Docs verified', 'Region: ' + site.region, 'Active module']
      : site.theme === 'finance' ? ['Regulated · ' + site.region, 'Live feed', 'Updated daily', 'Audited ledger', 'Verified rate', 'Institutional']
      : ['Archived record', 'Public file', 'Indexed · ' + site.region, 'Verified copy', 'Open dossier', 'Mirrored'];
    for (let i = 0; i < 12; i++) {
      const baseItem = itemSeed[i % itemSeed.length];
      const useTopic = (spec && spec.topic && i < 4) || (spec && spec.host && i < 3) || i >= itemSeed.length;
      const itemName = useTopic && !baseItem.toLowerCase().includes(topic.toLowerCase().split(' ')[0])
        ? cap(topic.split(/\s+/).slice(0, 2).join(' ')) + ' ' + baseItem + (i >= itemSeed.length ? ' · Part ' + (i - itemSeed.length + 2) : '')
        : cap(pick(ADJ)) + ' ' + baseItem;
      const basePrice = int(8, 349) + (Math.random() < .5 ? .99 : .5);
      const faithfulDesc = site.isMarket
        ? 'Curated by ' + site.brand + ' in ' + site.region + ' for ' + topic.toLowerCase() + '. Includes full specification sheet, quality guarantee, and regional dispatch.'
        : site.theme === 'editorial'
          ? 'Compiled by the ' + site.brand + ' editorial desk in ' + site.region + ' covering ' + topic.toLowerCase() + ', with primary sources and ongoing updates.'
          : site.theme === 'civic'
            ? 'Official ' + cat.label.toLowerCase() + ' information and public access portal maintained by ' + site.brand + ' for ' + site.region + ' residents and visitors.'
            : site.theme === 'community'
              ? 'Community-maintained ' + cat.label.toLowerCase() + ' hub on ' + site.brand + ' featuring member notes, shared resources, and active discussions.'
              : site.theme === 'saas'
                ? 'Technical module and documentation maintained by ' + site.brand + ' for ' + topic.toLowerCase() + ', including API reference and live status telemetry.'
                : site.theme === 'finance'
                  ? 'Institutional overview and verified data maintained by ' + site.brand + ' (' + site.region + '), updated with current benchmarks and disclosures.'
                  : 'Publicly indexed record maintained by ' + site.brand + ' in ' + site.region + ' covering ' + topic.toLowerCase() + ', with checksum verification.';
      site.items.push({
        id: i + 1,
        name: itemName,
        badge: badges[i % badges.length],
        price: site.isMarket ? basePrice.toFixed(2) : null,
        comparePrice: site.isMarket ? (basePrice * 1.18).toFixed(2) : null,
        stock: site.isMarket ? int(3, 65) : null,
        rating: (4.1 + Math.random() * 0.85).toFixed(1),
        reviews: int(14, 620),
        leadTime: leadTimes[i % leadTimes.length],
        specs: site.isMarket ? [
          ['Category', cat.label + ' · ' + cap(topic.split(/\s+/).slice(0, 2).join(' '))],
          ['Dispatch Hub', site.region + ' Warehouse'],
          ['Edition', 'v' + (2 + (i % 4)) + '.' + (i % 9) + ' · ' + new Date().getFullYear()]
        ] : [
          ['Section', cat.label + ' · ' + cap(topic.split(/\s+/).slice(0, 2).join(' '))],
          ['Maintained By', site.brand + ' (' + site.region + ')'],
          ['Revision', 'Rev ' + (2 + (i % 4)) + '.' + (i % 9) + ' · ' + new Date().getFullYear()]
        ],
        desc: faithfulDesc
      });
    }
    for (let i = 0; i < 8; i++) {
      const who = site.users[int(1, site.users.length - 1)];
      const title = composeHeadline(site, i);
      const p1 = composeBody(site, title);
      const p2 = 'Field notes collected across ' + site.region + ' and partner hubs show how ' + topic.toLowerCase() +
        ' standards evolved through ' + new Date().getFullYear() + '. Independent audits verified ' + int(94, 99) + '.' + int(1, 9) +
        '% compliance across ' + int(18, 240) + ' active installations, with full metrics archived for public inspection.';
      const p3 = 'Looking ahead to next quarter, ' + site.brand + ' plans to publish updated ' + cat.label.toLowerCase() +
        ' reference guides, expand direct API access, and host open community Q&A sessions with the ' + cap(who.role) + ' desk.';
      site.posts.push({
        id: i + 1,
        title,
        category: i % 2 === 0 ? cat.label : cap(pick(ANGLES)),
        readMin: int(4, 11),
        body: p1,
        paragraphs: [p1, p2, p3],
        takeaways: [
          'Verified ' + int(14, 72) + '% improvement in ' + topic.toLowerCase() + ' throughput across ' + site.region + '.',
          'Full records, specification tables, and ' + cat.routeLabel.toLowerCase() + ' listings are updated daily.',
          'Open feedback from ' + int(40, 520) + ' readers and practitioners shaped the latest revision.'
        ],
        author: who.name, authorRole: cap(who.role),
        at: Date.now() - int(1, 220) * 3600000,
        views: int(340, 28400),
        comments: int(4, 96),
        upvotes: int(12, 680)
      });
    }
    for (let i = 0; i < 6; i++) {
      const who = site.users[int(1, site.users.length - 1)];
      site.orders.push({
        id: 1000 + int(0, 8999),
        customer: who.name, email: who.email, total: (int(12, 480) + .99).toFixed(2),
        address: int(1, 99) + ' ' + pick(['Mill Lane', 'Church Street', 'Harbour Road', 'Station Approach', 'The Green', 'Market Street', 'Canal Walk']) + ', ' +
          site.region
      });
    }
    catalog.push(site);
    return site;
  }

  /* Rich initial boot (640 sites including Cyber Mail + 45 curated flagship sites), with NO ceiling:
     browsing, searching and Next-page links grow the fake internet infinitely on demand. */
  const BASE = 640;
  let mailSeeded = false;
  const ensure = n => {
    if (!mailSeeded) {
      mailSeeded = true;
      for (const spec of MAIL_SITES) if (!usedHosts.has(spec.host)) make(spec);
      for (const spec of FLAGSHIP_SITES) if (!usedHosts.has(spec.host)) make(spec);
    }
    const want = Math.max(BASE, Math.floor(n) || 0);
    while (catalog.length < want) make();
    /* The Fake Dark Web is a separate section with its own hand-written services, but it joins this catalogue so
       that resolving, searching, browsing and every moundshell command answer for an .onion exactly as they answer
       for the surface web. It is appended once, after the generated sites, so no site number ever shifts. */
    if (!darkSeeded) {
      darkSeeded = true;
      const darks = (A.cyberDark && A.cyberDark.sites) ? A.cyberDark.sites() : [];
      for (const darkSite of darks) {
        if (!darkSite || usedHosts.has(darkSite.host)) continue;
        darkSite.id = catalog.length + 1;
        usedHosts.add(darkSite.host);
        catalog.push(darkSite);
      }
    }
    /* The Surplus Vault, the shop the practice bank's money exists for, is appended last for the same reason the
       dark services are: it is hand-written, and adding it here never shifts a generated site's number or files. */
    if (!vaultSeeded) {
      vaultSeeded = true;
      if (!usedHosts.has(REWARDS_HOST)) make({ host: REWARDS_HOST, brand: 'Surplus Vault', catId: 'market', topic: 'practice rewards, desktop apps and cosmetics', trapped: false });
    }
    return catalog;
  };
  let darkSeeded = false;
  let vaultSeeded = false;
  const all = () => { ensure(BASE); return catalog; };
  const trapped = () => { ensure(BASE); return catalog.filter(s => s.trapped); };
  const site = n => ensure(n)[Math.max(0, (Math.floor(n) || 1) - 1)] || catalog[0];
  const more = (k) => { const want = catalog.length + (Math.max(1, Math.floor(k) || 12)); return ensure(want); };

  function splitUrl(raw) {
    const clean = String(raw == null ? '' : raw).trim().replace(/^[a-z]+:\/\//i, '').split('#')[0];
    const cut = clean.indexOf('/');
    const hostPort = (cut < 0 ? clean : clean.slice(0, cut)).toLowerCase().replace(/^www\./, '');
    const host = hostPort.replace(/:\d+$/, '');
    const path = cut < 0 || !clean.slice(cut) ? '/' : clean.slice(cut);
    return { host, path };
  }

  function byIp(ip) {
    const clean = String(ip == null ? '' : ip).trim();
    if (!clean) return null;
    if (clean === PORTAL.ip) return PORTAL;
    if (clean === RANGE.ip) return RANGE;
    const ranged = rangeMachineByIp(clean);
    if (ranged) return rangeSiteFor(ranged.n);
    ensure(BASE);
    return catalog.find(s => s.ip === clean) || null;
  }

  /* `browser breach web 12`, `browser breach amberbasket.shop`, `browser breach virus 1` and `browser breach web` all land here. */
  function find(key) {
    const orig = String(key == null ? '' : key).trim();
    ensure(BASE);
    if (!orig) return catalog[int(0, catalog.length - 1)];
    const virusMatch = /^(?:virus|trapped|malware)(?:\s+(\d+))?$/i.exec(orig);
    if (virusMatch) {
      const list = catalog.filter(s => s.trapped);
      if (!list.length) return null;
      if (virusMatch[1]) return list[Math.min(list.length, Math.max(1, +virusMatch[1])) - 1];
      return list[int(0, list.length - 1)];
    }
    const raw = orig.toLowerCase().replace(/^web\b/, '').trim();
    if (!raw) return catalog[int(0, catalog.length - 1)];
    const n = /^\d+$/.exec(raw);
    if (n) return catalog[Math.min(catalog.length, Math.max(1, +n[0])) - 1];
    const parts = splitUrl(raw);
    const host = parts.host || raw;
    if (host === SEARCH_HOST || raw === 'portal' || raw === 'search') return PORTAL;
    if (host === RANGE_HOST || raw === 'range' || raw === RANGE_HOST) return RANGE;
    const rangeHit = /^pc-(\d+)\.range\.moundshroud\.lab$/.exec(host);
    if (rangeHit) return rangeSiteFor(Number(rangeHit[1]) || 1);
    if (/^\d{1,3}(?:\.\d{1,3}){3}$/.test(host)) return byIp(host);
    return catalog.find(s => s.host === host) ||
      catalog.find(s => s.host.startsWith(host) || s.brand.toLowerCase() === raw) ||
      catalog.find(s => s.brand.toLowerCase().includes(raw) || s.host.includes(host)) || null;
  }

  /* the browser's address bar, a link in the mail and moundshell all resolve a URL here: exact hosts and IPs */
  function locate(raw) {
    const { host, path } = splitUrl(raw);
    if (!host) return null;
    if (host === SEARCH_HOST) return { site: PORTAL, path: path || '/' };
    if (host === RANGE_HOST) return { site: RANGE, path: path || '/' };
    const rangeHost = /^pc-(\d+)\.range\.moundshroud\.lab$/.exec(host);
    if (rangeHost) return { site: rangeSiteFor(Number(rangeHost[1]) || 1), path: path || '/' };
    if (/^\d{1,3}(?:\.\d{1,3}){3}$/.test(host)) {
      const byAddr = byIp(host);
      return byAddr ? { site: byAddr, path: path || '/' } : null;
    }
    ensure(BASE);
    /* an .onion address the index has never listed is still a page: the Fake Dark Web mints it from its own address,
       so onion space never runs out and every link the Onion Index prints really opens */
    const hit = catalog.find(s => s.host === host) ||
      ((/\.onion$/i.test(host) && A.cyberDark && A.cyberDark.find) ? A.cyberDark.find(host) : null);
    if (hit && catalog.indexOf(hit) < 0) catalog.push(hit);
    return hit ? { site: hit, path: path || '/' } : null;
  }

  /* typing an address the fake internet has not seen yet creates a realistic site matching that URL's domain & topic */
  const HOST = /^(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,12}(?::\d{2,5})?$/i;
  function visit(raw) {
    const hit = locate(raw);
    if (hit) return hit;
    const { host, path } = splitUrl(raw);
    if (!HOST.test(host)) return null;
    const site = make({ host });
    return { site, path: path || '/' };
  }

  /* resolves ANY website reference for moundshell: exact URL, host, simulated IP, web/virus shortcut, brand, or a new domain */
  function resolve(raw, opts) {
    const create = !opts || opts.create !== false;
    const text = String(raw == null ? '' : raw).trim();
    if (!text) return null;
    const direct = locate(text);
    if (direct) return direct;
    const { host, path } = splitUrl(text);
    const found = find(text);
    if (found) return { site: found, path: path || '/' };
    if (create && HOST.test(host)) return visit(text);
    return null;
  }

  function dirScan(site) {
    if (!site) return [];
    /* a hidden service answers for the routes its own backend really has */
    if (site.dark && A.cyberDark && A.cyberDark.scan) {
      const scanned = A.cyberDark.scan(site);
      return A.cyberPcs ? scanned.concat(['/dump', '/dump/users.csv', '/dump/users.json', '/dump/site.sql'].map(p => ({ path: p, status: 200, size: 2600, note: 'leaked user dump' }))) : scanned;
    }
    if (site.rangeIndex) {
      return ['/', '/?p=2', '/pc/1', '/robots.txt'].map(p => ({ path: p, status: 200, size: 2400, note: 'generated range page' }));
    }
    if (site.portal) {
      return ['/', '/?q=bank', '/all', '/mail', '/trapped', '/random', '/robots.txt'].map(p => ({ path: p, status: 200, size: 1420, note: '' }));
    }
    const sec = site.sec || buildSecProfile(site);
    const items = [];
    const seen = new Set();
    const push = (p, status, size, note) => {
      if (!p || seen.has(p)) return;
      seen.add(p);
      items.push({ path: p, status: status || 200, size: size || (420 + (hash32(site.host + p) % 4800)), note: note || '' });
    };
    push('/', 200, 14800);
    push(site.cat.route, 200, 8200);
    push('/about', 200, 5400);
    push('/contact', 200, 3100);
    push('/robots.txt', 200, 140);
    push('/sitemap.xml', 200, 920);
    push(sec.loginPath || '/login', 200, 2600);
    /* Stack-specific folders & realistic status codes (301 / 403 / 200) */
    for (const d of sec.dirs) {
      const isForbidden = /^\/(?:internal|staging|vendor|storage|metrics|sidekiq|backups|old)/.test(d);
      const isRedir = /^\/(?:assets|media|uploads|cdn|static|wp-content|wp-includes|v1|v2|dist)/.test(d);
      push(d, isForbidden ? (sec.difficulty === 'extremely-easy' || sec.difficulty === 'easy' ? 200 : 403) : (isRedir ? 301 : 200));
    }
    if (sec.gitExposed) { push('/.git/HEAD', 200, 24); push('/.git/config', 200, 220); }
    if (sec.openUsersApi) push('/api/users', 200, 740);
    else push('/api/users', 401, 48);
    if (sec.openIdor) push('/api/orders/' + (site.orders && site.orders[0] ? site.orders[0].id : 1001), 200, 210);
    if (sec.cluePath) push(sec.cluePath, 200, 640);
    if (sec.hopPath) push(sec.hopPath, 200, 700);
    /* Only the sloppy sites hand their leaked files to a plain wordlist scan. A medium site gives up one of them;
       hard and extreme sites keep every one of them behind a clue trail, so a scan mostly returns 404s. */
    const leakList = sec.leaks || [];
    const scanSees = sec.difficulty === 'extremely-easy' || sec.difficulty === 'easy'
      ? leakList.map(f => f.path)
      : sec.difficulty === 'medium'
        ? leakList.filter(f => f.path === sec.secretPath).map(f => f.path)
        : [];
    scanSees.forEach(p => push(p, 200, 480, 'exposed config'));
    if (sec.difficulty === 'extremely-easy' || sec.difficulty === 'easy') {
      push(site.adminPath, site.session && site.session.admin ? 200 : 403);
      push(site.adminPath + '/backup.zip', site.session && site.session.admin ? 200 : 403);
    } else if (sec.difficulty === 'medium' && sec.robotsLeaksAdmin) {
      push(site.adminPath, site.session && site.session.admin ? 200 : 403);
    }
    if (site.trapped && site.virus && site.virus.scriptPath) {
      push(site.virus.scriptPath, 200, 340, '⚠ fake-virus trap (' + site.virus.name + ')');
    }
    /* the user dump a maintenance script left behind: readable without a login on every one of these sites */
    if (A.cyberPcs) {
      push('/dump', 200, 640, 'backup script output index');
      push('/dump/users.csv', 200, 2400 + (site.id % 40) * 90, 'user table with IPs and passwords');
      push('/dump/users.json', 200, 4200 + (site.id % 40) * 120, 'the same rows as JSON');
      push('/dump/site.sql', 200, 6800 + (site.id % 40) * 160, 'full database dump');
    }
    return items;
  }

  function routes(site) {
    if (!site) return [];
    return dirScan(site).map(x => x.path);
  }

  /* a random site, for the mail that links to one */
  function random() {
    ensure(BASE);
    return catalog[int(0, catalog.length - 1)];
  }

  /* the Browser's Random button & portal /random: walks infinitely forward, generating fresh sites on demand */
  let cursor = 0;
  function next() {
    ensure(BASE);
    if (cursor >= catalog.length) ensure(catalog.length + 40);
    const site = catalog[cursor];
    cursor++;
    return site;
  }

  /* everything a search may match: name, address, topic, region, kind, tagline, category, items & headlines */
  const haystack = s => (s.brand + ' ' + s.host + ' ' + (s.topic || '') + ' ' + (s.region || '') + ' ' + s.kind + ' ' +
    s.tagline + ' ' + s.cat.label + ' ' + s.cat.id + ' ' + (s.cat.layout || '') + ' ' + (s.cat.nouns || []).join(' ') + ' ' +
    (s.items || []).map(i => i.name).join(' ') + ' ' + (s.posts || []).map(p => p.title).join(' ')).toLowerCase();
  function search(query, want, opts) {
    const q = String(query == null ? '' : query).trim();
    const qLow = q.toLowerCase();
    const catId = opts && opts.catId ? String(opts.catId).trim().toLowerCase() : '';
    const grow = !!(opts && opts.grow);
    const target = Math.max(1, Math.floor(want) || 24);
    ensure(BASE);
    const catObj = catId ? CATS.find(c => c.id === catId || c.label.toLowerCase() === catId) : null;
    const words = qLow ? qLow.split(/\s+/).filter(Boolean) : [];
    const match = s => {
      if (catObj && s.cat.id !== catObj.id) return false;
      if (!words.length) return true;
      const hay = haystack(s);
      return words.every(word => hay.includes(word));
    };
    let hits = catalog.filter(match);
    if (grow && hits.length < target) {
      const need = Math.min(48, target - hits.length);
      const inferredCat = catObj || (q ? inferCat(q, '') : null);
      for (let i = 0; i < need; i++) {
        const chosenCat = inferredCat || (q && i % 3 === 0 ? pick(CATS) : (inferCat(q, '') || pick(CATS)));
        const freshTopic = q ? cap(q) + (i > 0 && Math.random() < 0.45 ? ' ' + pick(ANGLES) : '') : composeTopic(chosenCat, '');
        const created = make({ cat: chosenCat, topic: freshTopic });
        hits.push(created);
      }
    }
    return hits;
  }

  /* ---------------- the fake backend answers requests ---------------- */
  const money = v => '$' + v;
  const ago = at => new Date(at).toLocaleDateString([], { month: 'short', day: 'numeric' });

  const BRIDGE_SCRIPT =
    '<script>(function(){' +
    'function isLink(h){if(!h)return false;var c=h.charAt(0);if(c==="/"||c==="?")return true;' +
    'var lo=h.toLowerCase();return lo.indexOf("http://")===0||lo.indexOf("https://")===0;}' +
    'function sendForm(f){var q=new URLSearchParams(new FormData(f)).toString();' +
    'var act=f.getAttribute("action")||"/";var m=(f.getAttribute("method")||"GET").toUpperCase();' +
    'var u=act+(q?(act.indexOf("?")>=0?"&":"?")+q:"");' +
    'parent.postMessage({cdweb:u,cdwebMethod:m},"*");}' +
    'document.addEventListener("click",function(e){' +
    'var a=e.target.closest&&e.target.closest("a[href]");' +
    'if(a){var h=a.getAttribute("href")||"";if(!isLink(h))return;e.preventDefault();e.stopPropagation();' +
    'parent.postMessage({cdweb:h.charAt(0)==="?"?"/"+h:h},"*");return;}' +
    'var b=e.target.closest&&e.target.closest("button,input[type=submit]");if(!b)return;' +
    'var f=b.form||(b.closest&&b.closest("form"));if(!f)return;' +
    'var tp=(b.getAttribute("type")||"").toLowerCase();if(tp&&tp!=="submit")return;' +
    'e.preventDefault();e.stopPropagation();sendForm(f);},true);' +
    'document.addEventListener("submit",function(e){var f=e.target;if(!f||f.tagName!=="FORM")return;' +
    'e.preventDefault();e.stopPropagation();sendForm(f);},true);' +
    'document.addEventListener("contextmenu",function(e){var el=e.target;' +
    'if(el&&el.closest&&el.closest("input,textarea,[contenteditable],[contenteditable=\\"true\\"]"))return;' +
    'var a=el&&el.closest?el.closest("a[href]"):null,h=a?a.getAttribute("href")||"":"";if(!isLink(h))h="";' +
    'var s="";try{s=String(window.getSelection()||"").trim().slice(0,600)}catch(x){}' +
    'e.preventDefault();parent.postMessage({cdwebCtx:{x:e.clientX,y:e.clientY,link:h,sel:s}},"*");},true);' +
    'document.addEventListener("keydown",function(e){if(!(e.ctrlKey||e.metaKey)||e.altKey||e.shiftKey)return;' +
    'if(String(e.key).toLowerCase()==="t"||e.code==="KeyT"){e.preventDefault();parent.postMessage({cdwebKey:"shell"},"*");}},true);' +
    '})();<\/script>';

  /* ---- Per-site unique modern design system (deterministically seeded from host + id + token) ---- */
  function hash32(str) {
    let h = 2166136261 >>> 0;
    const s = String(str || '');
    for (let i = 0; i < s.length; i++) {
      h ^= s.charCodeAt(i);
      h = Math.imul(h, 16777619) >>> 0;
    }
    return h >>> 0;
  }
  function seededRng(seed) {
    let a = (seed >>> 0) || 1;
    return () => {
      a = (a + 0x6d2b79f5) >>> 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  const TYPO_STACKS = [
    { id: 'geometric', head: '"Segoe UI Variable Display","Avenir Next","Inter","Segoe UI",system-ui,sans-serif', body: '"Segoe UI Variable","Inter","Segoe UI",system-ui,sans-serif', weight: 800, track: '-0.036em', h1: '36px' },
    { id: 'editorial-serif', head: '"Georgia","Iowan Old Style","Palatino Linotype",serif', body: '"Segoe UI","Helvetica Neue",system-ui,sans-serif', weight: 700, track: '-0.02em', h1: '38px' },
    { id: 'neo-swiss', head: '"Helvetica Neue","Arial",system-ui,sans-serif', body: '"Helvetica Neue","Segoe UI",system-ui,sans-serif', weight: 800, track: '-0.032em', h1: '35px' },
    { id: 'humanist', head: '"Trebuchet MS","Gill Sans","Segoe UI",system-ui,sans-serif', body: '"Segoe UI",system-ui,sans-serif', weight: 700, track: '-0.018em', h1: '34px' },
    { id: 'tech-mono', head: '"Segoe UI Variable Display","Segoe UI",system-ui,sans-serif', body: '"Segoe UI",system-ui,sans-serif', weight: 750, track: '-0.03em', h1: '33px', monoTags: true },
    { id: 'classic-book', head: '"Cambria","Palatino","Georgia",serif', body: '"Segoe UI",system-ui,sans-serif', weight: 700, track: '-0.015em', h1: '37px' },
    { id: 'bold-condensed', head: '"Bahnschrift","Franklin Gothic Medium","Segoe UI",sans-serif', body: '"Segoe UI",system-ui,sans-serif', weight: 700, track: '-0.015em', h1: '38px' },
    { id: 'soft-modern', head: '"Segoe UI Variable","Calibri","Segoe UI",system-ui,sans-serif', body: '"Segoe UI Variable","Segoe UI",system-ui,sans-serif', weight: 700, track: '-0.024em', h1: '35px' }
  ];

  function siteDesign(site) {
    if (site.portal) {
      return {
        scheme: 'dark', surface: 'portal', hue: 200, hue2: 245,
        bg: '#090e17', panel: '#111827', panel2: '#182234', line: '#243248',
        ink: '#eef4ff', mute: '#90a3be', accent: '#38bdf8', accent2: '#818cf8',
        accentSoft: 'rgba(56,189,248,0.14)', btnInk: '#06111c',
        headerBg: 'rgba(13,20,33,0.92)', headerInk: '#f1f5f9', headerBorder: '#243248',
        codeBg: '#070b12', codeInk: '#bae6fd',
        typo: TYPO_STACKS[0], navStyle: 'split-clean', heroStyle: 'centered-mesh',
        cardStyle: 'hairline-crisp', logoStyle: 4, gridMode: 'cards-3', footerStyle: 'centered-clean',
        btnRadius: '10px', cardRadius: '14px', maxW: '1040px', bgPattern: 'radial-mesh',
        banner: '', seed: 1, fingerprint: 'portal'
      };
    }
    if (site.design) return site.design;
    const fam = site.theme || themeFamilyFor(site);
    const id = site.cat && site.cat.id;
    const isCrypto = id === 'crypto';
    const seed = hash32(site.host + '|' + site.id + '|' + site.token);
    const rnd = seededRng(seed);
    const rPick = arr => arr[Math.floor(rnd() * arr.length)];

    /* Wide continuous hue per site + curated harmony shift so no two sites share the same color identity */
    let hue = Math.floor(rnd() * 360);
    if (fam === 'alert') hue = (Math.floor(rnd() * 44) + 350) % 360; /* crisp orange/red/amber hues */
    const harmony = rPick([28, 42, 138, 172, 208, 318]);
    const hue2 = (hue + harmony) % 360;

    /* Surface modes: mix light & dark thoughtfully across families so every site feels genuinely distinct */
    const lightSurfaces = ['crisp-light', 'warm-linen', 'tinted-air'];
    const darkSurfaces = ['midnight-glass', 'obsidian-zinc', 'deep-brand'];
    let darkProb = 0.25;
    if (fam === 'saas' || isCrypto) darkProb = 0.65;
    else if (fam === 'archive') darkProb = 0.78;
    else if (fam === 'community') darkProb = 0.55;
    else if (fam === 'editorial') darkProb = 0.16;
    else if (fam === 'commerce') darkProb = 0.18;
    else if (fam === 'civic' || fam === 'finance') darkProb = 0.14;
    else if (fam === 'alert') darkProb = 0.12;
    const isDark = rnd() < darkProb;
    const surface = isDark ? rPick(darkSurfaces) : rPick(lightSurfaces);

    let bg, panel, panel2, line, ink, mute, accent, accent2, accentSoft, btnInk, codeBg, codeInk;
    if (!isDark) {
      const satA = 62 + Math.floor(rnd() * 24);
      const lightA = 34 + Math.floor(rnd() * 10);
      accent = 'hsl(' + hue + ',' + satA + '%,' + lightA + '%)';
      accent2 = 'hsl(' + hue2 + ',' + Math.max(48, satA - 6) + '%,' + (lightA + 4) + '%)';
      accentSoft = 'hsla(' + hue + ',' + satA + '%,50%,0.10)';
      btnInk = '#ffffff';
      if (surface === 'warm-linen') {
        bg = 'hsl(' + ((hue % 24) + 30) + ',26%,96.5%)';
        panel = '#ffffff';
        panel2 = 'hsl(' + ((hue % 24) + 30) + ',22%,92.5%)';
        line = 'hsl(' + ((hue % 24) + 24) + ',16%,85%)';
        ink = '#1c1917'; mute = '#57534e';
        codeBg = '#f5f1ea'; codeInk = '#292524';
      } else if (surface === 'tinted-air') {
        bg = 'hsl(' + hue + ',34%,97.2%)';
        panel = '#ffffff';
        panel2 = 'hsl(' + hue + ',36%,93.5%)';
        line = 'hsl(' + hue + ',22%,86%)';
        ink = 'hsl(' + hue + ',26%,12%)';
        mute = 'hsl(' + hue + ',14%,42%)';
        codeBg = 'hsl(' + hue + ',28%,94%)'; codeInk = 'hsl(' + hue + ',32%,18%)';
      } else {
        bg = '#fbfcfd'; panel = '#ffffff'; panel2 = '#f3f5f8'; line = '#e3e8ef';
        ink = '#0f172a'; mute = '#5b677a';
        codeBg = '#f1f5f9'; codeInk = '#0f172a';
      }
    } else {
      const satA = 70 + Math.floor(rnd() * 22);
      const lightA = 62 + Math.floor(rnd() * 10);
      accent = 'hsl(' + hue + ',' + satA + '%,' + lightA + '%)';
      accent2 = 'hsl(' + hue2 + ',' + satA + '%,' + Math.min(76, lightA + 4) + '%)';
      accentSoft = 'hsla(' + hue + ',' + satA + '%,60%,0.14)';
      btnInk = '#070b12';
      if (surface === 'obsidian-zinc') {
        bg = '#09090b'; panel = '#121216'; panel2 = '#1a1a21'; line = '#272730';
        ink = '#f4f4f6'; mute = '#9c9ca8';
        codeBg = '#060608'; codeInk = '#e4e4ec';
      } else if (surface === 'deep-brand') {
        bg = 'hsl(' + hue + ',30%,7.5%)';
        panel = 'hsl(' + hue + ',26%,11.5%)';
        panel2 = 'hsl(' + hue + ',24%,15.5%)';
        line = 'hsl(' + hue + ',22%,22%)';
        ink = 'hsl(' + hue + ',24%,94%)';
        mute = 'hsl(' + hue + ',16%,66%)';
        codeBg = 'hsl(' + hue + ',34%,5.5%)'; codeInk = 'hsl(' + hue2 + ',72%,84%)';
      } else {
        bg = '#080d18'; panel = '#0f172a'; panel2 = '#16213a'; line = '#233252';
        ink = '#edf2fc'; mute = '#94a6c4';
        codeBg = '#060a13'; codeInk = '#cce4ff';
      }
    }

    const typoPool = fam === 'editorial'
      ? [TYPO_STACKS[1], TYPO_STACKS[5], TYPO_STACKS[2], TYPO_STACKS[0], TYPO_STACKS[6]]
      : fam === 'archive'
        ? [TYPO_STACKS[4], TYPO_STACKS[2], TYPO_STACKS[0], TYPO_STACKS[6]]
        : TYPO_STACKS;
    const typo = rPick(typoPool);

    const navStyle = rPick(fam === 'editorial'
      ? ['masthead', 'minimal-rail', 'split-clean', 'dual-utility', 'brand-bar']
      : ['floating-pill', 'split-clean', 'brand-bar', 'minimal-rail', 'dual-utility', 'masthead']);
    const heroStyle = rPick(['split-art', 'centered-mesh', 'bento-top', 'gradient-banner', 'editorial-split', 'minimal-stripe']);
    const cardStyle = rPick(['soft-elevated', 'hairline-crisp', 'bento-tinted', 'editorial-ruled', 'glass-accent']);
    const logoStyle = Math.floor(rnd() * 8);
    const gridMode = rPick(['cards-3', 'cards-2', 'bento-asym', 'list-modern']);
    const footerStyle = rPick(['multi-col', 'centered-clean', 'contrast-band']);
    const btnRadius = rPick(['999px', '10px', '6px']);
    const cardRadius = cardStyle === 'editorial-ruled' ? '5px' : cardStyle === 'hairline-crisp' ? '11px' : cardStyle === 'bento-tinted' ? '20px' : '16px';
    const maxW = rPick(['980px', '1060px', '1120px', '1180px']);
    const bgPattern = rPick(['none', 'radial-mesh', 'dot-grid', 'subtle-lines', 'top-glow']);

    let headerBg = panel, headerInk = ink, headerBorder = line;
    if (navStyle === 'brand-bar') {
      headerBg = 'linear-gradient(110deg,hsl(' + hue + ',52%,' + (isDark ? '18%' : '22%') + '),hsl(' + hue2 + ',48%,' + (isDark ? '14%' : '18%') + '))';
      headerInk = '#ffffff';
      headerBorder = 'rgba(255,255,255,0.16)';
    } else if (navStyle === 'floating-pill') {
      headerBg = isDark ? 'rgba(18,24,38,0.86)' : 'rgba(255,255,255,0.88)';
    }

    const bannerMap = {
      editorial: 'Edition · ' + new Date().toLocaleDateString([], { weekday: 'short', month: 'long', day: 'numeric', year: 'numeric' }) + ' · ' + (site.region || 'Global'),
      commerce: 'Free express delivery over $50 · Fulfilled from ' + (site.region || 'regional hub'),
      civic: 'Official digital portal · ' + (site.region || 'Regional') + ' · Public records & services',
      finance: isCrypto ? 'Live markets · 24h volume $' + (1.1 + rnd() * 3.8).toFixed(2) + 'B · Zero-latency settlement' : 'FDIC-style protected portal · ' + (site.region || 'Member') + ' · 24/7 support',
      alert: 'Action required · Reference #' + site.token.toUpperCase() + ' · Verify account status',
      saas: '● All systems operational · ' + (99.9 + rnd() * 0.09).toFixed(2) + '% uptime · API v' + (2 + (seed % 3)),
      archive: 'MIRROR NODE ' + site.token.slice(0, 4).toUpperCase() + ' · SHA-256 VERIFIED · PUBLIC INDEX',
      community: site.kind + ' · ' + (140 + (seed % 4200)) + ' active members · ' + (site.region || 'Online')
    };
    const showBanner = navStyle === 'dual-utility' || (navStyle !== 'floating-pill' && navStyle !== 'minimal-rail' && rnd() < 0.48);

    const design = {
      scheme: isDark ? 'dark' : 'light', isDark, surface, hue, hue2,
      bg, panel, panel2, line, ink, mute, accent, accent2, accentSoft, btnInk,
      headerBg, headerInk, headerBorder, codeBg, codeInk,
      typo, navStyle, heroStyle, cardStyle, logoStyle, gridMode, footerStyle,
      btnRadius, cardRadius, maxW, bgPattern,
      banner: showBanner ? (bannerMap[fam] || '') : '',
      seed,
      metrics: [
        [String(4 + (seed % 14)) + 'k+', fam === 'commerce' ? 'Orders shipped' : fam === 'editorial' ? 'Daily readers' : fam === 'saas' ? 'Teams onboarded' : 'Active records'],
        [(98.4 + (seed % 15) * 0.1).toFixed(1) + '%', fam === 'commerce' ? 'On-time rating' : fam === 'finance' ? 'Settlement SLA' : 'Reliability'],
        ['Est. ' + (2004 + (seed % 21)), site.region || 'Global']
      ],
      fingerprint: [surface, typo.id, navStyle, heroStyle, cardStyle, logoStyle, gridMode, footerStyle, hue].join(':')
    };
    site.design = design;
    return design;
  }

  function themeSpec(site) { return siteDesign(site); }

  function brandMark(site, d) {
    const h1 = d.hue || 200, h2 = d.hue2 || 250;
    const c1 = d.accent, c2 = d.accent2;
    const initials = String(site.brand || 'W').split(/\s+/).filter(Boolean).slice(0, 2).map(w => w[0]).join('').toUpperCase();
    const gid = 'g' + (d.seed || 1).toString(36);
    const kind = d.logoStyle || 0;
    if (kind === 0) {
      /* overlapping translucent circles */
      return '<svg width="30" height="30" viewBox="0 0 32 32" aria-hidden="true" style="flex:none">' +
        '<circle cx="12" cy="16" r="9.5" fill="' + c1 + '" opacity=".92"/>' +
        '<circle cx="20" cy="16" r="9.5" fill="' + c2 + '" opacity=".78"/>' +
        '</svg>';
    }
    if (kind === 1) {
      /* isometric hexagon emblem */
      return '<svg width="30" height="30" viewBox="0 0 32 32" aria-hidden="true" style="flex:none">' +
        '<polygon points="16,2 28,9 28,23 16,30 4,23 4,9" fill="' + c1 + '"/>' +
        '<polygon points="16,2 28,9 16,16 4,9" fill="' + c2 + '" opacity=".85"/>' +
        '<polygon points="16,16 28,9 28,23 16,30" fill="#000" opacity=".2"/>' +
        '</svg>';
    }
    if (kind === 2) {
      /* Swiss gradient squircle monogram */
      return '<svg width="30" height="30" viewBox="0 0 32 32" aria-hidden="true" style="flex:none">' +
        '<defs><linearGradient id="' + gid + '" x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stop-color="' + c1 + '"/><stop offset="100%" stop-color="' + c2 + '"/></linearGradient></defs>' +
        '<rect width="32" height="32" rx="9" fill="url(#' + gid + ')"/>' +
        '<text x="16" y="21" text-anchor="middle" font-family="Segoe UI,system-ui,sans-serif" font-size="13" font-weight="800" fill="#ffffff">' + esc(initials) + '</text></svg>';
    }
    if (kind === 3) {
      /* dynamic diagonal ribbon mark */
      return '<svg width="30" height="30" viewBox="0 0 32 32" aria-hidden="true" style="flex:none">' +
        '<rect width="32" height="32" rx="8" fill="hsl(' + h1 + ',32%,14%)"/>' +
        '<path d="M7 23 L15 7 L21 7 L13 23 Z" fill="' + c1 + '"/>' +
        '<path d="M15 25 L23 9 L27 9 L19 25 Z" fill="' + c2 + '"/>' +
        '</svg>';
    }
    if (kind === 4) {
      /* concentric aperture ring */
      return '<svg width="30" height="30" viewBox="0 0 32 32" aria-hidden="true" style="flex:none">' +
        '<circle cx="16" cy="16" r="13" fill="none" stroke="' + c1 + '" stroke-width="3.2"/>' +
        '<circle cx="16" cy="16" r="7" fill="none" stroke="' + c2 + '" stroke-width="2.6" stroke-dasharray="18 6"/>' +
        '<circle cx="16" cy="16" r="3.2" fill="' + c1 + '"/>' +
        '</svg>';
    }
    if (kind === 5) {
      /* 2x2 Bauhaus geometric mosaic */
      return '<svg width="30" height="30" viewBox="0 0 32 32" aria-hidden="true" style="flex:none">' +
        '<rect x="2" y="2" width="13" height="13" rx="4" fill="' + c1 + '"/>' +
        '<circle cx="23.5" cy="8.5" r="6.5" fill="' + c2 + '"/>' +
        '<circle cx="8.5" cy="23.5" r="6.5" fill="' + c2 + '" opacity=".65"/>' +
        '<rect x="17" y="17" width="13" height="13" rx="4" fill="' + c1 + '" opacity=".85"/>' +
        '</svg>';
    }
    if (kind === 6) {
      /* wave arc crest */
      return '<svg width="30" height="30" viewBox="0 0 32 32" aria-hidden="true" style="flex:none">' +
        '<rect width="32" height="32" rx="16" fill="' + c1 + '"/>' +
        '<path d="M6 19 Q11 10 16 17 T26 14" fill="none" stroke="#ffffff" stroke-width="3" stroke-linecap="round"/>' +
        '<circle cx="23" cy="11" r="2.6" fill="' + c2 + '"/>' +
        '</svg>';
    }
    /* sharp diamond shield */
    return '<svg width="30" height="30" viewBox="0 0 32 32" aria-hidden="true" style="flex:none">' +
      '<polygon points="16,2 30,16 16,30 2,16" fill="' + c1 + '"/>' +
      '<polygon points="16,8 24,16 16,24 8,16" fill="' + c2 + '"/>' +
      '<circle cx="16" cy="16" r="3" fill="#ffffff"/>' +
      '</svg>';
  }

  /* Bespoke modern inline SVG artwork for heroes & cards — category-aware & uniquely seeded per site */
  function heroArtSvg(site, d) {
    const fam = site.theme || themeFamilyFor(site);
    const h1 = d.hue, h2 = d.hue2;
    const rnd = seededRng((d.seed || 1) ^ 0x9e3779b9);
    const uid = 'ha' + (d.seed || 1).toString(36);
    const bg1 = 'hsl(' + h1 + ',56%,' + (d.isDark ? '18%' : '26%') + ')';
    const bg2 = 'hsl(' + h2 + ',52%,' + (d.isDark ? '12%' : '18%') + ')';
    const hi1 = 'hsl(' + h1 + ',85%,68%)';
    const hi2 = 'hsl(' + h2 + ',82%,72%)';

    if (fam === 'saas' || fam === 'finance') {
      /* Crisp modern glass UI dashboard / live sparkline chart */
      const pts = [];
      let y = 138;
      for (let i = 0; i <= 8; i++) {
        y = Math.max(58, Math.min(165, y + Math.round((rnd() - 0.54) * 34)));
        pts.push((38 + i * 42) + ',' + y);
      }
      const line = pts.join(' ');
      const area = '38,180 ' + line + ' 374,180';
      return '<svg viewBox="0 0 420 230" class="art-svg" aria-hidden="true">' +
        '<defs><linearGradient id="' + uid + '" x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stop-color="' + bg1 + '"/><stop offset="100%" stop-color="' + bg2 + '"/></linearGradient>' +
        '<linearGradient id="' + uid + 'a" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="' + hi1 + '" stop-opacity=".55"/><stop offset="100%" stop-color="' + hi1 + '" stop-opacity="0"/></linearGradient></defs>' +
        '<rect width="420" height="230" rx="16" fill="url(#' + uid + ')"/>' +
        '<circle cx="350" cy="40" r="95" fill="' + hi2 + '" opacity=".14"/>' +
        '<rect x="20" y="18" width="380" height="194" rx="12" fill="rgba(10,16,28,0.52)" stroke="rgba(255,255,255,0.14)"/>' +
        '<circle cx="38" cy="34" r="4" fill="#f87171"/><circle cx="52" cy="34" r="4" fill="#fbbf24"/><circle cx="66" cy="34" r="4" fill="#34d399"/>' +
        '<rect x="92" y="29" width="110" height="10" rx="5" fill="rgba(255,255,255,0.14)"/>' +
        '<rect x="318" y="28" width="64" height="12" rx="6" fill="' + hi1 + '" opacity=".35"/>' +
        '<line x1="36" y1="88" x2="380" y2="88" stroke="rgba(255,255,255,0.08)" stroke-dasharray="4 4"/>' +
        '<line x1="36" y1="134" x2="380" y2="134" stroke="rgba(255,255,255,0.08)" stroke-dasharray="4 4"/>' +
        '<polygon points="' + area + '" fill="url(#' + uid + 'a)"/>' +
        '<polyline points="' + line + '" fill="none" stroke="' + hi1 + '" stroke-width="3.2" stroke-linecap="round" stroke-linejoin="round"/>' +
        '<circle cx="' + pts[pts.length - 1].split(',')[0] + '" cy="' + pts[pts.length - 1].split(',')[1] + '" r="6" fill="' + hi2 + '" stroke="#fff" stroke-width="2"/>' +
        '<rect x="38" y="188" width="84" height="10" rx="5" fill="rgba(255,255,255,0.18)"/>' +
        '<rect x="136" y="188" width="58" height="10" rx="5" fill="' + hi2 + '" opacity=".55"/>' +
        '</svg>';
    }
    if (fam === 'editorial') {
      /* Bold contemporary editorial geometric art collage */
      const cx1 = 110 + Math.round(rnd() * 80), cy1 = 80 + Math.round(rnd() * 55);
      const r1 = 56 + Math.round(rnd() * 34);
      const rx = 210 + Math.round(rnd() * 50), ry = 35 + Math.round(rnd() * 40);
      return '<svg viewBox="0 0 420 230" class="art-svg" aria-hidden="true">' +
        '<defs><linearGradient id="' + uid + '" x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stop-color="' + bg1 + '"/><stop offset="100%" stop-color="' + bg2 + '"/></linearGradient></defs>' +
        '<rect width="420" height="230" rx="14" fill="url(#' + uid + ')"/>' +
        '<circle cx="' + cx1 + '" cy="' + cy1 + '" r="' + r1 + '" fill="' + hi1 + '" opacity=".85"/>' +
        '<rect x="' + rx + '" y="' + ry + '" width="132" height="132" rx="18" fill="' + hi2 + '" opacity=".28" transform="rotate(' + Math.round(rnd() * 18 - 9) + ' ' + (rx + 66) + ' ' + (ry + 66) + ')"/>' +
        '<path d="M0 185 Q110 ' + (115 + Math.round(rnd() * 45)) + ' 230 168 T420 140 L420 230 L0 230 Z" fill="rgba(255,255,255,0.14)"/>' +
        '<path d="M24 28 H148 M24 44 H110" stroke="rgba(255,255,255,0.55)" stroke-width="3" stroke-linecap="round"/>' +
        '<circle cx="348" cy="176" r="24" fill="none" stroke="rgba(255,255,255,0.65)" stroke-width="2.5"/>' +
        '<text x="24" y="206" font-family="Segoe UI,system-ui,sans-serif" font-size="11" font-weight="700" letter-spacing="2" fill="rgba(255,255,255,0.82)">' + esc(String(site.topic || site.kind).toUpperCase().slice(0, 32)) + '</text>' +
        '</svg>';
    }
    if (fam === 'commerce') {
      /* Modern studio product showcase pedestal */
      const shape = Math.floor(rnd() * 3);
      const itemArt = shape === 0
        ? '<rect x="152" y="48" width="116" height="118" rx="22" fill="' + hi1 + '" opacity=".9"/><rect x="174" y="72" width="72" height="14" rx="7" fill="#fff" opacity=".82"/><rect x="174" y="96" width="52" height="10" rx="5" fill="#fff" opacity=".48"/>'
        : shape === 1
          ? '<circle cx="210" cy="108" r="56" fill="' + hi1 + '" opacity=".92"/><circle cx="210" cy="108" r="34" fill="' + bg2 + '" opacity=".45"/><circle cx="228" cy="86" r="10" fill="#fff" opacity=".75"/>'
          : '<polygon points="210,44 274,158 146,158" fill="' + hi1 + '" opacity=".9"/><circle cx="210" cy="116" r="22" fill="' + hi2 + '" opacity=".9"/>';
      return '<svg viewBox="0 0 420 230" class="art-svg" aria-hidden="true">' +
        '<defs><linearGradient id="' + uid + '" x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stop-color="' + bg1 + '"/><stop offset="100%" stop-color="' + bg2 + '"/></linearGradient></defs>' +
        '<rect width="420" height="230" rx="16" fill="url(#' + uid + ')"/>' +
        '<circle cx="96" cy="54" r="88" fill="' + hi2 + '" opacity=".16"/>' +
        '<ellipse cx="210" cy="176" rx="112" ry="18" fill="rgba(0,0,0,0.32)"/>' +
        '<ellipse cx="210" cy="172" rx="96" ry="13" fill="rgba(255,255,255,0.16)"/>' +
        itemArt +
        '<rect x="24" y="20" width="92" height="22" rx="11" fill="rgba(255,255,255,0.18)"/>' +
        '<text x="70" y="34" text-anchor="middle" font-family="Segoe UI,system-ui,sans-serif" font-size="10" font-weight="700" fill="#ffffff">' + esc(site.cat.label.toUpperCase().slice(0, 12)) + '</text>' +
        '</svg>';
    }
    if (fam === 'community') {
      /* Modern constellation / waveform visual */
      const bars = Array.from({ length: 16 }, (_, i) => {
        const bh = 24 + Math.round(rnd() * 96);
        return '<rect x="' + (38 + i * 22) + '" y="' + (115 - bh / 2) + '" width="12" height="' + bh + '" rx="6" fill="' + (i % 2 ? hi1 : hi2) + '" opacity="' + (0.55 + (i % 3) * 0.15).toFixed(2) + '"/>';
      }).join('');
      return '<svg viewBox="0 0 420 230" class="art-svg" aria-hidden="true">' +
        '<defs><linearGradient id="' + uid + '" x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stop-color="' + bg1 + '"/><stop offset="100%" stop-color="' + bg2 + '"/></linearGradient></defs>' +
        '<rect width="420" height="230" rx="16" fill="url(#' + uid + ')"/>' +
        bars +
        '<text x="38" y="204" font-family="Segoe UI,system-ui,sans-serif" font-size="11" font-weight="700" fill="rgba(255,255,255,0.78)">LIVE · ' + esc(site.brand.toUpperCase().slice(0, 26)) + '</text>' +
        '</svg>';
    }
    /* Civic / Archive / Alert: modern architectural skyline & topographic waves */
    const cols = Array.from({ length: 7 }, (_, i) => {
      const ch = 46 + Math.round(rnd() * 98);
      return '<rect x="' + (34 + i * 52) + '" y="' + (192 - ch) + '" width="36" height="' + ch + '" rx="6" fill="rgba(255,255,255,' + (0.14 + (i % 3) * 0.08).toFixed(2) + ')"/>';
    }).join('');
    return '<svg viewBox="0 0 420 230" class="art-svg" aria-hidden="true">' +
      '<defs><linearGradient id="' + uid + '" x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stop-color="' + bg1 + '"/><stop offset="100%" stop-color="' + bg2 + '"/></linearGradient></defs>' +
      '<rect width="420" height="230" rx="16" fill="url(#' + uid + ')"/>' +
      '<circle cx="330" cy="64" r="46" fill="' + hi1 + '" opacity=".35"/>' +
      '<path d="M0 154 Q105 110 210 144 T420 128" fill="none" stroke="' + hi2 + '" stroke-width="2.5" opacity=".75"/>' +
      cols +
      '<text x="34" y="34" font-family="Segoe UI,system-ui,sans-serif" font-size="11" font-weight="700" letter-spacing="1.6" fill="rgba(255,255,255,0.82)">' + esc((site.region || site.kind).toUpperCase().slice(0, 24)) + '</text>' +
      '</svg>';
  }

  function cardArtSvg(site, idx, label) {
    const d = siteDesign(site);
    const h1 = (d.hue + idx * 31) % 360;
    const h2 = (d.hue2 + idx * 19) % 360;
    const uid = 'ca' + (d.seed || 1).toString(36) + '_' + idx;
    const style = (d.seed + idx) % 4;
    const motif = style === 0
      ? '<circle cx="198" cy="36" r="54" fill="hsl(' + h2 + ',80%,72%)" opacity=".32"/><circle cx="72" cy="96" r="36" fill="hsl(' + h1 + ',85%,78%)" opacity=".28"/>'
      : style === 1
        ? '<rect x="148" y="16" width="84" height="84" rx="16" transform="rotate(16 190 58)" fill="hsl(' + h2 + ',82%,72%)" opacity=".30"/><rect x="28" y="26" width="46" height="46" rx="12" fill="#fff" opacity=".16"/>'
        : style === 2
          ? '<path d="M0 92 Q74 36 148 76 T280 48 L280 120 L0 120 Z" fill="rgba(255,255,255,0.16)"/><circle cx="222" cy="34" r="18" fill="hsl(' + h2 + ',88%,76%)" opacity=".65"/>'
          : '<polygon points="210,12 264,108 156,108" fill="hsl(' + h2 + ',82%,72%)" opacity=".32"/><circle cx="66" cy="48" r="24" fill="none" stroke="rgba(255,255,255,0.45)" stroke-width="2.5"/>';
    return '<svg viewBox="0 0 280 120" class="thumb-svg" aria-hidden="true">' +
      '<defs><linearGradient id="' + uid + '" x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stop-color="hsl(' + h1 + ',58%,34%)"/><stop offset="100%" stop-color="hsl(' + h2 + ',52%,20%)"/></linearGradient></defs>' +
      '<rect width="280" height="120" fill="url(#' + uid + ')"/>' +
      motif +
      '<text x="14" y="104" font-family="Segoe UI,system-ui,sans-serif" font-size="11" font-weight="700" letter-spacing="0.8" fill="rgba(255,255,255,0.9)">' + esc(String(label || site.cat.label).slice(0, 26)) + '</text>' +
      '</svg>';
  }

  /* Interconnected web graph: deterministically wires every site to 6 real peer & ecosystem sites across the Fake Internet */
  function relatedSitesFor(site) {
    if (!site || site.portal) return [];
    ensure(BASE);
    if (site._related && site._related.length >= 6) return site._related;
    const d = siteDesign(site);
    const rnd = seededRng((d.seed || 1) ^ 0x517cc1b7);
    const picked = [], seen = new Set([site.host]);
    const takeFrom = pool => {
      if (!pool.length) return;
      const start = Math.floor(rnd() * pool.length);
      for (let i = 0; i < pool.length && picked.length < 6; i++) {
        const s = pool[(start + i) % pool.length];
        if (s && !s.portal && !seen.has(s.host)) { seen.add(s.host); picked.push(s); break; }
      }
    };
    const sameCat = catalog.filter(s => s.cat.id === site.cat.id && s.host !== site.host);
    const sameTheme = catalog.filter(s => s.theme === site.theme && s.cat.id !== site.cat.id && s.host !== site.host);
    const flagship = catalog.filter(s => FLAGSHIP_SITES.some(f => f.host === s.host) && s.host !== site.host);
    takeFrom(sameCat);
    takeFrom(sameTheme);
    takeFrom(flagship);
    takeFrom(sameTheme);
    takeFrom(flagship);
    while (picked.length < 6 && catalog.length > picked.length + 1) {
      const s = catalog[Math.floor(rnd() * catalog.length)];
      if (s && !s.portal && !seen.has(s.host)) { seen.add(s.host); picked.push(s); }
    }
    site._related = picked;
    return picked;
  }

  function shell(site, title, inner) {
    const d = siteDesign(site);
    const fam = site.theme || themeFamilyFor(site);
    const L = site.cat.layout;
    const extraNav = L === 'docs' ? '<a href="/docs">Docs</a>' : L === 'status' ? '<a href="/status">Status</a>' :
      L === 'gallery' ? '<a href="/gallery">Gallery</a>' : L === 'forum' ? '<a href="/forum">Forum</a>' :
      L === 'wiki' ? '<a href="/wiki">Wiki</a>' : L === 'forecast' ? '<a href="/forecast">Forecast</a>' :
      '<a href="/faq">FAQ</a>';
    const cartCount = (site.cart || []).reduce((sum, x) => sum + (x.qty || 1), 0);
    const cartNav = fam === 'commerce' ? '<a href="/cart" class="pill-btn">Cart' + (cartCount ? ' (' + cartCount + ')' : '') + '</a>' : '';
    const navHtml = site.portal
      ? '<a href="/">Search</a><a href="/all">All sites</a><a href="/mail">Cyber Mail sites</a><a href="/trapped">Unsafe / virus sites</a><a href="/random">Random site</a>'
      : '<a href="/">Home</a><a href="' + site.cat.route + '">' + esc(site.cat.routeLabel) + '</a>' +
        '<a href="/about">About</a>' + extraNav + '<a href="/contact">Contact</a>' + cartNav +
        '<a href="/login" class="signin-link">' + (site.session && site.session.admin ? 'Admin' : 'Sign in') + '</a>';
    const headerSearch = site.portal ? '' :
      '<form action="/search" method="get" class="hdr-search"><input name="q" placeholder="Search ' + esc(site.brand) + '…"><button type="submit">Go</button></form>';

    const headerHtml = d.navStyle === 'masthead' && !site.portal
      ? '<header class="hdr-masthead"><div class="mast-top"><span class="mast-meta">' + esc(site.region || site.kind) + '</span>' +
        '<a class="brand mast-brand" href="/">' + brandMark(site, d) + '<span>' + esc(site.brand) + '</span></a>' +
        '<span class="mast-meta">' + esc(site.host) + '</span></div>' +
        '<div class="mast-bar"><nav>' + navHtml + '</nav>' + headerSearch + '</div></header>'
      : '<header class="hdr-' + d.navStyle + '"><div class="hdr-in"><a class="brand" href="/">' + brandMark(site, d) + '<span>' + esc(site.brand) + '</span></a><nav>' + navHtml +
        '</nav>' + headerSearch + '</div></header>';

    const relFoot = site.portal ? [] : relatedSitesFor(site).slice(0, 4);
    const partnerLinksHtml = relFoot.map(r => '<a href="https://' + esc(r.host) + '/">' + esc(r.brand) + '</a>').join(d.footerStyle === 'multi-col' ? '' : ' · ');
    let footHtml;
    if (site.portal) {
      footHtml = '<div class="foot-center">Moundshroud Fake Internet · ' + esc(site.host) + ' · <a href="/all">Directory</a> · <a href="/mail">Cyber Mail sites</a> · <a href="/random">Random site</a></div>';
    } else if (d.footerStyle === 'multi-col') {
      footHtml = '<div class="foot-cols">' +
        '<div><a class="brand" href="/" style="margin-bottom:8px">' + brandMark(site, d) + '<span>' + esc(site.brand) + '</span></a><p class="mute" style="margin:6px 0 0;font-size:13px">' + esc(site.tagline) + '</p></div>' +
        '<div><b>Explore</b><a href="' + site.cat.route + '">' + esc(site.cat.routeLabel) + '</a><a href="/article/1">Latest stories</a><a href="/documents">Documents</a><a href="/faq">FAQ</a></div>' +
        '<div><b>Company</b><a href="/about">About</a><a href="/team">Team</a><a href="/contact">Contact</a><a href="/terms">Terms</a><a href="/privacy">Privacy</a></div>' +
        '<div><b>Across the Web</b>' + partnerLinksHtml + '<a href="https://search.moundshroud.example/">Moundshroud Search</a></div></div>' +
        '<div class="foot-bottom">© ' + new Date().getFullYear() + ' ' + esc(site.brand) + ' · ' + esc(site.region || 'Global') + ' · ' + esc(site.host) + '</div>';
    } else if (d.footerStyle === 'centered-clean') {
      footHtml = '<div class="foot-center"><div style="display:inline-flex;align-items:center;gap:8px;margin-bottom:8px">' + brandMark(site, d) + '<b>' + esc(site.brand) + '</b></div>' +
        '<div class="foot-links"><a href="' + site.cat.route + '">' + esc(site.cat.routeLabel) + '</a> · <a href="/about">About</a> · <a href="/team">Team</a> · <a href="/contact">Contact</a> · <a href="/terms">Terms</a> · <a href="/privacy">Privacy</a></div>' +
        '<div class="foot-links" style="margin-top:6px;font-size:12px"><span class="mute">Linked sites:</span> ' + partnerLinksHtml + ' · <a href="https://search.moundshroud.example/">Directory</a></div>' +
        '<div class="mute" style="margin-top:8px">© ' + new Date().getFullYear() + ' ' + esc(site.brand) + ' · ' + esc(site.host) + '</div></div>';
    } else {
      footHtml = '<div class="foot-grid"><div><b>' + esc(site.brand) + '</b><div class="mute">' + esc(site.tagline) + '</div></div>' +
        '<div><a href="' + site.cat.route + '">' + esc(site.cat.routeLabel) + '</a> · <a href="/about">About</a> · <a href="/team">Team</a> · <a href="/contact">Contact</a></div>' +
        '<div style="font-size:12px"><span class="mute">Partners &amp; web links:</span> ' + partnerLinksHtml + ' · <a href="https://search.moundshroud.example/">Search</a></div>' +
        '<div>© ' + new Date().getFullYear() + ' ' + esc(site.brand) + ' · ' + esc(site.host) + ' · <a href="/terms">Terms</a> · <a href="/privacy">Privacy</a></div></div>';
    }

    const bgCss = d.bgPattern === 'radial-mesh'
      ? 'background-color:' + d.bg + ';background-image:radial-gradient(680px 340px at 14% 0%,hsla(' + d.hue + ',78%,55%,' + (d.isDark ? '.16' : '.09') + '),transparent 65%),radial-gradient(560px 320px at 88% 8%,hsla(' + d.hue2 + ',74%,55%,' + (d.isDark ? '.13' : '.08') + '),transparent 62%)'
      : d.bgPattern === 'dot-grid'
        ? 'background-color:' + d.bg + ';background-image:radial-gradient(' + (d.isDark ? 'rgba(255,255,255,0.06)' : 'rgba(15,23,42,0.065)') + ' 1px,transparent 1px);background-size:22px 22px'
        : d.bgPattern === 'subtle-lines'
          ? 'background-color:' + d.bg + ';background-image:linear-gradient(90deg,' + (d.isDark ? 'rgba(255,255,255,0.03)' : 'rgba(15,23,42,0.03)') + ' 1px,transparent 1px);background-size:72px 100%'
          : d.bgPattern === 'top-glow'
            ? 'background-color:' + d.bg + ';background-image:linear-gradient(180deg,hsla(' + d.hue + ',65%,52%,' + (d.isDark ? '.14' : '.07') + ') 0%,transparent 340px)'
            : 'background:' + d.bg;

    const cardCss = d.cardStyle === 'soft-elevated'
      ? 'border:1px solid ' + d.line + ';border-radius:' + d.cardRadius + ';padding:18px;background:' + d.panel + ';box-shadow:0 8px 26px rgba(0,0,0,' + (d.isDark ? '.24' : '.055') + ')'
      : d.cardStyle === 'bento-tinted'
        ? 'border:1px solid ' + d.line + ';border-radius:' + d.cardRadius + ';padding:18px;background:' + d.panel2 + ';box-shadow:inset 0 1px 0 ' + (d.isDark ? 'rgba(255,255,255,0.05)' : 'rgba(255,255,255,0.85)')
        : d.cardStyle === 'editorial-ruled'
          ? 'border:0;border-top:2px solid ' + d.line + ';border-bottom:1px solid ' + d.line + ';border-radius:' + d.cardRadius + ';padding:16px 6px;background:transparent'
          : d.cardStyle === 'glass-accent'
            ? 'border:1px solid ' + d.line + ';border-top:2px solid ' + d.accent + ';border-radius:' + d.cardRadius + ';padding:18px;background:' + (d.isDark ? 'rgba(18,25,40,0.72)' : 'rgba(255,255,255,0.82)') + ';backdrop-filter:blur(10px)'
            : 'border:1px solid ' + d.line + ';border-radius:' + d.cardRadius + ';padding:17px;background:' + d.panel;

    const footerCss = d.footerStyle === 'contrast-band'
      ? 'background:hsl(' + d.hue + ',30%,10%);color:#cbd5e1;border-top:0'
      : 'background:' + d.panel + ';color:' + d.mute + ';border-top:1px solid ' + d.line;
    const footerLinkCss = d.footerStyle === 'contrast-band' ? 'footer a,footer b{color:#f8fafc}footer .mute{color:#94a3b8}' : '';

    const trapMeta = site.trapped && site.virus
      ? '<meta name="x-cd-trap" content="' + esc(site.virus.name) + '"><!-- [simulated fake-virus trap: ' + esc(site.virus.name) + ' · script ' + esc(site.virus.scriptPath) + '] -->'
      : '';
    return '<!doctype html>\n<html lang="en" data-design="' + esc(d.fingerprint) + '"><head><meta charset="utf-8">' +
      '<meta name="viewport" content="width=device-width,initial-scale=1">' + trapMeta + '<title>' + esc(title) + ' · ' + esc(site.brand) + '</title>' +
      '<style>' +
      ':root{color-scheme:' + d.scheme + ';--ac:' + d.accent + ';--ac2:' + d.accent2 + ';--bg:' + d.bg + ';--p:' + d.panel + ';--p2:' + d.panel2 + ';--ln:' + d.line + ';--ink:' + d.ink + ';--mu:' + d.mute + '}' +
      '*{box-sizing:border-box}' +
      'body{margin:0;' + bgCss + ';color:' + d.ink + ';font:15px/1.64 ' + d.typo.body + ';min-height:100vh;display:flex;flex-direction:column}' +
      'a{color:' + d.accent + ';text-decoration:none;transition:opacity .15s,border-color .15s}a:hover{text-decoration:underline}' +
      '.topbar{background:' + d.accent + ';color:' + d.btnInk + ';font-size:12px;padding:7px 24px;display:flex;justify-content:space-between;gap:12px;flex-wrap:wrap;font-weight:600;letter-spacing:.01em}' +
      'header{background:' + d.headerBg + ';color:' + d.headerInk + ';border-bottom:1px solid ' + d.headerBorder + '}' +
      'header .hdr-in{max-width:' + d.maxW + ';margin:0 auto;padding:13px 24px;display:flex;gap:16px;align-items:center;flex-wrap:wrap}' +
      'header.hdr-floating-pill{background:transparent;border-bottom:0;padding:14px 18px 0}' +
      'header.hdr-floating-pill .hdr-in{background:' + d.headerBg + ';border:1px solid ' + d.line + ';border-radius:999px;padding:9px 18px;box-shadow:0 10px 30px rgba(0,0,0,' + (d.isDark ? '.28' : '.08') + ');backdrop-filter:blur(12px)}' +
      'header.hdr-minimal-rail{background:transparent;border-bottom:1px solid ' + d.line + '}' +
      'header.hdr-masthead{padding:16px 24px 0;background:' + d.panel + ';color:' + d.ink + '}' +
      '.mast-top{max-width:' + d.maxW + ';margin:0 auto 12px;display:flex;justify-content:space-between;align-items:center;gap:12px;flex-wrap:wrap}' +
      '.mast-brand{font-size:24px !important;letter-spacing:-.03em}.mast-meta{font-size:11.5px;text-transform:uppercase;letter-spacing:.08em;color:' + d.mute + '}' +
      '.mast-bar{max-width:' + d.maxW + ';margin:0 auto;padding:10px 0;border-top:1px solid ' + d.line + ';display:flex;align-items:center;justify-content:space-between;gap:14px;flex-wrap:wrap}' +
      'header .brand,footer .brand{display:inline-flex;align-items:center;gap:10px;font:' + d.typo.weight + ' 17.5px/1.15 ' + d.typo.head + ';letter-spacing:' + d.typo.track + ';color:' + d.headerInk + ';text-decoration:none}' +
      'header.hdr-masthead .brand,footer .brand{color:' + d.ink + '}' +
      'nav{display:flex;gap:15px;font-size:13.5px;flex-wrap:wrap;align-items:center}' +
      'header nav a{color:' + d.headerInk + ';opacity:.86;font-weight:550}header nav a:hover{opacity:1;text-decoration:none}' +
      'header.hdr-masthead nav a{color:' + d.ink + '}' +
      'header nav a.signin-link,header nav a.pill-btn{padding:5px 12px;border-radius:' + d.btnRadius + ';border:1px solid ' + d.headerBorder + ';background:' + (d.navStyle === 'brand-bar' ? 'rgba(255,255,255,0.14)' : d.panel2) + ';opacity:1}' +
      '.hdr-search{display:flex;gap:6px;margin-left:auto;max-width:250px;flex:1 1 160px}.hdr-search input{padding:6px 10px;font-size:13px;min-width:0;flex:1;border-radius:' + d.btnRadius + '}.hdr-search button{padding:6px 13px;font-size:12.5px;border-radius:' + d.btnRadius + '}' +
      'main{padding:30px 24px 44px;max-width:' + d.maxW + ';width:100%;margin:0 auto;flex:1}' +
      'h1{font:' + d.typo.weight + ' ' + d.typo.h1 + '/1.12 ' + d.typo.head + ';margin:0 0 10px;letter-spacing:' + d.typo.track + '}' +
      'h2{font:' + d.typo.weight + ' 21px/1.25 ' + d.typo.head + ';margin:32px 0 14px;letter-spacing:-.02em}' +
      'h3{font:650 16px/1.35 ' + d.typo.head + ';margin:0 0 5px}' +
      '.lede{color:' + d.mute + ';margin:0 0 18px;font-size:16px;max-width:66ch}' +
      '.hero{background:' + d.panel + ';border:1px solid ' + d.line + ';border-radius:' + d.cardRadius + ';padding:28px 30px;margin-bottom:26px;box-shadow:0 12px 34px rgba(0,0,0,' + (d.isDark ? '.24' : '.05') + ')}' +
      '.hero-split{display:grid;grid-template-columns:1.18fr .92fr;gap:26px;align-items:center}@media(max-width:780px){.hero-split{grid-template-columns:1fr}}' +
      '.hero-centered{text-align:center;padding:42px 28px;background:radial-gradient(620px 260px at 50% 0%,' + d.accentSoft + ',transparent 72%),' + d.panel + '}' +
      '.hero-centered .lede{margin-left:auto;margin-right:auto}.hero-centered .hero-row{justify-content:center}' +
      '.hero-gradient{background:linear-gradient(125deg,hsl(' + d.hue + ',62%,' + (d.isDark ? '24%' : '30%') + '),hsl(' + d.hue2 + ',56%,' + (d.isDark ? '16%' : '20%') + '));color:#ffffff;border:0;padding:34px 32px}' +
      '.hero-gradient .lede,.hero-gradient .mute{color:rgba(255,255,255,0.84)}.hero-gradient .badge{background:rgba(255,255,255,0.16);color:#ffffff;border-color:rgba(255,255,255,0.28)}' +
      '.hero-gradient .btn{background:#ffffff;color:#0f172a}.hero-gradient .btn-ghost{background:rgba(255,255,255,0.14);color:#ffffff;border-color:rgba(255,255,255,0.28)}' +
      '.hero-bento{display:grid;grid-template-columns:7fr 5fr;gap:14px;margin-bottom:26px}@media(max-width:780px){.hero-bento{grid-template-columns:1fr}}' +
      '.hero-minimal{background:transparent;border:0;border-left:4px solid ' + d.accent + ';border-radius:0;padding:10px 0 10px 24px;box-shadow:none;margin-bottom:26px}' +
      '.kpi-strip{display:grid;grid-template-columns:repeat(3,1fr);gap:12px;margin-top:20px;padding-top:18px;border-top:1px solid ' + d.line + '}' +
      '.hero-gradient .kpi-strip{border-top-color:rgba(255,255,255,0.2)}.kpi b{display:block;font:800 18px/1.2 ' + d.typo.head + '}.kpi small{font-size:12px;color:' + d.mute + '}.hero-gradient .kpi small{color:rgba(255,255,255,0.78)}' +
      '.art-svg{width:100%;height:auto;display:block;border-radius:14px;box-shadow:0 12px 30px rgba(0,0,0,' + (d.isDark ? '.32' : '.12') + ')}' +
      '.thumb-svg{width:100%;height:112px;display:block;border-radius:10px;margin-bottom:12px;object-fit:cover}' +
      '.hero-row{display:flex;gap:11px;align-items:center;flex-wrap:wrap;margin-top:16px}' +
      '.btn{display:inline-flex;align-items:center;gap:6px;background:' + d.accent + ';color:' + d.btnInk + ';padding:9px 18px;border-radius:' + d.btnRadius + ';font-weight:650;font-size:13.5px;text-decoration:none;transition:transform .12s,opacity .15s}.btn:hover{opacity:.92;transform:translateY(-1px);text-decoration:none}' +
      '.btn-ghost{display:inline-flex;align-items:center;gap:6px;border:1px solid ' + d.line + ';color:' + d.ink + ';background:' + d.panel2 + ';padding:9px 16px;border-radius:' + d.btnRadius + ';font-weight:600;font-size:13.5px;text-decoration:none}.btn-ghost:hover{border-color:' + d.accent + ';text-decoration:none}' +
      '.grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(225px,1fr));gap:15px}' +
      '.grid-2{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:16px}@media(max-width:680px){.grid-2{grid-template-columns:1fr}}' +
      '.grid-bento{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:15px}.grid-bento .card:first-child{grid-column:span 2}@media(max-width:740px){.grid-bento{grid-template-columns:1fr}.grid-bento .card:first-child{grid-column:span 1}}' +
      '.list-rows{display:grid;gap:12px}.row-card{display:grid;grid-template-columns:148px 1fr auto;gap:16px;align-items:center}@media(max-width:640px){.row-card{grid-template-columns:1fr}}' +
      '.row-card .thumb-svg{height:84px;margin:0}' +
      '.cols2{display:grid;grid-template-columns:2fr 1fr;gap:22px}@media(max-width:760px){.cols2{grid-template-columns:1fr}}' +
      '.cols2-rev{display:grid;grid-template-columns:1fr 2fr;gap:22px}@media(max-width:760px){.cols2-rev{grid-template-columns:1fr}}' +
      '.card{' + cardCss + ';transition:transform .16s,border-color .16s}.card:hover{border-color:' + d.accent + '}' +
      '.card b{display:block;font-size:15px;margin-bottom:3px}.card small,.mute{color:' + d.mute + '}' +
      '.thumb{height:108px;border-radius:10px;margin-bottom:10px;display:flex;align-items:flex-end;padding:8px 10px;color:#fff;font-size:11.5px;font-weight:600;letter-spacing:.03em;overflow:hidden}' +
      '.stars{color:#f59e0b;font-size:12.5px;letter-spacing:1px}' +
      '.price{font:750 17px/1.2 ' + d.typo.head + ';margin:7px 0;color:' + d.ink + '}' +
      '.badge{display:inline-block;padding:3px 10px;border-radius:' + d.btnRadius + ';font-size:11px;font-weight:700;letter-spacing:.05em;text-transform:uppercase;background:' + d.accentSoft + ';color:' + d.accent + ';border:1px solid ' + d.line + (d.typo.monoTags ? ';font-family:Consolas,monospace' : '') + '}' +
      '.avatar{display:inline-grid;place-items:center;width:32px;height:32px;border-radius:50%;background:linear-gradient(135deg,' + d.accent + ',' + d.accent2 + ');color:' + d.btnInk + ';font-size:11.5px;font-weight:800;flex:none}' +
      'table{width:100%;border-collapse:collapse;font-size:13.5px;background:' + d.panel + ';border:1px solid ' + d.line + ';border-radius:' + d.cardRadius + ';overflow:hidden}td,th{text-align:left;padding:10px 13px;border-bottom:1px solid ' + d.line + '}th{background:' + d.panel2 + ';font-size:11.5px;text-transform:uppercase;letter-spacing:.05em;color:' + d.mute + '}' +
      'code,pre{font-family:Consolas,"Cascadia Mono",monospace;font-size:12.5px;background:' + d.codeBg + ';border:1px solid ' + d.line + ';border-radius:8px;padding:2px 6px;color:' + d.codeInk + '}pre{padding:14px;overflow:auto;white-space:pre-wrap}' +
      'input,button,textarea,select{font:inherit;background:' + d.panel + ';color:' + d.ink + ';border:1px solid ' + d.line + ';border-radius:' + d.btnRadius + ';padding:8px 12px}' +
      'button{background:' + d.accent + ';color:' + d.btnInk + ';border:0;font-weight:650;cursor:pointer}' +
      'form{display:grid;gap:10px;max-width:440px}' +
      'footer{padding:30px 24px;font-size:13px;margin-top:42px;' + footerCss + '}' + footerLinkCss +
      '.foot-grid{max-width:' + d.maxW + ';margin:0 auto;display:grid;gap:8px}' +
      '.foot-cols{max-width:' + d.maxW + ';margin:0 auto;display:grid;grid-template-columns:2fr 1fr 1fr 1fr;gap:22px}@media(max-width:720px){.foot-cols{grid-template-columns:1fr 1fr}}' +
      '.foot-cols b{display:block;margin-bottom:8px;font-size:13px}.foot-cols a{display:block;margin:4px 0;font-size:13px}' +
      '.foot-bottom{max-width:' + d.maxW + ';margin:20px auto 0;padding-top:14px;border-top:1px solid rgba(148,163,184,0.22);font-size:12px;opacity:.75}' +
      '.foot-center{max-width:' + d.maxW + ';margin:0 auto;text-align:center}.foot-links{display:flex;gap:10px;justify-content:center;flex-wrap:wrap}' +
      '.hi-grid{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:13px;margin:18px 0 26px}@media(max-width:820px){.hi-grid{grid-template-columns:repeat(2,minmax(0,1fr))}}@media(max-width:480px){.hi-grid{grid-template-columns:1fr}}' +
      '.hi-card{padding:15px;border-radius:' + d.cardRadius + ';border:1px solid ' + d.line + ';background:' + d.panel + '}' +
      '.hi-ic{display:inline-grid;place-items:center;width:34px;height:34px;border-radius:10px;background:' + d.accentSoft + ';color:' + d.accent + ';font-size:16px;margin-bottom:8px}' +
      '.gallery-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:14px}@media(max-width:720px){.gallery-grid{grid-template-columns:repeat(2,minmax(0,1fr))}}@media(max-width:480px){.gallery-grid{grid-template-columns:1fr}}' +
      '.tl-list{display:grid;gap:10px}.tl-row{display:grid;grid-template-columns:86px 1fr;gap:12px;padding:12px 14px;border-left:3px solid ' + d.accent + ';background:' + d.panel + ';border-radius:0 ' + d.cardRadius + ' ' + d.cardRadius + ' 0;border-top:1px solid ' + d.line + ';border-right:1px solid ' + d.line + ';border-bottom:1px solid ' + d.line + '}' +
      '.faq-list{display:grid;gap:9px}.faq-list details{border:1px solid ' + d.line + ';border-radius:' + d.cardRadius + ';background:' + d.panel + ';padding:12px 15px}' +
      '.faq-list summary{cursor:pointer;font-weight:650;list-style:none;display:flex;justify-content:space-between;align-items:center;gap:10px}.faq-list summary::after{content:"+";color:' + d.accent + ';font-weight:800;font-size:16px}.faq-list details[open] summary::after{content:"−"}.faq-list details p{margin:9px 0 0;color:' + d.mute + ';font-size:14px}' +
      '.web-net{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:12px}@media(max-width:760px){.web-net{grid-template-columns:repeat(2,minmax(0,1fr))}}@media(max-width:480px){.web-net{grid-template-columns:1fr}}' +
      '.web-card{display:flex;flex-direction:column;gap:5px;padding:14px;border:1px solid ' + d.line + ';border-radius:' + d.cardRadius + ';background:' + d.panel + ';text-decoration:none;color:' + d.ink + '}.web-card:hover{border-color:' + d.accent + ';transform:translateY(-1px);text-decoration:none}' +
      '.callout{border:1px solid ' + d.line + ';border-left:4px solid ' + d.accent + ';border-radius:' + d.cardRadius + ';background:' + d.panel2 + ';padding:15px 18px;margin:16px 0}' +
      '.meta-row{display:flex;gap:10px;align-items:center;flex-wrap:wrap;font-size:12.5px;color:' + d.mute + ';margin:6px 0}' +
      '.pill{display:inline-block;border:1px solid ' + d.line + ';border-radius:999px;padding:4px 11px;font-size:12px;color:' + d.ink + ';background:' + d.panel + ';text-decoration:none}.pill:hover{border-color:' + d.accent + ';text-decoration:none}' +
      '</style></head><body>' +
      (d.banner ? '<div class="topbar"><span>' + esc(d.banner) + '</span><span>' + esc(site.host) + '</span></div>' : '') +
      headerHtml + '<main>' + inner + '</main>' +
      '<footer>' + footHtml + '</footer>' +
      BRIDGE_SCRIPT + '</body></html>';
  }

  /* Categories with their own kind of page: status boards, docs, galleries, forums, wikis, classifieds, forecasts,
     government notices, leak archives, conspiracy dossiers, video, episodes, menus, timetables, reports, directory
     listings, auctions, job boards, radio schedules, departure boards and public chat. */
  function layoutBlock(site) { return blockFor(site, site.cat.layout); }

  function blockFor(site, L) {
    if (L === 'status') {
      const rows = site.items.slice(0, 5).map(i => '<tr><td>' + esc(i.name) + '</td><td>' +
        pick(['Operational', 'Operational', 'Operational', 'Degraded', 'Under maintenance']) + '</td><td>' +
        (99 + Math.random()).toFixed(2) + '%</td></tr>').join('');
      return '<h2>Service status</h2><table><tr><th>Service</th><th>State</th><th>30-day uptime</th></tr>' + rows + '</table>' +
        '<p class="lede">Last incident ' + ago(Date.now() - int(1, 40) * 86400000) + ' · ' + int(3, 90) +
        ' minutes · <a href="/status">Full history</a></p>';
    }
    if (L === 'docs') {
      return '<h2>Documentation</h2><div class="grid">' + site.items.slice(0, 4).map(i =>
        '<div class="card"><b>Quickstart: ' + esc(i.name) + '</b><small>' + int(2, 30) + ' minute read</small></div>').join('') + '</div>' +
        '<h2>Your first request</h2><pre>curl -H "Authorization: Bearer ' + esc(site.apiKey) + '" \\\n  https://api.' + esc(site.host) +
        '/v1/' + esc(pick(['status', 'items', 'search'])) + '</pre>' +
        '<p><small>SDKs for JavaScript, Python, Go and Ruby · <a href="/docs">All reference pages</a></small></p>';
    }
    if (L === 'gallery') {
      const shots = site.items.slice(0, 6).map((i, n) =>
        '<div class="card" style="padding:0;overflow:hidden"><a href="/item/' + (n + 1) + '" style="text-decoration:none">' +
        cardArtSvg(site, n, i.name) + '</a><div style="padding:10px 14px 14px"><b><a href="/item/' + (n + 1) + '">' + esc(i.name) +
        '</a></b><br><small>' + ago(Date.now() - int(1, 500) * 86400000) + '</small></div></div>').join('');
      return '<h2>' + esc(site.cat.routeLabel) + '</h2><div class="grid">' + shots + '</div>';
    }
    if (L === 'forum') {
      return '<h2>Recent threads</h2><table><tr><th>Thread</th><th>Replies</th><th>Last post</th></tr>' + site.posts.map((p, idx) =>
        '<tr><td><a href="/thread/' + (idx + 1) + '">' + esc(p.title) + '</a><br><small>started by ' + esc(p.author) + '</small></td><td>' +
        int(0, 240) + '</td><td>' + ago(p.at) + '</td></tr>').join('') + '</table><p><a href="/thread/1">Open top thread</a></p>';
    }
    if (L === 'wiki') {
      return '<h2>Recently edited</h2><ul>' + site.items.map(i => '<li><a href="/wiki">' + esc(i.name) + '</a> — edited ' +
        ago(Date.now() - int(1, 400) * 86400000) + ' by ' + esc(pick(site.users).name) + '</li>').join('') + '</ul>' +
        '<h2>Search</h2><form action="/search" method="get"><input name="q" placeholder="Search ' + int(800, 9000) +
        ' articles"><button>Search</button></form>';
    }
    if (L === 'classifieds') {
      return '<h2>Latest ads</h2><div class="grid">' + site.items.map(i => '<div class="card"><b>' + esc(i.name) +
        '</b><small>' + money(i.price) + ' · ' + pick(['today', 'yesterday', '3 days ago', 'last week']) + '</small><p><small>' +
        esc(pick(['Collection only.', 'Can deliver locally.', 'Cash on collection.', 'No offers, please.', 'Sensible offers considered.'])) +
        '</small></p></div>').join('') + '</div>';
    }
    if (L === 'forecast') {
      const days = Array.from({ length: 5 }, (_, n) => new Date(Date.now() + n * 86400000).toLocaleDateString([], { weekday: 'short' }));
      return '<h2>Five day forecast</h2><table><tr><th>Day</th><th>Conditions</th><th>High</th><th>Low</th></tr>' + days.map(day =>
        '<tr><td>' + esc(day) + '</td><td>' + esc(pick(['Overcast', 'Light rain', 'Sunny spells', 'Windy', 'Fog then bright', 'Heavy showers'])) +
        '</td><td>' + int(8, 24) + '°</td><td>' + int(1, 12) + '°</td></tr>').join('') + '</table>' +
        '<p><small>Updated by hand every morning, occasionally at lunchtime.</small></p>';
    }
    if (L === 'gov') {
      return '<h2>Notices</h2><table><tr><th>Date</th><th>Notice</th><th>Status</th></tr>' +
        ['Consultation opened', 'Consultation closed', 'Decision published', 'Appeal lodged', 'Inquiry announced'].map(n =>
          '<tr><td>' + ago(Date.now() - int(2, 240) * 86400000) + '</td><td><a href="/documents">' + n + ' on ' +
          pick(['the ring road', 'site 14', 'the harbour scheme', 'the procurement waiver', 'the data-sharing deal']) +
          '</a></td><td>' + pick(['Open', 'Closed', 'Withdrawn', 'Under review']) + '</td></tr>').join('') + '</table>' +
        '<h2>Freedom of information</h2><p class="lede">' + int(40, 900) + ' requests this quarter · ' + int(1, 40) +
        ' refused in full · ' + int(2, 30) + ' answered late.</p>' + secretBlock(site);
    }
    if (L === 'leaks') {
      return '<h2>Latest releases</h2>' + site.posts.map(p => '<div class="card" style="margin-bottom:8px"><b><a href="/documents">' +
        esc(p.title) + '</a></b><small>' + esc(p.author) + ' · ' + ago(p.at) + ' · ' + int(20, 4000) + ' downloads</small><p>' +
        esc(p.body) + '</p></div>').join('') +
        '<h2>Submit a document</h2><p class="lede">Anonymised, stripped of metadata, checked by two people.</p>' +
        '<form action="/documents" method="get"><input name="q" placeholder="Describe what you have">' +
        '<button>Send securely</button></form>' + secretBlock(site);
    }
    if (L === 'conspiracy') {
      return '<h2>What they are not telling you</h2>' + site.posts.map(p => '<div class="card" style="margin-bottom:8px"><b>' +
        esc(p.title) + '</b><small>' + int(3, 900) + ' comments · ' +
        pick(['evidence thread', 'mirror inside', 'video attached', 'saved copy']) + '</small><p>' + esc(p.body) + '</p></div>').join('') +
        '<h2>Archived evidence</h2><table><tr><th>File</th><th>Claim</th><th>Status</th></tr>' +
        ['audio recording', 'photograph', 'flight log', 'internal email', 'hand-drawn map'].map(f =>
          '<tr><td><a href="/documents">' + f + ' ' + int(2, 40) + '.dat</a></td><td>' +
          esc(pick(['proves everything', 'denied by the ministry', 'never explained', 'quietly deleted'])) +
          '</td><td>' + pick(['unverified', 'redacted', 'mirrored']) + '</td></tr>').join('') + '</table>' + secretBlock(site);
    }
    if (L === 'video') {
      return '<h2>Latest uploads</h2><div class="grid">' + site.items.slice(0, 6).map((i, n) =>
        '<div class="card" style="padding:0;overflow:hidden"><div style="height:84px;background:linear-gradient(' + (n * 47 % 360) +
        'deg,' + site.accent + ',#0d1117);display:grid;place-items:center;font-size:22px">▶</div><div style="padding:8px 10px"><b>' +
        esc(i.name) + '</b><br><small>' + int(2, 90) + ':' + String(int(10, 59)) + ' · ' + int(120, 900000) + ' views · ' +
        ago(Date.now() - int(1, 400) * 86400000) + '</small></div></div>').join('') + '</div>';
    }
    if (L === 'episodes') {
      return '<h2>Episodes</h2><table><tr><th>#</th><th>Episode</th><th>Length</th><th>Published</th></tr>' + site.items.map((i, n) =>
        '<tr><td>' + (n + 1) + '</td><td><a href="/episodes">' + esc(i.name) + '</a></td><td>' + int(18, 96) +
        ' min</td><td>' + ago(Date.now() - int(1, 500) * 86400000) + '</td></tr>').join('') + '</table>';
    }
    if (L === 'menu') {
      return ['Starters', 'Mains', 'Puddings', 'Drinks'].map((section, n) => '<h2>' + section + '</h2><table>' +
        site.items.slice(n * 2, n * 2 + 2).map(i => '<tr><td>' + esc(i.name) + '<br><small>' +
          esc(pick(['vegetarian', 'contains nuts', 'very hot', 'house favourite', 'vegan on request', 'no substitutions'])) +
          '</small></td><td style="text-align:right">' + money(i.price) + '</td></tr>').join('') + '</table>').join('');
    }
    if (L === 'timetable') {
      return '<h2>Timetable</h2><table><tr><th>Stop</th><th>Weekday</th><th>Saturday</th><th>Sunday</th></tr>' +
        ['Central', 'Harbour', 'Mill Lane', 'The Green', 'Station'].map(stop => '<tr><td>' + stop + '</td><td>' +
          String(int(5, 9)).padStart(2, '0') + ':' + pick(['05', '15', '30', '45']) + ' · every ' + int(10, 40) +
          ' min</td><td>' + int(1, 6) + ' an hour</td><td>' + pick(['No service', 'Two services', 'Hourly']) +
          '</td></tr>').join('') + '</table><p><small>Times are indicative. The operator is not responsible for weather, roadworks or optimism.</small></p>';
    }
    if (L === 'report') {
      const bars = site.items.slice(0, 5).map(i => {
        const pct = int(15, 100);
        return '<tr><td>' + esc(i.name) + '</td><td><div style="height:10px;border-radius:5px;background:' + site.accent +
          ';width:' + pct + '%"></div></td><td>' + pct + '%</td></tr>';
      }).join('');
      return '<h2>This year in numbers</h2><table>' + bars + '</table><p class="lede">Income ' +
        money((int(2, 90) * 1000).toFixed(0)) + ' · spending ' + money((int(2, 90) * 1000).toFixed(0)) + ' · reserves ' +
        money((int(1, 30) * 1000).toFixed(0)) + '.</p><p><a href="/documents">Download the full report (PDF, ' + int(20, 300) + ' pages)</a></p>';
    }
    if (L === 'files') {
      return '<h2>Index of /</h2><table><tr><th>Name</th><th>Size</th><th>Modified</th></tr>' +
        ['index.html', 'README.txt', 'backup-2019.tar.gz', '.env', 'config.php', 'notes.md', 'dump.sql', 'old-site.zip'].map(f =>
          '<tr><td><a href="/documents">' + f + '</a></td><td>' + int(1, 900) + 'K</td><td>' +
          ago(Date.now() - int(2, 2000) * 86400000) + '</td></tr>').join('') +
        '</table><p><small>Directory listing generated by the web server, not by a page.</small></p>';
    }
    if (L === 'auction') {
      return '<h2>Live lots</h2><table><tr><th>Lot</th><th>Current bid</th><th>Bids</th><th>Closes</th></tr>' + site.items.map(i =>
        '<tr><td><a href="/auction">' + esc(i.name) + '</a><br><small>' +
        esc(pick(['provenance', 'working order', 'as seen', 'boxed, unused'])) + '</small></td><td>' + money(i.price) +
        '</td><td>' + int(1, 40) + '</td><td>' + int(1, 6) + ' days</td></tr>').join('') + '</table>';
    }
    if (L === 'jobs') {
      return '<h2>Open roles</h2><table><tr><th>Role</th><th>Compensation</th><th>Type</th></tr>' + site.items.map((i, idx) =>
        '<tr><td><a href="/item/' + (idx + 1) + '">' + esc(i.name) + '</a></td><td>$' + (22 + ((idx * 7 + site.id) % 48)) + '/hr</td><td>' +
        esc(pick(['full time', 'part time', 'weekends', 'nights', 'fixed term'])) + '</td></tr>').join('') +
        '</table><p><small>Every advert states the pay band up front.</small></p>';
    }
    if (L === 'radio') {
      return '<h2>Schedule</h2><table><tr><th>Time</th><th>Show</th><th>Presenter</th></tr>' +
        ['06:00', '09:00', '12:00', '15:00', '18:00', '21:00'].map(t => '<tr><td>' + t + '</td><td><a href="/radio">' +
          esc(pick(['Breakfast', 'The morning phone-in', 'Lunchtime requests', 'Local history hour', 'Drive', 'The late show'])) +
          '</a></td><td>' + esc(pick(site.users).name) + '</td></tr>').join('') +
        '</table><p><a href="/radio">Listen live</a> · <a href="/episodes">Archive</a></p>';
    }
    if (L === 'flights') {
      return '<h2>Departures</h2><table><tr><th>Time</th><th>Flight</th><th>Destination</th><th>Status</th></tr>' +
        Array.from({ length: 6 }, () => '<tr><td>' + String(int(6, 21)).padStart(2, '0') + ':' + pick(['05', '20', '35', '50']) +
          '</td><td>' + pick(['MS', 'QR', 'BA', 'LH', 'AF']) + int(100, 999) + '</td><td>' +
          esc(pick(['Amsterdam', 'Dublin', 'Lisbon', 'Oslo', 'Prague', 'Rome', 'Vienna'])) + '</td><td>' +
          esc(pick(['On time', 'Delayed 25 min', 'Boarding', 'Gate closed', 'Cancelled'])) + '</td></tr>').join('') + '</table>';
    }
    if (L === 'chat') {
      return '<h2>Recent messages</h2>' + site.posts.map(p => '<div class="card" style="margin-bottom:6px"><b>' +
        esc(p.author) + '</b><small>' + new Date(p.at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) +
        '</small><p>' + esc(p.body) + '</p></div>').join('');
    }
    return '';
  }

  /* The juicy part: published documents, a memo that was not meant to be published, and the details that get you in. */
  function secretBlock(site) {
    const codename = pick(['NORTHGATE', 'LANTERN', 'HOLLOW REED', 'PALE HORSE', 'MORNING STAR', 'TIN ROOF', 'SALT MARSH', 'QUIET HOUR']);
    const docs = [
      ['Project ' + codename + ' — phase ' + pick(['one', 'two', 'three']), pick(['Restricted', 'Secret', 'Official — Sensitive', 'Not for circulation'])],
      ['Minutes of the ' + pick(['steering', 'risk', 'oversight', 'emergency']) + ' meeting', pick(['Redacted', 'Partly released', 'Classified'])],
      ['Site ' + int(2, 40) + ' incident report', pick(['Restricted', 'Internal only'])],
      ['Annex ' + pick(['B', 'C', 'D', 'F']) + ': ' + pick(['costs', 'staffing', 'contingency', 'public messaging']), pick(['Redacted', 'Withheld'])],
      ['Contract ' + int(1000, 9999) + ' — ' + pick(['cleaning', 'security', 'consultancy', 'software']), pick(['Published', 'Redacted'])]
    ];
    return '<h2>Published documents</h2><table><tr><th>Document</th><th>Classification</th></tr>' + docs.map(([t, c]) =>
      '<tr><td><a href="/documents">' + esc(t) + '</a></td><td>' + esc(c) + '</td></tr>').join('') + '</table>' +
      '<h2>Internal memo (released after an appeal)</h2><pre>' + esc(
        'From: ' + pick(site.users).name + '\nTo: ' + pick(['the board', 'all staff', 'site leads', 'the press office']) +
        '\nSubject: ' + pick(['the migration', 'what to say and what not to say', 'the missing ' + int(20, 900) + ' pages',
          'deleting the old backups']) + '\nPriority: ' + pick(['high', 'routine', 'urgent — do not forward']) + '\n\n' +
        pick(['Nobody is to discuss the figures until the review reports. If asked, refer to the published summary.',
          'The old backups are still live. Do not delete them until the archive team confirms.',
          'The contractor has been told to stop. That is all we can put in writing.',
          'Press will ask about the cost. The answer is on page four and nowhere else.']) +
        '\n\nTemporary access: ' + (site.adminPath || '/staff') + '\nAPI key: ' + (site.apiKey || site.token) +
        '\nDo not share this memo.'
      ) + '</pre>';
  }

  /* A defaced home page: whoever reached the staff content form saved their own headline, and visitors see it.
     It is stored on the site itself, so it survives passing through the browser and the walkthrough alike. */
  const defacedBlock = site => site.content
    ? '<div style="border:2px solid #f87171;border-radius:12px;background:#2a1116;padding:14px 18px;margin-bottom:18px">' +
      '<b style="color:#fca5a5;letter-spacing:.15em;font-size:11px">SITE DEFACED · TRAINING TARGET</b>' +
      '<h1 style="margin:6px 0 5px;color:#fee2e2">' + esc(site.content.headline) + '</h1>' +
      '<p style="margin:0;color:#fca5a5">' + esc(site.content.message) + '</p>' +
      '<p style="margin:9px 0 0;color:#94a3b8;font-size:12px">Saved signed in as ' + esc(site.content.by || 'admin') +
      ' · ' + ago(site.content.at) + ' · this site is fictional and lives inside Moundshroud.</p></div>'
    : '';
  const thumbBg = (site, n) => {
    const d = siteDesign(site);
    const h1 = (d.hue + (n * 33)) % 360;
    const h2 = (d.hue2 + (n * 19)) % 360;
    return 'linear-gradient(135deg,hsl(' + h1 + ',60%,34%),hsl(' + h2 + ',56%,20%))';
  };
  const starsHtml = r => '<span class="stars">★★★★' + (Number(r) >= 4.5 ? '★' : '☆') + '</span> <small>' + esc(r || '4.6') + '</small>';

  function kpiHtml(d) {
    return '<div class="kpi-strip">' + (d.metrics || []).map(([v, l]) =>
      '<div class="kpi"><b>' + esc(v) + '</b><small>' + esc(l) + '</small></div>').join('') + '</div>';
  }

  function renderHero(site, cfg) {
    const d = siteDesign(site);
    const hs = cfg.forceStyle || d.heroStyle;
    const badge = '<span class="badge">' + esc(cfg.badge) + '</span>';
    const titleHtml = cfg.titleHref
      ? '<h1 style="margin-top:10px"><a href="' + cfg.titleHref + '" style="color:inherit">' + esc(cfg.title) + '</a></h1>'
      : '<h1 style="margin-top:10px">' + esc(cfg.title) + '</h1>';
    const ledeHtml = '<p class="lede">' + esc(cfg.lede) + '</p>' + (cfg.extra || '');
    const ctas = '<div class="hero-row">' + cfg.ctas + '</div>';
    const art = heroArtSvg(site, d);

    if (hs === 'split-art') {
      return '<section class="hero hero-split"><div>' + badge + titleHtml + ledeHtml + ctas + kpiHtml(d) + '</div><div>' + art + '</div></section>';
    }
    if (hs === 'centered-mesh') {
      return '<section class="hero hero-centered">' + badge + titleHtml + ledeHtml + ctas +
        '<div style="max-width:640px;margin:24px auto 0">' + art + '</div>' + kpiHtml(d) + '</section>';
    }
    if (hs === 'gradient-banner') {
      return '<section class="hero hero-gradient hero-split"><div>' + badge + titleHtml + ledeHtml + ctas + kpiHtml(d) + '</div><div>' + art + '</div></section>';
    }
    if (hs === 'bento-top') {
      const top2 = site.items.slice(0, 2);
      const market = isMarketSite(site);
      return '<section class="hero-bento">' +
        '<div class="hero" style="margin:0">' + badge + titleHtml + ledeHtml + ctas + '</div>' +
        '<div style="display:grid;gap:14px">' + art +
        '<div style="display:grid;grid-template-columns:1fr 1fr;gap:12px">' +
        top2.map((it, i) => '<div class="card" style="padding:13px"><small>' + esc(d.metrics[i] ? d.metrics[i][1] : site.cat.label) + '</small>' +
          '<b style="margin-top:4px"><a href="/item/' + (i + 1) + '">' + esc(it.name) + '</a></b><small>' + (market && it.price ? money(it.price) : esc(it.leadTime || it.badge || site.cat.label)) + '</small></div>').join('') +
        '</div></div></section>';
    }
    if (hs === 'editorial-split') {
      return '<section class="hero hero-split"><div>' + art + '</div><div>' + badge + titleHtml + ledeHtml + ctas + '</div></section>';
    }
    /* minimal-stripe */
    return '<section class="hero hero-minimal"><div class="hero-split"><div>' + badge + titleHtml + ledeHtml + ctas + '</div>' +
      '<div class="card">' + art + '<div style="margin-top:12px">' + kpiHtml(d) + '</div></div></div></section>';
  }

  function renderCommerceItems(site) {
    const d = siteDesign(site), c = site.cat;
    if (d.gridMode === 'list-modern') {
      return '<div class="list-rows">' + site.items.map((it, idx) =>
        '<div class="card row-card"><a href="/item/' + (idx + 1) + '">' + cardArtSvg(site, idx, c.label) + '</a>' +
        '<div><b><a href="/item/' + (idx + 1) + '">' + esc(it.name) + '</a></b>' +
        '<div>' + starsHtml(it.rating) + ' <small>(' + (it.reviews || 24) + ')</small></div>' +
        '<small>' + esc(it.desc) + '</small></div>' +
        '<div style="text-align:right"><div class="price">' + money(it.price) + '</div>' +
        '<a class="btn" style="padding:6px 12px;font-size:12px" href="/cart?add=' + (idx + 1) + '">Add to cart</a></div></div>').join('') + '</div>';
    }
    const cls = d.gridMode === 'cards-2' ? 'grid-2' : d.gridMode === 'bento-asym' ? 'grid-bento' : 'grid';
    return '<div class="' + cls + '">' + site.items.map((it, idx) =>
      '<div class="card"><a href="/item/' + (idx + 1) + '" style="text-decoration:none">' + cardArtSvg(site, idx, c.label) + '</a>' +
      '<b><a href="/item/' + (idx + 1) + '">' + esc(it.name) + '</a></b>' +
      '<div>' + starsHtml(it.rating) + ' <small>(' + (it.reviews || 24) + ')</small></div>' +
      '<div class="price">' + money(it.price) + '</div>' +
      '<div style="display:flex;gap:10px;align-items:center;margin-top:9px"><a class="btn" style="padding:6px 12px;font-size:12px" href="/cart?add=' + (idx + 1) + '">Add to cart</a>' +
      '<a class="mute" style="font-size:12px" href="/item/' + (idx + 1) + '">Details →</a></div></div>').join('') + '</div>';
  }

  function highlightsBand(site) {
    const c = site.cat, topic = site.topic || c.label;
    const cards = [
      [c.icon || '✦', cap(topic.split(/\s+/).slice(0, 3).join(' ')), 'Dedicated ' + c.label.toLowerCase() + ' coverage, live listings, and direct ' + site.region + ' operations.'],
      ['⚡', 'Real-Time Updates', 'Catalogues, schedules, and dispatches updated daily with verified timestamps and open logs.'],
      ['🧭', 'Full Directory & Search', site.items.length + ' curated ' + c.routeLabel.toLowerCase() + ' and ' + site.posts.length + ' long-form reports indexed on-site.'],
      ['🌐', 'Connected Ecosystem', 'Directly linked to partner networks, reference hubs, and regional services across the web.']
    ];
    return '<section class="hi-grid">' + cards.map(([ic, t, desc]) =>
      '<div class="hi-card"><div class="hi-ic">' + ic + '</div><b>' + esc(t) + '</b><small>' + esc(desc) + '</small></div>').join('') + '</section>';
  }

  function spotlightGallery(site) {
    const c = site.cat, market = isMarketSite(site);
    return '<h2>Visual Spotlight &amp; Highlights</h2><div class="gallery-grid">' +
      site.items.slice(0, 6).map((it, idx) =>
        '<div class="card" style="padding:0;overflow:hidden"><a href="/item/' + (idx + 1) + '" style="text-decoration:none">' +
        cardArtSvg(site, idx + 3, it.badge + ' · ' + c.label) + '</a><div style="padding:12px 14px">' +
        '<span class="badge">' + esc(it.badge || c.label) + '</span>' +
        '<b style="margin-top:6px"><a href="/item/' + (idx + 1) + '">' + esc(it.name) + '</a></b>' +
        '<small>' + esc(it.leadTime || site.region) + (market && it.price ? ' · ' + money(it.price) : ' · ' + esc(site.region)) + '</small></div></div>').join('') + '</div>';
  }

  function comparisonMatrix(site) {
    const c = site.cat, market = isMarketSite(site), fam = site.theme || themeFamilyFor(site);
    if (market) {
      return '<h2>' + esc(site.brand) + ' — Specifications &amp; Comparison Matrix</h2>' +
        '<table><tr><th>Offering</th><th>Category / Tier</th><th>Availability</th><th>Rating</th><th>Price</th><th></th></tr>' +
        site.items.slice(0, 6).map((it, idx) =>
          '<tr><td><b><a href="/item/' + (idx + 1) + '">' + esc(it.name) + '</a></b><br><small>' + esc(it.specs ? it.specs[2][1] : c.label) + '</small></td>' +
          '<td><span class="badge">' + esc(it.badge || c.label) + '</span></td>' +
          '<td>' + esc(it.leadTime || (it.stock + ' available')) + '</td>' +
          '<td>' + starsHtml(it.rating) + '</td>' +
          '<td><b>' + money(it.price) + '</b></td>' +
          '<td><a href="/item/' + (idx + 1) + '">Inspect →</a></td></tr>').join('') + '</table>';
    }
    const heading = fam === 'editorial' ? 'Coverage Desk &amp; Reference Index'
      : fam === 'civic' ? 'Public Services &amp; Directory Index'
      : fam === 'community' ? 'Featured Channels, Topics &amp; Highlights'
      : fam === 'saas' ? 'Platform Modules &amp; Technical Specifications'
      : fam === 'finance' ? 'Accounts, Benchmarks &amp; Disclosures'
      : 'Indexed Records &amp; Reference Dossiers';
    return '<h2>' + esc(site.brand) + ' — ' + heading + '</h2>' +
      '<table><tr><th>Entry</th><th>Section</th><th>Status / Updated</th><th>Revision</th><th></th></tr>' +
      site.items.slice(0, 6).map((it, idx) =>
        '<tr><td><b><a href="/item/' + (idx + 1) + '">' + esc(it.name) + '</a></b><br><small>' + esc(it.desc.slice(0, 84)) + '…</small></td>' +
        '<td><span class="badge">' + esc(it.badge || c.label) + '</span></td>' +
        '<td>' + esc(it.leadTime || site.region) + '</td>' +
        '<td><small>' + esc(it.specs && it.specs[2] ? it.specs[2][1] : 'Current') + '</small></td>' +
        '<td><a href="/item/' + (idx + 1) + '">Open →</a></td></tr>').join('') + '</table>';
  }

  function timelineAndReviews(site) {
    const c = site.cat, d = siteDesign(site);
    const months = ['This week', '3 days ago', 'Last week', '2 weeks ago', 'Last month'];
    const tl = '<div><h2>Recent Activity &amp; Milestones</h2><div class="tl-list">' +
      site.posts.slice(0, 5).map((p, i) =>
        '<div class="tl-row"><small class="mute"><b>' + months[i % months.length] + '</b><br>' + ago(p.at) + '</small>' +
        '<div><b><a href="/article/' + (i + 1) + '">' + esc(p.title) + '</a></b>' +
        '<small>' + esc(p.author) + ' (' + esc(p.authorRole || 'Staff') + ') · ' + (p.readMin || 5) + ' min read · ' + (p.views || 1200).toLocaleString() + ' views</small></div></div>').join('') +
      '</div></div>';
    const quotes = [
      'Everything on ' + site.brand + ' is remarkably clear — the ' + c.routeLabel.toLowerCase() + ' breakdown saved our team hours.',
      'Consistently reliable ' + (site.topic || c.label).toLowerCase() + ' updates from ' + site.region + '. Easily my first bookmark every morning.',
      'Transparent specifications, fast responses from the support desk, and zero clutter.'
    ];
    const revs = '<div><h2>Verified Community Feedback</h2><div class="list-rows">' +
      quotes.map((q, i) => {
        const u = site.users[(i + 1) % site.users.length];
        return '<div class="card"><div style="display:flex;gap:10px;align-items:center;margin-bottom:8px">' +
          '<span class="avatar">' + esc(u.name.slice(0, 2).toUpperCase()) + '</span>' +
          '<div><b>' + esc(cap(u.name)) + '</b><small>' + esc(cap(u.role)) + ' · ' + esc(site.region) + '</small></div>' +
          '<span style="margin-left:auto">' + starsHtml((4.6 + (i % 3) * 0.15).toFixed(1)) + '</span></div>' +
          '<p style="margin:0;font-size:13.5px">“' + esc(q) + '”</p></div>';
      }).join('') + '</div></div>';
    return '<section class="' + ((d.seed % 2) ? 'cols2-rev' : 'cols2') + '" style="margin-top:24px">' + ((d.seed % 2) ? revs + tl : tl + revs) + '</section>';
  }

  function faqAndNewsletter(site) {
    const c = site.cat, topic = site.topic || c.label, market = isMarketSite(site);
    const qa = [
      ['What does ' + site.brand + ' cover?', site.brand + ' is an independent ' + c.label.toLowerCase() + ' operating from ' + site.region + ', focused on ' + topic.toLowerCase() + ' with ' + site.items.length + ' listed ' + c.routeLabel.toLowerCase() + ' and ' + site.posts.length + ' published reports.'],
      ['How often are ' + c.routeLabel.toLowerCase() + (market ? ' and prices' : ' and records') + ' updated?', (market ? 'Catalog entries, stock counts, and prices' : 'Entries, records, and schedules') + ' are refreshed continuously from our ' + site.region + ' operations desk.'],
      ['How can I access full records or API data?', 'Structured endpoints are documented under /docs and public announcements are linked under /documents and /about.'],
      ['Do you support regional or international requests?', market ? ('Yes — we operate out of ' + site.region + ' and fulfill digital and regional orders with tracked confirmation numbers.') : ('Yes — our ' + site.region + ' desk handles public inquiries, documentation requests, and regional updates.')],
      ['How do I contact the ' + site.brand + ' team?', 'Use the /contact form or email hello@' + site.host + ' — typical response time is one business day.'],
      ['Where can I discover related sites in this network?', 'Explore the “Across the Web” partner links below or search any topic at https://search.moundshroud.example/.']
    ];
    return '<section class="cols2" style="margin-top:26px"><div><h2>Frequently Asked Questions</h2><div class="faq-list">' +
      qa.map(([q, a], idx) => '<details' + (idx === 0 ? ' open' : '') + '><summary>' + esc(q) + '</summary><p>' + esc(a) + '</p></details>').join('') +
      '</div></div><aside><div class="card"><h3>Stay Updated with ' + esc(site.brand) + '</h3>' +
      '<p class="mute" style="font-size:13.5px">Receive weekly ' + esc(topic.toLowerCase()) + ' briefings, release schedules, and ' + esc(site.region) + ' dispatches.</p>' +
      '<form action="/contact" method="post"><input name="name" placeholder="Your name"><input name="email" placeholder="you@domain.com">' +
      '<button type="submit">Subscribe to Digest</button></form>' +
      '<div class="meta-row" style="margin-top:12px"><a href="/team">Meet our team →</a> · <a href="/documents">Documents →</a></div></div></aside></section>';
  }

  function webNetworkBand(site) {
    const rel = relatedSitesFor(site);
    if (!rel.length) return '';
    return '<section style="margin-top:30px"><h2>Across the Web · Partners, Citations &amp; Related Sites</h2>' +
      '<p class="lede" style="margin-bottom:14px">Explore connected websites referenced by ' + esc(site.brand) + ' across the Fake Internet.</p>' +
      '<div class="web-net">' + rel.map(r =>
        '<a class="web-card" href="https://' + esc(r.host) + '/">' +
        '<div style="display:flex;align-items:center;gap:8px"><span>' + esc(r.icon) + '</span><b>' + esc(r.brand) + '</b></div>' +
        '<span class="badge" style="align-self:flex-start">' + esc(r.kind) + ' · ' + esc(r.region) + '</span>' +
        '<small>' + esc(r.tagline) + '</small>' +
        '<small style="margin-top:auto;opacity:.75">https://' + esc(r.host) + ' →</small></a>').join('') +
      '</div></section>';
  }

  function richTail(site) {
    return spotlightGallery(site) + comparisonMatrix(site) + timelineAndReviews(site) + faqAndNewsletter(site) + webNetworkBand(site);
  }

  function homeBody(site) {
    const c = site.cat, fam = site.theme || themeFamilyFor(site);
    const d = siteDesign(site);
    const lead = site.posts[0];
    const gridCls = d.gridMode === 'cards-2' ? 'grid-2' : d.gridMode === 'bento-asym' ? 'grid-bento' : 'grid';

    if (fam === 'editorial') {
      const rest = site.posts.slice(1);
      const rev = (d.seed % 2) === 1;
      const feed = '<div><h2>Latest ' + esc(c.label.toLowerCase()) + ' &amp; Long Reads</h2>' +
        rest.map((p, idx) => '<div class="card" style="margin-bottom:14px">' +
          '<div class="meta-row"><span class="badge">' + esc(p.category || site.topic || c.label) + '</span><span>' + (p.readMin || 5) + ' min read</span><span>' + (p.views || 1200).toLocaleString() + ' views</span></div>' +
          '<h3 style="margin-top:6px"><a href="/article/' + (idx + 2) + '">' + esc(p.title) + '</a></h3>' +
          '<small>By ' + esc(p.author) + ' (' + esc(p.authorRole || 'Reporter') + ') · ' + ago(p.at) + ' · ' + p.comments + ' comments</small>' +
          '<p style="margin:8px 0 0">' + esc(p.body) + '</p>' +
          '<p style="margin:8px 0 0"><a href="/article/' + (idx + 2) + '">Continue reading →</a></p></div>').join('') + '</div>';
      const rail = '<aside><div class="card"><h3>Most Read on ' + esc(site.brand) + '</h3>' +
        site.posts.map((p, idx) => '<p style="margin:10px 0;font-size:13.5px"><b>' + (idx + 1) + '.</b> <a href="/article/' + (idx + 1) + '">' + esc(p.title) + '</a><br><small>' + (p.views || 900).toLocaleString() + ' views · ' + (p.readMin || 5) + ' min</small></p>').join('') +
        '</div><div class="card" style="margin-top:14px"><h3>Featured ' + esc(c.routeLabel) + '</h3>' +
        site.items.slice(0, 4).map((it, i) => '<p style="margin:8px 0;font-size:13.5px"><a href="/item/' + (i + 1) + '"><b>' + esc(it.name) + '</b></a><br><small>' + esc(it.leadTime) + '</small></p>').join('') +
        '</div></aside>';
      return defacedBlock(site) +
        renderHero(site, {
          badge: c.label + ' · Featured Cover Story',
          title: lead ? lead.title : site.brand,
          titleHref: '/article/1',
          lede: lead ? lead.body : site.tagline,
          ctas: '<a class="btn" href="/article/1">Read full story →</a>' +
            '<small class="mute">By ' + esc(lead ? lead.author : site.users[0].name) + ' · ' + ago(lead ? lead.at : Date.now()) + ' · ' + (lead ? lead.readMin || 6 : 6) + ' min read · ' + (lead ? lead.comments : 12) + ' comments</small>'
        }) +
        highlightsBand(site) +
        '<div class="' + (rev ? 'cols2-rev' : 'cols2') + '">' + (rev ? rail + feed : feed + rail) + '</div>' +
        layoutBlock(site) + richTail(site);
    }
    if (fam === 'commerce') {
      const cartQty = (site.cart || []).reduce((s, x) => s + (x.qty || 1), 0);
      return defacedBlock(site) +
        renderHero(site, {
          badge: c.label + ' · ' + (site.region || 'Direct'),
          title: site.brand,
          lede: site.tagline,
          ctas: '<a class="btn" href="' + c.route + '">Browse All ' + site.items.length + ' ' + esc(c.routeLabel) + '</a>' +
            '<a class="btn-ghost" href="/cart">View Cart (' + cartQty + ')</a>'
        }) +
        highlightsBand(site) +
        '<h2>Featured ' + esc(c.routeLabel) + ' (' + site.items.length + ' items)</h2>' + renderCommerceItems(site) +
        layoutBlock(site) +
        '<h2>Editorial Guides &amp; Customer Stories</h2><div class="' + (d.gridMode === 'cards-2' ? 'grid-2' : 'grid') + '">' +
        site.posts.slice(0, 6).map((p, idx) => '<div class="card"><span class="badge">' + esc(p.category || 'Story') + '</span><b style="margin-top:6px"><a href="/article/' + (idx + 1) + '">' + esc(p.title) + '</a></b><small>' + esc(p.author) + ' · ' + ago(p.at) + ' · ' + (p.readMin || 5) + ' min</small><p style="margin:6px 0 0;font-size:13.5px">' + esc(p.body.slice(0, 150)) + '…</p></div>').join('') + '</div>' +
        comparisonMatrix(site) + timelineAndReviews(site) + faqAndNewsletter(site) + webNetworkBand(site);
    }
    if (fam === 'finance') {
      const isCrypto = c.id === 'crypto' || c.id === 'markets';
      const quoteVal = idx => (180 + ((site.id * 37 + idx * 149) % 4200) + ((idx * 17) % 99) / 100).toFixed(2);
      const marketSection = d.gridMode === 'bento-asym' || d.gridMode === 'cards-2'
        ? '<div class="' + gridCls + '">' + site.items.map((it, idx) => '<div class="card">' +
            '<span class="badge">' + (isCrypto ? (idx % 2 ? '+3.4% 24h' : '+1.2% 24h') : 'Verified Rate') + '</span>' +
            '<h3 style="margin-top:8px"><a href="/item/' + (idx + 1) + '">' + esc(it.name) + '</a></h3>' +
            '<div class="price">' + (isCrypto ? quoteVal(idx) + ' pts' : (2.1 + idx * 0.35).toFixed(2) + '% APR') + '</div>' +
            '<small>' + esc(it.desc) + '</small><p style="margin:8px 0 0"><a href="/item/' + (idx + 1) + '">Open details →</a></p></div>').join('') + '</div>'
        : '<table><tr><th>' + (isCrypto ? 'Index / Instrument' : 'Account / Product') + '</th><th>' + (isCrypto ? 'Last Quote' : 'Annual Rate') + '</th><th>24h / Status</th><th>Coverage</th><th></th></tr>' +
          site.items.map((it, idx) => '<tr><td><b><a href="/item/' + (idx + 1) + '">' + esc(it.name) + '</a></b></td><td>' +
            (isCrypto ? quoteVal(idx) + ' pts' : (2.1 + idx * 0.35).toFixed(2) + '% APR') +
            '</td><td><span class="badge">' + (isCrypto ? (idx % 2 ? '+3.4%' : '+1.2%') : 'Available') + '</span></td><td><small>' + esc(it.leadTime) + '</small></td><td><a href="/item/' + (idx + 1) + '">Details →</a></td></tr>').join('') + '</table>';
      return defacedBlock(site) +
        renderHero(site, {
          badge: isCrypto ? 'Live Exchange · ' + (site.region || 'Global') : 'Personal & Institutional Banking',
          title: site.brand,
          lede: site.tagline,
          ctas: '<a class="btn" href="/login">' + (isCrypto ? 'Desk / Sign in' : 'Online Banking Sign in') + '</a>' +
            '<a class="btn-ghost" href="' + c.route + '">View ' + esc(c.routeLabel) + '</a>'
        }) +
        highlightsBand(site) +
        '<h2>' + (isCrypto ? 'Live Instruments &amp; Market Benchmarks' : 'Accounts, Rates &amp; Disclosures') + '</h2>' + marketSection +
        layoutBlock(site) +
        '<h2>Market Briefings &amp; Research</h2><div class="' + (d.gridMode === 'list-modern' ? 'list-rows' : 'grid') + '">' +
        site.posts.slice(0, 6).map((p, idx) => '<div class="card"><span class="badge">' + esc(p.category || 'Briefing') + '</span><b style="margin-top:6px"><a href="/article/' + (idx + 1) + '">' + esc(p.title) + '</a></b><small>' + esc(p.author) + ' · ' + ago(p.at) + '</small><p style="margin:6px 0 0">' + esc(p.body) + '</p></div>').join('') + '</div>' +
        richTail(site);
    }
    if (fam === 'saas') {
      return defacedBlock(site) +
        renderHero(site, {
          badge: c.label + ' · ' + (site.topic || 'Platform'),
          title: site.brand,
          lede: site.tagline,
          ctas: '<a class="btn" href="/login">Sign in to Console</a><a class="btn-ghost" href="/docs">Read API Docs</a><a class="btn-ghost" href="/status">System Status</a>'
        }) +
        highlightsBand(site) +
        '<h2>Modules, Services &amp; Capabilities (' + site.items.length + ')</h2><div class="' + gridCls + '">' +
        site.items.map((it, idx) => '<div class="card"><span class="badge">' + esc(it.badge || c.label) + '</span>' +
          '<h3 style="margin-top:8px"><a href="/item/' + (idx + 1) + '">' + esc(it.name) + '</a></h3>' +
          '<p class="mute" style="font-size:13px">' + esc(it.desc) + '</p>' +
          '<div class="meta-row"><span>' + esc(it.leadTime) + '</span><span>' + esc(it.specs && it.specs[2] ? it.specs[2][1] : 'Current') + '</span></div>' +
          '<a class="btn-ghost" style="padding:6px 12px;font-size:12px;margin-top:6px" href="/item/' + (idx + 1) + '">Open spec →</a></div>').join('') +
        '</div>' + layoutBlock(site) +
        '<h2>Engineering Changelog &amp; Architecture Notes</h2><div class="grid-2">' +
        site.posts.slice(0, 6).map((p, idx) => '<div class="card"><span class="badge">' + esc(p.category || 'Release') + '</span><b style="margin-top:6px"><a href="/article/' + (idx + 1) + '">' + esc(p.title) + '</a></b><small>' + esc(p.author) + ' · ' + ago(p.at) + ' · ' + (p.readMin || 5) + ' min</small><p style="margin:6px 0 0;font-size:13.5px">' + esc(p.body) + '</p></div>').join('') + '</div>' +
        richTail(site);
    }
    if (fam === 'civic') {
      return defacedBlock(site) +
        renderHero(site, {
          badge: c.label + ' · ' + (site.region || 'Regional'),
          title: site.brand,
          lede: site.tagline,
          ctas: '<a class="btn" href="' + c.route + '">' + esc(c.routeLabel) + '</a><a class="btn-ghost" href="/documents">Public Records</a><a class="btn-ghost" href="/contact">Contact Office</a>'
        }) +
        highlightsBand(site) +
        '<h2>Online Services &amp; Directories (' + site.items.length + ')</h2><div class="' + gridCls + '">' +
        site.items.map((it, idx) => '<div class="card">' + (d.gridMode !== 'list-modern' ? cardArtSvg(site, idx, site.region || c.label) : '') +
          '<span class="badge">' + esc(it.badge || 'Public Service') + '</span>' +
          '<b style="margin-top:6px"><a href="/item/' + (idx + 1) + '">' + esc(it.name) + '</a></b>' +
          '<small>' + esc(site.region) + ' · ' + esc(it.leadTime) + '</small>' +
          '<p style="margin:6px 0 0;font-size:13px">' + esc(it.desc) + '</p>' +
          '<p style="margin:8px 0 0"><a href="/item/' + (idx + 1) + '">Open service →</a></p></div>').join('') +
        '</div>' + layoutBlock(site) +
        '<h2>Public Announcements, Bulletins &amp; Reports</h2><div class="grid-2">' +
        site.posts.slice(0, 6).map((p, idx) => '<div class="card"><span class="badge">' + esc(p.category || 'Notice') + '</span><b style="margin-top:6px"><a href="/article/' + (idx + 1) + '">' + esc(p.title) + '</a></b><small>' + ago(p.at) + ' · ' + esc(p.author) + '</small><p style="margin:6px 0 0">' + esc(p.body) + '</p></div>').join('') + '</div>' +
        comparisonMatrix(site) + timelineAndReviews(site) + faqAndNewsletter(site) + webNetworkBand(site);
    }
    if (fam === 'community') {
      const threads = '<div><h2>Active Discussions (' + site.posts.length + ' threads)</h2>' +
        site.posts.map((p, idx) => '<div class="card" style="margin-bottom:12px;display:flex;gap:12px;align-items:flex-start">' +
          '<span class="avatar">' + esc(p.author.slice(0, 2).toUpperCase()) + '</span><div style="flex:1;min-width:0">' +
          '<div class="meta-row" style="margin-top:0"><span class="badge">' + esc(p.category || c.label) + '</span><span>▲ ' + (p.upvotes || 18) + '</span><span>' + p.comments + ' replies</span><span>' + (p.views || 800).toLocaleString() + ' views</span></div>' +
          '<b><a href="/thread/' + (idx + 1) + '">' + esc(p.title) + '</a></b>' +
          '<small>by ' + esc(p.author) + ' · ' + ago(p.at) + '</small>' +
          '<p style="margin:6px 0 0">' + esc(p.body) + '</p></div></div>').join('') + '</div>';
      const side = '<aside><div class="card"><h3>Community Pulse</h3><p class="mute" style="font-size:13px">' + esc(site.tagline) + '</p>' +
        kpiHtml(d) + '<p style="margin-top:14px"><a class="btn" href="/thread/1">Join discussion</a></p></div>' +
        '<div class="card" style="margin-top:14px"><h3>Featured ' + esc(c.routeLabel) + '</h3>' +
        site.items.slice(0, 5).map((it, i) => '<p style="margin:8px 0;font-size:13px"><a href="/item/' + (i + 1) + '"><b>' + esc(it.name) + '</b></a><br><small>' + esc(it.leadTime) + '</small></p>').join('') +
        '</div></aside>';
      return defacedBlock(site) +
        renderHero(site, {
          badge: c.label + ' · ' + (120 + (d.seed % 4600)) + ' online',
          title: site.brand,
          lede: site.tagline,
          ctas: '<a class="btn" href="/thread/1">Open Top Discussion</a><a class="btn-ghost" href="' + c.route + '">' + esc(c.routeLabel) + '</a>'
        }) +
        highlightsBand(site) +
        '<div class="' + ((d.seed % 2) ? 'cols2-rev' : 'cols2') + '">' + ((d.seed % 2) ? side + threads : threads + side) + '</div>' +
        layoutBlock(site) + richTail(site);
    }
    if (fam === 'alert') {
      return defacedBlock(site) +
        renderHero(site, {
          badge: 'Urgent Account Notice',
          title: site.brand,
          lede: site.tagline,
          extra: '<p style="margin:8px 0 0">Reference ID: <code>' + esc(site.token.toUpperCase()) + '-884</code> · Domain: <code>' + esc(site.host) + '</code></p>',
          ctas: '<a class="btn" href="/login">Verify / Sign in Now</a><a class="btn-ghost" href="/contact">Contact Support</a>'
        }) +
        highlightsBand(site) +
        '<h2>Pending Actions &amp; Notices</h2><div class="' + gridCls + '">' +
        site.items.slice(0, 8).map((it, idx) => '<div class="card"><span class="badge">Action Needed</span><b style="margin-top:6px"><a href="/item/' + (idx + 1) + '">' + esc(it.name) + '</a></b><small>' + esc(it.desc) + '</small></div>').join('') +
        '</div>' + layoutBlock(site) + richTail(site);
    }
    return defacedBlock(site) +
      renderHero(site, {
        badge: c.label + ' · ' + (site.topic || 'Archive'),
        title: site.brand,
        lede: site.tagline,
        ctas: '<a class="btn" href="' + c.route + '">Explore ' + esc(c.routeLabel) + '</a><a class="btn-ghost" href="/documents">Browse Documents</a>'
      }) +
      highlightsBand(site) +
      layoutBlock(site) +
      '<h2>Latest Dispatches &amp; Dossiers (' + site.posts.length + ')</h2><div class="' + (d.gridMode === 'cards-2' ? 'grid-2' : 'list-rows') + '">' +
      site.posts.map((p, idx) => '<div class="card"><span class="badge">' + esc(p.category || 'Dispatch') + '</span><b style="margin-top:6px"><a href="/article/' + (idx + 1) + '">' + esc(p.title) + '</a></b><small>' + esc(p.author) + ' · ' + ago(p.at) + ' · ' + (p.readMin || 6) + ' min</small><p style="margin:6px 0 0">' + esc(p.body) + '</p></div>').join('') + '</div>' +
      richTail(site);
  }

  function listBody(site) {
    const c = site.cat, market = isMarketSite(site);
    if (market) {
      return '<h1>' + esc(c.routeLabel) + ' (' + site.items.length + ')</h1><p class="lede">' + esc(site.brand) + ' · ' + esc(site.topic || c.label) + '</p>' + renderCommerceItems(site) + webNetworkBand(site);
    }
    const rows = site.items.length
      ? '<table><tr><th>Entry</th><th>Section</th><th>Status / Schedule</th><th>Region</th><th></th></tr>' + site.items.map((i, idx) =>
        '<tr><td><b><a href="/item/' + (idx + 1) + '">' + esc(i.name) + '</a></b><br><small>' + esc(i.desc) + '</small></td><td><span class="badge">' + esc(i.badge || c.label) + '</span></td><td>' + esc(i.leadTime || 'Current') +
        '</td><td>' + esc(site.region) + '</td><td><a href="/item/' + (idx + 1) + '">View →</a></td></tr>').join('') + '</table>'
      : site.posts.map((p, idx) => '<div class="card" style="margin-bottom:9px"><b><a href="/article/' + (idx + 1) + '">' + esc(p.title) + '</a></b><small>' + esc(p.author) +
        ' · ' + ago(p.at) + '</small><p>' + esc(p.body) + '</p></div>').join('');
    return '<h1>' + esc(c.routeLabel) + '</h1><p class="lede">' + esc(site.brand) + ' · ' + esc(site.topic || c.label) + '</p>' + rows + webNetworkBand(site);
  }

  function itemBody(site, idx) {
    const n = Math.max(1, Math.min(site.items.length, idx || 1));
    const it = site.items[n - 1] || site.items[0];
    if (!it) return '<h1>Not found</h1><p><a href="/">Back home</a></p>';
    const market = isMarketSite(site), fam = site.theme || themeFamilyFor(site);
    const related = site.items.filter(x => x.id !== it.id).slice(0, 4);
    const specRows = (it.specs || [['Section', site.cat.label], ['Region', site.region], ['Status', it.leadTime || 'Current']])
      .map(([k, v]) => '<tr><th>' + esc(k) + '</th><td>' + esc(v) + '</td></tr>').join('');
    if (market) {
      return '<p><a href="' + site.cat.route + '">← Back to ' + esc(site.cat.routeLabel) + '</a></p>' +
        '<div class="hero hero-split"><div>' + cardArtSvg(site, n - 1, site.brand + ' · ' + site.cat.label) + '</div><div>' +
        '<span class="badge">' + esc(it.badge || site.cat.label) + '</span>' +
        '<h1 style="margin-top:8px">' + esc(it.name) + '</h1><div>' + starsHtml(it.rating) + ' <small>(' + (it.reviews || 32) + ' verified reviews)</small></div>' +
        '<div class="price" style="font-size:26px;margin:10px 0">' + money(it.price) + (it.comparePrice ? ' <small class="mute" style="text-decoration:line-through;font-size:14px">' + money(it.comparePrice) + '</small>' : '') + '</div>' +
        '<p>' + esc(it.desc) + '</p>' +
        '<p class="mute">SKU: <code>' + esc(site.token.toUpperCase()) + '-' + it.id + '</code> · ' + esc(it.leadTime || 'Available') + ' · Stock: ' + (it.stock || 5) + ' · Dispatched from ' + esc(site.region || 'Regional Hub') + '</p>' +
        '<div class="hero-row"><a class="btn" href="/cart?add=' + it.id + '">Add to cart · ' + money(it.price) + '</a><a class="btn-ghost" href="/">Home</a></div></div></div>' +
        '<h2>Specifications &amp; Technical Details</h2><table>' + specRows + '</table>' +
        '<h2>Related ' + esc(site.cat.routeLabel) + '</h2><div class="grid">' +
        related.map(r => '<div class="card"><a href="/item/' + r.id + '" style="text-decoration:none">' + cardArtSvg(site, r.id, r.badge) + '</a><b><a href="/item/' + r.id + '">' + esc(r.name) + '</a></b><div class="price">' + money(r.price) + '</div></div>').join('') +
        '</div>' + webNetworkBand(site);
    }
    const primaryCta = fam === 'community' ? '<a class="btn" href="/thread/1">Join Discussion</a>'
      : fam === 'editorial' ? '<a class="btn" href="/article/1">Read Full Coverage</a>'
      : fam === 'saas' ? '<a class="btn" href="/docs">Open Documentation</a>'
      : '<a class="btn" href="/documents">View Records &amp; Files</a>';
    return '<p><a href="' + site.cat.route + '">← Back to ' + esc(site.cat.routeLabel) + '</a></p>' +
      '<div class="hero hero-split"><div>' + cardArtSvg(site, n - 1, site.brand + ' · ' + site.cat.label) + '</div><div>' +
      '<span class="badge">' + esc(it.badge || site.cat.label) + '</span>' +
      '<h1 style="margin-top:8px">' + esc(it.name) + '</h1>' +
      '<p class="mute">' + esc(it.leadTime || 'Active') + ' · Ref <code>' + esc(site.token.toUpperCase()) + '-' + it.id + '</code> · ' + esc(site.region || 'Global') + '</p>' +
      '<p>' + esc(it.desc) + '</p>' +
      '<div class="hero-row">' + primaryCta + '<a class="btn-ghost" href="/contact">Contact Desk</a><a class="btn-ghost" href="/">Home</a></div></div></div>' +
      '<h2>Details &amp; Reference Metadata</h2><table>' + specRows + '</table>' +
      '<h2>More in ' + esc(site.cat.routeLabel) + '</h2><div class="grid">' +
      related.map(r => '<div class="card"><a href="/item/' + r.id + '" style="text-decoration:none">' + cardArtSvg(site, r.id, r.badge) + '</a><b><a href="/item/' + r.id + '">' + esc(r.name) + '</a></b><small>' + esc(r.leadTime || site.region) + '</small></div>').join('') +
      '</div>' + webNetworkBand(site);
  }

  function articleBody(site, idx, query, method) {
    const n = Math.max(1, Math.min(site.posts.length, idx || 1));
    const p = site.posts[n - 1] || site.posts[0];
    if (!p) return '<h1>Article not found</h1><p><a href="/">Back home</a></p>';
    const key = 'a' + n;
    site.comments = site.comments || {};
    site.comments[key] = site.comments[key] || [
      { author: site.users[2].name, text: 'Helpful breakdown — especially the regional comparison and verified metrics.', at: Date.now() - 7200000 },
      { author: site.users[3].name, text: 'Cross-referenced this with the archive specifications and everything lines up cleanly.', at: Date.now() - 3200000 }
    ];
    let xssNote = '';
    const msg = (query.get('comment') || '').trim();
    const by = (query.get('author') || 'Visitor').trim() || 'Visitor';
    if (msg) {
      site.comments[key].push({ author: by.slice(0, 40), text: msg.slice(0, 400), at: Date.now() });
      recordAction(site, 'comment', { kind: 'article', id: n, author: by });
      if (/<script|onerror=|onload=/i.test(msg)) xssNote = '<p><span class="pill">XSS probe detected</span> Displayed escaped here, but unvalidated input was stored in the thread.</p>';
    }
    const paras = (p.paragraphs && p.paragraphs.length ? p.paragraphs : [p.body]).map(t => '<p style="font-size:16px;line-height:1.72">' + esc(t) + '</p>').join('');
    const takes = (p.takeaways && p.takeaways.length)
      ? '<div class="callout"><b>Key Takeaways</b><ul style="margin:8px 0 0;padding-left:18px">' + p.takeaways.map(x => '<li>' + esc(x) + '</li>').join('') + '</ul></div>'
      : '';
    const morePosts = site.posts.filter((_, i) => i !== n - 1).slice(0, 4);
    return '<p><a href="/">← Back to ' + esc(site.brand) + '</a></p>' +
      '<article class="hero"><div class="meta-row"><span class="badge">' + esc(p.category || site.topic || site.cat.label) + '</span><span>' + (p.readMin || 6) + ' min read</span><span>' + (p.views || 1400).toLocaleString() + ' views</span></div>' +
      '<h1 style="margin-top:8px">' + esc(p.title) + '</h1>' +
      '<p class="mute">By <b>' + esc(p.author) + '</b> (' + esc(p.authorRole || 'Correspondent') + ') · ' + ago(p.at) + ' · ' + esc(site.region || 'Editorial Desk') + '</p>' +
      '<div style="margin:16px 0">' + heroArtSvg(site, siteDesign(site)) + '</div>' +
      takes + paras +
      '<p>Additional records, ' + (isMarketSite(site) ? 'pricing sheets' : 'reference files') + ', and related reports for <b>' + esc(site.topic || site.cat.label) + '</b> are archived in the <a href="/documents">Documents</a> section and accessible through the <a href="' + site.cat.route + '">' + esc(site.cat.routeLabel) + '</a> directory.</p>' +
      '</article>' + xssNote +
      '<h2>Read Next on ' + esc(site.brand) + '</h2><div class="grid-2">' +
      morePosts.map(mp => '<div class="card"><b><a href="/article/' + mp.id + '">' + esc(mp.title) + '</a></b><small>' + esc(mp.author) + ' · ' + (mp.readMin || 5) + ' min read</small></div>').join('') + '</div>' +
      '<h2>Comments (' + site.comments[key].length + ')</h2>' +
      site.comments[key].map(c => '<div class="card" style="margin-bottom:8px;display:flex;gap:10px"><span class="avatar">' + esc(c.author.slice(0, 2).toUpperCase()) + '</span><div><b>' + esc(c.author) + '</b><small>' + ago(c.at) + '</small><p style="margin:5px 0 0">' + esc(c.text) + '</p></div></div>').join('') +
      '<h2>Post a comment</h2><form action="/article/' + n + '" method="post"><input name="author" placeholder="Your name">' +
      '<textarea name="comment" rows="3" placeholder="Add your comment…"></textarea><button type="submit">Post comment</button></form>' +
      webNetworkBand(site);
  }

  function threadBody(site, idx, query) {
    const n = Math.max(1, Math.min(site.posts.length, idx || 1));
    const p = site.posts[n - 1] || site.posts[0];
    const key = 't' + n;
    site.comments = site.comments || {};
    site.comments[key] = site.comments[key] || [
      { author: site.users[1].name, text: 'Can confirm we saw the exact same behaviour on our end last week — metrics matched almost to the decimal.', at: Date.now() - 5400000 },
      { author: site.users[3].name, text: 'Worth checking the docs page and status history before changing config. Great writeup.', at: Date.now() - 1800000 },
      { author: site.users[4].name, text: 'Bookmarked this thread and shared it with our ' + site.region + ' working group.', at: Date.now() - 600000 }
    ];
    let xssNote = '';
    const reply = (query.get('reply') || '').trim();
    const by = (query.get('author') || 'member').trim() || 'member';
    if (reply) {
      site.comments[key].push({ author: by.slice(0, 40), text: reply.slice(0, 400), at: Date.now() });
      recordAction(site, 'comment', { kind: 'thread', id: n, author: by });
      if (/<script|onerror=|onload=/i.test(reply)) xssNote = '<p><span class="pill">XSS probe detected</span> Stored in thread replies (rendered safely escaped).</p>';
    }
    const paras = (p.paragraphs && p.paragraphs.length ? p.paragraphs : [p.body]).map(t => '<p>' + esc(t) + '</p>').join('');
    return '<p><a href="/">← Back to ' + esc(site.brand) + '</a></p>' +
      '<div class="hero"><span class="badge">Thread #' + n + ' · ▲ ' + (p.upvotes || 24) + ' · ' + (p.views || 1100).toLocaleString() + ' views</span>' +
      '<h1 style="margin-top:8px">' + esc(p.title) + '</h1><small class="mute">Started by ' + esc(p.author) + ' (' + esc(p.authorRole || 'Member') + ') · ' + ago(p.at) + '</small>' +
      '<div style="margin-top:12px">' + paras + '</div></div>' + xssNote +
      '<h2>Replies (' + site.comments[key].length + ')</h2>' +
      site.comments[key].map(c => '<div class="card" style="margin-bottom:8px;display:flex;gap:10px"><span class="avatar">' + esc(c.author.slice(0, 2).toUpperCase()) +
        '</span><div><b>' + esc(c.author) + '</b><small>' + ago(c.at) + '</small><p style="margin:4px 0 0">' + esc(c.text) + '</p></div></div>').join('') +
      '<h2>Reply to thread</h2><form action="/thread/' + n + '" method="post"><input name="author" placeholder="Handle">' +
      '<textarea name="reply" rows="3" placeholder="Write a reply…"></textarea><button type="submit">Post reply</button></form>' +
      webNetworkBand(site);
  }

  function cartBody(site, query) {
    site.cart = site.cart || [];
    const addId = parseInt(query.get('add'), 10);
    const remId = parseInt(query.get('remove'), 10);
    if (query.has('clear')) site.cart = [];
    if (addId) {
      const it = site.items.find(x => x.id === addId) || site.items[addId - 1];
      if (it) {
        const cur = site.cart.find(x => x.id === it.id);
        if (cur) cur.qty++;
        else site.cart.push({ id: it.id, name: it.name, price: it.price, qty: 1 });
      }
    }
    if (remId) site.cart = site.cart.filter(x => x.id !== remId);
    const total = site.cart.reduce((s, x) => s + Number(x.price) * x.qty, 0).toFixed(2);
    if (!site.cart.length) {
      return '<h1>Your Cart</h1><p class="lede">Your cart is empty.</p><p><a class="btn" href="' + site.cat.route + '">Continue browsing ' + esc(site.cat.routeLabel) + '</a></p>';
    }
    return '<h1>Your Cart</h1><table><tr><th>Item</th><th>Qty</th><th>Price</th><th></th></tr>' +
      site.cart.map(x => '<tr><td><a href="/item/' + x.id + '">' + esc(x.name) + '</a></td><td>' + x.qty + '</td><td>' +
        money((Number(x.price) * x.qty).toFixed(2)) + '</td><td><a href="/cart?remove=' + x.id + '">Remove</a></td></tr>').join('') +
      '</table><p style="font-size:18px;font-weight:700;margin-top:14px">Total: ' + money(total) + '</p>' +
      '<form action="/checkout" method="post"><input name="name" placeholder="Full name"><input name="email" placeholder="Email for receipt">' +
      '<button type="submit">Place order</button></form><p><a href="/cart?clear=1">Clear cart</a> · <a href="' + site.cat.route + '">Keep shopping</a></p>';
  }

  function checkoutBody(site, query) {
    const name = (query.get('name') || 'Customer').trim();
    const total = (site.cart || []).reduce((s, x) => s + Number(x.price) * x.qty, 0).toFixed(2);
    const orderId = 1000 + int(100, 8999);
    site.orders.unshift({ id: orderId, customer: name, email: query.get('email') || 'buyer@' + site.host, total: total || '29.99', address: '14 Market Street, ' + (site.region || 'Northfield') });
    site.cart = [];
    recordAction(site, 'checkout', { orderId, total: total || '29.99' });
    return '<div class="hero"><span class="badge">Order Confirmed</span><h1 style="margin-top:8px">Thank you, ' + esc(name) + '</h1>' +
      '<p class="lede">Order <code>#' + orderId + '</code> has been recorded for ' + money(total || '29.99') + '.</p>' +
      '<p>Track your order via <a href="/track?ref=' + orderId + '">/track</a> or inspect the order API at <a href="/api/orders/' + orderId + '">/api/orders/' + orderId + '</a>.</p>' +
      '<p><a class="btn" href="/">Back to ' + esc(site.brand) + '</a></p></div>';
  }

  const signedInBody = (site, note) => '<h1>Signed in as admin</h1><p class="lede">' + note + '</p>' +
    '<p>Staff area: <a href="' + site.adminPath + '">' + esc(site.adminPath) + '</a> · <a href="/account">Your account</a> · ' +
    '<a href="/">Back to the site</a></p>';

  /* Global site-action event bus so Cyber Mail missions & bank rewards react immediately for ALL websites */
  const actionListeners = new Set();
  const onAction = fn => {
    if (typeof fn !== 'function') return () => {};
    actionListeners.add(fn);
    return () => actionListeners.delete(fn);
  };
  const recordAction = (site, action, detail) => {
    if (quiet > 0 || !site || !site.host) return;
    const ev = { host: site.host, brand: site.brand, action: String(action || ''), site, detail: detail || null, at: Date.now() };
    for (const fn of [...actionListeners]) { try { fn(ev); } catch (e) { } }
  };

  /* What is found on a site pays the Cyber Desktop's practice bank, once per site and finding: whether the page was
     opened in the desktop's browser or read through moundshell, the same discovery pays the same money once. Access,
     the leaked .env and the backup are the three that together count as owning a site. */
  const paySite = (site, id, amount, label, kind, stat) => {
    if (quiet > 0) return false;
    recordAction(site, id, { amount, label });
    try {
      const bank = typeof A !== 'undefined' ? A.cyberBank : null;
      if (!bank || !bank.once) return false;
      if (!bank.once('web:' + site.host + ':' + id, amount, label + ' · ' + site.host, kind || 'exploit', stat === undefined ? 'exploits' : stat)) return false;
      if (['access', 'env', 'backup'].every(key => bank.paid('web:' + site.host + ':' + key))) {
        const finance = site.cat.id === 'bank' || site.cat.id === 'crypto';
        bank.once('web:' + site.host + ':owned', finance ? 350 : 250, 'Site fully owned: ' + site.brand, 'target', 'targets');
      }
      return true;
    } catch (e) { return false; }
  };

  function loginBody(site, query) {
    const sec = site.sec || buildSecProfile(site);
    const u = query.get('u') || query.get('user') || query.get('email') || '';
    const p = query.get('p') || query.get('pass') || query.get('password') || '';
    const sqli = /'\s*(?:or|OR)\s+1\s*=\s*1\s*(?:--|#)/.test(u) || /"\s*or\s*"\s*=\s*"/i.test(u) ||
      /'\s*(?:or|OR)\s+'1'\s*=\s*'1/i.test(u) || /\badmin'--/.test(u);
    if (sqli) {
      if (!sec.sqliLogin) {
        return '<h1>Sign in</h1><p class="lede" style="color:#f87171">401 Unauthorized — input rejected (parameterized SQL queries &amp; WAF active on ' + esc(site.host) + ').</p>' +
          '<p class="mute">Difficulty: <code>' + esc(sec.difficulty) + '</code> · Stack: <code>' + esc(sec.stack.server) + '</code>. Inspect public endpoints and configuration artifacts instead.</p>' + loginForm(sec.loginPath);
      }
      site.session.admin = true;
      paySite(site, 'access', 65, 'Access gained through a SQL injection');
      return signedInBody(site, 'The query was built by gluing your text into SQL, and your text changed the question it asked.') +
        '<p><span class="pill">SELECT * FROM users WHERE email = \'' + esc(u) + '\' AND pass = \'' + esc(p) + '\'</span></p>';
    }
    if (u || p) {
      const defHit = sec.defaultCreds && u.trim().toLowerCase() === sec.defaultCreds[0] && p === sec.defaultCreds[1];
      if (defHit) {
        site.session.admin = true;
        paySite(site, 'access', 40, 'Access gained using default credentials');
        return signedInBody(site, 'Default factory credentials (' + esc(sec.defaultCreds[0]) + ') were never changed on this site.');
      }
      if (u.trim().toLowerCase() === String(site.adminLogin || '').toLowerCase() && p === site.adminPass) {
        site.session.admin = true;
        const reward = sec.difficulty === 'extreme' ? 160 : sec.difficulty === 'hard' ? 110 : 60;
        paySite(site, 'access', reward, 'Access gained with discovered staff credentials (' + sec.difficulty + ')');
        return signedInBody(site, 'The server accepted the staff credentials discovered via ' + esc(sec.credPath || sec.secretPath) + '.');
      }
      return '<h1>Sign in</h1><p class="lede" style="color:#f87171">Those details did not match an account.</p>' + loginForm(sec.loginPath);
    }
    return '<h1>Sign in</h1><p class="lede">Members get order history, saved baskets and portal access.</p>' + loginForm(sec.loginPath) +
      (sec.sqliLogin ? '<p><small class="mute">Legacy auth query handler active (' + esc(sec.stack.powered) + ').</small></p>' :
        '<p><small class="mute">Protected by prepared statements &amp; rate limiting (' + esc(sec.stack.server) + ' · ' + esc(sec.difficulty) + ').</small></p>');
  }
  const loginForm = action => '<form action="' + esc(action || '/login') + '" method="get"><label>Email / Username <input name="u" autocomplete="off"></label>' +
    '<label>Password <input name="p" type="password" autocomplete="off"></label><button>Sign in</button></form>';

  function accountBody(site) {
    if (!site.session.admin) {
      return '<h1>Please sign in</h1><p class="lede">Your session is not valid for this area.</p><p><a href="/login">Sign in</a></p>';
    }
    return '<h1>Your account</h1><p class="lede">Signed in as admin.</p>' +
      '<h2>Orders</h2><table><tr><th>#</th><th>Customer</th><th>Total</th></tr>' + site.orders.map(o =>
        '<tr><td>' + o.id + '</td><td>' + esc(o.customer) + '</td><td>' + money(o.total) + '</td></tr>').join('') + '</table>' +
      '<p>Staff tools: <a href="' + site.adminPath + '">' + esc(site.adminPath) + '</a></p>';
  }

  function adminBody(site) {
    if (!site.session.admin) {
      return '<h1>403 — staff only</h1><p class="lede">The session cookie does not carry the staff role.</p>' +
        '<p><span class="pill">Cookie: session=guest</span></p><p><a href="/login">Sign in</a></p>';
    }
    return '<h1>Staff dashboard</h1><p class="lede">' + esc(site.brand) + ' · internal</p>' +
      '<table><tr><th>User</th><th>Email</th><th>API key</th></tr>' + site.users.map(u =>
        '<tr><td>' + esc(u.name) + '</td><td>' + esc(u.email) + '</td><td><code>' + esc(u.api_key) + '</code></td></tr>').join('') +
      '</table><h2>Deploy secret</h2><pre>' + esc(site.flag) + '</pre>' +
      '<p><a href="/api/users">/api/users</a> · <a href="/.env">/.env</a> · <a href="' + site.adminPath + '/backup.zip">backup</a></p>' +
      '<h2>Site content</h2><p>Edit the text every visitor sees on the front page.</p>' +
      '<p><a href="' + site.adminPath + '/content">Edit the home page</a>' +
      (site.content ? ' · <a href="' + site.adminPath + '/content?reset=1">restore the original</a>' : '') + '</p>';
  }

  /* The staff content form. A real CMS has exactly this: a box that writes what the public sees. Reaching it is what
     "defacement" means — no extra exploit, just the signed-in editor nobody protected properly. */
  const contentForm = site => '<h1>Edit the home page</h1><p class="lede">Whatever is saved here is what visitors read.</p>' +
    '<form action="' + site.adminPath + '/content" method="get">' +
    '<label>Headline <input name="headline" maxlength="90" value="' + esc(site.content ? site.content.headline : '') + '"></label>' +
    '<label>Message <textarea name="message" rows="4" maxlength="320">' + esc(site.content ? site.content.message : '') + '</textarea></label>' +
    '<button>Save to the home page</button></form>' +
    (site.content ? '<p><a href="' + site.adminPath + '/content?reset=1">Restore the original home page</a></p>' : '') +
    '<p><small>A real attacker with this form does not stop at the front page: they seed malware, steal the visit, or ' +
    'make the site unusable until the owner pays. The repair is the same either way — revoke the session, restore the ' +
    'last good copy, and close the way in.</small></p>';

  const aboutBody = site => '<div class="hero hero-split"><div><span class="badge">About · ' + esc(site.cat.label) + '</span>' +
    '<h1 style="margin-top:8px">About ' + esc(site.brand) + '</h1><p class="lede">' + esc(site.tagline) + '</p>' +
    site.cat.about.map(s => '<p>' + esc(s) + '</p>').join('') +
    '</div><div>' + heroArtSvg(site, siteDesign(site)) + '</div></div>' +
    highlightsBand(site) +
    '<h2>Leadership &amp; Operations Team</h2><div class="grid">' +
    site.users.map(u => '<div class="card" style="display:flex;gap:10px;align-items:center"><span class="avatar">' + esc(u.name.slice(0, 2).toUpperCase()) + '</span><div><b>' + esc(cap(u.name)) + '</b><small>' + esc(cap(u.role)) + ' · ' + esc(u.email) + '</small></div></div>').join('') + '</div>' +
    '<h2>Where We Operate</h2><div class="card"><p style="margin:0"><b>' + esc(site.brand) + ' Headquarters</b> · ' + esc(int(1, 90)) + ' ' + esc(pick(['Mill Lane', 'Church Street', 'Harbour Road', 'The Green', 'Canal Walk'])) +
    ', ' + esc(site.region || 'Northfield') + '</p><p class="mute" style="margin:6px 0 0">Online since ' + ago(site.createdAt) + ' · Domain: <code>' + esc(site.host) + '</code></p></div>' +
    webNetworkBand(site);

  const contactBody = site => '<h1>Contact</h1><p class="lede">We answer in a day, usually.</p>' +
    '<form action="/contact" method="post"><label>Name <input name="name"></label>' +
    '<label>Email <input name="email"></label><label>Message <textarea name="msg" rows="4"></textarea></label>' +
    '<button>Send</button></form><p><small>Or email <a href="/">hello@' + esc(site.host) + '</a></small></p>';

  const termsBody = site => '<h1>Terms of Service</h1><p class="lede">Effective ' + new Date().getFullYear() + ' · ' + esc(site.brand) + ' (' + esc(site.host) + ')</p>' +
    '<p>By accessing ' + esc(site.brand) + ' services, APIs, or member areas you agree to our standard service terms, acceptable use policy, and regional consumer protections in ' + esc(site.region || 'your jurisdiction') + '.</p>' +
    '<p>For billing enquiries, data export requests, or account recovery, reach our team through the <a href="/contact">Contact</a> page.</p>';

  /* Every route the site's backend has. Returns { status, type, body } — body is a full HTML page, JSON or plain text. */
  /* A quiet request pays nothing: the walkthrough reads a target the same way the browser does, and it is a lesson,
     not a payout. The counter covers every path that pays, including the sign-in handlers that call paySite directly. */
  let quiet = 0;
  function serve(site, raw, method, opts) {
    if (!opts || !opts.silent) return handle(site, raw, method);
    quiet++;
    try { return handle(site, raw, method); }
    finally { quiet--; }
  }
  function handle(site, raw, method) {
    const line = String(raw == null ? '/' : raw).trim();
    const target = (/^(?:get|post)\s/i.test(line) ? line.replace(/^(?:get|post)\s+/i, '') : line)
      .replace(/^https?:\/\/[^/]+/i, '').split('#')[0] || '/';
    const at = target.indexOf('?');
    const path = at < 0 ? target : target.slice(0, at);
    const query = new URLSearchParams(at < 0 ? '' : target.slice(at + 1));
    if (site.rangeIndex) return rangeServe(path, query);
    if (site.portal) return portalServe(path, query);
    /* the Surplus Vault is a shop with a real counter: its pages come from the rewards module, not the generator */
    if (site.host === REWARDS_HOST && A.cyberRewards && A.cyberRewards.page) {
      const answer = A.cyberRewards.page(path) || {};
      return { status: answer.status || 200, type: 'text/html', body: shell(site, answer.title || site.brand, answer.inner || '') };
    }
    /* Every site leaks its own user table — names, e-mails, the IP each account signed in from and the
       password the site stored in clear text. /dump/users.csv is the readable copy, and those IPs answer
       in Moundshroud's shell (nmap, ssh) as the users' own machines. */
    if (!site.hub && A.cyberPcs && A.cyberPcs.isDumpPath(path)) {
      const dumped = A.cyberPcs.dump(site, path);
      if (dumped) return dumped;
      return { status: 404, type: 'text/html', body: shell(site, 'Not Found', '<h1>404</h1><p class="lede">No dump lives at that address.</p><p><a class="btn" href="/">Back to ' + esc(site.brand) + '</a></p>') };
    }
    /* a hidden service has its own hand-written backend, served the same way a generated site is */
    if (site.dark && A.cyberDark && A.cyberDark.serve) {
      if (path === '/robots.txt') return { status: 200, type: 'text/plain', body: 'User-agent: *\nDisallow: /\n' };
      return A.cyberDark.serve(site, path, query, method);
    }
    const res = (status, type, body) => ({ status, type, body });
    const page = (title, body, status) => res(status || 200, 'text/html', shell(site, title, body));
    const pay = (id, amount, label, kind, stat) => paySite(site, id, amount, label, kind, stat);

    if (path === '/' || path === '/index.html') return page(site.brand, (site.range ? rangeBanner(site) : '') + homeBody(site));
    if (path === site.cat.route) return page(site.cat.routeLabel, listBody(site));
    if (/^\/item\/\d+$/.test(path)) return page('Details', itemBody(site, parseInt(path.split('/').pop(), 10)));
    if (/^\/article\/\d+$/.test(path)) return page('Article', articleBody(site, parseInt(path.split('/').pop(), 10), query, method));
    if (/^\/thread\/\d+$/.test(path)) return page('Discussion', threadBody(site, parseInt(path.split('/').pop(), 10), query));
    if (path === '/cart') {
      if (!isMarketSite(site)) return page('Not a Storefront', '<h1>404</h1><p class="lede">' + esc(site.brand) + ' is a ' + esc(site.cat.label.toLowerCase()) + ' website and does not sell products or operate a shopping cart.</p><p><a class="btn" href="/">Back to ' + esc(site.brand) + '</a></p>', 404);
      return page('Cart', cartBody(site, query));
    }
    if (path === '/checkout') {
      if (!isMarketSite(site)) return page('Not a Storefront', '<h1>404</h1><p class="lede">' + esc(site.brand) + ' is a ' + esc(site.cat.label.toLowerCase()) + ' website and does not process storefront orders.</p><p><a class="btn" href="/">Back to ' + esc(site.brand) + '</a></p>', 404);
      return page('Order Confirmed', checkoutBody(site, query));
    }
    if (path === '/about') return page('About', aboutBody(site));
    if (path === '/contact') {
      if (method === 'POST' || query.has('name') || query.has('email') || query.has('message')) {
        recordAction(site, 'contact', { name: query.get('name') || '' });
        return page('Thanks', '<div class="hero"><span class="badge">Received · Ref #' + esc(site.token.toUpperCase()) + '</span><h1 style="margin-top:8px">Thanks for getting in touch</h1><p class="lede">Your message has been logged with the ' + esc(site.brand) + ' support queue in ' + esc(site.region || 'our office') + '. Typical response time is one business day.</p><p><a class="btn" href="/">Back to ' + esc(site.brand) + '</a></p></div>');
      }
      return page('Contact', contactBody(site));
    }
    if (path === '/terms') return page('Terms', termsBody(site));
    if (path === '/privacy') return page('Privacy', '<h1>Privacy Policy</h1><p class="lede">' + esc(site.brand) + ' · ' + esc(site.host) + '</p><p>We collect only the ' + (isMarketSite(site) ? 'account, order, and diagnostic records' : 'account and diagnostic records') + ' required to operate our services and do not sell personal data to third-party brokers. Contact <a href="/contact">Support</a> to request a copy or deletion of your records.</p>');
    const sec = site.sec || buildSecProfile(site);
    /* A leaked file only contains the facts that particular file holds, so the amount you learn differs per site:
       one note with everything on a badly run site, or four files across four folders on a hardened one. */
    const leakBody = frag => {
      const has = fact => (frag.facts || []).includes(fact);
      const size = sec.difficulty === 'extreme' ? 140 : sec.difficulty === 'hard' ? 95 : sec.difficulty === 'medium' ? 60 : 45;
      pay('env', size, 'Discovered staff configuration at ' + frag.path);
      /* Whatever this file is, it carries the seeded staff account: an email mission that asks for staff access has to be
         finishable on every site. The difficulty still comes from where the file is and how many hops the site hides. */
      const parts = [];
      if (has('db')) parts.push('DB_PASSWORD=' + site.apiKey);
      if (has('jwt')) parts.push('APP_KEY=base64:' + site.token + tok(10));
      parts.push('ADMIN_PATH=' + site.adminPath);
      parts.push('ADMIN_EMAIL=' + site.adminLogin);
      parts.push('ADMIN_PASSWORD=' + site.adminPass);
      if (frag.kind === 'json') {
        const obj = { service: site.brand, host: site.host, stack: sec.stack.id };
        if (has('db')) obj.DB_PASSWORD = site.apiKey;
        if (has('jwt')) obj.APP_KEY = 'base64:' + site.token + tok(10);
        obj.ADMIN_PATH = site.adminPath;
        obj.ADMIN_EMAIL = site.adminLogin;
        obj.ADMIN_PASSWORD = site.adminPass;
        return res(200, 'application/json', JSON.stringify(obj, null, 2));
      }
      if (frag.kind === 'js') {
        const cfg = { apiBase: 'https://' + site.host + '/api', loginPath: sec.loginPath };
        cfg.adminPortal = site.adminPath;
        cfg.staffEmail = site.adminLogin;
        cfg.staffPass = site.adminPass;
        if (has('db') || has('jwt')) cfg.apiKey = site.apiKey;
        return res(200, 'application/javascript',
          '// ' + site.brand + ' frontend runtime bundle — shipped with its environment settings baked in\n' +
          'window.__APP_CONFIG__ = ' + JSON.stringify(cfg, null, 2) + ';\n');
      }
      if (frag.kind === 'sql') {
        return res(200, 'text/plain',
          '-- ' + site.brand + ' (' + site.host + ') · development seed dump\n' +
          'CREATE TABLE users (id int, email varchar(120), role varchar(20), password varchar(120));\n' +
          "INSERT INTO users VALUES (1,'" + site.adminLogin + "','admin','" + site.adminPass + "');\n" +
          (has('db') ? '-- GRANT ALL ON ' + site.host.split('.')[0] + ".* TO 'web'@'localhost' IDENTIFIED BY '" + site.apiKey + "';\n" : '') +
          (has('jwt') ? '-- deploy note: APP_KEY=base64:' + site.token + tok(10) + '\n' : ''));
      }
      if (frag.kind === 'archive') {
        return res(200, 'application/zip',
          'PK\u0003\u0004 (' + frag.path.split('/').pop() + ', ' + int(380, 980) + ' KB) — archive of the site before the last redesign\n' +
          '  app/config.php\n  app/.env\n  app/public/index.php\n  uploads/\n' +
          (has('jwt') ? 'app/config.php: $JWT_SECRET=\'' + site.token + 'jwt\'\n' : '') +
          (has('db') ? 'app/.env: DB_PASSWORD=' + site.apiKey + '\n' : '') +
          'app/.env: ADMIN_PATH=' + site.adminPath + '\n' +
          'app/.env: ADMIN_EMAIL=' + site.adminLogin + '\n' +
          'app/.env: ADMIN_PASSWORD=' + site.adminPass + '\n');
      }
      return res(200, 'text/plain',
        '# ' + site.brand + ' (' + site.host + ') · ' + sec.vector + ' (' + sec.difficulty + ')\n' +
        'APP_ENV=production\nDB_HOST=127.0.0.1\nDB_DATABASE=' + site.host.split('.')[0] + '\nDB_USERNAME=web\n' +
        parts.join('\n') + '\n' +
        (parts.length ? '' : '# Nothing here: the secrets live in another file on this site.\n'));
    };
    const leakAt = p => (sec.leaks || []).find(f => f.path === p) || null;
    if (path === '/robots.txt') {
      pay('robots', 8, 'robots.txt inspected', 'recon', '');
      const dis = ['Disallow: ' + sec.loginPath, 'Disallow: /account'];
      if (sec.robotsLeaksAdmin) dis.push('Disallow: ' + site.adminPath);
      else if (sec.difficulty === 'medium') dis.push('Disallow: ' + ((sec.dirs || []).find(d => /^\/[a-z]/.test(d) && !/assets|media|uploads|static|cdn/.test(d)) || '/internal'));
      return res(200, 'text/plain', 'User-agent: *\n' + dis.join('\n') + '\nAllow: /\n');
    }
    if (path === '/sitemap.xml') {
      const urls = ['/', site.cat.route, '/item/1', '/article/1', '/about', '/contact', '/faq', '/terms', '/privacy'];
      return res(200, 'application/xml', '<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n' +
        urls.map(u => '  <url><loc>https://' + esc(site.host) + u + '</loc></url>').join('\n') + '\n</urlset>\n');
    }
    /* Site-specific multi-hop clues and secret locations */
    const leakedFile = leakAt(path);
    if (leakedFile && path !== sec.cluePath && path !== sec.hopPath) return leakBody(leakedFile);
    if (sec.hopPath && path === sec.hopPath) {
      pay('hop', 30, 'Found internal staging note at ' + sec.hopPath, 'recon', '');
      return res(200, 'text/plain',
        '# ' + site.brand + ' — Internal Release & Migration Log\n' +
        'Host: ' + site.host + ' · Stack: ' + sec.stack.server + ' / ' + sec.stack.powered + '\n' +
        '2025-11-04: Rotated staff portal to nested route; disabled root /.env and /.git.\n' +
        '2025-12-18: TODO(ops) — remove temporary migration artifact at ' + sec.secretPath + ' after verifying admin seed.\n');
    }
    if (sec.cluePath && path === sec.cluePath && path !== '/robots.txt' && path !== '/.git/config' && path !== sec.secretPath) {
      pay('clue', 20, 'Found recon clue at ' + sec.cluePath, 'recon', '');
      const nextPtr = sec.hopPath || sec.secretPath;
      if (path.endsWith('.json')) {
        return res(200, 'application/json', JSON.stringify({
          name: site.brand, host: site.host, stack: sec.stack.id, version: '3.4.2',
          endpoints: { health: '/healthz', docs: '/docs', internalNotes: nextPtr }
        }, null, 2));
      }
      return res(200, 'text/plain',
        '# ' + site.brand + ' (' + site.host + ') — Public Metadata\n' +
        'Contact: security@' + site.host + '\n' +
        'Policy: https://' + site.host + '/privacy\n' +
        '# Internal reference (do not index): ' + nextPtr + '\n');
    }
    if (path === '/.git/HEAD') {
      if (!sec.gitExposed) return res(404, 'text/plain', '404 Not Found\n');
      pay('git', 20, 'Exposed .git repository metadata discovered', 'recon', '');
      return res(200, 'text/plain', 'ref: refs/heads/main\n');
    }
    if (path === '/.git/config') {
      if (!sec.gitExposed) return res(404, 'text/plain', '404 Not Found\n');
      pay('git', 20, 'Exposed .git/config revealed repository details', 'recon', '');
      return res(200, 'text/plain', '[core]\n\trepositoryformatversion = 0\n\tfilemode = true\n[remote "origin"]\n\turl = git@internal.' + site.host + ':web/' + site.host.split('.')[0] + '.git\n\t# deploy-token: ' + site.token + (sec.vector === 'git-leak' ? '\n\t# check /.git/logs/HEAD for last staff rotation' : '') + '\n');
    }
    if (site.trapped && site.virus && path === site.virus.scriptPath) {
      recordAction(site, 'trap-inspected', { virus: site.virus.name, scriptPath: site.virus.scriptPath });
      return res(200, 'application/javascript',
        '// SIMULATED FAKE POP-UP VIRUS PAYLOAD (' + site.virus.name + ')\n' +
        '// Host: ' + site.host + ' (' + site.ip + ')\n' +
        '// Vector: ' + site.virus.vector + '\n' +
        '// Behavior: ' + site.virus.action + '\n' +
        '// Cleanup: ' + site.virus.clean + '\n' +
        '// Harmless training artifact inside Cyber Desktop — nothing real executes.\n' +
        'window.__cdSimulatedTrap = { name: ' + JSON.stringify(site.virus.name) + ', host: ' + JSON.stringify(site.host) + ', harmless: true };\n');
    }
    /* a verification or sign-in link from a message lands on the same form, the way a real one does */
    if (path === '/login' || path === '/signin' || path === '/verify' || path === sec.loginPath) return page('Sign in', loginBody(site, query));
    if (path === '/account') return page('Account', accountBody(site));
    if (path === site.adminPath) {
      if (site.session.admin) pay('staff', 20, 'Staff dashboard reached');
      return page('Staff', adminBody(site));
    }
    if (path === site.adminPath + '/content') {
      if (!site.session.admin) return res(403, 'text/plain', 'forbidden\n');
      if (query.has('reset')) {
        site.content = null;
        return page('Home page restored', '<h1>Home page restored</h1><p class="lede">The original copy is back; the staff session is still open.</p>' +
          '<p><a href="/">Home page</a> · <a href="' + site.adminPath + '">Staff dashboard</a></p>');
      }
      const headline = (query.get('headline') || '').trim().slice(0, 90);
      const message = (query.get('message') || '').trim().slice(0, 320);
      if (headline || message) {
        site.content = { headline: headline || 'This site is under new management', message, at: Date.now(), by: site.adminLogin };
        recordAction(site, 'content', { headline: site.content.headline });
        return page('Home page updated', '<h1>Home page updated</h1><p class="lede">The change is live on the front page.</p>' +
          '<p><a href="/">See the home page</a> · <a href="' + site.adminPath + '">Staff dashboard</a> · ' +
          '<a href="' + site.adminPath + '/content?reset=1">Restore the original</a></p>');
      }
      return page('Edit home page', contentForm(site));
    }
    if (path === site.adminPath + '/backup.zip') {
      if (!site.session.admin) return res(403, 'text/plain', 'forbidden\n');
      pay('backup', 90, 'Backup archive downloaded');
      return res(200, 'application/zip', 'PK\u0003\u0004 (site-backup.zip, 812 KB) — app/ and .env\n' +
        'app/config.php: $JWT_SECRET=\'' + site.token + 'jwt\'\napp/.env: DB_PASSWORD=' + site.apiKey + '\nADMIN_PATH=' + site.adminPath +
        '\nadmin login: ' + site.adminLogin + ' / ' + site.adminPass + '\n');
    }
    if (path === '/api/users') {
      if (!sec.openUsersApi && !site.session.admin) return res(401, 'application/json', '{"error":"authentication required"}');
      pay('users', 25, 'Staff API handed over every user');
      return res(200, 'application/json', JSON.stringify(site.users.map(u => ({ id: u.id, name: u.name, email: u.email, role: u.role })), null, 2));
    }
    if (path === '/api/items') {
      return res(200, 'application/json', JSON.stringify(site.items, null, 2));
    }
    if (path === '/api/orders' || /^\/api\/orders\/\d+$/.test(path)) {
      const id = (path.match(/\d+$/) || [])[0];
      if (!sec.openIdor && !site.session.admin) return res(401, 'application/json', '{"error":"order access requires authentication"}');
      if (!id) return res(200, 'application/json', JSON.stringify(site.orders, null, 2));
      const order = site.orders.find(o => String(o.id) === id);
      if (!order) return res(404, 'application/json', '{"error":"no such order"}');
      /* no ownership check at all: that is the bug */
      pay('idor', 35, 'Order read without an ownership check (IDOR)');
      return res(200, 'application/json', JSON.stringify(order, null, 2));
    }
    if (path === '/api/search') {
      const q = query.get('q') || '';
      if (sec.sqliSearch && /['"]|\bor\b/i.test(q)) {
        pay('sqli', 40, 'SQL error leaked from a quoted search');
        return res(500, 'text/plain', 'SQLSTATE[42000]: Syntax error or access violation: 1064 You have an error in your SQL ' +
          'syntax near \'' + q + '\' at line 1\n\n#0 /var/www/app/Search.php(41): PDO->query(\'SELECT * FROM items WHERE name LIKE \\\'%' + q + '%\\\'\\\')\n');
      }
      return res(200, 'application/json', JSON.stringify(site.items.filter(i => i.name.toLowerCase().includes(q.toLowerCase())), null, 2));
    }
    if (path === '/.env') return res(sec.hardenedHeaders ? 403 : 404, 'text/plain', sec.hardenedHeaders ? '403 Forbidden\n' : '404 Not Found\n');
    if (path === '/search') {
      const q = (query.get('q') || '').trim();
      const ql = q.toLowerCase();
      const itemHits = site.items.filter(i => !ql || i.name.toLowerCase().includes(ql) || (i.desc || '').toLowerCase().includes(ql));
      const postHits = site.posts.filter(p => !ql || p.title.toLowerCase().includes(ql) || p.body.toLowerCase().includes(ql));
      const shownItems = itemHits.length ? itemHits : site.items.slice(0, 3);
      return page('Search', '<h1>Search ' + esc(site.brand) + '</h1><p class="lede">Results for “' + esc(q) + '” (' + (itemHits.length + postHits.length) + ' matches)</p>' +
        '<h2>' + esc(site.cat.routeLabel) + '</h2><div class="grid">' +
        shownItems.map(i => '<div class="card"><b><a href="/item/' + (i.id || 1) + '">' + esc(i.name) + '</a></b>' +
          (isMarketSite(site) && i.price ? '<div class="price">' + money(i.price) + '</div>' : '<small>' + esc(i.leadTime || site.cat.label) + '</small>') +
          '</div>').join('') + '</div>' +
        (postHits.length ? '<h2>Articles &amp; Discussions</h2>' + postHits.map(p => '<div class="card" style="margin-bottom:8px"><b><a href="/article/' + (p.id || 1) + '">' + esc(p.title) + '</a></b><small>' + esc(p.author) + '</small></div>').join('') : '') +
        (/<script/i.test(q) ? '<p><span class="pill">reflected unescaped</span> A browser would run that. Shown escaped here, so this page stays safe.</p>' : ''));
    }
    /* every site also answers these, whatever its category: FAQs, people, prices, jobs, tracking and its own page kind */
    const extra = {
      '/faq': ['Common questions'], '/team': ['People'], '/pricing': ['Pricing'], '/plans': ['Plans'], '/track': ['Tracking'],
      '/status': ['Status', 'status'], '/docs': ['Documentation', 'docs'], '/gallery': ['Gallery', 'gallery'],
      '/forum': ['Forum', 'forum'], '/thread': ['Thread', 'forum'], '/threads': ['Threads', 'forum'], '/wiki': ['Wiki', 'wiki'],
      '/forecast': ['Forecast', 'forecast'], '/jobs': ['Jobs', 'jobs'], '/menu': ['Menu', 'menu'], '/timetable': ['Timetable', 'timetable'],
      '/documents': ['Documents', 'gov'], '/memo': ['Memo', 'leaks'], '/leaks': ['Leaks', 'leaks'], '/evidence': ['Evidence', 'conspiracy'],
      '/manifesto': ['Manifesto', 'conspiracy'], '/archive': ['Archive', 'files'], '/files': ['Files', 'files'],
      '/auction': ['Auction', 'auction'], '/watch': ['Watch', 'video'], '/episodes': ['Episodes', 'episodes'],
      '/radio': ['Radio', 'radio'], '/listen': ['Radio', 'radio'], '/schedule': ['Schedule', 'radio'], '/flights': ['Flights', 'flights'],
      '/report': ['Report', 'report'], '/members': ['Members', 'chat']
    };
    if (Object.hasOwn(extra, path)) return page(extra[path][0], extraBody(site, extra[path][0], extra[path][1]));
    return page('Not found', '<h1>404</h1><p class="lede">Nothing at <code>' + esc(path) + '</code>.</p><p><a href="/">Back to the home page</a></p>', 404);
  }

  /* the shared pages: a site's own kind of page where it has one, and a real answer where it does not */
  function extraBody(site, title, kind) {
    if (kind) {
      const block = blockFor(site, kind);
      if (block) return '<h1>' + esc(title) + '</h1>' + block;
    }
    if (/^(?:Pricing|Plans)$/.test(title)) {
      if (!isMarketSite(site)) {
        return '<h1>' + esc(site.cat.routeLabel) + ' Overview</h1><p class="lede">' + esc(site.brand) + ' is a ' + esc(site.cat.label.toLowerCase()) + ' site and does not sell storefront goods or retail subscriptions.</p>' +
          '<p><a class="btn" href="' + site.cat.route + '">Explore ' + esc(site.cat.routeLabel) + '</a></p>';
      }
      return '<h1>' + esc(title) + '</h1><p class="lede">Transparent pricing with no hidden contracts.</p>' +
        '<table><tr><th>Option</th><th>Price</th><th>Availability</th><th></th></tr>' + site.items.map((i, idx) => '<tr><td><a href="/item/' + (idx + 1) + '">' +
          esc(i.name) + '</a></td><td>' + money(i.price) + '</td><td>' + (i.stock ? 'Available' : 'Waitlist') + '</td><td><a href="/item/' + (idx + 1) + '">Select →</a></td></tr>').join('') +
        '</table>';
    }
    if (title === 'People') {
      return '<h1>Our Team</h1><p class="lede">Staff directory for ' + esc(site.brand) + ' (' + esc(site.region || 'Headquarters') + ').</p>' +
        '<table><tr><th>Name</th><th>Role</th><th>Email</th></tr>' + site.users.map(u => '<tr><td>' + esc(u.name) +
          '</td><td>' + esc(cap(u.role)) + '</td><td>' + esc(u.email) + '</td></tr>').join('') + '</table>';
    }
    if (title === 'Tracking') {
      return '<h1>' + (isMarketSite(site) ? 'Order &amp; Dispatch Tracking' : 'Reference &amp; Case Lookup') + '</h1><p class="lede">Enter the reference from your confirmation notice.</p>' +
        '<form action="/track" method="get"><input name="ref" placeholder="e.g. ' + esc(site.token.toUpperCase()) +
        '-01"><button type="submit">Look up</button></form><p><span class="pill">' + esc(site.token.toUpperCase()) + '-01 · ' + (isMarketSite(site) ? 'in transit · ' + int(1, 3) + ' of 4 stops' : 'active · last updated today') + '</span></p>';
    }
    if (title === 'Jobs') {
      return '<h1>Careers at ' + esc(site.brand) + '</h1><p class="lede">Open roles in ' + esc(site.region || 'our regional hubs') + ' and remote.</p>' + site.items.slice(0, 5).map((i, idx) =>
        '<div class="card" style="margin-bottom:8px"><b><a href="/item/' + (idx + 1) + '">' + esc(i.name) + ' Specialist</a></b><small>$' + (24 + ((idx * 9 + site.id) % 45)) + '/hr · ' +
        esc(pick(['Full time', 'Part time', 'Hybrid', 'Remote'])) + '</small></div>').join('');
    }
    const questions = [
      ['How do I reach support?', 'Use our Contact page or email support@' + site.host + '. Our ' + (site.region || 'regional') + ' desk responds within one business day.'],
      ['Where do you operate?', isMarketSite(site)
        ? ('We serve customers across ' + (site.region || 'multiple regions') + ' with online ordering and account access 24/7.')
        : ('We serve readers and visitors across ' + (site.region || 'multiple regions') + ' with 24/7 online access.')],
      ['Can I update a submission or request?', 'Sign in to your account or message our desk through /contact with your reference number.'],
      ['How are accounts protected?', 'Member sessions use encrypted cookies and role-based access controls for administrative portals.'],
      ['Do you offer API access?', 'Yes — developer documentation and status updates are available directly from the main navigation bar.']
    ];
    return '<h1>' + esc(title) + '</h1><p class="lede">' + esc(site.brand) + ' · ' + esc(site.host) + '</p>' +
      questions.map(([q, a]) => '<div class="card" style="margin-bottom:9px"><h3>' + esc(q) + '</h3><p style="margin:4px 0 0">' + esc(a) + '</p></div>').join('');
  }

  const homeHtml = site => serve(site, '/', 'GET').body;

  /* ---------------- the search portal: infinite fake internet, every category & any topic ---------------- */
  const SEARCH_HOST = 'search.moundshroud.example';
  const PORTAL = {
    id: 0, portal: true, brand: 'Moundshroud Search', host: SEARCH_HOST, ip: '10.14.0.1', kind: 'Search', accent: '#7dd3fc',
    tagline: 'Infinite simulated web directory — every category, every topic.', token: 'portal', trapped: false, virus: null,
    cat: { id: 'search', icon: '🔎', label: 'Search', route: '/results', routeLabel: 'Results' },
    users: [], items: [], posts: [], orders: [], adminPath: '/staff', apiKey: '', flag: '', session: { admin: false },
    createdAt: Date.now()
  };
  /* the Open Range website: an index page and one detail page per machine, all generated from the number */
  function rangeDoc(inner) {
    return '<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">' +
      '<title>Moundshroud Open Range</title><style>' +
      'body{margin:0;background:#080b12;color:#dbe4f3;font:15px/1.62 system-ui,-apple-system,"Segoe UI",sans-serif}' +
      'a{color:#7dd3fc;text-decoration:none}a:hover{text-decoration:underline}' +
      '.wrap{max-width:1120px;margin:0 auto;padding:22px 20px 48px}' +
      'header{border-bottom:1px solid #1e2836;padding-bottom:14px;margin-bottom:18px;display:flex;gap:14px;align-items:center;flex-wrap:wrap}' +
      'h1{font-size:23px;margin:0}h2{font-size:18px;margin:24px 0 8px}' +
      '.lede{color:#9fb3cd;max-width:840px}' +
      'table{width:100%;border-collapse:collapse;font-size:13.5px;margin:10px 0}' +
      'th,td{text-align:left;padding:7px 8px;border-bottom:1px solid #1b2431;vertical-align:top}' +
      'th{color:#8fa6c2;font-weight:600;font-size:12px;text-transform:uppercase;letter-spacing:.06em}' +
      'code{background:#111827;border:1px solid #223047;border-radius:6px;padding:1px 6px;font-size:12.5px}' +
      '.pill{display:inline-block;border:1px solid #2a3a52;border-radius:999px;padding:1px 9px;font-size:11.5px;color:#a9c2dd}' +
      '.easy{color:#6ee7b7;border-color:#1f6b4a}.medium{color:#fcd34d;border-color:#6b5a1f}.hard{color:#fca5a5;border-color:#6b2f2f}.extreme{color:#f0abfc;border-color:#6b2f6b}' +
      '.nav{display:flex;gap:10px;flex-wrap:wrap;margin:14px 0}' +
      '.btn{display:inline-block;border:1px solid #2f4a6b;background:#0f1a28;border-radius:9px;padding:7px 13px;color:#cfe6ff}' +
      '.note{background:#0d1520;border:1px solid #1d2a3d;border-radius:11px;padding:12px 14px;margin:12px 0;color:#a9bfd8;font-size:13.5px}' +
      'footer{margin-top:28px;border-top:1px solid #1e2836;padding-top:12px;color:#7d90a8;font-size:12.5px}' +
      '</style></head><body><div class="wrap">' + inner + '</div></body></html>';
  }
  function rangeServe(path, query) {
    if (path === '/robots.txt') return { status: 200, type: 'text/plain', body: 'User-agent: *\nDisallow: /pc/\n# every PC on this range is a simulation; there is nothing here to crawl\n' };
    const at = /^\/pc\/(\d+)\/?$/.exec(String(path || '/'));
    if (at) {
      const m = rangeMachine(+at[1]);
      return {
        status: 200, type: 'text/html', body: rangeDoc(
          '<header><h1>🖥 Workstation ' + String(m.n).padStart(4, '0') + '</h1><span class="pill ' + m.tier + '">' + m.tier + '</span></header>' +
          '<p class="lede">One PC behind the Open Range. Its web console is a small application running on this box, and the box itself is invented in this page.</p>' +
          '<table><tr><th>Address</th><td><code>' + esc(m.ip) + '</code> · <a href="https://' + esc(m.host) + '/">' + esc(m.host) + '</a></td></tr>' +
          '<tr><th>Operating system</th><td>' + esc(m.os) + ' — ' + esc(m.patch) + '</td></tr>' +
          '<tr><th>Role</th><td>' + esc(m.role) + '</td></tr>' +
          '<tr><th>Listening</th><td>' + esc(m.ports) + '</td></tr>' +
          '<tr><th>Difficulty</th><td>' + esc(m.tier) + '</td></tr></table>' +
          '<div class="note"><b>From moundshell</b><br><code>breach ' + esc(m.ip) + '</code> or <code>breach ' + esc(m.host) + '</code> starts the simulated engagement. ' +
          'You can also open its console at <a href="https://' + esc(m.host) + '/">https://' + esc(m.host) + '/</a>. Once the box is yours, its FLAG is printed on the staff page — submit it with <code>solve FLAG{…}</code>.</div>' +
          '<div class="nav"><a class="btn" href="/?p=' + Math.max(1, Math.ceil(m.n / 20)) + '">← Back to the index</a>' +
          '<a class="btn" href="/pc/' + (m.n + 1) + '">Next PC →</a></div>' +
          '<footer>Everything here is invented and simulated inside the Cyber Desktop browser. No host is contacted, no socket is opened, nothing leaves this page.</footer>'
        )
      };
    }
    const page = Math.max(1, parseInt(query.get('p'), 10) || 1);
    const per = 20, machines = rangeMachines(page, per);
    const rows = machines.map(m =>
      '<tr><td><a href="/pc/' + m.n + '">' + String(m.n).padStart(4, '0') + '</a></td>' +
      '<td><a href="https://' + esc(m.host) + '/">' + esc(m.host) + '</a></td>' +
      '<td><code>' + esc(m.ip) + '</code></td>' +
      '<td>' + esc(m.os) + '</td><td>' + esc(m.role) + '</td>' +
      '<td><span class="pill ' + m.tier + '">' + m.tier + '</span></td>' +
      '<td><code>breach ' + esc(m.ip) + '</code></td></tr>').join('');
    return {
      status: 200, type: 'text/html', body: rangeDoc(
        '<header><h1>🖥 Moundshroud Open Range</h1><span class="pill">∞ machines</span></header>' +
        '<p class="lede">An endless range of practice PCs. Every machine on this page is invented from its number, so the list never runs out: machine 1 000 001 exists the moment you ask for it. Pick one, open its console, or take it apart from moundshell.</p>' +
        '<div class="note"><b>How to use it:</b> in moundshell type <code>breach ' + esc(machines[0].ip) + '</code> (or <code>breach ' + esc(machines[0].host) + '</code>) and work the range: nmap, whatweb, gobuster, the leaked config, the staff login, then the box. <code>range ' + page + '</code> lists these same machines from the shell. Owning a PC pays the practice bank, and its FLAG can be submitted with <code>solve FLAG{…}</code>.</div>' +
        '<div class="nav">' + (page > 1 ? '<a class="btn" href="/?p=' + (page - 1) + '">← Previous page</a>' : '') +
        '<a class="btn" href="/?p=' + (page + 1) + '">Next page →</a><a class="btn" href="/pc/1">Machine 0001</a></div>' +
        '<table><tr><th>#</th><th>Machine</th><th>Address</th><th>OS</th><th>Role</th><th>Tier</th><th>From moundshell</th></tr>' + rows + '</table>' +
        '<div class="nav"><a class="btn" href="/?p=' + (page + 1) + '">Next page →</a></div>' +
        '<footer>Page ' + page + ' · machines ' + ((page - 1) * per + 1) + '–' + (page * per) + ' of ∞ · simulated entirely inside this page</footer>'
      )
    };
  }
  /* the banner a range PC's own site carries, so its console names the box it runs on */
  const rangeBanner = site => {
    const m = site && site.range;
    if (!m) return '';
    return '<div class="card" style="border-color:#2f4a6b;margin-bottom:16px">' +
      '<div style="display:flex;gap:10px;align-items:center;flex-wrap:wrap"><b>🖥 Range PC ' + String(m.n).padStart(4, '0') + '</b>' +
      '<span class="badge">' + esc(m.tier) + '</span><span class="badge">' + esc(m.ip) + '</span></div>' +
      '<p style="margin:6px 0 0;font-size:13.5px">' + esc(m.os) + ' · ' + esc(m.role) + ' · listening on ' + esc(m.ports) + ' — ' + esc(m.patch) + '.</p>' +
      '<p style="margin:6px 0 0;font-size:13px" class="mute">This web console runs on that PC. From moundshell: <code>breach ' + esc(m.host) + '</code> or <code>breach ' + esc(m.ip) + '</code>. The box\'s FLAG is printed on its staff page once you own it.</p></div>';
  };

  /* how hard the fake internet says each site is: the badge every card carries, colour-matched to the tier */
  const DIFF_COLOR = { 'extremely-easy': '#6ee7b7', easy: '#a3e635', medium: '#fcd34d', hard: '#fca5a5', extreme: '#f0abfc' };
  const DIFF_SHORT = { 'extremely-easy': 'extremely easy', easy: 'easy', medium: 'medium', hard: 'hard', extreme: 'extreme' };
  const siteTier = (site, catId) => (site && (site.sec ? site.sec.difficulty : site.difficulty)) || (catId && CAT_DIFFICULTY[catId]) || 'medium';
  const tierBadge = (tier, label) => '<span class="badge" style="color:' + (DIFF_COLOR[tier] || '#a9c2dd') + ';border-color:currentColor">' +
    esc((label || '') + (DIFF_SHORT[tier] || tier)) + '</span>';
  function portalServe(path, query) {
    ensure(BASE);
    const q = String(query.get('q') || '').trim();
    const catParam = String(query.get('cat') || '').trim().toLowerCase();
    const pageNum = Math.max(1, parseInt(query.get('p'), 10) || 1);
    if (path === '/robots.txt') return { status: 200, type: 'text/plain', body: 'User-agent: *\nDisallow: /admin\n' };
    if (path === '/random') {
      const target = next();
      return serve(target, '/', 'GET');
    }
    const cardOf = s => '<div class="card" style="margin-bottom:10px">' +
      '<div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap">' +
      '<b style="font-size:15.5px"><a href="https://' + esc(s.host) + '/">' + esc(s.brand) + '</a></b>' +
      '<span class="badge">' + esc(s.icon + ' ' + s.kind) + '</span>' +
      tierBadge(siteTier(s)) +
      (s.trapped ? '<span class="badge" style="color:#f87171">⚠ fake-virus trap</span>' : '') +
      '</div>' +
      '<small>https://' + esc(s.host) + ' · ' + esc(s.region || 'Web') + (s.topic ? ' · Topic: ' + esc(s.topic) : '') + '</small>' +
      '<p style="margin:6px 0 8px">' + esc(s.tagline) + '</p>' +
      '<div style="display:flex;gap:12px;font-size:12.5px;flex-wrap:wrap">' +
      '<a href="https://' + esc(s.host) + s.cat.route + '">' + esc(s.cat.routeLabel) + '</a>' +
      '<a href="https://' + esc(s.host) + '/article/1">Latest story</a>' +
      '<a href="https://' + esc(s.host) + '/documents">Documents</a>' +
      '<a href="https://' + esc(s.host) + '/login">Sign in</a>' +
      '</div></div>';
    const catOptions = '<option value="">All categories (' + CATS.length + ')</option>' +
      CATS.map(c => '<option value="' + esc(c.id) + '"' + (catParam === c.id ? ' selected' : '') + '>' +
        esc(c.icon + ' ' + c.label + ' · ' + (DIFF_SHORT[CAT_DIFFICULTY[c.id]] || 'medium')) + '</option>').join('');
    const head = '<div class="hero" style="padding:20px 22px"><h1 style="margin-bottom:4px">Moundshroud Fake Internet</h1>' +
      '<p class="lede" style="margin-bottom:12px">Search infinite generated websites across every category and any topic — separate from your downloaded offline libraries.</p>' +
      '<form action="/" method="get" style="display:flex;gap:8px;max-width:760px;flex-wrap:wrap">' +
      '<input name="q" value="' + esc(q) + '" placeholder="Search any topic (e.g. quantum robotics, ramen, space, crypto, leaks…)" style="flex:2;min-width:220px">' +
      '<select name="cat" style="flex:0 1 200px">' + catOptions + '</select>' +
      '<button type="submit">Search</button></form>' +
      '<p class="mute" style="margin:10px 0 0;font-size:12.5px">Every card carries the difficulty of that site — ' +
      ['extremely-easy', 'easy', 'medium', 'hard', 'extreme'].map(t => tierBadge(t)).join(' ') +
      ' — and each category chip shows the tier its sites are built to.</p></div>';
    const mailList = MAIL_SITES.map(m => catalog.find(s => s.host === m.host)).filter(Boolean);
    if (path === '/mail') {
      const extra = catalog.filter(s => !MAIL_SITES.some(m => m.host === s.host)).slice(0, 12);
      return { status: 200, type: 'text/html', body: shell(PORTAL, 'Cyber Mail sites', head +
        '<p class="lede">Every website linked by Cyber Desktop Mail — phishing drills (booby-trapped) and internal lab portals, plus generated fake-internet destinations.</p>' +
        '<h2>Cyber Mail &amp; phishing drill sites (' + mailList.length + ')</h2>' + mailList.map(cardOf).join('') +
        '<h2>More fake-internet sites sent in mail</h2>' + extra.map(cardOf).join('') +
        '<p><a class="btn" href="/all">Browse infinite directory →</a></p>') };
    }
    if (path === '/dark') {
      /* the Fake Dark Web is its own section: onion-only services, listed here and reachable from the Browser's chip */
      const darks = A.cyberDark ? A.cyberDark.all() : [];
      const card = s => '<div class="card" style="margin-bottom:10px;border-left:3px solid ' + esc(s.accent || '#38bdf8') + '">' +
        '<div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap"><b style="font-size:15.5px"><a href="https://' + esc(s.host) + '/">' + esc(s.brand) + '</a></b>' +
        '<span class="badge">' + esc(s.icon + ' ' + s.kind) + '</span>' + (s.market ? '<span class="badge" style="color:#fbbf24">market · sells</span>' : '<span class="badge">no sales</span>') + '</div>' +
        '<small>' + esc(s.host) + ' · ' + esc(s.topic || 'onion service') + ' · ' + (s.market ? 'escrow market' : 'information service') + '</small>' +
        '<p style="margin:6px 0 6px">' + esc(s.tagline) + '</p></div>';
      return { status: 200, type: 'text/html', body: shell(PORTAL, 'Fake Dark Web', head +
        '<p class="lede">The second, separate section of this simulated internet: ' + darks.length + ' Tor-style hidden services on .onion addresses, each with its own layout and its own backend. Only the services that really are markets sell anything.</p>' +
        '<p><span class="pill">Every address, vendor and leak below is invented inside this page.</span> <span class="pill">Reachable from moundshell with curl, wget and browser.</span></p>' +
        darks.map(card).join('') +
        '<p><a class="btn" href="https://' + esc(A.cyberDark ? A.cyberDark.portalHost : 'darknet-index.onion') + '/">Open The Onion Index (the dark directory) →</a></p>') };
    }
    if (path === '/trapped') {
      const per = 25, needTotal = pageNum * per;
      while (catalog.filter(s => s.trapped).length < needTotal) make({ trapped: true });
      const list = catalog.filter(s => s.trapped);
      const slice = list.slice((pageNum - 1) * per, pageNum * per);
      const nav = '<div class="hero-row" style="margin:12px 0">' +
        (pageNum > 1 ? '<a class="btn-ghost" href="/trapped?p=' + (pageNum - 1) + '">← Previous</a>' : '') +
        '<span class="mute">Page ' + pageNum + ' · ' + list.length + '+ booby-trapped sites generated</span>' +
        '<a class="btn" href="/trapped?p=' + (pageNum + 1) + '">Next page (generate more) →</a></div>';
      return { status: 200, type: 'text/html', body: shell(PORTAL, 'Unsafe / fake-virus sites', head +
        '<p class="lede">Infinite booby-trapped fake-internet sites that trigger the simulated Cyber Desktop pop-up virus (anti-malware or <code>virus clean</code> removes them).</p>' +
        nav + slice.map(cardOf).join('') + nav) };
    }
    if ((path === '/all' || path === '/results') && !q && !catParam) {
      const per = 30, needTotal = pageNum * per;
      if (catalog.length < needTotal) ensure(needTotal);
      const slice = catalog.slice((pageNum - 1) * per, pageNum * per);
      const nav = '<div class="hero-row" style="margin:12px 0">' +
        (pageNum > 1 ? '<a class="btn-ghost" href="/all?p=' + (pageNum - 1) + '">← Previous</a>' : '') +
        '<span class="mute">Showing ' + ((pageNum - 1) * per + 1) + '–' + (pageNum * per) + ' · ' + catalog.length + '+ sites (grows infinitely)</span>' +
        '<a class="btn" href="/all?p=' + (pageNum + 1) + '">Next page (generate more) →</a></div>';
      return { status: 200, type: 'text/html', body: shell(PORTAL, 'All sites', head + nav + slice.map(cardOf).join('') + nav) };
    }
    if (!q && !catParam) {
      const surprise = random();
      const trend = Array.from({ length: 12 }, () => pick(SUBJECTS)).filter((v, i, a) => a.indexOf(v) === i);
      const featuredFlagships = FLAGSHIP_SITES.map(f => catalog.find(s => s.host === f.host)).filter(Boolean).slice(0, 12);
      const quick = '<div class="hero-row" style="margin:0 0 18px">' +
        '<a class="btn" href="https://' + esc(surprise.host) + '/">Surprise me</a>' +
        '<a class="btn-ghost" href="/random">Random site</a>' +
        '<a class="btn-ghost" href="/mail">Cyber Mail sites</a>' +
        '<a class="btn-ghost" href="/trapped">Unsafe / virus sites</a>' +
        '<a class="btn" href="https://vault.moundshroud.example/">🎁 Surplus Vault (rewards)</a>' +
        '<a class="btn" href="/dark">🧅 Fake Dark Web</a>' +
        '<a class="btn-ghost" href="/all">Infinite directory (' + catalog.length + '+)</a>' +
        '<a class="btn-ghost" href="https://' + RANGE_HOST + '/">🖥 Open Range (endless practice PCs)</a></div>';
      return { status: 200, type: 'text/html', body: shell(PORTAL, 'Search', head + quick +
        '<h2>Featured Flagship Websites</h2><div class="web-net" style="margin-bottom:20px">' +
        featuredFlagships.map(s => '<a class="web-card" href="https://' + esc(s.host) + '/">' +
          '<div style="display:flex;align-items:center;gap:8px"><span>' + esc(s.icon) + '</span><b>' + esc(s.brand) + '</b></div>' +
          '<span class="badge" style="align-self:flex-start">' + esc(s.kind) + ' · ' + esc(s.region) + '</span>' +
          tierBadge(siteTier(s)) +
          '<small>' + esc(s.tagline) + '</small><small style="margin-top:auto;opacity:.75">https://' + esc(s.host) + ' →</small></a>').join('') + '</div>' +
        '<h2>🧅 Fake Dark Web — the separate onion section</h2>' +
        '<p class="lede" style="margin-bottom:12px">Tor-style hidden services, written by hand with their own layouts and backends. Only the markets sell; the leak site, the paper, the drop, the forum and the directory do not.</p>' +
        '<div class="web-net" style="margin-bottom:20px">' + (A.cyberDark ? A.cyberDark.all() : []).slice(0, 8).map(s =>
          '<a class="web-card" href="https://' + esc(s.host) + '/" style="border-color:' + esc(s.accent || '#38bdf8') + '">' +
          '<div style="display:flex;align-items:center;gap:8px"><span>' + esc(s.icon) + '</span><b>' + esc(s.brand) + '</b></div>' +
          '<span class="badge" style="align-self:flex-start">' + esc(s.kind) + (s.market ? ' · market' : ' · no sales') + '</span>' +
          '<small>' + esc(s.tagline) + '</small><small style="margin-top:auto;opacity:.75">https://' + esc(s.host) + ' →</small></a>').join('') + '</div>' +
        '<p><a class="btn" href="/dark">All onion services →</a> <a class="btn-ghost" href="https://' + esc(A.cyberDark ? A.cyberDark.portalHost : 'darknet-index.onion') + '/">The Onion Index →</a></p>' +
        '<h2>Trending topics (infinite search)</h2><div style="display:flex;gap:6px;flex-wrap:wrap;margin-bottom:14px">' +
        trend.map(t => '<a class="pill" href="/?q=' + encodeURIComponent(t) + '">' + esc(cap(t)) + '</a>').join('') + '</div>' +
        '<h2>Browse by category (' + CATS.length + ' categories — infinite topics in every one)</h2><div style="display:flex;gap:6px;flex-wrap:wrap;margin-bottom:18px">' +
        CATS.map(c => '<a class="pill" href="/?cat=' + encodeURIComponent(c.id) + '">' + esc(c.icon + ' ' + c.label) +
          '<span style="opacity:.7"> · ' + esc(DIFF_SHORT[CAT_DIFFICULTY[c.id]] || 'medium') + '</span></a>').join('') + '</div>' +
        '<h2>Cyber Mail &amp; phishing sites</h2>' + mailList.slice(0, 6).map(cardOf).join('') +
        '<p><a href="/mail">See all Cyber Mail sites →</a></p>') };
    }
    const per = 20, needTotal = pageNum * per;
    const catObj = catParam ? CATS.find(c => c.id === catParam || c.label.toLowerCase() === catParam) : null;
    const hits = search(q, needTotal, { grow: true, catId: catObj ? catObj.id : '' });
    const slice = hits.slice((pageNum - 1) * per, pageNum * per);
    const qsBase = (q ? 'q=' + encodeURIComponent(q) : '') + (catObj ? (q ? '&' : '') + 'cat=' + encodeURIComponent(catObj.id) : '');
    const pageHref = p => '/?' + (qsBase ? qsBase + '&' : '') + 'p=' + p;
    const nav = '<div class="hero-row" style="margin:12px 0">' +
      (pageNum > 1 ? '<a class="btn-ghost" href="' + pageHref(pageNum - 1) + '">← Previous</a>' : '') +
      '<span class="mute">Page ' + pageNum + ' · showing ' + slice.length + ' sites (' + hits.length + '+ indexed for this query)</span>' +
      '<a class="btn" href="' + pageHref(pageNum + 1) + '">Next page (generate more) →</a></div>';
    const heading = (catObj ? catObj.icon + ' ' + catObj.label : 'Search results') + (q ? ' · “' + q + '”' : '');
    const headingBadge = catObj ? ' ' + tierBadge(CAT_DIFFICULTY[catObj.id] || 'medium', 'category · ') : '';
    const subChips = catObj
      ? '<div style="display:flex;gap:6px;flex-wrap:wrap;margin:6px 0 14px">' +
        Array.from({ length: 6 }, () => pick(SUBJECTS)).filter((v, i, a) => a.indexOf(v) === i).map(t =>
          '<a class="pill" href="/?q=' + encodeURIComponent(t) + '&cat=' + encodeURIComponent(catObj.id) + '">' + esc(cap(t)) + '</a>').join('') + '</div>'
      : '';
    return { status: 200, type: 'text/html', body: shell(PORTAL, heading, head +
      '<h2>' + esc(heading) + headingBadge + '</h2>' + subChips + nav + slice.map(cardOf).join('') + nav) };
  }

  A.cyberWeb = {
    ensure, all, trapped, site, more, find, search, serve, homeHtml, locate, visit, resolve, byIp, routes, dirScan, random, next,
    isMarket: isMarketSite, onAction, recordAction,
    /* the Fake Dark Web section, separate from the generated internet but resolved by the same commands */
    dark: () => (A.cyberDark ? A.cyberDark.all() : []),
    darkPortal: 'https://' + (A.cyberDark ? A.cyberDark.portalHost : 'darknet-index.onion') + '/',
    isDarkHost: raw => /(?:^|\/\/)(?:[a-z0-9-]+\.)+onion(?:$|[\/:?#])/i.test(String(raw || '')),
    mailHosts: () => MAIL_SITES.map(m => m.host),
    /* the walkthrough reads a target the same way, with the practice bank's payouts switched off for its requests */
    serveSilent: (site, raw, method) => serve(site, raw, method, { silent: true }),
    count: () => { ensure(BASE); return catalog.length; },
    portal: PORTAL, portalUrl: q => 'https://' + SEARCH_HOST + '/?q=' + encodeURIComponent(String(q == null ? '' : q)),
    CATS,
    /* the Open Range website: endless invented PCs, breached from moundshell */
    range: {
      host: RANGE_HOST,
      site: RANGE,
      machine: n => rangeMachine(n),
      siteFor: n => rangeSiteFor(n),
      byIp: ip => { const m = rangeMachineByIp(ip); return m ? rangeMachine(m.n) : null; },
      list: (page, per) => rangeMachines(page, per),
      pageUrl: p => 'https://' + RANGE_HOST + (p && p > 1 ? '/?p=' + p : '/'),
      pcUrl: n => 'https://' + RANGE_HOST + '/pc/' + Math.max(1, Math.floor(Number(n) || 1))
    },
    /* a short, stable label for anywhere that lists sites */
    label: s => s.brand + '  ·  ' + s.host,
    bridgeScript: BRIDGE_SCRIPT
  };
})();

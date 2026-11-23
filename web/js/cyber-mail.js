// Cyber > Cyber Desktop > Mail. A mail client with an inbox, a junk folder and categories that sort
// themselves. Phishing drills mostly land in Junk — and sometimes get through to the inbox, which is the
// lesson — and reporting one pays a small bounty into the practice bank. Every message is invented here.
(() => {
  const esc = value => String(value == null ? '' : value).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
  const pick = list => list[Math.floor(Math.random() * list.length)];
  const id = () => 'm' + Math.random().toString(36).slice(2, 10);
  const INBOX_ADDRESS = 'moundshroud@moundshroud.lab';
  const TRUSTED = /@moundshroud\.lab$/i;

  /* ---- categories: every message gets one, chosen from what it says ------------------------------------- */
  const CATEGORIES = ['Work', 'Security', 'Finance', 'People', 'Updates'];
  const RULES = [
    ['Security', /\b(password|passphrase|sign[- ]?in|log[- ]?in|two[- ]factor|2fa|mfa|verif(y|ication)|security alert|breach|phishing|suspicious|account (review|locked|access))\b/i],
    ['Finance', /\b(payroll|salary|invoice|receipt|payment|paid|bank|transfer|budget|expense|refund|billing|card)\b/i],
    ['People', /\b(lunch|coffee|birthday|drinks|weekend|holiday|thank|thanks|congrat|team night|leaving)\b/i],
    ['Updates', /\b(newsletter|digest|release notes|changelog|weekly round|maintenance window|patch schedule|report is ready|dashboard)\b/i]
  ];
  const categoryOf = message => {
    const haystack = [message.from, message.subject, message.body].join(' ');
    for (const [name, pattern] of RULES) if (pattern.test(haystack)) return name;
    return 'Work';
  };

  /* ---- how phishy does a message look? 0 is ordinary, 4 or more paints a warning ------------------------ */
  const PHISH_SIGNS = [
    [2, /\b(password|one[- ]?time (code|passcode)|otp|security code|confirm your (details|login|password)|re[- ]?verify)\b/i, 'asks for a password or a code'],
    [2, /\b(urgent|immediately|right away|today|expires|within \d+ (hours|minutes)|final (notice|warning)|suspend(ed)?|locked|deleted)\b/i, 'pushes you to act now'],
    [1, /\/login|\/verify|\/account|\/signin|\.zip\b|\.exe\b|\.htm\b/i, 'points at a sign-in page or an attachment'],
    [1, /\b(card details|bank details|gift card|wire transfer|payroll portal|billing portal)\b/i, 'asks for payment or bank details'],
    [1, /\b(account (team|protection|security)|service desk|billing department|administrator)\b/i, 'signs off as a department, not a person']
  ];
  function phishScore(message) {
    if (TRUSTED.test(message.address)) return 0;
    const haystack = message.subject + '\n' + message.body;
    let score = 0;
    const signs = [];
    for (const [weight, pattern, why] of PHISH_SIGNS) if (pattern.test(haystack)) { score += weight; signs.push(why); }
    if (message.attachment) { score += 1; signs.push('carries an attachment'); }
    return { score, signs };
  }

  /* ---- seed mail: ordinary work, one or two drills, a newsletter ---------------------------------------- */
  const PEOPLE = [
    ['Maya Chen, Platform', 'maya.chen@moundshroud.lab'], ['Dev Patel, Network', 'dev.patel@moundshroud.lab'],
    ['Ruth Okafor, HR', 'ruth.okafor@moundshroud.lab'], ['Sam Ortiz, Facilities', 'sam.ortiz@moundshroud.lab'],
    ['Priya Nair, Finance', 'priya.nair@moundshroud.lab'], ['Tom Alvarez, On-call', 'tom.alvarez@moundshroud.lab']
  ];
  const SEED = [
    ['Maya Chen, Platform', 'maya.chen@moundshroud.lab', 'Deploy window moved to Thursday',
      'The deploy window moved to Thursday at 02:00. Nothing to do until then.\n\nI have updated the runbook and put the rollback steps at the top where they belong: https://runbook.moundshroud.lab/docs'],
    ['Priya Nair, Finance', 'priya.nair@moundshroud.lab', 'Expense claim for the cable order',
      'The invoice for the cable order cleared this morning, so the expense claim is closed.\n\nReceipt is attached to the ticket if anyone asks: https://helpdesk.moundshroud.lab/login'],
    ['Ruth Okafor, HR', 'ruth.okafor@moundshroud.lab', 'Lunch on Friday?',
      'A few of us are going for lunch on Friday, somewhere near the office. Want to come along?\n\nNo agenda, no slides.'],
    ['Dev Patel, Network', 'dev.patel@moundshroud.lab', 'Weekly report is ready',
      'The weekly network report is ready in the shared folder. Nothing alarming: two flaps on the lab switch, both explained.'],
    ['Security Desk', 'security@moundshroud.lab', 'Two-factor is now required for the lab VPN',
      'From next Monday the lab VPN requires two-factor. Enrol this week from the internal account page: https://accounts.moundshroud.lab/account\n\nThis change is in the maintenance window notice.'],
    ['Operations Digest', 'digest@status-page.example', 'Your weekly digest: 4 incidents, 1 maintenance window',
      'Four incidents this week, three closed. One maintenance window on Thursday.\n\nRead the full digest on the status page: https://status.moundshroud.lab/status'],
    ['Sam Ortiz, Facilities', 'sam.ortiz@moundshroud.lab', 'The badge reader in the corridor',
      'The badge reader in the corridor is being replaced on Wednesday morning, so use the side door before 10:00.']
  ];
  /* Every drill carries a link to a look-alike site, because that is what a credential phish actually is: the link
     is the whole attack. Clicking one here opens an invented site, never a real address. Each drill also carries the
     things a recipient can actually check: the sender's real domain, a Reply-To on another domain, SPF and DKIM
     results, and a link whose visible text names one host while the destination is another. */
  const DRILLS = [
    { from: 'IT Service Desk', address: 'it-service@moundshroud-help.example', claims: 'moundshroud.lab',
      subject: 'Action required: re-verify your staff credentials',
      body: 'Your mailbox password expires today at 17:00.\n\nTo keep your account, sign in through the verification page below and confirm your current password. Accounts that are not verified are locked automatically and mail is held for seven days.\n\n[[moundshroud.lab/login|https://moundshroud-help.example/login]]\n\nIT Service Desk · ticket #SR-44821',
      kind: 'signin', why: 'it asks for your current password through a link, which a real service desk never does',
      hdr: { spf: 'FAIL', dkim: 'NONE', relay: '41.203.117.4', replyTo: 'tickets@desk-mailer.example' } },
    { from: 'Payroll', address: 'payroll@moundshroud-pay.example', claims: 'moundshroud.lab',
      subject: 'Your salary payment was rejected',
      body: 'The bank rejected this month\'s transfer because your account details did not match.\n\nOpen the payroll portal and confirm your bank details and your login before Friday, or payment moves to next month:\n\n[[payroll.moundshroud.lab|https://moundshroud-pay.example/verify]]',
      kind: 'signin', why: 'it asks you to re-enter bank details after a payment scare',
      hdr: { spf: 'SOFTFAIL', dkim: 'NONE', relay: '45.155.204.19', replyTo: 'refunds@payment-notice.example' } },
    { from: 'Account Protection', address: 'no-reply@account-review.example', claims: 'accounts.moundshroud.lab',
      subject: 'Unusual sign-in from 41.203.117.4',
      body: 'We blocked a sign-in to your account from an unfamiliar location.\n\nIf this was not you, verify your identity within 24 hours and change your password. The review link stays open for one day only:\n\n[[accounts.moundshroud.lab/login|https://account-review.example/login]]',
      kind: 'signin', why: 'the address that "signed in" is the same one this message was relayed from',
      hdr: { spf: 'FAIL', dkim: 'NONE', relay: '41.203.117.4', replyTo: 'no-reply@account-review.example' } },
    { from: 'Billing Department', address: 'billing@invoice-portal.example', claims: 'invoices.moundshroud.lab',
      subject: 'Invoice 88421 is overdue — final notice',
      body: 'Invoice 88421 is now overdue and the account will be suspended today.\n\nOpen the invoice to pay immediately, or confirm your card details so the payment can be retried:\n\n[[invoices.moundshroud.lab/88421|https://invoice-portal.example/login]]',
      kind: 'attachment', attachment: 'invoice_88421.html', why: 'an .html attachment that asks for card details',
      hdr: { spf: 'NONE', dkim: 'NONE', relay: '89.248.165.74', replyTo: 'billing@invoice-portal.example' } }
  ];
  /* Lures that point at a trapped site from the browser's own library, so the link really opens one of the
     booby-trapped fake websites and the message still carries checkable signs: an unknown sender domain, a link that
     leaves it, and a host that has nothing to do with what the message claims to be. */
  const LURES = [
    { from: 'Document Share', address: 'share@file-share-notice.example',
      subject: 'A document has been shared with you',
      lead: 'A document has been shared with you and will be removed in 24 hours.\n\nOpen it with your work email address to confirm you are the recipient:',
      link: 'Open the document', path: '/documents',
      why: 'it wants your work email address on a page you reached from a link' },
    { from: 'Parcel Tracking', address: 'tracking@parcel-redelivery.example',
      subject: 'Delivery held: a $2.99 redelivery fee is unpaid',
      lead: 'A parcel is being held at the depot because a redelivery fee was not paid.\n\nPay today or the parcel goes back to the sender:',
      link: 'Pay the redelivery fee',
      why: 'a small, urgent fee for a parcel you were never told about' },
    { from: 'Voicemail', address: 'no-reply@voice-message.example',
      subject: 'New voicemail (0:47)',
      lead: 'You have a new voicemail from an unknown caller.\n\nListen before it expires:',
      link: 'Play the voicemail', path: '/login',
      why: 'a voicemail that needs a sign-in before you can hear it' }
  ];
  const hostOf = address => String(address == null ? '' : address).replace(/^[^@]*@/, '').toLowerCase();
  const urlHost = href => (/^https?:\/\/([^/?#]+)/i.exec(String(href == null ? '' : href)) || [])[1] || '';
  const trappedSites = () => (A.cyberWeb && A.cyberWeb.trapped ? A.cyberWeb.trapped() : []);

  /* ---- website missions: every email with a link gives a concrete task on that website & pays into the Bank ---- */
  const MISSIONS_KEY = 'cyber_mail_missions_v1';
  const uiSyncListeners = new Set();
  const loadMissionRegistry = () => {
    try {
      const parsed = JSON.parse(ls.get(MISSIONS_KEY, '{}') || '{}');
      return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {};
    } catch (e) { return {}; }
  };
  let missionRegistry = loadMissionRegistry();
  const saveMissionRegistry = () => {
    try {
      const entries = Object.entries(missionRegistry);
      if (entries.length > 250) {
        entries.sort((a, b) => (a[1].createdAt || 0) - (b[1].createdAt || 0));
        missionRegistry = Object.fromEntries(entries.slice(-180));
      }
      ls.set(MISSIONS_KEY, JSON.stringify(missionRegistry));
    } catch (e) { }
  };
  const extractUrl = text => {
    const s = String(text == null ? '' : text);
    const bracket = /\[\[[^|\]]*\|(https?:\/\/[^\]]+)\]\]/i.exec(s);
    if (bracket) return bracket[1].trim();
    const plain = /(https?:\/\/[^\s<>"']+)/i.exec(s);
    if (plain) return plain[1].replace(/[.,;:!?]+$/, '');
    return '';
  };
  const hashStr = s => {
    let h = 2166136261;
    const t = String(s || '');
    for (let i = 0; i < t.length; i++) { h ^= t.charCodeAt(i); h = Math.imul(h, 16777619); }
    return h >>> 0;
  };
  const resolveSite = hostOrSite => {
    if (!hostOrSite) return null;
    if (typeof hostOrSite === 'object' && hostOrSite.host) return hostOrSite;
    const clean = String(hostOrSite).replace(/^https?:\/\//i, '').replace(/\/.*$/, '').trim().toLowerCase();
    if (!clean) return null;
    const web = A.cyberWeb;
    if (!web) return null;
    try {
      if (web.find) { const hit = web.find(clean); if (hit && !hit.portal) return hit; }
      if (web.locate) { const loc = web.locate(clean); if (loc && loc.site && !loc.site.portal) return loc.site; }
      if (web.visit) { const v = web.visit(clean); if (v && v.site && !v.site.portal) return v.site; }
    } catch (e) { }
    return null;
  };
  function buildMission(siteOrHost, url, opts) {
    opts = opts || {};
    const site = resolveSite(siteOrHost);
    const host = (site ? site.host : urlHost(url)).toLowerCase();
    if (!host) return null;
    const brand = site ? site.brand : host;
    const route = (site && site.cat && site.cat.route) || '/';
    const routeLabel = (site && site.cat && site.cat.routeLabel) || 'main section';
    const sec = site && site.sec ? site.sec : null;
    const diff = (sec && sec.difficulty) || (site && site.difficulty) || 'easy';
    const diffBonus = diff === 'extreme' ? 120 : diff === 'hard' ? 80 : diff === 'medium' ? 40 : 0;
    const loginPath = (sec && sec.loginPath) || '/login';
    const isMarket = !!(site && (site.isMarket || (A.cyberWeb && A.cyberWeb.isMarket && A.cyberWeb.isMarket(site))));
    const seed = hashStr(host + '|' + (opts.salt || '') + '|' + (opts.isPhish ? 'phish' : 'std'));
    const mid = 'msn-' + seed.toString(36) + '-' + (opts.idHint || Math.random().toString(36).slice(2, 6));
    const targetUrl = url || ('https://' + host + route);

    if (opts.isPhish) {
      return {
        id: mid, host, brand, url: targetUrl, type: 'phish-triage',
        actions: ['phish-report', 'env', 'trap-inspected', 'staff'],
        title: 'Inspect & neutralize suspicious link (' + host + ')',
        instruction: 'Check the sender headers and real destination (' + host + '). Report this message as phishing here in Mail — or safely audit ' + host + ' and uncover its exposed config/trap script — to earn your Bank reward.',
        reward: 65, done: false, createdAt: Date.now(), completedAt: 0
      };
    }

    const candidates = [
      {
        type: 'audit-recon',
        actions: ['env'],
        reward: 75 + diffBonus,
        title: 'Locate exposed configuration on ' + brand,
        instruction: 'Open ' + host + ' (in Moundshroud Browser or via Moundshell with gobuster / curl), inspect /robots.txt and any discovery paths, and retrieve its exposed staff configuration file.'
      },
      {
        type: 'staff-access',
        actions: ['staff', 'access'],
        reward: 110 + diffBonus,
        title: 'Gain staff access on ' + brand,
        instruction: 'Investigate ' + host + ', find valid staff credentials (or a login flaw if vulnerable), sign in at ' + loginPath + ', and open the staff dashboard.'
      },
      {
        type: 'backup-capture',
        actions: ['backup'],
        reward: 150 + diffBonus,
        title: 'Pull the backup archive from ' + brand,
        instruction: 'Gain staff access on ' + host + ' and download the site backup archive (backup.zip) from the staff dashboard.'
      },
      {
        type: 'deface-banner',
        actions: ['content'],
        reward: 140 + diffBonus,
        title: 'Post an authorized notice on ' + brand,
        instruction: 'Gain staff access on ' + host + ', open Edit Home Page from the staff dashboard, and publish an updated headline/notice.'
      },
      {
        type: 'public-audit',
        actions: ['contact'],
        reward: 55,
        title: 'Review ' + brand + ' & file a contact report',
        instruction: 'Visit ' + host + ', review its ' + routeLabel.toLowerCase() + ' (' + route + ') and /about details, then submit your review via the /contact form.'
      }
    ];
    if (isMarket) {
      candidates.push({
        type: 'market-order',
        actions: ['checkout'],
        reward: 60,
        title: 'Verify checkout flow on ' + brand,
        instruction: 'Open ' + host + ', browse ' + routeLabel.toLowerCase() + ' (' + route + '), add an item to the cart, and place a test order through /checkout.'
      });
    } else {
      candidates.push({
        type: 'community-post',
        actions: ['comment'],
        reward: 50,
        title: 'Review & post feedback on ' + brand,
        instruction: 'Open ' + host + ', read the featured ' + (site && site.theme === 'community' ? 'discussion thread (/thread/1)' : 'article (/article/1)') + ', and post a comment or reply.'
      });
    }

    const chosen = opts.type
      ? (candidates.find(c => c.type === opts.type) || candidates[seed % candidates.length])
      : candidates[seed % candidates.length];
    return {
      id: mid, host, brand, url: targetUrl, type: chosen.type, actions: chosen.actions.slice(),
      title: chosen.title, instruction: chosen.instruction, reward: chosen.reward,
      difficulty: diff, done: false, createdAt: Date.now(), completedAt: 0
    };
  }
  function registerMission(m) {
    if (!m || !m.id || !m.host) return null;
    const prev = missionRegistry[m.id];
    if (prev && prev.done) {
      m.done = true;
      m.completedAt = prev.completedAt || Date.now();
    }
    missionRegistry[m.id] = Object.assign({}, m);
    saveMissionRegistry();
    return m;
  }
  function completeMission(mission, reason) {
    if (!mission || mission.done) return false;
    mission.done = true;
    mission.completedAt = Date.now();
    mission.reason = reason || 'verified';
    if (missionRegistry[mission.id]) {
      missionRegistry[mission.id].done = true;
      missionRegistry[mission.id].completedAt = mission.completedAt;
      missionRegistry[mission.id].reason = mission.reason;
      saveMissionRegistry();
    }
    /* update saved mailbox on disk too so reopening Mail reflects completion */
    try {
      const saved = JSON.parse(ls.get('cyber_mail', 'null'));
      if (Array.isArray(saved)) {
        let touched = false;
        for (const row of saved) {
          if (row && row.mission && row.mission.id === mission.id) {
            row.mission.done = true;
            row.mission.completedAt = mission.completedAt;
            touched = true;
          }
        }
        if (touched) ls.set('cyber_mail', JSON.stringify(saved));
      }
    } catch (e) { }
    const paid = !!(A.cyberBank && A.cyberBank.once && A.cyberBank.once(
      'mail-mission:' + mission.id,
      mission.reward,
      'Email mission: ' + mission.title + ' (' + mission.host + ')',
      'mission',
      'cases'
    ));
    if (paid && typeof A !== 'undefined' && A.toast) {
      A.toast('🏆 Mission complete on ' + mission.host + '! +$' + mission.reward + ' credited to your Bank.', 5200);
    }
    for (const fn of [...uiSyncListeners]) { try { fn(mission); } catch (e) { } }
    return paid;
  }
  function handleSiteAction(ev) {
    if (!ev || !ev.host || !ev.action) return;
    const host = String(ev.host).toLowerCase();
    const action = String(ev.action);
    for (const m of Object.values(missionRegistry)) {
      if (!m || m.done || m.host !== host) continue;
      if (Array.isArray(m.actions) && m.actions.includes(action)) {
        completeMission(m, action);
      }
    }
  }
  let webHooked = false;
  const hookWebActions = () => {
    if (webHooked) return;
    if (A.cyberWeb && typeof A.cyberWeb.onAction === 'function') {
      webHooked = true;
      A.cyberWeb.onAction(handleSiteAction);
    }
  };
  hookWebActions();
  if (A.ready && Array.isArray(A.ready)) A.ready.push(hookWebActions);

  /* a lure keeps the message shape but swaps in a host from the browser library that really is trapped */
  const lure = spec => {
    const list = trappedSites();
    if (!list.length) return null;
    const site = pick(list);
    const href = 'https://' + site.host + (spec.path || (site.cat && site.cat.route) || '/');
    return {
      from: spec.from, address: spec.address, claims: null, subject: spec.subject, kind: 'link',
      body: spec.lead + '\n\n[[' + spec.link + '|' + href + ']]\n\n' + site.brand + ' · automated message, do not reply',
      why: spec.why,
      hdr: { spf: 'FAIL', dkim: 'NONE', relay: '185.220.101.44', replyTo: 'postmaster@' + site.host }
    };
  };

  function ensureMissionOnMessage(built, opts) {
    if (!built) return built;
    const url = extractUrl(built.body);
    if (!url) return built;
    const host = urlHost(url).toLowerCase();
    if (!host) return built;
    if (built.mission && built.mission.id && built.mission.host) {
      const reg = missionRegistry[built.mission.id];
      if (reg && reg.done) {
        built.mission.done = true;
        built.mission.completedAt = reg.completedAt || built.mission.completedAt || Date.now();
      } else {
        registerMission(built.mission);
      }
      return built;
    }
    const isPhish = !!(opts && opts.isPhish) || (Number(built.phish) || 0) >= 4;
    const m = buildMission(host, url, { isPhish, salt: built.id || built.subject, idHint: (built.id || '').slice(0, 6) });
    if (m) {
      built.mission = registerMission(m);
      if (!/\bMission:/i.test(built.body)) {
        built.body = built.body + '\n\nMission (+$' + m.reward + ' Bank reward): ' + m.instruction;
        built.preview = built.body.replace(/\[\[[^|\]]*\|([^\]]*)\]\]/g, '$1').replace(/\s+/g, ' ').slice(0, 96);
      }
    }
    return built;
  }

  function message(from, address, subject, body, extra) {
    hookWebActions();
    const text = String(body);
    const built = Object.assign({
      id: id(), from, address, subject, body: text, at: Date.now(), unread: true,
      folder: 'inbox', starred: false, reported: false, attachment: '',
      preview: text.replace(/\[\[[^|\]]*\|([^\]]*)\]\]/g, '$1').replace(/\s+/g, ' ').slice(0, 96)
    }, extra || {});
    built.category = extra && extra.category ? extra.category : categoryOf(built);
    const verdict = phishScore(built);
    built.phish = verdict.score;
    built.signs = verdict.signs;
    if (!(extra && extra.skipMission)) ensureMissionOnMessage(built, { isPhish: built.phish >= 4 });
    return built;
  }
  /* a drill either goes to Junk or — about a third of the time — straight to the inbox, which is the point */
  function drill() {
    const spec = (Math.random() < .45 ? lure(pick(LURES)) : null) || pick(DRILLS);
    const built = message(spec.from, spec.address, spec.subject, spec.body, {
      attachment: spec.kind === 'attachment' ? (spec.attachment || 'invoice_88421.html') : '', sent: true, skipMission: true
    });
    const hdr = Object.assign({ spf: 'FAIL', dkim: 'NONE', relay: '41.203.117.4' }, spec.hdr || {});
    const marker = /\[\[([^|\]]*)\|([^\]]*)\]\]/.exec(spec.body) || [];
    const link = marker[1] ? { text: marker[1].trim(), href: marker[2].trim() } : null;
    /* the concrete things a careful reader can check, in the order they check them */
    const signs = [];
    if (spec.claims && hostOf(spec.address) !== hostOf(spec.claims)) {
      signs.push('it says it is ' + spec.claims + ' but came from ' + hostOf(spec.address));
    }
    if (link) {
      const to = urlHost(link.href).toLowerCase();
      const shown = /^(?:https?:\/\/)?([a-z0-9-]+(?:\.[a-z0-9-]+)+)/i.exec(link.text);
      const shownHost = shown ? shown[1].toLowerCase() : '';
      signs.push(shownHost && shownHost !== to
        ? 'the link text says ' + shownHost + ' but the real destination is ' + to
        : 'the link goes to ' + to + ', which has nothing to do with ' + hostOf(spec.address));
      if (hdr.spf !== 'PASS') signs.push('SPF ' + hdr.spf + ' and DKIM ' + hdr.dkim + ' for ' + hostOf(spec.address));
    }
    if (hdr.replyTo && hostOf(hdr.replyTo) !== hostOf(spec.address)) {
      signs.push('replies would go to ' + hostOf(hdr.replyTo) + ', not the sender');
    }
    if (spec.why) signs.push(spec.why);
    built.hdr = hdr;
    built.link = link;
    built.signs = signs.concat(built.signs.filter(reason => signs.indexOf(reason) < 0));
    built.evidence = [['From', spec.from + ' <' + spec.address + '>'],
      ['Reply-To', hdr.replyTo || spec.address],
      ['SPF', hdr.spf + ' · sending relay ' + hdr.relay],
      ['DKIM', hdr.dkim]
    ].concat(link ? [['Link text', link.text], ['Real destination', urlHost(link.href).toLowerCase() +
      (link.href.replace(/^https?:\/\/[^/]+/i, '') || '/')]] : []);
    /* these messages are drills by construction: whatever the wording scores, they carry the warning */
    built.phish = Math.max(built.phish, 4);
    ensureMissionOnMessage(built, { isPhish: true });
    const through = Math.random() < .34;
    built.folder = through ? 'inbox' : 'junk';
    built.slipped = through;
    built.sortNote = through ? 'Bulk checks score it as marketing. It is not.' : 'Held by the junk filter: ' + (built.signs[0] || 'it looks like a drill');
    return built;
  }
  /* ordinary mail links into the browser's own library: a real generated site and one of its real routes */
  const withLink = (text, path, siteOpt) => {
    const web = A.cyberWeb;
    if (!web || !web.random) return text;
    const site = resolveSite(siteOpt) || web.random();
    const route = path || (site.cat && site.cat.route) || '/';
    const lead = pick(['The page is here:', 'Target site:', 'They sent this address:', 'Details:',
      'Please check ' + site.brand + ':', 'Action needed on ' + site.brand + ':']);
    return text + '\n\n' + lead + '\nhttps://' + site.host + route;
  };
  function createMissionMail(siteOrHost) {
    const web = A.cyberWeb;
    const site = resolveSite(siteOrHost) || (web && web.random ? web.random() : null);
    if (!site) return null;
    const [from, address] = pick(PEOPLE);
    const route = (site.cat && site.cat.route) || '/';
    const body = withLink('We have a new website assignment for ' + site.brand + ' (' + site.kind + ').\n\nFollow the mission brief below — once it is completed on the website, your reward is paid straight into your Bank.', route, site);
    return message(from, address, 'Mission: ' + site.brand + ' (' + site.host + ')', body, { category: 'Work' });
  }
  /* Every address in a message is a live link: a full URL, a www. host, or a bare domain ending in one of the usual
     endings. Clicking one opens the fake site it names — the browser creates that site if this internet has not seen
     the host before. An email address is never linkified: the character in front of a bare domain decides. */
  const TLD = 'shop|example|lab|xyz|com|net|org|io|dev|news|co|uk|de|info|site|online|store|app|biz|gov|edu|museum|travel';
  const LINK_RE = new RegExp('((?:https?:\\/\\/|www\\.)[^\\s<>"\']+|(?:[a-z0-9][a-z0-9-]*\\.)+(?:' + TLD + ')(?::\\d{2,5})?(?:\\/[^\\s<>"\']*)?)', 'gi');
  const unent = value => String(value).replace(/&amp;/g, '&');
  /* a drill writes [[visible text|real destination]] so the message can show one host and go to another, the way a
     real phish does; plain URLs in ordinary mail still linkify themselves */
  const linkify = text => String(text == null ? '' : text).split(/(\[\[[^\]]*\]\])/).map(part => {
    const marker = /^\[\[([^|\]]*)\|([^\]]*)\]\]$/.exec(part);
    if (!marker) return linkifyPlain(part);
    const href = unent(marker[2].trim());
    return '<a href="#" class="cd-mail-link" data-open-site="' + esc(href) + '" title="Really goes to ' + esc(href) +
      '">' + esc(marker[1].trim() || href) + '</a>';
  }).join('');
  const linkifyPlain = text => esc(text).replace(LINK_RE, (all, _group, offset, whole) => {
    const before = offset > 0 ? String(whole).charAt(offset - 1) : '';
    if (!/^(?:https?:|www\.)/i.test(all) && /[@\w.-]/.test(before)) return all;
    let url = all, tail = '';
    while (/[.,;:!?]$/.test(url)) { tail = url.slice(-1) + tail; url = url.slice(0, -1); }
    const href = /^https?:\/\//i.test(url) ? url : 'https://' + url.replace(/^\/\//, '');
    const label = url.replace(/^https?:\/\//i, '').replace(/\/$/, '');
    return '<a href="#" class="cd-mail-link" data-open-site="' + unent(href) + '">' + label + '</a>' + tail;
  });
  const initials = name => name.replace(/,.*$/, '').split(/\s+/).filter(Boolean).slice(0, 2).map(part => part[0].toUpperCase()).join('');
  const when = at => {
    const hours = (Date.now() - at) / 3600000;
    if (hours < 1) return Math.max(1, Math.round(hours * 60)) + 'm';
    if (hours < 24) return Math.round(hours) + 'h';
    return new Date(at).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
  };
  const hue = name => {
    let hash = 0;
    for (const char of name) hash = (hash * 31 + char.charCodeAt(0)) % 360;
    return hash;
  };

  function app(body, ctx) {
    let folder = 'inbox', category = 'All', query = '', selected = null, alive = true;
    const timers = [];
    let writing = false, count = 0, note = 'Mail arrives on its own while this window is open.';
    let mail = [];

    /* The mailbox lives on this desktop's virtual disk: closing the app (or the window) does not lose a message.
       A Live USB session is temporary by definition, so it keeps its mail in memory only. */
    const persist = !(ctx && ctx.live && ctx.live());
    const storeKey = 'cyber_mail';
    let saveTimer = 0;
    const save = () => {
      if (!persist) return;
      clearTimeout(saveTimer);
      saveTimer = setTimeout(() => { try { ls.set(storeKey, JSON.stringify(mail.slice(0, 60))); } catch (error) { } }, 300);
    };
    const readStore = () => {
      if (!persist) return null;
      try {
        const saved = JSON.parse(ls.get(storeKey, 'null'));
        if (!Array.isArray(saved)) return null;
        const rows = saved.filter(row => row && row.id && row.subject && typeof row.at === 'number');
        if (!rows.length) return null;
        for (const row of rows) {
          row.category = row.category || categoryOf(row);
          row.preview = row.preview || String(row.body || '').replace(/\s+/g, ' ').slice(0, 96);
          row.folder = row.folder === 'junk' ? 'junk' : 'inbox';
          row.signs = Array.isArray(row.signs) ? row.signs : [];
          row.phish = Number(row.phish) || 0;
          ensureMissionOnMessage(row, { isPhish: row.phish >= 4 });
        }
        return rows;
      } catch (error) { return null; }
    };

    hookWebActions();
    const stored = readStore();
    if (stored) {
      mail = stored;
      note = 'Mail is saved on this desktop — it will still be here next time you open the app.';
    } else {
      /* older mail first: each seed message arrives about 40 minutes after the one before it */
      SEED.forEach(([from, address, subject, text], i) => {
        /* messages that already carry a lab URL keep it; others link to a site from the browser's library */
        const body = extractUrl(text) ? text : (Math.random() < .85 ? withLink(text) : text);
        mail.push(Object.assign(message(from, address, subject, body), {
          unread: i < 3, at: Date.now() - (SEED.length - i) * 41 * 60000
        }));
      });
      /* whatever the dice said, the first morning in the inbox has somewhere to go */
      if (!mail.some(row => /https?:\/\//i.test(row.body))) {
        const body = withLink(mail[0].body);
        mail[0] = ensureMissionOnMessage(Object.assign({}, mail[0], { body: body, preview: body.replace(/\s+/g, ' ').slice(0, 96) }));
      }
      mail.push(drill());
      mail.push(drill());
      save();
    }

    body.innerHTML = '<div class="cd-content cd-mail2">' +
      '<header class="cd-mail-head"><h2>Mail</h2><span class="cd-mail-badge" data-mail-badge></span>' +
        '<button type="button" class="cd-mail2-chip" data-new-mission title="Receive a new website mission email">🎯 New mission</button>' +
        '<span class="cd-mail-note" data-mail-note></span></header>' +
      '<div class="cd-mail2-bar">' +
        '<div class="cd-mail2-folders" role="tablist">' +
          '<button type="button" role="tab" data-folder="inbox">Inbox <b data-count="inbox"></b></button>' +
          '<button type="button" role="tab" data-folder="junk">Junk <b data-count="junk"></b></button>' +
        '</div>' +
        '<input type="search" class="cd-mail2-search" data-mail-search placeholder="Search mail" aria-label="Search mail">' +
        '<div class="cd-mail2-cats" data-cats></div>' +
      '</div>' +
      '<div class="cd-mail-wrap"><div class="cd-mail2-list" data-mail-list></div>' +
        '<article class="cd-mail-body" data-mail-body></article></div></div>';
    const list = body.querySelector('[data-mail-list]'), pane = body.querySelector('[data-mail-body]');
    const badge = body.querySelector('[data-mail-badge]'), noteEl = body.querySelector('[data-mail-note]');
    const cats = body.querySelector('[data-cats]'), search = body.querySelector('[data-mail-search]');

    const visible = () => mail.filter(item => item.folder === folder)
      .filter(item => category === 'All' || item.category === category)
      .filter(item => {
        if (!query) return true;
        const words = query.toLowerCase().split(/\s+/).filter(Boolean);
        const haystack = (item.from + ' ' + item.address + ' ' + item.subject + ' ' + item.body + ' ' + item.category).toLowerCase();
        return words.every(word => haystack.includes(word));
      })
      .sort((a, b) => b.at - a.at);

    function paintCats() {
      const present = CATEGORIES.filter(name => mail.some(item => item.folder === folder && item.category === name));
      cats.innerHTML = ['All'].concat(present).map(name =>
        '<button type="button" class="cd-mail2-chip' + (name === category ? ' on' : '') + '" data-cat="' + name + '">' + name +
        (name === 'All' ? '<b>' + mail.filter(item => item.folder === folder).length + '</b>' : '<b>' + mail.filter(item => item.folder === folder && item.category === name).length + '</b>') +
        '</button>').join('');
    }
    function paintList() {
      save();
      const unread = mail.filter(item => item.folder === 'inbox' && item.unread).length;
      badge.textContent = unread ? unread + ' unread in inbox' : 'Inbox clear';
      badge.className = 'cd-mail-badge' + (unread ? '' : ' done');
      noteEl.textContent = note;
      body.querySelectorAll('[data-count]').forEach(node => {
        node.textContent = mail.filter(item => item.folder === node.dataset.count && item.unread).length || '';
      });
      body.querySelectorAll('[data-folder]').forEach(node => {
        node.classList.toggle('on', node.dataset.folder === folder);
        node.setAttribute('aria-selected', String(node.dataset.folder === folder));
      });
      paintCats();
      const rows = visible();
      list.innerHTML = rows.length ? rows.map(item => {
        const tone = `background:hsl(${hue(item.from)} 42% 28%);color:#eaf6ff`;
        const mTag = item.mission
          ? ('<i class="cd-mail2-mtag' + (item.mission.done ? ' done' : '') + '">' + (item.mission.done ? '✅ Paid' : '🎯 $' + item.mission.reward) + '</i>')
          : '';
        return '<button type="button" data-mail="' + item.id + '" class="cd-mail2-row' + (item.unread ? ' unread' : '') +
          (item.id === selected ? ' on' : '') + (item.phish >= 4 ? ' suspect' : '') + '">' +
          '<span class="cd-mail2-avatar" style="' + tone + '">' + esc(initials(item.from) || '?') + '</span>' +
          '<span class="cd-mail2-main"><b>' + esc(item.from) + '</b>' +
            '<span>' + esc(item.subject) + (item.phish >= 4 ? ' <i class="cd-mail2-warn" title="Looks like phishing">⚠</i>' : '') + mTag + '</span>' +
            '<small>' + esc(item.preview) + '</small></span>' +
          '<span class="cd-mail2-tags"><i class="cd-mail2-cat" data-cat-name="' + item.category + '">' + item.category + '</i>' +
            (item.starred ? '<i class="cd-mail2-star on">★</i>' : '') + '<i class="cd-mail2-when">' + when(item.at) + '</i></span>' +
          '</button>';
      }).join('') : '<p class="cd-mail-empty">' + (folder === 'junk'
        ? 'Junk is empty. Messages the filter catches land here; report anything that slipped through.'
        : 'No messages match. Clear the search or pick another category.') + '</p>';
    }
    function open(mailId) {
      const item = mail.find(row => row.id === mailId);
      if (!item) return;
      selected = item.id;
      item.unread = false;
      const tone = `background:hsl(${hue(item.from)} 42% 28%);color:#eaf6ff`;
      const m = item.mission || null;
      const missionHtml = m ? ('<section class="cd-mail2-mission' + (m.done ? ' done' : '') + '" data-mission-card="' + esc(m.id) + '">' +
        '<div class="cd-mail2-mission-hd"><b>' + (m.done ? '✅ Mission Completed' : '🎯 Website Mission') + ' · ' + esc(m.title) + '</b>' +
        '<span class="cd-mail2-reward">' + (m.done ? '+$' + m.reward + ' paid to Bank' : 'Bank reward: +$' + m.reward) + '</span></div>' +
        '<div>' + esc(m.instruction) + '</div>' +
        '<div class="cd-mail2-mission-act">' +
          '<button type="button" class="pri" data-open-site="' + esc(m.url) + '">Open ' + esc(m.host) + ' →</button>' +
          '<span class="mute">' + (m.done ? 'Completed — reward credited to your Practice Bank.' : 'Complete this task on ' + esc(m.host) + ' (in Browser or Moundshell) to receive +$' + m.reward + ' in the Bank.') + '</span>' +
        '</div></section>') : '';
      pane.innerHTML = '<header class="cd-mail2-head"><span class="cd-mail2-avatar big" style="' + tone + '">' + esc(initials(item.from) || '?') + '</span>' +
        '<div><b>' + esc(item.subject) + '</b><span>' + esc(item.from) + ' &lt;' + esc(item.address) + '&gt;</span>' +
        '<span class="mute">to ' + esc(INBOX_ADDRESS) + ' · ' + new Date(item.at).toLocaleString() + '</span></div>' +
        '<i class="cd-mail2-cat" data-cat-name="' + item.category + '">' + item.category + '</i></header>' +
        (item.phish >= 4 ? '<div class="cd-mail2-alert"><b>This message did not pass our checks.</b><span>' +
          esc(item.signs.slice(0, 3).join('; ') || 'it looks like a credential request') + '. Verify the sender through a channel you already trust, and never enter your password from a link in mail.</span></div>' : '') +
        missionHtml +
        '<pre>' + linkify(item.body) + '</pre>' +
        (item.phish >= 4 && item.evidence && item.evidence.length ? '<div class="cd-mail2-evidence">' +
          '<b>What you can actually check</b><dl>' +
          item.evidence.map(([label, value]) => '<dt>' + esc(label) + '</dt><dd>' + esc(value) + '</dd>').join('') + '</dl>' +
          (item.signs && item.signs.length ? '<ul>' + item.signs.slice(0, 5).map(reason => '<li>' + esc(reason) + '</li>').join('') + '</ul>' : '') +
          '</div>' : '') +
        (item.attachment ? '<div class="cd-mail2-attach">📎 ' + esc(item.attachment) + '<small>Attachments are never opened on this practice machine.</small></div>' : '') +
        (item.phish >= 4 ? '<div class="cd-mail2-phish"><b>What it wants</b><span>Your password, a one-time code, or a payment. The safe move is to report it and delete it.</span></div>' : '') +
        '<footer class="cd-mail2-foot">' +
          (item.reported ? '<span class="cd-mail2-ok">✅ Reported and moved to Junk.</span>'
            : '<button type="button" class="pri" data-act="report">Report phishing</button>') +
          '<button type="button" data-act="junk">Move to Junk</button>' +
          '<button type="button" data-act="inbox">Move to Inbox</button>' +
          '<button type="button" data-act="star">' + (item.starred ? '★ Starred' : '☆ Star') + '</button>' +
          '<button type="button" data-act="unread">Mark unread</button>' +
          '<button type="button" data-act="delete">Delete</button>' +
          '<button type="button" data-act="reply">Reply</button>' +
        '</footer>';
      paintList();
    }
    function receive(item, why) {
      mail.unshift(item);
      if (mail.length > 60) mail.length = 60;
      paintList();
      A.toast('✉ New mail from ' + item.from + (item.folder === 'junk' ? ' — held in Junk' : ''));
      if (why) { note = why; noteEl.textContent = note; }
    }
    /* the local model writes some of the mail; without a model the templates keep it flowing */
    async function compose() {
      if (writing || !alive) return;
      writing = true;
      count++;
      const [from, address] = pick(PEOPLE);
      const topics = ['the patching schedule', 'the new on-call rota', 'last week\'s phishing drill', 'the lab rebuild',
        'the quarterly access review', 'a broken link in the runbook', 'the Thursday maintenance window', 'the cable order'];
      const topic = pick(topics);
      const controller = new AbortController();
      const guard = setTimeout(() => controller.abort(), 12000);
      timers.push(guard);
      try {
        if (!A.ai || !A.ai.stream) throw new Error('no model');
        const text = await A.ai.stream([
          { role: 'system', content: 'You write one short, believable internal email for a fictional offline security lab. Reply with only JSON: {"from":"Name, Role","subject":"...","body":"two short plain-text paragraphs"}. No markdown, no links, no lists.' },
          { role: 'user', content: 'Write email ' + count + ' about ' + topic + '. Ordinary work mail between colleagues.' }
        ], null, controller.signal, { localOnly: true, temp: .85 });
        const parsed = A.ai.json(text);
        if (!parsed || !parsed.subject || !parsed.body) throw new Error('bad reply');
        const body = withLink(String(parsed.body).slice(0, 4000));
        receive(message(String(parsed.from || from).slice(0, 60), address, String(parsed.subject).slice(0, 120), body), 'New mail is written by the model on this PC.');
      } catch (error) {
        const subject = topic.charAt(0).toUpperCase() + topic.slice(1);
        receive(message(from, address, subject, withLink('Quick one about ' + topic + '.\n\nCan you look at it before the end of the day and tell me if anything needs booking in? No rush if you are busy.')));
      } finally {
        clearTimeout(guard);
        writing = false;
      }
    }
    function deliver() {
      if (!alive) return;
      if (Math.random() < .35) receive(drill(), 'A phishing drill arrived. Some are caught by the filter; a few get through.');
      else compose();
    }

    list.addEventListener('click', event => {
      const row = event.target.closest('[data-mail]');
      if (row) open(row.dataset.mail);
    });
    cats.addEventListener('click', event => {
      const chip = event.target.closest('[data-cat]');
      if (!chip) return;
      category = chip.dataset.cat;
      paintList();
    });
    body.querySelectorAll('[data-folder]').forEach(node => node.addEventListener('click', () => {
      folder = node.dataset.folder;
      category = 'All';
      selected = null;
      pane.innerHTML = '<p class="cd-mail-empty">Choose a message to read it.</p>';
      paintList();
    }));
    const newMissionBtn = body.querySelector('[data-new-mission]');
    if (newMissionBtn) newMissionBtn.addEventListener('click', () => {
      const m = createMissionMail();
      if (!m) { A.toast('Fake internet catalog is still loading.'); return; }
      folder = 'inbox';
      category = 'All';
      receive(m, 'New website mission delivered — complete it on ' + m.mission.host + ' for +$' + m.mission.reward + '!');
      open(m.id);
    });
    const onMissionSync = completed => {
      if (!alive || !completed) return;
      let changed = false;
      for (const row of mail) {
        if (row.mission && row.mission.id === completed.id && !row.mission.done) {
          row.mission.done = true;
          row.mission.completedAt = completed.completedAt || Date.now();
          changed = true;
        }
      }
      if (changed) {
        paintList();
        if (selected) open(selected);
      }
    };
    uiSyncListeners.add(onMissionSync);

    search.addEventListener('input', () => { query = search.value.trim(); paintList(); });
    pane.addEventListener('click', event => {
      const siteLink = event.target.closest('[data-open-site]');
      if (siteLink) { event.preventDefault(); ctx.openSite?.(siteLink.dataset.openSite); return; }
      const button = event.target.closest('[data-act]');
      if (!button) return;
      const item = mail.find(row => row.id === selected);
      if (!item) return;
      const act = button.dataset.act;
      if (act === 'report') {
        if (!item.reported) {
          item.reported = true;
          item.folder = 'junk';
          /* the bounty is for real phish only, so ordinary mail cannot be reported for free money */
          if (item.phish >= 4) {
            A.cyberBank?.phishReported(item.from);
            if (item.mission && !item.mission.done) completeMission(item.mission, 'phish-report');
            else A.toast('Reported. $20 credited to the practice bank.');
          } else A.toast('Reported. The filter learns from it; no bounty for ordinary mail.');
        }
        open(item.id);
      } else if (act === 'junk' || act === 'inbox') {
        item.folder = act;
        A.toast(act === 'junk' ? 'Moved to Junk.' : 'Moved to Inbox.');
        paintList();
        open(item.id);
      } else if (act === 'star') {
        item.starred = !item.starred;
        open(item.id);
      } else if (act === 'unread') {
        item.unread = true;
        selected = null;
        pane.innerHTML = '<p class="cd-mail-empty">Choose a message to read it.</p>';
        paintList();
      } else if (act === 'delete') {
        mail = mail.filter(row => row.id !== item.id);
        selected = null;
        pane.innerHTML = '<p class="cd-mail-empty">Choose a message to read it.</p>';
        paintList();
      } else if (act === 'reply') {
        A.toast('Replies stay on this practice machine — nothing is sent.');
        pane.insertAdjacentHTML('beforeend', '<p class="cd-mail-sent">Draft reply saved locally.</p>');
      }
    });

    paintList();
    const first = visible()[0];
    if (first) open(first.id);
    else pane.innerHTML = '<p class="cd-mail-empty">Choose a message to read it.</p>';
    timers.push(setTimeout(deliver, 8000));
    const loop = setInterval(deliver, 17000 + Math.random() * 11000);
    return () => {
      alive = false;
      clearInterval(loop);
      clearTimeout(saveTimer);
      timers.forEach(clearTimeout);
      /* closing the window is the moment the mailbox must already be on disk */
      if (persist) { try { ls.set(storeKey, JSON.stringify(mail.slice(0, 60))); } catch (error) { } }
    };
  }

  A.cyberMail = { app, categories: () => CATEGORIES.slice(), categoryOf };
})();

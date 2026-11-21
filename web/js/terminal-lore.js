// Terminal lore: the story engine behind the terminal sandboxes. Every disk, dossier and puzzle briefing is generated
// from a seed here, so no two cases are alike and nothing ever runs out. It builds a fictional organisation (agency,
// contractor, cartel front, lab, ministry, cult, shipping line...), staffs it with people, gives it a believable paper
// trail, and then hides a pile of juicy documents in it: classified memos, black-budget ledgers, surveillance requests,
// whistleblower threads, shell-company registers, sealed settlements, flight and shipping manifests, clinical trials,
// bugging orders, donor ledgers, blackmail files, key escrow and more. All of it is invented for practice; no real
// person, agency or document is described anywhere in here.
(function () {
  const LORE = (window.TerminalLore = window.TerminalLore || {});
  const pad = (n, k = 2) => String(n).padStart(k, '0');

  /* ---------- seeded randomness: same seed, same case ---------- */
  function rng(seed) {
    let s = (seed >>> 0) || 0x9e3779b9;
    return () => {
      s ^= s << 13; s >>>= 0;
      s ^= s >>> 17;
      s ^= s << 5; s >>>= 0;
      return s / 4294967296;
    };
  }

  /* ---------- the building blocks ---------- */
  const FIRST = ['Ada', 'Bram', 'Cyrus', 'Delia', 'Elias', 'Farid', 'Greta', 'Hosni', 'Ines', 'Jonas', 'Kira', 'Lars', 'Mira', 'Noor', 'Oskar', 'Priya', 'Quinn', 'Rosa', 'Sami', 'Tessa', 'Umar', 'Vera', 'Wren', 'Yusuf', 'Zara', 'Tomas', 'Nadia', 'Rafe', 'Ilse', 'Marek'];
  const LAST = ['Abara', 'Beck', 'Calder', 'Duarte', 'Eklund', 'Farkas', 'Grieve', 'Halvorsen', 'Ibarra', 'Jelinek', 'Kowalski', 'Lindqvist', 'Moreau', 'Nakamura', 'Okafor', 'Petrov', 'Quiroga', 'Rasmussen', 'Sokolov', 'Tamm', 'Ulrich', 'Vasquez', 'Weiss', 'Yilmaz', 'Zeller', 'Brandt', 'Ferreira', 'Novak', 'Achterberg', 'Strand'];
  const CITIES = [['Rotterdam', 'NL'], ['Trieste', 'IT'], ['Almaty', 'KZ'], ['Valparaiso', 'CL'], ['Mombasa', 'KE'], ['Busan', 'KR'], ['Antwerp', 'BE'], ['Constanta', 'RO'], ['Manzanillo', 'MX'], ['Port Klang', 'MY'], ['Tema', 'GH'], ['Santos', 'BR'], ['Zadar', 'HR'], ['Batroun', 'LB']];
  const LANDS = ['Vanuatu', 'Seychelles', 'Delaware', 'Nevis', 'Luxembourg', 'Cyprus', 'Cayman', 'Malta', 'Marshall Islands', 'Panama'];
  const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
  const MARKS = ['UNCLASSIFIED', 'RESTRICTED', 'CONFIDENTIAL', 'SECRET', 'SECRET//NOFORN', 'TOP SECRET//SI//NOFORN', 'INTERNAL — DO NOT DISTRIBUTE', 'PROPRIETARY — LITIGATION HOLD'];

  const THEMES = [
    {
      id: 'agency', label: 'Government agency', icon: '🏛',
      orgs: ['Bureau of Strategic Compliance', 'Directorate of Infrastructure Assurance', 'Office of Contingency Planning', 'National Signals Directorate', 'Ministry of Civil Resilience', 'Federal Oversight Board for Critical Systems', 'Department of Transport Security'],
      domains: ['bsc.gov.example', 'dia.gov.example', 'nso.gov.example'],
      dirs: ['directives', 'casefiles', 'oversight', 'budget', 'personnel', 'liaison'],
      roles: ['Director of Operations', 'Deputy General Counsel', 'Liaison Officer', 'Inspector General', 'Watch Commander', 'Records Custodian', 'Programme Manager'],
      units: ['Directorate A (Collection)', 'Directorate B (Assessment)', 'Office of Legal Counsel', 'Field Office 7', 'Joint Tasking Cell']
    },
    {
      id: 'contractor', label: 'Defense contractor', icon: '🛰',
      orgs: ['Halcyon Dynamics', 'Kestrel Applied Systems', 'Meridian Defence Group', 'Orion Field Services', 'Palewood Analytics', 'Sentinel Ridge Technologies'],
      domains: ['halcyondyn.example', 'kestrelsys.example', 'orionfield.example'],
      dirs: ['programs', 'proposals', 'compliance', 'finance', 'engineering', 'export-control'],
      roles: ['Programme Director', 'Chief Engineer', 'Export Control Officer', 'Contracts Manager', 'Site Lead', 'Security Officer'],
      units: ['Programme Halberd', 'Programme Tinderbox', 'Advanced Effects Group', 'Field Support Detachment']
    },
    {
      id: 'cartel', label: 'Cartel front company', icon: '🚢',
      orgs: ['Aurelia Logistics', 'Costa Verde Imports', 'Bahia Fresh Produce', 'Northern Star Freight', 'Solaris Agro Holdings', 'Cobalt Meridian Trading'],
      domains: ['aurelialog.example', 'costaverde.example', 'northstarfreight.example'],
      dirs: ['shipments', 'customs', 'accounts', 'warehouse', 'crews', 'legal'],
      roles: ['Operations Manager', 'Customs Broker', 'Warehouse Chief', 'Finance Officer', 'Outside Counsel', 'Dispatcher'],
      units: ['Route North', 'Route Azul', 'Cell 4', 'Depot 12']
    },
    {
      id: 'biotech', label: 'Biotech lab', icon: '🧬',
      orgs: ['Cyan Forest Therapeutics', 'Meridian Cell Labs', 'Aster Biosystems', 'Ninewells Research', 'Verdant Trials Unit', 'Helix Foundry'],
      domains: ['cyanforest.example', 'asterbio.example', 'ninewells.example'],
      dirs: ['trials', 'protocols', 'regulatory', 'lab-notebooks', 'safety', 'procurement'],
      roles: ['Principal Investigator', 'Trial Monitor', 'Regulatory Lead', 'Lab Manager', 'Safety Officer', 'Biostatistician'],
      units: ['Study CF-114', 'Study NX-9', 'Ward 3', 'Manufacturing Suite B']
    },
    {
      id: 'ministry', label: 'Ministry', icon: '📜',
      orgs: ['Ministry of Water and Grid', 'Ministry of Interior Affairs', 'State Committee for Energy', 'Ministry of Public Works', 'National Development Authority'],
      domains: ['mwg.gov.example', 'moi.gov.example', 'scep.gov.example'],
      dirs: ['tenders', 'decrees', 'inspections', 'budget', 'press', 'regional'],
      roles: ['Permanent Secretary', 'Director of Procurement', 'Regional Governor', 'Press Secretary', 'Chief Auditor', 'Technical Adviser'],
      units: ['Region North', 'Region Delta', 'Tender Board', 'Inspectorate']
    },
    {
      id: 'cult', label: 'Closed community', icon: '🕯',
      orgs: ['The Ninth Dawn Fellowship', 'House of the Quiet Light', 'The Alder Circle', 'Congregation of the Second Sun', 'The Verdant Path'],
      domains: ['ninthdawn.example', 'quietlight.example', 'aldercircle.example'],
      dirs: ['teachings', 'members', 'donations', 'counsel', 'estate', 'correspondence'],
      roles: ['Elder', 'Steward', 'Recorder', 'Trustee', 'Counsel', 'Warden'],
      units: ['Inner Circle', 'Household East', 'Retreat Committee']
    },
    {
      id: 'militia', label: 'Militia and training camp', icon: '🎖',
      orgs: ['Free Horizon Brigade', 'Cedar Ridge Volunteers', 'Ironwood Training Concern', 'The Border Watch'],
      domains: ['freehorizon.example', 'cedarridge.example'],
      dirs: ['training', 'logistics', 'roster', 'finance', 'comms', 'medical'],
      roles: ['Quartermaster', 'Training Officer', 'Signal Officer', 'Paymaster', 'Medic', 'Recruiter'],
      units: ['First Cohort', 'Camp Ironwood', 'Signals Cell']
    },
    {
      id: 'union', label: 'Union and political machine', icon: '✊',
      orgs: ['Dockworkers Local 771', 'Municipal Employees Alliance', 'Transit Workers Council', 'United Service Workers District 4'],
      domains: ['local771.example', 'municipalalliance.example'],
      dirs: ['grievances', 'strike', 'politics', 'dues', 'legal', 'press'],
      roles: ['Business Agent', 'Trustee', 'Organiser', 'Treasurer', 'Recording Secretary', 'Shop Steward'],
      units: ['Pier 9', 'Depot Committee', 'Election Committee']
    },
    {
      id: 'prison', label: 'Private prison and sheriff', icon: '🔒',
      orgs: ['Cascade Correctional Partners', 'Ridgeline Detention Services', 'County Facility 12', 'Frontier Custody Group'],
      domains: ['cascadepartners.example', 'ridgeline.example'],
      dirs: ['roster', 'incidents', 'contracts', 'medical', 'visitation', 'audit'],
      roles: ['Warden', 'Shift Commander', 'Medical Director', 'Contract Monitor', 'Records Officer', 'Sergeant'],
      units: ['Block C', 'Intake', 'Transport Detail']
    },
    {
      id: 'shipping', label: 'Shipping line', icon: '⚓',
      orgs: ['Ardent Marine Ltd', 'Blue Meridian Shipping', 'Seventh Tide Carriers', 'Kestros Line'],
      domains: ['ardentmarine.example', 'seventhtide.example'],
      dirs: ['manifests', 'crewing', 'bunkers', 'insurance', 'charter', 'port-state'],
      roles: ['Fleet Manager', 'Master Mariner', 'Chartering Broker', 'Marine Superintendent', 'Claims Handler', 'Port Agent'],
      units: ['MV Ardent Star', 'MV Pale Gull', 'Terminal 4']
    },
    {
      id: 'university', label: 'University lab', icon: '🎓',
      orgs: ['Ashcombe Institute of Technology', 'St. Brendan Research College', 'Wexley University — Applied Physics', 'Northfield Health Faculty'],
      domains: ['ashcombe.example', 'stbrendan.example'],
      dirs: ['grants', 'theses', 'committee', 'ethics', 'patents', 'teaching'],
      roles: ['Department Chair', 'Ethics Committee Chair', 'Grants Officer', 'Postdoctoral Fellow', 'Lab Technician', 'Registrar'],
      units: ['Applied Physics', 'Ethics Board', 'Spin-out Office']
    },
    {
      id: 'startup', label: 'Data broker startup', icon: '📊',
      orgs: ['Lumen Trace Analytics', 'Pale Cartographer', 'Signal Yard', 'Threadwell Data', 'Quiet Metrics Inc'],
      domains: ['lumentrace.example', 'signalyard.example', 'quietmetrics.example'],
      dirs: ['datasets', 'clients', 'legal', 'engineering', 'security', 'decks'],
      roles: ['Chief Executive', 'Head of Data', 'General Counsel', 'Security Lead', 'Growth Lead', 'Solutions Engineer'],
      units: ['Data Team', 'Deal Desk', 'Trust & Safety']
    },
    {
      id: 'media', label: 'Newsroom', icon: '📰',
      orgs: ['The Ledger', 'Meridian Post', 'Harbour Wire', 'The Evening Review'],
      domains: ['ledgernews.example', 'meridianpost.example'],
      dirs: ['assignments', 'sources', 'legal-review', 'archive', 'advertising', 'ingest'],
      roles: ['Editor-in-Chief', 'Investigations Editor', 'Standards Editor', 'General Counsel', 'Photo Editor', 'Fact-checker'],
      units: ['Investigations Desk', 'Morgue', 'Ad Sales']
    },
    {
      id: 'hospital', label: 'Hospital group', icon: '🏥',
      orgs: ['Ridgemont Health Partners', 'St. Cadoc Trust', 'Lakeshore Medical Group', 'Eastvale Community Hospital'],
      domains: ['ridgemonthp.example', 'stcadoc.example'],
      dirs: ['clinical', 'incidents', 'procurement', 'compliance', 'billing', 'staffing'],
      roles: ['Chief Medical Officer', 'Clinical Governance Lead', 'Procurement Manager', 'Compliance Officer', 'Nurse Manager', 'Billing Director'],
      units: ['Ward 6', 'Theatre 2', 'Central Stores']
    }
  ];

  /* ---------- generators, shared by every document ---------- */
  function ctx(seed) {
    const r = rng(seed);
    const int = (a, b) => a + Math.floor(r() * (b - a + 1));
    const pick = list => list[Math.floor(r() * list.length)];
    const chance = p => r() < p;
    const many = (n, f) => Array.from({ length: n }, f);
    const first = () => pick(FIRST), last = () => pick(LAST);
    const person = () => first() + ' ' + last();
    const initials = () => pick(FIRST)[0] + pick(LAST)[0];
    const date = (from = 2019, to = 2026) => int(1, 28) && (int(from, to) + '-' + pad(int(1, 12)) + '-' + pad(int(1, 28)));
    const time = () => pad(int(0, 23)) + ':' + pad(int(0, 59)) + ':' + pad(int(0, 59));
    const money = (a, b) => (int(a, b) * 1000).toLocaleString('en-US');
    const hex = k => Array.from({ length: k }, () => '0123456789abcdef'[(r() * 16) | 0]).join('');
    const num = k => Array.from({ length: k }, () => '0123456789'[(r() * 10) | 0]).join('');
    const caseNo = () => pick(['CF', 'OP', 'DJ', 'SEQ', 'SOC', 'CASE']) + '-' + int(2019, 2026) + '-' + num(4);
    const redact = () => '[REDACTED ' + int(6, 44) + ' chars]';
    const mark = () => pick(MARKS);
    const ip = () => '10.' + int(0, 9) + '.' + int(0, 254) + '.' + int(2, 254);
    const file = k => (pick(['doc', 'scan', 'memo', 'note', 'file', 'rec']).toUpperCase() + '_' + num(k));
    const city = () => pick(CITIES);
    const year = () => int(2019, 2026);
    return { r, int, pick, chance, many, first, last, person, initials, date, time, money, hex, num, caseNo, redact, mark, ip, file, city, year };
  }

  /* ---------- the documents: each returns { name, text, tag, juice } ---------- */
  /* juice: 1 = interesting, 2 = damaging, 3 = career-ending */
  const SECRETS = [
    {
      id: 'classified', label: 'Classified memo', icon: '🗂', juice: 3,
      make(c, o) {
        const codename = c.pick(['HALBERD', 'TINDERBOX', 'GLASS ORCHARD', 'PALE HORSE', 'SALT MERIDIAN', 'NIGHT LEDGER', 'COPPER VEIL']);
        return {
          name: 'memo_' + codename.toLowerCase().replace(/ /g, '-') + '_' + c.num(4) + '.txt',
          text: [c.mark(),
            'MEMORANDUM FOR THE RECORD',
            'Reference: ' + c.caseNo() + '   Classification: ' + c.mark(),
            'From: ' + c.person() + ', ' + c.pick(o.roles),
            'To: ' + c.person() + ', ' + c.pick(o.roles),
            'Date: ' + c.date(),
            '',
            '1. Subject: ' + c.pick(['Continuity of ' + o.short + ' operations during the Q' + c.int(1, 4) + ' transition',
              'Disposition of material recovered under Reference ' + c.caseNo(),
              'Request for additional authorities in the ' + codename + ' programme',
              'Handling of the ' + c.pick(['second', 'third', 'unlisted']) + ' site']),
            '',
            '2. Background. Since ' + c.date(2019, 2024) + ', ' + o.org + ' has held responsibility for ' + c.pick(['the unacknowledged annex', 'the liaison file', 'the interim arrangement', 'the parallel reporting line']) + '. ' + c.redact() + ' has been aware of the arrangement but has not been briefed in writing.',
            '',
            '3. The approved figure for ' + codename + ' is $' + c.money(400, 9000) + '. Of that, $' + c.money(50, 900) + ' is carried outside the published budget, under object class ' + c.num(4) + ', and is reconciled quarterly by ' + c.person() + '.',
            '',
            '4. Recommendation: continue the arrangement through FY' + (c.year() + 1) + '. Do not minute the discussion. Verbal approval was given on ' + c.date() + ' at ' + c.time() + '.',
            '',
            '5. ' + c.redact(),
            '',
            'Signature: ' + c.person() + ' / ' + c.initials() + '-' + c.num(3),
            c.mark()].join('\n'),
          tag: 'classified memo', juice: 3
        };
      }
    },
    {
      id: 'budget', label: 'Off-book budget ledger', icon: '💰', juice: 2,
      make(c, o) {
        const rows = c.many(c.int(6, 12), () => [c.date(2021, 2026), c.pick(['Consulting — ' + c.last() + ' & Partners', 'Logistics (no PO)', 'Travel — ' + c.pick(CITIES)[0], 'Subcontract ' + c.num(4), 'Equipment — refurbished', 'Analyst retainer', 'Media placement', 'Site works, phase ' + c.int(2, 6), 'Vehicle lease', 'Cash advance']) + ',' + c.money(10, 900)].join(','));
        const total = rows.reduce((t, row) => t + Number(row.split(',')[1].replace(/,/g, '')), 0);
        return {
          name: 'ledger_' + c.pick(['annex', 'discretionary', 'parallel', 'unpublished']) + '_' + c.num(3) + '.csv',
          text: ['date,line_item,amount_usd', ...rows, 'TOTAL,,' + total.toLocaleString('en-US'), '', '# prepared by ' + c.person() + ' · ledger id ' + c.caseNo() + ' · ' + c.mark()].join('\n'),
          tag: 'off-book spending', juice: 2
        };
      }
    },
    {
      id: 'surveillance', label: 'Surveillance request', icon: '🎧', juice: 3,
      make(c, o) {
        const targets = c.many(c.int(3, 7), () => '  - ' + c.person() + ' (' + c.pick(['journalist', 'counsel', 'former employee', 'official', 'contractor', 'relative']) + '), ' + c.pick(['mobile', 'landline', 'email', 'vehicle tracker', 'messaging account']) + ' ' + c.pick(['+1-555-' + c.num(4), c.last().toLowerCase() + '@mail.example', 'IMEI ' + c.num(15)]) + ' — approved until ' + c.date(2024, 2027));
        return {
          name: 'surveillance_request_' + c.num(5) + '.txt',
          text: [c.mark(),
            'REQUEST FOR COLLECTION AUTHORITY',
            'Request ' + c.caseNo() + ' · submitted ' + c.date() + ' ' + c.time() + ' by ' + c.person(),
            'Investigative justification: ' + c.pick(['alleged disclosure to press', 'suspected coordination with a foreign buyer', 'internal theft of ' + c.pick(['tender documents', 'clinical data', 'source list']), 'unspecified — see annex']),
            '',
            'Subjects:',
            ...targets,
            '',
            'Duration requested: ' + c.int(30, 180) + ' days, renewable without further review.',
            'Handling: results to ' + c.pick(o.units) + ' only. ' + c.redact(),
            'Approving official: ' + c.person() + ' (signature illegible)',
            c.mark()].join('\n'),
          tag: 'surveillance order', juice: 3
        };
      }
    },
    {
      id: 'whistle', label: 'Whistleblower thread', icon: '✉️', juice: 3,
      make(c, o) {
        const subject = c.pick(['Re: the numbers in the annex', 'Fwd: what we discussed off-site', 'Do not put this in the shared drive', 'Re: Re: the second shipment', 'Question about the log from ' + c.date()]);
        const lines = [], turns = c.int(3, 4);
        for (let i = 0; i < turns; i++) {
          const who = c.person();
          lines.push('From: ' + who.toLowerCase().replace(/[^a-z]+/g, '.') + '@' + c.pick(o.domains), 'To: ' + c.person().toLowerCase().replace(/[^a-z]+/g, '.') + '@' + c.pick(o.domains), 'Date: ' + c.date() + ' ' + c.time(), 'Subject: ' + subject, '', c.pick([
            'The version in the shared drive is not what was signed. I have the signed copy, and the figures in section ' + c.int(2, 9) + ' are different by about $' + c.money(20, 400) + '.',
            'I am not comfortable signing the ' + c.pick(['incident report', 'shipping declaration', 'trial summary', 'audit response']) + '. It says nothing happened and that is not true.',
            'They have moved the records to ' + c.pick(['a personal drive', 'the archive in the basement', 'a courier box', 'an encrypted USB']) + '. I was asked to delete the originals.',
            'If I am not at work on ' + c.date(2025, 2027) + ', the file is with ' + c.pick(['my sister', 'a lawyer in ' + c.pick(LANDS), 'the ' + c.pick(['newspaper', 'union', 'regulator'])]) + '. I am not trying to be dramatic, I am trying to be careful.'], ''));
        }
        lines.push('— sent from a personal account. Please do not reply to this address.');
        return { name: 'thread_' + c.pick(['annex', 'numbers', 'second-shipment', 'incident']) + '.eml', text: [c.mark(), ...lines, c.mark()].join('\n'), tag: 'whistleblower email', juice: 3 };
      }
    },
    {
      id: 'settlement', label: 'Sealed settlement', icon: '⚖️', juice: 2,
      make(c, o) {
        const who = c.person();
        return {
          name: 'settlement_' + c.last().toLowerCase() + '_sealed.txt',
          text: ['PRIVILEGED AND CONFIDENTIAL — ATTORNEY WORK PRODUCT',
            'SETTLEMENT AGREEMENT (SEALED)',
            'Matter: ' + c.caseNo() + '   Venue: ' + c.pick(['County Court', 'Commercial Division', 'Arbitration Panel ' + c.int(1, 9)]),
            '',
            'Between ' + o.org + ' ("the Company") and ' + who + ' ("the Claimant").',
            '',
            '1. Payment. The Company shall pay $' + c.money(90, 2400) + ' in ' + c.int(2, 8) + ' instalments, the last on ' + c.date(2026, 2028) + '.',
            '2. Non-disclosure. The Claimant shall not describe the circumstances giving rise to this matter, including the events of ' + c.date(2022, 2026) + ' at ' + c.pick(o.units) + '.',
            '3. Records. The underlying ' + c.pick(['incident log', 'medical report', 'complaint file', 'photographs']) + ' remain in the custody of outside counsel and are not to be produced in any other proceeding.',
            '4. Reference. Any request from a regulator is to be answered by ' + c.person() + ' alone.',
            '',
            'Counsel for the Company: ' + c.person() + ', ' + c.pick(['Barrow & Slate', 'Hollis LLP', 'Kerr Meridian', 'Achterberg Partners']),
            'Signature page follows — ' + c.num(2) + ' pages withheld.'].join('\n'),
          tag: 'sealed settlement', juice: 2
        };
      }
    },
    {
      id: 'shells', label: 'Shell company register', icon: '🏝', juice: 2,
      make(c, o) {
        const rows = c.many(c.int(4, 8), () => [c.pick(['Meridian', 'Pale', 'Cobalt', 'Ardent', 'Quiet', 'Thorn', 'Vantage', 'Skylark']) + ' ' + c.pick(['Holdings', 'Trading', 'Services', 'Marine', 'Consulting']) + ' ' + c.pick(['Ltd', 'LLC', 'S.A.']), c.pick(LANDS), c.num(6) + '-' + c.num(2), c.date(2018, 2025), c.pick(['nominee director', 'law firm', 'trustee', 'bearer'])].join(' | '));
        return {
          name: 'registry_' + c.pick(['offshore', 'corporate', 'beneficial']) + '.txt',
          text: ['company | jurisdiction | registration | incorporated | control',
            ...rows,
            '',
            'Note: four of the above share the same correspondence address in ' + c.pick(CITIES)[0] + '. Two are named after relatives of ' + c.person() + '.',
            'Held offline — ' + c.mark()].join('\n'),
          tag: 'shell companies', juice: 2
        };
      }
    },
    {
      id: 'wires', label: 'Wire transfer log', icon: '🏦', juice: 2,
      make(c, o) {
        const rows = c.many(c.int(6, 10), () => [c.date(2023, 2026), c.pick(['OUT', 'OUT', 'IN', 'OUT']), c.pick(['Aurelia Logistics', 'Kirkwall Trust', 'Pale Horse Ltd', 'Wexford Nominees', 'Delta Street Holdings']), c.money(5, 700), c.pick(['USD', 'EUR', 'GBP']), c.pick(['split — see note', 'invoice ' + c.num(5), 'advance', 'no reference', 'ref: ' + c.pick(['equipment', 'freight', 'advisory'])])].join(' | '));
        return {
          name: 'wires_' + c.num(4) + '.log',
          text: ['date | dir | counterparty | amount | ccy | reference', ...rows, '', 'Prepared for ' + c.person() + '. Do not forward: the bank has already asked twice about the ' + c.pick(['March', 'June', 'October', 'December']) + ' transfers.'].join('\n'),
          tag: 'money trail', juice: 2
        };
      }
    },
    {
      id: 'manifest', label: 'Shipping manifest', icon: '📦', juice: 2,
      make(c, o) {
        const vessel = c.pick(['MV Ardent Star', 'MV Pale Gull', 'MV Kestros', 'MV Seventh Tide', 'MV Costa Verde']);
        const rows = c.many(c.int(4, 8), () => ['  ' + c.int(1, 40) + '  ' + c.pick(['Industrial pumps', 'Agricultural film', 'Refrigerated produce', 'Laboratory glassware', 'Machine parts', 'Batteries (lithium)', 'Chemical — ' + c.pick(['solvent', 'additive', 'reagent']) + ' class ' + c.int(3, 9), 'Textiles', 'Printed matter']), c.money(4, 260) + '  ' + c.pick(['Rotterdam', 'Trieste', 'Mombasa', 'Busan', c.pick(CITIES)[0]])].join(''));
        return {
          name: 'manifest_' + vessel.split(' ')[1].toLowerCase() + '_' + c.num(3) + '.txt',
          text: ['BILL OF LADING — COPY', 'Vessel: ' + vessel + '  Voyage: ' + c.num(3) + '/' + c.year(), 'Port of loading: ' + c.pick(CITIES)[0] + '  Discharge: ' + c.pick(CITIES)[0],
            'Consignee: ' + c.pick(o.orgs) + '  Notify: ' + c.person(), '',
            'qty  description  declared value  destination', ...rows, '',
            'Remarks: two containers were re-sealed at the request of the shipper. Weight differs from the declaration by ' + c.int(120, 900) + ' kg.',
            'Customs broker: ' + c.person()].join('\n'),
          tag: 'shipping anomaly', juice: 2
        };
      }
    },
    {
      id: 'clinical', label: 'Clinical trial results', icon: '🧪', juice: 2,
      make(c, o) {
        const study = c.pick(['CF-114', 'NX-9', 'AR-22', 'HL-7']);
        return {
          name: 'study_' + study.toLowerCase() + '_summary.txt',
          text: ['INTERIM ANALYSIS — NOT FOR DISTRIBUTION',
            'Study ' + study + ' · ' + c.pick(['Phase II', 'Phase IIb', 'Phase III']) + ' · ' + o.org,
            'Enrolled: ' + c.int(80, 900) + '   Completed: ' + c.int(40, 700) + '   Withdrawn: ' + c.int(3, 60),
            '',
            'Primary endpoint: ' + c.pick(['not met', 'met with caveats', 'met in the per-protocol set only']),
            'Serious adverse events: ' + c.int(2, 30) + ' (' + c.pick(['liver enzymes', 'cardiac events', 'renal function', 'seizure']) + '), of which ' + c.int(0, 6) + ' were not reported to the monitor within the required window.',
            '',
            'Site note (' + c.person() + ', ' + c.pick(o.units) + '): two consent forms are undated and one participant was enrolled twice under different initials.',
            'Recommendation from the sponsor: ' + c.pick(['complete the study as planned', 'pause enrolment quietly', 're-run the analysis excluding the ' + c.pick(['two', 'three', 'four']) + ' affected subjects']),
            '',
            c.redact()].join('\n'),
          tag: 'clinical red flag', juice: 3
        };
      }
    },
    {
      id: 'minutes', label: 'Board minutes', icon: '🪑', juice: 1,
      make(c, o) {
        return {
          name: 'minutes_' + c.date(2024, 2026) + '.txt',
          text: ['MINUTES — ' + c.pick(['Board', 'Executive Committee', 'Trustees']) + ' (' + c.pick(['draft', 'unapproved', 'corrected']) + ')',
            o.org + ' · ' + c.date() + ' · ' + c.pick(CITIES).join(', '),
            'Present: ' + c.person() + ' (chair), ' + c.person() + ', ' + c.person() + ', ' + c.person() + '. Apologies: ' + c.person() + '.',
            '',
            '4. ' + c.pick(['Regulatory exposure', 'The ' + c.pick(['southern', 'northern']) + ' site', 'Personnel matter', 'Litigation update']),
            '   4.1 Counsel advised that the ' + c.pick(['draft report', 'inspection findings', 'correspondence with the authority']) + ' should not be circulated beyond this table.',
            '   4.2 The chair noted that ' + c.person() + ' has agreed to "take a step back" until the matter is resolved. Terms were not minuted at the request of counsel.',
            '   4.3 Approved: an additional $' + c.money(30, 900) + ' for ' + c.pick(['communications support', 'legal fees', 'external review', 'site remediation']) + '.',
            '',
            '6. Any other business — ' + c.pick(['none', 'the matter raised in ' + c.date(2023, 2025), 'question of the second signature', 'press enquiry from ' + c.pick(['The Ledger', 'Meridian Post', 'Harbour Wire'])]),
            '',
            'Next meeting: ' + c.date(2026, 2027) + '.'].join('\n'),
          tag: 'board cover-up', juice: 1
        };
      }
    },
    {
      id: 'flight', label: 'Flight manifest', icon: '✈️', juice: 2,
      make(c, o) {
        const tail = 'N' + c.num(3) + c.pick(['AB', 'KF', 'TR', 'ZE']);
        return {
          name: 'manifest_flight_' + c.pick(['GX', 'HL', 'MW']) + c.num(3) + '.txt',
          text: ['AIRCRAFT MANIFEST — ' + c.pick(['charter', 'positioning leg', 'survey flight']),
            'Tail: ' + tail + '  Type: ' + c.pick(['Cessna 560XL', 'Gulfstream G450', 'Beech 350', 'A320 (wet lease)']),
            'Route: ' + c.pick(CITIES)[0] + ' → ' + c.pick(CITIES)[0] + '  Date: ' + c.date(2024, 2026),
            '',
            ...c.many(c.int(3, 7), () => '  ' + c.person().padEnd(22) + c.pick(['Director', 'Consultant', 'Adviser', 'Courier', 'Observer']) + '   seat ' + c.int(1, 12) + '   ' + c.pick(['no passport recorded', 'ID sighted', 'listed as crew'])),
            '',
            'Cargo: ' + c.pick(['3 cases, diplomatic seal claimed', '2 crates, "survey equipment"', 'personal effects only', '1 hard case, hand-carried']),
            'Note from the operator: "the second leg was not filed with the authority."'].join('\n'),
          tag: 'flight irregularity', juice: 2
        };
      }
    },
    {
      id: 'blackmail', label: 'Blackmail dossier', icon: '🕶', juice: 3,
      make(c, o) {
        const target = c.person();
        return {
          name: 'file_' + c.last().toLowerCase() + '_' + c.num(2) + '.do_not_open.txt',
          text: ['PRIVATE — PERSONAL HOLDING FILE',
            'Subject: ' + target + ', ' + c.pick(o.roles),
            'Collected: ' + c.date(2023, 2026) + ' · by ' + c.pick(['an associate', 'a researcher', 'the security office', 'unknown']),
            '',
            'What we hold:',
            '  - ' + c.pick(['photographs, ' + c.int(4, 30) + ' frames', 'audio, ' + c.int(20, 90) + ' minutes', 'a signed invoice dated ' + c.date(2022, 2024), 'messages with ' + c.person()]) + ' — ' + c.redact(),
            '  - proof of the ' + c.pick(['undisclosed payment', 'second family', 'dismissal that was never recorded', 'loan from the ' + c.pick(['budget', 'union', 'campaign'])]) + '.',
            '  - ' + c.redact(),
            '',
            'Use: ' + c.pick(['hold for the ' + c.pick(['vote', 'inspection', 'tender']), 'do not use unless the story runs', 'hand to ' + c.person() + ' only', 'burn after the hearing']),
            'The subject does not know the file exists. Keep it that way.'].join('\n'),
          tag: 'blackmail file', juice: 3
        };
      }
    }
  ];

  const MORE = [
    {
      id: 'police', label: 'Redacted police report', icon: '🚨', juice: 2,
      make(c, o) {
        return {
          name: 'report_' + c.num(6) + '_redacted.txt',
          text: ['INCIDENT REPORT — COPY (released under review)', 'Report ' + c.caseNo() + ' · ' + c.date() + ' ' + c.time(), 'Location: ' + c.pick(['rear service yard', 'mile marker ' + c.int(12, 240), 'the ' + c.pick(['north', 'south']) + ' gate', 'a residence on ' + c.last() + ' Street']) + ', ' + c.pick(CITIES)[0],
            'Reporting officer: ' + c.person() + ' #' + c.num(4), 'Persons present: ' + c.person() + ', ' + c.person() + ', ' + c.redact(),
            '', 'Narrative:', '  At approximately ' + c.time() + ' a call was received regarding ' + c.pick(['a disturbance', 'a vehicle fire', 'an unresponsive male', 'a missing person']) + '. On arrival the officer observed ' + c.redact() + '.',
            '  The officer was advised by ' + c.pick(['a supervisor', 'an on-site manager', 'a company representative']) + ' that the matter would be "handled internally". The request was not documented at the time.',
            '  Body camera footage: ' + c.pick(['available', 'not activated', 'deleted after ' + c.int(2, 30) + ' days', 'withheld — ' + c.redact()]),
            '', 'Disposition: ' + c.pick(['no further action', 'referred to ' + c.pick(o.units), 'closed — insufficient evidence', 'pending review'])].join('\n'),
          tag: 'police report', juice: 2
        };
      }
    },
    {
      id: 'bugging', label: 'Bugging / interception order', icon: '📡', juice: 3,
      make(c, o) {
        return {
          name: 'interception_' + c.num(4) + '.txt',
          text: [c.mark(), 'AUTHORITY FOR TECHNICAL INTERCEPTION', 'Order ' + c.caseNo() + ' · granted ' + c.date() + ' by ' + c.pick(['a magistrate (name withheld)', 'the authorising officer', 'the board secretary']),
            'Premises: ' + c.pick(['office ' + c.int(200, 900), 'the ' + c.pick(['north', 'east']) + ' wing', 'a vehicle', 'the residence of ' + c.person()]),
            'Method: ' + c.pick(['room audio', 'network tap', 'line interception', 'keyboard capture', 'camera (covert)']) + ' — installed by ' + c.pick(['contractor', 'in-house technician', 'unknown']),
            'Scope: ' + c.pick(['all calls concerning the ' + c.pick(['tender', 'transfer', 'vote']), 'the ' + c.pick(['meeting room', 'canteen', 'corridor']) + ' only', 'unrestricted — see annex']),
            'Duration: ' + c.int(30, 365) + ' days. Renewals: ' + c.int(0, 4) + ' (none minuted).',
            '', 'Material obtained is to be stored at ' + c.pick(['a private address', 'the security office safe', 'a cloud account in the name of ' + c.last()]) + ' and is NOT to be entered in the evidence register.',
            '', 'Signed: ' + c.person(), c.mark()].join('\n'),
          tag: 'illegal interception', juice: 3
        };
      }
    },
    {
      id: 'prison', label: 'Prison roster and informants', icon: '🔒', juice: 3,
      make(c, o) {
        const rows = c.many(c.int(5, 9), () => '  ' + c.last().toUpperCase() + ', ' + c.first() + '  block ' + c.pick(['A', 'B', 'C', 'D']) + '  ' + c.pick(['remand', 'sentenced', 'transferred', 'medical']) + '  ' + c.pick(['informant', 'no flag', 'no flag', 'protective', 'segregation']) + '  visited by ' + c.person());
        return {
          name: 'roster_block_' + c.pick(['a', 'b', 'c']) + '.txt',
          text: ['ROSTER — ' + c.pick(o.units) + ' (' + c.date() + ')', 'Capacity ' + c.int(120, 900) + ' · held ' + c.int(140, 1000) + ' · staff on shift ' + c.int(4, 20), '', ...rows, '',
            'Notes: three transfers were made at the request of ' + c.pick(['the sheriff', 'a contractor', 'the county']) + ' with no court order on file.', 'The medical wing log for ' + c.date() + ' is missing.', c.redact()].join('\n'),
          tag: 'custody abuse', juice: 3
        };
      }
    },
    {
      id: 'crypto', label: 'Wallet seed and payouts', icon: '🪙', juice: 3,
      make(c, o) {
        const words = ['anchor', 'brass', 'cinder', 'dune', 'ember', 'fable', 'grain', 'hollow', 'ivory', 'juniper', 'kettle', 'lantern', 'marble', 'nectar', 'orbit', 'pepper', 'quarry', 'ribbon', 'sable', 'thistle', 'umber', 'velvet', 'willow', 'yarrow'];
        const phrase = c.many(12, () => c.pick(words)).join(' ');
        return {
          name: 'wallet_' + c.num(4) + '.txt',
          text: ['PAYOUT SHEET — ' + o.org, 'Wallet: bc1' + c.hex(38), 'Note: shares are split ' + c.int(2, 5) + ' ways; ' + c.pick(['the second address is not on any exchange', 'two signers are deceased', 'the recovery phrase was photographed']), '',
            'recovery phrase (do not type on a networked machine):', '  ' + phrase, '',
            'payouts:', ...c.many(c.int(4, 8), () => '  ' + c.date(2024, 2026) + '  ' + c.money(2, 400) + '  → ' + c.pick(['courier', 'broker', 'the ' + c.pick(['sheriff', 'inspector', 'governor\'s office']), 'unknown']) + '  ' + c.pick(['cash', 'car', 'jewellery', 'no receipt'])), '',
            'If asked: these are consulting fees.'].join('\n'),
          tag: 'crypto payout trail', juice: 3
        };
      }
    },
    {
      id: 'escrow', label: 'Key escrow and master keys', icon: '🔑', juice: 3,
      make(c, o) {
        return {
          name: 'escrow_' + c.pick(['ops', 'admin', 'legal']) + '.txt',
          text: ['KEY ESCROW RECORD — ' + o.org, 'Custodian: ' + c.person() + ' (deputy: ' + c.person() + ')', 'Storage: ' + c.pick(['safe 2, combination written on the inside of the door', 'a shared password vault', 'a sealed envelope in the ' + c.pick(['drawer', 'archive box']), 'nowhere — kept in memory']), '',
            ...c.many(c.int(3, 6), () => '  ' + c.pick(['root@', 'backup@', 'hr-archive', 'payroll', 'cctv-nvr', 'site-controller']) + '  fingerprint ' + c.hex(8) + '…  rotation overdue by ' + c.int(1, 40) + ' months'), '',
            'The key to the ' + c.pick(['evidence locker', 'second server room', 'document safe']) + ' is held by ' + c.person() + ', who left in ' + c.year() + '. It was never returned.', c.redact()].join('\n'),
          tag: 'key escrow', juice: 3
        };
      }
    },
    {
      id: 'donors', label: 'Dark-money donor ledger', icon: '🪙', juice: 2,
      make(c, o) {
        return {
          name: 'donors_' + c.year() + '.csv',
          text: ['date,name,amount,channel,note', ...c.many(c.int(6, 10), () => [c.date(2024, 2026), c.pick([c.person(), 'Trust ' + c.last(), 'Company ' + c.num(4)]), c.money(5, 900), c.pick(['cash', 'transfer', 'cheque', 'in kind']), c.pick(['below threshold', 'split to avoid reporting', 'receipt not issued', 'through ' + c.pick(LANDS)])].join(','))].join('\n'),
          tag: 'illegal donations', juice: 2
        };
      }
    },
    {
      id: 'election', label: 'Election vendor access log', icon: '🗳', juice: 3,
      make(c, o) {
        return {
          name: 'vendor_access_' + c.pick(['nov', 'mar', 'jun']) + '.log',
          text: ['vendor remote-access log — ' + c.pick(['municipal election system', 'county tabulation server', 'registration database']), ...c.many(c.int(8, 14), () => c.date(2024, 2027) + ' ' + c.time() + '  ' + c.ip() + '  ' + c.pick(['CONNECT', 'QUERY', 'EXPORT', 'PATCH', 'DISCONNECT']) + '  ' + c.pick(['support ticket ' + c.num(4), 'no ticket', 'after hours', 'elevated for ' + c.int(2, 90) + ' min'])), '',
            'Two sessions originated outside the contract schedule. The vendor has been asked for a written explanation and has not replied.'].join('\n'),
          tag: 'election meddling', juice: 3
        };
      }
    },
    {
      id: 'satellite', label: 'Satellite tasking schedule', icon: '🛰', juice: 3,
      make(c, o) {
        return {
          name: 'tasking_' + c.pick(['q1', 'q2', 'q3']) + '.txt',
          text: [c.mark(), 'COLLECTION TASKING SCHEDULE — ' + c.pick(['commercial provider', 'national asset', 'partner agency']), '',
            ...c.many(c.int(4, 7), () => '  ' + c.date(2025, 2027) + ' ' + c.time() + 'Z  ' + c.pick(['A', 'B', 'C']) + c.int(10, 40) + '  target ' + c.pick(['LAT ' + c.int(20, 60) + '.' + c.num(3) + ' / LON ' + c.int(1, 120) + '.' + c.num(3), 'grid ' + c.hex(6), 'the ' + c.pick(['site', 'compound', 'harbour']) + ' at ' + c.pick(CITIES)[0]]) + '  requested by ' + c.pick(['a client', 'the liaison', 'no named requester'])), '',
            'Images were delivered to a private address, not the archive. Retention period on file: ' + c.pick(['30 days', 'none', 'unknown'])].join('\n'),
          tag: 'covert collection', juice: 3
        };
      }
    },
    {
      id: 'blackout', label: 'Media blackout plan', icon: '📵', juice: 2,
      make(c, o) {
        return {
          name: 'comms_plan_' + c.pick(['incident', 'crisis', 'spike']) + '.txt',
          text: ['COMMUNICATIONS — HOLDING PLAN (draft ' + c.int(1, 6) + ')', 'Trigger: the ' + c.pick(['incident', 'inspection', 'story']) + ' becomes public.',
            '', 'Steps:', '  1. No comment until counsel signs the wording.', '  2. ' + c.pick(['Offer the journalist a different story', 'Ask ' + c.person() + ' to intervene with the editor', 'Brief the sponsor of the ' + c.pick(['regulator', 'board'])]), '  3. Delay the ' + c.pick(['police', 'regulator', 'insurer']) + ' notification beyond the ' + c.int(24, 72) + '-hour window.', '  4. Circulate the internal version only.', '',
            'Contact list: ' + c.person() + ' (' + c.pick(['mobile', 'personal number']) + '), ' + c.person() + ' (after hours only).',
            'If asked, the ' + c.pick(['delay', 'gap in the logs', 'deleted recording']) + ' was a "system limitation".'].join('\n'),
          tag: 'cover-up plan', juice: 2
        };
      }
    },
    {
      id: 'subjects', label: 'Test-subject log', icon: '🧫', juice: 3,
      make(c, o) {
        return {
          name: 'subjects_' + c.pick(['log', 'register']) + '.txt',
          text: ['SUBJECT REGISTER — NOT FOR PUBLICATION', 'Programme: ' + c.pick(['Cyan', 'Aster', 'Ninewells', 'Helix']) + '-' + c.int(2, 9) + ' · ' + o.org, '',
            ...c.many(c.int(4, 8), () => '  ' + c.num(4) + '  age ' + c.int(18, 61) + '  ' + c.pick(['consented', 'consented (form undated)', 'no form on file', 'withdrawn — not recorded']) + '  dose ' + c.int(2, 90) + 'mg  outcome ' + c.pick(['recovered', 'adverse', 'adverse (unreported)', 'lost to follow-up'])), '',
            'Two subjects were paid in cash. Their names appear nowhere else in the trial file.'].join('\n'),
          tag: 'unethical trial', juice: 3
        };
      }
    },
    {
      id: 'weapons', label: 'Arms transfer note', icon: '🔫', juice: 3,
      make(c, o) {
        return {
          name: 'transfer_' + c.hex(4) + '.txt',
          text: ['END-USER CERTIFICATE (copy)', 'Reference ' + c.caseNo() + ' · ' + c.date(), 'Supplier: ' + o.org, 'Consignee: ' + c.pick(['Ministry of the Interior, ' + c.pick(['an unnamed state', 'a landlocked partner']), 'A registered sporting club', 'A private security company']), '',
            'Items: ' + c.int(40, 900) + ' × ' + c.pick(['carbines, 5.56', 'pistols, 9mm', 'night-vision units', 'signal jammers', 'armoured panels']),
            'Destination: ' + c.pick(CITIES)[0] + ' (transit through ' + c.pick(CITIES)[0] + ')',
            'End user statement signed by ' + c.person() + ' — signature does not match the file copy.', '',
            'Export licence: ' + c.pick(['not required (re-export claimed)', 'expired ' + c.date(2024, 2025), 'number withheld'])].join('\n'),
          tag: 'arms trafficking', juice: 3
        };
      }
    },
    {
      id: 'payroll', label: 'Off-book payroll', icon: '💵', juice: 2,
      make(c, o) {
        return {
          name: 'payroll_' + c.pick(['shadow', 'ghost', 'manual']) + '.csv',
          text: ['name,role,paid_via,amount,note', ...c.many(c.int(5, 9), () => [c.person(), c.pick(['consultant', 'adviser', 'driver', 'cleaner', 'analyst', 'no role recorded']), c.pick(['cash', 'personal account', 'third-party company']), c.money(2, 40), c.pick(['not on the register', 'no contract', 'paid twice in ' + c.pick(['March', 'July']), 'relative of ' + c.last()])].join(','))].join('\n'),
          tag: 'ghost employees', juice: 2
        };
      }
    },
    {
      id: 'insurance', label: 'Insurance claim file', icon: '📑', juice: 1,
      make(c, o) {
        return {
          name: 'claim_' + c.num(7) + '.txt',
          text: ['CLAIM FILE — ' + c.pick(['fire', 'flood', 'theft', 'collapse']) + ' at ' + c.pick(['unit ' + c.int(1, 40), 'the ' + c.pick(['north', 'east']) + ' warehouse']), 'Claimant: ' + o.org + '  Amount: $' + c.money(200, 9000) + '  Date of loss: ' + c.date(2023, 2026), '',
            'Assessor note: stock declared at $' + c.money(100, 4000) + ' had already been written off in the ' + c.pick(['previous', 'same']) + ' quarter. Photographs show the ' + c.pick(['same pallets', 'same serial numbers', 'intact crates']) + ' after the event.',
            'The ' + c.pick(['fire officer', 'assessor', 'witness']) + ' report differs from the claimant version on the point of origin.',
            'Recommended: ' + c.pick(['settle quietly', 'refer to the fraud unit', 'request a second opinion'])].join('\n'),
          tag: 'insurance fraud', juice: 1
        };
      }
    },
    {
      id: 'handler', label: 'Source handler notes', icon: '🕵️', juice: 3,
      make(c, o) {
        return {
          name: 'handler_' + c.num(3) + '.txt',
          text: [c.mark(), 'HANDLER NOTES — ' + c.caseNo(), 'Source: ' + c.pick(['a serving official', 'a contractor with site access', 'a relative of ' + c.person(), 'an employee inside ' + o.org]) + ' (cryptonym "' + c.pick(['ANCHOR', 'BRAMBLE', 'COPPER', 'DELTA', 'LANTERN']) + '")',
            'Meetings: ' + c.pick(['a car park off ' + c.last() + ' Road', 'the back room of a café', 'a hotel bar', 'by phone only']), '',
            ...c.many(c.int(3, 6), () => '  ' + c.date(2024, 2026) + ' — source reports ' + c.pick(['a payment to ' + c.person(), 'documents moved to ' + c.pick(['a private address', 'the archive']), 'a planned ' + c.pick(['inspection', 'transfer', 'closure']), 'pressure applied to ' + c.pick(['staff', 'a witness'])]) + '. ' + c.pick(['Corroborated in part.', 'Not corroborated.', 'Source appeared anxious.', 'Asked for money.'])), '',
            'Assessment: source is ' + c.pick(['reliable', 'of unknown reliability', 'possibly a double']) + '. Identity protected — ' + c.redact()].join('\n'),
          tag: 'intelligence source', juice: 3
        };
      }
    },
    {
      id: 'chemical', label: 'Chemical inventory', icon: '⚗️', juice: 2,
      make(c, o) {
        return {
          name: 'inventory_' + c.pick(['tank', 'store', 'drum']) + '.csv',
          text: ['substance,quantity_l,location,last_check,discrepancy', ...c.many(c.int(5, 9), () => [c.pick(['Solvent S' + c.int(10, 90), 'Reagent R-' + c.int(100, 900), 'Precursor P' + c.int(1, 40), 'Additive A' + c.int(1, 20)]), c.int(40, 20000), c.pick(['tank ' + c.int(1, 8), 'drum store', 'yard', 'basement']), c.date(2025, 2027), c.pick(['none', 'none', '−' + c.int(40, 900) + ' l unaccounted', 'over by ' + c.int(10, 300) + ' l'])].join(','))].join('\n'),
          tag: 'missing chemicals', juice: 2
        };
      }
    }
  ];
  for (const extra of MORE) SECRETS.push(extra);

  /* ---------- more of the same, much more: the deep catalogue ----------
     Embarrassing, compromising and career-ending documents. All invented, none explicit:
     the mature material is always a fact in a file (a hotel line item, a complaint, a clinic
     appointment, a message count), never a description. */
  const JUICE = [
    {
      id: 'xexpense', label: 'Expense claim with one odd line', icon: '🧾', juice: 3,
      make(c, o) {
        return {
          name: 'expenses_' + c.num(4) + '.csv',
          text: ['claim_id,date,employee,vendor,amount,gl_code,note',
            ...c.many(c.int(6, 9), (_, i) => ['EXP-' + c.num(4), c.date(2026, 2026), c.person(), c.pick(['Northgate Hotel', 'The Copper Anchor', 'Velvet Room Ltd', 'Harbor Cab Co', 'Pier 9 Bar', 'Lumen Lounge', 'Sunrise Clinic', 'Ace Couriers']), c.money(1, 4), 'T&E-' + c.int(100, 999), c.pick(['client dinner', 'late shift taxi', 'two nights', 'room service', 'refreshments', 'table 6, two hours', 'discreet delivery', 'stationery'])].join(',')),
            '', '# approved by ' + c.person() + ', ' + c.pick(o.roles), '# flagged by accounts ' + c.date(2026, 2026) + ': the venue on EXP-' + c.num(4) + ' is not a supplier and the receipt is a photograph.', o.org + ' — do not forward'].join('\n'),
          tag: 'expense fraud', juice: 3
        };
      }
    },
    {
      id: 'xaffair', label: 'Complaint about a manager and a subordinate', icon: '💌', juice: 3,
      make(c, o) {
        const a = c.person(), b = c.person();
        return {
          name: 'grievance_' + c.num(4) + '.txt',
          text: ['FORMAL GRIEVANCE — ' + c.mark(), 'Filed ' + c.date(2026, 2026) + ' by ' + a + ', ' + c.pick(o.roles), 'Against: ' + b + ' (' + c.pick(o.roles) + ')', '',
            '1. On ' + c.date(2025, 2026) + ' I was asked to book a hotel for two under a single name. The booking reference is ' + c.hex(6).toUpperCase() + '.',
            '2. The same room appears again on ' + c.date(2026, 2026) + ' and ' + c.date(2026, 2026) + ', both charged to the department.',
            '3. Messages between us were deleted from the shared inbox on ' + c.date(2026, 2026) + '. I have copies.',
            '4. I was moved to ' + c.pick(o.units) + ' eleven days after I raised this verbally.', '',
            'Outcome requested: investigation, and that the transfer is reversed.', 'Handling officer: ' + c.pick(['nobody assigned', 'the same manager', 'HR, on leave until ' + c.date(2026, 2027)]), c.redact()].join('\n'),
          tag: 'workplace affair', juice: 3
        };
      }
    },
    {
      id: 'xclinic', label: 'Embarrassing clinic appointment', icon: '🩺', juice: 2,
      make(c, o) {
        return {
          name: 'clinic_' + c.date(2026, 2026).replace(/-/g, '') + '.txt',
          text: ['APPOINTMENT SUMMARY — ' + c.pick(['Riverside Clinic', 'Sunrise Health', 'The Garden Practice', 'North Quay Medical']),
            'Patient: ' + c.person() + ' · DOB ' + c.date(1970, 2001), 'Seen by: ' + c.pick(['Dr ' + c.last(), 'Nurse ' + c.last(), 'a locum']),
            'Reason: ' + c.pick(['follow-up on a course of treatment', 'results discussion', 'a repeat prescription', 'an embarrassing rash', 'a private matter, patient asked for discretion', 'a procedure booked under a false name']),
            'Notes: patient requested that this visit is not billed to the company plan. Request declined.',
            'Next: ' + c.date(2026, 2027) + ' ' + c.time().slice(0, 5), '', 'Filed under ' + c.pick(o.dirs) + '/ — actually filed in the shared drive by mistake.', c.mark()].join('\n'),
          tag: 'medical embarrassment', juice: 2
        };
      }
    },
    {
      id: 'xhistory', label: 'Exported browser history', icon: '🌐', juice: 2,
      make(c, o) {
        return {
          name: 'history_' + c.pick(['desk', 'laptop', 'reception']) + '_' + c.num(3) + '.txt',
          text: ['BROWSER HISTORY EXPORT — ' + c.pick(o.units) + ' workstation', 'Profile: ' + c.person().toLowerCase().replace(/ /g, '.') + ' · exported ' + c.date(2026, 2026), '',
            ...c.many(c.int(8, 12), () => c.date(2026, 2026) + ' ' + c.time().slice(0, 5) + '  ' + c.pick(['mail.' + c.pick(o.domains), 'jobs.' + c.pick(['indeed.example', 'board.example']), 'search: ' + c.pick(['how to resign without notice', 'is it legal to record a meeting', 'average salary ' + c.pick(['manager', 'engineer', 'analyst']), 'hotel near ' + c.city(), 'divorce solicitor ' + c.city(), 'how to delete browser history properly']), 'social.example/u/' + c.first().toLowerCase(), 'dating.example/profile/edit', 'clinic.example/booking', 'auction.example/item/' + c.num(6)])), '',
            'Note: the profile was exported for an unrelated ticket, then kept. Nobody asked for it back.', c.mark()].join('\n'),
          tag: 'personal browsing', juice: 2
        };
      }
    },
    {
      id: 'xhotel', label: 'Hotel bookings for two', icon: '🏨', juice: 3,
      make(c, o) {
        const pair = c.person() + ' and ' + c.person();
        return {
          name: 'bookings_' + c.num(4) + '.txt',
          text: ['TRAVEL BOOKINGS — department account ' + c.hex(4).toUpperCase(), ...c.many(c.int(4, 7), () => '  ' + c.date(2026, 2026) + '  ' + c.pick(['Northgate Hotel', 'Quayside Inn', 'The Bell', 'Lakeside Lodge']) + '  ' + c.pick(['1 night', '2 nights', '3 nights']) + '  double  ' + c.pick(['booked by ' + c.first(), 'booked by the assistant', 'booked under a different name']) + '  ' + c.money(1, 2)), '',
            'Guests on file: ' + pair, 'Reason given: ' + c.pick(['site visit', 'conference', 'client meeting', 'training']), 'No conference was held on those dates.', '', 'Asked for the folios to be sent to a personal address: ' + c.first().toLowerCase() + c.num(2) + '@mail.example', c.mark()].join('\n'),
          tag: 'affair travel', juice: 3
        };
      }
    },
    {
      id: 'xkickback', label: 'Procurement kickback ledger', icon: '🤝', juice: 3,
      make(c, o) {
        return {
          name: 'ledger_' + c.pick(['quiet', 'private', 'draft']) + '_' + c.num(3) + '.txt',
          text: ['SUPPLIER LEDGER — kept off the accounting system', 'Buyer: ' + c.person() + ', ' + c.pick(['Procurement', 'Stores', 'Facilities']), '',
            ...c.many(c.int(5, 8), () => '  ' + c.date(2024, 2026) + '  ' + c.pick(['Hale Industrial', 'Brant Supplies', 'Copperfield Ltd', 'Vane Services']) + '  invoice ' + c.money(10, 90) + '  returned ' + c.money(1, 9) + '  ' + c.pick(['cash at the depot', 'envelope in the car park', 'paid into a family account', 'gift card']) + '  ref ' + c.hex(4).toUpperCase()), '',
            'Margin on the last three tenders: ' + c.int(9, 41) + ' per cent above market.', 'If audited: the second column is a rebate.'].join('\n'),
          tag: 'kickbacks', juice: 3
        };
      }
    },
    {
      id: 'xreview', label: 'Code review turned personal', icon: '💻', juice: 2,
      make(c, o) {
        return {
          name: 'review_thread_' + c.num(4) + '.txt',
          text: ['PR #' + c.int(200, 990) + ' — ' + c.pick(['hotfix', 'refactor', 'migration', 'cleanup']) + ' (' + c.pick(['merged', 'closed', 'merged under protest']) + ')', '',
            ...c.many(c.int(6, 9), (_, i) => (i % 2 ? c.person() + ': ' : 'author: ') + c.pick(['this is fine if you have never maintained anything', 'did you test this or just hope', 'I rewrote it, do not touch it again', 'the naming here is a war crime against English', 'please stop committing on Fridays', 'resolved: not my problem', 'this would be better in the bin', 'approved, but I am watching', 'why is there a password in the config']) + '  [' + c.date(2026, 2026) + ']'), '',
            'Author requested a transfer to another team on ' + c.date(2026, 2026) + '.', 'Reviewer later wrote the same file with the same bug. Nobody mentioned it.', c.mark()].join('\n'),
          tag: 'toxic review', juice: 2
        };
      }
    },
    {
      id: 'xbusfactor', label: 'The password only one person knows', icon: '🔑', juice: 3,
      make(c, o) {
        return {
          name: 'handover_' + c.num(3) + '.txt',
          text: ['HANDOVER NOTE — read before ' + c.pick(o.units) + ' goes live', 'Written ' + c.date(2025, 2026) + ' by ' + c.person(), '',
            'Root password for the ' + c.pick(['ledger', 'dispatch', 'billing', 'vault']) + ' server: ' + c.hex(8) + (c.chance(0.5) ? ' (same as the wifi)' : ' (written on the whiteboard)'),
            'The backup runs at 02:00 and fails silently. I have known since ' + c.date(2024, 2026) + ' and not fixed it.',
            'Only two people can restore from tape: me and ' + c.pick(['someone who left in ' + c.year(), 'a contractor whose number is in my phone', 'the vendor, for a fee']), '',
            'If something happens while I am away, call me. Do not email, it is monitored.', c.mark()].join('\n'),
          tag: 'bus factor', juice: 3
        };
      }
    },
    {
      id: 'xcourier', label: 'Courier manifest with a discreet delivery', icon: '📦', juice: 2,
      make(c, o) {
        return {
          name: 'manifest_' + c.date(2026, 2026).replace(/-/g, '') + '.txt',
          text: ['DELIVERY MANIFEST — ' + c.pick(['Ace Couriers', 'Nightline Parcel', 'Harbor Freight Desk']), 'Route: ' + c.pick(o.units), '',
            ...c.many(c.int(6, 9), () => '  ' + c.hex(5).toUpperCase() + '  ' + c.pick(['plain carton', 'marked box', 'soft parcel', 'sealed pouch', 'unmarked bag']) + '  ' + c.pick(['to reception', 'to the third floor', 'held for collection', 'left at security', 'signed for by ' + c.last()]) + '  ' + c.pick(['signature illegible', 'no signature', 'signed as the office', 'refused on first attempt'])), '',
            'Clerks note: three parcels a week arrive addressed to one person, never the company, always personal. ' + c.pick(['The desk was told not to open them.', 'The recipient asked for them to be logged as stationery.', 'The recipient paid the driver in cash.']), c.mark()].join('\n'),
          tag: 'discreet deliveries', juice: 2
        };
      }
    },
    {
      id: 'xfamily', label: 'Family court filing', icon: '⚖️', juice: 3,
      make(c, o) {
        return {
          name: 'filing_' + c.caseNo() + '.txt',
          text: ['IN THE FAMILY COURT — sealed by order', 'Case ' + c.caseNo() + ' · filed ' + c.date(2025, 2026), 'Applicant: ' + c.person() + '  Respondent: ' + c.person(), '',
            'The respondent is employed as ' + c.pick(o.roles) + ' at ' + o.org + '.',
            'Allegations: ' + c.pick(['failure to disclose income', 'removal of funds from a joint account', 'conduct in front of the children', 'an undisclosed address']), '.',
            'Financial statement: total income declared ' + c.money(40, 200) + ' per year. The respondent told the court there was no second account.',
            'Exhibit ' + c.int(2, 9) + ': statements for an account at ' + c.pick(['Kestrel Bank', 'Northway Savings', 'a credit union in ' + c.city()]) + ', opened ' + c.date(2022, 2026) + '.', '', 'Next hearing: ' + c.date(2026, 2027) + ' · ' + c.pick(['closed court', 'by video', 'adjourned']), c.redact()].join('\n'),
          tag: 'family court', juice: 3
        };
      }
    },
    {
      id: 'xlandlord', label: 'Landlord and tenant dispute', icon: '🏚', juice: 2,
      make(c, o) {
        return {
          name: 'dispute_' + c.num(4) + '.txt',
          text: ['NOTICE OF DISPUTE — ' + c.pick(['Flat 3, ' + c.int(2, 90) + ' ' + c.last() + ' Road', 'Unit ' + c.int(2, 40) + ', Quay Mills', 'the property at ' + c.int(2, 120) + ' ' + c.last() + ' Street']),
            'Landlord: ' + c.person() + '  Tenant: ' + c.person(), 'Tenancy from ' + c.date(2021, 2025) + ' · rent ' + c.money(1, 3) + ' per month', '',
            'Tenant complains: ' + c.pick(['damp in the second bedroom, reported eleven times', 'the boiler replaced with a second-hand unit', 'the deposit never protected', 'entry without notice on ' + c.date(2026, 2026)]), '.',
            'Landlord replies: ' + c.pick(['the tenant is mistaken', 'repairs are scheduled for ' + c.date(2026, 2027), 'the deposit was returned in cash', 'no record of any complaint']), '.',
            'Text messages: ' + c.int(14, 90) + ' exchanged. Tone: ' + c.pick(['hostile', 'threatening', 'apologetic', 'unprintable']), '.', '', 'Copy sent to ' + c.pick(['the council', 'a solicitor', 'the tenant union', 'nobody yet']), c.mark()].join('\n'),
          tag: 'housing dispute', juice: 2
        };
      }
    },
    {
      id: 'xfanfic', label: 'Someone left their writing in the share', icon: '✍️', juice: 1,
      make(c, o) {
        return {
          name: 'draft_' + c.pick(['final', 'final2', 'do-not-open', 'really-final']) + '_' + c.num(3) + '.txt',
          text: ['Chapter ' + c.int(3, 19) + ' — ' + c.pick(['The Lighthouse Keeper', 'Two Tickets to ' + c.city(), 'The Understudy', 'A Quiet Transfer', 'The Deputy and the Archivist']), 'by ' + c.pick(['an employee', 'a night porter', 'someone in ' + c.pick(o.units)]), '',
            c.pick(['She had not planned to say it out loud, but the storm had other ideas.', 'The lift stopped between floors and neither of them reached for the alarm.', 'He signed the register with the wrong name, on purpose, and she noticed.', 'The file was supposed to be confidential. So was the kiss.']), '',
            '(... ' + c.int(400, 4000) + ' more words, ' + c.pick(['all of it set at this company', 'with two characters who are obviously colleagues', 'including a scene in the archive room that HR would enjoy']) + ' ...)', '',
            'Saved in the shared drive because the personal one ran out of space.', 'Read count: ' + c.int(2, 40) + '. Comment: "please delete this" — not deleted.', c.mark()].join('\n'),
          tag: 'embarrassing writing', juice: 1
        };
      }
    },
    {
      id: 'xchat', label: 'Group chat export', icon: '💬', juice: 2,
      make(c, o) {
        return {
          name: 'chat_export_' + c.num(4) + '.txt',
          text: ['CHAT EXPORT — ' + c.pick(['the rota group', 'the floor chat', 'the management room', 'a group that should not exist']), 'Exported ' + c.date(2026, 2026) + ' by ' + c.person() + ' for a complaint', '',
            ...c.many(c.int(7, 11), () => '  ' + c.time().slice(0, 5) + ' ' + c.first() + ': ' + c.pick(['did anyone actually read the policy', 'he is in again, look busy', 'who approved that invoice', 'delete this after', 'she is leaving, do not tell the team yet', 'the numbers are made up, they always are', 'I am not covering for him again', 'send it to the personal email']) ), '',
            'Members: ' + c.person() + ', ' + c.person() + ', ' + c.person() + ', ' + c.redact(), 'One message was deleted by an admin before the export. It is still in the backup.', c.mark()].join('\n'),
          tag: 'chat leak', juice: 2
        };
      }
    },
    {
      id: 'xsalary', label: 'Everyone salary, unredacted', icon: '💷', juice: 3,
      make(c, o) {
        const rows = c.many(c.int(7, 11), () => [c.person(), c.pick(o.roles), c.money(30, 240), c.pick(['band ' + c.int(2, 6), 'off band', 'contract', 'temporary'])].join(','));
        return {
          name: 'pay_review_' + c.pick(['v2', 'final', 'leaked', 'draft']) + '.csv',
          text: ['name,role,salary,note', ...rows, '', '# two people with the same role are ' + c.money(10, 60) + ' apart', '# the difference was explained verbally as ' + c.pick(['performance', 'timing', 'a mistake nobody corrected', 'negotiation']), '# this file was sent to the whole department by mistake on ' + c.date(2026, 2026), c.mark()].join('\n'),
          tag: 'salary leak', juice: 3
        };
      }
    },
    {
      id: 'xexit', label: 'Exit interview nobody was meant to read', icon: '🚪', juice: 2,
      make(c, o) {
        return {
          name: 'exit_' + c.person().split(' ')[1].toLowerCase() + '.txt',
          text: ['EXIT INTERVIEW — ' + c.date(2026, 2026), 'Leaver: ' + c.person() + ', ' + c.pick(o.roles) + ', ' + c.int(1, 14) + ' years service', 'Interviewer: ' + c.person() + ' (HR)', '',
            'Q: Why are you leaving?', 'A: ' + c.pick(['The manager, specifically.', 'I was told my role was safe and then it was advertised.', 'I raised something in ' + c.date(2025, 2026) + ' and was moved instead.', 'Pay, and the fact that nobody would discuss it.']), '',
            'Q: Anything else we should know?', 'A: ' + c.pick(['Two people are doing the job of five and one of them is about to break.', 'The backup has not run since ' + c.date(2026, 2026) + ' and it is on a shared drive.', 'There is a folder on the server that should not exist.']), '',
            'Interviewer note: leaver asked for this not to be shared with ' + c.pick(['the manager', 'the board', 'the wider team']) + '. Note shared anyway.', c.mark()].join('\n'),
          tag: 'exit interview', juice: 2
        };
      }
    },
    {
      id: 'xresign', label: 'Resignation letter, unsent', icon: '📝', juice: 2,
      make(c, o) {
        return {
          name: 'resignation_' + c.pick(['draft', 'v3', 'final', 'angry']) + '.txt',
          text: ['Dear ' + c.first() + ',', '', c.pick(['I am writing to resign, effective immediately, though I have been drafting this since ' + c.date(2025, 2026) + '.', 'I am resigning. I would like to say it has been a pleasure.']), '',
            c.pick(['You know what you did in the meeting on ' + c.date(2026, 2026) + '. Everyone in the room knows.', 'I have kept every email. I have not decided what to do with them.', 'I am not staying for the audit, and neither should anyone else.', 'The last four months have been spent covering a decision I disagreed with in writing.']), '',
            'I will not be doing a handover for a role you refused to backfill.', '', 'Regards,', c.person(), '', '[never sent — saved to the desktop, then to the share]'].join('\n'),
          tag: 'unsent letter', juice: 2
        };
      }
    },
    {
      id: 'xreject', label: 'Rejection notes with opinions attached', icon: '❌', juice: 2,
      make(c, o) {
        return {
          name: 'shortlist_' + c.num(3) + '.txt',
          text: ['RECRUITMENT SHORTLIST — ' + c.pick(o.roles) + ', ' + c.date(2026, 2026), '',
            ...c.many(c.int(6, 8), () => '  ' + c.person() + '  ' + c.pick(['strong on paper', 'too senior', 'too junior', 'likely to leave', 'overqualified', 'not a culture fit', 'asked about pay twice']) + '  ' + c.pick(['reject', 'hold', 'reject — see note', 'interview']) + '  "' + c.pick(['sounds difficult on the phone', 'wrong school', 'accent was hard to follow', 'will want the job more than we want them', 'asked about the harassment policy', 'family situation, will need flexibility']) + '"'), '',
            'Note from the hiring manager: please delete the comments column before this goes anywhere official. It was not deleted.', c.mark()].join('\n'),
          tag: 'discriminatory notes', juice: 3
        };
      }
    },
    {
      id: 'xloyalty', label: 'Personal spending on the company card', icon: '💳', juice: 2,
      make(c, o) {
        return {
          name: 'card_' + c.hex(4).toUpperCase() + '.txt',
          text: ['CARD STATEMENT — ' + c.pick(o.units) + ' purchasing card ending ' + c.num(4), 'Holder: ' + c.person(), '',
            ...c.many(c.int(6, 10), () => '  ' + c.date(2026, 2026) + '  ' + c.pick(['Sunrise Clinic', 'Velvet Room Ltd', 'The Copper Anchor', 'Streaming Plus', 'Airline seat upgrade', 'Liquor Store 4', 'Gym membership', 'Hotel Northgate']) + '  ' + c.money(1, 3) + '  ' + c.pick(['no receipt', 'receipt says stationery', 'reclassified as client entertainment', 'approved verbally'])), '',
            'Reconciled by: the holder.', 'Second reviewer: none.', 'Items queried in ' + c.date(2026, 2026) + ': ' + c.int(3, 9) + '. Items answered: 0.', c.mark()].join('\n'),
          tag: 'card abuse', juice: 2
        };
      }
    },
    {
      id: 'xstrip', label: 'Receipt from a venue that is not a supplier', icon: '🍸', juice: 2,
      make(c, o) {
        return {
          name: 'receipt_' + c.num(5) + '.txt',
          text: [c.pick(['THE COPPER ANCHOR', 'VELVET ROOM', 'THE GILDED HOUR', 'PIER 9 LOUNGE']), c.pick(['14 Quay Street', '9 Lantern Lane', 'Unit 2, Old Rope Walk']) + ', ' + c.city(), c.date(2026, 2026) + ' ' + c.time().slice(0, 5), '',
            'table ' + c.int(2, 12) + '  party of ' + c.int(2, 5), '  ' + c.int(2, 5) + ' x house bottle      ' + c.int(40, 180), '  ' + c.int(1, 4) + ' x private room      ' + c.int(80, 400), '  ' + c.int(1, 3) + ' x hospitality       ' + c.int(60, 300), '',
            'TOTAL ' + c.money(1, 2), 'PAID: company card ending ' + c.num(4), '', 'Expensed as: ' + c.pick(['client development', 'stakeholder engagement', 'recruitment dinner', 'stationery']), 'Attendees on the claim: ' + c.person() + ', ' + c.person(), 'Nobody else was there.', c.mark()].join('\n'),
          tag: 'embarrassing receipt', juice: 2
        };
      }
    },
    {
      id: 'xdating', label: 'Dating profile drafted at work', icon: '💘', juice: 1,
      make(c, o) {
        return {
          name: 'profile_' + c.pick(['draft', 'about-me', 'v2']) + '.txt',
          text: ['DRAFT PROFILE — do not sync to phone', 'Name: ' + c.first() + ', ' + c.int(28, 55) + ' · ' + c.city(), '',
            'About: ' + c.pick(['I work too much and I am told that is a personality.', 'Looking for someone who does not ask what I do.', 'Recently separated, legally complicated.', 'I have a work phone and a private phone and I mix them up.']), '',
            'Notes to self: ' + c.pick(['take down the photo with the badge visible', 'do not mention the company', 'ask ' + c.first() + ' to delete the screenshot', 'remove the line about the hotel']), '',
            'Saved ' + c.date(2026, 2026) + ' in the work drive because the personal laptop was being repaired.', c.mark()].join('\n'),
          tag: 'personal profile', juice: 1
        };
      }
    },
    {
      id: 'xmessages', label: 'Recovered message summary', icon: '📱', juice: 3,
      make(c, o) {
        return {
          name: 'recovery_' + c.num(4) + '.txt',
          text: ['DEVICE EXTRACTION SUMMARY — ' + c.pick(['company phone', 'laptop backup', 'cloud archive']), 'Owner: ' + c.person() + ' · extracted ' + c.date(2026, 2026) + ' under case ' + c.caseNo(), '',
            'Messages recovered: ' + c.int(200, 4000), '  with ' + c.pick(['a colleague', 'a client contact', 'a number saved as "Do not answer"', 'a personal number']) + ': ' + c.int(40, 900) + ' (' + c.pick(['content withheld', 'reviewed by counsel only', 'deleted from the device but present in backup']) + ')',
            '  outside working hours: ' + c.int(30, 70) + ' per cent', '  one thread was moved to a personal app on ' + c.date(2026, 2026), '',
            'Photos: ' + c.int(2, 40) + ' (' + c.pick(['none relevant', 'two are marked for review', 'several were deleted on the day the complaint was filed']) + ')', '', 'Summary prepared for ' + c.pick(['HR', 'the board', 'external counsel']) + '. Contents not included in this file.', c.mark()].join('\n'),
          tag: 'extracted messages', juice: 3
        };
      }
    },
    {
      id: 'xschedule', label: 'The two-person rota nobody questioned', icon: '🗓', juice: 2,
      make(c, o) {
        const a = c.person(), b = c.person();
        return {
          name: 'rota_' + c.pick(['late', 'weekend', 'closed']) + '.txt',
          text: ['SHIFT ROTA — ' + c.pick(o.units), 'Week starting ' + c.date(2026, 2026), '',
            ...c.many(c.int(6, 9), () => '  ' + c.date(2026, 2026) + '  late  ' + a + ' + ' + b + '  ' + c.pick(['alone on site', 'no supervisor', 'building empty', 'alarm disarmed early'])), '',
            'The same two names for ' + c.int(8, 30) + ' weeks. Both requested it in writing.', 'Reason recorded: ' + c.pick(['cover for a colleague', 'project work', 'personal circumstances', 'not recorded']), '',
            'Neither has the other on any emergency contact form. Both list the same address.', c.mark()].join('\n'),
          tag: 'rota pattern', juice: 3
        };
      }
    },
    {
      id: 'xpaternity', label: 'A test result in the wrong folder', icon: '🧬', juice: 3,
      make(c, o) {
        return {
          name: 'result_' + c.num(4) + '.txt',
          text: ['LABORATORY RESULT — confidential, addressed to a named individual', 'Test: ' + c.pick(['paternity', 'relationship', 'genetic screening']), 'Sample received ' + c.date(2026, 2026) + ' · reported ' + c.date(2026, 2026), '',
            'Requested by: ' + c.person(), 'Subject: ' + c.pick(['a minor, name withheld', 'an adult who asked not to be named', 'sample labelled only with initials ' + c.initials()]), '',
            'Conclusion: ' + c.pick(['excluded', 'not excluded', 'inconclusive — second sample required', 'as expected by the requester']), '',
            'Addressed to ' + c.first().toLowerCase() + c.num(2) + '@mail.example, which forwards to the office inbox of ' + c.person() + '.', 'It sat in the shared drive for ' + c.int(4, 90) + ' days.', c.mark()].join('\n'),
          tag: 'test result', juice: 3
        };
      }
    },
    {
      id: 'xdivorce', label: 'Divorce paperwork on the work laptop', icon: '📄', juice: 2,
      make(c, o) {
        return {
          name: 'settlement_' + c.pick(['draft', 'v4', 'final']) + '.txt',
          text: ['DRAFT SETTLEMENT — not for circulation', 'Between: ' + c.person() + ' and ' + c.person(), 'Prepared ' + c.date(2026, 2026) + ' by ' + c.pick(['a solicitor in ' + c.city(), 'a mediator', 'counsel']) + '',
            'Assets: ' + c.pick(['the house, the car, a pension split 60/40', 'two properties and a business interest', 'savings held in a joint account closed ' + c.date(2026, 2026)]), '',
            'Disputed: ' + c.pick(['the value of the business', 'a loan to a family member', 'who keeps the dog', 'the contents of a storage unit']), '',
            'Client note: ' + c.pick(['do not email this to the work address again', 'I will print at the office, the printer at home is shared', 'my manager already knows, which is a problem']), '',
            'Saved to Documents on the company laptop. Synced to the company backup on ' + c.date(2026, 2026) + '.', c.mark()].join('\n'),
          tag: 'divorce papers', juice: 2
        };
      }
    },
    {
      id: 'xgamble', label: 'Betting ledger with a company name on it', icon: '🎲', juice: 3,
      make(c, o) {
        return {
          name: 'bets_' + c.num(4) + '.txt',
          text: ['PRIVATE LEDGER — ' + c.pick(['do not show', 'settled weekly', 'copy 2']), 'Account holder: ' + c.person(), '',
            ...c.many(c.int(5, 9), () => '  ' + c.date(2026, 2026) + '  ' + c.pick(['match ' + c.int(1, 6), 'race ' + c.int(1, 9), 'cards', 'the ' + c.pick(['late', 'early']) + ' game']) + '  stake ' + c.money(1, 12) + '  ' + c.pick(['lost', 'won', 'void', 'part-paid'])), '',
            'Balance owed: ' + c.money(4, 90), 'Paid from: ' + c.pick(['a personal account', 'the float', 'petty cash', 'an invoice to a supplier that does not exist']), '',
            'Two payments routed through ' + o.org + ' accounts. The finance officer was told it was ' + c.pick(['a refund', 'a deposit', 'a correction']), '.', c.mark()].join('\n'),
          tag: 'gambling debt', juice: 3
        };
      }
    },
    {
      id: 'xloanshark', label: 'Small loans to colleagues', icon: '💵', juice: 2,
      make(c, o) {
        return {
          name: 'loans_' + c.pick(['private', 'book', 'sheet']) + '.txt',
          text: ['LOANS OUTSTANDING — written in a notebook, photographed ' + c.date(2026, 2026), 'Lender: ' + c.person() + ' · ' + c.pick(o.roles), '',
            ...c.many(c.int(5, 8), () => '  ' + c.person() + '  ' + c.money(1, 6) + '  drawn ' + c.date(2025, 2026) + '  interest ' + c.int(5, 40) + ' per cent  ' + c.pick(['weekly', 'on payday', 'rolled over', 'overdue'])), '',
            'Security taken: ' + c.pick(['car keys', 'a passport', 'shift swaps', 'nothing, they are staff']), '',
            'Note: ' + c.pick(['three of these are people who report to the lender', 'one borrower has asked for it to stop', 'the lender signs off the overtime']), '.', c.mark()].join('\n'),
          tag: 'predatory lending', juice: 3
        };
      }
    },
    {
      id: 'xtrial', label: 'Trial data that did not match the report', icon: '🧪', juice: 3,
      make(c, o) {
        return {
          name: 'trial_' + c.pick(['raw', 'internal', 'unpublished']) + '_' + c.num(3) + '.txt',
          text: ['CLINICAL DATA — internal copy, not filed', 'Study ' + c.pick(['RIDGE-' + c.int(10, 99), 'HARBOR-' + c.int(1, 40), 'PALE-' + c.int(2, 77)]) + ' · site ' + c.pick(o.units), 'Opened ' + c.date(2023, 2026) + ' · closed ' + c.date(2025, 2026), '',
            'Participants enrolled: ' + c.int(60, 400), 'Withdrawn: ' + c.int(4, 60), 'Excluded after the fact: ' + c.int(2, 30) + ' (' + c.pick(['two sites, one of them ours', 'no reason recorded', 'adverse events, per the analyst']) + ')', '',
            'The published figure uses the ' + c.int(40, 70) + '-participant subset in which the effect is strongest.', 'The analyst objected on ' + c.date(2026, 2026) + ' and was moved off the study.', '', 'Draft retained in case anyone asks. Nobody has.', c.mark()].join('\n'),
          tag: 'data manipulation', juice: 3
        };
      }
    },
    {
      id: 'xsignature', label: 'Signatures that are all the same handwriting', icon: '🖊', juice: 3,
      make(c, o) {
        return {
          name: 'authorisations_' + c.num(4) + '.txt',
          text: ['AUTHORISATION REGISTER — ' + c.pick(['petty cash', 'payments', 'returns', 'access requests']), 'Period: ' + c.date(2025, 2026) + ' to ' + c.date(2026, 2026), '',
            ...c.many(c.int(6, 10), () => '  ' + c.date(2026, 2026) + '  ' + c.money(1, 9) + '  signed "' + c.initials() + '"  ' + c.pick(['no countersignature', 'countersigned by the same person', 'signed in the same pen', 'signed for someone on leave'])), '',
            'Two signatories are required for anything over ' + c.money(2, 6) + '. The register shows one on ' + c.int(60, 100) + ' per cent of entries.', '',
            'Annotated in the margin: "all of these are ' + c.first() + '." Do not leave this on the shared drive.', c.mark()].join('\n'),
          tag: 'forged approvals', juice: 3
        };
      }
    },
    {
      id: 'xwhistle', label: 'Whistleblower draft, half-finished', icon: '📢', juice: 3,
      make(c, o) {
        return {
          name: 'report_draft_' + c.num(3) + '.txt',
          text: ['TO: ' + c.pick(['the regulator', 'the board', 'a journalist at ' + c.pick(['The Ledger', 'Harbour Wire'])]), 'FROM: a member of staff at ' + o.org + ' (name withheld)', 'DRAFT — ' + c.date(2026, 2026), '',
            'What I can prove: ' + c.pick(['the inspection sheet was signed before the inspection happened', 'the safety log for ' + c.date(2026, 2026) + ' was rewritten', 'two containers left the yard unweighed', 'the report to the client used numbers I did not produce']), '.',
            'What I can show: ' + c.pick(['photographs, dated', 'a copy of the sheet with both versions', 'emails from the manager', 'a witness who will speak']), '.',
            'What I am afraid of: ' + c.pick(['that it will be obvious it was me', 'the last person who raised this', 'being moved again', 'losing the mortgage']), '.', '', 'Not sent. Saved here in case.', c.redact()].join('\n'),
          tag: 'whistleblower draft', juice: 3
        };
      }
    },
    {
      id: 'xshell', label: 'Shell companies in a familiar handwriting', icon: '🏢', juice: 3,
      make(c, o) {
        return {
          name: 'entities_' + c.num(3) + '.txt',
          text: ['REGISTER OF RELATED ENTITIES — internal file', '',
            ...c.many(c.int(4, 7), () => '  ' + c.pick(['Ashgrove Holdings', 'Pale Meridian Ltd', 'Cobalt Way Services', 'Kestrel Nominees', 'North Quay Trading']) + '  reg ' + c.hex(6).toUpperCase() + '  director ' + c.pick([c.last(), c.last() + ' (a relative)', 'a nominee service', 'the same address as the company']) + '  opened ' + c.year()), '',
            'Billing routed through these entities: ' + c.money(40, 900) + ' last year.', 'Two of them share a bank branch, an accountant and a mobile number.', 'None has employees. All send invoices for ' + c.pick(['consulting', 'logistics', 'site support']), '.', '', 'Prepared for ' + c.pick(['the board', 'nobody', 'a tax adviser']) + ' on ' + c.date(2026, 2026) + '. Do not send externally.', c.mark()].join('\n'),
          tag: 'shell companies', juice: 3
        };
      }
    },
    {
      id: 'xoffshore', label: 'Invoices to a PO box abroad', icon: '🏝', juice: 3,
      make(c, o) {
        return {
          name: 'invoices_' + c.pick(['scan', 'batch', 'flagged']) + '_' + c.num(3) + '.txt',
          text: ['INVOICE EXCEPTIONS — flagged by accounts, filed by hand', '',
            ...c.many(c.int(5, 8), () => '  INV-' + c.num(4) + '  ' + c.pick(['Pale Meridian Ltd', 'Ashgrove Holdings', 'Quiet Metrics SA']) + '  ' + c.money(3, 80) + '  PO Box ' + c.int(100, 999) + ', ' + c.pick(['St Helier', 'Road Town', 'Vaduz', 'Panama']) + '  ' + c.pick(['no purchase order', 'work described vaguely', 'same description as the last one', 'approved by ' + c.first()])), '',
            'Total this quarter: ' + c.money(100, 900), '', 'The approver and the beneficiary share a surname. This was raised once, verbally, and not minuted.', c.mark()].join('\n'),
          tag: 'offshore invoices', juice: 3
        };
      }
    },
    {
      id: 'xprank', label: 'Prank log kept by the night shift', icon: '😈', juice: 1,
      make(c, o) {
        return {
          name: 'pranks_' + c.num(3) + '.txt',
          text: ['THINGS DONE ON NIGHTS — ' + c.pick(o.units), '',
            ...c.many(c.int(6, 10), () => '  ' + c.date(2026, 2026) + '  ' + c.pick(['moved every chair into the lift', 'swapped two name plates', 'changed the hold music to a foghorn', 'left a rubber hand in the archive box', 'replied to the manager email as the manager', 'signed the visitors book as ' + c.first() + ' ' + c.last()])), '',
            'Nobody has complained except ' + c.first() + ', who complained twice.', 'The rubber hand is still in the archive box. It is logged as a sample.', c.mark()].join('\n'),
          tag: 'workplace pranks', juice: 1
        };
      }
    },
    {
      id: 'xsmell', label: 'Complaint about the kitchen', icon: '🥪', juice: 1,
      make(c, o) {
        return {
          name: 'complaint_' + c.num(3) + '.txt',
          text: ['FACILITIES COMPLAINT — ' + c.pick(o.units), 'Raised ' + c.date(2026, 2026) + ' by ' + c.person(), '',
            'Issue: ' + c.pick(['the fridge, specifically what is in it', 'a smell from the second floor kitchen', 'someone is reheating fish at 09:00', 'the dishwasher has not been emptied since ' + c.date(2026, 2026), 'a labelled lunch was eaten and the label was left behind']), '.',
            'Action taken: ' + c.pick(['a sign was printed', 'a second sign was printed', 'the fridge was emptied into a bin bag and left in the corridor', 'nothing']), '.', '',
            'Reply-all incident: the complaint was sent to ' + c.int(40, 400) + ' people. ' + c.int(3, 20) + ' replied all to say stop replying all.', 'The person named in paragraph 4 has asked for the file to be removed. It has not been.', c.mark()].join('\n'),
          tag: 'petty complaint', juice: 1
        };
      }
    },
    {
      id: 'xwifi', label: 'Every password in one text file', icon: '📶', juice: 3,
      make(c, o) {
        return {
          name: 'passwords_' + c.pick(['old', 'backup', 'NEW', 'do-not-share']) + '.txt',
          text: ['PASSWORDS — ' + o.org + ' (' + c.pick(['keep on the shared drive', 'printed copy in the drawer', 'last updated ' + c.date(2023, 2026)]) + ')', '',
            'wifi guest      ' + c.pick(['welcome123', 'guest' + c.num(4), 'the usual one']) ,
            'wifi office     ' + c.pick([o.org.split(' ')[0].toLowerCase() + c.num(3), 'Summer' + c.year() + '!', 'changeme']),
            'router          admin / ' + c.hex(6),
            'door code       ' + c.num(4) + '  (same since ' + c.year() + ')',
            'alarm           ' + c.num(4) + '  (engineer set it)',
            'vpn             ' + c.first().toLowerCase() + ' / ' + c.hex(8),
            'payroll portal  ' + c.pick(['shared with finance', 'one login for three people', 'taped under the keyboard']), '',
            'Note: ' + c.pick(['this file was emailed to a supplier', 'the guest network reaches the server', 'the door code is also the alarm code']), '.', c.mark()].join('\n'),
          tag: 'credential dump', juice: 3
        };
      }
    },
    {
      id: 'xshared', label: 'One admin account for everyone', icon: '👤', juice: 3,
      make(c, o) {
        return {
          name: 'admin_access_' + c.num(3) + '.txt',
          text: ['ACCESS NOTE — ' + c.pick(o.units), '', 'Admin account: ' + c.pick(['admin', 'sysops', 'root', 'support']) + ' / ' + c.pick(['Company' + c.year() + '!', c.hex(10), 'letmein' + c.num(2)]), 'Used by: ' + c.int(4, 19) + ' people, no named accounts.', '',
            'Logins are not attributable. The audit trail shows one user, always.', 'Two leavers still had the password at the time of the last review.', '',
            'Asked for individual accounts in ' + c.date(2023, 2026) + '. Reply: ' + c.pick(['budget', 'later', 'it works, do not touch it']), '.', c.mark()].join('\n'),
          tag: 'shared admin', juice: 3
        };
      }
    },
    {
      id: 'xssh', label: 'A private key committed by mistake', icon: '🔐', juice: 3,
      make(c, o) {
        return {
          name: 'id_rsa.backup' + c.pick(['.txt', '', '.old']),
          /* the header is written in pieces on purpose: this is an invented key for a puzzle, and no file here should look like a real one to a secret scanner */
          text: ['-----BEGIN ' + 'OPENSSH PRIVATE KEY-----', c.hex(64), c.hex(64), c.hex(32) + '==', '-----END ' + 'OPENSSH PRIVATE KEY-----', '',
            'Found in: ' + c.pick(['the build folder', 'a zip attached to a ticket', 'the backup of the old laptop', 'the public repo, for ' + c.int(3, 40) + ' days']), 'Belongs to: ' + c.pick(['the deployment bot', c.person(), 'the vendor', 'a contractor who has left']), '',
            'Revoked: ' + c.pick(['no', 'not yet', 'after the audit', 'the ticket is still open']), 'The key still works on ' + c.int(1, 6) + ' hosts.', c.mark()].join('\n'),
          tag: 'leaked private key', juice: 3
        };
      }
    },
    {
      id: 'xdeleted', label: 'Folder of things that were deleted', icon: '🗑', juice: 2,
      make(c, o) {
        return {
          name: 'recovered_' + c.num(4) + '.txt',
          text: ['RECOVERED DELETES — ' + c.pick(['desktop', 'shared drive', 'mailbox']), 'Recovered ' + c.date(2026, 2026) + ' during an unrelated restore', '',
            ...c.many(c.int(6, 10), () => '  ' + c.date(2025, 2026) + '  ' + c.pick(['draft of the audit reply', 'the original inspection sheet', 'a photo of the yard', 'invoice scan (edited)', 'an email chain about the transfer', 'the rota before it was changed']) + '  deleted by ' + c.pick([c.first(), 'an admin', 'unknown', 'the account that left'])), '',
            'Deletion dates cluster around ' + c.date(2026, 2026) + ', two days before the review.', 'Nothing here was ever asked for. It was kept because the backup keeps everything.', c.mark()].join('\n'),
          tag: 'deleted evidence', juice: 3
        };
      }
    },
    {
      id: 'xrevenge', label: 'An email that was never sent (twice)', icon: '📧', juice: 2,
      make(c, o) {
        return {
          name: 'drafts_' + c.num(3) + '.txt',
          text: ['DRAFTS FOLDER EXPORT — ' + c.pick(['work account', 'personal account used for work']), '',
            'Draft 1 (' + c.date(2026, 2026) + '):', '  To: all-staff', '  Subject: ' + c.pick(['Some things you should know', 'Re: the restructure', 'For the record']), '  Body: ' + c.pick(['Everything in that meeting was decided before it started.', 'You will find out on Friday and it will be dressed up as consultation.', 'I have the emails. I am not the only one.']), '',
            'Draft 2 (' + c.date(2026, 2026) + ', 41 minutes later):', '  To: ' + c.pick(['the board', 'a journalist', 'a solicitor']), '  Subject: ' + c.pick(['timeline', 'documents', 'question']), '  Body: ' + c.redact(), '',
            'Both saved. Neither sent. The account was still active ' + c.int(2, 60) + ' days after the leaver left.', c.mark()].join('\n'),
          tag: 'unsent email', juice: 2
        };
      }
    },
    {
      id: 'xblackmail', label: 'A note that reads like leverage', icon: '✉️', juice: 3,
      make(c, o) {
        return {
          name: 'note_' + c.pick(['handwritten', 'scan', 'copy']) + '_' + c.num(3) + '.txt',
          text: ['[transcribed from a scanned note found in ' + c.pick(['a locker', 'an envelope in the post tray', 'the photocopier tray']) + ']', '',
            c.first() + ',', 'I know about ' + c.pick(['the invoice in ' + c.pick(['March', 'June', 'October']), 'the flat in ' + c.city(), 'the meeting at the hotel', 'the second account', 'who signed the sheet']), '.',
            'I am not asking for much. ' + c.pick(['Two thousand by Friday.', 'A word in the right ear about the transfer.', 'The rota changed back.']), '', 'If not, I go to ' + c.pick(['the board', 'your wife', 'the regulator', 'the union']), '.', '',
            'I have copies. Do not try to find them.', '', '[Found by: ' + c.pick(['a cleaner', 'security', 'a colleague', 'the recipient']) + '. Reported to: ' + c.pick(['nobody', 'HR, who filed it', 'the police, informally']) + '. ' + c.mark() + ']'].join('\n'),
          tag: 'extortion note', juice: 3
        };
      }
    },
    {
      id: 'xburner', label: 'A phone nobody will admit to', icon: '📵', juice: 3,
      make(c, o) {
        return {
          name: 'handset_' + c.num(3) + '.txt',
          text: ['ASSET NOTE — unregistered handset', 'Found in ' + c.pick(['the stationery cupboard', 'a desk drawer', 'the server room', 'a coat pocket in lost property']), ', ' + c.date(2026, 2026), '',
            'Model: ' + c.pick(['older handset, no company asset tag', 'dual-SIM', 'prepaid, no contract']), 'Contacts stored: ' + c.int(3, 40) + ' (' + c.pick(['first names only', 'initials and numbers', 'a single contact called BOSS']) + ')',
            'Messages: ' + c.int(20, 400) + '. One thread is ' + c.int(100, 900) + ' messages long and was active during working hours.', '',
            'Claimed by: ' + c.pick(['nobody', c.person() + ' (denies it is theirs)', 'a contractor who has left', 'an unnamed member of ' + c.pick(o.units)]), '.', 'It was returned to the drawer and is still there.', c.mark()].join('\n'),
          tag: 'unregistered phone', juice: 3
        };
      }
    },
    {
      id: 'xcamera', label: 'Where the cameras are, and where they are not', icon: '📹', juice: 3,
      make(c, o) {
        return {
          name: 'cctv_' + c.pick(['plan', 'audit', 'additions']) + '.txt',
          text: ['CAMERA PLAN — ' + c.pick(o.units) + ' (revised ' + c.date(2026, 2026) + ')', '',
            ...c.many(c.int(6, 10), () => '  cam ' + c.num(2) + '  ' + c.pick(['entrance', 'corridor ' + c.int(1, 4), 'loading bay', 'store room', 'stairwell', 'car park', 'roof access']) + '  ' + c.pick(['live', 'live, not recorded', 'recording, not monitored', 'off since ' + c.date(2026, 2026), 'blind spot added by request'])), '',
            'Two cameras were moved after ' + c.date(2026, 2026) + ' at the request of ' + c.pick(['a manager', 'the security lead', 'an unnamed member of staff']) + '. The memo authorising it is not in the file.',
            'The store room has no coverage. The changing area had one until ' + c.date(2026, 2026) + '. It was removed after a complaint.', c.mark()].join('\n'),
          tag: 'camera blind spots', juice: 3
        };
      }
    }
  ];
  for (const extra of JUICE) SECRETS.push(extra);

  /* ---------- the second shelf: paperwork that should never have been shared ---------- */
  const JUICE2 = [
    {
      id: 'xgrievance', label: 'Grievance outcome, quietly worded', icon: '📋', juice: 3,
      make(c, o) {
        return {
          name: 'outcome_' + c.num(4) + '.txt',
          text: ['GRIEVANCE OUTCOME — ' + c.mark(), 'Case ' + c.caseNo() + ' · closed ' + c.date(2026, 2026), 'Complainant: ' + c.person() + '  Subject: ' + c.person() + ', ' + c.pick(o.roles), '',
            'Findings: ' + c.pick(['one allegation upheld in part', 'no findings, on the balance of probabilities', 'the conduct was inappropriate but not unlawful', 'the complaint was made in good faith']), '.',
            'Sanction: ' + c.pick(['informal conversation', 'no further action', 'a written reminder, filed separately', 'nothing recorded']), '.',
            'The complainant was moved to ' + c.pick(o.units) + ' by mutual agreement. There is no record of the agreement.', '',
            'Note to file: do not disclose this to the wider team. Two people already know the substance.', c.redact()].join('\n'),
          tag: 'buried grievance', juice: 3
        };
      }
    },
    {
      id: 'xsettle', label: 'Settlement with a silence clause', icon: '🤐', juice: 3,
      make(c, o) {
        return {
          name: 'settlement_' + c.caseNo() + '.txt',
          text: ['SETTLEMENT AGREEMENT — draft ' + c.int(1, 6) + ' of ' + c.int(4, 9), 'Parties: ' + o.org + ' and ' + c.person(), 'Date: ' + c.date(2025, 2026) + ' · Sum: ' + c.money(10, 300), '',
            '1. The employee withdraws all claims, complaints and internal reports.',
            '2. The employee shall not discuss the circumstances with any person, including former colleagues.',
            '3. No admission of liability is made.',
            '4. References will confirm only dates of employment.', '',
            'Handwritten addition: "and the matter in ' + c.date(2025, 2026) + ' is not to be reopened." Initialled, not dated.',
            c.pick(['Two other employees raised the same issue and were told there was no pattern.', 'The clause covers a second person who has not signed anything.', 'The payment was booked to professional fees.']), c.redact()].join('\n'),
          tag: 'hush settlement', juice: 3
        };
      }
    },
    {
      id: 'xsick', label: 'Sick note with the real reason on the back', icon: '🤒', juice: 2,
      make(c, o) {
        return {
          name: 'absence_' + c.num(3) + '.txt',
          text: ['FIT NOTE (scanned) — ' + c.pick(['Dr ' + c.last(), 'the practice on ' + c.last() + ' Street', 'an out-of-hours service']), 'Patient: ' + c.person() + '  Date: ' + c.date(2026, 2026), 'Unfit for work: ' + c.int(2, 21) + ' days.', '',
            'Diagnosis given to employer: ' + c.pick(['a minor procedure', 'stress-related illness', 'a back problem', 'not specified, patient declined']), '.',
            'Note on the reverse (not sent to HR): ' + c.pick(['patient asked what to say about the clinic', 'patient is being treated for something they will not disclose at work', 'patient asked whether a termination is confidential', 'patient asked about fertility treatment and time off']), '.', '',
            'Return to work interview: ' + c.pick(['not scheduled', 'scheduled twice, both cancelled', 'booked for ' + c.date(2026, 2027)]), '.', c.mark()].join('\n'),
          tag: 'sick leave detail', juice: 2
        };
      }
    },
    {
      id: 'xattendance', label: 'Attendance record that does not match the door', icon: '🚪', juice: 2,
      make(c, o) {
        return {
          name: 'attendance_' + c.pick(['q1', 'q2', 'may', 'oct']) + '.csv',
          text: ['name,clock_in,clock_out,badge_events,note',
            ...c.many(c.int(6, 9), () => [c.person(), '0' + c.int(6, 9) + ':' + c.pick(['02', '17', '41', '55']), '1' + c.int(5, 9) + ':' + c.pick(['04', '22', '48']), String(c.int(0, 3)), c.pick(['badge not used', 'tailgated', 'buddy punch suspected', 'no door event all day', 'left at ' + c.time().slice(0, 5)])].join(',')), '',
            '# three records show a clock-in with no door event on the same day', '# raised with the supervisor ' + c.date(2026, 2026) + '; the file was returned without comment', c.mark()].join('\n'),
          tag: 'attendance gaps', juice: 2
        };
      }
    },
    {
      id: 'xtimesheet', label: 'Overtime that was never worked', icon: '⏱', juice: 3,
      make(c, o) {
        return {
          name: 'overtime_' + c.num(4) + '.txt',
          text: ['OVERTIME CLAIMS — ' + c.pick(o.units) + ', ' + c.pick(['March', 'July', 'November']) + ' ' + c.year(), '',
            ...c.many(c.int(6, 9), () => '  ' + c.person() + '  ' + c.int(6, 40) + ' hrs  approved by ' + c.pick(['the same supervisor', 'nobody — auto-approved', 'the claimant', 'a manager on leave']) + '  ' + c.pick(['no shift record', 'no door event', 'site was closed', 'work order does not exist'])), '',
            'Total claimed: ' + c.money(4, 40), 'Total evidenced: ' + c.money(1, 6), '',
            'The supervisor who approved every line is the same one who signs the pay run.', c.pick(['A query was raised in ' + c.date(2026, 2026) + ' and withdrawn.', 'Two claims were paid twice and not clawed back.']), c.mark()].join('\n'),
          tag: 'false overtime', juice: 3
        };
      }
    },
    {
      id: 'xinventory', label: 'Shortfall nobody wrote down', icon: '📉', juice: 3,
      make(c, o) {
        return {
          name: 'count_' + c.date(2026, 2026).replace(/-/g, '') + '.txt',
          text: ['STOCK COUNT — ' + c.pick(o.units), 'Counted by ' + c.person() + ' and ' + c.person() + ' · ' + c.date(2026, 2026), '',
            ...c.many(c.int(6, 9), () => '  ' + c.pick(['sealed cartons', 'pallets', 'crates', 'spares', 'copper reels', 'fuel cans']) + '  expected ' + c.int(40, 900) + '  found ' + c.int(10, 500) + '  ' + c.pick(['written off', 'recounted', 'adjusted on the system', 'not investigated'])), '',
            'Difference: ' + c.money(3, 90) + ' at cost.', 'Explanation on file: ' + c.pick(['"shrinkage"', '"previous count was wrong"', 'none', '"see ' + c.first() + '"']), '', 'The count sheet was signed before the count finished. Both counters were on leave the following week.', c.mark()].join('\n'),
          tag: 'stock theft', juice: 3
        };
      }
    },
    {
      id: 'xbribe', label: 'An envelope logged as a document', icon: '💼', juice: 3,
      make(c, o) {
        return {
          name: 'post_' + c.num(4) + '.txt',
          text: ['POST ROOM LOG — ' + c.pick(o.units), '',
            ...c.many(c.int(5, 8), () => '  ' + c.date(2026, 2026) + '  ' + c.pick(['A4 envelope, no stamp', 'padded envelope', 'sealed box', 'courier satchel']) + '  addressed to ' + c.pick([c.person(), c.pick(o.roles), 'the tender panel', 'a name nobody recognised']) + '  ' + c.pick(['signed for by the recipient in person', 'collected after hours', 'left in the pigeonhole', 'refused, then accepted'])), '',
            'Two entries are recorded as "documents" but weighed more than a document should.', 'The recipient has asked for the log to be kept off the system.', '', 'No further entries after ' + c.date(2026, 2026) + '. ' + c.mark()].join('\n'),
          tag: 'suspicious post', juice: 3
        };
      }
    },
    {
      id: 'xgifts', label: 'Gifts that should have been declared', icon: '🎁', juice: 2,
      make(c, o) {
        return {
          name: 'gifts_' + c.num(3) + '.txt',
          text: ['GIFT AND HOSPITALITY REGISTER — ' + o.org, 'Declared items only. Prepared ' + c.date(2026, 2026), '',
            ...c.many(c.int(5, 9), () => '  ' + c.person() + '  from ' + c.pick(['Hale Industrial', 'Brant Supplies', 'a client', 'an unnamed supplier']) + '  ' + c.pick(['two tickets', 'a bottle', 'a hamper', 'a weekend', 'cash in a card', 'a watch']) + '  value ' + c.money(1, 6) + '  ' + c.pick(['declared', 'declared late', 'not declared', 'declined then kept'])), '',
            'Declared value this year: ' + c.money(2, 20) + '. Undeclared, per the note below: ' + c.money(4, 60) + '.', 'Note in the margin: "the watch is a loan, not a gift." It is still in the drawer.', c.mark()].join('\n'),
          tag: 'undeclared gifts', juice: 2
        };
      }
    },
    {
      id: 'xaudit', label: 'Audit findings marked do not distribute', icon: '📕', juice: 3,
      make(c, o) {
        return {
          name: 'audit_' + c.year() + '_' + c.num(3) + '.txt',
          text: ['INTERNAL AUDIT — DRAFT FINDINGS, DO NOT DISTRIBUTE', 'Scope: ' + c.pick(o.dirs) + ', ' + c.date(2025, 2026) + ' to ' + c.date(2026, 2026) + ' · Auditor: ' + c.pick(['a junior member of staff', 'an external firm', c.person()]), '',
            ...c.many(c.int(4, 7), (_, i) => (i + 1) + '. ' + c.pick(['payments approved by the beneficiary', 'no segregation of duties in ' + c.pick(o.units), 'the register was not kept for ' + c.int(2, 14) + ' months', 'records retained off site without a retention schedule', 'two suppliers share a bank account', 'the same person reconciles and signs'])), '',
            'Management response: ' + c.pick(['accepted, no date', 'disputed', 'not received', '"see the previous audit"']), '',
            'Final version issued with ' + c.int(1, 3) + ' of the findings removed. The draft was kept by the auditor, who left in ' + c.year() + '.', c.redact()].join('\n'),
          tag: 'suppressed audit', juice: 3
        };
      }
    },
    {
      id: 'xpentest', label: 'Security test nobody acted on', icon: '🛡', juice: 3,
      make(c, o) {
        return {
          name: 'pentest_' + c.year() + '.txt',
          text: ['PENETRATION TEST — internal, circulated to ' + c.int(2, 5) + ' people', 'Dated ' + c.date(2024, 2026) + ' · target: ' + o.org, '',
            ...c.many(c.int(5, 8), (_, i) => '  F' + (i + 1) + '  ' + c.pick(['default credentials on the ' + c.pick(['router', 'printer', 'backup console']), 'unauthenticated database port open', 'staff email on a list from a breach', 'no lockout after ' + c.int(50, 900) + ' attempts', 'shared admin password', 'backup stored on the same disk']) + '  ' + c.pick(['critical', 'high', 'medium']) + '  ' + c.pick(['open', 'open', 'accepted risk', 'fixed then reverted'])), '',
            'Retest: ' + c.pick(['not requested', 'requested, no date', 'scheduled for ' + c.date(2026, 2027)]), '', 'The report was found in a shared folder readable by everyone, which is one of the findings.', c.mark()].join('\n'),
          tag: 'ignored pentest', juice: 3
        };
      }
    },
    {
      id: 'xphish', label: 'Who clicked, by name', icon: '🎣', juice: 2,
      make(c, o) {
        return {
          name: 'phish_results_' + c.num(3) + '.txt',
          text: ['PHISHING SIMULATION RESULTS — ' + c.pick(o.units), 'Campaign ' + c.date(2026, 2026) + ' · sent ' + c.int(40, 300) + ' · clicked ' + c.int(6, 60) + ' · credentials entered ' + c.int(1, 20), '',
            ...c.many(c.int(5, 8), () => '  ' + c.person() + '  ' + c.pick(['clicked', 'entered credentials', 'reported it', 'forwarded it to a colleague']) + '  ' + c.pick(['no training completed', 'training completed ' + c.date(2024, 2026), 'repeat offender', 'manager']) ), '',
            'Names were kept because "it may be needed for disciplinary purposes".', 'Two of the people listed left the company before the results were published.', c.mark()].join('\n'),
          tag: 'phishing list', juice: 2
        };
      }
    },
    {
      id: 'xreset', label: 'Password resets for one account', icon: '🔄', juice: 3,
      make(c, o) {
        const target = c.person();
        return {
          name: 'resets_' + c.num(4) + '.txt',
          text: ['PASSWORD RESET LOG — ' + c.pick(o.units), 'Account: ' + target.split(' ')[0].toLowerCase() + '.' + target.split(' ')[1].toLowerCase() + '  (' + c.pick(o.roles) + ')', '',
            ...c.many(c.int(6, 9), () => '  ' + c.date(2026, 2026) + ' ' + c.time().slice(0, 5) + '  reset requested by ' + c.pick(['helpdesk after a call', 'an administrator', 'the account holder', 'an unknown caller who knew the date of birth']) + '  ' + c.pick(['password emailed to a personal address', 'temporary password read out', 'reset without identity check'])), '',
            'The account holder reported ' + c.int(1, 3) + ' times that they had not requested the resets.', 'The log was never escalated. The ticket reads: "user confused".', c.mark()].join('\n'),
          tag: 'account takeover', juice: 3
        };
      }
    },
    {
      id: 'xdeaddrop', label: 'Instructions with no names in them', icon: '📍', juice: 3,
      make(c, o) {
        return {
          name: 'instructions_' + c.num(3) + '.txt',
          text: ['[printed message, no letterhead]', '', 'Leave it ' + c.pick(['behind the third bin', 'under the bench at the far end', 'in the locker with no number', 'at the desk on the first floor, second drawer']), ' on ' + c.pick(['Tuesday', 'Thursday', 'the last working day']) + '.',
            'Do not use the office phone. Do not use email.', 'If anyone asks, it is ' + c.pick(['a delivery for a client', 'part of the stock count', 'a personal errand']), '.', '',
            'Confirm with a single word: ' + c.pick(['DONE', 'OK', 'SENT', 'MOVED']), '.', '',
            '[Found in ' + c.pick(['the printer tray', 'an envelope taped under a desk', 'a locker', 'a coat pocket']) + '. Handwriting matches ' + c.pick(['an employee', 'nobody on file', 'a person who has left']) + '. ' + c.mark() + ']'].join('\n'),
          tag: 'dead drop note', juice: 3
        };
      }
    },
    {
      id: 'xreviews', label: 'Reviews written by the staff', icon: '⭐', juice: 2,
      make(c, o) {
        return {
          name: 'reviews_draft_' + c.num(3) + '.txt',
          text: ['REVIEW CAMPAIGN — draft posts, do not publish from office accounts', 'Client: ' + o.org + ' · drafted ' + c.date(2026, 2026), '',
            ...c.many(c.int(5, 8), () => '  "' + c.pick(['faultless service', 'genuinely the best in the region', 'I have used them three times and will again', 'the staff went above and beyond', 'no complaints at all', 'excellent value']) + '"  by ' + c.pick([c.person(), c.first() + ' ' + c.last()[0] + '.', 'a satisfied customer']) + '  ' + c.pick(['5 stars', '5 stars', '4 stars']) ), '',
            'Six of the reviews were posted from the office IP range on the same afternoon.', 'Three were removed by the platform in ' + c.date(2026, 2026) + ' and reposted under new names.', c.mark()].join('\n'),
          tag: 'fake reviews', juice: 2
        };
      }
    },
    {
      id: 'xinfluencer', label: 'Paid promotion dressed as a review', icon: '📸', juice: 2,
      make(c, o) {
        return {
          name: 'brief_' + c.num(3) + '.txt',
          text: ['CREATOR BRIEF — ' + o.org, 'Creator: @' + c.first().toLowerCase() + c.pick(['hq', 'daily', 'official', 'life']) + ' · fee ' + c.money(1, 30), '',
            'Do: ' + c.pick(['hold the product with the label facing the camera', 'say you use it every day', 'mention the discount code', 'film in a kitchen that looks lived in']), '',
            'Do not: ' + c.pick(['say it was paid for', 'use the word advert', 'mention the side effects', 'reply to comments asking if it works']), '',
            'Deliverables: ' + c.int(1, 4) + ' posts, ' + c.int(1, 3) + ' stories, ' + c.pick(['one unboxing', 'one before-and-after', 'one giveaway']), '.', 'The contract says the fee is for "content only". The brief says what to claim.', c.mark()].join('\n'),
          tag: 'undisclosed ads', juice: 2
        };
      }
    },
    {
      id: 'xdatalist', label: 'A customer list with a price on it', icon: '🧾', juice: 3,
      make(c, o) {
        return {
          name: 'list_' + c.pick(['export', 'sample', 'offer']) + '_' + c.num(3) + '.csv',
          text: ['email,postcode,last_order,consent,value',
            ...c.many(c.int(6, 10), () => [c.first().toLowerCase() + '.' + c.last().toLowerCase() + '@mail.example', c.pick(['AB1 2CD', 'NE3 4PQ', 'SW9 0RT', 'EH2 5LM']), c.date(2024, 2026), c.pick(['yes', 'yes', 'not recorded', 'withdrawn']), c.money(1, 3)].join(',')), '',
            '# ' + c.int(4, 40) + ' thousand rows, offered at ' + c.money(1, 8) + ' per thousand', '# buyer: ' + c.pick(['a broker', 'an agency', 'unknown — via a messaging app']), '# consent column is mostly "not recorded"', c.mark()].join('\n'),
          tag: 'data sale', juice: 3
        };
      }
    },
    {
      id: 'xgdpr', label: 'Erasure requests nobody processed', icon: '🗃', juice: 2,
      make(c, o) {
        return {
          name: 'erasure_' + c.num(3) + '.txt',
          text: ['DATA SUBJECT REQUESTS — backlog', 'Maintained by ' + c.pick([c.person(), 'nobody since ' + c.date(2026, 2026)]), '',
            ...c.many(c.int(6, 9), () => '  ' + c.caseNo() + '  ' + c.pick(['erasure', 'access', 'rectification', 'objection']) + '  received ' + c.date(2025, 2026) + '  ' + c.pick(['not started', 'acknowledged only', 'overdue by ' + c.int(20, 300) + ' days', 'closed without action'])), '',
            'Oldest open request: ' + c.date(2024, 2025) + '.', 'The register itself is the only record; the mailbox was archived and deleted.', c.mark()].join('\n'),
          tag: 'compliance backlog', juice: 2
        };
      }
    },
    {
      id: 'xcostume', label: 'Photos from the staff party', icon: '🎭', juice: 2,
      make(c, o) {
        return {
          name: 'party_' + c.date(2026, 2026).replace(/-/g, '') + '.txt',
          text: ['STAFF PARTY — photo folder index', 'Venue: ' + c.pick(['the social club', 'a hotel function room', 'the upstairs bar', 'a marquee in the car park']) + ' · theme: ' + c.pick(['fancy dress', 'decades', 'film characters', 'anything but work clothes']), '',
            ...c.many(c.int(6, 10), (_, i) => '  IMG_' + c.num(4) + '.jpg  ' + c.pick(['two people, one in costume', 'group shot, one face unclear', 'someone on a table', 'the manager in a wig', 'a kiss, out of focus', 'somebody asleep in a coat']) + '  ' + c.pick(['tagged', 'untagged', 'asked to be removed', 'shared in the group chat'])), '',
            'Removal requests: ' + c.int(1, 5) + '. Photos actually removed: ' + c.int(0, 1) + '.', 'The folder is on the shared drive and has been since ' + c.date(2026, 2026) + '.', c.mark()].join('\n'),
          tag: 'party photos', juice: 2
        };
      }
    },
    {
      id: 'xkaraoke', label: 'A bar tab with the company name on it', icon: '🎤', juice: 1,
      make(c, o) {
        return {
          name: 'tab_' + c.num(4) + '.txt',
          text: ['BAR TAB — ' + c.pick(['The Gilded Hour', 'Pier 9 Lounge', 'The Copper Anchor']), c.date(2026, 2026) + ' from ' + c.time().slice(0, 5), '',
            '  ' + c.int(4, 14) + ' x rounds        ' + c.money(1, 3), '  ' + c.int(2, 6) + ' x bar food      ' + c.money(1, 2), '  room hire            ' + c.money(1, 2), '', 'TOTAL ' + c.money(1, 4), '',
            'Paid by: ' + c.pick(['company card', 'petty cash', 'a personal card, claimed back', 'the manager, no receipt']), 'Expensed as: ' + c.pick(['team building', 'staff welfare', 'client hosting', 'training']), '',
            'Two names on the tab are not employees. One of them sang for forty minutes.', c.mark()].join('\n'),
          tag: 'bar tab', juice: 1
        };
      }
    },
    {
      id: 'xkeys', label: 'A list of who holds which key', icon: '🗝', juice: 3,
      make(c, o) {
        return {
          name: 'keys_' + c.pick(['register', 'old', 'updated']) + '.txt',
          text: ['KEY REGISTER — ' + c.pick(o.units), 'Last reconciled: ' + c.pick([c.date(2023, 2026), 'never', 'unknown']), '',
            ...c.many(c.int(6, 10), () => '  ' + c.pick(['front door', 'store', 'archive', 'plant room', 'safe', 'van', 'server cabinet']) + '  key ' + c.num(2) + '  held by ' + c.pick([c.person(), c.person() + ' (left ' + c.year() + ')', 'not recorded', 'two people, one signature'])), '',
            'Keys cut without authorisation: ' + c.int(1, 6) + '.', 'One key opens both the archive and the cabinet where the backups are kept.', '', 'The alarm code is written on the back of this sheet.', c.mark()].join('\n'),
          tag: 'key control', juice: 3
        };
      }
    },
    {
      id: 'xvoicemail', label: 'Voicemail transcript nobody deleted', icon: '☎️', juice: 2,
      make(c, o) {
        return {
          name: 'voicemail_' + c.num(3) + '.txt',
          text: ['VOICEMAIL TRANSCRIPTS — extension ' + c.num(4) + ', ' + c.pick(o.units), '',
            ...c.many(c.int(5, 8), () => '  ' + c.date(2026, 2026) + ' ' + c.time().slice(0, 5) + '  from ' + c.pick(['a withheld number', c.person(), 'a client', 'a supplier']) + ': "' + c.pick(['call me back, it is about the thing we discussed', 'you left the folder in the car, I have it', 'do not put that in writing', 'they know, someone told them', 'I am not coming in and you know why', 'the payment did not arrive again']) + '"'), '',
            'Transcripts are kept for ' + c.int(6, 36) + ' months and visible to ' + c.pick(['anyone with the admin login', 'the whole team', 'one person, who has left']), '.', c.mark()].join('\n'),
          tag: 'voicemail leak', juice: 2
        };
      }
    },
    {
      id: 'xpetty', label: 'Petty cash that is neither', icon: '🪙', juice: 2,
      make(c, o) {
        return {
          name: 'petty_' + c.pick(['cash', 'float', 'box']) + '_' + c.num(3) + '.txt',
          text: ['PETTY CASH BOOK — ' + c.pick(o.units), 'Float: ' + c.money(1, 3) + ' · reconciled ' + c.pick(['weekly', 'monthly', 'once']), '',
            ...c.many(c.int(6, 10), () => '  ' + c.date(2026, 2026) + '  ' + c.money(1, 1) + '  ' + c.pick(['taxi', 'milk', 'stamps', 'cleaning supplies', 'lunch', 'parking', 'a card for someone leaving', 'unknown']) + '  receipt: ' + c.pick(['yes', 'no', 'photocopy of a photocopy', 'written on the back of an envelope'])), '',
            'Receipts missing: ' + c.int(3, 20) + '. Cash short: ' + c.money(1, 2) + '.', 'The box is kept in ' + c.pick(['a locked drawer', 'an unlocked drawer', 'the stationery cupboard', 'a coat pocket']), '.', c.mark()].join('\n'),
          tag: 'petty cash', juice: 2
        };
      }
    },
    {
      id: 'xinsurance', label: 'An insurance claim that grew', icon: '💥', juice: 3,
      make(c, o) {
        return {
          name: 'claim_' + c.num(5) + '.txt',
          text: ['INSURANCE CLAIM — ' + c.pick(['water damage', 'fire', 'theft', 'vehicle']), 'Claim ' + c.caseNo() + ' · incident ' + c.date(2025, 2026) + ' · reported ' + c.date(2026, 2026), '',
            'Original estimate: ' + c.money(4, 40), 'Revised estimate: ' + c.money(20, 200), 'Items added after the assessor visited: ' + c.int(3, 20), '',
            'Added items include ' + c.pick(['a television that was not in the room', 'stock that was already written off', 'a laptop with no serial in the asset register', 'damage to a wall that was like that before']), '.',
            'The photographs were taken ' + c.int(1, 30) + ' days after the incident, according to the metadata. The claim says the same day.', '', 'Settled for ' + c.money(10, 90) + ' without a second visit.', c.mark()].join('\n'),
          tag: 'inflated claim', juice: 3
        };
      }
    },
    {
      id: 'xsafety', label: 'A safety log filled in afterwards', icon: '⚠️', juice: 3,
      make(c, o) {
        return {
          name: 'safety_' + c.pick(['checks', 'log', 'sheets']) + '_' + c.num(3) + '.txt',
          text: ['DAILY SAFETY CHECKS — ' + c.pick(o.units), 'Week of ' + c.date(2026, 2026), '',
            ...c.many(c.int(5, 7), () => '  ' + c.date(2026, 2026) + '  checks: ' + c.pick(['complete', 'complete', 'partial', 'not done']) + '  initials: ' + c.initials() + '  ' + c.pick(['all clear', 'one fault noted', 'no fault, no notes', 'signature looks the same every day'])), '',
            'Every entry for the week was written in the same pen, in one sitting, on ' + c.date(2026, 2026) + '.', 'The fault that caused the incident was reported verbally ' + c.int(2, 20) + ' days earlier and not logged.', c.mark()].join('\n'),
          tag: 'falsified safety log', juice: 3
        };
      }
    },
    {
      id: 'xrecording', label: 'A meeting someone recorded', icon: '🎙', juice: 3,
      make(c, o) {
        return {
          name: 'memo_' + c.num(4) + '.txt',
          text: ['RECORDING — kept without consent', 'File: meeting_' + c.date(2026, 2026).replace(/-/g, '') + '.m4a · ' + c.int(8, 90) + ' minutes', 'Recorded by: ' + c.pick(['a participant', 'an assistant', 'unknown — found on a shared drive']), '',
            'Transcript excerpt:', '  ' + c.pick(['"We are not putting that in the minutes."', '"If it comes up, we say we did not know."', '"Just get the number to match and we are done."', '"Do not tell ' + c.first() + ' until after the review."']), '  ' + c.pick(['"I am not comfortable with that."', '"That is not what the policy says."', '"Somebody will find out."']), '',
            'Attendees listed: ' + c.int(3, 7) + '. Consent: ' + c.pick(['not asked', 'refused by one person, recorded anyway', 'stated as "for note taking"']), '.', '', 'The file was found by someone who was not in the meeting, which is how this started.', c.mark()].join('\n'),
          tag: 'covert recording', juice: 3
        };
      }
    },
    {
      id: 'xmileage', label: 'Mileage for a journey that did not happen', icon: '🚗', juice: 2,
      make(c, o) {
        return {
          name: 'mileage_' + c.pick(['jan', 'apr', 'sep']) + '.csv',
          text: ['date,employee,from,to,miles,rate,note',
            ...c.many(c.int(6, 9), () => [c.date(2026, 2026), c.person(), c.city(), c.pick(['the warehouse', 'a client site', 'the depot', 'a conference in ' + c.city()]), String(c.int(12, 480)), '0.45', c.pick(['round trip', 'no parking receipt', 'same route twice in a day', 'site was closed that week'])].join(',')), '',
            '# total claimed ' + c.pick(['this month', 'this quarter']) + ': ' + c.money(1, 4), '# the fleet tracker shows the vehicle parked on ' + c.int(3, 20) + ' of those days', c.mark()].join('\n'),
          tag: 'mileage fraud', juice: 2
        };
      }
    },
    {
      id: 'xrefund', label: 'Refunds to a card nobody recognises', icon: '🔁', juice: 3,
      make(c, o) {
        return {
          name: 'refunds_' + c.num(4) + '.csv',
          text: ['order,date,amount,refunded_to,approved_by,reason',
            ...c.many(c.int(6, 10), () => ['ORD-' + c.num(5), c.date(2026, 2026), c.money(1, 2), c.pick(['original card', 'a different card', 'a card ending ' + c.num(4), 'cash in store']), c.pick([c.first(), 'system', 'a supervisor']), c.pick(['damaged', 'not received', 'duplicate order', 'goodwill', 'no reason recorded'])].join(',')), '',
            '# ' + c.int(3, 20) + ' refunds went to cards that were never used to pay for the order', '# all approved by the same member of staff, all within ' + c.int(2, 10) + ' days of the order', c.mark()].join('\n'),
          tag: 'refund fraud', juice: 3
        };
      }
    },
    {
      id: 'xclient', label: 'A client complaint that was closed quietly', icon: '📞', juice: 2,
      make(c, o) {
        return {
          name: 'complaint_' + c.pick(['client', 'customer', 'escalation']) + '_' + c.num(3) + '.txt',
          text: ['CLIENT COMPLAINT — ' + c.pick(['received by phone', 'by email at 23:41', 'in person']) + ', ' + c.date(2026, 2026), 'Raised by: ' + c.person() + ', ' + c.pick(['a long-standing client', 'a new account', 'a supplier']), '',
            'Issue: ' + c.pick(['a deadline missed with no warning', 'a report containing another client name', 'a delivery that was never dispatched', 'being billed for work not done', 'a member of staff shouting in a meeting']), '.',
            'Resolution offered: ' + c.pick(['a discount', 'an apology', 'nothing', 'a credit note and a request not to escalate']), '.', '',
            'Closed by: ' + c.pick(['the account manager', 'a director', 'someone in ' + c.pick(o.units)]) + ' on ' + c.date(2026, 2026) + '.', 'Not logged in the complaint register. The register shows zero complaints for the quarter.', c.mark()].join('\n'),
          tag: 'suppressed complaint', juice: 2
        };
      }
    },
    {
      id: 'xleak', label: 'A press enquiry with the answer attached', icon: '🗞', juice: 3,
      make(c, o) {
        return {
          name: 'press_' + c.num(3) + '.txt',
          text: ['MEDIA ENQUIRY — embargoed, do not reply without approval', 'From: ' + c.first().toLowerCase() + '@' + c.pick(['ledgernews.example', 'harbourwire.example']) + ' · ' + c.date(2026, 2026), '',
            '"We are looking at ' + c.pick(['payments made by ' + o.org + ' to ' + c.pick(['a supplier with no website', 'a company registered at a residential address', 'a firm that dissolved in ' + c.year()]), 'the ' + c.pick(['dismissal', 'resignation', 'transfer']) + ' of ' + c.person(), 'the incident on ' + c.date(2026, 2026) + ' that was not reported']) + '. We have documents. Do you have a comment?"', '',
            'Draft reply: ' + c.pick(['"We are unable to comment on individual matters."', '"The matter was dealt with at the time."', '"We have full confidence in our processes."', '"Please direct this to our lawyers."']), '',
            'Internal note: the journalist has the same documents as this folder. Somebody sent them.', c.redact()].join('\n'),
          tag: 'press leak', juice: 3
        };
      }
    },
    {
      id: 'xpayroll', label: 'A payroll error in one direction only', icon: '📈', juice: 3,
      make(c, o) {
        return {
          name: 'payroll_' + c.pick(['check', 'correction', 'run']) + '_' + c.num(3) + '.txt',
          text: ['PAYROLL VARIANCES — ' + c.pick(['June', 'September', 'December']) + ' ' + c.year(), '',
            ...c.many(c.int(5, 8), () => '  ' + c.person() + '  expected ' + c.money(2, 8) + '  paid ' + c.money(2, 12) + '  ' + c.pick(['overpaid, recovered', 'overpaid, not recovered', 'underpaid, corrected', 'no action', 'adjustment not explained'])), '',
            'Overpayments in the employee favour: ' + c.int(2, 9) + '. Overpayments recovered: ' + c.int(0, 1) + '.', 'The variance report was sent to one person, who is one of the overpaid.', '', 'Note: this is the third quarter with the same pattern.', c.mark()].join('\n'),
          tag: 'payroll anomaly', juice: 3
        };
      }
    },
    {
      id: 'xvisa', label: 'Paperwork that does not line up', icon: '🛂', juice: 3,
      make(c, o) {
        return {
          name: 'sponsorship_' + c.num(3) + '.txt',
          text: ['SPONSORSHIP FILE — ' + o.org + ' · internal copy', 'Worker: ' + c.person() + ' · role: ' + c.pick(o.roles), '',
            'Contract dated ' + c.date(2024, 2026) + ', starting ' + c.date(2025, 2026) + '.', 'Hours recorded: ' + c.int(10, 60) + ' per week. Hours on the contract: ' + c.int(30, 45) + ' per week.',
            'Duties in the advert: ' + c.pick(['supervisory', 'specialist', 'administrative', 'operational']) + '. Duties actually performed: ' + c.pick(['warehouse shifts', 'driving', 'cleaning', 'the same as the team']), '.', '',
            'Two other files use the same job description with different titles.', '', 'Note from ' + c.pick(['the adviser', 'HR', 'a colleague']) + ': "this will not survive an inspection, we should stop." Nothing changed.', c.redact()].join('\n'),
          tag: 'immigration irregularity', juice: 3
        };
      }
    },
    {
      id: 'xstorage', label: 'A storage unit in the company name', icon: '📦', juice: 2,
      make(c, o) {
        return {
          name: 'unit_' + c.num(4) + '.txt',
          text: ['STORAGE AGREEMENT — copy, found in the finance folder', 'Unit ' + c.pick(['B' + c.int(10, 99), 'C' + c.int(1, 40), '14b']) + ', ' + c.pick(['Quay Self Store', 'Northgate Lockups', 'Riverside Containers']), 'Rented from ' + c.date(2023, 2026) + ' · paid monthly by ' + c.pick(['company card', 'petty cash', 'a personal card, reimbursed', 'standing order, reference blank']), '',
            'Declared contents: ' + c.pick(['"office furniture"', '"archive"', '"stock"', '"personal effects"']), '.', 'Access listed for: ' + c.int(1, 4) + ' people, none of whom work here now.', '',
            'The key is in ' + c.pick(['the key cabinet', 'a desk drawer', 'the safe', 'nobody knows']), '.', 'Finance has asked twice what it is for. Both replies were verbal.', c.mark()].join('\n'),
          tag: 'hidden storage', juice: 3
        };
      }
    },
    {
      id: 'xtherapist', label: 'Notes from a session, in a work folder', icon: '🛋', juice: 2,
      make(c, o) {
        return {
          name: 'session_' + c.num(3) + '.txt',
          text: ['COUNSELLING NOTES — ' + c.pick(['employee assistance programme', 'occupational health', 'a private practice']), 'Client: initials ' + c.initials() + ' · sessions: ' + c.int(3, 20) + ' · started ' + c.date(2025, 2026), '',
            'Presenting: ' + c.pick(['work-related anxiety', 'difficulty sleeping after a shift pattern', 'a matter the client asked not to record', 'conflict with a named colleague']), '.',
            'Progress: ' + c.pick(['improving', 'unchanged', 'worse since the review', 'client considering leaving the role']), '.', '',
            'Recommended adjustment: ' + c.pick(['reduced hours for ' + c.int(4, 12) + ' weeks', 'a change of supervisor', 'no night shifts', 'none, client declined']), '.', 'Sent to: ' + c.pick(['HR, in full', 'the line manager', 'a shared folder']), '. The client consented to a summary only.', c.mark()].join('\n'),
          tag: 'therapy notes', juice: 2
        };
      }
    },
    {
      id: 'xestate', label: 'A will saved beside the invoices', icon: '📜', juice: 2,
      make(c, o) {
        return {
          name: 'will_' + c.pick(['draft', 'signed', 'scan']) + '.pdf.txt',
          text: ['LAST WILL — draft ' + c.int(1, 4) + ', not executed', 'Testator: ' + c.person() + ', ' + c.pick(o.roles), 'Prepared ' + c.date(2026, 2026), '',
            'Beneficiaries: ' + c.pick(['a spouse and two children', 'a sibling, excluding another', 'a partner of ' + c.int(1, 9) + ' years who is not on any HR record', 'a charity and one individual']), '.',
            'Specific bequest: ' + c.pick(['the house in ' + c.city(), 'the contents of the storage unit', 'a pension', 'shares in a company']), '.', '',
            'Note to the solicitor: "do not tell ' + c.first() + ' until I have spoken to them."', 'Saved in the same folder as the supplier invoices. Nobody has noticed.', c.mark()].join('\n'),
          tag: 'personal legal', juice: 2
        };
      }
    },
    {
      id: 'xsecret', label: 'A secret that is only initials', icon: '🫥', juice: 2,
      make(c, o) {
        return {
          name: 'readme_' + c.num(2) + '.txt',
          text: ['PLEASE READ — then delete this file', '', 'If you are reading this, the folder was shared by mistake.', 'The thing with ' + c.initials() + ' on ' + c.date(2026, 2026) + ' is handled. Do not mention it in the meeting.',
            'The file in ' + c.pick(o.dirs) + '/ is the only copy. If it goes missing, it never happened.', '', 'Delete this after reading. ' + c.pick(['(It was not deleted.)', '(Two people have read it.)', '(It was forwarded to ' + c.first() + '.)']), c.mark()].join('\n'),
          tag: 'vague cover-up', juice: 3
        };
      }
    }
  ];
  for (const extra of JUICE2) SECRETS.push(extra);

  /* ---------- ordinary paperwork that makes the disk feel lived in ---------- */
  function officeDocs(c, o) {
    const out = [];
    out.push({
      name: 'README.txt',
      text: [o.org + ' — ' + o.pick(o.units) + ' workstation backup',
        'Owner: ' + c.person() + ', ' + c.pick(o.roles),
        'Last sync: ' + c.date() + ' ' + c.time(),
        '',
        'This folder is a working copy. The authoritative records live on the shared drive under ' + c.pick(o.dirs) + '/.',
        'Anything marked ' + c.pick(['RESTRICTED', 'CONFIDENTIAL', 'INTERNAL']) + ' must not leave this machine.'].join('\n')
    });
    out.push({
      name: 'roster.csv',
      text: ['name,role,unit,extension,start_date', ...c.many(c.int(5, 9), () => [c.person(), c.pick(o.roles), c.pick(o.units), c.num(4), c.date(2018, 2025)].join(','))].join('\n')
    });
    out.push({
      name: 'calendar.txt',
      text: c.many(c.int(5, 9), () => c.date(2026, 2027) + ' ' + c.time().slice(0, 5) + '  ' + c.pick(['Weekly ops sync', 'Call with ' + c.last(), 'Budget review', 'Site visit — ' + c.pick(o.units), 'Legal hold meeting', 'Press check-in', '1:1 with ' + c.first(), 'Inventory count', 'Briefing: ' + c.pick(['the annex', 'the second site', 'the ' + c.pick(['northern', 'southern']) + ' corridor'])])).join('\n')
    });
    out.push({
      name: 'notes.txt',
      text: ['- ' + c.pick(['chase ' + c.person() + ' for the signed copy', 'move the ' + c.pick(['ledger', 'archive', 'USB']) + ' off site', 'ask about the two missing pages', 'do NOT reply to the ' + c.pick(['regulator', 'journalist']) + ' directly', 'delete local copies after ' + c.date(2026, 2027)]),
        '- ' + c.pick(['the ' + c.pick(['second', 'third']) + ' container was never weighed', 'reconcile ' + c.pick(['June', 'October']) + ' before the audit', 'find out who has the spare key']),
        '- ' + c.pick(['call ' + c.person() + ' back', 'print two copies, file one'])].join('\n')
    });
    if (c.chance(0.5)) out.push({ name: '.env', text: 'API_KEY=sk-test-' + c.hex(24) + '\nDB_HOST=' + c.ip() + '\nSMTP_PASSWORD=' + c.hex(16) + '\n' });
    return out;
  }

  /* ---------- the disk: a whole case, laid out for the chosen shell ---------- */
  function disk(opts) {
    const o = Object.assign({}, DEFAULT_OPTS, opts || {});
    const seed = (Number(o.seed) >>> 0) || ((Math.random() * 4294967295) >>> 0);
    const theme = THEMES.find(t => t.id === o.theme) || THEMES[Math.floor(rng(seed)() * THEMES.length)];
    const c = ctx(seed ^ 0x51ed270b);
    const live = Object.assign({}, theme, {
      org: o.org || c.pick(theme.orgs),
      short: '',
      pick: c.pick
    });
    live.short = live.org.replace(/\b(of|the|and|for|a)\b/gi, '').split(/\s+/).filter(Boolean).map(w => w[0]).join('').slice(0, 4).toUpperCase();
    const win = o.shell === 'powershell' || o.shell === 'cmd';

    const wanted = Array.isArray(o.categories) && o.categories.length ? SECRETS.filter(s => o.categories.includes(s.id)) : SECRETS.slice();
    const pool = wanted.length ? wanted : SECRETS.slice();
    const count = Math.max(0, Math.min(14, o.secrets == null ? 4 : o.secrets));
    // a different mix every case: shuffle the whole catalogue and take as many as asked for, never the same kind twice
    const order = pool.map(kind => [c.r(), kind]).sort((a, b) => a[0] - b[0]).map(x => x[1]);
    const uniq = order.slice(0, count);

    const docs = [];
    for (const kind of uniq) {
      try { docs.push(Object.assign({ kind: kind.id, label: kind.label }, kind.make(c, live))); } catch (e) { }
    }
    const files = {};
    const root = win ? 'Documents/' : '';
    const intelDir = root + (win ? 'Restricted\\' : 'intel/');
    for (const doc of docs) files[intelDir.replace(/\\/g, '/') + doc.name] = doc.text + '\n';
    for (const f of officeDocs(c, live)) files[root + f.name] = f.text + '\n';

    // the ordinary project material, so the secrets are buried in real work
    const proj = c.pick(['atlas', 'kestrel', 'meridian', 'harbor', 'quarry', 'tinderbox', 'lantern', 'cobalt']);
    const svc = c.pick(['ingest', 'billing', 'dispatch', 'intake', 'scheduling', 'records']);
    const logLines = c.many(c.int(10, 18), (_, i) => c.date(2026, 2026) + 'T' + c.time() + 'Z ' + c.pick(['INFO ', 'INFO ', 'WARN ', 'ERROR']) + ' ' + c.pick(['GET /health 200', 'POST /v1/' + svc + ' 201', 'auth failed user=' + c.first().toLowerCase(), 'timeout upstream /v1/' + svc, 'retry ' + c.int(1, 3) + '/3', 'cache miss ' + svc + ':' + c.int(100, 999)]));
    files[root + 'projects/' + proj + '/README.md'] = '# ' + proj + '\n\n' + svc + ' service for ' + live.org + '. Owner: ' + c.person() + ', ' + c.pick(live.roles) + '.\n\nRun `./run.sh` for local work. Never commit the `.env`.\n';
    files[root + 'projects/' + proj + '/logs/' + svc + '.log'] = logLines.sort().join('\n') + '\n';
    files[root + 'projects/' + proj + '/config.json'] = JSON.stringify({ service: svc, host: c.ip(), port: c.pick([8080, 8443, 3000, 9090]), replicas: c.int(1, 5), owner: c.person(), debug: c.chance(0.3) }, null, 2) + '\n';
    if (o.noise !== 'none') {
      const extras = Math.max(0, Math.min(12, o.extra == null ? 4 : o.extra));
      for (let i = 0; i < extras; i++) {
        const name = c.pick(['memo', 'report', 'draft', 'checklist', 'schedule', 'form']) + '_' + c.num(3) + '.txt';
        files[root + c.pick(['misc', 'drafts', 'archive']) + '/' + name] = [c.mark(), c.pick(['Status update', 'Meeting note', 'Draft response', 'Inspection prep']) + ' — ' + c.date(), '', c.pick(['Nothing outstanding.', 'Two items still open; see ' + c.person() + '.', 'Awaiting legal review.', 'Filed, no action needed.'])].join('\n') + '\n';
      }
    }
    if (o.mcode) files[root + '.inbox/mcode.txt'] = 'mcode: ' + c.hex(8) + '\nHand this to the desk to prove you were here.\n';

    const tree = {};
    for (const [path, text] of Object.entries(files)) {
      const parts = path.replace(/\/$/, '').split('/');
      let at = tree;
      for (const part of parts.slice(0, -1)) { if (!at[part] || typeof at[part] === 'string') at[part] = {}; at = at[part]; }
      at[parts.at(-1)] = text;
    }
    // an empty folder or two, because real disks have them
    if (c.chance(0.6)) { const d = root + 'incoming'; tree[d.split('/')[0]] = tree[d.split('/')[0]] || {}; if (!tree[d.split('/')[0]].incoming) tree[d.split('/')[0]].incoming = {}; }

    return {
      name: live.org + ' · ' + live.label, seed, files, tree, theme: theme.id,
      lore: {
        org: live.org, theme: live.label, icon: theme.icon, unit: c.pick(live.units),
        caseId: c.caseNo(),
        secrets: docs.map(d => ({ path: intelDir.replace(/\\/g, '/') + d.name, label: d.label, tag: d.tag, juice: d.juice }))
      }
    };
  }

  /* ---------- a one-line briefing for puzzle rooms ---------- */
  function briefing(seed, kind) {
    const c = ctx((seed >>> 0) ^ 0x2f6e1b3d);
    const theme = THEMES[Math.floor(c.r() * THEMES.length)];
    const org = c.pick(theme.orgs);
    const theOrg = /^(the|a|an) /i.test(org) ? org : 'the ' + org;
    const secret = SECRETS[Math.floor(c.r() * SECRETS.length)];
    return {
      org, theme: theme.label, icon: theme.icon,
      caseId: c.caseNo(),
      line: c.pick([
        'A backup of ' + theOrg + ' was seized at ' + c.pick(CITIES)[0] + '; the key sits in ' + c.pick(['a shift log', 'a manifest', 'a sealed memo', 'the intake register']) + '.',
        'Recovered drive from ' + theOrg + '. Somewhere in it: a ' + secret.label.toLowerCase() + ' and the passphrase that opens the vault.',
        'Case ' + c.caseNo() + ' — ' + org + '. The handler left one usable trail before going quiet.',
        'Whistleblower at ' + org + ' mailed a copy of a ' + secret.label.toLowerCase() + '. Find the string they hid in it.'
      ]),
      secret: secret.label, secretIcon: secret.icon
    };
  }

  /* ---------- what the UI offers ---------- */
  const DEFAULT_OPTS = {
    theme: '', org: '', shell: 'bash', seed: 0,
    secrets: 4, categories: [], extra: 4, noise: 'some', mcode: false
  };
  const OPTIONS = {
    themes: THEMES.map(t => ({ id: t.id, label: t.label, icon: t.icon })),
    secrets: SECRETS.map(s => ({ id: s.id, label: s.label, icon: s.icon, juice: s.juice })),
    noise: [{ id: 'none', label: 'Clean — only the case' }, { id: 'some', label: 'Some decoys' }, { id: 'lots', label: 'Lots of clutter' }],
    defaults: DEFAULT_OPTS
  };
  function normalize(opts) {
    const o = Object.assign({}, DEFAULT_OPTS, opts || {});
    o.secrets = Math.max(0, Math.min(14, Number(o.secrets) || 0));
    o.extra = Math.max(0, Math.min(12, Number(o.extra) || 0));
    if (!Array.isArray(o.categories)) o.categories = [];
    return o;
  }

  LORE.THEMES = THEMES;
  LORE.SECRETS = SECRETS;
  LORE.OPTIONS = OPTIONS;
  LORE.DEFAULT_OPTS = DEFAULT_OPTS;
  LORE.normalize = normalize;
  LORE.rng = rng;
  LORE.disk = disk;
  LORE.briefing = briefing;
  LORE.serialize = files => Object.entries(files).map(([p, t]) => '=== ' + p + '\n' + String(t).replace(/\n$/, '')).join('\n\n') + '\n';
})();

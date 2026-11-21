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

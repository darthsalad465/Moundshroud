// Cyber > 🧰 Toolkit → a game for every network tool. Each game is generated fresh on every round (no fixed list,
// nothing runs out) and mirrors what the real tool shows: DNS records, WHOIS dates, scan results, certificates,
// headers, traceroutes, ARP tables, Wi-Fi scans, netstat output and packet rows. Everything is invented locally.
(() => {
  const esc = s => String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const pick = list => list[(Math.random() * list.length) | 0];
  const n = (a, b) => a + ((Math.random() * (b - a + 1)) | 0);
  const hex = k => Array.from({ length: k }, () => '0123456789abcdef'[(Math.random() * 16) | 0]).join('');
  const shuffle = list => {
    const out = list.slice();
    for (let i = out.length - 1; i > 0; i--) { const j = (Math.random() * (i + 1)) | 0; [out[i], out[j]] = [out[j], out[i]]; }
    return out;
  };
  const ip = () => [n(1, 223), n(0, 255), n(0, 255), n(1, 254)].join('.');
  const days = k => { const d = new Date(Date.now() + k * 86400000); return d.toISOString().slice(0, 10); };
  const WORDS = ['aurora', 'beacon', 'cobalt', 'delta', 'ember', 'falcon', 'garnet', 'harbor', 'indigo', 'juniper', 'kestrel', 'lumen', 'marble', 'nectar', 'opal', 'pixel', 'quartz', 'raven', 'sable', 'tundra', 'umber', 'violet', 'willow', 'xenon', 'yonder', 'zephyr'];
  const CORP = ['northwind', 'brightlake', 'caskade', 'pinetree', 'riverstone', 'sunforge', 'tidewater', 'welkin', 'ironpeak', 'glasswing'];
  const HOSTS = ['web-01', 'web-02', 'mail-01', 'mail-02', 'vpn-gw', 'db-primary', 'db-replica', 'backup-01', 'ci-runner', 'jump-box', 'print-hub', 'nas-01'];
  const VENDORS = [['00:1a:2b', 'Apple'], ['3c:5a:b4', 'Samsung'], ['b8:27:eb', 'Raspberry Pi'], ['00:50:56', 'VMware'], ['f4:ce:46', 'HP'], ['a4:cf:12', 'Espressif (smart device)'], ['dc:a6:32', 'Raspberry Pi'], ['00:0c:29', 'VMware']];
  const mac = vendor => vendor[0] + ':' + hex(2) + ':' + hex(2) + ':' + hex(2);
  const table = (head, rows) => '<table class="ct-tbl"><tr>' + head.map(h => '<th>' + esc(h) + '</th>').join('') + '</tr>' +
    rows.map(r => '<tr>' + r.map(c => '<td>' + c + '</td>').join('') + '</tr>').join('') + '</table>';
  const mono = t => '<span class="ct-mono">' + esc(t) + '</span>';

  /* Each game returns { brief, data, question, options, answer, why } for one freshly made round. */
  const GAMES = {
    dns: {
      icon: '🌐', name: 'DNS detective',
      make() {
        const domain = pick(CORP) + '.example';
        const ipOf = ip();
        const mailHost = 'mail.' + domain;
        const txt = 'v=spf1 include:' + pick(['mailgun', 'sendgrid', 'outlook']) + '.net -all';
        const rows = shuffle([
          { type: 'A', value: ipOf, note: 'The web server' },
          { type: 'MX', value: '10 ' + mailHost, note: 'Mail goes here' },
          { type: 'NS', value: 'ns1.' + domain, note: 'Name server' },
          { type: 'TXT', value: txt, note: 'SPF policy' },
          { type: 'AAAA', value: '2001:db8::' + hex(4), note: 'IPv6 web server' }
        ]);
        const ask = pick(['mail', 'web', 'ns']);
        const answerRow = rows.find(r => r.type === (ask === 'mail' ? 'MX' : ask === 'web' ? 'A' : 'NS'));
        const question = ask === 'mail' ? 'Where does ' + domain + '’s email go?' : ask === 'web' ? 'Which record is the web server’s IPv4 address?' : 'Which server answers lookups for ' + domain + '?';
        const correct = answerRow.type + ' · ' + answerRow.value;
        const options = [correct, ...rows.filter(r => r !== answerRow).slice(0, 3).map(r => r.type + ' · ' + r.value)];
        return {
          brief: 'A zone dump for ' + domain + '. Every record has one job.',
          data: table(['Type', 'Value', 'What it is'], rows.map(r => ['<span class="ct-tag">' + r.type + '</span>', mono(r.value), '<span class="small mute">' + esc(r.note) + '</span>'])),
          question, options, correct, why: 'Use the record type, not the name: A/AAAA are addresses, MX is mail, NS is name servers, TXT is policy text. That is exactly how you read a zone during recon.'
        };
      }
    },
    ipinfo: {
      icon: '📍', name: 'Who owns this address',
      make() {
        const owners = [
          { org: 'Cloudflare', asn: 'AS13335', block: '104.' + n(16, 31) },
          { org: 'Google Cloud', asn: 'AS396982', block: '34.' + n(64, 127) },
          { org: 'Amazon AWS', asn: 'AS16509', block: '52.' + n(0, 95) },
          { org: 'DigitalOcean', asn: 'AS14061', block: '159.65' },
          { org: 'Comcast (home ISP)', asn: 'AS7922', block: '73.' + n(0, 255) },
          { org: 'Deutsche Telekom', asn: 'AS3320', block: '91.' + n(0, 255) }
        ];
        const rows = shuffle(owners).slice(0, 5);
        const target = pick(rows);
        const address = target.block + '.' + n(0, 255) + '.' + n(1, 254);
        const correct = target.org + ' (' + target.asn + ')';
        return {
          brief: 'A lookup table, the shape an address database gives you.',
          data: table(['Prefix', 'ASN', 'Owner'], rows.map(o => [mono(o.block + '.0.0/16'), esc(o.asn), esc(o.org)])),
          question: 'Who owns ' + address + '?',
          options: [correct, ...rows.filter(o => o !== target).slice(0, 3).map(o => o.org + ' (' + o.asn + ')')],
          correct,
          why: 'The longest matching prefix wins: ' + target.block + '.0.0/16 covers ' + address + '. Testers use this to tell a target’s own address space from a cloud host — a big difference when scoping work.'
        };
      }
    },
    reverse: {
      icon: '🔄', name: 'Read the reverse lookup',
      make() {
        const domain = pick(CORP) + '.example';
        const kind = pick([
          { host: 'mail-01.' + domain, service: 'Mail server' },
          { host: 'vpn-gw.' + domain, service: 'VPN gateway' },
          { host: 'db-primary.' + domain, service: 'Database server' },
          { host: 'backup-01.' + domain, service: 'Backup storage' },
          { host: 'ci-runner.' + domain, service: 'Build/CI runner' }
        ]);
        const blank = Math.random() < 0.3;
        const answer = ip();
        const shown = blank ? answer : answer + ' → ' + kind.host;
        const correct = blank ? 'No name is set — treat it as unknown' : kind.service;
        const others = ['Mail server', 'VPN gateway', 'Database server', 'Backup storage', 'Build/CI runner'].filter(s => s !== kind.service).slice(0, 3);
        return {
          brief: 'A reverse DNS lookup asks an address for its name.',
          data: '<pre class="ct-pre">$ dig -x ' + esc(answer) + '\n' + esc(shown) + (blank ? '\n;; no PTR record' : '') + '</pre>',
          question: blank ? 'What does an empty PTR record tell you?' : 'Which service is ' + kind.host + ' most likely running?',
          options: blank ? [correct, ...others] : [correct, ...others],
          correct,
          why: blank ? 'Plenty of legitimately-run hosts have no PTR, but mail servers without one get rejected, and generic cloud names tell you the host is rented. A blank answer is information, not a dead end.' : 'Hostnames are chosen by admins and leak purpose. Reading them is free recon — a name like ' + kind.host + ' says what the machine is for before you touch a single port.'
        };
      }
    },
    whois: {
      icon: '📄', name: 'WHOIS dates and red flags',
      make() {
        const domain = pick(CORP) + '.example';
        const registrars = ['Namecheap', 'GoDaddy', 'Cloudflare Registrar', 'Gandi', 'Porkbun'];
        const created = n(0, 9000);
        const expiresIn = pick([-12, 3, 9, 40, 400, 1200]);
        const registrar = pick(registrars);
        const privacy = Math.random() < 0.6;
        const correct = expiresIn < 30 ? 'The domain expires in ' + expiresIn + ' days — renewal risk' : 'Nothing alarming in these dates';
        return {
          brief: 'The public registration record of a domain.',
          data: '<div class="ct-grid2">' +
            '<div class="ct-kv"><span class="ct-k">Registrar</span><span class="ct-v">' + esc(registrar) + '</span></div>' +
            '<div class="ct-kv"><span class="ct-k">Registered</span><span class="ct-v">' + esc(days(-created)) + '</span></div>' +
            '<div class="ct-kv"><span class="ct-k">Expires</span><span class="ct-v">' + esc(days(expiresIn)) + '</span></div>' +
            '<div class="ct-kv"><span class="ct-k">Registrant</span><span class="ct-v">' + (privacy ? 'REDACTED FOR PRIVACY' : 'Operations Team, ' + esc(domain)) + '</span></div>' +
            '</div>',
          question: 'What is worth flagging here?',
          options: [correct, 'The registrar is unusual, which means the domain is stolen', 'The registration date proves the business is fake', 'Privacy protection is illegal for companies'],
          correct,
          why: 'WHOIS is public, so owners hide contact details — that is normal, not suspicious. The dates are the useful part: a domain about to expire is a takeover risk, and a very new one on a brand name is a classic phishing signal.'
        };
      }
    },
    subdomains: {
      icon: '🔎', name: 'Find the forgotten door',
      make() {
        const domain = pick(CORP) + '.example';
        const risky = pick(['staging', 'dev', 'old-portal', 'test-api', 'demo']);
        const names = shuffle(['www.' + domain, 'mail.' + domain, 'vpn.' + domain, 'status.' + domain, risky + '.' + domain]);
        const correct = risky + '.' + domain;
        return {
          brief: 'Names found in public certificate logs for ' + domain + '.',
          data: names.map(x => '<div class="ct-mono">' + esc(x) + '</div>').join(''),
          question: 'Which name would a tester open first, and why?',
          options: [correct, 'www.' + domain, 'status.' + domain, 'mail.' + domain],
          correct,
          why: 'Anything with staging, dev, test or old in the name tends to run older code with weaker settings — and it is often forgotten by whoever owns security. That is why certificate logs are a recon favourite: they list names the site never links to.'
        };
      }
    },
    portscan: {
      icon: '🚪', name: 'Port scan triage',
      make() {
        const services = shuffle([
          { port: 443, name: 'HTTPS', risk: 'normal — every web server' },
          { port: 22, name: 'SSH', risk: 'normal if restricted, risky wide open' },
          { port: 3306, name: 'MySQL', risk: 'high — a database reachable from the internet' },
          { port: 3389, name: 'RDP', risk: 'high — remote desktop exposed' },
          { port: 445, name: 'SMB', risk: 'high — file sharing exposed' },
          { port: 21, name: 'FTP', risk: 'high — plaintext logins' }
        ]).slice(0, 5);
        const bad = pick(services.filter(s => s.risk.startsWith('high')));
        const correct = bad.port + ' · ' + bad.name;
        return {
          brief: 'A scan of one host, all of these answered.',
          data: table(['Port', 'Service'], services.map(s => ['<span class="ct-tag ct-open">' + s.port + ' open</span>', esc(s.name)])),
          question: 'Which open port is the real finding?',
          options: [correct, ...services.filter(s => s !== bad).slice(0, 3).map(s => s.port + ' · ' + s.name)],
          correct,
          why: bad.port + ' is ' + bad.risk + '. The web port being open is expected; a database, desktop or file-sharing port open to the world means anyone can reach it, and that is exactly what an attacker looks for.'
        };
      }
    },
    tlscert: {
      icon: '🔐', name: 'Certificate check',
      make() {
        const site = pick(CORP) + '.example';
        const faults = [
          { kind: 'Expired', validTo: days(-n(2, 90)), note: 'the certificate ran out' },
          { kind: 'Wrong name', validTo: days(n(20, 300)), note: 'it covers a different name' },
          { kind: 'Self-signed', validTo: days(n(20, 300)), note: 'issued by itself' },
          { kind: 'Fine', validTo: days(n(60, 300)), note: 'valid and matching' }
        ];
        const fault = pick(faults);
        const covered = fault.kind === 'Wrong name' ? pick(['www.othersite.example', 'api.internal.example', '*.' + pick(CORP) + '.example']) : site;
        const issuer = fault.kind === 'Self-signed' ? site + ' (self-signed)' : pick(['Let\'s Encrypt R3', 'DigiCert TLS RSA SHA256 2020 CA1', 'Sectigo RSA DV']);
        const correct = fault.kind === 'Fine' ? 'No problem — valid and correctly named' : fault.kind;
        return {
          brief: 'What a browser sees when it connects to ' + site + '.',
          data: '<div class="ct-grid2">' +
            '<div class="ct-kv"><span class="ct-k">For</span><span class="ct-v">' + esc(site) + '</span></div>' +
            '<div class="ct-kv"><span class="ct-k">Issued by</span><span class="ct-v">' + esc(issuer) + '</span></div>' +
            '<div class="ct-kv"><span class="ct-k">Covers</span><span class="ct-v">' + esc(covered) + '</span></div>' +
            '<div class="ct-kv"><span class="ct-k">Valid to</span><span class="ct-v">' + esc(fault.validTo) + '</span></div>' +
            '</div>',
          question: 'What is wrong with this certificate?',
          options: shuffle(['Expired', 'Wrong name', 'Self-signed', 'No problem — valid and correctly named']),
          correct,
          why: fault.kind === 'Fine' ? 'Nothing to fix here: the name matches, the issuer is a public CA and the expiry is months away.' : 'This one is ' + fault.note + '. An expired or mismatched certificate trains users to click through warnings, which is exactly what a man-in-the-middle needs.'
        };
      }
    },
    headers: {
      icon: '🛡️', name: 'Header hardening',
      make() {
        const all = [
          { name: 'Strict-Transport-Security', line: 'max-age=63072000; includeSubDomains', why: 'forces HTTPS' },
          { name: 'Content-Security-Policy', line: "default-src 'self'", why: 'limits where scripts load from' },
          { name: 'X-Frame-Options', line: 'DENY', why: 'blocks clickjacking frames' },
          { name: 'X-Content-Type-Options', line: 'nosniff', why: 'stops MIME confusion' },
          { name: 'Referrer-Policy', line: 'no-referrer', why: 'stops URL leaks' },
          { name: 'Permissions-Policy', line: 'geolocation=()', why: 'turns off browser features' }
        ];
        const present = shuffle(all).slice(0, n(2, 4));
        const missing = pick(all.filter(h => !present.includes(h)));
        return {
          brief: 'The response headers this site sends with every page.',
          data: present.map(h => '<div class="ct-have">✓ <b>' + esc(h.name) + '</b><div class="small mute ct-mono">' + esc(h.name + ': ' + h.line) + '</div></div>').join(''),
          question: 'Which safety header is missing?',
          options: [missing.name, ...all.filter(h => h !== missing).slice(0, 3).map(h => h.name)],
          correct: missing.name,
          why: missing.name + ' ' + missing.why + '. Missing headers are the most common finding on real sites, and they are safe to check because every visitor already receives them.'
        };
      }
    },
    fingerprint: {
      icon: '🧩', name: 'Name the stack',
      make() {
        const stacks = [
          { server: 'nginx/1.24.0', page: 'wp-content/themes/twentytwenty', name: 'nginx + WordPress (PHP)' },
          { server: 'Apache/2.4.57 (Debian)', page: 'app/assets/application-3f2c.js', name: 'Apache + Rails-style asset pipeline' },
          { server: 'cloudflare', page: '__NEXT_DATA__ = {\"page\":\"/\"}', name: 'Cloudflare + Next.js (Node)' },
          { server: 'Microsoft-IIS/10.0', page: 'aspnet_client/system_web', name: 'IIS + ASP.NET' },
          { server: 'nginx', page: '/static/js/main.4f1a2b.js', name: 'nginx + React (Create React App)' }
        ];
        const stack = pick(stacks);
        return {
          brief: 'What the server and the page source gave away.',
          data: '<pre class="ct-pre">HTTP/1.1 200 OK\nServer: ' + esc(stack.server) + '\nX-Powered-By: ' + esc(pick(['PHP/8.2', 'Express', 'ASP.NET', 'none'])) + '\n\n&lt;html&gt; … ' + esc(stack.page) + ' …</pre>',
          question: 'What is this site built with?',
          options: [stack.name, ...shuffle(stacks.filter(s => s !== stack)).slice(0, 3).map(s => s.name)],
          correct: stack.name,
          why: 'Server headers plus a path from the page source are enough to guess the stack. Knowing the exact parts means you can look up their known weaknesses — and as a defender, that is why you trim these headers.'
        };
      }
    },
    traceroute: {
      icon: '🛰️', name: 'Read the route',
      make() {
        const hops = [];
        let depth = 3;
        for (let i = 1; i <= n(6, 9); i++) {
          const spike = i === depth + 2;
          hops.push({ hop: i, ip: i <= 2 ? '192.168.' + n(0, 4) + '.' + n(1, 254) : (Math.random() < 0.2 ? '*' : ip()), ms: spike ? n(180, 420) : n(2, 28) });
          if (i === 2) hops[1].ip = '192.168.' + n(0, 4) + '.1';
        }
        const spikeHop = hops.find(h => h.ms > 150) || hops.at(-1);
        const correct = 'Hop ' + spikeHop.hop + ' · ' + spikeHop.ms + ' ms';
        return {
          brief: 'Each line is one router between this PC and the target.',
          data: table(['#', 'Router', 'Time'], hops.map(h => [String(h.hop), mono(h.ip), '<span class="' + (h.ms > 150 ? 'ct-bad' : 'small mute') + '">' + h.ms + ' ms</span>'])),
          question: 'Where does the path slow down?',
          options: [correct, ...hops.filter(h => h !== spikeHop).slice(0, 3).map(h => 'Hop ' + h.hop + ' · ' + h.ms + ' ms')],
          correct,
          why: 'One hop jumping to hundreds of milliseconds while its neighbours stay fast points at congestion or a device under load on that link — not at the target itself. Hops 1–2 are your own network: the jump to a public address is where you leave home.'
        };
      }
    },
    mynetwork: {
      icon: '🖧', name: 'Unknown device',
      make() {
        const devices = [];
        const byName = VENDORS.filter((v, i, a) => a.findIndex(w => w[1] === v[1]) === i);
        const known = shuffle(byName).slice(0, 4);
        for (const v of known) devices.push({ ip: '192.168.1.' + n(10, 60), vendor: v, label: pick(['Router', 'Phone', 'Laptop', 'Printer', 'TV', 'Smart plug']) });
        const odd = pick(byName.filter(v => !known.includes(v)));
        devices.push({ ip: '192.168.1.' + n(61, 250), vendor: odd, label: pick(['Unknown', 'Unknown', 'Unknown', 'Guest']) });
        const target = devices.at(-1);
        shuffle(devices);
        const correct = target.ip + ' · ' + target.vendor[1];
        return {
          brief: 'Addresses your PC has talked to on your own network.',
          data: table(['Address', 'Hardware (MAC)', 'Looks like'], devices.map(d => [mono(d.ip), mono(mac(d.vendor)), esc(d.label)])),
          question: 'Which device is worth investigating?',
          options: [correct, ...devices.filter(d => d !== target).slice(0, 3).map(d => d.ip + ' · ' + d.vendor[1])],
          correct,
          why: 'The MAC prefix names the maker, and every device you know has a label. A ' + target.vendor[1] + ' on your network that nobody recognises is a rogue device until proven otherwise — check it, then block it at the router.'
        };
      }
    },
    wifi: {
      icon: '📶', name: 'Evil twin hunting',
      make() {
        const ssid = pick(['HomeNet', 'CasaWiFi', 'BlueSky', 'Cafe-Guest', 'Flat' + n(1, 90)]);
        const list = [
          { ssid, auth: 'WPA2', bssid: 'a4:2b:' + hex(2) + ':' + hex(2) + ':' + hex(2), signal: n(45, 70), bad: false },
          { ssid: ssid + '-5G', auth: 'WPA3', bssid: 'a4:2b:' + hex(2) + ':' + hex(2) + ':' + hex(2), signal: n(40, 65), bad: false },
          { ssid: 'Neighbour' + n(2, 9), auth: 'WPA2', bssid: 'b8:27:' + hex(2) + ':' + hex(2) + ':' + hex(2), signal: n(20, 40), bad: false },
          { ssid: 'FreeAirportWiFi', auth: 'Open', bssid: 'de:ad:' + hex(2) + ':' + hex(2) + ':' + hex(2), signal: n(50, 80), bad: true },
          { ssid, auth: 'Open', bssid: '02:00:' + hex(2) + ':' + hex(2) + ':' + hex(2), signal: n(55, 85), bad: true }
        ];
        shuffle(list);
        const twin = list.find(x => x.bad && x.ssid === ssid);
        const correct = twin.bssid + ' · ' + twin.ssid + ' (' + twin.auth + ')';
        return {
          brief: 'Every network your Wi-Fi card can hear right now.',
          data: table(['Name', 'Security', 'Signal', 'BSSID'], list.map(w => [esc(w.ssid), '<span class="' + (w.auth === 'Open' ? 'ct-tag ct-open">⚠️ Open' : 'ct-tag">' + esc(w.auth)) + '</span>', esc(w.signal + '%'), mono(w.bssid)])),
          question: 'Which entry is an evil twin of ' + ssid + '?',
          options: [correct, ...list.filter(x => x !== twin).slice(0, 3).map(x => x.bssid + ' · ' + x.ssid + ' (' + x.auth + ')')],
          correct,
          why: 'Same name as your network, different hardware address, and no encryption: that is a hotspot set up to lure your devices. A cloned SSID never needs to touch your router — it just has to be louder.'
        };
      }
    },
    connections: {
      icon: '🔌', name: 'Spot the bad connection',
      make() {
        const benign = [
          { prog: 'chrome.exe', remote: '142.250.' + n(1, 254) + '.105:443', state: 'ESTABLISHED' },
          { prog: 'svchost.exe', remote: '13.107.' + n(1, 254) + '.14:443', state: 'ESTABLISHED' },
          { prog: 'OneDrive.exe', remote: '40.126.' + n(1, 254) + '.9:443', state: 'ESTABLISHED' },
          { prog: 'Discord.exe', remote: '162.159.' + n(1, 254) + '.20:443', state: 'ESTABLISHED' }
        ];
        const bad = pick([
          { prog: 'photo_crack.exe', remote: '45.' + n(1, 254) + '.' + n(1, 254) + '.77:4444', state: 'ESTABLISHED' },
          { prog: 'update32.exe', remote: '185.' + n(1, 254) + '.' + n(1, 254) + '.9:8080', state: 'ESTABLISHED' },
          { prog: 'rundl132.exe', remote: '91.' + n(1, 254) + '.' + n(1, 254) + '.3:1337', state: 'ESTABLISHED' }
        ]);
        const rows = shuffle([...benign.slice(0, 3), bad]);
        const correct = bad.prog + ' → ' + bad.remote;
        return {
          brief: 'Live connections on a PC, from netstat.',
          data: table(['Program', 'Talking to', 'State'], rows.map(c => [esc(c.prog), mono(c.remote), esc(c.state)])),
          question: 'Which connection should you kill and investigate?',
          options: [correct, ...rows.filter(c => c !== bad).slice(0, 3).map(c => c.prog + ' → ' + c.remote)],
          correct,
          why: 'Browsers and sync tools talk to big providers on 443. A program with a misspelled lookalike name phoning home on 4444, 1337 or plain 8080 is the signature of malware or a remote-access tool — kill it, then look at how it got there.'
        };
      }
    },
    capture: {
      icon: '🦈', name: 'Packet clues',
      make() {
        const victim = pick(CORP) + '.example';
        const rows = shuffle([
          { src: '10.0.0.' + n(2, 30), dst: '93.184.' + n(1, 254) + '.34', proto: 'TLS', info: 'Application Data (encrypted)' },
          { src: '10.0.0.' + n(2, 30), dst: '8.8.8.8', proto: 'DNS', info: 'Standard query A www.' + victim },
          { src: '10.0.0.' + n(2, 30), dst: '203.0.113.' + n(1, 254), proto: 'FTP', info: 'Request: USER admin    Request: PASS hunter2' },
          { src: '10.0.0.' + n(2, 30), dst: '142.250.' + n(1, 254) + '.105', proto: 'TCP', info: 'SYN → SYN, ACK → ACK (443)' }
        ]);
        const bad = rows.find(r => r.proto === 'FTP');
        const correct = 'FTP · ' + bad.src + ' → ' + bad.dst;
        return {
          brief: 'A short capture. Read the summary column like a real analyst.',
          data: table(['From', 'To', 'Protocol', 'Summary'], rows.map(p => [mono(p.src), mono(p.dst), '<span class="ct-tag">' + esc(p.proto) + '</span>', '<span class="small">' + esc(p.info) + '</span>'])),
          question: 'Which packet leaks a secret?',
          options: [correct, ...rows.filter(r => r !== bad).slice(0, 3).map(p => p.proto + ' · ' + p.src + ' → ' + p.dst)],
          correct,
          why: 'TLS hides its payload, DNS only shows names, and the TCP handshake carries no data. FTP sends the username and password as plain text — anyone on the path can read them, which is why it was replaced by SFTP and FTPS.'
        };
      }
    }
  };

  const KEY = 'cnet_';
  const state = {};
  const load = id => {
    if (state[id]) return state[id];
    let saved = {};
    try { saved = JSON.parse(ls.get(KEY + id, '{}')) || {}; } catch (e) { saved = {}; }
    return (state[id] = { streak: saved.streak || 0, best: saved.best || 0, rounds: saved.rounds || 0, correct: saved.correct || 0 });
  };
  const save = id => { try { ls.set(KEY + id, JSON.stringify(load(id))); } catch (e) { } };

  function render(host, id, onBack) {
    const game = GAMES[id];
    if (!game) return false;
    const S = load(id);
    let round = null, answered = -1, okay = false;
    const next = () => { round = game.make(); round.options = shuffle(round.options.filter((x, i, a) => a.indexOf(x) === i)).slice(0, 4); if (!round.options.includes(round.correct)) round.options[0] = round.correct; answered = -1; okay = false; draw(); };
    const draw = () => {
      host.innerHTML = '<div class="ct-wrap">' +
        '<div class="row" style="gap:8px;align-items:center;flex-wrap:wrap;margin-bottom:10px">' +
        '<button class="ib" data-act="back">← Toolkit</button>' +
        '<b style="flex:1">' + game.icon + ' ' + esc(game.name) + '</b>' +
        '<span class="small mute">streak <b>' + S.streak + '</b> · best ' + S.best + ' · ' + S.correct + '/' + S.rounds + ' right</span>' +
        '</div>' +
        '<div class="ct-intro"><b>' + esc(round.brief) + '</b><div class="small mute" style="margin-top:4px">Invented data for practice, generated fresh every round — it never runs out.</div></div>' +
        '<div class="ct-res" id="ctgdata" style="margin-bottom:12px">' + round.data + '</div>' +
        '<div id="ctgq">' + question() + '</div>' +
        '</div>';
      host.querySelector('[data-act="back"]').onclick = () => (onBack ? onBack() : A.cyberTools.open(''));
      host.querySelectorAll('[data-opt]').forEach(b => b.onclick = () => {
        if (answered >= 0) return;
        answered = +b.dataset.opt;
        okay = round.options[answered] === round.correct;
        S.rounds++; if (okay) { S.correct++; S.streak++; S.best = Math.max(S.best, S.streak); } else S.streak = 0;
        save(id);
        if (okay) A.cyberBank?.puzzleSolved('cynetgames', { diff: 3 });
        host.querySelector('#ctgq').innerHTML = question();
        host.querySelector('[data-act="next"]')?.focus?.();
      });
      host.querySelector('[data-act="next"]')?.addEventListener('click', next);
    };
    const question = () => {
      const answered_ = answered >= 0;
      return '<div style="border:1px solid var(--line);border-radius:12px;padding:12px 14px;background:var(--panel)">' +
        '<b>' + esc(round.question) + '</b><div style="display:grid;gap:6px;margin-top:10px">' +
        round.options.map((o, i) => {
          const cls = !answered_ ? 'ib' : o === round.correct ? 'pri' : i === answered ? 'ib' : 'ib';
          const mark = answered_ && o === round.correct ? ' ✓' : answered_ && i === answered ? ' ✗' : '';
          return '<button class="' + cls + '" data-opt="' + i + '" style="text-align:left" ' + (answered_ ? 'disabled' : '') + '>' + esc(o) + mark + '</button>';
        }).join('') + '</div>' +
        (answered_ ? '<div style="margin-top:10px;border-left:2px solid ' + (okay ? 'var(--ok)' : 'var(--bad)') + ';padding-left:10px">' +
          '<b style="color:' + (okay ? 'var(--ok)' : 'var(--bad)') + '">' + (okay ? '✅ Right' : '❌ ' + esc(round.correct)) + '</b>' +
          '<div class="small" style="margin-top:4px">' + esc(round.why) + '</div>' +
          '<button class="pri" data-act="next" style="margin-top:10px">Next round →</button></div>' : '') + '</div>';
    };
    next();
    return true;
  }

  A.cyberNetGames = {
    ids: () => Object.keys(GAMES),
    has: id => Object.hasOwn(GAMES, id),
    name: id => GAMES[id] && GAMES[id].name,
    icon: id => GAMES[id] && GAMES[id].icon,
    round: id => GAMES[id] && GAMES[id].make(),
    render
  };
})();

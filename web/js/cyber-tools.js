// Cyber > 🧰 Toolkit: easy security and networking tools, the kind found on Kali Linux, running on this PC (lib/cybertools.js).
// Each tool has one box to fill, a Run button, a plain-words result, and a "How it works" tutorial with a legal note.
// For learning and for testing systems you own or have written permission to test. Nothing here attacks or breaks in:
// every tool only looks, reads or asks. The local AI can run these too (web/js/actions.js).
(() => {
  const esc = s => String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const api = async (path, body) => { try { const r = await (await fetch(path, body === undefined ? {} : { method: 'POST', body: JSON.stringify(body) })).json(); return r; } catch (e) { return { error: 'The tool could not run: ' + e.message }; } };
  const row = (k, v) => '<div class="ct-kv"><span class="ct-k">' + esc(k) + '</span><span class="ct-v">' + v + '</span></div>';
  const tag = (t, cls) => '<span class="ct-tag ' + (cls || '') + '">' + esc(t) + '</span>';

  /* each tool: id, icon, name, short line, the boxes to fill, the endpoint, a function to show the result, and a tutorial */
  const TOOLS = [
    {
      id: 'dns', icon: '🌐', name: 'DNS lookup', line: 'Every address record behind a domain name.',
      inputs: [{ k: 'host', ph: 'example.com', label: 'Domain or host name' }], ep: 'dns',
      show: r => r.records && r.records.length ? '<table class="ct-tbl"><tr><th>Type</th><th>Value</th><th>What it is</th></tr>' + r.records.map(x => '<tr><td>' + tag(x.type) + '</td><td class="ct-mono">' + esc(x.value) + '</td><td class="small mute">' + esc(x.note) + '</td></tr>').join('') + '</table>' : '<div class="mute">' + esc(r.note || 'No records.') + '</div>',
      why: 'The Domain Name System turns a name like example.com into the numbers computers use. Looking up every record is the first thing a tester does: it shows the web servers (A/AAAA), the mail servers (MX), the name servers (NS), and text records (TXT) that often reveal other services a company uses.',
      how: 'Type a domain name and press Run. You read any name; this is like asking a public phone book, and is always legal.', ex: 'google.com'
    },
    {
      id: 'ipinfo', icon: '📍', name: 'IP address info', line: 'The network, owner and rough location of an address.',
      inputs: [{ k: 'host', ph: '8.8.8.8 or example.com', label: 'IP address or host' }], ep: 'ipinfo',
      show: r => '<div class="ct-grid2">' + [['Address', r.ip], ['Owner / ISP', r.org || r.isp], ['Network (ASN)', r.asn], ['Country', r.country], ['Region', r.region], ['City', r.city]].filter(x => x[1]).map(x => row(x[0], esc(x[1]))).join('') + '</div>' + (r.note ? '<div class="small mute" style="margin-top:8px">' + esc(r.note) + '</div>' : ''),
      why: 'Every device on the internet has an IP address. This shows which company owns the block it sits in, the network number (ASN), and the city the block is registered to. Testers use it to tell a target\'s own servers from a cloud host like Amazon or Cloudflare.',
      how: 'Type an IP address or a host name. The lookup uses a public database and sees only the address, not you.', ex: '1.1.1.1'
    },
    {
      id: 'reverse', icon: '🔄', name: 'Reverse DNS', line: 'The host name set for an IP address.',
      inputs: [{ k: 'host', ph: '8.8.8.8', label: 'IP address' }], ep: 'reverse',
      show: r => r.names && r.names.length ? r.names.map(n => '<div class="ct-mono">' + esc(n) + '</div>').join('') : '<div class="mute">' + esc(r.note || 'No name set.') + '</div>',
      why: 'The opposite of a normal lookup: given an address, what name does its owner put on it? Mail servers and well-run networks set this, so a blank answer or a generic cloud name is itself a clue about what you are looking at.',
      how: 'Type an IP address. Reading a public record like this is legal.', ex: '208.67.222.222'
    },
    {
      id: 'whois', icon: '📄', name: 'WHOIS (who owns a domain)', line: 'Who registered a domain, and when it expires.',
      inputs: [{ k: 'host', ph: 'example.com', label: 'Domain name' }], ep: 'whois',
      show: r => r.error && !r.facts ? '<div class="ct-bad">' + esc(r.error) + '</div>' : '<div class="ct-grid2">' + [['Registrar', (r.facts || {}).registrar], ['Registered', (r.facts || {}).created], ['Expires', (r.facts || {}).expires], ['Updated', (r.facts || {}).updated], ['Owner', (r.facts || {}).registrant]].filter(x => x[1]).map(x => row(x[0], esc(x[1]))).join('') + '</div>' + ((r.facts || {}).nameservers && r.facts.nameservers.length ? '<div class="ct-kv"><span class="ct-k">Name servers</span><span class="ct-v ct-mono">' + r.facts.nameservers.map(esc).join('<br>') + '</span></div>' : '') + '<details style="margin-top:8px"><summary class="small">Full WHOIS text</summary><pre class="ct-pre">' + esc(r.raw || '') + '</pre></details>',
      why: 'WHOIS is the public registration record of a domain name. It can show the registrar, the dates it was registered and expires, and sometimes the owner. An expiring domain, or a brand-new one, is a useful signal when sizing up a target or spotting a scam site.',
      how: 'Type a domain name. WHOIS is a public service; many owners now hide personal details behind a privacy service.', ex: 'wikipedia.org'
    },
    {
      id: 'subdomains', icon: '🔎', name: 'Subdomain finder', line: 'Other names under a domain, from public certificate logs.',
      inputs: [{ k: 'host', ph: 'example.com', label: 'Domain name' }], ep: 'subdomains',
      show: r => '<div class="small mute" style="margin-bottom:6px">' + esc(r.count || 0) + ' found' + (r.count > 500 ? ', showing 500' : '') + '. ' + esc(r.note || '') + '</div>' + (r.subdomains || []).map(s => '<div class="ct-mono">' + esc(s) + '</div>').join(''),
      why: 'Big sites have many names: mail.example.com, vpn.example.com, test.example.com. Each is a door. Every secure (HTTPS) certificate is written to a public log, so searching those logs lists subdomains without ever touching the target. Forgotten test or staging sites found this way are a classic weak point.',
      how: 'Type a domain name. This reads a public log (crt.sh); it does not contact the target at all.', ex: 'github.com'
    },
    {
      id: 'portscan', icon: '🚪', name: 'Port scanner', line: 'Which doors (ports) are open on a host.',
      inputs: [{ k: 'host', ph: 'localhost, or a host you own', label: 'Host you own or may test' }, { k: 'ports', ph: 'top, common, or 1-1024', label: 'Ports', val: 'top' }], ep: 'portscan',
      show: r => r.open && r.open.length ? '<table class="ct-tbl"><tr><th>Port</th><th>Usually</th></tr>' + r.open.map(p => '<tr><td>' + tag(p.port + ' open', 'ct-open') + '</td><td>' + esc(p.service) + '</td></tr>').join('') + '</table><div class="small mute" style="margin-top:6px">Scanned ' + r.scanned + ' ports.</div>' : '<div class="mute">' + esc(r.note || 'No open ports found.') + '</div>',
      why: 'A port is a numbered door on a computer; each service (web, email, remote login) listens on its own. An open port means something is running and reachable there. Finding the open ports is how a tester learns what a machine actually does, and how a defender checks that nothing unexpected is exposed. This one connects normally, the same as any program, and does nothing more.',
      how: 'Type a host you OWN or have written permission to test (try localhost, your own PC). Pick "top" for the usual services, "common" for ~40 ports, or a range like 1-1024. Scanning other people\'s machines without permission is illegal in most countries.',
      warn: 1, ex: 'localhost'
    },
    {
      id: 'tlscert', icon: '🔐', name: 'Certificate inspector', line: 'The HTTPS certificate of a site, and when it expires.',
      inputs: [{ k: 'host', ph: 'example.com', label: 'Site' }], ep: 'tlscert',
      show: r => r.error ? '<div class="ct-bad">' + esc(r.error) + '</div>' : '<div class="ct-grid2">' + [['For', r.subject], ['Issued by', r.issuer], ['Valid from', r.validFrom], ['Valid to', r.validTo], ['Days left', (r.expired ? '⚠️ ' : '') + r.daysLeft], ['Protocol', r.protocol], ['Cipher', r.cipher]].filter(x => x[1] != null && x[1] !== '').map(x => row(x[0], esc(String(x[1])))).join('') + '</div>' + (r.altNames && r.altNames.length ? '<div class="ct-kv"><span class="ct-k">Also covers</span><span class="ct-v ct-mono">' + r.altNames.map(esc).join(', ') + '</span></div>' : '') + (r.expired ? '<div class="ct-bad" style="margin-top:8px">This certificate is not currently valid.</div>' : ''),
      why: 'A certificate is the file that proves a site is really who it says, and encrypts your traffic to it. Reading one shows who issued it, which names it covers (often revealing other sites on the same server), the encryption in use, and when it expires. An expired or weak certificate is a real finding; the extra names it lists are free reconnaissance.',
      how: 'Type a site that uses HTTPS. The certificate is sent to every visitor, so reading it is completely normal and legal.', ex: 'badssl.com'
    },
    {
      id: 'headers', icon: '🛡️', name: 'Security header check', line: 'Grades a site on the safety headers it sends.',
      inputs: [{ k: 'url', ph: 'example.com', label: 'Web address' }], ep: 'headers',
      show: r => r.error ? '<div class="ct-bad">' + esc(r.error) + '</div>' : '<div class="ct-grade ct-grade-' + r.grade + '">' + r.grade + '<span class="small">' + r.score + '/100</span></div>' + '<div class="ct-cols">' + '<div><b class="small">Present</b>' + (r.present.length ? r.present.map(p => '<div class="ct-have">✓ ' + esc(p.name) + '<div class="small mute">' + esc(p.why) + '</div></div>').join('') : '<div class="small mute">None.</div>') + '</div>' + '<div><b class="small">Missing</b>' + (r.missing.length ? r.missing.map(p => '<div class="ct-miss">✗ ' + esc(p.name) + '<div class="small mute">' + esc(p.why) + '</div></div>').join('') : '<div class="small mute">None, well done.</div>') + '</div></div>' + (r.leak && r.leak.length ? '<div class="ct-bad" style="margin-top:8px">Reveals its software: ' + r.leak.map(l => esc(l.header) + ' = ' + esc(l.value)).join(', ') + '. ' + esc(r.note) + '</div>' : ''),
      why: 'When a web server answers, it sends hidden headers alongside the page. A handful of them tell the browser how to keep the visitor safe: force HTTPS (HSTS), limit where scripts load from (Content-Security-Policy), block the page from being framed, and more. Missing ones are among the most common real findings on any site, and they are safe to check because every visitor already receives these headers.',
      how: 'Type a web address. This is the same request your browser makes to open the page; it is legal for any site.', ex: 'github.com'
    },
    {
      id: 'fingerprint', icon: '🧩', name: 'What is it built with', line: 'Guesses the software and frameworks a site uses.',
      inputs: [{ k: 'url', ph: 'example.com', label: 'Web address' }], ep: 'fingerprint',
      show: r => r.error ? '<div class="ct-bad">' + esc(r.error) + '</div>' : (r.title ? '<div class="small mute" style="margin-bottom:6px">“' + esc(r.title) + '”</div>' : '') + (r.tech && r.tech.length ? r.tech.map(t => '<div class="ct-have">' + esc(t.name) + '<span class="small mute"> — from the ' + esc(t.where) + '</span></div>').join('') : '<div class="mute">' + esc(r.note || '') + '</div>'),
      why: 'Sites are built from parts: a web server (Apache, nginx), a framework (WordPress, React, Laravel), a host (Cloudflare). They often leave fingerprints in their headers and page code. Knowing what a target runs lets a tester look up known weaknesses for those exact parts, and lets a defender notice when they are advertising more than they should.',
      how: 'Type a web address. This only reads the page the server already sends to everyone.', ex: 'wordpress.org'
    },
    {
      id: 'traceroute', icon: '🛰️', name: 'Trace the route', line: 'Every router between this PC and a host.',
      inputs: [{ k: 'host', ph: 'example.com', label: 'Host or IP' }], ep: 'traceroute',
      show: r => r.error ? '<div class="ct-bad">' + esc(r.error) + '</div>' : (r.hops && r.hops.length ? '<table class="ct-tbl"><tr><th>#</th><th>Router</th><th>Time</th></tr>' + r.hops.map(h => '<tr><td>' + h.hop + '</td><td class="ct-mono">' + esc(h.ip) + '</td><td class="small mute">' + esc(h.times) + '</td></tr>').join('') + '</table>' : '<div class="mute">' + esc(r.note || '') + '</div>'),
      why: 'Data crosses many routers to reach a server. Tracing the route shows each hop and how long it takes, which maps the path and spots where traffic slows or where a target sits (a cloud provider, a particular country). It can take a minute while each hop is timed.',
      how: 'Type a host name or IP. This sends ordinary network probes, the same as the built-in tracert command.', ex: 'example.com'
    },
    {
      id: 'mynetwork', icon: '🖧', name: 'My local network', line: 'Devices your PC has seen on your own network. No internet needed.',
      inputs: [], ep: 'mynetwork', get: 1,
      show: r => '<div class="small mute" style="margin-bottom:6px">This PC</div>' + (r.interfaces || []).map(i => row(i.name + ' (' + i.family + ')', '<span class="ct-mono">' + esc(i.address) + (i.mac ? '  ·  ' + esc(i.mac) : '') + '</span>')).join('') + '<div class="small mute" style="margin:10px 0 6px">Devices seen nearby (' + (r.devices || []).length + ')</div>' + ((r.devices || []).length ? '<table class="ct-tbl"><tr><th>Address</th><th>Hardware (MAC)</th></tr>' + r.devices.map(d => '<tr><td class="ct-mono">' + esc(d.ip) + '</td><td class="ct-mono">' + esc(d.mac) + '</td></tr>').join('') + '</table>' : '<div class="mute">None seen yet.</div>') + '<div class="small mute" style="margin-top:8px">' + esc(r.note || '') + '</div>',
      why: 'Your own network has more on it than you think: the router, phones, a printer, a TV, smart plugs. This reads the list of devices your PC has recently talked to (the ARP table) and your own addresses. It stays on your home network and needs no internet, so it is a safe way to see what is connected to you.',
      how: 'Just press Run. Everything here is about your own PC and your own network, which is always yours to inspect.', ex: ''
    },
    {
      id: 'wifi', icon: '📶', name: 'Wi-Fi networks nearby', line: 'Every wireless network your PC can see, and how safe it is.',
      inputs: [], ep: 'wifi', get: 1,
      show: r => (r.networks || []).length ? '<table class="ct-tbl"><tr><th>Name</th><th>Security</th><th>Signal</th></tr>' + r.networks.map(n => '<tr><td><b>' + esc(n.ssid) + '</b></td><td>' + (n.warn ? tag(n.auth || 'Open', 'ct-open') : tag(n.auth || '?', n.safe ? 'ct-ok' : '')) + (n.warn ? '<div class="small ct-bad">' + esc(n.warn) + '</div>' : '') + '</td><td class="small mute">' + esc(n.signal) + (n.channel ? ' · ch ' + esc(n.channel) : '') + '</td></tr>').join('') + '</table><div class="small mute" style="margin-top:8px">' + esc(r.note || '') + '</div>' : '<div class="mute">' + esc(r.note || 'No Wi-Fi found.') + '</div>',
      why: 'Your Wi-Fi card can hear every network around you, with its name, its security type and its signal strength. Open or old (WEP) networks are unsafe: anyone nearby can read what crosses them. Seeing them is how you check your own network is set up safely and spot a rogue hotspot pretending to be yours.',
      how: 'Just press Run. Listening to the networks in the air is legal; joining one you are not allowed on is not.', ex: ''
    },
    {
      id: 'hashid', icon: '🔖', name: 'Identify a hash', line: 'Names the kind of hash from its shape.',
      inputs: [{ k: 'hash', ph: '5f4dcc3b5aa765d61d8327deb882cf99', label: 'Paste a hash' }], ep: 'hashid',
      show: r => r.error ? '<div class="ct-bad">' + esc(r.error) + '</div>' : '<div class="small mute" style="margin-bottom:6px">' + r.length + ' hex characters. Most likely:</div>' + r.guesses.map(g => '<div class="ct-have">' + esc(g.name) + '</div>').join(''),
      why: 'A hash is a password or file turned into a fixed string of letters and numbers, in a way that cannot be reversed. Different methods (MD5, SHA-1, SHA-256, bcrypt) make different lengths and shapes. Before you can test a leaked hash you must know which method made it; this reads its length and start to tell you.',
      how: 'Paste a hash. This only measures the text; nothing is sent anywhere.', ex: '5f4dcc3b5aa765d61d8327deb882cf99'
    },
    {
      id: 'hashcrack', icon: '🔨', name: 'Try to crack a hash', line: 'Tests a hash against common passwords and your words.',
      inputs: [{ k: 'hash', ph: 'an MD5, SHA-1 or SHA-256 hash', label: 'Hash' }, { k: 'words', ph: 'extra words to try, comma or space separated', label: 'Your word list (optional)', area: 1 }], ep: 'hashcrack',
      show: r => r.error ? '<div class="ct-bad">' + esc(r.error) + '</div>' : r.cracked ? '<div class="ct-grade ct-grade-F" style="background:var(--bad)">Cracked</div><div style="margin-top:8px">The ' + esc(r.algo) + ' hash is the password <b class="ct-mono">' + esc(r.password) + '</b>, found after ' + r.tried + ' tries.</div>' : '<div class="ct-have">Not cracked after ' + r.tried + ' tries.</div><div class="small mute" style="margin-top:6px">' + esc(r.note || '') + '</div>',
      why: 'Cracking a hash means guessing the password that made it: you hash each guess and compare. A "dictionary attack" tries a list of likely passwords. This shows why a common password is no protection, because it falls in milliseconds, and why a long unusual one stays safe. It only tries words, so a real password that is not in any list will not be found.',
      how: 'Paste one of YOUR OWN hashes (make one with the hash maker). Add words to try if you like. Only ever crack hashes you are allowed to.',
      warn: 1, ex: '5f4dcc3b5aa765d61d8327deb882cf99'
    },
    {
      id: 'hashmake', icon: '🧮', name: 'Make a hash', line: 'Turns any text into MD5, SHA-1, SHA-256 and SHA-512.',
      inputs: [{ k: 'text', ph: 'type anything', label: 'Text' }], ep: 'hashmake',
      show: r => '<div class="ct-grid2">' + Object.entries(r.hashes).map(([a, h]) => row(a.toUpperCase(), '<span class="ct-mono" style="word-break:break-all">' + esc(h) + '</span>')).join('') + '</div>',
      why: 'Hashing turns text into a fixed fingerprint that cannot be turned back. It is how passwords should be stored and how you check a downloaded file was not tampered with. Making a few hashes here shows how the same text always gives the same fingerprint, and how one changed letter changes everything.',
      how: 'Type any text. This runs on your PC and sends nothing anywhere.', ex: 'hello'
    },
    {
      id: 'secrets', icon: '🔑', name: 'Secret scanner', line: 'Sweeps your own files for keys, tokens and private keys.',
      inputs: [{ k: 'path', ph: 'a folder or file inside Moundshroud', label: 'Folder or file to scan', val: 'web/js' }], ep: 'secrets',
      show: r => r.error ? '<div class="ct-bad">' + esc(r.error) + '</div>' : '<div class="small mute" style="margin-bottom:6px">' + esc(r.scanned || 0) + ' files scanned' + (r.path ? ' in ' + esc(r.path) : '') + '. ' +
        ((r.findings || []).length ? '<span class="ct-bad">' + r.findings.length + ' possible secret' + (r.findings.length === 1 ? '' : 's') + '</span>' : '<span class="ct-ok">nothing that looks like a secret</span>') +
        (r.truncated ? ' (stopped at 300 hits)' : '') + '</div>' +
        ((r.findings || []).length ? '<table class="ct-tbl"><tr><th>File</th><th>Line</th><th>What it looks like</th><th>Masked</th></tr>' +
          r.findings.slice(0, 120).map(f => '<tr><td class="ct-mono small">' + esc(f.file) + '</td><td>' + esc(f.line) + '</td><td>' + esc(f.rule) + '</td><td class="ct-mono">' + esc(f.preview) + '</td></tr>').join('') + '</table>' +
          (r.findings.length > 120 ? '<div class="small mute" style="margin-top:4px">…and ' + (r.findings.length - 120) + ' more</div>' : '') : '') +
        '<div class="small mute" style="margin-top:8px">' + esc(r.note || '') + '</div>',
      why: 'A leaked API key is one of the most common real findings: it ships in a script, a config file, a test fixture or a committed .env, and anyone who reads the file can spend the owner’s money. This scanner knows the fingerprints of the usual families (AWS, GitHub, Slack, Google, Stripe, OpenAI, private key blocks, JWTs) and also flags long random-looking strings, which is how the tools in the awesome-secret-scanning lists (gitleaks, trufflehog) work.',
      how: 'Name a folder or file inside Moundshroud and press Run. Everything is read from this PC only, each hit is masked, and nothing is sent anywhere. Treat a hit as a lead: a key can be a test value or public by design, and a real leak must be rotated, not just deleted.',
      ex: 'web/js'
    },
    {
      id: 'strings', icon: '🔤', name: 'strings', line: 'Readable text hidden inside any file or binary.',
      inputs: [{ k: 'path', ph: 'a file inside Moundshroud', label: 'File', val: 'web/moundshroud.ico' }, { k: 'min', ph: '6', label: 'Shortest run of text to show (3-20)', val: '6' }], ep: 'strings',
      show: r => r.error ? '<div class="ct-bad">' + esc(r.error) + '</div>' : '<div class="small mute" style="margin-bottom:6px">' + esc(r.file) + ' · ' + esc(r.bytes) + ' bytes · ' + esc(r.count) + ' runs of at least ' + esc(r.min) + ' characters' + (r.truncated ? ' (stopped at 500)' : '') + '</div>' +
        ((r.strings || []).length ? '<pre class="ct-pre">' + esc((r.strings || []).join('\n')) + '</pre>' : '<div class="mute">No readable text found.</div>') +
        '<div class="small mute" style="margin-top:8px">' + esc(r.note || '') + '</div>',
      why: 'A file is not only what its extension says. Version banners, file paths, URLs, usernames and leftover build secrets all sit in plain text inside binaries, pictures and archives. Extracting the readable runs is how you learn what something really is, and it is the same idea as the strings command every tester has.',
      how: 'Name a file inside Moundshroud (a picture, a binary, an archive) and press Run. It reads the first 4 MB of your own file and sends nothing anywhere.',
      ex: 'web/moundshroud.ico'
    },
    {
      id: 'hashdir', icon: '🧾', name: 'File checksums', line: 'A SHA-256 fingerprint of every file in a folder.',
      inputs: [{ k: 'path', ph: 'a folder inside Moundshroud', label: 'Folder or file', val: 'web/js' }], ep: 'hashdir',
      show: r => r.error ? '<div class="ct-bad">' + esc(r.error) + '</div>' : '<div class="small mute" style="margin-bottom:6px">' + esc(r.path) + ' · ' + (r.files || []).length + ' files</div>' +
        ((r.files || []).length ? '<table class="ct-tbl"><tr><th>File</th><th>Size</th><th>SHA-256</th></tr>' + r.files.slice(0, 200).map(f => '<tr><td class="ct-mono small">' + esc(f.file) + '</td><td>' + esc(f.bytes) + '</td><td class="ct-mono small" style="word-break:break-all">' + esc(f.sha256) + '</td></tr>').join('') + '</table>' + (r.files.length > 200 ? '<div class="small mute" style="margin-top:4px">…and ' + (r.files.length - 200) + ' more</div>' : '') : '<div class="mute">No files found.</div>') +
        '<div class="small mute" style="margin-top:8px">' + esc(r.note || '') + '</div>',
      why: 'A checksum turns a file into a short fingerprint: change one byte and the fingerprint changes completely. Testers use a manifest to prove a download is the file they checked, and defenders use it to notice that something on disk was swapped. This is what sha256sum and signed build manifests do.',
      how: 'Name a folder inside Moundshroud and press Run. Every byte is your own file, read locally; nothing is uploaded.',
      ex: 'web/js'
    },
    {
      id: 'connections', icon: '🔌', name: 'Live connections', line: 'Who your PC is talking to right now, and which program. No internet needed.',
      inputs: [], ep: 'connections', get: 1,
      show: r => (r.connections || []).length ? '<table class="ct-tbl"><tr><th>Program</th><th>This PC</th><th>Talking to</th><th>State</th></tr>' + r.connections.map(c => '<tr><td>' + esc(c.program || '?') + '</td><td class="ct-mono">' + esc(c.local) + '</td><td class="ct-mono">' + esc(c.remote || '—') + '</td><td class="small mute">' + esc(c.state) + '</td></tr>').join('') + '</table><div class="small mute" style="margin-top:8px">' + esc(r.note || '') + '</div>' : '<div class="mute">' + esc(r.note || 'None.') + '</div>',
      why: 'Every program that uses the network opens a connection. This lists them live, with the program behind each one, where it is connecting, and the state. It is how you spot something talking to the internet that should not be, and how you learn what normal traffic looks like.',
      how: 'Just press Run. Everything here is your own PC, which is always yours to inspect.', ex: ''
    },
    {
      id: 'capture', icon: '🦈', name: 'Packet capture (Wireshark)', line: 'Records a short burst of real network packets, using tshark.',
      inputs: [{ k: 'seconds', ph: '12', label: 'How many seconds (3 to 30)', val: '12' }, { k: 'count', ph: '60', label: 'Up to how many packets (5 to 200)', val: '60' }, { k: 'filter', ph: 'e.g. tcp port 443   (leave blank for all)', label: 'Capture filter (optional)' }], ep: 'capture',
      show: r => r.error ? '<div class="ct-bad">' + esc(r.error) + '</div>' : '<div class="small mute" style="margin-bottom:6px">' + esc(r.count || 0) + ' packets on ' + esc(r.iface || '') + ' in ' + esc(r.seconds) + 's. ' + (r.protocols || []).map(p => esc(p.proto) + ' ×' + p.count).join(', ') + '</div>' + ((r.packets || []).length ? '<table class="ct-tbl"><tr><th>Time</th><th>From</th><th>To</th><th>Protocol</th><th>Summary</th></tr>' + r.packets.map(p => '<tr><td class="small mute">' + esc(p.t) + '</td><td class="ct-mono">' + esc(p.src) + '</td><td class="ct-mono">' + esc(p.dst) + '</td><td>' + esc(p.proto) + '</td><td class="small mute">' + esc(p.info) + '</td></tr>').join('') + '</table>' : '<div class="mute">' + esc(r.note || '') + '</div>') + '<div class="small mute" style="margin-top:8px">' + esc(r.note || '') + '</div>',
      why: 'Wireshark is the best known network tool: it records the actual packets crossing your network card so you can see exactly what is being sent. This runs its capture engine (tshark) for a few seconds and lays each packet out in plain rows: when it arrived, from where, to where, the protocol and a summary. It is how you truly understand what a program or a website is doing on the wire.',
      how: 'Pick how long and how many packets, and an optional filter like "tcp port 443". Press Run. Capturing needs Wireshark installed, and may need Moundshroud opened as administrator. Only capture your own network traffic.',
      warn: 1, ex: ''
    }
  ];

  const CSS = '.ct-wrap{max-width:900px}.ct-intro{background:var(--panel);border:1px solid var(--line);border-left:3px solid var(--acc);border-radius:10px;padding:12px 14px;margin-bottom:12px}' +
    '.ct-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(250px,1fr));gap:10px}' +
    '.ct-card{border:1px solid var(--line);border-radius:12px;padding:12px 14px;background:var(--panel);cursor:pointer;transition:border-color .15s}.ct-card:hover{border-color:var(--acc)}' +
    '.ct-ico{font-size:24px}.ct-card b{display:block;margin:4px 0 2px}.ct-card .small{line-height:1.4}' +
    '.ct-tool{border:1px solid var(--line);border-radius:12px;padding:0;overflow:hidden}.ct-head{display:flex;gap:10px;align-items:center;padding:12px 14px;background:var(--panel2)}.ct-head b{font-size:16px}' +
    '.ct-body{padding:14px}.ct-body label{display:block;font-size:12.5px;color:var(--mute);margin:8px 0 3px}.ct-body input,.ct-body textarea{width:100%;box-sizing:border-box}.ct-body textarea{min-height:60px;font-family:Consolas,monospace;font-size:12.5px}' +
    '.ct-run{margin-top:10px}.ct-res{margin-top:12px;min-height:4px}.ct-warnbox{border:1px solid var(--warn);background:color-mix(in srgb,var(--warn) 12%,transparent);border-radius:8px;padding:8px 10px;margin-bottom:8px;font-size:12.5px}' +
    '.ct-kv{display:flex;gap:10px;padding:4px 0;border-bottom:1px solid var(--line)}.ct-k{min-width:120px;color:var(--mute);font-size:12.5px}.ct-v{flex:1;word-break:break-word}.ct-grid2 .ct-kv:last-child{border-bottom:0}' +
    '.ct-mono{font-family:Consolas,monospace;font-size:12.5px}.ct-tbl{width:100%;border-collapse:collapse;font-size:13px}.ct-tbl th{text-align:left;color:var(--mute);font-weight:600;font-size:11.5px;padding:3px 6px;border-bottom:1px solid var(--line)}.ct-tbl td{padding:4px 6px;border-bottom:1px solid var(--line);vertical-align:top}' +
    '.ct-tag{display:inline-block;padding:1px 7px;border-radius:6px;background:var(--panel2);font-size:11.5px;font-family:Consolas,monospace}.ct-open{background:color-mix(in srgb,var(--bad) 20%,transparent)}.ct-ok{background:color-mix(in srgb,var(--ok) 22%,transparent)}' +
    '.ct-bad{color:var(--bad)}.ct-have{padding:4px 0}.ct-miss{padding:4px 0;color:var(--mute)}.ct-cols{display:grid;grid-template-columns:1fr 1fr;gap:14px;margin-top:8px}@media(max-width:560px){.ct-cols{grid-template-columns:1fr}}' +
    '.ct-grade{display:inline-flex;flex-direction:column;align-items:center;justify-content:center;width:64px;height:64px;border-radius:12px;background:var(--acc);color:#fff;font-size:30px;font-weight:800;float:right;margin:0 0 6px 10px}.ct-grade .small{font-size:10px;font-weight:600}.ct-grade-A,.ct-grade-B{background:var(--ok)}.ct-grade-C{background:var(--warn)}.ct-grade-D,.ct-grade-F{background:var(--bad)}' +
    '.ct-aians{margin-top:8px;font-size:13px;line-height:1.5}.ct-aians.on{border-left:2px solid var(--acc);padding-left:10px}.ct-pre{max-height:260px;overflow:auto;font-size:11.5px;background:var(--panel2);padding:8px;border-radius:6px;white-space:pre-wrap}.ct-tut{border-top:1px solid var(--line);padding:12px 14px;background:var(--panel2)}.ct-tut h4{margin:0 0 4px;font-size:13px}.ct-tut p{margin:0 0 8px;font-size:13px;line-height:1.5}';

  /* ask the local AI to explain a tool's result, right on the page */
  function aiBox(w, t, r) {
    if (!r || (r.error && !(t.id === 'whois' && r.facts))) return;
    const res = w.querySelector('#ctres'); if (!res) return;
    const bar = document.createElement('div'); bar.style.marginTop = '10px';
    bar.innerHTML = '<button class="ib" id="ctai">💬 Ask the AI to explain this</button> <input id="ctaiq" placeholder="or ask your own question about it..." style="width:auto;min-width:200px" spellcheck="false"><div id="ctaians" class="ct-aians"></div>';
    res.appendChild(bar);
    const ask = async (q) => {
      if (!A.ai || !A.ai.stream) return A.notify ? A.notify('warn', 'The AI helper is not loaded.') : 0;
      const ans = w.querySelector('#ctaians'); ans.textContent = '…'; ans.classList.add('on');
      const sys = 'You are a friendly security teacher inside Moundshroud. The user ran the ' + t.name + ' tool. Here is its result as JSON:\n' + JSON.stringify(r).slice(0, 2600) + '\n\nExplain in plain, short words what this result means and what it tells them. Be accurate, calm and defensive-minded; never encourage illegal use. If they asked a specific question, answer it.';
      try { await A.ai.stream([{ role: 'system', content: sys }, { role: 'user', content: q || 'Explain what this result means.' }], txt => { ans.innerHTML = (A.md ? A.md(txt) : esc(txt)); }, null, { temp: 0.3, max: 500 }); }
      catch (e) { ans.textContent = 'The AI could not answer: ' + e.message; }
    };
    bar.querySelector('#ctai').onclick = () => ask('');
    bar.querySelector('#ctaiq').onkeydown = e => { if (e.key === 'Enter' && e.target.value.trim()) ask(e.target.value.trim()); };
  }
  let open = '', playing = '';
  const netGames = () => A.cyberNetGames || null;
  const hasGame = t => !!(netGames() && netGames().has(t.id));
  function render(b) {
    b.innerHTML = '<style>' + CSS + '</style><div class="scroll pad" style="flex:1"><div class="ct-wrap" id="ctw"></div></div>';
    draw(b.querySelector('#ctw'));
  }
  function draw(w) {
    if (playing) return drawGame(w, playing);
    if (open) return drawTool(w, TOOLS.find(t => t.id === open));
    w.innerHTML = '<h2 style="margin:0 0 4px">🧰 Security Toolkit</h2>' +
      '<div class="ct-intro"><b>Reconnaissance and checking tools, like the ones on Kali Linux, running on this PC.</b><div class="small mute" style="margin-top:4px">Every tool only <b>looks, reads or asks</b>; none attacks or breaks in. Use them to learn, and to test systems you <b>own</b> or have <b>written permission</b> to test. Each tool explains itself. Ask the AI in Chat too: <i>“scan the open ports on localhost”</i> or <i>“check the security headers on my-site.com”</i>.</div></div>' +
      (netGames() ? '<div class="ct-intro" style="border-left-color:var(--ok)"><b>🎮 A game for every network tool</b><div class="small mute" style="margin-top:4px">Each of these generates fresh data every round, so it never runs out. Learn what the tool tells you before you use it for real.</div><div class="row" style="gap:6px;flex-wrap:wrap;margin-top:8px">' +
        TOOLS.filter(hasGame).map(t => '<button class="ib" data-ctg="' + t.id + '">' + t.icon + ' ' + esc(netGames().name(t.id)) + '</button>').join('') + '</div></div>' : '') +
      '<div class="ct-grid">' + TOOLS.map(t => '<div class="ct-card" data-t="' + t.id + '"><div class="ct-ico">' + t.icon + '</div><b>' + esc(t.name) + (hasGame(t) ? ' <span class="ct-tag ct-ok">🎮</span>' : '') + '</b><div class="small mute">' + esc(t.line) + '</div></div>').join('') + '</div>';
    w.querySelectorAll('[data-t]').forEach(c => c.onclick = () => { open = c.dataset.t; draw(w); });
    w.querySelectorAll('[data-ctg]').forEach(b => b.onclick = () => { playing = b.dataset.ctg; open = ''; draw(w); });
  }
  function drawGame(w, id) {
    w.innerHTML = '<div id="ctgame"></div>';
    if (!netGames() || !netGames().render(w.querySelector('#ctgame'), id, () => { playing = ''; draw(w); })) { playing = ''; draw(w); }
  }
  function drawTool(w, t) {
    w.innerHTML = '<button class="ib" id="ctback" style="margin-bottom:10px">← All tools</button>' +
      '<div class="ct-tool"><div class="ct-head"><span class="ct-ico">' + t.icon + '</span><b>' + esc(t.name) + '</b></div>' +
      '<div class="ct-body">' + (t.warn ? '<div class="ct-warnbox">⚠️ Only use this on systems you <b>own</b> or have <b>written permission</b> to test. Using it on others may be a crime.</div>' : '') +
      t.inputs.map(i => '<label>' + esc(i.label) + '</label>' + (i.area ? '<textarea id="ct-' + i.k + '" placeholder="' + esc(i.ph) + '"></textarea>' : '<input id="ct-' + i.k + '" placeholder="' + esc(i.ph) + '" value="' + esc(i.val || '') + '" spellcheck="false" autocomplete="off">')).join('') +
      '<button class="pri ct-run" id="ctrun">▶ Run' + (t.inputs.length ? '' : ' now') + '</button>' + (t.ex ? ' <button class="ib" id="ctex">Try the example</button>' : '') +
      (hasGame(t) ? ' <button class="ib" id="ctplay" title="Practice what this tool tells you">🎮 Play the game</button>' : '') +
      '<div class="ct-res" id="ctres"></div></div>' +
      '<div class="ct-tut"><h4>🎓 What it is</h4><p>' + esc(t.why) + '</p><h4>How to use it</h4><p>' + esc(t.how) + '</p></div></div>';
    w.querySelector('#ctback').onclick = () => { open = ''; draw(w); };
    const run = async () => {
      const res = w.querySelector('#ctres'); res.innerHTML = '<div class="mute">⏳ Running…</div>';
      const body = {}; for (const i of t.inputs) body[i.k] = (w.querySelector('#ct-' + i.k) || {}).value || '';
      const r = t.get ? await api('/api/cyber/' + t.ep) : await api('/api/cyber/' + t.ep, body);
      res.innerHTML = r && r.error && !(t.id === 'whois' && r.facts) ? '<div class="ct-bad">' + esc(r.error) + '</div>' : t.show(r);
      aiBox(w, t, r);
    };
    w.querySelector('#ctrun').onclick = run;
    if (w.querySelector('#ctplay')) w.querySelector('#ctplay').onclick = () => { playing = t.id; draw(w); };
    if (w.querySelector('#ctex')) w.querySelector('#ctex').onclick = () => { if (t.inputs[0]) { const el = w.querySelector('#ct-' + t.inputs[0].k); if (el) el.value = t.ex; } run(); };
    if (!t.inputs.length) run();
  }

  /* the AI uses the same tools (web/js/actions.js calls this) */
  async function aiRun(id, args) {
    const t = TOOLS.find(x => x.id === id); if (!t) throw new Error('no such tool');
    const r = t.get ? await api('/api/cyber/' + t.ep) : await api('/api/cyber/' + t.ep, args || {});
    return r;
  }
  A.cyberTools = {
    render,
    tools: () => TOOLS.map(t => ({ id: t.id, name: t.name, line: t.line })),
    run: aiRun,
    open: id => { playing = ''; open = TOOLS.some(t => t.id === id) ? id : ''; if (A.cybertab) A.cybertab.go('kit'); },
    play: id => { if (!A.cyberNetGames || !A.cyberNetGames.has(id)) return; playing = id; open = ''; if (A.cybertab) A.cybertab.go('kit'); }
  };
})();

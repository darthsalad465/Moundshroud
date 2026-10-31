// Cyber > Cyber Lab: security guides (defence-first, legal practice only), a local password-strength lab, and links to the cyber games and CyberChef.
(() => {
  const G = [
    { id: 'mindset', cat: 'Start here', t: 'Hacking, ethics and the law', lv: 'Beginner', min: 5, play: ['netninja'], b: `
<p>A hacker is someone who understands a system well enough to make it do things its designers did not plan. The same skills protect systems (defenders, "white hats") or abuse them (criminals, "black hats"). What separates them is <b>permission</b>.</p>
<h3>The golden rules</h3>
<ul><li>Only test systems you <b>own</b> or have <b>written permission</b> to test. Scanning or poking at other people's computers, sites or Wi-Fi is illegal in most countries, even if you "meant no harm".</li>
<li>Stay inside the <b>scope</b>: the exact systems, times and methods you were allowed to use.</li>
<li>Report what you find responsibly. Do not read, copy or change other people's data.</li></ul>
<h3>Where to practise legally</h3>
<ul><li><b>Moundshroud's Cyber games</b>: safe sandboxes that run on this PC.</li>
<li><b>Capture The Flag (CTF)</b> contests and practice sites built to be attacked: picoCTF, OverTheWire, TryHackMe, Hack The Box, Hack This Site.</li>
<li><b>Your own home lab</b>: virtual machines on your PC that you set up on purpose (see "Learning path").</li></ul>
<p class="mute small">Real laws include the US Computer Fraud and Abuse Act and the UK Computer Misuse Act. Rules differ where you live, so treat "do I have permission?" as the first question every time.</p>` },
    { id: 'net', cat: 'Start here', t: 'Networking in 10 minutes', lv: 'Beginner', min: 8, play: ['netninja'], b: `
<p>Almost every attack and defence is about how computers talk to each other. Learn these pieces and everything else makes more sense.</p>
<ul><li><b>IP address</b>: a computer's address on a network (like 192.168.1.20 at home, or a public one on the internet).</li>
<li><b>Port</b>: a numbered door on that address. Web is 80/443, remote login 22, DNS 53. A program "listens" on a port.</li>
<li><b>TCP and UDP</b>: TCP is reliable (a handshake: SYN, SYN-ACK, ACK). UDP is fast and careless (DNS, video calls, games).</li>
<li><b>DNS</b>: the phone book that turns example.com into an IP address.</li>
<li><b>Router and NAT</b>: your router gives every device a private address and shares one public one.</li>
<li><b>HTTP vs HTTPS</b>: web traffic in the clear versus encrypted.</li></ul>
<h3>Windows commands to try</h3>
<p><code>ipconfig /all</code> your addresses &nbsp; <code>ping 8.8.8.8</code> is it reachable &nbsp; <code>tracert example.com</code> the route &nbsp; <code>nslookup example.com</code> DNS answer &nbsp; <code>netstat -ano</code> every open connection and listening port on <i>your</i> PC.</p>
<p>Everything travels in <b>packets</b>. A tool such as Wireshark shows them; that is why unencrypted traffic on shared Wi-Fi can be read by others.</p>` },
    { id: 'linux', cat: 'Start here', t: 'Linux command line survival', lv: 'Beginner', min: 8, play: ['terminal'], b: `
<p>Servers, routers, phones and most security tools run on Linux, so a little command line goes a long way. The <b>Terminal Hacker</b> game lets you practise these in a safe pretend shell.</p>
<ul><li><code>pwd</code> where am I &nbsp; <code>ls -la</code> list everything including hidden files (starting with a dot) with permissions</li>
<li><code>cd folder</code>, <code>cd ..</code> move around &nbsp; <code>cat file</code> show a file &nbsp; <code>head</code>/<code>tail</code> start or end of a file</li>
<li><code>grep word file</code> search text &nbsp; <code>find / -name "*.conf"</code> search the whole disk by name</li>
<li><code>chmod</code> change permissions &nbsp; <code>ps</code> processes &nbsp; <code>man command</code> the built-in manual</li>
<li>The pipe <code>|</code> feeds one command into another: <code>cat log.txt | grep Failed | wc -l</code> counts failures.</li></ul>
<h3>Reading permissions</h3>
<p><code>-rwxr-xr--</code> means: a file, owner can read/write/execute, group can read/execute, everyone else read only. Wrongly open permissions are one of the most common real-world weaknesses.</p>` },
    { id: 'pass', cat: 'Defend', t: 'Passwords, hashes and why they get cracked', lv: 'Beginner', min: 8, play: ['cipher'], lab: 1, b: `
<p>Sites should never store your actual password. They store a <b>hash</b>: a one-way fingerprint. When you log in, they hash what you typed and compare.</p>
<h3>How passwords get broken</h3>
<ul><li><b>Credential stuffing</b>: criminals try passwords leaked from one site on every other site. The #1 reason to use a different password everywhere.</li>
<li><b>Guessing</b>: attackers try the most common passwords first (123456, password, qwerty, names plus a year).</li>
<li><b>Cracking stolen hashes</b>: fast hashes (MD5, SHA-1) fall to billions of guesses per second on a gaming PC. Good systems use slow, salted hashes (bcrypt, scrypt, Argon2). A <b>salt</b> is random data added so identical passwords hash differently.</li></ul>
<h3>What actually helps</h3>
<ul><li><b>Length beats complexity.</b> A passphrase of 4 or more random words is strong and memorable.</li>
<li>Use a <b>password manager</b> so every site gets a unique random password.</li>
<li>Turn on <b>two-factor authentication</b> (an authenticator app or a hardware key, rather than SMS if you can).</li>
<li>Where offered, use <b>passkeys</b>: nothing to steal or phish.</li></ul>
<p>Try the <b>Password lab</b> on the main Cyber Lab page to see how guessable your ideas are. It runs only on this PC.</p>` },
    { id: 'crypto', cat: 'How attacks work', t: 'Cryptography without the maths', lv: 'Beginner', min: 9, play: ['cipher'], chef: 1, b: `
<p>Three words get mixed up constantly:</p>
<ul><li><b>Encoding</b> (Base64, hex, URL-encoding) just changes the format. Anyone can reverse it. It is <i>not</i> secret.</li>
<li><b>Hashing</b> (SHA-256) makes a one-way fingerprint. Used for passwords and checking files are unchanged.</li>
<li><b>Encryption</b> scrambles data so only someone with the key can read it.</li></ul>
<h3>Two kinds of encryption</h3>
<ul><li><b>Symmetric</b> (AES): one shared key locks and unlocks. Fast.</li>
<li><b>Asymmetric</b> (RSA, elliptic curves): a public key locks, a private key unlocks. Slower, but lets strangers set up secrets. The padlock in your browser (TLS) uses asymmetric crypto to agree on a symmetric key.</li></ul>
<h3>Old ciphers worth knowing</h3>
<p>Caesar (shift letters), Atbash (mirror alphabet), Vigenere (a shifting key) and XOR are all easy to break, which is why they make great puzzles. Real security rule: <b>never invent your own cipher</b>; use well-tested libraries.</p>
<p>Open <b>CyberChef</b> (the swiss-army knife) and try the recipes <i>From Base64</i>, <i>ROT13</i>, <i>From Hex</i> and <i>XOR Brute Force</i> on the Cipher Breaker puzzles.</p>` },
    { id: 'web', cat: 'How attacks work', t: 'How websites get attacked and defended', lv: 'Intermediate', min: 10, play: ['sqldojo'], b: `
<p>Most breaches come from a handful of mistakes, summarised by the OWASP Top 10 list. The big ones:</p>
<ul><li><b>SQL injection</b>: user text gets glued into a database query, so an attacker's text becomes part of the command. <b>Fix:</b> parameterized queries; the database treats input only as data. Try it in the SQL Injection Dojo.</li>
<li><b>Cross-site scripting (XSS)</b>: a site shows user text without escaping it, so a script runs in other visitors' browsers. <b>Fix:</b> escape output, use a Content Security Policy.</li>
<li><b>Broken access control / IDOR</b>: changing <code>/invoice/1001</code> to <code>/invoice/1002</code> shows someone else's data. <b>Fix:</b> check permissions on the server for every request.</li>
<li><b>CSRF</b>: a malicious page makes your logged-in browser perform an action. <b>Fix:</b> anti-forgery tokens, SameSite cookies.</li>
<li><b>Weak authentication</b>: no lockouts, default passwords, no 2FA.</li>
<li><b>Out-of-date software</b>: known flaws left unpatched.</li></ul>
<p>The common thread: <b>never trust anything the user sends</b>. Validate on the server, give each part the least access it needs, and keep everything updated.</p>` },
    { id: 'phish', cat: 'Defend', t: 'Phishing and social engineering', lv: 'Beginner', min: 6, play: ['phish'], b: `
<p>The easiest way into most systems is not code, it is a person. Social engineering means tricking someone into helping the attacker.</p>
<h3>Red flags</h3>
<ul><li><b>Urgency or fear</b>: "account closed in 24 hours", "you have been hacked".</li>
<li><b>Look-alike sender or link</b>: micros0ft.com, paypa1, extra words like "-support". Hover over a link to see where it really goes.</li>
<li><b>Unexpected attachments</b>, especially .html, .zip, .exe, .iso or Office files asking you to "enable macros".</li>
<li><b>Requests for money, gift cards, codes or passwords</b>. Real companies do not ask for your password.</li>
<li><b>Too good to be true</b>: prizes, refunds, job offers.</li></ul>
<h3>Other flavours</h3>
<p>Smishing (text messages), vishing (phone calls), QR-code phishing, fake tech support, and CEO fraud ("I need you to buy gift cards, quietly").</p>
<h3>What to do</h3>
<p>Do not click. Go to the site yourself by typing the address or using your app. Call the person on a number you already know. Report it, delete it. If you did enter a password, change it everywhere you reused it and turn on 2FA.</p>` },
    { id: 'recon', cat: 'How attacks work', t: 'Reconnaissance and port scanning', lv: 'Intermediate', min: 9, play: ['netninja', 'logs'], b: `
<p>Before an attack (or a security test) comes <b>reconnaissance</b>: learning what exists. <i>Passive</i> recon uses public information (WHOIS, DNS records, search engines, job posts that mention technologies). <i>Active</i> recon touches the target, such as port scanning, and so needs permission.</p>
<h3>What a port scan tells you</h3>
<p>A scanner asks each port "are you open?". Open ports reveal services, and often versions. Example of the kind of result you would see scanning <b>your own</b> machine:</p>
<pre>PORT     STATE  SERVICE
22/tcp   open   ssh
80/tcp   open   http
445/tcp  open   microsoft-ds
3389/tcp open   ms-wbt-server</pre>
<p>As a defender, ask of each line: <i>do I need this?</i> Exposed SMB (445) and Remote Desktop (3389) to the internet are classic ways ransomware gets in.</p>
<h3>Defence</h3>
<ul><li>Close or firewall everything you do not use. Fewer open doors means a smaller <b>attack surface</b>.</li>
<li>Keep exposed services patched; protect logins with 2FA and lockouts.</li>
<li>Watch your logs for scans: many connections to many ports from one address.</li></ul>
<p class="mute small">On your own PC, <code>netstat -ano</code> shows what is listening. Never scan networks or computers that are not yours without permission.</p>` },
    { id: 'malware', cat: 'Defend', t: 'Malware and ransomware: how they work, how to survive', lv: 'Beginner', min: 7, play: ['netninja'], b: `
<p><b>Malware</b> is software built to do harm. Common types: viruses and worms (spread), trojans (pretend to be useful), spyware and infostealers (steal passwords and cookies), ransomware (locks your files for money), and botnets (your PC becomes a remote-controlled drone).</p>
<h3>How it gets in</h3>
<p>Cracked software and game "cheats", email attachments, fake update pop-ups, malicious ads, USB sticks, and unpatched software with known holes.</p>
<h3>Warning signs</h3>
<p>Sudden slowness, programs you did not install, browser home page changes, antivirus switched off, files renamed with odd extensions, ransom notes.</p>
<h3>Your best protection</h3>
<ul><li>Keep Windows and apps updated. Leave <b>Microsoft Defender</b> on.</li>
<li><b>Backups are the real cure for ransomware</b>: the 3-2-1 rule, three copies, two kinds of storage, one offline or off-site.</li>
<li>Do not run things from sources you do not trust. Use a normal (not administrator) account for daily use.</li></ul>
<h3>If you are infected</h3>
<p>Disconnect from the network, do not pay a ransom, scan with Defender Offline, change passwords from a <i>different, clean</i> device, and restore from backup.</p>` },
    { id: 'home', cat: 'Defend', t: 'Lock down your PC and home network', lv: 'Beginner', min: 6, play: [], b: `
<p>A quick checklist that stops most real-world attacks:</p>
<ul><li><b>Router</b>: change the admin password, use WPA2 or WPA3, turn off WPS and remote administration, keep firmware updated.</li>
<li><b>Wi-Fi</b>: a long passphrase; a separate guest network for visitors and smart gadgets.</li>
<li><b>Windows</b>: automatic updates on, Defender on, firewall on, BitLocker or device encryption for laptops, standard user for daily use.</li>
<li><b>Accounts</b>: password manager, unique passwords, 2FA everywhere that matters (email first, because it resets everything else).</li>
<li><b>Backups</b>: automatic, one copy disconnected.</li>
<li><b>Browser</b>: updates on, few extensions, an ad blocker, never save card details in random sites.</li>
<li><b>Smart devices</b>: change default passwords, update them, and put them on the guest network.</li></ul>
<p>Moundshroud itself runs only on this PC and does not open ports to the internet.</p>` },
    { id: 'ctf', cat: 'CTF and forensics', t: 'Your first Capture The Flag', lv: 'Beginner', min: 8, play: ['terminal', 'cipher'], chef: 1, b: `
<p>A <b>CTF</b> is a puzzle contest where you find a hidden "flag" (a text like <code>FLAG{...}</code>) and submit it for points. It is the best legal way to learn.</p>
<h3>Categories</h3>
<ul><li><b>Web</b>: find flaws in a practice website.</li><li><b>Crypto</b>: break weak ciphers and encodings.</li><li><b>Forensics</b>: dig through files, images and network captures.</li>
<li><b>Reverse engineering</b> and <b>Pwn</b>: understand and exploit programs.</li><li><b>OSINT</b>: find facts from public sources.</li><li><b>Misc</b>: anything clever.</li></ul>
<h3>A workflow that works</h3>
<ol><li>Read the challenge twice. Every word is usually a clue.</li><li>Run <code>file</code> and <code>strings</code> on any file; look at it in a hex viewer.</li><li>Try CyberChef's <i>Magic</i> operation on odd-looking text.</li><li>Take notes of what you tried. Search for the error messages you get.</li><li>Stuck? Walk away, then read others' <b>write-ups</b> after the event to learn.</li></ol>
<p>Useful tools: CyberChef, a hex editor, Wireshark, exiftool, Burp Suite Community, Ghidra. Start with picoCTF, which is made for beginners.</p>` },
    { id: 'forensics', cat: 'CTF and forensics', t: 'Files, metadata and digital forensics', lv: 'Intermediate', min: 8, play: ['logs'], chef: 1, b: `
<p>Forensics is detective work on data. Files carry more than they show.</p>
<h3>Magic bytes</h3>
<p>A file's real type is in its first bytes, not its extension:</p>
<p><code>89 50 4E 47</code> PNG &nbsp; <code>FF D8 FF</code> JPEG &nbsp; <code>25 50 44 46</code> PDF (%PDF) &nbsp; <code>50 4B 03 04</code> ZIP (also docx, xlsx, apk) &nbsp; <code>4D 5A</code> Windows program (MZ)</p>
<h3>Where clues hide</h3>
<ul><li><b>Metadata</b>: photos can hold the camera, date and GPS location; documents hold author names. (Check and strip it before sharing!)</li>
<li><b>Strings</b>: readable text inside binaries often shows URLs, passwords or commands.</li>
<li><b>Slack space and deleted files</b>: deleting usually removes only the pointer, not the data.</li>
<li><b>Steganography</b>: data hidden inside an image or sound.</li>
<li><b>Hashes</b>: a SHA-256 of a file proves it was not changed.</li></ul>
<p>Good forensics keeps a record of everything you did and never works on the original: always on a copy.</p>` },
    { id: 'logs', cat: 'CTF and forensics', t: 'Reading logs like a detective', lv: 'Intermediate', min: 7, play: ['logs'], b: `
<p>Logs are a diary written by your systems. When something goes wrong, they tell you what happened and when.</p>
<h3>What a brute-force attack looks like</h3>
<p>Many <code>Failed password</code> lines from one address in a short time, often trying many usernames, perhaps followed by a single <code>Accepted</code> line. That last line is the moment of compromise.</p>
<h3>Windows events worth knowing</h3>
<ul><li><b>4625</b>: failed logon &nbsp; <b>4624</b>: successful logon &nbsp; <b>4672</b>: administrator-level logon &nbsp; <b>4688</b>: a new process started &nbsp; <b>1102</b>: the log was cleared (suspicious!)</li></ul>
<p>Open Event Viewer (Windows Logs, then Security) to see them on your own PC.</p>
<h3>Habits of a good analyst</h3>
<ul><li>Find the first event, then the last. Build a timeline.</li><li>Count and group: which address, which user, which hour appears most?</li><li>Ask "what is normal?" first; anomalies stand out against it.</li></ul>
<p>Try the <b>Log Detective</b> game: click any address to highlight its lines.</p>` },
    { id: 'privacy', cat: 'Defend', t: 'Privacy, tracking and staying low-profile', lv: 'Beginner', min: 7, play: [], b: `
<p>Start with a <b>threat model</b>: who might want your information, what would they do with it, and how much effort are you willing to spend stopping them? A stranger skimming ad data is a different problem from someone you live with.</p>
<ul><li><b>Tracking</b>: sites follow you with cookies, logins and <i>browser fingerprinting</i> (screen size, fonts, plug-ins). Use tracking protection, block third-party cookies, and separate browser profiles for separate parts of life.</li>
<li><b>VPNs</b> hide your traffic from the local network and your ISP, and your address from sites, but you are trusting the VPN company instead. They do not stop you being tracked by logins or cookies, and they do not make you anonymous.</li>
<li><b>Tor Browser</b> routes through three relays for stronger anonymity, at the cost of speed.</li>
<li><b>Metadata</b> is revealing: who you talk to and when, photo locations, document authors.</li>
<li><b>App permissions</b>: does that flashlight app really need your contacts?</li>
<li><b>Encrypted messaging</b> (Signal) protects message content. Disk encryption protects a lost laptop.</li></ul>
<p>Moundshroud keeps its AI, files and notes on this PC, so nothing you ask it leaves your machine.</p>` },
    { id: 'incident', cat: 'Defend', t: 'If you think you have been hacked', lv: 'Beginner', min: 5, play: [], b: `
<p>Stay calm and work through it in order. Professionals use the same steps: <b>contain, assess, remove, recover, learn</b>.</p>
<ol><li><b>Contain</b>: disconnect the device from the network (unplug or switch off Wi-Fi). Do not delete things yet.</li>
<li><b>Secure your accounts from a clean device</b>: change your email password first, then banking, then everything else. Turn on 2FA. Sign out of all sessions.</li>
<li><b>Assess</b>: what did the attacker reach? Check email forwarding rules, recovery phone numbers, connected apps, and bank statements.</li>
<li><b>Remove</b>: run Defender full and offline scans; uninstall anything unfamiliar; if unsure, the safest cure is a clean Windows reinstall.</li>
<li><b>Recover</b>: restore files from a backup you know pre-dates the problem.</li>
<li><b>Report and learn</b>: tell your bank if money is involved, report phishing, and note how it happened so it does not happen again.</li></ol>
<p>Check whether your email appears in a known breach at haveibeenpwned.com (use another device with internet).</p>` },
    { id: 'path', cat: 'Grow', t: 'Learning path and building a home lab', lv: 'All levels', min: 8, play: ['terminal', 'sqldojo'], b: `
<p>A sensible order for self-teaching security:</p>
<ol><li><b>Foundations</b>: networking, Linux command line, how the web works. (Guides 2 and 3 here.)</li>
<li><b>Defence first</b>: passwords, phishing, hardening your own PC.</li>
<li><b>Practice</b>: CTFs and guided rooms: picoCTF, OverTheWire "Bandit", TryHackMe, Hack The Box.</li>
<li><b>Pick a path</b>: defence (SOC analyst, incident response), offence (penetration testing), or building (secure software).</li>
<li><b>Scripting</b>: learn Python; automate what you do by hand.</li></ol>
<h3>A safe home lab</h3>
<p>Install <b>VirtualBox</b> or Hyper-V. Make two virtual machines on a private network: one attacker (Kali Linux or Parrot) and one deliberately vulnerable target (Metasploitable, DVWA, OWASP Juice Shop). Because everything is yours and isolated from the internet, practising on it is legal and safe. Take snapshots so you can undo mistakes.</p>
<h3>Certificates (optional)</h3>
<p>CompTIA Security+ is the common entry point; others later include CySA+, eJPT, and OSCP for penetration testing. Skills and a portfolio of CTF write-ups matter as much as paper.</p>
<p>You can ask Moundshroud to explain any term or quiz you, even offline.</p>` },
  ];
  const WORDS = 'able acid army atom aunt bake bark barn beam bell bolt bone brave brick brook cabin camel candle canyon cargo cedar chair chalk charm cliff cloud clover coast comet coral crane crisp daisy delta dune eagle ember fable feather fern flint forest frost garden ginger glacier grain harbor hazel heron honey igloo island jungle kettle lantern lemon lily maple marble meadow mint mosaic nectar nickel oasis olive orbit otter paddle pebble pepper pine plume pond quartz quiver raven ribbon river saddle sage shadow silver slate spark spruce summit sunny thistle thunder timber tulip velvet violet walnut willow winter yarrow zephyr'.split(' ');
  const COMMON = ['123456', 'password', '12345678', 'qwerty', '123456789', '12345', '1234', '111111', '1234567', 'dragon', '123123', 'baseball', 'abc123', 'football', 'monkey', 'letmein', 'shadow', 'master', '666666', 'qwertyuiop', '123321', 'mustang', '1234567890', 'michael', 'iloveyou', 'password1', 'admin', 'welcome', 'login', 'princess', 'sunshine', 'trustno1', 'passw0rd', 'hunter2'];
  const human = s => { if (!isFinite(s) || s > 1e18) return 'longer than the age of the universe'; if (s < 1) return 'instantly'; const U = [[60, 'seconds'], [60, 'minutes'], [24, 'hours'], [365, 'days'], [1000, 'years'], [1000, 'thousand years'], [1000, 'million years'], [1000, 'billion years']]; let v = s, i = 0; for (; i < U.length - 1 && v >= U[i][0]; i++) v /= U[i][0]; return (v < 10 ? v.toFixed(1) : Math.round(v).toLocaleString()) + ' ' + U[i][1]; };
  const rate = pw => {
    if (!pw) return null; let pool = 0; if (/[a-z]/.test(pw)) pool += 26; if (/[A-Z]/.test(pw)) pool += 26; if (/\d/.test(pw)) pool += 10; if (/[^A-Za-z0-9]/.test(pw)) pool += 33;
    let bits = pw.length * Math.log2(pool || 1); const notes = [];
    if (COMMON.includes(pw.toLowerCase())) { bits = Math.min(bits, 8); notes.push('This is one of the most common passwords. It is tried first.'); }
    if (/^(.)\1+$/.test(pw)) { bits = Math.min(bits, 10); notes.push('Repeating one character is guessed immediately.'); }
    if (/(0123|1234|2345|3456|4567|5678|6789|abcd|bcde|cdef|qwer|asdf|zxcv)/i.test(pw)) { bits -= 12; notes.push('Keyboard or number runs are in every cracking list.'); }
    if (/(19|20)\d\d[!@#$?.]?$/.test(pw)) { bits -= 8; notes.push('Ending with a year is a very common habit.'); }
    const wd = /^[A-Z]?[a-z]{3,}(\d{1,4})[!@#$?.]?$/.exec(pw); if (wd) { bits = Math.min(bits, 17 + 3.3 * wd[1].length + (/[^A-Za-z0-9]$/.test(pw) ? 3 : 0)); notes.push('"Word + digits + symbol" is the pattern crackers try first: a dictionary word, a few digits, one symbol.'); }
    if (/^[A-Za-z]{3,9}$/.test(pw) && !COMMON.includes(pw.toLowerCase())) { bits = Math.min(bits, 24); notes.push('A single word is easy to find in a dictionary.'); }
    if (pw.length < 12) notes.push('Under 12 characters. Aim for 14+ or a passphrase.');
    const wordy = /^[a-z]{2,9}([- ][a-z]{2,9}){2,}(-\d{1,3})?$/.exec(pw);
    if (pw === lastGen) { bits = lastBits; notes.push('Made by Moundshroud from a built-in list of about ' + WORDS.length + ' words, so this counts each word as ' + Math.log2(WORDS.length).toFixed(1) + ' bits. Add more words for extra safety.'); }
    else if (wordy) { const n = pw.split(/[- ]/).filter(x => /^[a-z]+$/.test(x)).length; bits = Math.min(bits, n * 11); notes.push('Counted at about 11 bits per random word, because attackers try word combinations. Words must be chosen at random, not a quote or a lyric.'); }
    bits = Math.max(1, bits); const g = Math.pow(2, bits) / 2;
    return { bits: Math.round(bits), fast: human(g / 1e10), slow: human(g / 1e3), notes, score: bits < 30 ? 0 : bits < 45 ? 1 : bits < 60 ? 2 : bits < 80 ? 3 : 4 };
  };
  let lastGen = '', lastBits = 0;
  const passphrase = () => { const a = new Uint32Array(9); crypto.getRandomValues(a); const w = [...a].slice(0, 8).map(x => WORDS[x % WORDS.length]); lastGen = w.join('-') + '-' + String(a[8] % 100).padStart(2, '0'); lastBits = Math.round(8 * Math.log2(WORDS.length) + Math.log2(100)); return lastGen; };
  const LV = ['Very weak', 'Weak', 'Fair', 'Strong', 'Excellent'], COL = ['var(--bad)', 'var(--bad)', 'var(--warn)', 'var(--ok)', 'var(--ok)'];
  A.cyber = { rate, passphrase, GUIDES: G };
  const seen = () => { try { return JSON.parse(ls.get('cyread', '[]')); } catch (e) { return []; } };
  const mark = id => { const s = seen(); if (!s.includes(id)) { s.push(id); ls.set('cyread', JSON.stringify(s)); } };
  A.cyber.render = (b) => {
    let q = '', cat = 'All';
    const cats = ['All'].concat([...new Set(G.map(g => g.cat))]);
    const home = () => {
      const sn = seen();
      b.innerHTML = '<div class="scroll pad" style="flex:1"><h2>🛡️ Cyber Lab</h2><div class="mute small">Learn how attacks and defences really work. Guides explain the ideas; the games let you try them in safe pretend sandboxes. Everything stays on this PC.</div>' +
        '<div class="card" style="margin-top:10px;border-color:var(--warn)"><b>Ground rule</b><div class="small">Only ever test things you own or have written permission to test. Hacking other people\'s systems is a crime. This lab teaches the legal way: sandboxes, practice sites and your own computers.</div></div>' +
        '<div class="row" style="gap:8px;flex-wrap:wrap;margin:10px 0"><button class="pri" id="cygames">🕶️ Play the cyber games</button>' + (A.caps && A.caps.chef ? '<button class="ib" id="cychef">🧰 Open CyberChef (swiss-army knife)</button>' : '') + '<span class="sp"></span><span class="small mute">' + sn.length + ' of ' + G.length + ' guides read</span></div>' +
        '<div class="card"><b>🔑 Password lab</b> <span class="small mute">(checked only on this PC, never saved or sent)</span><div class="row" style="gap:8px;margin:8px 0"><input type="text" id="cypw" placeholder="Type a password to test" autocomplete="off" spellcheck="false" style="flex:1"><button class="ib" id="cygen">Make a passphrase</button></div><div id="cyres" class="small mute">Type something above. Try your usual style of password, then a 4-word passphrase.</div></div>' +
        '<div class="row" style="gap:6px;flex-wrap:wrap;margin:10px 0"><input type="text" id="cyq" placeholder="Search guides" style="max-width:220px">' + cats.map(c => '<button class="chip' + (c === cat ? ' on' : '') + '" data-c="' + esc(c) + '">' + esc(c) + '</button>').join('') + '</div><div class="mode" id="cygl"></div></div>';
      list(); wire();
    };
    const list = () => {
      const sn = seen(), f = G.filter(g => (cat === 'All' || g.cat === cat) && (!q || (g.t + ' ' + g.b).toLowerCase().includes(q.toLowerCase())));
      $('cygl').innerHTML = f.map(g => '<div class="card" data-g="' + g.id + '" style="cursor:pointer"><b>' + (sn.includes(g.id) ? '✓ ' : '') + esc(g.t) + '</b><div class="small mute">' + esc(g.cat) + ' &middot; ' + g.lv + ' &middot; ' + g.min + ' min</div></div>').join('') || '<div class="mute small">No guides match.</div>';
    };
    const wire = () => {
      $('cygames').onclick = () => A.play.open('cyber'); if ($('cychef')) $('cychef').onclick = () => A.tools.go('chef');
      $('cyq').oninput = e => { q = e.target.value; list(); };
      b.querySelectorAll('[data-c]').forEach(x => x.onclick = () => { cat = x.dataset.c; b.querySelectorAll('[data-c]').forEach(y => y.classList.toggle('on', y === x)); list(); });
      $('cygl').onclick = e => { const c = e.target.closest('[data-g]'); if (c) read(c.dataset.g); };
      const upd = () => { const r = rate($('cypw').value), o = $('cyres'); if (!r) { o.className = 'small mute'; o.textContent = 'Type something above.'; return; } o.className = 'small'; o.innerHTML = '<div class="row" style="gap:8px;align-items:center"><div style="flex:1;height:8px;border-radius:6px;background:var(--line);overflow:hidden"><div style="width:' + (r.score + 1) * 20 + '%;height:100%;background:' + COL[r.score] + ';transition:width .3s"></div></div><b style="color:' + COL[r.score] + '">' + LV[r.score] + '</b></div><div style="margin-top:6px">About <b>' + r.bits + ' bits</b>. A fast offline attack (10 billion guesses a second) would take <b>' + r.fast + '</b>. An online login with limits (1,000 a second): <b>' + r.slow + '</b>.</div>' + r.notes.map(n => '<div class="mute">&bull; ' + esc(n) + '</div>').join(''); };
      $('cypw').oninput = upd; $('cygen').onclick = () => { $('cypw').value = passphrase(); upd(); };
    };
    const read = id => {
      const g = G.find(x => x.id === id); mark(id);
      const games = (g.play || []).map(p => A.play.games[p] ? '<button class="ib" data-p="' + p + '">' + A.play.games[p].icon + ' Practise: ' + esc(A.play.games[p].name) + '</button>' : '').join('');
      b.innerHTML = '<div class="scroll pad" style="flex:1;max-width:820px"><div class="row" style="gap:8px;margin-bottom:8px"><button class="ib" id="cyback">&larr; All guides</button><span class="sp"></span><span class="badge">' + g.lv + '</span><span class="badge">' + g.min + ' min</span></div><h2 style="font-size:20px">' + esc(g.t) + '</h2><div class="cybody" style="line-height:1.65">' + g.b + '</div><div class="row" style="gap:8px;flex-wrap:wrap;margin-top:14px">' + games + (g.chef && A.caps && A.caps.chef ? '<button class="ib" id="cychef2">🧰 Open CyberChef</button>' : '') + '<button class="ib" id="cyask">💬 Ask Moundshroud about this</button></div></div>';
      $('cyback').onclick = home; b.querySelectorAll('[data-p]').forEach(x => x.onclick = () => { A.play.open('cyber', x.dataset.p); });
      if ($('cychef2')) $('cychef2').onclick = () => A.tools.go('chef');
      $('cyask').onclick = () => { A.showTab('chat'); const i = $('in'); if (i) { i.value = 'Explain this security topic in simple terms and quiz me with 3 questions: ' + g.t; i.focus(); } };
      b.querySelector('.scroll').scrollTop = 0;
    };
    home();
  };
})();

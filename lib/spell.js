// Offline spell checker for the app-wide right-click "Fix spelling" action.
// Uses the same local CMU Pronouncing Dictionary (data/cmudict.dict, ~135,000 words) as the rhyme finder,
// so it needs no network and no third-party service. Suggestions are edit-distance matches.
const fs = require('fs'), path = require('path');
const FILE = path.join(__dirname, '..', 'data', 'cmudict.dict');
let words = null, buckets = null;

/* words that are correct here but are not everyday dictionary entries (tool names, contractions, commands) */
const EXTRA = new Set((
  "i'm i've i'll i'd you're you've you'll you'd he's she's it's we're we've we'll we'd they're they've they'll they'd " +
  "don't doesn't didn't isn't aren't wasn't weren't haven't hasn't hadn't won't wouldn't can't couldn't shouldn't " +
  "that's there's here's what's who's let's who've would've could've should've y'all " +
  "ok okay app apps mcode moundshroud repo config sudo powershell cmd bash grep awk sed ssh scp api apis cli json " +
  "html css svg png jpg jpeg gif pdf url urls ui ux id ids ip ips dns tcp udp http https ftp smtp ssh ls cd pwd rm " +
  "mkdir rmdir chmod chown ln cat head tail less more find tree stat file strings touch cp mv tee wc sort uniq cut " +
  "tr nl tac rev paste diff comm fold echo printf xargs base64 xxd hex rot13 md5sum sha1sum sha256sum cksum tar " +
  "gzip gunzip zcat zip unzip ps top htop pgrep kill pkill df du free lsblk mount lscpu nproc uname hostname " +
  "hostnamectl arch uptime whoami groups who w last users env printenv export unset alias unalias type which man " +
  "history date cal seq expr bc test basename dirname mktemp systemctl service journalctl dmesg crontab curl wget " +
  "ping rsync nmap nc ss netstat ifconfig route arp dig nslookup whois traceroute openssl iptables ufw clear cls " +
  "reset exit docker kubectl git npm node python py js ts yaml toml xml sql csv tsv utf ascii unicode utf8 " +
  "filename folder dropdown checkbox tooltip plugin login logout email username password webpage website online " +
  "offline internet wifi bluetooth laptop desktop smartphone screenshot fullscreen powershell javascript typescript " +
  "github localhost browser keydown keyup onclick jsonl markdown backend frontend database tooltip dropdown checkbox " +
  "iframe canvas pixel pixelated webview textarea contenteditable moundshroud"
).split(/\s+/).filter(Boolean));

function load() {
  if (words) return words;
  if (!fs.existsSync(FILE)) return (words = new Set(), buckets = new Map(), words);
  const set = new Set();
  for (const line of fs.readFileSync(FILE, 'utf8').split('\n')) {
    const i = line.indexOf(' ');
    if (i < 1) continue;
    const word = line.slice(0, i).replace(/\(\d+\)$/, '').toLowerCase();
    if (/^[a-z][a-z'-]*$/.test(word)) set.add(word);
  }
  for (const word of EXTRA) set.add(word);
  words = set;
  /* same first letter and similar length: a small enough pool to check a misspelling against */
  buckets = new Map();
  for (const word of set) {
    const key = word[0] + ':' + word.length;
    if (!buckets.has(key)) buckets.set(key, []);
    buckets.get(key).push(word);
  }
  return words;
}

/* Damerau-Levenshtein distance, stopping once it is clearly too far to matter */
function distance(a, b, cap) {
  if (a === b) return 0;
  if (Math.abs(a.length - b.length) > cap) return cap + 1;
  const al = a.length, bl = b.length;
  let twoBack = null, prev = new Array(bl + 1);
  for (let j = 0; j <= bl; j++) prev[j] = j;
  for (let i = 1; i <= al; i++) {
    const row = new Array(bl + 1);
    row[0] = i;
    let best = i;
    for (let j = 1; j <= bl; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      let value = Math.min(prev[j] + 1, row[j - 1] + 1, prev[j - 1] + cost);
      /* a swapped pair ("teh" for "the") counts as one mistake, not two */
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) value = Math.min(value, twoBack[j - 2] + 1);
      row[j] = value;
      if (value < best) best = value;
    }
    if (best > cap) return cap + 1;
    twoBack = prev;
    prev = row;
  }
  return prev[bl];
}

/* the words people type most: when two corrections are equally close, the everyday word wins ("teh" → "the") */
const COMMON = new Map(('the be to of and a in that have it for not on with he as you do at this but his by from they we say her she or an will my one all would there their what so up out if about who get which go me when make can like time no just him know take people into year your good some could them see other than then now look only come its over think also back after use two how our work first well way even new want because any these give day most us is are was were been has had did does said made find here thing many much more very should may need feel three between both under never same another while last might great old long little own right still every word place home read hand high such keep part against why let where help through before called again off away something thought put each once though water without house point small large add end ask went men show those being too mean tell set play land must big follow act change light kind picture try animal mother world near build self earth father spell sentence compute file folder command type press enter help').split(/\s+/).map((word, i) => [word, i]));

function suggest(word, limit) {
  load();
  if (!buckets || !word) return [];
  const cap = word.length <= 4 ? 1 : 2;
  const seen = new Set();
  const scored = [];
  const letters = /^[a-z]/.test(word[0]) ? [word[0]] : [];
  for (const first of letters) {
    for (let length = Math.max(1, word.length - 2); length <= word.length + 2; length++) {
      const list = buckets.get(first + ':' + length);
      if (!list) continue;
      for (const candidate of list) {
        if (candidate === word || seen.has(candidate)) continue;
        seen.add(candidate);
        const d = distance(word, candidate, cap);
        if (d <= cap) scored.push({ word: candidate, d, rank: COMMON.has(candidate) ? COMMON.get(candidate) : 9999 });
      }
    }
  }
  scored.sort((a, b) => a.d - b.d || a.rank - b.rank || a.word.length - b.word.length || a.word.localeCompare(b.word));
  return scored.slice(0, limit || 4).map(item => item.word);
}

function check(text) {
  const source = String(text == null ? '' : text).slice(0, 100000);
  load();
  const issues = [];
  let checked = 0;
  const re = /[A-Za-z][A-Za-z'’-]*/g;
  let match;
  while ((match = re.exec(source))) {
    const raw = match[0];
    const start = match.index;
    const word = raw.toLowerCase().replace(/[’]/g, "'").replace(/^[-']+|[-']+$/g, '');
    if (word.length < 3 || checked > 4000 || issues.length >= 60) continue;
    /* acronyms, file names, URLs, paths, snake_case and code identifiers are not spelling mistakes */
    const before = source[start - 1] || '', after = source[start + raw.length] || '', after2 = source[start + raw.length + 1] || '';
    if (/[A-Z]/.test(raw[0]) && raw === raw.toUpperCase()) continue;
    if (/[/\\._@:=#$%&*+~<>|]/.test(before) || (after && /[/\\_@:=#$%&*+~<>|]/.test(after))) continue;
    if (after === '.' && /[A-Za-z0-9]/.test(after2)) continue;
    if (/_|\d/.test(raw) || word.includes("'") && !words.has(word)) continue;
    checked++;
    if (words.has(word)) continue;
    issues.push({ word: raw, start, end: start + raw.length, suggestions: suggest(word) });
  }
  return { ok: true, issues, checked };
}

module.exports = { check, suggest, available: () => fs.existsSync(FILE) };

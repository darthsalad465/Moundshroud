// Cyber > 🔓 Password cracker: recover a password from a hash you already have — your own old accounts, a practice
// hash from a course or a CTF, or a password you forgot. Everything runs in this tab on this PC: no network, no
// upload, no login forms. It works by trying a wordlist and simple patterns (and, if you ask, every short combination)
// against the hash until one matches, which is exactly what the tools on GitHub (hashcat, John the Ripper) do.
(() => {
  const esc = t => String(t == null ? '' : t).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const nb = n => Number(n).toLocaleString('en-US');
  const utf8 = s => new TextEncoder().encode(s);
  const hexOf = arr => arr.map(b => ('0' + (b & 255).toString(16)).slice(-2)).join('');
  const beHex = words => words.map(w => ('00000000' + (w >>> 0).toString(16)).slice(-8)).join('');
  const leHex = words => words.map(w => hexOf([(w >>> 0) & 255, (w >>> 8) & 255, (w >>> 16) & 255, (w >>> 24) & 255])).join('');
  const pad = (msg, littleEndian) => {
    const len = msg.length, total = (((len + 8) >>> 6) + 1) << 6;
    const b = new Uint8Array(total); b.set(msg); b[len] = 0x80;
    const dv = new DataView(b.buffer), bitsHi = Math.floor(len / 536870912), bitsLo = (len << 3) >>> 0;
    if (littleEndian) { dv.setUint32(total - 8, bitsLo, true); dv.setUint32(total - 4, bitsHi, true); }
    else { dv.setUint32(total - 8, bitsHi); dv.setUint32(total - 4, bitsLo); }
    return b;
  };
  const rol = (x, n) => ((x << n) | (x >>> (32 - n))) >>> 0;      // SHA-1 and MD4 turn bits left
  const ror = (x, n) => ((x >>> n) | (x << (32 - n))) >>> 0;      // SHA-256 turns bits right

  /* ---------- the four hashes passwords are usually stored with (plain functions, so the tests can check them) ---------- */
  const MD5_S = [7, 12, 17, 22, 7, 12, 17, 22, 7, 12, 17, 22, 7, 12, 17, 22, 5, 9, 14, 20, 5, 9, 14, 20, 5, 9, 14, 20, 5, 9, 14, 20, 4, 11, 16, 23, 4, 11, 16, 23, 4, 11, 16, 23, 4, 11, 16, 23, 6, 10, 15, 21, 6, 10, 15, 21, 6, 10, 15, 21, 6, 10, 15, 21];
  const MD5_K = (() => { const k = new Uint32Array(64); for (let i = 0; i < 64; i++) k[i] = Math.floor(Math.abs(Math.sin(i + 1)) * 4294967296); return k; })();
  function md5(input) {
    const msg = typeof input === 'string' ? utf8(input) : input, b = pad(msg, true), dv = new DataView(b.buffer);
    let a = 0x67452301, bb = 0xefcdab89, c = 0x98badcfe, d = 0x10325476;
    const M = new Uint32Array(16);
    for (let off = 0; off < b.length; off += 64) {
      for (let i = 0; i < 16; i++) M[i] = dv.getUint32(off + i * 4, true);
      let A = a, B = bb, C = c, D = d;
      for (let i = 0; i < 64; i++) {
        let f, g;
        if (i < 16) { f = (B & C) | (~B & D); g = i; }
        else if (i < 32) { f = (D & B) | (~D & C); g = (5 * i + 1) % 16; }
        else if (i < 48) { f = B ^ C ^ D; g = (3 * i + 5) % 16; }
        else { f = C ^ (B | ~D); g = (7 * i) % 16; }
        const tmp = D; D = C; C = B;
        const x = (A + f + MD5_K[i] + M[g]) | 0;
        B = (B + rol(x, MD5_S[i])) | 0; A = tmp;
      }
      a = (a + A) | 0; bb = (bb + B) | 0; c = (c + C) | 0; d = (d + D) | 0;
    }
    return leHex([a, bb, c, d]);
  }
  /* MD4 is what Windows uses for a password hash (NTLM is MD4 of the password in UTF-16) */
  function md4(input) {
    const msg = typeof input === 'string' ? utf8(input) : input, b = pad(msg, true), dv = new DataView(b.buffer);
    let a = 0x67452301, bb = 0xefcdab89, c = 0x98badcfe, d = 0x10325476;
    const F = (x, y, z) => (x & y) | (~x & z), G = (x, y, z) => (x & y) | (x & z) | (y & z), H = (x, y, z) => x ^ y ^ z;
    const X = new Uint32Array(16);
    for (let off = 0; off < b.length; off += 64) {
      for (let i = 0; i < 16; i++) X[i] = dv.getUint32(off + i * 4, true);
      const oa = a, ob = bb, oc = c, od = d;
      const r = (v, s) => rol(v, s);
      for (let i = 0; i < 16; i++) {
        const s = [3, 7, 11, 19][i & 3], k = i;
        if ((i & 3) === 0) a = r((a + F(bb, c, d) + X[k]) | 0, s);
        else if ((i & 3) === 1) d = r((d + F(a, bb, c) + X[k]) | 0, s);
        else if ((i & 3) === 2) c = r((c + F(d, a, bb) + X[k]) | 0, s);
        else bb = r((bb + F(c, d, a) + X[k]) | 0, s);
      }
      const order2 = [0, 4, 8, 12, 1, 5, 9, 13, 2, 6, 10, 14, 3, 7, 11, 15];
      for (let i = 0; i < 16; i++) {
        const s = [3, 5, 9, 13][i & 3], use = order2[i];
        if ((i & 3) === 0) a = r((a + G(bb, c, d) + X[use] + 0x5a827999) | 0, s);
        else if ((i & 3) === 1) d = r((d + G(a, bb, c) + X[use] + 0x5a827999) | 0, s);
        else if ((i & 3) === 2) c = r((c + G(d, a, bb) + X[use] + 0x5a827999) | 0, s);
        else bb = r((bb + G(c, d, a) + X[use] + 0x5a827999) | 0, s);
      }
      const order3 = [0, 8, 4, 12, 2, 10, 6, 14, 1, 9, 5, 13, 3, 11, 7, 15];
      for (let i = 0; i < 16; i++) {
        const s = [3, 9, 11, 15][i & 3], use = order3[i];
        if ((i & 3) === 0) a = r((a + H(bb, c, d) + X[use] + 0x6ed9eba1) | 0, s);
        else if ((i & 3) === 1) d = r((d + H(a, bb, c) + X[use] + 0x6ed9eba1) | 0, s);
        else if ((i & 3) === 2) c = r((c + H(d, a, bb) + X[use] + 0x6ed9eba1) | 0, s);
        else bb = r((bb + H(c, d, a) + X[use] + 0x6ed9eba1) | 0, s);
      }
      a = (a + oa) | 0; bb = (bb + ob) | 0; c = (c + oc) | 0; d = (d + od) | 0;
    }
    return leHex([a, bb, c, d]);
  }
  const ntlm = s => { const src = utf8(s), b = new Uint8Array(src.length * 2); for (let i = 0; i < src.length; i++) b[i * 2] = src[i]; return md4(b); };

  function sha1(input) {
    const msg = typeof input === 'string' ? utf8(input) : input, b = pad(msg, false), dv = new DataView(b.buffer);
    const w = new Uint32Array(80);
    let h0 = 0x67452301, h1 = 0xefcdab89, h2 = 0x98badcfe, h3 = 0x10325476, h4 = 0xc3d2e1f0;
    for (let off = 0; off < b.length; off += 64) {
      for (let i = 0; i < 16; i++) w[i] = dv.getUint32(off + i * 4);
      for (let i = 16; i < 80; i++) w[i] = rol(w[i - 3] ^ w[i - 8] ^ w[i - 14] ^ w[i - 16], 1);
      let a = h0, bb = h1, c = h2, d = h3, e = h4;
      for (let i = 0; i < 80; i++) {
        let f, k;
        if (i < 20) { f = (bb & c) | (~bb & d); k = 0x5a827999; }
        else if (i < 40) { f = bb ^ c ^ d; k = 0x6ed9eba1; }
        else if (i < 60) { f = (bb & c) | (bb & d) | (c & d); k = 0x8f1bbcdc; }
        else { f = bb ^ c ^ d; k = 0xca62c1d6; }
        const t = (rol(a, 5) + f + e + k + w[i]) | 0;
        e = d; d = c; c = rol(bb, 30); bb = a; a = t;
      }
      h0 = (h0 + a) | 0; h1 = (h1 + bb) | 0; h2 = (h2 + c) | 0; h3 = (h3 + d) | 0; h4 = (h4 + e) | 0;
    }
    return beHex([h0, h1, h2, h3, h4]);
  }
  const SHA256_K = new Uint32Array([0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5, 0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174, 0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da, 0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967, 0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85, 0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070, 0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3, 0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2]);
  function sha256(input) {
    const msg = typeof input === 'string' ? utf8(input) : input, b = pad(msg, false), dv = new DataView(b.buffer);
    const w = new Uint32Array(64);
    let h0 = 0x6a09e667, h1 = 0xbb67ae85, h2 = 0x3c6ef372, h3 = 0xa54ff53a, h4 = 0x510e527f, h5 = 0x9b05688c, h6 = 0x1f83d9ab, h7 = 0x5be0cd19;
    for (let off = 0; off < b.length; off += 64) {
      for (let i = 0; i < 16; i++) w[i] = dv.getUint32(off + i * 4);
      for (let i = 16; i < 64; i++) {
        const s0 = (ror(w[i - 15], 7) ^ ror(w[i - 15], 18) ^ (w[i - 15] >>> 3)), s1 = (ror(w[i - 2], 17) ^ ror(w[i - 2], 19) ^ (w[i - 2] >>> 10));
        w[i] = (w[i - 16] + s0 + w[i - 7] + s1) | 0;
      }
      let a = h0, bb = h1, c = h2, d = h3, e = h4, f = h5, g = h6, h = h7;
      for (let i = 0; i < 64; i++) {
        const S1 = ror(e, 6) ^ ror(e, 11) ^ ror(e, 25), ch = (e & f) ^ (~e & g), t1 = (h + S1 + ch + SHA256_K[i] + w[i]) | 0;
        const S0 = ror(a, 2) ^ ror(a, 13) ^ ror(a, 22), mj = (a & bb) ^ (a & c) ^ (bb & c), t2 = (S0 + mj) | 0;
        h = g; g = f; f = e; e = (d + t1) | 0; d = c; c = bb; bb = a; a = (t1 + t2) | 0;
      }
      h0 = (h0 + a) | 0; h1 = (h1 + bb) | 0; h2 = (h2 + c) | 0; h3 = (h3 + d) | 0; h4 = (h4 + e) | 0; h5 = (h5 + f) | 0; h6 = (h6 + g) | 0; h7 = (h7 + h) | 0;
    }
    return beHex([h0, h1, h2, h3, h4, h5, h6, h7]);
  }

  const ALGOS = {
    md5: { label: 'MD5 (32 hex)', len: 32, fn: md5, note: 'Old web forums, game saves, some routers. The most common hash you will meet in a course.' },
    ntlm: { label: 'Windows / NTLM (32 hex)', len: 32, fn: ntlm, note: 'What Windows stores for a local or domain account password.' },
    sha1: { label: 'SHA-1 (40 hex)', len: 40, fn: sha1, note: 'Older web sites, Git commit ids, leaked password dumps.' },
    sha256: { label: 'SHA-256 (64 hex)', len: 64, fn: sha256, note: 'Modern sites and Linux systems that store a plain hash.' },
    sha512: { label: 'SHA-512 (128 hex)', len: 128, fn: null, note: 'Checked with the browser’s own crypto: slower, so use a wordlist rather than every combination.' }
  };
  const detect = h => { const s = String(h || '').trim().replace(/^\$?\w+\$/, '').replace(/[^0-9a-fA-F]/g, ''); const n = s.length; return n === 32 ? 'md5' : n === 40 ? 'sha1' : n === 64 ? 'sha256' : n === 128 ? 'sha512' : ''; };

  /* the short list of passwords that covers most real ones; the user can add their own words or a .txt file */
  const WORDS = ('123456 password 12345678 qwerty 123456789 12345 1234 111111 1234567 dragon 123123 baseball abc123 football monkey letmein 696969 shadow master 666666 qwertyuiop 123321 mustang 1234567890 michael 654321 pussy superman 1qaz2wsx 7777777 fuckyou 121212 000000 qazwsx 123qwe killer trustno1 jordan jennifer zxcvbnm asdfgh hunter buster soccer harley batman andrew tigger sunshine iloveyou fuckme 2000 charlie robert thomas hockey ranger daniel starwars klaster 112233 george asshole computer michelle jessica pepper 1111 zxcvbn 555555 11111111 131313 freedom 777777 pass fuck 1234qwer maggie 159753 aaaaaa ginger princess joshua cheese amanda summer love ashley 6969 nicole chelsea biteme matthew access yankees 987654321 dallas austin thunder taylor matrix mobilemail mom monitor monitoring montana moon moscow')
    .split(' ');

  /* the simple patterns people really put on the end of a word — the same idea as hashcat's rules */
  function rulesOf(w, opts) {
    const out = [w], o = opts || {};
    if (o.case !== false) { const lo = w.toLowerCase(), cap = lo.charAt(0).toUpperCase() + lo.slice(1); out.push(lo, cap, w.toUpperCase()); }
    if (o.digits !== false) { for (let i = 0; i <= 9; i++) { out.push(w + i); out.push(w.charAt(0).toUpperCase() + w.slice(1) + i); } out.push(w + '12', w + '123', w + '1234', w + '2024', w + '2025', w + '2026'); }
    if (o.symbols !== false) { out.push(w + '!', w + '@', w + '#', w + '!1', w.charAt(0).toUpperCase() + w.slice(1) + '!'); }
    if (o.leet !== false) {
      const maps = [['a', '4'], ['e', '3'], ['i', '1'], ['o', '0'], ['s', '5']];
      let l = w.toLowerCase(); for (const [a, b] of maps) l = l.split(a).join(b);
      out.push(l); out.push(l.charAt(0).toUpperCase() + l.slice(1));
    }
    return out;
  }

  /* ---------- the page ---------- */
  const CSS = `.crk-in{width:100%;box-sizing:border-box;font:13px/1.5 Consolas,"Cascadia Mono",monospace;padding:8px 10px;border:1px solid var(--line);border-radius:8px;background:var(--panel2);color:var(--text)}
.crk-row{display:flex;gap:8px;flex-wrap:wrap;align-items:center;margin:8px 0}
.crk-row label{font-size:12.5px;color:var(--mute);display:flex;gap:5px;align-items:center;cursor:pointer}
.crk-bar{height:10px;border-radius:6px;background:var(--panel2);border:1px solid var(--line);overflow:hidden;margin:10px 0}
.crk-bar div{height:100%;width:0;background:linear-gradient(90deg,var(--acc,#7c5cff),var(--acc2,#22d3ee));transition:width .12s}
.crk-found{border:1px solid var(--ok,#30a46c);background:rgba(48,164,108,.10);border-radius:10px;padding:10px 12px;margin:10px 0}
.crk-found b{font-family:Consolas,"Cascadia Mono",monospace;font-size:15px}
.crk-kv{display:grid;grid-template-columns:auto 1fr;gap:3px 14px;font-size:13px;margin:8px 0}.crk-kv b{color:var(--mute);font-weight:600}
.crk-bad{color:var(--bad,#e5484d)}.crk-mute{color:var(--mute)}`;
  const inject = () => { if (!document.getElementById('cybercrack-css')) { const s = document.createElement('style'); s.id = 'cybercrack-css'; s.textContent = CSS; document.head.appendChild(s); } };
  const wrap = (el, inner) => { el.innerHTML = '<div class="lab"><div class="lab-wrap" style="max-width:900px">' + inner + '</div></div>'; return el.querySelector('.lab-wrap'); };
  const MAX_TRIES = 50e6;

  function crack(el) {
    inject();
    const w = wrap(el,
      '<h2>🔓 Password cracker (hash recovery)</h2>' +
      '<div class="sub">Paste a <b>hash</b> you already have — your own old account, a practice hash from a course or a CTF, or a password you have forgotten — and Moundshroud tries to find the password behind it. It runs entirely on this PC: no network, no login page, no other computer is touched.<br><br>' +
      '<b>What a hash is:</b> sites do not store your password, they store a fingerprint of it (MD5, SHA-1, SHA-256 or Windows NTLM). You cannot turn a fingerprint back into a password, so the only way back is to guess a word, fingerprint the guess, and see if the two fingerprints match. That is all this page does — and it is exactly what <b>hashcat</b> and <b>John the Ripper</b> do, just without the graphics card.</div>' +
      '<label class="crk-mute" style="font-size:12.5px">The hash</label><input class="crk-in" id="crk-hash" placeholder="5f4dcc3b5aa765d61d8327deb882cf99" spellcheck="false" autocomplete="off">' +
      '<div class="crk-row"><span class="crk-mute" style="font-size:12.5px">Type:</span><select id="crk-algo" class="crk-in" style="width:auto;padding:5px 8px">' +
      Object.keys(ALGOS).map(k => '<option value="' + k + '">' + esc(ALGOS[k].label) + '</option>').join('') + '</select><span class="small crk-mute" id="crk-note"></span></div>' +
      '<div class="crk-row"><span class="crk-mute" style="font-size:12.5px">Salt (optional):</span><input class="crk-in" id="crk-salt" placeholder="leave empty if none" style="width:200px" spellcheck="false"><select id="crk-saltpos" class="crk-in" style="width:auto;padding:5px 8px"><option value="after">salt after the password</option><option value="before">salt before the password</option></select></div>' +
      '<div class="crk-row" style="gap:14px;border-top:1px solid var(--line);padding-top:10px"><label><input type="radio" name="crk-mode" value="dict" checked> Try a wordlist and patterns</label><label><input type="radio" name="crk-mode" value="mask"> Try every short combination</label></div>' +
      '<div id="crk-dict"><div class="crk-row"><label><input type="checkbox" id="crk-builtin" checked> The built-in list of ' + WORDS.length + ' common passwords</label><label><input type="checkbox" id="crk-digits" checked> add 0–9 and 12/123/1234 on the end</label><label><input type="checkbox" id="crk-symbols" checked> add ! @ # on the end</label><label><input type="checkbox" id="crk-leet" checked> leet-speak (p4ssw0rd)</label><label><input type="checkbox" id="crk-caps" checked> lowercase / Capitalised / UPPER</label></div>' +
      '<label class="crk-mute" style="font-size:12.5px">Your own words (one per line, or paste a whole list)</label><textarea id="crk-words" class="crk-in" rows="4" spellcheck="false" placeholder="sam\nfluffy\nbirthday 1994"></textarea>' +
      '<div class="crk-row"><button class="ib2" id="crk-load">📂 Load a .txt wordlist</button><input type="file" id="crk-file" accept=".txt,.lst,.dic,text/plain" style="display:none"><span class="small crk-mute" id="crk-count"></span></div></div>' +
      '<div id="crk-mask" style="display:none"><div class="crk-row"><label>Characters: <select id="crk-charset" class="crk-in" style="width:auto;padding:5px 8px"><option value="0123456789">digits 0–9</option><option value="abcdefghijklmnopqrstuvwxyz">a–z</option><option value="abcdefghijklmnopqrstuvwxyz0123456789">a–z and 0–9</option><option value="abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789">letters and digits</option></select></label>' +
      '<label>Shortest <input id="crk-min" type="number" min="1" max="10" value="1" class="crk-in" style="width:64px;padding:4px 6px"></label><label>Longest <input id="crk-max" type="number" min="1" max="10" value="6" class="crk-in" style="width:64px;padding:4px 6px"></label>' +
      '<span class="small crk-mute" id="crk-space"></span></div></div>' +
      '<div class="crk-row" style="margin-top:12px"><button class="btn" id="crk-go">▶ Start cracking</button><button class="ib2" id="crk-stop" disabled>■ Stop</button><span class="small crk-mute" id="crk-status"></span></div>' +
      '<div class="crk-bar"><div id="crk-fill"></div></div><div id="crk-out"></div>' +
      '<div class="note" style="margin-top:10px">Keep this page in front while it runs: browsers deliberately slow down work in a tab you switch away from, so the guesses crawl until you come back.</div>' +
      '<div class="note" style="margin-top:6px"><b>Only hashes you are allowed to crack:</b> your own accounts, your own files, a course exercise, or a CTF you signed up for. Breaking into someone else’s account with this is a crime, and this tool never contacts anything anyway — it only does arithmetic on the text you paste.</div>');

    const $ = s => w.querySelector(s);
    const hashIn = $('#crk-hash'), algoSel = $('#crk-algo'), note = $('#crk-note'), out = $('#crk-out'), status = $('#crk-status'), fill = $('#crk-fill');
    const stopBtn = $('#crk-stop'), goBtn = $('#crk-go');
    let stopFlag = false, running = false;

    const targetOf = () => String(hashIn.value || '').trim().replace(/[^0-9a-fA-F]/g, '').toLowerCase();
    const syncAlgo = () => { const a = algoSel.value; return ALGOS[a].fn ? a : ''; };
    const apply = p => { const s = $('#crk-salt').value; if (!s) return p; return $('#crk-saltpos').value === 'before' ? s + p : p + s; };
    const hashOf = async (a, p) => {
      const input = apply(p);
      if (ALGOS[a].fn) return ALGOS[a].fn(input);
      const buf = await crypto.subtle.digest('SHA-512', utf8(input));
      return hexOf([...new Uint8Array(buf)]);
    };

    function refreshNote() {
      const h = targetOf(), d = detect(h);
      note.textContent = h ? (d ? 'looks like a ' + ALGOS[d].label + ' hash' : 'that does not look like a hex hash (' + h.length + ' characters)') : '';
      if (d && !algoSel.dataset.manual) algoSel.value = d;
      $('#crk-algo').parentElement.querySelector('span').textContent = '';
      if (!ALGOS[algoSel.value].fn) $('#crk-algo').parentElement.querySelector('span').textContent = ALGOS[algoSel.value].note;
    }
    hashIn.oninput = refreshNote; algoSel.onchange = () => { algoSel.dataset.manual = '1'; refreshNote(); };
    $('#crk-load').onclick = () => $('#crk-file').click();
    $('#crk-file').onchange = () => {
      const f = $('#crk-file').files[0]; if (!f) return;
      const fr = new FileReader(); fr.onload = () => { const ta = $('#crk-words'); ta.value = (ta.value ? ta.value.replace(/\s*$/, '\n') : '') + String(fr.result); $('#crk-count').textContent = 'loaded ' + f.name; }; fr.readAsText(f);
    };
    document.querySelectorAll('input[name="crk-mode"]').forEach(r => r.onchange = () => {
      const mask = document.querySelector('input[name="crk-mode"]:checked').value === 'mask';
      $('#crk-dict').style.display = mask ? 'none' : ''; $('#crk-mask').style.display = mask ? '' : 'none'; space();
    });
    const space = () => {
      const cs = $('#crk-charset').value.length, lo = +$('#crk-min').value || 1, hi = +$('#crk-max').value || 1, span = Math.max(lo, 1);
      let n = 0; for (let l = span; l <= Math.max(lo, hi); l++) n += Math.pow(cs, l);
      $('#crk-space').textContent = n > 1e9 ? nb(n) + ' combinations (very long)' : nb(n) + ' combinations';
    };
    $('#crk-charset').onchange = space; $('#crk-min').oninput = space; $('#crk-max').oninput = space; space();
    refreshNote();

    const say = (t, bad) => { status.innerHTML = bad ? '<span class="crk-bad">' + esc(t) + '</span>' : esc(t); };
    const found = (password, tries, ms) => {
      out.innerHTML = '<div class="crk-found">✅ <b>The password is:</b> <b style="font-size:18px">' + esc(password) + '</b></div>' +
        '<div class="crk-kv"><b>Tried</b><span>' + nb(tries) + ' guesses</span><b>Time</b><span>' + (ms / 1000).toFixed(1) + ' seconds</span><b>Speed</b><span>' + nb(Math.round(tries / Math.max(ms / 1000, 0.001))) + ' guesses a second</span><b>Type</b><span>' + esc(ALGOS[algoSel.value].label) + '</span></div>' +
        '<div class="note">Same password, hashed again: <span style="font-family:monospace">' + esc(targetOf()) + '</span>. <b>What to do now:</b> sign in to that account with it and change it to something long and unique (a passphrase of 4–5 random words beats a short complicated one), then turn on two-step sign-in.</div>';
    };

    async function run() {
      if (running) return;
      const hash = targetOf(), algo = algoSel.value;
      if (!hash) return say('Paste the hash you want to crack first.', true);
      if (!/^[0-9a-f]+$/.test(hash)) return say('A hash is hex characters only (0–9 and a–f).', true);
      if (hash.length !== ALGOS[algo].len) return say('A ' + ALGOS[algo].label + ' hash is ' + ALGOS[algo].len + ' hex characters; this one has ' + hash.length + '. Pick the type above.', true);
      if (!ALGOS[algo].fn && !(window.crypto && crypto.subtle)) return say('This browser has no SHA-512 support.', true);
      running = true; stopFlag = false; goBtn.disabled = true; stopBtn.disabled = false; out.innerHTML = ''; fill.style.width = '0%';
      const t0 = performance.now();
      let tries = 0;

      /* the four plain hashes are computed straight through, thousands a tick, and only the screen update pauses the
         loop; SHA-512 has to ask the browser each time, so it moves a few hundred guesses a tick instead */
      const syncFn = ALGOS[algo].fn, tick = () => new Promise(r => setTimeout(r, 0));
      /* read the salt once: looking it up for every guess would cost more than the hash itself */
      const saltV = $('#crk-salt').value, saltBefore = $('#crk-saltpos').value === 'before';
      const mix = saltV ? (saltBefore ? (p => saltV + p) : (p => p + saltV)) : (p => p);
      let total = 0;

      function* dictList() {
        const list = [];
        if ($('#crk-builtin').checked) list.push(...WORDS);
        list.push(...$('#crk-words').value.split(/\r?\n/).map(s => s.trim()).filter(Boolean));
        const opts = { digits: $('#crk-digits').checked, symbols: $('#crk-symbols').checked, leet: $('#crk-leet').checked, case: $('#crk-caps').checked };
        const seen = new Set();
        total = list.length * 30;
        for (const word of list) for (const cand of rulesOf(word, opts)) { if (!cand || seen.has(cand)) continue; seen.add(cand); yield cand; }
      }
      function* maskList() {
        const charset = $('#crk-charset').value, lo = Math.max(1, +$('#crk-min').value || 1), hi = Math.max(lo, +$('#crk-max').value || lo);
        total = 0; for (let l = lo; l <= hi; l++) total += Math.pow(charset.length, l);
        if (total > MAX_TRIES) { total = -1; return; }
        const idx = new Array(hi).fill(0);
        for (let len = lo; len <= hi; len++) {
          idx.length = len; idx.fill(0);
          for (;;) {
            let cand = '';
            for (let k = 0; k < len; k++) cand += charset[idx[k]];
            yield cand;
            let k = len - 1;                                        /* count up like an odometer */
            for (; k >= 0; k--) { if (++idx[k] < charset.length) break; idx[k] = 0; }
            if (k < 0) break;
          }
        }
      }

      try {
        const maskMode = document.querySelector('input[name="crk-mode"]:checked').value === 'mask';
        const it = maskMode ? maskList() : dictList();
        const first = it.next();
        if (total < 0) { say('That is too many combinations for a plain program like this (hashcat uses the graphics card for those). Shorten the length or the characters.', true); return finish(); }
        if (first.done) { say('Add some words or tick the built-in list first.', true); return finish(); }
        let cand = first.value, lastPaint = performance.now();
        /* pause for the screen after a slice of real work, not every N guesses: a few thousand hashes take a fraction
           of a tenth of a second, so a fast computer and a slow one both stay smooth. A browser slows timers right down
           in a tab that is not in front, so there the slices are longer and fewer — the search keeps its speed instead. */
        const paintEvery = () => (document.visibilityState === 'hidden' ? 1000 : (syncFn ? 100 : 50));
        for (;;) {
          if (stopFlag) break;
          tries++;
          const h = syncFn ? syncFn(mix(cand)) : await hashOf(algo, cand);
          if (h === hash) { found(cand, tries, performance.now() - t0); return finish(true); }
          if (performance.now() - lastPaint > paintEvery()) {
            lastPaint = performance.now();
            fill.style.width = (total ? Math.min(100, Math.round(100 * tries / total)) : 0) + '%';
            say(nb(tries) + (total ? ' of about ' + nb(total) : '') + ' guesses…');
            await tick();
            if (stopFlag) break;
          }
          const nx = it.next();
          if (nx.done) break;
          cand = nx.value;
        }
        if (!stopFlag) {
          fill.style.width = '100%';
          out.innerHTML = '<div class="crk-kv"><b>Not found</b><span>' + nb(tries) + ' guesses in ' + ((performance.now() - t0) / 1000).toFixed(1) + ' seconds</span></div>' +
            '<div class="note">The password is not in the words and patterns tried. Real tools would hand this to a graphics card and keep going for hours; here you can add the names, places and dates the person would actually use (their own wordlist) and try again — that catches most real passwords. A long random password will never be found this way, which is exactly why it is safe.</div>';
        } else say('Stopped after ' + nb(tries) + ' guesses.');
      } catch (e) {
        say('The cracker hit a problem: ' + e.message, true);
      } finally {
        finish();
      }
      function finish(ok) { running = false; goBtn.disabled = false; stopBtn.disabled = true; if (!ok && stopFlag) fill.style.width = '0%'; }
    }

    goBtn.onclick = run;
    stopBtn.onclick = () => { stopFlag = true; say('Stopping…'); };

    A.cyberCrack = { hashes: { md5, md4, ntlm, sha1, sha256 }, WORDS, rulesOf, run: async (hash, algo) => { const a = algo || detect(hash); if (!ALGOS[a] || !ALGOS[a].fn) return null; const t = String(hash).toLowerCase(); for (const wd of WORDS) for (const c of rulesOf(wd, {})) if (ALGOS[a].fn(c) === t) return c; return null; }, detect, algorithms: () => Object.keys(ALGOS) };
  }

  const API = { md5, md4, ntlm, sha1, sha256, detect, rulesOf, WORDS, ALGOS };
  if (typeof A !== 'undefined') { A.cyberLabs = Object.assign(A.cyberLabs || {}, { crack }); }
  if (typeof module !== 'undefined' && module.exports) module.exports = API;
})();

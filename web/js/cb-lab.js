// Tools > Code Breaker (the Cipher Lab): five difficulty levels from "just paste and press" to forensics and wordlist attacks.
// The cracking brain is codebreaker.js (the classic toolbox); the methods and attacks are in cb-ops.js. Everything runs on this PC.
// Only use these on puzzles, CTF practice and messages that are yours to read.
(() => {
  if (!A.codebreaker || !window.CBX) return;
  const X = window.CBX, ENG = () => A.codebreaker.engine, $e = esc;
  const LV = [
    { n: 'Rookie', ic: '🌱', t: 'Just paste and press. I do all the thinking.' },
    { n: 'Apprentice', ic: '🧭', t: 'See how each trick works, in plain words.' },
    { n: 'Operator', ic: '🔧', t: 'Pick the method yourself and set its options.' },
    { n: 'Hacker', ic: '💻', t: 'Chain steps like a pro, crack hashes, analyse the data.' },
    { n: 'Elite', ic: '🥷', t: 'Wordlist attacks, known-plaintext, batch jobs and file forensics.' }
  ];
  const TABS = [['crack', '🔮 Crack it', 1], ['hide', '🔐 Hide a message', 1], ['mission', '🎯 Missions', 1], ['learn', '📚 Learn', 2], ['methods', '🔧 Methods', 2], ['analyze', '📊 Analyze', 3], ['recipe', '🍳 Recipe', 4], ['hash', '#️⃣ Hashes', 4], ['elite', '🥷 Elite lab', 5], ['classic', '🧰 Classic toolbox', 3]];
  const load = () => { try { return Object.assign({ level: 1, xp: 0, solved: {}, streak: 0, best: 0, recipe: [] }, JSON.parse(ls.get('cblab', '{}'))); } catch (e) { return { level: 1, xp: 0, solved: {}, streak: 0, best: 0, recipe: [] }; } };
  const S = load(), save = () => ls.set('cblab', JSON.stringify(S));
  const toast = (t, ms) => { try { A.toast(t, ms || 3000); } catch (e) { } };
  const copy = t => navigator.clipboard.writeText(t).then(() => toast('Copied ✓'));
  const CSS = '<style>.clw{max-width:1000px}.cllv{display:flex;gap:6px;flex-wrap:wrap;margin:8px 0 4px}.cllv button{display:flex;flex-direction:column;align-items:center;gap:0;min-width:104px;padding:7px 12px;border-radius:14px;border:1px solid var(--line);background:color-mix(in srgb,var(--panel2) 70%,transparent);color:var(--mute);transition:all .2s}.cllv button b{font-size:13px;color:var(--text)}.cllv button .n{font-size:18px}.cllv button.on{border-color:var(--acc);background:linear-gradient(135deg,color-mix(in srgb,var(--acc) 22%,var(--panel)),var(--panel));box-shadow:0 8px 20px -10px var(--acc)}.cllv button:hover{border-color:color-mix(in srgb,var(--acc) 60%,var(--line))}.cltabs{display:flex;gap:6px;flex-wrap:wrap;margin:10px 0 14px}.clbig{width:100%;min-height:120px;font-family:ui-monospace,Consolas,monospace;font-size:14px}.clcard{border:1px solid var(--line);border-radius:16px;padding:14px 16px;margin:10px 0;background:color-mix(in srgb,var(--panel) 85%,transparent)}.clok{border-color:color-mix(in srgb,var(--ok) 60%,var(--line));background:linear-gradient(135deg,color-mix(in srgb,var(--ok) 12%,var(--panel)),var(--panel))}.clwarn{border-color:color-mix(in srgb,var(--warn) 55%,var(--line))}.clans{font-size:17px;line-height:1.5;word-break:break-word;font-weight:600;padding:8px 10px;border-radius:10px;background:var(--panel2);margin:6px 0;white-space:pre-wrap;font-family:ui-monospace,Consolas,monospace}.clstep{display:flex;gap:10px;margin:6px 0}.clstep i{flex:none;width:24px;height:24px;border-radius:50%;background:var(--acc);color:var(--onacc,#0a0c12);font-style:normal;font-weight:700;display:flex;align-items:center;justify-content:center;font-size:12px}.clgrid{display:grid;grid-template-columns:repeat(auto-fill,minmax(210px,1fr));gap:10px}.clopt{border:2px solid var(--line);border-radius:14px;padding:10px 12px;cursor:pointer;background:var(--panel2);transition:all .2s}.clopt.on{border-color:var(--acc);box-shadow:0 8px 22px -12px var(--acc)}.clopt b{display:block}.clmono{font-family:ui-monospace,Consolas,monospace;font-size:13px;word-break:break-all;white-space:pre-wrap}.clbar{display:flex;align-items:flex-end;gap:2px;height:80px}.clbar i{flex:1;background:linear-gradient(var(--acc2),var(--acc));border-radius:3px 3px 0 0;min-height:1px;position:relative}.clrow{display:flex;gap:8px;flex-wrap:wrap;align-items:center;margin:6px 0}.clrow label{font-size:12.5px;color:var(--mute)}.clh{font-size:12px;text-transform:uppercase;letter-spacing:.08em;color:var(--mute);margin:14px 0 4px}.clpill{display:inline-block;padding:1px 9px;border-radius:999px;font-size:11.5px;border:1px solid var(--line);color:var(--mute)}.clpill.good{color:var(--ok);border-color:var(--ok)}table.cltb{border-collapse:collapse;width:100%;font-size:13px}table.cltb td,table.cltb th{border-bottom:1px solid var(--line);padding:5px 8px;text-align:left}</style>';
  /* ---------- plain-language explanations of the steps ---------- */
  const WHY = [
    [/^Base64/i, 'Base64 writes any data using only letters, numbers, + and /. It is a format, not a secret, so it can be undone instantly.'], [/^Base32/i, 'Base32 is like Base64 but uses only capital letters and the digits 2 to 7.'], [/^Hex/i, 'Hex writes each byte as two digits (0-9 and a-f). Just a format.'], [/^Binary/i, 'Binary writes each letter as eight 0s and 1s.'],
    [/^Decimal/i, 'Each letter was written as its number code (like A = 65).'], [/^Octal/i, 'Each letter was written as a base-8 number.'], [/^URL/i, 'Web addresses write special characters as %XX. I turned them back.'], [/^Morse/i, 'Morse code uses dots and dashes for each letter.'], [/^A1Z26/i, 'Each letter was swapped for its place in the alphabet (A=1 ... Z=26).'],
    [/^ROT13/i, 'ROT13 moves each letter 13 places along the alphabet. Doing it again undoes it.'], [/^Caesar/i, 'A Caesar cipher slides every letter the same number of places along the alphabet. There are only 25 possible slides, so I tried them all and kept the one that reads as English.'],
    [/^Atbash/i, 'Atbash flips the alphabet: A becomes Z, B becomes Y, and so on.'], [/^Beaufort|^Autokey/i, 'This is a Vigenère relative that uses a key word. I tried lots of common words as the key and kept the one that reads as English.'], [/^Vigen/i, 'Vigenère uses a key word to slide each letter by a different amount. I worked out the key length from repeating patterns, then solved each position like a Caesar cipher.'],
    [/^Affine/i, 'An affine cipher multiplies each letter number by one number and adds another. There are only 312 combinations, so I tried them all.'], [/^Rail/i, 'A rail fence writes the text in a zigzag across rows. I tried different numbers of rows until it made sense.'],
    [/^Scytale/i, 'A scytale wraps a strip around a rod, which is the same as reading a grid by columns. I tried different rod widths.'], [/^Columns|^Columnar/i, 'A columnar cipher writes text in a grid and reads it by columns in a scrambled order. I tried the possible orders.'], [/^Substitution/i, 'Each letter was replaced by a different letter. I guessed using how often letters appear in English (E, T, A...) and improved it step by step.'],
    [/^XOR/i, 'XOR mixes each byte with a key. I guessed the key by looking for results that read as text.'], [/^Gzip|^Zlib|^Deflate/i, 'The data was squashed with a compression format. I unsquashed it.'], [/^Base58|^Base85|^Base45|^HTML|^\\u|^Quoted/i, 'This is another way of writing data as text. It is only a format, so it can be undone.'], [/^Bacon/i, 'Bacon\'s cipher writes each letter as five A/B symbols.']
  ];
  const why = name => { const w = WHY.find(x => x[0].test(String(name))); return w ? w[1] : 'This is a standard way of changing text. I undid it.'; };
  const stepsHtml = path => path.map((p, i) => '<div class="clstep"><i>' + (i + 1) + '</i><div><b>' + $e(p) + '</b><div class="small mute">' + $e(why(p)) + '</div></div></div>').join('') || '<div class="small mute">Nothing needed doing: it was already readable.</div>';
  const flagIn = t => { const m = String(t).match(X.FLAGS); return m ? m[0] : null; };

  /* ---------- the cracking pipeline ---------- */
  const MAGIC = [['1f8b', 'gzip'], ['789c', 'zlib'], ['7801', 'zlib'], ['78da', 'zlib']];
  async function peelBinary(s) {       // base64 / hex / base32 -> bytes that are compressed?
    const out = []; for (const id of ['base64', 'hex', 'base32', 'base85']) { let b; try { b = await X.apply(id, 'dec', s); } catch (e) { continue; } if (!b || b.length < 6) continue; const h = X.hex(b.slice(0, 2)); const m = MAGIC.find(x => x[0] === h); if (m) { try { const t = await X.apply(m[1] === 'gzip' ? 'gzip' : 'zlib', 'dec', b); out.push({ path: [X.byId[id].name, m[1] === 'gzip' ? 'Gzip' : 'Zlib'], text: X.b2txt(t) }); } catch (e) { } } }
    return out;
  }
  /* peeling layers: encodings are checked strictly, and ROT13 / Atbash / reverse are only used when they lead to a valid encoding */
  const ENC_IDS = ['base64', 'hex', 'base32', 'binary', 'decimal', 'octal', 'url', 'base58', 'base85', 'html', 'unicode', 'a1z26', 'morse', 'bacon', 'polybius', 'base62', 'bacon24'];
  const strictDec = async t => { const r = []; for (const id of ENC_IDS) { let o; try { o = await X.apply(id, 'dec', t); } catch (e) { continue; } if (typeof o !== 'string' || !o.length || o === t) continue; const txt = X.b2txt(o); if (X.printable(txt) < .9 && !MAGIC.some(m => X.hex(o.slice(0, 2)) === m[0])) continue; if (txt.length < 3) continue; r.push({ name: X.byId[id].name, text: txt, bytes: o }); } return r; };
  const TRANSFORMS = [['ROT13', t => X.caesarShift(t, 13)], ['Atbash', t => t.replace(/[a-z]/gi, ch => { const b = ch < 'a' ? 65 : 97; return String.fromCharCode(b + 25 - (ch.charCodeAt(0) - b)); })], ['Reverse', t => t.split('').reverse().join('')]];
  async function peel(start) {
    const out = [], seen = new Set([start]); let frontier = [{ text: start, path: [] }]; const E = ENG();
    for (let depth = 0; depth < 6 && frontier.length && out.length < 6; depth++) {
      const next = [];
      for (const n of frontier) {
        for (const d of await strictDec(n.text)) { if (seen.has(d.text)) continue; seen.add(d.text); const path = n.path.concat(d.name), sc = Math.max(E.english(d.text), E.clean(d.text).length >= 15 && E.wordCover(d.text) >= .85 ? .7 : 0); if (sc > .55 || c0.flagIn(d.text)) out.push({ text: d.text, path, score: Math.max(sc, .6) + .05 }); else next.push({ text: d.text, path }); }
        for (const [tn, tf] of TRANSFORMS) { const t2 = tf(n.text); if (t2 === n.text || seen.has(t2)) continue; if ((await strictDec(t2)).length) { seen.add(t2); next.push({ text: t2, path: n.path.concat(tn) }); } }
      }
      frontier = next.slice(0, 40);
    }
    return out;
  }
  const c0 = { flagIn: t => { const m = String(t).match(X.FLAGS); return m ? m[0] : null; } };
  /* a key worked out from a known start such as "flag{" */
  function cribXor(arr) {
    const E = ENG(), out = [];
    for (const crib of ['flag{', 'FLAG{', 'ctf{', 'htb{', 'thm{', 'picoCTF{']) {
      const cb = Array.from(X.U8(X.txt2b(crib))); if (arr.length < cb.length + 4) continue; const k0 = cb.map((ch, i) => arr[i] ^ ch);
      for (let L = 1; L <= cb.length; L++) { let ok = true; for (let i = L; i < cb.length; i++) if (k0[i] !== k0[i - L]) { ok = false; break; } if (!ok) continue; const key = k0.slice(0, L), text = X.S8(Uint8Array.from(arr.map((x, i) => x ^ key[i % L]))); if (X.printable(text) > .98 && c0.flagIn(text) && E.english(text) > .35) out.push({ text, key, score: Math.max(E.english(text), .6) + .1 }); }
    }
    return out.sort((p, q) => q.score - p.score).slice(0, 1);
  }
  /* binary data from hex/Base64 that is not text: try XOR keys */
  async function xorAttacks(s) {
    const E = ENG(), out = []; for (const id of ['hex', 'base64', 'base32']) {
      let b; try { b = await X.apply(id, 'dec', s); } catch (e) { continue; } if (!b || b.length < 6 || X.printable(b) > .85) continue; const arr = Array.from(X.U8(b));
      for (const r of cribXor(arr)) out.push({ text: r.text, path: [X.byId[id].name, 'XOR (key "' + X.b2txt(X.S8(Uint8Array.from(r.key))) + '", worked out from the known start of a flag)'], score: r.score });
      for (const r of E.xorSingle(arr).slice(0, 2)) out.push({ text: r.text, path: [X.byId[id].name, 'XOR (single byte key 0x' + r.key.toString(16).padStart(2, '0') + ')'], score: E.english(r.text) + .05 });
      if (arr.length >= 24) { const rr = E.xorRepeat(arr); if (rr && rr.text) out.push({ text: rr.text, path: [X.byId[id].name, 'XOR (repeating key ' + X.b2txt(X.S8(Uint8Array.from(rr.key))) + ')'], score: E.english(rr.text) + .05 }); }
    }
    return out.filter(cd => cd.score > .4);
  }
  /* keyword ciphers: try common words, colours and animals as the key */
  const KEYWORDS = X.COMMON.filter(w => /^[a-z]{3,10}$/.test(w)).concat('red blue green black white pink gold gray tan sun sky fox cat dog owl bat ant bee elk ape cow hen pig rat yak key lock code cipher spy moon star sea ice fire rain wind snow tree rose lily secret crypto zebra monarchy bifid cipher lemon kryptos enigma password letmein abc abcd qwerty keyword playfair vigenere beaufort square mystery hidden shadow ghost dragon wizard castle knight king queen bishop rook pawn chess moundshroud alpha bravo charlie delta echo foxtrot golf hotel india juliet kilo lima mike november oscar papa quebec romeo sierra tango uniform victor whiskey xray yankee zulu cyber hacker hack crack attack defend secure security network packet binary matrix neo trinity morpheus agent orange apple banana cherry grape lemon mango peach plum summer winter spring autumn monday friday sunday october river mountain forest ocean island desert planet galaxy rocket silver copper iron steel diamond ruby emerald sapphire thunder lightning storm flame blaze frost shield sword arrow bow lion tiger eagle wolf bear shark falcon phoenix raven cobra viper spider scorpion hello world test admin root user login master prime omega sigma gamma theta lambda kappa victory freedom liberty justice honor truth wisdom courage'.split(' '));
  async function dictAttack(text) {
    const E = ENG(), L = E.clean(text); if (L.length < 12) return []; let best = null;
    for (const id of ['vigenere', 'beaufort', 'autokey', 'playfair', 'keyword', 'columnar', 'bifid']) for (const k of KEYWORDS) { let t; try { t = X.b2txt(await X.apply(id, 'dec', X.txt2b(text), { key: k })); } catch (e) { continue; } const sc = E.english(t) + .0001 * E.qscore(t); if (!best || sc > best.score) best = { text: t, path: [X.byId[id].name + ' (key ' + k.toUpperCase() + ')'], score: sc }; }
    return best && (best.score > .5 && E.wordCover(best.text) >= .55 || E.wordCover(best.text) >= .8) ? [best] : [];
  }
  /* polish a nearly-right Vigenère key one letter at a time, keeping whatever makes the text more English */
  const vigDec = (t, key) => { let j = 0; return String(t).replace(/[a-z]/gi, ch => { const b = ch < 'a' ? 65 : 97, k = key.charCodeAt(j++ % key.length) - 65; return String.fromCharCode(b + ((ch.charCodeAt(0) - b - k + 26) % 26)); }); };
  const refineVig = (text, key) => { const E = ENG(); let k = key.toUpperCase().split(''), best = E.qscore(vigDec(text, k.join(''))); for (let pass = 0; pass < 3; pass++) for (let i = 0; i < k.length; i++) { let bi = k[i]; for (let c = 0; c < 26; c++) { const t = k.slice(); t[i] = String.fromCharCode(65 + c); const sc = E.qscore(vigDec(text, t.join(''))); if (sc > best) { best = sc; bi = t[i]; } } k[i] = bi; } const out = vigDec(text, k.join('')); return { key: k.join(''), text: out }; };
  async function bruteAll(text, onProg) {
    const B = A.cbLab.brute; if (!B) return []; const best = []; const E = ENG();
    for (const id of ['caesar', 'railfence', 'scytale', 'affine', 'columnar', 'atbash']) {
      for (const v of [text, text.replace(/\s+/g, '')]) { if (v.length < 10) continue; if (onProg) onProg('Trying ' + X.byId[id].name + '...'); let r = []; try { r = await B(id, v); } catch (e) { r = []; } if (r[0] && r[0].score > .55 && E.clean(r[0].text).length >= 10) best.push({ text: r[0].text, path: [X.byId[id].name + (r[0].label ? ' (' + r[0].label + ')' : '')], score: r[0].score }); }
    }
    return best.sort((p, q) => q.score - p.score).slice(0, 2);
  }
  /* encrypted bytes: try the most common passwords and keys on the spot, and bit rotations */
  async function autoKeys(b, openssl) {
    const out = [], E = ENG(); const arr = Array.from(X.U8(b));
    for (let n = 1; n < 8; n++) { const t = X.S8(Uint8Array.from(arr.map(x => ((x << n) | (x >> (8 - n))) & 255))); if (X.printable(t) > .97 && E.english(t) > .5) out.push({ text: t, path: ['Rotate every byte ' + n + ' bits left'], score: E.english(t) + .05 }); }
    const tries = openssl ? [['aes', { keyfmt: 'pass-openssl', mode: 'CBC', bits: 256 }, 'AES-256'], ['aes', { keyfmt: 'pass-openssl', mode: 'CBC', bits: 128 }, 'AES-128']] : [['rc4', { keyfmt: 'text' }, 'RC4'], ['xor', { keyfmt: 'text' }, 'XOR'], ['aes', { keyfmt: 'pass-sha256', mode: 'CBC', bits: 256 }, 'AES-256'], ['aes', { keyfmt: 'pass-openssl', mode: 'CBC', bits: 256 }, 'AES-256']];
    for (const [id, base, label] of tries) { if (out.length) break; let r; try { r = await X.crackKey(id, b, base, { seconds: 3 }); } catch (e) { continue; } if (r.found.length) out.push({ text: r.found[0].text, path: [label + ' with the password "' + r.found[0].key + '"'], score: .95 }); }
    return out;
  }
  const looksHash = s => /^[0-9a-f]{32}$|^[0-9a-f]{40}$|^[0-9a-f]{56}$|^[0-9a-f]{64}$|^[0-9a-f]{96}$|^[0-9a-f]{128}$/i.test(s.trim());
  const jwt = s => { const m = s.trim().match(/^([A-Za-z0-9_-]{8,})\.([A-Za-z0-9_-]{8,})\.([A-Za-z0-9_-]*)$/); if (!m) return null; try { const j = x => JSON.parse(X.b2txt(atob(x.replace(/-/g, '+').replace(/_/g, '/') + '==='.slice((x.length + 3) % 4)))); return { head: j(m[1]), body: j(m[2]), sig: m[3] }; } catch (e) { return null; } };
  async function crack(input, onProg) {
    const s = String(input).trim(); const res = { special: null, cands: [] };
    if (/^(MOUNDSHROUD1|ATLAS1):/.test(s)) { res.special = { type: 'strong' }; return res; }
    if (/^U2FsdGVkX1/.test(s)) { const by = atob(s.replace(/\s+/g, '')); const ak = await autoKeys(by, true); if (ak.length) { res.cands = ak; return res; } res.special = { type: 'openssl', bytes: by }; return res; }
    if (looksHash(s)) { const xs = await xorAttacks(s); if (xs.length && xs[0].score > .6) { res.cands = xs; return res; } const hl = s.length, algs = hl === 32 ? ['md5', 'ntlm', 'md4'] : hl === 40 ? ['sha1'] : hl === 64 ? ['sha256'] : hl === 96 ? ['sha384'] : hl === 128 ? ['sha512'] : []; for (const al of algs) { let r; try { r = await X.crackHash(al, s.toLowerCase(), { seconds: 3 }); } catch (e) { continue; } if (r && r.found) { res.cands = [{ text: r.found, path: [al.toUpperCase() + ' hash: the password was guessed (' + r.how + ')'], score: .95 }]; return res; } } res.special = { type: 'hash', h: s.toLowerCase() }; return res; }
    const jw = jwt(s); if (jw) { res.special = { type: 'jwt', jw }; return res; }
    const peeled = await peelBinary(s); for (const p of peeled) { const sub = await ENG().autoSolve(p.text, onProg); res.cands.push({ text: p.text, path: p.path, score: .9 }); sub.slice(0, 3).forEach(c => res.cands.push(Object.assign({}, c, { path: p.path.concat(c.path) }))); }
    const E0 = ENG(), isText = t => { const L = E0.clean(t); return L.length >= 20 && new Set(L).size >= 9 && X.printable(t) > .95 && (E0.english(t) >= .55 && E0.wordCover(t) >= .6 || E0.wordCover(t) >= .85); }, good = () => res.cands.some(cd => cd.score >= .5 && isText(cd.text));
    const fin = () => { const seen = new Set(); res.cands = res.cands.filter(c => { const k = c.text.slice(0, 120); if (seen.has(k)) return false; seen.add(k); return true; }).sort((a, b) => (flagIn(b.text) ? 1 : 0) - (flagIn(a.text) ? 1 : 0) || b.score - a.score); return res; };
    if (good()) return fin();
    { /* the quick one-step tricks first, so easy ciphers answer at once */ const quick = [...E0.caesarAll(s).slice(0, 1).map(r => ({ text: r.text, path: ['Caesar shift ' + r.k + ' (ROT' + (26 - r.k) % 26 + ')'], score: r.score })), { text: E0.atbash(s), path: ['Atbash'] }, { text: [...s].reverse().join(''), path: ['Reverse'] }, { text: CB.rot47(s), path: ['ROT47'] }]; for (const q of quick) { if (q.score === undefined) q.score = E0.english(q.text); if (isText(q.text)) res.cands.push(q); } if (good()) return fin(); }
    for (const p of await peel(s)) res.cands.push(p);
    if (good()) return fin();
    const sol = await ENG().autoSolve(s, onProg); sol.forEach(c => { if (!c.root) res.cands.push(c); });
    for (const p of await xorAttacks(s)) res.cands.push(p);
    for (const cd of res.cands.slice()) { const m = /Vigen[^(]*\(key ([A-Z]+)\)/.exec(cd.path.join(' ')); if (m && !cd.refined && ENG().clean(s).length >= 20) { const r = refineVig(s, m[1]), sc = ENG().english(r.text); if (r.text !== cd.text && sc >= cd.score) res.cands.push({ text: r.text, path: ['Vigenère (key ' + r.key + ')'], score: sc + .01, refined: true }); } }
    res.cands.forEach(cd => { const L = ENG().clean(cd.text); if (L.length >= 15 && new Set(L).size < 7) cd.score *= .25; const nonText = (cd.text.match(/[^A-Za-z\s.,'!?-]/g) || []).length / Math.max(1, cd.text.length); if (nonText > .2 && !c0.flagIn(cd.text)) cd.score *= .3; });          // junk made of tiny words ("no on of") is not English
    if (!res.cands.length || Math.max(...res.cands.map(cd => cd.score)) < .55) { for (const bf of await bruteAll(s, onProg)) res.cands.push(bf); }
    if (!res.cands.length || Math.max(...res.cands.map(cd => cd.score)) < .55) { if (onProg) onProg('Trying key words...'); for (const d of await dictAttack(s)) res.cands.push(d); }
    const subC = res.cands.find(cd => /Substitution/i.test(cd.path.join(' '))) || { score: 0 }; const bestC = Math.max(0, ...res.cands.map(cd => cd.score)); if (bestC < .8 && subC.score < .85 && /^[A-Za-z\s.,'!?-]+$/.test(s) && ENG().clean(s).length >= 80) { if (onProg) onProg('Polishing the substitution...'); const sub = await ENG().substitution(s, (a, b) => onProg && onProg('Substitution search ' + a + '/' + b + '...'), 12000, 25); if (sub && sub.score > subC.score) res.cands.push({ text: sub.text, path: ['Substitution cipher (polished)'], score: sub.score + .01 }); }
    const seen = new Set(); res.cands = res.cands.filter(c => { const k = c.text.slice(0, 120); if (seen.has(k)) return false; seen.add(k); return true; }).sort((a, b) => (flagIn(b.text) ? 1 : 0) - (flagIn(a.text) ? 1 : 0) || b.score - a.score);
    if (!res.cands.length || res.cands[0].score < .4) { // maybe modern encryption: bytes with no pattern
      if (/^[A-Za-z]+$/.test(s.replace(/\s+/g, '')) && !/^[0-9a-f]+$/i.test(s.replace(/\s+/g, ''))) { /* plain letters only: not Base64 of random bytes */ } else for (const id of ['base64', 'hex']) { let b; try { b = await X.apply(id, 'dec', s); } catch (e) { continue; } if (b && b.length >= 16 && X.printable(b) < .5) { const ak = await autoKeys(b); if (ak.length) { res.cands = ak.map(c => Object.assign(c, { path: [X.byId[id].name].concat(c.path) })); break; } res.special = { type: 'binary', bytes: b, via: X.byId[id].name }; break; } }
    }
    return res;
  }
  const solved = r => r.cands.length && (r.cands[0].score >= .55 || flagIn(r.cands[0].text));

  A.cbLab = {
    render(root) {
      let tab = ls.get('cbtab', 'crack'), dead = false;
      root.innerHTML = CSS + '<div class="scroll pad" style="flex:1"><div class="clw"><h2 style="margin:0">🔓 Code Breaker <span class="small mute" style="font-weight:400">your cipher lab</span></h2><div class="cllv" id="cllv"></div><div class="small mute" id="clblurb"></div><div class="cltabs" id="cltabs"></div><div id="clbody"></div></div></div>';
      const q = id => root.querySelector('#' + id), body = () => q('clbody');
      const drawLevels = () => { q('cllv').innerHTML = LV.map((l, i) => '<button class="' + (S.level === i + 1 ? 'on' : '') + '" data-lv="' + (i + 1) + '" title="' + $e(l.t) + '"><span class="n">' + l.ic + '</span><b>' + (i + 1) + ' · ' + l.n + '</b><span class="small">' + ((S.solved[i + 1] || 0) + ' missions') + '</span></button>').join(''); q('clblurb').textContent = 'Level ' + S.level + ' · ' + LV[S.level - 1].n + ': ' + LV[S.level - 1].t + ' Only use these tools on puzzles and messages that are yours to read.'; };
      const drawTabs = () => { const avail = TABS.filter(t => t[2] <= S.level); if (!avail.some(t => t[0] === tab)) tab = 'crack'; q('cltabs').innerHTML = avail.map(t => '<button class="ib' + (tab === t[0] ? ' on' : '') + '" data-tab="' + t[0] + '">' + t[1] + '</button>').join(''); };
      const go = t => { tab = t; ls.set('cbtab', t); drawTabs(); body().innerHTML = ''; (TAB[t] || TAB.crack)(body()); };
      root.addEventListener('click', e => { const l = e.target.closest('[data-lv]'); if (l) { S.level = +l.dataset.lv; save(); drawLevels(); go(tab); return; } const t = e.target.closest('[data-tab]'); if (t) go(t.dataset.tab); });
      const ctx = { S, save, toast, copy, crack, solved, stepsHtml, why, flagIn, go: t => go(t), level: () => S.level, dead: () => dead, root };
      const TAB = A.cbLab.tabs(ctx);
      drawLevels(); go(tab); root._cleanup = () => { dead = true; };
    },
    LV, TABS, X, ENG, crack, solved
  };
  A.cbLab.tabs = function (c) { return Object.assign({}, A.cbLab.tabs1(c), A.cbLab.tabs2 ? A.cbLab.tabs2(c) : {}); };
  /* ---------- tabs: crack, hide, learn, missions ---------- */
  A.cbLab.tabs1 = function (c) {
    const out = {}, S = c.S;
    const EX = async () => [['Base64 message', await X.apply('base64', 'enc', X.txt2b('meet me at the old bridge at midnight'))], ['Secret shift', await X.apply('caesar', 'enc', X.txt2b('the treasure is buried under the big oak tree'), { shift: 11 })], ['Two layers', await X.apply('hex', 'enc', await X.apply('base64', 'enc', X.txt2b('flag{welcome_to_the_lab}')))], ['Binary', await X.apply('binary', 'enc', X.txt2b('hello hacker'))]];
    out.crack = async host => {
      host.innerHTML = '<div class="clcard"><b style="font-size:16px">Paste a secret message. I will try to read it.</b><div class="small mute" style="margin:4px 0 8px">It can be a jumble of letters, numbers, dots and dashes, a long code, a hash, anything. Press the button and I try hundreds of tricks.</div><textarea class="clbig" id="in" placeholder="Paste the mystery text here..." spellcheck="false"></textarea><div class="clrow"><button class="pri" id="go" style="font-size:16px;padding:10px 22px">🔮 Crack it!</button><button class="ib" id="clr">Clear</button><span class="small mute">or try an example:</span><span id="exs"></span></div></div><div id="res"></div>';
      const $ = id => host.querySelector('#' + id); const ex = await EX(); if (c.dead()) return; $('exs').innerHTML = ex.map((e, i) => '<button class="chip" data-ex="' + i + '">' + $e(e[0]) + '</button>').join(' ');
      const run = async () => {
        const v = $('in').value.trim(); if (!v) return toast('Paste something first.'); $('go').disabled = true; $('go').textContent = '⏳ Working...'; $('res').innerHTML = '<div class="clcard"><span id="prog">Trying decoders and ciphers...</span></div>';
        const r = await c.crack(v, t => { const p = $('prog'); if (p) p.textContent = t; }); $('go').disabled = false; $('go').textContent = '🔮 Crack it!'; if (c.dead()) return; show(r, v);
      };
      const show = (r, input) => {
        const res = $('res'), lv = c.level();
        if (r.special) return special(r.special, input);
        if (c.solved(r)) {
          const top = r.cands[0], fl = c.flagIn(top.text); const alt = r.cands.slice(1, lv === 1 ? 1 : lv === 2 ? 3 : 6).filter(x => x.score > .3);
          res.innerHTML = '<div class="clcard clok"><b style="font-size:17px">✅ I read it!</b>' + (fl ? ' <span class="clpill good">🚩 flag found</span>' : '') + '<div class="small mute">Here is what it says:</div><div class="clans" id="ans"></div><div class="clrow"><button class="ib" id="cp">📋 Copy</button>' + (lv >= 4 ? '<button class="ib" id="torec">🍳 Open the steps in Recipe</button>' : '') + (lv === 1 ? '<button class="ib" id="how">❓ Show me how</button>' : '') + '</div><div id="steps" style="' + (lv === 1 ? 'display:none' : '') + '"><div class="clh">How I did it</div>' + c.stepsHtml(top.path) + '</div></div>' + (alt.length ? '<div class="clh">Other possibilities</div>' + alt.map(a => '<div class="clcard"><div class="clmono">' + $e(a.text.slice(0, 300)) + '</div><div class="small mute">' + $e(a.path.join(' → ') || 'as is') + '</div></div>').join('') : '');
          $('ans').textContent = top.text; $('cp').onclick = () => c.copy(top.text); if ($('how')) $('how').onclick = () => { $('steps').style.display = ''; $('how').remove(); };
          if ($('torec')) $('torec').onclick = () => { S.recipe = top.path.map(p => { const o = X.ops.find(x => x.name === p || p.startsWith(x.name) || (/^Caesar/.test(p) && x.id === 'caesar')); const sh = /shift (\d+)/.exec(p); return o ? { id: o.id, dir: 'dec', params: Object.assign(X.defaults(o), o.id === 'caesar' && sh ? { shift: +sh[1] } : {}) } : null; }).filter(Boolean); S.recipeInput = input; c.save(); c.go('recipe'); };
        } else {
          res.innerHTML = '<div class="clcard clwarn"><b style="font-size:16px">😕 I could not read it automatically.</b><div class="small" style="margin:6px 0">' + (lv === 1 ? 'That is okay! Some codes need a password or a hint. Here is what you can try:' : 'Things to try next:') + '</div><ul style="margin:4px 0 4px 18px;line-height:1.7"><li>If you <b>know the password or key</b>, unlock it in <a href="#" data-go="' + (lv >= 3 ? 'methods' : 'hide') + '">' + (lv >= 3 ? 'Methods' : 'Hide a message (it also unlocks)') + '</a>.</li><li>Is it <b>very short</b>? Short messages are hard to read automatically. Try adding more text.</li><li>Practise on the <a href="#" data-go="mission">Missions</a> to learn the tricks.</li>' + (lv >= 3 ? '<li>Look at it in <a href="#" data-go="analyze">Analyze</a> to see which kind of cipher it might be.</li>' : '') + '</ul>' + (r.cands.length ? '<div class="clh">My best guess</div><div class="clmono">' + $e(r.cands[0].text.slice(0, 300)) + '</div><div class="small mute">' + $e(r.cands[0].path.join(' → ')) + '</div>' : '') + '</div>';
        }
        res.querySelectorAll('[data-go]').forEach(a => { a.onclick = e => { e.preventDefault(); c.go(a.dataset.go); }; });
      };
      const special = (sp, input) => {
        const res = $('res');
        if (sp.type === 'strong') { res.innerHTML = '<div class="clcard"><b>🔐 This is a Moundshroud secret message.</b><div class="small mute">It is locked with a passphrase. Enter the passphrase to unlock it.</div><div class="clrow"><input type="password" id="pw" placeholder="Passphrase" style="max-width:300px"><button class="pri" id="un">🔓 Unlock</button></div><div id="uo"></div></div>'; $('un').onclick = async () => { try { const t = X.b2txt(await X.apply('strong', 'dec', input, { key: $('pw').value })); $('uo').innerHTML = '<div class="clans">' + $e(t) + '</div>'; } catch (e) { $('uo').innerHTML = '<div class="small" style="color:var(--bad)">' + $e(e.message) + '</div>'; } }; }
        else if (sp.type === 'hash') { res.innerHTML = '<div class="clcard"><b>#️⃣ That looks like a hash (' + sp.h.length * 4 + ' bits).</b><div class="small mute" style="margin:4px 0">A hash is a one-way fingerprint of a password. It cannot be "decoded", but weak passwords can be <b>guessed</b>: I hash lots of likely passwords and see if one matches.</div><button class="pri" id="cr">🔨 Try to guess the password</button><div id="co" style="margin-top:8px"></div></div>'; $('cr').onclick = async () => { $('cr').disabled = true; const algs = sp.h.length === 32 ? ['md5', 'ntlm', 'md4'] : sp.h.length === 40 ? ['sha1'] : sp.h.length === 64 ? ['sha256'] : sp.h.length === 96 ? ['sha384'] : ['sha512']; let hit = null; for (const a of algs) { $('co').textContent = 'Trying ' + a.toUpperCase() + ' guesses...'; const r = await X.crackHash(a, sp.h, { seconds: 15 }); if (r.found) { hit = { a, r }; break; } } $('cr').disabled = false; $('co').innerHTML = hit ? '<div class="clcard clok"><b>✅ Found it!</b><div class="clans">' + $e(hit.r.found) + '</div><div class="small mute">Hash type ' + hit.a.toUpperCase() + ' · found by ' + $e(hit.r.how) + ' after ' + hit.r.tried.toLocaleString() + ' guesses. <b>Lesson:</b> this password was weak. Strong passwords are long and random.</div></div>' : '<div class="small mute">No luck with common passwords. That is actually a good sign about the password. (Hashes of long, random passwords cannot be guessed.)</div>'; }; }
        else if (sp.type === 'openssl' || sp.type === 'binary') { const pre = sp.type === 'openssl' ? 'This was locked with a password using AES (the same kind of encryption banks use).' : 'This looks like modern encryption (the bytes have no pattern). Clever tricks cannot read it without the key.'; res.innerHTML = '<div class="clcard clwarn"><b>🔒 ' + pre + '</b><div class="small mute" style="margin:4px 0">Strong encryption cannot be broken by cleverness, only by <b>guessing the password</b>. People pick weak passwords, so I can try the most common ones.</div><button class="pri" id="cr">🔨 Try common passwords</button><div id="co" style="margin-top:8px"></div></div>'; $('cr').onclick = async () => { $('cr').disabled = true; let found = []; const tries = sp.type === 'openssl' ? [['aes', { keyfmt: 'pass-openssl', mode: 'CBC', bits: 256 }], ['aes', { keyfmt: 'pass-openssl', mode: 'CBC', bits: 128 }]] : [['rc4', { keyfmt: 'text' }], ['aes', { keyfmt: 'pass-sha256', mode: 'CBC', bits: 256 }], ['aes', { keyfmt: 'pass-openssl', mode: 'CBC', bits: 256 }]]; for (const [id, base] of tries) { $('co').textContent = 'Trying ' + X.byId[id].name + '...'; const r = await X.crackKey(id, sp.bytes, base, { seconds: 12, onProg: (n, w) => { $('co').textContent = 'Trying ' + X.byId[id].name + ': ' + n.toLocaleString() + ' guesses (' + w + ')'; } }); if (r.found.length) { found = r.found.map(f => Object.assign(f, { m: X.byId[id].name })); break; } } $('cr').disabled = false; $('co').innerHTML = found.length ? found.map(f => '<div class="clcard clok"><b>✅ The password is "' + $e(f.key) + '"</b> <span class="small mute">(' + $e(f.m) + ')</span><div class="clans">' + $e(f.text) + '</div></div>').join('') : '<div class="small mute">None of the common passwords worked. Good encryption with a good password is safe from guessing. If you know the password, unlock it in <b>Methods</b> (Operator level).</div>'; }; }
        else if (sp.type === 'jwt') { res.innerHTML = '<div class="clcard"><b>🎫 That is a JWT (a login token).</b><div class="small mute">It is just Base64 JSON: anyone can read it. The signature (not checked here) is what stops people changing it.</div><div class="clh">Header</div><div class="clmono">' + $e(JSON.stringify(sp.jw.head, null, 2)) + '</div><div class="clh">Payload</div><div class="clmono">' + $e(JSON.stringify(sp.jw.body, null, 2)) + '</div>' + (c.level() >= 4 ? '<div class="small mute" style="margin-top:8px">Hacker tip: if the header says alg "none", or the secret is a weak word, tokens can be forged. Always verify the signature server-side.</div>' : '') + '</div>'; }
      };
      host.addEventListener('click', async e => { const ex1 = e.target.closest('[data-ex]'); if (ex1) { $('in').value = ex[+ex1.dataset.ex][1]; run(); } if (e.target.id === 'go') run(); if (e.target.id === 'clr') { $('in').value = ''; $('res').innerHTML = ''; } });
      $('in').onkeydown = e => { e.stopPropagation(); if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) run(); }; if (S.prefill) { $('in').value = S.prefill; S.prefill = ''; c.save(); setTimeout(run, 100); }
    };
    /* ----- hide a message ----- */
    out.hide = host => {
      const lv = c.level(); let style = 'strong';
      const STY = [['strong', '🛡️ Strong', 'Real, modern encryption (AES-256). Nobody can break it without your passphrase.', [['key', 'Passphrase (make it long!)', 'password']]], ['puzzle', '🧩 Puzzle', 'A keyword cipher (Vigenère): fun to crack, not secure.', [['key', 'Key word', 'text', 'SECRET']]], ['easy', '🧒 Easy', 'A simple letter shift (Caesar). Anyone can crack it, great for kids and games.', [['shift', 'Shift (1-25)', 'number', 7]]], ['code', '📡 Looks like code', 'Just a format change (Base64, Morse or Binary). Not secret at all.', [['how', 'Which one?', 'select', ['Base64', 'Morse', 'Binary', 'Hex']]]]];
      host.innerHTML = '<div class="clcard"><b style="font-size:16px">Turn a message into a secret.</b><div class="small mute" style="margin:4px 0 8px">Type your message, pick how secret you want it, and copy the result. Use <b>Strong</b> for anything that really matters.</div><textarea class="clbig" id="msg" style="min-height:90px" placeholder="Type your secret message..."></textarea><div class="clh">How secret?</div><div class="clgrid" id="sty"></div><div id="opts" class="clrow"></div><div class="clrow"><button class="pri" id="mk" style="font-size:15px;padding:9px 20px">🔐 Hide it</button></div></div><div id="outp"></div>';
      const $ = id => host.querySelector('#' + id);
      const drawSty = () => { $('sty').innerHTML = STY.map(s => '<div class="clopt' + (style === s[0] ? ' on' : '') + '" data-s="' + s[0] + '"><b>' + s[1] + '</b><span class="small mute">' + s[2] + '</span></div>').join(''); const s = STY.find(x => x[0] === style); $('opts').innerHTML = s[3].map(p => '<label>' + p[1] + ' ' + (p[2] === 'select' ? '<select id="o_' + p[0] + '">' + p[3].map(o => '<option>' + o + '</option>').join('') + '</select>' : '<input id="o_' + p[0] + '" type="' + (p[2] === 'number' ? 'number' : p[2] === 'password' ? 'password' : 'text') + '" ' + (p[2] === 'password' ? '' : 'value="' + (p[3] !== undefined ? p[3] : '') + '"') + ' style="width:200px" autocomplete="off">') + '</label>').join(''); };
      host.addEventListener('click', e => { const s = e.target.closest('[data-s]'); if (s) { style = s.dataset.s; drawSty(); } });
      $('mk').onclick = async () => {
        const msg = $('msg').value; if (!msg.trim()) return toast('Type a message first.'); let o, how; try {
          if (style === 'strong') { const k = $('o_key').value; if (k.length < 6) return toast('Use a passphrase of at least 6 characters (longer is much stronger).'); o = await X.apply('strong', 'enc', X.txt2b(msg), { key: k }); how = 'Paste it into <b>Crack it</b> (or send it to a friend who knows the passphrase) and enter the passphrase. Without the passphrase it cannot be read.'; }
          else if (style === 'puzzle') { o = await X.apply('vigenere', 'enc', X.txt2b(msg), { key: $('o_key').value }); how = 'To read it, shift each letter back using the key word <b>' + $e($('o_key').value.toUpperCase()) + '</b> (Methods → Vigenère → Decode), or try Crack it.'; }
          else if (style === 'easy') { o = await X.apply('caesar', 'enc', X.txt2b(msg), { shift: +$('o_shift').value }); how = 'To read it, shift every letter <b>back</b> by ' + +$('o_shift').value + ' places. Or paste it in Crack it.'; }
          else { const m = $('o_how').value, id = { Base64: 'base64', Morse: 'morse', Binary: 'binary', Hex: 'hex' }[m]; o = await X.apply(id, 'enc', X.txt2b(msg)); how = 'This is only <b>' + m + '</b>, a way of writing text. Anyone can undo it in Crack it.'; }
        } catch (e) { return toast(e.message, 4000); }
        $('outp').innerHTML = '<div class="clcard clok"><b>✅ Your secret message</b><div class="clans" id="so">' + $e(X.b2txt(o)) + '</div><div class="clrow"><button class="ib" id="cp">📋 Copy</button></div><div class="small">' + how + '</div></div>'; $('cp').onclick = () => c.copy(X.b2txt(o));
      };
      drawSty();
    };
    /* ----- learn ----- */
    const LEARN = [
      ['caesar', 'Caesar shift', 'Slide every letter along the alphabet by the same number.', 'HELLO + 3 = KHOOR', 'Only 25 possible shifts: try them all (brute force).'],
      ['rot13', 'ROT13', 'A Caesar shift of exactly 13. Doing it twice gives the original.', 'HELLO → URYYB', 'There is nothing to break: it has no key.'],
      ['atbash', 'Atbash', 'Flip the alphabet: A↔Z, B↔Y...', 'HELLO → SVOOL', 'No key, so anyone can undo it.'],
      ['base64', 'Base64', 'Writes bytes using letters, digits, + and /. Often ends with = signs.', 'Hi → SGk=', 'It is a format, not a cipher. Decode it.'],
      ['hex', 'Hex', 'Each byte as two digits 0-9, a-f.', 'Hi → 48 69', 'A format. Decode it.'],
      ['morse', 'Morse', 'Dots and dashes for each letter.', 'SOS → ... --- ...', 'A lookup table.'],
      ['vigenere', 'Vigenère', 'A Caesar shift that changes with each letter of a key word.', 'ATTACK + LEMON → LXFOPV', 'Find the key length from repeating patterns (Kasiski) or the Index of Coincidence, then solve each column like a Caesar cipher.'],
      ['railfence', 'Rail fence', 'Write the message zigzag on rows, then read the rows.', 'WEAREDISCOVERED (3 rails) → WECRERDSOEEDIVAE', 'Try different numbers of rails until it reads right.'],
      ['substitution', 'Substitution', 'Replace each letter with a different letter using a scrambled alphabet.', 'HELLO → ITSSG', 'Count letter frequencies: the most common letters are probably E, T, A. Then improve step by step (hill climbing).'],
      ['xor', 'XOR', 'Mix each byte with a key byte. The same step locks and unlocks.', '0x41 ^ 0x01 = 0x40', 'Single-byte key: try all 256. Repeating key: find its length from bit differences, then solve each position.'],
      ['rc4', 'RC4', 'A stream cipher: the key makes a stream of bytes that is mixed in. Used in old Wi-Fi.', 'Key + message → noise', 'If the key is a common word, try a wordlist.'],
      ['aes', 'AES', 'The modern standard. Unbreakable by clever tricks.', 'password → real security', 'Only the password can be guessed. Long random passphrases are safe.'],
      ['md5', 'Hashes (MD5, SHA...)', 'One-way fingerprints. You cannot decode them.', 'abc → 900150983cd24fb0...', 'Guess the password: try common ones, then brute force short ones.']
    ];
    out.learn = async host => {
      host.innerHTML = '<div class="clcard"><b style="font-size:16px">How the tricks work</b><div class="small mute">Each card shows a method, a tiny example and how people break it. Press <b>Try it</b> to play with it.</div></div><div id="lc" class="clgrid" style="grid-template-columns:repeat(auto-fill,minmax(300px,1fr))"></div>';
      host.querySelector('#lc').innerHTML = LEARN.map(l => '<div class="clcard" style="margin:0"><b>' + $e(l[1]) + '</b><div class="small" style="margin:4px 0">' + $e(l[2]) + '</div><div class="clmono" style="background:var(--panel2);padding:6px 8px;border-radius:8px">' + $e(l[3]) + '</div><div class="small" style="margin-top:6px"><b>How to break it:</b> ' + $e(l[4]) + '</div>' + (X.byId[l[0]] && c.level() >= 3 ? '<button class="ib" data-try="' + l[0] + '" style="margin-top:6px">Try it</button>' : '') + '</div>').join('');
      host.onclick = e => { const t = e.target.closest('[data-try]'); if (t) { c.S.tryMethod = t.dataset.try; c.save(); c.go('methods'); } };
    };
    return out;
  };
})();

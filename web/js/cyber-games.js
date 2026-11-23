// Cyber & hacking games for the Cyber and Entertainment tabs.
// Every game includes an infinite procedural puzzle engine (like chess puzzles) with Elo ratings,
// streaks, difficulty tiers, and instant new challenges — 100% harmless local sandbox.
(() => {
  const P = A.play, L = P.logic = P.logic || {};
  /* game ids are looked up inside the element the game was mounted in (Games tab #plstage or Cyber tab #cygstage), so they cannot clash with ids elsewhere in the app */
  let stage = null;
  const $ = id => stage && stage.querySelector('#' + id);
  const reg = (id, name, icon, desc, mount) => { P.games[id] = { name, icon, desc, mount: (el, api) => { stage = el; return mount(el, api); }, cat: 'cyber' }; };
  const rnd = n => Math.random() * n | 0;
  const rndRange = (a, b) => a + rnd(b - a + 1);
  const pick = a => a[rnd(a.length)];
  const shuffle = a => { a = a.slice(); for (let i = a.length - 1; i > 0; i--) { const j = rnd(i + 1); [a[i], a[j]] = [a[j], a[i]]; } return a; };
  const num = (k, d) => { const v = +ls.get(k, String(d)); return Number.isFinite(v) ? v : d; };
  const btn = (id, t, cls) => '<button class="' + (cls || 'ib') + '" id="' + id + '">' + t + '</button>';
  const box = 'border:1px solid var(--line);background:var(--panel2);border-radius:10px;padding:10px 12px';
  const mono = 'font-family:Consolas,"Cascadia Mono",monospace';
  const badge = (t, col) => '<span style="display:inline-block;padding:2px 8px;border-radius:999px;font-size:11.5px;border:1px solid ' + (col || 'var(--line)') + ';color:' + (col || 'var(--mute)') + ';background:rgba(255,255,255,.03)">' + t + '</span>';

  /* ---- Shared Chess-Puzzle-Style Elo Rating + Streak Tracker ---- */
  function makeRating(key) {
    let rating = Math.max(600, num(key + '_elo', 1000));
    let solved = Math.max(0, num(key + '_sol', 0));
    let best = Math.max(0, num(key + '_best', 0));
    let streak = 0;
    const save = () => {
      ls.set(key + '_elo', String(rating));
      ls.set(key + '_sol', String(solved));
      ls.set(key + '_best', String(best));
    };
    const update = (ok, puzzleDiff, hinted) => {
      const targetElo = 850 + (puzzleDiff || 2) * 140;
      const expected = 1 / (1 + Math.pow(10, (targetElo - rating) / 400));
      const K = ok ? (hinted ? 16 : 32) : 22;
      const delta = Math.round(K * ((ok ? 1 : 0) - expected));
      rating = Math.max(600, Math.min(2800, rating + (ok ? Math.max(4, delta) : Math.min(-4, delta))));
      /* a solved puzzle pays into the Cyber Desktop's practice bank: more for a harder tier, half if a hint was used */
      if (ok) {
        solved++; streak++; if (streak > best) best = streak;
        A.cyberBank?.puzzleSolved(key, { diff: puzzleDiff, hinted: !!hinted });
      }
      else { streak = 0; }
      save();
      return delta;
    };
    const tierFor = mode => {
      if (mode === 'easy') return 1 + rnd(2);
      if (mode === 'med') return 3 + rnd(2);
      if (mode === 'hard') return 5 + rnd(2);
      if (mode === 'layered') return 6;
      if (rating < 1060) return 1 + rnd(2);
      if (rating < 1220) return 2 + rnd(2);
      if (rating < 1400) return 3 + rnd(3);
      return 4 + rnd(3);
    };
    const hud = extra => '★ ' + rating + '   🔥 ' + streak + (best ? ' (best ' + best + ')' : '') + '   ✓ ' + solved + (extra ? '   ' + extra : '');
    return { get rating() { return rating; }, get solved() { return solved; }, get streak() { return streak; }, get best() { return best; }, update, tierFor, hud };
  }
  L.makeRating = makeRating;

  /* ================= 1. CIPHER BREAKER (INFINITE CRYPTO PUZZLES) ================= */
  const PHR_BASE = [
    'THE ROUTER PASSWORD IS ON THE STICKY NOTE', 'NEVER CLICK LINKS IN STRANGE EMAILS',
    'UPDATE YOUR SOFTWARE EVERY WEEK', 'THE QUICK BROWN FOX LOCKS THE DOOR',
    'LONG PASSPHRASES BEAT SHORT PASSWORDS', 'BACK UP YOUR FILES BEFORE THE STORM',
    'SECURITY IS A HABIT NOT A PRODUCT', 'TURN ON TWO FACTOR LOGIN TODAY',
    'MEET ME AT THE LIBRARY AT NOON', 'ONLY THE PARANOID SURVIVE THE INTERNET',
    'KNOWLEDGE IS THE BEST FIREWALL', 'THE CAKE IS A LIE'
  ];
  const C_SUBJ = ['ADMIN', 'ANALYST', 'CIPHER', 'KERNEL', 'PROXY', 'ROUTER', 'DAEMON', 'SERVER', 'SENSOR', 'BEACON', 'CLIENT', 'ENGINE', 'MODULE', 'POCKET', 'SIGNAL', 'VECTOR', 'WATCHER', 'GUARDIAN', 'OPERATOR', 'SENTINEL'];
  const C_VERB = ['LOCKS', 'SCANS', 'GUARDS', 'CHECKS', 'PATCHES', 'AUDITS', 'ROUTED', 'SIGNED', 'SEALED', 'HIDES', 'VERIFIES', 'SHIFTS', 'TRACKS', 'BLOCKS', 'DECODES', 'WATCHES'];
  const C_OBJ = ['THE VAULT', 'THE GATEWAY', 'THE KERNEL', 'PORT FORTY FOUR', 'ROOT ACCESS', 'BACKUP KEYS', 'THE FIREWALL', 'EVERY PACKET', 'THE SECRET LOG', 'THE MAIN NODE', 'ZERO TRUST', 'THE TOKEN', 'THE RELAY', 'THE SUBNET', 'THE ARCHIVE', 'THE SANDBOX'];
  const C_LOC = ['AT DAWN', 'AT MIDNIGHT', 'IN SECTOR NINE', 'BEFORE REBOOT', 'ON NODE SEVEN', 'IN COLD STORAGE', 'AFTER PATCHING', 'OVER TLS', 'IN THE LAB', 'ON PORT TWENTY TWO', 'INSIDE THE VAULT', 'WITHOUT LEAKS'];
  const WORDS = ['FIREWALL', 'ROUTER', 'PHISHING', 'PASSWORD', 'ENCRYPT', 'NETWORK', 'SERVER', 'BROWSER', 'PACKET', 'SHIELD', 'SECRET', 'HACKER', 'CIPHER', 'TOKEN', 'VAULT', 'MOUNDSHROUD', 'KERNEL', 'SOCKET', 'SANDBOX', 'GATEWAY', 'PAYLOAD', 'KEYGEN', 'EXPLOIT', 'BACKDOOR', 'SUBNET', 'DAEMON', 'CHECKSUM', 'FORENSIC', 'PROTOCOL', 'SENTINEL', 'BASTION', 'QUARANTINE'];
  const VIG_KEYS = ['KEY', 'LOCK', 'MOON', 'SHIELD', 'VAULT', 'CIPHER', 'NEXUS', 'SIGNAL', 'PROXY', 'TOKEN', 'PATCH', 'VECTOR', 'SHADOW', 'ORBIT', 'PRISM', 'CRYPTO', 'MOUNDSHROUD'];
  const MORSE = { A: '.-', B: '-...', C: '-.-.', D: '-..', E: '.', F: '..-.', G: '--.', H: '....', I: '..', J: '.---', K: '-.-', L: '.-..', M: '--', N: '-.', O: '---', P: '.--.', Q: '--.-', R: '.-.', S: '...', T: '-', U: '..-', V: '...-', W: '.--', X: '-..-', Y: '-.--', Z: '--..' };
  const NATO = { A: 'ALPHA', B: 'BRAVO', C: 'CHARLIE', D: 'DELTA', E: 'ECHO', F: 'FOXTROT', G: 'GOLF', H: 'HOTEL', I: 'INDIA', J: 'JULIETT', K: 'KILO', L: 'LIMA', M: 'MIKE', N: 'NOVEMBER', O: 'OSCAR', P: 'PAPA', Q: 'QUEBEC', R: 'ROMEO', S: 'SIERRA', T: 'TANGO', U: 'UNIFORM', V: 'VICTOR', W: 'WHISKEY', X: 'XRAY', Y: 'YANKEE', Z: 'ZULU' };

  const shift = (s, k) => s.replace(/[A-Z]/g, c => String.fromCharCode((c.charCodeAt(0) - 65 + k + 260) % 26 + 65));
  const atbash = s => s.replace(/[A-Z]/g, c => String.fromCharCode(90 - (c.charCodeAt(0) - 65)));
  const vig = (s, key, dec) => { let i = 0; return s.replace(/[A-Z]/g, c => { const k = key.charCodeAt(i++ % key.length) - 65; return String.fromCharCode((c.charCodeAt(0) - 65 + (dec ? -k : k) + 26) % 26 + 65); }); };
  const revStr = s => [...s].reverse().join('');
  const toHex = s => [...s].map(c => c.charCodeAt(0).toString(16).padStart(2, '0')).join(' ');
  const xorHex = (s, k) => [...s].map(c => (c.charCodeAt(0) ^ k).toString(16).padStart(2, '0')).join(' ');
  const railEnc = (s, rails) => {
    const clean = s.replace(/\s+/g, '');
    const rows = Array.from({ length: rails }, () => '');
    let r = 0, dir = 1;
    for (const ch of clean) {
      rows[r] += ch;
      if (r === 0) dir = 1; else if (r === rails - 1) dir = -1;
      r += dir;
    }
    return rows.join(' | ');
  };
  const makePhrase = () => {
    const roll = rnd(10);
    if (roll < 2) return pick(PHR_BASE);
    if (roll < 6) return pick(C_SUBJ) + ' ' + pick(C_VERB) + ' ' + pick(C_OBJ);
    if (roll < 9) return pick(C_SUBJ) + ' ' + pick(C_VERB) + ' ' + pick(C_OBJ) + ' ' + pick(C_LOC);
    return pick(WORDS) + ' ' + pick(WORDS) + ' ' + rndRange(10, 99);
  };
  const makeShortWord = () => {
    if (Math.random() < 0.5) return pick(WORDS);
    const a = pick(WORDS).slice(0, 4), b = pick(WORDS).slice(0, 4);
    return a + b;
  };
  const CIPHER_TYPES = [
    { lv: 1, tag: 'Caesar', make: () => { const k = 1 + rnd(11), p = makePhrase(); return { ct: shift(p, k), pt: p, tag: 'Caesar +' + k, lv: 1, info: 'Caesar cipher: every letter shifted forward by ' + k + '. Shift each letter back ' + k + '.' }; } },
    { lv: 1, tag: 'ROT13', make: () => { const p = makePhrase(); return { ct: shift(p, 13), pt: p, tag: 'ROT13', lv: 1, info: 'ROT13: Caesar shift of 13. Applying ROT13 again decodes it.' }; } },
    { lv: 1, tag: 'Reverse', make: () => { const p = makePhrase(); return { ct: revStr(p), pt: p, tag: 'Reversed Text', lv: 1, info: 'The message is written backwards character-by-character.' }; } },
    { lv: 2, tag: 'Atbash', make: () => { const p = makePhrase(); return { ct: atbash(p), pt: p, tag: 'Atbash', lv: 2, info: 'Atbash: mirrored alphabet (A↔Z, B↔Y, C↔X...).' }; } },
    { lv: 2, tag: 'Unknown Caesar', make: () => { const k = 2 + rnd(23), p = makePhrase(); return { ct: shift(p, k), pt: p, tag: 'Unknown Caesar', lv: 2, unknown: true, info: 'Caesar cipher with unknown shift (' + k + '). Only 25 shifts exist — try the shift table.' }; } },
    { lv: 2, tag: 'Rail Fence', make: () => { const p = pick(WORDS); return { ct: railEnc(p, 2), pt: p, tag: 'Rail Fence (2)', lv: 2, info: '2-rail fence: alternate letters from the left half and right half (separated by |).' }; } },
    { lv: 3, tag: 'Base64', make: () => { const p = makePhrase(); return { ct: btoa(p), pt: p, tag: 'Base64', lv: 3, info: 'Base64 encoding (A–Z, a–z, 0–9, +, /, =). Reversible encoding, not encryption.' }; } },
    { lv: 3, tag: 'Hex ASCII', make: () => { const p = makeShortWord(); return { ct: toHex(p), pt: p, tag: 'Hex ASCII', lv: 3, info: 'Hexadecimal ASCII: each 2-digit hex pair is one character (41=A, 42=B...).' }; } },
    { lv: 3, tag: 'URL Encode', make: () => { const p = makeShortWord(); const ct = [...p].map(c => '%' + c.charCodeAt(0).toString(16).toUpperCase().padStart(2, '0')).join(''); return { ct, pt: p, tag: 'URL %Hex', lv: 3, info: 'Percent-encoded ASCII: each %XX is one hex ASCII byte.' }; } },
    { lv: 3, tag: 'Decimal ASCII', make: () => { const p = makeShortWord().slice(0, 7); return { ct: [...p].map(c => c.charCodeAt(0)).join(' '), pt: p, tag: 'Decimal ASCII', lv: 3, info: 'Decimal ASCII codes: 65=A, 66=B, ..., 90=Z.' }; } },
    { lv: 4, tag: 'Binary', make: () => { const p = makeShortWord().slice(0, 6); return { ct: [...p].map(c => c.charCodeAt(0).toString(2).padStart(8, '0')).join(' '), pt: p, tag: 'Binary 8-bit', lv: 4, info: '8-bit ASCII binary: 01000001 = 65 = A.' }; } },
    { lv: 4, tag: 'Morse', make: () => { const p = pick(WORDS).slice(0, 6); return { ct: [...p].map(c => MORSE[c]).join('  '), pt: p, tag: 'Morse Code', lv: 4, info: 'International Morse code. Letters are separated by double spaces.' }; } },
    { lv: 4, tag: 'NATO', make: () => { const p = pick(WORDS).slice(0, 7); return { ct: [...p].map(c => NATO[c]).join(' '), pt: p, tag: 'NATO Phonetic', lv: 4, info: 'Take the first letter of each NATO phonetic code word.' }; } },
    { lv: 5, tag: 'Vigenere', make: () => { const key = pick(VIG_KEYS), p = makePhrase(); return { ct: vig(p, key), pt: p, tag: 'Vigenere (' + key + ')', lv: 5, key, info: 'Vigenere cipher using keyword ' + key + ': subtract each keyword letter shift (A=0, B=1...).' }; } },
    { lv: 5, tag: 'XOR Hex', make: () => { const k = pick([3, 5, 7, 13, 17, 23, 32, 42]), p = makeShortWord().slice(0, 7); return { ct: xorHex(p, k), pt: p, tag: 'XOR 0x' + k.toString(16).padStart(2, '0'), lv: 5, xorKey: k, info: 'Single-byte XOR: convert each hex byte and XOR with decimal ' + k + ' (0x' + k.toString(16) + ').' }; } },
    { lv: 6, tag: 'Layered: B64+Caesar', make: () => { const k = 1 + rnd(13), p = makeShortWord(); return { ct: btoa(shift(p, k)), pt: p, tag: 'Layered (2x)', lv: 6, info: '2 layers: decode Base64 first, then undo Caesar shift of ' + k + '.' }; } },
    { lv: 6, tag: 'Layered: B64+B64', make: () => { const p = makeShortWord(); return { ct: btoa(btoa(p)), pt: p, tag: 'Double Base64', lv: 6, info: '2 layers: decode Base64 twice in a row.' }; } },
    { lv: 6, tag: 'Layered: Hex+Atbash', make: () => { const p = makeShortWord().slice(0, 7); return { ct: toHex(atbash(p)), pt: p, tag: 'Layered (Hex+Atbash)', lv: 6, info: '2 layers: decode Hex ASCII first, then apply Atbash mirror (A↔Z).' }; } },
    { lv: 6, tag: 'Layered: B64+Rev+ROT13', make: () => { const p = makeShortWord(); return { ct: btoa(revStr(shift(p, 13))), pt: p, tag: 'Triple Layer (3x)', lv: 6, info: '3 layers: Base64 decode -> reverse string -> ROT13!' }; } },
    { lv: 6, tag: 'Layered: Hex+Caesar', make: () => { const k = 1 + rnd(12), p = makeShortWord().slice(0, 7); return { ct: toHex(shift(p, k)), pt: p, tag: 'Layered (Hex+Caesar)', lv: 6, info: '2 layers: Hex decode first, then undo Caesar shift of ' + k + '.' }; } },
  ];
  const makeCipherPuzzle = tier => {
    const lv = Math.max(1, Math.min(6, tier || (1 + rnd(6))));
    const pool = CIPHER_TYPES.filter(t => t.lv === lv);
    const any = CIPHER_TYPES.filter(t => t.lv <= lv);
    const chosen = (pool.length && Math.random() < 0.72) ? pick(pool) : pick(any);
    return chosen.make();
  };
  L.cipher = { shift, atbash, vig, MORSE, NATO, revStr, toHex, xorHex, make: makeCipherPuzzle, makePhrase };

  reg('cipher', 'Cipher Breaker', '🔐', 'Infinite procedural crypto puzzles from Caesar & Base64 to XOR, Vigenere and 3-layer chains — with Elo rating & scratchpad.', (el, api) => {
    const R = makeRating('cycipher');
    let cur = null, hinted = false, mode = 'auto';
    el.innerHTML = '<div style="width:min(700px,100%)">' +
      '<div class="row" style="gap:6px;flex-wrap:wrap;margin-bottom:8px;align-items:center">' +
        '<select id="cdiff" class="ib" style="padding:4px 8px"><option value="auto">Adaptive (Elo)</option><option value="easy">Easy (Lv 1–2)</option><option value="med">Medium (Lv 3–4)</option><option value="hard">Hard (Lv 5–6)</option><option value="layered">Layered Only (2x–3x)</option></select>' +
        '<span id="cl" class="small mute"></span>' +
        '<span class="sp"></span>' +
        btn('cacad', '🎓 Academy') +
        btn('cnext', '∞ New puzzle') +
      '</div>' +
      '<div id="cc" style="' + box + ';' + mono + ';font-size:16.5px;word-break:break-all;line-height:1.6;min-height:60px"></div>' +
      '<div id="ci" class="small mute" style="margin:8px 0;min-height:20px"></div>' +
      '<div class="row" style="gap:8px"><input type="text" id="ca" placeholder="Type the decoded plaintext" autocomplete="off" spellcheck="false" style="flex:1">' + btn('cg', 'Check', 'pri') + '</div>' +
      '<div class="row" style="gap:6px;flex-wrap:wrap;margin-top:8px">' + btn('ch', 'Hint') + btn('cs', 'Skip') + btn('cb', 'All 25 shifts') + btn('ctool', '🧰 Decoder scratchpad') + '</div>' +
      '<div id="cbench" style="display:none;margin-top:8px;' + box + '">' +
        '<div class="small mute" style="margin-bottom:6px">Scratchpad (chain transforms just like CyberChef):</div>' +
        '<input type="text" id="cpad" placeholder="Paste ciphertext here to transform step-by-step" autocomplete="off" spellcheck="false" style="width:100%;margin-bottom:6px;' + mono + ';font-size:12.5px">' +
        '<div class="row" style="gap:5px;flex-wrap:wrap" id="cops">' +
          '<button class="ib small" data-op="b64">From Base64</button><button class="ib small" data-op="hex">From Hex</button><button class="ib small" data-op="url">URL Decode</button><button class="ib small" data-op="dec">From Decimal</button><button class="ib small" data-op="bin">From Binary</button><button class="ib small" data-op="rot13">ROT13</button><button class="ib small" data-op="atbash">Atbash</button><button class="ib small" data-op="rev">Reverse</button><button class="ib small" data-op="caesar">Caesar -1</button><button class="ib small" data-op="load">Load puzzle</button>' +
        '</div>' +
      '</div>' +
      '<pre id="cx" class="small" style="margin-top:8px;white-space:pre-wrap;display:none;' + mono + '"></pre>' +
      '<div id="cm" style="margin-top:10px;min-height:22px"></div>' +
    '</div>';
    const norm = s => s.toUpperCase().replace(/[^A-Z0-9]/g, '');
    const next = () => {
      const tier = R.tierFor(mode);
      cur = makeCipherPuzzle(tier);
      hinted = false;
      $('cc').textContent = cur.ct;
      $('ci').textContent = '';
      $('ca').value = '';
      $('cx').style.display = 'none';
      $('cm').textContent = '';
      $('cb').style.display = (cur.unknown || cur.lv <= 2) ? '' : 'none';
      $('cl').innerHTML = badge(cur.tag, 'var(--acc)') + ' ' + badge('Tier ' + cur.lv + '/6');
      if ($('cpad')) $('cpad').value = cur.ct;
      api.hud(R.hud());
      $('ca').focus();
    };
    const check = () => {
      if (!cur) return;
      if (norm($('ca').value) === norm(cur.pt)) {
        const d = R.update(true, cur.lv, hinted);
        api.submit(R.rating);
        $('cm').innerHTML = '<span style="color:var(--ok)">Cracked! ' + (d >= 0 ? '+' : '') + d + ' Elo</span> <span class="small mute">' + esc(cur.info) + '</span>';
        $('cc').textContent = cur.pt;
        cur = null;
        api.hud(R.hud());
        setTimeout(next, 1400);
      } else {
        const d = R.update(false, cur.lv, hinted);
        $('cm').innerHTML = '<span style="color:var(--bad)">Not quite (' + d + ' Elo). Try again, use the scratchpad, or ask for a hint.</span>';
        api.hud(R.hud());
      }
    };
    $('cacad').onclick = () => { if (A.cybertab) A.cybertab.go('games', 'cipher_academy'); };
    $('cdiff').onchange = () => { mode = $('cdiff').value; next(); };
    $('cnext').onclick = next;
    $('cg').onclick = check;
    $('ca').onkeydown = e => { if (e.key === 'Enter') check(); };
    $('ch').onclick = () => { if (!cur) return; hinted = true; $('ci').textContent = 'Hint: ' + cur.info; };
    $('cs').onclick = () => { if (!cur) return; const d = R.update(false, cur.lv, true); $('cm').innerHTML = '<span class="mute">Answer (' + d + ' Elo): ' + esc(cur.pt) + ' — ' + esc(cur.info) + '</span>'; cur = null; api.hud(R.hud()); setTimeout(next, 1600); };
    $('cb').onclick = () => { if (!cur) return; hinted = true; $('cx').style.display = 'block'; $('cx').textContent = Array.from({ length: 25 }, (_, i) => ('shift -' + (i + 1)).padEnd(10) + ' ' + shift(cur.ct, -(i + 1))).join('\n'); };
    $('ctool').onclick = () => { const b = $('cbench'); b.style.display = b.style.display === 'none' ? 'block' : 'none'; if (b.style.display === 'block' && cur && !$('cpad').value) $('cpad').value = cur.ct; };
    $('cops').onclick = e => {
      const b = e.target.closest('[data-op]'); if (!b) return;
      const op = b.dataset.op; let v = $('cpad').value;
      try {
        if (op === 'load' && cur) v = cur.ct;
        else if (op === 'b64') v = atob(v.replace(/\s+/g, ''));
        else if (op === 'hex') v = v.trim().split(/\s+/).map(h => String.fromCharCode(parseInt(h, 16))).join('');
        else if (op === 'url') v = decodeURIComponent(v.trim());
        else if (op === 'dec') v = v.trim().split(/\s+/).map(n => String.fromCharCode(parseInt(n, 10))).join('');
        else if (op === 'bin') v = v.trim().split(/\s+/).map(n => String.fromCharCode(parseInt(n, 2))).join('');
        else if (op === 'rot13') v = shift(v.toUpperCase(), 13);
        else if (op === 'atbash') v = atbash(v.toUpperCase());
        else if (op === 'rev') v = revStr(v);
        else if (op === 'caesar') v = shift(v.toUpperCase(), -1);
        $('cpad').value = v;
      } catch (err) { $('cm').innerHTML = '<span class="small" style="color:var(--warn)">Scratchpad: input is not valid for ' + esc(op) + '.</span>'; }
    };
    next();
    return () => { cur = null; };
  });

  /* ================= 2. TERMINAL HACKER (24 CAMPAIGN MISSIONS + 12-LESSON ACADEMY + ∞ ENDLESS CTF) ================= */
  const F = (c, locked) => ({ _f: 1, c, locked: !!locked });
  const logLines = () => { const out = []; const lv = ['INFO', 'INFO', 'INFO', 'WARN', 'DEBUG']; const msg = ['user login ok', 'cache refreshed', 'disk 71% used', 'request /index 200', 'request /about 200', 'retrying connection', 'backup finished', 'session closed']; for (let i = 0; i < 38; i++) out.push('2026-10-21 09:' + String(10 + i).padStart(2, '0') + ' ' + lv[(i * 7) % 5] + ' ' + msg[(i * 5) % msg.length]); out.splice(23, 0, '2026-10-21 09:47 DEBUG leaked token=FLAG{grep_finds_needles}'); return out.join('\n'); };
  const makeDeployScript = () => {
    const out = ['#!/usr/bin/env bash', '# Moundshroud release pipeline v2.4', 'set -euo pipefail'];
    for (let i = 4; i <= 115; i++) out.push('echo "[step ' + i + '] syncing shard-' + (i % 9) + ' ok"');
    out.push('# RELEASE_KEY=FLAG{head_and_tail_slice_fast}');
    out.push('echo "deploy finished"');
    return out.join('\n');
  };
  const makeDupTokens = () => {
    const base = ['tok_881a9f22', 'tok_442c0e11', 'tok_991d7b04', 'tok_115f3a88', 'tok_774e2c90', 'tok_309b6d55'];
    const out = [];
    for (let i = 0; i < 54; i++) out.push(base[i % base.length]);
    out.splice(31, 0, 'FLAG{sort_uniq_spots_outliers}');
    return out.join('\n');
  };
  const makeFirewallNoise = () => {
    const out = [];
    for (let i = 1; i <= 48; i++) out.push('2026-11-19 04:' + String(i % 60).padStart(2, '0') + ' OK_HEARTBEAT node=edge-' + (i % 4) + ' status=200');
    out.splice(27, 0, '2026-11-19 04:28 ANOMALY_BREACH token=FLAG{grep_v_inverts_noise}');
    return out.join('\n');
  };
  const makeUsersCsv = () => {
    const roles = ['viewer', 'editor', 'analyst', 'viewer', 'guest'];
    const out = ['id,username,role,token_b64'];
    for (let i = 1; i <= 36; i++) {
      const u = 'user' + String(i).padStart(2, '0');
      out.push(i + ',' + u + ',' + roles[i % roles.length] + ',' + btoa('normal_session_' + i));
    }
    out.splice(21, 0, '99,sysroot,root,' + btoa('FLAG{cut_extracts_columns}'));
    return out.join('\n');
  };
  const makeFakeBin = () => '\x01\x02\x00\x07ELF\x00\x03\x00junk\x00\x01\x04\x00libcrypto.so\x00\x02\x00\x05\x00version=3.1.4\x00\x01\x00\x03\x02\x00FLAG{strings_reads_binaries}\x00\x04\x02\x00END_SECTION\x00\x01';
  const rot13Str = s => s.replace(/[A-Za-z]/g, c => { const b = c <= 'Z' ? 65 : 97; return String.fromCharCode((c.charCodeAt(0) - b + 13) % 26 + b); });

  const MIS = [
    /* --- Chapter 1: Linux Basics (1–6) --- */
    { ch: 'Ch 1: Basics', name: 'The lost note', cwd: '/home/you', flag: 'FLAG{dotfiles_are_not_invisible}', goal: 'Someone hid a flag in a hidden file in the Documents folder. Hidden files start with a dot.', hint: 'Try: cd Documents, then ls -a, then cat the hidden file.', fs: () => ({ home: { you: { 'readme.txt': 'Welcome to the lab. Use "help" for commands. Find the FLAG{...} and type: submit FLAG{...}', Documents: { 'todo.txt': 'buy milk\nlearn linux\nhide the flag better', '.hidden_flag.txt': 'FLAG{dotfiles_are_not_invisible}' }, Pictures: { 'cat.jpg': '[pretend this is a picture of a cat]' } } } }) },
    { ch: 'Ch 1: Basics', name: 'Log hunter', cwd: '/var/log', flag: 'FLAG{grep_finds_needles}', goal: 'A server log has a leaked token somewhere in 39 lines. Do not read it by eye.', hint: 'grep FLAG server.log searches for a word.', fs: () => ({ var: { log: { 'server.log': logLines(), 'empty.log': '' } } }) },
    { ch: 'Ch 1: Basics', name: 'Needle in a haystack', cwd: '/srv', flag: 'FLAG{find_searches_whole_trees}', goal: 'Somewhere under /srv is a file called master.key. Folders go deep.', hint: 'find / -name "master.key" prints every match with its path.', fs: () => ({ srv: { projects: { alpha: { src: { 'main.c': 'int main(){return 0;}' }, docs: { deep: { 'notes.txt': 'nothing here' } } }, beta: { archive: { 'old.key': 'expired key, ignore' } }, gamma: { vault: { deeper: { 'master.key': 'FLAG{find_searches_whole_trees}' } } } } } }) },
    { ch: 'Ch 1: Basics', name: 'Secret code', cwd: '/home/you', flag: 'FLAG{base64_is_not_encryption}', goal: 'A note was "hidden" with Base64. That only looks scrambled.', hint: 'base64 -d message.b64 turns it back into text.', fs: () => ({ home: { you: { 'message.b64': btoa('FLAG{base64_is_not_encryption}'), 'readme.txt': 'The message is in message.b64' } } }) },
    { ch: 'Ch 1: Basics', name: 'The locked drawer', cwd: '/home/you', flag: 'FLAG{permissions_matter}', goal: 'vault.txt exists but you cannot read it. File permissions say who can read, write or run a file.', hint: 'ls -l shows permissions. chmod +r vault.txt gives you read access.', fs: () => ({ home: { you: { 'vault.txt': F('FLAG{permissions_matter}', true), 'readme.txt': 'Look at the permissions column of ls -l' } } }) },
    { ch: 'Ch 1: Basics', name: 'Final exam', cwd: '/home/you', flag: 'FLAG{you_are_a_terminal_wizard}', goal: 'Somewhere on this machine is a hidden file starting with .vault. It is locked and Base64 encoded.', hint: 'find / -name ".vault*" then chmod +r, cat, and base64 -d (you can decode a file or paste text).', fs: () => ({ home: { you: { 'readme.txt': 'Final exam. Combine everything.' } }, opt: { data: { backups: { '.vault_2026': F(btoa('FLAG{you_are_a_terminal_wizard}'), true) } } } }) },

    /* --- Chapter 2: Pipes, Streams & Binary Forensics (7–12) --- */
    { ch: 'Ch 2: Forensics', host: 'fw-lab', name: 'Hidden in plain binary', cwd: '/home/you', flag: 'FLAG{strings_reads_binaries}', goal: 'A firmware dump (firmware.bin) contains raw binary noise with a readable secret embedded inside. Extract readable text without corrupting your screen.', hint: 'Try: strings firmware.bin | grep FLAG', fs: () => ({ home: { you: { 'firmware.bin': makeFakeBin(), 'readme.txt': 'Use file and strings to inspect firmware.bin' } } }) },
    { ch: 'Ch 2: Forensics', host: 'ci-build', name: 'Line by line', cwd: '/opt/ci', flag: 'FLAG{head_and_tail_slice_fast}', goal: 'deploy.sh is 117 lines long. The secret release key was left right near the bottom of the file. Inspect just the last few lines!', hint: 'Try: tail -n 5 deploy.sh', fs: () => ({ opt: { ci: { 'deploy.sh': makeDeployScript(), 'version.txt': '2.4.0' } } }) },
    { ch: 'Ch 2: Forensics', host: 'pkt-cap', name: 'Hex dump mystery', cwd: '/home/you', flag: 'FLAG{xxd_decodes_hex_dumps}', goal: 'An intercepted network payload was saved as hex bytes in capture.hex. Decode the hex back into readable text.', hint: 'Run: xxd -r capture.hex   (or cat capture.hex | xxd -r)', fs: () => ({ home: { you: { 'capture.hex': toHex('FLAG{xxd_decodes_hex_dumps}'), 'notes.txt': 'Hex pairs like 46 4c 41 47 spell ASCII characters.' } } }) },
    { ch: 'Ch 2: Forensics', host: 'cipher-box', name: 'Mirror & rotate', cwd: '/home/you', flag: 'FLAG{pipes_chain_decoders}', goal: 'secret.txt was first ROT13-shifted and then reversed backwards! Chain two commands with a pipe | to restore it in one line.', hint: 'Run: cat secret.txt | rev | rot13', fs: () => ({ home: { you: { 'secret.txt': revStr(rot13Str('FLAG{pipes_chain_decoders}')), 'clue.txt': 'First flip it back with rev, then shift with rot13.' } } }) },
    { ch: 'Ch 2: Forensics', host: 'cfg-node', name: 'Recursive sweep', cwd: '/etc/services', flag: 'FLAG{grep_r_sweeps_folders}', goal: 'Twelve microservice configs live inside /etc/services. One of them leaked api_secret. Search every subfolder at once!', hint: 'Run: grep -rn api_secret /etc/services', fs: () => ({ etc: { services: { auth: { 'app.conf': 'port=8001\nmode=prod' }, billing: { 'app.conf': 'port=8002\ncurrency=USD' }, cache: { 'redis.conf': 'port=6379\nprotected=yes' }, edge: { tls: { 'proxy.conf': 'port=443\ntls=1.3' } }, notify: { 'mail.conf': 'smtp=587\nretry=3' }, payments: { v2: { 'secrets.conf': 'gateway=stripe\napi_secret=FLAG{grep_r_sweeps_folders}' } }, search: { 'index.conf': 'shards=4' } } } }) },
    { ch: 'Ch 2: Forensics', host: 'audit-01', name: 'Sort, unique & outlier', cwd: '/var/audit', flag: 'FLAG{sort_uniq_spots_outliers}', goal: 'tokens.txt has 55 lines — 54 of them repeat over and over, and exactly ONE line appears only once! Find the lone outlier.', hint: 'Chain sort and uniq: sort tokens.txt | uniq -u', fs: () => ({ var: { audit: { 'tokens.txt': makeDupTokens(), 'readme.txt': 'uniq only checks adjacent lines, so always sort first!' } } }) },

    /* --- Chapter 3: Sysadmin & Incident Response (13–18) --- */
    { ch: 'Ch 3: Incident', host: 'prod-k8s', name: 'Environment leak', cwd: '/home/you', flag: 'FLAG{env_leaks_secrets}', goal: 'Nothing is in the files — this container accidentally stored an API secret inside its shell environment variables!', hint: 'Run: env   or   env | grep FLAG', env: { USER: 'you', HOME: '/home/you', SHELL: '/bin/bash', NODE_ENV: 'production', DB_HOST: '10.0.4.12', API_TOKEN: 'FLAG{env_leaks_secrets}', PATH: '/usr/local/bin:/usr/bin:/bin' }, fs: () => ({ home: { you: { 'readme.txt': 'Files are clean. Check the process environment!' } } }) },
    { ch: 'Ch 3: Incident', host: 'cron-srv', name: 'Ghost in the crontab', cwd: '/etc', flag: 'FLAG{cron_persistence_found}', goal: 'An attacker left a scheduled persistence job in /etc/crontab. Read the crontab to see what hidden script runs every minute, unlock it, and read its flag.', hint: 'cat /etc/crontab -> chmod +r <script_path> -> cat <script_path>', fs: () => ({ etc: { 'crontab': '# m h dom mon dow user command\n0 3 * * * root /usr/local/bin/backup.sh\n*/1 * * * * you /var/tmp/.sync_agent.sh\n' }, usr: { local: { bin: { 'backup.sh': '#!/bin/sh\necho backup ok' } } }, var: { tmp: { '.sync_agent.sh': F('#!/bin/sh\n# exfil beacon\nKEY="FLAG{cron_persistence_found}"\n', true) } } }) },
    { ch: 'Ch 3: Incident', host: 'relay-03', name: 'Double-wrapped parcel', cwd: '/home/you', flag: 'FLAG{triple_pipe_master}', goal: 'parcel.dat was wrapped THREE times: Base64 → Hex → Base64! Unwrap all 3 layers in a single pipeline.', hint: 'Run: cat parcel.dat | base64 -d | xxd -r | base64 -d', fs: () => ({ home: { you: { 'parcel.dat': btoa(toHex(btoa('FLAG{triple_pipe_master}'))), 'manifest.txt': 'Layers (outer to inner): Base64 -> Hex -> Base64' } } }) },
    { ch: 'Ch 3: Incident', host: 'fw-edge', name: 'The inverted filter', cwd: '/var/log', flag: 'FLAG{grep_v_inverts_noise}', goal: 'firewall.log is flooded with 48 boring OK_HEARTBEAT lines and ONE anomaly. Invert grep to hide the noise!', hint: 'Run: grep -v OK_HEARTBEAT firewall.log', fs: () => ({ var: { log: { 'firewall.log': makeFirewallNoise() } } }) },
    { ch: 'Ch 3: Incident', host: 'soc-box', name: 'Rogue process', cwd: '/home/you', flag: 'FLAG{ps_spots_rogue_daemons}', goal: 'A suspicious background process is running on this box. Inspect running processes with ps, locate the hidden script it launched, and read the flag!', hint: 'Run: ps aux   then inspect the path shown in /tmp/...', procs: [
      'root       1  0.0  0.1  /sbin/init',
      'root     142  0.1  0.4  /usr/sbin/sshd -D',
      'www      318  0.3  1.2  /usr/sbin/nginx -g daemon off;',
      'you      884  4.9  0.8  /bin/sh /tmp/.kworker_x/beacon.sh',
      'you     1021  0.0  0.1  /bin/bash'
    ], fs: () => ({ home: { you: { 'alert.txt': 'CPU spike detected! Check running processes with ps aux.' } }, tmp: { '.kworker_x': { 'beacon.sh': '#!/bin/sh\n# covert C2 beacon\nTOKEN=FLAG{ps_spots_rogue_daemons}\n' } } }) },
    { ch: 'Ch 3: Incident', host: 'vault-ha', name: 'Two-key nuclear vault', cwd: '/home/you', flag: 'FLAG{dual_custody_unlocked}', goal: 'The launch flag is split into two halves: PART1 is locked in /var/backups/.alpha, and PART2 is Base64-encoded inside /var/log/auth.log. Combine them!', hint: 'chmod +r /var/backups/.alpha && cat /var/backups/.alpha   and   grep PART2 /var/log/auth.log  then base64 -d the value.', fs: () => ({ home: { you: { 'briefing.txt': 'Join PART1 + PART2 with no spaces, then submit.' } }, var: { backups: { '.alpha': F('PART1=FLAG{dual_custody_', true) }, log: { 'auth.log': '08:01 INFO boot ok\n08:04 INFO login ok\n08:19 DEBUG PART2_B64=' + btoa('unlocked}') + '\n08:22 INFO logout' } } }) },

    /* --- Chapter 4: Red-Team & Master CTF (19–24) --- */
    { ch: 'Ch 4: Red Team', host: 'app-07', name: 'Case-insensitive ambush', cwd: '/var/log', flag: 'FLAG{case_insensitive_wins}', goal: 'The developer obfuscated the log key in weird mixed case ("sEcReT_b64="). Search case-insensitively and decode the Base64 value.', hint: 'Run: grep -i secret app.log   then   echo <value> | base64 -d', fs: () => ({ var: { log: { 'app.log': '10:01 INFO worker boot\n10:02 WARN retry=1\n10:03 DEBUG sEcReT_b64=' + btoa('FLAG{case_insensitive_wins}') + '\n10:04 INFO idle' } } }) },
    { ch: 'Ch 4: Red Team', host: 'labyrinth', name: 'The decoy labyrinth', cwd: '/', flag: 'FLAG{real_needle_no_decoys}', goal: 'Five hidden .vault* files are scattered across the disk. Four are FAKE{} decoys! Find them all and extract the real Base64 flag.', hint: 'find / -name ".vault*"  -> inspect each with cat | base64 -d (unlock any locked ones first!)', fs: () => ({
      etc: { '.vault_1': btoa('FAKE{decoy_in_etc}') },
      srv: { app: { '.vault_2': btoa('FAKE{decoy_in_srv}') } },
      tmp: { '.vault_3': btoa('FAKE{decoy_in_tmp}') },
      var: { cache: { '.vault_4': F(btoa('FLAG{real_needle_no_decoys}'), true) } },
      opt: { old: { '.vault_5': btoa('FAKE{decoy_in_opt}') } }
    }) },
    { ch: 'Ch 4: Red Team', host: 'gw-dmz', name: 'Open backdoor port', cwd: '/home/you', flag: 'FLAG{netstat_catches_backdoors}', goal: 'Check listening network ports with netstat (or ss) to find a rogue port above 10000. Read its config in /etc/services.d/, unlock the referenced key, and hex-decode it!', hint: 'netstat -> cat /etc/services.d/port31337.conf -> chmod +r /opt/.bd/key.hex -> xxd -r /opt/.bd/key.hex', ports: [
      'tcp   0.0.0.0:22      LISTEN   142/sshd',
      'tcp   0.0.0.0:443     LISTEN   318/nginx',
      'tcp   127.0.0.1:5432  LISTEN   410/postgres',
      'tcp   0.0.0.0:31337   LISTEN   909/shadowd   <-- /etc/services.d/port31337.conf'
    ], fs: () => ({ home: { you: { 'readme.txt': 'Run netstat or ss to inspect open listening sockets.' } }, etc: { 'services.d': { 'port31337.conf': 'service=shadowd\nport=31337\nkey_file=/opt/.bd/key.hex\nencoding=hex' } }, opt: { '.bd': { 'key.hex': F(toHex('FLAG{netstat_catches_backdoors}'), true) } } }) },
    { ch: 'Ch 4: Red Team', host: 'db-export', name: 'Column surgical strike', cwd: '/srv/exports', flag: 'FLAG{cut_extracts_columns}', goal: 'users.csv has 38 rows (id,username,role,token_b64). Filter the root user, slice out column 4 with cut, and decode Base64 in one pipeline!', hint: 'Run: grep ,root, users.csv | cut -d, -f4 | base64 -d', fs: () => ({ srv: { exports: { 'users.csv': makeUsersCsv() } } }) },
    { ch: 'Ch 4: Red Team', host: 'ir-core', name: 'Incident timeline forensics', cwd: '/home/you', flag: 'FLAG{full_ir_chain_complete}', goal: 'Trace a live breach: check ps aux to spot the intruder process, read its hidden .env.bak in that folder (locked!), then reverse + Base64-decode the secret.', hint: 'ps aux -> chmod +r /var/opt/.drop/.env.bak -> cat /var/opt/.drop/.env.bak | rev | base64 -d', procs: [
      'root       1  0.0  0.1  /sbin/init',
      'root     210  0.1  0.3  /usr/sbin/sshd',
      'you      777  6.4  1.1  /usr/bin/python3 /var/opt/.drop/exfil.py'
    ], fs: () => ({ home: { you: { 'incident.txt': 'IR Ticket #409: Suspicious python process running. Find its folder and decode .env.bak.' } }, var: { opt: { '.drop': { 'exfil.py': '# staged drop', '.env.bak': F(revStr(btoa('FLAG{full_ir_chain_complete}')), true) } } } }) },
    { ch: 'Ch 4: Red Team', host: 'moundshroud-core', name: 'Operation Moundshroud (Finale)', cwd: '/home/you', flag: 'FLAG{moundshroud_grand_master}', goal: 'GRAND FINALE: Check ps aux & env to find the vault path, unlock the hidden file, and unwrap Hex -> Base64 -> ROT13 in one master pipeline!', hint: 'env | grep VAULT  ->  chmod 644 <path>  ->  cat <path> | xxd -r | base64 -d | rot13', env: { USER: 'you', SHELL: '/bin/bash', VAULT_TARGET: '/opt/crown/chamber/.grand_vault', LAYERS: 'hex -> base64 -> rot13' }, procs: [
      'root       1  0.0  0.1  /sbin/init',
      'root     444  0.2  0.5  /opt/crown/guard --vault-env=VAULT_TARGET'
    ], ports: [
      'tcp   127.0.0.1:443   LISTEN   444/guard'
    ], fs: () => ({ home: { you: { 'mission.txt': 'Grand Finale! Inspect env and ps aux to locate the vault.' } }, opt: { crown: { chamber: { '.grand_vault': F(toHex(btoa(rot13Str('FLAG{moundshroud_grand_master}'))), true), '.decoy': 'FAKE{almost_there}' } } } }) },
  ];

  /* ---- Interactive Terminal Academy: 12 Guided Hands-On Lessons (Second Interactive Learning Section) ---- */
  const ACADEMY = [
    {
      id: 'nav', title: '1. Navigating the Filesystem', badge: 'Beginner',
      summary: 'Move around Linux folders without a mouse using pwd, ls, and cd.',
      syntax: 'pwd   ·   ls   ·   cd <folder>   ·   cd ..   ·   cd ~   ·   cd -',
      cwd: '/home/you',
      fs: () => ({ home: { you: { 'welcome.txt': 'Hello hacker!', Projects: { 'alpha.txt': 'Project Alpha', Sub: { 'deep.txt': 'Found deep!' } }, Docs: { 'guide.txt': 'Linux guide' } } } }),
      steps: [
        { prompt: 'Print your current directory path.', example: 'pwd', hint: 'Type pwd and press Enter.', check: (cmd, out) => /^pwd\b/.test(cmd) && out.includes('/home/you') },
        { prompt: 'List the files and folders here.', example: 'ls', hint: 'Type ls and press Enter.', check: (cmd, out) => /^(ls|ll|la)\b/.test(cmd) && out.includes('Projects') },
        { prompt: 'Move into the Projects folder.', example: 'cd Projects', hint: 'Type cd Projects', check: (cmd, out, st) => st.path === '/home/you/Projects' },
        { prompt: 'Jump back to your previous directory using the "-" shortcut.', example: 'cd -', hint: 'Type cd - to toggle back to /home/you', check: (cmd, out, st) => /^cd\s+-/.test(cmd) && st.path === '/home/you' }
      ]
    },
    {
      id: 'hidden', title: '2. Revealing Hidden Dotfiles', badge: 'Beginner',
      summary: 'In Linux, any file starting with a dot (.) is hidden from plain ls. Attackers and configs love dotfiles.',
      syntax: 'ls -a   ·   ls -la   ·   tree -a   ·   cat .hidden',
      cwd: '/home/you',
      fs: () => ({ home: { you: { 'notes.txt': 'nothing secret here', '.env': 'DB_PASS=supersecret42', '.ssh': { 'id_pub': 'ssh-ed25519 AAAAC3...' } } } }),
      steps: [
        { prompt: 'Run plain ls first to see that dotfiles are hidden.', example: 'ls', hint: 'Type ls', check: (cmd, out) => /^ls$/.test(cmd) && out.includes('notes.txt') },
        { prompt: 'Now list ALL files including hidden dotfiles.', example: 'ls -a', hint: 'Add the -a flag: ls -a (or ls -la)', check: (cmd, out) => /^(ls\s+-[a-z]*a|la|ll)/.test(cmd) && out.includes('.env') },
        { prompt: 'Display the full directory tree including hidden files.', example: 'tree -a', hint: 'Type tree -a', check: (cmd, out) => /^tree\s+.*-a/.test(cmd) && out.includes('.env') },
        { prompt: 'Read the hidden .env file.', example: 'cat .env', hint: 'Type cat .env', check: (cmd, out) => out.includes('supersecret42') }
      ]
    },
    {
      id: 'slice', title: '3. Reading & Slicing Big Files', badge: 'Beginner',
      summary: 'Don\'t dump 10,000 lines with cat — slice the top (head), bottom (tail), number lines (cat -n), and count (wc).',
      syntax: 'cat -n <file>   ·   head -n 3 <file>   ·   tail -n 3 <file>   ·   wc -l <file>',
      cwd: '/var/log',
      fs: () => ({ var: { log: { 'events.log': Array.from({ length: 20 }, (_, i) => 'event #' + (i + 1) + (i === 18 ? ' SECRET=TAIL_WIN' : ' status=ok')).join('\n') } } }),
      steps: [
        { prompt: 'Count how many lines are in events.log.', example: 'wc -l events.log', hint: 'Use wc -l events.log', check: (cmd, out) => /^wc\b/.test(cmd) && out.includes('20') },
        { prompt: 'Show only the first 3 lines of events.log.', example: 'head -n 3 events.log', hint: 'Use head -n 3 events.log', check: (cmd, out) => /^head\b/.test(cmd) && out.includes('event #1') && !out.includes('event #10') },
        { prompt: 'Show the last 3 lines of events.log to spot the secret.', example: 'tail -n 3 events.log', hint: 'Use tail -n 3 events.log', check: (cmd, out) => /^tail\b/.test(cmd) && out.includes('TAIL_WIN') }
      ]
    },
    {
      id: 'grep', title: '4. Surgical Searching with grep', badge: 'Beginner',
      summary: 'grep finds matching lines instantly. Master -i (ignore case), -n (line numbers), -v (invert), and -r (recursive).',
      syntax: 'grep [-i] [-n] [-v] [-r] <pattern> <file|dir>',
      cwd: '/var/log',
      fs: () => ({ var: { log: { 'auth.log': 'INFO ok\nINFO ok\nWARN Token=Alpha99\nINFO ok', sub: { 'deep.log': 'DEBUG secret_code=GREP_R_PRO' } } } }),
      steps: [
        { prompt: 'Search auth.log case-insensitively for "token" with line numbers.', example: 'grep -in token auth.log', hint: 'Type: grep -in token auth.log', check: (cmd, out) => /^grep\b/.test(cmd) && out.includes('3:') && out.includes('Alpha99') },
        { prompt: 'Use grep -v to show every line in auth.log EXCEPT "INFO".', example: 'grep -v INFO auth.log', hint: 'Type: grep -v INFO auth.log', check: (cmd, out) => /^grep\b.*-v/.test(cmd) && out.includes('Alpha99') && !out.includes('INFO') },
        { prompt: 'Search recursively across /var/log for "secret_code".', example: 'grep -r secret_code /var/log', hint: 'Type: grep -r secret_code /var/log (or grep -r secret_code .)', check: (cmd, out) => /^grep\b.*-[a-z]*r/i.test(cmd) && out.includes('GREP_R_PRO') }
      ]
    },
    {
      id: 'find', title: '5. Hunting Files with find', badge: 'Intermediate',
      summary: 'When you don\'t know which folder a file is in, find walks the entire tree using wildcards (*), -iname, and -type.',
      syntax: 'find <dir> -name "*.key"   ·   find / -iname "secret*" -type f',
      cwd: '/',
      fs: () => ({ srv: { a: { b: { 'Old.KEY': 'expired' } }, c: { d: { 'Master.Key': 'FIND_SUCCESS' } } }, opt: { empty: {} } }),
      steps: [
        { prompt: 'List everything under /srv using bare find.', example: 'find /srv', hint: 'Type: find /srv', check: (cmd, out) => /^find\b/.test(cmd) && out.includes('Master.Key') },
        { prompt: 'Use case-insensitive -iname to find all *.key files under /.', example: 'find / -iname "*.key"', hint: 'Type: find / -iname "*.key"', check: (cmd, out) => /^find\b.*-iname/.test(cmd) && out.includes('Master.Key') },
        { prompt: 'Read the Master.Key file you found.', example: 'cat /srv/c/d/Master.Key', hint: 'Type: cat /srv/c/d/Master.Key', check: (cmd, out) => out.includes('FIND_SUCCESS') }
      ]
    },
    {
      id: 'chmod', title: '6. Linux Permissions & chmod', badge: 'Intermediate',
      summary: 'Files with ---------- permissions cannot be read. Inspect them with ls -l or stat, then unlock with chmod +r or chmod 644.',
      syntax: 'ls -l <file>   ·   stat <file>   ·   chmod +r <file>   ·   chmod 644 <file>',
      cwd: '/home/you',
      fs: () => ({ home: { you: { 'safe.txt': F('UNLOCKED_644', true) } } }),
      steps: [
        { prompt: 'Inspect safe.txt permissions using ls -l.', example: 'ls -l safe.txt', hint: 'Type: ls -l safe.txt', check: (cmd, out) => /^(ls\s+-[a-z]*l|ll)/.test(cmd) && out.includes('----------') },
        { prompt: 'Unlock safe.txt using octal mode 644 or add owner read access.', example: 'chmod 644 safe.txt', hint: 'Type: chmod 644 safe.txt (or chmod u+r safe.txt)', check: (cmd, out, st) => /^chmod\b/.test(cmd) && st.canRead('safe.txt') },
        { prompt: 'Now read the unlocked safe.txt.', example: 'cat safe.txt', hint: 'Type: cat safe.txt', check: (cmd, out) => out.includes('UNLOCKED_644') }
      ]
    },
    {
      id: 'pipes', title: '7. Pipes (|) & Command Chaining (&&)', badge: 'Intermediate',
      summary: 'The pipe | sends one command\'s output straight into the next command. && runs a second command only if the first succeeds.',
      syntax: 'cmd1 | cmd2 | cmd3   ·   cd folder && ls -a',
      cwd: '/home/you',
      fs: () => ({ home: { you: { logs: { 'web.log': '200 /home\n404 /admin\n200 /docs\n404 /.env\n404 /wp-login\n200 /api' } } } }),
      steps: [
        { prompt: 'Chain cd and ls in ONE line using && to enter logs and list it.', example: 'cd logs && ls', hint: 'Type: cd logs && ls', check: (cmd, out, st) => cmd.includes('&&') && st.path === '/home/you/logs' && out.includes('web.log') },
        { prompt: 'Pipe cat web.log into grep 404 to isolate failed probes.', example: 'cat web.log | grep 404', hint: 'Type: cat web.log | grep 404', check: (cmd, out) => cmd.includes('|') && out.includes('/.env') && !out.includes('/docs') },
        { prompt: 'Add a 3rd pipe stage (wc -l) to count how many 404 lines exist.', example: 'cat web.log | grep 404 | wc -l', hint: 'Type: cat web.log | grep 404 | wc -l', check: (cmd, out) => (cmd.match(/\|/g) || []).length >= 2 && /\b3\b/.test(out) }
      ]
    },
    {
      id: 'decode', title: '8. Decoding: Base64, Hex, ROT13 & Rev', badge: 'Intermediate',
      summary: 'CTFs and malware hide strings with encodings. Chain base64 -d, xxd -r, rot13, and rev right in your terminal.',
      syntax: 'base64 -d <f>   ·   xxd -r <f>   ·   rot13 <f>   ·   rev <f>',
      cwd: '/home/you',
      fs: () => ({ home: { you: { 'one.b64': btoa('B64_DECODED'), 'two.hex': toHex('HEX_DECODED'), 'combo.txt': revStr(rot13Str('COMBO_CRACKED')) } } }),
      steps: [
        { prompt: 'Decode one.b64 with base64 -d.', example: 'base64 -d one.b64', hint: 'Type: base64 -d one.b64', check: (cmd, out) => out.includes('B64_DECODED') },
        { prompt: 'Decode two.hex with xxd -r.', example: 'xxd -r two.hex', hint: 'Type: xxd -r two.hex', check: (cmd, out) => out.includes('HEX_DECODED') },
        { prompt: 'Decode combo.txt (reversed + ROT13) in one pipeline.', example: 'cat combo.txt | rev | rot13', hint: 'Type: cat combo.txt | rev | rot13', check: (cmd, out) => out.includes('COMBO_CRACKED') }
      ]
    },
    {
      id: 'wrangle', title: '9. Data Wrangling: sort, uniq, cut, tr', badge: 'Advanced',
      summary: 'Slice structured logs and CSVs like a pro: sort lines, find unique outliers with uniq -u, extract columns with cut, and transform text with tr.',
      syntax: 'sort <f> | uniq -u   ·   cut -d, -f3 <csv>   ·   tr a-z A-Z',
      cwd: '/home/you',
      fs: () => ({ home: { you: { 'dupes.txt': 'apple\nbanana\napple\nOUTLIER_KEY\nbanana', 'staff.csv': 'id,name,role\n1,alice,user\n2,bob,admin\n3,carol,user' } } }),
      steps: [
        { prompt: 'Find the single unique line in dupes.txt using sort | uniq -u.', example: 'sort dupes.txt | uniq -u', hint: 'Type: sort dupes.txt | uniq -u', check: (cmd, out) => cmd.includes('uniq') && out.includes('OUTLIER_KEY') && !out.includes('apple') },
        { prompt: 'Extract the username column (field 2) of the admin row in staff.csv.', example: 'grep admin staff.csv | cut -d, -f2', hint: 'Type: grep admin staff.csv | cut -d, -f2', check: (cmd, out) => cmd.includes('cut') && out.trim() === 'bob' },
        { prompt: 'Convert "moundshroud" to uppercase using echo and tr.', example: 'echo moundshroud | tr a-z A-Z', hint: 'Type: echo moundshroud | tr a-z A-Z', check: (cmd, out) => cmd.includes('tr') && out.includes('MOUNDSHROUD') }
      ]
    },
    {
      id: 'bin', title: '10. Binary Forensics: file & strings', badge: 'Advanced',
      summary: 'Never cat unknown binaries! Run file to identify what it is, and strings to pull out readable ASCII runs.',
      syntax: 'file <path>   ·   strings <bin> | grep <word>',
      cwd: '/home/you',
      fs: () => ({ home: { you: { 'mystery.bin': '\x00\x02\x05ELF\x00\x01junk\x00\x00BUILD_ID=BIN_PRO_42\x00\x03', 'enc.dat': btoa('hidden_b64_payload') } } }),
      steps: [
        { prompt: 'Use file to inspect enc.dat.', example: 'file enc.dat', hint: 'Type: file enc.dat', check: (cmd, out) => /^file\b/.test(cmd) && /Base64/i.test(out) },
        { prompt: 'Extract the BUILD_ID string hidden inside mystery.bin.', example: 'strings mystery.bin | grep BUILD', hint: 'Type: strings mystery.bin | grep BUILD', check: (cmd, out) => cmd.includes('strings') && out.includes('BIN_PRO_42') }
      ]
    },
    {
      id: 'recon', title: '11. Live System Recon: env, ps, netstat', badge: 'Advanced',
      summary: 'During incident response, secrets and malware hide in memory, environment variables, and listening ports — not just disk files.',
      syntax: 'env   ·   ps aux   ·   netstat   ·   ss',
      cwd: '/home/you',
      env: { USER: 'you', SERVICE_KEY: 'ENV_RECON_OK', SHELL: '/bin/bash' },
      procs: ['root   1  0.0  /sbin/init', 'you  512  2.1  /bin/sh /tmp/.hidden_bot.sh'],
      ports: ['tcp  0.0.0.0:22    LISTEN  142/sshd', 'tcp  0.0.0.0:9999  LISTEN  512/hidden_bot'],
      fs: () => ({ home: { you: { 'readme.txt': 'Try env, ps aux, and netstat!' } }, tmp: { '.hidden_bot.sh': '# BOT_ID=BOT_CAUGHT' } }),
      steps: [
        { prompt: 'Find the SERVICE_KEY inside environment variables.', example: 'env | grep SERVICE', hint: 'Type: env (or env | grep SERVICE)', check: (cmd, out) => /^(env|printenv)\b/.test(cmd) && out.includes('ENV_RECON_OK') },
        { prompt: 'List running processes with ps aux to find the rogue script.', example: 'ps aux', hint: 'Type: ps aux', check: (cmd, out) => /^ps\b/.test(cmd) && out.includes('.hidden_bot.sh') },
        { prompt: 'Check listening ports with netstat (or ss) to see its port.', example: 'netstat', hint: 'Type: netstat (or ss)', check: (cmd, out) => /^(netstat|ss)\b/.test(cmd) && out.includes('9999') },
        { prompt: 'Read the rogue script /tmp/.hidden_bot.sh.', example: 'cat /tmp/.hidden_bot.sh', hint: 'Type: cat /tmp/.hidden_bot.sh', check: (cmd, out) => out.includes('BOT_CAUGHT') }
      ]
    },
    {
      id: 'boss', title: '12. Graduation Drill: Full Red-Team Chain', badge: 'Master',
      summary: 'Put EVERY skill together: hunt a locked hidden file, unlock it, and unwrap Hex → Base64 in one pipeline!',
      syntax: 'find / -name ".grad*"  →  chmod +r  →  cat | xxd -r | base64 -d',
      cwd: '/home/you',
      fs: () => ({ home: { you: { 'brief.txt': 'Find .grad_key under /opt, unlock it, and decode Hex -> Base64!' } }, opt: { academy: { '.grad_key': F(toHex(btoa('ACADEMY_GRADUATE')), true) } } }),
      steps: [
        { prompt: 'Find the hidden file starting with ".grad" anywhere under /.', example: 'find / -name ".grad*"', hint: 'Type: find / -name ".grad*"', check: (cmd, out) => /^find\b/.test(cmd) && out.includes('/opt/academy/.grad_key') },
        { prompt: 'Unlock /opt/academy/.grad_key with chmod.', example: 'chmod u+r /opt/academy/.grad_key', hint: 'Type: chmod u+r /opt/academy/.grad_key', check: (cmd, out, st) => /^chmod\b/.test(cmd) && st.canRead('/opt/academy/.grad_key') },
        { prompt: 'Unwrap Hex then Base64 in one pipeline to graduate!', example: 'cat /opt/academy/.grad_key | xxd -r | base64 -d', hint: 'Type: cat /opt/academy/.grad_key | xxd -r | base64 -d', check: (cmd, out) => out.includes('ACADEMY_GRADUATE') }
      ]
    }
  ];

  /* ---- Procedural Infinite Linux CTF Generator ---- */
  const T_HOSTS = ['bastion-01', 'db-prod', 'edge-gw', 'auth-04', 'ci-runner', 'mail-relay', 'vault-09', 'soc-node', 'k8s-worker', 'dev-stage'];
  const T_TOPICS = ['alpha', 'nexus', 'kronos', 'cobalt', 'prism', 'atlas', 'orion', 'zephyr', 'vortex', 'helix', 'ember', 'cipher', 'sentinel', 'aegis'];
  const T_SUBS = ['configs', 'staging', 'releases', 'archives', 'backups', 'secrets', 'runtime', 'snapshots', 'cache', 'telemetry', 'deploy', 'certs'];
  const T_LOG_MSGS = ['healthcheck 200 ok', 'tls handshake complete', 'worker heartbeat', 'cache miss /api/items', 'session rotated', 'cron job finished', 'metric flush 42 rows', 'jwt verified', 'rate limiter ok', 'replica synced', 'db pool idle=4', 'dns lookup cached'];
  const makeFlag = (tag) => 'FLAG{' + tag + '_' + pick(T_TOPICS) + '_' + rndRange(100, 999) + '}';
  const makeNoiseLog = (count, secretLine) => {
    const out = [], lv = ['INFO', 'INFO', 'INFO', 'WARN', 'DEBUG'];
    let sec = 32400 + rnd(7200);
    for (let i = 0; i < count; i++) {
      sec += 3 + rnd(19);
      const hh = String((sec / 3600 | 0) % 24).padStart(2, '0'), mm = String((sec % 3600 / 60 | 0)).padStart(2, '0'), ss = String(sec % 60).padStart(2, '0');
      out.push('2026-11-19 ' + hh + ':' + mm + ':' + ss + ' [' + pick(lv) + '] ' + pick(T_LOG_MSGS) + ' req=' + (1000 + rnd(8999)));
    }
    const pos = Math.max(4, rnd(count - 4));
    out.splice(pos, 0, secretLine);
    return out.join('\n');
  };
  function setPath(root, parts, val) {
    let cur = root;
    for (let i = 0; i < parts.length - 1; i++) {
      if (!cur[parts[i]] || typeof cur[parts[i]] !== 'object' || cur[parts[i]]._f) cur[parts[i]] = {};
      cur = cur[parts[i]];
    }
    cur[parts[parts.length - 1]] = val;
  }
  function makeProceduralMission(num, diff) {
    const host = pick(T_HOSTS);
    const d1 = pick(T_TOPICS), d2 = pick(T_SUBS), d3 = pick(T_SUBS.filter(x => x !== d2));
    const decoy1 = pick(T_TOPICS.filter(x => x !== d1)), decoy2 = pick(T_TOPICS.filter(x => x !== d1 && x !== decoy1));
    const tier = diff === 'easy' ? (1 + rnd(3)) : diff === 'med' ? (3 + rnd(3)) : diff === 'hard' ? (6 + rnd(3)) : (1 + rnd(8));
    const baseTree = () => ({
      home: { you: { 'notes.txt': 'Target host: ' + host + '\nRemember: help, find, grep, ls -la, chmod +r, base64 -d, xxd -r, rot13, rev, env, ps, netstat' } },
      etc: { 'hostname': host, 'motd': 'Authorized sandbox access only.' },
      var: { log: { 'syslog': makeNoiseLog(18, '2026-11-19 09:12:04 [INFO] systemd started cleanly') } },
      srv: { [decoy1]: { [pick(T_SUBS)]: { 'README.md': 'Service ' + decoy1 + ' (nothing sensitive here)', 'old.conf': 'mode=production\ndebug=false' } } },
      opt: { [decoy2]: { 'status.txt': 'service online\nFAKE{decoy_keep_looking}' } }
    });

    if (tier === 1) {
      const fname = '.' + pick(['secret', 'env', 'token', 'key', 'creds']) + '_' + rndRange(10, 99);
      const flag = makeFlag('dotfile');
      const folder = pick(['Documents', 'Workspace', 'Configs', 'Projects']);
      return {
        endless: true, num, diff: 1, host, name: 'Hidden Dotfile #' + num, cwd: '/home/you', flag,
        goal: 'A hidden file was dropped inside /home/you/' + folder + '. Locate it and submit the flag.',
        hint: 'Run: cd ' + folder + ' && ls -la   then cat ' + fname,
        fs: () => { const t = baseTree(); setPath(t, ['home', 'you', folder, 'readme.txt'], 'Check hidden files too.'); setPath(t, ['home', 'you', folder, '.ignore'], 'nothing here'); setPath(t, ['home', 'you', folder, fname], 'token=' + flag); return t; }
      };
    }
    if (tier === 2) {
      const logName = pick(['auth.log', 'nginx.log', 'api.log', 'app.log', 'audit.log']);
      const flag = makeFlag('loggrep');
      const nLines = 45 + rnd(45);
      return {
        endless: true, num, diff: 2, host, name: 'Log Forensics #' + num, cwd: '/var/log', flag,
        goal: 'A credential leaked inside /var/log/' + logName + ' (' + nLines + '+ lines). Extract the FLAG{...} with grep.',
        hint: 'Run: grep -in flag ' + logName,
        fs: () => { const t = baseTree(); setPath(t, ['var', 'log', logName], makeNoiseLog(nLines, '2026-11-19 11:42:19 [DEBUG] session_dump=' + flag)); return t; }
      };
    }
    if (tier === 3) {
      const targetFile = pick(['master.key', 'deploy.token', 'root.cred', 'signing.pem', 'vault.dat']);
      const flag = makeFlag('deepfind');
      return {
        endless: true, num, diff: 2, host, name: 'Deep Tree Hunt #' + num, cwd: '/srv', flag,
        goal: 'Find the file named "' + targetFile + '" buried somewhere under /srv or /opt.',
        hint: 'Run: find / -name "' + targetFile + '"   then cat the matching path.',
        fs: () => { const t = baseTree(); setPath(t, ['srv', d1, d2, d3, targetFile], flag); setPath(t, ['opt', decoy2, 'expired.key'], 'FAKE{expired_key}'); return t; }
      };
    }
    if (tier === 4) {
      const kind = pick(['b64', 'b64x2', 'hex', 'rot13', 'rev']);
      const flag = makeFlag(kind);
      const encoded = kind === 'b64' ? btoa(flag) : kind === 'b64x2' ? btoa(btoa(flag)) : kind === 'hex' ? toHex(flag) : kind === 'rot13' ? rot13Str(flag) : revStr(flag);
      const fname = kind === 'hex' ? 'payload.hex' : kind === 'rot13' ? 'cipher.rot' : kind === 'rev' ? 'mirror.txt' : 'artifact.b64';
      const hintMap = { b64: 'base64 -d ' + fname, b64x2: 'cat ' + fname + ' | base64 -d | base64 -d', hex: 'xxd -r ' + fname, rot13: 'rot13 ' + fname, rev: 'rev ' + fname };
      return {
        endless: true, num, diff: 3, host, name: 'Encoded Artifact #' + num, cwd: '/home/you', flag,
        goal: 'An encoded payload sits in /home/you/' + fname + ' (' + (kind === 'b64x2' ? 'double Base64' : kind.toUpperCase()) + '). Decode it using shell tools.',
        hint: 'Run: ' + hintMap[kind],
        fs: () => { const t = baseTree(); setPath(t, ['home', 'you', fname], encoded); return t; }
      };
    }
    if (tier === 5) {
      const fname = pick(['vault.sec', 'secrets.env', 'keyring.txt', 'private.key']);
      const flag = makeFlag('chmod');
      return {
        endless: true, num, diff: 3, host, name: 'Locked Vault #' + num, cwd: '/opt', flag,
        goal: 'Locate "' + fname + '" under /opt, fix its unreadable file permissions, and extract the flag.',
        hint: 'find /opt -name "' + fname + '"  ->  chmod +r <path>  ->  cat <path>',
        fs: () => { const t = baseTree(); setPath(t, ['opt', d1, d2, fname], F(flag, true)); return t; }
      };
    }
    if (tier === 6) {
      const logName = pick(['gateway.log', 'proxy.log', 'worker.log']);
      const flag = makeFlag('pipe');
      const b64 = btoa(flag);
      return {
        endless: true, num, diff: 4, host, name: 'Log + Base64 Pipeline #' + num, cwd: '/var/log', flag,
        goal: 'A Base64-encoded secret is buried inside /var/log/' + logName + ' marked with "LEAK=". Find and decode it.',
        hint: 'grep LEAK ' + logName + '   then   echo <base64_value> | base64 -d',
        fs: () => { const t = baseTree(); setPath(t, ['var', 'log', logName], makeNoiseLog(55, '2026-11-19 14:07:33 [WARN] LEAK=' + b64)); return t; }
      };
    }
    if (tier === 7) {
      const halfA = 'FLAG{' + pick(T_TOPICS) + '_';
      const halfB = pick(T_SUBS) + '_' + rndRange(100, 999) + '}';
      const flag = halfA + halfB;
      return {
        endless: true, num, diff: 5, host, name: 'Split-Key Heist #' + num, cwd: '/home/you', flag,
        goal: 'The flag was split in two! Find PART1 (locked file under /srv) and PART2 (hidden dotfile under /opt), then combine and submit.',
        hint: 'find /srv -name "*part1*" (chmod +r then cat) and find /opt -name ".*part2*" (cat). Join both halves.',
        fs: () => { const t = baseTree(); setPath(t, ['srv', d1, d2, 'part1.key'], F('PART1=' + halfA, true)); setPath(t, ['opt', d2, d3, '.part2.key'], 'PART2=' + halfB); return t; }
      };
    }
    const fname = '.vault_' + pick(T_TOPICS) + '_' + rndRange(10, 99);
    const flag = makeFlag('blackbox');
    const dbl = btoa(btoa(flag));
    return {
      endless: true, num, diff: 6, host, name: 'Black-Box Boss Raid #' + num, cwd: '/home/you', flag,
      goal: 'Full red-team combo: somewhere on this machine is a hidden file starting with ".vault_". It is locked AND double-Base64 encoded. Watch out for FAKE{} decoys!',
      hint: 'find / -name ".vault_*"  ->  chmod +r <path>  ->  cat <path> | base64 -d | base64 -d',
      fs: () => { const t = baseTree(); setPath(t, ['opt', d1, d2, d3, fname], F(dbl, true)); setPath(t, ['srv', d1, '.vault_decoy'], btoa('FAKE{nice_try_keep_digging}')); return t; }
    };
  }
  L.terminal = { makeMission: makeProceduralMission, MIS, ACADEMY };

  const isDir = n => n && typeof n === 'object' && !n._f && !Object.hasOwn(n, 'text');
  const rd = n => typeof n === 'string' ? n : (n.c ?? n.text);
  const isLocked = n => !isDir(n) && !(TerminalUnix.mode(n) & 0o400);
  const HELP_SECTIONS = [
    {
      title: 'NAVIGATION',
      items: [
        ['pwd', 'Print the current working directory'],
        ['ls [-a] [-l] [path...]', 'List files (-a hidden, -l details)'],
        ['ll / la [path]', 'Shortcuts for ls -la and ls -a'],
        ['cd [dir | ~ | -]', 'Change folder (.. up, ~ home, - back)'],
        ['tree [-a] [dir]', 'Show directory tree'],
      ]
    },
    {
      title: 'FILES & SEARCH',
      items: [
        ['cat [-n] <file...>', 'Print file contents (-n line numbers)'],
        ['head / tail [-n N] <f>', 'First or last N lines (default 10)'],
        ['grep [-inrvcl] <pat> [f]', 'Search text (-i case, -n lines, -v invert, -r tree)'],
        ['find [dir] [-name <pat>]', 'Find files (-iname ignore case, -type f|d)'],
        ['wc / strings / stat / file', 'Count, binary strings, metadata, file type'],
      ]
    },
    {
      title: 'DECODING & PERMISSIONS',
      items: [
        ['base64 [-d] [file|text]', 'Encode or decode (-d/--decode) Base64'],
        ['xxd [-r] [file|text]', 'Hex encode or decode (-r) text/files'],
        ['rot13 / rev [file|text]', 'ROT13 decode or reverse text/files'],
        ['chmod <mode> <file...>', 'Change permissions (+r, u+r, 644, -r)'],
      ]
    },
    {
      title: 'WRANGLING & SYSTEM RECON',
      items: [
        ['sort [-rnu] / uniq [-udc]', 'Sort lines & find unique outliers (-u)'],
        ['cut -d<c> -f<N> / tr', 'Extract CSV columns & translate characters'],
        ['env / ps [aux] / netstat', 'Environment vars, running processes, open ports'],
      ]
    },
    {
      title: 'SHELL, CAMPAIGN, ACADEMY & ∞ CTF',
      items: [
        ['echo / whoami / id / uname', 'Print text, user, hostname, system info'],
        ['history / clear', 'Show command history / clear screen'],
        ['hint / skip / reset', 'Get a hint, skip, or restart mission'],
        ['missions / mission <1-24>', 'List 24 campaign missions or jump to one'],
        ['academy / endless / next', 'Open 🎓 Academy or fresh ∞ procedural CTF'],
        ['submit FLAG{...}', 'Submit a flag to finish the mission'],
      ]
    }
  ];
  const CMD_DOCS = {
    pwd: ['pwd', 'Print the absolute path of the current directory.', 'pwd'],
    ls: ['ls [-a] [-l] [-1] [path...]', 'List directory contents or file metadata.\n  -a  include hidden files (starting with .)\n  -l  long format with permissions and byte size\n  -1  one entry per line', 'ls -la Documents'],
    ll: ['ll [path...]', 'Alias for ls -la.', 'll'],
    la: ['la [path...]', 'Alias for ls -a.', 'la'],
    cd: ['cd [dir | ~ | -]', 'Change the current directory.\n  ..  parent directory\n  ~   home directory\n  -   previous directory', 'cd Documents'],
    tree: ['tree [-a] [dir]', 'Display a visual tree of directories and files.\n  -a  include hidden files', 'tree -a /srv'],
    cat: ['cat [-n] <file...>', 'Print the contents of one or more files (or piped input).\n  -n  prefix each line with its line number', 'cat -n readme.txt'],
    head: ['head [-n N | -N] [file]', 'Show the first N lines of a file or piped input (default 10).', 'head -n 5 server.log'],
    tail: ['tail [-n N | -N] [file]', 'Show the last N lines of a file or piped input (default 10).', 'tail -n 5 server.log'],
    grep: ['grep [-i] [-n] [-r] [-v] [-c] [-l] <pattern> [file...]', 'Search for text in files, directories (-r), or piped input.\n  -i  case-insensitive match\n  -n  show line numbers\n  -r  search directories recursively\n  -v  show non-matching lines\n  -c  print only the count of matches\n  -l  print only matching filenames', 'grep -in flag server.log'],
    find: ['find [dir] [-name|-iname <pattern>] [-type f|d]', 'Walk a directory tree and print matching paths.\n  -name   wildcard match (* and ?)\n  -iname  case-insensitive wildcard match\n  -type   f for files, d for directories', 'find / -name ".vault*"'],
    sort: ['sort [-r] [-n] [-u] [file]', 'Sort lines of a file or piped input.\n  -r  reverse order   -n  numeric sort   -u  unique lines only', 'sort tokens.txt | uniq -u'],
    uniq: ['uniq [-u] [-d] [-c] [file]', 'Filter adjacent duplicate lines (pair with sort first!).\n  -u  only lines appearing once   -d  only duplicates   -c  prefix counts', 'sort tokens.txt | uniq -u'],
    cut: ['cut -d<delim> -f<N> [file]', 'Extract field N (1-based) split by delimiter character.', 'grep ,root, users.csv | cut -d, -f4'],
    tr: ['tr [-d] <set1> [set2]', 'Translate characters from set1 to set2, or delete set1 with -d.', 'echo hello | tr a-z A-Z'],
    env: ['env', 'Print environment variables of this sandbox container.', 'env | grep FLAG'],
    printenv: ['printenv [NAME]', 'Print all environment variables or one named variable.', 'printenv API_TOKEN'],
    ps: ['ps [aux]', 'List simulated running processes on this machine.', 'ps aux'],
    netstat: ['netstat [-tulnp]', 'List simulated listening network sockets and ports.', 'netstat'],
    ss: ['ss [-tulnp]', 'Modern alias for netstat showing listening ports.', 'ss'],
    wc: ['wc [-l] [-w] [-c] [file...]', 'Count lines (-l), words (-w), and bytes (-c). Works with pipes.', 'wc -l server.log'],
    strings: ['strings [file]', 'Print readable text runs from a file or piped input.', 'strings firmware.bin | grep FLAG'],
    stat: ['stat <path...>', 'Show file type, byte size, and permission mode.', 'stat vault.txt'],
    file: ['file <path...>', 'Describe what kind of file or directory a path is.', 'file message.b64'],
    base64: ['base64 [-d|--decode] [file | text]', 'Encode or decode Base64 from a file, raw text, or piped input.\n  -d, -D, --decode  decode Base64 back to plain text', 'base64 -d message.b64   |   cat message.b64 | base64 -d'],
    xxd: ['xxd [-r] [file | text]', 'Convert text to hex, or decode hex back to ASCII with -r.', 'xxd -r capture.hex   |   cat capture.hex | xxd -r'],
    rot13: ['rot13 [file | text]', 'Apply ROT13 cipher to a file, text, or piped input.', 'rot13 secret.txt'],
    rev: ['rev [file | text]', 'Reverse characters of a file, text, or piped input.', 'rev secret.txt'],
    chmod: ['chmod <mode> <file...>', 'Change read permissions on files.\n  Unlock examples: +r, u+r, a+r, +rw, 644, 400, 755\n  Lock examples:   -r, a-r, 000', 'chmod +r vault.txt   |   chmod 644 vault.txt'],
    echo: ['echo [-n] <text...>', 'Print text to output. Useful with pipes.', 'echo RkxBR3t0ZXN0fQ== | base64 -d'],
    clear: ['clear', 'Clear the terminal output buffer (shortcut: Ctrl+L).', 'clear'],
    history: ['history', 'List previously entered commands in this session.', 'history'],
    whoami: ['whoami', 'Print the current simulated username.', 'whoami'],
    id: ['id', 'Print simulated user and group IDs.', 'id'],
    uname: ['uname [-a]', 'Print simulated operating system info.', 'uname -a'],
    hostname: ['hostname', 'Print the simulated machine hostname.', 'hostname'],
    help: ['help [command]', 'Show all available commands, or detailed help for one command.', 'help grep'],
    man: ['man <command>', 'Show the manual entry for a command (same as help <command>).', 'man find'],
    hint: ['hint', 'Display a hint for the active mission or lesson step.', 'hint'],
    skip: ['skip', 'Skip ahead to the next mission or lesson.', 'skip'],
    reset: ['reset', 'Reset the current mission/lesson filesystem and working directory.', 'reset'],
    missions: ['missions', 'List all 24 campaign missions and show your progress.', 'missions'],
    mission: ['mission <1-24>', 'Switch directly to campaign mission number 1 through 24.', 'mission 7'],
    academy: ['academy [1-12]', 'Open the 🎓 Interactive Terminal Academy (12 hands-on lessons).', 'academy 4'],
    endless: ['endless [easy|med|hard]', 'Enter infinite procedural Linux CTF mode with Elo rating.', 'endless hard'],
    next: ['next', 'Generate a brand-new procedural ∞ CTF mission immediately.', 'next'],
    submit: ['submit <FLAG{...}>', 'Submit the flag you found to complete the current mission.', 'submit FLAG{example}'],
  };

  function mountTerminalApp(el, api, initialMode) {
    const R = makeRating('cyterm');
    let mi = Math.min(MIS.length - 1, num('cyterm', 0)), doneCount = num('cyterm', 0);
    let view = initialMode || 'campaign'; // 'campaign' | 'academy' | 'endless'
    let endlessNum = num('cyterm_inf', 0), endlessDiff = 'auto', activeMis = MIS[mi];
    let acadIdx = 0, acadStep = 0;
    let acadDone = new Set();
    try { JSON.parse(ls.get('cyacad_done', '[]')).forEach(id => acadDone.add(id)); } catch (e) { }
    let tree, cwd, prevCwd = null, hist = [], hp = 0, hinted = false;
    el.style.alignItems = 'stretch';
    el.innerHTML = '<div id="tbox" class="term-fs-box" style="width:min(860px,100%);margin:0 auto;display:flex;flex-direction:column;height:100%;min-height:420px">' +
      '<div class="row" style="gap:6px;flex-wrap:wrap;margin-bottom:6px;align-items:center">' +
        btn('tcamp', 'Campaign (1–24)') +
        btn('tacad', '🎓 Academy (12)') +
        btn('tinf', '∞ Endless CTF') +
        '<select id="tmis" class="ib" style="padding:4px 8px;max-width:240px"></select>' +
        '<select id="tlesson" class="ib" style="padding:4px 8px;max-width:260px;display:none"></select>' +
        '<select id="tdiff" class="ib" style="padding:4px 8px;display:none"><option value="auto">Adaptive</option><option value="easy">Easy</option><option value="med">Medium</option><option value="hard">Hard</option></select>' +
        btn('tnew', 'New ∞ Mission') +
        '<span class="sp"></span>' +
        btn('ttry', '⚡ Try Example') +
        btn('thint', 'Hint') +
        btn('tfs', '⛶ Fullscreen') +
      '</div>' +
      '<div id="tg" class="small" style="' + box + ';margin-bottom:8px"></div>' +
      '<div id="to" class="term-fs-out" style="flex:1;overflow:auto;background:#05070b;color:#c9f5d4;' + mono + ';font-size:13px;line-height:1.5;border:1px solid var(--line);border-radius:10px;padding:12px 14px;white-space:pre-wrap;min-height:220px;user-select:text;-webkit-user-select:text;cursor:text"></div>' +
      '<div id="tprow" class="row term-fs-prompt-row" style="gap:6px;margin-top:6px;background:#05070b;border:1px solid var(--line);border-radius:10px;padding:6px 10px"><span id="tp" style="color:#6cf;' + mono + ';font-size:13px;white-space:nowrap"></span><input id="ti" autocomplete="off" spellcheck="false" style="flex:1;background:transparent;border:0;color:#fff;' + mono + ';font-size:13px;outline:none"></div>' +
    '</div>';

    const out = (t, c) => { const o = $('to'); const d = document.createElement('div'); d.textContent = t; if (c) d.style.color = c; o.appendChild(d); o.scrollTop = o.scrollHeight; };
    const outPre = (html, plain) => { const o = $('to'); const d = document.createElement('div'); d.style.whiteSpace = 'pre'; if (html != null) d.innerHTML = html; else d.textContent = plain || ''; o.appendChild(d); o.scrollTop = o.scrollHeight; };
    const path = (parts) => '/' + (parts || cwd).join('/');
    const walk = parts => { let n = tree; for (const p of parts) { if (!isDir(n) || !Object.hasOwn(n, p)) return undefined; n = n[p]; } return n; };
    const activeObj = () => view === 'academy' ? ACADEMY[acadIdx] : activeMis;
    const homeParts = () => walk(['home', 'you']) ? ['home', 'you'] : activeObj().cwd.split('/').filter(Boolean);
    const resolve = (p, base) => {
      if (!p || p === '~') return homeParts();
      if (p.startsWith('~/')) p = '/' + homeParts().join('/') + p.slice(1);
      let parts = p.startsWith('/') ? [] : (base || cwd).slice();
      for (const s of p.split('/')) { if (!s || s === '.') continue; if (s === '..') parts.pop(); else parts.push(s); }
      return parts;
    };
    const mode = n => TerminalUnix.permissions(n, isDir(n));
    const globRe = (g, ic) => new RegExp('^' + g.replace(/[.+^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '.*').replace(/\?/g, '.') + '$', ic ? 'i' : '');
    const expandArg = arg => {
      if (!/[*?]/.test(arg)) return [arg];
      const idx = arg.lastIndexOf('/'), dirPart = idx >= 0 ? arg.slice(0, idx) || '/' : '', pat = idx >= 0 ? arg.slice(idx + 1) : arg;
      const dir = resolve(dirPart || '.'), node = walk(dir);
      if (!isDir(node)) return [arg];
      const re = globRe(pat, false), wantDot = pat.startsWith('.');
      const hits = Object.keys(node).filter(k => (wantDot || k[0] !== '.') && re.test(k)).sort();
      if (!hits.length) return [arg];
      return hits.map(k => (dirPart ? (dirPart === '/' ? '/' : dirPart + '/') : '') + k);
    };
    const expandFiles = list => list.flatMap(expandArg);
    const findWalk = (n, base, pat, type, res) => {
      for (const k of Object.keys(n).sort()) {
        const p = base + '/' + k, dir = isDir(n[k]);
        const typeOk = !type || (type === 'd' && dir) || (type === 'f' && !dir);
        if (typeOk && (!pat || pat.test(k))) res.push(p);
        if (dir) findWalk(n[k], p, pat, type, res);
      }
      return res;
    };
    const updatePrompt = () => {
      const p = path(), hp0 = '/' + homeParts().join('/');
      const disp = p === hp0 ? '~' : p.startsWith(hp0 + '/') ? '~' + p.slice(hp0.length) : p;
      const host = view === 'academy' ? 'academy' : (activeMis.host || 'moundshroud');
      $('tp').textContent = 'you@' + host + ':' + disp + '$ ';
    };
    const rebuildSelectors = () => {
      $('tmis').innerHTML = MIS.map((m, i) => '<option value="' + i + '"' + (i === mi ? ' selected' : '') + '>' + (i < doneCount ? '✓ ' : '') + (i + 1) + '. [' + m.ch + '] ' + esc(m.name) + '</option>').join('');
      $('tlesson').innerHTML = ACADEMY.map((l, i) => '<option value="' + i + '"' + (i === acadIdx ? ' selected' : '') + '>' + (acadDone.has(l.id) ? '✓ ' : '') + esc(l.title) + ' (' + l.badge + ')</option>').join('');
    };
    const renderAcademyBanner = () => {
      const L0 = ACADEMY[acadIdx], done = acadStep >= L0.steps.length;
      const dots = L0.steps.map((s, i) => {
        const st = i < acadStep ? '✓' : i === acadStep ? '▶' : '○';
        const col = i < acadStep ? 'var(--ok)' : i === acadStep ? 'var(--acc)' : 'var(--mute)';
        return '<div style="margin-top:3px;color:' + col + '">' + st + ' <b>Step ' + (i + 1) + ':</b> ' + esc(s.prompt) + '</div>';
      }).join('');
      $('tg').innerHTML = '<div class="row" style="gap:6px;flex-wrap:wrap;align-items:center"><b>🎓 ' + esc(L0.title) + '</b> ' + badge(L0.badge, 'var(--acc)') + ' ' + badge('Done ' + acadDone.size + '/' + ACADEMY.length) + '</div>' +
        '<div style="margin-top:3px">' + esc(L0.summary) + '</div>' +
        '<div style="margin:5px 0;padding:4px 8px;border-radius:6px;background:rgba(0,0,0,.35);' + mono + ';font-size:12px;color:#7ee787">' + esc(L0.syntax) + '</div>' +
        dots +
        (done ? '<div style="margin-top:6px;color:var(--ok)"><b>Lesson complete!</b> <button class="pri small" data-anext="1" style="margin-left:6px">' + (acadIdx + 1 < ACADEMY.length ? 'Next Lesson →' : 'Launch ∞ Endless CTF →') + '</button></div>' : '');
      api.hud('🎓 Academy ' + acadDone.size + '/' + ACADEMY.length + '   Step ' + Math.min(acadStep + 1, L0.steps.length) + '/' + L0.steps.length);
    };
    const syncButtons = () => {
      $('tcamp').classList.toggle('on', view === 'campaign');
      $('tacad').classList.toggle('on', view === 'academy');
      $('tinf').classList.toggle('on', view === 'endless');
      $('tmis').style.display = view === 'campaign' ? '' : 'none';
      $('tlesson').style.display = view === 'academy' ? '' : 'none';
      $('ttry').style.display = view === 'academy' ? '' : 'none';
      $('tdiff').style.display = view === 'endless' ? '' : 'none';
      $('tnew').style.display = view === 'endless' ? '' : 'none';
    };
    const load = () => {
      hinted = false;
      rebuildSelectors();
      syncButtons();
      if (view === 'academy') {
        const L0 = ACADEMY[acadIdx];
        acadStep = 0;
        tree = L0.fs();
        cwd = L0.cwd.split('/').filter(Boolean);
        prevCwd = null;
        renderAcademyBanner();
        updatePrompt();
        return;
      }
      activeMis = view === 'endless' ? activeMis : MIS[mi];
      tree = activeMis.fs();
      cwd = activeMis.cwd.split('/').filter(Boolean);
      prevCwd = null;
      if (view === 'endless') {
        $('tg').innerHTML = '<b>∞ Endless CTF — ' + esc(activeMis.name) + '</b> ' + badge('Tier ' + activeMis.diff + '/6', 'var(--acc)') + '<br>' + esc(activeMis.goal) + '<br><span class="mute">Type <b>help</b> for commands, <b>hint</b> if stuck, <b>next</b> for a new machine, and <b>submit FLAG{...}</b> when found.</span>';
        api.hud(R.hud('∞ CTF'));
      } else {
        $('tg').innerHTML = '<b>Mission ' + (mi + 1) + ' of ' + MIS.length + ': ' + esc(activeMis.name) + '</b> ' + badge(activeMis.ch, 'var(--acc)') + '<br>' + esc(activeMis.goal) + '<br><span class="mute">Type <b>help</b> for commands, <b>hint</b> if stuck, <b>academy</b> for guided lessons, <b>endless</b> for ∞ CTF, and <b>submit FLAG{...}</b> when found.</span>';
        api.hud('Campaign ' + Math.min(doneCount, MIS.length) + '/' + MIS.length + '   ' + R.hud());
      }
      updatePrompt();
    };
    const startEndless = (d) => {
      if (d) { endlessDiff = d; $('tdiff').value = d; }
      view = 'endless';
      endlessNum++;
      activeMis = makeProceduralMission(endlessNum, endlessDiff);
      $('to').innerHTML = '';
      load();
      out('Connected to sandbox host ' + activeMis.host + '. Happy hunting!\n', '#6cf');
    };
    const startAcademy = (idx) => {
      view = 'academy';
      if (typeof idx === 'number' && idx >= 0 && idx < ACADEMY.length) acadIdx = idx;
      $('to').innerHTML = '';
      load();
      out('🎓 Welcome to ' + ACADEMY[acadIdx].title + '. Follow Step 1 above (or click "⚡ Try Example").\n', '#6cf');
    };
    const readInputOrArg = (rest, stdin, emit, cmdName) => {
      if (!rest.length) {
        if (stdin !== null) return { ok: true, src: stdin };
        emit('usage: ' + cmdName + ' <file or text>  (or pipe input)', '#f77', true);
        return { ok: false };
      }
      const cand = expandFiles([rest[0]])[0], n = walk(resolve(cand));
      if (n !== undefined) {
        if (isDir(n)) { emit(cmdName + ': ' + cand + ': Is a directory', '#f77', true); return { ok: false }; }
        if (isLocked(n)) { emit(cmdName + ': ' + cand + ': Permission denied', '#f77', true); return { ok: false }; }
        return { ok: true, src: rd(n) };
      }
      return { ok: true, src: rest.join(' ') };
    };
    const readFileOrStdin = (rawFiles, stdin, emit, cmdName) => {
      if (!rawFiles.length) {
        if (stdin !== null) return { ok: true, src: stdin };
        emit('usage: ' + cmdName + ' <file>  (or pipe input)', '#f77', true);
        return { ok: false };
      }
      const chunks = [];
      for (const f of expandFiles(rawFiles)) {
        const n = walk(resolve(f));
        if (n === undefined) { emit(cmdName + ': ' + f + ': No such file or directory', '#f77', true); return { ok: false }; }
        if (isDir(n)) { emit(cmdName + ': ' + f + ': Is a directory', '#f77', true); return { ok: false }; }
        if (isLocked(n)) { emit(cmdName + ': ' + f + ': Permission denied', '#f77', true); return { ok: false }; }
        chunks.push(rd(n));
      }
      return { ok: true, src: chunks.join('\n') };
    };
    const expandCharSet = s => {
      let out = '';
      for (let i = 0; i < s.length; i++) {
        if (i + 2 < s.length && s[i + 1] === '-') {
          const a = s.charCodeAt(i), b = s.charCodeAt(i + 2);
          for (let c = a; c <= b; c++) out += String.fromCharCode(c);
          i += 2;
        } else out += s[i];
      }
      return out;
    };
    const showHelp = (topic, emit) => {
      if (topic) {
        const k = topic.toLowerCase(), doc = CMD_DOCS[k];
        if (!doc) { emit('help: no help topic matching \'' + topic + '\'. Type "help" for all commands.', '#f77', true); return { ok: false }; }
        emit(k.toUpperCase(), '#6cf');
        emit('  Usage:   ' + doc[0], '#fff');
        doc[1].split('\n').forEach(l => emit('  ' + l, '#c9f5d4'));
        emit('  Example: ' + doc[2], '#fc6');
        return { ok: true };
      }
      if (emit.raw) {
        outPre('<span style="color:#fff;font-weight:700">Moundshroud Shell</span> <span style="color:#789">— Command Reference</span>');
        outPre('<span style="color:#2d3b45">' + '─'.repeat(72) + '</span>');
        HELP_SECTIONS.forEach((sec, idx) => {
          if (idx > 0) outPre('');
          outPre('<span style="color:#6cf;font-weight:700">' + esc(sec.title) + '</span>');
          sec.items.forEach(([cmd, desc]) => {
            outPre('  <span style="color:#7ee787">' + esc(cmd.padEnd(29)) + '</span><span style="color:#a8bfb0">' + esc(desc) + '</span>');
          });
        });
        outPre('');
        outPre('<span style="color:#fc6;font-weight:700">TIPS</span>');
        outPre('  <span style="color:#c9f5d4">Pipes &amp; chaining:</span>  <span style="color:#8fa89a">cat parcel.dat | base64 -d | xxd -r   ·   cd Documents &amp;&amp; ls -a</span>');
        outPre('  <span style="color:#c9f5d4">Modes:</span>             <span style="color:#8fa89a">mission 1-24   ·   academy 1-12   ·   endless   ·   Tab autocomplete</span>');
        outPre('  <span style="color:#c9f5d4">More details:</span>      <span style="color:#8fa89a">help &lt;command&gt;   or   &lt;command&gt; --help</span>');
      } else {
        const lines = ['Moundshroud Shell — Command Reference', '-'.repeat(60)];
        HELP_SECTIONS.forEach(sec => {
          lines.push('', sec.title);
          sec.items.forEach(([cmd, desc]) => lines.push('  ' + cmd.padEnd(29) + desc));
        });
        emit(lines.join('\n'));
      }
      return { ok: true };
    };
    const runLs = (a, emit) => {
      let flags = '', targets = [];
      for (const x of a) {
        if (x.startsWith('-') && x.length > 1) flags += x.slice(1);
        else targets.push(x);
      }
      const showAll = flags.includes('a') || flags.includes('A'), longFmt = flags.includes('l'), onePer = flags.includes('1');
      if (!targets.length) targets = ['.']; else targets = expandFiles(targets);
      let ok = true;
      const fmtLong = (name, n) => mode(n) + '  you  ' + String(isDir(n) ? 4096 : rd(n).length).padStart(6) + '  ' + name + (isDir(n) ? '/' : '');
      targets.forEach((t, idx) => {
        const p = resolve(t), n = walk(p);
        if (n === undefined) { emit('ls: cannot access \'' + t + '\': No such file or directory', '#f77', true); ok = false; return; }
        if (targets.length > 1) { if (idx > 0) emit(''); emit(t + ':', '#6cf'); }
        if (!isDir(n)) { emit(longFmt ? fmtLong(t, n) : t); return; }
        const names = Object.keys(n).filter(k => showAll || k[0] !== '.').sort();
        if (longFmt) { if (!names.length) emit('total 0'); else names.forEach(k => emit(fmtLong(k, n[k]))); }
        else if (onePer) { if (names.length) emit(names.map(k => k + (isDir(n[k]) ? '/' : '')).join('\n')); }
        else emit(names.map(k => k + (isDir(n[k]) ? '/' : '')).join('   ') || '(empty)');
      });
      return { ok };
    };
    const parseCountArgs = (a, defN) => {
      let n = defN, files = [];
      for (let i = 0; i < a.length; i++) {
        const x = a[i];
        if (x === '-n' && a[i + 1] != null) { const v = parseInt(a[++i], 10); if (!isNaN(v) && v >= 0) n = v; else return { err: 'invalid line count: ' + a[i] }; }
        else if (/^-n\d+$/.test(x)) n = parseInt(x.slice(2), 10);
        else if (/^-\d+$/.test(x)) n = parseInt(x.slice(1), 10);
        else if (x.startsWith('-') && x.length > 1) return { err: 'invalid option -- ' + x };
        else files.push(x);
      }
      return { n, files: expandFiles(files) };
    };
    const checksum = algorithm => {
      const run = TerminalUnix.checksum(algorithm, file => {
        const node = walk(resolve(file));
        if (node === undefined) return { err: file + ': No such file or directory' };
        if (isDir(node)) return { err: file + ': Is a directory' };
        if (isLocked(node)) return { err: file + ': Permission denied' };
        return { text: rd(node) };
      });
      return (args, stdin, emit) => {
        const result = run(args, stdin);
        if (result.out) emit(result.out, result.err ? '#f77' : undefined, result.err);
        return { ok: !result.err };
      };
    };
    const cmds = {
      help: (a, _, emit) => showHelp(a[0], emit),
      man: (a, _, emit) => a[0] ? showHelp(a[0], emit) : (emit('What manual page do you want? Try: man grep  (or type "help")', '#fc6'), { ok: true }),
      pwd: (_, __, emit) => { emit(path()); return { ok: true }; },
      ls: (a, _, emit) => runLs(a, emit),
      ll: (a, _, emit) => runLs(['-la'].concat(a), emit),
      la: (a, _, emit) => runLs(['-a'].concat(a), emit),
      dir: (a, _, emit) => runLs(a, emit),
      cd: (a, _, emit) => {
        const target = a[0]; let p;
        if (target === '-') { if (!prevCwd) { emit('cd: OLDPWD not set', '#f77', true); return { ok: false }; } p = prevCwd.slice(); }
        else p = resolve(target || '~');
        const n = walk(p);
        if (n === undefined) { emit('cd: ' + (target || '~') + ': No such file or directory', '#f77', true); return { ok: false }; }
        if (!isDir(n)) { emit('cd: ' + target + ': Not a directory', '#f77', true); return { ok: false }; }
        prevCwd = cwd.slice(); cwd = p; updatePrompt();
        if (target === '-') emit(path());
        return { ok: true };
      },
      tree: (a, _, emit) => {
        const showAll = a.some(x => x.startsWith('-') && x.includes('a'));
        const t = a.find(x => !x.startsWith('-')) || '.';
        const p = resolve(t), n = walk(p);
        if (n === undefined) { emit('tree: ' + t + ': No such file or directory', '#f77', true); return { ok: false }; }
        if (!isDir(n)) { emit(t); return { ok: true }; }
        const lines = [t]; let dirs = 0, files = 0;
        const walkTree = (dirNode, prefix) => {
          const keys = Object.keys(dirNode).filter(k => showAll || k[0] !== '.').sort();
          keys.forEach((k, i) => {
            const last = i === keys.length - 1, child = dirNode[k], d = isDir(child);
            if (d) dirs++; else files++;
            lines.push(prefix + (last ? '└── ' : '├── ') + k + (d ? '/' : isLocked(child) ? ' [locked]' : ''));
            if (d) walkTree(child, prefix + (last ? '    ' : '│   '));
          });
        };
        walkTree(n, '');
        lines.push('', dirs + ' ' + (dirs === 1 ? 'directory' : 'directories') + ', ' + files + ' ' + (files === 1 ? 'file' : 'files'));
        emit(lines.join('\n')); return { ok: true };
      },
      cat: (a, stdin, emit) => {
        let numbered = false, rawFiles = [];
        for (const x of a) {
          if (x === '-n') numbered = true;
          else if (x.startsWith('-') && x.length > 1) { emit('cat: invalid option -- ' + x, '#f77', true); return { ok: false }; }
          else rawFiles.push(x);
        }
        const fmt = txt => numbered ? txt.split('\n').map((l, i) => String(i + 1).padStart(4) + '  ' + l).join('\n') : txt;
        if (!rawFiles.length) { if (stdin !== null) { emit(fmt(stdin)); return { ok: true }; } emit('cat: missing file operand. Try: cat <file>', '#f77', true); return { ok: false }; }
        let ok = true;
        for (const f of expandFiles(rawFiles)) {
          const n = walk(resolve(f));
          if (n === undefined) { emit('cat: ' + f + ': No such file or directory', '#f77', true); ok = false; continue; }
          if (isDir(n)) { emit('cat: ' + f + ': Is a directory', '#f77', true); ok = false; continue; }
          if (isLocked(n)) { emit('cat: ' + f + ': Permission denied', '#f77', true); ok = false; continue; }
          emit(fmt(rd(n)));
        }
        return { ok };
      },
      head: (a, stdin, emit) => {
        const parsed = parseCountArgs(a, 10);
        if (parsed.err) { emit('head: ' + parsed.err, '#f77', true); return { ok: false }; }
        if (!parsed.files.length) { if (stdin !== null) { emit(stdin.split('\n').slice(0, parsed.n).join('\n')); return { ok: true }; } emit('usage: head [-n N] <file>', '#f77', true); return { ok: false }; }
        let ok = true;
        parsed.files.forEach((f, idx) => {
          const n = walk(resolve(f));
          if (n === undefined) { emit('head: cannot open \'' + f + '\': No such file or directory', '#f77', true); ok = false; return; }
          if (isDir(n)) { emit('head: error reading \'' + f + '\': Is a directory', '#f77', true); ok = false; return; }
          if (isLocked(n)) { emit('head: cannot open \'' + f + '\': Permission denied', '#f77', true); ok = false; return; }
          if (parsed.files.length > 1) emit((idx > 0 ? '\n' : '') + '==> ' + f + ' <==', '#6cf');
          emit(rd(n).split('\n').slice(0, parsed.n).join('\n'));
        });
        return { ok };
      },
      tail: (a, stdin, emit) => {
        const parsed = parseCountArgs(a, 10);
        if (parsed.err) { emit('tail: ' + parsed.err, '#f77', true); return { ok: false }; }
        if (!parsed.files.length) { if (stdin !== null) { const ls0 = stdin.split('\n'); emit(parsed.n ? ls0.slice(-parsed.n).join('\n') : ''); return { ok: true }; } emit('usage: tail [-n N] <file>', '#f77', true); return { ok: false }; }
        let ok = true;
        parsed.files.forEach((f, idx) => {
          const n = walk(resolve(f));
          if (n === undefined) { emit('tail: cannot open \'' + f + '\': No such file or directory', '#f77', true); ok = false; return; }
          if (isDir(n)) { emit('tail: error reading \'' + f + '\': Is a directory', '#f77', true); ok = false; return; }
          if (isLocked(n)) { emit('tail: cannot open \'' + f + '\': Permission denied', '#f77', true); ok = false; return; }
          if (parsed.files.length > 1) emit((idx > 0 ? '\n' : '') + '==> ' + f + ' <==', '#6cf');
          const ls0 = rd(n).split('\n'); emit(parsed.n ? ls0.slice(-parsed.n).join('\n') : '');
        });
        return { ok };
      },
      grep: (a, stdin, emit) => {
        let flags = '', pos = [], stopOpts = false;
        for (const x of a) {
          if (!stopOpts && x === '--') { stopOpts = true; continue; }
          if (!stopOpts && /^-[inrvRclFE]+$/.test(x)) flags += x.slice(1);
          else pos.push(x);
        }
        const ic = flags.includes('i'), numL = flags.includes('n'), rec = flags.includes('r') || flags.includes('R'), inv = flags.includes('v'), cnt = flags.includes('c'), filesOnly = flags.includes('l');
        const pat = pos[0], rawTargets = pos.slice(1);
        if (!pat) { emit('usage: grep [-i] [-n] [-r] [-v] [-c] <pattern> [file...]', '#f77', true); return { ok: false }; }
        const matchLine = l => { const m = ic ? l.toLowerCase().includes(pat.toLowerCase()) : l.includes(pat); return inv ? !m : m; };
        if (!rawTargets.length) {
          if (stdin !== null) {
            const lines = stdin.split('\n'), hits = [];
            lines.forEach((l, i) => { if (matchLine(l)) hits.push(numL ? (i + 1) + ':' + l : l); });
            if (cnt) emit(String(hits.length)); else if (hits.length) emit(hits.join('\n')); else emit('(no matches)', '#789');
            return { ok: hits.length > 0 };
          }
          if (rec) rawTargets.push('.'); else { emit('usage: grep [-i] [-n] [-r] <pattern> <file>', '#f77', true); return { ok: false }; }
        }
        const targets = expandFiles(rawTargets), fileList = []; let ok = true;
        const collect = (label, node) => {
          if (isDir(node)) { if (!rec) { emit('grep: ' + label + ': Is a directory (use -r to search recursively)', '#f77', true); ok = false; return; } for (const k of Object.keys(node).sort()) collect((label === '/' ? '' : label) + '/' + k, node[k]); }
          else fileList.push({ label, node });
        };
        for (const t of targets) { const n = walk(resolve(t)); if (n === undefined) { emit('grep: ' + t + ': No such file or directory', '#f77', true); ok = false; continue; } collect(t, n); }
        const multi = fileList.length > 1 || rec; let totalHits = 0;
        for (const item of fileList) {
          if (isLocked(item.node)) { emit('grep: ' + item.label + ': Permission denied', '#f77', true); ok = false; continue; }
          const lines = rd(item.node).split('\n'), hits = [];
          lines.forEach((l, i) => { if (matchLine(l)) hits.push((multi ? item.label + ':' : '') + (numL ? (i + 1) + ':' : '') + l); });
          totalHits += hits.length;
          if (filesOnly) { if (hits.length) emit(item.label); } else if (cnt) emit((multi ? item.label + ':' : '') + hits.length); else if (hits.length) emit(hits.join('\n'));
        }
        if (!totalHits && !cnt && !filesOnly && ok) emit('(no matches)', '#789');
        return { ok: ok && (totalHits > 0 || cnt) };
      },
      find: (a, _, emit) => {
        let dirArg = '.', namePat = null, ic = false, type = null, i = 0;
        if (a[0] && !a[0].startsWith('-')) dirArg = a[i++];
        while (i < a.length) {
          const tok = a[i++];
          if (tok === '-name' || tok === '-iname') { if (!a[i]) { emit('find: missing argument to ' + tok, '#f77', true); return { ok: false }; } namePat = a[i++].replace(/^["']|["']$/g, ''); ic = tok === '-iname'; }
          else if (tok === '-type') { const tv = a[i++]; if (tv !== 'f' && tv !== 'd') { emit('find: -type expects f (file) or d (directory)', '#f77', true); return { ok: false }; } type = tv; }
          else { emit('find: unknown option \'' + tok + '\'. Try: find <dir> -name <pattern>', '#f77', true); return { ok: false }; }
        }
        const dir = resolve(dirArg), n = walk(dir);
        if (n === undefined) { emit('find: \'' + dirArg + '\': No such file or directory', '#f77', true); return { ok: false }; }
        if (!isDir(n)) { emit(dirArg); return { ok: true }; }
        const base = '/' + dir.join('/');
        const res = findWalk(n, base === '/' ? '' : base, namePat ? globRe(namePat, ic) : null, type, []);
        emit(res.length ? res.join('\n') : '(nothing found)'); return { ok: true };
      },
      sort: (a, stdin, emit) => {
        let flags = '', files = [];
        for (const x of a) { if (x.startsWith('-') && x.length > 1) flags += x.slice(1); else files.push(x); }
        const r = readFileOrStdin(files, stdin, emit, 'sort'); if (!r.ok) return { ok: false };
        let lines = r.src.split('\n');
        if (flags.includes('n')) lines.sort((x, y) => (parseFloat(x) || 0) - (parseFloat(y) || 0));
        else lines.sort();
        if (flags.includes('r')) lines.reverse();
        if (flags.includes('u')) lines = [...new Set(lines)];
        emit(lines.join('\n')); return { ok: true };
      },
      uniq: (a, stdin, emit) => {
        let flags = '', files = [];
        for (const x of a) { if (x.startsWith('-') && x.length > 1) flags += x.slice(1); else files.push(x); }
        const r = readFileOrStdin(files, stdin, emit, 'uniq'); if (!r.ok) return { ok: false };
        const runs = [];
        for (const l of r.src.split('\n')) {
          if (runs.length && runs[runs.length - 1].l === l) runs[runs.length - 1].c++;
          else runs.push({ l, c: 1 });
        }
        const onlyU = flags.includes('u'), onlyD = flags.includes('d'), showC = flags.includes('c');
        const outLines = runs.filter(x => (!onlyU || x.c === 1) && (!onlyD || x.c > 1)).map(x => showC ? String(x.c).padStart(5) + ' ' + x.l : x.l);
        emit(outLines.join('\n')); return { ok: true };
      },
      cut: (a, stdin, emit) => {
        let delim = '\t', field = 1, files = [];
        for (let i = 0; i < a.length; i++) {
          const x = a[i];
          if (x === '-d' && a[i + 1] != null) delim = a[++i];
          else if (x.startsWith('-d') && x.length > 2) delim = x.slice(2);
          else if (x === '-f' && a[i + 1] != null) field = parseInt(a[++i], 10) || 1;
          else if (x.startsWith('-f') && x.length > 2) field = parseInt(x.slice(2), 10) || 1;
          else if (!x.startsWith('-')) files.push(x);
        }
        const r = readFileOrStdin(files, stdin, emit, 'cut -d<c> -f<N>'); if (!r.ok) return { ok: false };
        emit(r.src.split('\n').map(l => { const parts = l.split(delim); return parts[field - 1] != null ? parts[field - 1] : ''; }).join('\n'));
        return { ok: true };
      },
      tr: (a, stdin, emit) => {
        let del = false, sets = [];
        for (const x of a) { if (x === '-d') del = true; else sets.push(x); }
        if (stdin === null) { emit('usage: <cmd> | tr [-d] <set1> [set2]', '#f77', true); return { ok: false }; }
        if (!sets.length) { emit('tr: missing operand', '#f77', true); return { ok: false }; }
        const s1 = expandCharSet(sets[0]), s2 = expandCharSet(sets[1] || '');
        if (del) { const rm = new Set([...s1]); emit([...stdin].filter(c => !rm.has(c)).join('')); return { ok: true }; }
        const map = new Map();
        for (let i = 0; i < s1.length; i++) map.set(s1[i], s2[Math.min(i, s2.length - 1)] || '');
        emit([...stdin].map(c => map.has(c) ? map.get(c) : c).join('')); return { ok: true };
      },
      env: (_, __, emit) => {
        const e = activeObj().env || { USER: 'you', HOME: '/home/you', SHELL: '/bin/bash', PATH: '/usr/local/bin:/usr/bin:/bin', HOSTNAME: activeObj().host || 'moundshroud' };
        emit(Object.entries(e).map(([k, v]) => k + '=' + v).join('\n')); return { ok: true };
      },
      printenv: (a, _, emit) => {
        const e = activeObj().env || { USER: 'you', HOME: '/home/you', SHELL: '/bin/bash', PATH: '/usr/local/bin:/usr/bin:/bin', HOSTNAME: activeObj().host || 'moundshroud' };
        if (a[0]) { if (a[0] in e) { emit(e[a[0]]); return { ok: true }; } return { ok: false }; }
        emit(Object.entries(e).map(([k, v]) => k + '=' + v).join('\n')); return { ok: true };
      },
      ps: (_, __, emit) => {
        const rows = activeObj().procs || ['root       1  0.0  0.1  /sbin/init', 'root     142  0.1  0.3  /usr/sbin/sshd -D', 'you     1000  0.0  0.1  /bin/bash'];
        emit('USER     PID %CPU %MEM  COMMAND\n' + rows.join('\n')); return { ok: true };
      },
      netstat: (_, __, emit) => {
        const rows = activeObj().ports || ['tcp   0.0.0.0:22      LISTEN   142/sshd', 'tcp   127.0.0.1:443   LISTEN   318/nginx'];
        emit('PROTO LOCAL_ADDRESS   STATE    PID/PROGRAM\n' + rows.join('\n')); return { ok: true };
      },
      ss: (a, s, emit) => cmds.netstat(a, s, emit),
      base64: (a, stdin, emit) => {
        let decode = false, rest = [];
        for (const x of a) {
          if (x === '-d' || x === '-D' || x === '--decode') decode = true;
          else if (x.startsWith('-') && x.length > 1) { emit('base64: invalid option -- ' + x + '. Try: base64 -d <file or text>', '#f77', true); return { ok: false }; }
          else rest.push(x);
        }
        const r = readInputOrArg(rest, stdin, emit, 'base64 [-d]'); if (!r.ok) return { ok: false };
        if (decode) { try { emit(atob(r.src.replace(/\s+/g, ''))); return { ok: true }; } catch (e) { emit('base64: invalid Base64 input', '#f77', true); return { ok: false }; } }
        try { emit(btoa(r.src)); return { ok: true }; } catch (e) { emit('base64: could not encode input', '#f77', true); return { ok: false }; }
      },
      xxd: (a, stdin, emit) => {
        let rev = false, rest = [];
        for (const x of a) { if (x === '-r' || x === '-p' || x === '-rp' || x === '-pr') { if (x.includes('r')) rev = true; } else rest.push(x); }
        const r = readInputOrArg(rest, stdin, emit, 'xxd [-r]'); if (!r.ok) return { ok: false };
        if (rev) {
          const hex = r.src.replace(/[^0-9a-fA-F]/g, '');
          if (!hex.length || hex.length % 2) { emit('xxd: invalid hex input', '#f77', true); return { ok: false }; }
          let s = ''; for (let i = 0; i < hex.length; i += 2) s += String.fromCharCode(parseInt(hex.slice(i, i + 2), 16));
          emit(s); return { ok: true };
        }
        emit(toHex(r.src)); return { ok: true };
      },
      rot13: (a, stdin, emit) => {
        const r = readInputOrArg(a, stdin, emit, 'rot13'); if (!r.ok) return { ok: false };
        emit(rot13Str(r.src)); return { ok: true };
      },
      rev: (a, stdin, emit) => {
        const r = readInputOrArg(a, stdin, emit, 'rev'); if (!r.ok) return { ok: false };
        emit(r.src.split('\n').map(revStr).join('\n')); return { ok: true };
      },
      chmod: (a, _, emit) => {
        const result = TerminalUnix.chmod(a.flatMap(expandArg), resolve, walk, isDir);
        if (result.out) emit(result.out, result.err ? '#f77' : undefined, result.err);
        return { ok: !result.err };
      },
      wc: (a, stdin, emit) => {
        let flags = '', rawFiles = [];
        for (const x of a) { if (x.startsWith('-') && x.length > 1) flags += x.slice(1); else rawFiles.push(x); }
        const onlyL = flags.includes('l'), onlyW = flags.includes('w'), onlyC = flags.includes('c'), any = onlyL || onlyW || onlyC;
        const stats = txt => {
          const cols = [];
          if (!any || onlyL) cols.push(String(txt ? txt.split('\n').length : 0).padStart(6));
          if (!any || onlyW) cols.push(String(txt.trim() ? txt.trim().split(/\s+/).length : 0).padStart(6));
          if (!any || onlyC) cols.push(String(txt.length).padStart(6));
          return cols.join(' ');
        };
        if (!rawFiles.length) { if (stdin !== null) { emit(stats(stdin)); return { ok: true }; } emit('usage: wc [-l] [-w] [-c] <file>', '#f77', true); return { ok: false }; }
        let ok = true;
        for (const f of expandFiles(rawFiles)) {
          const n = walk(resolve(f));
          if (n === undefined) { emit('wc: ' + f + ': No such file or directory', '#f77', true); ok = false; continue; }
          if (isDir(n)) { emit('wc: ' + f + ': Is a directory', '#f77', true); ok = false; continue; }
          if (isLocked(n)) { emit('wc: ' + f + ': Permission denied', '#f77', true); ok = false; continue; }
          emit(stats(rd(n)) + '  ' + f);
        }
        return { ok };
      },
      strings: (a, stdin, emit) => {
        const extract = s => (s.match(/[\x20-\x7e]{4,}/g) || []).join('\n') || '(no printable strings)';
        if (!a.length) { if (stdin !== null) { emit(extract(stdin)); return { ok: true }; } emit('usage: strings <file>', '#f77', true); return { ok: false }; }
        let ok = true;
        for (const f of expandFiles(a)) {
          const n = walk(resolve(f));
          if (n === undefined) { emit('strings: ' + f + ': No such file or directory', '#f77', true); ok = false; continue; }
          if (isDir(n)) { emit('strings: ' + f + ': Is a directory', '#f77', true); ok = false; continue; }
          if (isLocked(n)) { emit('strings: ' + f + ': Permission denied', '#f77', true); ok = false; continue; }
          emit(extract(rd(n)));
        }
        return { ok };
      },
      stat: (a, _, emit) => {
        const formatted = TerminalUnix.permissionStat(a, p => walk(resolve(p)), isDir);
        if (formatted) { emit(formatted.out, formatted.err ? '#f77' : undefined, formatted.err); return { ok: !formatted.err }; }
        if (!a.length) { emit('usage: stat <path>', '#f77', true); return { ok: false }; }
        let ok = true;
        for (const f of expandFiles(a)) {
          const p = resolve(f), n = walk(p);
          if (n === undefined) { emit('stat: cannot stat \'' + f + '\': No such file or directory', '#f77', true); ok = false; continue; }
          const dir = isDir(n), sz = dir ? 4096 : rd(n).length;
          emit('  File: ' + path(p) + '\n  Type: ' + (dir ? 'directory' : isLocked(n) ? 'regular file (locked)' : 'regular file') + '\n  Size: ' + sz + ' bytes\nAccess: ' + mode(n) + '  owner=you');
        }
        return { ok };
      },
      file: (a, _, emit) => {
        if (!a.length) { emit('usage: file <path>', '#f77', true); return { ok: false }; }
        let ok = true;
        for (const f of expandFiles(a)) {
          const n = walk(resolve(f));
          if (n === undefined) { emit(f + ': cannot open (No such file or directory)', '#f77', true); ok = false; continue; }
          if (isDir(n)) emit(f + ': directory');
          else if (isLocked(n)) emit(f + ': regular file (permission denied — unreadable)');
          else {
            const c = rd(n).trim();
            const kind = !c ? 'empty' : /[\x00-\x08]/.test(c) ? 'ELF / binary data (try strings)' : f.endsWith('.jpg') ? 'simulated image data' : /^([0-9a-f]{2}\s+)+[0-9a-f]{2}$/i.test(c) ? 'ASCII hex dump (try xxd -r)' : /^[A-Za-z0-9+/]+={0,2}$/.test(c) && c.length >= 12 && c.length % 4 === 0 ? 'ASCII text (looks like Base64)' : 'ASCII text';
            emit(f + ': ' + kind);
          }
        }
        return { ok };
      },
      echo: (a, _, emit) => { emit((a[0] === '-n' ? a.slice(1) : a).join(' ')); return { ok: true }; },
      whoami: (_, __, emit) => { emit('you'); return { ok: true }; },
      hostname: (_, __, emit) => { emit(view === 'academy' ? 'academy' : (activeMis.host || 'moundshroud')); return { ok: true }; },
      id: (_, __, emit) => { emit('uid=1000(you) gid=1000(you) groups=1000(you),lab'); return { ok: true }; },
      uname: (a, _, emit) => { emit(a.includes('-a') ? 'Linux ' + (activeObj().host || 'moundshroud') + ' 6.8.0-sandbox #1 SMP x86_64 GNU/Linux' : 'Linux'); return { ok: true }; },
      history: (_, __, emit) => { emit(hist.map((h, i) => String(i + 1).padStart(4) + '  ' + h).join('\n') || '(empty)'); return { ok: true }; },
      clear: () => { $('to').innerHTML = ''; return { ok: true }; },
      cls: () => { $('to').innerHTML = ''; return { ok: true }; },
      ll: (a, s, emit) => cmds.ls(['-la'].concat(a), s, emit),
      la: (a, s, emit) => cmds.ls(['-a'].concat(a), s, emit),
      dir: (a, s, emit) => cmds.ls(a, s, emit),
      more: (a, s, emit) => cmds.cat(a, s, emit),
      less: (a, s, emit) => cmds.cat(a, s, emit),
      nl: (a, s, emit) => { const r = readFileOrStdin(a.filter(x => !x.startsWith('-')), s, emit, 'nl [file]'); if (!r.ok) return { ok: false }; emit(r.src.split('\n').map((l, i) => String(i + 1).padStart(6) + '\t' + l).join('\n')); return { ok: true }; },
      tac: (a, s, emit) => { const r = readFileOrStdin(a.filter(x => !x.startsWith('-')), s, emit, 'tac [file]'); if (!r.ok) return { ok: false }; emit(r.src.split('\n').reverse().join('\n')); return { ok: true }; },
      sed: (a, s, emit) => {
        const sc = a.find(x => !x.startsWith('-')) || '', mm = sc.match(/^s(.)(.*?)\1(.*?)\1([gi]*)$/);
        if (!mm) { emit('sed: try s/old/new/g', '#f77', true); return { ok: false }; }
        const r = readFileOrStdin(a.filter(x => x !== sc && !x.startsWith('-')), s, emit, 'sed s/a/b/g [file]'); if (!r.ok) return { ok: false };
        emit(r.src.split('\n').map(l => l.replace(new RegExp(mm[2], (mm[4].includes('g') ? 'g' : '') + (mm[4].includes('i') ? 'i' : '')), mm[3])).join('\n')); return { ok: true };
      },
      awk: (a, s, emit) => {
        let sep = ' ', prog = '', files = [];
        for (let i = 0; i < a.length; i++) {
          if (a[i] === '-F') sep = a[++i] || ' ';
          else if (/^-F./.test(a[i])) sep = a[i].slice(2);
          else if (!prog && a[i].includes('{')) prog = a[i];
          else if (!a[i].startsWith('-')) files.push(a[i]);
        }
        const mm = prog.match(/\{[\s]*print\s+([^}]+)\}/);
        if (!mm) { emit('awk: try {print $1, $2}', '#f77', true); return { ok: false }; }
        const flds = mm[1].split(',').map(x => x.trim()), r = readFileOrStdin(files, s, emit, 'awk \'{print $1}\' [file]'); if (!r.ok) return { ok: false };
        emit(r.src.split('\n').map(l => { const p = sep === ' ' ? l.trim().split(/\s+/) : l.split(sep); return flds.map(f => f === '$0' ? l : /^\$\d+$/.test(f) ? (p[+f.slice(1) - 1] || '') : f.replace(/^"|"$/g, '')).join(' '); }).join('\n')); return { ok: true };
      },
      hexdump: (a, s, emit) => cmds.xxd(a.filter(x => x !== '-C'), s, emit),
      od: (a, s, emit) => cmds.xxd(a, s, emit),
      md5sum: checksum('md5'),
      sha256sum: checksum('sha256'),
      groups: (_, __, emit) => { emit('you lab'); return { ok: true }; },
      date: (_, __, emit) => { emit(new Date().toUTCString()); return { ok: true }; },
      uptime: (_, __, emit) => { emit('up 7 days, load average: 0.08, 0.05, 0.04'); return { ok: true }; },
      df: (_, __, emit) => { emit('Filesystem      Size  Used Avail Use% Mounted on\n/dev/vda1        20G  4.1G   15G  22% /'); return { ok: true }; },
      du: (_, __, emit) => { emit('32K\t' + path()); return { ok: true }; },
      free: (_, __, emit) => { emit('               total        used        free\nMem:           4.0Gi       1.1Gi       2.9Gi'); return { ok: true }; },
      ip: (_, __, emit) => { emit('2: eth0: <UP> inet 10.0.0.10/24 brd 10.0.0.255 scope global eth0'); return { ok: true }; },
      ifconfig: (a, s, emit) => cmds.ip(a, s, emit),
      arp: (_, __, emit) => { emit('10.0.0.1 ether 52:54:00:12:34:56 eth0'); return { ok: true }; },
      ping: (a, _, emit) => { const h = a.find(x => !x.startsWith('-')) || '127.0.0.1'; emit('64 bytes from ' + h + ': icmp_seq=1 ttl=64 time=0.35 ms'); return { ok: true }; },
      dig: (a, _, emit) => { emit(';; ANSWER SECTION:\n' + (a[0] || 'moundshroud.local') + '. 300 IN A 10.0.0.10'); return { ok: true }; },
      nslookup: (a, s, emit) => cmds.dig(a, s, emit),
      which: (a, _, emit) => { emit(a.map(x => cmds[x] ? '/usr/bin/' + x : '').filter(Boolean).join('\n') || 'not found'); return { ok: true }; },
      type: (a, _, emit) => { emit(a.map(x => cmds[x] ? x + ' is /usr/bin/' + x : x + ': not found').join('\n')); return { ok: true }; },
      basename: (a, _, emit) => { emit(String(a[0] || '').split('/').pop() || '/'); return { ok: true }; },
      dirname: (a, _, emit) => { emit(String(a[0] || '').split('/').slice(0, -1).join('/') || '.'); return { ok: true }; },
      seq: (a, _, emit) => { const ns = a.map(Number), [s0, e0] = ns.length === 1 ? [1, ns[0]] : [ns[0], ns[1]], o = []; for (let i = s0; i <= e0 && o.length < 100; i++) o.push(String(i)); emit(o.join('\n')); return { ok: true }; },
      printf: (a, _, emit) => { emit(String(a[0] || '').replace(/\\n/g, '\n').replace(/\\t/g, '\t')); return { ok: true }; },
      true: () => ({ ok: true }),
      false: () => ({ ok: false }),
      sleep: () => ({ ok: true }),
      touch: (a, _, emit) => { const f = a.find(x => !x.startsWith('-')); if (!f) { emit('usage: touch <file>', '#f77', true); return { ok: false }; } const p = resolve(f), par = walk(p.slice(0, -1)); if (isDir(par)) par[p[p.length - 1]] = { _f: 1, c: '' }; return { ok: true }; },
      mkdir: (a, _, emit) => { const f = a.find(x => !x.startsWith('-')); if (!f) { emit('usage: mkdir <dir>', '#f77', true); return { ok: false }; } const p = resolve(f), par = walk(p.slice(0, -1)); if (isDir(par) && !(p[p.length - 1] in par)) par[p[p.length - 1]] = {}; return { ok: true }; },
      rm: (a, _, emit) => { const f = a.find(x => !x.startsWith('-')); if (!f) { emit('usage: rm <file>', '#f77', true); return { ok: false }; } const p = resolve(f), par = walk(p.slice(0, -1)); if (isDir(par) && p[p.length - 1] in par) delete par[p[p.length - 1]]; return { ok: true }; },
      cp: (a, _, emit) => { const fs2 = a.filter(x => !x.startsWith('-')); if (fs2.length < 2) { emit('usage: cp <src> <dst>', '#f77', true); return { ok: false }; } const n = walk(resolve(fs2[0])); if (!n || isDir(n)) { emit('cp: cannot stat ' + fs2[0], '#f77', true); return { ok: false }; } const dp = resolve(fs2[1]), par = walk(dp.slice(0, -1)); if (isDir(par)) par[dp[dp.length - 1]] = { _f: 1, c: rd(n) }; return { ok: true }; },
      mv: (a, _, emit) => { const r = cmds.cp(a, _, emit); if (r.ok) { const fs2 = a.filter(x => !x.startsWith('-')), sp = resolve(fs2[0]), par = walk(sp.slice(0, -1)); if (isDir(par)) delete par[sp[sp.length - 1]]; } return r; },
      hint: (_, __, emit) => {
        hinted = true;
        if (view === 'academy') {
          const st = ACADEMY[acadIdx].steps[acadStep];
          emit('Hint: ' + (st ? st.hint : 'Lesson complete! Pick the next lesson.'), '#fc6');
          return { ok: true };
        }
        emit('Hint: ' + activeMis.hint, '#fc6'); return { ok: true };
      },
      reset: (_, __, emit) => { $('to').innerHTML = ''; load(); emit('Reset complete.', '#fc6'); return { ok: true }; },
      restart: (_, __, emit) => { $('to').innerHTML = ''; load(); emit('Reset complete.', '#fc6'); return { ok: true }; },
      academy: (a) => { const n = parseInt(a[0], 10); startAcademy(!isNaN(n) && n >= 1 && n <= ACADEMY.length ? n - 1 : acadIdx); return { ok: true }; },
      endless: (a) => { const d = ['easy', 'med', 'hard', 'auto'].includes((a[0] || '').toLowerCase()) ? a[0].toLowerCase() : endlessDiff; startEndless(d); return { ok: true }; },
      next: () => { if (view === 'academy') { startAcademy((acadIdx + 1) % ACADEMY.length); return { ok: true }; } startEndless(); return { ok: true }; },
      missions: (_, __, emit) => {
        const lines = MIS.map((m, i) => '  ' + String(i + 1).padStart(2) + '. ' + (view === 'campaign' && i === mi ? '[current]' : i < doneCount ? '[done]   ' : '[ ]      ') + ' [' + m.ch + '] ' + m.name);
        emit('Campaign Missions (24 total):\n' + lines.join('\n') + '\nUse "mission <1-' + MIS.length + '>", "academy", or "endless" for ∞ CTF.', '#c9f5d4');
        return { ok: true };
      },
      mission: (a, _, emit) => {
        const n = parseInt(a[0], 10);
        if (isNaN(n) || n < 1 || n > MIS.length) { emit('usage: mission <1-' + MIS.length + '>  (or "academy" / "endless")', '#f77', true); return { ok: false }; }
        view = 'campaign'; mi = n - 1; $('to').innerHTML = ''; load(); emit('Switched to Mission ' + n + ': ' + MIS[mi].name, '#6cf');
        return { ok: true };
      },
      skip: (_, __, emit) => {
        if (view === 'academy') { startAcademy((acadIdx + 1) % ACADEMY.length); return { ok: true }; }
        if (view === 'endless') { const d = R.update(false, activeMis.diff, true); emit('Skipped (' + d + ' Elo). Flag was: ' + activeMis.flag, '#fc6'); setTimeout(() => startEndless(), 600); return { ok: true }; }
        if (mi + 1 >= MIS.length) { emit('Entering ∞ Endless CTF mode...', '#6cf'); setTimeout(() => startEndless(), 400); return { ok: true }; }
        emit('Skipping to Mission ' + (mi + 2) + '...', '#fc6'); mi++; setTimeout(() => { $('to').innerHTML = ''; load(); }, 300);
        return { ok: true };
      },
      submit: (a, _, emit) => {
        if (view === 'academy') { emit('Academy lessons check your commands automatically as you run them! Switch to Campaign or ∞ Endless CTF to submit flags.', '#6cf'); return { ok: true }; }
        const f = a.join(' ').trim();
        if (!f) { emit('usage: submit FLAG{...}', '#f77', true); return { ok: false }; }
        if (f === activeMis.flag) {
          if (view === 'endless') {
            const d = R.update(true, activeMis.diff, hinted);
            ls.set('cyterm_inf', String(endlessNum));
            api.submit(R.rating);
            emit('Flag captured! +' + d + ' Elo (Rating ' + R.rating + '). Spinning up next ∞ target...', '#6f6');
            setTimeout(() => startEndless(), 900);
            return { ok: true };
          }
          emit('Correct! Mission ' + (mi + 1) + ' complete.', '#6f6');
          doneCount = Math.max(doneCount, mi + 1);
          ls.set('cyterm', String(Math.min(doneCount, MIS.length)));
          R.update(true, Math.min(6, 1 + Math.floor(mi / 4)), hinted);
          api.submit(Math.max(doneCount, R.rating));
          if (mi + 1 >= MIS.length) {
            emit('All 24 campaign missions conquered! Grand Master unlocked — launching ∞ Endless CTF...', '#6f6');
            setTimeout(() => startEndless(), 1100);
            return { ok: true };
          }
          mi++; setTimeout(() => { $('to').innerHTML = ''; load(); }, 900);
          return { ok: true };
        }
        emit('That is not the flag for this mission.', '#f77', true);
        return { ok: false };
      },
    };
    const tokenize = str => {
      const toks = []; let cur = '', q = '', hasTok = false;
      for (let i = 0; i < str.length; i++) {
        const ch = str[i];
        if (q) { if (ch === q) q = ''; else cur += ch; continue; }
        if (ch === '"' || ch === "'") { q = ch; hasTok = true; continue; }
        if (/\s/.test(ch)) { if (hasTok) { toks.push(cur); cur = ''; hasTok = false; } continue; }
        cur += ch; hasTok = true;
      }
      if (hasTok) toks.push(cur);
      return toks;
    };
    const splitUnquoted = (str, ops) => {
      const segs = []; let cur = '', q = '';
      for (let i = 0; i < str.length; i++) {
        const ch = str[i];
        if (q) { cur += ch; if (ch === q) q = ''; continue; }
        if (ch === '"' || ch === "'") { q = ch; cur += ch; continue; }
        const op = ops.find(o => str.startsWith(o, i));
        if (op) { segs.push({ text: cur.trim(), op }); cur = ''; i += op.length - 1; continue; }
        cur += ch;
      }
      segs.push({ text: cur.trim(), op: null });
      return segs;
    };
    let lastCaptured = [];
    const runPipeline = segText => {
      const stages = splitUnquoted(segText, ['|']).map(s => s.text).filter(Boolean);
      if (!stages.length) return true;
      let piped = null, lastOk = true;
      for (let idx = 0; idx < stages.length; idx++) {
        const listDir = dir => { const n = walk(resolve(dir)); return isDir(n) ? Object.keys(n) : []; };
        const TP = typeof window !== 'undefined' && window.TerminalPlayground;
        const parts = TP && TP.expandShellWords ? TP.expandShellWords(stages[idx], listDir) : tokenize(stages[idx]);
        if (!parts.length) continue;
        const c = parts.shift(), isLast = idx === stages.length - 1;
        const buf = [];
        const emit = (t, col, isErr) => { if (isLast) lastCaptured.push(String(t)); if (isLast || isErr) out(t, col); else buf.push(t); };
        emit.raw = isLast;
        if (parts.includes('--help') || (parts.includes('-h') && c !== 'ls' && c !== 'du' && c !== 'df')) {
          const r = showHelp(c, emit); lastOk = !!(r && r.ok); piped = isLast ? null : buf.join('\n'); continue;
        }
        const fn = cmds[c];
        if (!fn) { out(c + ': command not found. Type "help" for available commands.', '#f77'); return false; }
        const res = fn(parts, piped, emit);
        lastOk = !res || res.ok !== false;
        piped = isLast ? null : buf.join('\n');
      }
      return lastOk;
    };
    const runLine = line => {
      lastCaptured = [];
      const chain = splitUnquoted(line, ['&&', ';']);
      let prevOk = true, prevOp = null;
      for (const step of chain) {
        if (prevOp === '&&' && !prevOk) break;
        if (step.text) prevOk = runPipeline(step.text);
        prevOp = step.op;
      }
      if (view === 'academy') {
        const L0 = ACADEMY[acadIdx], st = L0.steps[acadStep];
        if (st && prevOk) {
          const outText = lastCaptured.join('\n');
          const canRead = file => {
            const node = walk(resolve(file));
            return node !== undefined && !isDir(node) && !isLocked(node);
          };
          let passed = false;
          try { passed = !!st.check(line.trim(), outText, { path: path(), cwd: cwd.slice(), canRead }); } catch (e) { passed = false; }
          if (passed) {
            acadStep++;
            out('✓ Step ' + acadStep + '/' + L0.steps.length + ' complete!', '#6f6');
            if (acadStep >= L0.steps.length) {
              acadDone.add(L0.id);
              ls.set('cyacad_done', JSON.stringify([...acadDone]));
              api.submit(Math.max(acadDone.size * 100, R.rating));
              out('🎓 Lesson "' + L0.title + '" complete! Click "Next Lesson" above or type "next".', '#6f6');
              rebuildSelectors();
            }
            renderAcademyBanner();
          }
        }
      }
    };
    const autocomplete = () => {
      const val = $('ti').value;
      const m = val.match(/(^|[\s|;&])([^\s|;&]*)$/);
      const prefix = m ? m[2] : '', before = m ? val.slice(0, val.length - prefix.length) : val;
      const isCmdPos = /^\s*$/.test(before) || /[|;&]\s*$/.test(before);
      let cands = [];
      if (isCmdPos) cands = Object.keys(cmds).filter(k => k.startsWith(prefix)).sort();
      else {
        const slash = prefix.lastIndexOf('/'), dirStr = slash >= 0 ? prefix.slice(0, slash) || '/' : '', base = slash >= 0 ? prefix.slice(slash + 1) : prefix;
        const dirNode = walk(resolve(dirStr || '.'));
        if (isDir(dirNode)) {
          const wantDot = base.startsWith('.');
          cands = Object.keys(dirNode).filter(k => (wantDot || k[0] !== '.') && k.startsWith(base)).sort().map(k => (dirStr ? (dirStr === '/' ? '/' : dirStr + '/') : '') + k + (isDir(dirNode[k]) ? '/' : ''));
        }
      }
      if (cands.length === 1) $('ti').value = before + cands[0] + (isCmdPos || !cands[0].endsWith('/') ? ' ' : '');
      else if (cands.length > 1) {
        let common = cands[0];
        for (const c of cands.slice(1)) { while (!c.startsWith(common)) common = common.slice(0, -1); }
        if (common.length > prefix.length) $('ti').value = before + common;
        else out(cands.join('   '), '#789');
      }
    };
    $('tcamp').onclick = () => { view = 'campaign'; $('to').innerHTML = ''; load(); $('ti').focus(); };
    $('tacad').onclick = () => { startAcademy(acadIdx); $('ti').focus(); };
    $('tinf').onclick = () => { startEndless(); $('ti').focus(); };
    $('tmis').onchange = () => { view = 'campaign'; mi = +$('tmis').value; $('to').innerHTML = ''; load(); $('ti').focus(); };
    $('tlesson').onchange = () => { startAcademy(+$('tlesson').value); $('ti').focus(); };
    $('tdiff').onchange = () => { endlessDiff = $('tdiff').value; startEndless(); $('ti').focus(); };
    $('tnew').onclick = () => { startEndless(); $('ti').focus(); };
    $('ttry').onclick = () => {
      if (view !== 'academy') return;
      const st = ACADEMY[acadIdx].steps[acadStep];
      if (!st) return;
      $('ti').value = st.example;
      $('ti').focus();
    };
    $('thint').onclick = () => {
      hinted = true;
      if (view === 'academy') { const st = ACADEMY[acadIdx].steps[acadStep]; out('Hint: ' + (st ? st.hint : 'Lesson finished!'), '#fc6'); }
      else out('Hint: ' + activeMis.hint, '#fc6');
      $('ti').focus();
    };
    $('tg').onclick = e => {
      if (e.target.closest('[data-anext]')) {
        if (acadIdx + 1 < ACADEMY.length) startAcademy(acadIdx + 1);
        else startEndless();
        $('ti').focus();
      }
    };
    $('ti').onkeydown = e => {
      if (e.key === 'Tab') { e.preventDefault(); autocomplete(); return; }
      if (e.ctrlKey && (e.key === 'l' || e.key === 'L')) { e.preventDefault(); $('to').innerHTML = ''; return; }
      if (e.ctrlKey && (e.key === 'c' || e.key === 'C')) {
        const sel = window.getSelection ? String(window.getSelection()) : '';
        const inpSel = $('ti').selectionStart !== $('ti').selectionEnd;
        if (sel || inpSel) return; /* let Ctrl+C copy highlighted text */
        e.preventDefault(); out($('tp').textContent + $('ti').value + '^C', '#6cf'); $('ti').value = ''; return;
      }
      if (e.key === 'ArrowUp') { if (hist.length) { hp = Math.max(0, hp - 1); $('ti').value = hist[hp] || ''; } e.preventDefault(); return; }
      if (e.key === 'ArrowDown') { hp = Math.min(hist.length, hp + 1); $('ti').value = hist[hp] || ''; e.preventDefault(); return; }
      if (e.key !== 'Enter') return;
      const line = $('ti').value.trim(); $('ti').value = '';
      if (!line) return;
      hist.push(line); hp = hist.length;
      out($('tp').textContent + line, '#6cf');
      runLine(line);
    };
    el.onclick = e => {
      /* never steal focus or wipe highlights when clicking/dragging inside terminal output or mission text */
      if (e.target.closest('#to')) return;
      const sel = window.getSelection ? String(window.getSelection()) : '';
      if (!sel && e.target.closest('#tprow')) { try { $('ti').focus({ preventScroll: true }); } catch (e2) { $('ti').focus(); } }
    };
    $('tfs').onclick = () => {
      if (A.termFS) A.termFS.toggle($('tbox'), $('tfs'));
      try { $('ti').focus({ preventScroll: true }); } catch (e2) { $('ti').focus(); }
    };
    load();
    if (view === 'academy') out('🎓 Terminal Academy — Interactive hands-on Linux & hacking trainer.\nComplete each step in the real sandbox shell below, or click "⚡ Try Example" anytime.\n', '#8fa89a');
    else out('Moundshroud lab terminal. 24 Campaign Missions · 12 Interactive Academy Lessons · ∞ Endless CTF.\nType "help" for commands, or switch modes using the buttons above.\n', '#8fa89a');
    setTimeout(() => $('ti').focus(), 50);
    return () => { if (A.termFS) A.termFS.exit(); };
  }

  reg('terminal', 'Terminal Hacker', '💻', '24 hand-crafted campaign missions across 4 chapters + 12-lesson Interactive Academy + ∞ Endless CTF Linux shell.', (el, api) => mountTerminalApp(el, api, 'campaign'));
  reg('terminal_academy', 'Terminal Academy', '🎓', 'Interactive hands-on Linux & hacking command trainer: 12 guided live-shell lessons from cd/ls to pipes, chmod, xxd, ps & red-team chains.', (el, api) => mountTerminalApp(el, api, 'academy'));

  /* ================= 3. SQL INJECTION DOJO (3 TUTORIALS + INFINITE PROCEDURAL SQLi) ================= */
  const USERS = [{ id: 1, name: 'admin', pass: 'S3cr3t!x9' }, { id: 2, name: 'maria', pass: 'blue42' }, { id: 3, name: 'dev', pass: 'hunter2' }];
  const sqlTok = s => {
    const t = []; let i = 0;
    while (i < s.length) {
      const c = s[i];
      if (/\s/.test(c)) { i++; continue; }
      if (c === "'") {
        let j = i + 1, v = '';
        for (;;) {
          if (j >= s.length) throw new Error('unterminated string');
          if (s[j] === "'") { if (s[j + 1] === "'") { v += "'"; j += 2; continue; } break; }
          v += s[j++];
        }
        t.push({ t: 's', v }); i = j + 1; continue;
      }
      if (s.startsWith('--', i) || c === '#') break;
      if (s.startsWith('/*', i)) { const e = s.indexOf('*/', i + 2); if (e < 0) break; i = e + 2; continue; }
      if (/\d/.test(c)) { let j = i; while (/[\d.]/.test(s[j] || '')) j++; t.push({ t: 'n', v: s.slice(i, j) }); i = j; continue; }
      if (/[A-Za-z_]/.test(c)) { let j = i; while (/\w/.test(s[j] || '')) j++; t.push({ t: 'w', v: s.slice(i, j) }); i = j; continue; }
      if (s.startsWith('!=', i) || s.startsWith('<>', i)) { t.push({ t: 'o', v: '!=' }); i += 2; continue; }
      if (s.startsWith('>=', i) || s.startsWith('<=', i)) { t.push({ t: 'o', v: s.slice(i, i + 2) }); i += 2; continue; }
      if ('=<> ();'.includes(c)) { t.push({ t: 'o', v: c }); i++; continue; }
      throw new Error('unexpected character ' + c);
    }
    return t;
  };
  const sqlRun = (cond, rows) => {
    const t = sqlTok(cond); let p = 0;
    const pk = () => t[p], nx = () => t[p++], isW = (x, w) => x && x.t === 'w' && x.v.toUpperCase() === w;
    const val = (r) => {
      const x = nx(); if (!x) throw new Error('unexpected end');
      if (x.t === 's') return { v: x.v, num: false };
      if (x.t === 'n') return { v: x.v, num: true };
      if (x.t === 'w') { if (!(x.v in r)) throw new Error('unknown column ' + x.v); return { v: String(r[x.v]), num: typeof r[x.v] === 'number' }; }
      throw new Error('unexpected ' + x.v);
    };
    const cmp = r => {
      if (pk() && pk().v === '(' && pk().t === 'o') { nx(); const v = or(r); const c = nx(); if (!c || c.v !== ')') throw new Error('missing )'); return v; }
      if (isW(pk(), 'NOT')) { nx(); return !cmp(r); }
      const a = val(r);
      if (isW(pk(), 'LIKE')) {
        nx(); const b = val(r);
        const re = new RegExp('^' + b.v.replace(/[.+^${}()|[\]\\]/g, '\\$&').replace(/%/g, '.*').replace(/_/g, '.') + '$', 'i');
        return re.test(a.v);
      }
      const o = nx();
      if (!o || o.t !== 'o' || !['=', '!=', '<', '>', '<=', '>='].includes(o.v)) throw new Error('expected comparison operator');
      const b = val(r);
      if (o.v === '=') return a.v === b.v;
      if (o.v === '!=') return a.v !== b.v;
      const na = parseFloat(a.v), nb = parseFloat(b.v);
      const cmpN = (!isNaN(na) && !isNaN(nb)) ? (na - nb) : (a.v < b.v ? -1 : a.v > b.v ? 1 : 0);
      if (o.v === '<') return cmpN < 0;
      if (o.v === '>') return cmpN > 0;
      if (o.v === '<=') return cmpN <= 0;
      return cmpN >= 0;
    };
    const and = r => { let v = cmp(r); while (isW(pk(), 'AND')) { nx(); const w = cmp(r); v = v && w; } return v; };
    const or = r => { let v = and(r); while (isW(pk(), 'OR')) { nx(); const w = and(r); v = v || w; } return v; };
    return rows.filter(r => { p = 0; const v = or(r); while (pk() && pk().v === ';') nx(); if (p < t.length) throw new Error('unexpected ' + t[p].v); return v; });
  };

  const SQLV = [
    { t: 'Level 1: Skip the password', goal: 'Log in as admin without knowing the password.', hint: 'The app pastes your text inside quotes. End the quote and comment out the rest:  admin\' --', san: null, diff: 1, table: 'users', uCol: 'name', pCol: 'pass', rows: USERS, build: (u, p) => "name='" + u + "' AND pass='" + p + "'", win: (u, p, rows) => rows.some(r => r.name === 'admin') && p !== USERS[0].pass },
    { t: 'Level 2: Skip everything', goal: 'Log in without knowing ANY username or password.', hint: 'Make the WHERE condition always true: try username  x  and password  \' OR \'1\'=\'1', san: null, diff: 2, table: 'users', uCol: 'name', pCol: 'pass', rows: USERS, build: (u, p) => "name='" + u + "' AND pass='" + p + "'", win: (u, p, rows) => rows.length > 0 && !USERS.some(r => r.name === u && r.pass === p) },
    { t: 'Level 3: The weak filter', goal: 'Now the site deletes -- # and /* from what you type. Log in as admin anyway.', hint: 'Balance the quotes yourself without comments: username  admin\' OR \'a\'=\'a', san: 'comments', diff: 3, table: 'users', uCol: 'name', pCol: 'pass', rows: USERS, build: (u, p) => "name='" + u + "' AND pass='" + p + "'", win: (u, p, rows) => rows.some(r => r.name === 'admin') && p !== USERS[0].pass },
  ];

  const SQL_COMPANIES = ['Northstar Cloud', 'Helios Bank', 'Cobalt Logistics', 'Apex Medical', 'Vanguard Rail', 'Orbit Telemetry', 'Kestrel Energy', 'Prism Analytics'];
  const SQL_TABLES = ['users', 'accounts', 'employees', 'operators', 'staff'];
  const SQL_TARGETS = ['admin', 'root', 'ceo', 'auditor', 'secops', 'director', 'sysadmin'];
  const SQL_PEERS = ['alice', 'ben', 'clara', 'diego', 'elena', 'farid', 'grace', 'hiro', 'iris', 'jonah', 'karen', 'liam'];
  const randPass = () => pick(['Vx9!', 'Qp4#', 'Zk7@', 'Mn2$', 'Tr8&']) + rndRange(1000, 9999);

  function makeSqlPuzzle(diff) {
    const company = pick(SQL_COMPANIES), table = pick(SQL_TABLES);
    const targetName = pick(SQL_TARGETS), peers = shuffle(SQL_PEERS).slice(0, 3);
    const uCol = pick(['name', 'username', 'login']), pCol = pick(['pass', 'password', 'secret']);
    const targetPass = randPass();
    const rows = [
      { id: 101, [uCol]: peers[0], [pCol]: randPass(), role: 'guest', active: 1 },
      { id: 102, [uCol]: peers[1], [pCol]: randPass(), role: 'user', active: 1 },
      { id: 103, [uCol]: targetName, [pCol]: targetPass, role: 'admin', active: 1 },
      { id: 104, [uCol]: peers[2], [pCol]: randPass(), role: 'guest', active: 0 },
    ];
    const pool = diff === 'easy' ? [1, 2] : diff === 'med' ? [3, 4, 5] : diff === 'hard' ? [5, 6, 7] : [1, 2, 3, 4, 5, 6, 7];
    const kind = pick(pool);
    const base = { endless: true, company, table, uCol, pCol, rows, targetName, targetPass };

    if (kind === 1) {
      return Object.assign(base, {
        diff: 1, tag: 'Quote + Comment', san: null,
        t: company + ' — Direct Auth Bypass',
        goal: 'Log in specifically as "' + targetName + '" (row 3) without knowing their password.',
        hint: 'Close the quote after ' + targetName + ' and comment out the password check:  ' + targetName + "' --",
        build: (u, p) => uCol + "='" + u + "' AND " + pCol + "='" + p + "'",
        win: (u, p, out) => out.length > 0 && out[0][uCol] === targetName && p !== targetPass
      });
    }
    if (kind === 2) {
      return Object.assign(base, {
        diff: 2, tag: 'Parenthesized WHERE', san: null,
        t: company + ' — Grouped Query',
        goal: 'The query wraps the check in parentheses: WHERE (' + uCol + "='...' AND " + pCol + "='...'). Log in as \"" + targetName + '" without the password.',
        hint: 'Close both the quote and parenthesis before commenting:  ' + targetName + "') --",
        build: (u, p) => "(" + uCol + "='" + u + "' AND " + pCol + "='" + p + "')",
        win: (u, p, out) => out.length > 0 && out[0][uCol] === targetName && p !== targetPass
      });
    }
    if (kind === 3) {
      return Object.assign(base, {
        diff: 3, tag: 'No Comments Filter', san: 'comments',
        t: company + ' — Comment Stripper WAF',
        goal: 'The WAF strips --, #, and /*. Log in as "' + targetName + '" (first matched row MUST be ' + targetName + ')!',
        hint: 'Balance quotes without comments! Username:  ' + targetName + "' OR " + uCol + "='" + targetName + "   (leave password blank or try  ' AND '1'='0 )",
        build: (u, p) => uCol + "='" + u + "' AND " + pCol + "='" + p + "'",
        win: (u, p, out) => out.length > 0 && out[0][uCol] === targetName && p !== targetPass
      });
    }
    if (kind === 4) {
      return Object.assign(base, {
        diff: 3, tag: 'Numeric ID Injection', san: null, numeric: true,
        t: company + ' — Badge ID Lookup',
        goal: 'The badge lookup takes a numeric employee ID without quotes: WHERE id = <user> AND active = 1. Retrieve "' + targetName + '" (id 103) or dump all active rows using numeric SQLi!',
        hint: 'No quotes needed! Try  103 --  or  0 OR id=103 --  in the first box.',
        build: (u) => "id=" + (u || '0') + " AND active=1",
        win: (u, p, out) => out.length > 0 && out.some(r => r[uCol] === targetName) && !/^\s*103\s*$/.test(u)
      });
    }
    if (kind === 5) {
      return Object.assign(base, {
        diff: 4, tag: 'Role Lock Bypass', san: null,
        t: company + ' — Guest-Only Portal',
        goal: 'This login appends AND role=\'guest\' so admins cannot log in here. Bypass both the password AND the role lock to log in as "' + targetName + '"!',
        hint: 'Comment out both the password AND role check:  ' + targetName + "' --",
        build: (u, p) => uCol + "='" + u + "' AND " + pCol + "='" + p + "' AND role='guest'",
        win: (u, p, out) => out.length > 0 && out[0][uCol] === targetName && p !== targetPass
      });
    }
    if (kind === 6) {
      return Object.assign(base, {
        diff: 5, tag: 'Keyword WAF (strips "or")', san: 'or_once',
        t: company + ' — Naive Keyword Filter',
        goal: 'The WAF removes --, #, /* AND deletes a single lowercase "or" once! Log in as any user (or "' + targetName + '") without knowing a password.',
        hint: 'SQL keywords are case-insensitive (try uppercase OR), OR double it ("oorr" becomes "or" after one strip)! E.g. password:  \' OR \'1\'=\'1',
        build: (u, p) => uCol + "='" + u + "' AND " + pCol + "='" + p + "'",
        win: (u, p, out) => out.length > 0 && !rows.some(r => r[uCol] === u && r[pCol] === p)
      });
    }
    return Object.assign(base, {
      diff: 6, tag: 'Double-Paren + Role + No Comments', san: 'comments',
      t: company + ' — Hardened Legacy Gate',
      goal: 'Comments (-- # /*) are stripped, AND the query is WHERE (' + uCol + "='...' AND " + pCol + "='...') AND role='guest'. Break in as \"" + targetName + '"!',
      hint: 'Close the first paren, inject OR ' + uCol + "='" + targetName + "', and balance the trailing paren! Username  x  and password  ') OR " + uCol + "='" + targetName + "' OR ('1'='0",
      build: (u, p) => "(" + uCol + "='" + u + "' AND " + pCol + "='" + p + "') AND role='guest'",
      win: (u, p, out) => out.length > 0 && out.some(r => r[uCol] === targetName) && p !== targetPass
    });
  }
  const applySan = (san, s) => {
    if (!san) return s;
    if (san === 'comments') return s.replace(/--|#|\/\*/g, '');
    if (san === 'or_once') return s.replace(/--|#|\/\*/g, '').replace(/or/g, '');
    return s;
  };
  L.sql = { sqlRun, USERS, makePuzzle: makeSqlPuzzle, applySan };

  reg('sqldojo', 'SQL Injection Dojo', '💉', 'Three guided SQLi levels plus INFINITE procedural database challenges with custom schemas, WAF filters, and parameterized defense.', (el, api) => {
    const R = makeRating('cysql_elo');
    let lv = Math.min(2, num('cysql', 0)), done = num('cysql', 0);
    let endless = false, diff = 'auto', cur = SQLV[lv], hinted = false, solvedCur = false;
    el.innerHTML = '<div style="width:min(720px,100%)">' +
      '<div class="row" style="gap:6px;margin-bottom:6px">' + btn('sacad', '🎓 Academy (8 lessons)') + '</div>' +
      '<div class="row" style="gap:6px;flex-wrap:wrap;margin-bottom:8px;align-items:center" id="sl"></div>' +
      '<div id="sg" style="' + box + ';margin-bottom:8px"></div>' +
      '<div style="' + box + '">' +
        '<div class="small mute" id="sctx" style="margin-bottom:6px">Fake company login (nothing here is real)</div>' +
        '<div class="row" style="gap:8px;margin-bottom:6px"><input type="text" id="su" placeholder="username" autocomplete="off" spellcheck="false" style="flex:1"><input type="text" id="sp" placeholder="password" autocomplete="off" spellcheck="false" style="flex:1"></div>' +
        '<div class="row" style="gap:8px;flex-wrap:wrap">' + btn('sr', 'Log in', 'pri') + '<label class="chk"><input type="checkbox" id="ss"> Secure mode (parameterized)</label><span class="sp"></span>' + btn('sh', 'Hint') + btn('snx', '∞ Next puzzle') + '</div>' +
      '</div>' +
      '<div class="small mute" style="margin:10px 0 4px">The query the server builds:</div>' +
      '<pre id="sq" style="' + mono + ';font-size:12.5px;white-space:pre-wrap;word-break:break-all;' + box + ';margin:0"></pre>' +
      '<div id="so" style="margin-top:10px"></div>' +
    '</div>';
    const renderTop = () => {
      const lvBtns = SQLV.map((v, i) => '<button class="ib' + (!endless && i === lv ? ' on' : '') + '" data-l="' + i + '"' + (i > done ? ' disabled style="opacity:.45"' : '') + '>' + (i < done ? '✓ ' : '') + 'Level ' + (i + 1) + '</button>').join('');
      const infBtn = '<button class="ib' + (endless ? ' on' : '') + '" data-inf="1">∞ Endless SQLi</button>';
      const diffSel = endless ? '<select class="ib" data-sdiff="1" style="padding:4px 8px">' + ['auto', 'easy', 'med', 'hard'].map(d => '<option value="' + d + '"' + (d === diff ? ' selected' : '') + '>' + ({ auto: 'Adaptive', easy: 'Easy', med: 'Medium', hard: 'Hard' }[d]) + '</option>').join('') + '</select>' : '';
      $('sl').innerHTML = lvBtns + infBtn + diffSel;
      const v = cur;
      const wafTag = v.san === 'comments' ? badge('WAF: strips -- # /*', 'var(--warn)') : v.san === 'or_once' ? badge('WAF: strips comments + "or"', 'var(--bad)') : badge('No WAF filter');
      $('sg').innerHTML = '<b>' + esc(v.t) + '</b> ' + (v.tag ? badge(v.tag, 'var(--acc)') + ' ' : '') + wafTag + '<div class="small" style="margin-top:4px">' + esc(v.goal) + '</div>';
      $('sctx').textContent = (v.company ? v.company + ' — ' : 'Fake company login — ') + 'Table: ' + v.table + ' (' + v.rows.map(r => r[v.uCol] + (r.role ? ':' + r.role : '')).join(', ') + ')';
      $('sp').style.display = v.numeric ? 'none' : '';
      $('su').placeholder = v.numeric ? 'employee id (numeric, e.g. 101)' : v.uCol;
      $('sp').placeholder = v.pCol;
      $('snx').style.display = endless ? '' : 'none';
      api.hud(endless ? R.hud('∞ SQLi') : ('Levels ' + done + '/3   ' + R.hud()));
    };
    const nextEndless = () => {
      endless = true; hinted = false; solvedCur = false;
      cur = makeSqlPuzzle(diff);
      $('su').value = ''; $('sp').value = ''; $('sq').textContent = ''; $('so').textContent = '';
      renderTop(); $('su').focus();
    };
    $('sl').onclick = e => {
      const b = e.target.closest('[data-l]');
      if (b && !b.disabled) { endless = false; lv = +b.dataset.l; cur = SQLV[lv]; hinted = false; solvedCur = false; $('sq').textContent = ''; $('so').textContent = ''; renderTop(); return; }
      if (e.target.closest('[data-inf]')) { nextEndless(); }
    };
    $('sl').onchange = e => { const s = e.target.closest('[data-sdiff]'); if (s) { diff = s.value; nextEndless(); } };
    $('snx').onclick = () => { if (!solvedCur) R.update(false, cur.diff || 2, true); nextEndless(); };
    $('sh').onclick = () => { hinted = true; $('so').innerHTML = '<div class="small" style="color:var(--warn)">Hint: ' + esc(cur.hint) + '</div>'; };
    const runAttempt = () => {
      const v = cur;
      const u = applySan(v.san, $('su').value), p = applySan(v.san, $('sp').value);
      const secure = $('ss').checked; let rows = [], err = '';
      if (secure) {
        $('sq').innerHTML = esc('SELECT * FROM ' + v.table + ' WHERE ' + v.uCol + ' = ? AND ' + v.pCol + ' = ?') + '\n<span class="mute">?1 = </span>' + esc(JSON.stringify(u)) + '\n<span class="mute">?2 = </span>' + esc(JSON.stringify(p));
        rows = v.rows.filter(r => String(r[v.uCol]) === u && String(r[v.pCol]) === p);
      } else {
        const cond = v.build(u, p);
        $('sq').innerHTML = esc('SELECT * FROM ' + v.table + ' WHERE ') + '<span style="color:var(--bad)">' + esc(cond) + '</span>';
        try { rows = sqlRun(cond, v.rows); } catch (e) { err = e.message; }
      }
      if (err) { $('so').innerHTML = '<div style="color:var(--bad)">Database error: ' + esc(err) + '</div><div class="small mute">A syntax error often means unbalanced quotes or parentheses.</div>'; return; }
      if (!rows.length) { $('so').innerHTML = '<div style="color:var(--bad)">Login failed (0 rows returned).</div>'; return; }
      const won = !secure && v.win(u, p, rows);
      const firstU = rows[0][v.uCol];
      $('so').innerHTML = '<div style="color:var(--ok)">Matched <b>' + esc(firstU) + '</b>' + (rows.length > 1 ? ' (' + rows.length + ' rows returned)' : '') + '</div>' +
        (won ? '<div style="' + box + ';margin-top:8px"><b style="color:var(--ok)">Injection succeeded!</b><div class="small" style="margin-top:4px">Parameterized queries stop this completely — tick <b>Secure mode</b> to watch the same payload fail safely.</div></div>' : secure ? '<div class="small mute">Secure mode: input is bound as plain data and can never alter SQL syntax.</div>' : '<div class="small mute">Query matched rows, but did not satisfy the mission goal yet.</div>');
      if (won && !solvedCur) {
        solvedCur = true;
        const d = R.update(true, v.diff || 2, hinted);
        if (!endless && lv === done && done < 3) {
          done = lv + 1; ls.set('cysql', String(done)); api.submit(Math.max(done, R.rating));
          setTimeout(renderTop, 100);
          A.toast(lv < 2 ? 'Level cleared! Next level unlocked.' : 'Tutorial complete! Try ∞ Endless SQLi for unlimited challenges.');
        } else {
          api.submit(R.rating);
          A.toast('Solved! +' + d + ' Elo — click ∞ Next puzzle for another!');
          renderTop();
        }
      }
    };
    $('sr').onclick = runAttempt;
    $('su').onkeydown = $('sp').onkeydown = e => { if (e.key === 'Enter') runAttempt(); };
    $('sacad').onclick = () => { if (A.cybertab) A.cybertab.go('games', 'sql_academy'); };
    renderTop();
    return () => { };
  });

  /* ================= 4. PHISH SPOTTER (INFINITE EMAIL FORENSICS) ================= */
  const MAILS = [
    { from: 'Microsoft Support <support@micros0ft-security.com>', subj: 'Your account will be closed in 24 hours', body: 'We detected unusual activity. Verify your password immediately or your account will be permanently deleted.', link: ['Verify now', 'http://micros0ft-security.com/login'], phish: 1, diff: 1, hdr: { rp: 'bounce@micros0ft-security.com', spf: 'FAIL', dkim: 'NONE' }, why: ['The sender domain uses a zero instead of the letter o', 'Threatens you with a deadline to rush you', 'Asks you to enter your password through a link'] },
    { from: 'Maria Lopez <maria@yourcompany.com>', subj: 'Notes from this morning', body: 'Hi, here are the notes from our meeting. Let me know if I missed anything.', link: null, phish: 0, diff: 1, hdr: { rp: 'maria@yourcompany.com', spf: 'PASS', dkim: 'PASS' }, why: ['Normal sender, no link, no pressure, nothing asked of you'] },
    { from: 'PayPaI Service <service@paypal-billing.help>', subj: 'Payment of $499.99 sent', body: 'You paid $499.99 to Crypto Exchange. If this was not you, click below to cancel and sign in.', link: ['Cancel payment', 'http://paypal-billing.help/cancel'], phish: 1, diff: 1, hdr: { rp: 'alerts@paypal-billing.help', spf: 'SOFTFAIL', dkim: 'NONE' }, why: ['The sender name uses a capital I instead of l', 'The domain is .help, not the real company site', 'Scares you with a charge you did not make'] },
    { from: 'GitHub <noreply@github.com>', subj: 'A new sign-in to your account', body: 'We noticed a sign-in from Windows in your region. If this was you, you can ignore this. If not, open github.com yourself and review your sessions.', link: null, phish: 0, diff: 1, hdr: { rp: 'noreply@github.com', spf: 'PASS', dkim: 'PASS' }, why: ['Tells you to go to the site yourself, not to click', 'No urgency and no request for a password'] },
    { from: 'HR Department <hr@yourcompany-benefits.net>', subj: 'Urgent: updated salary document', body: 'Open the attached file and sign in with your work email to see your new salary.', link: ['SalaryUpdate.html', 'file attachment: SalaryUpdate.html'], phish: 1, diff: 2, hdr: { rp: 'hr@yourcompany-benefits.net', spf: 'FAIL', dkim: 'NONE' }, why: ['Unexpected attachment ending in .html', 'The domain is not your real company domain', 'Plays on curiosity about money'] },
    { from: 'Amazon <order-update@amazon.com>', subj: 'Your package was delivered', body: 'Your order was delivered to your front door. You can check it any time in Your Orders on the Amazon website or app.', link: null, phish: 0, diff: 1, hdr: { rp: 'order-update@amazon.com', spf: 'PASS', dkim: 'PASS' }, why: ['Points you to the official site or app, asks for nothing'] },
    { from: 'IT Helpdesk <helpdesk@company-it-support.co>', subj: 'Password expires today', body: 'Your password expires today. Click to keep your current password.', link: ['Keep my password', 'http://company-it-support.co/reset'], phish: 1, diff: 2, hdr: { rp: 'admin@company-it-support.co', spf: 'NONE', dkim: 'NONE' }, why: ['Generic urgency', 'Look-alike domain that is not your company', 'Real IT teams rarely email a login link'] },
    { from: 'Bank of Northfield <alerts@bankofnorthfield.com>', subj: 'New statement available', body: 'Your monthly statement is ready. Sign in the usual way through the app or the website you normally use.', link: null, phish: 0, diff: 1, hdr: { rp: 'alerts@bankofnorthfield.com', spf: 'PASS', dkim: 'PASS' }, why: ['No link and no request, just a reminder to use your normal route'] },
  ];
  const P_BRANDS = [
    { name: 'Microsoft', dom: 'microsoft.com', spoof: ['micros0ft-verify.com', 'microsoft-account.help', 'login-microsoft.co', 'microsoft.com.auth-check.xyz'] },
    { name: 'Google', dom: 'google.com', spoof: ['g00gle-alerts.com', 'google-security.info', 'accounts.google.com.verify-id.top'] },
    { name: 'Apple', dom: 'apple.com', spoof: ['app1e-support.net', 'icloud-billing.co', 'appleid.apple.com.session-fix.xyz'] },
    { name: 'Amazon', dom: 'amazon.com', spoof: ['arnazon-orders.com', 'amazon-prime-renew.info', 'amazon.com.billing-desk.top'] },
    { name: 'PayPal', dom: 'paypal.com', spoof: ['paypa1-resolution.com', 'paypal-dispute.help', 'paypal.com.secure-hold.net'] },
    { name: 'Chase Bank', dom: 'chase.com', spoof: ['chase-fraud-desk.com', 'chaseonline-verify.co', 'chase.com.alert-center.xyz'] },
    { name: 'Netflix', dom: 'netflix.com', spoof: ['netflix-card-update.com', 'netf1ix-billing.net', 'netflix.com.renew-now.top'] },
    { name: 'UPS Delivery', dom: 'ups.com', spoof: ['ups-customs-fee.top', 'ups-parcel-hold.co', 'ups.com.redelivery-pay.xyz'] },
    { name: 'DocuSign', dom: 'docusign.com', spoof: ['docusign-viewer.net', 'd0cusign-docs.com', 'docusign.com.sign-portal.co'] },
    { name: 'Dropbox', dom: 'dropbox.com', spoof: ['dropb0x-share.com', 'dropbox-quota.help', 'dropbox.com.file-access.xyz'] },
    { name: 'Stripe', dom: 'stripe.com', spoof: ['stripe-payouts.co', 'str1pe-verify.com', 'stripe.com.kyc-check.info'] },
    { name: 'GitHub', dom: 'github.com', spoof: ['g1thub-security.com', 'github-oauth.net', 'github.com.token-audit.co'] },
  ];
  const P_NAMES = ['Sarah Chen', 'David Park', 'Elena Morales', 'Marcus Webb', 'Priya Patel', 'Liam O\'Connor', 'Hannah Brooks', 'Omar Hassan'];

  function makePhishEmail(diff) {
    if (Math.random() < 0.14 && diff !== 'hard') return pick(MAILS);
    const isPhish = Math.random() < 0.54;
    const brand = pick(P_BRANDS), person = pick(P_NAMES);
    const ticket = rndRange(10400, 99800), amt = '$' + rndRange(49, 1499) + '.' + pick(['00', '49', '95', '99']);
    const tier = diff === 'easy' ? 1 : diff === 'med' ? 2 : diff === 'hard' ? 3 : (1 + rnd(3));

    if (!isPhish) {
      const kind = rnd(5);
      if (kind === 0) return {
        from: brand.name + ' <noreply@' + brand.dom + '>',
        subj: 'Security alert: new sign-in detected (Ref #' + ticket + ')',
        body: 'A sign-in to your ' + brand.name + ' account occurred from a Windows device. If this was you, no action is needed. If not, open ' + brand.dom + ' directly in your browser and review active sessions.',
        link: null, phish: 0, diff: tier,
        hdr: { rp: 'noreply@' + brand.dom, spf: 'PASS', dkim: 'PASS' },
        why: ['Exact official domain (' + brand.dom + ') with passing SPF & DKIM', 'Does not pressure you to click a login link — tells you to visit the site yourself']
      };
      if (kind === 1) return {
        from: brand.name + ' Billing <receipts@' + brand.dom + '>',
        subj: 'Your monthly receipt #' + ticket,
        body: 'Thanks for your payment of ' + amt + '. You can view or download past receipts anytime inside your ' + brand.name + ' account settings.',
        link: ['https://' + brand.dom + '/account/billing', 'https://' + brand.dom + '/account/billing'],
        phish: 0, diff: tier,
        hdr: { rp: 'receipts@' + brand.dom, spf: 'PASS', dkim: 'PASS' },
        why: ['Sender domain AND link destination both point to the exact official domain (' + brand.dom + ')', 'No urgency, no request for credentials or card details']
      };
      if (kind === 2) return {
        from: person + ' <' + person.toLowerCase().replace(/[^a-z]/g, '.') + '@yourcompany.com>',
        subj: pick(['Q4 roadmap slides', 'Quick question on Friday\'s meeting', 'Updated sprint notes', 'Lunch Thursday?']),
        body: pick(['Hey, I dropped the updated notes in our shared folder before the 2pm standup. Let me know if anything looks off.', 'Are we still on for the review call tomorrow at 10? I added two items to the calendar invite.', 'Thanks for sending over the draft earlier — I left a couple of comments in the doc.']),
        link: null, phish: 0, diff: tier,
        hdr: { rp: person.toLowerCase().replace(/[^a-z]/g, '.') + '@yourcompany.com', spf: 'PASS', dkim: 'PASS' },
        why: ['Internal company domain matches sender and Return-Path (SPF/DKIM pass)', 'Normal tone, no suspicious attachments, links, or urgent requests']
      };
      if (kind === 3) return {
        from: 'City Public Library <notices@citylibrary.org>',
        subj: 'Hold ready for pickup (Item #' + ticket + ')',
        body: 'Your requested book is ready on the hold shelf for the next 7 days. Bring your library card or manage holds on citylibrary.org.',
        link: null, phish: 0, diff: tier,
        hdr: { rp: 'notices@citylibrary.org', spf: 'PASS', dkim: 'PASS' },
        why: ['Specific, calm notice with no payment or login link demanded']
      };
      return {
        from: brand.name + ' <updates@' + brand.dom + '>',
        subj: 'Password changed on your ' + brand.name + ' account',
        body: 'Your password was updated just now. If you made this change, you can safely ignore this message. Otherwise visit ' + brand.dom + '/security directly.',
        link: ['https://' + brand.dom + '/security', 'https://' + brand.dom + '/security'],
        phish: 0, diff: tier,
        hdr: { rp: 'updates@' + brand.dom, spf: 'PASS', dkim: 'PASS' },
        why: ['Matches official domain ' + brand.dom + ' in From, Return-Path, and hover URL', 'SPF and DKIM both PASS']
      };
    }

    const tactic = tier === 1 ? pick([0, 1, 2]) : tier === 2 ? pick([1, 2, 3, 4]) : pick([3, 4, 5]);
    const spoof = pick(brand.spoof);
    if (tactic === 0) return {
      from: brand.name + ' Security <alert@' + spoof + '>',
      subj: 'URGENT: ' + brand.name + ' account suspended (Action needed in 12h)',
      body: 'Unusual activity triggered an automatic lock on account #' + ticket + '. Confirm your password immediately to prevent permanent deletion.',
      link: ['Restore Account Now', 'http://' + spoof + '/verify?id=' + ticket],
      phish: 1, diff: 1,
      hdr: { rp: 'mailer@' + spoof, spf: 'FAIL', dkim: 'NONE' },
      why: ['Look-alike domain "' + spoof + '" is NOT ' + brand.dom, 'Artificial deadline ("12h") to make you panic and skip checking', 'SPF fails and link goes to an unencrypted http:// login page']
    };
    if (tactic === 1) {
      const ext = pick(['.html', '.exe', '.iso', '.pdf.exe', '.docm']);
      const fname = pick(['Invoice_', 'Payroll_Update_', 'Wire_Receipt_', 'Security_Scan_']) + ticket + ext;
      return {
        from: brand.name + ' Billing <billing@' + spoof + '>',
        subj: 'Unpaid invoice #' + ticket + ' (' + amt + ')',
        body: 'Your recent charge of ' + amt + ' could not be cleared. Open the attached document and sign in to view or dispute this invoice.',
        link: [fname, 'file attachment: ' + fname],
        phish: 1, diff: 2,
        hdr: { rp: 'bounce@' + spoof, spf: 'FAIL', dkim: 'NONE' },
        why: ['Dangerous attachment type (' + ext + ') commonly used to drop malware or harvest logins', 'Sender domain "' + spoof + '" does not match ' + brand.dom]
      };
    }
    if (tactic === 2) return {
      from: person + ' (CEO, invented) <' + person.toLowerCase().replace(/[^a-z]/g, '') + '.exec' + rndRange(10, 99) + '@mail.example>',
      subj: 'Quick favor — confidential',
      body: 'I\'m stuck in a board meeting and cannot take calls. Please purchase ' + rndRange(3, 6) + ' Apple/Amazon gift cards ($100 each) for a client bonus and email me photos of the codes ASAP. Keep this quiet.',
      link: null, phish: 1, diff: 1,
      hdr: { rp: 'exec.urgent@mail.example', spf: 'PASS (personal webmail)', dkim: 'PASS (mail.example)' },
      why: ['Executive impersonation sent from a free webmail address instead of company mail', 'Demands gift card codes + secrecy + "do not call" to stop you verifying']
    };
    if (tactic === 3) return {
      from: brand.name + ' <support@' + brand.dom + '>',
      subj: 'Action required: confirm payout #' + ticket,
      body: 'Please review the updated verification link below to keep payouts active on your account.',
      link: ['https://' + brand.dom + '/account/verify', 'https://' + spoof + '/session/' + ticket],
      phish: 1, diff: 3,
      hdr: { rp: 'bounces@' + spoof, spf: 'FAIL', dkim: 'FAIL' },
      why: ['Hover URL trick! The visible link text says "' + brand.dom + '", but the real destination is "' + spoof + '"', 'Header Return-Path (' + spoof + ') and SPF/DKIM FAIL reveal a spoofed From address']
    };
    if (tactic === 4) {
      const subSpoof = brand.dom + '.login-portal-' + rndRange(10, 99) + '.xyz';
      return {
        from: brand.name + ' Account Team <no-reply@' + subSpoof + '>',
        subj: 'Your MFA token needs re-syncing (Ticket #' + ticket + ')',
        body: 'We upgraded our sign-in servers this morning. Please re-verify your 2FA code once so you are not logged out during the migration.',
        link: ['Re-sync MFA Token', 'https://' + subSpoof + '/mfa'],
        phish: 1, diff: 3,
        hdr: { rp: 'noreply@' + subSpoof, spf: 'PASS (attacker domain)', dkim: 'NONE' },
        why: ['Subdomain deception: "' + brand.dom + '" is only a subdomain — the real registered domain is ".xyz"!', 'Calm, professional tone (spear-phish) designed to steal live MFA codes']
      };
    }
    return {
      from: 'IT Security Desk <it-help@yourcompany-sso.co>',
      subj: 'Scheduled SSO certificate rotation',
      body: 'Hi team, we are rotating single sign-on certificates at 5 PM. Please sign in once on the new portal below to keep VPN and email connected.',
      link: ['https://sso.yourcompany.com/migrate', 'https://yourcompany-sso.co/login'],
      phish: 1, diff: 3,
      hdr: { rp: 'admin@yourcompany-sso.co', spf: 'SOFTFAIL', dkim: 'NONE' },
      why: ['Look-alike domain "yourcompany-sso.co" instead of yourcompany.com', 'Hover URL does not match the displayed https://sso.yourcompany.com text']
    };
  }
  L.phish = { makeEmail: makePhishEmail };

  reg('phish', 'Phish Spotter', '🎣', 'Infinite procedural phishing & legit emails with hover links, real SPF/DKIM headers, difficulty levels, and Elo rating.', (el, api) => {
    const R = makeRating('cyphish');
    let cur = null, ans = false, mode = 'endless', diff = 'auto', sprintIdx = 0, sprintOk = 0;
    el.innerHTML = '<div style="width:min(680px,100%)">' +
      '<div class="row" style="gap:6px;flex-wrap:wrap;margin-bottom:8px;align-items:center">' +
        '<select id="pmode" class="ib" style="padding:4px 8px"><option value="endless">∞ Endless Puzzles</option><option value="sprint">10-Email Sprint</option></select>' +
        '<select id="pdiff" class="ib" style="padding:4px 8px"><option value="auto">Adaptive (Elo)</option><option value="easy">Easy</option><option value="med">Medium</option><option value="hard">Hard (Spear-Phish)</option></select>' +
        '<span class="sp"></span>' +
        btn('pacad', '🎓 Academy') +
        btn('phdrbtn', '🔍 Inspect Headers') +
      '</div>' +
      '<div id="pc" style="' + box + '"></div>' +
      '<pre id="phdr" class="small" style="display:none;margin:8px 0 0;' + box + ';' + mono + ';white-space:pre-wrap;font-size:12px"></pre>' +
      '<div class="row" style="gap:8px;margin-top:10px" id="pb">' + btn('pp', '🎣 Phishing', 'pri') + btn('pl', '✅ Legit') + '<span class="sp"></span>' + btn('pn', 'Next / Skip') + '</div>' +
      '<div id="pr" style="margin-top:10px"></div>' +
    '</div>';
    const next = () => {
      ans = false; $('pr').innerHTML = ''; $('phdr').style.display = 'none';
      if (mode === 'sprint' && sprintIdx >= 10) {
        api.submit(Math.max(sprintOk * 10, R.rating));
        $('pc').innerHTML = '<h2>Sprint complete!</h2><div>You got <b>' + sprintOk + ' of 10</b> right.</div><div class="small mute" style="margin-top:6px">Click Next / Skip to start another sprint or switch to ∞ Endless Puzzles.</div>';
        $('pb').style.opacity = .5; cur = null; return;
      }
      $('pb').style.opacity = 1;
      cur = makePhishEmail(diff);
      const tag = mode === 'sprint' ? ('Sprint ' + (sprintIdx + 1) + '/10') : ('∞ Puzzle · Tier ' + cur.diff + '/3');
      $('pc').innerHTML = '<div class="small mute" style="margin-bottom:4px">' + esc(tag) + '</div>' +
        '<div style="margin:6px 0"><b>From:</b> ' + esc(cur.from) + '</div>' +
        '<div><b>Subject:</b> ' + esc(cur.subj) + '</div>' +
        '<div style="margin:10px 0;line-height:1.6">' + esc(cur.body) + '</div>' +
        (cur.link ? '<div class="small">Link or file: <span style="color:var(--acc);text-decoration:underline" title="' + esc(cur.link[1]) + '">' + esc(cur.link[0]) + '</span> <span class="mute">(hover to see real destination)</span></div>' : '<div class="small mute">No links or attachments.</div>');
      const h = cur.hdr || { rp: 'unknown', spf: 'NONE', dkim: 'NONE' };
      $('phdr').textContent = 'From:        ' + cur.from + '\nReturn-Path: <' + h.rp + '>\nSPF:         ' + h.spf + '\nDKIM:        ' + h.dkim + (cur.link ? '\nLink Target: ' + cur.link[1] : '');
      api.hud(R.hud(mode === 'sprint' ? ('Sprint ' + sprintOk + '/' + sprintIdx) : ''));
    };
    const guess = g => {
      if (ans || !cur) return;
      ans = true;
      const right = (g === 1) === !!cur.phish;
      const d = R.update(right, cur.diff * 2, false);
      if (mode === 'sprint') { sprintIdx++; if (right) sprintOk++; }
      api.submit(R.rating);
      $('pr').innerHTML = '<div style="color:var(--' + (right ? 'ok' : 'bad') + ')"><b>' + (right ? 'Correct! +' + d + ' Elo' : 'Missed (' + d + ' Elo).') + '</b> That was ' + (cur.phish ? 'a phishing email' : 'legitimate') + '.</div>' +
        '<ul class="small" style="margin:6px 0 8px 18px">' + cur.why.map(w => '<li>' + esc(w) + '</li>').join('') + '</ul>' +
        '<button class="pri" data-pnext="1">' + (mode === 'sprint' && sprintIdx >= 10 ? 'See sprint score' : 'Next email →') + '</button>';
      api.hud(R.hud(mode === 'sprint' ? ('Sprint ' + sprintOk + '/' + sprintIdx) : ''));
    };
    $('pr').onclick = e => { if (e.target.closest('[data-pnext]')) next(); };
    $('pacad').onclick = () => { if (A.cybertab) A.cybertab.go('games', 'phish_academy'); };
    $('phdrbtn').onclick = () => { const h = $('phdr'); h.style.display = h.style.display === 'none' ? 'block' : 'none'; };
    $('pmode').onchange = () => { mode = $('pmode').value; sprintIdx = 0; sprintOk = 0; next(); };
    $('pdiff').onchange = () => { diff = $('pdiff').value; next(); };
    $('pp').onclick = () => guess(1);
    $('pl').onclick = () => guess(0);
    $('pn').onclick = () => { if (mode === 'sprint' && sprintIdx >= 10) { sprintIdx = 0; sprintOk = 0; } next(); };
    next();
    return () => { };
  });

  /* ================= 5. NET NINJA (INFINITE PORTS, SUBNETS, FIREWALLS, CHMOD & CONCEPTS) ================= */
  const PORTS = [
    [20, 'FTP-Data', 'FTP data channel'], [21, 'FTP', 'unencrypted file transfer'], [22, 'SSH', 'secure remote shell'],
    [23, 'Telnet', 'unencrypted remote login'], [25, 'SMTP', 'sending email'], [53, 'DNS', 'domain name resolution'],
    [67, 'DHCP', 'assigning IP addresses'], [69, 'TFTP', 'trivial UDP file transfer'], [80, 'HTTP', 'unencrypted web traffic'],
    [88, 'Kerberos', 'Active Directory authentication'], [110, 'POP3', 'downloading email'], [123, 'NTP', 'network clock sync'],
    [143, 'IMAP', 'reading email on a server'], [161, 'SNMP', 'network device monitoring'], [389, 'LDAP', 'directory services'],
    [443, 'HTTPS', 'TLS-encrypted web traffic'], [445, 'SMB', 'Windows file sharing'], [514, 'Syslog', 'centralized log shipping'],
    [587, 'SMTP-TLS', 'authenticated mail submission'], [636, 'LDAPS', 'encrypted LDAP directory'], [993, 'IMAPS', 'TLS-encrypted IMAP'],
    [1433, 'MSSQL', 'Microsoft SQL Server'], [1521, 'Oracle DB', 'Oracle database listener'], [1883, 'MQTT', 'IoT messaging broker'],
    [2375, 'Docker API', 'unencrypted Docker daemon'], [3306, 'MySQL', 'MySQL/MariaDB database'], [3389, 'RDP', 'Windows Remote Desktop'],
    [5432, 'PostgreSQL', 'PostgreSQL database'], [5900, 'VNC', 'remote desktop screen sharing'], [6379, 'Redis', 'in-memory key-value store'],
    [6443, 'Kubernetes API', 'K8s control plane API'], [8080, 'HTTP-Alt', 'proxy / dev web server'], [9092, 'Kafka', 'event streaming broker'],
    [9200, 'Elasticsearch', 'search/log index REST API'], [27017, 'MongoDB', 'NoSQL document database'], [51820, 'WireGuard', 'modern UDP VPN tunnel']
  ];
  const CONCEPTS = [
    ['What does a firewall do?', ['Filters network traffic by rules', 'Makes your PC faster', 'Removes viruses from files', 'Stores your passwords'], 0],
    ['What does HTTPS add over HTTP?', ['Encryption and server authentication via TLS', 'Faster downloads', 'Free hosting', 'More images'], 0],
    ['What is a VPN mainly for?', ['An encrypted tunnel for your traffic', 'Making Wi-Fi stronger', 'Blocking all ads', 'Speeding up games'], 0],
    ['What is phishing?', ['Tricking people into giving up credentials or access', 'Overloading a server', 'Guessing passwords in bulk', 'Cracking Wi-Fi'], 0],
    ['What is two-factor authentication?', ['A password plus a second proof such as a TOTP code or security key', 'Two passwords', 'Logging in twice', 'A backup password'], 0],
    ['What is a brute-force attack?', ['Trying many passwords until one works', 'Physically breaking a device', 'Sending a fake email', 'Reading network traffic'], 0],
    ['What does NAT do on a home router?', ['Lets many private devices share one public IP', 'Encrypts Wi-Fi', 'Blocks all websites', 'Backs up files'], 0],
    ['What is ransomware?', ['Malware that encrypts files and demands payment', 'A free antivirus', 'A type of firewall', 'A password manager'], 0],
    ['What is a man-in-the-middle attack?', ['Secretly intercepting or altering traffic between two parties', 'Two hackers working together', 'Cloning a hard drive', 'Guessing a PIN'], 0],
    ['Why use a password manager?', ['Unique strong passwords for every site', 'To share passwords with friends', 'To avoid ever logging out', 'To speed up the internet'], 0],
    ['What is a zero-day?', ['A vulnerability with no patch available yet', 'A virus that deletes in a day', 'A free trial', 'A day with no attacks'], 0],
    ['What does DNS do?', ['Turns domain names like example.com into IP addresses', 'Encrypts email', 'Stores web pages', 'Scans for viruses'], 0],
    ['A hash such as SHA-256 is...', ['A one-way fingerprint of data', 'Reversible encryption', 'A password', 'A compression format'], 0],
    ['What is SSRF (Server-Side Request Forgery)?', ['Tricking a server into making requests to internal addresses', 'Stealing cookies via script tags', 'Flooding a server with SYN packets', 'Cracking salted hashes'], 0],
    ['What is IDOR (Insecure Direct Object Reference)?', ['Accessing another user\'s record by changing an ID in the URL without authorization checks', 'Running SQL inside a search box', 'Forging a DNS response', 'Brute-forcing SSH'], 0],
    ['What does the HttpOnly cookie flag prevent?', ['Client-side JavaScript (XSS) from reading the session cookie', 'The browser from sending cookies over HTTPS', 'Users from logging out', 'Servers from setting cookies'], 0],
    ['What is the difference between HTTP 401 and 403?', ['401 means unauthenticated (who are you?); 403 means authenticated but forbidden', '401 means not found; 403 means server crashed', '401 is temporary; 403 is a redirect', 'They mean the exact same thing'], 0],
    ['Why do password hashes use a unique random salt?', ['So identical passwords produce different hashes and defeat rainbow tables', 'To make hashes reversible', 'To compress the database', 'To speed up login checks'], 0],
    ['What does HSTS (Strict-Transport-Security) enforce?', ['Browsers must only connect to the site over HTTPS', 'All cookies expire in 1 minute', 'JavaScript is disabled', 'Only port 22 is allowed'], 0],
    ['What is credential stuffing?', ['Reusing leaked username/password pairs from one breach on other sites', 'Encrypting a database', 'Scanning open TCP ports', 'Injecting shell commands'], 0],
    ['What is ARP spoofing used for on a local LAN?', ['Redirecting LAN traffic through the attacker\'s machine (MitM)', 'Cracking WPA3 offline', 'Overloading a DNS root server', 'Deleting browser cookies'], 0],
    ['What does the Principle of Least Privilege mean?', ['Granting every user and service only the minimum access needed', 'Giving admins no passwords', 'Blocking all outbound traffic', 'Running everything as root'], 0],
  ];

  const int2ip = n => [(n >>> 24) & 255, (n >>> 16) & 255, (n >>> 8) & 255, n & 255].join('.');
  function makeSubnetQ() {
    const cidr = pick([24, 25, 26, 27, 28, 29, 30]);
    const block = 1 << (32 - cidr), usable = block - 2;
    const baseA = pick([10, 172, 192]), baseB = baseA === 192 ? 168 : baseA === 172 ? rndRange(16, 31) : rnd(250);
    const baseC = rnd(250), netLast = (rnd(256 / block) * block);
    const hostOff = rndRange(1, usable);
    const ipStr = baseA + '.' + baseB + '.' + baseC + '.' + (netLast + hostOff);
    const netStr = baseA + '.' + baseB + '.' + baseC + '.' + netLast;
    const bcastStr = baseA + '.' + baseB + '.' + baseC + '.' + (netLast + block - 1);
    const kind = rnd(3);
    if (kind === 0) {
      const wrong = shuffle([...new Set([block, usable + 2, 254, 126, 62, 30, 14, 6, 2, 510].filter(v => v !== usable))]).slice(0, 3);
      return { cat: 'Subnets', diff: 3, q: 'How many USABLE host addresses fit in a /' + cidr + ' IPv4 subnet?', o: shuffle([usable, ...wrong]).map(String), a: String(usable), e: '2^(32-' + cidr + ') - 2 = ' + block + ' - 2 = ' + usable + ' usable hosts.' };
    }
    if (kind === 1) {
      const wrongVals = shuffle([...new Set([netLast + 1, (netLast + block) & 255, Math.max(0, netLast - block), netLast + block - 1, 0, 1, 128, 192, 255].filter(v => v !== netLast))]).slice(0, 3);
      return { cat: 'Subnets', diff: 4, q: 'What is the NETWORK address for ' + ipStr + '/' + cidr + '?', o: shuffle([netStr, ...wrongVals.map(v => baseA + '.' + baseB + '.' + baseC + '.' + v)]), a: netStr, e: 'Block size for /' + cidr + ' is ' + block + ', so ' + (netLast + hostOff) + ' rounds down to ' + netLast + ' (' + netStr + ').' };
    }
    const bLast = netLast + block - 1;
    const wrongVals = shuffle([...new Set([netLast, Math.max(0, bLast - 1), Math.min(255, netLast + block), 255, 127, 63, 31, 15, 7].filter(v => v !== bLast))]).slice(0, 3);
    return { cat: 'Subnets', diff: 4, q: 'What is the BROADCAST address for ' + ipStr + '/' + cidr + '?', o: shuffle([bcastStr, ...wrongVals.map(v => baseA + '.' + baseB + '.' + baseC + '.' + v)]), a: bcastStr, e: 'Network ' + netStr + ' + block ' + block + ' - 1 = ' + bcastStr + '.' };
  }
  function makeFirewallQ() {
    const p1 = pick([22, 80, 443, 3389, 445, 5432, 6379]), p2 = pick([22, 80, 443, 3389, 445, 5432, 6379].filter(x => x !== p1));
    const rules = [
      { id: 1, act: 'DENY', src: '203.0.113.0/24', port: 'ANY' },
      { id: 2, act: 'ALLOW', src: '10.0.0.0/8', port: String(p1) },
      { id: 3, act: 'DENY', src: 'ANY', port: String(p2) },
      { id: 4, act: 'ALLOW', src: 'ANY', port: '443' },
      { id: 5, act: 'DENY', src: 'ANY', port: 'ANY (default)' },
    ];
    const pktSrc = pick(['203.0.113.' + rndRange(5, 240), '10.0.' + rnd(20) + '.' + rndRange(2, 200), '198.51.100.' + rndRange(2, 200)]);
    const pktPort = pick([p1, p2, 443, 8080]);
    let hit = rules[4];
    for (const r of rules) {
      const srcOk = r.src === 'ANY' || (r.src.startsWith('203.0.113.') && pktSrc.startsWith('203.0.113.')) || (r.src.startsWith('10.') && pktSrc.startsWith('10.'));
      const portOk = r.port === 'ANY' || r.port.startsWith('ANY') || r.port === String(pktPort);
      if (srcOk && portOk) { hit = r; break; }
    }
    const ans = hit.act + ' (Rule ' + hit.id + ')';
    const decoys = shuffle([...new Set([(hit.act === 'ALLOW' ? 'DENY' : 'ALLOW') + ' (Rule ' + hit.id + ')', 'ALLOW (Rule 4)', 'DENY (Rule 5)', 'ALLOW (Rule 2)', 'DENY (Rule 1)', 'DENY (Rule 3)'].filter(v => v !== ans))]).slice(0, 3);
    const tbl = rules.map(r => '  #' + r.id + '  ' + r.act.padEnd(5) + '  src=' + r.src.padEnd(15) + '  dst_port=' + r.port).join('\n');
    return { cat: 'Firewalls', diff: 4, monoQ: true, q: 'First-match firewall ACL:\n' + tbl + '\n\nPacket arrives from ' + pktSrc + ' → TCP port ' + pktPort + '. What happens?', o: shuffle([ans, ...decoys]), a: ans, e: 'Firewalls evaluate top-down and stop at the first match: Rule #' + hit.id + ' (' + hit.act + ' src=' + hit.src + ' port=' + hit.port + ').' };
  }
  function makeIpClassQ() {
    const pickType = rnd(5);
    let addr, ans, exp;
    if (pickType === 0) { addr = '10.' + rnd(255) + '.' + rnd(255) + '.' + rndRange(1, 254); ans = 'Private (RFC 1918)'; exp = '10.0.0.0/8 is private RFC 1918 space.'; }
    else if (pickType === 1) { addr = '172.' + rndRange(16, 31) + '.' + rnd(255) + '.' + rndRange(1, 254); ans = 'Private (RFC 1918)'; exp = '172.16.0.0/12 (172.16–172.31) is private RFC 1918 space.'; }
    else if (pickType === 2) { addr = '127.' + rnd(2) + '.' + rnd(2) + '.' + rndRange(1, 254); ans = 'Loopback (this device)'; exp = '127.0.0.0/8 always loops back to the local host.'; }
    else if (pickType === 3) { addr = '169.254.' + rnd(255) + '.' + rndRange(1, 254); ans = 'Link-local / APIPA (no DHCP)'; exp = '169.254.0.0/16 is auto-assigned when DHCP fails.'; }
    else { addr = pick([8, 45, 52, 91, 142, 172]) + '.' + (pickType === 4 ? rndRange(32, 220) : rnd(250)) + '.' + rnd(250) + '.' + rndRange(1, 254); ans = 'Public routable internet IP'; exp = addr + ' is outside RFC 1918, loopback, and link-local ranges.'; }
    return { cat: 'Subnets', diff: 2, q: 'How is the IPv4 address ' + addr + ' classified?', o: shuffle(['Private (RFC 1918)', 'Public routable internet IP', 'Loopback (this device)', 'Link-local / APIPA (no DHCP)']), a: ans, e: exp };
  }
  function makeChmodQ() {
    const tri = n => (n & 4 ? 'r' : '-') + (n & 2 ? 'w' : '-') + (n & 1 ? 'x' : '-');
    const u = pick([4, 6, 7]), g = pick([0, 4, 5, 6, 7]), o = pick([0, 4, 5]);
    const oct = '' + u + g + o, sym = '-' + tri(u) + tri(g) + tri(o);
    if (rnd(2)) {
      const wrongs = new Set([oct]);
      while (wrongs.size < 4) wrongs.add('' + pick([4, 5, 6, 7]) + pick([0, 4, 5, 6, 7]) + pick([0, 1, 4, 5, 6]));
      return { cat: 'Chmod', diff: 3, q: 'What numeric chmod mode equals "' + sym + '"?', o: shuffle([...wrongs]), a: oct, e: 'r=4, w=2, x=1: owner=' + u + ' (' + tri(u) + '), group=' + g + ' (' + tri(g) + '), other=' + o + ' (' + tri(o) + ') → ' + oct + '.' };
    }
    const wrongs = new Set([sym]);
    while (wrongs.size < 4) wrongs.add('-' + tri(pick([4, 5, 6, 7])) + tri(pick([0, 4, 5, 6])) + tri(pick([0, 4, 5])));
    return { cat: 'Chmod', diff: 3, q: 'Which symbolic permission string matches "chmod ' + oct + '"?', o: shuffle([...wrongs]), a: sym, e: oct + ' splits into owner ' + u + '=' + tri(u) + ', group ' + g + '=' + tri(g) + ', other ' + o + '=' + tri(o) + '.' };
  }
  function makeNetQuestion(cat) {
    const c = cat && cat !== 'all' ? cat : pick(['ports', 'ports', 'subnets', 'firewalls', 'chmod', 'concepts', 'concepts']);
    if (c === 'ports') {
      const p = pick(PORTS), wrong = shuffle(PORTS.filter(x => x !== p)).slice(0, 3);
      if (rnd(2)) return { cat: 'Ports', diff: 2, q: 'Which service normally uses port ' + p[0] + '?', o: shuffle([p[1], ...wrong.map(x => x[1])]), a: p[1], e: p[1] + ' (' + p[2] + ') runs on port ' + p[0] + '.' };
      return { cat: 'Ports', diff: 2, q: 'Which port is normally used for ' + p[1] + ' (' + p[2] + ')?', o: shuffle([p[0], ...wrong.map(x => x[0])]).map(String), a: String(p[0]), e: p[1] + ' uses port ' + p[0] + '.' };
    }
    if (c === 'subnets') return rnd(3) === 0 ? makeIpClassQ() : makeSubnetQ();
    if (c === 'firewalls') return makeFirewallQ();
    if (c === 'chmod') return makeChmodQ();
    const x = pick(CONCEPTS);
    return { cat: 'Concepts', diff: 2, q: x[0], o: shuffle(x[1].slice()), a: x[1][x[2]], e: 'Correct answer: ' + x[1][x[2]] + '.' };
  }
  L.net = { makeQuestion: makeNetQuestion, PORTS, CONCEPTS };

  reg('netninja', 'Net Ninja', '🥷', 'Infinite networking & security drills: 36 ports, procedural CIDR subnet math, live firewall ACLs, chmod octal/symbolic, and concepts.', (el, api) => {
    const R = makeRating('cynet');
    let cur = null, done = false, cat = 'all', mode = 'endless', sprintN = 0, sprintOk = 0;
    el.innerHTML = '<div style="width:min(660px,100%)">' +
      '<div class="row" style="gap:6px;flex-wrap:wrap;margin-bottom:8px;align-items:center">' +
        '<select id="nmode" class="ib" style="padding:4px 8px"><option value="endless">∞ Endless Puzzles</option><option value="sprint">10-Question Sprint</option></select>' +
        '<select id="ncat" class="ib" style="padding:4px 8px"><option value="all">All Topics</option><option value="ports">Ports (36)</option><option value="subnets">Subnets & IPs (∞)</option><option value="firewalls">Firewall ACLs (∞)</option><option value="chmod">Linux Chmod (∞)</option><option value="concepts">Security Concepts</option></select>' +
        '<span id="ntag" class="small"></span>' +
        '<span class="sp"></span>' +
        btn('nacad', '🎓 Academy') +
      '</div>' +
      '<div id="nq" style="' + box + ';font-size:15px;white-space:pre-wrap;line-height:1.55"></div>' +
      '<div id="no" style="display:grid;gap:8px;margin-top:10px"></div>' +
      '<div id="nm" style="margin-top:10px"></div>' +
    '</div>';
    const next = () => {
      done = false; $('nm').innerHTML = '';
      if (mode === 'sprint' && sprintN >= 10) {
        api.submit(Math.max(sprintOk * 15, R.rating));
        $('nq').innerHTML = '<b>Sprint complete!</b> You scored <b>' + sprintOk + ' / 10</b>. <button class="pri" data-nre="1" style="margin-left:8px">New Sprint</button>';
        $('no').innerHTML = ''; cur = null; return;
      }
      cur = makeNetQuestion(cat);
      $('ntag').innerHTML = badge(cur.cat, 'var(--acc)') + ' ' + badge(mode === 'sprint' ? ((sprintN + 1) + '/10') : '∞');
      $('nq').style.fontFamily = cur.monoQ ? 'Consolas,"Cascadia Mono",monospace' : '';
      $('nq').style.fontSize = cur.monoQ ? '13px' : '15px';
      $('nq').textContent = cur.q;
      $('no').innerHTML = cur.o.map((o, idx) => '<button class="ib" style="text-align:left;padding:9px 12px;' + (cur.cat === 'Chmod' || cur.cat === 'Subnets' ? mono : '') + '" data-o="' + esc(o) + '"><span class="mute" style="margin-right:8px">' + (idx + 1) + '.</span>' + esc(o) + '</button>').join('');
      api.hud(R.hud(mode === 'sprint' ? ('Sprint ' + sprintOk + '/' + sprintN) : ''));
    };
    $('nq').onclick = e => { if (e.target.closest('[data-nre]')) { sprintN = 0; sprintOk = 0; next(); } };
    $('no').onclick = e => {
      const b = e.target.closest('[data-o]'); if (!b || done || !cur) return;
      done = true;
      const right = b.dataset.o === cur.a;
      const d = R.update(right, cur.diff, false);
      if (mode === 'sprint') { sprintN++; if (right) sprintOk++; }
      api.submit(R.rating);
      if (right) b.style.borderColor = 'var(--ok)';
      else { b.style.borderColor = 'var(--bad)'; $('no').querySelectorAll('[data-o]').forEach(y => { if (y.dataset.o === cur.a) y.style.borderColor = 'var(--ok)'; }); }
      $('nm').innerHTML = '<div class="small" style="margin-bottom:6px;color:var(--' + (right ? 'ok' : 'bad') + ')"><b>' + (right ? 'Correct! +' + d + ' Elo' : 'Incorrect (' + d + ' Elo)') + '</b> — <span style="color:var(--text)">' + esc(cur.e) + '</span></div><button class="pri" data-nnx="1">Next question →</button>';
      api.hud(R.hud(mode === 'sprint' ? ('Sprint ' + sprintOk + '/' + sprintN) : ''));
    };
    $('nm').onclick = e => { if (e.target.closest('[data-nnx]')) next(); };
    $('nacad').onclick = () => { if (A.cybertab) A.cybertab.go('games', 'net_academy'); };
    $('nmode').onchange = () => { mode = $('nmode').value; sprintN = 0; sprintOk = 0; next(); };
    $('ncat').onchange = () => { cat = $('ncat').value; next(); };
    next();
    return () => { };
  });

  /* ================= 6. LOG DETECTIVE (INFINITE MULTI-SCENARIO SOC CASES) ================= */
  const NAMES = ['alice', 'bob', 'carol', 'dave', 'erin', 'frank', 'admin', 'deploy', 'svc-backup', 'ops', 'finance', 'jenkins'];
  const ip = () => '10.0.' + rnd(4) + '.' + (10 + rnd(200));
  const pubip = () => pick([23, 45, 51, 77, 89, 103, 141, 167, 185, 194, 209]) + '.' + rnd(250) + '.' + rnd(250) + '.' + (1 + rnd(250));
  const fmtTs = s => { s = ((s % 86400) + 86400) % 86400; return String(s / 3600 | 0).padStart(2, '0') + ':' + String(s % 3600 / 60 | 0).padStart(2, '0') + ':' + String(s % 60).padStart(2, '0'); };

  L.makeLog = (n, noise) => {
    const attacker = pubip(), target = pick(['admin', 'deploy', 'svc-backup']), lines = [], ips = new Set([attacker]);
    const hosts = []; for (let k = 0; k < noise; k++) { const h = Math.random() < .5 ? ip() : pubip(); hosts.push(h); ips.add(h); }
    const total = n, atk = 14 + rnd(8); let t = 8 * 3600 + rnd(3000);
    const ev = [];
    for (let k = 0; k < atk; k++) ev.push({ ip: attacker, ok: false, u: pick(NAMES) });
    ev.push({ ip: attacker, ok: true, u: target, last: true });
    for (let k = 0; k < total - atk - 1; k++) { const h = pick(hosts.length ? hosts : [ip()]); ev.push({ ip: h, ok: Math.random() < .8, u: pick(NAMES) }); }
    const atkEv = ev.filter(e => e.ip === attacker), others = shuffle(ev.filter(e => e.ip !== attacker));
    const merged = []; let ai = 0;
    for (const o of others) { merged.push(o); if (Math.random() < .45 && ai < atkEv.length - 1) merged.push(atkEv[ai++]); }
    while (ai < atkEv.length) merged.push(atkEv[ai++]);
    let first = null;
    for (const e of merged) { t += 4 + rnd(40); e.t = fmtTs(t); if (e.ip === attacker && !first) first = e.t; lines.push({ t: e.t, ip: e.ip, ok: e.ok, u: e.u }); }
    return { lines, attacker, target, first, ips: [...ips] };
  };

  function makeSocCase(scenario, round) {
    const kind = scenario && scenario !== 'all' ? scenario : pick(['ssh', 'spray', 'webscan', 'sqliweb', 'exfil', 'travel']);
    const noiseCount = 5 + Math.min(round || 0, 5);
    const baseLines = 44 + Math.min(round || 0, 6) * 8;

    if (kind === 'ssh') {
      const g = L.makeLog(baseLines, noiseCount);
      const rows = g.lines.map(l => ({
        key: l.ip, raw: l.t + ' sshd ' + (l.ok ? 'Accepted' : 'Failed') + ' ' + l.u + ' ' + l.ip,
        html: '<span style="color:#789">' + l.t + '</span> sshd: ' + (l.ok ? '<span style="color:#6f6">Accepted password</span>' : '<span style="color:#f77">Failed password</span>') + ' for <b>' + esc(l.u) + '</b> from <a data-hl="' + l.ip + '" style="color:#6cf;cursor:pointer;text-decoration:underline">' + l.ip + '</a>'
      }));
      return {
        kind: 'SSH Brute Force', diff: 2, rows,
        q1: 'Which IP address is brute-forcing SSH?', a1: g.attacker, opts1: shuffle([g.attacker, ...shuffle(g.ips.filter(x => x !== g.attacker)).slice(0, 5)]),
        hint1: 'Look for one IP with a long burst of Failed password lines.',
        q2: 'They got in! Which account did ' + g.attacker + ' compromise?', a2: g.target, opts2: shuffle([g.target, ...shuffle(NAMES.filter(x => x !== g.target)).slice(0, 4)]),
        hint2: 'Filter or highlight ' + g.attacker + ' and find the green Accepted line.',
        lesson: 'Defenses: disable password auth (SSH keys only), enable fail2ban lockouts, and restrict port 22.'
      };
    }

    if (kind === 'spray') {
      const attacker = pubip(), victims = shuffle(NAMES).slice(0, 8), breached = victims[victims.length - 1];
      const hosts = Array.from({ length: noiseCount }, () => Math.random() < .5 ? ip() : pubip());
      const evs = [];
      victims.forEach((u, idx) => evs.push({ ip: attacker, u, ok: idx === victims.length - 1 }));
      for (let i = 0; i < baseLines - evs.length; i++) evs.push({ ip: pick(hosts), u: pick(NAMES), ok: Math.random() < .88 });
      const mix = shuffle(evs.slice(0, -1));
      mix.splice(Math.max(5, mix.length - 6), 0, evs[evs.length - 1]);
      let t = 9 * 3600 + rnd(3600);
      const rows = mix.map(e => {
        t += 12 + rnd(45); const ts = fmtTs(t);
        return {
          key: e.ip, raw: ts + ' sso ' + (e.ok ? 'LOGIN_OK' : 'BAD_PASS') + ' ' + e.u + ' ' + e.ip,
          html: '<span style="color:#789">' + ts + '</span> sso: ' + (e.ok ? '<span style="color:#6f6">LOGIN_OK</span>' : '<span style="color:#f77">BAD_PASS</span>') + ' user=<b>' + esc(e.u) + '</b> src=<a data-hl="' + e.ip + '" style="color:#6cf;cursor:pointer;text-decoration:underline">' + e.ip + '</a>'
        };
      });
      return {
        kind: 'Password Spraying', diff: 3, rows,
        q1: 'Low-and-slow password spray! Which IP tried many DIFFERENT usernames (1 attempt each)?', a1: attacker, opts1: shuffle([attacker, ...hosts.slice(0, 5)]),
        hint1: 'Password sprayers try 1 common password across many different accounts to evade per-user lockouts.',
        q2: 'Which user account had a weak password and let ' + attacker + ' log in?', a2: breached, opts2: shuffle([breached, ...victims.slice(0, 4)]),
        hint2: 'Highlight ' + attacker + ' and find its LOGIN_OK line.',
        lesson: 'Defenses: block commonly leaked passwords, enforce MFA, and alert on one IP failing across many distinct users.'
      };
    }

    if (kind === 'webscan') {
      const attacker = pubip(), hosts = Array.from({ length: noiseCount }, () => pubip());
      const probes = ['/.env', '/wp-admin', '/phpmyadmin', '/.git/config', '/backup.sql', '/admin/login', '/config.bak', '/api/debug', '/server-status', '/.aws/credentials'];
      const exposed = pick(['/.env', '/backup.sql', '/.git/config', '/api/debug', '/config.bak']);
      const normal = ['/', '/index.html', '/pricing', '/docs', '/api/health', '/assets/app.js', '/login'];
      const evs = [];
      for (const p of shuffle(probes)) evs.push({ ip: attacker, path: p, code: p === exposed ? 200 : 404 });
      for (let i = 0; i < baseLines - evs.length; i++) evs.push({ ip: pick(hosts), path: pick(normal), code: 200 });
      let t = 13 * 3600 + rnd(3600);
      const rows = shuffle(evs).map(e => {
        t += 1 + rnd(12); const ts = fmtTs(t);
        const col = e.code === 200 ? '#6f6' : '#fc6';
        return {
          key: e.ip, raw: ts + ' GET ' + e.path + ' ' + e.code + ' ' + e.ip,
          html: '<span style="color:#789">' + ts + '</span> nginx: <a data-hl="' + e.ip + '" style="color:#6cf;cursor:pointer;text-decoration:underline">' + e.ip + '</a> GET <b>' + esc(e.path) + '</b> <span style="color:' + col + '">' + e.code + '</span>'
        };
      });
      return {
        kind: 'Web Directory Recon', diff: 3, rows,
        q1: 'An automated scanner is probing hidden paths (lots of 404s). Which IP is scanning?', a1: attacker, opts1: shuffle([attacker, ...hosts.slice(0, 5)]),
        hint1: 'Type "404" in the filter box to spot the IP generating almost every 404.',
        q2: 'Uh-oh — one sensitive path returned HTTP 200 OK to the scanner! Which one?', a2: exposed, opts2: shuffle([exposed, ...shuffle(probes.filter(x => x !== exposed)).slice(0, 4)]),
        hint2: 'Highlight ' + attacker + ' and find the single green 200 line.',
        lesson: 'Defenses: never leave .env, .git, or backup files inside webroot, and block automated 404 scanners.'
      };
    }

    if (kind === 'sqliweb') {
      const attacker = pubip(), hosts = Array.from({ length: noiseCount }, () => pubip());
      const targetEp = pick(['/api/search', '/api/invoice', '/api/report', '/api/user', '/api/download']);
      const payloads = [targetEp + "?q=' OR 1=1--", targetEp + '?file=../../../../etc/passwd', targetEp + "?id=1 UNION SELECT user,pass FROM users--", targetEp + '?path=..%2f..%2fetc%2fshadow'];
      const normal = ['/api/items?page=1', '/api/items?page=2', '/api/profile', '/api/status', '/dashboard', '/help'];
      const evs = [];
      for (let i = 0; i < 6; i++) evs.push({ ip: attacker, req: pick(payloads), code: i === 5 ? 200 : 500 });
      for (let i = 0; i < baseLines - 6; i++) evs.push({ ip: pick(hosts), req: pick(normal), code: 200 });
      let t = 15 * 3600 + rnd(3600);
      const rows = shuffle(evs).map(e => {
        t += 2 + rnd(15); const ts = fmtTs(t);
        return {
          key: e.ip, raw: ts + ' ' + e.ip + ' ' + e.req + ' ' + e.code,
          html: '<span style="color:#789">' + ts + '</span> web: <a data-hl="' + e.ip + '" style="color:#6cf;cursor:pointer;text-decoration:underline">' + e.ip + '</a> GET <b>' + esc(e.req) + '</b> <span style="color:' + (e.code === 500 ? '#f77' : '#6f6') + '">' + e.code + '</span>'
        };
      });
      return {
        kind: 'Web Exploit (SQLi / Traversal)', diff: 4, rows,
        q1: 'Which external IP is launching SQL injection / path traversal payloads?', a1: attacker, opts1: shuffle([attacker, ...hosts.slice(0, 5)]),
        hint1: 'Filter for "UNION", "OR", "..", or "500" in the log search box.',
        q2: 'Which API endpoint is being targeted by ' + attacker + '?', a2: targetEp, opts2: shuffle([targetEp, ...['/api/search', '/api/invoice', '/api/report', '/api/user', '/api/download'].filter(x => x !== targetEp).slice(0, 4)]),
        hint2: 'Highlight ' + attacker + ' and read the URL path before the "?" query string.',
        lesson: 'Defenses: use parameterized SQL queries, validate file paths against an allowlist, and monitor HTTP 500 spikes.'
      };
    }

    if (kind === 'exfil') {
      const infected = ip(), dropIp = pubip();
      const internals = Array.from({ length: noiseCount }, () => ip());
      const externals = Array.from({ length: 5 }, () => pubip());
      const evs = [];
      for (let i = 0; i < 4; i++) evs.push({ src: infected, dst: dropIp, kb: rndRange(280000, 920000), port: 443 });
      for (let i = 0; i < baseLines - 4; i++) evs.push({ src: pick(internals), dst: pick(externals), kb: rndRange(2, 180), port: pick([443, 80, 53]) });
      let t = 2 * 3600 + rnd(3600);
      const rows = shuffle(evs).map(e => {
        t += 5 + rnd(30); const ts = fmtTs(t);
        const sz = e.kb > 1024 ? (e.kb / 1024).toFixed(1) + ' MB' : e.kb + ' KB';
        return {
          key: e.src, raw: ts + ' EGRESS ' + e.src + ' -> ' + e.dst + ':' + e.port + ' ' + sz,
          html: '<span style="color:#789">' + ts + '</span> fw-egress: <a data-hl="' + e.src + '" style="color:#6cf;cursor:pointer;text-decoration:underline">' + e.src + '</a> → <span style="color:#fc6">' + e.dst + ':' + e.port + '</span> bytes=<b>' + sz + '</b>'
        };
      });
      return {
        kind: 'Data Exfiltration Spike', diff: 4, rows,
        q1: 'At 2 AM, one internal workstation quietly uploaded hundreds of MB! Which internal host is compromised?', a1: infected, opts1: shuffle([infected, ...internals.slice(0, 5)]),
        hint1: 'Type "MB" in the filter box to separate giant uploads from normal KB traffic.',
        q2: 'Which external drop server IP received the stolen data?', a2: dropIp, opts2: shuffle([dropIp, ...externals.slice(0, 4)]),
        hint2: 'Highlight ' + infected + ' and check the destination IP after the arrow →.',
        lesson: 'Defenses: monitor outbound byte anomalies (DLP/NetFlow), segment internal servers, and alert on off-hours bulk uploads.'
      };
    }

    const victim = pick(NAMES), homeCity = pick(['New York, US', 'Chicago, US', 'Austin, US', 'Seattle, US']);
    const farCity = pick(['Moscow, RU', 'Bucharest, RO', 'Lagos, NG', 'Singapore, SG', 'Sao Paulo, BR']);
    const homeIp = pubip(), rogueIp = pubip();
    const peers = shuffle(NAMES.filter(x => x !== victim)).slice(0, 5);
    const peerMap = Object.fromEntries(peers.map(u => [u, { ip: pubip(), city: pick(['Denver, US', 'Boston, US', 'Toronto, CA', 'London, UK', 'Dublin, IE']) }]));
    const evs = [];
    for (let i = 0; i < baseLines - 2; i++) { const u = pick(peers); evs.push({ u, ip: peerMap[u].ip, city: peerMap[u].city }); }
    let t = 10 * 3600 + rnd(3600);
    const pos = Math.max(6, Math.min(evs.length - 6, rnd(evs.length - 10) + 5));
    evs.splice(pos, 0, { u: victim, ip: homeIp, city: homeCity });
    evs.splice(pos + 2, 0, { u: victim, ip: rogueIp, city: farCity });
    const rows = evs.map(e => {
      t += 30 + rnd(90); const ts = fmtTs(t);
      return {
        key: e.u, raw: ts + ' cloud-auth ' + e.u + ' ' + e.ip + ' ' + e.city,
        html: '<span style="color:#789">' + ts + '</span> cloud-sso: user=<a data-hl="' + e.u + '" style="color:#6cf;cursor:pointer;text-decoration:underline">' + esc(e.u) + '</a> ip=<b>' + e.ip + '</b> geo=<span style="color:#fc6">' + esc(e.city) + '</span>'
      };
    });
    return {
      kind: 'Impossible Travel', diff: 5, rows,
      q1: 'Impossible travel alert! Which user logged in from two distant countries minutes apart?', a1: victim, opts1: shuffle([victim, ...peers.slice(0, 4)]),
      hint1: 'Look for a single user appearing from both a US city and a distant overseas city within minutes.',
      q2: 'Which rogue IP address accessed ' + victim + '\'s account from ' + farCity + '?', a2: rogueIp, opts2: shuffle([rogueIp, homeIp, ...peers.slice(0, 3).map(u => peerMap[u].ip)]),
      hint2: 'Filter for "' + victim + '" in the search box and pick the IP from ' + farCity + '.',
      lesson: 'Defenses: enable phishing-resistant MFA (passkeys/FIDO2), revoke active sessions, and trigger impossible-travel alerts.'
    };
  }
  L.logs = { makeCase: makeSocCase };

  reg('logs', 'Log Detective', '🕵️', 'Infinite multi-scenario SOC investigations: SSH brute force, password sprays, web scans, SQLi/traversal, data exfiltration & impossible travel.', (el, api) => {
    const R = makeRating('cylog');
    let G, round = 0, step = 0, hl = '', scenario = 'all', filter = '';
    el.innerHTML = '<div style="width:min(800px,100%)">' +
      '<div class="row" style="gap:6px;flex-wrap:wrap;margin-bottom:8px;align-items:center">' +
        '<select id="lsc" class="ib" style="padding:4px 8px"><option value="all">All SOC Scenarios (∞)</option><option value="ssh">SSH Brute Force</option><option value="spray">Password Spray</option><option value="webscan">Web Dir Scanner</option><option value="sqliweb">SQLi / Path Traversal</option><option value="exfil">Data Exfiltration</option><option value="travel">Impossible Travel</option></select>' +
        '<input type="text" id="lfilt" placeholder="SIEM filter (e.g. 404, MB, Failed, IP...)" autocomplete="off" spellcheck="false" style="flex:1;min-width:180px;padding:5px 9px;font-size:12.5px">' +
        btn('lacad', '🎓 Academy') +
        btn('lnew', '∞ New case') +
      '</div>' +
      '<div id="lq" style="' + box + ';margin-bottom:8px"></div>' +
      '<div class="small mute" style="margin-bottom:4px">Tip: click any blue IP/user to highlight all its lines, or type in the SIEM filter above.</div>' +
      '<div id="ll" style="max-height:280px;overflow:auto;background:#05070b;border:1px solid var(--line);border-radius:10px;padding:8px;' + mono + ';font-size:12px;line-height:1.55"></div>' +
      '<div id="lo" class="row" style="gap:6px;flex-wrap:wrap;margin-top:10px"></div>' +
      '<div id="lm" style="margin-top:8px"></div>' +
    '</div>';
    const drawLog = () => {
      const f = filter.trim().toLowerCase();
      const vis = f ? G.rows.filter(r => r.raw.toLowerCase().includes(f)) : G.rows;
      $('ll').innerHTML = vis.length ? vis.map(r => '<div style="' + (hl && r.key === hl ? 'background:#3a2a00;' : '') + '">' + r.html + '</div>').join('') : '<div class="mute">(no log lines match "' + esc(filter) + '")</div>';
    };
    const ask = () => {
      $('lm').innerHTML = '';
      const q = step === 0 ? G.q1 : G.q2, opts = step === 0 ? G.opts1 : G.opts2;
      $('lq').innerHTML = badge(G.kind, 'var(--acc)') + ' ' + badge('Case #' + (round + 1)) + '<div style="margin-top:5px"><b>' + esc(q) + '</b></div>';
      $('lo').innerHTML = opts.map(o => '<button class="ib" data-a="' + esc(o) + '" style="' + mono + '">' + esc(o) + '</button>').join('');
      api.hud(R.hud('Cases ' + R.solved));
    };
    const start = () => {
      G = makeSocCase(scenario, round);
      step = 0; hl = ''; filter = '';
      $('lfilt').value = '';
      drawLog(); ask();
    };
    $('lacad').onclick = () => { if (A.cybertab) A.cybertab.go('games', 'logs_academy'); };
    $('lsc').onchange = () => { scenario = $('lsc').value; start(); };
    $('lfilt').oninput = () => { filter = $('lfilt').value; drawLog(); };
    $('lnew').onclick = () => { start(); };
    $('ll').onclick = e => { const a = e.target.closest('[data-hl]'); if (!a) return; hl = hl === a.dataset.hl ? '' : a.dataset.hl; drawLog(); };
    $('lo').onclick = e => {
      const b = e.target.closest('[data-a]'); if (!b) return;
      const ans = b.dataset.a, right = step === 0 ? ans === G.a1 : ans === G.a2;
      if (!right) {
        b.style.borderColor = 'var(--bad)';
        R.update(false, G.diff, false);
        $('lm').innerHTML = '<span style="color:var(--bad)">Not that one.</span> <span class="small mute">' + esc(step === 0 ? G.hint1 : G.hint2) + '</span>';
        api.hud(R.hud('Cases ' + R.solved));
        return;
      }
      if (step === 0) {
        step = 1; hl = G.a1; drawLog(); ask();
      } else {
        const d = R.update(true, G.diff, false);
        round++;
        ls.set('cylog', String(R.solved));
        api.submit(R.rating);
        $('lm').innerHTML = '<span style="color:var(--ok)">Case closed! +' + d + ' Elo</span> <span class="small mute">' + esc(G.lesson) + '</span> <button class="pri" data-lnx="1" style="margin-left:8px">Next case →</button>';
        $('lo').innerHTML = '';
        api.hud(R.hud('Cases ' + R.solved));
      }
    };
    $('lm').onclick = e => { if (e.target.closest('[data-lnx]')) start(); };
    start();
    return () => { };
  });
})();

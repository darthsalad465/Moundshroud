// Cyber > the Cyber Academies: a guided, hands-on lesson path for every cyber game, like Terminal
// Hacker's 12-lesson academy. Each academy is its own card in Cyber > 🕶️ Cyber games and teaches one
// game's skills in short steps you actually do (decode this, inject that, judge this email), then hands
// you to the game when you finish. Everything runs here on this PC against fake data.
(() => {
  const P = A.play = A.play || { games: {} };
  const L = P.logic = P.logic || {};
  let stage = null;
  const $ = id => stage && stage.querySelector('#' + id);
  const esc = t => String(t == null ? '' : t).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const btn = (id, t, cls) => '<button class="' + (cls || 'ib') + '" id="' + id + '">' + t + '</button>';
  const box = 'border:1px solid var(--line);background:var(--panel2);border-radius:10px;padding:10px 12px';
  const mono = 'font-family:Consolas,"Cascadia Mono",monospace';
  const badge = (t, col) => '<span style="display:inline-block;padding:2px 8px;border-radius:999px;font-size:11.5px;border:1px solid ' + (col || 'var(--line)') + ';color:' + (col || 'var(--mute)') + ';background:rgba(255,255,255,.03)">' + esc(t) + '</span>';

  /* ---------------- the lesson runner: one engine, used by every academy ---------------- */
  const store = key => {
    try { const v = JSON.parse(ls.get('cyacad_' + key, '[]')); return Array.isArray(v) ? v : []; } catch (e) { return []; }
  };

  function mountAcademy(el, api, key, lessons, O) {
    let li = 0, si = 0, answered = false;
    const done = new Set(store(key));
    const cur = () => lessons[li];
    const step = () => cur().steps[si];
    const save = () => ls.set('cyacad_' + key, JSON.stringify([...done]));
    const val = v => typeof v === 'function' ? v() : v;

    el.innerHTML = '<div style="width:min(760px,100%);padding-bottom:16px">' +
      '<div class="row" style="gap:6px;flex-wrap:wrap;margin-bottom:8px;align-items:center">' +
        btn('acplay', '▶ ' + esc(O.game)) +
        '<select id="acls" class="ib" style="padding:4px 8px;max-width:280px"></select>' +
        btn('acprev', '←') + btn('acnext', '→') +
        '<span class="sp"></span>' +
        btn('acex', '⚡ Try Example') + btn('achint', 'Hint') +
      '</div>' +
      '<div id="acg" style="' + box + ';margin-bottom:8px"></div>' +
      '<div id="acb"></div>' +
      '<div id="acm" class="small" style="min-height:22px;margin-top:8px"></div>' +
    '</div>';

    const hud = () => api && api.hud && api.hud('🎓 ' + O.name + ' ' + done.size + '/' + lessons.length + (li < lessons.length ? '   Step ' + Math.min(si + 1, cur().steps.length) + '/' + cur().steps.length : '   Complete'));

    const renderSelect = () => {
      const s = $('acls'); if (!s) return;
      s.innerHTML = lessons.map((l, i) => '<option value="' + i + '"' + (i === li ? ' selected' : '') + '>' + (done.has(l.id) ? '✓ ' : '') + esc(l.title) + '</option>').join('');
    };

    const renderBanner = () => {
      const l = cur(), complete = si >= l.steps.length;
      const dots = l.steps.map((s, i) => {
        const st = i < si ? '✓' : i === si ? '▶' : '○';
        const col = i < si ? 'var(--ok)' : i === si ? 'var(--acc)' : 'var(--mute)';
        return '<div style="margin-top:3px;color:' + col + '">' + st + ' <b>Step ' + (i + 1) + ':</b> ' + esc(s.prompt) + '</div>';
      }).join('');
      $('acg').innerHTML = '<div class="row" style="gap:6px;flex-wrap:wrap;align-items:center"><b>🎓 ' + esc(l.title) + '</b> ' + badge(l.badge, 'var(--acc)') + ' ' + badge('Done ' + done.size + '/' + lessons.length) + '</div>' +
        '<div style="margin-top:3px">' + esc(l.summary) + '</div>' +
        (l.syntax ? '<div style="margin:5px 0;padding:4px 8px;border-radius:6px;background:rgba(0,0,0,.35);' + mono + ';font-size:12px;color:#7ee787">' + esc(l.syntax) + '</div>' : '') +
        dots +
        (complete ? '<div style="margin-top:6px;color:var(--ok)"><b>Lesson complete!</b> <button class="pri small" id="acnl" style="margin-left:6px">' + (li + 1 < lessons.length ? 'Next lesson →' : 'Finish the academy →') + '</button></div>' : '');
      const nl = $('acnl');
      if (nl) nl.onclick = () => { li = Math.min(lessons.length, li + 1); si = 0; renderAll(); };
      hud();
    };

    const renderDone = () => {
      $('acg').innerHTML = '<b>🎓 Academy complete</b> ' + badge(done.size + '/' + lessons.length, 'var(--ok)') +
        '<div style="margin-top:4px">You finished every lesson. The game is the same skills, endless and against the clock.</div>';
      $('acb').innerHTML = '<div style="' + box + '"><b>Ready for the real thing?</b>' +
        '<div class="small mute" style="margin:4px 0 8px">Open ' + esc(O.game) + ' for endless challenges, or run the lessons again.</div>' +
        '<button class="pri" id="acopen">▶ Open ' + esc(O.game) + '</button> <button class="ib" id="acrestart">↺ Start again</button></div>';
      $('acm').innerHTML = '';
      const op = $('acopen'), rs = $('acrestart');
      if (op) op.onclick = () => openGame();
      if (rs) rs.onclick = () => { li = 0; si = 0; renderAll(); };
      hud();
    };

    const renderAll = () => {
      if (!lessons.length) return;
      if (li >= lessons.length) return renderDone();
      renderSelect();
      renderBanner();
      answered = false;
      $('acm').innerHTML = '';
      const host = $('acb');
      host.innerHTML = '';
      if (si >= cur().steps.length) { hud(); return; }
      step().ui(host, ok);
      hud();
    };

    const ok = msg => {
      if (answered) return;
      answered = true;
      /* every correct answer pays the Cyber Desktop's practice bank, once per step */
      try { A.cyberBank?.once('academy:' + key + ':' + cur().id + ':' + si, 18, 'Academy step: ' + cur().title + ' · step ' + (si + 1), 'puzzle', 'puzzles'); } catch (e) { }
      const last = si + 1 >= cur().steps.length;
      $('acm').innerHTML = '<div style="color:var(--ok)"><b>✓ ' + esc(msg || 'Correct!') + '</b> <button class="pri small" id="acgo" style="margin-left:8px">' + (last ? 'Finish lesson →' : 'Continue →') + '</button></div>';
      const g = $('acgo');
      if (g) g.onclick = () => {
        if (si + 1 < cur().steps.length) { si++; renderAll(); return; }
        try { A.cyberBank?.once('academy:' + key + ':' + cur().id + ':lesson', 60, 'Academy lesson finished: ' + cur().title, 'puzzle', 'puzzles'); } catch (e) { }
        done.add(cur().id); save();
        si = cur().steps.length;
        renderAll();
      };
    };

    const openGame = () => {
      if (A.cybertab && A.cybertab.go) A.cybertab.go('games', O.gameId);
      else A.toast('Open Cyber > 🕶️ Cyber games.');
    };

    $('acplay').onclick = openGame;
    $('acls').onchange = () => { li = Math.max(0, Math.min(lessons.length - 1, +$('acls').value)); si = 0; renderAll(); };
    $('acprev').onclick = () => { if (li > 0) { li--; si = 0; renderAll(); } };
    $('acnext').onclick = () => { if (li < lessons.length) { li++; si = 0; renderAll(); } };
    $('achint').onclick = () => {
      if (li >= lessons.length || si >= cur().steps.length) return;
      const h = val(step().hint);
      $('acm').innerHTML = '<span style="color:var(--warn)">Hint: ' + esc(h || 'Re-read the tip above.') + '</span>';
    };
    $('acex').onclick = () => {
      if (li >= lessons.length || si >= cur().steps.length) return;
      const x = val(step().example);
      $('acm').innerHTML = '<span style="color:#fc6">Example: ' + esc(x || 'Follow the tip above.') + '</span>';
    };

    renderAll();
    return () => { };
  }

  const academy = (id, name, icon, desc, key, lessons, opts) => {
    P.games[id] = {
      name, icon, desc, cat: 'cyber',
      mount: (el, api) => { stage = el; return mountAcademy(el, api, key, lessons, opts); }
    };
  };

  /* ==========================================================================================
     1. CIPHER ACADEMY — encodings, classical ciphers, XOR and layered chains
     ========================================================================================== */
  const C = L.cipher || { shift: s => s, atbash: s => s, vig: s => s, MORSE: {}, NATO: {}, revStr: s => s, toHex: s => s, xorHex: s => s };
  const cipherStep = s => ({
    prompt: s.prompt, hint: s.hint, example: () => s.example || ('The plaintext is: ' + s.pt),
    ui: (host, pass) => {
      host.innerHTML = '<div style="' + box + '">' +
        '<div class="small mute" style="margin-bottom:6px">' + esc(s.tag) + '</div>' +
        '<div style="' + mono + ';font-size:16px;word-break:break-all;line-height:1.6">' + esc(s.ct) + '</div>' +
        '</div>' +
        '<div class="row" style="gap:8px;margin-top:8px"><input id="cin" placeholder="Type the decoded plaintext" autocomplete="off" spellcheck="false" style="flex:1;' + mono + '">' +
        '<button class="pri" id="cgo">Check</button></div>' +
        '<div id="cout" class="small" style="margin-top:6px;min-height:18px"></div>';
      const norm = t => String(t || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
      const go = () => {
        const box0 = host.querySelector('#cout'), v = norm(host.querySelector('#cin').value);
        if (!v) { box0.innerHTML = '<span class="mute">Type the plaintext you decoded.</span>'; return; }
        if (v === norm(s.pt)) pass(s.info || 'Correct — ' + s.pt);
        else box0.innerHTML = '<span style="color:var(--bad)">Not that one. Check for spaces and punctuation differences, or use the hint.</span>';
      };
      host.querySelector('#cgo').onclick = go;
      host.querySelector('#cin').onkeydown = e => { if (e.key === 'Enter') go(); };
      setTimeout(() => { const i = host.querySelector('#cin'); if (i) i.focus(); }, 30);
    }
  });

  const CIPHER_LESSONS = [
    {
      id: 'encode', title: '1. Encodings are not encryption', badge: 'Beginner',
      summary: 'Base64, hex and URL encoding only change the alphabet — there is no key and no secret. A hacker undoes them in one step, which is the first move in almost every CTF.',
      syntax: 'base64 -d   ·   xxd -r   ·   %41 = A   ·   01000001 = A',
      steps: [
        cipherStep({ prompt: 'Decode this Base64 to read the word.', tag: 'Base64', ct: btoa('FIREWALL'), pt: 'FIREWALL', info: 'Base64 packs bytes into 64 safe characters. No key — anyone can reverse it.', hint: 'A Base64 alphabet is A–Z a–z 0–9 + / and often ends in =.' }),
        cipherStep({ prompt: 'Decode this hex ASCII. Each pair is one character.', tag: 'Hex ASCII', ct: C.toHex('ROOT'), pt: 'ROOT', info: 'Hex pairs are bytes: 52 = R, 4f = O.', hint: '52 = R and 4f = o.' }),
        cipherStep({ prompt: 'Decode this URL encoding to read the word.', tag: 'URL %XX encoding', ct: '%48%41%43%4B%45%52', pt: 'HACKER', info: '%48 is hex for H. Browsers and servers do this on every URL.', hint: 'Each %XX is one hex byte; 48 = H, 41 = A, 43 = C, 4B = K.' })
      ]
    },
    {
      id: 'caesar', title: '2. Caesar: only 25 shifts exist', badge: 'Beginner',
      summary: 'A Caesar cipher slides every letter along the alphabet by a fixed number. That is 25 possibilities — small enough to try them all by eye, which is why the game shows you a shift table.',
      syntax: 'ciphertext letter − 4 = plaintext letter   ·   A→W wraps around',
      steps: [
        cipherStep({ prompt: 'Every letter was shifted forward 4. Undo it.', tag: 'Caesar +4', ct: C.shift('DEFEND THE GATE', 4), pt: 'DEFEND THE GATE', info: 'Shift 4 back: K→G, H→D, O→K, O→K, R→N.', hint: 'Go four letters backwards from each letter: K→G, H→D, O→K.' }),
        cipherStep({ prompt: 'Unknown shift this time — use the pattern of the words.', tag: 'Caesar, unknown shift', ct: C.shift('ACCESS GRANTED', 11), pt: 'ACCESS GRANTED', info: 'The shift was 11. Repeated letters (SS, SS) are the giveaway.', hint: 'Look at the doubled letters. If they land on S, the shift is 11.' }),
        cipherStep({ prompt: 'One more, shift 19 (or −7, the same thing).', tag: 'Caesar +19', ct: C.shift('TRUST NO ONE', 19), pt: 'TRUST NO ONE', info: '+19 forward is −7 backward: the same cipher.', hint: '19 forward = 7 backward. Shift the letters back 7.' })
      ]
    },
    {
      id: 'mirror', title: '3. ROT13, reverse and Atbash', badge: 'Beginner',
      summary: 'Three one-step transforms show up constantly: ROT13 (a Caesar of 13, its own inverse), reversing the string, and Atbash (A↔Z, B↔Y). None needs a key, so none is security.',
      syntax: 'rot13 "URYYB" = HELLO   ·   rev "OLLEH" = HELLO   ·   Atbash A↔Z B↔Y',
      steps: [
        cipherStep({ prompt: 'ROT13 this to read it.', tag: 'ROT13', ct: C.shift('HIDDEN MESSAGE', 13), pt: 'HIDDEN MESSAGE', info: 'ROT13 applied twice returns the original — the same function encrypts and decrypts.', hint: 'ROT13 is its own inverse: shift each letter 13 either way.' }),
        cipherStep({ prompt: 'This one is written backwards.', tag: 'Reversed text', ct: C.revStr('SECRET AGENT'), pt: 'SECRET AGENT', info: 'Reversing is a common obfuscation in malware strings and shell tricks.', hint: 'Read it from the last character to the first.' }),
        cipherStep({ prompt: 'Atbash: the alphabet is mirrored.', tag: 'Atbash', ct: C.atbash('VAULT KEY'), pt: 'VAULT KEY', info: 'Atbash maps A→Z, B→Y, C→X — the mirror at M/N.', hint: 'E→V, Z→A, F→U… mirror each letter around M/N.' })
      ]
    },
    {
      id: 'alphabets', title: '4. Morse and NATO alphabets', badge: 'Intermediate',
      summary: 'Radio traffic and call signs use their own alphabets. Morse is dots and dashes; NATO spells letters as words (Alpha, Bravo…). Read the first letter of each word and the message appears.',
      syntax: 'SOS = ... --- ...   ·   KEY = KILO ECHO YANKEE',
      steps: [
        cipherStep({ prompt: 'Decode this Morse call for help.', tag: 'Morse code', ct: C.MORSE.S + ' ' + C.MORSE.O + ' ' + C.MORSE.S, pt: 'SOS', info: 'SOS is ... --- ... — three dots, three dashes, three dots.', hint: 'Three dots = S, three dashes = O.' }),
        cipherStep({ prompt: 'Decode this NATO phonetic word.', tag: 'NATO phonetic', ct: 'KILO ECHO YANKEE', pt: 'KEY', info: 'KILO=K, ECHO=E, YANKEE=Y. Read the first letter of each word.', hint: 'Take the first letter of each word.' }),
        cipherStep({ prompt: 'A field radio spells a word out over NATO. What is it?', tag: 'NATO phonetic', ct: 'ALPHA LIMA ECHO ROMEO TANGO', pt: 'ALERT', info: 'ALPHA=A, LIMA=L, ECHO=E, ROMEO=R, TANGO=T.', hint: 'A-L-E-R-T, one word per letter.' })
      ]
    },
    {
      id: 'vig', title: '5. Vigenere with a keyword', badge: 'Intermediate',
      summary: 'A Vigenere cipher adds a repeating keyword instead of one number: A=0, B=1, … and the keyword repeats. The ciphertext hides the shift, but a short keyword still falls to frequency analysis.',
      syntax: 'plaintext + keyword (repeating) = ciphertext   ·   subtract to decode',
      steps: [
        cipherStep({ prompt: 'The keyword is LEMON. Decode the message.', tag: 'Vigenere (LEMON)', ct: C.vig('ATTACK AT DAWN', 'LEMON'), pt: 'ATTACK AT DAWN', info: 'Subtract L,E,M,O,N,L,E,M… from each letter. Spaces are untouched.', hint: 'Keyword letters give shifts L=11, E=4, M=12, O=14, N=13, repeating.' }),
        cipherStep({ prompt: 'Keyword KEY. Decode it.', tag: 'Vigenere (KEY)', ct: C.vig('MEET ME AT THE VAULT', 'KEY'), pt: 'MEET ME AT THE VAULT', info: 'K=10, E=4, Y=24, repeating over every letter.', hint: 'Shifts repeat K(10), E(4), Y(24).' }),
        cipherStep({ prompt: 'Keyword SHIELD. What does the message say?', tag: 'Vigenere (SHIELD)', ct: C.vig('SEND THE FILE', 'SHIELD'), pt: 'SEND THE FILE', info: 'S=18, H=7, I=8, E=4, L=11, D=3, repeating.', hint: 'Shifts: S 18, H 7, I 8, E 4, L 11, D 3 — then repeat.' })
      ]
    },
    {
      id: 'xor', title: '6. Single-byte XOR', badge: 'Advanced',
      summary: 'XOR with one byte is the classic malware obfuscation: each byte is flipped against the same number. XORing twice with that number gives the original back, so finding the key is enough.',
      syntax: '0x37 XOR 0x2a = 0x1d   ·   XOR the same key again to undo',
      steps: [
        cipherStep({ prompt: 'Every byte here was XORed with 0x2a (42). Decode it.', tag: 'XOR 0x2a', ct: C.xorHex('FLAG', 42), pt: 'FLAG', info: 'XOR is its own inverse — apply key 42 again and the letters come back.', hint: 'Convert each hex pair to a number and XOR it with 42.' }),
        cipherStep({ prompt: 'Same idea, key 0x0d (13).', tag: 'XOR 0x0d', ct: C.xorHex('SHADOW', 13), pt: 'SHADOW', info: 'A single-byte key is trivially brute-forced: only 255 possible keys.', hint: 'XOR each byte with 13.' }),
        cipherStep({ prompt: 'Key 0x07. Decode the word.', tag: 'XOR 0x07', ct: C.xorHex('ROOT', 7), pt: 'ROOT', info: 'Printable results are the giveaway that you found the key.', hint: 'XOR each byte with 7.' })
      ]
    },
    {
      id: 'numbers', title: '7. Binary and decimal ASCII', badge: 'Advanced',
      summary: 'Binary, decimal and hex are the same bytes written three ways. Packet captures, shellcode dumps and firmware strings all mix them; converting between them is pure mechanics.',
      syntax: '01001011 = 75 = 0x4b = K',
      steps: [
        cipherStep({ prompt: 'Decode these 8-bit binary bytes.', tag: 'Binary ASCII', ct: [...'KEY'].map(c => c.charCodeAt(0).toString(2).padStart(8, '0')).join(' '), pt: 'KEY', info: '01001011=75=K, 01000101=69=E, 01011001=89=Y.', hint: 'Each 8-bit group is one ASCII code: 75=K, 69=E, 89=Y.' }),
        cipherStep({ prompt: 'Decode these decimal ASCII codes.', tag: 'Decimal ASCII', ct: [...'VAULT'].map(c => c.charCodeAt(0)).join(' '), pt: 'VAULT', info: '86=V, 65=A, 85=U, 76=L, 84=T.', hint: '65=A, 66=B… so 86=V, 85=U, 84=T.' }),
        cipherStep({ prompt: 'Binary again — what does it spell?', tag: 'Binary ASCII', ct: [...'FILE'].map(c => c.charCodeAt(0).toString(2).padStart(8, '0')).join(' '), pt: 'FILE', info: '70=F, 73=I, 76=L, 69=E.', hint: '01000110=70=F, 01001001=73=I.' })
      ]
    },
    {
      id: 'grad', title: '8. Graduation: peel the layers', badge: 'Master',
      summary: 'Real puzzles stack encodings. Work from the outside in, one layer at a time, and keep the intermediate text so you can back out if a layer is wrong.',
      syntax: 'base64 -d → Caesar → reverse → hex, one stage at a time',
      steps: [
        cipherStep({ prompt: 'Two layers: Base64 first, then a Caesar shift of 9.', tag: 'Layered: Base64 + Caesar +9', ct: btoa(C.shift('BYPASS THE FIREWALL', 9)), pt: 'BYPASS THE FIREWALL', info: 'Base64 → BYPASS THE FIREWALL after shifting every letter back 9.', hint: 'Decode the Base64, then shift the letters back 9.' }),
        cipherStep({ prompt: 'Two layers again: the text is reversed AND Base64.', tag: 'Layered: reverse + Base64', ct: C.revStr(btoa('CIPHER GRADUATE')), pt: 'CIPHER GRADUATE', info: 'Reverse first, then Base64-decode the readable blob.', hint: 'Undo the reverse before the Base64 — the "=" padding is your landmark.' }),
        cipherStep({ prompt: 'Final drill: hex, then Base64. This is the academy graduation key.', tag: 'Layered: hex + Base64', ct: C.toHex(btoa('ACADEMY_GRADUATE')), pt: 'ACADEMY_GRADUATE', info: 'Hex-decode to a Base64 string, then decode that. This exact chain appears in the Terminal Academy too.', hint: 'xxd -r first, then base64 -d.' })
      ]
    }
  ];

  if (C.shift) {
    academy('cipher_academy', 'Cipher Academy', '🔑',
      'Eight guided hands-on crypto lessons: encodings, Caesar, ROT13, Morse, Vigenere, XOR, binary and layered chains — decode each one to pass.',
      'cipher', CIPHER_LESSONS,
      { name: 'Cipher Academy', game: 'Cipher Breaker', gameId: 'cipher' });
  }

  /* ==========================================================================================
     2. SQL INJECTION ACADEMY — a fake login you break, step by step
     ========================================================================================== */
  const S = L.sql;
  const SA_ROWS = [
    { id: 1, name: 'admin', pass: 'S3cr3t!x9', role: 'admin' },
    { id: 2, name: 'maria', pass: 'blue42', role: 'user' },
    { id: 3, name: 'dev', pass: 'hunter2', role: 'user' }
  ];
  const sqlStep = sp => ({
    prompt: sp.prompt, hint: sp.hint, example: sp.example,
    ui: (host, pass) => {
      host.innerHTML = '<div style="' + box + '">' +
        '<div class="small mute" style="margin-bottom:6px">Fake company login — table <b>users</b> (id, name, pass, role): admin, maria, dev. maria\'s real password is blue42.</div>' +
        '<div class="row" style="gap:8px;margin-bottom:6px"><input id="squ" placeholder="' + (sp.numeric ? 'employee id (numeric)' : 'username') + '" autocomplete="off" spellcheck="false" style="flex:1;' + mono + '">' +
        (sp.numeric ? '' : '<input id="sqp" placeholder="password" autocomplete="off" spellcheck="false" style="flex:1;' + mono + '">') + '</div>' +
        '<div class="row" style="gap:8px;flex-wrap:wrap">' +
        (sp.secure ? '<label class="chk"><input type="checkbox" id="sqs"> Secure mode (parameterized)</label>' : '') +
        '<button class="pri" id="sqgo">Log in</button></div>' +
        '<div class="small mute" style="margin:8px 0 4px">The query the server builds:</div>' +
        '<pre id="sqq" style="' + mono + ';font-size:12.5px;white-space:pre-wrap;word-break:break-all;margin:0;background:#05070b;padding:8px;border-radius:8px"></pre>' +
        '<div id="sqo" style="margin-top:8px"></div></div>';
      const q = host.querySelector('#sqq'), o = host.querySelector('#sqo');
      const go = () => {
        const u = host.querySelector('#squ').value;
        const pEl = host.querySelector('#sqp'), p = pEl ? pEl.value : '';
        const secure = !!(sp.secure && host.querySelector('#sqs').checked);
        let out = [], err = '';
        if (secure) {
          q.textContent = 'SELECT * FROM users WHERE name = ? AND pass = ?\n  ?1 = ' + JSON.stringify(u) + '   ?2 = ' + JSON.stringify(p);
          out = SA_ROWS.filter(r => r.name === u && r.pass === p);
        } else {
          const cond = sp.build(S.applySan(sp.san, u), S.applySan(sp.san, p));
          q.textContent = 'SELECT * FROM users WHERE ' + cond;
          try { out = S.sqlRun(cond, SA_ROWS); } catch (e) { err = e.message; }
        }
        if (err) {
          o.innerHTML = '<div style="color:var(--bad)">Database error: ' + esc(err) + '</div><div class="small mute">An error proves your input changed the SQL syntax, not just the data.</div>';
        } else if (!out.length) {
          o.innerHTML = '<div style="color:var(--bad)">Login failed (0 rows).</div><div class="small mute">Secure mode binds input as plain data; otherwise re-read the query above.</div>';
        } else {
          o.innerHTML = '<div style="color:var(--ok)">Matched ' + out.length + ' row' + (out.length > 1 ? 's' : '') + ': <b>' + esc(out.map(r => r.name + (r.role ? ':' + r.role : '')).join(', ')) + '</b></div>';
        }
        if (sp.ok(u, p, out, secure, err)) {
          o.innerHTML += '<div style="color:var(--ok);margin-top:6px"><b>' + esc(sp.done || 'That worked!') + '</b></div>';
          pass(sp.done || 'That worked!');
        }
      };
      host.querySelector('#sqgo').onclick = go;
      host.querySelector('#squ').onkeydown = e => { if (e.key === 'Enter') go(); };
      const pe = host.querySelector('#sqp'); if (pe) pe.onkeydown = e => { if (e.key === 'Enter') go(); };
      setTimeout(() => { const i = host.querySelector('#squ'); if (i) i.focus(); }, 30);
    }
  });

  const SQL_LESSONS = [
    {
      id: 'normal', title: '1. How the login really works', badge: 'Beginner',
      summary: 'The app builds a query by gluing your text inside quotes. Know the shape of that string and every injection below makes sense.',
      syntax: "SELECT * FROM users WHERE name='<user>' AND pass='<password>'",
      steps: [
        sqlStep({
          prompt: 'Log in normally as maria with the password blue42.', hint: 'Type maria in the first box and blue42 in the second.',
          example: 'maria / blue42', build: (u, p) => "name='" + u + "' AND pass='" + p + "'",
          ok: (u, p, out) => out.length === 1 && out[0].name === 'maria',
          done: 'Normal login. Look at the query above: your text sits between the quotes.'
        }),
        sqlStep({
          prompt: 'Now type a single apostrophe ( \' ) in the password box and press Log in.', hint: 'One quote ends the string early, so the rest of the query is broken.',
          example: "maria / '", build: (u, p) => "name='" + u + "' AND pass='" + p + "'",
          ok: (u, p, out, secure, err) => !!err,
          done: 'A database error — your apostrophe closed the string. That is the injection point.'
        })
      ]
    },
    {
      id: 'comment', title: '2. Break out, comment out the rest', badge: 'Beginner',
      summary: 'Close the quote, then make the rest of the query disappear. In SQL, -- starts a comment, so the password check never runs.',
      syntax: "admin' --      ·      maria' --",
      steps: [
        sqlStep({
          prompt: "Log in as admin without the password: write  admin' --  as the username and leave the password empty.",
          hint: "Type: admin' --   (space, two dashes) — they comment out everything after.",
          example: "admin' --", build: (u, p) => "name='" + u + "' AND pass='" + p + "'",
          ok: (u, p, out) => out.some(r => r.name === 'admin') && p !== 'S3cr3t!x9',
          done: "The password check is gone. The query became name='admin'."
        }),
        sqlStep({
          prompt: "Same trick on the user maria: maria' --",
          hint: "Type: maria' --", example: "maria' --", build: (u, p) => "name='" + u + "' AND pass='" + p + "'",
          ok: (u, p, out) => out.some(r => r.name === 'maria') && p !== 'blue42',
          done: 'Any account whose name you know is open. That is an authentication bypass.'
        })
      ]
    },
    {
      id: 'true', title: '3. Make the condition always true', badge: 'Intermediate',
      summary: "You do not even need a real username. Append OR with a tautology and every row matches — the classic ' OR '1'='1.",
      syntax: "' OR '1'='1      ·      x' OR 1=1 --",
      steps: [
        sqlStep({
          prompt: "Log in with username  x  and password  ' OR '1'='1",
          hint: "Type: ' OR '1'='1 in the password box — quotes matter.",
          example: "' OR '1'='1", build: (u, p) => "name='" + u + "' AND pass='" + p + "'",
          ok: (u, p, out) => out.length === 3,
          done: "All three rows came back: name='x' AND pass='' OR '1'='1' is true for everyone."
        }),
        sqlStep({
          prompt: "Now do it from the username box:  ' OR 1=1 --  and any password.",
          hint: "Type: ' OR 1=1 --", example: "' OR 1=1 --", build: (u, p) => "name='" + u + "' AND pass='" + p + "'",
          ok: (u, p, out) => out.length === 3,
          done: "The comment removed the password check again; name='' OR 1=1 matches every row."
        })
      ]
    },
    {
      id: 'waf', title: '4. When the WAF strips comments', badge: 'Intermediate',
      summary: 'A filter that deletes -- and # is not a fix. Balance the quotes yourself and inject an OR that keeps the query valid without any comment.',
      syntax: "admin' OR 'a'='a      ·      ' OR 'a'='a",
      steps: [
        sqlStep({
          prompt: "Comments are stripped now. Log in as admin with username  admin' OR 'a'='a",
          hint: "Type: admin' OR 'a'='a — the trailing quote closes the password string, so the query stays valid.",
          example: "admin' OR 'a'='a", san: 'comments', build: (u, p) => "name='" + u + "' AND pass='" + p + "'",
          ok: (u, p, out) => out.some(r => r.name === 'admin') && p !== 'S3cr3t!x9',
          done: 'No comments needed — the quote balance does the job.'
        }),
        sqlStep({
          prompt: "Now inject from the password box instead: username maria, password  ' OR 'a'='a",
          hint: "Type: ' OR 'a'='a in the password field.", example: "' OR 'a'='a", san: 'comments',
          build: (u, p) => "name='" + u + "' AND pass='" + p + "'",
          ok: (u, p, out) => out.length > 1 && p !== 'blue42',
          done: "OR 'a'='a' is true for every row, so the whole table is returned."
        })
      ]
    },
    {
      id: 'numeric', title: '5. Numbers need no quotes', badge: 'Intermediate',
      summary: 'Some endpoints paste a number in directly: WHERE id = <input>. Nothing to escape — just write your own SQL after the number.',
      syntax: '103 --      ·      0 OR 1=1',
      steps: [
        sqlStep({
          prompt: 'This badge lookup takes a numeric id with no quotes. Fetch employee 2 without a password: type  2 --',
          hint: 'Type: 2 --  (the comment removes AND role=\'user\').', example: '2 --', numeric: true,
          build: u => "id=" + (u || '0') + " AND role='user'",
          ok: (u, p, out) => out.length === 1 && out[0].id === 2,
          done: 'A numeric parameter is just as injectable — quotes were never the problem.'
        }),
        sqlStep({
          prompt: 'Now dump every row with  0 OR 1=1',
          hint: 'Type: 0 OR 1=1 — id=0 matches nothing, 1=1 matches everything.', example: '0 OR 1=1', numeric: true,
          build: u => "id=" + (u || '0') + " AND role='user'",
          ok: (u, p, out) => out.length >= 2,
          done: 'Two user rows dumped. An id field is an injection point too.'
        })
      ]
    },
    {
      id: 'role', title: '6. Beat a second condition', badge: 'Advanced',
      summary: "Apps often add their own check, like AND role='guest'. A comment removes that too — or you can satisfy it with the row you want.",
      syntax: "admin' --      ·      the comment eats AND pass='…' AND role='guest'",
      steps: [
        sqlStep({
          prompt: "This portal appends AND role='guest'. Log in as admin anyway.",
          hint: "Type: admin' --   — the comment removes the password AND the role check.",
          example: "admin' --", build: (u, p) => "name='" + u + "' AND pass='" + p + "' AND role='guest'",
          ok: (u, p, out) => out.some(r => r.name === 'admin') && p !== 'S3cr3t!x9',
          done: 'Both checks commented away. Never build authorization out of string concatenation.'
        })
      ]
    },
    {
      id: 'defence', title: '7. Why parameterized queries fix it', badge: 'Advanced',
      summary: 'A parameterized query sends the SQL and the data separately. Your payload can still be typed in — it is just stored as a weird password string.',
      syntax: "SELECT * FROM users WHERE name = ? AND pass = ?   (values bound separately)",
      steps: [
        sqlStep({
          prompt: "Tick Secure mode and try the winning payload again: username  ' OR '1'='1",
          hint: 'Tick the Secure mode box, type the same payload, press Log in — watch it fail safely.',
          example: "Tick Secure mode, then type: ' OR '1'='1", secure: true,
          build: (u, p) => "name='" + u + "' AND pass='" + p + "'",
          ok: (u, p, out, secure) => secure && out.length === 0 && /or/i.test(u + p),
          done: 'Zero rows. The quotes were treated as data, not SQL — this is the real fix. Filters and WAFs are not.'
        })
      ]
    },
    {
      id: 'grad', title: '8. Graduation: parens, role and a WAF', badge: 'Master',
      summary: 'The boss level: the query is wrapped in parentheses, has a role check, and comments are stripped. Close the paren, inject, and rebalance the quotes.',
      syntax: "username x   ·   password  ') OR name='admin' OR ('1'='0",
      steps: [
        sqlStep({
          prompt: "Comments are stripped and the query is (name='…' AND pass='…') AND role='guest'. Log in as admin with username x.",
          hint: "Password:  ') OR name='admin' OR ('1'='0   — close both quote and paren, then balance them at the end.",
          example: "username: x   password:  ') OR name='admin' OR ('1'='0", san: 'comments',
          build: (u, p) => "(" + "name='" + u + "' AND pass='" + p + "') AND role='guest'",
          ok: (u, p, out) => out.some(r => r.name === 'admin'),
          done: 'Academy cleared. You closed a paren, injected a role bypass and rebalanced the quotes — the same skills the game throws at you endlessly.'
        })
      ]
    }
  ];

  if (S && S.sqlRun) {
    academy('sql_academy', 'SQL Injection Academy', '💉',
      'Eight hands-on SQL injection lessons on a fake login: quote errors, comment bypasses, always-true payloads, WAF dodges and why parameterized queries stop it.',
      'sql', SQL_LESSONS,
      { name: 'SQL Academy', game: 'SQL Injection Dojo', gameId: 'sqldojo' });
  }

  /* ==========================================================================================
     3. PHISHING ACADEMY — judge real-looking emails, learn the tells
     ========================================================================================== */
  const phishStep = (m, prompt) => ({
    prompt: prompt || 'Is this email phishing or legitimate?',
    hint: m.hint || 'Check the sender domain, the Return-Path, the hover URL, and whether it pressures you to act.',
    example: () => (m.phish ? 'This one is phishing. ' : 'This one is legitimate. ') + (m.why && m.why[0] ? m.why[0] : ''),
    ui: (host, pass) => {
      const h = m.hdr || { rp: 'unknown', spf: 'NONE', dkim: 'NONE' };
      host.innerHTML = '<div style="' + box + '">' +
        '<div style="margin:4px 0"><b>From:</b> ' + esc(m.from) + '</div>' +
        '<div><b>Subject:</b> ' + esc(m.subj) + '</div>' +
        '<div style="margin:10px 0;line-height:1.55">' + esc(m.body) + '</div>' +
        (m.link ? '<div class="small">Link or file: <span style="color:var(--acc);text-decoration:underline" title="' + esc(m.link[1]) + '">' + esc(m.link[0]) + '</span> <span class="mute">(hover to see the real destination)</span></div>' : '<div class="small mute">No links or attachments.</div>') +
        '</div>' +
        '<div class="row" style="gap:8px;margin-top:10px"><button class="pri" id="hph">🎣 Phishing</button><button class="ib" id="hlg">✅ Legit</button><span class="sp"></span><button class="ib" id="hhdr">🔍 Inspect headers</button></div>' +
        '<pre id="hh" class="small" style="display:none;margin-top:8px;' + box + ';' + mono + ';white-space:pre-wrap;font-size:12px"></pre>' +
        '<div id="hout" style="margin-top:10px"></div>';
      host.querySelector('#hh').textContent = 'From:        ' + m.from + '\nReturn-Path: <' + h.rp + '>\nSPF:         ' + h.spf + '\nDKIM:        ' + h.dkim + (m.link ? '\nLink Target: ' + m.link[1] : '');
      host.querySelector('#hhdr').onclick = () => { const p = host.querySelector('#hh'); p.style.display = p.style.display === 'none' ? 'block' : 'none'; };
      let answered = false;
      const guess = g => {
        if (answered) return;
        answered = true;
        const right = (g === 1) === !!m.phish;
        host.querySelector('#hout').innerHTML = '<div style="color:var(--' + (right ? 'ok' : 'bad') + ')"><b>' + (right ? 'Correct!' : 'Not quite.') + '</b> That was ' + (m.phish ? 'phishing' : 'legitimate') + '.</div>' +
          '<ul class="small" style="margin:6px 0 8px 18px">' + (m.why || []).map(w => '<li>' + esc(w) + '</li>').join('') + '</ul>';
        if (right) pass((m.why && m.why[0]) || 'Correct.');
      };
      host.querySelector('#hph').onclick = () => guess(1);
      host.querySelector('#hlg').onclick = () => guess(0);
    }
  });

  const MAIL_NORTHFIELD = {
    from: 'Bank of Northfield <alerts@bankofnorthfield.com>', subj: 'New statement available',
    body: 'Your monthly statement is ready. Sign in the usual way through the app or the website you normally use.',
    link: null, phish: 0, hdr: { rp: 'alerts@bankofnorthfield.com', spf: 'PASS', dkim: 'PASS' },
    why: ['No link and no request — it points you at your normal route', 'SPF and DKIM both PASS for the real bank domain']
  };

  const PHISH_LESSONS = [
    {
      id: 'sender', title: '1. Read the sender domain', badge: 'Beginner',
      summary: 'The display name is free text; only the domain after @ matters. Lookalikes swap a letter for a digit (micros0ft, paypaI) or add a hyphenated word before a cheap TLD.',
      syntax: 'support@micros0ft-security.com   ≠   microsoft.com',
      steps: [
        phishStep({
          from: 'Microsoft Support <support@micros0ft-security.com>', subj: 'Your account will be closed in 24 hours',
          body: 'We detected unusual activity. Verify your password immediately or your account will be permanently deleted.',
          link: ['Verify now', 'http://micros0ft-security.com/login'], phish: 1,
          hdr: { rp: 'bounce@micros0ft-security.com', spf: 'FAIL', dkim: 'NONE' },
          why: ['The domain uses a zero instead of the letter o', 'Threatens deletion within 24 hours to rush you', 'The link is plain http:// and asks for your password']
        }),
        phishStep({
          from: 'PayPaI Service <service@paypal-billing.help>', subj: 'Payment of $499.99 sent',
          body: 'You paid $499.99 to Crypto Exchange. If this was not you, click below to cancel and sign in.',
          link: ['Cancel payment', 'http://paypal-billing.help/cancel'], phish: 1,
          hdr: { rp: 'alerts@paypal-billing.help', spf: 'SOFTFAIL', dkim: 'NONE' },
          why: ['The display name uses a capital I instead of a lowercase l', 'A .help domain is not paypal.com', 'It invents a charge to scare you into clicking']
        }),
        phishStep({
          from: 'GitHub <noreply@github.com>', subj: 'A new sign-in to your account',
          body: 'We noticed a sign-in from Windows in your region. If this was you, you can ignore this. If not, open github.com yourself and review your sessions.',
          link: null, phish: 0, hdr: { rp: 'noreply@github.com', spf: 'PASS', dkim: 'PASS' },
          why: ['Exact official domain and passing authentication', 'Tells you to visit the site yourself instead of clicking a link']
        })
      ]
    },
    {
      id: 'urgency', title: '2. Urgency and fear', badge: 'Beginner',
      summary: 'Phishing needs you to act before you think: a deadline, a charge you did not make, a locked account. Real providers let you check at your own pace through their normal route.',
      syntax: 'act in 24h · your account is locked · you were charged',
      steps: [
        phishStep({
          from: 'IT Helpdesk <helpdesk@company-it-support.co>', subj: 'Password expires today',
          body: 'Your password expires today. Click to keep your current password.',
          link: ['Keep my password', 'http://company-it-support.co/reset'], phish: 1,
          hdr: { rp: 'admin@company-it-support.co', spf: 'NONE', dkim: 'NONE' },
          why: ['Look-alike domain — your company domain probably ends in .com', 'Same-day deadline with a convenient "keep my password" button', 'Real IT teams reset passwords from inside the company, not by email link']
        }),
        phishStep(MAIL_NORTHFIELD),
        phishStep({
          from: 'Apple Support <no-reply@appleid-verify.co>', subj: 'Your iCloud was disabled (24 hours to restore)',
          body: 'Your account has been disabled for security reasons. Confirm your Apple ID within 24 hours or your photos and backups will be removed permanently.',
          link: ['Restore my account', 'http://appleid-verify.co/restore'], phish: 1,
          hdr: { rp: 'mailer@appleid-verify.co', spf: 'FAIL', dkim: 'NONE' },
          why: ['appleid-verify.co is not apple.com', 'Loss of photos and backups is a fear hook', 'SPF FAIL and a plain http:// login page']
        })
      ]
    },
    {
      id: 'links', title: '3. Links and the hover trick', badge: 'Intermediate',
      summary: 'The visible text of a link is cosmetic; the destination is what your browser follows. Hover (or long-press) before you click, and read the registered domain from the right, not the left.',
      syntax: 'text says stripe.com → real target str1pe-billing.co',
      steps: [
        phishStep({
          from: 'Stripe Billing <billing@stripe.com>', subj: 'Invoice #88213 needs your review',
          body: 'Your latest invoice is ready. Open the billing page to review the charge.',
          link: ['https://stripe.com/billing', 'http://str1pe-billing.co/pay/88213'], phish: 1,
          hdr: { rp: 'bounces@str1pe-billing.co', spf: 'FAIL', dkim: 'FAIL' },
          why: ['The link text says stripe.com but the target is str1pe-billing.co', 'Return-Path is a different domain and SPF/DKIM fail', 'Payment pages are the highest-value target there is']
        }),
        phishStep({
          from: 'GitHub <notifications@github.com>', subj: 'Security settings changed',
          body: 'A personal access token was created on your account. If this was not you, review your security settings in the link below.',
          link: ['https://github.com/settings/security', 'https://github.com/settings/security'], phish: 0,
          hdr: { rp: 'notifications@github.com', spf: 'PASS', dkim: 'PASS' },
          why: ['Displayed link and real destination are identical and official', 'Normal security notification with no pressure or credential request']
        }),
        phishStep({
          from: 'Dropbox <share@dropb0x-share.com>', subj: 'Maria shared "Q3 bonus list.xlsx" with you',
          body: 'Maria Lopez shared a file with you. Sign in with your email to view the spreadsheet.',
          link: ['Open in Dropbox', 'https://dropb0x-share.com/view/q3'], phish: 1,
          hdr: { rp: 'share@dropb0x-share.com', spf: 'PASS (attacker domain)', dkim: 'NONE' },
          why: ['The zero in dropb0x-share.com replaces an o', 'A colleague name plus a juicy filename is a lure', 'It needs your email login to "view" a shared file']
        })
      ]
    },
    {
      id: 'headers', title: '4. Headers: SPF, DKIM and Return-Path', badge: 'Advanced',
      summary: 'The From header is easy to fake. SPF says whether the sending server was allowed to send for that domain, DKIM says the message was signed, and Return-Path shows where bounces really go.',
      syntax: 'From: brand.com · Return-Path: attacker.xyz · SPF FAIL · DKIM NONE',
      steps: [
        phishStep({
          from: 'Microsoft 365 <security@microsoft.com>', subj: 'Unusual sign-in blocked',
          body: 'We blocked a sign-in attempt. Confirm your identity to keep your mailbox active.',
          link: ['Confirm identity', 'https://micros0ft-login.xyz/verify'], phish: 1,
          hdr: { rp: 'bounce@micros0ft-login.xyz', spf: 'FAIL', dkim: 'NONE' },
          why: ['From says microsoft.com but Return-Path points at micros0ft-login.xyz', 'SPF FAIL means that server may not send for the domain', 'No DKIM signature at all']
        }),
        phishStep({
          from: 'City Public Library <notices@citylibrary.org>', subj: 'Hold ready for pickup (Item #4412)',
          body: 'Your requested book is ready on the hold shelf for the next 7 days. Bring your library card or manage holds on citylibrary.org.',
          link: null, phish: 0, hdr: { rp: 'notices@citylibrary.org', spf: 'PASS', dkim: 'PASS' },
          why: ['From, Return-Path and SPF/DKIM all agree', 'Specific, calm notice with no payment or login link']
        }),
        phishStep({
          from: 'IT Security Desk <it-help@yourcompany-sso.co>', subj: 'Scheduled SSO certificate rotation',
          body: 'Hi team, we are rotating single sign-on certificates at 5 PM. Please sign in once on the new portal below to keep VPN and email connected.',
          link: ['https://sso.yourcompany.com/migrate', 'https://yourcompany-sso.co/login'], phish: 1,
          hdr: { rp: 'admin@yourcompany-sso.co', spf: 'SOFTFAIL', dkim: 'NONE' },
          why: ['yourcompany-sso.co is not your real company domain', 'The hover URL does not match the displayed sso.yourcompany.com', 'SOFTFAIL and no DKIM — the sender is not authenticated']
        })
      ]
    },
    {
      id: 'files', title: '5. Attachments that are programs', badge: 'Advanced',
      summary: 'Invoices do not end in .html, .iso, .docm or .pdf.exe. Those launch a script, mount an image or run a macro — the standard way to drop malware or harvest a login.',
      syntax: '.html  .iso  .docm  .exe  .pdf.exe  =  dangerous attachments',
      steps: [
        phishStep({
          from: 'UPS Billing <billing@ups-customs-fee.top>', subj: 'Customs fee unpaid — parcel on hold',
          body: 'Your parcel is held at customs. Open the attached invoice and sign in to pay the fee and release it.',
          link: ['Invoice_88214.iso', 'file attachment: Invoice_88214.iso'], phish: 1,
          hdr: { rp: 'bounce@ups-customs-fee.top', spf: 'FAIL', dkim: 'NONE' },
          why: ['.iso is a disk image — opening it can run files and skip security prompts', 'A .top domain is not ups.com', 'Customs fees are a classic parcel-delivery lure']
        }),
        phishStep({
          from: 'HR Department <hr@yourcompany-benefits.net>', subj: 'Urgent: updated salary document',
          body: 'Open the attached file and sign in with your work email to see your new salary.',
          link: ['SalaryUpdate.docm', 'file attachment: SalaryUpdate.docm'], phish: 1,
          hdr: { rp: 'hr@yourcompany-benefits.net', spf: 'FAIL', dkim: 'NONE' },
          why: ['.docm carries macros — code that runs when you enable content', 'The domain is not your real company domain', 'Curiosity about pay is the hook']
        }),
        phishStep({
          from: 'Northwind Supply <billing@northwindsupply.com>', subj: 'Invoice 5581 attached (PDF)',
          body: 'Thanks for your order. Invoice 5581 is attached as a PDF and is also in your account at northwindsupply.com.',
          link: ['Invoice-5581.pdf', 'https://northwindsupply.com/account/invoices'], phish: 0,
          hdr: { rp: 'billing@northwindsupply.com', spf: 'PASS', dkim: 'PASS' },
          why: ['A real PDF, not a program, from a supplier you already use', 'Sender domain matches the link destination and SPF/DKIM pass']
        })
      ]
    },
    {
      id: 'impersonation', title: '6. Impersonation and gift cards', badge: 'Advanced',
      summary: 'Business email compromise rarely uses malware. A "CEO" asks for a favour, secrecy and gift cards — the codes are untraceable. Any request for secrecy is a red flag.',
      syntax: 'urgent favour · keep this quiet · buy gift cards · do not call',
      steps: [
        phishStep({
          from: 'Sarah Chen (CEO, invented) <sarah.chen.exec42@mail.example>', subj: 'Quick favour — confidential',
          body: "I'm stuck in a board meeting and cannot take calls. Please purchase 4 Apple/Amazon gift cards ($100 each) for a client bonus and email me photos of the codes ASAP. Keep this quiet.",
          link: null, phish: 1,
          hdr: { rp: 'exec.urgent@mail.example', spf: 'PASS (personal webmail)', dkim: 'PASS (mail.example)' },
          why: ['The CEO would not use a personal gmail.com address for company business', 'Gift card codes are untraceable cash', '"Do not call" and "keep this quiet" exist to stop you verifying']
        }),
        phishStep({
          from: 'Maria Lopez <maria@yourcompany.com>', subj: 'Notes from this morning',
          body: 'Hi, here are the notes from our meeting. Let me know if I missed anything.',
          link: null, phish: 0, hdr: { rp: 'maria@yourcompany.com', spf: 'PASS', dkim: 'PASS' },
          why: ['Internal domain matches the Return-Path and passes SPF/DKIM', 'Ordinary tone, nothing asked of you, no links or attachments']
        }),
        phishStep({
          from: 'Payroll <payroll@yourcompany-payroll.co>', subj: 'Update your bank details for this month',
          body: 'We are updating payroll records. Reply with your account number and sort code before Friday to avoid a missed payment.',
          link: null, phish: 1,
          hdr: { rp: 'admin@yourcompany-payroll.co', spf: 'NONE', dkim: 'NONE' },
          why: ['yourcompany-payroll.co is not your company domain', 'Asks for bank details over email — never legitimate', 'A missed-payment threat adds urgency']
        })
      ]
    },
    {
      id: 'grad', title: '7. Graduation: spear phishing', badge: 'Master',
      summary: 'The hard ones are calm and technically careful: a subdomain of the real brand, a plausible MFA migration, perfect spelling. Read the registered domain (the last two labels) and never move faster than you can verify.',
      syntax: 'accounts.google.com.verify-id.top → the real domain is verify-id.top',
      steps: [
        phishStep({
          from: 'Google Accounts <no-reply@accounts.google.com.verify-id.top>', subj: 'Confirm your recovery email',
          body: 'A recovery email was added to your account. If this was not you, cancel the change now to keep your account secure.',
          link: ['Cancel the change', 'https://accounts.google.com.verify-id.top/cancel'], phish: 1,
          hdr: { rp: 'noreply@verify-id.top', spf: 'PASS (attacker domain)', dkim: 'NONE' },
          why: ['accounts.google.com is only a subdomain here — the registered domain is verify-id.top', 'Return-Path reveals the attacker domain', '"Cancel the change" is a panic button that leads to a login form']
        }),
        phishStep({
          from: 'Microsoft Account Team <no-reply@microsoft.com.login-portal-42.xyz>', subj: 'Your MFA token needs re-syncing (Ticket #88213)',
          body: 'We upgraded our sign-in servers this morning. Please re-verify your 2FA code once so you are not logged out during the migration.',
          link: ['Re-sync MFA Token', 'https://microsoft.com.login-portal-42.xyz/mfa'], phish: 1,
          hdr: { rp: 'noreply@login-portal-42.xyz', spf: 'PASS (attacker domain)', dkim: 'NONE' },
          why: ['The real domain is login-portal-42.xyz, not microsoft.com', 'A live MFA code is the prize — this is a real-time phishing kit', 'Calm, professional wording with no spelling mistakes']
        }),
        phishStep({
          from: 'Amazon <account-update@amazon.com>', subj: 'Your password was changed',
          body: 'Your password was updated just now. If you made this change you can ignore this message. Otherwise visit amazon.com/security directly in your browser.',
          link: ['https://amazon.com/security', 'https://amazon.com/security'], phish: 0,
          hdr: { rp: 'account-update@amazon.com', spf: 'PASS', dkim: 'PASS' },
          why: ['Official domain in From, Return-Path and the link target', 'Tells you to type the address yourself rather than trust the link']
        })
      ]
    }
  ];

  academy('phish_academy', 'Phishing Academy', '🎣',
    'Seven lessons of real-looking emails to judge: lookalike domains, urgency, hover links, SPF/DKIM headers, dangerous attachments, CEO fraud and spear phishing.',
    'phish', PHISH_LESSONS,
    { name: 'Phishing Academy', game: 'Phish Spotter', gameId: 'phish' });

  /* ==========================================================================================
     4. NETWORKING ACADEMY — ports, addressing, subnets, firewalls and chmod
     ========================================================================================== */
  const Q = (q, o, a, e) => ({ q, o, a, e });
  const netStep = spec => ({
    prompt: spec.prompt, hint: spec.hint,
    example: () => { const q = stepQ(spec); return q ? q.a : 'Read the tip above.'; },
    ui: (host, pass) => {
      const q = stepQ(spec);
      if (!q) return;
      host.innerHTML = '<div style="' + box + '"><div style="font-size:15px;white-space:pre-wrap;line-height:1.55;' + (q.q.indexOf('\n') >= 0 ? mono + ';font-size:13px' : '') + '">' + esc(q.q) + '</div></div>' +
        '<div class="row" style="gap:8px;margin-top:10px;flex-wrap:wrap">' + q.o.map((o, i) => '<button class="ib" data-o="' + esc(o) + '" style="text-align:left;padding:9px 12px;flex:1;min-width:120px;' + mono + '">' + (i + 1) + '. ' + esc(o) + '</button>').join('') + '</div>' +
        '<div id="nout" class="small" style="margin-top:8px;min-height:18px"></div>';
      let answered = false;
      host.onclick = e => {
        const b = e.target.closest('[data-o]'); if (!b || answered) return;
        const right = b.dataset.o === q.a;
        answered = true;
        b.style.borderColor = right ? 'var(--ok)' : 'var(--bad)';
        if (!right) host.querySelectorAll('[data-o]').forEach(y => { if (y.dataset.o === q.a) y.style.borderColor = 'var(--ok)'; });
        host.querySelector('#nout').innerHTML = '<span style="color:var(--' + (right ? 'ok' : 'bad') + ')"><b>' + (right ? 'Correct.' : 'Not quite — the answer is ' + esc(q.a) + '.') + '</b> ' + esc(q.e) + '</span>';
        if (right) pass(q.e);
      };
    }
  });
  const stepQ = spec => {
    if (spec.fixed) return spec.fixed;
    if (!spec.gen) return null;
    spec.cache = spec.cache || L.net.makeQuestion(spec.gen);
    return spec.cache;
  };
  const genStep = (cat, prompt, hint) => netStep({ gen: cat, prompt: prompt || 'Answer the live question.', hint });

  const NET_LESSONS = [
    {
      id: 'ports1', title: '1. Ports you meet every day', badge: 'Beginner',
      summary: 'A port is a numbered door on a machine. Scanners live by these ten: learn them and every nmap output starts to read like a sentence.',
      syntax: '21 FTP · 22 SSH · 23 Telnet · 25 SMTP · 53 DNS · 80 HTTP · 110 POP3 · 143 IMAP · 443 HTTPS · 3389 RDP',
      steps: [
        netStep({ fixed: Q('Which port does SSH listen on?', ['22', '23', '80', '443'], '22', 'SSH is 22 — encrypted remote shell. Telnet, its insecure ancestor, is 23.'), prompt: 'Pick the port.' }),
        netStep({ fixed: Q('Which service normally runs on port 443?', ['HTTPS', 'HTTP', 'SMTP', 'FTP'], 'HTTPS', '443 is HTTPS: HTTP wrapped in TLS.'), prompt: 'Pick the service.' }),
        netStep({ fixed: Q('Port 3389 is opened by which Windows service?', ['RDP', 'SMB', 'WinRM', 'NetBIOS'], 'RDP', '3389 is Remote Desktop — a favourite target when it faces the internet.'), prompt: 'Pick the service.' }),
        netStep({ fixed: Q('Port 53 answers DNS queries. Over which protocols can it run?', ['UDP and TCP', 'TCP only', 'UDP only', 'ICMP'], 'UDP and TCP', 'DNS uses UDP for normal queries and TCP for large answers and zone transfers.'), prompt: 'Pick the answer.' }),
        netStep({ fixed: Q('Which port would you probe to see if a site still serves unencrypted web traffic?', ['80', '443', '8080', '8443'], '80', '80 is plain HTTP — any login over it is readable on the wire.'), prompt: 'Pick the port.' })
      ]
    },
    {
      id: 'ports2', title: '2. Databases and control planes', badge: 'Intermediate',
      summary: 'The highest-impact findings are usually a database or container API reachable from the internet. Know the ports so you know what you are looking at.',
      syntax: '3306 MySQL · 5432 Postgres · 1433 MSSQL · 6379 Redis · 27017 Mongo · 9200 Elasticsearch · 2375 Docker · 6443 K8s',
      steps: [
        netStep({ fixed: Q('Which port does MySQL / MariaDB use?', ['3306', '5432', '1433', '1521'], '3306', '3306 is MySQL. 5432 is PostgreSQL, 1433 MSSQL, 1521 Oracle.'), prompt: 'Pick the port.' }),
        netStep({ fixed: Q('Port 6379 with no password means instant compromise of what?', ['Redis (in-memory key-value store)', 'PostgreSQL', 'MongoDB', 'Kafka'], 'Redis (in-memory key-value store)', 'Open Redis lets an attacker write files and often run commands.'), prompt: 'Pick the answer.' }),
        netStep({ fixed: Q('Which port exposes an unauthenticated Docker daemon if misconfigured?', ['2375', '6443', '9200', '9092'], '2375', 'Docker API on 2375 is plain HTTP and means root on the host.'), prompt: 'Pick the port.' }),
        netStep({ fixed: Q('Elasticsearch’s REST API listens on which port by default?', ['9200', '9300', '8080', '27017'], '9200', '9200 is the REST API (9300 is inter-node traffic). Open indexes leak whole datasets.'), prompt: 'Pick the port.' })
      ]
    },
    {
      id: 'ipclass', title: '3. Private, public, loopback', badge: 'Beginner',
      summary: 'Reading an IP tells you where it can be. Private space stays inside the network, loopback never leaves the machine, and 169.254 means DHCP failed.',
      syntax: '10/8 · 172.16/12 · 192.168/16 private · 127/8 loopback · 169.254/16 link-local',
      steps: [
        netStep({ fixed: Q('Which of these is a private (RFC 1918) address?', ['10.20.30.40', '8.8.8.8', '169.254.10.4', '127.0.0.1'], '10.20.30.40', '10.0.0.0/8 is private, along with 172.16.0.0/12 and 192.168.0.0/16.'), prompt: 'Pick the private address.' }),
        netStep({ fixed: Q('What is 127.0.0.1?', ['This device (loopback)', 'A public web server', 'The default gateway', 'A broadcast address'], 'This device (loopback)', '127.0.0.0/8 always loops back to the local machine.'), prompt: 'Pick the answer.' }),
        netStep({ fixed: Q('A laptop shows 169.254.23.7. What happened?', ['DHCP failed — link-local/APIPA address', 'It is on the internet', 'It is a loopback address', 'It is a broadcast address'], 'DHCP failed — link-local/APIPA address', '169.254.0.0/16 is self-assigned when no DHCP server answers.'), prompt: 'Pick the answer.' }),
        netStep({ fixed: Q('Why does 203.0.113.20 appear in examples and logs?', ['It is reserved for documentation (TEST-NET-3)', 'It is a private address', 'It belongs to Cloudflare', 'It is a multicast address'], 'It is reserved for documentation (TEST-NET-3)', 'RFC 5737 reserves 192.0.2.0/24, 198.51.100.0/24 and 203.0.113.0/24 for examples.'), prompt: 'Pick the answer.' })
      ]
    },
    {
      id: 'hosts', title: '4. Subnet maths: usable hosts', badge: 'Intermediate',
      summary: 'The mask sets the block size: 2^(32−cidr). Two addresses per block are reserved (network and broadcast), so usable hosts = block − 2.',
      syntax: '/24 → 256 addresses → 254 usable   ·   /30 → 4 → 2 usable',
      steps: [
        genStep('subnets', 'How many usable hosts? Work it out from the mask.', 'Usable = 2^(32−cidr) − 2. A /26 is 64 − 2 = 62.'),
        genStep('subnets', 'Answer the subnet question.', 'Block size doubles for every step down in prefix length.'),
        genStep('subnets', 'One more subnet calculation.', 'Usable hosts = block size − 2; block size = 2^(32−cidr).')
      ]
    },
    {
      id: 'network', title: '5. Network and broadcast addresses', badge: 'Advanced',
      summary: 'The network address is the first address in the block (all host bits zero); the broadcast is the last (all host bits one). Everything between is assignable.',
      syntax: 'network + block − 1 = broadcast   ·   10.0.0.77/26 → net .64, bcast .127',
      steps: [
        genStep('subnets', 'Find the network or broadcast address.', 'Round the host part down to a multiple of the block size for the network; add block − 1 for broadcast.'),
        genStep('subnets', 'Answer the subnet question.', 'A /27 block is 32 addresses: .0, .32, .64, .96 … start at the nearest lower multiple.'),
        genStep('subnets', 'Another subnet question.', 'Network = host bits all zero; broadcast = host bits all one.')
      ]
    },
    {
      id: 'firewall', title: '6. Firewalls read top to bottom', badge: 'Advanced',
      summary: 'Rules are evaluated in order and the first match wins, so a broad DENY at the top shadows every ALLOW below it. Shadowed rules are a real audit finding.',
      syntax: 'first match wins · a default DENY at the end is your safety net',
      steps: [
        genStep('firewalls', 'Read the ACL top to bottom and decide.', 'Stop at the first rule where both source and port match.'),
        genStep('firewalls', 'Another packet, another ACL.', 'A rule with src=ANY and the packet port will match before any lower rule.'),
        genStep('firewalls', 'Last ACL check.', 'Do not reason about intent — reason about order.')
      ]
    },
    {
      id: 'chmod', title: '7. chmod: r=4, w=2, x=1', badge: 'Intermediate',
      summary: 'Permissions are three digits, one per owner/group/other, each adding read 4, write 2, execute 1. 644 means owner read+write, everyone else read.',
      syntax: 'chmod 644 file   ·   rwx = 7, rw- = 6, r-x = 5, r-- = 4',
      steps: [
        genStep('chmod', 'Convert between octal and symbolic permissions.', 'Add 4 for r, 2 for w, 1 for x in each of the three positions.'),
        genStep('chmod', 'Another permission conversion.', 'Read the digits left to right as owner, group, other.'),
        genStep('chmod', 'Last permissions question.', 'Order is always owner, group, other.')
      ]
    },
    {
      id: 'concepts', title: '8. Defence concepts', badge: 'Master',
      summary: 'Tools change; principles do not. Least privilege, MFA, patching and logging stop more real attacks than any single product.',
      syntax: 'least privilege · MFA · patch · log · assume breach',
      steps: [
        genStep('concepts', 'Answer the security concept question.', 'Pick the answer that limits what an attacker gains, not the one that sounds fast.'),
        genStep('concepts', 'Another concept question.', 'Prefer the answer that removes the attacker’s path over the one that detects them later.'),
        genStep('concepts', 'One more.', 'Think about what an attacker needs next, and take it away.'),
        genStep('concepts', 'Last one.', 'Defence in depth: no single control is trusted alone.')
      ]
    }
  ];

  if (L.net && L.net.makeQuestion) {
    academy('net_academy', 'Networking Academy', '🥷',
      'Eight guided lessons on ports, private addressing, subnet maths, firewall rule order, chmod and defence concepts — each step is a live question you answer.',
      'net', NET_LESSONS,
      { name: 'Networking Academy', game: 'Net Ninja', gameId: 'netninja' });
  }

  /* ==========================================================================================
     5. SOC ACADEMY — read a log, answer the analyst question
     ========================================================================================== */
  const LOG_CASES = {};
  const logCase = (kind, tag) => {
    const k = kind + ':' + tag;
    if (!LOG_CASES[k]) LOG_CASES[k] = L.logs.makeCase(kind, 0);
    return LOG_CASES[k];
  };
  const logStep = (kind, n, tag, prompt, hint) => ({
    prompt, hint,
    example: () => { const G = logCase(kind, tag); return n === 0 ? G.a1 : G.a2; },
    ui: (host, pass) => {
      const G = logCase(kind, tag);
      const q = n === 0 ? G.q1 : G.q2, opts = n === 0 ? G.opts1 : G.opts2, ans = n === 0 ? G.a1 : G.a2;
      host.innerHTML = '<div class="row" style="gap:6px;align-items:center;margin-bottom:6px">' + badge(G.kind, 'var(--acc)') + '<span class="small">' + esc(q) + '</span></div>' +
        '<div style="max-height:210px;overflow:auto;background:#05070b;border:1px solid var(--line);border-radius:10px;padding:8px;' + mono + ';font-size:12px;line-height:1.5">' +
          G.rows.slice(0, 30).map(r => '<div>' + r.html + '</div>').join('') + '</div>' +
        '<div class="small mute" style="margin:6px 0">Showing 30 of ' + G.rows.length + ' lines — the game adds a SIEM filter for the rest.</div>' +
        '<div class="row" style="gap:6px;flex-wrap:wrap" id="lgo">' + opts.map(o => '<button class="ib" data-a="' + esc(o) + '" style="' + mono + '">' + esc(o) + '</button>').join('') + '</div>' +
        '<div id="lout" class="small" style="margin-top:6px;min-height:18px"></div>';
      let answered = false;
      host.querySelector('#lgo').onclick = e => {
        const b = e.target.closest('[data-a]'); if (!b || answered) return;
        if (b.dataset.a !== ans) {
          b.style.borderColor = 'var(--bad)';
          host.querySelector('#lout').innerHTML = '<span style="color:var(--bad)">Not that one.</span> <span class="mute">' + esc(n === 0 ? G.hint1 : G.hint2) + '</span>';
          return;
        }
        answered = true;
        b.style.borderColor = 'var(--ok)';
        host.querySelector('#lout').innerHTML = '<span style="color:var(--ok)"><b>Correct: ' + esc(ans) + '</b></span> <span class="mute">' + esc(G.lesson) + '</span>';
        pass(ans);
      };
    }
  });

  const SOC_LESSONS = [
    {
      id: 'ssh', title: '1. SSH brute force', badge: 'Beginner',
      summary: 'One external IP, dozens of Failed password lines, then a single Accepted. Bursts per source are the signal; the accepted line after them is the incident.',
      syntax: 'filter: "Failed" → count per IP → look for one Accepted',
      steps: [
        logStep('ssh', 0, 'ssh', 'Which IP is brute-forcing SSH?', 'Look for one IP with a long run of Failed password lines.'),
        logStep('ssh', 1, 'ssh', 'Which account did they get into?', 'The first match is highlighted; find the green Accepted line from that IP.')
      ]
    },
    {
      id: 'spray', title: '2. Password spraying', badge: 'Intermediate',
      summary: 'A spray fails once per account against many users instead of many times against one, dodging per-user lockouts. One IP across many distinct usernames is the signature.',
      syntax: 'same IP · many usernames · 1 attempt each · one LOGIN_OK',
      steps: [
        logStep('spray', 0, 'spray', 'Which IP tried many different usernames?', 'Count distinct users per source IP — a sprayer has many users, few attempts each.'),
        logStep('spray', 1, 'spray', 'Which account had the weak password?', 'Find the single LOGIN_OK line from that IP.')
      ]
    },
    {
      id: 'webscan', title: '3. Web directory reconnaissance', badge: 'Intermediate',
      summary: 'Scanners request paths nobody links to: /.env, /.git/config, /backup.sql. A wall of 404s from one IP is reconnaissance; a single 200 on a sensitive path is the breach.',
      syntax: 'filter: "404" → one source · then look for a 200 on .env, .git, .sql',
      steps: [
        logStep('webscan', 0, 'webscan', 'Which IP is running the directory scanner?', 'The scanner owns almost every 404 in the log.'),
        logStep('webscan', 1, 'webscan', 'Which sensitive path returned 200 OK?', 'Look for the one green 200 among the scanner’s requests.')
      ]
    },
    {
      id: 'sqli', title: '4. Web exploitation', badge: 'Advanced',
      summary: 'Payloads leave fingerprints: quotes and OR/UNION for SQL injection, ../ and %2f for traversal, and a burst of 500s when the query breaks.',
      syntax: 'filter: "UNION", "OR", "..", "500"',
      steps: [
        logStep('sqliweb', 0, 'sqliweb', 'Which external IP is sending the payloads?', 'Filter for UNION, OR or ".." and note the source address.'),
        logStep('sqliweb', 1, 'sqliweb', 'Which endpoint is being attacked?', 'Read the URL path before the "?" from that IP’s requests.')
      ]
    },
    {
      id: 'exfil', title: '5. Data exfiltration', badge: 'Advanced',
      summary: 'Normal traffic is kilobytes; exfiltration is hundreds of megabytes to one external address at an odd hour. Byte counts and destinations matter more than ports.',
      syntax: 'filter: "MB" → one internal source → one external destination',
      steps: [
        logStep('exfil', 0, 'exfil', 'Which internal host is compromised?', 'Type MB in the filter — one internal source stands out.'),
        logStep('exfil', 1, 'exfil', 'Which external drop server received the data?', 'Follow that source’s arrow to the destination IP.')
      ]
    },
    {
      id: 'travel', title: '6. Impossible travel', badge: 'Advanced',
      summary: 'One account, two distant cities, minutes apart. That is a stolen session or a phished credential, and the response is revoke, then re-authenticate with phishing-resistant MFA.',
      syntax: 'same user · different countries · impossible travel time',
      steps: [
        logStep('travel', 0, 'travel', 'Which user logged in from two distant countries?', 'Find one user appearing from a US city and an overseas city within minutes.'),
        logStep('travel', 1, 'travel', 'Which rogue IP accessed the account?', 'Filter for that username and read the IP from the far-away city.')
      ]
    },
    {
      id: 'grad', title: '7. Graduation: unknown case', badge: 'Master',
      summary: 'You will not be told the scenario. Read the shape of the log: repeated failures, many users, 404 walls, payload syntax, byte spikes or geography.',
      syntax: 'identify the pattern → find the source → find the target → write the fix',
      steps: [
        logStep('all', 0, 'grad', 'Unknown case — which host or IP is the attacker?', 'Look for repetition: the same source doing something no human does.'),
        logStep('all', 1, 'grad', 'Now name what they took or reached.', 'Follow the attacker’s successful line: Accepted, LOGIN_OK, 200, the destination IP or the second city.')
      ]
    }
  ];

  if (L.logs && L.logs.makeCase) {
    academy('logs_academy', 'SOC Academy', '🕵️',
      'Seven guided SOC investigations — SSH brute force, spraying, web recon, SQLi, exfiltration, impossible travel — read the log and answer the analyst question.',
      'logs', SOC_LESSONS,
      { name: 'SOC Academy', game: 'Log Detective', gameId: 'logs' });
  }
})();

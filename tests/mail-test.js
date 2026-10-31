// Mail: the IMAP client and the message reader, tested against a small pretend mail server on this PC.
const net = require('net'), path = require('path');
module.exports = async function (ok) {
  const M = require(path.join(__dirname, '..', 'lib', 'mail.js')), T = M._t;
  const CRLF = '\r\n';
  const hdr = (uid) => 'From: =?UTF-8?B?' + Buffer.from('Zoë Smith').toString('base64') + '?= <zoe@example.com>' + CRLF + 'To: me@example.com' + CRLF + 'Subject: Hello number ' + uid + CRLF + 'Date: Tue, 27 Oct 2026 10:00:00 +0000' + CRLF + 'Message-ID: <m' + uid + '@example.com>' + CRLF + CRLF;
  const full = ['From: "Zoë" <zoe@example.com>', 'To: me@example.com', 'Subject: =?ISO-8859-1?Q?Caf=E9_plans?=', 'Date: Tue, 27 Oct 2026 10:00:00 +0000', 'MIME-Version: 1.0', 'Content-Type: multipart/mixed; boundary="XX"', '', '--XX', 'Content-Type: multipart/alternative; boundary="YY"', '', '--YY', 'Content-Type: text/plain; charset=utf-8', 'Content-Transfer-Encoding: quoted-printable', '', 'Meet at the caf=C3=A9 at 5 =', 'tomorrow.', '--YY', 'Content-Type: text/html; charset=utf-8', '', '<p>Meet at the <b>café</b></p><script>alert(1)</script>', '--YY--', '--XX', 'Content-Type: application/pdf; name="menu.pdf"', 'Content-Disposition: attachment; filename*=UTF-8\'\'men%C3%BC.pdf', 'Content-Transfer-Encoding: base64', '', Buffer.from('%PDF-1.4 hello').toString('base64'), '--XX--', ''].join(CRLF);
  let appended = null, loginSeen = '';
  const srv = net.createServer(s => {
    let buf = '', want = 0, pend = null;
    const w = t => s.write(t + CRLF);
    w('* OK pretend IMAP ready');
    s.on('data', d => {
      buf += d.toString('latin1');
      for (; ;) {
        if (want) { if (buf.length < want + 2) return; appended = Buffer.from(buf.slice(0, want), 'latin1'); buf = buf.slice(want + 2); want = 0; w(pend + ' OK APPEND done'); pend = null; continue; }
        const i = buf.indexOf(CRLF); if (i < 0) return; const line = buf.slice(0, i); buf = buf.slice(i + 2);
        const [tag, ...rest] = line.split(' '), cmd = rest.join(' ');
        if (/^CAPABILITY/i.test(cmd)) { w('* CAPABILITY IMAP4rev1 MOVE UIDPLUS'); w(tag + ' OK'); }
        else if (/^LOGIN/i.test(cmd)) { loginSeen = cmd; if (cmd === 'LOGIN "me@example.com" "p\\"w\\\\d"') w(tag + ' OK logged in'); else w(tag + ' NO [AUTHENTICATIONFAILED] Invalid credentials'); }
        else if (/^LIST/i.test(cmd)) { w('* LIST (\\HasNoChildren) "/" "INBOX"'); w('* LIST (\\Drafts) "/" "Drafts"'); w('* LIST (\\HasNoChildren) "/" "&AMk-l&AOk-ments envoy&AOk-s"'); w('* LIST (\\Noselect) "/" "[Gmail]"'); w(tag + ' OK'); }
        else if (/^SELECT/i.test(cmd)) { w('* 2 EXISTS'); w('* OK [UIDVALIDITY 7] ok'); w(tag + ' OK [READ-WRITE] selected'); }
        else if (/^UID SEARCH ALL/i.test(cmd)) { w('* SEARCH 5 9'); w(tag + ' OK'); }
        else if (/^UID FETCH 5,9 /i.test(cmd)) { [5, 9].forEach((u, k) => { const h = hdr(u); s.write('* ' + (k + 1) + ' FETCH (UID ' + u + ' FLAGS (' + (u === 5 ? '\\Seen' : '') + ') RFC822.SIZE 120 BODY[HEADER.FIELDS (FROM TO CC SUBJECT DATE)] {' + Buffer.byteLength(h) + '}' + CRLF + h + ')' + CRLF); }); w(tag + ' OK'); }
        else if (/^UID FETCH 9 \(UID FLAGS BODY.PEEK\[\]\)/i.test(cmd)) { s.write('* 2 FETCH (UID 9 FLAGS () BODY[] {' + Buffer.byteLength(full) + '}' + CRLF + full + ')' + CRLF); w(tag + ' OK'); }
        else if (/^UID STORE/i.test(cmd)) w(tag + ' OK');
        else if (/^APPEND "Drafts" \(\\Draft \\Seen\) \{(\d+)\}$/i.test(cmd)) { want = +cmd.match(/\{(\d+)\}$/)[1]; pend = tag; w('+ go ahead'); }
        else if (/^LOGOUT/i.test(cmd)) { w('* BYE'); w(tag + ' OK'); s.end(); }
        else w(tag + ' BAD unknown ' + cmd);
      }
    });
    s.on('error', () => { });
  });
  await new Promise(r => srv.listen(0, '127.0.0.1', r));
  const a = { host: '127.0.0.1', port: srv.address().port, sec: 'plain' };
  try {
    const c = new T.Imap(a); await c.open();
    let bad = null; try { await c.cmd('LOGIN "me@example.com" "wrong"'); } catch (e) { bad = e.message; }
    ok('mail: a wrong password gets a plain explanation', /app password/.test(bad || ''), bad);
    await c.cmd('LOGIN "me@example.com" "p\\"w\\\\d"');
    ok('mail: quotes and backslashes in passwords are sent safely', loginSeen === 'LOGIN "me@example.com" "p\\"w\\\\d"', loginSeen);
    const li = await c.cmd('LIST "" "*"');
    ok('mail: folders are listed', li.items.length === 4);
    ok('mail: international folder names are decoded', T.mutf7('&AMk-l&AOk-ments envoy&AOk-s') === 'Éléments envoyés');
    await c.cmd('SELECT "INBOX"');
    const f = await c.cmd('UID FETCH 5,9 (UID FLAGS INTERNALDATE RFC822.SIZE BODY.PEEK[HEADER.FIELDS (FROM TO CC SUBJECT DATE)])');
    const heads = f.items.filter(i => /FETCH/.test(i.text)).map(i => T.headers(i.lits[0].toString('latin1')));
    ok('mail: message headers arrive intact', heads.length === 2 && heads[1].subject === 'Hello number 9', JSON.stringify(heads[1] || {}));
    ok('mail: encoded sender names are decoded', T.addrs(heads[0].from)[0].name === 'Zoë Smith', JSON.stringify(T.addrs(heads[0].from)));
    const m = await c.cmd('UID FETCH 9 (UID FLAGS BODY.PEEK[])'), raw = m.items.find(i => i.lits.length).lits[0];
    const p = T.parseMime(raw);
    ok('mail: the plain text is decoded (quoted-printable, UTF-8)', p.text.trim() === 'Meet at the café at 5 tomorrow.', JSON.stringify(p.text));
    ok('mail: the HTML version is found', /<b>café<\/b>/.test(p.html));
    ok('mail: attachments are found with their real names', p.atts.length === 1 && p.atts[0].name === 'menü.pdf' && p.atts[0].data.toString() === '%PDF-1.4 hello', JSON.stringify(p.atts.map(x => x.name)));
    ok('mail: a Latin-1 subject is decoded', T.decodeWords('=?ISO-8859-1?Q?Caf=E9_plans?=') === 'Café plans');
    const draft = T.buildDraft({ email: 'me@example.com', name: 'Gmail', preset: 'gmail' }, { to: 'Zoë <zoe@example.com>', subject: 'Re: Café plans', body: 'See you there ✓', irt: '<m9@example.com>' });
    await c.cmd('APPEND "Drafts" (\\Draft \\Seen)', draft);
    const dp = T.parseMime(appended || Buffer.alloc(0)), dh = T.headers((appended || '').toString('latin1').split('\r\n\r\n')[0]);
    ok('mail: a draft reaches the Drafts folder whole', !!appended && dp.text === 'See you there ✓' && T.decodeWords(dh.subject) === 'Re: Café plans' && dh['in-reply-to'] === '<m9@example.com>', JSON.stringify(dp.text));
    c.close();
  } catch (e) { ok('mail: the pretend mail server conversation completes', false, e.message); }
  srv.close();
};

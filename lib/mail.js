// Mail: read your email in Moundshroud and write drafts, with your local AI to summarise and help reply.
// It talks to your provider over IMAP (encrypted), the same way phone mail apps do. Your password is kept
// encrypted by Windows for your Windows account only (DPAPI). Mail you open is kept on this PC so it can be read
// offline. Nothing is sent anywhere else, and Moundshroud never sends email: drafts go to your Drafts folder.
const tls = require('tls'), net = require('net'), fs = require('fs'), path = require('path'), crypto = require('crypto'), cp = require('child_process');
const U = require('./util');
const DATA = path.join(__dirname, '..', 'data'), ACCTS = path.join(DATA, 'mail-accounts.json'), CACHE = path.join(DATA, 'mail');

/* ---------- the password, protected by Windows for this Windows user only ---------- */
const WS = require('./winsecret');
const protectPw = WS.protect;
/* a password Windows cannot unlock any more (a restored backup on another PC) needs to be typed again */
const unprotectPw = blob => WS.unprotect(blob).catch(() => { throw new Error('Windows could not unlock the saved mail password. Enter it again in Mail › Accounts.'); });

/* ---------- providers ---------- */
const PRESETS = {
  gmail: { name: 'Gmail', host: 'imap.gmail.com', port: 993, sec: 'tls', help: 'Gmail needs an app password: turn on 2-Step Verification, then visit myaccount.google.com › Security › App passwords and make one for “Mail”. Use that 16-letter password here, not your normal one.' },
  yahoo: { name: 'Yahoo', host: 'imap.mail.yahoo.com', port: 993, sec: 'tls', help: 'Yahoo needs an app password: Account info › Account security › Generate app password.' },
  icloud: { name: 'iCloud', host: 'imap.mail.me.com', port: 993, sec: 'tls', help: 'iCloud needs an app-specific password: appleid.apple.com › Sign-In and Security › App-Specific Passwords. Your user name is your iCloud address without @icloud.com for some accounts; try the full address first.' },
  fastmail: { name: 'Fastmail', host: 'imap.fastmail.com', port: 993, sec: 'tls', help: 'Fastmail: Settings › Privacy & Security › Integrations › New app password, with IMAP access.' },
  proton: { name: 'Proton Mail (Bridge)', host: '127.0.0.1', port: 1143, sec: 'starttls', local: true, help: 'Proton Mail works through Proton Mail Bridge (paid Proton plans): install it from Proton’s website (search “Proton Mail Bridge”), sign in there, and copy the IMAP user name and the Bridge password it shows (not your Proton password). Bridge must be running while you use Mail.' },
  gmx: { name: 'GMX', host: 'imap.gmx.com', port: 993, sec: 'tls', help: 'GMX: allow IMAP in Settings › POP3 & IMAP first.' },
  zoho: { name: 'Zoho', host: 'imap.zoho.com', port: 993, sec: 'tls', help: 'Zoho: enable IMAP access, and use an app password if you have two-factor sign-in.' },
  aol: { name: 'AOL', host: 'imap.aol.com', port: 993, sec: 'tls', help: 'AOL needs an app password: Account security › Generate app password.' },
  other: { name: 'Other', host: '', port: 993, sec: 'tls', help: 'Your provider’s IMAP server name and port are on its help pages (search “IMAP settings” and the provider’s name).' }
};
const OUTLOOK = /@(outlook|hotmail|live|msn)\.[a-z.]+$/i;

/* ---------- a small IMAP client ---------- */
class Imap {
  constructor(a) { this.a = a; this.tag = 0; this.buf = Buffer.alloc(0); this.waiting = null; this.items = []; this.cur = null; this.need = 0; this.closed = false; this.caps = ''; }
  open() {
    const a = this.a, opts = { host: a.host, port: a.port, servername: net.isIP(a.host) ? undefined : a.host };
    /* Proton Mail Bridge runs on this PC with its own certificate; that is accepted only for this PC's own address */
    const local = a.host === '127.0.0.1' || a.host === 'localhost';
    return new Promise((res, rej) => {
      const fail = e => { this.closed = true; rej(new Error(nice(e))); };
      if (a.sec === 'tls') { this.s = tls.connect(Object.assign(opts, { rejectUnauthorized: !local }), () => { }); }
      else { this.s = net.connect(opts); }
      this.s.setTimeout(45000, () => { this.s.destroy(new Error('timed out')); });
      this.s.on('error', e => { if (this.waiting) { const w = this.waiting; this.waiting = null; w.rej(new Error(nice(e))); } else fail(e); });
      this.s.on('close', () => { this.closed = true; if (this.waiting) { const w = this.waiting; this.waiting = null; w.rej(new Error('The mail server closed the connection.')); } });
      this.s.on('data', d => this.data(d));
      this.onGreet = async () => {
        try {
          if (a.sec === 'starttls') {
            await this.cmd('STARTTLS');
            this.s.removeAllListeners('data');
            const raw = this.s; this.s = tls.connect({ socket: raw, servername: opts.servername, rejectUnauthorized: !local });
            this.s.on('data', d => this.data(d)); this.s.on('error', e => { if (this.waiting) { const w = this.waiting; this.waiting = null; w.rej(new Error(nice(e))); } }); this.s.on('close', () => { this.closed = true; });
            await new Promise((ok, no) => { this.s.once('secureConnect', ok); this.s.once('error', no); });
          }
          res();
        } catch (e) { rej(e); }
      };
    });
  }
  data(d) {
    this.buf = this.buf.length ? Buffer.concat([this.buf, d]) : d;
    for (; ;) {
      if (this.need) { if (this.buf.length < this.need) return; this.cur.lits.push(this.buf.subarray(0, this.need)); this.buf = this.buf.subarray(this.need); this.need = 0; continue; }
      const i = this.buf.indexOf('\r\n'); if (i < 0) return;
      const line = this.buf.toString('utf8', 0, i); this.buf = this.buf.subarray(i + 2);
      if (!this.cur) this.cur = { text: '', lits: [] };
      this.cur.text += line;
      const m = line.match(/\{(\d+)\}$/);
      if (m) { this.need = +m[1]; this.cur.text += '\u0000'; if (!this.need) this.cur.lits.push(Buffer.alloc(0)); continue; }
      const item = this.cur; this.cur = null; this.line(item);
    }
  }
  line(item) {
    const t = item.text;
    if (this.onGreet) { const g = this.onGreet; this.onGreet = null; if (/^\* (OK|PREAUTH)/i.test(t)) { this.caps = t; g(); } else if (this.s) this.s.destroy(new Error(/^\* BYE/i.test(t) ? t.slice(6) : 'unexpected greeting')); return; }
    if (t.startsWith('+') && this.waiting && this.waiting.cont) { const c = this.waiting.cont; this.waiting.cont = null; c(); return; }
    if (this.waiting && t.startsWith(this.waiting.tag + ' ')) {
      const w = this.waiting; this.waiting = null; const ok = /^\S+ OK/i.test(t);
      if (ok) w.res({ items: this.items, status: t }); else w.rej(new Error(serverSaid(t.replace(/^\S+ (NO|BAD) /i, ''))));
      this.items = []; return;
    }
    this.items.push(item);
  }
  cmd(c, literal) {
    if (this.closed) return Promise.reject(new Error('The connection to the mail server is closed.'));
    const tag = 'm' + (++this.tag);
    return new Promise((res, rej) => {
      this.waiting = { tag, res, rej }; this.items = [];
      if (literal) { this.waiting.cont = () => { this.s.write(literal); this.s.write('\r\n'); }; this.s.write(tag + ' ' + c + ' {' + literal.length + '}\r\n'); }
      else this.s.write(tag + ' ' + c + '\r\n');
    });
  }
  close() { try { if (!this.closed) { this.s.write('z LOGOUT\r\n'); this.s.end(); } } catch (e) { } this.closed = true; }
}
const q = s => '"' + String(s).replace(/\\/g, '\\\\').replace(/"/g, '\\"') + '"';
const nice = e => { const m = String(e && e.message || e); return /ENOTFOUND|EAI_AGAIN/.test(m) ? 'The mail server name was not found. Check it, and that internet access is on.' : /ECONNREFUSED/.test(m) ? 'The mail server refused the connection' + ' (for Proton, make sure Proton Mail Bridge is running).' : /timed out|ETIMEDOUT/.test(m) ? 'The mail server did not answer in time.' : /certificate|self.signed|CERT/i.test(m) ? 'The mail server’s security certificate is not valid, so Moundshroud did not connect.' : m; };
const serverSaid = t => /AUTHENTICATIONFAILED|Invalid credentials|LOGIN failed|authentication failed/i.test(t) ? 'The user name or password was not accepted. Many providers need an app password instead of your normal password.' : 'The mail server said: ' + t.slice(0, 200);
/* IMAP's modified UTF-7 folder names */
const mutf7 = s => s.replace(/&([^-]*)-/g, (m, b) => { if (!b) return '&'; const buf = Buffer.from(b.replace(/,/g, '/'), 'base64'); let o = ''; for (let i = 0; i + 1 < buf.length; i += 2) o += String.fromCharCode(buf.readUInt16BE(i)); return o; });

/* ---------- reading mail: headers and MIME ---------- */
function decodeWords(s) {
  return String(s || '').replace(/\?=\s+=\?/g, '?==?').replace(/=\?([^?]+)\?([BbQq])\?([^?]*)\?=/g, (m, cs, enc, txt) => {
    try { const b = /b/i.test(enc) ? Buffer.from(txt, 'base64') : Buffer.from(txt.replace(/_/g, ' ').replace(/=([0-9A-Fa-f]{2})/g, (x, h) => String.fromCharCode(parseInt(h, 16))), 'latin1'); return charset(b, cs); } catch (e) { return m; }
  });
}
function charset(buf, cs) { cs = String(cs || 'utf-8').toLowerCase().replace(/^(us-)?ascii$/, 'utf-8').replace(/\*.*$/, ''); try { return new TextDecoder(cs).decode(buf); } catch (e) { return new TextDecoder('utf-8').decode(buf); } }
function headers(raw) {
  const h = {}; String(raw).replace(/\r?\n[ \t]+/g, ' ').split(/\r?\n/).forEach(l => { const i = l.indexOf(':'); if (i > 0) { const k = l.slice(0, i).trim().toLowerCase(); if (!(k in h)) h[k] = l.slice(i + 1).trim(); } });
  return h;
}
function param(v, name) {
  const s = String(v || ''), star = s.match(new RegExp(name + '\\*=([^;]+)', 'i'));
  if (star) { const m = star[1].trim().replace(/^"|"$/g, '').match(/^([^']*)'[^']*'(.*)$/); if (m) { const bytes = []; const t = m[2]; for (let i = 0; i < t.length; i++) { if (t[i] === '%' && /^[0-9a-f]{2}$/i.test(t.substr(i + 1, 2))) { bytes.push(parseInt(t.substr(i + 1, 2), 16)); i += 2; } else bytes.push(t.charCodeAt(i) & 255); } return charset(Buffer.from(bytes), m[1]); } }
  const parts = []; s.replace(new RegExp(name + '\\*(\\d+)\\*?=("[^"]*"|[^;]+)', 'gi'), (x, n, val) => { parts[+n] = val.replace(/^"|"$/g, ''); }); if (parts.length) return decodeWords(parts.join(''));
  const m = s.match(new RegExp('(?:^|;)\\s*' + name + '=("([^"]*)"|[^;]+)', 'i')); return m ? decodeWords((m[2] != null ? m[2] : m[1]).trim()) : '';
}
function transfer(buf, enc) {
  enc = String(enc || '').toLowerCase();
  if (enc === 'base64') return Buffer.from(buf.toString('latin1').replace(/[^A-Za-z0-9+/=]/g, ''), 'base64');
  if (enc === 'quoted-printable') { const s = buf.toString('latin1').replace(/=\r?\n/g, ''); const out = []; for (let i = 0; i < s.length; i++) { if (s[i] === '=' && /^[0-9A-Fa-f]{2}$/.test(s.substr(i + 1, 2))) { out.push(parseInt(s.substr(i + 1, 2), 16)); i += 2; } else out.push(s.charCodeAt(i) & 255); } return Buffer.from(out); }
  return buf;
}
function parseMime(buf, out, depth) {
  out = out || { text: '', html: '', atts: [], cids: {} }; depth = depth || 0; if (depth > 12) return out;
  const sep = buf.indexOf('\r\n\r\n') >= 0 ? buf.indexOf('\r\n\r\n') : buf.indexOf('\n\n'), hl = sep < 0 ? buf.length : sep, h = headers(buf.toString('latin1', 0, hl)), body = sep < 0 ? Buffer.alloc(0) : buf.subarray(hl + (buf[hl] === 13 ? 4 : 2));
  const ct = (h['content-type'] || 'text/plain').toLowerCase(), type = ct.split(';')[0].trim(), disp = String(h['content-disposition'] || '').toLowerCase();
  if (type.startsWith('multipart/')) {
    const b = param(h['content-type'], 'boundary'); if (!b) return out;
    const mark = Buffer.from('--' + b), parts = []; let i = body.indexOf(mark);
    while (i >= 0) { let s = i + mark.length; if (body[s] === 45 && body[s + 1] === 45) break; while (body[s] === 13 || body[s] === 10 || body[s] === 32 || body[s] === 9) { if (body[s] === 10) { s++; break; } s++; } const j = body.indexOf(mark, s); if (j < 0) { parts.push(body.subarray(s)); break; } let e = j; if (body[e - 1] === 10) e--; if (body[e - 1] === 13) e--; parts.push(body.subarray(s, e)); i = j; }
    if (type === 'multipart/alternative') { parts.forEach(p => parseMime(p, out, depth + 1)); return out; }
    parts.forEach(p => parseMime(p, out, depth + 1)); return out;
  }
  if (type === 'message/rfc822' && !/attachment/.test(disp)) return parseMime(body, out, depth + 1);
  const data = transfer(body, h['content-transfer-encoding']), name = param(h['content-disposition'], 'filename') || param(h['content-type'], 'name');
  const cid = String(h['content-id'] || '').replace(/[<>]/g, '');
  if ((type === 'text/plain' || type === 'text/html') && !/attachment/.test(disp) && !name) {
    const t = charset(data, param(h['content-type'], 'charset'));
    if (type === 'text/html') out.html += t; else out.text += (out.text ? '\n\n' : '') + t;
    return out;
  }
  const att = { name: name || (cid ? 'inline-' + cid : 'attachment') + (type.includes('/') && !name ? '.' + type.split('/')[1].replace(/[^a-z0-9]/g, '') : ''), type, size: data.length, data, cid, inline: !!cid && /^image\//.test(type) };
  if (att.inline) out.cids[cid] = att; out.atts.push(att); return out;
}
const addrs = v => decodeWords(v || '').split(/,(?=(?:[^"]*"[^"]*")*[^"]*$)/).map(s => s.trim()).filter(Boolean).map(s => { const m = s.match(/^\s*"?([^"<]*?)"?\s*<([^>]+)>/); return m ? { name: m[1].trim(), email: m[2].trim() } : { name: '', email: s.replace(/[<>]/g, '') }; });

/* ---------- accounts ---------- */
const readAccts = () => U.readJson(ACCTS, []);
const pub = a => ({ id: a.id, name: a.name, email: a.email, host: a.host, port: a.port, sec: a.sec, user: a.user, preset: a.preset, at: a.at });
const pwCache = new Map();
async function password(a) { if (pwCache.has(a.id)) return pwCache.get(a.id); const p = await unprotectPw(a.pw); pwCache.set(a.id, p); return p; }

/* one open connection per account, reused for a couple of minutes, one command at a time */
const pool = new Map();
async function withImap(id, fn) {
  const a = readAccts().find(x => x.id === id); if (!a) throw new Error('That mail account is not set up.');
  let e = pool.get(id); if (!e) { e = { chain: Promise.resolve(), c: null, t: 0, sel: '' }; pool.set(id, e); }
  const run = e.chain.then(async () => {
    clearTimeout(e.t);
    if (!e.c || e.c.closed) { const pw = await password(a); e.c = new Imap(a); await e.c.open(); await e.c.cmd('LOGIN ' + q(a.user) + ' ' + q(pw)).catch(err => { e.c.close(); e.c = null; throw err; }); e.sel = ''; const cap = await e.c.cmd('CAPABILITY'); e.caps = cap.items.map(i => i.text).join(' ').toUpperCase(); }
    try { return await fn(e.c, e); } catch (err) { if (e.c && e.c.closed) e.c = null; throw err; }
    finally { e.t = setTimeout(() => { if (e.c) e.c.close(); e.c = null; }, 120000); }
  });
  e.chain = run.catch(() => { }); return run;
}
async function select(c, e, folder) { if (e.sel === folder) return e.info; const r = await c.cmd('SELECT ' + q(folder)); const t = r.items.map(i => i.text).join('\n'); e.sel = folder; e.info = { exists: +((t.match(/\* (\d+) EXISTS/i) || [])[1] || 0), uidv: (t.match(/UIDVALIDITY (\d+)/i) || [])[1] || '' }; return e.info; }

async function addAccount(b) {
  const p = PRESETS[b.preset] || PRESETS.other, a = { id: crypto.randomBytes(6).toString('hex'), preset: b.preset || 'other', name: String(b.name || p.name).slice(0, 60), email: String(b.email || '').trim().slice(0, 200), user: String(b.user || b.email || '').trim().slice(0, 200), host: String(b.host || p.host).trim(), port: +(b.port || p.port), sec: b.sec === 'starttls' ? 'starttls' : 'tls', at: Date.now() };
  if (OUTLOOK.test(a.email) && /outlook|office365/i.test(a.host)) return { error: 'Microsoft no longer lets apps like this sign in to Outlook.com and Hotmail mailboxes with a password. Those accounts cannot be added.' };
  if (!a.host || !/^[a-z0-9.-]+$/i.test(a.host) || !(a.port > 0 && a.port < 65536)) return { error: 'Check the server name and port.' };
  if (!b.password) return { error: 'Enter the password (usually an app password).' };
  /* try it before saving anything */
  const c = new Imap(a);
  try { await c.open(); await c.cmd('LOGIN ' + q(a.user) + ' ' + q(b.password)); } catch (e) { c.close(); return { error: e.message }; }
  c.close();
  a.pw = await protectPw(String(b.password));
  const list = readAccts().filter(x => !(x.email === a.email && x.host === a.host)); list.push(a); fs.mkdirSync(DATA, { recursive: true }); U.writeJson(ACCTS, list); pwCache.set(a.id, String(b.password));
  return { ok: true, account: pub(a) };
}
function removeAccount(id) {
  const list = readAccts(), a = list.find(x => x.id === id); if (!a) return { error: 'not found' };
  U.writeJson(ACCTS, list.filter(x => x.id !== id)); pwCache.delete(id); const e = pool.get(id); if (e && e.c) e.c.close(); pool.delete(id);
  try { fs.rmSync(path.join(CACHE, id.replace(/[^a-f0-9]/g, '')), { recursive: true, force: true }); } catch (e) { }
  return { ok: true };
}
const accounts = () => ({ accounts: readAccts().map(pub), presets: Object.entries(PRESETS).map(([id, p]) => ({ id, name: p.name, host: p.host, port: p.port, sec: p.sec, help: p.help })) });

async function folders(id) {
  return withImap(id, async c => {
    const r = await c.cmd('LIST "" "*"');
    const out = r.items.map(i => { const m = i.text.match(/^\* LIST \(([^)]*)\) (?:"[^"]*"|NIL) (.+)$/i); if (!m) return null; let n = m[2].trim(); if (n.includes('\u0000')) n = (i.lits[0] || Buffer.alloc(0)).toString('utf8'); n = n.replace(/^"|"$/g, '').replace(/\\"/g, '"'); const f = m[1].toLowerCase(); if (/\\noselect|\\nonexistent/.test(f)) return null; return { name: n, label: mutf7(n), use: /\\sent/.test(f) ? 'sent' : /\\drafts/.test(f) ? 'drafts' : /\\trash/.test(f) ? 'trash' : /\\junk|\\spam/.test(f) ? 'junk' : /\\archive|\\all/.test(f) ? 'archive' : /^inbox$/i.test(n) ? 'inbox' : '' }; }).filter(Boolean);
    const guess = (use, re) => { if (!out.some(f => f.use === use)) { const f = out.find(f => re.test(f.label)); if (f) f.use = use; } };
    guess('sent', /sent/i); guess('drafts', /draft/i); guess('trash', /trash|deleted|bin/i); guess('junk', /junk|spam/i);
    const rank = { inbox: 0, drafts: 1, sent: 2, archive: 3, junk: 4, trash: 5, '': 6 };
    return { folders: out.sort((a, b) => rank[a.use] - rank[b.use] || a.label.localeCompare(b.label)) };
  });
}

const cacheFile = (id, folder) => path.join(CACHE, id.replace(/[^a-f0-9]/g, ''), crypto.createHash('sha1').update(folder).digest('hex').slice(0, 16) + '.json');
function cached(id, folder) { return U.readJson(cacheFile(id, folder), null); }

/* the newest messages in a folder (headers only); older ones on request */
async function list(id, folder, before) {
  folder = String(folder || 'INBOX');
  return withImap(id, async (c, e) => {
    const info = await select(c, e, folder); if (!info.exists) { saveList(id, folder, info, []); return { folder, total: 0, items: [] }; }
    const s = await c.cmd('UID SEARCH ALL'); let uids = []; s.items.forEach(i => { const m = i.text.match(/^\* SEARCH(.*)$/i); if (m) uids = uids.concat(m[1].trim().split(/\s+/).filter(Boolean).map(Number)); });
    uids.sort((a, b) => a - b); if (before) uids = uids.filter(u => u < +before);
    const take = uids.slice(-60); if (!take.length) return { folder, total: info.exists, items: [], more: false };
    const items = await fetchHeads(c, take);
    const old = (!before && cached(id, folder)) || null, prev = old && old.uidv === info.uidv ? old.items : [];
    const merged = before ? items : items.concat(prev.filter(p => !items.some(x => x.uid === p.uid) && p.uid < take[0])).slice(0, 400);
    if (!before) saveList(id, folder, info, merged);
    return { folder, total: info.exists, items: items.sort((a, b) => b.uid - a.uid), more: uids.length > take.length };
  });
}
function saveList(id, folder, info, items) { const f = cacheFile(id, folder); fs.mkdirSync(path.dirname(f), { recursive: true }); U.writeJson(f, { at: Date.now(), uidv: info.uidv, items: items.sort((a, b) => b.uid - a.uid) }); }
async function fetchHeads(c, uids) {
  const r = await c.cmd('UID FETCH ' + uids.join(',') + ' (UID FLAGS INTERNALDATE RFC822.SIZE BODY.PEEK[HEADER.FIELDS (FROM TO CC SUBJECT DATE MESSAGE-ID IN-REPLY-TO REFERENCES LIST-UNSUBSCRIBE CONTENT-TYPE)])');
  return r.items.filter(i => /^\* \d+ FETCH/i.test(i.text)).map(i => {
    const t = i.text, uid = +((t.match(/UID (\d+)/i) || [])[1] || 0), flags = ((t.match(/FLAGS \(([^)]*)\)/i) || [])[1] || ''), h = headers((i.lits[0] || Buffer.alloc(0)).toString('latin1'));
    const from = addrs(h.from)[0] || { name: '', email: '' };
    return { uid, seen: /\\Seen/i.test(flags), flagged: /\\Flagged/i.test(flags), answered: /\\Answered/i.test(flags), size: +((t.match(/RFC822\.SIZE (\d+)/i) || [])[1] || 0), date: Date.parse(h.date || (t.match(/INTERNALDATE "([^"]+)"/i) || [])[1] || '') || 0, from, to: addrs(h.to), cc: addrs(h.cc), subject: decodeWords(h.subject || '') || '(no subject)', mid: h['message-id'] || '', irt: h['in-reply-to'] || '', refs: h.references || '', news: !!h['list-unsubscribe'], att: /multipart\/(mixed|related)/i.test(h['content-type'] || '') };
  }).filter(x => x.uid);
}

/* one message, whole: kept on this PC afterwards so it opens instantly and offline */
const msgCache = new Map();
async function message(id, folder, uid, markRead) {
  folder = String(folder || 'INBOX'); uid = +uid; const key = id + '|' + folder + '|' + uid;
  const disk = path.join(path.dirname(cacheFile(id, folder)), 'm-' + crypto.createHash('sha1').update(folder + '|' + uid).digest('hex').slice(0, 16) + '.json');
  let m = msgCache.get(key);
  if (!m) {
    const d = U.readJson(disk, null);
    if (d && !d.needAtts) m = d;
  }
  if (!m) {
    const raw = await withImap(id, async (c, e) => { await select(c, e, folder); const r = await c.cmd('UID FETCH ' + uid + ' (UID FLAGS BODY.PEEK[])'); const it = r.items.find(i => /FETCH/i.test(i.text) && i.lits.length); if (!it) throw new Error('That message is no longer there.'); return it.lits[it.lits.length - 1]; });
    if (raw.length > 40e6) throw new Error('That message is too big to open here.');
    const sep = raw.indexOf('\r\n\r\n'), h = headers(raw.toString('latin1', 0, sep < 0 ? raw.length : sep)), p = parseMime(raw);
    m = { uid, folder, subject: decodeWords(h.subject || '') || '(no subject)', from: addrs(h.from)[0] || {}, to: addrs(h.to), cc: addrs(h.cc), replyTo: addrs(h['reply-to'])[0] || null, date: Date.parse(h.date || '') || 0, mid: h['message-id'] || '', refs: h.references || '', unsub: h['list-unsubscribe'] || '', auth: h['authentication-results'] || '', text: p.text, html: p.html, atts: p.atts.map((a, i) => ({ i, name: a.name, type: a.type, size: a.size, cid: a.cid, inline: a.inline })) };
    m._parts = p.atts.map(a => a.data);
    msgCache.set(key, m); if (msgCache.size > 25) msgCache.delete(msgCache.keys().next().value);
    try { fs.mkdirSync(path.dirname(disk), { recursive: true }); const keep = Object.assign({}, m); delete keep._parts; keep.inl = {}; p.atts.forEach((a, i) => { if (a.inline && a.data.length < 1.5e6) keep.inl[a.cid] = 'data:' + a.type + ';base64,' + a.data.toString('base64'); }); keep.needAtts = p.atts.some(a => !a.inline); U.writeJson(disk, keep); m.inl = keep.inl; } catch (e) { }
  }
  if (markRead) withImap(id, async (c, e) => { await select(c, e, folder); await c.cmd('UID STORE ' + uid + ' +FLAGS.SILENT (\\Seen)'); }).catch(() => { });
  const out = Object.assign({}, m); delete out._parts; return out;
}
function attachment(id, folder, uid, i, res) {
  const m = msgCache.get(id + '|' + folder + '|' + (+uid)); const a = m && m.atts[+i];
  if (!a || !m._parts || !m._parts[+i]) { res.writeHead(404, { 'Content-Type': 'text/plain' }); return res.end('Open the message again first.'); }
  const b = m._parts[+i];
  res.writeHead(200, { 'Content-Type': 'application/octet-stream', 'Content-Length': b.length, 'Content-Disposition': 'attachment; filename="' + a.name.replace(/[^\w.\- ()]/g, '_') + '"; filename*=UTF-8\'\'' + encodeURIComponent(a.name), 'X-Content-Type-Options': 'nosniff' }); res.end(b);
}

async function flag(id, folder, uid, what, on) {
  const F = { seen: '\\Seen', flagged: '\\Flagged' }[what]; if (!F) return { error: 'unknown flag' };
  await withImap(id, async (c, e) => { await select(c, e, folder); await c.cmd('UID STORE ' + (+uid) + ' ' + (on ? '+' : '-') + 'FLAGS.SILENT (' + F + ')'); });
  return { ok: true };
}
/* moving to the Trash (or anywhere): MOVE where the server can, otherwise copy and mark the original deleted */
async function move(id, folder, uid, to) {
  await withImap(id, async (c, e) => {
    await select(c, e, folder);
    if (/\bMOVE\b/.test(e.caps)) await c.cmd('UID MOVE ' + (+uid) + ' ' + q(to));
    else { await c.cmd('UID COPY ' + (+uid) + ' ' + q(to)); await c.cmd('UID STORE ' + (+uid) + ' +FLAGS.SILENT (\\Deleted)'); if (/UIDPLUS/.test(e.caps)) await c.cmd('UID EXPUNGE ' + (+uid)); }
  });
  for (const k of msgCache.keys()) if (k === id + '|' + folder + '|' + (+uid)) msgCache.delete(k);
  return { ok: true };
}
async function search(id, folder, text) {
  text = String(text || '').trim().slice(0, 200); if (!text) return { items: [] };
  return withImap(id, async (c, e) => {
    await select(c, e, folder);
    const ascii = /^[\x20-\x7e]*$/.test(text);
    const r = ascii ? await c.cmd('UID SEARCH TEXT ' + q(text)) : await c.cmd('UID SEARCH CHARSET UTF-8 TEXT', Buffer.from(text, 'utf8'));
    let uids = []; r.items.forEach(i => { const m = i.text.match(/^\* SEARCH(.*)$/i); if (m) uids = uids.concat(m[1].trim().split(/\s+/).filter(Boolean).map(Number)); });
    uids = uids.sort((a, b) => b - a).slice(0, 80);
    return { items: uids.length ? (await fetchHeads(c, uids)).sort((a, b) => b.uid - a.uid) : [] };
  });
}

/* a draft goes into the account's Drafts folder, so you can send it from your phone or webmail */
const encWord = s => /^[\x20-\x7e]*$/.test(s) ? s : '=?UTF-8?B?' + Buffer.from(s, 'utf8').toString('base64') + '?=';
const fmtAddr = list => String(list || '').split(/[,;]/).map(s => s.trim()).filter(Boolean).map(s => { const m = s.match(/^(.*)<([^>]+)>$/); return m ? encWord(m[1].trim().replace(/^"|"$/g, '')) + ' <' + m[2].trim() + '>' : s; }).join(', ');
function buildDraft(a, d) {
  const lines = ['From: ' + (a.name && a.name !== (PRESETS[a.preset] || {}).name ? encWord(a.name) + ' <' + a.email + '>' : a.email), 'To: ' + fmtAddr(d.to), d.cc ? 'Cc: ' + fmtAddr(d.cc) : '', 'Subject: ' + encWord(String(d.subject || '')), 'Date: ' + new Date().toUTCString().replace('GMT', '+0000'), 'Message-ID: <' + crypto.randomBytes(12).toString('hex') + '@moundshroud.local>', d.irt ? 'In-Reply-To: ' + d.irt : '', d.refs ? 'References: ' + d.refs : '', 'MIME-Version: 1.0', 'Content-Type: text/plain; charset=UTF-8', 'Content-Transfer-Encoding: base64'].filter(Boolean);
  const body = Buffer.from(String(d.body || '').replace(/\r?\n/g, '\r\n'), 'utf8').toString('base64').replace(/.{76}/g, '$&\r\n');
  return Buffer.from(lines.join('\r\n') + '\r\n\r\n' + body + '\r\n', 'utf8');
}
async function saveDraft(id, d) {
  const a = readAccts().find(x => x.id === id); if (!a) return { error: 'That mail account is not set up.' };
  const f = (await folders(id)).folders.find(x => x.use === 'drafts'); if (!f) return { error: 'This account has no Drafts folder.' };
  const msg = buildDraft(a, d);
  await withImap(id, async (c, e) => { e.sel = ''; await c.cmd('APPEND ' + q(f.name) + ' (\\Draft \\Seen)', msg); });
  return { ok: true, folder: f.label };
}

/* local drafts, kept on this PC whether or not they were saved to the account */
const DRAFTS = path.join(DATA, 'mail-drafts.json');
const localDrafts = () => ({ drafts: U.readJson(DRAFTS, []) });
function saveLocal(d) { const l = U.readJson(DRAFTS, []).filter(x => x.id !== d.id); const x = { id: d.id || crypto.randomBytes(6).toString('hex'), acct: d.acct || '', to: String(d.to || ''), cc: String(d.cc || ''), subject: String(d.subject || ''), body: String(d.body || '').slice(0, 2e5), irt: d.irt || '', refs: d.refs || '', at: Date.now() }; l.unshift(x); fs.mkdirSync(DATA, { recursive: true }); U.writeJson(DRAFTS, l.slice(0, 200)); return { ok: true, draft: x }; }
function dropLocal(id) { U.writeJson(DRAFTS, U.readJson(DRAFTS, []).filter(x => x.id !== id)); return { ok: true }; }

module.exports = { accounts, addAccount, removeAccount, folders, list, cached, message, attachment, flag, move, search, saveDraft, localDrafts, saveLocal, dropLocal, PRESETS, _t: { parseMime, decodeWords, headers, param, addrs, mutf7, buildDraft, Imap, protectPw, unprotectPw } };

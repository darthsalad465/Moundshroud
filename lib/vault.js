// Password vault storage. The vault is encrypted in the window (AES-256-GCM with a key made from your master
// password by PBKDF2) before it is sent here, so this file only ever stores and returns scrambled data.
// The master password and the passwords themselves never reach the server.
const fs = require('fs'), path = require('path'), crypto = require('crypto');
const U = require('./util');
const DATA = path.join(__dirname, '..', 'data'), FILE = path.join(DATA, 'vault.json'), KEEP = 5;

const b64 = s => typeof s === 'string' && /^[A-Za-z0-9+/=]+$/.test(s);
function valid(v) {
  return v && v.v === 1 && b64(v.salt) && b64(v.iv) && b64(v.ct) && Number.isInteger(v.iter) && v.iter >= 100000 && v.iter <= 5e6 && v.ct.length < 30e6;
}
function get() {
  try { const v = JSON.parse(fs.readFileSync(FILE, 'utf8')); return valid(v) ? { exists: true, vault: v } : { exists: false, damaged: true }; }
  catch (e) { return { exists: fs.existsSync(FILE), damaged: fs.existsSync(FILE) }; }
}
/* every save keeps the previous five versions, so a bad save or a mistake can be undone */
function save(v) {
  if (!valid(v)) return { error: 'That is not a vault Moundshroud made.' };
  fs.mkdirSync(DATA, { recursive: true });
  try {
    if (fs.existsSync(FILE)) {
      for (let i = KEEP - 1; i >= 1; i--) { const a = FILE + '.' + i, b = FILE + '.' + (i + 1); if (fs.existsSync(a)) fs.renameSync(a, b); }
      fs.copyFileSync(FILE, FILE + '.1');
    }
  } catch (e) { }
  U.atomicWrite(FILE, JSON.stringify({ v: 1, salt: v.salt, iter: v.iter, iv: v.iv, ct: v.ct, at: Date.now() }));
  return { ok: true, at: Date.now() };
}
function versions() {
  const out = [];
  for (let i = 1; i <= KEEP; i++) { try { const st = fs.statSync(FILE + '.' + i); out.push({ n: i, at: st.mtimeMs }); } catch (e) { } }
  return out;
}
function older(n) { try { const v = JSON.parse(fs.readFileSync(FILE + '.' + (+n), 'utf8')); return valid(v) ? { vault: v } : { error: 'damaged' }; } catch (e) { return { error: 'not found' }; } }

/* a copied password must not stay in Moundshroud's own clipboard history: the window sends only a fingerprint
   (SHA-256) of what it copied, and any history entry with the same fingerprint is removed */
function scrubClipboard(hash) {
  if (!/^[a-f0-9]{64}$/.test(String(hash || ''))) return { error: 'bad fingerprint' };
  const CF = path.join(DATA, 'clipboard.jsonl'); let lines;
  try { lines = fs.readFileSync(CF, 'utf8').split('\n').filter(Boolean); } catch (e) { return { ok: true, removed: 0 }; }
  const keep = lines.filter(l => { try { const x = JSON.parse(l); return crypto.createHash('sha256').update(String(x.text || ''), 'utf8').digest('hex') !== hash; } catch (e) { return true; } });
  if (keep.length !== lines.length) U.atomicWrite(CF, keep.join('\n') + (keep.length ? '\n' : ''));
  return { ok: true, removed: lines.length - keep.length };
}

module.exports = { get, save, versions, older, scrubClipboard, FILE };

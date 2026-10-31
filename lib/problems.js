// A tiny problem log, written by the server and by the page, so nothing fails silently any more.
// Before this, an error in a route (or an exception escaping a callback) could end the whole server and the window would
// just say "this page is not found", with nothing to look at. Now the error is written to data\problems.log, kept in memory
// for the in-app list (Settings > Backup & data > Problems), and the server stays up.
const fs = require('fs'), path = require('path');
const ROOT = path.join(__dirname, '..'), DATA = path.join(ROOT, 'data'), FILE = path.join(DATA, 'problems.log');
const MAX = 220 * 1024;                       // small: it is a personal log, not telemetry, and it never leaves this PC
const KEEP = 40;                              // how many to remember for the in-app list
const recent = [];
const stamp = () => new Date().toISOString().replace('T', ' ').slice(0, 19);
const clean = s => String(s == null ? '' : s).replace(/\s+/g, ' ').slice(0, 700);

function note(kind, text, extra) {
  const row = { at: stamp(), kind: String(kind || 'note').slice(0, 24), text: clean(text), extra: extra ? clean(extra) : '' };
  recent.push(row); if (recent.length > KEEP) recent.shift();
  try {
    fs.mkdirSync(DATA, { recursive: true });
    const line = row.at + '  ' + row.kind.toUpperCase().padEnd(8) + row.text + (row.extra ? '  |  ' + row.extra : '') + '\r\n';
    let big = false; try { big = fs.statSync(FILE).size > MAX; } catch (e) { big = false; }
    if (big) fs.writeFileSync(FILE, 'Moundshroud problem log (older lines were dropped)\r\n' + line); else fs.appendFileSync(FILE, line);
  } catch (e) { }
  return row;
}

const errText = e => (e && (e.stack || e.message)) ? String(e.stack || e.message) : String(e);

/* the file, for "open the log" and for the copy button */
function tail(lines = 200) {
  try { const t = fs.readFileSync(FILE, 'utf8').split(/\r?\n/).filter(Boolean); return t.slice(-lines).join('\n'); } catch (e) { return ''; }
}

module.exports = { note, recent: () => recent.slice(), tail, file: FILE, errText };

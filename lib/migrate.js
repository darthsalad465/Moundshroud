// One-time tidy-ups from before the app was renamed. Safe to run on every start: it only acts when the old thing exists and the new one does not.
const fs = require('fs'), path = require('path'), os = require('os');
const OLD = 'Atlas ' + 'Documents', NEW = 'Moundshroud Documents';      // (split so the old name is not rewritten by a find-and-replace)
function docsDir() { const h = os.homedir(), od = path.join(h, 'OneDrive', 'Documents'); return fs.existsSync(od) ? od : path.join(h, 'Documents'); }
function run(dataDir) {
  const done = [];
  try {
    const base = docsDir(), from = path.join(base, OLD), to = path.join(base, NEW);
    if (fs.existsSync(from) && !fs.existsSync(to)) {
      fs.renameSync(from, to); done.push('documents folder renamed');
      // the Office editor keeps a note of each file's path beside its saved versions
      const ob = path.join(dataDir || path.join(__dirname, '..', 'data'), 'office-backups');
      if (fs.existsSync(ob)) for (const d of fs.readdirSync(ob)) { const f = path.join(ob, d, 'name.txt'); try { const t = fs.readFileSync(f, 'utf8'); if (t.includes(OLD)) fs.writeFileSync(f, t.split(OLD).join(NEW), 'utf8'); } catch (e) { } }
    }
  } catch (e) { /* the folder may be open in another program: it will be tried again next start */ }
  return done;
}
module.exports = { run };

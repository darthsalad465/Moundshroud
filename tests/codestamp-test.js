// The server notices when its own code on the disk is newer than the copy that is running (lib/codestamp.js), and the
// Studio pages keep working after their first redraw. Nothing is started here.
const fs = require('fs'), os = require('os'), path = require('path');

module.exports = async ok => {
  const C = require(path.join(__dirname, '..', 'lib', 'codestamp.js'));
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'ms-code-'));
  fs.mkdirSync(path.join(dir, 'lib')); fs.writeFileSync(path.join(dir, 'server.js'), 'one'); fs.writeFileSync(path.join(dir, 'lib', 'a.js'), 'a');
  const c = C.create(dir);
  ok('code check: nothing changed right after the server starts', c.changed(0) === false);
  fs.writeFileSync(path.join(dir, 'lib', 'b.js'), 'a new part');
  ok('code check: a new server file means the running copy is out of date', c.changed(0) === true);
  const c2 = C.create(dir); fs.writeFileSync(path.join(dir, 'server.js'), 'one, changed');
  ok('code check: a changed server.js means the running copy is out of date', c2.changed(0) === true);
  const c3 = C.create(dir); fs.writeFileSync(path.join(dir, 'notes.txt'), 'not code');
  ok('code check: other files do not count', c3.changed(0) === false);
  try { fs.rmSync(dir, { recursive: true, force: true }); } catch (e) { }

  const root = path.join(__dirname, '..'), server = fs.readFileSync(path.join(root, 'server.js'), 'utf8'), page = fs.readFileSync(path.join(root, 'web', 'js', 'studio-sessions.js'), 'utf8');
  ok('code check: the server tells the page when it is out of date', /url === '\/api\/ping'[^\n]*stale:/.test(server));
  ok('code check: an out-of-date server does not stay up for the phone', /remote\.on\(\) && !outdated\(/.test(server));
  /* $('stat').dataset.k = ... renamed the very attribute the page finds that element by, so every later redraw failed */
  ok('studio sessions: no element is renamed out from under its own lookup', !/\$\('\w+'\)\.dataset\.k\s*=/.test(page));
  ok('studio sessions: a video whose record is gone ends with a message', /!s\.state/.test(page));
};

// Has Moundshroud's own code changed on the disk since this copy of the server started?
// The server can outlive its window: with phone access on it keeps running until Quit. The pages are read fresh from
// the disk every time, so after the code was changed an old server answered pages that asked for addresses it did not
// have yet. On 2026-11-13 long videos and FLUX pictures failed with "not found" for exactly that reason.
// The server asks changed() so it stops staying up once it is out of date; the tray helper then starts the current code.
const fs = require('fs'), path = require('path');

const files = root => { const out = [path.join(root, 'server.js')]; try { for (const f of fs.readdirSync(path.join(root, 'lib')).sort()) if (/\.(js|json)$/i.test(f)) out.push(path.join(root, 'lib', f)); } catch (e) { } return out; };
/* one line that is different as soon as a server file is added, removed, resized or saved again */
const sign = root => files(root).map(f => { try { const s = fs.statSync(f); return path.basename(f) + ':' + s.size + ':' + Math.round(s.mtimeMs); } catch (e) { return path.basename(f) + ':gone'; } }).join('|');

function create(root) {
  const boot = sign(root); let at = 0, was = false;
  /* the idle check asks every 2 seconds, so the disk is read at most once per `every` milliseconds; once changed, it stays changed */
  return { changed: (every = 15000) => { const now = Date.now(); if (was || now - at < every) return was; at = now; return (was = sign(root) !== boot); } };
}

module.exports = { create, sign };

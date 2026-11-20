// The Entertainment tab: every game module is valid JavaScript, every game is registered exactly once with the name, icon,
// description and mount the hub needs, and every script a lazy tab asks for is really on disk. A game registered twice
// silently replaces the first one, and a tab asking for a renamed file fails the first time it is opened; both are cheap to
// catch here and otherwise only a player would notice.
const fs = require('fs'), path = require('path'), vm = require('vm');

const ROOT = path.join(__dirname, '..'), WEB = path.join(ROOT, 'web', 'js');
const read = f => { try { return fs.readFileSync(path.join(WEB, f), 'utf8'); } catch (e) { return ''; } };
const esc = s => String(s).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

module.exports = async ok => {
  const files = fs.readdirSync(WEB).filter(f => /^play.*\.js$/.test(f) || f === 'modelmon-core.js').sort();

  /* each module must at least compile: a stray bracket in one game would take the whole Play tab down */
  const broken = [];
  for (const f of files) {
    try { new vm.Script(read(f), { filename: f }); } catch (e) { broken.push(f + ': ' + e.message); }
  }
  ok('games: every Play module is valid JavaScript', broken.length === 0, broken.join(' | '));

  /* a game can be added three ways, and its id must be unique across all of them */
  const ids = {}, who = {};
  for (const f of files) {
    const s = read(f);
    for (const m of s.matchAll(/\breg\(\s*'([^']+)'/g)) { (ids[m[1]] = ids[m[1]] || []).push(f); who[m[1]] = f; }
    for (const m of s.matchAll(/P\.games\[['"]([^'"]+)['"]\]\s*=/g)) { (ids[m[1]] = ids[m[1]] || []).push(f); who[m[1]] = f; }
    for (const m of s.matchAll(/P\.games\.([A-Za-z0-9_]+)\s*=/g)) { (ids[m[1]] = ids[m[1]] || []).push(f); who[m[1]] = f; }
  }
  const all = Object.keys(ids).sort();
  const dup = Object.entries(ids).filter(([, v]) => v.length > 1).map(([k, v]) => k + ' in ' + v.join('+'));
  ok('games: no game is registered twice', dup.length === 0, dup.join(', '));
  ok('games: the Play tab still has its games', all.length >= 45, all.length + ' registered');

  /* what the hub draws a card from, and what start() calls: a game without a mount cannot be played */
  const thin = [];
  for (const id of all) {
    const s = read(who[id]), i = esc(id);
    /* the strings may carry an escaped apostrophe ("Moundshroud's fleet"), so a plain [^']* would stop short */
    const q = "'((?:[^'\\\\]|\\\\.)*)'";
    const asReg = new RegExp("reg\\(\\s*'" + i + "'\\s*,\\s*" + q + "\\s*,\\s*" + q + "\\s*,\\s*" + q + "\\s*,\\s*(?:async\\s*)?(?:\\(|function)").exec(s);
    if (asReg) { if (!asReg[1] || !asReg[2] || !asReg[3]) thin.push(id + ' (name, icon or description)'); continue; }
    const obj = new RegExp("P\\.games(?:\\.|\\[['\"])" + i + "(?:['\"]\\])?\\s*=\\s*\\{([\\s\\S]{0,600})").exec(s);
    if (!obj) { thin.push(id + ' (not found where it is registered)'); continue; }
    if (!/name\s*:/.test(obj[1]) || !/\bmount\b/.test(obj[1])) thin.push(id + ' (name or mount)');
  }
  ok('games: every game brings a name, an icon, a description and a mount', thin.length === 0, thin.join(', '));

  // Large Emberwild worlds store terrain as palette-indexed columns. Losing an air
  // cell here would fill excavated rooms when reopening an old player's home.
  const expeditionContext = { A: {}, ls: { set() {}, get() { return ''; } } };
  vm.runInNewContext(read('emberwild-expedition.js'), expeditionContext);
  const expedition = expeditionContext.A.emberExpedition;
  const terrain = [[null, 'oak', 'copper'], ['rope', null, 'starstone']];
  const restored = expedition.decode(expedition.encode(terrain));
  ok('games: Emberwild terrain preserves air, buildings and seams', JSON.stringify(restored) === JSON.stringify(terrain));
  ok('games: Emberwild detects a storage write that did not persist', !expedition.write('test', { terrain }));

  /* the lazy loader: every file a tab asks for must exist, or that tab fails the first time it is opened */
  const lazy = read('lazy.js');
  const asked = [...new Set((lazy.match(/'\/web\/[^']+'/g) || []).map(s => s.slice(1, -1)))];
  const missing = asked.filter(p => !fs.existsSync(path.join(ROOT, p.replace(/^\//, '').replace(/\//g, path.sep))));
  ok('games: every script the lazy loader asks for exists', missing.length === 0, missing.join(', '));
  ok('games: the lazy loader still names the Play tab scripts', /play:\s*\[[^\]]*play-g4\.js/.test(lazy) && asked.length > 40, asked.length + ' scripts');
};

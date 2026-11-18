// The diadem logo, the Converter's kept files and the TV tab's extra channel lists.
const path = require('path'), fs = require('fs'), os = require('os');

module.exports = async ok => {
  const root = path.join(__dirname, '..'), rd = f => fs.readFileSync(path.join(root, f), 'utf8');
  /* logo */
  const svg = rd('web/logo.svg'), idx = rd('web/index.html');
  ok('logo: the original crown is back and the diadem is gone, in every copy', /M45 40l-3-15/.test(svg) && (idx.match(/M45 40l-3-15/g) || []).length === 2 && !/translate(91.4 41.2)/.test(svg + idx) && !/scale(1.1)/.test(svg + idx));
  const png = fs.readFileSync(path.join(root, 'web/logo-256.png')), ico = fs.readFileSync(path.join(root, 'web/moundshroud.ico'));
  ok('logo: the PNG and tray icon files are real images', png[0] === 0x89 && png.readUInt32BE(16) === 256 && ico.readUInt16LE(2) === 1 && ico.readUInt16LE(4) >= 3);

  /* converter library, in a folder of its own */
  const C = require(path.join(root, 'lib', 'convlib.js'));
  const dirFile = C.DIR; let ok1 = false, ok2 = false, ok3 = false, ok4 = false;
  const before = fs.existsSync(path.join(dirFile, 'index.json')) ? fs.readFileSync(path.join(dirFile, 'index.json')) : null;
  try {
    const it = C.create({ name: 'Zz test.jpg', origName: 'Zz test.png', to: 'jpg' }); C.put(it.id, 'out', Buffer.from('converted')); C.put(it.id, 'orig', Buffer.from('original bytes'));
    const f = C.folder({ name: 'Zz folder' }); C.move([it.id], f.created);
    let L = C.list(), x = L.items.find(i => i.id === it.id);
    ok1 = !!x && x.folder === f.created && x.hasOrig && x.size === 9 && x.osize === 14;
    const r = C.rename(it.id, 'Zz renamed'); x = r.items.find(i => i.id === it.id); ok2 = x.name === 'Zz renamed.jpg';
    ok3 = !!C.put(it.id, 'nope', Buffer.from('x')).error && !!C.putFrom(it.id, path.join(os.tmpdir(), 'x.txt')).error && !!C.create({ name: '' }).error;
    C.folder({ remove: f.created }); C.remove([it.id]); L = C.list(); ok4 = !L.items.some(i => i.id === it.id) && !fs.existsSync(path.join(dirFile, it.id));
  } catch (e) { }
  if (before) fs.writeFileSync(path.join(dirFile, 'index.json'), before);
  ok('converter: a kept file has its original, its folder and its size', ok1);
  ok('converter: renaming keeps the file type', ok2);
  ok('converter: only the converted and original parts can be written, and only LibreOffice’s own output can be copied in', ok3);
  ok('converter: deleting removes the kept files from the PC', ok4);
  const cv = rd('web/js/converter.js'), srv = rd('server.js');
  ok('converter: nothing opens another program', !/api\/office\/open/.test(cv));
  ok('converter: changes to kept files need POST', /req\.method === 'POST' && \/\^\\\/api\\\/convlib\\\/\(new\|from\|rename\|move\|remove\|folder\)\$\//.test(srv) && /url === '\/api\/convlib\/put' && req\.method === 'POST'/.test(srv));

  /* TV: more channels */
  const T = require(path.join(root, 'lib', 'tv.js'));
  ok('tv: 25 checked channel lists with plain names, all from iptv-org or Free-TV', T.SOURCES.length >= 25 && T.SOURCES.every(s => /^https:\/\/(iptv-org\.github\.io\/iptv\/|raw\.githubusercontent\.com\/Free-TV\/IPTV\/)/.test(s.url) && /^\S+ [A-Z]/u.test(s.name)));
  const ch = T.parseChannels('#EXTM3U\n#EXTINF:-1 group-title="General;News",Euronews Albania Ⓨ\nhttps://www.youtube.com/@EuronewsAlbania/live\n#EXTINF:-1 group-title="Undefined",ABC News Albania Ⓣ\nhttps://x.example/abc.m3u8\n#EXTINF:-1 group-title="Italy",Rai 1 Ⓖ\nhttps://x.example/rai1.m3u8\n');
  ok('tv: Free-TV’s marks become details, and mixed categories pick the specific one', ch[0].name === 'Euronews Albania' && ch[0].group === 'News' && ch[0].yt === 1 && ch[1].name === 'ABC News Albania' && ch[1].group === '' && ch[2].geo === 1, JSON.stringify(ch.map(c => [c.name, c.group, c.yt, c.geo])));
  const Y = require(path.join(root, 'lib', 'youtube.js'));
  ok('tv: only YouTube addresses are looked up for live videos', typeof Y.live === 'function' && /Not a YouTube address/.test(rd('lib/youtube.js')));
};

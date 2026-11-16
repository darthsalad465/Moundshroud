// Godot inside Moundshroud: Studio's Play and Open buttons never start another program, the editor page is the only
// page that gets cross-origin isolation (its threads need it), it only serves its own known files, and saving back
// keeps to the project's text files.
const path = require('path'), fs = require('fs');

module.exports = async ok => {
  const root = path.join(__dirname, '..'), rd = f => fs.readFileSync(path.join(root, f), 'utf8');
  const sg = rd('web/js/studio-godot.js'), srv = rd('server.js'), ed = rd('web/godot-editor.html');
  ok('godot: Studio never asks for a Godot window (Play and Open stay in the app)', !/api\/godot\/launch/.test(sg) && /location\.href = '\/godot-editor\/\?p='/.test(sg) && /\/api\/godot\/web\//.test(sg));
  const route = srv.slice(srv.indexOf("url.startsWith('/godot-editor/')"), srv.indexOf('/* a Godot game ported to the Arcade'));
  ok('godot: only the editor page is cross-origin isolated', /Cross-Origin-Embedder-Policy', 'require-corp'/.test(route) && (srv.match(/Cross-Origin-Embedder-Policy/g) || []).length === 1);
  ok('godot: the editor page serves only its own known files', /if \(!\(rel in GE\)\)/.test(route) && !/\.\.\//.test(route));
  ok('godot: saving back keeps to text files and skips the exported copy and Godot caches', /const KEEP = \/\\\.\(godot\|gd\|tscn/.test(ed) && /!\/\^\(web\|\\\.godot\)\\\//.test(ed));
  ok('godot: the editor keeps the server awake and comes back to Studio', /setInterval\(ping, 60000\)/.test(ed) && /go=studio-godot/.test(ed) && /gp\.get\('go'\) === 'studio-godot'/.test(rd('web/js/main.js')));
  ok('godot: the exported copy is hidden from Godot inside the project', /'\.gdignore'/.test(rd('lib/godot.js')));
  ok('godot: the guide and the tour explain it', /id: 'godot'/.test(rd('web/js/guide.js')) && /Game Studio \(Godot\)/.test(rd('web/js/tutorial.js')));
};

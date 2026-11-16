// The patch engine (web/js/patch.js): a fix is a small edit to the code the AI already wrote, not a new copy of it.
// The module is loaded in a sandbox, so the parsing and the matching are tested without a model.
const fs = require('fs'), path = require('path'), vm = require('vm');

module.exports = async ok => {
  const root = path.join(__dirname, '..'), read = f => fs.readFileSync(path.join(root, f), 'utf8');
  const A = {};
  vm.runInNewContext(read('web/js/patch.js'), { A, console, JSON, RegExp });
  const P = A.patch;
  ok('patch: the engine is there', P && typeof P.parse === 'function' && typeof P.apply === 'function' && typeof P.applyFiles === 'function');

  /* ---------- reading the edits out of a reply ---------- */
  const one = P.parse('{"edits":[{"find":"a = 1","replace":"a = 2"}]}');
  ok('patch: a JSON object with edits is read', one && one.length === 1 && one[0].find === 'a = 1' && one[0].replace === 'a = 2');
  const fenced = P.parse('Here you go:\n```json\n{"edits":[{"find":"x()","replace":"y()"}]}\n```\nDone.');
  ok('patch: a fenced JSON answer is read', fenced && fenced.length === 1 && fenced[0].replace === 'y()');
  const bare = P.parse('[{"find":"one","replace":"two"},{"find":"three","replace":"four"}]');
  ok('patch: a bare JSON array is read', bare && bare.length === 2 && bare[1].find === 'three');
  const sloppy = P.parse('{"edits":[{"find":"p","replace":"q",},]}');
  ok('patch: a trailing comma does not throw the answer away', sloppy && sloppy.length === 1 && sloppy[0].replace === 'q');
  const single = P.parse('{"find":"k","replace":"v"}');
  ok('patch: a single edit without the list is read', single && single.length === 1 && single[0].find === 'k');
  ok('patch: a reply with no edits is not an edit list', P.parse('I could not see anything wrong with it.') === null);
  ok('patch: an empty edit list is not a patch', (P.parse('{"edits":[]}') || []).length === 0);
  const blocks = P.parse('=== FIND ===\nconst a = 1;\n=== REPLACE ===\nconst a = 2;');
  ok('patch: FIND/REPLACE blocks are read when the model cannot hold JSON together', blocks && blocks.length === 1 && blocks[0].find === 'const a = 1;' && blocks[0].replace === 'const a = 2;');

  /* ---------- putting an edit into the file ---------- */
  const src = '<html>\n<body>\n  <script>\n    var score = 0;\n    draw();\n  </script>\n</body>\n</html>';
  const exact = P.apply(src, [{ find: 'var score = 0;', replace: 'var score = 10;' }]);
  ok('patch: an exact find is replaced once', exact.applied === 1 && /var score = 10;/.test(exact.text) && exact.text.length === src.length + 1);
  ok('patch: the rest of the file is untouched', exact.text.replace('var score = 10;', 'var score = 0;') === src);

  const reindented = P.apply(src, [{ find: 'var score = 0;\n    draw();', replace: 'var score = 0;\n    update();\n    draw();' }]);
  ok('patch: an edit whose indentation is off still lands', reindented.applied === 1 && /update\(\);/.test(reindented.text));

  const spaced = P.apply(src, [{ find: 'var   score   =  0;', replace: 'var score = 99;' }]);
  ok('patch: an edit whose spacing is off still lands', spaced.applied === 1 && /var score = 99;/.test(spaced.text) && !/var   score/.test(spaced.text));

  const wrong = P.apply(src, [{ find: 'function nothere() { }', replace: 'x' }]);
  ok('patch: an edit that does not fit is skipped, never guessed at', wrong.applied === 0 && wrong.missed.length === 1 && wrong.text === src);

  const multi = P.apply(src, [{ find: 'var score = 0;', replace: 'var score = 5;' }, { find: 'draw();', replace: 'tick();' }, { find: 'nope', replace: 'x' }]);
  ok('patch: the edits that fit are applied in order and the rest reported', multi.applied === 2 && multi.missed.length === 1 && /var score = 5;/.test(multi.text) && /tick\(\);/.test(multi.text));

  const empty = P.apply(src, [{ find: 'draw();', replace: '' }]);
  ok('patch: an edit can delete a line', empty.applied === 1 && !/draw\(\);/.test(empty.text));

  /* ---------- a project of files ---------- */
  const files = { 'project.godot': '[application]\nconfig/name="X"', 'main.gd': 'extends Node2D\nfunc _ready():\n\tprint("hi")' };
  const proj = P.applyFiles(files, [{ file: 'main.gd', find: 'print("hi")', replace: 'print("bye")' }, { file: 'project.godot', find: 'config/name="X"', replace: 'config/name="Y"' }]);
  ok('patch: a multi-file project takes one edit per file', proj.changed.length === 2 && /bye/.test(proj.files['main.gd']) && /"Y"/.test(proj.files['project.godot']));
  ok('patch: files that were not edited keep their content', proj.files['project.godot'] && files['main.gd'].startsWith('extends Node2D'));
  const res = P.applyFiles(files, [{ file: 'res://main.gd', find: 'extends Node2D', replace: 'extends Node' }]);
  ok('patch: res:// is dropped from a file name', res.changed[0] === 'main.gd' && res.files['main.gd'].startsWith('extends Node\n'));
  const nofile = P.applyFiles(files, [{ find: 'func _ready():', replace: 'func _ready() -> void:' }]);
  ok('patch: an edit with no file name goes to the file it fits', nofile.changed.length === 1 && nofile.changed[0] === 'main.gd');
  const badfile = P.applyFiles(files, [{ file: 'nope.gd', find: 'x', replace: 'y' }]);
  ok('patch: an edit for a file that is not there is skipped', badfile.changed.length === 0 && badfile.missed.length === 1);

  /* ---------- where it is wired in ---------- */
  const html = read('web/index.html'), gm = read('web/js/studio-games.js'), gd = read('web/js/studio-godot.js');
  ok('patch: the engine is loaded by the app', /web\/js\/patch\.js/.test(html));
  ok('game maker: a change or a fix is patched before the file is written again', gm.indexOf('patchFix(text, t0, op)') > 0 && gm.indexOf('patchFix(text, t0, op)') < gm.indexOf('const msgs = [{ role: \'system\', content: SYS }]'));
  ok('game maker: the AI is told not to rewrite the game', /Do NOT rewrite it, do NOT repeat it/.test(gm));
  ok('game maker: a bug fix sends the error, not a new game brief', /Find the cause in that code and fix it\./.test(gm));
  ok('game maker: the fallback says the file was rewritten instead of patched', /rewrote the file instead of patching it/.test(gm));
  ok('game studio: a change is patched before the project is written again', gd.indexOf('patchFix(text, files, t0)') > 0 && gd.indexOf('patchFix(text, files, t0)') < gd.indexOf('const out = extract(await ask(msgs'));
  ok('game studio: the AI is told not to rewrite the project', /Do NOT rewrite the project and do NOT repeat whole files/.test(gd));
  ok('game studio: only the files that changed are saved', /files: res\.changed\.map\(p => \(\{ path: p, content: res\.files\[p\] \}\)\)/.test(gd));
  ok('game studio: the fallback says the project was rewritten instead of patched', /rewrote the project instead of patching it/.test(gd));
};

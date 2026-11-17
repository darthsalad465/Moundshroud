// Editing code yourself (Game maker, Godot), line numbers on code everywhere, and YouTube downloads with yt-dlp.
const path = require('path'), fs = require('fs'), vm = require('vm');

module.exports = async ok => {
  const root = path.join(__dirname, '..'), rd = f => fs.readFileSync(path.join(root, f), 'utf8');
  const gm = rd('web/js/studio-games.js'), gd = rd('web/js/studio-godot.js'), cv = rd('web/js/codeview.js');
  ok('code: the Game maker code is an editor with Run my code, and your edits can be undone', /<textarea class=\\?"gmk-src\\?" id=\\?"gmsrc\\?" data-code/.test(gm) && /gmrun/.test(gm) && /cur\.prev = \(cur\.prev \|\| \[\]\)\.concat/.test(gm.slice(gm.indexOf('function applyCode'))));
  ok('code: Godot files can be changed and saved, and only text project files', /<textarea class=\\?"god-ed\\?" id=\\?"gdcode\\?" data-code/.test(gd) && /EDITABLE = \/\\\.\(godot\|gd\|tscn/.test(gd) && /files: dirty\.map\(t => \(\{ path: t\.path, content: t\.text \}\)\)/.test(gd));
  /* core.js still comes before codeview.js; other scripts (the lazy tab loader, chat) may sit between them now */
  const idxHtml = rd('web/index.html'), coreAt = idxHtml.indexOf('/web/js/core.js'), cvAt = idxHtml.indexOf('/web/js/codeview.js');
  ok('code: line numbers load before the pages and cover chat code, lessons, Godot, the Game maker and agent diffs', coreAt > 0 && cvAt > coreAt && /pre > code/.test(cv) && /textarea\.cl-ed/.test(cv) && /pre\.agdiff/.test(cv), coreAt + ' / ' + cvAt);
  /* Today and Chat are two pages: Chat must be loaded at start and its page must not be switched on in the markup */
  ok('tabs: Today and Chat open as two separate pages, never both at once', /id="p-home"/.test(idxHtml) && /<section class="panel" id="p-chat">/.test(idxHtml) && /chat\.js"><\/script>/.test(idxHtml) && /querySelectorAll\('section\.panel'\)/.test(rd('web/js/core.js')) && /A\.buildNav\(\); A\.navMark\(\)/.test(rd('web/js/lazy.js')));
  /* the counting rule: a final newline is not an extra line */
  const ctx = { window: {}, document: { body: null, addEventListener() { } }, MutationObserver: function () { this.observe = () => { }; }, HTMLTextAreaElement: function () { }, setTimeout };
  ctx.HTMLTextAreaElement.prototype = {}; Object.defineProperty(ctx.HTMLTextAreaElement.prototype, 'value', { get() { return ''; }, set() { }, configurable: true });
  vm.runInNewContext(cv, ctx); const n = ctx.window.CodeView.count;
  ok('code: lines are counted the way an editor shows them', n('a') === 1 && n('a\nb') === 2 && n('a\nb\n') === 2 && n('') === 1);

  const Y = require(path.join(root, 'lib', 'ytdl.js'));
  const a = Y.args('dQw4w9WgXcQ', 'split', 'C:/x', 'C:/ff.exe');
  ok('downloads: yt-dlp gets only a YouTube address built from a video id, after --', a[a.length - 2] === '--' && a[a.length - 1] === 'https://www.youtube.com/watch?v=dQw4w9WgXcQ' && a.includes('--ignore-config') && a.includes('--no-playlist'));
  ok('downloads: the four choices are whole, picture and sound apart, sound only and picture only', Y.FORMATS.both.f.includes('+') && Y.FORMATS.split.f.includes(',') && Y.FORMATS.audio.extra.includes('mp3') && !Y.FORMATS.video.f.includes('ba'));
  ok('downloads: anything but an 11-character video id is refused', !!Y.start({ vid: 'https://evil.example/x' }).error && !!Y.start({ vid: '--exec=calc' }).error);
  ok('downloads: files are only played or deleted inside the downloads folder', Y.inHome(path.join(Y.HOME, 'a', 'b.mp4')) && !Y.inHome(path.join(Y.HOME, '..', 'secret.txt')) && !Y.inHome('C:/Windows/win.ini'));
  ok('downloads: changes need POST', /req\.method === 'POST' && \/\^\\\/api\\\/tv\\\/dl\\\/\(start\|cancel\|folder\|move\|rename\|remove\)\$\//.test(rd('server.js')));
  ok('logo: Today shows a large copy of the logo', /td-logobox/.test(rd('web/js/today.js')) && /:not\(\.td-logobox\)/.test(rd('web/shroud.css')));
};

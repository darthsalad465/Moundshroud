// Notes are plain files in Documents\Assistant Notes. A note can hold anything, including malware, so the file it is
// saved as must never be something Windows runs on a double-click. These checks use a temporary Documents folder.
const fs = require('fs'), os = require('os'), path = require('path');

module.exports = async function (ok) {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'moundshroud-notes-'));
  fs.mkdirSync(path.join(tmp, 'Documents'));
  const oldProfile = process.env.USERPROFILE, oldHome = process.env.HOME;
  process.env.USERPROFILE = tmp; process.env.HOME = tmp;
  /* the search index is not what is being tested: keep it out of the app's data folder */
  const docsPath = require.resolve('../lib/docs'), storePath = require.resolve('../lib/store');
  const oldDocs = require.cache[docsPath], oldStore = require.cache[storePath];
  require.cache[docsPath] = { id: docsPath, filename: docsPath, loaded: true, exports: { indexNote() { }, removePath() { }, noteNeedsIndex() { return false; }, stats() { return null; } } };
  delete require.cache[storePath];
  const store = require(storePath);
  const NOTES = store.NOTES;
  try {
    ok('notes safety: notes are kept in the temporary Documents folder', path.resolve(NOTES) === path.resolve(tmp, 'Documents', 'Assistant Notes'), NOTES);

    /* a normal note is still a normal Markdown file */
    const plain = store.noteSave({ title: 'Quarterly report', content: '# Quarterly report\n\nNothing dangerous here.' });
    ok('notes safety: an ordinary note is saved as Markdown', !plain.error && /\.md$/i.test(plain.path) && fs.existsSync(plain.path), JSON.stringify(plain));
    ok('notes safety: an ordinary note is not marked inert', plain.inert === false, JSON.stringify(plain));

    /* every name Windows would execute or open as active content is written as inert text */
    const HOSTILE = ['exe', 'com', 'scr', 'pif', 'msi', 'lnk', 'url', 'reg', 'hta', 'bat', 'cmd', 'ps1', 'vbs', 'vbe', 'js', 'jse', 'wsf', 'wsh', 'pyw', 'cpl', 'jar', 'chm', 'msc', 'html', 'htm', 'xhtml', 'svg', 'xml', 'docm', 'xlsm', 'pptm'];
    const bad = [];
    for (const ext of HOSTILE) {
      const id = 'dropper.' + ext, content = 'rm -rf / && powershell -enc ZQBjAGgAbwA=';
      const r = store.noteSave({ id, content });
      if (r.error) { bad.push(id + ': ' + r.error); continue; }
      if (!/\.txt$/i.test(r.path)) { bad.push(id + ' -> ' + r.path); continue; }
      if (fs.existsSync(path.join(NOTES, id))) { bad.push(id + ' exists as a real ' + ext); continue; }
      if (!fs.existsSync(r.path)) { bad.push(id + ' file missing'); continue; }
      if (fs.readFileSync(r.path, 'utf8') !== content) { bad.push(id + ' content changed'); continue; }
      if (!r.inert) { bad.push(id + ' not marked inert'); continue; }
    }
    ok('notes safety: a note named like a program is saved as inert text, never as that program', bad.length === 0, bad.slice(0, 4).join(' | '));

    /* reading it back keeps the name, the content and the inert flag */
    const back = store.noteGet('dropper.bat');
    ok('notes safety: an inert note keeps its exact content', !!back && back.content === 'rm -rf / && powershell -enc ZQBjAGgAbwA=', JSON.stringify(back && back.content));
    ok('notes safety: opening an inert note reports it as inert', !!back && back.inert === true && /\.bat\.txt$/i.test(back.path), JSON.stringify(back));

    /* the list shows it once, as a code-style note, not as two notes */
    const listed = store.notesList();
    const droppers = listed.filter(n => n.id === 'dropper.bat');
    ok('notes safety: an inert note is listed exactly once under its real name', droppers.length === 1 && droppers[0].inert === true, JSON.stringify(droppers));

    /* renaming a harmless note to an executable name also lands in inert text */
    const before = store.noteSave({ id: 'shopping list', content: '# Shopping list\n\nMilk.' });
    const renamed = store.noteRename('shopping list', 'update.bat');
    ok('notes safety: renaming a note to .bat produces inert text', !renamed.error && /\.bat\.txt$/i.test(renamed.path || '') && !fs.existsSync(path.join(NOTES, 'update.bat')), JSON.stringify(renamed));
    ok('notes safety: the renamed note keeps its text', !!renamed.content && /Milk/.test(renamed.content));

    /* names cannot climb out of the notes folder, and Windows device names cannot be used */
    const escape = store.noteSave({ id: '../../evil', content: 'x' });
    ok('notes safety: a note id cannot leave the notes folder', !!escape.error && !fs.existsSync(path.join(tmp, 'evil.md')) && !fs.existsSync(path.join(tmp, 'Documents', 'evil.md')), JSON.stringify(escape));
    const tricky = store.noteSave({ title: '../../evil title', content: 'x' });
    ok('notes safety: a title with path separators stays inside the notes folder', !tricky.error && path.resolve(tricky.path).indexOf(path.resolve(NOTES) + path.sep) === 0, tricky.error || tricky.path);
    const device = store.noteSave({ title: 'CON', content: 'x' });
    ok('notes safety: a Windows device name is never used as a file name', !device.error && /^_/.test(device.id) && path.resolve(device.path).indexOf(path.resolve(NOTES) + path.sep) === 0, JSON.stringify(device));

    /* a code note Windows cannot run keeps its own extension, so the Notes tab can still run it in the sandbox */
    const py = store.noteSave({ id: 'hello.py', content: 'print("hi")' });
    ok('notes safety: a harmless code note keeps its .py file', !py.error && /\.py$/.test(py.path) && fs.existsSync(py.path) && py.inert === false, JSON.stringify(py));

    /* a note saved by an older version under an executable name is moved to inert text when the list is read */
    fs.writeFileSync(path.join(NOTES, 'legacy.js'), 'alert(1)');
    const healed = store.notesList().filter(n => n.id === 'legacy.js');
    ok('notes safety: an older .js note is moved to inert text', healed.length === 1 && healed[0].inert === true && !fs.existsSync(path.join(NOTES, 'legacy.js')) && fs.existsSync(path.join(NOTES, 'legacy.js.txt')), JSON.stringify(healed));

    /* deleting removes the inert file and leaves nothing executable behind */
    store.noteDelete('dropper.js');
    ok('notes safety: deleting an inert note removes its file', !fs.existsSync(path.join(NOTES, 'dropper.js.txt')) && !fs.existsSync(path.join(NOTES, 'dropper.js')));
  } finally {
    try { fs.rmSync(tmp, { recursive: true, force: true }); } catch (e) { }
    if (oldProfile === undefined) delete process.env.USERPROFILE; else process.env.USERPROFILE = oldProfile;
    if (oldHome === undefined) delete process.env.HOME; else process.env.HOME = oldHome;
    if (oldDocs) require.cache[docsPath] = oldDocs; else delete require.cache[docsPath];
    if (oldStore) require.cache[storePath] = oldStore; else delete require.cache[storePath];
  }
};

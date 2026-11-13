// Bible Expert (lib/bible.js): passage search over plain-text files in data\bible, and its Chat tab wiring.
const fs = require('fs'), os = require('os'), path = require('path');
module.exports = async function (ok) {
  console.log('bible expert');
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'bible-test-')), bd = path.join(dir, 'bible'); fs.mkdirSync(bd);
  const sample = 'Title: Sample Douay\n\n*** START OF THE PROJECT GUTENBERG EBOOK SAMPLE ***\n\nGen 1:1 In the beginning God created heaven, and earth.\nGen 1:2 And the earth was void and empty, and darkness was upon the face of the deep.\n\nJohn 3:16 For God so loved the world, as to give his only begotten Son: that whosoever believeth in him, may not perish, but have life everlasting.\n\nBOOK TWO\n\nAugustine wrote that our heart is restless until it rests in thee, O God, in the Confessions.\n\n*** END OF THE PROJECT GUTENBERG EBOOK SAMPLE ***\nlicence words that are not part of the book: zebracrossing\n';
  fs.writeFileSync(path.join(bd, 'sample.txt'), sample);
  try {
    const B = require('../lib/bible').create(dir), s = B.status();
    ok('bible: one text is loaded and titled from its header', s.books.length === 1 && s.books[0].title === 'Sample Douay' && s.passages >= 1, JSON.stringify(s.books));
    const r = B.search('God so loved the world', 3);
    ok('bible: a verse is found by its words', r.length > 0 && /so loved the world/.test(r[0].text), JSON.stringify(r[0]));
    ok('bible: a passage is cited by the verses it holds', r.length > 0 && /John 3:16/.test(r[0].where), r[0] && r[0].where);
    ok('bible: the Gutenberg licence text is dropped', B.search('zebracrossing', 3).length === 0);
    ok('bible: an empty or stop-word question finds nothing', B.search('', 3).length === 0 && B.search('the of and', 3).length === 0);
    fs.writeFileSync(path.join(bd, 'two.txt'), 'Title: Second\n\nThe Eucharist is the source and summit of the Christian life, says the Catechism.\n');
    ok('bible: a file added later is picked up without a restart', B.search('Eucharist source summit', 3).some(x => x.title === 'Second'));
    ok('bible: no folder means an empty library, not an error', require('../lib/bible').create(path.join(dir, 'nowhere')).search('God', 3).length === 0);
  } catch (e) { ok('bible: the module works', false, e.message); }
  try { fs.rmSync(dir, { recursive: true, force: true }); } catch (e) { }
  const rd = f => fs.readFileSync(path.join(__dirname, '..', f), 'utf8');
  const html = rd('web/index.html'), css = rd('web/style.css'), agent = rd('web/js/agent.js'), srv = rd('server.js');
  ok('bible: the tab button, pane and script are in the page', /data-ct="bible"/.test(html) && /id="biblepane"/.test(html) && /js\/bible\.js/.test(html));
  ok('bible: the tab switcher and style rules know the pane', /bible: \{ el: document\.getElementById\('biblepane'\)/.test(agent) && /mode-bible>#biblepane\{?|mode-bible>#biblepane/.test(css));
  ok('bible: the routes are read-only (search is POST, status is GET)', /url === '\/api\/bible\/status'\) return/.test(srv) && /url === '\/api\/bible\/search' && req\.method === 'POST'/.test(srv));
};

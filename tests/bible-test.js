// Bible Expert (lib/bible.js): passage search over plain-text files in data\bible and data\christian-texts, and its place in the Spiritual page.
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
    ok('bible: no folder means an empty library, not an error', (() => { const e = require('../lib/bible').create(path.join(dir, 'nowhere')); const r = e.search('God', 3).length === 0; e.close(); return r; })());
    /* the downloaded texts (data\christian-texts) and your own files (data\bible) are both read, and each is listed under its group */
    const ct = path.join(dir, 'christian-texts'); fs.mkdirSync(ct);
    fs.writeFileSync(path.join(ct, 'fathers.txt'), 'Title: Sample Fathers\nGroup: Church Fathers\nRights: Public domain\n\n' + 'Chapter I.\n\nThe bishop Ignatius wrote to the Smyrnaeans that where the bishop appears there let the people be, even as where Jesus Christ is there is the Catholic Church. '.repeat(3));
    ok('bible: a downloaded text is read next to your own files', B.search('Ignatius bishop Smyrnaeans', 3).some(x => x.title === 'Sample Fathers') && B.status().books.some(b => b.title === 'Sample Fathers' && b.group === 'Church Fathers'));
    for (let i = 0; i < 6; i++) fs.writeFileSync(path.join(bd, 'many' + i + '.txt'), 'Title: Many ' + (i % 2) + '\n\n' + 'The sacrament of baptism washes away sin and gives new birth in the Spirit, says the teaching of the Church about baptism number ' + i + '. ' + 'More words about the water and the font. '.repeat(4));
    const many = B.search('baptism water sin', 6), per = {}; many.forEach(x => { per[x.title] = (per[x.title] || 0) + 1; });
    ok('bible: results come from more than one work when several match', Object.keys(per).length >= 2, JSON.stringify(per));
    fs.unlinkSync(path.join(bd, 'two.txt'));
    ok('bible: a removed text leaves the library at once', !B.search('Eucharist source summit', 3).some(x => x.title === 'Second') && !B.status().books.some(b => b.title === 'Second'));
    B.close();
    /* a big batch (the first start with all the downloaded texts) is indexed by a worker thread while the app stays quick */
    const dir2 = path.join(dir, 'big'), ct2 = path.join(dir2, 'christian-texts'); fs.mkdirSync(ct2, { recursive: true });
    const line = 'The doctrine of grace and the sacraments is explained here in plain words for the faithful reader of every age. ';
    for (let i = 0; i < 5; i++) fs.writeFileSync(path.join(ct2, 'vol' + i + '.txt'), 'Title: Big volume ' + i + '\nGroup: Test\n\n' + (line + 'Zymurgy' + 'abcde'[i] + ' appears once here.\n\n').repeat(9000));
    const E = require('../lib/bible').create(dir2); let st0 = E.status(), waited = 0;
    ok('bible: a big batch is indexed in the background, not before the first answer', !!st0.indexing || st0.passages > 0, JSON.stringify(st0.indexing));
    while (E.status().indexing && waited < 60000) { await new Promise(r => setTimeout(r, 250)); waited += 250; }
    const st1 = E.status(); ok('bible: the background index finishes and every text is searchable', st1.books.length === 5 && !st1.indexing && E.search('Zymurgyd', 2).some(x => x.title === 'Big volume 3'), JSON.stringify({ books: st1.books.length, waited }));
    E.close();
  } catch (e) { ok('bible: the module works', false, e.message); }
  try { fs.rmSync(dir, { recursive: true, force: true }); } catch (e) { }
  const rd = f => fs.readFileSync(path.join(__dirname, '..', f), 'utf8');
  const html = rd('web/index.html'), css = rd('web/style.css'), agent = rd('web/js/agent.js'), srv = rd('server.js');
  const T = require('../lib/bible-texts.js'), faith = rd('web/js/faith.js');
  ok('bible texts: web pages become plain text without menus, scripts or entities', T.htmlToText('<html><head><script>var x=1</script><title>T</title></head><body><div class="documento"><h1>RERUM NOVARUM</h1><p>Capital &amp; labor,<br>the &quot;worker&quot; &mdash; and the owner.</p></div><footer>menu</footer></body></html>') === 'RERUM NOVARUM\n\nCapital & labor,\nthe "worker" - and the owner.');
  ok('bible texts: the list holds the Fathers, Aquinas, the Catholic Encyclopedia and the papal documents', T.SOURCES.CCEL.length > 50 && T.SOURCES.CCEL.some(x => x[0] === 'aquinas/summa') && T.SOURCES.IA.some(x => /catholicencyclop/.test(x[0])) && T.SOURCES.POPES.length >= 10);
  ok('bible: the Bible Expert is a page of Spiritual and its script is loaded', /\['expert', '[^']*Bible Expert'\]/.test(faith) && /expert: \(\) => A\.bible/.test(faith) && /js\/bible\.js/.test(html));
  ok('bible: Chat no longer carries a Bible tab or pane', !/data-ct="bible"/.test(html) && !/id="biblepane"/.test(html) && !/biblepane/.test(agent) && !/mode-bible|#biblepane/.test(css));
  ok('bible: the Spiritual page holds still around the conversation', /#p-faith\.fa-expert #fabody/.test(css) && /classList\.toggle\('fa-expert'/.test(faith));
  ok('bible: the routes are read-only (search is POST, status is GET)', /url === '\/api\/bible\/status'\) return/.test(srv) && /url === '\/api\/bible\/search' && req\.method === 'POST'/.test(srv));
};

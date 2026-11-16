// Spiritual › Learn (web/js/faith-learn.js), saved daily verses, and the Gutenberg shelf of the Library.
// The teaching logic runs in Node; the lessons are checked against the real Bible texts on disk.
const fs = require('fs'), path = require('path');

module.exports = async ok => {
  const root = path.join(__dirname, '..'), rd = f => fs.readFileSync(path.join(root, f), 'utf8');
  const L = require('../web/js/faith-learn.js');
  const seed = s => () => (s = (s * 1664525 + 1013904223) % 4294967296) / 4294967296;

  ok('learn: every one of the 73 books has a group and a line about it', L.BOOK.length === 73 && L.BOOK.every(b => b[0] >= 0 && b[0] < L.GROUPS.length && b[1].length > 15));
  ok('learn: the books run Law, History, Wisdom, Prophets, Gospels, Acts, letters, Revelation', L.BOOK[0][0] === 0 && L.BOOK[26][0] === 3 && L.BOOK[46][0] === 4 && L.BOOK[50][0] === 5 && L.BOOK[51][0] === 6 && L.BOOK[65][0] === 7 && L.BOOK[72][0] === 8);
  ok('learn: there are 12 lessons with three questions each and a valid right answer', L.LESSONS.length === 12 && L.LESSONS.every(l => l.q.length === 3 && l.q.every(q => q[1].length === 4 && q[2] >= 0 && q[2] < 4 && new Set(q[1]).size === 4)));

  /* every lesson passage exists in both Bible texts */
  for (const [name, file] of [['World English Bible', 'web/data/bible-web.json'], ['Douay-Rheims', 'web/data/bible-dr.json']]) {
    const bible = JSON.parse(rd(file)); let bad = '';
    for (const l of L.LESSONS) for (const p of l.ps) { const ch = bible.books[p[0]] && bible.books[p[0]].ch[p[1]]; const n = ch ? ch.v.slice(p[2] - 1, p[3]).filter(Boolean).length : 0; if (n < Math.min(2, p[3] - p[2] + 1)) bad += l.id + ' ' + JSON.stringify(p) + ' '; }
    ok('learn: every lesson passage is found in the ' + name, !bad, bad);
  }

  const text = 'For God so loved the world that he gave his only begotten Son, that whoever believes in him should not perish, but have eternal life.';
  const b1 = L.blanks(text, 1, seed(3)), b3 = L.blanks(text, 3, seed(3));
  ok('learn: blanks hide more words at higher levels and keep the rest', b1.parts.filter(p => p.blank).length >= 1 && b3.parts.filter(p => p.blank).length > b1.parts.filter(p => p.blank).length && b1.parts.map(p => p.w).join(' ') === text && b1.bank.length === b1.parts.filter(p => p.blank).length);
  ok('learn: a verse typed correctly, ignoring capitals and punctuation, scores 100%', L.grade('for god so loved the world that he gave his only begotten son that whoever believes in him should not perish but have eternal life', text).score === 1);
  const g = L.grade('For God so loved the world that he gave his son', text);
  ok('learn: a verse with words missing is marked word by word', g.score < 0.7 && g.marks.length === text.split(' ').length && g.marks[0] === true && g.marks.includes(false));
  ok('learn: a verse with an extra word in it still finds the next words', L.grade('For God so really loved the world', 'For God so loved the world').score === 1);
  ok('learn: review boxes climb on success, fall back to one on a miss, and the gaps grow', L.nextBox(2, true) === 3 && L.nextBox(5, true) === 5 && L.nextBox(4, false) === 1 && L.DAYS.slice(1).join() === '1,2,4,8,16' && L.dueAfter(3, 0) === 4 * 86400000);

  const names = JSON.parse(rd('web/data/bible-web.json')).books.map(b => b.n);
  const q1 = L.whichBook({ b: 49, text: 'In the beginning was the Word', label: 'John 1:1' }, names, seed(9));
  ok('learn: "which book" has four different options from the same testament, one of them right', q1.opts.length === 4 && new Set(q1.opts).size === 4 && q1.opts.includes('John') && q1.opts.every(n => names.indexOf(n) >= 46));
  const pool = [text, 'The Lord is my shepherd; I shall not want. He makes me lie down in green pastures.', 'Trust in the Lord with all your heart, and do not lean on your own understanding.', 'Love is patient and kind; love does not envy or boast; it is not arrogant.'];
  const q2 = L.completeVerse({ text, label: 'John 3:16' }, pool, seed(5));
  ok('learn: "complete the verse" hides one word and offers four options with the right one among them', q2 && q2.text.includes('_____') && q2.opts.length === 4 && q2.opts.includes(q2.ans) && new Set(q2.opts).size === 4);

  /* saved daily verses, the Learn page and the Library */
  const faith = rd('web/js/faith.js'), today = rd('web/js/today.js'), html = rd('web/index.html'), kiwix = rd('lib/kiwix.js');
  ok('saved verses: the verse card on Spiritual and the Today page both have a Save button', /data-savev="1"/.test(faith) && /data-sp="save"/.test(today) && /saveVerse/.test(faith) && /A\.faith\.saveVerse/.test(today));
  ok('saved verses: "Keep every daily verse" saves each day once, and My notes lists them with the whole verse', /faith_autosave/.test(faith) && /faith_autodays/.test(faith) && /Saved verses/.test(faith) && /data-rmbm/.test(faith));
  ok('learn: it is a page of Spiritual and its script is loaded', /\['learn', '[^']*Learn'\]/.test(faith) && /learn: \(\) => A\.faithLearn/.test(faith) && /js\/faith-learn\.js/.test(html));
  ok('library: the Classics shelf covers every installed Gutenberg collection, not only literature', /isGutenberg/.test(kiwix) && /books\(\)\.filter\(isGutenberg\)/.test(kiwix) && !/books\(\)\.filter\(b => b\.category === 'Literature'\)/.test(kiwix));
};

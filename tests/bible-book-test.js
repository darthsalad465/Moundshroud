// The Bible as a book (web/js/bible-book.js): the King James text the reader opens, lined up with the other two
// versions book by book, and the places in the app that open it.
const fs = require('fs'), path = require('path');

module.exports = async function (ok) {
  console.log('bible as a book');
  const root = path.join(__dirname, '..'), rd = f => fs.readFileSync(path.join(root, f), 'utf8');
  const kjv = JSON.parse(rd('web/data/bible-kjv.json')), dr = JSON.parse(rd('web/data/bible-dr.json')), web = JSON.parse(rd('web/data/bible-web.json'));

  ok('bible book: the King James text has all 73 books, in the same order and under the same names as the Douay-Rheims',
    kjv.books.length === 73 && dr.books.length === 73 && web.books.length === 73 &&
    kjv.books.every((b, i) => b.n === dr.books[i].n),
    kjv.books.filter((b, i) => b.n !== dr.books[i].n).map(b => b.n).join(', '));

  ok('bible book: it is the King James Version, with the Apocrypha', /King James/.test(kjv.title) && /Apocrypha|Gutenberg/.test(kjv.source || ''), kjv.title);
  ok('bible book: the first book is Genesis and the last is the Apocalypse', kjv.books[0].n === 'Genesis' && kjv.books[72].n === 'Apocalypse', kjv.books[72].n);

  let empty = '', chapters = 0, verses = 0;
  kjv.books.forEach(b => {
    if (!b.ch.length) empty += b.n + ' ';
    b.ch.forEach(c => { chapters++; if (!c || !Array.isArray(c.v) || !c.v.filter(Boolean).length) empty += b.n + ' '; verses += (c.v || []).filter(Boolean).length; });
  });
  ok('bible book: every chapter has verses and there are no empty books', !empty, empty);
  /* the whole King James, Apocrypha included, as the reader counts it: 1,334 chapters and 35,063 verses */
  ok('bible book: the chapter and verse counts are the ones the King James has', chapters === 1334 && verses === 35063, chapters + ' chapters, ' + verses + ' verses');

  /* the reader moves chapter by chapter through one list of books, so the two texts must agree except where the
     King James really does differ (Job 42 against the Vulgate's 41, Machabees 16 against 15) */
  const differ = kjv.books.map((b, i) => b.ch.length !== dr.books[i].ch.length ? b.n + ' ' + b.ch.length + '/' + dr.books[i].ch.length : '').filter(Boolean);
  ok('bible book: chapter counts match the Douay-Rheims apart from the two books that differ',
    differ.length === 2 && /^Job 42\/41$/.test(differ[0]) && /^1 Machabees 16\/15$/.test(differ[1]), differ.join(', '));

  /* it is wired into the app where the reader looks for it */
  const html = rd('web/index.html'), faith = rd('web/js/faith.js'), book = rd('web/js/bible-book.js');
  ok('bible book: the page loads the reader and its style sheet', /bible-book\.js/.test(html) && /bible-book\.css/.test(html));
  ok('bible book: the reader can open all three versions from this PC',
    ['bible-kjv.json', 'bible-web.json', 'bible-dr.json'].every(f => book.includes('/web/data/' + f)));
  ok('bible book: the Spiritual Library and the Bible page both open it', (faith.match(/data-bible-book="1"/g) || []).length === 2 && /A\.bibleBook\.open/.test(faith));
  ok('bible book: the King James is a real choice in the Spiritual Bible, not only in the book',
    /value="kjv"/.test(faith) && /faith_tr/.test(faith) && /bible-kjv\.json/.test(faith));
  ok('bible book: the reader keeps one reading size and one place on this PC', /bbk_size/.test(book) && /bbk_pos/.test(book));
};

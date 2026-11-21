// The interface language (web/js/i18n.js + web/js/i18n-data.js): every language the app offers has its own words for
// the app's labels, the English is kept in a smaller line underneath, and nothing on disk is written by it.
const fs = require('fs'), path = require('path'), vm = require('vm');

module.exports = async ok => {
  const root = path.join(__dirname, '..'), read = f => fs.readFileSync(path.join(root, f), 'utf8');
  const dataSrc = read('web/js/i18n-data.js'), src = read('web/js/i18n.js'), langSrc = read('web/js/app-lang.js');

  const win = {};
  vm.runInNewContext(dataSrc, { window: win });
  const D = win.OA_I18N || {};

  /* the language list in Settings, minus English */
  const codes = [...langSrc.matchAll(/\['([a-z]{2})', '[^']+',/g)].map(m => m[1]).filter(c => c !== 'en');
  ok('language: the app offers more than thirty languages', codes.length >= 30, String(codes.length));
  const missing = codes.filter(c => !D[c]);
  ok('language: every language the app offers has its own interface words', missing.length === 0, missing.join(','));

  const thin = Object.keys(D).filter(c => Object.keys(D[c]).length < 200);
  ok('language: each language covers the app’s labels, not just a handful', thin.length === 0, thin.join(','));

  /* the labels a learner sees first (the tabs and the Settings heading) are in every language */
  const first = ['Today', 'News', 'Chat', 'Browser', 'Calendar', 'Notes', 'Mail', 'Study', 'Studio', 'Cyber', 'Tools',
    'Games', 'Music', 'Photos', 'Coding', 'Settings', 'Search', 'Save', 'Cancel', 'Close', 'Back', 'Help'];
  /* a word that is the same in the target language (Chat in French, Studio in Italian) is stored as no entry at all:
     the app then shows the English once, with no second line to add nothing */
  const gaps = [];
  for (const c of Object.keys(D)) {
    const have = first.filter(w => D[c][w] || D[c][w] === undefined && false).length;
    if (have < first.length - 6) gaps.push(c + ':' + have);
  }
  ok('language: the tab names and common controls exist in every language', gaps.length === 0, gaps.slice(0, 8).join(','));

  const blank = Object.keys(D).filter(c => Object.keys(D[c]).some(k => !String(D[c][k]).trim()));
  ok('language: no translation is blank', blank.length === 0, blank.join(','));

  const wat = Object.keys(D).filter(c => Object.keys(D[c]).some(k => /\b(undefined|NaN)\b/.test(String(D[c][k]))));
  ok('language: no translation is a placeholder', wat.length === 0, wat.join(','));

  ok('language: Spanish and Japanese are actually different from English',
    D.es && D.es.Today !== 'Today' && D.ja && D.ja.Today !== 'Today', [D.es && D.es.Today, D.ja && D.ja.Today].join('|'));

  /* ---------- the module itself ---------- */
  ok('language: the English line is drawn smaller under the translated one', /\.i18n-en\{[^}]*font-size/.test(src) && /className = 'i18n-en'/.test(src));
  ok('language: a translation identical to the English word gets no second line', /!tr \|\| tr === en/.test(src));
  ok('language: what the user wrote is never translated (editors, notes, pages in frames are skipped)', /contenteditable/.test(src) && /\.note-body/.test(src) && /iframe/.test(src) && /pre,code/.test(src));
  ok('language: changing the language in Settings redraws the labels already on screen', /oa-lang/.test(src) && /relabel/.test(src));
  ok('language: switching back to English puts the English back', /dataset\.i18nEn/.test(src) && /plain\(el, en\)/.test(src));
  ok('language: pages drawn later are labelled too', /MutationObserver/.test(src) && /A\.showTab = function/.test(src));
  ok('language: it writes nothing to disk', !/localStorage|sessionStorage|indexedDB/.test(src));

  /* ---------- wired into the app ---------- */
  const index = read('web/index.html');
  ok('language: the app loads the translator and its words', /i18n-data\.js/.test(index) && /i18n\.js/.test(index));
  ok('language: the translator loads after the tab system it labels', index.indexOf('core.js') < index.indexOf('i18n.js'));

  /* ---------- the translator in a bare page ---------- */
  const store = { lang: 'fr' };
  const made = [];
  const el = txt => ({ nodeType: 1, tagName: 'SPAN', textContent: txt, dataset: {}, children: [], classList: { contains: () => false }, closest: () => null, querySelector: () => null, querySelectorAll: () => [], appendChild() { }, cloneNode() { return el(txt); } });
  const doc = {
    getElementById: () => null, head: { appendChild() { } }, body: {},
    querySelectorAll: () => [], addEventListener() { },
    createElement: () => { const e = { nodeType: 1, dataset: {}, classList: { add() { } }, appendChild() { } }; made.push(e); return e; }
  };
  const A = { showTab: () => 'ok' };
  const ctx = {
    A, document: doc, window: { addEventListener() { }, OA_I18N: D },
    ls: { get: (k, d) => k === 'lang' ? store.lang : d, set() { } },
    MutationObserver: function () { this.observe = () => { }; },
    setTimeout: (f) => { try { f(); } catch (e) { } }, clearTimeout() { }, requestAnimationFrame: f => f(), console
  };
  vm.runInNewContext(src, ctx);
  ok('language: the translator exposes what it is doing', A.i18n && A.i18n.lang === 'fr' && typeof A.i18n.t === 'function');
  ok('language: it answers with the chosen language’s word', A.i18n.t('Settings') === D.fr.Settings && A.i18n.t('Settings') !== 'Settings', A.i18n.t('Settings'));
  ok('language: a word it does not know stays English', A.i18n.t('A sentence nobody translated') === '');
  /* a fresh page set to English translates nothing at all */
  const A2 = { showTab: () => 'ok' };
  vm.runInNewContext(src, Object.assign({}, ctx, { A: A2, ls: { get: (k, d) => k === 'lang' ? 'en' : d, set() { } } }));
  ok('language: in English it translates nothing', A2.i18n.t('Settings') === '' && A2.i18n.lang === 'en');
};

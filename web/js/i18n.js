// The interface in the chosen language (Settings › Voice & sound › Language), with the English kept underneath in a
// smaller line so nothing becomes unrecognisable. Only the app's own labels are translated — tab names, buttons, headings
// and settings — never what you wrote yourself, a book, or a page inside a frame. Translations are built into
// i18n-data.js; a string with no translation stays in English, and a translation identical to the English word
// (Studio in Italian, say) gets no second line because there would be nothing to add.
(() => {
  const P = A.i18n = { lang: 'en' };
  const data = window.OA_I18N || {};
  const CHROME = '#nav .nl, #nav .grp, .panel h1, .panel h2, .panel h3, .panel h4, .panel button, ' +
    '.panel .chip, .panel .tab, .panel label, .panel legend, .panel summary, .panel option, .panel th, .panel .hd b, ' +
    '.panel .big, .panel .grp, header button, header button span, header .chip, .hl, #dlg h3, #dlg button, #dlg label, ' +
    '#dlg option, #dlg summary, #dlg .grp';
  const NO = '[contenteditable=""],[contenteditable="true"],pre,code,article,iframe,.note-body,.ce-ta,#ne,.book,.reader,textarea';

  const cur = () => { try { const t = ls.get('lang', 'en') || 'en'; return data[t] ? t : 'en'; } catch (e) { return 'en'; } };
  P.lang = cur();
  P.t = s => { if (P.lang === 'en') return ''; const t = data[P.lang] || {}; return t[String(s)] || ''; };

  if (!document.getElementById('i18ncss')) {
    const st = document.createElement('style'); st.id = 'i18ncss';
    st.textContent = '.i18n-en{display:block;font-size:.72em;font-weight:400;line-height:1.15;opacity:.62;margin-top:1px;letter-spacing:0}' +
      '#nav .nl .i18n-en{font-size:9px;line-height:1;opacity:.55;margin-top:0}' +
      'button .i18n-en, .chip .i18n-en{display:inline-block;margin-left:6px;font-size:.78em;opacity:.6}';
    document.head.appendChild(st);
  }

  /* the element's own label, without the small English line we may have added */
  const own = el => {
    if (el.dataset && el.dataset.i18nEn) return el.dataset.i18nEn;
    const copy = el.cloneNode(true);
    copy.querySelectorAll('.i18n-en').forEach(x => x.remove());
    return copy.textContent.replace(/\s+/g, ' ').trim();
  };
  const plain = (el, en) => {
    if (el.querySelector('.i18n-en') || el.textContent.trim() !== en) {
      const keep = [...el.children].filter(c => iconOnly(c)).map(c => c.cloneNode(true));
      el.textContent = en;
      if (keep.length) el.prepend(...keep);
    }
    if (el.dataset) { delete el.dataset.i18nDone; el.dataset.i18nEn = en; }
  };
  /* an icon is a picture, not words: it is kept exactly as it is when the label around it is rewritten */
  const iconOnly = c => /^(svg|img|i)$/i.test(c.tagName) || (c.tagName === 'SPAN' && c.children.length > 0 && [...c.children].every(iconOnly));
  const paint = el => {
    if (!el || el.nodeType !== 1 || el.closest(NO)) return;
    const kids = [...el.children].filter(c => !c.classList.contains('i18n-en'));
    const icons = kids.filter(iconOnly);
    if (kids.length !== icons.length) return;          // markup we do not understand is left alone
    const en = own(el);
    if (!en || en.length > 90 || !/[a-z]/i.test(en)) return;
    if (!el.dataset.i18nEn) el.dataset.i18nEn = en;
    if (el.dataset.i18nDone === P.lang) return;
    const tr = P.lang === 'en' ? '' : P.t(en);
    if (!tr || tr === en) { plain(el, en); return; }
    const keep = icons.map(c => c.cloneNode(true));
    el.textContent = tr;
    if (keep.length) el.prepend(...keep);
    const small = document.createElement('small');
    small.className = 'i18n-en';
    /* the little English line is the words, not the emoji the translated line already shows */
    small.textContent = (en.replace(/^[^\p{L}\p{N}]+/u, '') || en);
    el.appendChild(small);
    el.dataset.i18nDone = P.lang;
    if (!el.title) el.title = tr + ' (' + en + ')';
  };

  P.apply = root => {
    try {
      /* in English there is nothing to add; only a page still carrying another language needs putting back */
      if (P.lang === 'en' && !document.querySelector('[data-i18n-done]')) return;
      const host = root && root.querySelectorAll ? root : document;
      host.querySelectorAll(CHROME).forEach(paint);
    } catch (e) { }
  };
  P.all = () => P.apply(document);

  /* the language changes in Settings: re-label every page, including the ones already drawn */
  const relabel = () => {
    const next = cur();
    if (next !== P.lang) {
      P.lang = next;
      document.querySelectorAll('[data-i18n-en]').forEach(el => plain(el, el.dataset.i18nEn));
    }
    P.all();
  };
  window.addEventListener('oa-lang', () => setTimeout(relabel, 0));

  /* pages are drawn as you go: label each one as it appears, and anything added later */
  try {
    const wrap = A.showTab;
    A.showTab = function (name) {
      const out = wrap.apply(this, arguments);
      setTimeout(() => P.all(), 40);
      setTimeout(() => P.all(), 450);
      return out;
    };
  } catch (e) { }
  try {
    let t = 0;
    new MutationObserver(() => { clearTimeout(t); t = setTimeout(() => P.all(), 200); })
      .observe(document.body, { childList: true, subtree: true });
  } catch (e) { }
  setTimeout(relabel, 80);
})();

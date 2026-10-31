// The Bible reader (shown from the Library tab, see library.js): look up any verse, passage, chapter or book the way an online Bible does (type "John 3:16", "Romans 8:28-39; Psalm 23", "Genesis",
// even words like "love your enemies"), or jump somewhere random: a verse, a chapter or a book. Uses the same two translations as the Spiritual tab.
(() => {
  /* A.bibleReader.render(host) is called by the Library tab */
  const esc2 = s => String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const SCOPES = [['all', 'Whole Bible', 0, 72], ['ot', 'Old Testament', 0, 45], ['nt', 'New Testament', 46, 72], ['gos', 'The Gospels', 46, 49], ['wis', 'Psalms and Proverbs', 20, 21], ['let', 'The Letters', 51, 71]];
  const css = '.pb-wrap{max-width:880px;margin:0 auto}.pb-card{background:var(--panel);border:1px solid var(--line);border-radius:14px;padding:14px 18px;margin:0 0 12px}.pb-ref{font-size:18px;font-weight:700}.pb-txt{font-family:Georgia,serif;line-height:1.85;white-space:pre-line}.pb-txt p{margin:0 0 .8em}.pb-txt sup{color:var(--acc);font-weight:700;font-size:.62em;margin:0 4px 0 2px;font-family:system-ui,sans-serif}.pb-txt .pb-hl{background:rgba(255,214,10,.28);border-radius:4px;padding:0 2px}.pb-txt .pb-dim{opacity:.62}.pb-note{font:italic .82em system-ui,sans-serif;color:var(--mute);border-left:3px solid var(--line);padding:2px 10px;margin:2px 0 8px 14px}.pb-chap{display:inline-block;min-width:34px;text-align:center;padding:5px 8px;margin:2px;border:1px solid var(--line);border-radius:8px;cursor:pointer;font-size:13px}.pb-chap:hover{border-color:var(--acc);background:var(--panel2)}.pb-chip{display:inline-block;padding:3px 10px;border:1px solid var(--line);border-radius:999px;margin:2px 4px 2px 0;font-size:12.5px;cursor:pointer}.pb-chip:hover{border-color:var(--acc)}.pb-row{display:flex;gap:8px;flex-wrap:wrap;align-items:center}';
  if (!document.getElementById('pbcss')) { const s = document.createElement('style'); s.id = 'pbcss'; s.textContent = css; document.head.appendChild(s); }
  const rd = (k, d) => { try { return JSON.parse(ls.get(k, JSON.stringify(d))); } catch (e) { return d; } };

  A.bibleReader = { render: b => {
    const F = A.faith; if (!F || !F.bible) { b.innerHTML = '<div class="scroll pad"><div class="card">The Bible texts are not available.</div></div>'; return; }
    b.innerHTML = '<div class="scroll pad" style="flex:1"><div class="pb-wrap"><h2 style="margin:0 0 4px">📖 Bible</h2><div class="mute small" style="margin-bottom:10px">Look up anything like an online Bible, or go somewhere at random. Everything is stored on this PC.</div><div class="mute">Loading the Bible...</div></div></div>'; F.getBible().then(() => init(b)).catch(() => { b.innerHTML = '<div class="scroll pad"><div class="card">The Bible could not be loaded.</div></div>'; });
  } };

  function init(body) {
    const F = A.faith, bib = () => F.bible(), books = () => bib().books, scopeId = () => ls.get('pb_scope', 'all');
    const st = { cards: [], last: '' }, trShort = () => F.tr() === 'dr' ? 'Douay-Rheims' : 'WEB', showNotes = () => ls.get('pb_notes', '1') !== '0', size = () => +ls.get('pb_size', '18');
    body.innerHTML = '<div class="scroll pad" style="flex:1" id="pbsc"><div class="pb-wrap"><h2 style="margin:0 0 4px">📖 Bible</h2><div class="mute small" style="margin-bottom:10px">Look up anything like an online Bible, or go somewhere at random. Everything is stored on this PC.</div>' +
      '<div class="pb-card"><div class="pb-row"><input id="pbq" type="text" placeholder="Type a verse or place: John 3:16-18 · Psalm 23 · Romans 8:28-39; Isaiah 40:31 · Genesis · or words like “love your enemies”" style="flex:1;min-width:260px;padding:9px 14px;border-radius:999px"><button class="pri" id="pbgo">Go</button></div>' +
      '<div class="pb-row" style="margin-top:10px"><button class="ib" id="pbrv">🎲 Random verse</button><button class="ib" id="pbrc">🎲 Random chapter</button><button class="ib" id="pbrb">🎲 Random book</button><button class="ib" id="pbvd">🕊️ Verse of the day</button><span class="small mute" style="margin-left:4px">from</span><select id="pbsc2" class="ib"></select></div>' +
      '<div class="pb-row" style="margin-top:10px"><span class="small mute">Translation</span><button class="ib" data-tr="web">WEB (modern)</button><button class="ib" data-tr="dr">Douay-Rheims</button><span class="small mute" style="margin-left:8px">Text size</span><button class="ib" id="pbsm">A−</button><button class="ib" id="pbbg">A+</button><label class="small" id="pbnl" style="display:flex;gap:5px;align-items:center;cursor:pointer;margin-left:8px"><input type="checkbox" id="pbnt">Challoner\'s notes</label><label class="small" id="pbhl" style="display:flex;gap:5px;align-items:center;cursor:pointer;margin-left:8px" title="The Douay-Rheims counts the Psalms differently from most Bibles"><input type="checkbox" id="pbhb">Usual Psalm numbers</label></div>' +
      '<div id="pbhist" style="margin-top:8px"></div></div><div id="pbres"></div>' +
      '<details class="pb-card"><summary style="cursor:pointer;font-weight:600">Browse by book, chapter and verses · tips</summary><div class="pb-row" style="margin-top:10px"><span class="small mute">Browse</span><select id="pbbk" class="ib"></select><select id="pbch" class="ib"></select><span class="small mute">verses</span><input id="pbv1" type="number" min="1" placeholder="from" class="ib" style="width:70px"><span class="small mute">to</span><input id="pbv2" type="number" min="1" placeholder="to" class="ib" style="width:70px"><button class="ib" id="pbbr">Show</button></div>' +
      '<div class="small mute" style="margin-top:8px;line-height:1.6">Tips: separate passages with <b>;</b> to see several together. <b>John 3:16,18-20</b> shows verses 16 and 18 to 20 in one card. <b>Genesis 1:1-2:3</b> runs across chapters. A book name alone opens the book with its chapters. Common short names work (<b>jn</b>, <b>mt</b>, <b>rev</b>, <b>ps</b>). Words that are not a reference search the whole Bible.</div></details></div></div>';
    const q = id => body.querySelector('#' + id), res = q('pbres');

    /* ---------- reading what was typed ---------- */
    const ref1 = (p, native) => {
      p = p.trim(); const cross = /^(.+?)\s+(\d+)\s*:\s*(\d+)\s*[-–]\s*(\d+)\s*:\s*(\d+)$/.exec(p);
      if (cross) { const r = F.parseRef(cross[1] + ' ' + cross[2] + ':' + cross[3]); if (r && r.hasCh) { const n = books()[r.b].ch.length; return { b: r.b, c: r.c, from: +cross[3], c2: Math.min(+cross[4], n) - 1, to: +cross[5] }; } }
      const r = F.parseRef(p); if (!r) return null;
      if (!r.hasCh) return { b: r.b, c: 0, book: true, whole: true };
      const o = r.v ? { b: r.b, c: r.c, from: r.v, to: r.v2 && r.v2 >= r.v ? r.v2 : r.v } : { b: r.b, c: r.c, whole: true };
      if (!native && o.b === 20 && F.tr() === 'dr' && ls.get('pb_hebrew', '1') !== '0') {     // the Douay-Rheims numbers the Psalms the old way: read a typed number as the usual one
        const dc = Math.max(0, F.psConv(o.c + 1, 'web', 'dr') - 1); if (dc !== o.c) { o.heb = o.c + 1; o.c = dc; }
      }
      return o;
    };
    const parseAll = (text, native) => {
      const out = [], bad = []; let last = null;
      String(text).split(/;|\n/).forEach(seg => {
        seg = seg.trim(); if (!seg) return;
        seg.split(',').map(s => s.trim()).filter(Boolean).forEach((p, i) => {
          const m = /^(\d+)(?:\s*[-–]\s*(\d+))?$/.exec(p);
          if (i > 0 && m && last && last.from && last.c2 == null) { (last.more = last.more || []).push([+m[1], m[2] ? Math.max(+m[1], +m[2]) : +m[1]]); return; }   // "John 3:16,18-20": more verses of the same chapter join the same card
          const r = ref1(p, native); if (r) { out.push(r); last = r; } else bad.push(p);
        });
      });
      return { out, bad };
    };

    /* ---------- showing passages ---------- */
    const bk = c => books()[c.b], chap = (b2, c2) => (books()[b2].ch[c2] || { v: [] });
    const label = c => { const l = label0(c); return c.heb ? l + ' (Psalm ' + c.heb + ' in most Bibles)' : l; };
    const label0 = c => { const n = bk(c).n; if (c.book) return n; if (c.whole) return n + ' ' + (c.c + 1); if (c.c2 != null && c.c2 !== c.c) return n + ' ' + (c.c + 1) + ':' + c.from + '-' + (c.c2 + 1) + ':' + c.to; return n + ' ' + (c.c + 1) + ':' + [[c.from, c.to]].concat(c.more || []).map(r => r[0] + (r[1] > r[0] ? '-' + r[1] : '')).join(', '); };
    const versesOf = c => {                                         // [{ch, n, text, note}] for the card, with a little context when asked
      const out = [], last = (c.c2 != null ? c.c2 : c.c), ctx = c.ctx || 0;
      if (c.more && c.more.length && !c.whole && !c.book && c.c2 == null) {      // several verses of one chapter, in order, with a gap marker where verses are skipped
        const ch = chap(c.b, c.c), N = ch.v.length, seen = new Set(); let prev = 0;
        [[c.from, c.to]].concat(c.more).sort((x, y) => x[0] - y[0]).forEach(r => {
          const lo = Math.max(1, r[0] - ctx), hi = Math.min(N, r[1] + ctx); if (prev && lo > prev + 1) out.push({ gap: true, ctxv: true, n: 0, t: '' });
          for (let n = lo; n <= hi; n++) { if (seen.has(n)) continue; seen.add(n); out.push({ ci: c.c, n, t: String(ch.v[n - 1] || ''), note: ch.n && ch.n[n - 1], ctxv: n < r[0] || n > r[1], para: ch.p && ch.p.indexOf(n - 1) >= 0 }); }
          prev = Math.max(prev, hi);
        });
        return out;
      }
      for (let ci = c.c; ci <= last; ci++) {
        const ch = chap(c.b, ci), N = ch.v.length; let a = 1, z = N;
        if (!c.whole && !c.book) { a = ci === c.c ? c.from : 1; z = ci === last ? c.to : N; }
        const lo = Math.max(1, a - (ci === c.c ? ctx : 0)), hi = Math.min(N, z + (ci === last ? ctx : 0));
        for (let n = lo; n <= hi; n++) out.push({ ci, n, t: String(ch.v[n - 1] || ''), note: ch.n && ch.n[n - 1], ctxv: n < a || n > z, para: ch.p && ch.p.indexOf(n - 1) >= 0 });
      }
      return out;
    };
    const textHtml = c => {
      const vs = versesOf(c), multi = c.c2 != null && c.c2 !== c.c, par = !!(chap(c.b, c.c).p && chap(c.b, c.c).p.length); let h = '', open = false, lastCh = -1;
      vs.forEach(v => {
        if (v.gap) { if (open) { h += '</p>'; open = false; } h += '<div class="small mute" style="text-align:center;margin:.3em 0">⋯</div>'; return; }
        if (multi && v.ci !== lastCh) { if (open) { h += '</p>'; open = false; } h += '<div class="small mute" style="font-family:system-ui;margin:.6em 0 .2em"><b>Chapter ' + (v.ci + 1) + '</b></div>'; lastCh = v.ci; }
        const cls = v.ctxv ? 'pb-dim' : (!c.whole && !c.book && vs.length > 0 && c.ctx ? 'pb-hl' : '');
        if (par) { if (v.para || !open) { if (open) h += '</p>'; h += '<p>'; open = true; } h += '<span class="' + cls + '"><sup>' + v.n + '</sup>' + esc2(v.t) + ' </span>'; }
        else h += '<p class="' + cls + '" style="margin:0 0 .35em"><sup>' + v.n + '</sup>' + esc2(v.t) + '</p>' + (v.note && F.tr() === 'dr' && showNotes() ? '<div class="pb-note">' + esc2(v.note) + '</div>' : '');
      });
      return h + (open ? '</p>' : '');
    };
    const shift = (c, d) => {                                       // previous / next chapter, crossing into the next book
      let b2 = c.b, c2 = (c.c2 != null ? c.c2 : c.c) + d; if (c2 < 0) { b2 = (b2 + books().length - 1) % books().length; c2 = books()[b2].ch.length - 1; } else if (c2 >= books()[b2].ch.length) { b2 = (b2 + 1) % books().length; c2 = 0; }
      return { b: b2, c: c2, whole: true };
    };
    const cardHtml = (c, i) => {
      const bkn = bk(c), n = bkn.ch.length;
      let h = '<div class="pb-card" data-i="' + i + '"><div class="pb-row" style="margin-bottom:6px"><span class="pb-ref">' + esc2(label(c)) + '</span><span class="small mute">' + trShort() + '</span><span style="flex:1"></span>' +
        '<button class="ib" data-a="prev" title="Previous chapter">◀</button><button class="ib" data-a="next" title="Next chapter">▶</button>' + (!c.whole && !c.book ? '<button class="ib" data-a="chapter">Whole chapter</button><button class="ib" data-a="ctx">' + (c.ctx ? 'Less' : '+ Context') + '</button>' : '') +
        '<button class="ib" data-a="copy">Copy</button><button class="ib" data-a="spirit">Open in Spiritual</button><button class="ib" data-a="explain">Explain</button><button class="ib" data-a="close" title="Remove">✕</button></div>';
      if (c.book) h += '<div class="small mute" style="margin-bottom:8px">' + esc2(bkn.t === 'NT' ? 'New Testament' : 'Old Testament') + (bkn.dc ? ' · deuterocanonical' : '') + ' · ' + n + ' chapter' + (n === 1 ? '' : 's') + '. Pick a chapter:</div><div style="margin-bottom:10px">' + Array.from({ length: n }, (_, k) => '<span class="pb-chap" data-ch="' + k + '">' + (k + 1) + '</span>').join('') + '</div>';
      return h + '<div class="pb-txt" style="font-size:' + size() + 'px">' + textHtml(c) + '</div></div>';
    };
    const histPush = t => { t = String(t).trim(); if (!t) return; const h = rd('pb_hist', []).filter(x => x !== t); h.unshift(t); ls.set('pb_hist', JSON.stringify(h.slice(0, 12))); drawHist(); };
    const drawHist = () => { const h = rd('pb_hist', []); q('pbhist').innerHTML = h.length ? '<span class="small mute">Recent: </span>' + h.slice(0, 7).map(x => '<span class="pb-chip" data-h="' + esc2(x) + '">' + esc2(x) + '</span>').join('') : ''; };
    const draw = () => { res.innerHTML = st.cards.length ? st.cards.map(cardHtml).join('') : ''; };
    const msg = (html) => { res.innerHTML = '<div class="pb-card">' + html + '</div>'; };

    /* ---------- going somewhere ---------- */
    const go = (text, native) => {                                  // native: the text is already in this translation's own numbering (verse of the day), so no Psalm conversion and no history entry
      text = String(text || '').trim(); if (!text) return; q('pbq').value = text; if (!native) { st.last = text; ls.set('pb_last', text); }
      const { out, bad } = parseAll(text, native);
      if (out.length && !bad.length) { st.cards = out.slice(0, 14); draw(); if (!native) histPush(text); return; }
      if (out.length) { st.cards = out.slice(0, 14); draw(); res.insertAdjacentHTML('afterbegin', '<div class="pb-card small">Could not read: <b>' + esc2(bad.join(', ')) + '</b>. Showing what I could.</div>'); histPush(text); return; }
      F.search(text).then(list => {                                  // not a reference: search the words
        if (!list.length) { st.cards = []; return msg('Nothing found for <b>' + esc2(text) + '</b>. Try a reference like <i>John 3:16</i> or different words.'); }
        const toks = text.toLowerCase().replace(/[^a-z0-9' ]/g, ' ').split(/\s+/).filter(w => w.length > 1);
        st.cards = []; res.innerHTML = '<div class="pb-card"><div class="pb-ref" style="margin-bottom:6px">“' + esc2(text) + '”</div><div class="small mute" style="margin-bottom:8px">' + list.length + ' verses' + (list.length >= 150 ? ' (first 150)' : '') + ' in the ' + trShort() + '. Click one to read it in its chapter.</div>' +
          list.slice(0, 60).map(x => { let t = esc2(x.t); toks.forEach(w => { t = t.replace(new RegExp('(' + w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + ')', 'ig'), '<mark style="background:rgba(255,214,10,.4);color:inherit">$1</mark>'); }); return '<div class="pb-chip" style="display:block;border-radius:10px;margin:0 0 6px;padding:7px 12px" data-hit="' + x.b + '.' + x.c + '.' + (x.v + 1) + '"><b>' + esc2(books()[x.b].n + ' ' + (x.c + 1) + ':' + (x.v + 1)) + '</b> <span style="font-family:Georgia,serif">' + t + '</span></div>'; }).join('') + '</div>'; histPush(text);
      });
    };
    const inScope = () => { const s = SCOPES.find(x => x[0] === scopeId()) || SCOPES[0]; const out = []; for (let i = s[2]; i <= s[3]; i++) if (books()[i]) out.push(i); return out; };
    const pick = list => list[Math.floor(Math.random() * list.length)];
    const randomVerse = () => { const chs = []; let total = 0; inScope().forEach(bi => books()[bi].ch.forEach((ch, ci) => { chs.push([bi, ci, total]); total += ch.v.length; })); let r = Math.floor(Math.random() * total), lo = 0, hi = chs.length - 1; while (lo < hi) { const m = (lo + hi + 1) >> 1; if (chs[m][2] <= r) lo = m; else hi = m - 1; } const [bi, ci, off] = chs[lo], v = r - off + 1; return { b: bi, c: ci, from: v, to: v }; };
    const setCards = (cs, text) => { st.cards = cs; draw(); histPush(text); q('pbq').value = text; };
    q('pbrv').onclick = () => { const c = randomVerse(); setCards([c], label(c)); };
    q('pbrc').onclick = () => { const bi = pick(inScope()), ci = Math.floor(Math.random() * books()[bi].ch.length), c = { b: bi, c: ci, whole: true }; setCards([c], label(c)); };
    q('pbrb').onclick = () => { const c = { b: pick(inScope()), c: 0, whole: true, book: true }; setCards([c], label(c)); };
    q('pbvd').onclick = async () => { const v = await F.verseOfDay(new Date()); go(v.ref, true); };
    q('pbgo').onclick = () => go(q('pbq').value); q('pbq').onkeydown = e => { e.stopPropagation(); if (e.key === 'Enter') go(q('pbq').value); };
    q('pbsc2').innerHTML = SCOPES.map(s => '<option value="' + s[0] + '"' + (s[0] === scopeId() ? ' selected' : '') + '>' + s[1] + '</option>').join(''); q('pbsc2').onchange = e => ls.set('pb_scope', e.target.value);
    q('pbbk').innerHTML = books().map((x, i) => '<option value="' + i + '">' + esc2(x.n) + '</option>').join('');
    const fillCh = () => { const n = books()[+q('pbbk').value].ch.length; q('pbch').innerHTML = '<option value="">Chapter...</option>' + Array.from({ length: n }, (_, k) => '<option value="' + k + '">' + (k + 1) + '</option>').join(''); }; q('pbbk').onchange = fillCh; fillCh();
    q('pbbr').onclick = () => { const bi = +q('pbbk').value, ci = q('pbch').value, v1 = +q('pbv1').value, v2 = +q('pbv2').value; let c; if (ci === '') c = { b: bi, c: 0, whole: true, book: true }; else if (!v1) c = { b: bi, c: +ci, whole: true }; else c = { b: bi, c: +ci, from: v1, to: Math.max(v1, v2 || v1) }; setCards([c], label(c)); };
    const syncTr = () => { body.querySelectorAll('[data-tr]').forEach(x => x.classList.toggle('on', x.dataset.tr === F.tr())); q('pbnl').style.display = q('pbhl').style.display = F.tr() === 'dr' ? 'flex' : 'none'; q('pbnt').checked = showNotes(); q('pbhb').checked = ls.get('pb_hebrew', '1') !== '0'; }; syncTr();
    q('pbnt').onchange = e => { ls.set('pb_notes', e.target.checked ? '1' : '0'); draw(); };
    q('pbhb').onchange = e => { ls.set('pb_hebrew', e.target.checked ? '1' : '0'); if (st.last) go(st.last); };
    q('pbsm').onclick = () => { ls.set('pb_size', String(Math.max(13, size() - 2))); draw(); }; q('pbbg').onclick = () => { ls.set('pb_size', String(Math.min(34, size() + 2))); draw(); };
    body.onclick = async e => {
      const t = e.target.closest('[data-tr]'); if (t) { await F.setTr(t.dataset.tr); syncTr(); fillCh(); if (st.last) go(st.last); return; }
      const h = e.target.closest('[data-h]'); if (h) { go(h.dataset.h); return; }
      const hit = e.target.closest('[data-hit]'); if (hit) { const [bi, ci, v] = hit.dataset.hit.split('.').map(Number); setCards([{ b: bi, c: ci, from: v, to: v, ctx: 3 }], books()[bi].n + ' ' + (ci + 1) + ':' + v); return; }
      const card = e.target.closest('.pb-card[data-i]'); if (!card) return; const i = +card.dataset.i, c = st.cards[i]; if (!c) return;
      const chp = e.target.closest('[data-ch]'); if (chp) { st.cards[i] = { b: c.b, c: +chp.dataset.ch, whole: true }; draw(); return; }
      const a = e.target.closest('[data-a]'); if (!a) return; const k = a.dataset.a;
      if (k === 'prev' || k === 'next') { st.cards[i] = shift(c, k === 'next' ? 1 : -1); draw(); }
      else if (k === 'chapter') { st.cards[i] = { b: c.b, c: c.c, whole: true }; draw(); }
      else if (k === 'ctx') { c.ctx = c.ctx ? 0 : 3; draw(); }
      else if (k === 'close') { st.cards.splice(i, 1); draw(); }
      else if (k === 'copy') A.copy(label(c) + ' (' + trShort() + ')\n\n' + versesOf(c).filter(v => !v.ctxv).map(v => (versesOf(c).length > 1 ? v.n + ' ' : '') + v.t.replace(/\s*\n\s*/g, ' ')).join(' '));
      else if (k === 'spirit') { A.showTab('faith'); setTimeout(() => F.openBible(c.b, c.c, c.from || 0), 500); }
      else if (k === 'explain') { A.showTab('chat'); A.chat.ask('Explain this Bible passage as a faithful, gentle Catholic teacher would: its context, what it means, and how to live it today. ' + label(c) + ' (' + trShort() + '): ' + versesOf(c).filter(v => !v.ctxv).map(v => v.t.replace(/\s*\n\s*/g, ' ')).join(' ').slice(0, 2500), { noLocal: true, sources: [] }); }
    };
    drawHist();
    /* a first thing to read: the last passage, or today's verse */
    const first = ls.get('pb_last', ''); F.verseOfDay(new Date()).then(v => first ? go(first) : go(v.ref, true)).catch(() => { });
    body._cleanup = () => { if (st.last) ls.set('pb_last', st.last); };
  }
})();

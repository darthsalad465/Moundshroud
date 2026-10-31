// Thesaurus: synonyms and antonyms grouped by meaning, from the offline Wiktionary. Click any word to look it up in turn.
(() => {
  const asked = /^\s*(?:what(?:'s| is| are)\s+)?(?:an?\s+|the\s+|some\s+)?(synonyms?|antonyms?|opposites?|another word|other words?|words?)\s+(?:for|like|of|meaning|to describe)\s+["']?([\p{L}' -]{2,40}?)["']?\s*\??\s*$/iu;
  const trail = []; let cur = '';

  function view(r) {
    const head = '<div class="hd"><div class="row"><b style="font-size:16px">Thesaurus</b><span class="sp"></span><span class="ib" id="thx" style="cursor:pointer">&times;</span></div>' +
      '<div class="row" style="margin-top:8px"><input id="thq" type="text" placeholder="Look up a word..." value="' + esc(r && r.word || '') + '"><button class="pri" id="thg">Find</button></div>' +
      (trail.length > 1 ? '<div class="small mute" style="margin-top:6px">' + trail.slice(-6).map((w, i, a) => i === a.length - 1 ? '<b>' + esc(w) + '</b>' : '<a href="#" data-w="' + esc(w) + '" style="color:var(--acc2)">' + esc(w) + '</a>').join(' &rsaquo; ') + '</div>' : '') + '</div>';
    let body;
    if (!r) body = '<div class="mute">Searching...</div>';
    else if (r.error) body = '<div class="bad">' + esc(r.error) + '</div>';
    else if (r.none) body = '<div class="mute">No synonyms found for <b>' + esc(r.word) + '</b>. Try the base form (for example "run" instead of "running").</div><div class="row" style="margin-top:10px"><button class="ib" id="thdef">Define it instead</button></div>';
    else {
      const by = []; r.groups.forEach(g => { const k = g.pos + '|' + g.sense; let b = by.find(x => x.k === k); if (!b) by.push(b = { k, pos: g.pos, sense: g.sense, lists: [] }); b.lists.push(g); });
      body = by.map(b => '<div class="card" style="margin:10px 0"><div class="small mute">' + esc(b.pos) + (b.sense ? ' &middot; ' + esc(b.sense) : '') + '</div>' +
        b.lists.map(l => '<div class="grp" style="margin:8px 0 2px;color:' + (/anton/i.test(l.type) ? 'var(--bad)' : /synon/i.test(l.type) ? 'var(--ok)' : 'var(--mute)') + '">' + esc(l.type) + '</div><div class="chips" style="margin-top:2px">' + l.words.slice(0, 60).map(w => '<span class="chip" data-w="' + esc(w.w) + '" title="' + esc(w.note || 'Look up') + '">' + esc(w.w) + (w.note ? ' <span class="mute small">' + esc(w.note) + '</span>' : '') + '</span>').join('') + '</div>').join('') + '</div>').join('') +
        '<div class="row small mute" style="margin-top:6px"><span>Source: ' + esc(r.source) + '</span><span class="sp"></span><button class="ib" id="thcp">Copy synonyms</button><button class="ib" id="thdef">Define ' + esc(r.word) + '</button></div>';
    }
    A.dlg(head + '<div class="bd">' + body + '</div>', true);
    $('thx').onclick = A.closeDlg; const q = $('thq'); q.onkeydown = e => { if (e.key === 'Enter') open(q.value); }; $('thg').onclick = () => open(q.value);
    if (!r) q.focus(); else if (r.none || r.error) q.select();
    document.querySelectorAll('#dlg [data-w]').forEach(el => el.onclick = e => { e.preventDefault(); open(el.dataset.w); });
    if ($('thdef')) $('thdef').onclick = () => { A.closeDlg(); A.lib.define(r.word); };
    if ($('thcp')) $('thcp').onclick = () => A.copy([...new Set(r.groups.filter(g => /synon/i.test(g.type)).flatMap(g => g.words.map(w => w.w)))].join(', '));
  }

  async function open(word) {
    word = (word || '').trim().replace(/[^\p{L}' -]/gu, ''); if (!word) { view(null); const hb = document.querySelector('#dlg .bd'); if (hb) hb.innerHTML = '<div class="mute">Type a word above and press Find.</div>'; return; }
    if (trail[trail.length - 1] !== word) trail.push(word); cur = word; view(null); $('thq').value = word;
    let r; try { r = await A.api('/api/thesaurus?word=' + encodeURIComponent(word)); } catch (e) { r = { error: 'Could not reach the dictionary.' }; }
    if (cur === word) view(r);
  }

  /* "synonyms for happy" typed in chat or the search box: answer right in the conversation */
  async function chatAnswer(kind, word) {
    const r = await A.api('/api/thesaurus?word=' + encodeURIComponent(word));
    if (r.error || r.none) return 'I could not find ' + (/anton|opposite/i.test(kind) ? 'antonyms' : 'synonyms') + ' for **' + word + '** in the offline dictionary. Try the base form of the word.';
    const pick = re => [...new Set(r.groups.filter(g => re.test(g.type)).flatMap(g => g.words.map(w => w.w)))];
    const syn = pick(/synon/i), ant = pick(/anton/i), wantAnt = /anton|opposite/i.test(kind);
    const first = r.groups.find(g => /synon/i.test(g.type));
    let t = wantAnt ? (ant.length ? '**Opposites of ' + r.word + ':** ' + ant.slice(0, 16).join(', ') + '.' : 'No opposites are listed for **' + r.word + '**.') : '**Words like ' + r.word + '**' + (first && first.sense ? ' (' + first.sense + ')' : '') + ': ' + syn.slice(0, 18).join(', ') + '.';
    if (!wantAnt && ant.length) t += '\n\n**Opposites:** ' + ant.slice(0, 10).join(', ') + '.';
    return t + '\n\nOpen the **Thesaurus** (button in the Library tab or press Ctrl+K and type "thesaurus ' + r.word + '") to browse every meaning.';
  }

  A.thes = { open, match: t => { const m = asked.exec(t); return m ? { kind: m[1], word: m[2].trim() } : null; }, chatAnswer };
  A.on('ready', () => {});
})();

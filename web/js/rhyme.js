// Rhymer: perfect rhymes, near rhymes and similar endings for any English word, offline (CMU Pronouncing Dictionary). Click a word to chain on to its rhymes.
(() => {
  const asked1 = /^\s*(?:(?:what|which)\s+)?(?:words?\s+)?(?:rhymes?|rhyme)\s+(?:with|for)\s+["']?([\p{L}'-]{2,30})["']?\s*[?.!]*\s*$/iu;
  const asked2 = /^\s*(?:(?:give me|show me|find|list|tell me)\s+)?(?:some\s+|all\s+|the\s+)?(?:words?|rhymes?)\s+(?:that\s+)?rhymes?\s+(?:with|for)\s+["']?([\p{L}'-]{2,30})["']?\s*[?.!]*\s*$/iu;
  const asked3 = /^\s*(?:(?:give me|show me|find|list)\s+)?rhymes?\s+(?:for|of)\s+["']?([\p{L}'-]{2,30})["']?\s*[?.!]*\s*$/iu;
  const trail = []; let cur = '', data = null, tab = ls.get('rhtab', 'perfect'), syl = 0, rare = ls.get('rhrare', '0') === '1', filt = '';
  const TABS = [['perfect', 'Perfect rhymes', 'Same ending sound: cat / hat / bat'], ['near', 'Near rhymes', 'Close but not exact: cat / bad / cap (great for songs and poems)'], ['ending', 'Similar endings', 'Words whose last syllable sounds alike']];

  function list(r) {
    const g = r[tab] || {}; let words = [];
    for (const k of [1, 2, 3, 4]) { if (syl && syl !== k) continue; const e = g[k] || { c: [], r: [] }; words.push({ k, c: e.c, r: rare ? e.r : [] }); }
    const f = filt.trim().toLowerCase(); const pass = w => !f || w.includes(f);
    return words.map(x => ({ k: x.k, c: x.c.filter(pass), r: x.r.filter(pass) })).filter(x => x.c.length || x.r.length);
  }
  function view(r) {
    const head = '<div class="hd"><div class="row"><b style="font-size:16px">🎵 Rhymer</b><span class="sp"></span><span class="ib" id="rhx" style="cursor:pointer">&times;</span></div>' +
      '<div class="row" style="margin-top:8px"><input id="rhq" type="text" placeholder="Type a word to find what rhymes with it..." value="' + esc(r && r.word || '') + '"><button class="pri" id="rhg">Find</button></div>' +
      (trail.length > 1 ? '<div class="small mute" style="margin-top:6px">' + trail.slice(-6).map((w, i, a) => i === a.length - 1 ? '<b>' + esc(w) + '</b>' : '<a href="#" data-w="' + esc(w) + '" style="color:var(--acc2)">' + esc(w) + '</a>').join(' &rsaquo; ') + '</div>' : '') + '</div>';
    let body;
    if (!r) body = '<div class="mute">Searching...</div>';
    else if (r.error) body = '<div class="bad">' + esc(r.error) + '</div>';
    else if (r.none) body = '<div class="mute">I could not work out how <b>' + esc(r.word) + '</b> sounds. Check the spelling or try a similar word.</div>';
    else {
      const counts = { perfect: r.perfectN, near: r.nearN, ending: r.endingN };
      body = '<div class="row" style="margin-bottom:8px;gap:8px;flex-wrap:wrap"><b style="font-size:17px">' + esc(r.word) + '</b><span class="mute">/' + esc(r.prons[0].ipa) + '/</span>' + (r.prons.length > 1 ? '<span class="small mute">also /' + esc(r.prons.slice(1).map(p => p.ipa).join('/, /')) + '/</span>' : '') + '<span class="small mute">' + r.syllables + ' syllable' + (r.syllables > 1 ? 's' : '') + '</span><button class="ib" id="rhsay" title="Hear it">🔊</button></div>' +
        (r.guess ? '<div class="card small" style="border-color:var(--warn)">' + esc(r.note) + '</div>' : '') +
        '<div class="chips" style="margin:0 0 8px">' + TABS.map(t => '<span class="chip" data-t="' + t[0] + '" title="' + esc(t[2]) + '" style="' + (tab === t[0] ? 'background:var(--acc);color:var(--onacc);border-color:var(--acc)' : '') + '">' + t[1] + ' <span class="small" style="opacity:.75">' + (counts[t[0]] || 0) + '</span></span>').join('') + '</div>' +
        '<div class="row" style="gap:6px;margin-bottom:8px;flex-wrap:wrap"><span class="small mute">Syllables</span>' + [[0, 'All'], [1, '1'], [2, '2'], [3, '3'], [4, '4+']].map(s => '<span class="chip" data-s="' + s[0] + '" style="' + (syl === s[0] ? 'background:var(--acc2);color:#04221a;border-color:var(--acc2)' : '') + '">' + s[1] + '</span>').join('') + '<input id="rhf" type="text" placeholder="Filter, e.g. ing" value="' + esc(filt) + '" style="max-width:130px;padding:4px 9px"><label class="chk small mute"><input type="checkbox" id="rhr"' + (rare ? ' checked' : '') + '> Include rare words and names</label></div>';
      const rows = list(r); const tip = TABS.find(t => t[0] === tab)[2];
      body += rows.length ? rows.map(x => '<div class="card" style="margin:8px 0"><div class="small mute">' + x.k + (x.k === 4 ? '+' : '') + ' syllable' + (x.k > 1 ? 's' : '') + '</div><div class="chips" style="margin-top:4px">' + x.c.map(w => '<span class="chip" data-w="' + esc(w) + '">' + esc(w) + '</span>').join('') + x.r.map(w => '<span class="chip" data-w="' + esc(w) + '" style="opacity:.55" title="Rare word or a name">' + esc(w) + '</span>').join('') + '</div></div>').join('') : '<div class="mute" style="margin:10px 0">Nothing here' + (filt ? ' for "' + esc(filt) + '"' : '') + '. ' + (tab === 'perfect' ? 'Some words (like <i>orange</i> or <i>silver</i>) have no perfect rhyme: try <b>Near rhymes</b>.' : 'Try another tab or syllable count.') + '</div>';
      body += '<div class="row small mute" style="margin-top:6px;flex-wrap:wrap;gap:6px"><span>' + esc(tip) + '. Click a word to rhyme from it, right-click to define.</span><span class="sp"></span><button class="ib" id="rhcp">Copy list</button><button class="ib" id="rhai">✍ Write with these</button><button class="ib" id="rhdef">Define ' + esc(r.word) + '</button></div>';
    }
    A.dlg(head + '<div class="bd" id="rhbd" style="max-height:62vh;overflow:auto">' + body + '</div>', true);
    $('rhx').onclick = A.closeDlg; const q = $('rhq'); q.onkeydown = e => { if (e.key === 'Enter') open(q.value); }; $('rhg').onclick = () => open(q.value);
    if (!r) q.focus(); else if (r.none || r.error) q.select();
    const dlg = document.getElementById('dlg') || document;
    dlg.querySelectorAll('[data-w]').forEach(el => { el.onclick = e => { e.preventDefault(); open(el.dataset.w); }; el.oncontextmenu = e => { e.preventDefault(); A.closeDlg(); A.lib.define(el.dataset.w); }; });
    dlg.querySelectorAll('[data-t]').forEach(el => el.onclick = () => { tab = el.dataset.t; ls.set('rhtab', tab); view(data); });
    dlg.querySelectorAll('[data-s]').forEach(el => el.onclick = () => { syl = +el.dataset.s; view(data); });
    if ($('rhr')) $('rhr').onchange = () => { rare = $('rhr').checked; ls.set('rhrare', rare ? '1' : '0'); view(data); };
    if ($('rhf')) { $('rhf').oninput = () => { filt = $('rhf').value; const p = $('rhf').selectionStart; view(data); const n = $('rhf'); n.focus(); n.setSelectionRange(p, p); }; }
    if ($('rhsay')) $('rhsay').onclick = () => { A.speech.stop(); A.speech.speak(r.word); };
    if ($('rhdef')) $('rhdef').onclick = () => { A.closeDlg(); A.lib.define(r.word); };
    if ($('rhcp')) $('rhcp').onclick = () => A.copy(list(r).flatMap(x => x.c.concat(x.r)).join(', '));
    if ($('rhai')) $('rhai').onclick = () => { const w = list(r).flatMap(x => x.c).slice(0, 24).join(', '); A.closeDlg(); A.showTab('chat'); A.chat.newChat(); A.chat.ask('Write a short four-line poem (rhymed AABB) about anything you like. End the first pair of lines with "' + r.word + '" and one of these rhyming words: ' + w + '.', { noLocal: true, sources: [] }); };
  }

  async function open(word) {
    word = (word || '').trim().replace(/[^\p{L}' -]/gu, '').split(/\s+/)[0]; if (!word) { data = null; view(null); if ($('rhbd')) $('rhbd').innerHTML = '<div class="mute">Type a word above and press Find.</div>'; return; }
    if (trail[trail.length - 1] !== word.toLowerCase()) trail.push(word.toLowerCase()); cur = word; filt = ''; view(null); $('rhq').value = word;
    let r; try { r = await A.api('/api/rhyme?word=' + encodeURIComponent(word)); } catch (e) { r = { error: 'Could not reach the rhyming dictionary.' }; }
    if (cur === word) { data = r; view(r); }
  }

  /* "what rhymes with orange" typed in chat: answer right in the conversation */
  const match = t => { for (const re of [asked1, asked2, asked3]) { const m = re.exec(t); if (m) return { word: m[1] }; } return null; };
  async function chatAnswer(word) {
    const r = await A.api('/api/rhyme?word=' + encodeURIComponent(word));
    if (r.error) return r.error; if (r.none) return 'I could not work out how **' + word + '** sounds, so I cannot find rhymes. Check the spelling.';
    const pick = (g, n) => [1, 2, 3, 4].flatMap(k => (g[k] ? g[k].c : [])).slice(0, n);
    const per = [1, 2, 3, 4].map(k => (r.perfect[k] ? r.perfect[k].c : []).slice(0, 10)).map((a, i) => a.length ? '**' + (i + 1) + (i === 3 ? '+' : '') + ' syllable' + (i ? 's' : '') + ':** ' + a.join(', ') : '').filter(Boolean);
    let t = per.length ? '**Words that rhyme with ' + r.word + '** (/' + r.prons[0].ipa + '/):\n\n' + per.join('\n\n') : '**' + r.word + '** has no perfect rhyme.';
    const near = pick(r.near, 14); if (near.length) t += '\n\n**Near rhymes:** ' + near.join(', ') + '.';
    if (r.guess) t += '\n\n_' + r.note + '_';
    return t + '\n\nOpen the **Rhymer** (Library tab, or press Ctrl+K and type "rhymer") for every rhyme, filters and more.';
  }

  A.rhyme = { open, match, chatAnswer };
})();

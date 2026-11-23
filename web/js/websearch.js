// Browser homepage (the Search part): ask anything and get an answer plus ranked pages from every offline library (Wikipedia, Q&A sites, guides, medical, survival, dictionary, books),
// your documents and your notes. The AI writes a short cited answer from the best pages; pages open in a reader inside the tab.
(() => {
  let P = null;                                   // the element it draws into: the homepage of the Browser tab (lib.js passes it to mount)
  const esc2 = s => String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const rd = (k, d) => { try { return JSON.parse(ls.get(k, JSON.stringify(d))); } catch (e) { return d; } };
  const GN = { wiki: ['Encyclopedia', '📖'], qa: ['Q&A', '💬'], ref: ['Guides', '📘'], medical: ['Medical', '🩺'], survival: ['Survival', '🏕️'], dict: ['Dictionary', '🔤'], books: ['Books', '📚'] };
  const EXAMPLES = ['how do black holes form', 'symptoms of dehydration', 'what is a caesar cipher', 'python list comprehension', 'how to purify water in an emergency', 'difference between a virus and a bacterium', 'who was napoleon', 'how does a car engine work', 'best things to do in lisbon', 'how does public key encryption work'];
  let hist = rd('ws_hist', []), scope = 'all', res = null, query = '', built = false, ctl = null, seq = 0, sugT = 0, sugI = -1, sugs = [], books = null, lastItems = [], answerOn = ls.get('ws_ai', '1') !== '0';
  const css = '.ws-wrap{flex:1;min-height:0;display:flex;flex-direction:column;position:relative}.ws-top{display:flex;gap:10px;align-items:center;padding:12px 20px;border-bottom:1px solid var(--line);background:var(--panel);flex-wrap:wrap}.ws-logo{font-weight:800;font-size:19px;cursor:pointer;white-space:nowrap}.ws-logo b{color:var(--acc)}.ws-box{position:relative;flex:1;min-width:240px;max-width:760px}.ws-box input{width:100%;padding:11px 46px 11px 18px;border-radius:999px;font-size:15px}.ws-go{position:absolute;right:5px;top:5px;border:0;border-radius:50%;width:34px;height:34px;background:var(--acc);color:var(--onacc,#fff);cursor:pointer;font-size:15px}' +
    '.ws-sug{position:absolute;left:0;right:0;top:100%;margin-top:4px;background:var(--panel);border:1px solid var(--line);border-radius:14px;box-shadow:0 14px 40px rgba(0,0,0,.45);overflow:hidden;z-index:30}.ws-sug div{padding:9px 16px;cursor:pointer;display:flex;gap:10px;align-items:center}.ws-sug div:hover,.ws-sug div.on{background:var(--panel2)}.ws-sug .h{opacity:.55}' +
    '.ws-body{flex:1;overflow:auto;padding:14px 22px 30px}.ws-tabs{display:flex;gap:6px;flex-wrap:wrap;margin:0 0 12px}.ws-tab{padding:6px 13px;border-radius:999px;border:1px solid var(--line);background:var(--panel);cursor:pointer;font-size:13px;white-space:nowrap}.ws-tab:hover{background:var(--panel2)}.ws-tab.on{background:var(--acc);color:var(--onacc,#fff);border-color:var(--acc)}.ws-tab small{opacity:.7;margin-left:4px}' +
    '.ws-cols{display:grid;grid-template-columns:minmax(0,1fr) 330px;gap:22px;max-width:1120px}.ws-card{background:var(--panel);border:1px solid var(--line);border-radius:14px;padding:14px 16px;margin-bottom:14px}.ws-ans{border-color:color-mix(in srgb,var(--acc) 45%,var(--line))}.ws-ans h4{margin:0 0 8px;font-size:13px;letter-spacing:.04em;color:var(--acc)}.ws-anst{line-height:1.6;font-size:15px}.ws-anst p{margin:0 0 8px}.ws-anst ul,.ws-anst ol{margin:4px 0 8px 20px}.ws-cite{color:var(--acc);cursor:pointer;font-size:12px;vertical-align:super;font-weight:700;padding:0 1px}' +
    '.ws-res{padding:10px 0;border-bottom:1px solid var(--line);cursor:pointer}.ws-res:hover .ws-title{text-decoration:underline}.ws-crumb{font-size:12px;color:var(--mute);margin-bottom:2px;display:flex;gap:8px;align-items:center;flex-wrap:wrap}.ws-badge{display:inline-block;padding:1px 8px;border-radius:999px;font-size:11px;background:var(--panel2);border:1px solid var(--line)}.ws-title{font-size:17px;color:var(--acc);font-weight:600;line-height:1.3}.ws-snip{font-size:13.5px;line-height:1.5;color:var(--text);opacity:.82;margin-top:3px}.ws-snip b{color:var(--text);opacity:1}' +
    '.ws-panel h3{margin:0 0 4px}.ws-chip{display:inline-block;padding:6px 12px;margin:0 6px 6px 0;border-radius:999px;background:var(--panel);border:1px solid var(--line);cursor:pointer;font-size:13px}.ws-chip:hover{background:var(--panel2)}.ws-hero{text-align:center;padding:38px 10px 10px}.ws-hero h1{font-size:34px;margin:0 0 6px}.ws-hero h1 b{color:var(--acc)}.ws-reader{position:absolute;inset:0;background:var(--bg,#0e1016);z-index:40;display:flex;flex-direction:column}.ws-reader iframe{flex:1;border:0;background:#0e1016;width:100%}.ws-rbar{display:flex;gap:8px;align-items:center;padding:8px 14px;border-bottom:1px solid var(--line);background:var(--panel);flex-wrap:wrap}' +
    '@media(max-width:900px){.ws-cols{grid-template-columns:1fr}}';
  const luxe = `
    .ws-top{gap:12px;padding:14px 22px;background:color-mix(in srgb,var(--panel) 88%,var(--bg));backdrop-filter:blur(18px);box-shadow:0 8px 26px rgba(0,0,0,.1);z-index:10}
    .ws-logo{font-family:"Sitka Display",Georgia,serif;font-size:17px;letter-spacing:.01em;opacity:.96}.ws-logo b{font-weight:700}
    .ws-box{max-width:none;min-width:240px}.ws-box input{height:46px;padding:0 54px 0 18px;border-radius:14px;border-color:color-mix(in srgb,var(--line) 88%,transparent);background:color-mix(in srgb,var(--bg) 70%,var(--panel));box-shadow:inset 0 1px 0 rgba(255,255,255,.025);transition:border-color .18s ease,box-shadow .18s ease}
    .ws-box:focus-within input{border-color:color-mix(in srgb,var(--acc) 72%,var(--line));box-shadow:0 0 0 3px color-mix(in srgb,var(--acc) 13%,transparent),0 8px 24px rgba(0,0,0,.14)}
    .ws-go{right:6px;top:6px;width:34px;height:34px;box-shadow:0 4px 14px color-mix(in srgb,var(--acc) 36%,transparent);transition:transform .16s ease,filter .16s ease}.ws-go:hover{transform:translateY(-1px);filter:brightness(1.1)}
    .ws-top>.ib{height:40px;border-radius:12px;padding:0 12px;white-space:nowrap}
    .ws-body{padding:18px clamp(16px,3vw,34px) 38px}.ws-cols{width:min(100%,1240px);margin:0 auto;gap:24px}.ws-card{border-radius:18px;padding:18px 20px;box-shadow:0 12px 34px rgba(0,0,0,.12)}
    .ws-hero{max-width:1100px;margin:0 auto;padding:clamp(42px,8vh,86px) 20px 24px}.ws-hero h1{font-family:"Sitka Display",Georgia,serif;font-size:clamp(30px,4vw,48px);font-weight:600;letter-spacing:-.025em;line-height:1.12;margin:0 0 14px}.ws-hero h1 b{background:linear-gradient(110deg,var(--acc),var(--acc2));background-clip:text;-webkit-background-clip:text;color:transparent}
    .ws-hero>.mute{max-width:760px!important;margin:0 auto 23px!important;font-size:14px;line-height:1.7!important}.ws-hero #wsslot{max-width:790px;margin:0 auto}.ws-hero #wsntpbtns{gap:9px!important;margin-top:13px!important}
    .ws-hero #wsntpbtns .ib{height:38px;border-radius:12px;padding:0 13px}.ws-tabs{margin-bottom:18px}.ws-tab{padding:8px 15px;border-radius:12px}.ws-res{padding:14px 2px}.ws-title{font-size:18px;line-height:1.35}.ws-snip{font-size:14px;line-height:1.65;margin-top:5px}.ws-crumb{margin-bottom:5px}
    .ntp-h{margin:34px 0 12px;font-size:11px;font-weight:700;letter-spacing:.13em;color:var(--mute)}.ntp-tiles{display:grid;grid-template-columns:repeat(auto-fill,minmax(150px,1fr));gap:10px}.ntp-tile{display:flex;align-items:center;gap:11px;min-width:0;padding:12px;border:1px solid var(--line);border-radius:15px;background:color-mix(in srgb,var(--panel) 82%,transparent);cursor:pointer;transition:transform .16s ease,border-color .16s ease,background .16s ease,box-shadow .16s ease}.ntp-tile:hover{transform:translateY(-2px);border-color:color-mix(in srgb,var(--acc) 42%,var(--line));background:var(--panel2);box-shadow:0 10px 24px rgba(0,0,0,.14)}.ntp-tile .ic{flex:none;width:34px;height:34px;display:grid;place-items:center;border-radius:11px;color:#fff;font-weight:700;box-shadow:inset 0 1px 0 rgba(255,255,255,.18)}.ntp-tile .nm{min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:13px;font-weight:600}
    @media(max-width:760px){.ws-top{padding:10px 12px;gap:8px}.ws-logo{width:100%;font-size:15px}.ws-box{order:2;flex-basis:100%}.ws-top>.ib{flex:1;justify-content:center;padding:0 7px;font-size:12px}.ws-hero{padding:36px 14px 20px}.ws-body{padding:12px 14px 28px}.ntp-tiles{grid-template-columns:repeat(auto-fill,minmax(125px,1fr))}}
    @media(prefers-reduced-motion:reduce){.ws-go,.ntp-tile{transition:none!important}}
  `;
  if (!document.getElementById('wscss')) { const st = document.createElement('style'); st.id = 'wscss'; st.textContent = css + luxe; document.head.appendChild(st); }
  let dictOn = false;      // dictionary mode starts off each time
  const POS = /^(Noun|Verb|Adjective|Adverb|Pronoun|Preposition|Conjunction|Interjection|Determiner|Article|Numeral|Particle|Proper noun|Phrase|Prefix|Suffix|Contraction|Letter|Symbol|Abbreviation|Initialism|Acronym)$/, STOP = /^(Etymology|Pronunciation|Translations|Derived terms|Related terms|See also|Anagrams|References|Further reading|Descendants|Usage notes|Alternative forms|Quotations)/;
  const tidy = s => s.replace(/\s+([,.;:!?)])/g, '$1').replace(/([(])\s+/g, '$1').replace(/\s{2,}/g, ' ').trim();
  const dictParse = text => {
    const L = String(text || '').split('\n').map(s => s.trim()).filter(Boolean), out = { ipa: '', blocks: [] }; const pi = L.findIndex(l => /^Pronunciation$/.test(l)); if (pi >= 0) { const m = L.slice(pi + 1, pi + 6).find(l => /^(IPA|\(?US\)?|UK)/.test(l) && l.includes('/')); if (m) out.ipa = tidy(m).slice(0, 80); }
    for (let i = 0; i < L.length && out.blocks.length < 3; i++) if (POS.test(L[i])) { const defs = []; for (let j = i + 2; j < L.length && defs.length < 3; j++) { const l = L[j]; if (POS.test(l) || STOP.test(l)) break; if (/^\d{3,4}\b/.test(l)) { j++; continue; } if (/^(Synonyms:|Antonyms:|Hyponyms:|Hypernyms:|Coordinate terms:|Derived terms:|Related terms:|Usage notes:)/.test(l) || l.length < 4 || l.length > 280) continue; defs.push(tidy(l)); } if (defs.length) out.blocks.push({ pos: L[i], head: tidy(L[i + 1] || '').slice(0, 90), defs }); }
    return out;
  };
  const dictCard = (r, title, url) => { if (!r.blocks.length) return '<div class="small mute">No definition text could be read here. Open the full entry.</div>' + '<div style="margin-top:8px"><button class="ib" data-open="' + esc2(url) + '" data-t="' + esc2(title) + '">Open the full entry</button></div>'; return (r.ipa ? '<div class="small mute" style="margin:2px 0 6px">' + esc2(r.ipa) + '</div>' : '') + r.blocks.map(b => '<div style="margin-top:8px"><i style="color:var(--acc)">' + esc2(b.pos.toLowerCase()) + '</i> <span class="small mute">' + esc2(b.head) + '</span><ol style="margin:4px 0 0 20px;padding:0;line-height:1.5">' + b.defs.map(d => '<li>' + esc2(d) + '</li>').join('') + '</ol></div>').join('') + '<div style="margin-top:10px"><button class="ib" data-open="' + esc2(url) + '" data-t="' + esc2(title) + '">Open the full entry</button> <button class="ib" data-ask="Explain the word ' + esc2(title) + ' simply, with an example sentence">Explain simply</button></div>'; };
  const saveHist = () => ls.set('ws_hist', JSON.stringify(hist.slice(0, 40)));
  const addHist = q => { hist = [q].concat(hist.filter(x => x.toLowerCase() !== q.toLowerCase())).slice(0, 40); saveHist(); };
  const snip = s => String(s || '').replace(/<(?!\/?b>)/g, '&lt;').replace(/(<b>)|(<\/b>)/g, m => m).replace(/\s+/g, ' ');
  const crumb = it => esc2(it.book);

  /* ---------- the page ---------- */
  function build() {
    P.innerHTML = '<div class="ws-wrap" id="wswrap"><div class="ws-top"><div class="ws-logo" id="wslogo">🌐 <b>Moundshroud</b> Browser</div><div class="ws-box"><input type="text" id="wsq" placeholder="Search the offline internet — or paste a .html file name to open it (try index.html)" autocomplete="off"><button class="ws-go" id="wsgo" title="Search">➜</button><div class="ws-sug" id="wssug" style="display:none"></div></div><button class="ib" id="wsopenfile" title="Open an .html page from this PC">📄 Open .html</button><button class="ib" id="wsdict" title="Dictionary mode: type a word and open its entry">📕 Dictionary</button><button class="ib" id="wsask" title="Ask the chat assistant instead">💬 Ask in chat</button><button class="ib" id="wssave" title="Save this search to your favorites">☆ Save search</button><button class="ib" id="wshist" title="Clear recent searches and the list of pages you opened">🧹 Clear history</button></div><div class="ws-body" id="wsbody"></div></div>'; built = true; try { if (A.privweb) A.privweb.attach(P); } catch (e) { }
    P.onclick = async e => {
      const T = e.target, c = s => T.closest(s); let el;
      if ((el = c('[data-fav]'))) { const u = el.dataset.fav, on = A.fav.toggle({ u, t: el.dataset.t, k: 'page' }); el.textContent = on ? '⭐' : '☆'; e.stopPropagation(); return; }
      if (c('#wshell')) { if (A.moundshell && A.moundshell.open) A.moundshell.open(); else A.toast('Press Ctrl + T to open moundshell.'); return; }
      if (c('#wsfavs')) { A.fav.open('all'); return; }
      if (c('#wsopenfile')) { pickHtml(); return; }
      if (c('#wsdict')) { setDict(!dictOn); $('wsq').focus(); return; }
      if (c('#wsthes')) { A.thes.open(($('wsq').value || '').trim().split(/\s+/)[0]); return; } if (c('#wsrhy')) { A.rhyme.open(($('wsq').value || '').trim().split(/\s+/)[0]); return; }
      if (c('#wssave')) { const v = (query || $('wsq').value).trim(); if (!v) return A.toast('Search for something first'); const on = A.fav.toggle({ u: 'search:' + v.toLowerCase(), t: v, k: 'search' }); $('wssave').textContent = on ? '⭐ Search saved' : '☆ Save search'; return; }
      if (c('#wshist')) { if ((await A.confirm('Clear your recent searches and the list of pages you opened? Your favorites are kept.'))) { A.fav.clearHistory('all'); A.toast('History cleared'); } return; }
      if (c('#wsgo')) { run($('wsq').value); return; } if (c('#wslogo')) { query = ''; res = null; $('wsq').value = ''; home(); return; }
      if (c('#wsask')) { const v = $('wsq').value.trim(); A.showTab('chat'); if (v) A.chat.ask(v); return; }
      if (c('#wshub')) { A.lib.hub(); return; }
      if ((el = c('[data-sg]'))) { $('wsq').value = el.dataset.sg; hideSug(); run(el.dataset.sg); return; }
      if ((el = c('[data-q]'))) { $('wsq').value = el.dataset.q; run(el.dataset.q); return; }
      if ((el = c('[data-scope]'))) { scope = el.dataset.scope; if (query) run(query, true); return; }
      if ((el = c('[data-cite]'))) { const it = srcs[+el.dataset.cite - 1]; if (it) openPage(it.url, it.title); return; }
      if (c('#wsclearh')) { hist = []; saveHist(); A.fav.clearHistory('searches'); home(); return; } if ((el = c('[data-rmh]'))) { hist.splice(+el.dataset.rmh, 1); saveHist(); home(); e.stopPropagation(); return; }
      if (c('#wsai')) { answerOn = !answerOn; ls.set('ws_ai', answerOn ? '1' : '0'); if (query) run(query, true); return; }
      if ((el = c('[data-note]'))) { A.showTab('notes'); A.notes.openByPath(el.dataset.note); return; }
      if ((el = c('[data-doc]'))) { const f = lastFiles.docs[+el.dataset.doc]; if (f) A.viewer.open({ path: f.path, title: f.title, page: f.page, text: f.text }, query); return; }
      if ((el = c('[data-ask]'))) { A.showTab('chat'); A.chat.ask(el.dataset.ask); return; }
      if ((el = c('.ws-res'))) { openPage(el.dataset.u, el.dataset.t); return; }
      if ((el = c('[data-open]'))) { openPage(el.dataset.open, el.dataset.t); return; }
    };
    setDict(dictOn, true);
    const q = $('wsq'); q.oninput = () => { clearTimeout(sugT); const v = q.value.trim(); if (v.length < 2) { showHistSug(); return; } sugT = setTimeout(() => suggest(v), 140); };
    q.onfocus = () => { if (!q.value.trim()) showHistSug(); };
    q.onkeydown = e => { e.stopPropagation(); const box = $('wssug'), open = box.style.display !== 'none', n = sugs.length; if (e.key === 'ArrowDown' && open) { e.preventDefault(); sugI = (sugI + 1) % n; markSug(); } else if (e.key === 'ArrowUp' && open) { e.preventDefault(); sugI = (sugI - 1 + n) % n; markSug(); } else if (e.key === 'Enter') { e.preventDefault(); const v = open && sugI >= 0 ? sugs[sugI].t : q.value; q.value = v; hideSug(); run(v); } else if (e.key === 'Escape') hideSug(); };
    document.addEventListener('click', e => { if (!e.target.closest('.ws-box')) hideSug(); });
    document.addEventListener('histcleared', () => { hist = []; if (!res) home(); });
  }
  const $ = id => document.getElementById(id);
  const toTop = () => { const box = P && P.querySelector('.ws-box'), top = P && P.querySelector('.ws-top'), w = $('wswrap'); if (!box || !top) return; if (box.parentElement !== top) top.insertBefore(box, top.querySelector('#wsdict') || top.querySelector('#wsask') || null); ['wsdict', 'wsask', 'pwtog'].forEach(id => { const b = $(id); if (b && b.parentElement !== top) top.insertBefore(b, top.querySelector('#wssave')); }); if (w) w.classList.remove('ntp'); };
  const toSlot = () => { const box = P && P.querySelector('.ws-box'), slot = $('wsslot'), row = $('wsntpbtns'), w = $('wswrap'); if (!box || !slot) return; slot.appendChild(box); if (row) ['wsdict', 'wsask', 'pwtog'].forEach(id => { const b = $(id); if (b) row.appendChild(b); }); if (w) w.classList.add('ntp'); };
  function setDict(on, quiet) { dictOn = !!on; ls.set('ws_dict', dictOn ? '1' : '0'); const b = $('wsdict'), q = $('wsq'); if (b) b.classList.toggle('on', dictOn); if (q) q.placeholder = dictOn ? 'Dictionary: type a word and press Enter...' : 'Search Moundshroud\u2019s offline archived internet: how do vaccines work, python sort a list, who was Napoleon...'; if (!quiet && dictOn) A.toast('Dictionary mode: type a word and press Enter'); }
  const hideSug = () => { const b = $('wssug'); if (b) b.style.display = 'none'; sugI = -1; };
  const markSug = () => { document.querySelectorAll('#wssug div').forEach((d, i) => d.classList.toggle('on', i === sugI)); };
  const drawSug = () => { const b = $('wssug'); if (!sugs.length) return hideSug(); b.innerHTML = sugs.map((s, i) => '<div data-sg="' + esc2(s.t) + '"><span class="' + (s.h ? 'h' : '') + '">' + (s.h ? '🕒' : '🔎') + '</span><span>' + esc2(s.t) + '</span></div>').join(''); b.style.display = ''; sugI = -1; };
  const showHistSug = () => { sugs = hist.slice(0, 6).map(t => ({ t, h: 1 })); drawSug(); };
  async function suggest(v) {
    const mine = hist.filter(h => h.toLowerCase().includes(v.toLowerCase())).slice(0, 3).map(t => ({ t, h: 1 })); sugs = mine; drawSug();
    try { const r = await A.api('/api/web/suggest?q=' + encodeURIComponent(v)); if ($('wsq').value.trim() !== v) return; const seen = new Set(mine.map(m => m.t.toLowerCase())); sugs = mine.concat((r.suggestions || []).filter(x => !seen.has(x.toLowerCase())).map(t => ({ t }))).slice(0, 8); drawSug(); } catch (e) { }
  }

  /* ---------- home ---------- */
  async function home() {
    const b = $('wsbody'); if (!b) return; hideSug(); toTop();
    let h = '<div class="ws-hero"><h1>Search <b>Moundshroud’s</b> offline archived internet</h1><div class="mute" style="max-width:640px;margin:0 auto;line-height:1.5">Ask anything. Pages open in tabs right here, like a normal browser. Moundshroud searches every offline library on this PC (encyclopedia, Q&amp;A sites, guides, medical, survival, dictionary, books) plus your documents and notes, and writes a short answer with sources. Nothing leaves your computer.</div><div id="wsslot"></div><div id="wsntpbtns" style="display:flex;gap:8px;justify-content:center;flex-wrap:wrap;margin:10px 0 0"></div></div>';
    /* the browser's own front door says the loudest thing about this internet: it is all in scope, and moundshell is how */
    h += '<div style="max-width:820px;margin:0 auto 18px"><div class="ws-card" style="border-color:rgba(255,176,84,.42);background:linear-gradient(115deg,rgba(255,150,60,.16),rgba(255,70,70,.05))">' +
      '<div style="display:flex;gap:12px;align-items:flex-start;flex-wrap:wrap">' +
      '<div style="width:44px;height:44px;flex:none;border-radius:13px;display:grid;place-items:center;font-size:21px;color:#1a1207;background:linear-gradient(140deg,#ffcf8b,#ff9d6b)">🐚</div>' +
      '<div style="flex:1;min-width:230px">' +
      '<b style="font-size:15px">Every site here can be breached from moundshell</b>' +
      '<div class="small mute" style="margin-top:3px;line-height:1.65">The fake internet and the fake dark web are both in scope. Every site keeps its accounts at <code>/dump/users.csv</code> — names, e-mails, the IP each one signed in from and the password it stored — and every site prints files you can download and read. Some crack easily, some barely at all: what a site is decides how hard it is.</div>' +
      '<div class="small" style="margin-top:9px;line-height:1.95"><b>Open moundshell</b> — press <b>Ctrl + T</b> (⌘T on a Mac) anywhere, even with a page open; it closes the shell again · click the <b>🐚</b> button in the top bar · or <b>Settings → “Open the moundshell” → Open the shell</b>.</div>' +
      '<div class="small mute" style="margin-top:7px;line-height:1.95">Then: <code>paths &lt;host&gt;</code> what a tester tries · <code>leaked &lt;host&gt;</code> the user table · <code>breach &lt;host&gt;</code> the simulated break-in · <code>nmap &lt;ip&gt;</code> then <code>ssh user@ip</code> · <code>guide</code> walks the whole thing start to finish.</div>' +
      '<div style="margin-top:11px;display:flex;gap:10px;flex-wrap:wrap;align-items:center"><button class="ib" id="wshell">Open moundshell</button><span class="small mute">Ctrl + T toggles it shut</span></div>' +
      '</div></div></div></div>';
    h += '<div style="max-width:820px;margin:2px auto 18px"><div class="ws-card" style="display:flex;gap:14px;align-items:center;flex-wrap:wrap;border-color:rgba(139,124,255,.34);background:linear-gradient(115deg,rgba(139,124,255,.16),rgba(70,211,255,.05))"><div style="width:44px;height:44px;flex:none;border-radius:13px;display:grid;place-items:center;font-size:20px;color:#080a12;background:linear-gradient(140deg,#a99bff,#7fe4ff)">🔖</div><div style="flex:1;min-width:220px"><b style="font-size:15px">MoundHub</b><div class="small mute" style="margin-top:2px;line-height:1.6">Your repositories, at <b>moundhub.com</b>. Type that address above, or open the site here.</div></div><button class="ib" id="wshub">Open MoundHub</button></div></div>';
    h += '<div id="wstiles"></div><div style="max-width:820px;margin:14px auto"><div class="small mute" style="margin-bottom:6px">Try</div>' + EXAMPLES.slice().sort(() => Math.random() - .5).slice(0, 6).map(x => '<span class="ws-chip" data-q="' + esc2(x) + '">' + esc2(x) + '</span>').join('') + '</div>';
    if (hist.length) h += '<div style="max-width:820px;margin:14px auto"><div class="row" style="margin-bottom:6px"><span class="small mute">Recent searches</span><span class="sp"></span><a id="wsclearh" class="small mute" style="cursor:pointer">Clear</a></div>' + hist.slice(0, 8).map((x, i) => '<div class="ws-res" data-q="' + esc2(x) + '" style="padding:7px 4px;display:flex;gap:10px;align-items:center" onclick="this.dispatchEvent(new Event(\'x\'))"><span class="mute">🕒</span><span style="flex:1">' + esc2(x) + '</span><span class="mute" data-rmh="' + i + '" title="Remove">×</span></div>').join('') + '</div>';
    b.innerHTML = h + '<div id="wsbm" style="max-width:820px;margin:14px auto"></div><div id="wslibs" style="max-width:820px;margin:18px auto"></div>'; try { A.bm.render($('wsbm'), 'web', bm => A.lib.openUrl(bm.u, bm.t, { bm })); } catch (e) { } toSlot(); tiles();
    try { if (!books) books = (await A.api('/api/lib/books')).books || []; const g = {}; books.forEach(x => { const k = x.group || 'ref'; (g[k] = g[k] || { n: 0, mb: 0 }); g[k].n++; g[k].mb += x.sizeMB; }); const el = $('wslibs'); if (el) el.innerHTML = '<div class="small mute" style="margin-bottom:6px">Searching ' + books.length + ' libraries (' + Math.round(books.reduce((a, x) => a + x.sizeMB, 0) / 1024) + ' GB)</div>' + Object.keys(GN).filter(k => g[k]).map(k => '<span class="ws-chip" data-scope="' + k + '" title="Search only this kind">' + GN[k][1] + ' ' + GN[k][0] + ' <span class="mute">' + g[k].n + '</span></span>').join(''); } catch (e) { }
  }

  /* shortcut tiles on the new tab page: favorite pages first, then the pages you opened most recently */
  const TC = ['#5b8def', '#e8590c', '#2f9e44', '#9c36b5', '#d6336c', '#0c8599', '#f08c00', '#6741d9', '#1971c2', '#c2255c'];
  function tiles() { const el = $('wstiles'); if (!el) return; let its = []; try { const seen = new Set(); A.fav.list().filter(x => x.k === 'page' && /^\//.test(x.u)).concat(A.fav.history().filter(x => /^\/wiki\/content/.test(x.u))).forEach(x => { if (!seen.has(x.u) && its.length < 10) { seen.add(x.u); its.push(x); } }); } catch (e) { } if (!its.length) { el.innerHTML = ''; return; }
    el.innerHTML = '<div class="ntp-h">SHORTCUTS</div><div class="ntp-tiles">' + its.map((x, i) => '<div class="ntp-tile" data-open="' + esc2(x.u) + '" data-t="' + esc2(x.t) + '"><div class="ic" style="background:' + TC[(x.t || '?').charCodeAt(0) % TC.length] + '">' + esc2((String(x.t || '?').match(/[\p{L}\p{N}]/u) || ['?'])[0].toUpperCase()) + '</div><div class="nm">' + esc2(String(x.t).slice(0, 40)) + '</div></div>').join('') + '</div>'; }
  /* ---------- a page from this PC: paste its .html file name and it opens here, right-click for the source ---------- */
  const htmlName = v => /\.(html?|xhtml)$/i.test(String(v || '').trim().replace(/^["']|["']$/g, ''));
  function showLocalPage(f) {
    const w = $('wswrap'); if (!w) return; const old = $('wsreader'); if (old) old.remove();
    const rdr = document.createElement('div'); rdr.id = 'wsreader'; rdr.className = 'ws-reader';
    rdr.innerHTML = '<div class="ws-rbar"><button class="ib" id="wsrback">← Back</button><b style="flex:1;min-width:100px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap" title="' + esc2(f.path || f.name) + '">📄 ' + esc2(f.name) + '</b>' +
      '<button class="ib" id="wsrsrc">📄 View source</button><button class="ib" id="wsrrun">🖥️ Run in terminal</button><button class="ib" id="wsrcopy">📋 Copy path</button><button class="ib page-fs-btn" id="wsrfs" title="Full screen this page (Esc to exit)">⛶ Full screen</button></div>' +
      '<iframe id="wsrframe" sandbox="allow-scripts allow-forms allow-popups allow-modals" title="' + esc2(f.name) + '"></iframe>' +
      '<pre id="wsrsource" style="display:none;flex:1;overflow:auto;margin:0;padding:14px 18px;background:#0b0f17;color:#d7e0f5;font-size:12.5px;line-height:1.55;white-space:pre-wrap"></pre>';
    w.appendChild(rdr);
    const frame = $('wsrframe'), src = $('wsrsource'); src.textContent = String(f.text || '');
    const inject = '<scr' + 'ipt>document.addEventListener("contextmenu",function(e){e.preventDefault();try{parent.postMessage({moundshroudSource:1},"*")}catch(x){}return false},true);</scr' + 'ipt>';
    const html = String(f.text || '');
    frame.srcdoc = /<\/body>/i.test(html) ? html.replace(/<\/body>/i, inject + '</body>') : html + inject;
    $('wsrsrc').onclick = () => { const on = src.style.display === 'none'; src.style.display = on ? 'block' : 'none'; frame.style.display = on ? 'none' : 'block'; $('wsrsrc').textContent = on ? '🌐 Preview' : '📄 View source'; };
    $('wsrback').onclick = () => { rdr.remove(); openLocal.file = null; };
    $('wsrrun').onclick = () => { if (A.codeRunner) A.codeRunner.open({ name: f.name, code: f.text }); };
    $('wsrcopy').onclick = () => A.copy(f.path || f.name);
    $('wsrfs').onclick = () => { if (A.pageFS) A.pageFS.toggle(); };
    if (A.pageFS) A.pageFS.refresh();
    rdr.addEventListener('contextmenu', e => { e.preventDefault(); if (src.style.display === 'none') $('wsrsrc').click(); });
    openLocal.file = f;
  }
  const pickHtml = () => { if (!A.codeRunner) return; A.codeRunner.pickFile(f => showLocalPage({ name: f.name, text: f.text, path: '' })); };
  async function openLocal(v) {
    toTop(); if (!built) return; hideSug(); v = String(v).trim().replace(/^["']|["']$/g, '');
    query = v; $('wsq').value = v; addHist(v);
    const b = $('wsbody'); b.innerHTML = '<div class="mute" style="padding:30px 4px">Opening ' + esc2(v) + ' from this PC…</div>';
    let r; try { r = await A.api('/api/file/read?path=' + encodeURIComponent(v)); } catch (e) { r = { error: e.message }; }
    if (!r || r.error) { b.innerHTML = '<div class="ws-card"><b>Could not open that page</b><div class="small mute" style="margin:4px 0 10px">' + esc2((r && r.error) || 'The file could not be read.') + '</div><button class="ib" id="wsopenpick">📂 Choose the file on this PC…</button></div>'; const p = $('wsopenpick'); if (p) p.onclick = pickHtml; return; }
    b.innerHTML = '';
    showLocalPage(r);
  }
  addEventListener('message', e => { if (!e.data || !e.data.moundshroudSource) return; const btn = $('wsrsrc'); if (btn && $('wsreader')) { const src = $('wsrsource'); if (src && src.style.display === 'none') btn.click(); } });

  /* ---------- searching ---------- */
  let srcs = [], lastFiles = { notes: [], docs: [] };
  async function run(v, keepScope) {
    v = String(v || '').trim(); if (!v) return home(); if (!built) return; toTop();
    if (/^(?:https?:\/\/)?(?:www\.)?moundhub\.com\/?$/i.test(v)) { hideSug(); A.lib.hub(); return; }
    if (htmlName(v)) { openLocal(v); return; }
    if (dictOn && v.split(/\s+/).length <= 3 && /^[\p{L}'\u2019 -]{1,40}$/u.test(v)) { addHist(v); hideSug(); A.lib.define(v); return; } if (!keepScope && v !== query) scope = 'all'; query = v; $('wsq').value = v; hideSug(); addHist(v);
    const b = $('wsbody'), my = ++seq; if (ctl) { try { ctl.abort(); } catch (e) { } } ctl = null; const rdr = $('wsreader'); if (rdr) rdr.remove();
    b.innerHTML = '<div class="mute" style="padding:30px 4px">Searching your libraries...</div>';
    let r; try { r = await A.api('/api/web/search', { q: v, scope, n: 40 }); } catch (e) { b.innerHTML = '<div class="mute" style="padding:30px 4px">Search is not available right now (' + esc2(e.message) + ').</div>'; return; }
    if (my !== seq) return;
    if (r.slow && !(r.items || []).length) { b.innerHTML = '<div class="mute" style="padding:30px 4px">' + esc2(r.note || 'The libraries are slow to answer right now.') + ' <button class="ib" id="wsretry">Try again</button></div>'; const rb = $('wsretry'); if (rb) rb.onclick = () => run(v, true); return; }
    res = r; lastItems = r.items || []; lastFiles = r.files || { notes: [], docs: [] }; paint(my);
  }
  function paint(my) {
    const r = res, b = $('wsbody'); const items = lastItems, f = lastFiles, nf = f.notes.length + f.docs.length;
    const tabs = [['all', 'All', items.length]].concat(Object.keys(GN).filter(k => (r.counts || {})[k] || scope === k).map(k => [k, GN[k][0], (r.counts || {})[k] || 0]));
    let h = '<div class="ws-tabs">' + tabs.map(([k, n, c]) => '<span class="ws-tab' + (scope === k ? ' on' : '') + '" data-scope="' + k + '">' + n + (k === 'all' ? '' : '<small>' + c + '</small>') + '</span>').join('') + (nf ? '<span class="ws-tab" data-scope="all" onclick="document.getElementById(\'wsfiles\')&&document.getElementById(\'wsfiles\').scrollIntoView({behavior:\'smooth\'})">My files &amp; notes<small>' + nf + '</small></span>' : '') + '<span class="sp"></span><span class="small mute" style="align-self:center">' + items.length + ' results in ' + ((r.took || 0) / 1000).toFixed(1) + ' s</span></div>';
    let main = '', side = '';
    const calc = A.calc && A.calc.try ? A.calc.try(query) : null; if (calc) main += '<div class="ws-card"><div class="small mute">Calculator</div><div style="font-size:24px;font-weight:700;margin-top:2px">' + esc2(calc.label) + '</div><button class="ib" style="margin-top:8px" onclick="A.copy(' + esc2(JSON.stringify(calc.copy)) + ');A.toast(\'Copied\')">Copy</button></div>';
    const oneWord = /^[\p{L}'\u2019-]{2,30}$/u.test(query.trim()), def = items.find(i => i.group === 'dict' && (!oneWord || i.title.toLowerCase() === query.trim().toLowerCase())); if (def && (oneWord || /\b(define|definition|meaning|mean|etymology|word)\b/i.test(query))) main += '<div class="ws-card" id="wsdef"><div class="small mute">📕 Dictionary</div><b style="font-size:19px">' + esc2(def.title) + '</b><div id="wsdeft" style="margin-top:4px"><span class="mute small">Loading the definition...</span></div></div>';
    if (answerOn && scope === 'all' && items.length) main += '<div class="ws-card ws-ans" id="wsans"><div class="row" style="align-items:center"><h4 style="margin:0">✨ ANSWER</h4><span class="sp"></span><a id="wsai" class="small mute" style="cursor:pointer" title="Turn the written answer off">hide</a></div><div class="ws-anst" id="wsanst"><span class="mute">Reading the best pages...</span></div><div id="wsanss" style="margin-top:8px"></div></div>';
    else if (!answerOn && scope === 'all') main += '<div class="small mute" style="margin-bottom:8px"><a id="wsai" style="cursor:pointer">✨ Turn on written answers</a></div>';
    if (r.error) main += '<div class="ws-card mute">' + esc2(r.error) + '</div>';
    main += items.map(it => '<div class="ws-res" data-u="' + esc2(it.url) + '" data-t="' + esc2(it.title) + '"><div class="ws-crumb"><span class="ws-badge">' + (GN[it.group] ? GN[it.group][1] + ' ' + GN[it.group][0] : '') + '</span><span>' + crumb(it) + '</span><span style="flex:1"></span><span class="ws-star" data-fav="' + esc2(it.url) + '" data-t="' + esc2(it.title) + '" title="Favorite this page" style="cursor:pointer;font-size:16px">' + (A.fav.has(it.url) ? '⭐' : '☆') + '</span></div><div class="ws-title">' + esc2(it.title) + '</div>' + (it.snippet ? '<div class="ws-snip">' + snip(it.snippet) + '</div>' : '') + '</div>').join('');
    if (!items.length && !calc) main += '<div class="mute" style="padding:20px 4px;line-height:1.6">No pages matched "' + esc2(query) + '".<br>Try fewer or different words<span class="ws-chat-suggestion">, or <a data-ask="' + esc2(query) + '" style="color:var(--acc);cursor:pointer">ask the chat assistant</a>, which can also answer from its own knowledge</span>.</div>';
    if (nf) main += '<div id="wsfiles" class="ws-card" style="margin-top:14px"><b>From your files and notes</b>' + f.notes.map(x => '<div class="ws-res" data-note="' + esc2(x.path) + '"><div class="ws-crumb"><span class="ws-badge">📝 Note</span></div><div class="ws-title">' + esc2(x.title) + '</div><div class="ws-snip">' + snip(String(x.snippet || '').replace(/<[^>]+>/g, '')) + '</div></div>').join('') + f.docs.map((x, i) => '<div class="ws-res" data-doc="' + i + '"><div class="ws-crumb"><span class="ws-badge">📄 File</span>' + (x.page ? '<span>page ' + x.page + '</span>' : '') + '</div><div class="ws-title">' + esc2(x.title) + '</div><div class="ws-snip">' + snip(String(x.snippet || '').replace(/<[^>]+>/g, '')) + '</div></div>').join('') + '</div>';
    if (r.panel) side += '<div class="ws-card ws-panel"><div class="small mute">' + esc2(r.panel.book) + '</div><h3>' + esc2(r.panel.title) + '</h3><div class="small" style="line-height:1.6;margin-top:4px">' + esc2(r.panel.text) + '</div><div class="row" style="gap:8px;margin-top:10px;flex-wrap:wrap"><button class="ib" data-open="' + esc2(r.panel.url) + '" data-t="' + esc2(r.panel.title) + '">Read the article</button><button class="ib" data-ask="Explain ' + esc2(r.panel.title) + ' simply">Explain simply</button></div></div>';
    const rel = [...new Set(items.filter(i => i.group === 'wiki' || i.group === 'ref').map(i => i.title))].filter(t => t.toLowerCase() !== query.toLowerCase() && t.length < 60 && !/^list of /i.test(t)).slice(0, 8);
    if (rel.length) side += '<div class="ws-card"><b>Related</b><div style="margin-top:8px">' + rel.map(t => '<span class="ws-chip" data-q="' + esc2(t) + '">' + esc2(t) + '</span>').join('') + '</div></div>';
    side += '<div class="ws-card small mute" style="line-height:1.5">Searched ' + Object.values(r.counts || {}).filter(Boolean).length + ' kinds of sources.<span class="ws-chat-suggestion"> <a data-ask="' + esc2(query) + '" style="color:var(--acc);cursor:pointer">Ask the chat assistant</a> for a longer conversation.</span></div>';
    b.innerHTML = h + '<div class="ws-cols"><div>' + main + '</div><div>' + side + '</div></div>'; b.scrollTop = 0;
    if (def && $('wsdeft')) A.api('/api/lib/text', { link: def.url }).then(t => { const el = $('wsdeft'); if (el) el.innerHTML = dictCard(dictParse(t.text), def.title, def.url); }).catch(() => { });
    if (answerOn && scope === 'all' && items.length) answer(my);
  }

  /* ---------- the written answer ---------- */
  async function answer(my) {
    const txt = $('wsanst'), srcEl = $('wsanss'); if (!txt) return;
    const cand = []; const seenB = {}; (res.panel ? [{ title: res.panel.title, url: res.panel.url, book: res.panel.book }] : []).concat(lastItems.filter(i => i.group !== 'dict')).forEach(i => { if (cand.length >= 4) return; if (cand.some(c => c.url === i.url)) return; const k = i.book; if ((seenB[k] || 0) >= 2) return; seenB[k] = (seenB[k] || 0) + 1; cand.push({ title: i.title, url: i.url, book: i.book }); });
    let pass = []; try { pass = (await A.api('/api/web/passages', { links: cand, max: 1700 })).sources || []; } catch (e) { }
    if (my !== seq || !$('wsanst')) return; srcs = pass;
    if (!pass.length) { txt.innerHTML = '<span class="mute">No page text could be read for this question.</span>'; return; }
    srcEl.innerHTML = '<span class="small mute">Sources: </span>' + pass.map((s, i) => '<span class="ws-chip" data-cite="' + (i + 1) + '" title="' + esc2(s.book) + '">[' + (i + 1) + '] ' + esc2(s.title.slice(0, 40)) + '</span>').join('');
    const medical = pass.some(s => /MDWiki|WikEM|Medical|medicine/i.test(s.book)), now = new Date().toLocaleDateString([], { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
    let sys = 'You are MOUNDSHROUD Search, answering a question for the user from pages in their own offline libraries. Today is ' + now + '. Answer the question directly: start with the answer in one to three sentences, then add a short explanation or numbered steps only if they help. Use the numbered sources for facts and cite them like [1] or [2] right after the claim. If the sources do not answer the question, say so in one sentence and then give your best general-knowledge answer, clearly marked as not from the sources. Never invent a citation or a source. Plain, friendly and accurate. Keep it under about 170 words unless steps are needed.\n';
    pass.forEach((s, i) => { sys += '\n[' + (i + 1) + '] ' + s.title + ' (' + s.book + ')\n' + s.text + '\n'; }); if (medical) sys += '\nThis involves medical information: give the facts from the sources and remind the user in one short sentence that this is reference information, not a diagnosis, and to call emergency services for emergencies.';
    const model = ($('model') && $('model').value) || ''; let out = '';
    const show = fin => { const el = $('wsanst'); if (!el || my !== seq) return; let h2 = typeof md === 'function' ? md(out) : esc2(out).replace(/\n/g, '<br>'); h2 = h2.replace(/\[(\d{1,2})\]/g, (m, n) => +n >= 1 && +n <= pass.length ? '<span class="ws-cite" data-cite="' + n + '" title="' + esc2(pass[+n - 1].title) + '">[' + n + ']</span>' : m); el.innerHTML = h2 + (fin ? '<div class="row" style="gap:8px;margin-top:8px"><button class="ib" data-ask="' + esc2(query) + '">Continue in chat</button><button class="ib" onclick="A.copy(document.getElementById(\'wsanst\').innerText);A.toast(\'Copied\')">Copy</button></div>' : ''); };
    try {
      ctl = new AbortController(); const r = await fetch('/api/chat', { method: 'POST', signal: ctl.signal, body: JSON.stringify({ model, stream: true, think: false, keep_alive: '3m', options: { temperature: .2 }, messages: [{ role: 'system', content: sys }, { role: 'user', content: query }] }) });
      if (!r.ok) throw new Error('HTTP ' + r.status); const rdr = r.body.getReader(), dec = new TextDecoder(); let buf = '';
      for (;;) { const { value, done } = await rdr.read(); if (done) break; if (my !== seq) { try { ctl.abort(); } catch (e) { } return; } buf += dec.decode(value, { stream: true }); let i; while ((i = buf.indexOf('\n')) >= 0) { const ln = buf.slice(0, i).trim(); buf = buf.slice(i + 1); if (!ln) continue; let j; try { j = JSON.parse(ln); } catch (e) { continue; } if (j.error) throw new Error(j.error); if (j.message && j.message.content) { out += j.message.content; show(false); } } }
      if (!out.trim()) throw new Error('empty'); show(true);
    } catch (e) {
      if (my !== seq) return; if (e.name === 'AbortError') return;
      const el = $('wsanst'); if (el) { const lead = pass[0].text.replace(/\s+/g, ' ').slice(0, 520), cut = lead.lastIndexOf('. '); el.innerHTML = '<div>' + esc2(cut > 200 ? lead.slice(0, cut + 1) : lead) + ' <span class="ws-cite" data-cite="1">[1]</span></div><div class="small mute" style="margin-top:6px">The AI engine is not available, so this is the opening of the best page. Start the AI engine for written answers.</div>'; }
    }
  }

  /* ---------- reading a page inside the tab ---------- */
  function openPage(url, title) {
    if (!/^\//.test(url)) return; if (A.lib && A.lib.openUrl) { A.lib.openUrl(url, title); return; } const w = $('wswrap'); let rdr = $('wsreader'); if (rdr) rdr.remove(); rdr = document.createElement('div'); rdr.id = 'wsreader'; rdr.className = 'ws-reader';
    rdr.innerHTML = '<div class="ws-rbar"><button class="ib" id="wsrback">← Results</button><b style="flex:1;min-width:120px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">' + esc2(title || '') + '</b><button class="ib" id="wsrask">💬 Ask about this page</button><button class="ib" id="wsrfav">' + (A.fav.has(url) ? '⭐ Favorited' : '☆ Favorite') + '</button><button class="ib" id="wsrlib">📚 Open in Library</button><button class="ib page-fs-btn" id="wsrfs" title="Full screen this page (Esc to exit)">⛶ Full screen</button></div><iframe id="wsrframe"></iframe>'; w.appendChild(rdr);
    const fr = $('wsrframe'); A.libframe.attach(fr, { load: () => fr.lf.css(A.lib && A.lib.dark ? A.lib.dark() : 'html,body{background:#0e1016!important;color:#dfe4f7!important}a{color:#a99bff!important}'), ready: () => fr.lf.text().then(x => { fr._text = x; }), key: m => { if (m.key === 'Escape') closePage(); } }); fr.src = A.libframe.src(url);
    try { A.fav.visit(url, title); } catch (e) { } $('wsrfav').onclick = () => { const on = A.fav.toggle({ u: url, t: title || url, k: 'page' }); $('wsrfav').textContent = on ? '⭐ Favorited' : '☆ Favorite'; };
    $('wsrfs').onclick = () => { if (A.pageFS) A.pageFS.toggle(); }; if (A.pageFS) A.pageFS.refresh();
    $('wsrback').onclick = closePage; $('wsrlib').onclick = () => { closePage(); A.lib.openUrl(url, title); };
    $('wsrask').onclick = () => { const t = fr._text || ''; closePage(); A.showTab('chat'); A.chat.ask('Summarize the article "' + (title || 'this page') + '" in a few clear paragraphs.\n\nARTICLE:\n' + t.slice(0, 9000), { noLocal: true, sources: [] }); };
  }
  const closePage = () => { const r = $('wsreader'); if (r) r.remove(); };
  /* lib.js owns the tab; it calls mount() with the homepage element, and search() to run a query there. run() is what other tabs call to start a search. */
  A.websearch = { dict: on => { setDict(on, true); }, mount(host) { if (!host) return; if (P !== host || !P.querySelector('#wswrap')) { P = host; built = false; } if (!built) { build(); home(); } }, search(v) { if (!built) return; $('wsq').value = v; run(v); }, focus() { const q = $('wsq'); if (q) setTimeout(() => q.focus(), 60); }, run: q => { if (A.lib && A.lib.search) A.lib.search(q); }, open: () => { A.showTab('web'); }, state: () => ({ query, scope, res }) };
  document.addEventListener('keydown', e => { if (e.key === 'Escape' && $('wsreader')) { e.stopPropagation(); closePage(); } }, true);
})();

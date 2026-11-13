// News: headlines from 120+ outlets (news, investigative, specialist and official sources), grouped into events, ranked by how many independent outlets confirm them.
// The server (lib/news.js) fetches and groups; this page shows events, the coverage of each across the spectrum and the
// world, every outlet's own article, a grounded AI brief (it may only use what the articles say), a reader, a spoken
// briefing, followed topics and the source list. Nothing is fetched unless internet access is switched on.
(() => {
  const root = document.getElementById('p-news'); if (!root) return;
  const LEAN = { L: ['Left', '#3b6fd8'], LL: ['Leans left', '#86a8f5'], C: ['Centre', '#c4c2d4'], LR: ['Leans right', '#f2a08f'], R: ['Right', '#dc4f48'] };
  const KIND = { factcheck: 'Fact-checker', investigative: 'Investigative', specialist: 'Specialist', primary: 'Official source', wire: 'Wire service', public: 'Public broadcaster', paper: 'Newspaper', tv: 'TV news', digital: 'Digital news', magazine: 'Magazine', intl: 'International', opinion: 'Mostly opinion', special: 'Specialist', custom: 'Your feed' };
  const CATS = [['front', '⭐ Front page'], ['top', '🔥 Top stories'], ['desk', '🔎 Expert desk'], ['official', '🏛 Official'], ['fact', '✅ Fact checks'], ['opinion', '💬 Opinion'], ['beats', '🎯 Beats'], ['saved', '🔖 Saved'], ['us', '🇺🇸 U.S.'], ['world', '🌍 World'], ['politics', '🏛 Politics'], ['business', '📈 Business'], ['tech', '💻 Tech'], ['science', '🔬 Science'], ['health', '🩺 Health'], ['sports', '🏅 Sports'], ['culture', '🎭 Culture'], ['follow', '★ Following'], ['more', '📄 Single-source']];
  const CATNAME = { us: 'U.S.', world: 'World', politics: 'Politics', business: 'Business', tech: 'Tech', science: 'Science', health: 'Health', sports: 'Sports', culture: 'Culture' };
  const J = (k, d) => { try { return JSON.parse(ls.get(k, '')) || d; } catch (e) { return d; } };
  let D = null, st = { cat: 'front', q: '', sort: 'top', wide: false, view: 'list', sel: null, tab: 'news' }, loading = false, timer = 0, aiCtl = null;
  let follows = J('news_follow', []), seen = new Set(J('news_seen', [])), aiCache = J('news_ai', {});
  const saveSeen = () => ls.set('news_seen', JSON.stringify([...seen].slice(-3000)));
  const SRC = () => Object.fromEntries(((D && D.sources) || []).map(s => [s.id, s]));

  const css = `.nw{display:flex;flex-direction:column;flex:1;height:100%;min-height:0;overflow:hidden}
.nw-top{padding:12px 16px 8px;border-bottom:1px solid var(--line);display:flex;flex-direction:column;gap:8px}
.nw-row{display:flex;gap:8px;align-items:center;flex-wrap:wrap}
.nw-h{margin:0;font-size:22px;letter-spacing:-.01em}
.nw-stat{color:var(--mute);font-size:12.5px}
.nw-chips{display:flex;gap:6px;flex-wrap:wrap}
.nw-chip{border:1px solid var(--line);background:var(--panel);color:var(--text);border-radius:999px;padding:5px 11px;font-size:12.5px;cursor:pointer}
.nw-chip.on{background:var(--acc);border-color:var(--acc);color:#fff}
.nw-chip i{font-style:normal;opacity:.7;margin-left:4px;font-size:11px}
.nw-q{flex:1;min-width:180px;max-width:360px}
.nw-banner{margin:10px 16px 0;padding:10px 12px;border:1px solid var(--warn);border-radius:10px;background:rgba(255,194,102,.08);font-size:13px;display:flex;gap:10px;align-items:center;flex-wrap:wrap}
.nw-main{flex:1;min-height:0;display:grid;grid-template-columns:minmax(320px,44%) 1fr}
.nw-list{overflow:auto;padding:10px 12px 30px;border-right:1px solid var(--line)}
.nw-det{overflow:auto;padding:16px 22px 40px}
.nw-ev{display:flex;gap:12px;padding:11px;border-radius:12px;cursor:pointer;border:1px solid transparent;margin-bottom:6px;position:relative}
.nw-ev:hover{background:var(--panel)}
.nw-ev.on{background:var(--panel2);border-color:var(--line)}
.nw-ev.seen .nw-t{color:var(--mute);font-weight:600}
.nw-ev .dot{position:absolute;left:2px;top:16px;width:6px;height:6px;border-radius:50%;background:var(--acc2)}
.nw-th{width:96px;height:68px;object-fit:cover;border-radius:8px;flex:none;background:var(--panel2)}
.nw-b{min-width:0;flex:1}
.nw-meta{font-size:11.5px;color:var(--mute);display:flex;gap:6px;align-items:center;flex-wrap:wrap}
.nw-cat{color:var(--acc2);font-weight:600;text-transform:uppercase;letter-spacing:.05em;font-size:10.5px}
.nw-dev{color:var(--bad);font-weight:600}
.nw-dev::before{content:'';display:inline-block;width:6px;height:6px;border-radius:50%;background:var(--bad);margin-right:4px;animation:nwp 1.6s infinite}
@keyframes nwp{50%{opacity:.25}}
.nw-t{display:block;font-size:14.5px;line-height:1.3;margin:3px 0 4px;font-weight:700}
.nw-s{font-size:12.5px;color:var(--mute);line-height:1.4;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden}
.nw-foot{display:flex;gap:8px;align-items:center;margin-top:6px;font-size:11.5px;color:var(--mute);flex-wrap:wrap}
.nw-conf{font-weight:700;border-radius:6px;padding:1px 7px;font-size:11px}
.nw-conf.c1{background:rgba(255,107,129,.15);color:var(--bad)}.nw-conf.c2{background:rgba(255,194,102,.15);color:var(--warn)}.nw-conf.c3{background:rgba(94,230,168,.14);color:var(--ok)}.nw-conf.c4{background:rgba(94,230,168,.25);color:var(--ok)}
.nw-bar{display:flex;height:6px;width:90px;border-radius:4px;overflow:hidden;background:var(--panel2)}
.nw-bar.big{height:12px;width:100%;max-width:520px;border-radius:6px}
.nw-bar i{display:block;height:100%}
.nw-legend{display:flex;gap:12px;flex-wrap:wrap;font-size:12px;color:var(--mute);margin-top:6px}
.nw-legend b{display:inline-block;width:9px;height:9px;border-radius:2px;margin-right:4px;vertical-align:-1px}
.nw-dh{font-size:24px;line-height:1.25;margin:6px 0 10px;letter-spacing:-.01em}
.nw-dimg{width:100%;max-height:300px;object-fit:cover;border-radius:12px;margin:4px 0 12px}
.nw-card{background:var(--panel);border:1px solid var(--line);border-radius:12px;padding:12px 14px;margin:12px 0}
.nw-card h4{margin:0 0 8px;font-size:13px;text-transform:uppercase;letter-spacing:.06em;color:var(--mute)}
.nw-ai{font-size:14px;line-height:1.55}
.nw-ai ul{margin:4px 0 8px 18px;padding:0}
.nw-ai p{margin:4px 0 8px}
.nw-art{padding:10px 0;border-top:1px solid var(--line)}
.nw-art:first-child{border-top:0}
.nw-src{font-size:12px;display:flex;gap:6px;align-items:center;flex-wrap:wrap;color:var(--mute)}
.nw-src b{color:var(--text)}
.nw-tag{border:1px solid var(--line);border-radius:5px;padding:0 5px;font-size:10.5px}
.nw-tag.op{border-color:var(--warn);color:var(--warn)}
.nw-at{display:block;font-size:14.5px;font-weight:600;margin:3px 0;color:var(--text);text-decoration:none;line-height:1.3}
.nw-at:hover{text-decoration:underline}
.nw-ad{font-size:12.5px;color:var(--mute);line-height:1.45}
.nw-acts{display:flex;gap:6px;margin-top:5px}
.nw-empty{padding:40px 20px;color:var(--mute);text-align:center;line-height:1.6}
.nw-tabs{display:flex;gap:6px;margin-bottom:6px}
.nw-read{position:fixed;inset:0;background:rgba(0,0,0,.55);z-index:80;display:flex;justify-content:center;padding:30px 12px}
.nw-read>div{background:var(--bg);border:1px solid var(--line);border-radius:14px;max-width:760px;width:100%;overflow:auto;padding:22px 28px 40px}
.nw-read p{font-size:16px;line-height:1.65;margin:0 0 12px}
.nw-brief{max-width:860px;margin:0 auto;padding:16px 20px 40px;overflow:auto;flex:1;min-height:0}
.nw-bi{display:flex;gap:12px;padding:12px 0;border-top:1px solid var(--line);cursor:pointer}
.nw-bn{font-size:24px;font-weight:800;color:var(--acc);width:30px;flex:none}
.nw-srcs{overflow:auto;padding:14px 18px 40px;flex:1;min-height:0}
.nw-tbl{width:100%;border-collapse:collapse;font-size:13px}
.nw-tbl td,.nw-tbl th{padding:6px 8px;border-bottom:1px solid var(--line);text-align:left;vertical-align:middle}
.nw-tbl th{color:var(--mute);font-weight:600;font-size:12px}
.nw-back{display:none}
@media (max-width:900px){.nw-main{grid-template-columns:1fr}.nw-det{display:none}.nw-main.det .nw-list{display:none}.nw-main.det .nw-det{display:block}.nw-back{display:inline-flex}}`;
  if (!document.getElementById('nwcss')) { const s = document.createElement('style'); s.id = 'nwcss'; s.textContent = css; document.head.appendChild(s); }

  /* ---------- small helpers ---------- */
  const ago = t => { if (!t) return ''; const m = Math.round((Date.now() - t) / 60000); if (m < 1) return 'just now'; if (m < 60) return m + ' min ago'; const h = Math.round(m / 60); if (h < 24) return h + ' h ago'; return Math.round(h / 24) + ' d ago'; };
  const clock = t => new Date(t).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }) + (new Date(t).toDateString() === new Date().toDateString() ? '' : ', ' + new Date(t).toLocaleDateString([], { weekday: 'short' }));
  const conf = n => n >= 8 ? ['c4', '✔✔ Major story · ' + n + ' outlets'] : n >= 4 ? ['c3', '✔ Widely reported · ' + n + ' outlets'] : n >= 2 ? ['c2', 'Confirmed by ' + n + ' outlets'] : ['c1', 'Single source'];
  const img = (u, cls) => u ? '<img class="' + cls + '" src="/api/news/img?u=' + encodeURIComponent(u) + '" loading="lazy" referrerpolicy="no-referrer" alt="" onerror="this.remove()">' : '';
  function leanBar(lean, outlets, big) {
    const S = SRC(), total = outlets.length || 1, unr = outlets.filter(o => !(S[o] || {}).lean).length;
    return '<div class="nw-bar' + (big ? ' big' : '') + '" title="Coverage by approximate lean">' + Object.keys(LEAN).map(k => lean[k] ? '<i style="width:' + (lean[k] / total * 100) + '%;background:' + LEAN[k][1] + '"></i>' : '').join('') + (unr ? '<i style="width:' + (unr / total * 100) + '%;background:#4a5068"></i>' : '') + '</div>';
  }
  function blind(e) {
    const l = e.lean, left = l.L + l.LL, right = l.R + l.LR, rated = left + right + l.C;
    if (rated < 3) return '';
    if (left / rated >= .8 && right === 0) return 'Covered almost only by left-leaning outlets so far.';
    if (right / rated >= .8 && left === 0) return 'Covered almost only by right-leaning outlets so far.';
    return '';
  }
  const names = (ids, n) => { const S = SRC(), list = ids.map(i => (S[i] || {}).name || i); return list.slice(0, n).join(' · ') + (list.length > n ? ' +' + (list.length - n) : ''); };

  /* ---------- loading and refreshing ---------- */
  async function load() { try { D = await A.api('/api/news'); } catch (e) { D = D || { events: [], singles: [], sources: [], internet: false, at: 0, error: e.message }; } }
  async function refresh(force, quiet) {
    if (loading) return; if (!D || !D.internet) { if (!quiet) A.toast('Internet access is off, so there is nothing new to fetch.'); return; }
    loading = true; paintTop();
    try {
      const r = await A.api('/api/news/refresh', { force: !!force });
      if (r && r.error === 'off') { if (!quiet) A.toast('Internet access is off.'); }
      else if (r && r.ok && !quiet) A.notify('ok', 'News updated: ' + r.events + ' events from ' + r.good + ' of ' + r.feeds + ' feeds');
      if (r && r.ok) A.api('/api/news/access', {}).then(() => load()).catch(() => { });
    } catch (e) { if (!quiet) A.notify('err', 'Could not update the news: ' + e.message); }
    loading = false; await load(); draw();
  }
  const stale = () => D && D.internet && Date.now() - (D.at || 0) > 15 * 60000;

  /* ---------- which events show ---------- */
  const words = q => q.toLowerCase().split(/\s+/).filter(Boolean);
  function matchesFollow(e, f) { const k = new Set(e.keys.concat(e.title.toLowerCase().split(/[^a-z0-9]+/))); return f.keys.filter(x => k.has(x)).length >= Math.min(3, f.keys.length); }
  function list() {
    if (!D) return [];
    let ev = D.events.slice();
    if (st.cat === 'follow') ev = ev.filter(e => follows.some(f => matchesFollow(e, f)));
    else if (['more', 'desk', 'official', 'beats', 'front', 'fact', 'opinion', 'saved'].includes(st.cat)) return [];
    else if (st.cat !== 'top') ev = ev.filter(e => e.cat === st.cat);
    if (st.wide) ev = ev.filter(e => e.outlets.length >= 4);
    if (st.q) { const w = words(st.q); ev = ev.filter(e => { const t = (e.title + ' ' + e.summary + ' ' + e.articles.map(a => a.title).join(' ')).toLowerCase(); return w.every(x => t.includes(x)); }); }
    if (st.sort === 'latest') ev.sort((a, b) => b.last - a.last); else if (st.sort === 'most') ev.sort((a, b) => b.outlets.length - a.outlets.length);
    return ev;
  }
  function singles() {
    let s = (D && D.singles) || [];
    if (st.q) { const w = words(st.q); s = s.filter(a => w.every(x => (a.title + ' ' + a.desc).toLowerCase().includes(x))); }
    return s.filter(a => a.genre === 'news').slice(0, 300);
  }

  /* ---------- drawing ---------- */
  function shell() {
    root.innerHTML = '<div class="nw"><div class="nw-top" id="nwtop"></div><div id="nwbanner"></div><div id="nwbody" style="flex:1;min-height:0;display:flex;flex-direction:column"></div></div>';
    root.querySelector('#nwtop').addEventListener('click', topClick);
    root.querySelector('#nwtop').addEventListener('input', e => { if (e.target.id === 'nwq') { st.q = e.target.value; st.archive = false; clearTimeout(shell.t); shell.t = setTimeout(drawBody, 160); } });
    root.querySelector('#nwtop').addEventListener('change', e => { if (e.target.id === 'nwsort') { st.sort = e.target.value; drawBody(); } if (e.target.id === 'nwwide') { st.wide = e.target.checked; drawBody(); } });
  }
  function paintTop() {
    const t = root.querySelector('#nwtop'); if (!t) return;
    const n = D ? D.events.length : 0, outs = D ? D.sources.filter(s => s.on && s.ok).length : 0;
    const counts = {}; (D ? D.events : []).forEach(e => { counts[e.cat] = (counts[e.cat] || 0) + 1; });
    const fol = D ? D.events.filter(e => follows.some(f => matchesFollow(e, f))).length : 0;
    t.innerHTML = '<div class="nw-row"><h2 class="nw-h">📰 News</h2><span class="nw-stat">' + (loading ? 'Updating from ' + (D ? D.sources.filter(s => s.on).length : '') + ' outlets…' : D && D.at ? n + ' events from ' + outs + ' outlets · updated ' + ago(D.at) : 'No news downloaded yet') + '</span><span style="flex:1"></span>' +
      '<button class="ib" data-a="research" title="Any topic, person, company or event: the AI searches the news and the web, reads the articles and writes an overview with its sources. Or paste an article’s address to read and summarise it.">🔍 Research</button><button class="ib" data-a="markets" title="Quotes, charts, company filings, rates and trade tools">📈 Markets</button><button class="ib" data-a="brief" title="The top stories, ready to read or listen to">🎧 Briefing</button><button class="ib" data-a="sources" title="Choose outlets, see their status, add your own feeds">⚙ Sources</button><button class="ib" data-a="refresh"' + (loading ? ' disabled' : '') + ' title="Fetch the latest from every outlet">' + (loading ? '⏳' : '↻') + ' Refresh</button></div>' +
      (st.view === 'list' ? '<div class="nw-chips">' + CATS.map(([k, l]) => '<button class="nw-chip' + (st.cat === k ? ' on' : '') + '" data-c="' + k + '">' + l + (k === 'follow' ? (fol ? '<i>' + fol + '</i>' : '') : k === 'desk' ? (D && D.niche ? '<i>' + D.niche.length + '</i>' : '') : k === 'official' ? (D ? '<i>' + officials().length + '</i>' : '') : k === 'beats' ? ((bn => bn ? '<i style="font-weight:700">' + bn + ' new</i>' : '')(D ? beatNew() : 0)) : k === 'more' ? '' : k !== 'top' && counts[k] ? '<i>' + counts[k] + '</i>' : '') + '</button>').join('') + '</div>' +
        '<div class="nw-row"><input id="nwq" class="nw-q" placeholder="Search the news…" value="' + esc(st.q) + '"><select id="nwsort"><option value="top"' + (st.sort === 'top' ? ' selected' : '') + '>Most important</option><option value="latest"' + (st.sort === 'latest' ? ' selected' : '') + '>Latest</option><option value="most"' + (st.sort === 'most' ? ' selected' : '') + '>Most outlets</option></select><label class="small" style="display:flex;gap:5px;align-items:center"><input type="checkbox" id="nwwide"' + (st.wide ? ' checked' : '') + '> Only widely reported (4+ outlets)</label></div>'
        : '<div class="nw-row"><button class="ib" data-a="back">← Back to the news</button></div>');
    const q = t.querySelector('#nwq'); if (q && document.activeElement !== q && paintTop.focusQ) { q.focus(); paintTop.focusQ = false; }
    const b = root.querySelector('#nwbanner');
    const bk = breaking();
    b.innerHTML = (bk && st.view === 'list' ? '<div class="nw-banner" data-bk="' + bk.id + '" style="border-color:var(--bad);background:rgba(255,107,129,.10);cursor:pointer"><b style="color:var(--bad);letter-spacing:.08em">● BREAKING</b><span style="flex:1"><b>' + esc(bk.title) + '</b> <span class="small mute">' + bk.outlets.length + ' outlets · ' + bk.fresh + ' reports in the last two hours</span></span><span class="small">Open ›</span></div>' : '') + (D && !D.internet ? '<div class="nw-banner"><span>🔌 <b>Internet access is off.</b> Moundshroud keeps it off unless you switch it on. ' + (D.at ? 'You are reading the edition from ' + new Date(D.at).toLocaleString([], { weekday: 'short', hour: 'numeric', minute: '2-digit' }) + '.' : 'News needs it to download headlines from the outlets.') + '</span><button class="pri" data-a="neton">Turn on internet access</button><span class="small mute">(the same switch as Settings, AI &amp; power; you can turn it off there any time)</span></div>' : '');
    b.onclick = topClick;
  }
  async function topClick(e) {
    const bkx = e.target.closest('[data-bk]'); if (bkx) { openEvent(bkx.dataset.bk); return; }
    const c = e.target.closest('[data-c]'); if (c) { st.cat = c.dataset.c; st.sel = null; paintTop(); drawBody(); return; }
    const a = e.target.closest('[data-a]'); if (!a) return;
    const k = a.dataset.a;
    if (k === 'refresh') refresh(true);
    else if (k === 'brief') { st.view = 'brief'; draw(); }
    else if (k === 'markets') { st.view = 'markets'; draw(); }
    else if (k === 'research') { st.view = 'research'; draw(); }
    else if (k === 'sources') { st.view = 'sources'; draw(); }
    else if (k === 'back') { st.view = 'list'; draw(); }
    else if (k === 'neton') {
      try { await A.api('/api/cloud', { web: true }); if (A.net) A.net.refresh(); } catch (x) { return A.notify('err', 'Could not switch it on: ' + x.message); }
      await load(); draw(); refresh(true);
    }
  }
  function draw() { if (!root.querySelector('#nwtop')) shell(); paintTop(); drawBody(); }
  function drawBody() {
    const b = root.querySelector('#nwbody'); if (!b) return;
    if (st.view !== 'markets' && A.markets) A.markets.stop();
    if (st.view === 'markets') { b.innerHTML = ''; b.style.overflow = 'hidden'; return A.markets.render(b); }
    if (st.view === 'brief') return brief(b);
    if (st.view === 'research') return researchView(b);
    if (st.view === 'sources') return sourcesView(b);
    if (!D || (!D.events.length && !D.singles.length)) {
      b.innerHTML = '<div class="nw-empty">' + (loading ? '⏳ Downloading headlines from every outlet and grouping them into events. This takes about ten seconds.' : D && D.internet ? 'No news yet. Press <b>↻ Refresh</b>.' : 'Turn on internet access above, and the News tab will download headlines from more than 120 outlets and group them into events.') + '</div>';
      return;
    }
    if (st.cat === 'more') return drawSingles(b);
    if (st.cat === 'desk') return drawArticles(b, (D.niche || []).filter(qMatch), 'The expert desk: single reports worth a specialist’s time, ranked by the kind of outlet (investigative newsrooms, official sources and beat specialists first) and by signs of real reporting (documents, courts, charges, audits, leaks, recalls, deaths). Stories already covered by four or more outlets are in the main list instead. Treat anything only one outlet has as unconfirmed.');
    if (st.cat === 'official') return drawArticles(b, officials().filter(qMatch), 'What the institutions themselves published in the last two days: central banks, regulators, prosecutors, budget and audit offices, statistics agencies, the UN and the EU, security advisories, hurricane and earthquake bulletins. These are primary sources, the claims of the body that issued them: check them against the reporting.');
    if (st.cat === 'beats') return drawBeats(b);
    if (st.cat === 'front') return drawFront(b);
    if (st.cat === 'fact') return drawArticles(b, factChecks().filter(qMatch), 'Fact-checks from FactCheck.org, Snopes, Lead Stories, Check Your Fact and BBC Verify, and any report that calls itself a fact check. A fact-check is one organisation’s finding: read how they reached it.');
    if (st.cat === 'opinion') return drawOpinion(b);
    if (st.cat === 'saved') return drawArticles(b, Object.values(saved).sort((a, c) => c.date - a.date).filter(qMatch), 'Reports you saved with 🔖, kept on this PC until you remove them (they stay even after they drop out of the news).');
    if (st.q && st.archive) return drawArchive(b, st.q);
    const ev = list();
    if (st.sel && !ev.some(e => e.id === st.sel)) st.sel = null;
    if (!st.sel && ev.length && innerWidth > 900) st.sel = ev[0].id;
    b.innerHTML = '<div class="nw-main' + (st.det ? ' det' : '') + '"><div class="nw-list" id="nwlist">' + (st.q ? '<div class="nw-row" style="margin:2px 2px 10px"><button class="ib" data-arch>🗄 Search the two-week archive for “' + esc(st.q) + '”</button></div>' : '') + (ev.length ? ev.map(card).join('') : '<div class="nw-empty">' + (st.cat === 'follow' ? 'You are not following anything yet. Open an event and press <b>★ Follow</b>, and later stories on the same subject collect here.' : 'Nothing here' + (st.q ? ' matches “' + esc(st.q) + '”' : '') + '.') + '</div>') + '</div><div class="nw-det" id="nwdet"></div></div>';
    b.querySelector('#nwlist').onclick = e => { if (e.target.closest('[data-arch]')) { st.archive = true; drawBody(); return; } const c = e.target.closest('[data-e]'); if (c) open(c.dataset.e); };
    if (st.sel) detail(D.events.find(e => e.id === st.sel));
  }
  function card(e) {
    const [cc, ct] = conf(e.outlets.length);
    return '<div class="nw-ev' + (e.id === st.sel ? ' on' : '') + (seen.has(e.id + ':' + e.n) ? ' seen' : '') + '" data-e="' + e.id + '">' + (seen.has(e.id + ':' + e.n) ? '' : '<span class="dot"></span>') + img(e.img, 'nw-th') +
      '<div class="nw-b"><div class="nw-meta"><span class="nw-cat">' + (CATNAME[e.cat] || e.cat) + '</span><span>' + ago(e.last) + '</span>' + (e.developing ? '<span class="nw-dev">Developing</span>' : '') + '</div>' +
      '<b class="nw-t">' + esc(e.title) + '</b>' + (e.summary ? '<div class="nw-s">' + esc(e.summary) + '</div>' : '') +
      '<div class="nw-foot"><span class="nw-conf ' + cc + '">' + ct + '</span>' + (e.official ? '<span class="nw-tag" style="border-color:var(--acc2);color:var(--acc2)" title="An institution’s own statement is among the reports">🏛 Official</span>' : '') + leanBar(e.lean, e.outlets) + '<span>' + esc(names(e.outlets, 3)) + '</span></div></div></div>';
  }
  function open(id) {
    st.sel = id; st.det = true;
    root.querySelectorAll('.nw-ev').forEach(x => x.classList.toggle('on', x.dataset.e === id));
    const m = root.querySelector('.nw-main'); if (m) m.classList.add('det');
    detail(D.events.find(e => e.id === id));
  }
  function detail(e) {
    const d = root.querySelector('#nwdet'); if (!d || !e) return;
    seen.add(e.id + ':' + e.n); saveSeen();
    const card = root.querySelector('.nw-ev[data-e="' + e.id + '"]'); if (card) { card.classList.add('seen'); const dot = card.querySelector('.dot'); if (dot) dot.remove(); }
    const S = SRC(), [cc, ct] = conf(e.outlets.length), news = e.articles.filter(a => a.genre === 'news'), ops = e.articles.filter(a => a.genre !== 'news');
    const firstA = e.articles.slice().sort((a, b) => a.date - b.date)[0], bs = blind(e), unr = e.outlets.filter(o => !(S[o] || {}).lean).length;
    const fol = follows.some(f => f.id === e.id), cached = aiCache[e.id];
    st.curEvent = e.id;
    const canRead = a => { const x = (SRC()[a.src] || {}).access; return !a.via && x && x.st === 'full'; };
    let tabArts = st.tab === 'op' ? ops : st.tab === 'all' ? e.articles : news;
    if (st.readable) tabArts = tabArts.filter(canRead);
    const nRead = e.articles.filter(canRead).length;
    d.innerHTML = '<button class="ib nw-back" data-d="back">← All stories</button>' +
      '<div class="nw-meta"><span class="nw-cat">' + (CATNAME[e.cat] || e.cat) + '</span><span>Updated ' + ago(e.last) + '</span>' + (e.developing ? '<span class="nw-dev">Developing</span>' : '') + '</div>' +
      '<div style="float:right;display:flex;gap:4px"><button class="ib" data-fs="-1" title="Smaller text">A−</button><button class="ib" data-fs="1" title="Larger text">A+</button></div><h2 class="nw-dh">' + esc(e.title) + '</h2>' + img(e.img, 'nw-dimg') + (e.summary ? '<p style="font-size:15px;line-height:1.55;margin:0 0 10px">' + esc(e.summary) + '</p>' : '') +
      '<div class="nw-row" style="margin:8px 0"><span class="nw-conf ' + cc + '">' + ct + '</span><span class="small mute">in ' + e.countries.length + ' countr' + (e.countries.length === 1 ? 'y' : 'ies') + ' · first reported ' + clock(e.first) + (firstA ? ' by ' + esc((S[firstA.src] || {}).name || firstA.src) : '') + '</span></div>' +
      '<div class="nw-row" style="gap:6px"><button class="pri" data-d="ai">✨ ' + (cached ? 'Show' : 'Write') + ' what we know</button><button class="ib" data-d="follow">' + (fol ? '★ Following' : '☆ Follow') + '</button><button class="ib" data-d="speak">🔊 Read aloud</button><button class="ib" data-d="dossier" title="Copy the whole event as notes: headline, timeline, every report with its link, and the AI brief">📋 Copy dossier</button><button class="ib" data-d="save" title="Save the dossier as a Markdown file">💾 Save</button></div>' +
      '<div class="nw-card" id="nwai" style="' + (cached ? '' : 'display:none') + '"><h4>What we know <span style="text-transform:none;letter-spacing:0;font-weight:400">· written by your local AI from these ' + Math.min(e.articles.length, 24) + ' reports only</span></h4><div class="nw-ai" id="nwaitxt">' + (cached ? md(cached.text) : '') + '</div>' + (cached && cached.n !== e.n ? '<div class="small mute">Written when there were ' + cached.n + ' reports; there are ' + e.n + ' now. <a href="#" data-d="redo">Write it again</a></div>' : '') + '</div>' +
      '<div class="nw-card"><h4>Coverage</h4>' + leanBar(e.lean, e.outlets, true) + '<div class="nw-legend">' + Object.keys(LEAN).map(k => e.lean[k] ? '<span><b style="background:' + LEAN[k][1] + '"></b>' + LEAN[k][0] + ' ' + e.lean[k] + '</span>' : '').join('') + (unr ? '<span><b style="background:#4a5068"></b>Not rated (mostly outside the US) ' + unr + '</span>' : '') + '</div>' +
      (bs ? '<div style="margin-top:8px;color:var(--warn);font-size:13px">⚠ ' + bs + ' Worth reading the other side when it arrives.</div>' : '') +
      '<div class="small mute" style="margin-top:8px">Outlets: ' + esc(e.outlets.map(o => (S[o] || {}).name || o).join(', ')) + '</div>' +
      '<div class="small mute" style="margin-top:4px">Lean labels are approximate, after public media-bias charts. Change them in ⚙ Sources.</div></div>' +
      timeline(e) +
      '<div class="nw-card"><h4>The reports</h4><label class="small" style="display:flex;gap:6px;align-items:center;margin:-2px 0 8px"><input type="checkbox" data-rd' + (st.readable ? ' checked' : '') + '> Only reports I can read here in full (' + nRead + ' of ' + e.articles.length + ')</label><div class="nw-tabs"><button class="nw-chip' + (st.tab === 'news' ? ' on' : '') + '" data-t="news">Straight news <i>' + news.length + '</i></button>' + (ops.length ? '<button class="nw-chip' + (st.tab === 'op' ? ' on' : '') + '" data-t="op">Opinion &amp; analysis <i>' + ops.length + '</i></button>' : '') + '<button class="nw-chip' + (st.tab === 'all' ? ' on' : '') + '" data-t="all">All, by time <i>' + e.articles.length + '</i></button></div>' +
      (tabArts.length ? tabArts.slice().sort((a, b) => st.tab === 'all' ? a.date - b.date : b.date - a.date).map(art).join('') : '<div class="small mute">None.</div>') + '</div>';
    d.scrollTop = 0;
    d.onclick = ev => {
      const t = ev.target.closest('[data-t]'); if (t) { st.tab = t.dataset.t; detail(e); return; }
      const rd = ev.target.closest('[data-rd]'); if (rd) { st.readable = rd.checked; detail(e); return; }
      const fz = ev.target.closest('[data-fs]'); if (fz) { fontStep(+fz.dataset.fs); return; }
      const r = ev.target.closest('[data-r]'); if (r) { ev.preventDefault(); reader(r.dataset.r, r.dataset.n); return; }
      const b = ev.target.closest('[data-d]'); if (!b) return; ev.preventDefault();
      const k = b.dataset.d;
      if (k === 'back') { st.det = false; const m = root.querySelector('.nw-main'); if (m) m.classList.remove('det'); }
      else if (k === 'ai') { if (aiCache[e.id] && aiCache[e.id].n === e.n) { const box = d.querySelector('#nwai'); box.style.display = ''; box.scrollIntoView({ behavior: 'smooth', block: 'nearest' }); } else whatWeKnow(e); }
      else if (k === 'redo') whatWeKnow(e);
      else if (k === 'follow') { if (fol) follows = follows.filter(f => f.id !== e.id); else follows.push({ id: e.id, label: e.title.slice(0, 80), keys: e.keys.slice(0, 6), at: Date.now() }); ls.set('news_follow', JSON.stringify(follows)); detail(e); paintTop(); A.toast(fol ? 'No longer following.' : 'Following. New stories on this subject collect under ★ Following.'); }
      else if (k === 'dossier') { copy(dossier(e), 'Dossier copied: paste it into Notes, a document or an email.'); }
      else if (k === 'save') { const blob = new Blob([dossier(e)], { type: 'text/markdown' }), u = URL.createObjectURL(blob), l = document.createElement('a'); l.href = u; l.download = 'news-' + new Date(e.last).toISOString().slice(0, 10) + '-' + e.title.toLowerCase().replace(/[^a-z0-9]+/g, '-').slice(0, 50) + '.md'; document.body.appendChild(l); l.click(); l.remove(); setTimeout(() => URL.revokeObjectURL(u), 2000); }
      else if (k === 'speak') speak([e.title + '.', aiCache[e.id] ? plainMd(aiCache[e.id].text) : e.summary, 'Reported by ' + e.outlets.length + ' outlets.']);
    };
  }
  const ARTS = new Map();
  function art(a) {
    ARTS.set(a.id, a);
    const S = SRC(), s = S[a.src] || {}, l = LEAN[s.lean];
    return '<div class="nw-art"><div class="nw-src"><b>' + esc(s.name || a.src) + '</b>' + (s.kind ? '<span class="nw-tag">' + (KIND[s.kind] || s.kind) + '</span>' : '') + (l ? '<span class="nw-tag" style="border-color:' + l[1] + ';color:' + l[1] + '">' + l[0] + '</span>' : '') + (s.country ? '<span>' + esc(s.country) + '</span>' : '') + (a.genre !== 'news' ? '<span class="nw-tag op">' + (a.genre === 'opinion' ? 'Opinion' : 'Analysis') + '</span>' : '') + '<span>· ' + clock(a.date) + '</span></div>' +
      '<a class="nw-at" href="' + esc(a.link) + '" target="_blank" rel="noopener noreferrer">' + esc(a.title) + '</a>' + (a.desc ? '<div class="nw-ad">' + esc(a.desc.slice(0, 320)) + (a.desc.length > 320 ? '…' : '') + '</div>' : '') +
      (a.edits && a.edits.length ? '<div class="small" style="color:var(--warn);margin-top:4px">✎ Headline changed after publication. Before: ' + a.edits.map(x => '“' + esc(x.t) + '” (until ' + clock(x.at) + ')').join(', ') + '</div>' : '') +
      '<div class="nw-acts">' + readBtn(a, s) + '<a class="ib" href="' + esc(a.link) + '" target="_blank" rel="noopener noreferrer">↗ Open on ' + esc(s.name || 'site') + '</a><button class="ib" data-cite="' + a.id + '" title="Copy a citation: outlet, headline, date and time, link">⧉ Cite</button><button class="ib" data-sv="' + a.id + '" title="Save for later">' + (saved[a.id] ? '🔖 Saved' : '🔖 Save') + '</button>' + accessTag(s) + '</div></div>';
  }
  function drawSingles(b) {
    const s = singles(), S = SRC();
    b.innerHTML = '<div style="overflow:auto;flex:1;min-height:0;padding:12px 18px 40px"><div class="small mute" style="margin-bottom:8px;max-width:760px">Stories only one outlet has reported so far (opinion left out). Some are scoops, some are local, some will turn out to be wrong: treat them as unconfirmed until others report them.</div>' +
      (s.length ? s.map(a => '<div style="max-width:820px">' + art(a) + '</div>').join('') : '<div class="nw-empty">Nothing here.</div>') + '</div>';
    b.onclick = ev => { const r = ev.target.closest('[data-r]'); if (r) { ev.preventDefault(); reader(r.dataset.r, r.dataset.n); } };
  }

  /* ---------- reading access, saving, text size ---------- */
  const PAYWALL_RE = /(subscribe (now )?to (continue|read|keep reading|unlock)|subscribers? only|already a subscriber|you have reached your (free )?(article )?limit|create a free account to (continue|read)|to continue reading|start your (free )?trial|unlock this article)/i;
  let saved = J('news_saved', {});
  const saveSaved = () => ls.set('news_saved', JSON.stringify(saved));
  function readBtn(a, s) {
    if (a.via) return '';
    const x = s.access, st2 = x && x.st;
    if (st2 === 'blocked') return '';
    return '<button class="ib" data-r="' + esc(a.link) + '" data-n="' + esc(s.name || '') + '">📖 ' + (st2 === 'paywall' ? 'Try reading here' : st2 === 'partial' ? 'Read here (may be short)' : 'Read here') + '</button>';
  }
  function accessTag(s) {
    const x = s.access; if (!x) return '';
    if (x.st === 'full') return '<span class="nw-tag" style="border-color:var(--ok);color:var(--ok)" title="The whole article opened in the reader when last checked">✓ Free to read</span>';
    if (x.st === 'paywall') return '<span class="nw-tag" style="border-color:var(--warn);color:var(--warn)" title="Asked for a subscription when last checked">🔒 Subscription</span>';
    if (x.st === 'partial') return '<span class="nw-tag" title="Only part of the page came through when last checked">◐ Partly readable</span>';
    return '<span class="nw-tag" title="This site refuses the in-app reader (it blocks automated readers or needs its own page). It opens on the site.">🌐 Opens on the site</span>';
  }
  function freeAlternatives(url) {
    const e = D && st.curEvent ? D.events.find(x => x.id === st.curEvent) : null; if (!e || !e.articles.some(a => a.link === url)) return '';
    const S = SRC(), free = e.articles.filter(a => a.link !== url && !a.via && a.genre === 'news' && (S[a.src] || {}).access && S[a.src].access.st === 'full');
    if (!free.length) return '<p class="small mute">No free full-text report of this story has been found yet.</p>';
    return '<h3 style="margin:18px 0 6px">The same story, free to read here</h3>' + free.slice(0, 8).map(a => '<p style="margin:0 0 8px"><a href="#" data-r="' + esc(a.link) + '" data-n="' + esc((S[a.src] || {}).name || '') + '"><b>' + esc((S[a.src] || {}).name || a.src) + ':</b> ' + esc(a.title) + '</a></p>').join('');
  }
  root.addEventListener('click', ev => { const b = ev.target.closest('[data-sv]'); if (!b) return; ev.preventDefault(); ev.stopPropagation(); const a = ARTS.get(b.dataset.sv); if (!a) return; if (saved[a.id]) { delete saved[a.id]; b.textContent = '🔖 Save'; } else { saved[a.id] = a; b.textContent = '🔖 Saved'; } saveSaved(); }, true);
  let fsz = +ls.get('news_fs', '0') || 0;
  function fontStep(d) { fsz = Math.max(-2, Math.min(5, fsz + d)); ls.set('news_fs', String(fsz)); applyFont(); }
  function applyFont() { let st2 = document.getElementById('nwfs'); if (!st2) { st2 = document.createElement('style'); st2.id = 'nwfs'; document.head.appendChild(st2); } const k = 1 + fsz * .1; st2.textContent = '.nw-det .nw-ad,.nw-det .nw-ai,.nw-det p{font-size:' + (14 * k).toFixed(1) + 'px!important}.nw-det .nw-at{font-size:' + (14.5 * k).toFixed(1) + 'px!important}.nw-det .nw-dh{font-size:' + (24 * k).toFixed(1) + 'px!important}.nw-read p{font-size:' + (16 * k).toFixed(1) + 'px!important}'; }
  applyFont();

  /* ---------- breaking news ---------- */
  function breaking() {
    if (!D) return null; const now = Date.now();
    const b = D.events.filter(e => e.outlets.length >= 6 && e.fresh >= 4 && now - e.first < 6 * 3600e3).sort((a, c) => c.fresh - a.fresh)[0];
    if (!b) return null;
    const told = J('news_bk_told', []); if (!told.includes(b.id)) { told.push(b.id); ls.set('news_bk_told', JSON.stringify(told.slice(-50))); if (D.at && now - D.at < 30 * 60e3) A.notify('warn', '● Breaking: ' + b.title, 12000); }
    return b;
  }
  function openEvent(id) { st.view = 'list'; st.cat = 'top'; st.q = ''; st.sel = id; draw(); open(id); }

  /* ---------- sections ---------- */
  function factChecks() { const S = SRC(); return allArts().filter(a => (S[a.src] || {}).kind === 'factcheck' || /^(fact[- ]check|verified|reality check)\b/i.test(a.title)).sort((a, c) => c.date - a.date); }
  function drawOpinion(b) {
    const S = SRC(), ops = allArts().filter(a => a.genre === 'opinion').filter(qMatch).sort((a, c) => c.date - a.date);
    const side = a => { const l = (S[a.src] || {}).lean; return l === 'L' || l === 'LL' ? 'left' : l === 'R' || l === 'LR' ? 'right' : 'centre'; };
    const colm = (k, t) => '<div style="min-width:0"><h3 style="margin:0 0 8px;font-size:14px">' + t + ' <span class="mute small">' + ops.filter(a => side(a) === k).length + '</span></h3>' + (ops.filter(a => side(a) === k).slice(0, 40).map(art).join('') || '<div class="small mute">None right now.</div>') + '</div>';
    b.innerHTML = '<div style="overflow:auto;flex:1;min-height:0;padding:12px 18px 40px"><div class="small mute" style="max-width:900px;line-height:1.5;margin-bottom:10px">The op-ed page: opinion and editorials from every outlet, side by side by the outlet’s approximate lean, so you can read the strongest case from each side. Opinion is never counted as confirmation of a news story.</div><div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(280px,1fr));gap:18px">' + colm('left', 'From the left') + colm('centre', 'From the centre and outside the US') + colm('right', 'From the right') + '</div></div>';
    b.onclick = ev => { const r = ev.target.closest('[data-r]'); if (r) { ev.preventDefault(); reader(r.dataset.r, r.dataset.n); } };
  }
  /* the front page: the lead, the top stories, the most interesting, every section, and the side column */
  const CURIOUS = /\b(first|record|rare|discover(ed|y)?|unprecedented|breakthrough|mystery|ancient|scientists|surprising|never before|oldest|largest|unusual|strange|found|reveals?|secret|hidden|lost|newly)\b/i;
  function interesting(top) {
    const S = SRC(), used = new Set(top.map(e => e.id)), now = Date.now();
    const ev = D.events.filter(e => !used.has(e.id)).map(e => {
      const kinds = new Set(e.outlets.map(o => (S[o] || {}).kind)), sc = (CURIOUS.test(e.title) ? 2 : 0) + (kinds.has('investigative') ? 1.5 : 0) + (e.official ? 1 : 0) + Math.min(2, e.countries.length / 3) + (e.cat === 'science' || e.cat === 'tech' || e.cat === 'culture' ? 1 : 0) + Math.exp(-(now - e.last) / (24 * 3600e3));
      return { e, sc };
    }).sort((a, c) => c.sc - a.sc).slice(0, 6).map(x => ({ type: 'event', e: x.e }));
    const desk = (D.niche || []).filter(a => CURIOUS.test(a.title) || ['investigative'].includes((S[a.src] || {}).kind)).slice(0, 6).map(a => ({ type: 'art', a }));
    const out = []; for (let i = 0; i < 6; i++) { if (ev[i]) out.push(ev[i]); if (desk[i]) out.push(desk[i]); }
    return out.slice(0, 10);
  }
  function drawFront(b) {
    const ev = D.events.slice().sort((a, c) => c.score - a.score), lead = ev[0], top = ev.slice(1, 9), S = SRC();
    if (!lead) { b.innerHTML = '<div class="nw-empty">No stories yet.</div>'; return; }
    const [lc, lt] = conf(lead.outlets.length);
    const mini = e => '<div class="nw-ev" data-e="' + e.id + '" style="padding:8px">' + img(e.img, 'nw-th') + '<div class="nw-b"><div class="nw-meta"><span class="nw-cat">' + (CATNAME[e.cat] || e.cat) + '</span><span>' + ago(e.last) + '</span>' + (e.developing ? '<span class="nw-dev">Developing</span>' : '') + '</div><b class="nw-t" style="font-size:14px">' + esc(e.title) + '</b><div class="nw-foot"><span class="nw-conf ' + conf(e.outlets.length)[0] + '">' + e.outlets.length + ' outlets</span>' + leanBar(e.lean, e.outlets) + '</div></div></div>';
    const secs = ['us', 'world', 'politics', 'business', 'tech', 'science', 'health', 'sports', 'culture'].map(k => [k, ev.filter(e => e.cat === k && e !== lead && !top.includes(e)).slice(0, 4)]).filter(x => x[1].length);
    const int = interesting([lead].concat(top));
    const pics = ev.filter(e => e.img).slice(0, 8);
    const facts = factChecks().slice(0, 5), opsL = allArts().filter(a => a.genre === 'opinion').sort((a, c) => c.date - a.date);
    const pickSide = k => opsL.find(a => { const l = (S[a.src] || {}).lean; return k === 'l' ? (l === 'L' || l === 'LL') : k === 'r' ? (l === 'R' || l === 'LR') : (l === 'C' || !l); });
    const op3 = [['From the left', pickSide('l')], ['From the centre', pickSide('c')], ['From the right', pickSide('r')]].filter(x => x[1]);
    b.innerHTML = '<div style="overflow:auto;flex:1;min-height:0;padding:14px 18px 40px"><div style="display:grid;grid-template-columns:minmax(0,1fr) 320px;gap:20px" class="nw-fp">' +
      '<div style="min-width:0">' +
        '<div class="nw-ev" data-e="' + lead.id + '" style="display:block;padding:0;margin-bottom:14px">' + (lead.img ? '<img src="/api/news/img?u=' + encodeURIComponent(lead.img) + '" referrerpolicy="no-referrer" alt="" onerror="this.remove()" style="width:100%;max-height:380px;object-fit:cover;border-radius:14px;display:block">' : '') + '<div style="padding:10px 4px"><div class="nw-meta"><span class="nw-cat">' + (CATNAME[lead.cat] || lead.cat) + '</span><span>' + ago(lead.last) + '</span>' + (lead.developing ? '<span class="nw-dev">Developing</span>' : '') + '</div><h1 style="margin:6px 0;font-size:28px;line-height:1.2;letter-spacing:-.01em">' + esc(lead.title) + '</h1>' + (lead.summary ? '<p style="font-size:15.5px;line-height:1.55;margin:0 0 8px;color:var(--text)">' + esc(lead.summary) + '</p>' : '') + '<div class="nw-foot"><span class="nw-conf ' + lc + '">' + lt + '</span>' + leanBar(lead.lean, lead.outlets) + '<span>' + esc(names(lead.outlets, 4)) + '</span></div></div></div>' +
        '<h3 class="mk-h3" style="margin:6px 0 6px;font-size:13px;text-transform:uppercase;letter-spacing:.06em;color:var(--mute)">Top stories</h3><div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(300px,1fr));gap:4px">' + top.map(mini).join('') + '</div>' +
        (int.length ? '<h3 style="margin:16px 0 6px;font-size:13px;text-transform:uppercase;letter-spacing:.06em;color:var(--mute)">Most interesting</h3><div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(300px,1fr));gap:4px">' + int.map(x => x.type === 'event' ? mini(x.e) : '<div class="nw-ev" style="padding:8px;display:block">' + art(x.a) + '</div>').join('') + '</div>' : '') +
        (pics.length > 3 ? '<h3 style="margin:16px 0 6px;font-size:13px;text-transform:uppercase;letter-spacing:.06em;color:var(--mute)">In pictures</h3><div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(170px,1fr));gap:8px">' + pics.map(e => '<div data-e="' + e.id + '" style="cursor:pointer;position:relative;border-radius:10px;overflow:hidden;aspect-ratio:4/3;background:var(--panel2)"><img src="/api/news/img?u=' + encodeURIComponent(e.img) + '" referrerpolicy="no-referrer" alt="" onerror="this.parentNode.remove()" loading="lazy" style="width:100%;height:100%;object-fit:cover"><div style="position:absolute;left:0;right:0;bottom:0;padding:18px 8px 6px;background:linear-gradient(transparent,rgba(0,0,0,.85));font-size:12px;line-height:1.3">' + esc(e.title) + '</div></div>').join('') + '</div>' : '') +
        secs.map(([k, list]) => '<h3 style="margin:16px 0 6px;font-size:13px;text-transform:uppercase;letter-spacing:.06em;color:var(--mute);cursor:pointer" data-c="' + k + '">' + (CATNAME[k] || k) + ' ›</h3><div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(300px,1fr));gap:4px">' + list.map(mini).join('') + '</div>').join('') +
      '</div>' +
      '<div style="min-width:0">' +
        '<div class="nw-card" id="fpmk"><h4>Markets</h4><div class="small mute">Loading…</div></div>' +
        '<div class="nw-card" id="fpwx"><h4>Weather</h4><div class="small mute">Loading…</div></div>' +
        (facts.length ? '<div class="nw-card"><h4>Fact checks</h4>' + facts.map(a => '<div style="padding:5px 0;border-bottom:1px solid var(--line)"><a class="nw-at" style="font-size:13px" href="' + esc(a.link) + '" target="_blank" rel="noopener noreferrer">' + esc(a.title) + '</a><div class="small mute">' + esc((S[a.src] || {}).name || a.src) + ' · ' + ago(a.date) + '</div></div>').join('') + '<a href="#" data-c="fact" class="small">All fact checks ›</a></div>' : '') +
        (op3.length ? '<div class="nw-card"><h4>Opinion</h4>' + op3.map(([t, a]) => '<div style="padding:5px 0;border-bottom:1px solid var(--line)"><div class="small mute">' + t + '</div><a class="nw-at" style="font-size:13px" href="' + esc(a.link) + '" target="_blank" rel="noopener noreferrer">' + esc(a.title) + '</a><div class="small mute">' + esc((S[a.src] || {}).name || a.src) + '</div></div>').join('') + '<a href="#" data-c="opinion" class="small">The op-ed page ›</a></div>' : '') +
        '<div class="nw-card"><h4>Today</h4><div class="small" style="line-height:1.7">' + D.events.length + ' events from ' + D.sources.filter(x => x.on && x.ok).length + ' outlets<br>' + (D.niche || []).length + ' reports on the expert desk<br>' + D.events.filter(e => e.official).length + ' with an official source<br>Updated ' + ago(D.at) + '</div></div>' +
      '</div></div></div><style>@media (max-width:980px){.nw-fp{grid-template-columns:1fr!important}}</style>';
    b.onclick = ev2 => {
      const c = ev2.target.closest('[data-c]'); if (c) { ev2.preventDefault(); st.cat = c.dataset.c; paintTop(); drawBody(); return; }
      const r = ev2.target.closest('[data-r]'); if (r) { ev2.preventDefault(); reader(r.dataset.r, r.dataset.n); return; }
      const e = ev2.target.closest('[data-e]'); if (e) openEvent(e.dataset.e);
    };
    frontMarkets(); frontWeather();
  }
  async function frontMarkets() {
    const el = root.querySelector('#fpmk'); if (!el) return;
    const syms = ['.SPX', '.IXIC', '.DJI', 'US10Y', '@CL.1', '@GC.1', 'BTC.CM='], N = { '.SPX': 'S&P 500', '.IXIC': 'Nasdaq', '.DJI': 'Dow', 'US10Y': '10-yr yield', '@CL.1': 'Oil', '@GC.1': 'Gold', 'BTC.CM=': 'Bitcoin' };
    let r; try { r = await (await fetch('/api/mk/quotes?s=' + encodeURIComponent(syms.join(',')))).json(); } catch (e) { r = { error: e.message }; }
    if (!root.contains(el)) return;
    if (r.error) { el.innerHTML = '<h4>Markets</h4><div class="small mute">' + (r.error === 'off' ? 'Internet access is off.' : 'Unavailable right now.') + '</div>'; return; }
    el.innerHTML = '<h4>Markets</h4>' + r.quotes.map(q => '<div style="display:flex;justify-content:space-between;font-size:13px;padding:3px 0;cursor:pointer" data-mk="' + esc(q.symbol) + '"><span>' + (N[q.symbol] || q.symbol) + '</span><span><b>' + (q.last != null ? q.last.toLocaleString(undefined, { maximumFractionDigits: 2 }) + (q.symbol === 'US10Y' ? '%' : '') : '–') + '</b> <span style="color:' + (q.pct > 0 ? 'var(--ok)' : q.pct < 0 ? 'var(--bad)' : 'var(--mute)') + '">' + (q.pct != null ? (q.pct > 0 ? '+' : '') + q.pct.toFixed(2) + '%' : '') + '</span></span></div>').join('') + '<a href="#" class="small" data-mk="">Open Markets ›</a>';
    el.onclick = ev => { const m = ev.target.closest('[data-mk]'); if (!m) return; ev.preventDefault(); if (m.dataset.mk && A.markets) A.markets.open(m.dataset.mk); st.view = 'markets'; draw(); };
  }
  const WMO = { 0: ['☀️', 'Clear'], 1: ['🌤', 'Mostly clear'], 2: ['⛅', 'Partly cloudy'], 3: ['☁️', 'Overcast'], 45: ['🌫', 'Fog'], 48: ['🌫', 'Freezing fog'], 51: ['🌦', 'Light drizzle'], 53: ['🌦', 'Drizzle'], 55: ['🌧', 'Heavy drizzle'], 61: ['🌧', 'Light rain'], 63: ['🌧', 'Rain'], 65: ['🌧', 'Heavy rain'], 66: ['🌨', 'Freezing rain'], 67: ['🌨', 'Freezing rain'], 71: ['🌨', 'Light snow'], 73: ['🌨', 'Snow'], 75: ['❄️', 'Heavy snow'], 77: ['🌨', 'Snow grains'], 80: ['🌦', 'Showers'], 81: ['🌧', 'Showers'], 82: ['⛈', 'Violent showers'], 85: ['🌨', 'Snow showers'], 86: ['❄️', 'Heavy snow showers'], 95: ['⛈', 'Thunderstorm'], 96: ['⛈', 'Thunderstorm, hail'], 99: ['⛈', 'Thunderstorm, hail'] };
  async function frontWeather() {
    const el = root.querySelector('#fpwx'); if (!el) return;
    const place = J('news_city', null), unit = ls.get('news_unit', /^en-US/i.test(navigator.language) ? 'f' : 'c');
    const ask = (msg) => { el.innerHTML = '<h4>Weather</h4><div class="small mute" style="margin-bottom:6px">' + (msg || 'Pick a place. Only that place is sent to the weather service (Open-Meteo), never who you are.') + '</div><div class="nw-row"><input id="wxq" placeholder="City" style="flex:1;min-width:0"><button class="ib" id="wxg">Find</button></div><div id="wxr"></div>';
      const go = async () => { const v = el.querySelector('#wxq').value.trim(); if (!v) return; const r = await (await fetch('/api/mk/geocode?q=' + encodeURIComponent(v))).json(); el.querySelector('#wxr').innerHTML = r.error ? '<div class="small mute">' + (r.error === 'off' ? 'Internet access is off.' : 'Not found.') + '</div>' : (r.results || []).map((x, i) => '<div style="padding:4px 0;cursor:pointer" data-wx="' + i + '">📍 ' + esc(x.name + (x.admin ? ', ' + x.admin : '') + ', ' + x.country) + '</div>').join('') || '<div class="small mute">Not found.</div>'; el.querySelector('#wxr').onclick = ev => { const d = ev.target.closest('[data-wx]'); if (!d) return; const x = r.results[+d.dataset.wx]; ls.set('news_city', JSON.stringify({ name: x.name + (x.admin ? ', ' + x.admin : ''), lat: x.lat, lon: x.lon })); frontWeather(); }; };
      el.querySelector('#wxg').onclick = go; el.querySelector('#wxq').onkeydown = ev => { if (ev.key === 'Enter') go(); }; };
    if (!place) return ask();
    let w; try { w = await (await fetch('/api/mk/weather?lat=' + place.lat + '&lon=' + place.lon + '&u=' + unit)).json(); } catch (e) { w = { error: e.message }; }
    if (!root.contains(el)) return;
    if (w.error) { el.innerHTML = '<h4>Weather · ' + esc(place.name) + '</h4><div class="small mute">' + (w.error === 'off' ? 'Internet access is off.' : 'Unavailable right now.') + '</div>'; return; }
    const c = w.current, d = w.daily, ic = k => (WMO[k] || ['🌡', ''])[0], tx = k => (WMO[k] || ['', ''])[1];
    el.innerHTML = '<h4 style="display:flex;justify-content:space-between">Weather · ' + esc(place.name) + '<span><a href="#" data-wu>°' + (unit === 'f' ? 'C' : 'F') + '</a> · <a href="#" data-wc>change</a></span></h4><div style="display:flex;align-items:center;gap:10px"><span style="font-size:34px">' + ic(c.weather_code) + '</span><div><b style="font-size:24px">' + Math.round(c.temperature_2m) + '°' + w.unit + '</b><div class="small mute">' + tx(c.weather_code) + ' · feels ' + Math.round(c.apparent_temperature) + '° · wind ' + Math.round(c.wind_speed_10m) + ' ' + w.wind + ' · humidity ' + c.relative_humidity_2m + '%</div></div></div>' +
      '<div style="display:grid;grid-template-columns:repeat(5,1fr);gap:4px;margin-top:8px;text-align:center;font-size:12px">' + d.time.map((t, i) => '<div><div class="mute">' + (i ? new Date(t + 'T12:00').toLocaleDateString([], { weekday: 'short' }) : 'Today') + '</div><div style="font-size:18px">' + ic(d.weather_code[i]) + '</div><div>' + Math.round(d.temperature_2m_max[i]) + '° <span class="mute">' + Math.round(d.temperature_2m_min[i]) + '°</span></div>' + (d.precipitation_probability_max && d.precipitation_probability_max[i] != null ? '<div class="mute">💧' + d.precipitation_probability_max[i] + '%</div>' : '') + '</div>').join('') + '</div>';
    el.onclick = ev => { if (ev.target.closest('[data-wu]')) { ev.preventDefault(); ls.set('news_unit', unit === 'f' ? 'c' : 'f'); frontWeather(); } if (ev.target.closest('[data-wc]')) { ev.preventDefault(); ask(); } };
  }

  /* ---------- the journalist's tools ---------- */
  const copy = (t, msg) => { try { navigator.clipboard.writeText(t).then(() => A.toast(msg || 'Copied.'), () => fallbackCopy(t, msg)); } catch (e) { fallbackCopy(t, msg); } };
  function fallbackCopy(t, msg) { const x = document.createElement('textarea'); x.value = t; document.body.appendChild(x); x.select(); try { document.execCommand('copy'); A.toast(msg || 'Copied.'); } catch (e) { A.toast('Could not copy.'); } x.remove(); }
  const fullTime = t => new Date(t).toLocaleString([], { weekday: 'short', year: 'numeric', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit', timeZoneName: 'short' });
  const cite = a => { const s = SRC()[a.src] || {}; return (s.name || a.src) + ', “' + a.title + '”, ' + fullTime(a.date) + '. ' + a.link + (a.via ? ' (via Google News)' : ''); };
  root.addEventListener('click', ev => { const c = ev.target.closest('[data-cite]'); if (!c) return; ev.preventDefault(); ev.stopPropagation(); const a = ARTS.get(c.dataset.cite); if (a) copy(cite(a), 'Citation copied.'); }, true);
  /* who had it first, and how fast the rest followed */
  function timeline(e) {
    const S = SRC(), firsts = {}; e.articles.forEach(a => { if (a.genre === 'opinion') return; if (!firsts[a.src] || a.date < firsts[a.src].date) firsts[a.src] = a; });
    const list = Object.values(firsts).sort((a, b) => a.date - b.date); if (list.length < 2) return '';
    const t0 = list[0].date, gap = ms => { const m = Math.round(ms / 60000); return m < 60 ? '+' + m + ' min' : '+' + (m / 60).toFixed(m < 600 ? 1 : 0) + ' h'; };
    return '<div class="nw-card"><h4>Who had it first</h4><div style="display:flex;flex-direction:column;gap:3px;font-size:12.5px">' + list.slice(0, 40).map((a, i) => { const s = S[a.src] || {}; return '<div style="display:flex;gap:8px;align-items:baseline;min-width:0"><span style="width:62px;flex:none;color:' + (i ? 'var(--mute)' : 'var(--ok)') + ';font-weight:' + (i ? 400 : 700) + '">' + (i ? gap(a.date - t0) : clock(a.date)) + '</span><b style="flex:none">' + esc(s.name || a.src) + '</b>' + (s.kind === 'primary' || s.kind === 'investigative' || s.kind === 'wire' ? '<span class="nw-tag" style="flex:none">' + KIND[s.kind] + '</span>' : '') + '<span class="mute" style="overflow:hidden;text-overflow:ellipsis;white-space:nowrap;min-width:0">' + esc(a.title) + '</span></div>'; }).join('') + '</div><div class="small mute" style="margin-top:6px">Times are when each outlet’s feed says the report was published.</div></div>';
  }
  function dossier(e) {
    const S = SRC(), n = s => (S[s] || {}).name || s, out = [];
    out.push('# ' + e.title, '', '_' + e.outlets.length + ' outlets · ' + e.n + ' reports · first ' + fullTime(e.first) + ' · last ' + fullTime(e.last) + ' · compiled ' + fullTime(Date.now()) + '_', '');
    if (e.summary) out.push(e.summary, '');
    if (aiCache[e.id]) out.push('## What we know (local AI, from these reports only; verify before use)', '', aiCache[e.id].text, '');
    const l = e.lean; out.push('## Coverage', '', 'Left ' + l.L + ' · leans left ' + l.LL + ' · centre ' + l.C + ' · leans right ' + l.LR + ' · right ' + l.R + ' · not rated ' + e.outlets.filter(o => !(S[o] || {}).lean).length + ' (approximate lean labels).', 'Countries: ' + e.countries.join(', ') + '.', '');
    out.push('## Reports, oldest first', '');
    e.articles.slice().sort((a, b) => a.date - b.date).forEach(a => {
      out.push('- **' + n(a.src) + '** (' + fullTime(a.date) + ')' + (a.genre !== 'news' ? ' [' + a.genre + ']' : '') + ': ' + a.title + (a.edits && a.edits.length ? ' _(headline changed; before: ' + a.edits.map(x => '“' + x.t + '”').join(', ') + ')_' : '') + '  ', '  ' + a.link + (a.desc ? '  \n  ' + a.desc.slice(0, 400) : ''));
    });
    return out.join('\n');
  }
  /* views that are lists of single reports: the expert desk, official sources, the archive, beats */
  function articleList(arr) { return arr.length ? arr.map(a => '<div style="max-width:860px">' + art(a) + '</div>').join('') : '<div class="nw-empty">Nothing here' + (st.q ? ' matches “' + esc(st.q) + '”' : '') + '.</div>'; }
  function drawArticles(b, arr, intro) {
    b.innerHTML = '<div style="overflow:auto;flex:1;min-height:0;padding:12px 18px 40px"><div class="small mute" style="margin-bottom:8px;max-width:860px;line-height:1.5">' + intro + '</div>' + articleList(arr.slice(0, 300)) + '</div>';
    b.onclick = ev => { const r = ev.target.closest('[data-r]'); if (r) { ev.preventDefault(); reader(r.dataset.r, r.dataset.n); } };
  }
  const allArts = () => { const m = new Map(); (D ? D.events : []).forEach(e => e.articles.forEach(a => m.set(a.id, a))); (D ? D.singles : []).forEach(a => m.set(a.id, a)); (D && D.niche ? D.niche : []).forEach(a => m.set(a.id, a)); return [...m.values()]; };
  const officials = () => { const S = SRC(); return allArts().filter(a => (S[a.src] || {}).kind === 'primary').sort((a, b) => b.date - a.date); };
  /* the same query language as the archive: all words, "exact phrases", -excluded */
  function matcher(q) {
    const ph = [], neg = []; const rest = String(q || '').toLowerCase().replace(/"([^"]+)"/g, (m, p) => { ph.push(p.trim()); return ' '; });
    const w = rest.split(/\s+/).filter(Boolean).filter(x => { if (x[0] === '-' && x.length > 1) { neg.push(x.slice(1)); return false; } return true; });
    if (!w.length && !ph.length) return () => false;
    return a => { const t = (a.title + ' ' + (a.desc || '')).toLowerCase(); return w.every(x => t.includes(x)) && ph.every(x => t.includes(x)) && !neg.some(x => t.includes(x)); };
  }
  const qMatch = a => !st.q || matcher(st.q)(a);
  async function drawArchive(b, q) {
    b.innerHTML = '<div class="nw-empty">Searching two weeks of news…</div>';
    let r; try { r = await (await fetch('/api/news/search?q=' + encodeURIComponent(q))).json(); } catch (e) { r = { items: [], total: 0 }; }
    b.innerHTML = '<div style="overflow:auto;flex:1;min-height:0;padding:12px 18px 40px"><div class="nw-row" style="margin-bottom:8px"><button class="ib" data-back>← Back to events</button><span class="small mute">' + r.total + ' report' + (r.total === 1 ? '' : 's') + ' in the archive' + (r.from ? ' (since ' + new Date(r.from).toLocaleDateString([], { month: 'short', day: 'numeric' }) + ')' : '') + ' match “' + esc(q) + '”' + (r.total > 300 ? ', newest 300 shown' : '') + '. Use "quotes" for an exact phrase and -word to leave a word out.</span></div>' + articleList(r.items) + '</div>';
    b.onclick = ev => { if (ev.target.closest('[data-back]')) { st.archive = false; drawBody(); return; } const x = ev.target.closest('[data-r]'); if (x) { ev.preventDefault(); reader(x.dataset.r, x.dataset.n); } };
  }
  /* beats: saved searches that keep collecting everything on a subject, from every outlet, including single reports */
  let beats = J('news_beats', []);
  const saveBeats = () => ls.set('news_beats', JSON.stringify(beats));
  const beatNew = () => { const all = allArts(); return beats.reduce((n, bt) => { const m = matcher(bt.q); return n + all.filter(a => m(a) && a.date > (bt.seen || 0)).length; }, 0); };
  async function drawBeats(b) {
    b.innerHTML = '<div style="overflow:auto;flex:1;min-height:0;padding:12px 18px 40px" id="nwbeats"><div class="small mute" style="max-width:860px;line-height:1.5;margin-bottom:10px">A beat is a saved search that keeps collecting: every report from every outlet that matches, including single reports nobody else has picked up, from the last two weeks. New ones since you last looked are marked. Use "quotes" for exact phrases and -word to exclude.</div>' +
      '<div class="nw-card" style="max-width:860px"><h4>Add a beat</h4><div class="nw-row"><input id="nwbn" placeholder="Name, e.g. Election administration" style="flex:1;min-width:160px"><input id="nwbq" placeholder="Search, e.g. &quot;election officials&quot; subpoena" style="flex:2;min-width:240px"><button class="pri" id="nwba">Add</button></div></div><div id="nwblist"></div></div>';
    b.onclick = ev => {
      if (ev.target.id === 'nwba') { const name = b.querySelector('#nwbn').value.trim(), q = b.querySelector('#nwbq').value.trim(); if (!q) return A.toast('Type what the beat should search for.'); beats.push({ id: String(Date.now()), name: name || q, q, seen: 0 }); saveBeats(); drawBeats(b); paintTop(); return; }
      const d = ev.target.closest('[data-del]'); if (d) { beats = beats.filter(x => x.id !== d.dataset.del); saveBeats(); drawBeats(b); paintTop(); return; }
      const x = ev.target.closest('[data-r]'); if (x) { ev.preventDefault(); reader(x.dataset.r, x.dataset.n); }
    };
    const listEl = b.querySelector('#nwblist');
    if (!beats.length) { listEl.innerHTML = '<div class="nw-empty">No beats yet.</div>'; return; }
    const stamp = Date.now();
    for (const bt of beats) {
      const box = document.createElement('div'); box.className = 'nw-card'; box.style.maxWidth = '860px'; listEl.appendChild(box);
      const head = '<h4 style="display:flex;gap:8px;align-items:center"><span style="flex:1">🎯 ' + esc(bt.name) + ' <span style="text-transform:none;letter-spacing:0;font-weight:400">· ' + esc(bt.q) + '</span></span><button class="ib" data-del="' + bt.id + '">Remove</button></h4>';
      box.innerHTML = head + '<div class="mute small">Searching…</div>';
      let r; try { r = await (await fetch('/api/news/search?q=' + encodeURIComponent(bt.q))).json(); } catch (e) { r = { items: [], total: 0 }; }
      const fresh = r.items.filter(a => a.date > (bt.seen || 0)).length;
      box.innerHTML = head + '<div class="small mute" style="margin-bottom:4px">' + r.total + ' report' + (r.total === 1 ? '' : 's') + (fresh && bt.seen ? ' · <b style="color:var(--acc2)">' + fresh + ' new since you last looked</b>' : '') + '</div>' + (r.items.length ? r.items.slice(0, 25).map(a => (bt.seen && a.date > bt.seen ? '<div style="border-left:3px solid var(--acc2);padding-left:8px">' + art(a) + '</div>' : art(a))).join('') + (r.total > 25 ? '<div class="small mute" style="margin-top:6px">Search “' + esc(bt.q) + '” and press 🗄 to see all of them.</div>' : '') : '<div class="small mute">Nothing yet.</div>');
    }
    beats.forEach(bt => { bt.seen = stamp; }); saveBeats(); paintTop();
  }

  /* ---------- the grounded AI brief ---------- */
  function md(t) {
    const lines = esc(t).split('\n'); let out = '', inUl = false;
    lines.forEach(l => {
      const b = l.replace(/\*\*(.+?)\*\*/g, '<b>$1</b>').replace(/\[(\d+(?:\s*,\s*\d+)*)\]/g, '<sup class="mute">[$1]</sup>');
      if (/^\s*#{1,4}\s+/.test(l)) { if (inUl) { out += '</ul>'; inUl = false; } out += '<p style="margin:10px 0 4px"><b>' + b.replace(/^\s*#{1,4}\s+/, '') + '</b></p>'; return; }
      if (/^\s*[-*•]\s+/.test(l)) { if (!inUl) { out += '<ul>'; inUl = true; } out += '<li>' + b.replace(/^\s*[-*•]\s+/, '') + '</li>'; }
      else { if (inUl) { out += '</ul>'; inUl = false; } if (b.trim()) out += '<p>' + b + '</p>'; }
    });
    return out + (inUl ? '</ul>' : '');
  }
  const plainMd = t => String(t).replace(/\*\*/g, '').replace(/\[[^\]]+\]/g, '').replace(/^\s*[-*•]\s+/gm, '');
  async function whatWeKnow(e) {
    const d = root.querySelector('#nwdet'), box = d.querySelector('#nwai'), txt = d.querySelector('#nwaitxt');
    box.style.display = ''; txt.innerHTML = '<span class="mute">Reading ' + Math.min(e.articles.length, 24) + ' reports…</span>';
    if (aiCtl) aiCtl.abort(); aiCtl = new AbortController();
    const S = SRC(), arts = e.articles.slice().sort((a, b) => (a.genre === 'news' ? 0 : 1) - (b.genre === 'news' ? 0 : 1) || a.date - b.date).slice(0, 24);
    const reports = arts.map((a, i) => '[' + ((S[a.src] || {}).name || a.src) + (a.genre !== 'news' ? ', ' + a.genre : '') + ', ' + clock(a.date) + '] ' + a.title + (a.desc ? ' — ' + a.desc.slice(0, 380) : '')).join('\n');
    const sys = 'You are a careful, neutral news editor. You will be given short reports from several news outlets about one event. Write a brief using ONLY facts stated in these reports. Never add background knowledge, numbers, names or claims that are not in the reports. If outlets disagree (different numbers, causes, wording that implies different things), say so and name the outlets. Treat opinion pieces as opinion, not fact. Be plain and short.\n\nFormat exactly:\n**What happened**\n2 or 3 sentences.\n**What the reports agree on**\n- 2 to 4 bullet points, each ending with the outlets in brackets, like [BBC, Fox News]\n**Where accounts differ**\n- bullet points, or the single line "No clear disagreements in these reports."\n**Still unclear**\n- 1 to 3 bullet points about what the reports say is not yet known';
    try {
      const out = await A.ai.stream([{ role: 'system', content: sys }, { role: 'user', content: 'Event: ' + e.title + '\n\nReports:\n' + reports }], t => { txt.innerHTML = md(t); }, aiCtl.signal, { temp: .2 });
      if (out && out.trim()) { aiCache[e.id] = { n: e.n, text: out.trim(), at: Date.now() }; const keys = Object.keys(aiCache); if (keys.length > 60) keys.sort((a, b) => aiCache[a].at - aiCache[b].at).slice(0, keys.length - 60).forEach(k => delete aiCache[k]); ls.set('news_ai', JSON.stringify(aiCache)); }
      else txt.innerHTML = '<span class="mute">The AI gave no answer. Is a model running? (Chat tab, model list at the top.)</span>';
    } catch (x) { if (x.name !== 'AbortError') txt.innerHTML = '<span style="color:var(--bad)">The local AI could not write this: ' + esc(x.message) + '</span>'; }
  }

  /* ---------- reading an article inside the app ---------- */
  async function reader(url, name) {
    const o = document.createElement('div'); o.className = 'nw-read';
    o.innerHTML = '<div><div class="nw-row"><b style="flex:1">' + esc(name || '') + '</b><button class="ib" data-fs="-1" title="Smaller text">A−</button><button class="ib" data-fs="1" title="Larger text">A+</button><a class="ib" href="' + esc(url) + '" target="_blank" rel="noopener noreferrer">↗ Open the original</a><button class="ib" data-x>✕ Close</button></div><div id="nwrb" style="margin-top:14px"><span class="mute">Fetching the article…</span></div></div>';
    document.body.appendChild(o);
    const close = () => { o.remove(); document.removeEventListener('keydown', esc1, true); };
    const esc1 = ev => { if (ev.key === 'Escape') { ev.stopPropagation(); close(); } };
    document.addEventListener('keydown', esc1, true);
    o.onclick = ev => { if (ev.target === o || ev.target.closest('[data-x]')) return close();
      if (ev.target.closest('[data-sumart]')) { summariseArticle(o, url); return; } const fz = ev.target.closest('[data-fs]'); if (fz) return fontStep(+fz.dataset.fs); const r2 = ev.target.closest('[data-r]'); if (r2) { ev.preventDefault(); close(); reader(r2.dataset.r, r2.dataset.n); } };
    let r; try { r = await A.api('/api/net/page', { url }); } catch (e) { r = { error: e.message }; }
    const b = o.querySelector('#nwrb'); if (!b) return;
    const walled = r && r.text && PAYWALL_RE.test(r.text) && r.text.length < 6000;
    if (!r || r.error || !r.text || walled) { b.innerHTML = '<p class="mute">' + (walled ? 'This outlet asks for a subscription for the full article.' : esc((r && r.error) || 'The article could not be read here.')) + ' Moundshroud does not get around paywalls or blocks; if you subscribe, open it on the site.</p><p><a href="' + esc(url) + '" target="_blank" rel="noopener noreferrer">Open it on the site ↗</a></p>' + freeAlternatives(url); return; }
    const paras = String(r.text).split(/\n{1,}/).map(s => s.trim()).filter(s => s.length > 40);
    b.innerHTML = '<div class="nw-row" style="margin:-4px 0 10px"><button class="ib" data-sumart>✨ Summarise this article</button><span class="small mute">by your local AI, from this text only</span></div><div id="nwsumart" class="nw-ai" style="display:none;background:var(--panel);border:1px solid var(--line);border-radius:10px;padding:10px 12px;margin-bottom:12px"></div>' +
      '<h2 style="margin:0 0 14px;line-height:1.25">' + esc(r.title || '') + '</h2>' + (paras.length ? paras.map(p => '<p>' + esc(p) + '</p>').join('') : '<p>' + esc(r.text) + '</p>') + '<p class="small mute">Text taken from the page. Pictures, captions and anything behind a paywall are not shown.</p>';
  }

  /* summarise the article open in the reader */
  const READCACHE = {};
  async function summariseArticle(o, url) {
    const box = o.querySelector('#nwsumart'); if (!box) return; box.style.display = ''; box.innerHTML = '<span class="mute">Reading the article…</span>';
    let r = READCACHE[url]; if (!r) { try { r = await A.api('/api/net/page', { url }); } catch (e) { r = { error: e.message }; } READCACHE[url] = r; }
    if (!r || r.error || !r.text) { box.textContent = 'The article text could not be read.'; return; }
    try {
      await A.ai.stream([{ role: 'system', content: 'Summarise this news article for a busy reader using ONLY its text. Format:\n**In one line**\none sentence\n**The key points**\n- 3 to 6 bullets\n**Who said what**\n- the main claims and who made them, or "No attributed claims."\n**What it does not say**\n- 1 or 2 bullets about obvious open questions\nNo outside knowledge.' }, { role: 'user', content: (r.title || '') + '\n\n' + String(r.text).replace(/\s+/g, ' ').slice(0, 9000) }], t => { box.innerHTML = md(t); }, null, { temp: .2 });
    } catch (e) { box.textContent = 'The local AI could not summarise it: ' + e.message; }
  }

  /* ---------- research: any topic, from the news and the web, with an AI overview that cites its sources ---------- */
  let lastResearch = null;
  function researchView(b) {
    b.innerHTML = '<div style="overflow:auto;flex:1;min-height:0;padding:14px 18px 40px"><div style="max-width:900px;margin:0 auto"><h2 style="margin:0 0 4px">🔍 Research</h2><div class="small mute" style="margin-bottom:10px;line-height:1.5">Type any topic, person, company or event. Moundshroud searches two weeks of news and the web, reads the best articles, and your local AI writes an overview from those sources only, numbered so you can check every claim. Or paste an article’s address to read and summarise it.</div>' +
      '<div class="nw-row"><input id="rsq" style="flex:1;min-width:220px;font-size:15px" placeholder="e.g. Binance hack, Federal Reserve rates, Christa Pike, or https://…" value="' + esc(lastResearch ? lastResearch.q : '') + '"><button class="pri" id="rsgo">Research</button></div><div id="rsout" style="margin-top:14px"></div></div></div>';
    const qi = b.querySelector('#rsq'), out = b.querySelector('#rsout');
    const go = async () => {
      const v = qi.value.trim(); if (!v) return;
      if (/^https?:\/\//i.test(v)) { reader(v, ''); return; }
      out.innerHTML = '<div class="nw-card"><div class="mute" id="rsstep">Searching the news archive and the web…</div></div>';
      let r; try { r = await A.api('/api/news/research', { q: v }); } catch (e) { r = { error: e.message }; }
      if (!b.contains(out)) return;
      if (r.error) { out.innerHTML = '<div class="nw-card">Could not research that: ' + esc(r.error) + '</div>'; return; }
      lastResearch = r; show(r);
    };
    const show = r => {
      const srcs = [], add = (x, kind) => { if (!srcs.some(y => y.url === x.url)) srcs.push(Object.assign({ kind }, x)); };
      r.pages.forEach(p => add(p, 'read'));
      r.archive.forEach(a => add({ url: a.url, title: a.title, outlet: a.outlet, date: a.date, snippet: a.desc, via: a.via }, 'news'));
      r.web.forEach(w => add({ url: w.url, title: w.title, outlet: w.outlet, snippet: w.snippet }, 'web'));
      const n = srcs.length;
      out.innerHTML = (r.internet ? '' : '<div class="nw-banner" style="margin:0 0 10px">🔌 Internet access is off, so only the downloaded news archive was searched.</div>') +
        '<div class="nw-card"><h4>Overview <span style="text-transform:none;letter-spacing:0;font-weight:400">· written by your local AI from the ' + Math.min(n, 14) + ' sources below only</span></h4><div class="nw-ai" id="rsai"><span class="mute">' + (n ? 'Reading ' + r.pages.length + ' articles in full and ' + (n - r.pages.length) + ' more headlines…' : 'Nothing was found.') + '</span></div><div class="nw-row" style="margin-top:8px"><button class="ib" id="rscopy">📋 Copy with sources</button></div></div>' +
        '<div class="nw-card"><h4>Sources (' + n + ')</h4>' + srcs.map((x, i) => '<div class="nw-art"><div class="nw-src"><b>[' + (i + 1) + '] ' + esc(x.outlet || '') + '</b>' + (x.kind === 'read' ? '<span class="nw-tag" style="border-color:var(--ok);color:var(--ok)">read in full</span>' : x.kind === 'news' ? '<span class="nw-tag">from the News archive</span>' : '<span class="nw-tag">web result</span>') + (x.date ? '<span>· ' + clock(x.date) + '</span>' : '') + '</div><a class="nw-at" href="' + esc(x.url) + '" target="_blank" rel="noopener noreferrer">' + esc(x.title || x.url) + '</a>' + (x.snippet ? '<div class="nw-ad">' + esc(String(x.snippet).slice(0, 260)) + '</div>' : '') + '<div class="nw-acts">' + (x.via ? '' : '<button class="ib" data-r="' + esc(x.url) + '" data-n="' + esc(x.outlet || '') + '">📖 Read here</button>') + '<a class="ib" href="' + esc(x.url) + '" target="_blank" rel="noopener noreferrer">↗ Open</a></div></div>').join('') + '</div>';
      out.onclick = ev => { const rr = ev.target.closest('[data-r]'); if (rr) { ev.preventDefault(); reader(rr.dataset.r, rr.dataset.n); } if (ev.target.id === 'rscopy') { const t = (out.querySelector('#rsai').innerText || '') + '\n\nSources:\n' + srcs.map((x, i) => '[' + (i + 1) + '] ' + (x.outlet || '') + ', “' + (x.title || '') + '”. ' + x.url).join('\n'); copy(t, 'Copied the overview and its sources.'); } };
      if (!n) return;
      const material = srcs.slice(0, 14).map((x, i) => '[' + (i + 1) + '] ' + (x.outlet || '') + (x.date ? ', ' + new Date(x.date).toDateString() : '') + ': ' + (x.title || '') + '\n' + (x.text ? x.text.slice(0, 3000) : (x.snippet || '')));
      const sys = 'You are a careful researcher writing for a journalist. Write an overview of the topic using ONLY the numbered sources given. RULE: every sentence and every bullet must end with the number of the source it came from, in square brackets, like [3] or [2, 5]. A statement without a number is not allowed. Never add facts from your own knowledge. If sources disagree, say so and cite both. Format:\n**Overview**\n3 to 5 sentences.\n**Key facts**\n- 4 to 8 bullets, each cited\n**Where sources differ**\n- bullets, or "No clear disagreements."\n**Latest developments**\n- bullets with dates where the sources give them\n**Still unclear**\n- 1 to 3 bullets';
      A.ai.stream([{ role: 'system', content: sys }, { role: 'user', content: 'Topic: ' + r.q + '\n\nSources:\n\n' + material.join('\n\n') + '\n\nRemember: end every statement with its source number in brackets.' }], t => { const el = out.querySelector('#rsai'); if (el) el.innerHTML = md(t); }, null, { temp: .2 }).then(t => {
        /* say so plainly when the model did not show where its statements came from */
        const el = out.querySelector('#rsai'); if (!el || !t) return;
        const lines = String(t).split('\n').filter(l => l.trim().length > 40 && !/^\s*(#|\*\*[^*]+\*\*\s*$)/.test(l)), cited = lines.filter(l => /\[\d/.test(l)).length;
        if (lines.length && cited / lines.length < .6) el.insertAdjacentHTML('beforeend', '<div class="small" style="color:var(--warn);margin-top:8px">⚠ The AI did not mark which source every statement came from. Check anything important against the sources below before using it.</div>');
      }).catch(e => { const el = out.querySelector('#rsai'); if (el) el.textContent = 'The local AI could not write the overview: ' + e.message; });
    };
    b.querySelector('#rsgo').onclick = go; qi.onkeydown = e => { if (e.key === 'Enter') go(); };
    if (lastResearch) show(lastResearch); else setTimeout(() => qi.focus(), 50);
  }

  /* ---------- the briefing ---------- */
  function brief(b) {
    const ev = (D ? D.events : []).slice(0, 10), S = SRC();
    b.innerHTML = '<div class="nw-brief"><h2 style="margin:0">Your briefing</h2><div class="small mute" style="margin:2px 0 12px">' + new Date().toLocaleDateString([], { weekday: 'long', month: 'long', day: 'numeric' }) + ' · the ' + ev.length + ' biggest stories right now, ranked by how many independent outlets report them' + (D && D.at ? ' · as of ' + clock(D.at) : '') + '</div>' +
      '<div class="nw-row" style="margin-bottom:6px"><button class="pri" data-b="play">🔊 Read the briefing aloud</button><button class="ib" data-b="stop">■ Stop</button></div>' +
      (ev.length ? ev.map((e, i) => '<div class="nw-bi" data-e="' + e.id + '"><div class="nw-bn">' + (i + 1) + '</div><div style="flex:1;min-width:0"><div class="nw-meta"><span class="nw-cat">' + (CATNAME[e.cat] || e.cat) + '</span><span>' + ago(e.last) + '</span><span class="nw-conf ' + conf(e.outlets.length)[0] + '">' + e.outlets.length + ' outlets</span></div><b class="nw-t" style="font-size:16px">' + esc(e.title) + '</b><div class="nw-ad">' + esc(aiCache[e.id] ? plainMd(aiCache[e.id].text).split('\n').filter(Boolean)[1] || e.summary : e.summary) + '</div></div>' + img(e.img, 'nw-th') + '</div>').join('') : '<div class="nw-empty">No news downloaded yet.</div>') + '</div>';
    b.onclick = ev2 => {
      const p = ev2.target.closest('[data-b]');
      if (p) {
        if (p.dataset.b === 'stop') { briefTok++; try { A.speech.stop(); } catch (x) { } mark(null); return; }
        readBriefing(ev); return;
      }
      const c = ev2.target.closest('[data-e]'); if (c) { st.view = 'list'; st.cat = 'top'; st.sel = c.dataset.e; draw(); open(c.dataset.e); }
    };
  }
  /* the briefing read story by story, so the one being read is highlighted (and scrolled into view) as it goes */
  let briefTok = 0;
  function mark(id) {
    root.querySelectorAll('.nw-bi').forEach(x => x.classList.toggle('reading', x.dataset.e === id));
    const el = id && root.querySelector('.nw-bi[data-e="' + id + '"]'); if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' });
    const pl = root.querySelector('[data-b="play"]'); if (pl) pl.textContent = id ? '🔊 Reading…' : '🔊 Read the briefing aloud';
  }
  async function readBriefing(ev) {
    if (!A.speech || !A.speech.available() || !A.speech.speakAsync) return A.toast('Read aloud is not available here.');
    const my = ++briefTok, say = t => A.speech.speakAsync(t);
    await say('Here is your news briefing for ' + new Date().toLocaleDateString([], { weekday: 'long', month: 'long', day: 'numeric' }) + '.');
    for (let i = 0; i < ev.length; i++) {
      if (my !== briefTok || st.view !== 'brief') return mark(null);
      const e = ev[i]; mark(e.id);
      await say((i === 0 ? 'First. ' : i === ev.length - 1 ? 'And finally. ' : 'Next. ') + e.title + '. ' + (e.summary || '') + ' Reported by ' + e.outlets.length + ' outlets.');
    }
    if (my === briefTok) { mark(null); await say('That is the briefing.'); }
  }
  /* read aloud with the app's own voices (the on-device Natural voices when installed); online voices are never used */
  function speak(parts) {
    if (!A.speech || !A.speech.available()) return A.toast('Read aloud is not available here.');
    A.speech.speak(parts.map(s => String(s || '').trim()).filter(Boolean).join(' '));
  }

  /* ---------- sources ---------- */
  function sourcesView(b) {
    const ORDER = ['wire', 'public', 'paper', 'tv', 'digital', 'magazine', 'intl', 'investigative', 'specialist', 'primary', 'special', 'opinion', 'custom'], ko = k => { const i = ORDER.indexOf(k); return i < 0 ? 99 : i; };
    const list = (D ? D.sources : []).slice().sort((a, b2) => ko(a.kind) - ko(b2.kind) || a.name.localeCompare(b2.name));
    const on = list.filter(s => s.on).length, ok = list.filter(s => s.on && s.ok).length;
    b.innerHTML = '<div class="nw-srcs"><h2 style="margin:0 0 4px">Sources</h2><div class="small mute" style="max-width:820px;line-height:1.5;margin-bottom:10px">' + on + ' outlets switched on, ' + ok + ' answering at the last update. Events are ranked by how many <b>independent</b> outlets report them, so a mix from across the spectrum and around the world is what makes the ranking trustworthy. ' +
      'The lean column is an approximate placement after public media-bias charts (AllSides, Ad Fontes), only for US and UK outlets; you can change any of them. AP, Reuters, CNN and USA Today no longer offer feeds a reader can use, so their headlines come through Google News (headline and link only, no “Read here”).</div>' +
      '<div class="nw-card" style="max-width:820px"><h4>🔒 Privacy</h4>' +
      '<label style="display:flex;gap:8px;align-items:flex-start;margin:4px 0"><input type="checkbox" id="nwpg"' + (D && D.prefs && D.prefs.google ? ' checked' : '') + '><span><b>Get AP, Reuters, CNN and USA Today through Google News</b><br><span class="small mute">These four block feed readers, so their headlines can only come through Google News. Google then sees those requests from this PC (not what you read). Off by default; the other ' + ((D ? D.sources.filter(s => !s.via).length : 58)) + ' outlets come straight from each outlet.</span></span></label>' +
      '<label style="display:flex;gap:8px;align-items:flex-start;margin:8px 0 4px"><input type="checkbox" id="nwpp"' + (!D || !D.prefs || D.prefs.pictures ? ' checked' : '') + '><span><b>Download pictures</b><br><span class="small mute">Pictures come through Moundshroud and are kept on this PC, so no site can set cookies or see what you look at. Off: text only, and nothing extra is downloaded.</span></span></label>' +
      '<div class="small mute" style="margin-top:6px">Always true: feeds are fetched by Moundshroud with an ordinary browser name, with no cookies, account or history attached; what you open, search, follow and summarise never leaves this PC; the AI briefs are written by your local AI.</div></div>' +
      '<div class="nw-row" style="margin:6px 0 10px;gap:8px"><button class="ib" id="nwacc">🔎 Check reading access now</button><span class="small mute">Opens the newest article from each outlet in the reader and records whether the whole article came through, a subscription was asked for, or the site refused. Checked by itself every few days. Moundshroud never gets around paywalls; where an outlet is closed, the event page shows the free reports of the same story.</span></div>' +
      '<table class="nw-tbl"><tr><th>On</th><th>Outlet</th><th>Type</th><th>Country</th><th>Lean</th><th>Status</th><th>Reading here</th><th></th></tr>' +
      list.map(s => '<tr data-s="' + s.id + '"><td><input type="checkbox" data-on' + (s.on ? ' checked' : '') + (s.via && !(D.prefs && D.prefs.google) ? ' disabled title="Switch on Get AP, Reuters, CNN and USA Today through Google News above"' : '') + '></td><td><b>' + esc(s.name) + '</b>' + (s.via ? ' <span class="nw-tag">via Google News</span>' : '') + '</td><td>' + (KIND[s.kind] || s.kind) + '</td><td>' + esc(s.country || '') + '</td>' +
        '<td><select data-lean><option value="">Not rated</option>' + Object.keys(LEAN).map(k => '<option value="' + k + '"' + (s.lean === k ? ' selected' : '') + '>' + LEAN[k][0] + '</option>').join('') + '</select></td>' +
        '<td class="small">' + (s.access ? accessTag(s) : (s.via ? '<span class="mute">headline only</span>' : '<span class="mute">not checked</span>')) + '</td><td class="small">' + (!s.on ? '<span class="mute">off</span>' : !s.at ? '<span class="mute">not fetched yet</span>' : s.err && !s.ok ? '<span style="color:var(--bad)">✕ ' + esc(s.err) + '</span>' : s.err ? '<span style="color:var(--warn)">' + s.ok + ' of ' + s.feeds + ' feeds</span>' : '<span style="color:var(--ok)">✓ ' + s.feeds + ' feed' + (s.feeds > 1 ? 's' : '') + '</span>') + '</td><td>' + (s.custom ? '<button class="ib" data-del>Remove</button>' : '') + '</td></tr>').join('') + '</table>' +
      '<div class="nw-card" style="max-width:820px"><h4>Add a feed</h4><div class="nw-row"><input id="nwcn" placeholder="Name, e.g. My local paper" style="flex:1;min-width:160px"><input id="nwcu" placeholder="RSS or Atom feed address (https://…)" style="flex:2;min-width:240px"><select id="nwcl"><option value="">Not rated</option>' + Object.keys(LEAN).map(k => '<option value="' + k + '">' + LEAN[k][0] + '</option>').join('') + '</select><button class="pri" id="nwca">Add</button></div><div class="small mute" style="margin-top:6px">Most news sites have one: look for “RSS” at the bottom of the site, or try the site’s address followed by /feed or /rss.</div></div></div>';
    const save = async patch => { try { D = await A.api('/api/news/sources', patch); } catch (e) { A.notify('err', 'Could not save: ' + e.message); } };
    b.onchange = async ev => {
      if (ev.target.id === 'nwpg' || ev.target.id === 'nwpp') { await save(ev.target.id === 'nwpg' ? { google: ev.target.checked } : { pictures: ev.target.checked }); sourcesView(b); A.toast(ev.target.id === 'nwpg' ? (ev.target.checked ? 'On. AP, Reuters, CNN and USA Today come in at the next refresh.' : 'Off. Their stories leave at the next refresh.') : (ev.target.checked ? 'Pictures on.' : 'Pictures off: text only.')); if (ev.target.id === 'nwpg' && ev.target.checked) refresh(true, true); return; }
      const tr = ev.target.closest('[data-s]'); if (!tr) return; const id = tr.dataset.s;
      if (ev.target.hasAttribute('data-on')) { const off = D.sources.filter(s => !s.on).map(s => s.id).filter(x => x !== id); if (!ev.target.checked) off.push(id); await save({ off }); A.toast(ev.target.checked ? 'Switched on. It is included from the next refresh.' : 'Switched off. Its stories leave at the next refresh.'); }
      if (ev.target.hasAttribute('data-lean')) { await save({ lean: { [id]: ev.target.value } }); A.toast('Saved. Coverage bars use it from the next refresh.'); }
    };
    b.onclick = async ev => {
      if (ev.target.id === 'nwacc') { ev.target.disabled = true; ev.target.textContent = '⏳ Checking every outlet (about 10 seconds)…'; let r; try { r = await A.api('/api/news/access', { force: true }); } catch (e) { r = { error: e.message }; } if (r.error) A.notify('err', r.error === 'off' ? 'Internet access is off.' : 'Could not check: ' + r.error); else A.notify('ok', 'Reading access: ' + r.full + ' free in full, ' + r.partial + ' partly, ' + r.paywall + ' subscription, ' + r.blocked + ' open on the site only.'); await load(); sourcesView(b); return; }
      if (ev.target.id === 'nwca') {
        const name = b.querySelector('#nwcn').value.trim(), url = b.querySelector('#nwcu').value.trim(), lean = b.querySelector('#nwcl').value;
        if (!name || !/^https?:\/\//.test(url)) return A.toast('Give it a name and a feed address starting with https://');
        const custom = D.sources.filter(s => s.custom).map(s => ({ id: s.id.replace(/^c_/, ''), name: s.name, url: s.url, lean: s.lean, country: s.country }));
        custom.push({ name, url, lean }); await save({ custom }); sourcesView(b); A.toast('Added. Refreshing…'); refresh(true, true);
      }
      const del = ev.target.closest('[data-del]');
      if (del) { const id = del.closest('[data-s]').dataset.s; const custom = D.sources.filter(s => s.custom && s.id !== id).map(s => ({ id: s.id.replace(/^c_/, ''), name: s.name, url: s.url, lean: s.lean, country: s.country })); await save({ custom }); sourcesView(b); }
    };
  }

  /* ---------- the tab ---------- */
  let nwShown = false;
  A.registerTab('news', 'News', async () => {
    if (!root.querySelector('#nwtop')) shell();
    if (!D) { paintTop(); drawBody(); await load(); draw(); }
    else if (!root.querySelector('#nwtop + *') || !nwShown) draw();       // coming back keeps the page as it was: a briefing or research still being written carries on
    nwShown = true;
    if (stale() || (D && D.internet && !D.at)) refresh(false, true);
    clearInterval(timer);
    timer = setInterval(() => { if (A.cur === 'news' && !document.hidden && stale()) refresh(false, true); }, 60000);
  });
  A.newsTab = { load: async () => { await load(); return D; }, refresh, data: () => D, openEvent: id => { if (A.cur !== 'news') A.showTab('news'); setTimeout(() => openEvent(id), 50); } };
})();

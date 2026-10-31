// The page side of internet access: remember whether it is switched on, search, read a result, and open one.
// Everything goes through the local server (which holds the switch, the size limits and the safety checks), and nothing
// here runs at all unless the user turned internet access on in Settings.
(() => {
  let st = { web: false, on: false };
  const box = () => document.getElementById('useweb'), lbl = () => document.getElementById('uwb');

  /* show or hide the "🌐 Web" box under the chat, so it is never offered when the feature is off */
  const paint = () => {
    const l = lbl(), b = box();
    if (l) l.style.display = st.web ? '' : 'none';
    if (b && !st.web) b.checked = false;
  };
  const refresh = async () => { try { st = await A.api('/api/cloud'); } catch (e) { } paint(); return st; };
  const on = () => !!st.web;

  const search = (q, n) => A.api('/api/net/search', { q: q, n: n || 6 });
  const lookup = q => A.api('/api/net/lookup', { q: q });          // search + the top pages, ready to cite
  const page = url => A.api('/api/net/page', { url: url });
  /* A short, grounded brief on a subject, for the tools that make pictures and music: what the web actually says,
     trimmed to a few hundred words, plus the pages it came from. Nothing is fetched when internet access is off. */
  async function research(q, n) {
    if (!on()) return { error: 'Internet access is switched off (Settings, AI & power).' };
    const r = await lookup(q).catch(e => ({ error: e.message }));
    if (!r || r.error) return r || { error: 'Nothing came back.' };
    const pages = (r.pages || []).filter(p => p && p.text);
    const notes = pages.map((p, i) => '[' + (i + 1) + '] ' + (p.title || p.url) + ': ' + String(p.text).replace(/\s+/g, ' ').slice(0, 800)).join('\n');
    const sources = pages.map(p => ({ title: p.title || p.url, url: p.url }));
    (r.results || []).forEach(x => { if (sources.length < 4 && !sources.some(s => s.url === x.url)) sources.push({ title: x.title, url: x.url }); });
    return { notes, sources: sources.slice(0, 4), engine: r.engine || 'DuckDuckGo', query: r.query };
  }

  /* clicking a web source in a chat answer: read the page and show it in the viewer, with its address on top */
  async function open(s) {
    if (!s || !s.url) return;
    A.toast('Reading ' + String(s.url).replace(/^https?:\/\//, '').slice(0, 60) + ' …', 3000);
    const p = await page(s.url).catch(() => null);
    if (!p || p.error) return A.toast((p && p.error) || 'That page could not be read.', 5000);
    try { A.toast('Copied the link'); A.copy(s.url); } catch (e) { }
    A.viewer.open({ path: '', title: (p.title || s.title || s.url) + '  ·  ' + s.url, text: (p.text || '') + (p.more ? '\n\n[The rest of the page was not read: long pages are cut off.]' : ''), url: s.url }, '');
  }

  A.net = { refresh, on, search, lookup, page, research, open, state: () => st };
  A.ready.push(refresh);
  addEventListener('load', refresh);
})();

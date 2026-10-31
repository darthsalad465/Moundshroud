// Remembers what goes wrong in the page, and shows it. Before this, an error in a feature just left a blank panel or a
// button that did nothing, with nothing to look at afterwards. Every error is kept (last 25 in this window, and the server
// writes the same lines to data\problems.log), so "it broke yesterday" can actually be looked up.
(() => {
  const KEY = 'problems', MAXN = 25;
  const list = () => { try { const a = JSON.parse(ls.get(KEY, '[]')); return Array.isArray(a) ? a : []; } catch (e) { return []; } };
  const save = a => { try { ls.set(KEY, JSON.stringify(a.slice(-MAXN))); } catch (e) { } };

  const push = (kind, text, where) => {
    const row = { at: new Date().toISOString().slice(0, 19).replace('T', ' '), kind: String(kind || 'page'), text: String(text == null ? '' : text).slice(0, 500), where: String(where || '').slice(0, 170) };
    if (!row.text) return row;
    const a = list(); a.push(row); save(a);
    try { fetch('/api/problems', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(row) }); } catch (e) { }
    return row;
  };

  /* errors that no code caught. Broken images are not interesting (the library art is allowed to be missing). */
  addEventListener('error', e => {
    const t = e.target;
    if (t && t !== window && /^(IMG|SOURCE|TRACK)$/.test(t.tagName || '')) return;
    push('page', e.message || 'Script error', ((e.filename || '').split('/').pop() || '') + ':' + (e.lineno || 0));
  }, true);
  addEventListener('unhandledrejection', e => {
    const r = e.reason || {}, stack = String(r.stack || '').split('\n')[1] || '';
    push('promise', (r && (r.message || r)) || 'rejected', stack.trim());
  });

  const esc = s => String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

  const copy = text => { try { A.copy(text); } catch (e) { try { navigator.clipboard.writeText(text); } catch (e2) { } } };

  async function open() {
    let srv = null; try { srv = await A.api('/api/problems'); } catch (e) { }
    const mine = list().slice().reverse(), rows = (srv && srv.recent ? srv.recent.slice().reverse() : []);
    const line = r => '<div style="padding:6px 0;border-bottom:1px solid var(--line)"><b>' + esc(r.kind) + '</b> <span class="small mute">' + esc(r.at) + (r.where ? ' · ' + esc(r.where) : '') + '</span><div class="small" style="margin-top:2px;overflow-wrap:anywhere">' + esc(r.text) + '</div></div>';
    const logText = () => (srv && srv.tail ? srv.tail : '') || 'No problems have been written to the log.';
    A.dlg('<div class="hd"><b>Problems &amp; crash log</b><span class="sp"></span></div><div class="bd">' +
      '<div class="small mute" style="margin-bottom:8px">Nothing here is sent anywhere: it is written to <code>' + esc((srv && srv.file) || 'data\\problems.log') + '</code> on this PC, so it can be looked at later (or pasted into a message) instead of guessing.</div>' +
      '<div style="max-height:300px;overflow:auto">' + (rows.length ? rows.map(line).join('') : '<div class="small mute">No problems have been recorded. That is the good answer.</div>') + '</div>' +
      (mine.length ? '<div class="small mute" style="margin:12px 0 4px">From this window, not yet written to the log:</div><div style="max-height:140px;overflow:auto">' + mine.map(line).join('') + '</div>' : '') +
      '<div class="row" style="gap:8px;flex-wrap:wrap;margin-top:14px"><button class="ib" id="pbcopy">Copy the log</button><button class="ib" id="pbclear">Clear this window\'s list</button><button class="ib" id="pbfile">Open the log file</button><span class="sp"></span><button class="pri" id="pbclose">Close</button></div>' +
      '<details style="margin-top:12px"><summary class="small mute" style="cursor:pointer">The whole log so far</summary><pre class="small" style="white-space:pre-wrap;max-height:240px;overflow:auto;margin-top:6px">' + esc(logText()) + '</pre></details>' +
      '</div>');
    const q = id => document.getElementById(id);
    q('pbclose').onclick = A.closeDlg;
    q('pbcopy').onclick = () => { copy(logText()); A.toast('The log is on the clipboard.', 2500); };
    q('pbclear').onclick = () => { save([]); A.toast('Cleared the list for this window.'); A.closeDlg(); };
    q('pbfile').onclick = () => { A.api('/api/problems/open', {}).catch(() => { }); A.toast('Opening data\\problems.log'); };
  }

  A.problems = { list, push, open, clear: () => save([]), copy };
})();

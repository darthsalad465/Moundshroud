// What the AI remembers about you: short facts you asked it to keep ("remember that I'm vegetarian"), stored on
// this PC in data\memory.json and added to the chat AI's instructions so it can use them in every conversation.
// You can see, add and delete every one of them (Ctrl+K › What the AI remembers).
(() => {
  let facts = [], loaded = false;
  const save = () => A.api('/api/kv?name=memory', facts.slice(0, 200)).catch(() => { });
  const load = () => A.api('/api/kv?name=memory').then(a => { facts = Array.isArray(a) ? a.filter(f => f && f.t) : []; loaded = true; }).catch(() => { loaded = true; });
  load();
  const norm = s => String(s || '').toLowerCase().replace(/[^a-z0-9 ]/g, ' ').replace(/\s+/g, ' ').trim();

  function add(text) {
    const t = String(text || '').replace(/\s+/g, ' ').trim().slice(0, 300); if (!t) return null;
    if (facts.some(f => norm(f.t) === norm(t))) return null;
    const f = { id: Date.now().toString(36) + Math.random().toString(36).slice(2, 6), t, at: Date.now() }; facts.unshift(f); save(); return f;
  }
  /* forgetting by words: removes the facts that share most of their words with what was said */
  function forget(text) {
    const w = norm(text).split(' ').filter(x => x.length > 2); if (!w.length) return [];
    const gone = facts.filter(f => { const fw = norm(f.t); const hits = w.filter(x => fw.includes(x)).length; return hits >= Math.max(1, Math.ceil(w.length * .6)); });
    if (gone.length) { facts = facts.filter(f => !gone.includes(f)); save(); }
    return gone;
  }
  function remove(id) { facts = facts.filter(f => f.id !== id); save(); }
  const prompt = () => facts.length ? '\n\nThings the user asked you to remember about them (use them when relevant; do not repeat them back unprompted):\n' + facts.slice(0, 60).map(f => '- ' + f.t).join('\n') : '';

  function manage() {
    const draw = () => {
      A.dlg('<div class="hd"><b>🧠 What the AI remembers about you</b></div><div class="bd"><div class="small mute" style="line-height:1.5;margin-bottom:8px">Say “remember that…” in Chat and it is kept here; “forget that…” removes it. These are added to the chat AI’s instructions in every conversation. They stay on this PC, except that if you chat with a Claude model they are sent to Anthropic with your messages.</div>' +
        (facts.length ? facts.map(f => '<div class="row" style="padding:4px 0;border-bottom:1px solid var(--line)"><span style="flex:1">' + esc(f.t) + '</span><span class="small mute">' + new Date(f.at).toLocaleDateString() + '</span><button class="ib" data-rm="' + f.id + '" title="Forget this">✕</button></div>').join('') : '<div class="mute">Nothing yet.</div>') +
        '<div class="row" style="margin-top:10px"><input id="memadd" placeholder="Add something, e.g. I am allergic to peanuts" style="flex:1"><button class="ib" id="memgo">Add</button></div>' +
        '<div class="row" style="margin-top:12px">' + (facts.length ? '<button class="ib dang" id="memall">Forget everything</button>' : '') + '<span class="sp"></span><button class="pri" id="memok">Done</button></div></div>');
      const d = document.getElementById('dlg');
      d.querySelectorAll('[data-rm]').forEach(b => b.onclick = () => { remove(b.dataset.rm); draw(); });
      const i = d.querySelector('#memadd'), go = () => { if (add(i.value)) draw(); else i.select(); };
      d.querySelector('#memgo').onclick = go; i.onkeydown = e => { if (e.key === 'Enter') go(); };
      const all = d.querySelector('#memall'); if (all) all.onclick = () => { if (confirm('Forget everything the AI remembers about you?')) { facts = []; save(); draw(); } };
      d.querySelector('#memok').onclick = A.closeDlg;
    };
    (loaded ? Promise.resolve() : load()).then(draw);
  }

  A.memory = { add, forget, remove, prompt, manage, get list() { return facts.slice(); } };
  try { if (A.cmd && A.cmd.reg) A.cmd.reg([{ title: 'What the AI remembers about me', sub: 'See, add or delete the facts the chat AI keeps', icon: '🧠', group: 'Do', tags: 'memory remember forget about me facts ai personal', run: manage }]); } catch (e) { }
})();

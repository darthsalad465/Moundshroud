// The tab layout of October 2026: tools that used to sit inside other tabs become tabs of their own in the menus.
//  Office menu (was Knowledge): Library, My Files, Notes, Mail + Documents, Office files, Calculator, Scanner,
//    Meeting notes, Reminders & timers, Clipboard (from Tools)
//  Education menu (was Learn): Study, Languages (now with Translate), Sky, Lab + Writing, Practice, Teach me (from Studio)
//  Personal menu (was Life): Kitchen, Garden, Money, Journal + Albums (from Studio)
//  Entertainment menu (was Fun): Games (was Entertainment, now with the Puzzle maker), Music, Photos
//  On their own: Studio, Cyber (with Passwords and the cyber games), Tools (System, Converter), Prepare (with Prompts)
// The code of each tool is unchanged; it is only shown in a new place. Old links (A.tools.go, A.studio.go, A.prep.open)
// still land in the right place. This file loads just before main.js, which puts the tabs in order.
(() => {
  /* a tab that shows one tool, opened fresh each time (as it was in its old place) */
  function toolTab(id, label, render, again) {
    const p = document.getElementById('p-' + id); if (!p) return;
    p.innerHTML = '<div style="flex:1;min-height:0;display:flex;flex-direction:column"></div>'; const b = p.firstChild;
    const open = () => { if (b._cleanup) { try { b._cleanup(); } catch (e) { } b._cleanup = null; } b.innerHTML = ''; b.onclick = null; try { render(b); } catch (e) { b.innerHTML = '<div class="pad mute">This page could not open: ' + String(e.message || e) + '</div>'; } };
    A.registerTab(id, label, open);
    if (again) again(open);
  }
  const fromTools = s => b => A.tools.show(s, b);

  /* Office */
  toolTab('docs', 'Documents', fromTools('docs'));
  toolTab('offed', 'Office files', fromTools('office'));
  toolTab('calc', 'Calculator', fromTools('calc'));
  toolTab('scan', 'Scanner', fromTools('scan'));
  toolTab('meet', 'Meeting notes', fromTools('meet'));
  toolTab('rem', 'Reminders & timers', fromTools('rem'), open => A.on('reminders', () => { if (A.cur === 'rem') open(); }));
  toolTab('clip', 'Clipboard', fromTools('clip'));

  /* Education and Personal: tools lifted out of Studio */
  const studio = (sid, tab, label) => { const t = A.studio && A.studio.take ? A.studio.take(sid, tab) : null; toolTab(tab, label, b => { if (t && t.render) { try { A.speech && A.speech.stop && A.speech.stop(); } catch (e) { } t.render(b); } else b.innerHTML = '<div class="pad mute">Not available.</div>'; }); };
  studio('writing', 'writing', 'Writing');
  studio('practice', 'practice', 'Practice');
  studio('teach', 'teach', 'Teach me');
  studio('albums', 'albums', 'Albums');

  /* Games: the Puzzle maker (word searches and crosswords) joins the games */
  if (A.play && A.play.addSub && A.puzzlemaker) A.play.addSub('puzz', '🧩 Puzzle maker', b => A.puzzlemaker.render(b));
})();

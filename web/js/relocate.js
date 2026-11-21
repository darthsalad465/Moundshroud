// New homes for pages that moved out of Tools, Prepare and Entertainment:
//  Journal -> its own tab in the Personal group;  Code Breaker, Cyber Course, Cyber Lab, CyberChef, Passwords and the cyber games -> the Cyber tab;
//  Writing coach, Practice (plus buttons for the Thesaurus and Rhymer) -> Studio;  Storage -> Settings > Backup & data;  the Bible reader -> the Library tab (library.js).
// A.tools.go() and A.prep.open() still accept the old page names and send you to the new place, so older shortcuts keep working.
(() => {
  /* ---------- Journal ---------- */
  const jp = document.getElementById('p-journal');
  if (jp && A.journal) {
    jp.innerHTML = '<div id="jrbody" style="flex:1;min-height:0;display:flex;flex-direction:column"></div>';
    A.registerTab('journal', 'Journal', () => { A.keep(document.getElementById('jrbody'), 'journal', el => A.journal.render(el)); });      // kept: a half-written entry stays
  }
  /* ---------- Cyber (Code Breaker, Cyber Course, Cyber Lab, CyberChef) ---------- */
  const cp = document.getElementById('p-cyber'); let cysub = ls.get('cysub', 'arena');
  /* everything about security in one place, in three groups: learn it, use the tools, play the games */
  const CY = [['arena', '◈ Red / Blue', 'Arena'], ['switchyard', 'Switchyard', 'Arena'], ['course', '🎓 Course', 'Learn'], ['code', '💻 Coding', 'Learn'], ['workshop', 'Debug workshop', 'Learn'],['cyber', '🛡️ Cyber Lab', 'Learn'], ['vault', '🔐 Passwords', 'Tools'], ['crack', '🔓 Cracker', 'Tools'], ['kit', '🧰 Toolkit', 'Tools'], ['artex', '🤖 ARTEX', 'Tools'], ['codes', '🔓 Code Breaker', 'Tools'], ['chef', '🧰 CyberChef', 'Tools'], ['ptracer', '🧪 Packet Tracer', 'Labs'], ['sqllab', '🗃 SQL', 'Labs'], ['subnet', '🌐 Subnet', 'Labs'], ['regex', '🔍 Regex', 'Labs'], ['juice', '🧃 Juice Shop', 'Labs'], ['jwt', '🔑 JWT', 'Labs'], ['cipher', '🔐 Ciphers', 'Labs'], ['re', '🔬 Reverse', 'Labs'], ['hashlab', '#️⃣ Hash', 'Labs'], ['jsonlab', '{ } JSON', 'Labs'], ['desktop', '◈ Cyber Desktop', 'Play'], ['games', '🕶️ Cyber games', 'Play']];
  let cyGame = '';
  /* the cyber games (registered with the Games tab, cat: 'cyber') run right here */
  const games = b => {
    const P = A.play || {}, list = Object.entries(P.games || {}).filter(([, g]) => g.cat === 'cyber').sort((a, c) => a[1].name.localeCompare(c[1].name));
    const run = id => {
      const g = P.games[id]; if (!g) return; cyGame = '';
      b.innerHTML = '<div class="row" style="padding:8px 12px;border-bottom:1px solid var(--line);gap:8px"><button class="ib" id="cygx">&larr; Cyber games</button><b style="flex:1">' + g.icon + ' ' + esc(g.name) + '</b><span class="small mute" id="cyghud"></span><span class="small mute" id="cygbest"></span></div><div id="cygstage" tabindex="0" style="flex:1;min-height:0;overflow:auto;display:flex;flex-direction:column;align-items:center;padding:12px"></div>';
      const best = () => { const v = P.best ? P.best(id) : null, e = b.querySelector('#cygbest'); if (e) e.textContent = v === null || v === undefined ? '' : 'Best: ' + v; }; best();
      const api = { id, hud: t => { const h = b.querySelector('#cyghud'); if (h) h.textContent = t; }, submit: (sc, lower) => { const nb = P.submit ? P.submit(id, sc, lower) : false; best(); return nb; }, level: P.level ? P.level(id) : 1 };
      let stop = null; try { stop = g.mount(b.querySelector('#cygstage'), api) || null; } catch (e) { A.toast('That game hit a problem: ' + e.message, 4000); }
      b._cleanup = () => { try { stop && stop(); } catch (e) { } };
      b.querySelector('#cygx').onclick = () => { if (b._cleanup) { b._cleanup(); b._cleanup = null; } games(b); };
    };
    b.innerHTML = '<div class="scroll pad" style="flex:1"><h2 style="margin:0 0 4px">🕶️ Cyber games</h2><div class="dw-gateway"><div><b>Red / Blue · Access review</b><small>Investigate an access incident or repair the records service. Every case has its own seed.</small></div><button class="ib" data-arena>Choose a side →</button></div><div class="dw-gateway"><div><b>Red / Blue · Remote access</b><small>Run a whole intrusion — scan, foothold, escalation, lateral movement, objective — then defend the same chain. Every case is seeded and different.</small></div><button class="ib" data-rasim>Take the estate →</button></div><div class="dw-gateway"><div><b>Live fire · red vs blue</b><small>Take the offence against a bot that rotates credentials and kills your session, or run the SOC against a bot that is already inside. Real clock, real trace, real containment.</small></div><button class="ib" data-lfosim>Choose an opponent →</button></div><div class="dw-gateway"><div><b>Terminal playground</b><small>Ten sandboxed shells — Bash, PowerShell, cmd, Python, Node, SQL, Git, Docker, network and encoders — with every command listed and one click to run it.</small></div><button class="ib" data-tpgsim>Open the sandbox →</button></div><div class="dw-gateway"><div><b>Terminal ops · full intrusion</b><small>Play the whole intrusion from a shell — scan, decode the leak, get in, escalate, pivot, submit. Unlimited estates at four difficulties.</small></div><button class="ib" data-topsim>Open the terminal →</button></div><div class="small mute" style="margin-bottom:12px">Practise spotting phishing, reading logs, networking, SQL injection and the command line, as games. Nothing here touches real systems.</div><div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(220px,1fr));gap:10px">' +
      list.map(([id, g]) => '<div class="card" data-g="' + id + '" style="cursor:pointer;margin:0"><div style="font-size:28px">' + g.icon + '</div><b>' + esc(g.name) + '</b><div class="small mute" style="margin-top:4px;line-height:1.45">' + esc(g.desc || '') + '</div></div>').join('') + '</div></div>';
    b.onclick = e => { if (e.target.closest('[data-arena]')) return A.cybertab.go('arena'); if (e.target.closest('[data-rasim]')) return A.cybertab.go('games', 'remote_access'); if (e.target.closest('[data-topsim]')) return A.cybertab.go('games', 'terminal_ops'); if (e.target.closest('[data-lfosim]')) return A.cybertab.go('games', 'live_fire'); if (e.target.closest('[data-tpgsim]')) return A.cybertab.go('games', 'terminal_playground'); const c = e.target.closest('[data-g]'); if (c) { b.onclick = null; run(c.dataset.g); } };
    if (cyGame) run(cyGame);
  };
  const esc = t => String(t == null ? '' : t).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const chef = b => { b.innerHTML = '<div class="small mute" style="padding:6px 12px">CyberChef, the "cyber swiss-army knife": encode, decode, hash, convert and analyse data. Runs fully offline.</div><iframe src="/cyberchef/" style="flex:1;border:0;width:100%;background:#fff"></iframe>'; };
  const cyShow = s => {
    cysub = s; ls.set('cysub', s); const bar = document.getElementById('cysub'), body = document.getElementById('cybody'); if (!bar || !body) return;
    let grp = ''; bar.innerHTML = CY.filter(x => x[0] !== 'chef' || A.caps.chef).map(x => { const h = x[2] !== grp ? (grp ? '<span style="width:1px;align-self:stretch;background:var(--line);margin:0 4px"></span>' : '') + '<span class="small mute" style="align-self:center">' + x[2] + '</span>' : ''; grp = x[2]; return h + '<button class="ib' + (x[0] === s ? ' on' : '') + '" data-s="' + x[0] + '">' + x[1] + '</button>'; }).join('');
    /* kept alive (A.keep), except the games, which stop when you leave them */
    const R2 = { arena: A.accessExercise.render, switchyard: A.switchyard.render, workshop: A.debugWorkshop.render, course: b => A.cybercourse.render(b), code: b => A.codeLessons.render(b),codes: b => A.cbLab.render(b), cyber: b => A.cyber.render(b), vault: b => A.vault.render(b), kit: b => A.cyberTools.render(b), artex: b => A.artex.render(b), ptracer: b => A.cyberLabs.ptracer(b), sqllab: b => A.cyberLabs.sqllab(b), subnet: b => A.cyberLabs.subnet(b), regex: b => A.cyberLabs.regex(b), juice: b => A.cyberLabs.juice(b), jwt: b => A.cyberLabs.jwt(b), cipher: b => A.cyberLabs.cipher(b), hashlab: b => A.cyberLabs.hashlab(b), jsonlab: b => A.cyberLabs.jsonlab(b), re: b => A.cyberLabs.re(b), crack: b => A.cyberLabs.crack(b), games, chef, desktop: A.cyberDesktop.mount };
    A.keep(body, s, el => R2[s](el), { fresh: s === 'games' });
  };
  if (cp) {
    cp.innerHTML = '<div class="row" id="cysub" style="padding:8px 12px;gap:6px;border-bottom:1px solid var(--line);flex-wrap:wrap"></div><div id="cybody" style="flex:1;min-height:0;display:flex;flex-direction:column"></div>';
    cp.querySelector('#cysub').onclick = e => { const b = e.target.closest('[data-s]'); if (b) cyShow(b.dataset.s); };
    A.registerTab('cyber', 'Cyber', () => cyShow(CY.some(x => x[0] === cysub) ? cysub : 'arena'));
  }
  A.cybertab = { go: (s, game) => { cysub = CY.some(x => x[0] === s) ? s : 'arena'; cyGame = game || ''; if (A.cur === 'cyber') cyShow(cysub); else A.showTab('cyber'); } };
  /* ---------- Studio: Writing coach and Practice, with the word tools ---------- */
  if (A.studio && A.prep && A.prep.sections) {
    A.studio.reg('writing', '✍️ Writing', body => {
      A.prep.sections.writing(body); const h = body.querySelector('h2');
      if (h) h.insertAdjacentHTML('afterend', '<div class="row" style="gap:8px;margin:8px 0;flex-wrap:wrap;align-items:center"><button class="ib" id="wtthes">📚 Thesaurus</button><button class="ib" id="wtrhy">🎵 Rhymer</button><span class="small mute">Synonyms and antonyms, or rhymes for songs and poems, for any word.</span></div>');
      const t = body.querySelector('#wtthes'), r = body.querySelector('#wtrhy'); if (t) t.onclick = () => A.thes.open(''); if (r) r.onclick = () => A.rhyme.open('');
    }, 20);
    A.studio.reg('practice', '🎤 Practice', body => A.prep.sections.practice(body), 21);
  }
})();

// Entertainment > Games > President of Velmora: a president simulator in a made-up republic. Rules live in
// president-engine.js (window.PresSim). This file draws the screens: the desk with events and crises, the budget,
// the Assembly and its bills, the cabinet, polls with a province map, the log, election night and the ending.
// The local AI is optional: advisors can speak in their own words and it can write extra events. Saved after every move
// in this browser's storage (ls pres_save).
(() => {
  const P = A.play, X = window.PresSim; if (!P || !X) return;
  const KEY = 'pres_save';
  const CSS = `
.pres{--ink:#1d2433;--paper:#f4eedf;--paper2:#e9e0c8;--navy:#14233d;--navy2:#1d3257;--gold:#c9a227;--red:#a8352a;--grn:#2f7d4f;--mut:#6b6a63;
  width:100%;max-width:1120px;margin:0 auto;color:var(--ink);font:14px/1.45 Georgia,'Times New Roman',serif;background:var(--navy);border-radius:14px;padding:12px;box-sizing:border-box}
:is(#plstage,body) .pres *{box-sizing:border-box}
:is(#plstage,body) .pres button{font:inherit;cursor:pointer}
:is(#plstage,body) .pres button:disabled{cursor:not-allowed;opacity:.45}
:is(#plstage,body) .pres .ph{display:flex;align-items:center;gap:12px;color:#f4eedf;flex-wrap:wrap;margin-bottom:10px}
:is(#plstage,body) .pres .ph h2{margin:0;font-size:20px;letter-spacing:.02em}
:is(#plstage,body) .pres .ph .sub{font-size:12.5px;color:#cbd5e6}
:is(#plstage,body) .pres .chip{display:inline-block;border-radius:999px;padding:1px 9px;font-size:12px;font-family:system-ui,sans-serif;background:var(--paper2);color:var(--ink);margin:1px 2px}
:is(#plstage,body) :is(#plstage,body) .pres .chip.good{background:#d7ecd9;color:#1d5a35}:is(#plstage,body) .pres .chip.bad{background:#f3d6d1;color:#7e2219}
:is(#plstage,body) .pres .meters{display:grid;grid-template-columns:repeat(auto-fit,minmax(96px,1fr));gap:6px;margin-bottom:10px}
:is(#plstage,body) .pres .pmt{background:var(--navy2);border:1px solid #2c4672;border-radius:9px;padding:6px 8px;color:#f4eedf}
:is(#plstage,body) .pres .pmt b{display:block;font-size:17px;font-family:system-ui,sans-serif}
:is(#plstage,body) .pres .pmt span{font-size:11px;color:#b9c6dd;font-family:system-ui,sans-serif;text-transform:uppercase;letter-spacing:.05em}
:is(#plstage,body) .pres .pmt i{font-style:normal;font-size:11px;margin-left:4px}
:is(#plstage,body) :is(#plstage,body) .pres .up{color:#7fd69b}:is(#plstage,body) .pres .dn{color:#ff9b8c}
:is(#plstage,body) .pres .tabs{display:flex;gap:4px;flex-wrap:wrap;margin-bottom:10px}
:is(#plstage,body) .pres .tab{background:transparent;border:1px solid #3a5582;color:#dfe6f2;border-radius:8px 8px 0 0;padding:6px 12px}
:is(#plstage,body) .pres .tab.on{background:var(--paper);color:var(--ink);border-color:var(--paper);font-weight:bold}
:is(#plstage,body) .pres .page{background:var(--paper);border-radius:0 10px 10px 10px;padding:14px;min-height:420px}
:is(#plstage,body) .pres .cols{display:grid;grid-template-columns:minmax(0,1.6fr) minmax(250px,1fr);gap:14px}
@media(max-width:820px){:is(#plstage,body) .pres .cols{grid-template-columns:1fr}}
:is(#plstage,body) .pres .card{background:#fffaf0;border:1px solid #d8cba8;border-radius:10px;padding:12px;margin-bottom:12px;box-shadow:0 1px 0 #d8cba8}
:is(#plstage,body) .pres .card h3{margin:0 0 4px;font-size:17px}
:is(#plstage,body) .pres .page :is(h1,h2,h3,b,label,td){color:var(--ink);-webkit-text-fill-color:currentColor;background:none}
:is(#plstage,body) .pres .card.crisis{border-color:var(--red);box-shadow:0 0 0 2px #a8352a33}
:is(#plstage,body) .pres .tag{font:bold 10.5px system-ui,sans-serif;letter-spacing:.08em;text-transform:uppercase;border-radius:5px;padding:1px 6px;margin-left:6px;vertical-align:middle}
:is(#plstage,body) .pres .tag.c{background:var(--red);color:#fff}:is(#plstage,body) .pres .tag.ai{background:var(--navy2);color:#fff}
:is(#plstage,body) .pres .choice{display:flex;width:100%;text-align:left;gap:8px;align-items:flex-start;background:var(--paper);border:1px solid #cdbf98;border-radius:8px;padding:8px 10px;margin:6px 0;color:var(--ink);flex-wrap:wrap}
:is(#plstage,body) .pres .choice:hover:not(:disabled){border-color:var(--navy2);background:#fff}
:is(#plstage,body) .pres .choice.picked{border:2px solid var(--navy2);background:#fff;opacity:1}
:is(#plstage,body) .pres .choice .ct{flex:1 1 200px;font-weight:bold}
:is(#plstage,body) .pres .recs{font-size:12px;font-family:system-ui,sans-serif;color:var(--mut)}
:is(#plstage,body) .pres .btn{background:var(--navy2);color:#fff;border:0;border-radius:8px;padding:7px 12px}
:is(#plstage,body) .pres .btn:hover:not(:disabled){background:var(--navy)}
:is(#plstage,body) .pres .btn.gold{background:var(--gold);color:#1b1505;font-weight:bold}
:is(#plstage,body) .pres .btn.ghost{background:transparent;color:var(--navy2);border:1px solid var(--navy2)}
:is(#plstage,body) .pres .btn.ghost:hover:not(:disabled){color:#fff}
:is(#plstage,body) .pres .btn.big{font-size:16px;padding:11px 16px;width:100%}
:is(#plstage,body) .pres .note{background:#eef2f8;border-left:3px solid var(--navy2);padding:8px 10px;border-radius:6px;margin-top:8px;font-style:italic;white-space:pre-wrap}
:is(#plstage,body) .pres .mut{color:var(--mut)}:is(#plstage,body) .pres .small{font-size:12.5px}
:is(#plstage,body) .pres .row{display:flex;gap:6px;flex-wrap:wrap;align-items:center}
:is(#plstage,body) .pres .bar{height:8px;background:#ddd2b4;border-radius:5px;overflow:hidden}:is(#plstage,body) .pres .bar i{display:block;height:100%;background:var(--navy2)}
:is(#plstage,body) .pres .sl{display:grid;grid-template-columns:150px 1fr 70px;gap:8px;align-items:center;margin:6px 0}
:is(#plstage,body) .pres .sl input{width:100%}
:is(#plstage,body) .pres table{border-collapse:collapse;width:100%}:is(#plstage,body) .pres td{padding:3px 4px;border-bottom:1px solid #e3d8bb}
:is(#plstage,body) .pres .seats{display:grid;grid-template-columns:repeat(25,1fr);gap:2px;margin:6px 0}:is(#plstage,body) .pres .seats i{aspect-ratio:1;border-radius:50%;background:#b9b3a3}
:is(#plstage,body) .pres .party{display:block;width:100%;text-align:left;background:#fffaf0;border:2px solid #d8cba8;border-radius:10px;padding:10px;margin:6px 0;color:var(--ink)}
:is(#plstage,body) .pres .party.on{border-color:var(--gold);box-shadow:0 0 0 2px #c9a22755}
:is(#plstage,body) .pres input[type=text]{font:inherit;padding:7px 9px;border-radius:7px;border:1px solid #b9ab86;background:#fff;color:var(--ink);width:100%}
:is(#plstage,body) .pres .center{text-align:center}
:is(#plstage,body) .pres .map text{font:bold 12px system-ui,sans-serif;fill:#14233d;pointer-events:none}
:is(#plstage,body) .pres .map polygon{stroke:#f4eedf;stroke-width:3;transition:fill .5s}
:is(#plstage,body) .pres .log div{padding:4px 0;border-bottom:1px dotted #d6c9a6}
`;
  const seal = s => '<svg viewBox="0 0 100 100" width="' + s + '" height="' + s + '" aria-hidden="true"><circle cx="50" cy="50" r="47" fill="#c9a227"/><circle cx="50" cy="50" r="40" fill="#14233d"/><circle cx="50" cy="50" r="36" fill="none" stroke="#c9a227" stroke-width="1.5" stroke-dasharray="3 3"/><path d="M50 22 L56 40 L75 40 L60 51 L66 69 L50 58 L34 69 L40 51 L25 40 L44 40 Z" fill="#f4eedf"/><path d="M28 74 Q50 86 72 74" fill="none" stroke="#c9a227" stroke-width="3"/></svg>';
  const pct = v => (Math.round(v * 10) / 10).toFixed(1);
  const fxChips = fx => X.fxText(fx).map(e => '<span class="chip ' + (e.good ? 'good' : 'bad') + '">' + esc(e.label) + ' ' + esc(e.s) + '</span>').join('');
  /* blue when the province leans to you, red when it leans to the rival, paler the closer the race */
  const blend = share => { const t = Math.min(1, .25 + Math.abs(share - 50) / 12), base = [222, 214, 192], to = share >= 50 ? [38, 98, 168] : [176, 48, 38]; return 'rgb(' + base.map((x, i) => Math.round(x + (to[i] - x) * t)).join(',') + ')'; };

  P.games.president = {
    name: 'President of Velmora', icon: '🗳️',
    desc: 'Run a made-up republic for four years, then win the election. Set taxes and spending, pass laws through a 100-seat Assembly, handle strikes, floods and bank runs, listen to (or ignore) four advisors, campaign in six provinces, and face the voters. The local AI can voice your advisors and write extra events. Saves after every move.',
    mount(el, api) {
      if (!document.getElementById('pres-css')) { const s = document.createElement('style'); s.id = 'pres-css'; s.textContent = CSS; document.head.appendChild(s); }
      el.style.alignItems = 'stretch';
      let S = X.load((() => { try { return ls.get(KEY, ''); } catch (e) { return ''; } })()), tab = 'desk', dead = false, setup = { name: 'Alex Marrow', party: 'civic', ai: !!(A.ai && A.ai.stream) }, confirmNew = false, night = null, writing = false;
      const notes = {}, ctl = new Set();
      const save = () => { try { ls.set(KEY, S ? JSON.stringify(S) : ''); } catch (e) { } };
      const aiOn = () => !!(A.ai && A.ai.stream);
      const hud = () => { try { api.hud(S ? (S.phase === 'over' ? 'Game over' : X.when(S) + ' · approval ' + pct(X.overall(S)) + '%') : 'Choose your party'); } catch (e) { } };

      /* ---------- the screens ---------- */
      function render() {
        if (dead) return; hud();
        const keep = el.querySelector('.page'), top = keep ? keep.scrollTop : 0;
        let h;
        if (!S) h = titleView(); else if (night) h = nightView(); else if (S.phase === 'election') h = electionView(); else if (S.phase === 'won') h = wonView(); else if (S.phase === 'over') h = overView(); else h = mainView();
        el.innerHTML = '<div class="pres">' + h + '</div>';
        const pg = el.querySelector('.page'); if (pg) pg.scrollTop = top;
        const nm = el.querySelector('#prname'); if (nm) { nm.onkeydown = e => e.stopPropagation(); nm.oninput = () => { setup.name = nm.value; }; }
        el.querySelectorAll('input[type=range]').forEach(r => { r.oninput = () => { S.budget[r.dataset.k] = +r.value; budgetLive(); }; r.onchange = () => { save(); }; r.onkeydown = e => e.stopPropagation(); });
      }
      function titleView() {
        const saved = S;
        return '<div class="page" style="border-radius:10px"><div class="center">' + seal(92) + '<h1 style="margin:6px 0 0;font-size:30px">President of Velmora</h1><div class="mut">A small republic of 9 million people, six provinces and one very full in-tray.</div></div>' +
          '<div style="max-width:620px;margin:16px auto 0"><div class="card"><h3>Your name</h3><input type="text" id="prname" maxlength="40" value="' + esc(setup.name) + '" aria-label="Your name"></div>' +
          '<div class="card"><h3>Your party</h3>' + Object.keys(X.PARTIES).map(k => { const p = X.PARTIES[k]; return '<button class="party' + (setup.party === k ? ' on' : '') + '" data-party="' + k + '"><b style="color:' + p.color + '">● ' + esc(p.name) + '</b> <span class="small mut">· ' + p.seats + ' seats</span><div class="small">' + esc(p.blurb) + '</div></button>'; }).join('') + '</div>' +
          '<div class="card"><label class="row" style="cursor:pointer"><input type="checkbox" id="prai"' + (setup.ai ? ' checked' : '') + '> <span><b>Let the local AI write some events</b><br><span class="small mut">Your advisors can also speak in their own words. The game works fully without the AI.</span></span></label></div>' +
          '<button class="btn gold big" data-act="start">Take the oath of office</button>' +
          '<div class="card small" style="margin-top:12px"><b>How it works.</b> Each turn is one quarter of a year; a term is 16 quarters. Answer the events on your desk, set the budget, push bills through the Assembly with political capital, and keep five voter groups happy. The midterm comes after 8 quarters. The presidential election comes after 16: win 36 of 70 electoral votes across the six provinces. Fall below 22% approval for two quarters and the Assembly may remove you. Let stability hit zero and the government falls.</div></div></div>';
      }
      function meters() {
        const last = S.hist.length > 1 ? S.hist[S.hist.length - 2] : null, ov = X.overall(S), ratio = Math.round(S.debt / S.gdp * 100);
        const arrow = (now, was, goodUp) => { if (was == null) return ''; const d = Math.round((now - was) * 10) / 10; if (!d) return ''; return '<i class="' + ((d > 0) === goodUp ? 'up' : 'dn') + '">' + (d > 0 ? '▲' : '▼') + Math.abs(d) + '</i>'; };
        const M = [['Approval', pct(ov) + '%', arrow(ov, last && last.ap, true)], ['Growth', pct(S.growth) + '%', arrow(S.growth, last && last.g, true)], ['Jobless', pct(S.unemp) + '%', arrow(S.unemp, last && last.u, false)], ['Inflation', pct(S.infl) + '%', arrow(S.infl, last && last.i, false)], ['Debt / GDP', ratio + '%', arrow(ratio, last && last.d, false)], ['Stability', Math.round(S.stab), ''], ['Standing', Math.round(S.sd), ''], ['Capital', Math.round(S.pc) + ' PC', ''], ['Seats', S.seats + ' / 100', '']];
        return '<div class="meters">' + M.map(m => '<div class="pmt" title="' + m[0] + '"><span>' + m[0] + '</span><b>' + m[1] + m[2] + '</b></div>').join('') + '</div>';
      }
      function header() {
        const p = X.PARTIES[S.party], qi = X.qInTerm(S), left = X.TERM - qi;
        return '<div class="ph">' + seal(46) + '<div style="flex:1;min-width:200px"><h2>President ' + esc(S.name) + '</h2><div class="sub"><span style="color:' + p.color + ';filter:brightness(1.6)">●</span> ' + esc(p.name) + ' · ' + X.when(S) + ' · term ' + S.term + ', quarter ' + qi + ' of ' + X.TERM + '</div></div><div class="sub" style="text-align:right">' + (X.campaign(S) ? '<b style="color:#f2cf5b">📣 Campaign season</b><br>' : '') + (left ? 'Election in ' + left + ' quarter' + (left > 1 ? 's' : '') : 'Election this quarter') + '<br>Rival: ' + esc(S.rival) + '</div></div>';
      }
      const TABS = [['desk', '🗂 Desk'], ['budget', '💰 Budget'], ['assembly', '⚖️ Assembly'], ['cabinet', '👥 Cabinet'], ['polls', '📊 Polls & map'], ['log', '📜 Record'], ['game', '⚙️ Game']];
      function mainView() {
        const body = { desk: deskView, budget: budgetView, assembly: assemblyView, cabinet: cabinetView, polls: pollsView, log: logView, game: gameView }[tab] || deskView;
        return header() + meters() + '<div class="tabs" role="tablist">' + TABS.map(t => '<button class="tab' + (tab === t[0] ? ' on' : '') + '" role="tab" aria-selected="' + (tab === t[0]) + '" data-tab="' + t[0] + '">' + t[1] + (t[0] === 'desk' && X.pendingEvents(S) ? ' (' + X.pendingEvents(S) + ')' : '') + '</button>').join('') + '</div><div class="page">' + body() + '</div>';
      }

      /* the desk: events, quick actions, end of quarter */
      function eventCard(e, i) {
        const adv = X.advice(S, e), done = e.done != null;
        const choices = e.choices.map((c, ci) => { const who = adv.filter(a => a.pick === ci).map(a => { const d = X.ADVISORS.find(x => x.id === a.id), s = S.adv.find(x => x.id === a.id); return '<span title="' + esc(s.name + ', ' + d.role) + '">' + d.icon + '</span>'; }).join(' ');
          return '<button class="choice' + (e.done === ci ? ' picked' : '') + '" data-ev="' + i + '" data-c="' + ci + '"' + (done ? ' disabled' : '') + '><span class="ct">' + (e.done === ci ? '✔ ' : '') + esc(c.t) + '</span><span>' + fxChips(c.fx) + '</span>' + (who ? '<span class="recs">advised by ' + who + '</span>' : '') + '</button>'; }).join('');
        const askRow = done ? '' : '<div class="row small" style="margin-top:4px"><span class="mut">Ask:</span>' + S.adv.map(a => { const d = X.ADVISORS.find(x => x.id === a.id); return '<button class="btn ghost" style="padding:3px 8px" data-ask="' + i + '" data-aid="' + a.id + '">' + d.icon + ' ' + esc(a.name.split(' ').slice(-1)[0]) + '</button>'; }).join('') + '</div>';
        const n = notes['ev' + S.q + '_' + i];
        return '<div class="card' + (e.crisis ? ' crisis' : '') + '"><h3>' + esc(e.icon) + ' ' + esc(e.title) + (e.crisis ? '<span class="tag c">Crisis</span>' : '') + (e.ai ? '<span class="tag ai">AI</span>' : '') + '</h3><div>' + esc(e.text) + '</div>' + choices + askRow + (n ? '<div class="note">' + esc(n) + '</div>' : '') + '</div>';
      }
      function deskView() {
        const pend = X.pendingEvents(S), used = S.speeches[S.q] || 0, cost = 4 + used * 2;
        const evs = S.ev.map(eventCard).join('') + (writing ? '<div class="card mut">📨 A new report is coming in from the provinces…</div>' : '');
        const speech = '<div class="card"><h3>🎙️ Address the nation</h3><div class="small mut">Speak to one group: +4 approval with them. Costs ' + cost + ' PC (rises with each speech this quarter).</div><div class="row" style="margin-top:6px">' + X.BLOCS.map(b => '<button class="btn ghost" data-speech="' + b.id + '"' + (S.pc < cost ? ' disabled' : '') + '>' + b.icon + ' ' + b.name + '</button>').join('') + '</div></div>';
        const rally = X.campaign(S) ? '<div class="card"><h3>📣 Campaign rallies</h3><div class="small mut">5 PC each: +2.5 points in that province on election day (up to +8).</div><div class="row" style="margin-top:6px">' + X.PROV.map(p => '<button class="btn ghost" data-rally="' + p.id + '"' + (S.pc < 5 || (S.rally[p.id] || 0) >= 8 ? ' disabled' : '') + '>' + esc(p.name) + (S.rally[p.id] ? ' +' + S.rally[p.id] : '') + '</button>').join('') + '</div></div>' : '';
        const mo = X.money(S), last = S.log.filter(l => l.q >= S.q - 1).slice(-4).reverse();
        const brief = '<div class="card"><h3>📰 Briefing</h3><div class="small">Deficit this quarter: <b>' + mo.deficit + ' bn</b> (revenue ' + mo.rev + ', spending ' + mo.spend + '). Laws in force: ' + S.laws.length + '. Assembly goodwill: ' + Math.round(S.gw) + '.</div>' + last.map(l => '<div class="small mut" style="margin-top:3px">' + esc(l.t) + '</div>').join('') + '</div>';
        return '<div class="cols"><div>' + (S.ev.length ? evs : '<div class="card mut">A quiet quarter. Nothing on your desk.</div>') + '</div><div>' +
          '<button class="btn gold big" data-act="end"' + (pend || writing ? ' disabled' : '') + '>' + (pend ? 'Answer ' + pend + ' more event' + (pend > 1 ? 's' : '') + ' first' : writing ? 'Wait for the last report…' : X.qInTerm(S) === X.TERM ? 'End the quarter and go to the polls ▶' : 'End the quarter ▶') + '</button><div style="height:12px"></div>' + rally + speech + brief + '</div></div>';
      }

      /* the budget: sliders with a live preview */
      const SL = [['ti', 'Income tax', 10, 55, '%'], ['tc', 'Company tax', 5, 45, '%'], ['h', 'Health', 4, 30, ' bn'], ['e', 'Education', 4, 30, ' bn'], ['d', 'Defence', 2, 30, ' bn'], ['i', 'Infrastructure', 2, 30, ' bn'], ['wf', 'Welfare', 4, 30, ' bn']];
      function budgetView() {
        return '<div class="cols"><div class="card"><h3>Taxes and spending</h3><div class="small mut">Taxes are rates. Spending is billions of crowns per quarter. Changes take effect when the quarter ends.</div>' +
          SL.map(s => '<div class="sl"><label for="sl_' + s[0] + '">' + s[1] + '</label><input type="range" id="sl_' + s[0] + '" data-k="' + s[0] + '" min="' + s[2] + '" max="' + s[3] + '" value="' + S.budget[s[0]] + '"><b id="slv_' + s[0] + '">' + S.budget[s[0]] + s[4] + '</b></div>').join('') +
          '<div class="small mut" style="margin-top:8px">Rules of thumb: infrastructure and education lift growth; high taxes slow it. Big deficits push up inflation, and debt above 90% of GDP drags on everything.</div></div><div id="pbproj">' + budgetProj() + '</div></div>';
      }
      function budgetProj() {
        const mo = X.money(S), t = X.targets(S), m = X.lawMods(S);
        return '<div class="card"><h3>This quarter</h3><table class="small"><tr><td>Revenue</td><td style="text-align:right">' + mo.rev + ' bn</td></tr><tr><td>Programmes</td><td style="text-align:right">' + Math.round((mo.spend - mo.interest - m.cost) * 10) / 10 + ' bn</td></tr><tr><td>Laws in force</td><td style="text-align:right">' + Math.round(m.cost * 10) / 10 + ' bn</td></tr><tr><td>Interest on debt</td><td style="text-align:right">' + mo.interest + ' bn</td></tr><tr><td><b>' + (mo.deficit > 0 ? 'Deficit' : 'Surplus') + '</b></td><td style="text-align:right"><b style="color:' + (mo.deficit > 8 ? 'var(--red)' : 'var(--grn)') + '">' + Math.abs(mo.deficit) + ' bn</b></td></tr></table></div>' +
          '<div class="card"><h3>Where each group is heading</h3>' + X.BLOCS.map(b => { const now = S.ap[b.id], to = t[b.id], d = Math.round((to - now) * 10) / 10; return '<div class="small" style="margin:6px 0">' + b.icon + ' ' + b.name + ' <span class="mut">now ' + pct(now) + '%</span> <b class="' + (d >= 0 ? '' : '') + '" style="color:' + (d >= 0 ? 'var(--grn)' : 'var(--red)') + '">' + (d >= 0 ? '▲' : '▼') + ' toward ' + pct(to) + '%</b><div class="bar"><i style="width:' + to + '%"></i></div><div class="mut" style="font-size:11.5px">Wants ' + esc(b.wants) + '.</div></div>'; }).join('') + '</div>';
      }
      function budgetLive() { SL.forEach(s => { const v = el.querySelector('#slv_' + s[0]); if (v) v.textContent = S.budget[s[0]] + s[4]; }); const p = el.querySelector('#pbproj'); if (p) p.innerHTML = budgetProj(); }

      /* the Assembly */
      function assemblyView() {
        const p = X.PARTIES[S.party], open = X.LAWS.filter(l => !S.laws.includes(l.id)), usedQ = S.billQ === S.q;
        const mtext = m => Object.keys(m || {}).map(k => { const v = m[k], L = { gr: ['Growth', 1], un: ['Unemployment', -1], in: ['Inflation', -1], st: ['Stability', 1], sd: ['Standing', 1], rev: ['Revenue bn/q', 1], cost: ['Cost bn/q', -1] }[k]; return '<span class="chip ' + (v * L[1] > 0 ? 'good' : 'bad') + '">' + L[0] + ' ' + (v > 0 ? '+' : '') + v + '</span>'; }).join('');
        const bill = l => { const v = X.votes(S, l.id), can = !usedQ && S.pc >= l.pc; return '<div class="card"><div class="row" style="justify-content:space-between"><h3>' + l.icon + ' ' + esc(l.name) + '</h3><span class="small">Expected votes: <b style="color:' + (v >= 54 ? 'var(--grn)' : v >= 49 ? '#9a6b00' : 'var(--red)') + '">' + v + ' / 100</b></span></div><div class="small">' + esc(l.d) + '</div><div style="margin:4px 0">' + fxChips(l.perm) + mtext(l.m) + (l.fx ? fxChips(l.fx) : '') + '</div><button class="btn" data-bill="' + l.id + '"' + (can ? '' : ' disabled') + '>Send to a vote · ' + l.pc + ' PC</button></div>'; };
        return '<div class="cols"><div>' + (usedQ ? '<div class="card small"><b>One bill a quarter.</b> The Assembly already voted this quarter. More next quarter.</div>' : '') + open.map(bill).join('') + '</div><div>' +
          '<div class="card"><h3>The Assembly</h3><div class="seats">' + Array.from({ length: 100 }, (_, i) => '<i' + (i < S.seats ? ' style="background:' + p.color + '"' : '') + '></i>').join('') + '</div><div class="small">' + esc(p.short) + ': <b>' + S.seats + '</b> seats · others: ' + (100 - S.seats) + '. A bill needs 51.</div><div class="small" style="margin-top:6px">Goodwill ' + Math.round(S.gw) + ' / 100</div><div class="bar"><i style="width:' + S.gw + '%"></i></div>' +
          '<div style="margin-top:10px"><button class="btn ghost" data-act="whip"' + (S.pc < 3 || S.whip >= 12 ? ' disabled' : '') + '>🤝 Twist arms · 3 PC</button> <span class="small mut">+4 votes on the next bill' + (S.whip ? ' (now +' + S.whip + ')' : '') + '</span></div></div>' +
          '<div class="card"><h3>Laws you passed</h3>' + (S.laws.length ? S.laws.map(id => { const l = X.LAWS.find(x => x.id === id); return '<div class="small">' + l.icon + ' ' + esc(l.name) + '</div>'; }).join('') : '<div class="small mut">None yet.</div>') + '</div></div></div>';
      }

      /* the cabinet */
      function cabinetView() {
        return '<div class="small mut" style="margin-bottom:8px">Each advisor recommends one choice on every event. Follow their advice and their trust rises; ignore them and it falls. Below 15 trust they resign in public, which costs you approval and stability.</div><div class="cols" style="grid-template-columns:repeat(auto-fit,minmax(240px,1fr))">' +
          S.adv.map(a => { const d = X.ADVISORS.find(x => x.id === a.id), n = notes['cab_' + a.id]; return '<div class="card"><h3>' + d.icon + ' ' + esc(a.name) + '</h3><div class="small mut">' + d.role + ' · cares about ' + d.cares + '</div><div class="small" style="margin-top:6px">Trust ' + Math.round(a.trust) + '</div><div class="bar"><i style="width:' + a.trust + '%;background:' + (a.trust < 30 ? 'var(--red)' : 'var(--navy2)') + '"></i></div><button class="btn ghost" style="margin-top:8px" data-brief="' + a.id + '">Ask for a briefing</button>' + (n ? '<div class="note">' + esc(n) + '</div>' : '') + '</div>'; }).join('') + '</div>';
      }
      function mapSvg(shares, shown) {
        return '<svg class="map" viewBox="0 0 600 380" style="width:100%;max-width:600px;display:block;margin:0 auto">' + X.PROV.map((p, i) => { const s = shares.find(x => x.id === p.id), vis = shown == null || i < shown; return '<polygon points="' + p.pts + '" fill="' + (vis && s ? blend(s.share) : '#cfc4a6') + '"><title>' + esc(p.name) + '</title></polygon><text x="' + p.lx + '" y="' + p.ly + '" text-anchor="middle">' + esc(p.name) + '</text><text x="' + p.lx + '" y="' + (p.ly + 15) + '" text-anchor="middle">' + (vis && s ? pct(s.share) + '% · ' : '') + p.ev + ' votes</text>'; }).join('') + '</svg>';
      }
      function pollsView() {
        const f = X.forecast(S), ev = f.reduce((a, x) => a + (x.share > 50 ? x.ev : 0), 0), H = S.hist, w = 520, hh = 140;
        const line = (k, lo, hi, col) => '<polyline fill="none" stroke="' + col + '" stroke-width="2.5" points="' + H.map((x, i) => (20 + i * (w - 40) / Math.max(1, H.length - 1)).toFixed(1) + ',' + (hh - 10 - (Math.max(lo, Math.min(hi, x[k])) - lo) / (hi - lo) * (hh - 20)).toFixed(1)).join(' ') + '"/>';
        return '<div class="cols"><div class="card"><h3>If the election were today</h3><div class="small">You would win <b>' + ev + '</b> of ' + X.EV_TOTAL + ' electoral votes (you need ' + X.EV_WIN + '). Blue leans to you, red to ' + esc(S.rival) + '.</div>' + mapSvg(f) + '</div><div>' +
          '<div class="card"><h3>Voter groups</h3>' + X.BLOCS.map(b => '<div class="small" style="margin:5px 0">' + b.icon + ' ' + b.name + ' <span class="mut">(' + b.share + '% of voters)</span> <b style="float:right">' + pct(S.ap[b.id]) + '%</b><div class="bar"><i style="width:' + S.ap[b.id] + '%"></i></div></div>').join('') + '</div>' +
          '<div class="card"><h3>Your record</h3><svg viewBox="0 0 ' + w + ' ' + hh + '" style="width:100%"><line x1="20" x2="' + (w - 20) + '" y1="' + (hh / 2) + '" y2="' + (hh / 2) + '" stroke="#d8cba8" stroke-dasharray="4 4"/>' + (H.length > 1 ? line('ap', 20, 80, '#1d3257') + line('g', -4, 6, '#c9a227') : '') + '</svg><div class="small"><span style="color:#1d3257">━</span> approval (20 to 80%) · <span style="color:#c9a227">━</span> growth (-4 to 6%)</div></div></div></div>';
      }
      const logView = () => '<div class="card log">' + S.log.slice().reverse().map(l => '<div class="small"><span class="mut">Q' + l.q + '</span> ' + esc(l.t) + '</div>').join('') + '</div>';
      function gameView() {
        return '<div style="max-width:620px"><div class="card"><h3>Your save</h3><div class="small">The game saves itself after every move, on this PC. Close it any time and pick up where you left off.</div><div class="row" style="margin-top:8px"><button class="btn" data-act="save">Save now</button><span class="small mut" id="prsaved"></span></div></div>' +
          '<div class="card"><label class="row" style="cursor:pointer"><input type="checkbox" data-act="aiev"' + (S.aiEv ? ' checked' : '') + '> <span><b>Let the local AI write some events</b><br><span class="small mut">' + (aiOn() ? 'About 4 quarters in 10 bring one extra event written by the AI.' : 'The AI is not available right now. Written events are used.') + '</span></span></label></div>' +
          '<div class="card"><h3>Start over</h3><button class="btn ghost" data-act="new">' + (confirmNew ? 'Click again to end this presidency' : 'New game') + '</button></div></div>';
      }

      /* election night */
      function electionView() {
        const f = X.forecast(S), ev = f.reduce((a, x) => a + (x.share > 50 ? x.ev : 0), 0);
        return header() + meters() + '<div class="page" style="border-radius:10px"><div class="center"><h2 style="margin:0">🗳️ Election day</h2><div class="mut">' + esc(X.PARTIES[S.party].name) + ' against ' + esc(S.rival) + '. The last polls give you ' + ev + ' of ' + X.EV_TOTAL + ' electoral votes. Polls can be wrong.</div></div>' + mapSvg(f) + '<div style="max-width:420px;margin:10px auto"><button class="btn gold big" data-act="count">Count the votes</button></div></div>';
      }
      function tally(res, shown) { let you = 0, them = 0; res.res.slice(0, shown).forEach(r => { if (r.won) you += r.ev; else them += r.ev; }); return { you, them }; }
      function nightView() {
        const res = S.result, t = tally(res, night.shown), done = night.shown >= res.res.length;
        return '<div class="page" style="border-radius:10px"><div class="center"><h2 style="margin:0">Election night</h2><div style="font:bold 28px system-ui,sans-serif;margin:6px 0"><span style="color:#2f6fb0">' + t.you + '</span> · <span style="color:#a8352a">' + t.them + '</span></div><div class="mut">You · ' + esc(res.rival) + ' · ' + X.EV_WIN + ' to win</div></div>' + mapSvg(res.res, night.shown) +
          (done ? '<div class="center" style="margin-top:10px"><h2>' + (res.won ? '🏆 You won!' : '🏳️ You lost.') + '</h2><button class="btn gold" data-act="nightdone">Continue</button></div>' : '<div class="center mut" style="margin-top:10px">Counting ' + esc(res.res[night.shown].name) + '…</div>') + '</div>';
      }
      function wonView() {
        const r = S.result;
        return '<div class="page" style="border-radius:10px"><div class="center">' + seal(80) + '<h1 style="margin:6px 0">Re-elected</h1><div>You won ' + r.ev + ' of ' + X.EV_TOTAL + ' electoral votes and ' + pct(r.pop) + '% of the vote against ' + esc(r.rival) + '.</div></div>' + mapSvg(r.res) +
          '<div class="row" style="justify-content:center;margin-top:10px"><button class="btn gold" data-act="term2">Serve a second term</button><button class="btn ghost" data-act="retire">Step down on a high note</button></div><div class="center small mut" style="margin-top:6px">A second term is harder: voters are tired of you from day one.</div></div>';
      }
      function overView() {
        const o = S.over, score = X.legacy(S), title = { lost: 'Defeated', done: 'Two terms served', retired: 'Retired in triumph', impeached: 'Removed from office', collapse: 'The government fell' }[o.why] || 'The end';
        if (!S.scored) { S.scored = 1; save(); try { api.submit(score); } catch (e) { } }
        const good = o.why === 'done' || o.why === 'retired';
        return '<div class="page" style="border-radius:10px"><div class="center">' + seal(80) + '<h1 style="margin:6px 0">' + (good ? '🏆 ' : '') + title + '</h1><div style="max-width:640px;margin:0 auto">' + esc(o.text) + '</div></div>' + (S.result ? mapSvg(S.result.res) : '') +
          '<div class="card" style="max-width:520px;margin:12px auto"><table class="small"><tr><td>Quarters in office</td><td style="text-align:right">' + S.q + '</td></tr><tr><td>Elections won</td><td style="text-align:right">' + S.wins + '</td></tr><tr><td>Laws passed</td><td style="text-align:right">' + S.laws.length + '</td></tr><tr><td>Final approval</td><td style="text-align:right">' + pct(X.overall(S)) + '%</td></tr><tr><td>Debt / GDP</td><td style="text-align:right">' + Math.round(S.debt / S.gdp * 100) + '%</td></tr><tr><td><b>Legacy score</b></td><td style="text-align:right"><b>' + score + '</b></td></tr></table></div>' +
          '<div class="center"><button class="btn gold" data-act="restart">Start a new presidency</button></div></div>';
      }

      /* ---------- the local AI (optional) ---------- */
      const stateLine = () => 'Approval ' + pct(X.overall(S)) + '%, growth ' + pct(S.growth) + '%, unemployment ' + pct(S.unemp) + '%, inflation ' + pct(S.infl) + '%, debt ' + Math.round(S.debt / S.gdp * 100) + '% of GDP, stability ' + Math.round(S.stab) + '/100, standing abroad ' + Math.round(S.sd) + '/100, ' + S.seats + ' of 100 Assembly seats. ' + X.when(S) + ', ' + (X.TERM - X.qInTerm(S)) + ' quarters to the election.';
      async function speak(key, aid, task, fallback) {
        const a = S.adv.find(x => x.id === aid), d = X.ADVISORS.find(x => x.id === aid);
        if (!aiOn()) { notes[key] = fallback; render(); return; }
        notes[key] = a.name + ' is thinking…'; render();
        const c = new AbortController(); ctl.add(c); const to = setTimeout(() => c.abort(), 90000); let part = '';
        try {
          const sys = 'You are ' + a.name + ', ' + d.role + ' to the President of the Republic of Velmora, a made-up country. You care most about ' + d.cares + '. Speak to the President in the first person, in 2 or 3 short plain sentences. No lists, no markdown.';
          let last = 0; const txt = await A.ai.stream([{ role: 'system', content: sys }, { role: 'user', content: task + '\n\nThe state of the country: ' + stateLine() }], t => { part = t; notes[key] = a.name + ': ' + t; const now = Date.now(); if (now - last > 250) { last = now; render(); } }, c.signal, { temp: .8 });
          notes[key] = txt && txt.trim() ? a.name + ': ' + txt.trim() : fallback;
        } catch (e) { notes[key] = part.trim() ? a.name + ': ' + part.trim() + '…' : fallback; }
        clearTimeout(to); ctl.delete(c); render();
      }
      function askEvent(i, aid) {
        const e = S.ev[i]; if (!e) return; const pick = X.advice(S, e).find(x => x.id === aid).pick;
        const task = 'This is on the President\'s desk: "' + e.title + '. ' + e.text + '" The options are: ' + e.choices.map((c, ci) => (ci + 1) + ') ' + c.t).join('; ') + '. Recommend option "' + e.choices[pick].t + '" and say why, from your point of view.';
        speak('ev' + S.q + '_' + i, aid, task, X.advisorText(S, aid, e));
      }
      function briefing(aid) {
        const d = X.ADVISORS.find(x => x.id === aid), mo = X.money(S);
        const fb = { tr: 'The deficit is ' + mo.deficit + ' bn a quarter and debt is ' + Math.round(S.debt / S.gdp * 100) + '% of GDP. Growth is ' + pct(S.growth) + '%. ' + (mo.deficit > 8 ? 'We must raise taxes or cut spending soon.' : 'The books are under control for now.'), in: 'Stability stands at ' + Math.round(S.stab) + '. Unemployment is ' + pct(S.unemp) + '% and inflation ' + pct(S.infl) + '%. ' + (S.stab < 45 ? 'The streets are restless. Spend on welfare and defence, or fix jobs.' : 'The country is calm.'), fo: 'Our standing abroad is ' + Math.round(S.sd) + ' of 100. ' + (S.sd < 45 ? 'Our neighbours see us as weak or rude. A summit or a trade pact would help.' : 'Our allies respect us.'), cs: 'Your approval is ' + pct(X.overall(S)) + '%. Your weakest group is ' + X.BLOCS.slice().sort((a, b) => S.ap[a.id] - S.ap[b.id])[0].name.toLowerCase() + '. ' + (X.campaign(S) ? 'It is campaign season: hold rallies where the map is close.' : 'Bank political capital for the bills that matter.') }[aid];
        speak('cab_' + aid, aid, 'Give the President a short briefing on ' + d.cares + ', with one piece of advice.', S.adv.find(x => x.id === aid).name + ': ' + fb);
      }
      async function aiEvent() {
        const q = S.q; writing = true; render();
        const c = new AbortController(); ctl.add(c); const to = setTimeout(() => c.abort(), 60000);
        try {
          const prompt = 'Write one new event for a president simulator set in the Republic of Velmora, a made-up country (provinces: Northmarch, Port Calder, Seaholm, Ashby Plains, Valmont, Brightwater; neighbour: Ostmark). Use only made-up people and places. The state of the country: ' + stateLine() + '\nReply with JSON only: {"icon":"one emoji","title":"under 8 words","text":"two sentences","choices":[{"t":"short option","fx":{}}]} with 3 choices. In fx use only these keys with small numbers: w (workers), b (business), f (farmers), y (young voters), r (retirees), all (everyone) from -8 to 8; cash (billions, -12 to 12); st (stability) and sd (standing abroad) from -6 to 6; gs (growth shock) from -0.8 to 0.8. Every choice must have a cost and a benefit.';
          const txt = await A.ai.stream([{ role: 'user', content: prompt }], null, c.signal, { temp: .9 });
          const ev = X.cleanEvent(A.ai.json(txt));
          if (ev && S && S.q === q && S.phase === 'play' && !dead) { S.ev.push(ev); save(); }
        } catch (e) { }
        clearTimeout(to); ctl.delete(c); writing = false; render();
      }

      /* ---------- clicks ---------- */
      function endQuarter() {
        const out = X.endQuarter(S); if (!out) return; save();
        if (out.midterm) { try { A.toast('🗳️ Midterms: your party now holds ' + out.midterm.seats + ' seats (was ' + out.midterm.old + ').', 5000); } catch (e) { } }
        if (out.impeach === 'survived') { try { A.toast('⚠️ You survived an impeachment vote. Raise your approval fast.', 5000); } catch (e) { } }
        tab = 'desk'; render();
        if (S.phase === 'play' && S.aiEv && aiOn() && X.qInTerm(S) !== X.TERM - 1 && Math.random() < .4) aiEvent();
      }
      el.onclick = e => {
        const t = e.target.closest('button,[data-act],input[type=checkbox]'); if (!t || dead) return;
        const d = t.dataset;
        if (d.party) { setup.party = d.party; render(); return; }
        if (d.tab) { tab = d.tab; confirmNew = false; render(); return; }
        if (d.ev != null && d.c != null) { const r = X.choose(S, +d.ev, +d.c); if (r) { save(); if (r.gone.length) { try { A.toast('📰 An advisor resigned. See the Cabinet.', 4500); } catch (x) { } } render(); } return; }
        if (d.ask != null) { askEvent(+d.ask, d.aid); return; }
        if (d.brief) { briefing(d.brief); return; }
        if (d.speech) { if (X.speech(S, d.speech)) { save(); render(); } return; }
        if (d.rally) { if (X.rally(S, d.rally)) { save(); render(); } return; }
        if (d.bill) { const r = X.propose(S, d.bill); if (r.ok) { save(); try { A.toast(r.passed ? '⚖️ Passed, ' + r.yes + ' to ' + (100 - r.yes) + '.' : '❌ Failed, ' + r.yes + ' to ' + (100 - r.yes) + '.', 4000); } catch (x) { } render(); } else { try { A.toast(r.why, 3000); } catch (x) { } } return; }
        switch (d.act) {
          case 'start': { const nm = el.querySelector('#prname'), ai = el.querySelector('#prai'); S = X.newGame({ name: (nm && nm.value.trim()) || 'Alex Marrow', party: setup.party, aiEv: !!(ai && ai.checked) }); tab = 'desk'; save(); render(); break; }
          case 'end': endQuarter(); break;
          case 'whip': if (X.whip(S)) { save(); render(); } break;
          case 'save': { save(); const s = el.querySelector('#prsaved'); if (s) s.textContent = 'Saved ' + new Date().toLocaleTimeString(); break; }
          case 'aiev': S.aiEv = !!t.checked; save(); break;
          case 'new': if (!confirmNew) { confirmNew = true; render(); } else { confirmNew = false; S = null; save(); render(); } break;
          case 'count': { X.runElection(S); save(); night = { shown: 0 }; render(); const step = () => { if (dead || !night) return; night.shown++; render(); if (night.shown < S.result.res.length) setTimeout(step, 750); }; setTimeout(step, 900); break; }
          case 'nightdone': night = null; render(); break;
          case 'term2': if (X.secondTerm(S)) { tab = 'desk'; save(); render(); } break;
          case 'retire': if (X.retire(S)) { save(); render(); } break;
          case 'restart': S = null; save(); render(); break;
        }
      };
      try { A.music && A.music.stop(); } catch (e) { }
      render();
      return () => { dead = true; ctl.forEach(c => { try { c.abort(); } catch (e) { } }); save(); };
    }
  };
})();

// President simulator (web/js/president-engine.js): a game runs from the oath to an election result, numbers stay
// finite, laws pass and fail by the vote count, AI-written events are cleaned, and a save survives a round trip.
const path = require('path');

module.exports = async ok => {
  const P = require(path.join(__dirname, '..', 'web', 'js', 'president-engine.js'));
  const finite = S => ['gdp', 'growth', 'unemp', 'infl', 'debt', 'stab', 'sd', 'gw', 'pc', 'seats'].every(k => isFinite(S[k])) && P.BLOCS.every(b => isFinite(S.ap[b.id]));
  const play = (seed, pick) => {
    const S = P.newGame({ seed, party: ['civic', 'market', 'dawn'][seed % 3] }); let steps = 0, bad = 0, elections = 0;
    while (S.phase !== 'over' && steps++ < 80) {
      if (S.phase === 'won') { P.secondTerm(S); continue; }
      if (S.phase === 'election') { P.runElection(S); elections++; continue; }
      S.ev.forEach((e, i) => { if (e.done == null) P.choose(S, i, pick(e, S)); });
      const free = P.LAWS.find(l => !S.laws.includes(l.id) && l.pc <= S.pc); if (free && S.q % 3 === 0) P.propose(S, free.id);
      if (!P.endQuarter(S)) bad++; if (!finite(S)) bad += 100;
    }
    return { S, steps, bad, elections };
  };
  let ended = 0, wins = 0, losses = 0, broken = 0, quarters = 0;
  for (let seed = 1; seed <= 40; seed++) { const g = play(seed, (e, S) => (seed + S.q) % e.choices.length); if (g.S.phase === 'over') ended++; if (g.S.wins) wins++; if (g.S.over && g.S.over.why === 'lost') losses++; broken += g.bad; quarters += g.S.q; }
  ok('president: 40 random games all reach an ending', ended === 40, ended + ' of 40');
  ok('president: no step refused and every number stays finite', broken === 0, broken + ' problems');
  ok('president: random play wins some elections and loses some', wins > 0 && losses > 0, wins + ' with a win, ' + losses + ' lost');
  /* a careful player (the Chief of Staff's advice every time) should do better than chance */
  let smart = 0; for (let seed = 101; seed <= 130; seed++) { const g = play(seed, (e, S) => P.advice(S, e).find(a => a.id === 'cs').pick); if (g.S.wins) smart++; }
  ok('president: following the Chief of Staff wins most first elections', smart >= 15, smart + ' of 30');
  const S = P.newGame({ seed: 7, party: 'civic' });
  ok('president: a new game starts in Year 1 with events waiting', P.when(S) === 'Year 1, Winter' && S.ev.length >= 1 && P.pendingEvents(S) === S.ev.length);
  ok('president: the quarter cannot end with events unanswered', P.endQuarter(S) === null);
  S.pc = 0; ok('president: a bill needs political capital', P.propose(S, 'rail').ok === false);
  S.pc = 30; const r = P.propose(S, 'rail'); ok('president: a bill goes to a vote and the result matches the count', r.ok && r.passed === (r.yes >= 51), JSON.stringify(r));
  ok('president: only one bill a quarter', P.propose(S, 'digital').ok === false);
  const L = P.load(JSON.stringify(S)); ok('president: a save loads back with the same state', L && L.q === S.q && L.laws.join() === S.laws.join() && Math.abs(L.ap.w - S.ap.w) < 1e-9);
  ok('president: a broken save is refused', P.load('{"v":1}') === null && P.load('not json') === null);
  const ai = P.cleanEvent({ title: 'Dam <b>breaks</b>', text: 'Water everywhere.', choices: [{ t: 'Rebuild', fx: { cash: -500, w: 99, hack: 5 } }, { t: 'Wait', fx: { st: -2 } }] });
  ok('president: an AI event is cleaned and its effects capped', ai && !/[<>]/.test(ai.title) && ai.choices[0].fx.cash === -12 && ai.choices[0].fx.w === 8 && !('hack' in ai.choices[0].fx));
  ok('president: an AI event with one choice is refused', P.cleanEvent({ title: 'x', text: 'y', choices: [{ t: 'only' }] }) === null);
  const E = P.newGame({ seed: 3 }); E.phase = 'election'; const res = P.runElection(E);
  ok('president: the election counts all ' + P.EV_TOTAL + ' electoral votes', res && res.res.reduce((a, x) => a + x.ev, 0) === P.EV_TOTAL && res.won === (res.ev >= P.EV_WIN));
};

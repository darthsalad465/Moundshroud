// Debate (Chat › 🗣 Debate): two models on this PC argue a topic over three rounds (opening, rebuttal, closing), a third
// model judges, and you can agree or overrule it. Pick a suggested topic, type your own, or roll a random one.
// Results are kept on this PC (/api/kv?name=debates) and count in the AI Olympics medal table (web/js/olympics.js).
// A debate keeps going if you switch to another page; the page shows it as you left it when you come back.
(() => {
  const esc = s => String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const bare = m => String(m || '').replace(/:latest$/, '');
  const mdx = t => typeof md === 'function' ? md(String(t || '')) : esc(t);
  const TOPICS = ['Homework should be banned', 'Cats make better pets than dogs', 'Social media does more harm than good', 'Space exploration is worth the money', 'Remote work is better than office work', 'Artificial intelligence will create more jobs than it destroys', 'Everyone should learn to code', 'Video games are a form of art', 'Cities should ban cars from their centres', 'A four-day work week should be the norm', 'Books are better than films', 'Zoos should be closed', 'Pineapple belongs on pizza', 'Nuclear power is the best answer to climate change', 'Money can buy happiness', 'Uniforms should be required in schools', 'Time travel to the past would be a bad idea', 'Humans should colonise Mars', 'Breakfast is the most important meal of the day', 'It is better to be a generalist than a specialist', 'Chess is a sport', 'Tipping should be abolished', 'The internet should be a public utility', 'Ancient Rome was greater than ancient Greece'];
  const ROUNDS = [['opening', 'Opening statement', 'Give your opening statement: your 2 or 3 strongest arguments, in about 120 words.'], ['rebuttal', 'Rebuttal', 'Answer your opponent: take apart their strongest point and strengthen your own case, in about 120 words.'], ['closing', 'Closing', 'Give your closing statement: why you have won this debate, in about 80 words.']];
  let root = null, MODELS = null, D = null;
  const pick = a => a[Math.floor(Math.random() * a.length)];

  async function run(topic, ma, mb, judge) {
    const ctl = new AbortController();
    D = { running: true, ctl, topic, a: ma, b: mb, judge, turns: [], verdict: null, mine: '', at: Date.now(), live: '' };
    paint();
    const side = (who, stance) => 'You are a sharp, fair debater in a formal debate. The motion: "' + topic + '". You argue ' + stance + ' the motion. Be persuasive and concrete, use examples, no insults, do not mention being an AI. Write in plain prose.';
    try {
      for (const [id, label, ask] of ROUNDS) {
        for (const [who, model, stance] of [['A', ma, 'FOR'], ['B', mb, 'AGAINST']]) {
          if (ctl.signal.aborted) throw new Error('stopped');
          const hist = D.turns.map(t => ({ role: t.who === who ? 'assistant' : 'user', content: (t.who === who ? '' : 'Your opponent (' + t.label + '): ') + t.text }));
          const turn = { who, model, label, text: '' }; D.turns.push(turn); paint();
          const r = await A.olympics.ask(model, [{ role: 'system', content: side(who, stance) }].concat(hist, [{ role: 'user', content: ask }]), { signal: ctl.signal, max: 320, temp: .7, onText: t => { turn.text = t; paintLive(); } });
          turn.text = r.text; paint();
        }
      }
      D.judging = true; paint();
      const transcript = D.turns.map(t => (t.who === 'A' ? 'FOR' : 'AGAINST') + ' — ' + t.label + ':\n' + t.text).join('\n\n');
      const jr = await A.olympics.ask(judge, [{ role: 'system', content: 'You are an impartial debate judge. Judge only the quality of the arguments, not your own opinion on the motion. Reply with JSON only: {"winner":"FOR" or "AGAINST","for":0-10,"against":0-10,"why":"two sentences"}' }, { role: 'user', content: 'Motion: ' + topic + '\n\n' + transcript.slice(0, 9000) }], { signal: ctl.signal, max: 250 });
      const j = A.ai.json(jr.text) || {}, w = /against/i.test(String(j.winner)) ? 'B' : /for/i.test(String(j.winner)) ? 'A' : (+j.against > +j.for ? 'B' : 'A');
      D.verdict = { winner: w, sa: +j.for || 0, sb: +j.against || 0, why: String(j.why || '').slice(0, 600) };
      await saveResult();
    } catch (e) { if (!ctl.signal.aborted) D.error = String(e.message || e); }
    D.running = false; D.judging = false; paint();
  }
  async function saveResult(over) {
    if (!D || !D.verdict) return;
    let all = []; try { all = await A.api('/api/kv?name=debates'); } catch (e) { } if (!Array.isArray(all)) all = [];
    const w = over || D.verdict.winner, rec = { at: D.at, topic: D.topic, a: D.a, b: D.b, judge: D.judge, judgeWinner: D.verdict.winner === 'A' ? D.a : D.b, winner: w === 'A' ? D.a : D.b, overruled: !!over && over !== D.verdict.winner, scores: [D.verdict.sa, D.verdict.sb] };
    all = [rec].concat(all.filter(x => x.at !== D.at)).slice(0, 200); try { await A.api('/api/kv?name=debates', all); } catch (e) { }
  }

  function paint() { if (root && root.isConnected) draw(); }
  function paintLive() { const el = root && root.querySelector('.dbturn:last-child .dbtext'); if (el && D) { const t = D.turns[D.turns.length - 1]; el.innerHTML = mdx(t.text); const sc = root.querySelector('#dbbody'); if (sc && sc.scrollHeight - sc.scrollTop - sc.clientHeight < 160) sc.scrollTop = sc.scrollHeight; } else paint(); }
  async function render(host) {
    root = host; host.innerHTML = '<div class="olx"><div class="olhead"><b>🗣 Debate</b><span class="small mute">Two AIs argue, a third judges, you have the last word. Wins count in the AI Olympics.</span></div><div id="dbbody" class="scroll pad" style="flex:1;min-height:0"></div></div>';
    host.addEventListener('click', onClick);
    host.querySelector('#dbbody').innerHTML = '<div class="mute">Finding the models on this PC…</div>';
    MODELS = (await A.olympics.models()).filter(m => m.chat); draw();
    host._onShow = () => draw();
  }
  async function draw() {
    const b = root && root.querySelector('#dbbody'); if (!b) return;
    if (!D) {
      const ms = MODELS || [], opt = sel => ms.map(m => '<option value="' + esc(m.name) + '"' + (m.name === sel ? ' selected' : '') + '>' + esc(m.label) + '</option>').join('');
      const big = ms.filter(m => !m.cloud).sort((x, y) => y.size - x.size);
      let past = []; try { past = await A.api('/api/kv?name=debates'); } catch (e) { } if (!Array.isArray(past)) past = [];
      b.innerHTML = '<div class="card"><b>The motion</b><div class="olsug" style="margin-top:6px">' + TOPICS.slice(0, 12).map(t => '<button class="chip" data-t="' + esc(t) + '">' + esc(t) + '</button>').join('') + '</div>' +
        '<div class="row" style="gap:6px;margin-top:8px"><input id="dbt" placeholder="Type your own motion, e.g. Robots should pay taxes" style="flex:1"><button class="ib" data-a="rt" title="A random motion">🎲 Random topic</button></div></div>' +
        '<div class="card"><div class="row" style="gap:10px;flex-wrap:wrap;align-items:flex-end"><label class="small">For the motion<br><select id="dba">' + opt((big[0] || {}).name) + '</select></label><span style="font-size:20px">⚔️</span><label class="small">Against<br><select id="dbb">' + opt((big[1] || big[0] || {}).name) + '</select></label><button class="ib" data-a="rm" title="Two random models">🎲 Random pair</button><label class="small">Judge<br><select id="dbj">' + opt((big[2] || big[0] || {}).name) + '</select></label></div>' +
        '<div class="row" style="gap:8px;margin-top:12px"><button class="pri" data-a="go">🗣 Start the debate</button><span class="small mute">Three rounds each, then the verdict. A few minutes.</span></div></div>' +
        (past.length ? '<h3>Past debates</h3>' + past.slice(0, 12).map(p => '<div class="card small"><b>' + esc(p.topic) + '</b><div>' + esc(bare(p.a)) + ' (for) vs ' + esc(bare(p.b)) + ' (against) · winner <b>' + esc(bare(p.winner)) + '</b>' + (p.overruled ? ' (you overruled the judge)' : '') + ' · ' + new Date(p.at).toLocaleDateString() + '</div></div>').join('') : '');
      return;
    }
    const S = D, name = w => bare(w === 'A' ? S.a : S.b);
    let h = '<div class="card"><div class="row" style="gap:8px;align-items:center;flex-wrap:wrap"><b style="flex:1">“' + esc(S.topic) + '”</b>' + (S.running ? '<button class="ib dang" data-a="stop">■ Stop</button>' : '<button class="ib" data-a="new">New debate</button>') + '</div><div class="small mute">🟦 ' + esc(bare(S.a)) + ' argues for · 🟥 ' + esc(bare(S.b)) + ' argues against · judge ' + esc(bare(S.judge)) + '</div></div>';
    h += S.turns.map(t => '<div class="dbturn ' + (t.who === 'A' ? 'for' : 'against') + '"><div class="small mute">' + (t.who === 'A' ? '🟦 For' : '🟥 Against') + ' · ' + esc(t.label) + ' · ' + esc(bare(t.model)) + '</div><div class="dbtext">' + (t.text ? mdx(t.text) : '…') + '</div></div>').join('');
    if (S.judging) h += '<div class="card">⚖️ The judge is deciding…</div>';
    if (S.error) h += '<div class="card bad">' + esc(S.error) + '</div>';
    if (S.verdict) {
      const v = S.verdict;
      h += '<div class="card dbverdict"><b>⚖️ The judge says: ' + (v.winner === 'A' ? '🟦 ' : '🟥 ') + esc(name(v.winner)) + ' wins</b> <span class="small mute">(' + v.sa + ' to ' + v.sb + ')</span><div style="margin:6px 0">' + esc(v.why) + '</div>' +
        (S.mine ? '<div>Your verdict: <b>' + esc(name(S.mine)) + '</b> wins. Saved.</div>' : '<div class="row" style="gap:6px;flex-wrap:wrap"><button class="pri" data-mine="' + v.winner + '">👍 I agree</button><button class="ib" data-mine="' + (v.winner === 'A' ? 'B' : 'A') + '">No, ' + esc(name(v.winner === 'A' ? 'B' : 'A')) + ' won</button></div>') + '</div>';
    }
    b.innerHTML = h;
  }
  async function onClick(e) {
    const t = e.target.closest('button'); if (!t || !root.contains(t)) return; const d = t.dataset;
    if (d.t) root.querySelector('#dbt').value = d.t;
    else if (d.a === 'rt') root.querySelector('#dbt').value = pick(TOPICS.filter(x => x !== root.querySelector('#dbt').value));
    else if (d.a === 'rm') { const ms = (MODELS || []).filter(m => !m.cloud); if (ms.length < 2) return A.toast('Two models are needed.'); const a = pick(ms); let b = pick(ms); while (b === a) b = pick(ms); root.querySelector('#dba').value = a.name; root.querySelector('#dbb').value = b.name; }
    else if (d.a === 'go') { const topic = root.querySelector('#dbt').value.trim(), a = root.querySelector('#dba').value, b = root.querySelector('#dbb').value, j = root.querySelector('#dbj').value; if (!topic) return A.toast('Pick, type or roll a motion first.'); if (a === b) return A.toast('Pick two different models (or press Random pair).'); run(topic, a, b, j); }
    else if (d.a === 'stop') { if (D) D.ctl.abort(); }
    else if (d.a === 'new') { D = null; draw(); }
    else if (d.mine) { D.mine = d.mine; await saveResult(d.mine); draw(); }
  }
  A.debate = { render, TOPICS };
})();

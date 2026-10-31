// Quiz and study-guide generator for the Study tab. The local model writes the questions; you answer with instant feedback and explanations.
(() => {
  const root = $('p-study');
  let quizzes = [], guides = [], cancel = false;
  const kv = { get: n => A.api('/api/kv?name=' + n), set: (n, v) => A.api('/api/kv?name=' + n, v) };
  const shuf = a => { a = a.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.random() * (i + 1) | 0; [a[i], a[j]] = [a[j], a[i]]; } return a; };
  const norm = s => String(s).toLowerCase().replace(/[^\p{L}\p{N}\s]/gu, ' ').replace(/\s+/g, ' ').trim();
  const mkId = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 5);
  const lev = (a, b) => { const m = a.length, n = b.length, d = Array.from({ length: m + 1 }, (_, i) => [i]); for (let j = 1; j <= n; j++) d[0][j] = j; for (let i = 1; i <= m; i++) for (let j = 1; j <= n; j++) d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1)); return d[m][n]; };
  const same = (g, a) => { g = norm(g); a = norm(a); if (!g) return false; if (g === a) return true; if (a.length > 4 && lev(g, a) <= Math.max(1, Math.floor(a.length / 7))) return true; return a.length > 6 && g.length > 3 && (a.includes(g) || g.includes(a)); };
  const load = async () => { try { quizzes = await kv.get('quizzes'); guides = await kv.get('guides'); } catch (e) { quizzes = []; guides = []; } if (!Array.isArray(quizzes)) quizzes = []; if (!Array.isArray(guides)) guides = []; };

  /* ---------- talking to the model ---------- */
  const SCHEMA = { type: 'object', properties: { questions: { type: 'array', items: { type: 'object', properties: { question: { type: 'string' }, options: { type: 'array', items: { type: 'string' } }, answer: { type: 'string' }, explanation: { type: 'string' } }, required: ['question', 'answer', 'explanation'] } } }, required: ['questions'] };
  async function llm(prompt, schema) {
    const r = await fetch('/api/chat', { method: 'POST', body: JSON.stringify({ model: $('model').value, stream: false, think: false, keep_alive: '3m', format: schema || undefined, options: { temperature: 0.5 }, messages: [{ role: 'user', content: prompt }] }) });
    if (!r.ok) throw new Error('The AI engine did not answer'); const j = await r.json(); if (j.error) throw new Error(j.error); return (j.message && j.message.content) || '';
  }
  const TYPE = {
    mc: 'multiple-choice questions. Each has "options" with exactly 4 short plain-text choices (no letters or numbers in front) and "answer" equal to exactly one of them. Make the wrong choices plausible.',
    tf: 'true/false statements. "question" is the statement, "answer" is exactly True or False. Make about half of them false. Do not include "options".',
    fill: 'fill-in-the-blank sentences. "question" is a sentence containing ______ in place of one key word or short phrase, and "answer" is that missing word or phrase. Do not include "options".',
    short: 'short-answer questions that can be answered in one or two sentences. "answer" is a clear model answer. Do not include "options".'
  };
  const LEVEL = { easy: 'easy, testing basic recall of the main ideas', medium: 'medium difficulty, testing understanding', hard: 'hard, testing application, comparison and deeper reasoning' };
  function chunksOf(t) { t = (t || '').trim(); if (!t) return ['']; const out = []; let cur = ''; for (const p of t.split(/\n{2,}/)) { if ((cur + '\n\n' + p).length > 5000 && cur) { out.push(cur); cur = p; } else cur = cur ? cur + '\n\n' + p : p; } if (cur) out.push(cur); return out.flatMap(c => { const r = []; while (c.length > 5500) { r.push(c.slice(0, 5000)); c = c.slice(5000); } r.push(c); return r; }).slice(0, 12); }
  function clean(type, it) {
    if (!it || !it.question || !it.answer) return null; const q = { id: mkId(), type, q: String(it.question).trim(), answer: String(it.answer).trim(), explanation: String(it.explanation || '').trim() };
    if (type === 'mc') { let o = (it.options || []).map(x => String(x).replace(/^[A-Da-d][.)]\s+/, '').trim()).filter(Boolean); o = [...new Set(o)]; if (!o.some(x => norm(x) === norm(q.answer))) { if (o.length >= 4) o[o.length - 1] = q.answer; else o.push(q.answer); } if (o.length < 3) return null; q.options = shuf(o.slice(0, 4)); const hit = q.options.find(x => norm(x) === norm(q.answer)); if (!hit) return null; q.answer = hit; }
    else if (type === 'tf') { const a = norm(q.answer); if (a.startsWith('true')) q.answer = 'True'; else if (a.startsWith('false')) q.answer = 'False'; else return null; }
    else if (type === 'fill') { if (!/_{2,}/.test(q.q)) return null; }
    return q;
  }
  async function makeQuestions(src, o, onProgress) {
    const types = o.types.length ? o.types : ['mc'], per = types.map((t, i) => Math.floor(o.count / types.length) + (i < o.count % types.length ? 1 : 0));
    const chunks = chunksOf(src.text), out = []; let ci = 0;
    for (let t = 0; t < types.length; t++) {
      let need = per[t], fails = 0;
      while (need > 0 && fails < 3) {
        if (cancel) return out; const n = Math.min(5, need), chunk = chunks[ci++ % chunks.length];
        const prior = out.slice(-14).map(x => '- ' + x.q.slice(0, 90)).join('\n');
        const prompt = 'You write exam questions for a student.\n' + (chunk ? 'SOURCE MATERIAL:\n---\n' + chunk + '\n---\nBase every question ONLY on the source material.' : 'TOPIC: ' + src.topic + '\nUse accurate, well-established facts about exactly this topic.' + (src.ref ? '\n\nBACKGROUND NOTES (use only the parts relevant to the topic; ignore anything unrelated):\n' + src.ref.slice(0, 3500) : '')) +
          '\n\nWrite exactly ' + n + ' ' + LEVEL[o.level] + ' ' + TYPE[types[t]] + ' Each question needs a one-sentence "explanation" of why the answer is right.' + (prior ? '\n\nDo NOT repeat or rephrase these existing questions:\n' + prior : '') + '\n\nReply with JSON: {"questions":[...]}';
        let items = []; try { const raw = await llm(prompt, SCHEMA); items = (JSON.parse(raw).questions || []); } catch (e) { if (/AI engine/.test(e.message)) throw e; }
        let got = 0; for (const it of items) { const q = clean(types[t], it); if (q && !out.some(x => norm(x.q) === norm(q.q))) { out.push(q); got++; need--; if (need <= 0) break; } }
        if (!got) fails++; onProgress(out.length);
      }
    }
    return shuf(out).slice(0, o.count);
  }

  /* ---------- home slot in the Study tab ---------- */
  async function mount(slot) {
    if (!slot) return; await load(); if (!document.body.contains(slot)) return;
    slot.innerHTML = '<div class="mode"><div class="card" data-k="quiz"><b>✨ New quiz</b><div class="small mute">Multiple choice, true/false, fill in the blank, short answer</div></div><div class="card" data-k="guide"><b>📘 Study guide</b><div class="small mute">Summary, cheat sheet or full guide from anything</div></div></div>' +
      (quizzes.length ? '<h3>Your quizzes</h3>' + quizzes.map(q => '<div class="card row" data-q="' + q.id + '" style="cursor:pointer"><div style="flex:1"><b>' + esc(q.title) + '</b><div class="small mute">' + q.questions.length + ' questions &middot; ' + esc(q.level) + (q.history && q.history.length ? ' &middot; last ' + q.history[q.history.length - 1].pct + '% &middot; best ' + Math.max(...q.history.map(h => h.pct)) + '%' : ' &middot; not taken yet') + '</div></div><span class="ib dang" data-del="' + q.id + '">Delete</span></div>').join('') : '') +
      (guides.length ? '<h3>Your study guides</h3>' + guides.slice(0, 8).map(g => '<div class="card row" data-g="' + g.id + '" style="cursor:pointer"><div style="flex:1"><b>' + esc(g.title) + '</b><div class="small mute">' + esc(g.style) + ' &middot; ' + A.fmtAgo(g.created) + '</div></div><span class="ib dang" data-gdel="' + g.id + '">Delete</span></div>').join('') : '');
    slot.onclick = async e => {
      const d = e.target.closest('[data-del]'); if (d) { e.stopPropagation(); if (!confirm('Delete this quiz?')) return; quizzes = quizzes.filter(q => q.id !== d.dataset.del); await kv.set('quizzes', quizzes); return mount(slot); }
      const gd = e.target.closest('[data-gdel]'); if (gd) { e.stopPropagation(); if (!confirm('Delete this study guide?')) return; guides = guides.filter(g => g.id !== gd.dataset.gdel); await kv.set('guides', guides); return mount(slot); }
      const k = e.target.closest('[data-k]'); if (k) return builder(k.dataset.k);
      const q = e.target.closest('[data-q]'); if (q) return take(quizzes.find(x => x.id === q.dataset.q));
      const g = e.target.closest('[data-g]'); if (g) return showGuide(guides.find(x => x.id === g.dataset.g));
    };
  }

  /* ---------- builder (quiz or study guide) ---------- */
  function builder(kind, preset) {
    const isQ = kind === 'quiz'; let src = (preset && preset.src) || 'topic';
    const draw = () => {
      root.innerHTML = '<div class="scroll pad" style="flex:1"><div class="row"><button class="ib" id="bx">&larr; Back</button><h2 style="margin:0">' + (isQ ? 'New quiz' : 'New study guide') + '</h2></div>' +
        '<div class="chips" id="bsrc" style="margin:12px 0 6px">' + [['topic', 'A topic'], ['paste', 'Paste text'], ['note', 'My note'], ['deck', 'A flashcard deck'], ['file', 'A file']].map(s => '<span class="chip' + (src === s[0] ? ' on' : '') + '" data-s="' + s[0] + '" style="' + (src === s[0] ? 'border-color:var(--acc);background:var(--panel2)' : '') + '">' + s[1] + '</span>').join('') + '</div>' +
        '<div id="bin"></div>' +
        (isQ ? '<div class="card" style="margin-top:12px"><div class="row" style="flex-wrap:wrap;gap:12px"><label class="small mute">Questions <select id="bn"><option>5</option><option selected>10</option><option>15</option><option>20</option></select></label><label class="small mute">Level <select id="bl"><option value="easy">Easy</option><option value="medium" selected>Medium</option><option value="hard">Hard</option></select></label></div>' +
          '<div class="row" style="flex-wrap:wrap;gap:14px;margin-top:8px"><label class="chk"><input type="checkbox" id="t_mc" checked> Multiple choice</label><label class="chk"><input type="checkbox" id="t_tf" checked> True / false</label><label class="chk"><input type="checkbox" id="t_fill" checked> Fill in the blank</label><label class="chk"><input type="checkbox" id="t_short"> Short answer</label></div></div>'
          : '<div class="card" style="margin-top:12px"><label class="small mute">Style <select id="bs"><option>Study guide</option><option>Summary</option><option>Cheat sheet</option><option>Explain it simply</option><option>Practice problems with answers</option></select></label></div>') +
        '<div class="row" style="margin-top:12px"><button class="pri" id="bgo">' + (isQ ? 'Generate quiz' : 'Write study guide') + '</button><span class="small mute" id="bst"></span></div></div>';
      const bin = $('bin'), notes = [];
      if (src === 'topic') bin.innerHTML = '<input id="bt" type="text" placeholder="e.g. The French Revolution, photosynthesis, Python loops..." value="' + esc((preset && preset.topic) || '') + '"><label class="chk small mute" style="margin-top:6px"><input type="checkbox" id="blib"> Add offline library notes as background (best for specific topics, like a person, place or event)</label>';
      else if (src === 'paste') bin.innerHTML = '<textarea id="bp" rows="7" placeholder="Paste your notes or reading here...">' + esc((preset && preset.text) || '') + '</textarea>';
      else if (src === 'note') { bin.innerHTML = '<select id="bnt" style="width:100%"><option>Loading notes...</option></select>'; A.api('/api/notes').then(r => { $('bnt').innerHTML = (r.notes || []).length ? r.notes.map(n => '<option value="' + esc(n.id) + '">' + esc(n.title) + '</option>').join('') : '<option value="">(no notes yet)</option>'; }); }
      else if (src === 'deck') { const ds = A.study.decks(); bin.innerHTML = ds.length ? '<select id="bdk" style="width:100%">' + ds.map(d => '<option>' + esc(d) + '</option>').join('') + '</select>' : '<div class="mute small">You have no decks yet.</div>'; }
      else bin.innerHTML = '<input type="file" id="bf" accept=".pdf,.docx,.pptx,.xlsx,.txt,.md,.csv,.html,.htm"><div class="small mute" style="margin-top:4px">PDF, Word, PowerPoint, Excel or text.</div>';
      $('bx').onclick = () => A.study.home();
      $('bsrc').onclick = e => { const c = e.target.closest('[data-s]'); if (c) { src = c.dataset.s; preset = null; draw(); } };
      $('bgo').onclick = go;
    };
    async function getSource() {
      if (src === 'topic') { const t = ($('bt').value || '').trim(); if (!t) { A.toast('Type a topic first'); return null; } let text = ''; if ($('blib').checked && A.caps.lib) { try { const r = await A.api('/api/lib/context', { q: t, n: 3 }); const tw = norm(t).split(' ').filter(w => w.length > 3); text = (r.sources || []).filter((s, i) => i === 0 || tw.some(w => norm(s.title).includes(w))).map(s => s.title + '\n' + s.text).join('\n\n'); } catch (e) {} } return { title: t, topic: t, text: '', ref: text }; }
      if (src === 'paste') { const t = $('bp').value.trim(); if (t.length < 60) { A.toast('Paste a bit more text first'); return null; } return { title: (t.split(/\s+/).slice(0, 6).join(' ').replace(/[.,;:]+$/, '') + (t.split(/\s+/).length > 6 ? '...' : '')) || 'Pasted text', text: t }; }
      if (src === 'note') { const id = $('bnt').value; if (!id) { A.toast('Pick a note'); return null; } const n = await A.api('/api/notes/get?id=' + encodeURIComponent(id)); return { title: n.title, text: n.content }; }
      if (src === 'deck') { const d = $('bdk') && $('bdk').value; if (!d) { A.toast('Pick a deck'); return null; } return { title: d, text: A.study.deckText(d) }; }
      const f = $('bf').files[0]; if (!f) { A.toast('Choose a file'); return null; }
      if (/\.(txt|md|csv|html?)$/i.test(f.name)) return { title: f.name, text: (await f.text()).slice(0, 60000) };
      const r = await (await fetch('/api/extract?name=' + encodeURIComponent(f.name), { method: 'POST', body: await f.arrayBuffer() })).json(); if (r.error) { A.toast(r.error, 5000); return null; } return { title: f.name, text: r.text };
    }
    async function go() {
      let s; $('bgo').disabled = true; $('bst').textContent = 'reading your material...';
      try { s = await getSource(); } catch (e) { s = null; A.toast('Could not read that'); }
      if (!s) { $('bgo').disabled = false; $('bst').textContent = ''; return; }
      if (!isQ) return writeGuide(s, $('bs').value);
      const o = { count: +$('bn').value, level: $('bl').value, types: ['mc', 'tf', 'fill', 'short'].filter(t => $('t_' + t).checked) };
      if (!o.types.length) { A.toast('Pick at least one question type'); $('bgo').disabled = false; return; }
      return runGenerate(s, o, { src, kind });
    }
    draw();
  }

  /* writes the questions (with a progress screen), saves the quiz and starts it; also used when you ask the AI for a quiz in chat */
  async function runGenerate(s, o, back) {
    cancel = false; root.innerHTML = '<div class="pad" style="text-align:center;margin-top:50px"><h2>Writing your quiz</h2><div class="mute" id="qp" style="margin:8px 0">Starting...</div><div class="bar" style="max-width:360px;margin:0 auto 16px"><i id="qb" style="width:3%"></i></div><button class="ib" id="qc">Cancel</button></div>';
    $('qc').onclick = () => { cancel = true; A.study.home(); };
    let qs; try { qs = await makeQuestions(s, o, n => { if ($('qp')) { $('qp').textContent = 'Wrote ' + n + ' of ' + o.count + ' questions...'; $('qb').style.width = Math.max(3, Math.round(n / o.count * 100)) + '%'; } }); }
    catch (e) { A.toast(e.message, 5000); return A.study.home(); }
    if (cancel) return; if (!qs.length) { A.toast('That did not work. Try again, or give me more material.', 5000); return builder((back && back.kind) || 'quiz', { src: (back && back.src) || 'topic', text: (s.text || '').slice(0, 7000), topic: s.topic }); }
    const quiz = { id: mkId(), title: s.title.slice(0, 50), created: Date.now(), level: o.level, questions: qs, history: [] };
    quizzes.unshift(quiz); await kv.set('quizzes', quizzes); take(quiz);
  }

  /* ---------- taking a quiz ---------- */
  function take(quiz, only) {
    if (!quiz) return; const qs = only ? shuf(only) : shuf(quiz.questions); let i = 0; const res = [];
    const exit = () => { kbq = null; A.study.home(); };
    const step = () => {
      if (i >= qs.length) return finish();
      const q = qs[i], head = '<div class="row small mute"><button class="ib" id="qx">&larr; Exit</button><b style="color:var(--acc2)">' + esc(quiz.title) + '</b><span class="sp"></span>' + (i + 1) + ' / ' + qs.length + '</div><div class="bar" style="margin:8px 0"><i style="width:' + Math.round(i / qs.length * 100) + '%"></i></div>';
      let body = '<div class="flash" style="min-height:110px;margin-top:6px">' + esc(q.q) + '</div>';
      if (q.type === 'mc') body += q.options.map((o, k) => '<button class="opt" data-k="' + k + '">' + (k + 1) + '. ' + esc(o) + '</button>').join('');
      else if (q.type === 'tf') body += '<div class="grade"><button data-v="True">True</button><button data-v="False">False</button></div>';
      else body += '<input id="qa" type="text" autocomplete="off" placeholder="' + (q.type === 'fill' ? 'Type the missing word or phrase...' : 'Type your answer...') + '" style="margin-top:6px"><div class="row" style="margin-top:8px"><button class="ib" id="qk">Don\'t know</button><span class="sp"></span><button class="pri" id="qs">Check</button></div>';
      root.innerHTML = '<div class="pad scroll" style="flex:1">' + head + body + '<div id="qf"></div></div>'; $('qx').onclick = exit; let locked = false;
      const feedback = (score, given) => {
        if (locked) return; locked = true; res.push({ q, score, given });
        $('qf').innerHTML = '<div class="card" style="margin-top:10px"><div class="' + (score === 1 ? 'ok' : score > 0 ? 'warn' : 'bad') + '"><b>' + (score === 1 ? 'Correct' : score > 0 ? 'Partly right' : 'Not quite') + '</b></div>' + (score < 1 ? '<div style="margin-top:4px">Answer: <b>' + esc(q.answer) + '</b></div>' : '') + (q.explanation ? '<div class="small mute" style="margin-top:4px">' + esc(q.explanation) + '</div>' : '') + '<div class="row" style="margin-top:10px"><span class="sp"></span><button class="pri" id="qn">' + (i + 1 >= qs.length ? 'See results' : 'Next') + '</button></div></div>'; $('qn').focus(); $('qn').onclick = () => { i++; step(); };
      };
      if (q.type === 'mc') { const pick = k => { if (locked) return; const ok = norm(q.options[k]) === norm(q.answer); root.querySelectorAll('.opt').forEach((b, j) => { if (norm(q.options[j]) === norm(q.answer)) b.classList.add('good'); else if (j === k) b.classList.add('wrong'); }); feedback(ok ? 1 : 0, q.options[k]); }; root.querySelectorAll('.opt').forEach(b => b.onclick = () => pick(+b.dataset.k)); }
      else if (q.type === 'tf') root.querySelectorAll('[data-v]').forEach(b => b.onclick = () => feedback(b.dataset.v === q.answer ? 1 : 0, b.dataset.v));
      else {
        const inp = $('qa'); inp.focus();
        const check = () => { if (locked) return; if (q.type === 'fill') return feedback(same(inp.value, q.answer) ? 1 : 0, inp.value); locked = true; $('qf').innerHTML = '<div class="card" style="margin-top:10px"><div class="small mute">Model answer</div><div><b>' + esc(q.answer) + '</b></div>' + (q.explanation ? '<div class="small mute" style="margin-top:4px">' + esc(q.explanation) + '</div>' : '') + '<div class="small mute" style="margin-top:8px">How did you do?</div><div class="grade" style="margin-top:4px"><button data-sc="1">Got it</button><button data-sc="0.5">Partly</button><button data-sc="0">Missed it</button></div></div>'; root.querySelectorAll('[data-sc]').forEach(b => b.onclick = () => { res.push({ q, score: +b.dataset.sc, given: inp.value }); i++; step(); }); };
        $('qs').onclick = check; $('qk').onclick = () => { if (q.type === 'fill') feedback(0, ''); else { inp.value = inp.value || '(skipped)'; check(); } }; inp.onkeydown = e => { if (e.key === 'Enter') check(); };
      }
      kbq = e => { if (q.type === 'mc' && '1234'.includes(e.key) && q.options[+e.key - 1]) root.querySelectorAll('.opt')[+e.key - 1].click(); else if (q.type === 'tf' && /^[tf]$/i.test(e.key)) root.querySelector('[data-v=' + (e.key.toLowerCase() === 't' ? 'True' : 'False') + ']').click(); };
    };
    function finish() {
      kbq = null; const total = res.reduce((a, r) => a + r.score, 0), pct = Math.round(total / res.length * 100), missed = res.filter(r => r.score < 1);
      if (!only) { quiz.history = (quiz.history || []).concat([{ at: Date.now(), pct, total: res.length }]).slice(-20); kv.set('quizzes', quizzes); }
      root.innerHTML = '<div class="pad scroll" style="flex:1"><h2>Results</h2><div class="stat" style="margin:8px 0"><div class="card"><b>' + pct + '%</b><span class="small mute">score</span></div><div class="card"><b>' + (Math.round(total * 2) / 2) + ' / ' + res.length + '</b><span class="small mute">points</span></div>' + (quiz.history && quiz.history.length > 1 ? '<div class="card"><b>' + Math.max(...quiz.history.map(h => h.pct)) + '%</b><span class="small mute">best</span></div>' : '') + '</div>' +
        '<div class="row" style="flex-wrap:wrap;margin:10px 0"><button class="pri" id="rr">Retake all</button>' + (missed.length ? '<button class="ib" id="rm">Retry the ' + missed.length + ' missed</button><button class="ib" id="rc">Make flashcards from missed</button>' : '') + '<button class="ib" id="rb">Done</button></div>' +
        '<h3>Review</h3>' + res.map(r => '<div class="card" style="padding:8px 12px"><div class="' + (r.score === 1 ? 'ok' : r.score > 0 ? 'warn' : 'bad') + ' small"><b>' + (r.score === 1 ? 'Correct' : r.score > 0 ? 'Partly' : 'Missed') + '</b></div><div>' + esc(r.q.q) + '</div>' + (r.score < 1 ? '<div class="small mute">Your answer: ' + esc(r.given || '(blank)') + '</div>' : '') + '<div class="small">Answer: <b>' + esc(r.q.answer) + '</b></div>' + (r.q.explanation ? '<div class="small mute">' + esc(r.q.explanation) + '</div>' : '') + '</div>').join('') + '</div>';
      $('rr').onclick = () => take(quiz); $('rb').onclick = exit; if (missed.length) { $('rm').onclick = () => take(quiz, missed.map(r => r.q)); $('rc').onclick = async () => { await A.study.addCards('Quiz: ' + quiz.title.slice(0, 30), missed.map(r => ({ q: r.q.type === 'fill' ? r.q.q : r.q.q, a: r.q.answer + (r.q.explanation ? ' - ' + r.q.explanation : '') }))); A.toast(missed.length + ' flashcards added to the deck "Quiz: ' + quiz.title.slice(0, 30) + '"', 3500); }; }
    }
    step();
  }
  let kbq = null; addEventListener('keydown', e => { if (A.cur === 'study' && kbq && !/INPUT|TEXTAREA/.test((e.target || {}).tagName || '')) kbq(e); });

  /* ---------- study guides ---------- */
  const STYLES = {
    'Study guide': 'a complete study guide with these sections: Overview, Key Concepts (each with a clear definition and an example), How It Fits Together, Common Mistakes, Memory Tips, and 5 Self-Check Questions with answers',
    'Summary': 'a clear, well-organised summary in short paragraphs and bullet points covering the most important ideas',
    'Cheat sheet': 'a one-page cheat sheet: terse bullet points, key terms, formulas or rules, and quick examples. No long paragraphs',
    'Explain it simply': 'an explanation for a curious 12-year-old: plain words, everyday analogies, short sections',
    'Practice problems with answers': '8 practice problems of increasing difficulty with full worked answers'
  };
  async function writeGuide(s, style) {
    root.innerHTML = '<div class="pad scroll" style="flex:1"><div class="row"><button class="ib" id="gx">&larr; Back</button><h2 style="margin:0;flex:1">' + esc(s.title) + '</h2><button class="ib" id="gst">Stop</button></div><div class="card m a" style="max-width:none;margin-top:10px"><div class="bd" id="gb"><span class="dots"></span></div></div></div>';
    let text = ''; const ctl = new AbortController(); $('gst').onclick = () => ctl.abort(); $('gx').onclick = () => { ctl.abort(); A.study.home(); };
    const src = s.text ? 'SOURCE MATERIAL:\n---\n' + s.text.slice(0, 14000) + '\n---\nUse only this material.' : 'TOPIC: ' + s.topic + '\nUse accurate, well-established facts about exactly this topic.' + (s.ref ? '\n\nBACKGROUND NOTES (use only the parts relevant to the topic; ignore anything unrelated):\n' + s.ref.slice(0, 4000) : '');
    const prompt = 'Write ' + STYLES[style] + '.\n\n' + src + '\n\nUse Markdown with # headings and - bullets. Be accurate and concise.';
    try {
      const r = await fetch('/api/chat', { method: 'POST', signal: ctl.signal, body: JSON.stringify({ model: $('model').value, stream: true, think: false, keep_alive: '3m', messages: [{ role: 'user', content: prompt }] }) });
      const rd = r.body.getReader(), dec = new TextDecoder(); let buf = '';
      for (;;) { const { value, done } = await rd.read(); if (done) break; buf += dec.decode(value, { stream: true }); let i; while ((i = buf.indexOf('\n')) >= 0) { const ln = buf.slice(0, i).trim(); buf = buf.slice(i + 1); if (!ln) continue; try { const j = JSON.parse(ln); if (j.message && j.message.content) { text += j.message.content; if ($('gb')) $('gb').innerHTML = md(text); } } catch (e) {} } }
    } catch (e) { if (e.name !== 'AbortError') A.toast('The AI engine did not answer'); }
    if (!text.trim()) return A.study.home();
    const g = { id: mkId(), title: s.title.slice(0, 50), style, text, created: Date.now() }; guides.unshift(g); await kv.set('guides', guides); if ($('gb')) showGuide(g);
  }
  function showGuide(g) {
    if (!g) return;
    root.innerHTML = '<div class="pad scroll" style="flex:1"><div class="row" style="flex-wrap:wrap"><button class="ib" id="gx">&larr; Back</button><h2 style="margin:0;flex:1">' + esc(g.title) + ' <span class="small mute">' + esc(g.style) + '</span></h2></div>' +
      '<div class="row" style="flex-wrap:wrap;margin:8px 0"><button class="ib" id="gn">Save to note</button><button class="ib" id="gf">Make flashcards</button><button class="ib" id="gq">Make a quiz from this</button><button class="ib" id="gl">Listen</button><button class="ib" id="gc">Copy</button></div>' +
      '<div class="card m a" style="max-width:none"><div class="bd">' + md(g.text) + '</div></div></div>';
    $('gx').onclick = () => A.study.home(); $('gn').onclick = () => A.notes.create(g.title + ' - ' + g.style, g.text); $('gf').onclick = () => A.study.fromText(g.text, g.title.slice(0, 40));
    $('gq').onclick = () => builder('quiz', { src: 'paste', text: g.text }); $('gl').onclick = function () { A.speech.speak(g.text, this); }; $('gc').onclick = () => A.copy(g.text);
  }

  A.quiz = {
    mount, builder,
    async auto(s, o) { A.showTab('study'); await load(); const types = (o.types || []).filter(t => TYPE[t]); return runGenerate(s, { count: Math.max(3, Math.min(20, +o.count || 10)), level: LEVEL[o.level] ? o.level : 'medium', types: types.length ? types : ['mc', 'tf', 'fill'] }); },
    async guide(s, style) { A.showTab('study'); await load(); return writeGuide(s, STYLES[style] ? style : 'Study guide'); },
    fromText: (text, title) => { A.showTab('study'); load().then(() => builder('quiz', { src: 'paste', text })); } };
})();

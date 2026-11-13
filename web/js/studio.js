// Studio: a hub of creative tools (pixel art, sketchpad, generative art, music studio, and Teach me). Each tool registers itself with A.studio.reg(id, label, render).
// This file also holds the Writing coach and Practice (interviews, debates and hard conversations with feedback); they live in the Prepare tab (A.prep.sections.writing / .practice).
(() => {
  const root = document.getElementById('p-studio'); if (!root) return;
  const esc2 = s => String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const tools = []; let sub = ls.get('studio_sub', 'pixel'), tok = 0;
  root.innerHTML = '<div class="row" id="ssub" style="padding:8px 12px;gap:6px;border-bottom:1px solid var(--line);flex-wrap:wrap"></div><div id="sbody" style="flex:1;min-height:0;display:flex;flex-direction:column"></div>';
  const bar = () => { root.querySelector('#ssub').innerHTML = tools.map(t => '<button class="ib' + (sub === t.id ? ' on' : '') + '" data-s="' + t.id + '">' + t.label + '</button>').join(''); };
  function go(id) { const t = tools.find(x => x.id === id) || tools[0]; if (!t) return; sub = t.id; ls.set('studio_sub', sub); bar(); const b = root.querySelector('#sbody'); try { A.speech && A.speech.stop && A.speech.stop(); } catch (e) { } A.keep(b, t.id, el => t.render(el, ++tok)); }      // kept alive: switching away never loses work in progress
  root.querySelector('#ssub').onclick = e => { const b = e.target.closest('[data-s]'); if (b) go(b.dataset.s); };
  /* tools that moved to tabs of their own (Writing, Practice and Teach me to Education, Albums to Personal) are taken out
     of Studio with take(); A.studio.go() still finds them there */
  const away = {};
  A.studio = { reg(id, label, render, order) { if (away[id]) { away[id].render = render; return; } tools.push({ id, label, render, order: order == null ? tools.length : order }); tools.sort((a, b) => a.order - b.order); }, go: id => { if (away[id]) return A.showTab(away[id].tab); sub = id; ls.set('studio_sub', id); A.showTab('studio'); }, esc: esc2,
    take(id, tab) { const i = tools.findIndex(t => t.id === id); const t = i >= 0 ? tools.splice(i, 1)[0] : { id, label: id, render: null }; t.tab = tab; away[id] = t; if (sub === id) sub = (tools[0] || {}).id || 'pixel'; return t; } };

  /* ---------------- Writing coach ---------------- */
  const MODES = [['clear', '✨ Make it clearer', 'Rewrite the text so it is clearer and easier to read. Keep the meaning, my voice and roughly the same length.'], ['grammar', '✅ Fix grammar only', 'Correct spelling, grammar and punctuation only. Do not change the wording or style otherwise.'], ['short', '✂️ Shorter', 'Rewrite the text about 40% shorter without losing the key points.'], ['formal', '👔 More formal', 'Rewrite the text in a more formal, professional tone.'], ['friendly', '😊 Friendlier', 'Rewrite the text in a warmer, friendlier, more conversational tone.'], ['persuade', '🎯 More persuasive', 'Rewrite the text to be more persuasive and confident, with a strong opening and a clear call to action.'], ['plain', '🧒 Plain language', 'Rewrite the text in plain language a 12-year-old would understand, with short sentences.']];
  const stats = t => { const words = (t.match(/\b[\w'’-]+\b/g) || []), sents = (t.match(/[.!?]+(\s|$)/g) || []).length || (words.length ? 1 : 0), syl = w => Math.max(1, (w.toLowerCase().replace(/e$/, '').match(/[aeiouy]+/g) || []).length), sy = words.reduce((a, w) => a + syl(w), 0); const fre = words.length && sents ? 206.835 - 1.015 * (words.length / sents) - 84.6 * (sy / words.length) : 0; const grade = words.length && sents ? .39 * (words.length / sents) + 11.8 * (sy / words.length) - 15.59 : 0; return { words: words.length, sents, mins: Math.max(1, Math.round(words.length / 200)), fre: Math.round(fre), grade: Math.max(0, Math.round(grade * 10) / 10) }; };
  A.prep.sections.writing = b => {
    b.innerHTML = '<div class="scroll pad" style="flex:1"><h2>✍️ Writing coach</h2><div class="mute small">Paste an email, essay, letter or post. Pick what you want done. Everything is processed on this PC.</div>' +
      '<textarea id="wtxt" rows="9" placeholder="Paste or write your text here..." style="width:100%;margin-top:10px;line-height:1.55"></textarea><div class="small mute" id="wst" style="margin:4px 0 8px"></div>' +
      '<div class="row" style="gap:6px;flex-wrap:wrap;margin-bottom:8px">' + MODES.map(m => '<button class="ib" data-m="' + m[0] + '">' + m[1] + '</button>').join('') + '<button class="pri" data-m="report">📝 Full feedback report</button></div>' +
      '<div id="wout"></div></div>';
    const $ = id => b.querySelector('#' + id), ta = $('wtxt'); ta.onkeydown = e => e.stopPropagation();
    const upd = () => { const s = stats(ta.value); $('wst').textContent = s.words ? s.words + ' words · ' + s.sents + ' sentences · about ' + s.mins + ' min read · reading ease ' + s.fre + ' (higher is easier) · grade level ' + s.grade : ''; }; ta.oninput = upd; upd();
    let ctl = null;
    b.onclick = async e => {
      const m = e.target.closest('[data-m]'), cp = e.target.closest('[data-cp]'), sv = e.target.closest('[data-sv]'), ap = e.target.closest('[data-ap]');
      const out = $('wout');
      if (cp) { A.copy(out.querySelector('.wres').innerText); return; } if (sv) { A.notes.create('Writing: ' + (ta.value.split(/\s+/).slice(0, 6).join(' ') || 'draft'), out.querySelector('.wres').innerText); A.toast('Saved as a note'); return; } if (ap) { ta.value = out.querySelector('.wres').innerText; upd(); A.toast('Replaced your text'); return; }
      if (!m) return; const text = ta.value.trim(); if (!text) return A.toast('Paste some text first'); try { ctl && ctl.abort(); } catch (er) { } ctl = new AbortController();
      const kind = m.dataset.m, rep = kind === 'report'; const mode = MODES.find(x => x[0] === kind);
      const sys = rep ? 'You are a kind, expert writing coach. Give a feedback report on the text with these short sections: Summary (one sentence on what the text does), Strengths (2 or 3 bullets), Biggest problems (up to 4 bullets with a quote from the text and a fix), Tone and audience, Structure, and a Score out of 10 with one sentence why. Be specific and practical. Do not rewrite the whole text.' : 'You are an editor. ' + mode[2] + ' Reply with ONLY the rewritten text, no preface, no notes, no quotes.';
      out.innerHTML = '<div class="card"><div class="wres" style="white-space:pre-wrap;line-height:1.65">...</div><div class="row" style="gap:6px;margin-top:10px;flex-wrap:wrap"><button class="ib" data-cp="1">Copy</button><button class="ib" data-sv="1">Save as note</button>' + (rep ? '' : '<button class="ib" data-ap="1">Use this instead</button>') + '</div></div>';
      const r = out.querySelector('.wres'); try { await A.ai.stream([{ role: 'system', content: sys }, { role: 'user', content: text.slice(0, 7000) }], x => { r.textContent = x; }, ctl.signal, { temp: .4 }); } catch (er) { if (er.name !== 'AbortError') r.textContent = 'The AI engine did not answer. Check that a model is installed.'; }
    };
  };

  /* ---------------- Practice: interviews, debates, hard conversations ---------------- */
  const SC = [['💼', 'Job interview', 'role', 'You are an experienced hiring manager interviewing the user for the job they name. Ask one question at a time, follow up on their answers, and stay realistic.'], ['⚔️', 'Debate', 'topic', 'You are a sharp but fair debate opponent. Take the OPPOSITE side to the user on the topic they name, make one strong point at a time, and respond directly to their arguments.'], ['💬', 'A hard conversation', 'situation', 'You role-play the other person in the difficult conversation the user describes (for example a boss, a landlord, a friend). Stay in character, be realistic, not cruel.'], ['🎤', 'Press questions', 'subject', 'You are a journalist asking the user tough but fair questions about the subject they name, one at a time, like a press conference.'], ['💰', 'Negotiation', 'deal', 'You are the other side in a negotiation the user describes. Push back politely, make counter-offers, and only concede when given good reasons.'], ['🗣️', 'Public speaking Q&A', 'talk', 'You are an audience member asking questions after the user\'s talk on the topic they name. Ask varied questions, some friendly, some challenging.']];
  A.prep.sections.practice = b => {
    b.innerHTML = '<div class="scroll pad" style="flex:1"><h2>🎤 Practice</h2><div class="mute small">Rehearse an interview, a debate or a hard conversation with an AI partner, then get honest feedback. It runs on this PC.</div><div id="pbody"></div></div>';
    const body = b.querySelector('#pbody'); let cur = null, hist = [], ctl = null;
    const menu = () => {
      body.innerHTML = '<div class="row" style="gap:10px;flex-wrap:wrap;margin-top:12px">' + SC.map((s, i) => '<div class="card" data-i="' + i + '" style="flex:1;min-width:210px;cursor:pointer;margin:0"><div style="font-size:28px">' + s[0] + '</div><b>' + s[1] + '</b></div>').join('') + '</div>';
      body.onclick = e => { const c = e.target.closest('[data-i]'); if (!c) return; cur = SC[+c.dataset.i]; setup(); };
    };
    const setup = () => {
      body.innerHTML = '<div class="card" style="margin-top:12px"><b>' + cur[0] + ' ' + cur[1] + '</b><div class="small mute" style="margin:4px 0 8px">Describe the ' + esc2(cur[2]) + ' in a sentence or two (the more detail, the better the practice).</div><textarea id="pctx" rows="3" style="width:100%" placeholder="e.g. ' + ({ role: 'Junior data analyst at a hospital', topic: 'Schools should start later in the morning', situation: 'Asking my landlord to fix the heating', subject: 'Our company is delaying a product launch', deal: 'Salary for a new job offer', talk: 'Renewable energy for small towns' }[cur[2]]) + '"></textarea><div class="row" style="gap:8px;margin-top:8px"><button class="ib" id="pback">← Back</button><span class="sp"></span><button class="pri" id="pgo">Start</button></div></div>';
      const ta = body.querySelector('#pctx'); ta.onkeydown = e => e.stopPropagation(); ta.focus();
      body.querySelector('#pback').onclick = menu; body.querySelector('#pgo').onclick = () => { const v = ta.value.trim(); if (!v) return A.toast('Add a line of detail first'); chat(v); };
    };
    const chat = async ctx => {
      hist = []; body.innerHTML = '<div class="row" style="gap:8px;align-items:center;margin:12px 0 6px"><button class="ib" id="pend">← End</button><b>' + cur[0] + ' ' + cur[1] + '</b><span class="sp"></span><label class="chk small"><input type="checkbox" id="ptts"> Read aloud</label><button class="pri" id="pfb">Get feedback</button></div><div id="pmsg" style="min-height:240px"></div><div class="row" style="gap:8px;margin-top:8px"><textarea id="pin" rows="2" placeholder="Your answer..." style="flex:1"></textarea><button class="pri" id="psend">Send</button></div><div id="pfeed"></div>';
      const msgs = body.querySelector('#pmsg'), inp = body.querySelector('#pin'); inp.onkeydown = e => { e.stopPropagation(); if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); } };
      const bub = (who, t) => { const d = document.createElement('div'); d.style.cssText = 'max-width:86%;padding:9px 13px;border-radius:14px;margin:6px 0;line-height:1.5;white-space:pre-wrap;' + (who === 'ai' ? 'background:var(--panel);border:1px solid var(--line)' : 'background:var(--user);margin-left:auto'); d.textContent = t; msgs.appendChild(d); d.scrollIntoView({ block: 'nearest' }); return d; };
      const sys = cur[3] + ' Context from the user: ' + ctx + ' Keep each turn to 1 to 3 sentences. Never give feedback during the conversation; just play the role. Do not use markdown.';
      const turn = async (u) => { if (u) { hist.push({ role: 'user', content: u }); bub('me', u); } const d = bub('ai', '...'); let all = ''; try { ctl = new AbortController(); all = await A.ai.stream([{ role: 'system', content: sys }].concat(hist.slice(-14), u ? [] : [{ role: 'user', content: '(Begin the scene with your first line or question.)' }]), x => { d.textContent = x; d.scrollIntoView({ block: 'nearest' }); }, ctl.signal); } catch (e) { all = ''; } if (!all) { d.textContent = 'The AI engine did not answer.'; return; } hist.push({ role: 'assistant', content: all }); if (body.querySelector('#ptts') && body.querySelector('#ptts').checked) { try { A.speech.speak(all); } catch (e) { } } };
      const send = () => { const v = inp.value.trim(); if (!v) return; inp.value = ''; turn(v); }; body.querySelector('#psend').onclick = send;
      body.querySelector('#pend').onclick = () => { try { ctl && ctl.abort(); } catch (e) { } menu(); };
      body.querySelector('#pfb').onclick = async () => {
        const mine = hist.filter(h => h.role === 'user'); if (mine.length < 2) return A.toast('Answer at least twice first'); const out = body.querySelector('#pfeed'); out.innerHTML = '<div class="card" style="margin-top:12px"><b>Feedback</b><div class="fb" style="white-space:pre-wrap;line-height:1.6;margin-top:6px">...</div></div>'; const f = out.querySelector('.fb');
        const tr = hist.map(h => (h.role === 'user' ? 'USER: ' : 'PARTNER: ') + h.content).join('\n'); try { await A.ai.stream([{ role: 'system', content: 'You are a supportive communication coach. Review this practice conversation (' + cur[1] + '; context: ' + ctx + ') and give feedback ONLY on the USER\'s answers, in these sections: Score out of 10 with one sentence; What worked (2 bullets); What to improve (3 specific bullets, quoting the user); A stronger version of their weakest answer; One thing to practise next. Be honest and encouraging.' }, { role: 'user', content: tr.slice(0, 7000) }], x => { f.textContent = x; }, null, { temp: .4 }); } catch (e) { f.textContent = 'The AI engine did not answer.'; } out.scrollIntoView({ block: 'nearest' });
      };
      turn('');
    };
    menu(); b._cleanup = () => { try { ctl && ctl.abort(); } catch (e) { } };
  };

  A.registerTab('studio', 'Studio', () => { go(sub); });
})();

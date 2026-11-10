// Swarm (Chat > Swarm): the third tab of the Chat page. Teams of local models work on one task in one folder.
// A team is a list of members (a name, a role, a model, a role prompt). A workflow is a list of stages, each with steps;
// a step gives one member an instruction, or has them make a picture, music, a voice line or a video clip.
// The run itself happens in the server (lib/swarm.js); this page edits teams and workflows, starts a run and shows its progress.
(() => {
  const esc = s => String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const lsGet = (k, d) => { try { const v = localStorage.getItem(k); return v == null ? d : v; } catch (e) { return d; } };
  const lsPut = (k, v) => { try { if (v) localStorage.setItem(k, v); else localStorage.removeItem(k); } catch (e) { } };
  const uid = p => p + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
  const words = s => String(s || '').trim().split(/\s+/).filter(Boolean).length;
  const TYPE = { agent: '🤖 Work on files', image: '🖼️ Make a picture', music: '🎵 Make music', voice: '🗣️ Speak a line', video: '🎬 Make a video clip' };
  const STATE = { waiting: ['⏳', 'Waiting'], running: ['⚙️', 'Working'], done: ['✅', 'Done'], failed: ['⚠️', 'Failed'], refused: ['🛑', 'Refused'] };

  function render(b) {
    let alive = true, D = null, dirty = false, poll = 0, teamId = '', flowId = '';
    b._cleanup = () => { alive = false; clearInterval(poll); };
    b._dirty = () => dirty;      // the Chat tabs ask before closing this page with unsaved teams or workflows
    b.innerHTML = '<div class="scroll pad" style="flex:1"><div style="max-width:980px">' +
      '<h2>🐝 Swarm</h2><div class="mute small" style="margin:2px 0 14px">Several of your local models work on one task in one folder. Models of different kinds take turns, because this PC holds one large model in memory at a time; two helpers on the same model work side by side. Everything runs on this PC.</div>' +
      '<div class="card"><div style="font-weight:600;margin-bottom:6px">The task</div><textarea id="swtask" rows="3" style="width:100%" placeholder="e.g. a snake game in one file, snake.html, with a score and a restart button"></textarea>' +
      '<div class="row" style="gap:8px;flex-wrap:wrap;align-items:center;margin-top:8px"><label class="small mute">Workflow <select id="swflow"></select></label><button class="ib" id="swpick">Choose a folder...</button><span class="small mute" id="swdir" style="word-break:break-all"></span></div>' +
      '<div class="row" style="gap:8px;margin-top:10px;align-items:center"><button class="pri" id="swgo">▶ Start the swarm</button><button class="ib dang" id="swstop" style="display:none">■ Stop</button><span class="small mute" id="swmsg"></span></div></div>' +
      '<div id="swboard" style="margin-top:10px"></div>' +
      '<div class="card" style="margin-top:10px"><div class="row" style="align-items:center;gap:8px;flex-wrap:wrap"><div style="font-weight:600;flex:1">Teams</div><select id="swteam"></select><button class="ib" data-act="team-new">New</button><button class="ib" data-act="team-copy">Copy</button><button class="ib dang" data-act="team-del">Delete</button></div><div id="swteamed" style="margin-top:8px"></div></div>' +
      '<div class="card" style="margin-top:10px"><div class="row" style="align-items:center;gap:8px;flex-wrap:wrap"><div style="font-weight:600;flex:1">Workflows</div><select id="swflowed"></select><button class="ib" data-act="flow-new">New</button><button class="ib" data-act="flow-copy">Copy</button><button class="ib dang" data-act="flow-del">Delete</button></div><div id="swflowbody" style="margin-top:8px"></div></div>' +
      '<div class="row" style="gap:8px;margin:12px 0;align-items:center"><button class="ib on" id="swsave" style="padding:8px 16px">Save teams and workflows</button><span class="small mute" id="swsavemsg"></span></div>' +
      '<div class="card"><div style="font-weight:600;margin-bottom:6px">Good to know</div><ul class="small" style="margin:0;padding-left:18px;line-height:1.6">' +
      '<li><b>Keep tasks small.</b> These are small models. One file or a handful of files works; a large program does not.</li>' +
      '<li><b>The notes file.</b> Each helper reads and adds to SWARM-NOTES.md in the folder. That file is how they pass work to each other, and it is the first place to look when a run goes wrong.</li>' +
      '<li><b>Safety.</b> Every helper works under the same guard as the Agent tab. Nobody is there to approve a command during a swarm, so anything that would ask (deleting, installing, downloading) is refused and shown here. Use the Agent tab for that work.</li>' +
      '<li><b>The folder.</b> Pick an empty folder or one you have backed up, not your documents or this app.</li>' +
      '<li><b>Which model.</b> Gemma 4 (e4b) is the quick one on this PC: it fits on the graphics card and wrote about 34 tokens a second in testing. Qwen 3.5 9b wrote about 8 and ran out of time on building steps. Give the larger models short jobs, such as a plan or a second opinion.</li>' +
      '<li><b>Check the result.</b> A helper sometimes says it made a file and did not. The board lists the files each step really made or changed.</li>' +
      '<li><b>Time.</b> A step may take up to 15 minutes. A failed step is tried once more, then the run carries on.</li></ul></div></div></div>';
    const $ = id => b.querySelector('#' + id);
    const team = () => D.teams.find(t => t.id === teamId), flow = () => D.workflows.find(w => w.id === flowId);
    const touch = () => { dirty = true; $('swsavemsg').textContent = 'Not saved yet.'; };
    const dirLine = () => { $('swdir').textContent = lsGet('swarmdir', '') || 'No folder chosen yet.'; };
    $('swtask').value = lsGet('swarmtask', ''); $('swtask').oninput = () => lsPut('swarmtask', $('swtask').value);
    dirLine();

    const opt = (v, label, sel, dis) => '<option value="' + esc(v) + '"' + (sel ? ' selected' : '') + (dis ? ' disabled' : '') + '>' + esc(label) + '</option>';
    const modelOpts = cur => { const names = D.models.map(m => m.name); return (names.includes(cur) || !cur ? '' : opt(cur, cur + ' (not on this PC)', true)) + D.models.map(m => opt(m.name, m.name.replace(/:latest$/, '') + (m.tools ? '' : ' · cannot use tools'), m.name === cur, !m.tools)).join(''); };

    function pickers() {
      if (!D.teams.some(t => t.id === teamId)) teamId = (D.teams[0] || {}).id || '';
      if (!D.workflows.some(w => w.id === flowId)) flowId = (D.workflows[0] || {}).id || '';
      $('swteam').innerHTML = D.teams.map(t => opt(t.id, t.name, t.id === teamId)).join('');
      $('swflowed').innerHTML = D.workflows.map(w => opt(w.id, w.name, w.id === flowId)).join('');
      const run = lsGet('swarmflow', ''); $('swflow').innerHTML = D.workflows.map(w => opt(w.id, w.name, w.id === run)).join('');
    }
    function teamEditor() {
      const t = team(), box = $('swteamed'); if (!t) { box.innerHTML = '<div class="small mute">No team yet. Press New.</div>'; return; }
      box.innerHTML = '<label class="small mute">Team name <input data-f="team-name" value="' + esc(t.name) + '" style="width:260px;max-width:100%"></label>' +
        t.members.map((m, i) => '<div style="border-top:1px solid var(--line);margin-top:10px;padding-top:10px"><div class="row" style="gap:8px;flex-wrap:wrap;align-items:center">' +
          '<input data-f="m-name" data-i="' + i + '" value="' + esc(m.name) + '" style="width:150px" title="Name">' +
          '<select data-f="m-role" data-i="' + i + '" title="Role">' + Object.keys(D.roles).map(r => opt(r, D.roles[r].label, r === m.role)).join('') + '</select>' +
          '<select data-f="m-model" data-i="' + i + '" title="Model" style="max-width:260px">' + modelOpts(m.model) + '</select>' +
          '<span style="flex:1"></span><button class="ib dang" data-act="m-del" data-i="' + i + '" style="padding:2px 10px">Remove</button></div>' +
          '<textarea data-f="m-prompt" data-i="' + i + '" rows="2" style="width:100%;margin-top:6px" placeholder="What this helper is told about its job">' + esc(m.prompt) + '</textarea>' +
          '<div class="small mute" data-wc="' + i + '">' + words(m.prompt) + ' of ' + D.maxWords + ' words</div></div>').join('') +
        '<div style="margin-top:10px"><button class="ib" data-act="m-add">+ Add a helper</button></div>';
    }
    function flowEditor() {
      const w = flow(), box = $('swflowbody'); if (!w) { box.innerHTML = '<div class="small mute">No workflow yet. Press New.</div>'; return; }
      const t = D.teams.find(x => x.id === w.teamId), members = t ? t.members : [];
      box.innerHTML = '<div class="row" style="gap:8px;flex-wrap:wrap;align-items:center"><label class="small mute">Workflow name <input data-f="w-name" value="' + esc(w.name) + '" style="width:240px;max-width:100%"></label><label class="small mute">Team <select data-f="w-team">' + D.teams.map(x => opt(x.id, x.name, x.id === w.teamId)).join('') + '</select></label></div>' +
        '<div class="small mute" style="margin-top:6px">In an instruction, <b>{task}</b> is the task you type, <b>{notes}</b> is the notes file so far, and <b>{previous}</b> is what the stage before said.</div>' +
        w.stages.map((g, si) => '<div style="border-top:1px solid var(--line);margin-top:10px;padding-top:10px"><div class="row" style="gap:8px;align-items:center;flex-wrap:wrap"><b>Stage ' + (si + 1) + '</b><input data-f="g-name" data-s="' + si + '" value="' + esc(g.name) + '" style="width:200px"><span style="flex:1"></span><button class="ib dang" data-act="g-del" data-s="' + si + '" style="padding:2px 10px">Remove stage</button></div>' +
          g.steps.map((s, ki) => '<div style="margin:8px 0 0 14px"><div class="row" style="gap:8px;flex-wrap:wrap;align-items:center">' +
            '<select data-f="s-member" data-s="' + si + '" data-k="' + ki + '">' + (members.some(m => m.id === s.member) ? '' : opt(s.member, '(nobody)', true)) + members.map(m => opt(m.id, m.name, m.id === s.member)).join('') + '</select>' +
            '<select data-f="s-type" data-s="' + si + '" data-k="' + ki + '">' + D.types.map(ty => opt(ty, TYPE[ty] + (ty === 'agent' || D.media[ty] ? '' : ' (not installed)'), ty === s.type)).join('') + '</select>' +
            '<span style="flex:1"></span><button class="ib dang" data-act="s-del" data-s="' + si + '" data-k="' + ki + '" style="padding:2px 10px">Remove</button></div>' +
            '<textarea data-f="s-text" data-s="' + si + '" data-k="' + ki + '" rows="2" style="width:100%;margin-top:6px" placeholder="What this helper should do in this stage">' + esc(s.instruction) + '</textarea></div>').join('') +
          '<div style="margin:8px 0 0 14px"><button class="ib" data-act="s-add" data-s="' + si + '">+ Add a step</button></div></div>').join('') +
        '<div style="margin-top:10px"><button class="ib" data-act="g-add">+ Add a stage</button></div>';
    }
    const redraw = () => { pickers(); teamEditor(); flowEditor(); };

    /* typing changes the data in place; nothing is redrawn, so the cursor stays where it is */
    b.addEventListener('input', e => {
      const el = e.target, f = el.dataset && el.dataset.f; if (!f || !D) return;
      const t = team(), w = flow(), i = +el.dataset.i, si = +el.dataset.s, ki = +el.dataset.k;
      if (f === 'team-name' && t) t.name = el.value;
      else if (f === 'm-name' && t) t.members[i].name = el.value;
      else if (f === 'm-prompt' && t) { t.members[i].prompt = el.value; const c = b.querySelector('[data-wc="' + i + '"]'); if (c) { const n = words(el.value); c.textContent = n + ' of ' + D.maxWords + ' words'; c.className = 'small ' + (n > D.maxWords ? 'bad' : 'mute'); } }
      else if (f === 'w-name' && w) w.name = el.value;
      else if (f === 'g-name' && w) w.stages[si].name = el.value;
      else if (f === 's-text' && w) w.stages[si].steps[ki].instruction = el.value;
      else return;
      touch();
    });
    b.addEventListener('change', e => {
      const el = e.target, f = el.dataset && el.dataset.f; if (!D) return;
      if (el.id === 'swteam') { teamId = el.value; teamEditor(); return; }
      if (el.id === 'swflowed') { flowId = el.value; flowEditor(); return; }
      if (el.id === 'swflow') { lsPut('swarmflow', el.value); return; }
      if (!f) return; const t = team(), w = flow(), i = +el.dataset.i, si = +el.dataset.s, ki = +el.dataset.k;
      if (f === 'm-role' && t) { const m = t.members[i], old = D.roles[m.role]; if (!m.prompt.trim() || (old && m.prompt === old.prompt)) m.prompt = D.roles[el.value].prompt; m.role = el.value; touch(); teamEditor(); }
      else if (f === 'm-model' && t) { t.members[i].model = el.value; touch(); }
      else if (f === 'w-team' && w) { w.teamId = el.value; touch(); flowEditor(); }
      else if (f === 's-member' && w) { w.stages[si].steps[ki].member = el.value; touch(); }
      else if (f === 's-type' && w) { w.stages[si].steps[ki].type = el.value; touch(); }
      else if (f === 'team-name' || f === 'w-name') pickers();
    });
    b.addEventListener('click', e => {
      const el = e.target.closest('[data-act]'); if (!el || !D) return;
      const act = el.dataset.act, t = team(), w = flow(), i = +el.dataset.i, si = +el.dataset.s, ki = +el.dataset.k;
      const firstModel = () => ((D.models.find(m => m.tools) || {}).name) || '';
      if (act === 'team-new') { const n = { id: uid('t'), name: 'New team', members: [{ id: uid('m'), name: 'Builder', role: 'builder', model: firstModel(), prompt: D.roles.builder.prompt }] }; D.teams.push(n); teamId = n.id; }
      else if (act === 'team-copy' && t) { const n = JSON.parse(JSON.stringify(t)); n.id = uid('t'); n.name = t.name + ' (copy)'; D.teams.push(n); teamId = n.id; }
      else if (act === 'team-del' && t) { const used = D.workflows.filter(x => x.teamId === t.id); if (used.length) { A.toast('That team is used by the workflow "' + used[0].name + '". Change or delete the workflow first.'); return; } if (!confirm('Delete the team "' + t.name + '"?')) return; D.teams = D.teams.filter(x => x !== t); }
      else if (act === 'm-add' && t) t.members.push({ id: uid('m'), name: 'Helper ' + (t.members.length + 1), role: 'builder', model: firstModel(), prompt: D.roles.builder.prompt });
      else if (act === 'm-del' && t) { const m = t.members[i]; if (D.workflows.some(x => x.teamId === t.id && x.stages.some(g => g.steps.some(s => s.member === m.id)))) { A.toast(m.name + ' has steps in a workflow. Remove those steps first.'); return; } t.members.splice(i, 1); }
      else if (act === 'flow-new') { const tm = t || D.teams[0]; if (!tm) { A.toast('Make a team first.'); return; } const n = { id: uid('w'), name: 'New workflow', teamId: tm.id, stages: [{ name: 'Build', steps: [{ member: tm.members[0].id, type: 'agent', instruction: 'The task: {task}' }] }] }; D.workflows.push(n); flowId = n.id; }
      else if (act === 'flow-copy' && w) { const n = JSON.parse(JSON.stringify(w)); n.id = uid('w'); n.name = w.name + ' (copy)'; D.workflows.push(n); flowId = n.id; }
      else if (act === 'flow-del' && w) { if (!confirm('Delete the workflow "' + w.name + '"?')) return; D.workflows = D.workflows.filter(x => x !== w); }
      else if (act === 'g-add' && w) w.stages.push({ name: 'Stage ' + (w.stages.length + 1), steps: [] });
      else if (act === 'g-del' && w) w.stages.splice(si, 1);
      else if (act === 's-add' && w) { const tm = D.teams.find(x => x.id === w.teamId); w.stages[si].steps.push({ member: tm && tm.members[0] ? tm.members[0].id : '', type: 'agent', instruction: 'The task: {task}\n\nNotes so far:\n{notes}' }); }
      else if (act === 's-del' && w) w.stages[si].steps.splice(ki, 1);
      else return;
      touch(); redraw();
    });

    async function save() {
      let r; try { r = await A.api('/api/swarm/save', { teams: D.teams, workflows: D.workflows }); } catch (e) { r = { ok: false, error: String(e.message || e) }; }
      if (!alive) return false;
      if (r && r.ok) { dirty = false; $('swsavemsg').textContent = 'Saved.'; pickers(); return true; }
      $('swsavemsg').innerHTML = '<span class="bad">' + esc((r && r.error) || 'Could not save.') + '</span>'; return false;
    }
    $('swsave').onclick = save;
    $('swpick').onclick = async () => {
      $('swmsg').textContent = 'Choose a folder in the window that opened...';
      let r; try { r = await A.api('/api/pick-folder', {}); } catch (e) { r = null; }
      if (!alive) return; $('swmsg').textContent = '';
      if (r && r.path) { lsPut('swarmdir', r.path); dirLine(); }
    };

    /* ---- the live board ---- */
    function board(s) {
      const box = $('swboard'); if (!box) return;
      $('swstop').style.display = s.running ? '' : 'none'; $('swgo').disabled = !!s.running;
      if (!s.stages || !s.stages.length) { box.innerHTML = ''; return; }
      const head = s.running ? 'Working on: ' : s.stopped ? 'Stopped: ' : 'Finished: ';
      const made = []; s.stages.forEach(g => g.steps.forEach(x => (x.files || []).forEach(f => { if (!made.includes(f)) made.push(f); })));
      box.innerHTML = '<div class="card"><div style="font-weight:600">' + esc(head) + esc(String(s.task || '').slice(0, 160)) + '</div><div class="small mute" style="word-break:break-all">' + esc(s.workflow || '') + ' · ' + esc(s.team || '') + ' · ' + esc(s.dir || '') + '</div>' +
        s.stages.map((g, i) => '<div style="border-top:1px solid var(--line);margin-top:8px;padding-top:8px"><b>Stage ' + (i + 1) + ': ' + esc(g.name) + '</b>' +
          g.steps.map(x => { const st = STATE[x.state] || STATE.waiting, tail = String(x.tail || '').trim().split(/\r?\n/).slice(-6).join('\n');
            return '<div style="margin:6px 0 0 6px"><div class="row" style="gap:8px;align-items:baseline;flex-wrap:wrap"><span style="width:20px">' + st[0] + '</span><b>' + esc(x.member) + '</b><span class="small mute">' + esc(x.model) + ' · ' + esc(TYPE[x.type] || x.type) + ' · ' + st[1] + (x.seconds ? ' · ' + x.seconds + ' s' : '') + '</span></div>' +
              (x.error ? '<div class="small bad" style="margin-left:28px">' + esc(x.error) + '</div>' : '') +
              (tail ? '<pre class="small" style="margin:4px 0 0 28px;white-space:pre-wrap;word-break:break-word;max-height:140px;overflow:auto;opacity:.85">' + esc(tail) + '</pre>' : '') + '</div>'; }).join('') + '</div>').join('') +
        (!s.running && made.length ? '<div style="border-top:1px solid var(--line);margin-top:8px;padding-top:8px"><b>Files made or changed</b><div class="small" style="word-break:break-all">' + made.map(esc).join('<br>') + '</div></div>' : '') +
        (!s.running ? '<div style="margin-top:8px"><button class="ib" id="swopen">📂 Open the folder</button></div>' : '') + '</div>';
      const o = $('swopen'); if (o) o.onclick = () => A.api('/api/swarm/open', {}).then(r => { if (!r || !r.ok) A.toast((r && r.error) || 'Could not open the folder.'); }).catch(() => A.toast('Could not open the folder.'));
    }
    async function tick() { let s; try { s = await A.api('/api/swarm/status'); } catch (e) { return; } if (!alive) return; board(s); if (!s.running) { clearInterval(poll); poll = 0; } }
    const watch = () => { clearInterval(poll); poll = setInterval(tick, 2000); tick(); };

    $('swgo').onclick = async () => {
      const task = $('swtask').value.trim(), dir = lsGet('swarmdir', ''), wf = $('swflow').value;
      if (!task) { $('swmsg').innerHTML = '<span class="bad">Type the task first.</span>'; return; }
      if (!dir) { $('swmsg').innerHTML = '<span class="bad">Choose a folder first.</span>'; return; }
      if (dirty && !(await save())) { $('swmsg').innerHTML = '<span class="bad">Fix the team or workflow below, then start again.</span>'; return; }
      $('swgo').disabled = true; $('swmsg').textContent = 'Starting...';
      let r; try { r = await A.api('/api/swarm/run', { task, dir, workflowId: wf }); } catch (e) { r = { ok: false, error: String(e.message || e) }; }
      if (!alive) return;
      if (r && r.ok) { $('swmsg').textContent = ''; watch(); } else { $('swgo').disabled = false; $('swmsg').innerHTML = '<span class="bad">' + esc((r && r.error) || 'The swarm could not start.') + '</span>'; }
    };
    $('swstop').onclick = async () => { try { await A.api('/api/swarm/stop', {}); } catch (e) { } tick(); };

    (async () => {
      let d; try { d = await A.api('/api/swarm/data'); } catch (e) { d = null; }
      if (!alive) return;
      if (!d || !d.teams) { $('swmsg').innerHTML = '<span class="bad">Moundshroud could not load the teams.</span>'; return; }
      D = d;
      if (!d.ollama) $('swmsg').textContent = 'Ollama is not running yet. Open the Agent tab once and it starts.';
      redraw(); watch();
    })();
  }

  A.swarm = { render };
  if (A.cmd && A.cmd.reg) A.cmd.reg({ title: 'Open the swarm', sub: 'Teams of local models working on one task', icon: '🐝', group: 'Go to', tags: 'swarm team teams workflow agents multi model collaborate build', run: () => { A.showTab('chat'); if (A.agent && A.agent.tab) A.agent.tab('swarm'); } });
})();

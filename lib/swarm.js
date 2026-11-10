// The swarm runner: walks a workflow stage by stage, hands each step to the runner for its type (an agent, a picture,
// music, a voice line, a video), and keeps the state the page shows. One swarm runs at a time. The step runners are
// passed in, so the tests use fakes and this file starts no model and no engine itself.
const fs = require('fs'), path = require('path');
const model = require('./swarm-model'), safeDir = require('./safe-dir');

const NOTES = 'SWARM-NOTES.md';
const TAIL = 20000;          // characters of a step's output that are kept
const LIMIT = 15 * 60000;    // a step's time limit
const bare = n => String(n || '').replace(/:latest$/, '');
const isDir = p => { try { return fs.statSync(p).isDirectory(); } catch (e) { return false; } };

let cur = null, finished = Promise.resolve(), seq = 0;

/* what the page shows: a copy, without the handles the runner keeps */
function status() {
  if (!cur) return { running: false, done: false, stopped: false, stages: [] };
  return {
    running: cur.running, done: cur.done, stopped: cur.stopped, id: cur.id, task: cur.task, dir: cur.dir, workflow: cur.workflow, team: cur.team,
    stages: cur.stages.map(g => ({ name: g.name, steps: g.steps.map(s => ({ member: s.member, model: s.model, type: s.type, state: s.state, seconds: s.state === 'running' ? Math.round((Date.now() - s.started) / 1000) : s.seconds, tail: s.tail, files: s.files, error: s.error })) })),
  };
}

function notesTail(dir, n) { try { return fs.readFileSync(path.join(dir, NOTES), 'utf8').slice(-n); } catch (e) { return ''; } }
function addNote(dir, who, mdl, text) { try { fs.appendFileSync(path.join(dir, NOTES), '\n## ' + who + ' (' + bare(mdl) + ')\n\n' + String(text || '(nothing said)').slice(-4000).trim() + '\n'); } catch (e) { } }

/* one step: its runner, a time limit, and one more try if it fails */
async function runStep(run, step, vars, runners, limitMs) {
  const m = run.members[step.def.member];
  const instruction = (m.prompt ? m.prompt.trim() + '\n\n' : '') + model.fill(step.def.instruction, vars) +
    '\n\nYou are ' + m.name + ', one of several helpers on this job. The file ' + NOTES + ' in this folder says what the others have done.';
  step.state = 'running'; step.started = Date.now();
  let res = null;
  for (let attempt = 0; attempt < 2 && !run.stopped; attempt++) {
    const ac = new AbortController(); let late = false; step.abort = () => ac.abort();
    const timer = setTimeout(() => { late = true; ac.abort(); }, limitMs);
    try {
      res = await Promise.race([
        Promise.resolve(runners[step.type]({ dir: run.dir, member: m, instruction, signal: ac.signal, stage: step.stage, n: step.n })),
        new Promise(done => ac.signal.addEventListener('abort', () => setTimeout(() => done({ ok: false, output: '', files: [], error: late ? 'This step took too long and was stopped (the time limit is ' + Math.round(limitMs / 60000) + ' minutes).' : 'Stopped.' }), 25))),
      ]);
    } catch (e) { res = { ok: false, output: '', files: [], error: String(e && e.message || e) }; }
    clearTimeout(timer); step.abort = null;
    res = res || { ok: false, output: '', files: [], error: 'The step gave nothing back.' };
    if (res.ok || late || (res.refused && res.refused.length)) break;
  }
  step.seconds = Math.round((Date.now() - step.started) / 1000);
  step.tail = String(res.output || '').slice(-TAIL);
  step.files = Array.isArray(res.files) ? res.files.slice(0, 50) : [];
  const refused = Array.isArray(res.refused) ? res.refused : [];
  if (run.stopped) { step.state = 'failed'; step.error = 'Stopped.'; }
  else if (refused.length && !step.files.length) { step.state = 'refused'; step.error = 'The guard refused a command: ' + refused[0].slice(0, 300) + ' Use the Agent tab for work that needs your approval.'; }
  else if (!res.ok) { step.state = 'failed'; step.error = String(res.error || 'The step failed.').slice(0, 500); }
  else step.state = 'done';
  addNote(run.dir, m.name, m.model, step.state === 'done' ? res.output : step.error);
  return res;
}

async function go(run, team, workflow, runners, limitMs) {
  let previous = '';
  for (let i = 0; i < run.stages.length && !run.stopped; i++) {
    const outs = [];
    for (const batch of model.batches(workflow.stages[i], team)) {
      if (run.stopped) break;
      const steps = batch.map(def => run.stages[i].steps.find(s => s.def === def));
      const vars = { task: run.task, notes: notesTail(run.dir, 6000), previous };
      const results = await Promise.all(steps.map(s => runStep(run, s, vars, runners, limitMs)));
      results.forEach((r, k) => { if (steps[k].state === 'done') outs.push(steps[k].member + ' said:\n' + String(r.output || '').slice(-3000)); });
    }
    previous = outs.join('\n\n');
  }
  run.running = false; run.done = !run.stopped;
}

/* Starts a run and returns at once; the page follows it through status().
   Everything from the page is checked first: the task, the folder, the team against the models Ollama has now,
   the workflow against the team, and that every step type has an engine. */
function start(o) {
  const a = o || {}, bad = error => ({ ok: false, error });
  if (cur && cur.running) return bad('A swarm is already running. Stop it or wait for it to finish.');
  const task = String(a.task || '').trim();
  if (!task) return bad('Type the task first.');
  if (task.length > 8000) return bad('The task is too long (8,000 characters at most).');
  const sd = safeDir.check(a.dir); if (!sd.ok) return sd;
  const dir = sd.dir;
  const t = model.checkTeam(a.team, a.models); if (!t.ok) return t;
  const w = model.checkWorkflow(a.workflow, a.team); if (!w.ok) return w;
  const runners = a.runners || {};
  for (const g of a.workflow.stages) for (const s of g.steps) if (typeof runners[s.type] !== 'function') return bad('This PC has no engine for a ' + s.type + ' step.');
  const members = {}; a.team.members.forEach(m => { members[m.id] = m; });
  const run = {
    id: 'run' + (++seq) + '-' + Date.now(), task, dir, running: true, done: false, stopped: false, members, workflow: a.workflow.name, team: a.team.name,
    stages: a.workflow.stages.map((g, i) => ({ name: g.name, steps: g.steps.map((def, n) => ({ def, stage: i + 1, n: n + 1, member: members[def.member].name, model: bare(members[def.member].model), type: def.type, state: 'waiting', seconds: 0, tail: '', files: [], error: '' })) })),
  };
  try { fs.appendFileSync(path.join(dir, NOTES), '\n# Swarm run: ' + a.workflow.name + '\n\nThe task: ' + task + '\n'); } catch (e) { return bad('The swarm cannot write in that folder.'); }
  cur = run;
  finished = go(run, a.team, a.workflow, runners, a.limitMs > 0 ? a.limitMs : LIMIT).catch(e => { run.running = false; run.error = String(e && e.message || e); });
  return { ok: true, id: run.id };
}

/* stops the step that is running; the steps after it never start */
function stop() {
  if (!cur || !cur.running) return { ok: false, error: 'No swarm is running.' };
  cur.stopped = true;
  cur.stages.forEach(g => g.steps.forEach(s => { if (s.abort) { try { s.abort(); } catch (e) { } } }));
  return { ok: true };
}

/* ---- the step runners a real run uses ----
   An agent step is one headless agent run. A picture, music, voice or video step is two things: the member's model
   writes one line saying what to make, then the engine makes it and saves it in the project's assets folder. */
const INSTALL = { image: 'install-art-model.ps1', music: 'install-music-model.ps1', video: 'install-video-model.ps1', voice: 'setup.ps1' };
const EXT = { image: '.png', music: '.wav', voice: '.wav', video: '.webm' };
const WHAT = { image: 'the description of the picture', music: 'the description of the music', voice: 'the words to be spoken', video: 'the description of a short video clip: what is seen and how it moves' };
function runners(agentLib, media, models) {
  const head = (ctx, prompt) => agentLib.runHeadless({ dir: ctx.dir, model: ctx.member.model, prompt, signal: ctx.signal }, models);
  /* A small model often prints its code in the reply and saves nothing. When a step made no file but its reply holds
     a code block, it is told once to save that code with the Write tool; the reply is handed back so nothing is lost. */
  const agent = async ctx => {
    const r = await head(ctx, ctx.instruction);
    if (!r.ok || (r.files && r.files.length) || !/```/.test(String(r.output || '')) || (ctx.signal && ctx.signal.aborted)) return r;
    const again = await head(ctx, 'You wrote the code below in your reply, but no file was saved. Code in a reply is lost.\n' +
      'Use the Write tool now to save each code block into its file, with the file name the task or PLAN.md gives. Then say which files you saved.\n\n' +
      'The job was:\n' + String(ctx.instruction).slice(0, 3000) + '\n\nYour reply was:\n' + String(r.output).slice(-24000));
    return again.ok && again.files && again.files.length ? again : r;
  };
  const made = kind => async ctx => {
    if (!media.ready()[kind]) return { ok: false, output: '', files: [], error: 'This PC has no engine for a ' + kind + ' step. Run ' + INSTALL[kind] + ' in the Moundshroud folder.' };
    const asked = await agentLib.runHeadless({ dir: ctx.dir, model: ctx.member.model, signal: ctx.signal, prompt: ctx.instruction + '\n\nDo not use any tool. Reply with one line only: ' + WHAT[kind] + '.' }, models);
    if (!asked.ok) return asked;
    const said = String(asked.output || '').split(/\r?\n/).map(l => l.trim().replace(/^["'`*]+|["'`*]+$/g, '').trim()).filter(Boolean).pop() || '';
    if (!said) return { ok: false, output: '', files: [], error: ctx.member.name + ' did not say what to make.' };
    const assets = path.join(ctx.dir, 'assets'), name = (+ctx.stage || 0) + '-' + String(ctx.member.id).replace(/[^A-Za-z0-9_-]+/g, '').slice(0, 40) + '-' + (+ctx.n || 0) + EXT[kind];
    try { fs.mkdirSync(assets, { recursive: true }); } catch (e) { return { ok: false, output: '', files: [], error: 'The assets folder could not be made.' }; }
    const out = path.join(assets, name);
    const r = kind === 'voice' ? await media.voice({ text: said, voice: media.voices()[0], out }) : await media[kind]({ prompt: said, out, signal: ctx.signal });
    if (!r.ok) return { ok: false, output: said, files: [], error: r.error };
    return { ok: true, output: 'Made ' + path.join('assets', name) + ' from: ' + said, files: [path.join('assets', name)] };
  };
  return { agent, image: made('image'), music: made('music'), voice: made('voice'), video: made('video') };
}

module.exports = { start, stop, status, runners, wait: () => finished, NOTES, TAIL, LIMIT };

// Teams and workflows for swarms: what is saved, what counts as valid, the starters a new install gets,
// and the rule for which steps of a stage may run together. No model and no engine is touched here.
const fs = require('fs'), path = require('path');

const STEP_TYPES = ['agent', 'image', 'music', 'voice', 'video'];
const MAX_WORDS = 200;      // a small model loses track of a long role prompt
const MAX_TOGETHER = 2;     // steps that may run at once, and only when they share a model

const ROLES = {
  planner: { label: 'Planner', prompt: 'You are the planner. Read the task and write a short, numbered plan: the files to create, what each one does, and the order to build them. Keep it small enough to finish. Do not write the code yourself.' },
  builder: { label: 'Builder', prompt: 'You are a builder. Read the plan in the notes, then create or edit the files for your part. Write complete, working files. Do not leave placeholders. Save every file with the Write tool: code that is only in your reply is lost. Say which files you made.' },
  reviewer: { label: 'Reviewer', prompt: 'You are the reviewer. Read the files the builders made. Look for bugs, missing parts and anything the task asked for that is not there. Fix small problems yourself and list what you changed.' },
  tester: { label: 'Tester', prompt: 'You are the tester. Check that the files load without errors, using node --check for JavaScript. Report each problem with its file name, then fix what you can.' },
  artist: { label: 'Artist', prompt: 'You are the artist. Describe one picture in a single line: subject, style, colours, lighting. No names of real people.' },
  composer: { label: 'Composer', prompt: 'You are the composer. Describe one piece of music in a single line: mood, instruments, tempo.' },
};

const bare = n => String(n || '').replace(/:latest$/, '');
const words = s => String(s || '').trim().split(/\s+/).filter(Boolean).length;
const text = (s, n) => typeof s === 'string' && s.trim().length > 0 && s.length <= n;
const bad = error => ({ ok: false, error });

/* a team: at least one member, each with its own id, a known role and a model that Ollama has and that can use tools */
function checkTeam(team, models) {
  if (!team || !text(team.id, 60) || !text(team.name, 80)) return bad('A team needs a name.');
  const ms = Array.isArray(team.members) ? team.members : [];
  if (!ms.length) return bad('The team "' + team.name + '" has no members.');
  if (ms.length > 12) return bad('A team can have 12 members at most.');
  const seen = new Set();
  for (const m of ms) {
    if (!m || !text(m.id, 60) || !text(m.name, 80)) return bad('Every member of "' + team.name + '" needs a name.');
    if (seen.has(m.id)) return bad('Two members of "' + team.name + '" share the same id.');
    seen.add(m.id);
    if (!ROLES[m.role]) return bad(m.name + ' has a role the app does not know.');
    if (words(m.prompt) > MAX_WORDS) return bad(m.name + "'s role prompt is over " + MAX_WORDS + ' words.');
    const found = (models || []).find(x => bare(x.name) === bare(m.model));
    if (!found) return bad('Ollama does not have the model ' + m.model + ' (' + m.name + ' uses it).');
    if (!found.tools) return bad(bare(found.name) + ' cannot use tools, so ' + m.name + ' cannot use it.');
  }
  return { ok: true };
}

/* a workflow: stages in order, each with steps; every step names a member of its team, a known type and an instruction */
function checkWorkflow(wf, team) {
  if (!wf || !text(wf.id, 60) || !text(wf.name, 80)) return bad('A workflow needs a name.');
  if (!team || wf.teamId !== team.id) return bad('The workflow "' + wf.name + '" has no team.');
  const stages = Array.isArray(wf.stages) ? wf.stages : [];
  if (!stages.length) return bad('The workflow "' + wf.name + '" has no stages.');
  if (stages.length > 12) return bad('A workflow can have 12 stages at most.');
  const ids = new Set((team.members || []).map(m => m.id));
  for (const st of stages) {
    const steps = st && Array.isArray(st.steps) ? st.steps : [];
    if (!st || !text(st.name, 80)) return bad('Every stage of "' + wf.name + '" needs a name.');
    if (!steps.length) return bad('The stage "' + st.name + '" has no steps.');
    if (steps.length > 12) return bad('A stage can have 12 steps at most.');
    for (const s of steps) {
      if (!s || !ids.has(s.member)) return bad('A step in "' + st.name + '" names someone who is not in the team.');
      if (!STEP_TYPES.includes(s.type)) return bad('A step in "' + st.name + '" has a type the app does not know.');
      if (!text(s.instruction, 4000)) return bad('A step in "' + st.name + '" has no instruction.');
    }
  }
  return { ok: true };
}

/* Which steps of one stage run together. Agent steps are grouped by their member's model, in the order the models
   first appear, at most MAX_TOGETHER at once: one loaded model can serve two workers, but two different models do
   not fit in this PC's memory together. A picture, music, voice or video step needs the graphics card to itself,
   so each runs alone, after the agent steps. */
function batches(stage, team) {
  const modelOf = id => bare((((team && team.members) || []).find(m => m.id === id) || {}).model);
  const steps = (stage && stage.steps) || [], order = [], by = {}, out = [];
  for (const s of steps.filter(s => s.type === 'agent' || !s.type)) { const k = modelOf(s.member); if (!by[k]) { by[k] = []; order.push(k); } by[k].push(s); }
  for (const k of order) for (let i = 0; i < by[k].length; i += MAX_TOGETHER) out.push(by[k].slice(i, i + MAX_TOGETHER));
  for (const s of steps.filter(s => s.type && s.type !== 'agent')) out.push([s]);
  return out;
}

/* puts the task, the shared notes and the last stage's output into an instruction; one pass, so text that was
   put in is never itself treated as a placeholder */
function fill(instruction, vars) {
  const v = vars || {};
  return String(instruction || '').replace(/\{(task|notes|previous)\}/g, (m, k) => v[k] == null ? '' : String(v[k]));
}

/* what a new install starts with, built from the models this PC has */
function starters(models) {
  /* Thinking roles get the largest model of 7 GB or less (anything larger crowds this PC's memory); working roles get
     the smallest model of 4 GB or more (smaller ones lose track of their tools). A model whose agent copy is already
     made wins a tie, so a first run needs no waiting. */
  /* first choice: a copy that is ready, then a model from Ollama's own library (no "name/" in front), then size */
  /* Gemma 4 (e4b) comes before all of them: measured on this PC it fits wholly on the 8 GB graphics card and writes
     about 34 tokens a second, while Qwen 3.5 9b spills onto the processor, writes about 8, and ran past the 15-minute
     step limit in both test runs. */
  const GB = 1073741824, can = (models || []).filter(m => m.tools), pref = m => (bare(m.name) === 'gemma4:e4b' ? 4 : 0) + (m.ready ? 2 : 0) + (/\//.test(m.name) ? 0 : 1);
  const desc = can.slice().sort((a, b) => pref(b) - pref(a) || (b.size || 0) - (a.size || 0)), asc = can.slice().sort((a, b) => pref(b) - pref(a) || (a.size || 0) - (b.size || 0));
  const bigM = desc.find(m => (m.size || 0) <= 7 * GB) || desc[0], smallM = asc.find(m => (m.size || 0) >= 4 * GB) || asc[0];
  const big = bigM ? bigM.name : 'gemma4:e4b', small = smallM ? smallM.name : big, other = (desc.find(m => m.name !== big && (m.size || 0) >= 4 * GB && (m.size || 0) <= 7 * GB) || desc.find(m => m.name !== big) || { name: big }).name;
  const mem = (id, name, role, model) => ({ id, name, role, model, prompt: ROLES[role].prompt });
  const teams = [
    { id: 'core', name: 'Core team', members: [mem('planner', 'Planner', 'planner', big), mem('builder', 'Builder', 'builder', small), mem('reviewer', 'Reviewer', 'reviewer', big)] },
    { id: 'studio', name: 'Game studio', members: [mem('planner', 'Planner', 'planner', big), mem('builder1', 'Builder 1', 'builder', small), mem('builder2', 'Builder 2', 'builder', small), mem('artist', 'Artist', 'artist', small), mem('composer', 'Composer', 'composer', small), mem('tester', 'Tester', 'tester', big)] },
    { id: 'panel', name: 'Panel', members: [mem('first', 'First opinion', 'builder', big), mem('second', 'Second opinion', 'builder', other), mem('judge', 'Judge', 'reviewer', big)] },
  ];
  const step = (member, type, instruction) => ({ member, type, instruction });
  const workflows = [
    { id: 'pbr', name: 'Plan, Build, Review', teamId: 'core', stages: [
      { name: 'Plan', steps: [step('planner', 'agent', 'The task: {task}\n\nWrite the plan into PLAN.md in this folder.')] },
      { name: 'Build', steps: [step('builder', 'agent', 'The task: {task}\n\nRead PLAN.md and build every file it lists.\n\nNotes so far:\n{notes}')] },
      { name: 'Review', steps: [step('reviewer', 'agent', 'The task: {task}\n\nRead PLAN.md and the files in this folder. Fix what is wrong or missing.\n\nNotes so far:\n{notes}')] }] },
    { id: 'jam', name: 'Game jam', teamId: 'studio', stages: [
      { name: 'Plan', steps: [step('planner', 'agent', 'The game to make: {task}\n\nWrite PLAN.md. Split the work into two parts, one for Builder 1 and one for Builder 2, with different files for each. List one picture and one piece of music the game needs.')] },
      { name: 'Build', steps: [
        step('builder1', 'agent', 'The game: {task}\n\nRead PLAN.md and build the part for Builder 1. Touch only your own files.'),
        step('builder2', 'agent', 'The game: {task}\n\nRead PLAN.md and build the part for Builder 2. Touch only your own files.'),
        step('artist', 'image', 'A picture for this game: {task}'),
        step('composer', 'music', 'Background music for this game: {task}')] },
      { name: 'Test', steps: [step('tester', 'agent', 'The game: {task}\n\nCheck every file, make the parts work together, and use the files in the assets folder.\n\nNotes so far:\n{notes}')] }] },
    { id: 'second', name: 'Second opinion', teamId: 'panel', stages: [
      { name: 'Answers', steps: [
        step('first', 'agent', 'The task: {task}\n\nDo it, and save your work in a folder named first.'),
        step('second', 'agent', 'The task: {task}\n\nDo it, and save your work in a folder named second.')] },
      { name: 'Merge', steps: [step('judge', 'agent', 'The task: {task}\n\nTwo attempts are in the folders first and second. Take the best of both and save the finished work in this folder.\n\nWhat they said:\n{previous}')] }] },
  ];
  return { teams, workflows };
}

/* teams.json and workflows.json in the data folder; a missing or damaged file gives the starters back */
function load(dataDir, models) {
  const read = f => { const j = JSON.parse(fs.readFileSync(path.join(dataDir, f), 'utf8')); if (!Array.isArray(j)) throw new Error('not a list'); return j; };
  try { return { teams: read('teams.json'), workflows: read('workflows.json') }; } catch (e) { return starters(models); }
}
function save(dataDir, data) {
  const write = (f, v) => { const p = path.join(dataDir, f), t = p + '.tmp'; fs.writeFileSync(t, JSON.stringify(v, null, 1)); fs.renameSync(t, p); };
  write('teams.json', (data && data.teams) || []); write('workflows.json', (data && data.workflows) || []);
}

module.exports = { ROLES, STEP_TYPES, MAX_WORDS, MAX_TOGETHER, checkTeam, checkWorkflow, batches, fill, starters, load, save };

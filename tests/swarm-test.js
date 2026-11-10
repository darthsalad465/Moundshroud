// Teams and swarms: the shapes that are saved, the rule for which steps may run together, and the runner that
// walks a workflow. The runner is tested with fake step runners, so no model and no engine starts here.
const fs = require('fs'), os = require('os'), path = require('path');

module.exports = async ok => {
  const eq = (name, got, want) => ok(name, got === want, 'got ' + JSON.stringify(got) + ', wanted ' + JSON.stringify(want));
  const M = require(path.join(__dirname, '..', 'lib', 'swarm-model.js'));
  const models = [{ name: 'gemma4:e4b', tools: true, size: 6 }, { name: 'Qwen3.5:9b', tools: true, size: 7 }, { name: 'dolphin3:latest', tools: false, size: 4 }];
  const team = { id: 't1', name: 'Two', members: [
    { id: 'p', name: 'Planner', role: 'planner', model: 'Qwen3.5:9b', prompt: '' },
    { id: 'b1', name: 'Builder 1', role: 'builder', model: 'gemma4:e4b', prompt: '' },
    { id: 'b2', name: 'Builder 2', role: 'builder', model: 'gemma4:e4b', prompt: '' }] };

  /* ---- Task 1: teams, workflows, batching ---- */
  ok('swarm: a good team passes', M.checkTeam(team, models).ok, JSON.stringify(M.checkTeam(team, models)));
  ok('swarm: a model Ollama lacks is named', /made-up/.test(M.checkTeam({ ...team, members: [{ ...team.members[0], model: 'made-up:1b' }] }, models).error || ''));
  ok('swarm: a model without tools is refused', !M.checkTeam({ ...team, members: [{ ...team.members[0], model: 'dolphin3:latest' }] }, models).ok);
  ok('swarm: an empty team is refused', !M.checkTeam({ ...team, members: [] }, models).ok);
  ok('swarm: a role prompt over 200 words is refused', !M.checkTeam({ ...team, members: [{ ...team.members[0], prompt: 'w '.repeat(201) }] }, models).ok);
  ok('swarm: two members cannot share an id', !M.checkTeam({ ...team, members: [team.members[0], team.members[0]] }, models).ok);
  const stage = { name: 'Build', steps: [
    { member: 'b1', type: 'agent', instruction: 'a' }, { member: 'p', type: 'agent', instruction: 'b' },
    { member: 'b2', type: 'agent', instruction: 'c' }, { member: 'b1', type: 'image', instruction: 'd' }] };
  const bs = M.batches(stage, team);
  eq('swarm: same-model agent steps share a batch', bs[0].map(s => s.member).join(','), 'b1,b2');
  eq('swarm: another model waits its turn', bs[1].map(s => s.member).join(','), 'p');
  eq('swarm: a media step runs alone', bs[2].length, 1);
  ok('swarm: a batch holds at most 2 steps', M.batches({ steps: [1, 2, 3].map(() => ({ member: 'b1', type: 'agent', instruction: 'x' })) }, team).every(b => b.length <= 2));
  const wf = steps => ({ id: 'w', name: 'W', teamId: 't1', stages: [{ name: 'S', steps }] });
  ok('swarm: a good workflow passes', M.checkWorkflow(wf([{ member: 'p', type: 'agent', instruction: 'x' }]), team).ok);
  ok('swarm: a step for an unknown member is refused', !M.checkWorkflow(wf([{ member: 'zz', type: 'agent', instruction: 'x' }]), team).ok);
  ok('swarm: an unknown step type is refused', !M.checkWorkflow(wf([{ member: 'p', type: 'email', instruction: 'x' }]), team).ok);
  ok('swarm: a step with no instruction is refused', !M.checkWorkflow(wf([{ member: 'p', type: 'agent', instruction: '  ' }]), team).ok);
  ok('swarm: a workflow with no stages is refused', !M.checkWorkflow({ id: 'w', name: 'W', teamId: 't1', stages: [] }, team).ok);
  eq('swarm: the task is placed in the instruction', M.fill('Do {task} now', { task: 'a $(calc) "quoted" job' }), 'Do a $(calc) "quoted" job now');
  eq('swarm: a missing value becomes empty text', M.fill('[{previous}]', {}), '[]');
  eq('swarm: text put in is not filled a second time', M.fill('{task}', { task: '{notes}', notes: 'SECRET' }), '{notes}');
  const st = M.starters(models);
  eq('swarm: three starter workflows ship', st.workflows.map(w => w.name).join('|'), 'Plan, Build, Review|Game jam|Second opinion');
  ok('swarm: every starter passes its own checks', st.workflows.every(w => M.checkWorkflow(w, st.teams.find(t => t.id === w.teamId)).ok) && st.teams.every(t => M.checkTeam(t, models).ok),
    JSON.stringify(st.workflows.map(w => M.checkWorkflow(w, st.teams.find(t => t.id === w.teamId))).concat(st.teams.map(t => M.checkTeam(t, models)))));
  ok('swarm: starters never pick a model without tools', st.teams.every(t => t.members.every(m => m.model !== 'dolphin3:latest')));
  ok('swarm: every role prompt is 200 words or fewer', Object.values(M.ROLES).every(r => r.prompt.trim().split(/\s+/).length <= 200));
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'swarm-test-'));
  try {
    const first = M.load(tmp, models);
    eq('swarm: with nothing saved the starters appear', first.workflows.length, 3);
    M.save(tmp, { teams: [team], workflows: [wf([{ member: 'p', type: 'agent', instruction: 'x' }])] });
    const back = M.load(tmp, models);
    ok('swarm: a saved team reads back the same', JSON.stringify(back.teams) === JSON.stringify([team]) && back.workflows.length === 1);
    fs.writeFileSync(path.join(tmp, 'teams.json'), '{ not json');
    eq('swarm: a damaged file falls back to the starters', M.load(tmp, models).workflows.length, 3);
  } finally { fs.rmSync(tmp, { recursive: true, force: true }); }

  /* ---- Tasks 4 and 5: the limits the media engines are held to (no engine runs here) ---- */
  const media = require(path.join(__dirname, '..', 'lib', 'media.js'));
  const ci = media.clamp.image({ prompt: 'a cat\nin a hat' + 'x'.repeat(900), w: 100, h: 5000, steps: 99 });
  eq('media: a small picture width becomes 256', ci.w, 256);
  eq('media: a large picture height becomes 768', ci.h, 768);
  eq('media: 500 wide becomes 512', media.clamp.image({ prompt: 'x', w: 500 }).w, 512);
  eq('media: picture steps stop at 6', ci.steps, 6);
  ok('media: a prompt becomes one line of 400 characters at most', !/\n/.test(ci.prompt) && ci.prompt.length === 400);
  eq('media: music stops at 30 seconds', media.clamp.music({ prompt: 'x', seconds: 99 }).seconds, 30);
  eq('media: music starts at 5 seconds', media.clamp.music({ prompt: 'x', seconds: 1 }).seconds, 5);
  const cv = media.clamp.video({ prompt: 'x', w: 5000, h: 10, frames: 100 });
  ok('media: a video is 832 by 480 at most', cv.w === 832 && media.clamp.video({ prompt: 'x', h: 5000 }).h === 480, JSON.stringify(cv));
  ok('media: ...and 256 by 144 at least', media.clamp.video({ prompt: 'x', w: 1 }).w === 256 && cv.h === 144);
  ok('media: video sizes are multiples of 16', [media.clamp.video({ prompt: 'x', w: 417, h: 241 })].every(v => v.w % 16 === 0 && v.h % 16 === 0));
  eq('media: a video has 33 frames at most', cv.frames, 33);
  ok('media: the frame count has the form 4n+1', [5, 6, 7, 8, 18, 30].every(f => (media.clamp.video({ prompt: 'x', frames: f }).frames - 1) % 4 === 0));
  const va = media.videoArgs(media.clamp.video({ prompt: 'a fox', w: 416, h: 240, frames: 17, seed: 7 }), 'out.webm');
  const pair = (k, v) => { const i = va.indexOf(k); return i >= 0 && (v === undefined || va[i + 1] === v); };
  ok('media: the video engine is run in video mode', pair('-M', 'vid_gen'), va.join(' '));
  ok('media: ...with the model, its picture decoder and its text reader', pair('--diffusion-model') && pair('--vae') && pair('--t5xxl'));
  ok('media: ...with the settings the Wan notes give', pair('--flow-shift', '3.0') && pair('--cfg-scale', '6.0') && pair('--sampling-method', 'euler') && pair('--fps', '16'));
  ok('media: ...and the two memory savers', va.includes('--vae-tiling') && va.includes('--offload-to-cpu'));
  ok('media: ...at the size asked for', pair('-W', '416') && pair('-H', '240') && pair('--video-frames', '17') && pair('-o', 'out.webm') && pair('-p', 'a fox'));
  const rd = media.ready();
  ok('media: ready() answers for all four engines', ['image', 'music', 'voice', 'video'].every(k => typeof rd[k] === 'boolean'), JSON.stringify(rd));

  /* ---- Task 6: the step runners a real run uses, with a fake agent and fake engines ---- */
  {
    const SW = require(path.join(__dirname, '..', 'lib', 'swarm.js'));
    const d2 = fs.mkdtempSync(path.join(os.tmpdir(), 'swarm-steps-')), calls = [];
    try {
      const fakeAgent = { runHeadless: async (o) => { calls.push({ agent: o }); return { ok: true, output: 'Thinking...\n"a red fox in snow, oil painting"\n', files: ['x.js'], refused: [] }; } };
      const made = kind => async o => { calls.push({ [kind]: o }); if (o.out) fs.writeFileSync(o.out, 'data'); return { ok: true, file: o.out, seed: 1 }; };
      const fakeMedia = { image: made('image'), music: made('music'), video: made('video'), voice: made('voice'), voices: () => ['amy'], ready: () => ({ image: true, music: true, voice: true, video: false }) };
      const R = SW.runners(fakeAgent, fakeMedia, models), member = { id: 'art', name: 'Artist', model: 'gemma4:e4b' };
      const ctx = { dir: d2, member, instruction: 'A picture for the game', signal: null, stage: 2, n: 3 };
      const a = await R.agent(ctx);
      ok('steps: an agent step hands the instruction to the member\'s model', a.ok && calls[0].agent.model === 'gemma4:e4b' && calls[0].agent.prompt === 'A picture for the game' && calls[0].agent.dir === d2);
      /* a small model often prints its code in the reply and saves nothing: it is told once to save it */
      let n = 0; const printer = { runHeadless: async o => { n++; calls.push({ agent: o }); return n === 1 ? { ok: true, output: 'Here it is:\n```html\n<html></html>\n```', files: [], refused: [] } : { ok: true, output: 'Saved snake.html', files: ['snake.html'], refused: [] }; } };
      calls.length = 0; const saved = await SW.runners(printer, fakeMedia, models).agent(ctx);
      ok('steps: a helper that printed code without saving it is asked once to save it', n === 2 && saved.files[0] === 'snake.html' && /Write tool/.test(calls[1].agent.prompt) && calls[1].agent.prompt.includes('<html></html>'), JSON.stringify({ n, saved }).slice(0, 200));
      n = 0; const talker = { runHeadless: async () => { n++; return { ok: true, output: 'The plan looks fine.', files: [], refused: [] }; } };
      await SW.runners(talker, fakeMedia, models).agent(ctx);
      eq('steps: a helper that only talked is not asked again', n, 1);
      calls.length = 0; const i = await R.image(ctx);
      ok('steps: a picture step first asks the model for a one-line description', calls[0].agent && /one line/i.test(calls[0].agent.prompt), JSON.stringify(calls[0]).slice(0, 200));
      eq('steps: ...and draws that line, without its quotes', calls[1].image.prompt, 'a red fox in snow, oil painting');
      eq('steps: the picture lands in the assets folder under a plain name', path.relative(d2, calls[1].image.out), path.join('assets', '2-art-3.png'));
      ok('steps: the step reports the file it made', i.ok && i.files.length === 1 && i.files[0] === path.join('assets', '2-art-3.png') && fs.existsSync(path.join(d2, i.files[0])), JSON.stringify(i));
      calls.length = 0; await R.music(ctx); ok('steps: music is a .wav', /2-art-3\.wav$/.test(calls[1].music.out));
      calls.length = 0; await R.voice(ctx); ok('steps: a voice line is a .wav spoken by an installed voice', /2-art-3\.wav$/.test(calls[1].voice.out) && calls[1].voice.voice === 'amy' && calls[1].voice.text === 'a red fox in snow, oil painting');
      calls.length = 0; const v = await R.video(ctx);
      ok('steps: a step whose engine is missing says which script installs it', !v.ok && /install-video-model\.ps1/.test(v.error) && calls.length === 0, JSON.stringify(v));
      const R2 = SW.runners({ runHeadless: async () => ({ ok: true, output: '   \n', files: [], refused: [] }) }, fakeMedia, models);
      ok('steps: a model that says nothing fails the step', !(await R2.image(ctx)).ok);
      const weird = { ...ctx, member: { ...member, id: '..\\..\\evil' } };
      calls.length = 0; await R.image(weird);
      ok('steps: a member id can never move the file out of assets', path.dirname(calls[1].image.out) === path.join(d2, 'assets'), calls[1].image.out);
    } finally { fs.rmSync(d2, { recursive: true, force: true }); }
  }

  /* ---- Task 2: the runner, with fake step runners ---- */
  const S = require(path.join(__dirname, '..', 'lib', 'swarm.js'));
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'swarm-run-'));
  const sleep = ms => new Promise(r => setTimeout(r, ms));
  try {
    const log = [];
    /* a fake agent: records when it started and ended, then answers with the instruction's first line */
    const fake = (ms, result) => async ctx => { log.push({ ev: 'start', who: ctx.member.id, t: Date.now(), text: ctx.instruction }); await sleep(ms); log.push({ ev: 'end', who: ctx.member.id, t: Date.now() }); return result ? result(ctx) : { ok: true, output: 'out of ' + ctx.member.id, files: [] }; };
    const at = (who, ev) => (log.find(l => l.who === who && l.ev === ev) || {}).t;
    const flow = { id: 'w', name: 'W', teamId: 't1', stages: [
      { name: 'Plan', steps: [{ member: 'p', type: 'agent', instruction: 'Plan {task}' }] },
      { name: 'Build', steps: [{ member: 'b1', type: 'agent', instruction: 'Build. Before: {previous}' }, { member: 'b2', type: 'agent', instruction: 'Build too' }, { member: 'p', type: 'agent', instruction: 'Watch' }] }] };
    const base = { task: 'a $(calc) "job"', dir, team, workflow: flow, models };

    let r = S.start({ ...base, runners: { agent: fake(40) } });
    ok('runner: a good run starts', r.ok && !!r.id, JSON.stringify(r));
    const again = S.start({ ...base, runners: { agent: fake(1) } });
    ok('runner: a second start is refused while one runs', !again.ok && /already running/.test(again.error), JSON.stringify(again));
    await S.wait();
    let s = S.status();
    ok('runner: the run finishes', s.done && !s.running && !s.stopped, JSON.stringify(s).slice(0, 200));
    ok('runner: every step is marked done', s.stages.every(g => g.steps.every(x => x.state === 'done')), JSON.stringify(s.stages.map(g => g.steps.map(x => x.state))));
    ok('runner: the second stage waits for the first', at('b1', 'start') >= log.filter(l => l.who === 'p' && l.ev === 'end')[0].t);
    ok('runner: two steps on one model overlap', at('b2', 'start') < at('b1', 'end'), JSON.stringify(log.map(l => [l.who, l.ev])));
    const p2start = log.filter(l => l.who === 'p' && l.ev === 'start')[1].t;
    ok('runner: another model waits for them', p2start >= at('b1', 'end') && p2start >= at('b2', 'end'));
    ok('runner: the task reaches the step unchanged', log[0].text.includes('Plan a $(calc) "job"'), log[0].text);
    ok('runner: the role prompt comes with it', log[0].text.includes(M.ROLES.planner.prompt) || log[0].text.includes('Planner'), log[0].text.slice(0, 120));
    ok('runner: the next stage gets what the last one said', log.find(l => l.who === 'b1').text.includes('out of p'));
    const notes = fs.readFileSync(path.join(dir, S.NOTES), 'utf8');
    ok('runner: the notes file has a section for each step', ['Planner', 'Builder 1', 'Builder 2'].every(n => notes.includes('## ' + n)), notes.slice(0, 200));

    /* a step that never ends */
    let aborted = false;
    r = S.start({ ...base, workflow: { ...flow, stages: [flow.stages[0]] }, limitMs: 50, runners: { agent: ctx => new Promise(() => { ctx.signal.addEventListener('abort', () => { aborted = true; }); }) } });
    await S.wait(); s = S.status();
    ok('runner: a step over its time limit fails', s.stages[0].steps[0].state === 'failed' && /too long|time/i.test(s.stages[0].steps[0].error), JSON.stringify(s.stages[0].steps[0]));
    ok('runner: ...and is told to stop', aborted);

    /* a step that fails is tried once more, then the run goes on */
    let tries = 0;
    r = S.start({ ...base, runners: { agent: async ctx => { if (ctx.member.id === 'p') { tries++; return { ok: false, output: '', error: 'broke', files: [] }; } return { ok: true, output: 'fine', files: [] }; } } });
    await S.wait(); s = S.status();
    eq('runner: a failing step runs exactly twice', tries, 4);   // the planner has a step in each of the two stages
    ok('runner: the run carries on after a failure', s.stages[1].steps.some(x => x.state === 'done') && s.stages[0].steps[0].state === 'failed');

    /* a command the guard refused */
    r = S.start({ ...base, workflow: { ...flow, stages: [flow.stages[0]] }, runners: { agent: async () => ({ ok: true, output: 'no', files: [], refused: ['Permission to use Bash with command rm -rf x has been denied.'] }) } });
    await S.wait(); s = S.status();
    eq('runner: a refused command is shown as refused', s.stages[0].steps[0].state, 'refused');

    /* long output */
    r = S.start({ ...base, workflow: { ...flow, stages: [flow.stages[0]] }, runners: { agent: async () => ({ ok: true, output: 'x'.repeat(1000000), files: [] }) } });
    await S.wait(); s = S.status();
    ok('runner: long output is cut to its last 20,000 characters', s.stages[0].steps[0].tail.length <= 20000 && s.stages[0].steps[0].tail.length > 0);
    ok('runner: ...and the notes file stays small', fs.statSync(path.join(dir, S.NOTES)).size < 200000);

    /* stop */
    r = S.start({ ...base, runners: { agent: ctx => new Promise(res => { ctx.signal.addEventListener('abort', () => res({ ok: false, output: '', files: [] })); }) } });
    await sleep(20); S.stop(); await S.wait(); s = S.status();
    ok('runner: stop ends the run', s.stopped && !s.running);
    ok('runner: ...and later steps never start', s.stages[1].steps.every(x => x.state === 'waiting'), JSON.stringify(s.stages.map(g => g.steps.map(x => x.state))));

    /* what start refuses */
    const no = (name, over) => { const x = S.start({ ...base, runners: { agent: fake(1) }, ...over }); ok('runner: refuses ' + name, !x.ok && !!x.error, JSON.stringify(x)); };
    no('an empty task', { task: '   ' });
    no('a relative folder', { dir: 'some\\folder' });
    no('a folder that is not there', { dir: path.join(dir, 'missing') });
    no('a folder with command characters', { dir: dir + '&calc' });
    no('a team with a model Ollama lacks', { team: { ...team, members: [{ ...team.members[0], model: 'made-up:1b' }, team.members[1], team.members[2]] } });
    no('a step type with no engine', { workflow: { ...flow, stages: [{ name: 'S', steps: [{ member: 'p', type: 'video', instruction: 'x' }] }] } });
    ok('runner: nothing is left running', !S.status().running);
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
};

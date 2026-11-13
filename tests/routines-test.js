// Agent routines (lib/routines.js): the schedule maths, saving, and a whole run with a fake Claude Code process,
// so no model starts here. Also checks that a routine never gets a permission question approved.
const fs = require('fs'), os = require('os'), path = require('path'), { EventEmitter } = require('events');

module.exports = async ok => {
  const R = require(path.join(__dirname, '..', 'lib', 'routines.js')), H = require(path.join(__dirname, '..', 'lib', 'harness.js'));
  const sleep = ms => new Promise(r => setTimeout(r, ms));
  const at = (y, mo, d, h, mi) => new Date(y, mo, d, h, mi).getTime(), when = t => { const d = new Date(t); return [d.getDay(), d.getHours(), d.getMinutes()].join(':'); };
  const fri915 = at(2026, 10, 13, 9, 15);      // a Friday
  ok('routines: every day at 8:00, after 9:15, is tomorrow 8:00', when(R.nextAfter({ kind: 'daily', h: 8, m: 0 }, fri915)) === '6:8:0');
  ok('routines: weekdays at 9:00, on a Friday after 9:00, is Monday', when(R.nextAfter({ kind: 'weekdays', h: 9, m: 0 }, fri915)) === '1:9:0');
  ok('routines: once a week on Sunday at 19:00', when(R.nextAfter({ kind: 'weekly', day: 0, h: 19, m: 0 }, fri915)) === '0:19:0');
  ok('routines: every 4 hours at :30 is 12:30 next', when(R.nextAfter({ kind: 'hours', every: 4, m: 30 }, fri915)) === '5:12:30');
  ok('routines: a time later today is today', when(R.nextAfter({ kind: 'daily', h: 9, m: 30 }, fri915)) === '5:9:30');
  ok('routines: a broken schedule is cleaned up', JSON.stringify(R.sched({ kind: 'x', h: 99, m: -4 })) === JSON.stringify({ kind: 'daily', h: 23, m: 0, day: 1, every: 4 }));
  ok('routines: schedules are described in plain words', R.describe({ kind: 'weekly', day: 6, h: 10, m: 0 }) === 'Every Saturday at 10:00');
  ok('routines: there are six suggestions, each with a prompt and a schedule', R.suggestions().length === 6 && R.suggestions().every(s => s.prompt && s.name && s.sched));

  /* a fake Claude Code: answers one turn, asking for permission once on the way */
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'ms-routines-'));
  let proc = null, busy = false; const saved = [];
  const fake = () => { const p = new EventEmitter(); p.stdout = new EventEmitter(); p.stderr = new EventEmitter(); p.sent = []; p.stdin = { write: s => { const j = JSON.parse(s); p.sent.push(j); if (j.type === 'user') setTimeout(() => { p.out({ type: 'system', subtype: 'init', session_id: '11111111-2222-3333-4444-555555555555' }); p.out({ type: 'control_request', request_id: 'q1', request: { subtype: 'can_use_tool', tool_name: 'Bash', input: { command: 'rm -rf x' } } }); setTimeout(() => { p.out({ type: 'assistant', message: { content: [{ type: 'text', text: 'All 3 files are fine.' }] } }); p.out({ type: 'result', subtype: 'success' }); }, 20); }, 5); return true; }, end() { }, on() { } }; p.pid = 0; p.kill = () => setTimeout(() => p.emit('close', 0), 1); p.out = o => p.stdout.emit('data', JSON.stringify(o) + '\n'); return p; };
  const rt = R.create({ dataDir: dir, noTimer: true, harnessLib: H, store: { save: r => saved.push(r) }, userBusy: () => busy,
    resolve: async () => ({ ok: true, check: { model: 'm', agentModel: 'm-agent', ctx: 32768, guard: '' }, dir }),
    harnessDeps: { spawn: () => (proc = fake()), prepare: async () => ({ ok: true }), kill: p => p.kill() } });
  ok('routines: a routine with no task is refused', !rt.save({ name: 'x', prompt: '  ' }).ok);
  const sv = rt.save({ name: 'Check scripts', prompt: 'Check my scripts', sched: { kind: 'daily', h: 8, m: 0 } });
  ok('routines: a routine is saved', sv.ok && rt.list().routines.length === 1 && rt.list().routines[0].when === 'Every day at 08:00');
  ok('routines: the next run is written for the tray helper', fs.existsSync(path.join(dir, 'routines-next.txt')) && +fs.readFileSync(path.join(dir, 'routines-next.txt'), 'utf8') === rt.list().routines[0].next);

  await rt.run(sv.id); for (let i = 0; i < 50 && rt.busy(); i++) await sleep(20);
  const run = rt.list().runs[0];
  ok('routines: a run finishes and its summary is kept', run && run.ok && run.summary === 'All 3 files are fine.' && !run.seen, JSON.stringify(run));
  ok('routines: the task reaches the agent with a note that nobody is there', proc.sent[0].message.content[0].text.includes('Check my scripts') && /Nobody is at the PC/.test(proc.sent[0].message.content[0].text));
  const answer = proc.sent.find(x => x.type === 'control_response');
  ok('routines: a permission question is refused at once, never allowed', answer && answer.response.response.behavior === 'deny' && /Nobody is at the PC/.test(answer.response.response.message), JSON.stringify(answer));
  ok('routines: the conversation is kept with the routine\'s name on it', saved.some(r => r.routine && r.routine.name === 'Check scripts' && r.title === 'Check scripts'));
  ok('routines: the unread count shows it', rt.list().unread === 1 && (rt.seen(null), rt.list().unread === 0));

  /* scheduling: due, too late, and waiting while you use the agent yourself */
  const D = JSON.parse(fs.readFileSync(path.join(dir, 'agent-routines.json'), 'utf8')); const r0 = rt.list().routines[0];
  const due = R.nextAfter(r0.sched, r0.last);
  busy = true; rt.tick(due + 60000);
  ok('routines: while you are using the agent a due routine waits', !rt.busy() && rt.list().runs.length === 1);
  busy = false; rt.tick(due + 13 * 3600000);
  ok('routines: a run more than 12 hours late is skipped and noted', rt.list().runs[0].skipped === true && !rt.busy());
  rt.remove(sv.id);
  ok('routines: a routine is deleted and nothing is due any more', rt.list().routines.length === 0 && !fs.existsSync(path.join(dir, 'routines-next.txt')));
  try { fs.rmSync(dir, { recursive: true, force: true }); } catch (e) { }
  void D;
};

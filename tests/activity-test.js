// What the app is doing and how long it took (web/js/activity.js), plus the timing and the non-blocking game fix it feeds.
// The module is loaded in a small sandbox; no AI and no browser are needed.
const fs = require('fs'), path = require('path'), vm = require('vm');

module.exports = async ok => {
  const root = path.join(__dirname, '..'), read = f => fs.readFileSync(path.join(root, f), 'utf8'), src = read('web/js/activity.js');
  const store = {};
  const ls = { get: (k, d) => Object.prototype.hasOwnProperty.call(store, k) ? store[k] : d, set: (k, v) => { store[k] = String(v); } };
  const boot = () => {
    const A = { pop: () => ({ classList: { add() { } }, style: {} }), closePop: () => { }, showTab: () => { } };
    const ctx = { A, ls, esc: s => String(s == null ? '' : s), $: () => null, document: { addEventListener() { } }, window: {}, console, setInterval, clearInterval, Date };
    vm.runInNewContext(src, ctx);
    return A.act;
  };
  const act = boot();
  ok('timings: the act clock is there', act && typeof act.begin === 'function' && typeof act.mark === 'function');
  ok('timings: it reads back as ms, seconds and minutes', act.fmt(840) === '840 ms' && act.fmt(4200) === '4.2 s' && act.fmt(47000) === '47 s' && act.fmt(125000) === '2 m 05 s');

  /* a job that runs and finishes: it is on the clock while running, and in the list when done */
  const op = act.begin('Writing the game', { kind: 'game', tab: 'studio' });
  ok('timings: a running job shows in the running list', act.running.length === 1 && act.running[0].label === 'Writing the game');
  op.say('part 1 · 12 kB');
  ok('timings: a job says what it is doing right now', op.phase === 'part 1 · 12 kB');
  await new Promise(r => setTimeout(r, 25));
  op.end(true, 'done');
  const e = act.log[act.log.length - 1];
  ok('timings: a finished job is timed and says how it ended', e && e.label === 'Writing the game' && e.ms >= 20 && e.ok && /part 1/.test(e.note));
  ok('timings: a running job is not in the list twice', act.running.length === 0 && act.log.filter(x => x.label === 'Writing the game').length === 1);
  op.end();
  ok('timings: ending a job twice does not record it twice', act.log.filter(x => x.label === 'Writing the game').length === 1);

  act.mark('net', 'GET status', 320, { ok: false, note: 'HTTP 500' });
  const n = act.log[act.log.length - 1];
  ok('timings: one-off work is recorded with its outcome', n.kind === 'net' && n.ms === 320 && n.ok === false && n.note === 'HTTP 500');
  act.mark('page', 'Opened Chat', 61);
  ok('timings: a page opening is recorded too', act.log[act.log.length - 1].kind === 'page');

  /* the list is kept between visits, so "how long did that take" survives a reload */
  const again = boot();
  ok('timings: the list is kept after a reload', again.log.length >= 3 && again.log.some(x => x.label === 'Writing the game'));
  again.clear();
  ok('timings: the list can be cleared', again.log.length === 0);

  /* ---------- where it is wired in ---------- */
  const html = read('web/index.html'), chat = read('web/js/chat.js'), gm = read('web/js/studio-games.js'), core = read('web/js/core.js');
  ok('timings: the ⏱ button is in the top bar on the served page', /id="act"/.test(html) && /web\/js\/activity\.js/.test(html));
  ok('timings: the activity module is loaded after the helpers it uses', html.indexOf('/web/js/core.js') < html.indexOf('/web/js/activity.js'));

  /* chat: how long it thought, and how long the last reply took */
  ok('chat timing: a reply keeps its own time and its thinking time', /ms: m\.ms, thinkMs: m\.thinkMs/.test(chat) && /am\.ms = Date\.now\(\) - t0/.test(chat) && /am\.thinkMs = tFirst - t0/.test(chat));
  ok('chat timing: the time shows under the reply', /function timeHtml\(m\)/.test(chat) && /timeHtml\(m\)/.test(chat));
  ok('chat timing: the last reply time stays on screen after a reload', /id="lasttime"/.test(html) && /last reply /.test(chat));
  ok('chat timing: the waiting words count the seconds', /liveT = setInterval/.test(chat) && /waitHtml\(curWait \+ ' ' \+ s\)/.test(chat));
  ok('chat timing: the reply is on the ⏱ list', /A\.act\.begin\('Answering in Chat'/.test(chat) && /op\.end\(ok/.test(chat));

  /* the game maker: the AI works in the background and the game is never taken away */
  ok('game maker: playing, restarting, the code and saving stay enabled while the AI works', /forEach\(id => \$\(id\)\.disabled = !has\); \$?\('?gmedit/.test(gm) && !/\$\(id\)\.disabled = !has \|\| busy/.test(gm));
  ok('game maker: there is a box for the code as the AI writes it', /id="gmlive"/.test(gm) && /liveAdd\(/.test(gm));
  ok('game maker: the game error is shown beside the game, not over it', /id="gmerr"/.test(gm) && /box\.innerHTML = '<div class="gmk-msg gmk-err">/.test(gm));
  ok('game maker: a bug does not silence the game while the AI works', !/e\.data\.gmErr \|\| busy\) return/.test(gm));
  ok('game maker: the AI is asked to change only what is needed', /Change only what this needs/.test(gm));
  ok('game maker: you are told how much of the game actually changed', /lines changed \(' \+ st\.add/.test(gm));
  ok('game maker: a failure leaves the game untouched and says so', /Your game was not touched/.test(gm));
  ok('game maker: the fix is on the ⏱ list and jumps back to the game maker', /A\.act\.begin\(kind === 'new' \? 'Writing a game' : 'Fixing the game'/.test(gm) && /A\.studio\.go\('games'\)/.test(gm));

  /* the app's own calls are timed, so the list shows what is slow */
  ok('timings: slow app requests are recorded', /A\.act\.mark\('net'/.test(core) && /ms >= 100/.test(core));
  ok('timings: a page opening is timed to after it is painted, and never left waiting on a hidden window', /A\.act\.mark\('page'/.test(core) && /requestAnimationFrame\(\(\) => setTimeout\(fin, 0\)\)/.test(core) && /setTimeout\(fin, 1200\)/.test(core));
};

// OpenWhip (GitFrog1111/OpenWhip integration): tests the shared phrase & turbo core,
// Moundshroud Code native harness whip() / setTurbo() / goal preservation / mid-turn interrupt,
// server endpoints, terminal CLI wiring, and universal browser chat UI integration.
const fs = require('fs');
const os = require('os');
const path = require('path');

async function run(ok) {
  const root = path.join(__dirname, '..');
  const openwhip = require(path.join(root, 'lib', 'openwhip.js'));
  const N = require(path.join(root, 'lib', 'harness-native.js'));

  /* ---- 1. Core phrases & helpers ---- */
  ok('openwhip: exports classic GitFrog1111/OpenWhip phrases & Turbo directive',
    Array.isArray(openwhip.PHRASES) &&
    openwhip.PHRASES.includes('FASTER') &&
    openwhip.PHRASES.includes('Faster CLANKER') &&
    openwhip.PHRASES.includes('Speed it up clanker') &&
    /OPENWHIP TURBO MODE/.test(openwhip.TURBO_DIRECTIVE));

  ok('openwhip: pickPhrase returns non-empty phrase and respects custom phrase',
    openwhip.PHRASES.includes(openwhip.pickPhrase()) &&
    openwhip.pickPhrase('GO GO GO') === 'GO GO GO');

  ok('openwhip: isWhipText recognizes whip phrases and rejects real coding goals',
    openwhip.isWhipText('FASTER') &&
    openwhip.isWhipText('Faster CLANKER') &&
    openwhip.isWhipText('Speed it up clanker') &&
    !openwhip.isWhipText('Build a web server in Express with SQLite'));

  ok('openwhip: asciiFrames returns terminal crack frames',
    Array.isArray(openwhip.asciiFrames()) && openwhip.asciiFrames().length >= 3);

  /* ---- 2. Moundshroud Code native harness: whip() + Turbo + goal preservation + mid-turn interrupt ---- */
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'ow-test-'));
  const seenPrompts = [];
  const seenThink = [];
  let callNum = 0;
  let releaseSlow = null;

  const H = N.create({
    dataDir: dir,
    prepare: async () => ({ ok: true }),
    ask: async (msgs, tools, opts) => {
      callNum++;
      const sys = (msgs.find(m => m.role === 'system') || {}).content || '';
      seenPrompts.push(sys);
      seenThink.push(opts && opts.think);
      if (callNum === 1) {
        // Simulate a slow turn that gets interrupted mid-flight by whip()
        await new Promise(resolve => { releaseSlow = resolve; });
        return { ok: true, text: 'slow aborted answer', calls: [] };
      }
      return { ok: true, text: 'Done fast!', calls: [] };
    },
  });

  const started = await H.start({ check: { model: 'm', agentModel: 'm', ctx: 32768, guard: false }, dir });
  ok('openwhip harness: native Moundshroud Code session starts cleanly', started.ok && H.state(0).running);

  // Enable thinking first so we verify whip() turns it OFF for speed
  H.setThink(true);
  ok('openwhip harness: starts with turbo=false and think=true', !H.state(0).turbo && H.state(0).think);

  // Send a real coding goal that hangs on call #1
  H.send('Implement binary search in search.js');
  for (let i = 0; i < 40 && !releaseSlow; i++) await new Promise(r => setTimeout(r, 10));
  ok('openwhip harness: first turn is busy mid-flight before whip', H.state(0).busy && !!releaseSlow);

  // Crack the whip mid-turn!
  const wRes = H.whip('Faster CLANKER');
  // Release the old slow promise so there are no hanging timers
  if (releaseSlow) releaseSlow();

  // Wait for the whipped turn to finish
  for (let i = 0; i < 200 && H.state(0).busy; i++) await new Promise(r => setTimeout(r, 10));

  const stAfter = H.state(0);
  ok('openwhip harness: whip() interrupts slow turn, engages Turbo, disables slow thinking, and sends phrase',
    wRes.ok && wRes.sent && wRes.turbo === true && wRes.whipCount === 1 && wRes.phrase === 'Faster CLANKER' &&
    stAfter.turbo === true && stAfter.think === false && stAfter.whipCount === 1,
    JSON.stringify({ wRes, turbo: stAfter.turbo, think: stAfter.think, whipCount: stAfter.whipCount }));

  ok('openwhip harness: system prompt on whipped turn includes OPENWHIP TURBO MODE directive',
    seenPrompts.length >= 2 && /OPENWHIP TURBO MODE/.test(seenPrompts[seenPrompts.length - 1]),
    'prompts=' + seenPrompts.length);

  ok('openwhip harness: whip emits crack note, sends phrase, and receives fast completion',
    stAfter.events.some(e => e.kind === 'note' && /CRACK/i.test(e.text)) &&
    stAfter.events.some(e => e.kind === 'user' && /Faster CLANKER/.test(e.text)) &&
    stAfter.events.some(e => (e.kind === 'text' || e.kind === 'assistant') && /Done fast!/.test(e.text)),
    JSON.stringify(stAfter.events.map(e => ({ kind: e.kind, text: String(e.text || '').slice(0, 40) }))));

  const offRes = H.setTurbo(false);
  ok('openwhip harness: setTurbo(false) cleanly disables Turbo mode',
    offRes.ok && offRes.turbo === false && H.state(0).turbo === false);

  try { fs.rmSync(dir, { recursive: true, force: true }); } catch (e) { }

  /* ---- 3. Server API + Terminal CLI + All-Chat Browser Integration Checks ---- */
  const serverSrc = fs.readFileSync(path.join(root, 'server.js'), 'utf8');
  ok('openwhip server: exposes POST /api/harness/whip and turbo control command',
    serverSrc.includes("url === '/api/harness/whip'") &&
    serverSrc.includes("cmd === 'turbo'"));

  const cliSrc = fs.readFileSync(path.join(root, 'lib', 'moundshroud-code.js'), 'utf8');
  ok('openwhip CLI: Moundshroud Code terminal supports /whip, Alt+W, and F6',
    cliSrc.includes("require('./openwhip')") &&
    cliSrc.includes('function crackWhip') &&
    cliSrc.includes("cmd === '/whip'") &&
    cliSrc.includes("key.meta && key.name === 'w'") &&
    cliSrc.includes("key.name === 'f6'"));

  const webWhipSrc = fs.readFileSync(path.join(root, 'web', 'js', 'openwhip.js'), 'utf8');
  const agentSrc = fs.readFileSync(path.join(root, 'web', 'js', 'agent.js'), 'utf8');
  const chatSrc = fs.readFileSync(path.join(root, 'web', 'js', 'chat.js'), 'utf8');
  const htmlSrc = fs.readFileSync(path.join(root, 'web', 'index.html'), 'utf8');

  ok('openwhip UI: web/js/openwhip.js implements physics whip canvas, WebAudio crack, /api/chat Turbo interceptor, and Alt+W',
    webWhipSrc.includes('A.openwhip') &&
    webWhipSrc.includes('playCrackSound') &&
    webWhipSrc.includes('playVisualWhip') &&
    webWhipSrc.includes('installFetchTurbo') &&
    webWhipSrc.includes('/api/harness/whip') &&
    webWhipSrc.includes('openwhip-float') &&
    webWhipSrc.includes('e.altKey') &&
    !/\bwindow\.(alert|confirm|prompt)\s*\(/.test(webWhipSrc));

  ok('openwhip UI: Agent accepts /whip, while Main Chat treats the typed command as text',
    agentSrc.includes('id="agwhip"') &&
    agentSrc.includes("c === '/whip'") &&
    !chatSrc.includes('^\\/whip') &&
    htmlSrc.includes('/web/js/openwhip.js'));
}

module.exports = run;

if (require.main === module) {
  let pass = 0, fail = 0;
  const ok = (name, cond, detail) => {
    if (cond) { pass++; console.log('  ok   ' + name); }
    else { fail++; console.log('  FAIL ' + name + (detail ? '  ->  ' + detail : '')); }
  };
  run(ok).then(() => {
    console.log('\n' + pass + ' passed, ' + fail + ' failed');
    process.exit(fail ? 1 : 0);
  }).catch(e => {
    console.error(e);
    process.exit(1);
  });
}

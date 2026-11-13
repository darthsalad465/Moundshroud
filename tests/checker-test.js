// The page checker (agent/tools/check-page.js): a local model runs it to learn whether the buttons on a page it wrote
// work. These start the real tool against small pages in tests/fixtures/pages, so they need Microsoft Edge.
// A PASS for a broken or unloaded page is the failure that matters most, so most checks here are about FAIL and exit 2.
const path = require('path'), fs = require('fs'), os = require('os'), { spawn, execFileSync } = require('child_process');

const TOOL = path.join(__dirname, '..', 'agent', 'tools', 'check-page.js');
const PAGES = path.join(__dirname, 'fixtures', 'pages');
const PREFIX = 'ms-check-page-';

/* starts the CLI the way the agent does: node check-page.js <file>, from the folder holding the page */
const run = (args, o = {}) => new Promise(res => {
  const t0 = Date.now(), p = spawn(process.execPath, [TOOL, ...args], { cwd: o.cwd || PAGES, env: o.env || process.env, windowsHide: true });
  let out = '';
  p.stdout.on('data', d => { out += d; }); p.stderr.on('data', d => { out += d; });
  const guard = setTimeout(() => { try { p.kill(); } catch (e) { } }, o.limit || 60000);
  p.on('close', code => { clearTimeout(guard); res({ code, out, ms: Date.now() - t0, pid: p.pid }); });
  if (o.onStart) o.onStart(p);
});

/* every msedge.exe now running, with its command line (the checker's own carry its temp profile folder in it) */
const edges = () => {
  try {
    const raw = execFileSync('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command',
      "@(Get-CimInstance Win32_Process -Filter \"Name='msedge.exe'\" | Select-Object ProcessId, CommandLine) | ConvertTo-Json -Compress"],
      { encoding: 'utf8', windowsHide: true, timeout: 20000 }).trim();
    if (!raw) return [];
    const j = JSON.parse(raw); return (Array.isArray(j) ? j : [j]).map(x => ({ pid: x.ProcessId, cmd: x.CommandLine || '' }));
  } catch (e) { return []; }
};
const tempProfiles = () => { try { return fs.readdirSync(os.tmpdir()).filter(n => n.startsWith(PREFIX)); } catch (e) { return []; } };
const short = s => s.replace(/\s+/g, ' ').slice(0, 300);
const alive = pid => { try { process.kill(pid, 0); return true; } catch (e) { return e.code === 'EPERM'; } };

module.exports = async ok => {
  const C = require(TOOL);

  /* the playbook a local model follows in Build mode */
  {
    let pb = ''; try { pb = fs.readFileSync(path.join(__dirname, '..', 'agent', 'playbooks', 'build.md'), 'utf8'); } catch (e) { }
    ok('playbook: build names the checker command and the round limit', pb.includes('node "$MOUNDSHROUD_TOOLS/check-page.js" <file>') && /\b5 (repair )?rounds\b/i.test(pb), pb ? '' : 'build.md missing');
    ok('playbook: build is under 60 lines', pb && pb.split(/\r?\n/).length < 60, pb.split(/\r?\n/).length + ' lines');
    const msgs = ['no click handler', 'blocked a request to the internet', 'did not finish within', 'reloaded or left the page', 'BLANK PAGE', '[wired yes/no, changed yes/no, animated yes/no]'];
    ok('playbook: build explains each checker message', msgs.every(m => pb.includes(m)), msgs.filter(m => !pb.includes(m)).join(' | '));
  }

  /* a network path must be refused from its text alone: touching it would make Windows offer the user's credentials to that host */
  {
    const T = C._t, names = ['existsSync', 'statSync', 'lstatSync', 'realpathSync', 'accessSync', 'readdirSync', 'openSync', 'readFileSync'];
    const saved = names.map(n => fs[n]); let touched = [];
    const stub = n => { const f = p => { touched.push(n + ' ' + p); throw new Error('file system touched'); }; f.native = f; return f; };
    const cases = [['\\\\192.0.2.1\\share\\x.html', {}], ['//192.0.2.1/share/x.html', {}], ['file://192.0.2.1/share/x.html', {}], [path.join('..', '..', 'run.js'), {}], ['C:\\Windows\\win.ini', {}], ['x.html', { serve: '\\\\192.0.2.1\\share' }], ['x.html', { serve: '..' }]];
    const got = [];
    try {
      names.forEach(n => { fs[n] = stub(n); });
      for (const [t, o] of cases) { touched = []; const r = T.resolveTarget(t, Object.assign({ workDir: PAGES }, o)); got.push({ t, refused: !!r.refused, touched: touched.slice() }); }
    } finally { names.forEach((n, i) => { fs[n] = saved[i]; }); }
    ok('checker: network and outside paths are refused before any file-system call', got.every(g => g.refused && !g.touched.length), JSON.stringify(got.filter(g => !g.refused || g.touched.length)));
  }

  /* the process sweep matches by profile folder; an empty or foreign folder name must match nothing */
  {
    const T = C._t, ps = (script, prof) => { try { return execFileSync('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command', script], { encoding: 'utf8', windowsHide: true, timeout: 20000, env: { ...process.env, CHECK_PAGE_PROFILE: prof } }).trim(); } catch (e) { return 'error ' + e.message; } };
    const dry = T.SWEEP_PS.replace('Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue', '$_.ProcessId');   // same match, prints instead of killing
    const outs = ['', 'C:\\', 'msedge'].map(p => [ps(T.LIST_PS, p), ps(dry, p)]);
    ok('checker: the sweep matches nothing for an empty or foreign profile name', T.leftovers('').length === 0 && T.leftovers(undefined).length === 0 && T.leftovers('C:\\').length === 0 && T.watchdog('') === null && T.watchdog(undefined) === null && dry !== T.SWEEP_PS && outs.every(o => o[0] === '' && o[1] === ''), JSON.stringify(outs));
  }

  const profilesBefore = new Set(tempProfiles()), hasEdge = !!C.findEdge();
  /* every msedge.exe running before any checker starts (taken now: this call blocks, and timed runs follow) */
  const before = hasEdge ? new Map(edges().map(e => [e.pid, e.cmd])) : new Map();

  /* refusals and missing files: these never start Edge, so they run on any PC */
  const refusals = Promise.all([
    run(['not-there.html']),
    run(['good.html', '--serve', os.tmpdir()]),
    run([path.join('..', '..', 'run.js')]),
    run(['https://example.com/']),
    (() => {
      const empty = fs.mkdtempSync(path.join(os.tmpdir(), 'ms-noedge-')), env = { ...process.env };
      for (const k of Object.keys(env)) if (/^(ProgramFiles|ProgramFiles\(x86\)|ProgramW6432)$/i.test(k)) env[k] = empty;
      env.ProgramFiles = env.ProgramFiles || empty; env['ProgramFiles(x86)'] = env['ProgramFiles(x86)'] || empty; env.ProgramW6432 = env.ProgramW6432 || empty;
      return run(['good.html'], { env }).finally(() => fs.rmSync(empty, { recursive: true, force: true }));
    })(),
    run(['\\\\192.0.2.1\\share\\x.html']),
    run(['file://192.0.2.1/share/x.html'])
  ]);
  const reportRefusals = ([missing, outside, outsideFile, remote, noEdge, unc, fileHost]) => {
    /* 192.0.2.1 is a documentation address nobody answers on: had the checker touched it, the SMB attempt would take far longer than 3 s */
    ok('checker: a network path is refused quickly', unc.code === 2 && /network path/.test(unc.out) && unc.ms < 3000 && fileHost.code === 2 && /another computer/.test(fileHost.out) && fileHost.ms < 3000,
      unc.code + ' in ' + unc.ms + ' ms ' + short(unc.out) + ' | ' + fileHost.code + ' in ' + fileHost.ms + ' ms ' + short(fileHost.out));
    ok('checker: a missing file is exit 2', missing.code === 2 && !/VERDICT: PASS/.test(missing.out), missing.code + ' ' + short(missing.out));
    ok('checker: a folder outside the working folder is refused', outside.code === 2 && /outside/i.test(outside.out) && !/VERDICT: PASS/.test(outside.out), outside.code + ' ' + short(outside.out));
    ok('checker: a file outside the working folder is refused', outsideFile.code === 2 && /outside/i.test(outsideFile.out), outsideFile.code + ' ' + short(outsideFile.out));
    ok('checker: a web address that is not this PC is refused', remote.code === 2 && /localhost|127\.0\.0\.1/.test(remote.out), remote.code + ' ' + short(remote.out));
    ok('checker: no Edge gives exit 2 and says so', noEdge.code === 2 && /Edge/.test(noEdge.out) && /not found/i.test(noEdge.out), noEdge.code + ' ' + short(noEdge.out));
  };
  if (!hasEdge) { reportRefusals(await refusals); ok('checker: skipped, Edge not found', true); return; }

  /* real pages in Edge, side by side: each run has its own Edge, port and temp profile */
  const spaced = fs.mkdtempSync(path.join(os.tmpdir(), 'ms check page ')), sub = path.join(spaced, 'my game');
  fs.mkdirSync(sub); fs.copyFileSync(path.join(PAGES, 'good.html'), path.join(sub, 'my page.html'));
  /* the kill test gets a temp folder of its own, so other runs' profiles cannot blur what it left behind */
  const killTmp = fs.mkdtempSync(path.join(os.tmpdir(), 'ms-killtest-'));

  /* spy on the kill function. Every msedge.exe running before the run is recorded first. The spy really kills only the
     spawned PID, or a PID whose command line carries this run's full profile folder; anything else is a violation and
     is not killed, so a too-broad match can never end the owner's Edge during the test. */
  const liveCmd = pid => { try { return execFileSync('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command', '(Get-CimInstance Win32_Process -Filter "ProcessId=' + (+pid) + '").CommandLine'], { encoding: 'utf8', windowsHide: true, timeout: 20000 }).trim(); } catch (e) { return ''; } };
  const spyRun = async () => {
    let started = null; const kills = [], violations = [], extraCmd = {};
    const spy = pid => {
      kills.push(pid);
      if (before.has(pid)) { violations.push(pid + ' was running before the check'); return; }
      if (started && pid === started.pid) { C.killTree(pid); return; }
      const cmd = liveCmd(pid); extraCmd[pid] = cmd;
      if (started && cmd.includes(started.profile)) { C.killTree(pid); return; }
      violations.push(pid + ' does not carry the profile folder: ' + cmd.slice(0, 120));
    };
    const rep = await C.check('good.html', { workDir: PAGES, kill: spy, onSpawn: s => { started = s; } });
    return { rep, kills, violations, extraCmd, started };
  };
  /* a harness that kills the checker mid-run (its own timeout) must not leave a hidden Edge or a profile behind */
  const killRun = async () => {
    const r = await run(['loop.html'], { env: { ...process.env, TEMP: killTmp, TMP: killTmp }, onStart: p => setTimeout(() => { try { p.kill(); } catch (e) { } }, 2500) });
    let left = [], dirs = [];
    for (let i = 0; i < 30; i++) {
      await new Promise(res => setTimeout(res, 500));
      left = edges().filter(e => e.cmd.includes(killTmp)); dirs = fs.readdirSync(killTmp);
      if (!left.length && !dirs.length) break;
    }
    return { r, left, dirs };
  };

  let good, dead, throws, dialog, spaces, served, animDead, animGood, spy, killed, loop, nav;
  try {
    let navRuns;
    [good, dead, throws, dialog, spaces, served, animDead, animGood, spy, killed, navRuns] = await Promise.all([
      run(['good.html']), run(['dead-button.html']), run(['throws.html']), null,
      run([path.join('my game', 'my page.html')], { cwd: spaced }), run(['good.html', '--serve', '.']),
      run(['animated-dead.html']), run(['animated-good.html']), spyRun(), null,
      Promise.all(['nav-missing', 'nav-external', 'nav-same-page-reload', 'nav-other-local-page', 'link-missing', 'blank', 'keyboard-canvas', 'anim-doc-listener'].map(n => run([n + '.html']).then(r => [n, r])))
    ]);
    nav = Object.fromEntries(navRuns);
    /* the timed runs go after the crowd: the dialog run (under 15 s) beside the kill run, then the 3 s loop run alone */
    [dialog, killed] = await Promise.all([run(['dialog.html']), killRun()]);
    /* the loop run has a 3 s budget that includes starting Edge, so it runs alone */
    loop = await run(['loop.html', '--timeout', '3000']);
  } finally { fs.rmSync(spaced, { recursive: true, force: true }); }
  reportRefusals(await refusals);

  ok('checker: a working page passes', good.code === 0 && /VERDICT: PASS/.test(good.out), good.code + ' ' + short(good.out));
  ok('checker: a working page lists the controls it clicked', /PASS\s+button "New Game"/.test(good.out) && /PASS\s+button "Reset"/.test(good.out) && /link "Rules"/.test(good.out), short(good.out));
  ok('checker: each control shows its evidence', /PASS\s+button "Add one" \[wired yes, changed yes, animated no\]/.test(good.out), short(good.out));
  ok('checker: data-check="skip" controls are ignored', good.code === 0 && !/Debug/.test(good.out) && !/Hidden tools/.test(good.out), short(good.out));
  ok('checker: a button with no handler fails and is named', dead.code === 1 && /FAIL\s+button "New Game": no click handler/.test(dead.out) && /VERDICT: FAIL/.test(dead.out) && !/VERDICT: PASS/.test(dead.out), dead.code + ' ' + short(dead.out));
  ok('checker: a thrown error is reported with its message', throws.code === 1 && /startGame is not defined/.test(throws.out) && /line \d+/.test(throws.out), throws.code + ' ' + short(throws.out));
  ok('checker: confirm and alert dialogs do not hang it', dialog.code === 0 && dialog.ms < 15000, dialog.code + ' in ' + dialog.ms + ' ms ' + short(dialog.out));
  ok('checker: an endless loop ends at the timeout', loop.code === 1 && loop.ms < 12000 && /VERDICT: FAIL/.test(loop.out), loop.code + ' in ' + loop.ms + ' ms ' + short(loop.out));
  ok('checker: a path with spaces works', spaces.code === 0 && /VERDICT: PASS/.test(spaces.out), spaces.code + ' ' + short(spaces.out));
  ok('checker: --serve hosts the folder on 127.0.0.1', served.code === 0 && /http:\/\/127\.0\.0\.1:\d+\/good\.html/.test(served.out), served.code + ' ' + short(served.out));
  ok('checker: an animated page with a dead New Game fails', animDead.code === 1 && /FAIL\s+button "New Game": no click handler/.test(animDead.out) && /animated yes/.test(animDead.out) && !/VERDICT: PASS/.test(animDead.out), animDead.code + ' ' + short(animDead.out));
  ok('checker: an animated page with a working New Game passes', animGood.code === 0 && /PASS\s+button "New Game"/.test(animGood.out) && /Animated: yes/.test(animGood.out), animGood.code + ' ' + short(animGood.out));
  const nr = n => nav[n].code + ' ' + short(nav[n].out);
  ok('checker: a document listener does not pass a dead button on an animated page', nav['anim-doc-listener'].code === 1 && /FAIL\s+button "New Game"/.test(nav['anim-doc-listener'].out) && /only on document, window or a parent/.test(nav['anim-doc-listener'].out) && !/VERDICT: PASS/.test(nav['anim-doc-listener'].out), nr('anim-doc-listener'));
  ok('checker: a click that goes to a missing page fails', nav['nav-missing'].code === 1 && /FAIL\s+button "Play": the click left the page and went to a page that does not exist/.test(nav['nav-missing'].out), nr('nav-missing'));
  ok('checker: a click that goes to the internet fails', nav['nav-external'].code === 1 && /FAIL\s+button "Play online": the click left the page and went to the internet/.test(nav['nav-external'].out), nr('nav-external'));
  ok('checker: a click that reloads the page passes', nav['nav-same-page-reload'].code === 0 && /PASS\s+button "New Game": reloaded or left the page: it reloaded this page/.test(nav['nav-same-page-reload'].out), nr('nav-same-page-reload'));
  ok('checker: a click that goes to another page in the folder passes', nav['nav-other-local-page'].code === 0 && /PASS\s+button "Play": reloaded or left the page: it went to file:.*nav-target\.html, which loaded/.test(nav['nav-other-local-page'].out), nr('nav-other-local-page'));
  ok('checker: a link to a missing page fails', nav['link-missing'].code === 1 && /FAIL\s+link "Play": this link leads to a page that does not exist/.test(nav['link-missing'].out), nr('link-missing'));
  ok('checker: a blank page fails', nav.blank.code === 1 && /BLANK PAGE/.test(nav.blank.out) && /VERDICT: FAIL/.test(nav.blank.out), nr('blank'));
  ok('checker: a keyboard-only canvas page with no controls passes', nav['keyboard-canvas'].code === 0 && /No clickable controls were found; only loading and errors were checked\./.test(nav['keyboard-canvas'].out), nr('keyboard-canvas'));
  {
    const { rep, kills, violations, extraCmd, started } = spy;
    const extras = kills.filter(p => p !== rep.edgePid);
    ok('checker: it ends only its own Edge', rep.code === 0 && started && started.pid === rep.edgePid && started.profile === rep.profile && kills[0] === rep.edgePid
      && violations.length === 0 && kills.every(p => !before.has(p)) && extras.every(p => (extraCmd[p] || '').includes(rep.profile))
      && !alive(rep.edgePid) && !fs.existsSync(rep.profile),
      'exit ' + rep.code + ', spawned ' + rep.edgePid + ', kill got ' + kills.join(',') + ', violations: ' + violations.join('; ') + ', alive ' + alive(rep.edgePid) + ', profile exists ' + fs.existsSync(rep.profile || ''));
  }
  ok('checker: killing the checker still ends its Edge', killed.r.code !== 0 && killed.left.length === 0 && killed.dirs.length === 0, 'exit ' + killed.r.code + ', left: ' + killed.left.map(e => e.pid).join(',') + ' folders: ' + killed.dirs.join(','));
  try { fs.rmSync(killTmp, { recursive: true, force: true }); } catch (e) { }

  const stray = edges().filter(e => e.cmd.includes(PREFIX)), leftProfiles = tempProfiles().filter(n => !profilesBefore.has(n));
  ok('checker: no checker Edge or temp profile folder is left behind', stray.length === 0 && leftProfiles.length === 0, 'Edge: ' + stray.map(e => e.pid).join(',') + ' folders: ' + leftProfiles.join(', '));
};

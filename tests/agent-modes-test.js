// The Agent tab's modes (General, Build, Secure) and the Aim: which rule file each one runs under, built from the
// base rule file plus a small template per mode. Nothing starts here; the generated files are only read back.
const path = require('path'), fs = require('fs');

module.exports = async ok => {
  const M = require(path.join(__dirname, '..', 'lib', 'agent-modes.js')), agent = require(path.join(__dirname, '..', 'lib', 'agent.js'));
  const base = JSON.parse(fs.readFileSync(agent.GUARD, 'utf8')).permissions;
  const load = o => { const g = M.guardFor(o); return { g, p: g.ok ? JSON.parse(fs.readFileSync(g.file, 'utf8')).permissions : null, text: g.ok ? fs.readFileSync(g.file, 'utf8') : '' }; };
  const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
  const CHECK = 'Bash(node "$MOUNDSHROUD_TOOLS/check-page.js" *)', AUDIT = 'Bash(node "$MOUNDSHROUD_TOOLS/audit-pc.js" *)', TRASH = 'Bash(node "$MOUNDSHROUD_TOOLS/trash.js" *)';
  const RAW = ['Bash(rm *)', 'Bash(del *)', 'Bash(rmdir *)', 'Bash(rd *)'];

  ok('modes: unknown input is general', M.modeOf('x') === 'general' && M.modeOf(undefined) === 'general' && M.modeOf(null) === 'general' && M.modeOf(7) === 'general' && M.modeOf('Build') === 'build' && M.modeOf('secure') === 'secure');
  ok('modes: general has no playbook', M.playbookFile('general') === '' && /playbooks[\\/]build\.md$/.test(M.playbookFile('build')) && /playbooks[\\/]secure\.md$/.test(M.playbookFile('secure')));

  const b = load({ mode: 'build' });
  ok('modes: build allows the checker and nothing else new', b.g.ok && same(b.p.allow, base.allow.concat([CHECK])), JSON.stringify(b.g));
  const s = load({ mode: 'secure' });
  ok('modes: secure allows the audit and nothing else new', s.g.ok && same(s.p.allow, base.allow.concat([AUDIT])), JSON.stringify(s.g));
  const a = load({ mode: 'general', aim: 'C:\\Users\\x\\Documents' });
  ok('modes: aim denies raw deletes', a.g.ok && RAW.every(r => a.p.deny.includes(r) && !a.p.ask.includes(r)) && a.p.allow.includes(TRASH), JSON.stringify(a.g));
  ok('modes: general with no aim is the base rule file itself', M.guardFor({ mode: 'general' }).file === agent.GUARD);

  const all = [b, s, a, load({ mode: 'build', aim: 'C:\\x', wholePc: true })];
  ok('modes: every mode keeps the base deny list', all.every(x => x.g.ok && base.deny.every(d => x.p.deny.includes(d))));
  ok('modes: every mode keeps the base ask list, except the raw deletes moved to deny', all.every(x => base.ask.every(k => x.p.ask.includes(k) || (x.p.deny.includes(k) && RAW.includes(k)))));
  ok('modes: aim adds Edit and Write denials for every protected path', M.protectedPaths().length >= 6 && M.protectedPaths().every(p => a.p.deny.includes('Edit(' + M.ruleOf(p) + '/**)') && a.p.deny.includes('Write(' + M.ruleOf(p) + '/**)')), M.protectedPaths().join(' | '));
  ok('modes: the repo path placeholder is always filled in', all.every(x => !x.text.includes('{{')));

  /* Claude Code applies deny, then ask, then allow. An allowed command that also matches an ask or deny pattern would never run unasked. */
  const rx = pat => new RegExp('^' + pat.split('*').map(t => t.replace(/[.+?^${}()|[\]\\]/g, '\\$&')).join('[\\s\\S]*') + '$');
  const cmd = r => { const m = /^Bash\(([\s\S]*)\)$/.exec(r); return m ? m[1] : null; };
  const clashes = [];
  for (const x of all) {
    const guard = x.p.ask.concat(x.p.deny).map(cmd).filter(c => c !== null);
    for (const al of x.p.allow.map(cmd).filter(c => c !== null)) for (const g of guard) if (rx(g).test(al) || rx(al).test(g)) clashes.push(al + '  vs  ' + g);
  }
  ok('modes: no allowed command matches an ask or deny pattern', clashes.length === 0, clashes.join(' ; '));

  /* a protected folder with a space in its name (Program Files, OneDrive) must reach the rule file intact */
  const pfWas = process.env.ProgramFiles;
  process.env.ProgramFiles = 'C:\\Users\\x\\OneDrive\\My Docs';
  let sp; try { sp = load({ mode: 'build', aim: 'C:\\Users\\x\\OneDrive\\My Docs' }); } finally { if (pfWas === undefined) delete process.env.ProgramFiles; else process.env.ProgramFiles = pfWas; }
  ok('modes: a path with spaces survives', sp.g.ok && sp.p && sp.p.deny.includes('Edit(//c/Users/x/OneDrive/My Docs/**)') && sp.p.deny.includes('Write(//c/Users/x/OneDrive/My Docs/**)') && sp.p.allow.includes(CHECK) && sp.p.allow.includes(TRASH), JSON.stringify(sp.g));

  /* the launcher folder's own files are protected; its workspace subfolder is the agent's default working folder and is not */
  const denied = p => a.p.deny.includes('Edit(' + M.ruleOf(p) + '/**)') && a.p.deny.includes('Write(' + M.ruleOf(p) + '/**)');
  ok('modes: the workspace folder is not denied, the launcher folder itself is not either', !denied(path.join(agent.DIR, 'workspace')) && !denied(agent.DIR) && !a.p.deny.some(r => /^(Edit|Write)\(/.test(r) && r.toLowerCase().includes(M.ruleOf(path.join(agent.DIR, 'workspace')).toLowerCase())));
  ok('modes: the launcher config and script are denied', denied(path.join(agent.DIR, 'config')) && denied(path.join(agent.DIR, 'start-gemma-agent.ps1')));
  {
    const os = require('os'), tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'ms-launcher-')), envWas = process.env.MOUNDSHROUD_AGENT_DIR;
    const mods = ['agent-modes.js', 'agent.js', 'safe-dir.js'].map(f => path.join(__dirname, '..', 'lib', f));
    const drop = () => mods.forEach(f => { delete require.cache[f]; });
    try {
      ['workspace', 'config', 'Modelfile', 'extra.txt'].forEach(n => fs.mkdirSync(path.join(tmp, n)));
      process.env.MOUNDSHROUD_AGENT_DIR = tmp; drop();
      const T = require(mods[0]), got = T.protectedPaths().map(p => path.resolve(p).toLowerCase());
      ok('modes: protected launcher files come from the folder itself, without workspace', got.includes(path.join(tmp, 'config').toLowerCase()) && got.includes(path.join(tmp, 'extra.txt').toLowerCase()) && !got.includes(path.join(tmp, 'workspace').toLowerCase()) && !got.includes(path.resolve(tmp).toLowerCase()), got.join(' | '));
      fs.rmSync(tmp, { recursive: true, force: true });
      const gone = T.protectedPaths().map(p => path.resolve(p).toLowerCase());
      ok('modes: a missing launcher folder falls back to its known names', ['config', 'Modelfile', 'start-gemma-agent.cmd', 'start-gemma-agent.ps1'].every(n => gone.includes(path.join(tmp, n).toLowerCase())) && !gone.includes(path.join(tmp, 'workspace').toLowerCase()));
    } finally {
      if (envWas === undefined) delete process.env.MOUNDSHROUD_AGENT_DIR; else process.env.MOUNDSHROUD_AGENT_DIR = envWas;
      drop(); try { fs.rmSync(tmp, { recursive: true, force: true }); } catch (e) { }
    }
  }
  ok('modes: no bypass settings', all.every(x => !/bypassPermissions/.test(x.text) && !/dangerously/i.test(x.text)) && all.every(x => x.p.disableBypassPermissionsMode === 'disable'));
  ok('modes: each call writes its own file', load({ mode: 'build' }).g.file !== b.g.file);

  ok('modes: ruleOf gives the //c/ style', M.ruleOf('C:\\Users\\x\\y') === '//c/Users/x/y' && M.ruleOf('C:\\Program Files (x86)') === '//c/Program Files (x86)' && M.ruleOf('D:\\a\\') === '//d/a');
  ok('modes: the tools folder is agent/tools in this repo', path.resolve(M.TOOLS_DIR) === path.resolve(__dirname, '..', 'agent', 'tools'));
  ok('modes: base rule file bytes are untouched', true && fs.readFileSync(agent.GUARD, 'utf8').includes('"disableBypassPermissionsMode": "disable"'));

  /* safe-dir: an Aim may reach a drive root or the home folder only when Whole PC is ticked. These only read paths, they never write. */
  {
    const os = require('os'), SD = require(path.join(__dirname, '..', 'lib', 'safe-dir.js'));
    const root = path.parse(os.homedir()).root, home = os.homedir(), WP = { aim: true, wholePc: true }, AIM = { aim: true };
    ok('safe-dir: without options a drive root is refused', !SD.check(root).ok && /whole drive/i.test(SD.check(root).error) && !SD.check(home).ok);
    ok('safe-dir: wholePc aim accepts a drive root', SD.check(root, WP).ok === true, JSON.stringify(SD.check(root, WP)));
    ok('safe-dir: wholePc aim accepts the home folder', SD.check(home, WP).ok === true, JSON.stringify(SD.check(home, WP)));
    ok('safe-dir: aim without wholePc still refuses the home folder', !SD.check(home, AIM).ok && !SD.check(root, AIM).ok && !SD.check(home, { wholePc: true }).ok && !SD.check(root, { wholePc: true }).ok && !SD.check(home, {}).ok);
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'ms-safedir-'));
    try {
      ok('safe-dir: aim accepts an ordinary folder', SD.check(tmp, WP).ok === true && SD.check(tmp, AIM).ok === true);
      const miss = path.join(tmp, 'not-there'), bad = [['a network path', '\\\\server\\share'], ['a path with %', path.join(tmp, '%TEMP%')], ['a path with a quote', tmp + '"x'], ['a path with &', tmp + '&x'], ['a relative path', 'folder'], ['a missing folder', miss]];
      ok('safe-dir: aim still refuses a network path, a path with %, and a missing folder', bad.every(([, p]) => !SD.check(p, WP).ok && SD.check(p, WP).error === SD.check(p).error), bad.filter(([, p]) => SD.check(p, WP).ok).map(x => x[0]).join(', '));
      /* this app's folder and the agent launcher folder, with the launcher folder pointed at a temp folder */
      const envWas = process.env.MOUNDSHROUD_AGENT_DIR, f = path.join(__dirname, '..', 'lib', 'safe-dir.js'), launcher = path.join(tmp, 'launcher');
      fs.mkdirSync(path.join(launcher, 'workspace'), { recursive: true });
      try {
        process.env.MOUNDSHROUD_AGENT_DIR = launcher; delete require.cache[f];
        const S2 = require(f), app = path.join(__dirname, '..');
        ok('safe-dir: aim still refuses this app\'s folder and the agent launcher folder', !S2.check(app, WP).ok && !S2.check(path.join(app, 'lib'), WP).ok && !S2.check(launcher, WP).ok && S2.check(path.join(launcher, 'workspace'), WP).ok === true,
          [S2.check(app, WP), S2.check(launcher, WP), S2.check(path.join(launcher, 'workspace'), WP)].map(r => JSON.stringify(r)).join(' | '));
        const sys = process.env.SystemRoot;
        ok('safe-dir: aim still refuses Windows', !sys || !S2.check(sys, WP).ok);
      } finally { if (envWas === undefined) delete process.env.MOUNDSHROUD_AGENT_DIR; else process.env.MOUNDSHROUD_AGENT_DIR = envWas; delete require.cache[f]; }
    } finally { try { fs.rmSync(tmp, { recursive: true, force: true }); } catch (e) { } }
  }
};

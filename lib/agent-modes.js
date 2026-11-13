// The Agent tab's modes: General (the base rule file, unchanged), Build (adds the page checker), Secure (adds the PC
// audit) and Aim (adds the Recycle Bin tool, refuses raw deletes, shields the app and system folders from edits).
// Each mode is a small template of additions; guardFor merges it into agent-guard.json and writes the result to a
// temporary file for Claude Code's --settings. Claude Code applies deny, then ask, then allow, so nothing added to
// "allow" may also match an "ask" or "deny" pattern. No command is run here.
const fs = require('fs'), os = require('os'), path = require('path'), crypto = require('crypto');

const agent = require('./agent');
const ROOT = path.join(__dirname, '..');
const TOOLS_DIR = path.join(ROOT, 'agent', 'tools');
const PLAYBOOKS = path.join(ROOT, 'agent', 'playbooks');
const MODES = ['general', 'build', 'secure'];

const modeOf = v => { const m = typeof v === 'string' ? v.trim().toLowerCase() : ''; return MODES.includes(m) ? m : 'general'; };
const playbookFile = mode => { const m = modeOf(mode); return m === 'general' ? '' : path.join(PLAYBOOKS, m + '.md'); };

/* C:\Users\x\y  ->  //c/Users/x/y (the spelling Claude Code's path rules use) */
function ruleOf(p) {
  const s = String(p).replace(/\\/g, '/').replace(/\/+$/, '');
  const m = /^([A-Za-z]):(?:\/(.*))?$/.exec(s);
  return m ? '//' + m[1].toLowerCase() + (m[2] ? '/' + m[2] : '') : s;
}

/* the places an agent may roam around but never edit: this app, the agent's launcher, Windows, the programs folders, the keys */
function launcherParts() {
  /* the launcher folder itself is not listed: its workspace subfolder is the agent's default working folder (safe-dir.js) */
  let names;
  try { names = fs.readdirSync(agent.DIR); } catch (e) { names = ['config', 'Modelfile', 'start-gemma-agent.cmd', 'start-gemma-agent.ps1']; }
  return names.filter(n => n.toLowerCase() !== 'workspace').map(n => path.join(agent.DIR, n));
}
function protectedPaths() {
  const env = k => process.env[k] || '';
  return [ROOT, ...launcherParts(), env('SystemRoot') || 'C:\\Windows', env('ProgramFiles'), env('ProgramFiles(x86)'), env('ProgramData'),
    path.join(os.homedir(), '.ssh'), path.join(os.homedir(), '.claude')].filter(Boolean).map(p => path.resolve(p));
}

const templateFile = n => path.join(__dirname, 'agent-guard-' + n + '.json');
function template(n) {
  const fill = s => String(s).split('{{ROOT}}').join(ruleOf(ROOT));
  const t = (JSON.parse(fs.readFileSync(templateFile(n), 'utf8')).permissions) || {};
  return { allow: (t.allow || []).map(fill), ask: (t.ask || []).map(fill), deny: (t.deny || []).map(fill) };
}
const union = (a, b) => a.concat(b.filter(x => !a.includes(x)));

/* o: { mode, aim?, wholePc? }. A template for each thing switched on is merged into the base rule file. */
function guardFor(o) {
  o = o || {};
  const mode = modeOf(o.mode), aimed = !!(o.aim || o.wholePc);
  if (mode === 'general' && !aimed) return { ok: true, file: agent.GUARD };
  try {
    const out = JSON.parse(fs.readFileSync(agent.GUARD, 'utf8'));
    const p = out.permissions = out.permissions || {};
    const names = (mode === 'general' ? [] : [mode]).concat(aimed ? ['aim'] : []);
    for (const n of names) {
      const t = template(n);
      for (const k of ['allow', 'ask', 'deny']) p[k] = union(p[k] || [], t[k]);
    }
    if (aimed) {
      for (const d of protectedPaths()) p.deny = union(p.deny, ['Edit(' + ruleOf(d) + '/**)', 'Write(' + ruleOf(d) + '/**)']);
    }
    p.ask = (p.ask || []).filter(r => !p.deny.includes(r));     // a rule moved to deny leaves ask
    const file = path.join(os.tmpdir(), 'moundshroud-guard-' + mode + (aimed ? '-aim' : '') + '-' + process.pid + '-' + crypto.randomBytes(6).toString('hex') + '.json');
    fs.writeFileSync(file, JSON.stringify(out, null, 2), { flag: 'wx' });
    return { ok: true, file };
  } catch (e) { return { ok: false, file: '', error: 'The rule file for this mode could not be made: ' + e.message }; }
}

module.exports = { modeOf, playbookFile, guardFor, protectedPaths, ruleOf, TOOLS_DIR };

// mcode /swarm, shared by the Terminal Playground mcode (browser) and Moundshroud Code (lib/moundshroud-code.js): roles, model assignment, memory fit check and the arrow-key role list.
((root, factory) => {
  if (typeof module !== 'undefined' && module.exports) module.exports = factory();
  else root.McodeSwarm = factory();
})(typeof window === 'undefined' ? globalThis : window, () => {
  const GB = 1073741824;
  const OVERHEAD = 1.2;            // weights plus context cache and runtime buffers, per loaded model
  const MAX_ROLES = 6, MAX_ROUNDS = 6;
  const DEFAULT_ROLES = [
    { name: 'planner', job: 'Splits the task into steps and says what to check first.' },
    { name: 'coder', job: 'Writes and runs the commands or code that do the work.' },
    { name: 'tester', job: 'Checks the others’ results by running tests and calls out mistakes.' }
  ];
  const cleanName = text => String(text || '').toLowerCase().replace(/[^a-z0-9_-]/g, '').slice(0, 16);

  // Roles live in a plain object so callers can save it as JSON.
  function createState(saved) {
    const roles = Array.isArray(saved?.roles) && saved.roles.length
      ? saved.roles.slice(0, MAX_ROLES).map(role => ({ name: cleanName(role.name) || 'role', job: String(role.job || '').slice(0, 200), model: String(role.model || '') }))
      : DEFAULT_ROLES.map(role => ({ ...role, model: '' }));
    return { roles };
  }

  const gb = bytes => Math.round(bytes / GB * 10) / 10;
  // Memory a swarm needs: each distinct model is loaded once and shared by every role that uses it.
  // Budget: all graphics memory plus half the system RAM, leaving the rest for Windows and the app.
  function fit(roles, catalog, hardware, fallbackModel) {
    const sizes = new Map((catalog || []).map(model => [model.name, Number(model.size) || 0]));
    const budgetGB = Math.round(((Number(hardware?.vramGB) || 0) + (Number(hardware?.ramGB) || 0) * 0.5) * 10) / 10;
    const used = [...new Set(roles.map(role => role.model || fallbackModel).filter(Boolean))];
    const each = used.map(name => ({ name, gb: gb((sizes.get(name) || 0) * OVERHEAD), known: sizes.has(name) }));
    const needGB = Math.round(each.reduce((sum, model) => sum + model.gb, 0) * 10) / 10;
    const tooBig = budgetGB > 0 ? each.filter(model => model.gb > budgetGB / 2 && used.length > 1 || model.gb > budgetGB) : [];
    const missing = each.filter(model => !model.known).map(model => model.name);
    const ok = !missing.length && (!budgetGB || needGB <= budgetGB && !tooBig.length);
    return { ok, needGB, budgetGB, models: each, tooBig: tooBig.map(model => model.name), missing };
  }

  function fitMessage(result, roles, fallbackModel) {
    if (result.missing.length) return 'Not installed on this PC: ' + result.missing.join(', ') + '. Pick an installed model for that role.';
    if (result.ok) return 'Fits · ' + result.needGB + ' GB of about ' + result.budgetGB + ' GB this PC can give models.';
    const big = result.tooBig.map(name => {
      const model = result.models.find(item => item.name === name);
      const users = roles.filter(role => (role.model || fallbackModel) === name).map(role => role.name).join(', ');
      return name + ' (' + model.gb + ' GB, used by ' + users + ')';
    });
    return (big.length ? 'Too big to run in a swarm: ' + big.join('; ') + '. ' : '') +
      'The swarm needs ' + result.needGB + ' GB and this PC can give models about ' + result.budgetGB + ' GB. ' +
      'Give those roles a smaller model, or let roles share one model (it loads once).';
  }

  // Commands: /swarm, /swarm run [task], /swarm add <role> [job], /swarm rm <role>, /swarm set <role> <model|n>, /swarm job <role> <text>, /swarm reset.
  function command(state, arg, models) {
    const words = String(arg || '').trim().split(/\s+/).filter(Boolean);
    const verb = (words[0] || '').toLowerCase();
    const find = name => state.roles.find(role => role.name === cleanName(name));
    if (!verb) return { action: 'picker' };
    if (verb === 'run' || verb === 'go' || verb === 'start') return { action: 'run', task: words.slice(1).join(' ') };
    if (verb === 'roles' || verb === 'list' || verb === 'ls') return { action: 'list' };
    if (verb === 'reset') { state.roles = createState().roles; return { action: 'changed', text: 'Roles reset to planner, coder, tester.' }; }
    if (verb === 'add' || verb === 'new') {
      const name = cleanName(words[1]);
      if (!name) return { action: 'error', text: 'Usage: /swarm add <role> [what it does]' };
      if (find(name)) return { action: 'error', text: 'There is already a ' + name + ' role.' };
      if (state.roles.length >= MAX_ROLES) return { action: 'error', text: 'A swarm has at most ' + MAX_ROLES + ' roles.' };
      state.roles.push({ name, job: words.slice(2).join(' ').slice(0, 200) || 'Helps with the task as a ' + name + '.', model: '' });
      return { action: 'changed', text: 'Added role ' + name + '.' };
    }
    if (verb === 'rm' || verb === 'remove' || verb === 'del' || verb === 'delete') {
      const role = find(words[1]);
      if (!role) return { action: 'error', text: 'No role named ' + (words[1] || '?') + '.' };
      if (state.roles.length === 1) return { action: 'error', text: 'A swarm needs at least one role.' };
      state.roles = state.roles.filter(item => item !== role);
      return { action: 'changed', text: 'Removed role ' + role.name + '.' };
    }
    if (verb === 'job' || verb === 'describe') {
      const role = find(words[1]);
      if (!role || !words[2]) return { action: 'error', text: 'Usage: /swarm job <role> <what it does>' };
      role.job = words.slice(2).join(' ').slice(0, 200);
      return { action: 'changed', text: role.name + ' · ' + role.job };
    }
    const target = verb === 'set' || verb === 'assign' ? words.slice(1) : words;
    const role = find(target[0]);
    if (role && target[1]) {
      const pick = target.slice(1).join(' ');
      const name = /^\d+$/.test(pick) ? models[Number(pick) - 1] :
        models.find(model => model.toLowerCase() === pick.toLowerCase()) || models.find(model => model.toLowerCase().includes(pick.toLowerCase()));
      if (!name && !/^(?:default|auto)$/i.test(pick)) return { action: 'error', text: 'No local model matches ' + pick + '. /model lists them.' };
      role.model = name || '';
      return { action: 'changed', text: role.name + ' · ' + (role.model || 'default model') };
    }
    return { action: 'error', text: 'Unknown /swarm command. Type /swarm help.' };
  }

  const help = [
    'mcode · /swarm runs several local agents at once, one per role',
    '  /swarm                    role list: ↑ ↓ pick a role · ← → change its model · Del removes it · Enter or Esc closes',
    '  /swarm run [task]         start the swarm on a task (alone: the current objective)',
    '  /swarm add <role> [job]   create a role, for example /swarm add reviewer checks the answer',
    '  /swarm set <role> <model> give a role a model by name or number (/model lists them)',
    '  /swarm job <role> <text>  change what a role does',
    '  /swarm rm <role>          remove a role · /swarm roles lists them · /swarm reset',
    'Each distinct model loads once. mcode says when a model is too big to run in a swarm on this PC.'
  ].join('\n');

  function picker(state, selected, fallbackModel, fitText) {
    const width = Math.max(6, ...state.roles.map(role => role.name.length));
    return ['Swarm roles  (↑ ↓ role · ← → model · Del remove · Enter/Esc close)',
      ...state.roles.map((role, i) => (i === selected ? ' ▶ ' : '   ') + role.name.padEnd(width) + '  ‹ ' + (role.model || 'default: ' + (fallbackModel || 'none')) + ' ›  ' + role.job),
      fitText || ''].filter(Boolean).join('\n');
  }

  // Cycles a role's model through '' (default) and the installed list.
  function cycle(role, models, step) {
    const list = ['', ...models];
    const at = Math.max(0, list.indexOf(role.model));
    role.model = list[(at + step + list.length) % list.length];
  }

  function rolePrompt(role, roles, task) {
    return 'You are the ' + role.name + ' in a team of local agents (' + roles.map(item => item.name).join(', ') + ').\n' +
      'Your job: ' + role.job + '\nTeam task: ' + task + '\n' +
      'You see a shared board with what every teammate ran and found. Do your own part and do not repeat a teammate’s command.';
  }

  return { createState, fit, fitMessage, command, help, picker, cycle, rolePrompt, DEFAULT_ROLES, MAX_ROLES, MAX_ROUNDS, OVERHEAD };
});

// Two pages that broke without any error in the console:
// 1. Tools > Prompt optimizer showed "This page hit a problem": the Tools buttons used a second copy of the page list that had no 'opt'.
// 2. The Cyber games (Terminal Hacker and the rest) drew empty boxes in the Cyber tab: they looked up their elements inside
//    #plstage (the Games tab) while the Cyber tab mounts them in #cygstage.
const fs = require('fs'), path = require('path'), vm = require('vm');

module.exports = async ok => {
  const root = path.join(__dirname, '..'), rd = f => fs.readFileSync(path.join(root, f), 'utf8');
  const eq = (name, got, want) => ok(name, got === want, 'got ' + JSON.stringify(got) + ', wanted ' + JSON.stringify(want));

  /* ----- Tools: every button has a page ----- */
  const tools = rd('web/js/tools.js');
  const subs = (tools.match(/const SUBS = (\[[^;]*\]);/) || [])[1];
  const ids = subs ? JSON.parse(subs.replace(/'/g, '"')).map(s => s[0]) : [];
  const render = (tools.match(/const RENDER = \(\) => \(\{([\s\S]*?)\}\);/) || [])[1] || '';
  const keys = new Set((render.match(/(?:^|,)\s*(\w+)\s*(?=[:,]|$)/g) || []).map(k => k.replace(/[,\s]/g, '')));
  ok('tools: the Tools buttons include the Prompt optimizer', ids.includes('opt'), ids.join(' '));
  const missing = ids.filter(i => !keys.has(i));
  ok('tools: every Tools button has a page in RENDER', ids.length && !missing.length, missing.join(' '));
  const go = (tools.match(/function go\(s\) \{[^\n]*/) || [''])[0];
  ok('tools: the Tools buttons open pages from RENDER (one list, no second copy)', /RENDER\(\)/.test(go) && !/promptOpt|converter/.test(go), go.slice(0, 120));

  /* ----- Cyber games: Terminal Hacker works when mounted outside #plstage ----- */
  /* a tiny stand-in for the page: setting innerHTML makes every id="..." findable inside that element; misses are recorded */
  let misses = [];
  const stub = id => {
    const e = { id, kids: [], style: {}, dataset: {}, value: '', textContent: '', scrollTop: 0, scrollHeight: 0, disabled: false, checked: false,
      classList: { add() { }, remove() { }, toggle() { }, contains: () => false }, focus() { }, blur() { }, remove() { }, setAttribute() { }, getAttribute: () => null,
      addEventListener() { }, removeEventListener() { }, querySelectorAll: () => [], closest: () => null, insertAdjacentHTML() { }, scrollIntoView() { },
      appendChild(c) { this.kids.push(c); return c; } };
    let html = '';
    Object.defineProperty(e, 'innerHTML', { get: () => html, set: v => { html = String(v); e.kids = []; e.found = {}; for (const m of html.matchAll(/id="([^"]+)"/g)) e.found[m[1]] = stub(m[1]); } });
    e.found = {}; e.querySelector = sel => { const m = /^#([\w-]+)$/.exec(sel); const r = m ? e.found[m[1]] || null : null; if (!r) misses.push(sel); return r; };
    return e;
  };
  const A = { play: { games: {} }, toast() { } };
  const ctx = vm.createContext({ A, ls: { get: (k, d) => d, set() { } }, esc: s => String(s), btoa: s => Buffer.from(s, 'binary').toString('base64'), atob: s => Buffer.from(s, 'base64').toString('binary'),
    document: { querySelector: () => null, getElementById: () => null, createElement: () => stub('') }, window: { getSelection: () => ({ toString: () => '' }) }, setTimeout: () => 0, clearTimeout() { }, setInterval: () => 0, clearInterval() { }, Math, console });
  vm.runInContext(rd('web/js/cyber-games.js'), ctx, { filename: 'cyber-games.js' });
  const g = A.play.games.terminal;
  ok('cyber games: Terminal Hacker is registered', !!g);
  if (g) {
    const el = stub('cygstage'); let err = '';
    try { g.mount(el, { hud() { }, submit() { }, level: 1 }); } catch (e) { err = e.message; }
    ok('cyber games: Terminal Hacker mounts in the Cyber tab stage (#cygstage) without an error', !err, err);
    const tg = el.found.tg, to = el.found.to, ti = el.found.ti;
    ok('cyber games: the terminal shows the first mission', !!tg && /Mission 1 of/.test(tg.innerHTML), tg && tg.innerHTML.slice(0, 80));
    if (ti && ti.onkeydown && to) {
      ti.value = 'pwd'; ti.onkeydown({ key: 'Enter', preventDefault() { } });
      ok('cyber games: typing pwd and Enter prints the folder', to.kids.some(k => k.textContent === '/home/you'), to.kids.map(k => k.textContent).join(' | ').slice(0, 160));
    } else ok('cyber games: the terminal input answers the Enter key', false, 'no input handler');
  }

  /* every Cyber game opens in both places it can be shown: the Games tab (#plstage) and the Cyber tab (#cygstage) */
  const cyber = Object.entries(A.play.games).filter(([, x]) => x.cat === 'cyber');
  ok('cyber games: all 6 Cyber games are registered', cyber.length >= 6, cyber.map(c => c[0]).join(' '));
  const broken = [];
  for (const [id, x] of cyber) for (const where of ['plstage', 'cygstage']) {
    const el = stub(where); misses = [];
    try { const stop = x.mount(el, { hud() { }, submit() { }, level: 1, id }); if (typeof stop === 'function') stop(); } catch (e) { broken.push(id + '@' + where + ': ' + e.message); continue; }
    if (!el.innerHTML) broken.push(id + '@' + where + ': drew nothing');
    else if (misses.length) broken.push(id + '@' + where + ': could not find ' + [...new Set(misses)].join(' '));
  }
  ok('cyber games: every Cyber game opens and finds all its parts in the Games tab and in the Cyber tab', !broken.length, broken.join(' | '));

  /* ----- Prompt optimizer: long picture prompts are cut at a comma or full stop ----- */
  const PA = {};
  vm.runInContext(rd('web/js/promptopt.js'), vm.createContext({ A: PA, ls: { get: (k, d) => d, set() { } }, document: {}, Math, String, Object, Array, JSON }), { filename: 'promptopt.js' });
  const clip = PA.promptOpt && PA.promptOpt.clip;
  ok('prompt optimizer: the cut helper exists', typeof clip === 'function');
  if (clip) {
    const fox = 'A red fox with a white-tipped tail stands on a snowy forest floor, its fur fluffed against the cold, eyes alert and ears perked. The forest is dense with tall evergreen trees, their branches heavy with snow. Soft morning light filters through the trees, casting a warm glow on the fox and the pristine white snow. The image is captured with a high-resolution camera, using a 70-200mm lens to isolate the fox and create a shallow depth of field, highly detailed';
    const c = clip(fox, 75), n = c.split(/\s+/).length;
    ok('prompt optimizer: a long picture prompt keeps at most 75 words', n <= 75, n + ' words');
    ok('prompt optimizer: a long picture prompt ends at a comma or full stop, never mid-phrase', /(snow|camera)$/.test(c) && fox.startsWith(c), c.slice(-60));
    eq('prompt optimizer: a short prompt is left alone', clip('a fox, snow, golden hour', 75), 'a fox, snow, golden hour');
    eq('prompt optimizer: with no comma to stop at, a dangling "a" or "the" is dropped', clip('one two three four the five six', 5), 'one two three four');
  }
};

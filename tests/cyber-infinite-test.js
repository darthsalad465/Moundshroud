// Tests for the infinite procedural puzzle generators across all 6 Cyber & Hacking games.
const fs = require('fs'), path = require('path'), vm = require('vm');

async function run(ok) {
  const root = path.join(__dirname, '..');
  const src = fs.readFileSync(path.join(root, 'web', 'js', 'cyber-games.js'), 'utf8');
  const store = new Map();
  const stub = id => {
    const e = { id, kids: [], style: {}, dataset: {}, value: '', textContent: '', scrollTop: 0, scrollHeight: 0, disabled: false, checked: false,
      classList: { add() { }, remove() { }, toggle() { }, contains: () => false }, focus() { }, blur() { }, remove() { }, setAttribute() { }, getAttribute: () => null,
      addEventListener() { }, removeEventListener() { }, querySelectorAll: () => [], closest: () => null, insertAdjacentHTML() { }, scrollIntoView() { },
      appendChild(c) { this.kids.push(c); return c; } };
    let html = '';
    Object.defineProperty(e, 'innerHTML', { get: () => html, set: v => { html = String(v); e.kids = []; e.found = {}; for (const m of html.matchAll(/id="([^"]+)"/g)) e.found[m[1]] = stub(m[1]); } });
    e.found = {}; e.querySelector = sel => { const m = /^#([\w-]+)$/.exec(sel); return m ? e.found[m[1]] || null : null; };
    return e;
  };
  const A = { play: { games: {} }, toast() { } };
  const ctx = vm.createContext({
    A,
    ls: { get: (k, d) => store.has(k) ? store.get(k) : d, set: (k, v) => store.set(k, String(v)) },
    esc: s => String(s),
    btoa: s => Buffer.from(s, 'binary').toString('base64'),
    atob: s => Buffer.from(s, 'base64').toString('binary'),
    document: { querySelector: () => null, getElementById: () => null, createElement: () => stub('') },
    window: { getSelection: () => ({ toString: () => '' }) },
    setTimeout: () => 0, clearTimeout() { }, setInterval: () => 0, clearInterval() { },
    Math, console, Object, Array, Set, Map, String, Number, RegExp, JSON, encodeURIComponent, decodeURIComponent, parseInt, parseFloat, isNaN
  });
  vm.runInContext(src, ctx, { filename: 'cyber-games.js' });
  const L = A.play.logic;

  // 1. Elo Rating Engine
  const r = L.makeRating('test_elo');
  const startElo = r.rating;
  const dWin = r.update(true, 4, false);
  const afterWin = r.rating;
  const dLoss = r.update(false, 2, false);
  ok('cyber-inf: Elo rating tracks wins, streaks, and losses', dWin > 0 && afterWin > startElo && dLoss < 0 && r.solved === 1 && r.best === 1 && r.streak === 0);

  // 2. Cipher Breaker — 60 procedural puzzles across all 6 tiers
  const cts = new Set();
  let cipherValid = true;
  for (let i = 0; i < 60; i++) {
    const p = L.cipher.make(1 + (i % 6));
    if (!p || !p.ct || !p.pt || !p.info || !p.tag) cipherValid = false;
    else cts.add(p.ct);
  }
  ok('cyber-inf: Cipher Breaker generates 60 valid procedural puzzles with high variety', cipherValid && cts.size >= 45, 'unique=' + cts.size);

  // 3. Terminal Hacker — 40 endless CTF machines + new commands (xxd, rot13, rev, endless)
  const flags = new Set(), hosts = new Set();
  let termValid = true;
  for (let i = 1; i <= 40; i++) {
    const m = L.terminal.makeMission(i, ['easy', 'med', 'hard', 'auto'][i % 4]);
    const tree = m && typeof m.fs === 'function' ? m.fs() : null;
    if (!m || !/^FLAG\{[a-z0-9_]+\}$/i.test(m.flag) || !tree || !Object.keys(tree).length || !m.goal || !m.hint) termValid = false;
    else { flags.add(m.flag); hosts.add(m.host); }
  }
  ok('cyber-inf: Terminal Hacker generates 40 unique endless CTF machines', termValid && flags.size >= 36 && hosts.size >= 4, 'flags=' + flags.size + ' hosts=' + hosts.size);

  const elT = stub('cygstage');
  A.play.games.terminal.mount(elT, { hud() { }, submit() { }, level: 1 });
  const to = elT.found.to, ti = elT.found.ti;
  const runCmd = cmd => { to.kids = []; ti.value = cmd; ti.onkeydown({ key: 'Enter', preventDefault() { } }); return to.kids.map(k => k.textContent || k.innerHTML || '').join('\n'); };
  const xxdOut = runCmd('echo HELLO | xxd | xxd -r');
  const rotOut = runCmd('echo URYYB | rot13');
  const revOut = runCmd('echo DRAHS | rev');
  runCmd('endless hard');
  const tgHtml = elT.found.tg.innerHTML;
  ok('cyber-inf: Terminal shell supports xxd -r, rot13, rev, and "endless hard" mode',
    xxdOut.includes('HELLO') && rotOut.includes('HELLO') && revOut.includes('SHARD') && /Endless CTF/.test(tgHtml),
    JSON.stringify({ xxdOut, rotOut, revOut, tg: tgHtml.slice(0, 60) }));

  // 4. SQL Injection Dojo — 40 procedural puzzles across all 7 archetypes, verifying every single one is solvable
  let sqlValid = true, sqlSolvable = 0;
  const sqlTags = new Set();
  for (let i = 0; i < 40; i++) {
    const p = L.sql.makePuzzle(['easy', 'med', 'hard', 'auto'][i % 4]);
    if (!p || !p.rows || !p.rows.length || !p.build || !p.win || !p.hint) { sqlValid = false; continue; }
    sqlTags.add(p.tag);
    let u = '', pw = '';
    if (p.numeric) { u = '0 OR id=103 --'; }
    else if (p.tag === 'Parenthesized WHERE') { u = p.targetName + "') --"; }
    else if (p.tag === 'No Comments Filter') { u = p.targetName + "' OR " + p.uCol + "='" + p.targetName; pw = "' AND '1'='0"; }
    else if (p.tag === 'Double-Paren + Role + No Comments') { u = 'x'; pw = "') OR " + p.uCol + "='" + p.targetName + "' OR ('1'='0"; }
    else if (p.tag === 'Keyword WAF (strips "or")') { u = 'x'; pw = "' OR '1'='1"; }
    else { u = p.targetName + "' --"; }
    const su = L.sql.applySan(p.san, u), sp = L.sql.applySan(p.san, pw);
    const out = L.sql.sqlRun(p.build(su, sp), p.rows);
    if (p.win(su, sp, out)) sqlSolvable++;
  }
  ok('cyber-inf: SQL Injection Dojo generates 40 varied, mathematically solvable puzzles', sqlValid && sqlSolvable === 40 && sqlTags.size >= 5, 'solvable=' + sqlSolvable + '/40 tags=' + sqlTags.size);

  // 5. Phish Spotter — 60 procedural emails with both phish & legit + forensic headers
  let phishCnt = 0, legitCnt = 0, phishValid = true;
  const subjs = new Set();
  for (let i = 0; i < 60; i++) {
    const m = L.phish.makeEmail(['easy', 'med', 'hard', 'auto'][i % 4]);
    if (!m || !m.from || !m.subj || !m.body || !Array.isArray(m.why) || !m.why.length || !m.hdr || !m.hdr.spf) phishValid = false;
    else { if (m.phish) phishCnt++; else legitCnt++; subjs.add(m.subj); }
  }
  ok('cyber-inf: Phish Spotter generates varied legit & phishing emails with SPF/DKIM headers', phishValid && phishCnt >= 15 && legitCnt >= 10 && subjs.size >= 30, 'phish=' + phishCnt + ' legit=' + legitCnt + ' uniqueSubj=' + subjs.size);

  // 6. Net Ninja — 80 questions across all 5 categories
  const netCats = ['ports', 'subnets', 'firewalls', 'chmod', 'concepts'];
  let netValid = true;
  const netQs = new Set();
  for (let i = 0; i < 80; i++) {
    const q = L.net.makeQuestion(netCats[i % netCats.length]);
    if (!q || !q.q || !Array.isArray(q.o) || q.o.length < 4 || !q.o.includes(q.a) || new Set(q.o).size !== q.o.length || !q.e) netValid = false;
    else netQs.add(q.q);
  }
  ok('cyber-inf: Net Ninja generates 80 valid questions across Ports, Subnets, Firewalls, Chmod & Concepts', netValid && netQs.size >= 55, 'uniqueQ=' + netQs.size);

  // 7. Log Detective — 36 SOC cases across all 6 attack scenarios
  const socKinds = ['ssh', 'spray', 'webscan', 'sqliweb', 'exfil', 'travel'];
  let socValid = true;
  const socSeen = new Set();
  for (let i = 0; i < 36; i++) {
    const c = L.logs.makeCase(socKinds[i % socKinds.length], i % 6);
    const hasA1InRows = c && Array.isArray(c.rows) && c.rows.some(r => r.raw.includes(c.a1));
    if (!c || !c.opts1.includes(c.a1) || !c.opts2.includes(c.a2) || !hasA1InRows || !c.lesson) socValid = false;
    else socSeen.add(c.kind);
  }
  ok('cyber-inf: Log Detective generates 36 valid SOC cases across all 6 attack scenarios', socValid && socSeen.size === 6, 'scenarios=' + socSeen.size);
}

if (require.main === module) {
  let pass = 0, fail = 0;
  const ok = (name, cond, detail) => {
    if (cond) { pass++; console.log('  ok  ', name); }
    else { fail++; console.error('  FAIL', name, detail || ''); }
  };
  console.log('Infinite Procedural Cyber & Hacking Games');
  run(ok).then(() => {
    console.log('\n' + pass + ' passed, ' + fail + ' failed');
    process.exit(fail ? 1 : 0);
  }).catch(e => { console.error(e); process.exit(1); });
}

module.exports = run;

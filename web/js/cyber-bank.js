// Cyber > Cyber Desktop > Bank. Practice money, earned only by finishing simulated work in this app:
// a puzzle solved, a fake site exploited, a case closed, a phishing message reported. None of it is real,
// nothing can be deposited, withdrawn or moved, and the whole account lives in this browser.
(() => {
  const KEY = 'cyber_bank_v1';
  const GAMES = {
    cycipher: 'Cipher Breaker', cyterm: 'Terminal puzzles', cysql_elo: 'SQL Injection Dojo',
    cyphish: 'Phishing Spotter', cynet: 'Network puzzles', cylog: 'Log analysis',
    tops: 'Terminal Ops', lfo: 'Live Fire', rasim: 'Remote Access', cynetgames: 'Network puzzles'
  };
  const RATES = [
    ['Puzzle solved', 'from $14', 'More for each difficulty tier; half credit if you took a hint.'],
    ['Academy step answered', '$18', 'Each correct answer in the Cyber Academies, and $60 for a whole lesson.'],
    ['Fake site: access gained', '$60', 'Signing in to a generated site with the staff login its leaked files printed.'],
    ['Fake site: data pulled', '$8–$90', 'robots.txt, the .env, the user list, an IDOR order, a SQL error and the backup: once each per site.'],
    ['Fake site: fully owned', '$250', 'Access, the leaked .env and the backup archive on one site ($350 on a finance or exchange site).'],
    ['Remote session verified', '$30', 'A correct finding in Remote Sessions, once per generated case.'],
    ['Website lab mission owned', '$40', 'A mission completed in the Website Lab; $200 for the core five on one site.'],
    ['Vulnerability exploited', '$60', 'Every bug found on a simulated site in Breach Lab.'],
    ['Target fully owned', '$400', 'All of a site’s bugs found on one instance; $700 for a finance target.'],
    ['Incident case closed', '$40', 'A correct answer in Incident Desk, paid once per case.'],
    ['Phishing message reported', '$20', 'Reported from Mail. Paid once per message.'],
    ['Email website mission', '$50–$270', 'Complete the mission included in any Cyber Mail email linking to a website; paid automatically on completion.'],
    ['Cosmetics shop', 'money out', 'Wallpapers and accents for the desktop. Spending moves money out of the balance; “earned overall” never goes down.']
  ];
  const fresh = () => ({
    balance: 250,
    opened: Date.now(),
    stats: { puzzles: 0, exploits: 0, cases: 0, phish: 0, targets: 0 },
    history: [{ at: Date.now(), amount: 250, label: 'Practice account opened', kind: 'open' }],
    balanceStart: 250,
    /* lifetime totals: what came in and what went out, so spending never hides what the work was worth */
    earnedTotal: 250,
    spentTotal: 0,
    owned: {},
    /* every event that has already been paid, so the same finding never pays twice */
    awards: {}
  });
  const clean = saved => {
    if (!saved || !Number.isFinite(saved.balance) || !Array.isArray(saved.history)) return null;
    const state = Object.assign(fresh(), saved);
    state.balance = Math.round(Number(saved.balance) * 100) / 100;
    state.stats = Object.assign({ puzzles: 0, exploits: 0, cases: 0, phish: 0, targets: 0 }, saved.stats || {});
    state.history = saved.history.slice(0, 60);
    state.awards = Object.assign({}, saved.awards || {});
    if (!Number.isFinite(state.balanceStart)) state.balanceStart = 250;
    /* an account saved before lifetime totals existed is rebuilt from its statement */
    const money = n => Math.round(Number(n) * 100) / 100;
    const positives = state.history.reduce((n, row) => n + (row.amount > 0 ? row.amount : 0), 0);
    const negatives = state.history.reduce((n, row) => n - (row.amount < 0 ? row.amount : 0), 0);
    if (!Number.isFinite(state.earnedTotal)) {
      state.earnedTotal = money(Math.max(positives, state.balance - state.balanceStart + negatives));
    }
    if (!Number.isFinite(state.spentTotal)) state.spentTotal = money(negatives);
    state.owned = Object.assign({}, saved.owned || {});
    return state;
  };
  let state = (() => {
    try { return clean(JSON.parse(ls.get(KEY, '') || 'null')) || fresh(); } catch (error) { return fresh(); }
  })();
  const listeners = new Set();
  const save = () => {
    try { ls.set(KEY, JSON.stringify(state)); } catch (error) { /* storage may be off: the account still works for this session */ }
    for (const listener of [...listeners]) { try { listener(state); } catch (error) { /* a closed window cannot break the bank */ } }
  };
  const round = n => Math.round(Number(n) * 100) / 100;
  const money = n => (n < 0 ? '-' : '') + '$' + Math.abs(round(n)).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const time = at => new Date(at).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });

  function credit(amount, label, kind) {
    amount = round(amount);
    if (!Number.isFinite(amount) || amount <= 0) return state.balance;
    state.balance = round(state.balance + amount);
    state.earnedTotal = round((state.earnedTotal || 0) + amount);
    state.history.unshift({ at: Date.now(), amount, label: String(label || 'Practice work').slice(0, 160), kind: kind || 'work' });
    if (state.history.length > 60) state.history.length = 60;
    save();
    return state.balance;
  }
  function count(name) { if (Object.hasOwn(state.stats, name)) { state.stats[name]++; save(); } }
  /* one call per kind of exercise, so every part of the desktop pays the same rates */
  const bank = {
    money,
    get balance() { return state.balance; },
    get earned() { return round(state.balance - state.balanceStart); },
    stats: () => Object.assign({}, state.stats),
    history: () => state.history.slice(),
    rates: () => RATES.map(row => row.slice()),
    game: key => GAMES[key] || 'Puzzle',
    credit,
    /* pays for an event exactly once; the key names the event (a site and what was found on it, a case, a step) */
    once(key, amount, label, kind, stat) {
      key = String(key == null ? '' : key);
      amount = round(amount);
      if (!key || !Number.isFinite(amount) || amount <= 0) return false;
      state.awards = state.awards || {};
      if (Object.hasOwn(state.awards, key)) return false;
      state.awards[key] = Date.now();
      const keys = Object.keys(state.awards);
      if (keys.length > 4000) { keys.sort((a, b) => state.awards[a] - state.awards[b]).slice(0, 1500).forEach(old => { delete state.awards[old]; }); }
      if (stat && Object.hasOwn(state.stats, stat)) state.stats[stat]++;
      credit(amount, label, kind || 'work');
      return true;
    },
    paid: key => !!(state.awards && Object.hasOwn(state.awards, String(key))),
    awards: () => Object.keys(state.awards || {}).length,
    /* what the work was worth, all of it, no matter how much of it has since been spent */
    get earnedTotal() { return round(state.earnedTotal || 0); },
    get spent() { return round(state.spentTotal || 0); },
    owns: key => !!(state.owned && Object.hasOwn(state.owned, String(key))),
    owned: () => Object.keys(state.owned || {}),
    debit(amount, label) {
      amount = round(amount);
      if (!Number.isFinite(amount) || amount <= 0 || amount > state.balance) return false;
      state.balance = round(state.balance - amount);
      state.spentTotal = round((state.spentTotal || 0) + amount);
      state.history.unshift({ at: Date.now(), amount: -amount, label: String(label || 'Spent'), kind: 'spend' });
      save();
      return true;
    },
    /* buying a cosmetic: money leaves the balance, “earned overall” stays exactly where it was */
    buy(key, amount, label) {
      key = String(key == null ? '' : key);
      if (!key) return false;
      if (bank.owns(key)) return true;
      if (!bank.debit(amount, label || 'Cosmetic unlocked')) return false;
      state.owned = state.owned || {};
      state.owned[key] = Date.now();
      save();
      return true;
    },
    puzzleSolved(key, { diff = 2, hinted = false } = {}) {
      const base = 8 + Math.max(1, Math.min(7, Number(diff) || 2)) * 6;
      credit(hinted ? base / 2 : base, (GAMES[key] || 'Puzzle') + ' solved' + (hinted ? ' (with a hint)' : ''), 'puzzle');
      count('puzzles');
    },
    exploit(host) { credit(60, 'Vulnerability exploited on ' + host, 'exploit'); count('exploits'); },
    target(brand, finance) { credit(finance ? 700 : 400, 'Target fully owned: ' + brand, 'target'); count('targets'); },
    caseClosed(name) { credit(40, 'Case closed: ' + name, 'case'); count('cases'); },
    phishReported(from) { credit(20, 'Phishing message reported: ' + from, 'phish'); count('phish'); },
    subscribe(listener) { listeners.add(listener); return () => listeners.delete(listener); },
    reset() { state = fresh(); save(); }
  };
  bank.reset = () => { state = fresh(); save(); };

  /* the window: a balance, what pays what, and a statement of everything earned */
  bank.app = function (body) {
    body.innerHTML = '<div class="cd-content cd-bank">' +
      '<header class="cd-bank-head"><div><span class="cd-bank-kicker">Moundshroud Practice Bank · account 4471-0026</span>' +
        '<h2 data-bank-balance></h2><p class="cd-bank-sub">Practice funds. Every dollar here was earned by finishing a simulated exercise in this desktop. ' +
        'It is not real money, it cannot be withdrawn or used outside this page, and it never leaves this browser. ' +
        '“Earned overall” is a lifetime figure: spending it in the Cosmetics shop never lowers it.</p></div>' +
        '<div class="cd-bank-actions"><button type="button" data-bank="shop" class="cd-primary">Cosmetics shop</button>' +
        '<button type="button" data-bank="statement">Download statement</button>' +
        '<button type="button" data-bank="reset" class="dang">Reset account</button></div></header>' +
      '<div class="cd-bank-cards">' +
        '<div class="cd-bank-card"><span>Earned overall</span><b data-bank-earned></b></div>' +
        '<div class="cd-bank-card"><span>In the account</span><b data-bank-balance2></b></div>' +
        '<div class="cd-bank-card"><span>Spent on cosmetics</span><b data-bank-spent></b></div>' +
        '<div class="cd-bank-card"><span>Puzzles solved</span><b data-bank-puzzles></b></div>' +
        '<div class="cd-bank-card"><span>Vulnerabilities found</span><b data-bank-exploits></b></div>' +
        '<div class="cd-bank-card"><span>Sites fully owned</span><b data-bank-targets></b></div>' +
        '<div class="cd-bank-card"><span>Cases closed</span><b data-bank-cases></b></div>' +
        '<div class="cd-bank-card"><span>Phishing reported</span><b data-bank-phish></b></div>' +
      '</div>' +
      '<div class="cd-bank-grid"><section><h3>Where money comes from</h3><table class="cd-bank-rates"><tbody>' +
        RATES.map(([what, amount, how]) => '<tr><th>' + what + '</th><td>' + amount + '</td><td class="mute">' + how + '</td></tr>').join('') +
      '</tbody></table><p class="cd-bank-note">Hints cost you half a puzzle’s pay — the same trade as anywhere else.</p></section>' +
      '<section><h3>Recent activity</h3><ol class="cd-bank-ledger" data-bank-ledger></ol></section></div>' +
      '<p class="cd-bank-fine">This is a training toy, not a financial product. It has no connection to a bank, a card, a wallet or a payment service, ' +
      'and it cannot send or receive money.</p>';
    const q = selector => body.querySelector(selector);
    let confirming = false;
    const paint = () => {
      q('[data-bank-balance]').textContent = money(state.balance);
      q('[data-bank-earned]').textContent = money(state.earnedTotal || 0);
      q('[data-bank-balance2]').textContent = money(state.balance);
      q('[data-bank-spent]').textContent = money(state.spentTotal || 0);
      q('[data-bank-puzzles]').textContent = state.stats.puzzles;
      q('[data-bank-exploits]').textContent = state.stats.exploits;
      q('[data-bank-targets]').textContent = state.stats.targets;
      q('[data-bank-cases]').textContent = state.stats.cases;
      q('[data-bank-phish]').textContent = state.stats.phish;
      q('[data-bank-ledger]').innerHTML = state.history.length
        ? state.history.map(row => '<li class="' + (row.amount < 0 ? 'out' : 'in') + '"><b>' + money(row.amount) + '</b>' +
            '<span>' + row.label.replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]) + '</span>' +
            '<i>' + time(row.at) + '</i></li>').join('')
        : '<li class="mute">Nothing yet. Solve a puzzle or exploit a simulated site and the credit appears here.</li>';
    };
    paint();
    const stop = bank.subscribe(paint);
    const unconfirm = () => { confirming = false; const button = q('[data-bank="reset"]'); if (button) { button.textContent = 'Reset account'; button.classList.add('dang'); } };
    const onClick = event => {
      const button = event.target.closest('[data-bank]');
      if (!button) return;
      if (button.dataset.bank === 'reset') {
        if (!confirming) { confirming = true; button.textContent = 'Press again to reset'; button.classList.remove('dang'); setTimeout(unconfirm, 5000); return; }
        unconfirm();
        bank.reset();
        A.toast('Practice account reset.');
      } else if (button.dataset.bank === 'shop') {
        const open = A.cyberDesktop && A.cyberDesktop.api && A.cyberDesktop.api.open;
        if (open) open('cosmetics');
        else A.toast('Open Cosmetics from the Applications menu.');
      } else if (button.dataset.bank === 'statement') {
        const lines = ['Moundshroud Practice Bank — statement', 'Account 4471-0026 (simulated, no real money)', '',
          'Balance: ' + money(state.balance), 'Earned overall: ' + money(state.earnedTotal || 0),
          'Spent on cosmetics: ' + money(state.spentTotal || 0), ''].concat(state.history.map(row =>
          time(row.at) + '\t' + money(row.amount) + '\t' + row.label));
        const blob = new Blob([lines.join('\n') + '\n'], { type: 'text/plain' });
        const link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        link.download = 'practice-bank-statement.txt';
        body.append(link);
        link.click();
        link.remove();
        setTimeout(() => URL.revokeObjectURL(link.href), 5000);
        A.toast('Statement downloaded.');
      }
    };
    body.addEventListener('click', onClick);
    return () => { stop(); body.removeEventListener('click', onClick); };
  };

  /* the Terminal Playground runs in an iframe with its own storage: it reports puzzle, Labyrinth, job and
     mission wins here through the parent window so the same bank pays for them */
  window.addEventListener('message', event => {
    const detail = event.data && event.data.type === 'cyber-earned' ? event.data.detail : null;
    /* the desktop's Terminal Playground runs in a sandboxed frame, so its win arrives with a null origin */
    if (!detail || (event.origin !== location.origin && event.origin !== 'null')) return;
    const depth = Math.max(1, Number(detail.depth) || 1);
    if (detail.kind === 'puzzle') bank.puzzleSolved('cyterm', { diff: Math.max(1, Math.min(7, Number(detail.diff) || 4)), hinted: !!detail.hinted });
    else if (detail.kind === 'lab') credit(12 + Math.min(6, depth) * 4, 'Labyrinth floor cleared (depth ' + depth + ')', 'lab');
    else if (detail.kind === 'mission') credit(25, 'Terminal mission: ' + String(detail.title || 'help mission').slice(0, 90), 'mission');
    else if (detail.kind === 'job') credit(15, 'Terminal job completed', 'job');
  });

  A.cyberBank = bank;
})();

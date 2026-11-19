// Entertainment > Games > Model Monsters: build a squad of local AI models and take on the Curators.
// The monster's stats are the model's real metadata (read by /api/models/stats): file size, parameters,
// quantization, context window, capabilities and measured tokens/sec. The rules live in modelmon-core.js.
(() => {
  const P = A.play, C = window.ModelMon; if (!P || !C) return;
  const REC_KEY = 'mm_record', SPEED_KEY = 'mm_speed', STATS_KEY = 'mm_stats', SQUAD_KEY = 'mm_squad',
    CORES_KEY = 'mm_cores', CHAMP_KEY = 'mm_champ', REG_KEY = 'mm_reg', PLAY_KEY = 'mm_play';
  /* everything the game remembers about your monsters; Reset progress clears exactly these */
  const WIPE_KEYS = [REC_KEY, SPEED_KEY, STATS_KEY, SQUAD_KEY, CORES_KEY, CHAMP_KEY, REG_KEY, PLAY_KEY];
  const STAT_MAX = { hp: 280, atk: 155, def: 135, spa: 150, spd: 150, spe: 165 };
  const STAT_LABEL = { hp: 'HP', atk: 'Attack', def: 'Defence', spa: 'Sp. Atk', spd: 'Sp. Def', spe: 'Speed' };
  const STAT_SHORT = { hp: 'HP', atk: 'ATK', def: 'DEF', spa: 'SPA', spd: 'SPD', spe: 'SPE' };
  const TIER_ORDER = ['nano', 'small', 'medium', 'large', 'titan'];

  function loadJson(key, fallback) { try { const v = JSON.parse(ls.get(key, '')); return v == null ? fallback : v; } catch (e) { return fallback; } }
  function record() {
    const r = loadJson(REC_KEY, {}) || {};
    return { w: +r.w || 0, l: +r.l || 0, streak: +r.streak || 0 };
  }
  function saveRecord(r) { ls.set(REC_KEY, JSON.stringify(r)); }
  const speedMap = loadJson(SPEED_KEY, {}) || {};

  /* ---------------- trainer progress ----------------
     A registered monster starts at trainer level 1 and grows by battling and by spending time with you. The level it
     fights at is derived from that (a fresh one is genuinely weaker), its stats grow with it, and friendship adds a
     small bonus on top. Nothing here is stored on the model itself: the metadata in Ollama never changes. */
  const MAX_LV = 100, MAX_FR = 400;
  const xpNeed = lv => 30 + lv * 22;
  const FRIEND = [
    { at: 0, name: 'Stranger', icon: '·', bonus: 0 },
    { at: 40, name: 'Curious', icon: '🌱', bonus: .03 },
    { at: 100, name: 'Friendly', icon: '💛', bonus: .06 },
    { at: 200, name: 'Trusted', icon: '💞', bonus: .09 },
    { at: 320, name: 'Inseparable', icon: '💖', bonus: .13 }
  ];
  const clampNum = (n, a, b) => Math.max(a, Math.min(b, +n || 0));
  const frTier = fr => { let t = FRIEND[0]; for (const x of FRIEND) if (fr >= x.at) t = x; return t; };
  /* the level a monster fights at: 20 at trainer level 1, 100 at trainer level 100 */
  const battleLevel = lv => 20 + Math.round((clampNum(lv, 1, MAX_LV) - 1) * 80 / (MAX_LV - 1));
  const levelMul = lv => 1 + (clampNum(lv, 1, MAX_LV) - 1) / (MAX_LV - 1) * .35;

  /* models that stand in when this PC has none: the same rules, the same stats-from-metadata, nothing to install */
  const SAMPLE = [
    { name: 'sample-llama-1.1b', family: 'llama', parameters: 1100000000, size: 700000000, quantization_level: 'Q4_K_M', context: 2048, capabilities: ['completion'], sample: true },
    { name: 'sample-qwen-3b', family: 'qwen', parameters: 3000000000, size: 1900000000, quantization_level: 'Q4_K_M', context: 32768, capabilities: ['completion', 'tools'], sample: true },
    { name: 'sample-gemma-4b', family: 'gemma', parameters: 4000000000, size: 2600000000, quantization_level: 'Q4_K_M', context: 8192, capabilities: ['completion', 'vision'], sample: true },
    { name: 'sample-mistral-7b', family: 'mistral', parameters: 7300000000, size: 4400000000, quantization_level: 'Q4_K_M', context: 32768, capabilities: ['completion'], sample: true },
    { name: 'sample-deepseek-r1-8b', family: 'deepseek', parameters: 8000000000, size: 4900000000, quantization_level: 'Q4_K_M', context: 65536, capabilities: ['completion', 'thinking'], sample: true },
    { name: 'sample-phi-3-mini', family: 'phi', parameters: 3800000000, size: 2300000000, quantization_level: 'Q4_0', context: 4096, capabilities: ['completion'], sample: true },
    { name: 'sample-granite-8b', family: 'granite', parameters: 8100000000, size: 5000000000, quantization_level: 'Q5_K_M', context: 8192, capabilities: ['completion', 'tools'], sample: true },
    { name: 'sample-tinyllama-1b', family: 'llama', parameters: 1100000000, size: 640000000, quantization_level: 'Q3_K_S', context: 2048, capabilities: ['completion'], sample: true }
  ];

  function registry() {
    const r = loadJson(REG_KEY, {});
    return r && typeof r === 'object' && !Array.isArray(r) ? r : {};
  }
  function saveRegistry(r) { ls.set(REG_KEY, JSON.stringify(r)); }
  function entryOf(reg, name) {
    const e = reg[name];
    if (e && typeof e === 'object') return Object.assign({ nick: '', lv: 1, xp: 0, fr: 0, seen: Date.now(), acts: {}, at: 0, scans: 0 }, e);
    return null;
  }
  /* adds xp and climbs as many levels as it earns; returns the levels gained */
  function giveXp(e, amount) {
    let up = 0;
    e.xp = (+e.xp || 0) + Math.max(0, Math.round(amount));
    while (e.lv < MAX_LV && e.xp >= xpNeed(e.lv)) { e.xp -= xpNeed(e.lv); e.lv++; up++; }
    if (e.lv >= MAX_LV) e.xp = Math.min(e.xp, xpNeed(MAX_LV) - 1);
    return up;
  }
  const nm = mon => (mon && (mon.nick || mon.name)) || 'Unknown';

  reg();

  function reg() {
    P.games.modelmon = {
      name: 'Model Monsters', icon: '⚔️',
      desc: 'Build a squad of your local AI models and challenge the six Curators. Every stat comes from the model\'s real size, parameters, quantization, context and speed.',
      mount
    };
  }

  /* ---------------- the screen ---------------- */
  function mount(el, api) {
    let stopped = false, models = [], roster = [], squad = [], squadNames = loadJson(SQUAD_KEY, null);
    let screen = 'home', battle = null, pending = null, lastBattle = null;
    let busy = false, auto = false, watchMode = false, finished = false, autoTimer = 0;
    let timers = [], visibleLog = [], benchBusy = false, modalReturn = null, currentMessage = '';
    let reg = registry(), pgName = '', pgLog = [], pgDraft = '', aiBusy = false, scanBusy = false;
    const rec = record();
    let cores = loadJson(CORES_KEY, []) || [];
    if (!Array.isArray(cores)) cores = [];
    let champ = ls.get(CHAMP_KEY, '') === '1';
    const view = { q: '', tier: 'all' };
    const ui = { menu: 'root', forced: false, log: false };

    el.innerHTML = '';
    paintLoading();
    updateHud();

    const saved = loadJson(STATS_KEY, null);
    if (saved && Array.isArray(saved.models) && saved.models.length) {
      models = cleanModels(saved.models);
      rebuild();
      paintHome();
    }
    loadModels(false);

    el.addEventListener('click', onClick);
    el.addEventListener('input', onInput);
    el.addEventListener('change', onChange);
    document.addEventListener('keydown', onKey);

    /* ---------- helpers ---------- */
    function updateHud() {
      const best = P.best ? P.best('modelmon') : null;
      api.hud('W ' + rec.w + ' · L ' + rec.l + (rec.streak ? ' · 🔥 ' + rec.streak : '') + ' · 🏅 ' + cores.length + '/6' + (champ ? ' · 🏆' : '') + (best != null ? ' · ⚡ ' + best + ' turns' : ''));
    }
    function cleanModels(list) {
      const agent = /(^|[-_.])agent($|[-_.:])/i, embed = /(^|[\/:_-])(embed|embedding|bge|nomic|e5|gte|minilm|rerank)([\/:_-]|$)/i;
      let out = (list || []).filter(m => m && m.name && !m.cloud && !m.embedding && !agent.test(m.name) && !embed.test(m.name));
      if (!out.length) out = (list || []).filter(m => m && m.name && !m.cloud);
      return out.slice(0, 40);
    }
    function rebuild() {
      reg = registry();
      const now = Date.now(); let touched = false;
      roster = models.map(m => {
        try {
          const mon = C.buildMonster(m, { speed: speedMap[m.name] });
          const e = entryOf(reg, m.name);
          if (e) {
            /* time spent away is friendship, slowly: three points an hour, ten at most per visit */
            const hours = Math.max(0, (now - (+e.seen || now)) / 3600000);
            const trickle = Math.min(10, Math.floor(hours * 3));
            if (trickle > 0) { e.fr = clampNum((+e.fr || 0) + trickle, 0, MAX_FR); touched = true; }
            e.seen = now; reg[m.name] = e;
          }
          return applyProgress(mon, e);
        } catch (err) { return null; }
      }).filter(Boolean);
      if (touched) saveRegistry(reg);
      roster.sort((a, b) => (b.lv - a.lv) || a.name.localeCompare(b.name));
      reconcileSquad();
    }
    /* the level, friendship and nickname a model has earned; the metadata itself is untouched */
    function applyProgress(mon, e) {
      const lv = clampNum(e && e.lv ? e.lv : 1, 1, MAX_LV);
      const fr = clampNum(e && e.fr ? e.fr : 0, 0, MAX_FR);
      mon.nick = (e && e.nick) || '';
      mon.lv = lv; mon.xp = e ? +e.xp || 0 : 0; mon.fr = fr;
      mon.friend = frTier(fr); mon.registered = !!e;
      mon.level = battleLevel(lv);
      const mul = levelMul(lv) * (1 + mon.friend.bonus);
      ['hp', 'atk', 'def', 'spa', 'spd', 'spe'].forEach(k => { if (mon.stats[k]) mon.stats[k] = Math.max(1, Math.round(mon.stats[k] * mul)); });
      mon.maxHp = mon.stats.hp; mon.hp = mon.maxHp;
      return mon;
    }
    /* only registered monsters can battle: a new arrival has to be scanned first */
    function owned() { return roster.filter(m => m.registered); }
    function unscanned() { return roster.filter(m => !m.registered); }
    function reconcileSquad() {
      if (!Array.isArray(squadNames)) squadNames = owned().slice(0, Math.min(3, owned().length)).map(m => m.name);
      const seen = new Set();
      squad = squadNames.map(byName).filter(m => m && m.registered && !seen.has(m.name) && seen.add(m.name)).slice(0, 6);
      squadNames = squad.map(m => m.name);
      saveSquad();
    }
    function byName(name) { return roster.find(m => m.name === name) || null; }
    function inSquad(name) { return squad.some(m => m.name === name); }
    function saveSquad() { ls.set(SQUAD_KEY, JSON.stringify(squadNames)); }
    function sfx(n) { try { if (A.sfx && A.sfx.on) A.sfx.play(n); } catch (e) { } }
    function wait(ms) {
      return new Promise(resolve => {
        const t = setTimeout(() => { if (!stopped) resolve(); }, ms);
        timers.push(t);
      });
    }
    function tierChip(mon) { const t = C.TIERS.find(x => x.key === mon.tier); return t ? t.icon + ' ' + t.name : mon.tier; }
    function typeChip(key) { const t = C.typeInfo(key); return '<span class="mm-type" style="--mmc:' + t.color + '">' + t.icon + ' ' + esc(t.name) + '</span>'; }
    function typeChips(mon) { return typeChip(mon.type) + (mon.type2 ? typeChip(mon.type2) : ''); }
    function speedNote(mon) { return mon.meta.measured ? Math.round(mon.meta.tps) + ' tok/s measured' : '≈' + Math.round(mon.meta.tps) + ' tok/s estimated'; }
    function monColor(mon) { return C.typeInfo(mon.type).color; }

    /* ---------- loading the real model list ---------- */
    /* Ollama can be off or wedged: without a bound the reading screen would sit there forever. */
    function timed(p, ms, why) {
      return Promise.race([p, new Promise((resolve, reject) => { timers.push(setTimeout(() => reject(new Error(why || 'Ollama did not answer in time')), ms)); })]);
    }
    async function loadModels(force) {
      const rb = el.querySelector('#mmrefresh');
      if (force && rb) { rb.disabled = true; rb.textContent = '↻ Scanning…'; }
      try {
        let j = null;
        try { j = await timed(A.api('/api/models/stats' + (force ? '?fresh=1' : '')), 12000, 'Ollama did not answer in time'); } catch (e) { }
        let list = (j && j.models) || [];
        if (!list.length) {
          const old = await timed(A.api('/api/models'), 5000).catch(() => null);
          list = ((old && old.models) || []).filter(m => m && !m.cloud);
          if (j && j.error) throw new Error(j.error);
        }
        list = cleanModels(list);
        if (stopped) return;
        if (!list.length) {
          /* no Ollama, no models: the game still plays, with sample monsters the same rules built */
          models = SAMPLE.slice();
          rebuild();
          if (screen === 'home') paintHome();
          if (force) A.toast('No local models found — playing with sample monsters. Install a model and Rescan to add the real thing.', 6000);
          return;
        }
        models = list;
        ls.set(STATS_KEY, JSON.stringify({ at: Date.now(), models }));
        rebuild();
        if (screen === 'home') paintHome();
        if (force) A.toast('Read ' + roster.length + ' local models from Ollama', 3000);
      } catch (e) {
        if (stopped) return;
        if (!roster.length) paintEmpty(e.message || 'The model list could not be read.');
        else { A.toast(e.message || 'Could not refresh the model list', 4500); if (screen === 'home') paintHome(); }
      }
    }

    function paintLoading() {
      el.innerHTML = '<div class="mm-shell"><div class="mm-load"><div class="mm-spin">⚔️</div><b>Reading your local models…</b><div class="small mute">Size, parameters, quantization, context window and capabilities, straight from Ollama.</div></div></div>';
    }
    function paintEmpty(msg) {
      el.innerHTML = '<div class="mm-shell"><div class="mm-empty"><div class="mm-emptyicon">🧬</div><h2>No monsters yet</h2><p>' + esc(msg) + '</p><p class="small mute">Model Monsters uses the models installed on this PC. It needs Ollama running; nothing leaves the computer.</p><div class="row" style="justify-content:center;gap:8px;flex-wrap:wrap"><button class="pri" id="mmrefresh">↻ Rescan models</button><button class="ib" data-sample="1">🎲 Play with sample monsters</button></div></div></div>';
    }

    /* ---------- the home screen ---------- */
    function filtered() {
      const q = view.q.trim().toLowerCase();
      return owned().filter(m => {
        if (view.tier !== 'all' && m.tier !== view.tier) return false;
        if (!q) return true;
        const hay = (m.name + ' ' + (m.meta.family || '') + ' ' + m.type + ' ' + (m.type2 || '') + ' ' + m.tier + ' ' + (m.meta.quantization_level || '')).toLowerCase();
        return q.split(/\s+/).every(w => hay.includes(w));
      });
    }
    function cardsHTML() {
      const list = filtered();
      if (!list.length) return '<div class="mm-nomatch">No model matches that search. <button class="ib" data-clear="1" style="margin-left:8px">Clear filters</button></div>';
      return list.map(mon => {
        const ti = C.typeInfo(mon.type), st = mon.stats, inS = inSquad(mon.name);
        const stats = ['hp', 'atk', 'def', 'spa', 'spd', 'spe'].map(k => '<span class="mm-s6" title="' + STAT_LABEL[k] + '"><i>' + STAT_SHORT[k] + '</i><b>' + st[k] + '</b></span>').join('');
        return '<div class="mm-card' + (inS ? ' in-squad' : '') + '" data-mon="' + esc(mon.name) + '" tabindex="0" role="button" aria-pressed="' + inS + '" aria-label="' + (inS ? 'Remove ' : 'Add ') + esc(nm(mon)) + ' ' + (inS ? 'from' : 'to') + ' squad" style="--mmc:' + ti.color + '">' +
          '<button class="mm-info" data-dex="' + esc(mon.name) + '" title="Stats, moves and model details" aria-label="Details for ' + esc(nm(mon)) + '">ⓘ</button>' +
          '<div class="mm-cardtop"><span class="mm-ava">' + esc(mon.icon) + '</span><div class="mm-cname"><b title="' + esc(mon.name) + '">' + esc(nm(mon)) + '</b><span>' + typeChips(mon) + ' <span class="mm-tier">Lv ' + mon.lv + ' · ' + tierChip(mon) + '</span></span>' +
          '<span class="small mute" style="font-size:10px">' + (mon.nick ? esc(mon.name) + ' · ' : '') + mon.friend.icon + ' ' + esc(mon.friend.name) + '</span></div></div>' +
          '<div class="mm-s6row">' + stats + '</div>' +
          '<div class="mm-cardmeta"><span>' + C.formatParams(mon.meta.parameters) + ' params</span><span>' + esc(mon.meta.quantization_level || '?') + '</span><span>' + C.formatContext(mon.meta.context) + ' ctx</span><span>' + C.formatGigabytes(mon.meta.size) + ' GB</span></div>' +
          '<div class="mm-cardfoot"><span class="small mute">' + speedNote(mon) + '</span><span class="mm-add">' + (inS ? '✓ In squad' : '＋ Squad') + '</span></div>' +
          '</div>';
      }).join('');
    }
    function squadHTML() {
      let out = '';
      for (let i = 0; i < 6; i++) {
        const mon = squad[i];
        if (mon) out += '<div class="mm-slot' + (i === 0 ? ' lead' : '') + '" style="--mmc:' + monColor(mon) + '">' +
          '<span class="mm-slotava">' + esc(mon.icon) + '</span>' +
          '<span class="mm-slotinfo"><b>' + esc(mon.name) + '</b><span>' + typeChips(mon) + '</span></span>' +
          (i === 0 ? '<span class="mm-leadtag">LEAD</span>' : '<button class="mm-slotbtn" data-lead="' + i + '" title="Make lead" aria-label="Make ' + esc(mon.name) + ' the lead">★</button>') +
          '<button class="mm-slotbtn x" data-remove="' + i + '" title="Remove from squad" aria-label="Remove ' + esc(mon.name) + ' from squad">✕</button></div>';
        else out += '<div class="mm-slot empty"><span class="mm-slotplus">＋</span><span class="mute">Add from the Box</span></div>';
      }
      return out;
    }
    function corePips() {
      return C.CURATORS.filter(c => !c.champion).map(c => {
        const has = cores.includes(c.key), t = C.typeInfo(c.type);
        return '<span class="mm-corepip' + (has ? ' on' : '') + '" style="--mmc:' + t.color + '" title="' + esc(c.name) + (has ? ' core earned' : ' core') + '">' + t.icon + '</span>';
      }).join('') + (champ ? '<span class="mm-corepip champ on" title="Champion beaten">🏆</span>' : '');
    }
    function curatorCard(c) {
      const t = c.champion ? { color: '#ffd166', icon: '🏆' } : C.typeInfo(c.type);
      const earned = cores.includes(c.key);
      const locked = c.champion && cores.length < 6 && !champ;
      const size = C.curatorTeamSize(c, api.level, roster.length);
      const status = c.champion
        ? (champ ? '🏆 Champion beaten · rematch' : locked ? '🔒 Beat all six Curators' : '⚔ Challenge the Champion')
        : (earned ? '🏅 Core earned · rematch' : '⚔ Challenge');
      return '<button class="mm-curator' + (earned ? ' earned' : '') + (locked ? ' locked' : '') + (c.champion ? ' champ' : '') + '"' + (locked ? ' disabled' : ' data-cur="' + c.key + '"') + ' style="--mmc:' + t.color + '">' +
        '<span class="mm-curicon">' + t.icon + '</span>' +
        '<span class="mm-curbody"><b>' + esc(c.name) + '</b><span>' + esc(c.title) + '</span><i>' + esc(c.line) + '</i>' +
        '<span class="mm-cursize">' + (size ? 'Team of ' + size : 'No models available') + (c.champion ? '' : ' · ' + t.icon + ' ' + esc(C.typeInfo(c.type).name)) + '</span></span>' +
        '<span class="mm-curfoot">' + status + '</span></button>';
    }
    function recordHTML() {
      const best = P.best ? P.best('modelmon') : null;
      return '<div class="mm-record">' +
        '<span title="Team battles won">🏆 <b>' + rec.w + '</b></span>' +
        '<span title="Team battles lost">💀 <b>' + rec.l + '</b></span>' +
        '<span title="Current winning streak">🔥 <b>' + rec.streak + '</b></span>' +
        '<span title="Cores earned">🏅 <b>' + cores.length + '/6</b></span>' +
        (best != null ? '<span title="Fewest turns in a winning team battle">⚡ <b>' + best + '</b></span>' : '') +
        (champ ? '<span class="mm-champbadge" title="The Champion has been beaten">🏆 Champion</span>' : '') +
        '</div>';
    }
    function paintHome(focusName) {
      if (!roster.length) { paintEmpty('No local AI models were found. Install one in Models, or start Ollama, then rescan.'); return; }
      screen = 'home'; battle = null; busy = false; auto = false; finished = false; clearTimeout(autoTimer);
      el.innerHTML = '<div class="mm-shell">' +
        '<div class="mm-head"><div class="mm-title"><h2><span class="mm-logo">⚔️</span> Model Monsters</h2>' +
        '<div class="small mute">Build a squad of your local AI models and battle the six Curators. Every stat is the model\'s real size, parameters, quantization, context and speed.</div></div>' +
        recordHTML() + '</div>' +
        '<div class="mm-squadbox"><div class="mm-squadhead"><b>Your squad</b><span>' + squad.length + ' / 6</span>' +
        (squad.length ? '<span class="mm-leadnote">Lead: <b>' + esc(nm(squad[0])) + '</b></span>' : '<span class="mm-leadnote">Pick at least one scanned model from your collection.</span>') +
        '</div><div class="mm-slots">' + squadHTML() + '</div>' +
        '<div class="mm-squadtools"><button class="ib" data-squad="auto">✨ Auto squad</button><button class="ib" data-squad="clear">Clear</button>' +
        '<button class="pri" data-quick="1"' + (owned().length ? '' : ' disabled') + '>⚔ Quick battle</button>' +
        '<button class="ib" data-watch="1"' + (owned().length >= 2 ? '' : ' disabled') + '>👀 Watch a fight</button>' +
        '<button class="ib" data-pg="1"' + (owned().length ? '' : ' disabled') + '>🎮 Playground</button>' +
        '<button class="ib" data-reset="1" title="Delete all Model Monsters progress">🧹 Reset progress</button></div></div>' +
        arrivalsHTML() +
        '<div class="mm-section"><div class="mm-sechead"><div><h3>The Benchmark Circuit</h3><div class="small mute">Beat all six Curators to earn their Cores, then face The Curator.</div></div><div class="mm-corebar">' + corePips() + '</div></div>' +
        '<div class="mm-curators">' + C.CURATORS.map(curatorCard).join('') + '</div></div>' +
        '<div class="mm-section"><div class="mm-sechead"><div><h3>Your collection</h3><div class="small mute">Scanned monsters. Click one to add it to your squad; ⓘ opens the ModelDex.</div></div><div class="mm-count" id="mmcount"></div></div>' +
        '<div class="mm-toolbar"><input type="search" id="mmsrch" placeholder="Search models, families, types…" value="' + esc(view.q) + '" autocomplete="off" aria-label="Search models">' +
        '<select id="mmtier" aria-label="Filter by tier"><option value="all">All tiers</option>' + TIER_ORDER.map(k => { const t = C.TIERS.find(x => x.key === k); return '<option value="' + k + '"' + (view.tier === k ? ' selected' : '') + '>' + t.icon + ' ' + t.name + '</option>'; }).join('') + '</select>' +
        '<button class="ib" id="mmrefresh" title="Read the model list and metadata again">↻ Rescan models</button></div>' +
        '<div class="mm-grid" id="mmgrid">' + cardsHTML() + '</div></div>' +
        '</div>';
      updateGrid();
      updateHud();
      if (focusName) {
        const card = el.querySelector('[data-mon="' + String(focusName).replace(/"/g, '\\"') + '"]');
        if (card) { try { card.focus({ preventScroll: true }); } catch (e) { card.focus(); } }
      }
    }
    function updateGrid() {
      const g = el.querySelector('#mmgrid'), c = el.querySelector('#mmcount');
      if (g) g.innerHTML = cardsHTML();
      if (c) c.textContent = filtered().length + ' of ' + owned().length + ' registered';
    }

    /* ---------- team preview ---------- */
    function openPreview(kind, key) {
      if (!owned().length) { A.toast('Scan a model first — only scanned monsters can battle.', 3500); return; }
      if (kind !== 'watch' && !squad.length) { A.toast('Pick at least one model for your squad first.', 3500); return; }
      let curator = null, teamA = [], teamB = [];
      if (kind === 'curator') {
        curator = C.curatorByKey(key);
        if (!curator) return;
        if (curator.champion && cores.length < 6 && !champ) { A.toast('Beat all six Curators first.', 3500); return; }
        teamB = C.buildCuratorTeam(owned(), curator.key, { difficulty: api.level });
        teamA = squad.slice();
      } else if (kind === 'quick') {
        const size = Math.max(1, Math.min(6, squad.length || 3));
        const spare = owned().filter(m => !squad.some(s => s.name === m.name));
        teamB = C.buildQuickTeam(spare.length >= size ? spare : owned(), size);
        teamA = squad.slice();
      } else {
        const size = Math.min(3, owned().length);
        teamA = C.buildQuickTeam(owned(), size, { seed: (Date.now() ^ 0x9e3779b9) >>> 0 });
        const spare = owned().filter(m => !teamA.some(s => s.name === m.name));
        teamB = C.buildQuickTeam(spare.length >= size ? spare : owned(), size, { seed: (Date.now() ^ 0x85ebca6b) >>> 0 });
        curator = { name: 'Exhibition', title: 'Two random squads', icon: '👀', quick: true, key: 'exhibition' };
      }
      if (!teamA.length || !teamB.length) { A.toast('Two squads are needed for a battle.', 3000); return; }
      pending = { kind, curator, teamA, teamB, lead: 0 };
      paintPreview();
    }
    function paintPreview() {
      if (!pending) return;
      const p = pending, a = p.teamA, b = p.teamB;
      const lead = a[Math.max(0, Math.min(p.lead || 0, a.length - 1))];
      const tip = matchTip(lead, b[0]);
      if (!el.querySelector('#mmmodal')) modalReturn = document.activeElement;
      const old = el.querySelector('#mmmodal'); if (old) old.remove();
      const title = p.kind === 'curator' ? 'Curator battle' : p.kind === 'watch' ? 'Exhibition' : 'Quick battle';
      const sub = p.curator ? p.curator.icon + ' ' + esc(p.curator.name) + ' · ' + esc(p.curator.title) : '';
      let leadPicker = '';
      if (p.kind !== 'watch') {
        leadPicker = '<div class="mm-leadpick"><span>Lead</span><div>' + a.map((m, i) => '<button class="mm-leadbtn' + (m.name === lead.name ? ' on' : '') + '" data-leadpick="' + i + '" style="--mmc:' + monColor(m) + '" title="Send out ' + esc(m.name) + ' first">' + esc(m.icon) + ' ' + esc(m.name) + '</button>').join('') + '</div></div>';
      }
      el.insertAdjacentHTML('beforeend', '<div class="mm-modal" id="mmmodal" role="dialog" aria-modal="true" aria-label="' + title + '"><div class="mm-dialog mm-preview">' +
        '<div class="mm-mhead"><div><h2>' + title + '</h2>' + (sub ? '<div class="small mute">' + sub + '</div>' : '<div class="small mute">Two random squads fight it out.</div>') + '</div><button class="ib" data-close="1" aria-label="Close">✕</button></div>' +
        (p.kind !== 'watch' ? '<div class="mm-previewcount">Your squad <b>' + a.length + '</b> · Their squad <b>' + b.length + '</b></div>' : '') +
        '<div class="mm-preteam"><div class="mm-pteam"><div class="mm-ptitle">' + (p.kind === 'watch' ? 'Squad A' : 'Your squad') + '</div>' + teamRows(a, p.kind === 'watch' ? -1 : p.lead) + '</div>' +
        '<div class="mm-vsbig">VS</div><div class="mm-pteam"><div class="mm-ptitle">' + (p.curator ? esc(p.curator.name) : 'Opponent') + '</div>' + teamRows(b, 0) + '</div></div>' +
        leadPicker +
        '<div class="mm-matchtip">' + tip + '</div>' +
        '<div class="mm-actions"><button class="pri" data-start="1">' + (p.kind === 'watch' ? '👀 Watch the fight' : '⚔ Start battle') + '</button>' +
        (p.kind === 'quick' ? '<button class="ib" data-reroll="1">🎲 New opponent</button>' : '') +
        '<button class="ib" data-close="1">Cancel</button></div></div></div>');
      const start = el.querySelector('#mmmodal [data-start]');
      if (start) { try { start.focus({ preventScroll: true }); } catch (e) { start.focus(); } }
    }
    function teamRows(team, leadIndex) {
      return '<div class="mm-trows">' + team.map((m, i) => '<div class="mm-trow' + (i === leadIndex ? ' lead' : '') + '" style="--mmc:' + monColor(m) + '">' +
        '<span class="mm-ticon">' + esc(m.icon) + '</span><span class="mm-tinfo"><b>' + esc(nm(m)) + '</b><span>' + typeChips(m) + '</span></span>' +
        '<span class="mm-tlv">Lv ' + (m.lv || m.level) + '</span>' + (i === leadIndex ? '<span class="mm-tlead">LEAD</span>' : '') + '</div>').join('') + '</div>';
    }
    function matchTip(a, b) {
      if (!a || !b) return '';
      const am = C.typeMult(a.type, b.type), bm = C.typeMult(b.type, a.type);
      const nameA = C.typeInfo(a.type).name, nameB = C.typeInfo(b.type).name;
      let s = am > 1 ? 'Your ' + nameA + ' moves are <b>strong</b> against ' + nameB + ' (1.5×).'
        : am < 1 ? 'Your ' + nameA + ' moves are <b>weak</b> against ' + nameB + ' (0.75×).'
          : 'Your lead has no type advantage against theirs.';
      if (bm > 1) s += ' Their ' + nameB + ' moves are strong against you.';
      else if (bm < 1) s += ' Their ' + nameB + ' moves are weak against you.';
      return s;
    }
    function closeModal() {
      const m = el.querySelector('#mmmodal'); if (m) m.remove();
      const back = modalReturn; modalReturn = null;
      if (back && back.isConnected && back.focus) { try { back.focus({ preventScroll: true }); } catch (e) { } }
    }
    function startPending() {
      if (!pending) return;
      const p = pending;
      let teamA = p.teamA.slice();
      if (p.kind !== 'watch' && teamA.length > 1) {
        const i = Math.max(0, Math.min(p.lead || 0, teamA.length - 1));
        teamA = [teamA[i]].concat(teamA.filter((_, n) => n !== i));
      }
      closeModal();
      startBattle(teamA, p.teamB, { curator: p.kind === 'curator' ? p.curator : (p.kind === 'quick' ? { name: 'Rival', title: 'Quick battle', icon: '🎲', quick: true, key: 'quick' } : p.curator), watch: p.kind === 'watch' });
    }

    /* ---------- the battle ---------- */
    function startBattle(teamA, teamB, opts) {
      opts = opts || {};
      lastBattle = { teamA: teamA.slice(), teamB: teamB.slice(), curator: opts.curator || null, watch: !!opts.watch };
      battle = C.createBattle(teamA, teamB, { player: 'a', trainer: opts.curator || null, aiLevel: opts.watch ? 2 : api.level });
      watchMode = !!opts.watch; auto = watchMode; busy = false; finished = false;
      ui.menu = 'root'; ui.forced = false; ui.log = false;
      screen = 'battle';
      currentMessage = battle.log[battle.log.length - 1] || 'What will ' + battle.a.name + ' do?';
      visibleLog = battle.log.slice();
      paintBattle();
      updateHud();
      if (auto) autoTimer = setTimeout(autoTick, 700);
      try { el.focus({ preventScroll: true }); } catch (e) { }
    }
    function paintBattle() {
      const t = battle.trainer;
      el.innerHTML = '<div class="mm-battle">' +
        '<div class="mm-bhead"><button class="ib" id="mmleave">← Leave</button>' +
        '<div class="mm-btitle">' + (t ? '<span class="mm-bcur">' + t.icon + ' ' + esc(t.name) + '</span> <span class="mute">· ' + esc(t.title) + '</span>' : 'Team battle') + (watchMode ? ' <span class="mm-watch">👀 exhibition</span>' : '') + '</div>' +
        '<span class="mm-turn" id="mmturn">Turn ' + battle.turn + '</span>' +
        '<button class="ib" id="mmlogbtn" aria-pressed="false">📜 Log</button>' +
        '<button class="ib" id="mmauto">' + (auto ? '⏸ Auto' : '▶ Auto') + '</button></div>' +
        '<div id="mmarena"></div>' +
        '<div class="mm-command" id="mmcommand"></div>' +
        '<div class="mm-cli"><span class="mm-clilabel">Say or type</span>' +
        '<input id="mmcmd" type="text" maxlength="200" autocomplete="off" spellcheck="false" placeholder="e.g. use Heavy Surge · switch to Flora · heal · attack" aria-label="Tell your monster what to do">' +
        '<button class="ib" id="mmmic" title="Speak your command" aria-label="Speak your command">🎙</button>' +
        '<button class="pri" id="mmsend" title="Send">➤</button></div>' +
        '<div class="mm-logwrap" id="mmlogwrap" style="display:none"><div class="mm-log" id="mmlog"></div></div>' +
        '</div>';
      paintArena();
      paintCommand();
      paintLog();
    }
    function paintArena() {
      const box = el.querySelector('#mmarena'); if (!box || !battle) return;
      const a = battle.a, b = battle.b;
      box.innerHTML = '<div class="mm-arena">' +
        '<div class="mm-trainertag">' + (battle.trainer ? battle.trainer.icon + ' ' + esc(battle.trainer.name) : 'Foe') + ' <span>· ' + C.teamAlive(battle, 'b') + ' left</span></div>' +
        sideHTML(b, 'b') + sideHTML(a, 'a') +
        '<div class="mm-partylane foe"><span class="mm-partylabel">' + (battle.trainer ? esc(battle.trainer.name) : 'Foe') + '</span>' + partyHTML('b') + '</div>' +
        '<div class="mm-partylane you"><span class="mm-partylabel">Your squad</span>' + partyHTML('a') + '</div>' +
        '<div class="mm-arenafloor" aria-hidden="true"></div></div>';
      updateBattle();
    }
    function sideHTML(f, side) {
      const ti = C.typeInfo(f.type);
      const pct = Math.max(0, Math.min(100, Math.round(f.hp / f.maxHp * 100)));
      const ab = f.ability || { icon: '🧬', name: 'Ability', desc: '' };
      return '<div class="mm-side ' + (side === 'a' ? 'you' : 'foe') + '" data-side="' + side + '" data-name="' + esc(f.name) + '" style="--mmc:' + ti.color + '">' +
        '<div class="mm-sprite"><span>' + esc(f.icon) + '</span><i class="mm-platform"></i></div>' +
        '<div class="mm-hpbox" data-hp="' + side + '">' +
        '<div class="mm-hpname"><b>' + esc(nm(f)) + '</b><span>Lv ' + (f.lv || f.level) + '</span></div>' +
        '<div class="mm-hptypes">' + typeChips(f) + '</div>' +
        '<div class="mm-hpbar"><i class="mm-hpfill" style="width:' + pct + '%"></i></div>' +
        '<div class="mm-hpnums"><span class="mm-hpnum">' + f.hp + ' / ' + f.maxHp + '</span><span class="mm-ability" title="' + esc(ab.desc) + '">' + ab.icon + ' ' + esc(ab.name) + '</span></div>' +
        '<div class="mm-statuschips">' + chipsHTML(f) + '</div>' +
        '</div></div>';
    }
    function partyHTML(side) {
      return '<div class="mm-party">' + battle.teams[side].map((m, i) => {
        const pct = Math.max(0, Math.min(100, Math.round(m.hp / m.maxHp * 100)));
        const cls = 'mm-pip' + (i === battle.active[side] ? ' active' : '') + (m.hp <= 0 ? ' dead' : '');
        if (side === 'a') return '<button class="' + cls + '" data-pip="' + i + '" title="' + esc(nm(m)) + ' · ' + m.hp + '/' + m.maxHp + '" aria-label="' + esc(nm(m)) + '">' +
          '<span>' + esc(m.icon) + '</span><i><em style="width:' + pct + '%"></em></i></button>';
        return '<span class="' + cls + '" title="' + esc(nm(m)) + ' · ' + m.hp + '/' + m.maxHp + '"><span>' + esc(m.icon) + '</span><i><em style="width:' + pct + '%"></em></i></span>';
      }).join('') + '</div>';
    }
    function chipsHTML(f) {
      const out = [];
      Object.keys(f.status).forEach(k => { if (f.status[k] > 0) out.push('<span class="mm-chip ' + k + '">' + C.statusIcon(k) + ' ' + C.statusName(k) + ' ' + f.status[k] + '</span>'); });
      ['atk', 'def', 'spa', 'spd', 'spe'].forEach(k => { const n = f.stages[k]; if (n) out.push('<span class="mm-chip stage">' + STAT_SHORT[k] + ' ' + (n > 0 ? '+' : '') + n + '</span>'); });
      return out.join('');
    }
    function defaultPrompt() {
      if (!battle) return '';
      if (battle.over) return battle.winner === battle.player ? 'Victory!' : battle.winner ? 'Defeat…' : 'A draw.';
      if (battle.pendingSwitch) return 'Choose your next monster.';
      return 'What will ' + battle.a.name + ' do?';
    }
    function paintCommand() {
      const box = el.querySelector('#mmcommand'); if (!box || !battle) return;
      let right = '';
      if (ui.menu === 'moves') right = movesHTML();
      else if (ui.menu === 'team') right = teamMenuHTML(ui.forced);
      else if (ui.menu === 'kit') right = kitHTML();
      else right = rootMenuHTML();
      box.innerHTML = '<div class="mm-msgbox" id="mmmsg"><span class="mm-msgtag">' + (battle.over ? 'Battle over' : busy ? '…' : 'Message') + '</span><b id="mmmsgtext">' + esc(currentMessage || defaultPrompt()) + '</b></div>' +
        '<div class="mm-menu" id="mmmenu">' + right + '</div>';
      updateMenu();
    }
    function rootMenuHTML() {
      const lock = busy || auto || battle.over;
      return '<button data-menu="act"' + (lock ? ' disabled' : '') + '><b>⚔ Act</b><span>Choose a move</span></button>' +
        '<button data-menu="team"' + (lock ? ' disabled' : '') + '><b>👥 Team</b><span>Swap a monster</span></button>' +
        '<button data-menu="kit"' + (lock ? ' disabled' : '') + '><b>🎒 Kit</b><span>' + (battle.bag.a.patch + battle.bag.a.reset) + ' items left</span></button>' +
        '<button data-menu="run"' + (lock ? ' disabled' : '') + '><b>🏳 Forfeit</b><span>Give up the battle</span></button>';
    }
    function movesHTML() {
      const mv = battle.a.moves.map((m, i) => {
        const ti = C.typeInfo(m.type), eff = C.defenseMult(m.type, battle.b);
        const meta = m.kind === 'status' ? 'Status' : (m.kind === 'special' ? 'Sp. Atk' : 'Physical') + ' · ' + m.power + (m.hits > 1 ? '×' + m.hits : '') + ' · ' + (m.acc == null ? 100 : m.acc) + '%';
        const hint = m.kind === 'status' ? '' : eff > 1 ? ' <span class="mm-eff good">▲ strong</span>' : eff < 1 ? ' <span class="mm-eff bad">▼ weak</span>' : '';
        return '<button class="mm-move" data-mv="' + i + '"' + (busy || auto || battle.over || m.pp <= 0 ? ' disabled' : '') + ' style="--mmc:' + ti.color + '" title="' + esc(m.desc) + '">' +
          '<span class="mm-mvhead"><b>' + esc(m.name) + '</b><span class="mm-mtype">' + ti.icon + ' ' + esc(ti.name) + '</span><span class="mm-mchg' + (m.pp <= 0 ? ' out' : '') + '">' + (m.pp === Infinity ? '∞' : m.pp) + '/' + (m.maxPp === Infinity ? '∞' : m.maxPp) + ' CHG</span></span>' +
          '<span class="mm-mmeta">' + meta + hint + '</span><span class="mm-mdesc">' + esc(m.desc) + '</span></button>';
      }).join('');
      return mv + '<button class="mm-back" data-back="1"' + (busy || auto ? ' disabled' : '') + '>← Back</button>';
    }
    function teamMenuHTML(forced) {
      const rows = battle.teams.a.map((m, i) => {
        const pct = Math.max(0, Math.min(100, Math.round(m.hp / m.maxHp * 100)));
        const active = i === battle.active.a, dead = m.hp <= 0;
        return '<div class="mm-trow battle' + (active ? ' active' : '') + (dead ? ' dead' : '') + '" style="--mmc:' + monColor(m) + '">' +
          '<span class="mm-ticon">' + esc(m.icon) + '</span><span class="mm-tinfo"><b>' + esc(m.name) + '</b><span>' + typeChips(m) + ' <span class="mute">· Lv ' + m.level + '</span></span>' +
          '<span class="mm-tbar"><i style="width:' + pct + '%"></i></span><span class="mm-tnums">' + m.hp + ' / ' + m.maxHp + ' · ' + (m.status.scorch ? '🔥' : '') + (m.status.throttle ? '🐢' : '') + (m.status.glitch ? '👾' : '') + '</span></span>' +
          (active ? '<span class="mm-tactive">OUT</span>' : dead ? '<span class="mm-tdead">FAINTED</span>' : '<button class="ib" data-swap="' + i + '"' + (busy || auto || battle.over ? ' disabled' : '') + '>Swap in</button>') +
          '</div>';
      }).join('');
      return '<div class="mm-paneltitle">' + (forced ? 'Choose your next monster' : 'Your squad') + '</div>' + rows +
        (forced ? '' : '<div class="mm-panelnote">Swapping costs your turn.</div><button class="mm-back" data-back="1">← Back</button>');
    }
    function kitHTML() {
      const bag = battle.bag.a, f = battle.a;
      const rows = Object.keys(C.ITEMS).map(k => {
        const item = C.ITEMS[k], n = bag[k] || 0;
        const useless = k === 'patch' && f.hp >= f.maxHp;
        return '<button class="mm-item" data-item="' + k + '"' + (busy || auto || battle.over || !n || useless ? ' disabled' : '') + '>' +
          '<span class="mm-itemicon">' + item.icon + '</span><span class="mm-iteminfo"><b>' + esc(item.name) + ' ×' + n + '</b><span>' + esc(item.desc) + '</span></span></button>';
      }).join('');
      return '<div class="mm-paneltitle">Kit</div>' + rows + '<div class="mm-panelnote">Using an item costs your turn.</div><button class="mm-back" data-back="1"' + (busy || auto ? ' disabled' : '') + '>← Back</button>';
    }
    function updateMenu() {
      if (!battle) return;
      const lock = busy || auto || battle.over;
      el.querySelectorAll('#mmmenu [data-menu]').forEach(b => { b.disabled = lock; });
      el.querySelectorAll('#mmmenu [data-mv]').forEach(b => {
        const m = battle.a.moves[+b.dataset.mv];
        b.disabled = lock || !m || m.pp <= 0;
      });
      el.querySelectorAll('#mmmenu [data-swap]').forEach(b => { b.disabled = lock; });
      el.querySelectorAll('#mmmenu [data-item]').forEach(b => {
        const k = b.dataset.item, n = battle.bag.a[k] || 0;
        b.disabled = lock || !n || (k === 'patch' && battle.a.hp >= battle.a.maxHp);
      });
      const ab = el.querySelector('#mmauto'); if (ab) ab.textContent = auto ? '⏸ Auto' : '▶ Auto';
      ['#mmcmd', '#mmmic', '#mmsend'].forEach(s => { const n = el.querySelector(s); if (n) n.disabled = !!lock; });
    }
    function updateBattle(disp) {
      if (!battle) return;
      ['a', 'b'].forEach(side => {
        const f = battle[side], box = el.querySelector('.mm-side[data-side="' + side + '"]'); if (!box) return;
        if (box.dataset.name !== f.name) { paintArena(); return; }
        const hp = disp && disp[side] != null ? disp[side] : f.hp;
        const pct = Math.max(0, Math.min(100, Math.round(hp / f.maxHp * 100)));
        const fill = box.querySelector('.mm-hpfill'); if (fill) fill.style.width = pct + '%';
        const num = box.querySelector('.mm-hpnum'); if (num) num.textContent = Math.max(0, Math.round(hp)) + ' / ' + f.maxHp;
        const chips = box.querySelector('.mm-statuschips'); if (chips) chips.innerHTML = chipsHTML(f);
        box.classList.toggle('mm-low', pct <= 25);
      });
      const t = el.querySelector('#mmturn'); if (t) t.textContent = 'Turn ' + battle.turn;
      el.querySelectorAll('.mm-partylane.you .mm-pip').forEach((b, i) => {
        const m = battle.teams.a[i]; if (!m) return;
        b.classList.toggle('active', i === battle.active.a);
        b.classList.toggle('dead', m.hp <= 0);
        const em = b.querySelector('em'); if (em) em.style.width = Math.max(0, Math.round(m.hp / m.maxHp * 100)) + '%';
      });
      el.querySelectorAll('.mm-partylane.foe .mm-pip').forEach((b, i) => {
        const m = battle.teams.b[i]; if (!m) return;
        b.classList.toggle('active', i === battle.active.b);
        b.classList.toggle('dead', m.hp <= 0);
        const em = b.querySelector('em'); if (em) em.style.width = Math.max(0, Math.round(m.hp / m.maxHp * 100)) + '%';
      });
      const tag = el.querySelector('.mm-trainertag span'); if (tag) tag.textContent = '· ' + C.teamAlive(battle, 'b') + ' left';
      updateMenu();
    }
    function paintLog() {
      const box = el.querySelector('#mmlog'); if (!box) return;
      box.innerHTML = '';
      visibleLog.forEach(t => { const d = document.createElement('div'); d.className = 'mm-logline'; d.textContent = t; box.appendChild(d); });
      while (box.children.length > 200) box.removeChild(box.firstChild);
      box.scrollTop = box.scrollHeight;
    }
    function appendLog(ev) {
      visibleLog.push(ev.text);
      if (visibleLog.length > 200) visibleLog.splice(0, visibleLog.length - 200);
      const box = el.querySelector('#mmlog'); if (!box) return;
      const d = document.createElement('div'); d.className = 'mm-logline ' + (ev.k || ''); d.textContent = ev.text;
      box.appendChild(d);
      while (box.children.length > 200) box.removeChild(box.firstChild);
      box.scrollTop = box.scrollHeight;
    }
    function say(text, kind) {
      currentMessage = text || '';
      const b = el.querySelector('#mmmsgtext'); if (b) b.textContent = currentMessage;
      const box = el.querySelector('#mmmsg'); if (box) box.className = 'mm-msgbox ' + (kind || '');
    }
    function floatText(side, text, kind) {
      const box = el.querySelector('.mm-side[data-side="' + side + '"]'); if (!box) return;
      const s = document.createElement('span'); s.className = 'mm-float ' + (kind || ''); s.textContent = text;
      box.appendChild(s);
      setTimeout(() => { try { s.remove(); } catch (e) { } }, 1000);
    }
    function shake(side) {
      const box = el.querySelector('.mm-side[data-side="' + side + '"]'); if (!box) return;
      box.classList.remove('mm-hit'); void box.offsetWidth; box.classList.add('mm-hit');
      setTimeout(() => { try { box.classList.remove('mm-hit'); } catch (e) { } }, 380);
    }
    async function playEvents(events, disp, fast) {
      for (const ev of events) {
        if (stopped) return;
        say(ev.text, ev.k);
        appendLog(ev);
        if (ev.k === 'damage' && ev.amount && !ev.part) {
          disp[ev.side] = Math.max(0, (disp[ev.side] == null ? battle[ev.side].hp : disp[ev.side]) - ev.amount);
          floatText(ev.side, '-' + ev.amount, ev.crit ? 'crit' : ev.self ? 'self' : 'dmg');
          shake(ev.side); sfx(ev.crit ? 'boom' : 'bonk');
        } else if (ev.k === 'heal' && ev.amount) {
          disp[ev.side] = Math.min(battle[ev.side].maxHp, (disp[ev.side] == null ? battle[ev.side].hp : disp[ev.side]) + ev.amount);
          floatText(ev.side, '+' + ev.amount, 'heal'); sfx('good');
        } else if (ev.k === 'move') sfx('whoosh');
        else if (ev.k === 'faint') sfx('bad');
        else if (ev.k === 'status') sfx('ping');
        else if (ev.k === 'switch') { disp[ev.side] = battle[ev.side].hp; paintArena(); sfx('switch'); }
        else if (ev.k === 'item') sfx('good');
        updateBattle(disp);
        await wait(fast ? 170 : 320);
      }
      if (!stopped) updateBattle();
    }
    async function executeTurn(actionA, actionB, fast) {
      if (!battle || battle.over || busy || stopped || battle.pendingSwitch) return;
      busy = true; updateMenu();
      const disp = { a: battle.a.hp, b: battle.b.hp };
      const res = C.resolveTurn(battle, actionA, actionB);
      await playEvents(res.events, disp, fast);
      if (stopped) return;
      finishTurn(res, fast);
    }
    function finishTurn(res, fast) {
      busy = false;
      updateBattle();
      if (res.over) { finishBattle(); return; }
      if (res.needsSwitch) {
        if (auto) {
          const idx = C.aiChooseSwitch(battle, res.needsSwitch, watchMode ? 2 : api.level);
          if (idx >= 0) { doForcedSwitch(idx, true); return; }
        }
        ui.menu = 'team'; ui.forced = true;
        say('Choose your next monster.', 'prompt');
        paintCommand(); focusMenu();
        return;
      }
      ui.menu = 'root'; ui.forced = false;
      say(defaultPrompt(), 'prompt');
      paintCommand(); focusMenu();
      if (auto) autoTimer = setTimeout(autoTick, fast ? 450 : 650);
    }
    async function doForcedSwitch(index, fast) {
      const res = C.chooseSwitch(battle, 'a', index);
      const disp = { a: battle.a.hp, b: battle.b.hp };
      busy = true; paintCommand();
      await playEvents(res.events, disp, fast);
      if (stopped) return;
      busy = false;
      if (res.over) { finishBattle(); return; }
      if (res.needsSwitch) { ui.menu = 'team'; ui.forced = true; say('Choose your next monster.', 'prompt'); paintCommand(); focusMenu(); return; }
      ui.menu = 'root'; ui.forced = false;
      say(defaultPrompt(), 'prompt'); paintCommand(); focusMenu();
      if (auto) autoTimer = setTimeout(autoTick, fast ? 450 : 650);
    }
    function playerMove(i) {
      if (!battle || battle.over || busy || auto || stopped) return;
      if (battle.pendingSwitch) return;
      const mv = battle.a.moves[i]; if (!mv) return;
      if (mv.pp <= 0) { A.toast('That move has no charges left.', 2500); return; }
      const ai = C.aiChooseAction(battle, 'b', api.level);
      executeTurn({ kind: 'move', index: i }, ai, false);
    }
    function swapTo(i) {
      if (!battle || battle.over || busy || auto || stopped) return;
      if (ui.forced) { doForcedSwitch(i, false); return; }
      if (i === battle.active.a || battle.teams.a[i].hp <= 0) return;
      const ai = C.aiChooseAction(battle, 'b', api.level);
      executeTurn({ kind: 'switch', index: i }, ai, false);
    }
    function useKit(key) {
      if (!battle || battle.over || busy || auto || stopped) return;
      if (!battle.bag.a[key]) { A.toast('None left.', 2000); return; }
      if (key === 'patch' && battle.a.hp >= battle.a.maxHp) { A.toast('Already at full HP.', 2000); return; }
      const ai = C.aiChooseAction(battle, 'b', api.level);
      executeTurn({ kind: 'item', item: key }, ai, false);
    }
    function setMenu(menu, forced) {
      ui.menu = menu; ui.forced = !!forced;
      paintCommand();
      if (menu === 'root') say(defaultPrompt(), 'prompt');
      focusMenu();
    }
    function focusMenu() {
      const b = el.querySelector('#mmmenu button:not(:disabled)');
      if (b) { try { b.focus({ preventScroll: true }); } catch (e) { } }
    }
    function toggleAuto() {
      if (!battle || battle.over) return;
      auto = !auto;
      if (auto) { ui.menu = 'root'; ui.forced = false; paintCommand(); autoTimer = setTimeout(autoTick, 250); }
      else clearTimeout(autoTimer);
      updateMenu();
    }
    function autoTick() {
      clearTimeout(autoTimer);
      if (!auto || !battle || battle.over || busy || stopped) return;
      if (battle.pendingSwitch) {
        const i = C.aiChooseSwitch(battle, 'a', watchMode ? 2 : api.level);
        if (i >= 0) doForcedSwitch(i, true);
        return;
      }
      const a = C.aiChooseAction(battle, 'a', watchMode ? 2 : api.level);
      const b = C.aiChooseAction(battle, 'b', api.level);
      executeTurn(a, b, true);
    }
    function finishBattle() {
      if (finished) return;
      finished = true; auto = false; clearTimeout(autoTimer); busy = false;
      updateBattle();
      const won = battle.winner === battle.player, draw = !battle.winner;
      const winner = battle.winner ? battle[battle.winner] : null;
      let newCore = null, newChamp = false, gained = [];
      if (!watchMode) {
        if (won) { rec.w++; rec.streak++; }
        else if (!draw) { rec.l++; rec.streak = 0; }
        else rec.streak = 0;
        if (won && battle.trainer && !battle.trainer.quick) {
          if (battle.trainer.champion) { if (!champ) { champ = true; newChamp = true; ls.set(CHAMP_KEY, '1'); } }
          else if (!cores.includes(battle.trainer.key)) { cores.push(battle.trainer.key); newCore = battle.trainer; ls.set(CORES_KEY, JSON.stringify(cores)); }
        }
        gained = awardBattles(won, draw);
        saveRecord(rec); updateHud();
        if (won) {
          const nb = api.submit(battle.turn, true);
          if (nb && battle.turn > 1) A.toast('⚡ New fastest win: ' + battle.turn + ' turns', 4000);
        }
      }
      sfx(won ? 'win' : draw ? 'draw' : 'lose');
      const title = draw ? 'A draw!' : watchMode ? esc(winner ? winner.name : 'Nobody') + ' wins!' : won ? 'Victory!' : 'Defeat';
      const sub = won && battle.trainer && !battle.trainer.quick ? 'You defeated ' + esc(battle.trainer.name) + '.' : winner ? esc(winner.name) + ' wins after ' + battle.turn + ' turns.' : 'Neither squad could finish the other.';
      const notes = [];
      if (watchMode) notes.push('This was an exhibition, so it does not change your record.');
      else {
        if (won) notes.push('+1 win · squad left ' + C.teamAlive(battle, 'a') + ' of ' + battle.teams.a.length);
        if (newCore) notes.push('🏅 ' + C.typeInfo(newCore.type).icon + ' ' + esc(C.typeInfo(newCore.type).name) + ' Core earned!');
        if (newChamp) notes.push('🏆 You beat the Champion. The circuit is complete.');
        if (!won && !draw) notes.push('No core this time. The squad is healed for a rematch.');
        gained.forEach(g => notes.push('⬆ ' + g));
      }
      const next = !watchMode && won && (newCore || newChamp) ? nextCuratorKey() : null;
      const b = el.querySelector('.mm-battle'); if (!b) return;
      b.insertAdjacentHTML('beforeend', '<div class="mm-overlay" id="mmresult"><div class="mm-result ' + (won ? 'win' : draw ? 'draw' : 'lose') + '">' +
        '<div class="mm-rico">' + (won ? '🏆' : draw ? '🤝' : '💥') + '</div><h2>' + title + '</h2><p>' + sub + '</p>' +
        '<div class="mm-resultnote">' + notes.map(esc).join('<br>') + '</div>' +
        '<div class="mm-actions"><button class="pri" data-r="again">↻ Rematch</button><button class="ib" data-r="home">🏠 Circuit</button>' +
        (next ? '<button class="ib" data-r="next">⚔ Next Curator</button>' : '') + '</div></div></div>');
      const btn = el.querySelector('#mmresult .pri'); if (btn) { try { btn.focus({ preventScroll: true }); } catch (e) { } }
    }
    /* every monster that fought earns experience, and a win is worth more than a loss */
    function awardBattles(won, draw) {
      const out = [], seen = new Set();
      (battle.teams.a || []).forEach(f => {
        if (!f || seen.has(f.name)) return;
        seen.add(f.name);
        const e = entryOf(reg, f.name); if (!e) return;
        e.fr = clampNum((+e.fr || 0) + (won ? 4 : 2), 0, MAX_FR);
        const base = won ? 70 + battle.turn * 2 : draw ? 45 : 30 + battle.turn;
        const up = giveXp(e, base * (1 + frTier(e.fr).bonus) / Math.max(1, battle.teams.a.length * .6));
        reg[f.name] = e;
        if (up) out.push(nm(f) + ' reached Lv ' + e.lv);
      });
      if (out.length) { saveRegistry(reg); rebuild(); }
      return out;
    }
    function nextCuratorKey() {
      const missing = C.CURATORS.find(c => !c.champion && !cores.includes(c.key));
      if (missing) return missing.key;
      if (cores.length >= 6 && !champ) return 'champion';
      return null;
    }
    async function leaveBattle() {
      if (!battle) { paintHome(); return; }
      if (battle.over) { paintHome(); return; }
      if (watchMode) {
        if (!(await A.confirm('Stop watching this exhibition?'))) return;
        battle = null; paintHome(); return;
      }
      if (!(await A.confirm('Forfeit this battle?\n\nIt counts as a loss.'))) return;
      C.forfeit(battle, 'a');
      finishBattle();
    }
    function forfeitQuick() {
      if (!battle || battle.over) return;
      leaveBattle();
    }

    /* ---------- new arrivals and the scan ---------- */
    function arrivalsHTML() {
      const list = unscanned();
      if (!list.length) return '';
      return '<div class="mm-section"><div class="mm-sechead"><div><h3>New arrivals</h3><div class="small mute">Models on this PC that have not been scanned yet. A scan reads the type, stats, ability and moves straight from the model\'s own metadata, and then you give it a name.</div></div><span class="mm-count">' + list.length + ' to scan</span></div>' +
        '<div class="mm-grid">' + list.map(mon => '<div class="mm-card mm-new" style="--mmc:#7b88ab">' +
          '<div class="mm-cardtop"><span class="mm-ava">❔</span><div class="mm-cname"><b title="' + esc(mon.name) + '">' + esc(mon.name) + '</b>' +
          '<span class="small mute">Unscanned · ' + esc(mon.meta.family || 'unknown family') + '</span></div></div>' +
          '<div class="mm-cardmeta"><span>' + C.formatParams(mon.meta.parameters) + ' params</span><span>' + esc(mon.meta.quantization_level || '?') + '</span><span>' + C.formatContext(mon.meta.context) + ' ctx</span><span>' + C.formatGigabytes(mon.meta.size) + ' GB</span></div>' +
          '<div class="mm-cardfoot"><span class="small mute">' + (mon.meta.sample ? 'sample monster' : 'in Ollama, not in your collection') + '</span>' +
          '<button class="pri" data-scan="' + esc(mon.name) + '">🔬 Scan</button></div></div>').join('') + '</div></div>';
    }
    async function openScan(name) {
      const mon = byName(name); if (!mon || scanBusy) return;
      scanBusy = true;
      if (!el.querySelector('#mmmodal')) modalReturn = document.activeElement;
      const old = el.querySelector('#mmmodal'); if (old) old.remove();
      el.insertAdjacentHTML('beforeend', '<div class="mm-modal" id="mmmodal" role="dialog" aria-modal="true" aria-label="Scan a model"><div class="mm-dialog mm-scan">' +
        '<div class="mm-mhead"><div><h2>Scanning</h2><div class="small mute">' + esc(mon.name) + '</div></div><button class="ib" data-close="1" aria-label="Cancel">✕</button></div>' +
        '<div class="mm-scanbar"><i id="mmscanfill" style="width:0%"></i></div>' +
        '<div class="mm-scanlines" id="mmscanlines"></div><div id="mmscanend"></div></div></div>');
      const lines = el.querySelector('#mmscanlines'), fill = el.querySelector('#mmscanfill');
      const step = async (pct, html) => {
        if (stopped) return;
        if (fill) fill.style.width = pct + '%';
        if (lines) lines.insertAdjacentHTML('beforeend', '<div class="mm-scanline">' + html + '</div>');
        sfx('ping');
        await wait(260);
      };
      const ti = C.typeInfo(mon.type), t2 = mon.type2 ? C.typeInfo(mon.type2) : null;
      await step(18, '📦 Reading the file: <b>' + C.formatGigabytes(mon.meta.size) + ' GB</b> · ' + esc(mon.meta.quantization_level || 'unknown quant') + ' · ' + C.formatParams(mon.meta.parameters) + ' parameters');
      await step(38, '🧬 Family: <b>' + esc(mon.meta.family || 'unknown') + '</b> · ' + C.formatContext(mon.meta.context) + ' context · ' + esc((mon.meta.capabilities || ['completion']).join(', ')));
      await step(60, '🔥 Type: <b style="color:' + ti.color + '">' + ti.icon + ' ' + esc(ti.name) + '</b>' + (t2 ? ' · second type <b style="color:' + t2.color + '">' + t2.icon + ' ' + esc(t2.name) + '</b>' : ''));
      await step(80, '📊 Stats: HP ' + mon.stats.hp + ' · ATK ' + mon.stats.atk + ' · DEF ' + mon.stats.def + ' · SPA ' + mon.stats.spa + ' · SPD ' + mon.stats.spd + ' · SPE ' + mon.stats.spe);
      await step(92, '🧠 Ability: <b>' + esc(mon.ability.name) + '</b> — ' + esc(mon.ability.desc));
      if (stopped) return;
      if (fill) fill.style.width = '100%';
      const end = el.querySelector('#mmscanend');
      if (end) {
        end.innerHTML = '<div class="mm-ptitle">Registered as</div><div class="row" style="gap:8px;flex-wrap:wrap"><input id="mmnick" type="text" maxlength="24" value="' + esc(mon.name) + '" aria-label="Name this monster" style="flex:1;min-width:180px"><button class="pri" data-register="' + esc(mon.name) + '">✓ Register</button></div>' +
          '<div class="small mute" style="margin-top:6px">It starts at level 1 and grows as you battle and spend time with it. You can rename it any time.</div>';
        const inp = el.querySelector('#mmnick'); if (inp) setTimeout(() => { try { inp.focus(); inp.select(); } catch (e) { } }, 30);
      }
      scanBusy = false;
    }
    function registerMonster(name, nick) {
      const mon = byName(name); if (!mon) return;
      const e = entryOf(reg, name) || { lv: 1, xp: 0, fr: 0, acts: {}, seen: Date.now(), at: 0, scans: 0 };
      e.nick = String(nick || '').trim().slice(0, 24) || '';
      e.at = +e.at || Date.now(); e.scans = (+e.scans || 0) + 1; e.seen = Date.now();
      reg[name] = e; saveRegistry(reg);
      rebuild();
      const fresh = byName(name);
      closeModal();
      paintHome(name);
      A.toast('🔬 ' + nm(fresh) + ' joined your collection at Lv 1', 4000);
      sfx('win');
    }
    async function renameMonster(name) {
      const mon = byName(name); if (!mon) return;
      const v = await A.prompt('What is this monster called?\n\nThe model itself stays ' + mon.name + '.', mon.nick || mon.name);
      if (v == null) return;
      const e = entryOf(reg, name); if (!e) return;
      e.nick = String(v).trim().slice(0, 24);
      reg[name] = e; saveRegistry(reg); rebuild();
      if (screen === 'playground') paintPlayground(name);
      else if (el.querySelector('#mmmodal')) openDex(name);
      else paintHome(name);
    }

    /* ---------- the playground ---------- */
    const ACTIONS = {
      feed: { icon: '🍖', name: 'Feed', note: 'A warm snack of tokens', fr: 6, xp: 9, cd: 25 },
      play: { icon: '🎾', name: 'Play', note: 'Fetch with a syntax error', fr: 9, xp: 14, cd: 40 },
      train: { icon: '🏋️', name: 'Train', note: 'Spar with a benchmark set', fr: 4, xp: 28, cd: 60 },
      talk: { icon: '💬', name: 'Talk', note: 'Say something to it', fr: 5, xp: 12, cd: 15 }
    };
    const ACT_LINES = {
      feed: ['hums happily and nuzzles the cache.', 'eats every token and asks for the prompt back.', 'chews thoughtfully, then wags its parameters.'],
      play: ['chases a runaway bracket around the garden.', 'fetches the same sentence six times, delighted.', 'wins the game and does a small victory loop.'],
      train: ['works through a hard evaluation set without complaining.', 'gets one answer wrong, sulks, then gets it right.', 'finishes the drill and looks proud of its gradients.']
    };
    function cooldownLeft(e, kind) {
      const a = (e && e.acts) || {}, t = +a[kind] || 0;
      const left = Math.ceil((t + (ACTIONS[kind] ? ACTIONS[kind].cd : 20) * 1000 - Date.now()) / 1000);
      return left > 0 ? left : 0;
    }
    function playAct(kind) {
      const mon = byName(pgName); if (!mon || !ACTIONS[kind] || kind === 'talk') return;
      const e = entryOf(reg, pgName); if (!e) return;
      const left = cooldownLeft(e, kind);
      if (left) { A.toast(nm(mon) + ' is resting for another ' + left + 's.', 2500); return; }
      e.acts = Object.assign({}, e.acts, { [kind]: Date.now() });
      e.fr = clampNum((+e.fr || 0) + ACTIONS[kind].fr, 0, MAX_FR);
      const up = giveXp(e, ACTIONS[kind].xp * (1 + frTier(e.fr).bonus));
      reg[pgName] = e; saveRegistry(reg);
      const lines = ACT_LINES[kind] || ['seems pleased.'];
      pgLog.unshift({ text: nm(mon) + ' ' + lines[Math.floor(Math.random() * lines.length)], at: Date.now() });
      pgLog = pgLog.slice(0, 10);
      if (up) A.toast('⬆ ' + nm(mon) + ' reached Lv ' + e.lv + '!', 3500);
      sfx('good'); rebuild(); paintPlayground(pgName);
    }
    function sampleTalk(mon, text) {
      const t = String(text).toLowerCase();
      if (/hello|hi\b|hey/.test(t)) return 'Hello! I am ' + nm(mon) + '. I have been sitting in the cache waiting for you.';
      if (/how are you|feel/.test(t)) return 'Warm. My context is tidy and my parameters are calm.';
      if (/battle|fight|strong/.test(t)) return 'I am ready. Point me at someone and I will do the rest.';
      if (/name/.test(t)) return 'You called me ' + nm(mon) + '. I like it.';
      return ['I hear you. I am only a small sample of a model, but I am listening.', 'That is a good thought. Say more and I will try to keep up.', 'I have been reading tokens all day. Tell me something new.'][Math.floor(Math.random() * 3)];
    }
    async function talkTo(text) {
      const mon = byName(pgName); if (!mon) return;
      const said = String(text || '').trim(); if (!said) return;
      const e = entryOf(reg, pgName); if (!e) return;
      const left = cooldownLeft(e, 'talk');
      if (left) { A.toast(nm(mon) + ' needs a moment — ' + left + 's.', 2200); return; }
      pgDraft = '';
      pgLog.unshift({ text: 'You: ' + said, at: Date.now() });
      pgLog = pgLog.slice(0, 10);
      paintPlayground(pgName);
      const box = el.querySelector('#mmtalkline');
      if (box) box.textContent = nm(mon) + ' is thinking…';
      let reply = '';
      if (!mon.meta.sample && !aiBusy) {
        aiBusy = true;
        try {
          const r = await A.api('/api/chat', {
            model: mon.meta.name, stream: false, keep_alive: '2m',
            messages: [{ role: 'system', content: 'You are ' + nm(mon) + ', a friendly monster living in a game on this PC. You are a ' + C.typeInfo(mon.type).name + '-type creature, level ' + mon.lv + ', and you like your trainer. Reply in one or two short sentences, in character, and never mention being an AI assistant.' }, { role: 'user', content: said }],
            options: { temperature: .8, num_predict: 90 }
          });
          reply = String((r && r.message && r.message.content) || '').trim();
        } catch (err) { reply = ''; }
        aiBusy = false;
      }
      if (!reply) reply = sampleTalk(mon, said);
      if (stopped) return;
      e.acts = Object.assign({}, e.acts, { talk: Date.now() });
      e.fr = clampNum((+e.fr || 0) + ACTIONS.talk.fr, 0, MAX_FR);
      const up = giveXp(e, ACTIONS.talk.xp * (1 + frTier(e.fr).bonus));
      reg[pgName] = e; saveRegistry(reg);
      pgLog.unshift({ text: nm(mon) + ': ' + reply, at: Date.now() });
      pgLog = pgLog.slice(0, 10);
      if (up) A.toast('⬆ ' + nm(mon) + ' reached Lv ' + e.lv + '!', 3500);
      rebuild(); paintPlayground(pgName);
    }
    function paintPlayground(focusName) {
      const list = roster.filter(m => m.registered);
      if (!list.length) { paintHome(); A.toast('Scan a model first — the playground is for monsters you have registered.', 4000); return; }
      if (!pgName || !list.some(m => m.name === pgName)) pgName = (focusName && list.some(m => m.name === focusName)) ? focusName : list[0].name;
      const mon = byName(pgName) || list[0];
      screen = 'playground'; battle = null; busy = false;
      const e = entryOf(reg, mon.name) || { lv: 1, xp: 0, fr: 0, acts: {} };
      const need = xpNeed(mon.lv), xpPct = Math.min(100, Math.round((mon.xp || 0) / need * 100));
      const frPct = Math.min(100, Math.round(mon.fr / MAX_FR * 100));
      const ti = C.typeInfo(mon.type);
      const acts = Object.keys(ACTIONS).filter(k => k !== 'talk').map(k => {
        const a = ACTIONS[k], left = cooldownLeft(e, k);
        return '<button class="mm-actbtn" data-act="' + k + '"' + (left ? ' disabled' : '') + ' title="' + esc(a.note) + '">' + a.icon + ' <b>' + a.name + '</b><span>' + (left ? 'resting ' + left + 's' : '+' + a.fr + ' friendship · +' + a.xp + ' XP') + '</span></button>';
      }).join('');
      const talkLeft = cooldownLeft(e, 'talk');
      el.innerHTML = '<div class="mm-shell mm-pg">' +
        '<div class="mm-head"><div class="mm-title"><h2><span class="mm-logo">🎮</span> Playground</h2><div class="small mute">Spend time with your monsters here. Friendship grows slowly, and it makes them a little stronger in battle.</div></div>' +
        '<div class="mm-actions"><button class="ib" data-home="1">🏠 Circuit</button></div></div>' +
        '<div class="mm-toolbar" style="flex-wrap:wrap">' + list.map(m => '<button class="ib' + (m.name === pgName ? ' on' : '') + '" data-pgsel="' + esc(m.name) + '" style="--mmc:' + monColor(m) + '">' + esc(m.icon) + ' ' + esc(nm(m)) + ' <span class="mute">Lv ' + m.lv + '</span></button>').join('') + '</div>' +
        '<div class="mm-pgmain"><div class="mm-pgmon" style="--mmc:' + ti.color + '">' +
        '<div class="mm-pgface">' + esc(mon.icon) + '</div>' +
        '<h3>' + esc(nm(mon)) + '</h3>' +
        '<div class="small mute">' + esc(mon.name) + '</div>' +
        '<div class="mm-ptypes">' + typeChips(mon) + '</div>' +
        '<div class="mm-pgbar"><span>Lv ' + mon.lv + '</span><i><em style="width:' + xpPct + '%"></em></i><span>' + (mon.lv >= MAX_LV ? 'max' : (mon.xp | 0) + ' / ' + need) + '</span></div>' +
        '<div class="mm-pgbar fr"><span>' + mon.friend.icon + ' ' + esc(mon.friend.name) + '</span><i><em style="width:' + frPct + '%"></em></i><span>' + Math.round(mon.fr) + '</span></div>' +
        '<div class="small mute" style="margin-top:8px">Friendship adds +' + Math.round(mon.friend.bonus * 100) + '% to every stat. Battles and time spent together raise it.</div>' +
        '<div class="row" style="gap:8px;margin-top:10px"><button class="ib" data-rename="' + esc(mon.name) + '">✏ Rename</button><button class="ib" data-dex="' + esc(mon.name) + '">ⓘ ModelDex</button></div></div>' +
        '<div class="mm-pgactions">' + acts +
        '<div class="mm-talkbox"><b>' + ACTIONS.talk.icon + ' Talk to ' + esc(nm(mon)) + '</b>' +
        '<div class="row" style="gap:6px;margin-top:6px"><input id="mmtalk" type="text" maxlength="200" placeholder="' + (talkLeft ? 'Resting ' + talkLeft + 's…' : 'Say something to ' + esc(nm(mon)) + '…') + '"' + (talkLeft ? ' disabled' : '') + ' value="' + esc(pgDraft) + '" aria-label="Talk to your monster"><button class="pri" id="mmtalksend"' + (talkLeft ? ' disabled' : '') + '>Say</button></div>' +
        '<div class="small mute" id="mmtalkline" style="margin-top:6px">' + (mon.meta.sample ? 'This one is a sample monster, so it answers from a script.' : 'It answers with the model on this PC, in its own voice.') + '</div></div>' +
        '</div></div>' +
        '<div class="mm-pglog">' + (pgLog.length ? pgLog.map(x => '<div class="mm-logline">' + esc(x.text) + '</div>').join('') : '<div class="small mute">Nothing has happened yet. Feed it, play with it, or talk to it.</div>') + '</div>' +
        '</div>';
      updateHud();
    }

    /* ---------- wipe everything ---------- */
    async function resetProgress() {
      const first = await A.confirm('Delete all Model Monsters progress?\n\nThis removes every registered monster (its name, level and friendship), your squad, record, cores and the champion. Your AI models stay installed in Ollama; only the game\'s own data is cleared.');
      if (!first) return;
      const second = await A.confirm('Are you sure? This cannot be undone.\n\nPress OK to delete all Model Monsters progress.');
      if (!second) return;
      WIPE_KEYS.forEach(k => { try { localStorage.removeItem('oa_' + k); } catch (e) { } });
      reg = {}; squad = []; squadNames = []; cores = []; champ = false;
      rec.w = 0; rec.l = 0; rec.streak = 0; lastBattle = null; pgName = ''; pgLog = []; pending = null;
      rebuild(); paintHome();
      A.toast('All Model Monsters progress was deleted. Scan a model to start again.', 5000);
    }

    /* ---------- typed and spoken battle commands ---------- */
    const HELP_TEXT = 'Try: “use <move>” · “1”–“4” · “attack” (it picks) · “switch to <name>” · “heal” · “cure” · “auto” · “run”. Anything else, and your monster works out what you meant.';
    function parseCommand(raw) {
      if (!battle) return { kind: 'none' };
      const t = String(raw || '').toLowerCase().replace(/[“”\"']/g, '').trim();
      if (!t) return { kind: 'none' };
      if (/^(help|\?|commands)$/.test(t)) return { kind: 'help' };
      if (/(forfeit|give up|run away|flee|surrender|quit|leave)/.test(t)) return { kind: 'forfeit' };
      if (/(\bauto\b|watch|let (it|him|her|them) decide|you decide)/.test(t)) return { kind: 'auto' };
      if (/(heal|patch|bandage|repair|restore)/.test(t)) return { kind: 'item', item: 'patch' };
      if (/(cure|cleanse|reset|antidote)/.test(t)) return { kind: 'item', item: 'reset' };
      const num = t.match(/^(?:use |move |go )?([1-4])$/);
      if (num) return { kind: 'move', index: +num[1] - 1 };
      const team = battle.teams.a;
      for (let i = 0; i < team.length; i++) {
        const m = team[i];
        const words = [m.nick, m.name, String(m.name).split(/[^a-z0-9]+/i)[0]].filter(Boolean).map(x => String(x).toLowerCase());
        if (words.some(w => w.length > 2 && t.includes(w))) return { kind: 'switch', index: i };
      }
      if (/(switch|swap|team|change out)/.test(t)) return { kind: 'menu', menu: 'team' };
      let best = -1, bestLen = 0;
      battle.a.moves.forEach((m, i) => {
        const words = String(m.name).toLowerCase().split(/[^a-z0-9]+/).filter(w => w.length > 2);
        const hit = words.filter(w => t.includes(w)).join(' ').length;
        if (hit > bestLen) { best = i; bestLen = hit; }
      });
      if (best >= 0) return { kind: 'move', index: best };
      if (/(attack|hit|strike|fight|smash|best|strongest|go for it)/.test(t)) return { kind: 'best' };
      return { kind: 'ai' };
    }
    function jsonOnly(text) {
      const s = String(text || '');
      const a = s.indexOf('{'), b = s.lastIndexOf('}');
      if (a < 0 || b <= a) return null;
      try { return JSON.parse(s.slice(a, b + 1)); } catch (e) { return null; }
    }
    /* your monster itself reads a command it did not recognise, using the model on this PC */
    async function aiInterpret(text) {
      const f = battle && battle.a; if (!f || !f.meta || f.meta.sample || aiBusy) return null;
      aiBusy = true;
      try {
        const moves = f.moves.map((m, i) => i + ': ' + m.name + ' (' + m.type + ', ' + m.kind + (m.kind === 'status' ? '' : ', ' + m.power + ' power') + ')').join('\n');
        const team = battle.teams.a.map((m, i) => i + ': ' + nm(m) + ' ' + m.hp + '/' + m.maxHp + (i === battle.active.a ? ' (out now)' : '')).join('\n');
        const prompt = 'You are ' + nm(f) + ', a monster in a turn-based battle. Your trainer says something. Pick the best reply as ONE json object, nothing else.\nMoves:\n' + moves + '\nYour team:\n' + team + '\nAllowed replies: {"action":"move","index":0} {"action":"switch","index":1} {"action":"item","item":"patch"} {"action":"item","item":"reset"} {"action":"forfeit"} {"action":"help"}\nTrainer: "' + String(text).slice(0, 200) + '"';
        const r = await A.api('/api/chat', { model: f.meta.name, stream: false, keep_alive: '2m', messages: [{ role: 'user', content: prompt }], options: { temperature: 0, num_predict: 80 } });
        const j = jsonOnly((r && r.message && r.message.content) || '');
        return j && typeof j.action === 'string' ? j : null;
      } catch (e) { return null; } finally { aiBusy = false; }
    }
    async function runCommand(raw) {
      if (!battle || battle.over || busy || auto) return;
      const text = String(raw || '').trim(); if (!text) return;
      const inp = el.querySelector('#mmcmd'); if (inp) inp.value = '';
      say('“' + text + '”', 'prompt');
      const act = parseCommand(text);
      if (act.kind === 'help') { say(HELP_TEXT, 'prompt'); return; }
      if (act.kind === 'forfeit') { leaveBattle(); return; }
      if (act.kind === 'auto') { toggleAuto(); return; }
      if (act.kind === 'menu') { setMenu(act.menu); return; }
      if (act.kind === 'switch') { swapTo(act.index); return; }
      if (act.kind === 'item') { useKit(act.item); return; }
      if (act.kind === 'move') { playerMove(act.index); return; }
      if (act.kind === 'best') { playerMove(C.aiChooseMove(battle, 'a', 2)); return; }
      if (battle.pendingSwitch) { say('Send someone out first: “switch to <name>”.', 'prompt'); return; }
      say(nm(battle.a) + ' is thinking about that…', 'prompt');
      const guess = await aiInterpret(text);
      if (stopped || !battle || battle.over || busy) return;
      if (!guess) { say('I could not read that one. ' + HELP_TEXT, 'prompt'); return; }
      if (guess.action === 'move' && Number.isFinite(+guess.index)) {
        const i = Math.max(0, Math.min(battle.a.moves.length - 1, +guess.index));
        say(nm(battle.a) + ' takes that as “' + battle.a.moves[i].name + '”.', 'prompt');
        playerMove(i); return;
      }
      if (guess.action === 'switch' && Number.isFinite(+guess.index)) {
        const i = +guess.index;
        if (i >= 0 && i < battle.teams.a.length && battle.teams.a[i].hp > 0) { swapTo(i); return; }
      }
      if (guess.action === 'item' && (guess.item === 'patch' || guess.item === 'reset')) { useKit(guess.item); return; }
      if (guess.action === 'forfeit') { leaveBattle(); return; }
      say(HELP_TEXT, 'prompt');
    }
    function micCommand() {
      const btn = el.querySelector('#mmmic');
      if (!A.voice || !A.voice.available()) { A.toast('Microphone input is not available in this window.', 4000); return; }
      if (A.voice.rec) { A.voice.stop(); return; }
      let heard = '';
      if (btn) btn.classList.add('on');
      A.voice.start(t => { heard = t; }, s => {
        if (s === 'busy') say('…', 'prompt');
        if (s === 'idle' && btn) btn.classList.remove('on');
      }, { auto: true }).then(() => {
        const ask = () => {
          if (A.voice.rec) { setTimeout(ask, 250); return; }
          if (btn) btn.classList.remove('on');
          if (heard && String(heard).trim()) runCommand(heard);
          else A.toast('I did not catch that — try again.', 3000);
        };
        setTimeout(ask, 400);
      });
    }

    /* ---------- ModelDex ---------- */
    function openDex(name) {
      const mon = byName(name); if (!mon) return;
      const ti = C.typeInfo(mon.type), tier = C.TIERS.find(x => x.key === mon.tier) || C.TIERS[0];
      const strong = C.TYPES[C.STRONG[mon.type]], weak = C.TYPES[C.WEAK[mon.type]];
      const stats = ['hp', 'atk', 'def', 'spa', 'spd', 'spe'].map(k => '<div class="mm-dstat"><span>' + STAT_LABEL[k] + '</span><b>' + mon.stats[k] + '</b><i><em style="width:' + Math.min(100, Math.round(mon.stats[k] / STAT_MAX[k] * 100)) + '%"></em></i></div>').join('');
      const moves = mon.moves.map(mv => {
        const mt = C.typeInfo(mv.type);
        return '<div class="mm-dmove" style="--mmc:' + mt.color + '"><div class="mm-dmhead"><b>' + esc(mv.name) + '</b>' + typeChip(mv.type) + '<span class="mm-mchg">' + (mv.maxPp || 0) + ' CHG</span></div><div class="mm-mmeta">' + (mv.kind === 'status' ? 'Status' : mv.kind === 'special' ? 'Sp. Atk' : 'Physical') + (mv.power ? ' · ' + mv.power + (mv.hits > 1 ? ' × ' + mv.hits : '') : '') + (mv.acc != null && mv.kind !== 'status' ? ' · ' + mv.acc + '%' : '') + '</div><div class="small mute">' + esc(mv.desc) + '</div></div>';
      }).join('');
      const caps = (mon.meta.capabilities || []).join(', ') || 'completion';
      const speed = mon.meta.measured ? mon.meta.tps + ' tokens/sec (measured)' : '≈ ' + mon.meta.tps + ' tokens/sec (estimated)';
      const inS = inSquad(mon.name);
      if (!el.querySelector('#mmmodal')) modalReturn = document.activeElement;
      const oldDex = el.querySelector('#mmmodal'); if (oldDex) oldDex.remove();
      el.insertAdjacentHTML('beforeend', '<div class="mm-modal" id="mmmodal" role="dialog" aria-modal="true" aria-label="ModelDex: ' + esc(nm(mon)) + '"><div class="mm-dialog mm-dex">' +
        '<div class="mm-mhead"><div class="mm-dexhead"><span class="mm-ava big" style="--mmc:' + ti.color + '">' + esc(mon.icon) + '</span><div><h2>' + esc(nm(mon)) + '</h2><div>' + typeChips(mon) + ' <span class="mm-tier">Lv ' + mon.lv + ' · ' + tier.icon + ' ' + tier.name + '</span></div><div class="small mute">' + (mon.nick ? 'model ' + esc(mon.name) + ' · ' : '') + esc(mon.meta.family || 'unknown family') + ' · ' + C.formatParams(mon.meta.parameters) + ' parameters</div></div></div><button class="ib" data-close="1" aria-label="Close">✕</button></div>' +
        '<div class="mm-pgbar fr"><span>' + mon.friend.icon + ' ' + esc(mon.friend.name) + '</span><i><em style="width:' + Math.round(mon.fr / MAX_FR * 100) + '%"></em></i><span>' + Math.round(mon.fr) + '</span></div>' +
        '<div class="small mute">Battle level ' + mon.level + ' · ' + mon.xp + ' / ' + xpNeed(mon.lv) + ' XP to the next trainer level</div>' +
        '<div class="mm-abilitybox"><span class="mm-abilityicon">' + mon.ability.icon + '</span><div><b>' + esc(mon.ability.name) + '</b><div class="small mute">' + esc(mon.ability.desc) + '</div></div></div>' +
        '<div class="mm-dstats">' + stats + '</div>' +
        '<div class="mm-dmeta"><span><b>File</b> ' + C.formatGigabytes(mon.meta.size) + ' GB</span><span><b>Quantization</b> ' + esc(mon.meta.quantization_level || 'unknown') + '</span><span><b>Context</b> ' + C.formatContext(mon.meta.context) + '</span><span><b>Speed</b> ' + speed + '</span><span><b>Capabilities</b> ' + esc(caps) + '</span><span><b>Digest</b> ' + esc(String(mon.meta.digest || '').slice(0, 12) || '—') + '</span></div>' +
        '<div class="mm-matchtip">Strong against <b>' + strong.icon + ' ' + strong.name + '</b>. Weak to <b>' + weak.icon + ' ' + weak.name + '</b>.' + (mon.type2 ? ' Its second type is <b>' + C.typeInfo(mon.type2).icon + ' ' + C.typeInfo(mon.type2).name + '</b>.' : '') + '</div>' +
        '<h3>Moves</h3><div class="mm-movelist">' + moves + '</div>' +
        '<div class="mm-actions"><button class="' + (inS ? 'ib' : 'pri') + '" data-squad-dex="' + esc(mon.name) + '">' + (inS ? '✕ Remove from squad' : '＋ Add to squad') + '</button><button class="ib" data-rename="' + esc(mon.name) + '">✏ Rename</button><button class="ib" data-bench="' + esc(mon.name) + '">⚡ Measure tokens/sec</button><button class="ib" data-close="1">Close</button></div>' +
        '<div class="small mute" style="margin-top:6px">Measuring loads the model into memory and asks it for a few tokens. The first run can take a minute; the result is saved on this PC.</div>' +
        '</div></div>');
      const cb = el.querySelector('#mmmodal [data-close]'); if (cb) cb.focus();
    }

    /* ---------- benchmark ---------- */
    async function benchmark(name, btn) {
      if (benchBusy) return;
      benchBusy = true;
      const old = btn ? btn.textContent : '';
      if (btn) { btn.disabled = true; btn.textContent = '⏱ Measuring…'; }
      try {
        const t0 = performance.now();
        const r = await A.api('/api/chat', {
          model: name, stream: false, keep_alive: '2m',
          messages: [{ role: 'user', content: 'Reply with exactly one word: READY' }],
          options: { temperature: 0, num_predict: 8 }
        });
        if (r && r.error) throw new Error(r.error);
        let tps = 0;
        if (r && r.eval_count && r.eval_duration) tps = r.eval_count / (r.eval_duration / 1e9);
        else {
          const words = String((r && r.message && r.message.content) || '').trim().split(/\s+/).filter(Boolean).length || 1;
          tps = words / Math.max(.4, (performance.now() - t0) / 1000);
        }
        tps = Math.round(tps * 10) / 10;
        if (!(tps > 0)) throw new Error('The model answered, but no speed could be read.');
        speedMap[name] = tps;
        ls.set(SPEED_KEY, JSON.stringify(speedMap));
        rebuild();
        A.toast('⚡ ' + name + ': ' + tps + ' tokens/sec (measured)', 5000);
        if (el.querySelector('#mmmodal')) openDex(name); else if (screen === 'home') paintHome();
      } catch (e) {
        A.toast('Could not measure that model: ' + (e.message || e), 6000);
        if (btn && btn.isConnected) { btn.disabled = false; btn.textContent = old || '⚡ Measure tokens/sec'; }
      } finally { benchBusy = false; }
    }

    /* ---------- squad ---------- */
    function toggleSquad(name, source) {
      const mon = byName(name); if (!mon || !mon.registered) { A.toast('Scan this model before adding it to a squad.', 3200); return; }
      const at = squad.findIndex(m => m.name === name);
      if (at >= 0) squad.splice(at, 1);
      else {
        if (squad.length >= 6) { A.toast('Your squad is full. Remove one first.', 3000); return; }
        squad.push(mon);
      }
      squadNames = squad.map(m => m.name);
      saveSquad();
      if (screen === 'home') paintHome(name);
      const dex = el.querySelector('#mmmodal'); if (dex) openDex(name);
    }

    /* ---------- events ---------- */
    function onClick(e) {
      const t = e.target;
      if (!t || !t.closest) return;
      if (t.id === 'mmmodal') { closeModal(); return; }
      const dex = t.closest('[data-dex]');
      if (dex) { e.stopPropagation(); openDex(dex.dataset.dex); return; }
      const bm = t.closest('[data-bench]');
      if (bm) { benchmark(bm.dataset.bench, bm); return; }
      const sd = t.closest('[data-squad-dex]');
      if (sd) { toggleSquad(sd.dataset.squadDex); return; }
      const cl = t.closest('[data-close]');
      if (cl) { closeModal(); return; }
      const scanBtn = t.closest('[data-scan]');
      if (scanBtn) { openScan(scanBtn.dataset.scan); return; }
      const regBtn = t.closest('[data-register]');
      if (regBtn) { const ni = el.querySelector('#mmnick'); registerMonster(regBtn.dataset.register, ni ? ni.value : ''); return; }
      const pgSel = t.closest('[data-pgsel]');
      if (pgSel) { pgName = pgSel.dataset.pgsel; paintPlayground(pgName); return; }
      const pgAct = t.closest('[data-act]');
      if (pgAct) { playAct(pgAct.dataset.act); return; }
      const renBtn = t.closest('[data-rename]');
      if (renBtn) { renameMonster(renBtn.dataset.rename); return; }
      if (t.closest('[data-home]')) { paintHome(); return; }
      if (t.closest('[data-pg]')) { paintPlayground(); return; }
      if (t.closest('[data-reset]')) { resetProgress(); return; }
      if (t.closest('[data-sample]')) { models = SAMPLE.slice(); rebuild(); paintHome(); A.toast('Sample monsters loaded — scan one to begin.', 4000); return; }
      if (t.closest('#mmsend')) { const ci = el.querySelector('#mmcmd'); runCommand(ci ? ci.value : ''); return; }
      if (t.closest('#mmmic')) { micCommand(); return; }
      if (t.closest('#mmtalksend')) { const ti2 = el.querySelector('#mmtalk'); talkTo(ti2 ? ti2.value : ''); return; }
      const card = t.closest('[data-mon]');
      if (card) { toggleSquad(card.dataset.mon); return; }
      const clear = t.closest('[data-clear]');
      if (clear) { view.q = ''; view.tier = 'all'; const s = el.querySelector('#mmsrch'); if (s) s.value = ''; const ts = el.querySelector('#mmtier'); if (ts) ts.value = 'all'; updateGrid(); return; }
      if (t.closest('#mmrefresh')) { loadModels(true); return; }
      const cur = t.closest('[data-cur]');
      if (cur) { openPreview('curator', cur.dataset.cur); return; }
      if (t.closest('[data-quick]')) { openPreview('quick'); return; }
      if (t.closest('[data-watch]')) { openPreview('watch'); return; }
      const rm = t.closest('[data-remove]');
      if (rm) { squad.splice(+rm.dataset.remove, 1); squadNames = squad.map(m => m.name); saveSquad(); paintHome(); return; }
      const lead = t.closest('[data-lead]');
      if (lead) { const i = +lead.dataset.lead; const m = squad.splice(i, 1)[0]; if (m) squad.unshift(m); squadNames = squad.map(x => x.name); saveSquad(); paintHome(); return; }
      if (t.closest('[data-squad="auto"]')) { squad = owned().slice(0, Math.min(6, owned().length)); squadNames = squad.map(m => m.name); saveSquad(); paintHome(); return; }
      if (t.closest('[data-squad="clear"]')) { squad = []; squadNames = []; saveSquad(); paintHome(); return; }

      const start = t.closest('[data-start]');
      if (start) { startPending(); return; }
      const reroll = t.closest('[data-reroll]');
      if (reroll && pending) {
        const size = pending.teamB.length || 3;
        const spare = owned().filter(m => !squad.some(s => s.name === m.name));
        pending.teamB = C.buildQuickTeam(spare.length >= size ? spare : owned(), size, { seed: (Date.now() ^ 0x27d4eb2f) >>> 0 });
        paintPreview(); return;
      }
      const lp = t.closest('[data-leadpick]');
      if (lp && pending) { pending.lead = +lp.dataset.leadpick; paintPreview(); return; }

      const menu = t.closest('[data-menu]');
      if (menu) {
        const what = menu.dataset.menu;
        if (what === 'act') setMenu('moves');
        else if (what === 'team') setMenu('team');
        else if (what === 'kit') setMenu('kit');
        else if (what === 'run') leaveBattle();
        return;
      }
      const mv = t.closest('[data-mv]');
      if (mv && screen === 'battle') { playerMove(+mv.dataset.mv); return; }
      const sw = t.closest('[data-swap]');
      if (sw) { swapTo(+sw.dataset.swap); return; }
      const it = t.closest('[data-item]');
      if (it) { useKit(it.dataset.item); return; }
      if (t.closest('[data-back]')) { if (!ui.forced) setMenu('root'); return; }
      if (t.closest('#mmleave')) { leaveBattle(); return; }
      if (t.closest('#mmlogbtn')) { ui.log = !ui.log; const w = el.querySelector('#mmlogwrap'); if (w) w.style.display = ui.log ? '' : 'none'; const b = el.querySelector('#mmlogbtn'); if (b) b.setAttribute('aria-pressed', String(ui.log)); return; }
      if (t.closest('#mmauto')) { toggleAuto(); return; }
      const pip = t.closest('[data-pip]');
      if (pip) { if (!ui.forced) setMenu('team'); return; }
      const r = t.closest('[data-r]');
      if (r) {
        const what = r.dataset.r;
        if (what === 'home') { paintHome(); }
        else if (what === 'again') { if (lastBattle) startBattle(lastBattle.teamA, lastBattle.teamB, { curator: lastBattle.curator, watch: lastBattle.watch }); else paintHome(); }
        else if (what === 'next') { const k = nextCuratorKey(); if (k) { paintHome(); openPreview('curator', k); } }
        return;
      }
    }
    function onInput(e) {
      if (e.target.id === 'mmsrch') { view.q = e.target.value; updateGrid(); }
      if (e.target.id === 'mmtalk') pgDraft = e.target.value;
    }
    function onChange(e) {
      if (e.target.id === 'mmtier') { view.tier = e.target.value; updateGrid(); }
    }
    function onKey(e) {
      if (stopped || A.cur !== 'play') return;
      const t = e.target || {}, tag = t.tagName || '';
      /* Enter sends a typed command or a line of conversation, and nothing else sees that key */
      if (t.id === 'mmcmd' && e.key === 'Enter') { e.preventDefault(); runCommand(t.value); return; }
      if (t.id === 'mmtalk' && e.key === 'Enter') { e.preventDefault(); talkTo(t.value); return; }
      if (t.id === 'mmnick' && e.key === 'Enter') { e.preventDefault(); const b = el.querySelector('[data-register]'); if (b) { registerMonster(b.dataset.register, t.value); } return; }
      if (e.key === 'Escape') {
        const m = el.querySelector('#mmmodal');
        if (m) { e.preventDefault(); closeModal(); return; }
        if (screen === 'battle' && ui.log && !ui.forced) { e.preventDefault(); ui.log = false; const w = el.querySelector('#mmlogwrap'); if (w) w.style.display = 'none'; return; }
        if (screen === 'battle' && !ui.forced && ui.menu !== 'root' && !busy && !auto) { e.preventDefault(); setMenu('root'); return; }
      }
      if (screen === 'home') {
        const card = t.closest && t.closest('[data-mon]');
        if (card && t === card && (e.key === 'Enter' || e.key === ' ' || e.key === 'Spacebar')) {
          e.preventDefault(); toggleSquad(card.dataset.mon); return;
        }
        return;
      }
      if (screen !== 'battle' || !battle || /INPUT|TEXTAREA|SELECT/.test(tag)) return;
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      if (battle.over || busy || auto) return;
      if (ui.forced) return;
      if (/^[1-4]$/.test(e.key)) { e.preventDefault(); playerMove(+e.key - 1); return; }
      if (e.key === 'a' || e.key === 'A') { e.preventDefault(); setMenu('moves'); return; }
      if (e.key === 't' || e.key === 'T') { e.preventDefault(); setMenu('team'); return; }
      if (e.key === 'k' || e.key === 'K') { e.preventDefault(); setMenu('kit'); return; }
      if (e.key === 'f' || e.key === 'F') { e.preventDefault(); leaveBattle(); return; }
    }

    function stop() {
      stopped = true; clearTimeout(autoTimer); timers.forEach(clearTimeout);
      el.removeEventListener('click', onClick);
      el.removeEventListener('input', onInput);
      el.removeEventListener('change', onChange);
      document.removeEventListener('keydown', onKey);
      closeModal();
      el.innerHTML = '';
    }

    return stop;
  }
})();

// Entertainment > Depths: an original turn-based roguelike. Pick a class, descend through procedurally generated dungeon floors, fight, loot, level up and try to reach the
// Dragon on floor 10 (then keep going as deep as you dare). Permadeath, but your run is saved automatically every turn so you can stop and come back.
// Arrow keys / WASD move (bump to attack), . waits, 1-9 use an item, G picks up, > descends, R restarts after death.
(() => {
  const P = A.play; if (!P) return; const W = 44, H = 26, T = 18, KEY = 'depths_run';
  const CLASSES = { warrior: { n: 'Warrior', i: '🛡️', hp: 34, atk: 3, def: 2, desc: 'Tough and steady.' }, rogue: { n: 'Rogue', i: '🗡️', hp: 24, atk: 3, def: 1, crit: .25, desc: 'Fast hits, crits for double. Sees farther.', sight: 9 }, mage: { n: 'Mage', i: '🔮', hp: 20, atk: 2, def: 0, spells: 3, desc: 'Starts with fire scrolls and a heal.' } };
  const MON = [['🐀', 'rat', 5, 1, 0, 1, 1], ['🦇', 'bat', 6, 2, 0, 2, 1], ['👺', 'goblin', 11, 3, 0, 3, 2], ['💀', 'skeleton', 14, 4, 1, 4, 3], ['👹', 'orc', 22, 6, 1, 5, 4], ['👻', 'wraith', 18, 7, 1, 6, 5], ['🧌', 'troll', 36, 8, 2, 7, 7], ['🐍', 'serpent', 26, 9, 1, 8, 8]];   // glyph, name, hp, atk, def, minFloor, xp
  const ITEMS = [['🧪', 'healing potion', 'heal'], ['📜', 'scroll of fire', 'fire'], ['📜', 'scroll of teleport', 'tele'], ['🗺️', 'map scroll', 'map'], ['💪', 'potion of strength', 'str'], ['⚔️', 'sword', 'wpn'], ['🛡️', 'shield', 'arm'], ['🍖', 'ration', 'food']];
  const rnd = n => Math.random() * n | 0, pick = a => a[rnd(a.length)];
  P.games.depths = { name: 'Depths', icon: '🕳️', desc: 'A roguelike dungeon crawl: procedural floors, three classes, loot, levels, a dragon on floor 10, and no second chances. Autosaves every turn.', mount(el, api) {
    let S = null, dead = false, cv, cx, logEl, invEl, statEl;
    const save = () => { try { if (S && !S.over) ls.set(KEY, JSON.stringify(S)); else ls.set(KEY, ''); } catch (e) { } };
    const log = t => { S.log.push(t); if (S.log.length > 60) S.log.shift(); };
    const gen = floor => {
      const m = Array.from({ length: H }, () => Array(W).fill(1)), rooms = [];
      for (let t = 0; t < 60 && rooms.length < 9; t++) { const w = 4 + rnd(7), h = 3 + rnd(5), x = 1 + rnd(W - w - 2), y = 1 + rnd(H - h - 2); if (rooms.some(r => x < r.x + r.w + 2 && x + w + 2 > r.x && y < r.y + r.h + 2 && y + h + 2 > r.y)) continue; rooms.push({ x, y, w, h }); for (let j = y; j < y + h; j++) for (let i = x; i < x + w; i++) m[j][i] = 0; }
      const c = r => [r.x + (r.w >> 1), r.y + (r.h >> 1)];
      for (let k = 1; k < rooms.length; k++) { let [ax, ay] = c(rooms[k - 1]), [bx, by] = c(rooms[k]); while (ax !== bx) { m[ay][ax] = 0; ax += Math.sign(bx - ax); } while (ay !== by) { m[ay][ax] = 0; ay += Math.sign(by - ay); } }
      const free = () => { for (; ;) { const r = pick(rooms), x = r.x + rnd(r.w), y = r.y + rnd(r.h); if (!S.ents.some(e => e.x === x && e.y === y) && !(S.p && S.p.x === x && S.p.y === y)) return [x, y]; } };
      S.ents = []; S.items = []; S.map = m; S.seen = Array.from({ length: H }, () => Array(W).fill(0)); S.floor = floor;
      const [px, py] = c(rooms[0]); if (S.p) { S.p.x = px; S.p.y = py; }
      const [sx, sy] = c(rooms[rooms.length - 1]); S.stairs = floor >= 10 && !S.won ? null : [sx, sy];
      const boss = floor === 10 && !S.won; if (boss) { S.ents.push({ g: '🐉', n: 'the Dragon', hp: 90, mhp: 90, atk: 12, def: 3, xp: 80, x: sx, y: sy, boss: 1 }); }
      const nm = 6 + floor + rnd(3); for (let i = 0; i < nm; i++) { const pool = MON.filter(q => q[5] <= floor + 1 && q[5] >= floor - 4); const q = pick(pool.length ? pool : MON), [x, y] = free(), sc = 1 + Math.max(0, floor - q[5]) * .12; S.ents.push({ g: q[0], n: q[1], hp: Math.round(q[2] * sc), mhp: Math.round(q[2] * sc), atk: Math.round(q[3] * sc), def: q[4], xp: q[6], x, y, awake: 0 }); }
      const ni = 4 + rnd(4); for (let i = 0; i < ni; i++) { const [x, y] = free(); const it = Math.random() < .3 ? ITEMS[0] : pick(ITEMS); S.items.push({ g: it[0], n: it[1], k: it[2], x, y }); }
      for (let i = 0; i < 3 + rnd(4); i++) { const [x, y] = free(); S.items.push({ g: '💰', n: 'gold', k: 'gold', v: 10 + rnd(20 + floor * 12), x, y }); }
    };
    const newRun = cls => { const C = CLASSES[cls]; S = { cls, p: { x: 0, y: 0, hp: C.hp, mhp: C.hp, atk: C.atk, def: C.def, lv: 1, xp: 0, next: 18, gold: 0 }, inv: [], log: [], floor: 1, turn: 0, over: 0, won: 0, kills: 0 }; if (cls === 'mage') { S.inv.push({ g: '📜', n: 'scroll of fire', k: 'fire' }, { g: '📜', n: 'scroll of fire', k: 'fire' }, { g: '🧪', n: 'healing potion', k: 'heal' }); } else S.inv.push({ g: '🧪', n: 'healing potion', k: 'heal' }); gen(1); log('You descend into the Depths as a ' + C.n + '. Find the stairs (>).'); save(); draw(); };
    const sight = () => (CLASSES[S.cls].sight || 7);
    const los = (x0, y0, x1, y1) => { let dx = Math.abs(x1 - x0), dy = -Math.abs(y1 - y0), sx = x0 < x1 ? 1 : -1, sy = y0 < y1 ? 1 : -1, e = dx + dy; for (; ;) { if (x0 === x1 && y0 === y1) return true; if (S.map[y0][x0] && !(x0 === S.p.x && y0 === S.p.y)) return false; const e2 = 2 * e; if (e2 >= dy) { e += dy; x0 += sx; } if (e2 <= dx) { e += dx; y0 += sy; } } };
    const visible = (x, y) => Math.hypot(x - S.p.x, y - S.p.y) <= sight() && los(S.p.x, S.p.y, x, y);
    const entAt = (x, y) => S.ents.find(e => e.x === x && e.y === y);
    const dmg = (a, d) => Math.max(1, a - d + (rnd(3) - 1));
    const gain = e => { S.p.xp += e.xp; S.kills++; log('You slay the ' + e.n + '.'); if (e.boss) { S.won = 1; log('The Dragon falls! You have conquered the Depths. You may keep descending...'); S.stairs = S.stairs || [e.x, e.y]; } while (S.p.xp >= S.p.next) { S.p.xp -= S.p.next; S.p.lv++; S.p.next = Math.round(S.p.next * 1.5); S.p.mhp += 6; S.p.hp = Math.min(S.p.mhp, S.p.hp + 8); S.p.atk += 1; if (S.p.lv % 2 === 0) S.p.def += 1; log('Level ' + S.p.lv + '! You feel stronger.'); } };
    const enemyTurn = () => {
      for (const e of S.ents.slice()) {
        const d = Math.hypot(e.x - S.p.x, e.y - S.p.y); if (!e.awake && d <= 8 && visible(e.x, e.y)) e.awake = 1; if (!e.awake) continue;
        if (d < 1.5) { if (Math.random() < (e.g === '🦇' ? .85 : .75)) { const q = dmg(e.atk, S.p.def); S.p.hp -= q; log('The ' + e.n + ' hits you for ' + q + '.'); if (S.p.hp <= 0) { S.over = 1; log('You die on floor ' + S.floor + '.'); return; } } else log('The ' + e.n + ' misses.'); continue; }
        if (d > 14) continue; let best = null, bd = d; const dirs = [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [-1, -1], [1, -1], [-1, 1]]; if (e.g === '🦇' && Math.random() < .35) { const r = pick(dirs); best = [e.x + r[0], e.y + r[1]]; bd = -1; }
        if (!best) for (const [dx, dy] of dirs) { const nx = e.x + dx, ny = e.y + dy, nd = Math.hypot(nx - S.p.x, ny - S.p.y); if (nd < bd && !S.map[ny][nx] && !entAt(nx, ny) && !(nx === S.p.x && ny === S.p.y)) { bd = nd; best = [nx, ny]; } }
        if (best && !S.map[best[1]][best[0]] && !entAt(best[0], best[1]) && !(best[0] === S.p.x && best[1] === S.p.y)) { e.x = best[0]; e.y = best[1]; }
      }
    };
    const endTurn = () => { S.turn++; if (S.turn % 9 === 0 && S.p.hp < S.p.mhp) S.p.hp++; enemyTurn(); save(); if (S.over) { api.submit(S.floor * 1000 + S.p.gold + S.kills * 5); } draw(); };
    const act = (dx, dy) => {
      if (S.over) return; const nx = S.p.x + dx, ny = S.p.y + dy; if (nx < 0 || ny < 0 || nx >= W || ny >= H) return; const e = entAt(nx, ny);
      if (e) { e.awake = 1; if (Math.random() < .88) { let q = dmg(S.p.atk + (S.p.wpn || 0), e.def); if (Math.random() < (CLASSES[S.cls].crit || .06)) { q *= 2; log('Critical hit!'); } e.hp -= q; log('You hit the ' + e.n + ' for ' + q + '.'); if (e.hp <= 0) { S.ents.splice(S.ents.indexOf(e), 1); gain(e); } } else log('You miss the ' + e.n + '.'); return endTurn(); }
      if (S.map[ny][nx]) return; S.p.x = nx; S.p.y = ny; const it = S.items.findIndex(i => i.x === nx && i.y === ny);
      if (it >= 0) { const i = S.items[it]; if (i.k === 'gold') { S.p.gold += i.v; log('You pick up ' + i.v + ' gold.'); S.items.splice(it, 1); } else if (S.inv.length < 9) { S.inv.push({ g: i.g, n: i.n, k: i.k }); S.items.splice(it, 1); log('You take the ' + i.n + '.'); } else log('Your pack is full.'); }
      endTurn();
    };
    const use = n => {
      if (S.over) return; const i = S.inv[n]; if (!i) return; const p = S.p; let used = true;
      if (i.k === 'heal') { const q = 14 + S.floor * 2; p.hp = Math.min(p.mhp, p.hp + q); log('You drink the potion (+' + q + ' HP).'); }
      else if (i.k === 'food') { p.hp = Math.min(p.mhp, p.hp + 8); log('You eat the ration.'); }
      else if (i.k === 'str') { p.atk++; log('You feel stronger (+1 attack).'); }
      else if (i.k === 'wpn') { p.wpn = (p.wpn || 0) + 2; log('You wield the sword (+2 damage).'); }
      else if (i.k === 'arm') { p.def++; log('You carry the shield (+1 defence).'); }
      else if (i.k === 'map') { for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) S.seen[y][x] = 1; log('The map reveals the floor.'); }
      else if (i.k === 'tele') { for (let t = 0; t < 200; t++) { const x = rnd(W), y = rnd(H); if (!S.map[y][x] && !entAt(x, y)) { p.x = x; p.y = y; break; } } log('You are teleported!'); }
      else if (i.k === 'fire') { let n2 = 0; for (const e of S.ents.slice()) if (visible(e.x, e.y)) { const q = 10 + S.p.lv * 2; e.hp -= q; n2++; if (e.hp <= 0) { S.ents.splice(S.ents.indexOf(e), 1); gain(e); } } log(n2 ? 'Flames burst out and hit ' + n2 + ' enemies!' : 'The fire fizzles out with no target.'); if (!n2) used = false; }
      if (used) { S.inv.splice(n, 1); endTurn(); } else draw();
    };
    const descend = () => { if (S.over) return; if (!S.stairs || S.p.x !== S.stairs[0] || S.p.y !== S.stairs[1]) { log('There are no stairs here.'); return draw(); } S.floor++; gen(S.floor); log('You descend to floor ' + S.floor + '.'); S.p.hp = Math.min(S.p.mhp, S.p.hp + 3); endTurn(); };
    const draw = () => {
      if (dead || !S || !cv || !document.body.contains(cv)) return; cx.fillStyle = '#0b0b10'; cx.fillRect(0, 0, cv.width, cv.height); cx.font = (T - 2) + 'px "Segoe UI Emoji","Noto Color Emoji",sans-serif'; cx.textBaseline = 'middle'; cx.textAlign = 'center';
      for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) { const vis = visible(x, y); if (vis) S.seen[y][x] = 1; if (!S.seen[y][x]) continue; const wall = S.map[y][x]; cx.fillStyle = wall ? (vis ? '#3a3550' : '#1f1c2c') : (vis ? '#2a2a33' : '#17171d'); cx.fillRect(x * T, y * T, T - 1, T - 1); if (S.stairs && x === S.stairs[0] && y === S.stairs[1]) { cx.fillStyle = '#ffd24a'; cx.fillText('⬇️', x * T + T / 2, y * T + T / 2 + 1); } }
      for (const i of S.items) if (visible(i.x, i.y)) cx.fillText(i.g, i.x * T + T / 2, i.y * T + T / 2 + 1);
      for (const e of S.ents) if (visible(e.x, e.y)) { cx.fillText(e.g, e.x * T + T / 2, e.y * T + T / 2 + 1); if (e.hp < e.mhp) { cx.fillStyle = '#e53'; cx.fillRect(e.x * T + 1, e.y * T + T - 4, (T - 3) * e.hp / e.mhp, 3); } }
      cx.fillText(S.over ? '🪦' : CLASSES[S.cls].i, S.p.x * T + T / 2, S.p.y * T + T / 2 + 1);
      const p = S.p; statEl.innerHTML = '<b>' + CLASSES[S.cls].n + '</b> · Floor <b>' + S.floor + '</b> · HP <b style="color:' + (p.hp < p.mhp * .3 ? 'var(--bad)' : 'var(--ok)') + '">' + Math.max(0, p.hp) + '/' + p.mhp + '</b> · Lv ' + p.lv + ' (' + p.xp + '/' + p.next + ') · ATK ' + (p.atk + (p.wpn || 0)) + ' DEF ' + p.def + ' · 💰 ' + p.gold;
      invEl.innerHTML = S.inv.length ? S.inv.map((i, n) => '<button class="ib" data-i="' + n + '" style="margin:2px" title="' + i.n + '">' + (n + 1) + ' ' + i.g + ' <span class="small">' + i.n + '</span></button>').join('') : '<span class="small mute">Pack empty. Items you pick up appear here (press 1-9 to use).</span>';
      logEl.innerHTML = S.log.slice(-7).map(t => '<div>' + t + '</div>').join(''); api.hud('Floor ' + S.floor + ' · Level ' + p.lv + ' · ' + p.gold + ' gold');
      if (S.over) { cx.fillStyle = 'rgba(0,0,0,.65)'; cx.fillRect(0, 0, cv.width, cv.height); cx.fillStyle = '#fff'; cx.font = 'bold 26px sans-serif'; cx.fillText('You died on floor ' + S.floor, cv.width / 2, cv.height / 2 - 16); cx.font = '16px sans-serif'; cx.fillText('Score ' + (S.floor * 1000 + p.gold + S.kills * 5) + ' · press R for a new run', cv.width / 2, cv.height / 2 + 16); }
    };
    const menu = () => {
      el.innerHTML = '<div style="text-align:center;max-width:520px"><h2 style="margin:0 0 6px">🕳️ Depths</h2><div class="small mute" style="margin-bottom:12px">Descend. Loot. Level up. Slay the Dragon on floor 10. One life.</div><div class="row" style="gap:10px;justify-content:center;flex-wrap:wrap">' + Object.entries(CLASSES).map(([k, c]) => '<button class="card" data-c="' + k + '" style="width:150px;cursor:pointer;margin:0"><div style="font-size:34px">' + c.i + '</div><b>' + c.n + '</b><div class="small mute">' + c.desc + '</div><div class="small">HP ' + c.hp + ' · ATK ' + c.atk + '</div></button>').join('') + '</div><div id="dcont" style="margin-top:12px"></div></div>';
      let run = null; try { run = JSON.parse(ls.get(KEY, 'null')); } catch (e) { } if (run && run.p && !run.over) { const b = document.createElement('button'); b.className = 'pri'; b.textContent = 'Continue your run (floor ' + run.floor + ', level ' + run.p.lv + ')'; b.onclick = () => { S = run; play(); }; el.querySelector('#dcont').appendChild(b); }
      el.querySelectorAll('[data-c]').forEach(b => b.onclick = () => { newRun(b.dataset.c); play(); });
    };
    const play = () => {
      el.innerHTML = '<div style="display:flex;flex-direction:column;gap:6px;max-width:100%"><div id="dstat" class="small" style="min-height:20px"></div><canvas id="dcv" width="' + W * T + '" height="' + H * T + '" style="border:1px solid var(--line);border-radius:10px;max-width:100%;height:auto"></canvas><div id="dinv"></div><div id="dlog" class="small" style="min-height:96px;line-height:1.5"></div><div class="small mute">Move: arrows/WASD (bump to attack) · . wait · 1-9 use item · &gt; descend · R new run · Esc menu</div></div>';
      cv = el.querySelector('#dcv'); cx = cv.getContext('2d'); logEl = el.querySelector('#dlog'); invEl = el.querySelector('#dinv'); statEl = el.querySelector('#dstat'); invEl.onclick = e => { const b = e.target.closest('[data-i]'); if (b) use(+b.dataset.i); }; draw();
    };
    const key = e => {
      if (dead || !S || !cv || !document.body.contains(cv)) return; if (/INPUT|TEXTAREA|SELECT/.test(e.target.tagName)) return; const k = e.key; const M = { ArrowUp: [0, -1], w: [0, -1], W: [0, -1], ArrowDown: [0, 1], s: [0, 1], S: [0, 1], ArrowLeft: [-1, 0], a: [-1, 0], A: [-1, 0], ArrowRight: [1, 0], d: [1, 0], D: [1, 0] };
      if (M[k]) { e.preventDefault(); act(M[k][0], M[k][1]); } else if (k === '.' || k === ' ') { e.preventDefault(); if (!S.over) endTurn(); } else if (k >= '1' && k <= '9') use(+k - 1); else if (k === '>' || k === 'Enter') descend(); else if (k === 'r' || k === 'R') { if (S.over) menu(); } else if (k === 'Escape') { save(); menu(); }
    };
    document.addEventListener('keydown', key); menu();
    return () => { dead = true; document.removeEventListener('keydown', key); };
  } };
})();

// Studio > Game maker. Describe a game in plain words; the chosen AI model writes one self-contained HTML page and it plays
// here in a sealed iframe (sandbox="allow-scripts" without allow-same-origin, plus a CSP that blocks every network request),
// so a game cannot reach Moundshroud, your files or the internet. Each button press is exactly one AI request with a token
// cap (MAX_NEW / MAX_EDIT). </> Code opens the game's own HTML in an editor with line numbers: change it and ▶ Run my code
// (Ctrl+Enter); your edits count as a change, so ↶ Undo goes back. Saved games live in localStorage under oa_gm_games.
(() => {
  if (!A.studio) return; const esc = A.studio.esc;
  const KEY = 'gm_games', MAX_NEW = 7000, MAX_EDIT = 8000, MAX_SRC = 400000, KEEP = 30, MAX_PARTS = 10;
  /* the model's working memory (tokens), sized to the request: a fixed 16k cut long games short, even on the 64k and 128k models */
  const ctxFor = (chars, cap) => Math.min(131072, Math.max(16384, Math.ceil((chars / 3 + cap + 1024) / 8192) * 8192));
  const CONT = 'You stopped before the HTML file was finished. Continue it exactly where you stopped, starting with the very next character. Do not repeat anything already written, do not start over, do not open a new code block, and write no explanation. End the file with </html>.';
  /* stitch a continuation onto the reply so far: drop a restarted code fence and any text the model repeated */
  const joinPart = (a, b) => {
    b = String(b || '').replace(/^\s*```[a-z]*\s*\n/i, '');
    if (/^\s*(<!doctype html|<html)/i.test(b)) return b;                    // it started the whole file again: keep the new attempt
    for (let k = Math.min(600, a.length, b.length); k >= 12; k--) if (a.endsWith(b.slice(0, k))) return a + b.slice(k);
    return a + b;
  };
  const IDEAS = [['🚀', 'Space shooter', 'A space shooter: my ship moves with the arrow keys, fires with space, and waves of aliens get faster each level'], ['🐍', 'Neon snake', 'Snake on a neon grid that speeds up as it grows, with a high score'], ['🧱', 'Brick breaker', 'Brick breaker with a paddle on the mouse, power-ups that drop from bricks, and 3 lives'], ['🦘', 'Platformer', 'A platformer: jump across moving platforms to reach a flag, with coins to collect'], ['🃏', 'Memory match', 'A memory card matching game with emoji cards, a move counter and a timer'], ['☄️', 'Dodge the rocks', 'Dodge the falling rocks: move left and right, the rocks get faster, survive as long as you can']];
  const SYS = 'You are an expert HTML5 game developer. Write ONE complete, self-contained HTML file for the game the user describes.\n' +
    'Rules:\n- Everything inline: one <style> and one <script>. No external files, libraries, fonts, images, sounds or network requests of any kind (no fetch, no CDN). Draw with <canvas> or DOM; make sound only with the Web Audio API.\n' +
    '- Put a short catchy game name in <title>.\n- The game fills the whole window (100vw x 100vh, no scrollbars) and adapts when the window is resized.\n' +
    '- Include a start screen with the name and the controls, a score, a game-over screen, and restart with R or a click.\n' +
    '- Keyboard and mouse controls must both work where they make sense. Listen for keys on window.\n- Polished look: smooth animation with requestAnimationFrame, nice colours, simple particle effects.\n' +
    '- Write as much code as the game needs, and always finish the whole file. Do not use localStorage, alert, prompt or confirm.\n' +
    'Reply with ONLY the HTML file inside one ```html code block. No explanation before or after.';
  // what every game gets before its own code: the sealing CSP, error reporting to the app, and arrow keys/space not scrolling
  const HEAD = '<meta charset="utf-8"><meta http-equiv="Content-Security-Policy" content="default-src \'none\'; script-src \'unsafe-inline\'; style-src \'unsafe-inline\'; img-src data: blob:; media-src data: blob:; font-src data:">' +
    '<script>(function(){var mem=function(){var d={};return{getItem:function(k){return Object.prototype.hasOwnProperty.call(d,k)?d[k]:null},setItem:function(k,v){d[k]=String(v)},removeItem:function(k){delete d[k]},clear:function(){d={}},key:function(i){return Object.keys(d)[i]||null},get length(){return Object.keys(d).length}}};["localStorage","sessionStorage"].forEach(function(n){try{window[n].length}catch(e){try{Object.defineProperty(window,n,{value:mem(),configurable:true})}catch(x){}}});var s=function(m){try{parent.postMessage({gmErr:String(m).slice(0,400)},"*")}catch(e){}};window.addEventListener("error",function(e){s((e.message||"Error")+(e.lineno?" (line "+e.lineno+")":""))});window.addEventListener("unhandledrejection",function(e){s(e.reason&&e.reason.message||e.reason)});' +
    'window.addEventListener("keydown",function(e){var t=e.target&&e.target.tagName;if(t!=="INPUT"&&t!=="TEXTAREA"&&[" ","ArrowUp","ArrowDown","ArrowLeft","ArrowRight"].indexOf(e.key)>=0)e.preventDefault()},{passive:false});window.addEventListener("mousedown",function(){window.focus()});var w=window.innerWidth;setInterval(function(){if(window.innerWidth!==w){w=window.innerWidth;window.dispatchEvent(new Event("resize"))}},500);window.addEventListener("load",function(){setTimeout(function(){window.dispatchEvent(new Event("resize"))},80)});})()<\/script>';
  const seal = h => '<!doctype html>' + HEAD + String(h).replace(/<!doctype[^>]*>/i, '');
  const list = () => { try { return JSON.parse(ls.get(KEY, '[]')) || []; } catch (e) { return []; } };
  const store = l => { const s = JSON.stringify(l); ls.set(KEY, s); return ls.get(KEY, '') === s; };
  const titleOf = h => { const m = /<title[^>]*>([^<]{1,60})<\/title>/i.exec(h || ''); return m ? m[1].trim() : ''; };
  /* the game HTML out of a model reply; null with a reason when it is missing or cut off */
  function extract(t) {
    t = String(t || ''); const f = /```(?:html)?\s*\n([\s\S]*?)(?:```|$)/i.exec(t); let h = (f ? f[1] : t).trim();
    const a = h.search(/<!doctype html|<html/i); if (a > 0) h = h.slice(a);
    if (!/<script|<canvas|<body/i.test(h)) return { err: 'The AI answered without any game code. Try again, or describe the game a little differently.' };
    if (!/<\/html>\s*$/i.test(h) && !/<\/body>\s*$/i.test(h)) return { cut: true, err: 'The game was still unfinished after ' + MAX_PARTS + ' parts. Press Make again, or describe it in fewer words.' };
    return { html: h };
  }
  /* how much of the game really changed: lines that went away, and lines that appeared */
  function diffStat(a, b) {
    const count = s => { const m = new Map(); String(s || '').split('\n').forEach(l => { const k = l.trim(); if (k) m.set(k, (m.get(k) || 0) + 1); }); return m; };
    const o = count(a), n = count(b); let gone = 0, add = 0;
    for (const [k, v] of o) { const w = n.get(k) || 0; if (v > w) gone += v - w; }
    for (const [k, v] of n) { const w = o.get(k) || 0; if (v > w) add += v - w; }
    return { gone, add, lines: String(a || '').split('\n').length };
  }
  /* styles live here so the feature is one file; every class starts with gmk- so app-wide classes cannot override it */
  if (!document.getElementById('gmk-css')) { const st = document.createElement('style'); st.id = 'gmk-css'; st.textContent = `
.gmk{--g1:var(--acc,#7c5cff);--g2:var(--acc2,#22d3ee)}
.gmk-hero{display:flex;align-items:flex-end;gap:16px;flex-wrap:wrap;padding:18px 20px;margin-bottom:14px;border-radius:16px;border:1px solid var(--line);background:radial-gradient(120% 140% at 0% 0%,color-mix(in srgb,var(--g1) 26%,transparent),transparent 60%),radial-gradient(120% 140% at 100% 100%,color-mix(in srgb,var(--g2) 18%,transparent),transparent 55%),var(--panel)}
.gmk-hero h2{margin:2px 0 4px;font-size:26px;letter-spacing:-.01em}.gmk-hero>div:first-child{flex:1;min-width:260px}
.gmk-kicker{font-size:11px;letter-spacing:.18em;font-weight:700;color:var(--g1)}.gmk-sub{color:var(--mute);font-size:13px;max-width:640px;line-height:1.5}
.gmk-model{font-size:12px;color:var(--mute);display:flex;flex-direction:column;gap:4px}.gmk-model select{min-width:220px}
.gmk-grid{display:grid;grid-template-columns:minmax(260px,330px) 1fr;gap:14px;align-items:start}@media(max-width:900px){.gmk-grid{grid-template-columns:1fr}}
.gmk-side{display:flex;flex-direction:column;gap:12px}
.gmk-card{border:1px solid var(--line);border-radius:14px;background:var(--panel);padding:14px}
.gmk-h{font-weight:700;margin-bottom:8px;display:flex;align-items:center;gap:8px}.gmk-count{font-size:11px;font-weight:600;padding:1px 8px;border-radius:99px;background:var(--panel2);color:var(--mute)}
.gmk textarea{width:100%;box-sizing:border-box;line-height:1.5;resize:vertical}
.gmk-ideas{display:flex;flex-wrap:wrap;gap:6px;margin:8px 0 10px}
.gmk-idea{font-size:12px;padding:4px 10px;border-radius:99px;border:1px solid var(--line);background:var(--panel2);color:var(--text);cursor:pointer}.gmk-idea:hover{border-color:var(--g1)}
.gmk-go{width:100%;padding:10px 14px;border:0;border-radius:10px;font-weight:700;font-size:14px;color:#fff;cursor:pointer;background:linear-gradient(135deg,var(--g1),var(--g2));box-shadow:0 6px 20px -8px var(--g1)}.gmk-go:hover{filter:brightness(1.08)}.gmk-go:disabled{opacity:.55;cursor:default;filter:none}
.gmk-row{display:flex;gap:8px;margin-top:8px}.gmk-row .gmk-go{flex:1}
.gmk-btn{padding:6px 12px;border-radius:9px;border:1px solid var(--line);background:var(--panel2);color:var(--text);cursor:pointer;font-size:13px;white-space:nowrap}.gmk-btn:hover:not(:disabled){border-color:var(--g1)}.gmk-btn:disabled{opacity:.45;cursor:default}.gmk-btn.gmk-on{border-color:var(--g1);color:var(--g1)}
.gmk-pri{background:var(--g1);border-color:var(--g1);color:#fff;font-weight:600}
.gmk-note{font-size:11.5px;color:var(--mute);margin-top:6px}
.gmk-hist{margin-top:6px}.gmk-ask{font-size:12px;padding:4px 8px;margin-top:4px;border-left:2px solid var(--g1);background:var(--panel2);border-radius:0 6px 6px 0}
.gmk-item{display:flex;align-items:center;gap:4px;border:1px solid var(--line);border-radius:10px;margin-top:6px;padding:2px;background:var(--panel2)}.gmk-item.gmk-on{border-color:var(--g1);box-shadow:0 0 0 1px var(--g1) inset}
.gmk-open{flex:1;min-width:0;text-align:left;background:none;border:0;color:var(--text);cursor:pointer;padding:6px 8px;display:flex;flex-direction:column;gap:2px}
.gmk-iname{font-weight:600;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.gmk-meta{font-size:11px;color:var(--mute)}
.gmk-mini{background:none;border:0;color:var(--mute);cursor:pointer;padding:6px;border-radius:7px;font-size:13px}.gmk-mini:hover{background:var(--panel);color:var(--text)}.gmk-mini.gmk-danger{color:#fff;background:var(--bad,#e5484d);font-weight:600}
.gmk-rename{flex:1;min-width:0;margin:4px}
.gmk-main{min-width:0}
.gmk-bar{display:flex;align-items:center;gap:6px;flex-wrap:wrap;margin-bottom:8px}.gmk-sp{flex:1}
.gmk-name{font-size:17px;font-weight:700;background:transparent;border:1px solid transparent;border-radius:8px;padding:5px 8px;color:var(--text);min-width:180px;max-width:340px}.gmk-name:hover:not(:disabled),.gmk-name:focus{border-color:var(--line);background:var(--panel)}
.gmk-stage{position:relative;aspect-ratio:16/10;max-height:68vh;width:100%;border-radius:14px;overflow:hidden;border:1px solid var(--line);background:#07070c;box-shadow:0 18px 50px -24px rgba(0,0,0,.7)}
.gmk-stage:fullscreen{max-height:none;border-radius:0;border:0}
.gmk-frame{width:100%;height:100%;border:0;display:block;background:#000}
.gmk-empty{position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:6px;color:#9aa0b4;text-align:center;padding:20px;background:radial-gradient(60% 60% at 50% 40%,color-mix(in srgb,var(--g1) 22%,transparent),transparent 70%)}.gmk-empty b{color:#e8e9f3;font-size:16px}.gmk-empty-i{font-size:46px}
.gmk-msg{margin-top:10px;padding:10px 14px;border-radius:10px;font-size:13px;line-height:1.5;border:1px solid var(--line);background:var(--panel);display:flex;align-items:center;gap:10px;flex-wrap:wrap}
.gmk-ok{border-color:color-mix(in srgb,var(--ok,#30a46c) 55%,var(--line))}.gmk-warn{border-color:color-mix(in srgb,var(--warn,#f5a524) 60%,var(--line))}.gmk-err{border-color:var(--bad,#e5484d);background:color-mix(in srgb,var(--bad,#e5484d) 10%,var(--panel))}
.gmk-busy #gmprog{flex:1}.gmk-track{flex-basis:100%;height:4px;border-radius:4px;background:var(--panel2);overflow:hidden}.gmk-track>div{height:100%;width:2%;background:linear-gradient(90deg,var(--g1),var(--g2));transition:width .3s}
.gmk-spin{width:14px;height:14px;border-radius:50%;border:2px solid var(--line);border-top-color:var(--g1);animation:gmkspin .8s linear infinite}@keyframes gmkspin{to{transform:rotate(360deg)}}
.gmk-src{display:block;width:100%;box-sizing:border-box;min-height:380px;height:52vh;resize:vertical;overflow:auto;font:12.5px/1.5 Consolas,"Cascadia Mono",monospace;padding:10px 12px;border-radius:0 10px 10px 0;border:1px solid var(--line);background:var(--panel2);color:var(--text);tab-size:2}.gmk-codebar{display:flex;align-items:center;gap:8px;flex-wrap:wrap;margin:10px 0 6px}
`; document.head.appendChild(st); }
  const ago = ts => { const s = (Date.now() - ts) / 1000; return s < 90 ? 'just now' : s < 5400 ? Math.round(s / 60) + ' min ago' : s < 129600 ? Math.round(s / 3600) + ' h ago' : Math.round(s / 86400) + ' days ago'; };

  A.studio.reg('games', '🎮 Game maker', body => {
    const root = document.createElement('div'); root.className = 'scroll pad gmk'; root.style.flex = '1'; body.appendChild(root);
    root.innerHTML = '<div class="gmk-hero"><div><div class="gmk-kicker">STUDIO</div><h2>🎮 Game maker</h2><div class="gmk-sub">Describe a game in plain words. The AI writes it and you play it right here. Each game runs sealed off: it cannot reach Moundshroud, your files or the internet.</div></div>' +
      '<label class="gmk-model">Made by <select id="gmm"></select></label></div>' +
      '<div class="gmk-grid"><div class="gmk-side">' +
      '<div class="gmk-card"><div class="gmk-h">New game</div><textarea id="gmp" rows="4" placeholder="e.g. A racing game where I dodge traffic on a three-lane road at night, with nitro on the space bar"></textarea>' +
      '<div class="gmk-ideas">' + IDEAS.map((x, i) => '<button class="gmk-idea" data-idea="' + i + '" title="' + esc(x[2]) + '">' + x[0] + ' ' + esc(x[1]) + '</button>').join('') + '</div>' +
      '<button class="gmk-go" id="gmnew">✨ Make this game</button><div class="gmk-note">One AI request per press, capped at about ' + Math.round(MAX_NEW * .75 / 100) * 100 + ' words of code.</div></div>' +
      '<div class="gmk-card" id="gmedit" hidden><div class="gmk-h">Change this game</div><textarea id="gmc" rows="3" placeholder="e.g. make the enemies faster, add a boss every 5 levels, use a sunset colour scheme"></textarea>' +
      '<div class="gmk-row"><button class="gmk-go" id="gmchg">🔁 Apply change</button><button class="gmk-btn" id="gmundo" title="Go back to the version before the last change (no AI request)">↶ Undo</button></div><div class="gmk-hist" id="gmhist"></div></div>' +
      '<div class="gmk-card"><div class="gmk-h">My games <span class="gmk-count" id="gmn"></span></div><div id="gmlist"></div></div>' +
      '</div><div class="gmk-main"><div class="gmk-bar"><input id="gmname" class="gmk-name" placeholder="Untitled game" spellcheck="false" disabled><span class="gmk-sp"></span>' +
      '<button class="gmk-btn" id="gmre" disabled>⟲ Restart</button><button class="gmk-btn" id="gmfs" disabled>⛶ Full screen</button><button class="gmk-btn" id="gmcode" disabled>&lt;/&gt; Code</button><button class="gmk-btn" id="gmport" disabled title="Add it to Games > Arcade">🎮 Arcade</button><button class="gmk-btn gmk-pri" id="gmsave" disabled>💾 Save</button></div>' +
      '<div class="gmk-stage" id="gmstage"><div class="gmk-empty"><div class="gmk-empty-i">🕹️</div><b>No game yet</b><div>Describe one on the left, tap an idea, or open a saved game.</div></div></div>' +
      '<div id="gmmsg"></div><div id="gmerr"></div><div id="gmlive" hidden><div class="gmk-codebar"><b>▶ The AI is writing this now</b><span class="gmk-note">live, as it types · the game you already have keeps playing</span></div><pre class="gmk-live" id="gmlivepre"></pre></div><div id="gmcodebox" hidden><div class="gmk-codebar"><b>&lt;/&gt; The game’s code</b><span class="gmk-note">Change anything, then ▶ Run my code (Ctrl+Enter). Ctrl+S saves. ↶ Undo goes back.</span><span class="gmk-sp"></span><button class="gmk-btn" id="gmrun">▶ Run my code</button></div><textarea class="gmk-src" id="gmsrc" data-code spellcheck="false" autocomplete="off" autocapitalize="off"></textarea></div></div></div>';
    const $ = id => root.querySelector('#' + id), msg = $('gmmsg');
    let cur = null, ctl = null, busy = false, frame = null;
    const say = (kind, html) => { msg.innerHTML = html ? '<div class="gmk-msg gmk-' + kind + '">' + html + '</div>' : ''; };
    /* the code arriving, live: the whole reply as it streams, so you can watch the game being written */
    let liveBuf = '', livePaint = 0, liveN = 0;
    const liveShow = on => { const l = $('gmlive'); if (!l) return; l.hidden = !on; if (on) { liveBuf = ''; liveN = 0; $('gmlivepre').textContent = ''; } };
    const liveAdd = t => {
      liveBuf += t; if (livePaint) return;
      livePaint = requestAnimationFrame(() => { livePaint = 0; const p = $('gmlivepre'); if (!p) return; p.textContent = liveBuf.slice(-12000); p.scrollTop = p.scrollHeight; });
    };

    /* models: the same list as the top bar, starting on the top bar's choice */
    (async () => { const sel = $('gmm'); try { const ms = ((await (await fetch('/api/models')).json()).models || []).filter(m => !/embed/i.test(m.name)); const top = A.ai.model(), saved = ls.get('gm_model', ''); const pick = ms.some(m => m.name === saved) ? saved : top; sel.innerHTML = ms.map(m => '<option value="' + esc(m.name) + '"' + (m.name === pick ? ' selected' : '') + '>' + esc(m.label || m.name) + (m.cloud ? ' (Claude, online)' : ' (on this PC)') + '</option>').join(''); } catch (e) { sel.innerHTML = '<option value="">Top bar model</option>'; } sel.onchange = () => ls.set('gm_model', sel.value); })();

    function play() {
      const st = $('gmstage'); st.innerHTML = ''; if (!cur) return;
      frame = document.createElement('iframe'); frame.setAttribute('sandbox', 'allow-scripts'); frame.title = cur.name || 'Game'; frame.className = 'gmk-frame';
      frame.srcdoc = seal(cur.html); frame.onload = () => { try { frame.focus(); } catch (e) { } }; st.appendChild(frame);
      $('gmsrc').value = cur.html; setTimeout(() => $('gmsrc').dispatchEvent(new Event('input')), 0);   // the code box grows to fit the new code
    }
    function show() {
      /* playing, restarting, full screen, the code and saving all keep working while the AI writes: the game never stops */
      const has = !!cur; ['gmre', 'gmfs', 'gmcode', 'gmsave', 'gmport', 'gmname'].forEach(id => $(id).disabled = !has); $('gmedit').hidden = !has;
      $('gmname').value = has ? cur.name || '' : ''; $('gmundo').disabled = !has || !(cur.prev && cur.prev.length) || busy;
      $('gmsave').textContent = has && cur.dirty === false ? '✓ Saved' : '💾 Save';
      $('gmhist').innerHTML = has && cur.asks && cur.asks.length ? '<div class="gmk-note">Asked so far</div>' + cur.asks.slice(-6).map(a => '<div class="gmk-ask">' + esc(a) + '</div>').join('') : '';
      $('gmnew').disabled = $('gmchg').disabled = busy; $('gmnew').textContent = busy ? '⏳ Writing… (you can keep playing)' : '✨ Make this game';
    }
    function drawList() {
      const l = list(); $('gmn').textContent = l.length ? l.length : '';
      $('gmlist').innerHTML = l.length ? l.map(g => '<div class="gmk-item' + (cur && cur.id === g.id ? ' gmk-on' : '') + '" data-id="' + g.id + '"><button class="gmk-open" data-open="' + g.id + '"><span class="gmk-iname">▶ ' + esc(g.name || 'Untitled game') + '</span><span class="gmk-meta">' + ago(g.ts) + ' · ' + (g.asks || []).length + ' request' + ((g.asks || []).length === 1 ? '' : 's') + '</span></button>' +
        '<button class="gmk-mini" data-ren="' + g.id + '" title="Rename">✎</button><button class="gmk-mini" data-del="' + g.id + '" title="Delete">🗑</button></div>').join('') : '<div class="gmk-note">Games you save appear here.</div>';
    }

    /* one bounded AI request; returns the full reply text or throws an Error with a plain message */
    async function ask(messages, cap, onLen) {
      const model = $('gmm').value || A.ai.model(); if (!model) throw new Error('No AI model is chosen. Pick one in the "Made by" list.');
      const cloud = A.ai.isCloud(model);
      let r; try { r = await fetch('/api/chat', { method: 'POST', signal: ctl.signal, body: JSON.stringify({ model, stream: true, think: false, keep_alive: '5m', options: Object.assign({ temperature: .5, num_predict: cap }, cloud ? {} : { num_ctx: ctxFor(messages.reduce((n, m) => n + m.content.length, 0), cap) }), messages }) }); }
      catch (e) { if (e.name === 'AbortError') throw e; throw new Error('Could not reach the AI engine: ' + e.message); }
      const rd = r.body.getReader(), dec = new TextDecoder(); let buf = '', all = '', err = '';
      for (; ;) { const { value, done } = await rd.read(); if (done) break; buf += dec.decode(value, { stream: true }); let i; while ((i = buf.indexOf('\n')) >= 0) { const ln = buf.slice(0, i).trim(); buf = buf.slice(i + 1); if (!ln) continue; try { const j = JSON.parse(ln); if (j.error) err = String(j.error.message || j.error);       if (j.message && j.message.content) { all += j.message.content; onLen(all.length, all); } } catch (e) { } } }
      if (buf.trim()) { try { const j = JSON.parse(buf); if (j.error) err = String(j.error.message || j.error); } catch (e) { if (!r.ok) err = buf.trim().slice(0, 300); } }
      if (err) throw new Error(err); if (!r.ok) throw new Error('The AI engine answered with error ' + r.status + '.'); if (!all.trim()) throw new Error('The AI sent back nothing. Check that the model is installed, or try another one.');
      return all;
    }
    async function run(kind, text) {
      if (busy) return; busy = true; ctl = new AbortController(); show(); const t0 = Date.now(), cap = kind === 'new' ? MAX_NEW : MAX_EDIT;
      /* the game keeps running while this works: nothing below touches the iframe until the new code is ready */
      const op = A.act ? A.act.begin(kind === 'new' ? 'Writing a game' : 'Fixing the game', { tab: 'studio', kind: 'game', go: () => A.studio.go('games'), phase: 'waiting for the AI' }) : null;
      $('gmerr').innerHTML = ''; liveShow(true);
      say('busy', '<span class="gmk-spin"></span><span id="gmprog">Asking the AI...</span><button class="gmk-btn" id="gmstop">■ Stop</button><div class="gmk-track"><div id="gmbar"></div></div>');
      $('gmstop').onclick = () => { try { ctl.abort(); } catch (e) { } };
      const wait = setInterval(() => { const p = $('gmprog'); if (!busy || !p) return clearInterval(wait); if (/^Asking|^Waiting/.test(p.textContent)) p.textContent = 'Waiting for the AI engine, ' + Math.round((Date.now() - t0) / 1000) + ' s. It may be loading the model, or busy with another job.'; }, 1000);
      let part = 1;
      const onLen = (n, txt) => {
        if (txt && txt.length > liveN) { liveAdd(txt.slice(liveN)); liveN = txt.length; }      // the code as it arrives
        const p = $('gmprog'), b = $('gmbar'), secs = Math.round((Date.now() - t0) / 1000), kb = Math.round(n / 1000 * 10) / 10;
        const line = 'Writing the game' + (part > 1 ? ' (part ' + part + ')' : '') + ': ' + kb + ' kB of code, ' + secs + ' s';
        if (p) p.textContent = line; if (b) b.style.width = Math.min(96, n / (cap * 3.4 * part) * 100) + '%';
        if (op) op.say('part ' + part + ' · ' + kb + ' kB · ' + secs + ' s');
      };
      const msgs = [{ role: 'system', content: SYS }];
      if (kind === 'new') msgs.push({ role: 'user', content: 'Make this game: ' + text });
      else msgs.push({ role: 'user', content: 'Here is my current game:\n```html\n' + cur.html + '\n```\n' + (cur.asks.length ? 'Earlier requests, already done: ' + cur.asks.slice(-5).join(' | ') + '\n' : '') + 'Change it like this: ' + text + '\n' +
        (/^fix this error/i.test(text) ? 'Fix the cause of that one error and nothing else. ' : '') + 'Change only what this needs: keep every other line exactly as it is, and do not rewrite, rename or reshuffle code that already works. Reply with the complete updated HTML file.' });
      try {
        /* a long game comes in parts: when a reply stops before </html>, the AI is asked to carry on from where it stopped */
        let reply = await ask(msgs, cap, onLen), out = extract(reply);
        for (let k = 2; out.cut && k <= MAX_PARTS; k++) {
          part = k; liveN = 0; const p = $('gmprog'); if (p) p.textContent = 'The game is long: writing part ' + k + '...'; if (op) op.say('the game is long: part ' + k);
          const nl = reply.lastIndexOf('\n'); if (nl > 0 && nl > reply.length - 600) reply = reply.slice(0, nl + 1);   // a reply cut mid-word ("*.0") got the word written again ("*.0.0006"): the next part starts on a fresh line
          const done = reply.length;
          reply = joinPart(reply, await ask(msgs.concat([{ role: 'assistant', content: reply }, { role: 'user', content: CONT }]), cap, (n, txt) => onLen(done + n, txt)));
          out = extract(reply);
        }
        if (out.err) throw new Error(out.err);
        const before = kind === 'new' ? '' : cur.html;
        if (kind === 'new') cur = { id: 'g' + Date.now().toString(36), name: titleOf(out.html) || text.slice(0, 40), html: out.html, asks: [text], prev: [], model: $('gmm').value, dirty: true };
        else { cur.prev = (cur.prev || []).concat([{ html: cur.html, asks: cur.asks.slice() }]).slice(-5); cur.html = out.html; cur.asks = cur.asks.concat([text]); cur.dirty = true; $('gmc').value = ''; }
        const secs = Math.round((Date.now() - t0) / 1000), st = before ? diffStat(before, out.html) : null;
        const changed = st ? ' · ' + (st.gone + st.add) + ' of ' + st.lines + ' lines changed (' + st.add + ' new, ' + st.gone + ' gone)' : '';
        say('ok', '✓ ' + (kind === 'new' ? 'Made' : 'Changed') + ' in ' + secs + ' s' + changed + '. Click the game to give it the keyboard. Save it to keep it.');
        if (op) op.end(true, secs + ' s' + changed);
        liveShow(false); play();
      } catch (e) {
        if (e.name === 'AbortError') say('warn', 'Stopped. Nothing was changed. The game you have is still there and still playing.');
        else say('err', '<b>The game could not be ' + (kind === 'new' ? 'made' : 'changed') + '.</b> ' + esc(e.message) + '<br><span class="gmk-note">Your game was not touched: it is still playing, and ↶ Undo still goes back.</span>');
        if (op) op.end(false, e.name === 'AbortError' ? 'stopped' : String(e.message || 'failed').slice(0, 60));
        liveShow(false);
      }
      busy = false; ctl = null; show();
    }
    function save() {
      if (!cur) return; if ($('gmsrc').value && $('gmsrc').value !== cur.html) { applyCode(); play(); }
      cur.name = $('gmname').value.trim() || cur.name || 'Untitled game';
      const l = list(), g = { id: cur.id, name: cur.name, html: cur.html, asks: cur.asks, model: cur.model, ts: Date.now() }, i = l.findIndex(x => x.id === cur.id);
      if (i >= 0) l.splice(i, 1); l.unshift(g);
      if (l.length > KEEP) return say('err', 'You have ' + KEEP + ' saved games, the most it keeps. Delete one first.');
      if (!store(l)) return say('err', '<b>Could not save.</b> The app storage on this PC is full. Delete an old game and try again.');
      cur.dirty = false; show(); drawList(); A.toast('Saved "' + cur.name + '"');
    }

    $('gmp').onkeydown = e => { if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) { e.preventDefault(); $('gmnew').click(); } };
    $('gmc').onkeydown = e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); $('gmchg').click(); } };
    root.querySelector('.gmk-ideas').onclick = e => { const b = e.target.closest('[data-idea]'); if (b) { $('gmp').value = IDEAS[+b.dataset.idea][2]; $('gmp').focus(); } };
    $('gmnew').onclick = () => { const v = $('gmp').value.trim(); if (!v) return say('warn', 'Describe the game first, or tap one of the ideas.'); if (cur && cur.dirty && cur.asks.length) A.toast('The unsaved game is replaced by the new one'); run('new', v); };
    $('gmchg').onclick = () => { const v = $('gmc').value.trim(); if (!v) return say('warn', 'Type the change you want first, for example "make the enemies faster".'); if (cur.html.length > MAX_SRC) return say('err', 'This game is too long to change in one request. Ask for a new, simpler game.'); run('edit', v); };
    $('gmundo').onclick = () => { if (!cur || !cur.prev || !cur.prev.length) return; const p = cur.prev.pop(); cur.html = p.html; cur.asks = p.asks; cur.dirty = true; play(); show(); say('ok', '↶ Back to the version before the last change.'); };
    $('gmre').onclick = () => { play(); say('', ''); };
    $('gmfs').onclick = () => { const s = $('gmstage'); (s.requestFullscreen ? s.requestFullscreen() : Promise.reject()).then(() => frame && frame.focus()).catch(() => A.toast('Full screen is not available here')); };
    /* the code box is as tall as the code, so every line shows at once with no dragging */
    const fitCode = () => { const t = $('gmsrc'); if (!t || $('gmcodebox').hidden) return; t.style.height = 'auto'; t.style.height = (t.scrollHeight + 20) + 'px'; };
    $('gmsrc').addEventListener('input', fitCode);
    $('gmcode').onclick = () => { const s = $('gmcodebox'); s.hidden = !s.hidden; $('gmcode').classList.toggle('gmk-on', !s.hidden); if (!s.hidden) { fitCode(); setTimeout(fitCode, 50); $('gmsrc').focus({ preventScroll: true }); s.scrollIntoView({ block: 'start', behavior: 'smooth' }); } };
    /* your own changes to the code: kept like an AI change (↶ Undo goes back), played at once */
    function applyCode() {
      if (!cur) return false; const v = $('gmsrc').value; if (v === cur.html) return false;
      if (!v.trim()) { say('warn', 'The code is empty. ↶ Undo brings the last version back.'); return false; }
      cur.prev = (cur.prev || []).concat([{ html: cur.html, asks: cur.asks.slice() }]).slice(-20); cur.html = v; cur.dirty = true; return true;
    }
    $('gmrun').onclick = () => { if (!cur) return; const changed = applyCode(); play(); show(); say('ok', changed ? '▶ Running your version. Click the game to give it the keyboard. 💾 Save keeps it.' : '▶ Restarted. The code has not changed.'); };
    $('gmsrc').addEventListener('keydown', e => { if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') { e.preventDefault(); $('gmrun').click(); } else if ((e.ctrlKey || e.metaKey) && (e.key === 's' || e.key === 'S')) { e.preventDefault(); if (applyCode()) play(); save(); } });
    $('gmsave').onclick = save;
    /* port it to the Arcade: the game already runs sealed in an iframe, so the Arcade plays the very same HTML */
    $('gmport').onclick = () => { if (!cur) return; const nm = cur.name || 'Untitled game'; const id = A.arcade && A.arcade.add({ kind: 'html', name: nm, html: cur.html, from: 'gamemaker' }); if (id) say('ok', '✓ <b>' + esc(nm) + '</b> is in the Arcade. Open <b>Games › Arcade</b>; it sits under <b>Action &amp; arcade</b>. Save the game here first if you want to keep editing it.'); else say('warn', 'The game could not be added to the Arcade.'); };
    $('gmname').onchange = () => { if (cur) { cur.name = $('gmname').value.trim() || cur.name; cur.dirty = true; show(); } };
    $('gmname').onkeydown = e => { if (e.key === 'Enter') { e.preventDefault(); save(); } };
    $('gmlist').onclick = e => {
      const o = e.target.closest('[data-open]'), rn = e.target.closest('[data-ren]'), dl = e.target.closest('[data-del]');
      if (o) { if (busy) return; const g = list().find(x => x.id === o.dataset.open); if (!g) return; cur = { id: g.id, name: g.name, html: g.html, asks: (g.asks || []).slice(), prev: [], model: g.model, dirty: false }; say('', ''); play(); show(); drawList(); return; }
      if (rn) { const row = rn.closest('.gmk-item'), l = list(), g = l.find(x => x.id === rn.dataset.ren); if (!g) return; row.innerHTML = '<input class="gmk-rename" value="' + esc(g.name) + '" maxlength="60"><button class="gmk-mini" data-ok="1">✓</button>'; const inp = row.querySelector('input'); inp.focus(); inp.select();
        const done = keep => { if (done.d) return; done.d = 1; const v = inp.value.trim(); if (keep && v) { g.name = v; store(l); if (cur && cur.id === g.id) { cur.name = v; show(); } } drawList(); };
        inp.onkeydown = ev => { if (ev.key === 'Enter') done(true); else if (ev.key === 'Escape') done(false); }; inp.onblur = () => done(true); return; }
      if (dl) { if (dl.dataset.sure !== '1') { dl.dataset.sure = '1'; dl.textContent = 'Delete?'; dl.classList.add('gmk-danger'); dl.title = 'Click again to delete'; return; }
        const l = list().filter(x => x.id !== dl.dataset.del); store(l); if (cur && cur.id === dl.dataset.del) cur.dirty = true; drawList(); show(); A.toast('Game deleted'); }
    };
    /* errors thrown inside the game: shown under it with a one-request fix */
    const onMsg = e => { if (!frame || e.source !== frame.contentWindow || !e.data || !e.data.gmErr || busy) return; const m = String(e.data.gmErr);
      say('err', '<b>The game hit an error:</b> ' + esc(m) + ' <button class="gmk-btn" id="gmfix">🔧 Ask the AI to fix it</button>'); $('gmfix').onclick = () => run('edit', 'Fix this error that appears when the game runs: ' + m); };
    window.addEventListener('message', onMsg);
    body._cleanup = () => { try { ctl && ctl.abort(); } catch (e) { } window.removeEventListener('message', onMsg); };
    drawList(); show();
  });
})();

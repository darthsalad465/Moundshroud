// Studio > Game Studio (the Godot engine). Describe a game in plain words; the chosen local AI writes a whole Godot 4 project
// (project.godot, a main scene and GDScript) into a folder on this PC, and Moundshroud opens it in the Godot editor or plays it.
// The project is real files on the disk (Documents\Moundshroud Godot\<game>), so it can be edited, exported and shared like any
// other Godot game, and Send to Arcade exports it for the web so it can be played in Games > Arcade.
(() => {
  if (!A.studio) return; const esc = A.studio.esc;
  const IDEAS = [['🌲', 'Dark woods', 'A first-person style horror walk: a torch-lit path through dark woods, faint sounds, and something that follows me'], ['🏃', 'Platformer', 'A 2D platformer: run and jump with the arrow keys, collect coins, avoid spikes, reach the flag'], ['🚀', 'Space shooter', 'A top-down space shooter: move with WASD, shoot with space, waves of enemies that get faster'], ['🗡️', 'Top-down adventure', 'A top-down adventure: walk with WASD, a small map with trees and a cabin, and an enemy that chases me'], ['🐍', 'Snake', 'Snake on a grid: arrows to move, eat food to grow, hitting a wall ends the game'], ['🃏', 'Card memory', 'A memory card game with 16 cards, a move counter and a win screen']];
  const KEEP_CHARS = 40000;
  const SYS = 'You write complete Godot 4.7 game projects. Reply with the project only, in this exact format, one block per file:\n' +
    '=== FILE: project.godot ===\n<contents>\n=== FILE: main.tscn ===\n<contents>\n=== FILE: player.gd ===\n<contents>\n=== END ===\n' +
    'Rules that matter:\n' +
    '- Use GDScript 4 syntax only: func _ready():, @onready var, @export, signal, await, Vector2, KEY_A, Input.is_key_pressed(KEY_A). Never use Godot 3 syntax (no "extends KinematicBody2D", no "instance()", no "OS.get_ticks").\n' +
    '- project.godot must start with config_version=5 and contain:\n[application]\nconfig/name="Name"\nrun/main_scene="res://main.tscn"\nconfig/features=PackedStringArray("4.7", "GL Compatibility")\n[rendering]\nrenderer/rendering_method="gl_compatibility"\nrenderer/rendering_method.mobile="gl_compatibility"\n' +
    '- main.tscn must be a text scene that opens with [gd_scene load_steps=N format=3 uid="uid://..."] and attach the main script with [ext_resource type="Script" path="res://main.gd" id="1"] and script = ExtResource("1"). Keep node paths and node names exact.\n' +
    '- Make a 2D game unless the idea is clearly 3D. Use only built-in drawing: ColorRect, Color, Label, Polygon2D, and _draw() with draw_circle/draw_rect/draw_line/draw_string. No image, font, sound or model files, no external assets, no downloads.\n' +
    '- Read the keyboard with Input.is_key_pressed() and mouse with get_global_mouse_position(): do not rely on input actions that may not exist in project.godot.\n' +
    '- Use a Camera2D or a fixed background so the game fills the window at any size; set the viewport size in [display] window/size/viewport_width=1152 and viewport_height=648.\n' +
    '- A start screen, a score, a game over screen and restart with the R key. Keep it small: at most 4 files and about 400 lines of GDScript in total.\n' +
    '- Every file must be complete and syntactically valid. No placeholders, no "...", no explanation before or after the blocks.';

  /* a change or a fix edits the files the AI already wrote: it is asked for the smallest edit it can, not for the project again */
  const PATCH_SYS = 'You are debugging an existing Godot 4 project. Its files are in the message. Do NOT rewrite the project and do NOT repeat whole files.\n' +
    'Reply with JSON only, in exactly this shape: {"edits":[{"file":"player.gd","find":"a short exact copy of the code that is wrong","replace":"the corrected code"}]}\n' +
    'Rules:\n- "file" must be one of the project files listed, written exactly as listed.\n- "find" must be copied character for character from that file, indentation included, and must appear once only.\n' +
    '- Keep each find to the few lines that have to change.\n- Change the least that fixes the problem and nothing else.\n' +
    '- If nothing needs changing, reply {"edits":[]}.\n- No explanation, no markdown, no code fences.';

  // styles are prefixed god- so nothing in the app can override them
  if (!document.getElementById('god-css')) {
    const st = document.createElement('style'); st.id = 'god-css'; st.textContent = `
.god{--g1:var(--acc,#7c5cff);--g2:var(--acc2,#22d3ee)}
.god-hero{display:flex;align-items:flex-end;gap:16px;flex-wrap:wrap;padding:18px 20px;margin-bottom:14px;border-radius:16px;border:1px solid var(--line);background:radial-gradient(120% 140% at 0% 0%,color-mix(in srgb,var(--g1) 26%,transparent),transparent 60%),radial-gradient(120% 140% at 100% 100%,color-mix(in srgb,var(--g2) 18%,transparent),transparent 55%),var(--panel)}
.god-hero h2{margin:2px 0 4px;font-size:26px;letter-spacing:-.01em}.god-hero>div:first-child{flex:1;min-width:260px}
.god-kicker{font-size:11px;letter-spacing:.18em;font-weight:700;color:var(--g1)}.god-sub{color:var(--mute);font-size:13px;max-width:660px;line-height:1.5}
.god-model{font-size:12px;color:var(--mute);display:flex;flex-direction:column;gap:4px}.god-model select{min-width:220px}
.god-grid{display:grid;grid-template-columns:minmax(260px,340px) 1fr;gap:14px;align-items:start}@media(max-width:900px){.god-grid{grid-template-columns:1fr}}
.god-side{display:flex;flex-direction:column;gap:12px}
.god-card{border:1px solid var(--line);border-radius:14px;background:var(--panel);padding:14px}
.god-h{font-weight:700;margin-bottom:8px;display:flex;align-items:center;gap:8px}.god-count{font-size:11px;font-weight:600;padding:1px 8px;border-radius:99px;background:var(--panel2);color:var(--mute)}
.god textarea{width:100%;box-sizing:border-box;line-height:1.5;resize:vertical}
.god-ideas{display:flex;flex-wrap:wrap;gap:6px;margin:8px 0 10px}
.god-idea{font-size:12px;padding:4px 10px;border-radius:99px;border:1px solid var(--line);background:var(--panel2);color:var(--text);cursor:pointer}.god-idea:hover{border-color:var(--g1)}
.god-go{width:100%;padding:10px 14px;border:0;border-radius:10px;font-weight:700;font-size:14px;color:#fff;cursor:pointer;background:linear-gradient(135deg,var(--g1),var(--g2));box-shadow:0 6px 20px -8px var(--g1)}.god-go:hover{filter:brightness(1.08)}.god-go:disabled{opacity:.55;cursor:default;filter:none}
.god-row{display:flex;gap:8px;margin-top:8px}.god-row .god-go{flex:1}
.god-btn{padding:6px 12px;border-radius:9px;border:1px solid var(--line);background:var(--panel2);color:var(--text);cursor:pointer;font-size:13px;white-space:nowrap}.god-btn:hover:not(:disabled){border-color:var(--g1)}.god-btn:disabled{opacity:.45;cursor:default}.god-btn.god-pri{background:var(--g1);border-color:var(--g1);color:#fff;font-weight:600}
.god-note{font-size:11.5px;color:var(--mute);margin-top:6px}
.god-warnbox{border:1px solid color-mix(in srgb,var(--warn,#f5a524) 60%,var(--line));background:color-mix(in srgb,var(--warn,#f5a524) 10%,var(--panel));border-radius:12px;padding:12px;font-size:13px;line-height:1.55;margin-bottom:12px}
.god-cmd{display:flex;gap:8px;align-items:center;margin-top:8px}.god-cmd code{flex:1;font-size:12px;padding:8px 10px;border-radius:8px;background:var(--panel2);border:1px solid var(--line);overflow:auto;white-space:nowrap}
.god-item{display:flex;align-items:center;gap:4px;border:1px solid var(--line);border-radius:10px;margin-top:6px;padding:2px;background:var(--panel2)}.god-item.god-on{border-color:var(--g1);box-shadow:0 0 0 1px var(--g1) inset}
.god-open{flex:1;min-width:0;text-align:left;background:none;border:0;color:var(--text);cursor:pointer;padding:6px 8px;display:flex;flex-direction:column;gap:2px}
.god-iname{font-weight:600;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.god-meta{font-size:11px;color:var(--mute)}
.god-mini{background:none;border:0;color:var(--mute);cursor:pointer;padding:6px;border-radius:7px;font-size:13px}.god-mini:hover{background:var(--panel);color:var(--text)}.god-mini.god-danger{color:#fff;background:var(--bad,#e5484d);font-weight:600}
.god-bar{display:flex;align-items:center;gap:6px;flex-wrap:wrap;margin-bottom:8px}.god-sp{flex:1}
.god-name{font-size:17px;font-weight:700;background:transparent;border:1px solid transparent;border-radius:8px;padding:5px 8px;color:var(--text);min-width:170px;max-width:320px}
.god-main{min-width:0}
.god-player{margin:0 0 10px;border:1px solid var(--line);border-radius:12px;overflow:hidden;background:#000;display:flex;flex-direction:column}
.god-phead{display:flex;gap:8px;align-items:center;flex-wrap:wrap;padding:6px 10px;background:var(--panel2)}
.god-player iframe{display:block;width:100%;aspect-ratio:16/9;max-height:62vh;border:0;background:#000}
.god-player.fs{position:fixed;inset:0;z-index:2147483000;margin:0;border:0;border-radius:0}
.god-player.fs iframe{flex:1;max-height:none;aspect-ratio:auto}
html.god-filled body{overflow:hidden}html.god-filled body>*:not(main){visibility:hidden!important}
.god-split{display:grid;grid-template-columns:minmax(140px,220px) 1fr;gap:10px;align-items:start}@media(max-width:760px){.god-split{grid-template-columns:1fr}}
.god-tree{border:1px solid var(--line);border-radius:10px;background:var(--panel2);padding:6px;max-height:420px;overflow:auto;font-size:12.5px}
.god-file{display:block;width:100%;text-align:left;background:none;border:0;color:var(--text);cursor:pointer;padding:4px 6px;border-radius:6px;font-size:12.5px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.god-file:hover{background:var(--panel)}.god-file.god-on{background:color-mix(in srgb,var(--g1) 22%,transparent);color:var(--text)}
.god-dir{font-size:11px;letter-spacing:.06em;color:var(--mute);padding:4px 6px 2px;font-weight:700}
.god-code{margin:0;font-size:12px;line-height:1.5;padding:12px;border-radius:10px;border:1px solid var(--line);background:#0b0b12;color:#d8dae8;max-height:420px;overflow:auto;white-space:pre;tab-size:2}
.god-edwrap{min-width:0;display:flex;flex-direction:column;gap:6px}.god-edbar{display:flex;align-items:center;gap:6px;flex-wrap:wrap}.god-ed{display:block;width:100%;box-sizing:border-box;min-height:420px;resize:vertical;font:12px/1.5 Consolas,"Cascadia Mono",monospace;padding:12px;border-radius:0 10px 10px 0;border:1px solid var(--line);background:#0b0b12;color:#d8dae8;tab-size:4}
.god-msg{margin-top:10px;padding:10px 14px;border-radius:10px;font-size:13px;line-height:1.5;border:1px solid var(--line);background:var(--panel);display:flex;align-items:center;gap:10px;flex-wrap:wrap}
.god-ok{border-color:color-mix(in srgb,var(--ok,#30a46c) 55%,var(--line))}.god-warn{border-color:color-mix(in srgb,var(--warn,#f5a524) 60%,var(--line))}.god-err{border-color:var(--bad,#e5484d);background:color-mix(in srgb,var(--bad,#e5484d) 10%,var(--panel))}
.god-spin{width:14px;height:14px;border-radius:50%;border:2px solid var(--line);border-top-color:var(--g1);animation:godspin .8s linear infinite}@keyframes godspin{to{transform:rotate(360deg)}}
.god-track{flex-basis:100%;height:4px;border-radius:4px;background:var(--panel2);overflow:hidden}.god-track>div{height:100%;width:2%;background:linear-gradient(90deg,var(--g1),var(--g2));transition:width .3s}
`; document.head.appendChild(st);
  }
  const ago = ts => { const s = (Date.now() - ts) / 1000; return s < 90 ? 'just now' : s < 5400 ? Math.round(s / 60) + ' min ago' : s < 129600 ? Math.round(s / 3600) + ' h ago' : Math.round(s / 86400) + ' days ago'; };
  const INSTALL = 'powershell -ExecutionPolicy Bypass -File install-godot.ps1';
  /* the reply as a list of files: === FILE: path === blocks, in the order the AI wrote them */
  function extract(text) {
    const t = String(text || '').replace(/\r\n/g, '\n');
    const re = /^===\s*FILE:\s*(.+?)\s*===\s*$/gim, marks = [];
    let m; while ((m = re.exec(t))) marks.push({ name: m[1].replace(/^res:\/\//i, ''), start: m.index + m[0].length, head: m.index });
    if (!marks.length) return { err: 'The AI did not answer in the file format. Try again, or pick a stronger model.' };
    const files = [];
    marks.forEach((k, i) => {
      const end = i + 1 < marks.length ? marks[i + 1].head : t.length;
      let body = t.slice(k.start, end);
      const fence = /^\s*```[a-z]*\n([\s\S]*?)\n?```\s*$/i.exec(body); if (fence) body = fence[1];
      body = body.replace(/^```[a-z]*\n/i, '').replace(/\n```\s*$/i, '');
      body = body.split(/^===\s*END\s*===\s*$/im)[0].replace(/\s+$/, '') + '\n';
      if (!k.name || /^end$/i.test(k.name)) return;
      files.push({ path: k.name.replace(/\\/g, '/'), content: body });
    });
    if (!files.length) return { err: 'The AI answered without any project files. Try again.' };
    if (!files.some(f => /project\.godot$/i.test(f.path))) return { err: 'The project came back without project.godot, so Godot could not open it. Try again.' };
    return { files };
  }
  const nameOf = files => { const p = files.find(f => /project\.godot$/i.test(f.path)); const m = p && /config\/name\s*=\s*"([^"]{1,60})"/.exec(p.content); return m ? m[1].trim() : ''; };

  A.studio.reg('godot', '🎮 Game Studio', body => {
    const root = document.createElement('div'); root.className = 'scroll pad god'; root.style.flex = '1'; body.appendChild(root);
    root.innerHTML = '<div class="god-hero"><div><div class="god-kicker">STUDIO</div><h2>🎮 Game Studio</h2><div class="god-sub">Describe a game and the AI writes a real Godot 4 project on this PC: project files, scenes and GDScript. Play it right here, open it in the Godot editor (inside this window), or send it to the Arcade to play on the Games page. Your projects live in Documents&#92;Moundshroud Godot.</div></div>' +
      '<label class="god-model">Made by <select id="gdm"></select></label></div>' +
      '<div id="gdbanner"></div>' +
      '<div class="god-grid"><div class="god-side">' +
      '<div class="god-card"><div class="god-h">New game</div><textarea id="gdp" rows="4" placeholder="e.g. A top-down horror walk through dark woods with a torch, a cabin to find, and something that follows me"></textarea>' +
      '<div class="god-ideas">' + IDEAS.map((x, i) => '<button class="god-idea" data-idea="' + i + '" title="' + esc(x[2]) + '">' + x[0] + ' ' + esc(x[1]) + '</button>').join('') + '</div>' +
      '<button class="god-go" id="gdnew">✨ Write this game</button><div class="god-note">One AI request per press. The whole project is written at once, so a weaker model may stop early; a bigger one makes better games.</div></div>' +
      '<div class="god-card" id="gdedit" hidden><div class="god-h">Change this game</div><textarea id="gdc" rows="3" placeholder="e.g. make the enemy faster, add a health bar, make it night time with rain"></textarea>' +
      '<div class="god-row"><button class="god-go" id="gdchg">🔁 Ask for the change</button></div><div class="god-note" id="gdhint"></div></div>' +
      '<div class="god-card"><div class="god-h">My Godot games <span class="god-count" id="gdn"></span></div><div id="gdlist"></div></div>' +
      '</div><div class="god-main"><div class="god-bar"><input id="gdname" class="god-name" placeholder="Untitled game" spellcheck="false" disabled><span class="god-sp"></span>' +
      '<button class="god-btn" id="gdplay" disabled>▶ Play</button><button class="god-btn god-pri" id="gdopen" disabled>🛠 Open in Godot</button><button class="god-btn" id="gdport" disabled title="Export it for the web and add it to Games > Arcade">🎮 Send to Arcade</button><button class="god-btn" id="gddel" disabled>🗑</button></div>' +
      '<div id="gdgame"></div><div class="god-split"><div class="god-tree" id="gdtree"><div class="god-note">Files of the game appear here.</div></div><div class="god-edwrap"><div class="god-edbar"><b id="gdfname" class="god-note">Pick a file to read or change it.</b><span class="god-sp"></span><button class="god-btn" id="gdfsave" disabled title="Write every changed file back to the game’s folder (Ctrl+S)">💾 Save file</button><button class="god-btn" id="gdfundo" disabled title="Throw away the changes since the file was opened">↶ Undo changes</button></div><div class="ce-tabs" id="gdtabs"></div><textarea class="god-ed" id="gdcode" data-code data-save="gdfsave" spellcheck="false" autocomplete="off" autocapitalize="off" readonly placeholder="Pick a file on the left."></textarea></div></div>' +
      '<div id="gdmsg"></div></div></div>';
    const $ = id => root.querySelector('#' + id), msg = $('gdmsg');
    let cur = null, busy = false, ctl = null, engine = null, home = '';
    const say = (kind, html) => { msg.innerHTML = html ? '<div class="god-msg god-' + kind + '">' + html + '</div>' : ''; };

    /* models: the same list as Studio > Game maker */
          (async () => { const sel = $('gdm'); try { const ms = ((await (await fetch('/api/models')).json()).models || []).filter(m => !/embed/i.test(m.name)); MODELS = ms; const top = A.ai.model(), saved = ls.get('gd_model', ''); const pick = ms.some(m => m.name === saved) ? saved : top; sel.innerHTML = ms.map(m => '<option value="' + esc(m.name) + '"' + (m.name === pick ? ' selected' : '') + '>' + esc(m.label || m.name) + (m.cloud ? ' (online)' : ' (on this PC)') + '</option>').join(''); } catch (e) { sel.innerHTML = '<option value="">Top bar model</option>'; } sel.onchange = () => ls.set('gd_model', sel.value); })();

    function banner() {
      $('gdbanner').innerHTML = engine ? '' : '<div class="god-warnbox"><b>Godot is not installed on this PC yet.</b> The AI can still write the project, and it is saved as real files, but nothing can play or open it until the engine is here. Run this once (about 82 MB, then it is offline for good):<div class="god-cmd"><code>' + esc(INSTALL) + '</code><button class="god-btn" id="gdcopy">Copy</button><button class="god-btn" id="gdcheck">I ran it</button></div></div>';
      const c = $('gdcopy'), k = $('gdcheck');
      if (c) c.onclick = () => { A.copy(INSTALL); };
      if (k) k.onclick = () => load(true);
    }
    async function load(refresh) {
      try {
        const j = await (await fetch('/api/godot/projects')).json();
        engine = j.engine || null; home = j.home || '';
        const l = j.projects || []; $('gdn').textContent = l.length ? l.length : '';
        $('gdlist').innerHTML = l.length ? l.map(g => '<div class="god-item' + (cur && cur.name === g.name ? ' god-on' : '') + '" data-name="' + esc(g.name) + '"><button class="god-open" data-open="' + esc(g.name) + '"><span class="god-iname">▶ ' + esc(g.name) + '</span><span class="god-meta">' + ago(g.ts) + ' · ' + g.files + ' file' + (g.files === 1 ? '' : 's') + '</span></button><button class="god-mini" data-del="' + esc(g.name) + '" title="Delete">🗑</button></div>').join('') : '<div class="god-note">Games the AI writes appear here.</div>';
        banner();
      } catch (e) { banner(); }
      if (refresh && engine) A.toast('Godot found: ' + (engine.version || engine.path));
    }
    function show() {
      const has = !!cur; ['gdname', 'gdplay', 'gdopen', 'gddel', 'gdport'].forEach(id => $(id).disabled = !has || busy || !engine);
      $('gdedit').hidden = !has; $('gdname').value = has ? cur.name : '';
      $('gdhint').textContent = has ? (home ? 'Saved in ' + home + '\\' + cur.name : '') : '';
      $('gdnew').disabled = $('gdchg').disabled = busy;
      $('gdnew').textContent = busy ? '⏳ Writing the project...' : '✨ Write this game';
      if (has) { $('gdplay').title = engine ? 'Play the game here, inside Moundshroud' : 'Godot is not installed yet'; $('gdopen').title = engine ? 'Open the Godot editor inside this window' : 'Godot is not installed yet'; }
    }
    function drawTree(files) {
      const depthOf = p => p.split('/').length - 1;
      $('gdtree').innerHTML = files.length ? files.map(f => f.dir ? '<div class="god-dir" style="padding-left:' + (6 + depthOf(f.path) * 10) + 'px">📁 ' + esc(f.path.split('/').pop()) + '</div>' : '<button class="god-file" data-file="' + esc(f.path) + '" style="padding-left:' + (8 + depthOf(f.path) * 10) + 'px">' + esc(f.path.split('/').pop()) + '</button>').join('') : '<div class="god-note">No files yet.</div>';
    }
    async function openProject(name) {
      if (busy) return;
      try {
        const j = await (await fetch('/api/godot/tree?name=' + encodeURIComponent(name))).json();
        if (!j.ok) return say('err', '<b>Could not open it.</b> ' + esc(j.error || ''));
        cur = { name: j.name || name, files: j.files }; say('', ''); drawTree(j.files); show();
        ftabs = []; fpath = null; $('gdcode').value = ''; $('gdcode').readOnly = true; fileBar();
        const first = (j.files || []).find(f => /project\.godot$/i.test(f.path)) || (j.files || []).find(f => !f.dir);
        if (first) readFile(first.path);
        load(false);
      } catch (e) { say('err', 'Could not open it: ' + esc(e.message)); }
    }
    /* the open files, one tab each (like VS Code): you can change them and 💾 Save writes every changed file back at once.
       Only the text files a Godot project is made of can be edited; the binary ones open read-only. */
    let ftabs = [], fpath = null;              // [{ path, text, orig, dirty, readOnly, scroll }]
    const EDITABLE = /\.(godot|gd|tscn|tres|cfg|json|txt|md|gdshader|csv|svg|import)$/i;
    const fTab = p => ftabs.find(t => t.path === p) || null;
    const anyDirty = () => ftabs.filter(t => t.dirty).length;
    const fbar = window.CodeEd ? CodeEd.tabbar($('gdtabs'), { onselect: p => activateFile(p), onclose: p => closeFile(p) }) : null;
    const ficon = p => /\.gd$/.test(p) ? '🧩' : /\.tscn$/.test(p) ? '🎬' : /project\.godot$/.test(p) ? '⚙' : /\.json$/.test(p) ? '{}' : '📄';
    function fileBar() {
      const t = fTab(fpath), ta = $('gdcode'), n = anyDirty();
      if (fbar) fbar.render(ftabs.map(x => ({ id: x.path, name: x.path.split('/').pop(), dirty: x.dirty, title: x.path, icon: ficon(x.path) })), fpath);
      $('gdfsave').disabled = !n;
      $('gdfsave').textContent = n > 1 ? '💾 Save ' + n + ' files' : '💾 Save file';
      $('gdfundo').disabled = !(t && t.dirty);
      $('gdfname').textContent = t ? t.path + (t.dirty ? ' • changed' : '') + (ta.readOnly ? ' (read only)' : '') : 'Pick a file to read or change it.';
      root.querySelectorAll('.god-file').forEach(b => b.classList.toggle('god-on', b.dataset.file === fpath));
    }
    function activateFile(p) {
      const t = fTab(p); if (!t) return;
      const ta = $('gdcode'), was = fTab(fpath);
      if (was) was.scroll = ta.scrollTop;
      fpath = p; ta.value = t.text; ta.readOnly = t.readOnly; ta.scrollTop = t.scroll || 0; ta.setSelectionRange(0, 0);
      const e = window.CodeEd && CodeEd.of(ta); if (e) { e.setName(p); e.refresh(); }
      fileBar();
    }
    function closeFile(p) {
      const i = ftabs.findIndex(t => t.path === p); if (i < 0) return;
      if (ftabs[i].dirty && !confirm('“' + p + '” has unsaved changes. Close it and lose them?')) return;
      ftabs.splice(i, 1);
      if (fpath !== p) return fileBar();
      const next = ftabs[i] || ftabs[i - 1] || null; fpath = null;
      if (next) return activateFile(next.path);
      const ta = $('gdcode'); ta.value = ''; ta.readOnly = true; const e = window.CodeEd && CodeEd.of(ta); if (e) { e.setName(''); e.refresh(); }
      fileBar();
    }
    async function readFile(path) {
      if (!cur) return;
      if (fTab(path)) return activateFile(path);
      const ta = $('gdcode');
      try {
        const j = await (await fetch('/api/godot/file?name=' + encodeURIComponent(cur.name) + '&file=' + encodeURIComponent(path))).json();
        if (!j.ok) { ta.value = 'Could not read ' + path + ': ' + (j.error || ''); ta.readOnly = true; fileBar(); return; }
        ftabs.push({ path, text: j.text, orig: j.text, dirty: false, readOnly: !EDITABLE.test(path), scroll: 0 });
        activateFile(path);
      } catch (e) { ta.value = 'Could not read that file: ' + e.message; ta.readOnly = true; fileBar(); }
    }
    async function saveFile() {
      if (!cur) return;
      const dirty = ftabs.filter(t => t.dirty && !t.readOnly);
      if (!dirty.length) return;
      try {
        const r = await (await fetch('/api/godot/save', { method: 'POST', body: JSON.stringify({ name: cur.name, files: dirty.map(t => ({ path: t.path, content: t.text })) }) })).json();
        if (!r.ok) return say('err', esc(r.error || 'Could not save the file.'));
        dirty.forEach(t => { t.orig = t.text; t.dirty = false; });
        fileBar();
        say('ok', '✓ Saved ' + dirty.length + ' file' + (dirty.length === 1 ? ' (' + esc(dirty[0].path) + ')' : 's') + '. ▶ Play or Open in Godot to see them.');
      } catch (e) { say('err', 'Could not save: ' + esc(e.message)); }
    }
    $('gdcode').addEventListener('input', () => {
      const t = fTab(fpath); if (t && !t.readOnly) { t.text = $('gdcode').value; t.dirty = t.text !== t.orig; }
      fileBar();
    });
    $('gdfsave').onclick = saveFile;
    $('gdfundo').onclick = () => { const t = fTab(fpath); if (!t) return; t.text = t.orig; t.dirty = false; $('gdcode').value = t.text; const e = window.CodeEd && CodeEd.of($('gdcode')); if (e) e.refresh(); fileBar(); };
    $('gdcode').addEventListener('keydown', e => { if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'w' && fpath) { e.preventDefault(); closeFile(fpath); } });
    /* the same bounded request Studio > Game maker makes, through the local engine */
    let MODELS = [];
    /* the free/online models are the ones the bigger budget is for; a model on this PC keeps the budget it had, so its
       context stays small enough to load (a 40k context on a small model can leave it loading instead of answering) */
    const isOnline = m => { const x = MODELS.find(o => o.name === m); return x ? !!x.cloud : !!(A.ai && A.ai.isCloud(m)); };
    async function ask(messages, cap, onLen) {
      const model = $('gdm').value || A.ai.model(); if (!model) throw new Error('No AI model is chosen. Pick one in the "Made by" list.');
      const cloud = isOnline(model), budget = cloud ? cap : Math.min(cap, 9000);
      let r; try { r = await fetch('/api/chat', { method: 'POST', signal: ctl.signal, body: JSON.stringify({ model, stream: true, think: false, keep_alive: '5m', options: Object.assign({ temperature: .35, num_predict: budget }, cloud ? {} : { num_ctx: Math.min(131072, Math.max(16384, Math.ceil((messages.reduce((n, m) => n + m.content.length, 0) / 3 + budget + 1024) / 8192) * 8192)) }), messages }) }); }
      catch (e) { if (e.name === 'AbortError') throw e; throw new Error('Could not reach the AI engine: ' + e.message); }
      const rd = r.body.getReader(), dec = new TextDecoder(); let buf = '', all = '', err = '';
      for (; ;) { const { value, done } = await rd.read(); if (done) break; buf += dec.decode(value, { stream: true }); let i; while ((i = buf.indexOf('\n')) >= 0) { const ln = buf.slice(0, i).trim(); buf = buf.slice(i + 1); if (!ln) continue; try { const j = JSON.parse(ln); if (j.error) err = String(j.error.message || j.error); if (j.message && j.message.content) { all += j.message.content; onLen(all.length); } } catch (e) { } } }
      if (err) throw new Error(err); if (!r.ok) throw new Error('The AI engine answered with error ' + r.status + '.'); if (!all.trim()) throw new Error('The AI sent back nothing. Check that the model is installed, or try another one.');
      return all;
    }
    /* the smallest change: find/replace edits against the project files, saved only for the files that really changed */
    async function patchFix(text, files, t0) {
      const body = Object.keys(files).map(p => '=== FILE: ' + p + ' ===\n' + files[p]).join('\n');
      const msgs = [{ role: 'system', content: PATCH_SYS }, { role: 'user', content: 'The project:\n' + body + '\n\n' + (/^fix/i.test(text) ? text : 'Change it like this: ' + text) + '\n\nReply with the JSON edits only.' }];
      const reply = await ask(msgs, 1200, n => { const p = $('gdprog'), b = $('gdbar'); if (p) p.textContent = 'Finding the smallest fix: ' + Math.round(n / 1000 * 10) / 10 + ' kB, ' + Math.round((Date.now() - t0) / 1000) + ' s'; if (b) b.style.width = Math.min(60, n / 1200 * 100) + '%'; });
      const edits = A.patch.parse(reply); if (!edits) return false;
      const res = A.patch.applyFiles(files, edits); if (!res.changed.length) return false;
      const j = await (await fetch('/api/godot/save', { method: 'POST', body: JSON.stringify({ name: cur.name, files: res.changed.map(p => ({ path: p, content: res.files[p] })) }) })).json();
      if (!j.ok) return false;
      await openProject(j.name);
      const secs = Math.round((Date.now() - t0) / 1000);
      say('ok', '✓ ' + (res.changed.length === 1 ? 'One file edited' : res.changed.length + ' files edited') + ' in ' + secs + ' s: ' + esc(res.changed.join(', ')) + ' · the rest of the project was not touched.' + (res.missed.length ? ' (' + res.missed.length + ' edit' + (res.missed.length === 1 ? '' : 's') + ' that did not fit were skipped.)' : '') + (engine ? '' : ' — install Godot to play it (the box above has the command)'));
      return true;
    }
    async function run(kind, text) {
      if (busy) return; busy = true; ctl = new AbortController(); show(); const t0 = Date.now(), cap = kind === 'new' ? 9000 : 9000;
      say('busy', '<span class="god-spin"></span><span id="gdprog">Asking the AI...</span><button class="god-btn" id="gdstop">■ Stop</button><div class="god-track"><div id="gdbar"></div></div>');
      $('gdstop').onclick = () => { try { ctl.abort(); } catch (e) { } };
      const wait = setInterval(() => { const p = $('gdprog'); if (!busy || !p) return clearInterval(wait); if (/^Asking|^Waiting/.test(p.textContent)) p.textContent = 'Waiting for the AI engine, ' + Math.round((Date.now() - t0) / 1000) + ' s. It may be loading the model.'; }, 1000);
      const onLen = n => { const p = $('gdprog'), b = $('gdbar'); if (p) p.textContent = 'Writing the project: ' + Math.round(n / 1000 * 10) / 10 + ' kB, ' + Math.round((Date.now() - t0) / 1000) + ' s'; if (b) b.style.width = Math.min(96, n / (cap * 3.4) * 100) + '%'; };
      const msgs = [{ role: 'system', content: SYS }], files = {};
      if (kind === 'new') msgs.push({ role: 'user', content: 'Make this game: ' + text });
      else {
        let used = 0, pack = '';
        for (const f of cur.files.filter(f => !f.dir)) {
          try { const j = await (await fetch('/api/godot/file?name=' + encodeURIComponent(cur.name) + '&file=' + encodeURIComponent(f.path))).json(); if (!j.ok) continue; const body = j.text.slice(0, 18000); if (used + body.length > KEEP_CHARS) { pack += '=== FILE: ' + f.path + ' ===\n(file left out to stay inside the length limit)\n'; continue; } used += body.length; files[f.path] = body; pack += '=== FILE: ' + f.path + ' ===\n' + body + '\n'; } catch (e) { }
        }
        msgs.push({ role: 'user', content: 'Here is my current Godot project:\n' + pack + '\nChange it like this: ' + text + '\nKeep everything else working. Reply with every file of the project again, complete, in the same format.' });
      }
      try {
        /* a change is a debug of the files it wrote: the smallest edit first, the rewrite only if that cannot be applied */
        let patched = false, triedPatch = false;
        if (kind === 'edit' && A.patch && Object.keys(files).length) {
          triedPatch = true;
          try { patched = await patchFix(text, files, t0); } catch (e) { if (e.name === 'AbortError') throw e; }
          if (patched) { busy = false; ctl = null; show(); load(false); return; }
        }
        const out = extract(await ask(msgs, cap, onLen)); if (out.err) throw new Error(out.err);
        const nm = nameOf(out.files) || (kind === 'new' ? text.replace(/[^a-z0-9 ]/gi, ' ').trim().split(/\s+/).slice(0, 5).join(' ') : cur.name);
        const j = await (await fetch('/api/godot/save', { method: 'POST', body: JSON.stringify({ name: nm, files: out.files }) })).json();
        if (!j.ok) throw new Error(j.error || 'Could not save the project.');
        await openProject(j.name);
        say('ok', '✓ ' + (kind === 'new' ? 'Wrote' : 'Changed') + ' ' + j.count + ' file' + (j.count === 1 ? '' : 's') + ' in ' + Math.round((Date.now() - t0) / 1000) + ' s' + (engine ? '' : ' — install Godot to play it (the box above has the command)') + '. Read any file on the right.' + (triedPatch ? '<div class="god-note">The AI rewrote the project instead of patching it: its small edit did not fit the files.</div>' : ''));
      } catch (e) { if (e.name === 'AbortError') say('warn', 'Stopped. Nothing was saved.'); else say('err', '<b>The game could not be written.</b> ' + esc(e.message)); }
      busy = false; ctl = null; show(); load(false);
    }
    /* Everything stays inside Moundshroud. ▶ Play exports the game for the web and plays it in the box above the files;
       🛠 Open in Godot switches this window to the Godot editor page (web/godot-editor.html), whose Back to Studio
       button saves the project and comes back here with the same game open. */
    const gameBox = () => $('gdgame');
    const filled = () => { const b = gameBox().firstChild; return !!b && b.classList.contains('fs'); };
    function fill(on) { const b = gameBox().firstChild; if (!b) return; b.classList.toggle('fs', on); document.documentElement.classList.toggle('god-filled', on); const f = b.querySelector('[data-g="fs"]'); if (f) f.textContent = on ? '🗗 Exit full screen' : '⛶ Full screen'; if (!on && document.fullscreenElement) document.exitFullscreen().catch(() => { }); }
    function closeGame() { fill(false); gameBox().innerHTML = ''; }
    function playIn(name, ts) {
      gameBox().innerHTML = '<div class="god-player"><div class="god-phead"><b>▶ ' + esc(name) + '</b><span class="god-sp"></span><button class="god-btn" data-g="fs">⛶ Full screen</button><button class="god-btn" data-g="close">✕ Close</button></div><iframe allow="fullscreen; autoplay; gamepad" title="' + esc(name) + '"></iframe></div>';
      const fr = gameBox().querySelector('iframe'); fr.src = '/api/godot/web/' + encodeURIComponent(name) + '/index.html?v=' + (ts || Date.now());
      gameBox().onclick = e => { const g = e.target.closest('[data-g]'); if (!g) return; if (g.dataset.g === 'close') return closeGame(); if (filled()) return fill(false); fill(true); const b = gameBox().firstChild; if (b.requestFullscreen) b.requestFullscreen().catch(() => { }); };
      fr.addEventListener('load', () => { try { fr.focus(); } catch (e) { } });
      gameBox().scrollIntoView({ block: 'nearest' });
    }
    document.addEventListener('fullscreenchange', () => { if (!document.fullscreenElement && filled()) fill(false); });
    A.godotPlayer = { escape: () => { if (!gameBox() || !gameBox().isConnected || !gameBox().firstChild) return false; if (filled()) fill(false); else closeGame(); return true; } };
    async function fire(which) {
      if (!cur) return;
      if (which === 'open') { say('busy', '<span class="god-spin"></span>Opening the Godot editor…'); location.href = '/godot-editor/?p=' + encodeURIComponent(cur.name); return; }
      if (busy) return; busy = true; show();
      say('busy', '<span class="god-spin"></span>Getting ' + esc(cur.name) + ' ready to play here. The first time takes a moment...');
      try {
        const r = await (await fetch('/api/godot/export', { method: 'POST', body: JSON.stringify({ name: cur.name }) })).json();
        if (r.ok) { say('ok', '▶ Playing <b>' + esc(cur.name) + '</b> above. Click the game first, then use the keys it asks for. ⛶ Full screen fills the screen; Esc comes back.'); playIn(cur.name); }
        else if (r.error === 'templates-missing') say('err', '<b>Godot\'s web player is not installed yet.</b> Godot ' + esc(r.version || '') + ' looks for it in ' + esc(r.where || '') + '.');
        else if (r.error === 'godot-missing') { engine = null; banner(); show(); say('err', '<b>Godot is not installed.</b> Run the command in the box above, then press "I ran it".'); }
        else if (r.error === 'export-failed') say('err', '<b>Godot could not get this game ready.</b> Its own message:<pre class="god-code" style="margin-top:8px;max-height:220px">' + esc(String(r.log || '').slice(-900)) + '</pre>');
        else say('err', esc(r.error || 'The game could not be started.'));
      } catch (e) { say('err', 'The game could not be started: ' + esc(e.message)); }
      busy = false; show();
    }

    $('gdp').onkeydown = e => { if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) { e.preventDefault(); $('gdnew').click(); } };
    $('gdc').onkeydown = e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); $('gdchg').click(); } };
    root.querySelector('.god-ideas').onclick = e => { const b = e.target.closest('[data-idea]'); if (b) { $('gdp').value = IDEAS[+b.dataset.idea][2]; $('gdp').focus(); } };
    $('gdnew').onclick = () => { const v = $('gdp').value.trim(); if (!v) return say('warn', 'Describe the game first, or tap one of the ideas.'); run('new', v); };
    $('gdchg').onclick = () => { const v = $('gdc').value.trim(); if (!v) return say('warn', 'Type the change you want first.'); run('edit', v); };
    $('gdplay').onclick = () => fire('play');
    $('gdopen').onclick = () => fire('open');
    /* port it: export the project for the web, then add it to the Arcade's own game list */
    $('gdport').onclick = async () => {
      if (!cur || busy) return; busy = true; show();
      say('busy', '<span class="god-spin"></span><span id="gdprog">Exporting the game for the Arcade. The first one takes a moment...</span>');
      try {
        const r = await (await fetch('/api/godot/export', { method: 'POST', body: JSON.stringify({ name: cur.name }) })).json();
        if (r.ok) { const added = A.arcade && A.arcade.add({ kind: 'godot', name: cur.name, dir: cur.name, from: 'godot' }); say('ok', (added ? '✓ <b>' + esc(cur.name) + '</b> is in the Arcade' : '✓ Exported, but the Arcade would not take it') + '. Open <b>Games › Arcade</b>; it sits under <b>Action &amp; arcade</b>. The exported files are in the game\'s <b>web</b> folder.'); }
        else if (r.error === 'templates-missing') say('err', '<b>Godot\'s web export templates are not installed yet.</b> Run this once (about 1 GB), then press Send to Arcade again:<div class="god-cmd"><code>powershell -ExecutionPolicy Bypass -File install-godot-templates.ps1</code></div><div class="god-note">Godot ' + esc(r.version || '') + ' looks for them in ' + esc(r.where || '') + '. Playing and editing the game does not need them.</div>');
        else if (r.error === 'godot-missing') { engine = null; banner(); show(); say('err', '<b>Godot is not installed.</b> Run the command in the box above, then press "I ran it".'); }
        else if (r.error === 'export-failed') say('err', '<b>Godot could not export this game.</b> Its own message:<pre class="god-code" style="margin-top:8px;max-height:220px">' + esc(String(r.log || '').slice(-900)) + '</pre>');
        else say('err', '<b>Could not port it.</b> ' + esc(r.error || 'Nothing came back from the exporter.'));
      } catch (e) { say('err', 'Could not port it: ' + esc(e.message)); }
      busy = false; show();
    };
    $('gdname').onkeydown = e => { if (e.key === 'Enter') { e.preventDefault(); e.target.blur(); } };
    $('gdtree').onclick = e => { const b = e.target.closest('[data-file]'); if (b) readFile(b.dataset.file); };
    $('gddel').onclick = async () => {
      if (!cur) return; const b = $('gddel');
      if (b.dataset.sure !== '1') { b.dataset.sure = '1'; b.textContent = 'Delete?'; b.classList.add('god-danger'); setTimeout(() => { if (b.isConnected) { b.dataset.sure = ''; b.textContent = '🗑'; b.classList.remove('god-danger'); } }, 4000); return; }
      try { const r = await (await fetch('/api/godot/delete', { method: 'POST', body: JSON.stringify({ name: cur.name }) })).json(); if (!r.ok) return say('err', esc(r.error || 'Could not delete it.')); cur = null; $('gdtree').innerHTML = '<div class="god-note">Files of the game appear here.</div>'; file = null; $('gdcode').value = ''; $('gdcode').readOnly = true; fileBar(); say('ok', 'Deleted. The folder is gone from this PC.'); show(); load(false); }
      catch (e) { say('err', 'Could not delete it: ' + esc(e.message)); }
    };
    $('gdlist').onclick = e => { const o = e.target.closest('[data-open]'); if (o) return openProject(o.dataset.open); const d = e.target.closest('[data-del]'); if (d) { const n = d.dataset.del; if (d.dataset.sure !== '1') { d.dataset.sure = '1'; d.textContent = 'Sure?'; d.classList.add('god-danger'); setTimeout(() => { if (d.isConnected) { d.dataset.sure = ''; d.textContent = '🗑'; d.classList.remove('god-danger'); } }, 4000); return; } fetch('/api/godot/delete', { method: 'POST', body: JSON.stringify({ name: n }) }).then(r => r.json()).then(r => { if (!r.ok) return say('err', esc(r.error || 'Could not delete it.')); if (cur && cur.name === n) cur = null; say('ok', 'Deleted "' + esc(n) + '".'); show(); load(false); }).catch(() => say('err', 'Could not delete it.')); } };
    body._cleanup = () => { try { ctl && ctl.abort(); } catch (e) { } };
    load(false); show();
    /* back from the Godot editor: open the same game again */
    if (A.studio.reopenGodot) { const n = A.studio.reopenGodot; A.studio.reopenGodot = ''; setTimeout(() => openProject(n).then(() => say('ok', '✓ Back from the Godot editor. Your saved changes are in the files on the right.')).catch(() => { }), 300); }
  });
})();

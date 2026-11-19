// Local PC coding workspace. Opens one directory at a time; large drives are never crawled recursively.
(() => {
  const root = document.getElementById('p-coding'); if (!root || root.dataset.ready) return; root.dataset.ready = '1';
  const $ = s => root.querySelector(s), esc2 = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[c]));
  const fmt = n => n >= 1048576 ? (n / 1048576).toFixed(1) + ' MB' : n >= 1024 ? Math.round(n / 1024) + ' KB' : n + ' B';
  let dir = '', parentDir = '', offset = 0, entries = [], busy = false, tabs = [], active = '', bar, chats = [], proposals = [], navRequest = 0;
  const current = () => tabs.find(t => t.path === active), hasDirty = () => tabs.some(t => t.dirty), editor = () => window.CodeEd && window.CodeEd.of($('#coda'));
  let stats = null;

  root.innerHTML = '<div class="rd-top"><h2>⌨️ Coding</h2><span class="small mute">Files on this PC · folders load only when opened</span><span class="sp"></span><button class="ib" id="codpick">📂 Choose folder</button></div>' +
    '<div class="rd-banner" style="margin:0 0 8px">🛡 <b>Local files stay on this PC.</b><span class="small" style="flex:1;min-width:180px">Only the open folder is listed; there is no whole drive scan. Saves keep a backup. Windows system folders are read-only.</span></div>' +
    '<div class="ae-split"><aside class="ae-side"><div class="row" style="padding:8px;gap:5px"><button class="ib" id="codhome">Home</button><button class="ib" id="codup">↑ Parent</button><button class="ib" id="codnew">＋ File</button><button class="ib" id="codfolder">＋ Folder</button></div><div class="ae-path" id="codpath"></div><input id="codfilter" type="search" placeholder="Filter this folder…" autocomplete="off"><div class="scroll" id="codlist"></div><button class="ib" id="codmore" style="margin:6px;display:none">Load more</button><div class="small mute" id="codcount" style="padding:0 8px 6px"></div></aside>' +
    '<main class="ae-main"><div class="ae-head"><b id="codname">Choose a file</b><span class="small mute" id="codmeta"></span><span class="sp"></span><button class="ib" id="codfull">⛶ Fullscreen</button><button class="ib" id="codmove" disabled>↪ Move</button><button class="ib dang" id="coddelete" disabled>Delete</button><button class="ib" id="codcheck" disabled>✓ Check</button><button class="pri" id="codsave" disabled>💾 Save</button></div><div class="small" id="codmsg"></div><div class="ce-tabs" id="codtabs"></div><textarea id="coda" data-code spellcheck="false" placeholder="Choose a source or text file from the left."></textarea><div class="small mute" style="margin-top:5px">Ctrl+S saves · Ctrl+F finds · Ctrl+H replaces · Ctrl+Shift+P opens commands · Ctrl+G goes to line. AI suggestions are staged here for review and are not saved automatically.</div>' +
    '<div id="codstats"></div>' +
    '<section class="ae-chat"><div class="row" style="padding:6px 9px;border-bottom:1px solid var(--line);gap:8px"><b>Local code helper</b><select id="codmodel" aria-label="Local model" style="max-width:230px"><option value="">Loading local models…</option></select><span class="small mute" style="flex:1">Ask about the open file</span><button class="ib" id="codchatcollapse">Assistant</button></div><div class="ae-chatlog" id="codlog" aria-live="polite"></div><div class="ae-chatbar"><textarea id="codinput" rows="2" placeholder="Debug, explain, or revise the open file…"></textarea><button class="pri" id="codsend">Send</button></div></section></main></div>';

  const m = id => $('#' + id);
  function drawPath() {
    const parts = dir.split(/[\\/]/).filter(Boolean), rootName = dir.match(/^[A-Za-z]:[\\/]/) ? parts.shift() + '\\' : (dir.startsWith('\\\\') ? '' : '');
    const crumbs = [];
    if (rootName) crumbs.push('<button class="ib" data-p="' + esc2(rootName) + '">' + esc2(rootName) + '</button>');
    let acc = rootName || (dir.startsWith('\\\\') ? '\\\\' : '');
    for (const part of parts) { acc = acc ? requireJoin(acc, part) : part; crumbs.push('<span class="mute">›</span><button class="ib" data-p="' + esc2(acc) + '">' + esc2(part) + '</button>'); }
    if (!crumbs.length) crumbs.push('<span class="small mute">' + esc2(dir || 'Home') + '</span>');
    m('codpath').innerHTML = crumbs.join('');
    m('codpath').onclick = e => { const b = e.target.closest('[data-p]'); if (b) load(b.dataset.p); };
  }
  function requireJoin(a,b) { return /\\$/.test(a) ? a + b : a + '\\' + b; }
  async function load(target, append = false) {
    const requestId = ++navRequest;
    const start = append ? offset : 0; m('codcount').textContent = 'Loading this folder…';
    const r = await A.api('/api/coding/list', { path: target, offset: start, limit: 160, filter:m('codfilter').value }).catch(() => null);
    if (requestId !== navRequest) return;
    if (!r || r.error) { m('codcount').textContent = ''; return A.toast((r && r.error) || 'Could not open that folder.', 5000); }
    dir = r.path; parentDir = r.parent || ''; offset = r.offset + r.entries.length; entries = append ? entries.concat(r.entries) : r.entries;
    drawPath(); drawList(); m('codmore').style.display = r.more ? '' : 'none';
    if (stats) stats.setFolder(dir);
    m('codcount').textContent = entries.length + ' of ' + r.total + ' items in this folder';
  }
  function drawList() {
    const q = m('codfilter').value.trim().toLowerCase(), shown = entries.filter(x => !q || x.name.toLowerCase().includes(q));
    m('codlist').innerHTML = shown.map(x => '<div class="ae-file ' + (x.dir ? '' : 'cod-file') + (x.path === active ? ' on' : '') + '" data-path="' + esc2(x.path) + '" data-dir="' + (x.dir ? '1':'0') + '" title="' + esc2(x.path) + '"><span>' + (x.dir ? '📁 ' : x.editable ? '🧩 ' : '📄 ') + esc2(x.name) + (x.protected ? ' 🔒' : '') + '</span><span class="small mute">' + (x.dir ? '' : x.size == null ? '' : fmt(x.size)) + '</span></div>').join('') || '<div class="small mute" style="padding:8px">No matching items.</div>';
    m('codlist').onclick = e => { const x = e.target.closest('[data-path]'); if (!x) return; const entry = entries.find(z => z.path === x.dataset.path); if (!entry) return; entry.dir ? load(entry.path) : entry.editable ? open(entry.path) : A.toast('That file is not a supported text or source-code file.', 4000); };
  }
  async function open(file) {
    const old = tabs.find(t => t.path === file); if (old) return activate(old.path);
    const r = await A.api('/api/coding/read', { path: file }).catch(() => null);
    if (!r || r.error) return A.toast((r && r.error) || 'Could not open that file.', 5000);
    tabs.push({ path:r.path, name:r.path.split(/[\\/]/).pop(), text:r.text, orig:r.text, dirty:false, scroll:0, mtime:r.mtime }); activate(r.path);
  }
  function redrawTabs() { if (bar) bar.render(tabs.map(t => ({ id:t.path,name:t.name,title:t.path,dirty:t.dirty,icon:/\.(js|ts|py|html|css)$/i.test(t.path)?'🧩':'📄' })), active); }
  function activate(file) {
    const t = tabs.find(x => x.path === file); if (!t) return;
    const prev = current(), ta = m('coda'); if (prev) { prev.scroll = ta.scrollTop; prev.sel = [ta.selectionStart,ta.selectionEnd]; }
    active = file; ta.value = t.text; ta.scrollTop = t.scroll || 0;
    editor()?.setName(file); editor()?.refresh(); m('codname').textContent = file; m('codmeta').textContent = ta.value.split('\n').length + ' lines · ' + fmt(new Blob([ta.value]).size);
    if (stats) stats.setFile(file, ta.value);
    ['codsave','codcheck','codmove','coddelete'].forEach(id => { m(id).disabled = false; });
    redrawTabs(); drawList();
  }
  async function closeTab(file) { const i=tabs.findIndex(t=>t.path===file); if(i<0)return; if(tabs[i].dirty && !(await A.confirm('Discard unsaved edits to this file?')))return; tabs.splice(i,1); if(active===file){ active=''; if(tabs.length)activate(tabs[Math.max(0,i-1)].path); else {m('coda').value=''; m('codname').textContent='Choose a file'; ['codsave','codcheck','codmove','coddelete'].forEach(id=>m(id).disabled=true);} } redrawTabs(); }
  bar = window.CodeEd ? CodeEd.tabbar(m('codtabs'), { onselect:activate, onclose:closeTab }) : null;
  stats = window.CodeStats ? CodeStats.mount($('#codstats'), { kind: 'coding' }) : null;
  m('coda').addEventListener('input', () => { const t=current(); if(!t)return; t.text=m('coda').value; t.dirty=t.text!==t.orig; m('codmeta').textContent=t.text.split('\n').length+' lines · '+fmt(new Blob([t.text]).size)+(t.dirty?' · unsaved':''); redrawTabs(); if(stats)stats.setFile(t.path,t.text); });
  async function save() { const t=current(); if(!t||busy)return; busy=true;m('codmsg').textContent='Saving with a backup…'; const r=await A.api('/api/coding/save',{path:t.path,text:m('coda').value,mtime:t.mtime}).catch(()=>null);busy=false;if(!r||r.error){m('codmsg').textContent=(r&&r.error)||'Save failed.';return;}t.orig=t.text=m('coda').value;t.dirty=false;t.mtime=r.mtime;redrawTabs();m('codmsg').textContent=r.backedUp?'Saved. Previous version backed up.':'Saved, but a backup could not be made.'; }
  async function check() { const t=current();if(!t)return; const r=await A.api('/api/coding/check',{path:t.path,text:m('coda').value}).catch(()=>null);m('codmsg').textContent=r&&r.ok?'Check passed.':(r&&r.error)||'Could not check this file.'; }
  async function createFile() { const name=await A.prompt('New source or text file name (for example, main.js):');if(!name)return;const p=requireJoin(dir,name.trim());const r=await A.api('/api/coding/create',{path:p,text:''}).catch(()=>null);if(!r||r.error)return A.toast((r&&r.error)||'Could not create the file.',5000);await load(dir);open(r.path); }
  async function createFolder() { const name=await A.prompt('New folder name:');if(!name)return;const r=await A.api('/api/coding/mkdir',{path:requireJoin(dir,name.trim())}).catch(()=>null);if(!r||r.error)return A.toast((r&&r.error)||'Could not create the folder.',5000);load(dir); }
  async function moveFile() { const t=current();if(!t)return;if(t.dirty){if(!(await A.confirm('Save your unsaved edits before moving this file?')))return;await save();if(t.dirty)return;}const to=await A.prompt('Move this file to a full path:',t.path);if(!to)return;const r=await A.api('/api/coding/move',{path:t.path,to}).catch(()=>null);if(!r||r.error)return A.toast((r&&r.error)||'Could not move the file.',5000);t.path=r.path;t.name=r.path.split(/[\\/]/).pop();t.mtime=r.mtime;active=t.path;await load(dir);redrawTabs();m('codname').textContent=t.path;A.toast(r.backedUp?'Moved file; its previous version was backed up.':'Moved file; backup could not be made.',3500); }
  async function deleteFile() { const t=current();if(!t)return;if(!(await A.confirm('Delete '+t.path+'? A backup will be kept first.')))return;if(t.dirty&&!(await A.confirm('This file has unsaved edits. Delete it and discard those edits?')))return;const r=await A.api('/api/coding/remove',{path:t.path}).catch(()=>null);if(!r||r.error)return A.toast((r&&r.error)||'Could not delete the file.',5000);tabs=tabs.filter(x=>x!==t);active='';if(tabs.length)activate(tabs[0].path);else{m('coda').value='';m('codname').textContent='Choose a file';['codsave','codcheck','codmove','coddelete'].forEach(id=>m(id).disabled=true);}redrawTabs();await load(dir);A.toast('File deleted; backup kept.',3500); }
  function renderChat() { m('codlog').innerHTML=chats.map((x,i)=>'<div class="ae-chatmsg '+(x.role==='user'?'user':'')+'"><b>'+(x.role==='user'?'You':'Local model')+'</b><div>'+esc2(x.content)+'</div>'+(x.role==='assistant'&&proposals[i]?'<button class="ib" data-prop="'+i+'">Apply suggestion to editor (unsaved)</button>':'')+'</div>').join('')||'<div class="small mute">Choose a source file and ask your local model to help.</div>';m('codlog').scrollTop=m('codlog').scrollHeight; }
  m('codlog').onclick=e=>{const b=e.target.closest('[data-prop]');if(!b)return;const code=proposals[+b.dataset.prop];if(code==null)return;m('coda').value=code;m('coda').dispatchEvent(new Event('input',{bubbles:true}));A.toast('Suggestion staged in the editor; review before saving.',4000);};
  async function loadModels() { const r=await A.api('/api/models').catch(()=>null),s=m('codmodel');const rows=((r&&r.models)||[]).filter(x=>x&&!x.cloud&&x.name&&x.name!=='free-auto');s.innerHTML=rows.length?rows.map(x=>'<option value="'+esc2(x.name)+'"'+(x.name===r.defaultModel?' selected':'')+'>'+esc2(x.label||x.name)+'</option>').join(''):'<option value="">No local models found</option>'; }
  async function send() { const ask=m('codinput').value.trim(),model=m('codmodel').value,t=current();if(!ask)return;if(!model)return A.toast('No local model is available.',4000);chats.push({role:'user',content:ask});m('codinput').value='';renderChat();m('codsend').disabled=true;const sys='You are a local coding helper. Help debug, explain, or revise the currently open file. If revising, return a complete replacement in one fenced code block. Never claim to have saved or tested. Suggestions are reviewed by the user before saving.\nCurrent file: '+(t?t.path:'none')+'\n```\n'+(t?m('coda').value.slice(0,50000):'')+'\n```';try{const r=await A.api('/api/chat',{model,messages:[{role:'system',content:sys},...chats.slice(-12)],stream:false});const out=r&&(r.message?.content||r.choices?.[0]?.message?.content||r.response);if(!out)throw new Error(r?.error||'No reply returned.');chats.push({role:'assistant',content:String(out)});const match=String(out).match(/```(?:[\w+-]+)?\s*\n([\s\S]*?)```/);proposals[chats.length-1]=match?match[1].replace(/\n$/,''):null;}catch(e){chats.push({role:'assistant',content:'Could not get a reply: '+(e.message||'Check the local model.')});}m('codsend').disabled=false;renderChat(); }
  async function fullscreen() { root.classList.toggle('cod-expanded');const on=root.classList.contains('cod-expanded');m('codfull').textContent=on?'⛶ Exit fullscreen':'⛶ Fullscreen';requestAnimationFrame(()=>editor()?.refresh()); }
  m('codfilter').addEventListener('input',()=>{offset=0;entries=[];load(dir);});m('codmore').onclick=()=>load(dir,true);m('codhome').onclick=async()=>{const r=await A.api('/api/coding/roots');const home=(r.roots||[])[0];if(home)load(home.path);};m('codup').onclick=()=>{if(parentDir)load(parentDir);};m('codpick').onclick=async()=>{const r=await A.api('/api/pick-folder',{}).catch(()=>null);if(r&&r.path){m('codfilter').value='';load(r.path);}};m('codnew').onclick=createFile;m('codfolder').onclick=createFolder;m('codmove').onclick=moveFile;m('coddelete').onclick=deleteFile;m('codsave').onclick=save;m('codcheck').onclick=check;m('codfull').onclick=fullscreen;m('codsend').onclick=send;m('codchatcollapse').onclick=()=>{const box=root.querySelector('.ae-chat');box.classList.toggle('collapsed');m('codchatcollapse').textContent=box.classList.contains('collapsed')?'Show assistant':'Assistant';};m('codinput').addEventListener('keydown',e=>{if(e.key==='Enter'&&!e.shiftKey){e.preventDefault();send();}});
  (async()=>{await loadModels();const r=await A.api('/api/coding/roots').catch(()=>null);const home=r&&r.roots&&r.roots[0];if(home)load(home.path);})();
  root.addEventListener('keydown',e=>{if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==='s'){e.preventDefault();save();}if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==='w'&&active){e.preventDefault();closeTab(active);}if(e.key==='Escape'&&root.classList.contains('cod-expanded')){root.classList.remove('cod-expanded');m('codfull').textContent='⛶ Fullscreen';requestAnimationFrame(()=>editor()?.refresh());}});
  A.NAVIC.coding='⌨️';
  if (A.tabs.coding) A.tabs.coding.onShow = async () => { if (!dir) { const r=await A.api('/api/coding/roots').catch(()=>null);const home=r&&r.roots&&r.roots[0];if(home)await load(home.path); } };
  else A.registerTab('coding','Coding',()=>{});
  if(A.buildNav)A.buildNav();
})();

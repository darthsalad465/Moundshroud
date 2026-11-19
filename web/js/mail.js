// Mail tab: read your email, write drafts, and let your local AI summarise and help reply.
// Emails are shown in a locked-down frame: no scripts, no forms, and no outside pictures (which tell the sender you
// opened it) unless you press "Show pictures". The page is marked data-private: the chat AI never sees your mail,
// and Mail's own AI buttons always use a model on this PC, even if a Claude model is picked for chat.
// Moundshroud never sends email. Drafts are saved to your account's Drafts folder, to send from your phone or webmail.
(() => {
  const root = document.getElementById('p-mail'); if (!root) return;
  let ready = null, ACC = [], PRE = [], acct = ls.get('mail_acct', ''), folders = [], folder = 'INBOX', items = [], more = false, open = null, q = '', built = false, busy = false, pics = {};
  const api = (p, b) => A.api('/api/mail/' + p, b);
  const when = t => { if (!t) return ''; const d = new Date(t), n = new Date(); return d.toDateString() === n.toDateString() ? d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }) : d.getFullYear() === n.getFullYear() ? d.toLocaleDateString([], { month: 'short', day: 'numeric' }) : d.toLocaleDateString(); };
  const who = a => a ? (a.name || a.email || '') : '';
  const addr = a => a ? (a.name ? a.name + ' <' + a.email + '>' : a.email) : '';
  const kb = n => n > 1048576 ? (n / 1048576).toFixed(1) + ' MB' : Math.max(1, Math.round(n / 1024)) + ' KB';

  /* Mail's AI is always a model on this PC */
  async function localModel() {
    const cur = A.ai.model(); let ms = [];
    try { ms = ((await A.api('/api/models')).models || []).filter(m => !m.cloud).map(m => m.name); } catch (e) { }
    return ms.includes(cur) ? cur : (ms.find(m => !/embed/i.test(m)) || '');
  }
  async function aiInto(el, messages) {
    const m = await localModel(); if (!m) { el.textContent = 'No AI model is installed on this PC (Prepare › Stock up › AI models).'; return ''; }
    el.innerHTML = '<span class="mute">Thinking…</span>';
    try { return await A.ai.stream(messages, t => { el.innerHTML = fmt(t); }, null, { model: m, temp: .3 }); } catch (e) { el.textContent = 'The local AI could not answer: ' + e.message; return ''; }
  }
  const fmt = t => esc(t).replace(/\*\*(.+?)\*\*/g, '<b>$1</b>').replace(/^\s*[-*•]\s+(.*)$/gm, '<div style="padding-left:12px">• $1</div>').replace(/<\/div>\n+/g, '</div>').replace(/\n/g, '<br>');

  function build() {
    built = true;
    root.innerHTML = '<div class="ml" data-private><aside class="ml-side" id="mlside"></aside><section class="ml-list"><div class="ml-lh"><input id="mlq" placeholder="Search this folder…"><button class="ib" id="mlref" title="Check for new mail">↻</button></div><div id="mllist" class="ml-items"></div></section><section class="ml-read" id="mlread"></section></div>';
    root.querySelector('#mlref').onclick = () => refresh();
    const qi = root.querySelector('#mlq'); qi.onkeydown = e => { if (e.key === 'Enter') { q = qi.value.trim(); q ? search() : refresh(); } };
    root.querySelector('#mllist').onclick = e => { const r = e.target.closest('[data-uid]'); if (!r) return; if (e.target.closest('[data-more]')) return older(); openMsg(+r.dataset.uid); };
  }
  async function start() {
    const r = await api('accounts').catch(() => ({ accounts: [], presets: [] })); ACC = r.accounts || []; PRE = r.presets || [];
    if (!ACC.length) return setup();
    if (!ACC.some(a => a.id === acct)) acct = ACC[0].id; ls.set('mail_acct', acct);
    if (!root.querySelector('.ml')) build();
    side(); reader(null);
    const c = await api('cached', { acct, folder }).catch(() => null); if (c && c.items && c.items.length) { items = c.items; paintList('Showing what was downloaded ' + when(c.at) + '. Checking for new mail…'); }
    loadFolders(); refresh();
  }

  /* ---------- adding an account ---------- */
  function setup(again) {
    built = false;
    root.innerHTML = '<div class="scroll pad" style="flex:1" data-private><div style="max-width:620px;margin:0 auto"><h2 style="margin:0 0 4px">✉️ Mail</h2><div class="small mute" style="line-height:1.55;margin-bottom:12px">Read your email here, keep drafts, and let your local AI summarise messages and help you reply. Moundshroud connects straight to your email provider, encrypted. Your password is protected by Windows for your Windows account only. Mail you open is kept on this PC so you can read it offline. <b>Moundshroud never sends email</b>: drafts go to your account’s Drafts folder, to send from your phone or webmail.</div>' +
      '<div class="card"><b>' + (again ? 'Add another account' : 'Connect your email') + '</b><div class="ml-pre" id="mlpre">' + PRE.map(p => '<button class="ib" data-p="' + p.id + '">' + esc(p.name) + '</button>').join('') + '</div><div id="mlhelp" class="small" style="line-height:1.5;margin:8px 0;padding:8px 10px;border-radius:8px;background:var(--panel);display:none"></div>' +
      '<div class="ml-form"><label>Email address<input id="mle" type="email" autocomplete="off" placeholder="you@example.com"></label><label>User name <span class="mute">(usually the same)</span><input id="mlu" autocomplete="off"></label><label>Password <span class="mute">(usually an app password)</span><input id="mlp" type="password" autocomplete="new-password"></label>' +
      '<details id="mladv"><summary class="small">Server settings</summary><label>IMAP server<input id="mlh" placeholder="imap.example.com"></label><label>Port<input id="mlport" type="number" value="993"></label><label>Security<select id="mlsec"><option value="tls">SSL/TLS</option><option value="starttls">STARTTLS</option></select></label></details>' +
      '<div class="row" style="margin-top:8px"><button class="pri" id="mlgo">Connect</button>' + (again ? '<button class="ib" id="mlcancel">Cancel</button>' : '') + '<span id="mlerr" class="small" style="color:var(--bad)"></span></div></div></div>' +
      '<div class="small mute" style="line-height:1.5">Outlook.com, Hotmail and Live accounts cannot be connected: Microsoft only lets its own sign-in page approve apps for those, and Moundshroud does not use outside sign-in services.</div></div></div>';
    let preset = 'gmail';
    const pick = id => { preset = id; const p = PRE.find(x => x.id === id) || {}; root.querySelectorAll('[data-p]').forEach(b => b.classList.toggle('on', b.dataset.p === id)); const h = root.querySelector('#mlhelp'); h.style.display = ''; h.textContent = p.help || ''; root.querySelector('#mlh').value = p.host || ''; root.querySelector('#mlport').value = p.port || 993; root.querySelector('#mlsec').value = p.sec || 'tls'; root.querySelector('#mladv').open = id === 'other'; };
    root.querySelectorAll('[data-p]').forEach(b => b.onclick = () => pick(b.dataset.p));
    const e = root.querySelector('#mle'), u = root.querySelector('#mlu'); e.oninput = () => { if (!u.dataset.touched) u.value = e.value; const d = (e.value.split('@')[1] || '').toLowerCase(); const g = /gmail|googlemail/.test(d) ? 'gmail' : /yahoo|ymail/.test(d) ? 'yahoo' : /icloud|me\.com|mac\.com/.test(d) ? 'icloud' : /fastmail/.test(d) ? 'fastmail' : /proton|pm\.me/.test(d) ? 'proton' : /gmx/.test(d) ? 'gmx' : /zoho/.test(d) ? 'zoho' : /aol/.test(d) ? 'aol' : ''; if (g && g !== preset) pick(g); };
    u.oninput = () => { u.dataset.touched = '1'; };
    const c = root.querySelector('#mlcancel'); if (c) c.onclick = () => start();
    root.querySelector('#mlgo').onclick = async () => {
      const err = root.querySelector('#mlerr'), b = root.querySelector('#mlgo'); err.textContent = ''; b.disabled = true; b.textContent = 'Connecting…';
      const r = await api('account/add', { preset, email: e.value.trim(), user: u.value.trim(), password: root.querySelector('#mlp').value, host: root.querySelector('#mlh').value.trim(), port: +root.querySelector('#mlport').value, sec: root.querySelector('#mlsec').value }).catch(x => ({ error: x.message }));
      b.disabled = false; b.textContent = 'Connect';
      if (r.error) { err.textContent = r.error; return; }
      acct = r.account.id; ls.set('mail_acct', acct); folder = 'INBOX'; items = []; A.toast('Connected to ' + r.account.email + '.'); start();
    };
    pick(preset);
  }

  /* ---------- the sidebar ---------- */
  const ICON = { inbox: '📥', drafts: '📝', sent: '📤', archive: '🗄', junk: '🚫', trash: '🗑', '': '📁' };
  function side() {
    const s = root.querySelector('#mlside'); if (!s) return;
    s.innerHTML = '<button class="pri" id="mlnew" style="width:100%">✍ New draft</button><button class="ib" id="mlbrief" style="width:100%;margin-top:6px" title="Your local AI reads the newest subjects and senders and says what needs you">✨ Inbox brief</button>' +
      '<div class="ml-sec">Folders</div>' + (folders.length ? folders.map(f => '<button class="ml-f' + (f.name === folder ? ' on' : '') + '" data-f="' + esc(f.name) + '">' + (ICON[f.use] || '📁') + ' ' + esc(f.use === 'inbox' ? 'Inbox' : f.label) + '</button>').join('') : '<div class="small mute" style="padding:4px 8px">📥 Inbox</div>') +
      '<button class="ml-f" data-local>💾 Drafts on this PC</button>' +
      '<div class="ml-sec">Accounts</div>' + ACC.map(a => '<button class="ml-f' + (a.id === acct ? ' on' : '') + '" data-a="' + a.id + '" title="' + esc(a.host) + '">' + esc(a.email) + '</button>').join('') + '<button class="ml-f" id="mladd">＋ Add an account</button><button class="ml-f" id="mlrm" style="color:var(--bad)">Remove this account…</button>';
    s.querySelector('#mlnew').onclick = () => compose({});
    s.querySelector('#mlbrief').onclick = brief;
    s.querySelectorAll('[data-f]').forEach(b => b.onclick = () => { folder = b.dataset.f; q = ''; root.querySelector('#mlq').value = ''; items = []; side(); reader(null); refresh(); });
    s.querySelector('[data-local]').onclick = localDrafts;
    s.querySelectorAll('[data-a]').forEach(b => b.onclick = () => { acct = b.dataset.a; ls.set('mail_acct', acct); folder = 'INBOX'; folders = []; items = []; start(); });
    s.querySelector('#mladd').onclick = () => setup(true);
    s.querySelector('#mlrm').onclick = async () => { const a = ACC.find(x => x.id === acct); if (!a || !(await A.confirm('Remove ' + a.email + ' from Moundshroud? Its saved password and the mail kept on this PC are deleted. Nothing in the account itself changes.'))) return; await api('account/remove', { id: acct }); acct = ''; folders = []; items = []; start(); };
  }
  async function loadFolders() { const r = await api('folders', { acct }).catch(() => null); if (r && r.folders) { folders = r.folders; side(); } }

  /* ---------- the list ---------- */
  function paintList(note) {
    const l = root.querySelector('#mllist'); if (!l) return;
    l.innerHTML = (note ? '<div class="small mute" style="padding:8px 10px">' + esc(note) + '</div>' : '') + items.map(m => '<div class="ml-it' + (m.seen ? '' : ' unread') + (open && open.uid === m.uid ? ' on' : '') + '" data-uid="' + m.uid + '" tabindex="0"><div class="ml-row1"><span class="ml-from">' + esc(who(m.from)) + '</span><span class="ml-date">' + when(m.date) + '</span></div><div class="ml-sub">' + (m.flagged ? '⭐ ' : '') + (m.att ? '📎 ' : '') + esc(m.subject) + (m.news ? ' <span class="ml-tag">newsletter</span>' : '') + '</div></div>').join('') +
      (more ? '<div class="ml-it" data-uid="0" data-more style="text-align:center"><span class="mute">Load older mail</span></div>' : '') + (!items.length && !note ? '<div class="mute" style="padding:20px">Nothing here.</div>' : '');
  }
  async function refresh() {
    if (busy) return; busy = true; const l = root.querySelector('#mllist'); if (l && !items.length) l.innerHTML = '<div class="mute" style="padding:20px">Checking ' + esc(folder === 'INBOX' ? 'your inbox' : folder) + '…</div>';
    const r = await api('list', { acct, folder }).catch(e => ({ error: e.message })); busy = false;
    if (r.error) { paintList(items.length ? r.error : ''); if (!items.length) l.innerHTML = '<div style="padding:16px;color:var(--bad)">' + esc(r.error) + '</div>'; return; }
    items = r.items; more = r.more; paintList();
  }
  async function older() { const last = items[items.length - 1]; if (!last) return; const r = await api('list', { acct, folder, before: last.uid }).catch(() => null); if (r && r.items) { items = items.concat(r.items); more = r.more; paintList(); } }
  async function search() { const l = root.querySelector('#mllist'); l.innerHTML = '<div class="mute" style="padding:20px">Searching…</div>'; const r = await api('search', { acct, folder, q }).catch(e => ({ error: e.message })); if (r.error) { l.innerHTML = '<div style="padding:16px;color:var(--bad)">' + esc(r.error) + '</div>'; return; } items = r.items; more = false; paintList(items.length ? items.length + ' found for “' + q + '”' : 'Nothing found for “' + q + '”'); }

  /* ---------- reading ---------- */
  function reader(m, html) { const r = root.querySelector('#mlread'); if (!r) return; if (!m) { r.innerHTML = '<div class="mute" style="padding:40px;text-align:center">Pick a message to read it.</div>'; return; } r.innerHTML = html; }
  async function openMsg(uid) {
    const h = items.find(x => x.uid === uid); open = { uid }; paintList();
    reader(true, '<div class="mute" style="padding:30px">Opening…</div>');
    const m = await api('message', { acct, folder, uid, read: true }).catch(e => ({ error: e.message }));
    if (m.error) return reader(true, '<div style="padding:20px;color:var(--bad)">' + esc(m.error) + '</div>');
    if (h) h.seen = true; open = m; paintList(); show(m);
  }
  /* an email's HTML is cleaned and shown in a frame that cannot run scripts, send forms or load outside pictures */
  function clean(m, allowPics) {
    const doc = new DOMParser().parseFromString(m.html, 'text/html'); let blocked = 0;
    doc.querySelectorAll('script,iframe,frame,object,embed,meta,link,base,form,input,button,textarea,select,applet,audio,video,source').forEach(e => e.remove());
    doc.querySelectorAll('*').forEach(e => { [...e.attributes].forEach(a => { if (/^on/i.test(a.name) || (/^(href|src|action|formaction|xlink:href|background)$/i.test(a.name) && /^\s*(javascript|vbscript|data:text)/i.test(a.value))) e.removeAttribute(a.name); }); });
    doc.querySelectorAll('img').forEach(i => { const s = i.getAttribute('src') || ''; if (/^cid:/i.test(s)) { const d = m.inl && m.inl[s.slice(4)]; if (d) i.src = d; else i.remove(); } else if (/^https?:/i.test(s)) { if (allowPics) i.src = '/api/mail-img?u=' + encodeURIComponent(s.replace(/^http:/i, 'https:')); else { i.removeAttribute('src'); i.removeAttribute('srcset'); blocked++; i.style.display = i.width > 2 && i.height > 2 ? '' : 'none'; } } else if (!/^data:image\//i.test(s)) i.remove(); });
    doc.querySelectorAll('[style*="url("]').forEach(e => { if (!allowPics) { e.style.backgroundImage = 'none'; } });
    doc.querySelectorAll('a[href]').forEach(a => { a.target = '_blank'; a.rel = 'noopener noreferrer'; try { const u = new URL(a.href); a.title = u.hostname + (a.title ? ' · ' + a.title : ''); } catch (e) { } });
    const csp = "default-src 'none'; style-src 'unsafe-inline'; font-src data:; img-src data: " + (allowPics ? location.origin + '/api/mail-img' : '') + ';';
    return { blocked, src: '<!doctype html><html><head><meta charset="utf-8"><meta http-equiv="Content-Security-Policy" content="' + csp + '"><base target="_blank"><style>body{font:15px/1.55 system-ui,Segoe UI,sans-serif;margin:14px;color:#1d1d1f;background:#fff;word-wrap:break-word}img{max-width:100%;height:auto}table{max-width:100%}</style></head><body>' + doc.body.innerHTML + '</body></html>' };
  }
  const linkify = t => esc(t).replace(/(https?:\/\/[^\s<>"')]+)/g, '<a href="$1" target="_blank" rel="noopener noreferrer">$1</a>');
  function show(m) {
    const key = acct + '|' + folder + '|' + m.uid, allow = !!pics[key], c = m.html ? clean(m, allow) : null;
    const dname = m.from && m.from.name || '', spoof = /@/.test(dname) && !dname.toLowerCase().includes(String(m.from.email || '').toLowerCase());
    const failAuth = /dmarc=fail|spf=fail|dkim=fail/i.test(m.auth || '');
    const atts = (m.atts || []).filter(a => !a.inline);
    reader(true, '<div class="ml-rh"><h2 style="margin:0 0 6px;font-size:19px">' + esc(m.subject) + '</h2>' +
      '<div class="small"><b>' + esc(who(m.from)) + '</b> <span class="mute">&lt;' + esc(m.from.email || '') + '&gt;</span> · <span class="mute">' + (m.date ? new Date(m.date).toLocaleString() : '') + '</span></div>' +
      '<div class="small mute">To ' + esc((m.to || []).map(addr).join(', ')) + ((m.cc || []).length ? ' · Cc ' + esc(m.cc.map(addr).join(', ')) : '') + '</div>' +
      (spoof || failAuth ? '<div class="ml-warn">⚠ ' + (failAuth ? 'This message failed the sender checks its provider ran: it may not really be from ' + esc(m.from.email) + '.' : 'The sender’s name contains an email address that is not the real sender (' + esc(m.from.email) + '). This is a common trick in scam emails.') + ' Do not click links or open attachments unless you are sure.</div>' : '') +
      '<div class="ml-acts"><button class="ib" data-x="reply">↩ Reply</button><button class="ib" data-x="all">↩↩ Reply all</button><button class="ib" data-x="fwd">↪ Forward</button><button class="ib" data-x="sum">✨ Summarise</button><button class="ib" data-x="ai">✍ Help me reply</button><button class="ib" data-x="star">' + (items.find(x => x.uid === m.uid && x.flagged) ? '★ Starred' : '☆ Star') + '</button><button class="ib" data-x="unread">Mark unread</button>' + (folders.some(f => f.use === 'trash') && !folders.some(f => f.use === 'trash' && f.name === folder) ? '<button class="ib" data-x="trash">🗑 Trash</button>' : '') + '</div>' +
      '<div id="mlai" class="ml-ai" style="display:none"></div>' +
      (atts.length ? '<div class="ml-atts">' + atts.map(a => '<a class="ib" href="/api/mail/att?a=' + encodeURIComponent(acct) + '&f=' + encodeURIComponent(folder) + '&u=' + m.uid + '&i=' + a.i + '" download="' + esc(a.name) + '" title="' + esc(a.type) + '">📎 ' + esc(a.name) + ' <span class="mute">' + kb(a.size) + '</span></a>').join('') + '</div>' : '') +
      (c && c.blocked ? '<div class="small" style="margin-top:6px">🖼 ' + c.blocked + ' outside picture' + (c.blocked > 1 ? 's were' : ' was') + ' not loaded, so the sender cannot tell you opened this. <a href="#" id="mlpics">Show pictures</a></div>' : '') + '</div>' +
      (c ? '<iframe class="ml-frame" sandbox="allow-same-origin allow-popups allow-popups-to-escape-sandbox" referrerpolicy="no-referrer"></iframe>' : '<div class="ml-text">' + linkify(m.text || '(This message has no text.)') + '</div>'));
    const r = root.querySelector('#mlread');
    if (c) { const f = r.querySelector('.ml-frame'); f.srcdoc = c.src; f.onload = () => { try { f.style.height = Math.min(20000, f.contentDocument.documentElement.scrollHeight + 30) + 'px'; } catch (e) { } }; }
    const p = r.querySelector('#mlpics'); if (p) p.onclick = e => { e.preventDefault(); pics[key] = 1; show(m); };
    r.querySelector('.ml-acts').onclick = e => { const b = e.target.closest('[data-x]'); if (b) act(b.dataset.x, m); };
  }
  /* an HTML email as plain text: no scripts or styles, line breaks where the blocks were */
  const htmlText = h => { const d = new DOMParser().parseFromString(h, 'text/html'); d.querySelectorAll('script,style,head,noscript,template').forEach(e => e.remove()); d.querySelectorAll('br').forEach(e => e.replaceWith('\n')); d.querySelectorAll('p,div,tr,li,h1,h2,h3,h4,table').forEach(e => e.append('\n')); return d.body.textContent.replace(/[ \t]+\n/g, '\n'); };
  const bodyText = m => (m.text || (m.html ? htmlText(m.html) : '')).replace(/\n{3,}/g, '\n\n').trim();
  const quote = m => '\n\n\nOn ' + new Date(m.date).toLocaleString() + ', ' + addr(m.from) + ' wrote:\n' + bodyText(m).slice(0, 20000).split('\n').map(l => '> ' + l).join('\n');
  const reSubj = (s, p) => new RegExp('^' + p + ':', 'i').test(s) ? s : p + ': ' + s;
  async function act(x, m) {
    const ai = root.querySelector('#mlai'), h = items.find(i => i.uid === m.uid);
    const replyTo = m.replyTo || m.from, me = (ACC.find(a => a.id === acct) || {}).email || '';
    if (x === 'reply') return compose({ to: addr(replyTo), subject: reSubj(m.subject, 'Re'), body: quote(m), irt: m.mid, refs: (m.refs + ' ' + m.mid).trim() });
    if (x === 'all') return compose({ to: [addr(replyTo)].concat((m.to || []).filter(a => a.email.toLowerCase() !== me.toLowerCase()).map(addr)).join(', '), cc: (m.cc || []).filter(a => a.email.toLowerCase() !== me.toLowerCase()).map(addr).join(', '), subject: reSubj(m.subject, 'Re'), body: quote(m), irt: m.mid, refs: (m.refs + ' ' + m.mid).trim() });
    if (x === 'fwd') return compose({ subject: reSubj(m.subject, 'Fwd'), body: '\n\n\n---------- Forwarded message ----------\nFrom: ' + addr(m.from) + '\nDate: ' + new Date(m.date).toLocaleString() + '\nSubject: ' + m.subject + '\nTo: ' + (m.to || []).map(addr).join(', ') + '\n\n' + bodyText(m) });
    if (x === 'sum') { ai.style.display = ''; return aiInto(ai, [{ role: 'system', content: 'Summarise this email for a busy reader using only its text. Format:\n**In one line**\n...\n**Key points**\n- ...\n**What they want from me**\n- the requests, questions or deadlines, or "Nothing."\nIf it looks like a scam (urgent payment, password, gift cards, a link to log in), say so first.' }, { role: 'user', content: 'From: ' + addr(m.from) + '\nSubject: ' + m.subject + '\n\n' + bodyText(m).slice(0, 12000) }]); }
    if (x === 'ai') { const want = (await A.prompt('What should the reply say? (for example: yes I can make Thursday, ask for the address)')); if (want == null) return; ai.style.display = ''; const t = await aiInto(ai, [{ role: 'system', content: 'Write a reply to this email for the user. Follow their instructions. Match the tone of the email (friendly or formal). Plain text only, no subject line, no placeholders like [Name] unless the name is unknown. Sign off without a name.' }, { role: 'user', content: 'Email from ' + addr(m.from) + ', subject "' + m.subject + '":\n\n' + bodyText(m).slice(0, 8000) + '\n\nWhat my reply should say: ' + want }]); if (t) compose({ to: addr(replyTo), subject: reSubj(m.subject, 'Re'), body: t.trim() + quote(m), irt: m.mid, refs: (m.refs + ' ' + m.mid).trim() }); return; }
    if (x === 'star') { const on = !(h && h.flagged); await api('flag', { acct, folder, uid: m.uid, what: 'flagged', on }); if (h) h.flagged = on; paintList(); show(m); return; }
    if (x === 'unread') { await api('flag', { acct, folder, uid: m.uid, what: 'seen', on: false }); if (h) h.seen = false; open = null; paintList(); reader(null); return; }
    if (x === 'trash') { const t = folders.find(f => f.use === 'trash'); if (!t || !(await A.confirm('Move “' + m.subject + '” to ' + t.label + '?'))) return; const r = await api('move', { acct, folder, uid: m.uid, to: t.name }); if (r.error) return A.toast(r.error); items = items.filter(i => i.uid !== m.uid); open = null; paintList(); reader(null); A.toast('Moved to ' + t.label + '.'); }
  }

  /* ---------- writing ---------- */
  function compose(d) {
    let r = root.querySelector('#mlread'); if (!r) { root.innerHTML = '<div class="scroll" style="flex:1" data-private><div id="mlsolo" style="max-width:820px;margin:0 auto"></div></div>'; r = root.querySelector('#mlsolo'); } const id = d.id || '';
    r.innerHTML = '<div class="ml-rh"><h2 style="margin:0 0 8px;font-size:18px">✍ ' + (d.subject ? esc(d.subject) : 'New draft') + '</h2><div class="ml-form"><label>To<input id="mct" value="' + esc(d.to || '') + '"></label><label>Cc<input id="mcc" value="' + esc(d.cc || '') + '"></label><label>Subject<input id="mcs" value="' + esc(d.subject || '') + '"></label></div>' +
      '<textarea id="mcb" class="ml-body" spellcheck="true">' + esc(d.body || '') + '</textarea>' +
      '<div class="ml-acts">' + (ACC.length ? '<button class="pri" id="mcsave">💾 Save to Drafts in ' + esc((ACC.find(a => a.id === acct) || {}).email || 'your account') + '</button>' : '<button class="pri" id="mcconn">Connect an email account…</button>') + '<button class="ib" id="mcai">✨ Help me write</button><button class="ib" id="mcfix">✨ Check spelling &amp; tone</button><button class="ib" id="mclocal">Keep on this PC</button><button class="ib" id="mccopy">📋 Copy</button><button class="ib" id="mcx">Close</button></div><div id="mcaio" class="ml-ai" style="display:none"></div>' +
      '<div class="small mute" style="margin-top:6px">Moundshroud does not send email. Save it to Drafts, then send it from your phone or webmail.</div></div>';
    const v = () => ({ id, acct, to: r.querySelector('#mct').value, cc: r.querySelector('#mcc').value, subject: r.querySelector('#mcs').value, body: r.querySelector('#mcb').value, irt: d.irt || '', refs: d.refs || '' });
    r.querySelector('#mcx').onclick = () => { if (!ACC.length) return setup(); open ? show(open) : reader(null); };
    r.querySelector('#mccopy').onclick = () => A.copy(r.querySelector('#mcb').value);
    r.querySelector('#mclocal').onclick = async () => { const x = await api('draft/local', v()); if (x.ok) { d.id = x.draft.id; A.toast('Kept on this PC (💾 Drafts on this PC).'); } };
    const cn = r.querySelector('#mcconn'); if (cn) cn.onclick = async () => { await api('draft/local', v()); A.toast('Your draft is kept on this PC.'); setup(); };
    if (r.querySelector('#mcsave')) r.querySelector('#mcsave').onclick = async () => { const x = v(); if (!x.to.trim() && !(await A.confirm('There is no one in To yet. Save anyway?'))) return; const b = r.querySelector('#mcsave'); b.disabled = true; const res = await api('draft/save', x).catch(e => ({ error: e.message })); b.disabled = false; if (res.error) { A.toast(res.error); await api('draft/local', x); A.toast('Kept on this PC instead.'); return; } if (id) api('draft/drop', { id }); A.toast('Saved to ' + res.folder + '. Send it from your phone or webmail.'); };
    const o = r.querySelector('#mcaio');
    r.querySelector('#mcai').onclick = async () => { const want = (await A.prompt('What should the email say?')); if (!want) return; o.style.display = ''; const t = await aiInto(o, [{ role: 'system', content: 'Write an email body for the user from their notes. Plain text, friendly and clear, no subject line, no placeholders unless needed. Sign off without a name.' }, { role: 'user', content: (r.querySelector('#mcs').value ? 'Subject: ' + r.querySelector('#mcs').value + '\n' : '') + 'To: ' + r.querySelector('#mct').value + '\nWhat to say: ' + want }]); if (t) { const tb = r.querySelector('#mcb'); tb.value = t.trim() + (tb.value ? '\n\n' + tb.value : ''); o.style.display = 'none'; } };
    r.querySelector('#mcfix').onclick = () => { const body = r.querySelector('#mcb').value.split(/\n\n\nOn .* wrote:\n/)[0]; if (!body.trim()) return; o.style.display = ''; aiInto(o, [{ role: 'system', content: 'Check this email draft. List spelling or grammar mistakes with fixes, then one line on the tone (and anything that could be misread). Be brief. Do not rewrite the whole email.' }, { role: 'user', content: body.slice(0, 8000) }]); };
    setTimeout(() => { const f = r.querySelector(d.to ? '#mcb' : '#mct'); if (f) f.focus(); }, 50);
  }
  async function localDrafts() {
    const r = await api('drafts'), l = root.querySelector('#mlread');
    l.innerHTML = '<div class="ml-rh"><h2 style="margin:0 0 8px;font-size:18px">💾 Drafts on this PC</h2>' + (r.drafts.length ? r.drafts.map(d => '<div class="ml-it" data-d="' + d.id + '"><div class="ml-row1"><span class="ml-from">' + esc(d.to || '(no one yet)') + '</span><span class="ml-date">' + when(d.at) + '</span></div><div class="ml-sub">' + esc(d.subject || '(no subject)') + '</div></div>').join('') : '<div class="mute">None.</div>') + '</div>';
    l.querySelectorAll('[data-d]').forEach(e => e.onclick = () => compose(r.drafts.find(d => d.id === e.dataset.d)));
  }

  /* ---------- the inbox brief: from senders and subjects only ---------- */
  async function brief() {
    const l = root.querySelector('#mlread'); l.innerHTML = '<div class="ml-rh"><h2 style="margin:0 0 8px;font-size:18px">✨ Inbox brief</h2><div class="small mute" style="margin-bottom:8px">From the senders and subjects of your newest ' + Math.min(40, items.length) + ' messages, by your local AI. It has not read the messages themselves.</div><div id="mlbr" class="ml-ai"></div></div>';
    if (!items.length) { l.querySelector('#mlbr').textContent = 'There is no mail here yet.'; return; }
    aiInto(l.querySelector('#mlbr'), [{ role: 'system', content: 'You help someone triage their inbox from a list of messages (sender, subject, date, unread). Group them: **Needs you** (people asking, deadlines, bills, appointments, security alerts), **Worth a look**, **Can wait or ignore** (newsletters, promotions). One short line each, naming the sender. Point out anything that looks like a scam. Be brief.' }, { role: 'user', content: items.slice(0, 40).map(m => (m.seen ? '' : '[unread] ') + when(m.date) + ' — ' + who(m.from) + ' <' + (m.from.email || '') + '> — ' + m.subject + (m.news ? ' (newsletter)' : '')).join('\n') }]);
  }

  /* a draft asked for from elsewhere (the chat AI, Ctrl+K) waits until Mail has finished opening */
  A.mail = { open: () => A.showTab('mail'), compose: d => { A.showTab('mail'); setTimeout(async () => { if (!ready) ready = start(); await ready; compose(d || {}); }, 50); } };
  A.registerTab('mail', 'Mail', () => { if (!ready) ready = start(); else if (!built && !root.querySelector('.scroll')) ready = start(); });
  try { if (A.cmd && A.cmd.reg) A.cmd.reg([{ title: 'Mail', sub: 'Read your email and write drafts', icon: '✉️', group: 'Go to', tags: 'mail email inbox gmail messages', run: () => A.showTab('mail') }, { title: 'New email draft', icon: '✍', group: 'Do', tags: 'write email compose draft mail', run: () => A.mail.compose({}) }]); } catch (e) { }
})();

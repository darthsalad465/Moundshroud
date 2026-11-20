// Packet Tracer simulator, part 10: the logical workspace. Toolbar, canvas with devices, cables and link lights,
// the device palette, cabling with port menus, delete/inspect/note/Simple PDU tools, pan and zoom, the PDU list,
// save/open/import/export of topologies, and the starter labs panel. A.cyberLabs.ptracer mounts it in the Cyber tab.
(() => {
  const P = window.PTSim, ip = P.ip;
  const esc = t => String(t == null ? '' : t).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const LS = { get(k, d) { try { const v = localStorage.getItem(k); return v == null ? d : JSON.parse(v); } catch (e) { return d; } }, set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) { } } };
  const toast = m => { if (typeof A !== 'undefined' && A.toast) A.toast(m); };
  const TB = { new: '<path d="M6 3h8l5 5v13H6z" fill="none" stroke="currentColor" stroke-width="1.8"/>', open: '<path d="M3 7h7l2 2h9v10H3z" fill="none" stroke="currentColor" stroke-width="1.8"/>', save: '<path d="M5 4h12l3 3v13H5z M8 4v5h8V4 M8 20v-6h8v6" fill="none" stroke="currentColor" stroke-width="1.8"/>', exp: '<path d="M12 4v11m-4-4 4 4 4-4M5 19h14" fill="none" stroke="currentColor" stroke-width="1.8"/>', sel: '<path d="M6 3l12 9-6 1 3 7-2 1-3-7-4 4z" fill="currentColor"/>', note: '<path d="M5 4h14v12l-4 4H5z M15 20v-4h4" fill="none" stroke="currentColor" stroke-width="1.8"/>', del: '<path d="M6 7h12l-1 13H7zM4 7h16M9 7V4h6v3" fill="none" stroke="currentColor" stroke-width="1.8"/>', insp: '<circle cx="10" cy="10" r="6" fill="none" stroke="currentColor" stroke-width="2"/><path d="M15 15l5 5" stroke="currentColor" stroke-width="2.4"/>', pdu: '<path d="M3 6h18v12H3z M3 6l9 7 9-7" fill="none" stroke="currentColor" stroke-width="1.8"/>', zin: '<circle cx="10" cy="10" r="6" fill="none" stroke="currentColor" stroke-width="2"/><path d="M15 15l5 5M7 10h6M10 7v6" stroke="currentColor" stroke-width="2"/>', zout: '<circle cx="10" cy="10" r="6" fill="none" stroke="currentColor" stroke-width="2"/><path d="M15 15l5 5M7 10h6" stroke="currentColor" stroke-width="2"/>', full: '<path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5" fill="none" stroke="currentColor" stroke-width="2"/>', lab: '<path d="M9 3h6M10 3v6l-5 10a1 1 0 0 0 1 2h12a1 1 0 0 0 1-2l-5-10V3" fill="none" stroke="currentColor" stroke-width="1.8"/>', tag: '<path d="M3 12l9-9h8v8l-9 9z" fill="none" stroke="currentColor" stroke-width="1.8"/><circle cx="16" cy="8" r="1.6" fill="currentColor"/>' };
  const tbi = k => '<svg viewBox="0 0 24 24">' + TB[k] + '</svg>';

  class UI {
    constructor(el) {
      this.el = el; this.tool = 'select'; this.view = { x: -40, y: -20, s: 1 }; this.sel = null; this.wins = {}; this.sessions = {}; this.logBuf = {};
      this.pdus = []; this.showPorts = LS.get('pt_ports', true); this.cat = 'router'; this.name = 'Untitled'; this.envs = []; this.simOn = false; this.filters = LS.get('pt_filt', { ICMP: 1, ARP: 1, DHCP: 1, DNS: 1, HTTP: 1, TCP: 1, TELNET: 1, SSH: 1, UDP: 1 });
      this.mount();
      const cur = LS.get('pt_current', null); let n = null;
      if (cur) try { n = P.load(cur.data); this.name = cur.name || 'Untitled'; } catch (e) { n = null; }
      this.setNet(n || new P.Net(), n ? this.name : 'Untitled', n && n.lab);
      this.timer = setInterval(() => { if (!this.el.isConnected) return; if (this.net.ver !== this._drawnVer) this.draw(); this.clock(); }, 700);
    }
    $(s) { return this.el.querySelector(s); }
    mount() {
      const t = (k, id, label, title) => '<button class="pt-tb" data-act="' + id + '" title="' + esc(title || label) + '">' + tbi(k) + '<span>' + label + '</span></button>';
      this.el.innerHTML = '<div class="pt-root" tabindex="0">' +
        '<div class="pt-top">' + t('new', 'new', 'New') + t('open', 'open', 'Open') + t('save', 'save', 'Save') + t('exp', 'export', 'Export', 'Download the topology as a .mspt file') + t('lab', 'labs', 'Labs', 'Starter labs with activity checks') + '<span class="pt-sep"></span>' +
        t('sel', 't:select', 'Select', 'Select and move (Esc)') + t('note', 't:note', 'Note', 'Place a text note') + t('del', 't:delete', 'Delete', 'Delete a device, cable or note') + t('insp', 't:inspect', 'Inspect', 'Look at ARP, MAC, routing and NAT tables') + t('pdu', 't:pdu', 'Simple PDU', 'Click a source then a destination to send one ping') + '<span class="pt-sep"></span>' +
        t('zin', 'zin', '', 'Zoom in') + t('zout', 'zout', '', 'Zoom out') + t('tag', 'ports', 'Port labels', 'Always show port labels') + t('full', 'full', '', 'Fill the window') + '<span class="pt-title"></span></div>' +
        '<div class="pt-main"><div class="pt-cv"><svg class="pt-svg" xmlns="http://www.w3.org/2000/svg"><g class="pt-world"></g></svg></div><div class="pt-side" hidden></div></div>' +
        '<div class="pt-bot"><div class="pt-cats"></div><div class="pt-mods"><div class="pt-cap"></div><div class="pt-tiles"></div></div>' +
        '<div class="pt-rt"><div class="pt-modes"><button class="pt-btn pt-pri" data-act="realtime">⏱ Realtime</button><button class="pt-btn" data-act="sim">🎬 Simulation</button><span class="pt-clock"></span></div><div class="pt-pdus"></div></div></div></div>';
      this.root = this.$('.pt-root'); this.cv = this.$('.pt-cv'); this.svg = this.$('.pt-svg'); this.world = this.$('.pt-world'); this.side = this.$('.pt-side');
      this.root.addEventListener('click', e => { const b = e.target.closest('[data-act]'); if (b && this.root.contains(b)) this.act(b.dataset.act, b, e); });
      this.root.addEventListener('keydown', e => this.key(e));
      this.bindCanvas(); this.palette();
    }
    act(a, b, e) {
      if (a.startsWith('t:')) return this.setTool(a.slice(2));
      if (a === 'new') return this.confirmLose(() => { this.lab = null; this.setNet(new P.Net(), 'Untitled'); });
      if (a === 'open') return this.openDialog();
      if (a === 'save') return this.saveAs();
      if (a === 'export') return this.exportFile();
      if (a === 'labs') return this.labsDialog();
      if (a === 'zin' || a === 'zout') { const r = this.cv.getBoundingClientRect(); return this.zoom(a === 'zin' ? 1.2 : 1 / 1.2, r.width / 2, r.height / 2); }
      if (a === 'ports') { this.showPorts = !this.showPorts; LS.set('pt_ports', this.showPorts); return this.draw(); }
      if (a === 'full') { this.root.classList.toggle('pt-full'); return this.draw(); }
      if (a === 'realtime') return this.setSim(false);
      if (a === 'sim') return this.setSim(true);
      if (a === 'pdufire') { const p = this.pdus[+b.dataset.i]; if (p) this.firePdu(p); return; }
      if (a === 'pdudel') { this.pdus.splice(+b.dataset.i, 1); return this.pduTable(); }
      if (a === 'pduclear') { this.pdus = []; return this.pduTable(); }
    }
    key(e) {
      const typing = e.target.closest('input,textarea,select,[contenteditable]');
      if (e.key === 'Escape') { const m = this.root.querySelector('.pt-modal:last-of-type'); if (m) { e.stopPropagation(); e.preventDefault(); m.remove(); return; } }
      if (e.key === 'Escape' && !typing) { e.stopPropagation(); e.preventDefault(); this.closePop(); if (this.tool !== 'select') this.setTool('select'); else if (this.root.classList.contains('pt-full')) this.root.classList.remove('pt-full'); return; }
      if (typing) return;
      if ((e.key === 'Delete' || e.key === 'Backspace') && this.sel) { e.preventDefault(); this.removeDev(this.sel); }
    }
    setTool(t, extra) {
      this.tool = t; this.cable = t === 'cable' ? { type: extra, a: null } : null; this.place = t === 'place' ? extra : null; this.pduPick = null; this.rubber = null;
      this.cv.className = 'pt-cv pt-c-' + t;
      this.root.querySelectorAll('[data-act^="t:"]').forEach(b => b.classList.toggle('pt-on', b.dataset.act === 't:' + t));
      this.root.querySelectorAll('.pt-tile').forEach(b => b.classList.toggle('pt-on', (t === 'place' && b.dataset.model === extra) || (t === 'cable' && b.dataset.cable === extra)));
      this.draw();
    }

    /* ---------- the network ---------- */
    setNet(n, name, labId) {
      Object.keys(this.wins).forEach(id => this.closeWin(id));
      if (this.unsub) this.unsub();
      this.net = n; this.name = name || 'Untitled'; this.sessions = {}; this.logBuf = {}; this.pdus = []; this.sel = null; this.envs = [];
      if (this.simOn) { n.sim = true; n.events = []; }
      this.unsub = n.on((k, d) => { if (k === 'log') this.devLog(d.dev, d.msg); });
      n.state();
      this.lab = labId ? P.LABS.find(L => L.id === labId) : null;
      this.$('.pt-title').textContent = this.name + (this.lab && this.lab.title !== this.name ? ' · ' + this.lab.title : '');
      this.sideRender(); this.pduTable(); this.fit(); this.draw(); this.autosave();
    }
    changed() { this.net.touch(); this.draw(); this.autosave(); Object.values(this.wins).forEach(w => w.refresh && w.refresh(false)); }
    autosave() { clearTimeout(this._as); this._as = setTimeout(() => { try { LS.set('pt_current', { name: this.name, data: P.save(this.net, { lab: this.lab ? this.lab.id : null }) }); } catch (e) { } }, 600); }
    confirmLose(fn) { if (!Object.keys(this.net.devs).length) return fn(); const go = ok => { if (ok) fn(); }; if (typeof A !== 'undefined' && A.confirm) A.confirm('Start over? Unsaved changes to "' + this.name + '" are lost.').then(go); else go(true); }
    session(d) {
      if (this.sessions[d.id]) return this.sessions[d.id];
      const s = new P.IOS(this.net, d, { via: 'console', out: t => { if (s.term) s.term.write(t); else { s.back = (s.back || '') + t; if (s.back.length > 20000) s.back = s.back.slice(-20000); } }, changed: () => this.changed(), ready: () => { if (s.term) s.term.ready(); } });
      this.sessions[d.id] = s; s.back = P.bootText(d);
      s.start(); if (this.logBuf[d.id]) { s.o(this.logBuf[d.id].join('')); delete this.logBuf[d.id]; }
      return s;
    }
    devLog(id, msg) {
      const s = this.sessions[id];
      if (s) { s.o('\n' + msg + '\n'); if (s.term) s.term.ready(); }
      else { const b = this.logBuf[id] = this.logBuf[id] || []; b.push('\n' + msg + '\n'); if (b.length > 40) b.shift(); }
    }
    addDev(model, x, y) { const d = this.net.add(model, x, y); if (P.isIOS(d)) d.cfg.hostname = d.name.replace(/\s+/g, ''); this.sel = d.id; this.changed(); return d; }
    removeDev(id) { this.closeWin(id); delete this.sessions[id]; this.pdus = this.pdus.filter(p => p.src !== id && p.dst !== id); this.net.remove(id); if (this.sel === id) this.sel = null; this.pduTable(); this.changed(); }

    /* ---------- palette ---------- */
    palette() {
      const cats = this.$('.pt-cats');
      cats.innerHTML = P.PALETTE.map(([k, label]) => '<button class="pt-cat' + (k === this.cat ? ' pt-on' : '') + '" data-cat="' + k + '" title="' + label + '">' + P.icon(k === 'end' ? 'pc' : k, 30) + '</button>').join('');
      cats.onclick = e => { const b = e.target.closest('[data-cat]'); if (!b) return; this.cat = b.dataset.cat; cats.querySelectorAll('.pt-cat').forEach(x => x.classList.toggle('pt-on', x === b)); this.tiles(); };
      this.tiles();
    }
    tiles() {
      const c = P.PALETTE.find(x => x[0] === this.cat), box = this.$('.pt-tiles');
      this.$('.pt-cap').textContent = c[1] + (c[0] === 'cable' ? ': pick a cable, then click two devices' : ': drag onto the workspace, or click then click the workspace');
      box.innerHTML = c[2].map(m => c[0] === 'cable' ? '<button class="pt-tile" data-cable="' + m + '" title="' + esc(P.CABLES[m]) + '">' + P.cableIcon(m) + '<span>' + esc(P.CABLES[m].replace('Copper ', '')) + '</span></button>'
        : '<button class="pt-tile" data-model="' + m + '" title="' + esc(P.MODELS[m].desc) + '">' + P.icon(P.iconKey({ model: m, type: P.MODELS[m].type }), 40) + '<span>' + esc(P.MODELS[m].label) + '</span></button>').join('');
      box.onpointerdown = e => {
        const b = e.target.closest('.pt-tile'); if (!b) return;
        if (b.dataset.cable) return this.setTool('cable', b.dataset.cable);
        const m = b.dataset.model, sx = e.clientX, sy = e.clientY; let ghost = null;
        const mv = ev => { if (!ghost && Math.hypot(ev.clientX - sx, ev.clientY - sy) > 6) { ghost = document.createElement('div'); ghost.style.cssText = 'position:fixed;pointer-events:none;z-index:9999;opacity:.8'; ghost.innerHTML = P.icon(P.iconKey({ model: m, type: P.MODELS[m].type }), 48); document.body.appendChild(ghost); } if (ghost) { ghost.style.left = ev.clientX - 24 + 'px'; ghost.style.top = ev.clientY - 24 + 'px'; } };
        const up = ev => {
          document.removeEventListener('pointermove', mv); document.removeEventListener('pointerup', up);
          if (ghost) { ghost.remove(); const r = this.cv.getBoundingClientRect(); if (ev.clientX >= r.left && ev.clientX <= r.right && ev.clientY >= r.top && ev.clientY <= r.bottom) { const w = this.toWorld(ev); this.addDev(m, w.x, w.y); this.setTool('select'); } }
          else this.setTool('place', m);
        };
        document.addEventListener('pointermove', mv); document.addEventListener('pointerup', up);
      };
    }

    /* ---------- canvas ---------- */
    toWorld(e) { const r = this.cv.getBoundingClientRect(); return { x: (e.clientX - r.left) / this.view.s + this.view.x, y: (e.clientY - r.top) / this.view.s + this.view.y }; }
    toScreen(x, y) { return { x: (x - this.view.x) * this.view.s, y: (y - this.view.y) * this.view.s }; }
    zoom(f, cx, cy) { const v = this.view, s2 = Math.max(.3, Math.min(3, v.s * f)); const wx = cx / v.s + v.x, wy = cy / v.s + v.y; v.s = s2; v.x = wx - cx / s2; v.y = wy - cy / s2; this.draw(); }
    fit() {
      const ds = Object.values(this.net.devs); const r = this.cv.getBoundingClientRect(); if (!ds.length || !r.width) { this.view = { x: -40, y: -20, s: 1 }; return; }
      const xs = ds.map(d => d.x), ys = ds.map(d => d.y), w = Math.max(...xs) - Math.min(...xs) + 160, h = Math.max(...ys) - Math.min(...ys) + 160;
      const s = Math.max(.4, Math.min(1.3, Math.min(r.width / w, r.height / h)));
      this.view = { s, x: (Math.min(...xs) + Math.max(...xs)) / 2 - r.width / s / 2, y: (Math.min(...ys) + Math.max(...ys)) / 2 - r.height / s / 2 };
    }
    bindCanvas() {
      const sv = this.svg;
      sv.addEventListener('pointerdown', e => this.down(e));
      sv.addEventListener('pointermove', e => this.move(e));
      sv.addEventListener('pointerup', e => this.up(e));
      sv.addEventListener('wheel', e => { e.preventDefault(); const r = this.cv.getBoundingClientRect(); this.zoom(e.deltaY < 0 ? 1.1 : 1 / 1.1, e.clientX - r.left, e.clientY - r.top); }, { passive: false });
      sv.addEventListener('pointerover', e => { const g = e.target.closest('[data-dev]'); clearTimeout(this._tipT); if (g && this.tool === 'select' && !this.drag) this._tipT = setTimeout(() => this.tip(g.dataset.dev, e), 450); else if (!g) this.hideTip(); });
      sv.addEventListener('pointerleave', () => { clearTimeout(this._tipT); this.hideTip(); });
      sv.addEventListener('dblclick', e => { const g = e.target.closest('[data-note]'); if (g) this.editNote(+g.dataset.note); });
    }
    down(e) {
      this.root.focus({ preventScroll: true }); this.closePop(); this.hideTip(); clearTimeout(this._tipT);
      const g = e.target.closest('[data-dev],[data-link],[data-note]'), w = this.toWorld(e);
      const dev = g && g.dataset.dev ? this.net.devs[g.dataset.dev] : null, link = g && g.dataset.link, note = g && g.dataset.note != null ? +g.dataset.note : null;
      const t = this.tool;
      if (t === 'select') {
        if (dev) { this.drag = { id: dev.id, ox: w.x - dev.x, oy: w.y - dev.y, sx: e.clientX, sy: e.clientY, moved: false }; this.sel = dev.id; }
        else if (note != null) { const nn = this.net.notes[note]; this.drag = { note, ox: w.x - nn.x, oy: w.y - nn.y, sx: e.clientX, sy: e.clientY, moved: false }; }
        else { this.pan = { sx: e.clientX, sy: e.clientY, vx: this.view.x, vy: this.view.y }; this.sel = null; }
        this.svg.setPointerCapture(e.pointerId); this.draw(); return;
      }
      if (t === 'place') { this.addDev(this.place, w.x, w.y); if (!e.shiftKey) this.setTool('select'); return; }
      if (t === 'delete') { if (dev) this.removeDev(dev.id); else if (link) { this.net.unlink(link); this.changed(); } else if (note != null) { this.net.notes.splice(note, 1); this.changed(); } return; }
      if (t === 'note') { if (!dev) this.addNote(w); return; }
      if (t === 'inspect') { if (dev) this.inspect(dev, e); return; }
      if (t === 'pdu') { if (dev) this.pickPdu(dev); return; }
      if (t === 'cable') { if (dev) this.pickCable(dev, e); else { this.cable.a = null; this.rubber = null; this.draw(); } }
    }
    move(e) {
      const w = this.toWorld(e);
      if (this.drag) {
        if (!this.drag.moved && Math.hypot(e.clientX - this.drag.sx, e.clientY - this.drag.sy) < 4) return;
        this.drag.moved = true;
        const o = this.drag.note != null ? this.net.notes[this.drag.note] : this.net.devs[this.drag.id];
        if (o) { o.x = Math.round(w.x - this.drag.ox); o.y = Math.round(w.y - this.drag.oy); this.draw(); }
      } else if (this.pan) { this.view.x = this.pan.vx - (e.clientX - this.pan.sx) / this.view.s; this.view.y = this.pan.vy - (e.clientY - this.pan.sy) / this.view.s; this.draw(); }
      else if (this.cable && this.cable.a) { this.rubber = w; this.draw(); }
    }
    up(e) {
      const d = this.drag; this.drag = null; this.pan = null;
      if (d && !d.moved && d.id) this.openWin(this.net.devs[d.id]);
      if (d && d.moved) this.autosave();
    }

    /* ---------- drawing ---------- */
    draw() {
      if (this._raf) return;
      /* animation frames pause in hidden windows, so a timer backs them up */
      const go = () => { if (!this._raf) return; cancelAnimationFrame(this._raf); clearTimeout(this._rafT); this._raf = null; this.render(); };
      this._raf = requestAnimationFrame(go); this._rafT = setTimeout(go, 120);
    }
    portLight(d, port) {
      const p = d.ports[port], n = this.net; if (!p) return 'down';
      if (d.type === 'ap' && port === 'Port 1') return 'up';
      if (!n.portUp(d, port)) return 'down';
      if (d.type === 'switch' && !n.fwd(d, port)) return 'blk';
      return 'up';
    }
    render() {
      const n = this.net, v = this.view; n.state(); this._drawnVer = n.ver;
      this.world.setAttribute('transform', 'scale(' + v.s + ') translate(' + (-v.x) + ',' + (-v.y) + ')');
      const out = [];
      for (const L of Object.values(n.links)) {
        const a = n.devs[L.a.dev], b = n.devs[L.b.dev]; if (!a || !b) continue;
        const dx = b.x - a.x, dy = b.y - a.y, len = Math.hypot(dx, dy) || 1, ux = dx / len, uy = dy / len;
        out.push('<g data-link="' + L.id + '"><line class="pt-lhit" x1="' + a.x + '" y1="' + a.y + '" x2="' + b.x + '" y2="' + b.y + '"/><line class="pt-ln pt-l-' + L.type + '" x1="' + a.x + '" y1="' + a.y + '" x2="' + b.x + '" y2="' + b.y + '"/>');
        if (L.type === 'serial') { const mx = (a.x + b.x) / 2, my = (a.y + b.y) / 2; out.push('<path d="M' + (mx - 7 * uy - 5 * ux) + ' ' + (my + 7 * ux - 5 * uy) + 'L' + (mx + 4 * uy) + ' ' + (my - 4 * ux) + 'L' + (mx - 4 * uy) + ' ' + (my + 4 * ux) + 'L' + (mx + 7 * uy + 5 * ux) + ' ' + (my - 7 * ux + 5 * uy) + '" stroke="#ff5a5f" stroke-width="2.2" fill="none"/>'); }
        if (L.type !== 'console' && len > 80) {
          for (const [end, dv, sgn] of [[L.a, a, 1], [L.b, b, -1]]) {
            const lx = dv.x + ux * 34 * sgn, ly = dv.y + uy * 34 * sgn, st = this.portLight(dv, end.port);
            out.push('<path class="pt-lt-' + st + '" d="M' + (lx + ux * 5 * sgn) + ' ' + (ly + uy * 5 * sgn) + 'L' + (lx - uy * 4.5 - ux * 3 * sgn) + ' ' + (ly + ux * 4.5 - uy * 3 * sgn) + 'L' + (lx + uy * 4.5 - ux * 3 * sgn) + ' ' + (ly - ux * 4.5 - uy * 3 * sgn) + 'Z"/>');
            if (this.showPorts) out.push('<text class="pt-plab" x="' + (dv.x + ux * 62 * sgn) + '" y="' + (dv.y + uy * 62 * sgn + 3) + '">' + esc(P.ifShort(end.port)) + '</text>');
          }
        }
        out.push('</g>');
      }
      if (this.cable && this.cable.a && this.rubber) { const a = n.devs[this.cable.a.dev]; if (a) out.push('<line class="pt-rubber" x1="' + a.x + '" y1="' + a.y + '" x2="' + this.rubber.x + '" y2="' + this.rubber.y + '"/>'); }
      for (const d of Object.values(n.devs)) {
        const pick = (this.pduPick && this.pduPick.src === d.id) || (this.cable && this.cable.a && this.cable.a.dev === d.id);
        out.push('<g class="pt-dev' + (this.sel === d.id || pick ? ' pt-sel' : '') + (d.power ? '' : ' pt-off') + '" data-dev="' + d.id + '" transform="translate(' + d.x + ',' + d.y + ')"><rect class="pt-hl" x="-34" y="-34" width="68" height="84" rx="8"/><g class="pt-ico" transform="translate(-24,-30)">' + P.iconInner(P.iconKey(d)) + '</g><text class="pt-model" y="30">' + esc(P.MODELS[d.model].label) + '</text><text y="44">' + esc(d.name) + '</text></g>');
      }
      n.notes.forEach((nt, k) => { const w = Math.max(40, Math.min(260, nt.text.length * 6.6 + 14)); out.push('<g class="pt-note" data-note="' + k + '" transform="translate(' + nt.x + ',' + nt.y + ')"><rect x="0" y="-15" width="' + w + '" height="22" rx="4"/><text x="7" y="0">' + esc(nt.text.slice(0, 40)) + '</text></g>'); });
      for (const e of this.envs) out.push('<g class="pt-env" transform="translate(' + e.x + ',' + e.y + ')"><rect x="-11" y="-8" width="22" height="16" rx="2" fill="' + e.color + '" stroke="#222" stroke-width="1.2"/><path d="M-11 -8 L0 1 L11 -8" stroke="#222" stroke-width="1.2" fill="none"/></g>');
      if (!Object.keys(n.devs).length) out.push('<text x="' + (v.x + this.cv.clientWidth / v.s / 2) + '" y="' + (v.y + this.cv.clientHeight / v.s / 2) + '" text-anchor="middle" fill="var(--mute)" font-size="15">Drag a router, switch or PC from the bar below, or open a starter lab (Labs).</text>');
      this.world.innerHTML = out.join('');
    }
    clock() { const c = this.$('.pt-clock'); if (c) c.textContent = (this.simOn ? 'Sim ' : '') + 'Time: ' + this.fmtT(this.net.t); }
    fmtT(t) { const s = Math.floor(t / 10); return String(Math.floor(s / 3600)).padStart(2, '0') + ':' + String(Math.floor(s / 60) % 60).padStart(2, '0') + ':' + String(s % 60).padStart(2, '0'); }

    /* ---------- popups ---------- */
    popAt(e, html, onPick) {
      this.closePop(); const r = this.root.getBoundingClientRect(), pop = document.createElement('div'); pop.className = 'pt-pop'; pop.innerHTML = html;
      this.root.appendChild(pop); let x = e.clientX - r.left + 6, y = e.clientY - r.top + 6;
      x = Math.min(x, r.width - pop.offsetWidth - 6); y = Math.min(y, r.height - pop.offsetHeight - 6); pop.style.left = Math.max(4, x) + 'px'; pop.style.top = Math.max(4, y) + 'px';
      pop.onpointerdown = ev => ev.stopPropagation();
      pop.onclick = ev => { const it = ev.target.closest('[data-v]'); if (!it || it.classList.contains('pt-dis')) return; this.closePop(); onPick(it.dataset.v); };
      this.pop = pop;
    }
    closePop() { if (this.pop) { this.pop.remove(); this.pop = null; } }
    tip(id, e) {
      const d = this.net.devs[id]; if (!d) return; this.hideTip();
      const rows = [d.name + '  (' + P.MODELS[d.model].label + ')'];
      for (const i of this.net.l3(d)) if (i.kind !== 'lo' || i.ip != null) rows.push(P.ifShort(i.name).padEnd(12) + (i.up ? 'Up   ' : 'Down ') + (i.ip != null ? ip.str(i.ip) + '/' + ip.len(i.mask) : '<not set>'));
      if (d.type === 'switch') { const used = Object.values(d.ports).filter(p => p.link); rows.push('Ports in use: ' + used.length + ' of ' + (Object.keys(d.ports).length - 1)); }
      if (d.host) rows.push('Gateway: ' + (d.host.gw != null ? ip.str(d.host.gw) : '<not set>') + (d.host.dhcp ? '  (DHCP)' : ''));
      const t = document.createElement('div'); t.className = 'pt-tip'; t.textContent = rows.join('\n'); this.root.appendChild(t);
      const r = this.root.getBoundingClientRect(); t.style.left = Math.min(e.clientX - r.left + 14, r.width - t.offsetWidth - 8) + 'px'; t.style.top = Math.min(e.clientY - r.top + 14, r.height - t.offsetHeight - 8) + 'px';
      this.tipEl = t;
    }
    hideTip() { if (this.tipEl) { this.tipEl.remove(); this.tipEl = null; } }

    /* ---------- cables ---------- */
    pickCable(dev, e) {
      const c = this.cable, need = { console: 'console', serial: 'serial', straight: 'copper', cross: 'copper', fiber: 'fiber' }[c.type];
      if (c.type === 'auto') {
        if (!c.a) { c.a = { dev: dev.id }; this.draw(); return; }
        if (c.a.dev === dev.id) return;
        const A2 = this.net.devs[c.a.dev], pref = p => p.kind === 'console' || p.kind === 'rs232' ? 9 : p.kind === 'serial' ? 5 : p.kind === 'wlan' || p.kind === 'wap' ? 10 : 0;
        const pa = Object.values(A2.ports).filter(p => !p.link).sort((x, y) => pref(x) - pref(y)), pb = Object.values(dev.ports).filter(p => !p.link).sort((x, y) => pref(x) - pref(y));
        for (const x of pa) for (const y of pb) { if (pref(x) >= 9 || pref(y) >= 9) continue; const r = this.net.cableFor(A2.id, x.name, dev.id, y.name, 'auto'); if (!r.err) { this.net.link(A2.id, x.name, dev.id, y.name, r.type); this.changed(); this.setTool('select'); return; } }
        toast('No free ports fit between ' + A2.name + ' and ' + dev.name + '.'); this.setTool('select'); return;
      }
      const ports = Object.values(dev.ports).filter(p => p.kind !== 'wap');
      const html = '<div class="pt-ph">' + esc(dev.name) + ' · ' + esc(P.CABLES[c.type]) + '</div>' + ports.map(p => { const okk = !p.link && p.media.includes(need) && (c.type !== 'console' || p.kind === 'console' || p.kind === 'rs232'); return '<div data-v="' + esc(p.name) + '" class="' + (okk ? '' : 'pt-dis') + '">' + (p.link ? '● ' : '○ ') + esc(p.name) + '</div>'; }).join('');
      this.popAt(e, html, port => {
        if (!c.a) { c.a = { dev: dev.id, port }; this.draw(); return; }
        if (c.a.dev === dev.id) return;
        const r = this.net.link(c.a.dev, c.a.port, dev.id, port, c.type);
        if (r.err) toast(r.err); else this.changed();
        this.setTool('select');
      });
    }

    /* ---------- notes ---------- */
    async addNote(w) { const t = await A.prompt('Note text', ''); if (t) { this.net.notes.push({ x: Math.round(w.x), y: Math.round(w.y), text: String(t).slice(0, 200) }); this.changed(); } this.setTool('select'); }
    async editNote(k) { const nt = this.net.notes[k]; if (!nt) return; const t = await A.prompt('Note text', nt.text); if (t != null) { if (t) nt.text = String(t).slice(0, 200); else this.net.notes.splice(k, 1); this.changed(); } }

    /* ---------- inspect ---------- */
    inspect(d, e) {
      const items = [['arp', 'ARP Table']]; if (d.type === 'switch' || d.type === 'cloud' || d.type === 'ap') items.push(['mac', 'MAC Table']); if (P.isIOS(d) && d.cfg.ipRouting) items.push(['route', 'Routing Table']); if (d.type === 'router') items.push(['nat', 'NAT Table']); items.push(['ports', 'Port Status Summary']);
      this.popAt(e, '<div class="pt-ph">Inspect ' + esc(d.name) + '</div>' + items.map(([k, l]) => '<div data-v="' + k + '">' + l + '</div>').join(''), k => {
        let txt = '';
        const fake = { net: this.net, d, hist: [], ln: t => { txt += t + '\n'; } };
        const show = cmd => { const w = P.iosWalk(P.iosTree('priv'), cmd); if (w.n && w.n.end) w.n.end(fake, w.vals); };
        if (k === 'arp') { if (P.isIOS(d)) show('show arp'); else txt = 'IP Address        Hardware Address   Interface\n' + Object.entries(d.arp).map(([a, x]) => ip.str(+a).padEnd(18) + P.macDot(x.mac).padEnd(19) + x.ifn).join('\n'); }
        if (k === 'mac') { if (d.type === 'switch') show('show mac address-table'); else txt = 'MAC Address       Port\n' + Object.entries(d.mac).map(([m, x]) => P.macDot(m).padEnd(18) + x.port).join('\n'); }
        if (k === 'route') show('show ip route');
        if (k === 'nat') show('show ip nat translations');
        if (k === 'ports') txt = 'Port                  Link   IP Address\n' + Object.values(d.ports).filter(p => p.kind !== 'wap').map(p => p.name.padEnd(22) + (this.net.portUp(d, p.name) ? 'Up     ' : 'Down   ') + (p.ip != null ? ip.str(p.ip) + '/' + ip.len(p.mask) : '')).join('\n');
        this.dialog('🔍 ' + d.name + ': ' + items.find(x => x[0] === k)[1], '<pre class="pt-tbl" style="white-space:pre;margin:0;border:0">' + esc(txt || '(empty)') + '</pre>');
      });
    }

    /* ---------- Simple PDUs ---------- */
    pickPdu(d) {
      if (!this.pduPick) { if (P.primaryIp(this.net, d) == null) return toast(d.name + ' has no IP address yet.'); this.pduPick = { src: d.id }; this.draw(); return; }
      if (d.id === this.pduPick.src) return;
      const dst = P.primaryIp(this.net, d); if (dst == null) { toast(d.name + ' has no IP address yet.'); return; }
      const colors = Object.values(P.TYPE_COLORS);
      const p = { src: this.pduPick.src, dst: d.id, dstIp: dst, status: '', color: ['#f43f5e', '#22c55e', '#3b82f6', '#eab308', '#a855f7', '#14b8a6'][this.pdus.length % 6], t: 0, n: this.pdus.length + 1 };
      this.pdus.push(p); this.pduPick = null; this.setTool('select'); this.firePdu(p);
    }
    firePdu(p) {
      const s = this.net.devs[p.src]; if (!s) return;
      p.status = 'In Progress'; p.t = this.net.t; this.pduTable();
      this.net.ping(s, p.dstIp, { count: 1, onDone: st => { p.status = st.got ? 'Successful' : 'Failed'; this.pduTable(); } });
      if (!this.simOn) this.net.runAll(); else this.simKick && this.simKick();
    }
    pduTable() {
      const box = this.$('.pt-pdus'); if (!box) return;
      if (!this.pdus.length) { box.innerHTML = '<div class="pt-mute" style="padding:8px 10px">No user-created PDUs. Use <b>Simple PDU</b> in the toolbar: click a source, then a destination.</div>'; return; }
      box.innerHTML = '<table><tr><th>Fire</th><th>Last Status</th><th>Source</th><th>Destination</th><th>Type</th><th>Color</th><th>Time</th><th></th></tr>' + this.pdus.map((p, k) => { const a = this.net.devs[p.src], b = this.net.devs[p.dst]; return '<tr><td><button class="pt-btn" data-act="pdufire" data-i="' + k + '" title="Fire again">●</button></td><td class="' + (p.status === 'Successful' ? 'pt-ok' : p.status === 'Failed' ? 'pt-bad' : 'pt-mute') + '">' + esc(p.status) + '</td><td>' + esc(a ? a.name : '?') + '</td><td>' + esc(b ? b.name : ip.str(p.dstIp)) + '</td><td>ICMP</td><td><span class="pt-sw" style="background:' + p.color + '"></span></td><td>' + this.fmtT(p.t) + '</td><td><button class="pt-btn" data-act="pdudel" data-i="' + k + '" title="Delete">✕</button></td></tr>'; }).join('') + '</table>';
    }

    /* ---------- dialogs, files and labs ---------- */
    dialog(title, html, wide) {
      const m = document.createElement('div'); m.className = 'pt-modal'; m.innerHTML = '<div class="pt-dlg" style="' + (wide ? 'width:min(820px,96%)' : '') + '"><h2>' + esc(title) + '<button data-x title="Close">✕</button></h2><div class="pt-db">' + html + '</div></div>';
      this.root.appendChild(m); const close = () => m.remove();
      m.addEventListener('click', e => { if (e.target === m || e.target.closest('[data-x]')) close(); });
      m.addEventListener('keydown', e => { if (e.key === 'Escape') { e.stopPropagation(); close(); } });
      return { el: m.querySelector('.pt-db'), close };
    }
    saves() { return LS.get('pt_saves', {}); }
    async saveAs() {
      const nm = await A.prompt('Save topology as', this.name === 'Untitled' ? '' : this.name);
      if (!nm) return; const s = this.saves(); s[nm] = { t: Date.now(), data: P.save(this.net, { lab: this.lab ? this.lab.id : null }) }; LS.set('pt_saves', s); this.name = nm; this.$('.pt-title').textContent = nm; this.autosave(); toast('Saved "' + nm + '" in Moundshroud.');
    }
    exportFile() {
      const blob = new Blob([P.save(this.net, { lab: this.lab ? this.lab.id : null })], { type: 'application/json' }), a = document.createElement('a');
      a.href = URL.createObjectURL(blob); a.download = (this.name || 'topology').replace(/[^\w.-]+/g, '_') + '.mspt'; document.body.appendChild(a); a.click(); setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 500);
    }
    openDialog() {
      const s = this.saves(), names = Object.keys(s).sort((a, b) => s[b].t - s[a].t);
      const dl = this.dialog('📂 Open a topology', '<div style="display:flex;gap:8px;margin-bottom:10px"><button class="pt-btn pt-pri" data-o="new">New blank workspace</button><button class="pt-btn" data-o="imp">Import a .mspt file…</button><input type="file" accept=".mspt,.json,application/json" hidden></div>' +
        (names.length ? names.map(nm => '<div class="pt-card"><div><b>' + esc(nm) + '</b><small>Saved ' + new Date(s[nm].t).toLocaleString() + '</small></div><button class="pt-btn pt-pri" data-o="open" data-n="' + esc(nm) + '">Open</button><button class="pt-btn" data-o="del" data-n="' + esc(nm) + '">Delete</button></div>').join('') : '<div class="pt-mute">No saved topologies yet. Use <b>Save</b> in the toolbar.</div>'));
      const fi = dl.el.querySelector('input[type=file]');
      fi.onchange = () => { const f = fi.files[0]; if (!f) return; f.text().then(t => { try { const n = P.load(t); dl.close(); this.lab = null; this.setNet(n, f.name.replace(/\.(mspt|json)$/i, ''), n.lab); } catch (e) { toast(e.message); } }); };
      dl.el.addEventListener('click', e => {
        const b = e.target.closest('[data-o]'); if (!b) return; const o = b.dataset.o, nm = b.dataset.n;
        if (o === 'new') { dl.close(); this.setNet(new P.Net(), 'Untitled'); }
        if (o === 'imp') fi.click();
        if (o === 'open') { try { const n = P.load(s[nm].data); dl.close(); this.setNet(n, nm, n.lab); } catch (er) { toast(er.message); } }
        if (o === 'del') { const s2 = this.saves(); delete s2[nm]; LS.set('pt_saves', s2); b.closest('.pt-card').remove(); }
      });
    }
    labsDialog() {
      const dl = this.dialog('🧪 Starter labs', '<div class="pt-mute" style="margin-bottom:10px">Each lab builds a topology and grades your work with activity checks. Opening one replaces the workspace.</div>' + P.LABS.map(L => '<div class="pt-card"><div><b>' + esc(L.title) + '</b><small>' + esc(L.level) + ' · ' + L.checks.length + ' checks</small></div><button class="pt-btn pt-pri" data-l="' + L.id + '">Open</button></div>').join(''));
      dl.el.addEventListener('click', e => { const b = e.target.closest('[data-l]'); if (!b) return; const L = P.LABS.find(x => x.id === b.dataset.l); dl.close(); this.confirmLose(() => { this.setNet(L.build(), L.title, L.id); this.sideTab = 'lab'; this.sideRender(); }); });
    }
    sideRender() {
      const tabs = []; if (this.lab) tabs.push(['lab', '🧪 Lab']); if (this.simOn) tabs.push(['sim', '🎬 Simulation']);
      if (!tabs.length) { this.side.hidden = true; this.draw(); return; }
      this.side.hidden = false; if (!tabs.some(t => t[0] === this.sideTab)) this.sideTab = tabs[tabs.length - 1][0];
      const head = '<div class="pt-tabs" style="padding-top:6px">' + tabs.map(([k, l]) => '<button class="pt-tab' + (k === this.sideTab ? ' pt-on' : '') + '" data-side="' + k + '">' + l + '</button>').join('') + '</div>';
      this.side.innerHTML = head + '<div class="pt-sp" style="flex:1;min-height:0;display:flex;flex-direction:column"></div>';
      this.side.querySelector('.pt-tabs').onclick = e => { const b = e.target.closest('[data-side]'); if (b) { this.sideTab = b.dataset.side; this.sideRender(); } };
      const sp = this.side.querySelector('.pt-sp');
      if (this.sideTab === 'lab') this.labPanel(sp); else this.simPanel(sp);
    }
    labPanel(sp) {
      const L = this.lab;
      sp.innerHTML = '<div class="pt-sbody pt-lab"><b>' + esc(L.title) + '</b> <span class="pt-mute">(' + esc(L.level) + ')</span>' + L.intro + '<div class="pt-res"></div></div><div class="pt-ctl"><button class="pt-btn pt-pri" data-chk>✔ Check Results</button><button class="pt-btn" data-reset>Reset lab</button></div>';
      const res = sp.querySelector('.pt-res');
      const show = () => { const r = P.checkLab(L, this.net), pc = Math.round(100 * r.done / r.items.length); res.innerHTML = '<div class="pt-hd">Completion: ' + pc + '%</div><div class="pt-bar"><i style="width:' + pc + '%"></i></div><ul class="pt-chk">' + r.items.map(i => '<li class="' + (i.ok ? 'pt-ok' : 'pt-bad') + '">' + (i.ok ? '✔ ' : '✖ ') + esc(i.label) + '</li>').join('') + '</ul>' + (pc === 100 ? '<div class="pt-ok"><b>Congratulations! Every check passes.</b></div>' : ''); };
      sp.querySelector('[data-chk]').onclick = show;
      sp.querySelector('[data-reset]').onclick = () => this.confirmLose(() => this.setNet(L.build(), L.title, L.id));
    }
  }
  P.UI = UI;
  P.mount = el => { el.innerHTML = ''; el.style.display = 'flex'; el.style.flexDirection = 'column'; el.style.minHeight = '0'; el.style.flex = '1'; const host = document.createElement('div'); host.style.cssText = 'flex:1;min-height:0;display:flex;flex-direction:column'; el.appendChild(host); return new UI(host); };
})();

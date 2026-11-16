// Games made in this app, ported into the Arcade. Studio > Game maker writes a self-contained HTML game and Studio > Game
// Studio (Godot) writes a project that is exported for the web; either one can be sent here, and it then appears in
// Games > Arcade as a real game card with the same stats, medals and daily challenge as the built-in ones. Ports are kept in
// localStorage under oa_arcade_ports; a port only stores a name and either the HTML or the name of the project on this PC.
(() => {
  const P = A.play; if (!P) return;
  const KEY = 'oa_arcade_ports', MAX = 40;
  const esc = s => String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const list = () => { try { const l = JSON.parse(ls.get(KEY, '[]')); return Array.isArray(l) ? l : []; } catch (e) { return []; } };
  const store = l => ls.set(KEY, JSON.stringify(l.slice(0, MAX)));
  /* the same sealing Studio > Game maker uses: no network, no reaching the app, no storage */
  const HEAD = '<meta charset="utf-8"><meta http-equiv="Content-Security-Policy" content="default-src \'none\'; script-src \'unsafe-inline\'; style-src \'unsafe-inline\'; img-src data: blob:; media-src data: blob:; font-src data:">' +
    '<script>(function(){var mem=function(){var d={};return{getItem:function(k){return Object.prototype.hasOwnProperty.call(d,k)?d[k]:null},setItem:function(k,v){d[k]=String(v)},removeItem:function(k){delete d[k]},clear:function(){d={}},key:function(i){return Object.keys(d)[i]||null},get length(){return Object.keys(d).length}}};["localStorage","sessionStorage"].forEach(function(n){try{window[n].length}catch(e){try{Object.defineProperty(window,n,{value:mem(),configurable:true})}catch(x){}}});})()<\/script>';
  const seal = h => '<!doctype html>' + HEAD + String(h || '').replace(/<!doctype[^>]*>/i, '');

  function register(p) {
    if (!p || !p.id || !p.name) return;
    P.games[p.id] = {
      icon: p.kind === 'godot' ? '🧩' : '🎮',
      name: p.name,
      desc: (p.kind === 'godot' ? 'A Godot game' : 'A game') + ' made in this app and ported to the Arcade.',
      cat: 'arcade',
      mount(stage) {
        const wrap = document.createElement('div');
        wrap.style.cssText = 'position:relative;flex:1;width:100%;min-height:0;display:flex;align-items:stretch';
        const fr = document.createElement('iframe');
        fr.style.cssText = 'flex:1;width:100%;height:100%;min-height:320px;border:1px solid var(--line);border-radius:12px;background:#000';
        fr.title = p.name;
        if (p.kind === 'godot') {
          // a web export of the project on this PC, served from its own folder (see /api/godot/web)
          fr.setAttribute('sandbox', 'allow-scripts allow-same-origin allow-pointer-lock allow-downloads');
          fr.src = '/api/godot/web/' + encodeURIComponent(p.dir || p.name) + '/index.html?v=' + (p.ts || 0);
        } else {
          fr.setAttribute('sandbox', 'allow-scripts');
          fr.srcdoc = seal(p.html || '');
        }
        wrap.appendChild(fr); stage.appendChild(wrap);
        fr.onload = () => { try { fr.focus(); } catch (e) { } };
        return null;
      }
    };
  }
  function unregister(id) { if (P.games[id] && /^port_/.test(id)) delete P.games[id]; }
  /* repaint the Arcade if it is the page being looked at and no game is running */
  function repaint() {
    try {
      if (!document.getElementById('p-play') || P.active()) return;
      const sub = document.querySelector('#plsub [data-s=arcade]');
      if (sub) sub.click();
    } catch (e) { }
  }

  A.arcade = {
    list,
    /* add a game: { kind: 'html'|'godot', name, html?, dir? } — the same name replaces the earlier port */
    add(rec) {
      const name = String((rec && rec.name) || '').trim().slice(0, 60);
      if (!name) return false;
      if (rec.kind === 'html' && !String(rec.html || '').trim()) return false;
      const old = list(), l = old.filter(p => !(p.name === name && p.kind === rec.kind));
      old.filter(p => p.name === name && p.kind === rec.kind).forEach(p => unregister(p.id));   // the earlier port of this name goes away with its card
      const p = { id: 'port_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 5), kind: rec.kind === 'godot' ? 'godot' : 'html', name, html: rec.kind === 'html' ? String(rec.html) : undefined, dir: rec.kind === 'godot' ? (rec.dir || name) : undefined, from: rec.from || '', ts: Date.now() };
      l.unshift(p); store(l); register(p); repaint();
      return p.id;
    },
    remove(id) {
      const l = list().filter(p => p.id !== id); store(l); unregister(id); repaint(); return true;
    },
    refresh() { list().forEach(register); repaint(); }
  };

  /* register every port already made, once the Arcade's own game list exists */
  const boot = () => { if (!A.play || !A.playMeta) return setTimeout(boot, 120); list().forEach(register); };
  boot();
})();

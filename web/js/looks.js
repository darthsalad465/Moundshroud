// Saved looks (2026-11-22): everything that decides how Moundshroud looks, kept together under a name so a set of
// looks can be saved and switched between in one click. A look is the colour theme, the interface style, the whole
// customizer (fonts, sizes, spacing, corners, accent colours, motion), the sidebar switch, and the desktop's own
// system look, wallpaper and settings. Applying a look writes each part to the place that already remembers it, so
// the app always opens exactly as you last left it. Stored in localStorage keys oa_looks and oa_look.
(() => {
  const LIST = 'looks', ACTIVE = 'look';
  /* the desktop's own settings (os-shell.js). A picture wallpaper is left out on purpose: the picture itself stays
     where it is, so saving several looks never fills up the browser's storage with copies of it. */
  const DESK = ['os_theme', 'os_wall', 'os_accent', 'os_icsize', 'os_labels', 'os_barpos', 'os_barsize', 'os_clock', 'os_anim'];
  const read = k => { try { return localStorage.getItem('oa_' + k); } catch (e) { return null; } };
  const write = (k, v) => { try { if (v == null) localStorage.removeItem('oa_' + k); else localStorage.setItem('oa_' + k, v); } catch (e) { } };
  const json = (k, d) => { try { const v = JSON.parse(read(k) || 'null'); return v == null ? d : v; } catch (e) { return d; } };
  const uid = () => 'lk' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
  /* compare two appearances by what they say, not by the order the keys happen to be in */
  const stable = v => Array.isArray(v) ? '[' + v.map(stable).join(',') + ']' : v && typeof v === 'object' ? '{' + Object.keys(v).sort().map(k => JSON.stringify(k) + ':' + stable(v[k])).join(',') + '}' : JSON.stringify(v);
  const same = (a, b) => stable(a) === stable(b);
  const clean = n => String(n == null ? '' : n).trim().slice(0, 40);

  /* the appearance on screen right now */
  const capture = () => {
    const desk = {};
    DESK.forEach(k => { const v = read(k); if (v != null) desk[k] = v; });
    if (desk.os_wall == null) desk.os_wall = 'orbital';
    return { theme: read('theme') || 'shroud', style: read('style') || 'modern', custom: json('custom', {}), shroud: read('shroud') !== '0', desk };
  };

  const refreshDesk = () => {
    try {
      if (!window.A || !A.os) return;
      if (A.os.refresh) A.os.refresh();
      else { if (A.os.paintWall) A.os.paintWall(); if (A.os.sync) A.os.sync(); }
    } catch (e) { }
  };

  /* put a saved appearance on screen, part by part, each part through the switch that owns it */
  const use = look => {
    if (!look) return false;
    try { if (look.theme && window.OA_THEMES) OA_THEMES.apply(look.theme); } catch (e) { }
    try { if (look.style && window.OA_THEMES && OA_THEMES.applyStyle) OA_THEMES.applyStyle(look.style); } catch (e) { }
    try { if (look.custom && window.OA_CUSTOM) OA_CUSTOM.importJson(JSON.stringify(look.custom)); } catch (e) { }
    if (typeof look.shroud === 'boolean') { try { if (window.A && A.shroud) A.shroud.set(look.shroud); else write('shroud', look.shroud ? '1' : '0'); } catch (e) { } }
    const d = look.desk || {};
    Object.keys(d).forEach(k => { if (DESK.indexOf(k) >= 0) write(k, d[k]); });
    if (d.os_wall === 'custom' && !read('os_wall_img')) write('os_wall', 'orbital');
    refreshDesk();
    return true;
  };

  const list = () => {
    const a = json(LIST, []);
    return Array.isArray(a) ? a.filter(x => x && x.id && x.name && x.look && typeof x.look === 'object') : [];
  };
  const saveList = a => write(LIST, JSON.stringify(a.slice(0, 60)));
  const get = id => list().filter(x => x.id === id)[0] || null;

  /* saving under a name that is already taken updates that look, rather than making a second one with the same name */
  const save = name => {
    const n = clean(name); if (!n) return '';
    const look = capture(), a = list(), had = a.filter(x => x.name.toLowerCase() === n.toLowerCase())[0];
    let id;
    if (had) { id = had.id; had.look = look; had.ts = Date.now(); }
    else { id = uid(); a.push({ id, name: n, ts: Date.now(), look }); }
    saveList(a); write(ACTIVE, id);
    return id;
  };
  const remove = id => { saveList(list().filter(x => x.id !== id)); if (read(ACTIVE) === id) write(ACTIVE, ''); };
  const rename = (id, name) => { const n = clean(name); if (!n) return; const a = list(); a.forEach(x => { if (x.id === id) { x.name = n; x.ts = Date.now(); } }); saveList(a); };
  const apply = id => { const s = get(id); if (!s) return false; use(s.look); write(ACTIVE, id); return true; };
  /* the saved look matching what is on screen, or '' once a single setting has been changed since */
  const active = () => { const id = read(ACTIVE), s = get(id), now = capture(); return s && same(s.look, now) ? id : ''; };

  /* names for the cards */
  const byId = (arr, id) => (arr || []).filter(x => x.id === id)[0] || null;
  const themeName = id => { try { const t = byId(window.OA_THEMES && OA_THEMES.list, id); return t ? t.name : (id || ''); } catch (e) { return id || ''; } };
  const styleName = id => { try { const s = byId(window.OA_THEMES && OA_THEMES.styles, id); return s ? s.name : (id || ''); } catch (e) { return id || ''; } };
  const deskName = id => { try { const d = byId(window.A && A.os && A.os.looks ? A.os.looks() : [], id); return d ? d.name : ''; } catch (e) { return ''; } };
  const swatch = look => {
    try { const t = byId(window.OA_THEMES && OA_THEMES.list, look && look.theme); if (t && t.sw) return t.sw; } catch (e) { }
    return ['#161224', '#a184ff', '#ebc15f'];
  };

  window.OA_LOOKS = { capture, apply, use, list, get, save, remove, rename, active, themeName, styleName, deskName, swatch };

  /* the look you pick is the look that stays: nothing to run at start-up, because every part is saved as it changes. */
  window.A && window.A.ready && A.ready.push(() => {
    const id = read(ACTIVE);
    if (id && !get(id)) write(ACTIVE, '');
  });
})();

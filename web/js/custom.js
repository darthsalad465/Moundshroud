// Appearance customisation: fonts, sizes, spacing, shape, accent colour, contrast, motion. Sits on top of the colour theme and the interface style.
// Loaded right after styles.js so the saved look is applied before anything is drawn. Everything is stored in localStorage key oa_custom.
(() => {
  const KEY = 'oa_custom';
  const DEF = { font: '', fontOwn: '', mono: '', size: 100, chat: 100, lh: 0, ls: 0, round: '', dens: '', acc: '', acc2: '', contrast: '', width: '', anim: 1, book: '', bookSize: 100, bold: 0, tx: 'slide', perf: '' };
  const GENERIC = [['', 'Follow the interface style'], ['system-ui,"Segoe UI",sans-serif', 'System default'], ['Georgia,"Times New Roman",serif', 'Serif (Georgia)'], ['"Segoe UI",system-ui,sans-serif', 'Sans (Segoe UI)'], ['Consolas,"Cascadia Mono",monospace', 'Monospace']];
  const NAMES = ['Segoe UI', 'Segoe UI Variable Text', 'Calibri', 'Candara', 'Corbel', 'Arial', 'Verdana', 'Tahoma', 'Trebuchet MS', 'Franklin Gothic Medium', 'Bahnschrift', 'Century Gothic', 'Lucida Sans Unicode', 'Georgia', 'Cambria', 'Constantia', 'Palatino Linotype', 'Book Antiqua', 'Times New Roman', 'Garamond', 'Sitka Text', 'Consolas', 'Cascadia Code', 'Cascadia Mono', 'Courier New', 'Lucida Console', 'Segoe Print', 'Segoe Script', 'Ink Free', 'Comic Sans MS', 'Impact', 'Arial Narrow', 'Rockwell', 'Gill Sans MT', 'Lexend', 'OpenDyslexic', 'Atkinson Hyperlegible', 'Inter', 'Roboto', 'Open Sans'];
  const PRESETS = [
    ['Default', 'Back to how it came', {}],
    ['Large & clear', 'Bigger text, airy lines, strong contrast', { size: 118, lh: 1.75, contrast: 'high', dens: 'roomy', font: '"Segoe UI",system-ui,sans-serif', chat: 108 }],
    ['Compact', 'More on screen at once', { size: 90, lh: 1.35, dens: 'compact', chat: 96 }],
    ['Bookish', 'Serif type, narrow comfortable columns', { font: 'Georgia,"Times New Roman",serif', lh: 1.75, width: 'narrow', round: 'normal', chat: 106, book: 'Georgia,"Times New Roman",serif', bookSize: 112 }],
    ['Terminal', 'Monospace and square corners', { font: 'Consolas,"Cascadia Mono",monospace', mono: 'Consolas,"Cascadia Mono",monospace', round: 'sharp', dens: 'compact', lh: 1.4 }],
    ['Soft & round', 'Pill buttons, generous spacing', { round: 'round', dens: 'roomy', lh: 1.65 }],
  ];
  let st = null, cfg = Object.assign({}, DEF);
  try { cfg = Object.assign({}, DEF, JSON.parse(localStorage.getItem(KEY) || '{}')); } catch (e) { }
  const save = () => { try { localStorage.setItem(KEY, JSON.stringify(cfg)); } catch (e) { } };
  const num = (v, a, b, d) => { v = +v; return isFinite(v) ? Math.min(b, Math.max(a, v)) : d; };
  const fam = n => /[,"]/.test(n) ? n : '"' + n.replace(/["\\;{}<>]/g, '') + '",system-ui,sans-serif';
  const lum = hex => { const m = /^#?([0-9a-f]{6})$/i.exec(hex || ''); if (!m) return 0; const n = parseInt(m[1], 16); return (0.299 * (n >> 16) + 0.587 * ((n >> 8) & 255) + 0.114 * (n & 255)) / 255; };
  const cv = document.createElement('canvas').getContext('2d');
  const hasFont = n => { try { return ['monospace', 'serif', 'sans-serif'].some(b => { cv.font = '72px ' + b; const w0 = cv.measureText('mmmmlliWWQ@#').width; cv.font = '72px "' + n + '",' + b; return cv.measureText('mmmmlliWWQ@#').width !== w0; }); } catch (e) { return false; } };
  const userFont = () => cfg.fontOwn.trim() ? fam(cfg.fontOwn.trim()) : cfg.font;

  const css = () => {
    const c = cfg, o = [], F = userFont(), N = ':not(pre):not(code):not(kbd):not(samp):not([style*="monospace"])';
    if (F) o.push('html body,html body button,html body input,html body select,html body textarea,html body *' + N + '{font-family:' + F + '!important}');
    if (c.mono) o.push('html body pre,html body code,html body kbd,html body samp,html body [style*="monospace"]{font-family:' + c.mono + '!important}');
    if (c.size !== 100) o.push('html{zoom:' + (c.size / 100) + '}');
    if (c.chat !== 100) o.push('html body .m,html body .m *{font-size:' + (14.5 * c.chat / 100).toFixed(2) + 'px}html body .m h1{font-size:1.5em}html body .m h2{font-size:1.25em}html body .m h3{font-size:1.1em}html body .m small,html body .m .small{font-size:.85em}');
    if (c.lh) o.push('html body,html body .m{line-height:' + c.lh + '!important}');
    if (c.ls) o.push('html body{letter-spacing:' + c.ls + 'em}');
    if (c.bold) o.push('html body{font-weight:500}html body b,html body strong,html body h2,html body h3{font-weight:800}');
    const R = '.card,.ib,.chip,.pri,.m,.dlg,.tile,.bk,.cc,.acmsg,input,select,textarea,nav button,.badge,#toast,.logo';
    if (c.round === 'sharp') o.push('html body :is(' + R + '){border-radius:0!important}');
    if (c.round === 'normal') o.push('html body :is(.card,.m,.dlg,.tile,.bk,.cc,.acmsg){border-radius:10px!important}html body :is(.ib,.chip,.pri,input,select,textarea,nav button,.badge){border-radius:7px!important}');
    if (c.round === 'round') o.push('html body :is(.ib,.chip,.pri,input,select,nav button,.badge){border-radius:999px!important}html body :is(.card,.m,.dlg,.tile,.bk,.cc,.acmsg,textarea){border-radius:22px!important}');
    if (c.dens === 'compact') o.push('html body .card{padding:7px 10px;margin-bottom:6px}html body .ib{padding:3px 8px}html body nav button{padding:3px 9px}html body .m{padding:6px 10px;margin-bottom:7px}html body h3{margin:8px 0 3px}');
    if (c.dens === 'roomy') o.push('html body .card{padding:17px 20px;margin-bottom:15px}html body .ib{padding:8px 14px}html body nav button{padding:8px 16px}html body .m{padding:13px 17px;margin-bottom:17px}html body h3{margin:18px 0 6px}');
    const root = [];
    if (/^#[0-9a-f]{6}$/i.test(c.acc)) { root.push('--acc:' + c.acc); o.push('html body .pri{color:' + (lum(c.acc) > 0.6 ? '#0a0c12' : '#fff') + '!important}' + (c.acc2 ? '' : 'html body .pri{background:var(--acc)!important}')); }
    if (/^#[0-9a-f]{6}$/i.test(c.acc2)) { root.push('--acc2:' + c.acc2); o.push('html body .pri{background:linear-gradient(135deg,var(--acc),var(--acc2))!important}'); }
    if (c.contrast === 'high') root.push('--mute:color-mix(in srgb,var(--text) 88%,var(--bg))', '--line:color-mix(in srgb,var(--text) 38%,var(--bg))');
    if (c.contrast === 'soft') root.push('--mute:color-mix(in srgb,var(--text) 50%,var(--bg))', '--line:color-mix(in srgb,var(--text) 10%,var(--bg))', '--text:color-mix(in srgb,#fff 0%,var(--text))');
    if (root.length) o.push('html:root{' + root.join(';') + '}');
    if (c.width === 'narrow') o.push('html body .m{max-width:68%!important}');
    if (c.width === 'wide') o.push('html body .m{max-width:100%!important}');
    if (c.perf === 'cool') o.push('html body *,html body *::before,html body *::after{backdrop-filter:none!important;-webkit-backdrop-filter:none!important}html body::before,html body::after{animation:none!important;filter:none!important}html body .logo,html body .reactor *{animation:none!important}');
    if (!c.anim) o.push('html body *,html body *::before,html body *::after{animation:none!important;transition:none!important;scroll-behavior:auto!important}');
    return o.join('\n');
  };
  const apply = () => {
    if (!st) { st = document.createElement('style'); st.id = 'oa-custom'; (document.head || document.documentElement).appendChild(st); }
    st.textContent = css();
  };
  const set = (k, v) => { cfg[k] = v; save(); apply(); };
  const reset = () => { cfg = Object.assign({}, DEF); save(); apply(); };
  const preset = p => { cfg = Object.assign({}, DEF, p); save(); apply(); };
  const bookCss = () => {
    const f = cfg.book || userFont(), o = [];
    if (f) o.push('body,p,li,td,th,div,span,a,blockquote{font-family:' + f + '!important}');
    if (cfg.bookSize !== 100) o.push('body{font-size:' + (cfg.bookSize / 100) + 'em!important}');
    if (cfg.lh) o.push('body{line-height:' + cfg.lh + '!important}');
    if (cfg.mono) o.push('pre,code,kbd,samp{font-family:' + cfg.mono + '!important}');
    return o.join('');
  };
  window.OA_CUSTOM = { cfg: () => cfg, set, reset, preset, apply, css, bookCss, DEF, PRESETS, GENERIC, NAMES, hasFont, exportJson: () => JSON.stringify(cfg), importJson: s => { const j = JSON.parse(s); const n = {}; for (const k in DEF) if (k in j && typeof j[k] === typeof DEF[k]) n[k] = j[k]; cfg = Object.assign({}, DEF, n); save(); apply(); } };
  apply();
})();

// The dialog. Needs the app (A) so it is built once the page has loaded.
window.addEventListener('DOMContentLoaded', () => {
  const C = window.OA_CUSTOM; if (typeof A === 'undefined' || !C) return;
  const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  let installed = null;
  const fonts = () => installed || (installed = C.NAMES.filter(C.hasFont));
  const sel = (id, opts, cur) => '<select id="' + id + '" style="max-width:100%;width:100%">' + opts.map(o => '<option value="' + esc(o[0]) + '"' + (o[0] === cur ? ' selected' : '') + '>' + esc(o[1]) + '</option>').join('') + '</select>';
  const slider = (id, label, min, max, step, val, fmt) => '<div class="row" style="gap:10px;margin:6px 0"><span style="width:150px;flex:none">' + label + '</span><input type="range" id="' + id + '" min="' + min + '" max="' + max + '" step="' + step + '" value="' + val + '" style="flex:1"><b id="' + id + 'v" style="width:54px;text-align:right">' + fmt(val) + '</b></div>';
  const seg = (id, opts, cur) => '<div class="row" id="' + id + '" style="gap:6px;flex-wrap:wrap">' + opts.map(o => '<button class="ib' + (o[0] === cur ? ' on' : '') + '" data-v="' + o[0] + '">' + o[1] + '</button>').join('') + '</div>';
  const h = t => '<h3 style="margin-top:16px">' + t + '</h3>';

  const open = () => {
    const c = C.cfg(), fl = [].concat(C.GENERIC, fonts().map(n => ['"' + n + '",system-ui,sans-serif', n]));
    const monos = [['', 'Default'], ['Consolas,"Cascadia Mono",monospace', 'Consolas'], ['"Cascadia Code","Cascadia Mono",monospace', 'Cascadia Code'], ['"Courier New",monospace', 'Courier New'], ['"Lucida Console",monospace', 'Lucida Console']];
    const bf = [['', 'Same as the app']].concat(fl.slice(1));
    const pct = v => v + '%', lhf = v => +v ? (+v).toFixed(2) : 'Auto', lsf = v => (+v ? (+v).toFixed(2) + 'em' : 'Normal');
    A.dlg('<div class="hd"><b>🎨 Customize appearance</b><span class="sp"></span><button class="ib" id="crst" style="font-size:12px">↺ Reset to default</button></div><div class="bd" style="max-height:min(640px,68vh);overflow:auto">' +
      '<div class="small mute">Changes apply instantly and are remembered. They work with every colour theme and interface style. Pick one of these presets as a starting point, then fine-tune anything below.</div>' +
      '<div class="row" style="gap:6px;flex-wrap:wrap;margin-top:10px" id="cpre">' + C.PRESETS.map((p, i) => '<button class="chip" data-i="' + i + '" title="' + esc(p[1]) + '">' + esc(p[0]) + '</button>').join('') + '</div>' +
      '<div class="cu-sec">' + h('🔤 Typography &amp; Text') +
      '<div class="small mute" style="margin-bottom:4px">Font for the whole app</div>' + sel('cfont', fl, c.fontOwn ? '__own' : c.font) +
      '<div class="row" style="margin-top:8px;gap:8px"><span class="small mute" style="flex:none">or type any font installed on this PC:</span><input type="text" id="cown" placeholder="e.g. Lexend, Fira Sans, Inter" value="' + esc(c.fontOwn) + '"></div>' +
      '<div id="cprev" style="margin:12px 0;padding:12px 16px;border:1px solid var(--line);border-radius:12px;background:var(--panel)">The quick brown fox jumps over the lazy dog. <b>Bold text</b>, <i>italic text</i>, and numbers 0123456789. <code>code looks like this</code></div>' +
      '<div class="small mute" style="margin-bottom:4px">Code and monospace font</div>' + sel('cmono', monos, c.mono) +
      '<div style="margin-top:10px">' +
      slider('csize', 'Interface size', 70, 170, 5, c.size, pct) +
      slider('cchat', 'Chat text size', 70, 200, 5, c.chat, pct) +
      slider('clh', 'Line spacing', 0, 2.2, 0.05, c.lh, lhf) +
      slider('cls', 'Letter spacing', -0.02, 0.12, 0.01, c.ls, lsf) +
      '</div>' +
      '<label class="chk" style="margin-top:8px;gap:8px"><input type="checkbox" id="cbold"' + (c.bold ? ' checked' : '') + '> <span>Heavier text <span class="small mute">(easier to read on some screens)</span></span></label></div>' +
      '<div class="cu-sec">' + h('📐 Shape &amp; Spacing') +
      '<div class="small mute" style="margin-bottom:4px">Corners</div>' + seg('cround', [['sharp', 'Sharp'], ['', 'Style default'], ['normal', 'Gentle'], ['round', 'Very round']], c.round) +
      '<div class="small mute" style="margin:10px 0 4px">Density</div>' + seg('cdens', [['compact', 'Compact'], ['', 'Normal'], ['roomy', 'Roomy']], c.dens) +
      '<div class="small mute" style="margin:10px 0 4px">Chat bubble width</div>' + seg('cwidth', [['narrow', 'Narrow'], ['', 'Normal'], ['wide', 'Full width']], c.width) + '</div>' +
      '<div class="cu-sec">' + h('🎨 Accent Colours &amp; Contrast') +
      '<div class="row" style="gap:12px;flex-wrap:wrap"><label class="row" style="gap:8px">Accent <input type="color" id="cacc" value="' + (c.acc || '#8b7cff') + '"></label><label class="row" style="gap:8px">Second accent <input type="color" id="cacc2" value="' + (c.acc2 || '#46d7c8') + '"></label><button class="ib" id="caccx">Use the theme\'s colours</button></div>' +
      '<div class="small mute" style="margin:10px 0 4px">Text contrast</div>' + seg('ccon', [['soft', 'Soft'], ['', 'Normal'], ['high', 'High']], c.contrast) + '</div>' +
      '<div class="cu-sec">' + h('✨ Motion &amp; Performance') +
      '<div class="small mute" style="margin-bottom:4px">When you switch tabs</div>' + seg('ctx', [['slide', 'Slide'], ['fade', 'Fade'], ['zoom', 'Zoom'], ['rise', 'Rise'], ['drop', 'Drop'], ['flip', 'Flip'], ['none', 'None']], c.tx) +
      '<div class="small mute" style="margin:10px 0 4px">Effects</div>' + seg('cperf', [['', 'Full (blur and glow)'], ['cool', 'Cool &amp; quiet']], c.perf) + '<div class="small mute" style="margin-top:4px">Cool &amp; quiet removes blur, glass and endless background motion so the fan stays calm. Moundshroud always pauses its animations when it is hidden or in the background.</div>' +
      '<label class="chk" style="margin-top:10px;gap:8px"><input type="checkbox" id="canim"' + (c.anim ? ' checked' : '') + '> <span>Animations <span class="small mute">(turn off for a perfectly still app)</span></span></label></div>' +
      '<div class="cu-sec">' + h('📚 Library Books') +
      '<div class="small mute" style="margin-bottom:4px">Font for books you read in the Library</div>' + sel('cbook', bf, c.book) +
      '<div style="margin-top:8px">' + slider('cbs', 'Book text size', 70, 200, 5, c.bookSize, pct) + '</div>' +
      '<div class="small mute">Applies to books you open next.</div></div>' +
      '<div class="cu-sec">' + h('💾 Share or Back Up Your Look') +
      '<div class="row" style="gap:8px;flex-wrap:wrap"><button class="ib" id="cexp">Copy my settings</button><button class="ib" id="cimp">Paste settings</button></div></div>' +
      '<div class="row" style="margin-top:16px"><span class="small mute">Interface style and colour theme are in Settings.</span><span class="sp"></span><button class="pri" id="cx">Done</button></div></div>', true);

    const refresh = () => { const ev = C.cfg(); $('cprev').style.fontFamily = ''; };
    const sl = (id, key, fmt) => { const e = $(id); e.oninput = () => { C.set(key, +e.value); $(id + 'v').textContent = fmt(+e.value); }; };
    sl('csize', 'size', pct); sl('cchat', 'chat', pct); sl('clh', 'lh', lhf); sl('cls', 'ls', lsf); sl('cbs', 'bookSize', pct);
    $('cfont').onchange = () => { const v = $('cfont').value; C.set('fontOwn', ''); $('cown').value = ''; C.set('font', v); };
    let t = 0; $('cown').oninput = () => { clearTimeout(t); t = setTimeout(() => { C.set('fontOwn', $('cown').value.replace(/["\\;{}<>]/g, '')); if ($('cown').value.trim()) $('cfont').selectedIndex = 0; }, 250); };
    $('cmono').onchange = () => C.set('mono', $('cmono').value); $('cbook').onchange = () => C.set('book', $('cbook').value);
    const sg = (id, key) => { $(id).onclick = e => { const b = e.target.closest('button'); if (!b) return; C.set(key, b.dataset.v); $(id).querySelectorAll('button').forEach(x => x.classList.toggle('on', x === b)); }; };
    sg('ctx', 'tx'); sg('cperf', 'perf'); sg('cround', 'round'); sg('cdens', 'dens'); sg('cwidth', 'width'); sg('ccon', 'contrast');
    $('cbold').onchange = () => C.set('bold', $('cbold').checked ? 1 : 0); $('canim').onchange = () => C.set('anim', $('canim').checked ? 1 : 0);
    $('cacc').oninput = () => C.set('acc', $('cacc').value); $('cacc2').oninput = () => C.set('acc2', $('cacc2').value);
    $('caccx').onclick = () => { C.set('acc', ''); C.set('acc2', ''); };
    $('cpre').onclick = e => { const b = e.target.closest('.chip'); if (!b) return; C.preset(C.PRESETS[+b.dataset.i][2]); open(); A.toast('Applied: ' + C.PRESETS[+b.dataset.i][0]); };
    $('cexp').onclick = () => { A.copy ? A.copy(C.exportJson()) : navigator.clipboard.writeText(C.exportJson()); A.toast('Settings copied. Paste them anywhere to keep them.'); };
    $('cimp').onclick = async () => { const s = (await A.prompt('Paste the settings you copied earlier:')); if (!s) return; try { C.importJson(s); open(); A.toast('Settings loaded'); } catch (e) { A.toast('That does not look like saved settings'); } };
    $('crst').onclick = async () => { if (!(await A.confirm('Put fonts, sizes, spacing and colours back to the defaults?'))) return; C.reset(); open(); A.toast('Appearance reset'); };
    $('cx').onclick = A.closeDlg;
    if (c.fontOwn) { const o = document.createElement('option'); o.value = '__own'; o.textContent = c.fontOwn; o.selected = true; $('cfont').prepend(o); }
  };
  A.custom = { open, apply: C.apply, bookCss: C.bookCss };
});

// Chess board look and feel: size, board themes, piece shapes, paint finishes, coordinates, highlights, motion and sound.
// Loaded before the board is built (play-chess-study.js). Settings live in localStorage key chset.
// Every Board registers itself here and redraws when a setting changes.
//
// Three independent choices, so the looks multiply:
//   SHAPE   what the piece is drawn as (a drawn piece, a Roman legionary, a pixel, a rune...)
//   FINISH  how it is painted (outlined, flat, glass, chrome, carved wood, candy, neon, ink...)
//   BOARD   colours + surface texture + frame, plus highlights, coordinates and motion
// and PRESETS set all of them at once. Any shape works with any finish and any board.
(() => {
  const KEY = 'chset';
  const MODE_KEY = 'chess_experience';
  const BOOK_KEY = 'chess_opening_book';
  let experience = 'modern';
  let openingBook = true;
  try { experience = localStorage.getItem(MODE_KEY) === 'legacy' ? 'legacy' : 'modern'; } catch (e) { }
  try { openingBook = localStorage.getItem(BOOK_KEY) !== '0'; } catch (e) { }
  const DEF = { size: 0, maxsz: 92, theme: 'app', lightC: '#eeeed2', darkC: '#769656', tex: 'flat', frame: 'thin', radius: 10, grid: 0,
    pieces: 'classic', finish: '', flair: '#c0392b', pw: '', pb: '', outline: 'auto', pscale: 100, pshadow: 1,
    coords: 'in', coordSize: 100, hl: 'yellow', dots: 'dot', legal: 1, check: 1, anim: 'normal', sound: 1, vol: 70 };

  /* ---------- the shapes a piece can be drawn as ---------- */
  const SHAPES = [
    ['classic', 'Classic', 'Clean drawn pieces with an outline'],
    ['roman', 'Roman soldiers', 'Cute little legionaries: plumed helmets, shields, spears and cloaks'],
    ['gothic', 'Gothic', 'Tall, angular pieces from a cathedral set'],
    ['pixel', 'Pixel', 'Blocky 8-bit pieces'],
    ['bubble', 'Bubbles', 'Roly-poly cartoon pieces with faces'],
    ['totem', 'Totem', 'Carved shapes stacked in a column'],
    ['rune', 'Runes', 'Stone discs carved with elder letters'],
    ['glyph', 'Glyphs', 'Typeset chess characters'],
    ['letters', 'Letters', 'Discs marked K Q R B N P']
  ];
  const SHAPEDEF = { classic: 'outline', roman: 'flat', gothic: 'stone', pixel: 'flat', bubble: 'candy', totem: 'wood', rune: 'stone', glyph: 'flat', letters: 'outline' };
  const SHAPENAME = {}; SHAPES.forEach(s => SHAPENAME[s[0]] = s[1]);
  const shapeOf = v => (v === 'flat' || v === 'neon') ? 'classic' : (SHAPENAME[v] ? v : 'classic');

  /* ---------- how a piece is painted ---------- */
  const FINISHES = [
    ['outline', 'Outlined', 'A clean line round every shape'],
    ['flat', 'Flat', 'No outline, a soft shadow instead'],
    ['gloss', 'Glass', 'See-through with a bright rim'],
    ['metal', 'Chrome', 'Steel with a bevelled edge'],
    ['gold', 'Gold', 'Warm metal, polished'],
    ['wood', 'Carved wood', 'Grain lines and a dark edge'],
    ['marble', 'Marble', 'Pale stone with grey veins'],
    ['stone', 'Stone', 'Matte grey, chiselled'],
    ['candy', 'Candy', 'Pastel with a white icing rim'],
    ['crystal', 'Crystal', 'Translucent and glowing'],
    ['neon', 'Neon', 'Glowing outlines'],
    ['ink', 'Ink sketch', 'Hand-drawn wobbly lines'],
    ['shadow', 'Shadow', 'Solid silhouette, hard shadow'],
    ['paper', 'Paper', 'Printed look with a paper edge'],
    ['matte', 'Matte', 'Flat colour, nothing else']
  ];
  const FINNAME = {}; FINISHES.forEach(f => FINNAME[f[0]] = f[1]);
  const ALLFIN = FINISHES.map(f => f[0]).concat(['glyph']);

  /* ---------- board colours (grouped) ---------- */
  const THEMES = [
    ['app', 'App colours', null, null, 'Moundshroud'],
    ['green', 'Classic green', '#eeeed2', '#769656', 'Classic'],
    ['blue', 'Steel blue', '#dee3e6', '#8ca2ad', 'Classic'],
    ['mono', 'Newsprint', '#ffffff', '#9c9c9c', 'Classic'],
    ['contrast', 'High contrast', '#ffffff', '#4a4a4a', 'Classic'],
    ['paper', 'Paper', '#fbf8f1', '#cdc4b0', 'Classic'],
    ['wood', 'Tournament wood', '#f0d9b5', '#b58863', 'Woods'],
    ['walnut', 'Walnut', '#e6cfa6', '#8a5a34', 'Woods'],
    ['oak', 'Oak', '#f2d9b1', '#a97a4a', 'Woods'],
    ['cherry', 'Cherry', '#f6ded0', '#a75b4a', 'Woods'],
    ['rosewood', 'Rosewood', '#6b3444', '#3c1c26', 'Woods'],
    ['cocoa', 'Cocoa', '#eadbc8', '#7d5a44', 'Woods'],
    ['bark', 'Bark', '#ece0d0', '#8b6f4e', 'Woods'],
    ['gold', 'Gold leaf', '#f3e3bd', '#c9a44c', 'Woods'],
    ['brass', 'Brass', '#ece0c4', '#b3993f', 'Woods'],
    ['copper', 'Copper', '#f0ddcb', '#b5714a', 'Woods'],
    ['bamboo', 'Bamboo', '#eae7c8', '#8fa95f', 'Nature'],
    ['forest', 'Forest', '#dde8cf', '#5d7f4b', 'Nature'],
    ['moss', 'Moss', '#e2e8c9', '#6f8f4a', 'Nature'],
    ['jade', 'Jade', '#e6f2e8', '#7fa98c', 'Nature'],
    ['mint', 'Mint', '#e8f6ef', '#8fc9a8', 'Nature'],
    ['pine', 'Pine', '#2f4a38', '#16261d', 'Nature'],
    ['lichen', 'Lichen', '#eaeadd', '#a8a98c', 'Nature'],
    ['ice', 'Ice', '#eaf4fb', '#7fa9c9', 'Cool'],
    ['ocean', 'Ocean', '#dfeaf2', '#5f8fae', 'Cool'],
    ['sky', 'Sky', '#eaf6ff', '#8ec6f0', 'Cool'],
    ['turquoise', 'Turquoise', '#e0f4f2', '#57a8a0', 'Cool'],
    ['slate', 'Slate', '#d2d7df', '#5b6577', 'Cool'],
    ['steel', 'Steel', '#e2e6ea', '#6d7883', 'Cool'],
    ['porcelain', 'Porcelain', '#f7f7fa', '#c2c6cf', 'Cool'],
    ['marble', 'Marble', '#f4f2ee', '#b9b5ad', 'Cool'],
    ['blueprint', 'Blueprint', '#dbe7f5', '#6a92c4', 'Cool'],
    ['sand', 'Desert sand', '#f3e6c4', '#c4a15c', 'Warm'],
    ['desert', 'Dunes', '#f0e2c0', '#b3924f', 'Warm'],
    ['coral', 'Coral', '#f7e7d8', '#d98259', 'Warm'],
    ['terracotta', 'Terracotta', '#f6e0d4', '#c1694f', 'Warm'],
    ['honey', 'Honey', '#fbeecb', '#d9a63e', 'Warm'],
    ['pumpkin', 'Pumpkin', '#fbe3c8', '#d4833c', 'Warm'],
    ['rose', 'Rose', '#f8e5ea', '#c97b8f', 'Warm'],
    ['blush', 'Blush', '#fbe9e7', '#d98c94', 'Warm'],
    ['cranberry', 'Cranberry', '#fbe2e6', '#c05a6b', 'Warm'],
    ['amber', 'Amber', '#f9ead0', '#c98b3a', 'Warm'],
    ['amethyst', 'Amethyst', '#e9e1f3', '#8b78b8', 'Plum'],
    ['lavender', 'Lavender', '#ece9f7', '#9d8ec9', 'Plum'],
    ['eggplant', 'Eggplant', '#ece2f2', '#7d5f96', 'Plum'],
    ['plum', 'Plum night', '#3d2a48', '#241630', 'Plum'],
    ['wine', 'Wine', '#5a2a38', '#331822', 'Plum'],
    ['catholic', 'Catacomb stone', '#d8cbb8', '#6b5b45', 'Devotional'],
    ['catholic2', 'Rose window', '#f4e3ea', '#8f5f7a', 'Devotional'],
    ['catholic3', 'Stained glass', '#eaf0f7', '#5a6f9e', 'Devotional'],
    ['vespers', 'Vespers', '#2b2438', '#191426', 'Devotional'],
    ['iconostasis', 'Iconostasis', '#3a2418', '#1f120a', 'Devotional'],
    ['ash', 'Ash', '#dfe1e4', '#6e737a', 'Dark'],
    ['charcoal', 'Charcoal', '#d9dbdd', '#5f646b', 'Dark'],
    ['ink', 'Ink', '#e6e8ec', '#4f5560', 'Dark'],
    ['graphite', 'Graphite', '#e8e8ea', '#8c8c92', 'Dark'],
    ['midnight', 'Midnight', '#4d5578', '#222744', 'Dark'],
    ['midnight2', 'Deep sea', '#33547a', '#1d3350', 'Dark'],
    ['space', 'Space', '#2a2f4a', '#14172b', 'Dark'],
    ['ember', 'Ember', '#4a2a20', '#2a1512', 'Dark'],
    ['slate2', 'Dark slate', '#4a4f5a', '#262a33', 'Dark'],
    ['blueprint2', 'Blueprint dark', '#1d3350', '#122238', 'Dark'],
    ['neon', 'Neon grid', '#17263f', '#0b1426', 'Neon'],
    ['cyber', 'Cyberpunk', '#1b2a3a', '#0d1a26', 'Neon'],
    ['terminal', 'Terminal', '#10201a', '#061410', 'Neon'],
    ['vapor', 'Vaporwave', '#2b1e4a', '#1a1030', 'Neon'],
    ['custom', 'Custom...', null, null, 'Custom']
  ];
  const THEMEGROUPS = []; THEMES.forEach(t => { if (!THEMEGROUPS.includes(t[4])) THEMEGROUPS.push(t[4]); });

  /* ---------- the surface of the squares ---------- */
  const TEX = [['flat', 'Flat'], ['soft', 'Soft shade'], ['grain', 'Grain'], ['wood', 'Wood lines'], ['marble', 'Marble'], ['cloth', 'Cloth'],
    ['paper', 'Paper'], ['dots', 'Dots'], ['waves', 'Waves'], ['circuit', 'Circuit'], ['grid', 'Fine grid'], ['checker', 'Checker'], ['noise', 'Noise'], ['sheen', 'Sheen']];
  const TEXCSS = {
    flat: ['', ''],
    soft: ['linear-gradient(rgba(255,255,255,.14),rgba(0,0,0,.08))', ''],
    grain: ['radial-gradient(rgba(0,0,0,.07) 1px,transparent 1.2px)', '4px 4px'],
    wood: ['repeating-linear-gradient(90deg,rgba(0,0,0,.05) 0 2px,transparent 2px 9px),linear-gradient(rgba(255,255,255,.1),rgba(0,0,0,.06))', ''],
    marble: ['repeating-linear-gradient(115deg,rgba(255,255,255,.12) 0 2px,rgba(0,0,0,.035) 2px 6px,transparent 6px 30px)', ''],
    cloth: ['repeating-linear-gradient(45deg,rgba(0,0,0,.05) 0 2px,transparent 2px 5px),repeating-linear-gradient(-45deg,rgba(255,255,255,.06) 0 2px,transparent 2px 5px)', ''],
    paper: ['radial-gradient(rgba(0,0,0,.045) 1px,transparent 1.4px)', '4px 4px'],
    dots: ['radial-gradient(rgba(255,255,255,.22) 1.5px,transparent 1.9px)', '9px 9px'],
    waves: ['repeating-radial-gradient(circle at 50% 130%,transparent 0 7px,rgba(0,0,0,.05) 7px 9px)', ''],
    circuit: ['linear-gradient(90deg,rgba(0,0,0,.07) 0 1px,transparent 1px),linear-gradient(rgba(0,0,0,.07) 0 1px,transparent 1px)', '7px 7px'],
    grid: ['linear-gradient(90deg,rgba(0,0,0,.05) 0 1px,transparent 1px),linear-gradient(rgba(0,0,0,.05) 0 1px,transparent 1px)', '6px 6px'],
    checker: ['repeating-conic-gradient(rgba(0,0,0,.05) 0 25%,transparent 0 50%)', '8px 8px'],
    noise: ['radial-gradient(rgba(0,0,0,.06) 1px,transparent 1px),radial-gradient(rgba(255,255,255,.08) 1px,transparent 1.4px)', '5px 5px'],
    sheen: ['linear-gradient(150deg,rgba(255,255,255,.2),transparent 42%,rgba(0,0,0,.1))', '']
  };

  /* ---------- the frame round the board ---------- */
  const FRAMES = [['none', 'None'], ['thin', 'Thin'], ['thick', 'Thick'], ['wood', 'Wood'], ['metal', 'Metal'], ['glow', 'Glow'],
    ['bevel', 'Bevel'], ['ornate', 'Ornate'], ['rope', 'Rope'], ['pixel', 'Pixel'], ['double', 'Double line']];
  const FRAMECSS = {
    none: ['0 0 0 0 transparent', 0],
    thin: ['0 0 0 2px var(--line)', 2],
    thick: ['0 0 0 8px var(--panel2)', 8],
    wood: ['0 0 0 9px #6b4a2b,0 0 0 11px #3d2a18', 11],
    metal: ['0 0 0 4px #c8ccd6,0 0 0 7px #7d838f,0 0 0 9px #4a4f59', 9],
    glow: ['0 0 0 2px var(--acc),0 0 22px color-mix(in srgb,var(--acc) 60%,transparent)', 2],
    bevel: ['inset 0 0 0 2px rgba(255,255,255,.22),0 0 0 6px color-mix(in srgb,var(--panel2) 80%,#000)', 6],
    ornate: ['0 0 0 3px #b8912f,0 0 0 6px #7a5f1c,0 0 0 8px #3c2f0c', 8],
    rope: ['0 0 0 6px #b98a4a,0 0 0 10px #8b6231', 10],
    pixel: ['0 0 0 4px var(--panel2),0 0 0 8px var(--line)', 8],
    double: ['0 0 0 2px var(--line),0 0 0 6px var(--panel),0 0 0 8px var(--line)', 8]
  };

  /* ---------- highlights ---------- */
  const HL = { yellow: 'rgba(255,214,10,.42)', green: 'rgba(80,200,120,.45)', blue: 'rgba(79,168,255,.42)', orange: 'rgba(255,150,40,.5)',
    pink: 'rgba(255,105,180,.42)', purple: 'rgba(160,120,255,.45)', red: 'rgba(255,70,90,.42)', teal: 'rgba(40,200,190,.42)', off: 'transparent' };

  /* ---------- presets: one click sets the whole ensemble ---------- */
  const LOOKS = [
    ['Moundshroud', 'The original look', { theme: 'app', pieces: 'classic', finish: 'outline', tex: 'flat', coords: 'in' }],
    ['Roman legion', 'Cute legionaries on catacomb stone', { theme: 'catholic', pieces: 'roman', finish: 'flat', tex: 'marble', frame: 'rope', coords: 'in', hl: 'orange', flair: '#c0392b', radius: 8 }],
    ['Tournament', 'Warm wood, outlined pieces', { theme: 'wood', pieces: 'classic', finish: 'outline', tex: 'soft', frame: 'wood', coords: 'in', radius: 6 }],
    ['Classic green', 'The familiar online look', { theme: 'green', pieces: 'classic', finish: 'outline', tex: 'flat', frame: 'none', coords: 'in', radius: 8 }],
    ['Vintage club', 'Carved walnut and brass', { theme: 'walnut', pieces: 'classic', finish: 'wood', tex: 'wood', frame: 'ornate', coords: 'in', hl: 'orange', radius: 4 }],
    ['Marble hall', 'Gothic stone on polished marble', { theme: 'marble', pieces: 'gothic', finish: 'stone', tex: 'marble', frame: 'bevel', coords: 'out', hl: 'blue', radius: 2 }],
    ['Cathedral', 'Tall spires and gold', { theme: 'iconostasis', pieces: 'gothic', finish: 'gold', tex: 'grain', frame: 'ornate', coords: 'in', hl: 'yellow', radius: 0 }],
    ['Stained glass', 'Glowing gothic glass', { theme: 'catholic3', pieces: 'gothic', finish: 'crystal', tex: 'sheen', frame: 'glow', coords: 'in', hl: 'purple' }],
    ['Neon night', 'Glowing pieces on a dark grid', { theme: 'neon', pieces: 'classic', finish: 'neon', tex: 'flat', frame: 'glow', coords: 'in', grid: 1, hl: 'purple' }],
    ['Pixel arcade', '8-bit pieces on a circuit board', { theme: 'terminal', pieces: 'pixel', finish: 'flat', tex: 'circuit', frame: 'pixel', coords: 'off', grid: 1, hl: 'green', radius: 0 }],
    ['Terminal', 'Green letters on a dark grid', { theme: 'terminal', pieces: 'letters', finish: 'flat', tex: 'grid', frame: 'glow', coords: 'in', hl: 'green', radius: 0 }],
    ['Blueprint', 'Drafting table blue', { theme: 'blueprint', pieces: 'letters', finish: 'outline', tex: 'grid', frame: 'thin', coords: 'out', hl: 'blue', radius: 0 }],
    ['Studio glass', 'Cool glass on ice', { theme: 'ice', pieces: 'classic', finish: 'gloss', tex: 'soft', frame: 'thin', coords: 'out', hl: 'blue' }],
    ['Crystal frost', 'Translucent pieces, winter light', { theme: 'sky', pieces: 'bubble', finish: 'crystal', tex: 'sheen', frame: 'glow', coords: 'in', hl: 'teal' }],
    ['Candy land', 'Pastel bubbles with icing', { theme: 'rose', pieces: 'bubble', finish: 'candy', tex: 'dots', frame: 'glow', coords: 'in', hl: 'pink', radius: 18 }],
    ['Pumpkin night', 'Halloween bubbles', { theme: 'pumpkin', pieces: 'bubble', finish: 'candy', tex: 'dots', frame: 'glow', coords: 'in', hl: 'orange', radius: 16 }],
    ['Bamboo zen', 'Quiet garden', { theme: 'bamboo', pieces: 'classic', finish: 'flat', tex: 'paper', frame: 'rope', coords: 'in', hl: 'green', radius: 14 }],
    ['Forest floor', 'Green and mossy', { theme: 'forest', pieces: 'totem', finish: 'wood', tex: 'grain', frame: 'wood', coords: 'in', hl: 'green', radius: 10 }],
    ['Desert dunes', 'Carved totems in the sand', { theme: 'desert', pieces: 'totem', finish: 'stone', tex: 'waves', frame: 'wood', coords: 'out', hl: 'orange', radius: 8 }],
    ['Espresso', 'Dark carved wood', { theme: 'cocoa', pieces: 'totem', finish: 'wood', tex: 'wood', frame: 'bevel', coords: 'in', hl: 'orange', radius: 6 }],
    ['Runes of the north', 'Carved stone discs', { theme: 'pine', pieces: 'rune', finish: 'stone', tex: 'grain', frame: 'wood', coords: 'in', hl: 'teal', radius: 6 }],
    ['Ocean depths', 'Glass pieces under water', { theme: 'ocean', pieces: 'classic', finish: 'gloss', tex: 'waves', frame: 'bevel', coords: 'in', hl: 'blue', radius: 12 }],
    ['Chrome pro', 'Polished steel for serious games', { theme: 'steel', pieces: 'classic', finish: 'metal', tex: 'sheen', frame: 'metal', coords: 'out', hl: 'blue', radius: 4 }],
    ['Vaporwave', 'Pink and purple haze', { theme: 'vapor', pieces: 'classic', finish: 'crystal', tex: 'checker', frame: 'glow', coords: 'in', hl: 'pink', radius: 10 }],
    ['Cyberpunk', 'Neon city rain', { theme: 'cyber', pieces: 'pixel', finish: 'neon', tex: 'circuit', frame: 'glow', coords: 'in', hl: 'teal', grid: 1 }],
    ['Ink and paper', 'A chess diagram in a book', { theme: 'paper', pieces: 'classic', finish: 'ink', tex: 'paper', frame: 'double', coords: 'out', hl: 'off', radius: 0, grid: 0 }],
    ['Newsprint', 'Black and white like a column', { theme: 'mono', pieces: 'classic', finish: 'outline', tex: 'flat', frame: 'thin', coords: 'out', hl: 'off', radius: 0, grid: 1 }],
    ['Midnight', 'Deep blues, flat pieces', { theme: 'midnight', pieces: 'classic', finish: 'flat', tex: 'soft', frame: 'thin', coords: 'in', hl: 'orange' }],
    ['Silhouette', 'Solid shapes with hard shadows', { theme: 'graphite', pieces: 'classic', finish: 'shadow', tex: 'paper', frame: 'thick', coords: 'out', hl: 'red', radius: 0 }],
    ['Ivory and ebony', 'A gentleman\'s set', { theme: 'porcelain', pieces: 'classic', finish: 'marble', tex: 'marble', frame: 'double', coords: 'out', hl: 'blue', radius: 3 }],
    ['Golden empire', 'Gold on dark stone', { theme: 'ember', pieces: 'roman', finish: 'gold', tex: 'grain', frame: 'ornate', coords: 'in', hl: 'yellow', flair: '#f0c040', radius: 4 }]
  ];

  /* ---------- default piece colours per shape ---------- */
  const SETD = {
    classic: { pw: '#fbfbfd', pb: '#2d2e38' }, roman: { pw: '#f6efe2', pb: '#3b2f2a' }, gothic: { pw: '#f2f3f7', pb: '#2a2c36' },
    pixel: { pw: '#e9f7e9', pb: '#2f3b34' }, bubble: { pw: '#ffe3ef', pb: '#5a3b52' }, totem: { pw: '#e8cfa8', pb: '#5a3f28' },
    rune: { pw: '#e7e4dc', pb: '#3c3f46' }, glyph: { pw: '#ffffff', pb: '#14161c' }, letters: { pw: '#f1f1f4', pb: '#30313b' },
    flat: { pw: '#f4f4f7', pb: '#34353f' }, neon: { pw: '#5ff3ff', pb: '#ff6ad5' }
  };

  /* ---------- geometry ---------- */
  /* classic: the original drawn pieces */
  const CLASSIC = {
    1: '<circle class="ps" cx="22.5" cy="13.5" r="5.2"/><path class="ps" d="M15.5 36C16 29 18.5 25 22.5 22.5 26.5 25 29 29 29.5 36Z"/><ellipse class="ps" cx="22.5" cy="21.5" rx="6.6" ry="2"/><path class="ps" d="M12 39.5C12 37 14 36 16 36H29C31 36 33 37 33 39.5Z"/>',
    2: '<path class="ps" d="M13 39.5C13 33 14 28.5 18 24.5 19.5 23 20.5 21.5 20 19.5 18 20.2 16.5 21.5 15 23.5L12.5 22C13.5 18 16 15.5 19 13.2L18.2 9.5 22.2 11.8C23.3 11.5 24.4 11.4 25.6 11.5 32 12 35 18 34.5 26 34.2 31 33.5 35 33 39.5Z"/><circle class="pd" cx="22.8" cy="16.8" r="1.25"/><circle class="pd" cx="14.7" cy="21.6" r=".85"/><path class="pl" d="M26 14.5C29 16 30.5 19 30.5 23"/>',
    3: '<circle class="ps" cx="22.5" cy="9" r="2.5"/><path class="ps" d="M22.5 12C28 15.5 29.5 20 27.5 24.5 26.5 26.5 24.5 27.5 22.5 27.5 20.5 27.5 18.5 26.5 17.5 24.5 15.5 20 17 15.5 22.5 12Z"/><path class="pl" d="M22.5 15.5V21M20 18.2H25"/><path class="ps" d="M16 28H29L30.5 31.5H14.5Z"/><path class="ps" d="M18.5 31.5H26.5L27.5 35H17.5Z"/><path class="ps" d="M12.5 39.5C12.5 37.5 14 35 16 35H29C31 35 32.5 37.5 32.5 39.5Z"/>',
    4: '<path class="ps" d="M13 10.5H17.2V13.5H20.6V10.5H24.4V13.5H27.8V10.5H32V17H13Z"/><path class="ps" d="M15.2 17H29.8L28.6 31H16.4Z"/><path class="ps" d="M13.5 31H31.5V35H13.5Z"/><path class="ps" d="M11.5 39.5C11.5 37.5 12.5 35 14 35H31C32.5 35 33.5 37.5 33.5 39.5Z"/>',
    5: '<path class="ps" d="M10.5 14L14 29H31L34.5 14 28.7 22 26.7 11 22.5 21 18.3 11 16.3 22Z"/><circle class="ps" cx="10.5" cy="12.5" r="2.2"/><circle class="ps" cx="16.3" cy="9" r="2.2"/><circle class="ps" cx="22.5" cy="7.8" r="2.2"/><circle class="ps" cx="28.7" cy="9" r="2.2"/><circle class="ps" cx="34.5" cy="12.5" r="2.2"/><path class="ps" d="M14 29H31V32.5H14Z"/><path class="ps" d="M16.5 32.5H28.5L30 36H15Z"/><path class="ps" d="M11.5 39.5C11.5 37.5 12.5 36 15 36H30C32.5 36 33.5 37.5 33.5 39.5Z"/>',
    6: '<path class="ps" d="M21 3.5H24V6.5H27V9.5H24V12.5H21V9.5H18V6.5H21Z"/><path class="ps" d="M22.5 14C30 14 33 19 32 24.5 31.5 27.5 30 29 29.5 31H15.5C15 29 13.5 27.5 13 24.5 12 19 15 14 22.5 14Z"/><path class="ps" d="M14 31H31V34H14Z"/><path class="ps" d="M11.5 39.5C11.5 37 13 34 15 34H30C32 34 33.5 37 33.5 39.5Z"/>'
  };

  /* roman: cute little soldiers. .pa is the accent (crest, cloak, shield boss), .ph a highlight */
  const ROMAN = {
    1: '<path class="pa" d="M22.5 2.4C25.8 4.8 27.2 7.9 26.9 11.4H18.1C17.8 7.9 19.2 4.8 22.5 2.4Z"/>' +
      '<path class="ps" d="M14.1 18.2c0-6.1 3.8-9.2 8.4-9.2s8.4 3.1 8.4 9.2Z"/><path class="ps" d="M12.6 18.2h19.8v3.1H12.6Z"/>' +
      '<circle class="pd" cx="19.6" cy="15.3" r="1.2"/><circle class="pd" cx="25.4" cy="15.3" r="1.2"/>' +
      '<path class="ph" d="M18.2 11.6c1-1.4 2.5-2.1 4.3-2.1"/>' +
      '<path class="ps" d="M16.3 21.3h12.4c1.6 0 2.6 1.4 2.6 3.4v11.9c0 1.6-1 2.6-2.6 2.6H16.3c-1.6 0-2.6-1-2.6-2.6V24.7c0-2 1-3.4 2.6-3.4Z"/>' +
      '<path class="ps" d="M12.1 25.2h10.7v15.6H12.1Z"/><circle class="pa" cx="17.4" cy="33" r="2.3"/>' +
      '<path class="pl" d="M34.1 7.6v32.4"/><path class="ps" d="M34.1 3.4l2.2 4.6h-4.4Z"/>' +
      '<path class="ps" d="M18.4 39.2h3.6v3.4h-3.6Z"/><path class="ps" d="M25 39.2h3.6v3.4H25Z"/>',
    2: '<path class="ps" d="M13 39.5C13 33 14 28.5 18 24.5 19.5 23 20.5 21.5 20 19.5 18 20.2 16.5 21.5 15 23.5L12.5 22C13.5 18 16 15.5 19 13.2L18.2 9.5 22.2 11.8C23.3 11.5 24.4 11.4 25.6 11.5 32 12 35 18 34.5 26 34.2 31 33.5 35 33 39.5Z"/>' +
      '<circle class="pd" cx="22.8" cy="16.8" r="1.3"/><circle class="pd" cx="14.9" cy="21.7" r=".9"/>' +
      '<path class="pa" d="M21.6 6.4c2.2-1.6 4.6-1.8 7-.6 1.6 2.5 2.3 5.4 2.1 8.6l-3.4.5c.2-3-.7-5.3-2.6-6.9Z"/>' +
      '<path class="pl" d="M25.4 14.6c2.6 1.6 4 4.4 4.2 8.4"/><path class="pl" d="M30.8 22.4c1.4.6 2.4 1.8 3 3.4"/>' +
      '<path class="ph" d="M15.4 27.6c1 2 2.2 3.2 3.6 3.8"/>',
    3: '<circle class="pa" cx="22.5" cy="3.6" r="2.4"/>' +
      '<path class="ps" d="M22.5 5.6c5.4 3.6 8 8.4 8 14.2 0 3.4-1.4 5.8-3.4 7.4h-9.2c-2-1.6-3.4-4-3.4-7.4 0-5.8 2.6-10.6 8-14.2Z"/>' +
      '<circle class="pd" cx="19.8" cy="17.4" r="1.35"/><circle class="pd" cx="25.2" cy="17.4" r="1.35"/>' +
      '<path class="ph" d="M17.8 11.8c1.2-1.6 2.8-2.6 4.7-3"/>' +
      '<path class="ps" d="M14.4 26.4h16.2l2.2 7.2H12.2Z"/>' +
      '<path class="ps" d="M15.8 33.6h13.4l1.4 5.6H14.4Z"/>' +
      '<path class="ps" d="M9.8 43.4c0-2.6 1.6-4.2 4-4.2h17.4c2.4 0 4 1.6 4 4.2Z"/>' +
      '<path class="pl" d="M34.6 12.4v31"/><circle class="pa" cx="34.6" cy="10" r="2.6"/>',
    4: '<path class="pl" d="M22.5 2.4v9"/><path class="pa" d="M22.5 2.6h8.4l-2.2 3 2.2 3h-8.4Z"/>' +
      '<path class="ps" d="M10.8 8.4h5v3.8h4.1V8.4h5v3.8h4.1V8.4h5.2v10.2H10.8Z"/>' +
      '<path class="ps" d="M13.4 18.6h18.2l-1.6 15.4H15Z"/>' +
      '<circle class="pa" cx="22.5" cy="25.6" r="2.8"/>' +
      '<path class="ph" d="M16.6 21.4v3.6M28.4 21.4v3.6"/>' +
      '<path class="ps" d="M10.4 34h24.2v4.4H10.4Z"/>' +
      '<path class="ps" d="M9.6 43.4c0-2.4 1.2-5 3-5h19.8c1.8 0 3 2.6 3 5Z"/>',
    5: '<path class="ps" d="M11.6 9.4l4.2 13.4h13.4l4.2-13.4-5.6 8-2.6-9.6-2.7 10.4-2.7-10.4-2.6 9.6Z"/>' +
      '<circle class="ps" cx="11.6" cy="7.2" r="2.4"/><circle class="ps" cx="17.6" cy="4" r="2.4"/><circle class="ps" cx="22.5" cy="2.8" r="2.4"/><circle class="ps" cx="27.4" cy="4" r="2.4"/><circle class="ps" cx="33.4" cy="7.2" r="2.4"/>' +
      '<circle class="pd" cx="19.6" cy="18.2" r="1.3"/><circle class="pd" cx="25.4" cy="18.2" r="1.3"/>' +
      '<path class="pa" d="M19.4 22.8h6.2l1.6 8.6h-9.4Z"/>' +
      '<path class="ps" d="M16.4 31.4h12.2l1.4 6.2H15Z"/>' +
      '<path class="ps" d="M9.8 43.4c0-2.6 1.6-4.4 4-4.4h17.4c2.4 0 4 1.8 4 4.4Z"/>' +
      '<path class="pl" d="M35.2 14.6v28.8"/><circle class="pa" cx="35.2" cy="12.6" r="2.3"/>',
    6: '<path class="ps" d="M19.6 2.8h5.8v2.8h3v4.4h-3v2.8h-5.8v-2.8h-3V5.6h3Z"/>' +
      '<path class="ps" d="M14.6 16.6c0-4.6 3.4-7.6 7.9-7.6s7.9 3 7.9 7.6Z"/><path class="ps" d="M12.6 16.6h19.8v3.6H12.6Z"/>' +
      '<path class="pa" d="M15.8 12.6c1.8-3 4.3-4.6 6.7-4.6l.4 3.6c-1.6 0-3 .8-4.2 2.2Zm13.4 0c-1.8-3-4.3-4.6-6.7-4.6l-.4 3.6c1.6 0 3 .8 4.2 2.2Z"/>' +
      '<circle class="pd" cx="19.4" cy="13.2" r="1.3"/><circle class="pd" cx="25.6" cy="13.2" r="1.3"/>' +
      '<path class="pa" d="M13.4 20.2l-3.6 12h5.4Zm18.2 0l3.6 12h-5.4Z"/>' +
      '<path class="ps" d="M16.6 20.2h11.8l1.8 11.2H14.8Z"/>' +
      '<path class="ps" d="M15.4 31.4h14.2l1.4 6.2H14Z"/>' +
      '<path class="ps" d="M9.6 43.4c0-2.8 1.6-4.6 4.2-4.6h17.4c2.6 0 4.2 1.8 4.2 4.6Z"/>' +
      '<path class="pl" d="M36.4 5.6v32.8"/><path class="ps" d="M36.4 2.4l2.6 3.6-2.6 3.6Z"/>'
  };

  /* gothic: tall and angular */
  const GOTHIC = {
    1: '<circle class="pd" cx="22.5" cy="4.8" r="1.7"/><path class="ps" d="M22.5 7.4L16.7 28.6h11.6Z"/><path class="ps" d="M15.4 28.6h14.2v4.2H15.4Z"/><path class="ps" d="M12.4 39.6c0-3 1.6-6.8 3.2-6.8h13.8c1.6 0 3.2 3.8 3.2 6.8Z"/>',
    2: '<path class="ps" d="M13.4 39.6c0-8.6 1.4-14.6 5.6-18.6 2.2-2.1 3.6-4.2 3.8-6.6-2 .8-3.5 2.2-4.8 4.2l-3-2.4c1.4-4.4 4.4-7.4 7.8-9.6l-.6-3.4 4.2 2.4c6.4 1.4 10 6.8 10 15v19Z"/><circle class="pd" cx="24.2" cy="18.2" r="1.3"/><path class="pl" d="M26.8 12.4c2.6 1.6 4 4.4 4.2 8.4"/>',
    3: '<path class="ps" d="M22.5 4.2c4.4 4 6.6 9 6.6 14.6 0 3-1 5-2.4 6.4h-8.4c-1.4-1.4-2.4-3.4-2.4-6.4 0-5.6 2.2-10.6 6.6-14.6Z"/><path class="pl" d="M22.5 10.4v10.4"/><path class="ps" d="M18 25.2h9l1.6 6.4H16.4Z"/><path class="ps" d="M12 39.6c0-4 1.8-7.8 3.6-7.8h13.8c1.8 0 3.6 3.8 3.6 7.8Z"/>',
    4: '<path class="ps" d="M11 6.6h4.6v4h3.4v-4h4.6v4h3.4v-4H31v11H11Z"/><path class="ps" d="M13.6 17.6h17.8l-1.8 16.4H15.4Z"/><path class="ps" d="M11 34h23v5.6H11Z"/>',
    5: '<circle class="pd" cx="22.5" cy="6.2" r="2"/><path class="ps" d="M9.6 12.6l3.4 12.8h19l3.4-12.8-5.4 7.4-3.4-9.6-3.6 9.6-3.6-9.6-3.4 9.6Z"/><path class="ps" d="M11.6 25.4h21.8l1.8 6.4H9.8Z"/><path class="ps" d="M12.6 39.6c0-3.4 1.4-7.8 3.4-7.8h13c2 0 3.4 4.4 3.4 7.8Z"/>',
    6: '<path class="ps" d="M20.4 3.6h4.2v3.4h3.4v4.2h-3.4v3.4h-4.2v-3.4H17v-4.2h3.4Z"/><path class="ps" d="M11 18.6c0-5 5.2-8.6 11.5-8.6s11.5 3.6 11.5 8.6Z"/><path class="ps" d="M12.4 18.6h20.2v3.6H12.4Z"/><path class="ps" d="M13.6 22.2h17.8l1.6 8.4H12Z"/><path class="ps" d="M11.4 39.6c0-3.4 1.6-8 3.6-8h15c2 0 3.6 4.6 3.6 8Z"/>'
  };

  /* bubble: roly-poly cartoon pieces with faces */
  const BUBBLE = {
    1: '<circle class="ps" cx="22.5" cy="14.4" r="8.2"/><path class="ps" d="M22.5 20.8c6.4 0 11.6 4.4 11.6 9.8S28.9 40.4 22.5 40.4 10.9 36 10.9 30.6 16.1 20.8 22.5 20.8Z"/>' +
      '<circle class="pd" cx="19.4" cy="13.8" r="1.6"/><circle class="pd" cx="25.6" cy="13.8" r="1.6"/><path class="pd" d="M19.8 18.6c1.7 1.2 3.7 1.2 5.4 0l-1-1.4h-3.4Z"/><path class="ph" d="M17.6 9.8a3.4 3.4 0 0 1 3.4-2"/>',
    2: '<path class="pa" d="M22.5 4.2c2.8 1.2 4.2 3.4 4.2 6.6h-8.4c0-3.2 1.4-5.4 4.2-6.6Z"/><circle class="ps" cx="22.5" cy="15" r="7.8"/>' +
      '<path class="ps" d="M14.2 22.4c3.6-1.8 7.2.8 13 .4l3 13H13.4Z"/>' +
      '<circle class="pd" cx="19.6" cy="14.6" r="1.6"/><circle class="pd" cx="25.4" cy="14.6" r="1.6"/><path class="ph" d="M17.8 10.6a3.2 3.2 0 0 1 3.2-1.8"/>',
    3: '<path class="ps" d="M22.5 5.6c4.6 3.6 6.9 8 6.9 13.2 0 3.2-1.4 5.6-3.2 7.2h-7.4c-1.8-1.6-3.2-4-3.2-7.2 0-5.2 2.3-9.6 6.9-13.2Z"/>' +
      '<circle class="pa" cx="22.5" cy="4.6" r="2.6"/><circle class="pd" cx="20.2" cy="16.6" r="1.6"/><circle class="pd" cx="24.8" cy="16.6" r="1.6"/>' +
      '<path class="ps" d="M22.5 26c5.4 0 9.8 4 9.8 8.6S28 39.6 22.5 39.6 12.7 39.2 12.7 34.6 17.1 26 22.5 26Z"/><path class="ph" d="M18.6 10.4a3.6 3.6 0 0 1 3.4-2.2"/>',
    4: '<path class="ps" d="M12.4 9.4h4.6v3.8h4.2V9.4h4.6v3.8h4.2V9.4h4.6v9.8H12.4Z"/><path class="ps" d="M14.8 19.2h15.4c2.4 0 4 2 4 4.6v11.6c0 2.6-1.6 4.6-4 4.6H14.8c-2.4 0-4-2-4-4.6V23.8c0-2.6 1.6-4.6 4-4.6Z"/>' +
      '<circle class="pd" cx="18.4" cy="27.4" r="1.6"/><circle class="pd" cx="26.6" cy="27.4" r="1.6"/><path class="pa" d="M22.5 31.4h.01l-.01 3.4"/><path class="ph" d="M15.8 13.2h2.4"/>',
    5: '<path class="ps" d="M11.4 11.6l3.6 12.8h15l3.6-12.8-5.2 7.6-3.2-9.6-3.2 9.6-3.2-9.6-5.2 7.6Z"/>' +
      '<circle class="ps" cx="11.4" cy="9.6" r="2.4"/><circle class="ps" cx="17.6" cy="6.4" r="2.4"/><circle class="ps" cx="22.5" cy="5.2" r="2.4"/><circle class="ps" cx="27.4" cy="6.4" r="2.4"/><circle class="ps" cx="33.6" cy="9.6" r="2.4"/>' +
      '<circle class="pd" cx="19.4" cy="18.6" r="1.6"/><circle class="pd" cx="25.6" cy="18.6" r="1.6"/>' +
      '<path class="ps" d="M22.5 25.4c6.6 0 12 4.4 12 9.6S29.1 39.8 22.5 39.8 10.5 39.8 10.5 35s5.4-9.6 12-9.6Z"/><path class="ph" d="M17.4 13.2a3 3 0 0 1 3-1.8"/>',
    6: '<path class="ps" d="M21 4.6h3v3.2h3.2v3.4H24v3.2h-3v-3.2h-3.2V7.8H21Z"/><path class="ps" d="M22.5 16.4c7.6 0 12.6 5 12.6 10.8S30.1 39.8 22.5 39.8 9.9 39.4 9.9 33.6 14.9 16.4 22.5 16.4Z"/>' +
      '<circle class="pd" cx="18.6" cy="21.4" r="1.7"/><circle class="pd" cx="26.4" cy="21.4" r="1.7"/><path class="pa" d="M16.6 31.6c3.8-2.2 7.6-2.2 11.4 0l-2 3.4c-2.4-1.4-4.8-1.4-7.2 0Z"/><path class="ph" d="M16.4 28.4a4 4 0 0 1 4-2.6"/>'
  };

  /* pixel: 9x9 blocky maps, drawn as merged rectangles */
  const PIXMAP = {
    1: ['....X....', '...XXX...', '..XXXXX..', '...XXX...', '..XXXXX..', '.XXXXXXX.', 'XXXXXXXXX', 'XXXXXXXXX', 'XXXXXXXXX'],
    2: ['.....XX..', '....XXXX.', '...XXXXXX', '..XXXXXXX', '..XXXXXXX', '...XXXXXX', '...XXXXX.', '..XXXXXXX', 'XXXXXXXXX'],
    3: ['...XX....', '..XXXX...', '...XX....', '..XXXX...', '.XXXXXX..', '.XXXXXX..', '..XXXX...', '.XXXXXX..', 'XXXXXXXXX'],
    4: ['.XX.XX.XX', '.XXXXXXX.', '.XXXXXXX.', '..XXXXX..', '..XXXXX..', '..XXXXX..', '.XXXXXXX.', '.XXXXXXX.', 'XXXXXXXXX'],
    5: ['.X..X..X.', '.X.XXX.X.', '.XXXXXXX.', '..XXXXX..', '..XXXXX..', '..XXXXX..', '.XXXXXXX.', '.XXXXXXX.', 'XXXXXXXXX'],
    6: ['...XX....', '.XXXXXX..', '...XX....', '..XXXXX..', '..XXXXX..', '...XXX...', '..XXXXX..', '.XXXXXXX.', 'XXXXXXXXX']
  };
  const pix = n => {
    const rows = PIXMAP[n] || PIXMAP[1], out = [];
    rows.forEach((row, y) => {
      let x = 0;
      while (x < 9) {
        if (row[x] !== 'X') { x++; continue; }
        let w = 1; while (x + w < 9 && row[x + w] === 'X') w++;
        out.push('<rect class="ps" x="' + (x * 5) + '" y="' + (y * 5) + '" width="' + (w * 5) + '" height="5"/>');
        x += w;
      }
    });
    return out.join('') + '<rect class="pd" x="15" y="10" width="5" height="5"/><rect class="pd" x="25" y="10" width="5" height="5"/>';
  };

  /* totem: a carved column, a different top for every piece */
  const tier = (y, h, wt, wb) => 'M' + (22.5 - wt / 2) + ' ' + y + 'H' + (22.5 + wt / 2) + 'L' + (22.5 + wb / 2) + ' ' + (y + h) + 'H' + (22.5 - wb / 2) + 'Z';
  const totem = top => '<path class="ps" d="' + [tier(13, 9.4, 15, 18.4), tier(23.4, 8.6, 18.4, 15), tier(32, 9, 15, 20)].join(' ') + '"/>' + top +
    '<circle class="pd" cx="19.4" cy="16.4" r="1.25"/><circle class="pd" cx="25.6" cy="16.4" r="1.25"/>' +
    '<path class="pl" d="M15.6 26.4h13.8"/><path class="pl" d="M16.4 34.6h12.2"/>';
  const TOTEM = {
    1: totem('<circle class="ps" cx="22.5" cy="8.6" r="4.6"/>'),
    2: totem('<path class="ps" d="M14.8 13.2c0-4.6 3-7.6 7.7-7.6 3.2 0 5.6 1.4 7 4.2l3.2 3-4 2.6Z"/>'),
    3: totem('<path class="ps" d="M22.5 3.4l6.2 10.2H16.3Z"/><path class="pa" d="M22.5 3.4l1.8 3.2h-3.6Z"/>'),
    4: totem('<path class="ps" d="M14.6 3.8h15.8v9.8H14.6Z"/><path class="ps" d="M17.4 3.8h3.4v3h-3.4Zm5.7 0h3.4v3h-3.4Z"/>'),
    5: totem('<path class="ps" d="M13.4 13.6l2.8-9.8 3.4 6.4 3-8 3 8 3.4-6.4 2.8 9.8Z"/><circle class="pa" cx="22.5" cy="3.4" r="1.7"/>'),
    6: totem('<path class="ps" d="M21.4 2.6h2.2v2.6H26v2.2h-2.4v2.6h-2.2V7.4H19V5.2h2.4Z"/><path class="ps" d="M12.8 13.6l3-10 4.2 7.4 2.5-9.4 2.5 9.4 4.2-7.4 3 10Z"/>')
  };

  /* rune: stone discs carved with elder letters */
  const RUNE = {
    1: 'M19.6 13.6v18.2M19.6 13.6l5.8 6.8-5.8 6.6',
    2: 'M18.4 13.6v18.2M18.4 13.6l7.2 8.6-7.2 9.6M25.6 22.2h3.8',
    3: 'M19 13.6v18.2M19 13.6h5.4a4.4 4.4 0 0 1 0 8.8H19M19 22.4h6.2a4.4 4.4 0 0 1 0 9.4H19',
    4: 'M18.6 13.6l7.4 18.2M25.8 13.6l-7.2 18.2M20.4 22.4h4.2',
    5: 'M18.2 13.6v18.2M18.2 13.6l7.4 8.8M25.6 13.6l-7.4 8.8M18.2 31.8h7.4',
    6: 'M17.8 13.4v8.6l4.7 2.8v7.6M27.2 13.4v8.6l-4.7 2.8M17.8 22h9.4'
  };
  const rune = n => '<circle class="ps" cx="22.5" cy="22.6" r="16.4"/><circle class="pl" cx="22.5" cy="22.6" r="13"/>' +
    '<path class="pl" d="' + RUNE[n] + '"/>' + (n >= 5 ? '<path class="pa" d="M22.5 1.4l6.2 5.6H16.3Z"/>' : '<circle class="pa" cx="22.5" cy="4.2" r="2.1"/>');

  const SV = { classic: CLASSIC, roman: ROMAN, gothic: GOTHIC, bubble: BUBBLE, totem: TOTEM };
  const LET = { 1: 'P', 2: 'N', 3: 'B', 4: 'R', 5: 'Q', 6: 'K' }, GL = { 1: '♟︎', 2: '♞', 3: '♝', 4: '♜', 5: '♛', 6: '♚' };

  /* ---------- settings ---------- */
  let cfg = Object.assign({}, DEF);
  try { cfg = Object.assign({}, DEF, JSON.parse(localStorage.getItem(KEY) || '{}')); } catch (e) { }
  /* settings written by an older version used "flat" and "neon" as piece sets: keep the same look */
  if (cfg.pieces === 'flat' || cfg.pieces === 'neon') { const f = cfg.pieces; cfg.pieces = 'classic'; if (!cfg.finish) cfg.finish = f; }
  if (!SHAPENAME[cfg.pieces]) cfg.pieces = 'classic';
  if (cfg.finish && !ALLFIN.includes(cfg.finish)) cfg.finish = '';
  const boards = new Set(); let st = null;

  const finishOf = () => cfg.finish || SHAPEDEF[shapeOf(cfg.pieces)] || 'outline';
  const finDef = sh => SHAPEDEF[shapeOf(sh)] || 'outline';

  /* ---------- one piece ---------- */
  const html = (p, set, fin) => {
    const t = Math.abs(p), c = p > 0 ? 'w' : 'b';
    const shape = shapeOf(set === undefined || set === null ? cfg.pieces : set);
    const finish = fin || (set === undefined || set === null ? finishOf() : finDef(shape));
    if (shape === 'glyph') return '<span class="pc ' + c + '">' + GL[t] + '</span>';
    if (shape === 'letters') return '<span class="pc ' + c + ' svg letters f-' + finish + '"><svg viewBox="0 0 45 45"><circle class="ps" cx="22.5" cy="22.5" r="17.5"/><text class="pt" x="22.5" y="29.5" text-anchor="middle">' + LET[t] + '</text></svg></span>';
    const body = shape === 'pixel' ? pix(t) : shape === 'rune' ? rune(t) : (SV[shape] || CLASSIC)[t];
    return '<span class="pc ' + c + ' svg ' + shape + ' f-' + finish + '"><svg viewBox="0 0 45 45">' + body + '</svg></span>';
  };

  /* ---------- the style sheet ---------- */
  const th = () => THEMES.find(x => x[0] === cfg.theme) || THEMES[0];
  const css = () => {
    const D = SETD[shapeOf(cfg.pieces)] || SETD.classic, pw = cfg.pw || D.pw, pb = cfg.pb || D.pb, o = [], R = ':root';
    const sz = cfg.size ? 'min(' + cfg.size + 'px,calc((100vw - 44px)/8))' : 'clamp(34px,min(calc((100vw - 56px)/8),calc((100vh - 280px)/8)),' + cfg.maxsz + 'px)';
    const kw = cfg.outline === 'none' ? 0 : cfg.outline === 'bold' ? 2.6 : 1.6;
    const t = th(); let L = t[2], Dk = t[3]; if (cfg.theme === 'custom') { L = cfg.lightC; Dk = cfg.darkC; }
    const v = ['--csz:' + sz, '--cps:' + cfg.pscale / 100, '--pw:' + pw, '--pb:' + pb, '--pkw:' + kw, '--cbr:' + cfg.radius + 'px',
      '--hlast:' + (HL[cfg.hl] || HL.yellow), '--cco:' + cfg.coordSize / 100, '--pflair:' + (cfg.flair || '#c0392b')];
    if (L && Dk) v.push('--sqL:' + L, '--sqD:' + Dk);
    o.push('html:root{' + v.join(';') + '}');
    o.push('.acb{--sz:var(--csz,56px);border-radius:var(--cbr,10px)}');
    o.push('.acb .pc.w{--pf:var(--pw);--pk:color-mix(in srgb,var(--pw) 18%,#000)}.acb .pc.b{--pf:var(--pb);--pk:color-mix(in srgb,var(--pb) 30%,#fff)}');
    o.push('.acb .pc:not(.svg){font-size:calc(var(--sz)*.82*var(--cps,1));color:var(--pf);-webkit-text-stroke:calc(var(--pkw,1.6)*.55px) var(--pk)}');
    o.push('.acb .pc.svg{width:calc(var(--sz)*.94*var(--cps,1));height:calc(var(--sz)*.94*var(--cps,1));display:block;font-size:0}.acb .pc.svg svg{width:100%;height:100%;overflow:visible;display:block}');
    /* the parts a piece is drawn from: shape, detail, line, accent and highlight */
    o.push('.acb .pc.svg .ps{fill:var(--pf);stroke:var(--pk);stroke-width:var(--pkw,1.6);stroke-linejoin:round;stroke-linecap:round}' +
      '.acb .pc.svg .pd{fill:var(--pk);stroke:none}.acb .pc.svg .pl{fill:none;stroke:var(--pk);stroke-width:1.5;stroke-linecap:round}' +
      '.acb .pc.svg .pa{fill:var(--pflair);stroke:color-mix(in srgb,var(--pflair) 60%,#000);stroke-width:.8;stroke-linejoin:round}' +
      '.acb .pc.svg .ph{fill:none;stroke:rgba(255,255,255,.7);stroke-width:1.5;stroke-linecap:round}' +
      '.acb .pc.svg .pt{fill:var(--pk);stroke:none;font:700 21px Georgia,serif}');
    /* finishes */
    const F = {};
    F.outline = '';
    F.flat = '.acb .pc.f-flat .ps{stroke:none}.acb .pc.f-flat .pa{stroke:none}.acb .pc.f-flat svg{filter:drop-shadow(0 1.5px 1.5px rgba(0,0,0,.4))}' +
      /* a dark piece disappears on a dark board, so flat black pieces get a thin lit rim (the drawing itself is unchanged) */
      '.acb .pc.b.f-flat svg{filter:drop-shadow(0 1.5px 1.5px rgba(0,0,0,.45)) drop-shadow(0 0 1px rgba(255,255,255,.6))}' +
      '.acb .pc.w.f-flat svg{filter:drop-shadow(0 1.5px 1.5px rgba(0,0,0,.45)) drop-shadow(0 0 1px rgba(0,0,0,.28))}';
    F.gloss = '.acb .pc.f-gloss .ps{fill-opacity:.62;stroke:color-mix(in srgb,var(--pf) 40%,#fff);stroke-width:1.5}.acb .pc.f-gloss .pd{fill:#fff;fill-opacity:.92}.acb .pc.f-gloss .ph{stroke-width:2}' +
      '.acb .pc.f-gloss svg{filter:drop-shadow(0 0 2px color-mix(in srgb,var(--pf) 60%,#fff))}';
    F.metal = '.acb .pc.f-metal .ps{stroke-width:1.1;stroke:color-mix(in srgb,var(--pf) 35%,#000)}.acb .pc.f-metal .pd{fill:color-mix(in srgb,var(--pf) 45%,#000)}.acb .pc.f-metal .pl{stroke:color-mix(in srgb,var(--pf) 40%,#000)}' +
      '.acb .pc.f-metal svg{filter:drop-shadow(1.2px -1.2px 0 color-mix(in srgb,var(--pf) 25%,#fff)) drop-shadow(-1.2px 1.2px 0 color-mix(in srgb,var(--pf) 65%,#000))}';
    F.gold = '.acb .pc.f-gold .ps{fill:color-mix(in srgb,var(--pf) 72%,#f5c542);stroke:color-mix(in srgb,var(--pf) 45%,#5a3f06);stroke-width:1.2}.acb .pc.f-gold .pd{fill:color-mix(in srgb,var(--pf) 40%,#3d2a04)}.acb .pc.f-gold .pl{stroke:color-mix(in srgb,var(--pf) 40%,#4a3405)}' +
      '.acb .pc.f-gold svg{filter:drop-shadow(1.1px -1.1px 0 rgba(255,241,180,.85)) drop-shadow(-1.1px 1.1px 0 rgba(90,60,0,.6))}';
    F.wood = '.acb .pc.f-wood .ps{fill:var(--pf);stroke:color-mix(in srgb,var(--pf) 45%,#4a2f16);stroke-width:1.9}.acb .pc.f-wood .pl{stroke:color-mix(in srgb,var(--pf) 35%,#33200e);stroke-width:1.5;stroke-dasharray:1.2 .9}' +
      '.acb .pc.f-wood .pd{fill:color-mix(in srgb,var(--pf) 35%,#33200e)}.acb .pc.f-wood .pa{fill:color-mix(in srgb,var(--pflair) 70%,#4a2f16)}' +
      '.acb .pc.f-wood svg{filter:url(#ch-grain)}';
    F.marble = '.acb .pc.f-marble .ps{fill:color-mix(in srgb,var(--pf) 84%,#fff);stroke:color-mix(in srgb,var(--pf) 55%,#8d94a6);stroke-width:1.3}.acb .pc.f-marble .pl{stroke:color-mix(in srgb,var(--pf) 45%,#6b7280);stroke-width:1;stroke-dasharray:2.4 1.2}' +
      '.acb .pc.f-marble .pd{fill:color-mix(in srgb,var(--pf) 45%,#5c6270)}.acb .pc.f-marble svg{filter:drop-shadow(0 1.4px 1.2px rgba(0,0,0,.28))}';
    F.stone = '.acb .pc.f-stone .ps{fill:color-mix(in srgb,var(--pf) 72%,#8c8f96);stroke:color-mix(in srgb,var(--pf) 45%,#2b2d33);stroke-width:2.3}.acb .pc.f-stone .pd{fill:color-mix(in srgb,var(--pf) 35%,#2b2d33)}' +
      '.acb .pc.f-stone .pl{stroke:color-mix(in srgb,var(--pf) 40%,#3a3d44);stroke-width:1.8}.acb .pc.f-stone svg{filter:drop-shadow(1px 1.6px 0 rgba(0,0,0,.32))}';
    F.candy = '.acb .pc.f-candy .ps{fill:var(--pf);stroke:#fff;stroke-width:2.1}.acb .pc.f-candy .pd{fill:rgba(255,255,255,.85)}.acb .pc.f-candy .pl{stroke:rgba(255,255,255,.8);stroke-width:2}' +
      '.acb .pc.f-candy svg{filter:drop-shadow(0 2.2px 0 color-mix(in srgb,var(--pf) 55%,#000))}';
    F.crystal = '.acb .pc.f-crystal .ps{fill:var(--pf);fill-opacity:.5;stroke:color-mix(in srgb,var(--pf) 30%,#fff);stroke-width:1.7}.acb .pc.f-crystal .pd{fill:#fff;fill-opacity:.75}' +
      '.acb .pc.f-crystal svg{filter:drop-shadow(0 0 3px var(--pf))}';
    F.neon = '.acb .pc.f-neon .ps{fill:var(--pf);fill-opacity:.16;stroke:var(--pf);stroke-width:2.1}.acb .pc.f-neon .pd{fill:var(--pf)}.acb .pc.f-neon .pl{stroke:var(--pf);stroke-width:2}' +
      '.acb .pc.f-neon svg{filter:drop-shadow(0 0 3px var(--pf)) drop-shadow(0 0 7px var(--pf))}';
    F.ink = '.acb .pc.f-ink .ps{fill:color-mix(in srgb,var(--pf) 82%,#0d0d0d);stroke:#111;stroke-width:1.7}.acb .pc.f-ink .pd{fill:#111}.acb .pc.f-ink .pl{stroke:#111;stroke-width:1.7}' +
      '.acb .pc.f-ink svg{filter:url(#ch-rough)}';
    F.shadow = '.acb .pc.f-shadow .ps{fill:var(--pf);stroke:none}.acb .pc.f-shadow .pd{fill:color-mix(in srgb,var(--pf) 55%,#fff)}.acb .pc.f-shadow .pl{stroke:color-mix(in srgb,var(--pf) 55%,#fff);stroke-width:1.5}' +
      '.acb .pc.f-shadow svg{filter:drop-shadow(2.6px 2.6px 0 rgba(0,0,0,.45))}';
    F.paper = '.acb .pc.f-paper .ps{fill:color-mix(in srgb,var(--pf) 90%,#fff);stroke:color-mix(in srgb,var(--pf) 65%,#222);stroke-width:1.2}.acb .pc.f-paper .pd{fill:color-mix(in srgb,var(--pf) 60%,#222)}' +
      '.acb .pc.f-paper svg{filter:drop-shadow(1.3px 1.3px 0 rgba(0,0,0,.22))}';
    F.matte = '.acb .pc.f-matte .ps{fill:var(--pf);stroke:none}.acb .pc.f-matte .pd{fill:color-mix(in srgb,var(--pf) 45%,#000)}';
    for (const k in F) if (F[k]) o.push(F[k]);
    /* "soft shadow off" means the shadows, not the carved ink/wood texture, which is part of the drawing itself */
    if (!cfg.pshadow) o.push('.acb .pc,.acb .pc svg{filter:none!important}', '.acb .pc.f-wood svg{filter:url(#ch-grain)!important}', '.acb .pc.f-ink svg{filter:url(#ch-rough)!important}');
    /* highlights */
    o.push('.acb .chs.last::after{background:var(--hlast)}');
    if (!cfg.legal) o.push('.acb .bdot,.acb .bring{display:none}');
    if (cfg.dots === 'ring') o.push('.acb .bdot{width:70%;height:70%;background:transparent;border:5px solid rgba(20,30,20,.3)}');
    if (cfg.dots === 'square') o.push('.acb .bdot,.acb .bring{inset:0;width:auto;height:auto;border-radius:0;border:0;background:rgba(20,30,20,.22)!important;position:absolute}.acb .bring{inset:0}');
    if (cfg.dots === 'big') o.push('.acb .bdot{width:44%;height:44%;background:rgba(20,30,20,.3)}');
    if (!cfg.check) o.push('.acb .chs.chk{box-shadow:none}');
    /* the surface of the squares */
    /* the squares' own background shorthand lives in the board's sheet, which loads after this one: the surface is put
       on a selector one level heavier so the texture sits on top of the square colour instead of being cancelled by it */
    const tc = TEXCSS[cfg.tex] || TEXCSS.flat;
    if (tc[0]) o.push('.acbw .acb .chs.l,.acbw .acb .chs.d{background-image:' + tc[0] + (tc[1] ? ';background-size:' + tc[1] : '') + '}');
    if (cfg.grid) o.push('.acb .chs{box-shadow:inset 0 0 0 .5px rgba(0,0,0,.28)}');
    const fr = FRAMECSS[cfg.frame] || FRAMECSS.thin;
    o.push('.acb{border:0!important;box-shadow:' + fr[0] + ',0 12px 30px rgba(0,0,0,.35)!important}.acbw{--fw:' + fr[1] + 'px}');
    /* coordinates */
    o.push('.acbw{--sz:var(--csz,56px);display:grid;grid-template-columns:auto auto;grid-template-rows:auto auto;width:max-content;margin:' + (fr[1] >= 9 ? 12 : 4) + 'px}.acbw .acb{grid-column:2;grid-row:1}.acbw .ranks,.acbw .files{display:none;color:var(--mute);font-weight:600;font-size:calc(var(--sz)*.2*var(--cco,1))}');
    o.push('.acbw[data-co=out] .ranks{display:grid;grid-column:1;grid-row:1;grid-template-rows:repeat(8,var(--sz));align-items:center;justify-items:center;padding-right:calc(var(--fw) + 5px);min-width:calc(var(--sz)*.4)}.acbw[data-co=out] .files{display:grid;grid-column:2;grid-row:2;grid-template-columns:repeat(8,var(--sz));justify-items:center;padding-top:calc(var(--fw) + 3px)}');
    o.push('.acb .co{position:absolute;font-weight:700;line-height:1;pointer-events:none;z-index:1;font-size:calc(var(--sz)*.19*var(--cco,1));opacity:.92}.acb .co.r{top:6%;left:7%}.acb .co.f{bottom:5%;right:7%}.acb .chs.l .co{color:var(--sqD)}.acb .chs.d .co{color:var(--sqL)}');
    /* small boards outside the main one (the scanner's board and palette) get the same piece colours: give them class pcx */
    o.push((o.join('\n').match(/[^{}]*\.acb \.pc[^{}]*\{[^{}]*\}/g) || []).map(r => r.replace(/\.acb \.pc/g, '.pcx .pc')).join(''));
    return o.join('\n');
  };
  /* the two texture filters used by the finishes (no colour in them, so they work for every piece colour) */
  const defs = () => '<svg id="ch-defs" width="0" height="0" style="position:absolute;pointer-events:none" aria-hidden="true" focusable="false"><defs>' +
    '<filter id="ch-rough" x="-15%" y="-15%" width="130%" height="130%"><feTurbulence type="fractalNoise" baseFrequency="0.055" numOctaves="2" seed="7" result="n"/><feDisplacementMap in="SourceGraphic" in2="n" scale="1.7" xChannelSelector="R" yChannelSelector="G"/></filter>' +
    '<filter id="ch-grain" x="-12%" y="-12%" width="124%" height="124%"><feTurbulence type="fractalNoise" baseFrequency="0.9 0.06" numOctaves="3" seed="3" result="g"/><feComposite in="g" in2="SourceGraphic" operator="in" result="gc"/><feBlend in="SourceGraphic" in2="gc" mode="multiply"/></filter>' +
    '</defs></svg>';
  const apply = () => {
    /* the two finish filters live in a hidden svg; it must exist before the sheet that refers to it is applied */
    if (!document.getElementById('ch-defs')) {
      const put = () => { if (!document.getElementById('ch-defs')) { if (document.body) document.body.insertAdjacentHTML('beforeend', defs()); else document.addEventListener('DOMContentLoaded', put, { once: true }); } };
      put();
    }
    if (!st) { st = document.createElement('style'); st.id = 'chset-css'; document.head.appendChild(st); }
    st.textContent = css(); document.documentElement.dataset.cps = cfg.pshadow ? 'on' : 'off';
  };
  const save = () => { try { localStorage.setItem(KEY, JSON.stringify(cfg)); } catch (e) { } };
  const redraw = () => boards.forEach(b => { try { b.draw(); } catch (e) { } });
  const evb = (k, v) => { try { window.ChessAch && ChessAch.event('boardset', { k, v }); } catch (e) { } };
  const set = (k, v) => { cfg[k] = v; save(); apply(); redraw(); evb(k, v); };
  const setMany = o => { Object.assign(cfg, o); save(); apply(); redraw(); for (const k in o) evb(k, o[k]); };
  const KEEP = { sound: 1, vol: 1, anim: 1, size: 1, maxsz: 1 };
  const look = o => { const keep = {}; for (const k in KEEP) keep[k] = cfg[k]; cfg = Object.assign({}, DEF, keep, o); save(); apply(); redraw(); };
  const reset = () => { cfg = Object.assign({}, DEF); save(); apply(); redraw(); };
  /* surprise me: a random board, a random shape and finish, always a readable combination */
  const surprise = () => {
    const P = pick(LOOKS), base = Object.assign({}, P[2]);
    const th = pick(THEMES.filter(t => t[0] !== 'custom' && t[0] !== 'app'))[0];
    const sh = pick(SHAPES)[0], fi = pick(FINISHES)[0];
    const many = Object.assign({ tex: pick(TEX)[0], frame: pick(FRAMES)[0], hl: pick(Object.keys(HL))[0], radius: pick([0, 4, 8, 14, 20]), grid: pick([0, 0, 1]) }, base, { theme: th, pieces: sh, finish: fi, pw: '', pb: '' });
    look(many);
    for (const k in many) evb(k, many[k]);
    return { look: P[0], theme: (THEMES.find(t => t[0] === th) || [])[1] || th, shape: SHAPENAME[sh], finish: FINNAME[fi] };
  };
  const pick = a => a[Math.floor(Math.random() * a.length)];

  /* ---------- coordinates (called by Board.draw) ---------- */
  const labels = flipped => { const f = [], r = []; for (let i = 0; i < 8; i++) { f.push('abcdefgh'[flipped ? 7 - i : i]); r.push(flipped ? i + 1 : 8 - i); } return { f, r }; };

  /* ---------- sound: the voices live in sfx.js; this only applies the board's own on/off and volume ---------- */
  const sound = (kind, opp) => { if (!cfg.sound) return; try { if (typeof A !== 'undefined' && A.sfx) A.sfx.chess(kind, !!opp, cfg.vol / 100); } catch (e) { } };
  const animMs = () => ({ off: 0, fast: 120, normal: 240, slow: 440 }[cfg.anim] || 0);

  window.ChessSet = { cfg: () => cfg, experience: (v) => { if (v === undefined) return experience; experience = v === 'legacy' ? 'legacy' : 'modern'; try { localStorage.setItem(MODE_KEY, experience); } catch (e) { } window.dispatchEvent(new CustomEvent('chess:experience', { detail: experience })); return experience; }, openingBook: (v) => { if (v === undefined) return openingBook; openingBook = !!v; try { localStorage.setItem(BOOK_KEY, openingBook ? '1' : '0'); } catch (e) { } return openingBook; }, DEF, THEMES, THEMEGROUPS, HL, SHAPES, FINISHES, TEX, FRAMES, SETD,
    SETS: SHAPES, LOOKS, SHAPEDEF, FINNAME, SHAPENAME, shapeOf, finDef, finishOf, set, setMany, look, reset, surprise, apply, html, labels, sound, animMs, boards, GL,
    exportJson: () => JSON.stringify(cfg), importJson: s => { const j = JSON.parse(s), n = {}; for (const k in DEF) if (k in j && typeof j[k] === typeof DEF[k]) n[k] = j[k]; cfg = Object.assign({}, DEF, n); if (!SHAPENAME[cfg.pieces]) cfg.pieces = 'classic'; if (cfg.finish && !ALLFIN.includes(cfg.finish)) cfg.finish = ''; save(); apply(); redraw(); } };
  apply();
})();

// Chess clock panel shared by every chess page with a game on it (Play, Online, and through Online the Tournament, Career and Clubs games, and Daily).
// The panel (class ckp) sits to the left of the board column inside a .ckw row that centres it on the board; ChessClock.paint(panel, blocks, opts) draws the clocks.
//
// Six designs, chosen once and remembered: the plain panel it always was, a real tournament digital clock with press paddles, an antique analogue
// clock with brass dials and a falling flag, neon, a calm draining bar, and stained glass. The design is a preference (localStorage ck_style) and so
// is the switching: automatic (the side to move always runs, which is the default) or manual, where nothing moves until somebody presses a side.
(() => {
  const hasDoc = typeof document !== 'undefined';
  const esc = s => String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

  /* ---------- the geometry of an analogue dial (kept DOM-free, because tests/run.js checks it) ---------- */
  /* A real tournament clock has no numbers: the hand starts at twelve and sweeps round the whole face over the whole game, so how much
     of the dial is left IS how much time is left. 0 degrees is twelve o'clock, and the hand travels clockwise as the time is used up. */
  function ANG(sec, total) {
    const t = Number(total) || 0, s = Math.max(0, Number(sec) || 0);
    if (!(t > 0)) return 0;
    return (1 - Math.min(1, s / t)) * 360;
  }
  const ANG2 = sec => ((Math.max(0, Number(sec) || 0)) % 60) / 60 * 360;     // the little seconds needle under the middle
  const ROMAN = ['XII', 'I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X', 'XI'];
  /* where a numeral sits on a 100x100 face, 0 = twelve o'clock */
  function romanAt(i, r) {
    const a = i * 30 * Math.PI / 180;
    return { x: 50 + r * Math.sin(a), y: 50 - r * Math.cos(a) };
  }

  /* ---------- the designs ---------- */
  const STYLES = [
    { id: 'classic', name: 'Plain', note: 'The simple panel it has always been: two cards, big digits.' },
    { id: 'tournament', name: 'Tournament digital', note: 'A real chess clock: moulded body, green LCD screens, two press paddles.' },
    { id: 'antique', name: 'Antique analogue', note: 'Brass and walnut, Roman numerals, sweeping hands and a flag that falls.' },
    { id: 'neon', name: 'Neon arcade', note: 'Glowing glass tubes with a scanline and a flicker when you are nearly out.' },
    { id: 'calm', name: 'Calm bar', note: 'Quiet and readable: the time drains away as a thin line.' },
    { id: 'stained', name: 'Stained glass', note: 'Two arched windows that light up for the side to move.' }
  ];
  const IDS = STYLES.map(s => s.id);
  const cfg = () => ({ style: IDS.indexOf(ls.get('ck_style', 'tournament')) >= 0 ? ls.get('ck_style', 'tournament') : 'tournament', manual: ls.get('ck_manual', '0') === '1' });

  /* ---------- stylesheet ---------- */
  const css = `
.ckw{display:flex;gap:16px;align-items:center}
.ckp{width:186px;flex:none;padding:12px;border-radius:14px;background:var(--panel);border:1px solid var(--line);transition:width .2s}
/* the shared head line: what this is, the AUTO/MANUAL pill, and the design button */
.ckh{display:flex;align-items:center;gap:5px;font:600 10px/1 system-ui;letter-spacing:.13em;color:var(--mute);margin-bottom:8px;text-transform:uppercase}
.ckh>span:first-child{white-space:nowrap;overflow:hidden}
.ckmode{margin-left:auto;font:700 8.5px/1 system-ui;letter-spacing:.1em;padding:3px 6px;border-radius:5px;border:1px solid var(--line);background:transparent;color:var(--mute);cursor:pointer}
.ckmode.on{background:var(--acc);border-color:var(--acc);color:var(--onacc)}
.ckgear{font:600 11px/1 system-ui;padding:2px 4px;border-radius:5px;border:1px solid transparent;background:transparent;color:var(--mute);cursor:pointer}
.ckgear:hover{border-color:var(--line);color:var(--text)}
.ckgo{margin-top:6px;width:100%;font:600 10.5px/1 system-ui;padding:5px 0;border-radius:7px;border:1px dashed var(--line);background:transparent;color:var(--mute);cursor:pointer}
.ckgo:hover{color:var(--text);border-color:var(--acc)}
/* --- plain --- */
.ckb{padding:10px 12px;border-radius:12px;margin-bottom:10px;background:var(--panel2);color:var(--text);transition:background .2s}
.ckb:last-child{margin-bottom:0}.ckb.on{background:var(--acc);color:var(--onacc)}
.ckb .w{font-size:13px;opacity:.9;line-height:1.25;max-height:2.5em;overflow:hidden}
.ckb .t{font:700 34px/1.15 "Cascadia Mono",Consolas,monospace;letter-spacing:.02em}
.ckb.low:not(.on) .t{color:var(--bad)}.ckb.low.on .t{animation:ckpulse 1s ease-in-out infinite}.ckb .s{font-size:12.5px;opacity:.9;margin-top:2px}
.ckpad{display:block;width:100%;margin:6px 0 10px;padding:5px 0;border-radius:8px;border:1px dashed var(--line);background:transparent;color:var(--mute);font:700 9px/1 system-ui;letter-spacing:.08em;cursor:pointer}
.ckpad:hover{color:var(--text);border-color:var(--acc)}.ckpad.hot{border-style:solid;border-color:var(--acc);color:var(--acc)}
@keyframes ckpulse{50%{opacity:.55}}
/* --- tournament digital --- */
.tkc{position:relative;border-radius:14px;padding:9px 9px 10px;background:linear-gradient(180deg,#33373f,#20232a 42%,#14161b);border:1px solid #464b58;box-shadow:0 10px 20px rgba(0,0,0,.42),inset 0 1px 0 rgba(255,255,255,.08)}
.tkc .ckh{color:#98a1b4;margin-bottom:7px}
.tkc .ckmode{border-color:#4a5060;color:#a9b2c4}.tkc .ckmode.on{background:var(--acc);border-color:var(--acc);color:var(--onacc)}
.tkc .ckgear{color:#a9b2c4}.tkc .ckgear:hover{color:#fff;border-color:#4a5060}
.tkface{position:relative;border-radius:7px;padding:6px 9px 7px;background:linear-gradient(180deg,#cde3bb,#a9c996 68%,#8fb37c);border:1px solid #647f55;box-shadow:inset 0 2px 5px rgba(0,0,0,.3),inset 0 -1px 0 rgba(255,255,255,.45)}
.tkface.on{box-shadow:inset 0 2px 5px rgba(0,0,0,.3),0 0 0 2px var(--acc),0 0 14px -2px var(--acc)}
.tkface .w{font:600 10px/1.2 system-ui;color:#31461d;opacity:.9;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.tkface .t{font:700 31px/1.05 "Cascadia Mono",Consolas,monospace;color:#16260b;letter-spacing:.02em;text-shadow:0 1px 0 rgba(255,255,255,.5)}
.tkface .s{font:500 9.5px/1.2 system-ui;color:#3c5326;opacity:.85;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.tkface.low .t{color:#7b1010;animation:ckblink 1s steps(2,end) infinite}
@keyframes ckblink{50%{opacity:.35}}
.tkmid{height:7px;margin:6px 0;border-radius:4px;background:linear-gradient(180deg,#0b0d11,#272b34);box-shadow:inset 0 1px 2px #000}
.tkpad{display:block;width:100%;margin-top:6px;padding:6px 0;border-radius:7px;border:1px solid #5b6273;background:linear-gradient(180deg,#f4f6fa,#c2c8d4);color:#1d222b;font:700 9.5px/1 system-ui;letter-spacing:.09em;cursor:pointer;box-shadow:0 2px 0 #767d8d,0 4px 8px rgba(0,0,0,.3)}
.tkpad:hover{background:linear-gradient(180deg,#fff,#d8dde7)}
.tkpad:active{transform:translateY(2px);box-shadow:0 0 0 #767d8d}
.tkpad.hot{box-shadow:0 0 0 2px var(--acc),0 2px 0 #767d8d}
/* --- antique analogue --- */
.antc{border-radius:14px;padding:8px 8px 9px;background:linear-gradient(180deg,#5d3d23,#3f2715 55%,#2b190c);border:1px solid #6d472a;box-shadow:0 12px 24px rgba(0,0,0,.5),inset 0 1px 0 rgba(255,214,150,.28)}
.antc .ckh{color:#e0c493;margin-bottom:6px}.antc .ckmode{border-color:#7a5930;color:#e6cda2}.antc .ckmode.on{background:#e8c88a;border-color:#e8c88a;color:#3a2412}
.antc .ckgear{color:#e0c493}.antc .ckgear:hover{color:#fff;border-color:#7a5930}
.antdials{display:flex;gap:7px}
.antone{flex:1;min-width:0;text-align:center}
.antd{position:relative;width:100%;aspect-ratio:1;border-radius:50%;padding:4px;background:conic-gradient(from 210deg,#8a6327,#efd39a,#a97c33,#f7e3af,#7a5522,#cf9f52,#8a6327);box-shadow:0 3px 9px rgba(0,0,0,.55),inset 0 0 5px rgba(0,0,0,.45)}
.antd svg{display:block;width:100%;height:100%;border-radius:50%;background:radial-gradient(circle at 34% 27%,#fdf8e9,#f1e3c2 58%,#dbc79c)}
.antd.on{box-shadow:0 0 0 2px var(--acc),0 0 16px -3px var(--acc),0 3px 9px rgba(0,0,0,.55)}
.antd.low .anface{animation:ckpulse .9s ease-in-out infinite}
.antone .w{font:600 9.5px/1.25 system-ui;color:#f0dcb6;margin-top:4px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.antone .t{font:700 11px/1.2 "Cascadia Mono",Consolas,monospace;color:#f6e6c4;letter-spacing:.05em}
.antone .s{font:500 8.5px/1.2 system-ui;color:#c9ab7c;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.antone.low .t{color:#ff9c7a}
.antb{margin-top:4px;width:100%;padding:4px 0;border-radius:5px;border:1px solid #a98247;background:linear-gradient(180deg,#e7cb98,#b58a48);color:#3a2412;font:700 8.5px/1 system-ui;letter-spacing:.08em;cursor:pointer;box-shadow:0 2px 0 #7d5c2b}
.antb:active{transform:translateY(2px);box-shadow:0 0 0 #7d5c2b}
.antb.hot{box-shadow:0 0 0 2px var(--acc),0 2px 0 #7d5c2b}
.antm{margin-top:6px;font:500 8.5px/1.3 system-ui;color:#c9ab7c;text-align:center}
/* --- neon --- */
.nnc{position:relative;border-radius:14px;padding:9px;background:radial-gradient(120% 80% at 50% 0%,#101a2b,#05070d 72%);border:1px solid #1d3d52;box-shadow:0 0 22px -6px #00e5ff,inset 0 0 26px -12px #00e5ff;overflow:hidden}
.nnc::after{content:"";position:absolute;inset:0;pointer-events:none;background:repeating-linear-gradient(0deg,rgba(255,255,255,.05) 0 1px,transparent 1px 3px)}
.nnc .ckh{color:#66d8ea;margin-bottom:6px;position:relative;z-index:1}.nnc .ckmode{border-color:#1d566b;color:#7fe6f7}.nnc .ckmode.on{background:#00e5ff;border-color:#00e5ff;color:#04121a}
.nnc .ckgear{color:#66d8ea}.nnc .ckgear:hover{color:#eaffff;border-color:#1d566b}
.nnside{position:relative;z-index:1;padding:6px 9px;border-radius:9px;border:1px solid #17384a;margin-bottom:7px;background:rgba(0,229,255,.05);transition:border-color .2s,background .2s}
.nnside.on{border-color:#00e5ff;background:rgba(0,229,255,.12);box-shadow:inset 0 0 18px -6px #00e5ff}
.nnside .w{font:600 9.5px/1.2 system-ui;color:#8fe9f7;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.nnside .t{font:700 29px/1.05 "Cascadia Mono",Consolas,monospace;color:#7df9ff;letter-spacing:.03em;text-shadow:0 0 9px #00e5ff,0 0 24px rgba(0,229,255,.5)}
.nnside .s{font:500 9px/1.2 system-ui;color:#5fc2d4;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.nnside.low .t{color:#ff8fdf;text-shadow:0 0 9px #ff2bd6,0 0 24px rgba(255,43,214,.55);animation:nnflicker 1.2s infinite}
@keyframes nnflicker{0%,100%{opacity:1}47%{opacity:1}49%{opacity:.45}51%{opacity:1}73%{opacity:.7}75%{opacity:1}}
.nnpad{position:relative;z-index:1;display:block;width:100%;margin-top:5px;padding:5px 0;border-radius:6px;border:1px solid #1d566b;background:rgba(0,229,255,.08);color:#8fe9f7;font:700 9px/1 system-ui;letter-spacing:.1em;cursor:pointer}
.nnpad:hover{background:rgba(0,229,255,.18)}
.nnpad.hot{box-shadow:0 0 12px -2px #00e5ff,inset 0 0 10px -4px #00e5ff;border-color:#00e5ff;color:#d9fbff}
/* --- calm bar --- */
.mnc{padding:10px 12px;border-radius:14px;background:var(--panel);border:1px solid var(--line)}
.mnrow{margin-bottom:11px}.mnrow:last-of-type{margin-bottom:0}
.mnrow .top{display:flex;justify-content:space-between;align-items:baseline;gap:6px}
.mnrow .w{font:600 11.5px/1.2 system-ui;color:var(--mute);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.mnrow .t{font:600 23px/1 "Cascadia Mono",Consolas,monospace;color:var(--text);letter-spacing:.01em;font-variant-numeric:tabular-nums}
.mnbar{height:3px;border-radius:3px;background:var(--panel2);margin-top:6px;overflow:hidden}
.mnbar i{display:block;height:100%;border-radius:3px;background:linear-gradient(90deg,var(--acc),var(--acc2));transition:width .25s linear}
.mnrow .s{font:500 9.5px/1.3 system-ui;color:var(--mute);opacity:.8}
.mnrow.on .t{color:var(--acc)}.mnrow.on .w{color:var(--text)}
.mnrow.low .t{color:var(--bad)}.mnrow.low .mnbar i{background:var(--bad)}
.mnpad{margin-top:5px;width:100%;padding:4px 0;border-radius:6px;border:1px solid var(--line);background:transparent;color:var(--mute);font:700 9px/1 system-ui;letter-spacing:.09em;cursor:pointer}
.mnpad:hover{color:var(--text);border-color:var(--acc)}
.mnpad.hot{border-color:var(--acc);color:var(--acc)}
/* --- stained glass --- */
.stg{display:block;padding:8px 7px 9px;border-radius:14px;background:linear-gradient(180deg,#1b1626,#0d0a13);border:1px solid #3c3349;box-shadow:inset 0 0 40px -18px #ffd88f}
.stg .ckh{color:#dccfae;margin:0 2px 6px}
.stg .ckmode{border-color:#5a4d68;color:#d8c9a6}.stg .ckmode.on{background:#ffe6b0;border-color:#ffe6b0;color:#2a2110}
.stg .ckgear{color:#dccfae}.stg .ckgear:hover{color:#fff;border-color:#5a4d68}
.stwarches{display:flex;gap:6px}
.stone{position:relative;flex:1;min-width:0;border-radius:64px 64px 8px 8px;padding:26px 5px 7px;text-align:center;background:linear-gradient(180deg,rgba(255,214,140,.16),rgba(122,92,200,.2));border:1px solid rgba(255,255,255,.14);box-shadow:inset 0 0 20px -8px rgba(255,220,160,.55);transition:box-shadow .25s,border-color .25s}
.stone::before{content:"";position:absolute;left:50%;top:7px;width:13px;height:13px;transform:translateX(-50%);border-radius:50%;background:radial-gradient(circle at 40% 35%,#fff3c4,#c98b2e 70%);box-shadow:0 0 9px #ffd27a}
.stone.on{border-color:rgba(255,240,200,.55);box-shadow:inset 0 0 26px -4px rgba(255,235,190,.9),0 0 16px -7px rgba(255,215,150,.9)}
.stone.low{animation:ckpulse 1.1s ease-in-out infinite}
.stone .w{font:600 8.5px/1.2 system-ui;color:#e8d9b6;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;letter-spacing:.04em}
.stone .t{font:700 19px/1.15 Georgia,"Times New Roman",serif;color:#fff6de;letter-spacing:.01em;text-shadow:0 0 8px rgba(255,220,150,.55)}
.stone .s{font:500 8px/1.2 system-ui;color:#bfae8c;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.stpad{margin-top:4px;width:100%;padding:3px 0;border-radius:5px;border:1px solid rgba(255,220,160,.35);background:transparent;color:#f0e0bd;font:700 8px/1 system-ui;letter-spacing:.08em;cursor:pointer}
.stpad:hover{background:rgba(255,220,160,.14)}
.stpad.hot{background:rgba(255,220,160,.22);border-color:#ffe6b0;color:#fff}
/* --- the chooser --- */
#ckpick .ckopt{display:flex;gap:10px;align-items:center;width:100%;text-align:left;padding:7px;border-radius:10px;border:1px solid var(--line);background:var(--panel2);cursor:pointer;color:var(--text)}
#ckpick .ckopt:hover{border-color:var(--acc2)}
#ckpick .ckopt.on{border-color:var(--acc);box-shadow:0 0 0 1px var(--acc)}
#ckpick .ckthumb{width:118px;flex:none;zoom:.56;pointer-events:none}
#ckpick .ckopt b{font-size:13px;display:block}
#ckpick .ckopt .small{display:block;margin-top:2px;line-height:1.3}
@media(max-width:1100px){.ckp{width:168px}.ckb .t{font-size:30px}.tkface .t{font-size:27px}.nnside .t{font-size:25px}}
`;
  if (hasDoc && !document.getElementById('ckcss')) { const s = document.createElement('style'); s.id = 'ckcss'; s.textContent = css; document.head.appendChild(s); }

  /* ---------- the analogue face ---------- */
  function dial() {
    let out = '<svg viewBox="0 0 100 100" aria-hidden="true"><g class="anface">';
    for (let i = 0; i < 60; i++) {
      const a = i * 6 * Math.PI / 180, big = i % 5 === 0, r1 = big ? 41 : 43, r2 = 45;
      out += '<line x1="' + (50 + r1 * Math.sin(a)).toFixed(1) + '" y1="' + (50 - r1 * Math.cos(a)).toFixed(1) + '" x2="' + (50 + r2 * Math.sin(a)).toFixed(1) + '" y2="' + (50 - r2 * Math.cos(a)).toFixed(1) + '" stroke="' + (big ? '#6a5326' : '#a08a5c') + '" stroke-width="' + (big ? 1.2 : .5) + '"/>';
    }
    ROMAN.forEach((n, i) => { const p = romanAt(i, 33); out += '<text x="' + p.x.toFixed(1) + '" y="' + (p.y + 2.6).toFixed(1) + '" text-anchor="middle" font-family="Georgia,serif" font-size="7.4" fill="#5c4820">' + n + '</text>'; });
    out += '<circle cx="50" cy="50" r="1.6" fill="#6a5326"/>';
    /* the seconds needle: thin, under the main hand, so the face is never quite still */
    out += '<line class="ansec" x1="50" y1="50" x2="50" y2="24" stroke="rgba(120,90,40,.45)" stroke-width=".8" stroke-linecap="round" style="transform-origin:50px 50px"/>';
    out += '<line class="anhand" x1="50" y1="50" x2="50" y2="18" stroke="#3f2f14" stroke-width="2.1" stroke-linecap="round" style="transform-origin:50px 50px"/>';
    out += '<g class="anflag" style="transform-origin:50px 9px"><rect x="49" y="6" width="2" height="8" rx="1" fill="#b8352f"/><path d="M50 6 L64 9 L50 12 Z" fill="#d94a44"/></g>';
    out += '</g></svg>';
    return out;
  }

  /* ---------- one side of a clock, per design ---------- */
  function sideHtml(style, b) {
    const w = esc(b.who), t = esc(b.t), s = b.sub ? '<div class="s">' + esc(b.sub) + '</div>' : '', low = b.low ? ' low' : '';
    if (style === 'classic') return '<div><div class="ckb' + (b.on ? ' on' : '') + low + '"><div class="w">' + w + '</div><div class="t">' + t + '</div>' + s + '</div><button class="ckpad" data-ck="press" type="button">PRESS TO HAND OVER</button></div>';
    if (style === 'tournament') return '<div><div class="tkface' + (b.on ? ' on' : '') + low + '"><div class="w">' + w + '</div><div class="t">' + t + '</div>' + s + '</div><button class="tkpad" data-ck="press" type="button">PRESS</button></div>';
    if (style === 'antique') return '<div class="antone' + (b.on ? ' on' : '') + low + '"><div class="antd' + (b.on ? ' on' : '') + low + '">' + dial() + '</div><div class="w">' + w + '</div><div class="t">' + t + '</div>' + (b.sub ? '<div class="s">' + esc(b.sub) + '</div>' : '') + '<button class="antb" data-ck="press" type="button">PRESS</button></div>';
    if (style === 'neon') return '<div class="nnside' + (b.on ? ' on' : '') + low + '"><div class="w">' + w + '</div><div class="t">' + t + '</div>' + s + '</div><button class="nnpad" data-ck="press" type="button">PRESS</button>';
    if (style === 'calm') return '<div class="mnrow' + (b.on ? ' on' : '') + low + '"><div class="top"><span class="w">' + w + '</span><span class="t">' + t + '</span></div><div class="mnbar"><i style="width:100%"></i></div>' + (b.sub ? '<div class="s">' + esc(b.sub) + '</div>' : '') + '<button class="mnpad" data-ck="press" type="button">PRESS TO HAND OVER</button></div>';
    return '<div class="stone' + (b.on ? ' on' : '') + low + '"><div class="w">' + w + '</div><div class="t">' + t + '</div>' + (b.sub ? '<div class="s">' + esc(b.sub) + '</div>' : '') + '<button class="stpad" data-ck="press" type="button">PRESS</button></div>';
  }

  /* the frame each design needs around the two sides, and what sits between them */
  const BETWEEN = { classic: '', tournament: '<div class="tkmid"></div>', antique: '', neon: '', calm: '', stained: '' };
  function frame(style, inner) {
    if (style === 'classic') return inner;
    if (style === 'tournament') return '<div class="tkc">' + head() + inner + '</div>';
    if (style === 'antique') return '<div class="antc">' + head() + '<div class="antdials">' + inner + '</div><div class="antm" data-part="mode"></div></div>';
    if (style === 'neon') return '<div class="nnc">' + head() + inner + '</div>';
    if (style === 'calm') return '<div class="mnc">' + head() + inner + '</div>';
    return '<div class="stg">' + head() + '<div class="stwarches">' + inner + '</div></div>';
  }
  /* the AUTO/MANUAL pill and the design button: on every design, because it is the way in to the chooser */
  const head = () => '<div class="ckh"><span>&#9201; CLOCKS</span><button class="ckmode" data-ck="mode" type="button" title="Automatic: the side to move always runs. Manual: nothing moves until you press it.">AUTO</button><button class="ckgear" data-ck="cfg" type="button" title="Clock design and how it switches">&#9881;</button></div>';

  const build = (el, blocks, o) => {
    const style = o.style || cfg().style;
    const gap = BETWEEN[style] || '';
    const sides = blocks.map(b => sideHtml(style, b)).join(gap);
    el.className = 'ckp ck-' + style;
    el.innerHTML = style === 'classic' ? head() + sides : frame(style, sides);
    /* remember what to update, so a tick four times a second never rebuilds the DOM (which would also eat the press of a button) */
    el._ck = {
      key: style + '|' + blocks.length + '|' + (o.manual ? 1 : 0),
      style,
      sides: [...el.querySelectorAll('.ckb, .tkface, .antone, .nnside, .mnrow, .stone')].filter(x => !x.closest('#ckpick')),
      pads: [...el.querySelectorAll('[data-ck=press]')]
    };
    const mode = el.querySelector('.ckmode'); if (mode) mode.classList.toggle('on', !!o.manual);
    const mm = el.querySelector('[data-part=mode]'); if (mm) { mm.textContent = 'press a side to give them the clock'; mm.style.display = o.manual ? '' : 'none'; }
    el._ck.pads.forEach((p, i) => { p.style.display = o.manual ? '' : 'none'; p.dataset.i = i; });
  };

  /* ---------- paint: build once, then only touch what changed ---------- */
  function paint(el, blocks, opts) {
    if (!el) return;
    if (!blocks || !blocks.length) { el.style.display = 'none'; return; }
    el.style.display = '';
    const o = Object.assign({ manual: false }, opts || {});
    const key = (o.style || cfg().style) + '|' + blocks.length + '|' + (o.manual ? 1 : 0);
    if (!el._ck || el._ck.key !== key) build(el, blocks, o);
    el._ckBlocks = blocks; el._ckOpts = o;
    const S = el._ck;
    blocks.forEach((b, i) => {
      const r = S.sides[i]; if (!r) return;
      r.classList.toggle('on', !!b.on);
      r.classList.toggle('low', !!b.low);
      const wt = r.querySelector('.w'), tt = r.querySelector('.t'), st = r.querySelector('.s');
      if (wt && wt.textContent !== String(b.who == null ? '' : b.who)) wt.textContent = String(b.who == null ? '' : b.who);
      if (tt && tt.textContent !== String(b.t == null ? '' : b.t)) tt.textContent = String(b.t == null ? '' : b.t);
      if (st && b.sub && st.textContent !== String(b.sub)) st.textContent = String(b.sub);
      const bar = r.querySelector('.mnbar i');
      if (bar) bar.style.width = (b.sec != null && b.total > 0 ? Math.max(0, Math.min(100, b.sec / b.total * 100)) : 100) + '%';
      const hand = r.querySelector('.anhand');
      if (hand && b.sec != null) hand.style.transform = 'rotate(' + ANG(b.sec, b.total).toFixed(1) + 'deg)';
      const sec = r.querySelector('.ansec');
      if (sec && b.sec != null) sec.style.transform = 'rotate(' + ANG2(b.sec).toFixed(1) + 'deg)';
      const flag = r.querySelector('.anflag');
      if (flag) flag.style.transform = 'rotate(' + (b.sec != null && b.sec <= 60 ? 34 : 0) + 'deg)';
    });
    S.pads.forEach((p, i) => p.classList.toggle('hot', !!(blocks[i] && blocks[i].on)));
    const mode = el.querySelector('.ckmode'); if (mode) mode.classList.toggle('on', !!o.manual);
  }

  /* ---------- the switch and the chooser ---------- */
  const repaint = () => { document.querySelectorAll('.ckp').forEach(el => { if (el._ckBlocks) paint(el, el._ckBlocks, el._ckOpts); }); };
  function set(p) {
    if (p && p.style && IDS.indexOf(p.style) >= 0) ls.set('ck_style', p.style);
    if (p && p.manual !== undefined) ls.set('ck_manual', p.manual ? '1' : '0');
    repaint();
  }
  /* every clock on screen listens through this, so one chooser serves Play, Online and Daily */
  const on = (el, e) => {
    const b = e.target.closest('[data-ck]'); if (!b || !el.contains(b)) return;
    const k = b.dataset.ck, o = el._ckOpts || {}, blocks = el._ckBlocks || [];
    if (k === 'cfg') { e.preventDefault(); choose(); return; }
    if (k === 'mode') { e.preventDefault(); const m = !cfg().manual; set({ manual: m }); A.toast(m ? 'Manual clock: press a side to give them the time.' : 'Automatic clock: the side to move always runs.', 4200); return; }
    if (k === 'press') {
      e.preventDefault(); if (!cfg().manual) return;
      const i = +b.dataset.i, blk = blocks[i] || {};
      const side = blk.side != null ? blk.side : (i === 0 ? -1 : 1);
      if (o.onPress) o.onPress(side); else A.toast('This clock switches itself.', 2500);
    }
  };

  const note = manual => manual
    ? '<b>Manual.</b> The clock stays where you put it. Press a side on the clock to give them the time, exactly like the button on a real clock, and your own clock will not run while you are deciding about an undo or a resign.'
    : '<b>Automatic (the default).</b> The side to move always runs, the way it does on a website. Tick this if you would rather have a press button on the clock.';
  function choose() {
    const cur = cfg();
    const sample = [{ who: 'You', t: '3:42', on: true, sec: 222, total: 300, side: 1, sub: '' }, { who: 'Opponent', t: '1:07', on: false, low: true, sec: 67, total: 300, side: -1, sub: '' }];
    A.dlg('<div id="ckpick"><div class="hd"><b>&#9201; Chess clock</b><span class="sp"></span><span class="ib" id="ckx" style="cursor:pointer">&times;</span></div><div class="bd" style="max-height:min(620px,70vh);overflow:auto">' +
      '<div class="small mute" style="margin-bottom:9px">Pick the look. It is remembered and used by every clock in the chess section.</div>' +
      '<div style="display:flex;flex-direction:column;gap:7px">' + STYLES.map(s => '<button class="ckopt' + (s.id === cur.style ? ' on' : '') + '" data-s="' + s.id + '" type="button"><div class="ckthumb" data-th="' + s.id + '"></div><div style="flex:1;min-width:0"><b>' + esc(s.name) + '</b><span class="small mute">' + esc(s.note) + '</span></div></button>').join('') + '</div>' +
      '<div style="margin-top:14px;padding-top:12px;border-top:1px solid var(--line)">' +
      '<label class="chk" style="font-weight:600"><input type="checkbox" id="ckman"' + (cur.manual ? ' checked' : '') + '> Switch the clock by pressing it</label>' +
      '<div class="small mute" id="ckmnote" style="margin-top:4px;line-height:1.45">' + note(cur.manual) + '</div></div>' +
      '<div class="row" style="margin-top:14px"><span class="sp"></span><button class="pri" id="ckdone">Done</button></div>' +
      '</div></div>', true);
    const box = document.getElementById('ckpick');
    /* live thumbnails: the real clocks at 56%, so you can see them instead of guessing from a name */
    box.querySelectorAll('[data-th]').forEach(th => { const el = document.createElement('div'); el.className = 'ckp'; el.style.width = '186px'; th.appendChild(el); paint(el, sample, { style: th.dataset.th, manual: false }); });
    box.addEventListener('click', e => {
      if (e.target.closest('#ckx') || e.target.closest('#ckdone')) { A.closeDlg(); return; }
      const o = e.target.closest('[data-s]'); if (!o) return;
      set({ style: o.dataset.s });
      box.querySelectorAll('.ckopt').forEach(x => x.classList.toggle('on', x === o));
    });
    const m = box.querySelector('#ckman'), nt = box.querySelector('#ckmnote');
    if (m) m.onchange = () => { set({ manual: m.checked }); if (nt) nt.innerHTML = note(m.checked); A.toast(m.checked ? 'Manual clock: press a side to give them the time.' : 'Automatic clock: the side to move always runs.', 4200); };
  }

  if (hasDoc) {
    /* one delegated listener per panel, installed the first time it is drawn */
    const wire = el => { if (el._ckWired) return; el._ckWired = 1; el.addEventListener('click', e => on(el, e)); };
    const orig = paint;
    paint = function (el, blocks, opts) { if (el) wire(el); return orig(el, blocks, opts); };
    window.ChessClock = { paint, cfg, set, choose, repaint, STYLES, ANG, ANG2, sideHtml, dial };
  }
  if (typeof module !== 'undefined' && module.exports) module.exports = { ANG, ANG2, romanAt, STYLES };
})();

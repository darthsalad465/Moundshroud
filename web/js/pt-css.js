// Packet Tracer simulator, part 9: styles and device icons. Every class starts with "pt-" so nothing clashes with
// style.css; colours come from the app theme variables. Icons are original SVG drawings for each device type.
(() => {
  const G = typeof window !== 'undefined' ? window : globalThis;
  const P = G.PTSim = G.PTSim || {};
  const css = `
.pt-root{position:relative;flex:1;min-height:0;display:flex;flex-direction:column;background:var(--bg);color:var(--text);font:13px/1.4 system-ui,"Segoe UI",sans-serif;outline:none;user-select:none;overflow:hidden}
.pt-root.pt-full{position:fixed;inset:0;z-index:9000}
.pt-root button{font:inherit;color:var(--text);cursor:pointer}
.pt-top{display:flex;align-items:center;gap:4px;padding:5px 8px;border-bottom:1px solid var(--line);background:var(--panel);flex-wrap:wrap}
.pt-top .pt-sep{width:1px;align-self:stretch;background:var(--line);margin:0 4px}
.pt-tb{display:inline-flex;align-items:center;gap:5px;padding:4px 9px;border:1px solid transparent;border-radius:7px;background:none;font-size:12.5px;white-space:nowrap}
.pt-tb:hover{background:var(--panel2);border-color:var(--line)}
.pt-tb.pt-on{background:var(--acc);border-color:var(--acc);color:#fff}
.pt-tb svg{width:16px;height:16px}
.pt-title{margin-left:auto;color:var(--mute);font-size:12px;max-width:260px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.pt-main{flex:1;min-height:0;display:flex;position:relative}
.pt-cv{flex:1;min-width:0;position:relative;overflow:hidden;background:var(--panel2);background-image:radial-gradient(var(--line) 1px,transparent 1px);background-size:22px 22px}
.pt-cv svg.pt-svg{position:absolute;inset:0;width:100%;height:100%;touch-action:none}
.pt-cv.pt-c-place,.pt-cv.pt-c-cable,.pt-cv.pt-c-pdu,.pt-cv.pt-c-note,.pt-cv.pt-c-inspect{cursor:crosshair}.pt-cv.pt-c-delete{cursor:not-allowed}
.pt-dev text{fill:var(--text);font-size:12px;text-anchor:middle;paint-order:stroke;stroke:var(--panel2);stroke-width:3px}
.pt-dev .pt-model{fill:var(--mute);font-size:10.5px}
.pt-dev{cursor:pointer}.pt-dev.pt-sel .pt-hl{stroke:var(--acc);stroke-width:2;fill:color-mix(in srgb,var(--acc) 14%,transparent)}
.pt-dev .pt-hl{fill:transparent;stroke:none}.pt-dev.pt-off .pt-ico{opacity:.45}
.pt-ln{stroke-width:2.2;fill:none}.pt-l-straight{stroke:var(--text)}.pt-l-cross{stroke:var(--text);stroke-dasharray:7 4}
.pt-l-console{stroke:#4fa3ff}.pt-l-serial{stroke:#ff5a5f}.pt-l-fiber{stroke:#f5a524}.pt-l-wireless{stroke:var(--mute);stroke-dasharray:3 5;stroke-width:1.5}
.pt-lhit{stroke:transparent;stroke-width:14;fill:none;cursor:pointer}
.pt-lt-up{fill:#2fd06a}.pt-lt-down{fill:#ff4d5e}.pt-lt-blk{fill:#f5a524}
.pt-plab{fill:var(--mute);font-size:10px;text-anchor:middle;paint-order:stroke;stroke:var(--panel2);stroke-width:3px}
.pt-note rect{fill:color-mix(in srgb,#ffe58a 85%,transparent);stroke:#d9b84a}.pt-note text{fill:#3a3000;font-size:12px}
.pt-env{pointer-events:none}
.pt-rubber{stroke:var(--acc);stroke-width:2;stroke-dasharray:5 4;pointer-events:none}
.pt-side{width:330px;border-left:1px solid var(--line);background:var(--panel);display:flex;flex-direction:column;min-height:0}
.pt-side[hidden]{display:none}
.pt-side h3{margin:0;font-size:13px;padding:8px 10px;border-bottom:1px solid var(--line);display:flex;align-items:center;gap:6px}
.pt-side h3 button{margin-left:auto;background:none;border:0;color:var(--mute);font-size:16px}
.pt-sbody{flex:1;min-height:0;overflow:auto;padding:8px 10px}
.pt-evt{width:100%;border-collapse:collapse;font-size:12px}.pt-evt th{position:sticky;top:0;background:var(--panel2);text-align:left;font-weight:600;padding:3px 4px;border-bottom:1px solid var(--line)}
.pt-evt td{padding:3px 4px;border-bottom:1px solid var(--line);white-space:nowrap;cursor:pointer}.pt-evt tr:hover td{background:var(--panel2)}.pt-evt tr.pt-cur td{background:color-mix(in srgb,var(--acc) 22%,transparent)}
.pt-sw{display:inline-block;width:14px;height:10px;border-radius:2px;vertical-align:middle}
.pt-ctl{display:flex;gap:6px;padding:8px 10px;border-top:1px solid var(--line);align-items:center;flex-wrap:wrap}
.pt-btn{padding:5px 10px;border:1px solid var(--line);border-radius:7px;background:var(--panel2);font-size:12px}
.pt-btn:hover{border-color:var(--acc)}.pt-btn.pt-pri{background:var(--acc);border-color:var(--acc);color:#fff}
.pt-btn:disabled{opacity:.5;cursor:default}
.pt-filt{display:flex;flex-wrap:wrap;gap:4px 10px;padding:6px 10px;border-top:1px solid var(--line);font-size:12px}
.pt-filt label{display:inline-flex;gap:4px;align-items:center}
.pt-bot{display:flex;border-top:1px solid var(--line);background:var(--panel);height:132px;min-height:132px}
.pt-cats{display:grid;grid-template-columns:repeat(4,40px);grid-auto-rows:40px;gap:4px;padding:8px;border-right:1px solid var(--line);align-content:start}
.pt-cat{display:flex;align-items:center;justify-content:center;border:1px solid transparent;border-radius:8px;background:none;padding:0}
.pt-cat:hover{background:var(--panel2)}.pt-cat.pt-on{border-color:var(--acc);background:color-mix(in srgb,var(--acc) 15%,transparent)}
.pt-cat svg{width:30px;height:30px}
.pt-mods{flex:1;min-width:0;display:flex;flex-direction:column;border-right:1px solid var(--line)}
.pt-mods .pt-cap{font-size:11.5px;color:var(--mute);padding:5px 10px 0}
.pt-tiles{flex:1;display:flex;gap:6px;padding:6px 10px;overflow-x:auto;align-items:flex-start}
.pt-tile{display:flex;flex-direction:column;align-items:center;gap:2px;width:74px;padding:5px 2px;border:1px solid transparent;border-radius:8px;background:none;font-size:11px;touch-action:none}
.pt-tile:hover{background:var(--panel2);border-color:var(--line)}.pt-tile.pt-on{border-color:var(--acc)}
.pt-tile svg{width:40px;height:40px}
.pt-rt{width:430px;display:flex;flex-direction:column;min-width:0}
.pt-modes{display:flex;gap:4px;padding:6px 8px;align-items:center;border-bottom:1px solid var(--line)}
.pt-modes .pt-clock{margin-left:auto;font:12px Consolas,monospace;color:var(--mute)}
.pt-pdus{flex:1;overflow:auto;font-size:11.5px}
.pt-pdus table{width:100%;border-collapse:collapse}.pt-pdus th,.pt-pdus td{padding:2px 5px;text-align:left;border-bottom:1px solid var(--line);white-space:nowrap}
.pt-pdus th{color:var(--mute);font-weight:600;position:sticky;top:0;background:var(--panel)}
.pt-ok{color:var(--ok)}.pt-bad{color:var(--bad)}.pt-mute{color:var(--mute)}
.pt-win{position:absolute;z-index:20;display:flex;flex-direction:column;background:var(--panel);border:1px solid var(--line);border-radius:10px;box-shadow:0 14px 40px rgba(0,0,0,.45);min-width:420px;min-height:300px;resize:both;overflow:hidden}
.pt-win.pt-front{z-index:22}
.pt-wh{display:flex;align-items:center;gap:8px;padding:6px 10px;background:var(--panel2);border-bottom:1px solid var(--line);cursor:move;font-weight:600}
.pt-wh svg{width:20px;height:20px}.pt-wh .pt-x{margin-left:auto;border:0;background:none;font-size:18px;color:var(--mute);line-height:1;padding:0 4px}.pt-wh .pt-x:hover{color:var(--bad)}
.pt-tabs{display:flex;gap:2px;padding:6px 8px 0;border-bottom:1px solid var(--line)}
.pt-tab{padding:5px 12px;border:1px solid transparent;border-bottom:0;border-radius:7px 7px 0 0;background:none;font-size:12.5px;color:var(--mute)}
.pt-tab.pt-on{background:var(--panel2);border-color:var(--line);color:var(--text)}
.pt-wb{flex:1;min-height:0;overflow:auto;padding:10px;display:flex;flex-direction:column;user-select:text}
.pt-term{flex:1;min-height:180px;background:#0b0d10;color:#d8dee9;border:1px solid var(--line);border-radius:6px;font:12.5px/1.35 Consolas,"Cascadia Mono",monospace;overflow:auto;padding:6px 8px;cursor:text;white-space:pre-wrap;word-break:break-all}
.pt-term pre{margin:0;font:inherit;white-space:pre-wrap}
.pt-tline{display:flex}.pt-tline span{white-space:pre}
.pt-tin{flex:1;min-width:20px;background:transparent;border:0;outline:0;color:inherit;font:inherit;padding:0;margin:0}
.pt-form{display:grid;grid-template-columns:150px 1fr;gap:6px 10px;align-items:center;font-size:12.5px}
.pt-form input,.pt-form select,.pt-wb textarea,.pt-in{padding:5px 7px;border:1px solid var(--line);border-radius:6px;background:var(--panel2);color:var(--text);font:12.5px system-ui,sans-serif;min-width:0}
.pt-form input:disabled{opacity:.6}
.pt-form .pt-span{grid-column:1/-1}
.pt-hd{font-weight:700;margin:8px 0 6px;font-size:12.5px;color:var(--mute);text-transform:uppercase;letter-spacing:.04em}
.pt-split{display:flex;gap:10px;flex:1;min-height:0}
.pt-nav{width:150px;flex:none;border:1px solid var(--line);border-radius:6px;overflow:auto;background:var(--panel2)}
.pt-nav div{padding:4px 8px;cursor:pointer;font-size:12px;white-space:nowrap}.pt-nav div.pt-g{font-weight:700;color:var(--mute);cursor:default;font-size:11px;padding-top:7px}
.pt-nav div.pt-on{background:var(--acc);color:#fff}.pt-nav div:not(.pt-g):hover{background:color-mix(in srgb,var(--acc) 20%,transparent)}
.pt-pane{flex:1;min-width:0;overflow:auto}
.pt-eq{height:90px;margin-top:8px;background:#0b0d10;color:#b8f5c8;font:12px Consolas,monospace;border-radius:6px;padding:6px;overflow:auto;white-space:pre-wrap;flex:none}
.pt-apps{display:grid;grid-template-columns:repeat(auto-fill,96px);gap:12px;padding:6px}
.pt-app{display:flex;flex-direction:column;align-items:center;gap:6px;padding:10px 4px;border:1px solid var(--line);border-radius:10px;background:var(--panel2);font-size:11.5px;text-align:center}
.pt-app:hover{border-color:var(--acc)}.pt-app span.pt-ai{font-size:26px;line-height:1}
.pt-apph{display:flex;align-items:center;gap:8px;margin-bottom:8px;font-weight:600}.pt-apph button{margin-left:auto}
.pt-web{flex:1;min-height:180px;background:#fff;color:#111;border:1px solid var(--line);border-radius:6px;padding:12px;overflow:auto;user-select:text}
.pt-web a{color:#0645ad;cursor:pointer;text-decoration:underline}
.pt-phys{display:flex;flex-direction:column;gap:10px;align-items:flex-start}
.pt-phys svg{max-width:100%;background:var(--panel2);border-radius:8px;border:1px solid var(--line)}
.pt-pop{position:absolute;z-index:40;background:var(--panel);border:1px solid var(--line);border-radius:8px;box-shadow:0 10px 30px rgba(0,0,0,.45);padding:4px;max-height:320px;overflow:auto;min-width:170px}
.pt-pop div{padding:4px 10px;border-radius:5px;cursor:pointer;font-size:12.5px;white-space:nowrap}.pt-pop div:hover{background:var(--acc);color:#fff}
.pt-pop div.pt-dis{opacity:.45;cursor:default}.pt-pop div.pt-dis:hover{background:none;color:inherit}.pt-pop .pt-ph{font-weight:700;color:var(--mute);cursor:default;font-size:11px}.pt-pop .pt-ph:hover{background:none;color:var(--mute)}
.pt-modal{position:absolute;inset:0;z-index:50;background:rgba(0,0,0,.45);display:flex;align-items:center;justify-content:center}
.pt-dlg{background:var(--panel);border:1px solid var(--line);border-radius:12px;width:min(640px,94%);max-height:86%;display:flex;flex-direction:column;box-shadow:0 20px 50px rgba(0,0,0,.5)}
.pt-dlg h2{margin:0;padding:12px 14px;font-size:15px;border-bottom:1px solid var(--line);display:flex;align-items:center}.pt-dlg h2 button{margin-left:auto;background:none;border:0;font-size:18px;color:var(--mute)}
.pt-dlg .pt-db{padding:12px 14px;overflow:auto;user-select:text}
.pt-card{border:1px solid var(--line);border-radius:9px;padding:10px 12px;margin-bottom:8px;background:var(--panel2);display:flex;gap:10px;align-items:center}
.pt-card b{display:block}.pt-card small{color:var(--mute)}.pt-card button{margin-left:auto}
.pt-chk{list-style:none;padding:0;margin:8px 0}.pt-chk li{padding:3px 0;font-size:12.5px}
.pt-bar{height:8px;border-radius:5px;background:var(--line);overflow:hidden;margin:6px 0}.pt-bar i{display:block;height:100%;background:var(--ok)}
.pt-lab code,.pt-dlg code{font:12px Consolas,monospace;background:var(--panel2);padding:0 4px;border-radius:4px}
.pt-lab ol{padding-left:18px;margin:6px 0}.pt-lab li{margin:4px 0;line-height:1.45}
.pt-tip{position:absolute;z-index:45;pointer-events:none;background:var(--panel);border:1px solid var(--line);border-radius:7px;padding:6px 8px;font:11.5px/1.45 Consolas,monospace;white-space:pre;box-shadow:0 8px 20px rgba(0,0,0,.4)}
.pt-tbl{border-collapse:collapse;font:12px Consolas,monospace;width:100%}.pt-tbl th,.pt-tbl td{border:1px solid var(--line);padding:3px 6px;text-align:left}.pt-tbl th{background:var(--panel2)}
.pt-osi{display:grid;grid-template-columns:1fr 1fr;gap:10px;font-size:12px}.pt-osi div.pt-l{border:1px solid var(--line);border-radius:6px;padding:4px 6px;margin-bottom:4px;background:var(--panel2)}
.pt-osi .pt-l b{color:var(--mute);font-weight:600;margin-right:6px}
.pt-notes{margin-top:10px;font-size:12px;line-height:1.5}.pt-notes li{margin:3px 0}
@media (max-width:900px){.pt-rt{width:300px}.pt-side{width:270px}}
`;
  if (typeof document !== 'undefined' && !document.getElementById('pt-css')) { const s = document.createElement('style'); s.id = 'pt-css'; s.textContent = css; document.head.appendChild(s); }

  /* ---------- icons: original drawings in a common blue network style ---------- */
  const B = '#2a7fd4', B2 = '#1a5ea8', W = '#fff';
  const arrows4 = (cx, cy, r) => { let s = ''; for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const x2 = cx + dx * r, y2 = cy + dy * r * .45; s += '<path d="M' + (cx + dx * 3) + ' ' + (cy + dy * 1.5) + 'L' + x2 + ' ' + y2 + '" stroke="' + W + '" stroke-width="2.2" stroke-linecap="round"/><circle cx="' + x2 + '" cy="' + y2 + '" r="1.8" fill="' + W + '"/>'; } return s; };
  const ICONS = {
    router: '<ellipse cx="24" cy="31" rx="19" ry="8" fill="' + B2 + '"/><rect x="5" y="19" width="38" height="12" fill="' + B2 + '"/><ellipse cx="24" cy="19" rx="19" ry="8" fill="' + B + '"/>' + arrows4(24, 19, 13),
    switch: '<path d="M6 18 L14 11 H44 L36 18Z" fill="' + B + '"/><rect x="6" y="18" width="30" height="16" fill="' + B2 + '"/><path d="M36 18 L44 11 V27 L36 34Z" fill="#164e8c"/><path d="M12 23h14m-3-3 3 3-3 3M30 29H16m3-3-3 3 3 3" stroke="' + W + '" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round"/>',
    mls: '<path d="M6 18 L14 11 H44 L36 18Z" fill="' + B + '"/><rect x="6" y="18" width="30" height="16" fill="' + B2 + '"/><path d="M36 18 L44 11 V27 L36 34Z" fill="#164e8c"/><path d="M12 22 L30 30 M30 22 L12 30" stroke="' + W + '" stroke-width="2" stroke-linecap="round"/><path d="M16 14.5h20" stroke="' + W + '" stroke-width="1.6" stroke-linecap="round"/>',
    hub: '<path d="M6 22 L12 17 H42 L36 22Z" fill="#4c95dc"/><rect x="6" y="22" width="30" height="10" fill="' + B2 + '"/><path d="M36 22 L42 17 V27 L36 32Z" fill="#164e8c"/><path d="M11 27h20m-3-2.5 3 2.5-3 2.5" stroke="' + W + '" stroke-width="1.8" fill="none" stroke-linecap="round"/>',
    ap: '<rect x="10" y="26" width="28" height="10" rx="3" fill="' + B2 + '"/><path d="M15 26V17M33 26V17" stroke="#9fb3c8" stroke-width="2.4" stroke-linecap="round"/><path d="M17 12a10 10 0 0 1 14 0M20 15a5 5 0 0 1 8 0" stroke="' + B + '" stroke-width="2.2" fill="none" stroke-linecap="round"/><circle cx="31" cy="31" r="1.6" fill="#2fd06a"/>',
    cloud: '<path d="M14 36a8 8 0 0 1-1-15.9A11 11 0 0 1 34 16a8.5 8.5 0 0 1 2 20Z" fill="#cfe3f7" stroke="' + B + '" stroke-width="2"/>',
    pc: '<rect x="7" y="8" width="34" height="23" rx="2.5" fill="#5f6b7a"/><rect x="10" y="11" width="28" height="17" rx="1" fill="#8fd0ff"/><path d="M20 31h8l2 6H18Z" fill="#7b8794"/><rect x="13" y="37" width="22" height="3" rx="1.5" fill="#5f6b7a"/>',
    laptop: '<rect x="11" y="10" width="26" height="18" rx="2" fill="#5f6b7a"/><rect x="13.5" y="12.5" width="21" height="13" rx="1" fill="#8fd0ff"/><path d="M6 31h36l-3 5H9Z" fill="#7b8794"/>',
    server: '<rect x="14" y="5" width="20" height="38" rx="2.5" fill="#5f6b7a"/><path d="M17 11h14M17 16h14M17 21h14" stroke="#c9d3df" stroke-width="2" stroke-linecap="round"/><circle cx="20" cy="36" r="2" fill="#2fd06a"/><circle cx="26" cy="36" r="2" fill="#ffc266"/>',
    cable: '<path d="M8 38 C18 30 14 14 24 12 S36 18 40 10" stroke="#f5a524" stroke-width="3" fill="none" stroke-linecap="round"/><path d="M5 35l6 6M37 7l6 6" stroke="var(--text)" stroke-width="3" stroke-linecap="round"/>',
    end: '<rect x="7" y="8" width="34" height="23" rx="2.5" fill="#5f6b7a"/><rect x="10" y="11" width="28" height="17" rx="1" fill="#8fd0ff"/><path d="M20 31h8l2 6H18Z" fill="#7b8794"/><rect x="13" y="37" width="22" height="3" rx="1.5" fill="#5f6b7a"/>',
  };
  const CABLE_ICONS = { auto: '<path d="M24 6 L14 26h9l-3 16 14-22h-9l4-14Z" fill="#ffc266" stroke="#b07b10" stroke-width="1.2" stroke-linejoin="round"/>', console: '<path d="M8 36 C20 30 26 18 40 12" stroke="#4fa3ff" stroke-width="3" fill="none"/>', straight: '<path d="M8 38 L40 10" stroke="var(--text)" stroke-width="3"/>', cross: '<path d="M8 38 L40 10" stroke="var(--text)" stroke-width="3" stroke-dasharray="6 4"/>', fiber: '<path d="M8 38 L40 10" stroke="#f5a524" stroke-width="3"/>', serial: '<path d="M8 38 L20 26 L18 22 L30 16 L28 12 L40 6" stroke="#ff5a5f" stroke-width="3" fill="none" stroke-linejoin="round"/>' };
  P.iconKey = d => d.model === '3560' ? 'mls' : d.type;
  P.icon = (key, size) => '<svg viewBox="0 0 48 48" width="' + (size || 48) + '" height="' + (size || 48) + '" aria-hidden="true">' + (ICONS[key] || CABLE_ICONS[key] || '') + '</svg>';
  P.iconInner = key => ICONS[key] || '';
  P.cableIcon = k => '<svg viewBox="0 0 48 48" width="40" height="40">' + CABLE_ICONS[k] + '</svg>';
  P.TYPE_COLORS = { ICMP: '#d946ef', ARP: '#facc15', DHCP: '#22c55e', DNS: '#38bdf8', HTTP: '#fb923c', TCP: '#a78bfa', TELNET: '#f472b6', SSH: '#f472b6', UDP: '#94a3b8', IP: '#94a3b8' };
})();

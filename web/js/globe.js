// 3D Globe Map + GodMode OSINT Suite (MapLibre GL JS v5 WebGL Globe + Natural Earth 50m offline vectors + live telemetry).
// Zero-lag GPU discipline: WebGL2 worker-tiled vectors, capped 1.5x pixel ratio, pure-GPU CSS sensor filters (NVG/FLIR/CRT/Noir),
// zero GPU-stalling backdrop-filter blur, 0 MB storage for live OSINT feeds, 150 MB auto-capped tile cache, 0% idle CPU/GPU off-tab.
(() => {
  const root = document.getElementById('p-globe');
  if (!root) return;

  const esc = s => String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const PINS_KEY = 'oa_globe_pins_v1';
  const ISS_LIVE_YT = 'ROboUHfPUrU'; // Official NASA ISS HD Earth View (from lib/cams.js, CSP-allowed)

  /* ---------- Zero-blur tactical dark-glass HUD CSS (zero GPU readback stalls) ---------- */
  if (!document.getElementById('glb-css')) {
    const st = document.createElement('style');
    st.id = 'glb-css';
    st.textContent = `
.glb-wrap{position:relative;flex:1;min-height:0;width:100%;height:100%;overflow:hidden;background:radial-gradient(circle at 50% 48%,#0a1229 0%,#050915 62%,#02040a 100%);font-family:var(--f-ui,"Segoe UI",system-ui,sans-serif)}
#glb-map{position:absolute;inset:0;width:100%;height:100%;transition:filter .18s ease}
#glb-map.fx-nvg{filter:sepia(1) hue-rotate(74deg) saturate(3.2) contrast(1.22) brightness(.95)}
#glb-map.fx-flir{filter:invert(1) hue-rotate(190deg) saturate(2.6) contrast(1.38) brightness(.96)}
#glb-map.fx-crt{filter:contrast(1.22) saturate(1.25) brightness(.96)}
#glb-map.fx-noir{filter:grayscale(1) contrast(1.42) brightness(.88)}
.glb-fx{position:absolute;inset:0;pointer-events:none;z-index:6;display:none}
.glb-fx.on{display:block}
.glb-fx.fx-nvg{background:radial-gradient(circle at 50% 50%,transparent 54%,rgba(0,22,6,.68) 100%),repeating-linear-gradient(0deg,rgba(34,197,94,.055) 0 1px,transparent 1px 3px)}
.glb-fx.fx-flir{background:radial-gradient(circle at 50% 50%,transparent 58%,rgba(12,0,28,.55) 100%);box-shadow:inset 0 0 80px rgba(249,115,22,.16)}
.glb-fx.fx-crt{background:repeating-linear-gradient(0deg,rgba(0,0,0,.22) 0 1px,transparent 1px 3px),radial-gradient(circle at 50% 50%,transparent 60%,rgba(0,0,0,.62) 100%)}
.glb-fx.fx-noir{background:radial-gradient(circle at 50% 50%,transparent 56%,rgba(0,0,0,.66) 100%)}
.glb-reticle{position:absolute;left:50%;top:50%;width:58px;height:58px;transform:translate(-50%,-50%);border:1px solid rgba(56,189,248,.34);border-radius:50%;opacity:0;pointer-events:none;z-index:7}
.glb-fx.on ~ .glb-reticle{opacity:.85}
.glb-reticle::before,.glb-reticle::after{content:"";position:absolute;background:rgba(56,189,248,.48)}
.glb-reticle::before{left:50%;top:-10px;bottom:-10px;width:1px;transform:translateX(-.5px)}
.glb-reticle::after{top:50%;left:-10px;right:-10px;height:1px;transform:translateY(-.5px)}
.glb-fx.fx-nvg ~ .glb-reticle{border-color:rgba(74,222,128,.55)}
.glb-fx.fx-nvg ~ .glb-reticle::before,.glb-fx.fx-nvg ~ .glb-reticle::after{background:rgba(74,222,128,.6)}
.glb-fx.fx-flir ~ .glb-reticle{border-color:rgba(251,146,60,.65)}
.glb-fx.fx-flir ~ .glb-reticle::before,.glb-fx.fx-flir ~ .glb-reticle::after{background:rgba(251,146,60,.7)}
#glb-map .maplibregl-ctrl-attrib{background:rgba(6,10,24,.78);color:#94a3b8;font-size:10px;border-radius:8px 0 0 0}
#glb-map .maplibregl-ctrl-attrib a{color:#cbd5e1}
.glb-glass{background:linear-gradient(180deg,rgba(15,23,42,.92),rgba(7,11,24,.94));border:1px solid rgba(148,163,184,.22);box-shadow:0 8px 26px rgba(0,0,0,.52);color:#e2e8f0}
.glb-top{position:absolute;top:12px;left:12px;right:12px;display:flex;align-items:center;gap:8px;flex-wrap:wrap;z-index:12;pointer-events:none}
.glb-top > *{pointer-events:auto}
.glb-brand{display:flex;align-items:center;gap:10px;padding:7px 13px;border-radius:14px}
.glb-brand-ic{width:32px;height:32px;border-radius:10px;display:grid;place-items:center;font-size:18px;background:linear-gradient(135deg,#0ea5e9,#6366f1);box-shadow:0 0 18px rgba(14,165,233,.45)}
.glb-brand b{font-size:13.5px;display:block;line-height:1.15;color:#f8fafc}
.glb-brand span{font-size:10.5px;color:#94a3b8;display:block;font-variant-numeric:tabular-nums}
.glb-bar{display:flex;align-items:center;gap:4px;padding:4px;border-radius:12px;flex-wrap:wrap}
.glb-btn{border:1px solid transparent;background:transparent;color:#cbd5e1;padding:6px 9px;border-radius:8px;font-size:11.5px;font-weight:600;cursor:pointer;display:inline-flex;align-items:center;gap:4px;white-space:nowrap;transition:background-color .14s,color .14s,border-color .14s}
.glb-btn:hover{background:rgba(148,163,184,.16);color:#fff}
.glb-btn.on{background:linear-gradient(135deg,rgba(14,165,233,.34),rgba(99,102,241,.34));border-color:rgba(56,189,248,.6);color:#fff}
.glb-btn.warn{background:rgba(245,158,11,.22);border-color:rgba(251,191,36,.55);color:#fef3c7}
.glb-sel{background:rgba(15,23,42,.95);border:1px solid rgba(148,163,184,.28);color:#f8fafc;border-radius:8px;padding:5px 20px 5px 9px;font-size:11.5px;font-weight:600;cursor:pointer;outline:none}
.glb-qwrap{position:relative;flex:1;min-width:170px;max-width:270px}
.glb-q{width:100%;box-sizing:border-box;padding:7px 28px 7px 12px;border-radius:12px;border:1px solid rgba(148,163,184,.28);background:rgba(11,17,34,.92);color:#f8fafc;font-size:12.5px;outline:none}
.glb-q:focus{border-color:#38bdf8;box-shadow:0 0 0 3px rgba(56,189,248,.22)}
.glb-qclr{position:absolute;right:8px;top:50%;transform:translateY(-50%);border:0;background:none;color:#94a3b8;cursor:pointer;font-size:13px;display:none}
.glb-hits{position:absolute;left:0;right:0;top:calc(100% + 6px);border-radius:12px;max-height:320px;overflow:auto;display:none;z-index:25;padding:5px}
.glb-hits.on{display:block}
.glb-hit{display:flex;align-items:center;gap:8px;padding:7px 10px;border-radius:8px;cursor:pointer;font-size:12.5px;color:#e2e8f0}
.glb-hit:hover{background:rgba(56,189,248,.18);color:#fff}
.glb-hit small{margin-left:auto;font-size:11px;color:#94a3b8;white-space:nowrap}
.glb-dock{position:absolute;left:12px;bottom:14px;display:flex;flex-direction:column;gap:7px;z-index:12;max-width:calc(100% - 375px)}
.glb-layers{display:flex;gap:5px;flex-wrap:wrap;padding:6px;border-radius:13px;align-items:center}
.glb-div{width:1px;height:18px;background:rgba(148,163,184,.24);margin:0 2px}
.glb-chip{display:inline-flex;align-items:center;gap:4px;padding:4px 9px;border-radius:999px;border:1px solid rgba(148,163,184,.22);background:rgba(15,23,42,.86);color:#cbd5e1;font-size:11px;font-weight:600;cursor:pointer;transition:border-color .14s,background-color .14s,color .14s}
.glb-chip:hover{border-color:#38bdf8;color:#fff}
.glb-chip.on{background:rgba(14,165,233,.24);border-color:rgba(56,189,248,.68);color:#fff}
.glb-chip.osint.on{background:rgba(16,185,129,.22);border-color:rgba(52,211,153,.72);color:#ecfdf5}
.glb-chip.mil.on{background:rgba(245,158,11,.24);border-color:rgba(251,191,36,.75);color:#fef3c7}
.glb-chip.red.on{background:rgba(244,63,94,.24);border-color:rgba(251,113,133,.75);color:#ffe4e6}
.glb-chip .glb-cnt{font-size:10px;opacity:.85;font-variant-numeric:tabular-nums;background:rgba(2,6,23,.55);padding:0 5px;border-radius:99px}
.glb-coords{position:absolute;right:12px;bottom:28px;z-index:11;padding:5px 11px;border-radius:10px;font:600 11px/1.3 Consolas,monospace;color:#cbd5e1;pointer-events:none}
.glb-measure,.glb-lock{position:absolute;left:50%;transform:translateX(-50%);z-index:14;padding:7px 14px;border-radius:14px;display:none;align-items:center;gap:10px;font-size:12px}
.glb-measure{bottom:96px}
.glb-lock{top:72px;border-color:rgba(52,211,153,.6);background:linear-gradient(180deg,rgba(6,78,59,.92),rgba(4,47,46,.95))}
.glb-measure.on,.glb-lock.on{display:flex}
.glb-cmd{display:none;flex-direction:column;gap:7px;padding:10px 12px;border-radius:14px;width:460px;max-width:calc(100vw - 24px)}
.glb-cmd.on{display:flex}
.glb-cmd-row{display:flex;gap:6px;align-items:center}
.glb-cmd-in{flex:1;padding:7px 10px;border-radius:9px;border:1px solid rgba(148,163,184,.28);background:rgba(2,6,23,.85);color:#f8fafc;font-size:12px;outline:none}
.glb-cmd-in:focus{border-color:#38bdf8}
.glb-cmd-out{font-size:12px;line-height:1.45;color:#cbd5e1;max-height:150px;overflow:auto;white-space:pre-wrap;display:none;padding:7px 9px;border-radius:9px;background:rgba(2,6,23,.68);border:1px solid rgba(148,163,184,.16)}
.glb-cmd-out.on{display:block}
.glb-cmd-sugg{display:flex;gap:5px;flex-wrap:wrap}
.glb-cmd-sugg button{border:1px solid rgba(148,163,184,.22);background:rgba(15,23,42,.75);color:#94a3b8;font-size:10.5px;padding:3px 7px;border-radius:99px;cursor:pointer}
.glb-cmd-sugg button:hover{color:#fff;border-color:#38bdf8}
.glb-insp{position:absolute;top:72px;right:12px;bottom:68px;width:345px;max-width:calc(100vw - 24px);border-radius:16px;z-index:15;display:none;flex-direction:column;overflow:hidden}
.glb-insp.on{display:flex}
.glb-ihd{display:flex;align-items:center;gap:10px;padding:12px 14px;border-bottom:1px solid rgba(148,163,184,.18)}
.glb-iic{width:38px;height:38px;border-radius:11px;display:grid;place-items:center;font-size:20px;background:rgba(56,189,248,.16);border:1px solid rgba(56,189,248,.35);flex:none}
.glb-imeta{flex:1;min-width:0}
.glb-imeta b{display:block;font-size:14.5px;color:#f8fafc;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.glb-imeta span{display:block;font-size:11px;color:#94a3b8;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.glb-ix{border:0;background:rgba(148,163,184,.14);color:#cbd5e1;width:28px;height:28px;border-radius:8px;cursor:pointer}
.glb-ix:hover{background:rgba(244,63,94,.28);color:#fff}
.glb-ibd{flex:1;overflow:auto;padding:12px 14px;display:flex;flex-direction:column;gap:10px;font-size:12px}
.glb-kv{display:grid;grid-template-columns:1fr 1fr;gap:7px}
.glb-kv > div{padding:7px 9px;border-radius:9px;background:rgba(15,23,42,.72);border:1px solid rgba(148,163,184,.16)}
.glb-kv span{font-size:10px;color:#94a3b8;display:block}
.glb-kv b{font-size:12px;color:#f8fafc;display:block;margin-top:2px;word-break:break-word}
.glb-acts{display:grid;grid-template-columns:1fr 1fr;gap:6px}
.glb-act{padding:7px 9px;border-radius:9px;border:1px solid rgba(148,163,184,.24);background:rgba(30,41,59,.72);color:#f8fafc;font-size:11.5px;font-weight:600;cursor:pointer;text-align:center}
.glb-act:hover{border-color:#38bdf8;background:rgba(56,189,248,.2)}
.glb-act.pri{grid-column:1 / -1;background:linear-gradient(135deg,rgba(14,165,233,.42),rgba(99,102,241,.42));border-color:rgba(56,189,248,.6)}
.glb-act.lock{grid-column:1 / -1;background:linear-gradient(135deg,rgba(16,185,129,.38),rgba(6,182,212,.38));border-color:rgba(52,211,153,.65)}
.glb-cambox{border-radius:11px;overflow:hidden;border:1px solid rgba(56,189,248,.35);background:#020617;display:none;flex-direction:column}
.glb-cambox.on{display:flex}
.glb-cambox iframe{width:100%;height:178px;border:0;display:block;background:#000}
.glb-camhd{display:flex;align-items:center;justify-content:space-between;padding:5px 9px;font-size:11px;color:#cbd5e1;background:rgba(15,23,42,.9)}
.glb-roster{display:none;flex-direction:column;gap:5px}
.glb-roster.on{display:flex}
.glb-rrow{display:flex;align-items:center;gap:7px;padding:6px 8px;border-radius:8px;background:rgba(15,23,42,.72);border:1px solid rgba(148,163,184,.16);cursor:pointer;font-size:11.5px}
.glb-rrow:hover{border-color:#38bdf8;background:rgba(56,189,248,.14)}
.glb-rrow small{margin-left:auto;color:#94a3b8;font-variant-numeric:tabular-nums;white-space:nowrap}
.glb-tip{position:absolute;z-index:16;pointer-events:none;padding:6px 10px;border-radius:9px;background:rgba(2,6,23,.93);border:1px solid rgba(56,189,248,.48);font-size:11.5px;color:#f8fafc;white-space:nowrap;display:none;transform:translate(-50%,-135%)}
.glb-pins{display:flex;flex-direction:column;gap:5px}
.glb-pinrow{display:flex;align-items:center;gap:6px;padding:6px 8px;border-radius:8px;background:rgba(15,23,42,.7);border:1px solid rgba(148,163,184,.16);cursor:pointer;font-size:11.5px}
.glb-pinrow:hover{border-color:#38bdf8}
.glb-pinrow button{margin-left:auto;border:0;background:none;color:#94a3b8;cursor:pointer;padding:1px 5px;border-radius:5px}
.glb-pinrow button:hover{color:#fb7185;background:rgba(244,63,94,.16)}
.glb-cache{display:flex;align-items:center;justify-content:space-between;gap:8px;padding:7px 9px;border-radius:9px;background:rgba(15,23,42,.68);border:1px solid rgba(148,163,184,.16);font-size:11px;color:#94a3b8}
.glb-packs{position:absolute;top:72px;right:12px;bottom:68px;width:365px;max-width:calc(100vw - 24px);border-radius:16px;z-index:17;display:none;flex-direction:column;overflow:hidden}
.glb-packs.on{display:flex}
.glb-pk-sec{padding:10px 12px;border-radius:11px;background:rgba(15,23,42,.72);border:1px solid rgba(148,163,184,.18);display:flex;flex-direction:column;gap:8px}
.glb-pk-lbl{font-size:10.5px;font-weight:700;color:#94a3b8;text-transform:uppercase;letter-spacing:.05em}
.glb-pk-row{display:flex;gap:6px;align-items:center}
.glb-pk-in{flex:1;padding:7px 10px;border-radius:9px;border:1px solid rgba(148,163,184,.28);background:rgba(2,6,23,.88);color:#f8fafc;font-size:12px;outline:none}
.glb-pk-in:focus{border-color:#34d399}
.glb-pk-hits{display:none;flex-direction:column;gap:3px;max-height:145px;overflow:auto;padding:4px;border-radius:9px;background:rgba(2,6,23,.86);border:1px solid rgba(148,163,184,.2)}
.glb-pk-hits.on{display:flex}
.glb-pk-hit{display:flex;align-items:center;gap:6px;padding:5px 8px;border-radius:7px;cursor:pointer;font-size:11.5px;color:#e2e8f0}
.glb-pk-hit:hover{background:rgba(52,211,153,.18);color:#fff}
.glb-pk-hit small{margin-left:auto;color:#34d399;font-size:10px;text-transform:uppercase;white-space:nowrap}
.glb-pk-presets{display:grid;grid-template-columns:repeat(3,1fr);gap:5px}
.glb-pk-est{padding:7px 9px;border-radius:8px;background:rgba(6,78,59,.32);border:1px solid rgba(52,211,153,.4);font-size:11.5px;color:#d1fae5;line-height:1.35}
.glb-pk-est.warn{background:rgba(127,29,29,.38);border-color:rgba(248,113,113,.55);color:#fecaca}
.glb-prog-wrap{display:none;flex-direction:column;gap:6px;padding:9px 10px;border-radius:10px;background:rgba(6,78,59,.35);border:1px solid rgba(52,211,153,.45)}
.glb-prog-wrap.on{display:flex}
.glb-prog-bar{height:8px;border-radius:99px;background:rgba(2,6,23,.8);overflow:hidden}
.glb-prog-fill{height:100%;width:0%;background:linear-gradient(90deg,#10b981,#38bdf8);transition:width .25s ease}
.glb-pk-card{display:flex;flex-direction:column;gap:4px;padding:8px 10px;border-radius:10px;background:rgba(15,23,42,.74);border:1px solid rgba(148,163,184,.18)}
.glb-pk-card:hover{border-color:#34d399}
.glb-pk-top{display:flex;align-items:center;gap:6px}
.glb-pk-top b{flex:1;font-size:12px;color:#f8fafc;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.glb-pk-meta{font-size:10.5px;color:#94a3b8;display:flex;gap:8px;flex-wrap:wrap}
.glb-load{position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:10px;z-index:20;color:#e2e8f0;background:radial-gradient(circle at 50% 45%,rgba(14,165,233,.14),rgba(4,7,18,.96))}
`;
    document.head.appendChild(st);
  }

  /* ---------- Embedded Offline Undersea Fiber Optic Backbone (~4 KB, 100% offline!) ---------- */
  const SUBMARINE_CABLES = [
    { name: 'MAREA (Virginia Beach ↔ Bilbao)', owner: 'Microsoft / Meta / Telxius · 200 Tbps', pts: [[-75.98, 36.85], [-60, 38.5], [-40, 41.2], [-20, 42.8], [-2.93, 43.26]] },
    { name: 'Grace Hopper (New York ↔ UK & Spain)', owner: 'Google · 350 Tbps', pts: [[-73.7, 40.6], [-55, 44.5], [-35, 48.2], [-15, 50.1], [-4.55, 50.83]] },
    { name: 'Dunant (Virginia ↔ France)', owner: 'Google · 250 Tbps', pts: [[-75.98, 36.85], [-55, 40.2], [-30, 44.5], [-10, 46.2], [-1.85, 46.7]] },
    { name: 'Havfrue (New Jersey ↔ Norway & Denmark)', owner: 'Google / Meta / Bulk · 108 Tbps', pts: [[-74.0, 40.1], [-55, 46], [-32, 53.5], [-10, 57.5], [8.1, 56.8]] },
    { name: 'Amitie (Massachusetts ↔ UK & France)', owner: 'Meta / Microsoft / Amazon · 400 Tbps', pts: [[-70.9, 42.45], [-50, 45.2], [-28, 47.8], [-5.2, 49.5], [-1.2, 44.8]] },
    { name: 'EllaLink (Brazil ↔ Portugal)', owner: 'EllaLink · 100 Tbps', pts: [[-38.5, -3.7], [-31, 6.5], [-24, 17], [-17, 29], [-8.86, 37.95]] },
    { name: 'Monet (Miami ↔ Sao Paulo)', owner: 'Google / Algar / Antel · 64 Tbps', pts: [[-80.1, 26.3], [-68, 17], [-50, 6], [-34, -8], [-46.3, -23.95]] },
    { name: 'Curie (Los Angeles ↔ Valparaiso, Chile)', owner: 'Google · 72 Tbps', pts: [[-118.4, 33.9], [-108, 18], [-92, 4], [-82, -14], [-71.6, -33.0]] },
    { name: 'SAm-1 (US ↔ Latin America Ring)', owner: 'Telxius', pts: [[-80.1, 26.3], [-66.1, 18.4], [-38.5, -3.7], [-43.2, -22.9], [-58.4, -34.6]] },
    { name: 'Equiano (Portugal ↔ Cape Town)', owner: 'Google · 144 Tbps', pts: [[-9.1, 38.7], [-18, 22], [-16, 8], [3.4, 6.4], [9, -8], [14, -22], [18.4, -33.9]] },
    { name: '2Africa (Europe ↔ Africa ↔ Middle East)', owner: 'Meta / Vodafone / China Mobile · 180 Tbps', pts: [[-4.5, 50.8], [-9.4, 38.7], [-17.4, 14.7], [3.4, 6.4], [18.4, -33.9], [39.3, -6.8], [43.2, 11.6], [34.5, 27.5], [29.9, 31.2], [8.9, 44.4]] },
    { name: 'SEA-ME-WE 5 (France ↔ Egypt ↔ Singapore)', owner: 'Global Consortium · 24 Tbps', pts: [[5.4, 43.3], [15.5, 37.5], [32.3, 31.2], [38.5, 21.5], [45, 12.6], [62, 16], [79.8, 6.9], [95, 5.5], [103.8, 1.3]] },
    { name: 'PEACE (France ↔ Kenya ↔ Pakistan ↔ Singapore)', owner: 'PEACE Cable · 96 Tbps', pts: [[5.4, 43.3], [32.3, 31.2], [43.2, 11.6], [39.7, -4.0], [54, 15], [67.0, 24.8], [80, 5], [103.8, 1.3]] },
    { name: 'FASTER (Oregon ↔ Japan ↔ Taiwan)', owner: 'Google / KDDI / Singtel · 60 Tbps', pts: [[-124.4, 43.1], [-150, 44], [-178, 42], [160, 39], [140.4, 35.1], [121.6, 25.1]] },
    { name: 'JUPITER (California ↔ Japan & Philippines)', owner: 'Amazon / Meta / SoftBank · 60 Tbps', pts: [[-118.4, 33.9], [-145, 34], [-176, 33], [155, 34], [136.9, 34.3], [121.6, 15.8]] },
    { name: 'Pacific Light (Los Angeles ↔ Taiwan & Philippines)', owner: 'Google / Meta · 144 Tbps', pts: [[-118.4, 33.9], [-145, 29], [-175, 25], [150, 23], [121.6, 23.0]] },
    { name: 'Southern Cross NEXT (Los Angeles ↔ Fiji ↔ Sydney)', owner: 'Southern Cross · 72 Tbps', pts: [[-118.4, 33.9], [-142, 16], [-164, -2], [178.4, -18.1], [174.7, -36.8], [151.2, -33.9]] },
    { name: 'Hawaiki (Oregon ↔ Hawaii ↔ Australia & NZ)', owner: 'BW Digital · 67 Tbps', pts: [[-123.9, 45.2], [-157.8, 21.3], [-171.8, -13.8], [174.7, -36.8], [151.2, -33.9]] },
    { name: 'APG (Japan ↔ Korea ↔ China ↔ Singapore)', owner: 'Asia-Pacific Gateway · 54 Tbps', pts: [[139.8, 35.4], [129.0, 35.1], [121.5, 31.2], [114.2, 22.3], [109.2, 16.0], [103.8, 1.3]] },
    { name: 'INDIGO (Singapore ↔ Perth ↔ Sydney)', owner: 'Google / AARNet / Singtel · 36 Tbps', pts: [[103.8, 1.3], [106.8, -6.2], [115.8, -31.9], [135, -36.5], [151.2, -33.9]] }
  ];

  function splitAntimeridian(pts) {
    const segs = [];
    let cur = [];
    for (let i = 0; i < pts.length; i++) {
      const p = pts[i];
      if (cur.length && Math.abs(p[0] - cur[cur.length - 1][0]) > 180) {
        if (cur.length >= 2) segs.push(cur);
        cur = [p];
      } else {
        cur.push(p);
      }
    }
    if (cur.length >= 2) segs.push(cur);
    return segs;
  }

  function buildCablesGeoJSON() {
    const features = [];
    for (const c of SUBMARINE_CABLES) {
      const segs = splitAntimeridian(c.pts);
      for (const coords of segs) {
        features.push({
          type: 'Feature',
          properties: { name: c.name, owner: c.owner },
          geometry: { type: 'LineString', coordinates: coords }
        });
      }
    }
    return { type: 'FeatureCollection', features };
  }

  /* ---------- Math helpers: Graticule, Solar Terminator, Great-Circle, Geodesic Rings, Orbital Propagation ---------- */
  function buildGraticuleGeoJSON() {
    const features = [];
    for (let lon = -180; lon <= 180; lon += 15) {
      const coords = [];
      for (let lat = -85; lat <= 85; lat += 5) coords.push([lon, lat]);
      features.push({ type: 'Feature', properties: { major: lon === 0 ? 1 : 0 }, geometry: { type: 'LineString', coordinates: coords } });
    }
    for (let lat = -75; lat <= 75; lat += 15) {
      const coords = [];
      for (let lon = -180; lon <= 180; lon += 5) coords.push([lon, lat]);
      features.push({ type: 'Feature', properties: { major: lat === 0 ? 1 : 0 }, geometry: { type: 'LineString', coordinates: coords } });
    }
    return { type: 'FeatureCollection', features };
  }

  function buildTerminatorGeoJSON(date) {
    const d = date || new Date();
    const rad = Math.PI / 180, deg = 180 / Math.PI;
    const jd = d.getTime() / 86400000 + 2440587.5;
    const n = jd - 2451545.0;
    const L = (280.460 + 0.9856474 * n) % 360;
    const g = ((357.528 + 0.9856003 * n) % 360) * rad;
    const lambda = (L + 1.915 * Math.sin(g) + 0.020 * Math.sin(2 * g)) * rad;
    const eps = 23.439 * rad;
    const decl = Math.asin(Math.sin(eps) * Math.sin(lambda));
    const utcHours = d.getUTCHours() + d.getUTCMinutes() / 60 + d.getUTCSeconds() / 3600;
    const subSolarLon = (12 - utcHours) * 15;
    const ring = [];
    for (let lon = -180; lon <= 180; lon += 3) {
      const ha = (lon - subSolarLon) * rad;
      const lat = Math.atan(-Math.cos(ha) / Math.tan(decl || 1e-4)) * deg;
      ring.push([lon, Math.max(-89.5, Math.min(89.5, lat))]);
    }
    const nightPole = decl >= 0 ? -89.5 : 89.5;
    ring.push([180, nightPole], [-180, nightPole], ring[0]);
    return { type: 'FeatureCollection', features: [{ type: 'Feature', properties: {}, geometry: { type: 'Polygon', coordinates: [ring] } }] };
  }

  function haversineKm(a, b) {
    const R = 6371, rad = Math.PI / 180;
    const dLat = (b[1] - a[1]) * rad, dLon = (b[0] - a[0]) * rad;
    const s = Math.sin(dLat / 2) ** 2 + Math.cos(a[1] * rad) * Math.cos(b[1] * rad) * Math.sin(dLon / 2) ** 2;
    return 2 * R * Math.asin(Math.min(1, Math.sqrt(s)));
  }

  function greatCircleArc(a, b, steps) {
    const rad = Math.PI / 180, deg = 180 / Math.PI;
    const lat1 = a[1] * rad, lon1 = a[0] * rad, lat2 = b[1] * rad, lon2 = b[0] * rad;
    const d = 2 * Math.asin(Math.sqrt(Math.sin((lat2 - lat1) / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin((lon2 - lon1) / 2) ** 2));
    if (d < 1e-5) return [a, b];
    const pts = [], N = steps || 64;
    for (let i = 0; i <= N; i++) {
      const f = i / N;
      const A0 = Math.sin((1 - f) * d) / Math.sin(d);
      const B0 = Math.sin(f * d) / Math.sin(d);
      const x = A0 * Math.cos(lat1) * Math.cos(lon1) + B0 * Math.cos(lat2) * Math.cos(lon2);
      const y = A0 * Math.cos(lat1) * Math.sin(lon1) + B0 * Math.cos(lat2) * Math.sin(lon2);
      const z = A0 * Math.sin(lat1) + B0 * Math.sin(lat2);
      pts.push([Math.atan2(y, x) * deg, Math.atan2(z, Math.sqrt(x * x + y * y)) * deg]);
    }
    return pts;
  }

  function destPoint(lon, lat, bearingDeg, distKm) {
    const R = 6371, rad = Math.PI / 180, deg = 180 / Math.PI;
    const dr = distKm / R, br = bearingDeg * rad;
    const lat1 = lat * rad, lon1 = lon * rad;
    const lat2 = Math.asin(Math.sin(lat1) * Math.cos(dr) + Math.cos(lat1) * Math.sin(dr) * Math.cos(br));
    const lon2 = lon1 + Math.atan2(Math.sin(br) * Math.sin(dr) * Math.cos(lat1), Math.cos(dr) - Math.sin(lat1) * Math.sin(lat2));
    return [((lon2 * deg + 540) % 360) - 180, Math.max(-89.5, Math.min(89.5, lat2 * deg))];
  }

  function geodesicRing(lon, lat, radiusKm, steps = 64) {
    const pts = [];
    for (let i = 0; i <= steps; i++) {
      pts.push(destPoint(lon, lat, (i / steps) * 360, radiusKm));
    }
    return splitAntimeridian(pts);
  }

  /* Pure-JS Keplerian + J2 Nodal Precession Satellite Propagator (zero external dependencies, 60+ FPS!) */
  function propagateGP(s, dateMs) {
    const MU = 398600.4418, RE = 6378.137, J2 = 1.08263e-3;
    const rad = Math.PI / 180, deg = 180 / Math.PI, TWO_PI = Math.PI * 2;
    const n = (s.mm * TWO_PI) / 86400; // rad/s
    const a = Math.cbrt(MU / (n * n));
    const ecc = Math.min(0.85, Math.max(0, s.ecc || 0));
    const inc = s.inc * rad;
    const epochMs = s._epochMs || (s._epochMs = Date.parse(s.epoch.endsWith('Z') ? s.epoch : s.epoch + 'Z') || dateMs);
    const dt = (dateMs - epochMs) / 1000;
    const p = a * (1 - ecc * ecc);
    const j2fac = 1.5 * n * J2 * (RE / p) * (RE / p);
    const raan = s.raan * rad - j2fac * Math.cos(inc) * dt;
    const argp = s.argp * rad + 0.5 * j2fac * (5 * Math.cos(inc) * Math.cos(inc) - 1) * dt;
    let M = (s.ma * rad + n * dt) % TWO_PI;
    if (M < 0) M += TWO_PI;
    let E = M + ecc * Math.sin(M);
    for (let i = 0; i < 3; i++) E -= (E - ecc * Math.sin(E) - M) / (1 - ecc * Math.cos(E));
    const nu = 2 * Math.atan2(Math.sqrt(1 + ecc) * Math.sin(E / 2), Math.sqrt(1 - ecc) * Math.cos(E / 2));
    const r = a * (1 - ecc * Math.cos(E));
    const u = argp + nu;
    const cosR = Math.cos(raan), sinR = Math.sin(raan), cosU = Math.cos(u), sinU = Math.sin(u), cosI = Math.cos(inc);
    const x = r * (cosR * cosU - sinR * sinU * cosI);
    const y = r * (sinR * cosU + cosR * sinU * cosI);
    const z = r * (sinU * Math.sin(inc));
    const jd = dateMs / 86400000 + 2440587.5;
    const gmst = (280.46061837 + 360.98564736629 * (jd - 2451545.0)) % 360;
    const lon = (((Math.atan2(y, x) * deg - gmst) % 360) + 540) % 360 - 180;
    const lat = Math.asin(Math.max(-1, Math.min(1, z / r))) * deg;
    const altKm = Math.max(120, Math.round(r - 6371));
    const velKmh = Math.round(Math.sqrt(Math.max(0, MU * (2 / r - 1 / a))) * 3600);
    return { lon, lat, altKm, velKmh };
  }

  function buildSatOrbitFeatures(gpItem, nowMs) {
    const periodMin = Math.min(240, Math.max(80, Math.round(1440 / (gpItem.mm || 15))));
    const pts = [];
    for (let m = -Math.round(periodMin * 0.2); m <= Math.round(periodMin * 0.85); m += 1.5) {
      const pos = propagateGP(gpItem, nowMs + m * 60000);
      pts.push([pos.lon, pos.lat]);
    }
    const cur = propagateGP(gpItem, nowMs);
    const segs = splitAntimeridian(pts);
    const feats = segs.map(coords => ({
      type: 'Feature', properties: { kind: 'orbit' }, geometry: { type: 'LineString', coordinates: coords }
    }));
    // Sensor horizon footprint ring
    const horizonKm = Math.min(3500, Math.round(Math.sqrt(2 * 6371 * cur.altKm) * 0.72));
    for (const ring of geodesicRing(cur.lon, cur.lat, horizonKm, 60)) {
      feats.push({ type: 'Feature', properties: { kind: 'footprint' }, geometry: { type: 'LineString', coordinates: ring } });
    }
    return feats;
  }

  const fmtPop = n => !n ? '—' : n >= 1e9 ? (n / 1e9).toFixed(2) + 'B' : n >= 1e6 ? (n / 1e6).toFixed(2) + 'M' : n >= 1e3 ? (n / 1e3).toFixed(1) + 'K' : String(n);
  const fmtCoord = (lat, lon) => Math.abs(lat).toFixed(3) + '°' + (lat >= 0 ? 'N' : 'S') + ', ' + Math.abs(lon).toFixed(3) + '°' + (lon >= 0 ? 'E' : 'W');
  const fmtAge = ts => {
    if (!ts) return '—';
    const mins = Math.max(0, Math.round((Date.now() - ts) / 60000));
    return mins < 60 ? mins + 'm ago' : (mins / 60).toFixed(1) + 'h ago';
  };
  const solarTimeAt = lon => {
    const now = new Date();
    const utcMins = now.getUTCHours() * 60 + now.getUTCMinutes();
    let loc = ((Math.round(utcMins + (lon / 15) * 60) % 1440) + 1440) % 1440;
    const h = Math.floor(loc / 60), m = loc % 60;
    return ((h % 12) || 12) + ':' + String(m).padStart(2, '0') + ' ' + (h >= 12 ? 'PM' : 'AM');
  };

  /* ---------- Lazy asset loader (zero startup cost; served from /web/vendor/globe/) ---------- */
  const GLOBE_BASE = '/web/vendor/globe';
  let libPromise = null;
  function loadMapLibre() {
    if (window.maplibregl) return Promise.resolve(window.maplibregl);
    if (libPromise) return libPromise;
    libPromise = new Promise((resolve, reject) => {
      if (!document.getElementById('maplibre-css')) {
        const lk = document.createElement('link');
        lk.id = 'maplibre-css'; lk.rel = 'stylesheet'; lk.href = GLOBE_BASE + '/maplibre-gl.css';
        document.head.appendChild(lk);
      }
      const sc = document.createElement('script');
      sc.src = GLOBE_BASE + '/maplibre-gl.js';
      sc.onload = () => window.maplibregl ? resolve(window.maplibregl) : reject(new Error('MapLibre failed to initialize'));
      sc.onerror = () => reject(new Error('Could not load ' + GLOBE_BASE + '/maplibre-gl.js'));
      document.head.appendChild(sc);
    });
    return libPromise;
  }

  let dataPromise = null;
  const DATA_CACHE = { countries: null, states: null, lakes: null, rivers: null, cities: null, cables: buildCablesGeoJSON() };
  function loadGlobeData() {
    if (DATA_CACHE.countries) return Promise.resolve(DATA_CACHE);
    if (dataPromise) return dataPromise;
    const getJ = name => fetch(GLOBE_BASE + '/data/' + name).then(r => {
      if (!r.ok) throw new Error('HTTP ' + r.status + ' loading ' + name);
      return r.json();
    });
    dataPromise = Promise.all([
      getJ('countries.json'),
      getJ('states.json'),
      getJ('lakes.json'),
      getJ('rivers.json'),
      getJ('cities.json')
    ]).then(([countries, states, lakes, rivers, cities]) => {
      DATA_CACHE.countries = countries;
      DATA_CACHE.states = states;
      DATA_CACHE.lakes = lakes;
      DATA_CACHE.rivers = rivers;
      DATA_CACHE.cities = cities;
      return DATA_CACHE;
    });
    return dataPromise;
  }

  /* ---------- State ---------- */
  const emptyFC = { type: 'FeatureCollection', features: [] };
  const S = {
    built: false,
    map: null,
    styleId: 'midnight',
    proj: 'globe',
    fx: 'std', // std | nvg | flir | crt | noir
    spin: true,
    layers: {
      states: true, water: true, cities: true, grid: true, night: false,
      cables: false, flights: false, military: false, satellites: false,
      quakes: false, events: false, weather: false, cams: false
    },
    osint: {
      flights: [],
      military: [],
      satsGP: [],
      satsLive: [],
      issLive: null,
      quakes: [],
      events: [],
      cams: [],
      radarPath: '',
      radarTime: 0,
      selectedSatNorad: 25544
    },
    lock: null,         // { kind: 'flight'|'military'|'sat', id, name }
    scanCenter: null,   // { lon, lat, name }
    searchIndex: [],
    selected: null,
    measureOn: false,
    measurePts: [],
    pins: (() => { try { return JSON.parse(localStorage.getItem(PINS_KEY) || '[]'); } catch (e) { return []; } })(),
    raf: 0,
    satTimer: 0,
    pollTimer: 0,
    fpsFrames: 0,
    fpsLast: 0,
    liveFps: 60,
    lastSpinTs: 0,
    hoveredCountryId: null,
    cacheInfo: { bytes: 0, files: 0, maxBytes: 150 * 1024 * 1024 },
    packs: [],
    packShowBoxes: true,
    packDraft: null,   // { name, bbox: { south, north, west, east }, style, maxZ }
    packEst: null,
    packJob: null,
    packPoll: 0
  };

  const savePins = () => { try { localStorage.setItem(PINS_KEY, JSON.stringify(S.pins.slice(0, 60))); } catch (e) { } };
  const tileUrl = s => location.origin + '/api/globe/tile?s=' + s + '&z={z}&x={x}&y={y}';

  const THEMES = {
    midnight: {
      bg: '#040a1a',
      landPalette: ['#162647', '#1a2d52', '#173054', '#1d2b4e', '#183359', '#1e2c57', '#142b4c'],
      landOutline: '#38bdf8', stateLine: 'rgba(148, 163, 184, 0.30)', waterFill: '#071a38',
      riverLine: '#0ea5e9', gridLine: 'rgba(56, 189, 248, 0.14)', cityCol: '#38bdf8', capCol: '#facc15', raster: null,
      sky: { 'sky-color': '#0b1938', 'sky-horizon-blend': 0.5, 'horizon-color': '#1d4ed8', 'horizon-fog-blend': 0.5, 'fog-color': '#060c1f', 'fog-ground-blend': 0.25 }
    },
    daylight: {
      bg: '#8ecae6',
      landPalette: ['#dde7c7', '#e9edc9', '#d8e2dc', '#e6e8d5', '#cfe1b9', '#e3ead2', '#d9e5d6'],
      landOutline: '#475569', stateLine: 'rgba(71, 85, 105, 0.35)', waterFill: '#74b9dc',
      riverLine: '#3898c8', gridLine: 'rgba(15, 23, 42, 0.14)', cityCol: '#0284c7', capCol: '#dc2626', raster: null,
      sky: { 'sky-color': '#38bdf8', 'sky-horizon-blend': 0.4, 'horizon-color': '#bae6fd', 'horizon-fog-blend': 0.5, 'fog-color': '#e0f2fe', 'fog-ground-blend': 0.15 }
    },
    hybrid: {
      bg: '#030816', landPalette: Array(7).fill('#12203b'),
      landOutline: 'rgba(255, 255, 255, 0.45)', stateLine: 'rgba(255, 255, 255, 0.28)', waterFill: 'rgba(7, 26, 56, 0.25)',
      riverLine: 'rgba(56, 189, 248, 0.5)', gridLine: 'rgba(255, 255, 255, 0.14)', cityCol: '#38bdf8', capCol: '#facc15',
      raster: { tiles: () => [tileUrl('satellite')], overlayTiles: () => [tileUrl('labels')], tileSize: 256, maxzoom: 17, attribution: 'Esri Imagery (capped local cache)' },
      sky: { 'sky-color': '#0b1938', 'sky-horizon-blend': 0.5, 'horizon-color': '#2563eb', 'horizon-fog-blend': 0.5, 'fog-color': '#04091a', 'fog-ground-blend': 0.25 }
    },
    satellite: {
      bg: '#030816', landPalette: Array(7).fill('#12203b'),
      landOutline: 'rgba(255, 255, 255, 0.55)', stateLine: 'rgba(255, 255, 255, 0.35)', waterFill: 'rgba(7, 26, 56, 0.25)',
      riverLine: 'rgba(56, 189, 248, 0.55)', gridLine: 'rgba(255, 255, 255, 0.16)', cityCol: '#38bdf8', capCol: '#facc15',
      raster: { tiles: () => [tileUrl('satellite')], tileSize: 256, maxzoom: 17, attribution: 'Esri Imagery (capped local cache)' },
      sky: { 'sky-color': '#0b1938', 'sky-horizon-blend': 0.5, 'horizon-color': '#2563eb', 'horizon-fog-blend': 0.5, 'fog-color': '#04091a', 'fog-ground-blend': 0.25 }
    },
    dark: {
      bg: '#090d16', landPalette: Array(7).fill('#141a26'),
      landOutline: 'rgba(56, 189, 248, 0.4)', stateLine: 'rgba(148, 163, 184, 0.24)', waterFill: '#071224',
      riverLine: 'rgba(14, 165, 233, 0.4)', gridLine: 'rgba(56, 189, 248, 0.12)', cityCol: '#38bdf8', capCol: '#facc15',
      raster: { tiles: () => [tileUrl('dark')], tileSize: 256, maxzoom: 18, attribution: '© OSM · © CARTO' },
      sky: { 'sky-color': '#090f24', 'sky-horizon-blend': 0.5, 'horizon-color': '#1d4ed8', 'horizon-fog-blend': 0.5, 'fog-color': '#050814', 'fog-ground-blend': 0.25 }
    },
    streets: {
      bg: '#aad3df', landPalette: Array(7).fill('#f2efe9'),
      landOutline: 'rgba(15, 23, 42, 0.35)', stateLine: 'rgba(51, 65, 85, 0.25)', waterFill: 'rgba(170, 211, 223, 0.2)',
      riverLine: 'rgba(56, 152, 200, 0.35)', gridLine: 'rgba(15, 23, 42, 0.12)', cityCol: '#2563eb', capCol: '#e11d48',
      raster: { tiles: () => [tileUrl('streets')], tileSize: 256, maxzoom: 18, attribution: '© OpenStreetMap contributors' },
      sky: { 'sky-color': '#38bdf8', 'sky-horizon-blend': 0.4, 'horizon-color': '#bae6fd', 'horizon-fog-blend': 0.4, 'fog-color': '#e0f2fe', 'fog-ground-blend': 0.1 }
    },
    topo: {
      bg: '#b4d6e8', landPalette: Array(7).fill('#e2e7d5'),
      landOutline: 'rgba(30, 41, 59, 0.45)', stateLine: 'rgba(30, 41, 59, 0.28)', waterFill: 'rgba(120, 180, 220, 0.2)',
      riverLine: 'rgba(14, 165, 233, 0.4)', gridLine: 'rgba(15, 23, 42, 0.14)', cityCol: '#0369a1', capCol: '#dc2626',
      raster: { tiles: () => [tileUrl('topo')], tileSize: 256, maxzoom: 16, attribution: '© OpenTopoMap CC-BY-SA' },
      sky: { 'sky-color': '#38bdf8', 'sky-horizon-blend': 0.45, 'horizon-color': '#bae6fd', 'horizon-fog-blend': 0.4, 'fog-color': '#e0f2fe', 'fog-ground-blend': 0.1 }
    }
  };

  /* ---------- GeoJSON Builders for OSINT Layers ---------- */
  function buildAirGeoJSON(list, kind) {
    const pts = [], vecs = [];
    for (let i = 0; i < list.length; i++) {
      const a = list[i];
      if (!Number.isFinite(a.lon) || !Number.isFinite(a.lat)) continue;
      pts.push({
        type: 'Feature',
        properties: { idx: i, kind, id: a.id, call: a.call, hdg: a.hdg || 0, altM: a.altM || 0, spdMs: a.spdMs || 0 },
        geometry: { type: 'Point', coordinates: [a.lon, a.lat] }
      });
      if (Number.isFinite(a.hdg) && (a.spdMs || 0) > 25) {
        const ahead = destPoint(a.lon, a.lat, a.hdg, Math.min(95, Math.max(18, (a.spdMs || 180) * 0.28)));
        if (Math.abs(ahead[0] - a.lon) < 120) {
          vecs.push({ type: 'Feature', properties: { kind }, geometry: { type: 'LineString', coordinates: [[a.lon, a.lat], ahead] } });
        }
      }
    }
    return { pts: { type: 'FeatureCollection', features: pts }, vecs: { type: 'FeatureCollection', features: vecs } };
  }

  function buildQuakesGeoJSON() {
    return {
      type: 'FeatureCollection',
      features: S.osint.quakes.map((q, idx) => ({
        type: 'Feature',
        properties: { idx, mag: q.mag, place: q.place, depthKm: q.depthKm, tsunami: q.tsunami ? 1 : 0 },
        geometry: { type: 'Point', coordinates: [q.lon, q.lat] }
      }))
    };
  }

  function buildEventsGeoJSON() {
    return {
      type: 'FeatureCollection',
      features: S.osint.events.map((ev, idx) => ({
        type: 'Feature',
        properties: { idx, title: ev.title, cat: ev.cat, catId: ev.catId },
        geometry: { type: 'Point', coordinates: [ev.lon, ev.lat] }
      }))
    };
  }

  function buildCamsGeoJSON() {
    return {
      type: 'FeatureCollection',
      features: S.osint.cams.map((c, idx) => ({
        type: 'Feature',
        properties: { idx, id: c.id, name: c.name, place: c.place, cat: c.cat },
        geometry: { type: 'Point', coordinates: [c.lon, c.lat] }
      }))
    };
  }

  function buildSatsGeoJSON() {
    const now = Date.now();
    const live = [];
    const features = [];
    let selectedGP = null;
    for (let i = 0; i < S.osint.satsGP.length; i++) {
      const s = S.osint.satsGP[i];
      const pos = propagateGP(s, now);
      if (!Number.isFinite(pos.lon) || !Number.isFinite(pos.lat)) continue;
      const isISS = s.norad === 25544;
      const rec = {
        norad: s.norad, name: s.name, cat: s.cat, isISS,
        lon: isISS && S.osint.issLive ? S.osint.issLive.lon : pos.lon,
        lat: isISS && S.osint.issLive ? S.osint.issLive.lat : pos.lat,
        altKm: isISS && S.osint.issLive ? S.osint.issLive.altKm : pos.altKm,
        velKmh: isISS && S.osint.issLive ? S.osint.issLive.velKmh : pos.velKmh,
        inc: s.inc, mm: s.mm, _gp: s
      };
      live.push(rec);
      if (s.norad === S.osint.selectedSatNorad) selectedGP = s;
      features.push({
        type: 'Feature',
        properties: { idx: live.length - 1, norad: rec.norad, name: rec.name, isISS: isISS ? 1 : 0, altKm: rec.altKm },
        geometry: { type: 'Point', coordinates: [rec.lon, rec.lat] }
      });
    }
    // If CelesTrak failed but WhereTheISS succeeded, still render ISS!
    if (!live.length && S.osint.issLive) {
      const i = S.osint.issLive;
      const rec = { norad: 25544, name: i.name, cat: 'station', isISS: true, lon: i.lon, lat: i.lat, altKm: i.altKm, velKmh: i.velKmh, inc: 51.64, mm: 15.5 };
      live.push(rec);
      features.push({
        type: 'Feature',
        properties: { idx: 0, norad: 25544, name: rec.name, isISS: 1, altKm: rec.altKm },
        geometry: { type: 'Point', coordinates: [rec.lon, rec.lat] }
      });
    }
    S.osint.satsLive = live;
    const orbitFeatures = selectedGP ? buildSatOrbitFeatures(selectedGP, now) : [];
    return {
      pts: { type: 'FeatureCollection', features },
      orbit: { type: 'FeatureCollection', features: orbitFeatures }
    };
  }

  function buildScanGeoJSON() {
    if (!S.scanCenter) return emptyFC;
    const { lon, lat } = S.scanCenter;
    const feats = [];
    for (const ring of geodesicRing(lon, lat, 250, 72)) {
      feats.push({ type: 'Feature', properties: { r: 250 }, geometry: { type: 'LineString', coordinates: ring } });
    }
    for (const ring of geodesicRing(lon, lat, 125, 48)) {
      feats.push({ type: 'Feature', properties: { r: 125 }, geometry: { type: 'LineString', coordinates: ring } });
    }
    feats.push({ type: 'Feature', properties: { r: 0 }, geometry: { type: 'Point', coordinates: [lon, lat] } });
    return { type: 'FeatureCollection', features: feats };
  }

  function pinsGeoJSON() {
    return {
      type: 'FeatureCollection',
      features: S.pins.map((p, idx) => ({
        type: 'Feature',
        properties: { idx, name: p.name, lat: p.lat, lon: p.lon },
        geometry: { type: 'Point', coordinates: [p.lon, p.lat] }
      }))
    };
  }

  function bboxPolygon(bbox, props) {
    if (!bbox) return null;
    const { south: s, north: n, west: w, east: e } = bbox;
    return {
      type: 'Feature',
      properties: props || {},
      geometry: { type: 'Polygon', coordinates: [[[w, s], [e, s], [e, n], [w, n], [w, s]]] }
    };
  }
  function buildSavedPacksGeoJSON() {
    if (!S.packShowBoxes || !S.packs.length) return emptyFC;
    return {
      type: 'FeatureCollection',
      features: S.packs.map(p => bboxPolygon(p.bbox, { id: p.id, name: p.name, style: p.style })).filter(Boolean)
    };
  }
  function buildPackPreviewGeoJSON() {
    if (!S.packDraft || !S.packDraft.bbox) return emptyFC;
    return { type: 'FeatureCollection', features: [bboxPolygon(S.packDraft.bbox, { name: S.packDraft.name || 'Selection' })] };
  }

  function buildMapStyle(themeKey) {
    const t = THEMES[themeKey] || THEMES.midnight;
    const isRaster = !!t.raster;
    const sources = {
      countries: { type: 'geojson', data: DATA_CACHE.countries || emptyFC, tolerance: 0.35, buffer: 64 },
      states: { type: 'geojson', data: DATA_CACHE.states || emptyFC, tolerance: 0.45, buffer: 32 },
      lakes: { type: 'geojson', data: DATA_CACHE.lakes || emptyFC, tolerance: 0.4, buffer: 32 },
      rivers: { type: 'geojson', data: DATA_CACHE.rivers || emptyFC, tolerance: 0.45, buffer: 32 },
      cities: { type: 'geojson', data: DATA_CACHE.cities || emptyFC, tolerance: 0.25 },
      cables: { type: 'geojson', data: DATA_CACHE.cables || emptyFC },
      graticule: { type: 'geojson', data: buildGraticuleGeoJSON() },
      terminator: { type: 'geojson', data: buildTerminatorGeoJSON() },
      measure: { type: 'geojson', data: emptyFC },
      pins: { type: 'geojson', data: pinsGeoJSON() },
      scan: { type: 'geojson', data: buildScanGeoJSON() },
      'packs-saved': { type: 'geojson', data: buildSavedPacksGeoJSON() },
      'pack-preview': { type: 'geojson', data: buildPackPreviewGeoJSON() },
      'osint-flights': { type: 'geojson', data: emptyFC },
      'osint-flights-vec': { type: 'geojson', data: emptyFC },
      'osint-mil': { type: 'geojson', data: emptyFC },
      'osint-mil-vec': { type: 'geojson', data: emptyFC },
      'osint-sats': { type: 'geojson', data: emptyFC },
      'osint-orbit': { type: 'geojson', data: emptyFC },
      'osint-quakes': { type: 'geojson', data: emptyFC },
      'osint-events': { type: 'geojson', data: emptyFC },
      'osint-cams': { type: 'geojson', data: emptyFC }
    };
    if (isRaster) {
      sources.baseraster = { type: 'raster', tiles: t.raster.tiles(), tileSize: t.raster.tileSize, maxzoom: t.raster.maxzoom, attribution: t.raster.attribution };
      if (t.raster.overlayTiles) {
        sources.labelraster = { type: 'raster', tiles: t.raster.overlayTiles(), tileSize: t.raster.tileSize, maxzoom: t.raster.maxzoom };
      }
    }
    if (S.layers.weather && S.osint.radarPath) {
      sources.weatherradar = {
        type: 'raster',
        tiles: [location.origin + '/api/globe/tile?s=radar&p=' + encodeURIComponent(S.osint.radarPath) + '&z={z}&x={x}&y={y}'],
        tileSize: 256, maxzoom: 12, attribution: 'RainViewer'
      };
    }

    const colorExpr = [
      'match', ['to-number', ['coalesce', ['get', 'MAPCOLOR7'], 1]],
      1, t.landPalette[0], 2, t.landPalette[1], 3, t.landPalette[2],
      4, t.landPalette[3], 5, t.landPalette[4], 6, t.landPalette[5],
      t.landPalette[6]
    ];

    const layers = [{ id: 'bg', type: 'background', paint: { 'background-color': t.bg } }];
    if (isRaster) {
      layers.push({ id: 'baseraster-layer', type: 'raster', source: 'baseraster', paint: { 'raster-fade-duration': 0 } });
      if (t.raster.overlayTiles) {
        layers.push({ id: 'labelraster-layer', type: 'raster', source: 'labelraster', paint: { 'raster-fade-duration': 0 } });
      }
    }
    if (sources.weatherradar) {
      layers.push({ id: 'weatherradar-layer', type: 'raster', source: 'weatherradar', paint: { 'raster-opacity': 0.62, 'raster-fade-duration': 0 } });
    }

    layers.push(
      {
        id: 'countries-fill', type: 'fill', source: 'countries',
        paint: {
          'fill-color': ['case', ['boolean', ['feature-state', 'hover'], false], '#38bdf8', colorExpr],
          'fill-opacity': isRaster ? ['case', ['boolean', ['feature-state', 'hover'], false], 0.22, 0.01] : ['case', ['boolean', ['feature-state', 'hover'], false], 0.45, 0.96]
        }
      },
      {
        id: 'lakes-fill', type: 'fill', source: 'lakes',
        layout: { visibility: S.layers.water && !isRaster ? 'visible' : 'none' },
        paint: { 'fill-color': t.waterFill, 'fill-opacity': 0.95 }
      },
      {
        id: 'rivers-line', type: 'line', source: 'rivers',
        layout: { visibility: S.layers.water && !isRaster ? 'visible' : 'none' },
        paint: { 'line-color': t.riverLine, 'line-width': ['interpolate', ['linear'], ['zoom'], 1, 0.5, 6, 1.8], 'line-opacity': 0.72 }
      },
      {
        id: 'graticule-line', type: 'line', source: 'graticule',
        layout: { visibility: S.layers.grid ? 'visible' : 'none' },
        paint: { 'line-color': t.gridLine, 'line-width': ['case', ['==', ['get', 'major'], 1], 1.2, 0.6] }
      },
      {
        id: 'states-line', type: 'line', source: 'states',
        layout: { visibility: S.layers.states ? 'visible' : 'none' },
        minzoom: 2.2,
        paint: { 'line-color': t.stateLine, 'line-width': ['interpolate', ['linear'], ['zoom'], 2.2, 0.4, 7, 1.2] }
      },
      {
        id: 'countries-outline', type: 'line', source: 'countries',
        paint: {
          'line-color': ['case', ['boolean', ['feature-state', 'hover'], false], '#facc15', t.landOutline],
          'line-width': ['interpolate', ['linear'], ['zoom'], 1, ['case', ['boolean', ['feature-state', 'hover'], false], 2.0, 0.65], 5, ['case', ['boolean', ['feature-state', 'hover'], false], 2.4, 1.35]],
          'line-opacity': isRaster ? 0.65 : 0.78
        }
      },
      {
        id: 'cables-line', type: 'line', source: 'cables',
        layout: { visibility: S.layers.cables ? 'visible' : 'none' },
        paint: { 'line-color': '#22d3ee', 'line-width': ['interpolate', ['linear'], ['zoom'], 1, 1.3, 5, 2.4], 'line-opacity': 0.78 }
      },
      {
        id: 'terminator-fill', type: 'fill', source: 'terminator',
        layout: { visibility: S.layers.night ? 'visible' : 'none' },
        paint: { 'fill-color': '#020617', 'fill-opacity': 0.46 }
      },
      {
        id: 'cities-glow', type: 'circle', source: 'cities',
        layout: { visibility: S.layers.cities ? 'visible' : 'none' },
        paint: {
          'circle-radius': ['interpolate', ['linear'], ['zoom'], 1, ['case', ['==', ['get', 'adm0cap'], 1], 4.2, 2.2], 6, ['case', ['==', ['get', 'adm0cap'], 1], 9.5, 6.0]],
          'circle-color': ['case', ['==', ['get', 'adm0cap'], 1], t.capCol, t.cityCol],
          'circle-opacity': 0.25, 'circle-blur': 0.7
        }
      },
      {
        id: 'cities-dots', type: 'circle', source: 'cities',
        layout: { visibility: S.layers.cities ? 'visible' : 'none' },
        paint: {
          'circle-radius': ['interpolate', ['linear'], ['zoom'], 1, ['case', ['==', ['get', 'adm0cap'], 1], 2.4, 1.3], 6, ['case', ['==', ['get', 'adm0cap'], 1], 5.2, 3.6]],
          'circle-color': ['case', ['==', ['get', 'adm0cap'], 1], t.capCol, t.cityCol],
          'circle-stroke-color': '#020617', 'circle-stroke-width': 0.8
        }
      },
      /* ---- GodMode OSINT GPU Layers ---- */
      {
        id: 'scan-ring', type: 'line', source: 'scan',
        paint: {
          'line-color': ['case', ['==', ['get', 'r'], 250], '#34d399', 'rgba(52,211,153,0.45)'],
          'line-width': ['case', ['==', ['get', 'r'], 250], 2.2, 1.2],
          'line-dasharray': [3, 2]
        }
      },
      {
        id: 'osint-orbit-line', type: 'line', source: 'osint-orbit',
        layout: { visibility: S.layers.satellites ? 'visible' : 'none' },
        paint: {
          'line-color': ['case', ['==', ['get', 'kind'], 'footprint'], '#38bdf8', '#a855f7'],
          'line-width': ['case', ['==', ['get', 'kind'], 'footprint'], 1.4, 2.1],
          'line-opacity': ['case', ['==', ['get', 'kind'], 'footprint'], 0.55, 0.85],
          'line-dasharray': [2, 1.5]
        }
      },
      {
        id: 'osint-flights-vec-layer', type: 'line', source: 'osint-flights-vec',
        layout: { visibility: S.layers.flights ? 'visible' : 'none' },
        paint: { 'line-color': '#38bdf8', 'line-width': 1.2, 'line-opacity': 0.6 }
      },
      {
        id: 'osint-flights-dots', type: 'circle', source: 'osint-flights',
        layout: { visibility: S.layers.flights ? 'visible' : 'none' },
        paint: {
          'circle-radius': ['interpolate', ['linear'], ['zoom'], 1, 2.3, 6, 4.8],
          'circle-color': '#38bdf8', 'circle-stroke-color': '#020617', 'circle-stroke-width': 0.8
        }
      },
      {
        id: 'osint-mil-vec-layer', type: 'line', source: 'osint-mil-vec',
        layout: { visibility: S.layers.military ? 'visible' : 'none' },
        paint: { 'line-color': '#f59e0b', 'line-width': 1.8, 'line-opacity': 0.82 }
      },
      {
        id: 'osint-mil-glow', type: 'circle', source: 'osint-mil',
        layout: { visibility: S.layers.military ? 'visible' : 'none' },
        paint: { 'circle-radius': ['interpolate', ['linear'], ['zoom'], 1, 6, 6, 11], 'circle-color': '#f59e0b', 'circle-opacity': 0.28, 'circle-blur': 0.65 }
      },
      {
        id: 'osint-mil-dots', type: 'circle', source: 'osint-mil',
        layout: { visibility: S.layers.military ? 'visible' : 'none' },
        paint: {
          'circle-radius': ['interpolate', ['linear'], ['zoom'], 1, 3.2, 6, 5.8],
          'circle-color': '#fbbf24', 'circle-stroke-color': '#451a03', 'circle-stroke-width': 1.1
        }
      },
      {
        id: 'osint-quakes-glow', type: 'circle', source: 'osint-quakes',
        layout: { visibility: S.layers.quakes ? 'visible' : 'none' },
        paint: {
          'circle-radius': ['interpolate', ['linear'], ['get', 'mag'], 2.5, 6, 5, 14, 7.5, 28],
          'circle-color': '#ef4444', 'circle-opacity': 0.28, 'circle-blur': 0.5
        }
      },
      {
        id: 'osint-quakes-dots', type: 'circle', source: 'osint-quakes',
        layout: { visibility: S.layers.quakes ? 'visible' : 'none' },
        paint: {
          'circle-radius': ['interpolate', ['linear'], ['get', 'mag'], 2.5, 3, 5, 6.5, 7.5, 11],
          'circle-color': ['interpolate', ['linear'], ['get', 'mag'], 2.5, '#fb923c', 4.5, '#f97316', 6.0, '#ef4444'],
          'circle-stroke-color': '#fff', 'circle-stroke-width': 1
        }
      },
      {
        id: 'osint-events-dots', type: 'circle', source: 'osint-events',
        layout: { visibility: S.layers.events ? 'visible' : 'none' },
        paint: {
          'circle-radius': ['interpolate', ['linear'], ['zoom'], 1, 4.5, 6, 7.5],
          'circle-color': '#fb7185', 'circle-stroke-color': '#fef08a', 'circle-stroke-width': 1.4
        }
      },
      {
        id: 'osint-cams-dots', type: 'circle', source: 'osint-cams',
        layout: { visibility: S.layers.cams ? 'visible' : 'none' },
        paint: {
          'circle-radius': ['interpolate', ['linear'], ['zoom'], 1, 4.2, 6, 7.2],
          'circle-color': '#10b981', 'circle-stroke-color': '#ecfdf5', 'circle-stroke-width': 1.5
        }
      },
      {
        id: 'osint-sats-glow', type: 'circle', source: 'osint-sats',
        layout: { visibility: S.layers.satellites ? 'visible' : 'none' },
        paint: {
          'circle-radius': ['case', ['==', ['get', 'isISS'], 1], 14, 7],
          'circle-color': ['case', ['==', ['get', 'isISS'], 1], '#facc15', '#c084fc'],
          'circle-opacity': 0.35, 'circle-blur': 0.65
        }
      },
      {
        id: 'osint-sats-dots', type: 'circle', source: 'osint-sats',
        layout: { visibility: S.layers.satellites ? 'visible' : 'none' },
        paint: {
          'circle-radius': ['case', ['==', ['get', 'isISS'], 1], 6.5, 3.6],
          'circle-color': ['case', ['==', ['get', 'isISS'], 1], '#fde047', '#d8b4fe'],
          'circle-stroke-color': '#020617', 'circle-stroke-width': 1.2
        }
      },
      {
        id: 'measure-line', type: 'line', source: 'measure',
        paint: { 'line-color': '#facc15', 'line-width': 3, 'line-dasharray': [2, 1.2] }
      },
      {
        id: 'measure-pts', type: 'circle', source: 'measure',
        filter: ['==', ['geometry-type'], 'Point'],
        paint: { 'circle-radius': 6, 'circle-color': '#facc15', 'circle-stroke-color': '#0f172a', 'circle-stroke-width': 2 }
      },
      {
        id: 'packs-saved-fill', type: 'fill', source: 'packs-saved',
        paint: { 'fill-color': '#10b981', 'fill-opacity': 0.08 }
      },
      {
        id: 'packs-saved-line', type: 'line', source: 'packs-saved',
        paint: { 'line-color': '#10b981', 'line-width': 1.8, 'line-opacity': 0.85 }
      },
      {
        id: 'pack-preview-fill', type: 'fill', source: 'pack-preview',
        paint: { 'fill-color': '#34d399', 'fill-opacity': 0.16 }
      },
      {
        id: 'pack-preview-line', type: 'line', source: 'pack-preview',
        paint: { 'line-color': '#34d399', 'line-width': 2.5, 'line-dasharray': [3, 2] }
      },
      {
        id: 'pins-dots', type: 'circle', source: 'pins',
        paint: { 'circle-radius': 7, 'circle-color': '#f43f5e', 'circle-stroke-color': '#ffffff', 'circle-stroke-width': 2 }
      }
    );

    return { version: 8, sources, layers };
  }

  /* ---------- Sync helpers ---------- */
  function syncPinsOnMap() {
    if (S.map && S.map.getSource('pins')) S.map.getSource('pins').setData(pinsGeoJSON());
  }
  function syncScanOnMap() {
    if (S.map && S.map.getSource('scan')) S.map.getSource('scan').setData(buildScanGeoJSON());
  }
  function syncPacksOnMap() {
    if (!S.map) return;
    if (S.map.getSource('packs-saved')) S.map.getSource('packs-saved').setData(buildSavedPacksGeoJSON());
    if (S.map.getSource('pack-preview')) S.map.getSource('pack-preview').setData(buildPackPreviewGeoJSON());
  }
  function syncOsintSources() {
    if (!S.map) return;
    const set = (id, data) => { const src = S.map.getSource(id); if (src) src.setData(data); };
    if (S.layers.flights) {
      const fl = buildAirGeoJSON(S.osint.flights, 'flight');
      set('osint-flights', fl.pts); set('osint-flights-vec', fl.vecs);
    }
    if (S.layers.military) {
      const ml = buildAirGeoJSON(S.osint.military, 'military');
      set('osint-mil', ml.pts); set('osint-mil-vec', ml.vecs);
    }
    if (S.layers.satellites) {
      const sa = buildSatsGeoJSON();
      set('osint-sats', sa.pts); set('osint-orbit', sa.orbit);
    }
    if (S.layers.quakes) set('osint-quakes', buildQuakesGeoJSON());
    if (S.layers.events) set('osint-events', buildEventsGeoJSON());
    if (S.layers.cams) set('osint-cams', buildCamsGeoJSON());
    updateChipCounts();
  }

  function updateChipCounts() {
    const mapCnt = {
      flights: S.osint.flights.length,
      military: S.osint.military.length,
      satellites: S.osint.satsLive.length,
      quakes: S.osint.quakes.length,
      events: S.osint.events.length,
      cams: S.osint.cams.length
    };
    for (const [k, n] of Object.entries(mapCnt)) {
      const b = root.querySelector('[data-ly="' + k + '"] .glb-cnt');
      if (b) { b.textContent = S.layers[k] && n ? String(n) : ''; b.style.display = (S.layers[k] && n) ? '' : 'none'; }
    }
  }

  function syncMeasureOnMap() {
    if (!S.map) return;
    const src = S.map.getSource('measure');
    if (!src) return;
    const feats = S.measurePts.map((pt, i) => ({ type: 'Feature', properties: { n: i + 1 }, geometry: { type: 'Point', coordinates: pt } }));
    if (S.measurePts.length === 2) {
      for (const seg of splitAntimeridian(greatCircleArc(S.measurePts[0], S.measurePts[1], 72))) {
        feats.push({ type: 'Feature', properties: {}, geometry: { type: 'LineString', coordinates: seg } });
      }
    }
    src.setData({ type: 'FeatureCollection', features: feats });
    const bar = root.querySelector('#glb-measure');
    if (!bar) return;
    if (!S.measureOn && !S.measurePts.length) { bar.classList.remove('on'); return; }
    bar.classList.add('on');
    const txt = root.querySelector('#glb-mtxt');
    if (S.measurePts.length === 0) txt.textContent = '📏 Click Point A anywhere on the globe…';
    else if (S.measurePts.length === 1) txt.textContent = '📏 Point A set (' + fmtCoord(S.measurePts[0][1], S.measurePts[0][0]) + ') — click Point B…';
    else {
      const km = haversineKm(S.measurePts[0], S.measurePts[1]);
      const mi = km * 0.621371, nm = km * 0.539957, hrs = km / 880;
      txt.innerHTML = '📏 <b>' + Math.round(km).toLocaleString() + ' km</b> · <b>' + Math.round(mi).toLocaleString() + ' mi</b> · ' + Math.round(nm).toLocaleString() + ' nm · ~' + (hrs < 1 ? Math.round(hrs * 60) + ' min' : hrs.toFixed(1) + ' h') + ' jet';
    }
  }

  function applyLayerVis() {
    if (!S.map) return;
    const isRaster = !!(THEMES[S.styleId] && THEMES[S.styleId].raster);
    const setV = (id, on) => { if (S.map.getLayer(id)) S.map.setLayoutProperty(id, 'visibility', on ? 'visible' : 'none'); };
    setV('states-line', S.layers.states);
    setV('lakes-fill', S.layers.water && !isRaster);
    setV('rivers-line', S.layers.water && !isRaster);
    setV('cities-glow', S.layers.cities);
    setV('cities-dots', S.layers.cities);
    setV('graticule-line', S.layers.grid);
    setV('terminator-fill', S.layers.night);
    setV('cables-line', S.layers.cables);
    setV('osint-flights-dots', S.layers.flights);
    setV('osint-flights-vec-layer', S.layers.flights);
    setV('osint-mil-dots', S.layers.military);
    setV('osint-mil-glow', S.layers.military);
    setV('osint-mil-vec-layer', S.layers.military);
    setV('osint-sats-dots', S.layers.satellites);
    setV('osint-sats-glow', S.layers.satellites);
    setV('osint-orbit-line', S.layers.satellites);
    setV('osint-quakes-dots', S.layers.quakes);
    setV('osint-quakes-glow', S.layers.quakes);
    setV('osint-events-dots', S.layers.events);
    setV('osint-cams-dots', S.layers.cams);
    if (S.layers.night && S.map.getSource('terminator')) {
      S.map.getSource('terminator').setData(buildTerminatorGeoJSON());
    }
    updateChipCounts();
  }

  function applyVisualFx(fx) {
    S.fx = fx || 'std';
    const mapEl = root.querySelector('#glb-map');
    const fxEl = root.querySelector('#glb-fx');
    const sel = root.querySelector('#glb-fx-sel');
    if (sel && sel.value !== S.fx) sel.value = S.fx;
    if (mapEl) mapEl.className = S.fx === 'std' ? '' : ('fx-' + S.fx);
    if (fxEl) fxEl.className = S.fx === 'std' ? 'glb-fx' : ('glb-fx on fx-' + S.fx);
  }

  function updateSubtitle() {
    const el = root.querySelector('#glb-sub');
    if (!el) return;
    const activeOsint = ['flights', 'military', 'satellites', 'quakes', 'events', 'weather', 'cams'].filter(k => S.layers[k]).length;
    const modeLbl = activeOsint ? ('GODMODE · ' + activeOsint + ' Live') : (S.styleId === 'midnight' || S.styleId === 'daylight' ? '100% Offline' : 'Cached Tiles');
    el.textContent = modeLbl + ' · ' + (S.proj === 'globe' ? '3D' : '2D') + ' · ' + S.liveFps + ' fps';
  }

  /* ---------- Live OSINT Feed Fetcher & Auto-Paused Polling ---------- */
  async function loadOsintFeed(kind, silent) {
    try {
      let qs = '/api/globe/feed?k=' + encodeURIComponent(kind);
      if (kind === 'flights' && S.map) {
        const c = S.map.getCenter();
        qs += '&lat=' + c.lat.toFixed(2) + '&lon=' + c.lng.toFixed(2);
        if (S.map.getZoom() >= 3.2) {
          const b = S.map.getBounds();
          qs += '&lamin=' + b.getSouth().toFixed(2) + '&lomin=' + b.getWest().toFixed(2) + '&lamax=' + b.getNorth().toFixed(2) + '&lomax=' + b.getEast().toFixed(2);
        }
      }
      const res = await fetch(qs);
      if (!res.ok) {
        if (!silent) A.toast('Restart Moundshroud once to activate live GodMode telemetry feeds!', 5500);
        return false;
      }
      const d = await res.json();
      if (!d || !d.ok) {
        if (!silent) A.toast('Feed ' + kind + ': ' + ((d && d.error) || 'temporarily unavailable'), 4000);
        return false;
      }
      if (kind === 'flights') S.osint.flights = d.items || [];
      else if (kind === 'military') S.osint.military = d.items || [];
      else if (kind === 'satellites') { S.osint.satsGP = d.gp || []; S.osint.issLive = d.iss || null; }
      else if (kind === 'quakes') S.osint.quakes = d.items || [];
      else if (kind === 'events') S.osint.events = d.items || [];
      else if (kind === 'cams') S.osint.cams = d.items || [];
      else if (kind === 'radar') {
        const changed = d.path && d.path !== S.osint.radarPath;
        S.osint.radarPath = d.path || '';
        S.osint.radarTime = d.time || 0;
        if (changed && S.map && S.layers.weather) {
          S.map.setStyle(buildMapStyle(S.styleId));
          return true;
        }
      }
      syncOsintSources();
      if (S.lock) updateLockedTarget();
      if (S.scanCenter) renderProximityRoster();
      return true;
    } catch (e) {
      if (!silent) A.toast('Could not reach live ' + kind + ' feed.', 3500);
      return false;
    }
  }

  function stopOsintTimers() {
    if (S.satTimer) { clearInterval(S.satTimer); S.satTimer = 0; }
    if (S.pollTimer) { clearInterval(S.pollTimer); S.pollTimer = 0; }
  }

  function ensureOsintTimers() {
    if (A.cur !== 'globe' || document.hidden) { stopOsintTimers(); return; }
    // Smooth 1.5s pure-JS satellite propagation tick (0 network cost!)
    if (S.layers.satellites && !S.satTimer) {
      S.satTimer = setInterval(() => {
        if (A.cur !== 'globe' || document.hidden || !S.layers.satellites || !S.map) { stopOsintTimers(); return; }
        const sa = buildSatsGeoJSON();
        if (S.map.getSource('osint-sats')) S.map.getSource('osint-sats').setData(sa.pts);
        if (S.map.getSource('osint-orbit')) S.map.getSource('osint-orbit').setData(sa.orbit);
        if (S.lock && S.lock.kind === 'sat') updateLockedTarget();
      }, 1500);
    } else if (!S.layers.satellites && S.satTimer) {
      clearInterval(S.satTimer); S.satTimer = 0;
    }
    // Live feed refresh every 25s ONLY for active online OSINT layers
    const needPoll = S.layers.flights || S.layers.military || S.layers.satellites || S.layers.quakes || S.layers.events || S.layers.weather;
    if (needPoll && !S.pollTimer) {
      S.pollTimer = setInterval(() => {
        if (A.cur !== 'globe' || document.hidden) { stopOsintTimers(); return; }
        if (S.layers.flights) loadOsintFeed('flights', true);
        if (S.layers.military) loadOsintFeed('military', true);
        if (S.layers.satellites) loadOsintFeed('satellites', true);
        if (S.layers.quakes) loadOsintFeed('quakes', true);
        if (S.layers.events) loadOsintFeed('events', true);
        if (S.layers.weather) loadOsintFeed('radar', true);
      }, 25000);
    } else if (!needPoll && S.pollTimer) {
      clearInterval(S.pollTimer); S.pollTimer = 0;
    }
  }

  /* ---------- Target Follow / Cockpit Chase-Cam Lock ---------- */
  function setTargetLock(target) {
    S.lock = target;
    const bar = root.querySelector('#glb-lock');
    const txt = root.querySelector('#glb-lock-txt');
    if (!bar) return;
    if (!target) { bar.classList.remove('on'); return; }
    S.spin = false; stopLoop();
    const spinBtn = root.querySelector('#glb-spin');
    if (spinBtn) spinBtn.classList.remove('on');
    bar.classList.add('on');
    if (txt) txt.textContent = '🎯 LOCKED: ' + target.name;
    updateLockedTarget(true);
  }

  function updateLockedTarget(initial) {
    if (!S.lock || !S.map) return;
    let obj = null, lon = NaN, lat = NaN, bearing = S.map.getBearing(), meta = '';
    if (S.lock.kind === 'flight') {
      obj = S.osint.flights.find(x => x.id === S.lock.id);
      if (obj) { lon = obj.lon; lat = obj.lat; bearing = obj.hdg || 0; meta = Math.round((obj.altM || 0) * 3.28084).toLocaleString() + ' ft · ' + Math.round((obj.spdMs || 0) * 1.94384) + ' kt · HDG ' + (obj.hdg || 0) + '°'; }
    } else if (S.lock.kind === 'military') {
      obj = S.osint.military.find(x => x.id === S.lock.id);
      if (obj) { lon = obj.lon; lat = obj.lat; bearing = obj.hdg || 0; meta = (obj.altFt || 0).toLocaleString() + ' ft · ' + (obj.spdKt || 0) + ' kt · SQK ' + (obj.squawk || '—'); }
    } else if (S.lock.kind === 'sat') {
      obj = S.osint.satsLive.find(x => x.norad === S.lock.id);
      if (obj) { lon = obj.lon; lat = obj.lat; bearing = 0; meta = 'ALT ' + obj.altKm + ' km · ' + obj.velKmh.toLocaleString() + ' km/h'; }
    }
    if (!obj || !Number.isFinite(lon) || !Number.isFinite(lat)) return;
    const txt = root.querySelector('#glb-lock-txt');
    if (txt) txt.textContent = '🎯 LOCKED: ' + S.lock.name + ' · ' + meta;
    S.map.easeTo({
      center: [lon, lat],
      zoom: initial ? (S.lock.kind === 'sat' ? 3.2 : 6.8) : Math.max(S.map.getZoom(), S.lock.kind === 'sat' ? 2.8 : 5.2),
      pitch: S.lock.kind === 'sat' ? 28 : 52,
      bearing: S.lock.kind === 'sat' ? 0 : bearing,
      duration: initial ? 950 : 1200,
      essential: true
    });
  }

  /* ---------- 250 km Proximity Contact Roster ---------- */
  function scanArea250(lon, lat, label) {
    S.scanCenter = { lon, lat, name: label || fmtCoord(lat, lon) };
    syncScanOnMap();
    if (S.map) S.map.flyTo({ center: [lon, lat], zoom: Math.max(S.map.getZoom(), 6.1), speed: 1.4, essential: true });
    // Auto-enable Webcams + Quakes + Military if zero OSINT layers are active so scan always shines!
    const anyLive = S.layers.flights || S.layers.military || S.layers.satellites || S.layers.quakes || S.layers.events || S.layers.cams;
    if (!anyLive) {
      toggleLayer('cams', true);
      toggleLayer('military', true);
      toggleLayer('quakes', true);
    }
    openInspector({ kind: 'scan', name: '250 km Radar Scan', sub: S.scanCenter.name, lat, lon });
    renderProximityRoster();
  }

  function renderProximityRoster() {
    const box = root.querySelector('#glb-roster');
    const listEl = root.querySelector('#glb-rlist');
    if (!box || !listEl) return;
    if (!S.scanCenter) { box.classList.remove('on'); return; }
    box.classList.add('on');
    const c = [S.scanCenter.lon, S.scanCenter.lat];
    const hits = [];
    const pushIf = (arr, kind, icon, nameFn, subFn, maxDist) => {
      for (const it of arr) {
        if (!Number.isFinite(it.lon) || !Number.isFinite(it.lat)) continue;
        const d = haversineKm(c, [it.lon, it.lat]);
        if (d <= (maxDist || 250)) hits.push({ kind, icon, name: nameFn(it), sub: subFn(it), dist: Math.round(d), item: it });
      }
    };
    if (S.layers.military) pushIf(S.osint.military, 'military', '🪖', x => x.call, x => (x.type || 'MIL') + ' · ' + (x.altFt || 0) + 'ft', 250);
    if (S.layers.flights) pushIf(S.osint.flights, 'flight', '✈️', x => x.call, x => Math.round((x.altM || 0) * 3.28) + 'ft', 250);
    if (S.layers.satellites) pushIf(S.osint.satsLive, 'sat', '🛰️', x => x.name, x => 'ALT ' + x.altKm + ' km', 900);
    if (S.layers.quakes) pushIf(S.osint.quakes, 'quake', '🌋', x => 'M' + x.mag.toFixed(1) + ' ' + x.place, x => fmtAge(x.time), 250);
    if (S.layers.events) pushIf(S.osint.events, 'event', '🔥', x => x.title, x => x.cat, 250);
    if (S.layers.cams) pushIf(S.osint.cams, 'cam', '📹', x => x.place, x => x.cat, 250);
    hits.sort((a, b) => a.dist - b.dist);
    listEl._hits = hits.slice(0, 35);
    if (!listEl._hits.length) {
      listEl.innerHTML = '<div class="small mute">No active contacts inside 250 km yet. Toggle ✈️ Flights, 🪖 Military, 📹 Webcams, or 🌋 Quakes below to populate radar contacts.</div>';
      return;
    }
    listEl.innerHTML = listEl._hits.map((h, i) =>
      '<div class="glb-rrow" data-ri="' + i + '">' +
        '<span>' + h.icon + '</span>' +
        '<span style="flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap"><b>' + esc(h.name) + '</b> <span style="color:#94a3b8">' + esc(h.sub) + '</span></span>' +
        '<small>' + h.dist + ' km</small>' +
      '</div>'
    ).join('');
  }

  /* ---------- Zero-idle GPU spin & FPS loop ---------- */
  function stopLoop() {
    if (S.raf) { cancelAnimationFrame(S.raf); S.raf = 0; }
  }
  function ensureLoop() {
    if (S.raf || !S.map || A.cur !== 'globe' || document.hidden || !S.spin) return;
    S.lastSpinTs = performance.now();
    S.fpsLast = S.lastSpinTs;
    S.fpsFrames = 0;
    const tick = now => {
      if (!S.map || A.cur !== 'globe' || document.hidden || !S.spin) { S.raf = 0; return; }
      const dt = Math.min(50, Math.max(0, now - S.lastSpinTs));
      S.lastSpinTs = now;
      if (S.map.getZoom() < 4.5 && !S.map.isMoving() && !S.lock) {
        const c = S.map.getCenter();
        c.lng -= dt * 0.0045;
        S.map.jumpTo({ center: c });
      }
      S.fpsFrames++;
      if (now - S.fpsLast >= 1000) {
        S.liveFps = Math.round((S.fpsFrames * 1000) / (now - S.fpsLast));
        S.fpsFrames = 0; S.fpsLast = now;
        updateSubtitle();
      }
      S.raf = requestAnimationFrame(tick);
    };
    S.raf = requestAnimationFrame(tick);
  }

  /* ---------- Storage Guard Status ---------- */
  async function refreshCacheStatus() {
    try {
      const r = await fetch('/api/globe/status');
      if (!r.ok) return;
      const d = await r.json();
      if (d && d.ok) {
        S.cacheInfo = { bytes: d.cacheBytes || 0, files: d.cacheFiles || 0, maxBytes: d.maxCacheBytes || 150 * 1024 * 1024 };
        const el = root.querySelector('#glb-cache-txt');
        if (el) {
          const mb = (S.cacheInfo.bytes / 1048576).toFixed(1);
          const maxMb = Math.round(S.cacheInfo.maxBytes / 1048576);
          el.textContent = '💾 Tile cache: ' + mb + ' / ' + maxMb + ' MB (' + S.cacheInfo.files + ' tiles) · Live OSINT: 0 MB';
        }
      }
    } catch (e) { }
  }

  /* ---------- Offline Region Packs Manager (download specific towns, counties, states, countries) ---------- */
  function stopPackPoll() {
    if (S.packPoll) { clearInterval(S.packPoll); S.packPoll = 0; }
  }

  function openPacksDrawer(prefillPlace) {
    openInspector(null);
    const dr = root.querySelector('#glb-packs');
    const btn = root.querySelector('#glb-packs-btn');
    if (dr) dr.classList.add('on');
    if (btn) btn.classList.add('on');
    refreshPacks();
    if (prefillPlace && prefillPlace.bbox) {
      selectPackRegion(prefillPlace.name, prefillPlace.bbox);
    } else if (prefillPlace && prefillPlace.name) {
      const qEl = root.querySelector('#glb-pk-q');
      if (qEl) qEl.value = prefillPlace.name;
      searchPackPlace(prefillPlace.name, true);
    } else if (!S.packDraft && S.map) {
      selectPackFromViewport();
    }
  }

  function closePacksDrawer() {
    const dr = root.querySelector('#glb-packs');
    const btn = root.querySelector('#glb-packs-btn');
    if (dr) dr.classList.remove('on');
    if (btn) btn.classList.remove('on');
    S.packDraft = null;
    syncPacksOnMap();
  }

  function fitBboxOnMap(bbox) {
    if (!S.map || !bbox) return;
    S.spin = false; stopLoop();
    const spinBtn = root.querySelector('#glb-spin');
    if (spinBtn) spinBtn.classList.remove('on');
    try {
      S.map.fitBounds([[bbox.west, bbox.south], [bbox.east, bbox.north]], { padding: { top: 90, bottom: 110, left: 60, right: 390 }, maxZoom: 13, duration: 900 });
    } catch (e) { }
  }

  function selectPackRegion(name, bbox) {
    const styleSel = root.querySelector('#glb-pk-style');
    const style = (styleSel && styleSel.value) || 'streets';
    S.packDraft = { name: String(name || 'Selected Area').slice(0, 80), bbox, style, maxZ: null };
    const lbl = root.querySelector('#glb-pk-selname');
    if (lbl) lbl.textContent = '📍 ' + S.packDraft.name;
    const hits = root.querySelector('#glb-pk-hits');
    if (hits) hits.classList.remove('on');
    syncPacksOnMap();
    fitBboxOnMap(bbox);
    estimatePackDraft();
  }

  function selectPackFromViewport() {
    if (!S.map) return;
    const b = S.map.getBounds();
    const bbox = {
      south: Math.max(-85, +b.getSouth().toFixed(4)),
      north: Math.min(85, +b.getNorth().toFixed(4)),
      west: Math.max(-180, +b.getWest().toFixed(4)),
      east: Math.min(180, +b.getEast().toFixed(4))
    };
    const c = S.map.getCenter();
    selectPackRegion('Map View (' + fmtCoord(c.lat, c.lng) + ')', bbox);
  }

  async function searchPackPlace(raw, autoPickFirst) {
    const q = String(raw || '').trim();
    const hits = root.querySelector('#glb-pk-hits');
    if (!q || q.length < 2) { if (hits) hits.classList.remove('on'); return; }
    if (hits) {
      hits.innerHTML = '<div class="glb-pk-hit"><span>⏳</span><span>Finding exact borders for “' + esc(q) + '”…</span></div>';
      hits.classList.add('on');
    }
    try {
      const r = await fetch('/api/globe/geocode?q=' + encodeURIComponent(q));
      if (!r.ok) throw new Error('Restart Moundshroud once to search towns, counties, states & countries.');
      const d = await r.json();
      const list = ((d && d.results) || []).filter(x => x.bbox);
      if (!list.length) {
        if (hits) hits.innerHTML = '<div class="glb-pk-hit"><span>🔎</span><span style="color:#94a3b8">No region boundaries found for “' + esc(q) + '”.</span></div>';
        return;
      }
      if (autoPickFirst) {
        const first = list[0];
        selectPackRegion(first.name + (first.sub ? ', ' + first.sub.split(',')[0].trim() : ''), first.bbox);
        return;
      }
      hits._list = list;
      hits.innerHTML = list.map((it, i) =>
        '<div class="glb-pk-hit" data-pkhi="' + i + '">' +
          '<span>📍</span>' +
          '<span style="flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap"><b>' + esc(it.name) + '</b> <span style="color:#94a3b8">' + esc(it.sub) + '</span></span>' +
          '<small>' + esc(it.type) + '</small>' +
        '</div>'
      ).join('');
      hits.classList.add('on');
    } catch (err) {
      if (hits) hits.innerHTML = '<div class="glb-pk-hit"><span>⚠️</span><span style="color:#fbbf24">' + esc(err.message || err) + '</span></div>';
    }
  }

  async function estimatePackDraft(overrideMaxZ) {
    if (!S.packDraft || !S.packDraft.bbox) return;
    const estEl = root.querySelector('#glb-pk-est');
    const dlBtn = root.querySelector('#glb-pk-dl');
    const zSlider = root.querySelector('#glb-pk-z');
    const zLbl = root.querySelector('#glb-pk-zlbl');
    const styleSel = root.querySelector('#glb-pk-style');
    S.packDraft.style = (styleSel && styleSel.value) || S.packDraft.style || 'streets';
    if (overrideMaxZ != null) S.packDraft.maxZ = overrideMaxZ;
    try {
      const r = await fetch('/api/globe/packs/estimate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ bbox: S.packDraft.bbox, style: S.packDraft.style, maxZ: S.packDraft.maxZ })
      });
      if (!r.ok) {
        if (estEl) { estEl.className = 'glb-pk-est warn'; estEl.textContent = '⚠️ Restart Moundshroud once to activate Offline Region downloads.'; }
        return;
      }
      const d = await r.json();
      S.packEst = d;
      if (!d || !d.ok) {
        if (estEl) { estEl.className = 'glb-pk-est warn'; estEl.textContent = '⚠️ ' + ((d && d.error) || 'Invalid selection'); }
        return;
      }
      S.packDraft.maxZ = d.maxZ;
      if (zSlider) { zSlider.min = String(d.minZ); zSlider.max = String(Math.min(16, Math.max(d.safeMaxZ + 1, d.maxZ))); zSlider.value = String(d.maxZ); }
      if (zLbl) zLbl.textContent = 'z' + d.minZ + ' → z' + d.maxZ + ' (safe max z' + d.safeMaxZ + ')';
      if (d.tooLarge) {
        estEl.className = 'glb-pk-est warn';
        estEl.innerHTML = '⚠️ <b>' + d.tiles.toLocaleString() + ' tiles (~' + d.estMB + ' MB)</b> exceeds the ' + d.maxPackTiles.toLocaleString() + '-tile safety cap.<br>Lower Max Zoom to <b>z' + d.safeMaxZ + '</b> or zoom in to a smaller area.';
        if (dlBtn) dlBtn.disabled = true;
      } else {
        estEl.className = 'glb-pk-est';
        estEl.innerHTML = '📦 <b>' + d.tiles.toLocaleString() + ' tiles · ~' + d.estMB + ' MB</b> · Zoom z' + d.minZ + '–z' + d.maxZ + '<br><span style="opacity:.82">Protected offline pack — never auto-deleted by tile cache cap.</span>';
        if (dlBtn) dlBtn.disabled = false;
      }
    } catch (e) { }
  }

  function renderPackProgress(job) {
    const wrap = root.querySelector('#glb-prog-wrap');
    const txt = root.querySelector('#glb-prog-txt');
    const fill = root.querySelector('#glb-prog-fill');
    const dlBtn = root.querySelector('#glb-pk-dl');
    if (!wrap) return;
    if (!job || job.status !== 'running') {
      wrap.classList.remove('on');
      if (dlBtn) dlBtn.disabled = !!(S.packEst && S.packEst.tooLarge);
      return;
    }
    wrap.classList.add('on');
    if (dlBtn) dlBtn.disabled = true;
    const pct = job.total ? Math.min(100, Math.round((job.done / job.total) * 100)) : 0;
    if (fill) fill.style.width = pct + '%';
    if (txt) txt.textContent = 'Downloading ' + job.name + ': ' + job.done.toLocaleString() + ' / ' + job.total.toLocaleString() + ' tiles (' + (job.bytes / 1048576).toFixed(1) + ' MB · ' + pct + '%)';
  }

  function renderPacksList() {
    const listEl = root.querySelector('#glb-pk-list');
    const sumEl = root.querySelector('#glb-pk-sum');
    if (!listEl) return;
    const totalMb = (S.packs.reduce((a, p) => a + (p.bytes || 0), 0) / 1048576).toFixed(1);
    if (sumEl) sumEl.textContent = S.packs.length + ' saved · ' + totalMb + ' MB';
    if (!S.packs.length) {
      listEl.innerHTML = '<div class="small mute">No offline regions downloaded yet. Search any town, county, state, or country above to save it for 100% offline use!</div>';
      return;
    }
    const styleNames = { hybrid: 'Satellite+Labels', satellite: 'Satellite', streets: 'Street Map', dark: 'Dark Streets', topo: 'Topographic' };
    listEl.innerHTML = S.packs.map((p, idx) =>
      '<div class="glb-pk-card">' +
        '<div class="glb-pk-top">' +
          '<b>🗺️ ' + esc(p.name) + '</b>' +
          '<button type="button" class="glb-btn on" data-pkfly="' + idx + '" style="padding:3px 7px;font-size:10.5px">🎯 Fly</button>' +
          '<button type="button" class="glb-btn" data-pkdel="' + esc(p.id) + '" style="padding:3px 6px;font-size:10.5px" title="Delete offline pack">🗑️</button>' +
        '</div>' +
        '<div class="glb-pk-meta">' +
          '<span>' + esc(styleNames[p.style] || p.style) + '</span>' +
          '<span>z' + p.minZ + '–z' + p.maxZ + '</span>' +
          '<span>' + (p.tiles || 0).toLocaleString() + ' tiles</span>' +
          '<span style="color:#34d399;font-weight:600">' + ((p.bytes || 0) / 1048576).toFixed(1) + ' MB</span>' +
        '</div>' +
      '</div>'
    ).join('');
  }

  async function refreshPacks() {
    try {
      const r = await fetch('/api/globe/packs');
      if (!r.ok) return;
      const d = await r.json();
      if (!d || !d.ok) return;
      const prevStatus = S.packJob && S.packJob.status;
      S.packs = d.packs || [];
      S.packJob = d.activeJob || null;
      renderPacksList();
      renderPackProgress(S.packJob);
      syncPacksOnMap();
      if (S.packJob && S.packJob.status === 'running') {
        if (!S.packPoll && A.cur === 'globe' && !document.hidden) {
          S.packPoll = setInterval(refreshPacks, 900);
        }
      } else {
        stopPackPoll();
        if (prevStatus === 'running' && S.packJob && S.packJob.status === 'done') {
          A.toast('Saved “' + S.packJob.name + '” offline (' + (S.packJob.bytes / 1048576).toFixed(1) + ' MB)!', 5000);
        } else if (prevStatus === 'running' && S.packJob && S.packJob.status === 'error') {
          A.toast('Offline download failed: ' + (S.packJob.error || 'network error'), 5000);
        }
      }
    } catch (e) { }
  }

  async function startPackDownload() {
    if (!S.packDraft || !S.packDraft.bbox) { A.toast('Search a place or click “Use Current Map View” first.'); return; }
    try {
      const r = await fetch('/api/globe/packs/download', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: S.packDraft.name,
          bbox: S.packDraft.bbox,
          style: S.packDraft.style,
          maxZ: S.packDraft.maxZ
        })
      });
      const d = r.ok ? await r.json() : null;
      if (!d || !d.ok) {
        A.toast((d && d.error) || 'Restart Moundshroud once to download offline regions.', 5500);
        return;
      }
      S.packJob = d.job;
      renderPackProgress(S.packJob);
      if (!S.packPoll) S.packPoll = setInterval(refreshPacks, 900);
    } catch (e) { A.toast('Could not start offline download.'); }
  }

  async function cancelPackDownload() {
    try {
      await fetch('/api/globe/packs/cancel', { method: 'POST' });
      stopPackPoll();
      S.packJob = null;
      renderPackProgress(null);
      A.toast('Offline region download cancelled (0 bytes kept).');
    } catch (e) { }
  }

  async function deleteSavedPack(id) {
    const pk = S.packs.find(p => p.id === id);
    const ok = await A.confirm('Delete offline region “' + (pk ? pk.name : id) + '” and free ' + (((pk && pk.bytes) || 0) / 1048576).toFixed(1) + ' MB of disk space?', { title: 'Delete Offline Region' });
    if (!ok) return;
    try {
      const r = await fetch('/api/globe/packs/delete', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id }) });
      const d = r.ok ? await r.json() : null;
      if (d && d.ok) {
        S.packs = d.packs || [];
        renderPacksList();
        syncPacksOnMap();
        A.toast('Deleted offline region and freed ' + ((d.freedBytes || 0) / 1048576).toFixed(1) + ' MB.');
      }
    } catch (e) { }
  }

  /* ---------- Geo & Tactical Telemetry Inspector Drawer ---------- */
  function openInspector(item) {
    S.selected = item;
    const insp = root.querySelector('#glb-insp');
    if (!insp) return;
    if (!item) {
      insp.classList.remove('on');
      const camBox = insp.querySelector('#glb-cambox');
      if (camBox) { camBox.classList.remove('on'); camBox.querySelector('iframe').src = 'about:blank'; }
      return;
    }
    insp.classList.add('on');
    const pkDr = root.querySelector('#glb-packs');
    if (pkDr && pkDr.classList.contains('on')) closePacksDrawer();

    const icons = { cap: '⭐', city: '🏙️', pin: '📍', flight: '✈️', military: '🪖', sat: '🛰️', quake: '🌋', event: '🔥', cam: '📹', cable: '🌐', scan: '📡' };
    insp.querySelector('#glb-iic').textContent = icons[item.kind] || '🌍';
    insp.querySelector('#glb-iname').textContent = item.name || 'Location';
    insp.querySelector('#glb-isub').textContent = item.sub || 'Global Coordinates';

    // Dynamic 4-box telemetry KV grid
    const kv = [
      ['Population', fmtPop(item.pop)],
      [item.gdp ? 'GDP (est.)' : 'Details', item.gdp ? ('$' + (item.gdp >= 1e6 ? (item.gdp / 1e6).toFixed(2) + 'T' : Math.round(item.gdp).toLocaleString() + 'M')) : (item.detail || item.iso || 'Location')],
      ['Coordinates', fmtCoord(item.lat, item.lon)],
      ['Local Solar Time', solarTimeAt(item.lon)]
    ];
    if (item.kind === 'flight' || item.kind === 'military') {
      const a = item.raw || {};
      const altFt = a.altFt != null ? a.altFt : Math.round((a.altM || 0) * 3.28084);
      const spdKt = a.spdKt != null ? a.spdKt : Math.round((a.spdMs || 0) * 1.94384);
      kv[0] = ['Altitude', altFt.toLocaleString() + ' ft (' + (a.altM || 0).toLocaleString() + ' m)'];
      kv[1] = ['Speed & Heading', spdKt + ' kt · ' + (a.hdg || 0) + '°'];
      kv[2] = ['Aircraft / Hex', [a.type, a.reg, a.id].filter(Boolean).join(' · ') || 'ADS-B'];
      kv[3] = ['Squawk / Origin', a.squawk ? ('SQK ' + a.squawk) : (a.country || a.desc || 'Airborne')];
    } else if (item.kind === 'sat') {
      const s = item.raw || {};
      kv[0] = ['NORAD ID', String(s.norad || '—')];
      kv[1] = ['Orbital Altitude', (s.altKm || 0).toLocaleString() + ' km'];
      kv[2] = ['Velocity', (s.velKmh || 0).toLocaleString() + ' km/h'];
      kv[3] = ['Inclination', (s.inc ? s.inc.toFixed(2) + '°' : '—') + ' · ' + (s.mm ? s.mm.toFixed(1) + ' rev/d' : '')];
    } else if (item.kind === 'quake') {
      const q = item.raw || {};
      kv[0] = ['Magnitude', 'M ' + (q.mag || 0).toFixed(1)];
      kv[1] = ['Depth', (q.depthKm || 0) + ' km'];
      kv[2] = ['Occurred', fmtAge(q.time)];
      kv[3] = ['Tsunami Alert', q.tsunami ? '⚠️ WATCH' : 'None'];
    } else if (item.kind === 'event') {
      const ev = item.raw || {};
      kv[0] = ['Category', ev.cat || 'Hazard'];
      kv[1] = ['Reported', ev.date ? ev.date.slice(0, 10) : 'Active'];
    } else if (item.kind === 'cam') {
      const c = item.raw || {};
      kv[0] = ['Channel', c.ch || 'Public Stream'];
      kv[1] = ['Category', (c.cat || 'live').toUpperCase()];
    } else if (item.kind === 'cable') {
      kv[0] = ['Operator / Capacity', item.sub || 'Transoceanic Fiber'];
      kv[1] = ['Mode', '100% Offline Backbone'];
    }

    const kvEl = insp.querySelector('#glb-kv');
    kvEl.innerHTML = kv.map(([l, v]) => '<div><span>' + esc(l) + '</span><b>' + esc(v) + '</b></div>').join('');

    // Lock / Cockpit Follow button (flights, military, satellites)
    const lockBtn = insp.querySelector('#glb-ilock');
    const canLock = item.kind === 'flight' || item.kind === 'military' || item.kind === 'sat';
    lockBtn.style.display = canLock ? '' : 'none';
    const isLockedHere = S.lock && S.lock.kind === item.kind && S.lock.id === item.lockId;
    lockBtn.textContent = isLockedHere ? '🔓 Unlock Chase-Cam' : (item.kind === 'sat' ? '🛰️ Lock Orbital Follow Cam' : '🎯 Lock Cockpit Chase-Cam');

    // Inline live webcam preview (for Webcams OR the ISS!)
    const camBox = insp.querySelector('#glb-cambox');
    const iframe = camBox.querySelector('iframe');
    const ytId = item.kind === 'cam' ? (item.raw && item.raw.id) : (item.kind === 'sat' && item.raw && item.raw.isISS ? ISS_LIVE_YT : '');
    if (ytId) {
      camBox.classList.add('on');
      insp.querySelector('#glb-camtitle').textContent = item.kind === 'sat' ? '🛰️ Live NASA ISS HD Earth Feed' : ('📹 Live: ' + item.name);
      const targetSrc = 'https://www.youtube-nocookie.com/embed/' + encodeURIComponent(ytId) + '?autoplay=1&mute=1&rel=0';
      if (iframe.src !== targetSrc) iframe.src = targetSrc;
    } else {
      camBox.classList.remove('on');
      if (iframe.src !== 'about:blank') iframe.src = 'about:blank';
    }

    renderProximityRoster();
    renderPinsInInspector();
    refreshCacheStatus();
  }

  function renderPinsInInspector() {
    const box = root.querySelector('#glb-pinlist');
    if (!box) return;
    if (!S.pins.length) {
      box.innerHTML = '<div class="small mute">No saved pins yet. Click “📍 Pin here” to save locations.</div>';
      return;
    }
    box.innerHTML = S.pins.map((p, idx) =>
      '<div class="glb-pinrow" data-pidx="' + idx + '">' +
        '<span>📍</span><span style="flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">' + esc(p.name) + '</span>' +
        '<button type="button" data-pdel="' + idx + '" title="Remove pin">✕</button>' +
      '</div>'
    ).join('');
  }

  function flyToPlace(p) {
    if (!S.map || !p) return;
    setTargetLock(null);
    S.spin = false;
    stopLoop();
    const spinBtn = root.querySelector('#glb-spin');
    if (spinBtn) spinBtn.classList.remove('on');
    const zoom = p.zoom || (p.kind === 'city' || p.kind === 'cap' || p.kind === 'pin' || p.kind === 'cam' ? 6.2 : 3.4);
    S.map.flyTo({ center: [p.lon, p.lat], zoom, speed: 1.45, curve: 1.25, essential: true });
    openInspector(p);
  }

  async function toggleLayer(k, forceState) {
    const next = typeof forceState === 'boolean' ? forceState : !S.layers[k];
    S.layers[k] = next;
    const btn = root.querySelector('[data-ly="' + k + '"]');
    if (btn) btn.classList.toggle('on', next);

    if (k === 'weather') {
      if (next) {
        const ok = await loadOsintFeed('radar', false);
        if (!ok) { S.layers.weather = false; if (btn) btn.classList.remove('on'); }
        else if (S.map) S.map.setStyle(buildMapStyle(S.styleId));
      } else if (S.map) {
        S.map.setStyle(buildMapStyle(S.styleId));
      }
    } else if (['flights', 'military', 'satellites', 'quakes', 'events', 'cams'].includes(k)) {
      if (next) await loadOsintFeed(k, false);
      applyLayerVis();
    } else {
      applyLayerVis();
    }
    ensureOsintTimers();
    updateSubtitle();
  }

  /* ---------- Built-in AI Globe Commander (instant NL commands + local Ollama AI fallback) ---------- */
  function findPlaceLocal(name) {
    const q = String(name || '').trim().toLowerCase();
    if (!q) return null;
    return S.searchIndex.find(x => x.n.toLowerCase() === q) || S.searchIndex.find(x => x._low.indexOf(q) !== -1) || null;
  }

  async function resolvePlace(name) {
    const loc = findPlaceLocal(name);
    if (loc) return { kind: loc.k, name: loc.n, sub: loc.sub, iso: loc.iso, pop: loc.pop, gdp: loc.gdp, lat: loc.lat, lon: loc.lon, zoom: loc.k === 'c' ? 3.8 : 6.4 };
    try {
      const r = await fetch('/api/globe/geocode?q=' + encodeURIComponent(name));
      if (r.ok) {
        const d = await r.json();
        if (d && d.results && d.results[0]) {
          const x = d.results[0];
          return { kind: 'geo', name: x.name, sub: x.sub, lat: x.lat, lon: x.lon, zoom: 10.5 };
        }
      }
    } catch (e) { }
    return null;
  }

  async function runAiCommand(raw) {
    const text = String(raw || '').trim();
    if (!text) return;
    const out = root.querySelector('#glb-cmd-out');
    const say = msg => { if (out) { out.textContent = msg; out.classList.add('on'); } };
    const low = text.toLowerCase();

    // 1. Visual sensor modes
    if (/\b(nvg|night vision)\b/.test(low)) { applyVisualFx('nvg'); return say('🟢 Tactical Night Vision (NVG) optics engaged.'); }
    if (/\b(flir|thermal|infrared)\b/.test(low)) { applyVisualFx('flir'); return say('🔥 FLIR Thermal imaging sensor engaged.'); }
    if (/\bcrt\b/.test(low)) { applyVisualFx('crt'); return say('📺 CRT Reconnaissance monitor filter engaged.'); }
    if (/\bnoir\b/.test(low)) { applyVisualFx('noir'); return say('🕶️ High-Contrast Noir optics engaged.'); }
    if (/\b(normal|standard|reset (filter|fx|optics|vision))\b/.test(low)) { applyVisualFx('std'); return say('👁️ Standard full-color optics restored.'); }

    // 2. Track ISS
    if (/\b(iss|space station)\b/.test(low)) {
      say('🛰️ Acquiring International Space Station orbital telemetry…');
      await toggleLayer('satellites', true);
      S.osint.selectedSatNorad = 25544;
      syncOsintSources();
      const iss = S.osint.satsLive.find(x => x.norad === 25544) || S.osint.satsLive[0];
      if (iss) {
        openInspector({ kind: 'sat', name: iss.name, sub: 'Low Earth Orbit · NASA Live Feed Available', lat: iss.lat, lon: iss.lon, lockId: iss.norad, raw: iss });
        setTargetLock({ kind: 'sat', id: iss.norad, name: iss.name });
        return say('🛰️ Locked onto ' + iss.name + ' at ' + fmtCoord(iss.lat, iss.lon) + ' · ALT ' + iss.altKm + ' km · ' + iss.velKmh.toLocaleString() + ' km/h. Live NASA HD Earth feed opened in Inspector!');
      }
      return say('⚠️ Could not acquire ISS position right now (check network or restart Moundshroud once).');
    }

    // 3. GodMode all-layers / stealth clear
    if (/\b(god\s*mode|godmode|all osint|all layers|full tactical)\b/.test(low)) {
      say('⚡ Engaging full GodMode OSINT suite (Flights, Military, Satellites, Quakes, Hazards, Webcams, Undersea Cables)…');
      await Promise.all(['flights', 'military', 'satellites', 'quakes', 'events', 'cams', 'cables'].map(k => toggleLayer(k, true)));
      return say('⚡ GodMode active: ' + S.osint.flights.length + ' flights, ' + S.osint.military.length + ' military, ' + S.osint.satsLive.length + ' satellites, ' + S.osint.quakes.length + ' quakes, ' + S.osint.cams.length + ' live webcams.');
    }
    if (/\b(clear layers|stealth|disable all|osint off)\b/.test(low)) {
      setTargetLock(null); S.scanCenter = null; syncScanOnMap();
      for (const k of ['flights', 'military', 'satellites', 'quakes', 'events', 'weather', 'cams', 'cables']) await toggleLayer(k, false);
      applyVisualFx('std');
      return say('🕶️ All live OSINT feeds paused and optics reset to standard.');
    }

    // 4. Individual layer toggles
    const layerAliases = [
      ['flights', /\b(flights?|planes?|aircraft|aviation|ads-?b)\b/],
      ['military', /\b(military|mil|fighters?|tankers?|air force)\b/],
      ['satellites', /\b(satellites?|sats?|orbit|starlink)\b/],
      ['quakes', /\b(quakes?|earthquakes?|seismic)\b/],
      ['events', /\b(disasters?|hazards?|wildfires?|fires?|volcan|storms?)\b/],
      ['weather', /\b(weather|rain|radar|precip)\b/],
      ['cams', /\b(webcams?|cameras?|cctv)\b/],
      ['cables', /\b(cables?|undersea|submarine|fiber)\b/],
      ['night', /\b(day\s*\/?\s*night|terminator|shadow)\b/]
    ];
    const wantsOff = /\b(off|hide|disable|remove|stop)\b/.test(low);
    const wantsOn = /\b(on|show|enable|track|activate|toggle)\b/.test(low);
    if (wantsOff || wantsOn) {
      const matched = layerAliases.filter(([, re]) => re.test(low));
      if (matched.length) {
        const targetState = wantsOff ? false : true;
        say((targetState ? '📡 Activating ' : '🔕 Disabling ') + matched.map(m => m[0]).join(', ') + '…');
        await Promise.all(matched.map(([k]) => toggleLayer(k, targetState)));
        return say('✅ Updated layers: ' + matched.map(m => m[0] + (targetState ? ' ON' : ' OFF')).join(', ') + '.');
      }
    }

    // 5. Map style switch
    const styleMap = [
      ['hybrid', /\b(hybrid|satellite labels)\b/],
      ['satellite', /\b(satellite view|satellite map|imagery)\b/],
      ['streets', /\b(streets?|osm)\b/],
      ['topo', /\b(topo|topographic|terrain)\b/],
      ['dark', /\b(dark map|dark street)\b/],
      ['daylight', /\b(daylight)\b/],
      ['midnight', /\b(midnight|offline atlas)\b/]
    ];
    for (const [sid, re] of styleMap) {
      if (re.test(low) && !/\bfly\b/.test(low)) {
        const sel = root.querySelector('#glb-style');
        if (sel) { sel.value = sid; sel.onchange({ target: sel }); }
        return say('🗺️ Switched basemap to ' + sid + '.');
      }
    }

    // 6. Measure A to B
    const measM = text.match(/^(?:measure|distance(?:\s+from)?)\s+(.+?)\s+(?:to|and)\s+(.+)$/i);
    if (measM) {
      say('📏 Calculating great-circle distance from ' + measM[1] + ' to ' + measM[2] + '…');
      const [p1, p2] = await Promise.all([resolvePlace(measM[1]), resolvePlace(measM[2])]);
      if (p1 && p2) {
        S.measureOn = true;
        S.measurePts = [[p1.lon, p1.lat], [p2.lon, p2.lat]];
        root.querySelector('#glb-meas').classList.add('on');
        syncMeasureOnMap();
        const km = haversineKm(S.measurePts[0], S.measurePts[1]);
        S.map.flyTo({ center: [(p1.lon + p2.lon) / 2, (p1.lat + p2.lat) / 2], zoom: 2.2, speed: 1.3 });
        return say('📏 ' + p1.name + ' ↔ ' + p2.name + ': ' + Math.round(km).toLocaleString() + ' km (' + Math.round(km * 0.621371).toLocaleString() + ' mi).');
      }
    }

    // 7. Scan 250 km
    const scanM = text.match(/^scan(?:\s+250\s*km)?(?:\s+(?:around|near|in))?\s*(.*)$/i);
    if (scanM) {
      const targetName = scanM[1].trim();
      if (targetName) {
        const p = await resolvePlace(targetName);
        if (p) { scanArea250(p.lon, p.lat, p.name); return say('📡 250 km proximity radar deployed over ' + p.name + '.'); }
      } else if (S.map) {
        const c = S.map.getCenter();
        scanArea250(c.lng, c.lat, 'Camera Center');
        return say('📡 250 km proximity radar deployed at ' + fmtCoord(c.lat, c.lng) + '.');
      }
    }

    // 7b. Download / Save Offline Region
    const dlM = text.match(/^(?:download|save\s+offline|offline\s+pack|cache)\s+(?:offline\s+)?(?:area|region|map\s+of\s+)?(.+)$/i);
    if (dlM) {
      openPacksDrawer({ name: dlM[1].trim() });
      return say('📥 Opening Offline Region Downloader for “' + dlM[1].trim() + '” — adjust zoom/style and click Download.');
    }

    // 8. Fly to <place>
    const flyM = text.match(/^(?:fly|go|zoom|jump|locate|find)\s+(?:to\s+)?(.+)$/i);
    if (flyM) {
      say('🧭 Locating ' + flyM[1] + '…');
      const p = await resolvePlace(flyM[1]);
      if (p) { flyToPlace(p); return say('✈️ Arrived at ' + p.name + (p.sub ? ' (' + p.sub + ')' : '') + ' · ' + fmtCoord(p.lat, p.lon)); }
      return say('🔎 Could not locate “' + flyM[1] + '”.');
    }

    // 9. Local Ollama AI Tactical Geospatial Briefing
    if (A.ai && A.ai.stream) {
      say('🤖 Consulting Moundshroud local AI…');
      const c = S.map ? S.map.getCenter() : { lat: 0, lng: 0 };
      const ctx = 'Current 3D Globe view: ' + fmtCoord(c.lat, c.lng) + ', zoom ' + (S.map ? S.map.getZoom().toFixed(1) : '1.6') +
        (S.selected ? (', selected: ' + S.selected.name + ' (' + (S.selected.sub || '') + ')') : '') +
        ', active OSINT feeds: ' + (['flights', 'military', 'satellites', 'quakes', 'events', 'weather', 'cams', 'cables'].filter(k => S.layers[k]).join(', ') || 'none') + '.';
      const sys = 'You are the Moundshroud 3D Globe Tactical Intelligence Commander. Give concise, accurate, helpful geographical or situational answers in 3-6 sentences. ' + ctx;
      try {
        await A.ai.stream(
          [{ role: 'system', content: sys }, { role: 'user', content: text }],
          acc => { if (out) { out.textContent = acc.replace(/\*\*/g, ''); out.classList.add('on'); out.scrollTop = out.scrollHeight; } },
          null, { temp: 0.4 }
        );
      } catch (e) {
        say('⚠️ Local AI unavailable right now. Try instant commands like “track ISS”, “godmode”, “FLIR”, “fly to Tokyo”, or “scan London”.');
      }
    } else {
      say('Try commands like: “track ISS”, “godmode”, “NVG”, “FLIR”, “fly to Tokyo”, “scan 250km New York”, “measure NYC to London”.');
    }
  }

  /* ---------- Build UI & Initialize WebGL Globe ---------- */
  async function build() {
    if (S.built) return;
    S.built = true;

    root.innerHTML =
      '<div class="glb-wrap">' +
        '<div id="glb-map"></div>' +
        '<div class="glb-fx" id="glb-fx"></div>' +
        '<div class="glb-reticle"></div>' +
        '<div class="glb-load" id="glb-load"><div style="font-size:44px">🌎</div><b>Initializing WebGL 3D Globe…</b><span class="small mute">Loading MapLibre GL + Natural Earth vectors + GodMode OSINT engine</span></div>' +
        '<div class="glb-tip" id="glb-tip"></div>' +

        /* Top HUD */
        '<div class="glb-top">' +
          '<div class="glb-glass glb-brand">' +
            '<div class="glb-brand-ic">🌎</div>' +
            '<div><b>3D World Globe</b><span id="glb-sub">100% Offline · WebGL GPU</span></div>' +
          '</div>' +

          '<div class="glb-qwrap">' +
            '<input class="glb-q" id="glb-q" type="text" placeholder="🔎 Search places, addresses, or coords..." autocomplete="off">' +
            '<button type="button" class="glb-qclr" id="glb-qclr">✕</button>' +
            '<div class="glb-glass glb-hits" id="glb-hits"></div>' +
          '</div>' +

          '<div class="glb-glass glb-bar">' +
            '<select class="glb-sel" id="glb-style" title="Switch offline vector themes or capped-cache live tiles">' +
              '<option value="midnight">🌌 Midnight (Offline)</option>' +
              '<option value="daylight">🗺️ Daylight (Offline)</option>' +
              '<option value="hybrid">🛰️ Satellite+Labels</option>' +
              '<option value="satellite">🛰️ Satellite Pure</option>' +
              '<option value="dark">🌑 Dark Streets</option>' +
              '<option value="streets">🏙️ Street Map OSM</option>' +
              '<option value="topo">⛰️ Topographic</option>' +
            '</select>' +
            '<select class="glb-sel" id="glb-fx-sel" title="Tactical Sensor Visual Mode (0ms GPU filter)">' +
              '<option value="std">👁️ Standard</option>' +
              '<option value="nvg">🟢 NVG Night Vision</option>' +
              '<option value="flir">🔥 FLIR Thermal</option>' +
              '<option value="crt">📺 CRT Recon</option>' +
              '<option value="noir">🕶️ Noir Tactical</option>' +
            '</select>' +
            '<button type="button" class="glb-btn on" id="glb-proj" title="Toggle 3D Globe vs Flat Map">🌍 3D</button>' +
            '<button type="button" class="glb-btn on" id="glb-spin" title="Toggle gentle Earth rotation">🔄 Spin</button>' +
            '<button type="button" class="glb-btn" id="glb-scan" title="Scan 250 km around camera center for live OSINT contacts">📡 Scan</button>' +
            '<button type="button" class="glb-btn" id="glb-meas" title="Measure great-circle distance">📏 Measure</button>' +
            '<button type="button" class="glb-btn" id="glb-packs-btn" title="Download specific towns, counties, states, or countries for 100% offline use">📥 Offline</button>' +
            '<button type="button" class="glb-btn" id="glb-ai-btn" title="Open AI Globe Commander">🤖 Command</button>' +
            '<button type="button" class="glb-btn" id="glb-reset" title="Reset global camera & clear locks">🎯 Reset</button>' +
          '</div>' +
        '</div>' +

        /* Target Lock Banner */
        '<div class="glb-glass glb-lock" id="glb-lock">' +
          '<span id="glb-lock-txt">🎯 LOCKED</span>' +
          '<button type="button" class="glb-btn" id="glb-unlock">✕ Unlock</button>' +
        '</div>' +

        /* Bottom-Left Dock: AI Commander + Map & GodMode OSINT Layer Chips */
        '<div class="glb-dock">' +
          '<div class="glb-glass glb-cmd" id="glb-cmd">' +
            '<div class="glb-cmd-row">' +
              '<input class="glb-cmd-in" id="glb-cmd-in" type="text" placeholder="🤖 Command globe (e.g. track ISS, godmode, FLIR, fly to Tokyo, scan London)..." autocomplete="off">' +
              '<button type="button" class="glb-btn on" id="glb-cmd-go">Run</button>' +
              '<button type="button" class="glb-btn" id="glb-cmd-x">✕</button>' +
            '</div>' +
            '<div class="glb-cmd-sugg" id="glb-cmd-sugg">' +
              '<button type="button" data-q="track ISS">🛰️ Track ISS</button>' +
              '<button type="button" data-q="godmode">⚡ GodMode All</button>' +
              '<button type="button" data-q="FLIR">🔥 FLIR Mode</button>' +
              '<button type="button" data-q="NVG">🟢 NVG Mode</button>' +
              '<button type="button" data-q="scan 250km New York">📡 Scan NYC</button>' +
              '<button type="button" data-q="stealth">🕶️ Stealth Off</button>' +
            '</div>' +
            '<div class="glb-cmd-out" id="glb-cmd-out"></div>' +
          '</div>' +

          '<div class="glb-glass glb-layers" id="glb-layers">' +
            '<button type="button" class="glb-chip on" data-ly="states">🗺️ States</button>' +
            '<button type="button" class="glb-chip on" data-ly="water">🌊 Water</button>' +
            '<button type="button" class="glb-chip on" data-ly="cities">⭐ Cities</button>' +
            '<button type="button" class="glb-chip on" data-ly="grid">🌐 Grid</button>' +
            '<button type="button" class="glb-chip" data-ly="night">🌓 Day/Night</button>' +
            '<button type="button" class="glb-chip" data-ly="cables" title="20 transoceanic fiber cables (100% offline)">🔌 Cables</button>' +
            '<span class="glb-div"></span>' +
            '<button type="button" class="glb-chip osint" data-ly="flights" title="Live global/regional ADS-B aircraft (0 MB storage)">✈️ Flights <span class="glb-cnt" style="display:none"></span></button>' +
            '<button type="button" class="glb-chip mil" data-ly="military" title="Live global military ADS-B radar">🪖 Military <span class="glb-cnt" style="display:none"></span></button>' +
            '<button type="button" class="glb-chip osint" data-ly="satellites" title="Live ISS + ~95 orbital satellites with ground tracks">🛰️ Satellites <span class="glb-cnt" style="display:none"></span></button>' +
            '<button type="button" class="glb-chip red" data-ly="quakes" title="USGS M2.5+ past 24h earthquakes">🌋 Quakes <span class="glb-cnt" style="display:none"></span></button>' +
            '<button type="button" class="glb-chip red" data-ly="events" title="NASA EONET active wildfires, volcanoes & storms">🔥 Hazards <span class="glb-cnt" style="display:none"></span></button>' +
            '<button type="button" class="glb-chip osint" data-ly="weather" title="RainViewer live global precipitation radar (0 MB disk)">🌦️ Weather</button>' +
            '<button type="button" class="glb-chip osint" data-ly="cams" title="59 live 24/7 worldwide public webcams">📹 Webcams <span class="glb-cnt" style="display:none"></span></button>' +
          '</div>' +
        '</div>' +

        /* Distance Measurement HUD */
        '<div class="glb-glass glb-measure" id="glb-measure">' +
          '<span id="glb-mtxt">📏 Click two points on the globe</span>' +
          '<button type="button" class="glb-btn" id="glb-mclr">✕ Clear</button>' +
        '</div>' +

        /* Bottom-Right Live Coordinates */
        '<div class="glb-glass glb-coords" id="glb-coords">0.000°N, 0.000°E · z1.6</div>' +

        /* Right-Side Tactical & Geo Inspector Drawer */
        '<aside class="glb-glass glb-insp" id="glb-insp">' +
          '<div class="glb-ihd">' +
            '<div class="glb-iic" id="glb-iic">🌍</div>' +
            '<div class="glb-imeta"><b id="glb-iname">Location</b><span id="glb-isub">Region</span></div>' +
            '<button type="button" class="glb-ix" id="glb-ix" title="Close">✕</button>' +
          '</div>' +
          '<div class="glb-ibd">' +
            '<div class="glb-cambox" id="glb-cambox">' +
              '<div class="glb-camhd"><span id="glb-camtitle">📹 Live Feed</span><button type="button" class="glb-btn" id="glb-camtv" style="padding:2px 6px">📺 Open TV</button></div>' +
              '<iframe allow="autoplay; encrypted-media; picture-in-picture" allowfullscreen referrerpolicy="no-referrer"></iframe>' +
            '</div>' +
            '<div class="glb-kv" id="glb-kv"></div>' +
            '<div class="glb-acts">' +
              '<button type="button" class="glb-act lock" id="glb-ilock" style="display:none">🎯 Lock Cockpit Chase-Cam</button>' +
              '<button type="button" class="glb-act pri" id="glb-iask">🤖 Ask Moundshroud AI about this</button>' +
              '<button type="button" class="glb-act" id="glb-iscan">📡 Scan 250 km</button>' +
              '<button type="button" class="glb-act" id="glb-iwiki">📖 Offline Library</button>' +
              '<button type="button" class="glb-act" id="glb-imeas">📏 Measure</button>' +
              '<button type="button" class="glb-act" id="glb-ipin">📍 Pin Here</button>' +
              '<button type="button" class="glb-act" id="glb-isave" style="grid-column:1/-1;border-color:rgba(52,211,153,.5);background:rgba(16,185,129,.18)">📥 Download This Area Offline</button>' +
            '</div>' +
            '<div class="glb-roster" id="glb-roster">' +
              '<div style="display:flex;align-items:center;justify-content:space-between">' +
                '<span style="font-size:11px;font-weight:700;color:#34d399;text-transform:uppercase;letter-spacing:.05em">📡 250 km Contact Roster</span>' +
                '<button type="button" class="glb-btn" id="glb-rclr" style="padding:2px 6px;font-size:10.5px">Clear Ring</button>' +
              '</div>' +
              '<div id="glb-rlist" style="display:flex;flex-direction:column;gap:4px"></div>' +
            '</div>' +
            '<div>' +
              '<div style="font-size:11px;font-weight:700;color:#94a3b8;margin-bottom:5px;text-transform:uppercase;letter-spacing:.05em">Saved Pins</div>' +
              '<div class="glb-pins" id="glb-pinlist"></div>' +
            '</div>' +
            '<div class="glb-cache">' +
              '<span id="glb-cache-txt">💾 Tile cache: 0.0 / 150 MB · Live OSINT: 0 MB</span>' +
              '<button type="button" class="glb-btn" id="glb-cache-clr" style="padding:3px 7px;font-size:10.5px">🧹 Clear</button>' +
            '</div>' +
          '</div>' +
        '</aside>' +

        /* Right-Side Offline Region Packs Manager (download specific towns, counties, states, countries) */
        '<aside class="glb-glass glb-packs" id="glb-packs">' +
          '<div class="glb-ihd">' +
            '<div class="glb-iic" style="background:rgba(16,185,129,.2);border-color:rgba(52,211,153,.45)">📥</div>' +
            '<div class="glb-imeta"><b>Offline Map Regions</b><span id="glb-pk-sum">0 saved · 0.0 MB</span></div>' +
            '<button type="button" class="glb-ix" id="glb-pk-x" title="Close">✕</button>' +
          '</div>' +
          '<div class="glb-ibd">' +
            '<div class="glb-pk-sec">' +
              '<div class="glb-pk-lbl">1. Pick a Town, County, State, or Country</div>' +
              '<div class="glb-pk-row">' +
                '<input class="glb-pk-in" id="glb-pk-q" type="text" placeholder="e.g. Austin TX, Cook County IL, Colorado, Japan..." autocomplete="off">' +
                '<button type="button" class="glb-btn on" id="glb-pk-find">Find</button>' +
              '</div>' +
              '<div class="glb-pk-hits" id="glb-pk-hits"></div>' +
              '<div class="glb-pk-row" style="justify-content:space-between">' +
                '<span id="glb-pk-selname" style="font-size:11.5px;color:#34d399;font-weight:600;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">No area selected</span>' +
                '<button type="button" class="glb-btn" id="glb-pk-view" style="padding:4px 8px;border:1px solid rgba(148,163,184,.26)">📐 Use Map View</button>' +
              '</div>' +
            '</div>' +

            '<div class="glb-pk-sec">' +
              '<div class="glb-pk-lbl">2. Choose Map Style &amp; Detail Level</div>' +
              '<select class="glb-sel" id="glb-pk-style" style="width:100%">' +
                '<option value="streets">🏙️ Street Map OSM (Best for roads &amp; towns)</option>' +
                '<option value="hybrid">🛰️ Satellite + Labels (Aerial imagery + names)</option>' +
                '<option value="satellite">🛰️ Satellite Pure (Aerial imagery only)</option>' +
                '<option value="topo">⛰️ Topographic (Terrain, elevation &amp; trails)</option>' +
                '<option value="dark">🌑 Dark Street Map (Low-light streets)</option>' +
              '</select>' +
              '<div class="glb-pk-presets" id="glb-pk-presets">' +
                '<button type="button" class="glb-act" data-pkp="low" style="padding:5px 6px;font-size:11px">Overview</button>' +
                '<button type="button" class="glb-act" data-pkp="rec" style="padding:5px 6px;font-size:11px;border-color:rgba(52,211,153,.55)">Balanced</button>' +
                '<button type="button" class="glb-act" data-pkp="max" style="padding:5px 6px;font-size:11px">Max Detail</button>' +
              '</div>' +
              '<div style="display:flex;align-items:center;gap:8px;font-size:11px;color:#cbd5e1">' +
                '<span>Zoom:</span>' +
                '<input type="range" id="glb-pk-z" min="4" max="15" value="12" style="flex:1;accent-color:#10b981">' +
                '<span id="glb-pk-zlbl" style="font-variant-numeric:tabular-nums;color:#94a3b8">z6 → z12</span>' +
              '</div>' +
              '<div class="glb-pk-est" id="glb-pk-est">Select any town, county, state, country, or map view to see exact tile count &amp; MB size.</div>' +
              '<button type="button" class="glb-act lock" id="glb-pk-dl" style="width:100%">📥 Download Selected Region Offline</button>' +
            '</div>' +

            '<div class="glb-prog-wrap" id="glb-prog-wrap">' +
              '<div style="display:flex;align-items:center;justify-content:space-between;gap:8px;font-size:11.5px">' +
                '<span id="glb-prog-txt">Downloading…</span>' +
                '<button type="button" class="glb-btn" id="glb-pk-cancel" style="padding:2px 7px;color:#fda4af">✕ Cancel</button>' +
              '</div>' +
              '<div class="glb-prog-bar"><div class="glb-prog-fill" id="glb-prog-fill"></div></div>' +
            '</div>' +

            '<div style="display:flex;flex-direction:column;gap:6px">' +
              '<div style="display:flex;align-items:center;justify-content:space-between">' +
                '<span class="glb-pk-lbl">Saved Offline Regions</span>' +
                '<label style="display:inline-flex;align-items:center;gap:5px;font-size:11px;color:#cbd5e1;cursor:pointer"><input type="checkbox" id="glb-pk-boxes" checked style="accent-color:#10b981"> Show on Globe</label>' +
              '</div>' +
              '<div id="glb-pk-list" style="display:flex;flex-direction:column;gap:6px"></div>' +
            '</div>' +
          '</div>' +
        '</aside>' +
      '</div>';

    fetch(GLOBE_BASE + '/data/search-index.json').then(r => r.json()).then(list => {
      if (Array.isArray(list)) {
        S.searchIndex = list.map(x => Object.assign(x, { _low: (x.n + ' ' + x.sub + ' ' + x.iso).toLowerCase() }));
      }
    }).catch(() => {});

    try {
      const [ml] = await Promise.all([loadMapLibre(), loadGlobeData()]);
      const mapEl = root.querySelector('#glb-map');
      const map = new ml.Map({
        container: mapEl,
        style: buildMapStyle(S.styleId),
        center: [-25, 22],
        zoom: 1.65,
        pitch: 0,
        bearing: 0,
        pixelRatio: Math.min(window.devicePixelRatio || 1, 1.5),
        antialias: false,
        fadeDuration: 0,
        maxPitch: 65,
        attributionControl: { compact: true }
      });
      S.map = map;
      map.addControl(new ml.NavigationControl({ visualizePitch: true }), 'bottom-right');

      const applyGlobeEffects = () => {
        try { if (map.setProjection) map.setProjection({ type: S.proj }); } catch (e) { }
        try {
          const sk = THEMES[S.styleId] && THEMES[S.styleId].sky;
          if (sk && map.setSky) map.setSky(sk);
        } catch (e) { }
        syncMeasureOnMap();
        syncPinsOnMap();
        syncScanOnMap();
        syncPacksOnMap();
        syncOsintSources();
        applyLayerVis();
      };
      const finishLoading = () => {
        const ld = root.querySelector('#glb-load');
        if (ld) ld.remove();
        try { map.resize(); } catch (e) { }
        updateSubtitle();
        ensureLoop();
        refreshCacheStatus();
        refreshPacks();
      };

      map.on('style.load', () => { applyGlobeEffects(); finishLoading(); });
      map.on('load', finishLoading);
      map.on('error', ev => {
        if (ev && ev.error && !/tile|fetch|network/i.test(String(ev.error.message || ''))) {
          console.warn('3D Globe notice:', ev.error);
        }
      });
      if (typeof ResizeObserver !== 'undefined') {
        new ResizeObserver(() => {
          if (S.map && A.cur === 'globe') { try { S.map.resize(); } catch (e) { } }
        }).observe(root.querySelector('.glb-wrap'));
      }

      const stopSpinOnInteract = () => {
        if (S.spin) {
          S.spin = false; stopLoop();
          const b = root.querySelector('#glb-spin');
          if (b) b.classList.remove('on');
        }
      };
      map.on('dragstart', () => { stopSpinOnInteract(); if (S.lock) setTargetLock(null); });
      map.on('wheel', stopSpinOnInteract);

      // Hover tooltips across ALL GodMode OSINT layers + Cities + Pins + Countries
      const tip = root.querySelector('#glb-tip');
      const coordsEl = root.querySelector('#glb-coords');
      const showTip = (pt, html) => {
        map.getCanvas().style.cursor = 'pointer';
        tip.innerHTML = html;
        tip.style.left = Math.round(pt.x) + 'px';
        tip.style.top = Math.round(pt.y) + 'px';
        tip.style.display = 'block';
      };

      map.on('mousemove', e => {
        coordsEl.textContent = fmtCoord(e.lngLat.lat, e.lngLat.lng) + ' · z' + map.getZoom().toFixed(1);
        const query = id => map.getLayer(id) ? map.querySelectorRenderedFeatures(e.point, { layers: [id] }) : [];

        const satH = query('osint-sats-dots');
        if (satH.length) { const p = satH[0].properties; return showTip(e.point, '🛰️ <b>' + esc(p.name) + '</b> <span style="color:#c084fc">· ALT ' + esc(p.altKm) + ' km</span>'); }
        const milH = query('osint-mil-dots');
        if (milH.length) { const p = milH[0].properties; return showTip(e.point, '🪖 <b>' + esc(p.call) + '</b> <span style="color:#fbbf24">· MIL ADS-B</span>'); }
        const flH = query('osint-flights-dots');
        if (flH.length) { const p = flH[0].properties; return showTip(e.point, '✈️ <b>' + esc(p.call) + '</b> <span style="color:#38bdf8">· ' + Math.round((p.altM || 0) * 3.28) + ' ft</span>'); }
        const camH = query('osint-cams-dots');
        if (camH.length) { const p = camH[0].properties; return showTip(e.point, '📹 <b>' + esc(p.place) + '</b> <span style="color:#34d399">· Live Cam</span>'); }
        const qkH = query('osint-quakes-dots');
        if (qkH.length) { const p = qkH[0].properties; return showTip(e.point, '🌋 <b>M' + Number(p.mag || 0).toFixed(1) + '</b> <span style="color:#fb923c">· ' + esc(p.place) + '</span>'); }
        const evH = query('osint-events-dots');
        if (evH.length) { const p = evH[0].properties; return showTip(e.point, '🔥 <b>' + esc(p.title) + '</b> <span style="color:#fb7185">· ' + esc(p.cat) + '</span>'); }
        const cbH = query('cables-line');
        if (cbH.length) { const p = cbH[0].properties; return showTip(e.point, '🔌 <b>' + esc(p.name) + '</b>'); }
        const cityH = query('cities-dots');
        if (cityH.length) { const p = cityH[0].properties; return showTip(e.point, (p.adm0cap ? '⭐ ' : '🏙️ ') + '<b>' + esc(p.name) + '</b> <span style="color:#94a3b8">· ' + esc(p.adm0name || '') + '</span>'); }
        const pinH = query('pins-dots');
        if (pinH.length) { return showTip(e.point, '📍 <b>' + esc(pinH[0].properties.name) + '</b>'); }

        const cHits = query('countries-fill');
        if (cHits.length && cHits[0].id != null) {
          const cid = cHits[0].id;
          if (S.hoveredCountryId !== cid) {
            if (S.hoveredCountryId != null) map.setFeatureState({ source: 'countries', id: S.hoveredCountryId }, { hover: false });
            S.hoveredCountryId = cid;
            map.setFeatureState({ source: 'countries', id: cid }, { hover: true });
          }
          const cp = cHits[0].properties;
          showTip(e.point, '🌍 <b>' + esc(cp.NAME || cp.ADMIN || '') + '</b> <span style="color:#94a3b8">· ' + esc(cp.SUBREGION || cp.CONTINENT || '') + '</span>');
          if (S.measureOn) map.getCanvas().style.cursor = 'crosshair';
        } else {
          if (S.hoveredCountryId != null) {
            map.setFeatureState({ source: 'countries', id: S.hoveredCountryId }, { hover: false });
            S.hoveredCountryId = null;
          }
          map.getCanvas().style.cursor = S.measureOn ? 'crosshair' : '';
          tip.style.display = 'none';
        }
      });
      map.on('mouseout', () => { tip.style.display = 'none'; });

      // Click handling: prioritizes OSINT contacts -> Webcams -> Cables -> Pins -> Cities -> Countries -> Ocean
      map.on('click', e => {
        stopSpinOnInteract();
        if (S.measureOn) {
          if (S.measurePts.length >= 2) S.measurePts = [];
          S.measurePts.push([e.lngLat.lng, e.lngLat.lat]);
          syncMeasureOnMap();
          return;
        }
        const query = id => map.getLayer(id) ? map.querySelectorRenderedFeatures(e.point, { layers: [id] }) : [];

        const satH = query('osint-sats-dots');
        if (satH.length) {
          const rec = S.osint.satsLive[+satH[0].properties.idx];
          if (rec) {
            S.osint.selectedSatNorad = rec.norad;
            syncOsintSources();
            openInspector({ kind: 'sat', name: rec.name, sub: rec.isISS ? 'International Space Station · Live NASA Feed' : ('Orbital Satellite · ' + rec.cat.toUpperCase()), lat: rec.lat, lon: rec.lon, lockId: rec.norad, raw: rec });
            return;
          }
        }
        const milH = query('osint-mil-dots');
        if (milH.length) {
          const rec = S.osint.military[+milH[0].properties.idx];
          if (rec) {
            openInspector({ kind: 'military', name: rec.call, sub: rec.desc || 'Military Aircraft (ADS-B)', lat: rec.lat, lon: rec.lon, lockId: rec.id, raw: rec });
            return;
          }
        }
        const flH = query('osint-flights-dots');
        if (flH.length) {
          const rec = S.osint.flights[+flH[0].properties.idx];
          if (rec) {
            openInspector({ kind: 'flight', name: rec.call, sub: 'Live Commercial / Civil Flight', lat: rec.lat, lon: rec.lon, lockId: rec.id, raw: rec });
            return;
          }
        }
        const camH = query('osint-cams-dots');
        if (camH.length) {
          const rec = S.osint.cams[+camH[0].properties.idx];
          if (rec) {
            openInspector({ kind: 'cam', name: rec.place, sub: rec.name, lat: rec.lat, lon: rec.lon, raw: rec });
            return;
          }
        }
        const qkH = query('osint-quakes-dots');
        if (qkH.length) {
          const rec = S.osint.quakes[+qkH[0].properties.idx];
          if (rec) {
            openInspector({ kind: 'quake', name: 'M' + rec.mag.toFixed(1) + ' Earthquake', sub: rec.place, lat: rec.lat, lon: rec.lon, raw: rec });
            return;
          }
        }
        const evH = query('osint-events-dots');
        if (evH.length) {
          const rec = S.osint.events[+evH[0].properties.idx];
          if (rec) {
            openInspector({ kind: 'event', name: rec.title, sub: 'NASA EONET · ' + rec.cat, lat: rec.lat, lon: rec.lon, raw: rec });
            return;
          }
        }
        const cbH = query('cables-line');
        if (cbH.length) {
          const p = cbH[0].properties;
          openInspector({ kind: 'cable', name: p.name, sub: p.owner, lat: e.lngLat.lat, lon: e.lngLat.lng });
          return;
        }
        const pinH = query('pins-dots');
        if (pinH.length) {
          const p = pinH[0].properties;
          openInspector({ kind: 'pin', name: p.name, sub: 'Saved Personal Pin', lat: +p.lat, lon: +p.lon });
          return;
        }
        const cityH = query('cities-dots');
        if (cityH.length) {
          const p = cityH[0].properties, coords = cityH[0].geometry.coordinates;
          openInspector({
            kind: p.adm0cap ? 'cap' : 'city', name: p.name || p.nameascii,
            sub: [p.adm1name, p.adm0name].filter(Boolean).join(', '),
            iso: p.iso_a2 || '', pop: +p.pop_max || 0, lon: coords[0], lat: coords[1]
          });
          return;
        }
        const cHits = query('countries-fill');
        if (cHits.length) {
          const p = cHits[0].properties;
          openInspector({
            kind: 'c', name: p.NAME || p.ADMIN, sub: p.SUBREGION || p.CONTINENT || '',
            iso: p.ISO_A2 && p.ISO_A2 !== '-99' ? p.ISO_A2 : '',
            pop: +p.POP_EST || 0, gdp: +p.GDP_MD || 0, detail: p.ECONOMY || '',
            lon: e.lngLat.lng, lat: e.lngLat.lat
          });
        } else {
          openInspector({ kind: 'ocean', name: 'Open Ocean / Coordinates', sub: 'Global Location', lat: e.lngLat.lat, lon: e.lngLat.lng });
        }
      });

      /* ---- UI Controls ---- */
      let proxyChecked = false, proxyOk = true;
      root.querySelector('#glb-style').onchange = async e => {
        S.styleId = e.target.value;
        S.hoveredCountryId = null;
        if (THEMES[S.styleId] && THEMES[S.styleId].raster && !proxyChecked) {
          proxyChecked = true;
          try {
            const st = await fetch('/api/globe/status').then(r => r.ok ? r.json() : null);
            proxyOk = !!(st && st.ok);
          } catch (err) { proxyOk = false; }
          if (!proxyOk) A.toast('Restart Moundshroud once to activate live Satellite, Street & Topographic tiles!', 6000);
        }
        map.setStyle(buildMapStyle(S.styleId));
        updateSubtitle();
      };

      root.querySelector('#glb-fx-sel').onchange = e => applyVisualFx(e.target.value);

      root.querySelector('#glb-proj').onclick = e => {
        S.proj = S.proj === 'globe' ? 'mercator' : 'globe';
        map.setProjection({ type: S.proj });
        e.currentTarget.textContent = S.proj === 'globe' ? '🌍 3D' : '🗺️ 2D';
        e.currentTarget.classList.toggle('on', S.proj === 'globe');
        updateSubtitle();
      };

      root.querySelector('#glb-spin').onclick = e => {
        S.spin = !S.spin;
        e.currentTarget.classList.toggle('on', S.spin);
        if (S.spin) ensureLoop(); else stopLoop();
      };

      root.querySelector('#glb-scan').onclick = () => {
        const c = map.getCenter();
        scanArea250(c.lng, c.lat, 'Camera Center');
      };

      root.querySelector('#glb-meas').onclick = e => {
        S.measureOn = !S.measureOn;
        e.currentTarget.classList.toggle('on', S.measureOn);
        if (!S.measureOn) S.measurePts = [];
        syncMeasureOnMap();
      };
      root.querySelector('#glb-mclr').onclick = () => {
        S.measureOn = false; S.measurePts = [];
        root.querySelector('#glb-meas').classList.remove('on');
        syncMeasureOnMap();
      };

      root.querySelector('#glb-unlock').onclick = () => setTargetLock(null);

      root.querySelector('#glb-reset').onclick = () => {
        setTargetLock(null);
        S.scanCenter = null; syncScanOnMap();
        applyVisualFx('std');
        S.proj = 'globe';
        map.setProjection({ type: 'globe' });
        root.querySelector('#glb-proj').textContent = '🌍 3D';
        root.querySelector('#glb-proj').classList.add('on');
        map.flyTo({ center: [-25, 22], zoom: 1.65, pitch: 0, bearing: 0, speed: 1.3 });
        updateSubtitle();
        openInspector(null);
      };

      root.querySelector('#glb-layers').onclick = e => {
        const b = e.target.closest('[data-ly]');
        if (b) toggleLayer(b.dataset.ly);
      };

      /* ---- Offline Region Packs Drawer Controls ---- */
      root.querySelector('#glb-packs-btn').onclick = () => {
        const dr = root.querySelector('#glb-packs');
        if (dr && dr.classList.contains('on')) closePacksDrawer();
        else openPacksDrawer();
      };
      root.querySelector('#glb-pk-x').onclick = closePacksDrawer;
      root.querySelector('#glb-pk-view').onclick = selectPackFromViewport;
      const pkQ = root.querySelector('#glb-pk-q');
      root.querySelector('#glb-pk-find').onclick = () => searchPackPlace(pkQ.value, false);
      pkQ.onkeydown = e => {
        e.stopPropagation();
        if (e.key === 'Enter') searchPackPlace(pkQ.value, false);
        else if (e.key === 'Escape') { pkQ.value = ''; root.querySelector('#glb-pk-hits').classList.remove('on'); }
      };
      root.querySelector('#glb-pk-hits').onclick = e => {
        const row = e.target.closest('[data-pkhi]'); if (!row) return;
        const hits = root.querySelector('#glb-pk-hits');
        const it = hits && hits._list && hits._list[+row.dataset.pkhi];
        if (it && it.bbox) selectPackRegion(it.name + (it.sub ? ', ' + it.sub.split(',')[0].trim() : ''), it.bbox);
      };
      root.querySelector('#glb-pk-style').onchange = () => {
        if (S.packDraft) { S.packDraft.maxZ = null; estimatePackDraft(); }
      };
      root.querySelector('#glb-pk-presets').onclick = e => {
        const b = e.target.closest('[data-pkp]'); if (!b || !S.packEst) return;
        const p = b.dataset.pkp;
        const z = p === 'low' ? Math.max(S.packEst.minZ, S.packEst.recommendedMaxZ - 2) : p === 'max' ? S.packEst.safeMaxZ : S.packEst.recommendedMaxZ;
        estimatePackDraft(z);
      };
      root.querySelector('#glb-pk-z').oninput = e => {
        estimatePackDraft(parseInt(e.target.value, 10));
      };
      root.querySelector('#glb-pk-dl').onclick = startPackDownload;
      root.querySelector('#glb-pk-cancel').onclick = cancelPackDownload;
      root.querySelector('#glb-pk-boxes').onchange = e => {
        S.packShowBoxes = !!e.target.checked;
        syncPacksOnMap();
      };
      root.querySelector('#glb-pk-list').onclick = e => {
        const del = e.target.closest('[data-pkdel]');
        if (del) { deleteSavedPack(del.dataset.pkdel); return; }
        const fly = e.target.closest('[data-pkfly]');
        if (fly) {
          const pk = S.packs[+fly.dataset.pkfly];
          if (!pk) return;
          // Switch to this pack's downloaded basemap automatically so it renders 100% offline!
          if (THEMES[pk.style] && S.styleId !== pk.style) {
            S.styleId = pk.style;
            const sel = root.querySelector('#glb-style');
            if (sel) sel.value = pk.style;
            map.setStyle(buildMapStyle(S.styleId));
            updateSubtitle();
          }
          fitBboxOnMap(pk.bbox);
          A.toast('Viewing offline pack: ' + pk.name + ' (' + pk.style + ', z' + pk.minZ + '–z' + pk.maxZ + ')');
        }
      };

      /* ---- AI Globe Commander Controls ---- */
      const cmdBox = root.querySelector('#glb-cmd');
      const cmdIn = root.querySelector('#glb-cmd-in');
      root.querySelector('#glb-ai-btn').onclick = e => {
        const on = cmdBox.classList.toggle('on');
        e.currentTarget.classList.toggle('on', on);
        if (on) cmdIn.focus();
      };
      root.querySelector('#glb-cmd-x').onclick = () => {
        cmdBox.classList.remove('on');
        root.querySelector('#glb-ai-btn').classList.remove('on');
      };
      root.querySelector('#glb-cmd-go').onclick = () => runAiCommand(cmdIn.value);
      cmdIn.onkeydown = e => {
        e.stopPropagation();
        if (e.key === 'Enter') runAiCommand(cmdIn.value);
        else if (e.key === 'Escape') root.querySelector('#glb-cmd-x').click();
      };
      root.querySelector('#glb-cmd-sugg').onclick = e => {
        const b = e.target.closest('[data-q]'); if (!b) return;
        cmdIn.value = b.dataset.q;
        runAiCommand(b.dataset.q);
      };

      /* ---- Instant <1ms Offline Search + Worldwide Address Geocoder ---- */
      const qIn = root.querySelector('#glb-q'), qClr = root.querySelector('#glb-qclr'), hitsBox = root.querySelector('#glb-hits');
      async function runOnlineGeocode(rawQ) {
        hitsBox.innerHTML = '<div class="glb-hit"><span>⏳</span><span>Searching worldwide addresses &amp; places…</span></div>';
        hitsBox.classList.add('on');
        try {
          const r = await fetch('/api/globe/geocode?q=' + encodeURIComponent(rawQ));
          if (!r.ok) throw new Error('Restart Moundshroud once to enable online worldwide address search.');
          const d = await r.json();
          const list = (d && d.results) || [];
          if (!list.length) {
            hitsBox.innerHTML = '<div class="glb-hit"><span>🔎</span><span style="color:#94a3b8">No places found for “' + esc(rawQ) + '”.</span></div>';
            return;
          }
          hitsBox._hits = list.map(x => ({ k: 'geo', n: x.name, sub: x.sub, lat: x.lat, lon: x.lon, bbox: x.bbox, zoom: 11.5 }));
          hitsBox.innerHTML = hitsBox._hits.map((h, i) =>
            '<div class="glb-hit" data-hi="' + i + '"><span>🌐</span><span style="flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap"><b>' + esc(h.n) + '</b> <span style="color:#94a3b8">' + esc(h.sub) + '</span></span></div>'
          ).join('');
        } catch (err) {
          hitsBox.innerHTML = '<div class="glb-hit"><span>⚠️</span><span style="color:#fbbf24">' + esc(err.message || err) + '</span></div>';
        }
      }
      qIn.oninput = () => {
        const raw = qIn.value.trim(), q = raw.toLowerCase();
        qClr.style.display = q ? 'block' : 'none';
        if (!q) { hitsBox.classList.remove('on'); return; }
        const hits = [];
        for (let i = 0; i < S.searchIndex.length && hits.length < 14; i++) {
          if (S.searchIndex[i]._low.indexOf(q) !== -1) hits.push(S.searchIndex[i]);
        }
        hitsBox._hits = hits;
        hitsBox.innerHTML = hits.map((h, i) =>
          '<div class="glb-hit" data-hi="' + i + '">' +
            '<span>' + (h.k === 'c' ? '🌍' : h.k === 'cap' ? '⭐' : '🏙️') + '</span>' +
            '<span style="flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap"><b>' + esc(h.n) + '</b> <span style="color:#94a3b8">' + esc(h.sub) + '</span></span>' +
            '<small>' + (h.pop ? fmtPop(h.pop) : '') + '</small>' +
          '</div>'
        ).join('') +
        (raw.length >= 2 ? '<div class="glb-hit" data-geo="1" style="border-top:1px solid rgba(148,163,184,.18);margin-top:3px;padding-top:8px"><span>🌐</span><span><b>Search worldwide addresses &amp; towns</b> for “' + esc(raw) + '”</span></div>' : '');
        hitsBox.classList.add('on');
      };
      qIn.onkeydown = e => {
        e.stopPropagation();
        if (e.key === 'Escape') { qIn.value = ''; qIn.oninput(); }
        else if (e.key === 'Enter') {
          if (hitsBox._hits && hitsBox._hits[0]) {
            const first = hitsBox._hits[0];
            hitsBox.classList.remove('on');
            flyToPlace({ kind: first.k, name: first.n, sub: first.sub, iso: first.iso, pop: first.pop, gdp: first.gdp, lat: first.lat, lon: first.lon, bbox: first.bbox, zoom: first.zoom });
          } else if (qIn.value.trim().length >= 2) runOnlineGeocode(qIn.value.trim());
        }
      };
      qClr.onclick = () => { qIn.value = ''; qIn.oninput(); };
      hitsBox.onclick = e => {
        if (e.target.closest('[data-geo]')) { runOnlineGeocode(qIn.value.trim()); return; }
        const el = e.target.closest('[data-hi]'); if (!el || !hitsBox._hits) return;
        const h = hitsBox._hits[+el.dataset.hi];
        hitsBox.classList.remove('on');
        if (h) flyToPlace({ kind: h.k, name: h.n, sub: h.sub, iso: h.iso, pop: h.pop, gdp: h.gdp, lat: h.lat, lon: h.lon, bbox: h.bbox, zoom: h.zoom });
      };

      /* ---- Inspector Actions ---- */
      root.querySelector('#glb-ix').onclick = () => openInspector(null);
      root.querySelector('#glb-ilock').onclick = () => {
        if (!S.selected || !S.selected.lockId) return;
        const same = S.lock && S.lock.kind === S.selected.kind && S.lock.id === S.selected.lockId;
        setTargetLock(same ? null : { kind: S.selected.kind, id: S.selected.lockId, name: S.selected.name });
        openInspector(S.selected);
      };
      root.querySelector('#glb-camtv').onclick = () => { A.showTab('tv'); };
      root.querySelector('#glb-iscan').onclick = () => {
        if (S.selected) scanArea250(S.selected.lon, S.selected.lat, S.selected.name);
      };
      root.querySelector('#glb-rclr').onclick = () => {
        S.scanCenter = null; syncScanOnMap(); renderProximityRoster();
      };
      root.querySelector('#glb-rlist').onclick = e => {
        const row = e.target.closest('[data-ri]'); if (!row) return;
        const listEl = root.querySelector('#glb-rlist');
        const h = listEl && listEl._hits && listEl._hits[+row.dataset.ri];
        if (!h) return;
        const it = h.item;
        const itemObj = {
          kind: h.kind, name: h.name, sub: h.sub, lat: it.lat, lon: it.lon, raw: it,
          lockId: h.kind === 'sat' ? it.norad : (h.kind === 'flight' || h.kind === 'military' ? it.id : null)
        };
        if (h.kind === 'sat') { S.osint.selectedSatNorad = it.norad; syncOsintSources(); }
        flyToPlace(itemObj);
      };
      root.querySelector('#glb-iask').onclick = () => {
        if (!S.selected) return;
        const p = S.selected;
        A.showTab('chat');
        if (A.chat && A.chat.ask) {
          A.chat.ask('Tell me the most interesting geography, history, strategic significance, and key facts about ' + p.name + (p.sub ? ' (' + p.sub + ')' : '') + '.', { noLocal: true });
        }
      };
      root.querySelector('#glb-iwiki').onclick = () => {
        if (!S.selected) return;
        if (A.lib && A.lib.search) A.lib.search(S.selected.name);
        else A.showTab('web');
      };
      root.querySelector('#glb-imeas').onclick = () => {
        if (!S.selected) return;
        S.measureOn = true;
        S.measurePts = [[S.selected.lon, S.selected.lat]];
        root.querySelector('#glb-meas').classList.add('on');
        syncMeasureOnMap();
        A.toast('Click a second place on the globe to measure distance!');
      };
      root.querySelector('#glb-ipin').onclick = async () => {
        if (!S.selected) return;
        const label = await A.prompt('Name this pin:', S.selected.name, { title: 'Save Globe Pin' });
        if (!label || !label.trim()) return;
        S.pins.unshift({ name: label.trim().slice(0, 60), lat: S.selected.lat, lon: S.selected.lon });
        savePins(); syncPinsOnMap(); renderPinsInInspector();
        A.toast('Saved pin “' + label.trim() + '”');
      };
      root.querySelector('#glb-isave').onclick = () => {
        if (!S.selected) return openPacksDrawer();
        const p = S.selected;
        if (p.bbox) return openPacksDrawer({ name: p.name, bbox: p.bbox });
        const qName = p.name && p.kind !== 'ocean' ? (p.name + (p.sub ? ', ' + p.sub.split(',')[0].trim() : '')) : '';
        if (qName) openPacksDrawer({ name: qName });
        else {
          const d = 0.25;
          openPacksDrawer({ name: p.name || 'Selected Area', bbox: { south: p.lat - d, north: p.lat + d, west: p.lon - d, east: p.lon + d } });
        }
      };
      root.querySelector('#glb-pinlist').onclick = e => {
        const del = e.target.closest('[data-pdel]');
        if (del) {
          e.stopPropagation();
          S.pins.splice(+del.dataset.pdel, 1);
          savePins(); syncPinsOnMap(); renderPinsInInspector();
          return;
        }
        const row = e.target.closest('[data-pidx]');
        if (row) {
          const p = S.pins[+row.dataset.pidx];
          if (p) flyToPlace({ kind: 'pin', name: p.name, sub: 'Saved Personal Pin', lat: p.lat, lon: p.lon });
        }
      };
      root.querySelector('#glb-cache-clr').onclick = async () => {
        const ok = await A.confirm('Clear all locally cached Satellite/Street map tiles to free disk space? (Your saved pins and offline world atlas are kept.)', { title: 'Clear Globe Tile Cache' });
        if (!ok) return;
        try {
          const r = await fetch('/api/globe/cache/clear', { method: 'POST' });
          const d = r.ok ? await r.json() : null;
          if (d && d.ok) {
            A.toast('Freed ' + ((d.freedBytes || 0) / 1048576).toFixed(1) + ' MB (' + (d.freedFiles || 0) + ' cached tiles).');
            refreshCacheStatus();
          } else {
            A.toast('Restart Moundshroud once to enable tile cache clearing.');
          }
        } catch (err) { A.toast('Could not clear cache.'); }
      };

      document.addEventListener('visibilitychange', () => {
        if (document.hidden) { stopLoop(); stopOsintTimers(); stopPackPoll(); }
        else { ensureLoop(); ensureOsintTimers(); if (S.packJob && S.packJob.status === 'running') refreshPacks(); }
      });
    } catch (err) {
      const ld = root.querySelector('#glb-load');
      if (ld) ld.innerHTML = '<div style="font-size:36px">⚠️</div><b>Could not start 3D Globe</b><span class="small mute">' + esc(err && err.message || err) + '</span>';
    }
  }

  A.globe = { open: () => A.showTab('globe'), flyTo: flyToPlace, cmd: runAiCommand };
  A.registerTab('globe', '3D Globe', () => {
    build();
    if (S.map) {
      setTimeout(() => { try { S.map.resize(); } catch (e) { } }, 60);
      ensureLoop();
      ensureOsintTimers();
    }
  });

  if (A.cmd && A.cmd.reg) {
    A.cmd.reg([{
      title: '3D World Globe — GodMode OSINT & Atlas',
      sub: 'Live flights, military ADS-B, satellites/ISS, quakes, hazards, weather radar, 59 webcams, NVG/FLIR & AI Commander',
      icon: '🌎',
      group: 'Open',
      tags: '3d globe world map godmode osint flights military satellites iss earthquakes weather radar webcams flir nvg',
      run: () => A.showTab('globe')
    }]);
  }
})();

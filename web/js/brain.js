// 3D Brain: an interactive 3D neural connectome of all files across your PC (Desktop, Documents, Downloads, Pictures,
// Music, Videos, My Files, and custom folders) with a built-in Local AI Agent chat dock that can create/edit files and
// actively populate them as live neurons in 3D, control the 3D brain, help you navigate the workspace, and run any app action.
(() => {
  const root = document.getElementById('p-brain');
  if (!root) return;
  const esc = s => String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const fmtBytes = b => b >= 1073741824 ? (b / 1073741824).toFixed(2) + ' GB' : b >= 1048576 ? (b / 1048576).toFixed(1) + ' MB' : b >= 1024 ? Math.round(b / 1024) + ' KB' : (b || 0) + ' B';

  const LOBES = {
    core:   { label: 'Brain Core',      icon: '🧠', col: '#ffffff', rgb: [255, 255, 255], lobeCenter: [0, 0, 0] },
    folder: { label: 'Folder Nuclei',   icon: '📁', col: '#e2e8f0', rgb: [226, 232, 240], lobeCenter: [0, 0.05, 0] },
    code:   { label: 'Frontal · Code',  icon: '💻', col: '#38bdf8', rgb: [56, 189, 248],  lobeCenter: [-0.45, -0.22, 0.52] },
    docs:   { label: 'Parietal · Docs', icon: '📄', col: '#f59e0b', rgb: [245, 158, 11],  lobeCenter: [0.45, -0.28, 0.18] },
    images: { label: 'Occipital · Art', icon: '🖼️', col: '#f43f5e', rgb: [244, 63, 94],   lobeCenter: [0.38, 0.05, -0.58] },
    audio:  { label: 'Temporal · Audio',icon: '🎵', col: '#10b981', rgb: [16, 185, 129],  lobeCenter: [-0.62, 0.18, -0.05] },
    video:  { label: 'Temporal · Video',icon: '🎬', col: '#a855f7', rgb: [168, 85, 247],  lobeCenter: [0.62, 0.18, -0.05] },
    data:   { label: 'Cerebellar · Data',icon:'📦', col: '#fb923c', rgb: [251, 146, 60],  lobeCenter: [-0.35, 0.42, -0.45] }
  };

  if (!document.getElementById('brn-css')) {
    const st = document.createElement('style');
    st.id = 'brn-css';
    st.textContent = `
.brn-wrap{position:relative;flex:1;min-height:0;width:100%;height:100%;overflow:hidden;background:radial-gradient(circle at 50% 42%,#0d1528 0%,#060913 58%,#020409 100%);color:#e2e8f0;user-select:none;font-family:var(--f-ui,sans-serif)}
.brn-cv{position:absolute;inset:0;width:100%;height:100%;display:block;cursor:grab}
.brn-cv:active{cursor:grabbing}
.brn-hud-top{position:absolute;top:14px;left:16px;right:16px;z-index:5;display:flex;align-items:center;gap:10px;flex-wrap:wrap;pointer-events:none}
.brn-hud-top > *{pointer-events:auto}
.brn-glass{background:rgba(10,15,30,.78);backdrop-filter:blur(18px) saturate(1.4);-webkit-backdrop-filter:blur(18px) saturate(1.4);border:1px solid rgba(148,163,184,.22);border-radius:14px;box-shadow:0 14px 36px -10px rgba(0,0,0,.65),inset 0 1px 0 rgba(255,255,255,.08)}
.brn-brand{display:flex;align-items:center;gap:10px;padding:8px 14px}
.brn-brand-ic{width:32px;height:32px;border-radius:10px;display:grid;place-items:center;font-size:18px;background:linear-gradient(135deg,rgba(56,189,248,.25),rgba(168,85,247,.25));border:1px solid rgba(56,189,248,.4);box-shadow:0 0 18px rgba(56,189,248,.25)}
.brn-brand b{font-size:14.5px;letter-spacing:-.01em;display:block;color:#f8fafc}
.brn-brand span{font-size:11px;color:#94a3b8;display:block}
.brn-search-wrap{position:relative;flex:1;min-width:200px;max-width:310px}
.brn-search{width:100%;box-sizing:border-box;padding:9px 32px 9px 13px;border-radius:12px;border:1px solid rgba(148,163,184,.24);background:rgba(10,15,30,.82);color:#f8fafc;font-size:13px;outline:none;transition:border-color .18s,box-shadow .18s}
.brn-search:focus{border-color:#38bdf8;box-shadow:0 0 0 3px rgba(56,189,248,.2)}
.brn-search-clr{position:absolute;right:8px;top:50%;transform:translateY(-50%);background:none;border:0;color:#94a3b8;cursor:pointer;font-size:13px;display:none}
.brn-hits{position:absolute;top:calc(100% + 6px);left:0;right:0;max-height:280px;overflow:auto;padding:6px;display:none;z-index:20}
.brn-hits.on{display:block}
.brn-hit{padding:7px 10px;border-radius:9px;cursor:pointer;display:flex;align-items:center;gap:8px;font-size:12.5px;color:#e2e8f0}
.brn-hit:hover{background:rgba(56,189,248,.16)}
.brn-bar{display:flex;align-items:center;gap:5px;padding:5px 7px;flex-wrap:wrap}
.brn-btn{padding:6px 11px;border-radius:9px;border:1px solid transparent;background:rgba(30,41,59,.55);color:#cbd5e1;font-size:12px;font-weight:600;cursor:pointer;transition:all .15s;white-space:nowrap}
.brn-btn:hover{background:rgba(56,189,248,.18);color:#fff;border-color:rgba(56,189,248,.35)}
.brn-btn.on{background:linear-gradient(135deg,rgba(56,189,248,.32),rgba(168,85,247,.28));color:#fff;border-color:rgba(56,189,248,.6);box-shadow:0 0 16px -4px rgba(56,189,248,.45)}
.brn-sel{padding:6px 26px 6px 10px;border-radius:9px;border:1px solid rgba(148,163,184,.22);background-color:rgba(15,23,42,.85);color:#f8fafc;font-size:12px;font-weight:600;cursor:pointer}
.brn-lobes{position:absolute;left:388px;bottom:16px;z-index:5;display:flex;gap:6px;flex-wrap:wrap;padding:7px 9px;max-width:calc(100% - 740px);transition:left .25s ease}
.brn-wrap.agent-min .brn-lobes{left:16px;max-width:calc(100% - 380px)}
@media(max-width:1100px){.brn-lobes{left:16px;max-width:calc(100% - 32px)}}
.brn-lobe{display:inline-flex;align-items:center;gap:6px;padding:5px 10px;border-radius:999px;border:1px solid rgba(148,163,184,.2);background:rgba(15,23,42,.75);color:#e2e8f0;font-size:11.5px;font-weight:600;cursor:pointer;transition:all .15s}
.brn-lobe:hover{transform:translateY(-1px);border-color:var(--lc,#38bdf8)}
.brn-lobe.on{background:color-mix(in srgb,var(--lc,#38bdf8) 26%,#0f172a);border-color:var(--lc,#38bdf8);box-shadow:0 0 14px -2px var(--lc,#38bdf8)}
.brn-dot{width:8px;height:8px;border-radius:50%;background:var(--lc,#38bdf8);box-shadow:0 0 8px var(--lc,#38bdf8)}
.brn-cnt{font-size:10.5px;color:#94a3b8;font-weight:500}

/* Left-Side Built-in Brain AI Agent Dock */
.brn-agent{position:absolute;top:76px;left:16px;bottom:16px;width:360px;max-width:calc(100vw - 32px);z-index:6;display:flex;flex-direction:column;overflow:hidden;transition:transform .28s cubic-bezier(.16,1,.3,1),opacity .22s ease}
.brn-agent.min{transform:translateX(-380px);opacity:0;pointer-events:none}
.brn-ag-hd{padding:11px 13px;border-bottom:1px solid rgba(148,163,184,.18);background:linear-gradient(90deg,rgba(56,189,248,.14),rgba(168,85,247,.1));display:flex;align-items:center;gap:9px}
.brn-ag-av{width:32px;height:32px;border-radius:10px;display:grid;place-items:center;font-size:16px;background:rgba(15,23,42,.85);border:1px solid rgba(56,189,248,.45);box-shadow:0 0 14px rgba(56,189,248,.25)}
.brn-ag-title{flex:1;min-width:0}
.brn-ag-title b{font-size:13.5px;display:block;color:#f8fafc}
.brn-ag-title span{font-size:10.5px;color:#94a3b8;display:block;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.brn-ag-hd button{background:rgba(30,41,59,.65);border:1px solid rgba(148,163,184,.2);color:#cbd5e1;border-radius:8px;padding:4px 8px;font-size:11.5px;font-weight:600;cursor:pointer}
.brn-ag-hd button:hover{border-color:#38bdf8;color:#fff;background:rgba(56,189,248,.2)}
.brn-ag-newbox{padding:10px 12px;border-bottom:1px solid rgba(148,163,184,.18);background:rgba(2,6,23,.65);display:none;flex-direction:column;gap:7px}
.brn-ag-newbox.on{display:flex}
.brn-ag-newbox input,.brn-ag-newbox textarea,.brn-ag-newbox select{width:100%;box-sizing:border-box;padding:6px 9px;border-radius:8px;border:1px solid rgba(148,163,184,.24);background:rgba(15,23,42,.9);color:#f8fafc;font:12px/1.45 inherit}
.brn-ag-log{flex:1;overflow:auto;padding:12px;display:flex;flex-direction:column;gap:8px;font-size:12.8px;line-height:1.5;scrollbar-width:thin}
.brn-msg{max-width:92%;padding:8px 11px;border-radius:13px;overflow-wrap:anywhere;white-space:pre-wrap;user-select:text;animation:brnMsgIn .2s ease-out both}
@keyframes brnMsgIn{from{opacity:0;transform:translateY(4px)}to{opacity:1;transform:none}}
.brn-msg.u{align-self:flex-end;background:linear-gradient(135deg,rgba(56,189,248,.32),rgba(99,102,241,.32));border:1px solid rgba(56,189,248,.45);color:#f8fafc;border-bottom-right-radius:4px}
.brn-msg.a{align-self:flex-start;background:rgba(15,23,42,.82);border:1px solid rgba(148,163,184,.18);color:#e2e8f0;border-bottom-left-radius:4px}
.brn-msg.s{align-self:center;font-size:11px;font-weight:600;color:#38bdf8;background:rgba(56,189,248,.12);border:1px solid rgba(56,189,248,.28);padding:3px 10px;border-radius:999px}
.brn-msg-chips{display:flex;flex-wrap:wrap;gap:5px;margin-top:6px}
.brn-msg-chip{font-size:11px;font-weight:600;padding:3px 9px;border-radius:999px;background:rgba(56,189,248,.16);border:1px solid rgba(56,189,248,.38);color:#38bdf8;cursor:pointer}
.brn-msg-chip:hover{background:rgba(56,189,248,.28);color:#fff}
.brn-ag-qs{display:flex;flex-wrap:wrap;gap:5px;padding:0 11px 7px}
.brn-ag-qs button{font-size:11px;padding:3px 8px;border-radius:999px;border:1px solid rgba(148,163,184,.2);background:rgba(15,23,42,.75);color:#cbd5e1;cursor:pointer;transition:all .15s}
.brn-ag-qs button:hover{border-color:#38bdf8;color:#fff;background:rgba(56,189,248,.16)}
.brn-ag-foot{display:flex;gap:6px;padding:9px 10px;border-top:1px solid rgba(148,163,184,.18);background:rgba(2,6,23,.55)}
.brn-ag-foot input{flex:1;min-width:0;padding:8px 11px;border-radius:10px;border:1px solid rgba(148,163,184,.24);background:rgba(15,23,42,.9);color:#f8fafc;font-size:12.5px;outline:none}
.brn-ag-foot input:focus{border-color:#38bdf8}
.brn-ag-send{padding:7px 13px;border-radius:10px;border:0;background:linear-gradient(135deg,#38bdf8,#818cf8);color:#fff;font-weight:700;font-size:12.5px;cursor:pointer}

/* Right-Side Neural Inspector Drawer */
.brn-insp{position:absolute;top:76px;right:16px;bottom:16px;width:336px;max-width:calc(100vw - 32px);z-index:6;display:flex;flex-direction:column;overflow:hidden;transform:translateX(365px);opacity:0;pointer-events:none;transition:transform .28s cubic-bezier(.16,1,.3,1),opacity .22s ease}
.brn-insp.on{transform:none;opacity:1;pointer-events:auto}
.brn-insp-hd{padding:13px 15px;border-bottom:1px solid rgba(148,163,184,.16);display:flex;align-items:flex-start;gap:10px}
.brn-insp-ic{width:38px;height:38px;border-radius:11px;display:grid;place-items:center;font-size:20px;flex:none;background:rgba(30,41,59,.8);border:1px solid rgba(148,163,184,.25)}
.brn-insp-meta{flex:1;min-width:0}
.brn-insp-meta b{font-size:14px;display:block;color:#f8fafc;overflow-wrap:anywhere;line-height:1.3}
.brn-insp-meta span{font-size:11px;color:#94a3b8;display:block;margin-top:2px}
.brn-insp-x{background:none;border:0;color:#94a3b8;cursor:pointer;font-size:16px;padding:2px 6px;border-radius:6px}
.brn-insp-x:hover{color:#fff;background:rgba(255,255,255,.08)}
.brn-insp-bd{flex:1;overflow:auto;padding:14px 15px;display:flex;flex-direction:column;gap:12px;font-size:12.5px}
.brn-path{font-family:Consolas,monospace;font-size:11px;padding:8px 10px;border-radius:9px;background:rgba(2,6,23,.65);border:1px solid rgba(148,163,184,.16);color:#94a3b8;overflow-wrap:anywhere;line-height:1.45;user-select:text}
.brn-kv{display:grid;grid-template-columns:1fr 1fr;gap:8px}
.brn-kv > div{padding:8px 10px;border-radius:9px;background:rgba(15,23,42,.65);border:1px solid rgba(148,163,184,.14)}
.brn-kv span{font-size:10.5px;color:#94a3b8;display:block}
.brn-kv b{font-size:12.5px;color:#f8fafc;display:block;margin-top:2px}
.brn-acts{display:grid;grid-template-columns:1fr 1fr;gap:7px}
.brn-act{padding:8px 10px;border-radius:9px;border:1px solid rgba(148,163,184,.22);background:rgba(30,41,59,.65);color:#f8fafc;font-size:12px;font-weight:600;cursor:pointer;text-align:center;transition:all .15s}
.brn-act:hover{border-color:#38bdf8;background:rgba(56,189,248,.2)}
.brn-act.pri{grid-column:1 / -1;background:linear-gradient(135deg,rgba(56,189,248,.35),rgba(168,85,247,.35));border-color:rgba(56,189,248,.55)}
.brn-pre{margin:0;padding:10px;border-radius:9px;background:rgba(2,6,23,.8);border:1px solid rgba(148,163,184,.16);color:#cbd5e1;font:11.5px/1.5 Consolas,monospace;max-height:190px;overflow:auto;white-space:pre-wrap;overflow-wrap:anywhere;user-select:text}
.brn-conns{display:flex;flex-direction:column;gap:5px}
.brn-conn{padding:6px 9px;border-radius:8px;background:rgba(15,23,42,.65);border:1px solid rgba(148,163,184,.14);cursor:pointer;display:flex;align-items:center;gap:7px;font-size:12px;color:#e2e8f0;transition:border-color .15s,background .15s}
.brn-conn:hover{border-color:#38bdf8;background:rgba(56,189,248,.14)}
.brn-conn small{margin-left:auto;font-size:10px;padding:1px 6px;border-radius:99px;background:rgba(148,163,184,.15);color:#94a3b8}
.brn-tip{position:absolute;z-index:10;pointer-events:none;padding:7px 11px;border-radius:10px;background:rgba(2,6,23,.9);border:1px solid rgba(56,189,248,.45);box-shadow:0 8px 24px rgba(0,0,0,.6);font-size:12px;color:#f8fafc;white-space:nowrap;display:none;transform:translate(-50%,-130%)}
`;
    document.head.appendChild(st);
  }

  let built = false, cv = null, ctx = null, raf = 0, agCtl = null;
  const S = {
    scope: 'all',
    customPath: '',
    maxNodes: 480,
    mode: 'cortex', // 'cortex' | 'galaxy' | 'helix'
    lobeFilter: '',
    query: '',
    autoOrbit: true,
    pulsesOn: true,
    labelsOn: true,
    agentOpen: true,
    agentBusy: false,
    agentLog: [],
    nodes: [],
    links: [],
    stats: null,
    selected: null,
    hovered: null,
    adj: new Map(),
    pulses: [],
    shockwaves: [],
    stars: [],
    corticalShell: [],
    // 3D Camera state
    yaw: -0.35,
    pitch: 0.22,
    vYaw: 0,
    vPitch: 0,
    zoom: 1.0,
    targetZoom: 1.0,
    panX: 0,
    panY: 0,
    camX: 0, camY: 0, camZ: 0,
    tx: 0, ty: 0, tz: 0
  };

  function hashStr(str) {
    let h = 2166136261 >>> 0;
    for (let i = 0; i < str.length; i++) {
      h ^= str.charCodeAt(i);
      h = Math.imul(h, 16777619);
    }
    return () => {
      h += h << 13; h ^= h >>> 7; h += h << 3; h ^= h >>> 17; h += h << 5;
      return (h >>> 0) / 4294967296;
    };
  }

  function initAtmosphere() {
    S.stars = [];
    for (let i = 0; i < 160; i++) {
      const u = Math.random() * Math.PI * 2, v = Math.acos(2 * Math.random() - 1);
      const r = 680 + Math.random() * 520;
      S.stars.push({
        x: r * Math.sin(v) * Math.cos(u),
        y: r * Math.cos(v),
        z: r * Math.sin(v) * Math.sin(u),
        a: 0.15 + Math.random() * 0.45,
        s: 0.7 + Math.random() * 1.4
      });
    }

    S.corticalShell = [];
    for (const hem of [-1, 1]) {
      const rings = 9, segs = 14;
      for (let i = 1; i < rings; i++) {
        const phi = (i / rings) * Math.PI;
        const pts = [];
        for (let j = 0; j <= segs; j++) {
          const theta = (j / segs) * Math.PI;
          const nx = Math.sin(phi) * Math.sin(theta) * hem;
          const ny = Math.cos(phi) * 0.78;
          const nz = Math.sin(phi) * Math.cos(theta) * 1.18;
          const gap = hem * 18;
          const gyri = 1 + 0.04 * Math.sin(phi * 6) * Math.cos(theta * 5);
          pts.push({ x: nx * 295 * gyri + gap, y: ny * 265 * gyri, z: nz * 295 * gyri });
        }
        S.corticalShell.push(pts);
      }
    }
  }

  function computeLayouts() {
    const N = S.nodes.length || 1;
    const folderMap = new Map();
    const folders = S.nodes.filter(n => n.isDir);

    folders.forEach((f, idx) => {
      const rng = hashStr(f.id);
      if (f.cat === 'core') {
        f.posCortex = [0, 0, 0];
        f.posGalaxy = [0, 0, 0];
        f.posHelix = [0, -240, 0];
      } else {
        const hem = idx % 2 === 0 ? -1 : 1;
        const ang = (idx / Math.max(1, folders.length)) * Math.PI * 2;
        f.posCortex = [
          hem * (55 + Math.abs(Math.cos(ang)) * 165) + (rng() - 0.5) * 40,
          Math.sin(ang * 1.7) * 125,
          Math.sin(ang) * 195
        ];
        const gRad = 150 + (f.depth || 1) * 68;
        f.posGalaxy = [
          Math.cos(ang) * gRad,
          (rng() - 0.5) * 160,
          Math.sin(ang) * gRad
        ];
        f.posHelix = [
          Math.cos(ang) * 90,
          -220 + (idx / Math.max(1, folders.length)) * 440,
          Math.sin(ang) * 90
        ];
      }
      folderMap.set(f.id, f);
    });

    const parentOf = new Map();
    S.links.forEach(l => {
      if (l.kind === 'tree') parentOf.set(l.target, l.source);
    });

    const sortedByTime = S.nodes.slice().sort((a, b) => (b.mtime || 0) - (a.mtime || 0));
    const timeRank = new Map();
    sortedByTime.forEach((n, i) => timeRank.set(n.id, i));

    S.nodes.forEach((n, i) => {
      const rng = hashStr(n.id);
      const lobe = LOBES[n.cat] || LOBES.data;
      const pId = parentOf.get(n.id);
      const pNode = pId ? folderMap.get(pId) : null;

      if (!n.isDir) {
        const lc = lobe.lobeCenter || [0, 0, 0];
        const u = rng() * Math.PI * 2;
        const v = Math.acos(2 * rng() - 1);
        const rShell = 185 + rng() * 95;
        let bx = lc[0] * 260 + Math.sin(v) * Math.cos(u) * rShell * 0.55;
        let by = lc[1] * 220 + Math.cos(v) * rShell * 0.48;
        let bz = lc[2] * 280 + Math.sin(v) * Math.sin(u) * rShell * 0.62;
        if (pNode && pNode.posCortex) {
          bx = bx * 0.62 + pNode.posCortex[0] * 0.38;
          by = by * 0.62 + pNode.posCortex[1] * 0.38;
          bz = bz * 0.62 + pNode.posCortex[2] * 0.38;
        }
        if (Math.abs(bx) < 16) bx = (bx < 0 ? -1 : 1) * (16 + rng() * 14);
        n.posCortex = [bx, by, bz];

        const base = (pNode && pNode.posGalaxy) ? pNode.posGalaxy : [0, 0, 0];
        const orbR = 34 + rng() * 78;
        const oa = rng() * Math.PI * 2, ob = (rng() - 0.5) * Math.PI;
        n.posGalaxy = [
          base[0] + Math.cos(oa) * Math.cos(ob) * orbR,
          base[1] + Math.sin(ob) * orbR * 0.85,
          base[2] + Math.sin(oa) * Math.cos(ob) * orbR
        ];

        const rank = timeRank.get(n.id) || i;
        const tNorm = rank / Math.max(1, N - 1);
        const strand = i % 2 === 0 ? 0 : Math.PI;
        const hAngle = tNorm * Math.PI * 8 + strand;
        const hRad = 155 + (rng() - 0.5) * 32;
        n.posHelix = [
          Math.cos(hAngle) * hRad,
          (tNorm - 0.5) * 520,
          Math.sin(hAngle) * hRad
        ];
      }

      const target = S.mode === 'galaxy' ? n.posGalaxy : S.mode === 'helix' ? n.posHelix : n.posCortex;
      if (n.x === undefined) {
        n.x = (rng() - 0.5) * 60;
        n.y = (rng() - 0.5) * 60;
        n.z = (rng() - 0.5) * 60;
      }
      n.tx = target[0];
      n.ty = target[1];
      n.tz = target[2];
    });
  }

  function applyModeTargets() {
    S.nodes.forEach(n => {
      const target = S.mode === 'galaxy' ? n.posGalaxy : S.mode === 'helix' ? n.posHelix : n.posCortex;
      if (target) { n.tx = target[0]; n.ty = target[1]; n.tz = target[2]; }
    });
  }

  function spawnPulse(link, fast) {
    if (S.pulses.length > 110) return;
    S.pulses.push({
      source: link.sourceNode,
      target: link.targetNode,
      t: 0,
      speed: (fast ? 0.028 : 0.011) + Math.random() * 0.012,
      col: link.kind === 'semantic' ? '#f59e0b' : link.kind === 'temporal' ? '#a855f7' : (LOBES[link.targetNode.cat]?.col || '#38bdf8')
    });
  }

  function fireBurstFrom(node) {
    if (!node) return;
    const myLinks = S.links.filter(l => l.sourceNode === node || l.targetNode === node);
    myLinks.slice(0, 32).forEach(l => {
      S.pulses.push({
        source: node,
        target: l.sourceNode === node ? l.targetNode : l.sourceNode,
        t: 0,
        speed: 0.026 + Math.random() * 0.015,
        col: '#facc15'
      });
    });
  }

  function rebuildAdjacency() {
    const byId = new Map();
    S.nodes.forEach(n => { n.deg = 0; byId.set(n.id, n); });
    S.links = S.links.map(l => {
      const s = l.sourceNode || byId.get(l.source);
      const t = l.targetNode || byId.get(l.target);
      if (!s || !t) return null;
      s.deg++; t.deg++;
      return Object.assign({}, l, { source: s.id, target: t.id, sourceNode: s, targetNode: t });
    }).filter(Boolean);

    S.adj = new Map();
    S.nodes.forEach(n => S.adj.set(n.id, []));
    S.links.forEach(l => {
      S.adj.get(l.sourceNode.id).push({ node: l.targetNode, kind: l.kind, label: l.label });
      S.adj.get(l.targetNode.id).push({ node: l.sourceNode, kind: l.kind, label: l.label });
    });
  }

  /* Live Neurogenesis: inject a newly created/updated file directly into the 3D Brain with shockwave + camera fly-to */
  function spawnLiveFileNode(res) {
    if (!res || !res.node) return null;
    const fNode = res.folderNode;
    const newNode = res.node;

    // 1. Ensure parent folder nucleus exists in the graph
    let parent = S.nodes.find(x => x.id === (fNode && fNode.id));
    if (!parent && fNode) {
      parent = Object.assign({}, fNode, { x: 0, y: 0, z: 0, deg: 1 });
      S.nodes.push(parent);
      const core = S.nodes.find(x => x.cat === 'core') || S.nodes[0];
      if (core) S.links.push({ source: core.id, target: parent.id, kind: 'tree', weight: 1.4 });
      if (S.stats) {
        S.stats.totalFolders = (S.stats.totalFolders || 0) + 1;
        S.stats.byCat.folder = (S.stats.byCat.folder || 0) + 1;
      }
    }

    // 2. Check if file neuron already exists or is brand new
    let existing = S.nodes.find(x => x.id === newNode.id);
    if (!existing) {
      existing = Object.assign({}, newNode, {
        x: parent ? parent.x : 0,
        y: parent ? parent.y : 0,
        z: parent ? parent.z : 0,
        _bornAt: performance.now(),
        deg: 1
      });
      S.nodes.push(existing);
      if (parent) {
        S.links.push({ source: parent.id, target: existing.id, kind: 'tree', weight: 1.1 });
      }
      // Also wire semantic synapses to any existing file sharing stem words
      const stemWords = existing.name.replace(/\.[^.]+$/, '').toLowerCase().split(/[^a-z0-9]+/).filter(w => w.length >= 4);
      S.nodes.forEach(other => {
        if (other === existing || other.isDir) return;
        const oname = other.name.toLowerCase();
        const shared = stemWords.find(w => oname.includes(w));
        if (shared) {
          S.links.push({ source: existing.id, target: other.id, kind: 'semantic', label: shared, weight: 0.8 });
        }
      });
      if (S.stats) {
        S.stats.totalFiles = (S.stats.totalFiles || 0) + 1;
        S.stats.totalBytes = (S.stats.totalBytes || 0) + (existing.size || 0);
        S.stats.byCat[existing.cat] = (S.stats.byCat[existing.cat] || 0) + 1;
      }
    } else {
      existing.size = newNode.size;
      existing.mtime = newNode.mtime;
      existing._bornAt = performance.now();
    }

    rebuildAdjacency();
    computeLayouts();
    paintLobeBar();
    updateStatsSubtitle();

    // Add a 3D expanding shockwave ring at the new neuron's target position
    S.shockwaves.push({ node: existing, r: 4, maxR: 95, alpha: 1.0, col: '#facc15' });
    selectNode(existing);
    return existing;
  }

  function updateStatsSubtitle() {
    const stEl = root.querySelector('#brn-sub');
    if (stEl && S.stats) {
      stEl.textContent = (S.stats.totalFiles || 0).toLocaleString() + ' files · ' +
        (S.stats.totalFolders || 0).toLocaleString() + ' folder nuclei · ' +
        S.links.length.toLocaleString() + ' synapses · ' +
        fmtBytes(S.stats.totalBytes || 0);
    }
  }

  async function loadGraph() {
    const stEl = root.querySelector('#brn-sub');
    if (stEl) stEl.textContent = 'Scanning PC neural pathways...';
    try {
      const r = await A.api('/api/brain/graph', {
        scope: S.scope,
        path: S.customPath,
        maxNodes: S.maxNodes
      });
      if (!r || !r.nodes) return;
      S.nodes = r.nodes;
      S.stats = r.stats || {};
      S.links = r.links || [];
      rebuildAdjacency();
      computeLayouts();
      paintLobeBar();
      updateStatsSubtitle();
    } catch (e) {
      if (stEl) stEl.textContent = 'Could not scan files: ' + (e.message || e);
    }
  }

  function paintLobeBar() {
    const bar = root.querySelector('#brn-lobes');
    if (!bar || !S.stats) return;
    const byCat = S.stats.byCat || {};
    const keys = ['code', 'docs', 'images', 'audio', 'video', 'data', 'folder'];
    bar.innerHTML =
      '<button type="button" class="brn-lobe' + (!S.lobeFilter ? ' on' : '') + '" data-l="" style="--lc:#38bdf8">' +
        '<span class="brn-dot"></span><span>All Lobes</span><span class="brn-cnt">' + S.nodes.length + '</span>' +
      '</button>' +
      keys.map(k => {
        const lb = LOBES[k];
        const cnt = byCat[k] || 0;
        return '<button type="button" class="brn-lobe' + (S.lobeFilter === k ? ' on' : '') + '" data-l="' + k + '" style="--lc:' + lb.col + '">' +
          '<span class="brn-dot"></span><span>' + lb.icon + ' ' + esc(lb.label) + '</span><span class="brn-cnt">' + cnt + '</span>' +
        '</button>';
      }).join('');
  }

  async function selectNode(n) {
    S.selected = n;
    const insp = root.querySelector('#brn-insp');
    if (!n) {
      if (insp) insp.classList.remove('on');
      return;
    }
    S.tx = n.tx !== undefined ? n.tx : n.x;
    S.ty = n.ty !== undefined ? n.ty : n.y;
    S.tz = n.tz !== undefined ? n.tz : n.z;
    S.targetZoom = Math.max(S.targetZoom, 1.35);
    S.autoOrbit = false;
    const orbBtn = root.querySelector('#brn-orbit');
    if (orbBtn) orbBtn.classList.remove('on');
    fireBurstFrom(n);

    if (!insp) return;
    insp.classList.add('on');
    const lb = LOBES[n.cat] || LOBES.data;
    const neighbors = (S.adj.get(n.id) || []).slice(0, 18);

    insp.querySelector('#brn-i-ic').textContent = lb.icon;
    insp.querySelector('#brn-i-ic').style.borderColor = lb.col;
    insp.querySelector('#brn-i-name').textContent = n.name;
    insp.querySelector('#brn-i-sub').textContent = lb.label + (n.rootLabel ? ' · ' + n.rootLabel : '');
    insp.querySelector('#brn-i-path').textContent = n.path || '';
    insp.querySelector('#brn-i-size').textContent = n.isDir ? (neighbors.length + ' linked items') : fmtBytes(n.size);
    insp.querySelector('#brn-i-date').textContent = n.mtime ? new Date(n.mtime).toLocaleDateString([], { year: 'numeric', month: 'short', day: 'numeric' }) : '—';
    insp.querySelector('#brn-i-deg').textContent = neighbors.length + ' synapses';
    insp.querySelector('#brn-i-ext').textContent = n.isDir ? 'Directory Nucleus' : (n.ext || 'file');

    const drillBtn = insp.querySelector('#brn-i-drill');
    if (drillBtn) drillBtn.style.display = n.isDir && n.cat !== 'core' ? '' : 'none';

    const connBox = insp.querySelector('#brn-i-conns');
    connBox.innerHTML = neighbors.length
      ? neighbors.map(nb => {
          const nlb = LOBES[nb.node.cat] || LOBES.data;
          const kindTag = nb.kind === 'semantic' ? ('topic: ' + (nb.label || 'shared')) : nb.kind === 'temporal' ? 'co-edited' : (nb.node.isDir ? 'folder' : 'in folder');
          return '<div class="brn-conn" data-nid="' + esc(nb.node.id) + '">' +
            '<span>' + nlb.icon + '</span>' +
            '<span style="overflow:hidden;text-overflow:ellipsis;white-space:nowrap">' + esc(nb.node.name) + '</span>' +
            '<small>' + esc(kindTag) + '</small>' +
          '</div>';
        }).join('')
      : '<div class="small mute">No direct synapses.</div>';

    const preBox = insp.querySelector('#brn-i-prewrap');
    const preEl = insp.querySelector('#brn-i-pre');
    preBox.style.display = 'none';
    if (n.path && n.cat !== 'core') {
      const info = await A.api('/api/brain/inspect', { path: n.path }).catch(() => null);
      if (info && S.selected === n) {
        if (info.preview) {
          preBox.style.display = 'block';
          preEl.textContent = info.preview;
        } else if (info.children && info.children.length) {
          preBox.style.display = 'block';
          preEl.textContent = 'Folder contents (' + info.children.length + '):\n• ' + info.children.join('\n• ');
        }
      }
    }
  }

  /* ---------- Built-in Local AI Brain Agent ---------- */
  function addAgentMsg(role, text, chips) {
    const log = root.querySelector('#brn-ag-log');
    if (!log) return null;
    const d = document.createElement('div');
    d.className = 'brn-msg ' + role;
    d.textContent = text;
    if (chips && chips.length) {
      const cb = document.createElement('div');
      cb.className = 'brn-msg-chips';
      chips.forEach(c => {
        const b = document.createElement('button');
        b.type = 'button';
        b.className = 'brn-msg-chip';
        b.textContent = c.label;
        b.onclick = c.run;
        cb.appendChild(b);
      });
      d.appendChild(cb);
    }
    log.appendChild(d);
    log.scrollTop = log.scrollHeight;
    if (role !== 's') {
      S.agentLog.push({ role: role === 'u' ? 'user' : 'assistant', content: text });
      if (S.agentLog.length > 20) S.agentLog.splice(0, S.agentLog.length - 20);
    }
    return d;
  }

  async function generateFileContentWithAI(filename, topicOrSpec) {
    const ext = (filename.match(/\.[^.]+$/) || ['.md'])[0].toLowerCase();
    const sys = 'You write complete, high-quality file contents for the user\'s file "' + filename + '". Reply with ONLY the raw file contents (no markdown code fences wrapping the whole reply unless the file itself is markdown, and no conversational intro/outro).';
    const prompt = 'Write the full contents for "' + filename + '" (' + (topicOrSpec || 'a useful starter template and notes') + ').';
    let out = '';
    try {
      if (A.ai && A.ai.stream) {
        out = await A.ai.stream([{ role: 'system', content: sys }, { role: 'user', content: prompt }], () => {}, null, { temp: 0.4 });
      }
    } catch (e) { }
    out = String(out || '').replace(/^```[a-z]*\n/i, '').replace(/\n```\s*$/i, '').trim();
    if (!out) {
      if (ext === '.py') out = '# ' + filename + ' — ' + (topicOrSpec || 'Python script') + '\n\ndef main():\n    print(' + JSON.stringify('Running ' + filename + ': ' + (topicOrSpec || 'ready')) + ')\n\nif __name__ == "__main__":\n    main()\n';
      else if (ext === '.js') out = '// ' + filename + ' — ' + (topicOrSpec || 'JavaScript module') + '\n(() => {\n  console.log(' + JSON.stringify(filename + ': ' + (topicOrSpec || 'initialized')) + ');\n})();\n';
      else if (ext === '.json') out = JSON.stringify({ title: filename, topic: topicOrSpec || 'Notes', createdAt: new Date().toISOString(), items: [] }, null, 2);
      else if (ext === '.csv') out = 'Category,Item,Value,Notes\nGeneral,' + (topicOrSpec || 'Sample') + ',100,Created in 3D File Brain\n';
      else out = '# ' + filename.replace(/\.[^.]+$/, '') + '\n\n' + (topicOrSpec ? '**Topic:** ' + topicOrSpec + '\n\n' : '') + '## Overview\nCreated inside the Moundshroud 3D File Brain on ' + new Date().toLocaleString() + '.\n\n## Key Points\n- ' + (topicOrSpec || 'Add your notes and details here.') + '\n';
    }
    return out;
  }

  async function createAndPopulateFile(filename, folderHint, contentOrTopic, isRawContent) {
    const stMsg = addAgentMsg('s', '⚡ Synthesizing & spawning "' + filename + '" in 3D Brain...');
    const targetFolder = folderHint || (S.selected && S.selected.isDir && S.selected.cat !== 'core' ? S.selected.path : (S.customPath || 'Documents'));
    const bodyText = isRawContent ? contentOrTopic : await generateFileContentWithAI(filename, contentOrTopic);
    const res = await A.api('/api/brain/write', {
      name: filename,
      folder: targetFolder,
      content: bodyText
    });
    if (stMsg) stMsg.remove();
    if (!res || res.error) {
      return addAgentMsg('a', 'I could not create that file: ' + ((res && res.error) || 'unknown error'));
    }
    const spawned = spawnLiveFileNode(res);
    addAgentMsg(
      'a',
      'Created "' + res.node.name + '" (' + fmtBytes(res.node.size) + ') in ' + res.folderNode.name + ' and spawned its live neuron in the ' + (LOBES[res.node.cat]?.label || 'Brain') + '!',
      [
        { label: '🎯 Focus in 3D', run: () => selectNode(spawned) },
        { label: '📂 Show in Explorer', run: () => A.api('/api/brain/reveal', { path: res.path, open: false }) },
        { label: '🚀 Open File', run: () => A.api('/api/brain/reveal', { path: res.path, open: true }) }
      ]
    );
  }

  async function handleAgentCommand(raw) {
    const text = raw.trim();
    if (!text) return;
    const t = text.toLowerCase();
    let m;

    // 1. Direct file creation / addition commands:
    // e.g. "create a file called roadmap.md about Q4 goals", "add a file test.py with a fibonacci script", "make a note ideas.md in Desktop: ..."
    const createRx = /^(?:(?:hey|ok|okay|please|can you|could you)\s+)*(?:create|add|make|write|build|generate|new|spawn)\s+(?:a\s+)?(?:new\s+)?(?:file|script|note|document|markdown|code|json|csv|page)?\s*(?:called|named|titled)?\s*["'`]?([a-z0-9_.\-]+\.[a-z0-9]{1,6})["'`]?\s*(?:(?:in|into|on|under|inside)\s+(desktop|documents|downloads|notes|workspace))?\s*(?:(?:with|about|containing|for|that|saying|:)\s*(.*))?$/i;
    if ((m = createRx.exec(text))) {
      const fname = m[1].trim();
      const folder = (m[2] || '').trim();
      const spec = (m[3] || '').trim();
      await createAndPopulateFile(fname, folder, spec || ('Content for ' + fname), false);
      return;
    }

    // Also support natural phrasing without an explicit file extension:
    // e.g. "add a file about solar panels", "create a python file for sorting", "make a note about groceries"
    const naturalCreateRx = /^(?:(?:hey|ok|okay|please|can you|could you)\s+)*(?:create|add|make|write|spawn)\s+(?:a\s+)?(?:new\s+)?(python|javascript|js|markdown|md|text|txt|json|csv|html)?\s*(?:file|script|note|doc|neuron)\s+(?:called\s+["'`]?([a-z0-9_\- ]+?)["'`]?\s+)?(?:(?:in|on)\s+(desktop|documents|downloads|notes|workspace)\s+)?(?:about|with|for|containing|saying|:)\s+(.+)$/i;
    if ((m = naturalCreateRx.exec(text))) {
      const lang = (m[1] || 'md').toLowerCase();
      const extMap = { python: '.py', javascript: '.js', js: '.js', markdown: '.md', md: '.md', text: '.txt', txt: '.txt', json: '.json', csv: '.csv', html: '.html' };
      const ext = extMap[lang] || '.md';
      const topic = m[4].trim();
      const rawSlug = (m[2] || topic.split(/\s+/).slice(0, 3).join('-')).toLowerCase().replace(/[^a-z0-9\-]+/g, '-').replace(/^-|-$/g, '').slice(0, 32) || ('brain-file-' + Date.now().toString(36));
      const fname = rawSlug.includes('.') ? rawSlug : (rawSlug + ext);
      const folder = (m[3] || '').trim();
      await createAndPopulateFile(fname, folder, topic, false);
      return;
    }

    // 2. Append / Edit the currently selected file in the 3D Brain
    if (S.selected && !S.selected.isDir && /^(?:append|add to this file|update this file|write into this file)\b/i.test(text)) {
      const extra = text.replace(/^(?:append|add to this file|update this file|write into this file)[:\s]*/i, '').trim();
      const addContent = await generateFileContentWithAI(S.selected.name, extra || text);
      const res = await A.api('/api/brain/write', { name: S.selected.path, folder: S.selected.path, content: addContent, append: true });
      if (res && res.ok) {
        spawnLiveFileNode(res);
        addAgentMsg('a', 'Updated "' + S.selected.name + '" and refreshed its neuron in the 3D Brain!');
        return;
      }
    }

    // 3. 3D Brain View, Topology, Filter & Camera Commands
    if (/\b(galaxy|constellation|star cluster)\b/.test(t) && /\b(view|mode|switch|show|morph|layout)\b/.test(t)) {
      S.mode = 'galaxy'; applyModeTargets();
      root.querySelectorAll('#brn-modes .brn-btn').forEach(x => x.classList.toggle('on', x.dataset.m === 'galaxy'));
      addAgentMsg('a', 'Morphed the 3D Brain into **🌌 Orbital Galaxy** topology!');
      return;
    }
    if (/\b(helix|dna|chronos|time|timeline)\b/.test(t) && /\b(view|mode|switch|show|morph|layout)\b/.test(t)) {
      S.mode = 'helix'; applyModeTargets();
      root.querySelectorAll('#brn-modes .brn-btn').forEach(x => x.classList.toggle('on', x.dataset.m === 'helix'));
      addAgentMsg('a', 'Morphed the 3D Brain into **🧬 Chronos Double-Helix** topology (newest files at the top, oldest at the base)!');
      return;
    }
    if (/\b(cortex|brain|hemisphere)\b/.test(t) && /\b(view|mode|switch|show|morph|layout)\b/.test(t)) {
      S.mode = 'cortex'; applyModeTargets();
      root.querySelectorAll('#brn-modes .brn-btn').forEach(x => x.classList.toggle('on', x.dataset.m === 'cortex'));
      addAgentMsg('a', 'Morphed into **🧠 Bi-Hemispheric Brain Cortex** topology!');
      return;
    }

    // Filter by lobe
    const lobeMap = { code: 'code', script: 'code', python: 'code', javascript: 'code', doc: 'docs', document: 'docs', pdf: 'docs', note: 'docs', image: 'images', photo: 'images', picture: 'images', audio: 'audio', music: 'audio', song: 'audio', video: 'video', movie: 'video', folder: 'folder', directory: 'folder' };
    if (/\b(show only|filter to|isolate|highlight all)\s+([a-z]+)/i.exec(text)) {
      const w = RegExp.$2.toLowerCase().replace(/s$/, '');
      if (lobeMap[w]) {
        S.lobeFilter = lobeMap[w];
        paintLobeBar();
        addAgentMsg('a', 'Isolated the **' + LOBES[S.lobeFilter].label + '** lobe in 3D! Click "All Lobes" or say "show all files" to restore.', [
          { label: 'Show All Lobes', run: () => { S.lobeFilter = ''; paintLobeBar(); } }
        ]);
        return;
      }
    }
    if (/\b(show all files|show all lobes|clear filter|reset filter|reset view)\b/.test(t)) {
      S.lobeFilter = ''; S.query = '';
      const qIn = root.querySelector('#brn-q'); if (qIn) qIn.value = '';
      paintLobeBar();
      root.querySelector('#brn-reset').click();
      addAgentMsg('a', 'Reset the 3D Brain filters and camera view.');
      return;
    }

    // Scan specific PC scope
    if (/\b(scan|map|load|show)\s+(?:my\s+)?(desktop|documents|downloads|workspace|full pc|all files)\b/i.exec(text)) {
      const target = RegExp.$2.toLowerCase();
      if (target === 'workspace') { S.scope = 'workspace'; root.querySelector('#brn-scope').value = 'workspace'; }
      else if (target === 'full pc' || target === 'all files') { S.scope = 'all'; root.querySelector('#brn-scope').value = 'all'; }
      else { S.scope = 'user'; root.querySelector('#brn-scope').value = 'user'; }
      await loadGraph();
      addAgentMsg('a', 'Scanned **' + target + '** into the 3D Brain (' + S.nodes.length + ' neurons, ' + S.links.length + ' synapses)!');
      return;
    }

    // Find / Fly to biggest, newest, or named file in the 3D Brain
    if (/\b(biggest|largest|heaviest)\s+file\b/.test(t)) {
      const files = S.nodes.filter(n => !n.isDir).sort((a, b) => (b.size || 0) - (a.size || 0));
      if (files[0]) {
        selectNode(files[0]);
        addAgentMsg('a', 'Flew to your largest file in the current 3D Brain: **' + files[0].name + '** (' + fmtBytes(files[0].size) + ').');
        return;
      }
    }
    if (/\b(newest|latest|most recent)\s+file\b/.test(t)) {
      const files = S.nodes.filter(n => !n.isDir).sort((a, b) => (b.mtime || 0) - (a.mtime || 0));
      if (files[0]) {
        selectNode(files[0]);
        addAgentMsg('a', 'Flew to your most recently modified file: **' + files[0].name + '** (' + new Date(files[0].mtime).toLocaleString() + ').');
        return;
      }
    }
    if ((m = /^(?:(?:find|locate|fly to|zoom to|focus on|inspect|where is)\s+)(?:the\s+|my\s+)?(?:file\s+|folder\s+)?["'`]?([a-z0-9_.\- ]+)["'`]?$/i.exec(text))) {
      const q = m[1].trim().toLowerCase();
      const hit = S.nodes.find(n => n.name.toLowerCase() === q) || S.nodes.find(n => n.name.toLowerCase().includes(q));
      if (hit) {
        selectNode(hit);
        addAgentMsg('a', 'Locked 3D camera onto **' + hit.name + '** (' + (hit.isDir ? 'Folder Nucleus' : fmtBytes(hit.size)) + ')!', [
          { label: '📂 Show in Explorer', run: () => A.api('/api/brain/reveal', { path: hit.path, open: false }) },
          { label: '🚀 Open', run: () => A.api('/api/brain/reveal', { path: hit.path, open: true }) }
        ]);
        return;
      }
    }

    // 4. Workspace Navigation & Companion Physical Commands
    if (A.buddy && A.buddy.isDirectPhysical && A.buddy.isDirectPhysical(text)) {
      const bRes = await A.buddy.tryPhysicalCommand(text);
      if (bRes) { addAgentMsg('a', bRes); return; }
    }
    if ((m = /^(?:(?:hey|ok|okay|please|can you)\s+)*(?:open|go to|take me to|switch to|launch)\s+(?:the\s+)?(.+?)$/i.exec(text))) {
      const dest = m[1].trim();
      if (A.buddy && A.buddy.openTab) {
        const tabRes = await A.buddy.openTab(dest);
        if (tabRes) { addAgentMsg('a', tabRes); return; }
      }
    }

    // 5. Run App-Wide Tools (`A.actions`) if actionable (quizzes, reminders, notes, documents, library search, etc.)
    try {
      if (A.actions && A.actions.looksActionable(text)) {
        const model = (document.getElementById('model') && document.getElementById('model').value) || '';
        const msgs = [{ role: 'system', content: 'You are the Moundshroud 3D Brain AI Agent.' + A.actions.hint }].concat(S.agentLog.slice(-6), [{ role: 'user', content: text }]);
        const r = await fetch('/api/chat', { method: 'POST', body: JSON.stringify({ model, stream: false, think: false, keep_alive: '5m', tools: A.actions.schema, messages: msgs }) });
        if (r.ok) {
          const j = await r.json(), calls = (j.message && j.message.tool_calls) || [];
          if (calls.length) {
            const out = [];
            for (const c of calls.slice(0, 2)) {
              try { out.push(await A.actions.run(c.function.name, c.function.arguments)); }
              catch (e) { out.push('Could not run tool: ' + e.message); }
            }
            addAgentMsg('a', out.join('\n'));
            return;
          }
        }
      }
    } catch (e) { }

    // 6. Grounded Local AI Agent Reply (with full context of the 3D Brain, selected file preview, and workspace map!)
    const selCtx = S.selected
      ? '\nCurrently selected 3D Brain neuron: "' + S.selected.name + '" (path: ' + S.selected.path + ', type: ' + (S.selected.isDir ? 'Folder' : S.selected.ext) + ', size: ' + fmtBytes(S.selected.size) + ').\nPreview:\n' + (root.querySelector('#brn-i-pre')?.textContent || '(no text preview)').slice(0, 1600)
      : '';
    const brainSummary = '\n3D File Brain status: ' + S.nodes.length + ' neurons mapped (' + (S.stats ? S.stats.totalFiles : 0) + ' files, ' + (S.stats ? S.stats.totalFolders : 0) + ' folders, ' + S.links.length + ' synapses). Top files in view: ' + S.nodes.filter(n => !n.isDir).slice(0, 18).map(n => n.name).join(', ') + '.';
    const mapSummary = '\nMoundshroud Workspace Guide: You can help the user navigate anywhere in Moundshroud (Today, Chat, 3D Brain, Browser, Calendar, Office > Library/My Files/Notes/Documents/Calculator, Education > Study/Languages/Writing/Practice/Teach me, Studio > Pixel Art/Sketchpad/Music/Model Lab/Model Forge/Game Studio Godot/Storybook/AI Hotbox, Cyber > Course/Coding/Toolkit/ARTEX/Passwords, Entertainment > Games/Chess/Music/Radio/TV/Photos, Settings). You can also create files directly in the 3D Brain when the user says "create a file called <name> about <topic>".';

    const sys = 'You are the Moundshroud 3D Brain AI Agent, embedded directly inside the interactive 3D File Brain tab. Be concise, warm, and practical (2 to 5 sentences). Answer using the real 3D Brain file data and workspace context below.' + brainSummary + selCtx + mapSummary;

    const msgEl = addAgentMsg('a', 'Thinking...');
    if (agCtl) agCtl.abort();
    agCtl = new AbortController();
    let reply = '';
    try {
      reply = await A.ai.stream(
        [{ role: 'system', content: sys }].concat(S.agentLog.slice(-8), [{ role: 'user', content: text }]),
        tok => { msgEl.textContent = tok.replace(/\*\*/g, ''); const log = root.querySelector('#brn-ag-log'); if (log) log.scrollTop = log.scrollHeight; },
        agCtl.signal,
        { temp: 0.4 }
      );
    } catch (e) {
      if (e.name === 'AbortError') { msgEl.remove(); return; }
    }
    reply = String(reply || '').replace(/\*\*/g, '').trim();
    if (!reply) {
      reply = 'I am ready here in the 3D Brain! You can tell me to:\n• "Create a file called notes.md about local AI"\n• "Find server.js" or "Fly to my biggest file"\n• "Switch to Galaxy view" or "Filter to code"\n• Or ask me to open any tab or tool in Moundshroud!';
    }
    msgEl.textContent = reply;
    S.agentLog.push({ role: 'assistant', content: reply });
  }

  /* 3D Projection & Render Loop */
  function project3D(x, y, z, W, H, cosY, sinY, cosP, sinP, fov) {
    const dx = x - S.camX, dy = y - S.camY, dz = z - S.camZ;
    const rx = dx * cosY - dz * sinY;
    const rz1 = dx * sinY + dz * cosY;
    const ry = dy * cosP - rz1 * sinP;
    const rz = dy * sinP + rz1 * cosP;
    const depth = rz + 680 / S.zoom;
    if (depth < 40) return null;
    const scale = fov / depth;
    return {
      sx: W * 0.5 + rx * scale + S.panX,
      sy: H * 0.5 + ry * scale + S.panY,
      depth,
      scale
    };
  }

  function drawFrame() {
    raf = requestAnimationFrame(drawFrame);
    if (!cv || !ctx || A.cur !== 'brain' || document.hidden) return;

    const dpr = window.devicePixelRatio || 1;
    const cw = cv.clientWidth || 960, ch = cv.clientHeight || 640;
    if (cv.width !== Math.round(cw * dpr) || cv.height !== Math.round(ch * dpr)) {
      cv.width = Math.round(cw * dpr);
      cv.height = Math.round(ch * dpr);
    }
    ctx.save();
    ctx.scale(dpr, dpr);
    ctx.clearRect(0, 0, cw, ch);

    if (S.autoOrbit) S.yaw += 0.0026;
    S.yaw += S.vYaw; S.pitch = Math.max(-1.35, Math.min(1.35, S.pitch + S.vPitch));
    S.vYaw *= 0.91; S.vPitch *= 0.91;
    S.zoom += (S.targetZoom - S.zoom) * 0.12;
    S.camX += (S.tx - S.camX) * 0.09;
    S.camY += (S.ty - S.camY) * 0.09;
    S.camZ += (S.tz - S.camZ) * 0.09;

    const cosY = Math.cos(S.yaw), sinY = Math.sin(S.yaw);
    const cosP = Math.cos(S.pitch), sinP = Math.sin(S.pitch);
    const fov = Math.min(cw, ch) * 0.82;
    const now = performance.now();

    // 1. Deep-space starfield
    for (const st of S.stars) {
      const p = project3D(st.x, st.y, st.z, cw, ch, cosY, sinY, cosP, sinP, fov);
      if (!p) continue;
      ctx.fillStyle = 'rgba(186,230,253,' + st.a.toFixed(2) + ')';
      ctx.beginPath();
      ctx.arc(p.sx, p.sy, st.s, 0, Math.PI * 2);
      ctx.fill();
    }

    // 2. Cortical wireframe shell in Cortex mode
    if (S.mode === 'cortex') {
      ctx.strokeStyle = 'rgba(56, 189, 248, 0.055)';
      ctx.lineWidth = 1;
      for (const ring of S.corticalShell) {
        ctx.beginPath();
        let started = false;
        for (const pt of ring) {
          const p = project3D(pt.x, pt.y, pt.z, cw, ch, cosY, sinY, cosP, sinP, fov);
          if (!p) continue;
          if (!started) { ctx.moveTo(p.sx, p.sy); started = true; }
          else ctx.lineTo(p.sx, p.sy);
        }
        ctx.stroke();
      }
    }

    const qLow = S.query.toLowerCase();
    const selNode = S.selected || S.hovered;
    const selNeighbors = new Set();
    if (selNode) {
      selNeighbors.add(selNode.id);
      (S.adj.get(selNode.id) || []).forEach(nb => selNeighbors.add(nb.node.id));
    }

    // 3. Project nodes
    const projNodes = [];
    for (const n of S.nodes) {
      n.x += (n.tx - n.x) * 0.085;
      n.y += (n.ty - n.y) * 0.085;
      n.z += (n.tz - n.z) * 0.085;
      const p = project3D(n.x, n.y, n.z, cw, ch, cosY, sinY, cosP, sinP, fov);
      if (!p) { n._proj = null; continue; }
      n._proj = p;
      const matchLobe = !S.lobeFilter || n.cat === S.lobeFilter || n.cat === 'core';
      const matchQ = !qLow || n.name.toLowerCase().includes(qLow) || (n.ext && n.ext.includes(qLow)) || (n.rootLabel && n.rootLabel.toLowerCase().includes(qLow));
      n._vis = matchLobe && matchQ;
      n._qHit = !!qLow && matchQ;
      projNodes.push(n);
    }

    // 4. Draw 3D Synaptic Axons
    ctx.lineCap = 'round';
    for (const l of S.links) {
      const a = l.sourceNode, b = l.targetNode;
      if (!a || !b || !a._proj || !b._proj) continue;
      if (!a._vis && !b._vis) continue;

      const isHi = selNode && (a === selNode || b === selNode);
      const isDim = (selNode && !isHi) || (S.lobeFilter && (!a._vis || !b._vis)) || (qLow && (!a._qHit && !b._qHit));
      if (isDim && l.kind !== 'tree') continue;

      ctx.beginPath();
      ctx.moveTo(a._proj.sx, a._proj.sy);
      if (l.kind === 'semantic') {
        const mx = (a._proj.sx + b._proj.sx) * 0.5;
        const my = (a._proj.sy + b._proj.sy) * 0.5 - 22 * a._proj.scale;
        ctx.quadraticCurveTo(mx, my, b._proj.sx, b._proj.sy);
        ctx.strokeStyle = isHi ? 'rgba(245, 158, 11, 0.84)' : 'rgba(245, 158, 11, 0.16)';
        ctx.lineWidth = isHi ? 2.0 : 0.9;
      } else if (l.kind === 'temporal') {
        ctx.lineTo(b._proj.sx, b._proj.sy);
        ctx.strokeStyle = isHi ? 'rgba(168, 85, 247, 0.84)' : 'rgba(168, 85, 247, 0.14)';
        ctx.lineWidth = isHi ? 1.8 : 0.8;
      } else {
        ctx.lineTo(b._proj.sx, b._proj.sy);
        const rgb = (LOBES[b.cat] || LOBES.data).rgb;
        const alpha = isHi ? 0.85 : isDim ? 0.04 : 0.22;
        ctx.strokeStyle = 'rgba(' + rgb[0] + ',' + rgb[1] + ',' + rgb[2] + ',' + alpha + ')';
        ctx.lineWidth = isHi ? 2.2 : 1.05;
      }
      ctx.stroke();
    }

    // 5. Traveling synaptic pulses
    if (S.pulsesOn && S.links.length && Math.random() < 0.45) {
      const pickLink = S.links[Math.floor(Math.random() * S.links.length)];
      if (pickLink && pickLink.sourceNode && pickLink.sourceNode._vis && pickLink.targetNode._vis) spawnPulse(pickLink, false);
    }
    for (let i = S.pulses.length - 1; i >= 0; i--) {
      const pl = S.pulses[i];
      pl.t += pl.speed;
      if (pl.t >= 1 || !pl.source._proj || !pl.target._proj) {
        S.pulses.splice(i, 1);
        continue;
      }
      const x = pl.source.x + (pl.target.x - pl.source.x) * pl.t;
      const y = pl.source.y + (pl.target.y - pl.source.y) * pl.t;
      const z = pl.source.z + (pl.target.z - pl.source.z) * pl.t;
      const pp = project3D(x, y, z, cw, ch, cosY, sinY, cosP, sinP, fov);
      if (!pp) continue;
      const rad = Math.max(1.8, 3.8 * pp.scale);
      ctx.fillStyle = pl.col;
      ctx.beginPath();
      ctx.arc(pp.sx, pp.sy, rad, 0, Math.PI * 2);
      ctx.fill();
    }

    // 6. Neurogenesis Shockwave Rings for newly created files
    for (let i = S.shockwaves.length - 1; i >= 0; i--) {
      const sw = S.shockwaves[i];
      sw.r += 2.2;
      sw.alpha = Math.max(0, 1 - sw.r / sw.maxR);
      if (sw.alpha <= 0.02 || !sw.node._proj) {
        S.shockwaves.splice(i, 1);
        continue;
      }
      ctx.strokeStyle = 'rgba(250, 204, 21, ' + sw.alpha.toFixed(2) + ')';
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.arc(sw.node._proj.sx, sw.node._proj.sy, sw.r * sw.node._proj.scale, 0, Math.PI * 2);
      ctx.stroke();
    }

    // 7. Sort neurons back-to-front and render
    projNodes.sort((a, b) => b._proj.depth - a._proj.depth);

    for (const n of projNodes) {
      const p = n._proj;
      const lb = LOBES[n.cat] || LOBES.data;
      const rgb = lb.rgb;
      const isSel = n === S.selected || n === S.hovered;
      const isNb = selNode && selNeighbors.has(n.id);
      const isDim = !n._vis || (selNode && !isNb);
      const isNewlyBorn = n._bornAt && (now - n._bornAt < 8000);
      const birthPulse = isNewlyBorn ? (1 + 0.35 * Math.sin((now - n._bornAt) * 0.012)) : 1;

      const baseR = n.cat === 'core'
        ? 13
        : n.isDir
          ? 7.2 + Math.min(4.5, Math.sqrt(n.deg || 1) * 0.8)
          : 3.4 + Math.min(4.8, Math.log10((n.size || 1024) + 10) * 0.75);
      const r = Math.max(1.8, baseR * p.scale * (isSel ? 1.45 : n._qHit ? 1.3 : 1) * birthPulse);
      const alpha = isDim ? 0.12 : Math.min(1, Math.max(0.3, 1.15 - p.depth / 1500));

      if (!isDim && (n.isDir || isSel || n._qHit || isNewlyBorn || r > 5.5)) {
        const haloR = r * (isSel || n._qHit || isNewlyBorn ? 3.8 : 2.3);
        const grad = ctx.createRadialGradient(p.sx, p.sy, r * 0.2, p.sx, p.sy, haloR);
        const hCol = (n._qHit || isNewlyBorn) ? '250, 204, 21' : (rgb[0] + ',' + rgb[1] + ',' + rgb[2]);
        grad.addColorStop(0, 'rgba(' + hCol + ',' + (isSel || isNewlyBorn ? 0.72 : 0.34) + ')');
        grad.addColorStop(1, 'rgba(' + hCol + ',0)');
        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.arc(p.sx, p.sy, haloR, 0, Math.PI * 2);
        ctx.fill();
      }

      ctx.fillStyle = (n._qHit || isNewlyBorn)
        ? 'rgba(250, 204, 21,' + alpha + ')'
        : 'rgba(' + rgb[0] + ',' + rgb[1] + ',' + rgb[2] + ',' + alpha + ')';
      ctx.beginPath();
      ctx.arc(p.sx, p.sy, r, 0, Math.PI * 2);
      ctx.fill();

      if (!isDim && r > 3.2) {
        ctx.fillStyle = 'rgba(255,255,255,' + (alpha * 0.75) + ')';
        ctx.beginPath();
        ctx.arc(p.sx - r * 0.28, p.sy - r * 0.28, Math.max(0.9, r * 0.32), 0, Math.PI * 2);
        ctx.fill();
      }

      if (S.labelsOn && !isDim && (isSel || isNewlyBorn || n._qHit || n.cat === 'core' || (n.isDir && p.scale > 0.68) || (isNb && selNode) || p.scale > 1.45)) {
        ctx.font = (isSel || isNewlyBorn || n.isDir ? '600 ' : '500 ') + Math.round(Math.max(10, Math.min(14, 11.5 * p.scale))) + 'px sans-serif';
        const lbl = (isNewlyBorn ? '✨ ' : '') + (n.name.length > 26 ? n.name.slice(0, 24) + '…' : n.name);
        ctx.fillStyle = isSel || isNewlyBorn || n._qHit ? '#ffffff' : 'rgba(226, 232, 240, 0.88)';
        ctx.fillText(lbl, p.sx + r + 5, p.sy + 3.5);
      }
    }

    ctx.restore();
  }

  function findNodeAt(mx, my) {
    let best = null, bestD = 18;
    for (const n of S.nodes) {
      if (!n._proj || !n._vis) continue;
      const d = Math.hypot(mx - n._proj.sx, my - n._proj.sy);
      if (d < bestD) { bestD = d; best = n; }
    }
    return best;
  }

  function build() {
    if (built) return;
    built = true;
    initAtmosphere();

    root.innerHTML =
      '<div class="brn-wrap" id="brn-wrap">' +
        '<canvas class="brn-cv" id="brn-cv"></canvas>' +
        '<div class="brn-tip" id="brn-tip"></div>' +

        /* Top Glassmorphic HUD */
        '<div class="brn-hud-top">' +
          '<div class="brn-glass brn-brand">' +
            '<div class="brn-brand-ic">🧠</div>' +
            '<div><b>3D File Brain</b><span id="brn-sub">Initializing neural connectome...</span></div>' +
          '</div>' +

          '<div class="brn-glass brn-bar">' +
            '<button type="button" class="brn-btn on" id="brn-agtog" title="Toggle the built-in Local AI Brain Agent">🤖 Brain Agent</button>' +
          '</div>' +

          '<div class="brn-search-wrap">' +
            '<input class="brn-search" id="brn-q" type="text" placeholder="🔎 Search any file, extension, or topic..." autocomplete="off">' +
            '<button type="button" class="brn-search-clr" id="brn-qclr">✕</button>' +
            '<div class="brn-glass brn-hits" id="brn-hits"></div>' +
          '</div>' +

          '<div class="brn-glass brn-bar">' +
            '<select class="brn-sel" id="brn-scope" title="Choose which parts of your PC to map into the 3D Brain">' +
              '<option value="all">🌐 Full PC Brain (User + Workspace)</option>' +
              '<option value="user">🏠 Personal PC Folders (Desktop, Docs, Media)</option>' +
              '<option value="indexed">📚 Indexed My Files &amp; Notes</option>' +
              '<option value="workspace">⚙️ Moundshroud Workspace</option>' +
              '<option value="custom">📁 Custom Folder on PC...</option>' +
            '</select>' +
            '<button type="button" class="brn-btn" id="brn-pick" title="Pick any folder or drive on your PC to map in 3D">📁 Pick Folder</button>' +
          '</div>' +

          '<div class="brn-glass brn-bar" id="brn-modes">' +
            '<button type="button" class="brn-btn on" data-m="cortex" title="Bi-Hemispheric 3D Brain Cortex">🧠 Cortex</button>' +
            '<button type="button" class="brn-btn" data-m="galaxy" title="3D Orbital Galaxy Clusters">🌌 Galaxy</button>' +
            '<button type="button" class="brn-btn" data-m="helix" title="Chronological 3D Double-Helix">🧬 Time Helix</button>' +
          '</div>' +

          '<div class="brn-glass brn-bar">' +
            '<button type="button" class="brn-btn on" id="brn-orbit" title="Toggle gentle 3D auto-rotation">🔄 Orbit</button>' +
            '<button type="button" class="brn-btn on" id="brn-pulses" title="Toggle synaptic action-potential pulses">⚡ Synapses</button>' +
            '<button type="button" class="brn-btn on" id="brn-labels" title="Toggle floating 3D file labels">🏷️ Labels</button>' +
            '<button type="button" class="brn-btn" id="brn-reset" title="Reset 3D camera view">🎯 Reset</button>' +
          '</div>' +
        '</div>' +

        /* Left-Side Built-in Local AI Brain Agent Dock */
        '<aside class="brn-glass brn-agent" id="brn-agent">' +
          '<div class="brn-ag-hd">' +
            '<div class="brn-ag-av">🤖</div>' +
            '<div class="brn-ag-title"><b>Brain AI Agent</b><span>Add files, navigate workspace &amp; run any tool</span></div>' +
            '<button type="button" id="brn-ag-newbtn" title="Quickly create a new file and watch it spawn in 3D">+ Add File</button>' +
            '<button type="button" id="brn-ag-min" title="Minimize panel">–</button>' +
          '</div>' +

          /* Quick File Creator Drawer inside the Agent Dock */
          '<div class="brn-ag-newbox" id="brn-ag-newbox">' +
            '<div style="display:flex;gap:6px">' +
              '<input id="brn-nf-name" type="text" placeholder="Filename (e.g. ideas.md, script.py)" style="flex:1">' +
              '<select id="brn-nf-dir" style="width:122px">' +
                '<option value="Documents">📁 Documents</option>' +
                '<option value="Desktop">🖥️ Desktop</option>' +
                '<option value="Notes">📝 Notes</option>' +
                '<option value="Workspace">⚙️ Workspace</option>' +
              '</select>' +
            '</div>' +
            '<textarea id="brn-nf-body" rows="3" placeholder="Type file contents OR describe what the AI should write inside it..."></textarea>' +
            '<div style="display:flex;gap:6px;justify-content:flex-end">' +
              '<button type="button" class="brn-btn" id="brn-nf-ai">✨ AI Write &amp; Spawn</button>' +
              '<button type="button" class="brn-btn on" id="brn-nf-save">💾 Save Raw &amp; Spawn</button>' +
            '</div>' +
          '</div>' +

          '<div class="brn-ag-log" id="brn-ag-log"></div>' +
          '<div class="brn-ag-qs" id="brn-ag-qs">' +
            '<button type="button" data-q="Create a file roadmap.md with a 5-step project plan">+ Create roadmap.md</button>' +
            '<button type="button" data-q="Create a file analyzer.py with a file stats script">+ Create analyzer.py</button>' +
            '<button type="button" data-q="Show me my biggest file">🔍 Biggest file</button>' +
            '<button type="button" data-q="Switch to Galaxy view">🌌 Galaxy view</button>' +
            '<button type="button" data-q="Where is everything in the workspace?">🧭 Workspace guide</button>' +
          '</div>' +
          '<div class="brn-ag-foot">' +
            '<input id="brn-ag-in" type="text" placeholder="Ask me to create a file, find anything, or run a tool..." autocomplete="off">' +
            '<button type="button" class="brn-ag-send" id="brn-ag-send">Send</button>' +
          '</div>' +
        '</aside>' +

        /* Bottom-Left Lobe Filter Legend */
        '<div class="brn-glass brn-lobes" id="brn-lobes"></div>' +

        /* Right-Side Neural Inspector Drawer */
        '<aside class="brn-glass brn-insp" id="brn-insp">' +
          '<div class="brn-insp-hd">' +
            '<div class="brn-insp-ic" id="brn-i-ic">📄</div>' +
            '<div class="brn-insp-meta"><b id="brn-i-name">File</b><span id="brn-i-sub">Lobe</span></div>' +
            '<button type="button" class="brn-insp-x" id="brn-i-close" title="Close">✕</button>' +
          '</div>' +
          '<div class="brn-insp-bd">' +
            '<div class="brn-path" id="brn-i-path"></div>' +
            '<div class="brn-kv">' +
              '<div><span>Size / Scope</span><b id="brn-i-size">—</b></div>' +
              '<div><span>Modified</span><b id="brn-i-date">—</b></div>' +
              '<div><span>Connections</span><b id="brn-i-deg">—</b></div>' +
              '<div><span>Type</span><b id="brn-i-ext">—</b></div>' +
            '</div>' +
            '<div class="brn-acts">' +
              '<button type="button" class="brn-act pri" id="brn-i-ask">🤖 Summarize / Edit with Brain Agent</button>' +
              '<button type="button" class="brn-act" id="brn-i-rev">📂 Show in Explorer</button>' +
              '<button type="button" class="brn-act" id="brn-i-open">🚀 Open File</button>' +
              '<button type="button" class="brn-act" id="brn-i-drill" style="grid-column:1/-1;display:none">🔍 Map This Folder in 3D</button>' +
            '</div>' +
            '<div id="brn-i-prewrap" style="display:none">' +
              '<div style="font-size:11px;font-weight:700;color:#94a3b8;margin-bottom:5px;text-transform:uppercase;letter-spacing:.05em">Live File Preview</div>' +
              '<pre class="brn-pre" id="brn-i-pre"></pre>' +
            '</div>' +
            '<div>' +
              '<div style="font-size:11px;font-weight:700;color:#94a3b8;margin-bottom:6px;text-transform:uppercase;letter-spacing:.05em">Connected Synapses (Click to Fly)</div>' +
              '<div class="brn-conns" id="brn-i-conns"></div>' +
            '</div>' +
          '</div>' +
        '</aside>' +
      '</div>';

    cv = root.querySelector('#brn-cv');
    ctx = cv.getContext('2d');
    const tip = root.querySelector('#brn-tip');
    const wrapEl = root.querySelector('#brn-wrap');
    const agPanel = root.querySelector('#brn-agent');
    const agTogBtn = root.querySelector('#brn-agtog');

    // Initial welcome message in Brain AI Agent
    addAgentMsg(
      'a',
      'Hi! I am your **Brain AI Agent**. From right here inside the 3D Brain, you can tell me to:\n• **Add files & watch them spawn live in 3D**: *"Create a file called `notes.md` about quantum computing"* or click **+ Add File** above\n• **Control the 3D Brain**: *"Find `server.js`"*, *"Show my biggest file"*, *"Filter to code"*, or *"Switch to Galaxy view"*\n• **Navigate & do anything in Moundshroud**: *"Open AI Hotbox"*, *"Make flashcards on biology"*, *"Set a reminder"*, or ask me about any selected file!'
    );

    // Toggle Agent Dock
    const setAgentOpen = open => {
      S.agentOpen = !!open;
      agPanel.classList.toggle('min', !S.agentOpen);
      wrapEl.classList.toggle('agent-min', !S.agentOpen);
      agTogBtn.classList.toggle('on', S.agentOpen);
    };
    agTogBtn.onclick = () => setAgentOpen(!S.agentOpen);
    root.querySelector('#brn-ag-min').onclick = () => setAgentOpen(false);

    // Quick File Creator Drawer
    const newBox = root.querySelector('#brn-ag-newbox');
    root.querySelector('#brn-ag-newbtn').onclick = () => {
      newBox.classList.toggle('on');
      if (newBox.classList.contains('on')) root.querySelector('#brn-nf-name').focus();
    };
    root.querySelector('#brn-nf-save').onclick = async () => {
      const name = root.querySelector('#brn-nf-name').value.trim() || ('note-' + Date.now().toString(36) + '.md');
      const dir = root.querySelector('#brn-nf-dir').value;
      const body = root.querySelector('#brn-nf-body').value;
      newBox.classList.remove('on');
      addAgentMsg('u', 'Create file ' + name + ' in ' + dir);
      await createAndPopulateFile(name, dir, body, true);
    };
    root.querySelector('#brn-nf-ai').onclick = async () => {
      const name = root.querySelector('#brn-nf-name').value.trim() || ('ai-note-' + Date.now().toString(36) + '.md');
      const dir = root.querySelector('#brn-nf-dir').value;
      const topic = root.querySelector('#brn-nf-body').value.trim() || name;
      newBox.classList.remove('on');
      addAgentMsg('u', 'AI-generate file ' + name + ' in ' + dir + ': ' + topic);
      await createAndPopulateFile(name, dir, topic, false);
    };

    // Agent Chat Input & Quick Chips
    const agIn = root.querySelector('#brn-ag-in');
    const sendAg = async txt => {
      const q = (txt !== undefined ? txt : agIn.value).trim();
      if (!q || S.agentBusy) return;
      if (txt === undefined) agIn.value = '';
      setAgentOpen(true);
      addAgentMsg('u', q);
      S.agentBusy = true;
      try { await handleAgentCommand(q); }
      catch (e) { addAgentMsg('a', 'Something went wrong: ' + (e.message || e)); }
      S.agentBusy = false;
    };
    root.querySelector('#brn-ag-send').onclick = () => sendAg();
    agIn.onkeydown = e => { e.stopPropagation(); if (e.key === 'Enter') sendAg(); };
    root.querySelector('#brn-ag-qs').onclick = e => {
      const b = e.target.closest('[data-q]');
      if (b) sendAg(b.dataset.q);
    };

    // Pointer orbit, pan, hover, and click interactions on the 3D canvas
    let drag = null;
    cv.addEventListener('pointerdown', e => {
      drag = {
        id: e.pointerId,
        x0: e.clientX,
        y0: e.clientY,
        lx: e.clientX,
        ly: e.clientY,
        pan: e.button === 2 || e.shiftKey,
        moved: false
      };
      try { cv.setPointerCapture(e.pointerId); } catch (x) { }
    });
    cv.addEventListener('contextmenu', e => e.preventDefault());
    cv.addEventListener('pointermove', e => {
      const r = cv.getBoundingClientRect();
      const mx = e.clientX - r.left, my = e.clientY - r.top;
      if (drag && e.pointerId === drag.id) {
        const dx = e.clientX - drag.lx, dy = e.clientY - drag.ly;
        drag.lx = e.clientX; drag.ly = e.clientY;
        if (Math.hypot(e.clientX - drag.x0, e.clientY - drag.y0) > 5) drag.moved = true;
        if (drag.pan) {
          S.panX += dx; S.panY += dy;
        } else {
          S.yaw += dx * 0.0055;
          S.pitch = Math.max(-1.35, Math.min(1.35, S.pitch + dy * 0.0055));
          S.vYaw = dx * 0.0012;
          S.vPitch = dy * 0.0012;
        }
        tip.style.display = 'none';
        return;
      }
      const hit = findNodeAt(mx, my);
      S.hovered = hit;
      cv.style.cursor = hit ? 'pointer' : 'grab';
      if (hit && hit._proj) {
        const lb = LOBES[hit.cat] || LOBES.data;
        tip.innerHTML = lb.icon + ' <b>' + esc(hit.name) + '</b> <span style="color:#94a3b8">· ' + (hit.isDir ? 'Folder' : fmtBytes(hit.size)) + '</span>';
        tip.style.left = Math.round(hit._proj.sx) + 'px';
        tip.style.top = Math.round(hit._proj.sy) + 'px';
        tip.style.display = 'block';
      } else {
        tip.style.display = 'none';
      }
    });
    const endPointer = e => {
      if (!drag || (e && e.pointerId !== drag.id)) return;
      const wasMoved = drag.moved;
      const r = cv.getBoundingClientRect();
      const mx = e.clientX - r.left, my = e.clientY - r.top;
      drag = null;
      if (!wasMoved) {
        const hit = findNodeAt(mx, my);
        selectNode(hit);
      }
    };
    cv.addEventListener('pointerup', endPointer);
    cv.addEventListener('pointercancel', endPointer);
    cv.addEventListener('dblclick', e => {
      const r = cv.getBoundingClientRect();
      const hit = findNodeAt(e.clientX - r.left, e.clientY - r.top);
      if (!hit) return;
      if (hit.isDir && hit.cat !== 'core') {
        S.scope = 'custom';
        S.customPath = hit.path;
        root.querySelector('#brn-scope').value = 'custom';
        loadGraph();
      } else if (hit.path) {
        A.api('/api/brain/reveal', { path: hit.path, open: false });
      }
    });
    cv.addEventListener('wheel', e => {
      e.preventDefault();
      const factor = e.deltaY < 0 ? 1.14 : 0.88;
      S.targetZoom = Math.max(0.35, Math.min(4.5, S.targetZoom * factor));
    }, { passive: false });

    // HUD Search
    const qIn = root.querySelector('#brn-q'), qClr = root.querySelector('#brn-qclr'), hitsBox = root.querySelector('#brn-hits');
    qIn.oninput = () => {
      S.query = qIn.value.trim();
      qClr.style.display = S.query ? 'block' : 'none';
      if (!S.query) { hitsBox.classList.remove('on'); return; }
      const ql = S.query.toLowerCase();
      const matches = S.nodes.filter(n => n.name.toLowerCase().includes(ql) || (n.ext && n.ext.includes(ql))).slice(0, 12);
      if (matches.length) {
        hitsBox.innerHTML = matches.map(m => {
          const lb = LOBES[m.cat] || LOBES.data;
          return '<div class="brn-hit" data-id="' + esc(m.id) + '"><span>' + lb.icon + '</span><span style="flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">' + esc(m.name) + '</span><span style="font-size:11px;color:#94a3b8">' + esc(m.rootLabel || '') + '</span></div>';
        }).join('');
        hitsBox.classList.add('on');
      } else {
        hitsBox.classList.remove('on');
      }
    };
    qIn.onkeydown = e => { e.stopPropagation(); if (e.key === 'Escape') { qIn.value = ''; qIn.oninput(); } };
    qClr.onclick = () => { qIn.value = ''; qIn.oninput(); };
    hitsBox.onclick = e => {
      const h = e.target.closest('[data-id]'); if (!h) return;
      const n = S.nodes.find(x => x.id === h.dataset.id);
      hitsBox.classList.remove('on');
      if (n) selectNode(n);
    };

    root.querySelector('#brn-scope').onchange = async e => {
      const val = e.target.value;
      if (val === 'custom' && !S.customPath) {
        const p = await A.api('/api/pick-folder', {}).catch(() => ({}));
        if (p && p.path) S.customPath = p.path;
        else { e.target.value = S.scope; return; }
      }
      S.scope = val;
      selectNode(null);
      loadGraph();
    };

    root.querySelector('#brn-pick').onclick = async () => {
      A.toast('Choose any folder on your PC to map in 3D...', 2500);
      const p = await A.api('/api/pick-folder', {}).catch(() => ({}));
      if (!p || !p.path) return;
      S.scope = 'custom';
      S.customPath = p.path;
      root.querySelector('#brn-scope').value = 'custom';
      selectNode(null);
      loadGraph();
    };

    root.querySelector('#brn-modes').onclick = e => {
      const b = e.target.closest('[data-m]'); if (!b) return;
      S.mode = b.dataset.m;
      root.querySelectorAll('#brn-modes .brn-btn').forEach(x => x.classList.toggle('on', x === b));
      applyModeTargets();
    };

    root.querySelector('#brn-orbit').onclick = e => {
      S.autoOrbit = !S.autoOrbit;
      e.currentTarget.classList.toggle('on', S.autoOrbit);
    };
    root.querySelector('#brn-pulses').onclick = e => {
      S.pulsesOn = !S.pulsesOn;
      e.currentTarget.classList.toggle('on', S.pulsesOn);
    };
    root.querySelector('#brn-labels').onclick = e => {
      S.labelsOn = !S.labelsOn;
      e.currentTarget.classList.toggle('on', S.labelsOn);
    };
    root.querySelector('#brn-reset').onclick = () => {
      S.tx = 0; S.ty = 0; S.tz = 0;
      S.panX = 0; S.panY = 0;
      S.targetZoom = 1.0;
      S.yaw = -0.35; S.pitch = 0.22;
      S.autoOrbit = true;
      root.querySelector('#brn-orbit').classList.add('on');
      selectNode(null);
    };

    root.querySelector('#brn-lobes').onclick = e => {
      const b = e.target.closest('[data-l]'); if (!b) return;
      S.lobeFilter = b.dataset.l || '';
      paintLobeBar();
    };

    // Inspector actions
    root.querySelector('#brn-i-close').onclick = () => selectNode(null);
    root.querySelector('#brn-i-rev').onclick = () => {
      if (S.selected && S.selected.path) A.api('/api/brain/reveal', { path: S.selected.path, open: false });
    };
    root.querySelector('#brn-i-open').onclick = () => {
      if (S.selected && S.selected.path) A.api('/api/brain/reveal', { path: S.selected.path, open: true });
    };
    root.querySelector('#brn-i-drill').onclick = () => {
      if (S.selected && S.selected.isDir && S.selected.path) {
        S.scope = 'custom';
        S.customPath = S.selected.path;
        root.querySelector('#brn-scope').value = 'custom';
        selectNode(null);
        loadGraph();
      }
    };
    root.querySelector('#brn-i-ask').onclick = () => {
      if (!S.selected) return;
      setAgentOpen(true);
      sendAg('Summarize and explain the selected file "' + S.selected.name + '" and tell me what I can do with it.');
    };
    root.querySelector('#brn-i-conns').onclick = e => {
      const c = e.target.closest('[data-nid]'); if (!c) return;
      const target = S.nodes.find(x => x.id === c.dataset.nid);
      if (target) selectNode(target);
    };

    loadGraph();
    if (!raf) raf = requestAnimationFrame(drawFrame);
  }

  A.brain = { open: () => A.showTab('brain'), reload: loadGraph, createAndPopulateFile };
  A.registerTab('brain', '3D Brain', () => { build(); });

  try {
    if (A.cmd && A.cmd.reg) {
      A.cmd.reg([{
        title: '3D File Brain (Neural Connectome of PC Files)',
        sub: 'Explore all files on your PC inside an interactive 3D neural brain with built-in AI Agent',
        icon: '🧠',
        group: 'Open',
        tags: '3d brain files pc graph neural network connectome galaxy visualize folders agent',
        run: () => A.showTab('brain')
      }]);
    }
  } catch (e) { }
})();

// 3D Brain: an interactive 3D neural connectome of all files across your PC (Desktop, Documents, Downloads, Pictures,
// Music, Videos, My Files, and custom folders). Morph between a bi-hemispheric 3D Brain Cortex, a 3D Galaxy cluster, and
// a Temporal Double-Helix; watch synaptic pulses travel between related files, search in real time, and inspect or open any file.
(() => {
  const root = document.getElementById('p-brain');
  if (!root) return;
  const esc = s => String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const fmtBytes = b => b >= 1073741824 ? (b / 1073741824).toFixed(2) + ' GB' : b >= 1048576 ? (b / 1048576).toFixed(1) + ' MB' : b >= 1024 ? Math.round(b / 1024) + ' KB' : (b || 0) + ' B';

  const LOBES = {
    core:   { label: 'Brain Core',     icon: '🧠', col: '#ffffff', rgb: [255, 255, 255], lobeCenter: [0, 0, 0] },
    folder: { label: 'Folder Nuclei',  icon: '📁', col: '#e2e8f0', rgb: [226, 232, 240], lobeCenter: [0, 0.05, 0] },
    code:   { label: 'Frontal · Code', icon: '💻', col: '#38bdf8', rgb: [56, 189, 248],  lobeCenter: [-0.45, -0.22, 0.52] },
    docs:   { label: 'Parietal · Docs',icon: '📄', col: '#f59e0b', rgb: [245, 158, 11],  lobeCenter: [0.45, -0.28, 0.18] },
    images: { label: 'Occipital · Art',icon: '🖼️', col: '#f43f5e', rgb: [244, 63, 94],   lobeCenter: [0.38, 0.05, -0.58] },
    audio:  { label: 'Temporal · Audio',icon: '🎵',col: '#10b981', rgb: [16, 185, 129],  lobeCenter: [-0.62, 0.18, -0.05] },
    video:  { label: 'Temporal · Video',icon: '🎬',col: '#a855f7', rgb: [168, 85, 247],  lobeCenter: [0.62, 0.18, -0.05] },
    data:   { label: 'Cerebellar · Data',icon:'📦',col: '#fb923c', rgb: [251, 146, 60],  lobeCenter: [-0.35, 0.42, -0.45] }
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
.brn-glass{background:rgba(10,15,30,.76);backdrop-filter:blur(18px) saturate(1.4);-webkit-backdrop-filter:blur(18px) saturate(1.4);border:1px solid rgba(148,163,184,.2);border-radius:14px;box-shadow:0 14px 36px -10px rgba(0,0,0,.65),inset 0 1px 0 rgba(255,255,255,.08)}
.brn-brand{display:flex;align-items:center;gap:10px;padding:8px 14px}
.brn-brand-ic{width:32px;height:32px;border-radius:10px;display:grid;place-items:center;font-size:18px;background:linear-gradient(135deg,rgba(56,189,248,.25),rgba(168,85,247,.25));border:1px solid rgba(56,189,248,.4);box-shadow:0 0 18px rgba(56,189,248,.25)}
.brn-brand b{font-size:14.5px;letter-spacing:-.01em;display:block;color:#f8fafc}
.brn-brand span{font-size:11px;color:#94a3b8;display:block}
.brn-search-wrap{position:relative;flex:1;min-width:210px;max-width:340px}
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
.brn-lobes{position:absolute;left:16px;bottom:16px;z-index:5;display:flex;gap:6px;flex-wrap:wrap;padding:7px 9px;max-width:calc(100% - 380px)}
@media(max-width:900px){.brn-lobes{max-width:calc(100% - 32px)}}
.brn-lobe{display:inline-flex;align-items:center;gap:6px;padding:5px 10px;border-radius:999px;border:1px solid rgba(148,163,184,.2);background:rgba(15,23,42,.75);color:#e2e8f0;font-size:11.5px;font-weight:600;cursor:pointer;transition:all .15s}
.brn-lobe:hover{transform:translateY(-1px);border-color:var(--lc,#38bdf8)}
.brn-lobe.on{background:color-mix(in srgb,var(--lc,#38bdf8) 26%,#0f172a);border-color:var(--lc,#38bdf8);box-shadow:0 0 14px -2px var(--lc,#38bdf8)}
.brn-dot{width:8px;height:8px;border-radius:50%;background:var(--lc,#38bdf8);box-shadow:0 0 8px var(--lc,#38bdf8)}
.brn-cnt{font-size:10.5px;color:#94a3b8;font-weight:500}
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
.brn-path{font-family:Consolas,monospace;font-size:11px;padding:8px 10px;border-radius:9px;background:rgba(2,6,23,.65);border:1px solid rgba(148,163,184,.16);color:#94a3b8;overflow-wrap:anywhere;line-height:1.45}
.brn-kv{display:grid;grid-template-columns:1fr 1fr;gap:8px}
.brn-kv > div{padding:8px 10px;border-radius:9px;background:rgba(15,23,42,.65);border:1px solid rgba(148,163,184,.14)}
.brn-kv span{font-size:10.5px;color:#94a3b8;display:block}
.brn-kv b{font-size:12.5px;color:#f8fafc;display:block;margin-top:2px}
.brn-acts{display:grid;grid-template-columns:1fr 1fr;gap:7px}
.brn-act{padding:8px 10px;border-radius:9px;border:1px solid rgba(148,163,184,.22);background:rgba(30,41,59,.65);color:#f8fafc;font-size:12px;font-weight:600;cursor:pointer;text-align:center;transition:all .15s}
.brn-act:hover{border-color:#38bdf8;background:rgba(56,189,248,.2)}
.brn-act.pri{grid-column:1 / -1;background:linear-gradient(135deg,rgba(56,189,248,.35),rgba(168,85,247,.35));border-color:rgba(56,189,248,.55)}
.brn-pre{margin:0;padding:10px;border-radius:9px;background:rgba(2,6,23,.8);border:1px solid rgba(148,163,184,.16);color:#cbd5e1;font:11.5px/1.5 Consolas,monospace;max-height:190px;overflow:auto;white-space:pre-wrap;overflow-wrap:anywhere}
.brn-conns{display:flex;flex-direction:column;gap:5px}
.brn-conn{padding:6px 9px;border-radius:8px;background:rgba(15,23,42,.65);border:1px solid rgba(148,163,184,.14);cursor:pointer;display:flex;align-items:center;gap:7px;font-size:12px;color:#e2e8f0;transition:border-color .15s,background .15s}
.brn-conn:hover{border-color:#38bdf8;background:rgba(56,189,248,.14)}
.brn-conn small{margin-left:auto;font-size:10px;padding:1px 6px;border-radius:99px;background:rgba(148,163,184,.15);color:#94a3b8}
.brn-tip{position:absolute;z-index:10;pointer-events:none;padding:7px 11px;border-radius:10px;background:rgba(2,6,23,.9);border:1px solid rgba(56,189,248,.45);box-shadow:0 8px 24px rgba(0,0,0,.6);font-size:12px;color:#f8fafc;white-space:nowrap;display:none;transform:translate(-50%,-130%)}
`;
    document.head.appendChild(st);
  }

  let built = false, cv = null, ctx = null, raf = 0;
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
    nodes: [],
    links: [],
    stats: null,
    selected: null,
    hovered: null,
    adj: new Map(),
    pulses: [],
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

  // Deterministic pseudo-random from string id
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

  // Generate background stars and the 3D bi-hemispheric cortical mesh shell
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

    // Build a subtle 3D bi-hemispheric cortical surface lattice
    S.corticalShell = [];
    for (const hem of [-1, 1]) {
      const rings = 9, segs = 14;
      for (let i = 1; i < rings; i++) {
        const phi = (i / rings) * Math.PI;
        const pts = [];
        for (let j = 0; j <= segs; j++) {
          const theta = (j / segs) * Math.PI; // half-sphere per hemisphere
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

  /* Compute 3D target coordinates for all 3 topologies: Cortex, Galaxy, and Helix */
  function computeLayouts() {
    const N = S.nodes.length || 1;
    const folderMap = new Map();
    const folders = S.nodes.filter(n => n.isDir);

    // Position folder nuclei first
    folders.forEach((f, idx) => {
      const rng = hashStr(f.id);
      if (f.cat === 'core') {
        f.posCortex = [0, 0, 0];
        f.posGalaxy = [0, 0, 0];
        f.posHelix = [0, -240, 0];
      } else {
        const hem = idx % 2 === 0 ? -1 : 1;
        const ang = (idx / Math.max(1, folders.length)) * Math.PI * 2;
        const rad = 110 + (f.depth || 1) * 42;
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

    // Map parent folder lookup
    const parentOf = new Map();
    S.links.forEach(l => {
      if (l.kind === 'tree') parentOf.set(l.target, l.source);
    });

    // Sort files by mtime for Helix layout
    const sortedByTime = S.nodes.slice().sort((a, b) => (b.mtime || 0) - (a.mtime || 0));
    const timeRank = new Map();
    sortedByTime.forEach((n, i) => timeRank.set(n.id, i));

    S.nodes.forEach((n, i) => {
      const rng = hashStr(n.id);
      const lobe = LOBES[n.cat] || LOBES.data;
      const pId = parentOf.get(n.id);
      const pNode = pId ? folderMap.get(pId) : null;

      if (!n.isDir) {
        // 1. Neural Cortex Topology: sculpted bi-hemispheric brain lobes with gyri folds
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
        // Keep a longitudinal fissure gap between left and right hemispheres
        if (Math.abs(bx) < 16) bx = (bx < 0 ? -1 : 1) * (16 + rng() * 14);
        n.posCortex = [bx, by, bz];

        // 2. 3D Galaxy Force Cluster: orbit around parent folder nucleus
        const base = (pNode && pNode.posGalaxy) ? pNode.posGalaxy : [0, 0, 0];
        const orbR = 34 + rng() * 78;
        const oa = rng() * Math.PI * 2, ob = (rng() - 0.5) * Math.PI;
        n.posGalaxy = [
          base[0] + Math.cos(oa) * Math.cos(ob) * orbR,
          base[1] + Math.sin(ob) * orbR * 0.85,
          base[2] + Math.sin(oa) * Math.cos(ob) * orbR
        ];

        // 3. Temporal Double-Helix: intertwined strands ordered by file modification time
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
    if (S.pulses.length > 95) return;
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
    myLinks.slice(0, 28).forEach(l => {
      S.pulses.push({
        source: node,
        target: l.sourceNode === node ? l.targetNode : l.sourceNode,
        t: 0,
        speed: 0.026 + Math.random() * 0.015,
        col: '#38bdf8'
      });
    });
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
      const byId = new Map();
      S.nodes.forEach(n => {
        n.deg = 0;
        byId.set(n.id, n);
      });
      S.links = (r.links || []).map(l => {
        const s = byId.get(l.source), t = byId.get(l.target);
        if (!s || !t) return null;
        s.deg++; t.deg++;
        return Object.assign({}, l, { sourceNode: s, targetNode: t });
      }).filter(Boolean);

      // Build adjacency map for instant neighborhood highlighting
      S.adj = new Map();
      S.nodes.forEach(n => S.adj.set(n.id, []));
      S.links.forEach(l => {
        S.adj.get(l.sourceNode.id).push({ node: l.targetNode, kind: l.kind, label: l.label });
        S.adj.get(l.targetNode.id).push({ node: l.sourceNode, kind: l.kind, label: l.label });
      });

      computeLayouts();
      paintLobeBar();
      if (stEl) {
        stEl.textContent = S.stats.totalFiles.toLocaleString() + ' files · ' +
          S.stats.totalFolders.toLocaleString() + ' folder nuclei · ' +
          S.links.length.toLocaleString() + ' synapses · ' +
          fmtBytes(S.stats.totalBytes);
      }
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
    // Smoothly center 3D camera on selected neuron
    S.tx = n.x; S.ty = n.y; S.tz = n.z;
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

  /* 3D Projection & Render Loop */
  function project3D(x, y, z, W, H, cosY, sinY, cosP, sinP, fov) {
    const dx = x - S.camX, dy = y - S.camY, dz = z - S.camZ;
    // Rotate Yaw (around Y axis)
    const rx = dx * cosY - dz * sinY;
    const rz1 = dx * sinY + dz * cosY;
    // Rotate Pitch (around X axis)
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

    // Smooth camera & node layout physics
    if (S.autoOrbit) S.yaw += 0.0028;
    S.yaw += S.vYaw; S.pitch = Math.max(-1.35, Math.min(1.35, S.pitch + S.vPitch));
    S.vYaw *= 0.91; S.vPitch *= 0.91;
    S.zoom += (S.targetZoom - S.zoom) * 0.12;
    S.camX += (S.tx - S.camX) * 0.09;
    S.camY += (S.ty - S.camY) * 0.09;
    S.camZ += (S.tz - S.camZ) * 0.09;

    const cosY = Math.cos(S.yaw), sinY = Math.sin(S.yaw);
    const cosP = Math.cos(S.pitch), sinP = Math.sin(S.pitch);
    const fov = Math.min(cw, ch) * 0.82;

    // 1. Draw deep-space starfield
    for (const st of S.stars) {
      const p = project3D(st.x, st.y, st.z, cw, ch, cosY, sinY, cosP, sinP, fov);
      if (!p) continue;
      ctx.fillStyle = 'rgba(186,230,253,' + st.a.toFixed(2) + ')';
      ctx.beginPath();
      ctx.arc(p.sx, p.sy, st.s, 0, Math.PI * 2);
      ctx.fill();
    }

    // 2. Draw subtle 3D bi-hemispheric cortical wireframe shell when in Cortex mode
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

    // 3. Update & project all nodes
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

    // 4. Draw 3D Synaptic Axons (links)
    ctx.lineCap = 'round';
    for (const l of S.links) {
      const a = l.sourceNode, b = l.targetNode;
      if (!a._proj || !b._proj) continue;
      if (!a._vis && !b._vis) continue;

      const isHi = selNode && (a === selNode || b === selNode);
      const isDim = (selNode && !isHi) || (S.lobeFilter && (!a._vis || !b._vis)) || (qLow && (!a._qHit && !b._qHit));

      if (isDim && l.kind !== 'tree') continue;

      ctx.beginPath();
      ctx.moveTo(a._proj.sx, a._proj.sy);
      if (l.kind === 'semantic') {
        // Curved corpus-callosum arch for cross-folder semantic synapses
        const mx = (a._proj.sx + b._proj.sx) * 0.5;
        const my = (a._proj.sy + b._proj.sy) * 0.5 - 22 * a._proj.scale;
        ctx.quadraticCurveTo(mx, my, b._proj.sx, b._proj.sy);
        ctx.strokeStyle = isHi ? 'rgba(245, 158, 11, 0.82)' : 'rgba(245, 158, 11, 0.16)';
        ctx.lineWidth = isHi ? 2.0 : 0.9;
      } else if (l.kind === 'temporal') {
        ctx.lineTo(b._proj.sx, b._proj.sy);
        ctx.strokeStyle = isHi ? 'rgba(168, 85, 247, 0.82)' : 'rgba(168, 85, 247, 0.14)';
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

    // 5. Spawn & draw traveling synaptic action potentials
    if (S.pulsesOn && S.links.length && Math.random() < 0.45) {
      const pickLink = S.links[Math.floor(Math.random() * S.links.length)];
      if (pickLink && pickLink.sourceNode._vis && pickLink.targetNode._vis) spawnPulse(pickLink, false);
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

    // 6. Sort neurons back-to-front (Painter's algorithm) and render with 3D glow + specular highlights
    projNodes.sort((a, b) => b._proj.depth - a._proj.depth);

    for (const n of projNodes) {
      const p = n._proj;
      const lb = LOBES[n.cat] || LOBES.data;
      const rgb = lb.rgb;
      const isSel = n === S.selected || n === S.hovered;
      const isNb = selNode && selNeighbors.has(n.id);
      const isDim = !n._vis || (selNode && !isNb);

      const baseR = n.cat === 'core'
        ? 13
        : n.isDir
          ? 7.2 + Math.min(4.5, Math.sqrt(n.deg || 1) * 0.8)
          : 3.4 + Math.min(4.8, Math.log10((n.size || 1024) + 10) * 0.75);
      const r = Math.max(1.8, baseR * p.scale * (isSel ? 1.45 : n._qHit ? 1.3 : 1));
      const alpha = isDim ? 0.12 : Math.min(1, Math.max(0.3, 1.15 - p.depth / 1500));

      // Outer neural halo for hubs, selected nodes, or search matches
      if (!isDim && (n.isDir || isSel || n._qHit || r > 5.5)) {
        const haloR = r * (isSel || n._qHit ? 3.6 : 2.3);
        const grad = ctx.createRadialGradient(p.sx, p.sy, r * 0.2, p.sx, p.sy, haloR);
        const hCol = n._qHit ? '250, 204, 21' : (rgb[0] + ',' + rgb[1] + ',' + rgb[2]);
        grad.addColorStop(0, 'rgba(' + hCol + ',' + (isSel ? 0.65 : 0.34) + ')');
        grad.addColorStop(1, 'rgba(' + hCol + ',0)');
        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.arc(p.sx, p.sy, haloR, 0, Math.PI * 2);
        ctx.fill();
      }

      // Core soma sphere
      ctx.fillStyle = n._qHit
        ? 'rgba(250, 204, 21,' + alpha + ')'
        : 'rgba(' + rgb[0] + ',' + rgb[1] + ',' + rgb[2] + ',' + alpha + ')';
      ctx.beginPath();
      ctx.arc(p.sx, p.sy, r, 0, Math.PI * 2);
      ctx.fill();

      // Specular highlight dot
      if (!isDim && r > 3.2) {
        ctx.fillStyle = 'rgba(255,255,255,' + (alpha * 0.75) + ')';
        ctx.beginPath();
        ctx.arc(p.sx - r * 0.28, p.sy - r * 0.28, Math.max(0.9, r * 0.32), 0, Math.PI * 2);
        ctx.fill();
      }

      // Floating 3D labels for folder nuclei, selected neighbors, or zoomed-in neurons
      if (S.labelsOn && !isDim && (isSel || n._qHit || n.cat === 'core' || (n.isDir && p.scale > 0.68) || (isNb && selNode) || p.scale > 1.45)) {
        ctx.font = (isSel || n.isDir ? '600 ' : '500 ') + Math.round(Math.max(10, Math.min(14, 11.5 * p.scale))) + 'px sans-serif';
        const lbl = n.name.length > 26 ? n.name.slice(0, 24) + '…' : n.name;
        ctx.fillStyle = isSel || n._qHit ? '#ffffff' : 'rgba(226, 232, 240, 0.88)';
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
      '<div class="brn-wrap">' +
        '<canvas class="brn-cv" id="brn-cv"></canvas>' +
        '<div class="brn-tip" id="brn-tip"></div>' +

        /* Top Glassmorphic HUD */
        '<div class="brn-hud-top">' +
          '<div class="brn-glass brn-brand">' +
            '<div class="brn-brand-ic">🧠</div>' +
            '<div><b>3D File Brain</b><span id="brn-sub">Initializing neural connectome...</span></div>' +
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
            '<button type="button" class="brn-btn" id="brn-reset" title="Reset 3D camera view">🎯 Reset View</button>' +
          '</div>' +
        '</div>' +

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
              '<button type="button" class="brn-act pri" id="brn-i-ask">💬 Ask AI About This File</button>' +
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

    // HUD Controls wiring
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
    root.querySelector('#brn-i-ask').onclick = async () => {
      if (!S.selected) return;
      const n = S.selected;
      const pre = root.querySelector('#brn-i-pre').textContent || '';
      A.showTab('chat');
      const inp = document.getElementById('in');
      if (inp) {
        inp.value = 'Analyze and summarize my file "' + n.name + '" (' + n.path + ')' + (pre ? ':\n\n' + pre.slice(0, 1500) : '');
        inp.focus();
      }
    };
    root.querySelector('#brn-i-conns').onclick = e => {
      const c = e.target.closest('[data-nid]'); if (!c) return;
      const target = S.nodes.find(x => x.id === c.dataset.nid);
      if (target) selectNode(target);
    };

    loadGraph();
    if (!raf) raf = requestAnimationFrame(drawFrame);
  }

  A.brain = { open: () => A.showTab('brain'), reload: loadGraph };
  A.registerTab('brain', '3D Brain', () => { build(); });

  try {
    if (A.cmd && A.cmd.reg) {
      A.cmd.reg([{
        title: '3D File Brain (Neural Connectome of PC Files)',
        sub: 'Explore all files on your PC inside an interactive 3D neural brain & galaxy',
        icon: '🧠',
        group: 'Open',
        tags: '3d brain files pc graph neural network connectome galaxy visualize folders',
        run: () => A.showTab('brain')
      }]);
    }
  } catch (e) { }
})();

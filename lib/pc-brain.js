// 3D PC File Brain backend: scans folders across the user's PC (Desktop, Documents, Downloads, Pictures, Music, Videos,
// indexed My Files sources, or any chosen folder) and builds a 3D neural connectome graph (nodes, folder nuclei, hierarchical
// + semantic + temporal synapses, lobe statistics, and safe file previews).
const fs = require('fs');
const path = require('path');
const os = require('os');
const cp = require('child_process');

const ROOT = path.join(__dirname, '..');
const HOME = os.homedir();

const SKIP_DIRS = new Set([
  'node_modules', '.git', '.svn', '$recycle.bin', 'system volume information',
  'appdata', 'windows', 'program files', 'program files (x86)', 'programdata',
  '__pycache__', '.cache', '.venv', 'venv', 'pyenv', 'target', 'build', 'dist',
  '.next', '.nuxt', '.vs', '.idea', 'temp', 'tmp'
]);

const EXT_CAT = {
  // Documents & Notes
  '.pdf': 'docs', '.doc': 'docs', '.docx': 'docs', '.txt': 'docs', '.md': 'docs',
  '.markdown': 'docs', '.rtf': 'docs', '.odt': 'docs', '.pptx': 'docs', '.ppt': 'docs',
  '.xlsx': 'docs', '.xls': 'docs', '.csv': 'docs', '.tsv': 'docs', '.epub': 'docs',
  // Code & Scripts
  '.js': 'code', '.mjs': 'code', '.cjs': 'code', '.ts': 'code', '.tsx': 'code', '.jsx': 'code',
  '.py': 'code', '.html': 'code', '.htm': 'code', '.css': 'code', '.scss': 'code',
  '.json': 'code', '.ps1': 'code', '.bat': 'code', '.cmd': 'code', '.sh': 'code',
  '.cs': 'code', '.cpp': 'code', '.c': 'code', '.h': 'code', '.hpp': 'code',
  '.java': 'code', '.go': 'code', '.rs': 'code', '.sql': 'code', '.xml': 'code',
  '.yml': 'code', '.yaml': 'code', '.toml': 'code', '.ini': 'code', '.gd': 'code',
  // Images & Design
  '.png': 'images', '.jpg': 'images', '.jpeg': 'images', '.gif': 'images',
  '.svg': 'images', '.webp': 'images', '.ico': 'images', '.bmp': 'images',
  '.tiff': 'images', '.psd': 'images', '.ai': 'images', '.fig': 'images',
  // Audio & Music
  '.mp3': 'audio', '.wav': 'audio', '.ogg': 'audio', '.flac': 'audio',
  '.m4a': 'audio', '.aac': 'audio', '.mid': 'audio', '.midi': 'audio',
  // Video & Media
  '.mp4': 'video', '.webm': 'video', '.mkv': 'video', '.mov': 'video',
  '.avi': 'video', '.wmv': 'video', '.m4v': 'video',
  // Data, Archives & Binaries
  '.zip': 'data', '.7z': 'data', '.rar': 'data', '.tar': 'data', '.gz': 'data',
  '.db': 'data', '.sqlite': 'data', '.sqlite3': 'data', '.jsonl': 'data',
  '.exe': 'data', '.msi': 'data', '.dll': 'data', '.wasm': 'data', '.gguf': 'data'
};

const TEXT_PREVIEW_EXT = new Set([
  '.txt', '.md', '.markdown', '.json', '.js', '.mjs', '.ts', '.tsx', '.jsx',
  '.py', '.html', '.htm', '.css', '.csv', '.tsv', '.ps1', '.bat', '.sh',
  '.xml', '.yml', '.yaml', '.toml', '.ini', '.sql', '.c', '.cpp', '.h', '.cs', '.gd', '.log'
]);

function classifyExt(ext) {
  return EXT_CAT[String(ext || '').toLowerCase()] || 'data';
}

function getDefaultRoots(scope, customPath, extraSources) {
  const roots = [];
  const addIf = (p, label) => {
    try {
      if (p && fs.existsSync(p) && fs.statSync(p).isDirectory()) {
        const norm = path.resolve(p);
        if (!roots.some(r => r.path.toLowerCase() === norm.toLowerCase())) {
          roots.push({ path: norm, label: label || path.basename(norm) || norm });
        }
      }
    } catch (e) { }
  };

  if (scope === 'custom' && customPath) {
    addIf(customPath, path.basename(customPath) || customPath);
    if (roots.length) return roots;
  }
  if (scope === 'workspace') {
    addIf(ROOT, 'Moundshroud');
    return roots;
  }
  if (scope === 'indexed') {
    (extraSources || []).forEach(s => addIf(s, path.basename(s)));
    addIf(path.join(ROOT, 'data', 'notes'), 'Notes');
    if (!roots.length) addIf(path.join(HOME, 'Documents'), 'Documents');
    return roots;
  }

  // 'user' or 'all': scan standard PC user folders
  ['Desktop', 'Documents', 'Downloads', 'Pictures', 'Music', 'Videos'].forEach(name => {
    addIf(path.join(HOME, name), name);
  });
  (extraSources || []).forEach(s => addIf(s, path.basename(s)));
  if (scope === 'all' || !roots.length) {
    addIf(ROOT, 'Moundshroud');
  }
  return roots;
}

function extractStemTokens(name) {
  return String(name || '')
    .replace(/\.[^.]+$/, '')
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter(w => w.length >= 4 && !/^(file|copy|data|test|main|index|page|item|part|temp|untitled|document)$/.test(w));
}

function scanGraph(opts = {}) {
  const scope = opts.scope || 'all';
  const maxNodes = Math.max(120, Math.min(900, Number(opts.maxNodes) || 480));
  const roots = getDefaultRoots(scope, opts.path, opts.sources);

  const nodes = [];
  const links = [];
  const nodeById = new Map();
  const stats = {
    totalFiles: 0,
    totalFolders: 0,
    totalBytes: 0,
    byCat: { docs: 0, code: 0, images: 0, audio: 0, video: 0, data: 0, folder: 0 },
    roots: roots.map(r => r.path)
  };

  const addNode = n => {
    nodeById.set(n.id, n);
    nodes.push(n);
    return n;
  };

  // Create a central Brain Core node if multiple roots exist
  const coreId = 'core:pc';
  addNode({
    id: coreId,
    name: os.hostname() || 'My PC',
    path: HOME,
    cat: 'core',
    isDir: true,
    depth: 0,
    size: 0,
    mtime: Date.now()
  });

  // BFS queue across roots so every root folder is evenly represented
  const queue = [];
  for (const r of roots) {
    const rId = 'dir:' + r.path.toLowerCase();
    if (!nodeById.has(rId)) {
      addNode({
        id: rId,
        name: r.label,
        path: r.path,
        cat: 'folder',
        isDir: true,
        depth: 1,
        size: 0,
        mtime: Date.now(),
        rootLabel: r.label
      });
      stats.totalFolders++;
      stats.byCat.folder++;
      links.push({ source: coreId, target: rId, kind: 'tree', weight: 1.5 });
      queue.push({ dirPath: r.path, parentId: rId, depth: 1, rootLabel: r.label });
    }
  }

  while (queue.length && nodes.length < maxNodes) {
    const { dirPath, parentId, depth, rootLabel } = queue.shift();
    if (depth > 4) continue;
    let entries = [];
    try {
      entries = fs.readdirSync(dirPath, { withFileTypes: true });
    } catch (e) {
      continue;
    }

    // Prioritize interesting files and non-hidden items
    const filtered = entries.filter(e => {
      if (!e || !e.name || e.name.startsWith('.')) return false;
      if (e.isDirectory() && SKIP_DIRS.has(e.name.toLowerCase())) return false;
      return true;
    }).slice(0, 65);

    for (const ent of filtered) {
      if (nodes.length >= maxNodes) break;
      const full = path.join(dirPath, ent.name);
      let st;
      try { st = fs.statSync(full); } catch (e) { continue; }

      if (ent.isDirectory()) {
        const dId = 'dir:' + full.toLowerCase();
        if (nodeById.has(dId)) continue;
        addNode({
          id: dId,
          name: ent.name,
          path: full,
          cat: 'folder',
          isDir: true,
          depth: depth + 1,
          size: 0,
          mtime: st.mtimeMs || Date.now(),
          rootLabel
        });
        stats.totalFolders++;
        stats.byCat.folder++;
        links.push({ source: parentId, target: dId, kind: 'tree', weight: 1.2 });
        queue.push({ dirPath: full, parentId: dId, depth: depth + 1, rootLabel });
      } else if (ent.isFile()) {
        const fId = 'file:' + full.toLowerCase();
        if (nodeById.has(fId)) continue;
        const ext = path.extname(ent.name).toLowerCase();
        const cat = classifyExt(ext);
        const sz = st.size || 0;
        addNode({
          id: fId,
          name: ent.name,
          path: full,
          ext,
          cat,
          isDir: false,
          depth: depth + 1,
          size: sz,
          mtime: st.mtimeMs || Date.now(),
          rootLabel,
          tokens: extractStemTokens(ent.name)
        });
        stats.totalFiles++;
        stats.totalBytes += sz;
        stats.byCat[cat] = (stats.byCat[cat] || 0) + 1;
        links.push({ source: parentId, target: fId, kind: 'tree', weight: 1.0 });

        // Roll up size to parent folder
        const pNode = nodeById.get(parentId);
        if (pNode) pNode.size = (pNode.size || 0) + sz;
      }
    }
  }

  // 2. Build Semantic Synapses (cross-links between files sharing stem tokens across the PC)
  const tokenMap = new Map();
  for (const n of nodes) {
    if (n.isDir || !n.tokens) continue;
    for (const tk of n.tokens) {
      if (!tokenMap.has(tk)) tokenMap.set(tk, []);
      tokenMap.get(tk).push(n.id);
    }
  }
  let semCount = 0;
  for (const [tk, ids] of tokenMap.entries()) {
    if (ids.length < 2 || ids.length > 14) continue;
    for (let i = 0; i < ids.length - 1 && semCount < 220; i++) {
      links.push({ source: ids[i], target: ids[i + 1], kind: 'semantic', label: tk, weight: 0.7 });
      semCount++;
    }
  }

  // 3. Build Temporal Co-Activation Synapses (files modified close in time)
  const fileNodes = nodes.filter(n => !n.isDir && n.mtime).sort((a, b) => b.mtime - a.mtime);
  let tempCount = 0;
  for (let i = 0; i < Math.min(60, fileNodes.length - 1) && tempCount < 45; i++) {
    const a = fileNodes[i], b = fileNodes[i + 1];
    if (Math.abs(a.mtime - b.mtime) < 3600 * 1000 * 6 && a.id !== b.id) {
      links.push({ source: a.id, target: b.id, kind: 'temporal', weight: 0.5 });
      tempCount++;
    }
  }

  // Clean out temporary token arrays to keep JSON payload compact
  nodes.forEach(n => { delete n.tokens; });

  return { ok: true, nodes, links, stats };
}

function inspectFile(filePath) {
  try {
    if (!filePath || typeof filePath !== 'string') return { error: 'Missing path' };
    const norm = path.resolve(filePath);
    if (!fs.existsSync(norm)) return { error: 'File no longer exists on disk.' };
    const st = fs.statSync(norm);
    if (st.isDirectory()) {
      let children = [];
      try { children = fs.readdirSync(norm).slice(0, 40); } catch (e) { }
      return {
        ok: true,
        path: norm,
        name: path.basename(norm) || norm,
        isDir: true,
        size: st.size || 0,
        mtime: st.mtimeMs,
        children
      };
    }
    const ext = path.extname(norm).toLowerCase();
    let preview = '';
    if (TEXT_PREVIEW_EXT.has(ext) && st.size <= 2 * 1048576) {
      try {
        preview = fs.readFileSync(norm, 'utf8').slice(0, 2400);
      } catch (e) { }
    }
    return {
      ok: true,
      path: norm,
      name: path.basename(norm),
      ext,
      cat: classifyExt(ext),
      isDir: false,
      size: st.size,
      mtime: st.mtimeMs,
      ctime: st.birthtimeMs || st.ctimeMs,
      preview
    };
  } catch (e) {
    return { error: e.message || 'Could not inspect file.' };
  }
}

function revealInExplorer(filePath, openDirectly) {
  try {
    if (!filePath || typeof filePath !== 'string') return { error: 'Missing path' };
    const norm = path.resolve(filePath);
    if (!fs.existsSync(norm)) return { error: 'Path not found' };
    const args = openDirectly ? [norm] : ['/select,' + norm];
    cp.spawn('explorer.exe', args, { detached: true, stdio: 'ignore' }).unref();
    return { ok: true };
  } catch (e) {
    return { error: e.message };
  }
}

module.exports = { scanGraph, inspectFile, revealInExplorer };

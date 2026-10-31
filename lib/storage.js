// Storage report and safe clean-up: where the disk space goes (libraries, AI models, music, snapshots...) and two safe ways to get some back.
const fs = require('fs'), path = require('path'), os = require('os');
const ROOT = path.join(__dirname, '..');
const exists = p => { try { return fs.existsSync(p); } catch (e) { return false; } };
async function size(dir, skip) {
  let total = 0, files = 0; const stack = [dir];
  while (stack.length) {
    const d = stack.pop(); let ents; try { ents = await fs.promises.readdir(d, { withFileTypes: true }); } catch (e) { continue; }
    await Promise.all(ents.map(async e => {
      const p = path.join(d, e.name); if (skip && skip(p)) return;
      if (e.isDirectory()) stack.push(p); else if (e.isFile()) { try { const s = (await fs.promises.stat(p)).size; total += s; files++; } catch (x) { } }     // await BEFORE adding: "total += await ..." reads total first and loses concurrent updates
    }));
  }
  return { bytes: total, files };
}
const docsDir = () => { const c = [path.join(process.env.OneDrive || '', 'Documents'), path.join(os.homedir(), 'Documents')]; return c.find(p => p && exists(p)) || c[1]; };
const GROUPS = () => [
  { id: 'lib', name: 'Offline libraries', note: 'Wikipedia, Q&A sites, books. The biggest part, and the reason Moundshroud works with no internet.', dir: path.join(ROOT, 'nomad', 'library'), keep: 1 },
  { id: 'models', name: 'AI models', note: 'The language models Moundshroud thinks with (stored by Ollama). Remove one you no longer use from Prepare > Stock up or with "ollama rm".', dir: process.env.OLLAMA_MODELS || path.join(os.homedir(), '.ollama', 'models'), keep: 1 },
  { id: 'music', name: 'Music', note: 'The built-in music library in web/music.', dir: path.join(ROOT, 'web', 'music') },
  { id: 'data', name: 'Reference data', note: 'Bibles, recipes, devotional books, code-breaking and course data in web/data.', dir: path.join(ROOT, 'web', 'data') },
  { id: 'snap', name: 'Rollback snapshots', note: 'A zip of Moundshroud\'s own code saved before every change, so any update can be undone. Old ones can be deleted.', dir: path.join(ROOT, '_snapshots'), clean: 'snapshots' },
  { id: 'profile', name: 'Moundshroud window profile', note: 'The Moundshroud window\'s own browser data: your imported music, settings and its cache. The cache can be cleared safely.', dir: path.join(ROOT, 'edge-profile'), clean: 'cache' },
  { id: 'docs', name: 'Your documents', note: 'Moundshroud Documents and Assistant Notes in your Documents folder.', dirs: [path.join(docsDir(), 'Moundshroud Documents'), path.join(docsDir(), 'Assistant Notes')] },
  { id: 'tools', name: 'Other app files', note: 'Moundshroud code, CyberChef, helper programs and saved app data.', dir: ROOT, skip: p => /[\\/](nomad|_snapshots|edge-profile|node_modules)$/.test(p) || /[\\/]web[\\/](music|data)$/.test(p) },
];
let cache = null;
async function report(force) {
  if (!force && cache && Date.now() - cache.at < 90000) return cache.v;
  const out = [];
  for (const g of GROUPS()) {
    let bytes = 0, files = 0; for (const d of (g.dirs || [g.dir])) { if (!exists(d)) continue; const r = await size(d, g.skip); bytes += r.bytes; files += r.files; }
    out.push({ id: g.id, name: g.name, note: g.note, bytes, files, clean: g.clean || '', path: g.dir || (g.dirs || [])[0] || '' });
  }
  let disk = null; try { const s = fs.statfsSync(path.parse(ROOT).root); disk = { free: s.bavail * s.bsize, total: s.blocks * s.bsize }; } catch (e) { }
  const snaps = exists(path.join(ROOT, '_snapshots')) ? fs.readdirSync(path.join(ROOT, '_snapshots')).filter(f => /\.zip$/i.test(f)).length : 0;
  const v = { groups: out, disk, snapshots: snaps, at: Date.now() }; cache = { at: Date.now(), v }; return v;
}
async function clean(what, keep) {
  let freed = 0;
  if (what === 'snapshots') {
    const dir = path.join(ROOT, '_snapshots'); keep = Math.max(3, Math.min(100, +keep || 10)); if (!exists(dir)) return { freed: 0, removed: 0 };
    const zips = fs.readdirSync(dir).filter(f => /\.zip$/i.test(f)).map(f => ({ f, t: fs.statSync(path.join(dir, f)).mtimeMs, s: fs.statSync(path.join(dir, f)).size })).sort((a, b) => b.t - a.t);
    let n = 0; for (const z of zips.slice(keep)) { try { fs.unlinkSync(path.join(dir, z.f)); freed += z.s; n++; } catch (e) { } } cache = null; return { freed, removed: n, kept: Math.min(keep, zips.length) };
  }
  if (what === 'cache') {
    const base = path.join(ROOT, 'edge-profile'), targets = ['Default/Cache', 'Default/Code Cache', 'Default/GPUCache', 'Default/DawnCache', 'GrShaderCache', 'ShaderCache', 'GraphiteDawnCache', 'component_crx_cache'].map(p => path.join(base, p)); let n = 0;
    for (const t of targets) { if (!exists(t)) continue; const r = await size(t); try { fs.rmSync(t, { recursive: true, force: true }); freed += r.bytes; n++; } catch (e) { } }
    cache = null; return { freed, removed: n };
  }
  return { freed: 0, removed: 0, error: 'unknown action' };
}
module.exports = { report, clean };

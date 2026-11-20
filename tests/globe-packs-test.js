// Offline Region Packs (3D Globe > Offline): the client sends maxZ: null until the first estimate returns, and
// Number(null) is 0, so lib/globe.js once read null as "a number" and turned it into NaN. The plan then had 0 tiles
// and every download ended with "No tiles could be downloaded (check internet connection)".
// This test runs a real pack job in a temp data folder. The tiles are pre-seeded in the browsing cache, so the job
// copies them without touching the internet.
const fs = require('fs');
const os = require('os');
const path = require('path');

function lonLatToTile(lon, lat, z) {
  const n = Math.pow(2, z);
  const latRad = Math.max(-85.0511, Math.min(85.0511, lat)) * Math.PI / 180;
  const x = Math.max(0, Math.min(n - 1, Math.floor(((lon + 180) / 360) * n)));
  const y = Math.max(0, Math.min(n - 1, Math.floor(((1 - Math.log(Math.tan(latRad) + 1 / Math.cos(latRad)) / Math.PI) / 2) * n)));
  return { x, y };
}

async function run(ok) {
  const ROOT = path.join(__dirname, '..');
  const glMod = require(path.join(ROOT, 'lib', 'globe.js'));
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'mound-globe-packs-'));
  console.log('3D Globe offline region packs');
  // Tile servers that refuse with HTTP 200 and a picture: the picture must never be cached or saved in a pack
  const T = glMod._t;
  ok('globe packs: an OpenStreetMap x-blocked reply counts as a refusal',
    /refused/.test(T.tileRefusal({ 'x-blocked': 'Access denied. See https://operations.osmfoundation.org/policies/tiles/' })));
  ok('globe packs: a CARTO "wm-" ETag (API KEY REQUIRED tile) counts as a refusal',
    /API key/.test(T.tileRefusal({ etag: '"wm-da89c20e77c1-dark"' })));
  ok('globe packs: an ordinary tile reply is not a refusal',
    T.tileRefusal({ etag: '"5f1c-abc"', 'content-type': 'image/png' }) === '' && !T.isRefusalTile(Buffer.alloc(6725, 1)));
  try {
    const gl = glMod.create(tmp, null);
    const bbox = { south: 30.265, north: 30.27, west: -97.745, east: -97.74 };

    // Every way the client can say "pick for me": null, missing, empty string
    const ests = [null, undefined, ''].map(v => gl.estimatePack({ bbox, style: 'streets', maxZ: v, minZ: v }));
    ok('globe packs: estimate with maxZ/minZ null, missing or "" picks a real zoom range and tile count',
      ests.every(e => e.ok && Number.isFinite(e.maxZ) && Number.isFinite(e.minZ) && e.tiles > 0 && e.maxZ >= e.minZ),
      JSON.stringify(ests.map(e => ({ minZ: e.minZ, maxZ: e.maxZ, tiles: e.tiles }))));
    const est = ests[0];
    ok('globe packs: estimate survives a JSON round trip (no NaN turning into null)',
      JSON.parse(JSON.stringify(est)).maxZ === est.maxZ);

    // Seed the browsing cache with every tile the plan needs, so the job runs offline
    const bb = est.bbox;
    let seeded = 0;
    for (let z = est.minZ; z <= est.maxZ; z++) {
      const a = lonLatToTile(bb.west, bb.north, z), b = lonLatToTile(bb.east, bb.south, z);
      for (let x = Math.min(a.x, b.x); x <= Math.max(a.x, b.x); x++) {
        for (let y = Math.min(a.y, b.y); y <= Math.max(a.y, b.y); y++) {
          const fp = path.join(tmp, 'globe-tiles', 'streets', String(z), x + '_' + y + '.tile');
          fs.mkdirSync(path.dirname(fp), { recursive: true });
          fs.writeFileSync(fp, Buffer.from('PNGSTUB-' + z + '-' + x + '-' + y));
          seeded++;
        }
      }
    }
    ok('globe packs: seeded tile count matches the estimate', seeded === est.tiles, 'seeded ' + seeded + ', estimate ' + est.tiles);

    // The exact body the drawer sends on its first click: maxZ still null
    const start = gl.startPack({ name: 'Test Town', bbox, style: 'streets', maxZ: null });
    ok('globe packs: download with maxZ null starts a job with tiles queued',
      start.ok && start.job && start.job.total === est.tiles && Number.isFinite(start.job.maxZ),
      JSON.stringify(start));

    let list = gl.listPacks();
    for (let i = 0; i < 100 && list.activeJob && list.activeJob.status === 'running'; i++) {
      await new Promise(r => setTimeout(r, 30));
      list = gl.listPacks();
    }
    const pk = list.packs[0];
    ok('globe packs: job finishes "done" and saves the pack with every tile',
      list.activeJob && list.activeJob.status === 'done' && pk && pk.tiles === est.tiles && pk.bytes > 0,
      JSON.stringify(list.activeJob));

    // The saved pack serves tiles even after the browsing cache is cleared
    gl.clearCache();
    const a = lonLatToTile(bb.west, bb.north, est.maxZ);
    let code = 0, hdr = {}, body = '';
    await gl.serveTile(new URLSearchParams('s=streets&z=' + est.maxZ + '&x=' + a.x + '&y=' + a.y), {
      writeHead(c, h) { code = c; hdr = h || {}; },
      end(b) { body = String(b || ''); }
    });
    ok('globe packs: saved tile is served from the pack (X-Globe-Cache PACK) with the cache empty',
      code === 200 && hdr['X-Globe-Cache'] === 'PACK' && body.startsWith('PNGSTUB-'),
      'status ' + code + ' cache ' + hdr['X-Globe-Cache']);
  } finally {
    try { fs.rmSync(tmp, { recursive: true, force: true }); } catch (e) { }
  }
}

module.exports = run;

if (require.main === module) {
  let pass = 0, fail = 0;
  const ok = (name, cond, detail) => {
    if (cond) { pass++; console.log('  ok   ' + name); }
    else { fail++; console.log('  FAIL ' + name + (detail ? '  ->  ' + detail : '')); }
  };
  run(ok).then(() => {
    console.log('\n' + pass + ' passed, ' + fail + ' failed');
    process.exit(fail ? 1 : 0);
  });
}

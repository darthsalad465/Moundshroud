// Automated checks for the 3D World Globe + GodMode OSINT Suite (MapLibre GL JS v5 + zero-lag GPU + capped 150 MB cache).
const fs = require('fs');
const path = require('path');

async function run(ok) {
  const ROOT = path.join(__dirname, '..');
  const rd = rel => fs.readFileSync(path.join(ROOT, rel), 'utf8');
  const vendorDir = path.join(ROOT, 'web', 'vendor', 'globe');
  const dataDir = path.join(vendorDir, 'data');

  console.log('3D World Globe + GodMode OSINT architecture & storage guard');
  ok('globe: MapLibre GL JS v5 library and CSS are bundled in web/vendor/globe/', fs.existsSync(path.join(vendorDir, 'maplibre-gl.js')) && fs.existsSync(path.join(vendorDir, 'maplibre-gl.css')));

  const geoFiles = ['countries.json', 'states.json', 'lakes.json', 'rivers.json', 'cities.json'];
  ok('globe: all 5 Natural Earth 50m GeoJSON datasets are bundled in web/vendor/globe/data/', geoFiles.every(f => fs.existsSync(path.join(dataDir, f))));

  const countries = JSON.parse(fs.readFileSync(path.join(dataDir, 'countries.json'), 'utf8'));
  const cities = JSON.parse(fs.readFileSync(path.join(dataDir, 'cities.json'), 'utf8'));
  const idx = JSON.parse(fs.readFileSync(path.join(dataDir, 'search-index.json'), 'utf8'));
  ok('globe: countries GeoJSON has 200+ features', Array.isArray(countries.features) && countries.features.length >= 200, 'count ' + (countries.features || []).length);
  ok('globe: cities GeoJSON has 1,000+ cities & capitals', Array.isArray(cities.features) && cities.features.length >= 1000, 'count ' + (cities.features || []).length);
  ok('globe: pre-indexed search catalog has 1,400+ places with coordinates', Array.isArray(idx) && idx.length >= 1400 && idx.every(p => typeof p.lat === 'number' && typeof p.lon === 'number'));

  const srv = rd('server.js');
  const html = rd('web/index.html');
  const glb = rd('web/js/globe.js');
  const main = rd('web/js/main.js');
  ok('globe: server.js serves /globe/, .geojson MIME, tile/geocode/feed/packs proxies & POST-only mutating routes',
    srv.includes("url.startsWith('/globe/')") && srv.includes("'.geojson'") &&
    srv.includes("'/api/globe/tile'") && srv.includes("'/api/globe/geocode'") &&
    srv.includes("'/api/globe/status'") && srv.includes("'/api/globe/feed'") &&
    srv.includes("url === '/api/globe/cache/clear' && req.method === 'POST'") &&
    srv.includes("url === '/api/globe/packs' && req.method === 'GET'") &&
    srv.includes("url === '/api/globe/packs/estimate' && req.method === 'POST'") &&
    srv.includes("url === '/api/globe/packs/download' && req.method === 'POST'") &&
    srv.includes("url === '/api/globe/packs/cancel' && req.method === 'POST'") &&
    srv.includes("url === '/api/globe/packs/delete' && req.method === 'POST'"));

  const camsLib = require(path.join(ROOT, 'lib', 'cams.js'));
  const glMod = require(path.join(ROOT, 'lib', 'globe.js'));
  const gl = glMod.create(path.join(ROOT, 'data'), camsLib);
  const st = gl.status();
  ok('globe: lib/globe.js enforces <=150 MB tile cache cap and registers all tile & OSINT feeds',
    st.ok && glMod.MAX_CACHE_BYTES <= 150 * 1024 * 1024 &&
    ['satellite', 'labels', 'streets', 'topo', 'dark', 'radar'].every(k => st.layers.includes(k)) &&
    ['flights', 'military', 'satellites', 'quakes', 'events', 'radar', 'cams'].every(k => st.feeds.includes(k)));

  const townEst = gl.estimatePack({ bbox: { south: 30.18, north: 30.42, west: -97.86, east: -97.62 }, style: 'streets' });
  const giantEst = gl.estimatePack({ bbox: { south: 25, north: 49, west: -124, east: -67 }, style: 'hybrid', maxZ: 15 });
  const badDel = gl.deletePack('../outside');
  ok('globe: offline region estimator computes accurate town tiles, blocks oversized packs (>4000 tiles) & rejects path traversal deletes',
    townEst.ok && townEst.tiles > 10 && townEst.tiles <= glMod.MAX_PACK_TILES && townEst.estMB > 0 &&
    giantEst.ok && giantEst.tooLarge === true &&
    badDel.ok === false,
    'town=' + townEst.tiles + ' giantTooLarge=' + giantEst.tooLarge);

  const camsFeed = await gl.getFeed('cams');
  ok('globe: built-in geocoded cams feed returns 50+ global 24/7 cameras with valid coordinates (0 MB extra storage)',
    camsFeed.ok && Array.isArray(camsFeed.items) && camsFeed.items.length >= 50 &&
    camsFeed.items.every(c => /^[A-Za-z0-9_-]{11}$/.test(c.id) && Number.isFinite(c.lat) && Number.isFinite(c.lon)),
    'count ' + (camsFeed.items || []).length);

  // Verify radar path SSRF/traversal validation rejects malicious paths with HTTP 400
  let radarBadCode = 0;
  await gl.serveTile(new URLSearchParams('s=radar&z=2&x=1&y=1&p=https://evil.com/x'), {
    writeHead(code) { radarBadCode = code; },
    end() {}
  });
  ok('globe: radar tile proxy rejects malformed/SSRF path parameters with HTTP 400', radarBadCode === 400, 'status ' + radarBadCode);

  ok('globe: frontend routes all online tiles & live OSINT feeds through same-origin /api/globe/* (CSP-safe)',
    glb.includes('/api/globe/tile?s=') && glb.includes('/api/globe/geocode?q=') && glb.includes('/api/globe/feed?k=') &&
    !/https:\/\/(server\.arcgisonline|tile\.openstreetmap|a\.tile\.opentopomap|opensky-network|api\.adsb\.lol|celestrak|earthquake\.usgs|eonet\.gsfc\.nasa|api\.rainviewer)/.test(glb));

  ok('globe: index.html and main.js wire #p-globe and globe.js', html.includes('id="p-globe"') && html.includes('/web/js/globe.js') && main.includes("'globe'"));
  ok('globe: does NOT override .panel position:absolute on #p-globe (prevents 0px height collapse)', !/#p-globe\{[^}]*position\s*:\s*relative/i.test(glb));
  ok('globe: pre-fetches GeoJSON into DATA_CACHE on main thread (avoids blob: worker relative-URL failures)', /function loadGlobeData\(/.test(glb) && /DATA_CACHE\.countries/.test(glb));
  ok('globe: applies MapLibre 3D globe projection + sky on style.load without invalid nested zoom expressions',
    /map\.on\('style\.load'/.test(glb) &&
    /map\.setProjection\(\{\s*type:\s*S\.proj\s*\}\)/.test(glb) &&
    !/\['case',[^\n]*\['interpolate'/.test(glb));
  const resetHandler = glb.match(/root\.querySelector\('#glb-reset'\)\.onclick\s*=\s*\(\)\s*=>\s*\{([\s\S]*?)\n\s*\};/);
  ok('globe: Reset refreshes the status after restoring 3D projection', !!resetHandler && /updateSubtitle\(\)/.test(resetHandler[1]));
  ok('globe: applies 3D Brain zero-lag GPU rules (capped pixelRatio, fadeDuration 0, no backdrop-filter blur, idle pause)',
    /pixelRatio:\s*Math\.min\(window\.devicePixelRatio \|\| 1,\s*1\.5\)/.test(glb) &&
    /fadeDuration:\s*0/.test(glb) &&
    !/backdrop-filter\s*:\s*blur/i.test(glb) &&
    /A\.cur !== 'globe' \|\| document\.hidden/.test(glb));
  ok('globe: includes full GodMode OSINT suite (NVG/FLIR/CRT/Noir, flights, military, orbital propagator, quakes, hazards, weather, webcams, cables, 250km scan, chase-cam lock, AI commander)',
    /fx-nvg/.test(glb) && /fx-flir/.test(glb) && /fx-crt/.test(glb) && /fx-noir/.test(glb) &&
    /function propagateGP\(/.test(glb) && /function scanArea250\(/.test(glb) &&
    /function setTargetLock\(/.test(glb) && /function runAiCommand\(/.test(glb) &&
    /SUBMARINE_CABLES/.test(glb) && /youtube-nocookie\.com\/embed\//.test(glb));
  ok('globe: includes Offline Region Packs downloader (town/county/state/country search, map-view snap, live MB estimate, progress/cancel, saved borders & delete)',
    /function openPacksDrawer\(/.test(glb) && /function startPackDownload\(/.test(glb) &&
    /function selectPackFromViewport\(/.test(glb) && /function deleteSavedPack\(/.test(glb) &&
    /packs-saved-line/.test(glb) && /pack-preview-line/.test(glb) && /\/api\/globe\/packs\/download/.test(glb));
  ok('globe: uses Moundshroud in-app A.prompt & A.confirm (zero native Windows popups)',
    /await A\.prompt\(/.test(glb) && /await A\.confirm\(/.test(glb) && !/(?<![.\w$])(alert|confirm|prompt)\s*\(/.test(glb));
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

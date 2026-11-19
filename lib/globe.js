// Same-origin tile proxy + capped SSD cache (<=150 MB) + Nominatim geocoder + live OSINT telemetry feeds (GodMode / God's Eye View).
// Keeps Moundshroud's strict CSP ('self') intact, uses zero external storage for live feeds (short in-memory TTL caches),
// and auto-prunes data/globe-tiles/ so map caching never bloats the user's disk.
const fs = require('fs');
const path = require('path');
const https = require('https');

const UA = 'MoundshroudOfflineAssistant/1.2 (+https://localhost; desktop-atlas)';
const MAX_CACHE_BYTES = 150 * 1024 * 1024; // Hard 150 MB cap on optional browsing tile cache
const PRUNE_TARGET_BYTES = 115 * 1024 * 1024;
const MAX_PACK_TILES = 4000; // Safety cap per offline region download (prevents accidental multi-GB downloads)
const RADAR_PATH_RE = /^\/v2\/radar\/[0-9a-zA-Z_-]{1,64}$/;
const PACK_ID_RE = /^[a-z0-9_-]{4,48}$/;
const PACK_STYLES = {
  hybrid: ['satellite', 'labels'],
  satellite: ['satellite'],
  streets: ['streets'],
  dark: ['dark'],
  topo: ['topo']
};
const AVG_TILE_BYTES = { satellite: 22000, labels: 8500, streets: 16500, dark: 12000, topo: 24000 };

function clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)); }
function lonLatToTile(lon, lat, z) {
  const n = Math.pow(2, z);
  const latRad = clamp(lat, -85.0511, 85.0511) * Math.PI / 180;
  const x = clamp(Math.floor(((lon + 180) / 360) * n), 0, n - 1);
  const y = clamp(Math.floor(((1 - Math.log(Math.tan(latRad) + 1 / Math.cos(latRad)) / Math.PI) / 2) * n), 0, n - 1);
  return { x, y };
}
function normalizeBbox(raw) {
  if (!raw) return null;
  let s, n, w, e;
  if (Array.isArray(raw) && raw.length >= 4) {
    // Nominatim format: [south, north, west, east]
    s = parseFloat(raw[0]); n = parseFloat(raw[1]); w = parseFloat(raw[2]); e = parseFloat(raw[3]);
  } else if (typeof raw === 'object') {
    s = parseFloat(raw.south); n = parseFloat(raw.north); w = parseFloat(raw.west); e = parseFloat(raw.east);
  }
  if (![s, n, w, e].every(Number.isFinite)) return null;
  if (s > n) { const t = s; s = n; n = t; }
  if (w > e) { const t = w; w = e; e = t; }
  s = clamp(s, -85, 85); n = clamp(n, -85, 85);
  w = clamp(w, -180, 180); e = clamp(e, -180, 180);
  if (n - s < 0.005) { s = clamp(s - 0.015, -85, 85); n = clamp(n + 0.015, -85, 85); }
  if (e - w < 0.005) { w = clamp(w - 0.015, -180, 180); e = clamp(e + 0.015, -180, 180); }
  return { south: +s.toFixed(5), north: +n.toFixed(5), west: +w.toFixed(5), east: +e.toFixed(5) };
}
function tileRangesForZoom(bbox, z) {
  const tl = lonLatToTile(bbox.west, bbox.north, z);
  const br = lonLatToTile(bbox.east, bbox.south, z);
  return { x0: Math.min(tl.x, br.x), x1: Math.max(tl.x, br.x), y0: Math.min(tl.y, br.y), y1: Math.max(tl.y, br.y) };
}
function countPackTiles(bbox, layers, minZ, maxZ) {
  let tiles = 0, estBytes = 0;
  for (let z = minZ; z <= maxZ; z++) {
    const r = tileRangesForZoom(bbox, z);
    const cnt = (r.x1 - r.x0 + 1) * (r.y1 - r.y0 + 1);
    for (const ly of layers) {
      tiles += cnt;
      estBytes += cnt * (AVG_TILE_BYTES[ly] || 18000);
    }
  }
  return { tiles, estBytes };
}

const SOURCES = {
  satellite: {
    url: (z, x, y) => `https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/${z}/${y}/${x}`,
    ct: 'image/jpeg', maxZ: 18, disk: true
  },
  labels: {
    url: (z, x, y) => `https://server.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/${z}/${y}/${x}`,
    ct: 'image/png', maxZ: 18, disk: true
  },
  streets: {
    url: (z, x, y) => `https://tile.openstreetmap.org/${z}/${x}/${y}.png`,
    ct: 'image/png', maxZ: 19, disk: true
  },
  topo: {
    url: (z, x, y) => `https://a.tile.opentopomap.org/${z}/${x}/${y}.png`,
    ct: 'image/png', maxZ: 17, disk: true
  },
  dark: {
    url: (z, x, y) => `https://a.basemaps.cartocdn.com/dark_all/${z}/${x}/${y}.png`,
    ct: 'image/png', maxZ: 19, disk: true
  },
  radar: {
    url: (z, x, y, p) => `https://tilecache.rainviewer.com${p}/256/${z}/${x}/${y}/2/1_1.png`,
    ct: 'image/png', maxZ: 12, disk: false
  }
};

// Curated coordinates for iconic 24/7 public cameras from lib/cams.js (zero extra storage, 100% CSP-safe YouTube nocookie embeds)
const CAM_GEO = [
  ['VGnFLdQW39A', 40.7580, -73.9855, 'Times Square, New York'],
  ['tErYxn2UM5Y', 40.7061, -73.9969, 'Brooklyn Bridge, New York'],
  ['xqdukYhcGEU', 29.9584, -90.0644, 'French Quarter, New Orleans'],
  ['zMCea32gpmg', 51.5320, -0.1780, 'Abbey Road, London'],
  ['uDBYuEV4zjI', 51.4700, -0.4543, 'Heathrow Airport, London'],
  ['3nyPER2kzqk', 53.3498, -6.2603, 'Dublin, Ireland'],
  ['dfVK7ld38Ys', 35.6595, 139.7004, 'Shibuya Crossing, Tokyo'],
  ['DjdUEyjx8GM', 35.6938, 139.7034, 'Shinjuku Kabukicho, Tokyo'],
  ['hlbh4P0Mz8M', 35.6272, 139.7711, 'Odaiba & Rainbow Bridge, Tokyo'],
  ['TPIzbMwlrOI', 43.0568, 141.3508, 'Sapporo, Hokkaido'],
  ['VAS9A0LRGHA', 48.1374, 11.5755, 'Marienplatz, Munich'],
  ['LkZZTkRHLVQ', 43.0772, -70.7576, 'Portsmouth, New Hampshire'],
  ['LMHUcDktP-w', 31.7767, 35.2345, 'Western Wall, Jerusalem'],
  ['ac0v_QwqYfw', 18.4762, -77.9190, 'Montego Bay, Jamaica'],
  ['0wHWHAFnNh0', 43.1729, 16.4411, 'Hvar, Croatia'],
  ['FWvIPfxK5Jo', 7.0731, 125.6128, 'Davao City, Philippines'],
  ['n4I0d44oBEs', 33.9416, -118.4085, 'LAX Airport Runways, Los Angeles'],
  ['0IgjqQzibqE', 33.9850, -118.4695, 'Venice Beach, Los Angeles'],
  ['V7_orOtu-oo', 36.0840, -115.1537, 'Las Vegas Airport, Nevada'],
  ['EiUyBIcG4fQ', 41.7868, -87.7522, 'Midway Airport, Chicago'],
  ['T_QsY01tIK0', 40.7769, -73.8740, 'LaGuardia Airport, New York'],
  ['_GUsXnlVJmo', 25.7959, -80.2870, 'Miami Intl Airport, Florida'],
  ['DxZziUUr6CY', 25.7743, -80.1709, 'Port Miami, Florida'],
  ['pXx3YQVSUGg', 26.1224, -80.1030, 'Fort Lauderdale Beach, Florida'],
  ['iHJbTrQSZys', 24.5551, -81.8050, 'Key West Harbor, Florida'],
  ['HkHhXsWci7Q', 29.2869, -94.8129, 'Galveston Beach, Texas'],
  ['GL_2CrLwSDA', 20.6900, -156.4417, 'Wailea Beach, Maui, Hawaii'],
  ['HggWKlZv9yk', 19.4069, -155.2834, 'Kilauea Volcano Crater, Hawaii'],
  ['EGk3Mr0OshE', 37.7510, 14.9934, 'Mount Etna Volcano, Sicily'],
  ['qkSvU9j4kqM', 63.8800, -22.4300, 'Reykjanes Volcano Watch, Iceland'],
  ['2IQmpCXbOmM', 18.0410, -63.1089, 'Maho Beach / SXM Airport, Sint Maarten'],
  ['_ZXMjk5K0_s', 12.5513, -70.0565, 'Eagle Beach, Aruba'],
  ['loHbMM9JfCs', 12.0884, -68.8980, 'Mambo Beach, Curacao'],
  ['AAlo3eCPVbk', 28.9455, -13.6052, 'Lanzarote Airport, Canary Islands'],
  ['HYAfFvdRvdA', 28.1436, -15.4170, 'Las Palmas Port, Canary Islands'],
  ['hRw1_JQMQoE', 39.5696, 2.6502, 'Palma de Mallorca, Spain'],
  ['6hPWq2IG08M', 60.1546, 24.9210, 'West Harbour, Helsinki, Finland'],
  ['LwihxyJ4V20', 67.8040, 24.8082, 'Levi Ski Resort, Lapland, Finland'],
  ['enYFXf8u7Lc', 46.5590, 7.9821, 'Swiss Alps Panorama, Switzerland'],
  ['Y1qp-EVF_oU', 46.5405, 11.8350, 'Dolomites Alps, Italy'],
  ['NIuO6hrFTrg', 47.2692, 11.4041, 'Austrian Alps Panorama, Austria'],
  ['wYlAi6QhNSA', 50.8965, -1.4044, 'Port of Southampton, UK'],
  ['GHEmhcWjiTE', 49.2888, -123.1111, 'Vancouver Harbour, Canada'],
  ['SFoS6nBL138', 44.4918, -63.9189, 'Peggys Cove, Nova Scotia'],
  ['61pi8UjLOlo', 61.1800, -149.9720, 'Lake Hood Seaplane Base, Anchorage'],
  ['jJI5w_RVGtQ', 58.4167, -134.5450, 'Mendenhall Glacier, Juneau, Alaska'],
  ['1EiC9bvVGnk', 43.4799, -110.7624, 'Jackson Hole, Wyoming'],
  ['mHTTPNYltZo', 39.4817, -106.0384, 'Breckenridge, Colorado'],
  ['5uZa3-RMFos', -33.8568, 151.2153, 'Sydney Harbour, Australia'],
  ['Fw9hgttWzIg', 9.4761, 100.0659, 'Koh Samui, Thailand'],
  ['_BMi3usEwi8', 4.1755, 73.5093, 'Maldives Ocean View'],
  ['Thtj8Ht7Z_c', -4.6796, 55.4920, 'Seychelles Island Beach'],
  ['ydYDqZQpim8', -24.7274, 15.2903, 'Namib Desert, Namibia'],
  ['XyPU5-pNg5E', -2.6527, 37.2606, 'Amboseli & Mt Kilimanjaro, Kenya'],
  ['EdDdTrahHjI', -17.8500, 25.1500, 'Chobe National Park, Botswana'],
  ['f9uqHbXChno', -17.9243, 25.8572, 'Victoria Falls, Zimbabwe'],
  ['BsZEOvS3qTM', 31.0330, 103.1670, 'Giant Panda Valley, Sichuan, China'],
  ['0xFARCdZ3vA', 8.5990, -80.1290, 'Panama Tropical Forest'],
  ['tEtg5Kg3voQ', 36.6183, -121.9018, 'Monterey Bay, California']
];

const PRIVATE_HOST_RE = [
  /^localhost$/i, /\.local$/i, /\.internal$/i, /^metadata\.google\.internal$/i,
  /^127\./, /^10\./, /^192\.168\./, /^169\.254\./, /^0\./,
  /^100\.(6[4-9]|[7-9]\d|1[0-2]\d)\./, /^172\.(1[6-9]|2\d|3[01])\./,
  /^::1$/, /^f[cd][0-9a-f]{2}:/i, /^fe80:/i
];
function isSafePublicHttpsUrl(urlStr) {
  try {
    const u = new URL(String(urlStr || ''));
    if (u.protocol !== 'https:') return false;
    if (u.username || u.password) return false;
    const h = u.hostname.toLowerCase().replace(/^\[|\]$/g, '').replace(/\.$/, '');
    if (!h || PRIVATE_HOST_RE.some(re => re.test(h))) return false;
    return true;
  } catch (e) { return false; }
}

function fetchBuffer(urlStr, timeoutMs = 9000, redirects = 0, maxBytes = 6 * 1048576) {
  return new Promise((resolve, reject) => {
    if (!isSafePublicHttpsUrl(urlStr)) return reject(new Error('Blocked unsafe upstream URL'));
    const req = https.get(urlStr, {
      headers: { 'User-Agent': UA, 'Accept': 'application/json,image/avif,image/webp,image/png,image/jpeg,*/*' },
      timeout: timeoutMs
    }, res => {
      if ([301, 302, 303, 307, 308].includes(res.statusCode) && res.headers.location && redirects < 3) {
        res.resume();
        const nextUrl = res.headers.location.startsWith('http')
          ? res.headers.location
          : new URL(res.headers.location, urlStr).toString();
        if (!isSafePublicHttpsUrl(nextUrl)) return reject(new Error('Blocked unsafe redirect target'));
        return resolve(fetchBuffer(nextUrl, timeoutMs, redirects + 1, maxBytes));
      }
      if (res.statusCode !== 200) {
        res.resume();
        return reject(new Error('HTTP ' + res.statusCode));
      }
      const chunks = [];
      let total = 0;
      res.on('data', c => {
        total += c.length;
        if (total > maxBytes) { req.destroy(); return reject(new Error('Payload too large')); }
        chunks.push(c);
      });
      res.on('end', () => resolve({ buf: Buffer.concat(chunks), ct: res.headers['content-type'] || '' }));
    });
    req.on('timeout', () => { req.destroy(); reject(new Error('Upstream timeout')); });
    req.on('error', reject);
  });
}

async function fetchJSON(urlStr, timeoutMs = 10000, maxBytes = 8 * 1048576) {
  const r = await fetchBuffer(urlStr, timeoutMs, 0, maxBytes);
  return JSON.parse(r.buf.toString('utf8'));
}

function create(dataDir, camsLib) {
  const cacheRoot = path.join(dataDir, 'globe-tiles');
  const packsRoot = path.join(dataDir, 'globe-packs');
  const packsIndexFile = path.join(packsRoot, 'index.json');
  const inFlight = new Map();
  const geoCache = new Map();
  const feedCache = new Map(); // key -> { at, ttl, data }
  let writesSincePrune = 0;
  let pruning = false;
  let packs = [];
  let activeJob = null;

  function loadPacks() {
    try {
      if (fs.existsSync(packsIndexFile)) {
        const arr = JSON.parse(fs.readFileSync(packsIndexFile, 'utf8'));
        if (Array.isArray(arr)) packs = arr.filter(p => p && PACK_ID_RE.test(String(p.id || '')) && p.bbox);
      }
    } catch (e) { packs = []; }
  }
  function savePacks() {
    try {
      fs.mkdirSync(packsRoot, { recursive: true });
      const tmp = packsIndexFile + '.tmp';
      fs.writeFileSync(tmp, JSON.stringify(packs, null, 2));
      fs.renameSync(tmp, packsIndexFile);
    } catch (e) { }
  }
  loadPacks();

  function packTileFile(packId, s, z, x, y) {
    return path.join(packsRoot, packId, s, String(z), `${x}_${y}.tile`);
  }
  function findPackTile(s, z, x, y) {
    for (let i = 0; i < packs.length; i++) {
      const pk = packs[i];
      if (!pk.layers || !pk.layers.includes(s)) continue;
      if (z < pk.minZ || z > pk.maxZ) continue;
      const r = tileRangesForZoom(pk.bbox, z);
      if (x < r.x0 || x > r.x1 || y < r.y0 || y > r.y1) continue;
      const fp = packTileFile(pk.id, s, z, x, y);
      if (fs.existsSync(fp)) return fp;
    }
    return null;
  }

  function tileFile(s, z, x, y) {
    return path.join(cacheRoot, s, String(z), `${x}_${y}.tile`);
  }

  function walkCache(dir, out) {
    if (!fs.existsSync(dir)) return;
    let ents = [];
    try { ents = fs.readdirSync(dir, { withFileTypes: true }); } catch (e) { return; }
    for (const ent of ents) {
      const full = path.join(dir, ent.name);
      if (ent.isDirectory()) walkCache(full, out);
      else if (ent.isFile() && ent.name.endsWith('.tile')) {
        try {
          const st = fs.statSync(full);
          out.push({ full, size: st.size, mtime: st.mtimeMs });
        } catch (e) { }
      }
    }
  }

  function cacheStats() {
    const files = [];
    walkCache(cacheRoot, files);
    let bytes = 0;
    for (const f of files) bytes += f.size;
    return { bytes, files: files.length, maxBytes: MAX_CACHE_BYTES };
  }

  function pruneCacheIfNeeded() {
    if (pruning) return;
    pruning = true;
    setImmediate(() => {
      try {
        const files = [];
        walkCache(cacheRoot, files);
        let total = 0;
        for (const f of files) total += f.size;
        if (total > MAX_CACHE_BYTES) {
          files.sort((a, b) => a.mtime - b.mtime); // oldest first
          for (const f of files) {
            if (total <= PRUNE_TARGET_BYTES) break;
            try { fs.unlinkSync(f.full); total -= f.size; } catch (e) { }
          }
        }
      } catch (e) { }
      pruning = false;
    });
  }

  function clearCache() {
    let before = cacheStats();
    try {
      if (fs.existsSync(cacheRoot)) fs.rmSync(cacheRoot, { recursive: true, force: true });
    } catch (e) { }
    return { ok: true, freedBytes: before.bytes, freedFiles: before.files, bytes: 0, files: 0, maxBytes: MAX_CACHE_BYTES };
  }

  async function serveTile(q, res) {
    const s = String(q.get('s') || '').toLowerCase();
    const spec = SOURCES[s];
    const z = parseInt(q.get('z'), 10);
    const x = parseInt(q.get('x'), 10);
    const y = parseInt(q.get('y'), 10);
    const pParam = s === 'radar' ? String(q.get('p') || '') : '';
    const maxXY = (1 << Math.max(0, Math.min(20, z))) - 1;
    if (!spec || !Number.isFinite(z) || !Number.isFinite(x) || !Number.isFinite(y) ||
        z < 0 || z > spec.maxZ || x < 0 || y < 0 || x > maxXY || y > maxXY ||
        (s === 'radar' && !RADAR_PATH_RE.test(pParam))) {
      res.writeHead(400, { 'Content-Type': 'text/plain' });
      return res.end('invalid tile');
    }

    if (spec.disk) {
      // 1. Protected user-downloaded Offline Region Packs take priority (never auto-pruned!)
      try {
        const pfp = findPackTile(s, z, x, y);
        if (pfp) {
          const buf = fs.readFileSync(pfp);
          res.writeHead(200, { 'Content-Type': spec.ct, 'Content-Length': buf.length, 'Cache-Control': 'public, max-age=604800', 'X-Globe-Cache': 'PACK' });
          return res.end(buf);
        }
      } catch (e) { }
    }

    const fp = spec.disk ? tileFile(s, z, x, y) : null;
    if (fp) {
      try {
        if (fs.existsSync(fp)) {
          const buf = fs.readFileSync(fp);
          res.writeHead(200, { 'Content-Type': spec.ct, 'Content-Length': buf.length, 'Cache-Control': 'public, max-age=604800', 'X-Globe-Cache': 'HIT' });
          return res.end(buf);
        }
      } catch (e) { }
    }

    const key = `${s}/${pParam}/${z}/${x}/${y}`;
    let p = inFlight.get(key);
    if (!p) {
      p = fetchBuffer(spec.url(z, x, y, pParam), 9000).then(r => {
        if (fp) {
          try {
            fs.mkdirSync(path.dirname(fp), { recursive: true });
            fs.writeFile(fp, r.buf, () => {
              writesSincePrune++;
              if (writesSincePrune >= 80) {
                writesSincePrune = 0;
                pruneCacheIfNeeded();
              }
            });
          } catch (e) { }
        }
        return r;
      }).finally(() => inFlight.delete(key));
      inFlight.set(key, p);
    }

    try {
      const r = await p;
      const ct = /^image\//i.test(r.ct) ? r.ct.split(';')[0] : spec.ct;
      const cc = spec.disk ? 'public, max-age=604800' : 'public, max-age=300';
      res.writeHead(200, { 'Content-Type': ct, 'Content-Length': r.buf.length, 'Cache-Control': cc, 'X-Globe-Cache': 'MISS' });
      return res.end(r.buf);
    } catch (e) {
      res.writeHead(502, { 'Content-Type': 'text/plain', 'Cache-Control': 'no-store' });
      return res.end('tile unavailable: ' + String(e.message || e));
    }
  }

  async function geocode(query) {
    const q = String(query || '').trim();
    if (!q || q.length < 2) return { ok: true, results: [] };
    const low = q.toLowerCase();
    if (geoCache.has(low)) return { ok: true, results: geoCache.get(low), cached: true };
    try {
      const url = 'https://nominatim.openstreetmap.org/search?format=json&limit=8&addressdetails=0&q=' + encodeURIComponent(q);
      const arr = await fetchJSON(url, 8000);
      const results = (Array.isArray(arr) ? arr : []).map(it => ({
        name: String(it.name || (it.display_name || '').split(',')[0] || q),
        sub: String(it.display_name || '').split(',').slice(1, 4).join(',').trim(),
        lat: parseFloat(it.lat),
        lon: parseFloat(it.lon),
        bbox: normalizeBbox(it.boundingbox),
        type: String(it.type || it.class || 'place')
      })).filter(it => Number.isFinite(it.lat) && Number.isFinite(it.lon));
      if (geoCache.size > 200) geoCache.clear();
      geoCache.set(low, results);
      return { ok: true, results };
    } catch (e) {
      return { ok: false, results: [], error: String(e.message || e) };
    }
  }

  /* ---------- Cached Live OSINT Telemetry Feeds (in-memory only, 0 KB disk usage!) ---------- */
  async function cachedFeed(key, ttlMs, loader) {
    const hit = feedCache.get(key);
    const now = Date.now();
    if (hit && now - hit.at < ttlMs) return Object.assign({ cached: true }, hit.data);
    try {
      const data = await loader();
      if (feedCache.size > 40) feedCache.clear();
      feedCache.set(key, { at: now, ttl: ttlMs, data });
      return data;
    } catch (e) {
      if (hit) return Object.assign({ stale: true, error: String(e.message || e) }, hit.data);
      return { ok: false, error: String(e.message || e), items: [] };
    }
  }

  function buildCamsFeed() {
    const all = (camsLib && Array.isArray(camsLib.CAMS)) ? camsLib.CAMS : [];
    const byId = new Map(all.map(c => [c.id, c]));
    const items = [];
    for (const [id, lat, lon, place] of CAM_GEO) {
      const c = byId.get(id);
      items.push({
        id,
        name: c ? c.name : place,
        place,
        ch: c ? c.ch : 'Public Cam',
        cat: c ? c.cat : 'city',
        lat,
        lon
      });
    }
    return { ok: true, source: 'Moundshroud Built-in Global Cameras', count: items.length, items };
  }

  async function fetchFlights(q) {
    const lat = parseFloat(q && q.get ? q.get('lat') : '');
    const lon = parseFloat(q && q.get ? q.get('lon') : '');
    const lamin = parseFloat(q && q.get ? q.get('lamin') : '');
    const lomin = parseFloat(q && q.get ? q.get('lomin') : '');
    const lamax = parseFloat(q && q.get ? q.get('lamax') : '');
    const lomax = parseFloat(q && q.get ? q.get('lomax') : '');
    const hasBox = [lamin, lomin, lamax, lomax].every(Number.isFinite) && lamax > lamin && lomax > lomin && (lamax - lamin) <= 100 && (lomax - lomin) <= 140;
    const boxKey = hasBox
      ? `fl:${Math.floor(lamin / 4) * 4},${Math.floor(lomin / 4) * 4},${Math.ceil(lamax / 4) * 4},${Math.ceil(lomax / 4) * 4}`
      : 'fl:global';

    return cachedFeed(boxKey, 20000, async () => {
      // Primary: OpenSky Network (free global ADS-B)
      try {
        const qs = hasBox
          ? `?lamin=${lamin.toFixed(2)}&lomin=${lomin.toFixed(2)}&lamax=${lamax.toFixed(2)}&lomax=${lomax.toFixed(2)}`
          : '';
        const d = await fetchJSON('https://opensky-network.org/api/states/all' + qs, 9500, 12 * 1048576);
        const raw = Array.isArray(d && d.states) ? d.states : [];
        const items = [];
        // Evenly stride if global returns thousands so we stay smooth at <= 1,200 contacts
        const airborne = raw.filter(s => Array.isArray(s) && Number.isFinite(s[5]) && Number.isFinite(s[6]) && !s[8]);
        const step = airborne.length > 1200 ? airborne.length / 1200 : 1;
        for (let i = 0; i < airborne.length && items.length < 1200; i += step) {
          const s = airborne[Math.floor(i)];
          items.push({
            id: String(s[0] || ''),
            call: String(s[1] || s[0] || 'UNKNOWN').trim(),
            country: String(s[2] || ''),
            lon: +s[5],
            lat: +s[6],
            altM: Math.round(Number(s[7] || s[13] || 0)),
            spdMs: Math.round(Number(s[9] || 0)),
            hdg: Math.round(Number(s[10] || 0)),
            vr: Number(s[11] || 0)
          });
        }
        if (items.length) return { ok: true, source: 'OpenSky Network', total: airborne.length, count: items.length, items };
      } catch (e) { }

      // Automatic fallback: adsb.lol regional radar around viewport center (never leaves user empty-handed!)
      const cLat = Number.isFinite(lat) ? lat : 39.8;
      const cLon = Number.isFinite(lon) ? lon : -98.5;
      const d2 = await fetchJSON(`https://api.adsb.lol/v2/point/${cLat.toFixed(2)}/${cLon.toFixed(2)}/250`, 9000);
      const ac = Array.isArray(d2 && d2.ac) ? d2.ac : [];
      const items = [];
      for (const a of ac) {
        if (!Number.isFinite(a.lat) || !Number.isFinite(a.lon)) continue;
        if (items.length >= 900) break;
        const altFt = typeof a.alt_baro === 'number' ? a.alt_baro : (typeof a.alt_geom === 'number' ? a.alt_geom : 0);
        items.push({
          id: String(a.hex || ''),
          call: String(a.flight || a.r || a.hex || 'AIRCRAFT').trim(),
          country: String(a.r || ''),
          type: String(a.t || ''),
          desc: String(a.desc || ''),
          lon: +a.lon,
          lat: +a.lat,
          altM: Math.round(altFt * 0.3048),
          spdMs: Math.round(Number(a.gs || 0) * 0.514444),
          hdg: Math.round(Number(a.track || 0)),
          squawk: String(a.squawk || '')
        });
      }
      return { ok: true, source: 'adsb.lol Regional Radar', total: ac.length, count: items.length, items };
    });
  }

  async function fetchMilitary() {
    return cachedFeed('mil', 20000, async () => {
      const d = await fetchJSON('https://api.adsb.lol/v2/mil', 9500);
      const ac = Array.isArray(d && d.ac) ? d.ac : [];
      const items = [];
      for (const a of ac) {
        if (!Number.isFinite(a.lat) || !Number.isFinite(a.lon)) continue;
        if (items.length >= 600) break;
        const altFt = typeof a.alt_baro === 'number' ? a.alt_baro : (typeof a.alt_geom === 'number' ? a.alt_geom : 0);
        items.push({
          id: String(a.hex || ''),
          call: String(a.flight || a.r || a.hex || 'MIL').trim(),
          reg: String(a.r || ''),
          type: String(a.t || ''),
          desc: String(a.desc || 'Military Aircraft'),
          lon: +a.lon,
          lat: +a.lat,
          altM: Math.round(altFt * 0.3048),
          altFt: Math.round(altFt),
          spdMs: Math.round(Number(a.gs || 0) * 0.514444),
          spdKt: Math.round(Number(a.gs || 0)),
          hdg: Math.round(Number(a.track || 0)),
          squawk: String(a.squawk || '')
        });
      }
      return { ok: true, source: 'adsb.lol Military ADS-B', count: items.length, items };
    });
  }

  async function fetchSatellites() {
    return cachedFeed('sats', 90000, async () => {
      const [issRes, staRes, visRes] = await Promise.allSettled([
        fetchJSON('https://api.wheretheiss.at/v1/satellites/25544', 7000),
        fetchJSON('https://celestrak.org/NORAD/elements/gp.php?GROUP=stations&FORMAT=json', 9000),
        fetchJSON('https://celestrak.org/NORAD/elements/gp.php?GROUP=visual&FORMAT=json', 9000)
      ]);
      const iss = issRes.status === 'fulfilled' && issRes.value && Number.isFinite(issRes.value.latitude) ? {
        name: 'ISS (ZARYA)',
        norad: 25544,
        lat: +issRes.value.latitude,
        lon: +issRes.value.longitude,
        altKm: Math.round(Number(issRes.value.altitude || 420)),
        velKmh: Math.round(Number(issRes.value.velocity || 27600)),
        footprintKm: Math.round(Number(issRes.value.footprint || 4500)),
        vis: String(issRes.value.visibility || '')
      } : null;

      const seen = new Set();
      const gp = [];
      const addList = (arr, cat, limit) => {
        if (!Array.isArray(arr)) return;
        let added = 0;
        for (const s of arr) {
          if (added >= limit) break;
          const id = Number(s.NORAD_CAT_ID);
          if (!id || seen.has(id)) continue;
          const mm = Number(s.MEAN_MOTION);
          const inc = Number(s.INCLINATION);
          if (!Number.isFinite(mm) || mm <= 0 || !Number.isFinite(inc)) continue;
          seen.add(id);
          added++;
          gp.push({
            norad: id,
            name: String(s.OBJECT_NAME || ('SAT-' + id)).trim(),
            cat,
            inc,
            raan: Number(s.RA_OF_ASC_NODE || 0),
            ecc: Number(s.ECCENTRICITY || 0),
            argp: Number(s.ARG_OF_PERICENTER || 0),
            ma: Number(s.MEAN_ANOMALY || 0),
            mm,
            epoch: String(s.EPOCH || '')
          });
        }
      };
      if (staRes.status === 'fulfilled') addList(staRes.value, 'station', 25);
      if (visRes.status === 'fulfilled') addList(visRes.value, 'visual', 75);

      return { ok: true, source: 'CelesTrak GP + WhereTheISS', iss, count: gp.length, gp };
    });
  }

  async function fetchQuakes() {
    return cachedFeed('quakes', 120000, async () => {
      const d = await fetchJSON('https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/2.5_day.geojson', 9000);
      const feats = Array.isArray(d && d.features) ? d.features : [];
      const items = [];
      for (const f of feats) {
        const c = f && f.geometry && f.geometry.coordinates;
        const p = f && f.properties;
        if (!c || !p || !Number.isFinite(c[0]) || !Number.isFinite(c[1])) continue;
        items.push({
          id: String(f.id || ''),
          mag: Number(p.mag || 0),
          place: String(p.place || 'Earthquake'),
          time: Number(p.time || 0),
          depthKm: Math.round(Number(c[2] || 0) * 10) / 10,
          tsunami: !!p.tsunami,
          lon: +c[0],
          lat: +c[1]
        });
      }
      return { ok: true, source: 'USGS Earthquakes (24h M2.5+)', count: items.length, items };
    });
  }

  async function fetchEvents() {
    return cachedFeed('events', 300000, async () => {
      const d = await fetchJSON('https://eonet.gsfc.nasa.gov/api/v3/events?status=open&limit=100', 9500);
      const evs = Array.isArray(d && d.events) ? d.events : [];
      const items = [];
      for (const ev of evs) {
        const geoms = Array.isArray(ev.geometry) ? ev.geometry : [];
        const last = geoms[geoms.length - 1];
        if (!last || !Array.isArray(last.coordinates)) continue;
        let lon = NaN, lat = NaN;
        if (last.type === 'Point') { lon = +last.coordinates[0]; lat = +last.coordinates[1]; }
        else if (last.type === 'Polygon' && Array.isArray(last.coordinates[0]) && Array.isArray(last.coordinates[0][0])) {
          lon = +last.coordinates[0][0][0]; lat = +last.coordinates[0][0][1];
        }
        if (!Number.isFinite(lon) || !Number.isFinite(lat)) continue;
        const cat = (ev.categories && ev.categories[0] && ev.categories[0].title) || 'Hazard';
        const catId = (ev.categories && ev.categories[0] && ev.categories[0].id) || 'other';
        items.push({
          id: String(ev.id || ''),
          title: String(ev.title || 'Natural Event'),
          cat,
          catId,
          date: String(last.date || ''),
          lon,
          lat
        });
      }
      return { ok: true, source: 'NASA EONET Live Hazards', count: items.length, items };
    });
  }

  async function fetchRadarMeta() {
    return cachedFeed('radar', 180000, async () => {
      const d = await fetchJSON('https://api.rainviewer.com/public/weather-maps.json', 8000);
      const past = d && d.radar && Array.isArray(d.radar.past) ? d.radar.past : [];
      const latest = past[past.length - 1];
      if (!latest || !RADAR_PATH_RE.test(String(latest.path || ''))) {
        return { ok: false, error: 'No weather radar frame available' };
      }
      return { ok: true, source: 'RainViewer Global Weather Radar', path: latest.path, time: latest.time, frames: past.slice(-6).map(x => ({ path: x.path, time: x.time })) };
    });
  }

  async function getFeed(kind, q) {
    const k = String(kind || '').toLowerCase();
    if (k === 'cams') return buildCamsFeed();
    if (k === 'flights') return fetchFlights(q);
    if (k === 'military') return fetchMilitary();
    if (k === 'satellites') return fetchSatellites();
    if (k === 'quakes') return fetchQuakes();
    if (k === 'events') return fetchEvents();
    if (k === 'radar') return fetchRadarMeta();
    return { ok: false, error: 'Unknown feed: ' + k };
  }

  /* ---------- Protected Offline Region Packs (download specific towns, counties, states, countries) ---------- */
  function resolvePackPlan(opts) {
    const bbox = normalizeBbox(opts && opts.bbox);
    if (!bbox) return { ok: false, error: 'Valid bounding box required.' };
    const style = String((opts && opts.style) || 'streets').toLowerCase();
    const layers = PACK_STYLES[style];
    if (!layers) return { ok: false, error: 'Unsupported offline style: ' + style };
    const styleMaxZ = Math.min(...layers.map(ly => SOURCES[ly].maxZ));
    // Auto-select sensible minZ based on region span so tiny towns don't waste low-zoom world tiles
    const span = Math.max(bbox.north - bbox.south, bbox.east - bbox.west);
    const autoMinZ = span > 25 ? 2 : span > 8 ? 4 : span > 2 ? 6 : span > 0.4 ? 8 : 10;
    const minZ = clamp(Number.isFinite(Number(opts && opts.minZ)) ? parseInt(opts.minZ, 10) : autoMinZ, 1, styleMaxZ);

    // Find highest safe zoom that stays under MAX_PACK_TILES and recommended (~1,200 tiles)
    let safeMaxZ = minZ, recMaxZ = minZ;
    for (let z = minZ; z <= Math.min(16, styleMaxZ); z++) {
      const c = countPackTiles(bbox, layers, minZ, z);
      if (c.tiles <= MAX_PACK_TILES) safeMaxZ = z;
      if (c.tiles <= 1200) recMaxZ = z;
    }

    const reqMaxZ = Number.isFinite(Number(opts && opts.maxZ)) ? parseInt(opts.maxZ, 10) : recMaxZ;
    const maxZ = clamp(reqMaxZ, minZ, Math.min(16, styleMaxZ));
    const est = countPackTiles(bbox, layers, minZ, maxZ);
    return {
      ok: true,
      style,
      layers,
      bbox,
      minZ,
      maxZ,
      recommendedMaxZ: recMaxZ,
      safeMaxZ,
      tiles: est.tiles,
      estBytes: est.estBytes,
      estMB: +(est.estBytes / 1048576).toFixed(1),
      tooLarge: est.tiles > MAX_PACK_TILES,
      maxPackTiles: MAX_PACK_TILES
    };
  }

  function estimatePack(opts) {
    return resolvePackPlan(opts);
  }

  function publicJob(j) {
    if (!j) return null;
    return {
      id: j.id, name: j.name, style: j.style, minZ: j.minZ, maxZ: j.maxZ,
      total: j.total, done: j.done, failed: j.failed, bytes: j.bytes,
      status: j.status, error: j.error || ''
    };
  }

  function listPacks() {
    let totalBytes = 0;
    for (const p of packs) totalBytes += (p.bytes || 0);
    return { ok: true, packs, totalBytes, activeJob: publicJob(activeJob), maxPackTiles: MAX_PACK_TILES };
  }

  function startPack(opts) {
    if (activeJob && activeJob.status === 'running') {
      return { ok: false, error: 'An offline region download is already running. Wait or cancel it first.' };
    }
    const plan = resolvePackPlan(opts);
    if (!plan.ok) return plan;
    if (plan.tooLarge) {
      return { ok: false, error: `Selection is ${plan.tiles.toLocaleString()} tiles (max ${MAX_PACK_TILES.toLocaleString()} per pack). Lower the Max Zoom to z${plan.safeMaxZ} or select a smaller area.` };
    }
    const name = String((opts && opts.name) || 'Offline Region').trim().slice(0, 80) || 'Offline Region';
    const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 22) || 'region';
    const id = slug + '-' + Date.now().toString(36);
    const packDir = path.join(packsRoot, id);

    // Build flat tile queue
    const queue = [];
    for (let z = plan.minZ; z <= plan.maxZ; z++) {
      const r = tileRangesForZoom(plan.bbox, z);
      for (const ly of plan.layers) {
        for (let x = r.x0; x <= r.x1; x++) {
          for (let y = r.y0; y <= r.y1; y++) {
            queue.push({ ly, z, x, y });
          }
        }
      }
    }

    const job = {
      id, name, style: plan.style, layers: plan.layers, bbox: plan.bbox,
      minZ: plan.minZ, maxZ: plan.maxZ, total: queue.length,
      done: 0, failed: 0, bytes: 0, status: 'running', cancelled: false, error: ''
    };
    activeJob = job;

    // Polite throttled background downloader (4 workers; reuses already-cached tiles at 0 network cost)
    const workers = [];
    let cursor = 0;
    const CONCURRENCY = 4;
    const paceMs = (plan.style === 'streets' || plan.style === 'topo') ? 75 : 25;

    const runWorker = async () => {
      while (!job.cancelled) {
        const idx = cursor++;
        if (idx >= queue.length) break;
        const item = queue[idx];
        const dest = packTileFile(id, item.ly, item.z, item.x, item.y);
        try {
          let buf = null;
          const cached = tileFile(item.ly, item.z, item.x, item.y);
          if (fs.existsSync(cached)) {
            buf = fs.readFileSync(cached);
          } else {
            const spec = SOURCES[item.ly];
            const r = await fetchBuffer(spec.url(item.z, item.x, item.y), 9500);
            buf = r.buf;
            if (paceMs) await new Promise(res => setTimeout(res, paceMs));
          }
          if (job.cancelled) break;
          fs.mkdirSync(path.dirname(dest), { recursive: true });
          fs.writeFileSync(dest, buf);
          job.bytes += buf.length;
          job.done++;
        } catch (e) {
          job.failed++;
          job.done++;
        }
      }
    };

    for (let i = 0; i < CONCURRENCY; i++) workers.push(runWorker());
    Promise.all(workers).then(() => {
      if (job.cancelled) {
        try { if (fs.existsSync(packDir)) fs.rmSync(packDir, { recursive: true, force: true }); } catch (e) { }
        job.status = 'cancelled';
        return;
      }
      const savedTiles = Math.max(0, job.done - job.failed);
      if (savedTiles === 0) {
        try { if (fs.existsSync(packDir)) fs.rmSync(packDir, { recursive: true, force: true }); } catch (e) { }
        job.status = 'error';
        job.error = 'No tiles could be downloaded (check internet connection).';
        return;
      }
      const meta = {
        id: job.id,
        name: job.name,
        style: job.style,
        layers: job.layers,
        bbox: job.bbox,
        minZ: job.minZ,
        maxZ: job.maxZ,
        tiles: savedTiles,
        bytes: job.bytes,
        createdAt: Date.now()
      };
      packs.unshift(meta);
      savePacks();
      job.status = 'done';
    }).catch(err => {
      job.status = 'error';
      job.error = String(err && err.message || err);
    });

    return { ok: true, job: publicJob(job) };
  }

  function cancelPack() {
    if (!activeJob || activeJob.status !== 'running') return { ok: true, cancelled: false };
    activeJob.cancelled = true;
    activeJob.status = 'cancelled';
    return { ok: true, cancelled: true };
  }

  function deletePack(id) {
    const clean = String(id || '').trim();
    if (!PACK_ID_RE.test(clean)) return { ok: false, error: 'Invalid pack id.' };
    const idx = packs.findIndex(p => p.id === clean);
    if (idx === -1) return { ok: false, error: 'Pack not found.' };
    const removed = packs.splice(idx, 1)[0];
    try {
      const dir = path.join(packsRoot, clean);
      if (fs.existsSync(dir)) fs.rmSync(dir, { recursive: true, force: true });
    } catch (e) { }
    savePacks();
    let totalBytes = 0;
    for (const p of packs) totalBytes += (p.bytes || 0);
    return { ok: true, freedBytes: removed.bytes || 0, packs, totalBytes };
  }

  function status() {
    const st = cacheStats();
    let packBytes = 0;
    for (const p of packs) packBytes += (p.bytes || 0);
    return {
      ok: true,
      layers: Object.keys(SOURCES),
      feeds: ['flights', 'military', 'satellites', 'quakes', 'events', 'radar', 'cams'],
      cacheDir: cacheRoot,
      cacheBytes: st.bytes,
      cacheFiles: st.files,
      maxCacheBytes: MAX_CACHE_BYTES,
      packCount: packs.length,
      packBytes,
      maxPackTiles: MAX_PACK_TILES
    };
  }

  return {
    serveTile, geocode, getFeed, clearCache, cacheStats, status,
    estimatePack, listPacks, startPack, cancelPack, deletePack,
    SOURCES, MAX_CACHE_BYTES, MAX_PACK_TILES
  };
}

module.exports = { create, MAX_CACHE_BYTES, MAX_PACK_TILES, isSafePublicHttpsUrl };

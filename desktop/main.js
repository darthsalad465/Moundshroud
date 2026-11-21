// Moundshroud Desktop Shell (Electron) — true standalone app on app://moundshroud/
// with ZERO localhost server, ZERO open TCP ports, and an off-thread utilityProcess backend
// so the UI window stays 60fps responsive even during heavy disk/AI/CLI operations.
const path = require('path');
const fs = require('fs');
const fsp = fs.promises;
const os = require('os');
const { app, BrowserWindow, Tray, Menu, shell, nativeImage, nativeTheme, protocol, session, globalShortcut, utilityProcess } = require('electron');

const APP_ORIGIN = 'app://moundshroud';
const LIB_ORIGIN = 'app://moundshroud-lib';

const CORE_DIR = app.isPackaged
  ? path.join(process.resourcesPath, 'app-core')
  : path.resolve(__dirname, '..');
const cyberDesktopAssets = require(path.join(CORE_DIR, 'lib', 'cyber-desktop-assets'));

if (!app.isPackaged) {
  app.setPath('userData', path.join(CORE_DIR, 'desktop-profile'));
}

const DATA_DIR = app.isPackaged
  ? path.join(app.getPath('userData'), 'data')
  : path.join(CORE_DIR, 'data');

const WEB_DIR = path.join(CORE_DIR, 'web');
const EDGE_LEVELDB_DIR = path.join(CORE_DIR, 'edge-profile', 'Default', 'Local Storage', 'leveldb');
const MIGRATED_MARK = path.join(DATA_DIR, '.edge-ls-migrated');
const MIGRATED_BACKUP = path.join(DATA_DIR, 'edge-localstorage-backup.json');

const ICON_PATH = path.join(WEB_DIR, 'moundshroud.ico');
const TRAY_PNG = path.join(WEB_DIR, 'logo-64.png');

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.geojson': 'application/geo+json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.gif': 'image/gif',
  '.ico': 'image/x-icon',
  '.woff2': 'font/woff2',
  '.woff': 'font/woff',
  '.ttf': 'font/ttf',
  '.mp3': 'audio/mpeg',
  '.wav': 'audio/wav',
  '.ogg': 'audio/ogg',
  '.mp4': 'video/mp4',
  '.wasm': 'application/wasm',
  '.txt': 'text/plain; charset=utf-8',
  '.md': 'text/markdown; charset=utf-8',
  '.manifest': 'application/manifest+json',
  '.webmanifest': 'application/manifest+json',
};

const APP_CSP = "default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval' blob:; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; media-src 'self' data: blob:; font-src 'self' data:; connect-src 'self' blob: data:; worker-src 'self' blob:; frame-src 'self' blob: data: app://moundshroud-lib https://www.youtube-nocookie.com; object-src 'none'; base-uri 'self'; form-action 'self'; frame-ancestors 'self'";

// Must run before app.whenReady(): marks app:// as a secure, standard origin so
// crypto.subtle (Password Vault), localStorage, clipboard, fetch, and streaming work natively.
protocol.registerSchemesAsPrivileged([
  {
    scheme: 'app',
    privileges: {
      standard: true,
      secure: true,
      supportFetchAPI: true,
      corsEnabled: true,
      stream: true,
      allowServiceWorkers: true
    }
  }
]);

let mainWin = null;
let splashWin = null;
let tray = null;
let worker = null;
let workerReady = null;
let quitting = false;
let reqSeq = 0;
const inflight = new Map(); // id -> { resolve, reject, controller, closed, settled, status, headers }

// Single-instance desktop app lock
const gotLock = app.requestSingleInstanceLock();
if (!gotLock) {
  app.quit();
} else {
  app.on('second-instance', () => {
    showMainWindow();
  });
}

function showMainWindow() {
  if (!mainWin || mainWin.isDestroyed()) {
    createMainWindow(false);
    return;
  }
  if (mainWin.isMinimized()) mainWin.restore();
  mainWin.setSkipTaskbar(false);
  // Brief always-on-top + moveTop bypasses Windows 11's foreground lock when waking from tray
  mainWin.setAlwaysOnTop(true, 'pop-up-menu');
  mainWin.show();
  mainWin.moveTop();
  mainWin.focus();
  try { app.focus({ steal: true }); } catch (e) { }
  setTimeout(() => {
    if (mainWin && !mainWin.isDestroyed()) {
      mainWin.setAlwaysOnTop(false);
      mainWin.focus();
    }
  }, 180);
}

function toggleMainWindow() {
  if (!mainWin || mainWin.isDestroyed()) {
    createMainWindow(false);
    return;
  }
  if (mainWin.isVisible() && !mainWin.isMinimized() && mainWin.isFocused()) {
    mainWin.hide();
  } else {
    showMainWindow();
  }
}

/* ---- Off-thread Node backend via Electron utilityProcess (zero localhost, zero UI blocking) ---- */
function startBackendWorker() {
  if (worker && workerReady) return workerReady;
  fs.mkdirSync(DATA_DIR, { recursive: true });
  workerReady = new Promise((resolve, reject) => {
    const child = utilityProcess.fork(path.join(__dirname, 'backend-worker.js'), [], {
      cwd: CORE_DIR,
      serviceName: 'Moundshroud Backend',
      env: Object.assign({}, process.env, {
        MOUNDSHROUD_CORE: CORE_DIR,
        MOUNDSHROUD_DATA: DATA_DIR,
        MOUNDSHROUD_DESKTOP: '1',
        MOUNDSHROUD_EMBEDDED: '1'
      })
    });
    worker = child;
    let isReady = false;
    const readyTimer = setTimeout(() => { if (!isReady) reject(new Error('Backend worker startup timed out')); }, 15000);

    child.on('message', msg => {
      if (!msg || typeof msg !== 'object') return;
      if (msg.type === 'ready') {
        isReady = true;
        clearTimeout(readyTimer);
        resolve(child);
        return;
      }
      const entry = inflight.get(msg.id);
      if (!entry) return;
      if (msg.type === 'head') {
        const hdrs = new Headers();
        for (const [k, v] of (msg.headers || [])) hdrs.append(k, v);
        const status = msg.status || 200;
        const noBody = status === 204 || status === 205 || status === 304 || entry.method === 'HEAD';
        entry.settled = true;
        if (noBody) {
          entry.closed = true;
          inflight.delete(msg.id);
          entry.resolve(new Response(null, { status, headers: hdrs }));
        } else {
          const stream = new ReadableStream({
            start(c) {
              entry.controller = c;
              while (entry.buf.length) c.enqueue(entry.buf.shift());
              if (entry.closed) { try { c.close(); } catch (e) { } }
            },
            cancel() {
              entry.closed = true;
              inflight.delete(msg.id);
              try { child.postMessage({ type: 'abort', id: msg.id }); } catch (e) { }
            }
          });
          entry.resolve(new Response(stream, { status, headers: hdrs }));
        }
      } else if (msg.type === 'chunk') {
        if (entry.closed) return;
        const u8 = msg.chunk instanceof Uint8Array ? msg.chunk : new Uint8Array(msg.chunk);
        if (entry.controller) { try { entry.controller.enqueue(u8); } catch (e) { entry.closed = true; } }
        else entry.buf.push(u8);
      } else if (msg.type === 'end') {
        if (!entry.settled) {
          entry.settled = true;
          entry.resolve(new Response('', { status: 200 }));
        }
        entry.closed = true;
        if (entry.controller) { try { entry.controller.close(); } catch (e) { } }
        inflight.delete(msg.id);
      } else if (msg.type === 'error') {
        if (!entry.settled) {
          entry.settled = true;
          entry.resolve(new Response(JSON.stringify({ error: msg.error || 'Backend error' }), { status: 500, headers: { 'Content-Type': 'application/json; charset=utf-8' } }));
        } else if (entry.controller && !entry.closed) {
          try { entry.controller.close(); } catch (e) { }
        }
        entry.closed = true;
        inflight.delete(msg.id);
      }
    });

    child.on('exit', code => {
      if (!isReady) { clearTimeout(readyTimer); reject(new Error('Backend worker exited (' + code + ')')); }
      for (const [id, entry] of inflight.entries()) {
        if (!entry.settled) entry.resolve(new Response(JSON.stringify({ error: 'Backend stopped' }), { status: 503, headers: { 'Content-Type': 'application/json' } }));
        else if (entry.controller && !entry.closed) { try { entry.controller.close(); } catch (e) { } }
        inflight.delete(id);
      }
      worker = null;
      workerReady = null;
      if (!quitting) {
        setTimeout(() => { if (!quitting) startBackendWorker().catch(() => { }); }, 500);
      }
    });
  });
  return workerReady;
}

async function forwardToWorker(target, request) {
  await startBackendWorker();
  const id = ++reqSeq;
  const method = (request.method || 'GET').toUpperCase();
  const headers = {};
  request.headers.forEach((v, k) => {
    const lk = String(k).toLowerCase();
    if (lk !== 'accept-encoding') headers[lk] = v;
  });
  let body = null;
  if (method !== 'GET' && method !== 'HEAD') {
    try {
      const ab = await request.arrayBuffer();
      if (ab && ab.byteLength) body = new Uint8Array(ab);
    } catch (e) { body = null; }
  }
  return new Promise((resolve, reject) => {
    const entry = { resolve, reject, method, controller: null, closed: false, settled: false, buf: [] };
    inflight.set(id, entry);
    if (request.signal) {
      const onAbort = () => {
        entry.closed = true;
        inflight.delete(id);
        if (worker) { try { worker.postMessage({ type: 'abort', id }); } catch (e) { } }
      };
      if (request.signal.aborted) { onAbort(); return resolve(new Response(null, { status: 499 })); }
      request.signal.addEventListener('abort', onAbort, { once: true });
    }
    try {
      worker.postMessage({ type: 'req', id, target, method, url: request.url, headers, body });
    } catch (err) {
      inflight.delete(id);
      resolve(new Response(JSON.stringify({ error: String(err.message || err) }), { status: 503, headers: { 'Content-Type': 'application/json' } }));
    }
  });
}

/* ---- Fast async static file serving for / and /web/* (non-blocking, zero IPC hop) ---- */
async function serveStaticWeb(rel, request, extraHeaders) {
  let cleanRel = '';
  try { cleanRel = decodeURIComponent(rel); } catch (e) { return new Response('Bad path', { status: 400 }); }
  if (cleanRel.includes('\0')) return new Response('Bad path', { status: 400 });
  const full = path.normalize(path.join(WEB_DIR, cleanRel));
  const inside = path.relative(WEB_DIR, full);
  if (inside.startsWith('..') || path.isAbsolute(inside)) return new Response('Forbidden', { status: 403 });
  let st;
  try { st = await fsp.stat(full); } catch (e) { return new Response('Not found', { status: 404 }); }
  if (!st.isFile()) return new Response('Not found', { status: 404 });

  const ext = path.extname(full).toLowerCase();
  const type = MIME[ext] || 'application/octet-stream';
  const baseHeaders = {
    'Content-Type': type,
    'Cache-Control': 'no-cache',
    'Accept-Ranges': 'bytes',
    'X-Content-Type-Options': 'nosniff',
    'Referrer-Policy': 'no-referrer',
    'Cross-Origin-Resource-Policy': 'same-origin',
    'Content-Security-Policy': APP_CSP,
    ...extraHeaders
  };

  const rangeHdr = request.headers.get('range');
  if (rangeHdr) {
    const m = /^bytes=(\d*)-(\d*)$/.exec(rangeHdr);
    if (m && (m[1] !== '' || m[2] !== '')) {
      const size = st.size;
      const a = m[1] === '' ? Math.max(0, size - +m[2]) : +m[1];
      const b = m[1] === '' || m[2] === '' ? size - 1 : Math.min(+m[2], size - 1);
      if (a > b || a >= size) return new Response(null, { status: 416, headers: { 'Content-Range': 'bytes */' + size } });
      const fh = await fsp.open(full, 'r');
      const buf = Buffer.alloc(b - a + 1);
      await fh.read(buf, 0, buf.length, a);
      await fh.close();
      return new Response(buf, { status: 206, headers: Object.assign(baseHeaders, { 'Content-Range': 'bytes ' + a + '-' + b + '/' + size, 'Content-Length': String(buf.length) }) });
    }
  }

  if (request.method === 'HEAD') {
    return new Response(null, { status: 200, headers: Object.assign(baseHeaders, { 'Content-Length': String(st.size) }) });
  }
  const data = await fsp.readFile(full);
  return new Response(data, { status: 200, headers: Object.assign(baseHeaders, { 'Content-Length': String(data.length) }) });
}

function registerAppProtocol() {
  protocol.handle('app', request => {
    try {
      const u = new URL(request.url);
      if (u.host === 'moundshroud') {
        if (u.pathname === '/__migrate_blank') {
          return new Response('<!doctype html><html><body></body></html>', { status: 200, headers: { 'Content-Type': 'text/html; charset=utf-8' } });
        }
        if ((request.method === 'GET' || request.method === 'HEAD') && (u.pathname === '/' || u.pathname === '/index.html')) {
          return serveStaticWeb('index.html', request);
        }
        if ((request.method === 'GET' || request.method === 'HEAD') && u.pathname.startsWith('/web/')) {
          const guestAsset = cyberDesktopAssets.asset(u.pathname);
          if (guestAsset) return serveStaticWeb(guestAsset, request, cyberDesktopAssets.assetHeaders);
          const headers = u.pathname === cyberDesktopAssets.terminalPage
            ? { 'Content-Security-Policy': cyberDesktopAssets.policy(APP_ORIGIN) } : undefined;
          return serveStaticWeb(u.pathname.slice(5), request, headers);
        }
        return forwardToWorker('app', request);
      }
      if (u.host === 'moundshroud-lib') {
        return forwardToWorker('lib', request);
      }
    } catch (e) { }
    return new Response('Not found', { status: 404, headers: { 'Content-Type': 'text/plain; charset=utf-8' } });
  });
}

/* ---- Lossless one-time localStorage migration from old Edge profile (http://127.0.0.1:47231) -> app://moundshroud ---- */
async function extractEdgeLocalStorage() {
  if (!fs.existsSync(EDGE_LEVELDB_DIR)) return null;
  const tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'moundshroud-edge-mig-'));
  const tmpLdb = path.join(tmpRoot, 'Local Storage', 'leveldb');
  let win = null;
  try {
    fs.mkdirSync(tmpLdb, { recursive: true });
    for (const ent of fs.readdirSync(EDGE_LEVELDB_DIR, { withFileTypes: true })) {
      if (!ent.isFile() || ent.name === 'LOCK') continue;
      try { fs.copyFileSync(path.join(EDGE_LEVELDB_DIR, ent.name), path.join(tmpLdb, ent.name)); } catch (e) { }
    }
    const ses = session.fromPath(tmpRoot);
    ses.protocol.handle('http', () => new Response('<!doctype html><html><body></body></html>', {
      status: 200,
      headers: { 'Content-Type': 'text/html; charset=utf-8' }
    }));
    win = new BrowserWindow({ show: false, webPreferences: { session: ses, contextIsolation: true, nodeIntegration: false, sandbox: true } });
    const merged = {};
    for (const origin of ['http://127.0.0.1:47231/', 'http://localhost:47231/']) {
      try {
        await win.loadURL(origin);
        const dump = await win.webContents.executeJavaScript('(() => { const o = {}; for (let i = 0; i < localStorage.length; i++) { const k = localStorage.key(i); o[k] = localStorage.getItem(k); } return o; })()');
        if (dump && typeof dump === 'object') Object.assign(merged, dump);
      } catch (e) { }
    }
    try { await ses.closeAllConnections(); } catch (e) { }
    return merged;
  } finally {
    if (win && !win.isDestroyed()) { try { win.destroy(); } catch (e) { } }
    setTimeout(() => { try { fs.rmSync(tmpRoot, { recursive: true, force: true }); } catch (e) { } }, 1500);
  }
}

async function migrateEdgeDataIfNeeded() {
  if (fs.existsSync(MIGRATED_MARK)) return { skipped: true };
  if (!fs.existsSync(EDGE_LEVELDB_DIR)) return { skipped: true, reason: 'no-edge-profile' };
  let items = null;
  try { items = await extractEdgeLocalStorage(); } catch (err) { return { ok: false, error: String(err) }; }
  const keys = items ? Object.keys(items) : [];
  if (!keys.length) {
    fs.writeFileSync(MIGRATED_MARK, JSON.stringify({ at: Date.now(), count: 0 }, null, 2));
    return { ok: true, count: 0 };
  }
  fs.writeFileSync(MIGRATED_BACKUP, JSON.stringify({ app: 'moundshroud-settings', from: 'edge-profile', at: Date.now(), data: items }, null, 2));
  let hydWin = null;
  try {
    hydWin = new BrowserWindow({ show: false, webPreferences: { contextIsolation: true, nodeIntegration: false, sandbox: true } });
    await hydWin.loadURL(APP_ORIGIN + '/__migrate_blank');
    const written = await hydWin.webContents.executeJavaScript(
      '(data => { let n = 0; for (const [k, v] of Object.entries(data)) { if (localStorage.getItem(k) === null) { localStorage.setItem(k, String(v)); n++; } } return n; })(' + JSON.stringify(items) + ')'
    );
    fs.writeFileSync(MIGRATED_MARK, JSON.stringify({ at: Date.now(), extracted: keys.length, written }, null, 2));
    return { ok: true, extracted: keys.length, written };
  } finally {
    if (hydWin && !hydWin.isDestroyed()) { try { hydWin.destroy(); } catch (e) { } }
  }
}

function createSplash() {
  splashWin = new BrowserWindow({
    width: 440,
    height: 280,
    frame: false,
    transparent: false,
    backgroundColor: '#070b18',
    resizable: false,
    movable: true,
    center: true,
    alwaysOnTop: true,
    skipTaskbar: false,
    icon: fs.existsSync(ICON_PATH) ? ICON_PATH : undefined,
    webPreferences: { contextIsolation: true, nodeIntegration: false, sandbox: true }
  });
  splashWin.loadFile(path.join(__dirname, 'splash.html'));
}

function createMainWindow(startHidden = false) {
  mainWin = new BrowserWindow({
    width: 1360,
    height: 880,
    minWidth: 900,
    minHeight: 620,
    show: false,
    backgroundColor: '#090d16',
    title: 'Moundshroud',
    icon: fs.existsSync(ICON_PATH) ? ICON_PATH : undefined,
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      spellcheck: true
    }
  });

  mainWin.setMenuBarVisibility(false);

  mainWin.webContents.setWindowOpenHandler(({ url }) => {
    try {
      const u = new URL(url);
      if (u.protocol === 'https:' || u.protocol === 'http:') {
        shell.openExternal(u.toString());
        return { action: 'deny' };
      }
    } catch (e) { }
    return { action: 'deny' };
  });

  mainWin.webContents.on('will-navigate', (ev, url) => {
    try {
      const u = new URL(url);
      if (u.origin !== APP_ORIGIN && u.origin !== LIB_ORIGIN) {
        ev.preventDefault();
        if (u.protocol === 'https:' || u.protocol === 'http:') shell.openExternal(u.toString());
      }
    } catch (e) { ev.preventDefault(); }
  });

  let shownOnce = false;
  const revealMain = () => {
    if (shownOnce || !mainWin || mainWin.isDestroyed()) return;
    shownOnce = true;
    if (splashWin && !splashWin.isDestroyed()) {
      splashWin.close();
      splashWin = null;
    }
    if (!startHidden) {
      showMainWindow();
    }
  };
  mainWin.once('ready-to-show', revealMain);
  mainWin.webContents.once('did-finish-load', () => setTimeout(revealMain, 150));
  setTimeout(revealMain, 3500);

  mainWin.on('close', ev => {
    if (!quitting) {
      ev.preventDefault();
      mainWin.hide();
    }
  });

  mainWin.on('closed', () => {
    mainWin = null;
  });

  mainWin.loadURL(APP_ORIGIN + '/');
}

function registerHotkeys(attempt = 1) {
  const mod = process.platform === 'darwin' ? 'Command+Alt' : 'Control+Alt';
  let ok = false;
  try {
    globalShortcut.unregister(mod + '+A');
    ok = globalShortcut.register(mod + '+A', toggleMainWindow);
    console.log('Hotkey Ctrl+Alt+A registered:', ok, '(attempt ' + attempt + ')');
  } catch (e) { console.error('Hotkey Ctrl+Alt+A error:', e); }
  if (!ok && attempt < 4) {
    setTimeout(() => { if (!quitting) registerHotkeys(attempt + 1); }, 800);
  }
  const openAction = js => () => {
    showMainWindow();
    if (mainWin && !mainWin.isDestroyed()) mainWin.webContents.executeJavaScript(js).catch(() => { });
  };
  try { globalShortcut.register(mod + '+N', openAction('if(window.A&&A.showTab){A.showTab("notes");A.emit&&A.emit("newitem");}')); } catch (e) { }
  try { globalShortcut.register(mod + '+V', openAction('if(window.A&&A.showTab){A.showTab("chat");if(A.voiceMode&&A.voiceMode.open)A.voiceMode.open();}')); } catch (e) { }
  try { globalShortcut.register(mod + '+E', openAction('if(window.A&&A.showTab){A.showTab("health");}')); } catch (e) { }
}

function buildTray() {
  const iconFile = fs.existsSync(ICON_PATH) ? ICON_PATH : (fs.existsSync(TRAY_PNG) ? TRAY_PNG : null);
  if (!iconFile) return;
  try {
    const img = iconFile.endsWith('.ico') ? nativeImage.createFromPath(iconFile) : nativeImage.createFromPath(iconFile).resize({ width: 16, height: 16 });
    tray = new Tray(img);
    tray.setToolTip('Moundshroud — Standalone Offline AI (Ctrl+Alt+A)');
    const loginArgs = app.isPackaged ? ['--background'] : [__dirname, '--background'];
    const rebuildMenu = () => {
      let openAtLogin = false;
      try { openAtLogin = !!app.getLoginItemSettings({ path: process.execPath, args: loginArgs }).openAtLogin; } catch (e) { }
      tray.setContextMenu(Menu.buildFromTemplate([
        { label: 'Open / Hide Moundshroud  (Ctrl+Alt+A)', click: toggleMainWindow },
        { type: 'separator' },
        {
          label: 'Start with Windows (for Ctrl+Alt+A)',
          type: 'checkbox',
          checked: openAtLogin,
          click: item => {
            try {
              app.setLoginItemSettings({
                openAtLogin: !!item.checked,
                path: process.execPath,
                args: loginArgs
              });
            } catch (e) { }
            rebuildMenu();
          }
        },
        { type: 'separator' },
        { label: 'Quit Moundshroud', click: () => { quitting = true; app.quit(); } }
      ]));
    };
    rebuildMenu();
    tray.on('click', toggleMainWindow);
  } catch (e) { }
}

const START_HIDDEN = process.argv.includes('--background');

app.whenReady().then(async () => {
  nativeTheme.themeSource = 'dark';
  Menu.setApplicationMenu(null);
  if (!START_HIDDEN) createSplash();
  buildTray();
  registerAppProtocol();
  try {
    await startBackendWorker();
    await migrateEdgeDataIfNeeded();
  } catch (err) {
    console.error('Failed to initialize standalone core:', err);
    if (splashWin && !splashWin.isDestroyed()) splashWin.close();
    app.quit();
    return;
  }
  registerHotkeys();
  if (process.env.MOUNDSHROUD_MIGRATE_ONLY === '1') {
    if (splashWin && !splashWin.isDestroyed()) splashWin.close();
    quitting = true;
    app.quit();
    return;
  }
  createMainWindow(START_HIDDEN);
});

app.on('will-quit', () => {
  try { globalShortcut.unregisterAll(); } catch (e) { }
});

app.on('before-quit', () => {
  quitting = true;
  if (worker) {
    try { worker.postMessage({ type: 'shutdown' }); } catch (e) { }
  }
});

app.on('window-all-closed', () => {
  if (quitting) app.quit();
});

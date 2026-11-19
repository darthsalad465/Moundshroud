// Moundshroud Desktop Shell (Electron) — native frameless dark titlebar, animated splash screen,
// embedded local server lifecycle, system tray, single-instance lock, and safe external link handling.
const path = require('path');
const fs = require('fs');
const http = require('http');
const { spawn } = require('child_process');
const { app, BrowserWindow, Tray, Menu, shell, nativeImage } = require('electron');

const PORT = Number(process.env.MOUNDSHROUD_PORT || 47231);
const BASE_URL = 'http://127.0.0.1:' + PORT;

const CORE_DIR = app.isPackaged
  ? path.join(process.resourcesPath, 'app-core')
  : path.resolve(__dirname, '..');

const DATA_DIR = app.isPackaged
  ? path.join(app.getPath('userData'), 'data')
  : path.join(CORE_DIR, 'data');

const ICON_PATH = path.join(CORE_DIR, 'web', 'moundshroud.ico');
const TRAY_PNG = path.join(CORE_DIR, 'web', 'logo-64.png');

let mainWin = null;
let splashWin = null;
let tray = null;
let serverProc = null;
let quitting = false;

// Single-instance desktop app lock
const gotLock = app.requestSingleInstanceLock();
if (!gotLock) {
  app.quit();
} else {
  app.on('second-instance', () => {
    if (mainWin) {
      if (mainWin.isMinimized()) mainWin.restore();
      mainWin.show();
      mainWin.focus();
    }
  });
}

function pingServer() {
  return new Promise(resolve => {
    const req = http.get(BASE_URL + '/api/status', { timeout: 900 }, res => {
      res.resume();
      resolve(res.statusCode === 200);
    });
    req.on('error', () => resolve(false));
    req.on('timeout', () => { req.destroy(); resolve(false); });
  });
}

async function waitForServer(maxMs = 20000) {
  const start = Date.now();
  while (Date.now() - start < maxMs) {
    if (await pingServer()) return true;
    await new Promise(r => setTimeout(r, 180));
  }
  return false;
}

async function ensureServer() {
  if (await pingServer()) return true;
  fs.mkdirSync(DATA_DIR, { recursive: true });
  const env = Object.assign({}, process.env, {
    ELECTRON_RUN_AS_NODE: '1',
    MOUNDSHROUD_PORT: String(PORT),
    MOUNDSHROUD_DATA: DATA_DIR,
    MOUNDSHROUD_DESKTOP: '1'
  });
  serverProc = spawn(process.execPath, [path.join(CORE_DIR, 'server.js')], {
    cwd: CORE_DIR,
    env,
    windowsHide: true,
    stdio: 'ignore'
  });
  serverProc.on('exit', () => { serverProc = null; });
  return waitForServer(22000);
}

function stopServer() {
  if (!serverProc) return;
  try {
    const req = http.request({
      host: '127.0.0.1',
      port: PORT,
      path: '/api/shutdown',
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Host': '127.0.0.1:' + PORT },
      timeout: 1500
    }, res => res.resume());
    req.on('error', () => {});
    req.end(JSON.stringify({ why: 'quit' }));
  } catch (e) { }
  const proc = serverProc;
  setTimeout(() => { try { proc.kill(); } catch (e) { } }, 1200);
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

function createMainWindow() {
  mainWin = new BrowserWindow({
    width: 1360,
    height: 880,
    minWidth: 900,
    minHeight: 620,
    show: false,
    backgroundColor: '#090d16',
    title: 'Moundshroud',
    icon: fs.existsSync(ICON_PATH) ? ICON_PATH : undefined,
    titleBarStyle: 'hidden',
    titleBarOverlay: {
      color: '#0b1020',
      symbolColor: '#cbd5e1',
      height: 40
    },
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

  // Open only safe https/http external links in the user's browser; never navigate Moundshroud away
  mainWin.webContents.setWindowOpenHandler(({ url }) => {
    try {
      const u = new URL(url);
      if ((u.protocol === 'https:' || u.protocol === 'http:') && u.hostname !== '127.0.0.1' && u.hostname !== 'localhost') {
        shell.openExternal(u.toString());
        return { action: 'deny' };
      }
    } catch (e) { }
    return { action: 'deny' };
  });

  mainWin.webContents.on('will-navigate', (ev, url) => {
    try {
      const u = new URL(url);
      if (u.origin !== BASE_URL && u.hostname !== '127.0.0.1' && u.hostname !== 'localhost') {
        ev.preventDefault();
        if (u.protocol === 'https:' || u.protocol === 'http:') shell.openExternal(u.toString());
      }
    } catch (e) { ev.preventDefault(); }
  });

  mainWin.once('ready-to-show', () => {
    if (splashWin && !splashWin.isDestroyed()) {
      splashWin.close();
      splashWin = null;
    }
    mainWin.show();
    mainWin.focus();
  });

  mainWin.on('close', ev => {
    if (!quitting && tray) {
      ev.preventDefault();
      mainWin.hide();
    }
  });

  mainWin.loadURL(BASE_URL);
}

function buildTray() {
  const iconFile = fs.existsSync(ICON_PATH) ? ICON_PATH : (fs.existsSync(TRAY_PNG) ? TRAY_PNG : null);
  if (!iconFile) return;
  try {
    tray = new Tray(nativeImage.createFromPath(iconFile));
    tray.setToolTip('Moundshroud — Private Offline AI');
    tray.setContextMenu(Menu.buildFromTemplate([
      { label: 'Open Moundshroud', click: () => { if (mainWin) { mainWin.show(); mainWin.focus(); } } },
      { type: 'separator' },
      { label: 'Quit Moundshroud', click: () => { quitting = true; app.quit(); } }
    ]));
    tray.on('click', () => {
      if (!mainWin) return;
      if (mainWin.isVisible()) mainWin.focus(); else { mainWin.show(); mainWin.focus(); }
    });
  } catch (e) { }
}

app.whenReady().then(async () => {
  createSplash();
  buildTray();
  const ok = await ensureServer();
  if (!ok) {
    if (splashWin && !splashWin.isDestroyed()) splashWin.close();
    app.quit();
    return;
  }
  createMainWindow();
});

app.on('before-quit', () => {
  quitting = true;
  stopServer();
});

app.on('window-all-closed', () => {
  if (quitting || !tray) app.quit();
});

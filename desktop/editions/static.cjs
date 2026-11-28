'use strict';

const { app, BrowserWindow, Menu, protocol } = require('electron');
const fs = require('node:fs/promises');
const path = require('node:path');
const edition = require('./edition.json');
const testing = process.argv.includes('--edition-smoke');
const assets = app.isPackaged ? path.join(process.resourcesPath, 'app-core', 'web') : path.join(__dirname, 'app-core', 'web');
const origin = 'app://moundshroud';
const files = new Map([
  ['/', ['index.html', 'text/html']],
  ['/web/cyber.css', ['cyber.css', 'text/css']],
  ['/web/cyber.js', ['cyber.js', 'text/javascript']],
  ['/web/logo-64.png', ['logo-64.png', 'image/png']]
]);
const csp = "default-src 'self'; connect-src 'none'; object-src 'none'; frame-src 'none'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'";

app.setName(edition.name);
app.setAppUserModelId('org.moundshroud.' + edition.id);
if (testing && process.env.MOUNDSHROUD_EDITION_PROFILE) app.setPath('userData', process.env.MOUNDSHROUD_EDITION_PROFILE);
protocol.registerSchemesAsPrivileged([{ scheme: 'app', privileges: { standard: true, secure: true, supportFetchAPI: true } }]);

app.whenReady().then(() => {
  Menu.setApplicationMenu(null);
  protocol.handle('app', async request => {
    const url = new URL(request.url);
    const asset = url.host === 'moundshroud' && request.method === 'GET' && files.get(url.pathname);
    if (!asset) return new Response(null, { status: 404 });
    const [file, type] = asset;
    return new Response(await fs.readFile(path.join(assets, file)), {
      headers: { 'Content-Type': type, 'Content-Security-Policy': csp, 'X-Content-Type-Options': 'nosniff' }
    });
  });
  const win = new BrowserWindow({
    title: edition.name, width: 1160, height: 800, minWidth: 560, minHeight: 480, show: !testing,
    icon: path.join(assets, 'moundshroud.ico'),
    webPreferences: { sandbox: true, contextIsolation: true, nodeIntegration: false }
  });
  win.webContents.on('will-navigate', event => event.preventDefault());
  win.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
  win.loadURL(origin + '/');
  if (testing) require('./smoke.cjs')(win, edition);
}).catch(error => { console.error(error); app.exit(1); });
app.on('window-all-closed', () => app.quit());

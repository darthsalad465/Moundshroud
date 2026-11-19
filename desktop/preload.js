// Safe preload bridge for Moundshroud Desktop (contextIsolation: true, sandbox: true).
const { contextBridge } = require('electron');

contextBridge.exposeInMainWorld('MOUNDSHROUD_DESKTOP', {
  isDesktop: true,
  platform: process.platform,
  electron: process.versions.electron || ''
});
